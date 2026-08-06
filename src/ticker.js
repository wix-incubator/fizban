import { getOwnerWindow } from './dom.js';

function getInstanceWindow (instance) {
  return instance.window || getOwnerWindow(instance.config?.root);
}

/**
 * @typedef {ticker}
 * @property {Set} pool
 * @property {Map<Window, number>} animationFrames
 */
export const ticker = {
  pool: new Set(),
  animationFrames: new Map(),
  /**
   * Starts the animation loop.
   */
  start (ownerWindow = getOwnerWindow()) {
    if ( ! ticker.animationFrames.has(ownerWindow) ) {
      const loop = () => {
        ticker.animationFrames.set(ownerWindow, ownerWindow.requestAnimationFrame(loop));
        ticker.tick(ownerWindow);
      };

      ticker.animationFrames.set(ownerWindow, ownerWindow.requestAnimationFrame(loop));
    }
  },

  /**
   * Stops the animation loop.
   */
  stop (ownerWindow = getOwnerWindow()) {
    ownerWindow.cancelAnimationFrame(ticker.animationFrames.get(ownerWindow));
    ticker.animationFrames.delete(ownerWindow);
  },

  /**
   * Invoke `.tick()` on all instances in the pool.
   */
  tick (ownerWindow) {
    for (let instance of ticker.pool) {
      const instanceWindow = getInstanceWindow(instance);
      if (!ownerWindow || instanceWindow === ownerWindow) {
        instance.tick();
      }
    }
  },

  /**
   * Add an instance to the pool.
   *
   * @param {Scroll} instance
   */
  add (instance) {
    ticker.pool.add(instance);
    instance.ticking = true;
    const ownerWindow = getInstanceWindow(instance);

    ticker.start(ownerWindow);
  },

  /**
   * Remove an instance from the pool.
   *
   * @param {Scroll} instance
   */
  remove (instance) {
    const ownerWindow = getInstanceWindow(instance);

    if ( ticker.pool.delete(instance) ) {
      instance.ticking = false;
    }

    const hasWindowInstances = [...ticker.pool].some(item => getInstanceWindow(item) === ownerWindow);
    if ( ! hasWindowInstances ) {
      ticker.stop(ownerWindow);
    }
  }
};
