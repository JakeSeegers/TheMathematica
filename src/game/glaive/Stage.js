import { DIRECTIONS } from '../../engine/index.js';
import { t } from '../../engine/i18n/I18n.js';

/**
 * Stage — shows a turn-based fight (docs/specs/GLAIVE.md §8.3). The encounter hands GlaiveCombat a
 * list of beats for every step (a move, an attack roll, damage, a save …); the stage plays them one
 * after another as short timed steps: actors walk their paths, wind up and strike, numbers rise,
 * effects flash, the roll appears in the log. While it is busy the fight waits; when its queue is
 * empty GlaiveCombat asks the encounter for the next step (or the player for an action).
 *
 * Actors are reached through `sys.actorOf(id)`: a `Foe`, or a `PcActor` (the player, a companion)
 * made here around a character sprite.
 */

/** @import { Beat } from './Encounter.js' */
/** @import { GlaiveCombat } from './GlaiveCombat.js' */

/** Walk speed of every actor in a fight (u/s): brisk, so turns do not drag. */
export const FIGHT_WALK = 5.2;
/** Seconds of the steps. */
const T = Object.freeze({
  windup: 0.16, strike: 0.2, shot: 0.28, after: 0.12, damage: 0.22, dead: 0.38, save: 0.32, cast: 0.34,
  condition: 0.14, turn: 0.12, foeTurn: 0.28, round: 0.32, summon: 0.4, phase: 1.0, telegraph: 0.7, furnace: 0.7,
  flee: 0.5, heal: 0.3, log: 0.05, injury: 0.5, end: 0.3,
});

/**
 * A party member's or the player's figure in a fight: walks a path, holds a combat pose, flashes,
 * lies down. The character combat sheet's `poses` map names the columns.
 */
export class PcActor {
  /**
   * @param {any} sprite a Sprite3D with a combat character sheet
   * @param {(x: number, z: number) => number} ground
   */
  constructor(sprite, ground) {
    this.sprite = sprite;
    this.position = sprite.position;
    this.ground = ground;
    this.labelY = 2.2;
    this.radius = 0.3;
    /** @type {number[]} */
    this._path = [];
    this._i = 0;
    this._speed = FIGHT_WALK;
    this._flashT = 0;
    this._poseCol = -1;
    this.isDown = false;
  }

  get walking() { return this._i < this._path.length; }

  /** @param {number[]} points @param {number} [speed] */
  walkPath(points, speed = FIGHT_WALK) {
    this._path = points.slice(2);
    this._i = 0;
    this._speed = speed;
    let len = 0;
    for (let i = 2; i + 1 < points.length; i += 2) len += Math.hypot(points[i] - points[i - 2], points[i + 1] - points[i - 1]);
    if (this._path.length) { this._poseCol = -1; this.sprite.play('walk'); }
    return len / speed;
  }

  /** @param {number} x @param {number} z */
  face(x, z) {
    const dx = x - this.position.x, dz = z - this.position.z;
    if (Math.hypot(dx, dz) < 1e-6) return;
    this.sprite.faceVector(dx, dz);
    if (this._poseCol >= 0) this._apply();
  }

  /** @param {string|null} name */
  pose(name) {
    if (!name) { this._poseCol = -1; this.sprite.play(this.isDown ? 'idle' : 'idle'); return; }
    const poses = this.sprite.sheet?.poses ?? {};
    const col = poses[name];
    if (col === undefined) return;
    this._poseCol = col;
    this._apply();
  }

  _apply() {
    this.sprite.setFrame(this._poseCol, Math.max(0, DIRECTIONS.indexOf(this.sprite.direction)));
  }

  /** @param {number} [time] @param {number[]} [rgb] */
  flash(time = 0.18, rgb = [2.0, 0.35, 0.3]) {
    this._flashT = time;
    this._rgb = rgb;
  }

