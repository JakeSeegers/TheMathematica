/**
 * A small right-click context menu (same look as the menu bar popups).
 */
import { h, icon, shortcutLabel } from './dom.js';

let current = null;

export function closeContextMenu() {
  if (!current) return;
  current.remove();
  current = null;
  document.removeEventListener('pointerdown', onDoc, true);
  document.removeEventListener('keydown', onKey, true);
}

function onDoc(e) { if (current && !current.contains(e.target)) closeContextMenu(); }
function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeContextMenu(); } }

/**
 * A command.
 * @typedef {object} ContextMenuCommand
 * @property {string} label
 * @property {string} [icon]
 * @property {string} [shortcut]
 * @property {() => void} run
 * @property {boolean} [danger]
 * @property {boolean} [disabled]  greyed out
 * @property {undefined} [header]
 */
/**
 * A section title (`header` is never empty: an empty one reads as a command).
 * @typedef ContextMenuHeader
 * @type {{ header: string } & { [K in Exclude<keyof ContextMenuCommand, 'header'>]?: never }}
 */

/**
 * @param {number} x client x
 * @param {number} y client y
 * @param {(ContextMenuCommand | '-' | ContextMenuHeader)[]} items
 *   commands, '-' separators and section titles
 */
export function showContextMenu(x, y, items) {
  closeContextMenu();
  const el = h('div', { class: 'le-menu-popup is-open is-context', role: 'menu' });
  for (const it of items) {
    if (it === '-') { el.appendChild(h('div', { class: 'le-menu-sep' })); continue; }
    if (it.header) { el.appendChild(h('div', { class: 'le-menu-header' }, it.header)); continue; }
    el.appendChild(h('button', {
      class: ['le-menu-item', it.danger && 'is-danger', it.disabled && 'is-disabled'], type: 'button', role: 'menuitem', disabled: !!it.disabled,
      onClick: () => { closeContextMenu(); it.run(); },
    }, h('span', { class: 'le-menu-check' }, it.icon ? icon(it.icon) : null), h('span', { class: 'le-menu-label' }, it.label), h('span', { class: 'le-menu-key' }, shortcutLabel(it.shortcut ?? ''))));
  }
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  document.body.appendChild(el);
  const r = el.getBoundingClientRect();
  el.style.left = `${Math.round(Math.min(x, window.innerWidth - r.width - 6))}px`;
  el.style.top = `${Math.round(Math.min(y, window.innerHeight - r.height - 6))}px`;
  current = el;
  setTimeout(() => {
    document.addEventListener('pointerdown', onDoc, true);
    document.addEventListener('keydown', onKey, true);
  }, 0);
}
