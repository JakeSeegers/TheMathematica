import { RNG } from '../../engine/utils/math.js';

/**
 * The world truth of a research investigation (docs/design/RESEARCH_STATISTICS_RPG.md §7): the
 * habitats of one enemy family, how its individuals vary, and the exact values the player tries
 * to estimate. Nothing here is player-facing: the field ledger, the journal and the report read a
 * Dataset (dataset.js), never a Population. Designer views and the debrief may read it.
 *
 * Every individual is a GLAIVE stat block (AC, HD, one weapon with an attack bonus): only the
 * attack bonus (hidden) and the weapon (observable) vary between individuals. GLAIVE lets a stat
 * block give an attack bonus other than its HD, so this is writing stat blocks, not a rule change.
 * HP does not vary (decision D3: a weaker goblin dying before it attacks would bias the sample).
 *
 * Individuals are drawn as from a large population (with replacement): the population sizes set
 * each habitat's share of the target region. The same seed parts always give the same individual.
 *
 * Import-free apart from the engine's RNG and Node-safe.
 */

/**
 * One habitat's distributions: [value, probability] pairs.
 * @typedef {object} HabitatConfig
 * @property {string} name                       display name (designer views)
 * @property {number} population                 its size (sets the habitat's share of the region)
 * @property {[number, number][]} attackBonus    [bonus, probability]
 * @property {[string, number][]} weapons        [weapon id, probability]
 */

/**
 * A research configuration (public/research/<level>.json).
 * @typedef {object} ResearchConfig
 * @property {number} version
 * @property {string} level
 * @property {number} worldSeed
 * @property {string} family                     the studied enemy kind (bestiary key)
 * @property {{ ac: number, hd: number, morale: number }} statBlock  what every individual shares
 * @property {Record<string, { name: string, damage: string }>} weapons
 * @property {Record<string, HabitatConfig>} habitats
 * @property {Record<string, string>} groups     level group id → habitat id
 * @property {{ dex: number, armor: Record<string, number> }} citizens  armour id → AC bonus
 */

/**
 * One individual: its GLAIVE stat block and where it lives.
 * @typedef {object} Individual
 * @property {string} key           the seed parts that made it (unique per individual)
 * @property {string} habitat
 * @property {number} ac
 * @property {number} hd
 * @property {number} hp
 * @property {number} morale
 * @property {number} attackBonus   hidden from the player
 * @property {string} weapon        observable
 * @property {string} damage        dice expression of the weapon
 */

/** Probabilities of a distribution must add up to 1 within this. */
const SUM_EPS = 1e-9;

/**
 * Check a research configuration; returns the problems (empty when it is valid).
 * @param {any} c
 * @returns {string[]}
 */
export function validateConfig(c) {
  const out = [];
  if (!c || typeof c !== 'object') return ['not an object'];
  if (c.version !== 1) out.push(`version ${c.version} (expected 1)`);
  if (typeof c.family !== 'string' || !c.family) out.push('family missing');
  if (!Number.isInteger(c.worldSeed)) out.push('worldSeed must be an integer');
  const sb = c.statBlock;
  if (!sb || ![sb.ac, sb.hd, sb.morale].every(Number.isFinite)) out.push('statBlock needs ac, hd, morale');
  const weapons = c.weapons ?? {};
  for (const [id, w] of Object.entries(weapons)) if (!w || typeof w.damage !== 'string' || !/^\d+d\d+([+-]\d+)?$/.test(w.damage)) out.push(`weapon ${id}: bad damage`);
  const habitats = c.habitats ?? {};
  if (!Object.keys(habitats).length) out.push('no habitats');
  for (const [id, h] of Object.entries(habitats)) {
    if (!(h?.population > 0)) out.push(`habitat ${id}: population must be > 0`);
    for (const key of /** @type {const} */ (['attackBonus', 'weapons'])) {
      const d = h?.[key];
      if (!Array.isArray(d) || !d.length) { out.push(`habitat ${id}: ${key} missing`); continue; }
      let sum = 0;
      for (const pair of d) {
        if (!Array.isArray(pair) || pair.length !== 2 || !(pair[1] >= 0)) { out.push(`habitat ${id}: ${key} has a bad pair`); continue; }
        sum += pair[1];
        if (key === 'weapons' && !Object.hasOwn(weapons, pair[0])) out.push(`habitat ${id}: unknown weapon ${pair[0]}`);
        if (key === 'attackBonus' && !Number.isInteger(pair[0])) out.push(`habitat ${id}: attack bonus ${pair[0]} is not an integer`);
      }
      if (Math.abs(sum - 1) > SUM_EPS) out.push(`habitat ${id}: ${key} probabilities add up to ${sum}`);
    }
  }
  for (const [g, h] of Object.entries(c.groups ?? {})) if (!Object.hasOwn(habitats, h)) out.push(`group ${g}: unknown habitat ${h}`);
  if (!c.citizens || !Number.isFinite(c.citizens.dex) || !c.citizens.armor) out.push('citizens need dex and armor');
  return out;
}

