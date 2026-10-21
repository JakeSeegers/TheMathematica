/**
 * The party's game numbers (docs/specs/PARTY.md §5): what the rule values of
 * src/engine/level/PartyRules.js mean in units, seconds and fractions, each member class's
 * stats and moves, and how a member fights. Read by the follow (Party / PartyMember) and the
 * companion's combat (MemberCombat, CombatSystem). Import-free (the Node tests read it).
 *
 * Frames are 60 Hz frame indices of an action (as in combat/rules.js: f0 is the first frame).
 */

/**
 * `distance`: how far from the player a member ranges in a fight (`leash`, u: it does not chase a
 * foe past it) and the distance a ranged or caster member keeps from its target (`standoff`, u).
 */
export const DISTANCE = Object.freeze({
  close: Object.freeze({ leash: 4, standoff: 2.4 }),
  mid: Object.freeze({ leash: 8, standoff: 4.5 }),
  far: Object.freeze({ leash: 13, standoff: 7 }),
});

/** `heal`: heal someone whose HP fraction is below this (0: never). */
export const HEAL_AT = Object.freeze({ never: 0, low: 0.3, half: 0.5, often: 0.75 });

/** `retreat`: fall back to the player while the member's own HP fraction is below this (0: never). */
export const RETREAT_AT = Object.freeze({ never: 0, low: 0.25, half: 0.5 });

/**
 * A member class's stats at party level 1 and per level (the player's level is the party's): HP,
 * MP, ATK, DEF; walk / run speed (u/s).
 */
export const CLASS_STATS = Object.freeze({
  warden: Object.freeze({ hp: 82, mp: 30, atk: 6, def: 3.5, perLevel: Object.freeze({ hp: 8, mp: 3, atk: 1.4, def: 0.7 }), walk: 3.2, run: 5.8 }),
  ranger: Object.freeze({ hp: 62, mp: 30, atk: 7, def: 2, perLevel: Object.freeze({ hp: 6.5, mp: 3, atk: 1.7, def: 0.5 }), walk: 3.2, run: 5.8 }),
  mystic: Object.freeze({ hp: 58, mp: 60, atk: 6.5, def: 2, perLevel: Object.freeze({ hp: 6, mp: 6, atk: 1.6, def: 0.5 }), walk: 3.2, run: 5.8 }),
});

/**
 * How a member fights, whatever its class (MemberCombat; the enemies' side in CombatSystem).
 * Times in seconds unless the name says frames.
 */
