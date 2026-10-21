#!/usr/bin/env node
/**
 * Builds the combat demo level `public/levels/cinderwatch-pass.json` — **Cinderwatch Pass, "Where
 * the Old Fires Wake"** (docs/contracts/COMBAT.md §15) — deterministically (seeded RNG, no
 * Math.random, no Date) with the LevelFormat / ObjectCatalog helpers and the shared generator
 * helpers of tools/lib/levelgen.mjs, then validates it and prints stats and a report.
 *
 *   node tools/make-cinderwatch-pass.mjs [--out=public/levels/cinderwatch-pass.json] [--check] [--force] [--ascii] [--quiet]
 *     --check  write nothing; exit 1 unless the output matches the file byte for byte
 *     --force  write the level even when checks fail (for inspection only; the exit code is still 1)
 *     --ascii  print the tile map          --quiet  no report
 *   play it: game.html?level=cinderwatch-pass   ·   edit it: editor.html?open=cinderwatch-pass
 *
 * Every text carries its content-text key (`textKeys`, a `#line:` tag on the companions' and the
 * events' script lines; docs/specs/I18N.md §4.10): carried from the current file at the default path
 * (never --out), a new text's minted from the file and the text.
 *
 * The pass climbs south → north (up the screen, so the camera always looks ahead): the Waystone
 * Camp (spawn, drillmaster, dummies) → the Mossy Glade over the brook → the Crossroads under the
 * end of Cinder Ridge → either the Bramble Ruins (west: archers on the ledges, the keep, the ridge
 * pocket) or the Hollow Mire (east: boardwalks, the islet, the waterfall from the quarry lip) → the
 * Cinder Quarry (lip and upper terrace, boars) → the Caldera, Cinderheart's arena. Three villagers
 * join the player's party when asked (docs/specs/PARTY.md §9): Sister Ilse (a mystic, the healer)
 * and Rook (a ranger) at the Waystone Camp, Sela (a warden) at the Crossroads Waystone — their talk
 * scripts and four background events are the level's story. The enemies are balanced for that full
 * party of four (ADR-056): alone the pass is hard.
 *
 * Passes (each one function below, run in this order):
 *   relief → water → paths → stairs → ground → border → zones (camp, glade, crossroads, ruins,
 *   ridge, mire, quarry, caldera) → people → combat objects → sightlines → scatterTrees /
 *   scatterRocks (RNG 'cinderwatch:trees' / 'cinderwatch:rocks') → ridgeWoods → clearCrowns →
 *   ridgeRock → regions → story (the companions' events) → environment → normalise → validate (the 18 rules
 *   of COMBAT.md §15.5, rule 19, zone separation, rule 20, the chase / group-wake margins, and the
 *   story's checks — StoryChecks.storyIssues, as `npm run level:check` lists them) → coverage
 *   (§15.6) → round trip → write.
 *
 * Custom legend chars: 'e' = the glade brook, flowing east (flow [0.45, 0]); 'q' = dressed stone
 * (the quarry's cut faces and blocks: stone tiles on top, stone-wall sides, blocked); 'r' = Cinder
 * Ridge's rock (moss stone on top, the on-demand 'crag' side texture, blocked — 'x' until the scatter
 * is done, see ridgeRock()).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEVEL_FORMAT, LEVEL_VERSION, defaultLegend, normalizeLevel, validateLevel, serializeLevel, parseLevel, levelStats,
  levelToChar, charToLevel,
} from '../src/engine/level/LevelFormat.js';
import {
  OBJECT_TYPES, ENEMY_KINDS, ENEMY_INFO, CHEST_UPGRADES, EMITTER_PRESETS, CHARACTER_PRESET_NAMES, critterStartPoints, enemyStartPoints,
} from '../src/engine/level/ObjectCatalog.js';
import { RNG, fbm2, hash2, clamp } from '../src/engine/utils/math.js';
// (pure data, node-safe: the aggro ranges of rules 5 and 19)
import { ENEMY_DEFS } from '../src/game/combat/defs.js';
// (node-safe: the companions' talk scripts and the story events are checked before the level is written)
import { storyIssues, formatStoryIssue } from '../src/engine/level/StoryChecks.js';
import {
  parseArgs, createGrid, createPlacer, createWalkModel, createOcclusion, roofsOf, scatterTrees, scatterRocks, scatterForestTop,
  normalizedChanges, canonicalObject, hitShape, shapeBounds, rectDist,
  WATER, STAIRS, CARDINAL, STAIR_DIR, S_, E_, W_, N_, keyLevel, keyIssueLines,
} from './lib/levelgen.mjs';

/** @import { Rect, XZ, Level, LevelEnvironment } from '../src/engine/level/types.js' */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
if (args.out === true || args.out === '') {
  console.error('--out needs a path, e.g. --out=.check/cinderwatch-pass.json');
  process.exit(2);
}
const OUT = path.resolve(root, String(args.out ?? 'public/levels/cinderwatch-pass.json'));
const log = args.quiet ? () => {} : (...a) => console.log(...a);

// =============================================================================================
// Grid
// =============================================================================================

const W = 96;
const D = 120;
const NAME = 'Cinderwatch Pass'; // frozen: it seeds the terrain noise
/** Terrain levels (world y = level × 0.5). */
const LV = { BED: 0, LOW: 1, BASE: 2, CROSS: 3, RUINS: 4, LIP: 5, TERRACE: 6, WOODS: 7, ARENA: 8, LEDGE: 9, RIM: 11 };

// the map starts as forest; every zone is carved out of it
const g = createGrid({ width: W, depth: D, fill: 'T', level: LV.BASE, zone: 'forest' });
const { T, L, Z, I, set, rect, blob, inMap } = g;
const P = createPlacer(g);
const { add, keepClear } = P;
/** The trees the game scatters on forest tiles, as view-ray occluders. */
const FOREST_TOP = scatterForestTop(g);

/** The boss arena (golem group home + its relative rect, §15.3) in world units. */
const BOSS = { x: 48.5, z: 14.5 };
const ARENA_REL = { minX: -12, maxX: 12, minZ: -6.5, maxZ: 8.5 };
const ARENA = { minX: BOSS.x + ARENA_REL.minX, maxX: BOSS.x + ARENA_REL.maxX, minZ: BOSS.z + ARENA_REL.minZ, maxZ: BOSS.z + ARENA_REL.maxZ };
const GATE_REL = [-2.5, 8.5, 2.5, 8.5];
/** Arena floor tiles (centre inside the rect, plus the half tiles on its E / W edges). */
const ARENA_TILES = { i0: 36, i1: 60, j0: 8, j1: 22 };

