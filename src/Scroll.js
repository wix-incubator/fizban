import { getController } from './controller.js';
import { defaultTo, frameThrottle, lerp } from './utilities.js';

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
    const isDocumentRoot = (!this.config.root || this.config.root === window.document.body);
    // if no root or root is document.body then use window
    this.config.root = isDocumentRoot ? window : this.config.root;
    this.config.contentRoot = this.config.contentRoot || (isDocumentRoot ? window.document.body : this.config.root.firstElementChild);
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
 * @property {boolean} [observeContentResize] whether to observe resize of content root of the scroll container. Defaults to `false`.
 * @property {Element|Window} [root] the scrollable element, defaults to window.
 * @property {Element} [contentRoot] the root element for the content, defaults to first child of root or body element.
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
 * @property {string} [groupId] a string id for a group of scenes sharing same viewSource and part of the same overall animation
 */

/**
 * @typedef {function(scene: ScrollScene, progress: number, velocity: number): void} EffectCallback
 * @param {ScrollScene} scene
 * @param {number} progress
 * @param {number} velocity
 */

/**
 * @typedef {'entry' | 'contain' | 'exit' | 'cover' | 'entry-crossing' | 'exit-crossing'} RangeName
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
