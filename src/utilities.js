/**
 * Returns a new Object with the properties of the first argument
 * assigned to it, and the second argument as its prototype, so
 * its properties are served as defaults.
 *
 * @param {Object} obj properties to assign
 * @param {Object|null} defaults
 * @return {Object}
 */
function defaultTo (obj, defaults) {
  return Object.assign(Object.create(defaults), obj);
}

/**
 * Interpolate from a to b by the factor t.
 *
 * @param {number} a start point
 * @param {number} b end point
 * @param {number} t interpolation factor
 * @param {number} e minimal possible delta between result and start, and between result and end
 * @return {number}
 */
function lerp (a, b, t, e) {
  let res = a * (1 - t) + b * t;

  if (e) {
    const deltaFromStart = res - a;
    if (Math.abs(deltaFromStart) < e) {
      res = a + e * Math.sign(deltaFromStart);
    }

    const deltaFromEnd = b - res;

    if (Math.abs(deltaFromEnd) < e) {
      return b;
    }
  }

  return res;
}

/**
 * Throttle a function to trigger once per animation frame.
 * Keeps the arguments from last call, even if that call gets ignored.
 *
 * @param {function} fn function to throttle
 * @return {(function(): void)}
 */
function frameThrottle (fn) {
  let throttled = false;

  return function () {
    if (!throttled) {
      throttled = true;

      window.requestAnimationFrame(() => {
        throttled = false;
        fn();
      });
    }
  };
}

/**
 * Debounce a function by interval in milliseconds.
 *
 * @param {function} fn
 * @param {number} interval
 * @return {function}
 */
function debounce (fn, interval) {
  let debounced = 0;

  return function bounce () {
    if (debounced) {
      window.clearTimeout(debounced);
    }

    debounced = window.setTimeout(() => {
      debounced = 0;
      fn();
    }, interval);
  };
}

export {
  defaultTo,
  lerp,
  frameThrottle,
  debounce
};
