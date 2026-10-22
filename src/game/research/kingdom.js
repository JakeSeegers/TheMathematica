import { RNG } from '../../engine/utils/math.js';
import { Dice } from '../glaive/dice.js';
import { injuryResult, injuryBonus } from '../glaive/rules.js';
import { penetrates } from './dataset.js';

/**
 * The kingdom (docs/design/RESEARCH_STATISTICS_RPG.md §10): the protection budget, the purchase
 * policies, and a season of raids resolved with GLAIVE's rules. Every rule here is shown to the
 * player in the mission brief:
 *
 * - A policy buys one armour type for `count` citizens (or nothing). The armour goes to the areas in
 *   proportion to their citizens (rounded down, the remainder to the largest fractions, ties to
 *   the larger area). Unspent silver stays in the treasury.
 * - Each citizen (HP `citizenHp`, AC 10 + DEX + armour) faces `attacksPerCitizen` raid attacks, from
 *   the raiders of the citizen's own area, until one drops the citizen to 0 HP or less.
 * - An attack: d20 + bonus against the citizen's AC (a natural 1 misses, a natural 20 hits); on a
 *   hit the weapon's damage (a critical rolls it with ADV).
 * - A citizen below −5 HP dies (GLAIVE: below −(5 + STR)); one at 0 HP or less rolls the injury
 *   table: d12 + ½ the HP below 0 (`injuryResult`) — 'fine' is knocked out but unhurt, 'dead' dies,
 *   anything else is an injury.
 * - Cost to the kingdom = silver spent + losses (each injury, each death) + the shortfall below the
 *   reserve that the purchase leaves (needs that go unfunded).
 *
 * Raids come from an AttackSource: the true population (the real season, the replay) or the
 * player's evidence (the decision review: the world as the player's sample describes it).
 *
 * Node-safe.
 */

/** @import { Population, ResearchConfig } from './populations.js' */
/** @import { Dataset } from './dataset.js' */

/**
 * The kingdom section of a research config.
 * @typedef {object} KingdomConfig
 * @property {number} budget
 * @property {number} reserve
 * @property {Record<string, number>} citizens   area (habitat id) → citizens living there
 * @property {number} citizenHp
 * @property {number} attacksPerCitizen
 * @property {Record<string, number>} prices     armour id → silver
 * @property {{ injury: number, death: number }} losses
 * @property {number} countStep                  the purchase counts offered (multiples of it)
 */

/** @typedef {{ armor: string, count: number }} Policy  armour 'none' (or count 0) buys nothing */

/**
 * Where raid attacks come from.
 * @typedef {object} AttackSource
 * @property {string} kind
 * @property {(area: string, ac: number, rng: RNG, dice: Dice) => { hit: boolean, damage: number }} attack
 */

/**
 * One season's result.
 * @typedef {object} SeasonResult
 * @property {Policy} policy
 * @property {{ area: string, armor: string, hp: number, hits: number, down: boolean, result: string }[]} citizens
 * @property {number} knockedOut     down, then 'fine'
 * @property {number} injured
 * @property {number} dead
 * @property {number} equipmentFailures  hits on armoured citizens
 * @property {number} spent
 * @property {number} remaining      treasury left of the budget
 * @property {number} losses         silver value of the injuries and deaths
 * @property {number} unfunded       the shortfall below the reserve
 * @property {number} totalCost      spent + losses + unfunded
 */

/** A citizen below this HP dies (GLAIVE: below −(5 + STR), STR +0). */
const DEATH_BELOW = -5;

/**
 * @param {any} k
 * @param {ResearchConfig} config
 * @returns {string[]}
 */
export function validateKingdom(k, config) {
  const out = [];
  if (!k || typeof k !== 'object') return ['kingdom missing'];
  for (const f of ['budget', 'reserve', 'citizenHp', 'attacksPerCitizen', 'countStep']) if (!(Number.isFinite(k[f]) && k[f] >= 0)) out.push(`kingdom.${f} must be a number ≥ 0`);
  if (!(k.countStep >= 1)) out.push('kingdom.countStep must be ≥ 1');
  for (const [area, n] of Object.entries(k.citizens ?? {})) {
    if (!Object.hasOwn(config.habitats, area)) out.push(`kingdom.citizens: unknown area ${area}`);
    if (!(Number.isInteger(n) && n >= 0)) out.push(`kingdom.citizens.${area} must be a whole number`);
  }
  if (!Object.keys(k.citizens ?? {}).length) out.push('kingdom.citizens empty');
  for (const [a, price] of Object.entries(k.prices ?? {})) {
    if (!Object.hasOwn(config.citizens.armor, a)) out.push(`kingdom.prices: unknown armour ${a}`);
    if (!(price > 0)) out.push(`kingdom.prices.${a} must be > 0`);
  }
  if (!(k.losses?.injury >= 0 && k.losses?.death >= 0)) out.push('kingdom.losses need injury and death');
  return out;
}

