#!/usr/bin/env node
/**
 * test-research.mjs — the Node self-test of the research core (`npm run research:test`,
 * docs/design/RESEARCH_STATISTICS_RPG.md §13 step 1): the population model (world truth), the
 * player's dataset (observations only) and the statistics the ledger will show. No browser, no
 * level: observations are simulated with GLAIVE's own dice (`Dice.d20`, `Dice.roll`).
 *
 * It checks the design's acceptance points that step 1 can already prove:
 * - fixed seeds reproduce individuals and samples;
 * - enemy and attack records stay distinct (one eligible attack per enemy);
 * - the dataset refuses hidden values;
 * - the statistics match hand-worked values;
 * - a large road-only (convenience) sample stays unrepresentative of the Pass, while a random
 *   sample of the whole Pass gives intervals that cover the true value about as often as stated.
 *
 *   node tools/test-research.mjs [--verbose] [--reps=1000]
 *
 * Prints a summary; exit code 1 when an assertion fails.
 */
import { readFileSync } from 'node:fs';
import { RNG } from '../src/engine/utils/math.js';
import { Dice } from '../src/game/glaive/dice.js';
import { Population, validateConfig, penetrationChance, damageDistribution } from '../src/game/research/populations.js';
import { Dataset, penetrates, HIDDEN_KEYS } from '../src/game/research/dataset.js';
import { Recorder } from '../src/game/research/recorder.js';
import { ResearchMode } from '../src/game/research/ResearchMode.js';
import { Encounter } from '../src/game/glaive/Encounter.js';
import { Sheet } from '../src/game/glaive/Sheet.js';
import { xpToNext } from '../src/game/glaive/rules.js';
import { PARTY_PRESETS } from '../src/engine/level/PartyRules.js';
import { Kingdom, validateKingdom, truthSource, evidenceSource } from '../src/game/research/kingdom.js';
import { validateReport, evidenceFor } from '../src/game/research/report.js';
import { debrief } from '../src/game/research/debrief.js';
import {
  mean, median, percentile, fiveNumber, sd, frequencyTable, histogram, proportion,
  invNorm, normCdf, invT, tCdf, proportionInterval, meanInterval, sampleSizeForProportion,
} from '../src/game/research/stats.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
const VERBOSE = !!args.verbose;
const REPS = Number(args.reps ?? 1000);

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
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const throws = (fn) => { try { fn(); return false; } catch { return true; } };
const log = (...a) => { if (VERBOSE) console.log(...a); };

const CONFIG = JSON.parse(readFileSync(new URL('../public/research/cinderwatch-pass.json', import.meta.url), 'utf8'));
const pop = new Population(CONFIG);
const LIGHT = pop.citizenAc('light');
const MEDIUM = pop.citizenAc('medium');

// -------------------------------------------------------------------------------------------------
// A simulated expedition: meet goblins of a habitat, record each one's first attack as the combat
// recorder will (strike total, critical, fumble, hit against the player's AC, damage on a hit)
// -------------------------------------------------------------------------------------------------

/**
 * @param {Dataset} ds
 * @param {Dice} dice
 * @param {string} habitat
 * @param {number} count goblins met
 * @param {{ playerAc?: number, expedition?: number, attacks?: number, flankEvery?: number }} [o]
 */
function meet(ds, dice, habitat, count, { playerAc = 13, expedition = 1, attacks = 1, flankEvery = 0 } = {}) {
  const enc = ds.startEncounter({ habitat, start: 0, armor: 'light' });
  for (let i = 0; i < count; i++) {
    const ind = pop.individual(habitat, [`e${expedition}`, enc.id, i]);
    const en = ds.addEnemy({ encounterId: enc.id, family: CONFIG.family, weapon: ind.weapon, habitat, time: 0 });
    for (let k = 0; k < attacks; k++) {
      const mode = flankEvery && (i + k) % flankEvery === 0 ? 'adv' : 'normal';
      const r = dice.d20(ind.attackBonus, playerAc, mode);
      const damage = r.success ? dice.roll(ind.damage, { mode: r.crit ? 'adv' : 'normal' }).total : null;
      ds.addAttack({ enemyId: en.id, targetId: 'player', targetAc: playerAc, rollMode: mode, strikeTotal: r.crit || r.fumble ? null : r.total, critical: r.crit, fumble: r.fumble, hit: r.success, damage, free: false, vsUnconscious: false });
    }
    ds.setFate(en.id, 'killed');
  }
  ds.endEncounter(enc.id, { end: 1, result: 'victory' });
  return enc;
}

// -------------------------------------------------------------------------------------------------
sec('config');
ok(validateConfig(CONFIG).length === 0, 'the shipped config is valid', validateConfig(CONFIG));
{
  const bad = structuredClone(CONFIG);
  bad.habitats.road.attackBonus = [[0, 0.5], [1, 0.4]];
  ok(validateConfig(bad).some((p) => p.includes('add up')), 'probabilities must add up to 1');
  const bad2 = structuredClone(CONFIG);
  bad2.groups.ghost = 'swamp';
  ok(validateConfig(bad2).some((p) => p.includes('unknown habitat')), 'a group must name a habitat');
  const bad3 = structuredClone(CONFIG);
  bad3.habitats.mire.weapons = [['laser', 1]];
  ok(validateConfig(bad3).some((p) => p.includes('unknown weapon')), 'a weapon must exist');
  ok(throws(() => new Population(bad)), 'Population refuses a bad config');
}
ok(LIGHT === 12 && MEDIUM === 14 && pop.citizenAc('none') === 10, 'citizen AC = 10 + DEX + armour', { LIGHT, MEDIUM });

// -------------------------------------------------------------------------------------------------
sec('population');
{
  const a = pop.individual('road', ['e1', 'glade_goblins', 0]);
  const b = pop.individual('road', ['e1', 'glade_goblins', 0]);
  ok(JSON.stringify(a) === JSON.stringify(b), 'the same seed parts give the same individual');
  const g1 = pop.group('glade_goblins', 1, 6).map((i) => `${i.attackBonus}/${i.weapon}`).join();
  const g2 = pop.group('glade_goblins', 2, 6).map((i) => `${i.attackBonus}/${i.weapon}`).join();
  ok(g1 !== g2, 'a new expedition draws new individuals', { g1, g2 });
  ok(pop.group('ruins_court', 1, 3).length === 0, 'a group outside the study gives no individuals');
  ok(a.ac === 13 && a.hp === 5 && a.morale === 7, 'every individual shares the GLAIVE stat block (AC 13, HD 1 = 5 hp, ML 7)', a);
  ok(pop.habitatOf('mire_goblins') === 'mire' && pop.habitatOf('glade_goblins') === 'road', 'groups map to habitats');
  // the draws follow the configured distributions
  for (const h of ['road', 'mire']) {
    const N = 20000;
    /** @type {Record<string, number>} */
    const bonus = {};
    /** @type {Record<string, number>} */
    const weapon = {};
    for (let i = 0; i < N; i++) {
      const ind = pop.individual(h, ['freq', i]);
      bonus[ind.attackBonus] = (bonus[ind.attackBonus] ?? 0) + 1;
      weapon[ind.weapon] = (weapon[ind.weapon] ?? 0) + 1;
    }
    const tol = 4 * Math.sqrt(0.25 / N);
    for (const [v, p] of CONFIG.habitats[h].attackBonus) ok(near((bonus[v] ?? 0) / N, p, tol), `${h}: bonus +${v} drawn about ${p} of the time`, (bonus[v] ?? 0) / N);
    for (const [v, p] of CONFIG.habitats[h].weapons) ok(near((weapon[v] ?? 0) / N, p, tol), `${h}: ${v} drawn about ${p} of the time`, (weapon[v] ?? 0) / N);
  }
  const sh = pop.shares();
  ok(near(sh.road, 0.4) && near(sh.mire, 0.6), 'habitat shares come from population sizes', sh);
}