/** Zone rects of §15.2 (tile ranges, inclusive) used by the passes and the regions. */
const ZONES = {
  camp: { minX: 30, maxX: 66, minZ: 99, maxZ: 117 },
  glade: { minX: 8, maxX: 88, minZ: 82, maxZ: 98 },
  crossroads: { minX: 38, maxX: 58, minZ: 72, maxZ: 82 },
  ruins: { minX: 4, maxX: 42, minZ: 44, maxZ: 72 },
  ridge: { minX: 42, maxX: 54, minZ: 44, maxZ: 72 },
  mire: { minX: 54, maxX: 92, minZ: 44, maxZ: 72 },
  quarry: { minX: 4, maxX: 92, minZ: 26, maxZ: 44 },
  caldera: { minX: 30, maxX: 66, minZ: 4, maxZ: 26 },
};
const inRect = (x, z, r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

/**
 * Height of Cinder Ridge's blocked rock at tile (i, j): a crest of level 9–11 and flanks that
 * step down in shelves of 2–3 levels (1–1.5 u cliffs) whose widths wander with the noise — one
 * level per tile read as stacked planks, not as a rocky spine. Every flank starts two or more
 * levels above the ground beside it (the Ruins 4, the Mire road 2, the lip 5, the crossroads 3).
 */
function ridgeLevel(i, j) {
  // how far in from each foot, the band edges wandering ±1.5 tiles along the flank
  const wob = (seed, t) => (fbm2(t * 0.3, seed * 0.37, { seed, octaves: 3 }) - 0.5) * 5.5;
  const band = (d, levels, widths) => {
    let edge = 0;
    for (let k = 0; k < levels.length; k++) { edge += widths[k]; if (d < edge) return levels[k]; }
    return Infinity;
  };
  const west = band(i - 42 + wob(410, j), [6], [1.6]); // the Ruins side (floor 4)
  const east = band(53 - i + wob(411, j), [4], [2.2]); // the Mire side (road 2)
  const north = band(j - 44 + wob(412, i) * 0.6, [7], [1.8]); // low toward the lip (5): it stays in view behind
  const south = band(71 - j + wob(413, i) * 0.6, [5], [1.6]); // stepping down behind the crossroads (3)
  // the crest: clumps of broken rock, 9–11
  const c = fbm2(i * 0.42, j * 0.42, { seed: 406, octaves: 2 });
  const crest = 9 + (c > 0.46 ? 1 : 0) + (c > 0.62 ? 1 : 0);
  return Math.min(west, east, north, south, crest);
}

// =============================================================================================
// 1. Terrain
// =============================================================================================

/** The walkable zones carved out of the forest, their levels and zone names. */
function relief() {
  const nz = (i, j, seed, f = 0.3) => fbm2(i * f, j * f, { seed, octaves: 2 });
  // ---- Waystone Camp (level 2): a clearing, open to the south edge, the palisade on its north side
  rect(28, 99, 68, 116, (i, j) => {
    const dx = Math.max(0, 31 - i, i - 65);
    if (dx <= (j <= 104 ? 0 : 0.6 + nz(i, j, 5) * 2.4)) set(i, j, 'g', LV.BASE, { zn: 'camp' });
  });
  // ---- the lawn between the palisade and the brook, wider on the camp's flanks
  rect(5, 94, 91, 104, (i, j) => {
    if (Z(i, j) === 'camp') return;
    const edge = Math.min(i - 6, 90 - i, 104 - j) + (nz(i, j, 6, 0.4) - 0.5) * 3;
    if (j <= 98 ? Math.min(i - 6, 90 - i) + nz(i, j, 6, 0.4) * 3 > 1.5 : edge > 0.8) set(i, j, 'g', LV.BASE, { zn: 'meadow' });
  });
  // ---- the Mossy Glade north of the brook (level 2)
  // (rows 93–94 too: the brook meanders across them)
  rect(5, 80, 91, 93, (i, j) => {
    const edge = Math.min(i - 7, 89 - i) + (nz(i, j, 7, 0.18) - 0.5) * 5;
    if (edge > 0.5) set(i, j, 'g', LV.BASE, { zn: 'glade' });
  });
  // ---- the heath band (rows 72–81): the heath (west, level 3), the crossroads, the fen (east)
  rect(3, 72, 92, 81, (i, j) => {
    const w = i - 15 + (nz(i, j, 24, 0.35) - 0.5) * 4;
    if (w < 0) return; // the west woods stay forest
    if (i >= 37 && i <= 59) set(i, j, 'g', LV.CROSS, { zn: 'cross' });
    else if (i < 37) set(i, j, 'g', LV.CROSS, { zn: 'heath' });
    else set(i, j, 'G', i <= 62 + (nz(i, j, 25) - 0.5) * 3 ? LV.BASE : LV.LOW, { zn: 'fen' });
    if (i > 92) set(i, j, 'T', null, { zn: 'forest' });
  });
  // the glade's rise to the heath / crossroads (a one-level step, blob-shaped)
  blob(34, 81.5, 22, 2.6, (i, j) => { if (Z(i, j) === 'glade') set(i, j, null, LV.CROSS); }, { seed: 8, wobble: 0.2 });
  // ---- Bramble Ruins (level 4) with the archer ledge (level 6) in the north-west
  rect(3, 44, 41, 71, (i, j) => set(i, j, 'g', LV.RUINS, { zn: 'ruins' }));
  rect(3, 44, 23, 57, (i, j) => {
    // the ledge: a straight south face over the court, a ragged east face above the keep's yard
    if (i >= 21 && j >= 51 && i - 21 + (j - 51) * 0.6 > 1.6 + hash2(i, j, 11) * 0.8) return;
    set(i, j, null, LV.TERRACE, { zn: 'ledge' });
  });
  // the ridge pocket (level 6) on the ridge's west flank
  rect(40, 57, 43, 62, (i, j) => set(i, j, 'g', LV.TERRACE, { zn: 'pocket' }));
  // ---- Cinder Ridge: stepped blocked rock
  rect(42, 44, 53, 71, (i, j) => {
    if (Z(i, j) === 'pocket') return;
    set(i, j, 'x', ridgeLevel(i, j), { zn: 'ridge' });
  });
  // ---- Hollow Mire: the ridge-foot road (level 2), the lowland (level 1)
  rect(54, 44, 92, 71, (i, j) => {
    const road = i <= 59 + (nz(i, j, 14, 0.21) - 0.5) * 2.2;
    set(i, j, 'G', road ? LV.BASE : LV.LOW, { zn: road ? 'mireRoad' : 'mire' });
  });
  // ---- Cinder Quarry: the lip (level 5) and the upper terrace (level 6)
  rect(3, 26, 92, 43, (i, j) => {
    const step = 37 + Math.round(wobZ(i + 0.5));
    set(i, j, 'd', j < step ? LV.TERRACE : LV.LIP, { zn: j < step ? 'terrace' : 'quarry' });
  });
  // the terrace reaches up to the caldera's south cliff (rows 23–25) between the rims
  rect(30, 23, 66, 25, (i, j) => set(i, j, 'd', LV.TERRACE, { zn: 'terrace' }));
  // ---- the Caldera: the arena floor (8), the level-9 ledge and the level-11 rim (blocked)
  rect(30, 4, 66, 22, (i, j) => {
    const { i0, i1, j0, j1 } = ARENA_TILES;
    if (i >= i0 && i <= i1 && j >= j0 && j <= j1) set(i, j, 'k', LV.ARENA, { zn: 'arena' });
    else if (j >= j0 && (i === i0 - 1 || i === i1 + 1)) set(i, j, 'x', LV.LEDGE, { zn: 'rim' });
    else set(i, j, 'x', LV.RIM + (hash2(i, j, 17) < 0.3 ? 1 : 0), { zn: 'rim' });
  });
  // ---- the woods beside the caldera sit below the rim (their trees stay under the view)
  // (the quarry's back wall: the woods stand two u above the terrace, except next to the caldera,
  // where they stay under the arena's view rays at yaw ±60)
  rect(3, 4, 29, 25, (i, j) => set(i, j, 'T', i <= 23 ? LV.WOODS + 3 : LV.WOODS, { zn: 'woods' }));
  rect(67, 4, 92, 25, (i, j) => set(i, j, 'T', i >= 73 ? LV.WOODS + 3 : LV.WOODS, { zn: 'woods' }));
}
/**
 * The glade brook's centre line (world x, z): z 94 — between rows 93 and 94 — under the two
 * bridges (x 25.5–31.5 and 45.5–51.5), north of the brook walk between them, south of the east
 * glade's slimes, and swinging ±1.5 u elsewhere.
 */
const BROOK = [
  [-1, 94.6], [5, 95.4], [11, 95.2], [16, 94.4], [21, 94.6], [25.5, 94], [31.5, 94], [35, 93.1], [39.5, 92.7],
  [43, 93.2], [45.5, 94], [51.5, 94], [55, 94.8], [60, 95.2], [65, 94.6], [70, 95.1], [75, 94.4], [79, 93.2],
  [84, 92.7], [89, 93.4], [97, 94.2],
];
/** The lip / terrace step wobbles a little (the flat boar runs stay: a whole tile at most). */
function wobZ(x) {
  if (x > 42 && x < 62) return 0; // straight below the arena gate
  return clamp((fbm2(x * 0.12, 9.1, { seed: 18, octaves: 2 }) - 0.5) * 2.4, -1, 1);
}

// ---------------------------------------------------------------------------------------------

/** Water: the glade brook, the quarry spring and its fall into the Mire, the Mire's ponds. */
function water() {
  const W_ = (i, j, ch, lvl, zn = 'water') => set(i, j, ch, lvl, { lock: true, zn });
  // ---- the brook (flows east): about two tiles wide, meandering right across the map (out under
  // the forest), straight only where the two bridges cross it (rows 93–94 at x 26–31 and 46–51)
  g.polyline(BROOK, 2.1, (i, j) => W_(i, j, 'e', LV.LOW, 'brook'));
  // sandy banks with reeds (the game grows reeds on sand beside water) and a few bare spots
  for (let j = 88; j <= 99; j++) {
    for (let i = 3; i <= 92; i++) {
      if (g.isWater(i, j) || g.isLocked(i, j) || !['glade', 'meadow', 'camp'].includes(Z(i, j))) continue;
      let wet = false;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (Z(i + di, j + dj) === 'brook') wet = true;
      if (wet && hash2(i, j, 26) < 0.55) set(i, j, 's', null);
    }
  }
  // ---- the quarry spring: a pool in the lip's edge, then the fall into the Mire's plunge pool
  rect(78, 42, 80, 43, (i, j) => W_(i, j, 'p', 3, 'spring'));
  rect(77, 44, 82, 48, (i, j) => W_(i, j, 'p', LV.BED, 'pool'));
  rect(78, 49, 80, 52, (i, j) => W_(i, j, 'o', LV.BED, 'pool'));
  // ---- the Mire's ponds: the still pond by the road, the great pond round the islet
  blob(66, 60, 2.6, 4.2, (i, j) => { if (Z(i, j) === 'mire') W_(i, j, 'o', LV.BED, 'pond'); }, { seed: 20, wobble: 0.1 });
  blob(79.2, 58.8, 7.2, 6.0, (i, j) => { if (Z(i, j) === 'mire') W_(i, j, 'o', LV.BED, 'pond'); }, { seed: 21, wobble: 0.08 });
  // the islet (only a boardwalk reaches it)
  blob(78.8, 59.2, 3.3, 3.2, (i, j) => { set(i, j, 'G', LV.LOW, { lock: true, zn: 'islet' }); }, { seed: 22, wobble: 0.06 });
  // muddy sand banks with reeds round the ponds
  for (let j = 44; j <= 72; j++) {
    for (let i = 60; i <= 91; i++) {
      if (!(Z(i, j) === 'mire' || Z(i, j) === 'islet') || g.isWater(i, j)) continue;
      let wet = false;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (g.isWater(i + di, j + dj) && Z(i + di, j + dj) !== 'spring') wet = true;
      if (wet && hash2(i, j, 23) < 0.7) set(i, j, 's', null);
    }
  }
}

// ---------------------------------------------------------------------------------------------

/** Roads and trails. */
function paths() {
  const p = g.path_;
  // camp: the spawn road, the square's lanes, the gate road
  p('Spawn road', [[48.5, 115.6], [48.5, 112]], 2.2, '.');
  p('Gate road', [[50.2, 106.5], [50.8, 101], [50.6, 97.2], [48.5, 95.4]], 2, '.');
  p('Yard lane', [[44, 109.2], [38.4, 108.6]], 1.6, 'd');
  p('Stall lane', [[51.5, 109.5], [57.6, 106.8]], 1.6, '.');
  // along the lawn to the west bridge
  p('Brook walk', [[46, 96.6], [36, 96.8], [31, 96.9], [28.5, 96.9], [28.5, 95.9]], 1.6, '.');
  // the glade: from both bridges up to the crossroads
  p('Glade road', [[48.5, 92], [48.2, 87], [48.5, 81]], 2.2, '.');
  p('West glade trail', [[28.5, 92], [31, 87.5], [37, 84.5], [44, 82.8]], 1.6, '.');
  // the crossroads: branches west (the ruins' gate) and east (the mire)
  p('Ruins road', [[45, 76.5], [40, 74.8], [35.2, 72.2], [33.6, 67.4]], 2, '.');
  p('Mire road', [[52, 76.6], [56.4, 74.5], [57.4, 71]], 2, '.');
  // the ruins: the east lane to the quarry lip, the court walk
  p('Ruins east lane', [[33.6, 67.4], [38.4, 63.6], [39.2, 55], [39.6, 48], [40, 43]], 1.8, 'd');
  p('Court walk', [[33.6, 67.2], [30.4, 66.6], [26.4, 66.2], [23.4, 63.2]], 1.6, 'd');
  // the mire: the ridge-foot road to the quarry stair
  p('Ridge-foot road', [[57.4, 71], [57.2, 60], [57.5, 48.2]], 2, '.');
  // the quarry: the lip road (round Odo's fire) and the arena road
  p('Lip road', [[4.5, 40.6], [30, 40.6], [40, 40.8], [48.5, 40.2], [53, 38.8], [58, 39.8], [70, 40.4], [91.5, 40.6]], 2, '.');
  p('Arena road', [[48.5, 40.2], [48.5, 26]], 2.4, '.');
}

// ---------------------------------------------------------------------------------------------

/** Stair flights. */
function stairs() {
  const { flight, pad } = g;
  // ruins court → the archer ledge (4 → 6), rising north
  pad(16, 60, 18, 61, LV.RUINS, 'd');
  flight('Ledge stair', 16, 59, 'N', LV.RUINS, 2, 3);
  pad(16, 55, 18, 57, LV.TERRACE, 'k');
  // ruins → the ridge pocket (4 → 6), rising east
  pad(36, 59, 37, 60, LV.RUINS, 'd');
  flight('Pocket stair', 38, 59, 'E', LV.RUINS, 2, 2);
  // the Mire → the quarry lip (2 → 5), rising north at the foot of the ridge's east flank
  pad(56, 47, 58, 48, LV.BASE, '.');
  flight('Quarry stair', 56, 46, 'N', LV.BASE, 3, 3);
  pad(56, 42, 58, 43, LV.LIP, '.');
  // the terrace → the arena gate (6 → 8), rising north, five tiles wide (the gate x 46–51)
  pad(46, 25, 50, 26, LV.TERRACE, 'k');
  flight('Arena stair', 46, 24, 'N', LV.TERRACE, 2, 5);
  // the crossroads step down into the mire and up into the ruins stay one level (walkable)
}

// ---------------------------------------------------------------------------------------------

/** Ground variety by zone (never on locked tiles), then the stone of the ruins and the quarry. */
function ground() {
  for (let j = 0; j < D; j++) {
    for (let i = 0; i < W; i++) {
      if (g.locked[I(i, j)] || T(i, j) === 'x' || T(i, j) === 'T' || T(i, j) === 's') continue;
      const zn = Z(i, j);
      const n = fbm2(i * 0.11, j * 0.11, { seed: 60, octaves: 3 });
      const m = fbm2(i * 0.23 + 7, j * 0.23 - 3, { seed: 61, octaves: 2 });
      let ch = T(i, j);
      switch (zn) {
        case 'camp': ch = n > 0.6 ? 'G' : m > 0.64 ? 'f' : 'g'; break;
        case 'meadow': ch = m > 0.5 ? 'f' : n > 0.62 ? 'G' : 'g'; break;
        case 'glade': ch = m > 0.52 ? 'f' : n > 0.58 ? 'G' : 'g'; break;
        case 'cross': ch = n > 0.6 ? 'G' : 'g'; break;
        case 'heath': ch = m > 0.6 ? 'm' : n > 0.55 ? 'G' : m < 0.3 ? 'f' : 'g'; break;
        case 'fen': ch = n > 0.5 ? 'G' : m > 0.62 ? 'm' : 'g'; break;
        case 'ruins': ch = m > 0.56 ? 'm' : n > 0.55 ? 'G' : n < 0.36 ? 'd' : 'g'; break;
        case 'ledge': ch = m > 0.5 ? 'm' : n > 0.5 ? 'G' : 'g'; break;
        case 'pocket': ch = m > 0.45 ? 'm' : 'G'; break;
        case 'mireRoad': ch = n > 0.52 ? 'G' : m > 0.6 ? 'm' : 'g'; break;
        case 'mire': case 'islet': ch = n > 0.45 ? 'G' : m > 0.55 ? 'm' : 'g'; break;
        case 'quarry': ch = m > 0.58 ? 'm' : n > 0.64 ? 'G' : n < 0.3 ? 's' : 'd'; break;
        case 'terrace': ch = m > 0.56 ? 'm' : n > 0.62 ? 'G' : n < 0.28 ? 's' : 'd'; break;
        case 'arena': ch = m > 0.64 ? 'm' : n > 0.62 ? 'c' : 'k'; break;
        default:
      }
      g.tiles[I(i, j)] = ch;
    }
  }
  // no flowers where slimes live (readability, rule 18)
  for (const s of slimeHomes()) {
    rect(Math.floor(s.x - s.r - 1), Math.floor(s.z - s.r - 1), Math.ceil(s.x + s.r + 1), Math.ceil(s.z + s.r + 1), (i, j) => {
      if (T(i, j) === 'f' && Math.hypot(i + 0.5 - s.x, j + 0.5 - s.z) < s.r + 1.5) g.tiles[I(i, j)] = hash2(i, j, 62) < 0.5 ? 'g' : 'G';
    });
  }
  // ---- the camp: the cobbled square round the campfire, the sparring yard
  blob(47.6, 109.6, 3.9, 3.3, (i, j) => { if (!g.pathMask[I(i, j)] || T(i, j) === '.') { set(i, j, 'c', LV.BASE, { lock: true }); g.pathMask[I(i, j)] = 1; } }, { wobble: 0 });
  rect(36, 105, 43, 108, (i, j) => { if (!g.isLocked(i, j)) set(i, j, hash2(i, j, 63) < 0.8 ? 'd' : 'g', null, { lock: true }); });
  // ---- the crossroads: stone flags round the waystone
  blob(48.5, 77.5, 3.2, 2.6, (i, j) => { set(i, j, 'c', LV.CROSS, { lock: true }); g.pathMask[I(i, j)] = 1; }, { wobble: 0 });
  // ---- the ruins: flagged floors, the keep's yard, broken walls one to one and a half units tall
  for (const [i0, j0, i1, j1] of [[26, 53, 35, 57], [22, 60, 30, 66], [33, 63, 37, 68]]) {
    rect(i0, j0, i1, j1, (i, j) => { if (!g.isLocked(i, j) && Z(i, j) === 'ruins' && hash2(i, j, 64) < 0.75) set(i, j, hash2(i, j, 65) < 0.7 ? 'k' : 'm', null, { lock: true }); });
  }
  rect(9, 45, 21, 56, (i, j) => { if (!g.isLocked(i, j) && Z(i, j) === 'ledge' && hash2(i, j, 66) < 0.3) set(i, j, 'k', null); });
  for (const [i, j] of RUIN_WALLS) set(i, j, 'x', LV.RUINS + 2 + (hash2(i, j, 67) < 0.5 ? 1 : 0), { lock: true });
  for (const [i, j] of LEDGE_WALLS) set(i, j, 'x', LV.TERRACE + 2, { lock: true });
  // the ruins' north rampart over the quarry lip: 1–1.5 u above the ledge, 1.5–2 u above the lip,
  // unbroken from the map edge to x 31 — the ledge archers cannot see the lip below it, nor the
  // quarry's west pack them (zone separation, rule 19); the Ruins still open onto the lip east of it
  for (let i = NORTH_WALL.i0; i <= NORTH_WALL.i1; i++) set(i, NORTH_WALL.j, 'x', LV.TERRACE + 2 + (hash2(i, NORTH_WALL.j, 69) < 0.4 ? 1 : 0), { lock: true });
  // ---- the quarry: cut-stone pads where blocks were lifted out, stacked blocks (the boars' stun
  // targets are the rock pillars), the back wall against the woods
  // (ragged: the rim tiles of a pad only now and then, a few flags spill past it)
  for (const [i0, j0, i1, j1] of QUARRY_PADS) {
    rect(i0 - 1, j0 - 1, i1 + 1, j1 + 1, (i, j) => {
      if (g.isLocked(i, j) || !(Z(i, j) === 'quarry' || Z(i, j) === 'terrace')) return;
      const out = i < i0 || i > i1 || j < j0 || j > j1;
      const rim = !out && (i === i0 || i === i1 || j === j0 || j === j1);
      const p = out ? 0.18 : rim ? 0.6 : 0.97;
      if (hash2(i, j, 70) < p) set(i, j, hash2(i, j, 68) < 0.85 ? 'k' : 'm', null);
    });
  }
  // cut stone: the stepped faces the quarrymen left at the terrace's back wall, blocks stacked on
  // the lip (a charging boar is stunned on them, like on the rock pillars)
  for (const [i0, i1, j, h] of QUARRY_FACES) {
    for (let i = i0; i <= i1; i++) {
      // ragged ends: the outermost tiles only now and then
      if ((i === i0 || i === i1) && hash2(i, j, 71) < 0.5) continue;
      set(i, j, 'q', LV.TERRACE + h + (h > 1 && hash2(i, j, 72) < 0.3 ? 1 : 0), { lock: true });
    }
  }
  for (const [i, j, h] of QUARRY_BLOCKS) set(i, j, 'q', L(i, j) + h, { lock: true });
  // the spoil heap: a gravel mound (walkable, one level up) between the goblins' yard and the arena road
  blob(40.4, 29.6, 3.2, 2.3, (i, j) => { if (!g.isLocked(i, j) && !g.pathMask[I(i, j)] && Z(i, j) === 'terrace') set(i, j, hash2(i, j, 73) < 0.6 ? 's' : 'd', LV.TERRACE + 1); }, { seed: 74, wobble: 0.25 });
  // ---- the caldera floor: a ring of cobbles round the boss, dark moss patches
  blob(48.5, 15.2, 6.2, 4.4, (i, j, d) => { if (d > 0.72 && Z(i, j) === 'arena') set(i, j, 'c', null); }, { wobble: 0 });
}

/** Broken ruin walls (blocked stubs): the gate, the court, round the keep's yard. */
const RUIN_WALLS = [
  // the ruins' broken south wall, the gate gap at x 29–36 where the road comes in
  [19, 70], [20, 70], [21, 70], [23, 70], [25, 70], [26, 70], [27, 70], [37, 70], [38, 70], [40, 70],
  // the old hall's corners round the keep's yard
  [26, 49], [26, 50], [35, 49], [35, 50], [35, 53],
  // the east courtyard's wall stubs
  [33, 58], [33, 59], [36, 56],
];
/** The ruins' north rampart (row j, tiles i0–i1; blocked, level 8–9). */
const NORTH_WALL = { j: 44, i0: 3, i1: 31 };
/** Parapet stubs on the archer ledge (they frame the archers, never block their sightlines). */
const LEDGE_WALLS = [[8, 47], [8, 48], [15, 44], [16, 44], [9, 56]];
/**
 * The quarry's cut faces at the terrace's back wall (dressed stone, custom legend char 'q'):
 * [i0, i1, row, levels above the terrace] — benches stepping up toward the woods.
 */
const QUARRY_FACES = [
  [4, 21, 26, 3], [5, 14, 27, 2], [7, 11, 28, 1],
  [74, 91, 26, 3], [76, 89, 27, 2], [79, 84, 28, 1],
];
/** Cut stone on the quarry floor: [i, j, levels above the ground] (dressed stone 'q'). */
const QUARRY_BLOCKS = [
  // stacked blocks on the lip, north of the road: charge-stun targets beside the rock pillars
  [36, 38, 2], [37, 38, 2], [37, 39, 1], [64, 38, 2], [65, 38, 1], [64, 39, 2],
  [5, 38, 2], [5, 39, 1], [4, 30, 3], [5, 30, 2], [4, 31, 2],
  [13, 26, 3], [14, 26, 2], [15, 26, 1], [13, 27, 1], [80, 26, 2], [81, 26, 3], [82, 26, 1],
  [89, 38, 1], [89, 39, 2], [90, 31, 3], [90, 32, 2], [89, 31, 1],
];
/** Cut-stone floors (tile rects) where blocks were lifted out of the quarry. */
const QUARRY_PADS = [[9, 28, 14, 31], [33, 38, 38, 39], [60, 33, 66, 35], [82, 34, 87, 36], [70, 28, 74, 29], [24, 40, 28, 42]];

// ---------------------------------------------------------------------------------------------

/**
 * The forest: every tile nobody carved stays 'T' (the game scatters trees on it). Its heights
 * follow the ground next to it (so no forest tile towers over a path), the north border rises
 * behind the rim, and one-tile corridors are closed.
 */
function border() {
  // forest heights: the level of the nearest carved ground (multi-source BFS), capped
  const lvl = new Int16Array(W * D).fill(-1);
  const q = [];
  for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) {
    if (T(i, j) !== 'T' || Z(i, j) === 'woods') { lvl[I(i, j)] = L(i, j); if (T(i, j) !== 'T') q.push(I(i, j)); }
  }
  for (let h = 0; h < q.length; h++) {
    const k = q[h];
    const i = k % W; const j = (k - i) / W;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di; const jj = j + dj;
      if (!inMap(ii, jj) || lvl[I(ii, jj)] >= 0) continue;
      lvl[I(ii, jj)] = Math.min(LV.TERRACE, Math.max(LV.BASE, lvl[k] === LV.BED || g.isWater(i, j) ? LV.BASE : lvl[k]));
      q.push(I(ii, jj));
    }
  }
  for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) {
    if (T(i, j) !== 'T' || g.isLocked(i, j) || Z(i, j) === 'woods') continue;
    g.levels[I(i, j)] = Math.max(0, lvl[I(i, j)]);
  }
  // the north border behind the caldera rim; the corners' woods
  rect(0, 0, W - 1, 3, (i, j) => { if (!g.isLocked(i, j)) set(i, j, 'T', i >= 30 && i <= 66 ? LV.RIM + 1 : LV.WOODS + 1, { zn: 'forest' }); });
  // the map ring (3 tiles; the north one is above)
  rect(0, 0, 2, D - 1, (i, j) => { if (!g.isLocked(i, j) && T(i, j) !== 'T') set(i, j, 'T', null, { zn: 'forest' }); });
  rect(W - 3, 0, W - 1, D - 1, (i, j) => { if (!g.isLocked(i, j) && T(i, j) !== 'T') set(i, j, 'T', null, { zn: 'forest' }); });
  rect(0, D - 3, W - 1, D - 1, (i, j) => { if (!g.isLocked(i, j) && T(i, j) !== 'T' && !g.pathMask[I(i, j)]) set(i, j, 'T', null, { zn: 'forest' }); });
  g.closeCorridors(3);
}

// =============================================================================================
// 2. Objects
// =============================================================================================

/** Slime homes (rule 18 keeps flowers off them; ground() reads them before the objects exist). */
const slimeHomes = () => ENEMIES.filter((e) => e[1] === 'slime').map((e) => ({ x: e[4], z: e[5], r: e[6] }));

/** The 12 light descriptors of §15.3 (ids fixed): every lamp, torch, campfire and light of the level. */
const LIGHT_IDS = [
  'campfire_camp', 'lamppost_camp_w', 'lamppost_camp_e', 'lamppost_crossroads', 'campfire_ruins', 'torch_keep',
  'light_mire', 'campfire_quarry', 'brazier_nw', 'brazier_ne', 'brazier_sw', 'brazier_se',
];

/**
 * The lodge (2.25 u south, 1 u west of the §15.3 design, 4 × 3 instead of 4.5 × 3.4 and without a
 * chimney; its lamp, flowers and cat 2 u south, 0.5 u west): from the brook walk and the gate road
 * north of it (z 96–97) the camera saw no walker past its thatch or chimney (rule 13). Its door
 * stays on the square's back edge; the campfire went 0.5 u south to keep the square open.
 */
const LODGE = { x: 46.5, z: 104.75 };

/** Waystone Camp — the lodge, the square, the sparring yard, the stall, the palisade. */
function camp() {
  P.house('lodge', 'Cinderwatch Lodge', LODGE.x, LODGE.z, { width: 4, depth: 3, wall: 'log_wall', roof: 'roof_thatch', woodpile: true, doorHood: true, chimney: false },
    ['The lodge door is barred from inside. Someone is snoring in there — steadily, like a drum keeping time for a march.',
      'A note is nailed under the knocker: "Gone up the pass. Back when the fires are out. — M."']);
  P.fire(47.5, 110, { seat: true, rotation: 0.6, id: 'campfire_camp' });
  P.lamp(43, 105.5, 'top', { id: 'lamppost_camp_w' });
  P.lamp(55.5, 112.5, 'top', { id: 'lamppost_camp_e' });
  // the palisade along z 98.5, the gate x 45–52
  P.fence(31, 98.5, 38, 98.5); P.fence(38, 98.5, 45, 98.5);
  P.fence(52, 98.5, 58.5, 98.5); P.fence(58.5, 98.5, 65, 98.5);
  // (down the camp's flanks to the woods, so the lawn outside does not lead round the gate)
  P.fence(31, 98.5, 31, 104.6); P.fence(65, 98.5, 65, 104.6);
  // the secret corner (north-east): a stack of crates and barrels in front of the chest
  P.crates(62.4, 103.9, 2, 0.1, 0.8); P.barrel(64.4, 105.3, { height: 0.95 }); P.barrel(60.6, 100.2, { height: 0.9 });
  // the sparring yard's odds and ends
  P.hay(35.4, 104.2, 0.8); P.barrel(36.4, 109.8, { height: 0.9 }); P.crate(35.6, 108.2, 0.75);
  P.bench(44.6, 112.4, E_, 1.4, false); P.bench(51.2, 113.1, W_, 1.4, false);
  // the stall and its stock
  P.stall(58.5, 104.5, S_, 'cloth_red', 3);
  P.crates(61.6, 106.9, 2, 0.3, 0.75); P.barrel(55.8, 104.9, { height: 0.9 });
  // the lodge: a barrel by the door, flowers
  P.flowers(44.7, 106.6, S_, 1.0);
  P.sign(53.4, 100.2, ['↑ the {Mossy Glade} · {The Crossroads}\nBeyond: the {Cinder Quarry} and the {Caldera}.'], { rotation: -0.2 });
  P.critters('camp_hens', 'chicken', 58.8, 110.8, 4, 2.2, { seed: 812, seedBase: 60 });
  P.critters('camp_cat', 'cat', 45.1, 108.2, 1, 2.4, { seedBase: 11 });
  P.emit('fireflies', 48, 108, [26, 2.4, 14], 30, 1.0);
  // birches round the clearing (hand-placed: no sightline may run through them)
  P.tree('birch', 33.2, 101.2, 5.2); P.tree('oak', 31.8, 113.8, 5.6); P.tree('birch', 63.6, 114.6, 5); P.tree('autumn', 66.2, 108.6, 5.4);
}

