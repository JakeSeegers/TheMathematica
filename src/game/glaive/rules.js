/**
 * The GLAIVE rules the turn-based combat plays by (docs/specs/GLAIVE.md): abilities, difficulty
 * classes, hit points, armour class, levels and experience, weapons, armour, conditions, the
 * injury table, morale and how the tabletop's zones map onto the 3D world. Pure data and small
 * formulas, no state; import-free and Node-safe (tools/test-glaive.mjs reads it).
 *
 * GLAIVE is Scott Wegener's rules toolkit (Lonely Adventurer Press). This file implements its
 * mechanics in our own words; no rule text is copied. Where a video game needs a rule the
 * tabletop leaves to the GM, the choice is written next to it and in GLAIVE.md §9.
 */

// -------------------------------------------------------------------------------------------------
// Abilities and saves (GLAIVE: Playing the Game)
// -------------------------------------------------------------------------------------------------

/**
 * The four abilities. Each has a bonus (+0 … +5) added to saves and rolls that use it.
 * @typedef {'str'|'dex'|'wis'|'wil'} Ability
 */

/** @type {readonly Ability[]} */
export const ABILITIES = Object.freeze(['str', 'dex', 'wis', 'wil']);

/** The bonuses a new character spreads over the four abilities. */
export const BONUS_SPREAD = Object.freeze([3, 2, 1, 0]);

/** No ability bonus goes above this. */
export const MAX_BONUS = 5;

/**
 * The difficulty classes: roll equal or above to succeed.
 * @type {Readonly<Record<'easy'|'normal'|'hard'|'extreme', number>>}
 */
export const DC = Object.freeze({ easy: 10, normal: 13, hard: 16, extreme: 19 });

/**
 * The ability bonuses of a sheet.
 * @typedef {Record<Ability, number>} Abilities
 */

/**
 * The highest bonus an ability may reach at level `L`: +5, and never more than the level + 2.
 * @param {number} L
 */
export const bonusCap = (L) => Math.min(MAX_BONUS, L + 2);

// -------------------------------------------------------------------------------------------------
// Levels and experience (GLAIVE: Advancement)
// -------------------------------------------------------------------------------------------------

/** The level cap of this game (the tabletop's longer-campaign variant runs to 10). */
export const LEVEL_CAP = 10;
/** A character has at most this many talents. */
export const MAX_TALENTS = 6;
/** Hit points gained per level. */
export const HP_PER_LEVEL = 5;
/** XP needed from level L to L + 1 (it resets to 0 at each new level). @param {number} L */
export const xpToNext = (L) => L * 500;
/**
 * XP per silver recovered. GLAIVE gives 1 XP per silver taken from a dungeon (not earned honestly):
 * coins picked up from foes and chests count, a shop's change does not.
 */
export const XP_PER_SILVER = 1;

/** [HL]: half the level, rounded up. @param {number} L */
export const HL = (L) => Math.ceil(L / 2);

// -------------------------------------------------------------------------------------------------
// Hit points and armour class (GLAIVE: Character Creation, Combat)
// -------------------------------------------------------------------------------------------------

/** Base hit points: 10 + STR. @param {number} str */
export const baseHp = (str) => 10 + str;
/** Base armour class: 10 + DEX (capped by the armour worn). @param {number} dex */
export const baseAc = (dex) => 10 + dex;
/** Item slots: 10 + STR. @param {number} str */
export const itemSlots = (str) => 10 + str;
/**
 * A character below −(5 + STR) hit points is dead; at 0 or below they are Out of Action.
 * @param {number} str
 */
export const deathThreshold = (str) => -(5 + str);
/** Average hit points of a monster per hit die. */
export const HP_PER_HD = 5;

// -------------------------------------------------------------------------------------------------
// Weapons and armour (GLAIVE: Arms & Armor)
// -------------------------------------------------------------------------------------------------

