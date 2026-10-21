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
      ds.addAttack({ enemyId: en.id, targetId: 'player', targetAc: playerAc, rollMode: mode, strikeTotal: r.total, critical: r.crit, fumble: r.fumble, hit: r.success, damage, free: false, vsUnconscious: false });
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
  ds.addAttack({ ...base, enemyId: e1.id, rollMode: 'normal', strikeTotal: 21, critical: true, fumble: false, hit: true, damage: 6 });
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
  ok(penetrates({ strikeTotal: 5, critical: true, fumble: false }, 30) && !penetrates({ strikeTotal: 40, critical: false, fumble: true }, 5), 'a critical always penetrates, a fumble never');
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
        ds.addAttack({ enemyId: en.id, targetId: 'player', targetAc: 13, rollMode: 'normal', strikeTotal: roll.total, critical: roll.crit, fumble: roll.fumble, hit: roll.success, damage: roll.success ? 1 : null, free: false, vsUnconscious: false });
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
const total = pass + failures.length;
if (VERBOSE || failures.length) for (const [name, n] of sections) console.log(`  ${name}: ${n}`);
if (failures.length) {
  console.log(`test-research: ${failures.length} of ${total} assertions failed`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`test-research: all ${total} assertions passed`);