/** The Mossy Glade — the brook and its bridges, the meadow, the west chest. */
function glade() {
  P.bridge('bridge_brook_w', 28.5, 92.3, 28.5, 95.7, 2, 1.0, 0.18, { name: 'West Brook Bridge' });
  P.bridge('bridge_brook', 48.5, 92.3, 48.5, 95.7, 2.4, 1.0, 0.2, { name: 'Glade Bridge' });
  P.emit('petals', 48, 88, [60, 4, 12], 60, 2.6);
  P.emit('leaves', 22, 86, [26, 4, 14], 34, 2.8);
  P.critters('glade_birds', 'bird', 54.5, 90.5, 3, 1.6, { seedBase: 320 });
  // a lone oak over the chest in the west meadow, rocks by the brook
  P.tree('oak', 12.8, 84.2, 6.2); P.tree('birch', 84.4, 84.8, 5.2);
  P.rock(22.4, 95.8, 0.8); P.rock(62.6, 96.4, 0.7); P.rock(77.8, 92, 0.9);
  // stones on the banks of the bends
  P.rock(37.6, 91.6, 0.55); P.rock(57.8, 96.6, 0.6); P.rock(86.6, 91.7, 0.5); P.rock(9.4, 96.6, 0.5);
}

/** The Crossroads — waystone, signpost, lamppost, Pip; the ridge's end rises behind. */
function crossroads() {
  P.lamp(45.5, 75.5, 'top', { id: 'lamppost_crossroads' });
  P.sign(46, 79.8, ['← the {Bramble Ruins} · → the {Hollow Mire}\nBoth roads climb to the {Cinder Quarry}.\n↓ {Waystone Camp}'], { boards: 3, rotation: 0.15 });
  P.rock(40.2, 79.4, 0.9); P.rock(56.8, 79.6, 0.8); P.bench(52.6, 79.9, N_, 1.4, false);
}

/**
 * The Old Keep (2.5 u south of the §15.3 design, 3.5 u deep instead of 4): the lip road north of it
 * (z 39–41) stays in view past its roof (rule 13).
 */
const KEEP = { x: 30.5, z: 53, depth: 3.5 };

/** Bramble Ruins — the keep, the goblin camp, the court, the ledge. */
function ruins() {
  P.house('keep', 'The Old Keep', KEEP.x, KEEP.z, { width: 5, depth: KEEP.depth, stories: 2, wall: 'stone_brick', upperWall: 'stone_brick', roof: 'roof_slate', chimney: false, shutters: false, doorHood: true },
    ["The keep's door is rusted shut. Goblin scrawl covers the timbers: a very bad drawing of a very big rock man, and an arrow pointing north."]);
  P.torch(KEEP.x - 1.5, KEEP.z + KEEP.depth / 2 + 0.12, S_, 2.2, { id: 'torch_keep' });
  P.fire(28.5, 63.5, { seat: true, rotation: 1.2, id: 'campfire_ruins' });
  P.crates(31, 60.8, 2, 0.3, 0.8); P.barrel(31.6, 64.2); P.barrel(32.4, 63.3, { height: 0.85, lying: true, rotation: 0.4 });
  P.crates(12.2, 46.2, 2, 0.1, 0.7);
  P.emit('leaves', 24, 58, [30, 4, 24], 44, 2.8);
  P.emit('smoke', 28.5, 63.5, [1.2, 2.4, 1.2], 6, 2.4);
}

/** Cinder Ridge — rocks in the pocket (the crest's pines and boulders come after the scatter). */
function ridge() {
  P.rock(40.7, 62.3, 0.6);
}

/**
 * Pines on the ridge's crest and boulders on its flanks (seeded, after the other scatter): the
 * pines count as scattered trees, so clearCrowns drops any that would hide a fight in the Ruins or
 * the Mire at yaw ±60. Nothing here is walkable ground: the ridge is blocked rock.
 */
function ridgeWoods() {
  const rng = new RNG('cinderwatch:ridge');
  const trees = [];
  let pines = 0; let rocks = 0;
  for (let k = 0; k < 400 && pines < 16; k++) {
    const x = rng.range(44.5, 51.5); const z = rng.range(47, 69);
    const i = Math.floor(x); const j = Math.floor(z);
    // (none on the north end: the lip and the Quarry Waystone stay in view behind it)
    if (Z(i, j) !== 'ridge' || L(i, j) < 9 || z < 51) continue;
    if (trees.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 2.6 * 2.6)) continue;
    if (P.VIEWS.some((v) => z > v.z && z < v.z + v.depth && Math.abs(x - v.x) < v.w)) continue;
    const h = rng.range(4.2, 5.6);
    P.SCATTERED.add(P.tree(rng.chance(0.8) ? 'pine' : 'birch', x, z, h));
    trees.push({ x, z });
    pines++;
  }
  // boulders on the shelves and among the crest's blocks: they break up the cliff bands
  for (let k = 0; k < 900 && rocks < 30; k++) {
    const x = rng.range(42.4, 53.6); const z = rng.range(44.6, 71.2);
    const i = Math.floor(x); const j = Math.floor(z);
    if (Z(i, j) !== 'ridge' || trees.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 1.6 * 1.6)) continue;
    const crest = L(i, j) >= 9;
    if (P.blockedAt(x, z, crest ? 1.6 : 1.2)) continue;
    P.rock(x, z, crest ? rng.range(1.0, 1.6) : rng.range(0.7, 1.35));
    rocks++;
  }
  return { pines, rocks };
}

/**
 * Cinder Ridge's blocked rock → the custom legend char 'r' (the 'crag' side texture: broken rock
 * faces instead of the cliff's strata on its shelves). Run after every seeded placement: the
 * scatter passes read the ridge as 'x' (blocked rock), so this changes no tree, rock or pine.
 */
function ridgeRock() {
  let n = 0;
  for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) if (Z(i, j) === 'ridge' && T(i, j) === 'x') { g.tiles[I(i, j)] = 'r'; n++; }
  return n;
}

/** Hollow Mire — the boardwalks, the islet, the fall, the teal light. */
function mire() {
  // boardwalks (flat piers over the water at the bank's height)
  P.bridge('boardwalk_west', 62.6, 61.4, 69.6, 61.4, 1.8, 0.5, 0, { name: 'West Boardwalk' });
  P.bridge('boardwalk_islet', 70.3, 58.4, 75.9, 58.4, 1.6, 0.5, 0, { name: 'Islet Boardwalk' });
  P.bridge('boardwalk_north', 76.4, 50.4, 82.6, 50.4, 1.8, 0.5, 0, { name: 'North Boardwalk' });
  P.waterfall('fall_mire', 79.5, 44, 3, 'S', { mist: { count: 22, alpha: 0.08 } });
  // the marsh light: a teal will-o'-wisp hovering over a mossy standing stone by the great pond. It
  // lights the reeds from 2.4 u up (from 1.2 u it blew the tufts beside it out to white), soft by
  // day and bluer than the grass (a green-teal went lime on it); the wisp shows day and night
  P.rock(72.3, 63.6, 1.25);
  P.light(72.3, 63.6, { id: 'light_mire', dy: 2.4, color: '#4fc4dc', intensity: 4.5, distance: 9, flicker: 0.35, nightOnly: false });
  P.emit('fireflies', 72.3, 63.6, [1.4, 0.8, 1.4], 8, 2.3, { params: { color: '#a6f4ff', colorEnd: '#52c8f0', nightVisibility: 0, hdr: 3, size: [0.26, 0.38] } });
  // the wisp itself, readable by day: a steady (unblinking) pale core where the light hangs, and
  // motes rising off the stone's crown (one particle pool, no new shader program)
  const WISP = { color: '#8af2ff', colorEnd: '#3cc6ea', nightVisibility: 0, blink: 0, velocityVariance: [0.04, 0.03, 0.04], turbulence: [0.2, 0.35], windInfluence: 0 };
  P.emit('fireflies', 72.3, 63.6, [0.4, 0.3, 0.4], 2, 2.2, { params: { ...WISP, hdr: 3, size: [0.75, 0.95], life: [7, 11] } });
  P.emit('fireflies', 72.3, 63.6, [1.1, 0.6, 1.1], 6, 1.3, { params: { ...WISP, hdr: 3.2, size: [0.22, 0.34], life: [4, 7] } });
  P.emit('mist', 72, 58, [30, 1.4, 22], 30, 0.4);
  P.emit('mist', 79.5, 46.5, [7, 1.6, 4], 16, 0.4);
  P.emit('fireflies', 72, 60, [34, 2.4, 26], 44, 1.0);
  P.emit('sparkle', 79.5, 46, [6, 0.5, 3], 8, 0.3, { params: { life: [0.5, 1.1] } });
  P.sign(60.4, 48.6, ['↑ the {Cinder Quarry} · the {Caldera}\n↓ the {Hollow Mire} · {The Crossroads}'], { rotation: -0.2 });
  P.rock(88.6, 46.2, 1.1); P.rock(62.8, 45.6, 0.8);
}

/** Cinder Quarry — the lip and the terrace: rock pillars, Odo's camp, the arena road. */
function quarry() {
  P.fire(52.5, 41.5, { seat: false, rotation: 0.3, id: 'campfire_quarry' });
  P.bench(52.6, 43.3, N_, 1.4, false); P.crates(45.8, 38.2, 2, 0.2, 0.75); P.barrel(55.6, 42.6);
  // railing along the lip above the Mire
  P.fence(59.4, 43.9, 66, 43.9); P.fence(66, 43.9, 72.5, 43.9); P.fence(84, 43.9, 90, 43.9);
  // rock pillars: the boars' stun targets
  for (const [x, z, s] of [[15.8, 38.4, 1.6], [26.8, 38.6, 1.5], [18.2, 43, 1.3], [71.8, 38.3, 1.6], [82.4, 38.5, 1.5], [60.8, 29.4, 1.5], [51.2, 35.6, 1.2], [23.6, 28.8, 1.4], [74.2, 28.4, 1.3]]) P.rock(x, z, s);
  // the goblins' salvage pile on the west terrace, a stone-cutters' yard on the east terrace
  P.crates(19.4, 27.4, 2, 0, 0.85); P.barrel(16.4, 27.9); P.barrel(17.2, 29.1, { height: 0.85, lying: true, rotation: 0.9 });
  P.fence(16.2, 30.6, 22.8, 30.6);
  P.crates(78.4, 33.2, 2, -0.2, 0.8); P.barrel(76.3, 32.6); P.crate(80.5, 33.4, 0.75);
  P.fence(75.4, 35.6, 81.6, 35.6);
  P.sign(50.9, 27.4, ['↑ {The Caldera}. Cinderheart sleeps within.\nBait his charge into a brazier; roll through his fire rings, toward him; step out of the magma.'], { boards: 1, rotation: 0.15, speaker: 'Signpost' });
  P.emit('dust', 48, 36, [80, 3.5, 18], 60, 1.4);
}

/** The Caldera — the four braziers, embers and smoke. */
function caldera() {
  // (≥ 2 u inside the arena edges, rule 9: the §15.3 z 9.5 / 21.5 moved 1 u inward)
  for (const [id, x, z] of BRAZIERS) P.fire(x, z, { seat: false, rotation: 0.5, id });
  // (the braziers smoke on their own: no free-floating smoke area — its puffs drifted over the rim
  // as big out-of-focus discs with no fire under them)
  P.emit('embers', 48.5, 15.5, [24, 3, 15], 44, 0.8);
}
const BRAZIERS = [['brazier_nw', 38.5, 10.5], ['brazier_ne', 58.5, 10.5], ['brazier_sw', 38.5, 20.5], ['brazier_se', 58.5, 20.5]];

// =============================================================================================
// 2b. People
// =============================================================================================

function people() {
  const { npc } = P;
  npc('maren', 'Captain Maren', 'swordsman', 43.5, 109.5, '#c9a45c', [
    'Captain Maren, of the Cinderwatch. The pass has woken, traveller — slimes in the glade, goblins in the old ruins, and something big breathing up in the {Caldera}.',
    'Try your blade on the straw dummies first. They hit back about as hard as I expect you to.',
  ], { wander: 0.3, speed: 0.8, behaviour: 'post', facing: 'left', script: 'drillmaster' });
  // (the `shopkeeper` script: his pages, then the combat shop's menu — draughts and one-time wares)
  npc('bram', 'Bram', 'merchant', 60.9, 104.9, '#d9776a', [
    'Healing Draughts! Glade honey, cold spring water and something I promised my grandmother never to name.',
    'Whetstones, ironbark tonic, a warding charm or two — the watch pays me in stories, so the rest of you pay in gold.',
  ], { wander: 0.3, speed: 0.8, behaviour: 'post', facing: 'left', action: 'shop', item: 'Healing Draught', script: 'shopkeeper' });
  // Ilse joins the party as its healer (a mystic: the cleric's staff); a `post` villager by the
  // campfire square (wander 1.0 keeps her keep-clear disc, and so the scatter, as it was)
  npc('ilse', 'Sister Ilse', 'cleric', 50.5, 111.5, '#a7c7e7', [
    'The waystones remember the last traveller who came near. Walk close, and the crystal will know you.',
    'Should you fall, the stone you last woke calls you back to it — lighter in the purse, but whole.',
    'Rest at a stone and your wounds close. The creatures of the pass return to their haunts as well, mind. Nothing is free up here — not even sleep.',
  ], { wander: 1.0, speed: 0.7, behaviour: 'post', facing: 'down', talk: ILSE_TALK, title: 'Keeper of the Waystones' });
  npc('pip', 'Pip', 'hunter', 51.5, 75.5, '#78b35b', [
    'Two roads up to the quarry from here, and neither of them is a stroll.',
    'West, the ruins — archers on the walls, and a blade-smith\'s cache up on the ledge. Whoever carries that blade hits harder.',
    'East, the mire — bats over the water, and something that hardens the heart out on the islet. Both roads meet again on the {quarry lip}.',
  ], { wander: 0.3, speed: 0.8, behaviour: 'post', facing: 'left' });
  npc('odo', 'Odo', 'guard', 44.5, 42.5, '#6a8fd6', [
    'Cinderheart\'s awake in the {Caldera}. When he lowers his head and paws the stone, get a brazier between you — bait the charge into it and he\'ll stagger long enough for a proper beating.',
    'When he smashes the ground, rings of fire roll out. Don\'t run from them. Roll through them — toward him.',
    'And the molten pools he leaves behind burn for as long as you stand in them. Step out, then step back in to swing.',
    'The watch keeps its last stores up here — draughts, whetstones, tonic. Coin for the cause, and they are yours.',
  ], { wander: 0.3, speed: 0.8, behaviour: 'post', facing: 'up', action: 'shop', item: 'Healing Draught', script: 'shopkeeper' });
  // Sela keeps the Crossroads Waystone and joins the party when asked (docs/specs/PARTY.md §9): east
  // of the stone, between it and the bench — off the bot's way in from the west glade, out of reach
  // of a player resting at the stone (2.4 u; talk radius 1.6). Her `talk` script replaces the pages
  // (the pages stay as the plain fallback the catalog wants). Her title beside the name plate is
  // mockup G's (its renderings: docs/specs/I18N_GLOSSARY.md §6).
  npc('sela', 'Sela', 'guard', SELA.x, SELA.z, '#e8873a', [
    'Sela, of the Cinderwatch. The watch keeps this stone — and today the watch is me.',
    'The old fire went out and the pass woke up. Mind the boars on the {quarry lip}: they only ever charge in straight lines.',
  ], { wander: 0.3, speed: 0.8, behaviour: 'post', facing: 'down', spec: SELA_LOOK, talk: SELA_TALK, title: 'Warden of the Cinderwatch' });
  // Rook, the camp's bowman, joins as a ranger: south of the sparring yard, facing the camp square
  // (the pages stay as the plain fallback, as Sela's)
  npc('rook', 'Rook', 'hunter', ROOK.x, ROOK.z, '#a58ad8', [
    'Rook, scout of the Cinderwatch. The captain has me minding the camp.',
    'Archers on every ledge up there. Takes one to know one.',
  ], { wander: 0.3, speed: 0.8, behaviour: 'post', facing: 'right', spec: ROOK_LOOK, talk: ROOK_TALK, title: 'Scout of the Cinderwatch' });
}

/** Sela's post at the Crossroads Waystone (48.5, 77.5). */
const SELA = { x: 50.8, z: 78.1 };
/**
 * Sela's look: the `guard` preset bare-headed — a silver ponytail, an ember-red tabard over mail, a
 * short charcoal cape, the guard's spear (her class weapon: a warden).
 */
const SELA_LOOK = {
  hat: 'none', female: true, hair: 'hairWhite', hairStyle: 'ponytail', eyes: 'gold',
  outfit: { top: '#a8452c', bottom: '#3a3640', accent: 'gold', style: 'tabard', shirt: 'metal' },
  cape: { color: '#2f2a30', style: 'short', lining: '#7a2a20' },
  gear: { pauldrons: true, boots: 'black', gloves: 'brown' },
};
/**
 * Sela's talk script (STORY_SCRIPT.md §7): who she is and the offer — shorter from the second talk
 * (`visits`) —, `party join sela as warden balanced`; as a member (`party:sela`) her orders: the
 * tactics panel, part ways (asked twice), lead on. (A `choice` after an `if` / `cycle` block asks
 * its own question: only lines just before it in the same block carry its options.)
 */
