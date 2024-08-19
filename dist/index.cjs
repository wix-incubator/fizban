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

/**
 * parses offsetString of the format calc(<length> + <length>)
 * @param {string|undefined} offsetString
 * @param {AbsoluteOffsetContext} absoluteOffsetContext
 */
function parseOffsetCalc(offsetString, absoluteOffsetContext) {
  const match = offsetString.match(/^calc\s*\(\s*(-?\d+((px)|(vh)|(vw)))\s*\+\s*(-?\d+((px)|(vh)|(vw)))\s*\)\s*$/);
  console.log(transformAbsoluteOffsetToNumber(match[1], absoluteOffsetContext));
  console.log(transformAbsoluteOffsetToNumber(match[6], absoluteOffsetContext));
  return transformAbsoluteOffsetToNumber(match[1], absoluteOffsetContext) + transformAbsoluteOffsetToNumber(match[6], absoluteOffsetContext);
}

/**
 * Convert an absolute offset as string to number of pixels
 *
 * @param {string|undefined} offsetString
 * @param {AbsoluteOffsetContext} absoluteOffsetContext
 * @return {number}
 */
function transformAbsoluteOffsetToNumber (offsetString, absoluteOffsetContext) {
  return offsetString
    ? /^-?\d+px$/.test(offsetString)
      ? parseInt(offsetString)
      : /^-?\d+vh$/.test(offsetString)
        ? parseInt(offsetString) * absoluteOffsetContext.viewportHeight / 100
        : /^-?\d+vw$/.test(offsetString)
          ? parseInt(offsetString) * absoluteOffsetContext.viewportWidth / 100
          : /^calc\s*\(\s*-?\d+((px)|(vh)|(vw))\s*\+\s*-?\d+((px)|(vh)|(vw))\s*\)\s*$/.test(offsetString)
            ? parseOffsetCalc(offsetString, absoluteOffsetContext)
            : parseInt(offsetString) || 0
    : 0;
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
  else if (name === 'entry-crossing') {
    startPosition = start - viewportSize;
    duration = height;
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

function computeStickinessIntoFullRange(offsetTree, absoluteStartOffset, absoluteEndOffset, viewportSize, isHorizontal) {
  let accumulatedOffset = 0;
  const newAbsoluteRange = {start: absoluteStartOffset, end: absoluteEndOffset};

  /*
   * loop from root down to subject
   * check for sticky positioned elements in the tree and add stuck intervals if needed
   */
  offsetTree.forEach((node, index) => {
    accumulatedOffset += node.offset;
    const sticky = node.sticky;

    if (sticky) {
      if ('end' in sticky) {
        const parent = offsetTree[index - 1]?.element;

        if (parent) {
          const elementSize = (isHorizontal ? node.element.offsetWidth : node.element.offsetHeight) || 0;
          const offsetFromViewEnd = elementSize + sticky.end - viewportSize;
          /*
           * Sticky bottom:
           * starts on the starting edge of element's parent - viewport size + element size + offset from bottom of view
           * ends on the element's offset + offset from bottom of view
           * duration is essentially element's offset
           */
          const stuckStart = accumulatedOffset + offsetFromViewEnd - node.offset;
          // check if stuckStart is before the point of scroll where the timeline starts
          const isBeforeStart = stuckStart < newAbsoluteRange.start;
          // check if stuckStart is inside the timeline's active scroll interval
          const isInsideDuration = !isBeforeStart && stuckStart <= absoluteEndOffset;

          let extraOffset = 0;
          if (isBeforeStart || isInsideDuration) {
            extraOffset = node.offset;
            newAbsoluteRange.end += extraOffset;
          }

          if (isBeforeStart) {
            newAbsoluteRange.start += extraOffset;
          }
        }
      }

      if ('start' in sticky) {
        // stuckStart is the amount needed to scroll to reach the stuck state
        const stuckStart = accumulatedOffset - sticky.start;

        // check if stuckStart is before the point of scroll where the timeline starts
        const isBeforeStart = stuckStart < newAbsoluteRange.start;
        // check if stuckStart is inside the timeline's active scroll interval
        const isInsideDuration = !isBeforeStart && stuckStart <= newAbsoluteRange.end;

        let extraOffset = 0;
        const parent = offsetTree[index - 1]?.element;

        if (parent) {
          if (isBeforeStart || isInsideDuration) {
            const parentSize = (isHorizontal ? parent.offsetWidth : parent.offsetHeight) || 0;
            const elementOffset = node.offset;
            const elementSize = (isHorizontal ? node.element.offsetWidth : node.element.offsetHeight) || 0;

            extraOffset = parentSize - (elementOffset + elementSize);
            accumulatedOffset += extraOffset;
            newAbsoluteRange.end += extraOffset;
          }

          if (isBeforeStart) {
            newAbsoluteRange.start += extraOffset;
          }
        }
      }
    }
  });

  return newAbsoluteRange;
}

/**
 * Convert scene data in ranges into offsets in pixels.
 *
 * @param {ScrollScene} scene
 * @param {{start: number, end: number}} rect
 * @param {number} viewportSize
 * @param {boolean} isHorizontal
 * @param {AbsoluteOffsetContext} absoluteOffsetContext
 * @param {Array<{element: HTMLElement, offset: number, sticky: {start?: number, end?: number}}>} offsetTree
 * @return {ScrollScene}
 */
function transformSceneRangesToOffsets (scene, rect, viewportSize, isHorizontal, absoluteOffsetContext, offsetTree) {
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

    const newAbsoluteRange = computeStickinessIntoFullRange(offsetTree, startOffset, endOffset, viewportSize, isHorizontal);

    startOffset = newAbsoluteRange.start;
    endOffset = newAbsoluteRange.end;
  }
  else {
    if (startRange || start?.name) {
      startRange = startRange || start;

      const startAdd = transformAbsoluteOffsetToNumber(startRange.add, absoluteOffsetContext);
      const absoluteStartOffset = transformRangeToPosition({...startRange, offset: 0}, viewportSize, rect);
      const absoluteEndOffset = transformRangeToPosition({...startRange, offset: 100}, viewportSize, rect);
      // we take 0% to 100% of the named range for start, and we compute the position by adding the sticky addition for the given start offset
      const newAbsoluteRange = computeStickinessIntoFullRange(offsetTree, absoluteStartOffset, absoluteEndOffset, viewportSize, isHorizontal);

      startOffset = newAbsoluteRange.start + (startRange.offset / 100) * (newAbsoluteRange.end - newAbsoluteRange.start) + startAdd;
    }

    if (endRange || end?.name) {
      endRange = endRange || end;

      const endAdd = transformAbsoluteOffsetToNumber(endRange.add, absoluteOffsetContext);
      const absoluteStartOffset = transformRangeToPosition({...endRange, offset: 0}, viewportSize, rect);
      const absoluteEndOffset = transformRangeToPosition({...endRange, offset: 100}, viewportSize, rect);
      // we take 0% to 100% of the named range for end, and we compute the position by adding the sticky addition for the given end offset
      const newAbsoluteRange = computeStickinessIntoFullRange(offsetTree, absoluteStartOffset, absoluteEndOffset, viewportSize, isHorizontal);

      endOffset = newAbsoluteRange.start + (endRange.offset / 100) * (newAbsoluteRange.end - newAbsoluteRange.start) + endAdd;
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
 * Get start offset of an element in scroll direction.
 *
 * @param {CSSStyleDeclaration} style
 * @param {boolean} isHorizontal
 * @return {number}
 */
function getStickyStartOffset (style, isHorizontal) {
  return parseInt(isHorizontal ? style.left : style.top);
}

/**
 * Get end offset of an element in scroll direction.
 *
 * @param {CSSStyleDeclaration} style
 * @param {boolean} isHorizontal
 * @return {number}
 */
function getStickyEndOffset (style, isHorizontal) {
  return parseInt(isHorizontal ? style.right : style.bottom);
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

function getStickyData (style, isHorizontal) {
  let sticky;
  const stickyStart = getStickyStartOffset(style, isHorizontal);
  const stickyEnd = getStickyEndOffset(style, isHorizontal);
  const hasStickyStart = !isNaN(stickyStart);
  const hasStickyEnd = !isNaN(stickyEnd);

  if (hasStickyStart || hasStickyEnd) {
    sticky = {};

    if (hasStickyStart) {
      sticky.start = stickyStart;
    }
    if (hasStickyEnd) {
      sticky.end = stickyEnd;
    }
  }

  return sticky;
}

/**
 * Returns a converted scene data from ranges into offsets in pixels.
 *
 * @param {ScrollScene} scene
 * @param {Window|HTMLElement} root
 * @param {number} viewportSize
 * @param {boolean} isHorizontal
 * @param {AbsoluteOffsetContext} absoluteOffsetContext
 * @return {ScrollScene}
 */
function getTransformedScene (scene, root, viewportSize, isHorizontal, absoluteOffsetContext) {
  const element = scene.viewSource;
  const elementStyle = window.getComputedStyle(element);
  const isElementSticky = getIsSticky(elementStyle);
  const elementStickiness = isElementSticky ? getStickyData(elementStyle, isHorizontal) : undefined;

  let parent = element.offsetParent;
  let elementLayoutStart = 0;
  let isFixed = elementStyle.position === 'fixed';
  const elementOffset = getRectStart(element, isHorizontal, isElementSticky);

  // if we have sticky end (bottom or right) ignore offset for this element because it will stick to its parent's start edge
  if (!elementStickiness || !('end' in elementStickiness)) {
    elementLayoutStart += elementOffset;
  }

  const size = (isHorizontal ? element.offsetWidth : element.offsetHeight) || 0;
  const offsetTree = [{
    element,
    offset: elementOffset,
    size,
    sticky: elementStickiness,
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
    const sticky = isSticky ? getStickyData(nodeStyle, isHorizontal) : undefined;

    // get the base offset of the source element - before adding sticky intervals
    const offset = getRectStart(parent, isHorizontal, isSticky);

    // if we have sticky end (bottom or right) ignore offset for this element because it will stick to its parent's start edge
    if (!sticky || !('end' in sticky)) {
      elementLayoutStart += offset;
    }

    offsetTree.push({element: parent, offset, sticky});
    parent = parent.offsetParent;

    if (!parent) {
      // only if offsetParent is null do we know that the fixed element is actually fixed to the viewport and we need to set duration to 0
      isFixed = nodeStyle.position === 'fixed';
    }
  }

  offsetTree.reverse();

  const transformedScene = transformSceneRangesToOffsets(
    scene,
    {start: elementLayoutStart, end: elementLayoutStart + size},
    viewportSize,
    isHorizontal,
    absoluteOffsetContext,
    offsetTree
  );

  transformedScene.isFixed = isFixed;

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
    return isHorizontal
        ? window.document.documentElement.clientWidth
        : window.document.documentElement.clientHeight;
  }

  return isHorizontal ? root.clientWidth : root.clientHeight;
}

function getAbsoluteOffsetContext () {
  // TODO: re-calc on viewport resize
  return {
    viewportWidth: window.document.documentElement.clientWidth,
    viewportHeight: window.document.documentElement.clientHeight
  };
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
  const absoluteOffsetContext = getAbsoluteOffsetContext();

  /*
   * Prepare scenes data.
   */
  _config.scenes = config.scenes.map((scene, index) => {
    scene.index = index;

    if (scene.viewSource && (typeof scene.duration === 'string' || scene.start?.name)) {
      scene = getTransformedScene(scene, root, viewportSize, horizontal, absoluteOffsetContext);

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

    return scene;
  });

  if (rangesToObserve.length) {
    if (window.ResizeObserver) {
      const targetToScene = new Map();

      rangesResizeObserver = new window.ResizeObserver(function (entries) {
        entries.forEach(entry => {
          const scene = targetToScene.get(entry.target);
          // TODO: try to optimize by using `const {blockSize, inlineSize} = entry.borderBoxSize[0]`
          _config.scenes[scene.index] = getTransformedScene(scene, root, viewportSize, horizontal, absoluteOffsetContext);

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
          const newScene = getTransformedScene(scene, root, viewportSize, horizontal, absoluteOffsetContext);

          _config.scenes[scene.index] = newScene;

          return newScene;
        });

        // reset cache
        rangesToObserve.length = 0;
        rangesToObserve.push(...newRanges);
      }, VIEWPORT_RESIZE_INTERVAL);

      if (root === window) {
        window.addEventListener('resize', viewportResizeHandler);
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
      if (scene.viewSource) {
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

        // if fixed position then disable after one tick
        if (scene.isFixed) {
          scene.disabled = true;
        }
      }
    }

    // cache last position
    lastP = p;
  }

  /**
   * Removes all side effects and deletes all objects.
   */
  function destroy () {
    _config.scenes.forEach(scene => scene.destroy?.());

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
        window.removeEventListener('resize', viewportResizeHandler);
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
  transitionEpsilon: 1,
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
    this.currentProgress.p = lerp(this.currentProgress.p, this.progress.p, +(1 - this.config.transitionFriction).toFixed(3), this.config.transitionEpsilon);
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
    this.removeEvent();
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
 * @property {boolean} [observeViewportResize] whether to observe resize of the layout viewport. Defaults to `false`.
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
 * @property {function} [destroy] a function clean up the scene when it's controller is destroyed.
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
 * @property {CSSUnitValue} [add]
 */

/**
 * @typedef {Object} CSSUnitValue
 * @property {number} value
 * @property {'px'|'vh'|'vw'} unit
 */

/**
 * @typedef {Object} AbsoluteOffsetContext
 * @property {number} viewportWidth
 * @property {number} viewportHeight
 */

exports.Scroll = Scroll;
