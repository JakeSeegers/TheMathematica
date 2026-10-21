/**
 * Player rules of the ARPG combat (COMBAT.md §6) — pure data and small formulas, no state.
 * Every window is written in frames at 60 Hz (the contract's `f`) and converted to seconds with
 * `F(frames)`; code compares times with `EPS`. Balance lives here (and in `defs.js` for enemies):
 * changing a number never needs a code change elsewhere.
 */

/**
 * @import { HitShapeSpec, FxName } from './types.js'
 * @import { SfxName } from '../../engine/audio/AudioSystem.js'
 */

/**
 * A pose span of a move table: `[fromFrame, toFrame, pose]` (both frames included; the pose is a
 * column name of the player's combat sheet).
 * @typedef {[number, number, string]} PoseSpan
 */

/**
 * One step of the melee combo (`COMBO`, §6.4). Frames are 60 Hz frame indices of the action.
 * @typedef {object} ComboStep
 * @property {'A1'|'A2'|'A3'} id   the step (SP_COST key)
 * @property {number} total        frames of the whole step
 * @property {PoseSpan[]} poses    poses by frame
 * @property {[number, number]} active  frames the hitboxes exist
 * @property {number} next         first frame a buffered attack cancels into the next step
 * @property {number} dodge        first frame a buffered dodge cancels the step
 * @property {number} lunge        forward lunge (u) over `lungeFrames`
 * @property {[number, number]} lungeFrames  frames of the lunge
 * @property {HitShapeSpec[]} hits hit shapes (a union: they share the swing's tag)
 * @property {number} mv           motion value
 * @property {number} kb           knockback strength
 * @property {number} sp           SP cost
 * @property {number} poise        poise damage
 * @property {FxName} fx           the swing effect (at `fxAt`)
 * @property {boolean} flip        mirror the effect (the back-hand)
 * @property {SfxName} sfx         the swing sound (at `fxAt`)
 * @property {number} fxAt         frame of the effect and the sound
 * @property {number} hitStop      hit-stop frames of a landed hit (before crit / kill bonus)
 * @property {boolean} finisher    the combo finisher (crit +0.10, finisher shake)
 */

/**
 * A dodge move (`ROLL`, `BACKSTEP`, §6.5).
 * @typedef {object} DodgeMove
 * @property {number} total        frames of the move
 * @property {PoseSpan[]} poses    poses by frame
 * @property {[number, number]} iframes  invulnerable frames
 * @property {number} dist         distance (u) over `moveFrames`
 * @property {number} moveFrames   frames of the motion
 * @property {number} attackFrom   first frame an attack cancels it
 * @property {number} dodgeFrom    first frame another dodge cancels it
 * @property {number} skillFrom    first frame a skill cancels it
 * @property {number} [rollSlashLunge]  roll only: lunge (u) of an attack out of the roll
 * @property {[number, number]} perfect  frames an overlap counts as a perfect dodge
 */

/** Float slack for frame comparisons (COMBAT.md conventions). */
export const EPS = 1e-6;
/** @type {(frames: number) => number} frames → seconds */
export const F = (frames) => frames / 60;
/**
 * Seconds → the frame index they fall in (f0 = the first frame of an action).
 * @type {(t: number) => number}
 */
export const frameOf = (t) => Math.floor(t * 60 + EPS);

// ---------------------------------------------------------------------------------------------
// Stats and progression (§6.1)
// ---------------------------------------------------------------------------------------------

