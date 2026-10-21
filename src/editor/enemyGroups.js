/**
 * Enemy groups in the editor (COMBAT.md §14.1, §17) — the helpers the 2D map, the 3D view, the
 * select tool, the inspector and the level checks share. Three-free, so the 2D map and the app
 * use them without loading the 3D view.
 *
 *  - kind / boss tests, the relative `arena` / `gate` fields and their world rect / segment;
 *    only the boss kind's arena and gate exist in the game (`CombatSystem` builds a `BossArena`
 *    for `golem` groups only), so the views draw and edit `bossArena` / `bossGate`;
 *  - how far a gate lies off its arena's edge (`gateEdgeGap`);
 *  - a boss asking for more than the one member the game spawns (`bossExtraCount`,
 *    `clampBossCount`);
 *  - the combat spawn's start test on level data (`levelStartTest`) and the rect a group
 *    scatters over (`enemyScatterRect`); `Viewport3D.enemyStartTest` feeds it the props'
 *    colliders (their builds) while that view is hidden, and has the exact one (built colliders
 *    and deck heights) while it is shown.
 */
import { ENEMY_KINDS, ENEMY_INFO } from '../engine/level/ObjectCatalog.js';
import { isWalkablePoint, tileDef } from '../engine/level/LevelFormat.js';

/**
 * @import { Level, LevelObject } from '../engine/level/types.js'
 * @import { CircleCollider, BoxCollider } from '../engine/world/TileMap.js'
 */

/**
 * A known enemy kind ('slime' for anything else). The editor previews an unknown kind as slimes;
 * the game spawns nothing for it (CombatSystem._spawnGroup: no enemy sheet).
 */
export const enemyKind = (o) => (ENEMY_KINDS.includes(o?.kind) ? o.kind : 'slime');

/** Is `o` an enemy group of the boss kind (the only kind whose `arena` / `gate` the game uses)? */
export const isBossGroup = (o) => o?.type === 'enemy' && !!ENEMY_INFO[enemyKind(o)]?.boss;

/** The relative `arena` rect of an enemy group (any kind), or null when absent / malformed. */
export function arenaOf(o) {
  const a = o?.type === 'enemy' ? o.arena : null;
  return a && ['minX', 'maxX', 'minZ', 'maxZ'].every((k) => Number.isFinite(a[k])) ? a : null;
}

/** The relative `gate` [dx0, dz0, dx1, dz1] of an enemy group (any kind), or null. */
export function gateOf(o) {
  const g = o?.type === 'enemy' ? o.gate : null;
  return Array.isArray(g) && g.length >= 4 && g.slice(0, 4).every(Number.isFinite) ? g : null;
}

/**
 * World rect of an enemy group's `arena` (relative + x / z; any kind), or null.
 * @param {LevelObject} o enemy level object
 */
export function enemyArena(o) {
  const a = o?.arena;
  if (!a || !['minX', 'maxX', 'minZ', 'maxZ'].every((k) => Number.isFinite(a[k]))) return null;
  const x = Number(o.x) || 0;
  const z = Number(o.z) || 0;
  return { minX: x + Math.min(a.minX, a.maxX), maxX: x + Math.max(a.minX, a.maxX), minZ: z + Math.min(a.minZ, a.maxZ), maxZ: z + Math.max(a.minZ, a.maxZ) };
}

/**
 * World segment [x0, z0, x1, z1] of an enemy group's `gate` (relative + x / z; any kind), or null.
 * @param {LevelObject} o enemy level object
 */
export function enemyGate(o) {
  const g = o?.gate;
  if (!Array.isArray(g) || g.length < 4 || !g.slice(0, 4).every(Number.isFinite)) return null;
  const x = Number(o.x) || 0;
  const z = Number(o.z) || 0;
  return [x + g[0], z + g[1], x + g[2], z + g[3]];
}

/** World rect of the boss arena the game builds (boss kind only), or null. */
export const bossArena = (o) => (isBossGroup(o) ? enemyArena(o) : null);

/** World segment of the boss gate the game builds (boss kind only), or null. */
export const bossGate = (o) => (isBossGroup(o) ? enemyGate(o) : null);

/**
 * How many more members than the one the game spawns a boss group asks for (`count`, else its
 * `spotOffsets`): `enemyStartPoints` takes a single golem, so a boss `count` above 1 is ignored.
 * 0 for other kinds and for a boss asking for one (or none).
 * @param {LevelObject} o enemy level object
 */
export function bossExtraCount(o) {
  if (!isBossGroup(o)) return 0;
  const n = Number(o.count);
  const asked = o.count != null && o.count !== '' && Number.isFinite(n) ? Math.round(n)
    : Array.isArray(o.spotOffsets) ? o.spotOffsets.length : 0;
  return Math.max(0, asked - 1);
}

/**
 * Keep a boss group's `count` at 1 (the inspector clamps it when an edit makes a group the boss
 * or sets its Count; files keep what they hold — Check for problems names a boss asking for more).
 * @param {LevelObject} o enemy level object (changed in place)
 * @returns {boolean} whether it changed
 */
