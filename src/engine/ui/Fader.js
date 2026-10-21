import './ui.css';
import './hud.css';

/**
 * Full-screen colour fades for scene transitions. Promises resolve on a timer matching the
 * duration, so they settle even if `transitionend` never fires (hidden tab, display:none, …).
 * A new fade interrupts the previous one (its promise resolves immediately) and continues from
 * the current opacity.
 */
export class Fader {
  /** @param {HTMLElement} parent */
  constructor(parent = document.body) {
    const el = document.createElement('div');
    el.className = 'lu-fader';
    parent.appendChild(el);
    this.element = el;
    this._opacity = 0;
    this._timer = 0;
    /** @type {(() => void)|null} resolver of the running fade's promise */
    this._resolve = null;
  }

  /** Target opacity of the current / last fade (0 = clear, 1 = covered). */
  get opacity() { return this._opacity; }
  /** True while fading. */
  get busy() { return !!this._resolve; }

  /**
   * Fade to a solid colour.
   * @param {number} [seconds]
   * @param {string} [color] any CSS colour
   * @returns {Promise<void>}
   */
  fadeOut(seconds = 0.6, color = '#000') {
    this.element.style.backgroundColor = color;
    return this._fadeTo(1, seconds);
  }

  /**
   * Fade back to the scene.
   * @param {number} [seconds]
   * @returns {Promise<void>}
   */
  fadeIn(seconds = 0.6) {
    return this._fadeTo(0, seconds);
  }

  /**
   * Jump to an opacity instantly.
   * @param {number} opacity 0..1
   * @param {string} [color]
   */
  set(opacity, color) {
    if (color) this.element.style.backgroundColor = color;
    this._settle();
    clearTimeout(this._timer);
    this._opacity = opacity;
    const el = this.element;
    el.style.transitionDuration = '0s';
    el.style.opacity = String(opacity);
    void el.offsetWidth;
  }

  dispose() {
    clearTimeout(this._timer);
    this._settle();
    this.element.remove();
  }

  /** @param {number} target @param {number} seconds @returns {Promise<void>} */
  _fadeTo(target, seconds) {
    this._settle();
    clearTimeout(this._timer);
    const el = this.element;
    const s = Math.max(0, Number(seconds) || 0);
    // lock in the current (possibly mid-transition) opacity before starting the new transition
    const current = getComputedStyle(el).opacity;
    el.style.transitionDuration = '0s';
    el.style.opacity = current;
    void el.offsetWidth;
    el.style.transitionDuration = `${s}s`;
    el.style.opacity = String(target);
    this._opacity = target;
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._timer = setTimeout(() => this._settle(), s * 1000 + 20);
    });
  }

  _settle() {
    const r = this._resolve;
    this._resolve = null;
    if (r) r();
  }
}
