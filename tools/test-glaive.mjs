#!/usr/bin/env node
/**
 * test-glaive.mjs — the Node self-test of the GLAIVE rules and the turn-based fight
 * (`npm run glaive:test`, docs/specs/GLAIVE.md): dice, sheets, monster stats, and whole
 * encounters played on a flat in-memory world (no browser, no level) — every fight must end, the
 * same seed must replay the same fight, and the rules the spec names must hold (ranged DISADV in
 * the same zone, Hack & Slash's crit range, morale, the injury table, draughts, the boss's phases).
 *
 *   node tools/test-glaive.mjs [--verbose] [--fights=200]
 *
 * Prints a summary; exit code 1 when an assertion fails.
 */
import { Dice, parseDice, formatDice, combineMode } from '../src/game/glaive/dice.js';
import { ZONES, xpToNext, injuryResult, injuryBonus, CONDITIONS, rangeU } from '../src/game/glaive/rules.js';
import { Sheet, BUILDS, BUILD_IDS, CLASS_BUILDS } from '../src/game/glaive/Sheet.js';
import { monsterStats, BESTIARY } from '../src/game/glaive/bestiary.js';
import { TALENTS, TALENT_IDS, talentUses, talentChoices } from '../src/game/glaive/talents.js';
import { SPELLS, castDc } from '../src/game/glaive/spells.js';
import { Encounter } from '../src/game/glaive/Encounter.js';
import { ENEMY_KINDS } from '../src/engine/level/ObjectCatalog.js';
import { PRESET_NAMES, PARTY_PRESETS, CLASS_NAMES } from '../src/engine/level/PartyRules.js';
import GLAIVE_STRINGS from '../src/game/glaive/strings.js';
import { ANCESTRY_IDS } from '../src/game/glaive/talents.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
const VERBOSE = !!args.verbose;
const FIGHTS = Number(args.fights ?? 200);

let pass = 0;
const failures = [];
/** @type {Map<string, number>} */
const sections = new Map();
let section = '';
function sec(name) { section = name; sections.set(name, 0); }
function ok(cond, what, got) {
  sections.set(section, (sections.get(section) ?? 0) + 1);
  if (cond) { pass++; return; }
  failures.push(`[${section}] ${what}${got !== undefined ? ` — got ${JSON.stringify(got)}` : ''}`);
}

// -------------------------------------------------------------------------------------------------
// A flat world: straight paths, clear sight, bats on demand
// -------------------------------------------------------------------------------------------------

function flatWorld({ wall = null } = {}) {
  let bats = 0;
  return {
    path(c, x, z, maxLen, stopDist, others) {
      const dx = x - c.x, dz = z - c.z;
      const d = Math.hypot(dx, dz);
      if (d < 1e-6) return null;
      let len = Math.min(maxLen, Math.max(0, d - stopDist));
      // keep off other bodies: stop short of anyone standing on the end point
      for (let tries = 0; tries < 8 && len > 0; tries++) {
        const ex = c.x + (dx / d) * len, ez = c.z + (dz / d) * len;
        if (!others.some((o) => Math.hypot(o.x - ex, o.z - ez) < (o.radius ?? 0.3) + (c.radius ?? 0.3))) break;
        len = Math.max(0, len - 0.4);
      }
      const ex = c.x + (dx / d) * len, ez = c.z + (dz / d) * len;
      return { x: ex, z: ez, points: [c.x, c.z, ex, ez], len };
    },
    los(ax, az, bx, bz) {
      if (!wall) return true;
      // a wall along x = wall between z −50..50 blocks sight across it
      return (ax - wall) * (bx - wall) > 0;
    },
    summon(kind, x, z) {
      bats++;
      return { id: `summon${bats}`, side: /** @type {'foe'} */ ('foe'), name: 'Cinder Bat', kind, stats: monsterStats(kind, 5), x, z, radius: 0.3 };
    },
  };
}

