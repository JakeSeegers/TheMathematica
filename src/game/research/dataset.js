/**
 * The player's dataset (docs/design/RESEARCH_STATISTICS_RPG.md §8): what combat let the player
 * observe, in four tables — expeditions, encounters, enemies and attacks. Only observable fields
 * are accepted (each table has an allow-list; an unknown field throws), so a hidden value such as
 * an enemy's attack bonus cannot be written by mistake. Enemy rows and attack rows keep their own
 * ids: three attacks by one goblin stay one goblin.
 *
 * The eligible attack (Mission 4's protocol): for each distinct enemy, its first attack made in
 * normal roll mode (no ADV / DISADV), not a free attack, not against an unconscious target.
 *
 * Import-free and Node-safe; serializes to plain JSON for the campaign save.
 */

/** @typedef {'normal'|'adv'|'disadv'} RollMode */

/**
 * @typedef {object} ExpeditionRow
 * @property {string} id
 * @property {number} start      in-game time (hours)
 * @property {number|null} end
 * @property {string} route      a free label ('road', 'mire', …)
 */

/**
 * @typedef {object} EncounterRow
 * @property {string} id
 * @property {string} expeditionId
 * @property {string} habitat    where the fight happened
 * @property {number} start
 * @property {number|null} end
 * @property {'victory'|'flight'|'defeat'|'avoided'|null} result
 * @property {string} armor      the player's armour id during the fight
 */

/**
 * @typedef {'killed before attacking'|'fled before attacking'|'only flanked attacks'|'fight lost'|'avoided'} MissingReason
 */

/**
 * @typedef {object} EnemyRow
 * @property {string} id
 * @property {string} encounterId
 * @property {string} expeditionId
 * @property {string} family
 * @property {string} weapon     observed
 * @property {string} habitat    where it was met
 * @property {number} time
 * @property {'killed'|'fled'|'escaped'|'alive'|null} fate
 * @property {MissingReason|null} missingReason  why it has no eligible attack (null when it has one or the fight goes on)
 */

/**
 * @typedef {object} AttackRow
 * @property {string} id
 * @property {string} enemyId
 * @property {string} encounterId
 * @property {string} targetId
 * @property {number} targetAc   the AC of its actual target
 * @property {RollMode} rollMode observable (the player sees the flanking)
 * @property {number} strikeTotal  d20 + bonus as shown (the bonus itself is not recorded)
 * @property {boolean} critical
 * @property {boolean} fumble
 * @property {boolean} hit       against its actual target
 * @property {number|null} damage  HP lost from the hit's damage roll; null on a miss (never 0)
 * @property {boolean} free      a free attack (Riposte-style, outside its turn)
 * @property {boolean} vsUnconscious
 * @property {boolean} eligible  the protocol's one attack per enemy
 */

/** @typedef {'enemy'|'attack'|'encounter'|'expedition'} Unit */

const FIELDS = Object.freeze({
  expeditions: ['id', 'start', 'end', 'route'],
  encounters: ['id', 'expeditionId', 'habitat', 'start', 'end', 'result', 'armor'],
  enemies: ['id', 'encounterId', 'expeditionId', 'family', 'weapon', 'habitat', 'time', 'fate', 'missingReason'],
  attacks: ['id', 'enemyId', 'encounterId', 'targetId', 'targetAc', 'rollMode', 'strikeTotal', 'critical', 'fumble', 'hit', 'damage', 'free', 'vsUnconscious', 'eligible'],
});

/** Keys that must never reach the player's data (they describe the world, not an observation). */
export const HIDDEN_KEYS = Object.freeze(['attackBonus', 'bonus', 'mod', 'natural', 'dice', 'hp', 'hpMax', 'hd', 'population', 'shares', 'key']);

/** @param {string} table @param {Record<string, any>} row */
function checkFields(table, row) {
  const allowed = /** @type {readonly string[]} */ (FIELDS[/** @type {keyof typeof FIELDS} */ (table)]);
  for (const k of Object.keys(row)) if (!allowed.includes(k)) throw new Error(`dataset ${table}: field "${k}" is not an observation`);
}

/**
 * Does an attack penetrate armour of total AC `ac`? Derived from what was observed: not a fumble,
 * and a critical or a strike total of at least `ac` (GLAIVE's d20 rules, as `Dice.d20`).
 * @param {Pick<AttackRow, 'strikeTotal'|'critical'|'fumble'>} a
 * @param {number} ac
 */
export function penetrates(a, ac) {
  return !a.fumble && (a.critical || a.strikeTotal >= ac);
}

