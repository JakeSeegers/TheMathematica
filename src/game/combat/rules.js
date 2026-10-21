/**
 * Small shared numbers of the combat level's world pieces (waystones, chests, the feedback
 * timings). The fight's own rules are GLAIVE's: src/game/glaive/rules.js (docs/specs/GLAIVE.md).
 */

export { POTION_MAX } from '../glaive/rules.js';

/** Float slack for time comparisons. */
export const EPS = 1e-6;
/** @type {(frames: number) => number} frames at 60 Hz → seconds */
export const F = (frames) => frames / 60;

/**
 * Waystones: the radius (u) the player attunes within, the stand point (u in front of the stone,
 * +Z) a respawn puts the player at, and the draughts a rest leaves the player at least.
 */
export const WAYSTONE = Object.freeze({ attune: 2.0, stand: 1.2, restDraughts: 2 });
/** Chests are discovered (shown on the maps) within `near` u, or `los` u in line of sight. */
export const CHEST_DISCOVER = Object.freeze({ near: 8, los: 12 });