// -------------------------------------------------------------------------------------------------
sec('truth');
{
  // penetrationChance against an enumeration of Dice.d20 (natural 1 misses, natural 20 hits)
  let all = true;
  for (let b = -3; b <= 8; b++) for (let ac = 8; ac <= 26; ac++) {
    let hits = 0;
    for (let n = 1; n <= 20; n++) hits += n !== 1 && (n === 20 || n + b >= ac) ? 1 : 0;
    if (!near(penetrationChance(b, ac), hits / 20)) all = false;
  }
  ok(all, 'penetrationChance matches the d20 rules for every bonus and AC');
  ok(near(penetrationChance(-10, 30), 0.05) && near(penetrationChance(20, 5), 0.95), 'every chance lies between 5 % and 95 %');
  ok(near(pop.truePenetration(LIGHT, 'road'), 0.495), 'road vs light armour = 0.495', pop.truePenetration(LIGHT, 'road'));
  ok(near(pop.truePenetration(LIGHT, 'mire'), 0.65), 'mire vs light armour = 0.65', pop.truePenetration(LIGHT, 'mire'));
  ok(near(pop.truePenetration(LIGHT), 0.588), 'the Pass vs light armour = 0.588', pop.truePenetration(LIGHT));
  ok(near(pop.truePenetration(MEDIUM), 0.488), 'the Pass vs medium armour = 0.488', pop.truePenetration(MEDIUM));
  // Monte Carlo through GLAIVE's dice agrees with the exact value
  const dice = new Dice(new RNG('truth-mc'));
  let hits = 0;
  const N = 40000;
  for (let i = 0; i < N; i++) {
    const h = i % 5 < 2 ? 'road' : 'mire';
    const ind = pop.individual(h, ['mc', i]);
    if (dice.d20(ind.attackBonus, LIGHT).success) hits++;
  }
  ok(near(hits / N, 0.588, 4 * Math.sqrt(0.25 / N)), 'simulated penetration through Dice.d20 ≈ 0.588', hits / N);
  // damage distributions
  const d6 = damageDistribution('1d6', false);
  ok([...d6.values()].every((p) => near(p, 1 / 6)), '1d6 is uniform');
  const adv = damageDistribution('1d6', true);
  ok(near(adv.get(6) ?? 0, 11 / 36) && near(adv.get(1) ?? 0, 1 / 36), 'ADV on 1d6: P(6) = 11/36, P(1) = 1/36');
  const dmg = pop.trueDamageOnHit(LIGHT);
  ok(near([...dmg.values()].reduce((s, p) => s + p, 0), 1), 'the true damage-on-hit distribution sums to 1');
  ok(Math.max(...dmg.keys()) === 12, 'the largest damage on a hit is the greataxe\'s 12');
}

