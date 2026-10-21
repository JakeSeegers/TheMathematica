#!/usr/bin/env node
/**
 * Builds the 128 × 128 town level `public/levels/gildhaven.json` — **Gildhaven, "Market Day on the
 * River Gild"** — deterministically (seeded RNG, no Math.random, no Date) with the LevelFormat /
 * ObjectCatalog helpers and the shared generator helpers of tools/lib/levelgen.mjs, then validates
 * it and prints stats and a report.
 *
 *   node tools/make-gildhaven.mjs [--out=public/levels/gildhaven.json] [--check] [--force] [--ascii] [--quiet]
 *     --check  write nothing; exit 1 unless the output matches the file byte for byte
 *     --force  write the level even when checks fail (for inspection only; the exit code is still 1)
 *     --ascii  print the tile map          --quiet  no report
 *   play it: game.html?level=gildhaven   ·   edit it: editor.html?open=gildhaven
 *
 * Every text carries its content-text key (`textKeys`, docs/specs/I18N.md §4.10): carried from the
 * current file at the default path (never --out), a new text's minted from the file and the text.
 *
 * A walled river town on fair day, laid out for the camera that looks north: every street runs
 * past the fronts of the houses north of it, so doors, stalls and villagers face the player.
 * North to south:
 *   High Town (level 5): Sunspire Abbey and its plaza, Gildhaven Hall, the Guild Exchange, the Gilt
 *     Library, the Watch House, Pippin Orchard, Crown Walk and the Rampart Walk along the terrace
 *     edge; the Gild comes down from the hills through it and drops off the edge as the Gildfall.
 *   The river: the Gildfall's pool, the North Quay under the terrace wall (the Grand Stair and the
 *     Harbour Stair climb it), Kingsbridge, Saltbridge and the Mistbridge, the Gild Pool harbour
 *     with its piers, beach and boathouse.
 *   The lower town (level 2): the Market Square on the river (the Gild Well, eight stalls, the
 *     Gilded Goose), the West Quarter (the Undercliff, the mill, the Barrelhouse, the smithy), the
 *     East Quarter and Barge Quay, Market Street, Lantern Row and Weaver's Lane with the lanes
 *     between them, Bellgreen, the allotments and the town wall with the South Gate.
 *   Fairfield (outside the wall): the King's Road from the spawn, the fairground with the players'
 *     stage, Fairfield Mill on its knoll, Barlow's Farm.
 *
 * Passes (each one function below, run in this order):
 *   relief → water → paths → stairs → wall → ground → border → highTown → river → square → west →
 *   east → harbour → rows → fairfield → people → sightlines → scatterTrees / scatterRocks (RNG
 *   'gildhaven:trees' / 'gildhaven:rocks') → dressHouses (RNG 'gildhaven:dressing') → clearCrowns →
 *   regions → environment → normalise → validate → round trip → write.
 *
 * Custom legend chars: 'e' = the river flowing east (flow [0.45, 0]); 'q' = dressed stone (the town
 * wall and its towers: stone tiles on top, stone-wall sides, blocked).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEVEL_FORMAT, LEVEL_VERSION, defaultLegend, normalizeLevel, validateLevel, serializeLevel, parseLevel, levelStats,
  levelToChar, charToLevel,
} from '../src/engine/level/LevelFormat.js';
import { RNG, fbm2, hash2 } from '../src/engine/utils/math.js';
import {
  parseArgs, createGrid, createPlacer, createOcclusion, scatterTrees, scatterRocks, scatterForestTop,
  normalizedChanges, canonicalObject, rot, BLOCKED, HARD, STAIRS, S_, E_, W_, N_, keyLevel,
} from './lib/levelgen.mjs';
import { checkLevel, sightTargets, addSightlines, cameraPitch } from './lib/levelcheck.mjs';

/** @import { XZ, Level, LevelEnvironment } from '../src/engine/level/types.js' */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
if (args.out === true || args.out === '') {
  console.error('--out needs a path, e.g. --out=.check/gildhaven.json');
  process.exit(2);
}
const OUT = path.resolve(root, String(args.out ?? 'public/levels/gildhaven.json'));
const log = args.quiet ? () => {} : (...a) => console.log(...a);

// =============================================================================================
// Grid and the town plan
// =============================================================================================

const W = 128;
const D = 128;
const NAME = 'Gildhaven'; // frozen: it seeds the terrain noise
/** Terrain levels (world y = level × 0.5). */
const LV = { BED: 0, BEACH: 1, TOWN: 2, KNOLL: 3, STAGE: 3, STREAM: 4, HIGH: 5, WALL: 5, TOWER: 7 };

const g = createGrid({ width: W, depth: D, fill: 'g', level: LV.TOWN, zone: 'town' });
const { T, L, Z, I, set, rect, blob, inMap } = g;
const P = createPlacer(g);
const { add } = P;
/** The trees the game scatters on forest tiles, as view-ray occluders. */
const FOREST_TOP = scatterForestTop(g);

/** The town's spine (world x): the King's Road, Main Street, Kingsbridge and the Grand Stair. */
const AXIS = 64;
/** The last High Town row (j); the North Quay and the Undercliff start one row south. */
const EDGE = 31;
/** Water (tile rects, inclusive). */
const STREAM = { i0: 47, i1: 49 };
const POOL = { i0: 44, i1: 53, j0: 32, j1: 40 };
const RIVER = { i0: 44, i1: 99, j0: 39, j1: 43 };
const HARBOUR = { i0: 100, i1: 116, j0: 32, j1: 55 };
/** The town wall (rows) and the South Gate (columns). */
const WALL = { j0: 96, j1: 97 };
const GATE = { i0: 61, i1: 66 };
/** East–west streets (rows j0–j1) and north–south lanes (columns i0–i1), all cobbled. */
const ST = { crown: [23, 25], undercliff: [37, 39], market: [59, 61], lantern: [74, 76], weaver: [89, 91] };
const LANE = { mill: [32, 33], tanner: [29, 30], cooper: [46, 47], main: [62, 65], chandler: [81, 82], harbour: [98, 99], saltwick: [112, 113] };
/** Where the front walls of each row of south-facing houses stand (0.4 u north of their street). */
const FRONT = { crown: ST.crown[0] - 0.4, quay: ST.undercliff[0] - 0.4, market: ST.market[0] - 0.4, lantern: ST.lantern[0] - 0.4, weaver: ST.weaver[0] - 0.4 };

// =============================================================================================
// 1. Terrain
// =============================================================================================

/** High Town's terrace, Fairfield and its knoll, the zones of the lower town. */
function relief() {
  rect(0, 0, W - 1, EDGE, (i, j) => set(i, j, 'g', LV.HIGH, { zn: i < STREAM.i0 - 1 && i <= 21 ? 'orchard' : 'high' }));
  rect(0, EDGE + 1, 43, 40, (i, j) => set(i, j, null, null, { zn: 'undercliff' }));
  rect(0, 41, 43, ST.market[0] - 1, (i, j) => set(i, j, null, null, { zn: 'west' }));
  rect(LANE.chandler[0], 44, LANE.harbour[0] - 1, ST.market[0] - 1, (i, j) => set(i, j, null, null, { zn: 'east' }));
  rect(0, ST.weaver[1] + 1, W - 1, WALL.j0 - 1, (i, j) => set(i, j, null, null, { zn: 'allotments' }));
  rect(0, ST.lantern[1] + 1, LANE.tanner[0] - 1, ST.weaver[1], (i, j) => set(i, j, null, null, { zn: 'green' }));
  rect(0, WALL.j1 + 1, W - 1, D - 1, (i, j) => set(i, j, 'g', LV.TOWN, { zn: 'fair' }));
  // Fairfield Mill's knoll (one level up)
  blob(32, 102.4, 8, 4.2, (i, j) => set(i, j, null, LV.KNOLL, { zn: 'knoll' }), { seed: 3, wobble: 0.1 });
}

/** The Gild: the stream across High Town, the Gildfall's pool, the river, the harbour, the outlet; the Fairfield pond. */
function water() {
  const wet = (i, j, ch, lvl, zn) => set(i, j, ch, lvl, { lock: true, zn });
  // the stream comes down from the hills (flowing south, one level below the terrace)
  rect(STREAM.i0, 0, STREAM.i1, EDGE, (i, j) => wet(i, j, '~', LV.STREAM, 'stream'));
  // the Gildfall's pool at the foot of the terrace wall (its south corners rounded)
  rect(POOL.i0, POOL.j0, POOL.i1, POOL.j1, (i, j) => {
    if (j === POOL.j1 && (i === POOL.i0 || i === POOL.i1)) return;
    wet(i, j, 'p', LV.BED, 'pool');
  });
  // the river, east to the harbour
  rect(RIVER.i0, RIVER.j0, RIVER.i1, RIVER.j1, (i, j) => wet(i, j, 'e', LV.BED, 'river'));
  // the Gild Pool: still water under the terrace cliff (corners rounded)
  rect(HARBOUR.i0, HARBOUR.j0, HARBOUR.i1, HARBOUR.j1, (i, j) => {
    const ci = i === HARBOUR.i0 || i === HARBOUR.i1;
    if (j === HARBOUR.j1 && ci) return;
    if (j === HARBOUR.j1 - 1 && i === HARBOUR.i0) return;
    wet(i, j, 'o', LV.BED, 'harbour');
  });
  // the outlet to the estuary, along the cliff foot to the east edge
  rect(HARBOUR.i1 + 1, HARBOUR.j0, W - 1, HARBOUR.j0 + 4, (i, j) => wet(i, j, 'e', LV.BED, 'river'));
  // the beach on the harbour's east side (one level above the bed)
  rect(HARBOUR.i1 + 1, HARBOUR.j0 + 5, 124, HARBOUR.j1, (i, j) => set(i, j, 's', LV.BEACH, { lock: true, zn: 'beach' }));
  // the duck pond at Barlow's Farm (bed one level down)
  blob(12.5, 118.5, 3.4, 2.4, (i, j) => wet(i, j, 'o', LV.BEACH, 'pond'), { seed: 5, wobble: 0.1 });
}

/**
 * A straight street over the tile rect [i0, i1] × [j0, j1]; its centre line goes into PATHS (the
 * blocked-path check walks it). Water and other locked tiles are left alone.
 */
function street(name, i0, j0, i1, j1, ch = 'c', { line = true } = {}) {
  const horiz = i1 - i0 >= j1 - j0;
  if (line) {
    const pts = horiz ? [[i0 + 0.5, (j0 + j1 + 1) / 2], [i1 + 0.5, (j0 + j1 + 1) / 2]] : [[(i0 + i1 + 1) / 2, j0 + 0.5], [(i0 + i1 + 1) / 2, j1 + 0.5]];
    g.PATHS.push({ name, points: pts, width: horiz ? j1 - j0 + 1 : i1 - i0 + 1, ch });
  }
  rect(i0, j0, i1, j1, (i, j) => {
    if ((g.isLocked(i, j) && !g.pathMask[I(i, j)]) || STAIRS.has(T(i, j))) return;
    set(i, j, ch, null, { lock: true });
    g.pathMask[I(i, j)] = 1;
  });
}
/** A paved square or yard (path tiles, no centre line). */
const plaza = (i0, j0, i1, j1, ch = 'c') => street('', i0, j0, i1, j1, ch, { line: false });
/** Paving that is not a walkway (behind the warehouses): cobbles, but no path tiles. */
const paving = (i0, j0, i1, j1, ch = 'c') => rect(i0, j0, i1, j1, (i, j) => { if (!g.isLocked(i, j)) set(i, j, ch, null, { lock: true }); });

