// Combat contract types (docs/contracts/COMBAT.md §9, deviations §27). Types only: nothing here
// reaches a bundle. They describe what the code in src/game/combat/ does today; where the contract
// text and the code differ the code wins and the member says so (§27 row or "Code:").
//
// Core → enemy: `CombatContext` (§9.2, built by `CombatSystem._makeContext`), `PlayerView`.
// Core ↔ enemy records: `HitSpec`, `ProjectileSpec`, `MarkerSpec`, `HitInfo` (§9.5).
// Enemy construction: `EnemyInit` (§9.3), `EnemyGroup`; `EnemyDef` / `ScaledEnemyDef` (§9.4) are
// JSDoc typedefs in `defs.js` (re-exported here), so the Node tools that import it stay light.
// Enemy → brain: `Brain` (the `ai/*.js` objects, `ai/index.js`), `EnemyHazard`.
// Tests: `CombatHooks` (`window.__game.combat`, §20.1), `CombatState` (§20.2), `CombatStats`.

import type { Vector3 } from 'three';
import type { Enemy } from './Enemy.js';
import type { Nav } from './Nav.js';
import type { TileMap } from '../../engine/world/TileMap.js';
import type { Sprite3D } from '../../engine/sprite/Sprite3D.js';
import type { RNG } from '../../engine/utils/math.js';
import type { createEnemySheet } from '../../engine/pixel/MonsterSprites.js';
import type { Rect, LevelObjectOf } from '../../engine/level/types.js';
import type { CombatSystem } from './CombatSystem.js';
import type { EnemyKind, EnemyToken, EnemyDrops, EnemyDef, ScaledEnemyDef } from './defs.js';
import type { COMBAT_BINDINGS, COMBAT_PAD_BINDINGS } from './bindings.js';
import type { SfxName } from '../../engine/audio/AudioSystem.js';
import type { LootRoll } from './Loot.js';
import type { MemberCombat } from '../party/MemberCombat.js';

declare module '../../engine/core/types.js' {
  /** The combat actions CombatSystem binds (`input.addBindings(COMBAT_BINDINGS, COMBAT_PAD_BINDINGS)`). */
  interface ExtraActions extends Record<keyof typeof COMBAT_BINDINGS | keyof typeof COMBAT_PAD_BINDINGS, true> {}
}

export type { EnemyKind, EnemyToken, EnemyDrops, EnemyDef, ScaledEnemyDef };

// -------------------------------------------------------------------------------------------------
// Small shapes
// -------------------------------------------------------------------------------------------------

/**
 * A point or a direction on the ground plane (world units; a direction is usually unit length).
 * An object { x, z }, unlike the level format's `XZ` tuple [x, z] (engine/level/types.d.ts).
 */
export interface PointXZ {
  /** World x (a direction: its x component). */
  x: number;
  /** World z (a direction: its z component). */
  z: number;
}

/**
 * An axis-aligned world rectangle on XZ (arena rects, zone rects, clamps): the level `Rect`, under
 * the name the contract uses (an alias, not a second shape).
 */
export type RectXZ = Rect;

/** A splash on impact (the player's Ember Bolt): radius and motion value. */
export interface Splash {
  r: number;
  mv: number;
}

/** An arc flight (boulder): lands at (tx, ground height, tz) after `time` s; `apex`: peak height. */
export interface ArcFlight {
  tx: number;
  tz: number;
  time: number;
  /** Optional in a ProjectileSpec (the pool computes one); always set on a live projectile. */
  apex?: number;
}

/**
 * `Enemy.state` (§7.4 shared machine; the boss adds `intro`, `phase` = transition roar and `kneel`
 * = phase-3 exposed core, §27.5 E6; its Broken state is `stagger`).
 */
export type EnemyState =
  | 'dormant' | 'idle' | 'notice' | 'engage' | 'windup' | 'active' | 'recover'
  | 'hitstun' | 'stagger' | 'stun' | 'return' | 'dead'
  | 'intro' | 'phase' | 'kneel';

/** What stopped the last `ctx.moveGround` / `ctx.moveFly` (`Enemy.blockedBy`, §7.6). */
export type BlockedBy = null | 'terrain' | 'collider' | 'arena';

/** Named effects of `CombatFx` (`FX_NAMES`, §11.5). */
export type FxName =
  'slash' | 'slashBig' | 'thrust' | 'spin' | 'impact' | 'crit' | 'dust' | 'stun' | 'pillar';

/** Options of a named effect (`ctx.fx`, `CombatFx.play`, §11.5). */
export interface FxOptions {
  /** Forward axis of a flat effect, x component (default (0, 1)). */
  dirX?: number;
  /** Forward axis, z component. */
  dirZ?: number;
  /** Mirror the frame along its U axis (the back-hand slash, §27.1 I2). */
  flip?: boolean;
  /** Multiplies the effect's own scale. */
  scale?: number;
  /** A live position the effect follows (stun stars, the pillar); `y` keeps the start offset. */
  follow?: { x: number; y: number; z: number };
  /** Seconds a looping effect lasts (`stun`, `pillar`); default the effect's own. */
  duration?: number;
}

/** Options of a positional combat sound (`ctx.sfx`, `CombatSystem.sfxAt`). */
export interface SfxOptions {
  /** Multiplies the distance attenuation (1). */
  volume?: number;
  /** Multiplies the ±4 % hashed pitch jitter (1). */
  pitch?: number;
}

/** Brain → core signals (`ctx.emit`, §8.1, §8.3); core applies the global consequences. */
export type BossSignal = 'bossIntro' | 'bossAwake' | 'bossPhase';

// -------------------------------------------------------------------------------------------------
// Hit, projectile and marker records (§9.5)
// -------------------------------------------------------------------------------------------------

/** Hitbox shapes (`Hitboxes.hitOverlaps`). */
export type HitShape = 'circle' | 'sector' | 'lane' | 'ring';

/**
 * A hitbox, active for one combat sub-step (`ctx.hitbox`, `CombatSystem.addPlayerHit`). The queue
 * copies it (`HitQueue.add`), so callers reuse their record; a missing optional field takes the
 * default in brackets (`Hitboxes.js` DEFAULTS). `mv`, `kb` and `tag` stay required (the contract's
 * shape) although DEFAULTS has values for them too (1, 0, 0). Overlap rules: COMBAT.md §9.5.
 */