// -------------------------------------------------------------------------------------------------
sec('dataset');
{
  const ds = new Dataset();
  ok(throws(() => ds.startEncounter({ habitat: 'road', start: 0, armor: 'none' })), 'an encounter needs an expedition');
  ds.startExpedition({ start: 0, route: 'road' });
  const enc = ds.startEncounter({ habitat: 'road', start: 0, armor: 'none' });
  const e1 = ds.addEnemy({ encounterId: enc.id, family: 'goblin', weapon: 'knife', habitat: 'road', time: 0 });
  const e2 = ds.addEnemy({ encounterId: enc.id, family: 'goblin', weapon: 'spear', habitat: 'road', time: 0 });
  const e3 = ds.addEnemy({ encounterId: enc.id, family: 'goblin', weapon: 'spear', habitat: 'road', time: 0 });
  const e4 = ds.addEnemy({ encounterId: enc.id, family: 'goblin', weapon: 'knife', habitat: 'road', time: 0 });
  const base = { targetId: 'player', targetAc: 13, free: false, vsUnconscious: false };
  // e1: flanked first (not eligible), then three normal attacks — only the first normal one is eligible
  ds.addAttack({ ...base, enemyId: e1.id, rollMode: 'adv', strikeTotal: 15, critical: false, fumble: false, hit: true, damage: 4 });
  const a2 = ds.addAttack({ ...base, enemyId: e1.id, rollMode: 'normal', strikeTotal: 11, critical: false, fumble: false, hit: false, damage: null });
  ds.addAttack({ ...base, enemyId: e1.id, rollMode: 'normal', strikeTotal: 16, critical: false, fumble: false, hit: true, damage: 5 });
  ds.addAttack({ ...base, enemyId: e1.id, rollMode: 'normal', strikeTotal: null, critical: true, fumble: false, hit: true, damage: 6 });
  // e2: one normal hit; e3: only a flanked attack; e4: never attacks
  ds.addAttack({ ...base, enemyId: e2.id, rollMode: 'normal', strikeTotal: 14, critical: false, fumble: false, hit: true, damage: 7 });
  ds.addAttack({ ...base, enemyId: e3.id, rollMode: 'adv', strikeTotal: 18, critical: false, fumble: false, hit: true, damage: 3 });
  ds.setFate(e1.id, 'killed'); ds.setFate(e2.id, 'killed'); ds.setFate(e3.id, 'fled'); ds.setFate(e4.id, 'killed');
  ds.endEncounter(enc.id, { end: 1, result: 'victory' });

  ok(ds.counts().enemy === 4 && ds.counts().attack === 6, 'four enemy rows and six attack rows stay distinct', ds.counts());
  ok(ds.eligibleOf(e1.id)?.id === a2.id, 'the eligible attack is the first normal-mode attack');
  ok(ds.attacks.filter((a) => a.eligible).length === 2, 'at most one eligible attack per enemy (two enemies have one)');
  ok(ds.missing()['only flanked attacks'] === 1 && ds.missing()['killed before attacking'] === 1, 'missing reasons are recorded', ds.missing());
  const pe = ds.penetration(13, { unit: 'enemy' });
  ok(pe.n === 2 && pe.x === 1 && !pe.clustered, 'per enemy: 2 outcomes (1 penetrates AC 13), not clustered', pe);
  const pa = ds.penetration(13, { unit: 'attack' });
  ok(pa.n === 4 && pa.enemies === 2 && pa.clustered, 'per attack: 4 normal attacks from 2 enemies, flagged clustered', pa);
  ok(ds.penetration(12, { unit: 'enemy' }).x === 1 && ds.penetration(11, { unit: 'enemy' }).x === 2, 'one strike total answers every armour (AC 11 / 12)');
  ok(penetrates({ strikeTotal: null, critical: true, fumble: false }, 30) && !penetrates({ strikeTotal: null, critical: false, fumble: true }, 5), 'a critical always penetrates, a fumble never');
  ok(throws(() => ds.addAttack({ ...base, enemyId: e2.id, rollMode: 'normal', strikeTotal: 23, critical: true, fumble: false, hit: true, damage: 4 })), 'a critical with its total is refused (the total would reveal the bonus)');
  ok(throws(() => ds.addAttack({ ...base, enemyId: e2.id, rollMode: 'normal', strikeTotal: null, critical: false, fumble: false, hit: false, damage: null })), 'an ordinary attack needs its total');
  ok(JSON.stringify(ds.damageOnHit()) === JSON.stringify([4, 5, 6, 7, 3]), 'damage on hit: every hit, misses not counted as 0', ds.damageOnHit());
  ok(JSON.stringify(ds.damageOnHit({ unit: 'enemy' })) === JSON.stringify([7]), 'damage per enemy: the eligible attacks that hit', ds.damageOnHit({ unit: 'enemy' }));
  ok(throws(() => ds.addAttack({ ...base, enemyId: e2.id, rollMode: 'normal', strikeTotal: 9, critical: false, fumble: false, hit: false, damage: 0 })), 'a miss with damage 0 is refused (null, not 0)');
  ok(throws(() => ds.addAttack({ ...base, enemyId: e2.id, rollMode: 'normal', strikeTotal: 15, critical: false, fumble: false, hit: true, damage: null })), 'a hit without damage is refused');
  ok(throws(() => ds.addAttack(/** @type {any} */ ({ ...base, enemyId: e2.id, rollMode: 'normal', strikeTotal: 15, critical: false, fumble: false, hit: true, damage: 3, mod: 2 }))), 'a hidden field (the bonus) is refused');
  ok(throws(() => ds.addEnemy(/** @type {any} */ ({ encounterId: enc.id, family: 'goblin', weapon: 'knife', habitat: 'road', time: 0, attackBonus: 1 }))), 'an enemy row with its attack bonus is refused');
  // round trip
  const json = JSON.stringify(ds.toJSON());
  const back = Dataset.from(JSON.parse(json));
  ok(JSON.stringify(back.toJSON()) === json, 'toJSON → from → toJSON is identical');
  const next = back.addEnemy({ encounterId: enc.id, family: 'goblin', weapon: 'knife', habitat: 'road', time: 2 });
  ok(next.id === 'E5', 'ids continue after a reload', next.id);
  const tampered = JSON.parse(json);
  tampered.enemies[0].attackBonus = 3;
  ok(throws(() => Dataset.from(tampered)), 'a save with hidden fields is refused');
  // no hidden key anywhere in the player's data
  const keys = new Set();
  const walk = (o) => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { keys.add(k); walk(v); } };
  walk(ds.toJSON());
  ok(!HIDDEN_KEYS.some((k) => keys.has(k)), 'the dataset JSON holds no hidden key', HIDDEN_KEYS.filter((k) => keys.has(k)));
  // a new expedition closes the one before
  const x2 = ds.startExpedition({ start: 5, route: 'mire' });
  ok(ds.expeditions[0].end === 5 && ds.expedition?.id === x2.id, 'a new expedition ends the open one');
}

