import test from 'ava';
import { JSDOM } from 'jsdom';
import './mocks.js';
import { Scroll } from '../src/Scroll.js';

function defineValue (target, property, value) {
  Object.defineProperty(target, property, {
    configurable: true,
    writable: true,
    value
  });
}

function defineLayout (element, layout) {
  Object.entries(layout).forEach(([property, value]) => {
    defineValue(element, property, value);
  });
}

function createIframeEnvironment () {
  const dom = new JSDOM('<!doctype html><iframe></iframe>', {
    pretendToBeVisual: true
  });
  const iframe = dom.window.document.querySelector('iframe');
  const iframeWindow = iframe.contentWindow;
  const iframeDocument = iframeWindow.document;
  const animationFrames = new Map();
  const resizeListeners = new Set();
  const resizeObservers = [];
  const intersectionObservers = [];
  const timeouts = new Map();
  let animationFrameId = 0;
  let timeoutId = 0;
  let scrollX = 0;
  let scrollY = 0;
  let computedStyleReads = 0;

  defineLayout(iframeDocument.documentElement, {
    clientWidth: 640,
    clientHeight: 360
  });
  defineLayout(iframeDocument.body, {
    offsetLeft: 0,
    offsetTop: 0,
    offsetParent: null
  });
  Object.defineProperties(iframeWindow, {
    scrollX: { configurable: true, get: () => scrollX },
    scrollY: { configurable: true, get: () => scrollY }
  });

  iframeWindow.scrollTo = (x, y) => {
    scrollX = x;
    scrollY = y;
    iframeWindow.dispatchEvent(new iframeWindow.Event('scroll'));
  };
  iframeWindow.requestAnimationFrame = callback => {
    const id = ++animationFrameId;
    animationFrames.set(id, callback);
    return id;
  };
  iframeWindow.cancelAnimationFrame = id => {
    animationFrames.delete(id);
  };
  iframeWindow.setTimeout = callback => {
    const id = ++timeoutId;
    timeouts.set(id, callback);
    return id;
  };
  iframeWindow.clearTimeout = id => {
    timeouts.delete(id);
  };

  const nativeAddEventListener = iframeWindow.addEventListener.bind(iframeWindow);
  const nativeRemoveEventListener = iframeWindow.removeEventListener.bind(iframeWindow);
  iframeWindow.addEventListener = (type, listener, options) => {
    if (type === 'resize') {
      resizeListeners.add(listener);
    }
    nativeAddEventListener(type, listener, options);
  };
  iframeWindow.removeEventListener = (type, listener, options) => {
    if (type === 'resize') {
      resizeListeners.delete(listener);
    }
    nativeRemoveEventListener(type, listener, options);
  };

  const nativeGetComputedStyle = iframeWindow.getComputedStyle.bind(iframeWindow);
  iframeWindow.getComputedStyle = element => {
    computedStyleReads += 1;
    return nativeGetComputedStyle(element);
  };

  iframeWindow.ResizeObserver = class {
    constructor (callback) {
      this.callback = callback;
      this.disconnected = false;
      this.observed = [];
      resizeObservers.push(this);
    }

    observe (target) {
      this.observed.push(target);
    }

    disconnect () {
      this.disconnected = true;
    }
  };

  iframeWindow.IntersectionObserver = class {
    constructor (callback, options) {
      this.callback = callback;
      this.options = options;
      this.disconnected = false;
      this.observed = [];
      intersectionObservers.push(this);
    }

    observe (target) {
      this.observed.push(target);
    }

    disconnect () {
      this.disconnected = true;
    }
  };

  return {
    animationFrames,
    executeAnimationFrame () {
      const callbacks = [...animationFrames.values()];
      animationFrames.clear();
      callbacks.forEach(callback => callback(1));
    },
    get computedStyleReads () {
      return computedStyleReads;
    },
    iframeDocument,
    iframeWindow,
    intersectionObservers,
    resizeListeners,
    resizeObservers,
    timeouts,
    destroy () {
      dom.window.close();
    }
  };
}