export const LEVEL_CAP = 10;
export const SP_MAX = 100;
/** Stat gains per level (for the level-up announcement). */
export const PER_LEVEL = Object.freeze({ hp: 12, mp: 5, atk: 3, def: 1 });
/** @type {(L: number, up?: number) => number} max HP at level L plus upgrades `up` */
export const hpMaxFor = (L, up = 0) => 100 + PER_LEVEL.hp * (L - 1) + up;
/** @type {(L: number, up?: number) => number} max MP at level L plus upgrades */
export const mpMaxFor = (L, up = 0) => 40 + PER_LEVEL.mp * (L - 1) + up;
/** @type {(L: number, up?: number) => number} ATK at level L plus upgrades */
export const atkFor = (L, up = 0) => 12 + PER_LEVEL.atk * (L - 1) + up;
/** @type {(L: number, up?: number) => number} DEF at level L plus upgrades */
export const defFor = (L, up = 0) => 4 + PER_LEVEL.def * (L - 1) + up;
/** @type {(L: number) => number} XP needed from level L to L + 1 */
export const xpToNext = (L) => Math.round(30 * L ** 1.6);
/** Upgrade amounts (chests, the boss's core). */
export const UPGRADES = Object.freeze({ maxHp: 20, maxMp: 10, attack: 3, core: 20 });
/** Skill slots: id, unlock level, MP, cooldown (s), display name, HUD icon, keys. */
export const SKILLS = Object.freeze([
  Object.freeze({ id: 'skill1', name: 'Whirl Slash', unlock: 1, mp: 10, cooldown: 4.0, icon: 'whirl', keys: 'U/1', padKeys: 'LT+X' }),
  Object.freeze({ id: 'skill2', name: 'Ember Bolt', unlock: 2, mp: 8, cooldown: 1.5, icon: 'bolt', keys: 'I/2', padKeys: 'LT+Y' }),
  Object.freeze({ id: 'skill3', name: 'Radiant Nova', unlock: 4, mp: 18, cooldown: 12.0, icon: 'nova', keys: 'O/3', padKeys: 'LT+B' }),
]);

// ---------------------------------------------------------------------------------------------
// Resources (§6.2)
// ---------------------------------------------------------------------------------------------

export const SP_REGEN = 45;
export const SP_DELAY = 0.5;
export const SP_DELAY_EMPTY = 1.2;
export const SP_DODGE_MIN = 12;
export const SP_COST = Object.freeze({ A1: 5, A2: 5, A3: 8, roll: 25, backstep: 15 });
/** Winded (SP hit 0) until SP ≥ this; attack recovery frames last × WINDED_RECOVERY. */
export const WINDED_UNTIL = 30;
export const WINDED_RECOVERY = 1.35;
export const MP_REGEN = 0.8;
export const MP_PER_HIT = 2;
export const MP_PER_SWING_MAX = 4;
export const MANA_MOTE = 8;
export const HEART_HEAL = 0.12;
export const DRAUGHT_HEAL = 0.40;
export const POTION_MAX = 5;
export const POTION_START = 3;
export const DRAUGHT_PRICE = 25;
/**
 * The combat shop (the gold sink): the wares of a `shopkeeper` NPC on a combat level, in menu order.
 * `once`: sold at most once per session (kept through death and rest, like an opened chest; the
 * reset hook clears it); `upgrade` / `amount`: the player upgrade it applies (PlayerCombat#upgrade);
 * `gain`: the menu's short text. The Healing Draught is also what a plain `action: 'shop'` NPC sells
 * (§6.12). Priced so a player who clears both branches can afford most of it by the quarry lip.
 */
export const SHOP_WARES = Object.freeze([
  Object.freeze({ id: 'draught', name: 'Healing Draught', price: DRAUGHT_PRICE, once: false, upgrade: null, amount: 0, gain: 'heals 40 %' }),
  Object.freeze({ id: 'whetstone', name: 'Whetstone', price: 120, once: true, upgrade: 'attack', amount: 2, gain: 'ATK +2' }),
  Object.freeze({ id: 'tonic', name: 'Ironbark Tonic', price: 90, once: true, upgrade: 'maxHp', amount: 15, gain: 'Max HP +15' }),
  // (DEF +3: at +2 it took ≈ 6.7 % off the damage at Lv 5 for 150 gold, the weakest buy; +3 ≈ 9.7 %)
  Object.freeze({ id: 'charm', name: 'Warding Charm', price: 150, once: true, upgrade: 'def', amount: 3, gain: 'DEF +3' }),
]);
/**
 * The shop ware called `name` (null: not for sale).
 * @type {(name: string) => (typeof SHOP_WARES)[number]|null}
 */