export interface HitSpec {
  /** Which overlap test applies. */
  shape: HitShape;
  /** Origin x (circle / ring centre, sector apex, lane start). */
  x: number;
  /** Ground height of the attack (attacker's feet; a hazard: its ground); targets count within `dy`. */
  y: number;
  /** Origin z. */
  z: number;
  /** Radius: circle, sector, ring outer [1]. */
  r?: number;
  /** Ring inner radius [0]. */
  rInner?: number;
  /** Sector / lane axis x (normalised by the test) [0; enemy specs: the facing]. */
  dirX?: number;
  /** Sector / lane axis z [1; enemy specs: the facing]. */
  dirZ?: number;
  /** Sector half angle in degrees [60]. */
  halfAngle?: number;
  /** Lane length along the axis [1]. */
  len?: number;
  /** Lane width [1]. */
  width?: number;
  /** Height tolerance between the target's ground and `y` [0.6]. */
  dy?: number;
  /** Motion value: multiplier of the attacker's ATK (0 with no `flat`: a push only, §27.1 I5). */
  mv: number;
  /** Knockback strength (u before mass). */
  kb: number;
  /** Poise damage [0]. */
  poise?: number;
  /** Knocks the target down [false]. */
  knockdown?: boolean;
  /** > 0: flat damage, no ATK / mitigation / hit-stop (magma ticks, §6.3) [0]. */
  flat?: number;
  /** Target radius treated as 0 (ring waves) [false]. */
  thin?: boolean;
  /** One hit per target per tag; a number, 0 = untagged (§27.13 R6; §9.5 says a string). */
  tag: number;
  /** Knockback origin x; NaN / undefined = the origin. */
  fromX?: number;
  /** Knockback origin z; NaN / undefined = the origin. */
  fromZ?: number;
}

/**
 * A hit shape of a player move table (`rules.js` `COMBO[i].hits`): PlayerCombat copies these onto
 * its full HitSpec for every active frame.
 */
export type HitShapeSpec = Pick<HitSpec, 'shape' | 'r' | 'halfAngle' | 'len' | 'width'>;

/** Projectile kinds (`Projectiles.js` `PROJECTILE_KINDS`); an unknown kind flies as an arrow. */
export type ProjectileKind = 'arrow' | 'emberBolt' | 'boulder';

/**
 * A projectile to launch (`ctx.projectile`, `CombatSystem.spawnProjectile`); copied by
 * `Projectiles.spawn`, which draws its hit tag itself. Defaults in brackets are the code's;
 * `dirX`, `dirZ`, `speed`, `range` and `radius` stay required (the contract's shape) all the same.
 */
export interface ProjectileSpec {
  /** Look, sound and flight rules. */
  kind: ProjectileKind;
  /** Release point x. */
  x: number;
  /** Release height, absolute (enemies: ground + 0.9, §7.6). */
  y: number;
  /** Release point z. */
  z: number;
  /** Horizontal direction x (normalised by the pool) [0]. */
  dirX: number;
  /** Horizontal direction z [1]. */
  dirZ: number;
  /** Vertical speed (u/s) from the aim formula of §7.6 (`aimVy`) [0]. */
  vy?: number;
  /** Horizontal speed (u/s) [10]. */
  speed: number;
  /** Horizontal range (u) [12]. */
  range: number;
  /** Collision radius [0.2]. */
  radius: number;
  /** Motion value of the hit (× the shooter's ATK). */
  mv: number;
  /** Knockback strength of the hit. */
  kb: number;
  /** Poise damage of the hit [0]. */
  poise?: number;
  /** Flies on through the first target [false]. */
  pierce?: boolean;
  /** Splash on impact (the player's Ember Bolt): radius and motion value [null]. */
  splash?: Splash | null;
  /** Arc shot (boulder): no collision in flight, lands at (tx, groundAt, tz) after `time` s [null]. */
  arc?: ArcFlight | null;
}

/** Ground-marker shapes (`GroundMarkers`, §11.2). */
export type MarkerShape = 'circle' | 'ring' | 'sector' | 'lane' | 'rect';

/** Ground-marker styles (§11.2). */
export type MarkerStyle = 'enemy' | 'player' | 'lock' | 'barrier' | 'magma';

/**
 * A telegraph / decal on the draped ground (`GroundMarkers.set`, §9.5, §11.2). Core keeps a full
 * copy per handle (`MARKER_DEFAULTS` in CombatSystem.js); `ctx.marker` / `ctx.setMarker` copy only
 * the fields given, so callers pass partial records (`Partial<MarkerSpec>`).
 */
export interface MarkerSpec {
  /** The outline drawn. */
  shape: MarkerShape;
  /** Centre x (circle / ring / rect), apex (sector) or start (lane). */
  x: number;
  /** Lift above the draped ground (0.03). */
  y?: number;
  /** Centre / apex / start z. */
  z: number;
  /** Radius (circle, ring outer, sector). */
  r: number;
  /** Ring inner radius. */
  rInner: number;
  /** Sector / lane / rect axis x. */
  dirX: number;
  /** Sector / lane / rect axis z. */
  dirZ: number;
  /** Sector half angle (degrees). */
  halfAngle: number;
  /** Lane length. */
  len: number;
  /** Lane width. */
  width: number;
  /** Rect width (across the axis); outline only. */
  w: number;
  /** Rect depth (along the axis); outline only. */
  d: number;
  /** Fill 0..1; 1 resolves (rim white for 5 f). */
  progress: number;
  /** Colour scheme: enemy telegraph, player skill, lock-on, arena barrier, magma pool. */
  style: MarkerStyle;
  /** Opacity multiplier (1). */
  alpha?: number;
  /** Rim whitening 0..1: the lane lock flash (§27.1 I4, §27.3 F4) (0). */
  flash?: number;
}

/** Where a hit on an enemy came from (`HitInfo.source`; the player's PLAYER_HIT_META). */
export type HitSource = 'melee' | 'skill' | 'projectile' | 'enemy';

/**
 * Core → `Enemy.receiveHit` after the damage was applied (hp still > 0), and brain `onHit`. One
 * record reused by core (`CombatSystem._info`). The player's hurt takes its own record
 * (`PlayerCombat.hurt`).
 */
export interface HitInfo {
  /** HP taken (0 when guarded). */
  damage: number;
  /** A critical hit (damage × 1.75, §6.3). */
  crit: boolean;
  /** The hit's motion value. */
  mv: number;
  /** The hit's knockback strength (before the enemy's mass). */
  kb: number;
  /** Unit knockback direction x (away from `fromX/fromZ` of the hit). */
  kbDirX: number;
  /** Unit knockback direction z. */
  kbDirZ: number;
  /** Poise damage of the hit. */
  poise: number;
  /** Knockdown (never for the boss). */
  knockdown: boolean;
  /** Code: 'melee' | 'skill' | 'projectile' ('enemy' is listed in §9.5 but never produced). */
  source: HitSource;
  /** The hit's tag (a number, §27.13 R6). */
  tag: number;
  /** True: the enemy was guarded, no damage was dealt. */
  guarded: boolean;
}

