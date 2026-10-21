/**
 * Cinderwatch play-through (COMBAT.md §23) — a bot that plays `cinderwatch-pass` with **real key
 * events**: every move, attack, roll, skill, draught, lock, talk, open and rest is a
 * `KeyboardEvent` dispatched on `window`, read by the engine's `Input` exactly like a player's keys
 * (no combat test hooks drive the player; the hooks are only read for observation). It runs as an
 * engine system at order −100, before the Game reads its input in the same frame, so a tap lands
 * on that frame and is released on the next.
 *
 * Two modes:
 * - **fixed step** (the page loaded with `&fixedstep=1`, `sandbox/combat.play.json`): the engine
 *   runs no animation loop (`Engine#manualStep`); this module steps it with dt = 1/60 s as fast as
 *   the page allows, from the level's very first frame. Page time is virtual too — `setTimeout`,
 *   `setInterval`, `requestAnimationFrame` and `performance.now()` follow the stepped frames
 *   (`FixedClock`), so the death screen's arm delay, the fades, the dialog close and the results
 *   card land on the same frame every time. The run is deterministic: the same tree gives the
 *   same path, fights, kills, level, time and result on any GPU load (compare `summary`, `digest`).
 *   The game is paused while the harness takes a screenshot, so shots show the frame that asked.
 *   A chunk loaded mid-run (the party's, at the first join) arrives between two frames
 *   (`chunkLoads`), not in real time.
 *   `start({ renderEvery: n })` draws only every n-th frame (`sandbox/combat.play.fast.json`, n = 4):
 *   the same run and digest (rendering feeds nothing back into the game), about twice as fast.
 * - **real time** (no flag, `sandbox/combat.play.realtime.json`): the engine loop as a player
 *   has it, for feel checks; frame pacing changes the path and fights, so run it alone.
 *
 * The plan walks the whole level: the drillmaster's lesson on the camp dummies (and her reward),
 * the party — Rook and Sister Ilse at the camp, Sela at the Crossroads Waystone join by their talk
 * scripts (the level is balanced for that party of four, ADR-056; `party: false`: alone) —,
 * the camp's secret chest, the glade, the glade chest, the Crossroads Waystone (attune and rest),
 * the Bramble Ruins (gate goblins, court, shaman, both ledge archer groups up the stair, the ledge
 * chest and the ridge-pocket chest), the quarry lip (Quarry Waystone; Odo's stores: the Whetstone
 * and whatever else the purse allows), the quarry fights, a death on purpose (standing still next
 * to Old Ironhide) and the respawn at the quarry waystone, the quarry chest, Odo again (the rest of
 * the wares, then draughts) and Cinderheart (after a fall there: draughts from Odo, then back up).
 * Fights read the telegraphs the way a player does: it rolls out of an enemy ground marker just
 * before it fills (inward through Shockwave rings, sideways out of lanes), out of a melee wind-up,
 * steps out of magma, drinks below 35 % HP and uses the skills.
 *
 * Balance runs (COMBAT-12; `start` options): `route` — `ruins` (the default), `mire` (the east
 * branch) or `full` (a thorough player: the whole glade and both branches); `skill` — `expert` (the
 * default) or `human` (SKILL_PRESETS: late and missed dodges, attacks in bursts at ≈ 30 % damage
 * uptime, skills a little late; its draws are seeded, so it is deterministic too;
 * `sandbox/combat.play.human.json`); `shop: false` skips the shops; `party: false` plays alone (no
 * `join` task). `report()` adds `zones` (per
 * zone: time, fight time, hurts, damage and damage in shares of max HP, deaths, draughts, damage
 * uptime, level / XP / gold / stats at the end; the planned fall is left out), `bossAttempts`
 * (each attempt: won, time, phase, the boss's HP left, uptime, damage), `damageBy` (damage taken
 * per enemy kind and boss move), `bought` / `goldSpent`, `segments` (per task) and `party` (the
 * companions' kills, damage dealt and taken, downs; per zone too: `allyKills`, `allyDowns`). Boss probes:
 * `route: 'boss'` with `at` (the Quarry Waystone), `kill` (groups killed first), `player`
 * (setPlayer values incl. `upgrades`) and `delay` (idle frames first: another sample).
 *
 *   sandbox/combat.play.json:           game.html?level=cinderwatch-pass&autostart=1&fixedstep=1 (its
 *                                       first step; any --page / --query will do, e.g.
 *                                       --page=sandbox/index.html --query= --wait=0)
 *   sandbox/combat.play.fast.json:      the same, drawing every 4th frame
 *   sandbox/combat.play.realtime.json:  --query="level=cinderwatch-pass&autostart=1" --wait=5000
 *   const P = await import('/sandbox/combat_play.js'); await P.start(); … await P.until(120000); P.verify()
 *
 * `verify()` returns `{ summary, verdict, … }`: `summary` is one line of exact numbers (frames,
 * game time, level, XP, gold, kills, deaths, chests, the boss times, the run digest) to compare
 * two runs; `trace` holds the digest every 10 s of game time, to find where two runs part.
 *
 * Navigation: A* on a 0.5 u grid whose edges are probed with `tileMap.move` (the player's own
 * collision: radius 0.3, max step 0.55), so stairs, cliffs, props and water are exactly the game's.
 * Nothing here is part of the game; it is a verification tool.
 */

/**
 * @import { Enemy } from '../src/game/combat/Enemy.js'
 * @import { TileMap } from '../src/engine/world/TileMap.js'
 * @import { CombatPlayerSettings } from '../src/game/combat/types.js'
 */

const RES = 0.5;
/** Clearance of the navigation grid: a little more than the player's 0.3 u radius, so paths keep off
 * razor-thin gaps between a prop collider and a cliff that the 8-way key chords cannot thread. */
const NAV_R = 0.4;
const SQ2 = Math.SQRT2;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const KEY_NAMES = {
  KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyJ: 'j', KeyK: 'k', KeyL: 'l', KeyU: 'u', KeyI: 'i', KeyO: 'o',
  KeyC: 'c', Space: ' ', ShiftLeft: 'Shift', ArrowDown: 'ArrowDown', ArrowUp: 'ArrowUp', Enter: 'Enter',
};
/** The 8 key chords and their input vectors (x = right, y = forward). */
const CHORDS = [
  { keys: ['KeyW'], x: 0, y: 1 }, { keys: ['KeyS'], x: 0, y: -1 }, { keys: ['KeyD'], x: 1, y: 0 }, { keys: ['KeyA'], x: -1, y: 0 },
  { keys: ['KeyW', 'KeyD'], x: 1, y: 1 }, { keys: ['KeyW', 'KeyA'], x: -1, y: 1 }, { keys: ['KeyS', 'KeyD'], x: 1, y: -1 }, { keys: ['KeyS', 'KeyA'], x: -1, y: -1 },
];

const G = () => window.__game;
const SYS = () => window.__game.game.combat;
const hyp = Math.hypot;

// =============================================================================================
// Fixed step: virtual page time
// =============================================================================================

/** The fixed frame (s) and its length in virtual ms. */
const FRAME_DT = 1 / 60;
const FRAME_MS = 1000 / 60;
/** The virtual clock's origin (ms). Fixed, so every run reads the same `performance.now()` values
 * (a per-run origin would round `now + delay` differently); above any real load time. */
const CLOCK_BASE = 1e6;
/** Virtual timer / frame ids start here, far above the browser's own (a clear of a real id passes
 * through to the browser). */
const VIRTUAL_ID = 1e9;

/** The page's own timers and clock (captured when this module loads, before any install). */
const REAL = {
  setTimeout: window.setTimeout.bind(window),
  clearTimeout: window.clearTimeout.bind(window),
  setInterval: window.setInterval.bind(window),
  clearInterval: window.clearInterval.bind(window),
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  now: performance.now.bind(performance),
};
/** The window's own functions, put back by FixedClock#uninstall. */
const ORIGINAL = Object.fromEntries(['setTimeout', 'setInterval', 'requestAnimationFrame', 'clearTimeout', 'clearInterval', 'cancelAnimationFrame'].map((k) => [k, window[k]]));
const realSleep = (ms) => new Promise((r) => REAL.setTimeout(r, ms));

/** A fresh task (every pending promise continuation has run by then); MessageChannel, not
 * setTimeout, so there is no 4 ms clamp. */
let _chan = null;
const _waiting = [];
function nextTask() {
  if (!_chan) {
    _chan = new MessageChannel();
    _chan.port1.onmessage = () => _waiting.shift()?.();
  }
  return new Promise((r) => {
    _waiting.push(r);
    _chan.port2.postMessage(0);
  });
}

/** Microtask turns given to the page after each timer, frame callback batch and frame. */
const SETTLE_TURNS = 16;
/**
 * Let pending promise continuations run (the fades, the death screen, the dialog close) — a fixed
 * number of microtask turns, the same every run. Not a task: a task boundary lets the browser
 * composite the canvas, and the next draw then waits for the display (the run would be tied to
 * 60 Hz again).
 */
async function settle() {
  for (let i = 0; i < SETTLE_TURNS; i++) await null;
}

/** Frames run between two real tasks (the browser's own events, the harness, screenshots). */
const FRAMES_PER_TASK = 30;

/** Call a page callback; an exception is re-thrown in its own task (a page error, like the
 * browser reports it) and the run goes on. */
function callSafe(fn, args) {
  try {
    fn(...args);
  } catch (err) {
    REAL.setTimeout(() => { throw err; });
  }
}

/**
 * Virtual page time for the fixed-step mode: `setTimeout` / `setInterval` / `requestAnimationFrame`
 * and `performance.now()` follow the stepped frames instead of the wall clock. `advance()` moves
 * the clock one frame, fires the timers now due in (time, id) order — `settle()` after each, so
 * the promise chains they settle (fades, the death screen, the dialog close) go on before the
 * next — and then the animation-frame callbacks queued before this frame.
 */
class FixedClock {
  constructor() {
    this.frame = 0;
    this.now = CLOCK_BASE;
    this.fired = 0;
    this._timers = new Map(); // id → { id, at, every, fn, args }
    this._tid = VIRTUAL_ID;
    this._rafs = [];
    this._rid = VIRTUAL_ID;
    this._installed = false;
  }

  install() {
    if (this._installed) return;
    this._installed = true;
    const w = window;
    w.setTimeout = (fn, ms, ...args) => this._add(fn, ms, args, false);
    w.setInterval = (fn, ms, ...args) => this._add(fn, ms, args, true);
    w.clearTimeout = (id) => this._clear(id, REAL.clearTimeout);
    w.clearInterval = (id) => this._clear(id, REAL.clearInterval);
    w.requestAnimationFrame = (fn) => {
      const id = ++this._rid;
      if (typeof fn === 'function') this._rafs.push({ id, fn });
      return id;
    };
    w.cancelAnimationFrame = (id) => {
      if (id > VIRTUAL_ID) {
        const k = this._rafs.findIndex((r) => r.id === id);
        if (k >= 0) this._rafs.splice(k, 1);
      } else REAL.cancelAnimationFrame(id);
    };
    performance.now = () => this.now;
  }

  /**
   * Back to real time: pending virtual timers and frame callbacks move to the browser's (a clear
   * of their old virtual id still reaches them).
   */
  uninstall() {
    if (!this._installed) return;
    this._installed = false;
    const w = window;
    for (const k of ['setTimeout', 'setInterval', 'requestAnimationFrame']) w[k] = ORIGINAL[k];
    delete performance.now;
    const moved = new Map();
    for (const t of this._timers.values()) {
      moved.set(t.id, t.every > 0 ? REAL.setInterval(t.fn, t.every, ...t.args) : REAL.setTimeout(t.fn, Math.max(0, t.at - this.now), ...t.args));
    }
    this._timers.clear();
    for (const r of this._rafs) moved.set(r.id, REAL.requestAnimationFrame(r.fn));
    this._rafs.length = 0;
    w.clearTimeout = (id) => REAL.clearTimeout(moved.get(id) ?? id);
    w.clearInterval = (id) => REAL.clearInterval(moved.get(id) ?? id);
    w.cancelAnimationFrame = (id) => REAL.cancelAnimationFrame(moved.get(id) ?? id);
  }

  _add(fn, ms, args, repeat) {
    const id = ++this._tid;
    if (typeof fn !== 'function') return id;
    const d = Number(ms) > 0 ? Number(ms) : 0;
    this._timers.set(id, { id, at: this.now + d, every: repeat ? Math.max(1, d) : 0, fn, args });
    return id;
  }

  _clear(id, real) {
    if (id > VIRTUAL_ID) this._timers.delete(id);
    else if (id) real(id);
  }