/**
 * The chance that one normal-mode attack with `bonus` hits AC `ac` under GLAIVE's d20 rules (as
 * `Dice.d20` plays them): a natural 1 always misses, a natural 20 always hits, otherwise a hit when
 * natural + bonus ≥ AC. Exact (an enumeration of the 20 faces).
 * @param {number} bonus
 * @param {number} ac
 */
export function penetrationChance(bonus, ac) {
  let hits = 0;
  for (let n = 1; n <= 20; n++) if (n !== 1 && (n === 20 || n + bonus >= ac)) hits++;
  return hits / 20;
}

/** Pick from [value, probability] pairs with one uniform draw. @template T @param {[T, number][]} pairs @param {number} u */
function pickWeighted(pairs, u) {
  let acc = 0;
  for (const [v, p] of pairs) {
    acc += p;
    if (u < acc) return v;
  }
  return pairs[pairs.length - 1][0];
}

export class Population {
  /** @param {ResearchConfig} config */
  constructor(config) {
    const problems = validateConfig(config);
    if (problems.length) throw new Error(`research config: ${problems.join('; ')}`);
    this.config = config;
    /** @type {string[]} */
    this.habitatIds = Object.keys(config.habitats);
  }

  /** The habitat of a level group, or null when the group is not part of the study. @param {string} groupId */
  habitatOf(groupId) {
    return Object.hasOwn(this.config.groups, groupId) ? this.config.groups[groupId] : null;
  }

  /** Each habitat's share of the target region (by population). @returns {Record<string, number>} */
  shares() {
    const total = this.habitatIds.reduce((s, h) => s + this.config.habitats[h].population, 0);
    return Object.fromEntries(this.habitatIds.map((h) => [h, this.config.habitats[h].population / total]));
  }

  /**
   * One individual of `habitat`, made from seed parts (for a spawn: the expedition, the group and
   * the slot). The same parts give the same individual.
   * @param {string} habitat
   * @param {(string|number)[]} parts
   * @returns {Individual}
   */
  individual(habitat, parts) {
    const h = this.config.habitats[habitat];
    if (!h) throw new Error(`unknown habitat ${habitat}`);
    const key = [habitat, ...parts].join(':');
    const rng = new RNG(`${this.config.worldSeed}|${key}`);
    const attackBonus = pickWeighted(h.attackBonus, rng.next());
    const weapon = pickWeighted(h.weapons, rng.next());
    const sb = this.config.statBlock;
    return { key, habitat, ac: sb.ac, hd: sb.hd, hp: sb.hd * 5, morale: sb.morale, attackBonus, weapon, damage: this.config.weapons[weapon].damage };
  }

  /**
   * An individual drawn with the caller's RNG (the kingdom's raids: many draws, one seeded stream).
   * Same distribution as `individual`.
   * @param {string} habitat
   * @param {{ next(): number }} rng
   * @returns {{ attackBonus: number, weapon: string, damage: string }}
   */
  sample(habitat, rng) {
    const h = this.config.habitats[habitat];
    if (!h) throw new Error(`unknown habitat ${habitat}`);
    const attackBonus = pickWeighted(h.attackBonus, rng.next());
    const weapon = pickWeighted(h.weapons, rng.next());
    return { attackBonus, weapon, damage: this.config.weapons[weapon].damage };
  }