  /** @param {number} dt */
  update(dt) {
    if (this._flashT > 0) {
      this._flashT = Math.max(0, this._flashT - dt);
      const c = this._rgb ?? [2, 2, 2];
      this.sprite.setFlash?.(c[0], c[1], c[2], this._flashT > 0 ? 0.7 : 0);
    }
    if (!this.walking) return;
    let left = this._speed * dt;
    const p = this.position;
    while (left > 1e-6 && this._i < this._path.length) {
      const tx = this._path[this._i], tz = this._path[this._i + 1];
      const dx = tx - p.x, dz = tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d <= left) { p.x = tx; p.z = tz; left -= d; this._i += 2; } else { p.x += (dx / d) * left; p.z += (dz / d) * left; left = 0; }
      if (d > 1e-4) this.sprite.faceVector(dx, dz);
    }
    if (!this.walking) {
      this._path = [];
      this._i = 0;
      if (this.isDown) this.pose('down'); else this.sprite.play('idle');
    }
  }

  /** Put it at (x, z) at once. @param {number} x @param {number} z */
  place(x, z) {
    this.position.x = x;
    this.position.z = z;
    this.position.y = this.ground(x, z);
  }

  /** Out of Action: on the ground. */
  down() { this.isDown = true; this._path = []; this._i = 0; this.pose('down'); }

  /** Back up. */
  up() { this.isDown = false; this._poseCol = -1; this.sprite.play('idle'); }
}

/**
 * One timed step of the stage.
 * @typedef {{ dur: number, start?: () => (number|void), tick?: (dt: number) => void }} StageStep
 */

export class Stage {
  /** @param {GlaiveCombat} sys */
  constructor(sys) {
    this.sys = sys;
    /** @type {StageStep[]} */
    this.queue = [];
    /** @type {StageStep|null} */
    this.step = null;
    this.t = 0;
    /** Marker handles by owner key ('furnace:<id>', 'hazard:<n>', 'turn'). @type {Map<string, number>} */
    this.marks = new Map();
    /** The speed-up: 1 normal, higher plays the steps faster (the fast-forward key, tests). */
    this.pace = 1;
  }

  /** Steps waiting or running. */
  get busy() { return !!this.step || this.queue.length > 0; }

  /** Drop everything (a fight that ends at once, a reset). */
  clear() {
    this.queue.length = 0;
    this.step = null;
    for (const h of this.marks.values()) this.sys.markerFreeCore(h);
    this.marks.clear();
  }

  /** @param {number} dt */
  update(dt) {
    const k = dt * this.pace;
    for (let guard = 0; guard < 64; guard++) {
      if (!this.step) {
        const next = this.queue.shift();
        if (!next) return;
        this.step = next;
        this.t = 0;
        const d = next.start?.();
        if (typeof d === 'number' && d > next.dur) next.dur = d;
      }
      this.step.tick?.(k);
      this.t += k;
      if (this.t + 1e-9 < this.step.dur) return;
      this.step = null;
    }
  }

  /** @param {StageStep} s */
  _push(s) { this.queue.push(s); }

  /** A pause. @param {number} dur */
  wait(dur) { this._push({ dur }); }

