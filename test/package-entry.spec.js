import test from 'ava';
import { createRequire } from 'node:module';
import './mocks.js';

const require = createRequire(import.meta.url);
const { Scroll } = require('..');

function createForeignWindow () {
  const scrollListeners = new Set();
  const animationFrames = new Map();
  let nextAnimationFrameId = 0;
  let scrollX = 0;
  let scrollY = 0;

  const foreignWindow = {
    animationFrames,
    get scrollX () { return scrollX; },
    get scrollY () { return scrollY; },
    addEventListener (type, listener) {
      if (type === 'scroll') {
        scrollListeners.add(listener);
      }
    },
    removeEventListener (type, listener) {
      if (type === 'scroll') {
        scrollListeners.delete(listener);
      }
    },
    requestAnimationFrame (callback) {
      const id = nextAnimationFrameId++;
      animationFrames.set(id, callback);
      return id;
    },
    cancelAnimationFrame (id) {
      animationFrames.delete(id);
    },
    scrollTo (x, y) {
      scrollX = x;
      scrollY = y;
      scrollListeners.forEach(listener => listener());
    }
  };

  foreignWindow.window = foreignWindow;
  foreignWindow.document = {
    defaultView: foreignWindow,
    documentElement: {
      clientHeight: 360,
      clientWidth: 640
    },
    body: {}
  };

  return foreignWindow;
}

test.beforeEach(() => {
  window.animationFrameHandlers.length = 0;
});

test('CommonJS package entry schedules foreign Window roots in their own realm', t => {
  const foreignWindow = createForeignWindow();
  const scroll = new Scroll({
    root: foreignWindow,
    scenes: [{
      effect () {},
      start: 0,
      duration: 100
    }]
  });

  scroll.start();
  foreignWindow.scrollTo(0, 50);

  t.is(foreignWindow.animationFrames.size, 1);
  t.is(window.animationFrameHandlers.length, 0);

  scroll.destroy();

  t.is(foreignWindow.animationFrames.size, 0);
});