  _due() {
    let best = null;
    for (const t of this._timers.values()) {
      if (t.at <= this.now && (!best || t.at < best.at || (t.at === best.at && t.id < best.id))) best = t;
    }
    return best;
  }

  /** One frame of virtual time: the due timers, then the frame callbacks. */
  async advance() {
    this.frame++;
    this.now = CLOCK_BASE + this.frame * FRAME_MS;
    for (let n = 0; n < 10000; n++) {
      const t = this._due();
      if (!t) break;
      if (t.every > 0) {
        t.at += t.every;
        if (t.at <= this.now) t.at = this.now + t.every; // (no catch-up bursts, like the browser)
      } else this._timers.delete(t.id);
      this.fired++;
      callSafe(t.fn, t.args);
      await settle();
    }
    if (this._rafs.length) {
      const list = this._rafs;
      this._rafs = [];
      for (const r of list) callSafe(r.fn, [this.now]);
      await settle();
    }
  }
}

/** The installed virtual clock (fixed-step mode) or null (real time). */
let clock = null;

/** Does the page URL carry `?<name>` (any value but '0')? */
function urlFlag(name) {
  const q = new URLSearchParams(window.location.search);
  return q.has(name) && q.get(name) !== '0';
}

/** The frame loop in progress (fixed step): a new call ends it first, so two loops never
 * interleave (an `until()` the harness gave up on — its eval timed out — would otherwise keep
 * stepping beside the next one and run the virtual clock ahead of the engine). */
let _loop = null;

/** Fixed step: draw every n-th frame only (start option `renderEvery`; 1 = every frame). */
let renderEvery = 1;

/**
 * Fixed step: advance whole frames (virtual time, then `engine.step(1/60)`) until `stop()` is
 * true, `maxFrames` frames ran or `ms` real milliseconds passed. Returns the frames run. A real
 * task every FRAMES_PER_TASK frames (counted over the whole run) keeps the page responsive. With
 * `every` > 1 only every n-th frame (of the whole run) is drawn — rendering feeds nothing back into
 * the game, so the run is the same, only faster — and the last frame is drawn before returning.
 */
async function runFixed(stop, { ms = 120000, maxFrames = Infinity, every = renderEvery } = {}) {
  while (_loop) {
    _loop.cancel = true;
    await _loop.done;
  }
  let finish;
  const me = { cancel: false, done: new Promise((r) => { finish = r; }) };
  _loop = me;
  const engine = G().engine;
  const t0 = REAL.now();
  let n = 0;
  let drawn = true;
  try {
    while (!me.cancel && !stop() && n < maxFrames && REAL.now() - t0 < ms) {
      await chunkLoads();
      await clock.advance();
      drawn = every <= 1 || clock.frame % every === 0;
      engine.step(FRAME_DT, { render: drawn });
      await settle();
      n++;
      if (clock.frame % FRAMES_PER_TASK === 0) await nextTask();
    }
    if (!drawn) engine.redraw();
  } finally {
    if (_loop === me) _loop = null;
    finish();
  }
  return n;
}

/** Chunk loads seen settled (`chunkLoads`). @type {WeakSet<Promise<any>>} */
const _settled = new WeakSet();

/**
 * Fixed step: a chunk the game loads in the middle of the run — the party's, at the first join
 * (`Game.ensureParty`) — arrives in real time. Wait for it before the next frame instead of running
 * frames meanwhile: it lands at the same frame however fast the frames go (`renderEvery`), as the
 * timers and the clock do.
 */
async function chunkLoads() {
  const p = G().game?._partyLoad;
  if (!p || _settled.has(p)) return;
  await p.catch(() => {});
  _settled.add(p);
  await settle();
}

/** FNV-1a over 32-bit words: the run digest (the exact float bits of the watched values). */
const _dg = new Float64Array(12);
const _dgw = new Uint32Array(_dg.buffer);
function foldDigest(h) {
  for (let i = 0; i < _dgw.length; i++) {
    h ^= _dgw[i];
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const hex = (h) => (h >>> 0).toString(16).padStart(8, '0');

// =============================================================================================
// Keys
// =============================================================================================

function keyEvent(type, code) {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: KEY_NAMES[code] ?? code, bubbles: true, cancelable: true }));
}

/** Held keys follow `want` each frame; taps go down now and up at the start of the next frame. */
class Keys {
  constructor() {
    this.held = new Set();
    this.want = new Set();
    this.up = [];
    this.taps = 0;
  }

  begin() {
    for (const c of this.up) keyEvent('keyup', c);
    this.up.length = 0;
    this.want.clear();
  }

  hold(code) { this.want.add(code); }

  tap(code) {
    if (this.held.has(code)) {
      keyEvent('keyup', code);
      this.held.delete(code);
    }
    keyEvent('keydown', code);
    this.up.push(code);
    this.taps++;
  }

  flush() {
    for (const c of [...this.held]) {
      if (!this.want.has(c)) {
        keyEvent('keyup', c);
        this.held.delete(c);
      }
    }
    for (const c of this.want) {
      if (!this.held.has(c)) {
        keyEvent('keydown', c);
        this.held.add(c);
      }
    }
  }

  releaseAll() {
    this.want.clear();
    this.flush();
    for (const c of this.up) keyEvent('keyup', c);
    this.up.length = 0;
  }
}

// =============================================================================================
// Navigation (A* on a 0.5 u grid, edges probed with the player's own tileMap.move)
// =============================================================================================

/**
 * Fields created on first use (a class field would change the code): Nav's push-out scratch
 * point, the Bot's boss and the enemies it found no path to (cleared per group task).
 * @typedef {Nav & { _q?: { x: number, z: number } }} NavLazy
 * @typedef {Bot & { _boss?: Enemy|null, _unreachable?: Set<Enemy> }} BotLazy
 */

class Nav {
  /** @param {TileMap} tm */
  constructor(tm) {
    this.tm = tm;
    // node centres on multiples of 0.5 u: tile centres are nodes, so one-tile stairs and gaps
    // (0.5 u from both walls) are walkable for the 0.3 u player circle
    this.W = Math.floor(tm.width / RES) + 1;
    this.D = Math.floor(tm.depth / RES) + 1;
    const n = this.W * this.D;
    this.node = new Uint8Array(n); // 0 unknown, 1 ok, 2 blocked
    this.edge = new Uint8Array(n * 8);
    this.g = new Float32Array(n);
    this.stamp = new Uint32Array(n);
    this.from = new Int32Array(n);
    this.closed = new Uint32Array(n);
    this.run = 0;
    this._o = { x: 0, z: 0 };
    this._p = { x: 0, z: 0 };
    this.probes = 0;
  }

  cx(n) { return (n % this.W) * RES; }
  cz(n) { return Math.floor(n / this.W) * RES; }
  idx(x, z) {
    const i = Math.max(0, Math.min(this.W - 1, Math.round(x / RES)));
    const j = Math.max(0, Math.min(this.D - 1, Math.round(z / RES)));
    return j * this.W + i;
  }

  ok(n) {
    let v = this.node[n];
    if (!v) {
      const x = this.cx(n);
      const z = this.cz(n);
      const tm = this.tm;
      // standable for the player circle and not inside a prop collider
      v = 2;
      if (x > 0.45 && z > 0.45 && x < tm.width - 0.45 && z < tm.depth - 0.45 && tm._canOccupy(x, z, NAV_R, tm.getHeight(x, z), 0.55)) {
        const q = /** @type {NavLazy} */ (this)._q ??= { x: 0, z: 0 };
        tm._pushOut(x, z, NAV_R, q);
        if (Math.abs(q.x - x) < 1e-4 && Math.abs(q.z - z) < 1e-4) v = 1;
      }
      this.node[n] = v;
    }
    return v === 1;
  }

  /** Can the player walk straight from (ax, az) to (bx, bz)? (probed with the grid's clearance) */
  straight(ax, az, bx, bz, r = NAV_R) {
    this.probes++;
    this._p.x = ax;
    this._p.z = az;
    const o = this.tm.move(this._p, bx - ax, bz - az, r, 0.55, this._o);
    return hyp(o.x - bx, o.z - bz) < 0.03;
  }

  edgeOk(n, k) {
    const e = n * 8 + k;
    let v = this.edge[e];
    if (!v) {
      const i = n % this.W;
      const j = Math.floor(n / this.W);
      const ni = i + DIRS[k][0];
      const nj = j + DIRS[k][1];
      if (ni < 0 || nj < 0 || ni >= this.W || nj >= this.D) v = 2;
      else {
        const m = nj * this.W + ni;
        v = this.ok(n) && this.ok(m) && this.straight(this.cx(n), this.cz(n), this.cx(m), this.cz(m)) ? 1 : 2;
      }
      this.edge[e] = v;
    }
    return v === 1;
  }

  /** Forget the probed nodes / edges within `r` u (villagers are moving colliders). */
  forget(x, z, r = 3) {
    const s = Math.ceil(r / RES);
    const c = this.idx(x, z);
    const ci = c % this.W;
    const cj = Math.floor(c / this.W);
    for (let j = Math.max(0, cj - s); j <= Math.min(this.D - 1, cj + s); j++) {
      for (let i = Math.max(0, ci - s); i <= Math.min(this.W - 1, ci + s); i++) {
        const n = j * this.W + i;
        this.node[n] = 0;
        this.edge.fill(0, n * 8, n * 8 + 8);
        // the neighbours' edges into this node
        for (let k = 0; k < 8; k++) {
          const ni = i - DIRS[k][0];
          const nj = j - DIRS[k][1];
          if (ni >= 0 && nj >= 0 && ni < this.W && nj < this.D) this.edge[(nj * this.W + ni) * 8 + k] = 0;
        }
      }
    }
  }

  /** The nearest walkable node to (x, z) within `r` u (or -1). */
  nearest(x, z, r = 1.5) {
    let best = -1;
    let bd = Infinity;
    const s = Math.ceil(r / RES);
    const c = this.idx(x, z);
    const ci = c % this.W;
    const cj = Math.floor(c / this.W);
    for (let dj = -s; dj <= s; dj++) {
      for (let di = -s; di <= s; di++) {
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || j < 0 || i >= this.W || j >= this.D) continue;
        const n = j * this.W + i;
        const d = hyp(this.cx(n) - x, this.cz(n) - z);
        if (d < bd && d <= r && this.ok(n)) { bd = d; best = n; }
      }
    }
    return best;
  }

  /**
   * A* from (sx, sz) to (tx, tz).
   * @returns {{x:number, z:number}[]|null} node centres (the start excluded), the exact goal last
   */
  path(sx, sz, tx, tz, { maxExpand = 60000, near = 1.5 } = {}) {
    const s = this.nearest(sx, sz, 1.0);
    const t = this.nearest(tx, tz, near);
    if (s < 0 || t < 0) return null;
    const run = ++this.run;
    const W = this.W;
    const tcx = this.cx(t);
    const tcz = this.cz(t);
    const heap = [];
    const push = (n, f) => {
      heap.push([f, n]);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    this.stamp[s] = run;
    this.g[s] = 0;
    this.from[s] = -1;
    push(s, hyp(this.cx(s) - tcx, this.cz(s) - tcz));
    let expanded = 0;
    let found = false;
    while (heap.length) {
      const [, n] = pop();
      if (this.closed[n] === run) continue;
      this.closed[n] = run;
      if (n === t) { found = true; break; }
      if (++expanded > maxExpand) break;
      const gn = this.g[n];
      for (let k = 0; k < 8; k++) {
        if (!this.edgeOk(n, k)) continue;
        const m = n + DIRS[k][1] * W + DIRS[k][0];
        const gm = gn + (k < 4 ? RES : RES * SQ2);
        if (this.stamp[m] === run && this.g[m] <= gm) continue;
        this.stamp[m] = run;
        this.g[m] = gm;
        this.from[m] = n;
        push(m, gm + hyp(this.cx(m) - tcx, this.cz(m) - tcz));
      }
    }
    if (!found) return null;
    const out = [];
    for (let n = t; n !== s && n >= 0; n = this.from[n]) out.push({ x: this.cx(n), z: this.cz(n) });
    out.reverse();
    if (this.straight(out.length ? out[out.length - 1].x : this.cx(s), out.length ? out[out.length - 1].z : this.cz(s), tx, tz, 0.3)) out.push({ x: tx, z: tz });
    return out;
  }
}

// =============================================================================================
// Telegraph reading
// =============================================================================================

