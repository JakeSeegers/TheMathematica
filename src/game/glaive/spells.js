/**
 * The spells of this game (docs/specs/GLAIVE.md §6). GLAIVE's casting rules apply: a spell lives in
 * a spellbook (one spell per book), each book can be cast once per long rest (a Waystone), spells
 * have no levels and grow with the caster ([L], [HL]), and a hostile spell needs a WIL save to cast
 * — on a failed save it does half damage and no condition. The spells themselves are this game's
 * own, not the tabletop's d100 list. Import-free and Node-safe; names and texts are shown through
 * the 'glaive' strings (`spell.<id>.name` / `.text`).
 */

/**
 * One spell.
 * - `target`: 'foe' (one foe), 'ally' (one party member or the caster), 'self', 'zone' (every
 *   creature within a zone's radius of a point — foes and friends alike), 'point' (a spot).
 * - `range`: GLAIVE's Rn (0: touch, within reach).
 * - `cast`: 'wil' needs a WIL save against the target's DC; 'auto' always works.
 * - `dice`: the damage or healing: `count` × d`sides`, where `count` may be 'HL' / 'HL+1' / a
 *   number; `plusL` adds the caster's level.
 * - `condition` / `rounds`: a condition it lays (rounds: a number, 'L+1', 'HL+1' or a dice
 *   expression rolled once).
 * @typedef {object} SpellDef
 * @property {'foe'|'ally'|'self'|'zone'|'point'} target
 * @property {number} range
 * @property {'wil'|'auto'} cast
 * @property {'damage'|'heal'|'condition'|'sleep'|'morale'|'teleport'} kind
 * @property {{ count: number|'HL'|'HL+1', sides: number, plusL?: boolean }} [dice]
 * @property {import('./rules.js').ConditionId} [condition]
 * @property {number|string} [rounds]
 * @property {number} [amount]  a warded condition's AC bonus
 * @property {boolean} [harmful] hits foes (a zone spell also hits friends in it)
 */

/** @type {Readonly<Record<string, Readonly<SpellDef>>>} */
export const SPELLS = Object.freeze({
  emberDart: Object.freeze({ target: 'foe', range: 2, cast: 'wil', kind: 'damage', dice: Object.freeze({ count: 'HL+1', sides: 6 }), harmful: true }),
  cinderBurst: Object.freeze({ target: 'zone', range: 2, cast: 'wil', kind: 'damage', dice: Object.freeze({ count: 'HL', sides: 6 }), harmful: true }),
  frostGrip: Object.freeze({ target: 'foe', range: 2, cast: 'wil', kind: 'condition', condition: 'slowed', rounds: 'HL+1', harmful: true }),
  slumber: Object.freeze({ target: 'zone', range: 2, cast: 'wil', kind: 'sleep', condition: 'unconscious', rounds: '1d4', harmful: true }),
  dread: Object.freeze({ target: 'zone', range: 1, cast: 'wil', kind: 'morale', harmful: true }),
  mendingLight: Object.freeze({ target: 'ally', range: 1, cast: 'auto', kind: 'heal', dice: Object.freeze({ count: 1, sides: 8, plusL: true }) }),
  wardingGlyph: Object.freeze({ target: 'ally', range: 1, cast: 'auto', kind: 'condition', condition: 'warded', rounds: 'L+1', amount: 4 }),
  blink: Object.freeze({ target: 'point', range: 2, cast: 'auto', kind: 'teleport' }),
});

/** The spell ids in order. */
export const SPELL_IDS = Object.freeze(Object.keys(SPELLS));

/** @param {unknown} id @returns {id is string} */
export function isSpell(id) {
  return typeof id === 'string' && Object.hasOwn(SPELLS, id);
}

/**
 * The dice count of a spell at level `L`.
 * @param {number|'HL'|'HL+1'} count
 * @param {number} L
 */
export function spellDiceCount(count, L) {
  if (count === 'HL') return Math.ceil(L / 2);
  if (count === 'HL+1') return Math.ceil(L / 2) + 1;
  return count;
}

/**
 * The DC of casting a hostile spell at targets of `hd` hit dice (the toughest one for a zone):
 * GLAIVE leaves it to the GM ("charming a goblin is easy, an arch mage extreme"); the game reads
 * it from the hit dice.
 * @param {number} hd
 */
export function castDc(hd) {
  if (hd <= 1) return 10;
  if (hd <= 3) return 13;
  if (hd <= 7) return 16;
  return 19;
}