/** A party of the player and up to three companions at the origin. */
function party({ build = 'sellsword', level = 1, members = [], controller = 'ai' } = {}) {
  const p = Sheet.create(build, 'human', 'Player');
  for (let i = 1; i < level; i++) { p.xp = xpToNext(p.level); p.levelUp(null, p.raisable()[0] ?? null); }
  p.hp = p.hpMax;
  /** @type {any[]} */
  const list = [{ id: 'player', side: 'party', name: 'Player', kind: 'player', sheet: p, x: 0, z: 0, controller, rule: PARTY_PRESETS.aggressive.rule }];
  members.forEach((cls, i) => {
    list.push({ id: `m${i}`, side: 'party', name: cls, kind: 'member', sheet: Sheet.forClass(cls, level, cls), x: (i - 1) * 1.2, z: 1.2, rule: PARTY_PRESETS.balanced.rule });
  });
  return list;
}

/** Foes of `kind` in a ring `d` u away. */
function foes(kind, n, { level = 1, elite = false, d = 6 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI - Math.PI / 2;
    out.push({ id: `${kind}${i}`, side: 'foe', name: kind, kind, stats: monsterStats(kind, level, elite), x: Math.cos(a) * d, z: -Math.abs(Math.sin(a) * d) - d / 2, radius: kind === 'boar' ? 0.6 : kind === 'golem' ? 1.2 : 0.35 });
  }
  return out;
}

/** Play a fight to its end with everyone on AI; returns { enc, beats, steps }. */
function play(combatants, { seed = 1, ambush = null, maxSteps = 4000, canFlee = false, world = flatWorld() } = {}) {
  const enc = new Encounter({ dice: new Dice(seed), world, combatants, ambush, canFlee });
  const beats = [...enc.start()];
  let steps = 0;
  while (!enc.over && steps < maxSteps) {
    steps++;
    beats.push(...enc.step(enc.decide()));
  }
  return { enc, beats, steps };
}

// -------------------------------------------------------------------------------------------------
sec('dice');
{
  ok(JSON.stringify(parseDice('2d6+1')) === JSON.stringify({ count: 2, sides: 6, mod: 1 }), 'parse 2d6+1');
  ok(JSON.stringify(parseDice('d8')) === JSON.stringify({ count: 1, sides: 8, mod: 0 }), 'parse d8');
  ok(JSON.stringify(parseDice('1d4-1')) === JSON.stringify({ count: 1, sides: 4, mod: -1 }), 'parse 1d4-1');
  ok(parseDice(3).mod === 3, 'parse a number');
  ok(formatDice({ count: 2, sides: 6, mod: -2 }) === '2d6-2', 'format');
  let threw = false;
  try { parseDice('banana'); } catch { threw = true; }
  ok(threw, 'parse rejects junk');
  ok(combineMode(1, 0) === 'adv' && combineMode(0, 2) === 'disadv' && combineMode(2, 1) === 'normal', 'ADV and DISADV cancel');
  const a = new Dice(42), b = new Dice(42);
  const ra = Array.from({ length: 50 }, () => a.d20(2, 13).total), rb = Array.from({ length: 50 }, () => b.d20(2, 13).total);
  ok(JSON.stringify(ra) === JSON.stringify(rb), 'same seed, same rolls');
  const d = new Dice(7);
  let advSum = 0, disSum = 0, plain = 0;
  for (let i = 0; i < 4000; i++) { advSum += d.d20(0, 0, 'adv').natural; disSum += d.d20(0, 0, 'disadv').natural; plain += d.d20(0, 0).natural; }
  ok(advSum > plain && plain > disSum, 'ADV rolls higher than plain, plain higher than DISADV', [advSum, plain, disSum]);
  let n20ok = true, n1ok = true;
  for (let i = 0; i < 2000; i++) {
    const r = d.d20(-50, 5);
    if (r.natural === 20 && !r.success) n20ok = false;
    const r2 = d.d20(50, 5);
    if (r2.natural === 1 && r2.success) n1ok = false;
  }
  ok(n20ok, 'a natural 20 always succeeds');
  ok(n1ok, 'a natural 1 always fails');
  let crits = 0;
  for (let i = 0; i < 4000; i++) if (d.d20(0, 10, 'normal', 18).crit) crits++;
  ok(crits > 450 && crits < 750, 'crit range 18–20 crits about 15 %', crits);
  const dm = d.roll('2d6+3');
  ok(dm.dice.length === 2 && dm.total === dm.dice[0] + dm.dice[1] + 3, 'damage roll adds up');
  let advD = 0, plainD = 0;
  for (let i = 0; i < 2000; i++) { advD += d.roll('1d8', { mode: 'adv' }).total; plainD += d.roll('1d8').total; }
  ok(advD > plainD, 'damage with ADV is higher on average');
}

