/**
 * BossArena — the arena of one golem group (COMBAT.md §8.1): the group's relative `arena` rect and
 * `gate` segment in world space, `contains(x, z)`, and the closing ember wall. The golem's brain
 * reads it as `e.arena` ({ rect, gate, y, active, contains }); `close()` / `open()` are core-only.
 *
 * Closed: a row of `wallFlame` quads every 0.6 u along the gate (HDR (1.5, 0.75, 0.25), each flame
 * a little brighter / redder or yellower than its neighbours), a `barrier` rect-outline marker
 * around the arena and SFX `gateClose`; the core clamps the player inside the rect (inset 0.35)
 * until `open()`. (The contract's (2.6, 1.2, 0.4) clipped the ember wall to a white picket row and,
 * with the barrier outline, hazed the whole closed arena orange through bloom.) `deathBursts(boss)`
 * is the kill's particle burst, kept off the player (COMBAT-16). `present` is false while the story
 * has taken its boss's group away (an arena that closes nothing).
 */

/**
 * @import { EnemyArena } from './types.js'
 * @import { LevelObjectOf } from '../../engine/level/types.js'
 * @import { CombatSystem } from './CombatSystem.js'
 */

const FLAME_SPACING = 0.6;
const FLAME_COLOR = [1.5, 0.75, 0.25];

/** The golem's `e.arena` (./types.d.ts). @implements {EnemyArena} */
export class BossArena {
  /**
   * @param {LevelObjectOf<'enemy'>} group the golem `enemy`
   *   object (x, z, arena, gate)
   * @param {CombatSystem} sys the CombatSystem (groundAt, quads,
   *   markers, sfx)
   */
  constructor(group, sys) {
    this.sys = sys;
    this.groupId = group.id ?? '';
    const x = Number(group.x) || 0;
    const z = Number(group.z) || 0;
    const a = group.arena && ['minX', 'maxX', 'minZ', 'maxZ'].every((k) => Number.isFinite(group.arena[k]))
      ? group.arena
      : { minX: -8, maxX: 8, minZ: -6, maxZ: 6 };
    /** World rect. */
    this.rect = {
      minX: x + Math.min(a.minX, a.maxX), maxX: x + Math.max(a.minX, a.maxX),
      minZ: z + Math.min(a.minZ, a.maxZ), maxZ: z + Math.max(a.minZ, a.maxZ),
    };
    const g = Array.isArray(group.gate) && group.gate.length >= 4 && group.gate.every(Number.isFinite)
      ? group.gate
      : [-2, this.rect.maxZ - z, 2, this.rect.maxZ - z];
    /** World gate segment [x0, z0, x1, z1]. */
    this.gate = [x + g[0], z + g[1], x + g[2], z + g[3]];
    this.center = { x: (this.rect.minX + this.rect.maxX) / 2, z: (this.rect.minZ + this.rect.maxZ) / 2 };
    /** Floor height (the arena is one level). */
    this.y = sys.groundAt(this.center.x, this.center.z);
    /** Closed (the fight runs). */
    this.active = false;
    /**
     * Its boss's group is there as the story stands (core: `applyPresence`, STORY_SCRIPT.md §9.5).
     * An absent group's arena closes nothing: no exclusion of the other enemies, no walk-grid block,
     * no map marker.
     */
    this.present = true;
    /**
     * The gate's flame quads: handle, position, flicker phase, colour.
     * @type {{ h: number, x: number, z: number, phase: number, r: number, g: number, b: number }[]}
     */
    this._flames = [];
    this._barrier = -1;
    this._t = 0;
    this._p = { x: 0, y: 0, z: 0, frame: 'wallFlame', index: 0, scale: 1, rot: 0, mode: 'billboard', dirX: 0, dirZ: 1, r: FLAME_COLOR[0], g: FLAME_COLOR[1], b: FLAME_COLOR[2], a: 1 };
  }

  /**
   * Is (x, z) inside the arena rect?
   * @param {number} x
   * @param {number} z
   * @returns {boolean}
   */
  contains(x, z) {
    const r = this.rect;
    return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
  }

  /**
   * Inside the rect grown by `g` u (the exclusion zone of every other enemy, §7.6).
   * @param {number} x
   * @param {number} z
   * @param {number} g
   * @returns {boolean}
   */
  containsGrown(x, z, g) {
    const r = this.rect;
    return x > r.minX - g && x < r.maxX + g && z > r.minZ - g && z < r.maxZ + g;
  }

