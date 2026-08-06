/**
 * @typedef {ticker}
 * @property {Set} pool
 * @property {number} animationFrame
 */
export const ticker = {
  pool: new Set(),
  /**
   * Starts the animation loop.
   */
  start () {
    if ( ! ticker.animationFrame ) {
      const loop = () => {
        ticker.animationFrame = window.requestAnimationFrame(loop);
        ticker.tick();
      };

      ticker.animationFrame = window.requestAnimationFrame(loop);
    }
  },

  /**
   * Stops the animation loop.
   */
  stop () {
    window.cancelAnimationFrame(ticker.animationFrame);
    ticker.animationFrame = null;
  },

  /**
   * Invoke `.tick()` on all instances in the pool.
   */
  tick () {
    for (let instance of ticker.pool) {
      instance.tick();
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

    if ( ticker.pool.size ) {
      ticker.start();
    }
  },

  /**
   * Remove an instance from the pool.
   *
   * @param {Scroll} instance
   */
  remove (instance) {
    if ( ticker.pool.delete(instance) ) {
      instance.ticking = false;
    }

    if ( ! ticker.pool.size ) {
      ticker.stop();
    }
  }
};
