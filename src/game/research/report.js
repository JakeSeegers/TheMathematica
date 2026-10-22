import { proportionInterval } from './stats.js';

/**
 * The player's report to the kingdom (docs/design/RESEARCH_STATISTICS_RPG.md §6 mission 5, §8):
 * a **statistical claim** (what the evidence says: an estimate, and an interval once unlocked)
 * and, separately, a **policy** (what to buy). Neither is derived from the other here: the player
 * enters both, and the debrief judges them apart.
 *
 * Node-safe.
 */

/** @import { Dataset } from './dataset.js' */
/** @import { Kingdom, Policy } from './kingdom.js' */

/**
 * @typedef {object} Report
 * @property {string} armor        the armour the claim is about (a citizen armour id)
 * @property {string} population   what the claim generalizes to: 'region' or a habitat id
 * @property {'enemy'} unit        the unit of the estimate (one eligible attack per goblin)
 * @property {number} estimate     the proportion of goblins' attacks that penetrate that armour
 * @property {{ lo: number, hi: number, level: number }|null} interval  null before it is unlocked
 * @property {Policy} policy
 * @property {string} rationale    a short reason in the player's words (or a picked sentence id)
 */

/**
 * The problems of a report (empty when the kingdom can accept it).
 * @param {any} r
 * @param {Kingdom} kingdom
 * @param {{ requireInterval?: boolean }} [o]
 * @returns {string[]}
 */
export function validateReport(r, kingdom, { requireInterval = false } = {}) {
  const out = [];
  if (!r || typeof r !== 'object') return ['no report'];
  if (!Object.hasOwn(kingdom.config.citizens.armor, r.armor)) out.push(`unknown armour ${r.armor}`);
  if (r.population !== 'region' && !Object.hasOwn(kingdom.config.habitats, r.population)) out.push(`unknown population ${r.population}`);
  if (r.unit !== 'enemy') out.push('the estimate is per goblin (unit "enemy")');
  if (!(Number.isFinite(r.estimate) && r.estimate >= 0 && r.estimate <= 1)) out.push('the estimate must be a proportion between 0 and 1');
  if (r.interval) {
    const { lo, hi, level } = r.interval;
    if (!(Number.isFinite(lo) && Number.isFinite(hi) && lo <= hi)) out.push('the interval needs lo ≤ hi');
    else if (!(lo <= r.estimate && r.estimate <= hi)) out.push('the estimate must lie inside its interval');
    if (!(level > 0 && level < 1)) out.push('the confidence level must be between 0 and 1');
  } else if (requireInterval) out.push('this mission asks for an interval');
  out.push(...kingdom.validatePolicy(r.policy ?? /** @type {any} */ ({})).map((p) => `policy: ${p}`));
  if (typeof r.rationale !== 'string' || !r.rationale.trim()) out.push('a rationale is needed');
  return out;
}

/**
 * What the dataset itself says for a claim (the ledger's numbers; the debrief compares the report
 * with it): the per-goblin penetration of `ac` with its normal-approximation interval.
 * @param {Dataset} dataset
 * @param {number} ac
 * @param {{ level?: number, habitat?: string }} [o]
 */
export function evidenceFor(dataset, ac, { level = 0.95, habitat } = {}) {
  const p = dataset.penetration(ac, { unit: 'enemy', habitat });
  if (!p.n) return { n: 0, x: 0, estimate: null, interval: null };
  const ci = proportionInterval(p.x, p.n, { level });
  return { n: p.n, x: p.x, estimate: ci.estimate, interval: { lo: ci.lo, hi: ci.hi, level, conditionMet: ci.conditionMet } };
}