// -------------------------------------------------------------------------------------------------
sec('sheets');
{
  for (const id of BUILD_IDS) {
    const s = Sheet.create(id);
    const vals = Object.values(BUILDS[id].abilities).sort();
    ok(JSON.stringify(vals) === JSON.stringify([0, 1, 2, 3]), `${id}: abilities spread +3 +2 +1 +0`, vals);
    ok(s.talents.length === 2, `${id}: two starting talents`, s.talents);
    ok(s.hp === s.hpMax && s.hpMax >= 10, `${id}: full HP`, s.hpMax);
    const back = Sheet.from(JSON.parse(JSON.stringify(s)));
    ok(JSON.stringify(back.toJSON()) === JSON.stringify(s.toJSON()), `${id}: JSON round trip`);
  }
  const w = Sheet.create('sellsword');
  // 10 + STR 3, veteran +2 / level
  ok(w.hpMax === 10 + 3 + 2, 'sellsword HP = 10 + STR + Veteran', w.hpMax);
  // medium armour caps DEX at +2 (DEX 1 here), +4 armour, +2 shield
  ok(w.ac === 10 + 1 + 4 + 2, 'sellsword AC = 10 + DEX + medium + shield', w.ac);
  const wiz = Sheet.create('hedgeWizard');
  ok(wiz.ac === 12 && wiz.spells.length === 3 && wiz.canCast('emberDart'), 'wizard: AC 12, three spellbooks', [wiz.ac, wiz.spells]);
  wiz.castSpell('emberDart');
  ok(!wiz.canCast('emberDart') && wiz.castsLeft === 2, 'a spellbook casts once per long rest');
  wiz.applyUpgrade('maxMp');
  ok(wiz.canCast('emberDart') && wiz.castsLeft === 3, 'a spare use (mana crystal) casts a spent book again');
  wiz.longRest();
  ok(wiz.castsLeft === 4, 'a long rest restores every book', wiz.castsLeft);
  const dwarf = Sheet.create('sellsword', 'dwarf');
  ok(dwarf.talents.includes('rootsOfMountain') && dwarf.talents.length === 2, 'a dwarf takes its ancestry talent', dwarf.talents);
  // levels: L × 500 XP, +5 HP, a talent, an ability
  const s = Sheet.create('cutpurse');
  ok(s.gainXp(499) === 0 && s.gainXp(1) === 1, '500 XP owes level 2');
  const hp0 = s.hpMax;
  ok(s.levelUp('skulker', 'str') && s.level === 2 && s.xp === 0, 'level 2 taken, XP reset');
  ok(s.hpMax === hp0 + 5 + 1, '+5 HP per level, +1 for STR raised', [hp0, s.hpMax]);
  ok(s.has('skulker') && s.abilities.str === 2, 'the talent and the ability');
  ok(xpToNext(2) === 1000 && xpToNext(5) === 2500, 'XP to next: level × 500');
  // caps: no bonus above level + 2
  const cap = Sheet.create('sellsword');
  ok(cap.raisable().includes('str'), 'STR +3 may rise at level 2 (cap: level + 2 = 4)', cap.raisable());
  cap.abilities.str = 4;
  ok(!cap.raisable().includes('str'), 'STR +4 may not rise at level 2', cap.raisable());
  ok(Sheet.from({ abilities: { str: 9 } }).abilities.str === 5, 'abilities clamp to +5');
  for (const cls of CLASS_NAMES) {
    const m = Sheet.forClass(cls, 5);
    ok(m.level === 5 && m.talents.length === 6, `${cls} at level 5: six talents`, m.talents);
    ok(m.hp === m.hpMax, `${cls}: full HP`);
  }
  ok(Object.keys(CLASS_BUILDS).sort().join() === [...CLASS_NAMES].sort().join(), 'every party class has a GLAIVE build');
  // talents and spells data
  for (const id of TALENT_IDS) ok(!TALENTS[id].per || talentUses(id, 3) > 0, `${id}: uses when limited`);
  ok(!talentChoices(['cleave'], 'human').includes('rootsOfMountain'), 'a human cannot take a dwarf talent');
  ok(talentChoices(['cleave'], 'dwarf').includes('rootsOfMountain'), 'a dwarf can');
  ok(castDc(1) === 10 && castDc(3) === 13 && castDc(5) === 16 && castDc(10) === 19, 'cast DC by hit dice');
  for (const id of Object.keys(SPELLS)) ok(['foe', 'ally', 'self', 'zone', 'point'].includes(SPELLS[id].target), `${id}: a target kind`);
}

