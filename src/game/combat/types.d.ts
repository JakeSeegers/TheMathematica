// Shared types of the combat level's world pieces (src/game/combat/: the waystones, chests,
// pickups, boss arena, FX and markers the turn-based GLAIVE combat reuses; docs/specs/GLAIVE.md).
// Types only: nothing here reaches a bundle. The fight's own types live in src/game/glaive/
// (JSDoc typedefs in Encounter.js).

import type { Rect } from '../../engine/level/types.js';
import type { EnemyKind, EnemyDef } from './defs.js';
import type { COMBAT_BINDINGS, COMBAT_PAD_BINDINGS } from './bindings.js';

declare module '../../engine/core/types.js' {
  /** The combat actions GlaiveCombat binds (`input.addBindings(COMBAT_BINDINGS, COMBAT_PAD_BINDINGS)`). */
  interface ExtraActions extends Record<keyof typeof COMBAT_BINDINGS | keyof typeof COMBAT_PAD_BINDINGS, true> {}
}

export type { EnemyKind, EnemyDef };

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

/** Options of a positional combat sound (`ctx.sfx`, `GlaiveCombat.sfxAt`). */
export interface SfxOptions {
  /** Multiplies the distance attenuation (1). */
  volume?: number;
  /** Multiplies the ±4 % hashed pitch jitter (1). */
  pitch?: number;
}

/** Ground-marker shapes (`GroundMarkers`, §11.2). */
export type MarkerShape = 'circle' | 'ring' | 'sector' | 'lane' | 'rect';

/** Ground-marker styles (§11.2). */
export type MarkerStyle = 'enemy' | 'player' | 'lock' | 'barrier' | 'magma';

/**
 * A telegraph / decal on the draped ground (`GroundMarkers.set`, §9.5, §11.2). Core keeps a full
 * copy per handle (`MARKER_DEFAULTS` in GlaiveCombat.js); `ctx.marker` / `ctx.setMarker` copy only
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
  deathBursts?(boss: any): void;
}
