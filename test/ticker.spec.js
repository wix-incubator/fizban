import test from 'ava';
import { ticker } from '../src/ticker.js';

function createWindowScheduler () {
  const frames = new Map();
  let nextId = 0;

  return {
    frames,
    requestAnimationFrame (callback) {
      const id = ++nextId;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame (id) {
      frames.delete(id);
    },
    executeAnimationFrame () {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach(callback => callback());
    }
  };
}

test.afterEach.always(() => {
  for (const instance of [...ticker.pool]) {
    ticker.remove(instance);
  }
});

test('instances tick on their own window scheduler', t => {
  const firstWindow = createWindowScheduler();
  const secondWindow = createWindowScheduler();
  const first = { window: firstWindow, ticks: 0, tick () { this.ticks += 1; } };
  const second = { window: secondWindow, ticks: 0, tick () { this.ticks += 1; } };

  ticker.add(first);
  ticker.add(second);

  t.is(firstWindow.frames.size, 1);
  t.is(secondWindow.frames.size, 1);

  firstWindow.executeAnimationFrame();

  t.is(first.ticks, 1);
  t.is(second.ticks, 0);

  ticker.remove(first);
  ticker.remove(second);

  t.is(firstWindow.frames.size, 0);
  t.is(secondWindow.frames.size, 0);
});
