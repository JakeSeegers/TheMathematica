import {
  ABILITIES, BONUS_SPREAD, LEVEL_CAP, MAX_TALENTS, HP_PER_LEVEL, xpToNext, baseHp, baseAc, bonusCap, WEAPONS, ARMOR,
  SHIELD_AC, POTION_START, POTION_MAX, deathThreshold, FATIGUE_COLLAPSE, UPGRADES,
} from './rules.js';
import { TALENTS, ANCESTRIES, isTalent, talentUses } from './talents.js';
import { isSpell } from './spells.js';

/**
 * A GLAIVE character sheet (docs/specs/GLAIVE.md §3): the player's, and one per party member. It
 * holds what lasts between fights — abilities, level, XP, hit points, gear, talents, spellbooks,
 * draughts, silver, fatigue and the uses spent since the last rest — and the formulas that read
 * them (AC, max HP, attack and save bonuses). A fight (`Encounter`) wraps it in a combatant and
 * writes back HP and spent uses. Import-free apart from the rules and Node-safe.
 *
 * Serialised with `toJSON` / `Sheet.from` (a campaign carries the player's sheet from one combat
 * level to the next, CampaignState `combat.sheet`).
 */

/**
 * The starting builds the player picks from on the first combat level (and the companions' classes
 * map onto). `abilities` spread GLAIVE's +3 / +2 / +1 / +0; `talents` are its two starting talents
 * (a human's); `spells` its spellbooks.
 * @type {Readonly<Record<string, Readonly<{ abilities: Readonly<Record<string, number>>, weapon: string, armor: string, shield: boolean, talents: readonly string[], spells: readonly string[], sprite: string }>>>}
 */
export const BUILDS = Object.freeze({
  sellsword: Object.freeze({ abilities: Object.freeze({ str: 3, dex: 1, wis: 0, wil: 2 }), weapon: 'sword', armor: 'medium', shield: true, talents: Object.freeze(['hackSlash', 'veteran']), spells: Object.freeze([]), sprite: 'sword' }),
  cutpurse: Object.freeze({ abilities: Object.freeze({ str: 1, dex: 3, wis: 2, wil: 0 }), weapon: 'dagger', armor: 'light', shield: false, talents: Object.freeze(['backstab', 'evasion']), spells: Object.freeze([]), sprite: 'sword' }),
  hunter: Object.freeze({ abilities: Object.freeze({ str: 1, dex: 2, wis: 3, wil: 0 }), weapon: 'shortbow', armor: 'light', shield: false, talents: Object.freeze(['deadeye', 'quickShot']), spells: Object.freeze([]), sprite: 'bow' }),
  hedgeWizard: Object.freeze({ abilities: Object.freeze({ str: 0, dex: 2, wis: 1, wil: 3 }), weapon: 'staff', armor: 'none', shield: false, talents: Object.freeze(['scholar', 'magicWard']), spells: Object.freeze(['emberDart', 'slumber', 'wardingGlyph']), sprite: 'staff' }),
  holyWarrior: Object.freeze({ abilities: Object.freeze({ str: 2, dex: 1, wis: 0, wil: 3 }), weapon: 'mace', armor: 'medium', shield: true, talents: Object.freeze(['smite', 'radiance']), spells: Object.freeze(['mendingLight']), sprite: 'sword' }),
});

/** The build ids in the picker's order. */
export const BUILD_IDS = Object.freeze(Object.keys(BUILDS));

/**
 * The party classes (PartyRules `PARTY_CLASSES`) as GLAIVE builds, with the order a companion
 * raises its abilities and takes talents in as it levels with the player.
 * @type {Readonly<Record<string, Readonly<{ build: string, ancestry: string, talents: readonly string[], raise: readonly string[], extraSpells?: readonly string[] }>>>}
 */
export const CLASS_BUILDS = Object.freeze({
  warden: Object.freeze({ build: 'sellsword', ancestry: 'human', talents: Object.freeze(['shieldMaster', 'riposte', 'girdedLoins', 'professionalKiller']), raise: Object.freeze(['str', 'dex', 'wil', 'wis']) }),
  ranger: Object.freeze({ build: 'hunter', ancestry: 'human', talents: Object.freeze(['inhumanAccuracy', 'monsterSlayer', 'skulker', 'evasion']), raise: Object.freeze(['wis', 'dex', 'str', 'wil']) }),
  mystic: Object.freeze({ build: 'holyWarrior', ancestry: 'human', talents: Object.freeze(['inspire', 'heavensTouch', 'signsPortents', 'magicWard']), raise: Object.freeze(['wil', 'str', 'dex', 'wis']), extraSpells: Object.freeze(['mendingLight', 'emberDart']) }),
});