// -------------------------------------------------------------------------------------------------
sec('monsters');
{
  for (const k of ENEMY_KINDS) ok(!!BESTIARY[k], `${k}: a stat block`);
  const g1 = monsterStats('goblin', 1), g7 = monsterStats('goblin', 7), ge = monsterStats('goblin', 1, true);
  ok(g1.hd === 1 && g1.hpMax === 5 && g1.atk === 1, 'goblin L1: HD 1, 5 HP, +1', g1);
  ok(g7.hd === 3 && g7.hpMax === 15 && g7.ac === 14, 'goblin L7: HD 3, 15 HP, AC 14', [g7.hd, g7.hpMax, g7.ac]);
  ok(ge.hpMax === 7 && ge.atk === 2 && ge.xp === 50 && ge.morale === 9, 'elite: 7 HP / HD, +1 to hit, ×2 XP, +2 morale', ge);
  const boss = monsterStats('golem', 6);
  ok(boss.hpMax === 164 && boss.pools.length === 3, 'Cinderheart: three pools, 164 HP', boss);
  ok(monsterStats('dummy').hpMax === 99, 'the dummy');
  let threw = false;
  try { monsterStats('dragon'); } catch { threw = true; }
  ok(threw, 'unknown kinds throw');
}

// -------------------------------------------------------------------------------------------------
sec('encounter: rules');
{
  // ranged DISADV with a foe in the same zone; none at range
  const w = flatWorld();
  const p = party({ build: 'hunter' });
  const near = new Encounter({ dice: new Dice(3), world: w, combatants: [...p, { ...foes('goblin', 1)[0], x: 0, z: -2 }] });
  near.start();
  const pc = near.get('player'), gob = near.get('goblin0');
  ok(near._attackMode(pc, gob, true).mode === 'disadv', 'a shot at a foe in the same zone has DISADV');
  gob.z = -9;
  ok(near._attackMode(pc, gob, true).mode === 'normal', 'a shot at range is plain');
  pc.sheet.talents.push('inhumanAccuracy');
  gob.z = -2;
  ok(near._attackMode(pc, gob, true).mode === 'normal', 'Inhuman Accuracy ignores the same-zone DISADV');
  // prone: melee ADV, ranged DISADV
  gob.conditions.set('prone', { rounds: null });
  ok(near._attackMode(pc, gob, false).mode === 'adv', 'melee at a prone foe: ADV');
  pc.sheet.talents = pc.sheet.talents.filter((t) => t !== 'inhumanAccuracy');
  gob.z = -9;
  ok(near._attackMode(pc, gob, true).mode === 'disadv', 'a shot at a prone foe: DISADV');
  // reach and ranges
  ok(rangeU(0) === ZONES.reach && rangeU(2) > rangeU(1), 'ranges grow with Rn');
  // armour class with a ward and a slow
  const t = near.get('player');
  const base = near.acOf(t);
  t.conditions.set('warded', { rounds: 2, amount: 4 });
  t.conditions.set('slowed', { rounds: 2 });
  ok(near.acOf(t) === base + 4 - 2, 'a ward adds its amount, a slow takes 2', [base, near.acOf(t)]);
  ok(CONDITIONS.unconscious.autoHit && CONDITIONS.prone.attackedAdv, 'condition flags');
  // injury table
  ok(injuryResult(1) === 'fine' && injuryResult(4) === 'fatigued' && injuryResult(7) === 'wounded' && injuryResult(12) === 'dead', 'injury table bands');
  ok(injuryBonus(-7) === 3 && injuryBonus(3) === 0, 'injury bonus: +1 per 2 HP below zero');
}

