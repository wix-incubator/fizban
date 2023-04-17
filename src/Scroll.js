import { getController } from './controller.js';
import { defaultTo, frameThrottle, lerp } from './utilities.js';

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
export class Scroll {
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
   * Setup event and effect.
   */
  start () {
    this.setupEffect();
    this.setupEvent();
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
   * @param {Object} progress
   * @param {number} progress.x
   * @param {number} progress.y
   */
  resetProgress ({x, y}) {
    const p = this.config.horizontal ? x : y;
    this.progress.p = p;
    this.progress.prevP = p;
    this.progress.vp = 0;

    if ( this.config.transitionActive ) {
      this.currentProgress.p = p;
      this.currentProgress.prevP = p;
      this.currentProgress.vp = 0;
    }

    this.config.root.scrollTo(x, y);
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
 * @typedef {function} EffectCallback
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
