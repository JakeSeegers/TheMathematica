import { ICONS } from '../icons.js';
import { snapTo, tidy } from './common.js';
import { isWalkablePoint } from '../../engine/level/LevelFormat.js';

/**
 * @import { LevelSpawn } from '../../engine/level/types.js'
 * @import { Tool, PointerEv, ToolPreview } from './index.js'
 * @import { EditorState } from '../EditorState.js'
 */

// R turns counter-clockwise seen from above, like R on objects (+15°): down → right → up → left
/** @type {LevelSpawn['facing'][]} */
const FACINGS = ['down', 'right', 'up', 'left'];

let drag = false;
let hover = null;

/** Is world point (x, z) on walkable ground (a walkable tile or a bridge deck, like the game)? */
export function isWalkableAt(level, x, z) {
  return isWalkablePoint(level, x, z);
}

/** @param {EditorState} state @param {PointerEv} ev */
function spot(state, ev) {
  if (ev.alt || !state.toolOptions.snap) return { x: tidy(ev.x), z: tidy(ev.z) };
  // snap to tile centres (i + 0.5)
  return { x: snapTo(ev.x - 0.5, 1) + 0.5, z: snapTo(ev.z - 0.5, 1) + 0.5 };
}

/** @type {Tool} */
export const SpawnTool = {
  id: 'spawn',
  label: 'Player start',
  shortcut: 'P',
  icon: ICONS.spawn,
  help: 'Player start — click or drag to move where the player appears · R: turn the facing · Alt: no snap',
  cursor: 'crosshair',

  activate() { drag = false; },
  deactivate(state) { if (drag) { drag = false; state.commit(); } hover = null; },

  pointerDown(ev, state) {
    const p = spot(state, ev);
    state.begin('Move player start');
    drag = true;
    state.setSpawn(p.x, p.z);
    state.emit('preview');
  },

  pointerMove(ev, state) {
    hover = ev;
    if (drag) {
      const p = spot(state, ev);
      const s = state.level.spawn;
      if (p.x !== s.x || p.z !== s.z) state.setSpawn(p.x, p.z);
    }
    state.emit('preview');
  },

  // the move was applied on press / move and is committed either way; an interrupted stroke
  // (`ev.cancelled`) leaves the selection alone (PointerEv.cancelled), the message still reports it
  pointerUp(ev, state) {
    if (!drag) return;
    drag = false;
    state.commit();
    if (!ev.cancelled) state.select(['spawn']);
    const s = state.level.spawn;
    state.notify(isWalkableAt(state.level, s.x, s.z) ? `Player start moved to ${s.x}, ${s.z}` : 'Warning: the player start is not on walkable ground');
  },

  keyDown(e, state) {
    if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const s = state.level.spawn;
      const k = FACINGS.indexOf(s.facing);
      state.setSpawn(s.x, s.z, FACINGS[(k + (e.shiftKey ? 3 : 1)) % 4]);
      state.notify(`Player faces ${state.level.spawn.facing}`);
      return true;
    }
    return false;
  },

  /** @returns {ToolPreview|null} */
  preview(state) {
    if (!state.hover || !hover) return null;
    const p = spot(state, hover);
    const ok = isWalkableAt(state.level, p.x, p.z);
    return {
      cells: [{ i: Math.floor(p.x), j: Math.floor(p.z) }],
      cellColor: ok ? 'rgba(127,227,255,0.35)' : 'rgba(255,100,90,0.45)',
      spawn: { x: p.x, z: p.z, facing: state.level.spawn.facing },
      label: ok ? `Player start · faces ${state.level.spawn.facing}` : 'Not walkable here',
    };
  },
};