// -------------------------------------------------------------------------------------------------
sec('encounter: fights end');
{
  const kinds = ['slime', 'goblin', 'archer', 'shaman', 'bat', 'boar'];
  let wins = 0, losses = 0, totalSteps = 0, maxSteps = 0, stuck = 0, rounds = 0;
  for (let i = 0; i < FIGHTS; i++) {
    const kind = kinds[i % kinds.length];
    const n = kind === 'boar' ? 1 : 2 + (i % 3);
    const lv = 1 + (i % 3);
    const r = play([...party({ build: BUILD_IDS[i % BUILD_IDS.length], level: lv, members: CLASS_NAMES.slice(0, i % 4) }), ...foes(kind, n, { level: 2 + (i % 5) })], { seed: 1000 + i });
    totalSteps += r.steps;
    maxSteps = Math.max(maxSteps, r.steps);
    if (!r.enc.over) stuck++;
    else if (r.enc.result.outcome === 'victory') { wins++; rounds += r.enc.result.rounds; }
    else losses++;
  }
  ok(stuck === 0, 'every fight ends', stuck);
  ok(wins > FIGHTS * 0.5, 'the party wins most ordinary fights', { wins, losses });
  if (VERBOSE) console.log(`  fights: ${wins} won, ${losses} lost, avg ${(totalSteps / FIGHTS).toFixed(1)} steps (max ${maxSteps}), ${(rounds / Math.max(1, wins)).toFixed(1)} rounds per win`);
  // determinism: the same seed replays the same fight
  const a = play([...party({ members: ['warden', 'mystic'] }), ...foes('goblin', 3)], { seed: 77 });
  const b = play([...party({ members: ['warden', 'mystic'] }), ...foes('goblin', 3)], { seed: 77 });
  ok(JSON.stringify(a.beats) === JSON.stringify(b.beats), 'the same seed replays beat for beat');
  const c = play([...party({ members: ['warden', 'mystic'] }), ...foes('goblin', 3)], { seed: 78 });
  ok(JSON.stringify(a.beats) !== JSON.stringify(c.beats), 'another seed plays another fight');
}

// -------------------------------------------------------------------------------------------------
sec('encounter: beats');
{
  const r = play([...party({ members: ['warden', 'ranger', 'mystic'], level: 2 }), ...foes('goblin', 4, { level: 4 }), ...foes('shaman', 1, { level: 4, d: 9 })], { seed: 5 });
  const types = new Set(r.beats.map((b) => b.t));
  for (const t of ['initiative', 'round', 'turn', 'move', 'attack', 'damage', 'dead', 'end']) ok(types.has(t), `a fight has '${t}' beats`, [...types]);
  const att = r.beats.find((b) => b.t === 'attack');
  ok(att && att.roll && Number.isFinite(att.roll.total) && typeof att.hit === 'boolean', 'an attack beat carries its roll', att);
  ok(r.beats.at(-1).t === 'end', 'the last beat is the end');
  // XP: killed foes' XP; routed ones half
  const res = r.enc.result;
  const expect = res.killed.reduce((s, id) => s + r.enc.get(id).stats.xp, 0) + res.routed.reduce((s, id) => s + Math.floor(r.enc.get(id).stats.xp / 2), 0);
  ok(res.outcome !== 'victory' || res.xp === expect, 'XP adds up', [res.xp, expect]);
  // the sheets keep their HP
  const pc = r.enc.get('player');
  ok(pc.sheet.hp === Math.max(pc.state === 'active' ? 1 : 0, Math.min(pc.hpMax, pc.hp)), 'the sheet keeps the HP left', [pc.sheet.hp, pc.hp]);
}