  /** Close the arena (core, on the boss's 'bossIntro' signal). */
  close() {
    if (this.active) return;
    this.active = true;
    this._t = 0;
    const sys = this.sys;
    const [x0, z0, x1, z1] = this.gate;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / FLAME_SPACING) + 1);
    for (let i = 0; i < n; i++) {
      const h = sys.quads.alloc();
      if (h < 0) break;
      const u = n === 1 ? 0.5 : i / (n - 1);
      // per-flame colour variation (golden-ratio sequence: deterministic, no neighbours alike)
      const k = (i * 0.618034) % 1;
      const j = (i * 0.381966 + 0.5) % 1;
      this._flames.push({
        h, x: x0 + (x1 - x0) * u, z: z0 + (z1 - z0) * u, phase: i * 0.37,
        r: FLAME_COLOR[0] * (0.88 + 0.24 * k), g: FLAME_COLOR[1] * (0.8 + 0.34 * j), b: FLAME_COLOR[2],
      });
    }
    this._barrier = sys.markerAllocCore();
    this._writeBarrier();
    this.update(0);
    sys.sfxAt('gateClose', (x0 + x1) / 2, (z0 + z1) / 2, { volume: 1 });
  }

  /** Open it again (boss defeated, player death reset, reset hook). */
  open() {
    const sys = this.sys;
    for (const f of this._flames) sys.quads.free(f.h);
    this._flames.length = 0;
    if (this._barrier >= 0) sys.markerFreeCore(this._barrier);
    this._barrier = -1;
    this.active = false;
  }

  /**
   * The boss's death bursts (COMBAT-16; the core calls it at the kill, in place of 3 × 24
   * `emberBurst` + 24 `sparkle` over the body): 3 × 12 `victoryEmbers` spread across the screen
   * over the upper body and 12 `victorySparkle` over the head — dimmer presets (at the bloom
   * threshold) that rise away — all centred 1 u beyond the boss as seen from the player and 0.5 u
   * farther from the camera, so a kill in melee range leaves the player readable.
   * @param {{ position: {x:number, y:number, z:number}, def?: { body?: number[] } }} boss
   */
  deathBursts(boss) {
    const sys = this.sys;
    const b = boss.position;
    const p = sys.player?.position ?? b;
    // camera forward on XZ (CombatFx keeps it current) and the player → boss direction
    const vx = sys.fx?.viewX ?? 0;
    const vz = sys.fx?.viewZ ?? -1;
    let dx = b.x - p.x;
    let dz = b.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-3) { dx /= d; dz /= d; } else { dx = vx; dz = vz; }
    const cx = b.x + dx * 1.0 + vx * 0.5;
    const cz = b.z + dz * 1.0 + vz * 0.5;
    const top = b.y + (boss.def?.body?.[1] ?? 3.6);
    // screen-horizontal (perpendicular to the view) spread of the three ember bursts
    const sx = -vz;
    const sz = vx;
    for (let k = 0; k < 3; k++) {
      const o = (k - 1) * 0.9;
      sys.burst('victoryEmbers', cx + sx * o, top - 1.4 + (k === 1 ? 0.5 : 0), cz + sz * o, 12);
    }
    sys.burst('victorySparkle', cx, top + 0.2, cz, 12);
  }

  _writeBarrier() {
    if (this._barrier < 0) return;
    const s = this.sys._markerSpec;
    const r = this.rect;
    s.shape = 'rect';
    s.x = this.center.x;
    s.z = this.center.z;
    s.w = r.maxX - r.minX;
    s.d = r.maxZ - r.minZ;
    s.dirX = 0;
    s.dirZ = 1;
    s.progress = 1;
    s.style = 'barrier';
    s.alpha = 1;
    this.sys.markerSetCore(this._barrier, s);
  }

  /**
   * Animate the ember wall (real seconds).
   * @param {number} dt
   */
  update(dt) {
    if (!this.active) return;
    this._t += dt;
    const sys = this.sys;
    const p = this._p;
    const fr = sys.atlasFrames?.wallFlame;
    const n = fr?.n ?? 1;
    const fps = fr?.fps || 10;
    for (const f of this._flames) {
      p.x = f.x;
      p.z = f.z;
      p.y = sys.groundAt(f.x, f.z) + 0.72;
      p.index = Math.floor((this._t + f.phase) * fps) % n;
      p.scale = 1 + 0.08 * Math.sin((this._t + f.phase) * 7);
      p.r = f.r;
      p.g = f.g;
      p.b = f.b;
      sys.quads.set(f.h, p);
    }
  }

  /**
   * Keep a point inside the rect (inset). Returns whether it moved.
   * @param {{x:number, z:number}} pos
   * @param {number} [inset]
   */
  clamp(pos, inset = 0.35) {
    const r = this.rect;
    const x = Math.min(r.maxX - inset, Math.max(r.minX + inset, pos.x));
    const z = Math.min(r.maxZ - inset, Math.max(r.minZ + inset, pos.z));
    const moved = x !== pos.x || z !== pos.z;
    pos.x = x;
    pos.z = z;
    return moved;
  }
}
