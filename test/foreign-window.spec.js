import test from 'ava';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import './mocks.js';
import { Scroll } from '../src/Scroll.js';
import { getOwnerWindow } from '../src/dom.js';

const require = createRequire(import.meta.url);
const { Scroll: PackageScroll } = require('..');

function defineLayout (element, layout) {
  Object.entries(layout).forEach(([property, value]) => {
    Object.defineProperty(element, property, {
      configurable: true,
      writable: true,
      value
    });
  });
}

function createIframeEnvironment () {
  const dom = new JSDOM('<!doctype html><iframe></iframe>', {pretendToBeVisual: true});
  const iframeWindow = dom.window.document.querySelector('iframe').contentWindow;
  const iframeDocument = iframeWindow.document;
  const animationFrames = new Map();
  const resizeListeners = new Set();
  const resizeObservers = [];
  const intersectionObservers = [];
  let frameId = 0;
  let scrollX = 0;
  let scrollY = 0;
  let computedStyleReads = 0;

  defineLayout(iframeDocument.documentElement, {clientWidth: 640, clientHeight: 360});
  defineLayout(iframeDocument.body, {offsetTop: 0, offsetParent: null});
  Object.defineProperties(iframeWindow, {
    scrollX: {configurable: true, get: () => scrollX},
    scrollY: {configurable: true, get: () => scrollY}
  });

  iframeWindow.scrollTo = (x, y) => {
    scrollX = x;
    scrollY = y;
    iframeWindow.dispatchEvent(new iframeWindow.Event('scroll'));
  };
  iframeWindow.requestAnimationFrame = callback => {
    const id = ++frameId;
    animationFrames.set(id, callback);
    return id;
  };
  iframeWindow.cancelAnimationFrame = id => animationFrames.delete(id);

  const nativeGetComputedStyle = iframeWindow.getComputedStyle.bind(iframeWindow);
  iframeWindow.getComputedStyle = element => {
    computedStyleReads += 1;
    return nativeGetComputedStyle(element);
  };

  const nativeAddEventListener = iframeWindow.addEventListener.bind(iframeWindow);
  const nativeRemoveEventListener = iframeWindow.removeEventListener.bind(iframeWindow);
  iframeWindow.addEventListener = (type, listener, options) => {
    if (type === 'resize') resizeListeners.add(listener);
    nativeAddEventListener(type, listener, options);
  };
  iframeWindow.removeEventListener = (type, listener, options) => {
    if (type === 'resize') resizeListeners.delete(listener);
    nativeRemoveEventListener(type, listener, options);
  };

  class Observer {
    constructor (instances) {
      this.disconnected = false;
      instances.push(this);
    }
    observe () {}
    disconnect () { this.disconnected = true; }
  }
  iframeWindow.ResizeObserver = class extends Observer {
    constructor () { super(resizeObservers); }
  };
  iframeWindow.IntersectionObserver = class extends Observer {
    constructor () { super(intersectionObservers); }
  };

  return {
    animationFrames,
    get computedStyleReads () { return computedStyleReads; },
    iframeDocument,
    iframeWindow,
    intersectionObservers,
    resizeListeners,
    resizeObservers,
    executeAnimationFrame () {
      const callbacks = [...animationFrames.values()];
      animationFrames.clear();
      callbacks.forEach(callback => callback(1));
    },
    destroy () { dom.window.close(); }
  };
}

test.beforeEach(() => {
  window.animationFrameHandlers.length = 0;
});

test('foreign iframe Window owns DOM APIs and scheduling', t => {
  const iframe = createIframeEnvironment();
  const source = iframe.iframeDocument.createElement('div');
  iframe.iframeDocument.body.append(source);
  defineLayout(source, {
    offsetHeight: 100,
    offsetTop: 100,
    offsetParent: iframe.iframeDocument.body
  });

  let progress = 0;
  const scroll = new Scroll({
    root: iframe.iframeWindow,
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
  iframe.iframeWindow.scrollTo(0, 200);

  t.is(scroll._window, iframe.iframeWindow);
  t.true(iframe.computedStyleReads > 0);
  t.is(iframe.resizeObservers.length, 1);
  t.is(iframe.intersectionObservers.length, 1);
  t.is(iframe.resizeListeners.size, 1);
  t.true(iframe.animationFrames.size > 0);
  t.is(window.animationFrameHandlers.length, 0);

  iframe.executeAnimationFrame();
  t.is(+progress.toFixed(3), 0.783);

  scroll.destroy();
  t.is(iframe.resizeListeners.size, 0);
  t.true(iframe.resizeObservers.every(observer => observer.disconnected));
  t.true(iframe.intersectionObservers.every(observer => observer.disconnected));
  iframe.destroy();
});

test('elements resolve their iframe owning window', t => {
  const iframe = createIframeEnvironment();
  t.is(getOwnerWindow(iframe.iframeDocument.body), iframe.iframeWindow);
  iframe.destroy();
});

test('CommonJS package entry supports a foreign iframe Window', t => {
  const iframe = createIframeEnvironment();
  const scroll = new PackageScroll({
    root: iframe.iframeWindow,
    scenes: [{effect () {}, start: 0, duration: 100}]
  });

  scroll.start();

  t.true(iframe.animationFrames.size > 0);
  t.is(window.animationFrameHandlers.length, 0);

  scroll.destroy();
  iframe.destroy();
});