export const shopWare = (name) => SHOP_WARES.find((w) => w.name === name) ?? null;
/** Perfect dodge (§6.5): rewards, cooldown, enemy slow motion. */
export const PERFECT = Object.freeze({ sp: 15, mp: 5, cooldown: 3.0, enemyScale: 0.35, time: 0.6 });

// ---------------------------------------------------------------------------------------------
// Bodies, radii, heights
// ---------------------------------------------------------------------------------------------

export const PLAYER_RADIUS = 0.3;
/** Player body band (u above the feet): projectile height test, aim point (0.9). */
export const PLAYER_BODY = Object.freeze([0, 1.8]);
/** The player's mass in the separation split (COMBAT.md §7.6). */
export const PLAYER_SEP_MASS = 4;
/** Melee height rule: attacker and target grounds within this (one step plus slack). */
export const MELEE_DY = 0.6;
/** Release / aim height above the ground of every straight shot (the height model, §7.6). */
export const SHOT_Y = 0.9;
/** Knockback cap (u) after the victim's mass. */
export const KB_CAP = 3;

// ---------------------------------------------------------------------------------------------
// Damage (§6.3)
// ---------------------------------------------------------------------------------------------

export const CRIT = Object.freeze({ base: 0.08, rear: 0.12, exposed: 0.30, finisher: 0.10, mult: 1.75 });
/** @type {(def: number) => number} the damage factor of a victim's DEF */
export const mitigation = (def) => 40 / (40 + 2 * def);

// ---------------------------------------------------------------------------------------------
// Melee combo (§6.4)
// ---------------------------------------------------------------------------------------------

/**
 * One combo step. poses: [fromFrame, toFrame, pose]; active: [from, to] frames the hitboxes exist;
 * next / dodge: the first frame a buffered attack / dodge cancels into; lunge u over lungeFrames;
 * hits: HitSpec shapes (a union shares the swing's tag); fx / sfx at `fxAt`.
 * @type {readonly Readonly<ComboStep>[]}
 */
export const COMBO = Object.freeze([
  Object.freeze(/** @satisfies {ComboStep} */ ({
    id: 'A1', total: 22, poses: [[0, 4, 'wind'], [5, 9, 'slash'], [10, 21, 'follow']],
    active: [5, 7], next: 14, dodge: 8, lunge: 0.4, lungeFrames: [3, 7],
    hits: [{ shape: 'sector', r: 1.6, halfAngle: 60 }], mv: 1.0, kb: 0.5, sp: SP_COST.A1, poise: 10,
    fx: 'slash', flip: false, sfx: 'swing', fxAt: 5, hitStop: 4, finisher: false,
  })),
  Object.freeze(/** @satisfies {ComboStep} */ ({
    id: 'A2', total: 24, poses: [[0, 4, 'follow'], [5, 9, 'backhand'], [10, 23, 'wind']],
    active: [5, 7], next: 15, dodge: 8, lunge: 0.4, lungeFrames: [3, 7],
    hits: [{ shape: 'sector', r: 1.6, halfAngle: 60 }], mv: 1.1, kb: 0.6, sp: SP_COST.A2, poise: 12,
    fx: 'slash', flip: true, sfx: 'swing', fxAt: 5, hitStop: 4, finisher: false,
  })),
  Object.freeze(/** @satisfies {ComboStep} */ ({
    id: 'A3', total: 39, poses: [[0, 9, 'wind'], [10, 16, 'thrust'], [17, 38, 'follow']],
    active: [10, 14], next: 32, dodge: 15, lunge: 0.8, lungeFrames: [8, 12],
    hits: [{ shape: 'lane', len: 2.2, width: 1.0 }, { shape: 'sector', r: 2.0, halfAngle: 35 }],
    mv: 1.8, kb: 2.0, sp: SP_COST.A3, poise: 30,
    fx: 'thrust', flip: false, sfx: 'swingHeavy', fxAt: 10, hitStop: 7, finisher: true,
  })),
]);
/** Magnet (§6.4): soft target chosen at f0–2; snaps within this distance, max turn. */
export const MAGNET = Object.freeze({ range: 3.0, maxTurnDeg: 60, reach: 0.6, extra: 0.5 });
/** Frames during which move input may still correct an attack's facing. */
export const FACING_FIX_FRAMES = 2;