export const ALLY = Object.freeze({
  /**
   * A member's ATK × this by the number of members in the fight (1, 2, 3): a full party shares the
   * work instead of tripling it (with three at full ATK the player landed one kill in ten).
   */
  partyAtk: Object.freeze([1, 0.85, 0.72]),
  /**
   * `heal: often` (Support): the member keeps its hands free for Mend — the pause after its basic
   * attack (the warden's combo, a shot, a bolt) and its skill's cooldown × this.
   */
  healerPace: 2,
  /** Hurt radius and move radius (u), as the player's. */
  radius: 0.3,
  /** Body band above the feet (u): projectile height test, aim point. */
  body: Object.freeze([0, 1.8]),
  /** Separation against enemies (the player's is 4); an ally yields to the player entirely. */
  mass: 3,
  /** The AI re-plans its target and its spot this often (s; each member at its own phase). */
  planEvery: 0.25,
  /** Out of a fight this long (s): fast regeneration, and a downed member gets up. */
  calm: 2,
  /** HP and MP fraction regained per second out of a fight. */
  regen: 0.1,
  /** HP fraction a downed member gets up with. */
  getUp: 0.3,
  /** Frames of the get-up (pose `tuck`). */
  getUpFrames: 24,
  /** MP regained per second in a fight. */
  mpRegen: 0.8,
  /** The spot beside the player a member holds when it has nothing to do (u from the player). */
  hold: 1.8,
  /**
   * Holding that spot: it is planned anew only when the player moved `holdReplan` u from where it
   * was planned or the nearest foe came round to its side of the player; a member standing there
   * sets off only once it is more than `holdSlack` u away (a push, the player's step) and walks
   * until it is within `holdStop` u.
   */
  holdReplan: 1.0,
  holdSlack: 1.0,
  holdStop: 0.35,
  /** A ranged / caster member farther than its leash + this from the player walks back before it shoots (u). */
  leashSlack: 0.75,
  /** A melee member at its spot but out of its target's reach in height this long gives the foe up (s). */
  noReach: 1.0,
  /** A melee member in front of the player on screen steps to a free spot before its next thrusts, at most this often (s). */
  relocEvery: 0.8,
  /** Shots lead a moving target by at most this (u; its velocity smoothed over `leadTau` s while aiming). */
  leadMax: 3,
  leadTau: 0.1,
  /** A member that falls back stands this far behind the player, away from the foes (u). */
  retreat: 2.6,
  /** Run (not walk) to a goal farther than this (u). */
  runFrom: 2.4,
  /** Dodge roll: frames, i-frames, distance (u) over `moveFrames`, cooldown (s); poses as the player's. */
  roll: Object.freeze({
    total: 20, iframes: Object.freeze([1, 13]), dist: 3.0, moveFrames: 15, cooldown: 1.1,
    poses: Object.freeze([Object.freeze([0, 2, 'tuck']), Object.freeze([3, 12, 'roll']), Object.freeze([13, 19, 'tuck'])]),
  }),
  /** Evade: roll out of an enemy marker whose fill is in [minFill, 1) (magma: always). */
  evadeFill: 0.3,
  /** Hit stun: frames, slide frames; i-frames after it (s). */
  hurt: Object.freeze({ total: 14, slide: 10, iframes: 0.5 }),
  /** Knockdown (a hit with `knockdown` or kb ≥ `kb`): frames down / getting up, slide frames, i-frames after (s). */
  knockdown: Object.freeze({ down: 36, getUp: 18, slide: 14, iframes: 0.6, kb: 2.5 }),
  /** Knockback cap (u). */
  kbCap: 3,
  /**
   * `attack: assist`: a foe the player hit this recently (s) counts as fighting the party — as do
   * the lock-on, a foe after a member and an aggroed foe within `assistNear` u of the player.
   */
  assistMemory: 4,
  assistNear: 3,
  /** Path searches on the walk grid: at most one per member this often (s), paths up to `pathMax` u. */
  pathEvery: 0.3,
  pathMax: 36,
  /** Moving < 25 % of the step this long (s): search a path; this long: give the target up for `skipFor` s. */
  stuckPath: 0.5,
  stuckGiveUp: 2,
  skipFor: 3,
  /**
   * Enemies against allies (PARTY.md §5.3): a foe a member hits turns on it when the member is
   * nearer to it than `threat` × the player's distance; an archer or a shaman (a ranged foe) also
   * when the member's shot came from within `rangedAggro` u (its own reach) …
   */
  threat: 1.25,
  rangedAggro: 10,
  /** … holds a switched target ≥ this (s) … */
  holdTarget: 2.5,
  /** … look again this often (s) … */
  checkTarget: 0.5,
  /** … and go back to the player when the player is nearer than this × the ally's distance. */
  playerNearer: 0.6,
  /** Boss arena: members within this of the player (u) are placed inside when it closes. */
  arenaPull: 12,
});

/**
 * A melee hit of the warden's combo: frames, poses, the active window, a sector at the feet along
 * the facing, motion value, knockback, poise damage, a lunge (u over `lungeFrames`), the effect.
 * @typedef {{ total: number, poses: readonly (readonly [number, number, string])[], active: readonly [number, number],
 *   r: number, halfAngle: number, mv: number, kb: number, poise: number, lunge: number,
 *   lungeFrames: readonly [number, number], fxAt: number, fx: 'thrust'|'slash', sfx: 'swing'|'swingHeavy' }} AllyMeleeHit
 */

/**
 * The moves of each class (PARTY.md §5.2). `reach` (melee): the distance between centres, beyond
 * the target's radius, from which the basic attack starts. `basic` (ranged / caster): a shot —
 * frames, poses, release frame, projectile speed / range / radius, motion value, knockback, poise,
 * cooldown (s); the mystic's bolt splashes. `skill`: MP, cooldown (s), frames, its numbers;
 * `minFoes`: foes it wants around its target (or its own feet) unless the target is an elite or
 * the boss. `mend`: MP, cooldown (s), frames, the frame it heals at, HP healed (`frac` of the
 * target's max HP + `flat`), range (u).
 */
