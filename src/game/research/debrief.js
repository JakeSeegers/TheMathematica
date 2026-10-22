import { evidenceFor } from './report.js';
import { evidenceSource, truthSource, bootstrapSources } from './kingdom.js';

/**
 * The debrief (docs/design/RESEARCH_STATISTICS_RPG.md §11): three judgements kept apart, never
 * mixed into one score — and the truth, unlocked only now that the report is locked.
 *
 * 1. Research quality — did the sample cover the target population, was the protocol followed,
 *    do the reported numbers match the data, was uncertainty stated?
 * 2. Decision quality — given the player's own evidence, was the purchase defensible? Every
 *    option is replayed in "the world as the evidence describes it" (`evidenceSource`), and in
 *    `worlds` plausible worlds the evidence allows (bootstrap resamples of it, `bootstrapSources`);
 *    a purchase within `tolerance` of the best option in at least `plausibleShare` of those worlds
 *    is defensible (reasonable for some value the evidence allows). The truth plays no part.
 * 3. Realized outcome — the season that happened.
 *
 * The replay puts the season in context: the same policy over many seasons under the truth, where
 * the real season fell among them, and the best option under the truth (the oracle).
 *
 * Returned as data with flag ids; the UI words them (a death never "proves" the analysis wrong, a
 * lucky season never "proves" it right). Node-safe.
 */

/** @import { Dataset } from './dataset.js' */
/** @import { Population } from './populations.js' */
/** @import { Kingdom, SeasonResult } from './kingdom.js' */
/** @import { Report } from './report.js' */

/** Defaults (placeholders, design §11). */
export const DEBRIEF = Object.freeze({
  /** A purchase within this share of the best mean cost (in the evidence world) is defensible. */
  tolerance: 0.05,
  /** A habitat's share of the sample further than this from its share of the target is a coverage gap. */
  coverageGap: 0.15,
  /** Fewer eligible goblins than this is a small sample. */
  smallSample: 30,
  /** Reported numbers within this of the data's own count as matching. */
  match: 0.01,
  seasons: 300,
  /** Plausible worlds (bootstrap resamples of the evidence) and the seasons replayed in each. */
  worlds: 20,
  worldSeasons: 60,
  /** A purchase near the best in at least this share of the plausible worlds is defensible. */
  plausibleShare: 0.2,
});

/**
 * @param {{ report: Report, dataset: Dataset, population: Population, kingdom: Kingdom, season: SeasonResult, seed?: string, seasons?: number }} o
 */
