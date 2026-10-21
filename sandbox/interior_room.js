/**
 * A furnished test room — a small interior level (`environment.interior: true`) with one of every
 * furniture type of props/Furniture.js against its walls, for the game and the editor checks of
 * the interior furniture: `sandbox/interior_room.game.json` plays it through
 * `window.__luminati.playLocal` (browser slot `furniture-test`, removed at the end),
 * `sandbox/editor_shell.furniture.json` opens it in the editor.
 *
 * The room is tiled like a room level: a wood floor at height level 1, walls 3 units above it on
 * the north / west / east (a custom legend char `W`: plastered sides) and a low south wall, so the
 * camera (distance 20, pitch 38) looks in.
 */
import { createEmptyLevel, addObject, normalizeLevel } from '../src/engine/level/LevelFormat.js';

/** @import { Level } from '../src/engine/level/types.js' */

const W = 18;
const D = 14;

/**
 * @returns {Level} the room level, normalised
 */
export function interiorRoomLevel() {
  const level = createEmptyLevel({ name: 'Furniture Test Room', width: W, depth: D, fill: 'b', level: 1, border: 0 });
  level.legend.W = { top: 'stone_wall', side: 'plaster', walkable: false };
  for (let j = 0; j < D; j++) {
    let row = '';
    let hs = '';
    for (let i = 0; i < W; i++) {
      const north = j < 2;
      const side = i < 2 || i >= W - 2;
      const south = j === D - 1;
      row += north || side || south ? 'W' : 'b';
      hs += north || side ? '7' : south ? '2' : '1';
    }
    level.tiles[j] = row;
    level.heights[j] = hs;
  }
  level.environment = {
    ...level.environment,
    interior: true, timeOfDay: 11, clock: false, weather: 'clear', border: 'none', outerScenery: false,
    godRays: false, minimap: false, camera: { distance: 20, pitch: 38 }, backdrop: '#0d0b12',
  };
  level.spawn = { x: 8.5, z: 11.5, facing: 'up' };
  const H = Math.PI / 2;
  const add = (type, x, z, fields = {}) => addObject(level, type, x, z, fields);
  // the north wall (its face at z = 2): window, bed, bookshelf, hearth, a stair up in the corner
  add('wallWindow', 6.5, 2, { opts: { panes: 2, sill: 0.9, glow: 'daylight', curtains: 'red', beam: true, flowers: true } });
  add('bed', 3.25, 3.1, { opts: { width: 1.9, length: 2.2, blanket: 'blue' } });
  add('shelf', 9.5, 2.25, { opts: { kind: 'books', width: 1.6, height: 2.2 } });
  // (the stair's foot, staircaseFoot: (13.5, 2.5) — kept clear of the hearth for the player)
  add('hearth', 11.75, 2.5, { opts: { width: 2.2, height: 3, lit: true, embers: true, pot: true } });
  add('staircase', 15, 2.5, { opts: { dir: 'up', width: 1, steps: 5, height: 3, flip: false, rail: true } });
  // the west wall (its face at x = 2): a wardrobe, a pantry shelf
  add('wardrobe', 2.3, 6.25, { rotation: H, opts: { kind: 'wardrobe', width: 1.4 } });
  add('shelf', 2.25, 9, { rotation: H, opts: { kind: 'pantry', width: 1.6, height: 1.8 } });
  // the east wall (its face at x = 16): chest of drawers, sacks
  add('wardrobe', 15.75, 6, { rotation: -H, opts: { kind: 'drawers', width: 1.2 } });
  add('sacks', 15.3, 9.5, { rotation: -H, opts: { count: 4 } });
  // the middle: a rug under a round table with chairs, a bar counter with stools, a stairwell
  add('rug', 7, 7.5, { rotation: H, opts: { color: 'red', width: 2.5, length: 3.5 } });
  add('table', 7, 7.5, { opts: { shape: 'round', width: 1.2, cloth: false, items: true, candle: true } });
  add('chair', 5.85, 7.5, { rotation: H, opts: { style: 'chair' } });
  add('chair', 8.15, 7.5, { rotation: -H, opts: { style: 'chair' } });
  add('counter', 11.5, 6.5, { opts: { style: 'bar', width: 2.6, items: true } });
  add('chair', 10.8, 7.6, { opts: { style: 'stool' } });
  add('chair', 12.2, 7.6, { opts: { style: 'stool' } });
  add('table', 11.5, 10.5, { opts: { shape: 'rect', width: 1.6, depth: 0.9, cloth: true, items: true, candle: false } });
  add('staircase', 4, 11, { opts: { dir: 'down', width: 1.2, steps: 4 } });
  // the room's own light (a level adds `light` objects for lamplight)
  add('light', 8.5, 6, { dy: 2.4, color: '#ffc27a', intensity: 6, distance: 9, flicker: 0.1, nightOnly: true });
  return normalizeLevel(level).level;
}