/** Streets, lanes, squares and quays (cobbles in town, dirt outside the wall). */
function paths() {
  const [m0, m1] = LANE.main;
  // ---- Fairfield
  street("King's Road", m0, WALL.j1 + 1, m1, D - 1, '.');
  street('Mill Lane', 8, 107, m0 - 1, 108, '.');
  street('Fair Lane', m1 + 1, 107, 75, 108, '.');
  // ---- the lower town
  street('Main Street', m0, ST.market[1] + 1, m1, WALL.j0 - 1);
  plaza(GATE.i0, WALL.j0, GATE.i1, WALL.j1);
  street('Market Street', 4, ST.market[0], 123, ST.market[1]);
  street('Lantern Row', 4, ST.lantern[0], 123, ST.lantern[1]);
  street("Weaver's Lane", 4, ST.weaver[0], 123, ST.weaver[1]);
  for (const [name, key] of [["Tanner's Lane", 'tanner'], ["Cooper's Lane", 'cooper'], ["Chandler's Lane", 'chandler'], ['Saltwick Lane', 'saltwick']]) {
    const [a, b] = LANE[key];
    street(name, a, ST.market[1] + 1, b, ST.weaver[0] - 1);
  }
  street('Harbour Lane', LANE.harbour[0], 44, LANE.harbour[1], ST.weaver[0] - 1);
  street('Mill Lane (town)', LANE.mill[0], ST.undercliff[1] + 1, LANE.mill[1], ST.market[0] - 1);
  street('Undercliff Walk', 6, ST.undercliff[0], 43, ST.undercliff[1]);
  // ---- the river front
  plaza(46, 44, 81, ST.market[0] - 1); // the Market Square
  plaza(82, 44, LANE.harbour[0] - 1, 46); // Barge Quay
  plaza(POOL.i1 + 1, ST.undercliff[0], LANE.harbour[1], 38); // the North Quay's walk
  paving(POOL.i1 + 1, EDGE + 1, LANE.harbour[1], ST.undercliff[0] - 1); // … and the quay behind it
  g.PATHS.push({ name: 'North Quay', points: [[POOL.i1 + 2.2, 37.5], [LANE.harbour[1] + 0.5, 37.5]], width: 2, ch: 'c' });
  plaza(HARBOUR.i0, HARBOUR.j1 + 1, 123, ST.market[0] - 1); // the harbour's fish quay
  // ---- High Town
  street('Crown Walk', 5, ST.crown[0], 122, ST.crown[1]);
  plaza(54, 14, 73, ST.crown[0] - 1, 'k'); // Abbey Plaza
  plaza(27, 16, 38, ST.crown[0] - 1, 'k'); // Hall Court
  street('Exchange walk', 86, 17, 87, ST.crown[0] - 1, 'k');
  street('Library walk', 99, 16, 100, ST.crown[0] - 1, 'k');
  plaza(109, 15, 122, ST.crown[0] - 1, 'd'); // the Watch yard
  street('Orchard walk', 11, ST.crown[0] - 1, 12, ST.crown[0] - 1, 'c', { line: false });
}

/** The stairs up the terrace wall (cut into it: the foot is a one-row recess). */
function stairs() {
  const { flight, pad } = g;
  const [m0, m1] = LANE.main;
  pad(m0, EDGE, m1, EDGE, LV.TOWN, 'c');
  flight('Grand Stair', m0, EDGE - 1, 'N', LV.TOWN, 3, m1 - m0 + 1);
  pad(m0, EDGE - 5, m1, EDGE - 4, LV.HIGH, 'k');
  street('Abbey Way', m0, ST.crown[1] + 1, m1, EDGE - 4, 'k');
  pad(94, EDGE, 96, EDGE, LV.TOWN, 'c');
  flight('Harbour Stair', 94, EDGE - 1, 'N', LV.TOWN, 3, 3);
  pad(94, EDGE - 5, 96, EDGE - 4, LV.HIGH, 'c');
  street('Harbour Stair walk', 94, ST.crown[1] + 1, 96, EDGE - 4);
}

/** The town wall (dressed stone, 1.5 u above the ground, merlons on its outer row) and its towers. */
const TOWERS = [[22, 24], [41, 43], [58, 60], [67, 69], [85, 87], [104, 106]];
function wall() {
  for (let i = 3; i <= W - 4; i++) {
    if (i >= GATE.i0 && i <= GATE.i1) continue;
    set(i, WALL.j0, 'q', LV.WALL, { lock: true, zn: 'wall' });
    set(i, WALL.j1, 'q', LV.WALL + (i % 2 === 0 ? 1 : 0), { lock: true, zn: 'wall' });
  }
  for (const [i0, i1] of TOWERS) {
    const gate = i0 === 58 || i0 === 67;
    rect(i0, WALL.j0 - 1, i1, WALL.j1 + 1, (i, j) => set(i, j, 'q', gate ? LV.TOWER : LV.TOWER - 1, { lock: true, zn: 'wall' }));
  }
}

/** Ground variety by zone (never on locked tiles), farmland, the fairground and the stage. */
function ground() {
  for (let j = 0; j < D; j++) {
    for (let i = 0; i < W; i++) {
      if (g.locked[I(i, j)]) continue;
      const n = fbm2(i * 0.11, j * 0.11, { seed: 60, octaves: 3 });
      const m = fbm2(i * 0.23 + 7, j * 0.23 - 3, { seed: 61, octaves: 2 });
      let ch = 'g';
      switch (Z(i, j)) {
        case 'high': ch = m > 0.6 ? 'f' : n > 0.6 ? 'G' : 'g'; break;
        case 'orchard': ch = m > 0.55 ? 'f' : n > 0.55 ? 'G' : 'g'; break;
        case 'undercliff': ch = n > 0.55 ? 'G' : m > 0.62 ? 'm' : 'g'; break;
        case 'west': ch = n > 0.6 ? 'G' : m < 0.3 ? 'd' : 'g'; break;
        case 'east': ch = n > 0.55 ? 'G' : 'd'; break;
        case 'green': ch = m > 0.56 ? 'f' : n > 0.6 ? 'G' : 'g'; break;
        case 'allotments': ch = n > 0.58 ? 'G' : 'g'; break;
        case 'knoll': ch = m > 0.5 ? 'f' : 'g'; break;
        case 'fair': ch = m > 0.56 ? 'f' : n > 0.62 ? 'G' : 'g'; break;
        default: ch = n > 0.6 ? 'G' : m > 0.64 ? 'f' : 'g';
      }
      g.tiles[I(i, j)] = ch;
    }
  }
  // sand round the harbour beach and the pond, reeds by the river banks
  for (let j = 30; j < D; j++) for (let i = 0; i < W; i++) {
    if (g.locked[I(i, j)] || T(i, j) === 'T') continue;
    let wetN = false;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (Z(i + di, j + dj) === 'pond' || Z(i + di, j + dj) === 'pool') wetN = true;
    if (wetN && hash2(i, j, 26) < 0.6) g.tiles[I(i, j)] = 's';
  }
  // the stream's banks in High Town: sand and moss
  rect(STREAM.i0 - 1, 0, STREAM.i1 + 1, EDGE, (i, j) => { if (!g.locked[I(i, j)] && hash2(i, j, 27) < 0.55) g.tiles[I(i, j)] = hash2(i, j, 28) < 0.6 ? 's' : 'm'; });
  // allotments: vegetable plots between the gardens' paths
  for (const [i0, j0, i1, j1] of ALLOTMENTS) rect(i0, j0, i1, j1, (i, j) => { if (!g.locked[I(i, j)]) set(i, j, 'F', null, { lock: true }); });
  // Fairfield's fields
  for (const [i0, j0, i1, j1] of FIELDS) rect(i0, j0, i1, j1, (i, j) => { if (!g.locked[I(i, j)] && Z(i, j) === 'fair') set(i, j, 'F', null, { lock: true }); });
  // the fairground: trampled ground in the middle, the players' stage (a wooden deck one level up)
  blob(89, 111, 14, 8.5, (i, j, d) => { if (!g.locked[I(i, j)] && (d < 0.7 || hash2(i, j, 29) < 0.5)) g.tiles[I(i, j)] = 'd'; }, { seed: 31, wobble: 0.15 });
  rect(STAGE.i0, STAGE.j0, STAGE.i1, STAGE.j1, (i, j) => set(i, j, 'b', LV.STAGE, { lock: true, zn: 'stage' }));
  // the farmyard
  rect(6, 103, 22, 106, (i, j) => { if (!g.locked[I(i, j)] && Z(i, j) === 'fair') g.tiles[I(i, j)] = hash2(i, j, 30) < 0.7 ? 'd' : 'g'; });
  // the Gild Well's ring of flags and the stalls' aisles on the Market Square
  blob(AXIS, WELL.z, 4.4, 3.4, (i, j) => { if (g.pathMask[I(i, j)] && T(i, j) === 'c') g.tiles[I(i, j)] = 'k'; }, { wobble: 0 });
  rect(46, 44, 81, 44, (i, j) => { if (T(i, j) === 'c') g.tiles[I(i, j)] = 'k'; });
  // the Sun Well's ring on Abbey Plaza
  blob(AXIS, 18.5, 3.2, 2.6, (i, j) => { if (T(i, j) === 'k') g.tiles[I(i, j)] = 'c'; }, { wobble: 0 });
}
/** Vegetable plots between the gardens' paths (tile rects). */
const ALLOTMENTS = [[6, 93, 12, 94], [15, 93, 20, 94], [32, 93, 39, 94], [45, 93, 52, 94], [76, 93, 83, 94], [89, 93, 95, 94], [109, 93, 116, 94]];
/** Fairfield's fields (tile rects). */
const FIELDS = [[4, 110, 9, 124], [16, 110, 23, 123], [45, 100, 56, 105], [45, 112, 58, 123], [107, 100, 122, 106], [107, 112, 122, 123]];
/** The players' stage (tile rect, a wooden deck one level up). */
const STAGE = { i0: 84, i1: 91, j0: 101, j1: 104 };
/** The Gild Well in the middle of the Market Square. */
const WELL = { x: AXIS, z: 51.5 };

/** The forest ring round the map (3–4 tiles), never over water, the wall or a road. */
function border() {
  g.borderRing({ north: 4, south: 3, west: 3, east: 3 });
  g.closeCorridors(3);
}

// =============================================================================================
// 2. Objects — buildings, bridges, props, lights, area by area
// =============================================================================================

/**
 * A row of south-facing houses whose front walls stand at `front` (world z).
 * Each entry: [id, name, x, width, depth, opts, text, { light?, doorOffset? }].
 */
function rowS(front, list) {
  for (const [id, name, x, w, d, o, text, extra = {}] of list) {
    P.house(id, name, x, front - d / 2, { width: w, depth: d, ...o }, text, { light: !!extra.light });
  }
}

