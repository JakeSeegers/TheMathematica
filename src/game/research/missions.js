import { evidenceFor } from './report.js';
import { mean } from './stats.js';

/**
 * The missions of an investigation (docs/design/RESEARCH_STATISTICS_RPG.md §6): short tasks
 * embedded in the research, each checked against the player's own dataset — never against the
 * truth. A task may need data first (`needs`: eligible goblins, overall or from one habitat, or
 * damage values); a mission is done when all its tasks are; finishing one can unlock ledger
 * features (`summaries`: the automatic statistics; `interval`: the confidence interval).
 *
 * Mission text lives in the research config (`missions`). Node-safe.
 */

/** @import { Dataset } from './dataset.js' */
/** @import { ResearchConfig } from './populations.js' */

/**
 * @typedef {{ habitat?: string, eligible?: number, damage?: number }} Needs
 * @typedef {{ kind: 'proportion', armor: string, habitat?: string } | { kind: 'meanDamage', first: number }} NumberTarget
 * @typedef {{ text: string, correct: boolean, feedback: string }} ChoiceOption
 * @typedef {{ id: string, type: 'choice', question: string, options: ChoiceOption[], needs?: Needs }
 *   | { id: string, type: 'number', question: string, target: NumberTarget, tolerance: number, hint: string, needs?: Needs }
 *   | { id: string, type: 'report', needs?: Needs }} Task
 * @typedef {{ id: string, title: string, brief: string, tasks: Task[], unlocks?: string[] }} Mission
 */

/** The 10 first damage values (chronological). @param {Dataset} ds @param {number} n */
export function firstDamage(ds, n) {
  return ds.damageOnHit().slice(0, n);
}

export class MissionProgress {
  /**
   * @param {ResearchConfig & { missions: Mission[] }} config
   * @param {{ done?: string[], tries?: Record<string, number> }} [saved]
   */
  constructor(config, saved = {}) {
    this.config = config;
    /** @type {Mission[]} */
    this.missions = config.missions ?? [];
    /** @type {Set<string>} `<mission>.<task>` ids answered correctly */
    this.done = new Set(saved.done ?? []);
    /** @type {Record<string, number>} wrong answers per task */
    this.tries = { ...(saved.tries ?? {}) };
  }

  /** @param {Mission} m @param {Task} t */
  key(m, t) { return `${m.id}.${t.id}`; }

  /** @param {Mission} m */
  missionDone(m) { return m.tasks.every((t) => this.done.has(this.key(m, t))); }

  /** The first mission not done (null when all are). */
  get current() {
    return this.missions.find((m) => !this.missionDone(m)) ?? null;
  }

  /** Is a ledger feature unlocked (a finished mission names it)? @param {string} flag */
  unlocked(flag) {
    return this.missions.some((m) => (m.unlocks ?? []).includes(flag) && this.missionDone(m));
  }

  /**
   * Does the dataset have what a task needs?
   * @param {Task} t
   * @param {Dataset} ds
   * @returns {{ met: boolean, have: number, need: number, what: string }}
   */
  needs(t, ds) {
    const n = t.needs;
    if (!n) return { met: true, have: 0, need: 0, what: '' };
    if (n.damage) {
      const have = ds.damageOnHit().length;
      return { met: have >= n.damage, have, need: n.damage, what: 'hits taken (damage values)' };
    }
    const have = ds.attacks.filter((a) => a.eligible && (!n.habitat || ds.enemies.find((e) => e.id === a.enemyId)?.habitat === n.habitat)).length;
    const where = n.habitat ? ` (${this.config.habitats[n.habitat]?.name ?? n.habitat})` : '';
    return { met: have >= (n.eligible ?? 0), have, need: n.eligible ?? 0, what: `goblins with an eligible attack${where}` };
  }

  /**
   * The value a number task expects, from the dataset (null when it cannot be computed yet).
   * @param {NumberTarget} target
   * @param {Dataset} ds
   */
  expected(target, ds) {
    if (target.kind === 'proportion') {
      const ac = 10 + this.config.citizens.dex + (this.config.citizens.armor[target.armor] ?? 0);
      return evidenceFor(ds, ac, { habitat: target.habitat }).estimate;
    }
    const xs = firstDamage(ds, target.first);
    return xs.length === target.first ? mean(xs) : null;
  }

  /**
   * Answer a task: a choice index or a number. Correct answers are remembered; every answer gets its
   * feedback.
   * @param {Mission} m
   * @param {Task} t
   * @param {number} value
   * @param {Dataset} ds
   * @returns {{ ok: boolean, feedback: string }}
   */
  answer(m, t, value, ds) {
    const k = this.key(m, t);
    if (!this.needs(t, ds).met) return { ok: false, feedback: 'You need more data first.' };
    let ok = false, feedback = '';
    if (t.type === 'choice') {
      const o = t.options[value];
      if (!o) return { ok: false, feedback: 'Pick an answer.' };
      ok = o.correct;
      feedback = o.feedback;
    } else if (t.type === 'number') {
      const exp = this.expected(t.target, ds);
      if (exp === null) return { ok: false, feedback: 'You need more data first.' };
      if (!Number.isFinite(value)) return { ok: false, feedback: 'Enter a number.' };
      ok = Math.abs(value - exp) <= t.tolerance + 1e-9;
      feedback = ok ? `Right: ${round(exp, 3)}.` : `Not quite. ${t.hint}`;
    } else return { ok: false, feedback: 'The report is sent from the report page.' };
    if (ok) this.done.add(k);
    else this.tries[k] = (this.tries[k] ?? 0) + 1;
    return { ok, feedback };
  }

  /** Mark the report task done (the report page sends it). */
  reportSent() {
    for (const m of this.missions) for (const t of m.tasks) if (t.type === 'report') this.done.add(this.key(m, t));
  }

  /**
   * A mission's brief with its placeholders filled from the dataset: {firstDamage}, {interval}.
   * @param {Mission} m
   * @param {Dataset} ds
   */
  brief(m, ds) {
    return m.brief
      .replace('{firstDamage}', () => {
        const xs = firstDamage(ds, 10);
        return xs.length ? xs.join(', ') + (xs.length < 10 ? ` (${xs.length} of 10 so far)` : '') : '(none yet)';
      })
      .replace('{interval}', () => {
        const ev = evidenceFor(ds, 10 + this.config.citizens.dex + (this.config.citizens.armor.light ?? 0));
        return ev.interval && ev.n >= 30 ? `${round(ev.interval.lo, 3)} to ${round(ev.interval.hi, 3)} (n = ${ev.n})` : `(needs 30 goblins; you have ${ev.n})`;
      });
  }

  toJSON() {
    return { done: [...this.done], tries: { ...this.tries } };
  }
}

/** @param {number} x @param {number} d */
export function round(x, d) {
  const f = 10 ** d;
  return Math.round(x * f) / f;
}