  /**
   * The individuals of a level group for one expedition (its slots 0..count-1).
   * @param {string} groupId
   * @param {number} expedition
   * @param {number} count
   * @returns {Individual[]}
   */
  group(groupId, expedition, count) {
    const habitat = this.habitatOf(groupId);
    if (!habitat) return [];
    return Array.from({ length: count }, (_, i) => this.individual(habitat, [`e${expedition}`, groupId, i]));
  }

  /** The AC of a citizen in armour `armorId` (10 + DEX + armour). @param {string} armorId */
  citizenAc(armorId) {
    const a = this.config.citizens.armor[armorId];
    if (a === undefined) throw new Error(`unknown armour ${armorId}`);
    return 10 + this.config.citizens.dex + a;
  }

  /**
   * The true proportion of a habitat's individuals' normal-mode attacks that penetrate AC `ac`
   * (the mean over individuals of each one's own chance: what one eligible attack per enemy
   * estimates). With no habitat: the whole target region, weighted by population.
   * @param {number} ac
   * @param {string} [habitat]
   */
  truePenetration(ac, habitat) {
    if (habitat === undefined) {
      const sh = this.shares();
      return this.habitatIds.reduce((s, id) => s + sh[id] * this.truePenetration(ac, id), 0);
    }
    return this.config.habitats[habitat].attackBonus.reduce((s, [b, p]) => s + p * penetrationChance(b, ac), 0);
  }

  /**
   * The true distribution of damage on a hit, per habitat or for the region, as
   * [value, probability] pairs (a critical rolls the weapon with ADV, so crits are included with
   * the 1-in-20 natural 20 weighted by the hit chance at `ac`).
   * @param {number} ac
   * @param {string} [habitat]
   * @returns {Map<number, number>}
   */
  trueDamageOnHit(ac, habitat) {
    const ids = habitat === undefined ? this.habitatIds : [habitat];
    const sh = habitat === undefined ? this.shares() : { [habitat]: 1 };
    /** @type {Map<number, number>} */
    const out = new Map();
    let mass = 0;
    for (const id of ids) {
      const h = this.config.habitats[id];
      for (const [b, pb] of h.attackBonus) {
        const pHit = penetrationChance(b, ac);
        if (pHit <= 0) continue;
        const pCrit = 1 / 20;
        for (const [w, pw] of h.weapons) {
          const dist = damageDistribution(this.config.weapons[w].damage, false);
          const adv = damageDistribution(this.config.weapons[w].damage, true);
          const weight = sh[id] * pb * pw;
          for (const [v, p] of dist) out.set(v, (out.get(v) ?? 0) + weight * (pHit - pCrit) * p);
          for (const [v, p] of adv) out.set(v, (out.get(v) ?? 0) + weight * pCrit * p);
          mass += weight * pHit;
        }
      }
    }
    for (const [v, p] of out) out.set(v, p / mass);
    return new Map([...out.entries()].sort((a, b) => a[0] - b[0]));
  }
}

/**
 * The exact distribution of a dice expression `NdS(+M)`; with `adv` the better of two rolls (as
 * `Dice.roll` with mode 'adv').
 * @param {string} expr
 * @param {boolean} adv
 * @returns {Map<number, number>}
 */
export function damageDistribution(expr, adv) {
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(expr);
  if (!m) throw new Error(`bad dice ${expr}`);
  const count = Number(m[1]), sides = Number(m[2]), mod = Number(m[3] ?? 0);
  /** @type {Map<number, number>} */
  let dist = new Map([[0, 1]]);
  for (let i = 0; i < count; i++) {
    /** @type {Map<number, number>} */
    const next = new Map();
    for (const [v, p] of dist) for (let f = 1; f <= sides; f++) next.set(v + f, (next.get(v + f) ?? 0) + p / sides);
    dist = next;
  }
  if (adv) {
    // P(max(X, Y) = v) = F(v)² − F(v − 1)²
    const vals = [...dist.keys()].sort((a, b) => a - b);
    /** @type {Map<number, number>} */
    const best = new Map();
    let cum = 0;
    for (const v of vals) {
      const prev = cum;
      cum += dist.get(v) ?? 0;
      best.set(v, cum * cum - prev * prev);
    }
    dist = best;
  }
  return new Map([...dist.entries()].map(([v, p]) => [v + mod, p]));
}
