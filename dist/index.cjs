'use strict';

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
 * @param {number} e minimal possible delta between result and end
 * @return {number}
 */
function lerp (a, b, t, e) {
  const res = a * (1 - t) + b * t;

  if (e) {
    const delta = b - res;

    if (Math.abs(delta) < e) {
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

/**
 * Convert a range into offset in pixels.
 *
 * @param {{name: RangeName, offset: number}} range
 * @param {number} viewportSize
 * @param {{start: number, end: number}} rect
 * @return {number}
 */
function transformRangeToPosition (range, viewportSize, rect) {
  const { name, offset = 0 } = range;
  const { start, end } = rect;
  const height = end - start;
  const percentage = offset / 100;

  let startPosition, duration;

  if (name === 'entry') {
    startPosition = start - viewportSize;
    duration = Math.min(viewportSize, height);
  }
  else if (name === 'contain') {
    startPosition = Math.min(end - viewportSize, start);
    // it's either VH - height OR height - VH; so it boils down to just the absolute value of that
    duration = Math.abs(viewportSize - height);
  }
  else if (name === 'exit') {
    startPosition = Math.max(start, end - viewportSize);
    duration = Math.min(viewportSize, height);
  }
  else if (name === 'cover') {
    startPosition = start - viewportSize;
    duration = height + viewportSize;
  }

  return (startPosition + percentage * duration) | 0;
}

/**
 * Convert scene data in ranges into offsets in pixels.
 *
 * @param {ScrollScene} scene
 * @param {{start: number, end: number}} rect
 * @param {number} viewportSize
 * @param {boolean} isHorizontal
 * @return {ScrollScene}
 */
function transformSceneRangesToOffsets (scene, rect, viewportSize, isHorizontal) {
  const { start, end, duration } = scene;

  let startOffset = start;
  let endOffset = end;
  let startRange = scene.startRange;
  let endRange = scene.endRange;
  let overrideDuration;

  if (typeof duration === 'string') {
    startRange = { name: duration, offset: 0 };
    endRange = { name: duration, offset: 100 };
    startOffset = transformRangeToPosition(startRange, viewportSize, rect);
    endOffset = transformRangeToPosition(endRange, viewportSize, rect);
    overrideDuration = endOffset - startOffset;
  }
  else {
    if (startRange || start?.name) {
      startRange = startRange || start;
      startOffset = transformRangeToPosition(startRange, viewportSize, rect);
    }

    if (endRange || end?.name) {
      endRange = endRange || end;
      endOffset = transformRangeToPosition(endRange, viewportSize, rect);
    }
    else if (typeof duration === 'number') {
      endOffset = startOffset + duration;
    }
  }

  return {...scene, start: startOffset, end: endOffset, startRange, endRange, duration: overrideDuration || duration };
}

/**
 * Check whether the position of an element is sticky.
 *
 * @param {CSSStyleDeclaration} style
 * @return {boolean}
 */
function getIsSticky (style) {
  return style.position === 'sticky';
}

/**
 * Get offset of an element in scroll direction.
 *
 * @param {CSSStyleDeclaration} style
 * @param {boolean} isHorizontal
 * @return {number}
 */
function getStickyOffset (style, isHorizontal) {
  // TODO: get also right/bottom offsets
  return parseInt(isHorizontal ? style.left : style.top);
}

/**
 *
 * @param {HTMLElement} element
 * @param {boolean} isHorizontal
 * @param {boolean} isSticky
 * @return {number}
 */
function getRectStart (element, isHorizontal, isSticky) {
  // TODO: implement support for RTL writing-mode
  if (isSticky) {
    element.style.position = 'static';
  }

  const result = (isHorizontal ? element.offsetLeft : element.offsetTop) || 0;

  if (isSticky) {
    // assuming the sticky position came from a stylesheet and not set inline
    element.style.position = null;
  }

  return result
}

/**
 * Returns a converted scene data from ranges into offsets in pixels.
 *
 * @param {ScrollScene} scene
 * @param {Window|HTMLElement} root
 * @param {number} viewportSize
 * @param {boolean} isHorizontal
 * @return {ScrollScene}
 */
function getTransformedScene (scene, root, viewportSize, isHorizontal) {
  const element = scene.viewSource;
  const elementStyle = window.getComputedStyle(element);
  const isElementSticky = getIsSticky(elementStyle);

  let parent = element.offsetParent;
  let elementLayoutStart = getRectStart(element, isHorizontal, isElementSticky);
  const size = (isHorizontal ? element.offsetWidth : element.offsetHeight) || 0;
  const offsetTree = [{
    element,
    offset: elementLayoutStart,
    size,
    isSticky: isElementSticky,
    style: isElementSticky ? elementStyle : null
  }];

  while (parent) {
    if (parent === root) {
      offsetTree.push({element: parent, offset: 0});
      // if we're at the root don't add its own offset
      break;
    }

    const nodeStyle = window.getComputedStyle(parent);
    const isSticky = getIsSticky(nodeStyle);

    // get the base offset of the source element - before adding sticky intervals
    const offset = getRectStart(parent, isHorizontal, isSticky);
    elementLayoutStart += offset;
    offsetTree.push({element: parent, offset, isSticky, style: isSticky ? nodeStyle : null});
    parent = parent.offsetParent;
  }

  offsetTree.reverse();

  const transformedScene = transformSceneRangesToOffsets(
    scene,
    {start: elementLayoutStart, end: elementLayoutStart + size},
    viewportSize);

  let accumulatedOffset = 0;

  /*
   * check for sticky positioned elements in the tree and add stuck intervals if needed
   */
  offsetTree.forEach((node, index) => {
    accumulatedOffset += node.offset;
    const isSticky = node.isSticky;

    if (isSticky) {
      // stuckStart is the amount needed to scroll to reach the stuck state
      const stuckStart = accumulatedOffset - getStickyOffset(node.style, isHorizontal);

      // check if stuckStart is before the point of scroll where the timeline starts
      const isBeforeStart = stuckStart < transformedScene.start;
      // check if stuckStart is inside the timeline's active scroll interval
      const isInsideDuration = !isBeforeStart && stuckStart <= transformedScene.end;

      let extraOffset = 0;
      const parent = offsetTree[index - 1]?.element;

      if (parent) {
        if (isBeforeStart || isInsideDuration) {
          const parentSize = (isHorizontal ? parent.offsetWidth : parent.offsetHeight) || 0;
          const elementOffset = node.offset;
          const elementSize = (isHorizontal ? node.element.offsetWidth : node.element.offsetHeight) || 0;

          extraOffset = parentSize - (elementOffset + elementSize);
          accumulatedOffset += extraOffset;
          transformedScene.end += extraOffset;
        }

        if (isBeforeStart) {
          transformedScene.start += extraOffset;
        }
      }
    }
  });

  return transformedScene;
}

const VIEWPORT_RESIZE_INTERVAL = 100;

/**
 * @private
 * @type {scrollConfig}
 */
const DEFAULTS$1 = {
  horizontal: false,
  observeViewportEntry: true,
  viewportRootMargin: '7% 7%',
  observeViewportResize: false,
  observeSourcesResize: false
};

/*
 * Utilities for scroll controller
 */

/**
 * Utility for calculating effect progress.
 *
 * @private
 * @param {number} p current scroll position
 * @param {number} start start position
 * @param {number} end end position
 * @param {number} duration duration of effect in scroll pixels
 * @return {number} effect progress, between 0 and 1
 */
function calcProgress (p, start, end, duration) {
  let progress = 0;

  if (p >= start && p <= end) {
    progress = duration ? (p - start) / duration : 1;
  }
  else if (p > end) {
    progress = 1;
  }

  return progress;
}

/**
 *
 * @param {Window|HTMLElement} root
 * @param {boolean} isHorizontal
 * @return {number}
 */
function getViewportSize (root, isHorizontal) {
  if (root === window) {
    return window.visualViewport
      ? isHorizontal
        ? window.visualViewport.width
        : window.visualViewport.height
      : isHorizontal
        ? window.document.documentElement.clientWidth
        : window.document.documentElement.clientHeight;
  }

  return isHorizontal ? root.clientWidth : root.clientHeight;
}

/*
 * Scroll controller factory
 */

/**
 * Initialize and return a scroll controller.
 *
 * @private
 * @param {scrollConfig} config
 * @return {{tick: function, destroy: function}}
 */
function getController (config) {
  const _config = defaultTo(config, DEFAULTS$1);
  const root = _config.root;
  const horizontal = _config.horizontal;
  const scenesByElement = new WeakMap();
  let viewportSize = getViewportSize(root, horizontal);

  let lastP;
  let viewportObserver, rangesResizeObserver, viewportResizeHandler, scrollportResizeObserver;
  const rangesToObserve = [];

  /*
   * Prepare scenes data.
   */
  _config.scenes = config.scenes.map((scene, index) => {
    scene.index = index;

    if (scene.viewSource && (typeof scene.duration === 'string' || scene.start?.name)) {
      scene = getTransformedScene(scene, root, viewportSize, horizontal);

      if (_config.observeSourcesResize) {
        rangesToObserve.push(scene);
      }
    }
    else if (scene.end == null) {
      scene.end = scene.start + scene.duration;
    }

    if (scene.duration == null) {
      scene.duration = scene.end - scene.start;
    }

    if (!('observeViewEntry' in scene)) {
      scene.observeViewEntry = true;
    }

    return scene;
  });

  if (rangesToObserve.length) {
    if (window.ResizeObserver) {
      const targetToScene = new Map();

      rangesResizeObserver = new window.ResizeObserver(function (entries) {
        entries.forEach(entry => {
          const scene = targetToScene.get(entry.target);
          // TODO: try to optimize by using `const {blockSize, inlineSize} = entry.borderBoxSize[0]`
          _config.scenes[scene.index] = getTransformedScene(scene, viewportSize, horizontal);

          // replace the old object from the cache with the new one
          rangesToObserve.splice(rangesToObserve.indexOf(scene), 1, _config.scenes[scene.index]);
        });
      });

      rangesToObserve.forEach(scene => {
        rangesResizeObserver.observe(scene.viewSource, {box: 'border-box'});
        targetToScene.set(scene.viewSource, scene);
      });
    }

    if (_config.observeViewportResize) {
      viewportResizeHandler = debounce(function () {
        viewportSize = getViewportSize(root, horizontal);

        const newRanges = rangesToObserve.map(scene => {
          const newScene = getTransformedScene(scene, root, viewportSize, horizontal);

          _config.scenes[scene.index] = newScene;

          return newScene;
        });

        // reset cache
        rangesToObserve.length = 0;
        rangesToObserve.push(...newRanges);
      }, VIEWPORT_RESIZE_INTERVAL);

      if (root === window) {
        (window.visualViewport || window).addEventListener('resize', viewportResizeHandler);
      }
      else if (window.ResizeObserver) {
        scrollportResizeObserver = new window.ResizeObserver(viewportResizeHandler);
        scrollportResizeObserver.observe(root, {box: 'border-box'});
      }
    }
  }

  /*
   * Observe entry and exit of scenes into view
   */
  if (_config.observeViewportEntry && window.IntersectionObserver) {
    viewportObserver = new window.IntersectionObserver(function (intersections) {
      intersections.forEach(intersection => {
        (scenesByElement.get(intersection.target) || []).forEach(scene => {
          scene.disabled = !intersection.isIntersecting;
        });
      });
    }, {
      root: root === window ? window.document : root,
      rootMargin: _config.viewportRootMargin,
      threshold: 0
    });

    _config.scenes.forEach(scene => {
      if (scene.viewSource && scene.observeViewEntry) {
        let scenesArray = scenesByElement.get(scene.viewSource);

        if (!scenesArray) {
          scenesArray = [];
          scenesByElement.set(scene.viewSource, scenesArray);

          viewportObserver.observe(scene.viewSource);
        }

        scenesArray.push(scene);
      }
    });
  }

  /**
   * Updates progress in all scene effects.
   *
   * @private
   * @param {Object} progress
   * @param {number} progress.p
   * @param {number} progress.vp
   */
  function tick ({p, vp}) {
    p = +p.toFixed(1);

    const velocity = +vp.toFixed(4);

    // if nothing changed bail out
    if (p === lastP) return;

    /*
     * Perform scene progression.
     */
    for (let scene of _config.scenes) {
      // if active
      if (!scene.disabled) {
        const {start, end, duration} = scene;
        // calculate scene's progress
        const progress = calcProgress(p, start, end, duration);

        // run effect
        scene.effect(scene, progress, velocity);
      }
    }

    // cache last position
    lastP = p;
  }

  /**
   * Removes all side effects and deletes all objects.
   */
  function destroy () {
    if (viewportObserver) {
      viewportObserver.disconnect();
      viewportObserver = null;
    }

    if (rangesResizeObserver) {
      rangesResizeObserver.disconnect();
      rangesResizeObserver = null;
    }

    if (viewportResizeHandler) {
      if (scrollportResizeObserver) {
        scrollportResizeObserver.disconnect();
        scrollportResizeObserver = null;
      }
      else {
        (window.visualViewport || window).removeEventListener('resize', viewportResizeHandler);
      }
    }
  }

  /**
   * Scroll controller.
   */
  return {
    tick,
    destroy
  };
}

/**
 * @private
 */
const DEFAULTS = {
  transitionActive: false,
  transitionFriction: 0.9,
  transitionEpsilon: 0.1,
  velocityActive: false,
  velocityMax: 1
};

/**
 * @class Scroll
 * @param {scrollConfig} config
 *
 * @example
 * import { Scroll } from 'fizban';
 *
 * const scroll = new Scroll({
 *     scenes: [...]
 * });
 * scroll.start();
 */
class Scroll {
  constructor (config = {}) {
    this.config = defaultTo(config, DEFAULTS);

    this.progress = {
      p: 0,
      prevP: 0,
      vp: 0
    };
    this.currentProgress = {
      p: 0,
      prevP: 0,
      vp: 0
    };

    this._lerpFrameId = 0;
    this.effect = null;
    // if no root or root is document.body then use window
    this.config.root = (!this.config.root || this.config.root === window.document.body) ? window : this.config.root;
    this.config.resetProgress = this.config.resetProgress || this.resetProgress.bind(this);

    this._measure = this.config.measure || (() => {
      const root = this.config.root;
      // get current scroll position from window or element
      this.progress.p = this.config.horizontal
        ? root.scrollX || root.scrollLeft || 0
        : root.scrollY || root.scrollTop || 0;
    });

    this._trigger = frameThrottle(() => {
      this._measure?.();
      this.tick(true);
    });
  }

  /**
   * Setup event and effect, and reset progress and frame.
   */
  start () {
    this.setupEffect();
    this.setupEvent();
    this.resetProgress();
    this.tick();
  }

  /**
   * Removes event listener.
   */
  pause () {
    this.removeEvent();
  }

  /**
   * Reset progress in the DOM and inner state to given x and y.
   *
   * @param {Object} [scrollPosition]
   * @param {number} [scrollPosition.x]
   * @param {number} [scrollPosition.y]
   */
  resetProgress (scrollPosition = {}) {
    // get current scroll position (support window, element)
    const root = this.config.root;
    const x = scrollPosition.x || scrollPosition.x === 0 ? scrollPosition.x : root.scrollX || root.scrollLeft || 0;
    const y = scrollPosition.y || scrollPosition.y === 0 ? scrollPosition.y : root.scrollY || root.scrollTop || 0;
    const p = this.config.horizontal ? x : y;
    this.progress.p = p;
    this.progress.prevP = p;
    this.progress.vp = 0;

    if ( this.config.transitionActive ) {
      this.currentProgress.p = p;
      this.currentProgress.prevP = p;
      this.currentProgress.vp = 0;
    }

    if (scrollPosition) {
      this.config.root.scrollTo(x, y);
    }
  }

  /**
   * Handle animation frame work.
   *
   * @param {boolean} [clearLerpFrame] whether to cancel an existing lerp frame
   */
  tick (clearLerpFrame) {
    const hasLerp = this.config.transitionActive;

    // if transition is active interpolate to next point
    if (hasLerp) {
      this.lerp();
    }

    // choose the object we iterate on
    const progress = hasLerp ? this.currentProgress : this.progress;

    if (this.config.velocityActive) {
      const dp = progress.p - progress.prevP;
      const factorP = dp < 0 ? -1 : 1;
      progress.vp = Math.min(this.config.velocityMax, Math.abs(dp)) / this.config.velocityMax * factorP;
    }

    // update effect
    this.effect.tick(progress);

    if (hasLerp && (progress.p !== this.progress.p)) {
      if (clearLerpFrame && this._lerpFrameId) {
        window.cancelAnimationFrame(this._lerpFrameId);
      }

      this._lerpFrameId = window.requestAnimationFrame(() => this.tick());
    }

    progress.prevP = progress.p;
  }

  /**
   * Calculate current progress.
   */
  lerp () {
    this.currentProgress.p = lerp(this.currentProgress.p, this.progress.p, 1 - this.config.transitionFriction, this.config.transitionEpsilon);

    if (this.config.transitionEpsilon) {
      const deltaP = this.progress.p - this.currentProgress.p;

      if (Math.abs(deltaP) < this.config.transitionEpsilon) {
        this.currentProgress.p = this.progress.p;
      }
    }
  }

  /**
   * Stop the event and effect, and remove all DOM side-effects.
   */
  destroy () {
    this.pause();
    this.removeEffect();
  }

  /**
   * Register to scroll for triggering update.
   */
  setupEvent () {
    this.config.root.addEventListener('scroll', this._trigger);
  }

  /**
   * Remove scroll handler.
   */
  removeEvent () {
    this.config.root.removeEventListener('scroll', this._trigger);
  }

  /**
   * Reset registered effect.
   */
  setupEffect () {
    this.removeEffect();
    this.effect = getController(this.config);
  }

  /**
   * Remove registered effect.
   */
  removeEffect () {
    this.effect && this.effect.destroy();
    this.effect = null;
  }
}

/**
 * @typedef {object} scrollConfig
 * @property {ScrollScene[]} scenes list of effect scenes to perform during scroll.
 * @property {boolean} [horizontal] whether to use the horizontal axis. Defaults to `false`.
 * @property {boolean} [transitionActive] whether to animate effect progress.
 * @property {number} [transitionFriction] between 0 to 1, amount of friction effect in the transition. 1 being no movement and 0 as no friction. Defaults to 0.4.
 * @property {boolean} [velocityActive] whether to calculate velocity with progress.
 * @property {number} [velocityMax] max possible value for velocity. Velocity value will be normalized according to this number, so it is kept between 0 and 1. Defaults to 1.
 * @property {boolean} [observeViewportEntry] whether to observe entry/exit of scenes into viewport for disabling/enabling them. Defaults to `true`.
 * @property {boolean} [viewportRootMargin] `rootMargin` option to be used for viewport observation. Defaults to `'7% 7%'`.
 * @property {boolean} [observeViewportResize] whether to observe resize of the visual viewport. Defaults to `false`.
 * @property {boolean} [observeSourcesResize] whether to observe resize of view-timeline source elements. Defaults to `false`.
 * @property {Element|Window} [root] the scrollable element, defaults to window.
 */

/**
 * @typedef {Object} ScrollScene
 * @desc A configuration object for a scene. Must be provided an effect function, and either a start and end, a start and duration, or a duration as RangeName.
 * @example { effects: (scene, p) => { animation.currentTime = p; }, duration: 'contain' }
 * @property {EffectCallback} effect the effect to perform.
 * @property {number|RangeOffset} start scroll position in pixels where effect starts.
 * @property {number|RangeName} [duration] duration of effect in pixels. Defaults to end - start.
 * @property {number|RangeOffset} [end] scroll position in pixels where effect ends. Defaults to start + duration.
 * @property {boolean} [disabled] whether to perform updates on the scene. Defaults to false.
 * @property {Element} [viewSource] an element to be used for observing intersection with viewport for disabling/enabling the scene, or the source of a ViewTimeline if scene start/end are provided as ranges.
 * @property {boolean} [observeViewEntry] whether to observe
 */

/**
 * @typedef {function(scene: ScrollScene, progress: number, velocity: number): void} EffectCallback
 * @param {ScrollScene} scene
 * @param {number} progress
 * @param {number} velocity
 */

/**
 * @typedef {'entry' | 'contain' | 'exit' | 'cover'} RangeName
 */

/**
 * @typedef {Object} RangeOffset
 * @property {RangeName} name
 * @property {number} offset
 */

exports.Scroll = Scroll;