/** High Town — the Abbey, the Hall, the Exchange, the Library, the Watch, the orchard, the Rampart Walk. */
function highTown() {
  P.house('abbey', 'Sunspire Abbey', AXIS, 9.4, {
    width: 8, depth: 6, stories: 2, wall: 'stone_brick', upperWall: 'stone_brick', roof: 'roof_slate', gableFront: true, chimney: false, shutters: false, doorHood: true,
  }, ['The great door stands ajar. Inside, a hundred candles and one very patient choir.', 'A brass plate by the door: "{The Sunspire Bell} rings the fair closed at dusk. Kindly do not ring it yourself. — The Abbess"']);
  P.torch(AXIS - 2.1, 12.52, S_, 2.4); P.torch(AXIS + 2.1, 12.52, S_, 2.4);
  P.light(AXIS, 8.8, { dy: 3.2, color: '#ffc98a', intensity: 7, distance: 7.5, flicker: 0.35 }); // candles behind the windows
  P.well('sun_well', AXIS, 18.5, ['The {Sun Well}. Its water is said to taste of honey on fair day.', 'It tastes of water. Very good water, to be fair.'], 'roof_slate');
  P.bench(58.5, 16.2, E_, 1.6); P.bench(69.5, 16.2, W_, 1.6);
  P.flowers(56.2, 13.2, S_, 1.6); P.flowers(71.8, 13.2, S_, 1.6);
  P.lamp(55.5, 21.6, 'top'); P.lamp(72.5, 21.6, 'top');

  P.house('gildhaven_hall', 'Gildhaven Hall', 32.5, 12, {
    width: 7, depth: 5, stories: 2, wall: 'stone_brick', upperWall: 'plaster', roof: 'roof_blue', chimney: false, doorHood: true, sign: true,
  }, ['A footman opens the door an inch: "The Lord Mayor is receiving in the court today, as it is fair day. And as it is sunny."'], { light: true });
  P.torch(30.4, 14.62, S_, 2.3); P.torch(34.6, 14.62, S_, 2.3);
  P.flowers(28.6, 16.6, S_, 1.4); P.flowers(36.4, 16.6, S_, 1.4);
  P.bench(28.4, 20.4, S_, 1.6); P.bench(36.6, 20.4, S_, 1.6);
  P.lamp(27.6, 22.4, 'top'); P.lamp(38.4, 22.4, 'top');
  P.house('thornbury', 'Thornbury House', 42.2, FRONT.crown - 1.7, { width: 4, depth: 3.4, wall: 'plaster', roof: 'roof_blue', shutters: true },
    ['A maid peers out. "Lady Thornbury is not at home. Lady Thornbury is at the fair, buying a hat she does not need."']);

  P.house('guild_exchange', 'The Guild Exchange', 86.5, 12, {
    width: 6.5, depth: 4.5, stories: 2, wall: 'brick', upperWall: 'timber_frame', roof: 'roof_red', sign: true, doorHood: true, chimney: false,
  }, ['Through the door: the clatter of an abacus and somebody saying "Twelve barrels? I said TWO barrels!"'], { light: true });
  P.house('larkspur', 'Larkspur House', 77.6, FRONT.crown - 1.7, { width: 4, depth: 3.4, wall: 'timber_frame', roof: 'roof_red' },
    ['Nobody answers, but a parrot inside says "Fair day! Fair day!" with great conviction.']);
  P.house('library', 'The Gilt Library', 100, 11.5, {
    width: 6, depth: 4.5, stories: 2, wall: 'stone_brick', upperWall: 'stone_brick', roof: 'roof_slate', gableFront: true, chimney: false, shutters: false,
  }, ['A card in the window: "SILENCE. (This means you, the fair.)"'], { light: true });
  P.house('quillon', 'Quillon House', 93, FRONT.crown - 1.7, { width: 4.2, depth: 3.4, wall: 'brick', roof: 'roof_slate' },
    ['The brass knocker is shaped like a quill. Knocking with it leaves a small ink stain on your knuckles.']);
  P.house('watch_house', 'The Watch House', 116, 11, {
    width: 5.5, depth: 4, stories: 2, wall: 'stone_brick', upperWall: 'stone_brick', roof: 'roof_slate', chimney: true, shutters: false, doorHood: true,
  }, ['A duty roster is nailed to the door. Somebody has written "FAIR DAY — EVERYONE" across all of it.']);
  P.torch(113.6, 13.12, S_, 2.3);
  P.house('almsfield', 'Almsfield House', 106.2, FRONT.crown - 1.7, { width: 3.6, depth: 3.2, wall: 'plaster', roof: 'roof_thatch' },
    ['A cheerful voice: "Come back after the bell! We are all down at the fair until then — even the kettle."']);
  // the Watch yard: practice posts, the gate to the Lookout
  P.crates(120.8, 17.4, 2, 0, 0.8); P.barrel(110.6, 16.2); P.barrel(111.4, 16.6, { height: 0.85 });
  P.hay(121, 20.6, 0.7);
  P.sign(112.4, 21.7, ['↘ {The Lookout} over the {Gild Pool}\n↙ the {Harbour Stair} down to the {North Quay}'], { rotation: -0.15 });

  // Pippin Orchard, west of the stream
  P.house('pippin', 'Pippin Cottage', 12, FRONT.crown - 1.7, { width: 4.5, depth: 3.4, wall: 'log_wall', roof: 'roof_thatch', woodpile: true },
    ['Apple-crates are stacked high by the door. A note: "Gone to sell apples. Take one, leave a coin. — H."']);
  const orchard = new RNG('gildhaven:orchard');
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      const x = 5.6 + c * 3.3 + (r % 2 ? 1.6 : 0);
      const z = 5.8 + r * 3.2;
      if (x > 21.5) continue;
      P.tree(orchard.chance(0.7) ? 'oak' : 'autumn', x + orchard.range(-0.3, 0.3), z + orchard.range(-0.25, 0.25), orchard.range(3.4, 4.8));
    }
  }
  P.crates(16.2, 19.8, 2, 0.1, 0.75); P.barrel(17.8, 21.4, { height: 0.9 }); P.hay(6.4, 20.4, 0.75);
  P.sign(7.4, 22.3, ['{Pippin Orchard}\nApples for the fair: take one, leave a coin.'], { boards: 1, rotation: 0.1 });

  // the Hall Bridge carries Crown Walk over the stream
  P.bridge('hall_bridge', STREAM.i0 - 1.4, 24.5, STREAM.i1 + 2.4, 24.5, 2.6, LV.HIGH * 0.5, 0.2, { name: 'Hall Bridge' });

  // the Rampart Walk: lawns, benches looking over the town, the railing along the terrace edge
  for (const x of [8, 20, 34, 56, 75, 88, 104]) P.bench(x, 27.6, S_, 1.8);
  for (const x of [14, 27, 41, 58.5, 69.5, 82, 99, 110]) P.lamp(x, 26.4, 'top');
  for (const x of [11, 24, 38, 72, 85, 108]) P.flowers(x + 2.8, 28.3, S_, 1.4);
  for (const [x0, x1] of [[4.2, 20], [20, 36], [36, 45.6], [51.4, 61.6], [66.4, 80], [80, 93.6], [97.4, 109], [109, 120]]) P.fence(x0, 31.85, x1, 31.85);
  // the Lookout over the harbour
  P.bench(114, 29.4, S_, 1.6);
  P.sign(118.6, 29.1, ['↓ the {Gild Pool} · the {Boathouse}\n← {Crown Walk} · {Sunspire Abbey}'], { rotation: -0.1 });
  P.emit('petals', 60, 20, [40, 4, 16], 40, 2.6);
  P.emit('petals', 13, 12, [18, 4, 16], 30, 3);
  P.critters('abbey_doves', 'bird', 61, 19.6, 4, 1.8, { seedBase: 400, spotOffsets: [[-0.8, 0.2], [0.6, -0.3], [1.4, 0.6], [-1.6, -0.4]] });
  P.critters('watch_dog', 'dog', 116, 18.6, 1, 3.2, { seedBase: 41 });
  P.critters('orchard_birds', 'bird', 14.4, 23.4, 3, 1.4, { seedBase: 430 });
}

/** The Gildfall, its pool and the Mistbridge, the North Quay, Kingsbridge and Saltbridge. */
function river() {
  P.waterfall('gildfall', 48.5, EDGE + 1, 3, 'S', { mist: { count: 26, alpha: 0.09 } });
  P.emit('mist', 48.5, 35.5, [9, 1.8, 6], 22, 0.4);
  P.emit('sparkle', 48.5, 35, [8, 0.5, 5], 10, 0.3, { params: { life: [0.5, 1.1] } });
  P.bridge('mistbridge', POOL.i0 - 0.45, 38.5, POOL.i1 + 1.45, 38.5, 2, 1.0, 0.3, { name: 'Mistbridge' });
  P.bridge('kingsbridge', AXIS, 38.35, AXIS, 44.65, 3.4, 1.0, 0.3, { name: 'Kingsbridge' });
  P.bridge('saltbridge', 91.5, 38.35, 91.5, 44.65, 2.2, 1.0, 0.24, { name: 'Saltbridge' });
  P.emit('fireflies', 72, 41.5, [54, 2.2, 6], 40, 0.8);

  // the North Quay: warehouses and offices against the terrace wall
  rowS(FRONT.quay, [
    ['salt_store', 'The Salt Store', 58.6, 5, 3, { wall: 'wood_planks_dark', roof: 'roof_slate', chimney: false, shutters: false },
      ['Locked. Through a crack: sacks of salt piled to the rafters, and a cat asleep on the highest one.']],
    ['customs_house', 'The Customs House', 72, 6, 3.2, { wall: 'brick', roof: 'roof_blue', sign: true, doorHood: true },
      ['A sign: "ALL BARGES TO DECLARE ALL CARGO. Including cheese. ESPECIALLY cheese."'], { light: true }],
    ['boatyard', "Tamsin's Boatyard", 81.4, 5, 3, { wall: 'wood_planks', roof: 'roof_thatch', woodpile: true, shutters: false },
      ['The smell of pitch and sawdust. Somebody inside is singing to a boat. The boat does not seem to mind.']],
    ['harbour_office', 'The Harbour Office', 87.6, 4, 3, { wall: 'plaster', roof: 'roof_red' },
      ['"Back in five minutes," says the note. It has said so since this morning.']],
  ]);
  P.torch(AXIS - 2.6, EDGE + 1.12, S_, 2.2); P.torch(AXIS + 2.6, EDGE + 1.12, S_, 2.2);
  for (const x of [57, 69, 77, 85, 97.6]) P.lamp(x, 38.7, 'top');
  P.barrel(67.2, 33.4); P.barrel(67.4, 34.4, { height: 0.85 }); P.barrel(75.8, 33.6, { height: 0.9 });
  P.crates(91.8, 33.4, 3, 0, 0.75); P.barrel(98.8, 33.4, { lying: true, rotation: 0.3 }); P.barrel(98.6, 34.6, { height: 0.85 });
  P.crate(55.2, 33.2, 0.7);
  P.critters('quay_cat', 'cat', 70.5, 37.4, 1, 2.6, { seedBase: 21 });
  P.sign(61.6, 38.7, ['↑ the {Grand Stair} · {Sunspire Abbey}\n← the {Gildfall} · → the {Harbour Stair}'], { rotation: 0.15 });
}

/**
 * The Market Square's stalls (facing south): [id, x, z, awning, the side their keeper stands on:
 * +1 east / -1 west].
 * @type {[id: string, x: number, z: number, cloth: string, side: number][]}
 */
const STALLS = [
  ['stall_fish', 51, 48.6, 'cloth_stripe', -1],
  ['stall_spice', 56.5, 48.6, 'cloth_red', 1],
  ['stall_bread', 71.5, 48.6, 'cloth_stripe', -1],
  ['stall_cloth', 77, 48.6, 'cloth_red', 1],
  ['stall_pots', 52.5, 55.4, 'cloth_red', -1],
  ['stall_eggs', 58, 55.4, 'cloth_stripe', 1],
  ['stall_flowers', 70, 55.4, 'cloth_red', -1],
  ['stall_cheese', 75.5, 55.4, 'cloth_stripe', 1],
];
const STALL_W = 3.2;
/** Where a stall's keeper stands: beside the counter, toward the aisle (visible, unlike behind it). */
const keeperSpot = ([, x, z, , side]) => [x + side * (STALL_W / 2 + 0.55), z + 0.55];

/** The Market Square on the river: the Gild Well, the stalls, the poultry corner, the Gilded Goose. */
function square() {
  P.well('gild_well', WELL.x, WELL.z, [
    'The {Gild Well}. They say the first barge-folk washed gold dust out of the river here, and the town was named for it.',
    'The water glints. Probably the sun. Probably.',
  ], 'roof_slate');
  P.light(WELL.x, WELL.z + 0.6, { dy: 2.6, color: '#ffc47a', intensity: 7, distance: 7.5, flicker: 0.12 }); // fair lanterns over the well
  // (the crates beside each stall stand on the side away from its keeper)
  for (const [id, x, z, cloth, side] of STALLS) P.add('marketStall', { id, x, z, rotation: S_, opts: { cloth, width: STALL_W, seed: P.nextSeed(), crates: side > 0 ? 'left' : 'right' } });
  // stock beside the stalls
  P.crate(48.6, 47.6, 0.7); P.barrel(58.6, 47.2, { height: 0.9 }); P.crates(67.6, 47.4, 2, 0, 0.7); P.barrel(79.2, 47.4);
  P.barrel(50.4, 57.6, { height: 0.85 }); P.crate(59.9, 57.8, 0.7); P.crate(68.2, 57.9, 0.75); P.barrel(77.6, 57.7, { height: 0.9 });
  // benches on the quay edge, looking at the river; lamps
  P.bench(55, 44.75, N_, 1.8); P.bench(73, 44.75, N_, 1.8);
  for (const [x, z] of [[47.4, 44.6], [60.6, 44.6], [67.4, 44.6], [80.6, 44.6], [47.4, 58.4], [80.6, 58.4]]) P.lamp(x, z, 'top');
  P.sign(67.6, 58.2, ['{Gildhaven} — Gild Fair today!\n↑ {High Town} · ↓ {Fairfield} and the {South Gate}\n← the {West Quarter} · → the {Gild Pool}'], { boards: 3, rotation: -0.2, id: 'sign_square' });
  P.critters('square_pigeons', 'bird', WELL.x, WELL.z + 2.3, 6, 2.2, { seedBase: 300, spotOffsets: [[-1.4, 0.2], [1.2, 0.4], [-0.4, 0.9], [2.0, -0.2], [0.6, 1.2], [-2.2, 0.6]] });
  P.critters('poultry', 'chicken', 61.2, 58, 4, 1.4, { seedBase: 60, area: { minX: -2.2, maxX: 1.8, minZ: -1.2, maxZ: 0.4 } });
  P.emit('dust', WELL.x, 51, [34, 3, 14], 40, 1.4);

  // the Gilded Goose faces the square from the west
  // (no chimney: its stack would hide the Undercliff Walk behind the inn)
  P.house('gilded_goose', 'The Gilded Goose', 43.4, 55, {
    width: 6, depth: 4.5, stories: 2, wall: 'plaster', upperWall: 'timber_frame', roof: 'roof_red', sign: true, doorHood: true, chimney: false,
  }, ['Laughter, a fiddle and the smell of roast apples spill out of {The Gilded Goose}.', 'Above the door hangs a goose of beaten gold leaf. It has been stolen eleven times. It always comes back.'], { rotation: E_, light: true });
  P.barrel(44.4, 50.9); P.barrel(45.3, 51.1, { height: 0.85 }); P.bench(44.6, 48.6, E_, 1.4, false);
}