test.beforeEach(() => {
  window.animationFrameHandlers.length = 0;
});

test('foreign iframe Window owns viewport APIs, observers, listeners, and scheduling', t => {
  const iframe = createIframeEnvironment();
  const source = iframe.iframeDocument.createElement('div');

  source.style.position = 'relative';
  iframe.iframeDocument.body.append(source);
  defineLayout(source, {
    offsetHeight: 100,
    offsetTop: 100,
    offsetParent: iframe.iframeDocument.body
  });

  let progress = 0;
  const scroll = new Scroll({
    root: iframe.iframeWindow,
    contentRoot: iframe.iframeDocument.body,
    observeContentResize: true,
    observeSourcesResize: true,
    observeViewportResize: true,
    transitionActive: true,
    transitionFriction: 0.5,
    scenes: [{
      effect: (scene, value) => { progress = value; },
      start: {name: 'entry', offset: 0},
      end: {name: 'exit', offset: 100},
      viewSource: source
    }]
  });

  scroll.start();

  t.is(scroll.config.root, iframe.iframeWindow);
  t.is(scroll.window, iframe.iframeWindow);
  t.true(iframe.computedStyleReads > 0);
  t.is(iframe.intersectionObservers.length, 1);
  t.is(iframe.intersectionObservers[0].options.root, iframe.iframeDocument);
  t.is(iframe.resizeObservers.length, 2);
  t.true(iframe.resizeListeners.size > 0);

  iframe.iframeWindow.scrollTo(0, 200);

  t.true(iframe.animationFrames.size > 0);
  t.is(window.animationFrameHandlers.length, 0);

  iframe.executeAnimationFrame();

  t.is(+progress.toFixed(3), 0.783);
  t.true(iframe.animationFrames.size > 0);

  iframe.resizeObservers[1].callback([]);
  iframe.iframeWindow.dispatchEvent(new iframe.iframeWindow.Event('resize'));

  t.true(iframe.timeouts.size > 0);

  scroll.destroy();

  t.is(iframe.animationFrames.size, 0);
  t.is(iframe.timeouts.size, 0);
  t.is(iframe.resizeListeners.size, 0);
  t.true(iframe.resizeObservers.every(observer => observer.disconnected));
  t.true(iframe.intersectionObservers.every(observer => observer.disconnected));
  iframe.destroy();
});

test('a foreign iframe document body normalizes to its own Window', t => {
  const iframe = createIframeEnvironment();
  const scroll = new Scroll({
    root: iframe.iframeDocument.body,
    scenes: []
  });

  t.is(scroll.config.root, iframe.iframeWindow);
  t.is(scroll.window, iframe.iframeWindow);

  scroll.destroy();
  iframe.destroy();
});

test('an element scroll root uses its iframe owning window', t => {
  const iframe = createIframeEnvironment();
  const root = iframe.iframeDocument.createElement('div');
  const source = iframe.iframeDocument.createElement('div');

  root.append(source);
  iframe.iframeDocument.body.append(root);
  defineLayout(root, {
    clientHeight: 200,
    firstElementChild: source,
    offsetHeight: 200,
    offsetTop: 0,
    offsetParent: iframe.iframeDocument.body,
    scrollLeft: 0,
    scrollTop: 0
  });
  defineLayout(source, {
    offsetHeight: 100,
    offsetTop: 100,
    offsetParent: root
  });
  root.scrollTo = (x, y) => {
    root.scrollLeft = x;
    root.scrollTop = y;
    root.dispatchEvent(new iframe.iframeWindow.Event('scroll'));
  };

  const scroll = new Scroll({
    root,
    observeSourcesResize: true,
    scenes: [{
      effect () {},
      duration: 'entry',
      viewSource: source
    }]
  });

  scroll.start();
  root.scrollTo(0, 50);

  t.true(iframe.computedStyleReads > 0);
  t.true(iframe.resizeObservers.length > 0);
  t.true(iframe.animationFrames.size > 0);
  t.is(window.animationFrameHandlers.length, 0);

  scroll.destroy();
  iframe.destroy();
});
