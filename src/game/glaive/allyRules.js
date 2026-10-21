/**
 * What the party's tactics words (src/engine/level/PartyRules.js) mean in a turn-based fight
 * (docs/specs/GLAIVE.md §5.5): the HP fractions `heal` and `retreat` act at, and how far from the
 * player (u) a companion goes after a foe for each `distance`. Import-free and Node-safe.
 */

/** `heal`: heal a friend whose HP fraction is below this (0: never). */
export const HEAL_THRESHOLDS = Object.freeze({ never: 0, low: 0.3, half: 0.5, often: 0.75 });

/** `retreat`: fall back to the player while the companion's own HP fraction is below this. */
export const RETREAT_THRESHOLDS = Object.freeze({ never: 0, low: 0.25, half: 0.5 });

/** `distance`: a companion takes on foes within this many units of the player. */
export const LEASH = Object.freeze({ close: 4, mid: 8, far: 14 });