const SELA_TALK = [
  'if party:sela',
  '  cycle sela-orders',
  '    * Sela: Still on your feet? Good.',
  '    * Sela: Every step up, the pass gets louder.',
  '    * Sela: Your lead, traveller.',
  '  choice How do you want this spear?',
  '    > Tactics…',
  '      party menu sela',
  '    > Part ways',
  "      Sela: Here? You're sure?",
  '      choice',
  '        > No — stay with me',
  "          Sela: Good. I'd have followed you anyway.",
  '        > Yes, part ways',
  '          party leave sela',
  // (her post from now on is where she stood: a villager put back far from home would walk there
  // in a straight line — through the player, into the first cliff)
  '          home sela',
  '          Sela: Then this is where I keep watch. Come back for me if the pass gets too loud.',
  '    > Lead on',
  '      Sela: Lead on, then.',
  '  stop',
  'if visits = 0',
  '  Sela: Easy, traveller. Sela, of the Cinderwatch — the watch keeps this stone, and today the watch is me.',
  '  - Since the old fire went out, the pass has been waking one hollow at a time. Slimes in the glade, goblins in the keep, and something up in the {Caldera} that breathes like a forge.',
  "  - A stone can keep itself. If you mean to climb to the {Caldera}, I'd rather be climbing with you.",
  'else',
  "  Sela: Back again. The {Caldera} hasn't come any closer.",
  // (a full party hears no offer: Ilse and Rook leave her the third place, so only another villager
  // holding one — the tests' Pip, joined by the hook — fills it)
  'if party >= 3',
  "  Sela: Your company's full, traveller. If one of them heads home, the stone and I will still be here.",
  '  stop',
  'choice Shall my spear walk with you?',
  '  > Walk with me',
  '    party join sela as warden balanced',
  '    sfx chime',
  // (Ilse and Rook may have joined at the camp already)
  '    if party = 1',
  "      Sela: Then it's the two of us. I'll keep to your heels — tell me how you want me fighting, and that's how I'll fight.",
  '    else',
  "      Sela: Then the watch marches with you. I'll keep to your heels — tell me how you want me fighting, and that's how I'll fight.",
  '    toast Sela joined your party · G: Tactics',
  '  > Not yet',
  "    Sela: Then I'll keep the stone warm. You know where to find me.",
];

/**
 * Sister Ilse's talk script (as Sela's): her three pages on the waystones and an offer — shorter
 * from the second talk —, `party join ilse as mystic support` (the party's healer); as a member her
 * orders: the tactics panel, part ways (asked twice), lead on. A full party hears no offer.
 */
const ILSE_TALK = [
  'if party:ilse',
  '  cycle ilse-orders',
  '    * Ilse: The stones are listening. Walk on.',
  '    * Ilse: Bruised? Stay where my light can reach you.',
  '    * Ilse: I am with you, traveller.',
  '  choice How shall I serve?',
  '    > Tactics…',
  '      party menu ilse',
  '    > Part ways',
  '      Ilse: Here? Are you certain?',
  '      choice',
  '        > No — stay with me',
  '          Ilse: Then I stay.',
  '        > Yes, part ways',
  '          party leave ilse',
  '          home ilse',
  '          Ilse: The nearest stone will know where I am. Go gently.',
  '    > Lead on',
  '      Ilse: Lead on.',
  '  stop',
  'if visits = 0',
  '  Ilse: The waystones remember the last traveller who came near. Walk close, and the crystal will know you.',
  '  - Should you fall, the stone you last woke calls you back to it — lighter in the purse, but whole.',
  '  - Rest at a stone and your wounds close. The creatures of the pass return to their haunts as well, mind. Nothing is free up here — not even sleep.',
  '  - The pass has grown too loud for one blade. Let me walk with you, and I will mend what it breaks.',
  'else',
  '  Ilse: Back from the road? The pass will not wait for you to heal — but I can heal you as you go.',
  'if party >= 3',
  "  Ilse: Three already walk at your back. Go with the stones' blessing, and come for me if one of them turns home.",
  '  stop',
  'choice Shall I walk with you?',
  '  > Walk with me',
  '    party join ilse as mystic support',
  '    sfx chime',
  '    Ilse: Then I come. Keep close, and I will keep you whole.',
  '    toast Sister Ilse joined your party · G: Tactics',
  '  > Not yet',
  '    Ilse: The stones will keep me. Come back when you need mending.',
];

/** Rook's post at the Waystone Camp: south of the sparring yard (the dummies), west of the square. */
const ROOK = { x: 40.5, z: 112.5 };
/**
 * Rook's look: the `hunter` preset (its bow — his class weapon: a ranger — and quiver) in the
 * watch's colours: an ember-red hood with a gold feather tuft, a leather tunic, Sela's short
 * charcoal cape with the ember lining.
 */
const ROOK_LOOK = {
  skin: 'skinDark', hair: 'hairBlack', hairStyle: 'short', eyes: 'brown',
  hat: 'hood', hatColor: '#8f3b28', feather: 'gold',
  outfit: { top: '#6b4a32', bottom: '#3a3640', accent: 'red', style: 'tunic', shirt: 'cream' },
  cape: { color: '#2f2a30', style: 'short', lining: '#7a2a20' },
  gear: { quiver: true, bracers: true, boots: 'black', belt: 'brown' },
};
/**
 * Rook's talk script (as Sela's): who he is and the offer, `party join rook as ranger balanced`;
 * as a member his orders. A full party hears no offer.
 */
const ROOK_TALK = [
  'if party:rook',
  '  cycle rook-orders',
  "    * Rook: Quiver's full. Point me at something.",
  '    * Rook: Anything with a bow is mine. Anything bigger is yours.',
  '    * Rook: Your call, traveller.',
  "  choice What's the plan?",
  '    > Tactics…',
  '      party menu rook',
  '    > Part ways',
  '      Rook: Here? You sure?',
  '      choice',
  '        > No — stay with me',
  '          Rook: Good. I was just getting my eye in.',
  '        > Yes, part ways',
  '          party leave rook',
  '          home rook',
  "          Rook: Fair enough. I'll watch the road from here.",
  '    > Lead on',
  '      Rook: Lead on.',
  '  stop',
  'if visits = 0',
  '  Rook: Rook, scout of the Cinderwatch. The captain has me minding the camp while the whole pass goes mad.',
  '  - Goblins on the ruin walls, bats over the mire, archers on every ledge — and me down here, shooting straw.',
  "  - Take me up the pass and I'll pick off whatever's shooting at you. Keep the big ones busy; I'll do the rest.",
  'else',
  '  Rook: Still here. Still shooting straw.',
  'if party >= 3',
  "  Rook: Your company's full. Come back for me if one of them heads home.",
  '  stop',
  'choice Want a bow at your back?',
  '  > Walk with me',
  '    party join rook as ranger balanced',
  '    sfx chime',
  "    Rook: About time! Keep them off me and I'll keep them off you.",
  '    toast Rook joined your party · G: Tactics',
  '  > Not yet',
  "    Rook: Suit yourself. I'll be here, shooting straw.",
];

/**
 * The level's story events (after the regions: markers, no collider, no scatter): with a companion
 * in the party, the story sets its combat rule or has it speak — Sela: Guard Me on the quarry lip
 * (the boars' charges), Support on the caldera stair (Cinderheart) unless Ilse heals already; Rook:
 * Hunt Casters at the Bramble Ruins (the archers on the walls); Ilse: a word on the caldera stair.
 * Background runs (`bark`: the player walks on), once each.
 */
function story() {
  P.add('event', {
    id: 'ev_sela_lip', ...SELA_LIP, on: 'enter', once: true, if: 'party:sela', background: true,
    run: [
      'emote sela !',
      'bark sela Boars on the lip — they charge in straight lines. I\'ll stay at your shoulder.',
      'party rule sela guardian',
    ],
  });
  P.add('event', {
    id: 'ev_sela_caldera', ...SELA_CALDERA, on: 'enter', once: true, if: 'party:sela and not party:ilse', background: true,
    run: [
      'bark sela That\'s Cinderheart up there. You break the rock — I\'ll keep you standing.',
      'party rule sela support',
    ],
  });
  P.add('event', {
    id: 'ev_rook_ruins', ...ROOK_RUINS, on: 'enter', once: true, if: 'party:rook', background: true,
    run: [
      'emote rook !',
      'bark rook Archers on the walls. The ones with bows are mine.',
      'party rule rook hunter',
    ],
  });
  P.add('event', {
    id: 'ev_ilse_caldera', ...SELA_CALDERA, on: 'enter', once: true, if: 'party:ilse', background: true,
    run: [
      'bark ilse Cinderheart… Stay within my reach, and I will keep you whole.',
    ],
  });
}
/** The quarry lip (rows 37–43, where both branches come up: the Ruins east lane, the Mire stair). */
const SELA_LIP = { minX: 3, maxX: 93, minZ: 37, maxZ: 44 };
/** The caldera stair and its pad below the arena gate (x 46–51, z 23–27). */
const SELA_CALDERA = { minX: 45.5, maxX: 51.5, minZ: 23.2, maxZ: 27 };
/** The Bramble Ruins inside their outer wall (rows 44–71: the road from the crossroads comes in at x 34). */
const ROOK_RUINS = { minX: 4, maxX: 41, minZ: 44, maxZ: 71.5 };

// =============================================================================================
// 2c. Combat objects (explicit ids, §15.3)
// =============================================================================================

/**
 * [id, kind, count, level, x, z, radius, extra] — positions are the design (§15.3). Counts and levels
 * are balanced for the party of four (ADR-056: the player with Rook and Ilse from the camp, Sela from
 * the crossroads): the glade for three, a pack more each and Lv 2; the Ruins (the harder branch) Lv
 * 7–8 with a third goblin in the court, the Mire Lv 6–7, the quarry Lv 8 — measured with the old
 * real-time combat's play-through bot; the GLAIVE stat blocks (src/game/glaive/bestiary.js) scale
 * with these levels (`monsterStats`). More foes than these
 * would break rule 15 (≤ 30 start spots within 28 u, at the crossroads); the levels carry the rest.
 * @type {[id: string, kind: string, count: number, level: number, x: number, z: number,
 *   radius: number, extra?: { spotOffsets?: XZ[], area?: Rect, elite?: boolean, name?: string,
 *   arena?: Rect, gate?: number[] }][]}
 */
const ENEMIES = [
  ['dummies', 'dummy', 3, 1, 40.5, 106.5, 2, { spotOffsets: [[-2.5, 0], [0, 0], [2.5, 0]] }],
  // (their scatter square stops short of the brook: no start spot on the bank's edge)
  ['glade_slimes_w', 'slime', 4, 2, 26.5, 90.5, 3, { area: { minX: -3, maxX: 3, minZ: -3, maxZ: 1.6 } }],
  ['glade_slimes_n', 'slime', 5, 2, 38.5, 89.5, 3.5],
  ['glade_slimes_e', 'slime', 4, 2, 70.5, 90.5, 3],
  ['glade_goblins', 'goblin', 3, 2, 60.5, 86.5, 2.5],
  ['ruins_gate_goblins', 'goblin', 3, 7, 30.5, 69.5, 2.5],
  ['ruins_slimes', 'slime', 2, 7, 36.5, 62.5, 2],
  ['ruins_court', 'goblin', 3, 8, 25.5, 58.5, 2.5],
  ['ruins_shaman', 'shaman', 1, 8, 21.5, 60.5, 1.5],
  ['ruins_archers_w', 'archer', 2, 7, 12.5, 54.5, 2],
  ['ruins_archers_n', 'archer', 2, 8, 19.5, 49.5, 2],
  ['mire_bats_s', 'bat', 3, 6, 66.5, 69.5, 3],
  // (their scatter square stays off the still pond's bank and the west boardwalk)
  ['mire_slimes', 'slime', 3, 6, 61.5, 61.5, 2.5, { area: { minX: -2.5, maxX: 0.5, minZ: -2.5, maxZ: 2.5 } }],
  ['mire_bats_islet', 'bat', 3, 7, 77.5, 58.5, 3],
  ['mire_bats_n', 'bat', 3, 7, 69.5, 50.5, 3],
  ['mire_shaman', 'shaman', 1, 7, 84.5, 65.5, 1.5],
  ['mire_goblins', 'goblin', 2, 7, 60.5, 53.5, 2.5],
  ['quarry_boar_w', 'boar', 1, 8, 20.5, 40.5, 1.5],
  ['quarry_boar_e', 'boar', 1, 8, 76.5, 40.5, 1.5],
  // (one spot, at home, roaming 1 u: a player resting at the Quarry Waystone stays out of its sight, rule 5)
  ['quarry_boar_elite', 'boar', 1, 8, 56.5, 32.5, 1, { spotOffsets: [[0, 0]], elite: true, name: 'Old Ironhide' }],
  ['quarry_goblins', 'goblin', 3, 8, 28.5, 31.5, 2.5],
  ['quarry_archers', 'archer', 2, 8, 68.5, 30.5, 2],
  ['quarry_bats', 'bat', 2, 8, 34.5, 34.5, 2.5],
  ['cinderheart', 'golem', 1, 6, BOSS.x, BOSS.z, 1, { name: 'Cinderheart', arena: { ...ARENA_REL }, gate: [...GATE_REL] }],
];
/** The roads along Cinder Ridge (clearCrowns keeps their walkers in view at yaw ±60). */
const RIDGE_ROADS = ['Ruins east lane', 'Ridge-foot road'];
/** Rule 20 (chase / group-wake margins): the group-wake radius of CombatSystem._wakeGroup (u). */
const WAKE_R = 6;
/** Rule 20: how far a fight drifts past rule 19's ring round the start spots (u) — about one roll (ROLL.dist 3.2). */
const CHASE_MARGIN = 3;
/**
 * Rule 20 conflicts accepted after the review (moving a group more than 3 u would break the zone's
 * layout): { a: the pack being fought, b: the pack it wakes, why } — printed as warnings.
 */
const RULE20_ACCEPTED = [];
/** Ledge archers (rule 8: one of their targets lies on the floor below the ledge). */
const LEDGE_ARCHERS = new Set(['ruins_archers_w', 'ruins_archers_n']);
const WAYSTONES = [['waystone_camp', 'Camp Waystone', 53.5, 107.5], ['waystone_crossroads', 'Crossroads Waystone', 48.5, 77.5], ['waystone_quarry', 'Quarry Waystone', 48.5, 42.5]];
const CHESTS = [
  ['chest_camp_secret', 63.5, 101.5, { rotation: W_, gold: 40 }],
  ['chest_glade', 15.5, 86.5, { rotation: S_, gold: 20, potions: 1 }],
  ['chest_ruins_ledge', 10.5, 50.5, { rotation: E_, upgrade: 'attack' }],
  ['chest_ridge', 42.5, 60.5, { rotation: W_, gold: 30, potions: 1 }],
  ['chest_mire_islet', 78.5, 60.5, { rotation: W_, upgrade: 'maxHp' }],
  ['chest_quarry', 84.5, 30.5, { rotation: S_, gold: 30, potions: 1, upgrade: 'maxMp' }],
];

/** Positions moved from the §15.3 design by a rule (printed in the report). */
const MOVES = [
  'brazier_nw (38.5, 9.5) → (38.5, 10.5), brazier_ne (58.5, 9.5) → (58.5, 10.5), brazier_sw (38.5, 21.5) → (38.5, 20.5), brazier_se (58.5, 21.5) → (58.5, 20.5): rule 9 (≥ 2 u inside the arena edges)',
  'fall_mire (79.5, 44.5) → (79.5, 44): waterfalls stand on a tile edge (rule 13)',
  "glade_slimes_n (40.5, 87.5) → (38.5, 88.5): rule 5 (a player resting at the Crossroads Waystone is out of the roaming slimes' sight)",
  'quarry_boar_elite (55.5, 32.5), radius 1.5 → (56.5, 32.5), radius 1, one spot at home: rule 5 (the Quarry Waystone)',
  'ruins_archers_n (19.5, 47.5) → (19.5, 48.5): rule 14 (the north rampart hides the lip part of its home disc); → (19.5, 49.5): rule 20 (a fight with quarry_boar_w drifting under the rampart came within 3 u of a roaming archer)',
  'light_mire (71.5, 63.5) → (72.3, 63.6): onto its standing stone',
  'lodge (47.5, 102.5) → (46.5, 104.75), 4 × 3 without a chimney (lamppost_camp_w, its flowers and the camp cat 2 u south, 0.5 u west), campfire_camp (47.5, 109.5) → (47.5, 110) to keep the square open; keep (30.5, 50.5) → (30.5, 53), 3.5 u deep, torch_keep with it: rule 13 (no walker behind a roof above the knee on a path tile)',
];

function combatObjects() {
  for (const [id, name, x, z] of WAYSTONES) P.waystone(id, name, x, z);
  for (const [id, x, z, o] of CHESTS) P.chest(id, x, z, o);
  for (const [id, kind, count, level, x, z, radius, extra = {}] of ENEMIES) P.enemy(id, kind, count, level, x, z, radius, extra);
}

// =============================================================================================
// 2d. Sightlines, scatter, crowns
// =============================================================================================

function sightlines() {
  for (const o of P.objects) {
    if (o.type === 'npc') P.view(o.x, o.z, 3, 9);
    else if (o.type === 'house') { const d = P.doorOf(o); P.view(d.x, d.z - 1, 2.5, 8.5); }
    else if (o.type === 'well' || o.type === 'campfire' || o.type === 'signpost' || o.type === 'waystone' || o.type === 'chest') P.view(o.x, o.z, 2, 4.5);
  }
  P.view(48.5, 113.5, 7, 7); // the spawn
  P.view(48.5, 77.5, 7, 8); // the crossroads
  P.view(48.5, 15.5, 16, 24); // the caldera: nothing tall south of the arena
  P.view(79.5, 46, 6, 10); // the fall
}