// -------------------------------------------------------------------------------------------------
sec('stats');
{
  const xs = [2, 4, 4, 4, 5, 5, 7, 9];
  ok(mean(xs) === 5, 'mean = 5');
  ok(near(sd(xs, { population: true }), 2), 'population SD = 2');
  ok(near(sd(xs), Math.sqrt(32 / 7)), 'sample SD = √(32/7)');
  ok(median([3, 1, 2]) === 2 && median([4, 1, 3, 2]) === 2.5, 'median of odd and even n');
  const ten = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  ok(percentile(ten, 25) === 2.5, '25th percentile of 1..10: i = 2.75 → (2 + 3)/2', percentile(ten, 25));
  ok(percentile(ten, 50) === 5.5 && percentile(ten, 90) === 9.5, '50th = 5.5, 90th: i = 9.9 → 9.5');
  ok(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9], 50) === 5, 'whole position: the value itself');
  ok(percentile(ten, 0) === 1 && percentile(ten, 100) === 10, 'positions clamp to the first and last values');
  const f = fiveNumber([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  ok(f.q1 === 2.5 && f.median === 5 && f.q3 === 7.5 && f.iqr === 5, 'odd n: quartiles from the halves without the median', f);
  const f2 = fiveNumber([1, 2, 3, 4, 5, 6, 7, 30]);
  ok(f2.q1 === 2.5 && f2.q3 === 6.5 && JSON.stringify(f2.outliers) === '[30]', 'even n quartiles; 30 is beyond 1.5 IQR', f2);
  const ft = frequencyTable([3, 1, 3, 2, 3]);
  ok(JSON.stringify(ft.map((r) => [r.value, r.count])) === '[[1,1],[2,1],[3,3]]' && near(ft[2].cumulative, 1) && near(ft[0].relative, 0.2), 'frequency table: counts, relative and cumulative', ft);
  const fb = frequencyTable([true, false, true, true]);
  ok(fb.length === 2 && fb[0].value === true && fb[0].count === 3, 'categorical frequency table');
  const h = histogram([1, 2, 2, 3, 3, 3, 6]);
  ok(h.length === 6 && h[0].lo === 0.5 && h[2].count === 3 && h[5].count === 1 && h[3].count === 0, 'whole-number histogram: bins of 1 from min − 0.5', h.map((b) => b.count));
  ok(near(h.reduce((s, b) => s + b.relative, 0), 1), 'histogram relative frequencies sum to 1');
  const hw = histogram([1, 2, 3, 4, 5, 6, 7, 8], { start: 0.5, width: 2 });
  ok(JSON.stringify(hw.map((b) => b.count)) === '[2,2,2,2]', 'histogram with a chosen width', hw.map((b) => b.count));
  ok(proportion([true, false, true, true]) === 0.75, 'proportion');
  // distributions
  ok(near(invNorm(0.975), 1.959963984540054, 1e-9), 'invNorm(0.975) = 1.95996…', invNorm(0.975));
  ok(near(invNorm(0.95), 1.6448536269514722, 1e-9) && near(invNorm(0.995), 2.5758293035489004, 1e-9), 'invNorm(0.95), invNorm(0.995)');
  ok(near(invNorm(0.001), -3.090232306167813, 1e-8), 'invNorm in the tail', invNorm(0.001));
  ok(near(normCdf(1.96), 0.9750021048517795, 1e-9) && near(normCdf(0), 0.5, 1e-12), 'normCdf');
  ok(near(invT(0.975, 9), 2.2621571627409915, 1e-8), 'invT(0.975, 9) = 2.2622', invT(0.975, 9));
  ok(near(invT(0.975, 1), 12.706204736174698, 1e-6) && near(invT(0.95, 30), 1.6972608943617378, 1e-8), 'invT for 1 and 30 degrees of freedom');
  ok(near(tCdf(0, 5), 0.5, 1e-12), 'tCdf(0) = 0.5');
  // intervals
  const ci = proportionInterval(45, 100);
  ok(near(ci.estimate, 0.45) && near(ci.se, Math.sqrt(0.45 * 0.55 / 100)) && near(ci.lo, 0.45 - 1.959963984540054 * ci.se, 1e-9) && ci.conditionMet, 'p′ = 0.45, n = 100: 0.45 ± 1.96·√(p′q′/n)', ci);
  ok(!proportionInterval(2, 20).conditionMet, 'n·p′ = 2: the condition is not met');
  const p4 = proportionInterval(2, 20, { method: 'plusFour' });
  ok(near(p4.estimate, 4 / 24), 'plus four: (x + 2)/(n + 4)');
  const w = proportionInterval(0, 10, { method: 'wilson' });
  ok(w.lo >= -1e-12 && w.hi > 0, 'Wilson stays inside 0..1 at x = 0', w);
  const mi = meanInterval([3, 4, 5, 6, 7, 3, 4, 5, 6, 7]);
  const s = sd([3, 4, 5, 6, 7, 3, 4, 5, 6, 7]);
  ok(near(mi.estimate, 5) && near(mi.margin, 2.2621571627409915 * s / Math.sqrt(10), 1e-8) && mi.df === 9, 'mean interval: x̄ ± t(9)·s/√n', mi);
  ok(sampleSizeForProportion(0.05) === 385, 'n for ±0.05 at 95 % with p′ = 0.5 is 385', sampleSizeForProportion(0.05));
  ok(sampleSizeForProportion(0.03, { guess: 0.6 }) === 1025, 'n for ±0.03 with p′ = 0.6 is 1025', sampleSizeForProportion(0.03, { guess: 0.6 }));
  ok(throws(() => mean([])) && throws(() => sd([1])), 'empty data and n = 1 SD are refused');
}

// -------------------------------------------------------------------------------------------------
sec('sampling');
{
  const truthPass = pop.truePenetration(LIGHT);
  // the same seed replays the same dataset
  const run = (seed) => { const ds = new Dataset(); ds.startExpedition({ start: 0, route: 'road' }); meet(ds, new Dice(new RNG(seed)), 'road', 30); return JSON.stringify(ds.toJSON()); };
  ok(run('replay') === run('replay'), 'a fixed seed reproduces the whole dataset');
  ok(run('replay') !== run('other'), 'another seed gives another dataset');

  // a large convenience sample (road only, 400 goblins): narrow, confident, and wrong for the Pass
  const road = new Dataset();
  road.startExpedition({ start: 0, route: 'road' });
  const dice = new Dice(new RNG('convenience'));
  for (let e = 0; e < 40; e++) meet(road, dice, 'road', 10, { expedition: e, playerAc: 13 });
  const pr = road.penetration(LIGHT);
  const ciRoad = proportionInterval(pr.x, pr.n);
  log('road-only', pr.n, ciRoad.estimate.toFixed(3), ciRoad.lo.toFixed(3), ciRoad.hi.toFixed(3), 'truth', truthPass);
  ok(pr.n === 400, '400 eligible attacks from 400 road goblins', pr.n);
  ok(ciRoad.hi < truthPass, 'the road-only interval misses the Pass value (it lies above the interval)', { lo: ciRoad.lo, hi: ciRoad.hi, truthPass });
  ok(ciRoad.margin < 0.06, 'and it is narrow (margin under 0.06)', ciRoad.margin);

  // over many replications: road-only intervals almost never cover the Pass value; random samples of
  // the whole Pass cover it close to 95 % of the time
  const coverage = (habitatOf, n, seed) => {
    const rng = new RNG(seed);
    let cover = 0;
    for (let r = 0; r < REPS; r++) {
      const ds = new Dataset();
      ds.startExpedition({ start: 0, route: 'x' });
      const d = new Dice(new RNG(`${seed}:${r}`));
      const enc = ds.startEncounter({ habitat: 'mixed', start: 0, armor: 'light' });
      for (let i = 0; i < n; i++) {
        const h = habitatOf(rng);
        const ind = pop.individual(h, [seed, r, i]);
        const en = ds.addEnemy({ encounterId: enc.id, family: 'goblin', weapon: ind.weapon, habitat: h, time: 0 });
        const roll = d.d20(ind.attackBonus, 13);
        ds.addAttack({ enemyId: en.id, targetId: 'player', targetAc: 13, rollMode: 'normal', strikeTotal: roll.crit || roll.fumble ? null : roll.total, critical: roll.crit, fumble: roll.fumble, hit: roll.success, damage: roll.success ? 1 : null, free: false, vsUnconscious: false });
      }
      const p = ds.penetration(LIGHT);
      const c = proportionInterval(p.x, p.n);
      if (c.lo <= truthPass && truthPass <= c.hi) cover++;
    }
    return cover / REPS;
  };
  const sh = pop.shares();
  const covRandom = coverage((rng) => (rng.next() < sh.road ? 'road' : 'mire'), 100, 'random');
  const covRoad = coverage(() => 'road', 100, 'roadonly');
  log('coverage random', covRandom, 'road-only', covRoad);
  ok(covRandom > 0.92 && covRandom < 0.975, `random samples of the Pass (n = 100): the 95 % interval covers the truth about 95 % of the time`, covRandom);
  // (bias 0.093; SE ≈ 0.05 at n = 100 → coverage ≈ 0.53; SE ≈ 0.025 at n = 400 → ≈ 0.04)
  ok(covRoad < 0.7, 'road-only samples (n = 100) cover it far less often than 95 %', covRoad);
  const covRoadBig = coverage(() => 'road', 400, 'roadbig');
  log('coverage road-only n = 400', covRoadBig);
  ok(covRoadBig < 0.15 && covRoadBig < covRoad, 'more road data makes coverage worse, not better (n = 400)', { covRoad, covRoadBig });

  // repeated attacks by one goblin: an "all attacks" sample has the same n but fewer distinct goblins
  const rep = new Dataset();
  rep.startExpedition({ start: 0, route: 'road' });
  meet(rep, new Dice(new RNG('repeat')), 'road', 10, { attacks: 4 });
  const byEnemy = rep.penetration(LIGHT, { unit: 'enemy' });
  const byAttack = rep.penetration(LIGHT, { unit: 'attack' });
  ok(byEnemy.n === 10 && byAttack.n === 40 && byAttack.enemies === 10 && byAttack.clustered, '40 attacks from 10 goblins: n = 10 by enemy, 40 by attack (clustered)', { byEnemy: byEnemy.n, byAttack: byAttack.n });

  // flanked attacks are kept but never eligible
  const fl = new Dataset();
  fl.startExpedition({ start: 0, route: 'road' });
  meet(fl, new Dice(new RNG('flank')), 'road', 12, { attacks: 1, flankEvery: 3 });
  ok(fl.penetration(LIGHT).n === 8 && fl.missing()['only flanked attacks'] === 4, 'a flanked-only goblin has no eligible attack and says why', { n: fl.penetration(LIGHT).n, missing: fl.missing() });
}

// -------------------------------------------------------------------------------------------------
// Real GLAIVE encounters through the recorder (step 2): a flat world, the player on AI
// -------------------------------------------------------------------------------------------------

const flatWorld = {
  path(c, x, z, maxLen, stopDist, others) {
    const dx = x - c.x, dz = z - c.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-6) return null;
    let len = Math.min(maxLen, Math.max(0, d - stopDist));
    for (let tries = 0; tries < 8 && len > 0; tries++) {
      const ex = c.x + (dx / d) * len, ez = c.z + (dz / d) * len;
      if (!others.some((o) => Math.hypot(o.x - ex, o.z - ez) < (o.radius ?? 0.3) + (c.radius ?? 0.3))) break;
      len = Math.max(0, len - 0.4);
    }
    const ex = c.x + (dx / d) * len, ez = c.z + (dz / d) * len;
    return { x: ex, z: ez, points: [c.x, c.z, ex, ez], len };
  },
  los: () => true,
  summon: () => null,
};

