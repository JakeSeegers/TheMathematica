/**
 * Walk-grid partial rebuild checks (KNOWN_ISSUES STORY-04): `Nav.buildRect` against a full build,
 * on the game page of any level (`game.html?level=<name>&autostart=1`). A combat level's own grid
 * (`game.combat.nav`, with its boss-arena `blocked` test) is used; a peaceful level gets a fresh
 * `Nav` over its TileMap. Script: `sandbox/combat.navrect.json`.
 *
 * - `equivalence({ trials, seed })`: random changes of the TileMap — box and circle colliders and
 *   walk surfaces added or removed (the level's own and new ones, a bridge with its posts, half of
 *   them on the edge of a cliff, a stair or the water, some in a boss arena or across the map
 *   edge) — each followed by `buildRect` on the union of what changed (World.applyStory's rect)
 *   and compared byte for byte (`flags`, `h`, `stats.open` / `stats.tight`) with a fresh full
 *   build. Everything is put back at the end (and checked again).
 * - `timing({ reps })`: the median of `reps` full builds against `buildRect` for a 10 × 3 u bridge
 *   (a deck and four posts) coming and going, plus the mean of a batch of 200 (performance.now is
 *   coarse).
 */
import { Nav } from '../src/game/combat/Nav.js';
import { RNG } from '../src/engine/utils/math.js';

/** @import { TileMap } from '../src/engine/world/TileMap.js' */

const F_OPEN = 1;
const F_WALL = 2;

/** Wait for the game page to finish loading. @param {number} [timeoutMs] */
export async function ready(timeoutMs = 90000) {
  const t0 = performance.now();
  while (!(window.__luminati && window.__luminati.loadMs && window.__game)) {
    if (performance.now() - t0 > timeoutMs) throw new Error('nav_rect: the game did not load');
    await new Promise((r) => setTimeout(r, 100));
  }
  return { level: window.__game.game.level?.name, loadMs: window.__luminati.loadMs };
}

/**
 * The grid under test: the combat level's own, else a new one over the level's TileMap.
 * @returns {{ nav: Nav, tm: TileMap, Ctor: typeof Nav, own: boolean }}
 */
function subject() {
  const g = /** @type {any} */ (window.__game).game;
  const tm = g.tileMap;
  /** @type {Nav} */
  let nav = g.combat?.nav ?? null;
  const own = !!nav;
  if (!nav) {
    nav = g.__navRect ?? new Nav(tm);
    g.__navRect = nav;
  }
  return { nav, tm, Ctor: /** @type {typeof Nav} */ (nav.constructor), own };
}

/** @param {any} o a collider or walk surface @returns {number[]} [minX, maxX, minZ, maxZ] */
const outline = (o) => (o.type === 'circle' ? [o.x - o.r, o.x + o.r, o.z - o.r, o.z + o.r] : [o.minX, o.maxX, o.minZ, o.maxZ]);

/** @param {ArrayLike<number>} a @param {ArrayLike<number>} b @returns {number} the first differing index, or −1 */
function firstDiff(a, b) {
  if (a.length !== b.length) return 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i;
  return -1;
}

/**
 * Compare a grid with a fresh full build of the same TileMap.
 * @param {Nav} nav @param {TileMap} tm @param {typeof Nav} Ctor
 * @returns {string|null} what differs, or null
 */
function compare(nav, tm, Ctor) {
  const full = new Ctor(tm, { blocked: nav.blocked });
  const fk = firstDiff(nav.flags, full.flags);
  const hk = firstDiff(new Uint8Array(nav.h.buffer), new Uint8Array(full.h.buffer));
  if (fk < 0 && hk < 0 && nav.stats.open === full.stats.open && nav.stats.tight === full.stats.tight) return null;
  const at = (k) => (k < 0 ? null : { k, i: k % nav.cols, j: Math.floor(k / nav.cols) });
  return JSON.stringify({ flags: at(fk), h: at(hk >> 2), open: [nav.stats.open, full.stats.open], tight: [nav.stats.tight, full.stats.tight] });
}

