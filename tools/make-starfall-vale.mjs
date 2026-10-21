#!/usr/bin/env node
/**
 * Builds the flagship 128 × 128 demo level `public/levels/starfall-vale.json` — **Starfall Vale,
 * "Where the Stars Come Home"** — deterministically (seeded RNG, no Math.random) with the
 * LevelFormat / ObjectCatalog helpers, then validates it and prints stats and a report.
 *
 *   node tools/make-starfall-vale.mjs [--out=public/levels/starfall-vale.json] [--check] [--ascii] [--quiet] [--force]
 *     --check  write nothing; exit 1 unless the output matches the --out file byte for byte (CRLF
 *              line endings count as identical: the repository stores the file with LF)
 *     --force  write the level even when checks fail (for inspection only; the exit code is still 1)
 *   play it: game.html?level=starfall-vale   ·   edit it: editor.html?open=starfall-vale
 *
 * Every text carries its content-text key (`textKeys`, docs/specs/I18N.md §4.10): carried from the
 * current file at the default path (never --out), a new text's minted from the file and the text.
 *
 * Structure (each step is one function below, run in this order):
 *
 *   1. Terrain — layered passes over a tile / level grid:
 *        relief()     base plain, Mount Lumen's three tiers (foothills → terrace → plateau), the
 *                     observatory knoll, the quarry upland and its pit, the NE highland, knolls,
 *                     the Emberwood ridges and the sunken glade
 *        water()      the Silverrun (spring, streams, plunge pools, the river through Hearthwick),
 *                     Lake Mirrormere with its island, beaches and the Mirror Falls stream, ponds
 *        paths()      roads and trails as polylines with widths (cobbles in town, dirt outside)
 *        stairs()     every stair flight where a path climbs a cliff (all four orientations)
 *        ground()     ground variety: grass shades, flower meadows, farmland plots, dirt yards,
 *                     moss and rock outcrops, stone floors of the ruins, the hamlet's decks
 *        border()     the blocked forest border ('T') and the deep-forest patches
 *   2. Objects — every placement goes through `add()`, which reserves the prop's approximate
 *      TileMap colliders (the PropFactory's own shapes) in a spatial hash:
 *        hearthwick(), goldenfield(), mountLumen(), oldQuarry(), mirrormere(), amberpine(),
 *        meadowlands(), emberwood()   hand-placed landmarks, buildings, bridges, falls, lights,
 *                                     props, critters and particle areas, area by area
 *        people()        the 29 villagers and their Starfall Festival dialogue
 *        extras()        outlying homesteads, hedgerows, roadside lamps, milestones, pastures
 *        sightlines()    places the camera must see (villagers, doors, landmarks): no tall
 *                        scattered tree just south of them (the camera looks north)
 *        scatterTrees(), scatterRocks()   rule-based scatter per zone (density, kinds, heights)
 *                        clear of paths, water, stairs, doors, NPC spots and every footprint
 *        dressHouses()   barrels, crates and flower boxes against the walls of every home
 *        clearCrowns()   drops the scattered trees whose crowns (modelled as Trees.js builds
 *                        them) would hide a quarter or more of a villager, the spot you talk to
 *                        one from, a door front, a sign or its reading spot, a well or a campfire
 *                        (after every seeded placement, so nothing else moves)
 *        regions()       HUD location names, small places first (first match wins)
 *   3. Environment — time, camera, high ground, title + title camera, god-ray areas, foliage zones,
 *      forest kind areas (the border / outer woods by region) and the open meadow south of the map.
 *   4. Validation — normalizeLevel / validateLevel (zero warnings) and validate(): a walk BFS from
 *      the spawn on a quarter-unit grid with the game's movement rules (walkable tiles and bridge
 *      decks, step height ≤ 0.55, stair ramps, player radius 0.3 against the approximate prop
 *      colliders); reachability of every NPC, door, sign, well and region; paths not blocked by
 *      props; every bridge / pier walkable end to end; stairs rising toward the higher side;
 *      waterfalls on a tile edge with a real drop; bridges spanning water; props on flat, dry
 *      ground; no overlapping props; doors clear; ROUTES — walks the signposts promise and every
 *      named crossing (bridge, stair flight) stay direct (≤ 1.5 × the straight line + 3 on the walk
 *      grid, so a closed alley or a missing bridge fails even when the far side is reachable the
 *      long way round); roads over water run on a bridge deck; only the island may be an
 *      unreachable pocket; the camera (looking north) sees every villager, door, sign, well and
 *      campfire past the houses, well roofs and the windmill, no hand-placed tree stands in a
 *      sightline and no tree crown hides half of one of them (or of the spot the traveller talks
 *      or reads from); critters start on
 *      walkable ground, chase areas are walkable, wall torches hang on a wall, every object and
 *      area lies on the map; normalizeLevel changes nothing; a byte-stable save round trip; and
 *      the feature coverage checklist (coverage()). Any failure exits with code 1 and writes
 *      nothing (--force writes it anyway and still exits with code 1).
 *
 * Custom legend chars (the format allows them): 'e' = river flowing east (flow [0.45, 0]) for the
 * Silverrun's run to the lake, ':' = the King's Road beyond the border (a dirt path, not walkable).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEVEL_FORMAT, LEVEL_VERSION, TILE_TYPES, defaultLegend, normalizeLevel, validateLevel, serializeLevel, levelStats,
  levelToChar, charToLevel,
} from '../src/engine/level/LevelFormat.js';
import {
  OBJECT_TYPES, createObject, NPC_ACTIONS, NPC_BEHAVIOURS, CRITTER_KINDS, EMITTER_PRESETS, CHARACTER_PRESET_NAMES,
  critterStartPoints, isCombatType, isCampaignType, isStoryType, isInteriorType,
} from '../src/engine/level/ObjectCatalog.js';
import { RNG, fbm2, hash2, clamp, lerp } from '../src/engine/utils/math.js';
// (only the content-text keys come from the shared helpers: the level itself stays this file's own)
import { keyLevel, keyIssueLines } from './lib/levelgen.mjs';

/** @import { LevelObject, ObjectType, XZ } from '../src/engine/level/types.js' */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
const OUT = path.resolve(root, String(args.out ?? 'public/levels/starfall-vale.json'));
const log = args.quiet ? () => {} : (...a) => console.log(...a);

// =============================================================================================
// Grid
// =============================================================================================

const W = 128;
const D = 128;
/** Terrain levels (world y = level × 0.5). */
const LV = { LAKE: 0, SHORE: 1, PLAIN: 2, KNOLL: 3, FOOT: 5, UPLAND: 6, TERRACE: 9, PLATEAU: 15, KNOB: 16, RIDGE: 17 };

const tiles = new Array(W * D).fill('g');
const levels = new Int8Array(W * D).fill(LV.PLAIN);
/** Area of each tile (drives ground variety and the scatter rules). */
const zone = new Array(W * D).fill('plain');
/** Tiles written by a stamp (water, paths, stairs, pads): later passes leave them alone. */
const locked = new Uint8Array(W * D);
/** Path tiles (distance fields for the scatter). */
const pathMask = new Uint8Array(W * D);

const inMap = (i, j) => i >= 0 && j >= 0 && i < W && j < D;
const I = (i, j) => j * W + i;
const T = (i, j) => (inMap(i, j) ? tiles[I(i, j)] : null);
const L = (i, j) => (inMap(i, j) ? levels[I(i, j)] : null);
const Z = (i, j) => (inMap(i, j) ? zone[I(i, j)] : null);
/**
 * Write one tile (outside the map: nothing).
 * @param {number} i
 * @param {number} j
 * @param {string|null} ch tile char (null: unchanged)
 * @param {number|null} lvl height level (null: unchanged)
 * @param {{ lock?: boolean, zn?: string }} [o] lock the tile for later passes; set its zone
 */
function set(i, j, ch, lvl, { lock = false, zn } = {}) {
  if (!inMap(i, j)) return;
  const k = I(i, j);
  if (ch != null) tiles[k] = ch;
  if (lvl != null) levels[k] = lvl;
  if (zn) zone[k] = zn;
  if (lock) locked[k] = 1;
}
const isLocked = (i, j) => inMap(i, j) && locked[I(i, j)] === 1;
const WATER = new Set(['~', 'p', 'w', 'o', 'e']);
const STAIRS = new Set(['^', 'v', '>', '<']);
const BLOCKED = new Set(['T', 'x', ':']);
const isWater = (i, j) => WATER.has(T(i, j));

/** Visit every tile of a rect [i0, i1] × [j0, j1] (inclusive). */
function rect(i0, j0, i1, j1, fn) {
  for (let j = Math.max(0, j0); j <= Math.min(D - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(W - 1, i1); i++) fn(i, j);
}
/** Noisy ellipse: tiles whose centre is inside (cx, cz, rx, rz) with an fbm-wobbled edge. */
function blob(cx, cz, rx, rz, fn, { wobble = 0.18, seed = 1, freq = 0.35 } = {}) {
  rect(Math.floor(cx - rx - 3), Math.floor(cz - rz - 3), Math.ceil(cx + rx + 3), Math.ceil(cz + rz + 3), (i, j) => {
    const dx = (i + 0.5 - cx) / rx;
    const dz = (j + 0.5 - cz) / rz;
    const n = (fbm2((i + 0.5) * freq, (j + 0.5) * freq, { seed, octaves: 2 }) - 0.5) * 2 * wobble;
    const d = Math.hypot(dx, dz);
    if (d <= 1 + n) fn(i, j, d);
  });
}
/** Distance from point to segment. */
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const L2 = dx * dx + dz * dz || 1;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / L2, 0, 1);
  return Math.hypot(ax + dx * t - px, az + dz * t - pz);
}
/** Tiles whose centre lies within width / 2 of a polyline (world coordinates). */
function polyline(points, width, fn) {
  const half = width / 2;
  let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
  for (const [x, z] of points) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  rect(Math.floor(minX - half - 1), Math.floor(minZ - half - 1), Math.ceil(maxX + half + 1), Math.ceil(maxZ + half + 1), (i, j) => {
    let d = Infinity;
    for (let k = 0; k < points.length - 1; k++) d = Math.min(d, segDist(i + 0.5, j + 0.5, ...points[k], ...points[k + 1]));
    if (d <= half) fn(i, j, d);
  });
}
/**
 * Lower tiles that stand more than one level above a neighbour (inside the tiles `where` accepts),
 * so noise-made hills stay walkable everywhere (one level = 0.5 ≤ the 0.55 step height).
 */
function smoothSteps(where) {
  for (let pass = 0; pass < 6; pass++) {
    let changed = 0;
    for (let j = 0; j < D; j++) {
      for (let i = 0; i < W; i++) {
        if (!where(i, j)) continue;
        let lo = Infinity;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inMap(i + di, j + dj) && where(i + di, j + dj)) lo = Math.min(lo, L(i + di, j + dj));
        if (L(i, j) > lo + 1) { levels[I(i, j)] = lo + 1; changed++; }
      }
    }
    if (!changed) break;
  }
}

/** Signed noise in [-amp, amp] along one axis (deterministic). */
const wob = (x, seed, amp = 1, freq = 0.13) => (fbm2(x * freq, 3.7, { seed, octaves: 2 }) - 0.5) * 2.4 * amp;

// =============================================================================================
// 1. Terrain
// =============================================================================================

/** Rows z < edge(x) belong to a tier. Anchored columns (falls, stairs) get exact edges. */
function anchored(x, base, seed, amp, anchors) {
  for (const [a, b, v] of anchors) if (x >= a && x <= b) return v;
  return Math.round(base + wob(x, seed, amp));
}
const zPlateau = (x) => anchored(x, 20, 11, 1.8, [[59, 64, 20], [66, 71, 22], [72, 77, 20]]);
const xPlateauWest = (z) => Math.round(41 + wob(z, 12, 1.2));
const xPlateauEast = (z) => Math.round(95 + wob(z, 13, 1.0));
const zTerrace = (x) => (x >= 107 ? 40 : x >= 98 ? anchored(x, 36, 14, 1.2, [[100, 106, 36]])
  : anchored(x, 28, 15, 1.6, [[56, 59, 28], [67, 73, 28]]));
const xTerraceWest = (z) => Math.round(37 + wob(z, 16, 1.0));
const zFoot = (x) => (x >= 107 ? 40 : x >= 99 ? anchored(x, 44, 17, 1.0, [[99, 106, 44]])
  : anchored(x, 36, 18, 1.8, [[57, 62, 36], [67, 73, 36]]));
const xFootWest = (z) => Math.round(33 + wob(z, 19, 1.5));
const zUpland = (x) => anchored(x, 37, 20, 1.2, [[17, 24, 37]]);
const xUplandEast = (z) => (z >= 20 && z <= 25 ? 37 : Math.round(36 + wob(z, 21, 1.0)));

function relief() {
  for (let j = 0; j < D; j++) {
    for (let i = 0; i < W; i++) {
      const x = i + 0.5;
      let lvl = LV.PLAIN;
      let zn = 'plain';
      const foot = i >= xFootWest(j) && j < zFoot(x);
      const terrace = i >= xTerraceWest(j) && j < zTerrace(x);
      const plateau = i >= xPlateauWest(j) && i <= xPlateauEast(j) && j < zPlateau(x);
      const upland = i < xUplandEast(j) && j < zUpland(x);
      if (foot) { lvl = LV.FOOT; zn = i >= 98 ? 'ledge' : 'foothills'; }
      if (upland) { lvl = LV.UPLAND; zn = 'upland'; }
      if (terrace) { lvl = LV.TERRACE; zn = i >= 97 ? 'highland' : 'terrace'; }
      if (plateau) { lvl = LV.PLATEAU; zn = 'plateau'; }
      levels[I(i, j)] = lvl;
      zone[I(i, j)] = zn;
    }
  }
  // the switchback bastion (plateau lip reaching down to row 21 west of the flights)
  rect(66, 20, 71, 21, (i, j) => set(i, j, null, LV.PLATEAU, { zn: 'plateau' }));
  // observatory knoll on the plateau
  blob(74, 10.2, 7, 6.2, (i, j) => { if (L(i, j) === LV.PLATEAU) set(i, j, null, LV.KNOB, { zn: 'observatory' }); }, { seed: 31, wobble: 0.06 });
  // the quarry pit in the upland, and the mossy ruins west of it
  blob(21, 17, 8.5, 7.2, (i, j) => set(i, j, null, 3, { zn: 'quarry' }), { seed: 32, wobble: 0.12 });
  rect(4, 12, 11, 33, (i, j) => { if (Z(i, j) === 'upland') zone[I(i, j)] = 'ruins'; });
  // the farm's windmill knoll
  blob(15, 49, 5.5, 4.2, (i, j) => { if (L(i, j) === LV.PLAIN) set(i, j, null, LV.KNOLL, { zn: 'farm' }); }, { seed: 33 });
  // meadow knolls (one level: walkable all round)
  for (const [cx, cz, rx, rz, s] of [[50, 94, 4, 3, 34], [84, 100, 3.5, 3.0, 35], [58, 115, 5, 3, 36], [79, 120, 4, 2.2, 37]]) {
    blob(cx, cz, rx, rz, (i, j) => { if (L(i, j) === LV.PLAIN) set(i, j, null, LV.KNOLL); }, { seed: s });
  }
  // Emberwood: an undulating forest floor rising to the south-west, the ring ridge round the glade
  rect(3, 84, 45, 124, (i, j) => {
    const n = fbm2(i * 0.09, j * 0.09, { seed: 40, octaves: 3 });
    const rise = clamp((45 - i) / 40 + (j - 84) / 60, 0, 1.4);
    const lvl = n * 0.8 + rise * 0.9 > 0.95 ? (n > 0.62 && rise > 0.7 ? 4 : 3) : LV.PLAIN;
    set(i, j, null, lvl, { zn: 'emberwood' });
  });
  smoothSteps((i, j) => Z(i, j) === 'emberwood');
  blob(14.5, 111, 10.5, 9.5, (i, j) => set(i, j, null, 3), { seed: 41, wobble: 0.1 });
  blob(14.5, 111, 7.4, 6.4, (i, j) => set(i, j, null, LV.SHORE, { zn: 'glade' }), { seed: 42, wobble: 0.08 });
  // area zones on the plain
  rect(3, 38, 42, 83, (i, j) => { if (Z(i, j) === 'plain') zone[I(i, j)] = 'farm'; });
  rect(43, 38, 87, 76, (i, j) => { if (Z(i, j) === 'plain') zone[I(i, j)] = 'town'; });
  rect(43, 80, 94, 124, (i, j) => { if (Z(i, j) === 'plain') zone[I(i, j)] = 'meadow'; });
  rect(87, 38, 124, 124, (i, j) => { if (Z(i, j) === 'plain') zone[I(i, j)] = 'lakeside'; });
}

// ---------------------------------------------------------------------------------------------

