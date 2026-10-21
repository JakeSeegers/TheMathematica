import { ICONS } from '../icons.js';
import { brushCells, lineCells, clipCells, cellKey, heightAt } from './common.js';
import { MAX_LEVEL, getHeightLevel } from '../../engine/level/LevelFormat.js';

/** @import { Tool, ToolPreview } from './index.js' */

export const HEIGHT_MODES = [
  { id: 'raise', label: 'Raise', help: 'Each stroke raises every tile it touches by one level (Shift lowers).' },
  { id: 'lower', label: 'Lower', help: 'Each stroke lowers every tile it touches by one level (Shift raises).' },
  { id: 'set', label: 'Set', help: 'Set tiles to the chosen level.' },
  { id: 'flatten', label: 'Flatten', help: 'Flatten to the level where the stroke started.' },
  { id: 'smooth', label: 'Smooth', help: 'Average each tile with its neighbours.' },
];

let stroke = null; // { mode, last, touched:Set, flat, snapshot }
let hover = null;

function effectiveMode(state, ev) {
  let m = state.toolOptions.heightMode;
  if (ev?.shift && m === 'raise') m = 'lower';
  else if (ev?.shift && m === 'lower') m = 'raise';
  return m;
}

function apply(state, points) {
  const { brushSize, brushShape, heightValue } = state.toolOptions;
  const L = state.level;
  const cells = [];
  for (const p of points) cells.push(...brushCells(p.i, p.j, brushSize, brushShape));
  const edits = [];
  for (const c of clipCells(L, cells)) {
    const k = cellKey(c.i, c.j);
    if (stroke.touched.has(k)) continue;
    stroke.touched.add(k);
    const h = getHeightLevel(L, c.i, c.j);
    let v = h;
    switch (stroke.mode) {
      case 'raise': v = h + 1; break;
      case 'lower': v = h - 1; break;
      case 'set': v = heightValue; break;
      case 'flatten': v = stroke.flat; break;
      case 'smooth': {
        // average of the 3×3 neighbourhood as it was when the stroke started
        let sum = 0;
        let n = 0;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const s = stroke.snapshot(c.i + di, c.j + dj);
            if (s == null) continue;
            sum += s; n++;
          }
        }
        v = Math.round(sum / n);
        break;
      }
      default: break;
    }
    v = Math.max(0, Math.min(MAX_LEVEL, v));
    if (v !== h) edits.push({ i: c.i, j: c.j, height: v });
  }
  if (edits.length) state.editTiles(edits, 'Height');
}

/** @type {Tool} */
export const HeightTool = {
  id: 'height',
  label: 'Height',
  shortcut: 'H',
  icon: ICONS.height,
  help: 'Height — raise / lower / set / flatten / smooth terrain · Shift inverts raise/lower · Alt+click: pick level · [ / ] brush size',
  cursor: 'crosshair',

  activate() { stroke = null; },
  deactivate(state) { if (stroke) { stroke = null; state.commit(); } hover = null; },

  pointerDown(ev, state) {
    if (ev.alt) {
      const h = getHeightLevel(state.level, ev.i, ev.j);
      if (h != null) { state.setToolOption('heightValue', h); state.notify(`Height value set to level ${h}`); }
      return;
    }
    if (!state.inBounds(ev.i, ev.j) && effectiveMode(state, ev) === 'flatten') return;
    const heights = [...state.level.heights];
    const L = state.level;
    stroke = {
      mode: effectiveMode(state, ev),
      last: { i: ev.i, j: ev.j },
      touched: new Set(),
      flat: heightAt(L, ev.i, ev.j, state.toolOptions.heightValue),
      snapshot: (i, j) => (i < 0 || j < 0 || i >= L.width || j >= L.depth ? null : parseInt(heights[j][i], 36)),
    };
    state.begin('Height');
    apply(state, [{ i: ev.i, j: ev.j }]);
    state.emit('preview');
  },

  pointerMove(ev, state) {
    const moved = !hover || hover.i !== ev.i || hover.j !== ev.j || hover.shift !== ev.shift;
    hover = { i: ev.i, j: ev.j, shift: ev.shift };
    if (stroke && (stroke.last.i !== ev.i || stroke.last.j !== ev.j)) {
      apply(state, lineCells(stroke.last.i, stroke.last.j, ev.i, ev.j));
      stroke.last = { i: ev.i, j: ev.j };
    }
    if (moved) state.emit('preview');
  },

  pointerUp(ev, state) {
    if (!stroke) return;
    stroke = null;
    state.commit();
    state.emit('preview');
  },

  /** @returns {ToolPreview|null} */
  preview(state) {
    if (!state.hover || !hover) return null;
    const { brushSize, brushShape, heightValue } = state.toolOptions;
    const mode = stroke?.mode ?? effectiveMode(state, hover);
    const h = getHeightLevel(state.level, hover.i, hover.j);
    const colors = { raise: 'rgba(255,226,150,0.42)', lower: 'rgba(90,150,255,0.40)', set: 'rgba(201,164,92,0.45)', flatten: 'rgba(160,220,170,0.40)', smooth: 'rgba(200,170,255,0.38)' };
    const labels = {
      raise: 'Raise +1', lower: 'Lower −1', set: `Set level ${heightValue}`,
      flatten: `Flatten to ${stroke ? stroke.flat : h ?? '–'}`, smooth: 'Smooth',
    };
    const cells = clipCells(state.level, brushCells(hover.i, hover.j, brushSize, brushShape));
    if (!cells.length) return null;
    return {
      cells,
      cellColor: colors[mode],
      label: `${labels[mode]}${h != null ? ` · level ${h}` : ''}`,
    };
  },
};
