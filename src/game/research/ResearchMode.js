import { Population } from './populations.js';
import { Dataset } from './dataset.js';
import { Recorder } from './recorder.js';
import { monsterStats } from '../glaive/bestiary.js';
import { Kingdom, truthSource } from './kingdom.js';
import { MissionProgress } from './missions.js';
import { validateReport } from './report.js';
import { debrief } from './debrief.js';

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
 *   bonus).
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
 */

/**
 * What a studied foe shows (set on the Foe as `studied`).
 * @typedef {{ habitat: string, weapon: string, weaponName: string }} StudiedInfo
 */

export class ResearchMode {
  /**
   * @param {ResearchConfig} config
   * @param {ResearchHost} host
   * @param {{ dataset?: Dataset, expedition?: number, missions?: any, result?: any }} [saved]
   * @param {string} [name] the config's name (its storage key); '' keeps nothing
   */
  constructor(config, host, saved = {}, name = '') {
    this.config = config;
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
      const fresh = new URLSearchParams(search).has('fresh');
      return new ResearchMode(config, host, fresh ? {} : ResearchMode.load(name), name);
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
      return { dataset: Dataset.from(j.dataset), expedition: Number(j.expedition) || 0, missions: j.missions, result: j.result ?? null };
    } catch (err) {
      console.warn('[research] the saved study could not be read:', err);
      return {};
    }
  }

  /** Save the study's progress (browser storage; nothing without a name or storage). */
  save() {
    if (!this.name) return;
    try { globalThis.localStorage?.setItem(STORE + this.name, JSON.stringify(this.toJSON())); } catch { /* storage full or blocked: progress stays in memory */ }
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
    return { expedition: this.expedition, dataset: this.dataset.toJSON(), missions: this.missions.toJSON(), result: this.result };
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