export function debrief({ report, dataset, population, kingdom, season, seed = 'debrief', seasons = DEBRIEF.seasons }) {
  const ac = population.citizenAc(report.armor);
  const target = report.population === 'region' ? undefined : report.population;

  // ---- 1. research quality ----
  const ev = evidenceFor(dataset, ac, { level: report.interval?.level ?? 0.95, habitat: target });
  const eligible = dataset.attacks.filter((a) => a.eligible);
  const enemyHabitat = new Map(dataset.enemies.map((e) => [e.id, e.habitat]));
  /** @type {Record<string, number>} */
  const sampleCount = {};
  for (const a of eligible) {
    const h = /** @type {string} */ (enemyHabitat.get(a.enemyId));
    sampleCount[h] = (sampleCount[h] ?? 0) + 1;
  }
  const targetShares = target ? { [target]: 1 } : population.shares();
  const habitats = Object.keys(targetShares);
  const sampleShares = Object.fromEntries(habitats.map((h) => [h, eligible.length ? (sampleCount[h] ?? 0) / eligible.length : 0]));
  const gap = Math.max(0, ...habitats.map((h) => Math.abs(sampleShares[h] - targetShares[h])));
  /** @type {string[]} */
  const rFlags = [];
  for (const h of habitats) if (!sampleCount[h]) rFlags.push(`habitat-missing:${h}`);
  if (gap > DEBRIEF.coverageGap) rFlags.push('coverage-gap');
  if (ev.n < DEBRIEF.smallSample) rFlags.push('small-sample');
  const estimateMatches = ev.estimate !== null && Math.abs(report.estimate - ev.estimate) <= DEBRIEF.match;
  if (!estimateMatches) rFlags.push('estimate-mismatch');
  const intervalMatches = !!(report.interval && ev.interval && Math.abs(report.interval.lo - ev.interval.lo) <= DEBRIEF.match && Math.abs(report.interval.hi - ev.interval.hi) <= DEBRIEF.match);
  if (!report.interval) rFlags.push('no-uncertainty');
  else if (!intervalMatches) rFlags.push('interval-mismatch');
  if (ev.interval && !ev.interval.conditionMet) rFlags.push('condition-not-met');

  // ---- 2. decision quality (the evidence world only) ----
  const evSource = evidenceSource(dataset);
  /** @type {any} */
  let decision;
  if (!evSource) decision = { flags: ['no-evidence'], defensible: false, ranking: [] };
  else {
    const ranking = kingdom.rank(evSource, { seasons, seed: `${seed}:evidence` });
    const key = (/** @type {{ armor: string, count: number }} */ p) => (p.armor === 'none' || p.count === 0 ? 'none:0' : `${p.armor}:${p.count}`);
    const mine = ranking.find((r) => key(r.policy) === key(report.policy)) ?? { policy: report.policy, ...kingdom.replay(report.policy, evSource, { seasons, seed: `${seed}:evidence` }) };
    const best = ranking[0];
    const regret = mine.totalCost.mean - best.totalCost.mean;
    // the plausible worlds: in how many is the purchase near the best?
    const worlds = bootstrapSources(dataset, DEBRIEF.worlds, `${seed}:worlds`);
    let near = 0;
    worlds.forEach((src, w) => {
      const r = kingdom.rank(src, { seasons: DEBRIEF.worldSeasons, seed: `${seed}:world${w}` });
      const m = r.find((x) => key(x.policy) === key(report.policy)) ?? { totalCost: kingdom.replay(report.policy, src, { seasons: DEBRIEF.worldSeasons, seed: `${seed}:world${w}` }).totalCost };
      if (m.totalCost.mean <= r[0].totalCost.mean * (1 + DEBRIEF.tolerance)) near++;
    });
    const plausible = worlds.length ? near / worlds.length : 0;
    const defensible = plausible >= DEBRIEF.plausibleShare;
    decision = {
      defensible, regret,
      /** the share of plausible worlds where the purchase is near the best */
      plausible, worlds: worlds.length,
      rank: ranking.findIndex((r) => key(r.policy) === key(report.policy)) + 1,
      options: ranking.length,
      best: { policy: best.policy, meanCost: best.totalCost.mean },
      mine: { policy: report.policy, meanCost: mine.totalCost.mean },
      flags: defensible ? [] : ['not-defensible'],
      ranking: ranking.map((r) => ({ policy: r.policy, meanCost: r.totalCost.mean })),
    };
  }

  // ---- 3. realized outcome ----
  const outcome = {
    dead: season.dead, injured: season.injured, knockedOut: season.knockedOut,
    protected: season.citizens.filter((c) => c.armor !== 'none').length,
    equipmentFailures: season.equipmentFailures,
    spent: season.spent, remaining: season.remaining, losses: season.losses, unfunded: season.unfunded, totalCost: season.totalCost,
  };

  // ---- the replay and the truth (unlocked now) ----
  const truth = truthSource(population);
  const mineTruth = kingdom.replay(report.policy, truth, { seasons, seed: `${seed}:truth` });
  const below = mineTruth.costs.filter((c) => c < season.totalCost).length;
  const equal = mineTruth.costs.filter((c) => c === season.totalCost).length;
  const percentile = (below + equal / 2) / mineTruth.costs.length;
  const oracle = kingdom.rank(truth, { seasons, seed: `${seed}:oracle` })[0];
  const trueValue = population.truePenetration(ac, target);

  return {
    research: {
      flags: rFlags,
      sample: { eligible: ev.n, shares: sampleShares, counts: sampleCount },
      target: { population: report.population, shares: targetShares },
      coverageGap: gap,
      data: { estimate: ev.estimate, interval: ev.interval },
      estimateMatches, intervalMatches,
      uncertaintyStated: !!report.interval,
    },
    decision,
    outcome,
    replay: {
      policy: report.policy,
      seasons,
      dead: mineTruth.dead, injured: mineTruth.injured, totalCost: mineTruth.totalCost,
      /** where the real season's cost fell among the replayed seasons (0 cheap … 1 dear) */
      percentile,
      oracle: { policy: oracle.policy, meanCost: oracle.totalCost.mean },
    },
    truth: {
      armor: report.armor, ac, value: trueValue,
      intervalCovers: report.interval ? report.interval.lo <= trueValue && trueValue <= report.interval.hi : null,
      byHabitat: Object.fromEntries(population.habitatIds.map((h) => [h, population.truePenetration(ac, h)])),
    },
  };
}