/** Water: the Silverrun from its spring to the lake, Lake Mirrormere, the Mirror Falls, ponds. */
function water() {
  const W_ = (i, j, ch, lvl, zn = 'water') => set(i, j, ch, lvl, { lock: true, zn });
  // --- the spring: a rill out of the ridge (border rows) falling into the spring pool
  rect(60, 0, 63, 3, (i, j) => W_(i, j, i === 60 || i === 63 ? 'x' : 'w', i === 60 || i === 63 ? LV.RIDGE : 16));
  rect(59, 4, 64, 8, (i, j) => W_(i, j, 'p', 14));
  // --- plateau stream → Fall 1 (z = 20) → terrace pool
  rect(61, 9, 62, 19, (i, j) => W_(i, j, 'w', 14));
  rect(57, 20, 64, 23, (i, j) => W_(i, j, 'p', 8));
  // --- terrace stream → Fall 2 (z = 28) → foothill pool
  rect(57, 24, 58, 27, (i, j) => W_(i, j, 'w', 8));
  rect(55, 28, 61, 31, (i, j) => W_(i, j, 'p', 4));
  // --- foothill stream → Fall 3 (z = 36) → the pool at the foot of the mountain
  rect(59, 32, 60, 35, (i, j) => W_(i, j, 'w', 4));
  rect(55, 36, 62, 40, (i, j) => W_(i, j, 'p', 0));
  // --- the Silverrun through Hearthwick (south), then east along the town's south edge into the
  // lake (the bend already flows east; the mouth runs on into the lake's still water — no sand bar)
  rect(57, 41, 59, 76, (i, j) => W_(i, j, '~', 0));
  rect(57, 77, 98, 79, (i, j) => W_(i, j, 'e', 0));
  // widen towards the mouth
  rect(88, 76, 97, 76, (i, j) => { if (i > 90) W_(i, j, 'e', 0); });
  rect(86, 80, 99, 80, (i, j) => { if (i > 88) W_(i, j, 'e', 0); });

  // --- Lake Mirrormere (still water), its north lobe under the Mirror Falls
  blob(109.5, 69, 11.5, 20, (i, j) => W_(i, j, 'o', 0, 'lake'), { seed: 50, wobble: 0.12, freq: 0.18 });
  blob(104, 91, 10.5, 9.5, (i, j) => W_(i, j, 'o', 0, 'lake'), { seed: 58, wobble: 0.12, freq: 0.2 });
  blob(99, 67, 4.2, 6.5, (i, j) => W_(i, j, 'o', 0, 'lake'), { seed: 59, wobble: 0.1 });
  // the Heron Spit: a grassy tongue of land from the east shore
  blob(118.5, 76, 5, 2.3, (i, j) => { if (i > 112) { set(i, j, 'g', LV.PLAIN, { zn: 'lakeside' }); locked[I(i, j)] = 0; } }, { seed: 60, wobble: 0.15 });
  blob(113, 45, 6.2, 6.5, (i, j) => { if (j >= 40) W_(i, j, 'o', 0, 'lake'); }, { seed: 51, wobble: 0.1 });
  // the Mirror Falls stream across the highland (bed L8) to the cliff at z = 40
  rect(112, 27, 113, 39, (i, j) => W_(i, j, 'w', 8, 'highland'));
  rect(110, 23, 115, 26, (i, j) => W_(i, j, 'p', 8, 'highland'));
  // the island (not reachable: the sleeping stars' own)
  blob(111, 71, 3.2, 2.4, (i, j) => { set(i, j, 's', LV.SHORE, { lock: true, zn: 'island' }); }, { seed: 52, wobble: 0.15 });
  blob(111, 71, 1.9, 1.3, (i, j) => { set(i, j, 'g', LV.SHORE, { lock: true, zn: 'island' }); }, { seed: 53, wobble: 0.1 });

  // the campfire cove at Reedmouth: a flat patch of sand
  rect(92, 84, 95, 86, (i, j) => { if (!isWater(i, j)) set(i, j, 's', LV.SHORE, { lock: true, zn: 'lakeside' }); });

  // --- ponds: the Emberwood pond, the meadow pond, the farm pond
  for (const [cx, cz, rx, rz, s, zn] of /** @type {[number, number, number, number, number, string][]} */ ([[36, 106, 3.4, 2.6, 54, 'emberwood'], [83, 112, 3.6, 2.8, 55, 'meadow'], [8, 44, 2.4, 1.8, 56, 'farm']])) {
    blob(cx, cz, rx + 1.3, rz + 1.2, (i, j) => { if (!isLocked(i, j)) set(i, j, 's', LV.SHORE, { zn }); }, { seed: s + 100 });
    blob(cx, cz, rx, rz, (i, j) => W_(i, j, 'o', 0, zn), { seed: s });
  }

  // the Emberwood pond sits in the forest floor: soften its surroundings to walkable banks
  smoothSteps((i, j) => Z(i, j) === 'emberwood' && !isWater(i, j) && T(i, j) !== 'x');

  // --- banks: sand beaches round the lake and the river mouth (one level above the water)
  const shore = (i, j) => {
    if (!inMap(i, j) || isLocked(i, j)) return;
    set(i, j, 's', LV.SHORE, { zn: Z(i, j) === 'water' ? 'lakeside' : Z(i, j) });
  };
  for (let j = 0; j < D; j++) {
    for (let i = 0; i < W; i++) {
      const ch = T(i, j);
      if (ch !== 'o' && ch !== 'e') continue;
      if (Z(i, j) !== 'lake' && ch === 'o') continue;
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
        const d = Math.hypot(di, dj);
        const n = hash2(i + di, j + dj, 57);
        if (d <= 1.01 || (d <= 2.3 && n < 0.55)) {
          const ti = i + di; const tj = j + dj;
          // beaches only on the low ground round the lake (the cliffs in the north stay cliffs)
          if (L(ti, tj) != null && L(ti, tj) <= LV.PLAIN && Z(ti, tj) !== 'town') shore(ti, tj);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------

/** Roads (cobbles in Hearthwick, dirt outside) and trails. Paths follow the terrain height. */
const PATHS = [];
function path_(name, points, width, ch, { lockTiles = true, zn = null } = {}) {
  PATHS.push({ name, points, width, ch });
  polyline(points, width, (i, j) => {
    if (isLocked(i, j) && !pathMask[I(i, j)]) return;
    set(i, j, ch, null, { lock: lockTiles, zn: zn ?? undefined });
    pathMask[I(i, j)] = 1;
  });
}

function paths() {
  // --- Hearthwick streets
  path_("King's Road (town north)", [[70.5, 40], [70.5, 51]], 3, 'c');
  path_("King's Road (town south)", [[70.5, 64], [70.5, 76]], 3, 'c');
  path_('Lantern Lane (west)', [[44, 58.5], [62, 58.5]], 3, 'c');
  path_('Lantern Lane (east)', [[78, 58.5], [86, 58.5]], 3, 'c');
  path_('Quay walk', [[61, 41.5], [61, 76]], 2, 'c');
  path_('West bank lane', [[55, 43], [55, 76]], 2, '.');
  path_('River walk', [[62, 76], [86, 76]], 2, 'c');
  path_('Chapel lane', [[78, 51], [85, 51]], 2, '.');
  // the square: cobbles with a stone-tile ring round the well
  rect(62, 51, 77, 64, (i, j) => { set(i, j, 'c', LV.PLAIN, { lock: true }); pathMask[I(i, j)] = 1; });
  blob(70, 57.5, 3.6, 3.1, (i, j) => set(i, j, 'k', LV.PLAIN, { lock: true }), { wobble: 0 });
  // --- King's Road: south gate → the Meadowlands → the south edge; north over the mountain
  path_("King's Road (south)", [[70.5, 76], [70.5, 83], [69.5, 92], [70.5, 104], [70, 114], [70.5, 124.2]], 3, '.');
  path_("King's Road (foothills)", [[70.5, 32], [70.5, 35.5]], 3, '.');
  path_("King's Road (terrace)", [[70.5, 20], [70.5, 27], [71.5, 22.5]], 3, '.');
  path_("King's Road (plateau)", [[70.5, 21.5], [70.5, 17], [73, 14.5], [74, 12]], 2.4, '.');
  // --- West Road to Goldenfield Farms, the farm lanes
  path_('West Road', [[44, 58.5], [36, 58.5], [28, 57], [22, 57.5]], 2.6, '.');
  path_('Farm lane north', [[24, 57], [22, 50], [21, 41]], 2, '.');
  path_('Farm lane south', [[24, 58], [23, 70], [24, 80], [25, 88]], 2, '.');
  path_('Orchard walk', [[23, 66], [34, 66]], 1.6, 'd');
  // --- East Road to the fishing hamlet
  path_('East Road', [[85, 58.5], [87.2, 58.9], [91.6, 58.7]], 2.6, '.');
  path_('Shore path north', [[95.5, 58.5], [95.5, 52], [99, 48], [102, 47.5]], 2, '.');
  // (it ends on the sand of the South Beach, at a bench looking across the lake)
  path_('Shore path south', [[92, 74], [92, 81], [90, 88], [93, 96], [100, 103], [106, 101.8], [110.6, 101.4]], 2, '.');
  // the east shore: on from the South Beach past the Heron Spit to the foot of the Mirror Falls
  path_('Heron trail', [[110.6, 101.4], [112, 100.2], [117.5, 92], [120, 86], [121.8, 80.5], [122.4, 74.5], [122.1, 66], [121.8, 58], [121.2, 50], [120.6, 44.5]], 1.6, '.');
  // --- Meadowlands and Emberwood trails
  path_('Troupe path', [[69.5, 100], [66.5, 100]], 2, '.');
  path_('Meadow path east', [[71, 96], [80, 96], [88, 92]], 1.8, '.');
  path_('Emberwood trail', [[69, 106], [58, 107], [47, 104], [38, 100], [31, 97]], 2, '.');
  path_('Woodcutter path', [[25, 88], [28, 94], [31, 97]], 2, '.');
  path_('Glade trail', [[31, 97], [28, 104], [24, 111.5], [22.5, 111.5]], 1.6, '.');
  // --- Mount Lumen: the plateau walk to the lookout, the spring and the east stair
  path_('Lookout walk', [[70.5, 17.5], [64, 15], [58, 15], [50, 17], [46, 17.5]], 1.8, '.');
  path_('Observatory ring', [[74, 12], [74, 9]], 2, 'k');
  path_('East plateau walk', [[74, 12], [84, 13], [95, 14.5]], 1.8, '.');
  // --- NE highland trail: plateau stair foot → south through the pines → the ledge stair
  path_('Highland trail', [[102, 14.5], [104, 20], [103.5, 30], [103.5, 35.5]], 1.8, '.');
  path_('Lookout ledge', [[104, 32], [109, 34]], 1.6, '.');
  path_('Ledge path', [[103.5, 40], [101.5, 43.5]], 1.8, '.');
  // --- the quarry: farm lane → upland → pit rim; the ruins
  path_('Quarry road', [[21, 36.5], [21, 28], [18.5, 25.5]], 2, '.');
  path_('Quarry floor', [[18, 21], [20, 16], [25, 13]], 2, 'd');
  path_('Ruins walk', [[12, 17.5], [8, 20], [8, 28]], 1.6, '.');
  path_('Upland track', [[21, 28], [30, 25], [33.5, 22.5]], 1.6, '.');
  // --- the mountain's cross paths: the terrace and the foothills (footbridges over the Silverrun)
  path_('Terrace walk west', [[38, 23], [46, 24.5], [55.5, 25.5]], 1.8, '.');
  path_('Terrace walk', [[60.5, 25.5], [68.5, 25]], 1.8, '.');
  path_('Terrace walk east', [[72.5, 24.5], [86, 25], [96, 25.5], [103.5, 27], [103.5, 30]], 1.8, '.');
  path_('Foothill walk west', [[36, 32], [48, 33], [57.5, 33.5]], 1.8, '.');
  path_('Foothill walk', [[62.5, 33.5], [68.5, 33.5]], 1.8, '.');
  // --- doorsteps of the homes west of the river
  path_('Hollyhock step', [[52.2, 48.3], [54, 48.3]], 1.2, '.');
  path_('Riverside step', [[45.6, 68.1], [47, 68.1]], 1.2, '.');
  path_('Millhouse step', [[50, 75.8], [53.6, 75.8]], 1.2, '.');
}

// ---------------------------------------------------------------------------------------------

/** Stair flights. Every flight rises one level per tile toward `dir`; `width` tiles side by side. */
const FLIGHTS = [];
const DIRS = { N: [0, -1, '^'], S: [0, 1, 'v'], E: [1, 0, '>'], W: [-1, 0, '<'] };
function flight(name, i, j, dir, fromLevel, n, width = 2) {
  const [dx, dz, ch] = DIRS[dir];
  // side axis: perpendicular, toward +x / +z
  const sx = dz !== 0 ? 1 : 0;
  const sz = dx !== 0 ? 1 : 0;
  const cells = [];
  for (let k = 0; k < n; k++) {
    for (let w = 0; w < width; w++) {
      const ti = i + dx * k + sx * w;
      const tj = j + dz * k + sz * w;
      set(ti, tj, ch, fromLevel + k, { lock: true });
      pathMask[I(ti, tj)] = 1;
      cells.push([ti, tj]);
    }
  }
  FLIGHTS.push({ name, i, j, dir, fromLevel, n, width, cells });
}
/** Flat pad (landing / foot) of a flight: tiles set to a level (and a path char). */
function pad(i0, j0, i1, j1, lvl, ch = null) {
  rect(i0, j0, i1, j1, (i, j) => { set(i, j, ch ?? (isWater(i, j) ? 'g' : T(i, j)), lvl, { lock: true }); if (ch) pathMask[I(i, j)] = 1; });
}

function stairs() {
  // King's Road: town (L2) → foothills (L5): a grand three-wide flight rising north
  pad(69, 39, 71, 40, LV.PLAIN, 'c');
  flight("King's Road · foothill stair", 69, 38, 'N', LV.PLAIN, 3, 3);
  pad(69, 32, 71, 35, LV.FOOT, '.');
  // foothills (L5) → terrace (L9)
  flight("King's Road · terrace stair", 69, 31, 'N', LV.FOOT, 4, 3);
  // terrace (L9) → plateau (L15): switchbacks — east flight to the landing, west flight to the bastion
  pad(69, 22, 71, 27, LV.TERRACE, '.');
  flight('Switchback · east flight', 72, 22, 'E', LV.TERRACE, 3, 2);
  pad(75, 20, 76, 23, 12, 'k');
  flight('Switchback · west flight', 74, 20, 'W', 12, 3, 2);
  pad(69, 20, 71, 21, LV.PLATEAU, '.');
  // the observatory knoll (one level: a single step up, as stairs)
  flight('Observatory step', 73, 15, 'N', LV.PLATEAU, 1, 3);
  // plateau → NE highland: a long flight down the east cliff (rises west)
  pad(93, 14, 95, 15, LV.PLATEAU, '.');
  flight('Highland stair', 101, 14, 'W', LV.TERRACE, 6, 2);
  pad(102, 14, 103, 15, LV.TERRACE, '.');
  // highland (L9) → ledge (L5) → the lake's north shore (L2)
  pad(103, 34, 104, 35, LV.TERRACE, '.');
  flight('Ledge stair', 103, 39, 'N', LV.FOOT, 4, 2);
  pad(101, 40, 104, 43, LV.FOOT, '.');
  flight('Shore stair', 101, 46, 'N', LV.PLAIN, 3, 2);
  pad(100, 47, 103, 48, LV.PLAIN, '.');
  // farms (L2) → quarry upland (L6)
  pad(20, 41, 21, 42, LV.PLAIN, '.');
  flight('Quarry stair', 20, 40, 'N', LV.PLAIN, 4, 2);
  pad(20, 34, 21, 36, LV.UPLAND, '.');
  // into the quarry pit (rises south) and out to the ruins (rises west)
  pad(17, 25, 19, 26, LV.UPLAND, '.');
  flight('Quarry pit stair', 17, 22, 'S', 3, 3, 3);
  pad(17, 20, 19, 21, 3, 'd');
  pad(13, 17, 14, 18, 3, 'd');
  flight('Ruins stair', 12, 17, 'W', 3, 3, 2);
  pad(8, 17, 9, 18, LV.UPLAND, '.');
  // upland (L6) → terrace (L9): east flight
  pad(32, 22, 33, 23, LV.UPLAND, '.');
  flight('Upland stair', 34, 22, 'E', LV.UPLAND, 3, 2);
  pad(37, 22, 38, 23, LV.TERRACE, '.');
  // Southgate: the King's Road meets the bridge at the level of the town bank
  pad(69, 80, 71, 81, LV.PLAIN, '.');
  // the Emberwood glade: a flight down into the hollow (rises east)
  pad(18, 111, 20, 112, LV.SHORE, 'd');
  flight('Glade stair', 21, 111, 'E', LV.SHORE, 2, 2);
  pad(23, 111, 24, 112, 3, '.');
}

// ---------------------------------------------------------------------------------------------

/** Ground variety by zone (never on locked tiles). */
function ground() {
  for (let j = 0; j < D; j++) {
    for (let i = 0; i < W; i++) {
      if (locked[I(i, j)]) continue;
      const zn = Z(i, j);
      const n = fbm2(i * 0.11, j * 0.11, { seed: 60, octaves: 3 });
      const m = fbm2(i * 0.23 + 7, j * 0.23 - 3, { seed: 61, octaves: 2 });
      let ch = n > 0.58 ? 'G' : n < 0.4 && m > 0.55 ? 'f' : 'g';
      switch (zn) {
        case 'meadow': ch = m > 0.5 ? 'f' : n > 0.6 ? 'G' : 'g'; break;
        case 'emberwood': ch = n > 0.45 ? 'G' : m > 0.62 ? 'f' : 'g'; break;
        case 'glade': ch = m > 0.45 ? 'f' : 'g'; break;
        case 'plateau': case 'terrace': case 'highland': ch = n > 0.5 ? 'G' : m > 0.66 ? 'm' : 'g'; break;
        case 'observatory': ch = m > 0.5 ? 'm' : 'g'; break;
        case 'upland': ch = m > 0.6 ? 'm' : n > 0.55 ? 'G' : n < 0.38 ? 'd' : 'g'; break;
        case 'ruins': ch = m > 0.48 ? 'm' : n > 0.5 ? 'G' : 'g'; break;
        case 'quarry': ch = m > 0.7 ? 'm' : n > 0.45 ? 'k' : 'd'; break; // cut stone and stone dust
        case 'town': ch = n > 0.62 ? 'G' : 'g'; break;
        case 'lakeside': ch = n > 0.6 ? 'G' : m > 0.6 ? 'f' : 'g'; break;
        default:
      }
      if (T(i, j) === 's') continue;
      tiles[I(i, j)] = ch;
    }
  }
  // Goldenfield: farmland plots (furrows), stubble / dirt yards
  for (const [i0, j0, i1, j1] of [[4, 55, 9, 58], [4, 61, 13, 67], [15, 61, 20, 66], [4, 70, 10, 79], [12, 70, 20, 75], [12, 78, 18, 81], [27, 59, 33, 61]]) {
    rect(i0, j0, i1, j1, (i, j) => { if (!locked[I(i, j)]) set(i, j, 'F', LV.PLAIN, { lock: true }); });
  }
  rect(25, 47, 36, 55, (i, j) => { if (!locked[I(i, j)] && hash2(i, j, 62) < 0.75) tiles[I(i, j)] = 'd'; });
  // the fishing hamlet: wooden decks along the west shore (at beach level)
  for (const [i0, j0, i1, j1] of [[88, 59, 96, 63], [92, 64, 94, 69], [88, 68, 95, 73]]) {
    rect(i0, j0, i1, j1, (i, j) => { if (!isWater(i, j)) set(i, j, 'b', LV.SHORE, { lock: true, zn: 'hamlet' }); });
  }
  // the North Pier's landing: decking out over the shallows past Tench's cabin to the hamlet
  rect(96, 62, 96, 63, (i, j) => set(i, j, 'b', LV.SHORE, { lock: true, zn: 'hamlet' }));
  // the observatory: stone floor, broken walls (rock tiles one level up), moss
  blob(74, 11.8, 3.7, 3.1, (i, j) => set(i, j, 'k', LV.KNOB, { lock: true }), { wobble: 0 });
  blob(74, 11.8, 4.8, 4.2, (i, j) => {
    if (T(i, j) === 'k' || pathMask[I(i, j)] || j <= 8) return; // (the tower closes the ring in the north)
    const a = Math.atan2(j + 0.5 - 11.8, i + 0.5 - 74);
    const gap = Math.abs(Math.sin(a * 2.5 + 0.9)) < 0.3 || j >= 14;
    const h = hash2(i, j, 63);
    if (!gap) set(i, j, 'x', LV.KNOB + (h < 0.35 ? 4 : h < 0.7 ? 3 : 2), { lock: true });
  }, { wobble: 0 });
  // the mossy ruins: broken floors and wall stubs
  for (const [i0, j0, i1, j1] of [[5, 22, 9, 26], [6, 13, 9, 15]]) rect(i0, j0, i1, j1, (i, j) => { if (!locked[I(i, j)]) set(i, j, hash2(i, j, 64) < 0.7 ? 'k' : 'm', null, { lock: true }); });
  // (broken walls 1.5–2 units tall: they frame the well and read as a ruin above the grass)
  for (const [i, j] of [[4, 21], [4, 22], [4, 23], [10, 21], [10, 22], [5, 27], [6, 27], [9, 27], [4, 13], [4, 14], [10, 13]]) set(i, j, 'x', LV.UPLAND + 2 + (hash2(i, j, 65) < 0.5 ? 2 : 1), { lock: true });
  // the old mine shaft in the quarry floor (void: a hole into the dark)
  rect(16, 14, 17, 15, (i, j) => set(i, j, ' ', 3, { lock: true }));
  // the standing stones of the hidden glade (rock pillars 2.5–3 units tall, taller than a person) round a stone floor
  rect(15, 111, 17, 112, (i, j) => set(i, j, 'k', LV.SHORE, { lock: true }));
  for (const [i, j, l] of [[18, 114, 6], [15, 114, 7], [13, 113, 6], [14, 109, 7], [18, 109, 6]]) set(i, j, 'x', l, { lock: true });
  // rock outcrops in the quarry and on the upland
  for (const [cx, cz, r, s] of [[14, 13, 1.6, 70], [27, 20, 1.8, 71], [26, 12, 1.3, 72], [29, 31, 1.2, 73], [5, 36, 1.4, 74], [45, 12, 1.5, 75], [88, 7, 1.6, 76], [118, 12, 1.8, 77]]) {
    blob(cx, cz, r, r * 0.8, (i, j) => { if (!locked[I(i, j)]) set(i, j, 'x', L(i, j) + 1, { lock: true }); }, { seed: s, wobble: 0.2 });
  }
  // the Old Quarry: cut-stone benches stepped into the pit walls (blocked rock one or two levels above
  // the floor, below the upland rim), never beside the stairs, the floor path or the shaft
  rect(10, 8, 32, 26, (i, j) => {
    if (Z(i, j) !== 'quarry' || L(i, j) !== 3 || locked[I(i, j)] || pathMask[I(i, j)]) return;
    if (Math.hypot(i + 0.5 - 21, j + 0.5 - 10) < 1.6) return; // the lantern torch on the north wall
    let rim = false;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ti = i + di; const tj = j + dj;
      if (!inMap(ti, tj)) continue;
      if (pathMask[I(ti, tj)] || STAIRS.has(T(ti, tj)) || (locked[I(ti, tj)] && T(ti, tj) !== 'x')) return;
      if (L(ti, tj) >= LV.UPLAND) rim = true;
    }
    if (rim) set(i, j, 'x', 3 + (hash2(i, j, 66) < 0.45 ? 2 : 1), { lock: true });
  });
}

// ---------------------------------------------------------------------------------------------

/** Blocked forest: the border ring and deep-forest patches ('T', trees scattered by the game). */
function border() {
  for (let j = 0; j < D; j++) {
    for (let i = 0; i < W; i++) {
      const edge = j < 4 || j >= D - 3 || i < 3 || i >= W - 3;
      if (!edge || locked[I(i, j)]) continue;
      tiles[I(i, j)] = 'T';
    }
  }
  // border heights: the ridge behind the plateau; elsewhere the level of the ground inside
  for (let j = 0; j < D; j++) {
    for (let i = 0; i < W; i++) {
      if (T(i, j) !== 'T' || locked[I(i, j)]) continue;
      const ii = clamp(i, 3, W - 4);
      const jj = clamp(j, 4, D - 4);
      let lvl = L(ii, jj);
      if (T(ii, jj) === 'T' || isWater(ii, jj)) lvl = Math.max(LV.PLAIN, lvl);
      if (j < 4) lvl = Math.max(lvl + 1, L(clamp(i, 3, W - 4), 4) + 2);
      if (WATER.has(T(ii, jj))) lvl = Math.max(lvl, LV.PLAIN);
      levels[I(i, j)] = Math.min(34, lvl);
    }
  }
  // deep-forest patches inside the map (blocked; the game scatters trees on them like the border):
  // never on paths, water or stairs, and never just south of a place worth seeing
  const deep = [
    [8, 89, 4.2, 4.6, 81], [5.5, 104, 2.6, 6, 82], [40, 88.5, 3, 2.4, 83], // Emberwood
    [120.5, 12, 3.6, 7, 84], [110.5, 8.5, 5, 3.2, 85], [99.5, 26, 2.4, 3.2, 86], // Amberpine Heights
    [115.5, 5.4, 10, 2, 91], // (up to the border behind them: no strip of meadow nobody can reach)
    [44.5, 8.5, 4.2, 4, 87], [90.5, 18.5, 3.4, 1.6, 88], // the plateau's wooded corners
    [7, 7, 4.6, 3.2, 89], [31.5, 7, 3.5, 2.6, 90], // above the quarry
  ];
  for (const [cx, cz, rx, rz, seed] of deep) {
    blob(cx, cz, rx, rz, (i, j) => {
      if (locked[I(i, j)] || pathMask[I(i, j)] || isWater(i, j)) return;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (inMap(i + di, j + dj) && (pathMask[I(i + di, j + dj)] || STAIRS.has(T(i + di, j + dj)))) return;
      tiles[I(i, j)] = 'T';
    }, { seed, wobble: 0.22 });
  }
  // no one-tile corridors between forest and forest: the trees scattered beside them would close
  // them into pockets nobody can reach
  for (let pass = 0; pass < 3; pass++) {
    for (let j = 1; j < D - 1; j++) {
      for (let i = 1; i < W - 1; i++) {
        if (locked[I(i, j)] || pathMask[I(i, j)] || BLOCKED.has(T(i, j)) || isWater(i, j)) continue;
        const t = (ii, jj) => T(ii, jj) === 'T';
        if ((t(i - 1, j) && t(i + 1, j)) || (t(i, j - 1) && t(i, j + 1))) tiles[I(i, j)] = 'T';
      }
    }
  }
  // the King's Road runs on, past the border, toward the lowlands (blocked: ':' custom tile)
  rect(69, D - 3, 71, D - 1, (i, j) => set(i, j, ':', LV.PLAIN, { lock: true }));
}


// =============================================================================================
// 2. Objects — infrastructure: ids, approximate colliders (the PropFactory's), reservations
// =============================================================================================

const objects = [];
const usedIds = new Set();
const idCounters = {};
const S_ = 0; // faces south (the camera)
const E_ = Math.PI / 2; // faces east
const W_ = -Math.PI / 2; // faces west
const N_ = Math.PI; // faces north
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
let seedCounter = 100;
const nextSeed = () => (seedCounter = (seedCounter * 37 + 11) % 9973);

/** Tile-centre height (world) under a point. */
const groundY = (x, z) => (L(Math.floor(x), Math.floor(z)) ?? 0) * 0.5;

/**
 * Add a catalog object. `fields` = { id?, x, z, ...overrides } (line objects: x0, z0, x1, z1;
 * regions: minX, maxX, minZ, maxZ). Ids: explicit (readable, e.g. NPCs) or `${type}_${n}`.
 * @param {ObjectType} type
 * @param {{ id?: string, [key: string]: any }} [fields]
 * @returns {LevelObject}
 */
function add(type, fields = {}) {
  let { id, ...rest } = fields;
  if (!id) {
    do { idCounters[type] = (idCounters[type] ?? 0) + 1; id = `${type}_${idCounters[type]}`; } while (usedIds.has(id));
  }
  if (usedIds.has(id)) throw new Error(`duplicate object id ${id}`);
  usedIds.add(id);
  const def = OBJECT_TYPES[type];
  let obj;
  if (def.placement === 'line') {
    const { x0, z0, x1, z1, ...o } = rest;
    obj = createObject(type, x0, z0, { x1, z1, ...o });
  } else if (def.placement === 'rect') {
    const { minX, maxX, minZ, maxZ, ...o } = rest;
    obj = createObject(type, (minX + maxX) / 2, (minZ + maxZ) / 2, { minX, maxX, minZ, maxZ, ...o });
  } else {
    const { x, z, ...o } = rest;
    obj = createObject(type, r3(x), r3(z), o);
  }
  obj.id = id;
  objects.push(obj);
  if (def.kind === 'prop' || type === 'npc') reserve(obj);
  return obj;
}

/** Rotate a local offset (lx, lz) by an object rotation (three.js Y rotation). */
const rot = (lx, lz, a) => [lx * Math.cos(a) + lz * Math.sin(a), -lx * Math.sin(a) + lz * Math.cos(a)];
/** World AABB of a local rect under a rotation (what PropFactory.boxCollider returns). */
function rotBox(x, z, a, x0, x1, z0, z1) {
  const pts = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([lx, lz]) => rot(lx, lz, a));
  return { c: 'box', minX: x + Math.min(...pts.map((p) => p[0])), maxX: x + Math.max(...pts.map((p) => p[0])), minZ: z + Math.min(...pts.map((p) => p[1])), maxZ: z + Math.max(...pts.map((p) => p[1])) };
}
const trunkR = (o) => {
  const H = o.opts?.height ?? 4.5;
  const k = o.opts?.kind;
  return 0.12 + (k === 'pine' ? Math.max(0.14, H * 0.042) * 1.2 : k === 'birch' ? H * 0.036 * 1.1 * 1.4 : H * 0.075 * 1.1);
};
/** House door point (front = local +Z; `doorOffset` along the facade). */
function doorOf(o) {
  const [dx, dz] = rot(o.opts.doorOffset ?? 0, o.opts.depth / 2 + 1.0, o.rotation ?? 0);
  return { x: o.x + dx, z: o.z + dz };
}

/** Approximate TileMap colliders of a level object (world space): circles, boxes, segments. */
function collidersOf(o) {
  const a = o.rotation ?? 0;
  const op = o.opts ?? {};
  switch (o.type) {
    case 'house': return [rotBox(o.x, o.z, a, -op.width / 2 - 0.1, op.width / 2 + 0.1, -op.depth / 2 - 0.1, op.depth / 2 + 0.1)];
    case 'tree': return o.collider === false ? [] : [{ c: 'circle', x: o.x, z: o.z, r: trunkR(o) }];
    case 'rock': { const s = op.size ?? 1; return [{ c: 'circle', x: o.x, z: o.z, r: 0.7 * s * 1.1 * (s >= 1 ? 1.25 : 1) }]; }
    case 'haystack': return [{ c: 'circle', x: o.x, z: o.z, r: 1.05 * (op.size ?? 1) }];
    case 'well': return [{ c: 'circle', x: o.x, z: o.z, r: 0.94 }];
    case 'windmill': return [{ c: 'circle', x: o.x, z: o.z, r: 1.75 }];
    case 'marketStall': { const hw = (op.width ?? 3) / 2; return [rotBox(o.x, o.z, a, -hw - 0.05, hw + 0.05, -0.85, 1.3)]; }
    case 'lamppost': return [{ c: 'circle', x: o.x, z: o.z, r: 0.26 }];
    case 'campfire': return [{ c: 'circle', x: o.x, z: o.z, r: 0.95 }];
    case 'bench': { const Lb = op.length ?? 1.8; return [rotBox(o.x, o.z, a, -Lb / 2, Lb / 2, -0.35, 0.25)]; }
    case 'barrel': return [{ c: 'circle', x: o.x, z: o.z, r: 0.44 }];
    case 'crate': { const e = (op.size ?? 0.9) * 0.5 * (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a))); return [{ c: 'box', minX: o.x - e, maxX: o.x + e, minZ: o.z - e, maxZ: o.z + e }]; }
    case 'crateStack': { const s = op.size ?? 0.85; const hx = ((op.count ?? 3) / 2) * (s + 0.04) + 0.75; return [rotBox(o.x, o.z, a, -hx, hx, -s * 0.6, s * 0.6)]; }
    case 'flowerbox': { if (op.wall) return []; const Lf = op.length ?? 1.2; return [rotBox(o.x, o.z, a, -Lf / 2, Lf / 2, -0.17, 0.17)]; }
    case 'signpost': return [{ c: 'circle', x: o.x, z: o.z, r: 0.22 }];
    case 'fence': return [{ c: 'seg', x0: o.x0, z0: o.z0, x1: o.x1, z1: o.z1, h: 0.1 }];
    case 'bridge': {
      const hw = (op.width ?? 2) / 2 + 0.02;
      const dx = o.x1 - o.x0; const dz = o.z1 - o.z0; const len = Math.hypot(dx, dz);
      const nx = -dz / len; const nz = dx / len;
      return [-1, 1].map((sgn) => ({ c: 'seg', x0: o.x0 + nx * hw * sgn, z0: o.z0 + nz * hw * sgn, x1: o.x1 + nx * hw * sgn, z1: o.z1 + nz * hw * sgn, h: 0.12 }));
    }
    case 'npc': return [{ c: 'circle', x: o.x, z: o.z, r: 0.34 }];
    default: return [];
  }
}
/** Point inside a collider shape, with an extra margin. */
function hitShape(c, x, z, m = 0) {
  if (c.c === 'circle') return (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + m) ** 2;
  if (c.c === 'box') return x > c.minX - m && x < c.maxX + m && z > c.minZ - m && z < c.maxZ + m;
  return segDist(x, z, c.x0, c.z0, c.x1, c.z1) < c.h + m;
}
/** Axis-aligned bounds of a collider shape (for the spatial hash). */
function shapeBounds(c) {
  if (c.c === 'circle') return { minX: c.x - c.r, maxX: c.x + c.r, minZ: c.z - c.r, maxZ: c.z + c.r };
  if (c.c === 'box') return c;
  return { minX: Math.min(c.x0, c.x1) - c.h, maxX: Math.max(c.x0, c.x1) + c.h, minZ: Math.min(c.z0, c.z1) - c.h, maxZ: Math.max(c.z0, c.z1) + c.h };
}

