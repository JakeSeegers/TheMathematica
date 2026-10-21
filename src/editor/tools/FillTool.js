import { ICONS } from '../icons.js';
import { floodRegion, tileLabel } from './common.js';
import { pickTileAt, tilePreviewColor } from './PaintTool.js';

/** @import { Tool, ToolPreview } from './index.js' */

const PREVIEW_LIMIT = 6000;

let hover = null;
let cache = null; // { key, cells }
let offChange = null;

function region(state, i, j, global) {
  const key = `${i},${j},${global ? 1 : 0},${state.toolOptions.fillMatchHeight ? 1 : 0}`;
  if (cache?.key === key) return cache.cells;
  const cells = floodRegion(state.level, i, j, { matchHeight: !!state.toolOptions.fillMatchHeight, global });
  cache = { key, cells };
  return cells;
}

/** @type {Tool} */
export const FillTool = {
  id: 'fill',
  label: 'Fill',
  shortcut: 'G',
  icon: ICONS.fill,
  help: 'Fill — click to flood-fill the connected area of the same tile · Shift+click: replace everywhere · Alt+click: pick tile',
  cursor: 'crosshair',

  activate(state) {
    cache = null;
    offChange?.();
    offChange = state.on('change', () => { cache = null; });
  },
  deactivate() { offChange?.(); offChange = null; cache = null; hover = null; },

  pointerDown(ev, state) {
    if (ev.alt) { pickTileAt(state, ev); return; }
    const cells = region(state, ev.i, ev.j, ev.shift);
    if (!cells.length) return;
    const { tile, paintHeight, heightValue } = state.toolOptions;
    const n = state.editTiles(cells.map((c) => ({ i: c.i, j: c.j, tile, height: paintHeight ? heightValue : null })), ev.shift ? 'Replace tiles' : 'Fill');
    cache = null;
    state.notify(n ? `Filled ${n} tile${n === 1 ? '' : 's'} with ${tileLabel(state.level, tile)}` : 'Nothing to fill');
    state.emit('preview');
  },

  pointerMove(ev, state) {
    const changed = !hover || hover.i !== ev.i || hover.j !== ev.j || hover.shift !== ev.shift;
    hover = { i: ev.i, j: ev.j, shift: ev.shift };
    if (changed) state.emit('preview');
  },

  pointerUp() {},

  /** @returns {ToolPreview|null} */
  preview(state) {
    if (!state.hover || !hover || !state.inBounds(hover.i, hover.j)) return null;
    const cells = region(state, hover.i, hover.j, hover.shift);
    const label = `${hover.shift ? 'Replace' : 'Fill'} ${cells.length} tile${cells.length === 1 ? '' : 's'} → ${tileLabel(state.level, state.toolOptions.tile)}`;
    if (cells.length > PREVIEW_LIMIT) return { cells: [{ i: hover.i, j: hover.j }], cellColor: tilePreviewColor(state, state.toolOptions.tile), label };
    return { cells, cellColor: tilePreviewColor(state, state.toolOptions.tile).replace(/[\d.]+\)$/, '0.4)'), label };
  },
};
