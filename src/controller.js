import { debounce, defaultTo } from './utilities.js';
import { getTransformedScene } from './view.js';

const VIEWPORT_RESIZE_INTERVAL = 100;

/**
 * @private
 * @type {scrollConfig}
 */
const DEFAULTS = {
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
export function getController (config) {
  const _config = defaultTo(config, DEFAULTS);
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
  let containerResizeObserver, viewportObserver, rangesResizeObserver, viewportResizeHandler;
  const rangesToObserve = [];

  /*
   * Prepare scenes data.
   */
  _config.scenes = config.scenes.map((scene, index) => {
    scene.index = index;

    if (scene.viewSource && scene.start?.name) {
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
        })
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
     * Setup wrapper element and reset progress.
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

      // get current scroll position (support window, element and window in IE)
      let x = root.scrollX || root.pageXOffset || root.scrollLeft || 0;
      let y = root.scrollY || root.pageYOffset || root.scrollTop || 0;
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

    if (viewportResizeHandler) {
      (window.visualViewport || window).removeEventListener('resize', viewportResizeHandler);
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