/** Spatial hash of every collider (+ owner) for placement checks and the walk BFS. */
const CELL = 4;
const shapeGrid = new Map();
const allShapes = [];
function reserve(o) {
  for (const c of collidersOf(o)) {
    c.owner = o;
    allShapes.push(c);
    const b = shapeBounds(c);
    for (let gz = Math.floor((b.minZ - 2) / CELL); gz <= Math.floor((b.maxZ + 2) / CELL); gz++) {
      for (let gx = Math.floor((b.minX - 2) / CELL); gx <= Math.floor((b.maxX + 2) / CELL); gx++) {
        const k = `${gx},${gz}`;
        if (!shapeGrid.has(k)) shapeGrid.set(k, []);
        shapeGrid.get(k).push(c);
      }
    }
  }
}
const shapesNear = (x, z) => shapeGrid.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? [];
/** The owner of a collider within `m` of (x, z) (optionally ignoring some owners), or null. */
function blockedAt(x, z, m = 0, ignore = null) {
  for (const c of shapesNear(x, z)) if ((!ignore || !ignore(c.owner)) && hitShape(c, x, z, m)) return c.owner;
  return null;
}

/** Keep-clear zones (door fronts, NPC spots, stair feet, bridge ends…): the scatter avoids them. */
const clearZones = [];
const keepClear = (x, z, r, why) => clearZones.push({ x, z, r, why });
/** Lanterns: no scattered tree crown within 3.6 units (a lamp inside an autumn crown reads as a fire). */
const lampZones = [];
const inClearZone = (x, z, pad = 0) => clearZones.some((c) => (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + pad) ** 2);

// ---- small builders ----------------------------------------------------------------------------

/** A house; `text` = what the door says when knocked on. The door front stays clear. */
function house(id, name, x, z, o, text, { rotation = S_, light: lit = false } = {}) {
  const obj = add('house', {
    id, x, z, rotation, name, light: lit, text: [].concat(text),
    opts: {
      width: 4, depth: 3, stories: 1, wall: 'plaster', upperWall: '', roof: 'roof_red', chimney: true, shutters: true,
      sign: false, doorHood: false, woodpile: false, gableFront: false, seed: nextSeed(), doorOffset: 0, ...o,
    },
  });
  const d = doorOf(obj);
  keepClear(d.x, d.z, 1.1, `door of ${id}`);
  return obj;
}
/** Street lamp; `arm` = the direction its lantern arm points ('E', 'W', 'N', 'S') or 'top'. */
function lamp(x, z, arm = 'top') {
  const r = { E: 0, W: Math.PI, S: -Math.PI / 2, N: Math.PI / 2, top: 0 }[arm];
  lampZones.push({ x, z });
  return add('lamppost', { x, z, rotation: r3(r), opts: { style: arm === 'top' ? 'top' : 'arm' } });
}
/**
 * A signpost (`text`: its pages).
 * @param {number} x
 * @param {number} z
 * @param {string|string[]} text
 * @param {{ rotation?: number, boards?: number, speaker?: string, id?: string }} [o]
 */
const sign = (x, z, text, { rotation = 0, boards = 2, speaker = 'Signpost', id } = {}) => add('signpost', { id, x, z, rotation, speaker, text: [].concat(text), opts: { boards } });
const bench = (x, z, rotation = S_, length = 1.8, back = true) => add('bench', { x, z, rotation: r3(rotation), opts: { length, back } });
/**
 * A barrel (`rotation`: default a hash of the position).
 * @param {number} x
 * @param {number} z
 * @param {{ height?: number, lying?: boolean, rotation?: number }} [o]
 */
const barrel = (x, z, { height = 1, lying = false, rotation } = {}) => add('barrel', { x, z, rotation: rotation ?? r3(hash2(Math.round(x * 10), Math.round(z * 10), 5) * 6.28), opts: { height, lying } });
const crate = (x, z, size = 0.8, rotation) => add('crate', { x, z, rotation: rotation ?? r3((hash2(Math.round(x * 10), Math.round(z * 10), 6) - 0.5) * 0.6), opts: { size } });
const crates = (x, z, count = 3, rotation = 0, size = 0.85) => add('crateStack', { x, z, rotation: r3(rotation), opts: { count, size, seed: nextSeed() } });
const flowers = (x, z, rotation = S_, length = 1.2) => add('flowerbox', { x, z, rotation: r3(rotation), opts: { length } });
const rock = (x, z, size = 1) => add('rock', { x, z, opts: { size: r2(size), seed: nextSeed() } });
const hay = (x, z, size = 1) => add('haystack', { x, z, opts: { size } });
const tree = (kind, x, z, height, { collider = true } = {}) => add('tree', { x, z, collider, opts: { kind, height: r2(height), seed: nextSeed() } });
const fence = (x0, z0, x1, z1) => add('fence', { x0, z0, x1, z1, opts: {} });
const torch = (x, z, rotation, dy = 2.1, embers = false) => { lampZones.push({ x, z }); return add('wallTorch', { x, z, rotation: r3(rotation), dy, opts: { embers } }); };
const light = (x, z, o = {}) => add('light', { x, z, dy: 1.5, color: '#ffb46b', intensity: 8, distance: 8, flicker: 0.2, nightOnly: true, ...o });
const fire = (x, z, seat = false, rotation = 0.8) => { keepClear(x, z, 2.2, 'campfire'); return add('campfire', { x, z, rotation, opts: { seat } }); };
const stall = (x, z, rotation, cloth, width = 3) => add('marketStall', { x, z, rotation: r3(rotation), opts: { cloth, width, seed: nextSeed() } });
const well = (id, x, z, text, roof = 'wood_planks') => { keepClear(x, z, 2.2, `well ${id}`); return add('well', { id, x, z, rotation: 0, text: [].concat(text), opts: { roof } }); };
const emit = (preset, x, z, size, count, dy = 1.2, extra = {}) => add('emitter', { x, z, preset, size, count, dy, ...extra });
const critters = (id, kind, x, z, count, radius, extra = {}) => add('critters', { id, x, z, kind, count, radius, ...extra });
/** Bridge between two banks (deck height given explicitly: the bank level). */
const BRIDGES = [];
function bridge(id, x0, z0, x1, z1, width, deckY, arch = 0.25, { pier = false, name = id } = {}) {
  const o = add('bridge', { id, x0, z0, x1, z1, deckY, opts: { width, arch } });
  BRIDGES.push({ o, pier, name });
  keepClear(x0, z0, 1.6, `bridge end ${id}`);
  keepClear(x1, z1, 1.6, `bridge end ${id}`);
  return o;
}
/** Waterfall on a tile edge; the drop is checked by the validator. */
const FALLS = [];
function waterfall(id, x, z, width, facing = 'S', extra = {}) {
  const o = add('waterfall', { id, x, z, width, facing, ...extra });
  FALLS.push(o);
  return o;
}

// =============================================================================================
// 2b. Hand-placed landmarks, buildings, lights and props, area by area
// =============================================================================================

/** Hearthwick — the market town: the square, the inn, the hall, the chapel, homes, the quays. */
function hearthwick() {
  // ---- the north row, facing the square
  house('inn', 'The Starlight Inn', 65.25, 47.5, {
    width: 6.5, depth: 4.5, stories: 2, wall: 'plaster', upperWall: 'timber_frame', roof: 'roof_red', sign: true, doorHood: true, doorOffset: -1.25,
  }, ['Laughter, a fiddle and the smell of honey cake spill out of the {Starlight Inn}.', 'Somebody inside is arguing, very cheerfully, about which star will fall first.'], { light: true });
  house('town_hall', 'Hearthwick Town Hall', 75.4, 47.25, {
    width: 5.5, depth: 4.5, stories: 2, wall: 'stone_brick', upperWall: 'plaster', roof: 'roof_blue', doorHood: true, chimney: false,
  }, ['A notice is nailed to the door: "{STARFALL FESTIVAL} — lanterns on the lake after dusk. Wishes at your own risk. — Mayor Bramblecote"'], { light: true });
  house('chapel', 'Chapel of the Fallen Stars', 82.5, 46.25, {
    width: 4.5, depth: 6, stories: 2, wall: 'stone_brick', upperWall: 'stone_brick', roof: 'roof_slate', gableFront: true, chimney: false, shutters: false,
  }, ['Candlelight flickers behind the chapel door. Inside, a quill scratches away — someone is writing down the stars.']);
  torch(73.8, 49.55, S_, 2.2); torch(77, 49.55, S_, 2.2);
  torch(81.15, 49.3, S_, 2.3); torch(83.85, 49.3, S_, 2.3);
  light(82.5, 45.8, { dy: 2.6, color: '#ffc98a', intensity: 7, distance: 7, flicker: 0.35 }); // candles behind the chapel windows

  // ---- the east side. The camera looks north, so a house hides about six units of ground behind
  // it: the bakery stands east of the chapel door (the chapel garden in front of the chapel stays
  // open), the smithy sits back from Lantern Lane with its forge in the open yard in front, and the
  // river-walk row leaves a gap in front of the forge (validate() checks every villager, door, sign,
  // well and campfire against the houses)
  house('bakery', "Crumb's Bakery", 86.2, 54.1, {
    width: 4.6, depth: 3.4, wall: 'timber_frame', roof: 'roof_red', sign: true, doorHood: true, doorOffset: -1.1,
  }, ['The door is warm to the touch. Behind it: cinnamon, burnt sugar and a very busy oven.'], { light: true });
  house('smithy', 'Ironwell Smithy', 81.5, 67.2, { width: 5, depth: 4, wall: 'stone_brick', roof: 'roof_slate', woodpile: true },
    ['A hammer rings inside — clang, clang, pause, clang — like a heartbeat with opinions.']);
  torch(79.7, 69.25, S_, 2.1, true); torch(83.3, 69.25, S_, 2.1);
  fire(79.6, 71.25, false, 0.3); // the open forge
  crates(84.2, 70.2, 2, 0.05); barrel(85.3, 61.4); barrel(84.6, 60.6, { height: 0.85 });
  // the chapel garden between Chapel lane and Lantern Lane
  bench(80.4, 54.8, S_, 1.6); flowers(79.2, 52.6, S_, 1.2); flowers(81.8, 52.6, S_, 1.2);

  // ---- the north gate: homes either side of the King's Road below the foothill stair
  house('lamplighter', "Lamplighter's Cottage", 66.5, 42, { width: 4, depth: 3, wall: 'timber_frame', roof: 'roof_red' },
    ['A note on the door: "Out lighting lamps. Back when they are all lit. (Forty-one, if you are counting. I am.)"'], { rotation: E_, light: true });
  house('rosewater', 'Rosewater House', 74.5, 42, { width: 4, depth: 3, wall: 'brick', roof: 'roof_blue', shutters: true },
    ['Someone is practising the festival song on a tin whistle. They have reached the difficult bit. They are staying there.'], { rotation: W_ });

  // ---- west of the Silverrun
  // (Hollyhock and Riverside stand beside, not behind, the houses south of them: their doors stay in view)
  house('hollyhock', 'Hollyhock Cottage', 50.9, 45, { width: 4.5, depth: 3.5, wall: 'plaster', roof: 'roof_thatch', woodpile: true, doorOffset: 1.2 },
    ['Hollyhocks nod by the door. A voice inside calls, "If that is the tax man, we are all out, including me."']);
  house('weaver', "The Weaver's House", 48.5, 52.5, { width: 5, depth: 3.5, stories: 2, wall: 'plaster', upperWall: 'timber_frame', roof: 'roof_red', doorOffset: 1.2 },
    ['The clack of a loom stops, then starts again. Someone is weaving star patterns into a festival banner, and losing count.']);
  house('riverside', 'Riverside Cottage', 45.6, 65, { width: 4, depth: 3, wall: 'stone_brick', roof: 'roof_slate' },
    ['Nobody answers. A cat on the windowsill regards you with the calm of a creature who owns the house.']);
  house('millhouse', 'The Old Millhouse', 50, 71.5, { width: 4.5, depth: 5.5, wall: 'wood_planks', roof: 'roof_thatch', gableFront: true, woodpile: true, shutters: false },
    ['The millwheel was taken down years ago, but the house still smells of flour and river water.']);

  // ---- south of the square: the tinker's behind the smithy yard, the row of homes on the river walk
  house('tinker', "Tinker's House", 86.6, 64.9, { width: 3.4, depth: 2.8, wall: 'brick', roof: 'roof_blue' },
    ['Something inside goes tick, tock, whirr, clunk. Then, faintly: "Oh, bother."'], { rotation: E_ });
  house('bluebell', 'Bluebell Cottage', 64.2, 85.4, { width: 4, depth: 3, wall: 'plaster', roof: 'roof_thatch', doorOffset: 0.9 },
    ['A child\'s drawing is pinned to the door: a very large star falling on a very small house. It is labelled "OURS".'], { light: true });
  house('cobbler', "The Cobbler's", 64.5, 72.5, { width: 4, depth: 3, wall: 'timber_frame', roof: 'roof_red', sign: true },
    ['A sign in the window: "Festival shoes mended while you dance. Please stop dancing first."']);
  // (one storey: from the square the camera looks over this row — a second storey filled a third
  // of the view with blurred roof)
  house('merrow', 'Merrow House', 76, 72.5, { width: 5, depth: 3, wall: 'brick', roof: 'roof_blue', doorOffset: -1.2 },
    ['Two voices argue inside about whether stars are hot. Neither of them has touched one. Both of them are certain.'], { light: true });
  house('quayside', 'Quayside Cottage', 85.2, 72.5, { width: 4, depth: 3, wall: 'wood_planks', roof: 'roof_slate' },
    ['Fishing nets hang drying by the door. The cottage smells pleasantly of tar and toast.']);

  // ---- the square: the well, three market stalls, benches, flowers
  well('square_well', 70, 57.5, [
    'The old well of {Hearthwick}. Coins glint far below — wishes from a hundred festivals.',
    'You make one of your own. Something in the deep water glimmers back. Probably a coin. Probably.',
  ]);
  // festival lanterns strung over the well: the square's centre was the darkest spot of the town
  light(70, 58.2, { dy: 2.6, color: '#ffc47a', intensity: 7, distance: 7.5, flicker: 0.12 });
  stall(65, 61.5, S_, 'cloth_stripe');
  stall(75, 61.5, S_, 'cloth_red');
  stall(63.8, 54.5, E_, 'cloth_red', 2.6);
  bench(67, 52.4, S_); bench(73, 52.4, S_);
  flowers(67.2, 50.3, S_, 1.4); flowers(73.3, 50.1, S_, 1.2); flowers(76.9, 50.1, S_, 1.2);
  flowers(80.95, 49.9, S_, 0.9); flowers(84.05, 49.9, S_, 0.9);
  // the green south of the square: benches facing the well, flower beds, a lamp
  bench(66, 66.4, N_, 1.8); bench(74.8, 66.4, N_, 1.8); flowers(63.6, 67.6, S_, 1.6); flowers(76.6, 67.6, S_, 1.4); flowers(66, 67.9, S_, 1.4); flowers(74.8, 67.9, S_, 1.4);
  lamp(68.3, 67.9, 'E'); lamp(72.7, 67.9, 'W');
  barrel(67.4, 60.7); crate(67.2, 62.3, 0.7); barrel(72.8, 60.7, { height: 0.9 }); crate(77.3, 61.9, 0.75);
  sign(72.7, 63.4, ["↑ {Mount Lumen} · the {Observatory}\n← {Goldenfield Farms} · → {Lake Mirrormere}\n↓ {Southgate} · {The Meadowlands}"], { boards: 3, rotation: -0.25, id: 'sign_square' });

  // ---- street lamps (the arm reaches over the street)
  lamp(68.4, 40.7, 'E'); lamp(72.6, 40.7, 'W');
  lamp(62.4, 51.4); lamp(77.6, 51.4); lamp(62.4, 64.6); lamp(77.6, 64.6);
  lamp(45.5, 56.4, 'S'); lamp(52.6, 56.4, 'S'); lamp(52.5, 60.6, 'N');
  lamp(79.6, 56.4, 'S'); lamp(83.2, 56.4, 'S'); lamp(85.6, 60.6, 'N');
  lamp(72.6, 72.8, 'W');
  lamp(68.4, 74.6, 'E'); lamp(72.6, 74.6, 'W'); lamp(68.4, 81.4, 'E'); lamp(72.6, 81.4, 'W');
  lamp(86.3, 69.5, 'S'); lamp(80, 74.6, 'S');
  lamp(62.3, 44.5, 'W'); lamp(53.7, 44, 'E'); lamp(53.6, 68.5, 'E');
  // gates
  sign(42.6, 60.9, ['→ {Hearthwick}\n← {Goldenfield Farms}'], { rotation: 0.2 });
  // (the town-side pointer to the Landing; the Landing's own sign welcomes you at the far end)
  sign(81.4, 56.7, ['→ {Mirrormere Landing} · the {East Road}\n↑ the {Chapel of the Fallen Stars}'], { rotation: -0.2 });

  // ---- bridges over the Silverrun
  bridge('millrace_bridge', 56.5, 58.5, 60.4, 58.5, 2.6, 1.0, 0.22, { name: 'Millrace Bridge' });
  bridge('fallsview_bridge', 56.6, 43, 60.4, 43, 1.7, 1.0, 0.18, { name: 'Fallsview Bridge' });
  bridge('southgate_bridge', 70.5, 76.6, 70.5, 80.8, 2.8, 1.0, 0.3, { name: 'Southgate Bridge' });

  // ---- yards, gardens and quays
  barrel(53.2, 69.8); barrel(53.4, 70.7, { height: 0.8 }); crate(53.3, 72.6, 0.8);
  barrel(83.1, 53.3); crate(83.1, 54.5, 0.7);
  bench(44.6, 48.6, E_, 1.6); flowers(49.8, 47.35, S_, 1.0); flowers(46.2, 47.35, S_, 1.0);
  flowers(51.4, 55.1, S_, 1.0); flowers(43.9, 67.55, S_, 1.0);
  fence(44.2, 60.9, 51.6, 60.9);
  flowers(83.5, 75.05, S_, 1.0);
  fence(61.2, 83.4, 61.2, 87.6); fence(61.2, 87.6, 62.6, 87.6); flowers(66.6, 87.6, S_, 1.2);
  critters('square_birds', 'bird', 70, 60.4, 5, 1.8, { seedBase: 300, spotOffsets: [[-0.6, -0.2], [0.5, 0.3], [-1.2, 0.5], [1.1, -0.1], [0.1, 0.8]] });
  critters('mill_cat', 'cat', 52.2, 66.4, 1, 3.2, { seedBase: 7 });
  emit('dust', 70, 57.5, [16, 3, 12], 36, 1.6);
  emit('fireflies', 58, 58, [5, 2, 32], 30, 0.8);
  emit('mist', 58.5, 38.4, [8, 1.6, 4], 14, 0.4);
  emit('sparkle', 58.5, 38.4, [7, 0.5, 3.5], 8, 0.3, { params: { life: [0.5, 1.1] } });
}

