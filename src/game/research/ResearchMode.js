import { Population } from './populations.js';
import { Dataset } from './dataset.js';
import { Recorder } from './recorder.js';
import { monsterStats } from '../glaive/bestiary.js';

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
   * @param {{ dataset?: Dataset, expedition?: number }} [saved]
   */
  constructor(config, host, saved = {}) {
    this.config = config;
    this.population = new Population(config);
    this.host = host;
    this.dataset = saved.dataset ?? new Dataset();
    this.recorder = new Recorder(this.dataset, { family: config.family });
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
      return new ResearchMode(await r.json(), host);
    } catch (err) {
      console.warn(`[research] could not load "${name}":`, err);
      return null;
    }
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
  }

  /** A fight cut short (a reset). */
  abort() {
    this.recorder.abort(this.host.now());
  }

  /** What the save keeps. */
  toJSON() {
    return { expedition: this.expedition, dataset: this.dataset.toJSON() };
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