/** A level-`level` sellsword (AC 17) on AI. */
function hero(level = 3) {
  const p = Sheet.create('sellsword', 'human', 'Player');
  for (let i = 1; i < level; i++) { p.xp = xpToNext(p.level); p.levelUp(null, p.raisable()[0] ?? null); }
  p.hp = p.hpMax;
  return { id: 'player', side: /** @type {'party'} */ ('party'), name: 'Player', kind: 'player', sheet: p, x: 0, z: 0, controller: /** @type {'ai'} */ ('ai'), rule: PARTY_PRESETS.aggressive.rule };
}

/**
 * One fight of the hero against a studied group (its individuals for the overlay's expedition),
 * recorded as GlaiveCombat records it. Returns the beats.
 * @param {ResearchMode} rm
 * @param {string} groupId
 * @param {number} count
 * @param {number} seed
 */
function studiedFight(rm, groupId, count, seed) {
  const list = /** @type {any[]} */ ([hero()]);
  /** @type {{ id: string, studied: any }[]} */
  const foes = [];
  for (let i = 0; i < count; i++) {
    const ind = /** @type {NonNullable<ReturnType<ResearchMode['individualFor']>>} */ (rm.individualFor(groupId, i));
    const id = `${groupId}#${i}`;
    list.push({ id, side: 'foe', name: 'Bramble Goblin', kind: 'goblin', stats: ind.stats, x: (i - 1) * 1.5, z: -5, radius: 0.35 });
    foes.push({ id, studied: ind.info });
  }
  const enc = new Encounter({ dice: new Dice(seed), world: flatWorld, combatants: /** @type {any} */ (list), ambush: null, canFlee: false });
  rm.fightStart(foes);
  const all = [];
  let b = enc.start();
  rm.beats(b); all.push(...b);
  for (let steps = 0; !enc.over && steps < 4000; steps++) {
    b = enc.step(enc.decide());
    rm.beats(b); all.push(...b);
  }
  return { enc, beats: all };
}