/**
 * A sheet as JSON.
 * @typedef {object} SheetData
 * @property {string} name
 * @property {string} build
 * @property {string} ancestry
 * @property {Record<string, number>} abilities
 * @property {number} level
 * @property {number} xp
 * @property {number} hp
 * @property {string} weapon
 * @property {string} armor
 * @property {boolean} shield
 * @property {string[]} talents
 * @property {string[]} spells
 * @property {number} potions
 * @property {number} silver
 * @property {number} fatigue
 * @property {number} wounds        lasting fatigue levels until a long rest (the injury table)
 * @property {Record<string, number>} spent  talent / spell uses spent since the last rest
 * @property {Record<string, number>} upgrades  chests and wares (maxHp, maxMp, attack, def)
 * @property {string[]} marks       scars and other marks the injury table left
 */

export class Sheet {
  /**
   * @param {Partial<SheetData>} [d]
   */
  constructor(d = {}) {
    const b = BUILDS[d.build] ?? BUILDS.sellsword;
    this.name = typeof d.name === 'string' ? d.name : '';
    this.build = BUILDS[d.build] ? d.build : 'sellsword';
    this.ancestry = ANCESTRIES[d.ancestry] ? d.ancestry : 'human';
    /** @type {Record<import('./rules.js').Ability, number>} */
    this.abilities = { str: 0, dex: 0, wis: 0, wil: 0 };
    for (const k of ABILITIES) this.abilities[k] = clampInt(d.abilities?.[k] ?? b.abilities[k], -3, 5);
    this.level = clampInt(d.level ?? 1, 1, LEVEL_CAP);
    this.xp = Math.max(0, Math.floor(d.xp ?? 0));
    this.weapon = WEAPONS[d.weapon] ? d.weapon : b.weapon;
    this.armor = ARMOR[d.armor] ? d.armor : b.armor;
    this.shield = d.shield ?? b.shield;
    /** @type {string[]} */
    this.talents = (d.talents ?? [...b.talents]).filter(isTalent).slice(0, MAX_TALENTS);
    /** @type {string[]} */
    this.spells = (d.spells ?? [...b.spells]).filter(isSpell);
    this.potions = clampInt(d.potions ?? POTION_START, 0, POTION_MAX);
    this.silver = Math.max(0, Math.floor(d.silver ?? 0));
    this.fatigue = clampInt(d.fatigue ?? 0, 0, FATIGUE_COLLAPSE);
    this.wounds = clampInt(d.wounds ?? 0, 0, FATIGUE_COLLAPSE);
    /** @type {Record<string, number>} */
    this.spent = { ...(d.spent ?? {}) };
    /** @type {Record<string, number>} */
    this.upgrades = { maxHp: 0, maxMp: 0, attack: 0, def: 0, ...(d.upgrades ?? {}) };
    /** @type {string[]} */
    this.marks = Array.isArray(d.marks) ? d.marks.filter((m) => typeof m === 'string') : [];
    this.hp = Number.isFinite(d.hp) ? Math.min(this.hpMax, Math.floor(d.hp)) : this.hpMax;
  }

  /**
   * A new character of a build and ancestry. A human keeps the build's two talents; another
   * ancestry swaps the second for its own (GLAIVE: an ancestry talent and one more).
   * @param {string} build
   * @param {string} [ancestry]
   * @param {string} [name]
   */
  static create(build, ancestry = 'human', name = '') {
    const b = BUILDS[build] ?? BUILDS.sellsword;
    const anc = ANCESTRIES[ancestry] ? ancestry : 'human';
    const own = ANCESTRIES[anc].talent;
    const talents = own ? [b.talents[0], own] : [...b.talents];
    return new Sheet({ name, build, ancestry: anc, talents });
  }

