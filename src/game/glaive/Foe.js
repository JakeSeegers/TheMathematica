import { DIRECTIONS, hashString } from '../../engine/index.js';

/**
 * Foe — one hostile actor of a turn-based combat level (docs/specs/GLAIVE.md §8.2). Between fights
 * it idles and wanders in its group's home disc and watches for the player (its kind's sight range
 * and line of sight, its zone); when it sees the player GlaiveCombat starts a fight. In a fight it
 * does nothing on its own: the stage (`Stage`) walks it along the paths the encounter chose and
 * shows its poses (wind-up, attack, hurt, dead), flashes and fades. Its sprite is created by
 * GlaiveCombat and never disposed while the game runs (hidden with opacity 0).
 */

/** @import { Sprite3D } from '../../engine/index.js' */
/** @import { MonsterStats } from './bestiary.js' */
/** @import { EnemyDef } from '../combat/defs.js' */

/** Wander speed as a share of the walk speed. */
const WANDER = 0.35;
/** Seconds a fresh wander target waits at least / at most. */
const PAUSE = [1.2, 3.4];
/** How often (s) a foe looks for the player. */
const SENSE_EVERY = 0.2;
/** Death fade (s); the boss's is longer. */
const FADE = 0.7;
const BOSS_FADE = 1.6;

/**
 * What GlaiveCombat gives a foe.
 * @typedef {object} FoeInit
 * @property {string} uid
 * @property {string} groupId
 * @property {any} group           the level `enemy` object (null for a summoned add)
 * @property {number} index
 * @property {string} kind
 * @property {string} name         English (identity); shown names go through GlaiveCombat
 * @property {MonsterStats} stats
 * @property {EnemyDef} def        presence data (radius, sight, hover …) from ../combat/defs.js
 * @property {any} sheet           the enemy sheet (poses)
 * @property {Sprite3D} sprite
 * @property {{ x: number, z: number }} home
 * @property {number} homeRadius
 * @property {boolean} isAdd
 * @property {any} [arena]
 * @property {import('../../engine/utils/math.js').RNG} rng
 */

export class Foe {
  /** @param {FoeInit} init */
  constructor(init) {
    this.uid = init.uid;
    this.groupId = init.groupId;
    this.group = init.group;
    this.index = init.index;
    this.kind = init.kind;
    this.name = init.name;
    this.stats = init.stats;
    this.def = init.def;
    this.level = init.stats.level;
    this.elite = init.stats.elite;
    this.boss = init.stats.boss;
    this.flier = !!init.def.flier;
    this.passive = !!init.def.passive;
    this.isAdd = init.isAdd;
    this.arena = init.arena ?? null;
    this.sheet = init.sheet;
    this.sprite = init.sprite;
    this.rng = init.rng;
    this.position = this.sprite.position;
    this.home = { ...init.home };
    this.homeRadius = init.homeRadius;
    this.radius = init.def.radius;
    this.hover = init.def.hover ?? 0;
    this.facing = { x: 0, z: 1 };
    this.hpMax = init.stats.hpMax;
    this.hp = this.hpMax;
    this.alive = true;
    /** Ran away (morale): out of play like the dead until a rest. */
    this.routed = false;
    /** Saw the player (the fight it is in, or about to start). */
    this.aggro = false;
    /** In a running fight. */
    this.inFight = false;
    /** Out of play: a story-absent group, an add not summoned. */
    this.hidden = false;
    /** This foe's deaths this session (loot seed). */
    this.deathCount = 0;
    /** The zone rect it keeps to (the level's region round its group), or null. */
    this.zoneRect = null;
    /**
     * In a research study (ResearchMode): its habitat and visible weapon; null otherwise.
     * @type {import('../research/ResearchMode.js').StudiedInfo|null}
     */
    this.studied = null;
    this.labelY = init.def.labelY ?? 2;
    // motion along a path (the stage)
    /** @type {number[]} */
    this._path = [];
    this._pathI = 0;
    this._speed = 0;
    this._wander = { has: false, x: 0, z: 0, pause: this.rng.range(0, PAUSE[1]) };
    this._senseT = (hashString(this.uid) % 100) / 500;
    this._poseCol = -1;
    this._poseRow = -1;
    this._fade = 0;
    this._fadeTime = FADE;
    this._flashT = 0;
    this._flash = [1, 1, 1];
    this._bob = (hashString(this.uid) % 997) / 997 * Math.PI * 2;
    this.sprite.name = `Foe:${this.uid}`;
    this.place(this.home.x, this.home.z);
    this.sprite.play('idle');
  }

  /** Walk speed (u/s). */
  get speed() { return this.def.speed > 0 ? this.def.speed : 2; }

  /** Is the stage walking it now? */
  get walking() { return this._pathI < this._path.length; }

  /** Out of play (dead, routed or hidden). */
  get gone() { return !this.alive || this.routed || this.hidden; }

  // ---------------------------------------------------------------------------------------------
  // Placement, facing, poses
  // ---------------------------------------------------------------------------------------------