/**
 * @param {{ trials?: number, seed?: number }} [opts]
 * @returns {object} counts of trials, mismatches (should be 0), cells that changed, the kinds
 */
export function equivalence({ trials = 200, seed = 1 } = {}) {
  const { nav, tm, Ctor, own } = subject();
  const rng = new RNG(seed);
  const W = tm.width;
  const D = tm.depth;
  const baseline = compare(nav, tm, Ctor);
  if (baseline) nav.build(nav.blocked);
  const arenas = /** @type {any} */ (window.__game).game.combat?.arenas ?? [];
  /** wall cells (cliff, stair, water and collider edges) to aim half of the changes at */
  const edgeCells = [];
  for (let k = 0; k < nav.flags.length; k++) if (nav.flags[k] & F_WALL) edgeCells.push(k);
  const levelColliders = tm.colliders.filter((c) => c && !c.dynamic);
  const levelSurfaces = tm.walkSurfaces.slice();
  /** @type {Set<any>} */
  const added = new Set();
  /** @type {Set<any>} */
  const addedWs = new Set();
  /** @type {Set<any>} */
  const removed = new Set();
  /** @type {Set<any>} */
  const removedWs = new Set();
  const spot = () => {
    const r = rng.next();
    if (r < 0.5 && edgeCells.length) {
      const k = rng.pick(edgeCells);
      return [((k % nav.cols) + 0.5) * 0.5 + rng.range(-1, 1), (Math.floor(k / nav.cols) + 0.5) * 0.5 + rng.range(-1, 1)];
    }
    if (r < 0.6 && arenas.length) {
      const a = rng.pick(arenas).rect;
      return [rng.range(a.minX - 1, a.maxX + 1), rng.range(a.minZ - 1, a.maxZ + 1)];
    }
    if (r < 0.65) return [rng.chance(0.5) ? rng.range(-1, 1.5) : rng.range(W - 1.5, W + 1), rng.range(-1, D + 1)];
    return [rng.range(0, W), rng.range(0, D)];
  };
  const box = () => {
    const [x, z] = spot();
    const w = rng.range(0.05, 4);
    const d = rng.range(0.05, 4);
    return { type: 'box', minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
  };
  const circle = () => {
    const [x, z] = spot();
    return { type: 'circle', x, z, r: rng.range(0.1, 1.6) };
  };
  const surface = (x, z, w, d) => {
    const y = tm.getHeight(x, z) + rng.pick([0, 0, 0.25, 0.5, 0.5, 1, 1.5]);
    return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, y };
  };
  const kinds = { addBox: 0, addCircle: 0, removeCollider: 0, addSurface: 0, removeSurface: 0, bridge: 0, restoreMany: 0 };
  let mismatches = 0;
  /** @type {string[]} */
  const first = [];
  let changedCells = 0;
  let rectCells = 0;
  let flagsBefore = nav.flags.slice();
  for (let t = 0; t < trials; t++) {
    /** @type {number[][]} */
    const outs = [];
    const r = rng.next();
    let kind;
    if (r < 0.2) {
      kind = 'addBox';
      const c = box();
      tm.addCollider(c); added.add(c); outs.push(outline(c));
    } else if (r < 0.32) {
      kind = 'addCircle';
      const c = circle();
      tm.addCollider(c); added.add(c); outs.push(outline(c));
    } else if (r < 0.5) {
      kind = 'removeCollider';
      const pool = [...levelColliders.filter((c) => !removed.has(c)), ...added];
      const c = pool.length ? rng.pick(pool) : null;
      if (c) {
        tm.removeCollider(c);
        if (added.has(c)) added.delete(c); else removed.add(c);
        outs.push(outline(c));
      }
    } else if (r < 0.65) {
      kind = 'addSurface';
      const [x, z] = spot();
      const s = surface(x, z, rng.range(0.3, 12), rng.range(0.3, 4));
      tm.addWalkSurface(s); addedWs.add(s); outs.push(outline(s));
    } else if (r < 0.78) {
      kind = 'removeSurface';
      const pool = [...levelSurfaces.filter((s) => !removedWs.has(s)), ...addedWs];
      const s = pool.length ? rng.pick(pool) : null;
      if (s) {
        tm.removeWalkSurface(s);
        if (addedWs.has(s)) addedWs.delete(s); else removedWs.add(s);
        outs.push(outline(s));
      }
    } else if (r < 0.95) {
      // a story group: a bridge deck and its posts (and, every other time, a crate beside it)
      kind = 'bridge';
      const [x, z] = spot();
      const along = rng.chance(0.5);
      const w = along ? 10 : 3;
      const d = along ? 3 : 10;
      const s = surface(x, z, w, d);
      tm.addWalkSurface(s); addedWs.add(s); outs.push(outline(s));
      for (const [px, pz] of [[s.minX, s.minZ], [s.maxX, s.minZ], [s.minX, s.maxZ], [s.maxX, s.maxZ]]) {
        const c = { type: 'circle', x: px, z: pz, r: 0.18 };
        tm.addCollider(c); added.add(c); outs.push(outline(c));
      }
      if (rng.chance(0.5)) {
        const c = { type: 'box', minX: s.maxX + 0.1, maxX: s.maxX + 1.1, minZ: z - 0.5, maxZ: z + 0.5 };
        tm.addCollider(c); added.add(c); outs.push(outline(c));
      }
    } else {
      // several of the added things go away at once, far apart (one big union rect)
      kind = 'restoreMany';
      let n = 0;
      for (const c of [...added]) if (n++ < 4) { tm.removeCollider(c); added.delete(c); outs.push(outline(c)); }
      for (const s of [...addedWs]) if (n++ < 6) { tm.removeWalkSurface(s); addedWs.delete(s); outs.push(outline(s)); }
    }
    if (!outs.length) continue;
    kinds[kind]++;
    const R = outs.reduce((a, b) => [Math.min(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[3], b[3])]);
    rectCells += nav.buildRect(R[0], R[1], R[2], R[3]);
    for (let k = 0; k < nav.flags.length; k++) if (nav.flags[k] !== flagsBefore[k]) changedCells++;
    flagsBefore = nav.flags.slice();
    const bad = compare(nav, tm, Ctor);
    if (bad) {
      mismatches++;
      if (first.length < 5) first.push(`${t} ${kind} rect ${R.map((v) => v.toFixed(2)).join(',')}: ${bad}`);
      nav.build(nav.blocked);
      flagsBefore = nav.flags.slice();
    }
  }
  // put the level back: one rect over everything, then the grid must equal the one at the start
  const outs = [];
  for (const c of added) { tm.removeCollider(c); outs.push(outline(c)); }
  for (const s of addedWs) { tm.removeWalkSurface(s); outs.push(outline(s)); }
  for (const c of removed) { tm.addCollider(c); outs.push(outline(c)); }
  for (const s of removedWs) { tm.addWalkSurface(s); outs.push(outline(s)); }
  let restored = null;
  if (outs.length) {
    const R = outs.reduce((a, b) => [Math.min(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[3], b[3])]);
    nav.buildRect(R[0], R[1], R[2], R[3]);
    restored = compare(nav, tm, Ctor);
  }
  return {
    level: /** @type {any} */ (window.__game).game.level?.name, ownGrid: own, cells: nav.cols * nav.rows, open: nav.stats.open, tight: nav.stats.tight,
    trials, kinds, mismatches, first, baseline, restored, changedCells, meanRectCells: Math.round(rectCells / Math.max(1, trials)),
  };
}

