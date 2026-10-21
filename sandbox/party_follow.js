/**
 * Helpers of the party core's checks (`sandbox/party.follow.json` on Emberfall,
 * `party.follow.campaign.json` on the demo campaigns; docs/specs/PARTY.md §4): join villagers
 * through `__game.party`, drive the player along a route with `player.moveOverride` (and Shift for
 * a run) while every frame records each member — its distance from its own trail point (it stands
 * at arc length SPACING · (k + 1) behind the player when that is ~0), whether it stands on
 * walkable ground, out of the water, on the ground's height, how near the player it comes — and
 * check where the members rest, where a teleport puts them, the talk, the tactics panel's pause and
 * the hidden villagers. `expect` records a failed check and throws it as a page error (the harness
 * exits 1).
 *
 * Until the party UI lands (`ui.party` null: src/game/party/partyUI.js is a stub) `fakeUI()`
 * installs a stand-in panel and HUD frames with the contract's members (PartyPanelLike /
 * PartyFramesLike), so the game's side of them — G, the pause, *Tactics…*, the frames — is checked
 * here; with the real UI the same checks run on it.
 *
 * Installed by an `eval` step: `import('/sandbox/party_follow.js')` → `window.PF`.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));
const G = () => window.__game;
const game = () => window.__game.game;
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : v);

/** Wait until `fn()` holds (every 50 ms, at most `ms`). */
async function until(fn, ms = 20000) {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    if (fn()) return true;
    await sleep(50);
  }
  return false;
}

/** Hold / release Shift (the run) as real key events on the window (the game's Input listens there). */
function shift(down) {
  window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: 'ShiftLeft', key: 'Shift', bubbles: true }));
}

/** A stand-in tactics panel (PartyPanelLike) while the party UI is a stub. */
class FakePanel {
  constructor() {
    this.isOpen = false;
    /** @type {any[]} */
    this.opened = [];
    this.closed = 0;
    /** @type {any[]} */
    this.rules = [];
    this.onRule = null;
    this.onClose = null;
    this.onSound = null;
    this.fake = true;
  }
  open(opts) {
    this.isOpen = true;
    this.opened.push({ focus: opts.focus ?? null, members: opts.members.map((m) => m.id), closeKey: opts.closeKey });
  }
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.closed++;
    this.onClose?.();
  }
  update() { return false; }
  setRule(id, rule) { this.rules.push([id, rule]); }
  dispose() {}
}

/** A stand-in for the party's HUD frames (PartyFramesLike). */
class FakeFrames {
  constructor() {
    this.visible = true;
    /** @type {any[]} */
    this.list = [];
    this.updates = 0;
    this.fake = true;
  }
  update(list) {
    this.list = list;
    this.updates++;
  }
  setVisible(on) { this.visible = on; }
  dispose() {}
}

/** Is (x, z) in water no walk surface covers? */
function inWater(tm, x, z) {
  return tm.getWaterSurface(x, z) !== null && tm._walkHeight(x, z) === null;
}

/**
 * A character sprite's body on screen in pixels (the middle 44 % of its quad's width, the lower
 * 80 % of its height — the frame's padding left out) and its distance from the camera.
 * @param {any} sprite @param {any} cam
 */
function bodyRect(sprite, cam) {
  const mesh = sprite.mesh;
  const pos = mesh.geometry.attributes.position;
  const v = new sprite.position.constructor();
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).project(cam);
    const sx = (v.x * 0.5 + 0.5) * innerWidth;
    const sy = (-v.y * 0.5 + 0.5) * innerHeight;
    x0 = Math.min(x0, sx);
    x1 = Math.max(x1, sx);
    y0 = Math.min(y0, sy);
    y1 = Math.max(y1, sy);
  }
  const w = x1 - x0;
  const h = y1 - y0;
  return { x0: x0 + w * 0.28, x1: x1 - w * 0.28, y0: y0 + h * 0.2, y1, d: cam.position.distanceTo(sprite.position) };
}