/** Is (px, pz) inside marker `s` (grown by `m`)? */
function insideMarker(s, px, pz, m) {
  const dx = px - s.x;
  const dz = pz - s.z;
  const d = hyp(dx, dz);
  switch (s.shape) {
    case 'circle': return d < s.r + m;
    case 'ring': return d > (s.rInner ?? 0) - m && d < s.r + m;
    case 'sector': {
      if (d >= s.r + m) return false;
      if (d < 0.3) return true;
      const al = hyp(s.dirX, s.dirZ) || 1;
      const cos = (dx * s.dirX + dz * s.dirZ) / (d * al);
      return Math.acos(Math.max(-1, Math.min(1, cos))) <= (s.halfAngle * Math.PI) / 180 + 0.35;
    }
    case 'lane': {
      const al = hyp(s.dirX, s.dirZ) || 1;
      const ax = s.dirX / al;
      const az = s.dirZ / al;
      const t = dx * ax + dz * az;
      return t >= -m && t <= s.len + m && Math.abs(dx * az - dz * ax) < s.width / 2 + m;
    }
    case 'rect': return Math.abs(dx) < s.w / 2 + m && Math.abs(dz) < s.d / 2 + m;
    default: return false;
  }
}

/** The direction (unit) that leaves marker `s` fastest from (px, pz). */
function escapeDir(s, px, pz, out) {
  const dx = px - s.x;
  const dz = pz - s.z;
  const d = hyp(dx, dz);
  if (s.shape === 'ring') {
    // Shockwave rings: roll inward, through the ring (the intended answer, Odo's pages)
    out.x = d > 1e-3 ? -dx / d : 0;
    out.z = d > 1e-3 ? -dz / d : 1;
  } else if (s.shape === 'lane') {
    const al = hyp(s.dirX, s.dirZ) || 1;
    const ax = s.dirX / al;
    const az = s.dirZ / al;
    const side = dx * az - dz * ax >= 0 ? 1 : -1;
    out.x = az * side;
    out.z = -ax * side;
  } else if (d > 0.3) {
    out.x = dx / d;
    out.z = dz / d;
  } else {
    out.x = -(s.dirZ || 0);
    out.z = s.dirX || 1;
    const l = hyp(out.x, out.z) || 1;
    out.x /= l;
    out.z /= l;
  }
  return out;
}

// =============================================================================================
// The bot
// =============================================================================================

/** Camp and glade: every route starts here. `zone` groups the tasks in the report's `zones`. */
const PLAN_START = [
  { do: 'talk', npc: 'maren', why: 'the drillmaster explains the controls', zone: 'camp' },
  { do: 'drill', zone: 'camp' },
  { do: 'talk', npc: 'maren', why: 'the drill reward', zone: 'camp' },
  // the party (the level is balanced for four, ADR-056): Rook beside the sparring yard, Ilse by the fire
  { do: 'join', npc: 'rook', zone: 'camp', party: true },
  { do: 'join', npc: 'ilse', zone: 'camp', party: true },
  { do: 'open', chest: 'chest_camp_secret', zone: 'camp' },
  { do: 'walk', to: [48.5, 96.5], why: 'out through the camp gate', zone: 'camp' },
  { do: 'clear', groups: ['glade_slimes_n'], zone: 'glade' },
  { do: 'clear', groups: ['glade_slimes_w'], zone: 'glade' },
  { do: 'open', chest: 'chest_glade', zone: 'glade' },
];
/** The rest of the glade (the thorough route): the east slimes and the goblin pair. */
const PLAN_GLADE_EAST = [
  { do: 'clear', groups: ['glade_goblins'], zone: 'glade' },
  { do: 'clear', groups: ['glade_slimes_e'], zone: 'glade' },
];
const PLAN_CROSSROADS = [
  { do: 'walk', to: [48.5, 79.2], why: 'the crossroads (attunes its waystone)', zone: 'crossroads' },
  { do: 'rest', stone: 'waystone_crossroads', zone: 'crossroads' },
  { do: 'join', npc: 'sela', zone: 'crossroads', party: true },
];
/** The west branch: gate, court, both ledge archer groups up the stair, the ledge and ridge chests. */
const PLAN_RUINS = [
  { do: 'clear', groups: ['ruins_gate_goblins', 'ruins_slimes'], zone: 'ruins' },
  { do: 'clear', groups: ['ruins_court', 'ruins_shaman'], zone: 'ruins' },
  { do: 'clear', groups: ['ruins_archers_w', 'ruins_archers_n'], zone: 'ruins' },
  { do: 'open', chest: 'chest_ruins_ledge', zone: 'ruins' },
  { do: 'open', chest: 'chest_ridge', zone: 'ruins' },
];
/** The east branch: the bats, slimes and shaman of the Hollow Mire, the islet chest, the stair goblins. */
const PLAN_MIRE = [
  { do: 'clear', groups: ['mire_bats_s'], zone: 'mire' },
  { do: 'clear', groups: ['mire_slimes'], zone: 'mire' },
  { do: 'clear', groups: ['mire_shaman'], zone: 'mire' },
  { do: 'clear', groups: ['mire_bats_islet'], zone: 'mire' },
  { do: 'open', chest: 'chest_mire_islet', zone: 'mire' },
  { do: 'clear', groups: ['mire_bats_n'], zone: 'mire' },
  { do: 'clear', groups: ['mire_goblins'], zone: 'mire' },
];
/** The thorough route goes back to the crossroads between the branches. */
const PLAN_BACK = [
  { do: 'walk', to: [50.5, 74.5], why: 'back to the crossroads', zone: 'mire' },
];
/** The quarry: the lip (the Quarry Waystone and Odo's stores), the packs, a planned fall, the chest, Odo again. */
const PLAN_QUARRY = [
  { do: 'walk', to: [48.5, 43.8], why: 'the quarry lip (attunes the Quarry Waystone)', zone: 'quarry' },
  { do: 'shop', npc: 'odo', buy: ['Whetstone', 'Ironbark Tonic', 'Warding Charm'], zone: 'quarry' },
  { do: 'clear', groups: ['quarry_goblins', 'quarry_bats'], zone: 'quarry' },
  { do: 'clear', groups: ['quarry_boar_w'], zone: 'quarry' },
  { do: 'die', group: 'quarry_boar_elite', zone: 'quarry', planned: true, route: 'ruins' },
  { do: 'respawn', zone: 'quarry', planned: true, route: 'ruins' },
  { do: 'clear', groups: ['quarry_boar_elite'], zone: 'quarry' },
  { do: 'clear', groups: ['quarry_archers', 'quarry_boar_e'], zone: 'quarry' },
  { do: 'open', chest: 'chest_quarry', zone: 'quarry' },
  { do: 'shop', npc: 'odo', buy: ['Whetstone', 'Ironbark Tonic', 'Warding Charm', 'Healing Draught'], zone: 'quarry' },
];
const PLAN_BOSS = [
  { do: 'walk', to: [48.5, 25.5], why: 'the caldera stair', zone: 'boss' },
  { do: 'boss', zone: 'boss' },
  { do: 'collect', time: 6, zone: 'boss' },
  { do: 'wait', time: 2.5, shot: 'results', why: 'the results card', zone: 'boss' },
  { do: 'done' },
];
/**
 * The routes (start option `route`): `ruins` (the default: the west branch), `mire` (the east
 * branch) and `full` (a thorough player: the whole glade, both branches).
 */
const onRoute = (name) => (t) => !t.route || t.route === name;
const ROUTES = {
  ruins: [...PLAN_START, ...PLAN_CROSSROADS, ...PLAN_RUINS, ...PLAN_QUARRY, ...PLAN_BOSS].filter(onRoute('ruins')),
  // (the planned fall beside Old Ironhide is the ruins route's: the mire stair comes up under his terrace)
  mire: [...PLAN_START, ...PLAN_CROSSROADS, ...PLAN_MIRE, ...PLAN_QUARRY, ...PLAN_BOSS].filter(onRoute('mire')),
  full: [...PLAN_START, ...PLAN_GLADE_EAST, ...PLAN_CROSSROADS, ...PLAN_RUINS, ...PLAN_BACK, ...PLAN_MIRE, ...PLAN_QUARRY, ...PLAN_BOSS].filter(onRoute('full')),
  // (a balance probe: the boss fight alone — start at the Quarry Waystone, see `start`)
  boss: [...PLAN_BOSS],
};
/** The default route (the full play-through `combat.play.json`). */
const PLAN = ROUTES.ruins;
/** Chests each route opens (checked by `verify`). */
const ROUTE_CHESTS = {
  ruins: ['chest_camp_secret', 'chest_glade', 'chest_ruins_ledge', 'chest_ridge', 'chest_quarry'],
  mire: ['chest_camp_secret', 'chest_glade', 'chest_mire_islet', 'chest_quarry'],
  full: ['chest_camp_secret', 'chest_glade', 'chest_ruins_ledge', 'chest_ridge', 'chest_mire_islet', 'chest_quarry'],
};

/**
 * How well the bot plays (start option `skill`: a preset name or an object of overrides).
 * - `expert` (the default): reads every telegraph at once, rolls out of every one, attacks
 *   whenever it is in reach, drinks below 35 % HP and fires every skill the moment it is ready.
 * - `human`: a model of a careful human at ≈ 30–35 % damage uptime (COMBAT.md §8.3): notices a
 *   telegraph `reaction` s late, misses `miss` of them outright (a seeded draw per telegraph),
 *   attacks in bursts of ≈ `burst` s with ≈ `pause` s of spacing between them (each ±40 %, seeded),
 *   waits `skillDelay` s before using a ready skill, drinks below `healAt` — mid-combo too
 *   (`drinkBusy`: it stops attacking so the buffered draught wins; the expert drinks only between
 *   actions), never in the last 0.2 s of a telegraph it stands in. Deterministic too.
 * `seed` changes the human's draws (not the game's).
 */
const SKILL_PRESETS = {
  expert: { reaction: 0, miss: 0, burst: 0, pause: 0, healAt: 0.35, skillDelay: 0, drinkBusy: false, seed: 1 },
  human: { reaction: 0.25, miss: 0.2, burst: 2.0, pause: 0.9, healAt: 0.3, skillDelay: 2, drinkBusy: true, seed: 1 },
};

/** A deterministic hash of two integers to [0, 1) (the human's draws; never the game's RNG). */
function hash01(a, b) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Player actions that deal damage (the damage uptime). */
const ATTACK_ACTIONS = new Set(['attack', 'skill1', 'skill2', 'skill3']);

class Bot {
  /** @param {StartOptions} [opts] */
  constructor(opts = {}) {
    const g = G();
    this.game = g.game;
    this.sys = SYS();
    this.tm = g.game.tileMap;
    this.nav = new Nav(this.tm);
    this.keys = new Keys();
    /** The route (`ROUTES`) and whether it visits the shops. */
    this.route = ROUTES[opts.route] ? opts.route : 'ruins';
    this.shop = opts.shop ?? true;
    /** Whether it recruits the party (the `join` tasks). */
    this.party = opts.party ?? true;
    const route = ROUTES[this.route].filter((t) => (this.shop || t.do !== 'shop') && (this.party || !t.party));
    const plan = opts.plan ?? route.slice(opts.from ?? 0, opts.to ?? route.length);
    /** @type {Task[]} the tasks left (copies: a task records its own progress) */
    this.plan = plan.map((t) => ({ ...t }));
    // (balance probes: `delay` idle frames first — the same fight from a slightly different start)
    if (opts.delay > 0) this.plan.unshift({ do: 'wait', time: opts.delay / 60, zone: this.plan[0]?.zone });
    if (this.plan[this.plan.length - 1]?.do !== 'done') this.plan.push({ do: 'done' });
    /** How well it plays (SKILL_PRESETS). */
    const sk = typeof opts.skill === 'string' ? SKILL_PRESETS[opts.skill] : null;
    this.skillName = typeof opts.skill === 'string' && sk ? opts.skill : opts.skill ? 'custom' : 'expert';
    this.skill = { ...SKILL_PRESETS.expert, ...(sk ?? (typeof opts.skill === 'object' ? opts.skill : {})) };
    this.seed = this.skill.seed | 0;
    /** Human model state: telegraphs seen (key → { t, miss }), windups seen per enemy, the attack rhythm. */
    this._seen = new Map();
    this._winds = new Map();
    this._rhyT = 0;
    this._rhyN = 0;
    this._resting = false;
    this._readyT = [0, 0, 0];
    /** Fixed-step mode (deterministic) or real time. */
    this.fixed = !!opts.fixed;
    this.task = null;
    this.t = 0;
    this.frame = 0;
    /** Run digest (every frame's player, vitals and enemy state) and its value every 10 s. */
    this.digest = 2166136261;
    this.trace = [];
    /** Real ms per 10 s of game time (how fast the run went; not part of the result). */
    this.pace = [];
    this._paceT = REAL.now();
    this.log = [];
    this.counts = { kills: 0, levelups: 0, pickups: 0, hurts: 0, damageTaken: 0, perfect: 0, rolls: 0, draughts: 0, skills: [0, 0, 0], attacks: 0, deaths: 0, respawns: 0, stuck: 0, replans: 0 };
    /** Per-task figures (`segments`), damage in shares of max HP, attack / fight frames, purchases, boss attempts. */
    this.segs = [];
    this.extra = { dmgShare: 0, atkF: 0, fightF: 0, bossAtkF: 0, bossF: 0, draughtsDrunk: 0, bought: [], goldSpent: 0 };
    /** The companions (the combat's ally events): kills, damage dealt and taken, downs, HP healed; damage by the player. */
    this.allyCounts = { kills: 0, dmg: 0, hurt: 0, downs: 0, healed: 0, playerDmg: 0 };
    this.attempts = [];
    this._attempt = null;
    this.done = false;
    this.failed = [];
    this._path = null;
    this._pi = 0;
    this._pathGoal = null;
    this._pathT = 0;
    this._lastPos = { x: 0, z: 0, t: 0 };
    this._rollT = 0;
    this._rollDir = { x: 0, z: 0 };
    this._atkT = 0;
    /** Until this time (s) the bot does not lock on again (it just let go of a lock on the wrong enemy). */
    this._noLockUntil = 0;
    /** The human's mid-combo draught: when it was last pressed (−1: none pending). */
    this._drinkAt = -1;
    this._markRate = new Map();
    this._esc = { x: 0, z: 0 };
    this._shots = [];
    this._wantShot = null;
    this._hook();
    this._next();
  }