  /**
   * Queue the beats of one encounter step.
   * @param {Beat[]} beats
   */
  play(beats) {
    const sys = this.sys;
    for (let i = 0; i < beats.length; i++) {
      const b = beats[i];
      const fn = this[`_b_${b.t}`];
      if (typeof fn === 'function') fn.call(this, b, beats, i);
      sys.log.beat(b);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Beats (one method per beat type; GLAIVE.md §5.6)
  // ---------------------------------------------------------------------------------------------

  /** @param {Beat} b */
  _b_round(b) {
    const sys = this.sys;
    this._push({ dur: T.round, start: () => { sys.hud.set(sys._orderEntries(), null); } });
  }

  /** @param {Beat} b */
  _b_turn(b) {
    const sys = this.sys;
    const foe = sys.combatantOf(b.who)?.side === 'foe';
    this._push({
      dur: foe ? T.foeTurn : T.turn,
      start: () => {
        sys.hud.set(null, b.who);
        const a = sys.actorOf(b.who);
        if (!a) return;
        this._mark('turn', { shape: 'ring', x: a.position.x, z: a.position.z, r: 0.75, rInner: 0.55, style: foe ? 'enemy' : 'player', progress: 1, alpha: 0.9 });
      },
    });
  }

  /** @param {Beat} b */
  _b_move(b) {
    const sys = this.sys;
    this._push({
      dur: 0.05,
      start: () => {
        const a = sys.actorOf(b.who);
        if (!a || !Array.isArray(b.points) || b.points.length < 4) return 0.05;
        this._unmark('turn');
        return a.walkPath(b.points, FIGHT_WALK) + 0.05;
      },
    });
  }

  /** @param {Beat} b */
  _b_teleport(b) {
    const sys = this.sys;
    this._push({
      dur: 0.35,
      start: () => {
        const a = sys.actorOf(b.who);
        if (!a) return;
        sys.burst('magicBurst', a.position.x, a.position.y + 1, a.position.z, 14);
        a.place(b.x, b.z, (x, z) => sys.groundAt(x, z));
        sys.burst('magicBurst', b.x, sys.groundAt(b.x, b.z) + 1, b.z, 14);
        sys.sfxAt('bolt', b.x, b.z);
      },
    });
  }

  /** @param {Beat} b @param {Beat[]} beats @param {number} i */
  _b_attack(b, beats, i) {
    const sys = this.sys;
    const ranged = !!b.ranged;
    // a melee wind-up, then the swing or the shot
    this._push({
      dur: T.windup,
      start: () => {
        const a = sys.actorOf(b.who), v = sys.actorOf(b.target);
        if (!a || !v) return;
        a.face(v.position.x, v.position.z);
        a.pose(sys.poseFor(b.who, ranged ? 'aim' : 'windup'));
      },
    });
    this._push({
      dur: ranged ? T.shot : T.strike,
      start: () => {
        const a = sys.actorOf(b.who), v = sys.actorOf(b.target);
        if (!a || !v) return;
        a.pose(sys.poseFor(b.who, ranged ? 'release' : 'attack'));
        const dx = v.position.x - a.position.x, dz = v.position.z - a.position.z;
        const l = Math.hypot(dx, dz) || 1;
        if (ranged) {
          sys.shot(a.position, v.position, T.shot);
          sys.sfxAt('arrow', a.position.x, a.position.z, { volume: 0.7 });
        } else {
          sys.fx.play(b.crit ? 'slashBig' : 'slash', a.position.x + (dx / l) * 0.7, a.position.y + 0.9, a.position.z + (dz / l) * 0.7, { dirX: dx / l, dirZ: dz / l });
          sys.sfxAt(b.crit ? 'swingHeavy' : 'swing', a.position.x, a.position.z);
        }
        if (!b.hit) {
          sys.number(v.position.x, v.position.y + v.labelY, v.position.z, t('glaive.word.miss'), 'mp');
          sys.sfxAt('dodge', v.position.x, v.position.z, { volume: 0.6 });
        }
        if (b.crit) sys.number(v.position.x, v.position.y + v.labelY + 0.4, v.position.z, t('glaive.word.crit'), 'crit');
        // research mode: this strike went into the ledger
        if (b.recorded) sys.onRecordedStrike?.(b);
      },
    });
    // the swing ends in its pose a moment, then back to idle (unless something follows at once)
    const next = beats[i + 1];
    this._push({
      dur: T.after,
      start: () => {
        if (next && next.t === 'damage' && next.who === b.target) return;
        sys.actorOf(b.who)?.pose(null);
      },
    });
  }

  /** @param {Beat} b */
  _b_damage(b) {
    const sys = this.sys;
    this._push({
      dur: T.damage,
      start: () => {
        const v = sys.actorOf(b.who);
        if (!v) return;
        const party = sys.combatantOf(b.who)?.side === 'party';
        sys.number(v.position.x, v.position.y + v.labelY, v.position.z, String(b.amount), party ? 'hurt' : b.kind === 'physical' ? 'dmg' : 'crit');
        v.flash(0.2, party ? [2.0, 0.35, 0.3] : [2.2, 2.2, 2.2]);
        if (b.amount > 0) {
          v.pose(sys.poseFor(b.who, 'hurt'));
          sys.burst('hitSpark', v.position.x, v.position.y + 0.9, v.position.z, 8);
          sys.sfxAt(party ? 'hurt' : 'hit', v.position.x, v.position.z, { volume: 0.8 });
          if (party && b.who === 'player') { sys.shake(0.12, 0.18); sys.look.pulseHurt(); }
        }
        sys.refreshBars();
      },
    });
    this._push({ dur: 0.08, start: () => { const v = sys.actorOf(b.who); if (v && !(v instanceof PcActor && v.isDown) && sys.combatantOf(b.who)?.state === 'active') v.pose(null); } });
    // the attacker back to idle too
    this._push({ dur: 0.01, start: () => { if (b.from) sys.actorOf(b.from)?.pose(null); } });
  }

  /** @param {Beat} b */
  _b_heal(b) {
    const sys = this.sys;
    this._push({
      dur: T.heal,
      start: () => {
        const v = sys.actorOf(b.who);
        if (!v) return;
        if (b.amount > 0) sys.number(v.position.x, v.position.y + v.labelY, v.position.z, `+${b.amount}`, 'heal');
        sys.burst('healGlow', v.position.x, v.position.y + 0.8, v.position.z, 12);
        sys.sfxAt('drink', v.position.x, v.position.z, { volume: 0.7 });
        sys.refreshBars();
      },
    });
  }

  /** @param {Beat} b */
  _b_dead(b) {
    const sys = this.sys;
    this._push({ dur: T.dead, start: () => sys.onDeath(b.who) });
  }

  /** @param {Beat} b */
  _b_down(b) {
    const sys = this.sys;
    this._push({ dur: T.dead, start: () => sys.onDown(b.who) });
  }

  /** @param {Beat} b */
  _b_up(b) {
    const sys = this.sys;
    this._push({ dur: 0.2, start: () => { const a = sys.actorOf(b.who); if (a instanceof PcActor) a.up(); } });
  }

  /** @param {Beat} b */
  _b_save(b) {
    const sys = this.sys;
    if (b.reason?.startsWith('cast:')) return;
    this._push({
      dur: T.save,
      start: () => {
        const v = sys.actorOf(b.who);
        if (!v) return;
        sys.number(v.position.x, v.position.y + v.labelY + 0.3, v.position.z, t(b.roll.success ? 'glaive.word.saved' : 'glaive.word.failed'), b.roll.success ? 'heal' : 'mp');
      },
    });
  }

  /** @param {Beat} b */
  _b_condition(b) {
    const sys = this.sys;
    if (!b.on || ['defending', 'feinting', 'rushing', 'inspired'].includes(b.id)) {
      if (b.on) this._push({ dur: T.condition, start: () => { const v = sys.actorOf(b.who); if (v) sys.number(v.position.x, v.position.y + v.labelY + 0.3, v.position.z, t(`glaive.cond.${b.id}`), 'heal'); } });
      if (!b.on && b.id === 'prone') this._push({ dur: 0.05, start: () => sys.actorOf(b.who)?.pose(null) });
      return;
    }
    this._push({
      dur: T.condition,
      start: () => {
        const v = sys.actorOf(b.who);
        if (!v) return;
        sys.number(v.position.x, v.position.y + v.labelY + 0.3, v.position.z, t(`glaive.cond.${b.id}`), 'mp');
        if (b.id === 'prone') v.pose(sys.poseFor(b.who, 'prone'));
        if (b.id === 'unconscious' || b.id === 'stunned') sys.fx.play('stun', v.position.x, v.position.y + v.labelY, v.position.z, { duration: 1.2 });
      },
    });
  }

  /** @param {Beat} b */
  _b_cast(b) {
    const sys = this.sys;
    this._push({
      dur: T.cast,
      start: () => {
        const a = sys.actorOf(b.who);
        if (!a) return;
        a.face(b.x, b.z);
        a.pose(sys.poseFor(b.who, 'cast'));
        sys.burst('magicBurst', a.position.x, a.position.y + 1.2, a.position.z, 10);
        sys.sfxAt('bolt', a.position.x, a.position.z, { volume: 0.8 });
      },
    });
    this._push({
      dur: 0.3,
      start: () => {
        const y = sys.groundAt(b.x, b.z);
        sys.burst(b.spell === 'cinderBurst' || b.spell === 'emberDart' ? 'emberBurst' : 'magicBurst', b.x, y + 0.8, b.z, 16);
        if (b.spell === 'cinderBurst' || b.spell === 'slumber' || b.spell === 'dread') {
          const h = sys.markerAllocCore();
          if (h >= 0) {
            sys.markerSetCore(h, { shape: 'circle', x: b.x, z: b.z, r: sys.zoneR, style: 'player', progress: 1 });
            sys.later(0.5, () => sys.markerFreeCore(h));
          }
        }
        if (!b.success) {
          const a = sys.actorOf(b.who);
          if (a) sys.number(a.position.x, a.position.y + a.labelY + 0.3, a.position.z, t('glaive.word.fizzle'), 'mp');
        }
        sys.actorOf(b.who)?.pose(null);
      },
    });
  }

  /** @param {Beat} b */
  _b_monsterSpell(b) {
    this._b_cast({ ...b, t: 'cast', success: true, x: this.sys.actorOf(b.target)?.position.x ?? 0, z: this.sys.actorOf(b.target)?.position.z ?? 0 });
  }

  /** @param {Beat} b */
  _b_draught(b) {
    const sys = this.sys;
    this._push({ dur: 0.3, start: () => { const a = sys.actorOf(b.who); if (a) { a.pose(sys.poseFor(b.who, 'cast')); sys.audio.playSfx('drink', { volume: 0.6 }); } } });
  }

  /** @param {Beat} b */
  _b_talent(b) {
    const sys = this.sys;
    this._push({
      dur: 0.3,
      start: () => {
        const a = sys.actorOf(b.who);
        if (!a) return;
        sys.number(a.position.x, a.position.y + a.labelY + 0.5, a.position.z, t(`glaive.talent.${b.id}.name`), 'heal');
        if (b.id === 'rage') sys.burst('emberBurst', a.position.x, a.position.y + 1, a.position.z, 14);
        if (b.id === 'radiance') sys.burst('sparkle', a.position.x, a.position.y + 1, a.position.z, 18);
      },
    });
  }

  /** @param {Beat} b */
  _b_maneuver(b) {
    if (b.name !== 'defend') return;
    const sys = this.sys;
    this._push({ dur: 0.25, start: () => { const a = sys.actorOf(b.who); if (a) sys.number(a.position.x, a.position.y + a.labelY + 0.3, a.position.z, t('glaive.cond.defending'), 'heal'); } });
  }

  /** @param {Beat} b */
  _b_charge(b) {
    const sys = this.sys;
    this._push({ dur: 0.05, start: () => { const a = sys.actorOf(b.who); if (a) sys.sfxAt('boarCharge', a.position.x, a.position.z); } });
  }

  /** @param {Beat} b */
  _b_immune(b) {
    const sys = this.sys;
    this._push({ dur: 0.18, start: () => { const v = sys.actorOf(b.who); if (v) sys.number(v.position.x, v.position.y + v.labelY + 0.3, v.position.z, t('glaive.word.immune'), 'mp'); } });
  }

  /** @param {Beat} b */
  _b_lostTurn(b) {
    const sys = this.sys;
    this._push({ dur: 0.22, start: () => { const v = sys.actorOf(b.who); if (v) sys.number(v.position.x, v.position.y + v.labelY + 0.3, v.position.z, t(`glaive.lost.${b.reason}`), 'mp'); } });
  }

  /** @param {Beat} b */
  _b_surprised(b) {
    const sys = this.sys;
    this._push({ dur: 0.08, start: () => { const v = sys.actorOf(b.who); if (v) sys.alert(v.position, v.labelY); } });
  }

  /** @param {Beat} b */
  _b_morale(b) {
    if (!b.broke) return;
    const sys = this.sys;
    this._push({ dur: 0.2, start: () => { const v = sys.actorOf(b.who); if (v) sys.number(v.position.x, v.position.y + v.labelY + 0.3, v.position.z, t('glaive.word.breaks'), 'mp'); } });
  }

  /** @param {Beat} b */
  _b_flee(b) {
    const sys = this.sys;
    this._push({ dur: T.flee, start: () => sys.onRout(b.who, b.points) });
  }

  /** @param {Beat} b */
  _b_summon(b) {
    const sys = this.sys;
    this._push({ dur: T.summon, start: () => sys.onSummon(b.who, b.x, b.z) });
  }

  /** @param {Beat} b */
  _b_phase(b) {
    const sys = this.sys;
    this._push({ dur: T.phase, start: () => sys.onPhase(b.who, b.phase) });
  }

  /** @param {Beat} b */
  _b_telegraph(b) {
    const sys = this.sys;
    this._push({
      dur: T.telegraph,
      start: () => {
        const a = sys.actorOf(b.who);
        if (b.key === 'furnace') {
          a?.pose('slamWind');
          this._mark(`furnace:${b.who}`, { shape: 'circle', x: b.x, z: b.z, r: b.r, style: 'enemy', progress: 0.45 });
          sys.sfxAt('bossRoar', b.x, b.z, { volume: 0.8 });
        } else if (b.key === 'kneel') {
          a?.pose('kneel');
        } else if (b.key === 'roar') {
          a?.pose('roar');
          sys.shake(0.25, 0.5);
        }
        sys.ui.hud.toast(t(`glaive.boss.${b.key}`), 2.2);
      },
    });
    this._push({ dur: 0.05, start: () => { if (b.key !== 'kneel') sys.actorOf(b.who)?.pose(null); } });
  }

  /** @param {Beat} b */
  _b_furnace(b) {
    const sys = this.sys;
    this._push({
      dur: T.furnace,
      start: () => {
        const a = sys.actorOf(b.who);
        a?.pose('slam');
        this._mark(`furnace:${b.who}`, { shape: 'circle', x: b.x, z: b.z, r: b.r, style: 'enemy', progress: 1 });
        const y = sys.groundAt(b.x, b.z);
        sys.burst('emberBurst', b.x, y + 0.6, b.z, 36);
        sys.fx.play('pillar', b.x, y, b.z, { duration: 0.6 });
        sys.shake(0.35, 0.45);
        sys.sfxAt('slam', b.x, b.z, { volume: 1 });
      },
    });
    this._push({ dur: 0.05, start: () => { this._unmark(`furnace:${b.who}`); sys.actorOf(b.who)?.pose(null); } });
  }

  /** @param {Beat} b */
  _b_hazardMark(b) {
    this._push({ dur: 0.25, start: () => { this._mark(`hazard:${b.id}`, { shape: 'circle', x: b.x, z: b.z, r: b.r, style: 'magma', progress: 0.3 }); } });
  }

  /** @param {Beat} b */
  _b_hazardOn(b) {
    const sys = this.sys;
    this._push({ dur: 0.2, start: () => { this._mark(`hazard:${b.id}`, { shape: 'circle', x: b.x, z: b.z, r: b.r, style: 'magma', progress: 1 }); sys.burst('emberBurst', b.x, sys.groundAt(b.x, b.z) + 0.3, b.z, 10); } });
  }

  /** @param {Beat} b */
  _b_hazardOff(b) {
    this._push({ dur: 0.01, start: () => this._unmark(`hazard:${b.id}`) });
  }

  /** @param {Beat} b */
  _b_injury(b) {
    const sys = this.sys;
    this._push({ dur: T.injury, start: () => sys.onInjury(b) });
  }

  /** @param {Beat} b */
  _b_end(b) {
    this._push({ dur: T.end, start: () => this._unmark('turn') });
  }

  // ---------------------------------------------------------------------------------------------
  // Ground markers kept across steps
  // ---------------------------------------------------------------------------------------------

  /** @param {string} key @param {object} spec */
  _mark(key, spec) {
    const sys = this.sys;
    let h = this.marks.get(key);
    if (h === undefined) {
      h = sys.markerAllocCore();
      if (h < 0) return;
      this.marks.set(key, h);
    }
    sys.markerSetCore(h, spec);
  }

  /** @param {string} key */
  _unmark(key) {
    const h = this.marks.get(key);
    if (h === undefined) return;
    this.sys.markerFreeCore(h);
    this.marks.delete(key);
  }

  /** Move the turn ring with its actor (each frame while it stands). */
  followTurn() {
    const h = this.marks.get('turn');
    const id = this.sys.encounter?.current?.id;
    if (h === undefined || !id) return;
    const a = this.sys.actorOf(id);
    if (a) this.sys.markerSetCore(h, { x: a.position.x, z: a.position.z });
  }
}
