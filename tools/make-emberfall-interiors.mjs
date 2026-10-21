#!/usr/bin/env node
/**
 * Builds the demo campaign **Emberfall — Open Doors** — `public/campaigns/emberfall-interiors/`:
 * `campaign.json` and its level files (docs/specs/CAMPAIGN_FORMAT.md §6.3 "Rooms: the levels set
 * aside", docs/design/campaigns/emberfall-interiors.md). Emberfall, the demo village, with every
 * door open: each building has a room behind its door, the multi-storey ones a floor above.
 *
 *   emberfall        (48 × 40, the start) Emberfall's map exactly — tiles, heights, environment,
 *                    objects and villagers read from public/levels/emberfall.json (never edited) —
 *                    plus, at every building, a Space exit "Enter" over its door step and an
 *                    entrance on the step for the way back; the houses that now open lose their
 *                    Knock text.
 *   inn              The Ember & Oak's taproom: the bar and its keeper, tables on rugs, the hearth
 *     inn-upstairs   and the cook, patrons; a staircase up to the guest rooms (partitioned bedrooms).
 *   windmill         the millstone floor (an octagonal room: sacks, crates, barrels, flour dust)
 *     windmill-upper and the cap floor above it.
 *   barn             Tobin's barn (hay, sacks, chickens in a pen) and its hayloft.
 *     barn-loft
 *   elder-house      the elder's cottage: books, a hearth, a bed and her apprentice.
 *   riverside-house  a kitchen and a bed behind a half wall.
 *   thatch-cottage   one cosy room: the baker's.
 *   lodge            the woodcutter's lodge: hearth, firewood, two beds, the woodcutter and his son.
 *
 * Every room is an interior (`environment.interior`): no weather, border or outer scenery; its own
 * hour; a dark backdrop; the town is kept set aside while the player is inside and the last room
 * after they leave, so a door is a light switch, not a level build. The rooms place every interior
 * furniture type (coverage below — a new `interior: true` catalog type fails here until a room
 * places it, as Starfall Vale's coverage does for the other types).
 *
 *   node tools/make-emberfall-interiors.mjs [--out=<folder>] [--check] [--force] [--quiet] [--verbose]
 *     --out=<folder>  write the campaign elsewhere (relative to the repository root)
 *     --check         write nothing; exit 1 unless every file matches byte for byte
 *     --force         write even when the campaign check reports errors
 *     --verbose       also list the town's own level-check warnings (Emberfall's 39)
 *
 * Content-text keys (docs/specs/I18N.md §4.10): the town keeps Emberfall's keys as they are (its
 * texts are Emberfall's and share their translations; an opened house's Knock text goes with its
 * key); the rooms' and campaign.json's are carried from the current files at the default folder
 * (never --out), a new text's minted from its file and text.
 *
 * Deterministic (no randomness). Before writing it checks the town against Emberfall (only the
 * doors differ), the coverage, every room (interior, ≤ 12 light descriptors, no prop collider in a
 * wall: `wallClips`), and the whole campaign through `checkCampaign` (tools/lib/campaigncheck.mjs:
 * every level's checkLevel, the links); an error stops the write unless --force.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createEmptyLevel, addObject, normalizeLevel, parseLevel, validateLevel, serializeLevel, levelToChar,
} from '../src/engine/level/LevelFormat.js';
import { OBJECT_TYPES, isInteriorType, staircaseFoot } from '../src/engine/level/ObjectCatalog.js';
import { CAMPAIGN_FORMAT, normalizeCampaign, serializeCampaign, levelFile } from '../src/game/campaign/CampaignFormat.js';
import { carryCampaignText, seededMint, fileKeyIssues } from '../src/engine/i18n/TextKeys.js';
import { parseArgs, canonicalObject, keyLevel, keyIssueLines, previousOutput } from './lib/levelgen.mjs';
import { gridFromLevel, placerFromLevel } from './lib/levelcheck.mjs';
import { checkCampaign } from './lib/campaigncheck.mjs';

/** @import { Level, LevelObject, TileDef } from '../src/engine/level/types.js' */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
if (args.out === true || args.out === '') {
  console.error('--out needs a folder, e.g. --out=.check/emberfall-interiors');
  process.exit(2);
}
const NAME = 'emberfall-interiors';
const OUT = path.resolve(root, String(args.out ?? `public/campaigns/${NAME}`));
const log = (...a) => { if (!args.quiet) console.log(...a); };

const H = Math.PI / 2;
/** Round to 1/1000 (positions computed from rotations). */
const r3 = (v) => Math.round(v * 1000) / 1000;

// ---------------------------------------------------------------------------------------------
// The town: Emberfall, every door open
// ---------------------------------------------------------------------------------------------

/**
 * The buildings that open, by their Emberfall object id: the room behind the door, the names of
 * the exit / entrance pair, the door step (where the house's door interactable stands, measured in
 * the game: 0.9 in front of the wall) and the way the door faces (out of the house).
 * The windmill's door: buildWindmill (src/engine/world/props/Structures.js) puts it on the tower's
 * local +Z facet at 1.505 from the axis; its step is 0.9 in front of it (2.405), turned by the
 * windmill's rotation.
 */
const WINDMILL = { x: 11.4, z: 5.6, rotation: 0.12, step: 2.405 };
const DOORS = [
  { house: 'inn', room: 'inn', entrance: 'inn-door', step: [18.15, 17], out: 'down', label: 'Enter' },
  { house: 'elder_house', room: 'elder-house', entrance: 'elder-door', step: [14.75, 19.35], out: 'right', label: 'Enter' },
  { house: 'brick_house', room: 'riverside-house', entrance: 'riverside-door', step: [24.5, 18.35], out: 'left', label: 'Enter' },
  { house: 'thatch_cottage', room: 'thatch-cottage', entrance: 'cottage-door', step: [11.65, 30.1], out: 'down', label: 'Enter' },
  { house: 'lodge', room: 'lodge', entrance: 'lodge-door', step: [44.4, 15], out: 'down', label: 'Enter' },
  { house: 'barn', room: 'barn', entrance: 'barn-door', step: [5.15, 17.5], out: 'down', label: 'Enter' },
  {
    house: 'windmill', room: 'windmill', entrance: 'windmill-door', out: 'down', label: 'Enter',
    step: [r3(WINDMILL.x + Math.sin(WINDMILL.rotation) * WINDMILL.step), r3(WINDMILL.z + Math.cos(WINDMILL.rotation) * WINDMILL.step)],
  },
];
/** Unit vector of a facing (out of the door). */
const FACE = { down: [0, 1], up: [0, -1], right: [1, 0], left: [-1, 0] };

/**
 * A house whose door opens: no Knock text, and so no key for it (docs/specs/I18N.md §4.2: a key on
 * no text is stray); the rest of its content-text keys — none today — stay.
 * @param {any} house
 */
function clearKnock(house) {
  house.text = [];
  if (house.textKeys) {
    delete house.textKeys.text;
    if (!Object.keys(house.textKeys).length) delete house.textKeys;
  }
}

/**
 * The town: Emberfall's level with its content-text keys as they are (its texts are Emberfall's, so
 * they keep Emberfall's keys and share its translations: no key is made here — a text of Emberfall
 * without one fails the check until `npm run i18n:keys -- --assign public/levels/emberfall.json`).
 */