/** Goldenfield Farms — fields, the windmill knoll, the farmhouse and barn, the orchard. */
function goldenfield() {
  add('windmill', { id: 'windmill', x: 15.5, z: 48.5, rotation: 0.15, opts: { height: 6.4, roof: 'roof_red' } });
  keepClear(15.8, 50.8, 1.3, 'windmill door');
  house('farmhouse', 'Barleycorn Farmhouse', 29.5, 50.5, { width: 5, depth: 3.5, wall: 'plaster', roof: 'roof_thatch', woodpile: true, doorHood: true, doorOffset: -1 },
    ['The farmhouse door is ajar. Inside, someone is singing to a pie. The pie does not seem to mind.'], { light: true });
  house('barn', 'The Old Barn', 36.5, 50, { width: 5.5, depth: 6, wall: 'log_wall', roof: 'roof_thatch', gableFront: true, chimney: false, shutters: false },
    ['The barn smells of hay and patience. A cow regards you with polite indifference, then goes back to her thoughts.']);
  torch(35.1, 53.05, S_, 2.2);
  well('farm_well', 25.4, 54.6, ['The farm well. The bucket comes up with cold water, a leaf and a very surprised beetle.']);
  bench(31.9, 54.6, S_); flowers(30.9, 52.6, S_, 1.0);
  lamp(26.6, 56.2, 'S');
  barrel(33.3, 54.8); crate(38.6, 55.4, 0.7);
  hay(24.6, 45.2, 1.1); hay(27.2, 44.2, 0.8); hay(30.4, 45.6, 0.9);
  hay(11.5, 59.3, 0.9); hay(13.4, 59.6, 0.7); hay(15.8, 68.8, 1.0); hay(13.6, 68.8, 0.8); hay(21.2, 79.2, 0.9);
  // the chicken yard east of the barn (the gate on the south side, toward the road)
  fence(39.9, 46.6, 43.4, 46.6); fence(43.4, 46.6, 43.4, 55.2); fence(39.4, 55.2, 40.9, 55.2); fence(42.3, 55.2, 43.4, 55.2);
  fence(39.4, 53.25, 39.4, 55.2); // (the barn is the pen's west wall: close the gap south of it)
  critters('chickens', 'chicken', 41.6, 51, 6, 3.2, { area: { minX: -1.4, maxX: 1.5, minZ: -3.9, maxZ: 3.8 }, seed: 4242, seedBase: 100 });
  critters('biscuit', 'dog', 30.5, 56.3, 1, 3.4, { seedBase: 31 });
  // field fences and hedges
  fence(4.2, 68.3, 12.6, 68.3); fence(21.7, 61, 21.7, 67.4); fence(11.5, 70.2, 11.5, 79.6);
  fence(12.2, 76.6, 20.6, 76.6); fence(26.4, 58.6, 33.6, 58.6);
  sign(21.3, 55.4, ['↑ {The Old Quarry} · → {Hearthwick}\n↓ {Emberwood} · ↖ the {windmill}'], { rotation: 0.15, boards: 2 });
  // the orchard: rows of oaks and birches (a few autumn-red fruit trees) south of the Orchard walk.
  // The camera looks north: the first row stands about six units off the walk, so a walker on it is
  // never behind a crown, and the West Road north of the walk stays open; odd columns are staggered
  // so the crowns read as rows instead of one canopy
  const orng = new RNG('starfall:orchard');
  for (let c = 0; c < 5; c++) {
    for (let r = 0; r < 3; r++) {
      const x = 27.5 + c * 3.4 + orng.range(-0.4, 0.4);
      const z = 72.1 + r * 3.9 + (c % 2 ? 1.0 : 0) + orng.range(-0.4, 0.4);
      const kind = orng.chance(0.2) ? 'autumn' : (c + r) % 3 === 0 ? 'birch' : 'oak';
      tree(kind, x, z, r === 0 ? orng.range(3.4, 4.3) : orng.range(3.8, 5.0));
    }
  }
  emit('leaves', 34, 76, [17, 3.5, 12], 24, 2.4);
  emit('dust', 12, 64, [18, 3, 10], 26, 1.4);
  emit('fireflies', 8, 44, [7, 2, 6], 18, 0.8);
}

/** Mount Lumen — the Three Sisters, the observatory, the lookout, the stairs, the spring. */
function mountLumen() {
  waterfall('spring_fall', 62, 4, 2, 'S', { mist: { count: 10, alpha: 0.06 }, splash: false });
  waterfall('sisters_high', 62, 20, 2, 'S', { mist: { count: 16, alpha: 0.07 } });
  waterfall('sisters_mid', 58, 28, 2, 'S', { mist: { count: 14, alpha: 0.07 } });
  waterfall('sisters_low', 60, 36, 2, 'S', { mist: { count: 16, alpha: 0.07 } });
  emit('mist', 60.5, 21.8, [8, 1.4, 4], 14, 0.4); emit('mist', 58, 29.8, [7, 1.4, 4], 12, 0.4);
  emit('sparkle', 60.5, 21.8, [7, 0.5, 3.5], 8, 0.3, { params: { life: [0.5, 1.1] } });
  emit('sparkle', 58, 29.8, [6, 0.5, 3.5], 7, 0.3, { params: { life: [0.5, 1.1] } });
  emit('sparkle', 61.5, 6.5, [5.5, 0.5, 4.5], 8, 0.3, { params: { life: [0.5, 1.2] } });
  emit('mist', 61.5, 6.5, [6, 1.4, 5], 10, 0.5);
  // bridges on the mountain
  bridge('spring_bridge', 60.3, 15, 63.7, 15, 1.8, 7.5, 0.2, { name: 'Spring Footbridge' });
  bridge('terrace_bridge', 56.3, 25.5, 59.7, 25.5, 1.7, 4.5, 0.18, { name: 'Terrace Footbridge' });
  bridge('sisters_crossing', 58.3, 33.5, 61.7, 33.5, 1.7, 2.5, 0.18, { name: "Sisters' Crossing" });

  // the observatory ruin: the star lens, instruments, the Stargazer's cottage
  house('observatory', 'The Lumen Observatory', 74, 6.6, { width: 4.4, depth: 3.2, stories: 2, wall: 'stone_brick', upperWall: 'stone_brick', roof: 'roof_blue', gableFront: true, chimney: false, shutters: false },
    ['The tower door is propped open with a very old book. Up the winding stair, a brass telescope points at the sky, patient as a heron.'], { light: true });
  torch(72.3, 8.25, S_, 2.2); torch(75.7, 8.25, S_, 2.2);
  light(74, 11.8, { dy: 1.3, color: '#a8d8ff', intensity: 12, distance: 9, flicker: 0.06, nightOnly: false });
  emit('sparkle', 74, 11.8, [2.2, 1.6, 2.2], 10, 0.9, { params: { life: [0.6, 1.4] } });
  crate(71.4, 10.9, 0.7); crate(71.9, 10.1, 0.6); barrel(76.6, 10.3); crate(76.9, 11.3, 0.65);
  bench(71.9, 13.4, S_, 1.4, false);
  rock(69.4, 14.8, 0.8); rock(79.5, 15.2, 0.7); rock(68.4, 10.6, 1.1); rock(80.1, 8.6, 0.9);
  house('stargazer_cottage', "Stargazer's Cottage", 83, 8.2, { width: 4, depth: 3, wall: 'timber_frame', roof: 'roof_red', doorOffset: -0.8 },
    ['A brass plate on the door: "M. CASIMIR VEY — ASTRONOMER. If out, look up."'], { light: true });
  torch(81.6, 9.75, S_, 2.0);
  lamp(71.2, 14.6, 'top'); lamp(76.8, 14.6, 'top');
  sign(70.5, 16.2, ['↑ the {Lumen Observatory} · ← {Lumen Lookout}\n→ the {Amberpine} stair'], { rotation: 0.2 });
  sign(77.9, 14.2, ['The {Lumen Observatory}. Built to watch the sky; these days it mostly watches the weather.'], { rotation: -0.3, boards: 1 });
  // the lookout over the vale
  bench(46.4, 18.55, S_); lamp(47.4, 15.8, 'top');
  sign(44.2, 17.2, ['{Lumen Lookout}. On a clear night you can count every roof in {Hearthwick}. Please don\'t; it upsets the Stargazer.'], { boards: 1, rotation: 0.3 });
  // the switchbacks, the terrace and the foothills
  lamp(68.4, 35.3, 'E'); lamp(72.6, 35.3, 'W'); lamp(68.4, 27.4, 'E'); lamp(74.8, 26.5, 'top'); lamp(77.4, 21.4, 'top');
  sign(72.9, 33.6, ['↑ the {Observatory} on {Mount Lumen}\n↓ {Hearthwick} · ← the {Three Sisters}'], { rotation: -0.2 });
  sign(68.2, 25.6, ['↑ {Observatory} — by the switchbacks\n→ {Amberpine Heights} · ← {Three Sisters}'], { rotation: 0.25 });
  sign(62.6, 32.2, ['{The Three Sisters}. Eldest, middle, youngest — stand still and you can hear them bicker.'], { boards: 1, rotation: 0.1 });
  // an empty goat pen on the terrace (the goats will not come down tonight)
  fence(78.6, 20.4, 84.6, 20.4); fence(84.6, 20.4, 84.6, 23.4); fence(78.6, 20.4, 78.6, 23.4);
  critters('lumen_birds', 'bird', 66.5, 17.2, 3, 1.5, { seedBase: 340 });
}

/** The Old Quarry and the mossy ruins of Old Lumen (north-west upland). */
function oldQuarry() {
  torch(21, 10.05, S_, 1.6); torch(29.45, 16, W_, 1.5);
  lamp(19.4, 19.4, 'top');
  crates(25, 21, 3, 0.25); barrel(26.8, 18.4); barrel(25.6, 17.3, { height: 0.8, lying: true, rotation: 1.2 }); crate(26, 14.5, 0.8);
  fence(15.9, 13.8, 18.1, 13.8); fence(15.9, 16.2, 18.1, 16.2); // round the old shaft
  sign(19, 15, ['The old shaft. Nobody knows how deep it goes. Someone dropped a pebble in last spring; they are still listening.'], { boards: 1, rotation: -0.2 });
  sign(22.8, 34.4, ['↑ {The Old Quarry} · ↖ the ruins of {Old Lumen}\nMind the edges. The edges do not mind you.'], { rotation: 0.2 });
  sign(31.6, 21, ['→ {Mount Lumen} terrace\n↓ {Goldenfield Farms}'], { rotation: -0.15 });
  emit('dust', 21, 17, [14, 3, 11], 34, 1.4);
  // star-glass glinting in the quarry's stone (Dunstan's "glittery bits")
  emit('sparkle', 22.5, 14.5, [9, 0.5, 7], 8, 0.3, { params: { life: [0.5, 1.2] } });
  // the ruins
  well('old_well', 7.5, 29.6, ['The well of {Old Lumen}. They say it never ran dry, even in the long drought.', 'Lean close and you can hear it: a low hum, like somebody far below practising a very old song.'], 'roof_slate');
  crates(5.2, 20.4, 2, 0.2, 0.7); bench(4.9, 25.6, E_, 1.4, false);
  lamp(11.4, 24.6, 'top');
  sign(10.6, 19.6, ['{Old Lumen} — the first town in the vale. Abandoned when the winters won the argument.'], { boards: 1, rotation: 0.3 });
}

/** Lake Mirrormere — the fishing hamlet on its decks, piers, the island, beaches, the campfire. */
function mirrormere() {
  // the two cabins leave a lane between them: the East Road comes down it onto the decks
  house('tench_cabin', "Tench's Cabin", 93.8, 60.8, { width: 2.8, depth: 2.8, wall: 'wood_planks', roof: 'roof_blue', doorOffset: 0.6 },
    ['A note pinned to the door: "Gone fishing. If I am not back, I have caught something big. Send help. Or a bigger net."'], { light: true });
  house('reed_cabin', "Reed's Cabin", 89.4, 60.9, { width: 2.8, depth: 2.8, wall: 'wood_planks_dark', roof: 'roof_thatch', doorOffset: -0.6 },
    ['The smell of smoked trout drifts under the door. Somebody inside is mending a net and humming the {Starfall} song, badly.']);
  well('hamlet_well', 91, 66.6, ['The hamlet well. The water tastes faintly of the lake, and faintly of starlight — whatever that tastes like. Cold, mostly.']);
  bridge('pier_long', 94.7, 66.5, 102.6, 66.5, 1.8, 0.5, 0, { pier: true, name: 'The Long Pier' });
  bridge('pier_north', 96.6, 61.5, 102.4, 61.5, 1.6, 0.5, 0, { pier: true, name: 'North Pier' });
  bridge('pier_south', 95.6, 71, 100.4, 71, 1.6, 0.5, 0, { pier: true, name: 'South Pier' });
  bench(93.3, 68.8, E_, 1.6);
  lamp(95.4, 63.6, 'top'); lamp(88.4, 66.9, 'top'); lamp(95.1, 72.8, 'top'); lamp(87.6, 57.3, 'S');
  crates(90.6, 71.2, 3, 0.1, 0.8); barrel(88.9, 69.3); barrel(89.6, 68.8, { height: 0.85 }); crate(94.3, 69.2, 0.7); crate(88.6, 74.1, 0.7);
  bench(90.2, 73.6, S_, 1.6, false);
  emit('smoke', 94.4, 73.2, [1.2, 2.6, 1.2], 8, 1.4); // the fish-smoking rack
  sign(87.4, 58.2, ['{Mirrormere Landing} — fresh fish, old stories.\n← {Hearthwick} · ↓ {Reedmouth}'], { rotation: 0.2 });
  critters('hamlet_cat', 'cat', 91.6, 67.5, 1, 2.4, { seedBase: 19 });
  // Reedmouth: a bridge over the river mouth, the lakeside campfire on the beach
  bridge('reedmouth_bridge', 92, 75.3, 92, 81.7, 2, 0.5, 0.32, { name: 'Reedmouth Bridge' });
  fire(93.5, 85.2, true);
  sign(90.2, 82.6, ['↑ {Mirrormere Landing} · ← {The Meadowlands}\n↓ the {South Beach}'], { rotation: 0.2 });
  // the island of the sleeping stars (out of reach)
  tree('birch', 110.6, 70.6, 4.8);
  rock(112.2, 71.7, 1.3);
  light(111.3, 71.2, { dy: 0.4, color: '#9ec9ff', intensity: 7, distance: 8, flicker: 0.35 });
  emit('sparkle', 111, 71, [12, 0.6, 9], 11, 0.3, { params: { life: [0.6, 1.4] } });
  emit('sparkle', 106, 57, [12, 0.5, 10], 8, 0.25, { params: { life: [0.5, 1.2] } });
  emit('sparkle', 104, 90, [14, 0.5, 10], 9, 0.25, { params: { life: [0.5, 1.2] } });
  // Starfall night: after dusk the sleeping stars rise under the water where the villagers send you —
  // off the end of the Long Pier and by the North Pier (the fireflies preset only shows at night)
  const starGlow = { params: { color: '#a8d8ff', colorEnd: '#fff4c8' } };
  emit('fireflies', 104.5, 66.5, [10, 0.8, 8], 44, 0.3, starGlow);
  emit('fireflies', 101, 58.8, [6, 0.8, 4], 18, 0.3, starGlow);
  light(104.2, 66.6, { dy: 0.9, color: '#9ec9ff', intensity: 9, distance: 9, flicker: 0.4 }); // their glow on the water off the pier's end
  emit('mist', 112.5, 43, [10, 1.4, 5], 16, 0.4);
  emit('fireflies', 104, 102.5, [16, 2, 5], 28, 0.9);
  emit('fireflies', 96.5, 84, [6, 2, 8], 16, 0.9);
  // the beaches
  bench(96.8, 104.6, N_, 1.6); rock(95.2, 100.8, 0.9); rock(110.4, 103.2, 0.8); rock(113.4, 101.8, 1.2);
  bench(109.8, 100.55, N_, 1.2); // the end of the shore path: a seat facing the lake
  sign(111.9, 103, ['The {South Beach}. The best seat in the vale for the far side of the sky.'], { boards: 1, rotation: -0.2 });
  critters('beach_birds', 'bird', 106.5, 102.8, 4, 1.8, { seedBase: 360 });
  bench(97.2, 44.8, S_, 1.6); rock(95.4, 46.9, 1.1); rock(105.4, 47.8, 0.8);
  sign(99.8, 49.2, ['↑ {Amberpine Heights} · the {Mirror Falls}\n↓ {Mirrormere Landing}'], { rotation: -0.2 });
  rock(119.8, 74.8, 1.0); rock(120.4, 80.6, 0.7);
}

/** Amberpine Heights — the NE highland: the Mirror Falls and its lookout. */
function amberpine() {
  waterfall('mirror_falls', 113, 40, 2, 'S', { mist: { count: 18, alpha: 0.07 } });
  emit('sparkle', 112.8, 24.6, [5, 0.5, 3.5], 6, 0.3, { params: { life: [0.5, 1.1] } });
  bench(108.6, 36.6, S_, 1.6); lamp(106.4, 35.8, 'top');
  sign(110.3, 33.6, ['{Mirror Falls}. Do not lean. The lake has enough stars.'], { boards: 1, rotation: -0.2 });
  sign(103.8, 17, ['← the {Mount Lumen} plateau\n↓ {Mirror Falls} · the {North Shore}'], { rotation: 0.2 });
  sign(105.6, 41.4, ['↑ {Amberpine Heights}\n↓ the {North Shore} of {Mirrormere}'], { rotation: -0.2 });
}

/** The Meadowlands — the troupe camp, the King's Road, the meadow pond, lone oaks on knolls. */
function meadowlands() {
  stall(62, 95.8, S_, 'cloth_red', 3.4); // the troupe's painted booth, its stage in front
  fire(62.4, 99.7, true);
  bench(59.8, 101.9, N_, 1.8); bench(65, 101.9, N_, 1.8);
  stall(56.4, 100.6, E_, 'cloth_stripe', 2.6); // Signor Orsino's ribbon booth
  lamp(58.3, 96.3, 'top'); lamp(65.6, 95.2, 'top'); lamp(60.4, 104.6, 'top');
  light(62, 97.4, { dy: 2.2, color: '#ffc27a', intensity: 9, distance: 8, flicker: 0.25 });
  crates(57.4, 104.4, 2, 0.3, 0.8); barrel(66.4, 102.9); barrel(67.1, 103.7, { height: 0.9 }); barrel(57.4, 95.6, { lying: true, rotation: 0.3 });
  sign(72.6, 95, ['→ {Lake Mirrormere}\n← the {Wandering Lanterns} troupe'], { rotation: -0.2 });
  sign(67.4, 107.4, ['← {Emberwood} · the {Woodcutter\'s Camp}\n↑ {Hearthwick}'], { rotation: 0.25 });
  sign(72.8, 122.2, ['↑ {Hearthwick} · {The Meadowlands}\nWelcome to {Starfall Vale}!'], { rotation: -0.15, id: 'sign_welcome' });
  sign(68.2, 124.3, ['The King\'s Road, to the lowlands.\nSomeone has chalked underneath: "The festival is the OTHER way."'], { rotation: 0.2 });
  // the toll gate is shut for the festival: a fence across the road, crates stacked against it
  fence(68.9, 124.75, 72.1, 124.75); barrel(72.8, 124.2, { height: 0.9 }); crate(73.6, 124.3, 0.7);
  lamp(68.2, 88, 'E'); lamp(72.6, 102.5, 'W'); lamp(68.4, 113, 'E'); lamp(72.6, 119.6, 'W');
  // the meadow pond
  bench(80.8, 107.8, S_, 1.6); rock(86.6, 110.4, 0.8); rock(79.4, 114.2, 0.6);
  critters('meadow_birds', 'bird', 76.5, 104.6, 3, 1.4, { seedBase: 380 });
  // lone trees on the knolls
  tree('oak', 58.2, 114.3, 7.4); /* the Wishing Oak */ tree('oak', 79.6, 120.2, 5.3); tree('birch', 84.8, 99.3, 5); tree('birch', 86.2, 101.2, 4.4); tree('oak', 49.6, 93.4, 5.2);
  emit('petals', 66, 110, [30, 4, 18], 50, 2.6);
  emit('petals', 80, 118, [20, 4, 10], 26, 2.4);
  emit('fireflies', 83, 112, [10, 2.2, 8], 30, 0.9);
  emit('fireflies', 60, 112, [22, 2.2, 12], 34, 1);
  emit('embers', 62.4, 99.7, [2.4, 2.5, 2.4], 14, 0.8);
}

/** Emberwood — the autumn forest: the woodcutter's camp, the hunter, the hidden glade. */
function emberwood() {
  house('lodge', 'Birchwood Lodge', 36.5, 93, { width: 4.5, depth: 3.5, wall: 'log_wall', roof: 'roof_thatch', woodpile: true, doorHood: true },
    ['An axe leans by the door, polished to a mirror shine. A sign underneath: "Do not touch the axe. The axe knows."']);
  fire(32.8, 94.4, true);
  crates(30.4, 91.4, 3, 0.2); barrel(40.3, 92.2, { lying: true, height: 1.3, rotation: 0.2 }); barrel(40.5, 93.6, { lying: true, height: 1.2, rotation: 0.5 });
  crate(38.9, 96.3, 0.8); rock(28.4, 96.2, 0.5);
  lamp(33.4, 90.6, 'top');
  sign(26.6, 99.4, ['↙ {The Hidden Glade}\n→ {The Meadowlands} · ↑ {Goldenfield Farms}'], { rotation: 0.2 });
  // the hunter's post
  fence(14.8, 94.4, 17.6, 94.4); crates(19.2, 91.2, 2, 0.6, 0.75); barrel(13.6, 92.2);
  // the hidden glade: the hermit's hut, the standing stones, their glow
  house('hermit_hut', "The Hermit's Hut", 11.4, 108.6, { width: 3.4, depth: 2.8, wall: 'stone_brick', roof: 'roof_thatch', woodpile: true },
    ['No answer — then, from somewhere behind you: "I\'m not in. Try the stones."']);
  light(16.5, 111.8, { dy: 1.0, color: '#bfe6ff', intensity: 6, distance: 7, flicker: 0.45 });
  emit('sparkle', 16.5, 111.8, [4, 2, 4], 10, 1.0, { params: { life: [0.8, 1.6] } });
  emit('petals', 15, 111, [13, 3, 11], 30, 2.2);
  emit('fireflies', 15, 111, [13, 2, 11], 30, 1.0);
  sign(25.6, 113.4, ['{The Hidden Glade}. Please knock. There is no door. Knock anyway.'], { boards: 1, rotation: 0.2 });
  // atmosphere
  emit('leaves', 30, 100, [26, 4, 20], 50, 2.8);
  emit('leaves', 14, 92, [18, 4, 14], 32, 2.8);
  emit('leaves', 34, 117, [18, 4, 12], 28, 2.8);
  emit('fireflies', 36, 106, [9, 2.2, 7], 26, 0.9);
  emit('fireflies', 22, 98, [20, 2.4, 14], 36, 1.2);
  emit('smoke', 32.8, 94.4, [1.2, 2, 1.2], 6, 2.6);
}