/** The West Quarter — the Undercliff (the mill, the ropewalk), the craft row on Market Street, the smithy. */
function westQuarter() {
  rowS(FRONT.quay, [
    ['ropewalk', 'The Ropewalk', 14, 6, 3, { wall: 'wood_planks_dark', roof: 'roof_thatch', chimney: false, shutters: false },
      ['A long shed full of hemp and twisting rope. "Mind your fingers," calls a voice, "or you become rope."']],
    ['cliffside', 'Cliffside Cottage', 26, 4, 3, { wall: 'stone_brick', roof: 'roof_slate' },
      ['A cosy voice: "We can hear the Gildfall from our beds. We have not had a dry pillow since the spring."']],
    ['gildfall_mill', 'Gildfall Mill', 38, 5, 3.5, { wall: 'wood_planks', roof: 'roof_thatch', woodpile: true, shutters: false },
      ['Flour dust puffs out under the door. The millstones rumble like a giant clearing its throat.']],
  ]);
  P.sign(40.2, 40.6, ['→ the {Mistbridge} to the {North Quay}\n↓ {Mill Lane} to {Market Street}'], { rotation: -0.15 });
  P.lamp(30.6, 40.5, 'top'); P.lamp(18.6, 40.5, 'top');
  P.crates(32.4, 33.6, 2, 0, 0.75); P.barrel(41.6, 33.4); P.hay(20.8, 33.6, 0.7);

  rowS(FRONT.market, [
    ['carpentry', "Joss Plane's Carpentry", 9, 5, 3.5, { wall: 'wood_planks', roof: 'roof_thatch', woodpile: true, sign: true },
      ['Sawdust drifts from the door. A half-finished rocking horse stares at you with one painted eye.']],
    ['tannery', 'The Tannery', 15.6, 4.4, 3.4, { wall: 'log_wall', roof: 'roof_thatch', shutters: false },
      ['A smell hits you before the door does. You decide not to knock twice.']],
    ['barrelhouse', 'The Barrelhouse', 22.3, 6, 4, { stories: 2, wall: 'brick', upperWall: 'timber_frame', roof: 'roof_red', sign: true, doorHood: true },
      ['Barrels rumble somewhere inside. A cheerful bellow: "We are OPEN, it is FAIR DAY, and the ale is BROWN!"'], { light: true }],
    ['dyeworks', 'The Dye Works', 28.6, 4.4, 3.4, { wall: 'plaster', roof: 'roof_blue' },
      ['Blue, gold and red cloth hangs drying inside. The dyer\'s hands are, you suspect, all three colours.']],
  ]);
  // the smithy stands back from Market Street, its open forge in the yard
  P.house('smithy', 'Hammerstane Smithy', 37.6, 54.65, { width: 4.6, depth: 3.5, wall: 'stone_brick', roof: 'roof_slate', woodpile: true, doorOffset: -1.2 },
    ['The ring of a hammer stops. "If you want a horseshoe, wait. If you want a sword, wait longer. If you want to chat, Rurik is outside."']);
  P.fire(39.7, 57.9, { rotation: 0.3, id: 'forge' });
  P.emit('smoke', 39.7, 57.9, [1, 2.4, 1], 6, 2.2);
  P.emit('embers', 39.7, 57.9, [1.4, 1.6, 1.4], 10, 0.8);
  P.torch(35.8, 56.52, S_, 2.1, { embers: true });
  P.crates(17.2, 50.6, 2, 0.1, 0.8); P.barrel(24.6, 51.8, { lying: true, rotation: 0.9 }); P.barrel(19.6, 51.6);
  P.barrel(7, 52.6, { height: 0.9 }); P.crate(11.6, 52.8, 0.75);
  for (const x of [12.2, 25.8, 36]) P.lamp(x, 58.65, 'top');
  P.critters('inn_cat', 'cat', 40, 46.6, 1, 2.6, { seedBase: 7 });
  P.emit('leaves', 22, 46, [30, 4, 10], 22, 2.6);
}

/** The East Quarter and Barge Quay — the chandlery, the saltcellar, the barge yard. */
function eastQuarter() {
  rowS(FRONT.market, [
    ['chandlery', 'Odd & Sons, Chandlers', 86.4, 5, 3.5, { wall: 'timber_frame', roof: 'roof_red', sign: true },
      ['Rope, tar, candles, nails, a stuffed pike and, for some reason, a harp. "We have everything," says the sign. It may be right.']],
    ['saltcellar', 'The Saltcellar', 93.2, 4.6, 3.5, { wall: 'plaster', roof: 'roof_slate' },
      ['A bargeman\'s home. Somebody inside is snoring in time with the river.']],
  ]);
  // the barge yard: goods stacked off the quay
  P.crates(84.8, 49.6, 3, 0, 0.85); P.crates(90.4, 50.8, 2, 0.2, 0.8); P.barrel(94.4, 49.2); P.barrel(95.4, 50.1, { height: 0.85 });
  P.barrel(88.6, 46.6, { lying: true, rotation: 1.5 }); P.crate(96.6, 46.2, 0.75);
  for (const x of [84, 96.6]) P.lamp(x, 44.6, 'top');
  P.lamp(90, 58.65, 'top');
}

/** The Gild Pool — the piers, the fish quay with the smokehouse, the beach and the boathouse. */
function harbour() {
  P.bridge('pier_west', 104.5, 56.35, 104.5, 45, 1.8, 1.0, 0, { pier: true, name: 'West Pier' });
  P.bridge('pier_east', 111.5, 56.35, 111.5, 42, 1.8, 1.0, 0, { pier: true, name: 'East Pier' });
  P.stall(108, 57.2, S_, 'cloth_stripe');
  P.stall(101.6, 57.2, S_, 'cloth_red', 2.6);
  P.fire(119.4, 57.4, { rotation: 0.4, id: 'smokehouse_fire' });
  P.emit('smoke', 119.4, 57.4, [1.2, 2.6, 1.2], 7, 2.4);
  P.crates(122, 56.6, 2, 0.3, 0.75); P.barrel(116.8, 56.8, { height: 0.9 });
  P.house('boathouse', 'The Boathouse', 121.2, 46.2, { width: 5, depth: 3.4, wall: 'wood_planks_dark', roof: 'roof_thatch', chimney: false, shutters: false },
    ['Upturned boats inside, and a dozen oars, and a gull that very clearly lives here now.'], { rotation: W_ });
  P.barrel(121.6, 41.2, { lying: true, rotation: 0.2 }); P.crate(122.4, 51.4, 0.7);
  for (const x of [103.6, 113.4, 121]) P.lamp(x, 58.7, 'top');
  P.critters('harbour_gulls', 'bird', 110, 57.8, 5, 2.2, { seedBase: 340 });
  P.emit('mist', 108, 44, [16, 1.4, 20], 18, 0.4);
  P.sign(99.6, 56.8, ['→ the {Fish Quay} · the {Piers} · the {Boathouse}\n← the {Market Square}'], { rotation: 0.1 });
}

/** The two rows of homes and shops on Lantern Row and Weaver's Lane, Bellgreen, the gate square. */
function rows() {
  rowS(FRONT.lantern, [
    ['wheelwright', "The Wheelwright's", 7.8, 4.6, 3.4, { wall: 'wood_planks', roof: 'roof_thatch', woodpile: true },
      ['A wheel leans by the door, waiting for its cart. It looks like it has been waiting a while.']],
    ['cobbler', "Pegg's Cobblery", 13.6, 4, 3, { wall: 'timber_frame', roof: 'roof_red', sign: true },
      ['A sign in the window: "Shoes mended. Boots mended. Hearts not mended, try the Abbey."']],
    ['potter', "The Potter's House", 19.4, 4.6, 3.4, { wall: 'plaster', roof: 'roof_thatch' },
      ['A wheel hums inside. A pot slumps. Somebody sighs, then laughs, then starts again.']],
    ['rosehip', 'Rosehip Cottage', 25.2, 4.4, 3.2, { wall: 'brick', roof: 'roof_blue' },
      ['Roses climb all the way to the chimney. A voice: "If you have come about the roses, they are not for sale. They are for showing off."']],
    ['bakery', 'The Saffron Bakery', 35.4, 5, 3.5, { wall: 'timber_frame', roof: 'roof_red', sign: true, doorHood: true },
      ['The door is warm. Behind it: saffron, butter and a very busy oven.'], { light: true }],
    ['apothecary', 'The Apothecary', 41.8, 4.4, 3.4, { wall: 'stone_brick', roof: 'roof_slate', sign: true },
      ['Bottles of every colour line the window. One of them is gently bubbling. You decide not to ask.']],
    ['tailor', 'Needle & Thimble', 52, 5, 3.5, { wall: 'plaster', roof: 'roof_red', sign: true },
      ['A dummy in the window wears half a very fine coat. The other half is presumably on its way.']],
    ['scribe', "The Scrivener's", 58.4, 4.2, 3.2, { wall: 'timber_frame', roof: 'roof_blue' },
      ['"Letters written, read, and — for a small extra fee — improved."']],
    ['clockmaker', 'Tick & Tock, Clockmakers', 69.6, 4.6, 3.4, { wall: 'brick', roof: 'roof_slate', sign: true },
      ['Dozens of clocks tick inside, none of them together. It is, apparently, every time at once.']],
    ['toymaker', "The Toymaker's", 76.2, 5, 3.5, { wall: 'plaster', roof: 'roof_red', doorHood: true },
      ['A wooden soldier in the window salutes as the door creaks. Clever springs.'], { light: true }],
    ['cooperage', 'The Cooperage', 87, 5, 3.5, { wall: 'wood_planks', roof: 'roof_thatch', woodpile: true },
      ['Hoops and staves everywhere. A half-made barrel rocks gently, like it is thinking about rolling off.']],
    ['lanterns', "Wick's Lantern Shop", 93.6, 4.6, 3.4, { wall: 'timber_frame', roof: 'roof_red', sign: true },
      ['Lanterns of every size hang in the window, waiting for dusk like children waiting for a story.'], { light: true }],
    ['net_loft', 'The Net Loft', 103.8, 4.6, 3.4, { wall: 'wood_planks_dark', roof: 'roof_slate', shutters: false },
      ['Nets drying in great brown waves. It smells of the sea, and slightly of someone\'s lunch.']],
    ['gullscry', "Gullscry Cottage", 109, 3.6, 3, { wall: 'plaster', roof: 'roof_blue' },
      ['A very small cottage with a very large door knocker, as if to make up for it.']],
    ['brine_house', 'Brine House', 118.8, 5, 3.4, { wall: 'stone_brick', roof: 'roof_slate' },
      ['The harbourmaster\'s house. A brass telescope pokes out of the upstairs window, though there is no upstairs.']],
  ]);
  rowS(FRONT.weaver, [
    ['weaver', "The Weaver's House", 35.6, 5, 3.5, { wall: 'plaster', roof: 'roof_red', doorOffset: 1.1 },
      ['The clack of a loom. A voice counts "...forty-one, forty-two, forty — oh, BOTHER."']],
    ['hollyhock', 'Hollyhock House', 42, 4.2, 3.2, { wall: 'timber_frame', roof: 'roof_thatch' },
      ['Hollyhocks by the door, taller than you. They nod as if they know you.']],
    ['widow_fenn', "Widow Fenn's", 52.4, 4.6, 3.4, { wall: 'brick', roof: 'roof_red' },
      ['"Come in if you are a grandchild, go away if you are selling something, and wipe your feet either way."']],
    ['gatehouse', 'The Gate Watch', 58.4, 4.4, 3.2, { wall: 'stone_brick', roof: 'roof_slate', chimney: false },
      ['Empty. A kettle on the hob and two mugs, both labelled "SERGEANT".']],
    ['chandler_wick', 'Candlewick Cottage', 70, 4.6, 3.4, { wall: 'plaster', roof: 'roof_blue' },
      ['The whole house smells of beeswax. Even the doorknob is slightly sticky.']],
    ['hearthstone', 'Hearthstone House', 76.4, 5, 3.4, { wall: 'stone_brick', roof: 'roof_red', woodpile: true },
      ['A big family by the sound of it, all of them looking for the same left shoe.']],
    ['dame_school', 'The Dame School', 88.4, 6.4, 3.5, { wall: 'brick', roof: 'roof_slate', doorHood: true, sign: true },
      ['Closed for the fair. A slate by the door reads: "NO SCHOOL TODAY. Yes, really. Go away. — Dame Agnes"']],
    ['herbalist', "Sorrel's Herbs", 95, 3.6, 3, { wall: 'timber_frame', roof: 'roof_thatch' },
      ['Bundles of drying herbs hang so thick inside that the room looks like a little forest.']],
    ['bathhouse', 'The Bathhouse', 106, 7, 3.5, { wall: 'stone_brick', roof: 'roof_blue', chimney: true, shutters: false, doorHood: true },
      ['Warm steam curls out under the door. "Baths half price on fair day," says the slate. "Soap extra. Singing free."'], { light: true }],
    ['shrine', 'Shrine of the Tide', 118.6, 4.4, 3.4, { wall: 'stone_brick', roof: 'roof_slate', chimney: false, shutters: false },
      ['Shells and smooth stones line the doorstep: offerings for boats that come home, and for some that did not.']],
  ]);
  P.light(118.6, FRONT.weaver - 1.7, { dy: 2, color: '#9fd8ff', intensity: 5, distance: 6.5, flicker: 0.3 }); // the shrine's sea-glass lamps
  // Bellgreen: the little green at the west end of the rows
  // (the oak stands in the green's south-west corner: its crown hides only the corner behind it)
  P.tree('oak', 5.8, 86.2, 4.6);
  P.bench(9.4, 87.8, S_, 1.8); P.bench(21.4, 87.8, S_, 1.8); P.bench(25.8, 81.8, W_, 1.6);
  P.flowers(6.6, 78.2, S_, 1.6); P.flowers(23.6, 78.2, S_, 1.2);
  P.lamp(7.4, 88.6, 'top'); P.lamp(27.4, 88.4, 'top');
  P.critters('bellgreen_cats', 'cat', 17, 81, 2, 3, { seedBase: 33 });
  P.emit('leaves', 15, 84, [16, 4, 10], 20, 3);
  P.sign(27.4, 78.4, ['{Bellgreen}\nPlease do not climb the oak. (It means you, Kit.)'], { boards: 1, rotation: -0.1 });
  // street lamps along the rows (the arm reaches over the street)
  for (const x of [10.8, 30.9, 45.6, 61.6, 66.4, 80.6, 97.6, 111.6]) P.lamp(x, FRONT.lantern + 0.05, 'S');
  for (const x of [30.9, 45.6, 61.6, 66.4, 80.6, 97.6, 111.6]) P.lamp(x, FRONT.weaver + 0.05, 'S');
  // inside the South Gate
  P.flowers(60.6, 93.4, S_, 1.6); P.flowers(67.4, 93.4, S_, 1.6);
  P.torch(59, WALL.j0 - 1.12, N_, 2.4); P.torch(68, WALL.j0 - 1.12, N_, 2.4);
  // the allotments between Weaver's Lane and the wall
  for (const [i0, j0, i1] of ALLOTMENTS) P.fence(i0 + 0.1, j0 - 0.15, i1 + 0.9, j0 - 0.15);
  P.hay(26.4, 94, 0.7); P.barrel(98.4, 93.6, { height: 0.9 }); P.crates(121.6, 93.6, 2, 0.1, 0.7);
  P.critters('allotment_hens', 'chicken', 28, 93.8, 3, 1.4, { seedBase: 80 });
}