// -------------------------------------------------------------------------------------------------
// The combat context (core → enemies, §9.2)
// -------------------------------------------------------------------------------------------------

/**
 * The player as enemies see it: one record owned by core (`CombatSystem._pv`), refreshed before
 * and after the player's sub-step (§9.2).
 */
export interface PlayerView {
  /** Live `player.position` (y = ground). */
  position: Vector3;
  /** Hurt radius (0.3). */
  radius: number;
  /** Body band [y0, y1] above the feet ([0, 1.8]). */
  body: [number, number];
  /** Unit facing on XZ. */
  facing: PointXZ;
  /** Ground velocity (u/s), measured per frame by core (`_playerVelocity`). */
  velocity: PointXZ;
  /** HP above 0 (false from the death until the respawn). */
  alive: boolean;
  /** I-frames (or the `god` hook). */
  invulnerable: boolean;
  /** Rolling or backstepping. */
  dodging: boolean;
  /**
   * The PlayerCombat action or null. Core's names: 'attack' (every combo step), 'roll', 'backstep',
   * 'skill1'–'skill3', 'draught', 'hitstun', 'knockdown', 'dead' (the enemies sandbox mock uses 'a1').
   */
  action: string | null;
  /** Swings started (every combo step; §27.1 I7); core always sets it, readers allow it absent. */
  swing?: number;
  /** A boss arena is closed (§27.9 G4). Core always sets it; readers treat absent as false. */
  sealed?: boolean;
}

/**
 * The boss arena as the golem brain reads it (`EnemyInit.arena`, `e.arena`, §9.3): core passes its
 * `BossArena`; the enemies sandbox passes a plain object with the brain-facing members only.
 */
export interface EnemyArena {
  /** World rect (the fight area). */
  rect: RectXZ;
  /** World gate segment [x0, z0, x1, z1]. */
  gate: number[];
  /** Floor height. */
  y: number;
  /** Closed: the fight runs. */
  active: boolean;
  /** Is (x, z) inside `rect`? */
  contains(x: number, z: number): boolean;
  /** Core only (`BossArena`; absent on a mock): the rect centre. */
  center?: PointXZ;
  /** Core only (`BossArena`): inside the rect grown by `g` u (the other enemies' exclusion, §7.6). */
  containsGrown?(x: number, z: number, g: number): boolean;
  /** Core only (`BossArena`): close the gate on `bossIntro` (barrier, flames). */
  close?(): void;
  /** Core only (`BossArena`): open it again on the boss's death (and on resets). */
  open?(): void;
  /** Core only (`BossArena`): the kill's particle bursts (§27.14 X4). */
  deathBursts?(boss: Enemy): void;
}

/**
 * Everything an enemy (and its brain) may use of the world (COMBAT.md §9.2). One object per
 * CombatSystem, shared by all enemies; built by `CombatSystem._makeContext()`. The enemies sandbox
 * (`sandbox/enemy_ai.js`) implements the same list on a mock core.
 */
export interface CombatContext {
  /** Combat time (s, enemy-scaled: `CombatSystem.enemyTime`). */
  time: number;
  /** Combat sub-step counter (hash input for visual jitter, path cadence). */
  frame: number;
  /** The player as enemies see it (one live record). */
  player: PlayerView;
  /** The level's TileMap (heights, walkability, colliders). */
  tileMap: TileMap;
  /** Ground move (radius, step 0.55, arena exclusion); sets `e.blockedBy` → fraction moved 0..1. */
  moveGround(e: Enemy, dx: number, dz: number): number;
  /** Flier move, clamped to home ± (group radius + 8) (adds: arena), the map, arena exclusion. */
  moveFly(e: Enemy, dx: number, dz: number): void;
  /** Ground height. */
  groundAt(x: number, z: number): number;
  /** Standable: walkable and not open water (bridge decks count). */
  walkable(x: number, z: number): boolean;
  /** Straight-shot line of sight with the height model of §7.6. */
  los(ax: number, az: number, bx: number, bz: number): boolean;
  /** Within NDC |x|, |y| ≤ 0.92 of the camera cached at the start of the frame (§7.3). */
  onScreen(x: number, y: number, z: number): boolean;
  /** Take the kind's attack token (`def.token`); sets `e.token`; false: the budget is spent (§7.5). */
  requestToken(e: Enemy): boolean;
  /** Return the token; clears `e.token`. */
  releaseToken(e: Enemy): void;
  /** Register a hitbox for this sub-step (copied). */
  hitbox(e: Enemy, spec: HitSpec): void;
  /** Launch a projectile; its handle, or −1 when the pool is full. */
  projectile(e: Enemy, spec: ProjectileSpec): number;
  /**
   * Allocate a ground marker (missing fields take core's defaults), owned by the enemy being
   * updated (freed when core sends it home); its handle, or −1 (§11.2).
   */
  marker(spec: Partial<MarkerSpec>): number;
  /** Update the given fields of a marker (a stale or freed handle is ignored). */
  setMarker(h: number, spec: Partial<MarkerSpec>): void;
  /** Free a marker (−1, a stale or an already freed handle is ignored). */
  freeMarker(h: number): void;
  /** A named effect at ground height `y` (§11.5). Code: core's returns false when its pool is full. */
  fx(name: FxName, x: number, y: number, z: number, opts?: FxOptions): void;
  /** A particle burst of a `PARTICLE_PRESETS` preset (count clamped to 0..24). */
  burst(preset: string, x: number, y: number, z: number, count: number): void;
  /** A combat sound, panned and attenuated by the distance to the player. */
  sfx(name: SfxName, x: number, z: number, opts?: SfxOptions): void;
  /** Camera shake (amplitude, seconds). */
  shake(amp: number, dur: number): void;
  /** Heal an enemy: HP capped, green number, `healGlow` 8, bar refresh (the shaman's Mend). */
  heal(target: Enemy, amount: number): void;
  /** The DOM '!' above an enemy that noticed the player. */
  alert(e: Enemy): void;
  /** Aggro `e`'s group and the enemies of its zone within 6 u in line of sight (§27.13 R5). */
  wakeGroup(e: Enemy): void;
  /**
   * The walk grid (§27.13 R1): `findPath`, `lineClear`, `spend`; null until `load` built it
   * (without it enemies chase and return in straight lines).
   */
  nav: Nav | null;
  /** Alive, non-dormant, visible enemies within r of (x, z), written into `out` (cleared first). */
  enemiesNear(x: number, z: number, r: number, out: Enemy[]): Enemy[];
  /**
   * Show one of the calling boss's pooled adds at (x, z), reset and woken (golem only); null when
   * none of `kind` is free. Code: `level` is ignored (the pool is created at level 5).
   */
  spawnAdd(kind: EnemyKind, x: number, z: number, level: number): Enemy | null;
  /**
   * Brain → core signal; `bossPhase` passes the new phase (1..3) as the third argument. Code: core
   * forwards a 4th argument `b` too (no brain passes one; `_onSignal` drops it).
   */
  emit(event: BossSignal, e: Enemy, phase?: number, b?: unknown): void;
}