/** @param {number[]} a @returns {number} */
function median(a) {
  const s = a.slice().sort((x, y) => x - y);
  return s[s.length >> 1];
}

/**
 * @param {{ reps?: number, at?: [number, number] }} [opts] at: the bridge's centre (default: the
 *   middle of the first open run of ≥ 24 × 8 cells found scanning from the map's centre)
 * @returns {object} medians in ms
 */
export function timing({ reps = 15, at = null } = {}) {
  const { nav, tm, Ctor, own } = subject();
  const g = /** @type {any} */ (window.__game).game;
  let [x, z] = at ?? [tm.width / 2, tm.depth / 2];
  if (!at) {
    // the nearest open cell to the centre (the bridge lies on real ground or water)
    let best = Infinity;
    for (let k = 0; k < nav.flags.length; k++) {
      if (!(nav.flags[k] & F_OPEN)) continue;
      const cx = ((k % nav.cols) + 0.5) * 0.5;
      const cz = (Math.floor(k / nav.cols) + 0.5) * 0.5;
      const d = (cx - tm.width / 2) ** 2 + (cz - tm.depth / 2) ** 2;
      if (d < best) { best = d; x = cx; z = cz; }
    }
  }
  const deck = { minX: x - 5, maxX: x + 5, minZ: z - 1.5, maxZ: z + 1.5, y: tm.getHeight(x, z) + 0.5 };
  const posts = [[deck.minX, deck.minZ], [deck.maxX, deck.minZ], [deck.minX, deck.maxZ], [deck.maxX, deck.maxZ]]
    .map(([px, pz]) => ({ type: 'circle', x: px, z: pz, r: 0.18 }));
  const R = { minX: deck.minX - 0.18, maxX: deck.maxX + 0.18, minZ: deck.minZ - 0.18, maxZ: deck.maxZ + 0.18 };
  const toggle = (on) => {
    if (on) { tm.addWalkSurface(deck); for (const c of posts) tm.addCollider(c); }
    else { tm.removeWalkSurface(deck); for (const c of posts) tm.removeCollider(c); }
  };
  const full = [];
  const rect = [];
  const viaCombat = [];
  for (let i = 0; i < reps; i++) {
    toggle(i % 2 === 0);
    let t0 = performance.now();
    nav.buildRect(R.minX, R.maxX, R.minZ, R.maxZ);
    rect.push(performance.now() - t0);
    if (own) {
      toggle(i % 2 !== 0);
      t0 = performance.now();
      g.combat.rebuildNav(R);
      viaCombat.push(performance.now() - t0);
      toggle(i % 2 === 0);
      g.combat.rebuildNav(R);
    }
    t0 = performance.now();
    nav.build(nav.blocked);
    full.push(performance.now() - t0);
  }
  // a batch (performance.now is coarse): the bridge comes and goes 200 times
  const N = 200;
  let t0 = performance.now();
  for (let i = 0; i < N; i++) {
    toggle(i % 2 === 1);
    nav.buildRect(R.minX, R.maxX, R.minZ, R.maxZ);
  }
  const batchRect = (performance.now() - t0) / N;
  toggle(false);
  nav.buildRect(R.minX, R.maxX, R.minZ, R.maxZ);
  const same = compare(nav, tm, Ctor);
  const cells = nav.buildRect(R.minX, R.maxX, R.minZ, R.maxZ);
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return {
    level: g.level?.name, ownGrid: own, gridCells: nav.cols * nav.rows, bridge: { x: r3(x), z: r3(z), rect: R, rectCells: cells },
    fullMsMedian: r3(median(full)), fullMsMin: r3(Math.min(...full)), rectMsMedian: r3(median(rect)), rectMsMax: r3(Math.max(...rect)),
    rebuildNavRectMsMedian: own ? r3(median(viaCombat)) : null, rectMsBatchMean: r3(batchRect),
    speedup: Math.round(median(full) / batchRect), afterwards: same ?? 'identical to a full build',
  };
}