const TREE_RULES = {
  camp: { keep: 0.12, spacing: 4, pathGap: 2, south: 5, kinds: [['birch', 50], ['oak', 30], ['autumn', 20]], h: [4.4, 5.6] },
  meadow: { keep: 0.14, spacing: 4, pathGap: 2, south: 4, kinds: [['oak', 45], ['birch', 35], ['autumn', 20]], h: [4.2, 5.6] },
  glade: { keep: 0.22, spacing: 3.6, pathGap: 2, south: 4, kinds: [['oak', 40], ['birch', 30], ['autumn', 30]], h: [4.2, 6] },
  cross: { keep: 0.1, spacing: 4.5, pathGap: 2, south: 5, kinds: [['birch', 60], ['oak', 40]], h: [4, 5] },
  heath: { keep: 0.3, spacing: 3.4, pathGap: 2, south: 4, kinds: [['oak', 45], ['autumn', 35], ['birch', 20]], h: [4.2, 5.8] },
  fen: { keep: 0.3, spacing: 3.4, pathGap: 2, south: 4, kinds: [['birch', 50], ['oak', 30], ['pine', 20]], h: [4.2, 5.6] },
  ruins: { keep: 0.3, spacing: 3.4, pathGap: 2, south: 3, kinds: [['oak', 40], ['autumn', 35], ['birch', 25]], h: [4, 5.4] },
  ledge: { keep: 0.18, spacing: 3.6, pathGap: 2, south: 3, kinds: [['birch', 50], ['autumn', 50]], h: [3.8, 4.8] },
  mireRoad: { keep: 0.2, spacing: 3.6, pathGap: 2, south: 3, kinds: [['birch', 60], ['oak', 40]], h: [4, 5.2] },
  mire: { keep: 0.34, spacing: 3.2, pathGap: 2, south: 3, kinds: [['birch', 45], ['oak', 30], ['pine', 25]], h: [4, 5.8] },
  islet: { keep: 0.2, spacing: 3.4, pathGap: 1, south: 2, kinds: [['birch', 100]], h: [4, 4.8] },
  quarry: { keep: 0.12, spacing: 4.5, pathGap: 2, south: 4, kinds: [['pine', 60], ['birch', 40]], h: [3.8, 5] },
  terrace: { keep: 0.16, spacing: 4.2, pathGap: 2, south: 4, kinds: [['pine', 65], ['birch', 25], ['autumn', 10]], h: [4, 5.4] },
};
const ROCK_RULES = { quarry: 0.3, terrace: 0.28, ruins: 0.2, ledge: 0.15, mire: 0.05, mireRoad: 0.06, glade: 0.03, meadow: 0.02, camp: 0.015, cross: 0.05, heath: 0.08, fen: 0.04 };

/**
 * No scatter where enemies start (they would stand in trunks), nor in a boar's straight runs (the
 * four axis lanes of rule 7, 9.5 u long), nor on the terrace strip under the caldera's south cliff.
 */
function scatterAvoid(x, z, rr = 0) {
  // the terrace strip under the caldera's south cliff stays open (a rock there sealed a nook)
  if (z < 27.5 + rr && x > 29 - rr && x < 67 + rr) return true;
  for (const o of P.objects) {
    if (o.type !== 'enemy') continue;
    if (Math.hypot(x - o.x, z - o.z) < o.radius + 1.2 + rr) return true;
    if (o.kind === 'boar') {
      const dx = Math.abs(x - o.x); const dz = Math.abs(z - o.z);
      if ((dz < rr + 1.1 && dx < 9.5 + rr) || (dx < rr + 1.1 && dz < 9.5 + rr)) return true;
    }
  }
  return false;
}

/**
 * Nor a scattered tree in the keep's back yard (from the ruins' rampart to the keep, as wide as the
 * keep and the 2.5 u every house keeps from trees): its crown would stand between the lip road and
 * the camera, as the keep's roof did (rule 13).
 */
function treeAvoid(x, z) {
  if (Math.abs(x - KEEP.x) < 2.6 + 2.5 && z > NORTH_WALL.j + 1 && z < KEEP.z) return true;
  return scatterAvoid(x, z);
}

// =============================================================================================
// 2e. Regions (small places first — first match wins)
// =============================================================================================

function regions() {
  const R = (id, name, sub, minX, maxX, minZ, maxZ, { minY = null, banner = '' } = {}) => add('region', { id, minX, maxX, minZ, maxZ, name, sub, minY, banner });
  R('region_caldera', 'The Caldera', 'Cinderwatch Pass', 30, 66, 4, 27);
  R('region_camp', 'Waystone Camp', 'Cinderwatch Pass', 26, 70, 98.6, 120, { banner: 'Straw dummies and a warm fire · Safe' });
  R('region_crossroads', 'The Crossroads', 'Cinderwatch Pass', 36, 60, 70.5, 82);
  R('region_ridge', 'Cinder Ridge', 'Cinderwatch Pass', 40, 54, 44, 72);
  R('region_glade', 'Mossy Glade', 'Cinderwatch Pass', 3, 93, 81.5, 105, { banner: 'Slimes and goblins · Lv 2' });
  R('region_ruins', 'Bramble Ruins', 'Cinderwatch Pass', 3, 42, 44, 81.5, { banner: 'Goblins, archers and a shaman · Lv 7–8' });
  R('region_mire', 'Hollow Mire', 'Cinderwatch Pass', 54, 93, 44, 81.5, { banner: 'Bats, slimes and a shaman · Lv 6–7' });
  R('region_quarry', 'Cinder Quarry', 'Cinderwatch Pass', 3, 93, 23, 44, { banner: 'Ironhide boars and archers · Lv 8' });
  R('region_pass', 'Cinderwatch Pass', 'Where the Old Fires Wake', 0, W, 0, D);
}

// =============================================================================================
// 3. Environment
// =============================================================================================

/** @returns {LevelEnvironment} */
function environment() {
  return {
    timeOfDay: 16.8,
    // a 20-minute run would otherwise reach night after ~5.5 minutes (T still cycles the hour)
    clock: false,
    weather: 'clear',
    border: 'forest',
    outerScenery: true,
    godRays: true,
    dust: true,
    music: true,
    camera: { distance: 28, pitch: 34 },
    highGround: { minY: 3.4, pitch: 38 },
    title: { title: 'CINDERWATCH PASS', subtitle: 'Where the Old Fires Wake', prompt: 'Press any key', credit: 'A Luminati 2.5D action demo · three.js' },
    // the title drifts over the Hollow Mire: the falls from the quarry lip, the ponds, boardwalks and reeds
    titleCamera: { x: 78, z: 52, y: 1, driftX: 4, driftZ: 2, distance: 34 },
    fogScale: 0.7,
    // open meadow past the south edge: the camera looks north from beyond it at the spawn
    scenery: { southGap: 8 },
    // pines on the heights north of the ruins / mire line, broadleaf woods south of it
    forest: {
      areas: [
        { minX: -60, maxX: 200, minZ: -60, maxZ: 44, kinds: { pine: 6, birch: 2, oak: 1, autumn: 1 } },
        { minX: -60, maxX: 48, minZ: 44, maxZ: 200, kinds: { oak: 4, autumn: 3, birch: 2, pine: 1 } },
        { minX: 48, maxX: 200, minZ: 44, maxZ: 200, kinds: { birch: 4, oak: 3, pine: 2, autumn: 1 } },
      ],
    },
    godRayAreas: [
      { minX: 10, maxX: 86, minZ: 82, maxZ: 98, y: 1, count: 4, seed: 7 },
      { minX: 36, maxX: 61, minZ: 8, maxZ: 23, y: 4, count: 4, seed: 13 },
    ],
    foliage: {
      seed: 2031,
      flowerAreas: [
        { minX: 30, maxX: 67, minZ: 99, maxZ: 117, palette: [1, 2, 0, 1, 3] },
        { minX: 8, maxX: 90, minZ: 95, maxZ: 99, palette: [0, 1, 2, 3, 1] },
        { minX: 8, maxX: 21, minZ: 80, maxZ: 93, palette: [2, 3, 2, 1] },
        { minX: 46, maxX: 65, minZ: 80, maxZ: 93, palette: [0, 1, 2, 0, 3] },
        { minX: 76, maxX: 90, minZ: 80, maxZ: 93, palette: [3, 2, 1, 3] },
      ],
      shrubAreas: [
        { minX: 4, maxX: 42, minZ: 44, maxZ: 72, chance: 0.14 },
        { minX: 54, maxX: 60, minZ: 44, maxZ: 72, chance: 0.1 },
        { minX: 84, maxX: 92, minZ: 44, maxZ: 72, chance: 0.14 },
        { minX: 60, maxX: 92, minZ: 66, maxZ: 72, chance: 0.12 },
      ],
    },
  };
}

// =============================================================================================
// 4. Validation — COMBAT.md §15.5 (all 18 rules), rule 19 (zone separation) and Starfall's prop rules
// =============================================================================================

const LEGEND = defaultLegend();
LEGEND.e = { top: 'riverbed', side: 'cliff', water: true, walkable: false, flow: [0.45, 0] };
LEGEND.q = { top: 'stone_tiles', side: 'stone_wall', walkable: false };
LEGEND.r = { top: 'moss_stone', side: 'crag', walkable: false };
const FALL_DIR = CARDINAL;
const waterSurface = (i, j, waterLevel = 0.4) => { const h = L(i, j) * 0.5; return waterLevel > h + 0.02 ? waterLevel : h + 0.35; };
const regionRect = (level, id) => level.objects.find((o) => o.id === id);
const DEG = Math.PI / 180;
/** The camera pitch where a figure stands (highGround above y 3.4 → 38°, else 34°). */
const pitchAt = (y) => (y > 3.4 ? 38 : 34);
const YAWS = [-60, 0, 60];

/** Start spots of an enemy group as the game places them (ground: standable; fliers: or water). */
function spotsOf(o, walk) {
  const flier = ENEMY_INFO[o.kind]?.flier;
  const ok = flier
    ? (x, z) => { const t = LEGEND[T(Math.floor(x), Math.floor(z))]; return !!t && !t.void && (t.water || t.walkable !== false); }
    : (x, z) => walk.standable(x, z, true) === walk.standable(x, z, true);
  return enemyStartPoints(o, ok);
}

