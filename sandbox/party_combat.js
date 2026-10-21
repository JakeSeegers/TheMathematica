/**
 * Party combat checks (docs/specs/PARTY.md §5, COMBAT.md §28) on Cinderwatch Pass: a villager
 * (Pip, a hunter — joined with an explicit class) fights beside the player as a warden, a ranger
 * and a mystic, by the presets of PartyRules.js. Used by `sandbox/party.combat.json`:
 *
 *   npm run check -- --page=game.html "--query=level=cinderwatch-pass&autostart=1" --out=pcombat
 *     --wait=6000 --fps=0 --script=sandbox/party.combat.json
 *
 * `ready()` waits for the level and switches the engine to manual stepping (`engine.manualStep`):
 * from then on frames advance only through these helpers, 1/60 s each, so a scenario repeats frame
 * for frame (`determinism()` runs one twice and compares a digest of the companions, the enemies
 * and the player). Every scenario starts fresh: `combat.seed(1)`, `combat.reset()` (enemies, the
 * player at Lv 1, the companions full), the player's level, a teleport next to an enemy group (the
 * member is put behind the player by the party), the group woken. The player is in god mode and
 * never attacks (the companion's kills are its own). A failed check throws (page error: exit 1);
 * each call returns its numbers as JSON for the report.
 *
 * Nothing here is part of the game; it is a verification tool.
 */

/**
 * @import { MemberCombat } from '../src/game/party/MemberCombat.js'
 * @import { MarkerSpec } from '../src/game/combat/types.js'
 */

const G = () => window.__game;
const C = () => window.__game.combat;
const SYS = () => window.__game.game.combat;
const ID = 'pip';
const tick = () => new Promise((r) => setTimeout(r, 0));

/** Enemy groups used (ids of Cinderwatch's `enemy` objects, tools/make-cinderwatch-pass.mjs). */
export const GROUPS = Object.freeze({
  slimesW: 'glade_slimes_w',
  slimesN: 'glade_slimes_n',
  slimesE: 'glade_slimes_e',
  gladeGoblins: 'glade_goblins',
  ruinsShaman: 'ruins_shaman',
  ruinsGate: 'ruins_gate_goblins',
});

/** The companion's attack actions (a mid-fight screenshot shows one). */
const ATTACKS = ['a1', 'a2', 'sweep', 'shot', 'volley', 'bolt', 'flare'];

let _programs0 = 0;
/** @type {string[]} */
const _log = [];

function fail(msg) {
  throw new Error(`[party.combat] ${msg}`);
}

function check(ok, msg) {
  if (!ok) fail(msg);
}

/** Wait for the level, then manual stepping; the program count before any join. */
export async function ready(ms = 90000) {
  const t0 = performance.now();
  while (!(window.__game?.game?.combat && window.__luminati?.loadMs && !document.getElementById('loading'))) {
    if (performance.now() - t0 > ms) fail('the combat level did not load');
    await new Promise((r) => setTimeout(r, 100));
  }
  const g = G();
  g.engine.manualStep = true;
  g.game.resolution.enabled = false;
  g.engine.renderScale = 1;
  for (let i = 0; i < 10; i++) g.engine.step(1 / 60);
  _programs0 = g.engine.renderer.info.programs.length;
  return { programs: _programs0, atLoad: C().stats().programsAtLoad, party: !!g.game.party, combatAllies: SYS().allies.length };
}

/**
 * Run `frames` frames (1/60 s), rendering each (`render: every`); `each(i)` may return true to stop.
 * @param {number} frames
 * @param {(i: number) => boolean|void} [each]
 * @returns {Promise<number>} the frames run
 */
export async function run(frames, each) {
  const eng = G().engine;
  for (let i = 0; i < frames; i++) {
    eng.step(1 / 60);
    if (each && each(i) === true) return i + 1;
    if (i % 60 === 59) await tick();
  }
  return frames;
}

/** The companion's fight (its MemberCombat), or null. @returns {MemberCombat|null} */
export function ally() {
  return SYS().allies.find((a) => a.id === ID) ?? null;
}

/**
 * Pip in the party as `cls` with `preset` (leaves and joins again for another class).
 * @param {'warden'|'ranger'|'mystic'} cls
 * @param {string} preset
 */
export async function member(cls, preset = 'balanced') {
  const g = G();
  const info = g.party.info();
  const m = info?.members.find((x) => x.id === ID);
  if (m && m.cls !== cls) g.party.leave(ID);
  if (!m || m.cls !== cls) {
    const r = await g.party.join(ID, { cls, preset });
    if (!r) fail(`join ${ID} as ${cls} refused`);
  }
  g.party.rule(ID, preset);
  const a = ally();
  check(!!a, 'no MemberCombat after the join (combat.addAlly)');
  check(g.game.party.find(ID)?.combat === a, 'member.combat is not the ally');
  return a;
}

/** The group's foes. @param {string} gid */
function foes(gid) {
  return SYS().enemies.filter((e) => e.uid.startsWith(`${gid}#`));
}

/** A standable spot `d` u from (x, z), south first, in a clear line to it. */
function spotNear(x, z, d) {
  const sys = SYS();
  const y0 = sys.groundAt(x, z);
  for (let k = 0; k < 16; k++) {
    const a = Math.PI / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
    const sx = x + Math.cos(a) * d;
    const sz = z + Math.sin(a) * d;
    if (!sys.standable(sx, sz) || Math.abs(sys.groundAt(sx, sz) - y0) > 0.6) continue;
    if (sys.nav && !sys.nav.lineClear(sx, sz, x, z, 1)) continue;
    return [sx, sz];
  }
  return [x, z + d];
}

/**
 * A fresh fight: seed 1, reset (the companion full), the player's level, the player `d` u from the
 * group's centre (god mode, no input), the group woken.
 * @param {string} gid
 * @param {{ level?: number, d?: number, wake?: boolean, god?: boolean }} [o]
 */
export function fresh(gid, { level = 3, d = 6, wake = true, god = true } = {}) {
  const c = C();
  c.seed(1);
  c.reset();
  c.freezeAI(false);
  c.god(god);
  c.allyGod(false);
  c.move(null);
  c.aim(null);
  c.setPlayer({ level });
  // (what the reset hook leaves: the player's facing — the party puts the member behind it — and
  // the dormancy check's phase — which far foes still wander a frame or two after the teleport)
  G().game.player.facing.set(0, 0, -1);
  SYS()._checkT = 0;
  const lvl = G().game.level.objects.find((o) => o.id === gid);
  const [x, z] = spotNear(Number(lvl.x), Number(lvl.z), d);
  G().teleport(x, z);
  if (wake) for (const e of foes(gid)) c.wake(e.uid);
  return { at: [+x.toFixed(2), +z.toFixed(2)] };
}