/** Outlying homesteads and the small things that make the vale feel lived in. */
function extras() {
  // Goldenfield: a cottage by the farm pond, a hedgerow along the south edge, more hay
  house('pondside', 'Pondside Cottage', 6.8, 51.3, { width: 4, depth: 3, wall: 'timber_frame', roof: 'roof_thatch', woodpile: true },
    ['Ducks have left very muddy footprints all over the doorstep. The ducks, apparently, live here now.']);
  fence(4.2, 54.9, 9.4, 54.9); flowers(5, 53.5, S_, 1.0);
  for (let k = 0; k < 7; k++) tree(k % 2 ? 'birch' : 'oak', 4.8 + k * 2.6 + (k % 3) * 0.3, 82.6 + (k % 2) * 0.5, 4.2 + (k % 3) * 0.4);
  hay(18.4, 58.9, 0.8); hay(7.6, 69.6, 0.9); hay(18.8, 73, 1.0);
  lamp(22.2, 64, 'W'); lamp(24.6, 74, 'E');
  // the Meadowlands: Brambleberry Cottage and its hens, a pasture by the river, a picnic spot
  house('brambleberry', 'Brambleberry Cottage', 88.6, 117.2, { width: 4, depth: 3, wall: 'plaster', roof: 'roof_red', doorOffset: -0.8 },
    ['A pie cools on the windowsill, guarded by a very serious cat drawn in chalk on the wall.'], { light: true });
  fence(84.2, 119.8, 84.2, 123.4); fence(84.2, 123.4, 92.6, 123.4); fence(92.6, 119.8, 92.6, 123.4);
  critters('bramble_hens', 'chicken', 88.4, 121.6, 4, 2.2, { area: { minX: -3.6, maxX: 3.6, minZ: -1.2, maxZ: 1.4 }, seed: 911, seedBase: 150 });
  bench(85.8, 116.2, E_, 1.6); flowers(86.2, 119.4, S_, 1.0); barrel(91.2, 119.1);
  fence(45.4, 83.6, 55.6, 83.6); fence(55.6, 83.6, 55.6, 89.6); fence(45.4, 83.6, 45.4, 89.6);
  hay(48.2, 86.4, 1.0); hay(51.6, 87.4, 0.8);
  bench(54.2, 118.4, S_, 1.6); rock(52.2, 117.6, 0.7);
  lamp(68.2, 108.6, 'E'); lamp(72.8, 114.6, 'W');
  // Emberwood: the forager's hut, fallen logs along the trails
  house('forager', "The Forager's Hut", 42, 116.6, { width: 3.6, depth: 3, wall: 'log_wall', roof: 'roof_thatch', chimney: true },
    ['Mushrooms of every colour hang drying under the eaves. A note: "The red ones are for looking at. NOT for soup."']);
  barrel(44.8, 117.4, { lying: true, height: 1.3, rotation: 1.1 }); crates(37.6, 114.2, 2, 0.4, 0.7);
  barrel(45.6, 102.4, { lying: true, height: 1.4, rotation: 0.2 }); barrel(24.6, 106.6, { lying: true, height: 1.3, rotation: 1.4 });
  // Mount Lumen: the star cairn on the terrace, rocks by the springs
  rock(90.4, 22.6, 1.4); rock(92.3, 24, 0.7); bench(88.2, 23.4, S_, 1.6);
  sign(92.6, 22.2, ['The {Star Cairn}. Every pilgrim adds a stone. Nobody remembers who added the first one, but everybody agrees it was a very good stone.'], { boards: 1, rotation: -0.2 });
  rock(58.2, 5.2, 0.9); rock(65.6, 7.6, 1.0); rock(64.8, 9.6, 0.6);
  // Mirrormere: the heron-watcher's bench on the spit, looking at the island
  rock(117.4, 76.2, 0.9); rock(119.4, 77.2, 0.6);
  bench(121.5, 75.8, W_, 1.4);
  critters('heron_birds', 'bird', 119.8, 75.4, 2, 1.0, { seedBase: 470 });
  sign(120.6, 77.6, ['{The Heron Spit}. The herons were here first. They would like that noted.'], { boards: 1, rotation: 0.2 });
  // the south-east meadows: Bramble Hollow, a quiet corner past the South Beach
  bench(108.6, 115.4, S_, 1.6); lamp(106.6, 114.6, 'top'); flowers(110.8, 115.3, S_, 1.2);
  critters('hollow_birds', 'bird', 113.5, 116.8, 3, 1.6, { seedBase: 480 });
  sign(104.6, 116.2, ['{Bramble Hollow}. Blackberries in autumn, nettles the rest of the year, and the quietest seat for the stars.'], { boards: 1, rotation: 0.2 });
  // Hearthwick: a little garden in the north-west corner
  bench(45.2, 41.4, S_, 1.6); flowers(47.4, 41.3, S_, 1.2); tree('birch', 43.8, 43.6, 4.6);

  // ---- the Wishing Oak on its knoll in the Meadowlands, ribbons and all
  sign(60.6, 116.6, ['{The Wishing Oak}. Folk tie a ribbon here and make a wish, and tell nobody — especially not the oak. It gossips.'], { boards: 1, rotation: -0.2 });
  bench(57.8, 117.4, S_, 1.6); flowers(55.8, 116.4, S_, 1.2);
  emit('fireflies', 58.2, 114.3, [6, 1.6, 5], 22, 4.0);
  // wish lanterns hung in its branches: after dark the oak is the meadow's beacon (the light hangs
  // in the front of the crown and lights the leaves the camera sees from below)
  light(58.2, 116.8, { dy: 5.0, color: '#ffcf8a', intensity: 12, distance: 10, flicker: 0.25 });
  // ---- lamps along the lake shore and the West Road, milestones on the King's Road
  lamp(93.6, 75, 'W'); lamp(89.2, 90.2, 'E'); lamp(95.8, 101.8, 'N'); lamp(104.4, 106.2, 'N');
  lamp(97.4, 51.6, 'W'); lamp(38.8, 56.6, 'S'); lamp(31.6, 56.2, 'S');
  for (const [x, z] of [[72.6, 90.6], [68.4, 97.2], [72.6, 109], [68.3, 118.6]]) rock(x, z, 0.45);
  // ---- pasture fences along the King's Road through the Meadowlands
  fence(67.8, 84.4, 67.8, 90.4); fence(73.4, 104.8, 73.4, 111.6); fence(67.6, 120.6, 67.6, 123.6);
  // ---- a bench and flowers at the Southgate green, flower boxes on the river walk
  bench(76.4, 82.6, S_, 1.6); flowers(74.6, 83.8, S_, 1.2); flowers(62.8, 76.9, N_, 1.2); flowers(78.8, 76.9, N_, 1.2);
  // ---- the orchard gate and the farm lane lamps
  fence(26, 61.2, 26, 64.2); fence(26, 67.6, 26, 70.8);
  // ---- more life on the terrace and the highland trail
  bench(99.4, 12.2, S_, 1.4); rock(97.6, 11.4, 0.8);
  critters('highland_birds', 'bird', 104.5, 22.5, 3, 1.4, { seedBase: 420 });
  critters('farm_birds', 'bird', 13, 58.8, 4, 2, { seedBase: 440 });
  emit('petals', 70, 58, [14, 4, 12], 22, 3.2);
  emit('leaves', 111, 18, [16, 4, 18], 30, 3);
}

// =============================================================================================
// 2c. People of the vale — tonight is the Starfall Festival
// =============================================================================================

function npc(id, name, preset, x, z, portraitColor, dialogue, o = {}) {
  const { wander = 1.2, speed = 1, facing = 'down', action = 'none', item = '', behaviour = 'wander', ...extra } = o;
  keepClear(x, z, Math.max(1.4, wander + 0.9), `npc ${id}`);
  return add('npc', { id, x, z, name, preset, facing, wander, speed, portraitColor, action, item, behaviour, script: '', dialogue, ...extra });
}
const ask = (text, ...choices) => ({ text, choices });

function people() {
  // ---- Hearthwick
  npc('aldous', 'Mayor Aldous Bramblecote', 'elder', 73.8, 53.4, '#c9a45c', [
    'Welcome, welcome to {Hearthwick}! You have arrived on the best night of the year, traveller — tonight is the {Starfall Festival}.',
    'Once a year the sky over the vale lets go of a few stars. Where they land is anyone\'s guess. Mostly the lake. Once, regrettably, my hat.',
    ask('Have you been up to see {Master Casimir} at the observatory?', 'Not yet', 'Who is he?'),
    'Our Stargazer. Follow the {King\'s Road} north, up the stairs past the falls. He will tell you when the first star is due. He has never once been wrong. Late, occasionally. Never wrong.',
  ], { wander: 1.2, speed: 0.8 });
  npc('marigold', 'Marigold Fenn', 'innkeeper', 65.6, 51.5, '#d9776a', [
    'Welcome to the {Starlight Inn}! Every bed is spoken for tonight — but I always keep one aired for a traveller with tired feet.',
    'Half the vale is in town for the festival. The other half is pretending not to be, so they can arrive late and complain about the crowds.',
    ask('Tired already? Rest now and you will sleep right through the stars, mind.', 'I will stay up', 'Rest until morning'),
  ], { wander: 0.6, action: 'rest' });
  npc('barnaby', 'Barnaby Crumb', 'villager', 83.6, 57.6, '#e0a85a', [
    'Mind the flour, friend — it gets everywhere this week. I found some in my eyebrows this morning. Both of them.',
    '{Starlight Buns}! Honey, cinnamon and a sugar star on top. Folk eat one when the lake first lights up. Tradition also says three beforehand, to be safe.',
    ask('Care for one? Still warm.', 'Maybe later', 'Yes, please'),
  ], { wander: 0.8, action: 'shop', item: 'Starlight Bun' });
  npc('garrick', 'Garrick Ironwell', 'swordsman', 81, 71.7, '#b85c38', [
    'Stand clear of the forge, friend. The sparks don\'t care who you are, and neither, frankly, do I until I have finished this hinge.',
    'Sister Amarantha keeps a little bell up in the chapel rafters. My grandmother forged it from a fallen star. Or from a cooking pot. Depends which uncle you ask.',
    'If you\'re off to the {Old Quarry}, tell {Dunstan} his pickaxe is mended. And that I\'ve stopped believing his stories about star-glass. Mostly.',
  ], { wander: 0.5 });
  npc('quentin', 'Quentin Fairweather', 'merchant', 65, 60.05, '#78b35b', [
    'Lanterns! Paper lanterns! Half the vale floats one on {Lake Mirrormere} after dusk, and the sleeping stars rise to see who is knocking — or so the song goes.',
    'Folded every one myself. I have not felt my thumbs since Tuesday.',
    ask('One lantern, freshly folded?', 'Just looking', 'I\'ll take one'),
  ], { wander: 0.3, speed: 0.8, behaviour: 'post', action: 'shop', item: 'Paper Lantern', talkOffset: [0, 3.15], talkRadius: 1.5 });
  npc('nell', 'Old Nell', 'innkeeper', 75, 60.05, '#9ab0d8', [
    'Moonpetal tea, dearie. The petals only open under starlight, so I pick them at night. My knees have filed a complaint.',
    'Settles the stomach, calms the nerves and keeps a body awake for the falling stars. Also excellent for gossip.',
    ask('A cup for the road?', 'No, thank you', 'A cup, please'),
  ], { wander: 0.3, speed: 0.7, behaviour: 'post', action: 'shop', item: 'Moonpetal Tea', talkOffset: [0, 3.15], talkRadius: 1.5 });
  npc('tamsin', 'Tamsin Bloom', 'dancer', 62.45, 54.5, '#e27aa8', [
    'Starblooms from the {Meadowlands}! Folk wear a garland on Starfall night, so the stars know who their friends are.',
    'I danced with the {Wandering Lanterns} troupe once. Then I discovered I like sleeping in the same bed twice. Their camp is down the {King\'s Road}, south of the river.',
    ask('A garland, then?', 'Not today', 'One garland'),
  ], { wander: 0.3, speed: 0.8, behaviour: 'post', facing: 'right', action: 'shop', item: 'Starbloom Garland', talkOffset: [2.95, 0], talkRadius: 1.5 });
  npc('hobb', 'Sergeant Hobb Vane', 'guard', 72.9, 82.6, '#6a8fd6', [
    'Halt! Name and business— ah. Festival guest. You have the look: slightly lost, faintly hopeful.',
    'The {Meadowlands} are south of the bridge. The travelling troupe has camped by the road; their bard has played the same song for three days. It is growing on me. Like moss.',
    'Keep to the paths after dark. The {Emberwood} is lovely by day and full of opinions by night.',
  ], { wander: 0.4, speed: 0.9, behaviour: 'post', facing: 'left' });
  npc('amarantha', 'Sister Amarantha', 'cleric', 79.9, 51.3, '#a7c7e7', [
    'Peace be with you. Our little chapel keeps the {Star Register}: every star that has fallen on the vale, written down by candlelight.',
    'Three hundred and twelve, as of last year. Most of them fell into {Lake Mirrormere}. The old folk say the lake keeps them, sleeping under the water until they are needed.',
    ask('Do you believe it?', 'I\'d like to', 'Stars are just rocks'),
    'Belief is a lantern, friend. It does not change the dark — it only lets you see a little further into it.',
  ], { wander: 0.8, speed: 0.8 });
  npc('poppy', 'Poppy', 'child', 67.6, 59.4, '#f5a07a', [
    'Did you know? If you drop a coin in the well on Starfall night, a star comes up instead of water.',
    'I have dropped eleven coins. Nothing yet. I think the stars are shy. Or saving up.',
    '{Grandmother Isolde} at the lake says the stars sleep under the water. That\'s silly. Stars can\'t swim. ...Can they?',
  ], { wander: 2.2, speed: 1.6 });

  // ---- Goldenfield Farms
  npc('hollis', 'Hollis Barleycorn', 'farmer', 17.5, 68.6, '#cfb25a', [
    'Evening. Barley\'s in, hay\'s stacked, and the dog has been brushed for the festival. We are as ready as we will ever be.',
    'My granddad swore a star once landed in this very field. Grew the tallest wheat you ever saw. Tasted of pepper, mind. We don\'t talk about the pepper.',
    'Mind the dog. {Biscuit} is friendly, but she herds anything that moves. Including, last spring, the mayor.',
  ], { wander: 2.2, speed: 0.9 });
  npc('wendel', 'Wendel the Miller', 'villager', 19.6, 52.8, '#d8c07a', [
    'The mill is turning sweetly tonight. The wind always picks up before a Starfall — my brother says that\'s nonsense. My brother also says the dog understands poetry.',
    ask('Off to watch the stars later?', 'Of course', 'If I stay awake'),
    'Then climb the stairs north of the farm to the {Old Quarry}. Best view of the western sky, if you don\'t mind a little dust in your tea.',
  ], { wander: 1.2, speed: 0.9 });
  npc('tansy', 'Tansy', 'child', 41.6, 52.4, '#f59a6a', [
    'Shh! I\'m catching {Duchess Feathers}. She\'s the fat one. She\'s also the fastest, which is SO unfair.',
    'If I catch her before the first star falls, I get a wish. Gran says that\'s not how wishes work. Gran hasn\'t met Duchess.',
  ], { wander: 2.5, speed: 2.2, behaviour: 'chase', area: { minX: -1.3, maxX: 1.4, minZ: -5.2, maxZ: 2.3 } });

  // ---- Mount Lumen
  npc('casimir', 'Master Casimir Vey', 'scholar', 75.5, 12.7, '#a569b3', [
    'Ah — a visitor, and on Starfall night! Mind the stones. The old observatory has been falling down for three hundred years; it is in no particular hurry.',
    'I am counting the sky. When {the Lantern of Lyra} climbs over the peak, the stars begin to fall. Tonight, just after dusk — unless the sky is feeling shy.',
    ask('Do you know the old story? About the lake?', 'Tell me', 'The sleeping stars?'),
    'Long ago a whole river of stars fell into {Lake Mirrormere}. They did not burn out. They sleep there still, and every Starfall a few of them wake and glimmer up through the water, to answer the sky.',
    'Go and see for yourself after dark. And ask {Grandmother Isolde} at the fishing hamlet — she has watched them rise more times than I have counted stars. Well. Nearly.',
  ], { wander: 1.0, speed: 0.7 });
  npc('rowan', 'Rowan the Wayfarer', 'cleric', 44.6, 18.6, '#8fb3d9', [
    'Quite a view, isn\'t it? The whole vale laid out like a quilt, with the {Silverrun} stitching it together.',
    'I have walked a hundred roads, but I always come back for Starfall. Something about this place makes the sky feel closer.',
    ask('Where are you headed afterwards?', 'Somewhere new', 'Same as you, maybe'),
    'Ha! Wherever the road goes, I\'d wager we\'ll both be back next year, pretending we just happened to be passing.',
  ], { wander: 0.8, speed: 0.8 });
  npc('gorse', 'Old Gorse', 'farmer', 65.4, 26.6, '#9c8a5a', [
    'The goats won\'t come down tonight. They know. Animals always know when the sky is about to do something foolish.',
    'Those falls there — the {Three Sisters}, we call them. Eldest at the top, youngest at the bottom, and all three of them talking at once.',
    'The stair east of here climbs to the {Observatory}. Mind the switchbacks. The last fellow who ran up them is still telling everyone about it.',
  ], { wander: 1.4, speed: 0.7 });

  // ---- The Old Quarry
  npc('dunstan', 'Dunstan Flint', 'guard', 21.8, 15.2, '#8a8f98', [
    'Careful down here. The quarry is older than the town, and half as polite.',
    'See the glittery bits in the stone? {Star-glass}. You find it wherever a star has struck the ground. I keep a jar of it at home. My wife calls it a jar of gravel. We agree to disagree.',
    'Going up to see the Stargazer? Take the steps on the east side of the upland to the terrace. Saves you the long way round through town.',
    'Garrick mended my pick, did he? Tell him the star-glass is real. And that he still owes me a hinge.',
  ], { wander: 1.5, speed: 0.8 });
  npc('ptolemy', 'Professor Ptolemy Marrow', 'scholar', 7.4, 24.4, '#6fa89a', [
    'Don\'t step on that! Oh — it\'s just moss. Carry on. I am mapping the ruins of {Old Lumen}, the first town in the vale.',
    'They built it up here to be closer to the sky. Then the winters reminded them why nobody lives closer to the sky, and they moved down to the river and called it {Hearthwick}.',
    'The old well still stands. They say it hums on Starfall night. I have brought a notebook, just in case it hums something important.',
  ], { wander: 1.0, speed: 0.7 });

  // ---- Lake Mirrormere
  npc('isolde', 'Grandmother Isolde', 'innkeeper', 92.4, 68.3, '#c9a0dc', [
    'Sit, sit. My bones are older than the pier, and the pier creaks less.',
    'You want the story. Everyone does, on Starfall. Very well: the stars that fell into {Mirrormere} long ago never went out. They sleep on the lakebed, curled up like cats in a sunbeam.',
    'When the sky calls, they answer — little lights rising under the water. I saw it first when I was younger than you, and every year since, and I weep every time. Don\'t tell the fishermen.',
    ask('Will you watch tonight?', 'I wouldn\'t miss it', 'From where?'),
    'The end of the {Long Pier} is the best seat in the vale, after dusk. And nobody rows out to the little island — that glow is the stars\' own.',
  ], { wander: 0.4, speed: 0.6 });
  npc('marlow', 'Marlow Tench', 'villager', 101.8, 66.5, '#5f8fb0', [
    'Shh — you\'ll scare the fish. Or I will. I have been talking to them all afternoon.',
    'Caught nothing but an old boot and a very philosophical frog. The fish are all watching the sky tonight. Can\'t say I blame them.',
  ], { wander: 0.2, speed: 0.6, behaviour: 'post', facing: 'right' });
  npc('wick', 'Wick Reed', 'farmer', 101.6, 61.5, '#7aa0a8', [
    'The water is so still tonight you could read your fortune in it. Mine says: more bait.',
    'Grandmother Isolde says the sleeping stars are right under us. Twenty years I have fished here and never hooked one. Probably for the best. Imagine the paperwork.',
  ], { wander: 0.2, speed: 0.6, behaviour: 'post', facing: 'right' });
  npc('finn', 'Finn Ashdown', 'swordsman', 92.4, 84.4, '#c05050', [
    'Pull up a log. The fire is warm and the company is... well, it\'s me, so it\'s adequate.',
    'I came to Starfall to find a fallen star, sell it and retire. Then I saw the lake at dusk and forgot all about selling anything.',
    ask('Ever seen a star up close?', 'Not yet', 'Maybe tonight'),
    'Here\'s hoping. If one lands in this fire, though, it\'s mine. Those are the rules.',
  ], { wander: 0.6, speed: 0.8 });
  npc('ivo', 'Warden Ivo', 'hunter', 107.4, 34.4, '#4f8a5f', [
    'You found the {Mirror Falls}. Most folk never climb this far — they stop at the observatory and stare at the Stargazer.',
    'From here you can see the whole of {Mirrormere}. Come back after dark: when the stars wake, the lake lights up as if someone spilled the sky into it.',
    'The stair below drops to the {North Shore}. Watch your step on the ledge — the pines have roots like tripwires.',
  ], { wander: 1.0, speed: 0.8 });

  // ---- The Meadowlands: the Wandering Lanterns troupe
  npc('lark', 'Lark Silverstring', 'bard', 60.2, 97.7, '#8c2330', [
    'Welcome, welcome! The {Wandering Lanterns}, at your service. I\'m {Lark} — the one with the lute and the questionable singing voice.',
    'This one is called {Where the Stars Come Home}. I wrote it on the shore of Mirrormere, the year the lake lit up so bright the fish got sunburnt.',
    'Sit, listen — this one\'s for you.',
  ], { wander: 0, speed: 1, behaviour: 'perform', action: 'music', talkRadius: 1.7 });
  npc('saffi', 'Saffi', 'dancer', 64.4, 97.9, '#e0604a', [
    'Oh! You caught me mid-twirl. I\'m practising the {Star Dance} — every step is a star falling. The spinning part is the lake. Or dizziness. It\'s hard to tell.',
    '{Signor Orsino} says I dance like a comet. I have decided that is a compliment.',
  ], { wander: 0, speed: 1, behaviour: 'perform', talkRadius: 1.7 });
  npc('orsino', 'Signor Orsino', 'merchant', 55.1, 100.6, '#d4a04a', [
    'Ribbons, charms and fortunes, my friend! The fortunes are free. The ribbons, alas, are also free — it is festival night and I am feeling generous.',
    'Folk tie them to the old stones in the {Emberwood} glade and make a wish. The hermit pretends to disapprove. He is secretly delighted.',
    ask('A ribbon for luck?', 'Not now', 'Yes, please'),
  ], { wander: 0.3, speed: 0.8, behaviour: 'post', facing: 'right', action: 'shop', item: 'Festival Ribbon', talkOffset: [2.95, 0], talkRadius: 1.5 });

  // ---- Emberwood
  npc('ansel', 'Ansel Birchwood', 'hunter', 34.6, 97.2, '#a0703f', [
    'Evenin\'. Or mornin\'. Time goes funny in the woods. The leaves fall, I split logs, the leaves fall some more.',
    'Every Starfall I build the big bonfire for the troupe. Three cartloads. Their bard sings me a song about it. It is mostly about my axe.',
    'There\'s an old glade south-west of here, down the steps past the big trees. The {hermit} lives there. Knock politely. Knock twice if you have brought biscuits.',
  ], { wander: 1.2, speed: 0.9 });
  npc('kestrel', 'Kestrel', 'hunter', 16.4, 92.6, '#3f7a3c', [
    'Quiet. There\'s a stag in the birches that has been giving me the slip since summer. I think it\'s winning.',
    'I don\'t hunt on Starfall, mind. Tonight the forest belongs to the fireflies. After dusk the whole {Emberwood} glows like the embers of a hearth.',
  ], { wander: 0.4, speed: 0.8, behaviour: 'post', facing: 'right' });
  npc('thistle', 'Old Thistle', 'elder', 16.5, 111.9, '#7fae6a', [
    'Hm. A visitor. The stones told me someone would come. Well — one of them did. The others are sulking.',
    'These stones mark where the first star fell, before the vale had a name. It didn\'t land here, mind — it landed in the lake — but the stones were stubborn about it and stayed anyway.',
    ask('Do you hear them singing?', '...No?', 'I think I do'),
    'Listen tonight, when the stars fall. Everything in the vale hums along — the lake, the woods, even the mayor, if he has had enough cider.',
  ], { wander: 0.8, speed: 0.6 });
}

// =============================================================================================
// 2d. Regions (HUD location plate; first match wins, so the small places come first)
// =============================================================================================