// -------------------------------------------------------------------------------------------------
// Enemy construction (§9.3; the data types `EnemyDef` … are in defs.js, §9.4)
// -------------------------------------------------------------------------------------------------

/** An enemy sprite sheet (`createEnemySheet(kind)`, shared by every sprite of the kind; §10.3). */
export type EnemySheet = ReturnType<typeof createEnemySheet>;

/**
 * The level `enemy` object an enemy belongs to (ObjectCatalog `enemy`, COMBAT.md §14.1; members
 * documented in engine/level/types.d.ts). Every field is optional here because the Enemy reads
 * only `id` and `radius` (the home radius: wander area, leash slack, flier clamp); the enemies
 * sandbox passes just those. Core and `BossArena` take the full `LevelObjectOf<'enemy'>`.
 */
export type EnemyGroup = Partial<LevelObjectOf<'enemy'>>;

/** `createEnemy(init)` / `new Enemy(init)` (COMBAT.md §9.3). */
export interface EnemyInit {
  /** `<groupId>#<index>` (adds: `<bossUid>:add#<i>`). */
  uid: string;
  /** The level `enemy` object (adds: the boss's); may be null. */
  group: EnemyGroup | null;
  /** Index within the group. */
  index: number;
  /** Its kind: brain, sheet and stats. */
  kind: EnemyKind;
  /** Enemy level 1..10 (`def.level`; adds: 5). */
  level: number;
  /** An elite (gold name plate and shimmer; `def` carries the multipliers). */
  elite: boolean;
  /** Display name (the group's name plate or the kind's name); '' = `def.name`. */
  name: string;
  /** Start spot (world). */
  home: PointXZ;
  /** `scaledDef(kind, level, elite)`. */
  def: ScaledEnemyDef;
  /** The kind's shared sheet. */
  sheet: EnemySheet;
  /** This enemy's sprite (`combatFx: true`); `e.position` is its position. */
  sprite: Sprite3D;
  /** The enemy's seeded RNG (`hashString(uid) ^ seed`). */
  rng: RNG;
  /** A boss add (pooled, hidden until spawned). */
  isAdd: boolean;
  /** Golem: its arena; null for every other kind. */
  arena: EnemyArena | null;
  /** Hit-tag slot (§27.13 R6): core passes creation index + 1; absent: derived from the uid. */
  tagSlot?: number;
}

// -------------------------------------------------------------------------------------------------
// Brains (ai/*.js) and hazards
// -------------------------------------------------------------------------------------------------

/** The boss's moves (§8.2; `boss.force(move)`). */
export type BossMove = 'slam' | 'sweep' | 'toss' | 'rain' | 'charge';

/**
 * An enemy brain (`ai/<kind>.js`, registry `ai/index.js` `BRAINS`): a plain object the Enemy calls
 * into; brains touch the world only through the context, the Enemy helpers and `e.rng`. Every
 * member is optional in the type; in practice a non-boss brain has `engage` and `attack` (the
 * Enemy calls them unguarded) and the boss brain has `update`.
 */
export interface Brain {
  /** Construction and every reset: the per-enemy brain state (`e.ai`). */
  init?(e: Enemy): any;
  /** State `idle` instead of the default wander. */
  idle?(e: Enemy, h: number, ctx: CombatContext): void;
  /** State `engage`: archetype movement; starts attacks (`e.setState('windup')`). */
  engage?(e: Enemy, h: number, ctx: CombatContext): void;
  /** States `windup` / `active` / `recover`: the current attack's timeline. */
  attack?(e: Enemy, h: number, ctx: CombatContext): void;
  /** State `stun` (boar wall stun). */
  stun?(e: Enemy, h: number, ctx: CombatContext): void;
  /** Interrupt, return, death, reset: drop attack-local state (no ctx on a context-less reset). */
  cancel?(e: Enemy, ctx?: CombatContext): void;
  /** `receiveHit` when neither guarded nor walking home: kind reactions (dummy wobble, boss poise). */
  onHit?(e: Enemy, info: HitInfo, ctx: CombatContext): void;
  /** `die`: the kind's death look. */
  die?(e: Enemy, ctx: CombatContext): void;
  /** Every sub-step: write `uGlow` [r, g, b, a] into `out`. */
  glow?(e: Enemy, out: number[]): void;
  /** Boss only: drives every state itself. */
  update?(e: Enemy, h: number, ctx: CombatContext): void;
  /** Golem test hook `boss.force(move)` (§27.13 R7): only `move` may be picked next; null: none. */
  force?(e: Enemy, move: BossMove | null): void;
  /** Golem test hook `boss.info()`: the move in progress, a pending approach, the charge skid. */
  info?(e: Enemy): { move: BossMove | null; pending: BossMove | null; skid: boolean };
  /** Golem test hook `bossPhase(n)` / `Enemy.setPhase`: jump to phase n, signals `bossPhase`. */
  jumpPhase?(e: Enemy, n: number, ctx: CombatContext): void;
}

/** Hazard types (`Enemy` delayed effects). */
export type HazardType = 'circle' | 'ring' | 'magma' | 'fade';

/**
 * A delayed effect that outlives the attack (`Enemy.hazardCircle` / `hazardVisual` / `hazardRing`
 * / `hazardMagma` / `markToFade`; pooled records freed on death / return / reset). Brains set the
 * hit fields on the returned record (`mv`, `kb`, `knockdown`, `burst`, `burstN`, `sfx`).
 */
