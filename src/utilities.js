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
 * @param {Window} ownerWindow window used to schedule the frame
 * @return {(function(): void)}
 */
function frameThrottle (fn, ownerWindow = window) {
  let throttled = false;
  let frameId = null;

  function trigger () {
    if (!throttled) {
      throttled = true;

      frameId = ownerWindow.requestAnimationFrame(() => {
        throttled = false;
        frameId = null;
        fn();
      });
    }
  }

  trigger.cancel = () => {
    if (frameId !== null) {
      ownerWindow.cancelAnimationFrame(frameId);
      frameId = null;
      throttled = false;
    }
  };

  return trigger;
}

/**
 * Debounce a function by interval in milliseconds.
 *
 * @param {function} fn
 * @param {number} interval
 * @param {Window} ownerWindow window used to schedule the timeout
 * @return {function}
 */
function debounce (fn, interval, ownerWindow = window) {
  let debounced = null;

  function bounce () {
    if (debounced !== null) {
      ownerWindow.clearTimeout(debounced);
    }

    debounced = ownerWindow.setTimeout(() => {
      debounced = null;
      fn();
    }, interval);
  }

  bounce.cancel = () => {
    if (debounced !== null) {
      ownerWindow.clearTimeout(debounced);
      debounced = null;
    }
  };

  return bounce;
}

export {
  defaultTo,
  lerp,
  frameThrottle,
  debounce
};