function regions() {
  const R = (name, sub, minX, maxX, minZ, maxZ, { minY = null, banner = '' } = {}) => add('region', { minX, maxX, minZ, maxZ, name, sub, minY, banner });
  const hi = 7.2; // plateau (L15 = 7.5)
  R('The Lumen Observatory', 'Mount Lumen', 66, 81, 4, 16, { minY: hi, banner: 'Home of the Stargazer' });
  R('Lumen Lookout', 'Mount Lumen', 40, 52, 12, 22, { minY: hi });
  R('Silverspring', 'Mount Lumen', 56, 67, 4, 12, { minY: hi });
  R('Mount Lumen', 'The Plateau', 38, 98, 0, 22, { minY: hi, banner: 'The roof of the vale' });
  R("Stargazer's Steps", 'Mount Lumen', 66, 79, 18, 28, { minY: 4.2 });
  R('The Three Sisters', 'Mount Lumen', 50, 67, 18, 41, { banner: 'Three falls, one river' });
  R('The High Terrace', 'Mount Lumen', 34, 98, 18, 30, { minY: 4.2 });
  R('The Foothills', 'Mount Lumen', 32, 100, 26, 39, { minY: 2.2 });
  R('Mirror Falls', 'Amberpine Heights', 103, 120, 26, 40, { minY: 4.2 });
  R('Amberpine Heights', 'Above Mirrormere', 94, 125, 3, 40, { minY: 4.2, banner: 'Pines above the mirror' });
  R('The North Shore', 'Lake Mirrormere', 93, 110, 36, 53);
  R('Old Lumen', 'The Old Quarry', 3, 13, 10, 35, { minY: 2.8, banner: 'Ruins of the first town' });
  R('The Old Quarry', 'Starfall Vale', 3, 38, 3, 38, { banner: 'Where the first stones were cut' });
  R('The Windmill', 'Goldenfield Farms', 8, 23, 42, 56);
  R('Barleycorn Farm', 'Goldenfield Farms', 23, 45, 40, 58);
  R('Goldenfield Orchard', 'Goldenfield Farms', 25, 44, 61, 83);
  R('Goldenfield Farms', 'Starfall Vale', 3, 44, 37, 84, { banner: 'Barley, windmills and wishes' });
  R('Hearthwick Square', 'Hearthwick', 61, 79, 50, 66);
  R('Chapel Row', 'Hearthwick', 78, 87, 40, 52);
  R('Southgate', 'Hearthwick', 60, 81, 74, 84);
  R('Hearthwick', 'The Market Town', 43, 88, 38, 80, { banner: 'The market town of the vale' });
  R('Mirrormere Landing', 'Lake Mirrormere', 83, 99, 56, 75, { banner: 'Fresh fish, old stories' });
  R('Reedmouth', 'Lake Mirrormere', 84, 99, 75, 90);
  R('The South Beach', 'Lake Mirrormere', 90, 125, 93, 112);
  R('Bramble Hollow', 'The Meadowlands', 95, 125, 112, 125);
  R('Lake Mirrormere', 'Starfall Vale', 87, 125, 36, 112, { banner: 'Where the stars sleep' });
  R('The Troupe Camp', 'The Meadowlands', 50, 70, 91, 106, { banner: 'The Wandering Lanterns' });
  R('The Meadowlands', 'Starfall Vale', 43, 95, 80, 125, { banner: 'Flowers as far as the lantern-light' });
  R('The Hidden Glade', 'Emberwood', 4, 26, 100, 122, { banner: 'Where the first star is remembered' });
  R("Woodcutter's Camp", 'Emberwood', 26, 43, 88, 102);
  R('Emberwood', 'Starfall Vale', 3, 45, 83, 125, { banner: 'The forest that remembers autumn' });
}

// =============================================================================================
// 2e. Rule-based scatter: trees and rocks (clear of paths, water, stairs, doors, NPCs, props)
// =============================================================================================

/** Tile distance (Chebyshev) to the nearest path / stair tile, capped at 30. */
function pathDistance() {
  const dist = new Int16Array(W * D).fill(30);
  const q = [];
  for (let k = 0; k < W * D; k++) if (pathMask[k]) { dist[k] = 0; q.push(k); }
  for (let h = 0; h < q.length; h++) {
    const k = q[h];
    const i = k % W; const j = (k - i) / W;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!inMap(i + di, j + dj)) continue;
      const n = I(i + di, j + dj);
      if (dist[n] > dist[k] + 1) { dist[n] = dist[k] + 1; q.push(n); }
    }
  }
  return dist;
}

/**
 * Sightlines: the camera looks north, so a tree standing just south of a villager, a door or a
 * landmark hides it. `w` = half width, `depth` = how far south the view stays clear.
 */
const VIEWS = [];
const view = (x, z, w, depth) => VIEWS.push({ x, z, w, depth });
function sightlines() {
  for (const o of objects) {
    if (o.type === 'npc') view(o.x, o.z, 3, 9);
    else if (o.type === 'house') { const d = doorOf(o); view(d.x, d.z - 1, 2.5, 8.5); }
    else if (o.type === 'well' || o.type === 'campfire' || o.type === 'signpost') view(o.x, o.z, 2, 4.5);
  }
  view(15, 111.5, 8, 14); // the hidden glade (down to the border: its south side is where you stand)
  view(21, 17, 9, 12); // the quarry pit
  view(74, 11, 6, 7); // the observatory
  view(60, 24, 6, 16); // the Three Sisters
  view(70, 58, 9, 12); // Hearthwick square
  view(61, 98, 7, 8); // the troupe camp
  view(93, 65, 6, 9); // the fishing hamlet
  view(113, 36, 5, 6); // the Mirror Falls lookout
  view(58.2, 114.3, 5, 10); // the Wishing Oak
  view(83, 111.5, 6, 8); // the meadow pond
  view(104, 104, 12, 7); // the South Beach
  view(117.5, 76, 4, 6); // the Heron Spit
  view(36, 106, 5, 7); // the Emberwood pond
  view(7.5, 23.5, 5, 8); // the ruins of Old Lumen
  view(91, 23, 5, 7); // the Star Cairn
  view(70.5, 121.5, 8, 7); // the spawn on the King's Road
  view(41.6, 58.5, 2, 6); // the West Road at the chicken-yard gate
  view(110.5, 101.4, 4, 7); // the South Beach bench
  view(108.6, 115.4, 5, 8); // Bramble Hollow
}

const TREE_RULES = {
  emberwood: { keep: 1.0, spacing: 2.0, pathGap: 2, south: 3, kinds: [['autumn', 58], ['oak', 20], ['birch', 14], ['pine', 8]], h: [4.2, 6.2] },
  glade: { keep: 0.3, spacing: 3.2, pathGap: 2, south: 2, kinds: [['birch', 60], ['autumn', 40]], h: [3.6, 4.8] },
  plateau: { keep: 0.8, spacing: 2.5, pathGap: 2, south: 4, kinds: [['pine', 72], ['birch', 16], ['oak', 12]], h: [4.4, 6.4] },
  terrace: { keep: 0.55, spacing: 2.7, pathGap: 2, south: 4, kinds: [['pine', 60], ['oak', 22], ['birch', 18]], h: [4.2, 6] },
  foothills: { keep: 0.45, spacing: 3, pathGap: 2, south: 4, kinds: [['oak', 40], ['pine', 35], ['birch', 25]], h: [4, 5.6] },
  highland: { keep: 1.0, spacing: 2.3, pathGap: 2, south: 3, kinds: [['pine', 74], ['birch', 14], ['autumn', 12]], h: [4.6, 6.6] },
  ledge: { keep: 0.5, spacing: 3, pathGap: 2, south: 3, kinds: [['pine', 70], ['birch', 30]], h: [4, 5.5] },
  upland: { keep: 0.25, spacing: 3, pathGap: 2, south: 4, kinds: [['pine', 45], ['birch', 30], ['oak', 25]], h: [4, 5.6] },
  ruins: { keep: 0.3, spacing: 3.6, pathGap: 2, south: 3, kinds: [['oak', 50], ['birch', 50]], h: [4, 5.2] },
  quarry: { keep: 0.07, spacing: 5, pathGap: 2, south: 3, kinds: [['birch', 100]], h: [3.6, 4.4] },
  farm: { keep: 0.12, spacing: 4.5, pathGap: 2, south: 6, kinds: [['oak', 60], ['birch', 40]], h: [4.2, 5.4] },
  town: { keep: 0.05, spacing: 5, pathGap: 2, south: 5, kinds: [['birch', 50], ['oak', 50]], h: [4.2, 5] },
  meadow: { keep: 0.16, spacing: 4.2, pathGap: 3, south: 6, kinds: [['oak', 55], ['birch', 30], ['autumn', 15]], h: [4.4, 6] },
  lakeside: { keep: 0.45, spacing: 3.2, pathGap: 2, south: 6, kinds: [['birch', 40], ['oak', 30], ['pine', 30]], h: [4.2, 5.8] },
};
const ROCK_RULES = {
  quarry: 0.8, upland: 0.22, ruins: 0.3, plateau: 0.15, observatory: 0.08, terrace: 0.13, foothills: 0.1, highland: 0.12,
  ledge: 0.16, lakeside: 0.07, emberwood: 0.08, glade: 0.04, meadow: 0.022, farm: 0.012,
};
const NATURAL = new Set(['g', 'G', 'f', 'm']);
const HARD = new Set(['~', 'p', 'w', 'o', 'e', '^', 'v', '>', '<', 'b', 'k', 'c', ':', ' ']);

function pickKind(rng, kinds) {
  const total = kinds.reduce((s, k) => s + k[1], 0);
  let r = rng.range(0, total);
  for (const [k, w] of kinds) { if ((r -= w) <= 0) return k; }
  return kinds[kinds.length - 1][0];
}

/**
 * Tree crowns as src/engine/world/props/Trees.js builds them (broadleaf: 2 × 2 leaf cards on
 * clusters at 0.48–0.72 of a flattened ellipsoid; pine: cone tiers from 0.19 H to the top, base
 * radius 0.34 H). The sightline corridors above test trunks only, so a big crown whose trunk
 * stands just outside one can still hide a villager, a door, a sign, a well or a campfire.
 * Per kind: [crown radius / H, horizontal radius / crown radius, vertical radius / crown radius] —
 * Trees.js `KINDS[kind].crown` and its `radii`: [1, flat] for a broadleaf, the hard-coded
 * [0.78, 1.05] for a birch (Trees.js does not read its birch `flat`, 1.25, either).
 */
const CROWN_KINDS = { oak: [0.44, 1, 0.8], autumn: [0.43, 1, 0.78], birch: [0.3, 0.78, 1.05] };
function crownOf(t) {
  const H = t.opts?.height ?? 4.5;
  const kind = t.opts?.kind ?? 'oak';
  const y = groundY(t.x, t.z);
  if (kind === 'pine') return { t, pine: true, x: t.x, z: t.z, y, H };
  const [k, fx, fy] = CROWN_KINDS[kind] ?? CROWN_KINDS.oak;
  const birch = kind === 'birch';
  const Rc = H * k;
  const rx = Rc * fx;
  const ry = Rc * fy;
  return { t, x: t.x, z: t.z, cy: y + H - ry * 0.78 - (birch ? 0.35 : 0.2), rx: rx * 0.66 + 0.75, ry: ry * 0.66 + 0.75 };
}
function inCrown(c, px, py, pz) {
  if (c.pine) {
    const h = py - c.y;
    if (h < c.H * 0.19 || h > c.H) return false;
    return Math.hypot(px - c.x, pz - c.z) < 0.9 * c.H * 0.34 * (c.H - h) / (c.H * 0.81);
  }
  const dx = (px - c.x) / c.rx; const dy = (py - c.cy) / c.ry; const dz = (pz - c.z) / c.rx;
  return dx * dx + dy * dy + dz * dz < 1;
}
/**
 * How much of a figure at (x, z) — a 0.5-wide column from h0 to h1 above the ground — the default
 * camera (yaw 0, pitch 32°, looking north) sees through tree crowns: `share` hidden and, per tree,
 * how many of the 15 sample rays its crown stops.
 */
function crownCover(x, z, h0, h1, crowns) {
  const CAMP = (32 * Math.PI) / 180;
  const sy = Math.sin(CAMP); const sz = Math.cos(CAMP);
  const near = crowns.filter((c) => c.z > z - 1 && c.z < z + 16 && Math.abs(c.x - x) < 6);
  const y0 = groundY(x, z);
  const by = new Map();
  let n = 0; let hid = 0;
  for (const ox of [-0.25, 0, 0.25]) {
    for (let k = 0; k <= 4; k++) {
      n++;
      const py = y0 + h0 + ((h1 - h0) * k) / 4;
      let hit = null;
      for (let s = 0.3; s < 22 && !hit; s += 0.15) for (const c of near) if (inCrown(c, x + ox, py + sy * s, z + sz * s)) { hit = c.t; break; }
      if (hit) { hid++; by.set(hit, (by.get(hit) ?? 0) + 1); }
    }
  }
  return { share: hid / n, by };
}
/** What the camera must see past the tree crowns: villagers (and their talk spots), door fronts, signs, wells, campfires. */
function sightTargets() {
  const out = [];
  for (const o of objects) {
    // (the traveller usually stands just south of a villager or a sign, facing up the screen)
    if (o.type === 'npc') {
      out.push({ what: `villager ${o.id}`, x: o.x, z: o.z, h0: 0.25, h1: 1.6 });
      if (o.talkOffset) out.push({ what: `the talk spot of ${o.id}`, x: o.x + o.talkOffset[0], z: o.z + o.talkOffset[1], h0: 0.25, h1: 1.6 });
      else {
        out.push({ what: `the talk spot south of ${o.id}`, x: o.x, z: o.z + 1.1, h0: 0.25, h1: 1.6 });
        // …and the side a villager at a post faces (Kestrel watches the trail to the east)
        const f = { right: [1.1, 0], left: [-1.1, 0], up: [0, -1.1] }[o.facing];
        if (f) out.push({ what: `the talk spot the ${o.id} faces`, x: o.x + f[0], z: o.z + f[1], h0: 0.25, h1: 1.6 });
      }
    } else if (o.type === 'house') { const d = doorOf(o); out.push({ what: `the door of ${o.id}`, x: d.x, z: d.z, h0: 0.25, h1: 1.6 }); }
    else if (o.type === 'signpost') {
      out.push({ what: `signpost ${o.id}`, x: o.x, z: o.z, h0: 0.4, h1: 1.8 });
      out.push({ what: `the reading spot of ${o.id}`, x: o.x, z: o.z + 0.9, h0: 0.25, h1: 1.6 });
    } else if (o.type === 'well') out.push({ what: `well ${o.id}`, x: o.x, z: o.z, h0: 0.3, h1: 2.2 });
    else if (o.type === 'campfire') out.push({ what: `campfire ${o.id}`, x: o.x, z: o.z, h0: 0.1, h1: 0.8 });
  }
  return out;
}
/** Take an object out again (objects list, collider hash). */
function removeObject(o) {
  const k = objects.indexOf(o);
  if (k >= 0) objects.splice(k, 1);
  for (let i = allShapes.length - 1; i >= 0; i--) if (allShapes[i].owner === o) allShapes.splice(i, 1);
  for (const list of shapeGrid.values()) for (let i = list.length - 1; i >= 0; i--) if (list[i].owner === o) list.splice(i, 1);
}
/**
 * After every seeded placement (so no other tree, rock or prop moves): drop the scattered trees
 * whose crowns would hide a sight target from the camera (half its figure or more). Hand-placed
 * trees are left to validate(), which fails the level when one of them does it.
 */
function clearCrowns() {
  const crowns = objects.filter((o) => o.type === 'tree').map(crownOf);
  const removed = [];
  for (const s of sightTargets()) {
    for (;;) {
      const r = crownCover(s.x, s.z, s.h0, s.h1, crowns);
      if (r.share < 0.25) break;
      const victim = [...r.by.entries()].filter(([t]) => SCATTERED.has(t)).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!victim) break;
      removeObject(victim);
      SCATTERED.delete(victim);
      crowns.splice(crowns.findIndex((c) => c.t === victim), 1);
      removed.push(victim.id);
    }
  }
  return removed;
}

/** Trees placed by the scatter (the others are hand-placed: validate() checks them against the sightlines). */
const SCATTERED = new Set();
function scatterTrees(maxTrees) {
  const rng = new RNG('starfall:trees');
  const dist = pathDistance();
  const trees = objects.filter((o) => o.type === 'tree').map((o) => ({ x: o.x, z: o.z }));
  const houses = allShapes.filter((c) => c.owner.type === 'house' || c.owner.type === 'windmill');
  const cands = [];
  for (let z = 0.8; z < D; z += 1.6) for (let x = 0.8; x < W; x += 1.6) cands.push([x + rng.range(-0.7, 0.7), z + rng.range(-0.7, 0.7)]);
  rng.shuffle(cands);
  let placed = 0;
  for (const [x, z] of cands) {
    if (trees.length >= maxTrees) break;
    const i = Math.floor(x); const j = Math.floor(z);
    if (!inMap(i, j) || !NATURAL.has(T(i, j))) continue;
    const rule = TREE_RULES[Z(i, j)];
    if (!rule) continue;
    const mask = fbm2(x * 0.075, z * 0.075, { seed: 90, octaves: 3 });
    if (!rng.chance(rule.keep * clamp(0.2 + (mask - 0.3) * 3.5, 0, 1))) continue;
    if (dist[I(i, j)] < rule.pathGap) continue;
    let bad = false;
    for (let dj = -1; dj <= 1 && !bad; dj++) for (let di = -1; di <= 1; di++) if (HARD.has(T(i + di, j + dj) ?? ' ')) { bad = true; break; }
    if (bad) continue;
    // the camera looks north: no tall tree right south of a path (it would hide the walker)
    for (let dj = 1; dj <= rule.south && !bad; dj++) for (let di = -1; di <= 1; di++) if (inMap(i + di, j - dj) && pathMask[I(i + di, j - dj)]) { bad = true; break; }
    if (bad && !rng.chance(0.04)) continue;
    if (inClearZone(x, z, 1.4) || blockedAt(x, z, 1.3)) continue;
    if (lampZones.some((l) => (l.x - x) ** 2 + (l.z - z) ** 2 < 3.6 * 3.6)) continue;
    if (houses.some((c) => hitShape(c, x, z, 2.5))) continue;
    if (VIEWS.some((v) => z > v.z && z < v.z + v.depth && Math.abs(x - v.x) < v.w)) continue;
    const sp = rule.spacing * 0.85;
    if (trees.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < sp * sp)) continue;
    const kind = pickKind(rng, rule.kinds);
    const h = lerp(rule.h[0], rule.h[1], clamp(rng.next() * 0.7 + (mask - 0.3) * 0.8, 0, 1));
    SCATTERED.add(tree(kind, x, z, h));
    trees.push({ x, z });
    placed++;
  }
  return placed;
}

function scatterRocks(maxRocks) {
  const rng = new RNG('starfall:rocks');
  const dist = pathDistance();
  const cands = [];
  for (let z = 1.1; z < D; z += 2.2) for (let x = 1.1; x < W; x += 2.2) cands.push([x + rng.range(-0.9, 0.9), z + rng.range(-0.9, 0.9)]);
  rng.shuffle(cands);
  let n = objects.filter((o) => o.type === 'rock').length;
  let placed = 0;
  for (const [x, z] of cands) {
    if (n >= maxRocks) break;
    const i = Math.floor(x); const j = Math.floor(z);
    if (!inMap(i, j) || !(NATURAL.has(T(i, j)) || T(i, j) === 'd' || T(i, j) === 's')) continue;
    const p = ROCK_RULES[Z(i, j)];
    if (!p || !rng.chance(p)) continue;
    if (dist[I(i, j)] < 1) continue;
    const big = Z(i, j) === 'quarry' ? 1.8 : 1.3;
    const size = 0.5 + rng.next() ** 1.8 * (big - 0.5);
    const rr = 0.7 * size * 1.1 * (size >= 1 ? 1.25 : 1);
    if (inClearZone(x, z, rr + 0.4) || blockedAt(x, z, rr + 0.25)) continue;
    let nearPath = false;
    for (let dj = -2; dj <= 2 && !nearPath; dj++) for (let di = -2; di <= 2; di++) if (inMap(i + di, j + dj) && pathMask[I(i + di, j + dj)] && Math.hypot(i + di + 0.5 - x, j + dj + 0.5 - z) < rr + 0.9) { nearPath = true; break; }
    if (nearPath) continue;
    let bad = false;
    for (let dj = -1; dj <= 1 && !bad; dj++) for (let di = -1; di <= 1; di++) { const ch = T(i + di, j + dj) ?? ' '; if ('^v<>bkc: '.includes(ch)) { bad = true; break; } }
    if (bad) continue;
    rock(x, z, size);
    n++;
    placed++;
  }
  return placed;
}

/**
 * Lived-in houses: a few barrels, crates and flower boxes against the side and back walls of every
 * home (never in front of the door, on paths, in water or on uneven ground), chosen by a seeded RNG.
 */
function dressHouses() {
  const rng = new RNG('starfall:dressing');
  let n = 0;
  for (const h of objects.filter((o) => o.type === 'house')) {
    const a = h.rotation ?? 0;
    const hw = h.opts.width / 2; const hd = h.opts.depth / 2;
    const slots = [
      ['side', -hw - 0.65, rng.range(-hd + 0.4, hd - 0.4)], ['side', hw + 0.65, rng.range(-hd + 0.4, hd - 0.4)],
      ['back', rng.range(-hw + 0.6, hw - 0.6), -hd - 0.6], ['front', (h.opts.doorOffset ?? 0) > 0 ? -hw + 0.8 : hw - 0.8, hd + 0.45],
    ];
    rng.shuffle(slots);
    let placed = 0;
    for (const [where, lx, lz] of slots) {
      if (placed >= 2 + (rng.chance(0.4) ? 1 : 0)) break;
      const [dx, dz] = rot(lx, lz, a);
      const x = h.x + dx; const z = h.z + dz;
      const i = Math.floor(x); const j = Math.floor(z);
      if (!inMap(i, j) || pathMask[I(i, j)] || HARD.has(T(i, j)) || BLOCKED.has(T(i, j)) || L(i, j) !== L(Math.floor(h.x), Math.floor(h.z))) continue;
      if (inClearZone(x, z, 0.3) || blockedAt(x, z, 0.55, (ow) => ow === h)) continue;
      const d = doorOf(h);
      if ((d.x - x) ** 2 + (d.z - z) ** 2 < 2.2 ** 2) continue;
      if (where === 'front') flowers(x, z, a, 1.1);
      else if (rng.chance(0.5)) barrel(x, z, { height: rng.range(0.85, 1.05), lying: rng.chance(0.2) });
      else if (rng.chance(0.6)) crate(x, z, rng.range(0.6, 0.85));
      else {
        // a pair of barrels along the wall
        const [ex, ez] = rot(where === 'side' ? 0 : 0.92, where === 'side' ? 0.92 : 0, a);
        const bi = Math.floor(x + ex); const bj = Math.floor(z + ez);
        const ok = inMap(bi, bj) && !pathMask[I(bi, bj)] && !HARD.has(T(bi, bj)) && !BLOCKED.has(T(bi, bj)) && L(bi, bj) === L(i, j) && !blockedAt(x + ex, z + ez, 0.46);
        barrel(x, z, { height: 0.95 });
        if (ok) { barrel(x + ex, z + ez, { height: 0.8 }); n++; }
      }
      placed++;
      n++;
    }
  }
  return n;
}

// =============================================================================================
// 3. Environment
// =============================================================================================