export interface EnemyHazard {
  /** In use (pooled records are reused). */
  on: boolean;
  /** Which update runs it: a filling circle, a growing ring, a magma pool, a marker fade-out. */
  type: HazardType;
  /** Its marker handle (−1: none). */
  h: number;
  /** Seconds since it started (after `delay`). */
  t: number;
  /** Seconds before it appears. */
  delay: number;
  /** Fill / life time (s). */
  dur: number;
  /** Centre x (a tracking circle: the offset from the player until it appears). */
  x: number;
  /** Centre z (see x). */
  z: number;
  /** Radius (ring: the start radius of the record, see `r0`). */
  r: number;
  /** Motion value of its hit (circle, ring). */
  mv: number;
  /** Knockback strength of its hit. */
  kb: number;
  /** Its hit knocks the player down. */
  knockdown: boolean;
  /** Magma: flat damage per tick. */
  flat: number;
  /** Ring: the target's radius counts as 0. */
  thin: boolean;
  /** Circle: (x, z) is an offset from the player's position when it appears. */
  track: boolean;
  /** Circle: clamp the start point into this rect. */
  clamp: RectXZ | null;
  /** Circle: telegraph only (a projectile resolves the hit). */
  visualOnly: boolean;
  /** Circle: the hit was registered at full fill (the record lives 5 f more for the rim flash). */
  resolved: boolean;
  /** The first update after `delay` ran: marker allocated (a circle: tracked and clamped). */
  started: boolean;
  /** Particle burst preset at resolution (circle). */
  burst: string | null;
  /** Particles of that burst (0: 10). */
  burstN: number;
  /** Sound at resolution. */
  sfx: SfxName | null;
  /** Hit tag of the circle / ring (one hit per target); magma draws a new tag per tick. */
  tag: number;
  /** Ring: start radius. */
  r0?: number;
  /** Ring: end radius (the record ends past it). */
  rMax?: number;
  /** Ring: growth (u/s). */
  speed?: number;
  /** Ring: band width (inner radius = r − width). */
  width?: number;
  /** Magma: tick period (s). */
  tick?: number;
  /** Magma: ticks done. */
  n?: number;
}

/** A snapshot of a live hazard (`Enemy.hazardList`, the `boss.hazards()` hook). */
export interface HazardSnapshot {
  /** The hazard's type. */
  type: HazardType;
  /** Centre x. */
  x: number;
  /** Centre z. */
  z: number;
  /** Current radius (a ring's grows). */
  r: number;
  /** Inner radius (rings; 0 otherwise). */
  rInner: number;
  /** Seconds left before it appears. */
  delay: number;
  /** Seconds since it appeared. */
  t: number;
  /** Fill / life time (s). */
  dur: number;
  /** Motion value of its hit. */
  mv: number;
  /** Knockback strength of its hit. */
  kb: number;
}

// -------------------------------------------------------------------------------------------------
// Test hooks (`window.__game.combat`, §20.1) and state (§20.2)
// -------------------------------------------------------------------------------------------------

/** Virtual combat actions (`bindings.js` `COMBAT_ACTIONS`); another name is refused (false). */
export type CombatAction = 'dodge' | 'skill1' | 'skill2' | 'skill3' | 'attack' | 'draught' | 'lock';

/** The boss part of `CombatState` (null on a level without a golem). */
export interface CombatBossState {
  /** The boss's enemy uid. */
  uid: string;
  /** HP (rounded up). */
  hp: number;
  /** Max HP. */
  hpMax: number;
  /** Phase 1..3 (during the fight: the highest reached). */
  phase: number;
  /** Its `Enemy.state`. */
  state: EnemyState;
  /** Broken (the boss's `stagger`). */
  broken: boolean;
  /** Killed (the defeat stays recorded after a respawn). */
  defeated: boolean;
  /** Combat seconds since the intro (the last fight's when over). */
  fightTime: number;
  /** Seconds spent in phases 1..3. */
  phaseTimes: number[];
}

/** `CombatSystem.state()`, the `state()` hook and `Game.state().combat` (§20.2). */
export interface CombatState {
  /** The player's combat stats and action (PlayerCombat). */
  player: {
    /** HP (rounded up). */
    hp: number;
    /** Max HP (level and upgrades). */
    hpMax: number;
    /** MP (3 decimals). */
    mp: number;
    /** Max MP. */
    mpMax: number;
    /** Stamina (SP, 3 decimals): attacks and dodges spend it. */
    sp: number;
    /** Max SP. */
    spMax: number;
    /** Player level. */
    level: number;
    /** XP gathered towards the next level. */
    xp: number;
    /** XP the next level needs. */
    xpNext: number;
    /** Gold carried. */
    gold: number;
    /** Healing Draughts carried. */
    potions: number;
    /** Attack (level and upgrades). */
    atk: number;
    /** Defence (level and upgrades). */
    def: number;
    /** PlayerCombat action or null. */
    action: string | null;
    /** Frame of the current action (0 without one). */
    actionFrame: number;
    /** I-frames now (dodge window, respawn grace, or `god`). */
    invulnerable: boolean;
    /** Combo step of the current / last attack (1..3; 0: none). */
    combo: number;
    /** SP ran out: attack recovery runs 1.35× longer until SP is back at 30 (`WINDED_UNTIL`). */
    winded: boolean;
    /** Locked enemy uid or null. */
    lock: string | null;
    /** Checkpoint id ('spawn' or a waystone id). */
    checkpoint: string;
    /** Skill cooldowns (s) [s1, s2, s3]. */
    cooldowns: number[];
    /** Times the player fell. */
    deaths: number;
    /** Perfect dodges so far (§6.5). */
    perfectDodges: number;
  };
  /** In combat: an aggroed enemy within 16 u, or the boss fight (drives the music and HUD; §6.12). */
  engaged: boolean;
  /** Combat clock (s). */
  time: number;
  /** Combat sub-step counter. */
  frame: number;
  /** The combat RNG seed (default `hashString(level.name)`; the `seed(n)` hook sets it). */
  seed: number;
  /** Enemies killed (dummies excluded). */
  kills: number;
  /** The boss was defeated. */
  bossDefeated: boolean;
  /** `input.lastDevice` ('keyboard' | 'mouse' | 'gamepad'). */
  device: string;
  /**
   * Hidden adds excluded, and the foes of the groups the story has taken away (counted in `absent`
   * only: STORY_SCRIPT.md §9.5).
   */
  enemies: { total: number; alive: number; active: number; aggro: number; absent: number };
  /** The boss, or null without one. */
  boss: CombatBossState | null;
  /** Live projectiles. */
  projectiles: number;
  /** Live ground markers. */
  markers: number;
  /** Live pickups. */
  pickups: number;
  /** Live named effects (`CombatFx`). */
  fx: number;
  /** Off-screen enemy arrows shown at the screen edge (at most 8). */
  edgeArrows: number;
  /** Token budget in use. */
  tokens: { melee: number; ranged: number };
  /** An input guard is active. */
  guards: { resume: boolean; respawn: boolean };
  /** The drillmaster's tutorial: a full combo on a dummy, a dodge, the reward given. */
  tutorial: { combo: boolean; dodge: boolean; rewarded: boolean };
  /** Ids of the one-time wares bought (§27.19 W3). */
  shop: { purchased: string[] };
  /** The party's companions fighting here (§28; the key only once one was added). */
  allies?: AllyState[];
}