/** A digest of the companions, the enemies and the player (determinism). */
export function digest() {
  const sys = SYS();
  const p = sys.player.position;
  const parts = [`p ${p.x.toFixed(4)} ${p.z.toFixed(4)} ${sys.pc.hp.toFixed(3)} ${sys.pc.xp} ${sys.kills}`];
  for (const a of sys.allies) {
    const q = a.position;
    parts.push(`a ${a.id} ${q.x.toFixed(4)} ${q.z.toFixed(4)} ${a.hp.toFixed(3)} ${a.mp.toFixed(3)} ${a.kills} ${a.action} ${JSON.stringify(a.counts)}`);
  }
  // (the foes within 30 u: far packs asleep out of the fight do not matter)
  for (const e of sys.enemies) if (e.alive && Math.hypot(e.position.x - p.x, e.position.z - p.z) < 30) parts.push(`e ${e.uid} ${e.position.x.toFixed(4)} ${e.position.z.toFixed(4)} ${e.hp} ${e.target?.id ?? '-'}`);
  let h = 2166136261;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// =============================================================================================
// Fights per class: the companion attacks and kills, foes turn on it and hit back, XP credited
// =============================================================================================

/**
 * @type {{ gid: string, cls: string, turn: boolean, xp0: number, lv0: number, kills0: number, switched: number,
 *   maxTargeted: number, hitBack: number, frames: number, off?: () => void }|null}
 */
let _fight = null;

/**
 * Start a fight of `cls` against `gid` (the player `d` u from the group) and run until it is
 * mid-fight (two attacks or skills begun, one of them running, a foe of the group alive; at most
 * 900 frames):
 * the screenshot comes next. `turn`: `finishFight` also checks that a foe turned on the companion
 * and hit it (the group far enough for the companion to meet it before it reaches the player).
 * @param {'warden'|'ranger'|'mystic'} cls
 * @param {string} gid
 * @param {{ preset?: string, d?: number, turn?: boolean }} [o]
 */
export async function startFight(cls, gid, { preset = 'balanced', d = 8, turn = false } = {}) {
  await member(cls, preset);
  const at = fresh(gid, { d });
  const sys = SYS();
  const a = ally();
  _fight = { gid, cls, turn, xp0: sys.pc.xp, lv0: sys.pc.level, kills0: sys.kills, switched: 0, maxTargeted: 0, hitBack: 0, frames: 0 };
  const f = _fight;
  const onT = () => { f.switched++; };
  // a hit taken while a foe targets it: the foe hit back
  const onHurt = (id) => { if (id === ID && sys.targetedBy(a) > 0) f.hitBack++; };
  sys.events.on('allyTargeted', onT);
  sys.events.on('allyHurt', onHurt);
  f.off = () => {
    sys.events.off('allyTargeted', onT);
    sys.events.off('allyHurt', onHurt);
  };
  const group = foes(gid);
  const n = await run(900, () => {
    const t = sys.targetedBy(a);
    if (t > f.maxTargeted) f.maxTargeted = t;
    return a.counts.attacks + a.counts.skills >= 2 && ATTACKS.includes(a.action) && group.some((e) => e.alive);
  });
  f.frames += n;
  const P = sys.player.position;
  return { cls, gid, at: at.at, frames: n, fromPlayer: +Math.hypot(a.position.x - P.x, a.position.z - P.z).toFixed(2), ally: a.info() };
}

/** Run the started fight to its end (the group dead, or 2400 frames) and check it. */
export async function finishFight() {
  const f = _fight;
  if (!f) fail('finishFight without startFight');
  const sys = SYS();
  const a = ally();
  const group = foes(f.gid);
  // the fight is over when the group is dead — or what is left of it gave up and walked home and
  // the combat is no longer engaged (a foe that cannot reach the party leaves, COMBAT.md §7.4)
  const over = () => group.every((e) => !e.alive || (!e.aggro && e.state !== 'notice')) && !sys.engaged;
  const n = await run(2400, () => {
    const t = sys.targetedBy(a);
    if (t > f.maxTargeted) f.maxTargeted = t;
    return group.every((e) => !e.alive) || over();
  });
  f.frames += n;
  f.off();
  const info = a.info();
  const xpGained = sys.pc.level > f.lv0 || sys.pc.xp > f.xp0;
  const out = {
    cls: f.cls, gid: f.gid, frames: f.frames, cleared: group.every((e) => !e.alive), groupSize: group.length,
    kills: info.kills, combatKills: sys.kills - f.kills0, xpGained, level: sys.pc.level, xp: sys.pc.xp,
    switched: f.switched, maxTargeted: f.maxTargeted, hitBack: f.hitBack, hp: info.hp, hpMax: info.hpMax, mp: info.mp, counts: info.counts,
    left: group.filter((e) => e.alive).map((e) => `${e.uid} ${e.state} hp ${Math.ceil(e.hp)}`),
  };
  check(out.cleared || over(), `${f.cls}: the fight with ${f.gid} did not end in ${f.frames} frames (${JSON.stringify(out)})`);
  check(info.kills >= Math.max(1, group.length - out.left.length), `${f.cls}: the companion did not kill the fallen of the group (${JSON.stringify(out)})`);
  check(out.combatKills === info.kills, `${f.cls}: the combat's kill count (${out.combatKills}) is not the companion's (${info.kills}; the player never attacks)`);
  check(xpGained, `${f.cls}: no XP for the player`);
  check(info.counts.attacks >= 1 && info.counts.hits >= 1, `${f.cls}: no attack landed`);
  if (f.turn) {
    check(f.switched >= 1 && f.maxTargeted >= 1, `${f.cls}: no foe turned on the companion (${JSON.stringify(out)})`);
    check(f.hitBack >= 1 && info.counts.damageTaken > 0, `${f.cls}: no foe hit the companion back (${JSON.stringify(out)})`);
  }
  _log.push(`${f.cls}: ${JSON.stringify(out)}`);
  _fight = null;
  return out;
}

// =============================================================================================
// Presets
// =============================================================================================

/** `passive` (Hold Back): in a fight with a woken group for 10 s it never attacks or uses a skill. */
export async function passive() {
  await member('warden', 'passive');
  fresh(GROUPS.slimesN);
  const sys = SYS();
  const a = ally();
  /** @type {Record<string, number>} */
  const modes = {};
  let active = 0;
  await run(600, () => {
    modes[a.mode] = (modes[a.mode] ?? 0) + 1;
    if (a.active) active++;
  });
  const info = a.info();
  check(active > 0, 'passive: the companion never fought (combat not active)');
  check(info.counts.attacks === 0 && info.counts.hits === 0 && info.counts.skills === 0, `passive: it attacked (${JSON.stringify(info.counts)})`);
  check(!modes.attack, `passive: attack mode seen (${JSON.stringify(modes)})`);
  return { modes, active, counts: info.counts, engaged: sys.engaged };
}

/** `guardian` (Guard Me: close, leash 4): stays within the leash (+ its reach) of the player. */
export async function guardian() {
  await member('warden', 'guardian');
  fresh(GROUPS.slimesE, { d: 7 });
  const sys = SYS();
  const a = ally();
  const P = sys.player.position;
  let maxD = 0;
  let activeFrames = 0;
  await run(900, () => {
    if (!a.active) return;
    activeFrames++;
    const d = Math.hypot(a.position.x - P.x, a.position.z - P.z);
    if (d > maxD) maxD = d;
  });
  const info = a.info();
  const limit = 4 + 1.85 + 0.6;
  check(activeFrames > 0, 'guardian: never active');
  check(maxD <= limit, `guardian: ${maxD.toFixed(2)} u from the player (leash 4 + reach: ≤ ${limit})`);
  return { maxDist: +maxD.toFixed(3), limit, activeFrames, counts: info.counts };
}

/**
 * Heals by threshold: the player at 25 % HP (god mode keeps it there) with `support` (heal often):
 * the companion Mends the player within a few seconds; then itself, hurt with `allyHurt`.
 * @param {'warden'|'ranger'|'mystic'} [cls]
 */
export async function heal(cls = 'mystic') {
  await member(cls, 'support');
  fresh(GROUPS.slimesW, { d: 9 });
  const c = C();
  const sys = SYS();
  const a = ally();
  c.setPlayer({ hp: Math.round(sys.pc.hpMax * 0.25) });
  const hp0 = sys.pc.hp;
  const n = await run(600, () => a.counts.heals >= 1 && a.action === null);
  check(a.counts.heals >= 1, `heal: no Mend in ${n} frames (${JSON.stringify(a.info())})`);
  check(sys.pc.hp > hp0, `heal: the player's HP did not rise (${hp0} → ${sys.pc.hp})`);
  const playerHealed = Math.round(sys.pc.hp - hp0);
  // the lowest first: the companion itself below the player's fraction
  c.setPlayer({ hp: Math.round(sys.pc.hpMax * 0.7) });
  c.allyHurt(ID, Math.round(a.hpMax * 0.6));
  const self0 = a.hp;
  const heals0 = a.counts.heals;
  await run(600, () => a.counts.heals > heals0 && a.action === null);
  check(a.counts.heals > heals0 && a.hp > self0, `heal: it did not Mend itself (${self0} → ${a.hp})`);
  return { cls, frames: n, playerHealed, selfHealed: Math.round(a.hp - self0), mp: a.mp, counts: a.counts };
}

/**
 * Evade: an enemy telegraph (a circle owned by a woken foe, filling at 0.5) under the companion:
 * it rolls out within a few frames and ends outside; a lane too. With `evade: off` it stands.
 */
export async function evade() {
  await member('warden', 'balanced');
  fresh(GROUPS.gladeGoblins, { d: 9 });
  const sys = SYS();
  const a = ally();
  // let the fight begin (the companion active), then a telegraph under it
  await run(120, () => a.active && a.action === null);
  const owner = foes(GROUPS.gladeGoblins)[0];
  const out = {};
  for (const shape of ['circle', 'lane']) {
    await run(80, () => a.action === null && a.rollCd <= 0);
    const p = a.position;
    /** @type {Partial<MarkerSpec>} */
    const spec = shape === 'circle'
      ? { shape: 'circle', x: p.x, z: p.z, r: 1.6, progress: 0.5, style: 'enemy' }
      : { shape: 'lane', x: p.x - 3, z: p.z, dirX: 1, dirZ: 0, len: 6, width: 1.4, progress: 0.5, style: 'enemy' };
    const h = sys._markerAlloc(owner, spec);
    const rolls0 = a.counts.rolls;
    const n = await run(40, () => a.counts.rolls > rolls0);
    await run(30, () => a.action === null);
    const inside = a._escape(sys._mk[h % 64].spec, a.position.x, a.position.z);
    sys._markerFree(h);
    check(a.counts.rolls > rolls0, `evade: no roll out of a ${shape} (${JSON.stringify(a.info())})`);
    check(!inside, `evade: still inside the ${shape} after the roll`);
    out[shape] = { frames: n, at: [+a.position.x.toFixed(2), +a.position.z.toFixed(2)] };
  }
  // evade off: it does not roll
  G().party.set(ID, 'evade', 'off');
  await run(60, () => a.action === null && a.rollCd <= 0);
  const p = a.position;
  const h = sys._markerAlloc(owner, { shape: 'circle', x: p.x, z: p.z, r: 1.6, progress: 0.5, style: 'enemy' });
  const rolls0 = a.counts.rolls;
  await run(40);
  sys._markerFree(h);
  check(a.counts.rolls === rolls0, 'evade off: it rolled');
  G().party.set(ID, 'evade', 'on');
  return out;
}

/**
 * A real telegraph: the Ruins shaman made to target the companion (`allyTarget`) casts its hex at
 * it; with `evade: on` it rolls out (counted against `evade: off`, same seed).
 */
export async function hex() {
  const res = {};
  for (const ev of ['on', 'off']) {
    await member('warden', 'support');
    G().party.set(ID, 'attack', 'never');
    G().party.set(ID, 'evade', ev);
    fresh(GROUPS.ruinsShaman, { d: 7, level: 4 });
    const c = C();
    const a = ally();
    const sham = foes(GROUPS.ruinsShaman)[0];
    let hexHits = 0;
    const sys = SYS();
    const onHurt = (id) => { if (id === ID && sham.state !== 'engage') hexHits++; };
    sys.events.on('allyHurt', onHurt);
    await run(900, () => {
      if (sham.alive && sham.target !== a && !a.down) c.allyTarget(sham.uid, ID);
    });
    sys.events.off('allyHurt', onHurt);
    res[ev] = { rolls: a.counts.rolls, hurts: a.counts.hurts, damageTaken: a.counts.damageTaken, hexHits };
  }
  G().party.rule(ID, 'balanced');
  check(res.on.rolls >= 1, `hex: no roll out of the shaman's hex (${JSON.stringify(res)})`);
  check(res.on.damageTaken <= res.off.damageTaken, `hex: evading took more damage (${JSON.stringify(res)})`);
  return res;
}

/** Down: foes after it turn back to the player; it gets up with 30 % when the fight is over, then regenerates. */
export async function downAndUp() {
  await member('warden', 'balanced');
  fresh(GROUPS.slimesN);
  const c = C();
  const sys = SYS();
  const a = ally();
  await run(900, () => sys.targetedBy(a) >= 1);
  const targeted = sys.targetedBy(a);
  c.allyHurt(ID, 9999);
  check(a.down && a.hp === 0, 'down: not down at 0 HP');
  await run(1);
  check(sys.targetedBy(a) === 0, 'down: a foe still targets it');
  check(a.invulnerable && !a.view.alive, 'down: still hittable');
  // the fight ends: every foe in it killed (the player's kills), then the calm
  let upAt = -1;
  let upHp = 0;
  const n = await run(900, (i) => {
    for (const e of sys.enemies) if (e.alive && e.aggro) c.kill(e.uid);
    if (upAt < 0 && !a.down) {
      upAt = i;
      upHp = a.hp;
    }
    return upAt >= 0;
  });
  check(upAt >= 0, `down: never got up (${n} frames; engaged ${sys.engaged})`);
  check(Math.abs(upHp - Math.round(a.hpMax * 0.3)) <= 1, `down: got up with ${upHp} HP, not 30 % of ${a.hpMax}`);
  await run(720);
  check(a.hp >= a.hpMax - 0.5, `down: no regeneration to full after the fight (${a.hp} / ${a.hpMax})`);
  return { targetedBefore: targeted, upAfterFrames: upAt, upHp, hpMax: a.hpMax, hpLater: Math.round(a.hp), active: a.active };
}

/** A waystone rest and the story's heal (`healAllies`) refill it; the player's death stops it; the respawn refills it. */
export async function restAndDeath() {
  await member('ranger', 'balanced');
  fresh(GROUPS.slimesW);
  const c = C();
  const sys = SYS();
  const a = ally();
  await run(240);
  c.allyHurt(ID, Math.round(a.hpMax * 0.5));
  c.allySet(ID, { mp: 0 });
  check(c.rest('waystone_crossroads'), 'rest refused');
  check(a.hp === a.hpMax && a.mp === a.mpMax && !a.down, `rest: not refilled (${a.hp}/${a.hpMax}, ${a.mp}/${a.mpMax})`);
  c.allyHurt(ID, 9999);
  check(a.down, 'healAllies: not down before');
  check(c.healAllies() === 1 && !a.down && a.hp === a.hpMax, 'healAllies: not refilled');
  // the player's death: it stops (invulnerable); the respawn refills it next to the player
  fresh(GROUPS.slimesW);
  await run(300, () => sys.targetedBy(a) >= 1);
  c.allyHurt(ID, Math.round(a.hpMax * 0.4));
  c.god(false);
  c.damagePlayer(99999);
  await run(30);
  const stopped = { mode: a.mode, action: a.action, invulnerable: a.invulnerable, targetedBy: sys.targetedBy(a) };
  check(a.mode === 'stop' && a.invulnerable && stopped.targetedBy === 0, `death: the companion did not stop (${JSON.stringify(stopped)})`);
  c.respawn();
  await run(5);
  const P = sys.player.position;
  const d = Math.hypot(a.position.x - P.x, a.position.z - P.z);
  check(a.hp === a.hpMax && !a.down, 'respawn: not full');
  check(d < 4, `respawn: ${d.toFixed(2)} u from the player`);
  c.god(true);
  return { stopped, respawnDist: +d.toFixed(2), hp: a.hp };
}

// =============================================================================================
// The review fixes (PARTY.md §11 PC15–PC26): several members, heal reservation, holding still,
// the leash of shooters, the lead, the party level, sleeping elites, ledges, the player in the way
// =============================================================================================

/**
 * The party as `list` ([id, cls, preset]): every other member leaves, each of these joins (again
 * for another class) with its preset. Pip comes back alone with `solo()`.
 * @param {[string, 'warden'|'ranger'|'mystic', string][]} list
 * @returns {Promise<MemberCombat[]>}
 */
async function party(list) {
  const g = G();
  const want = new Map(list.map((x) => [x[0], x]));
  for (const m of [...(g.party.info()?.members ?? [])]) {
    const w = want.get(m.id);
    if (!w || m.cls !== w[1]) g.party.leave(m.id);
  }
  const out = [];
  for (const [id, cls, preset] of list) {
    if (!g.party.info()?.members.some((x) => x.id === id)) {
      const r = await g.party.join(id, { cls, preset });
      if (!r) fail(`join ${id} as ${cls} refused`);
    }
    g.party.rule(id, preset);
    const a = SYS().allies.find((x) => x.id === id);
    check(!!a, `no MemberCombat for ${id}`);
    out.push(a);
  }
  return out;
}

/**
 * The homes of these foes, to put back after a scenario moved them (`place` moves the home too).
 * @param {string[]} uids
 * @returns {() => void} the restore
 */
function keepHomes(uids) {
  const sys = SYS();
  const homes = uids.map((uid) => {
    const e = sys.enemies.find((x) => x.uid === uid);
    return { uid, x: e.home.x, z: e.home.z };
  });
  return () => {
    for (const h of homes) C().place(h.uid, h.x, h.z);
  };
}

/** Back to Pip alone (the other members leave). */
async function solo() {
  const g = G();
  for (const m of [...(g.party.info()?.members ?? [])]) if (m.id !== ID) g.party.leave(m.id);
}

/**
 * Heal reservation: three healers on Support that never attack; the player knocked to 55 % four
 * times (the foes frozen, nobody hurt otherwise): each time exactly one of them begins a Mend —
 * the others leave a target that Mend lifts above their threshold — and it heals.
 */
export async function healStack() {
  const A = await party([['pip', 'warden', 'support'], ['ilse', 'mystic', 'support'], ['maren', 'ranger', 'support']]);
  for (const a of A) G().party.set(a.id, 'attack', 'never');
  fresh(GROUPS.slimesW, { d: 9 });
  const c = C();
  const sys = SYS();
  c.allyGod(true);
  await run(60);
  c.freezeAI(true);
  /** @type {string[]} */
  const heals = [];
  const on = (id, who, got) => { heals.push(`${id}>${who}:${got}`); };
  sys.events.on('allyHeal', on);
  const pulses = [];
  for (let i = 0; i < 4; i++) {
    await run(400, () => A.every((a) => a.action !== 'mend'));
    c.setPlayer({ hp: Math.round(sys.pc.hpMax * 0.55) });
    /** @type {Record<string, number>} */
    const started = {};
    const prev = A.map((a) => a.action);
    const h0 = heals.length;
    await run(210, () => {
      A.forEach((a, k) => {
        if (a.action === 'mend' && prev[k] !== 'mend') started[a.id] = (started[a.id] ?? 0) + 1;
        prev[k] = a.action;
      });
    });
    pulses.push({ started, heals: heals.slice(h0) });
  }
  sys.events.off('allyHeal', on);
  c.freezeAI(false);
  c.allyGod(false);
  await solo();
  // (before the fix: all three began a Mend the first time — 53 + 3 + 0 HP —, two of them every other time)
  for (const p of pulses) {
    const n = Object.values(p.started).reduce((s, v) => s + v, 0);
    check(n === 1 && p.heals.length === 1 && /:[1-9]/.test(p.heals[0]), `healStack: ${n} Mends begun at once on the player at 55 % (${JSON.stringify(pulses)})`);
  }
  return { pulses };
}

/**
 * Holding still: three members on Hold Back, the player standing in god mode with four slimes at
 * it, the members untouchable: over 10 s each changes its animation and its facing only now and
 * then (no walk–idle shuffle, no turning to and fro within a few frames).
 */
export async function holdSteady() {
  const A = await party([['pip', 'warden', 'passive'], ['ilse', 'mystic', 'passive'], ['maren', 'ranger', 'passive']]);
  fresh(GROUPS.slimesN, { d: 6 });
  C().allyGod(true);
  await run(150);
  const base = (n) => String(n ?? '').replace(/_(up|down|left|right)$/, '');
  const st = A.map(() => ({ anim: 0, animFlick: 0, dir: 0, dirFlick: 0, actions: 0 }));
  const last = A.map((a) => ({ anim: base(a.member.sprite.animation), dir: a.member.sprite.direction, pa: '', pd: '', fa: -99, fd: -99, act: -99 }));
  /** @type {string[]} */
  const flicks = [];
  let f = 0;
  await run(600, () => {
    f++;
    A.forEach((a, k) => {
      const s = a.member.sprite;
      const L = last[k];
      // (a roll out of a telegraph, a hit: actions turn it on purpose — not counted, nor the turn back)
      if (a.action !== null) {
        if (f - L.act > 1) st[k].actions++;
        L.act = f;
      }
      const acting = f - L.act < 20;
      const an = base(s.animation ?? `pose:${a.action ?? ''}`);
      if (an !== L.anim) {
        if (!acting) {
          st[k].anim++;
          if (an === L.pa && f - L.fa < 18) st[k].animFlick++;
        }
        L.pa = L.anim;
        L.anim = an;
        L.fa = f;
      }
      if (s.direction !== L.dir) {
        if (!acting) {
          st[k].dir++;
          if (s.direction === L.pd && f - L.fd < 21) {
            st[k].dirFlick++;
            if (flicks.length < 12) flicks.push(`${a.id}@${f}:${L.dir}>${s.direction} ${an} ${a.mode}`);
          }
        }
        L.pd = L.dir;
        L.dir = s.direction;
        L.fd = f;
      }
    });
  });
  C().allyGod(false);
  const out = A.map((a, k) => ({ id: a.id, ...st[k], mode: a.mode }));
  await solo();
  for (const r of out) {
    check(r.anim <= HOLD_LIMITS.anim && r.animFlick <= HOLD_LIMITS.animFlick && r.dirFlick <= HOLD_LIMITS.dirFlick,
      `holdSteady: ${r.id} shuffles (${JSON.stringify(out)}; limits ${JSON.stringify(HOLD_LIMITS)}; ${flicks.join(', ')})`);
  }
  return { members: out, flicks };
}

/** holdSteady's limits per member over 600 frames (before the fix: 30–39 animation changes, 13–20 of them undone at once). */
const HOLD_LIMITS = Object.freeze({ anim: 16, animFlick: 2, dirFlick: 4 });

/**
 * The leash of shooters: a ranger and a mystic on Guard Me (leash 4) against the Ruins court while
 * the player walks off twice mid-fight: every shot, bolt, Volley and Flare begins within the leash
 * + `ALLY.leashSlack` (+ the player's step in that frame).
 */
export async function leash() {
  const A = await party([['maren', 'ranger', 'guardian'], ['ilse', 'mystic', 'guardian']]);
  fresh('ruins_court', { d: 7 });
  const sys = SYS();
  const c = C();
  const P = sys.player.position;
  const ATT = ['shot', 'volley', 'bolt', 'flare'];
  /** @type {number[]} */
  const ds = [];
  const prev = A.map(() => null);
  let f = 0;
  await run(1500, () => {
    f++;
    if (f === 150) c.move(1, 0);
    if (f === 222) c.move(null);
    if (f === 400) c.move(-0.7, 0.7);
    if (f === 472) c.move(null);
    A.forEach((a, k) => {
      if (a.action !== prev[k] && ATT.includes(a.action)) ds.push(Math.hypot(a.position.x - P.x, a.position.z - P.z));
      prev[k] = a.action;
    });
    return f > 500 && !sys.engaged;
  });
  c.move(null);
  await solo();
  const max = Math.max(...ds);
  // (before the fix: up to 6.9 u)
  check(ds.length >= 6, `leash: only ${ds.length} attacks`);
  check(max <= 4 + 0.75 + 0.1, `leash: an attack began ${max.toFixed(2)} u from the player (Guard Me: 4 + 0.75)`);
  return { attacks: ds.length, max: +max.toFixed(2), median: +ds.sort((x, y) => x - y)[Math.floor(ds.length / 2)].toFixed(2) };
}

/**
 * The lead: a goblin (its AI frozen) carried to and fro at 4 u/s across a lane ≈ 6 u from Pip as
 * a ranger, then a mystic: most shots hit (without a lead: 2 of 16 and 1 of 13).
 */
export async function lead() {
  const out = {};
  const restore = keepHomes(['glade_goblins#0', 'glade_goblins#1', 'glade_goblins#2']);
  for (const cls of /** @type {const} */ (['ranger', 'mystic'])) {
    const a = await member(cls, 'balanced');
    G().party.set(ID, 'skills', 'never');
    const sys = SYS();
    const c = C();
    c.seed(1);
    c.reset();
    c.god(true);
    c.allyGod(true);
    c.move(null);
    c.setPlayer({ level: 1 });
    const gob = sys.enemies.find((e) => e.uid === 'glade_goblins#0');
    c.place('glade_goblins#1', 75, 70);
    c.place('glade_goblins#2', 76, 70);
    G().game.player.facing.set(0, 0, -1);
    G().teleport(60.5, 90);
    a.placeAt(61.5, 90.5);
    c.place(gob.uid, 58, 84.5);
    c.wake(gob.uid);
    c.freezeAI(true);
    gob.hp = 9999;
    let shots = 0;
    let hits = 0;
    const onShot = () => { shots++; };
    const onHit = (id, e) => { if (id === ID && e === gob) hits++; };
    const shoot = a._shoot;
    a._shoot = (...args) => {
      onShot();
      return shoot.apply(a, args);
    };
    sys.events.on('allyHit', onHit);
    let x = 58;
    let dir = 1;
    await run(900, () => {
      x += (dir * 4) / 60;
      if (x > 64) dir = -1;
      if (x < 57) dir = 1;
      gob.position.set(x, sys.groundAt(x, 84.5), 84.5);
    });
    sys.events.off('allyHit', onHit);
    a._shoot = shoot;
    c.freezeAI(false);
    c.allyGod(false);
    c.reset();
    G().party.rule(ID, 'balanced');
    out[cls] = { shots, hits, rate: shots ? +(hits / shots).toFixed(2) : 0 };
  }
  restore();
  C().reset();
  for (const [cls, r] of Object.entries(out)) check(r.shots >= 8 && r.rate >= 0.6, `lead: ${cls} hit ${r.hits} of ${r.shots} shots at a foe crossing at 4 u/s`);
  return out;
}

/**
 * The party's level: a member keeps its HP and MP fractions when the player's level changes (the
 * `setPlayer` hook, a campaign's progress restored on arrival — `importProgress`).
 */
export async function partyLevel() {
  const a = await member('mystic', 'balanced');
  fresh(GROUPS.slimesW, { d: 12, wake: false, level: 1 });
  const c = C();
  const sys = SYS();
  const full = () => a.hp === a.hpMax && a.mp === a.mpMax;
  check(full() && a.level === 1, `partyLevel: not full at Lv 1 (${a.hp}/${a.hpMax})`);
  c.setPlayer({ level: 6 });
  check(full() && a.level === 6, `partyLevel: setPlayer({ level: 6 }) left it at ${a.hp}/${a.hpMax}, ${a.mp}/${a.mpMax}`);
  c.allyHurt(ID, Math.round(a.hpMax / 2));
  const f6 = a.hp / a.hpMax;
  sys.importProgress({ ...sys.exportProgress(), level: 3 });
  check(Math.abs(a.hp / a.hpMax - f6) < 0.02 && a.mp === a.mpMax, `partyLevel: importProgress (Lv 3) moved its fraction ${f6.toFixed(2)} → ${(a.hp / a.hpMax).toFixed(2)}`);
  sys.importProgress({ ...sys.exportProgress(), level: 8 });
  check(Math.abs(a.hp / a.hpMax - f6) < 0.02 && a.hpMax === a.info().hpMax, `partyLevel: importProgress (Lv 8): ${a.hp}/${a.hpMax}`);
  c.reset();
  return { hp: Math.ceil(a.hp), hpMax: a.hpMax, mp: Math.round(a.mp), mpMax: a.mpMax, fraction: +(a.hp / a.hpMax).toFixed(3) };
}

/**
 * Sleeping elites: Pip as a warden with `target: strongest` (far, free) beside the quarry archers
 * and the elite boar 12.7 u away, asleep (not aggroed): it fights the archers and never takes the
 * boar for its target or hits it.
 */
export async function sleepingElite() {
  const a = await member('warden', 'balanced');
  G().party.rule(ID, { target: 'strongest', distance: 'far', attack: 'free', skills: 'free', heal: 'never', evade: 'on', retreat: 'never' });
  fresh('quarry_archers', { d: 6, level: 5 });
  const sys = SYS();
  const elite = sys.enemies.find((e) => e.uid.startsWith('quarry_boar_elite#'));
  check(!!elite && !elite.aggro, 'sleepingElite: no sleeping elite boar');
  let picked = 0;
  let hit = false;
  const onHit = (id, e) => { if (e === elite) hit = true; };
  sys.events.on('allyHit', onHit);
  await run(900, () => { if (a.target === elite && !elite.aggro) picked++; });
  sys.events.off('allyHit', onHit);
  G().party.rule(ID, 'balanced');
  check(picked === 0 && !hit, `sleepingElite: the sleeping elite was its target ${picked} frames${hit ? ', and it hit it' : ''}`);
  return { picked, hit, eliteAggro: elite.aggro, hits: a.counts.hits, kills: a.kills };
}

/**
 * A ledge and the player in the way: (1) Pip as a warden, its foe an archer on a 1 u ledge (AI
 * frozen) with a goblin on the low ground — it gives the archer up after a second under it and
 * fights the goblin; (2) the warden right behind the player on the line to its (frozen) foe — it
 * goes round the player and attacks.
 */
export async function ledgeAndPinned() {
  const a = await member('warden', 'balanced');
  const sys = SYS();
  const c = C();
  const restore = keepHomes(['ruins_archers_w#0', 'ruins_court#0', 'glade_goblins#0', 'glade_goblins#1', 'glade_goblins#2']);
  const setup = () => {
    c.seed(1);
    c.reset();
    c.god(true);
    c.allyGod(true);
    c.move(null);
    c.aim(null);
    c.setPlayer({ level: 4 });
    G().game.player.facing.set(0, 0, -1);
  };
  let ledge;
  let pinned;
  try {
    setup();
    const arch = sys.enemies.find((e) => e.uid === 'ruins_archers_w#0');
    const gob = sys.enemies.find((e) => e.uid === 'ruins_court#0');
    c.place(arch.uid, 11.5, 57.6);
    c.place(gob.uid, 17.5, 63);
    G().teleport(13.6, 60.6);
    c.freezeAI(true);
    c.wake(arch.uid);
    c.wake(gob.uid);
    let under = 0;
    let last = null;
    const n = await run(900, () => {
      const q = a.position;
      const mv = last ? Math.hypot(q.x - last[0], q.z - last[1]) : 1;
      last = [q.x, q.z];
      if (a.target === arch && a.action === null && mv < 1e-4) under++;
      return a.target === gob && a.counts.hits > 0;
    });
    ledge = { frames: n, under, onGoblin: a.target === gob, hits: a.counts.hits };
    c.freezeAI(false);
    // (2) right behind the player
    setup();
    const g0 = sys.enemies.find((e) => e.uid === 'glade_goblins#0');
    c.place(g0.uid, 60.5, 83.5);
    c.place('glade_goblins#1', 75, 70);
    c.place('glade_goblins#2', 76, 70);
    G().teleport(60.5, 88);
    a.placeAt(60.5, 89.5);
    c.freezeAI(true);
    c.wake(g0.uid);
    const at0 = a.counts.attacks;
    const m = await run(600, () => a.counts.attacks > at0);
    pinned = { frames: m, attacked: a.counts.attacks > at0 };
  } finally {
    // (the next scenarios start from the level's own homes, the AI running)
    c.freezeAI(false);
    c.allyGod(false);
    restore();
    c.reset();
  }
  // (before the fix: under the archer for good — 846 of 900 frames —, and behind the player 600 frames without an attack)
  check(ledge.onGoblin && ledge.under <= 150, `ledge: the warden stood under the archer ${ledge.under} frames and never fought the goblin (${JSON.stringify(ledge)})`);
  check(pinned.attacked && pinned.frames <= 200, `pinned: the warden behind the player did not reach its foe (${JSON.stringify(pinned)})`);
  return { ledge, pinned };
}

/**
 * The boss arena (one variant per call; `arenaOpen()` ends it). `inside`: the companion near the
 * player is placed inside when it closes and held there while sealed; it fights the boss (the
 * boss stays on the player). `outside`: one left far away (> 12 u) waits at the gate and never
 * enters. The fight is left running for the screenshot.
 * @param {'inside'|'outside'} variant
 */
export async function arena(variant) {
  await member('warden', 'aggressive');
  const c = C();
  const sys = SYS();
  const a = ally();
  const boss = sys.enemies.find((e) => e.boss);
  const ar = boss.arena;
  c.seed(1);
  c.reset();
  c.god(true);
  c.setPlayer({ level: 6 });
  G().game.player.facing.set(0, 0, -1);
  G().teleport(ar.center.x, ar.rect.maxZ - 2.5);
  const gx = (ar.gate[0] + ar.gate[2]) / 2;
  const gz = (ar.gate[1] + ar.gate[3]) / 2;
  if (variant === 'outside') {
    let placed = false;
    for (let dz = 14; dz < 26 && !placed; dz += 1) {
      if (sys.standable(gx, gz + dz)) {
        a.placeAt(gx, gz + dz);
        placed = true;
      }
    }
    check(placed, 'arena: no spot far outside the gate');
  }
  const n = await run(600, () => ar.active);
  check(ar.active, `arena (${variant}): it did not close in ${n} frames`);
  const placedInside = ar.contains(a.position.x, a.position.z);
  let insideFrames = 0;
  let outsideFrames = 0;
  let bossTargets = 0;
  const hits0 = a.counts.hits;
  await run(variant === 'inside' ? 900 : 600, () => {
    if (ar.contains(a.position.x, a.position.z)) insideFrames++;
    else outsideFrames++;
    if (boss.target) bossTargets++;
  });
  const res = { closedAfter: n, placedInside, insideFrames, outsideFrames, hitsOnBoss: a.counts.hits - hits0, mode: a.mode, bossTargets, hp: Math.ceil(a.hp), down: a.down };
  check(bossTargets === 0, `arena: the boss targeted the companion (${bossTargets} frames)`);
  if (variant === 'inside') {
    check(placedInside, 'arena: the companion near the player was not placed inside');
    check(outsideFrames === 0, `arena: the companion left the closed arena (${outsideFrames} frames)`);
    check(res.hitsOnBoss >= 1, `arena: the companion never hit the boss (${JSON.stringify(res)})`);
  } else {
    check(insideFrames === 0, `arena: the companion left behind entered the closed arena (${insideFrames} frames)`);
    check(a.mode === 'wait', `arena: the companion outside does not wait (${a.mode})`);
    res.gateDist = +Math.hypot(a.position.x - gx, a.position.z - gz).toFixed(2);
    check(res.gateDist < 4, `arena: the companion outside is not at the gate (${res.gateDist} u)`);
  }
  return res;
}

/** The boss dies (the hook): the arena opens; the companion leaves the fight after the linger. */
export async function arenaOpen() {
  const c = C();
  const sys = SYS();
  const boss = sys.enemies.find((e) => e.boss);
  c.kill(boss.uid);
  await run(60);
  check(!boss.arena.active, 'arena: still closed after the boss died');
  const a = ally();
  await run(600, () => !a.active);
  check(a.mode !== 'wait', 'arena: the companion still waits at the open gate');
  check(!a.active, `arena: the companion still fights after the boss (${a.mode}, engaged ${sys.engaged})`);
  const P = sys.player.position;
  const aggro = sys.enemies.filter((e) => e.alive && e.aggro).map((e) => `${e.uid} ${e.state} ${Math.hypot(e.position.x - P.x, e.position.z - P.z).toFixed(1)}`);
  return { open: !boss.arena.active, active: a.active, mode: a.mode, engaged: sys.engaged, aggro, targeted: sys.targetedBy(a), down: a.down, action: a.action };
}

/**
 * Determinism: one fight twice from the same fresh start → the same digest of the companion, the
 * enemies and the player.
 */
export async function determinism() {
  const digests = [];
  for (let k = 0; k < 2; k++) {
    await member('ranger', 'balanced');
    fresh(GROUPS.gladeGoblins);
    await run(900);
    digests.push(digest());
  }
  check(digests[0] === digests[1], `determinism: ${digests.join(' ≠ ')}`);
  return { digests };
}

/** Programs after everything = before the first join; no console noise is judged by the harness. */
export function programs() {
  const n = G().engine.renderer.info.programs.length;
  const s = C().stats();
  check(n === _programs0, `programs: ${_programs0} before the join → ${n} after the fights`);
  check(s.programs === s.programsAtLoad, `programs: ${s.programsAtLoad} at load → ${s.programs}`);
  return { before: _programs0, after: n, atLoad: s.programsAtLoad, log: _log };
}

/** Back to the engine loop (the harness's last screenshot shows a live frame). */
export function release() {
  G().engine.manualStep = false;
  return 'loop';
}

// =============================================================================================
// Balance probe (`sandbox/party.combat.balance.json`; PARTY.md §11 PC25): the fixed-step bot of
// combat_play.js plays as a careful human (its `human` preset; seeded) beside the companions —
// the page loaded with `&fixedstep=1` for each fight. Report only: kills, damage, damage taken,
// downs, foes turned on a member, HP healed, and how often a member's sprite hides the player.
// =============================================================================================

/** The fights: a zone (start spot, level, groups in order) and the party. */
const BALANCE_ZONES = Object.freeze({
  ruins: { at: [48.5, 79.2], level: 2, groups: [['ruins_gate_goblins', 'ruins_slimes'], ['ruins_court', 'ruins_shaman'], ['ruins_archers_w', 'ruins_archers_n']] },
  quarry: { at: [48.5, 43.8], level: 3, groups: [['quarry_goblins', 'quarry_bats'], ['quarry_boar_w'], ['quarry_archers', 'quarry_boar_e']] },
});

/** @type {any} the running probe */
let _bal = null;

/**
 * Start a balance fight: the bot (fixed step, every 4th frame drawn), the members joined and put
 * behind the player, counters on the combat's events and a per-frame sampler.
 * @param {{ zone: 'ruins'|'quarry', members: [string, string, string][], seed?: number }} cfg
 */
export async function balanceBegin(cfg) {
  const P = await import('./combat_play.js');
  const zone = BALANCE_ZONES[cfg.zone];
  const plan = zone.groups.map((g) => ({ do: 'clear', groups: g, zone: cfg.zone }));
  const human = { reaction: 0.25, miss: 0.2, burst: 2.0, pause: 0.9, healAt: 0.3, skillDelay: 2, drinkBusy: true, seed: cfg.seed ?? 1 };
  await P.start({ plan, at: /** @type {[number, number]} */ (zone.at), level: zone.level, skill: human, shop: false, renderEvery: 4 });
  const g = G();
  const sys = SYS();
  for (const [id, cls, preset] of cfg.members) {
    if (!(await g.party.join(id, { cls: /** @type {any} */ (cls), preset }))) fail(`balance: join ${id} refused`);
  }
  g.teleport(zone.at[0], zone.at[1]);
  const st = { kills: 0, allyKills: 0, allyDmg: 0, playerDmg: 0, hurt: 0, downs: 0, turned: 0, healed: 0, playerHurt: 0, deaths: 0, active: 0, cover: 0 };
  const on = {
    kill: (e) => { if (!e.passive) st.kills++; },
    allyKill: () => { st.allyKills++; },
    allyHurt: (id, d) => { st.hurt += d; },
    allyHit: (id, e, d) => { st.allyDmg += d; },
    allyDown: () => { st.downs++; },
    allyTargeted: () => { st.turned++; },
    allyHeal: (id, who, got) => { st.healed += got; },
    playerHurt: (d) => { st.playerHurt += d; },
    hit: (e, d) => { if (e !== 'player') st.playerDmg += d; },
    playerDeath: () => { st.deaths++; },
  };
  for (const k in on) sys.events.on(k, on[k]);
  const pl = g.game.player;
  const sampler = {
    name: 'party_balance',
    update() {
      // (a copy of the camera: the game's matrices stay as the frame left them)
      const cam = g.engine.camera.clone();
      cam.updateMatrixWorld(true);
      let pb = null;
      for (const a of sys.allies) {
        if (!a.active || a.down || a.action === 'roll') continue;
        st.active++;
        pb ??= bodyRect(pl.sprite, cam);
        const mb = bodyRect(a.member.sprite, cam);
        if (overlap(pb, mb) > 0.25 && mb.d < pb.d) st.cover++;
      }
    },
  };
  g.engine.addSystem(sampler, 1000);
  _bal = { cfg, st, on, sampler, P, last: null };
  return `${cfg.zone} ${cfg.members.map((m) => m.join('/')).join(' ')}`;
}

/** Run the bot on (up to 120 s of game time per call) until its plan is done. */
export async function balanceMore() {
  const b = _bal;
  if (!b || b.last?.done) return 'done';
  const t0 = performance.now();
  while (performance.now() - t0 < 120000) {
    b.last = JSON.parse(await b.P.until(30000));
    if (b.last.done) break;
  }
  return b.last.done ? 'done' : `at ${b.last.task} t ${b.last.t}`;
}

/** The fight's numbers (kept in sessionStorage for `balanceTable`). */
export function balanceResult() {
  const b = _bal;
  const sys = SYS();
  for (const k in b.on) sys.events.off(k, b.on[k]);
  G().engine.removeSystem(b.sampler);
  const s = b.st;
  const row = {
    fight: `${b.cfg.zone} ${b.cfg.members.map((m) => `${m[1]}/${m[2]}`).join('+')}`, done: !!b.last?.done, kills: s.kills, allyKills: s.allyKills,
    allyDamage: s.allyDmg, playerDamage: s.playerDmg, allyHurt: s.hurt, downs: s.downs, turned: s.turned, healed: s.healed,
    playerHurt: s.playerHurt, deaths: s.deaths, cover: +(s.cover / Math.max(1, s.active)).toFixed(3),
  };
  let rows = [];
  try { rows = JSON.parse(sessionStorage.getItem('luminati.partyBalance') ?? '[]'); } catch { rows = []; }
  rows.push(row);
  try { sessionStorage.setItem('luminati.partyBalance', JSON.stringify(rows)); } catch { /* the row is returned anyway */ }
  return row;
}

/** Every fight so far (this tab), with the companions' share of the kills and the damage. */
export function balanceTable() {
  let rows = [];
  try { rows = JSON.parse(sessionStorage.getItem('luminati.partyBalance') ?? '[]'); } catch { rows = []; }
  return rows.map((r) => `${r.fight}: kills ${r.allyKills}/${r.kills} (${(r.allyKills / Math.max(1, r.kills) * 100).toFixed(0)} %), damage ${(r.allyDamage / Math.max(1, r.allyDamage + r.playerDamage) * 100).toFixed(0)} %, hurt ${r.allyHurt}, downs ${r.downs}, turned ${r.turned}, healed ${r.healed}, cover ${(r.cover * 100).toFixed(1)} %${r.done ? '' : ' (not done)'}`);
}

/** Forget the rows of earlier runs in this tab. */
export function balanceClear() {
  try { sessionStorage.removeItem('luminati.partyBalance'); } catch { /* none */ }
  return 'cleared';
}

/** A sprite's body on screen (NDC; the middle 44 % of its quad's width, the lower 80 % of its height) and its camera distance. */
function bodyRect(sprite, cam) {
  sprite.updateMatrixWorld(true);
  const mesh = sprite.mesh;
  const pos = mesh.geometry.attributes.position;
  const v = sprite.position.clone();
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).project(cam);
    x0 = Math.min(x0, v.x);
    x1 = Math.max(x1, v.x);
    y0 = Math.min(y0, -v.y);
    y1 = Math.max(y1, -v.y);
  }
  const w = x1 - x0;
  const h = y1 - y0;
  return { x0: x0 + w * 0.28, x1: x1 - w * 0.28, y0: y0 + h * 0.2, y1, d: cam.position.distanceTo(sprite.position) };
}

/** The part of `a`'s area that `b` covers. */
function overlap(a, b) {
  const w = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const h = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  return (w * h) / Math.max(1e-9, (a.x1 - a.x0) * (a.y1 - a.y0));
}
