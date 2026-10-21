/**
 * The foes' presence in the world (docs/specs/GLAIVE.md §7): display name, walk speed, how far they
 * see the player (`aggro`, u), body size and hover — what the level generators, the editor's
 * previews and the turn-based combat's actors read. Their fighting numbers are GLAIVE stat blocks:
 * src/game/glaive/bestiary.js. Import-free and Node-safe (tools/make-cinderwatch-pass.mjs reads it).
 *
 * Fields: name (English display), epithet (boss subtitle), speed (walk u/s), aggro (sight range u;
 * 0: never notices), radius (body), moveRadius (movement), body [y0, y1] (u above the feet; bat:
 * relative to its hover), flier, hover (u), passive (never fights: the dummy), boss, labelY (u above
 * the feet for the HP bar and the '!' alert).
 */

/**
 * Enemy kinds (ObjectCatalog `ENEMY_KINDS`).
 * @typedef {'slime'|'goblin'|'archer'|'shaman'|'bat'|'boar'|'dummy'|'golem'} EnemyKind
 */

/**
 * One `ENEMY_DEFS` entry.
 * @typedef {object} EnemyDef
 * @property {string} name
 * @property {string} [epithet]
 * @property {number} speed
 * @property {number} aggro
 * @property {number} radius
 * @property {number} moveRadius
 * @property {[number, number]} body
 * @property {boolean} flier
 * @property {number} hover
 * @property {boolean} passive
 * @property {boolean} boss
 * @property {number} labelY
 */

/** @type {Record<EnemyKind, EnemyDef>} kind → presence */
export const ENEMY_DEFS = {
  slime: { name: 'Moss Slime', speed: 2.2, aggro: 6, radius: 0.40, moveRadius: 0.30, body: [0, 0.9], flier: false, hover: 0, passive: false, boss: false, labelY: 1.3 },
  goblin: { name: 'Bramble Goblin', speed: 3.0, aggro: 8, radius: 0.35, moveRadius: 0.30, body: [0, 1.7], flier: false, hover: 0, passive: false, boss: false, labelY: 2.3 },
  archer: { name: 'Thorn Archer', speed: 3.0, aggro: 11, radius: 0.35, moveRadius: 0.30, body: [0, 1.7], flier: false, hover: 0, passive: false, boss: false, labelY: 2.3 },
  shaman: { name: 'Hex Shaman', speed: 2.6, aggro: 10, radius: 0.35, moveRadius: 0.30, body: [0, 1.7], flier: false, hover: 0, passive: false, boss: false, labelY: 2.3 },
  bat: { name: 'Cinder Bat', speed: 4.5, aggro: 9, radius: 0.35, moveRadius: 0.30, body: [-0.45, 0.45], flier: true, hover: 1.3, passive: false, boss: false, labelY: 2.5 },
  boar: { name: 'Ironhide Boar', speed: 2.4, aggro: 9, radius: 0.60, moveRadius: 0.45, body: [0, 1.3], flier: false, hover: 0, passive: false, boss: false, labelY: 1.9 },
  dummy: { name: 'Straw Dummy', speed: 0, aggro: 0, radius: 0.40, moveRadius: 0.35, body: [0, 1.5], flier: false, hover: 0, passive: true, boss: false, labelY: 1.9 },
  golem: { name: 'Cinderheart', epithet: 'The Last Fire of the Pass', speed: 1.6, aggro: 0, radius: 1.20, moveRadius: 0.60, body: [0, 3.6], flier: false, hover: 0, passive: false, boss: true, labelY: 4.4 },
};
