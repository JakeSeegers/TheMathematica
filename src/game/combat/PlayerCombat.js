import { Sprite3D, DIRECTIONS, globalUniforms } from '../../engine/index.js';
import {
  EPS, F, frameOf, LEVEL_CAP, SP_MAX, PER_LEVEL, hpMaxFor, mpMaxFor, atkFor, defFor, xpToNext, UPGRADES, SKILLS,
  SP_REGEN, SP_DELAY, SP_DELAY_EMPTY, SP_DODGE_MIN, SP_COST, WINDED_UNTIL, WINDED_RECOVERY, MP_REGEN, MP_PER_HIT,
  MP_PER_SWING_MAX, POTION_MAX, POTION_START, DRAUGHT_HEAL, PERFECT, PLAYER_BODY, PLAYER_RADIUS, MELEE_DY, SHOT_Y,
  COMBO, MAGNET, FACING_FIX_FRAMES, ROLL, BACKSTEP, WHIRL, BOLT, NOVA, DRAUGHT, HITSTUN, KNOCKDOWN, KB_CAP,
  LEVELUP_INVULN,
} from './rules.js';
import { aimVy } from './Projectiles.js';
import { PLAYER_FLASH, BLINK_HZ, SHAKE } from './Feel.js';
import { t, sep } from '../../engine/i18n/I18n.js';

/**
 * @import { HitSpec, PlayerAction, PlayerHitMeta, SwingRecord, ProjectileSpec } from './types.js'
 * @import { CombatSystem } from './CombatSystem.js'
 */

/**
 * PlayerCombat — the player's combat kit (COMBAT.md §6): stats and progression, SP / MP / HP,
 * the 3-hit combo with its magnet and lunges, dodge roll / backstep with i-frames and the perfect
 * dodge, the three skills, the Healing Draught, hitstun / knockdown, death, level-ups.
 *
 * It owns the player sprite while an action runs (`player.action` !== null): the pose of every
 * frame is shown with `sprite.setFrame(column, row of the facing)` — frame = hitbox frame — and
 * every displacement goes through `player.moveBy` (terrain and props still block). Locomotion is
 * the Player's own (`Player.update`, frame dt) while no action runs.
 *
 * Time: `step(h)` gets player-scaled sub-step seconds; action frames are `frameOf(t)` and every
 * window of the contract is a frame index. Frame events fire once when their frame is reached
 * (sub-steps never skip a frame: h ≤ 1/60 s). Winded attacks run their recovery frames (after the
 * active window) at 1 / 1.35 speed.
 */

/**
 * Hit metadata carried next to a player HitSpec (constants: nothing is allocated per hit).
 * @type {Record<'A1'|'A2'|'A3'|'whirl'|'nova'|'bolt', Readonly<PlayerHitMeta>>}
 */
const META = {
  A1: Object.freeze({ source: 'melee', stop: COMBO[0].hitStop, finisher: false, combo: 1 }),
  A2: Object.freeze({ source: 'melee', stop: COMBO[1].hitStop, finisher: false, combo: 2 }),
  A3: Object.freeze({ source: 'melee', stop: COMBO[2].hitStop, finisher: true, combo: 3 }),
  whirl: Object.freeze({ source: 'skill', stop: WHIRL.hitStop, finisher: false, combo: 0 }),
  nova: Object.freeze({ source: 'skill', stop: NOVA.hitStop, finisher: false, combo: 0 }),
  bolt: Object.freeze({ source: 'projectile', stop: BOLT.hitStop, finisher: false, combo: 0 }),
};
export { META as PLAYER_HIT_META };

/** @type {(u: number) => number} ease-out (0..1) */
const ease = (u) => 1 - (1 - u) * (1 - u);
const DEG = Math.PI / 180;

export class PlayerCombat {
  /**
   * @param {CombatSystem} sys the CombatSystem
   */
  constructor(sys) {
    this.sys = sys;
    this.player = sys.player;
    this.sprite = sys.player.sprite;
    this.sheet = sys.player.sheet;
    this.radius = PLAYER_RADIUS;
    this.body = PLAYER_BODY;
    this.potionMax = POTION_MAX;
    /** @type {HitSpec} the player's hitbox record (the queue copies it) */
    this._spec = {
      shape: 'sector', x: 0, y: 0, z: 0, r: 1, rInner: 0, dirX: 0, dirZ: 1, halfAngle: 60, len: 1, width: 1,
      dy: MELEE_DY, mv: 1, kb: 0, poise: 0, knockdown: false, flat: 0, thin: false, tag: 0, fromX: 0, fromZ: 0,
    };
    // the current swing's hit tag and MP gain (two records in turn: no object per swing)
    /** @type {SwingRecord[]} */
    this._swings = [{ tag: 0, mp: 0 }, { tag: 0, mp: 0 }];
    this._swingI = 0;
    this._tagA = 0;
    this._tagB = 0;
    /** @type {ProjectileSpec} the Ember Bolt's launch record */
    this._proj = { kind: 'emberBolt', x: 0, y: 0, z: 0, dirX: 0, dirZ: 1, vy: 0, speed: BOLT.speed, range: BOLT.range, radius: BOLT.radius, mv: BOLT.mv, kb: BOLT.kb, poise: BOLT.poise, pierce: false, splash: BOLT.splash, arc: null };
    this._aim = { x: 0, z: 1 };
    this._tmp = { x: 0, z: 0 };
    this.reset();
  }

