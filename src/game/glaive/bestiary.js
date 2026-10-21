import { HP_PER_HD } from './rules.js';

/**
 * The foes as GLAIVE monsters (docs/specs/GLAIVE.md §7), in the tabletop's stat-block shape: armour
 * class, hit dice (hit points = 5 per HD), attacks (bonus + damage, a condition), morale, XP,
 * treasure, saves (GLAIVE: good at one kind of save (+4), bad at another (−2), +0 at the rest) and
 * the special moves its turn may use. The level format's `enemy` kinds (ObjectCatalog
 * `ENEMY_KINDS`) are the keys. Their size, sight range and look stay in ../combat/defs.js (the
 * level generators and the editor read those).
 *
 * A group's `level` (1–10) and `elite` flag still tune its foes (`monsterStats`): every 3 levels
 * above 1 add a hit die (and so +1 to hit), every 4 add +1 AC; an elite has 7 HP per HD, +1 to hit,
 * +2 morale and twice the XP and silver.
 *
 * Import-free apart from rules.js and Node-safe.
 */

/**
 * One attack of a stat block. `range` 0: melee; n: GLAIVE's Rn. `condition`: laid on a hit unless
 * the target makes the save (`save` ability against `dc`); `rounds` how long.
 * @typedef {object} MonsterAttack
 * @property {string} name
 * @property {string} damage
 * @property {number} range
 * @property {import('./rules.js').ConditionId} [condition]
 * @property {import('./rules.js').Ability} [save]
 * @property {number} [dc]
 * @property {number} [rounds]
 */

/**
 * A monster's special moves (its AI picks them):
 * - 'sticky': its hits slow (the slime);
 * - 'skirmish': keeps its distance and shoots (the archer);
 * - 'hex' / 'mend': a caster's spells (the shaman);
 * - 'flit': flies over anything, darts back after biting (the bat);
 * - 'charge': moves and attacks with ADV, knocking prone (the boar);
 * - 'gang': ADV when another foe stands in reach of its target (the goblin);
 * - 'boss': the golem's own turn (furnace, slam, summon, magma, kneel);
 * - 'passive': never acts (the training dummy).
 * @typedef {'sticky'|'skirmish'|'hex'|'mend'|'flit'|'charge'|'gang'|'boss'|'passive'} MonsterMove
 */

/**
 * A GLAIVE stat block.
 * @typedef {object} StatBlock
 * @property {number} ac
 * @property {number} hd
 * @property {number} [hp]          fixed hit points (overrides HD × 5: the dummy, the boss's pools)
 * @property {number[]} [pools]     the boss: hit point pools (GLAIVE's nested abilities), first to last
 * @property {number} [atk]         attack bonus (default: its HD)
 * @property {MonsterAttack[]} attacks
 * @property {number} attacksPerTurn
 * @property {number} morale        2–12 (12: never breaks)
 * @property {number} xp
 * @property {[number, number]} silver  treasure range
 * @property {number} dex           its DEX bonus (initiative)
 * @property {Partial<Record<import('./rules.js').Ability, number>>} saves
 * @property {MonsterMove[]} moves
 * @property {boolean} [flier]
 * @property {boolean} [undead]
 * @property {number} [draughtChance]  chance a Healing Draught drops
 */

