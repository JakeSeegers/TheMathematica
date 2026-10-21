/**
 * Application menu bar (File / Edit / View / Level / Help). Menus are built from command ids so
 * labels, shortcuts, enabled and checked states always come from the app's command registry.
 */
import { h, icon, shortcutLabel } from './dom.js';
import { ICONS } from '../icons.js';

/**
 * A menu command (EditorApp's command table).
 * @typedef {object} MenuCommand
 * @property {string|(() => string)} label
 * @property {string} [shortcut]
 * @property {string[]} [aliases]   more keys that run it (`shortcutIndex`; the keyboard-shortcut
 *   list shows them after `shortcut`, the menus only `shortcut`)
 * @property {string} [keyLabel]    its name in the keyboard-shortcut list (default: `label`)
 * @property {string} [icon]
 * @property {() => any} run
 * @property {() => boolean} [enabled]
 * @property {() => boolean} [checked]
 * @property {string} [hint]
 */
/**
 * A menu: `items` are command ids, '-' for separators, { header } for small section titles.
 * @typedef {{ id: string, label: string, items: (string|{ header: string })[] }} MenuDef
 */
export class MenuBar {
  /**
   * @param {HTMLElement} host
   * @param {{ menus: MenuDef[], commands: Record<string, MenuCommand>, run: (id: string) => void }} opts
   */
  constructor(host, { menus, commands, run }) {
    this.menus = menus;
    this.commands = commands;
    this.run = run;
    this.openIndex = -1;
    this.active = -1;
    this.el = h('nav', { class: 'le-menus', role: 'menubar' });
    this.buttons = menus.map((m, k) => {
      const b = h('button', {
        class: 'le-menu-btn', type: 'button', role: 'menuitem', 'aria-haspopup': 'true',
        onPointerdown: (e) => { if (e.button === 0) { e.preventDefault(); this.toggle(k); } },
        onPointerenter: () => { if (this.openIndex >= 0 && this.openIndex !== k) this.open(k); },
        onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); this.open(k, true); } },
      }, m.label);
      this.el.appendChild(b);
      return b;
    });
    this.popup = h('div', { class: 'le-menu-popup', role: 'menu' });
    this.popup.addEventListener('pointerdown', (e) => e.preventDefault());
    host.appendChild(this.el);
    document.body.appendChild(this.popup);
    this._onDoc = (e) => {
      if (this.openIndex < 0) return;
      if (this.el.contains(e.target) || this.popup.contains(e.target)) return;
      this.close();
    };
    this._onKey = (e) => this._key(e);
    document.addEventListener('pointerdown', this._onDoc, true);
    window.addEventListener('blur', () => this.close());
    window.addEventListener('resize', () => this.close());
  }

  get isOpen() { return this.openIndex >= 0; }

  toggle(k) {
    if (this.openIndex === k) this.close();
    else this.open(k);
  }

  open(k, focusFirst = false) {
    this.openIndex = k;
    this.buttons.forEach((b, i) => b.classList.toggle('is-open', i === k));
    this._build(this.menus[k]);
    const r = this.buttons[k].getBoundingClientRect();
    this.popup.style.left = `${Math.round(r.left)}px`;
    this.popup.style.top = `${Math.round(r.bottom + 2)}px`;
    this.popup.classList.add('is-open');
    // keep inside the window
    const pr = this.popup.getBoundingClientRect();
    if (pr.right > window.innerWidth - 8) this.popup.style.left = `${Math.max(8, window.innerWidth - 8 - pr.width)}px`;
    document.addEventListener('keydown', this._onKey, true);
    this.active = -1;
    if (focusFirst) this._move(1);
  }

  close() {
    if (this.openIndex < 0) return;
    this.openIndex = -1;
    this.buttons.forEach((b) => b.classList.remove('is-open'));
    this.popup.classList.remove('is-open');
    document.removeEventListener('keydown', this._onKey, true);
  }

  _build(menu) {
    this.popup.innerHTML = '';
    this.items = [];
    for (const it of menu.items) {
      if (it === '-') { this.popup.appendChild(h('div', { class: 'le-menu-sep', role: 'separator' })); continue; }
      if (typeof it === 'object' && it.header) { this.popup.appendChild(h('div', { class: 'le-menu-header' }, it.header)); continue; }
      const c = this.commands[it];
      if (!c) continue;
      const enabled = c.enabled ? c.enabled() : true;
      const checked = c.checked ? c.checked() : null;
      const label = typeof c.label === 'function' ? c.label() : c.label;
      const row = h('button', {
        class: ['le-menu-item', !enabled && 'is-disabled', checked && 'is-checked'], type: 'button',
        role: checked == null ? 'menuitem' : 'menuitemcheckbox', 'aria-checked': checked == null ? null : String(!!checked),
        disabled: !enabled, title: c.hint ?? null,
        onClick: () => { if (!enabled) return; this.close(); this.run(it); },
        onPointerenter: () => this._setActive(this.items.indexOf(row)),
      },
      h('span', { class: 'le-menu-check' }, checked != null ? icon(checked ? ICONS.check : '') : c.icon ? icon(c.icon) : null),
      h('span', { class: 'le-menu-label' }, label),
      h('span', { class: 'le-menu-key' }, shortcutLabel(c.shortcut ?? '')));
      this.items.push(row);
      this.popup.appendChild(row);
    }
  }

  _setActive(k) {
    this.active = k;
    this.items.forEach((r, i) => r.classList.toggle('is-active', i === k));
  }

  _move(dir) {
    const n = this.items.length;
    if (!n) return;
    let k = this.active;
    for (let t = 0; t < n; t++) {
      k = (k + dir + n) % n;
      if (!this.items[k].disabled) break;
    }
    this._setActive(k);
    this.items[k].focus({ preventScroll: true });
  }

  _key(e) {
    if (this.openIndex < 0) return;
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    switch (e.key) {
      case 'Escape': stop(); this.close(); this.buttons[0]?.blur(); break;
      case 'ArrowDown': stop(); this._move(1); break;
      case 'ArrowUp': stop(); this._move(-1); break;
      case 'ArrowRight': stop(); this.open((this.openIndex + 1) % this.menus.length, true); break;
      case 'ArrowLeft': stop(); this.open((this.openIndex - 1 + this.menus.length) % this.menus.length, true); break;
      case 'Enter': case ' ': if (this.active >= 0) { stop(); this.items[this.active].click(); } break;
      default: break;
    }
  }
}