  /**
   * A party member's sheet at the player's level: its class's build, then a talent and an ability
   * raise per level in its class's order.
   * @param {string} cls PartyRules class
   * @param {number} level
   * @param {string} [name]
   */
  static forClass(cls, level, name = '') {
    const c = CLASS_BUILDS[cls] ?? CLASS_BUILDS.warden;
    const s = Sheet.create(c.build, c.ancestry, name);
    if (c.extraSpells) s.spells = [...new Set([...s.spells, ...c.extraSpells])];
    s.potions = 0;
    for (let L = 2; L <= Math.min(LEVEL_CAP, level); L++) {
      s.level = L;
      const t = c.talents.find((id) => !s.talents.includes(id));
      if (t && s.talents.length < MAX_TALENTS) s.talents.push(t);
      const a = c.raise.find((k) => s.abilities[k] < bonusCap(L)) ?? null;
      if (a) s.abilities[/** @type {import('./rules.js').Ability} */ (a)]++;
    }
    s.hp = s.hpMax;
    return s;
  }

  /** @param {unknown} data @returns {Sheet} */
  static from(data) {
    return new Sheet(data && typeof data === 'object' ? /** @type {Partial<SheetData>} */ (data) : {});
  }

  /** @returns {SheetData} */
  toJSON() {
    return {
      name: this.name, build: this.build, ancestry: this.ancestry, abilities: { ...this.abilities }, level: this.level, xp: this.xp,
      hp: this.hp, weapon: this.weapon, armor: this.armor, shield: this.shield, talents: [...this.talents], spells: [...this.spells],
      potions: this.potions, silver: this.silver, fatigue: this.fatigue, wounds: this.wounds, spent: { ...this.spent },
      upgrades: { ...this.upgrades }, marks: [...this.marks],
    };
  }

  /** @param {string} id */
  has(id) { return this.talents.includes(id); }

  /** The weapon's data. */
  get weaponDef() { return WEAPONS[this.weapon] ?? WEAPONS.unarmed; }
  /** The armour's data. */
  get armorDef() { return ARMOR[this.armor] ?? ARMOR.none; }

  /** Extra HP per level from talents. */
  get hpPerLevelBonus() {
    let n = 0;
    for (const id of this.talents) n += TALENTS[id]?.hpPerLevel ?? 0;
    return n;
  }

  /** Max HP: 10 + STR, +5 per level after the first, talents' HP per level, upgrades. */
  get hpMax() {
    return baseHp(this.abilities.str) + HP_PER_LEVEL * (this.level - 1) + this.hpPerLevelBonus * this.level + (this.upgrades.maxHp ?? 0);
  }

  /** Below this HP the character is dead (GLAIVE: −(5 + STR)). */
  get deathAt() { return deathThreshold(this.abilities.str); }

  /** Armour class: 10 + DEX (capped by armour), armour, shield, Favor of the Gods, upgrades. */
  get ac() {
    const a = this.armorDef;
    const dex = a.maxDex === null ? this.abilities.dex : Math.min(this.abilities.dex, a.maxDex);
    let ac = baseAc(dex) + a.ac + (this.shield ? SHIELD_AC : 0) + (this.upgrades.def ?? 0);
    if (this.has('favorOfGods') && this.armor === 'none') ac += Math.max(0, this.abilities.str);
    return ac;
  }

  /** −1 per level of fatigue (and lasting wounds) on every roll. */
  get fatiguePenalty() { return -(this.fatigue + this.wounds); }

  /** Is the weapon a ranged one? */
  get ranged() { return this.weaponDef.range > 0; }

  /**
   * The attack bonus: STR for melee, WIS for ranged (GLAIVE), the whetstone, fatigue.
   * @param {boolean} [ranged]
   */
  attackBonus(ranged = this.ranged) {
    return (ranged ? this.abilities.wis : this.abilities.str) + (this.upgrades.attack ?? 0) + this.fatiguePenalty;
  }

  /** The damage expression of the weapon now (two-handed when it can be and the off hand is free). */
  get damageDice() {
    const w = this.weaponDef;
    return w.twoHanded && !this.shield ? w.twoHanded : w.damage;
  }

  /** Flat damage added: STR when the weapon takes it, the whetstone. */
  get damageBonus() {
    return (this.weaponDef.strDamage ? this.abilities.str : 0) + (this.upgrades.attack ?? 0);
  }

  /** @param {import('./rules.js').Ability} ability */
  saveBonus(ability) {
    return this.abilities[ability] + this.fatiguePenalty;
  }

  /** XP to the next level. */
  get xpNext() { return xpToNext(this.level); }

  /** Uses left of a limited talent this rest (Infinity: unlimited). @param {string} id */
  usesLeft(id) {
    const n = talentUses(id, this.level);
    if (n <= 0) return Infinity;
    return Math.max(0, n - (this.spent[id] ?? 0));
  }

  /** Spend one use of a talent or spellbook. @param {string} id */
  spend(id) { this.spent[id] = (this.spent[id] ?? 0) + 1; }