function validate(level, occl) {
  const report = { errors: [], warnings: [], info: [], rules: {} };
  const err = (rule, m) => { report.errors.push(`[${rule}] ${m}`); report.rules[rule] = (report.rules[rule] ?? 0) + 1; };
  const info = (m) => report.info.push(m);
  const objects = level.objects;
  const byId = new Map(objects.map((o) => [o.id, o]));
  const enemies = objects.filter((o) => o.type === 'enemy');
  const hostile = enemies.filter((o) => !ENEMY_INFO[o.kind].passive && !ENEMY_INFO[o.kind].boss);
  const waystones = objects.filter((o) => o.type === 'waystone');
  const npcs = objects.filter((o) => o.type === 'npc');

  // ---- rule 1: normalise / validate / round trip (checked by the caller) ----
  // ---- rule 2: walk BFS; no unreachable walkable pocket ----
  const walk = createWalkModel(g, P, level);
  if (walk.spawnNode < 0) err(2, 'the spawn is not standable');
  info(`walk BFS: ${walk.reached} of ${walk.standableCount} standable quarter-unit nodes reachable from the spawn (${(100 * walk.reached / walk.standableCount).toFixed(1)} %)`);
  // the projectile height model of §7.6 (rules 5, 8 and 19): ground (walk surfaces, else the tile level)
  const heightAt = (x, z) => { const h = walk.surfaceAt(x, z); return h === h ? h : (L(Math.floor(x), Math.floor(z)) ?? 0) * 0.5; };
  const losClear = (ax, az, bx, bz) => {
    const ya = heightAt(ax, az) + 0.9; const yb = heightAt(bx, bz) + 0.9;
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(d / 0.25));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const x = ax + (bx - ax) * t; const z = az + (bz - az) * t; const y = ya + (yb - ya) * t;
      const i = Math.floor(x); const j = Math.floor(z);
      // the terrain's height (blocked tiles count with their level), walk surfaces (decks)
      const top = Math.max((L(i, j) ?? 0) * 0.5 + (STAIRS.has(T(i, j)) ? 0.5 : 0), heightAt(x, z));
      if (top > y - 0.1) return false;
      for (const c of P.shapesNear(x, z)) if (c.owner.type !== 'npc' && c.owner.type !== 'enemy' && hitShape(c, x, z)) return false;
    }
    return true;
  };
  const pockets = walk.pockets(16); // (1 u²: a nook sealed by a scattered rock counts too)
  report.pockets = pockets;
  for (const p of pockets) err(2, `an unreachable walkable pocket of ${p.nodes / 16} u² at (${p.x}, ${p.z}) (x ${p.box[0]}–${p.box[1]}, z ${p.box[2]}–${p.box[3]})`);

  // ---- rule 3: routes ----
  const wsCross = byId.get('waystone_crossroads');
  const wsQuarry = byId.get('waystone_quarry');
  const rMire = regionRect(level, 'region_mire');
  const rRuins = regionRect(level, 'region_ruins');
  const inR = (r) => (x, z) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ;
  /** @type {[name: string, from: XZ, to: XZ, forbid: ((x: number, z: number) => boolean)|null][]} */
  const routes = [
    ['the spawn → waystone_crossroads', [level.spawn.x, level.spawn.z], [wsCross.x, wsCross.z + 1.2], null],
    ['waystone_crossroads → waystone_quarry via the Ruins (Mire forbidden)', [wsCross.x, wsCross.z + 1.2], [wsQuarry.x, wsQuarry.z + 1.2], inR(rMire)],
    ['waystone_crossroads → waystone_quarry via the Mire (Ruins forbidden)', [wsCross.x, wsCross.z + 1.2], [wsQuarry.x, wsQuarry.z + 1.2], inR(rRuins)],
    ['waystone_quarry → the arena centre through the gate', [wsQuarry.x, wsQuarry.z + 1.2], [(ARENA.minX + ARENA.maxX) / 2, (ARENA.minZ + ARENA.maxZ) / 2], null],
  ];
  for (const [name, [ax, az], [bx, bz], forbid] of routes) {
    const straight = Math.hypot(bx - ax, bz - az);
    const len = walk.walkLength(ax, az, bx, bz, forbid);
    const limit = straight * 1.5 + 3;
    if (!(len <= limit)) err(3, `route "${name}" is a long detour: ${len === Infinity ? 'no walk' : `${len.toFixed(1)} u`} for ${straight.toFixed(1)} u as the crow flies (limit ${limit.toFixed(1)})`);
    else info(`route ${name}: ${len.toFixed(1)} u (${straight.toFixed(1)} straight, limit ${limit.toFixed(1)})`);
  }

  // ---- rule 4: start spots ----
  const spots = new Map();
  for (const o of enemies) {
    const pts = spotsOf(o, walk);
    spots.set(o, pts);
    const flier = ENEMY_INFO[o.kind].flier;
    // the spots must not depend on how strict the game's walkability test is: the scatter with a
    // plain tile test must give the same spots
    const loose = enemyStartPoints(o, flier ? (x, z) => { const t = LEGEND[T(Math.floor(x), Math.floor(z))]; return !!t && !t.void && (t.water || t.walkable !== false); } : (x, z) => { const t = LEGEND[T(Math.floor(x), Math.floor(z))]; return !!t && !t.void && !t.water && t.walkable !== false; });
    if (JSON.stringify(loose) !== JSON.stringify(pts)) err(4, `${o.id}: its start spots differ between a tile test and the standable test (a spot on a prop's collider or a step edge)`);
    for (const [x, z] of pts) {
      if (flier) {
        const t = LEGEND[T(Math.floor(x), Math.floor(z))];
        if (!inMap(Math.floor(x), Math.floor(z)) || !t || t.void || (!t.water && t.walkable === false)) err(4, `${o.id}: a flier spot (${x.toFixed(1)}, ${z.toFixed(1)}) is not over ground or water`);
        else if (!walk.reachNear(x, z, 8)) err(4, `${o.id}: the flier spot (${x.toFixed(1)}, ${z.toFixed(1)}) is more than 8 u from reachable ground`);
      } else {
        const h = walk.standable(x, z, true);
        if (h !== h) err(4, `${o.id}: the spot (${x.toFixed(1)}, ${z.toFixed(1)}) is not standable`);
        else if (!walk.reachNear(x, z, 0.4, h, 0.3)) err(4, `${o.id}: the spot (${x.toFixed(1)}, ${z.toFixed(1)}) is not reachable`);
      }
    }
  }

  // ---- rule 5: homes away from the spawn, waystones and NPCs ----
  for (const o of hostile) {
    const ds = Math.hypot(o.x - level.spawn.x, o.z - level.spawn.z);
    if (ds < 20) err(5, `${o.id} is ${ds.toFixed(1)} u from the spawn (≥ 20)`);
    for (const w of waystones) { const d = Math.hypot(o.x - w.x, o.z - w.z); if (d < 12) err(5, `${o.id} is ${d.toFixed(1)} u from ${w.id} (≥ 12)`); }
    for (const n of npcs) { const d = Math.hypot(o.x - n.x, o.z - n.z); if (d < 12) err(5, `${o.id} is ${d.toFixed(1)} u from NPC ${n.id} (≥ 12)`); }
  }
  // the golem's home counts too (it is not near anyone by design)
  for (const o of enemies.filter((e) => ENEMY_INFO[e.kind].boss)) {
    for (const w of waystones) { const d = Math.hypot(o.x - w.x, o.z - w.z); if (d < 12) err(5, `${o.id} is ${d.toFixed(1)} u from ${w.id} (≥ 12)`); }
  }
  // …and a player resting at a waystone (standing within 2.5 u of it) is out of every pack's sight
  // while its members roam their whole home radius (resting refuses while foes are near)
  for (const w of waystones) {
    const ring = fightPoints([[w.x, w.z]], 2.5);
    for (const o of hostile) {
      const hit = wakes(ring, roamPoints(o, spots.get(o), 1), o);
      if (hit) err(5, `${o.id} sees a player resting at ${w.id}: a member roaming at (${hit.q[0].toFixed(1)}, ${hit.q[1].toFixed(1)}) is ${hit.d.toFixed(1)} u from (${hit.p[0].toFixed(1)}, ${hit.p[1].toFixed(1)})${hit.los ? ' in line of sight' : ''} (aggro ${ENEMY_DEFS[o.kind].aggro})`);
    }
  }

  // ---- rule 6: home discs mostly walkable (ground kinds) ----
  const discSamples = (o, r) => {
    const out = [];
    for (let dz = -Math.floor(r); dz <= Math.floor(r); dz++) for (let dx = -Math.floor(r); dx <= Math.floor(r); dx++) if (dx * dx + dz * dz <= r * r) out.push([o.x + dx, o.z + dz]);
    return out;
  };
  for (const o of enemies) {
    if (ENEMY_INFO[o.kind].flier || ENEMY_INFO[o.kind].boss) continue;
    const r = o.radius + 2;
    let n = 0; let ok = 0;
    for (let z = o.z - r + 0.25; z < o.z + r; z += 0.5) for (let x = o.x - r + 0.25; x < o.x + r; x += 0.5) {
      if ((x - o.x) ** 2 + (z - o.z) ** 2 > r * r) continue;
      n++;
      const h = walk.standable(x, z, true);
      if (h === h && walk.reachableAt(x, z)) ok++;
    }
    const share = ok / Math.max(1, n);
    if (share < 0.7) err(6, `${o.id}: only ${Math.round(share * 100)} % of its home disc (r ${r}) is walkable (≥ 70 %)`);
    else info(`home ${o.id}: ${Math.round(share * 100)} % walkable`);
  }

  // ---- rule 7: boar runs ----
  const lane = (x, z, dx, dz, len, r, y0) => {
    for (let s = 0; s <= len + 1e-6; s += 0.25) {
      const h = walk.standable(x + dx * s, z + dz * s, true, r);
      if (h !== h || Math.abs(h - y0) > 0.01) return s;
    }
    return len;
  };
  for (const o of enemies.filter((e) => e.kind === 'boar')) {
    const y0 = walk.standable(o.x, o.z, true);
    const good = [];
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const run = lane(o.x, o.z, Math.cos(a), Math.sin(a), 8, 0.45, y0);
      if (run >= 8) good.push(['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][k]);
    }
    if (good.length < 2) err(7, `boar ${o.id}: ${good.length} straight 8 u runs (≥ 2 of 8 directions)`);
    else info(`boar ${o.id}: runs ${good.join(' ')}`);
  }

  // ---- rule 8: archer lines of sight (the projectile height model of §7.6) ----
  for (const o of enemies.filter((e) => e.kind === 'archer')) {
    const pts = spots.get(o);
    const homes = [[o.x, o.z], ...pts];
    const y0 = heightAt(o.x, o.z);
    let dirs = 0; let below = false;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      let hit = false;
      for (let d = 5; d <= 9 && !hit; d += 0.5) {
        const tx = o.x + Math.cos(a) * d; const tz = o.z + Math.sin(a) * d;
        const th = walk.standable(tx, tz, true);
        if (th !== th || !walk.reachableAt(tx, tz)) continue;
        if (!homes.some(([hx, hz]) => losClear(hx, hz, tx, tz))) continue;
        hit = true;
        if (th < y0 - 0.74) below = true;
      }
      if (hit) dirs++;
    }
    if (dirs < 3) err(8, `archer ${o.id}: line of sight to reachable ground 5–9 u away in ${dirs} of 8 directions (≥ 3)`);
    else info(`archer ${o.id}: sees ${dirs} of 8 directions${below ? ', incl. the floor below' : ''}`);
    if (LEDGE_ARCHERS.has(o.id) && !below) err(8, `ledge archer ${o.id} sees no target on the floor below its ledge`);
  }

  // ---- rule 9: the arena ----
  const golems = enemies.filter((e) => e.kind === 'golem');
  for (const b of golems) {
    const A = { minX: b.x + b.arena.minX, maxX: b.x + b.arena.maxX, minZ: b.z + b.arena.minZ, maxZ: b.z + b.arena.maxZ };
    const gate = [b.x + b.gate[0], b.z + b.gate[1], b.x + b.gate[2], b.z + b.gate[3]];
    const lv = new Set(); let tiles = 0; let walkable = 0;
    for (let j = Math.floor(A.minZ); j < Math.ceil(A.maxZ); j++) for (let i = Math.floor(A.minX); i < Math.ceil(A.maxX); i++) {
      // tiles whose area overlaps the rect
      tiles++;
      lv.add(L(i, j));
      const d = LEGEND[T(i, j)];
      if (d && !d.water && d.walkable !== false) walkable++;
    }
    if (lv.size !== 1) err(9, `${b.id}: the arena rect spans ${lv.size} height levels (${[...lv].join(', ')})`);
    if (walkable / tiles < 0.95) err(9, `${b.id}: the arena is only ${Math.round((100 * walkable) / tiles)} % walkable (≥ 95 %)`);
    // boundary: tiles along the rect's edges vs their outside neighbours
    const boundary = [];
    const i0 = Math.floor(A.minX); const i1 = Math.ceil(A.maxX) - 1; const j0 = Math.floor(A.minZ); const j1 = Math.ceil(A.maxZ) - 1;
    for (let i = i0; i <= i1; i++) { boundary.push([i, j0, 0, -1]); boundary.push([i, j1, 0, 1]); }
    for (let j = j0; j <= j1; j++) { boundary.push([i0, j, -1, 0]); boundary.push([i1, j, 1, 0]); }
    for (const [i, j, di, dj] of boundary) {
      const d = LEGEND[T(i, j)];
      if (!d || d.water || d.walkable === false) continue;
      if (segDistTile(i + 0.5, j + 0.5, gate) <= 1) continue;
      const oi = i + di; const oj = j + dj;
      const od = LEGEND[T(oi, oj)];
      const blocked = !od || od.void || od.walkable === false || od.water;
      if (!blocked && Math.abs(L(oi, oj) - L(i, j)) < 2) err(9, `${b.id}: the arena's boundary tile (${i}, ${j}) can be walked out of into (${oi}, ${oj})`);
    }
    for (const o of enemies) if (o !== b && inRect(o.x, o.z, A)) err(9, `${o.id} stands inside the arena of ${b.id}`);
    if (!inRect(b.x, b.z, A)) err(9, `${b.id}'s home lies outside its arena`);
    // visibility at three yaws: every point of the rect inset 1 u (1 u grid) ≤ 25 % covered
    let worst = 0; let n = 0; let bad = 0;
    for (let z = A.minZ + 1; z <= A.maxZ - 1 + 1e-6; z += 1) for (let x = A.minX + 1; x <= A.maxX - 1 + 1e-6; x += 1) {
      for (const yaw of YAWS) {
        n++;
        const y0 = heightAt(x, z);
        const c = occl.cover(x, z, { yaw, pitch: pitchAt(y0), h0: 0.1, h1: 2.0, y0 });
        worst = Math.max(worst, c.share);
        if (c.share > 0.25) { bad++; if (bad <= 6) err(9, `arena point (${x}, ${z}) is ${Math.round(c.share * 100)} % covered at yaw ${yaw} by ${[...c.by.keys()].map((k) => (typeof k === 'string' ? k : k.id)).join(', ')}`); }
      }
    }
    if (bad > 6) err(9, `…and ${bad - 6} more covered arena points`);
    info(`arena ${b.id}: ${n} views checked, worst cover ${Math.round(worst * 100)} %`);
    // braziers ≥ 2 u inside the arena edges
    const braziers = objects.filter((o) => o.type === 'campfire' && inRect(o.x, o.z, A));
    if (braziers.length !== 4) err(9, `${b.id}: ${braziers.length} braziers in the arena (4)`);
    for (const f of braziers) {
      const inset = Math.min(f.x - A.minX, A.maxX - f.x, f.z - A.minZ, A.maxZ - f.z);
      if (inset < 2 - 1e-9) err(9, `brazier ${f.id} is ${inset.toFixed(2)} u inside the arena edge (≥ 2)`);
    }
  }

  // ---- rule 10: chests ----
  for (const o of objects.filter((c) => c.type === 'chest' || c.type === 'waystone')) {
    const i = Math.floor(o.x); const j = Math.floor(o.z);
    const d = LEGEND[T(i, j)];
    if (!d || d.water || d.walkable === false || d.stairs) err(10, `${o.id} stands on ${JSON.stringify(T(i, j))}`);
    // flat and dry under the footprint
    for (const [di, dj] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = o.x + di * 0.45; const z = o.z + dj * 0.45;
      const ii = Math.floor(x); const jj = Math.floor(z);
      const dd = LEGEND[T(ii, jj)];
      if (!dd || dd.water || dd.stairs || dd.walkable === false || L(ii, jj) !== L(i, j)) { err(10, `${o.id}: its footprint is uneven or wet at tile (${ii}, ${jj})`); break; }
    }
    if (o.type === 'chest') {
      const f = P.chestFront(o);
      const h = walk.standable(f.x, f.z, true);
      if (h !== h || !walk.reachNear(f.x, f.z, 0.3, h, 0.3)) err(10, `chest ${o.id}: the spot in front (${f.x.toFixed(2)}, ${f.z.toFixed(2)}) is not standable and reachable`);
    }
  }

  // ---- rule 11: waystones ----
  if (waystones.length < 3) err(11, `${waystones.length} waystones (≥ 3)`);
  for (const w of waystones) if (!walk.reachNear(w.x, w.z, 1.6, P.groundY(w.x, w.z))) err(11, `${w.id} is not reachable`);
  const wc = byId.get('waystone_camp');
  if (!wc || Math.hypot(wc.x - level.spawn.x, wc.z - level.spawn.z) > 10) err(11, 'waystone_camp is not within 10 u of the spawn');

  // ---- rule 12: light descriptors (the Inspector's countLights rule) ----
  const LIGHT_TYPES = new Set(['lamppost', 'wallTorch', 'campfire', 'light']);
  const lights = objects.filter((o) => LIGHT_TYPES.has(o.type) || (o.type === 'house' && o.light));
  if (lights.length > 12) err(12, `${lights.length} light descriptors (≤ 12)`);
  info(`light descriptors: ${lights.length} (${lights.map((o) => o.id).join(', ')})`);

  // ---- rule 13: Starfall's prop rules ----
  propRules(level, walk, err, info);

  // ---- rule 14: occlusion of the enemy homes at three yaws ----
  for (const o of enemies) {
    if (ENEMY_INFO[o.kind].passive || ENEMY_INFO[o.kind].boss) continue;
    const r = o.radius + 3;
    const flier = ENEMY_INFO[o.kind].flier;
    let n = 0; let covered = 0; let worstYaw = 0;
    const byYaw = {};
    for (const [x, z] of discSamples(o, r)) {
      const h = heightAt(x, z);
      for (const yaw of YAWS) {
        n++;
        const c = occl.cover(x, z, { yaw, pitch: pitchAt(h), h0: flier ? 0.4 : 0.1, h1: flier ? 2.4 : 2.0, y0: h });
        if (c.share > 0.25) { covered++; byYaw[yaw] = (byYaw[yaw] ?? 0) + 1; }
      }
    }
    worstYaw = Math.max(0, ...Object.values(byYaw));
    const share = covered / Math.max(1, n);
    if (share > 0.15) err(14, `${o.id}: ${Math.round(share * 100)} % of its home-disc views are covered > 25 % (≤ 15 %; by yaw ${JSON.stringify(byYaw)})`);
    else info(`occlusion ${o.id}: ${(share * 100).toFixed(1)} % of ${n} views covered${worstYaw ? ` (${JSON.stringify(byYaw)})` : ''}`);
  }

  // ---- rule 15: density ----
  const hostilePts = hostile.flatMap((o) => spots.get(o));
  let dens = 0; let densAt = null;
  for (let z = 0; z <= D; z += 2) for (let x = 0; x <= W; x += 2) {
    let c = 0;
    for (const [px, pz] of hostilePts) if ((px - x) ** 2 + (pz - z) ** 2 <= 28 * 28) c++;
    if (c > dens) { dens = c; densAt = [x, z]; }
  }
  if (dens > 30) err(15, `${dens} hostile start spots within 28 u of (${densAt}) (≤ 30)`);
  info(`density: at most ${dens} hostile start spots within 28 u (at ${densAt})`);

  // ---- rule 16: regions ----
  const REGIONS = ['region_caldera', 'region_camp', 'region_crossroads', 'region_ridge', 'region_glade', 'region_ruins', 'region_mire', 'region_quarry', 'region_pass'];
  const BANNERS = new Set(['region_camp', 'region_glade', 'region_ruins', 'region_mire', 'region_quarry']);
  const regs = objects.filter((o) => o.type === 'region');
  if (regs.map((r) => r.id).join() !== REGIONS.join()) err(16, `regions ${regs.map((r) => r.id).join(', ')} (expected ${REGIONS.join(', ')}, in that order)`);
  for (const r of regs) {
    if (BANNERS.has(r.id) !== !!r.banner) err(16, `region ${r.id}: ${r.banner ? 'has a banner it should not' : 'has no banner'}`);
    // a banner's "Lv a–b" is the level range of the packs at home in its zone (the first region
    // holding a home is its zone, as in the game)
    const lv = /· Lv (\d+)(?:–(\d+))?$/.exec(r.banner ?? '');
    if (lv) {
      const zoneOf = (o) => regs.find((q) => o.x >= q.minX && o.x <= q.maxX && o.z >= q.minZ && o.z <= q.maxZ);
      const lvs = hostile.filter((o) => zoneOf(o) === r).map((o) => o.level);
      const want = lvs.length ? (Math.min(...lvs) === Math.max(...lvs) ? `${Math.min(...lvs)}` : `${Math.min(...lvs)}–${Math.max(...lvs)}`) : '?';
      const got = lv[2] ? `${lv[1]}–${lv[2]}` : lv[1];
      if (got !== want) err(16, `region ${r.id}: the banner says Lv ${got}, its packs are Lv ${want}`);
    }
    let ok = false;
    for (let z = Math.ceil(r.minZ * 4); z < r.maxZ * 4 && !ok; z++) for (let x = Math.ceil(r.minX * 4); x < r.maxX * 4; x++) if (walk.reachableAt(x / 4, z / 4)) { ok = true; break; }
    if (!ok) err(16, `region "${r.name}" has no reachable ground`);
  }

  // ---- rule 17: the arena buffer ----
  for (const b of golems) {
    const A = { minX: b.x + b.arena.minX, maxX: b.x + b.arena.maxX, minZ: b.z + b.arena.minZ, maxZ: b.z + b.arena.maxZ };
    for (const o of enemies) {
      if (o === b || ENEMY_INFO[o.kind].boss) continue;
      const d = rectDist(o.x, o.z, A) - (o.radius + 2);
      if (d < 6 - 1e-9) err(17, `${o.id}: its home disc is ${d.toFixed(2)} u from the arena of ${b.id} (≥ 6)`);
      if (ENEMY_INFO[o.kind].flier) {
        const e = o.radius + 8;
        if (o.x - e < A.maxX && o.x + e > A.minX && o.z - e < A.maxZ && o.z + e > A.minZ) err(17, `${o.id}: its flight clamp rect reaches into the arena of ${b.id}`);
      }
    }
  }

  // ---- rule 18: no flower area over a slime home ----
  for (const s of enemies.filter((e) => e.kind === 'slime')) {
    const r = s.radius + 1;
    for (const a of level.environment.foliage?.flowerAreas ?? []) {
      if (rectDist(s.x, s.z, a) < r) err(18, `flower area ${a.minX}–${a.maxX} × ${a.minZ}–${a.maxZ} overlaps the home of ${s.id}`);
    }
  }

  // ---- rule 19: zone separation — a fight in one region never wakes a pack of another ----
  const regionList = objects.filter((o) => o.type === 'region' && o.id !== 'region_pass');
  const regionOf = (x, z) => regionList.find((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ)?.id ?? 'region_pass';
  let pairs19 = 0;
  for (const a of hostile) {
    for (const b of hostile) {
      if (a === b || regionOf(a.x, a.z) === regionOf(b.x, b.z)) continue;
      // (quick reject: farther apart than any spot spread + roam + aggro)
      if (Math.hypot(a.x - b.x, a.z - b.z) > ENEMY_DEFS[b.kind].aggro + (a.radius + b.radius) * 2.5 + 4) continue;
      pairs19++;
      const hit = wakes(fightPoints(spots.get(a), ENEMY_INFO[a.kind].flier ? 3 : 1.5), roamPoints(b, spots.get(b), 0.7), b);
      if (hit) err(19, `fighting ${a.id} (${regionOf(a.x, a.z)}) at (${hit.p[0].toFixed(1)}, ${hit.p[1].toFixed(1)}) wakes ${b.id} (${regionOf(b.x, b.z)}): a member at (${hit.q[0].toFixed(1)}, ${hit.q[1].toFixed(1)}) is ${hit.d.toFixed(1)} u away${hit.los ? ' in line of sight' : ''} (aggro ${ENEMY_DEFS[b.kind].aggro})`);
    }
  }
  info(`zone separation: ${pairs19} cross-region pack pairs near each other checked`);

  // ---- rule 20: chase and group-wake margins — rule 19 with the ways a fight spreads besides sight ----
  // (a) group wake: a member that notices the player wakes every calm enemy within WAKE_R u in line
  //     of sight (CombatSystem._wakeGroup, no height test): no member of another region's pack roams
  //     within WAKE_R u (in line of sight) of one of this pack's roaming members;
  // (b) chase: a fight drifts CHASE_MARGIN u past rule 19's ring round the start spots (the player
  //     backs off, rolls — ROLL.dist 3.2 u —, the pack follows): no pack of another region sees it.
  // Known conflicts too big to move a group for (> 3 u) are listed in RULE20_ACCEPTED (printed, not errors).
  let pairs20 = 0;
  const accepted20 = new Set();
  for (const a of hostile) {
    for (const b of hostile) {
      if (a === b || regionOf(a.x, a.z) === regionOf(b.x, b.z)) continue;
      if (Math.hypot(a.x - b.x, a.z - b.z) > ENEMY_DEFS[b.kind].aggro + (a.radius + b.radius) * 2.5 + CHASE_MARGIN + WAKE_R + 4) continue;
      pairs20++;
      const acc = RULE20_ACCEPTED.find((r) => r.a === a.id && r.b === b.id);
      const report20 = (m) => { if (acc) { accepted20.add(`${a.id} → ${b.id}: ${m} — accepted: ${acc.why}`); } else err(20, m); };
      const g = groupWakes(roamPoints(a, spots.get(a), 1), roamPoints(b, spots.get(b), 1));
      if (g) report20(`${a.id} (${regionOf(a.x, a.z)}) noticing at (${g.p[0].toFixed(1)}, ${g.p[1].toFixed(1)}) wakes ${b.id} (${regionOf(b.x, b.z)}) by the group wake: a member at (${g.q[0].toFixed(1)}, ${g.q[1].toFixed(1)}) is ${g.d.toFixed(1)} u away in line of sight (≤ ${WAKE_R})`);
      // (the drift is walked: a wall or a cliff between the fight and the next pack stops it)
      const drift = walk.walkBall(fightPoints(spots.get(a), ENEMY_INFO[a.kind].flier ? 3 : 1.5), CHASE_MARGIN);
      const hit = wakes(drift, roamPoints(b, spots.get(b), 0.7), b);
      if (hit) report20(`a fight with ${a.id} (${regionOf(a.x, a.z)}) drifting to (${hit.p[0].toFixed(1)}, ${hit.p[1].toFixed(1)}) wakes ${b.id} (${regionOf(b.x, b.z)}): a member at (${hit.q[0].toFixed(1)}, ${hit.q[1].toFixed(1)}) is ${hit.d.toFixed(1)} u away${hit.los ? ' in line of sight' : ''} (aggro ${ENEMY_DEFS[b.kind].aggro}, chase margin ${CHASE_MARGIN})`);
    }
  }
  for (const m of accepted20) report.warnings.push(`[20] ${m}`);
  for (const r of RULE20_ACCEPTED) if (![...accepted20].some((m) => m.startsWith(`${r.a} → ${r.b}:`))) err(20, `RULE20_ACCEPTED lists ${r.a} → ${r.b}, which no longer conflicts: remove it`);
  info(`chase / group-wake margins: ${pairs20} cross-region pack pairs checked (chase margin ${CHASE_MARGIN} u, group wake ${WAKE_R} u)`);
  return report;

  /** The group wake (CombatSystem._wakeGroup): the closest pair within WAKE_R u in line of sight, or null. */
  function groupWakes(ps, qs) {
    let best = null;
    for (const q of qs) {
      for (const p of ps) {
        const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (d > WAKE_R || (best && d >= best.d)) continue;
        if (d < 0.3 || losClear(p[0], p[1], q[0], q[1])) best = { p, q, d };
      }
    }
    return best;
  }

  /**
   * Where a player stands while fighting at the given points: reachable standable points of a
   * 0.5 u grid within `r` of any of them.
   */
  function fightPoints(pts, r) {
    const out = [];
    const seenK = new Set();
    for (const [cx, cz] of pts) {
      for (let z = Math.floor((cz - r) * 2) / 2; z <= cz + r; z += 0.5) for (let x = Math.floor((cx - r) * 2) / 2; x <= cx + r; x += 0.5) {
        const k = `${x},${z}`;
        if (seenK.has(k) || (x - cx) ** 2 + (z - cz) ** 2 > r * r) continue;
        seenK.add(k);
        const h = walk.standable(x, z, true);
        if (h === h && walk.reachableAt(x, z)) out.push([x, z]);
      }
    }
    return out;
  }
  /** Where a group's members roam: each start spot and 8 points `k` × radius around it (the wander). */
  function roamPoints(o, pts, k) {
    const flier = ENEMY_INFO[o.kind].flier;
    const out = [];
    for (const [sx, sz] of pts) {
      out.push([sx, sz]);
      for (let n = 0; n < 8; n++) {
        const x = sx + Math.cos((n * Math.PI) / 4) * o.radius * k; const z = sz + Math.sin((n * Math.PI) / 4) * o.radius * k;
        const t = LEGEND[T(Math.floor(x), Math.floor(z))];
        if (flier ? t && !t.void && (t.water || t.walkable !== false) : walk.standable(x, z, true) === walk.standable(x, z, true)) out.push([x, z]);
      }
    }
    return out;
  }
  /**
   * The game's sight aggro (§7.4, E1): a member within 3 u with |dy| < 1.5, or within its aggro
   * range with |dy| < 1.5 and line of sight by the projectile model. The closest waking pair, or null.
   */
  function wakes(ps, qs, o) {
    const aggro = ENEMY_DEFS[o.kind].aggro;
    let best = null;
    for (const q of qs) {
      const hq = heightAt(q[0], q[1]);
      for (const p of ps) {
        const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (d >= aggro || (best && d >= best.d) || Math.abs(heightAt(p[0], p[1]) - hq) >= 1.5) continue;
        if (d < 3) { best = { p, q, d, los: false }; continue; }
        if (losClear(q[0], q[1], p[0], p[1])) best = { p, q, d, los: true };
      }
    }
    return best;
  }
}
/**
 * Distance from a point to a segment.
 * @param {number} x
 * @param {number} z
 * @param {number[]} seg [x0, z0, x1, z1]
 */