  /** Everything back to a fresh Lv 1 player (reset hook). Does not move the player. */
  reset() {
    this.level = 1;
    this.xp = 0;
    this.gold = 0;
    this.potions = POTION_START;
    this.upgrades = { maxHp: 0, maxMp: 0, attack: 0, def: 0 };
    this.hp = this.hpMax;
    this.mp = this.mpMax;
    this.sp = SP_MAX;
    this.alive = true;
    this.winded = false;
    this.cooldowns = [0, 0, 0];
    this.draughtCd = 0;
    this.spDelay = 0;
    this.perfectCd = 0;
    this.iframes = 0;
    this.blink = false;
    this.invulnT = 0;
    this.flashT = 0;
    this.deaths = 0;
    this.perfectDodges = 0;
    this._endAction();
    /** @type {number} the combo step of the running (or last) attack: 1..3 = A1..A3, 0: none */
    this.combo = 0;
    /** Swings started (every combo step; enemies read it through `ctx.player.swing`). */
    this.swings = 0;
    this._freeNovaMarker();
    this._applyVisuals(0);
  }

  // ------------------------------------------------------------------------------------------
  // Stats
  // ------------------------------------------------------------------------------------------

  get hpMax() { return hpMaxFor(this.level, this.upgrades.maxHp); }
  get mpMax() { return mpMaxFor(this.level, this.upgrades.maxMp); }
  get spMax() { return SP_MAX; }
  get atk() { return atkFor(this.level, this.upgrades.attack); }
  get def() { return defFor(this.level, this.upgrades.def); }
  get xpNext() { return xpToNext(this.level); }

  /** Invulnerable now (i-frames of any kind, level-up, dead). */
  get invulnerable() {
    if (!this.alive || this.iframes > 0 || this.invulnT > 0) return true;
    const w = this._iframeWindow();
    return !!w && this.frame >= w[0] && this.frame <= w[1];
  }

  /** Rolling or backstepping (separation skips the player, dust, perfect dodge). */
  get dodging() { return this.action === 'roll' || this.action === 'backstep'; }

  _iframeWindow() {
    switch (this.action) {
      case 'roll': return ROLL.iframes;
      case 'backstep': return BACKSTEP.iframes;
      case 'skill3': return NOVA.iframes;
      case 'knockdown': return [0, 1e9];
      default: return null;
    }
  }

  // ------------------------------------------------------------------------------------------
  // Sub-step
  // ------------------------------------------------------------------------------------------

  /**
   * One combat sub-step for the player.
   * @param {number} h player-scaled seconds
   */
  step(h) {
    this._stepTimers(h);
    if (this.action) this._advance(h);
    if (this.alive) this._decide();
    this._regen(h);
  }