/** Fairfield — the gate, the fairground and the players, the mill on its knoll, Barlow's Farm. */
function fairfield() {
  P.torch(59, WALL.j1 + 2.12, S_, 2.4); P.torch(68, WALL.j1 + 2.12, S_, 2.4);
  P.sign(67.4, 113.6, ['↑ {Gildhaven} · the {South Gate}\n← {Fairfield Mill} · {Barlow\'s Farm}\n→ the {Fairground}'], { boards: 3, rotation: -0.2, id: 'sign_road' });
  for (const z of [102, 114]) { P.lamp(AXIS - 2.7, z, 'top'); P.lamp(AXIS + 2.7, z, 'top'); }
  // two old pines by the King's Road: the only pines near the spawn, so the load-time warm-up
  // compiles the pine's shadow program (the woods round Fairfield have none; without these it was
  // compiled on the first walk into High Town, whose border woods are pines)
  P.tree('pine', 71.6, 119.8, 5.6); P.tree('pine', 70.2, 116.4, 4.8);
  // the fairground: the stage, the audience, stalls, the players' camp
  P.fire(99.4, 106.8, { seat: true, rotation: 0.9, id: 'campfire_players' });
  P.emit('smoke', 99.4, 106.8, [1.2, 2.4, 1.2], 6, 2.4);
  P.bench(84.6, 107.7, N_, 1.8); P.bench(91.4, 107.7, N_, 1.8);
  P.crates(94.6, 101.4, 2, 0.2, 0.8); P.barrel(82.4, 101.4); P.barrel(82.6, 102.6, { height: 0.85 });
  P.stall(78.6, 111, S_, 'cloth_red', 3, 'right'); // Hetty stands on the left, Rosalind on the right
  P.stall(84, 112.6, S_, 'cloth_stripe', 3, 'left');
  P.hay(96.6, 116.4, 1); P.hay(100.2, 117.6, 0.85); P.hay(103.4, 115.6, 0.9); P.hay(93.4, 118.2, 0.8);
  P.crates(102.6, 102.4, 2, -0.2, 0.75); P.barrel(104.2, 104.2, { lying: true, rotation: 1.1 });
  P.lamp(76.8, 106.4, 'top'); P.lamp(95.2, 108.8, 'top'); P.lamp(81.2, 115.6, 'top');
  P.critters('fair_dog', 'dog', 92, 113.6, 1, 4, { seedBase: 52 });
  P.emit('dust', 89, 111, [30, 3, 16], 30, 1.2);
  P.emit('petals', 88, 104, [12, 3, 4], 16, 3.2);
  // Fairfield Mill on its knoll between the wall and Mill Lane (north of the lane: it hides nobody on it)
  P.add('windmill', { id: 'fairfield_windmill', x: 27.6, z: 102, rotation: 0.35, opts: { height: 6.6, roof: 'roof_thatch' } });
  P.house('quern_cottage', 'Quern Cottage', 36.6, 102.6, { width: 4.2, depth: 3, wall: 'plaster', roof: 'roof_thatch', woodpile: true },
    ['Flour on the doorstep, flour on the knocker, flour on you now.']);
  P.hay(32.2, 105.4, 0.8); P.crates(40.8, 101.6, 2, 0.2, 0.75);
  // Barlow's Farm
  P.house('barlow_farm', "Barlow's Farmhouse", 14, 101.3, { width: 5, depth: 3.4, wall: 'log_wall', roof: 'roof_thatch', woodpile: true },
    ['"BARLOW\'S EGGS — the best in Fairfield" is painted over the door. Underneath, smaller: "the only in Fairfield".']);
  P.hay(20.4, 101.4, 1.0); P.hay(5.6, 101.6, 0.8);
  P.fence(5.2, 109.4, 24.6, 109.4);
  P.critters('farm_hens', 'chicken', 14, 105, 5, 2.4, { seedBase: 90, area: { minX: -7, maxX: 7, minZ: -1.4, maxZ: 1.4 } });
  P.critters('farm_dog', 'dog', 25, 105.4, 1, 3, { seedBase: 61 });
  P.emit('fireflies', 12.5, 118.5, [10, 2, 8], 24, 0.8);
  P.emit('petals', 32, 103, [36, 4, 8], 30, 2.8);
}

// =============================================================================================
// 2b. People — the fair-day crowd (dialogue directions follow the map: ↑ north is High Town)
// =============================================================================================