export class Dataset {
  constructor() {
    /** @type {ExpeditionRow[]} */
    this.expeditions = [];
    /** @type {EncounterRow[]} */
    this.encounters = [];
    /** @type {EnemyRow[]} */
    this.enemies = [];
    /** @type {AttackRow[]} */
    this.attacks = [];
    this._seq = { expeditions: 0, encounters: 0, enemies: 0, attacks: 0 };
  }

  /** @param {'expeditions'|'encounters'|'enemies'|'attacks'} table @param {string} prefix */
  _id(table, prefix) {
    this._seq[table]++;
    return `${prefix}${this._seq[table]}`;
  }

  /** @param {{ start: number, route: string }} o @returns {ExpeditionRow} */
  startExpedition(o) {
    checkFields('expeditions', o);
    const open = this.expeditions.find((e) => e.end === null);
    if (open) open.end = o.start;
    /** @type {ExpeditionRow} */
    const row = { id: this._id('expeditions', 'X'), start: o.start, end: null, route: o.route };
    this.expeditions.push(row);
    return row;
  }

  /** The expedition going on (null before the first). */
  get expedition() {
    return this.expeditions.find((e) => e.end === null) ?? null;
  }

  /** @param {{ habitat: string, start: number, armor: string }} o @returns {EncounterRow} */
  startEncounter(o) {
    checkFields('encounters', o);
    const x = this.expedition;
    if (!x) throw new Error('dataset: an encounter needs an expedition');
    /** @type {EncounterRow} */
    const row = { id: this._id('encounters', 'F'), expeditionId: x.id, habitat: o.habitat, start: o.start, end: null, result: null, armor: o.armor };
    this.encounters.push(row);
    return row;
  }

  /**
   * End an encounter: its result, and the missing reason of every enemy of it that gave no
   * eligible attack.
   * @param {string} encounterId
   * @param {{ end: number, result: NonNullable<EncounterRow['result']> }} o
   */
  endEncounter(encounterId, o) {
    const enc = this.encounters.find((e) => e.id === encounterId);
    if (!enc) throw new Error(`dataset: no encounter ${encounterId}`);
    enc.end = o.end;
    enc.result = o.result;
    for (const en of this.enemies) {
      if (en.encounterId !== encounterId || this.eligibleOf(en.id)) continue;
      if (en.missingReason) continue;
      const any = this.attacks.some((a) => a.enemyId === en.id);
      en.missingReason = o.result === 'avoided' ? 'avoided'
        : any ? 'only flanked attacks'
        : en.fate === 'fled' ? 'fled before attacking'
        : en.fate === 'killed' ? 'killed before attacking'
        : 'fight lost';
    }
  }

  /** @param {{ encounterId: string, family: string, weapon: string, habitat: string, time: number }} o @returns {EnemyRow} */
  addEnemy(o) {
    checkFields('enemies', o);
    const enc = this.encounters.find((e) => e.id === o.encounterId);
    if (!enc) throw new Error(`dataset: no encounter ${o.encounterId}`);
    /** @type {EnemyRow} */
    const row = { id: this._id('enemies', 'E'), expeditionId: enc.expeditionId, fate: null, missingReason: null, ...o };
    this.enemies.push(row);
    return row;
  }

  /** @param {string} enemyId @param {NonNullable<EnemyRow['fate']>} fate */
  setFate(enemyId, fate) {
    const en = this.enemies.find((e) => e.id === enemyId);
    if (!en) throw new Error(`dataset: no enemy ${enemyId}`);
    en.fate = fate;
  }

  /**
   * Record an attack. `damage` must be null on a miss and a positive number on a hit. The
   * eligible flag is set here by the protocol (never by the caller).
   * @param {Omit<AttackRow, 'id'|'encounterId'|'eligible'>} o
   * @returns {AttackRow}
   */
  addAttack(o) {
    checkFields('attacks', o);
    const en = this.enemies.find((e) => e.id === o.enemyId);
    if (!en) throw new Error(`dataset: no enemy ${o.enemyId}`);
    if (!['normal', 'adv', 'disadv'].includes(o.rollMode)) throw new Error(`dataset: roll mode ${o.rollMode}`);
    if (o.hit && !(Number.isFinite(o.damage) && /** @type {number} */ (o.damage) >= 0)) throw new Error('dataset: a hit needs its damage');
    if (!o.hit && o.damage !== null) throw new Error('dataset: a miss has no damage (null, not 0)');
    if (o.fumble && o.hit) throw new Error('dataset: a fumble always misses');
    const eligible = o.rollMode === 'normal' && !o.free && !o.vsUnconscious && !this.eligibleOf(o.enemyId);
    /** @type {AttackRow} */
    const row = { id: this._id('attacks', 'A'), encounterId: en.encounterId, eligible, ...o };
    this.attacks.push(row);
    return row;
  }