  /** @param {number} x @param {number} z @param {(x: number, z: number) => number} [ground] */
  place(x, z, ground) {
    this.position.x = x;
    this.position.z = z;
    if (ground) this.position.y = ground(x, z) + (this.flier ? this.hover : 0);
  }

  /** Face a world point. @param {number} x @param {number} z */
  face(x, z) {
    const dx = x - this.position.x, dz = z - this.position.z;
    const l = Math.hypot(dx, dz);
    if (l < 1e-6) return;
    this.facing.x = dx / l;
    this.facing.z = dz / l;
    this.sprite.faceVector(this.facing.x, this.facing.z);
    if (this._poseCol >= 0) this._applyPose();
  }

  /**
   * Hold a pose (a sheet column: 'windup', 'attack', 'hurt', 'dead', the golem's 'slam' …); null
   * goes back to the idle animation.
   * @param {string|null} name
   */
  pose(name) {
    if (!name) {
      this._poseCol = -1;
      this.sprite.play('idle');
      return;
    }
    const col = this.sheet.poses[name] ?? this.sheet.poses.attack ?? this.sheet.poses.idle0 ?? 0;
    this._poseCol = col;
    this._applyPose();
  }

  _applyPose() {
    const row = Math.max(0, DIRECTIONS.indexOf(this.sprite.direction));
    this._poseRow = row;
    this.sprite.setFrame(this._poseCol, row);
  }

  /** A hit's flash (white, or a colour). @param {number} [time] @param {number[]} [rgb] */
  flash(time = 0.18, rgb = [2.2, 2.2, 2.2]) {
    this._flashT = time;
    this._flash = rgb;
  }

  // ---------------------------------------------------------------------------------------------
  // Motion
  // ---------------------------------------------------------------------------------------------

  /**
   * Walk a polyline [x0, z0, x1, z1 …] (the first point is where it stands) at `speed` u/s.
   * Returns the seconds it takes.
   * @param {number[]} points
   * @param {number} [speed]
   */
  walkPath(points, speed = this.speed) {
    this._path = points.slice(2);
    this._pathI = 0;
    this._speed = speed;
    let len = 0;
    for (let i = 2; i + 1 < points.length; i += 2) len += Math.hypot(points[i] - points[i - 2], points[i + 1] - points[i - 1]);
    if (this._path.length) {
      this._poseCol = -1;
      this.sprite.play('walk');
    }
    return len / Math.max(0.1, speed);
  }

  stopWalk() {
    this._path = [];
    this._pathI = 0;
  }

  // ---------------------------------------------------------------------------------------------
  // Per frame
  // ---------------------------------------------------------------------------------------------

  /**
   * One frame. `ctx` gives the ground and moves: `{ groundAt, move(foe, dx, dz) }`. `explore`:
   * no fight runs — it wanders.
   * @param {number} dt
   * @param {{ groundAt: (x: number, z: number) => number, move: (f: Foe, dx: number, dz: number) => void }} ctx
   * @param {boolean} explore
   */
  update(dt, ctx, explore) {
    if (this.hidden) return;
    if (this._flashT > 0) {
      this._flashT = Math.max(0, this._flashT - dt);
      const a = this._flashT > 0 ? 0.85 : 0;
      this.sprite.setFlash(this._flash[0], this._flash[1], this._flash[2], a);
    }
    if (!this.alive || this.routed) {
      if (this._fade > 0) {
        this._fade = Math.max(0, this._fade - dt);
        this.sprite.opacity = this._fade / this._fadeTime;
        if (this._fade === 0) this.sprite.visible = false;
      }
      if (this.routed && this.walking) this._walk(dt, ctx);
      return;
    }
    if (this.walking) this._walk(dt, ctx);
    else if (explore && !this.aggro && !this.passive && !this.boss) this._wanderStep(dt, ctx);
    // ground and hover
    const p = this.position;
    const gy = ctx.groundAt(p.x, p.z);
    if (this.flier) {
      this._bob += dt * 2.4;
      p.y = gy + this.hover + Math.sin(this._bob) * 0.12;
    } else p.y += (gy - p.y) * Math.min(1, dt * 18);
  }