function people() {
  const { npc, ask } = P;
  // ---- the South Gate and Fairfield
  npc('brask', 'Sergeant Brask', 'guard', 59.6, 100.4, '#6a8fd6', [
    'Welcome to {Gildhaven}, traveller. Gild Fair today, so the gate stands open and my patience stands closed.',
    'Market Square is straight up {Main Street}. Fair stalls, the players and the mill are out here in {Fairfield}.',
  ], { wander: 0.3, speed: 0.8, behaviour: 'post', facing: 'right' });
  npc('lisbet', 'Corporal Lisbet', 'guard', 68.4, 100.4, '#6a8fd6', [
    'The sergeant counts everyone who comes in. I count everyone who goes out. We have never once agreed.',
    'If you see a little boy with a toffee apple and no shoes, that is {Nim}. He is fine. He is always fine.',
  ], { wander: 0.3, speed: 0.8, behaviour: 'post', facing: 'left' });
  npc('florin', 'Florin Fiddlewick', 'bard', 87.5, 102.4, '#c9a45c', [
    'Ah, an audience! The {Wandering Lark Players}, at your service — songs, dances, and one juggler who is mostly reliable.',
    'We play the Gild Fair every year. The town pays us in pies, and the pies are worth the walk.',
  ], { wander: 0.3, speed: 0.8, behaviour: 'perform', action: 'music' });
  npc('mirela', 'Mirela', 'dancer', 85.4, 102.8, '#e27aa8', [
    'Clap on the off-beat, if you please. Florin is always half a beat ahead, and somebody has to drag him back.',
    'After the fair we follow the {King\'s Road} south. Next week, a wedding. Then a funeral. Then another wedding. Busy season.',
  ], { wander: 0.4, speed: 0.8, behaviour: 'perform' });
  npc('corwin', 'Corwin the Juggler', 'traveler', 89.8, 102.8, '#e0a85a', [
    'Three apples, two knives and a turnip. The turnip is the dangerous one. Nobody expects the turnip.',
  ], { wander: 0.3, speed: 0.8, behaviour: 'perform' });
  npc('hetty', 'Hetty Bramble', 'farmer', ...keeperOf(78.6, 111, -1), '#d9776a', [
    'Toffee apples! Dipped this morning, sticky till midnight.',
    'The apples come from {Pippin Orchard} up in {High Town}. The toffee comes from me. The teeth are your own business.',
    ask('One for the walk?', 'Not just now', 'Yes, please'),
  ], { wander: 0.3, speed: 0.8, behaviour: 'post', facing: 'right', action: 'shop', item: 'Toffee Apple' });
  npc('rosalind', 'Rosalind', 'dancer', ...keeperOf(84, 112.6, 1), '#a7c7e7', [
    'Fair ribbons! Tie one on your wrist and the music finds you. That is the custom. Or I made it up. One of those.',
    ask('Blue to match the river?', 'Just looking', 'One ribbon'),
  ], { wander: 0.3, speed: 0.8, behaviour: 'post', facing: 'left', action: 'shop', item: 'Fair Ribbon' });
  npc('edda', 'Edda', 'farmer', 86.2, 106.4, '#cfb25a', [
    'I walked in from the farms at dawn for this. My feet hurt and I would not be anywhere else.',
  ], { wander: 0.3, speed: 0.8, behaviour: 'post', facing: 'up' });
  npc('ambrose', 'Old Ambrose', 'elder', 90.2, 106.4, '#9ab0d8', [
    'Sixty-one Gild Fairs I have seen. The players get younger every year. The juggler never gets better.',
    'Wonderful, isn\'t it?',
  ], { wander: 0.2, speed: 0.6, behaviour: 'post', facing: 'up' });
  npc('wayfarer', 'Daro the Wayfarer', 'traveler', 62.6, 110.6, '#78b35b', [
    'Came up the {King\'s Road} from the coast. You can smell the fair from a mile off — toffee, woodsmoke and cattle.',
    'Mind you, the town is the real sight. The Abbey up on the rock, the falls coming off the cliff... worth the blisters.',
  ], { wander: 1.6, speed: 0.9 });
  npc('barlow', 'Farmer Barlow', 'farmer', 19.6, 106.2, '#cfb25a', [
    'Barlow\'s the name, eggs are the game. Brown eggs, white eggs, and one blue egg nobody can explain.',
    'If you catch my boy {Nim} chasing the hens again, tell him supper is when the {Sunspire Bell} rings.',
  ], { wander: 1.8, speed: 0.9 });
  npc('nim', 'Nim', 'child', 12, 105.6, '#f5a07a', [
    'I am not CHASING them. I am HERDING them. There is a difference and the difference is I am winning.',
  ], { wander: 3, speed: 1.6, behaviour: 'chase', area: { minX: -6.4, maxX: 6.4, minZ: -2, maxZ: 1.4 } });
  npc('tobias', 'Tobias Quern', 'elder', 40.6, 105.4, '#e0c68e', [
    'Fairfield Mill grinds for half the valley. On fair day, it grinds for the bakers, and the bakers grind me.',
    'Down in town there\'s an older mill, under the {Gildfall}. Runs on water, not wind. Show-off.',
  ], { wander: 1.2, speed: 0.7 });

  // ---- the Market Square
  npc('bertil', 'Crier Bertil', 'elder', WELL.x + 2.6, WELL.z + 0.4, '#c9a45c', [
    'HEAR YE, HEAR YE! The Gild Fair is OPEN! Stalls on the square, players in {Fairfield}, and fish on the {Fish Quay}!',
    'At dusk the {Sunspire Bell} rings the fair closed, and the Lord Mayor lights the lanterns along the river. Bring a coat. And a sweetheart, if you have one going spare.',
    ask('Any questions?', 'No, thank you', 'Who is the Lord Mayor?'),
    'Lady {Odelia Fairgild}. She receives in the court of {Gildhaven Hall} on fair day — up the {Grand Stair} and west along {Crown Walk}, over the Hall Bridge.',
  ], { wander: 0.4, speed: 0.7, behaviour: 'post', facing: 'down' });
  const stallFolk = [
    ['dora', 'Dora Haddock', 'innkeeper', '#7fb5d6', [
      'Fresh this morning! Gild trout, river eels, and a pike so ugly it frightened the cat.',
      ask('Take a trout home?', 'Not today', 'One trout'),
    ], 'Gild Trout'],
    ['azar', 'Azar', 'merchant', '#e0a85a', [
      'Saffron, pepper, cinnamon bark — all the way up the river by barge, all the way from the sea.',
      'One pinch of my saffron and the bakers of {Lantern Row} fight in the street. I have seen it. I sold them tickets.',
      ask('A pinch of saffron?', 'Just looking', 'A pinch'),
    ], 'Pinch of Saffron'],
    ['pim', 'Pim Crumble', 'villager', '#e0b070', [
      'Bread! Bread! Bread with seeds, bread without seeds, bread shaped like a goose for the fair.',
      ask('A goose loaf?', 'Maybe later', 'One goose loaf'),
    ], 'Goose Loaf'],
    ['vell', 'Signora Vell', 'merchant', '#a07ad6', [
      'River-blue cloth, dyed in the {West Quarter} and fit for a duchess. Feel it. No — gently. GENTLY.',
      ask('A length for a cloak?', 'Just admiring', 'A length, please'),
    ], 'River-Blue Cloth'],
    ['ottilie', 'Ottilie Clay', 'villager', '#b8835c', [
      'Cups, jugs, and a teapot that pours almost entirely into the cup. Almost.',
      ask('Something for the kitchen?', 'Not today', 'A clay cup'),
    ], 'Clay Cup'],
    ['goodman_hen', 'Goodman Hollis', 'farmer', '#cfb25a', [
      'Eggs from Barlow\'s Farm, hens from my own yard. Those four by the stall are not for sale. They are staff.',
      ask('A dozen eggs?', 'No, thank you', 'A dozen'),
    ], 'Dozen Eggs'],
    ['daisy', 'Daisy', 'dancer', '#f2c14e', [
      'Marigolds for the fair! You wear them to the bell at dusk, then throw them in the river for luck.',
      ask('A posy?', 'Not today', 'One posy'),
    ], 'Marigold Posy'],
    ['brie', 'Master Brie', 'innkeeper', '#e8d27a', [
      'Cheese. Hard cheese, soft cheese, cheese that walks to you if you leave it long enough. Taste? It is free. The second taste is not.',
      ask('A wedge of Gild Blue?', 'I\'ll pass', 'One wedge'),
    ], 'Wedge of Gild Blue'],
  ];
  STALLS.forEach((s, k) => {
    const [id, name, preset, color, dialogue, item] = stallFolk[k];
    const [x, z] = keeperSpot(s);
    npc(id, name, preset, x, z, color, dialogue, { wander: 0.3, speed: 0.8, behaviour: 'post', facing: s[4] > 0 ? 'left' : 'right', action: 'shop', item });
  });
  npc('wenna', 'Mother Wenna', 'innkeeper', 47.8, 56.8, '#d9776a', [
    'Welcome to {The Gilded Goose}! Every room is full of fair-folk, but I always keep one bed aired for a traveller.',
    'The goose over the door? Real gold leaf. It gets stolen every year and it always comes back. I suspect it enjoys the trip.',
    ask('Tired already? Rest now and you\'ll miss the bell at dusk.', 'I\'ll stay up', 'Rest until morning'),
  ], { wander: 0.6, speed: 0.8, action: 'rest' });
  npc('garr', 'Garr the Bargeman', 'merchant', 60, 52.6, '#b85c38', [
    'Three days up the river from the sea, and every lock-keeper wanted a fair-day tip. My barge has gone back down without me. I stayed for the cheese.',
    'You should see the {Gild Pool} past the {Barge Quay} — gulls stealing everything that is not nailed down, and some things that are.',
  ], { wander: 3.4, speed: 0.9 });
  npc('wynn', 'Sister Wynn', 'cleric', 68, 52.2, '#a7c7e7', [
    'Bless you. I came down from {Sunspire Abbey} for cheese and came away with cheese, a ribbon and a goose loaf.',
    'Mother Celandine will ring the bell at dusk. Listen from the {Rampart Walk} — the whole town hums with it.',
  ], { wander: 3.2, speed: 0.8 });
  npc('tilda', 'Tilda', 'villager', 74, 52.4, '#d9a066', [
    'I have a list. Cheese, cloth, eggs, saffron. I have bought three ribbons. The list is not going well.',
  ], { wander: 3.8, speed: 1 });
  npc('beck', 'Beck', 'hunter', 56.2, 52.2, '#78b35b', [
    'Sold my furs by noon. Now I am just here for the crowd. And the bread. Mostly the bread.',
  ], { wander: 3.4, speed: 1 });
  npc('tilly', 'Tilly', 'child', 60.6, 46.4, '#f5a07a', [
    'I am counting pigeons. There are six. There were seven. I think one went to {High Town} to be fancy.',
    'Do you know {Kit}? Kit climbs the oak on {Bellgreen} even though there is a sign. There is a sign because of Kit.',
  ], { wander: 4, speed: 1.6 });
  npc('wren', 'Wren', 'child', 60.8, 57.4, '#e27aa8', [
    'Goodman Hollis says the hens are STAFF. So I am helping them do their job. Their job is running.',
  ], { wander: 2, speed: 1.6, behaviour: 'chase', area: { minX: -3, maxX: 2.6, minZ: -2.4, maxZ: 0.6 } });
  npc('dunn', 'Corporal Dunn', 'guard', 72, 60.6, '#6a8fd6', [
    'Keep your purse close today. Fair days bring three things to {Gildhaven}: farmers, players and fingers.',
    'If you lose something, the {Watch House} is up in {High Town}, east along {Crown Walk}. Captain Hale will be up at the {Lookout}, mind — she always is.',
  ], { wander: 4.2, speed: 0.9 });
  npc('fennick', 'Fennick', 'traveler', 80, 52.2, '#8e8e8e', [
    'Me? Just browsing. Admiring. Absolutely not counting anyone\'s purse.',
    'Lovely day. Lovely crowd. Lovely... heavy... cloth.',
  ], { wander: 2.6, speed: 1.1 });

  // ---- the North Quay and the river
  npc('old_salt', 'Old Salt Merrow', 'hunter', 60.2, 38.25, '#7fb5d6', [
    'Forty years I have fished the Gild. On fair day the trout hide under the barges, sulking at the noise.',
    'Mind the Grand Stair behind me — three hundred years of feet have made it slippy as a wet eel.',
  ], { wander: 0.3, speed: 0.7, behaviour: 'post', facing: 'down' });
  npc('odd', 'Master Odd', 'scholar', 75.6, 37.8, '#9ab0d8', [
    'Customs. Every barge declares its cargo, and I write it in the book. Today I have written "cheese" one hundred and four times.',
    'The {Saltbridge} to the east, {Kingsbridge} in the middle, and the {Mistbridge} by the falls — three bridges, and I have to count the tolls on all of them.',
  ], { wander: 1, speed: 0.8 });
  npc('tamsin', 'Tamsin', 'villager', 84, 37.8, '#b8835c', [
    'I build boats. Little ones for the river, bigger ones for the harbour. The biggest one is still a dream and some sawdust.',
  ], { wander: 1.2, speed: 0.9 });

  // ---- the West Quarter and the Undercliff
  npc('alba', 'Alba Quern', 'farmer', 33.8, 38.6, '#e0c68e', [
    'My cousin runs the windmill out in {Fairfield}. I run the water mill under the {Gildfall}. We do not speak of whose flour is better. Mine is.',
    'Stand on the {Mistbridge} when the sun is low — the spray glitters like the gold dust of the old stories. Free of charge, which is more than my cousin can say.',
  ], { wander: 1.4, speed: 0.8 });
  npc('rurik', 'Rurik Hammerstane', 'swordsman', 37.6, 58.3, '#b85c38', [
    'Stand back from the forge, friend. Sparks do not care whose coat they land on.',
    'Fair day means horseshoes, cart-pins and cauldron handles. Nobody buys a sword on fair day. Too much joy in the air.',
  ], { wander: 0.6, speed: 0.8 });
  npc('hamish', 'Hamish Mott', 'innkeeper', 20.4, 59.4, '#c88a3a', [
    'The {Barrelhouse}! Gild Ale, brown as the river and twice as strong. We brew it with water from the falls.',
    ask('A mug for the fair?', 'Not now', 'One mug'),
  ], { wander: 0.8, speed: 0.8, action: 'shop', item: 'Mug of Gild Ale' });
  npc('joss', 'Joss Plane', 'villager', 11, 59.6, '#a0703f', [
    'Carpenter. I made half the stalls on the square, and all the benches. If one wobbles, it was the other half.',
  ], { wander: 1.2, speed: 0.9 });

  // ---- the Gild Pool
  npc('ysolde', 'Harbourmaster Ysolde', 'guard', 105.6, 58.4, '#4a7fb0', [
    'The {Gild Pool}. The barges came up at dawn, unloaded for the fair and went straight back down to the sea for more. Now it is just us and the gulls.',
    'East Pier for fishing, West Pier for gossip. Gran Tessaly mends nets down on the beach, past the smokehouse.',
  ], { wander: 0.5, speed: 0.8 });
  npc('dob', 'Dob', 'hunter', 104.5, 45.8, '#78b35b', [
    'Shh. They are biting. Or they were, until you walked down the pier like a drum.',
  ], { wander: 0.3, speed: 0.7, behaviour: 'post', facing: 'up' });
  npc('merrit', 'Merrit', 'villager', 111.5, 42.8, '#7fb5d6', [
    'Gulls took my lunch, my bait and my hat. I am keeping the rod out of spite.',
  ], { wander: 0.3, speed: 0.7, behaviour: 'post', facing: 'up' });
  npc('tessaly', 'Gran Tessaly', 'elder', 119.4, 52.4, '#9ab0d8', [
    'Mending nets, dear. Every hole is a fish that got away and a story that got bigger.',
    'Look up at the cliff. That is the {Lookout}, at the end of the {Rampart Walk}. Captain Hale watches the barges from there, and pretends she is not watching me.',
  ], { wander: 0.8, speed: 0.6 });
  npc('fenna', 'Fenna', 'farmer', 110.2, 58.6, '#c86a4a', [
    'Smoked Gild trout, fresh off the fire at the end of the quay. Smoked eel for the brave.',
    ask('Smoked trout?', 'Not today', 'One trout'),
  ], { wander: 0.3, speed: 0.8, behaviour: 'post', facing: 'left', action: 'shop', item: 'Smoked Gild Trout' });

  // ---- Lantern Row, Weaver's Lane, Bellgreen
  npc('old_wick', 'Old Wick', 'elder', 92.6, 75.6, '#ffc46b', [
    'Lamplighter. Every lamp from the {South Gate} to the {Rampart Walk} — I light them all at dusk, one by one.',
    'Takes me till the bell has stopped ringing. By then the first ones want trimming. A lamplighter\'s work is never done, only dim.',
  ], { wander: 3.5, speed: 0.7 });
  npc('bramwell', 'Bramwell Bun', 'villager', 38.4, 75, '#e0b070', [
    'Saffron buns, hot from the {Saffron Bakery}! The saffron comes from Azar\'s stall on the square. Azar charges like a pirate, but oh, the colour.',
    ask('A bun for the road?', 'Maybe later', 'Yes, please'),
  ], { wander: 0.6, speed: 0.8, action: 'shop', item: 'Saffron Bun' });
  npc('saffi', 'Saffi', 'dancer', 38.6, 90.4, '#e27aa8', [
    'I weave the river-blue that Signora Vell sells on the square. She sells it for three times what she pays me. I weave slower on Mondays.',
  ], { wander: 1.4, speed: 0.9 });
  npc('hob', 'Hob', 'elder', 11.2, 88.6, '#9ab0d8', [
    'Sit down, sit down. The best view of fair day is a bench and a friend.',
  ], { wander: 0.2, speed: 0.5, behaviour: 'post', facing: 'down' });
  npc('hester', 'Hester', 'elder', 19.6, 88.6, '#e0a8c8', [
    'Hob has been on that bench since the fair opened. I have been on this one. We are having a lovely day together.',
  ], { wander: 0.2, speed: 0.5, behaviour: 'post', facing: 'down' });
  npc('kit', 'Kit', 'child', 14.4, 81.4, '#f5a07a', [
    'The sign says don\'t climb the oak. It does not say don\'t climb the oak AGAIN.',
  ], { wander: 3.2, speed: 1.6 });
  npc('agnes', 'Dame Agnes', 'scholar', 92.2, 90.6, '#a07ad6', [
    'No school today. I said so on the slate. Twice. And on the door. And to every child personally.',
    'They still came. They are at the fair now, learning arithmetic from the cheese stall.',
  ], { wander: 1.6, speed: 0.8 });
  npc('tuck', 'Brother Tuck', 'cleric', 115.6, 90.6, '#a7c7e7', [
    'The {Shrine of the Tide} keeps the names of the boats. Those that came home, and those that did not.',
    'Light a thought for the river, friend. It gives this town everything — even its name.',
  ], { wander: 0.8, speed: 0.7 });

  // ---- in the streets
  npc('ned', 'Ned the Porter', 'villager', 64.6, 68, '#a0703f', [
    'Mind your backs! Barrels for the {Barrelhouse}, cheese for the square, and a harp for — honestly, I do not know who orders a harp.',
    'The chandlers on {Market Street}, probably. They have everything.',
  ], { wander: 4, speed: 1.1 });
  npc('ada', 'Ada', 'villager', 55, 75.6, '#d9a066', [
    'Have you seen a small boy in a red cap? Answers to "Bram", and to "cake", and to nothing else.',
  ], { wander: 3.5, speed: 1 });
  npc('bram', 'Bram', 'child', 60.2, 76.2, '#e05a4a', [
    'Shh! I am hiding from Mum. If she says "cake", I have to come out. It is the rules.',
  ], { wander: 4.5, speed: 1.6 });
  npc('milla', 'Milla', 'farmer', 76, 90.6, '#e8d27a', [
    'Milk! Fresh this morning from {Fairfield}! ...Sold out by noon. I am just walking the empty pails home, for the exercise.',
  ], { wander: 4, speed: 0.9 });
  npc('tam', 'Tam the Piper', 'bard', 31, 61.2, '#78b35b', [
    'A tune for a penny! A sad one for two! A sad one about pennies for three!',
    'The players out in {Fairfield} have a fiddle. I have a pipe and a good loud hat. We are not rivals. They are simply wrong.',
  ], { wander: 0.3, speed: 0.8, behaviour: 'perform' });
  npc('gwen', 'Gwen the Bargewife', 'merchant', 100.4, 60.6, '#c86a4a', [
    'My barge went back down to the sea at noon. Left me here with a pocketful of coin and no boat. I call that a holiday.',
  ], { wander: 3, speed: 0.9 });

  // ---- High Town
  npc('odelia', 'Lady Odelia Fairgild', 'elder', 33.4, 18.6, '#e8cf8a', [
    'Welcome to {Gildhaven}, traveller, on the best day of our year. I am Odelia Fairgild, Lord Mayor — "Lord" because the charter is very old and nobody likes paperwork.',
    'Long ago the barge-folk found gold dust in the river below the falls. There was not much, but they named the town for it, and they have been gilding everything since.',
    ask('Will you stay for the bell at dusk?', 'I think so', 'What happens then?'),
    'Mother {Celandine} rings the {Sunspire Bell}, the fair closes, and we light lanterns all along the river. The water turns to gold for a night. That is the real gild of {Gildhaven}.',
  ], { wander: 1.4, speed: 0.7 });
  npc('hall_guard', 'Guardsman Pell', 'guard', 29.6, 16.4, '#6a8fd6', [
    'Gildhaven Hall. The Lord Mayor is receiving in the court — just there, by the benches. Please do not curtsey into the flower boxes.',
  ], { wander: 0.3, speed: 0.8, behaviour: 'post', facing: 'right' });
  npc('celandine', 'Mother Celandine', 'cleric', 60.4, 15.4, '#f2e2b5', [
    'Peace on your fair day. I am the Abbess of {Sunspire Abbey}. At dusk I ring the bell, and the whole town stops to listen.',
    'Three hundred years that bell has rung. It cracked once, in a hard winter. We mended it with gold leaf — a little of everything in Gildhaven is.',
  ], { wander: 1.2, speed: 0.7 });
  npc('cass', 'Novice Cass', 'cleric', 67.6, 15.6, '#f2e2b5', [
    'I polish the candlesticks, I sweep the steps, and at dusk I am allowed to hold the rope while Mother Celandine rings the bell. It is the best job in {Gildhaven}.',
  ], { wander: 2, speed: 0.9 });
  npc('elric', 'Elric the Pilgrim', 'traveler', 58.4, 20.6, '#9ab0d8', [
    'I walked from the coast to hear the {Sunspire Bell}. Three weeks. My boots are holier than I am.',
  ], { wander: 2.2, speed: 0.7 });
  npc('anselm', 'Brother Anselm', 'scholar', 102.6, 16.6, '#9ab0d8', [
    'The {Gilt Library}: four thousand books, three readers, and one cat who sleeps on the rarest of them.',
    'If you want the history of the fair, it is in chapter nine. If you want the gossip, it is in the Barrelhouse.',
  ], { wander: 0.8, speed: 0.7 });
  npc('orrin', 'Guildmaster Orrin', 'merchant', 89, 17.4, '#c9a45c', [
    'The Guild Exchange sets the price of everything sold on the square today. Everything. Even the turnip the juggler drops.',
    'Trade is the river that runs under the river, friend. And this is a very good day for it.',
  ], { wander: 0.8, speed: 0.8 });
  npc('hale', 'Captain Hale', 'swordsman', 115.4, 28.6, '#6a8fd6', [
    'The {Lookout}. From here I can see both piers of the {Gild Pool}, every roof in the lower town and the road all the way to the gate.',
    'Quiet fair so far. One stolen purse, one lost child — found asleep in a haystack in {Fairfield} — and the goose went missing from the inn again. It will turn up.',
  ], { wander: 0.4, speed: 0.8, behaviour: 'post', facing: 'down' });
  npc('sorrel', 'Sorrel', 'farmer', 79.6, 26.8, '#78b35b', [
    'I keep the Rampart lawns and the Abbey beds. Every fair, somebody sits on my marigolds. Every fair, I forgive them. Barely.',
  ], { wander: 2, speed: 0.8 });
  npc('amabel', 'Lady Amabel Thornbury', 'dancer', 72, 24.4, '#e8a0c0', [
    'I have bought a hat. I did not need a hat. It is the most beautiful hat in {Gildhaven}, and therefore the world.',
  ], { wander: 4, speed: 0.9 });
  npc('hazel', 'Hazel', 'farmer', 16.6, 22.4, '#9ac25a', [
    'Pippin Orchard. Every apple on every toffee stick at the fair grew on these trees.',
    'You came over the {Hall Bridge}? Then you have crossed the Gild twice today — once up here as a stream, once down there as a river.',
  ], { wander: 1.2, speed: 0.8 });
}