sec('recorder');
{
  let clock = 8;
  const host = { now: () => clock, armor: () => 'medium' };
  const rm = new ResearchMode(CONFIG, host);
  ok(rm.expedition === 1 && rm.dataset.expeditions.length === 1 && rm.dataset.expedition, 'the overlay opens expedition 1');
  const road = rm.individualFor('glade_goblins', 0);
  const mire = rm.individualFor('mire_goblins', 0);
  ok(!!road && [0, 1, 2].includes(road.stats.atk) && road.stats.ac === 13 && road.stats.hpMax === 5, 'a road goblin: bonus +0..+2, AC 13, 5 hp', road?.stats);
  ok(!!mire && [3, 4, 5].includes(mire.stats.atk), 'a mire goblin: bonus +3..+5', mire?.stats.atk);
  ok(road?.stats.attacks.length === 1 && road.stats.attacks[0].name === CONFIG.weapons[road.info.weapon].name && road.stats.attacks[0].damage === CONFIG.weapons[road.info.weapon].damage, 'its one attack is its visible weapon');
  ok(road?.stats.moves.includes('gang'), 'it keeps the family\'s moves (gang tactics)');
  ok(rm.individualFor('ruins_court', 0) === null, 'a group outside the study keeps its own stats (null)');
  ok(!('attackBonus' in /** @type {any} */ (road?.info ?? {})), 'the visible info holds no attack bonus');
  const before = [0, 1, 2, 3, 4, 5].map((i) => rm.individualFor('glade_goblins', i)?.stats.atk + '/' + rm.individualFor('glade_goblins', i)?.info.weapon).join();
  ok(before === [0, 1, 2, 3, 4, 5].map((i) => rm.individualFor('glade_goblins', i)?.stats.atk + '/' + rm.individualFor('glade_goblins', i)?.info.weapon).join(), 'the same expedition gives the same individuals');

  // one real fight
  const { enc, beats } = studiedFight(rm, 'glade_goblins', 3, 101);
  const ds = rm.dataset;
  const goblinAttacks = beats.filter((b) => b.t === 'attack' && String(b.who).startsWith('glade_goblins'));
  ok(enc.over && enc.result.outcome === 'victory', 'the hero wins the fight', enc.result.outcome);
  ok(ds.counts().encounter === 1 && ds.counts().enemy === 3, 'one encounter row, three enemy rows', ds.counts());
  ok(ds.attacks.length === goblinAttacks.length, 'one attack row per goblin attack beat (the hero\'s attacks are not rows)', { rows: ds.attacks.length, beats: goblinAttacks.length });
  let same = true;
  ds.attacks.forEach((row, i) => {
    const b = goblinAttacks[i];
    const exp = b.roll.crit || b.roll.fumble ? null : b.roll.total;
    if (row.strikeTotal !== exp || row.hit !== b.hit || row.targetAc !== b.roll.target || row.rollMode !== b.roll.mode) same = false;
    if (b.hit && row.damage !== b.damage.total) same = false;
    if (!b.hit && row.damage !== null) same = false;
  });
  ok(same, 'each row matches its beat: strike total (none on a natural 20 / 1), hit, AC, mode, damage roll');
  ok(ds.attacks.every((a) => a.targetAc === 17), 'the hero\'s AC 17 is the target AC');
  const eligible = ds.attacks.filter((a) => a.eligible);
  ok(eligible.length <= 3 && new Set(eligible.map((a) => a.enemyId)).size === eligible.length, 'at most one eligible attack per goblin');
  ok(ds.enemies.every((e) => e.fate !== null), 'every goblin has a fate', ds.enemies.map((e) => e.fate));
  ok(ds.enemies.every((e) => (ds.eligibleOf(e.id) === null) === (e.missingReason !== null)), 'a goblin without an eligible attack says why, one with it does not');
  ok(ds.encounters[0].result === 'victory' && ds.encounters[0].armor === 'medium' && ds.encounters[0].habitat === 'road', 'the encounter: victory, the player\'s armour, its habitat');
  ok(!rm.recorder.active, 'the recorder closed the encounter at the end beat');
  // no hidden key reached the dataset
  const keys = new Set();
  const walk = (o) => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { keys.add(k); walk(v); } };
  walk(rm.toJSON());
  ok(!HIDDEN_KEYS.some((k) => keys.has(k)), 'the overlay\'s save holds no hidden key', HIDDEN_KEYS.filter((k) => keys.has(k)));

  // a rest: a new expedition with new individuals
  clock = 20;
  rm.startExpedition();
  const after = [0, 1, 2, 3, 4, 5].map((i) => rm.individualFor('glade_goblins', i)?.stats.atk + '/' + rm.individualFor('glade_goblins', i)?.info.weapon).join();
  ok(rm.expedition === 2 && ds.expeditions[0].end === 20 && after !== before, 'a rest ends expedition 1 and draws new goblins', { before, after });
  const second = studiedFight(rm, 'glade_goblins', 3, 102);
  ok(ds.counts().enemy === 6 && new Set(ds.enemies.map((e) => e.id)).size === 6 && ds.enemies.slice(3).every((e) => e.expeditionId === 'X2'), 'the pack after the rest gives three new enemy rows in expedition 2');
  ok(second.enc.over, 'the second fight ends');

  // reproducible: the same seeds give the same dataset
  const replay = () => {
    const r = new ResearchMode(CONFIG, { now: () => 8, armor: () => 'medium' });
    for (let k = 0; k < 4; k++) studiedFight(r, k % 2 ? 'mire_goblins' : 'glade_goblins', 3, 500 + k);
    return JSON.stringify(r.toJSON());
  };
  ok(replay() === replay(), 'fixed seeds reproduce the recorded dataset');

  // routes: many fights on the road vs in the mire give different samples
  const roadRm = new ResearchMode(CONFIG, { now: () => 8, armor: () => 'medium' });
  const mireRm = new ResearchMode(CONFIG, { now: () => 8, armor: () => 'medium' });
  for (let k = 0; k < 60; k++) {
    studiedFight(roadRm, 'glade_goblins', 3, 1000 + k);
    studiedFight(mireRm, 'mire_goblins', 3, 2000 + k);
    roadRm.startExpedition();
    mireRm.startExpedition();
  }
  const pr = roadRm.dataset.penetration(LIGHT), pm = mireRm.dataset.penetration(LIGHT);
  log('route road', pr.n, pr.x / pr.n, 'route mire', pm.n, pm.x / pm.n, 'missing', roadRm.dataset.missing(), mireRm.dataset.missing());
  ok(pr.n > 60 && pm.n > 60, 'both routes yield eligible attacks from real fights', { road: pr.n, mire: pm.n });
  ok(pm.x / pm.n > pr.x / pr.n, 'the mire route shows more penetration of light armour than the road route', { road: pr.x / pr.n, mire: pm.x / pm.n });
  const cr = proportionInterval(pr.x, pr.n);
  ok(cr.lo <= pop.truePenetration(LIGHT, 'road') && pop.truePenetration(LIGHT, 'road') <= cr.hi, 'the road route\'s interval covers the road value (this seed)', { lo: cr.lo, hi: cr.hi });
  const flanked = roadRm.dataset.attacks.filter((a) => a.rollMode !== 'normal');
  ok(flanked.length > 0 && flanked.every((a) => !a.eligible), 'gang tactics give flanked (ADV) attacks; none is eligible', flanked.length);
}

sec('recorder beats');
{
  // synthetic beats: a sleeper, a fleeing goblin, and a party that withdraws
  const ds = new Dataset();
  ds.startExpedition({ start: 0, route: 'open' });
  const rec = new Recorder(ds, { family: 'goblin' });
  rec.begin([{ id: 'g0', habitat: 'road', weapon: 'knife' }, { id: 'g1', habitat: 'road', weapon: 'spear' }, { id: 'g2', habitat: 'mire', weapon: 'spear' }], { time: 1, armor: 'light' });
  const roll = (total, natural, mode = 'normal') => ({ dice: [natural], natural, mod: total - natural, total, target: 12, mode, success: natural !== 1 && (natural === 20 || total >= 12), crit: natural === 20, fumble: natural === 1 });
  rec.beats([
    { t: 'condition', who: 'player', id: 'unconscious', on: true },
    { t: 'attack', who: 'g0', target: 'player', roll: { ...roll(9, 8), success: true, crit: true }, hit: true, crit: true, free: false, damage: { total: 5 } },
    { t: 'condition', who: 'player', id: 'unconscious', on: false },
    { t: 'attack', who: 'g0', target: 'player', roll: roll(14, 13), hit: true, crit: false, free: false, damage: { total: 3 } },
    { t: 'attack', who: 'g1', target: 'player', roll: roll(5, 1), hit: false, crit: false, free: false },
    { t: 'attack', who: 'player', target: 'g1', roll: roll(18, 15), hit: true, crit: false, free: false, damage: { total: 6 } },
    { t: 'flee', who: 'g2', points: [] },
    { t: 'end', outcome: 'fled', xp: 0 },
  ], 2);
  ok(ds.attacks.length === 3, 'three goblin attacks recorded, the player\'s attack not', ds.attacks.length);
  ok(ds.attacks[0].vsUnconscious && !ds.attacks[0].eligible && ds.attacks[0].strikeTotal === null, 'an attack on a sleeper: recorded, flagged, never eligible');
  ok(ds.attacks[1].eligible && ds.attacks[1].strikeTotal === 14 && ds.attacks[1].damage === 3, 'the next normal attack is the eligible one');
  ok(ds.attacks[2].fumble && ds.attacks[2].strikeTotal === null && ds.attacks[2].damage === null && ds.attacks[2].eligible, 'a natural 1: no total, no damage, still eligible (it is a normal attack)');
  ok(ds.enemies[2].fate === 'fled' && ds.enemies[2].missingReason === 'fled before attacking', 'a goblin that fled without attacking');
  ok(ds.encounters[0].result === 'flight' && ds.enemies[1].fate === 'alive', 'the party withdrew; the goblins left standing are alive');
  ok(!rec.active, 'the end beat closes the encounter');
  rec.begin([{ id: 'g9', habitat: 'road', weapon: 'knife' }], { time: 3, armor: 'light' });
  rec.abort(4);
  ok(ds.encounters[1].result === 'defeat' && ds.enemies[3].missingReason === 'fight lost', 'a fight cut short is closed as lost');
  ok(rec.begin([], { time: 5, armor: 'light' }) === null && ds.encounters.length === 2, 'a fight without studied foes is not recorded');
}