function town() {
  const file = path.join(root, 'public/levels/emberfall.json');
  const { level, warnings } = parseLevel(fs.readFileSync(file, 'utf8'));
  if (warnings.length) throw new Error(`emberfall.json: ${warnings.join('; ')}`);
  const L = /** @type {Level} */ (JSON.parse(JSON.stringify(level)));
  L.description = 'Emberfall, the demo village, with every door open: the inn and its guest rooms, the windmill, Tobin\'s barn and hayloft, the elder\'s cottage, the riverside house, the thatched cottage and the woodcutter\'s lodge. The start of Emberfall — Open Doors.';
  for (const d of DOORS) {
    const house = L.objects.find((o) => o.id === d.house);
    if (!house) throw new Error(`emberfall.json has no "${d.house}"`);
    // (the door's Space is Enter now: no Knock text)
    if (house.type === 'house') clearKnock(house);
    const [fx, fz] = FACE[d.out];
    const [x, z] = d.step;
    // the exit over the door step: 1.8 across the door, from 0.7 toward the door to 0.5 out
    const across = fx === 0;
    const ax = across ? 0.9 : 0;
    const az = across ? 0 : 0.9;
    const x0 = fx ? x - (fx > 0 ? 0.7 : 0.5) : x - ax;
    const x1 = fx ? x + (fx > 0 ? 0.5 : 0.7) : x + ax;
    const z0 = fz ? z - (fz > 0 ? 0.7 : 0.5) : z - az;
    const z1 = fz ? z + (fz > 0 ? 0.5 : 0.7) : z + az;
    put(L, `door_${d.room.replace(/-/g, '_')}`, 'exit', 0, 0, {
      minX: r3(x0), maxX: r3(x1), minZ: r3(z0), maxZ: r3(z1), to: d.room, entrance: 'front-door', mode: 'use', label: d.label,
    });
    put(L, d.entrance.replace(/-/g, '_'), 'entrance', r3(x + fx * 0.6), r3(z + fz * 0.6), { name: d.entrance, facing: d.out });
  }
  return L;
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/**
 * Add an object with a readable id.
 * @param {Level} L
 * @param {string} id
 * @param {string} type
 * @param {number} x
 * @param {number} z
 * @param {Record<string, any>} [fields]
 */
function put(L, id, type, x, z, fields = {}) {
  const o = addObject(L, /** @type {any} */ (type), x, z, fields);
  if (id) o.id = id;
  return o;
}

/** The floor's height level in every room, and the walls' heights above it (levels of 0.5). */
const FLOOR = 1;
const WALL_UP = 6; // 3 units: hearths and staircases reach up to it
const LOW_UP = 1; // the low south wall the camera looks over
const WALL_H = (WALL_UP * 0.5);

/**
 * A room's tile kinds: `#` a wall (full height), `-` as high as the low south wall, `+` a partition
 * (a level lower than the walls), `=` a half wall (1.5 high), a floor char otherwise.
 * @typedef {object} RoomSpec
 * @property {string} name
 * @property {string} subtitle
 * @property {string} description
 * @property {number} W
 * @property {number} D
 * @property {string} floor the floor's legend char
 * @property {Record<string, TileDef>} legend custom legend entries (the wall `W`, floors)
 * @property {[number, number]|null} door the door gap's columns [i0, i1) in the south wall (null: none)
 * @property {number} timeOfDay
 * @property {(a: number, b: number, w: number, d: number) => string|null} [shape] a tile kind for
 *   interior tile (a, b) of a w × d interior (null: floor) — corner cuts, partitions, floor patches
 * @property {object} [camera]
 */

/**
 * A room level (createRoomLevel's layout, src/editor/rooms.js): the floor at FLOOR, walls of the
 * custom tile `W` two tiles thick on the north, west and east (WALL_UP levels higher), the low south
 * wall (one tile, LOW_UP) with the door gap, the room look.
 * @param {RoomSpec} s
 * @returns {Level}
 */
function roomLevel(s) {
  const L = createEmptyLevel({ name: s.name, width: s.W, depth: s.D, fill: s.floor, level: FLOOR, border: 0 });
  L.subtitle = s.subtitle;
  L.author = 'Luminati';
  L.description = s.description;
  for (const [ch, def] of Object.entries(s.legend)) L.legend[ch] = def;
  const w = s.W - 4;
  const d = s.D - 3;
  const tiles = [];
  const heights = [];
  for (let j = 0; j < s.D; j++) {
    let tr = '';
    let hr = '';
    for (let i = 0; i < s.W; i++) {
      let kind;
      if (j === s.D - 1) kind = s.door && i >= s.door[0] && i < s.door[1] ? s.floor : '-';
      else if (j < 2 || i < 2 || i >= s.W - 2) kind = '#';
      else kind = s.shape?.(i - 2, j - 2, w, d) ?? s.floor;
      const up = kind === '#' ? WALL_UP : kind === '-' ? LOW_UP : kind === '+' ? WALL_UP - 1 : kind === '=' ? 3 : 0;
      tr += kind === '#' || kind === '-' || kind === '+' || kind === '=' ? 'W' : kind;
      hr += levelToChar(FLOOR + up);
    }
    tiles.push(tr);
    heights.push(hr);
  }
  L.tiles = tiles;
  L.heights = heights;
  L.environment = {
    ...L.environment,
    timeOfDay: s.timeOfDay, clock: false, border: 'none', outerScenery: false, godRays: false,
    minimap: false, backdrop: '#0d0b12', camera: s.camera ?? roomCamera(s.W, s.D), interior: true,
  };
  return L;
}

/**
 * A room's camera: close (20, 38°) and held over the middle of the room (one bounds rect of a unit
 * or so), so the whole room stays in view wherever the player walks — from the door too.
 * @param {number} W
 * @param {number} D
 */
function roomCamera(W, D) {
  const cx = W / 2;
  const cz = (D + 1) / 2;
  return { distance: 20, pitch: 38, bounds: { minX: cx - 0.5, maxX: cx + 0.5, minZ: cz - 0.4, maxZ: cz + 0.4 } };
}

/**
 * The way out of a ground-floor room: a Space exit "Go out" over the door gap (and the row inside
 * it) to the town's entrance, the entrance `front-door` just inside, facing in; the player start
 * there too.
 * @param {Level} L
 * @param {[number, number]} door the gap's columns
 * @param {string} townEntrance
 */
function frontDoor(L, door, townEntrance) {
  const D = L.depth;
  const cx = (door[0] + door[1]) / 2;
  put(L, 'exit_out', 'exit', 0, 0, {
    minX: door[0] - 0.2, maxX: door[1] + 0.2, minZ: D - 1.8, maxZ: D, to: 'emberfall', entrance: townEntrance, mode: 'use', label: 'Go out',
  });
  put(L, 'front_door', 'entrance', cx, D - 2.3, { name: 'front-door', facing: 'up' });
  L.spawn = { x: cx, z: D - 2.3, facing: 'up' };
}

/**
 * A staircase between two floors: the Space exit at its foot (`staircaseFoot`) to the other floor's
 * entrance, and this floor's entrance for the way back — `back` units from the foot, away from
 * the stair, facing away from it.
 * @param {Level} L
 * @param {LevelObject} stair a `staircase` object of L
 * @param {{ to: string, entrance: string, here: string, label: string, back?: number, facing: string }} o
 */
function stairLink(L, stair, { to, entrance, here, label, back = 0.7, facing }) {
  const f = staircaseFoot(stair);
  if (!f) throw new Error('not a staircase');
  put(L, `exit_${here.replace(/-/g, '_')}`, 'exit', 0, 0, {
    minX: r3(f.x - 0.6), maxX: r3(f.x + 0.6), minZ: r3(f.z - 0.6), maxZ: r3(f.z + 0.6), to, entrance, mode: 'use', label,
  });
  put(L, here.replace(/-/g, '_'), 'entrance', r3(f.x - f.dx * back), r3(f.z - f.dz * back), { name: here, facing });
}

/** A villager standing at a post (keepers, cooks), facing `facing`. */
function keeper(L, id, x, z, fields) {
  return put(L, id, 'npc', x, z, { behaviour: 'post', wander: 0, ...fields });
}

/** A region naming the whole room (the HUD plate). */
function roomRegion(L, name, sub) {
  put(L, 'region_room', 'region', 0, 0, { minX: 0, maxX: L.width, minZ: 0, maxZ: L.depth, name, sub });
}

// ---- legend entries (custom tile chars) ----

/**
 * A wall tile: `side` the building's wall texture, and on top (the wall's cut top, which must read
 * as the top of a wall — a plank or cobble cap reads as more floor) the same material by default,
 * so the wall reads as one solid block; `lip` an optional band at the top of the face.
 * @param {string} side
 * @param {{ top?: string, lip?: string }} [o]
 * @returns {TileDef}
 */
const wallTile = (side, { top = side, lip } = {}) => ({ top, side, ...(lip ? { lip } : {}), walkable: false, overhang: false, fringe: false, uvVariation: false });
/** Floors (custom chars: the ground foliage leaves custom chars alone). */
const PLANKS = { top: 'wood_deck', side: 'wood_planks_dark', walkable: true, fringe: false };
const FLAGS = { top: 'stone_tiles', side: 'stone_wall', walkable: true, fringe: false };
const EARTH = { top: 'dirt', side: 'dirt_side', walkable: true, fringe: false, uvVariation: true };
const STRAW = { top: 'hay', side: 'dirt_side', walkable: true, fringe: false };

// ---------------------------------------------------------------------------------------------
// The Ember & Oak: the taproom and the guest rooms above it
// ---------------------------------------------------------------------------------------------

function innTaproom() {
  const door = /** @type {[number, number]} */ ([6, 8]);
  const L = roomLevel({
    name: 'The Ember & Oak', subtitle: 'The Taproom',
    description: 'Emberfall\'s inn: the bar, the hearth and the cook\'s pot, tables on worn rugs, the stair up to the guest rooms.',
    W: 18, D: 13, floor: 'P', legend: { P: PLANKS, W: wallTile('plaster') }, door, timeOfDay: 16.8,
  });
  // the bar: a pantry shelf on the north wall, the keeper behind the counter, kegs beside it
  put(L, 'bar_shelf', 'shelf', 3.7, 2.25, { opts: { kind: 'pantry', width: 2.4, height: 2.2, seed: 3 } });
  put(L, 'keg_1', 'barrel', 5.6, 2.6, { rotation: 0.3, opts: { height: 1.0 } });
  put(L, 'keg_2', 'barrel', 6.5, 2.55, { rotation: -0.4, opts: { height: 0.9 } });
  put(L, 'bar', 'counter', 4.3, 4.6, { opts: { style: 'bar', width: 3.4, seed: 7 } });
  keeper(L, 'garrick', 4.3, 3.8, {
    name: 'Garrick', preset: 'merchant', facing: 'down', portraitColor: '#c97b4a', talkOffset: [0, 1.6],
    spec: { hat: 'none', hair: 'hairBrown', gear: { apron: 'cream', boots: 'brown' } },
    dialogue: [
      'Welcome to the {Ember & Oak}! Rosalind keeps the door, I keep the taps. Between us we keep the gossip.',
      'Ember ale, brewed with the river\'s own water. It tastes of autumn, or so the label says. I wrote the label.',
    ],
  });
  // the hearth and the cook
  put(L, 'hearth', 'hearth', 9.6, 2.5, { opts: { width: 2.4, height: WALL_H, lit: true, pot: true, seed: 2 } });
  put(L, 'cook', 'npc', 10.8, 3.7, {
    name: 'Old Nan', preset: 'innkeeper', facing: 'down', wander: 0.5, speed: 0.6, portraitColor: '#d8a65c',
    spec: { hair: 'hairWhite', outfit: { top: '#6e5a8a', bottom: '#4a3a5a' } },
    dialogue: [
      'Stew\'s on. It has been on since the founders came up the river, I\'m told. I just keep adding to it.',
      'Mind the pot, dear. The pot minds nobody.',
    ],
  });
  // the stair up to the guest rooms (north-east corner, rising east)
  const up = put(L, 'stair_up', 'staircase', 14.6, 2.6, { opts: { dir: 'up', width: 1.2, steps: 7, height: WALL_H, seed: 4 } });
  stairLink(L, up, { to: 'inn-upstairs', entrance: 'stairs', here: 'stairs', label: 'Go upstairs', facing: 'down' });
  // tables
  put(L, 'rug_a', 'rug', 9.0, 7.6, { rotation: H, opts: { color: 'red', width: 2.6, length: 3.8, seed: 1 } });
  put(L, 'table_a', 'table', 9.0, 7.6, { opts: { shape: 'rect', width: 1.8, depth: 0.9, items: true, candle: true, seed: 11 } });
  for (const x of [8.5, 9.5]) {
    put(L, '', 'chair', x, 6.85, { rotation: 0 });
    put(L, '', 'chair', x, 8.35, { rotation: Math.PI });
  }
  put(L, 'rug_b', 'rug', 13.0, 6.6, { opts: { color: 'blue', width: 2.4, length: 2.6, seed: 2 } });
  put(L, 'table_b', 'table', 13.0, 6.6, { opts: { shape: 'round', width: 1.2, items: true, seed: 5 } });
  put(L, '', 'chair', 12.0, 6.6, { rotation: H });
  put(L, '', 'chair', 14.0, 6.6, { rotation: -H });
  put(L, '', 'chair', 13.0, 5.6, { rotation: 0 });
  put(L, 'table_c', 'table', 12.6, 10.0, { opts: { shape: 'round', width: 1.0, items: true, seed: 8 } });
  put(L, '', 'chair', 11.7, 10.0, { rotation: H, opts: { style: 'stool' } });
  put(L, '', 'chair', 13.5, 10.0, { rotation: -H, opts: { style: 'stool' } });
  // patrons
  put(L, 'brannoc', 'npc', 10.6, 8.6, {
    name: 'Sir Brannoc', preset: 'swordsman', behaviour: 'post', wander: 0, facing: 'left', portraitColor: '#6a7fb0',
    dialogue: [
      'I have crossed six kingdoms and fought a wyvern in a hailstorm. Nothing prepared me for Nan\'s stew.',
      'I came for one night. That was a fortnight ago.',
    ],
  });
  put(L, 'fenna', 'npc', 14.4, 10.3, {
    name: 'Fenna', preset: 'hunter', behaviour: 'post', wander: 0, facing: 'left', portraitColor: '#7fae6a',
    dialogue: [
      'Shh — I am listening to the fire. It pops in threes before rain.',
      'Two pops. Clear skies, then. Probably.',
    ],
  });
  // stores by the door, windows, torches
  put(L, 'crates', 'crateStack', 3.2, 10.7, { rotation: 0.1, opts: { count: 2, barrel: false, seed: 3 } });
  put(L, 'sacks', 'sacks', 15.3, 10.3, { rotation: -H, opts: { count: 3, seed: 6 } });
  put(L, 'window_w', 'wallWindow', 2, 7.4, { rotation: H, opts: { panes: 2, sill: 1.0, glow: 'warm', curtains: 'red' } });
  put(L, 'window_e', 'wallWindow', 16, 8.2, { rotation: -H, opts: { panes: 2, sill: 1.0, glow: 'warm', curtains: 'red', flowers: true } });
  put(L, 'torch_w', 'wallTorch', 2, 10.0, { rotation: H, dy: 2.1 });
  put(L, 'torch_e', 'wallTorch', 16, 5.2, { rotation: -H, dy: 2.1 });
  put(L, 'lamp_bar', 'light', 4.3, 4.8, { dy: 2.5, color: '#ffc27a', intensity: 6, distance: 7, flicker: 0.1, nightOnly: false });
  put(L, 'lamp_a', 'light', 9.0, 7.6, { dy: 2.4, color: '#ffc27a', intensity: 6, distance: 7, flicker: 0.15, nightOnly: false });
  put(L, 'lamp_b', 'light', 13.0, 7.8, { dy: 2.4, color: '#ffc27a', intensity: 5, distance: 7, flicker: 0.15, nightOnly: false });
  put(L, 'dog', 'critters', 7.6, 3.9, { kind: 'dog', count: 1, radius: 1.2 });
  roomRegion(L, 'The Ember & Oak', 'The Taproom');
  frontDoor(L, door, 'inn-door');
  return L;
}

function innUpstairs() {
  const L = roomLevel({
    name: 'The Ember & Oak', subtitle: 'The Guest Rooms',
    description: 'Above the taproom: three guest rooms off a landing, the stair down.',
    W: 18, D: 13, floor: 'P', legend: { P: PLANKS, W: wallTile('timber_frame', { top: 'plaster' }) }, door: null, timeOfDay: 16.8,
    // two partitions between the rooms (x 6–7 and 11–12, from the north wall to z 7)
    shape: (a, b) => ((a === 4 || a === 9) && b < 5 ? '+' : null),
  });
  // room one: a single bed, drawers, a window
  put(L, 'bed_1', 'bed', 3.0, 3.1, { opts: { width: 1.2, length: 2.2, blanket: 'blue', seed: 1 } });
  put(L, 'drawers_1', 'wardrobe', 5.2, 2.25, { opts: { kind: 'drawers', width: 1.2, seed: 2 } });
  put(L, 'window_1', 'wallWindow', 2, 5.6, { rotation: H, opts: { panes: 1, sill: 1.0, glow: 'warm', curtains: 'linen' } });
  put(L, 'rug_1', 'rug', 4.4, 5.4, { opts: { color: 'green', width: 1.5, length: 2, seed: 3 } });
  // room two: a double bed, a wardrobe, a window over the bed
  put(L, 'bed_2', 'bed', 9.6, 3.1, { opts: { width: 1.9, length: 2.2, blanket: 'green', seed: 4 } });
  put(L, 'wardrobe_2', 'wardrobe', 7.9, 2.3, { opts: { kind: 'wardrobe', width: 1.2, seed: 5 } });
  put(L, 'window_2', 'wallWindow', 9.6, 2, { opts: { panes: 2, sill: 1.4, glow: 'warm', curtains: 'red', beam: false } });
  put(L, 'chair_2', 'chair', 10.4, 5.6, { rotation: -0.4 });
  // room three, the landing: the stair down, books
  const down = put(L, 'stair_down', 'staircase', 14.4, 3.2, { opts: { dir: 'down', width: 1.2, steps: 5, seed: 6 } });
  stairLink(L, down, { to: 'inn', entrance: 'stairs', here: 'stairs', label: 'Go downstairs', facing: 'down' });
  put(L, 'shelf_3', 'shelf', 12.7, 2.25, { opts: { kind: 'books', width: 1.2, height: 1.8, seed: 7 } });
  // the corridor along the south: a runner rug, a little table
  put(L, 'runner', 'rug', 8.5, 9.4, { rotation: H, opts: { color: 'red', width: 1.4, length: 9, seed: 8 } });
  put(L, 'hall_table', 'table', 3.2, 9.6, { opts: { shape: 'round', width: 0.9, items: false, candle: true, seed: 9 } });
  put(L, 'window_e', 'wallWindow', 16, 9.4, { rotation: -H, opts: { panes: 2, sill: 1.0, glow: 'warm', curtains: 'red' } });
  // the guests
  put(L, 'ivo', 'npc', 9.0, 9.0, {
    name: 'Master Ivo', preset: 'scholar', wander: 1.4, speed: 0.6, portraitColor: '#a569b3',
    spec: { hair: 'hairBlack', beard: 'mustache', outfit: { top: '#3f5f5a', bottom: '#3f5f5a' } },
    dialogue: [
      'Master Ivo, cartographer. I am mapping every room in Emberfall. This corridor is eleven paces long. I have checked twice.',
      'The windmill is round inside, you know. Rounder than you would think.',
    ],
  });
  put(L, 'ada', 'npc', 4.3, 6.6, {
    name: 'Sister Ada', preset: 'cleric', behaviour: 'post', wander: 0, facing: 'down', portraitColor: '#e8e0c8',
    dialogue: ['A pilgrim, like me? The beds here are the softest between the mountains and the sea. I have tested many.'],
  });
  put(L, 'cat', 'critters', 4.0, 4.6, { kind: 'cat', count: 1, radius: 1.0 });
  for (const [id, x, z, intensity] of /** @type {[string, number, number, number][]} */ ([
    ['lamp_1', 4.2, 4.6, 5], ['lamp_2', 9.4, 4.8, 5], ['lamp_stairs', 14.2, 4.8, 5], ['lamp_hall', 8.0, 10.0, 3.5],
  ])) {
    put(L, id, 'light', x, z, { dy: 2.4, color: '#ffc27a', intensity, distance: 7, flicker: 0.1, nightOnly: false });
  }
  roomRegion(L, 'The Ember & Oak', 'The Guest Rooms');
  L.spawn = { x: 14.4, z: 5.4, facing: 'down' };
  return L;
}

// ---------------------------------------------------------------------------------------------
// The windmill: the millstone floor and the cap floor (octagonal rooms)
// ---------------------------------------------------------------------------------------------

/**
 * An octagon: the interior's corners cut by `n` tiles on the diagonal (the north corners full
 * height, the south ones as high as the south wall).
 * @param {number} n
 */
const octagon = (n) => (a, b, w, d) => {
  const na = Math.min(a, w - 1 - a);
  if (na + b < n) return '#';
  if (na + (d - 1 - b) < n) return '-';
  return null;
};

function windmillGround() {
  const door = /** @type {[number, number]} */ ([6, 8]);
  const L = roomLevel({
    name: 'The Windmill', subtitle: 'The Millstone Floor',
    description: 'Inside Emberfall\'s windmill: grain sacks, flour in the air, the stair up to the cap.',
    W: 14, D: 13, floor: 'S', legend: { S: FLAGS, W: wallTile('stone_brick', { lip: 'plaster', top: 'plaster' }) }, door, timeOfDay: 11.5,
    shape: octagon(2),
  });
  // (the octagon: straight walls x 4–10 on the north, z 4–10 on the west and east)
  const up = put(L, 'stair_up', 'staircase', 8.4, 2.6, { opts: { dir: 'up', width: 1.2, steps: 6, height: WALL_H, seed: 2 } });
  stairLink(L, up, { to: 'windmill-upper', entrance: 'stairs', here: 'stairs', label: 'Go upstairs', facing: 'down' });
  put(L, 'window_n', 'wallWindow', 4.9, 2, { opts: { panes: 1, sill: 1.1, glow: 'daylight', curtains: 'none' } });
  put(L, 'sacks_n', 'sacks', 4.6, 3.8, { opts: { count: 3, seed: 2 } });
  put(L, 'torch', 'wallTorch', 2, 4.6, { rotation: H, dy: 2.1 });
  put(L, 'sacks_w', 'sacks', 2.6, 6.2, { rotation: H, opts: { count: 4, seed: 1 } });
  put(L, 'shelf', 'shelf', 2.25, 8.4, { rotation: H, opts: { kind: 'pantry', width: 1.4, height: 1.6, seed: 5 } });
  put(L, 'barrel_2', 'barrel', 3.1, 9.6, { rotation: 0.1, opts: { height: 0.9 } });
  put(L, 'crates', 'crateStack', 10.7, 5.4, { rotation: -0.15, opts: { count: 2, barrel: false, seed: 4 } });
  put(L, 'barrel_1', 'barrel', 11.2, 7.1, { rotation: 0.4 });
  put(L, 'window_e', 'wallWindow', 12, 8.8, { rotation: -H, opts: { panes: 1, sill: 1.1, glow: 'daylight', curtains: 'none' } });
  put(L, 'sacks_e', 'sacks', 9.0, 10.4, { opts: { count: 2, seed: 3 } });
  put(L, 'miller', 'npc', 5.4, 6.8, {
    name: 'Miller Hesk', preset: 'villager', wander: 0.9, speed: 0.6, portraitColor: '#e0d0a0',
    spec: { hair: 'hairWhite', beard: 'mustache', hat: 'cap', hatColor: '#8a6a4a', outfit: { top: '#8a6a4a', bottom: '#5a3a24' }, gear: { apron: 'cream', boots: 'brown' } },
    dialogue: [
      'Flour in your hair already? That is the windmill saying hello.',
      'The sails turn, the stones grind, the bread rises. A simple life. A dusty one.',
    ],
  });
  put(L, 'flour', 'emitter', 7, 7, { preset: 'dust', size: [8, 2.4, 8], count: 26, dy: 1.3 });
  put(L, 'lamp', 'light', 8.8, 6.4, { dy: 2.6, color: '#ffd9a0', intensity: 5, distance: 9, flicker: 0.05, nightOnly: false });
  roomRegion(L, 'The Windmill', 'The Millstone Floor');
  frontDoor(L, door, 'windmill-door');
  return L;
}

function windmillUpper() {
  const L = roomLevel({
    name: 'The Windmill', subtitle: 'The Cap Floor',
    description: 'Under the windmill\'s cap: the wind in the sails, sacks waiting for the stones.',
    W: 13, D: 12, floor: 'P', legend: { P: PLANKS, W: wallTile('plaster') }, door: null, timeOfDay: 11.5,
    shape: octagon(2),
  });
  // (the octagon: straight walls x 4–9 on the north, z 4–9 on the west and east)
  const down = put(L, 'stair_down', 'staircase', 7.4, 3.2, { opts: { dir: 'down', width: 1.2, steps: 5, seed: 1 } });
  stairLink(L, down, { to: 'windmill', entrance: 'stairs', here: 'stairs', label: 'Go downstairs', facing: 'down' });
  put(L, 'window', 'wallWindow', 4.9, 2, { opts: { panes: 1, sill: 1.0, glow: 'daylight', curtains: 'none' } });
  put(L, 'window_e', 'wallWindow', 11, 6.9, { rotation: -H, opts: { panes: 1, sill: 1.0, glow: 'daylight', curtains: 'none' } });
  put(L, 'sacks_1', 'sacks', 2.6, 5.4, { rotation: H, opts: { count: 3, seed: 2 } });
  put(L, 'shelf', 'shelf', 2.25, 7.8, { rotation: H, opts: { kind: 'pantry', width: 1.2, height: 1.6, seed: 6 } });
  put(L, 'crates', 'crateStack', 9.8, 5.2, { rotation: 0.2, opts: { count: 2, barrel: false, seed: 4 } });
  put(L, 'barrel', 'barrel', 10.0, 7.4, { rotation: 0.3, opts: { lying: true } });
  put(L, 'sacks_2', 'sacks', 7.0, 9.6, { opts: { count: 4, seed: 3 } });
  put(L, 'workbench', 'table', 4.4, 9.4, { opts: { shape: 'rect', width: 1.2, depth: 0.7, items: true, seed: 5 } });
  put(L, 'tam', 'npc', 5.6, 6.6, {
    name: 'Tam', preset: 'child', wander: 1.0, speed: 1.0, portraitColor: '#e2b07a',
    spec: { hair: 'hairRed', hairStyle: 'short', outfit: { top: '#8a6a4a', bottom: '#4a4450' } },
    dialogue: [
      'I grease the gears! Miller Hesk says I have a gift for it. A sticky gift.',
      'Listen — that creak is the wind turning the cap. It means the weather is changing. Or that I missed a gear.',
    ],
  });
  put(L, 'lamp', 'light', 6.5, 6.4, { dy: 2.5, color: '#ffd9a0', intensity: 5, distance: 8, flicker: 0.05, nightOnly: false });
  put(L, 'birds', 'critters', 8.2, 7.6, { kind: 'bird', count: 2, radius: 1.0 });
  roomRegion(L, 'The Windmill', 'The Cap Floor');
  L.spawn = { x: 7.4, z: 5.4, facing: 'down' };
  return L;
}

// ---------------------------------------------------------------------------------------------
// Tobin's barn and its hayloft
// ---------------------------------------------------------------------------------------------

function barnGround() {
  const door = /** @type {[number, number]} */ ([7, 10]);
  const L = roomLevel({
    name: 'Tobin\'s Barn', subtitle: 'Hay and Patience',
    description: 'Tobin\'s barn: hay, sacks of feed, the chickens\' pen and the ladder stair to the hayloft.',
    W: 18, D: 13, floor: 'E', legend: { E: EARTH, h: STRAW, W: wallTile('log_wall', { top: 'roof_thatch' }) }, door, timeOfDay: 15.5,
    // straw spread on the earth floor
    shape: (a, b) => ((a < 5 && b > 2 && b < 7) || (a > 9 && b < 4) ? 'h' : null),
  });
  // the ladder stair up to the loft (north-west, rising west)
  const up = put(L, 'stair_up', 'staircase', 3.6, 2.45, { opts: { dir: 'up', width: 0.9, steps: 8, height: WALL_H, flip: true, seed: 1 } });
  stairLink(L, up, { to: 'barn-loft', entrance: 'stairs', here: 'stairs', label: 'Go upstairs', facing: 'down' });
  put(L, 'sacks_1', 'sacks', 8.2, 2.5, { opts: { count: 4, seed: 4 } });
  put(L, 'crates', 'crateStack', 10.4, 2.75, { rotation: 0, opts: { count: 2, barrel: false, seed: 5 } });
  put(L, 'hay_1', 'haystack', 3.3, 6.5, { opts: { size: 1.2, seed: 2 } });
  put(L, 'hay_2', 'haystack', 4.6, 8.7, { opts: { size: 0.9, seed: 3 } });
  put(L, 'barrel', 'barrel', 2.7, 10.5, { rotation: 0.2 });
  // the chickens' pen in the north-east (a gate in its south fence)
  put(L, 'pen_w', 'fence', 0, 0, { x0: 11.8, z0: 2.4, x1: 11.8, z1: 6.4, opts: { height: 0.8 } });
  put(L, 'pen_s1', 'fence', 0, 0, { x0: 11.8, z0: 6.4, x1: 13.2, z1: 6.4, opts: { height: 0.8 } });
  put(L, 'pen_s2', 'fence', 0, 0, { x0: 14.4, z0: 6.4, x1: 15.8, z1: 6.4, opts: { height: 0.8 } });
  put(L, 'hay_pen', 'haystack', 15.0, 3.0, { opts: { size: 0.8, seed: 7 } });
  put(L, 'chickens', 'critters', 14.0, 4.4, { kind: 'chicken', count: 4, radius: 1.6, area: { minX: -1.8, maxX: 1.6, minZ: -1.8, maxZ: 1.6 } });
  put(L, 'window_e', 'wallWindow', 16, 9.0, { rotation: -H, opts: { panes: 1, sill: 1.2, glow: 'daylight', curtains: 'none' } });
  put(L, 'sacks_2', 'sacks', 15.3, 10.8, { rotation: -H, opts: { count: 2, seed: 6 } });
  put(L, 'crate', 'crate', 13.4, 10.9, { rotation: 0.3 });
  put(L, 'hilde', 'npc', 9.0, 7.6, {
    name: 'Hilde', preset: 'farmer', wander: 1.2, speed: 0.8, portraitColor: '#c9a45c',
    spec: { female: true, hairStyle: 'ponytail', hair: 'hairRed', blush: true },
    dialogue: [
      'Hilde, farmhand. Tobin pays me in eggs and advice. Mostly advice.',
      'The cow is out in the paddock. She prefers it to company. I understand her.',
    ],
  });
  put(L, 'cat', 'critters', 5.8, 10.4, { kind: 'cat', count: 1, radius: 1.4 });
  put(L, 'hay_dust', 'emitter', 9, 6.5, { preset: 'dust', size: [12, 2.4, 8], count: 22, dy: 1.3 });
  put(L, 'lamp_stair', 'light', 5.4, 3.9, { dy: 2.5, color: '#ffc27a', intensity: 5, distance: 8, flicker: 0.1, nightOnly: false });
  put(L, 'lamp_pen', 'light', 12.6, 6.8, { dy: 2.5, color: '#ffc27a', intensity: 4, distance: 8, flicker: 0.1, nightOnly: false });
  put(L, 'lamp_door', 'light', 8.6, 9.6, { dy: 2.5, color: '#ffc27a', intensity: 4, distance: 8, flicker: 0.1, nightOnly: false });
  roomRegion(L, 'Tobin\'s Barn', 'Tobin\'s Farm');
  frontDoor(L, door, 'barn-door');
  return L;
}

function barnLoft() {
  const L = roomLevel({
    name: 'Tobin\'s Barn', subtitle: 'The Hayloft',
    description: 'The hayloft over Tobin\'s barn: hay to the rafters, a hatch for the hay, a cat in charge.',
    W: 16, D: 11, floor: 'P', legend: { P: PLANKS, h: STRAW, W: wallTile('log_wall', { top: 'roof_thatch' }) }, door: null, timeOfDay: 15.5,
    shape: (a, b, w) => (a > w - 6 || b > 5 ? 'h' : null),
  });
  const down = put(L, 'stair_down', 'staircase', 4.4, 3.0, { opts: { dir: 'down', width: 0.9, steps: 4, seed: 1 } });
  stairLink(L, down, { to: 'barn', entrance: 'stairs', here: 'stairs', label: 'Go downstairs', facing: 'down' });
  put(L, 'hay_1', 'haystack', 11.6, 3.6, { opts: { size: 1.3, seed: 2 } });
  put(L, 'hay_2', 'haystack', 12.6, 6.4, { opts: { size: 1.1, seed: 3 } });
  put(L, 'hay_3', 'haystack', 8.4, 2.9, { opts: { size: 0.8, seed: 4 } });
  put(L, 'sacks', 'sacks', 2.6, 6.6, { rotation: H, opts: { count: 3, seed: 5 } });
  put(L, 'crate', 'crate', 6.6, 2.6, { rotation: 0.2 });
  put(L, 'hatch', 'wallWindow', 14, 7.6, { rotation: -H, opts: { panes: 2, sill: 0.6, glow: 'daylight', curtains: 'none' } });
  put(L, 'wendel', 'npc', 7.6, 7.0, {
    name: 'Wendel', preset: 'merchant', behaviour: 'post', wander: 0, facing: 'down', portraitColor: '#a0703f',
    spec: { hat: 'cap', hatColor: '#5a6b82', beard: 'full', hair: 'hairBlack' },
    dialogue: [
      'Mm? Oh. Wendel, tinker. Tobin lets me sleep up here when the inn is full, if I mend his pots.',
      'The hay smells of summer. Don\'t tell Rosalind, but it is better than her mattresses.',
    ],
  });
  put(L, 'cats', 'critters', 10.6, 7.4, { kind: 'cat', count: 2, radius: 1.6 });
  put(L, 'birds', 'critters', 5.6, 8.6, { kind: 'bird', count: 3, radius: 1.4 });
  put(L, 'lamp_stair', 'light', 5.0, 4.6, { dy: 2.4, color: '#ffc27a', intensity: 5, distance: 8, flicker: 0.1, nightOnly: false });
  put(L, 'lamp_hay', 'light', 10.4, 6.0, { dy: 2.4, color: '#ffc27a', intensity: 4, distance: 8, flicker: 0.1, nightOnly: false });
  roomRegion(L, 'Tobin\'s Barn', 'The Hayloft');
  L.spawn = { x: 4.4, z: 5.2, facing: 'down' };
  return L;
}

// ---------------------------------------------------------------------------------------------
// The houses
// ---------------------------------------------------------------------------------------------

function elderHouse() {
  const door = /** @type {[number, number]} */ ([7, 9]);
  const L = roomLevel({
    name: 'Elder\'s Cottage', subtitle: 'Books by the Fire',
    description: 'Elder Maren\'s cottage: shelves of books, a hearth, a neat bed — and her apprentice, reading.',
    W: 16, D: 12, floor: 'P', legend: { P: PLANKS, W: wallTile('stone_brick') }, door, timeOfDay: 16.5,
  });
  put(L, 'shelf_1', 'shelf', 3.4, 2.25, { opts: { kind: 'books', width: 2.4, height: 2.6, seed: 1 } });
  put(L, 'shelf_2', 'shelf', 5.8, 2.25, { opts: { kind: 'books', width: 1.6, height: 2.6, seed: 2 } });
  put(L, 'hearth', 'hearth', 9.0, 2.5, { opts: { width: 2.2, height: WALL_H, lit: true, seed: 3 } });
  put(L, 'bed', 'bed', 12.8, 3.1, { opts: { width: 1.2, length: 2.2, blanket: 'plum', seed: 4 } });
  put(L, 'drawers', 'wardrobe', 13.75, 5.9, { rotation: -H, opts: { kind: 'drawers', width: 1.2, seed: 5 } });
  put(L, 'shelf_w', 'shelf', 2.25, 6.0, { rotation: H, opts: { kind: 'books', width: 1.8, height: 1.4, seed: 6 } });
  put(L, 'rug', 'rug', 7.0, 7.0, { rotation: H, opts: { color: 'green', width: 2.5, length: 3.6, seed: 7 } });
  put(L, 'table', 'table', 7.0, 7.0, { opts: { shape: 'rect', width: 1.6, depth: 0.9, cloth: true, items: true, candle: true, seed: 8 } });
  put(L, '', 'chair', 6.5, 6.25, { rotation: 0 });
  put(L, '', 'chair', 5.9, 7.0, { rotation: H });
  put(L, '', 'chair', 8.1, 7.0, { rotation: -H });
  put(L, 'reading_chair', 'chair', 10.9, 4.2, { rotation: -0.5 });
  put(L, 'window_e', 'wallWindow', 14, 8.6, { rotation: -H, opts: { panes: 1, sill: 1.0, glow: 'warm', curtains: 'linen', flowers: true } });
  put(L, 'window_w', 'wallWindow', 2, 8.6, { rotation: H, opts: { panes: 1, sill: 1.0, glow: 'warm', curtains: 'linen' } });
  put(L, 'linden', 'npc', 4.6, 4.2, {
    name: 'Linden', preset: 'scholar', wander: 0.8, speed: 0.6, facing: 'up', portraitColor: '#7fa0c9',
    spec: { hair: 'hairBrown', beard: false, outfit: { top: '#3f5f88', bottom: '#3f5f88' } },
    dialogue: [
      'The elder\'s apprentice, at your service. She is out on the square, teaching the cobbles patience.',
      'Every book on these shelves has a pressed leaf in it. She says the leaves remember the year better than the ink.',
    ],
  });
  put(L, 'cat', 'critters', 9.2, 4.6, { kind: 'cat', count: 1, radius: 1.2 });
  put(L, 'candle_glow', 'light', 7.0, 7.4, { dy: 2.4, color: '#ffc27a', intensity: 2.5, distance: 6, flicker: 0.2, nightOnly: false });
  put(L, 'lamp', 'light', 4.6, 5.0, { dy: 2.5, color: '#ffd9a0', intensity: 4, distance: 7, flicker: 0.05, nightOnly: false });
  roomRegion(L, 'Elder\'s Cottage', 'Emberfall');
  frontDoor(L, door, 'elder-door');
  return L;
}

function riversideHouse() {
  const door = /** @type {[number, number]} */ ([7, 9]);
  const L = roomLevel({
    name: 'Riverside House', subtitle: 'The Kettle Sings',
    description: 'A brick house by the river: a stone-flagged kitchen with its hearth and pantry, a bed behind a half wall.',
    W: 16, D: 12, floor: 'P', legend: { P: PLANKS, S: FLAGS, W: wallTile('brick') }, door, timeOfDay: 9.5,
    // the kitchen's flagstones (west), a half wall between it and the bed
    shape: (a, b) => (a === 7 && b < 4 ? '=' : a < 7 ? 'S' : null),
  });
  put(L, 'hearth', 'hearth', 4.4, 2.5, { opts: { width: 2.2, height: WALL_H, lit: true, pot: true, seed: 1 } });
  put(L, 'pantry', 'shelf', 7.4, 2.25, { opts: { kind: 'pantry', width: 1.6, height: 2.2, seed: 2 } });
  put(L, 'table', 'table', 5.0, 6.8, { opts: { shape: 'rect', width: 1.4, depth: 0.9, items: true, seed: 3 } });
  put(L, '', 'chair', 4.6, 6.05, { rotation: 0 });
  put(L, '', 'chair', 3.9, 6.8, { rotation: H });
  put(L, 'sacks', 'sacks', 2.6, 9.2, { rotation: H, opts: { count: 2, seed: 4 } });
  put(L, 'barrel', 'barrel', 2.7, 4.2, { rotation: 0.3, opts: { height: 0.9 } });
  put(L, 'bed', 'bed', 12.2, 3.1, { opts: { width: 1.6, length: 2.2, blanket: 'blue', seed: 5 } });
  put(L, 'drawers', 'wardrobe', 13.75, 6.2, { rotation: -H, opts: { kind: 'drawers', width: 1.2, seed: 6 } });
  put(L, 'rug', 'rug', 11.8, 7.4, { opts: { color: 'blue', width: 2, length: 2.6, seed: 7 } });
  put(L, 'window_e', 'wallWindow', 14, 8.8, { rotation: -H, opts: { panes: 1, sill: 1.0, glow: 'daylight', curtains: 'linen', flowers: true } });
  put(L, 'window_n', 'wallWindow', 10.0, 2, { opts: { panes: 1, sill: 1.2, glow: 'daylight', curtains: 'linen' } });
  put(L, 'bryony', 'npc', 5.8, 4.0, {
    name: 'Auntie Bryony', preset: 'innkeeper', wander: 0.7, speed: 0.6, portraitColor: '#9bb8f2',
    spec: { hair: 'hairWhite', outfit: { top: '#3f5f88', bottom: '#5a6b82' } },
    dialogue: [
      'There\'s the kettle singing! Sit, sit. Everyone who knocks gets a cup, and you didn\'t even knock.',
      'The river talks all night under the floor. You get used to it. Then you can\'t sleep anywhere quiet.',
    ],
  });
  put(L, 'lamp', 'light', 11.6, 6.0, { dy: 2.4, color: '#ffd9a0', intensity: 4, distance: 7, flicker: 0.05, nightOnly: false });
  roomRegion(L, 'Riverside House', 'Emberfall');
  frontDoor(L, door, 'riverside-door');
  return L;
}

function thatchCottage() {
  const door = /** @type {[number, number]} */ ([6, 8]);
  const L = roomLevel({
    name: 'Thatched Cottage', subtitle: 'Fresh Bread',
    description: 'One cosy room under the thatch: the hearth, a bed, a table set for bread.',
    W: 14, D: 11, floor: 'P', legend: { P: PLANKS, W: wallTile('plaster') }, door, timeOfDay: 8.5,
  });
  put(L, 'hearth', 'hearth', 4.2, 2.5, { opts: { width: 2.0, height: WALL_H, lit: true, seed: 1 } });
  put(L, 'window', 'wallWindow', 7.2, 2, { opts: { panes: 2, sill: 1.0, glow: 'daylight', curtains: 'red', flowers: true } });
  put(L, 'bed', 'bed', 10.6, 3.1, { opts: { width: 1.2, length: 2.2, blanket: 'ochre', seed: 2 } });
  put(L, 'wardrobe', 'wardrobe', 2.3, 6.4, { rotation: H, opts: { kind: 'wardrobe', width: 1.2, seed: 3 } });
  put(L, 'drawers', 'wardrobe', 11.75, 6.0, { rotation: -H, opts: { kind: 'drawers', width: 1.0, seed: 4 } });
  put(L, 'rug', 'rug', 6.8, 6.4, { opts: { color: 'red', width: 2.4, length: 2.4, seed: 5 } });
  put(L, 'table', 'table', 6.8, 6.4, { opts: { shape: 'round', width: 1.2, items: true, candle: true, seed: 6 } });
  put(L, '', 'chair', 5.8, 6.4, { rotation: H });
  put(L, '', 'chair', 7.8, 6.4, { rotation: -H });
  put(L, 'shelf', 'shelf', 11.75, 8.6, { rotation: -H, opts: { kind: 'pantry', width: 1.2, height: 1.4, seed: 7 } });
  put(L, 'posy', 'npc', 8.6, 4.4, {
    name: 'Posy', preset: 'villager', wander: 0.8, speed: 0.7, portraitColor: '#f5a9c2',
    spec: { female: true, hairStyle: 'bun', hair: 'hairBlonde', blush: true, outfit: { top: '#d9776a', bottom: '#6e3a3a', style: 'dress' }, gear: { apron: 'cream', boots: 'brown' } },
    dialogue: [
      'You followed the bread, didn\'t you? Everyone follows the bread.',
      'Take a heel of the loaf, the crusty end. It is the best part and nobody else knows it.',
    ],
  });
  put(L, 'cat', 'critters', 4.4, 4.4, { kind: 'cat', count: 1, radius: 1.0 });
  put(L, 'lamp', 'light', 7.0, 5.2, { dy: 2.4, color: '#ffd9a0', intensity: 4, distance: 7, flicker: 0.05, nightOnly: false });
  roomRegion(L, 'Thatched Cottage', 'Emberfall');
  frontDoor(L, door, 'cottage-door');
  return L;
}

function lodge() {
  const door = /** @type {[number, number]} */ ([7, 9]);
  const L = roomLevel({
    name: 'Woodcutter\'s Lodge', subtitle: 'A Song About Axes',
    description: 'The woodcutter\'s lodge on the edge of Amberleaf Grove: a big hearth, firewood stacked high, two beds.',
    W: 16, D: 11, floor: 'P', legend: { P: PLANKS, W: wallTile('timber_frame', { top: 'plaster' }) }, door, timeOfDay: 17.0,
  });
  put(L, 'hearth', 'hearth', 5.0, 2.5, { opts: { width: 2.6, height: WALL_H, lit: true, seed: 1 } });
  put(L, 'pantry', 'shelf', 8.2, 2.25, { opts: { kind: 'pantry', width: 1.4, height: 1.8, seed: 2 } });
  put(L, 'bed', 'bed', 12.8, 3.1, { opts: { width: 1.3, length: 2.2, blanket: 'green', seed: 3 } });
  put(L, 'bed_kit', 'bed', 10.5, 2.95, { opts: { width: 1.0, length: 1.9, blanket: 'red', seed: 4 } });
  put(L, 'wardrobe', 'wardrobe', 13.7, 6.2, { rotation: -H, opts: { kind: 'wardrobe', width: 1.2, seed: 5 } });
  put(L, 'firewood_1', 'crateStack', 3.6, 8.8, { rotation: 0.1, opts: { count: 3, barrel: false, seed: 6 } });
  put(L, 'sacks', 'sacks', 2.6, 5.6, { rotation: H, opts: { count: 4, seed: 7 } });
  put(L, 'table', 'table', 7.6, 6.4, { opts: { shape: 'rect', width: 1.6, depth: 0.9, items: true, seed: 8 } });
  put(L, '', 'chair', 7.1, 5.65, { rotation: 0 });
  put(L, '', 'chair', 8.1, 5.65, { rotation: 0 });
  put(L, '', 'chair', 8.7, 6.4, { rotation: -H, opts: { style: 'stool' } });
  put(L, 'rug', 'rug', 7.6, 6.4, { rotation: H, opts: { color: 'red', width: 2.4, length: 3.4, seed: 9 } });
  put(L, 'barrel', 'barrel', 13.2, 8.6, { rotation: 0.5 });
  put(L, 'window_e', 'wallWindow', 14, 8.8, { rotation: -H, opts: { panes: 1, sill: 1.0, glow: 'warm', curtains: 'red' } });
  put(L, 'rowan', 'npc', 5.6, 4.4, {
    name: 'Rowan', preset: 'villager', wander: 0.8, speed: 0.7, portraitColor: '#b07b44',
    spec: { beard: 'full', hair: 'hairRed', outfit: { top: '#8c2330', bottom: '#3f4a36', style: 'tunic' }, gear: { boots: 'black', gloves: 'brown' } },
    dialogue: [
      '♪ Oh the axe is sharp and the oak is tall, and the tea is hot when the chips all fall ♪',
      'Hm? Yes, I wrote it. Twelve verses. Kit knows them all. Kit is sick of them all.',
    ],
  });
  put(L, 'kit', 'npc', 10.0, 7.6, {
    name: 'Kit', preset: 'child', wander: 1.4, speed: 1.4, portraitColor: '#e27aa8',
    spec: { hair: 'hairRed', hairStyle: 'spiky', blush: false, outfit: { top: '#3f7a3c', bottom: '#5a3a24' } },
    dialogue: [
      'I\'m going to be a woodcutter too. I\'ve already cut down a dandelion.',
      'Dad says the grove turns amber because the trees are shy. I think they\'re just cold.',
    ],
  });
  put(L, 'dog', 'critters', 4.6, 7.0, { kind: 'dog', count: 1, radius: 1.2 });
  put(L, 'lamp', 'light', 8.0, 5.6, { dy: 2.4, color: '#ffc27a', intensity: 4, distance: 7, flicker: 0.1, nightOnly: false });
  roomRegion(L, 'Woodcutter\'s Lodge', 'Amberleaf Grove');
  frontDoor(L, door, 'lodge-door');
  return L;
}

/**
 * Props whose collider reaches into a wall or partition tile (any tile above the floor): a
 * furniture piece, crate stack or barrel clipping through the wall. The colliders are the level
 * checks' (`collidersOf`, the builders' footprints), sampled every 0.1 inside a 0.03 margin, so a
 * wall piece flush with its wall passes.
 * @param {Level} level
 * @returns {string[]}
 */
function wallClips(level) {
  const g = gridFromLevel(level);
  const P = placerFromLevel(g, level);
  const out = [];
  const raised = (x, z) => {
    const i = Math.floor(x);
    const j = Math.floor(z);
    if (i < 0 || j < 0 || i >= level.width || j >= level.depth) return true;
    return level.heights[j][i] !== levelToChar(FLOOR);
  };
  for (const o of level.objects) {
    if (OBJECT_TYPES[o.type].kind !== 'prop') continue;
    for (const c of P.collidersOf(o)) {
      const pts = [];
      if (c.c === 'box') {
        for (let x = c.minX + 0.03; x <= c.maxX - 0.03 + 1e-9; x += Math.min(0.1, (c.maxX - c.minX - 0.06) || 0.1)) {
          for (let z = c.minZ + 0.03; z <= c.maxZ - 0.03 + 1e-9; z += Math.min(0.1, (c.maxZ - c.minZ - 0.06) || 0.1)) pts.push([x, z]);
        }
      } else if (c.c === 'circle') {
        for (let a = 0; a < 16; a++) pts.push([c.x + Math.cos(a * Math.PI / 8) * (c.r - 0.03), c.z + Math.sin(a * Math.PI / 8) * (c.r - 0.03)]);
      } else if (c.c === 'seg') {
        for (let t = 0; t <= 1; t += 0.05) pts.push([c.x0 + (c.x1 - c.x0) * t, c.z0 + (c.z1 - c.z0) * t]);
      }
      const hit = pts.find(([x, z]) => raised(x, z));
      if (hit) out.push(`${o.type} ${o.id} reaches into a wall at (${hit[0].toFixed(2)}, ${hit[1].toFixed(2)})`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// The campaign
// ---------------------------------------------------------------------------------------------

const campaignRaw = {
  format: CAMPAIGN_FORMAT,
  version: 1,
  name: 'Emberfall — Open Doors',
  subtitle: 'A Luminati campaign',
  title: { title: 'EMBERFALL', subtitle: 'Open Doors — every house has a room behind its door', prompt: 'Press any key', credit: 'Luminati 2.5D Pixel-Art Engine · three.js' },
  start: { level: 'emberfall', entrance: '' },
  levels: [
    { id: 'emberfall', at: [0, 0] },
    { id: 'inn' }, { id: 'inn-upstairs' },
    { id: 'windmill' }, { id: 'windmill-upper' },
    { id: 'barn' }, { id: 'barn-loft' },
    { id: 'elder-house' }, { id: 'riverside-house' }, { id: 'thatch-cottage' }, { id: 'lodge' },
  ],
};

/** @type {[id: string, level: Level, canonical: boolean][]} */
const built = [
  ['emberfall', town(), false],
  ['inn', innTaproom(), true],
  ['inn-upstairs', innUpstairs(), true],
  ['windmill', windmillGround(), true],
  ['windmill-upper', windmillUpper(), true],
  ['barn', barnGround(), true],
  ['barn-loft', barnLoft(), true],
  ['elder-house', elderHouse(), true],
  ['riverside-house', riversideHouse(), true],
  ['thatch-cottage', thatchCottage(), true],
  ['lodge', lodge(), true],
];

// ---- normalise, serialise, check ----
const problems = [];
/** @type {Map<string, string>} file → text */
const texts = new Map();
/** @type {Map<string, Level>} */
const levels = new Map();
const DIR = `public/campaigns/${NAME}`;
for (const [id, raw, canonical] of built) {
  const { level, warnings } = normalizeLevel(raw);
  // (the town keeps Emberfall's own key order; only the objects added here are canonical)
  if (canonical) level.objects = level.objects.map((o) => /** @type {LevelObject} */ (canonicalObject(o)));
  else level.objects = level.objects.map((o) => (o.type === 'exit' || o.type === 'entrance' ? /** @type {LevelObject} */ (canonicalObject(o)) : o));
  // the content-text keys (docs/specs/I18N.md §4.10): a room's carried from the current file at its
  // default path (never --out), new ones seeded by the file and the text; the town's are Emberfall's
  if (canonical) keyLevel(level, { root, file: `${DIR}/${levelFile(id)}` });
  const errs = [...validateLevel(level), ...keyIssueLines(level).map((m) => (canonical ? m : `${m} (the town's texts are Emberfall's: npm run i18n:keys -- --assign public/levels/emberfall.json)`))];
  const text = serializeLevel(level);
  if (serializeLevel(parseLevel(text).level) !== text) errs.push('does not re-serialise byte-identically');
  for (const m of [...warnings, ...errs]) problems.push(`${id}: ${m}`);
  texts.set(levelFile(id), text);
  levels.set(id, parseLevel(text).level);
}

// the town is Emberfall: every tile, height, the environment and every object but the doors' text
{
  const ember = parseLevel(fs.readFileSync(path.join(root, 'public/levels/emberfall.json'), 'utf8')).level;
  const t = levels.get('emberfall');
  for (const k of ['name', 'width', 'depth', 'waterLevel', 'water', 'environment', 'spawn', 'legend', 'tiles', 'heights']) {
    if (JSON.stringify(t[k]) !== JSON.stringify(ember[k])) problems.push(`emberfall: ${k} differs from public/levels/emberfall.json`);
  }
  const opened = new Set(DOORS.map((d) => d.house));
  const own = t.objects.filter((o) => o.type !== 'exit' && o.type !== 'entrance');
  if (own.length !== ember.objects.length) problems.push('emberfall: the objects differ from public/levels/emberfall.json');
  for (const [k, o] of ember.objects.entries()) {
    // (an opened house: the same object with an empty Knock text and no key for it)
    const expect = opened.has(o.id) && o.type === 'house' ? structuredClone(o) : o;
    if (expect !== o) clearKnock(expect);
    if (JSON.stringify(own[k]) !== JSON.stringify(expect)) problems.push(`emberfall: object ${o.id} differs from public/levels/emberfall.json`);
  }
}

// coverage: the rooms place every interior furniture type (a new one fails here until a room
// places it), both staircase directions, the wardrobe's two kinds and the shelf's two kinds
const rooms = [...levels.entries()].filter(([id]) => id !== 'emberfall').map(([, l]) => l);
const all = rooms.flatMap((l) => l.objects);
for (const type of Object.keys(OBJECT_TYPES).filter(isInteriorType)) {
  if (!all.some((o) => o.type === type)) problems.push(`coverage: no "${type}" object in the rooms`);
}
for (const [what, test] of /** @type {[string, (o: any) => boolean][]} */ ([
  ['a staircase up', (o) => o.type === 'staircase' && o.opts?.dir === 'up'], ['a staircase down', (o) => o.type === 'staircase' && o.opts?.dir === 'down'],
  ['a wardrobe', (o) => o.type === 'wardrobe' && o.opts?.kind === 'wardrobe'], ['a chest of drawers', (o) => o.type === 'wardrobe' && o.opts?.kind === 'drawers'],
  ['a bookshelf', (o) => o.type === 'shelf' && o.opts?.kind === 'books'], ['a pantry shelf', (o) => o.type === 'shelf' && o.opts?.kind === 'pantry'],
  ['a bar counter', (o) => o.type === 'counter' && o.opts?.style === 'bar'], ['a round table', (o) => o.type === 'table' && o.opts?.shape === 'round'],
  ['a rect table', (o) => o.type === 'table' && o.opts?.shape === 'rect'], ['a stool', (o) => o.type === 'chair' && o.opts?.style === 'stool'],
  ['a lit hearth', (o) => o.type === 'hearth' && o.opts?.lit === true],
])) if (!all.some(test)) problems.push(`coverage: no ${what} in the rooms`);
// every room: a room, ≤ 12 light descriptors, nothing standing in a wall
for (const [id, l] of levels) {
  if (id === 'emberfall') continue;
  for (const m of wallClips(l)) problems.push(`${id}: ${m}`);
  if (l.environment.interior !== true) problems.push(`${id}: not a room (environment.interior)`);
  const lights = l.objects.filter((o) => o.type === 'light' || o.type === 'wallTorch' || o.type === 'campfire' || o.type === 'lamppost' || (o.type === 'hearth' && o.opts?.lit) || (o.type === 'house' && o.light)).length;
  if (lights > 12) problems.push(`${id}: ${lights} light descriptors (at most 12)`);
}

// campaign.json's keys: carried from the current file, new ones seeded by the file and the text
const campaignKeyed = structuredClone(campaignRaw);
carryCampaignText(previousOutput(root, `${DIR}/campaign.json`), campaignKeyed, seededMint(`${DIR}/campaign.json`));
for (const i of fileKeyIssues('campaign', campaignKeyed)) problems.push(`campaign.json: text keys: ${i.where}: ${i.msg}`);
const { campaign, warnings: cw, errors: ce } = normalizeCampaign(campaignKeyed);
problems.push(...cw.map((m) => `campaign.json: ${m}`), ...ce.map((m) => `campaign.json: ${m}`));
texts.set('campaign.json', serializeCampaign(campaign));

const report = checkCampaign(campaign, (id) => (levels.has(id) ? { level: levels.get(id), warnings: [] } : null), { strict: false });
let nErr = problems.length + report.errors.length;
// (the town's own composition warnings are Emberfall's: listed with --verbose)
let townWarnings = 0;
for (const [id, r] of report.levels) {
  nErr += r.report.errors.length;
  for (const m of r.report.errors) problems.push(`${id}: ✗ ${m}`);
  for (const m of r.report.warnings) {
    if (id === 'emberfall' && !args.verbose) { townWarnings++; continue; }
    log(`  ${id}: ! ${m}`);
  }
}
if (townWarnings) log(`  emberfall: ${townWarnings} warning(s) of Emberfall's own (--verbose lists them)`);
for (const m of report.info) log(`  · ${m}`);
for (const m of report.warnings) log(`  ! ${m}`);
for (const m of [...problems, ...report.errors]) console.error(`  ✗ ${m}`);
log(`check: ${nErr} error(s), ${report.warnings.length + [...report.levels.values()].reduce((n, r) => n + r.report.warnings.length, 0)} warning(s)`);

const rel = path.relative(root, OUT) || '.';
if (args.check) {
  let differ = 0;
  for (const [file, text] of texts) {
    const f = path.join(OUT, file);
    const old = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : null;
    if (old !== text) { differ++; console.error(`${path.join(rel, file)} ${old == null ? 'does not exist' : 'differs from the generator output'}`); }
  }
  if (differ || nErr) process.exit(1);
  console.log(`${rel}: all ${texts.size} files are up to date (byte-identical).`);
  process.exit(0);
}
if (nErr && !args.force) {
  console.error(`not written: ${nErr} error(s) (--force writes anyway)`);
  process.exit(1);
}
for (const [file, text] of texts) {
  const f = path.join(OUT, file);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
}
console.log(`Emberfall — Open Doors → ${rel}: ${texts.size} files (${[...levels.entries()].map(([id, l]) => `${id} ${l.width}×${l.depth}`).join(', ')})`);