export class Kingdom {
  /** @param {ResearchConfig & { kingdom: KingdomConfig }} config */
  constructor(config) {
    const problems = validateKingdom(config.kingdom, config);
    if (problems.length) throw new Error(`kingdom config: ${problems.join('; ')}`);
    this.config = config;
    this.k = config.kingdom;
    this.areas = Object.keys(this.k.citizens);
  }

  get totalCitizens() {
    return this.areas.reduce((s, a) => s + this.k.citizens[a], 0);
  }

  /** @param {Policy} p */
  cost(p) {
    if (p.armor === 'none' || p.count <= 0) return 0;
    return (this.k.prices[p.armor] ?? Infinity) * p.count;
  }

  /** The problems of a policy (empty when the kingdom can carry it out). @param {Policy} p */
  validatePolicy(p) {
    const out = [];
    if (!p || typeof p.armor !== 'string') return ['no policy'];
    if (p.armor !== 'none' && !Object.hasOwn(this.k.prices, p.armor)) out.push(`armour ${p.armor} is not for sale`);
    if (!(Number.isInteger(p.count) && p.count >= 0)) out.push('count must be a whole number ≥ 0');
    if (p.count > this.totalCitizens) out.push(`only ${this.totalCitizens} citizens`);
    if (this.cost(p) > this.k.budget) out.push(`costs ${this.cost(p)} sp, the budget is ${this.k.budget} sp`);
    return out;
  }

  /**
   * How many armoured citizens each area gets (in proportion to its citizens; see the header).
   * @param {Policy} p
   * @returns {Record<string, number>}
   */
  allocation(p) {
    const total = this.totalCitizens;
    const n = p.armor === 'none' ? 0 : Math.min(p.count, total);
    const raw = this.areas.map((a) => ({ a, exact: (n * this.k.citizens[a]) / total }));
    const out = Object.fromEntries(raw.map((r) => [r.a, Math.floor(r.exact)]));
    let left = n - Object.values(out).reduce((s, v) => s + v, 0);
    const order = [...raw].sort((x, y) => (y.exact % 1) - (x.exact % 1) || this.k.citizens[y.a] - this.k.citizens[x.a]);
    for (const r of order) { if (left <= 0) break; out[r.a]++; left--; }
    return out;
  }

  /** Every policy the mission offers: nothing, and each armour for multiples of `countStep` (plus everyone it can afford). */
  options() {
    /** @type {Policy[]} */
    const out = [{ armor: 'none', count: 0 }];
    for (const armor of Object.keys(this.k.prices)) {
      const max = Math.min(this.totalCitizens, Math.floor(this.k.budget / this.k.prices[armor]));
      const counts = new Set();
      for (let c = this.k.countStep; c <= max; c += this.k.countStep) counts.add(c);
      if (max > 0) counts.add(max);
      for (const c of [...counts].sort((a, b) => a - b)) out.push({ armor, count: c });
    }
    return out;
  }