// -------------------------------------------------------------------------------------------------
sec('kingdom');
{
  const k = new Kingdom(CONFIG);
  ok(validateKingdom(CONFIG.kingdom, CONFIG).length === 0, 'the shipped kingdom config is valid', validateKingdom(CONFIG.kingdom, CONFIG));
  const badK = structuredClone(CONFIG.kingdom); badK.citizens.swamp = 3; badK.prices.plate = 0;
  ok(validateKingdom(badK, CONFIG).length === 3, 'unknown areas and armour, bad prices are reported', validateKingdom(badK, CONFIG));
  ok(k.totalCitizens === 40 && k.cost({ armor: 'light', count: 40 }) === 1000 && k.cost({ armor: 'none', count: 9 }) === 0, 'citizens and costs (GLAIVE prices: light 25 sp)');
  ok(k.validatePolicy({ armor: 'medium', count: 27 }).some((p) => p.includes('budget')), 'over the budget is refused');
  ok(k.validatePolicy({ armor: 'light', count: 41 }).some((p) => p.includes('citizens')), 'more armour than citizens is refused');
  ok(k.validatePolicy({ armor: 'heavy', count: 1 }).length > 0 && k.validatePolicy({ armor: 'light', count: 40 }).length === 0, 'only armour for sale; light for all is fine');
  ok(JSON.stringify(k.allocation({ armor: 'light', count: 10 })) === '{"road":4,"mire":6}', 'allocation in proportion to citizens', k.allocation({ armor: 'light', count: 10 }));
  ok(JSON.stringify(k.allocation({ armor: 'light', count: 7 })) === '{"road":3,"mire":4}', 'the remainder goes to the largest fraction (2.8 / 4.2 → 3 / 4)', k.allocation({ armor: 'light', count: 7 }));
  const opts = k.options();
  ok(opts[0].armor === 'none' && opts.some((o) => o.armor === 'light' && o.count === 40) && opts.some((o) => o.armor === 'medium' && o.count === 26) && !opts.some((o) => o.armor === 'medium' && o.count === 30), 'options: nothing, multiples of 5, and the most the budget allows (medium 26)');
  // the rules, with sources that always do one thing
  const always = (hit, damage) => ({ kind: 'test', attack: () => ({ hit, damage }) });
  const miss = k.season({ armor: 'medium', count: 26 }, always(false, 0), 1);
  ok(miss.dead === 0 && miss.injured === 0 && miss.spent === 1950 && miss.remaining === 50 && miss.unfunded === 450 && miss.totalCost === 2400, 'no hits: the cost is the purchase plus the shortfall below the reserve (1950 + 450)', { spent: miss.spent, unfunded: miss.unfunded, total: miss.totalCost });
  const huge = k.season({ armor: 'none', count: 0 }, always(true, 20), 1);
  ok(huge.dead === 40 && huge.citizens.every((c) => c.hits === 1 && c.hp === -10), 'a 20-damage hit drops a citizen to −10: dead, no second attack', { dead: huge.dead });
  const six = k.season({ armor: 'light', count: 40 }, always(true, 6), 1);
  ok(six.citizens.every((c) => c.down && c.hp === -2 && c.hits === 2) && six.dead + six.injured + six.knockedOut === 40, 'two 6-damage hits: −2 HP, down, an injury roll each', { dead: six.dead, injured: six.injured, ko: six.knockedOut });
  ok(six.equipmentFailures === 80 && huge.equipmentFailures === 0, 'equipment failures count hits on armoured citizens only');
  const four = k.season({ armor: 'none', count: 0 }, always(true, 4), 1);
  ok(four.citizens.every((c) => !c.down && c.hp === 2) && four.totalCost === 0, 'two 4-damage hits: hurt, not down, no cost');
  // reproducible; the truth makes the decision matter
  const t = truthSource(pop);
  ok(JSON.stringify(k.season({ armor: 'light', count: 20 }, t, 'a')) === JSON.stringify(k.season({ armor: 'light', count: 20 }, t, 'a')), 'a fixed seed reproduces a season');
  ok(JSON.stringify(k.season({ armor: 'light', count: 20 }, t, 'a')) !== JSON.stringify(k.season({ armor: 'light', count: 20 }, t, 'b')), 'another seed, another season');
  const none = k.replay({ armor: 'none', count: 0 }, t, { seasons: 300 });
  const light = k.replay({ armor: 'light', count: 40 }, t, { seasons: 300 });
  const med = k.replay({ armor: 'medium', count: 26 }, t, { seasons: 300 });
  log('truth replay mean cost: none', none.totalCost.mean, 'light 40', light.totalCost.mean, 'medium 26', med.totalCost.mean);
  ok(light.totalCost.mean < none.totalCost.mean, 'under the truth, light armour for all costs less than buying nothing (underprotection has a price)', { none: none.totalCost.mean, light: light.totalCost.mean });
  ok(light.totalCost.mean < med.totalCost.mean, 'and less than medium for 26 (overspending into the reserve has a price)', { light: light.totalCost.mean, medium: med.totalCost.mean });
  ok(none.totalCost.p10 <= none.totalCost.p50 && none.totalCost.p50 <= none.totalCost.p90 && none.totalCost.p90 > none.totalCost.p10, 'seasons vary: p10 ≤ p50 ≤ p90');
}

sec('report');
{
  const k = new Kingdom(CONFIG);
  const good = { armor: 'light', population: 'region', unit: 'enemy', estimate: 0.55, interval: { lo: 0.5, hi: 0.6, level: 0.95 }, policy: { armor: 'light', count: 30 }, rationale: 'Most attacks get through light armour; it is cheap.' };
  ok(validateReport(good, k).length === 0, 'a complete report is valid', validateReport(good, k));
  ok(validateReport({ ...good, estimate: 1.2, interval: null }, k).length === 1, 'an estimate outside 0..1 is refused');
  ok(validateReport({ ...good, interval: { lo: 0.6, hi: 0.7, level: 0.95 } }, k).some((p) => p.includes('inside')), 'the estimate must lie inside its interval');
  ok(validateReport({ ...good, interval: null }, k, { requireInterval: true }).some((p) => p.includes('interval')), 'a mission can require the interval');
  ok(validateReport({ ...good, policy: { armor: 'medium', count: 40 } }, k).some((p) => p.startsWith('policy:')), 'the policy is checked on its own (over budget)');
  ok(validateReport({ ...good, unit: 'attack' }, k).length === 1 && validateReport({ ...good, rationale: ' ' }, k).length === 1, 'the unit is per goblin; a rationale is needed');
  ok(validateReport({ ...good, estimate: undefined, interval: null }, k).length === 1 && validateReport({ ...good, policy: undefined }, k).length >= 1, 'the claim and the policy are separate required parts');
}