// -------------------------------------------------------------------------------------------------
sec('encounter: surprise and morale');
{
  const r = play([...party({}), ...foes('goblin', 2)], { seed: 9, ambush: 'party' });
  ok(r.beats.filter((b) => b.t === 'surprised').length === 2, 'an ambush surprises the foes');
  ok(r.beats.some((b) => b.t === 'lostTurn' && b.reason === 'surprised'), 'a surprised foe loses its first turn');
  const r2 = play([...party({}), ...foes('goblin', 2)], { seed: 9, ambush: 'foes' });
  ok(r2.beats.some((b) => b.t === 'save' && b.reason === 'surprise'), 'caught by foes: the party saves WIS');
  // morale: goblins (7) break often enough over many fights; slimes (12) never
  let broke = 0, slimeBroke = 0;
  for (let i = 0; i < 60; i++) {
    const g = play([...party({ level: 3, members: ['warden'] }), ...foes('goblin', 4)], { seed: 300 + i });
    broke += g.beats.filter((b) => b.t === 'morale' && b.broke).length;
    const s = play([...party({ level: 3, members: ['warden'] }), ...foes('slime', 4)], { seed: 300 + i });
    slimeBroke += s.beats.filter((b) => b.t === 'morale').length;
  }
  ok(broke > 0, 'goblins flee sometimes', broke);
  ok(slimeBroke === 0, 'slimes never check morale (12)', slimeBroke);
}

// -------------------------------------------------------------------------------------------------
sec('encounter: the player');
{
  // the player's turn waits for input; options list the reachable foes
  const enc = new Encounter({ dice: new Dice(11), world: flatWorld(), combatants: [...party({ controller: 'player' }), { ...foes('goblin', 1)[0], x: 0, z: -3 }] });
  enc.start();
  let guard = 0;
  while (!enc.needsInput && !enc.over && guard++ < 50) enc.step(enc.decide());
  ok(enc.needsInput, 'the player is asked');
  const o = enc.options();
  ok(o.move && o.action && (o.attack.length + o.approach.length) === 1, 'a foe 3 u off can be approached', o);
  // (move the goblin off again: it may have walked up on its own turn)
  const gob = enc.get('goblin0');
  gob.x = 0; gob.z = -4;
  const beats = enc.act({ type: 'attack', target: 'goblin0', approach: true });
  ok(beats.some((b) => b.t === 'move' && b.who === 'player') && beats.some((b) => b.t === 'attack' && b.who === 'player'), 'approach and attack in one action', beats.map((b) => b.t));
  // a draught: the player's pack
  const e2 = new Encounter({ dice: new Dice(12), world: flatWorld(), combatants: [...party({ controller: 'player' }), { ...foes('goblin', 1)[0], x: 0, z: -12 }] });
  e2.start();
  guard = 0;
  while (!e2.needsInput && !e2.over && guard++ < 50) e2.step(e2.decide());
  const me = e2.get('player');
  me.hp = 3;
  const potions = me.sheet.potions;
  const db = e2.act({ type: 'draught' });
  ok(db.some((b) => b.t === 'heal' && b.who === 'player' && b.amount > 0) && me.sheet.potions === potions - 1, 'a draught heals and is used up', db.map((b) => b.t));
  // spells: the wizard's ember dart
  const e3 = new Encounter({ dice: new Dice(13), world: flatWorld(), combatants: [...party({ build: 'hedgeWizard', controller: 'player' }), { ...foes('goblin', 1)[0], x: 0, z: -6 }] });
  e3.start();
  guard = 0;
  while (!e3.needsInput && !e3.over && guard++ < 50) e3.step(e3.decide());
  if (!e3.over) {
    const cb = e3.act({ type: 'spell', spell: 'emberDart', target: 'goblin0' });
    ok(cb.some((b) => b.t === 'cast' && b.spell === 'emberDart') && cb.some((b) => b.t === 'save' && b.reason === 'cast:emberDart'), 'a hostile spell needs a WIL save to cast', cb.map((b) => b.t));
    ok(!e3.get('player').sheet.canCast('emberDart'), 'and its book is spent');
  }
}