  /**
   * One season of raids.
   * @param {Policy} policy
   * @param {AttackSource} source
   * @param {string|number} seed
   * @returns {SeasonResult}
   */
  season(policy, source, seed) {
    const problems = this.validatePolicy(policy);
    if (problems.length) throw new Error(`policy: ${problems.join('; ')}`);
    const rng = new RNG(`season|${seed}`);
    const dice = new Dice(rng);
    const alloc = this.allocation(policy);
    const armorAc = (/** @type {string} */ a) => 10 + this.config.citizens.dex + (this.config.citizens.armor[a] ?? 0);
    /** @type {SeasonResult['citizens']} */
    const citizens = [];
    let knockedOut = 0, injured = 0, dead = 0, failures = 0;
    for (const area of this.areas) {
      for (let i = 0; i < this.k.citizens[area]; i++) {
        const armor = i < alloc[area] ? policy.armor : 'none';
        const ac = armorAc(armor);
        let hp = this.k.citizenHp, hits = 0, down = false;
        for (let k = 0; k < this.k.attacksPerCitizen && !down; k++) {
          const a = source.attack(area, ac, rng, dice);
          if (!a.hit) continue;
          hits++;
          if (armor !== 'none') failures++;
          hp -= a.damage;
          if (hp <= 0) down = true;
        }
        let result = 'unharmed';
        if (down) {
          result = hp < DEATH_BELOW ? 'dead' : injuryResult(dice.die(12) + injuryBonus(hp));
          if (result === 'dead') dead++;
          else if (result === 'fine') knockedOut++;
          else injured++;
        } else if (hits) result = 'hurt';
        citizens.push({ area, armor, hp, hits, down, result });
      }
    }
    const spent = this.cost(policy);
    const remaining = this.k.budget - spent;
    const losses = injured * this.k.losses.injury + dead * this.k.losses.death;
    const unfunded = Math.max(0, this.k.reserve - remaining);
    return { policy: { ...policy }, citizens, knockedOut, injured, dead, equipmentFailures: failures, spent, remaining, losses, unfunded, totalCost: spent + losses + unfunded };
  }

  /**
   * A policy over many seasons: the mean and the spread of its results.
   * @param {Policy} policy
   * @param {AttackSource} source
   * @param {{ seasons?: number, seed?: string }} [o]
   */
  replay(policy, source, { seasons = 500, seed = 'replay' } = {}) {
    const results = [];
    for (let i = 0; i < seasons; i++) results.push(this.season(policy, source, `${seed}:${i}`));
    const field = (/** @type {keyof SeasonResult} */ f) => results.map((r) => /** @type {number} */ (r[f])).sort((a, b) => a - b);
    const summary = (/** @type {number[]} */ xs) => ({ mean: xs.reduce((s, x) => s + x, 0) / xs.length, p10: xs[Math.floor(0.1 * (xs.length - 1))], p50: xs[Math.floor(0.5 * (xs.length - 1))], p90: xs[Math.floor(0.9 * (xs.length - 1))] });
    return {
      policy: { ...policy }, seasons,
      dead: summary(field('dead')), injured: summary(field('injured')), totalCost: summary(field('totalCost')),
      /** @type {number[]} sorted, for "where did the real season fall" */
      costs: field('totalCost'),
    };
  }

  /**
   * Rank every option by its mean cost over `seasons` seasons from `source` (lowest first).
   * @param {AttackSource} source
   * @param {{ seasons?: number, seed?: string }} [o]
   */
  rank(source, o = {}) {
    return this.options().map((p) => ({ policy: p, ...this.replay(p, source, o) })).sort((a, b) => a.totalCost.mean - b.totalCost.mean);
  }
}

/**
 * Raids from the true population of each area (the real season, the replay).
 * @param {Population} population
 * @returns {AttackSource}
 */
export function truthSource(population) {
  return {
    kind: 'truth',
    attack(area, ac, rng, dice) {
      const ind = population.sample(area, rng);
      const r = dice.d20(ind.attackBonus, ac);
      if (!r.success) return { hit: false, damage: 0 };
      return { hit: true, damage: dice.roll(ind.damage, { mode: r.crit ? 'adv' : 'normal' }).total };
    },
  };
}

/**
 * Raids as the player's evidence describes them: each attack resamples one of the dataset's eligible
 * attacks (its strike total, critical or fumble decides whether it beats the citizen's AC) and one
 * observed damage-on-hit value (the better of two on a critical). The sample is pooled over its
 * habitats — what a report about the whole region assumes. Null when the dataset has no eligible
 * attack or no observed damage.
 * @param {Dataset} dataset
 * @returns {AttackSource|null}
 */
export function evidenceSource(dataset) {
  const strikes = dataset.attacks.filter((a) => a.eligible);
  const damage = dataset.damageOnHit();
  if (!strikes.length || !damage.length) return null;
  return {
    kind: 'evidence',
    attack(area, ac, rng) {
      const s = strikes[Math.floor(rng.next() * strikes.length)];
      if (!penetrates(s, ac)) return { hit: false, damage: 0 };
      const d1 = damage[Math.floor(rng.next() * damage.length)];
      const d = s.critical ? Math.max(d1, damage[Math.floor(rng.next() * damage.length)]) : d1;
      return { hit: true, damage: d };
    },
  };
}