  _hook() {
    const ev = this.sys.events;
    this._on = {
      kill: (e) => { if (!e.passive) this.counts.kills++; },
      levelup: (l) => { this.counts.levelups++; this.note(`level up → Lv ${l}`); },
      pickup: (k) => { this.counts.pickups++; if (k === 'upgrade' || k === 'core') this.note(`picked up ${k}`); },
      playerHurt: (d) => { this.counts.hurts++; this.counts.damageTaken += d; this.extra.dmgShare += d / this.sys.pc.hpMax; },
      playerDeath: () => { this.counts.deaths++; this.note('player died'); },
      respawn: (id) => { this.counts.respawns++; this.note(`respawned at ${id}`); },
      attuned: (id) => this.note(`attuned ${id}`),
      chestFound: (id) => this.note(`found ${id}`),
      bossPhase: (n) => { this.note(`boss phase ${n}`); this.shot(`boss_phase${n}`); },
      bossDefeated: () => { this.note('boss defeated'); this.shot('victory'); },
      purchase: (item, price) => { this.extra.bought.push(item); this.extra.goldSpent += price; this.note(`bought ${item} for ${price} (gold ${this.sys.pc.gold})`); },
      allyKill: () => { this.allyCounts.kills++; },
      allyHit: (id, e, d) => { this.allyCounts.dmg += d; },
      allyHurt: (id, d) => { this.allyCounts.hurt += d; },
      allyDown: (id) => { this.allyCounts.downs++; this.note(`${id} down`); },
      allyHeal: (id, who, got) => { this.allyCounts.healed += got; },
      hit: (e, d) => { if (e !== 'player') this.allyCounts.playerDmg += d; },
    };
    for (const k in this._on) ev.on(k, this._on[k]);
    this._perfectBase = this.sys.pc.perfectDodges;
    // (analysis only: the damage taken by source — enemy kind, the boss's move — `report().damageBy`)
    const sys = this.sys;
    const orig = sys._hitPlayer;
    const by = this.extra.dmgBy = {};
    this._origHitPlayer = orig;
    /** @param {any} owner an Enemy, 'player' or null @param {...any} rest */
    sys._hitPlayer = function hitPlayerTally(owner, ...rest) {
      const hp0 = this.pc.hp;
      const r = orig.call(this, owner, ...rest);
      const d = hp0 - this.pc.hp;
      if (d > 0) {
        const kind = owner && owner !== 'player' ? owner.isAdd ? 'add' : owner.kind ?? '?' : 'none';
        // (the boss's move through its test hook, `combat.boss.info()`, not the brain's internals)
        const key = kind === 'golem' ? `golem:${rest[3] > 0 ? 'magma' : owner.brain.info?.(owner)?.move ?? owner.state}` : kind;
        by[key] = (by[key] ?? 0) + d;
      }
      return r;
    };
  }

  note(text) {
    const p = this.sys.player.position;
    this.log.push(`${this.t.toFixed(1)}s [${this.task?.do ?? '-'}] ${text} @(${p.x.toFixed(1)},${p.z.toFixed(1)})`);
  }

  /** Ask the harness for a screenshot at the next `until()` return. */
  shot(name) {
    if (!this._shots.includes(name)) this._shots.push(name);
  }

  fail(text) {
    this.failed.push(text);
    this.note(`FAIL ${text}`);
  }

  _next() {
    this._closeSeg();
    this.task = this.plan.shift() ?? { do: 'done' };
    this.task.t0 = this.t;
    const c = this.counts;
    const x = this.extra;
    this.task.s0 = { t: this.t, hurts: c.hurts, dmg: c.damageTaken, share: x.dmgShare, deaths: c.deaths, kills: this.sys.kills, dr: x.draughtsDrunk, rolls: c.rolls, atkF: x.atkF, fightF: x.fightF, spent: x.goldSpent, ak: this.allyCounts.kills, ad: this.allyCounts.downs };
    this.task.stage = 0;
    this._path = null;
    this._rollT = 0;
    this._stuckN = 0;
    this.note(`start ${this.task.do} ${this.task.why ?? this.task.npc ?? this.task.chest ?? this.task.stone ?? (this.task.groups ?? []).join('+') ?? ''}`);
  }

  /** Close the finished task's figures (the report's `segments`; `zones` sums them). */
  _closeSeg() {
    const t = this.task;
    if (!t?.s0) return;
    const c = this.counts;
    const x = this.extra;
    const pc = this.sys.pc;
    const s0 = t.s0;
    this.segs.push({
      do: t.do, what: t.chest ?? t.npc ?? t.stone ?? t.group ?? (t.groups ?? []).join('+') ?? t.why ?? '', zone: t.zone ?? '-', planned: !!t.planned,
      t0: +s0.t.toFixed(2), dur: +(this.t - s0.t).toFixed(2),
      hurts: c.hurts - s0.hurts, dmg: c.damageTaken - s0.dmg, dmgShare: +(x.dmgShare - s0.share).toFixed(3),
      deaths: c.deaths - s0.deaths, kills: this.sys.kills - s0.kills, draughts: x.draughtsDrunk - s0.dr, rolls: c.rolls - s0.rolls,
      atkF: x.atkF - s0.atkF, fightF: x.fightF - s0.fightF, spent: x.goldSpent - s0.spent,
      allyKills: this.allyCounts.kills - s0.ak, allyDowns: this.allyCounts.downs - s0.ad,
      lv: pc.level, xp: pc.xp, gold: pc.gold, potions: pc.potions, hpMax: pc.hpMax, atk: pc.atk, def: pc.def,
    });
  }

  /** The segments summed per zone (in route order): time, damage, deaths, draughts, uptime, the state at the end. */
  zones() {
    const out = [];
    const by = new Map();
    for (const g of this.segs) {
      if (g.planned) continue;
      let z = by.get(g.zone);
      if (!z) {
        z = { zone: g.zone, time: 0, fightTime: 0, hurts: 0, dmg: 0, dmgShare: 0, deaths: 0, kills: 0, allyKills: 0, allyDowns: 0, draughts: 0, rolls: 0, atkF: 0, fightF: 0, spent: 0 };
        by.set(g.zone, z);
        out.push(z);
      }
      for (const k of ['hurts', 'dmg', 'deaths', 'kills', 'allyKills', 'allyDowns', 'draughts', 'rolls', 'atkF', 'fightF', 'spent']) z[k] += g[k];
      z.time += g.dur;
      z.dmgShare += g.dmgShare;
      Object.assign(z, { lv: g.lv, xp: g.xp, gold: g.gold, potions: g.potions, hpMax: g.hpMax, atk: g.atk, def: g.def });
    }
    for (const z of out) {
      z.time = +z.time.toFixed(1);
      z.fightTime = +(z.fightF / 60).toFixed(1);
      z.dmgShare = +z.dmgShare.toFixed(2);
      z.uptime = z.fightF ? +(z.atkF / z.fightF).toFixed(3) : 0;
      delete z.atkF;
      delete z.fightF;
    }
    return out;
  }