  /** @param {number} h */
  _stepTimers(h) {
    if (this.iframes > 0) this.iframes = Math.max(0, this.iframes - h);
    if (this.invulnT > 0) this.invulnT = Math.max(0, this.invulnT - h);
    if (this.perfectCd > 0) this.perfectCd = Math.max(0, this.perfectCd - h);
    for (let i = 0; i < 3; i++) if (this.cooldowns[i] > 0) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - h);
    if (this.draughtCd > 0 && this.action !== 'draught') this.draughtCd = Math.max(0, this.draughtCd - h);
  }

  /** @param {number} h */
  _regen(h) {
    if (!this.alive) return;
    if (this.spDelay > 0) this.spDelay = Math.max(0, this.spDelay - h);
    else if (this.sp < SP_MAX) this.sp = Math.min(SP_MAX, this.sp + SP_REGEN * h);
    if (this.winded && this.sp >= WINDED_UNTIL) this.winded = false;
    if (this.mp < this.mpMax) this.mp = Math.min(this.mpMax, this.mp + MP_REGEN * h);
  }

  /** @param {number} sp */
  _spend(sp) {
    this.sp = Math.max(0, this.sp - sp);
    if (this.sp <= EPS) {
      this.sp = 0;
      this.winded = true;
      this.spDelay = SP_DELAY_EMPTY;
    } else this.spDelay = Math.max(this.spDelay, SP_DELAY);
  }

  /**
   * Advance the running action by h and run the frame events it crossed.
   * @param {number} h
   */
  _advance(h) {
    let dt = h;
    if (this.action === 'attack' && this._windedAction) {
      // winded: recovery frames (after the active window) run 1.35× longer
      const S = COMBO[this.combo - 1];
      if (this.frame > S.active[1]) dt = h / WINDED_RECOVERY;
    }
    this.t += dt;
    const prev = this.frame;
    this.frame = frameOf(this.t);
    this._prevFrame = prev;
    this._runFrame();
  }

  /**
   * Was frame `n` reached in this sub-step (or is it the action's first sub-step and n = 0)?
   * @param {number} n
   * @returns {boolean}
   */
  _at(n) {
    return this._prevFrame < n && this.frame >= n;
  }

  _runFrame() {
    switch (this.action) {
      case 'attack': this._frameAttack(); break;
      case 'roll': case 'backstep': this._frameDodge(); break;
      case 'skill1': this._frameWhirl(); break;
      case 'skill2': this._frameBolt(); break;
      case 'skill3': this._frameNova(); break;
      case 'draught': this._frameDraught(); break;
      case 'hitstun': this._frameHitstun(); break;
      case 'knockdown': this._frameKnockdown(); break;
      case 'dead': this._pose('down'); break;
      default: break;
    }
  }

  /** Start / cancel into the highest-priority buffered action allowed now (§5.1). */
  _decide() {
    const input = this.sys.cin;
    const a = this.action;
    const f = this.frame;
    /** @type {(kind: string) => boolean} may a buffered `kind` start now? */
    const can = (kind) => {
      if (!a) return true;
      switch (a) {
        case 'attack': {
          const S = COMBO[this.combo - 1];
          if (kind === 'dodge') return f >= S.dodge;
          return f >= S.next;
        }
        case 'roll': return kind === 'attack' ? f >= ROLL.attackFrom : kind === 'dodge' ? f >= ROLL.dodgeFrom : kind === 'draught' ? false : f >= ROLL.skillFrom;
        case 'backstep': return kind === 'attack' ? f >= BACKSTEP.attackFrom : kind === 'dodge' ? f >= BACKSTEP.dodgeFrom : kind === 'draught' ? false : f >= BACKSTEP.skillFrom;
        case 'skill1': return kind === 'dodge' && f >= WHIRL.dodgeFrom;
        case 'skill2': return (kind === 'dodge' && f >= BOLT.dodgeFrom) || ((kind === 'attack' || kind.startsWith('skill')) && f >= BOLT.attackFrom);
        case 'skill3': return kind === 'dodge' && f >= NOVA.dodgeFrom;
        case 'knockdown': return kind === 'dodge' && this.t >= F(KNOCKDOWN.techFrom) - EPS;
        default: return false;
      }
    };
    if (input.has('dodge') && can('dodge')) {
      if (this.sp >= SP_DODGE_MIN) {
        const b = input.take('dodge');
        this._startDodge(b.mouse);
        return;
      }
    }
    for (let i = 0; i < 3; i++) {
      const id = SKILLS[i].id;
      if (input.has(id) && can(id)) {
        const b = input.take(id);
        if (this._trySkill(i, b.mouse)) return;
      }
    }
    if (input.has('attack') && can('attack')) {
      const b = input.take('attack');
      this._startAttack(b.mouse, { rollSlash: a === 'roll' });
      return;
    }
    if (input.has('draught') && can('draught')) {
      input.take('draught');
      this._tryDraught();
    }
  }

  /**
   * Start `action` at f0 (per-action state cleared).
   * @param {PlayerAction} action
   */
  _begin(action) {
    this._clearActionState();
    this.action = action;
    this.player.action = action;
  }

  _clearActionState() {
    this.t = 0;
    this.frame = 0;
    this._prevFrame = -1;
    this._motion = null;
    this._moved = 0;
    this._windedAction = false;
    this._consumed = false;
    this._armor = false;
    this._swing = null;
    /** @type {number} the sheet column `_pose` last showed (−1: none since the reset) */
    this._lastCol = -1;
    /** @type {number} its row (the facing seen from the camera) */
    this._lastRow = -1;
    this._freeNovaMarker();
  }

  /** No action: the Player's locomotion takes the sprite back. */
  _endAction() {
    this._clearActionState();
    this.action = null;
    if (this.player) this.player.action = null;
  }

  /** The action ran its last frame: back to locomotion (the combo resets to A1). */
  _finish() {
    this._endAction();
    this.combo = 0;
  }

  // ------------------------------------------------------------------------------------------
  // Attack combo (§6.4)
  // ------------------------------------------------------------------------------------------

  /**
   * @param {boolean} mouse triggered by a mouse button (aim at the pointer)
   * @param {{ rollSlash?: boolean }} [opts] rollSlash: out of a roll (longer lunge)
   */
  _startAttack(mouse, { rollSlash = false } = {}) {
    // chained from the previous attack's cancel window: next step; otherwise (or after A3) A1
    const chained = this.action === 'attack' && this.combo > 0 && this.combo < 3;
    const step = chained ? this.combo + 1 : 1;
    this._begin('attack');
    this.combo = step;
    this.swings++;
    const S = COMBO[step - 1];
    this._mouse = mouse;
    this._windedAction = this.winded;
    this._spend(S.sp);
    this._lungeExtra = rollSlash ? ROLL.rollSlashLunge : 0;
    this._swingI = 1 - this._swingI;
    const sw = this._swings[this._swingI];
    sw.tag = this.sys.tags.next();
    sw.mp = 0;
    this._swing = sw;
    this._aimAttack(true);
    this._runFrame();
  }

  /**
   * Aim + magnet at f0 (re-evaluated at f1, f2); move input can still turn the swing.
   * @param {boolean} first f0 (the lunge is set; later: only before the lunge starts)
   */
  _aimAttack(first) {
    const S = COMBO[this.combo - 1];
    const sys = this.sys;
    const aim = sys.targeting.aimDir(this._mouse, this._aim);
    let dx = aim.x;
    let dz = aim.z;
    let lunge = S.lunge + this._lungeExtra;
    const tgt = sys.targeting.soft(dx, dz, false);
    if (tgt) {
      const p = this.player.position;
      const tx = tgt.position.x - p.x;
      const tz = tgt.position.z - p.z;
      const d = Math.hypot(tx, tz);
      if (d <= MAGNET.range && d > 1e-4) {
        // snap toward it (at most 60° off the aim) and reach it
        const a0 = Math.atan2(dz, dx);
        let da = Math.atan2(tz, tx) - a0;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        const lim = MAGNET.maxTurnDeg * DEG;
        const a = a0 + Math.max(-lim, Math.min(lim, da));
        dx = Math.cos(a);
        dz = Math.sin(a);
        lunge = Math.max(0, Math.min(d - (tgt.radius + MAGNET.reach), lunge + MAGNET.extra));
      }
    }
    this._setFacing(dx, dz);
    if (first || this.frame < S.lungeFrames[0]) this._lunge = lunge;
  }

  _frameAttack() {
    const S = COMBO[this.combo - 1];
    const f = this.frame;
    if (f >= S.total) { this._finish(); return; }
    if ((this._at(1) || this._at(2)) && f <= FACING_FIX_FRAMES) this._aimAttack(false);
    // pose
    for (const [a, b, pose] of S.poses) if (f >= a && f <= b) { this._pose(pose); break; }
    // lunge (ease-out over its frames)
    const [l0, l1] = S.lungeFrames;
    this._moveAlong(this._lunge, l0, l1 + 1, this.player.facing.x, this.player.facing.z);
    // effects at the swing
    const sys = this.sys;
    const p = this.player.position;
    const fx = this.player.facing;
    if (this._at(S.fxAt)) {
      sys.sfxAt(S.sfx, p.x, p.z, { volume: 0.8 });
      if (S.finisher) {
        sys.fx.play('thrust', p.x + fx.x * 0.9, p.y, p.z + fx.z * 0.9, { dirX: fx.x, dirZ: fx.z });
        sys.fx.play('slashBig', p.x + fx.x * 0.5, p.y, p.z + fx.z * 0.5, { dirX: fx.x, dirZ: fx.z });
      } else {
        sys.fx.play('slash', p.x + fx.x * 0.55, p.y, p.z + fx.z * 0.55, { dirX: fx.x, dirZ: fx.z, flip: S.flip });
      }
    }
    // hitboxes in the active window
    if (f >= S.active[0] && f <= S.active[1]) {
      const meta = S.finisher ? META.A3 : this.combo === 2 ? META.A2 : META.A1;
      for (const shape of S.hits) {
        const s = this._baseSpec(this._swing.tag, S.mv, S.kb, S.poise);
        s.shape = shape.shape;
        if (shape.shape === 'lane') {
          s.len = shape.len;
          s.width = shape.width;
        } else {
          s.r = shape.r;
          s.halfAngle = shape.halfAngle;
        }
        sys.addPlayerHit(s, meta, this._swing);
      }
    }
  }

  /**
   * A player HitSpec at the player's feet along the facing (reused object; the queue copies it).
   * @param {number} tag
   * @param {number} mv
   * @param {number} kb
   * @param {number} poise
   * @returns {HitSpec}
   */
  _baseSpec(tag, mv, kb, poise) {
    const s = this._spec;
    const p = this.player.position;
    s.shape = 'circle';
    s.x = p.x;
    s.y = p.y;
    s.z = p.z;
    s.r = 1;
    s.rInner = 0;
    s.dirX = this.player.facing.x;
    s.dirZ = this.player.facing.z;
    s.halfAngle = 60;
    s.len = 1;
    s.width = 1;
    s.dy = MELEE_DY;
    s.mv = mv;
    s.kb = kb;
    s.poise = poise;
    s.knockdown = false;
    s.flat = 0;
    s.thin = false;
    s.tag = tag;
    s.fromX = p.x;
    s.fromZ = p.z;
    return s;
  }

  /**
   * A melee hit landed: +2 MP (max +4 per swing, dummies count).
   * @param {SwingRecord|null} swing
   */
  onMeleeLanded(swing) {
    if (!swing || swing.mp >= MP_PER_SWING_MAX) return;
    const gain = Math.min(MP_PER_HIT, MP_PER_SWING_MAX - swing.mp);
    swing.mp += gain;
    this.mp = Math.min(this.mpMax, this.mp + gain);
  }

  // ------------------------------------------------------------------------------------------
  // Dodge roll / backstep (§6.5)
  // ------------------------------------------------------------------------------------------

  /** @param {boolean} mouse */
  _startDodge(mouse) {
    const sys = this.sys;
    const m = sys.moveWorld(this._tmp);
    let dx = 0;
    let dz = 0;
    let roll = false;
    if (m > 0.2) {
      dx = this._tmp.x;
      dz = this._tmp.z;
      roll = true;
    } else if ((mouse || sys.aimOverride) && sys.aimPoint(this._tmp)) {
      const p = this.player.position;
      const ax = this._tmp.x - p.x;
      const az = this._tmp.z - p.z;
      const d = Math.hypot(ax, az);
      if (d > 0.8) { dx = ax / d; dz = az / d; roll = true; }
    }
    this._begin(roll ? 'roll' : 'backstep');
    this.combo = 0;
    const M = roll ? ROLL : BACKSTEP;
    this._spend(roll ? SP_COST.roll : SP_COST.backstep);
    if (roll) this._setFacing(dx, dz);
    const f = this.player.facing;
    // a backstep moves opposite the facing (the facing stays)
    const mx = roll ? dx : -f.x;
    const mz = roll ? dz : -f.z;
    this._motion = { dist: M.dist, f0: 0, f1: M.moveFrames + 1, dx: mx, dz: mz, done: 0 };
    const p = this.player.position;
    sys.burst('footstep', p.x, p.y + 0.05, p.z, 6);
    sys.sfxAt('dodge', p.x, p.z, { volume: 0.7 });
    sys.tutorial.dodge = true;
    this._runFrame();
  }

  _frameDodge() {
    const M = this.action === 'roll' ? ROLL : BACKSTEP;
    const f = this.frame;
    if (f >= M.total) { this._finish(); return; }
    for (const [a, b, pose] of M.poses) if (f >= a && f <= b) { this._pose(pose); break; }
    const m = this._motion;
    if (m) this._moveAlong(m.dist, m.f0, m.f1, m.dx, m.dz);
  }

  /**
   * An enemy hitbox or projectile overlapped the invulnerable player: a perfect dodge when it
   * happens in f1–8 of a roll or backstep (once per 3 s).
   * @returns {boolean} it counted
   */
  notePerfectDodge() {
    if (!this.dodging || this.perfectCd > 0) return false;
    const w = (this.action === 'roll' ? ROLL : BACKSTEP).perfect;
    if (this.frame < w[0] || this.frame > w[1]) return false;
    this.perfectCd = PERFECT.cooldown;
    this.perfectDodges++;
    // invulnerable while the enemy slow motion lasts: the slowed attack that was dodged (a wave of
    // rings, a leap still in the air) must not catch the player after the roll's own i-frames
    this.iframes = Math.max(this.iframes, PERFECT.time);
    this.sp = Math.min(SP_MAX, this.sp + PERFECT.sp);
    this.mp = Math.min(this.mpMax, this.mp + PERFECT.mp);
    this.sys.onPerfectDodge();
    return true;
  }

  // ------------------------------------------------------------------------------------------
  // Skills (§6.6)
  // ------------------------------------------------------------------------------------------

  /**
   * Skill slot i: locked, cooling down or unaffordable → refused (slot shake, SFX cancel).
   * @param {number} i
   * @param {boolean} mouse
   * @returns {boolean} started
   */
  _trySkill(i, mouse) {
    const K = SKILLS[i];
    const sys = this.sys;
    if (this.level < K.unlock || this.cooldowns[i] > 0 || this.mp < K.mp - EPS) {
      sys.refuseSkill(i);
      return false;
    }
    this._begin(K.id);
    this.combo = 0;
    this.mp -= K.mp;
    this.cooldowns[i] = K.cooldown;
    this._mouse = mouse;
    const aim = sys.targeting.aimDir(mouse, this._aim);
    this._setFacing(aim.x, aim.z);
    this._tagA = sys.tags.next();
    this._tagB = sys.tags.next();
    if (K.id === 'skill1') this._armor = true;
    if (K.id === 'skill2') {
      // auto-aim: a soft target in the ±45° cone up to 12 u
      this._boltTarget = sys.targeting.soft(aim.x, aim.z, true);
      if (this._boltTarget) {
        const p = this.player.position;
        const tx = this._boltTarget.position.x - p.x;
        const tz = this._boltTarget.position.z - p.z;
        const d = Math.hypot(tx, tz);
        if (d > 1e-4) this._setFacing(tx / d, tz / d);
      }
    }
    this._runFrame();
    return true;
  }

  _frameWhirl() {
    const f = this.frame;
    if (f >= WHIRL.total) { this._finish(); return; }
    this._pose(WHIRL.pose);
    this._armor = f <= WHIRL.armor;
    const sys = this.sys;
    const p = this.player.position;
    if (this._at(3)) sys.sfxAt('whirl', p.x, p.z, { volume: 0.9 });
    if (this._at(5)) sys.fx.play('spin', p.x, p.y, p.z, { follow: p });
    const [a0, a1] = WHIRL.hits[0];
    const [b0, b1] = WHIRL.hits[1];
    const tag = f >= a0 && f <= a1 ? this._tagA : f >= b0 && f <= b1 ? this._tagB : null;
    if (tag) {
      const s = this._baseSpec(tag, WHIRL.mv, WHIRL.kb, WHIRL.poise);
      s.shape = 'circle';
      s.r = WHIRL.r;
      sys.addPlayerHit(s, META.whirl, null);
    }
  }

  _frameBolt() {
    const f = this.frame;
    if (f >= BOLT.total) { this._finish(); return; }
    this._pose(BOLT.pose);
    if (this._at(BOLT.release)) {
      const sys = this.sys;
      const p = this.player.position;
      const fx = this.player.facing;
      const s = this._proj;
      s.x = p.x + fx.x * 0.4;
      s.z = p.z + fx.z * 0.4;
      s.y = p.y + SHOT_Y;
      const t = this._boltTarget;
      if (t && t.alive) {
        const dx = t.position.x - s.x;
        const dz = t.position.z - s.z;
        const d = Math.hypot(dx, dz);
        if (d > 1e-3) {
          s.dirX = dx / d;
          s.dirZ = dz / d;
          this._setFacing(s.dirX, s.dirZ);
        }
        const b = t.def.body;
        s.vy = aimVy(s.y, sys.bodyBase(t) + (b[0] + b[1]) / 2, BOLT.speed, d);
      } else {
        s.dirX = fx.x;
        s.dirZ = fx.z;
        s.vy = 0;
      }
      sys.spawnProjectile('player', s);
      sys.sfxAt('bolt', p.x, p.z, { volume: 0.85 });
    }
  }

  _frameNova() {
    const f = this.frame;
    if (f >= NOVA.total) { this._finish(); return; }
    for (const [a, b, pose] of NOVA.poses) if (f >= a && f <= b) { this._pose(pose); break; }
    const sys = this.sys;
    const p = this.player.position;
    // the gold ring grows r 0 → 3.2 over f0–20, its fill fading as it grows; at the burst only
    // the outer band is left (a full disc hung over the hit-stop as a flat cream decal)
    if (f <= NOVA.grow) {
      if (this._novaMarker === undefined || this._novaMarker < 0) this._novaMarker = sys.markerAllocCore();
      if (this._novaMarker >= 0) {
        const m = sys._markerSpec;
        const k = Math.min(1, this.t / F(NOVA.grow));
        const burst = k >= 1 - 1e-6;
        m.shape = burst ? 'ring' : 'circle';
        m.x = p.x;
        m.z = p.z;
        m.r = Math.max(0.05, NOVA.r * k);
        m.rInner = burst ? NOVA.r - 0.45 : 0;
        m.progress = k;
        m.style = 'player';
        m.alpha = 1 - 0.45 * k * k;
        sys.markerSetCore(this._novaMarker, m);
      }
    } else this._freeNovaMarker();
    if (this._at(2)) sys.sfxAt('nova', p.x, p.z, { volume: 0.5, pitch: 0.8 });
    if (this._at(NOVA.at)) {
      const s = this._baseSpec(this._tagA, NOVA.mv, NOVA.kb, NOVA.poise);
      s.shape = 'circle';
      s.r = NOVA.r;
      s.knockdown = true;
      sys.addPlayerHit(s, META.nova, null);
      sys.burst('magicBurst', p.x, p.y + 0.8, p.z, 24);
      sys.shake(SHAKE.nova[0], SHAKE.nova[1]);
      sys.sfxAt('nova', p.x, p.z, { volume: 1 });
    }
  }

  _freeNovaMarker() {
    if (this._novaMarker !== undefined && this._novaMarker >= 0) this.sys.markerFreeCore(this._novaMarker);
    this._novaMarker = -1;
  }

  // ------------------------------------------------------------------------------------------
  // Healing Draught (§6.7)
  // ------------------------------------------------------------------------------------------

  /** @returns {boolean} started */
  _tryDraught() {
    const sys = this.sys;
    if (this.draughtCd > 0 || this.potions <= 0) {
      sys.refuseSkill(3);
      return false;
    }
    if (this.hp >= this.hpMax) {
      sys.ui.hud.toast(t('combat.draught.full'), 1.6);
      sys.audio.playSfx('cancel', { volume: 0.5 });
      return false;
    }
    this._begin('draught');
    this.combo = 0;
    this._consumed = false;
    this._runFrame();
    return true;
  }

  _frameDraught() {
    const f = this.frame;
    if (f >= DRAUGHT.total) {
      this.draughtCd = DRAUGHT.cooldown;
      this._finish();
      return;
    }
    this._pose(DRAUGHT.pose);
    if (this._at(DRAUGHT.at) && !this._consumed) {
      this._consumed = true;
      this.potions = Math.max(0, this.potions - 1);
      const amount = Math.round(this.hpMax * DRAUGHT_HEAL);
      this.heal(amount);
      const sys = this.sys;
      const p = this.player.position;
      sys.burst('healGlow', p.x, p.y + 0.9, p.z, 12);
      sys.sfxAt('drink', p.x, p.z, { volume: 0.8 });
    }
  }

  /**
   * Heal (capped) with a green number.
   * @param {number} amount
   * @returns {number} HP gained
   */
  heal(amount) {
    const before = this.hp;
    this.hp = Math.min(this.hpMax, this.hp + amount);
    const got = Math.round(this.hp - before);
    const p = this.player.position;
    if (got > 0) this.sys.number(p.x, p.y + 1.9, p.z, `+${got}`, 'heal');
    return got;
  }

  // ------------------------------------------------------------------------------------------
  // Getting hit (§6.8)
  // ------------------------------------------------------------------------------------------

  /** Can an enemy hit connect now (else it is ignored: i-frames, dead)? */
  get hittable() { return this.alive && !this.invulnerable; }

  /**
   * A damaging enemy hit (core computed `damage`; the player is hittable).
   * @param {{ damage: number, kb: number, kbDirX: number, kbDirZ: number, knockdown: boolean }} info
   * @returns {'hurt'|'knockdown'|'armor'|'dead'}
   */
  hurt(info) {
    this.hp = Math.max(0, this.hp - info.damage);
    this.flashT = PLAYER_FLASH.time;
    if (this.hp <= 0) {
      this.die();
      return 'dead';
    }
    if (this._armor) return 'armor';
    const down = info.knockdown || info.kb >= KNOCKDOWN.kb;
    const kb = Math.min(KB_CAP, info.kb);
    this._begin(down ? 'knockdown' : 'hitstun');
    this.combo = 0;
    this._motion = { dist: kb, f0: 0, f1: down ? KNOCKDOWN.slide : HITSTUN.slide, dx: info.kbDirX, dz: info.kbDirZ, done: 0 };
    // face the hit
    if (Math.hypot(info.kbDirX, info.kbDirZ) > 1e-3) this._setFacing(-info.kbDirX, -info.kbDirZ);
    this._runFrame();
    return down ? 'knockdown' : 'hurt';
  }

  /**
   * A push without damage (the boss's phase-2 ring, `mv` 0): the hit-stun slide only — no HP, no
   * flash, no knockdown.
   * @param {number} kb
   * @param {number} dirX
   * @param {number} dirZ
   */
  shove(kb, dirX, dirZ) {
    if (!this.alive || this._armor) return;
    this._begin('hitstun');
    this.combo = 0;
    this._motion = { dist: Math.min(KB_CAP, kb), f0: 0, f1: HITSTUN.slide, dx: dirX, dz: dirZ, done: 0 };
    if (Math.hypot(dirX, dirZ) > 1e-3) this._setFacing(-dirX, -dirZ);
    this._runFrame();
  }

  /**
   * Flat damage (magma): HP and the flash only — no reaction, no i-frames.
   * @param {number} damage
   */
  hurtFlat(damage) {
    this.hp = Math.max(0, this.hp - damage);
    this.flashT = PLAYER_FLASH.time;
    if (this.hp <= 0) this.die();
  }

  _frameHitstun() {
    const f = this.frame;
    if (f >= HITSTUN.total) {
      this.iframes = F(HITSTUN.iframes);
      this.blink = true;
      this._finish();
      return;
    }
    this._pose(HITSTUN.pose);
    const m = this._motion;
    if (m) this._moveAlong(m.dist, m.f0, m.f1, m.dx, m.dz);
  }

  _frameKnockdown() {
    const f = this.frame;
    const total = KNOCKDOWN.down + KNOCKDOWN.getUp;
    if (f >= total) {
      this.iframes = F(KNOCKDOWN.iframesAfter);
      this.blink = true;
      this._finish();
      return;
    }
    this._pose(f < KNOCKDOWN.down ? 'down' : 'tuck');
    const m = this._motion;
    if (m) this._moveAlong(m.dist, m.f0, m.f1, m.dx, m.dz);
  }

  // ------------------------------------------------------------------------------------------
  // Death, respawn, progression
  // ------------------------------------------------------------------------------------------

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this._endAction();
    this._begin('dead');
    this.combo = 0;
    this.deaths++;
    this._pose('down');
    this.sys.onPlayerDeath();
  }

  /** Back on the feet (the death reset): full resources, draughts ≥ 2, cooldowns 0. */
  revive() {
    this.alive = true;
    this._endAction();
    this.combo = 0;
    this.hp = this.hpMax;
    this.mp = this.mpMax;
    this.sp = SP_MAX;
    this.winded = false;
    this.spDelay = 0;
    this.potions = Math.max(2, this.potions);
    this.cooldowns[0] = this.cooldowns[1] = this.cooldowns[2] = 0;
    this.draughtCd = 0;
    this.flashT = 0;
  }

  /** Full HP / MP / SP (rest, level-up). */
  refill() {
    this.hp = this.hpMax;
    this.mp = this.mpMax;
    this.sp = SP_MAX;
    this.winded = false;
  }

  /**
   * Gain XP; level-ups announce the final level only (with every gain summed).
   * @param {number} xp
   */
  gainXp(xp) {
    if (!(xp > 0)) return;
    this.xp += xp;
    const from = this.level;
    while (this.level < LEVEL_CAP && this.xp >= xpToNext(this.level)) {
      this.xp -= xpToNext(this.level);
      this.level++;
    }
    if (this.level > from) this._levelUp(from);
  }

  /**
   * @param {number} from the level before
   */
  _levelUp(from) {
    const n = this.level - from;
    this.refill();
    this.invulnT = Math.max(this.invulnT, LEVELUP_INVULN);
    // the card's line in the page's language (the skills' names by id: rules.js stays English)
    const parts = [t('combat.gain.maxHp', { n: PER_LEVEL.hp * n }), t('combat.gain.atk', { n: PER_LEVEL.atk * n })];
    for (const K of SKILLS) if (K.unlock > from && K.unlock <= this.level) parts.push(t('combat.gain.learned', { skill: t(`combat.skill.${K.id}`) }));
    this.sys.onLevelUp(this.level, parts.join(sep()));
  }

  /**
   * Apply an upgrade (chest / boss core / shop ware).
   * @param {'maxHp'|'maxMp'|'attack'|'core'|'def'} kind
   * @param {number} [amount] the amount (default: the chest's, `UPGRADES`; `def` has none)
   */
  upgrade(kind, amount = null) {
    if (kind === 'core' || kind === 'maxHp') {
      const add = amount ?? (kind === 'core' ? UPGRADES.core : UPGRADES.maxHp);
      this.upgrades.maxHp += add;
      this.hp += add;
    } else if (kind === 'maxMp') {
      const add = amount ?? UPGRADES.maxMp;
      this.upgrades.maxMp += add;
      this.mp += add;
    } else if (kind === 'attack') this.upgrades.attack += amount ?? UPGRADES.attack;
    else if (kind === 'def') this.upgrades.def += amount ?? 0;
  }

  // ------------------------------------------------------------------------------------------
  // Helpers: facing, poses, displacement, visuals
  // ------------------------------------------------------------------------------------------

  /** @param {number} dx @param {number} dz */
  _setFacing(dx, dz) {
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) return;
    this.player.facing.set(dx / len, 0, dz / len);
  }

  /**
   * Show a combat pose in the row of the facing (seen from the camera yaw).
   * @param {string} name a column of the player sheet
   */
  _pose(name) {
    const s = this.sprite;
    const col = this.sheet.poses?.[name] ?? 0;
    const f = this.player.facing;
    const dir = Sprite3D.directionFromVector(f.x, f.z, globalUniforms.uCameraYaw.value, s.direction);
    const row = Math.max(0, DIRECTIONS.indexOf(dir));
    if (col === this._lastCol && row === this._lastRow && s.animation === null) return;
    s.direction = dir;
    s.setFrame(col, row);
    this._lastCol = col;
    this._lastRow = row;
  }

  /** Re-apply the pose row after a camera turn (per frame, while an action runs). */
  refreshPose() {
    if (!this.action || this._lastCol < 0) return;
    const s = this.sprite;
    const f = this.player.facing;
    const dir = Sprite3D.directionFromVector(f.x, f.z, globalUniforms.uCameraYaw.value, s.direction);
    const row = Math.max(0, DIRECTIONS.indexOf(dir));
    if (row !== this._lastRow) {
      s.direction = dir;
      s.setFrame(this._lastCol, row);
      this._lastRow = row;
    }
  }

  /**
   * Move a total of `dist` u along (dx, dz), eased out between frames f0 and f1 (exclusive), by
   * the part of the curve this sub-step covers (`player.moveBy`: walls stop it). One motion per
   * action (lunge, roll, knockback slide); `_moved` is reset when an action starts.
   * @param {number} dist
   * @param {number} f0
   * @param {number} f1
   * @param {number} dx
   * @param {number} dz
   */
  _moveAlong(dist, f0, f1, dx, dz) {
    if (!(dist > 0)) return;
    const t0 = F(f0);
    const t1 = F(f1);
    const u = Math.max(0, Math.min(1, (this.t - t0) / (t1 - t0)));
    const target = ease(u) * dist;
    const step = target - this._moved;
    this._moved = target;
    if (step > 1e-6) this.player.moveBy(dx * step, dz * step);
  }

  /**
   * Per-frame visuals: hurt flash (uFlash), i-frame blink (mesh.visible at 15 Hz; the shadow
   * stays), the row after camera turns.
   * @param {number} dt combat seconds this frame (0 while paused / in hit-stop)
   * @param {number} [time] combat clock (blink phase)
   */
  _applyVisuals(dt, time = 0) {
    const s = this.sprite;
    if (!s) return;
    if (this.flashT > 0) {
      this.flashT = Math.max(0, this.flashT - dt);
      s.setFlash(PLAYER_FLASH.r, PLAYER_FLASH.g, PLAYER_FLASH.b, PLAYER_FLASH.a);
    } else s.setFlash(0, 0, 0, 0);
    if (this.blink && this.iframes <= 0) this.blink = false;
    s.mesh.visible = !(this.blink && this.alive && Math.floor(time * BLINK_HZ * 2) % 2 === 1);
  }
}