  /** The eligible attack of an enemy (or null). @param {string} enemyId */
  eligibleOf(enemyId) {
    return this.attacks.find((a) => a.enemyId === enemyId && a.eligible) ?? null;
  }

  /** @param {{ habitat?: string, expeditionId?: string }} [f] */
  _enemyFilter(f = {}) {
    return (/** @type {EnemyRow} */ e) => (f.habitat === undefined || e.habitat === f.habitat) && (f.expeditionId === undefined || e.expeditionId === f.expeditionId);
  }

  /**
   * Penetration outcomes for armour of total AC `ac`, by unit:
   * - 'enemy' (the protocol): one outcome per enemy with an eligible attack — independent when
   *   the enemies met are a random sample;
   * - 'attack': every normal-mode attack — `clustered` is true when one enemy gave several, and
   *   `enemies` tells how many distinct enemies they came from.
   * @param {number} ac
   * @param {{ unit?: 'enemy'|'attack', habitat?: string, expeditionId?: string }} [o]
   * @returns {{ unit: 'enemy'|'attack', outcomes: boolean[], n: number, x: number, enemies: number, clustered: boolean }}
   */
  penetration(ac, { unit = 'enemy', habitat, expeditionId } = {}) {
    const keep = new Set(this.enemies.filter(this._enemyFilter({ habitat, expeditionId })).map((e) => e.id));
    const rows = this.attacks.filter((a) => keep.has(a.enemyId) && (unit === 'enemy' ? a.eligible : a.rollMode === 'normal' && !a.vsUnconscious));
    const outcomes = rows.map((a) => penetrates(a, ac));
    const enemies = new Set(rows.map((a) => a.enemyId)).size;
    return { unit, outcomes, n: outcomes.length, x: outcomes.filter(Boolean).length, enemies, clustered: enemies < rows.length };
  }

  /**
   * Damage values of hits (null on misses is never counted as 0).
   * @param {{ unit?: 'enemy'|'attack', habitat?: string, expeditionId?: string }} [o]
   *   'enemy': the damage of each enemy's eligible attack when it hit; 'attack': every hit
   * @returns {number[]}
   */
  damageOnHit({ unit = 'attack', habitat, expeditionId } = {}) {
    const keep = new Set(this.enemies.filter(this._enemyFilter({ habitat, expeditionId })).map((e) => e.id));
    return this.attacks
      .filter((a) => keep.has(a.enemyId) && a.hit && (unit === 'attack' || a.eligible))
      .map((a) => /** @type {number} */ (a.damage));
  }

  /** How many enemies have no eligible attack, by reason. @returns {Record<string, number>} */
  missing() {
    /** @type {Record<string, number>} */
    const out = {};
    for (const e of this.enemies) if (e.missingReason) out[e.missingReason] = (out[e.missingReason] ?? 0) + 1;
    return out;
  }

  /** Counts per unit of analysis. @returns {Record<Unit, number>} */
  counts() {
    return { expedition: this.expeditions.length, encounter: this.encounters.length, enemy: this.enemies.length, attack: this.attacks.length };
  }

  /** Enemies met per habitat. @returns {Record<string, number>} */
  byHabitat() {
    /** @type {Record<string, number>} */
    const out = {};
    for (const e of this.enemies) out[e.habitat] = (out[e.habitat] ?? 0) + 1;
    return out;
  }

  toJSON() {
    return { version: 1, seq: { ...this._seq }, expeditions: this.expeditions, encounters: this.encounters, enemies: this.enemies, attacks: this.attacks };
  }

  /**
   * A dataset from its JSON (a save). Rows with fields that are not observations are refused.
   * @param {any} j
   */
  static from(j) {
    const d = new Dataset();
    if (!j || j.version !== 1) return d;
    for (const t of /** @type {const} */ (['expeditions', 'encounters', 'enemies', 'attacks'])) {
      for (const row of j[t] ?? []) checkFields(t, row);
      /** @type {any[]} */ (d[t]) = (j[t] ?? []).map((/** @type {any} */ r) => ({ ...r }));
      d._seq[t] = Number(j.seq?.[t]) || d[t].length;
    }
    return d;
  }
}