function environment() {
  return {
    timeOfDay: 17.4,
    clock: true,
    weather: 'clear',
    border: 'forest',
    outerScenery: true,
    godRays: true,
    dust: true,
    music: true,
    camera: { distance: 30, pitch: 32 },
    highGround: { minY: 4.2, pitch: 40 },
    title: { title: 'STARFALL VALE', subtitle: 'Where the Stars Come Home', prompt: 'Press any key', credit: 'A Luminati 2.5D showcase · three.js' },
    titleCamera: { x: 97, z: 62, y: 0.6, driftX: 5, driftZ: 3, distance: 42 },
    // thinner haze than the game default: the vale's far layers stay readable at dawn and dusk
    fogScale: 0.65,
    // open meadow past the south edge: the camera looks north from beyond it, so the outer woods
    // would stand between it and the spawn on the King's Road
    scenery: { southGap: 10 },
    // the forest border, the deep-forest patches and the outer woods take the kinds of the land
    // they stand in (world rects, first match wins; the rest keep the game's automatic mix)
    forest: {
      areas: [
        { minX: -60, maxX: 46, minZ: 83, maxZ: 200, kinds: { autumn: 5, oak: 2, birch: 2, pine: 1 } }, // Emberwood
        { minX: 94, maxX: 200, minZ: -60, maxZ: 44, kinds: { pine: 5, autumn: 3, birch: 1 } }, // Amberpine Heights
        { minX: 36, maxX: 94, minZ: -60, maxZ: 30, kinds: { pine: 6, birch: 2, oak: 2 } }, // Mount Lumen
        { minX: -60, maxX: 36, minZ: -60, maxZ: 38, kinds: { pine: 4, oak: 3, birch: 3 } }, // the Old Quarry
        { minX: -60, maxX: 46, minZ: 38, maxZ: 83, kinds: { oak: 5, birch: 3, pine: 1, autumn: 1 } }, // Goldenfield
        { minX: 94, maxX: 200, minZ: 44, maxZ: 200, kinds: { birch: 3, oak: 3, pine: 2, autumn: 2 } }, // Mirrormere
        { minX: 46, maxX: 94, minZ: 83, maxZ: 200, kinds: { oak: 5, birch: 3, autumn: 2 } }, // the Meadowlands
      ],
    },
    godRayAreas: [
      { minX: 44, maxX: 86, minZ: 40, maxZ: 76, y: 1, count: 6, seed: 7 },
      { minX: 4, maxX: 44, minZ: 84, maxZ: 124, y: 1.5, count: 6, seed: 11 },
      { minX: 42, maxX: 96, minZ: 4, maxZ: 20, y: 7.5, count: 4, seed: 13 },
      { minX: 96, maxX: 124, minZ: 4, maxZ: 36, y: 4.5, count: 3, seed: 17 },
      { minX: 46, maxX: 92, minZ: 84, maxZ: 122, y: 1, count: 3, seed: 19 },
    ],
    foliage: {
      seed: 2024,
      flowerAreas: [
        { minX: 4, maxX: 26, minZ: 100, maxZ: 122, palette: [2, 3, 2, 3, 0] },
        { minX: 43, maxX: 95, minZ: 80, maxZ: 125, palette: [0, 1, 2, 3, 0, 1, 2] },
        { minX: 3, maxX: 44, minZ: 37, maxZ: 84, palette: [1, 1, 2, 1, 0] },
        { minX: 43, maxX: 88, minZ: 38, maxZ: 80, palette: [0, 2, 0, 1, 3] },
        { minX: 87, maxX: 125, minZ: 36, maxZ: 112, palette: [3, 2, 3, 1] },
        { minX: 3, maxX: 125, minZ: 0, maxZ: 40, palette: [2, 3, 1, 2] },
      ],
      shrubAreas: [
        { minX: 3, maxX: 45, minZ: 83, maxZ: 125, chance: 0.2 },
        { minX: 96, maxX: 125, minZ: 3, maxZ: 40, chance: 0.16 },
        { minX: 38, maxX: 98, minZ: 3, maxZ: 38, chance: 0.1 },
        { minX: 3, maxX: 38, minZ: 3, maxZ: 38, chance: 0.08 },
        { minX: 87, maxX: 125, minZ: 36, maxZ: 112, chance: 0.08 },
      ],
    },
  };
}

// =============================================================================================
// 4. Validation — the game's rules: tiles, step height, stairs, bridge decks, colliders
// =============================================================================================

const LEGEND = defaultLegend();
LEGEND.e = { top: 'riverbed', side: 'cliff', water: true, walkable: false, flow: [0.45, 0] };
LEGEND[':'] = { top: 'dirt_path', side: 'dirt_side', walkable: false };
const FALL_DIR = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const stairT = (dir, lx, lz) => (dir === 'N' ? 1 - lz : dir === 'S' ? lz : dir === 'E' ? lx : 1 - lx);
const waterSurface = (i, j, waterLevel = 0.4) => { const h = L(i, j) * 0.5; return waterLevel > h + 0.02 ? waterLevel : h + 0.35; };

/** Bridge deck walk rects, exactly as PropFactory.bridge builds them. */
function walkRectsOf(o) {
  const dx = o.x1 - o.x0; const dz = o.z1 - o.z0; const len = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  const hw = (o.opts.width ?? 2) / 2;
  const arch = o.opts.arch ?? Math.min(0.4, len * 0.05);
  const deckY = o.deckY;
  const cx = (o.x0 + o.x1) / 2; const cz = (o.z0 + o.z1) / 2;
  const nW = arch > 0.02 ? Math.max(2, Math.round(len / 0.5)) : 1;
  const zOf = (t) => -len / 2 + t * len;
  const out = [];
  for (let k = 0; k < nW; k++) {
    const t0 = k / nW; const t1 = (k + 1) / nW;
    const r = rotBox(cx, cz, yaw, -hw + 0.1, hw - 0.1, zOf(t0) + (k === 0 ? -0.25 : 0), zOf(t1) + (k === nW - 1 ? 0.25 : 0));
    out.push({ ...r, y: deckY + arch * Math.sin(Math.PI * (t0 + t1) / 2) });
  }
  return out;
}

/**
 * Walks that must stay direct (see validate).
 * @type {[name: string, from: XZ, to: XZ][]}
 */
const ROUTES = [
  ['the spawn → Hearthwick Square', [70.5, 121.5], [70.5, 63]],
  ['Hearthwick Square → Southgate', [70.5, 63], [70.5, 83]],
  ['Hearthwick → the observatory', [70.5, 41], [74, 13]],
  ['East Road → Mirrormere Landing', [87.2, 59], [91.8, 64.5]],
  ['the North Pier → the hamlet', [96.4, 61.5], [92.5, 64.5]],
  ['Mirrormere Landing → Reedmouth', [92, 72], [92, 83.5]],
  ['Goldenfield → the Old Quarry', [21, 43], [21, 30]],
  ['the West Road → Barleycorn Farm', [44, 58.5], [29.5, 53.5]],
  ["the woodcutter's camp → the hidden glade", [31, 97], [17, 113]],
  ['the troupe camp → the Wishing Oak', [62, 103.5], [58.5, 117]],
  ['the North Shore → the Mirror Falls lookout', [101.5, 48], [108.5, 35.5]],
  ['the South Beach → the Heron Spit', [110.6, 101.4], [121.6, 77.2]],
  // the crossings themselves: a removed bridge or stair flight fails here even when the far bank
  // is reachable the long way round
  ['Lantern Lane over the Millrace', [55.5, 58.5], [61.5, 58.5]],
  ['the West bank lane → Fallsview Bridge', [55, 43], [61, 43]],
  ['the Terrace walk over the Silverrun', [55.5, 25.5], [60.5, 25.5]],
  ["the Foothill walk over Sisters' Crossing", [57.5, 33.5], [62.5, 33.5]],
  ['the River walk → Reedmouth', [92, 74.5], [92, 82.5]],
  ['the plateau → the Highland stair', [95, 14.5], [102.5, 14.5]],
  ['the Upland track → the terrace', [33, 22.5], [37.5, 22.5]],
  ['the quarry pit → the ruins', [13.5, 17.5], [8.5, 17.5]],
];

function validate(level) {
  const report = { errors: [], warnings: [], info: [] };
  const err = (m) => report.errors.push(m);
  const warn = (m) => report.warnings.push(m);
  const walkRects = objects.filter((o) => o.type === 'bridge').flatMap(walkRectsOf);

  const tileDef = (i, j) => (inMap(i, j) ? LEGEND[T(i, j)] : null);
  const surfaceAt = (x, z) => {
    let best = null;
    for (const r of walkRects) if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ && (best === null || r.y > best)) best = r.y;
    if (best !== null) return best;
    const i = Math.floor(x); const j = Math.floor(z);
    const d = tileDef(i, j);
    if (!d || d.void || d.water || d.walkable === false) return NaN;
    const h = L(i, j) * 0.5;
    if (d.stairs) return clamp(h + 0.0625 + stairT(d.stairs, x - i, z - j) * 0.5, h, h + 0.5);
    return h;
  };
  const PERIM = Array.from({ length: 8 }, (_, k) => [Math.cos((k * Math.PI) / 4) * 0.3, Math.sin((k * Math.PI) / 4) * 0.3]);
  const standable = (x, z, ignoreNpcs = false) => {
    if (x < 0.3 || z < 0.3 || x > W - 0.3 || z > D - 0.3) return NaN;
    const hc = surfaceAt(x, z);
    if (hc !== hc || blockedAt(x, z, 0.29, ignoreNpcs ? (ow) => ow.type === 'npc' : null)) return NaN;
    for (const [px, pz] of PERIM) { const hp = surfaceAt(x + px, z + pz); if (hp !== hp || Math.abs(hp - hc) > 0.55) return NaN; }
    return hc;
  };

  // ---- the walk BFS on a quarter-unit grid, from the spawn
  const G = 4; const GW = W * G + 1; const GD = D * G + 1;
  const hgt = new Float32Array(GW * GD);
  for (let gz = 0; gz < GD; gz++) for (let gx = 0; gx < GW; gx++) hgt[gz * GW + gx] = standable(gx / G, gz / G);
  const seen = new Uint8Array(GW * GD);
  const sx = Math.round(level.spawn.x * G); const sz = Math.round(level.spawn.z * G);
  let start = -1;
  for (let r = 0; r < 6 && start < 0; r++) for (let dz = -r; dz <= r && start < 0; dz++) for (let dx = -r; dx <= r; dx++) { const k = (sz + dz) * GW + sx + dx; if (hgt[k] === hgt[k]) { start = k; break; } }
  if (start < 0) err('spawn is not standable');
  const queue = [start];
  seen[start] = 1;
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let h = 0; h < queue.length; h++) {
    const k = queue[h];
    const gx = k % GW; const gz = (k - gx) / GW;
    for (const [dx, dz] of NB) {
      const nx = gx + dx; const nz = gz + dz;
      if (nx < 0 || nz < 0 || nx >= GW || nz >= GD) continue;
      const n = nz * GW + nx;
      if (seen[n] || hgt[n] !== hgt[n] || Math.abs(hgt[n] - hgt[k]) > 0.55) continue;
      seen[n] = 1;
      queue.push(n);
    }
  }
  let standableCount = 0;
  for (let k = 0; k < hgt.length; k++) if (hgt[k] === hgt[k]) standableCount++;
  report.info.push(`walk BFS: ${queue.length} of ${standableCount} standable quarter-unit nodes reachable from the spawn (${(100 * queue.length / standableCount).toFixed(1)} %)`);
  const reachNear = (x, z, radius, y = null, dy = 1.3) => {
    for (let gz = Math.max(0, Math.floor((z - radius) * G)); gz <= Math.min(GD - 1, Math.ceil((z + radius) * G)); gz++) {
      for (let gx = Math.max(0, Math.floor((x - radius) * G)); gx <= Math.min(GW - 1, Math.ceil((x + radius) * G)); gx++) {
        const k = gz * GW + gx;
        if (!seen[k] || (gx / G - x) ** 2 + (gz / G - z) ** 2 > radius * radius) continue;
        if (y == null || Math.abs(hgt[k] - y) <= dy) return true;
      }
    }
    return false;
  };
  // unreachable walkable pockets (the island of the sleeping stars is one on purpose)
  const pocket = new Uint8Array(GW * GD);
  const pockets = [];
  for (let k = 0; k < hgt.length; k++) {
    if (seen[k] || pocket[k] || hgt[k] !== hgt[k]) continue;
    const q = [k]; pocket[k] = 1;
    let sx2 = 0; let sz2 = 0; let x0 = Infinity; let x1 = -Infinity; let z0 = Infinity; let z1 = -Infinity;
    for (let h = 0; h < q.length; h++) {
      const c = q[h]; const gx = c % GW; const gz = (c - gx) / GW; sx2 += gx; sz2 += gz; x0 = Math.min(x0, gx); x1 = Math.max(x1, gx); z0 = Math.min(z0, gz); z1 = Math.max(z1, gz);
      for (const [dx, dz] of NB) { const n = (gz + dz) * GW + gx + dx; if (gx + dx < 0 || gz + dz < 0 || gx + dx >= GW || gz + dz >= GD || pocket[n] || seen[n] || hgt[n] !== hgt[n] || Math.abs(hgt[n] - hgt[c]) > 0.55) continue; pocket[n] = 1; q.push(n); }
    }
    if (q.length >= 48) pockets.push({ nodes: q.length, x: +(sx2 / q.length / G).toFixed(1), z: +(sz2 / q.length / G).toFixed(1), box: [x0 / G, x1 / G, z0 / G, z1 / G] });
  }
  pockets.sort((a, b) => b.nodes - a.nodes);
  report.pockets = pockets;
  for (const p of pockets) {
    if (Z(Math.floor(p.x), Math.floor(p.z)) !== 'island') err(`an unreachable walkable pocket of ${p.nodes / 16} u² at (${p.x}, ${p.z}) (x ${p.box[0]}–${p.box[1]}, z ${p.box[2]}–${p.box[3]}) — only the island may be out of reach`);
  }

  // ---- routes: places a signpost (or a villager) sends you between are joined by a walk that is
  // not a long detour — a closed alley or a blocked landing shows up here, even when the far side
  // is reachable some other way round (Dijkstra on the walk grid, diagonal steps √2)
  const walkLength = (ax, az, bx, bz) => {
    const nodeNear = (x, z) => {
      let best = -1; let bd = Infinity;
      for (let gz = Math.round((z - 1) * G); gz <= Math.round((z + 1) * G); gz++) for (let gx = Math.round((x - 1) * G); gx <= Math.round((x + 1) * G); gx++) {
        const k = gz * GW + gx;
        if (gx < 0 || gz < 0 || gx >= GW || gz >= GD || !seen[k]) continue;
        const d = (gx / G - x) ** 2 + (gz / G - z) ** 2;
        if (d < bd) { bd = d; best = k; }
      }
      return best;
    };
    const a = nodeNear(ax, az); const b = nodeNear(bx, bz);
    if (a < 0 || b < 0) return Infinity;
    const dist = new Float64Array(GW * GD).fill(Infinity);
    const heap = []; // [cost, node] binary min-heap
    const push = (c, n) => { heap.push([c, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1; const r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    dist[a] = 0; push(0, a);
    while (heap.length) {
      const [c, k] = pop();
      if (c > dist[k]) continue;
      if (k === b) return c / G;
      const gx = k % GW; const gz = (k - gx) / GW;
      for (const [dx, dz] of NB) {
        const nx = gx + dx; const nz = gz + dz;
        if (nx < 0 || nz < 0 || nx >= GW || nz >= GD) continue;
        const n = nz * GW + nx;
        if (!seen[n] || Math.abs(hgt[n] - hgt[k]) > 0.55) continue;
        const nc = c + (dx && dz ? Math.SQRT2 : 1);
        if (nc < dist[n]) { dist[n] = nc; push(nc, n); }
      }
    }
    return Infinity;
  };
  for (const [name, [ax, az], [bx, bz]] of ROUTES) {
    const straight = Math.hypot(bx - ax, bz - az);
    const len = walkLength(ax, az, bx, bz);
    const limit = straight * 1.5 + 3;
    if (!(len <= limit)) err(`route "${name}" is a long detour: ${len === Infinity ? 'no walk' : `${len.toFixed(1)} u`} for ${straight.toFixed(1)} u as the crow flies (limit ${limit.toFixed(1)})`);
    else report.info.push(`route ${name}: ${len.toFixed(1)} u (${straight.toFixed(1)} straight)`);
  }

  // ---- interactions: villagers, doors, signs, wells — and every region
  for (const o of objects) {
    const y = groundY(o.x, o.z);
    if (o.type === 'npc') {
      const tp = o.talkOffset ? [o.x + o.talkOffset[0], o.z + o.talkOffset[1]] : [o.x, o.z];
      const y2 = walkRects.some((r) => o.x >= r.minX && o.x <= r.maxX && o.z >= r.minZ && o.z <= r.maxZ) ? walkRects.find((r) => o.x >= r.minX && o.x <= r.maxX && o.z >= r.minZ && o.z <= r.maxZ).y : y;
      if (!reachNear(tp[0], tp[1], (o.talkRadius ?? 1.6) - 0.15, y2)) err(`NPC ${o.id} (${o.name}) cannot be reached to talk`);
      if (surfaceAt(o.x, o.z) !== surfaceAt(o.x, o.z)) err(`NPC ${o.id} stands on unwalkable ground`);
      const blocker = allShapes.find((c) => c.owner !== o && c.owner.type !== 'npc' && hitShape(c, o.x, o.z, 0.3));
      if (blocker) err(`NPC ${o.id} stands inside ${blocker.owner.id}`);
    } else if (o.type === 'house') {
      const d = doorOf(o);
      if (!reachNear(d.x, d.z, 0.85, y)) err(`door of ${o.id} (${o.name}) is not reachable`);
    } else if (o.type === 'signpost') {
      if (!reachNear(o.x, o.z, 1.2, y)) err(`signpost ${o.id} is not reachable`);
    } else if (o.type === 'well') {
      if (!reachNear(o.x, o.z, 1.6, y)) err(`well ${o.id} is not reachable`);
    } else if (o.type === 'region') {
      let ok = false;
      for (let gz = Math.ceil(o.minZ * G); gz < o.maxZ * G && !ok; gz++) for (let gx = Math.ceil(o.minX * G); gx < o.maxX * G; gx++) {
        const k = gz * GW + gx;
        if (gx < GW && gz < GD && seen[k] && (o.minY == null || hgt[k] > o.minY)) { ok = true; break; }
      }
      if (!ok) err(`region "${o.name}" has no reachable ground`);
    }
  }

  // ---- paths are not blocked by props (centre lines sampled every half unit)
  for (const p of PATHS) {
    if (p.width < 1.5) continue;
    for (let k = 0; k < p.points.length - 1; k++) {
      const [ax, az] = p.points[k]; const [bx, bz] = p.points[k + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5));
      for (let s = 0; s <= n; s++) {
        const x = ax + ((bx - ax) * s) / n; const z = az + ((bz - az) * s) / n;
        const i = Math.floor(x); const j = Math.floor(z);
        if (!inMap(i, j)) continue;
        if (WATER.has(T(i, j))) {
          // a road across water runs on a bridge deck
          if (standable(x, z, true) !== standable(x, z, true)) { err(`path "${p.name}" crosses water without a bridge at (${x.toFixed(1)}, ${z.toFixed(1)})`); s = n; }
          continue;
        }
        if (!pathMask[I(i, j)]) continue;
        const b = blockedAt(x, z, 0.29, (ow) => ow.type === 'npc');
        if (b) { err(`path "${p.name}" is blocked at (${x.toFixed(1)}, ${z.toFixed(1)}) by ${b.id}`); s = n; }
      }
    }
  }

  // ---- stairs rise toward their direction, one level per tile
  const SDIR = { '^': 'N', v: 'S', '>': 'E', '<': 'W' };
  const stairCounts = { '^': 0, v: 0, '>': 0, '<': 0 };
  for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) {
    const ch = T(i, j);
    if (!STAIRS.has(ch)) continue;
    stairCounts[ch]++;
    const [fx, fz] = FALL_DIR[SDIR[ch]];
    const l = L(i, j);
    const ahead = T(i + fx, j + fz); const behind = T(i - fx, j - fz);
    const flat = (c) => c && LEGEND[c]?.walkable !== false && !LEGEND[c]?.water && !STAIRS.has(c);
    const okA = (ahead === ch && L(i + fx, j + fz) === l + 1) || (flat(ahead) && L(i + fx, j + fz) === l + 1);
    const okB = (behind === ch && L(i - fx, j - fz) === l - 1) || (flat(behind) && L(i - fx, j - fz) === l);
    if (!okA || !okB) err(`stairs ${ch} at (${i}, ${j}) level ${l}: ${okA ? '' : `the high side (${ahead}${L(i + fx, j + fz)}) is not level ${l + 1}`} ${okB ? '' : `the low side (${behind}${L(i - fx, j - fz)}) is not level ${l}`}`);
  }
  report.stairs = { ...stairCounts, flights: FLIGHTS.length };

  // ---- waterfalls: on a tile edge between a higher and a lower water tile, a real drop
  for (const f of FALLS) {
    const [fx, fz] = FALL_DIR[f.facing];
    const onEdge = fz ? Number.isInteger(f.z) : Number.isInteger(f.x);
    const ti = Math.floor(f.x - fx * 0.5 + 0.01); const tj = Math.floor(f.z - fz * 0.5 + 0.01);
    const bi = Math.floor(f.x + fx * 0.5 + 0.01); const bj = Math.floor(f.z + fz * 0.5 + 0.01);
    if (!onEdge) err(`waterfall ${f.id} is not on a tile edge`);
    if (!isWater(ti, tj) || !isWater(bi, bj)) { err(`waterfall ${f.id}: no water above / below`); continue; }
    const drop = waterSurface(ti, tj) - waterSurface(bi, bj);
    if (drop < 0.5) err(`waterfall ${f.id}: drop ${drop.toFixed(2)} is too small`);
    const across = Math.round(f.width);
    for (let k = 0; k < across; k++) {
      const ci = fz ? Math.floor(f.x - f.width / 2 + k + 0.5) : ti; const cj = fz ? tj : Math.floor(f.z - f.width / 2 + k + 0.5);
      if (!isWater(ci, cj)) err(`waterfall ${f.id}: the lip is not water across its width`);
    }
    report.info.push(`waterfall ${f.id}: drop ${drop.toFixed(2)} (surface ${waterSurface(ti, tj).toFixed(2)} → ${waterSurface(bi, bj).toFixed(2)})`);
  }

  // ---- bridges span water from bank to bank (piers: from the bank out over the water)
  for (const { o, pier, name } of BRIDGES) {
    const dx = o.x1 - o.x0; const dz = o.z1 - o.z0; const len = Math.hypot(dx, dz); const ux = dx / len; const uz = dz / len;
    const bank = (x, z) => { const d = tileDef(Math.floor(x), Math.floor(z)); return d && !d.water && !d.void && d.walkable !== false ? L(Math.floor(x), Math.floor(z)) * 0.5 : null; };
    const a = bank(o.x0 - ux * 0.5, o.z0 - uz * 0.5); const b = bank(o.x1 + ux * 0.5, o.z1 + uz * 0.5);
    let wet = 0;
    for (let t = 0.05; t < 1; t += 0.05) if (isWater(Math.floor(o.x0 + dx * t), Math.floor(o.z0 + dz * t))) wet++;
    if (!wet) err(`bridge ${o.id} does not cross water`);
    if (a == null || (!pier && b == null)) err(`bridge ${o.id}: an end is not on a bank`);
    if (a != null && Math.abs(a - o.deckY) > 0.5) err(`bridge ${o.id}: deck ${o.deckY} vs bank ${a}`);
    if (!pier && b != null && Math.abs(b - o.deckY) > 0.5) err(`bridge ${o.id}: deck ${o.deckY} vs far bank ${b}`);
    report.info.push(`bridge ${name}: ${len.toFixed(1)} long, ${pier ? 'pier' : 'bank to bank'}, deck ${o.deckY}`);
  }

  // ---- every bridge and pier can be walked end to end along its deck (step height, rails, props)
  for (const { o, pier } of BRIDGES) {
    const dx = o.x1 - o.x0; const dz = o.z1 - o.z0; const len = Math.hypot(dx, dz); const ux = dx / len; const uz = dz / len;
    const a0 = -0.9; const a1 = pier ? len - 0.4 : len + 0.9;
    let prev = null; let bad = null;
    for (let t = a0; t <= a1 + 1e-6; t += 0.2) {
      const x = o.x0 + ux * t; const z = o.z0 + uz * t;
      const hgt = standable(x, z, true);
      if (hgt !== hgt) { bad = `not standable at (${x.toFixed(2)}, ${z.toFixed(2)})`; break; }
      if (prev != null && Math.abs(hgt - prev) > 0.55) { bad = `a ${Math.abs(hgt - prev).toFixed(2)} step at (${x.toFixed(2)}, ${z.toFixed(2)})`; break; }
      prev = hgt;
    }
    if (bad) err(`bridge ${o.id} cannot be walked end to end: ${bad}`);
  }

  // ---- props stand on proper ground; footprints of buildings are flat and dry
  const FLAT = new Set(['house', 'marketStall', 'windmill', 'well', 'campfire', 'bench']);
  for (const o of objects) {
    const def = OBJECT_TYPES[o.type];
    if (def.kind !== 'prop' || def.placement !== 'point' || o.type === 'wallTorch' || o.type === 'light' || o.type === 'waterfall') continue;
    const i = Math.floor(o.x); const j = Math.floor(o.z);
    const d = tileDef(i, j);
    const onDeck = walkRects.some((r) => o.x >= r.minX && o.x <= r.maxX && o.z >= r.minZ && o.z <= r.maxZ);
    if (!onDeck && (!d || d.void || d.walkable === false || (d.water && o.type !== 'rock'))) err(`${o.id} stands on ${JSON.stringify(T(i, j))} at (${o.x}, ${o.z})`);
    if (FLAT.has(o.type)) {
      const b = collidersOf(o)[0];
      const bb = b ? shapeBounds(b) : { minX: o.x - 0.5, maxX: o.x + 0.5, minZ: o.z - 0.5, maxZ: o.z + 0.5 };
      const l0 = L(i, j);
      for (let jj = Math.floor(bb.minZ + 0.15); jj <= Math.floor(bb.maxZ - 0.15); jj++) for (let ii = Math.floor(bb.minX + 0.15); ii <= Math.floor(bb.maxX - 0.15); ii++) {
        const dd = tileDef(ii, jj);
        if (!dd || dd.water || dd.stairs || dd.walkable === false || L(ii, jj) !== l0) { err(`${o.id} footprint is uneven or wet at tile (${ii}, ${jj})`); ii = 1e9; jj = 1e9; }
      }
    }
  }

  // ---- no two props overlap (approximate colliders)
  const pairs = new Set();
  const overlap = (a, b) => {
    if (a.c === 'seg' || b.c === 'seg') {
      const s = a.c === 'seg' ? a : b; const o = s === a ? b : a;
      if (o.c === 'seg') return false; // fences and rails may meet
      const n = Math.max(2, Math.ceil(Math.hypot(s.x1 - s.x0, s.z1 - s.z0) / 0.2));
      for (let k = 0; k <= n; k++) if (hitShape(o, s.x0 + ((s.x1 - s.x0) * k) / n, s.z0 + ((s.z1 - s.z0) * k) / n, s.h - 0.02)) return true;
      return false;
    }
    if (a.c === 'circle' && b.c === 'circle') return (a.x - b.x) ** 2 + (a.z - b.z) ** 2 < (a.r + b.r - 0.02) ** 2;
    if (a.c === 'box' && b.c === 'box') return a.minX < b.maxX - 0.02 && b.minX < a.maxX - 0.02 && a.minZ < b.maxZ - 0.02 && b.minZ < a.maxZ - 0.02;
    const c = a.c === 'circle' ? a : b; const bx = c === a ? b : a;
    return hitShape(bx, c.x, c.z, c.r - 0.02);
  };
  for (const a of allShapes) {
    for (const b of shapesNear((shapeBounds(a).minX + shapeBounds(a).maxX) / 2, (shapeBounds(a).minZ + shapeBounds(a).maxZ) / 2)) {
      if (a === b || a.owner === b.owner) continue;
      const key = a.owner.id < b.owner.id ? `${a.owner.id}|${b.owner.id}` : `${b.owner.id}|${a.owner.id}`;
      if (pairs.has(key)) continue;
      if (a.owner.type === 'npc' || b.owner.type === 'npc') continue; // checked above
      if (overlap(a, b)) { pairs.add(key); err(`overlap: ${a.owner.id} × ${b.owner.id}`); }
    }
  }
  // doors are not blocked by props
  for (const o of objects) {
    if (o.type !== 'house') continue;
    const d = doorOf(o);
    const b = blockedAt(d.x, d.z, 0.35, (ow) => ow === o || ow.type === 'npc');
    if (b) err(`door of ${o.id} is blocked by ${b.id}`);
  }

  // ---- the camera looks north (yaw 0, pitch 32°, distance 30), so a house hides about six units
  // of ground behind it: no villager, door, signpost, well or campfire may stand where the camera
  // sees only a roof. Houses as the PropFactory builds them: plinth 0.5 + 3 (+ 2 for an upper
  // storey), the roof at the steepest pitch it uses (45°), eaves 0.35 all round
  const CAM = (32 * Math.PI) / 180;
  const roofs = objects.filter((o) => o.type === 'house').map((h) => {
    const gf = !!h.opts.gableFront;
    const two = (h.opts.stories ?? 1) > 1;
    const hw = (gf ? h.opts.depth : h.opts.width) / 2;
    const hd = (gf ? h.opts.width : h.opts.depth) / 2;
    const hs = hd + (two ? 0.25 : 0);
    const a = (h.rotation ?? 0) + (gf ? Math.PI / 2 : 0);
    return { h, x: h.x, z: h.z, y: groundY(h.x, h.z), hw, hd, hs, eave: 3.5 + (two ? 2 : 0), ca: Math.cos(a), sa: Math.sin(a), reach: Math.hypot(hw, hs) + 0.5 };
  });
  // …and the other tall props: a well's roof (1.85–2.65 above its ground, 2.5 × 1.8) and the
  // windmill tower (market-stall canopies are left out: their merchants stand under them on purpose
  // and are talked to from the front)
  const tall = objects.filter((o) => o.type === 'well' || o.type === 'windmill').map((o) => {
    const y = groundY(o.x, o.z);
    return o.type === 'well'
      ? { o, minX: o.x - 1.25, maxX: o.x + 1.25, minZ: o.z - 0.9, maxZ: o.z + 0.9, y0: y + 1.85, y1: y + 2.65 }
      : { o, minX: o.x - 1.65, maxX: o.x + 1.65, minZ: o.z - 1.65, maxZ: o.z + 1.65, y0: y, y1: y + (o.opts?.height ?? 6) + 1 };
  });
  const roofAt = (px, py, pz, skip) => {
    for (const b of tall) {
      if (b.o !== skip && px > b.minX && px < b.maxX && pz > b.minZ && pz < b.maxZ && py > b.y0 && py < b.y1) return b.o;
    }
    for (const r of roofs) {
      if (r.h === skip) continue;
      const dx = px - r.x; const dz = pz - r.z;
      if (Math.abs(dx) > r.reach || Math.abs(dz) > r.reach) continue;
      const lx = dx * r.ca - dz * r.sa; const lz = dx * r.sa + dz * r.ca;
      if (Math.abs(lx) > r.hw + 0.35 || Math.abs(lz) > r.hs + 0.35) continue;
      const top = r.y + r.eave + r.hs * (1 - Math.min(1, Math.abs(lz) / r.hs));
      const bottom = Math.abs(lz) <= r.hd && Math.abs(lx) <= r.hw ? r.y : r.y + r.eave - 0.2;
      if (py < top && py > bottom) return r.h;
    }
    return null;
  };
  /** The house hiding a point `hh` above the ground at (x, z) from the camera, or null. */
  const hiddenBy = (x, z, hh, skip = null) => {
    const y0 = surfaceAt(x, z);
    const y = (y0 === y0 ? y0 : groundY(x, z)) + hh;
    for (let t = 0.1; t < 16; t += 0.1) {
      const h = roofAt(x, y + Math.sin(CAM) * t, z + Math.cos(CAM) * t, skip);
      if (h) return h;
    }
    return null;
  };
  for (const o of objects) {
    const spots = [];
    if (o.type === 'npc') {
      spots.push([`villager ${o.id}`, o.x, o.z, 1.0]);
      if (o.talkOffset) spots.push([`the talk spot of ${o.id}`, o.x + o.talkOffset[0], o.z + o.talkOffset[1], 1.0]);
    } else if (o.type === 'house') {
      const d = doorOf(o);
      spots.push([`the door of ${o.id}`, d.x, d.z, 1.0]);
    } else if (o.type === 'signpost') spots.push([`signpost ${o.id}`, o.x, o.z, 1.6]);
    else if (o.type === 'well') spots.push([`well ${o.id}`, o.x, o.z, 1.2]);
    else if (o.type === 'campfire') spots.push([`campfire ${o.id}`, o.x, o.z, 0.6]);
    for (const [what, x, z, hh] of spots) {
      const h = hiddenBy(x, z, hh, o.type === 'house' || o.type === 'well' ? o : null);
      if (h) err(`${what} at (${x.toFixed(1)}, ${z.toFixed(1)}) is hidden from the camera behind ${h.id}`);
    }
  }
  // walkers on the roads and trails: the share hidden behind houses (the player shows as an x-ray
  // silhouette there, but a showcase should rarely need it)
  let pathTiles = 0; let hiddenTiles = 0; const hiders = {};
  for (let j = 0; j < D; j++) {
    for (let i = 0; i < W; i++) {
      if (!pathMask[I(i, j)] || isWater(i, j)) continue;
      pathTiles++;
      const h = hiddenBy(i + 0.5, j + 0.5, 1.0);
      if (h) { hiddenTiles++; hiders[h.id] = (hiders[h.id] ?? 0) + 1; }
    }
  }
  const hiddenShare = hiddenTiles / Math.max(1, pathTiles);
  const byHider = Object.entries(hiders).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ');
  report.info.push(`camera: a walker is behind a house or a well roof on ${hiddenTiles} of ${pathTiles} path tiles (${(100 * hiddenShare).toFixed(1)} %${byHider ? `: ${byHider}` : ''})`);
  if (hiddenShare > 0.03) warn(`${(100 * hiddenShare).toFixed(1)} % of the path tiles are hidden behind houses and well roofs (aim for ≤ 3 %)`);

  // hand-placed trees keep the sightlines clear too (the scatter already does)
  for (const t of objects) {
    if (t.type !== 'tree' || SCATTERED.has(t)) continue;
    const v = VIEWS.find((q) => t.z > q.z && t.z < q.z + q.depth && Math.abs(t.x - q.x) < q.w);
    if (v) err(`hand-placed ${t.id} at (${t.x}, ${t.z}) stands in the sightline of (${v.x}, ${v.z})`);
  }
  // …and no tree crown (a trunk outside the corridor, a crown reaching into it) hides half of a
  // villager, a door front, a sign, a well or a campfire from the camera
  const crowns = objects.filter((o) => o.type === 'tree').map(crownOf);
  for (const s of sightTargets()) {
    const r = crownCover(s.x, s.z, s.h0, s.h1, crowns);
    if (r.share >= 0.5) err(`${s.what} at (${s.x.toFixed(1)}, ${s.z.toFixed(1)}) is ${Math.round(r.share * 100)} % hidden from the camera behind the crown of ${[...r.by.keys()].map((t) => t.id).join(', ')}`);
  }

  // ---- actors and markers: inside the map, critters start on walkable ground, a chase area is
  // mostly walkable, wall torches hang on a wall (a house, the windmill or a cliff face), the
  // environment's area rects overlap the map
  const inside = (x, z) => x >= 0 && z >= 0 && x <= W && z <= D;
  const walkableAt = (x, z) => { const h = surfaceAt(x, z); return h === h; };
  for (const o of objects) {
    const def = OBJECT_TYPES[o.type];
    if (def.placement === 'point' && !inside(o.x, o.z)) { err(`${o.id} lies outside the map at (${o.x}, ${o.z})`); continue; }
    if (def.placement === 'line' && !(inside(o.x0, o.z0) && inside(o.x1, o.z1))) { err(`${o.id} reaches outside the map`); continue; }
    if (def.placement === 'rect' && !(o.maxX > Math.max(0, o.minX) && o.minX < W && o.maxZ > Math.max(0, o.minZ) && o.minZ < D)) { err(`${o.id} does not overlap the map`); continue; }
    if (o.type === 'critters') {
      const bad = critterStartPoints(o, walkableAt).filter(([x, z]) => !walkableAt(x, z));
      if (bad.length) err(`critters ${o.id}: ${bad.length} animal(s) start off walkable ground (first at (${bad[0][0].toFixed(1)}, ${bad[0][1].toFixed(1)}))`);
    } else if (o.type === 'npc' && o.behaviour === 'chase') {
      const a = o.area ?? { minX: -o.wander, maxX: o.wander, minZ: -o.wander, maxZ: o.wander };
      let n = 0; let ok = 0;
      for (let z = o.z + a.minZ + 0.25; z < o.z + a.maxZ; z += 0.5) {
        for (let x = o.x + a.minX + 0.25; x < o.x + a.maxX; x += 0.5) { n++; if (standable(x, z, true) === standable(x, z, true)) ok++; }
      }
      if (!n || ok < n / 2) err(`the chase area of ${o.id} is mostly not walkable (${ok} of ${n} spots)`);
    } else if (o.type === 'wallTorch') {
      const i = Math.floor(o.x); const j = Math.floor(o.z);
      if (isWater(i, j)) { err(`wall torch ${o.id} hangs over water at (${o.x}, ${o.z})`); continue; }
      let wall = allShapes.some((c) => (c.owner.type === 'house' || c.owner.type === 'windmill') && hitShape(c, o.x, o.z, 1.0));
      for (let dj = -1; dj <= 1 && !wall; dj++) {
        for (let di = -1; di <= 1; di++) if (inMap(i + di, j + dj) && Math.abs(L(i + di, j + dj) - L(i, j)) >= 2) { wall = true; break; }
      }
      if (!wall) err(`wall torch ${o.id} has no wall to hang on at (${o.x}, ${o.z})`);
    }
  }
  const env = level.environment;
  const envAreas = [
    ...(env.godRayAreas ?? []).map((a) => ['god-ray area', a]),
    ...(env.foliage?.flowerAreas ?? []).map((a) => ['flower area', a]),
    ...(env.foliage?.shrubAreas ?? []).map((a) => ['shrub area', a]),
    ...(env.forest?.areas ?? []).map((a) => ['forest area', a]),
  ];
  for (const [what, a] of envAreas) {
    if (!(a.maxX > a.minX && a.maxZ > a.minZ && a.maxX > 0 && a.minX < W && a.maxZ > 0 && a.minZ < D)) err(`${what} ${a.minX}–${a.maxX} × ${a.minZ}–${a.maxZ} does not overlap the map`);
  }
  return report;
}