/**
 * A companion's running action (`MemberCombat.action`, §28): the warden's thrusts `a1` / `a2`
 * and `sweep`, the ranger's `shot` / `volley`, the mystic's `bolt` / `flare`, `mend`, the dodge
 * `roll`, `hurt` (hit stun), `knock` (knockdown), `getup` (after being down).
 */
export type AllyAction = 'a1' | 'a2' | 'sweep' | 'shot' | 'volley' | 'bolt' | 'flare' | 'mend' | 'roll' | 'hurt' | 'knock' | 'getup';

/** A companion's state (`MemberCombat.info()`: the `allies()` hook, `state().combat.allies`; §28). */
export interface AllyState {
  /** The member's id (its villager's). */
  id: string;
  /** Display name. */
  name: string;
  /** Its class: 'warden' | 'ranger' | 'mystic'. */
  cls: string;
  /** The preset its rule matches, or 'custom'. */
  preset: string;
  /** The party's level (the player's). */
  level: number;
  /** HP (rounded up; 0 while down). */
  hp: number;
  hpMax: number;
  /** MP (3 decimals). */
  mp: number;
  mpMax: number;
  /** ATK and DEF at the party's level (3 decimals). */
  atk: number;
  def: number;
  /** HP 0: it lies down until the fight is over. */
  down: boolean;
  /** The combat drives it now (else the follow). */
  active: boolean;
  /** What its AI does: 'idle' (the follow), 'hold', 'attack', 'retreat', 'heal', 'evade', 'wait' (a closed arena), 'down', 'stop' (the player fell). */
  mode: string;
  /** Its running action, or null. */
  action: AllyAction | null;
  /** The frame of the action. */
  actionFrame: number;
  /** The uid of the foe it goes for, or null. */
  target: string | null;
  /** Live foes that have it as their target. */
  targetedBy: number;
  /** Foes it killed. */
  kills: number;
  /** Position (3 decimals). */
  x: number;
  z: number;
  /** Enemy hits pass through it now. */
  invulnerable: boolean;
  /** Seconds left: the next basic attack, the skill, Mend, the roll. */
  cooldowns: { attack: number; skill: number; heal: number; roll: number };
  /** Counters since its fight began (or the `reset` hook). */
  counts: {
    attacks: number; hits: number; crits: number; skills: number; heals: number; healed: number;
    rolls: number; hurts: number; damageDealt: number; damageTaken: number; downs: number;
  };
}

/** `CombatSystem.stats()` / the `stats()` hook. */
export interface CombatStats {
  /** `renderer.info.programs.length` now. */
  programs: number;
  /** The program count after the combat warm-up (must equal `programs` after a fight). */
  programsAtLoad: number;
  /** Scene draw calls of the last frame (PostFX `sceneInfo`). */
  drawCalls: number;
  /** Combat tick time, median (ms, last 240 frames). */
  tickMsP50: number;
  /** Combat tick time, 95th percentile (ms, last 240 frames). */
  tickMsP95: number;
  /** Entries in use per pool (`fx`: FxQuads quads, effects and pickups alike). */
  pools: { fx: number; markers: number; projectiles: number; pickups: number };
  /** Walk-grid counters (`Nav.stats`) plus its cell count and build time (§27.13 R1). */
  nav: {
    /** Path searches run. */
    searches: number;
    /** Searches that found a path. */
    found: number;
    /** Searches that failed (no path within the bounds: "unreachable"). */
    failed: number;
    /** Cells expanded, all searches together. */
    expanded: number;
    /** Most cells one search expanded. */
    maxExpanded: number;
    /** Open cells (an enemy may stand there). */
    open: number;
    /** Tight cells (open, but an enemy's body does not fit on the centre). */
    tight: number;
    /** Grid cells (cols × rows, 0.5 u each). */
    cells: number;
    /** Build time of the grid at load (ms). */
    buildMs: number;
  };
}

/** A row of the `enemies()` hook (hidden adds excluded). */
export interface CombatEnemyRow {
  /** Enemy uid. */
  uid: string;
  /** Its kind. */
  kind: EnemyKind;
  /** HP (rounded up). */
  hp: number;
  /** Max HP. */
  hpMax: number;
  /** Its `Enemy.state`. */
  state: EnemyState;
  /** Position x (3 decimals). */
  x: number;
  /** Position z (3 decimals). */
  z: number;
  /** Has noticed the player. */
  aggro: boolean;
  /** Not updated (far away and not aggroed, §7.5). */
  dormant: boolean;
  /** Its zone's region id, or null (§27.13 R5). */
  zone: string | null;
}

/** The `boss.info()` hook. */
export interface CombatBossInfo {
  /** The boss's uid. */
  uid: string;
  /** Its `Enemy.state`. */
  state: EnemyState;
  /** Frames spent in the state. */
  t: number;
  /** Phase 1..3. */
  phase: number;
  /** Not dead. */
  alive: boolean;
  /** Live hazard count. */
  hazards: number;
  /** The move in progress (null: none). */
  move?: BossMove | null;
  /** A move waiting for its approach walk to end (null: none). */
  pending?: BossMove | null;
  /** The charge ended at the arena edge: the 45 f skid (open, no vulnerability). */
  skid?: boolean;
}

/** `setPlayer(o)` fields (each optional). */
export interface CombatPlayerSettings {
  /** HP (capped at max). */
  hp?: number;
  /** MP (capped at max). */
  mp?: number;
  /** SP (capped at max). */
  sp?: number;
  /** Player level. */
  level?: number;
  /** XP towards the next level. */
  xp?: number;
  /** Gold carried. */
  gold?: number;
  /** Healing Draughts carried. */
  potions?: number;
  /** Upgrade totals to replace (refills HP / MP; §27.19 W2). */
  upgrades?: { maxHp?: number; maxMp?: number; attack?: number; def?: number };
}

/**
 * `window.__game.combat` on a combat level (`makeHooks`, `hooks.js`; COMBAT.md §20.1,
 * docs/specs/AUTOMATION_API.md §3). Uids: an enemy uid or 'all' where noted.
 */