/** @type {Record<string, StatBlock>} */
const BLOCKS = {
  slime: {
    ac: 10, hd: 1, attacks: [{ name: 'Engulf', damage: '1d6', range: 0, condition: 'slowed', save: 'str', dc: 10, rounds: 1 }],
    attacksPerTurn: 1, morale: 12, xp: 15, silver: [1, 4], dex: -1, saves: { str: 4, dex: -2 }, moves: ['sticky'], draughtChance: 0,
  },
  goblin: {
    ac: 13, hd: 1, attacks: [{ name: 'Spear', damage: '1d6', range: 0 }],
    attacksPerTurn: 1, morale: 7, xp: 25, silver: [3, 10], dex: 2, saves: { dex: 4, wil: -2 }, moves: ['gang'], draughtChance: 0.04,
  },
  archer: {
    ac: 12, hd: 1, attacks: [{ name: 'Shortbow', damage: '1d6', range: 2 }, { name: 'Knife', damage: '1d4', range: 0 }],
    attacksPerTurn: 1, morale: 7, xp: 25, silver: [3, 10], dex: 2, saves: { dex: 4, str: -2 }, moves: ['skirmish'], draughtChance: 0.04,
  },
  shaman: {
    ac: 11, hd: 2, attacks: [{ name: 'Gnarled Staff', damage: '1d4', range: 0 }, { name: 'Hex Bolt', damage: '2d4', range: 2 }],
    attacksPerTurn: 1, morale: 8, xp: 60, silver: [8, 18], dex: 0, saves: { wil: 4, str: -2 }, moves: ['hex', 'mend'], draughtChance: 0.08,
  },
  bat: {
    ac: 13, hd: 1, hp: 4, attacks: [{ name: 'Bite', damage: '1d4', range: 0 }],
    attacksPerTurn: 1, morale: 8, xp: 15, silver: [1, 5], dex: 3, saves: { dex: 4, wil: -2 }, moves: ['flit'], flier: true, draughtChance: 0,
  },
  boar: {
    ac: 14, hd: 3, attacks: [{ name: 'Gore', damage: '1d10', range: 0, condition: 'prone', save: 'str', dc: 13, rounds: 1 }],
    attacksPerTurn: 1, morale: 9, xp: 100, silver: [10, 25], dex: 0, saves: { str: 4, wis: -2 }, moves: ['charge'], draughtChance: 0.1,
  },
  dummy: {
    ac: 10, hd: 0, hp: 99, attacks: [], attacksPerTurn: 0, morale: 12, xp: 0, silver: [0, 0], dex: -5, saves: {}, moves: ['passive'], draughtChance: 0,
  },
  golem: {
    // Cinderheart: GLAIVE's "monster as puzzle" — three nested pools (its phases), a telegraphed
    // furnace blast, summoned bats, magma that alters the arena and a core exposed when it kneels
    ac: 16, hd: 10, pools: [60, 52, 52], atk: 7,
    attacks: [{ name: 'Molten Slam', damage: '2d8+2', range: 0, condition: 'prone', save: 'str', dc: 14, rounds: 1 }],
    attacksPerTurn: 2, morale: 12, xp: 1200, silver: [150, 150], dex: 0, saves: { str: 4, wil: 4, dex: -2 }, moves: ['boss'], draughtChance: 0,
  },
};

/** The stat blocks by kind. @type {Readonly<Record<string, Readonly<StatBlock>>>} */
export const BESTIARY = Object.freeze(BLOCKS);

/**
 * The stats of one foe: a stat block with a group's level and elite flag applied (see the header).
 * @typedef {object} MonsterStats
 * @property {string} kind
 * @property {number} level
 * @property {boolean} elite
 * @property {number} ac
 * @property {number} hd
 * @property {number} hpMax
 * @property {number[]|null} pools
 * @property {number} atk
 * @property {MonsterAttack[]} attacks
 * @property {number} attacksPerTurn
 * @property {number} morale
 * @property {number} xp
 * @property {[number, number]} silver
 * @property {number} dex
 * @property {Partial<Record<import('./rules.js').Ability, number>>} saves
 * @property {MonsterMove[]} moves
 * @property {boolean} flier
 * @property {boolean} boss
 * @property {number} draughtChance
 */

/**
 * @param {string} kind a BESTIARY key
 * @param {number} [level] the group's level (1–10)
 * @param {boolean} [elite]
 * @returns {MonsterStats}
 */
export function monsterStats(kind, level = 1, elite = false) {
  const b = BESTIARY[kind];
  if (!b) throw new Error(`monsterStats: unknown kind "${kind}"`);
  const L = Math.max(1, Math.min(10, Math.round(Number(level) || 1)));
  const boss = b.moves.includes('boss');
  const passive = b.moves.includes('passive');
  const up = boss || passive ? 0 : Math.floor((L - 1) / 3);
  const hd = b.hd + up;
  const perHd = elite ? 7 : HP_PER_HD;
  const pools = b.pools ? [...b.pools] : null;
  let hpMax;
  if (pools) hpMax = pools.reduce((a, v) => a + v, 0);
  else if (b.hp !== undefined) hpMax = Math.round((b.hp + up * perHd) * (elite ? 1.4 : 1));
  else hpMax = hd * perHd;
  return {
    kind, level: L, elite: !!elite,
    ac: b.ac + (boss || passive ? 0 : Math.floor((L - 1) / 4)),
    hd, hpMax, pools,
    atk: (b.atk ?? hd) + (elite ? 1 : 0),
    attacks: b.attacks.map((a) => ({ ...a })),
    attacksPerTurn: b.attacksPerTurn,
    morale: Math.min(12, b.morale + (elite ? 2 : 0)),
    xp: Math.round(b.xp * (1 + up * 0.5) * (elite ? 2 : 1)),
    silver: /** @type {[number, number]} */ (b.silver.map((s) => Math.round(s * (1 + up * 0.3) * (elite ? 2 : 1)))),
    dex: b.dex, saves: { ...b.saves }, moves: [...b.moves],
    flier: !!b.flier, boss, draughtChance: b.draughtChance ?? 0,
  };
}