const PF = {
  sleep,
  until,
  frame,
  /** The suite's name in the page errors of failed checks. */
  suite: 'party.follow',
  /** Failed checks. */
  failed: [],
  /** The drive going on (`start`), its promise. */
  _drive: null,
  /**
   * A check: a failure is recorded and thrown as a page error (the harness exits 1).
   * @param {unknown} ok
   * @param {string} label
   */
  expect(ok, label) {
    if (ok) return true;
    PF.failed.push(label);
    setTimeout(() => { throw new Error(`${PF.suite}: ${label}`); });
    return false;
  },
  /** Wait for the first gameplay frames. */
  async ready() {
    for (let i = 0; i < 600 && !window.__luminati?.loadMs; i++) await sleep(100);
    await until(() => game()?.mode === 'play', 30000);
    await sleep(400);
    return { loadMs: window.__luminati?.loadMs ?? null, level: game().level.name, programs: PF.programs() };
  },
  programs() {
    return game().engine.renderer.info.programs.length;
  },
  /** The scene's size and the party's sprites in it. */
  scene() {
    let objects = 0;
    let members = 0;
    game().engine.scene.traverse((o) => {
      // (the player's talk silhouette moves to whichever villager is in reach: not counted)
      if (o.name === 'Player.talkSilhouette') return;
      objects++;
      if (o.name?.startsWith('Party:')) members++;
    });
    return { objects, members };
  },
  /** Is the party's code loaded? (the dev server serves it as its own module) */
  partyLoaded() {
    return performance.getEntriesByType('resource').some((e) => /\/src\/game\/party\/(?:Party|PartyMember)\.js/.test(e.name));
  },
  /** Before anyone joined: no party, no binding, no state key, no party code. */
  nobody() {
    const g = game();
    const s = G().state();
    const r = { party: g.party === null, state: !('party' in s), binding: !g.engine.input.bindings.party, loaded: PF.partyLoaded(), ui: g.ui.party === null };
    PF.expect(r.party && r.state && r.binding && !r.loaded && r.ui, `a level nobody joined: no party, no state key, no G binding, no party code, no party UI: ${JSON.stringify(r)}`);
    return r;
  },
  /** The party UI, or stand-ins while it is a stub (after the party exists). */
  fakeUI() {
    const ui = game().ui;
    if (!ui.party) ui.party = /** @type {any} */ ({ panel: new FakePanel(), frames: new FakeFrames() });
    return { fake: ui.party.panel instanceof FakePanel };
  },
  /** The member `id` (PartyMember) or null. */
  member(id) {
    return game().party?.members.find((m) => m.id === id) ?? null;
  },
  /** The level's villager `id` (Npc) or null. */
  npc(id) {
    return game().npcById.get(id) ?? null;
  },
  /**
   * How much of the player's body on screen the members nearer the camera cover (the sum of their
   * overlaps, a fraction of the player's body rect), and per member its own share (0 for a member
   * behind the player: the player is drawn over it).
   */
  coverage() {
    const g = game();
    const cam = g.engine.camera;
    const pr = bodyRect(g.player.sprite, cam);
    const area = Math.max(1, (pr.x1 - pr.x0) * (pr.y1 - pr.y0));
    let sum = 0;
    const each = {};
    for (const m of g.party?.members ?? []) {
      if (!m.sprite?.visible) continue;
      const r = bodyRect(m.sprite, cam);
      const w = Math.max(0, Math.min(pr.x1, r.x1) - Math.max(pr.x0, r.x0));
      const h = Math.max(0, Math.min(pr.y1, r.y1) - Math.max(pr.y0, r.y0));
      const ov = r.d < pr.d ? (w * h) / area : 0;
      each[m.id] = r3(ov);
      sum += ov;
    }
    return { sum: r3(sum), each };
  },
  /** The members, short: id, place, follow mode, distance to the player. */
  brief() {
    const P = game().player.position;
    return (game().party?.members ?? []).map((m) => `${m.id}@${m.position.x.toFixed(2)},${m.position.z.toFixed(2)}:${m.follow.mode}:${Math.hypot(m.position.x - P.x, m.position.z - P.z).toFixed(2)}`);
  },
  /**
   * Is (x, z) a spot the player could stand on (the game's own test, radius 0.3)? For checking a
   * route before driving it.
   */
  standable(x, z) {
    const tm = game().tileMap;
    const r = 0.3;
    return [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([a, b]) => tm.isWalkable(x + a, z + b));
  },
  /** The first spot of a straight walk from a to b (every 0.2 u) the player cannot stand on, or null. */
  blocked(a, b) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = 0; s <= d; s += 0.2) {
      const x = a[0] + ((b[0] - a[0]) * s) / d;
      const z = a[1] + ((b[1] - a[1]) * s) / d;
      if (!PF.standable(x, z)) return [r3(x), r3(z)];
    }
    return null;
  },
  /** Every leg of a route the player cannot walk (a probe before `drive`). */
  checkRoute(from, points) {
    const bad = [];
    let a = from;
    for (const b of points) {
      const q = PF.blocked(a, b);
      if (q) bad.push({ leg: [a, b], at: q });
      a = b;
    }
    return bad;
  },
  /**
   * Drive the player through the waypoints (world [x, z]) with `moveOverride` (Shift held when
   * `run`), recording the members every frame. Resolves with the record when the last waypoint is
   * reached (or the player is stuck 2 s, or `timeout`): per member the largest distance from its
   * trail point (after `warm` s), frames off walkable ground / in water / off the ground's height,
   * the nearest it came to the player, its highest point (stairs), the modes it was in, snaps.
   * @param {[number, number][]} points
   * @param {{ run?: boolean, timeout?: number, reach?: number, warm?: number, label?: string }} [o]
   */
  async drive(points, { run = false, timeout = 40000, reach = 0.25, warm = 1.2, label = '' } = {}) {
    const g = game();
    const pl = g.player;
    const party = g.party;
    const tm = g.tileMap;
    const rec = new Map();
    for (const m of party.members) {
      rec.set(m.id, {
        id: m.id, maxOff: 0, offFrames: 0, maxGap: 0, gapFrames: 0, maxStep: 0, halts: 0, unwalkable: 0, water: 0, offGround: 0, maxGroundDiff: 0,
        minPlayer: Infinity, maxY: -Infinity, modes: new Set(), snaps0: m.follow.snaps, catchups0: m.follow.catchups, run: 0, walk: 0, idle: 0,
        last: { x: m.position.x, z: m.position.z, v: 0 },
      });
    }
    const cover = { max: 0, sum: 0, n: 0, over10: 0 };
    if (run) shift(true);
    const t0 = performance.now();
    let i = 0;
    let stuckT = 0;
    let last = { x: pl.position.x, z: pl.position.z };
    let frames = 0;
    let stuck = false;
    const t = { x: 0, y: 0, z: 0, short: false };
    const spacing = party.trailInfo(undefined, 0).spacing;
    try {
      while (i < points.length && performance.now() - t0 < timeout) {
        const [tx, tz] = points[i];
        const p = pl.position;
        const dx = tx - p.x;
        const dz = tz - p.z;
        const d = Math.hypot(dx, dz);
        if (d < reach) {
          i++;
          continue;
        }
        pl.moveOverride = { x: dx / d, z: dz / d };
        const tf = performance.now();
        await frame();
        frames++;
        const fdt = Math.max(1e-3, (performance.now() - tf) / 1000);
        const el = (performance.now() - t0) / 1000;
        const moved = Math.hypot(p.x - last.x, p.z - last.z);
        stuckT = moved < 0.004 ? stuckT + 1 / 60 : 0;
        last = { x: p.x, z: p.z };
        if (stuckT > 2) {
          stuck = true;
          break;
        }
        for (let k = 0; k < party.members.length; k++) {
          const m = party.members[k];
          const r = rec.get(m.id);
          if (!r || !m.sprite) continue;
          const q = m.position;
          const fo = m.follow;
          r.modes.add(fo.mode);
          const a = m.sprite.animation ?? '';
          if (a.startsWith('run')) r.run++;
          else if (a.startsWith('walk')) r.walk++;
          else r.idle++;
          if (!tm.isWalkable(q.x, q.z)) r.unwalkable++;
          if (inWater(tm, q.x, q.z)) r.water++;
          const gd = Math.abs(q.y - tm.getHeight(q.x, q.z));
          r.maxGroundDiff = Math.max(r.maxGroundDiff, gd);
          if (gd > 0.45) r.offGround++;
          r.maxY = Math.max(r.maxY, q.y);
          r.minPlayer = Math.min(r.minPlayer, Math.hypot(q.x - p.x, q.z - p.z));
          // a frame's step (no jump: never farther than a run at the members' top speed allows) and
          // a halt (from a walk to a stand in one frame: the follow eases its stops)
          const step = Math.hypot(q.x - r.last.x, q.z - r.last.z);
          const v = step / fdt;
          if (fo.mode !== 'catchup' || step < 1) r.maxStep = Math.max(r.maxStep, step);
          if (r.last.v > 2 && v < 0.2 && !fo.held) r.halts++;
          r.last = { x: q.x, z: q.z, v };
          if (el >= warm && fo.mode === 'trail' && !fo.held) {
            // its distance from the trail point at SPACING · (k + 1) (for the record: the follow
            // lags it on purpose — a beat late, braking, to the side) and from its own goal this
            // frame (the trail point it follows, `follow.gx / gz`): what it can make up
            party.trail.pointBehind(p.x, p.z, spacing * (k + 1), t);
            r.maxOff = Math.max(r.maxOff, Math.hypot(t.x - q.x, t.z - q.z));
            const gap = Math.hypot(fo.gx - q.x, fo.gz - q.z);
            r.maxGap = Math.max(r.maxGap, gap);
            if (gap > 1.0) r.gapFrames++;
          }
        }
        if (el >= warm) {
          const c = PF.coverage().sum;
          cover.max = Math.max(cover.max, c);
          cover.sum += c;
          cover.n++;
          if (c > 0.1) cover.over10++;
        }
      }
    } finally {
      pl.moveOverride = null;
      if (run) shift(false);
    }
    const out = {
      label, reached: i >= points.length, stuck, frames, seconds: r3((performance.now() - t0) / 1000),
      player: [r3(pl.position.x), r3(pl.position.y), r3(pl.position.z)],
      cover: { max: r3(cover.max), mean: r3(cover.sum / Math.max(1, cover.n)), over10: cover.over10, frames: cover.n },
      members: [...rec.values()].map((r) => {
        const m = PF.member(r.id);
        return {
          id: r.id, maxOff: r3(r.maxOff), maxGap: r3(r.maxGap), gapFrames: r.gapFrames, maxStep: r3(r.maxStep), halts: r.halts,
          unwalkable: r.unwalkable, water: r.water, offGround: r.offGround,
          maxGroundDiff: r3(r.maxGroundDiff), minPlayer: r3(r.minPlayer), maxY: r3(r.maxY), modes: [...r.modes],
          snaps: (m?.follow.snaps ?? 0) - r.snaps0, catchups: (m?.follow.catchups ?? 0) - r.catchups0, run: r.run, walk: r.walk, idle: r.idle,
        };
      }),
    };
    return out;
  },
  /** Start a drive without waiting for it (screenshots on the way); `done()` waits for it. */
  start(points, o = {}) {
    PF._drive = PF.drive(points, o);
    return 'driving';
  },
  async done() {
    const r = await PF._drive;
    PF._drive = null;
    return r;
  },
  /**
   * The checks of a drive's record: reached its end, every member on walkable ground, out of the
   * water, on the ground, keeping up with its goal (the trail point it follows — a beat late, to
   * the side: within `maxGap`, the braking distance of a run and a little), no jump (a frame's step
   * ≤ 0.9 u), no halt (walk → stand in one frame), never snapped; the player's body covered by
   * members in front of it at most `cover` on average (a fraction of the player's body on screen).
   * @param {any} r
   * @param {{ maxGap?: number, snaps?: number, minY?: number, cover?: number }} [o]
   */
  checkDrive(r, { maxGap = 1.0, snaps = 0, minY, cover } = {}) {
    PF.expect(r.reached && !r.stuck, `${r.label}: the player walked the route (${JSON.stringify(r.player)})`);
    for (const m of r.members) {
      PF.expect(m.unwalkable === 0 && m.water === 0, `${r.label}: ${m.id} never off walkable ground or in the water (${m.unwalkable} / ${m.water} frames)`);
      PF.expect(m.offGround === 0, `${r.label}: ${m.id} follows the ground's height (largest gap ${m.maxGroundDiff})`);
      PF.expect(m.maxGap <= maxGap, `${r.label}: ${m.id} keeps up with the trail point it follows (largest gap ${m.maxGap} u ≤ ${maxGap}; ${m.gapFrames} frames > 1 u)`);
      PF.expect(m.maxStep <= 0.9, `${r.label}: ${m.id} never jumps (largest step in a frame ${m.maxStep} u)`);
      PF.expect(m.halts === 0, `${r.label}: ${m.id} never halts from a walk in one frame (${m.halts})`);
      PF.expect(m.snaps <= snaps, `${r.label}: ${m.id} snapped ${m.snaps} times (≤ ${snaps})`);
      if (minY !== undefined) PF.expect(m.maxY >= minY, `${r.label}: ${m.id} climbed to ${m.maxY} (≥ ${minY})`);
    }
    if (cover !== undefined) PF.expect(r.cover.mean <= cover, `${r.label}: the members in front of the player cover ${r.cover.mean} of its body on average (≤ ${cover}; largest ${r.cover.max})`);
    return r;
  },
  /**
   * The party sets off and stops a beat after the player, one after another, easing in and out:
   * from a stand the player walks `dir` for `ms`, then stops; every frame each member's step is
   * recorded (on the game's clock, once per engine frame). Per member: how long after the player
   * it set off and came to a stand (s), its pace before it stood (u/s over its last 3 moving
   * frames), the largest drop of pace in one frame (u/s), the frames it took from a walk (≥ 2.5 u/s)
   * to a stand. Checked: each sets off no sooner than the one before it and no one in the player's
   * frame (REACT), none drops from a walk to a stand in fewer than 3 frames. Without `dir` the
   * player walks away from the members (they follow, none is in its way), else at right angles
   * to that — the first way clear for the walk.
   * @param {[number, number]|null} dir @param {number} [ms] @param {string} [label]
   */
  async stopStart(dir, ms = 1500, label = 'stop and start') {
    const g = game();
    const pl = g.player;
    const time = g.engine.time;
    const ms_ = g.party.members.filter((m) => m.sprite);
    await PF.until(() => ms_.every((m) => (m.sprite.animation ?? '').startsWith('idle')), 4000);
    if (!dir) {
      const P = pl.position;
      let ax = P.x - ms_.reduce((s, m) => s + m.position.x, 0) / ms_.length;
      let az = P.z - ms_.reduce((s, m) => s + m.position.z, 0) / ms_.length;
      const l = Math.hypot(ax, az) || 1;
      ax /= l;
      az /= l;
      const len = (ms / 1000) * 3.4 + 0.6;
      /** @type {[number, number][]} */
      const ways = [[ax, az], [-az, ax], [az, -ax]];
      dir = ways.find(([x, z]) => !PF.blocked([P.x, P.z], [P.x + x * len, P.z + z * len])) ?? ways[0];
    }
    /** @type {{ t: number, p: boolean, m: { x: number, z: number }[] }[]} */
    const rows = [];
    const t0 = time.elapsed;
    let f0 = -1;
    const rec = () => {
      if (time.frame === f0) return;
      f0 = time.frame;
      rows.push({ t: time.elapsed - t0, p: pl.speed > 0.05, m: ms_.map((m) => ({ x: m.position.x, z: m.position.z })) });
    };
    rec();
    const w0 = performance.now();
    pl.moveOverride = { x: dir[0], z: dir[1] };
    try {
      while (performance.now() - w0 < ms) {
        await frame();
        rec();
      }
    } finally {
      pl.moveOverride = null;
    }
    const tStop = time.elapsed - t0;
    while (performance.now() - w0 < ms + 1500) {
      await frame();
      rec();
    }
    const out = ms_.map((m, k) => {
      let start = null;
      let stop = null;
      let maxDrop = 0;
      let lastMove = -1;
      const v = [0];
      for (let i = 1; i < rows.length; i++) {
        const a = rows[i - 1].m[k];
        const b = rows[i].m[k];
        const dt = Math.max(1e-3, rows[i].t - rows[i - 1].t);
        const s = Math.hypot(b.x - a.x, b.z - a.z) / dt;
        v.push(s);
        if (start === null && s > 0.05) start = rows[i].t;
        if (s > 0.05) lastMove = i;
        if (i > 1) maxDrop = Math.max(maxDrop, v[i - 1] - s);
      }
      if (lastMove > 0 && rows[lastMove].t > tStop - 0.05) stop = rows[Math.min(rows.length - 1, lastMove + 1)].t - tStop;
      // frames from its last walking pace (≥ 2.5 u/s) to the stand
      let walkI = lastMove;
      while (walkI > 0 && v[walkI] < 2.5) walkI--;
      const before = lastMove > 3 ? (v[lastMove] + v[lastMove - 1] + v[lastMove - 2]) / 3 : 0;
      return { id: m.id, k, start: start === null ? null : r3(start), stop: stop === null ? null : r3(stop), before: r3(before), maxDrop: r3(maxDrop), easeFrames: lastMove - walkI };
    });
    const first = rows.findIndex((r) => r.p);
    const tStart = first >= 0 ? rows[first].t : 0;
    for (const o of out) {
      PF.expect(o.start !== null && o.start > tStart + 0.01, `${label}: ${o.id} sets off a beat after the player (${o.start} s / the player ${r3(tStart)} s)`);
      PF.expect(o.easeFrames >= 3, `${label}: ${o.id} eases into its stand (${o.easeFrames} frames from a walk to a stand; pace before ${o.before} u/s, largest drop in a frame ${o.maxDrop} u/s)`);
    }
    for (let k = 1; k < out.length; k++) PF.expect(out[k].start >= out[k - 1].start, `${label}: ${out[k].id} sets off no sooner than ${out[k - 1].id} (${out[k].start} / ${out[k - 1].start} s)`);
    return { label, player: { start: r3(tStart), stop: r3(tStop) }, members: out };
  },
  /**
   * After the player stopped (`ms` of play): every member stands (idle) on its rest spot — its
   * trail point unless that is within GAP of the player or APART of another member or in front of
   * the player on the screen —, not on the player (≥ 0.7 u), not on another member (≥ 0.5 u), and
   * faces the player's way; no member in front of the player covers its body on screen (`clear`:
   * the sum of their overlaps ≤ 0.02 unless false).
   */
  async checkRest(label, ms = 2200, { clear = true } = {}) {
    await sleep(ms);
    const g = game();
    const pl = g.player;
    const P = pl.position;
    const ms_ = g.party.members.filter((m) => m.sprite && !m.directed && !m.talking);
    const cov = PF.coverage();
    if (clear) PF.expect(cov.sum <= 0.02, `${label}: no member stands in front of the player on the screen (covers ${cov.sum} of its body: ${JSON.stringify(cov.each)})`);
    /** @type {any[]} */
    const out = [{ cover: cov }];
    for (const m of ms_) {
      const q = m.position;
      const near = Math.min(...ms_.filter((o) => o !== m).map((o) => Math.hypot(o.position.x - q.x, o.position.z - q.z)), Infinity);
      const anim = m.sprite.animation ?? '';
      const r = { id: m.id, mode: m.follow.mode, dist: r3(Math.hypot(q.x - P.x, q.z - P.z)), near: r3(near), anim, dir: m.sprite.direction, playerDir: pl.sprite.direction };
      out.push(r);
      PF.expect(anim.startsWith('idle'), `${label}: ${m.id} stands (idle) once the player stopped (${anim})`);
      PF.expect(r.dist >= 0.7, `${label}: ${m.id} does not stand on the player (${r.dist} u)`);
      PF.expect(r.near >= 0.5, `${label}: ${m.id} does not stand on another member (${r.near} u)`);
      PF.expect(r.dir === r.playerDir, `${label}: ${m.id} faces the player's way after a moment (${r.dir} / ${r.playerDir})`);
    }
    return out;
  },
  /**
   * Right after a teleport: the members behind the player (on the far side of the player's facing
   * or beside it), on standable ground, within 3.5 u, apart, facing the player's way, waiting
   * ('placed').
   */
  checkPlaced(label, { behind = true } = {}) {
    const g = game();
    const pl = g.player;
    const P = pl.position;
    const f = pl.facing;
    const out = [];
    const list = g.party.members.filter((m) => m.sprite);
    for (const m of list) {
      const q = m.position;
      const dx = q.x - P.x;
      const dz = q.z - P.z;
      const d = Math.hypot(dx, dz);
      const ahead = (dx * f.x + dz * f.z) / Math.max(d, 1e-6);
      const near = Math.min(...list.filter((o) => o !== m).map((o) => Math.hypot(o.position.x - q.x, o.position.z - q.z)), Infinity);
      const r = { id: m.id, d: r3(d), ahead: r3(ahead), near: r3(near), mode: m.follow.mode, dir: m.sprite.direction };
      out.push(r);
      PF.expect(m.follow.mode === 'placed', `${label}: ${m.id} waits where it was put (${m.follow.mode})`);
      PF.expect(d >= 0.7 && d <= 3.5, `${label}: ${m.id} close behind the player (${r.d} u)`);
      if (behind) PF.expect(ahead <= 0.2, `${label}: ${m.id} behind (or beside) the player, not in front (${r.ahead})`);
      PF.expect(near >= 0.55, `${label}: ${m.id} apart from the others (${r.near} u)`);
      PF.expect(PF.standable(q.x, q.z), `${label}: ${m.id} on standable ground`);
      PF.expect(r.dir === pl.sprite.direction, `${label}: ${m.id} faces the player's way (${r.dir} / ${pl.sprite.direction})`);
    }
    return out;
  },
  /**
   * Placements everywhere (the review's sweep): the player put on every standable spot of the
   * level `step` u apart, facing each of the four ways, and the members placed behind it
   * (`placeBehind`) — each must stand on a standable spot, reachable from the player (in a straight
   * line, or round one corner), not on the player (≥ 0.5 u) unless no room was left anywhere near (then on the player's
   * own spot, counted in `unplaced`: a pocket too small for three).
   * The player and the members are put back afterwards. → the placements, the bad ones (and a
   * sample), the time it took.
   * @param {number} [step]
   */
  sweep(step = 1) {
    const g = game();
    const party = g.party;
    const pl = g.player;
    const P = pl.position;
    const f = pl.facing;
    const saved = { x: P.x, y: P.y, z: P.z, fx: f.x, fz: f.z };
    const tm = g.tileMap;
    const bad = [];
    let n = 0;
    let badN = 0;
    const un0 = party.stats.unplaced;
    const t0 = performance.now();
    for (let j = step / 2; j < tm.depth; j += step) {
      for (let i = step / 2; i < tm.width; i += step) {
        if (!PF.standable(i, j)) continue;
        for (const [fx, fz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          P.set(i, tm.getHeight(i, j), j);
          f.x = fx;
          f.z = fz;
          party.placeBehind(party.members);
          n++;
          for (const m of party.members) {
            const q = m.position;
            const st = party._standable(q.x, q.z);
            // (straight, or round one corner: from a standable spot near the player it reaches straight)
            const reach = PF.reachable(i, j, q.x, q.z);
            const d = Math.hypot(q.x - i, q.z - j);
            // (bad: not standable, not reachable, or nearer the player than 0.5 u without being on its spot —
            // a member with no room anywhere near is put on the player's own spot: `unplaced`)
            if (!st || !reach || (d < 0.5 && d > 1e-6)) {
              badN++;
              if (bad.length < 12) bad.push({ at: [i, j], face: [fx, fz], id: m.id, q: [r3(q.x), r3(q.z)], st, reach, d: r3(d) });
            }
          }
        }
      }
    }
    P.set(saved.x, saved.y, saved.z);
    f.x = saved.fx;
    f.z = saved.fz;
    party.placeBehind(party.members);
    return { placements: n, bad: badN, unplaced: party.stats.unplaced - un0, sample: bad, ms: Math.round(performance.now() - t0) };
  },
  /**
   * Can a member walk from (px, pz) to (x, z): in a straight line (the party's own test), or round
   * one corner — straight to a standable spot near the start (0.8 – 2.6 u, 16 ways) and on from it?
   */
  reachable(px, pz, x, z) {
    const party = game().party;
    if (party._reachable(px, pz, x, z)) return true;
    for (const r of [0.8, 1.4, 2, 2.6]) {
      for (let a = 0; a < 16; a++) {
        const ex = px + Math.cos((a / 16) * Math.PI * 2) * r;
        const ez = pz + Math.sin((a / 16) * Math.PI * 2) * r;
        if (party._standable(ex, ez) && party._reachable(px, pz, ex, ez) && party._reachable(ex, ez, x, z)) return true;
      }
    }
    return false;
  },
  /** The party's villagers here are hidden — not drawn, not on the maps, no collider — and the members are on the maps. */
  checkHidden(label) {
    const g = game();
    const map = g._map;
    const out = [];
    for (const r of g.party.records) {
      const npc = PF.npc(r.id);
      if (!npc) continue;
      const onMap = map.npcs.includes(npc.position);
      out.push({ id: r.id, present: npc.present, visible: npc.sprite.visible, onMap, collider: npc.collider.x });
      PF.expect(!npc.present && !npc.sprite.visible && !onMap && npc.collider.x === Infinity, `${label}: villager ${r.id} hidden while in the party (${JSON.stringify(out.at(-1))})`);
    }
    const dots = map.party?.length ?? 0;
    PF.expect(dots === g.party.members.filter((m) => m.sprite).length, `${label}: one map dot per member (${dots})`);
    PF.expect(g.party.members.every((m) => map.party?.includes(m.position)), `${label}: the map dots are the members' live positions`);
    return { villagers: out, dots };
  },
  /** Wait until no story run holds the player (an `arrive` cutscene) and no travel goes on. */
  async idle(ms = 30000) {
    await until(() => G()?.game && !game().busy && !game().story?.run && !game().campaign?.traveling && game().mode === 'play', ms);
    await sleep(200);
    return true;
  },
  /** Members with a sprite on the level played now. */
  attached() {
    return game().party?.members.filter((m) => m.sprite).length ?? 0;
  },
  /**
   * Travel through exit `exit` of the level played now (standing in it: `__game.campaign.exit`),
   * then `settle` ms of play; the level, whether it came back set aside, the programs at the
   * arrival and after the play, the members attached and in the scene.
   * @param {string} exit
   * @param {{ settle?: number }} [o]
   */
  async travel(exit, { settle = 1200 } = {}) {
    await PF.idle();
    const ex = game().campaign._exits.find((e) => e.id === exit);
    if (!ex) throw new Error(`no exit ${exit} in ${G().state().campaign.level}`);
    G().teleport((ex.minX + ex.maxX) / 2, (ex.minZ + ex.maxZ) / 2);
    const ok = await G().campaign.exit(exit);
    await PF.frame();
    const atArrival = PF.programs();
    const placed = game().party?.members.map((m) => m.follow.mode) ?? [];
    await sleep(settle);
    const s = G().state();
    return {
      exit, ok, level: s.campaign.level, kept: s.campaign.stats.lastKept ?? null, programs: [atArrival, PF.programs()],
      attached: PF.attached(), scene: PF.scene().members, members: game().party?.members.length ?? 0, placed,
    };
  },
  /**
   * Talk to `id` with `talkTo` (a villager or a member), answer the choices in `answers` (indices,
   * in order: a click on the choice once it takes input), Space through the rest; until the window
   * closes. The speaker, the pages and the choices offered.
   * @param {string} id
   * @param {number[]} answers
   */
  async talk(id, answers = []) {
    const g = game();
    const d = g.ui.dialog;
    await until(() => !g.busy && !d.isOpen && g._talkCooldown <= 0, 5000);
    const ok = G().talkTo(id);
    const pages = [];
    const offered = [];
    let who = '';
    const left = [...answers];
    for (let i = 0; i < 160 && (g.busy || d.isOpen); i++) {
      await sleep(120);
      if (!d.isOpen) continue;
      who = (d._speakerEl ?? d._nameEl)?.textContent?.trim() || who;
      if (d.isTyping) {
        d.skip();
        continue;
      }
      const tx = d._textEl?.textContent?.trim() ?? '';
      if (tx && pages.at(-1) !== tx) pages.push(tx);
      if (d._choicesActive) {
        if (d._guard > 0) continue;
        offered.push(d._choiceEls.map((li) => li.textContent.trim()));
        const a = left.length ? left.shift() : 0;
        d._choiceEls[a].click();
        await sleep(150);
        continue;
      }
      // (a page with choices waits for them — a Space would pick the first one)
      const line = d._lines?.[d._index];
      if (Array.isArray(line?.choices) && line.choices.length) continue;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
      await sleep(40);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
    }
    await sleep(300);
    return { id, ok, speaker: who, pages, offered };
  },
};

window.PF = PF;
export default PF;