/** Spot beside a stall (x, z, keeper side) where its keeper stands. */
function keeperOf(x, z, side, w = 3) {
  return [x + side * (w / 2 + 0.55), z + 0.55];
}

// =============================================================================================
// 2c. Sightlines, scatter, house dressing, crowns
// =============================================================================================

function sightlines() {
  addSightlines(P);
  P.view(AXIS, 121, 8, 8); // the spawn
  P.view(48.5, 32, 6, 12); // the Gildfall
}

const TREE_RULES = {
  high: { keep: 0.05, spacing: 5, pathGap: 2, south: 6, kinds: [['birch', 45], ['oak', 35], ['autumn', 20]], h: [4.2, 5.4] },
  undercliff: { keep: 0.25, spacing: 3.4, pathGap: 2, south: 6, kinds: [['birch', 45], ['oak', 35], ['pine', 20]], h: [4, 5.4] },
  west: { keep: 0.12, spacing: 4.5, pathGap: 2, south: 6, kinds: [['oak', 50], ['birch', 30], ['autumn', 20]], h: [3.8, 5] },
  town: { keep: 0.05, spacing: 5, pathGap: 2, south: 6, kinds: [['birch', 40], ['oak', 40], ['autumn', 20]], h: [3.8, 4.8] },
  green: { keep: 0.08, spacing: 5, pathGap: 2, south: 6, kinds: [['birch', 60], ['autumn', 40]], h: [3.8, 4.6] },
  allotments: { keep: 0.1, spacing: 5, pathGap: 2, south: 6, kinds: [['oak', 40], ['birch', 40], ['autumn', 20]], h: [3.6, 4.6] },
  fair: { keep: 0.16, spacing: 4.2, pathGap: 3, south: 5, kinds: [['oak', 45], ['birch', 30], ['autumn', 25]], h: [4.2, 6] },
};
const ROCK_RULES = { fair: 0.02, undercliff: 0.08, high: 0.01, west: 0.01 };

/**
 * No scatter on the fairground, round the stage and the players' camp, in the poultry corner, in the
 * farmyard or on the knoll's slopes (the windmill's sails sweep low).
 */
function scatterAvoid(x, z, rr = 0) {
  if (x > 70 - rr && x < 108 + rr && z > 98 - rr && z < 122 + rr) return true;
  if (x > 3 && x < 26 + rr && z > 98 && z < 109 + rr) return true;
  return Math.hypot(x - 27.6, z - 102) < 6 + rr;
}

/** Barrels, crates and flower boxes against the side and back walls of the homes (Starfall's dressHouses). */
function dressHouses() {
  const rng = new RNG('gildhaven:dressing');
  let n = 0;
  for (const h of P.objects.filter((o) => o.type === 'house')) {
    const a = h.rotation ?? 0;
    const hw = h.opts.width / 2; const hd = h.opts.depth / 2;
    const slots = [
      ['side', -hw - 0.65, rng.range(-hd + 0.4, hd - 0.4)], ['side', hw + 0.65, rng.range(-hd + 0.4, hd - 0.4)],
      ['back', rng.range(-hw + 0.6, hw - 0.6), -hd - 0.6], ['front', (h.opts.doorOffset ?? 0) > 0 ? -hw + 0.8 : hw - 0.8, hd + 0.45],
    ];
    rng.shuffle(slots);
    let placed = 0;
    for (const [where, lx, lz] of slots) {
      if (placed >= 1 + (rng.chance(0.5) ? 1 : 0)) break;
      const [dx, dz] = rot(lx, lz, a);
      const x = h.x + dx; const z = h.z + dz;
      const i = Math.floor(x); const j = Math.floor(z);
      if (!inMap(i, j) || g.pathMask[I(i, j)] || HARD.has(T(i, j)) || BLOCKED.has(T(i, j)) || T(i, j) === 'q' || L(i, j) !== L(Math.floor(h.x), Math.floor(h.z))) continue;
      if (P.inClearZone(x, z, 0.3) || P.blockedAt(x, z, 0.55, (ow) => ow === h)) continue;
      const d = P.doorOf(h);
      if ((d.x - x) ** 2 + (d.z - z) ** 2 < 2.2 ** 2) continue;
      if (where === 'front') P.flowers(x, z, a, 1.1);
      else if (rng.chance(0.5)) P.barrel(x, z, { height: rng.range(0.85, 1.05), lying: rng.chance(0.2) });
      else P.crate(x, z, rng.range(0.6, 0.85));
      placed++;
      n++;
    }
  }
  return n;
}

/** The camera pitch where a figure stands (the environment's highGround above y 2.2 → 39°, else 33°). */
const pitchAt = cameraPitch(environment());

/** Drop the scattered trees whose crowns hide ≥ 25 % of a sight target (yaw 0); hand-placed trees are left to validate(). */
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
  for (const s of sightTargets(P.objects, P.doorOf)) {
    for (;;) {
      const r = occl.cover(s.x, s.z, { yaw: 0, pitch: pitchAt(P.groundY(s.x, s.z)), h0: s.h0, h1: s.h1, terrain: false });
      if (r.share < 0.25 || !drop(r.by)) break;
    }
  }
  return removed;
}

// =============================================================================================
// 2d. Regions (small places first — first match wins)
// =============================================================================================