/**
 * A weapon. `range` 0 is melee; n > 0 is GLAIVE's Rn (n zones). `strDamage`: STR is added to the
 * damage (every melee weapon, bows and thrown weapons; not crossbows or slings). `twoHanded`
 * damage applies when nothing is in the off hand (a versatile weapon). `proneOnCrit`: a critical
 * hit knocks the target prone. `ap`: armour piercing (ignores that much AC).
 * @typedef {object} WeaponDef
 * @property {string} name
 * @property {string} damage
 * @property {string} [twoHanded]
 * @property {number} hands       1 or 2
 * @property {number} range       0: melee; n: Rn
 * @property {boolean} strDamage
 * @property {boolean} [thrown]   a melee weapon that can be thrown out to R1
 * @property {boolean} [proneOnCrit]
 * @property {number} [ap]
 * @property {number} cost        silver
 */

/** @type {Readonly<Record<string, Readonly<WeaponDef>>>} */
export const WEAPONS = Object.freeze({
  unarmed: Object.freeze({ name: 'Unarmed', damage: '1d4', hands: 1, range: 0, strDamage: true, cost: 0 }),
  dagger: Object.freeze({ name: 'Dagger', damage: '1d6', hands: 1, range: 0, strDamage: true, thrown: true, cost: 1 }),
  sword: Object.freeze({ name: 'Sword', damage: '1d8', twoHanded: '1d10', hands: 1, range: 0, strDamage: true, cost: 10 }),
  spear: Object.freeze({ name: 'Spear', damage: '1d8', twoHanded: '1d10', hands: 1, range: 0, strDamage: true, cost: 10 }),
  mace: Object.freeze({ name: 'Mace', damage: '1d8', twoHanded: '1d10', hands: 1, range: 0, strDamage: true, cost: 10 }),
  staff: Object.freeze({ name: 'Staff', damage: '1d8', twoHanded: '1d10', hands: 1, range: 0, strDamage: true, cost: 10 }),
  greataxe: Object.freeze({ name: 'Greataxe', damage: '1d12', hands: 2, range: 0, strDamage: true, proneOnCrit: true, cost: 20 }),
  sling: Object.freeze({ name: 'Sling', damage: '1d4', hands: 1, range: 1, strDamage: false, cost: 5 }),
  shortbow: Object.freeze({ name: 'Shortbow', damage: '1d6', hands: 2, range: 2, strDamage: true, cost: 10 }),
  warbow: Object.freeze({ name: 'Warbow', damage: '1d8', hands: 2, range: 3, strDamage: true, cost: 35 }),
  crossbow: Object.freeze({ name: 'Crossbow', damage: '1d8', hands: 2, range: 3, strDamage: false, cost: 35 }),
});

/**
 * Armour. `maxDex`: the most DEX bonus that still counts (null: all of it).
 * @typedef {{ name: string, ac: number, maxDex: number|null, slots: number, cost: number, stealthDisadv: boolean }} ArmorDef
 */

/** @type {Readonly<Record<string, Readonly<ArmorDef>>>} */
export const ARMOR = Object.freeze({
  none: Object.freeze({ name: 'Clothes', ac: 0, maxDex: null, slots: 0, cost: 1, stealthDisadv: false }),
  light: Object.freeze({ name: 'Light Armour', ac: 2, maxDex: null, slots: 1, cost: 25, stealthDisadv: false }),
  medium: Object.freeze({ name: 'Medium Armour', ac: 4, maxDex: 2, slots: 3, cost: 75, stealthDisadv: true }),
  heavy: Object.freeze({ name: 'Heavy Armour', ac: 6, maxDex: 0, slots: 5, cost: 200, stealthDisadv: true }),
});
/** A shield's AC (it needs a free hand). */
export const SHIELD_AC = 2;

// -------------------------------------------------------------------------------------------------
// Zones, movement and range (GLAIVE: Zones, Movement & Range) — the 3D world's version
// -------------------------------------------------------------------------------------------------

/**
 * GLAIVE splits a fight into abstract zones. In the 3D world a zone is a disc of ground: these
 * numbers (world units, 1 u = one tile) are the game's reading of it (GLAIVE.md §5).
 *
 * - `move`: a move action walks up to this far along the ground (one zone over).
 * - `reach`: a melee attack needs its target within this distance — a fighter steps in to strike.
 * - `zone`: "the same zone" — a ranged attack at a foe this close has DISADV; a burst hits this radius.
 * - `rangeStep`: Rn reaches `(n + 0.5) × rangeStep`.
 * - `join`: when a fight starts, foes within this distance of the first foe (and every foe of its
 *   group) join it; party members within `partyJoin` of the player join.
 * - `flee`: the party may flee when no foe is within this distance of any of them.
 */
