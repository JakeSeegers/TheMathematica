/**
 * Rich floating tooltips (title, shortcut badge, help line) shared by the toolbar, palettes and
 * buttons. One tooltip element for the whole app.
 */
import { h, shortcutLabel } from './dom.js';

let tipEl = null;
let timer = 0;
let current = null;

function ensure() {
  if (!tipEl) {
    tipEl = h('div', { class: 'le-tooltip', role: 'tooltip' });
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

function show(target, spec) {
  const el = ensure();
  el.innerHTML = '';
  el.append(
    h('div', { class: 'le-tooltip-head' },
      h('span', { class: 'le-tooltip-title' }, spec.title),
      spec.key ? h('kbd', { class: 'le-kbd' }, shortcutLabel(spec.key)) : null),
    spec.text ? h('div', { class: 'le-tooltip-text' }, spec.text) : null,
  );
  el.classList.add('is-open');
  const r = target.getBoundingClientRect();
  const tr = el.getBoundingClientRect();
  const place = spec.place ?? 'right';
  let x;
  let y;
  if (place === 'right') { x = r.right + 10; y = r.top + r.height / 2 - tr.height / 2; }
  else if (place === 'left') { x = r.left - tr.width - 10; y = r.top + r.height / 2 - tr.height / 2; }
  else if (place === 'top') { x = r.left + r.width / 2 - tr.width / 2; y = r.top - tr.height - 8; }
  else { x = r.left + r.width / 2 - tr.width / 2; y = r.bottom + 8; }
  x = Math.max(6, Math.min(window.innerWidth - tr.width - 6, x));
  y = Math.max(6, Math.min(window.innerHeight - tr.height - 6, y));
  el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

export function hideTooltip() {
  clearTimeout(timer);
  current = null;
  tipEl?.classList.remove('is-open');
}

/**
 * Attach a tooltip. `spec` may be a function (evaluated when shown).
 * @param {HTMLElement} target
 * @param {{ title: string, key?: string, text?: string, place?: 'right'|'left'|'top'|'bottom' } | (() => object)} spec
 */
export function tooltip(target, spec) {
  target.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'touch') return;
    clearTimeout(timer);
    const delay = tipEl?.classList.contains('is-open') ? 60 : 380;
    current = target;
    timer = setTimeout(() => { if (current === target && target.isConnected) show(target, typeof spec === 'function' ? spec() : spec); }, delay);
  });
  target.addEventListener('pointerleave', hideTooltip);
  target.addEventListener('pointerdown', hideTooltip);
  target.removeAttribute('title');
  return target;
}