const segDistTile = (x, z, [x0, z0, x1, z1]) => {
  const dx = x1 - x0; const dz = z1 - z0; const L2 = dx * dx + dz * dz || 1;
  const t = clamp(((x - x0) * dx + (z - z0) * dz) / L2, 0, 1);
  return Math.hypot(x0 + dx * t - x, z0 + dz * t - z);
};

/** Rule 13 — Starfall's prop rules: flat dry props, no overlaps, doors clear, stairs, falls, bridges, sightlines. */
function propRules(level, walk, err, info) {
  const objects = level.objects;
  const tileDef = walk.tileDef;
  const walkRects = walk.walkRects;
  // interactions: villagers, doors, signs reachable
  for (const o of objects) {
    const y = P.groundY(o.x, o.z);
    if (o.type === 'npc') {
      if (!walk.reachNear(o.x, o.z, 1.45, y)) err(13, `NPC ${o.id} (${o.name}) cannot be reached to talk`);
      if (walk.surfaceAt(o.x, o.z) !== walk.surfaceAt(o.x, o.z)) err(13, `NPC ${o.id} stands on unwalkable ground`);
      const blocker = P.allShapes.find((c) => c.owner !== o && c.owner.type !== 'npc' && hitShape(c, o.x, o.z, 0.3));
      if (blocker) err(13, `NPC ${o.id} stands inside ${blocker.owner.id}`);
    } else if (o.type === 'house') {
      const d = P.doorOf(o);
      if (!walk.reachNear(d.x, d.z, 0.85, y)) err(13, `door of ${o.id} (${o.name}) is not reachable`);
    } else if (o.type === 'signpost') {
      if (!walk.reachNear(o.x, o.z, 1.2, y)) err(13, `signpost ${o.id} is not reachable`);
    }
  }
  // paths not blocked by props
  for (const p of g.PATHS) {
    if (p.width < 1.5) continue;
    for (let k = 0; k < p.points.length - 1; k++) {
      const [ax, az] = p.points[k]; const [bx, bz] = p.points[k + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5));
      for (let s = 0; s <= n; s++) {
        const x = ax + ((bx - ax) * s) / n; const z = az + ((bz - az) * s) / n;
        const i = Math.floor(x); const j = Math.floor(z);
        if (!inMap(i, j)) continue;
        if (WATER.has(T(i, j))) {
          if (walk.standable(x, z, true) !== walk.standable(x, z, true)) { err(13, `path "${p.name}" crosses water without a bridge at (${x.toFixed(1)}, ${z.toFixed(1)})`); s = n; }
          continue;
        }
        if (!g.pathMask[I(i, j)]) continue;
        const b = P.blockedAt(x, z, 0.29, (ow) => ow.type === 'npc');
        if (b) { err(13, `path "${p.name}" is blocked at (${x.toFixed(1)}, ${z.toFixed(1)}) by ${b.id}`); s = n; }
      }
    }
  }
  // stairs rise toward their direction, one level per tile
  for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) {
    const ch = T(i, j);
    if (!STAIRS.has(ch)) continue;
    const [fx, fz] = FALL_DIR[STAIR_DIR[ch]];
    const l = L(i, j);
    const ahead = T(i + fx, j + fz); const behind = T(i - fx, j - fz);
    const flat = (c) => c && LEGEND[c]?.walkable !== false && !LEGEND[c]?.water && !STAIRS.has(c);
    const okA = (ahead === ch && L(i + fx, j + fz) === l + 1) || (flat(ahead) && L(i + fx, j + fz) === l + 1);
    const okB = (behind === ch && L(i - fx, j - fz) === l - 1) || (flat(behind) && L(i - fx, j - fz) === l);
    if (!okA || !okB) err(13, `stairs ${ch} at (${i}, ${j}) level ${l}: ${okA ? '' : `the high side (${ahead}${L(i + fx, j + fz)}) is not level ${l + 1}`} ${okB ? '' : `the low side (${behind}${L(i - fx, j - fz)}) is not level ${l}`}`);
  }
  // waterfalls: on a tile edge between a higher and a lower water tile, a real drop
  for (const f of P.FALLS) {
    const [fx, fz] = FALL_DIR[f.facing];
    const onEdge = fz ? Number.isInteger(f.z) : Number.isInteger(f.x);
    const ti = Math.floor(f.x - fx * 0.5 + 0.01); const tj = Math.floor(f.z - fz * 0.5 + 0.01);
    const bi = Math.floor(f.x + fx * 0.5 + 0.01); const bj = Math.floor(f.z + fz * 0.5 + 0.01);
    if (!onEdge) err(13, `waterfall ${f.id} is not on a tile edge`);
    if (!g.isWater(ti, tj) || !g.isWater(bi, bj)) { err(13, `waterfall ${f.id}: no water above / below`); continue; }
    const drop = waterSurface(ti, tj) - waterSurface(bi, bj);
    if (drop < 0.5) err(13, `waterfall ${f.id}: drop ${drop.toFixed(2)} is too small`);
    for (let k = 0; k < Math.round(f.width); k++) {
      const ci = fz ? Math.floor(f.x - f.width / 2 + k + 0.5) : ti; const cj = fz ? tj : Math.floor(f.z - f.width / 2 + k + 0.5);
      if (!g.isWater(ci, cj)) err(13, `waterfall ${f.id}: the lip is not water across its width`);
    }
    info(`waterfall ${f.id}: drop ${drop.toFixed(2)}`);
  }
  // bridges span water bank to bank, and can be walked end to end
  for (const { o, pier, name } of P.BRIDGES) {
    const dx = o.x1 - o.x0; const dz = o.z1 - o.z0; const len = Math.hypot(dx, dz); const ux = dx / len; const uz = dz / len;
    const bank = (x, z) => { const d = tileDef(Math.floor(x), Math.floor(z)); return d && !d.water && !d.void && d.walkable !== false ? L(Math.floor(x), Math.floor(z)) * 0.5 : null; };
    const a = bank(o.x0 - ux * 0.5, o.z0 - uz * 0.5); const b = bank(o.x1 + ux * 0.5, o.z1 + uz * 0.5);
    let wet = 0;
    for (let t = 0.05; t < 1; t += 0.05) if (g.isWater(Math.floor(o.x0 + dx * t), Math.floor(o.z0 + dz * t))) wet++;
    if (!wet) err(13, `bridge ${o.id} does not cross water`);
    if (a == null || (!pier && b == null)) err(13, `bridge ${o.id}: an end is not on a bank`);
    if (a != null && Math.abs(a - o.deckY) > 0.5) err(13, `bridge ${o.id}: deck ${o.deckY} vs bank ${a}`);
    if (!pier && b != null && Math.abs(b - o.deckY) > 0.5) err(13, `bridge ${o.id}: deck ${o.deckY} vs far bank ${b}`);
    let prev = null; let bad = null;
    for (let t = -0.9; t <= (pier ? len - 0.4 : len + 0.9) + 1e-6; t += 0.2) {
      const x = o.x0 + ux * t; const z = o.z0 + uz * t;
      const h = walk.standable(x, z, true);
      if (h !== h) { bad = `not standable at (${x.toFixed(2)}, ${z.toFixed(2)})`; break; }
      if (prev != null && Math.abs(h - prev) > 0.55) { bad = `a ${Math.abs(h - prev).toFixed(2)} step at (${x.toFixed(2)}, ${z.toFixed(2)})`; break; }
      prev = h;
    }
    if (bad) err(13, `bridge ${o.id} cannot be walked end to end: ${bad}`);
    info(`bridge ${name}: ${len.toFixed(1)} long, deck ${o.deckY}`);
  }
  // props stand on proper ground; buildings / chests / waystones on flat, dry footprints
  const FLAT = new Set(['house', 'marketStall', 'well', 'campfire', 'bench', 'chest', 'waystone']);
  for (const o of objects) {
    const def = OBJECT_TYPES[o.type];
    if (def.kind !== 'prop' || def.placement !== 'point' || o.type === 'wallTorch' || o.type === 'light' || o.type === 'waterfall') continue;
    const i = Math.floor(o.x); const j = Math.floor(o.z);
    const d = tileDef(i, j);
    const onDeck = walkRects.some((r) => o.x >= r.minX && o.x <= r.maxX && o.z >= r.minZ && o.z <= r.maxZ);
    // (trees and boulders may stand on the ridge's blocked rock; everything else on walkable ground)
    const onRock = (T(i, j) === 'x' || T(i, j) === 'r') && (o.type === 'tree' || o.type === 'rock');
    if (!onDeck && !onRock && (!d || d.void || d.walkable === false || (d.water && o.type !== 'rock'))) err(13, `${o.id} stands on ${JSON.stringify(T(i, j))} at (${o.x}, ${o.z})`);
    if (FLAT.has(o.type)) {
      const b = P.collidersOf(o)[0];
      const bb = b ? shapeBounds(b) : { minX: o.x - 0.5, maxX: o.x + 0.5, minZ: o.z - 0.5, maxZ: o.z + 0.5 };
      const l0 = L(i, j);
      for (let jj = Math.floor(bb.minZ + 0.15); jj <= Math.floor(bb.maxZ - 0.15); jj++) for (let ii = Math.floor(bb.minX + 0.15); ii <= Math.floor(bb.maxX - 0.15); ii++) {
        const dd = tileDef(ii, jj);
        if (!dd || dd.water || dd.stairs || dd.walkable === false || L(ii, jj) !== l0) { err(13, `${o.id} footprint is uneven or wet at tile (${ii}, ${jj})`); ii = 1e9; jj = 1e9; }
      }
    }
  }
  // no two props overlap (approximate colliders)
  const pairs = new Set();
  const overlap = (a, b) => {
    if (a.c === 'seg' || b.c === 'seg') {
      const s = a.c === 'seg' ? a : b; const o = s === a ? b : a;
      if (o.c === 'seg') return false;
      const n = Math.max(2, Math.ceil(Math.hypot(s.x1 - s.x0, s.z1 - s.z0) / 0.2));
      for (let k = 0; k <= n; k++) if (hitShape(o, s.x0 + ((s.x1 - s.x0) * k) / n, s.z0 + ((s.z1 - s.z0) * k) / n, s.h - 0.02)) return true;
      return false;
    }
    if (a.c === 'circle' && b.c === 'circle') return (a.x - b.x) ** 2 + (a.z - b.z) ** 2 < (a.r + b.r - 0.02) ** 2;
    if (a.c === 'box' && b.c === 'box') return a.minX < b.maxX - 0.02 && b.minX < a.maxX - 0.02 && a.minZ < b.maxZ - 0.02 && b.minZ < a.maxZ - 0.02;
    const c = a.c === 'circle' ? a : b; const bx = c === a ? b : a;
    return hitShape(bx, c.x, c.z, c.r - 0.02);
  };
  for (const a of P.allShapes) {
    const ab = shapeBounds(a);
    for (const b of P.shapesNear((ab.minX + ab.maxX) / 2, (ab.minZ + ab.maxZ) / 2)) {
      if (a === b || a.owner === b.owner) continue;
      const key = a.owner.id < b.owner.id ? `${a.owner.id}|${b.owner.id}` : `${b.owner.id}|${a.owner.id}`;
      if (pairs.has(key)) continue;
      if (a.owner.type === 'npc' || b.owner.type === 'npc') continue;
      if (overlap(a, b)) { pairs.add(key); err(13, `overlap: ${a.owner.id} × ${b.owner.id}`); }
    }
  }
  for (const o of objects) {
    if (o.type !== 'house') continue;
    const d = P.doorOf(o);
    const b = P.blockedAt(d.x, d.z, 0.35, (ow) => ow === o || ow.type === 'npc');
    if (b) err(13, `door of ${o.id} is blocked by ${b.id}`);
  }
  // the camera (yaw 0) sees every villager, door, sign, campfire, chest and waystone past the roofs
  const { roofAt } = roofsOf(objects, P.groundY);
  const CAMP = (34 * Math.PI) / 180;
  const hiddenBy = (x, z, hh, skip = null) => {
    const y0 = walk.surfaceAt(x, z);
    const y = (y0 === y0 ? y0 : P.groundY(x, z)) + hh;
    for (let t = 0.1; t < 16; t += 0.1) {
      const h = roofAt(x, y + Math.sin(CAMP) * t, z + Math.cos(CAMP) * t, skip);
      if (h) return h;
    }
    return null;
  };
  for (const o of objects) {
    const spots = [];
    if (o.type === 'npc') spots.push([`villager ${o.id}`, o.x, o.z, 1.0]);
    else if (o.type === 'house') { const d = P.doorOf(o); spots.push([`the door of ${o.id}`, d.x, d.z, 1.0]); }
    else if (o.type === 'signpost') spots.push([`signpost ${o.id}`, o.x, o.z, 1.6]);
    else if (o.type === 'campfire' || o.type === 'chest') spots.push([`${o.type} ${o.id}`, o.x, o.z, 0.5]);
    else if (o.type === 'waystone') spots.push([`waystone ${o.id}`, o.x, o.z, 1.6]);
    for (const [what, x, z, hh] of spots) {
      const h = hiddenBy(x, z, hh, o.type === 'house' ? o : null);
      if (h) err(13, `${what} at (${x.toFixed(1)}, ${z.toFixed(1)}) is hidden from the camera behind ${h.id}`);
    }
  }
  // … and past the terrain: a wall or cliff 1 u or more above the walker's feet (a step or a
  // stair's side may hide a boot). None may hide a walker to the waist at a path tile's centre;
  // the report lists where one hides the legs (the rampart's merlons beside the lip road's south
  // half: the x-ray silhouette shows the legs there, as behind any wall)
  const behindTerrain = (x, z, y0, hh) => {
    const p = (pitchAt(y0) * Math.PI) / 180;
    for (let t = 0.1; t < 16; t += 0.1) {
      const i = Math.floor(x); const j = Math.floor(z + Math.cos(p) * t);
      if (!inMap(i, j)) return false;
      const top = L(i, j) * 0.5 + (STAIRS.has(T(i, j)) ? 0.25 : 0);
      if (top >= y0 + 1 && y0 + hh + Math.sin(p) * t < top - 0.02) return true;
    }
    return false;
  };
  let pathTiles = 0; let hiddenTiles = 0; const hiders = {}; const walled = []; const legs = [];
  for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) {
    if (!g.pathMask[I(i, j)] || g.isWater(i, j)) continue;
    pathTiles++;
    // (the walker's knee, 0.25 u up — the waist alone left the legs as a silhouette — where a walker
    // can stand at the tile's centre, its south edge and near its east and west sides)
    let h = null; let leg = false;
    for (const [fx, fz] of [[0.5, 0.5], [0.5, 0.9], [0.2, 0.5], [0.8, 0.5], [0.2, 0.9], [0.8, 0.9]]) {
      const y = walk.standable(i + fx, j + fz, true);
      if (y !== y) continue;
      if (fx === 0.5 && fz === 0.5 && behindTerrain(i + fx, j + fz, y, 0.5)) walled.push(`${i},${j}`);
      leg ||= behindTerrain(i + fx, j + fz, y, 0.25);
      if ((h = hiddenBy(i + fx, j + fz, 0.25))) break;
    }
    if (h) { hiddenTiles++; (hiders[h.id] ??= []).push(`${i},${j}`); }
    if (leg) legs.push(`${i},${j}`);
  }
  const byHider = Object.entries(hiders).map(([k, v]) => `${k} ${v.length} (${v[0]} … ${v[v.length - 1]})`).join(', ');
  // (none: the player would show as the x-ray silhouette there — COMBAT-13)
  if (hiddenTiles) err(13, `a walker is behind a roof above the knee on ${hiddenTiles} of ${pathTiles} path tiles (yaw 0): ${byHider}`);
  else info(`camera: no walker is behind a roof above the knee on the ${pathTiles} path tiles (yaw 0)`);
  if (walled.length) err(13, `a walker is behind a wall or cliff to the waist at the centre of ${walled.length} path tiles (yaw 0): ${walled.slice(0, 12).join(' ')}`);
  info(`camera: a wall or cliff hides a walker's legs (above the knee) on ${legs.length} path tiles (yaw 0)${legs.length ? `: ${legs.slice(0, 16).join(' ')}` : ''}`);
  // hand-placed trees keep the sightlines; no crown hides half of a sight target
  for (const t of objects) {
    if (t.type !== 'tree' || P.SCATTERED.has(t)) continue;
    const v = P.VIEWS.find((q) => t.z > q.z && t.z < q.z + q.depth && Math.abs(t.x - q.x) < q.w);
    if (v) err(13, `hand-placed ${t.id} at (${t.x}, ${t.z}) stands in the sightline of (${v.x}, ${v.z})`);
  }
  const occl0 = createOcclusion({ g, objects, groundY: P.groundY, forestTop: FOREST_TOP });
  for (const s of sightTargets()) {
    for (const yaw of s.anyYaw ? YAWS : [0]) {
      const r = occl0.cover(s.x, s.z, { yaw, pitch: pitchAt(P.groundY(s.x, s.z)), h0: s.h0, h1: s.h1, terrain: false });
      if (r.share >= 0.5) err(13, `${s.what} at (${s.x.toFixed(1)}, ${s.z.toFixed(1)}) is ${Math.round(r.share * 100)} % hidden at yaw ${yaw} behind ${[...r.by.keys()].map((k) => k.id ?? k).join(', ')}`);
    }
  }
  // critters on walkable ground, wall torches on a wall, everything on the map, env rects overlap it
  const walkableAt = (x, z) => { const h = walk.surfaceAt(x, z); return h === h; };
  for (const o of objects) {
    const def = OBJECT_TYPES[o.type];
    if (def.placement === 'point' && !(o.x >= 0 && o.z >= 0 && o.x <= W && o.z <= D)) err(13, `${o.id} lies outside the map`);
    if (o.type === 'critters') {
      const bad = critterStartPoints(o, walkableAt).filter(([x, z]) => !walkableAt(x, z));
      if (bad.length) err(13, `critters ${o.id}: ${bad.length} animal(s) start off walkable ground`);
    } else if (o.type === 'wallTorch') {
      const i = Math.floor(o.x); const j = Math.floor(o.z);
      let wall = P.allShapes.some((c) => c.owner.type === 'house' && hitShape(c, o.x, o.z, 1.0));
      for (let dj = -1; dj <= 1 && !wall; dj++) for (let di = -1; di <= 1; di++) if (inMap(i + di, j + dj) && Math.abs(L(i + di, j + dj) - L(i, j)) >= 2) { wall = true; break; }
      if (!wall) err(13, `wall torch ${o.id} has no wall to hang on`);
    }
  }
  const env = level.environment;
  for (const a of [...(env.godRayAreas ?? []), ...(env.foliage?.flowerAreas ?? []), ...(env.foliage?.shrubAreas ?? []), ...(env.forest?.areas ?? [])]) {
    if (!(a.maxX > a.minX && a.maxZ > a.minZ && a.maxX > 0 && a.minX < W && a.maxZ > 0 && a.minZ < D)) err(13, `an environment area ${a.minX}–${a.maxX} × ${a.minZ}–${a.maxZ} does not overlap the map`);
  }
}

