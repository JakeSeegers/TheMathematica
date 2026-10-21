/**
 * Test helpers for the level editor action scripts (sandbox/editor_shell.*.json).
 * Load from an eval step:  import('/sandbox/editor_shell.helpers.js').then((m) => m.install())
 * Then use window.T: pointer strokes on the 2D map in world coordinates, key presses, clicking
 * buttons by text and setting form inputs.
 */

/** @import { EditorHooks } from '../src/editor/EditorApp.js' */

/**
 * Pointer options of the stroke helpers.
 * @typedef {object} StrokeOpts
 * @property {number} [button]  of pointerdown / pointerup (0); its `buttons` bit is held on
 *   pointerdown and on `down` moves (left 1, middle 4, right 2)
 * @property {boolean} [down]  holds the button on moves (a move without it carries `buttons: 0`,
 *   which the 2D map reads as a lost release and ends an open stroke, cancelled — ED-27)
 * @property {number} [buttons]  overrides the event's `buttons` bitmask
 * @property {boolean} [shift]
 * @property {boolean} [ctrl]
 * @property {boolean} [alt]
 */
/** @typedef {{ code?: string, shift?: boolean, ctrl?: boolean, alt?: boolean }} KeyOpts key options */
/** @typedef {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} FieldControl */

/**
 * `window.T`, set by `install()` (AUTOMATION_API.md §7). World points are 2D-map (x, z).
 * @typedef {object} ShellHelpers
 * @property {EditorHooks} E  `window.__editor`
 * @property {(type: string, x: number, z: number, o?: StrokeOpts) => void} fire  one pointer
 *   event (`pointerdown` / `pointermove` / `pointerup`) on the 2D map canvas
 * @property {(points: number[][], o?: StrokeOpts) => Promise<number>} drag  a stroke through
 *   [[x, z], …]; resolves to the level's object count
 * @property {(x: number, z: number, o?: StrokeOpts) => Promise<number>} click  a one-point stroke
 * @property {(x: number, z: number, o?: StrokeOpts) => Promise<void>} hover
 * @property {(k: string, o?: KeyOpts) => boolean} key  keydown on the focused element; returns
 *   whether it was default-prevented
 * @property {(selector: string, text: string) => string} clickText  `'clicked'` or `'not found: …'`
 * @property {(el: string|FieldControl|null, value: string) => string} setInput  set a form
 *   control (element or selector) and fire input + change; `'set'` or `'no element'`
 * @property {(label: string, root?: string) => FieldControl|null} field  the inspector control
 *   whose label starts with `label`
 * @property {() => Promise<void>} frame  one animation frame
 * @property {(ms: number) => Promise<void>} sleep
 * @property {(x: number, z: number) => { clientX: number, clientY: number }} screen
 * @property {() => object} summary  name, size, objects, types, tool, selection, dirty, canUndo, ref
 */

/** Install `window.T` (`ShellHelpers`). @returns {string} */
export function install() {
  const E = window.__editor;
  const canvas = () => document.querySelector('.le-map2d-canvas');
  /** @type {ShellHelpers['frame']} */
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  /** @type {ShellHelpers['sleep']} */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** @param {number} x @param {number} z */
  function screen(x, z) {
    const r = canvas().getBoundingClientRect();
    const p = E.view2d.worldToScreen(x, z);
    return { clientX: r.left + p.x, clientY: r.top + p.y };
  }

  /** @param {string} type @param {number} x @param {number} z @param {StrokeOpts} [o] */
  function fire(type, x, z, o = {}) {
    const s = screen(x, z);
    const bit = [1, 4, 2][o.button ?? 0] ?? 1;
    canvas().dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 7, pointerType: 'mouse', isPrimary: true,
      button: type === 'pointermove' ? -1 : (o.button ?? 0),
      buttons: o.buttons ?? (type === 'pointerup' || (type === 'pointermove' && !o.down) ? 0 : bit),
      shiftKey: !!o.shift, ctrlKey: !!o.ctrl, altKey: !!o.alt, ...s,
    }));
  }

  /**
   * A stroke through world points [[x, z], …].
   * @param {number[][]} points @param {StrokeOpts} [o]
   */
  async function drag(points, o = {}) {
    fire('pointermove', points[0][0], points[0][1], o);
    fire('pointerdown', points[0][0], points[0][1], o);
    for (const p of points.slice(1)) {
      fire('pointermove', p[0], p[1], { ...o, down: true });
      await frame();
    }
    const last = points[points.length - 1];
    fire('pointerup', last[0], last[1], o);
    await frame();
    return E.state.level.objects.length;
  }

  /** @type {ShellHelpers['click']} */
  const click = (x, z, o) => drag([[x, z]], o);

  /**
   * Hover the pointer (no button) at world (x, z).
   * @param {number} x @param {number} z @param {StrokeOpts} [o]
   */
  async function hover(x, z, o = {}) {
    fire('pointermove', x, z, o);
    await frame();
  }

  /** @param {string} k @param {{ code?: string, shift?: boolean, ctrl?: boolean, alt?: boolean }} [o] */
  function key(k, o = {}) {
    const target = document.activeElement && document.activeElement !== document.body ? document.activeElement : document.body;
    const ev = new KeyboardEvent('keydown', { key: k, code: o.code ?? '', bubbles: true, cancelable: true, shiftKey: !!o.shift, ctrlKey: !!o.ctrl, altKey: !!o.alt });
    target.dispatchEvent(ev);
    return ev.defaultPrevented;
  }

  /** @param {string} selector @param {string} text */
  function clickText(selector, text) {
    const els = /** @type {HTMLElement[]} */ ([...document.querySelectorAll(selector)]);
    const el = els.find((x) => x.textContent.trim() === text) ?? els.find((x) => x.textContent.trim().startsWith(text)) ?? els.find((x) => x.textContent.includes(text));
    if (!el) return `not found: ${selector} "${text}"`;
    el.click();
    return 'clicked';
  }

  /** @param {string|FieldControl|null} el @param {string} value */
  function setInput(el, value) {
    if (typeof el === 'string') el = /** @type {FieldControl|null} */ (document.querySelector(el));
    if (!el) return 'no element';
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
    return 'set';
  }

  /**
   * The inspector field control (input/select/textarea) whose label starts with `label`.
   * @param {string} label @param {string} [root] @returns {FieldControl|null}
   */
  function field(label, root = '.le-inspector') {
    const f = [...document.querySelectorAll(`${root} .le-field`)].find((x) => x.querySelector('.le-field-label')?.textContent.trim().startsWith(label));
    return /** @type {FieldControl|null} */ (f?.querySelector('.le-field-control input:not([type=range]), .le-field-control select, .le-field-control textarea')) ?? null;
  }

  const summary = () => {
    const L = E.state.level;
    return {
      name: L.name, size: `${L.width}x${L.depth}`, objects: L.objects.length, types: L.objects.map((o) => o.type).join(','),
      tool: E.state.toolId, selection: E.state.selection.join(','), dirty: E.state.dirty, canUndo: E.state.canUndo, ref: E.state.fileRef,
    };
  };

  window.T = { E, fire, drag, click, hover, key, clickText, setInput, field, frame, sleep, screen, summary };
  return 'installed';
}