// ---------------------------------------------------------------------------------------------
// Dodge (§6.5)
// ---------------------------------------------------------------------------------------------

export const ROLL = Object.freeze(/** @satisfies {DodgeMove} */ ({
  total: 22, poses: [[0, 2, 'tuck'], [3, 12, 'roll'], [13, 17, 'tuck'], [18, 21, 'wind']],
  iframes: [1, 13], dist: 3.2, moveFrames: 15, attackFrom: 16, dodgeFrom: 18, skillFrom: 18,
  rollSlashLunge: 0.3, perfect: [1, 8],
}));
export const BACKSTEP = Object.freeze(/** @satisfies {DodgeMove} */ ({
  total: 16, poses: [[0, 15, 'tuck']], iframes: [1, 8], dist: 1.8, moveFrames: 10,
  attackFrom: 10, dodgeFrom: 12, skillFrom: 12, perfect: [1, 8],
}));

// ---------------------------------------------------------------------------------------------
// Skills (§6.6) and the draught (§6.7)
// ---------------------------------------------------------------------------------------------

export const WHIRL = Object.freeze({
  total: 32, pose: 'spin', hits: [[6, 8], [14, 16]], r: 2.2, mv: 1.2, kb: 1.4, poise: 15,
  armor: 24, dodgeFrom: 24, hitStop: 3,
});
export const BOLT = Object.freeze({
  total: 20, pose: 'cast', release: 8, speed: 14, range: 12, radius: 0.35, mv: 2.0, kb: 0.8, poise: 20,
  splash: Object.freeze({ r: 1.0, mv: 0.6 }), cone: 45, dodgeFrom: 12, attackFrom: 14, hitStop: 3,
});
export const NOVA = Object.freeze({
  total: 40, poses: /** @satisfies {PoseSpan[]} */ ([[0, 19, 'cast'], [20, 27, 'spin'], [28, 39, 'follow']]), grow: 20, at: 20,
  r: 3.2, mv: 2.6, kb: 2.2, poise: 60, iframes: [4, 20], dodgeFrom: 30, hitStop: 5,
});
export const DRAUGHT = Object.freeze({ total: 30, pose: 'aim', at: 18, cooldown: 1.0 });

// ---------------------------------------------------------------------------------------------
// Getting hit (§6.8), level-up (§6.10), death (§6.11)
// ---------------------------------------------------------------------------------------------

export const HITSTUN = Object.freeze({ total: 18, pose: 'hurt', slide: 10, iframes: 48 });
export const KNOCKDOWN = Object.freeze({ down: 36, getUp: 18, slide: 14, iframesAfter: 30, techFrom: 24, kb: 2.5 });
export const LEVELUP_INVULN = F(60);
export const RESPAWN_IFRAMES = 2.0;
export const RESPAWN_GUARD = 0.25;
export const DEATH_SCREEN_DELAY = 1.2;
export const GOLD_LOSS = 0.1;

// ---------------------------------------------------------------------------------------------
// Input, targeting, engagement (§5.1, §6.9, §6.12)
// ---------------------------------------------------------------------------------------------

/** Input buffer (frames): a press fires as soon as a cancel window for it opens. */
export const BUFFER = F(10);
/** Holding `lock` this long releases it. */
export const LOCK_HOLD = 0.35;
export const SOFT_TARGET = Object.freeze({ range: 5, halfAngle: 75, boltRange: 12, boltHalfAngle: 45 });
export const LOCK = Object.freeze({ range: 14, retarget: 8, breakAt: 16, focusShare: 0.3, focusClamp: 4, lambda: 6 });
export const BOSS_FRAME = Object.freeze({ share: 0.45, clamp: 6, lambda: 4, minDistance: 30 });
export const ENGAGE = Object.freeze({ range: 16, linger: 3.0 });
export const WAYSTONE = Object.freeze({ attune: 2.0, stand: 1.2, restDraughts: 3 });
export const CHEST_DISCOVER = Object.freeze({ near: 8, los: 12 });