export const ZONES = Object.freeze({ move: 5, reach: 1.9, zone: 3, rangeStep: 5, join: 9, partyJoin: 20, flee: 4 });

/**
 * How far an Rn attack or spell reaches (u).
 * @param {number} n
 */
export const rangeU = (n) => (n <= 0 ? ZONES.reach : (n + 0.5) * ZONES.rangeStep);

// -------------------------------------------------------------------------------------------------
// Conditions (GLAIVE: Conditions)
// -------------------------------------------------------------------------------------------------

/**
 * The conditions the game tracks. Each lasts `rounds` (null: until removed) and may end with a
 * save at the start of the bearer's turn (`endSave`: that ability against `dc`).
 * @typedef {'prone'|'stunned'|'frightened'|'poisoned'|'slowed'|'grappled'|'blinded'|'unconscious'|'defending'|'offBalance'|'raging'|'warded'|'inspired'|'exposed'|'disarmed'|'feinting'|'rushing'} ConditionId
 */

/**
 * What a condition does, as flags the rules read.
 * - `attackDisadv` / `attackAdv`: the bearer's attack rolls.
 * - `saveDisadv`: the bearer's saves.
 * - `attackedAdv` / `attackedDisadv`: attacks against the bearer.
 * - `noAct`: the bearer loses its turn. `noMove`: it cannot move.
 * - `autoHit`: attacks against it hit and deal critical damage.
 * - `acMod`: added to its AC.
 * @typedef {object} ConditionDef
 * @property {boolean} [attackDisadv]
 * @property {boolean} [attackAdv]
 * @property {boolean} [saveDisadv]
 * @property {boolean} [attackedAdv]
 * @property {boolean} [attackedDisadv]
 * @property {boolean} [rangedAttackedDisadv]
 * @property {boolean} [noAct]
 * @property {boolean} [noMove]
 * @property {boolean} [autoHit]
 * @property {number} [acMod]
 * @property {boolean} [hostile] a harmful condition (shown in red; cleansed by a rest)
 */

/** @type {Readonly<Record<ConditionId, Readonly<ConditionDef>>>} */
export const CONDITIONS = Object.freeze({
  prone: Object.freeze({ attackedAdv: true, rangedAttackedDisadv: true, hostile: true }),
  stunned: Object.freeze({ attackDisadv: true, saveDisadv: true, attackedAdv: true, hostile: true }),
  frightened: Object.freeze({ attackDisadv: true, saveDisadv: true, hostile: true }),
  poisoned: Object.freeze({ attackDisadv: true, saveDisadv: true, hostile: true }),
  slowed: Object.freeze({ acMod: -2, hostile: true }),
  grappled: Object.freeze({ noMove: true, attackDisadv: true, attackedAdv: true, hostile: true }),
  blinded: Object.freeze({ attackDisadv: true, attackedAdv: true, hostile: true }),
  unconscious: Object.freeze({ noAct: true, noMove: true, autoHit: true, hostile: true }),
  // fight defensively (a combat maneuver): attacks against it have DISADV until its next turn
  defending: Object.freeze({ attackedDisadv: true }),
  // a critical failure on an attack: foes have ADV against it until its next turn
  offBalance: Object.freeze({ attackedAdv: true, hostile: true }),
  // Rage (talent): ADV on attacks (and damage), physical damage halved
  raging: Object.freeze({ attackAdv: true }),
  // a protective spell or Radiance: +2 AC (the amount is in the condition's `amount`)
  warded: Object.freeze({}),
  // Inspire (talent): +1d4 on the next attack or save
  inspired: Object.freeze({}),
  // the boss's exposed core: attacks against it have ADV
  exposed: Object.freeze({ attackedAdv: true }),
  // disarmed (a combat maneuver): its next attacks fumble for a weapon (DISADV)
  disarmed: Object.freeze({ attackDisadv: true, hostile: true }),
  // a feint (maneuver) or a rush (talent): ADV on its next attack, used up by it
  feinting: Object.freeze({}),
  rushing: Object.freeze({}),
});