  /**
   * Can a spellbook be cast now? Each book once per long rest; the `maxMp` upgrade (a chest's
   * "Mana Crystal") is a spare use for any book.
   * @param {string} id
   */
  canCast(id) {
    if (!this.spells.includes(id)) return false;
    const used = this.spent[`spell:${id}`] ?? 0;
    return used < 1 || (this.spent.spare ?? 0) < (this.upgrades.maxMp ?? 0);
  }

  /** Mark a spellbook cast. @param {string} id */
  castSpell(id) {
    const k = `spell:${id}`;
    if ((this.spent[k] ?? 0) >= 1) this.spent.spare = (this.spent.spare ?? 0) + 1;
    this.spent[k] = (this.spent[k] ?? 0) + 1;
  }

  /** Spell uses left this rest (books not cast + spare uses). */
  get castsLeft() {
    let n = 0;
    for (const id of this.spells) if ((this.spent[`spell:${id}`] ?? 0) < 1) n++;
    return n + Math.max(0, (this.upgrades.maxMp ?? 0) - (this.spent.spare ?? 0));
  }

  /** The most casts a rest gives. */
  get castsMax() { return this.spells.length + (this.upgrades.maxMp ?? 0); }

  /**
   * Forget the uses that come back after every fight (GLAIVE's short rest: the party catches its
   * breath between fights — the game's reading).
   */
  afterFight() {
    for (const id of Object.keys(this.spent)) if (TALENTS[id]?.per === 'fight') delete this.spent[id];
    this.fatigue = Math.max(0, this.fatigue - 1);
  }

  /** A long rest (a Waystone, the story's `heal`): full HP, every use back, fatigue and wounds gone. */
  longRest() {
    this.spent = {};
    this.fatigue = 0;
    this.wounds = 0;
    this.hp = this.hpMax;
  }

  /**
   * Add XP. Returns how many levels it is now owed (the game asks the player to choose a talent and
   * an ability for each, `levelUp`).
   * @param {number} n
   */
  gainXp(n) {
    if (this.level >= LEVEL_CAP) return 0;
    this.xp += Math.max(0, Math.round(n));
    return this.pendingLevels;
  }

  /** Levels earned but not taken yet. */
  get pendingLevels() {
    let xp = this.xp, L = this.level, n = 0;
    while (L < LEVEL_CAP && xp >= xpToNext(L)) { xp -= xpToNext(L); L++; n++; }
    return n;
  }

  /**
   * Take one level (GLAIVE: +5 HP, a new talent, +1 to one ability): `talent` (null when the
   * sheet is full) and `ability` (null when every ability is at its cap). Returns false when no
   * level is owed.
   * @param {string|null} talent
   * @param {import('./rules.js').Ability|null} ability
   */
  levelUp(talent, ability) {
    if (this.pendingLevels <= 0) return false;
    const before = this.hpMax;
    this.xp -= xpToNext(this.level);
    this.level++;
    if (talent && isTalent(talent) && !this.has(talent) && this.talents.length < MAX_TALENTS) this.talents.push(talent);
    if (ability && this.abilities[ability] < bonusCap(this.level)) this.abilities[ability]++;
    this.hp = Math.min(this.hpMax, this.hp + (this.hpMax - before));
    return true;
  }

  /** The abilities that may still rise at the next level. @returns {import('./rules.js').Ability[]} */
  raisable() {
    const cap = bonusCap(this.level + 1);
    return ABILITIES.filter((k) => this.abilities[k] < cap);
  }

  /**
   * A chest's or a ware's upgrade.
   * @param {'maxHp'|'maxMp'|'attack'|'def'|'core'} what
   * @param {number} [amount]
   */
  applyUpgrade(what, amount) {
    const n = amount ?? UPGRADES[what] ?? 1;
    if (what === 'core') {
      this.upgrades.maxHp = (this.upgrades.maxHp ?? 0) + n;
      this.hp += n;
      return;
    }
    this.upgrades[what] = (this.upgrades[what] ?? 0) + n;
    if (what === 'maxHp') this.hp += n;
  }

  /** Heal (never above max). @param {number} n */
  heal(n) {
    this.hp = Math.min(this.hpMax, Math.max(this.hp, 0) + Math.max(0, n));
  }
}

/** The spread a custom character must use. */
export { BONUS_SPREAD };

/** @param {number} v @param {number} lo @param {number} hi */
function clampInt(v, lo, hi) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo;
}