  /** @param {number} dt @param {{ move: (f: Foe, dx: number, dz: number) => void }} ctx */
  _walk(dt, ctx) {
    let left = this._speed * dt;
    const p = this.position;
    while (left > 1e-6 && this._pathI < this._path.length) {
      const tx = this._path[this._pathI], tz = this._path[this._pathI + 1];
      const dx = tx - p.x, dz = tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d <= left) {
        p.x = tx;
        p.z = tz;
        left -= d;
        this._pathI += 2;
      } else {
        p.x += (dx / d) * left;
        p.z += (dz / d) * left;
        left = 0;
      }
      if (d > 1e-4) {
        this.facing.x = dx / d;
        this.facing.z = dz / d;
        this.sprite.faceVector(this.facing.x, this.facing.z);
      }
    }
    if (!this.walking && this.alive && !this.routed) {
      this._path = [];
      this._pathI = 0;
      this.sprite.play('idle');
    }
  }

  /** Idle wander in the home disc (never in a fight). @param {number} dt @param {{ move: (f: Foe, dx: number, dz: number) => void }} ctx */
  _wanderStep(dt, ctx) {
    const w = this._wander;
    if (!w.has) {
      w.pause -= dt;
      if (w.pause > 0) return;
      const a = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(0, this.homeRadius);
      w.x = this.home.x + Math.cos(a) * r;
      w.z = this.home.z + Math.sin(a) * r;
      w.has = true;
      this.sprite.play('walk');
    }
    const p = this.position;
    const dx = w.x - p.x, dz = w.z - p.z;
    const d = Math.hypot(dx, dz);
    const step = this.speed * WANDER * dt;
    if (d <= step + 0.05) {
      w.has = false;
      w.pause = this.rng.range(PAUSE[0], PAUSE[1]);
      this.sprite.play('idle');
      return;
    }
    const bx = p.x, bz = p.z;
    ctx.move(this, (dx / d) * step, (dz / d) * step);
    const moved = Math.hypot(p.x - bx, p.z - bz);
    this.facing.x = dx / d;
    this.facing.z = dz / d;
    this.sprite.faceVector(this.facing.x, this.facing.z);
    // blocked: pick another spot
    if (moved < step * 0.25) { w.has = false; w.pause = 0.4; this.sprite.play('idle'); }
  }

  /**
   * Does it see the player now? (throttled; GlaiveCombat calls it while no fight runs)
   * @param {number} dt
   * @param {{ x: number, y: number, z: number }} p the player's position
   * @param {(ax: number, az: number, bx: number, bz: number) => boolean} los
   * @returns {boolean}
   */
  sees(dt, p, los) {
    if (this.gone || this.passive || this.boss || this.isAdd) return false;
    this._senseT -= dt;
    if (this._senseT > 0) return false;
    this._senseT = SENSE_EVERY;
    const q = this.position;
    const d = Math.hypot(p.x - q.x, p.z - q.z);
    if (d > (this.def.aggro || 0)) return false;
    if (!this.flier && Math.abs(p.y - (q.y)) > 1.6) return false;
    const z = this.zoneRect;
    if (z && (p.x < z.minX - 3 || p.x > z.maxX + 3 || p.z < z.minZ - 3 || p.z > z.maxZ + 3)) return false;
    return los(q.x, q.z, p.x, p.z);
  }

  // ---------------------------------------------------------------------------------------------
  // Life
  // ---------------------------------------------------------------------------------------------

  /** Killed: the dead pose, then a fade. */
  die() {
    if (!this.alive) return;
    this.alive = false;
    this.inFight = false;
    this.aggro = false;
    this.hp = 0;
    this.deathCount++;
    this.stopWalk();
    this.pose('dead');
    this._fadeTime = this.boss ? BOSS_FADE : FADE;
    this._fade = this._fadeTime;
  }

  /** Ran away: it walks off (the stage gives the path) and fades. @param {number[]} points */
  rout(points) {
    this.routed = true;
    this.inFight = false;
    this.aggro = false;
    this.walkPath(points, this.speed * 1.4);
    this._fadeTime = 1.2;
    this._fade = this._fadeTime;
  }

  /** Back home, whole (a rest, a lost fight, the reset hook). @param {(x: number, z: number) => number} ground */
  /**
   * A new stat block (a research study's individual for a new expedition): full HP with it.
   * @param {MonsterStats} stats
   */
  setStats(stats) {
    this.stats = stats;
    this.level = stats.level;
    this.elite = stats.elite;
    this.hpMax = stats.hpMax;
    this.hp = this.hpMax;
  }

  reset(ground) {
    this.alive = !this.isAdd;
    this.routed = false;
    this.aggro = false;
    this.inFight = false;
    this.hp = this.hpMax;
    this.stopWalk();
    this._fade = 0;
    this._wander.has = false;
    this._poseCol = -1;
    this.place(this.home.x, this.home.z, ground);
    const show = this.alive && !this.hidden;
    this.sprite.visible = show;
    this.sprite.opacity = show ? 1 : 0;
    this.sprite.setFlash(0, 0, 0, 0);
    this.sprite.play('idle');
  }

  /** Out of play (story absence, an add not summoned). */
  hide() {
    this.hidden = true;
    this.inFight = false;
    this.aggro = false;
    this.stopWalk();
    this.sprite.visible = false;
    this.sprite.opacity = 0;
  }

  /** Back in play. @param {(x: number, z: number) => number} ground */
  show(ground) {
    this.hidden = false;
    this.reset(ground);
  }

  /** A summoned add appears at (x, z). @param {number} x @param {number} z @param {(x: number, z: number) => number} ground */
  appear(x, z, ground) {
    this.hidden = false;
    this.alive = true;
    this.routed = false;
    this.hp = this.hpMax;
    this._fade = 0;
    this.place(x, z, ground);
    this.sprite.visible = true;
    this.sprite.opacity = 1;
    this.sprite.setFlash(0, 0, 0, 0);
    this.pose(null);
  }
}