/** What the camera must see past the tree crowns (yaw 0): villagers, doors, signs, campfires, chests, waystones. */
function sightTargets() {
  const out = [];
  for (const o of P.objects) {
    if (o.type === 'npc') {
      out.push({ what: `villager ${o.id}`, x: o.x, z: o.z, h0: 0.25, h1: 1.6 });
      out.push({ what: `the talk spot south of ${o.id}`, x: o.x, z: o.z + 1.1, h0: 0.25, h1: 1.6 });
    } else if (o.type === 'house') { const d = P.doorOf(o); out.push({ what: `the door of ${o.id}`, x: d.x, z: d.z, h0: 0.25, h1: 1.6 }); }
    else if (o.type === 'signpost') {
      out.push({ what: `signpost ${o.id}`, x: o.x, z: o.z, h0: 0.4, h1: 1.8 });
      out.push({ what: `the reading spot of ${o.id}`, x: o.x, z: o.z + 0.9, h0: 0.25, h1: 1.6 });
    } else if (o.type === 'campfire') out.push({ what: `campfire ${o.id}`, x: o.x, z: o.z, h0: 0.1, h1: 0.8 });
    else if (o.type === 'chest') out.push({ what: `chest ${o.id}`, x: o.x, z: o.z, h0: 0.1, h1: 0.7, anyYaw: true });
    else if (o.type === 'waystone') out.push({ what: `waystone ${o.id}`, x: o.x, z: o.z, h0: 0.3, h1: 2.8, anyYaw: true });
  }
  return out;
}

/**
 * After every seeded placement: drop the scattered trees whose crowns hide a sight target (yaw 0,
 * ≥ 25 %), cover the arena (any yaw, > 25 %) or cover more than 10 % of an enemy group's home-disc
 * views (rule 14 allows 15 %). Hand-placed trees are left to validate().
 */
function clearCrowns() {
  const occl = createOcclusion({ g, objects: P.objects, groundY: P.groundY, forestTop: FOREST_TOP });
  const removed = [];
  const drop = (by) => {
    const victim = [...by.entries()].filter(([t]) => typeof t !== 'string' && P.SCATTERED.has(t)).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!victim) return false;
    P.removeObject(victim);
    P.SCATTERED.delete(victim);
    occl.removeTree(victim);
    removed.push(victim.id);
    return true;
  };
  for (const s of sightTargets()) {
    // (chests and waystones at every camera yaw: a pine on the ridge hid the pocket's chest at +60)
    for (const yaw of s.anyYaw ? YAWS : [0]) {
      for (;;) {
        const r = occl.cover(s.x, s.z, { yaw, pitch: pitchAt(P.groundY(s.x, s.z)), h0: s.h0, h1: s.h1, terrain: false });
        if (r.share < 0.25 || !drop(r.by)) break;
      }
    }
  }
  // the walkers on the roads along Cinder Ridge (the Ruins east lane, the ridge-foot road): at the
  // yaws that look across the ridge no scattered crown (its pines) hides more than half of them
  for (const path of g.PATHS.filter((q) => RIDGE_ROADS.includes(q.name))) {
    for (let k = 0; k < path.points.length - 1; k++) {
      const [ax, az] = path.points[k]; const [bx, bz] = path.points[k + 1];
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az)));
      for (let t = 0; t <= n; t++) {
        const x = ax + ((bx - ax) * t) / n; const z = az + ((bz - az) * t) / n;
        for (const yaw of [-60, 60]) {
          for (;;) {
            const r = occl.cover(x, z, { yaw, pitch: pitchAt(P.groundY(x, z)), h0: 0.1, h1: 2 });
            if (r.share <= 0.5 || !drop(r.by)) break;
          }
        }
      }
    }
  }
  // the arena, inset 1 u
  for (let z = ARENA.minZ + 1; z <= ARENA.maxZ - 1; z += 1) for (let x = ARENA.minX + 1; x <= ARENA.maxX - 1; x += 1) {
    for (const yaw of YAWS) {
      for (;;) {
        const r = occl.cover(x, z, { yaw, pitch: 38, h0: 0.1, h1: 2 });
        if (r.share <= 0.25 || !drop(r.by)) break;
      }
    }
  }
  // enemy home discs
  for (const o of P.objects.filter((e) => e.type === 'enemy' && !ENEMY_INFO[e.kind].passive && !ENEMY_INFO[e.kind].boss)) {
    const r = o.radius + 3;
    const samples = [];
    for (let dz = -Math.floor(r); dz <= Math.floor(r); dz++) for (let dx = -Math.floor(r); dx <= Math.floor(r); dx++) if (dx * dx + dz * dz <= r * r) samples.push([o.x + dx, o.z + dz]);
    for (let guard = 0; guard < 40; guard++) {
      const by = new Map();
      let covered = 0; let n = 0;
      for (const [x, z] of samples) {
        const y0 = P.groundY(x, z);
        for (const yaw of YAWS) {
          n++;
          const c = occl.cover(x, z, { yaw, pitch: pitchAt(y0), h0: 0.1, h1: 2 });
          if (c.share > 0.25) { covered++; for (const [k, v] of c.by) by.set(k, (by.get(k) ?? 0) + v); }
        }
      }
      if (covered / n <= 0.1 || !drop(by)) break;
    }
  }
  return removed;
}

/** Feature coverage checklist (COMBAT.md §15.6). */
function coverage(level) {
  const byType = {};
  for (const o of level.objects) byType[o.type] = (byType[o.type] ?? 0) + 1;
  const enemies = level.objects.filter((o) => o.type === 'enemy');
  const chests = level.objects.filter((o) => o.type === 'chest');
  const npcs = level.objects.filter((o) => o.type === 'npc');
  const events = level.objects.filter((o) => o.type === 'event');
  /** @param {unknown} v a script field */
  const lines = (v) => (Array.isArray(v) ? v.filter((l) => typeof l === 'string') : []);
  const emitters = new Set(level.objects.filter((o) => o.type === 'emitter').map((o) => o.preset));
  const env = level.environment;
  const combatTypes = Object.keys(OBJECT_TYPES).filter((t) => OBJECT_TYPES[t].combat);
  const golems = enemies.filter((o) => o.kind === 'golem');
  const upgrades = CHEST_UPGRADES.filter((u) => u !== 'none');
  const needEmit = ['mist', 'fireflies', 'embers', 'smoke', 'dust', 'leaves', 'petals'];
  const envKeys = ['timeOfDay', 'clock', 'weather', 'border', 'outerScenery', 'godRays', 'dust', 'music', 'camera', 'highGround', 'title', 'titleCamera', 'godRayAreas', 'foliage', 'forest', 'scenery'];
  return [
    ['every combat OBJECT_TYPES type', combatTypes.every((t) => byType[t]), combatTypes.map((t) => `${t}×${byType[t] ?? 0}`).join(' ')],
    ['every ENEMY_KINDS kind', ENEMY_KINDS.every((k) => enemies.some((e) => e.kind === k)), ENEMY_KINDS.filter((k) => !enemies.some((e) => e.kind === k)).join(' ') || `${ENEMY_KINDS.length} kinds`],
    ['exactly one golem with arena and gate', golems.length === 1 && golems.every((o) => o.arena && Array.isArray(o.gate)), `${golems.length}`],
    ['≥ 1 elite', enemies.some((e) => e.elite), `${enemies.filter((e) => e.elite).map((e) => e.id).join(' ')}`],
    ['every CHEST_UPGRADES value but none, and a gold-only chest', upgrades.every((u) => chests.some((c) => c.upgrade === u)) && chests.some((c) => c.upgrade === 'none' && c.gold > 0 && !c.potions),
      chests.map((c) => `${c.id}:${c.upgrade}`).join(' ')],
    ['≥ 3 waystones', (byType.waystone ?? 0) >= 3, `${byType.waystone ?? 0}`],
    ["an NPC with script 'drillmaster'", npcs.some((n) => n.script === 'drillmaster'), npcs.filter((n) => n.script === 'drillmaster').map((n) => n.id).join(' ')],
    ["a shop NPC selling 'Healing Draught'", npcs.some((n) => n.action === 'shop' && n.item === 'Healing Draught'), npcs.filter((n) => n.action === 'shop').map((n) => n.id).join(' ')],
    ["a 'shopkeeper' NPC at the camp and at the Quarry Waystone", ['bram', 'odo'].every((id) => npcs.some((n) => n.id === id && n.script === 'shopkeeper')), npcs.filter((n) => n.script === 'shopkeeper').map((n) => n.id).join(' ')],
    ['emitters: mist, fireflies, embers, smoke, dust, leaves, petals', needEmit.every((p) => emitters.has(p)), needEmit.filter((p) => !emitters.has(p)).join(' ') || [...emitters].join(' ')],
    ['≥ 1 waterfall', (byType.waterfall ?? 0) >= 1, `${byType.waterfall ?? 0}`],
    ['≥ 3 bridges', (byType.bridge ?? 0) >= 3, `${byType.bridge ?? 0}`],
    ['environment keys of §15.1', envKeys.every((k) => env[k] !== undefined && env[k] !== null), envKeys.filter((k) => env[k] === undefined || env[k] === null).join(' ') || 'all'],
    ['environment.clock === false', env.clock === false, String(env.clock)],
    ['environment.combat absent (auto)', !('combat' in env), 'combat' in env ? String(env.combat) : 'absent'],
    ['valid presets', npcs.every((n) => CHARACTER_PRESET_NAMES.includes(n.preset)) && level.objects.filter((o) => o.type === 'emitter').every((o) => EMITTER_PRESETS.includes(o.preset)), ''],
    // the party demo (docs/specs/PARTY.md §9)
    ['a villager who joins the party (a talk script with `party join` and `party menu`)', npcs.some((n) => lines(n.talk).some((l) => /^\s*party join /.test(l)) && lines(n.talk).some((l) => /^\s*party menu\b/.test(l))),
      npcs.filter((n) => lines(n.talk).some((l) => /^\s*party join /.test(l))).map((n) => n.id).join(' ')],
    ['a background event that sets a member\'s rule (`party rule`)', events.some((e) => e.background === true && lines(e.run).some((l) => /^\s*party rule /.test(l))),
      events.filter((e) => lines(e.run).some((l) => /^\s*party rule /.test(l))).map((e) => e.id).join(' ')],
    // the full party of four the enemies are balanced for (ADR-056): a villager joins as each class
    ...['warden', 'ranger', 'mystic'].map((cls) => {
      const joins = (n) => lines(n.talk).some((l) => new RegExp(`^\\s*party join \\S+ as ${cls}\\b`).test(l));
      return [`a villager who joins as a ${cls} (\`party join … as ${cls}\`)`, npcs.some(joins), npcs.filter(joins).map((n) => n.id).join(' ')];
    }),
  ];
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

camp();
glade();
crossroads();
ruins();
ridge();
mire();
quarry();
caldera();
people();
combatObjects();
sightlines();
const handTrees = P.objects.filter((o) => o.type === 'tree').length;
const scatteredTrees = scatterTrees(g, P, { seed: 'cinderwatch:trees', rules: TREE_RULES, maxTrees: 300, maskSeed: 90, avoid: treeAvoid });
const scatteredRocks = scatterRocks(g, P, { seed: 'cinderwatch:rocks', rules: ROCK_RULES, maxRocks: 90, bigZones: ['quarry', 'terrace'], avoid: scatterAvoid });
const ridgeScatter = ridgeWoods();
const crownsCleared = clearCrowns();
const ridgeTiles = ridgeRock();
regions();
story();

const rows = g.rows(levelToChar);
/** @type {Level} */
const raw = {
  format: LEVEL_FORMAT,
  version: LEVEL_VERSION,
  name: NAME,
  subtitle: 'Where the Old Fires Wake',
  author: 'Luminati',
  description: 'The Luminati action demo: recruit three party companions — Sister Ilse and Rook at the Waystone Camp, Sela, a warden of the watch, at the Crossroads Waystone — and climb a 96 × 120 mountain pass through the Mossy Glade, the Bramble Ruins or the Hollow Mire and the Cinder Quarry to Cinderheart\'s caldera: slimes, goblins, archers, shamans, bats, boars and a three-phase boss, balanced for a party of four. Generated by tools/make-cinderwatch-pass.mjs.',
  width: W,
  depth: D,
  waterLevel: 0.4,
  water: { flow: [0, 0.45], reflect: 0.12, neutral: 0.45, glint: 0.6 },
  environment: environment(),
  spawn: { x: 48.5, z: 113.5, facing: 'up' },
  legend: LEGEND,
  tiles: rows.tiles,
  heights: rows.heights,
  objects: P.objects.map(canonicalObject),
};

const { level, warnings } = normalizeLevel(raw);
level.objects = level.objects.map(canonicalObject);
const errors = validateLevel(level);
for (const p of normalizedChanges(raw, level)) errors.push(`normalizeLevel changed ${p}`);
// the content-text keys (docs/specs/I18N.md §4.10): carried from the current file at the default
// path (never --out), new ones seeded by the file and the text — the companions' talk and the events' lines
// get their #line: tags
keyLevel(level, { root, file: 'public/levels/cinderwatch-pass.json' });
errors.push(...keyIssueLines(level));
const occl = createOcclusion({ g, objects: P.objects, groundY: P.groundY, forestTop: FOREST_TOP });
const report = validate(level, occl);
// the story (the companions' talk scripts, their events): what `npm run level:check` lists as `story:` lines
for (const i of storyIssues(level)) {
  const m = `[story] ${formatStoryIssue(i, level)}`;
  if (i.severity === 'error') report.errors.push(m);
  else report.warnings.push(m);
}
const checks = coverage(level);
const text = serializeLevel(level);
if (serializeLevel(normalizeLevel(JSON.parse(text)).level) !== text) report.errors.push('[1] serializeLevel is not byte-stable for this level');
if (serializeLevel(parseLevel(text).level) !== text) report.errors.push('[1] parseLevel → serializeLevel is not byte-identical');

// ---- report --------------------------------------------------------------------------------
const stats = levelStats(level);
const heightsUsed = [...new Set(level.heights.join(''))].map(charToLevel).sort((a, b) => a - b);
log(`${NAME} → ${path.relative(root, OUT)}: ${stats.width}×${stats.depth}, ${stats.objects} objects, ${stats.walkable} walkable / ${stats.water} water tiles, levels ${heightsUsed[0]}–${heightsUsed[heightsUsed.length - 1]}`);
log('objects by type:', Object.entries(stats.counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
log(`ridge: ${ridgeTiles} rock tiles with the crag side (legend 'r')`);
log(`trees: ${handTrees} hand-placed + ${scatteredTrees + ridgeScatter.pines - crownsCleared.length} scattered (${ridgeScatter.pines} on the ridge; ${crownsCleared.length} dropped for a view) · rocks: ${scatteredRocks} scattered + ${ridgeScatter.rocks} on the ridge`);
log('moved from the §15.3 design:');
for (const m of MOVES) log(`  · ${m}`);
log('coverage:');
for (const [name, ok, detail] of checks) log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
log('validation:');
for (const m of report.info) log(`  · ${m}`);
for (const m of warnings) log(`  ! normalizeLevel warning: ${m}`);
for (const m of report.warnings) log(`  ! ${m}`);
for (const m of errors) log(`  ✗ validateLevel: ${m}`);
for (const m of report.errors) log(`  ✗ ${m}`);
if (args.ascii) for (const r of level.tiles) console.log(r);

const failed = warnings.length + errors.length + report.errors.length + checks.filter((c) => !c[1]).length;
const rel = path.relative(root, OUT);
if (args.check) {
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
if (failed) process.exitCode = 1;