export const KIT = Object.freeze({
  warden: Object.freeze({
    reach: 1.35,
    /** The two thrusts of the combo (the second follows at once while the foe is in reach). */
    combo: Object.freeze([
      Object.freeze({
        total: 20, poses: Object.freeze([Object.freeze([0, 6, 'wind']), Object.freeze([7, 11, 'thrust']), Object.freeze([12, 19, 'follow'])]),
        active: Object.freeze([7, 9]), r: 1.7, halfAngle: 35, mv: 1.0, kb: 0.5, poise: 10, lunge: 0.3,
        lungeFrames: Object.freeze([4, 8]), fxAt: 7, fx: 'thrust', sfx: 'swing',
      }),
      Object.freeze({
        total: 26, poses: Object.freeze([Object.freeze([0, 8, 'wind']), Object.freeze([9, 13, 'thrust']), Object.freeze([14, 25, 'follow'])]),
        active: Object.freeze([9, 11]), r: 1.8, halfAngle: 35, mv: 1.3, kb: 1.2, poise: 16, lunge: 0.45,
        lungeFrames: Object.freeze([6, 10]), fxAt: 9, fx: 'thrust', sfx: 'swingHeavy',
      }),
    ]),
    /** Pause after the combo (s). */
    comboGap: 0.75,
    /** Sweep: a spin around it with knockback; super armour through `armor` frames. */
    skill: Object.freeze({
      id: 'sweep', name: 'Sweep', mp: 10, cooldown: 7, total: 32, pose: 'spin', active: Object.freeze([10, 13]),
      r: 2.2, mv: 1.3, kb: 2.2, poise: 30, armor: 16, minFoes: 2,
    }),
    mend: Object.freeze({ mp: 10, cooldown: 6, total: 34, at: 20, frac: 0.25, flat: 6, range: 8 }),
  }),
  ranger: Object.freeze({
    basic: Object.freeze({
      total: 26, poses: Object.freeze([Object.freeze([0, 15, 'aim']), Object.freeze([16, 25, 'follow'])]), release: 14,
      speed: 16, range: 12, radius: 0.25, mv: 1.0, kb: 0.4, poise: 6, cooldown: 0.5,
    }),
    /** Volley: three arrows fanned ±`spread`°. */
    skill: Object.freeze({
      id: 'volley', name: 'Volley', mp: 9, cooldown: 7, total: 32, release: 18, n: 3, spread: 12,
      speed: 16, range: 12, radius: 0.25, mv: 0.9, kb: 0.6, poise: 8, minFoes: 2,
      poses: Object.freeze([Object.freeze([0, 19, 'aim']), Object.freeze([20, 31, 'follow'])]),
    }),
    mend: Object.freeze({ mp: 10, cooldown: 6, total: 34, at: 20, frac: 0.25, flat: 6, range: 8 }),
  }),
  mystic: Object.freeze({
    basic: Object.freeze({
      total: 26, poses: Object.freeze([Object.freeze([0, 17, 'cast']), Object.freeze([18, 25, 'follow'])]), release: 14,
      speed: 12, range: 11, radius: 0.3, mv: 1.15, kb: 0.6, poise: 10, cooldown: 0.75,
      splash: Object.freeze({ r: 0.8, mv: 0.45 }),
    }),
    /** Flare: a burst on its target's spot `delay` s after the cast (no ground marker). */
    skill: Object.freeze({
      id: 'flare', name: 'Flare', mp: 12, cooldown: 8, total: 30, at: 16, pose: 'cast', delay: 0.7,
      r: 1.9, mv: 2.2, kb: 1.5, poise: 35, range: 10, minFoes: 2,
    }),
    mend: Object.freeze({ mp: 12, cooldown: 4.5, total: 30, at: 18, frac: 0.35, flat: 10, range: 9 }),
  }),
});
