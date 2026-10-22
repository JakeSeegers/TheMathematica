import { Population } from './populations.js';
import { Dataset } from './dataset.js';
import { Recorder } from './recorder.js';
import { monsterStats } from '../glaive/bestiary.js';
import { Kingdom, truthSource } from './kingdom.js';
import { MissionProgress } from './missions.js';
import { validateReport } from './report.js';
import { debrief } from './debrief.js';
import { RNG } from '../../engine/utils/math.js';

/**
 * ResearchMode — the research overlay of a combat level (docs/design/RESEARCH_STATISTICS_RPG.md
 * §12, step 2). Owned by GlaiveCombat when the page asks for it (`?research=<config>`, a file in
 * `public/research/`). It
 * - gives each foe of a studied group its own stat block, drawn from the population (world truth)
 *   for the current expedition — a waystone rest ends the expedition and the packs come back as new
 *   individuals;
 * - records every fight with studied foes into the player's dataset (the recorder reads the
 *   encounter's beats: no study action);
 * - tells the UI to hide what the player cannot observe (a studied foe's HP numbers and its roll
 *   bonus);
 * - is one **run** (roguelike style): a run seed (`&seed=<n>`; a new seed starts a new run, none
 *   continues the saved one or starts a random one) replaces the config's world seed, so it decides
 *   every individual; every other foe (not studied, not a boss) varies too, by the config's
 *   `variation` (attack bonus and HP offsets, seeded the same way); the run's save holds the study
 *   and the hero, written at rests, fight ends and answers; with `&permadeath=1` a fallen hero ends
 *   the run.
 *
 * The population stays inside this object; player-facing code reads `dataset` only.
 */

/** @import { ResearchConfig } from './populations.js' */
/** @import { MonsterStats } from '../glaive/bestiary.js' */
/** @import { Beat } from '../glaive/Encounter.js' */
/** @import { Report } from './report.js' */
/** @import { SeasonResult } from './kingdom.js' */

/** Browser storage key prefix of a study's progress (per config name). */
const STORE = 'luminati.research.';

/**
 * What GlaiveCombat gives the overlay (kept small so it can be faked in tests).
 * @typedef {object} ResearchHost
 * @property {() => number} now          in-game time (hours)
 * @property {() => string} armor        the player's armour id
 * @property {() => any} [hero]          the hero to save (GlaiveCombat: its progress and checkpoint)
 */

/**
 * A run: its seed, its rules and its state.
 * @typedef {{ seed: number, permadeath: boolean, ended: string|null }} Run
 */

/** A new run seed (1 … 999 999 999). */
export function newRunSeed() {
  try {
    const a = new Uint32Array(1);
    globalThis.crypto.getRandomValues(a);
    return (a[0] % 999999999) + 1;
  } catch {
    return (Date.now() % 999999999) + 1;
  }
}

/** Pick from [value, probability] pairs with one uniform draw. @param {[number, number][]} pairs @param {number} u */
function pick(pairs, u) {
  let acc = 0;
  for (const [v, p] of pairs) { acc += p; if (u < acc) return v; }
  return pairs[pairs.length - 1][0];
}

/**
 * What a studied foe shows (set on the Foe as `studied`).
 * @typedef {{ habitat: string, weapon: string, weaponName: string }} StudiedInfo
 */

export class ResearchMode {
  /**
   * @param {ResearchConfig} config
   * @param {ResearchHost} host
   * @param {{ dataset?: Dataset, expedition?: number, missions?: any, result?: any, run?: Run, hero?: any }} [saved]
   * @param {string} [name] the config's name (its storage key); '' keeps nothing
   */
  constructor(config, host, saved = {}, name = '') {
    /** @type {Run} the run (its seed is the world seed: it decides every individual) */
    this.run = saved.run ?? { seed: config.worldSeed, permadeath: false, ended: null };
    this.config = { ...config, worldSeed: this.run.seed };
    config = this.config;
    /** The saved hero to restore (GlaiveCombat reads it once at load), or null. */
    this.savedHero = saved.hero ?? null;
    this.name = name;
    this.population = new Population(config);
    this.kingdom = /** @type {any} */ (config).kingdom ? new Kingdom(/** @type {any} */ (config)) : null;
    this.host = host;
    this.dataset = saved.dataset ?? new Dataset();
    this.recorder = new Recorder(this.dataset, { family: config.family });
    this.missions = new MissionProgress(/** @type {any} */ (config), saved.missions);
    /**
     * The sent report, its season and its debrief (null before the report).
     * @type {{ report: Report, season: SeasonResult, debrief: ReturnType<typeof debrief> }|null}
     */
    this.result = saved.result ?? null;
    /** The expedition number (1 = the first; a rest starts the next). */
    this.expedition = saved.expedition ?? 0;
    if (!this.dataset.expedition) this.startExpedition();
  }

