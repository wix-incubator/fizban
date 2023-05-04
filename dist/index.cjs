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
 * Check whether an element in scroll direction is a scroll container.
 *
 * @param {CSSStyleDeclaration} style
 * @param {boolean} isHorizontal
 * @return {boolean}
 */
function getIsScrollContainer (style, isHorizontal) {
  const overflow = style[`overflow-${isHorizontal ? 'x' : 'y'}`];
  return overflow !== 'visible' && overflow !== 'clip';
}

/**
 * Get offset of an element in scroll direction.
 *
 * @param {CSSStyleDeclaration} style
 * @param {boolean} isHorizontal
 * @return {number}
 */
function getStickyOffset (style, isHorizontal) {
  return parseInt(isHorizontal ? style.left : style.top);
}

/**
 *
 * @param {HTMLElement} element
 * @param {boolean} isHorizontal
 * @return {number}
 */
function getRectStart (element, isHorizontal) {
  // TODO: implement support for RTL writing-mode
  return (isHorizontal ? element.offsetLeft : element.offsetTop) || 0;
}

/**
 * Returns a converted scene data from ranges into offsets in pixels.
 *
 * @param {ScrollScene} scene
 * @param {number} viewportSize
 * @param {boolean} isHorizontal
 * @return {ScrollScene}
 */