function regions() {
  const R = (id, name, sub, minX, maxX, minZ, maxZ, { minY = null, banner = '' } = {}) => add('region', { id, minX, maxX, minZ, maxZ, name, sub, minY, banner });
  const H = { minY: 2.2 };
  R('region_lookout', 'The Lookout', 'High Town', 108, 125, 25.5, 32, H);
  R('region_abbey', 'Sunspire Abbey', 'High Town', 52, 76, 3, 23, { ...H, banner: 'The bell rings the fair closed at dusk' });
  R('region_hall', 'Gildhaven Hall', 'High Town', 25, 46, 3, 23, H);
  R('region_scholars', "Scholars' Row", 'High Town', 76, 108, 3, 23, H);
  R('region_watch', 'The Watch', 'High Town', 108, 125, 3, 23, H);
  R('region_orchard', 'Pippin Orchard', 'High Town', 3, 25, 3, 23, H);
  R('region_crown_walk', 'Crown Walk', 'High Town', 3, 125, 22.5, 26, H);
  R('region_rampart', 'The Rampart Walk', 'High Town', 3, 125, 26, 32, { ...H, banner: 'The whole town below' });
  R('region_high_town', 'High Town', 'Gildhaven', 0, W, 0, 32, { ...H, banner: 'The Abbey, the Hall and the Rampart Walk' });
  R('region_grand_stair', 'The Grand Stair', 'Gildhaven', 61.5, 66.5, 26, 32);
  R('region_harbour_stair', 'The Harbour Stair', 'Gildhaven', 93.5, 97.5, 26, 32);
  R('region_gildfall', 'The Gildfall', 'Gildhaven', 42, 56, 30, 42, { banner: 'Where the Gild leaves High Town' });
  R('region_kingsbridge', 'Kingsbridge', 'Gildhaven', 61.5, 66.5, 38.5, 44.5);
  R('region_north_quay', 'North Quay', 'Gildhaven', 54, 100, 30, 39);
  R('region_undercliff', 'The Undercliff', 'West Quarter', 3, 44, 30, 41);
  R('region_square', 'Market Square', 'Gildhaven', 44, 82, 39, 59, { banner: 'Gild Fair · Stalls, crier and the Gild Well' });
  R('region_barge_quay', 'Barge Quay', 'East Quarter', 82, 100, 39, 59);
  R('region_gild_pool', 'The Gild Pool', 'Gildhaven Harbour', 98, 125, 30, 59, { banner: 'Piers, gulls and the smokehouse' });
  R('region_west', 'The West Quarter', 'Gildhaven', 3, 44, 41, 59);
  R('region_market_street', 'Market Street', 'Gildhaven', 3, 125, 59, 62.5);
  R('region_bellgreen', 'Bellgreen', 'Gildhaven', 3, 29, 77, 89);
  R('region_lantern_row', 'Lantern Row', 'Gildhaven', 3, 125, 62.5, 77);
  R('region_weavers_lane', "Weaver's Lane", 'Gildhaven', 3, 125, 77, 92);
  R('region_gate', 'The South Gate', 'Gildhaven', 56, 72, 92, 101);
  R('region_allotments', 'The Allotments', 'Gildhaven', 3, 125, 92, 96);
  R('region_fairground', 'The Fairground', 'Fairfield', 70, 108, 98, 122, { banner: 'The Wandering Lark Players · Today only' });
  R('region_mill', 'Fairfield Mill', 'Fairfield', 22, 44, 97, 107);
  R('region_farm', "Barlow's Farm", 'Fairfield', 3, 26, 98, 125);
  R('region_fairfield', 'Fairfield', 'Gildhaven', 0, W, 96, D, { banner: 'Outside the South Gate · Fair day' });
  R('region_town', 'Gildhaven', 'Market Day on the River Gild', 0, W, 0, D);
}

// =============================================================================================
// 3. Environment
// =============================================================================================

/** @returns {LevelEnvironment} */
function environment() {
  return {
    timeOfDay: 16.6,
    clock: true,
    weather: 'clear',
    border: 'forest',
    outerScenery: true,
    godRays: true,
    dust: true,
    music: true,
    camera: { distance: 30, pitch: 33 },
    highGround: { minY: 2.2, pitch: 39 },
    title: { title: 'GILDHAVEN', subtitle: 'Market Day on the River Gild', prompt: 'Press any key', credit: 'A Luminati 2.5D town · three.js' },
    // the title drifts over the river: the square's stalls, Kingsbridge, the Gildfall and the Abbey on its rock
    titleCamera: { x: 62, z: 44, y: 1.2, driftX: 6, driftZ: 3, distance: 40 },
    fogScale: 0.7,
    scenery: { southGap: 10 },
    forest: {
      areas: [
        { minX: -60, maxX: 200, minZ: -60, maxZ: 32, kinds: { pine: 4, birch: 3, oak: 2 } },
        { minX: -60, maxX: 200, minZ: 32, maxZ: 96, kinds: { oak: 4, birch: 3, autumn: 2 } },
        { minX: -60, maxX: 200, minZ: 96, maxZ: 200, kinds: { oak: 5, autumn: 3, birch: 2 } },
      ],
    },
    godRayAreas: [
      { minX: 46, maxX: 82, minZ: 44, maxZ: 60, y: 1, count: 5, seed: 7 },
      { minX: 52, maxX: 76, minZ: 10, maxZ: 24, y: 2.5, count: 3, seed: 13 },
      { minX: 70, maxX: 106, minZ: 98, maxZ: 120, y: 1, count: 4, seed: 19 },
      { minX: 4, maxX: 44, minZ: 32, maxZ: 58, y: 1, count: 3, seed: 23 },
    ],
    foliage: {
      seed: 1717,
      flowerAreas: [
        { minX: 3, maxX: 125, minZ: 3, maxZ: 32, palette: [0, 1, 3, 1, 2] },
        { minX: 3, maxX: 29, minZ: 77, maxZ: 89, palette: [1, 0, 2, 1] },
        { minX: 3, maxX: 125, minZ: 98, maxZ: 125, palette: [1, 2, 1, 0, 3] },
      ],
      shrubAreas: [
        { minX: 3, maxX: 44, minZ: 32, maxZ: 41, chance: 0.14 },
        { minX: 3, maxX: 125, minZ: 92, maxZ: 96, chance: 0.08 },
        { minX: 3, maxX: 125, minZ: 98, maxZ: 125, chance: 0.06 },
      ],
    },
  };
}

// =============================================================================================
// 4. Validation — the shared checks (tools/lib/levelcheck.mjs), strict
// =============================================================================================

const LEGEND = defaultLegend();
LEGEND.e = { top: 'riverbed', side: 'cliff', water: true, walkable: false, flow: [0.45, 0] };
LEGEND.q = { top: 'stone_tiles', side: 'stone_wall', walkable: false };

/**
 * Walks that must stay direct (≤ 1.5 × the straight line + 3 on the walk grid): a closed lane, a
 * missing bridge or stair fails here even when the far side is reachable the long way round.
 * @type {[name: string, from: XZ, to: XZ][]}
 */
const ROUTES = [
  ['the spawn → the South Gate', [AXIS, 121], [AXIS, 93]],
  ['the South Gate → the Market Square', [AXIS, 93], [AXIS, 58]],
  ['the square → Kingsbridge → the North Quay', [AXIS, 47], [AXIS, 36.5]],
  ['the North Quay → the Grand Stair → Abbey Plaza', [AXIS, 36.5], [AXIS, 21]],
  ['Crown Walk over the Hall Bridge', [44.2, 24.5], [53, 24.5]],
  ['the Undercliff → the Mistbridge → the North Quay', [41.5, 38.5], [56, 37.5]],
  ['Barge Quay → Saltbridge → the North Quay', [91.5, 46], [91.5, 36.5]],
  ['the North Quay → the Harbour Stair → Crown Walk', [95, 36.5], [95, 24.5]],
  ['Market Street → the Market Square', [10, 60.5], [46, 60.5]],
  ['the square → the Fish Quay', [80, 60.5], [110, 58]],
  ['Mill Lane → the Undercliff', [32.9, 58], [32.9, 38.5]],
  ["Lantern Row → Cooper's Lane → Weaver's Lane", [47, 75.5], [47, 90.5]],
  ['the King\'s Road → the stage', [AXIS, 108], [88, 106.4]],
  ['the King\'s Road → Quern Cottage', [AXIS - 2, 108], [36.6, 105.4]],
  ['the Fish Quay → the West Pier', [104.5, 58], [104.5, 46]],
  ['Crown Walk → the Lookout', [112, 24.5], [115, 28.6]],
];

/** The shared checks of tools/lib/levelcheck.mjs at the generators' bar, with this level's routes, streets and scatter. */
function validate(level) {
  return checkLevel(level, { g, P }, { strict: true, routes: ROUTES, scattered: P.SCATTERED, pitchAt, minVillagers: 40 });
}

// =============================================================================================
// 5. Run
// =============================================================================================

relief();
water();
paths();
stairs();
wall();
ground();
border();

highTown();
river();
square();
westQuarter();
eastQuarter();
harbour();
rows();
fairfield();
people();
sightlines();
const handTrees = P.objects.filter((o) => o.type === 'tree').length;
const scatteredTrees = scatterTrees(g, P, { seed: 'gildhaven:trees', rules: TREE_RULES, maxTrees: 160, maskSeed: 90, avoid: scatterAvoid });
const scatteredRocks = scatterRocks(g, P, { seed: 'gildhaven:rocks', rules: ROCK_RULES, maxRocks: 30, avoid: scatterAvoid });
const dressed = dressHouses();
const crownsCleared = clearCrowns();
regions();

const rows_ = g.rows(levelToChar);
/** @type {Level} */
const raw = {
  format: LEVEL_FORMAT,
  version: LEVEL_VERSION,
  name: NAME,
  subtitle: 'Market Day on the River Gild',
  author: 'Luminati',
  description: 'A 128 × 128 walled river town on fair day: High Town and Sunspire Abbey on the terrace, the Gildfall, the Market Square on the river, the West and East Quarters, the Gild Pool harbour, the rows of Lantern Row and Weaver\'s Lane, and Fairfield outside the South Gate with the players\' stage and the mill. Generated by tools/make-gildhaven.mjs.',
  width: W,
  depth: D,
  waterLevel: 0.4,
  water: { flow: [0, 0.45], reflect: 0.16, neutral: 0.35, glint: 0.6 },
  environment: environment(),
  spawn: { x: AXIS, z: 121.5, facing: 'up' },
  legend: LEGEND,
  tiles: rows_.tiles,
  heights: rows_.heights,
  objects: P.objects.map(canonicalObject),
};

const { level, warnings } = normalizeLevel(raw);
level.objects = level.objects.map(canonicalObject);
const errors = validateLevel(level);
for (const p of normalizedChanges(raw, level)) errors.push(`normalizeLevel changed ${p}`);
// the content-text keys (docs/specs/I18N.md §4.10): carried from the current file at the default
// path (never --out), new ones seeded by the file and the text (checkLevel's strict bar fails on a
// missing, stray or repeated one)
keyLevel(level, { root, file: 'public/levels/gildhaven.json' });
const report = validate(level);
const text = serializeLevel(level);
if (serializeLevel(normalizeLevel(JSON.parse(text)).level) !== text) report.errors.push('serializeLevel is not byte-stable for this level');
if (serializeLevel(parseLevel(text).level) !== text) report.errors.push('parseLevel → serializeLevel is not byte-identical');

// ---- report --------------------------------------------------------------------------------
const stats = levelStats(level);
const heightsUsed = [...new Set(level.heights.join(''))].map(charToLevel).sort((a, b) => a - b);
log(`${NAME} → ${path.relative(root, OUT)}: ${stats.width}×${stats.depth}, ${stats.objects} objects, ${stats.walkable} walkable / ${stats.water} water tiles, levels ${heightsUsed[0]}–${heightsUsed[heightsUsed.length - 1]}`);
log('objects by type:', Object.entries(stats.counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
log(`trees: ${handTrees} hand-placed + ${scatteredTrees - crownsCleared.length} scattered (${crownsCleared.length} dropped for a view) · rocks: ${scatteredRocks} · house dressing: ${dressed}`);
log('validation:');
for (const m of report.info) log(`  · ${m}`);
for (const m of warnings) log(`  ! normalizeLevel warning: ${m}`);
for (const m of report.warnings) log(`  ! ${m}`);
for (const m of errors) log(`  ✗ validateLevel: ${m}`);
for (const m of report.errors) log(`  ✗ ${m}`);
if (args.ascii) for (const r of level.tiles) console.log(r);

const failed = warnings.length + errors.length + report.errors.length;
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