export function clampBossCount(o) {
  if (!isBossGroup(o) || !(Number(o.count) > 1)) return false;
  o.count = 1;
  return true;
}

/** Does a group that is not the boss carry an `arena` / `gate` (which the game ignores)? */
export const strayArena = (o) => o?.type === 'enemy' && !isBossGroup(o) && (!!enemyArena(o) || !!enemyGate(o));

/** Distance from (x, z) to the boundary of the rect (inside or outside). */
export function rectEdgeDistance(r, x, z) {
  if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return Math.min(x - r.minX, r.maxX - x, z - r.minZ, r.maxZ - z);
  return Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));
}

/** A gate end farther than this from its arena's boundary is off the edge (a soft warning). */
export const GATE_EDGE_TOLERANCE = 0.5;

/**
 * How far the farther end of an enemy group's gate lies from its arena's boundary (0 = both on
 * the edge), or null without both. The game closes the ember wall along the gate and clamps the
 * player to the arena, so a gate off the edge leaves a wall that does not meet the barrier.
 * @param {LevelObject} o enemy level object
 */
export function gateEdgeGap(o) {
  const a = enemyArena(o);
  const g = enemyGate(o);
  if (!a || !g) return null;
  return Math.max(rectEdgeDistance(a, g[0], g[1]), rectEdgeDistance(a, g[2], g[3]));
}

/**
 * The world rect an enemy group's members start in (`enemyStartPoints`): its relative `area`,
 * else the home-radius square, grown by the group point and its `spotOffsets`.
 * @param {LevelObject} o enemy level object
 * @returns {{ minX: number, maxX: number, minZ: number, maxZ: number }}
 */
export function enemyScatterRect(o) {
  const x = Number(o.x) || 0;
  const z = Number(o.z) || 0;
  const R = Math.max(0.3, Number(o.radius) || 3);
  const a = o.area;
  const r = a && ['minX', 'maxX', 'minZ', 'maxZ'].every((k) => Number.isFinite(a[k]))
    ? { minX: x + Math.min(a.minX, a.maxX), maxX: x + Math.max(a.minX, a.maxX), minZ: z + Math.min(a.minZ, a.maxZ), maxZ: z + Math.max(a.minZ, a.maxZ) }
    : { minX: x - R, maxX: x + R, minZ: z - R, maxZ: z + R };
  const grow = (px, pz) => {
    r.minX = Math.min(r.minX, px); r.maxX = Math.max(r.maxX, px);
    r.minZ = Math.min(r.minZ, pz); r.maxZ = Math.max(r.maxZ, pz);
  };
  grow(x, z);
  if (Array.isArray(o.spotOffsets)) for (const p of o.spotOffsets) if (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) grow(x + p[0], z + p[1]);
  return r;
}

/** Radii of the colliders the level data fixes exactly: villagers (`Npc`), chests and waystones (`CombatProps`). */
const DATA_COLLIDER_R = { npc: 0.34, chest: 0.45, waystone: 0.5 };

/**
 * The colliders of a level that its data pins down exactly — circles at the villagers (r 0.34),
 * chests (0.45) and waystones (0.5). Every other prop's collider needs a build (the 3D view).
 * @param {Level} level
 * @returns {{ x: number, z: number, r: number }[]}
 */
export function dataColliders(level) {
  const out = [];
  for (const o of level.objects) {
    const r = DATA_COLLIDER_R[o.type];
    if (r && Number.isFinite(o.x) && Number.isFinite(o.z)) out.push({ x: o.x, z: o.z, r });
  }
  return out;
}

/**
 * The combat spawn's start test (`CombatSystem._spawnGroup`) on level data: walkers need
 * standable ground — a walkable tile or a bridge deck, never open water (`isWalkablePoint`) —
 * fliers may also start over water; both stay out of `colliders` (`dataColliders`, plus the
 * props' TileMap colliders when the caller has them: circles, and `type: 'box'` rects tested
 * like `TileMap` — strictly inside).
 * @param {Level} level
 * @param {boolean} flier
 * @param {((Omit<CircleCollider, 'type'> & { type?: 'circle' })|BoxCollider)[]} [colliders]
 *   circles (TileMap's have `type: 'circle'`, dataColliders' none) and boxes
 * @returns {(x: number, z: number) => boolean}
 */
export function levelStartTest(level, flier, colliders = dataColliders(level)) {
  const clear = (x, z) => {
    for (const c of colliders) {
      if (c.type === 'box' ? x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ : (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return false;
    }
    return true;
  };
  if (!flier) return (x, z) => isWalkablePoint(level, x, z) && clear(x, z);
  return (x, z) => {
    const d = tileDef(level, Math.floor(x), Math.floor(z));
    return (!!d && !d.void && !!d.water) || (isWalkablePoint(level, x, z) && clear(x, z));
  };
}