sec('debrief');
{
  const k = new Kingdom(CONFIG);
  /** A dataset of `n` goblins met by habitat shares (the player's AC 13). */
  const sample = (n, roadShare, seed) => {
    const ds = new Dataset();
    ds.startExpedition({ start: 0, route: 'x' });
    const dice = new Dice(new RNG(seed));
    const nr = Math.round(n * roadShare);
    if (nr) meet(ds, dice, 'road', nr, { expedition: 1 });
    if (n - nr) meet(ds, dice, 'mire', n - nr, { expedition: 2 });
    return ds;
  };
  /** @returns {import('../src/game/research/report.js').Report} */
  const reportFrom = (ds, policy) => {
    const ev = evidenceFor(ds, LIGHT);
    return { armor: 'light', population: 'region', unit: /** @type {'enemy'} */ ('enemy'), estimate: /** @type {number} */ (ev.estimate), interval: ev.interval ? { lo: ev.interval.lo, hi: ev.interval.hi, level: 0.95 } : null, policy, rationale: 'test' };
  };
  const truth = truthSource(pop);

  // a big road-only (convenience) sample, the purchase its evidence favours
  const road = sample(200, 1, 'deb-road');
  const roadRank = k.rank(/** @type {any} */ (evidenceSource(road)), { seasons: 200, seed: 'pick' });
  const rRep = reportFrom(road, roadRank[0].policy);
  const season1 = k.season(rRep.policy, truth, 'deb-s1');
  const d1 = debrief({ report: rRep, dataset: road, population: pop, kingdom: k, season: season1, seasons: 200 });
  log('road-only debrief', JSON.stringify({ r: d1.research.flags, best: d1.decision.best, mine: d1.decision.mine, oracle: d1.replay.oracle, truth: d1.truth }));
  ok(d1.research.flags.includes('habitat-missing:mire') && d1.research.flags.includes('coverage-gap'), 'research: the mire is missing, a coverage gap', d1.research.flags);
  ok(d1.research.estimateMatches && d1.research.intervalMatches && d1.research.uncertaintyStated, 'research: the reported numbers match the data and uncertainty was stated');
  ok(d1.decision.defensible, 'decision: the purchase is defensible for the evidence the player had', d1.decision);
  ok(d1.truth.intervalCovers === false, 'truth: the road-only interval misses the Pass value', { value: d1.truth.value, interval: rRep.interval });
  ok(JSON.stringify(d1.replay.oracle.policy) !== JSON.stringify(rRep.policy) && d1.replay.totalCost.mean > d1.replay.oracle.meanCost, 'replay: under the truth the evidence\'s favourite costs more than the oracle\'s choice', { mine: d1.replay.totalCost.mean, oracle: d1.replay.oracle });

  // a representative sample (40 % road, 60 % mire)
  const rep = sample(300, 0.4, 'deb-rep');
  const repRank = k.rank(/** @type {any} */ (evidenceSource(rep)), { seasons: 200, seed: 'pick' });
  const gRep = reportFrom(rep, repRank[0].policy);
  const d2 = debrief({ report: gRep, dataset: rep, population: pop, kingdom: k, season: k.season(gRep.policy, truth, 'deb-s2'), seasons: 200 });
  log('representative debrief', JSON.stringify({ r: d2.research.flags, best: d2.decision.best, oracle: d2.replay.oracle, truth: d2.truth.value, ci: gRep.interval }));
  ok(d2.research.flags.length === 0, 'research: a representative sample raises no flag', d2.research.flags);
  ok(d2.decision.defensible && d2.truth.intervalCovers === true, 'decision defensible; the interval covers the truth');
  ok(d2.replay.totalCost.mean <= d2.replay.oracle.meanCost * 1.08, 'replay: its choice is close to the oracle\'s under the truth', { mine: d2.replay.totalCost.mean, oracle: d2.replay.oracle.meanCost });

  // the three parts stay apart: the same report with a lucky and an unlucky season
  const seasons = Array.from({ length: 40 }, (_, i) => k.season(gRep.policy, truth, `luck:${i}`)).sort((a, b) => a.totalCost - b.totalCost);
  const lucky = debrief({ report: gRep, dataset: rep, population: pop, kingdom: k, season: seasons[0], seasons: 100 });
  const unlucky = debrief({ report: gRep, dataset: rep, population: pop, kingdom: k, season: seasons[39], seasons: 100 });
  ok(JSON.stringify(lucky.research) === JSON.stringify(unlucky.research) && lucky.decision.defensible === unlucky.decision.defensible, 'a lucky or an unlucky season changes neither the research nor the decision judgement');
  ok(lucky.outcome.totalCost < unlucky.outcome.totalCost && lucky.replay.percentile < unlucky.replay.percentile, 'only the outcome and where it fell in the replay change', { lucky: lucky.replay.percentile, unlucky: unlucky.replay.percentile });

  // a careless report: numbers that do not match the data, no interval, a poor purchase
  const bad = { ...gRep, estimate: 0.9, interval: null, policy: { armor: 'medium', count: 26 } };
  const d3 = debrief({ report: bad, dataset: rep, population: pop, kingdom: k, season: k.season(bad.policy, truth, 'deb-s3'), seasons: 150 });
  ok(d3.research.flags.includes('estimate-mismatch') && d3.research.flags.includes('no-uncertainty'), 'research: estimate mismatch, no uncertainty', d3.research.flags);
  ok(!d3.decision.defensible && d3.decision.flags.includes('not-defensible'), 'decision: medium for 26 is not defensible on this evidence', d3.decision.mine);
  ok(JSON.stringify(debrief({ report: gRep, dataset: rep, population: pop, kingdom: k, season: seasons[5], seasons: 50 })) === JSON.stringify(debrief({ report: gRep, dataset: rep, population: pop, kingdom: k, season: seasons[5], seasons: 50 })), 'the debrief is reproducible');
  const empty = new Dataset();
  empty.startExpedition({ start: 0, route: 'x' });
  const d4 = debrief({ report: { ...gRep }, dataset: empty, population: pop, kingdom: k, season: seasons[0], seasons: 20 });
  ok(d4.decision.flags.includes('no-evidence') && d4.research.flags.includes('small-sample'), 'no data: no evidence world, a small sample');
}

// -------------------------------------------------------------------------------------------------
const total = pass + failures.length;
if (VERBOSE || failures.length) for (const [name, n] of sections) console.log(`  ${name}: ${n}`);
if (failures.length) {
  console.log(`test-research: ${failures.length} of ${total} assertions failed`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`test-research: all ${total} assertions passed`);