export interface CombatHooks {
  /** `CombatState` (§20.2). */
  state(): CombatState;
  /** Reseed the combat RNG, every enemy RNG and the loot seed; the seed used (uint32). */
  seed(n: number): number;
  /** Full reset to a reproducible state (chests stay); the new state. */
  reset(): CombatState;
  /** Stop the loop, run n frames of dt, restart it if it ran; the state after. */
  step(n?: number, dt?: number): CombatState;
  /** Step until `pred(hooks)` holds → frames stepped (0: at once), −1: it never did (§27.13 R7). */
  stepUntil(pred: (hooks: CombatHooks) => boolean, maxFrames?: number, dt?: number): number;
  /** A virtual press held `frames` frames (1); a name not a `CombatAction` is refused (false). */
  press(action: CombatAction | (string & {}), frames?: number): boolean;
  /** A virtual hold (30 frames). */
  hold(action: CombatAction | (string & {}), frames?: number): boolean;
  /** World-space move override (null: real input); the override set. */
  move(x: number | null, z?: number): PointXZ | null;
  /** Aim-point override like the mouse (null: off); the override set. */
  aim(x: number | null, z?: number): PointXZ | null;
  /** Move an enemy and its home (uid or 'all'); false: no such enemy. */
  place(uid: string, x: number, z: number): boolean;
  /** Force aggro (uid or 'all'). */
  wake(uid: string): boolean;
  /** Kill through the normal path: XP, loot, events (uid or 'all'). */
  kill(uid: string): boolean;
  /** Deal n damage (no RNG, no floors; uid or 'all'). */
  damage(uid: string, n: number): boolean;
  /** Direct player damage (ignores i-frames and god): HP left, false when already dead. */
  damagePlayer(n: number): number | false;
  /** Set player values; the player part of the state. */
  setPlayer(o?: CombatPlayerSettings): CombatState['player'];
  /** No enemy hit reaches the player; the flag. */
  god(on?: boolean): boolean;
  /** Enemies stop updating (hits, deaths, fades and hit flashes go on); the flag. */
  freezeAI(on?: boolean): boolean;
  /** Jump the boss to phase n (HP lowered to its threshold); its phase, null without a live boss. */
  bossPhase(n: number): number | null;
  /** Boss test control (§27.13 R7). */
  boss: {
    /** Only `move` may be picked next (null: none); false without a live boss. */
    force(move: BossMove | null): boolean;
    /** Its state and move; null without a boss. */
    info(): CombatBossInfo | null;
    /** Snapshots of its live hazards. */
    hazards(type?: HazardType): HazardSnapshot[];
  };
  /** A walk-grid path `[[x, z], …]` (null: none within `maxU` u; 80). */
  path(x0: number, z0: number, x1: number, z1: number, maxU?: number): number[][] | null;
  /** Set the boss's HP fraction (no floors); its HP, null without a boss. */
  setBossHp(frac: number): number | null;
  /** Attune a waystone ('spawn': the level start); its id, null when unknown. */
  checkpoint(id: string): string | null;
  /** Rest at once at `id` (or the current checkpoint); false when unknown. */
  rest(id?: string): boolean;
  /** The death reset at once (no screen); the new state. */
  respawn(): CombatState;
  /** Fire every effect, marker, projectile, pickup, burst and SFX once: the counts. */
  showcase(): { fx: number; markers: number; projectiles: number; pickups: number };
  /** Every enemy (hidden adds excluded). */
  enemies(): CombatEnemyRow[];
  /** Performance and pool figures (`CombatStats`). */
  stats(): CombatStats;
  /** The CombatSystem itself (§27.6 C3). */
  system: CombatSystem;
  /** Every companion's state, join order (§28; [] without a party). */
  allies(): AllyState[];
  /** n damage to a companion (member id or name; no RNG or reaction; 0 HP: down) → its HP, null: none. */
  allyHurt(id: string, n: number): number | null;
  /** Whom enemy `uid` fights ('player' or a companion's id; null: no such enemy); `who` sets it first ('player' / null: the player). */
  allyTarget(uid: string, who?: string | null): string | null;
  /** Set a companion's { hp, mp } (hp 0: down) → its state, null: none. */
  allySet(id: string, o?: { hp?: number; mp?: number }): AllyState | null;
  /** No enemy hit reaches a companion; the flag. */
  allyGod(on?: boolean): boolean;
  /** Every companion full and up (the story's `heal`) → how many. */
  healAllies(): number;
}

// -------------------------------------------------------------------------------------------------
// Core records (CombatSystem, PlayerCombat, Hitboxes, Projectiles; not part of §9)
// -------------------------------------------------------------------------------------------------

/**
 * `PlayerCombat.action` (null: locomotion): every combo step is 'attack'; the skills are their
 * slot ids.
 */
export type PlayerAction =
  | 'attack' | 'roll' | 'backstep' | 'skill1' | 'skill2' | 'skill3' | 'draught'
  | 'hitstun' | 'knockdown' | 'dead';

/** Chest / boss-core / shop upgrades (`PlayerCombat.upgrade`; `def` has no default amount). */
export type UpgradeKind = 'maxHp' | 'maxMp' | 'attack' | 'core' | 'def';

/** Hit metadata carried next to a player HitSpec (`PlayerCombat.js` `PLAYER_HIT_META`). */
export interface PlayerHitMeta {
  /** `HitInfo.source` of the hit. */
  source: 'melee' | 'skill' | 'projectile';
  /** Hit-stop base (frames) before the crit / kill bonus (`playerHitStop`). */
  stop: number;
  /** The combo finisher (A3): crit chance +0.10, the finisher shake. */
  finisher: boolean;
  /** Combo step 1..3 (0: not a combo swing; step 3 on a dummy counts for the tutorial). */
  combo: number;
}

/** One player swing: its hit tag and the MP it gained so far (`PlayerCombat.onMeleeLanded`). */
export interface SwingRecord {
  /** The swing's hit tag (`TagRegistry.next()`). */
  tag: number;
  /** MP gained by this swing (at most `MP_PER_SWING_MAX`). */
  mp: number;
}

/** A registered hitbox of the current sub-step (`HitQueue.items`). */
export interface QueuedHit {
  /** The attacker (a companion's hitboxes: the MemberCombat, `allyHits`); null for a free pool record. */
  owner: Enemy | 'player' | MemberCombat | null;
  /** The pooled copy of the spec, every field filled (`Hitboxes.js` DEFAULTS). */
  spec: Required<HitSpec>;
  /** Player hits: `CombatSystem.addPlayerHit` writes the meta entry. */
  meta?: PlayerHitMeta;
  /** Player hits: the swing's MP record (null: skills). */
  swing?: SwingRecord | null;
}