// -------------------------------------------------------------------------------------------------
// Injury, death, healing (GLAIVE: Injury, Death, Healing)
// -------------------------------------------------------------------------------------------------

/**
 * The result of the injury roll after a fight (a character who went Out of Action): the d12 plus 1
 * for every 2 HP below zero.
 * - `fine`: back up with 1d6 HP.
 * - `fatigued`: back up with 1d6 HP and a level of fatigue.
 * - `wounded`: a lasting level of fatigue until a long rest (a Waystone).
 * - `scarred`, `maimed`: as wounded, and a mark the character keeps (the game shows it in the log).
 * - `dead`: dead (the player: the fight is lost; a companion: carried back to the last Waystone).
 * @typedef {'fine'|'fatigued'|'wounded'|'scarred'|'maimed'|'dead'} InjuryResult
 */

/**
 * The injury result of a total (d12 + the bonus).
 * @param {number} total
 * @returns {InjuryResult}
 */
export function injuryResult(total) {
  if (total <= 2) return 'fine';
  if (total <= 4) return 'fatigued';
  if (total <= 7) return 'wounded';
  if (total <= 9) return 'scarred';
  if (total <= 11) return 'maimed';
  return 'dead';
}

/** The bonus to the injury roll for a character at `hp` (≤ 0): +1 per 2 HP below zero. @param {number} hp */
export const injuryBonus = (hp) => (hp < 0 ? Math.floor(-hp / 2) : 0);

/** A short rest heals this fraction of max HP (rounded up); a long rest heals everything. */
export const SHORT_REST_HEAL = 0.25;
/** At this many fatigue levels a character collapses. Each level is −1 to every roll. */
export const FATIGUE_COLLAPSE = 4;

// -------------------------------------------------------------------------------------------------
// Morale and reactions (GLAIVE: Morale, Reactions)
// -------------------------------------------------------------------------------------------------

/**
 * A morale check: 2d6 above the morale rating and the creature tries to flee. A rating of 12 never
 * breaks.
 * @param {number} roll 2d6
 * @param {number} rating
 */
export const breaksMorale = (roll, rating) => rating < 12 && roll > rating;

// -------------------------------------------------------------------------------------------------
// Silver (GLAIVE: Starting Gear) — the game's gold is GLAIVE's silver
// -------------------------------------------------------------------------------------------------

/** A Healing Draught: heals this many dice + the drinker's level. */
export const DRAUGHT_HEAL = '2d4';
export const DRAUGHT_PRICE = 25;
export const POTION_MAX = 5;
export const POTION_START = 2;
/** Silver lost when the party falls (a share of the purse). */
export const SILVER_LOSS = 0.1;

/**
 * The combat shop's wares (the shopkeeper on a combat level), in menu order. `once`: bought at
 * most once; `upgrade` / `amount`: what it changes on the player's sheet (Sheet.applyUpgrade).
 */
export const SHOP_WARES = Object.freeze([
  Object.freeze({ id: 'draught', name: 'Healing Draught', price: DRAUGHT_PRICE, once: false, upgrade: null, amount: 0, gain: 'heals 2d4 + level' }),
  Object.freeze({ id: 'whetstone', name: 'Whetstone', price: 120, once: true, upgrade: 'attack', amount: 1, gain: '+1 to hit and damage' }),
  Object.freeze({ id: 'tonic', name: 'Ironbark Tonic', price: 90, once: true, upgrade: 'maxHp', amount: 4, gain: '+4 max HP' }),
  Object.freeze({ id: 'charm', name: 'Warding Charm', price: 150, once: true, upgrade: 'def', amount: 1, gain: '+1 AC' }),
]);

/**
 * The shop ware called `name` (null: not for sale).
 * @param {string} name
 */
export const shopWare = (name) => SHOP_WARES.find((w) => w.name === name) ?? null;

/**
 * What a chest's upgrade (the level format's `CHEST_UPGRADES`) does on a sheet: the amounts.
 * maxHp: +HP; maxMp: one more spellbook use per rest; attack: +1 to hit and damage.
 */
export const UPGRADES = Object.freeze({ maxHp: 3, maxMp: 1, attack: 1, def: 1, core: 5 });