  /** Per-frame observation (never changes the game): uptime, draughts drunk, boss attempts. */
  _observe() {
    const sys = this.sys;
    const pc = sys.pc;
    const x = this.extra;
    const atk = ATTACK_ACTIONS.has(pc.action);
    const bf = !!sys._bossFight;
    if (atk) x.atkF++;
    if (sys.engaged) x.fightF++;
    if (bf) {
      x.bossF++;
      if (atk) x.bossAtkF++;
    }
    if (this._pots !== undefined && pc.potions < this._pots && pc.action === 'draught') x.draughtsDrunk += this._pots - pc.potions;
    this._pots = pc.potions;
    // the human model counts every enemy's wind-ups (one telegraph key each)
    if (this.skill.miss || this.skill.reaction) {
      for (const e of sys.enemies) {
        let w = this._winds.get(e);
        if (!w) this._winds.set(e, w = { n: 0, st: null });
        if (e.state === 'windup' && w.st !== 'windup') w.n++;
        w.st = e.state;
      }
    }
    const boss = /** @type {BotLazy} */ (this)._boss ??= sys.enemies.find((e) => e.boss) ?? null;
    if (bf && !this._attempt) {
      this._attempt = { t0: this.t, f0: x.bossF, a0: x.bossAtkF, dmg0: this.counts.damageTaken, share0: x.dmgShare, dr0: x.draughtsDrunk, hp: boss?.hp ?? 0, phase: 1 };
    }
    if (bf && this._attempt) {
      this._attempt.hp = boss?.hp ?? 0;
      this._attempt.phase = Math.max(this._attempt.phase, boss?.phase ?? 1);
    }
    if (!bf && this._attempt) {
      const a = this._attempt;
      const f = x.bossF - a.f0;
      this.attempts.push({
        won: !!sys.bossDefeated, time: +(f / 60).toFixed(2), phase: a.phase, bossHp: Math.ceil(sys.bossDefeated ? 0 : a.hp),
        uptime: f ? +((x.bossAtkF - a.a0) / f).toFixed(3) : 0, dmg: this.counts.damageTaken - a.dmg0,
        dmgShare: +(x.dmgShare - a.share0).toFixed(2), draughts: x.draughtsDrunk - a.dr0, lv: pc.level, hpMax: pc.hpMax, atk: pc.atk,
      });
      this._attempt = null;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------------------------

  update(dt) {
    this.keys.begin();
    try {
      this._frame(dt);
    } catch (err) {
      this.fail(`bot error: ${err?.message ?? err}`);
      this.done = true;
      console.error('[combat_play]', err);
    }
    this.keys.flush();
  }

  _frame(dt) {
    if (this.done) return;
    this.t += dt;
    this._dt = dt;
    this.frame++;
    this._fold();
    this._observe();
    const game = this.game;
    if (game.mode !== 'play') return;
    const ui = game.ui;
    // the death screen: any key once it accepts input
    if (ui.combat?.death?.visible) {
      if (this.frame % 20 === 0) this.keys.tap('KeyJ');
      return;
    }
    // dialogs: advance with Space (the first choice is always fine, unless a task picks one:
    // the shop menu — the cursor moves with ArrowDown)
    if (ui.dialog.isOpen) {
      const dlg = ui.dialog;
      if (dlg.isChoosing && this._chooser) {
        const labels = dlg._choiceEls.map((li) => li.querySelector('.lu-choice__label')?.textContent ?? li.textContent ?? '');
        const want = Math.max(0, Math.min(labels.length - 1, this._chooser(labels) | 0));
        if (dlg._choiceIndex !== want) {
          if (this.frame % 6 === 0) this.keys.tap('ArrowDown');
        } else if (this.frame % 14 === 0) this.keys.tap('Space');
        return;
      }
      if (this.frame % 14 === 0) this.keys.tap('Space');
      return;
    }
    if (game.busy || game.mapOpen || game.photoMode) return;

    const task = this.task;
    const elapsed = this.t - task.t0;
    if (elapsed > (task.limit ?? 240)) {
      this.fail(`${task.do} ${task.chest ?? task.npc ?? task.stone ?? (task.groups ?? []).join('+')} timed out after ${Math.round(elapsed)} s`);
      // (a party held back for the planned fall gets its rules back, as after the respawn)
      for (const [id, rule] of task.held ?? []) window.__game.party.rule(id, rule);
      this._next();
      return;
    }
    const handler = this[`_do_${task.do}`];
    if (!handler) { this.fail(`unknown task ${task.do}`); this._next(); return; }
    handler.call(this, dt, task);
  }

  /** Fold this frame's state (the last frame's outcome) into the digest; a trace entry every 10 s. */
  _fold() {
    const sys = this.sys;
    const pc = sys.pc;
    const p = this.p;
    let ep = 0;
    let eh = 0;
    const list = sys.enemies;
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      if (!e.alive) continue;
      ep += e.position.x * (k + 1) + e.position.z * 0.37;
      eh += e.hp;
    }
    const d = _dg;
    d[0] = this.frame;
    d[1] = p.x;
    d[2] = p.y;
    d[3] = p.z;
    d[4] = pc.hp;
    d[5] = pc.mp;
    d[6] = pc.sp;
    d[7] = pc.xp;
    d[8] = pc.gold;
    d[9] = ep;
    d[10] = eh;
    d[11] = sys.kills * 1000 + pc.level;
    this.digest = foldDigest(this.digest);
    if (this.frame % 600 === 0) {
      this.trace.push(`f${this.frame} ${hex(this.digest)} (${p.x.toFixed(3)},${p.z.toFixed(3)}) hp ${Math.ceil(pc.hp)} k ${sys.kills} ${this.task?.do ?? '-'}`);
      const now = REAL.now();
      this.pace.push(Math.round(now - this._paceT));
      this._paceT = now;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Movement
  // ---------------------------------------------------------------------------------------------

  get p() { return this.sys.player.position; }

  /** Hold the chord closest to the world direction (dx, dz). */
  steer(dx, dz, run = false) {
    const l = hyp(dx, dz);
    if (l < 1e-4) return;
    const { forward, right } = G().rig.getMoveBasis();
    let best = null;
    let bd = -2;
    for (const c of CHORDS) {
      let wx = right.x * c.x + forward.x * c.y;
      let wz = right.z * c.x + forward.z * c.y;
      const wl = hyp(wx, wz) || 1;
      wx /= wl;
      wz /= wl;
      const d = (wx * dx + wz * dz) / l;
      if (d > bd) { bd = d; best = c; }
    }
    for (const k of best.keys) this.keys.hold(k);
    if (run) this.keys.hold('ShiftLeft');
  }

  /**
   * Walk toward (x, z) along an A* path (replanned when the goal moves, when the player leaves
   * the path or makes no progress). Returns 'arrived' | 'walking' | 'blocked'.
   */
  goTo(x, z, { run = true, within = 0.35, near = 1.5 } = {}) {
    const p = this.p;
    const d = hyp(x - p.x, z - p.z);
    if (d <= within) return 'arrived';
    const goalMoved = !this._pathGoal || hyp(this._pathGoal.x - x, this._pathGoal.z - z) > 1.2;
    if (!this._path || goalMoved) {
      if (!this._plan(x, z, near)) {
        this.note(`no path to (${x.toFixed(1)}, ${z.toFixed(1)})`);
        return 'blocked';
      }
    }
    // progress watchdog
    if (this.t - this._lastPos.t > 1.5) {
      const moved = hyp(p.x - this._lastPos.x, p.z - this._lastPos.z);
      this._lastPos.x = p.x;
      this._lastPos.z = p.z;
      this._lastPos.t = this.t;
      if (moved < 0.3 && this.sys.pc.action === null) {
        this.counts.stuck++;
        this._stuckN = (this._stuckN ?? 0) + 1;
        if (this._stuckN > 6) {
          this.note(`stuck on the way to (${x.toFixed(1)}, ${z.toFixed(1)})`);
          return 'blocked';
        }
        this.nav.forget(p.x, p.z, 3);
        // wiggle: a short sidestep, alternating sides, before following the new path
        this._wiggleT = 0.35;
        this._wiggleSide = -(this._wiggleSide || 1);
        if (!this._plan(x, z, near)) return 'blocked';
      } else this._stuckN = 0;
    }
    const path = this._path;
    if (this._wiggleT > 0) {
      this._wiggleT -= this._dt || 1 / 60;
      const w0 = path[Math.min(this._pi, path.length - 1)];
      const dx = w0.x - p.x;
      const dz = w0.z - p.z;
      const l = hyp(dx, dz) || 1;
      this.steer(-dz / l * this._wiggleSide - dx / l * 0.3, dx / l * this._wiggleSide - dz / l * 0.3, false);
      return 'walking';
    }
    // advance along the path; aim at the end of the current straight run of grid nodes (an
    // axis or diagonal run — exactly one key chord at camera yaw 0, so the walked line is the
    // probed one)
    for (let j = Math.min(path.length - 2, this._pi + 12); j >= this._pi; j--) {
      if (hyp(path[j].x - p.x, path[j].z - p.z) < 0.4) { this._pi = j + 1; break; }
    }
    let k = this._pi;
    if (k > 0 || path.length > 1) {
      const a = path[Math.max(0, k - 1)];
      const b = path[k];
      const sx = Math.sign(Math.round((b.x - a.x) / RES));
      const sz = Math.sign(Math.round((b.z - a.z) / RES));
      while (k < path.length - 2) {
        const c = path[k];
        const n = path[k + 1];
        if (Math.sign(Math.round((n.x - c.x) / RES)) !== sx || Math.sign(Math.round((n.z - c.z) / RES)) !== sz) break;
        k++;
      }
    }
    const w = path[Math.min(k, path.length - 1)];
    if (hyp(w.x - p.x, w.z - p.z) > 2.5 && this.frame % 30 === 0 && !this.nav.straight(p.x, p.z, w.x, w.z)) {
      // knocked off the path: replan
      this._plan(x, z, near);
    }
    let tx = k >= path.length - 1 ? x : w.x;
    let tz = k >= path.length - 1 ? z : w.z;
    // pure pursuit along the run (a → w): aim 0.6 u ahead of the player's projection on it, so
    // a lateral offset turns into the diagonal chord and the walked line converges on the probed one
    if (this._pi > 0 && k < path.length - 1) {
      const a = path[this._pi - 1];
      const lx = w.x - a.x;
      const lz = w.z - a.z;
      const len = hyp(lx, lz);
      if (len > 1e-3) {
        const ux = lx / len;
        const uz = lz / len;
        const t = Math.max(0, Math.min(len, (p.x - a.x) * ux + (p.z - a.z) * uz));
        const s = Math.min(len, t + 0.6);
        tx = a.x + ux * s;
        tz = a.z + uz * s;
      }
    }
    this.steer(tx - p.x, tz - p.z, run && d > 2);
    return 'walking';
  }

  _plan(x, z, near) {
    const p = this.p;
    const path = this.nav.path(p.x, p.z, x, z, { near });
    this.counts.replans++;
    this._pathGoal = { x, z };
    this._pi = 0;
    if (!path || !path.length) {
      this._path = null;
      return false;
    }
    this._path = path;
    return true;
  }

  /** Face (x, z) by a 1-frame nudge of the chord toward it (the player turns on move input). */
  face(x, z) {
    const p = this.p;
    this.steer(x - p.x, z - p.z, false);
  }

  // ---------------------------------------------------------------------------------------------
  // Combat
  // ---------------------------------------------------------------------------------------------

  enemies() { return this.sys.enemies; }

  /** Alive, visible, non-dormant enemies that are a threat: aggroed, or close. */
  threats(range = 12) {
    const p = this.p;
    const out = [];
    for (const e of this.enemies()) {
      if (!e.alive || e.passive || e.dormant || !e.sprite.visible || e.kind === 'dummy') continue;
      const d = hyp(e.position.x - p.x, e.position.z - p.z);
      if ((e.aggro && d < range) || d < 4) out.push(e);
    }
    return out;
  }

  /**
   * One combat frame against `target` (or the nearest threat). Returns false when there is
   * nothing to fight.
   * @param {number} dt
   * @param {{ target?: Enemy|null, passive?: boolean, pool?: Enemy[]|null }} [opts] passive: take
   *   hits (the death task); pool: the enemies to pick from when no threat is near
   */
  fight(dt, { target = null, passive = false, pool = null } = {}) {
    const sys = this.sys;
    const pc = sys.pc;
    const p = this.p;
    const threats = this.threats();
    if (!target) {
      let bd = Infinity;
      const cands = threats.length ? threats : pool ?? [];
      for (const e of cands) {
        if (!e.alive || /** @type {BotLazy} */ (this)._unreachable?.has(e)) continue;
        const d = hyp(e.position.x - p.x, e.position.z - p.z) + Math.abs(e.position.y - p.y) * 3 + (e.state === 'return' ? 20 : 0);
        if (d < bd) { bd = d; target = e; }
      }
    }
    if (!target) return false;
    // a close, reachable lock is what the swings go for: fight the enemy the player is locked on
    const lk = sys.targeting.lock;
    if (lk && lk !== target && lk.alive && hyp(lk.position.x - p.x, lk.position.z - p.z) < 4 && Math.abs(lk.position.y - p.y) < 0.6) target = lk;
    if (passive) return true;
    const tx = target.position.x;
    const tz = target.position.z;
    const d = hyp(tx - p.x, tz - p.z);
    const dy = Math.abs(target.position.y - p.y);
    const busy = pc.action !== null;

    // ---- defence: a roll in progress keeps its direction for a few frames ----
    if (this._rollT > 0) {
      this._rollT -= dt;
      this.steer(this._rollDir.x, this._rollDir.z);
      return true;
    }
    const danger = this._danger(threats);
    if (danger && (pc.action === null || pc.action === 'attack') && pc.sp >= 12) {
      if (danger.kind === 'walk') {
        this.steer(danger.x, danger.z, true);
        return true;
      }
      this._rollDir.x = danger.x;
      this._rollDir.z = danger.z;
      this._rollT = 0.12;
      this.steer(danger.x, danger.z);
      this.keys.tap('KeyK');
      this.counts.rolls++;
      return true;
    }
    // ---- heal (the human also mid-combo: no attack press, so the buffered draught cancels in) ----
    if (pc.hp < pc.hpMax * this.skill.healAt && pc.potions > 0 && pc.draughtCd <= 0 && !danger) {
      if (!busy) {
        this.keys.tap('KeyC');
        this.counts.draughts++;
        this._drinkAt = -1;
        return true;
      }
      if (this.skill.drinkBusy && pc.action === 'attack') {
        // (re-pressed every 0.12 s, inside the 10-frame input buffer, until the combo step ends)
        if (this._drinkAt < 0) this.counts.draughts++;
        if (this._drinkAt < 0 || this.t - this._drinkAt >= 0.12) {
          this.keys.tap('KeyC');
          this._drinkAt = this.t;
        }
        return true;
      }
    }
    if (!busy || pc.action !== 'attack') this._drinkAt = -1;
    // ---- lock on ----
    const lock = sys.targeting.lock;
    if (!lock && d < 12 && this.frame % 20 === 0 && this.t >= this._noLockUntil) this.keys.tap('KeyL');
    // ---- skills (a human waits `skillDelay` s after one is ready, and not while spacing) ----
    const sk = this.skill;
    for (let i = 0; i < 3; i++) if (pc.cooldowns[i] > 0) this._readyT[i] = this.t;
    const skillOk = (i) => !this._resting && this.t - this._readyT[i] >= sk.skillDelay;
    const near22 = threats.filter((e) => hyp(e.position.x - p.x, e.position.z - p.z) < 2.3 && Math.abs(e.position.y - p.y) < 0.6).length;
    const near30 = threats.filter((e) => hyp(e.position.x - p.x, e.position.z - p.z) < 3.0 && Math.abs(e.position.y - p.y) < 0.6).length;
    if (!busy && pc.level >= 4 && pc.mp >= 18 && pc.cooldowns[2] <= 0 && skillOk(2) && (near30 >= 3 || (target.boss && d < 3 && target.state !== 'windup'))) {
      this.keys.tap('KeyO');
      this.counts.skills[2]++;
      return true;
    }
    if (!busy && pc.mp >= 10 && pc.cooldowns[0] <= 0 && skillOk(0) && (near22 >= 2 || (target.boss && d < 2.6))) {
      this.keys.tap('KeyU');
      this.counts.skills[0]++;
      return true;
    }
    const ranged = target.kind === 'archer' || target.kind === 'shaman' || dy > 0.6 || target.flier;
    if (!busy && pc.level >= 2 && pc.mp >= 8 && pc.cooldowns[1] <= 0 && skillOk(1) && ranged && d > 3 && d < 11 && sys.los(p.x, p.z, tx, tz)) {
      this.face(tx, tz);
      this.keys.tap('KeyI');
      this.counts.skills[1]++;
      return true;
    }
    // ---- approach / attack ----
    const reach = (target.radius ?? 0.4) + 1.15;
    // a human's rhythm: bursts of attacks with spacing between them (±40 %, seeded)
    if (sk.pause > 0) {
      this._rhyT -= dt;
      if (this._rhyT <= 0) {
        this._resting = !this._resting;
        this._rhyT = (this._resting ? sk.pause : sk.burst) * (0.6 + 0.8 * hash01(this.seed ^ 0x5eed, ++this._rhyN));
      }
      if (this._resting) {
        if (busy) return true;
        this._path = null;
        // hang back 3–4.5 u from the target (walking, facing it on the way out)
        if (d < 3 && dy < 0.6) this.steer(p.x - tx, p.z - tz, false);
        else if (d > 4.5 && dy < 0.6) this.goTo(tx, tz, { run: false, within: 4.2, near: 2.5 });
        return true;
      }
    }
    if (d > reach || dy > 0.6) {
      if (busy && pc.action !== 'attack') return true;
      const st = this.goTo(tx, tz, { run: d > 4, within: reach * 0.8, near: 2.5 });
      if (st === 'blocked') {
        (/** @type {BotLazy} */ (this)._unreachable ??= new Set()).add(target);
        this.note(`cannot reach ${target.uid}`);
      }
      return true;
    }
    this._path = null;
    if (lock && lock !== target) {
      // locked on a far or unreachable enemy, the swings would go its way (a boar below the ledge,
      // the archer beside the player): tap the lock on to the next enemy until it lets go, then
      // fight unlocked for 2 s (a human presses L again)
      if (this.frame % 20 === 0) this.keys.tap('KeyL');
      this._noLockUntil = this.t + 2;
      return true;
    }
    if (!lock) this.face(tx, tz);
    this._atkT -= dt;
    if (this._atkT <= 0) {
      this.keys.tap('KeyJ');
      this.counts.attacks++;
      this._atkT = 0.1;
    }
    return true;
  }

  /**
   * What threatens the player right now: a ground marker about to fill with the player inside
   * (roll out; walk out of magma), or a melee wind-up close by (roll away). Returns an escape
   * direction or null.
   */
  _danger(threats) {
    const sys = this.sys;
    const p = this.p;
    let best = null;
    let bestLeft = Infinity;
    for (const m of sys._mk) {
      if (m.h < 0 || m.owner === 'core' || !m.owner) continue;
      const s = m.spec;
      if (s.style === 'player' || s.style === 'lock' || s.style === 'barrier') continue;
      const key = m.gen * 64 + sys._mk.indexOf(m);
      if (s.style === 'magma') {
        if (insideMarker(s, p.x, p.z, 0.45)) {
          escapeDir(s, p.x, p.z, this._esc);
          return { kind: 'walk', x: this._esc.x, z: this._esc.z };
        }
        continue;
      }
      // fill rate → frames left until the hit
      const prev = this._markRate.get(key);
      const now = s.progress;
      let rate = prev ? (now - prev.p) / Math.max(1e-3, this.t - prev.t) : 0;
      if (prev && rate <= 0) rate = prev.rate ?? 0;
      this._markRate.set(key, { p: now, t: this.t, rate });
      if (!(rate > 0) || now >= 1) continue;
      const left = (1 - now) / rate;
      const margin = s.shape === 'ring' ? 0.2 : 0.45;
      if (!insideMarker(s, p.x, p.z, margin)) continue;
      if (!this._sees(key)) continue;
      if (left < bestLeft) { bestLeft = left; best = s; }
    }
    if (this._markRate.size > 400) this._markRate.clear();
    if (best && bestLeft <= 0.2) {
      escapeDir(best, p.x, p.z, this._esc);
      return { kind: 'roll', x: this._esc.x, z: this._esc.z };
    }
    // shockwave rings expand toward the player: roll inward as the ring is about to arrive
    for (const m of sys._mk) {
      if (m.h < 0 || m.owner === 'core' || !m.owner || m.spec.shape !== 'ring') continue;
      const s = m.spec;
      const d = hyp(p.x - s.x, p.z - s.z);
      if (d > s.r && d - s.r < 0.55 && this._sees(m.gen * 64 + sys._mk.indexOf(m))) {
        escapeDir(s, p.x, p.z, this._esc);
        return { kind: 'roll', x: this._esc.x, z: this._esc.z };
      }
    }
    // melee wind-ups without a marker: roll away late in the wind-up
    for (const e of threats) {
      if (e.state !== 'windup') continue;
      if (!this._seesWindup(e)) continue;
      const d = hyp(e.position.x - p.x, e.position.z - p.z);
      if (d > (e.boss ? 4.5 : 2.6)) continue;
      if (e.fr < (e.boss ? 30 : 11)) continue;
      const hasMarker = sys._mk.some((m) => m.h >= 0 && m.owner === e);
      if (hasMarker) continue;
      const l = d || 1;
      return { kind: 'roll', x: (p.x - e.position.x) / l, z: (p.z - e.position.z) / l };
    }
    return null;
  }

  /**
   * Does the bot see this telegraph now? Always for the expert; the human notices it `reaction` s
   * after it first saw it and misses `miss` of them outright (one seeded draw per telegraph).
   */
  _sees(key) {
    const sk = this.skill;
    if (!sk.miss && !sk.reaction) return true;
    let v = this._seen.get(key);
    if (!v) {
      if (this._seen.size > 4000) this._seen.clear();
      v = { t: this.t, miss: hash01(this.seed, key) < sk.miss };
      this._seen.set(key, v);
    }
    return !v.miss && this.t - v.t >= sk.reaction - 1e-9;
  }

  /** `_sees` for a melee wind-up without a marker (one key per wind-up of each enemy, `_observe`). */
  _seesWindup(e) {
    const sk = this.skill;
    if (!sk.miss && !sk.reaction) return true;
    const w = this._winds.get(e);
    return this._sees(0x40000000 + this.sys.enemies.indexOf(e) * 4096 + ((w?.n ?? 0) % 4096));
  }

  /** Walk over nearby pickups (after a fight). Returns true while there is one to collect. */
  collect(range = 7) {
    const p = this.p;
    let best = null;
    let bd = range;
    for (const it of this.sys.pickups.items) {
      if (!it.alive || it.t < 0.5) continue;
      if (it.kind === 'draught' && this.sys.pc.potions >= 5) continue;
      const d = hyp(it.x - p.x, it.z - p.z);
      if (d < bd) { bd = d; best = it; }
    }
    if (!best) return false;
    const st = this.goTo(best.x, best.z, { run: false, within: 0.3, near: 1.2 });
    if (st === 'blocked') best.t = -1e9; // ignore it
    return true;
  }

  // ---------------------------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------------------------

  /** Common: fight anything that attacks first (unless `peaceful`). */
  _defend(dt) {
    const th = this.threats(9);
    if (!th.length) return false;
    return this.fight(dt);
  }

  _do_walk(dt, task) {
    if (this._defend(dt)) return;
    if (this.collect(4)) return;
    const st = this.goTo(task.to[0], task.to[1], { run: true, within: 0.5 });
    if (st === 'arrived') this._next();
    else if (st === 'blocked') { this.fail(`walk to ${task.to} blocked`); this._next(); }
  }

  /**
   * Conversations with `npc` so far: the game's count, or — on a level with a story (Cinderwatch
   * Pass since Sela, docs/specs/PARTY.md §9) — the story's, where the game counts them then.
   */
  _visits(npc) {
    const story = this.game.story;
    return story ? story.state.visitsOf(story.visitKey(npc)) : (this.game.visits.get(npc.id) ?? 0);
  }

  _do_talk(dt, task) {
    const npc = this.game.npcs.find((n) => n.id === task.npc);
    if (!npc) { this.fail(`no npc ${task.npc}`); this._next(); return; }
    if (task.stage === 0) {
      const ip = npc.interactPoint;
      const st = this.goTo(ip.x, ip.z + 0.9, { run: false, within: 0.5 });
      if (st === 'blocked') { this.fail(`cannot reach ${task.npc}`); this._next(); return; }
      if (st !== 'arrived') return;
      task.stage = 1;
      task.tt = this.t;
      return;
    }
    if (task.stage === 1) {
      this.face(npc.position.x, npc.position.z);
      if (this.t - task.tt > 0.15) {
        this.keys.tap('Space');
        task.stage = 2;
        task.tt = this.t;
      }
      return;
    }
    // the dialog opened and closed again (dialogs are handled in _frame)
    if (this.t - task.tt > 0.6) {
      if (this._visits(npc) === 0) {
        if (this.t - task.tt > 3) { this.fail(`talking to ${task.npc} did not start`); this._next(); }
        else if (this.t - task.tt > 1) { task.stage = 1; task.tt = this.t; }
        return;
      }
      this.note(`talked to ${task.npc} (visits ${this._visits(npc)}, potions ${this.sys.pc.potions})`);
      this._next();
    }
  }

  /**
   * A villager joins the party through its talk script: talk to it (every page, its offer's
   * *Walk with me*), then it must be a member. A member already: nothing to do.
   */
  _do_join(dt, task) {
    const member = () => !!this.game.party?.find(task.npc);
    if (task.stage === 0 && member()) { this.note(`${task.npc} is in the party already`); this._next(); return; }
    if (task.stage === 0) this._chooser = (labels) => Math.max(0, labels.findIndex((l) => /Walk with me/.test(l)));
    this._do_talk(dt, task);
    if (this.task !== task) {
      this._chooser = null;
      if (member()) this.note(`${task.npc} joined the party (${this.game.party.count})`);
      else this.fail(`${task.npc} did not join`);
    }
  }

  /** The drillmaster's lesson: a full 3-hit combo on the middle dummy, then one roll. */
  _do_drill(dt, task) {
    const sys = this.sys;
    const dummy = sys.enemies.find((e) => e.uid === 'dummies#1');
    if (task.stage === 0) {
      const st = this.goTo(dummy.position.x, dummy.position.z + 1.5, { run: false, within: 0.3 });
      if (st !== 'arrived') return;
      task.stage = 1;
      task.tt = this.t;
      task.presses = 0;
      return;
    }
    if (task.stage === 1) {
      if (this.t - task.tt < 0.1) { this.face(dummy.position.x, dummy.position.z); return; }
      // J three times, spaced into each swing's chain window
      if (task.presses < 3 && this.t - task.tt > 0.1 + task.presses * 0.3) {
        this.keys.tap('KeyJ');
        task.presses++;
      }
      if (sys.tutorial.combo) {
        this.note('drill: full combo on a dummy');
        this.shot('drill_combo');
        task.stage = 2;
        task.tt = this.t;
      } else if (this.t - task.tt > 3) { task.stage = 0; }
      return;
    }
    if (task.stage === 2) {
      if (sys.pc.action !== null || this.t - task.tt < 0.4) return;
      this.steer(1, 0);
      this.keys.tap('KeyK');
      task.stage = 3;
      task.tt = this.t;
      return;
    }
    if (sys.tutorial.dodge) {
      this.note('drill: roll');
      this._next();
    } else if (this.t - task.tt > 1) task.stage = 2;
  }

  /**
   * Talk to a shopkeeper and buy what `task.buy` lists, in that order, as far as the purse goes
   * (`Healing Draught`: until the satchel is full); then "Nothing more".
   */
  _do_shop(dt, task) {
    const sys = this.sys;
    const npc = this.game.npcs.find((n) => n.id === task.npc);
    if (!npc || !sys.shopOffers) { this.note(`no shop ${task.npc}`); this._next(); return; }
    if (task.stage === 0) {
      if (this._defend(dt)) return;
      const ip = npc.interactPoint;
      const st = this.goTo(ip.x, ip.z + 0.9, { run: true, within: 0.5 });
      if (st === 'blocked') { this.fail(`cannot reach ${task.npc}`); this._next(); return; }
      if (st !== 'arrived') return;
      task.stage = 1;
      task.tt = this.t;
      task.gold0 = sys.pc.gold;
      this._chooser = (labels) => {
        const offers = sys.shopOffers();
        for (const name of task.buy ?? []) {
          const o = offers.find((x) => x.name === name);
          if (!o || !o.available) continue;
          const i = labels.findIndex((l) => l.startsWith(name));
          if (i > 0) return i;
        }
        return 0;
      };
      return;
    }
    if (task.stage === 1) {
      this.face(npc.position.x, npc.position.z);
      if (this.t - task.tt > 0.15) {
        this.keys.tap('Space');
        task.stage = 2;
        task.tt = this.t;
      }
      return;
    }
    // (the menu runs in _frame while the dialog is open)
    if (this.t - task.tt > 0.6) {
      if (this._visits(npc) === 0) {
        if (this.t - task.tt > 3) { this.fail(`talking to ${task.npc} did not start`); this._chooser = null; this._next(); }
        else if (this.t - task.tt > 1) { task.stage = 1; task.tt = this.t; }
        return;
      }
      this._chooser = null;
      this.note(`shopped at ${task.npc}: gold ${task.gold0} → ${sys.pc.gold}, ATK ${sys.pc.atk}, DEF ${sys.pc.def}, HP max ${sys.pc.hpMax}, potions ${sys.pc.potions}`);
      this.shot(`shop_${task.npc}`);
      this._next();
    }
  }

  _chest(id) { return this.sys.chests.list.find((c) => c.id === id); }

  _do_open(dt, task) {
    const c = this._chest(task.chest);
    if (!c) { this.fail(`no chest ${task.chest}`); this._next(); return; }
    if (c.opened && task.stage === 0) { this.note(`${task.chest} already open`); task.stage = 2; task.tt = this.t; }
    if (task.stage === 0) {
      if (this._defend(dt)) return;
      const ip = c.it?.position ?? c;
      const st = this.goTo(ip.x, ip.z, { run: true, within: 0.35, near: 1.0 });
      if (st === 'blocked') { this.fail(`cannot reach ${task.chest}`); this._next(); return; }
      if (st !== 'arrived') return;
      task.stage = 1;
      task.tt = this.t;
      return;
    }
    if (task.stage === 1) {
      this.face(c.x, c.z);
      if (this.t - task.tt > 0.12 && this.t - (task.tap ?? -1) > 0.5) {
        this.keys.tap('Space');
        task.tap = this.t;
      }
      if (c.opened) {
        const g = this.sys.pc.gold;
        this.note(`opened ${task.chest} (gold ${g}, potions ${this.sys.pc.potions})`);
        this.shot(`chest_${task.chest}`);
        task.stage = 2;
        task.tt = this.t;
      } else if (this.t - task.tt > 3) { task.stage = 0; this._path = null; }
      return;
    }
    // collect the contents
    if (this.t - task.tt < 1.0) return;
    if (this.collect(5) && this.t - task.tt < 8) return;
    this._next();
  }

  _do_rest(dt, task) {
    const sys = this.sys;
    const w = sys.waystones.list.find((x) => x.id === task.stone);
    if (task.stage === 0) {
      if (this._defend(dt)) return;
      const st = this.goTo(w.stand.x, w.stand.z, { run: false, within: 0.35, near: 1.0 });
      if (st === 'blocked') { this.fail(`cannot reach ${task.stone}`); this._next(); return; }
      if (st !== 'arrived') return;
      task.stage = 1;
      task.tt = this.t;
      task.hp = sys.pc.hp;
      // take a little damage first? no: resting refills whatever is missing
      return;
    }
    if (task.stage === 1) {
      this.face(w.x, w.z);
      if (this.t - task.tt > 0.15) {
        this.keys.tap('Space');
        task.stage = 2;
        task.tt = this.t;
        task.cp = sys.waystones.checkpoint.id;
      }
      return;
    }
    if (this.t - task.tt > 2.5) {
      const ok = sys.waystones.checkpoint.id === task.stone && sys.pc.hp === sys.pc.hpMax && sys.pc.potions >= 3;
      this.note(`rested at ${task.stone}: checkpoint ${sys.waystones.checkpoint.id}, HP ${Math.ceil(sys.pc.hp)}/${sys.pc.hpMax}, potions ${sys.pc.potions}`);
      if (!ok) this.fail(`rest at ${task.stone} did not refill / attune`);
      this.shot(`rested_${task.stone}`);
      this._next();
    }
  }

  _groupMembers(groups) {
    return this.sys.enemies.filter((e) => !e.isAdd && groups.some((g) => e.uid.startsWith(`${g}#`)));
  }

  _do_clear(dt, task) {
    const members = this._groupMembers(task.groups);
    const alive = members.filter((e) => e.alive);
    if (!task.announced) {
      task.announced = true;
      task.kills0 = this.counts.kills;
    }
    if (!alive.length) {
      if (this.collect(8) && this.t - (task.tEnd ??= this.t) < 8) return;
      this.note(`cleared ${task.groups.join('+')} (kills ${this.counts.kills}, Lv ${this.sys.pc.level}, XP ${this.sys.pc.xp}, gold ${this.sys.pc.gold})`);
      this.shot(`cleared_${task.groups[0]}`);
      /** @type {BotLazy} */ (this)._unreachable?.clear();
      this._next();
      return;
    }
    if (this.fight(dt, { pool: alive })) return;
    // nothing engaged: walk toward the group
    const e = alive[0];
    const st = this.goTo(e.position.x, e.position.z, { run: true, within: 3, near: 2.5 });
    if (st === 'blocked') { this.fail(`cannot reach group ${task.groups}`); this._next(); }
  }

  /** Stand still beside `group` without defending until the player falls. */
  _do_die(dt, task) {
    const sys = this.sys;
    if (!sys.pc.alive) {
      if (!task.dead) { task.dead = true; task.gold = task.goldBefore; this.note(`fell (gold before ${task.goldBefore})`); this.shot('fallen'); }
      this._next();
      this.task.goldBefore = task.goldBefore;
      this.task.checkpoint = sys.waystones.checkpoint.id;
      this.task.killedBefore = sys.enemies.filter((e) => !e.alive && !e.isAdd && !e.boss).map((e) => e.uid);
      this.task.held = task.held;
      return;
    }
    task.goldBefore = sys.pc.gold;
    const e = this._groupMembers([task.group]).find((x) => x.alive);
    if (!e) {
      // (a fight woke it and it fell first — the expert alone kills Old Ironhide on the terrace):
      // no planned fall, nor its respawn check; verify still wants a death and a respawn
      this.note(`no ${task.group} left to fall beside: the planned fall is skipped`);
      // (it may have fallen after the party was held back: its rules back)
      for (const [id, rule] of task.held ?? []) window.__game.party.rule(id, rule);
      this._next();
      if (this.task.do === 'respawn' && this.task.planned) this._next();
      return;
    }
    // with the party: its members hold back while the player falls (the test hook — a player would
    // pick Hold Back in the tactics panel); _do_respawn gives them their rules back
    const party = window.__game.party;
    if (!task.held && this.game.party?.count) {
      task.held = party.info().members.map((m) => [m.id, m.rule]);
      for (const [id] of task.held) party.rule(id, 'passive');
      this.note(`the party holds back (${task.held.map(([id]) => id).join(', ')})`);
    }
    const d = hyp(e.position.x - this.p.x, e.position.z - this.p.z);
    if (d > 2.5 && !e.aggro) this.goTo(e.position.x, e.position.z, { run: true, within: 2, near: 2.5 });
    // otherwise stand still: no rolls, no draughts
    task.limit = 120;
  }

  _do_respawn(dt, task) {
    const sys = this.sys;
    if (!sys.pc.alive || sys.locksPlayer || this.game.busy) return;
    if (task.stage === 0) {
      task.stage = 1;
      task.tt = this.t;
      return;
    }
    if (this.t - task.tt < 0.5) return;
    const cp = sys.waystones.checkpoint;
    const p = this.p;
    const dd = hyp(p.x - cp.stand.x, p.z - cp.stand.z);
    const lost = task.goldBefore - sys.pc.gold;
    const stillDead = (task.killedBefore ?? []).filter((uid) => sys.enemies.find((e) => e.uid === uid)?.alive);
    this.note(`respawn check: at ${cp.id} (${dd.toFixed(2)} u), HP ${Math.ceil(sys.pc.hp)}/${sys.pc.hpMax}, gold ${task.goldBefore} → ${sys.pc.gold}, revived kills ${stillDead.length}`);
    if (dd > 1.5) this.fail(`respawned ${dd.toFixed(2)} u from ${cp.id}`);
    if (sys.pc.hp !== sys.pc.hpMax) this.fail('respawn HP not full');
    if (lost !== Math.ceil(task.goldBefore * 0.1) && lost !== task.goldBefore - Math.floor(task.goldBefore * 0.9)) this.fail(`gold loss ${lost} of ${task.goldBefore}`);
    if (stillDead.length) this.fail(`killed enemies came back: ${stillDead.join(', ')}`);
    // the party's rules back (see _do_die)
    for (const [id, rule] of task.held ?? []) window.__game.party.rule(id, rule);
    this.shot('respawned');
    this._next();
  }

  _do_boss(dt, task) {
    const sys = this.sys;
    const boss = sys.enemies.find((e) => e.boss);
    if (!boss) { this.fail('no boss'); this._next(); return; }
    task.limit = this.skill.miss || this.skill.pause ? 1200 : 420;
    if (!boss.alive || sys.bossDefeated) {
      this.note(`boss down: ${JSON.stringify(sys.state().boss)}`);
      this._next();
      return;
    }
    const a = boss.arena;
    const inside = a.contains(this.p.x, this.p.z);
    task.deaths0 ??= this.counts.deaths;
    if (!inside && !sys._bossFight) {
      // after a fall: restock draughts at the Quarry Waystone's shop first, as a player would
      const shopNpc = this.game.npcs.find((n) => n.id === 'odo');
      if (this.shop && shopNpc && sys.shopOffers && this.counts.deaths > task.deaths0 && task.restocked !== this.counts.deaths
        && sys.pc.alive && sys.pc.potions < 5 && sys.pc.gold >= 25) {
        this.plan.unshift({ do: 'shop', npc: 'odo', buy: ['Healing Draught'], zone: 'boss' },
          { do: 'boss', zone: 'boss', deaths0: task.deaths0, restocked: this.counts.deaths });
        this._next();
        return;
      }
      if (this._defend(dt)) return;
      // (after a death the stair walk starts again from the checkpoint)
      this.goTo(a.center.x, a.rect.maxZ - 3, { run: true, within: 0.6, near: 1.5 });
      return;
    }
    if (sys.locksPlayer) return;
    // the adds first when they are close, else the boss
    const add = this.threats(5).find((e) => e.isAdd);
    this.fight(dt, { target: add ?? boss });
  }

  _do_collect(dt, task) {
    task.tt ??= this.t;
    if ((this.collect(10) || this.t - task.tt < 1.5) && this.t - task.tt < (task.time ?? 6)) return;
    this._next();
  }

  _do_wait(dt, task) {
    task.tt ??= this.t;
    if (this.t - task.tt < (task.time ?? 1)) return;
    if (task.shot) this.shot(task.shot);
    const an = this.game.ui.combat?.announcer;
    if (an?.visible) this.note(`announcer: ${an._title?.textContent} | ${an._sub?.textContent}`);
    this.results = an?.visible ? an._title?.textContent ?? '' : '';
    this._next();
  }

  _do_done() {
    if (!this.done) {
      this.done = true;
      this.keys.releaseAll();
      this.note('plan finished');
    }
  }

  /**
   * The run in exact numbers, to compare two runs: mode, frames, game time, level / XP / gold /
   * draughts, kills, deaths, chests, the boss's fight and phase times, the counters and the digest.
   * @returns {{ line: string, [k: string]: any }}
   */
  summary() {
    const sys = this.sys;
    const s = sys.state();
    const pl = s.player;
    const b = s.boss;
    const c = this.counts;
    const chests = sys.chests.list.filter((x) => x.opened).length;
    const boss = b ? { defeated: !!s.bossDefeated, hp: b.hp, phase: b.phase, fightTime: b.fightTime, phaseTimes: b.phaseTimes } : null;
    /** @type {any} grows below (route … line) */
    const out = {
      mode: this.fixed ? 'fixed' : 'realtime',
      done: this.done,
      frames: this.frame,
      time: +this.t.toFixed(3),
      level: pl.level, xp: pl.xp, gold: pl.gold, potions: pl.potions, hp: Math.ceil(pl.hp),
      kills: s.kills, deaths: c.deaths, respawns: c.respawns, pickups: c.pickups, chests,
      boss,
      hurts: c.hurts, damageTaken: c.damageTaken, rolls: c.rolls, perfectDodges: pl.perfectDodges, draughts: c.draughts,
      skills: c.skills, attacks: c.attacks, keysTapped: this.keys.taps, stuck: c.stuck, replans: c.replans,
      failed: this.failed.length,
      digest: hex(this.digest),
    };
    const bt = boss ? `boss ${boss.defeated ? 'down' : `hp ${boss.hp}`} ${(+boss.fightTime || 0).toFixed(3)} s [${(boss.phaseTimes ?? []).map((x) => (+x).toFixed(3)).join(' ')}]` : 'no boss';
    const who = this.route === 'ruins' && this.skillName === 'expert' && this.shop && this.party ? '' : ` ${this.route}/${this.skillName}${this.shop ? '' : '/noshop'}${this.party ? '' : '/solo'}`;
    const ac = this.allyCounts;
    out.party = { members: this.game.party?.count ?? 0, kills: ac.kills, damage: ac.dmg, hurt: ac.hurt, downs: ac.downs, healed: ac.healed };
    out.route = this.route;
    out.skill = this.skillName;
    out.bossAttempts = this.attempts;
    out.bought = this.extra.bought;
    out.goldSpent = this.extra.goldSpent;
    out.line = `${out.mode}${who} ${this.done ? 'done' : `at ${this.task?.do}`} | f ${out.frames} (${out.time.toFixed(3)} s) | Lv ${out.level} xp ${out.xp} gold ${out.gold} potions ${out.potions} hp ${out.hp} | kills ${out.kills} deaths ${out.deaths} chests ${chests} pickups ${out.pickups}${out.party.members ? ` | party ${out.party.members} kills ${ac.kills} downs ${ac.downs}` : ''} | ${bt} | hurts ${out.hurts} dmg ${out.damageTaken} rolls ${out.rolls} keys ${out.keysTapped} | failed ${out.failed} | digest ${out.digest}`;
    return out;
  }

  report() {
    const sys = this.sys;
    const s = sys.state();
    return {
      done: this.done,
      task: this.task?.do,
      left: this.plan.length,
      time: +this.t.toFixed(1),
      counts: this.counts,
      perfectDodges: s.player.perfectDodges,
      player: { level: s.player.level, hp: s.player.hp, hpMax: s.player.hpMax, xp: s.player.xp, gold: s.player.gold, potions: s.player.potions, atk: s.player.atk, checkpoint: s.player.checkpoint, deaths: s.player.deaths },
      kills: s.kills,
      boss: s.boss,
      bossDefeated: s.bossDefeated,
      chests: sys.chests.list.filter((c) => c.opened).map((c) => c.id),
      failed: this.failed,
      keysTapped: this.keys.taps,
      log: this.log,
      trace: this.trace,
      pace: this.pace,
      route: this.route,
      skill: this.skill,
      zones: this.zones(),
      damageBy: this.extra.dmgBy,
      bossAttempts: this.attempts,
      bought: this.extra.bought,
      goldSpent: this.extra.goldSpent,
      draughtsDrunk: this.extra.draughtsDrunk,
      bossUptime: this.extra.bossF ? +(this.extra.bossAtkF / this.extra.bossF).toFixed(3) : 0,
      segments: this.segs,
      party: { members: this.game.party?.count ?? 0, ...this.allyCounts, playerKills: s.kills - this.allyCounts.kills },
    };
  }

  dispose() {
    for (const k in this._on) this.sys.events.off(k, this._on[k]);
    if (this._origHitPlayer) this.sys._hitPlayer = this._origHitPlayer;
    this.keys.releaseAll();
  }
}

// =============================================================================================
// API
// =============================================================================================

/**
 * `window.__play` (AUTOMATION_API.md §7), set by `start()`.
 * @typedef {object} PlayHandle
 * @property {Bot} bot
 * @property {() => ReturnType<Bot['report']>} report  the run so far, per zone / attempt / task
 * @property {() => ReturnType<Bot['summary']>} summary  exact numbers, incl. the one-line `line`
 * @property {typeof until} until
 */

/** @type {Bot|null} */
let bot = null;
/** The engine system that runs the bot (one object, so a second start() does not add another). */
const botSystem = { name: 'combat_play', update: (dt) => bot?.update(dt) };

/**
 * A plan step (`PLAN_*`): what to do (`do`), its target (npc, chest, stone, groups, to …), why,
 * zone; the Bot adds its own progress fields (t0, s0, stage …) to its copy.
 * @typedef {{ do: string, zone?: string, [k: string]: any }} Task
 */
/**
 * `start()` / Bot options.
 * @typedef {object} StartOptions
 * @property {boolean} [fixed]
 * @property {number} [renderEvery]
 * @property {'ruins'|'mire'|'full'|'boss'} [route]
 * @property {'expert'|'human'|Partial<typeof SKILL_PRESETS.expert>} [skill]
 * @property {boolean} [shop]
 * @property {boolean} [party]
 * @property {Task[]} [plan]
 * @property {number} [from]
 * @property {number} [to]
 * @property {[number, number]} [at]
 * @property {number} [level]
 * @property {string[]} [kill]
 * @property {CombatPlayerSettings} [player]
 * @property {number} [delay]
 */
/**
 * Wait for the game, lock the resolution governor, install the bot as an engine system.
 * @param {StartOptions} [opts]
 *   fixed: fixed-step mode (default: when the page URL has `fixedstep`; it needs that flag, so the
 *   engine has not run a frame yet). renderEvery (fixed step): draw only every n-th frame — the
 *   same run (the same digest), faster on a busy GPU; the load's frames are all drawn, and the
 *   program check can miss a material that shows only between two drawn frames.
 *   route: `ruins` (default), `mire` or `full` (ROUTES); skill: `expert` (default), `human` or an
 *   object of SKILL_PRESETS overrides; shop: visit the shops (default true); party: recruit the
 *   party (default true; false: alone).
 *   from / to: a slice of the plan; at / level: a development shortcut (start a later part of the
 *   plan there, at that level — the full play-through uses neither). Boss probes (`route: 'boss'`
 *   with `at`): kill (group ids killed first), player (setPlayer values), delay (idle frames
 *   first).
 */
export async function start(opts = {}) {
  const fixed = opts.fixed ?? urlFlag('fixedstep');
  const t0 = REAL.now();
  const waitFor = async (ok) => {
    while (!ok()) {
      if (REAL.now() - t0 > 90000) throw new Error('combat_play: the combat level did not load');
      await realSleep(100);
    }
  };
  // the game is built and started (Game.start ran; in fixed-step mode no frame has run yet)
  await waitFor(() => window.__game?.game?.combat && window.__game.engine.running);
  const g = window.__game;
  const engine = g.engine;
  if (fixed && !engine.manualStep) throw new Error('combat_play: fixed-step mode needs the page loaded with &fixedstep=1');
  if (!fixed) {
    // real time: the page's own clock and the engine loop again
    clock?.uninstall();
    clock = null;
    if (engine.manualStep) engine.manualStep = false;
    await waitFor(() => window.__luminati?.loadMs);
  }
  g.game.resolution.enabled = false;
  engine.renderScale = 1;
  bot?.dispose();
  bot = null;
  if (fixed && !clock) {
    clock = new FixedClock();
    clock.install();
    // the frames up to the end of the load (the loading screen gone), like a real-time run that
    // starts after the load; the same number every run
    const n = await runFixed(() => !document.getElementById('loading'), { ms: 90000, maxFrames: 600, every: 1 });
    if (document.getElementById('loading')) throw new Error(`combat_play: the loading screen is still up after ${n} frames`);
  }
  // development shortcut only (the full play-through starts at the spawn with no hooks): start a
  // later part of the plan at `at` with the player at `level` — and for balance probes, `kill`
  // (group ids, killed first through the normal path) and `player` (setPlayer values, upgrades too)
  if (opts.at) {
    for (const gid of opts.kill ?? []) for (const e of g.game.combat.enemies) if (e.uid.startsWith(`${gid}#`)) g.combat.kill(e.uid);
    if (opts.level) g.combat.setPlayer({ level: opts.level });
    if (opts.player) g.combat.setPlayer({ xp: 0, ...opts.player });
    g.game.combat.pickups.clear();
    g.teleport(opts.at[0], opts.at[1]);
  }
  renderEvery = fixed ? Math.max(1, Math.floor(Number(opts.renderEvery) || 1)) : 1;
  bot = new Bot({ ...opts, fixed });
  engine.addSystem(botSystem, -100);
  window.__play = { bot, report: () => bot.report(), summary: () => bot.summary(), until };
  return `bot started (${fixed ? `fixed step, engine frame ${engine.time.frame}${renderEvery > 1 ? `, drawing every ${renderEvery}th frame` : ''}` : 'real time'}): ${bot.plan.length + 1} tasks`;
}

/** Real time: poll until `stop()` or `ms` passed; fixed step: run frames until then. */
async function runUntil(stop, ms) {
  if (clock) {
    await runFixed(stop, { ms });
    return;
  }
  const t0 = REAL.now();
  while (!stop() && REAL.now() - t0 < ms) await realSleep(100);
}

/**
 * Run until the plan is done, a screenshot is wanted or `ms` (real) passed. In fixed-step mode
 * the game then stays on that frame until the next call.
 * @returns {Promise<string>} JSON: { shot, task, done, frame, t, failed, log tail }
 */
export async function until(ms = 120000) {
  const n0 = bot.log.length;
  await runUntil(() => bot.done || bot._shots.length > 0, ms);
  const shot = bot._shots.shift() ?? null;
  return JSON.stringify({ shot, task: bot.task?.do, done: bot.done, frame: bot.frame, t: +bot.t.toFixed(3), failed: bot.failed.length, log: bot.log.slice(n0) });
}

/**
 * The play-through's verdict (throws asynchronously on a failure, so the harness exits 1):
 * finished without a failed task; the drill reward; five chests (every chest on the Ruins route);
 * at least Lv 5, 30 kills and 50 pickups; a death with its respawn at the Quarry Waystone; the boss
 * defeated with the results card; no program compiled after load. Returns `{ summary, verdict,
 * result, … }` — `summary` (one line of exact numbers) first, so the harness prints it.
 */
export async function verify(ms = 150000) {
  await runUntil(() => bot.done, ms);
  const r = bot.report();
  const sys = bot.sys;
  const fails = [...r.failed];
  const want = (ok, msg) => { if (!ok) fails.push(msg); };
  want(r.done, `plan not finished (at ${r.task})`);
  want(sys.tutorial.rewarded, 'drill reward not given');
  for (const id of ROUTE_CHESTS[bot.route] ?? ROUTE_CHESTS.ruins) want(r.chests.includes(id), `${id} not opened`);
  want(r.player.level >= 5, `only Lv ${r.player.level}`);
  want(r.kills >= 30, `only ${r.kills} kills`);
  want(r.counts.pickups >= 50, `only ${r.counts.pickups} pickups`);
  if (bot.route === 'ruins') want(r.counts.deaths >= 1 && r.counts.respawns >= 1, 'no death / respawn');
  want(r.bossDefeated, 'boss not defeated');
  if (bot.party) want(r.party.members === 3, `the party has ${r.party.members} members, not 3`);
  // the shops (Odo at the Quarry Waystone): the default plan buys the Whetstone at the lip
  if (bot.segs.some((g) => g.do === 'shop' && g.what === 'odo')) want(bot.extra.bought.includes('Whetstone'), `the Whetstone not bought at Odo's (${bot.extra.bought.join(', ') || 'nothing'})`);
  want(/Cleared/.test(bot.results ?? ''), `no results card (${bot.results})`);
  const st = sys.stats();
  want(st.programs === st.programsAtLoad, `programs ${st.programsAtLoad} → ${st.programs}`);
  const sum = bot.summary();
  const out = {
    summary: `${fails.length ? `FAIL ${fails.length}` : 'ok'} | ${sum.line}`,
    verdict: fails.length ? fails : 'ok',
    result: sum,
    engineFrame: bot.game.engine.time.frame,
    timersFired: clock?.fired ?? null,
    ...r,
    stats: st,
  };
  for (const f of fails) REAL.setTimeout(() => { throw new Error(`[combat.play] ${f}`); });
  return out;
}

/** The run's summary so far (see Bot#summary). */
export function summary() {
  return bot ? bot.summary() : null;
}

/** Remove the bot; in fixed-step mode also give the page its real time and the engine its loop. */
export function stop() {
  bot?.dispose();
  bot = null;
  window.__game.engine.removeSystem(botSystem);
  if (clock) {
    clock.uninstall();
    clock = null;
    window.__game.engine.manualStep = false;
  }
  return true;
}

/** Debug: A* between two points on a fresh Nav (node counts, success, length). */
export function navDebug(ax, az, bx, bz) {
  const nav = bot?.nav ?? new Nav(window.__game.game.tileMap);
  const t0 = REAL.now();
  const s = nav.nearest(ax, az, 1.0);
  const t = nav.nearest(bx, bz, 1.5);
  const path = nav.path(ax, az, bx, bz);
  return { s, t, sOk: s >= 0, tOk: t >= 0, found: !!path, len: path?.length ?? 0, ms: +(REAL.now() - t0).toFixed(1), probes: nav.probes, run: nav.run, first: path?.slice(0, 4), last: path?.slice(-3) };
}

export function report() {
  return bot ? bot.report() : null;
}