  /**
   * The overlay a page asks for: `?research=<name>` loads `public/research/<name>.json`; null when
   * the page does not ask, or the file cannot be loaded.
   * @param {ResearchHost} host
   * @param {string} [search] the page's query string (default: the location's)
   * @returns {Promise<ResearchMode|null>}
   */
  static async fromPage(host, search = globalThis.location?.search ?? '') {
    const name = new URLSearchParams(search).get('research');
    if (!name || !/^[a-z0-9-]+$/.test(name)) return null;
    const base = import.meta.env?.BASE_URL ?? '/';
    try {
      const r = await fetch(`${base}research/${name}.json`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const config = await r.json();
      const q = new URLSearchParams(search);
      const saved = q.has('fresh') ? {} : ResearchMode.load(name);
      const asked = Number.parseInt(q.get('seed') ?? '', 10);
      const seed = Number.isInteger(asked) && asked > 0 ? asked : null;
      // the saved run goes on unless the address asks for another seed (or a fresh start)
      const keep = saved.run && (seed === null || seed === saved.run.seed);
      const state = keep ? saved : { run: { seed: seed ?? newRunSeed(), permadeath: q.get('permadeath') === '1', ended: null } };
      return new ResearchMode(config, host, state, name);
    } catch (err) {
      console.warn(`[research] could not load "${name}":`, err);
      return null;
    }
  }

  /**
   * A study's saved progress from browser storage ({} when there is none or it cannot be read).
   * @param {string} name
   */
  static load(name) {
    try {
      const raw = globalThis.localStorage?.getItem(STORE + name);
      if (!raw) return {};
      const j = JSON.parse(raw);
      const run = j.run && Number.isInteger(j.run.seed) ? { seed: j.run.seed, permadeath: !!j.run.permadeath, ended: j.run.ended ?? null } : undefined;
      return { dataset: Dataset.from(j.dataset), expedition: Number(j.expedition) || 0, missions: j.missions, result: j.result ?? null, run, hero: j.hero ?? null };
    } catch (err) {
      console.warn('[research] the saved study could not be read:', err);
      return {};
    }
  }

  /** Save the study's progress (browser storage; nothing without a name or storage). */
  save() {
    if (!this.name || !globalThis.localStorage) return false;
    try {
      globalThis.localStorage.setItem(STORE + this.name, JSON.stringify(this.toJSON()));
      /** When the run was last saved (ms since 1970), or 0. */
      this.savedAt = Date.now();
      return true;
    } catch {
      // storage full or blocked: progress stays in memory
      return false;
    }
  }

  /** How many foes a studied pack has (the config's `groupCounts`, else the level's). @param {string} groupId @param {number} count */
  groupCount(groupId, count) {
    const n = /** @type {any} */ (this.config).groupCounts?.[groupId];
    return this.studies(groupId) && Number.isInteger(n) && n > 0 ? n : count;
  }

  /**
   * Send the report: the kingdom acts on its policy, a season of raids follows (seeded by the
   * world, the expedition and the report), and the debrief is made. Returns the problems instead
   * when the report is not complete.
   * @param {Report} report
   * @returns {{ ok: true, result: NonNullable<ResearchMode['result']> } | { ok: false, problems: string[] }}
   */
  submit(report) {
    if (!this.kingdom) return { ok: false, problems: ['this study has no kingdom'] };
    const problems = validateReport(report, this.kingdom, { requireInterval: this.missions.unlocked('interval') });
    if (problems.length) return { ok: false, problems };
    const seed = `${this.config.worldSeed}|report|${this.expedition}|${this.dataset.attacks.length}`;
    const season = this.kingdom.season(report.policy, truthSource(this.population), seed);
    const d = debrief({ report, dataset: this.dataset, population: this.population, kingdom: this.kingdom, season, seed });
    this.result = { report, season, debrief: d };
    this.missions.reportSent();
    this.save();
    return { ok: true, result: this.result };
  }

  /** The family studied (an enemy kind). */
  get family() { return this.config.family; }

  /** Is this level group part of the study? @param {string} groupId */
  studies(groupId) {
    return this.population.habitatOf(groupId) !== null;
  }

  /** A new expedition: its row in the dataset and a new draw of every studied foe. */
  startExpedition() {
    this.expedition++;
    this.dataset.startExpedition({ start: this.host.now(), route: 'open' });
    this.save();
  }

  /**
   * The stat block of a studied foe for the current expedition, or null for a foe outside the
   * study. A GLAIVE stat block: the family's own (moves, XP, treasure, saves) with the individual's
   * attack bonus and weapon, and the shared AC, HD and morale.
   * @param {string} groupId
   * @param {number} index
   * @returns {{ stats: MonsterStats, info: StudiedInfo }|null}
   */
  individualFor(groupId, index) {
    const habitat = this.population.habitatOf(groupId);
    if (!habitat) return null;
    const ind = this.population.individual(habitat, [`e${this.expedition}`, groupId, index]);
    const base = monsterStats(this.config.family, 1, false);
    const weapon = this.config.weapons[ind.weapon];
    /** @type {MonsterStats} */
    const stats = {
      ...base,
      ac: ind.ac, hd: ind.hd, hpMax: ind.hp, morale: ind.morale,
      atk: ind.attackBonus,
      attacks: [{ name: weapon.name, damage: weapon.damage, range: 0 }],
    };
    return { stats, info: { habitat, weapon: ind.weapon, weaponName: weapon.name } };
  }

  /**
   * The run's variation of a foe outside the study (not a boss, not passive): its attack bonus and
   * HP shifted by draws from the config's `variation` (per family, else `default`), seeded by the
   * run, the expedition, the group and the slot. Null when it does not vary.
   * @param {string} kind
   * @param {string} groupId
   * @param {number} index
   * @param {MonsterStats} base
   * @returns {MonsterStats|null}
   */
  variantFor(kind, groupId, index, base) {
    if (base.boss || base.moves.includes('passive') || this.studies(groupId)) return null;
    const v = /** @type {any} */ (this.config).variation;
    const spec = v?.families?.[kind] ?? v?.default;
    if (!spec) return null;
    const rng = new RNG(`${this.run.seed}|variant|e${this.expedition}|${groupId}|${index}`);
    const atk = spec.attackBonus ? pick(spec.attackBonus, rng.next()) : 0;
    const hp = spec.hp ? pick(spec.hp, rng.next()) : 0;
    return { ...base, atk: base.atk + atk, hpMax: Math.max(1, base.hpMax + hp) };
  }

  /**
   * The hero fell. With permadeath the run ends (the ledger offers a new one); without, nothing.
   * @returns {boolean} whether the run ended
   */
  heroFell() {
    if (!this.run.permadeath || this.run.ended) return false;
    this.run.ended = 'slain';
    this.save();
    return true;
  }

  /**
   * A fight starts with these foes (studied or not): the recorder opens an encounter when any of
   * them is studied.
   * @param {{ id: string, studied: StudiedInfo|null }[]} foes
   */
  fightStart(foes) {
    const studied = foes.filter((f) => f.studied).map((f) => ({ id: f.id, habitat: /** @type {StudiedInfo} */ (f.studied).habitat, weapon: /** @type {StudiedInfo} */ (f.studied).weapon }));
    this.recorder.begin(studied, { time: this.host.now(), armor: this.host.armor() });
  }

  /** The beats of a turn. @param {Beat[]} beats */
  beats(beats) {
    this.recorder.beats(beats, this.host.now());
    if (beats.some((b) => b.t === 'end')) this.save();
  }

  /** A fight cut short (a reset). */
  abort() {
    this.recorder.abort(this.host.now());
  }

  /** What the save keeps. */
  toJSON() {
    const hero = this.run.ended ? null : (this.host.hero?.() ?? this.savedHero);
    return { run: this.run, expedition: this.expedition, dataset: this.dataset.toJSON(), missions: this.missions.toJSON(), result: this.result, hero };
  }

  /**
   * Designer views only (never the ledger or the journal): the truth this investigation is about.
   */
  truth() {
    const p = this.population;
    const armor = this.config.citizens.armor;
    /** @type {Record<string, Record<string, number>>} */
    const penetration = {};
    for (const id of Object.keys(armor)) {
      const ac = p.citizenAc(id);
      penetration[id] = { region: p.truePenetration(ac), ...Object.fromEntries(p.habitatIds.map((h) => [h, p.truePenetration(ac, h)])) };
    }
    return { shares: p.shares(), penetration };
  }
}
