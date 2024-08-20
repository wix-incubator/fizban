import { debounce, defaultTo } from './utilities.js';
import { getTransformedSceneGroup } from './view.js';

const VIEWPORT_RESIZE_INTERVAL = 100;

/**
 * @private
 * @type {scrollConfig}
 */
const DEFAULTS = {
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
export function getController (config) {
  const _config = defaultTo(config, DEFAULTS);
  const root = _config.root;
  const horizontal = _config.horizontal;
  const scenesByElement = new WeakMap();
  let viewportSize = getViewportSize(root, horizontal);

  let lastP;
  let viewportObserver, rangesResizeObserver, viewportResizeHandler, scrollportResizeObserver;
  const rangesToObserve = [];
  const absoluteOffsetContext = getAbsoluteOffsetContext()

  /*
   * Prepare scenes data.
   */
  _config.scenes = Object.values(
    // TODO(ameerf): find a polyfill and use groupBy instead of following reduce
    config.scenes.reduce((acc, scene, index) => {
      const key = scene.groupId ? `group-${scene.groupId}` : String(index);
      if (acc[key]) {
        acc[key].push(scene)
      } else {
        acc[key] = [scene];
      }
      return acc;
    },
    {})
  ).flatMap(sceneGroup => {
    if (sceneGroup.every(scene => (scene.viewSource && (typeof scene.duration === 'string' || scene.start?.name)))) {
      sceneGroup = getTransformedSceneGroup(sceneGroup, root, viewportSize, horizontal, absoluteOffsetContext);
      if (_config.observeSourcesResize) {
        rangesToObserve.push(sceneGroup);
      }
    } else {
      sceneGroup.forEach(scene => {
        if (scene.end == null) {
          scene.end = scene.start + scene.duration;
        }
        if (scene.duration == null) {
          scene.duration = scene.end - scene.start;
        }    
      });
    }

    return sceneGroup;
  });
  _config.scenes.forEach((scene, index) => {scene.index = index;});

  if (rangesToObserve.length) {
    if (window.ResizeObserver) {
      const targetToSceneGroup = new Map();

      rangesResizeObserver = new window.ResizeObserver(function (entries) {
        entries.forEach(entry => {
          const sceneGroup = targetToSceneGroup.get(entry.target);
          // TODO: try to optimize by using `const {blockSize, inlineSize} = entry.borderBoxSize[0]`
          const transformedSceneGroup = getTransformedSceneGroup(sceneGroup, root, viewportSize, horizontal, absoluteOffsetContext);
          transformedSceneGroup.forEach((scene, localIndex) => {_config.scenes[scene.index] = transformedSceneGroup[localIndex];});
          // replace the old object from the cache with the new one
          rangesToObserve.splice(rangesToObserve.indexOf(sceneGroup), 1, transformedSceneGroup);
        });
      });

      rangesToObserve.forEach(sceneGroup => {
        rangesResizeObserver.observe(sceneGroup[0].viewSource, {box: 'border-box'});
        targetToSceneGroup.set(sceneGroup[0].viewSource, sceneGroup);
      });
    }

    if (_config.observeViewportResize) {
      viewportResizeHandler = debounce(function () {
        viewportSize = getViewportSize(root, horizontal);

        const newRanges = rangesToObserve.map(sceneGroup => {
          const newSceneGroup = getTransformedSceneGroup(sceneGroup, root, viewportSize, horizontal, absoluteOffsetContext);
          newSceneGroup.forEach((scene, localIndex) => {_config.scenes[scene.index] = newSceneGroup[localIndex];});

          return newSceneGroup;
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
