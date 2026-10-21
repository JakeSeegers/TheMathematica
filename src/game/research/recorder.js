/**
 * The observation recorder (docs/design/RESEARCH_STATISTICS_RPG.md §8): it reads the beats of a
 * GLAIVE encounter — the same beats the stage animates and the log writes — and turns what the
 * player could see into dataset rows. There is no "study" action: fighting is observing.
 *
 * What it records of a studied foe's attack: the roll mode (flanking is visible), the strike total
 * as the log shows it (none on a natural 20 or a natural 1: the log shows the natural die then),
 * hit or miss against the actual target and that target's AC, and on a hit the damage roll's total
 * (the weapon die as rolled, before anything the target does about it; overkill and healing do not
 * change it). It never records the roll's bonus or natural die, nor the foe's HP or stat block.
 *
 * Only foes the caller names as studied (with their habitat and visible weapon) get rows; their
 * ids in the encounter (uids such as `glade_goblins#1`) are mapped to fresh enemy ids per
 * encounter, so a pack that comes back after a rest gives new enemy rows.
 *
 * Import-free apart from the dataset's types and Node-safe.
 */

/** @import { Dataset, EncounterRow } from './dataset.js' */
/** @import { Beat } from '../glaive/Encounter.js' */

/**
 * A studied foe at the start of a fight.
 * @typedef {object} StudiedFoe
 * @property {string} id       its combatant id in the encounter
 * @property {string} habitat  where it was met
 * @property {string} weapon   its visible weapon
 */

/** The encounter outcome → the dataset's result. */
const RESULT = /** @type {const} */ ({ victory: 'victory', fled: 'flight', defeat: 'defeat' });

export class Recorder {
  /**
   * @param {Dataset} dataset
   * @param {{ family: string }} o
   */
  constructor(dataset, { family }) {
    this.dataset = dataset;
    this.family = family;
    /** @type {EncounterRow|null} the encounter being recorded */
    this.encounter = null;
    /** @type {Map<string, string>} combatant id → enemy row id (this encounter) */
    this._enemy = new Map();
    /** @type {Set<string>} combatants asleep now (attacks on them land as criticals: not eligible) */
    this._asleep = new Set();
  }

  /** Is a fight being recorded? */
  get active() { return !!this.encounter; }

  /**
   * A fight starts. Records it when at least one studied foe takes part; returns its row (or null).
   * @param {StudiedFoe[]} foes
   * @param {{ time: number, armor: string }} o
   */
  begin(foes, { time, armor }) {
    if (this.encounter) this.abort(time);
    if (!foes.length) return null;
    /** @type {Map<string, number>} */
    const count = new Map();
    for (const f of foes) count.set(f.habitat, (count.get(f.habitat) ?? 0) + 1);
    const habitat = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const enc = this.dataset.startEncounter({ habitat, start: time, armor });
    this.encounter = enc;
    this._enemy.clear();
    this._asleep.clear();
    for (const f of foes) {
      const row = this.dataset.addEnemy({ encounterId: enc.id, family: this.family, weapon: f.weapon, habitat: f.habitat, time });
      this._enemy.set(f.id, row.id);
    }
    return enc;
  }

  /**
   * The beats of a turn (in order).
   * @param {Beat[]} beats
   * @param {number} time
   */
  beats(beats, time) {
    if (!this.encounter) return;
    for (const b of beats) {
      switch (b.t) {
        case 'condition':
          if (b.id === 'unconscious') { if (b.on) this._asleep.add(b.who); else this._asleep.delete(b.who); }
          break;
        case 'attack': {
          const enemyId = this._enemy.get(b.who);
          if (!enemyId) break;
          const r = b.roll;
          const vsUnconscious = this._asleep.has(b.target);
          // (an attack on a sleeper is turned into a critical by the rules: the roll record keeps
          // the die's own crit / fumble flags, which is what the player saw)
          const critical = vsUnconscious ? !!r.crit : !!b.crit;
          const fumble = !!r.fumble;
          const hit = vsUnconscious ? true : !!b.hit;
          this.dataset.addAttack({
            enemyId, targetId: b.target, targetAc: r.target, rollMode: r.mode,
            strikeTotal: critical || fumble ? null : r.total,
            critical: critical && hit, fumble: fumble && !hit,
            hit, damage: hit ? (b.damage?.total ?? 0) : null,
            free: !!b.free, vsUnconscious,
          });
          break;
        }
        case 'dead': {
          const enemyId = this._enemy.get(b.who);
          if (enemyId) this.dataset.setFate(enemyId, 'killed');
          break;
        }
        case 'flee': {
          const enemyId = this._enemy.get(b.who);
          if (enemyId) this.dataset.setFate(enemyId, 'fled');
          break;
        }
        case 'end':
          this._finish(time, RESULT[/** @type {keyof typeof RESULT} */ (b.outcome)] ?? 'defeat');
          break;
      }
    }
  }

  /** The fight was cut short without an end (a reset, a reload): recorded as lost. @param {number} time */
  abort(time) {
    if (this.encounter) this._finish(time, 'defeat');
  }

  /** @param {number} time @param {'victory'|'flight'|'defeat'} result */
  _finish(time, result) {
    const enc = /** @type {EncounterRow} */ (this.encounter);
    for (const id of this._enemy.values()) {
      const row = this.dataset.enemies.find((e) => e.id === id);
      if (row && !row.fate) this.dataset.setFate(id, 'alive');
    }
    this.dataset.endEncounter(enc.id, { end: time, result });
    this.encounter = null;
    this._enemy.clear();
    this._asleep.clear();
  }
}