/** A pooled projectile (`Projectiles.items`); the core's contact and landing code reads it. */
export interface LiveProjectile {
  /** In flight (pooled records are reused). */
  alive: boolean;
  /** The shooter; 'fx': a showcase shot that touches nothing; a companion's shot: the companion; null: free. */
  owner: Enemy | 'player' | 'fx' | MemberCombat | null;
  /** A player shot (tests the enemies; player time scale) — a companion's shots too. */
  player: boolean;
  /** A party companion's shot: the companion (`Projectiles.spawn(owner, spec, ally)`), else null. */
  ally: MemberCombat | null;
  /** Look, sound and flight rules. */
  kind: ProjectileKind;
  /** Position x. */
  x: number;
  /** Position y (absolute). */
  y: number;
  /** Position z. */
  z: number;
  /** Unit horizontal direction x. */
  dirX: number;
  /** Unit horizontal direction z. */
  dirZ: number;
  /** Vertical speed (u/s). */
  vy: number;
  /** Horizontal speed (u/s). */
  speed: number;
  /** Horizontal range (u). */
  range: number;
  /** Horizontal distance flown. */
  traveled: number;
  /** Collision radius. */
  radius: number;
  /** Motion value of its hit. */
  mv: number;
  /** Knockback strength of its hit. */
  kb: number;
  /** Poise damage of its hit. */
  poise: number;
  /** Flies on through the first target. */
  pierce: boolean;
  /** Splash on impact (Ember Bolt) or null. */
  splash: Splash | null;
  /** The splash's own hit tag (0: none). */
  splashTag: number;
  /** Arc flight (boulder): `_arc` while it flies an arc, else null. */
  arc: Required<ArcFlight> | null;
  /** Launch point x (arc flight). */
  sx: number;
  /** Launch height (arc flight). */
  sy: number;
  /** Launch point z (arc flight). */
  sz: number;
  /** Ground height at the arc's landing point. */
  ty: number;
  /** Seconds of arc flight. */
  t: number;
  /** Its hit tag (`TagRegistry.next()`). */
  tag: number;
  /** Its FxQuads handle (−1: none). */
  h: number;
  /** Seconds since launch (frame animation). */
  age: number;
  /** Launch counter. */
  serial: number;
  /** The record's own arc object (`arc` points to it while arcing). */
  _arc: Required<ArcFlight>;
}

/**
 * A projectile contact of the current sub-step (`CombatSystem._contacts`, pooled; filled by
 * `queueProjectileHit`, resolved in order by `_resolve`).
 */
export interface ProjectileContact {
  /** Code: never written (always null; the pool record's initial field). */
  p: LiveProjectile | null;
  /** What it touched: an enemy (player shots), 'player' or a party companion (enemy shots). */
  target: Enemy | 'player' | MemberCombat | null;
  /** Contact point x. */
  x: number;
  /** Contact height. */
  y: number;
  /** Contact point z. */
  z: number;
  /** The shot's unit direction x (knockback). */
  dirX: number;
  /** The shot's unit direction z. */
  dirZ: number;
  /** Motion value of the hit. */
  mv: number;
  /** Knockback strength of the hit. */
  kb: number;
  /** Poise damage of the hit. */
  poise: number;
  /** The shot's hit tag. */
  tag: number;
  /** The shooter (never 'fx': showcase shots touch nothing; a companion's shot: the companion). */
  owner: Enemy | 'player' | MemberCombat | null;
  /** Splash on impact (Ember Bolt) or null. */
  splash: Splash | null;
  /** The splash's hit tag. */
  splashTag: number;
  /** The projectile kind ('' on a fresh pool record). */
  kind: ProjectileKind | '';
  /** A player shot (a companion's shots are player shots too). */
  player: boolean;
  /** A party companion's shot: the companion (its ATK, its RNG; PARTY.md §5.2), else null. */
  ally: MemberCombat | null;
}

// -------------------------------------------------------------------------------------------------
// Fields created lazily or from other modules (declared here: declaring them in the classes would
// change the code)
// -------------------------------------------------------------------------------------------------

declare module './Enemy.js' {
  interface Enemy {
    /** CombatSystem: combat clock of the last damage or heal (the HP bar shows for 4 s after it). */
    _barT?: number;
    /** CombatSystem: enemy time of the last hit on a dummy (its HP refills 120 f later). */
    _refillFrom?: number;
    /** CombatSystem: a boss add's boss (`_createAdds`). */
    _boss?: Enemy;
    /** CombatSystem `_updateLabels`: distance to the player this frame (bar / arrow order). */
    _barD?: number;
    /** CombatSystem `_updateLabels`: 0 nothing, 1 HP bar, 2 aggro pip. */
    _barMode?: number;
    /** CombatSystem `_updateLabels`: the frame stamp of the enemies that get a bar slot. */
    _barPick?: number;
    /** Targeting `_gather`: the body middle's NDC x (lock order). */
    _ndcX?: number;
    /** Targeting `_gather`: distance to the player (lock order). */
    _lockDist?: number;
  }
}

declare module './CombatSystem.js' {
  interface CombatSystem {
    /** `los`: reused collider query list. */
    _losCs?: TileMap['colliders'];
    /** `_blockKind`: reused collider query list. */
    _blkCs?: TileMap['colliders'];
    /** `_moveGround`: reused `tileMap.move` result. */
    _moveOut?: PointXZ;
    /** `_hitEnemy`: the one HitInfo record passed to `e.receiveHit`. */
    _info?: HitInfo;
    /** `queueLanding`: the arc projectile's landing hitbox. */
    _landSpec?: HitSpec;
    /** `_dropLoot`: the reused `rollLoot` result. */
    _loot?: LootRoll;
    /** `dropGold`: the reused `splitCoins` records. */
    _coins?: { kind: string; amount: number }[];
    /** `_separation`: the enemies taking part this frame. */
    _act?: Enemy[];
    /** `_updateLabels`: enemies that want an HP bar or a pip. */
    _barCands?: Enemy[];
    /** `_updateLabels`: aggroed enemies off screen (edge arrows). */
    _edgeCands?: Enemy[];
    /** `_updateLabels`: the enemy holding each of the 32 bar slots. */
    _barOf?: (Enemy | null)[];
    /** `_updateLabels`: the reused bar options. */
    _barOpts?: { elite: boolean; level: number; name: string; pip: boolean };
    /** `_updateLabels`: the enemy of each of the 8 edge arrows. */
    _edgeOf?: (Enemy | null)[];
    /** `_updateLabels`: the reused edge-arrow options. */
    _edgeOpts?: { windup: boolean };
    /** `_allyHitEnemy`: the HitInfo record of a companion's hits. */
    _allyInfo?: HitInfo;
    /** `_allySeparation`: the companions taking part this frame. */
    _allySep?: MemberCombat[];
  }
}

declare module './Nav.js' {
  interface Nav {
    /** CombatSystem `load`: build time of the grid (ms), for `stats().nav`. */
    buildMs?: number;
  }
}