// -------------------------------------------------------------------------------------------------
sec('encounter: Cinderheart');
{
  let wins = 0, phases3 = 0, furnace = 0, summons = 0, stuck = 0;
  const N = 20;
  for (let i = 0; i < N; i++) {
    const r = play([...party({ level: 4, members: ['warden', 'ranger', 'mystic'] }), ...foes('golem', 1, { level: 6, d: 7 })], { seed: 900 + i, maxSteps: 8000 });
    if (!r.enc.over) stuck++;
    if (r.enc.result?.outcome === 'victory') wins++;
    if (r.beats.some((b) => b.t === 'phase' && b.phase === 3)) phases3++;
    furnace += r.beats.filter((b) => b.t === 'furnace').length;
    summons += r.beats.filter((b) => b.t === 'summon').length;
  }
  ok(stuck === 0, 'every boss fight ends', stuck);
  ok(phases3 > N / 2, 'most boss fights reach phase 3', phases3);
  ok(furnace > 0 && summons > 0, 'the furnace goes off and bats are summoned', { furnace, summons });
  ok(wins >= N * 0.3 && wins <= N, 'a level 4 party of four beats Cinderheart sometimes, not always trivially', wins);
  if (VERBOSE) console.log(`  boss: ${wins}/${N} won, phase 3 in ${phases3}, furnaces ${furnace}, bats ${summons}`);
}

// -------------------------------------------------------------------------------------------------
sec('tactics');
{
  for (const p of PRESET_NAMES) {
    const r = play([...party({ members: ['mystic'] }).map((c) => (c.id === 'm0' ? { ...c, rule: PARTY_PRESETS[p].rule } : c)), ...foes('goblin', 2)], { seed: 41 });
    ok(r.enc.over, `preset ${p}: the fight ends`);
  }
  // the passive preset never attacks
  const r = play([...party({ members: ['warden'] }).map((c) => (c.id === 'm0' ? { ...c, rule: PARTY_PRESETS.passive.rule } : c)), ...foes('goblin', 2)], { seed: 42 });
  ok(!r.beats.some((b) => b.t === 'attack' && b.who === 'm0' && !b.free), 'Hold Back never attacks');
}

// -------------------------------------------------------------------------------------------------
sec('strings');
{
  const en = Object.keys(GLAIVE_STRINGS.en);
  for (const lang of ['ja', 'zh']) {
    const missing = en.filter((k) => !(k in GLAIVE_STRINGS[lang]));
    const extra = Object.keys(GLAIVE_STRINGS[lang]).filter((k) => !(k in GLAIVE_STRINGS.en));
    ok(!missing.length, `${lang}: every English key translated`, missing);
    ok(!extra.length, `${lang}: no key English lacks`, extra);
  }
  const need = [
    ...TALENT_IDS.flatMap((id) => [`talent.${id}.name`, `talent.${id}.text`]),
    ...Object.keys(SPELLS).flatMap((id) => [`spell.${id}.name`, `spell.${id}.text`]),
    ...BUILD_IDS.flatMap((id) => [`build.${id}`, `build.${id}.hint`]),
    ...ANCESTRY_IDS.flatMap((id) => [`ancestry.${id}`, `ancestry.${id}.hint`]),
    ...Object.keys(CONDITIONS).map((id) => `cond.${id}`),
    ...['trip', 'disarm', 'feint', 'grapple', 'bash', 'defend'].flatMap((m) => [`maneuver.${m}`, `maneuver.${m}.hint`]),
    ...['fine', 'fatigued', 'wounded', 'scarred', 'maimed', 'dead'].map((r) => `injury.${r}`),
    ...['str', 'dex', 'wis', 'wil'].map((a) => `ability.${a}`),
  ];
  const lacking = need.filter((k) => !(k in GLAIVE_STRINGS.en));
  ok(!lacking.length, 'every talent, spell, build, ancestry, condition, maneuver and injury has its words', lacking);
}

// -------------------------------------------------------------------------------------------------
const total = pass + failures.length;
if (VERBOSE) for (const [k, n] of sections) console.log(`  ${k}: ${n}`);
if (failures.length) {
  console.log(`test-glaive: ${failures.length} of ${total} failed`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`test-glaive: all ${total} assertions passed`);