function getTransformedScene (scene, viewportSize, isHorizontal) {
  const element = scene.viewSource;
  let parent = element.offsetParent;
  let elementLayoutStart = getRectStart(element, isHorizontal);
  const size = (isHorizontal ? element.offsetWidth : element.offsetHeight) || 0;
  const offsetTree = [{element, offset: elementLayoutStart, size}];
  let hasScrollParent = false;

  while (parent) {
    // get the base offset of the source element - before adding sticky intervals
    const offset = getRectStart(parent, isHorizontal);
    elementLayoutStart += offset;
    offsetTree.push({element: parent, offset});
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

    const nodeStyle = window.getComputedStyle(node.element);

    if (!hasScrollParent) {
      const isSticky = getIsSticky(nodeStyle);

      if (isSticky) {
        // TODO: specified offset could be in % or vh, so need to recalc on parent/window resize
        // stuckStart is the amount needed to scroll to reach the stuck state
        const stuckStart = accumulatedOffset - getStickyOffset(nodeStyle, isHorizontal);

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
    }

    hasScrollParent = hasScrollParent && getIsScrollContainer(nodeStyle, isHorizontal);
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
  observeSize: true,
  observeViewportEntry: true,
  viewportRootMargin: '7% 7%',
  observeViewportResize: false,
  observeSourcesResize: false,
  scrollHandler (container, wrapper, p, isHorizontal) {
    container.style.transform = isHorizontal ? `translateX(${-p}px)` : `translateY(${-p}px)`;
  },
  scrollClear (container /*, wrapper, x, y */) {
    container.style.transform = '';
  }
};

/*
 * Utilities for scroll controller
 */


/**
 * Utility for calculating the virtual scroll position, taking snap points into account.
 *
 * @private
 * @param {number} p real scroll position
 * @param {[number[]]} snaps list of snap point
 * @return {number} virtual scroll position
 */
function calcPosition (p, snaps) {
  let _p = p;
  let extra = 0;
  for (const [start, end] of snaps) {
    if (p < start) break;
    if (p >= end) {
      extra += end - start;
    }
    else {
      _p = start;
      break;
    }
  }
  return _p - extra;
}

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
 * @param {boolean} isHorizontal
 * @return {number}
 */
function getViewportSize (isHorizontal) {
  return window.visualViewport
    ? isHorizontal
      ? window.visualViewport.width
      : window.visualViewport.height
    : isHorizontal
      ? window.document.documentElement.clientWidth
      : window.document.documentElement.clientHeight
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
  const body = _config.root === window ? window.document.body : _config.root;
  const container = _config.container;
  const wrapper = _config.wrapper;
  const horizontal = _config.horizontal;
  const scenesByElement = new WeakMap();
  let viewportSize = getViewportSize(horizontal);

  /*
   * Prepare snap points data.
   */
  const snaps = (_config.snaps || [])
    // sort points by start position
    .sort((a, b) => a.start > b.start ? 1 : -1)
    // map objects to arrays of [start, end]
    .map(snap => {
      const {start, duration, end} = snap;
      return [start, (end == null ? start + duration : end)];
    });

  // calculate extra scroll if we have snaps
  const extraScroll = snaps.reduce((acc, snap) => acc + (snap[1] - snap[0]), 0);

  let lastP;
  let containerResizeObserver, viewportObserver, rangesResizeObserver;
  const rangesToObserve = [];

  /*
   * Prepare scenes data.
   */
  _config.scenes = config.scenes.map((scene, index) => {
    scene.index = index;

    if (scene.viewSource && (typeof scene.duration === 'string' || scene.start?.name)) {
      scene = getTransformedScene(scene, viewportSize, horizontal);

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

    let viewportResizeHandler;

    if (_config.observeViewportResize) {
      viewportResizeHandler = debounce(function () {
        viewportSize = getViewportSize(horizontal);

        const newRanges = rangesToObserve.map(scene => {
          const newScene = getTransformedScene(scene, viewportSize, horizontal);

          _config.scenes[scene.index] = newScene;

          return newScene;
        });

        // reset cache
        rangesToObserve.length = 0;
        rangesToObserve.push(...newRanges);
      }, VIEWPORT_RESIZE_INTERVAL);

      (window.visualViewport || window).addEventListener('resize', viewportResizeHandler);
    }
  }

  /*
   * Setup Smooth Scroll technique
   */
  if (container) {
    function setSize () {
      // calculate total scroll height/width
      // set width/height on the body element
      if (horizontal) {
        const totalWidth = container.offsetWidth + container.offsetLeft + (horizontal ? extraScroll : 0);
        body.style.width = `${totalWidth}px`;
      }
      else {
        const totalHeight = container.offsetHeight + container.offsetTop + (horizontal ? 0 : extraScroll);
        body.style.height = `${totalHeight}px`;
      }
    }

    setSize();

    if (_config.observeSize && window.ResizeObserver) {
      containerResizeObserver = new window.ResizeObserver(setSize);
      containerResizeObserver.observe(container, {box: 'border-box'});
    }

    /*
     * Setup wrapper element
     */
    if (wrapper) {
      if (!wrapper.contains(container)) {
        console.error(
          'When defined, the wrapper element %o must be a parent of the container element %o',
          wrapper,
          container
        );
        throw new Error('Wrapper element is not a parent of container element');
      }

      // if we got a wrapper element set its style
      Object.assign(wrapper.style, {
        position: 'fixed',
        width: '100%',
        height: '100%',
        overflow: 'hidden'
      });

      // get current scroll position (support window or element)
      let x = root.scrollX || root.scrollLeft || 0;
      let y = root.scrollY || root.scrollTop || 0;
      let p = horizontal ? x : y;

      // increment current scroll position by accumulated snap point durations
      if (horizontal) {
        p = snaps.reduce((acc, [start, end]) => start < acc ? acc + (end - start) : acc, p);
      }
      else {
        p = snaps.reduce((acc, [start, end]) => start < acc ? acc + (end - start) : acc, p);
      }

      // update scroll and progress to new calculated position
      _config.resetProgress({x, y});

      // render current position
      tick({p, vp: 0});
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
      root: wrapper || null,
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

    let _p = p;

    if (snaps.length) {
      _p = calcPosition(p, snaps);
    }

    if (container) {
      // handle content scrolling
      _config.scrollHandler(container, wrapper, _p, horizontal);
    }

    /*
     * Perform scene progression.
     */
    for (let scene of _config.scenes) {
      // if active
      if (!scene.disabled) {
        const {start, end, duration} = scene;
        // get global scroll progress
        const t = scene.pauseDuringSnap ? _p : p;

        // calculate scene's progress
        const progress = calcProgress(t, start, end, duration);

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
    if (container) {
      if (horizontal) {
        body.style.width = '';
      }
      else {
        body.style.height = '';
      }

      if (wrapper) {
        Object.assign(wrapper.style, {
          position: '',
          width: '',
          height: '',
          overflow: ''
        });
      }

      _config.scrollClear(container);

      if (containerResizeObserver) {
        containerResizeObserver.disconnect();
        containerResizeObserver = null;
      }
    }

    if (viewportObserver) {
      viewportObserver.disconnect();
      viewportObserver = null;
    }

    if (rangesResizeObserver) {
      rangesResizeObserver.disconnect();
      rangesResizeObserver = null;
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
    this.config.root = this.config.root || window;
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
 * @property {boolean} [observeSize] whether to observe size changes of `container`. Defaults to `true`.
 * @property {boolean} [observeViewportEntry] whether to observe entry/exit of scenes into viewport for disabling/enabling them. Defaults to `true`.
 * @property {boolean} [viewportRootMargin] `rootMargin` option to be used for viewport observation. Defaults to `'7% 7%'`.
 * @property {boolean} [observeViewportResize] whether to observe resize of the visual viewport. Defaults to `false`.
 * @property {boolean} [observeSourcesResize] whether to observe resize of view-timeline source elements. Defaults to `false`.
 * @property {Element|Window} [root] the scrollable element, defaults to window.
 * @property {Element} [wrapper] element to use as the fixed, viewport sized layer, that clips and holds the scroll content container. If not provided, no setup is done.
 * @property {Element|null} [container] element to use as the container for the scrolled content. If not provided assuming native scroll is desired.
 * @property {SnapPoint[]} [snaps] list of scroll snap points.
 * @property {function(container: HTMLElement, wrapper: HTMLElement|undefined, x: number, y: number)} [scrollHandler] if using a container, this allows overriding the function used for scrolling the content. Defaults to setting `style.transform`.
 * @property {function(container: HTMLElement, wrapper: HTMLElement|undefined, x: number, y: number)} [scrollClear] if using a container, this allows overriding the function used for clearing content scrolling side-effects when effect is removed. Defaults to clearing `container.style.transform`.
 */

/**
 * @typedef {Object} ScrollScene
 * @desc A configuration object for a scene. Must be provided an effect function, and either a start and end, a start and duration, or a duration as RangeName.
 * @example { effects: (scene, p) => { animation.currentTime = p; }, duration: 'contain' }
 * @property {EffectCallback} effect the effect to perform.
 * @property {number|RangeOffset} start scroll position in pixels where effect starts.
 * @property {number|RangeName} [duration] duration of effect in pixels. Defaults to end - start.
 * @property {number|RangeOffset} [end] scroll position in pixels where effect ends. Defaults to start + duration.
 * @property {boolean} [pauseDuringSnap] whether to pause the effect during snap points, effectively ignoring scroll during duration of scroll snapping.
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
 * @typedef {Object} SnapPoint
 * @property {number} start scroll position in pixels where virtual scroll starts snapping.
 * @property {number} [duration] duration in pixels for virtual scroll snapping. Defaults to end - start.
 * @property {number} [end] scroll position in pixels where virtual scroll starts snapping. Defaults to start + duration.
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