/** Particle-area presets the level must use: all of them but the camera-following weather ones. */
const AREA_PRESETS = EMITTER_PRESETS.filter((p) => p !== 'rain' && p !== 'snow');

/**
 * The object types Starfall Vale must place: all but the combat (Cinderwatch Pass), campaign, story
 * (the demo campaign) and interior ones (the furniture of rooms: the interiors demo).
 */
const PEACEFUL_TYPES = Object.keys(OBJECT_TYPES).filter((t) => !isCombatType(t) && !isCampaignType(t) && !isStoryType(t) && !isInteriorType(t));

/** Feature coverage checklist. */
function coverage(level) {
  const used = new Set(level.tiles.join(''));
  const byType = {};
  for (const o of level.objects) byType[o.type] = (byType[o.type] ?? 0) + 1;
  const npcs = level.objects.filter((o) => o.type === 'npc');
  const emitters = new Set(level.objects.filter((o) => o.type === 'emitter').map((o) => o.preset));
  const critterKinds = new Set(level.objects.filter((o) => o.type === 'critters').map((o) => o.kind));
  const env = level.environment;
  const stairChars = ['^', 'v', '>', '<'].filter((c) => used.has(c));
  const checks = [
    ['every TILE_TYPES char', TILE_TYPES.every((t) => used.has(t.char)), TILE_TYPES.filter((t) => !used.has(t.char)).map((t) => JSON.stringify(t.char)).join(' ') || 'all'],
    ['every OBJECT_TYPES type but the combat, campaign, story and interior ones', PEACEFUL_TYPES.every((t) => byType[t]), PEACEFUL_TYPES.filter((t) => !byType[t]).join(' ') || `${PEACEFUL_TYPES.length} types`],
    ['NPC actions none/rest/shop/music', NPC_ACTIONS.every((a) => npcs.some((n) => n.action === a.value)), NPC_ACTIONS.map((a) => `${a.value}×${npcs.filter((n) => n.action === a.value).length}`).join(' ')],
    ['NPC behaviours wander/post/perform/chase', NPC_BEHAVIOURS.every((b) => npcs.some((n) => n.behaviour === b)), NPC_BEHAVIOURS.map((b) => `${b}×${npcs.filter((n) => n.behaviour === b).length}`).join(' ')],
    ['critter kinds', CRITTER_KINDS.every((k) => critterKinds.has(k)), [...critterKinds].join(' ')],
    ['particle areas (every preset but the camera-following weather: rain, snow)', AREA_PRESETS.every((p) => emitters.has(p)), AREA_PRESETS.filter((p) => !emitters.has(p)).join(' ') || [...emitters].join(' ')],
    ['point lights', (byType.light ?? 0) >= 3, `${byType.light ?? 0}`],
    ['wall torches', (byType.wallTorch ?? 0) >= 4, `${byType.wallTorch ?? 0}`],
    ['campfires', (byType.campfire ?? 0) >= 3, `${byType.campfire ?? 0}`],
    ['waterfalls ≥ 3', (byType.waterfall ?? 0) >= 3, `${byType.waterfall ?? 0}`],
    ['bridges ≥ 5 incl. piers', (byType.bridge ?? 0) >= 5 && BRIDGES.some((b) => b.pier), `${byType.bridge ?? 0} (${BRIDGES.filter((b) => b.pier).length} piers)`],
    ['stairs in all four orientations', stairChars.length === 4, stairChars.join(' ')],
    ['regions with banners', level.objects.some((o) => o.type === 'region' && o.banner), `${byType.region} regions, ${level.objects.filter((o) => o.type === 'region' && o.banner).length} with banners`],
    ['forest kind areas (oak / pine / birch / autumn weights)', env.forest?.areas?.length > 0 && env.forest.areas.every((a) => Object.keys(a.kinds).every((k) => ['oak', 'pine', 'birch', 'autumn'].includes(k))), `${env.forest?.areas?.length ?? 0} areas`],
    ['environment: golden hour, highGround, godRayAreas, foliage, title, titleCamera, camera',
      env.timeOfDay >= 16.5 && env.timeOfDay <= 18 && !!env.highGround && env.godRayAreas?.length > 0 && env.foliage?.flowerAreas?.length > 0 && env.foliage?.shrubAreas?.length > 0 && !!env.title && !!env.titleCamera && !!env.camera?.distance, `t=${env.timeOfDay}`],
    ['NPCs 24–30 with 2–5 pages', npcs.length >= 24 && npcs.length <= 30 && npcs.every((n) => n.dialogue.length >= 2 && n.dialogue.length <= 5), `${npcs.length} NPCs`],
    ['doors, signs, wells have text', level.objects.filter((o) => ['house', 'signpost', 'well'].includes(o.type)).every((o) => o.text?.length), ''],
    ['valid presets (characters, particle areas)', npcs.every((n) => CHARACTER_PRESET_NAMES.includes(n.preset)) && level.objects.filter((o) => o.type === 'emitter').every((o) => EMITTER_PRESETS.includes(o.preset)),
      `${new Set(npcs.map((n) => n.preset)).size} character presets`],
  ];
  return checks;
}

// =============================================================================================
// 5. Run
// =============================================================================================

relief();
water();
paths();
stairs();
ground();
border();

hearthwick();
goldenfield();
mountLumen();
oldQuarry();
mirrormere();
amberpine();
meadowlands();
emberwood();
people();
extras();
sightlines();
const handTrees = objects.filter((o) => o.type === 'tree').length;
const scatteredTrees = scatterTrees(440);
const scatteredRocks = scatterRocks(120);
const dressed = dressHouses();
const crownsCleared = clearCrowns();
regions();

const tileRows = [];
const heightRows = [];
for (let j = 0; j < D; j++) {
  let t = '';
  let h = '';
  for (let i = 0; i < W; i++) { t += tiles[I(i, j)]; h += levelToChar(levels[I(i, j)]); }
  tileRows.push(t);
  heightRows.push(h);
}

const raw = {
  format: LEVEL_FORMAT,
  version: LEVEL_VERSION,
  name: 'Starfall Vale',
  subtitle: 'Where the Stars Come Home',
  author: 'Luminati',
  description: 'The flagship Luminati showcase: a 128 × 128 vale on the night of the Starfall Festival — the market town of Hearthwick on the Silverrun, Mount Lumen with its observatory and the Three Sisters falls, Goldenfield Farms, Lake Mirrormere and its fishing hamlet, the Meadowlands, the autumn Emberwood and the Old Quarry. Generated by tools/make-starfall-vale.mjs.',
  width: W,
  depth: D,
  waterLevel: 0.4,
  water: { flow: [0, 0.45], reflect: 0.08, neutral: 0.55, glint: 0.45 },
  environment: environment(),
  spawn: { x: 70.5, z: 121.5, facing: 'up' },
  legend: LEGEND,
  tiles: tileRows,
  heights: heightRows,
  objects,
};

const { level, warnings } = normalizeLevel(raw);
const errors = validateLevel(level);
/** Paths of the values normalizeLevel changed (it repairs bad input silently; every value must survive). */
function normalizedChanges(a, b, p = '', out = []) {
  if (a === b || a === undefined) return out;
  if (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9) return out;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || b.length !== a.length) out.push(p);
    else a.forEach((v, k) => normalizedChanges(v, b[k], `${p}[${k}]`, out));
  } else if (a && typeof a === 'object') {
    if (!b || typeof b !== 'object') out.push(p);
    else for (const k of Object.keys(a)) normalizedChanges(a[k], b[k], p ? `${p}.${k}` : k, out);
  } else out.push(p);
  return out;
}
for (const p of normalizedChanges(raw, level)) errors.push(`normalizeLevel changed ${p}`);
// the content-text keys (docs/specs/I18N.md §4.10): carried from the current file at the default
// path (never --out), new ones seeded by the file and the text
keyLevel(level, { root, file: 'public/levels/starfall-vale.json' });
errors.push(...keyIssueLines(level));
const report = validate(level);
const checks = coverage(level);
// byte-stable round trip (what the editor relies on)
const text = serializeLevel(level);
const again = serializeLevel(normalizeLevel(JSON.parse(text)).level);
if (again !== text) report.errors.push('serializeLevel is not byte-stable for this level');

// ---- report --------------------------------------------------------------------------------
const stats = levelStats(level);
const tileCounts = {};
for (const row of level.tiles) for (const ch of row) tileCounts[ch] = (tileCounts[ch] ?? 0) + 1;
const heightsUsed = [...new Set(level.heights.join(''))].map(charToLevel).sort((a, b) => a - b);
log(`Starfall Vale → ${path.relative(root, OUT)}: ${stats.width}×${stats.depth}, ${stats.objects} objects, ${stats.walkable} walkable / ${stats.water} water tiles, levels ${heightsUsed[0]}–${heightsUsed[heightsUsed.length - 1]}`);
log('objects by type:', Object.entries(stats.counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
log(`trees: ${handTrees} hand-placed + ${scatteredTrees - crownsCleared.length} scattered (${crownsCleared.length} dropped for a sightline${crownsCleared.length ? `: ${crownsCleared.join(', ')}` : ''}) · rocks: ${scatteredRocks} scattered · ${dressed} props dressed round the houses`);
log('tiles by type:', Object.entries(tileCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${JSON.stringify(k)} ${v}`).join(', '));
log(`stairs: ${JSON.stringify(report.stairs)}`);
log('coverage:');
for (const [name, ok, detail] of checks) log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
log('validation:');
for (const m of report.info) log(`  · ${m}`);
if (report.pockets.length) log(`  · unreachable walkable pockets (≥ 3 tiles): ${report.pockets.map((p) => `${p.nodes / 16} u² at (${p.x}, ${p.z})`).join('; ')}`);
for (const m of warnings) log(`  ! normalizeLevel warning: ${m}`);
for (const m of errors) log(`  ✗ validateLevel: ${m}`);
for (const m of report.warnings) log(`  ! ${m}`);
for (const m of report.errors) log(`  ✗ ${m}`);
if (args.ascii) for (const r of level.tiles) console.log(r);

const failed = warnings.length + errors.length + report.errors.length + checks.filter((c) => !c[1]).length;
if (args.check) {
  const rel = path.relative(root, OUT);
  const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : null;
  if (failed) { console.error(`\n${failed} problem(s) in the generated level.`); process.exit(1); }
  if (old === text) { console.log(`${rel} is up to date (byte-identical).`); process.exit(0); }
  console.error(old == null ? `${rel} does not exist.` : `${rel} differs from the generator output. Re-run without --check to rewrite it.`);
  process.exit(1);
}
if (failed && !args.force) {
  console.error(`\n${failed} problem(s): level NOT written (pass --force to write it anyway for inspection).`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, text);
log(failed ? `written with ${failed} problem(s) (--force)` : 'all checks passed ✓');
// a forced write of a failing level still fails the run (scripts / CI can tell it apart)
if (failed) process.exitCode = 1;
