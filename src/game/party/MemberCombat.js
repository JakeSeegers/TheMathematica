import { Sprite3D, DIRECTIONS, globalUniforms, RNG, hashString } from '../../engine/index.js';
import { PARTY_CLASSES, presetOf } from '../../engine/level/PartyRules.js';
import { ALLY, KIT, CLASS_STATS, DISTANCE, HEAL_AT, RETREAT_AT } from './rules.js';
import { EPS, F, frameOf, MELEE_DY, SHOT_Y } from '../combat/rules.js';
import { aimVy } from '../combat/Projectiles.js';
import { PLAYER_FLASH, BLINK_HZ } from '../combat/Feel.js';

/**
 * @import { CombatSystem } from '../combat/CombatSystem.js'
 * @import { Enemy } from '../combat/Enemy.js'
 * @import { PlayerView, HitSpec, ProjectileSpec, MarkerSpec, AllyState, AllyAction, PointXZ } from '../combat/types.js'
 * @import { BossArena } from '../combat/BossArena.js'
 * @import { PartyMember } from './PartyMember.js'
 * @import { AllyCombatView } from './types.js'
 * @import { AllyMeleeHit } from './rules.js'
 */

/**
 * A party member's fight (docs/specs/PARTY.md §5; COMBAT.md §28): made by `CombatSystem.addAlly`
 * for a member on a combat level, kept in `combat.allies` and as `member.combat` (the party reads
 * it as an `AllyCombatView`). It owns the member's stats (its class's `CLASS_STATS` at the
 * player's level), HP / MP, its kit (`KIT`: a basic attack, a skill, Mend, a dodge roll), getting
 * hit, going down and getting up, and the AI that picks what to do by the member's combat rule.
 *
 * The combat drives the member while it fights (`active`: the combat is engaged, a foe has it as
 * its target, it is down, an action runs, or the player has fallen); otherwise the party's follow
 * does. `step(h)` runs once per combat sub-step, after the player's kit and before the enemies
 * (CombatSystem._substep): nothing advances while the combat is inactive. Every displacement goes
 * through the member's `moveBy` (the TileMap, radius 0.3, step 0.55; x / z only — the party keeps
 * it on the ground, fights included; the member has no collider of its own) and keeps out of a
 * closed boss arena from outside; inside one it is held in like the player. When it leaves the
 * fight the party's follow takes it back. Poses are the combat sheet's (`sheet.poses`, `sprite.setFrame`, as PlayerCombat shows the
 * player's), locomotion the sheet's animations (`play`).
 *
 * Its hits go through the combat's queues (`addAllyHit`, `spawnAllyProjectile`) and are resolved by
 * `CombatSystem._resolve` with the member's ATK; enemy hits reach it through `_hitAlly`. Effects
 * are the combat's (named FX, bursts, projectiles: warmed at load) — no ground marker, no light, no
 * new material. Randomness comes from its own RNG (`ally:<id>` and the combat seed), so a run in
 * fixed step repeats exactly.
 * @implements {AllyCombatView}
 */
export class MemberCombat {
  /**
   * @param {CombatSystem} sys
   * @param {PartyMember} member
   */
  constructor(sys, member) {
    this.sys = sys;
    this.member = member;
    this.id = member.id;
    /** Marks a party member's fight among hit owners and targets (core's queues). */
    this.isAlly = true;
    /** Removed (`removeAlly`, the combat disposed): it does nothing any more. */
    this.gone = false;
    /** @type {'warden'|'ranger'|'mystic'} */
    this.cls = member.record.cls === 'ranger' || member.record.cls === 'mystic' ? member.record.cls : 'warden';
    this.base = CLASS_STATS[this.cls];
    this.kit = KIT[this.cls];
    /** 'melee' | 'ranged' | 'caster' (PARTY_CLASSES). */
    this.role = PARTY_CLASSES[this.cls]?.role ?? 'melee';
    this.hp = this.hpMax;
    this.mp = this.mpMax;
    /** The party level its HP and MP were last scaled to (`syncLevel`). */
    this._lvl = this.level;
    /** HP 0: it lies down until the fight is over (`ALLY.calm` s), then gets up with `ALLY.getUp`. */
    this.down = false;
    /** Foes it killed. */
    this.kills = 0;
    this.counts = newCounts();
    /** @type {AllyAction|null} the running action */
    this.action = null;
    this.t = 0;
    this.frame = 0;
    this._prevFrame = -1;
    this._moved = 0;
    /** @type {{ dist: number, f0: number, f1: number, dx: number, dz: number }|null} */
    this._motion = null;
    this.atkCd = 0;
    this.skillCd = 0;
    this.healCd = 0;
    this.rollCd = 0;
    this.iframes = 0;
    this.flashT = 0;
    this.blink = false;
    /** Swings started (enemies read it as `ctx.player.swing`). */
    this.swings = 0;
    /** @type {Enemy|null} the foe it goes for */
    this.target = null;
    /** @type {'idle'|'hold'|'attack'|'retreat'|'heal'|'evade'|'wait'|'down'|'stop'} what the AI does (tests) */
    this.mode = 'idle';
    /** @type {MemberCombat|'player'|null} whom its Mend is for */
    this._healWho = null;
    /** @type {Enemy|null} the foe of the running attack */
    this._actTarget = null;
    this._tag = 0;
    this._targeted = false;
    this._calm = 0;
    this._planT = (hashString(`plan:${this.id}`) % 15) / 60;
    /** @type {Map<Enemy, number>} foes given up (unreachable) until a combat-clock time */
    this._skip = new Map();
    /** @type {BossArena|null} the closed arena it stands in */
    this._arena = null;
    /**
     * The spot it holds beside the player (or falls back to): `ok` false = none found (the player's
     * own spot); `px` / `pz` where the player stood when it was planned; `kind` 'hold' / 'retreat'.
     */
    this._hold = { x: 0, z: 0, ok: false, px: 0, pz: 0, kind: '' };
    /** It walks to its hold spot (it set off beyond `ALLY.holdSlack` and has not arrived). */
    this._holdWalk = false;
    /** The foe it faces while it holds (kept while it stays about as near the player). @type {Enemy|null} */
    this._lookAt = null;
    /**
     * A melee member's spot round its target (`_meleeSpot`): the angle from the foe, whether it
     * stands in front of the player on screen, the foe it is for, the spot now.
     * @type {{ a: number, ok: boolean, cover: boolean, t: Enemy|null, x: number, z: number }}
     */
    this._mspot = { a: 0, ok: false, cover: false, t: null, x: 0, z: 0 };
    /** Stepping to a free melee spot between thrusts, and the time until the next such step. */
    this._reloc = false;
    this._relocT = 0;
    /** At its spot but out of its target's reach (in height) this long; for that foe. */
    this._noReachT = 0;
    /** @type {Enemy|null} */
    this._noReachFor = null;
    /** `_goTo`'s last move: where from, the way, the step and the sub-step (its net progress is read at the next). */
    this._gp = { x: 0, z: 0, ux: 0, uz: 0, step: 0, sub: -2 };
    /** A shot's target tracked while it aims: its last spot and smoothed velocity (u/s). @type {{ t: Enemy|null, x: number, z: number, vx: number, vz: number }} */
    this._trk = { t: null, x: 0, z: 0, vx: 0, vz: 0 };
    this._ndc = { x: 0, y: 0 };
    this._stuckT = 0;
    this._path = new Float32Array(48);
    this._pathN = 0;
    this._pathI = 0;
    this._pathGX = 0;
    this._pathGZ = 0;
    this._pathAt = -Infinity;
    this._lastCol = -1;
    this._lastRow = -1;
    this._anim = '';
    this._flashOn = false;
    this._speedSet = false;
    this._prevX = member.position.x;
    this._prevZ = member.position.z;
    /** `_leashed`'s result. */
    this._goal = { x: 0, z: 0 };
    /** A shooter's spot (`_shotSpot`), the foe it is for, whether it is on screen. @type {{ x: number, z: number, ok: boolean, on: boolean, t: Enemy|null }} */
    this._spot = { x: 0, z: 0, ok: false, on: false, t: null };
    this._esc = { x: 0, z: 0 };
    this._near = /** @type {Enemy[]} */ ([]);
    /** Pending Flare bursts (mystic): spot, ground, seconds left, tag; `on` false = free. */
    this._flares = [0, 1, 2].map(() => ({ on: false, x: 0, y: 0, z: 0, t: 0, tag: 0 }));
    /** @type {HitSpec} its hitbox record (the queue copies it) */
    this._spec = {
      shape: 'sector', x: 0, y: 0, z: 0, r: 1, rInner: 0, dirX: 0, dirZ: 1, halfAngle: 60, len: 1, width: 1,
      dy: MELEE_DY, mv: 1, kb: 0, poise: 0, knockdown: false, flat: 0, thin: false, tag: 0, fromX: 0, fromZ: 0,
    };
    /** @type {ProjectileSpec} its shot record (the pool copies it) */
    this._proj = { kind: 'arrow', x: 0, y: 0, z: 0, dirX: 0, dirZ: 1, vy: 0, speed: 16, range: 12, radius: 0.25, mv: 1, kb: 0, poise: 0, pierce: false, splash: null, arc: null };
    /** @type {PlayerView} the member as the enemies that target it see it (`ctx.player`, PARTY.md §5.3) */
    this.view = {
      position: member.position, radius: ALLY.radius, body: [ALLY.body[0], ALLY.body[1]], facing: { x: 0, z: 1 },
      velocity: { x: 0, z: 0 }, alive: true, invulnerable: false, dodging: false, action: null, swing: 0, sealed: false,
    };
    this.reseed(sys.seedValue);
    this._syncView();
  }

  // ------------------------------------------------------------------------------------------
  // Stats
  // ------------------------------------------------------------------------------------------

  /** The party's level: the player's. */
  get level() { return this.sys.pc?.level ?? 1; }
  get hpMax() { return this._hpAt(this.level); }
  get mpMax() { return this._mpAt(this.level); }
  /** Max HP at party level `lv`. @param {number} lv */
  _hpAt(lv) { return Math.round(this.base.hp + this.base.perLevel.hp * (lv - 1)); }
  /** Max MP at party level `lv`. @param {number} lv */
  _mpAt(lv) { return Math.round(this.base.mp + this.base.perLevel.mp * (lv - 1)); }

  /**
   * The party's level changed (the player's: a level-up, a campaign's progress restored on
   * arrival, the `setPlayer` hook): HP and MP keep their fractions of the new maxima (a member that
   * came in full at the fresh combat's level 1 is full at the player's level). A downed member
   * stays at 0. Called by the combat where the level changes, and at each sub-step and `info()`.
   * @returns {boolean} it changed
   */
  syncLevel() {
    const lv = this.level;
    const was = this._lvl;
    if (lv === was) return false;
    this._lvl = lv;
    const h0 = this._hpAt(was);
    const m0 = this._mpAt(was);
    if (!this.down) this.hp = Math.min(this.hpMax, h0 > 0 ? (this.hp / h0) * this.hpMax : this.hpMax);
    this.mp = Math.min(this.mpMax, m0 > 0 ? (this.mp / m0) * this.mpMax : this.mpMax);
    return true;
  }
  /** ATK at the party's level, × `ALLY.partyAtk` by how many members fight. */
  get atk() {
    const n = Math.max(1, Math.min(ALLY.partyAtk.length, this.sys.allies.length));
    return (this.base.atk + this.base.perLevel.atk * (this.level - 1)) * ALLY.partyAtk[n - 1];
  }
  get def() { return this.base.def + this.base.perLevel.def * (this.level - 1); }
  /** The member's combat rule (its record's, live: the panel and the story change it). */
  get rule() { return this.member.record.rule; }
  /** Its live position (the sprite's). */
  get position() { return this.member.position; }
  get radius() { return ALLY.radius; }

  /** The combat drives the member now (PARTY.md §5.1): the follow waits. */
  get active() {
    if (this.gone || !this.member.sprite) return false;
    const m = this.member;
    if (m.directed || m.talking) return false;
    const sys = this.sys;
    if (this.down || this.action !== null || this._targeted || !sys.pc.alive) return true;
    if (sys.sealedArena()) return true;
    if (!sys.engaged) return false;
    // left far behind (a teleport, a long fall): the follow catches it up (or puts it behind the player)
    const P = sys.player.position;
    const p = m.position;
    return Math.hypot(p.x - P.x, p.z - P.z) <= FAR_BEHIND;
  }

  /** Enemy hits pass through it now: down, i-frames, rolling, the player fallen, `allyGod`. */
  get invulnerable() {
    if (this.down || this.iframes > 0 || this.sys.allyGod || !this.sys.pc.alive) return true;
    if (this.action === 'roll') {
      const w = ALLY.roll.iframes;
      return this.frame >= w[0] && this.frame <= w[1];
    }
    return this.action === 'knock';
  }

  /** Can an enemy hit or shot reach it now? */
  get hittable() {
    return !this.gone && !!this.member.sprite && !this.member.directed && !this.invulnerable;
  }

  /** In the world for hits at all (attached, not removed, not down). */
  get present() {
    return !this.gone && !!this.member.sprite && !this.down;
  }

  // ------------------------------------------------------------------------------------------
  // The AllyCombatView members and core's notifications
  // ------------------------------------------------------------------------------------------

  /** Full HP / MP, up again, action cleared (a rest, a respawn, the story's `heal`). */
  refill() {
    this._lvl = this.level;
    this.hp = this.hpMax;
    this.mp = this.mpMax;
    this.down = false;
    this._endAction();
    this.iframes = 0;
    this.flashT = 0;
    this.blink = false;
    if (this.member.sprite) this.member.sprite.mesh.visible = true;
    this._play('idle', true);
    this._syncView();
  }

  /** The member was put somewhere else at once (a teleport, a travel's arrival, a respawn). */
  onTeleport() {
    if (!this.down) this._endAction();
    this.target = null;
    this._healWho = null;
    this._pathN = 0;
    this._stuckT = 0;
    this._planT = 0;
    this._hold.ok = false;
    this._hold.kind = '';
    this._holdWalk = false;
    this._spot.t = null;
    this._spot.ok = false;
    this._mspot.t = null;
    this._mspot.ok = false;
    this._reloc = false;
    this._noReachT = 0;
    this._gp.sub = -2;
    this._trk.t = null;
    const p = this.member.position;
    this._prevX = p.x;
    this._prevZ = p.z;
    this.view.velocity.x = 0;
    this.view.velocity.z = 0;
    if (!this.down) this._play('idle', true);
    this._syncView();
  }

  /** The player fell: stop where it stands (invulnerable until the respawn). */
  onPlayerDeath() {
    if (this.down) return;
    this._endAction();
    this.target = null;
    this.mode = 'stop';
    this._play('idle', true);
  }

  /** New seed (the `seed` and `reset` hooks): its own RNG from its id and the combat seed. */
  reseed(seed) {
    this.rng = new RNG((hashString(`ally:${this.id}`) ^ (Number(seed) >>> 0)) >>> 0);
  }

  /**
   * Back to a fresh fight (the `reset` hook, a reproducible start): full, no kills, counters,
   * cooldowns, timers and plans cleared, facing +z, its RNG from the seed.
   */
  reset() {
    this.refill();
    this.kills = 0;
    this.counts = newCounts();
    this.atkCd = this.skillCd = this.healCd = this.rollCd = 0;
    this.swings = 0;
    this.target = null;
    this.mode = 'idle';
    this._healWho = null;
    this._actTarget = null;
    this._targeted = false;
    this._calm = 0;
    this._skip.clear();
    this._arena = null;
    this._pathAt = -Infinity;
    this._anim = '';
    this._lookAt = null;
    this._relocT = 0;
    this._noReachFor = null;
    for (const f of this._flares) f.on = false;
    this._planT = (hashString(`plan:${this.id}`) % 15) / 60;
    this.member.facing.x = 0;
    this.member.facing.z = 1;
    this.onTeleport();
    this.reseed(this.sys.seedValue);
  }

  /** Out of the combat (removeAlly, dispose): the sprite's look back to plain. */
  release() {
    this.gone = true;
    this.target = null;
    const s = this.member.sprite;
    if (s) {
      s.setFlash(0, 0, 0, 0);
      s.mesh.visible = true;
      if (this._speedSet) s.speed = 1;
      if (this.action || this.down || this._lastCol >= 0) s.play('idle');
    }
    this._speedSet = false;
    this.action = null;
    if (this.member.combat === this) this.member.combat = null;
  }

  /**
   * Heal (capped) with a green number; a downed member is not raised (it gets up after the fight).
   * @param {number} amount
   * @returns {number} HP gained
   */
  heal(amount) {
    if (this.down || this.gone) return 0;
    const before = this.hp;
    this.hp = Math.min(this.hpMax, this.hp + Math.max(0, amount));
    const got = Math.round(this.hp - before);
    const p = this.member.position;
    if (got > 0) this.sys.number(p.x, p.y + 1.9, p.z, `+${got}`, 'heal');
    return got;
  }

  // ------------------------------------------------------------------------------------------
  // Sub-step
  // ------------------------------------------------------------------------------------------

  /**
   * One combat sub-step (player-scaled seconds), after the player's kit and before the enemies.
   * @param {number} h
   */
  step(h) {
    const m = this.member;
    if (this.gone || !m.sprite || m.combat !== this) return;
    const sys = this.sys;
    this.syncLevel();
    this._stepFlares(h);
    if (m.directed || m.talking) {
      this._targeted = false;
      return;
    }
    // timers
    if (this.atkCd > 0) this.atkCd = Math.max(0, this.atkCd - h);
    if (this.skillCd > 0) this.skillCd = Math.max(0, this.skillCd - h);
    if (this.healCd > 0) this.healCd = Math.max(0, this.healCd - h);
    if (this.rollCd > 0) this.rollCd = Math.max(0, this.rollCd - h);
    if (this.iframes > 0) this.iframes = Math.max(0, this.iframes - h);
    if (this._relocT > 0) this._relocT = Math.max(0, this._relocT - h);
    // in a fight: the combat engaged, or a foe after it
    this._targeted = sys.isTargeted(this);
    const fighting = sys.engaged || this._targeted;
    if (fighting || !sys.pc.alive) this._calm = 0;
    else this._calm += h;
    if (this._calm >= ALLY.calm - EPS) {
      if (this.down) this._getUp();
      else {
        this.hp = Math.min(this.hpMax, this.hp + this.hpMax * ALLY.regen * h);
        this.mp = Math.min(this.mpMax, this.mp + this.mpMax * ALLY.regen * h);
      }
    } else if (!this.down) this.mp = Math.min(this.mpMax, this.mp + ALLY.mpRegen * h);
    if (this.hp > this.hpMax) this.hp = this.hpMax;
    if (this.mp > this.mpMax) this.mp = this.mpMax;
    // the closed arena it stands in (held there like the player)
    const sealed = sys.sealedArena();
    this._arena = sealed && sealed.contains(m.position.x, m.position.z) ? sealed : null;

    if (!sys.pc.alive) {
      // the player fell: stand still until the respawn
      if (!this.down && this.action && this.action !== 'hurt' && this.action !== 'knock') this._endAction();
      if (this.action) this._advance(h);
      else if (!this.down) {
        this.mode = 'stop';
        this._play('idle');
      }
      this._syncView();
      return;
    }
    if (this.down) {
      this.mode = 'down';
      this._pose('down');
      this._syncView();
      return;
    }
    if (this.action) {
      this._advance(h);
      if (this.action) {
        this._syncView();
        return;
      }
    }
    if (!this.active) {
      // the follow drives it (and plays its own animations: the next `_play` starts afresh)
      this.mode = 'idle';
      this.target = null;
      this._pathN = 0;
      this._stuckT = 0;
      this._anim = '';
      this._gp.sub = -2;
      this._holdWalk = false;
      this._reloc = false;
      this._syncView();
      return;
    }
    this._think(h);
    this._syncView();
  }

  /** The view enemies read when they target this member. */
  _syncView() {
    const v = this.view;
    const m = this.member;
    v.position = m.position;
    v.facing.x = m.facing.x;
    v.facing.z = m.facing.z;
    v.alive = !this.down && !this.gone;
    v.invulnerable = this.invulnerable;
    v.dodging = this.action === 'roll';
    v.action = viewAction(this.action);
    v.swing = this.swings;
    v.sealed = this.sys._pv?.sealed ?? false;
  }

  // ------------------------------------------------------------------------------------------
  // The AI (PARTY.md §5.4)
  // ------------------------------------------------------------------------------------------

  /** @param {number} h */
  _think(h) {
    const sys = this.sys;
    const rule = this.rule;
    const kit = this.kit;
    this._planT -= h;
    const replan = this._planT <= 0;
    if (replan) this._planT = Math.max(this._planT + ALLY.planEvery, 0.05);
    // a closed arena it is not in: wait outside the gate
    const sealed = sys.sealedArena();
    if (sealed && !this._arena) {
      this.mode = 'wait';
      this.target = null;
      this._waitAtGate(sealed, h);
      return;
    }
    // evade: out of a filling telegraph
    if (rule.evade === 'on' && this.rollCd <= 0 && this._evade()) return;
    // heal
    const healAt = HEAL_AT[rule.heal] ?? 0;
    if (healAt > 0 && this.healCd <= 0 && this.mp >= kit.mend.mp - EPS) {
      if (replan || !this._healOk(this._healWho, healAt)) this._healWho = this._pickHeal(healAt);
      const who = this._healWho;
      if (who) {
        const q = who === 'player' ? sys.player.position : who.position;
        const p = this.member.position;
        this.mode = 'heal';
        if (Math.hypot(q.x - p.x, q.z - p.z) <= kit.mend.range) {
          this._startMend();
          return;
        }
        this._goTo(q.x, q.z, h, kit.mend.range - 1);
        return;
      }
    } else this._healWho = null;
    // fall back: behind the player, away from the foes
    if (this.hp < this.hpMax * (RETREAT_AT[rule.retreat] ?? 0)) {
      this.mode = 'retreat';
      this.target = null;
      this._retreat(h, replan);
      return;
    }
    // fight (the target picked on the plan's beat, and at once when the one it has stops being valid)
    if (rule.attack !== 'never') {
      if (replan || (this.target !== null && !this._candidate(this.target))) this.target = this._pickTarget();
      const t = this.target;
      if (t && this._fight(t, h, replan)) {
        this.mode = 'attack';
        return;
      }
    } else this.target = null;
    this.mode = 'hold';
    this._holdSpot(h, replan);
  }

  // ---- targets ----

  /**
   * May it go for this foe now? Alive, awake, drawn, not walking home, no dummy; not given up;
   * the boss only in its fight with the member inside its arena; nothing inside an arena from
   * outside; within the leash of the player plus its reach.
   * @param {Enemy|null} e
   * @returns {boolean}
   */
  _candidate(e) {
    if (!e || !e.alive || e.dormant || !e.sprite.visible || e.sprite.opacity <= 0.001) return false;
    const sys = this.sys;
    if (e.passive || e.kind === 'dummy' || e.state === 'return' || sys._hidden.has(e)) return false;
    const until = this._skip.get(e);
    if (until !== undefined) {
      if (sys.clock < until) return false;
      this._skip.delete(e);
    }
    const inside = this._arena;
    if (inside) {
      if (!inside.contains(e.position.x, e.position.z)) return false;
    } else {
      if (e.boss) return false;
      for (const a of sys.arenas) if (a.present && a.containsGrown(e.position.x, e.position.z, 0.5)) return false;
    }
    if (e.boss && sys.bossFight !== e) return false;
    const P = sys.player.position;
    const d = Math.hypot(e.position.x - P.x, e.position.z - P.z);
    return d <= this._leash() + this._reach();
  }

  /** The leash of its `distance` (u from the player). */
  _leash() {
    return (DISTANCE[this.rule.distance] ?? DISTANCE.mid).leash;
  }

  /** How far from its target it attacks: melee reach, else the standoff (within the shot's range). */
  _reach() {
    if (this.role === 'melee') return /** @type {typeof KIT.warden} */ (this.kit).reach + 0.5;
    const so = (DISTANCE[this.rule.distance] ?? DISTANCE.mid).standoff;
    return Math.min(so, this._range() - 0.5);
  }

  /** The pause after a basic attack and the skill's cooldown × this: `ALLY.healerPace` for a member that heals `often` (Support), else 1. */
  _pace() {
    return this.rule.heal === 'often' ? ALLY.healerPace : 1;
  }

  /** The basic shot's range (ranged / caster). */
  _range() {
    const k = /** @type {typeof KIT.ranger|typeof KIT.mystic} */ (this.kit);
    return k.basic?.range ?? 2;
  }

  /**
   * `attack: assist`: a foe that fights the player or the party now — the lock-on, one the player
   * hit lately, one after a member, or an aggroed one that came for the player (within
   * `ALLY.assistNear` u of it). (Every foe of a fight is aggroed: with that alone `assist` was
   * `free`.)
   * @param {Enemy} e
   */
  _assists(e) {
    const sys = this.sys;
    if (e === sys.targeting.lock || sys.clock - (e.playerHitAt ?? -Infinity) < ALLY.assistMemory) return true;
    if (!e.aggro) return false;
    if (e.target?.isAlly) return true;
    const P = sys.player.position;
    return Math.hypot(e.position.x - P.x, e.position.z - P.z) <= ALLY.assistNear;
  }

  /** The foe it goes for by its rule's `target` (a little stickiness for the current one). @returns {Enemy|null} */
  _pickTarget() {
    const sys = this.sys;
    const rule = this.rule;
    const P = sys.player.position;
    const p = this.member.position;
    const lock = sys.targeting.lock;
    const assist = rule.attack === 'assist';
    let best = null;
    let bestScore = Infinity;
    // a foe fights the party now (aggroed, near the player): only then does a free hand take on
    // a foe not yet in the fight — it does not start the next fight in the linger after one
    let fight = false;
    for (const e of sys.enemies) {
      if (!fight && e.alive && e.aggro && !e.passive && Math.hypot(e.position.x - P.x, e.position.z - P.z) <= FIGHT_RANGE) fight = true;
      if (!this._candidate(e)) continue;
      if (assist && !this._assists(e)) continue;
      // (foes already in the fight — aggroed, or the player's lock-on — first, whatever the rule's
      // bonuses; one not in it yet only when it is about to join, near the player, and never an
      // elite or the boss: a free hand does not pull the next pack or wake an elite while the foes
      // of the fight are out of its reach)
      const fighting = e.aggro || e === lock;
      if (!fighting && (e.elite || e.boss || Math.hypot(e.position.x - P.x, e.position.z - P.z) > JOIN_NEAR)) continue;
      const dMe = Math.hypot(e.position.x - p.x, e.position.z - p.z);
      let score = fighting ? 0 : NOT_FIGHTING;
      switch (rule.target) {
        case 'nearest': score += dMe; break;
        case 'weakest': score += (e.hp / e.hpMax) * 100 + dMe * 0.05; break;
        case 'strongest': score += -(e.boss ? 1e6 : 0) - (e.elite ? 1e5 : 0) - e.hpMax + dMe * 0.05; break;
        case 'ranged': score += (e.kind === 'archer' || e.kind === 'shaman' ? 0 : 1000) + dMe; break;
        default: score += e === lock ? -1e6 : Math.hypot(e.position.x - P.x, e.position.z - P.z); break;
      }
      if (e === this.target) score -= rule.target === 'weakest' || rule.target === 'strongest' ? 0.5 : 1;
      if (score < bestScore - 1e-9) {
        bestScore = score;
        best = e;
      }
    }
    return best && (best.aggro || fight) ? best : null;
  }

  /**
   * Go for `t`: a skill when one suits, the basic attack from its spot, else the way there.
   * @param {Enemy} t
   * @param {number} h
   * @param {boolean} replan the plan's beat (a shooter's spot is chosen anew)
   * @returns {boolean} it did something about `t`
   */
  _fight(t, h, replan) {
    const sys = this.sys;
    const p = this.member.position;
    const q = t.position;
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    const d = Math.hypot(dx, dz);
    // a shooter beyond its leash of the player (or off screen while a spot on screen sees its
    // target) goes back first; one in line with the player on screen steps aside (before a skill too)
    const away = this.role !== 'melee' && this._shooterAway(t, replan);
    if (this.role !== 'melee' && !away && d <= this._range() - 0.4 && this._spaceOut(q.x, q.z, h)) return true;
    // a warden in front of the player on screen steps to a free spot first (before a skill too)
    if (this.role === 'melee' && this._relocate(t, d, h)) return true;
    if (!away && this._skillReady() && this._skillSuits(t, d)) {
      this._startSkill(t);
      return true;
    }
    if (this.role === 'melee') {
      const kit = /** @type {typeof KIT.warden} */ (this.kit);
      const reach = kit.reach + t.radius;
      const dy = Math.abs(q.y - p.y);
      const inReach = d <= reach && dy <= MELEE_DY
        && (d < 0.8 || this._arena !== null || !sys.nav || sys.nav.lineClear(p.x, p.z, q.x, q.z, 0.3));
      if (this._noReachFor !== t) {
        this._noReachFor = t;
        this._noReachT = 0;
      }
      if (inReach) {
        this._noReachT = 0;
        if (this.atkCd <= 0) this._startMelee(t, 0);
        else {
          this._face(q.x, q.z);
          this._play('idle');
        }
        return true;
      }
      // to its spot round the foe (not in front of the player on screen when another is free),
      // else straight at it within the leash
      const s = this._meleeSpot(t, reach, replan);
      const g = s ?? this._leashed(q.x - (dx / (d || 1)) * (reach * 0.7), q.z - (dz / (d || 1)) * (reach * 0.7));
      const there = this._goTo(g.x, g.z, h, 0.15, true);
      // there (or across from it) but out of its reach — a foe on a ledge above or below: given
      // up after `ALLY.noReach` s (the walk grid found a way to the spot, not to the foe)
      if ((there && s !== null) || (dy > MELEE_DY && (there || d <= reach + 0.4))) {
        this._noReachT += h;
        if (this._noReachT >= ALLY.noReach - EPS && this.target === t) {
          this._skip.set(t, sys.clock + ALLY.skipFor);
          this.target = null;
          this._noReachT = 0;
          this._mspot.t = null;
        }
      } else this._noReachT = Math.max(0, this._noReachT - h);
      return true;
    }
    // ranged / caster: keep the standoff with a line of sight — from within its leash of the
    // player (farther: back to a spot inside it first) and on screen when a spot on screen sees it
    const so = (DISTANCE[this.rule.distance] ?? DISTANCE.mid).standoff;
    const range = this._range() - 0.4;
    const los = !away && d <= range && sys.los(p.x, p.z, q.x, q.z);
    if (los && d >= Math.min(so - 1.6, 1.6)) {
      if (this.atkCd <= 0) this._startShot(t);
      else {
        this._face(q.x, q.z);
        this._play('idle');
      }
      return true;
    }
    if (los && d < so - 1.6) {
      // too close: step back (along the line away from it), else shoot from here
      const bx = p.x - (dx / (d || 1)) * 1.2;
      const bz = p.z - (dz / (d || 1)) * 1.2;
      const P = sys.player.position;
      if (sys.standable(bx, bz) && Math.hypot(bx - P.x, bz - P.z) <= this._leash()) {
        // (backing off facing it)
        this._goTo(bx, bz, h, 0.2, false, t);
        this._face(q.x, q.z);
        return true;
      }
      if (this.atkCd <= 0) this._startShot(t);
      return true;
    }
    // out of range, no line of sight, beyond its leash or off screen: to a spot at the standoff
    // that sees it (chosen on the plan's beat), else the standoff point on the line to it
    const sp = this._shotSpot(t, so, replan);
    if (sp) {
      this._goTo(sp.x, sp.z, h, 0.3, true);
      return true;
    }
    const g = this._leashed(q.x - (dx / (d || 1)) * Math.min(so, d * 0.8), q.z - (dz / (d || 1)) * Math.min(so, d * 0.8));
    this._goTo(g.x, g.z, h, 0.3, true);
    return true;
  }

  /**
   * A melee member near its foe that stands in front of the player on screen (`_covers`: the player
   * stepped behind it, or it came that way) steps to a free spot round the foe first — at most
   * every `ALLY.relocEvery` s and only `RELOC_MAX` u —, facing the foe; then it strikes from there.
   * @param {Enemy} t
   * @param {number} d its distance to t
   * @param {number} h
   * @returns {boolean} it steps
   */
  _relocate(t, d, h) {
    const p = this.member.position;
    const reach = /** @type {typeof KIT.warden} */ (this.kit).reach + t.radius;
    if (!this._reloc) {
      if (this._relocT > 0 || d > reach + 0.5 || !this._covers(p.x, p.z)) return false;
      const s = this._meleeSpot(t, reach, true);
      if (!s || s.cover || Math.hypot(s.x - p.x, s.z - p.z) > RELOC_MAX) return false;
      this._reloc = true;
      this._relocT = ALLY.relocEvery;
    }
    const s = this._meleeSpot(t, reach, false);
    if (s && !s.cover && !this._goTo(s.x, s.z, h, 0.15, true, t)) return true;
    this._reloc = false;
    return false;
  }

  /**
   * Must this shooter move before it shoots `t`? Farther than its leash + `ALLY.leashSlack` from
   * the player (Guard Me's 4 u kept ranged members beside the player only on the way in), or off
   * screen while a spot on screen sees its target (`_shotSpot`).
   * @param {Enemy} t
   * @param {boolean} replan
   * @returns {boolean}
   */
  _shooterAway(t, replan) {
    const sys = this.sys;
    const p = this.member.position;
    const P = sys.player.position;
    if (Math.hypot(p.x - P.x, p.z - P.z) > this._leash() + ALLY.leashSlack) return true;
    if (sys.projectNdc(p.x, p.y + SHOT_Y, p.z, this._ndc, OFF_SCREEN)) return false;
    const s = this._shotSpot(t, (DISTANCE[this.rule.distance] ?? DISTANCE.mid).standoff, replan);
    return !!s && s.on && Math.hypot(s.x - p.x, s.z - p.z) > 0.5;
  }

  /**
   * A spot to shoot `t` from: at the standoff from it (at least 2 u, inside the shot's range), the
   * way from it to the member first, then turning either way by 45° steps — standable, within a
   * level of it, within the leash of the player, allowed by the arena rules and with a line of
   * sight to it; on screen when one is (`on`), else any. Chosen on the plan's beat (and when the
   * target changed, or the player left it outside the leash); null: none.
   * @param {Enemy} t
   * @param {number} so the standoff
   * @param {boolean} replan
   * @returns {{ x: number, z: number, on: boolean }|null}
   */
  _shotSpot(t, so, replan) {
    const sp = this._spot;
    const sys = this.sys;
    const P = sys.player.position;
    const L = this._leash();
    // (the spot kept between beats — unless the player has gone on and left it outside the leash)
    if (!replan && sp.t === t && !(sp.ok && Math.hypot(sp.x - P.x, sp.z - P.z) > L + ALLY.leashSlack)) return sp.ok ? sp : null;
    const p = this.member.position;
    const q = t.position;
    const r = Math.max(2, Math.min(so, this._range() - 1));
    let a0 = Math.atan2(p.z - q.z, p.x - q.x);
    if (!Number.isFinite(a0)) a0 = 0;
    sp.t = t;
    sp.ok = false;
    sp.on = false;
    // (a spot on screen first — the player sees what its companions do —, then any)
    for (let pass = 0; pass < 2 && !sp.ok; pass++) {
      for (let k = 0; k < 8; k++) {
        const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 4);
        const x = q.x + Math.cos(a) * r;
        const z = q.z + Math.sin(a) * r;
        if (Math.hypot(x - P.x, z - P.z) > L || !sys.standable(x, z) || Math.abs(sys.groundAt(x, z) - q.y) > 1.0) continue;
        if (pass === 0 && !sys.projectNdc(x, sys.groundAt(x, z) + SHOT_Y, z, this._ndc, ON_SCREEN)) continue;
        if (!this._enterable(x, z) || !sys.los(x, z, q.x, q.z)) continue;
        sp.x = x;
        sp.z = z;
        sp.ok = true;
        sp.on = pass === 0;
        break;
      }
    }
    return sp.ok ? sp : null;
  }

  /**
   * A shooter that stands one in front of the other with the player on screen (less than
   * `SPACING.lateral` u apart across the screen and `SPACING.depth` u along it: one sprite hides
   * the other) steps aside before it shoots: `SPACING.step` u from the player across the screen —
   * the side it already leans to first, then the other, then each a little toward the camera.
   * A step that is blocked gives way to the shot.
   * @param {number} tx its target
   * @param {number} tz
   * @param {number} h
   * @returns {boolean} it steps
   */
  _spaceOut(tx, tz, h) {
    const sys = this.sys;
    const P = sys.player.position;
    const p = this.member.position;
    const dpx = p.x - P.x;
    const dpz = p.z - P.z;
    // screen right and screen down (toward the camera) on XZ, as Sprite3D.directionFromVector
    const yaw = globalUniforms.uCameraYaw.value;
    const c = Math.cos(yaw);
    const sn = Math.sin(yaw);
    const lat = dpx * c - dpz * sn;
    const dep = dpx * sn + dpz * c;
    if (Math.abs(lat) >= SPACING.lateral || Math.abs(dep) >= SPACING.depth || this._stuckT >= 0.3) return false;
    const side = Math.abs(lat) > 1e-3 ? Math.sign(lat) : sys.allies.indexOf(this) % 2 === 0 ? 1 : -1;
    for (const [fs, fd] of SPACE_TRIES) {
      // right · (side · fs) + down · fd
      const sx = c * side * fs + sn * fd;
      const sz = -sn * side * fs + c * fd;
      const l = Math.hypot(sx, sz) || 1;
      const x = P.x + (sx / l) * SPACING.step;
      const z = P.z + (sz / l) * SPACING.step;
      if (!sys.standable(x, z) || Math.abs(sys.groundAt(x, z) - P.y) > 0.6 || !this._enterable(x, z)) continue;
      this._goTo(x, z, h, 0.1);
      this._face(tx, tz);
      return true;
    }
    return false;
  }

  /**
   * A melee member's spot to strike `t` from: 0.7 × its reach from the foe, the way from the foe
   * to the member first, then turning either way by 45° steps — standable, at the foe's height
   * (± MELEE_DY), within the leash of the player (+ 0.5 u), by the arena rules and in a clear line
   * to the foe — and not in front of the player on screen (`_covers`: between the player and the
   * camera, where its sprite hides the player's) while another spot is free (`cover` true: none
   * was). The angle is chosen on the plan's beat (and when the target changed); the spot moves
   * with the foe in between. Null: no spot at all.
   * @param {Enemy} t
   * @param {number} reach
   * @param {boolean} replan
   * @returns {{ x: number, z: number, cover: boolean }|null}
   */
  _meleeSpot(t, reach, replan) {
    const sp = this._mspot;
    const q = t.position;
    const r = reach * 0.7;
    if (replan || sp.t !== t) {
      const sys = this.sys;
      const p = this.member.position;
      const P = sys.player.position;
      const L = this._leash() + 0.5;
      const nav = this._arena ? null : sys.nav;
      let a0 = Math.atan2(p.z - q.z, p.x - q.x);
      if (!Number.isFinite(a0)) a0 = 0;
      sp.t = t;
      sp.ok = false;
      sp.cover = false;
      let first = NaN;
      for (let k = 0; k < 8; k++) {
        const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 4);
        const x = q.x + Math.cos(a) * r;
        const z = q.z + Math.sin(a) * r;
        if (Math.hypot(x - P.x, z - P.z) > L || !sys.standable(x, z) || Math.abs(sys.groundAt(x, z) - q.y) > MELEE_DY) continue;
        if (!this._enterable(x, z) || (nav && !nav.lineClear(x, z, q.x, q.z, 0.3))) continue;
        if (!this._covers(x, z)) {
          sp.a = a;
          sp.ok = true;
          break;
        }
        if (Number.isNaN(first)) first = a;
      }
      if (!sp.ok && !Number.isNaN(first)) {
        sp.a = first;
        sp.ok = true;
        sp.cover = true;
      }
    }
    if (!sp.ok) return null;
    sp.x = q.x + Math.cos(sp.a) * r;
    sp.z = q.z + Math.sin(sp.a) * r;
    return sp;
  }

  /**
   * Would a member standing at (x, z) hide the player on screen? In front of the player (toward
   * the camera) by less than `COVER.depth` u and across the screen by less than `COVER.lateral` u
   * — its sprite drawn over the player's body.
   * @param {number} x
   * @param {number} z
   */
  _covers(x, z) {
    const sys = this.sys;
    const P = sys.player.position;
    const v = sys._pv?.velocity;
    const yaw = globalUniforms.uCameraYaw.value;
    const c = Math.cos(yaw);
    const sn = Math.sin(yaw);
    // where the player stands, and where it walks to in `COVER.ahead` s (a player stepping in
    // behind its companion is hidden as well)
    for (let k = 0; k < 2; k++) {
      const ax = k && v ? v.x * COVER.ahead : 0;
      const az = k && v ? v.z * COVER.ahead : 0;
      if (k && Math.abs(ax) + Math.abs(az) < 0.05) break;
      const dx = x - (P.x + ax);
      const dz = z - (P.z + az);
      const lat = dx * c - dz * sn;
      const dep = dx * sn + dz * c;
      if (Math.abs(lat) < COVER.lateral && dep > COVER.near && dep < COVER.depth) return true;
    }
    return false;
  }

  /**
   * A goal pulled back within the leash of the player.
   * @param {number} x
   * @param {number} z
   * @returns {PointXZ}
   */
  _leashed(x, z) {
    const P = this.sys.player.position;
    const L = this._leash();
    const dx = x - P.x;
    const dz = z - P.z;
    const d = Math.hypot(dx, dz);
    const o = this._goal;
    if (d <= L || d < 1e-6) {
      o.x = x;
      o.z = z;
    } else {
      o.x = P.x + (dx / d) * L;
      o.z = P.z + (dz / d) * L;
    }
    return o;
  }

  // ---- skills ----

  /** Its skill may start now by the rule's `skills` (and `attack`) and its MP / cooldown. */
  _skillReady() {
    const rule = this.rule;
    if (rule.skills === 'never' || rule.attack === 'never' || this.skillCd > 0) return false;
    const S = this.kit.skill;
    if (this.mp < S.mp - EPS) return false;
    // 'save': keep the mana for a heal (only when it heals at all)
    if (rule.skills === 'save' && (HEAL_AT[rule.heal] ?? 0) > 0 && this.mp - S.mp < this.kit.mend.mp - EPS) return false;
    return true;
  }

  /**
   * Does its skill suit `t` now: enough foes around it (or its own feet), or a tough target?
   * @param {Enemy} t
   * @param {number} d its distance to t
   */
  _skillSuits(t, d) {
    const sys = this.sys;
    const p = this.member.position;
    const tough = t.boss || t.elite;
    if (this.cls === 'warden') {
      const S = KIT.warden.skill;
      const n = this._foesNear(p.x, p.z, S.r + 0.3);
      return (n >= S.minFoes || (tough && d <= S.r + t.radius)) && Math.abs(t.position.y - p.y) <= MELEE_DY;
    }
    if (this.cls === 'ranger') {
      const S = KIT.ranger.skill;
      if (d > S.range - 1 || !sys.los(p.x, p.z, t.position.x, t.position.z)) return false;
      return tough || this._foesNear(t.position.x, t.position.z, 3) >= S.minFoes;
    }
    const S = KIT.mystic.skill;
    if (d > S.range || !sys.los(p.x, p.z, t.position.x, t.position.z)) return false;
    return tough || this._foesNear(t.position.x, t.position.z, S.r + 0.4) >= S.minFoes;
  }

  /** Foes (candidates) within r of (x, z). */
  _foesNear(x, z, r) {
    const list = this.sys._enemiesNear(x, z, r, this._near);
    let n = 0;
    for (const e of list) if (!e.passive && e.kind !== 'dummy' && e.state !== 'return') n++;
    return n;
  }

  // ---- heal ----

  /**
   * Whom to Mend: the lowest HP fraction below `at` — the player or a member up (itself included)
   * — counting the Mends other members are casting at it (`_pending`): a target those will lift to
   * `at` or above is left to them.
   * @param {number} at
   * @param {number} [range] only within this distance of the member (u)
   * @returns {'player'|MemberCombat|null}
   */
  _pickHeal(at, range = Infinity) {
    const sys = this.sys;
    const pc = sys.pc;
    const p = this.member.position;
    /** @type {'player'|MemberCombat|null} */
    let who = null;
    let low = at;
    const P = sys.player.position;
    if (pc.alive && Math.hypot(P.x - p.x, P.z - p.z) <= range) {
      const f = (pc.hp + this._pending('player')) / pc.hpMax;
      if (f < low) {
        low = f;
        who = 'player';
      }
    }
    for (const a of sys.allies) {
      if (!a.present) continue;
      const q = a.position;
      if (Math.hypot(q.x - p.x, q.z - p.z) > range) continue;
      const f = (a.hp + this._pending(a)) / a.hpMax;
      if (f < low - 1e-9) {
        low = f;
        who = a;
      }
    }
    return who;
  }

  /**
   * Is `who` still below `at` with the other members' Mends on their way to it counted?
   * @param {MemberCombat|'player'|null} who
   * @param {number} at
   */
  _healOk(who, at) {
    if (!who) return false;
    const pc = this.sys.pc;
    if (who === 'player') return pc.alive && (pc.hp + this._pending('player')) / pc.hpMax < at;
    return who.present && (who.hp + this._pending(who)) / who.hpMax < at;
  }

  /**
   * HP the other members' Mends being cast at `who` will give it (cast begun, heal frame not yet
   * reached): the heal target is reserved — three healers no longer Mend the same player at once.
   * @param {MemberCombat|'player'} who
   * @returns {number}
   */
  _pending(who) {
    let n = 0;
    for (const b of this.sys.allies) {
      if (b === this || b.action !== 'mend' || b._healWho !== who || b.frame >= b.kit.mend.at) continue;
      n += b._mendAmount(who);
    }
    return n;
  }

  /**
   * HP its Mend gives `who` (before the cap).
   * @param {MemberCombat|'player'} who
   */
  _mendAmount(who) {
    const M = this.kit.mend;
    const max = who === 'player' ? this.sys.pc.hpMax : who.hpMax;
    return Math.round(max * M.frac + M.flat);
  }

  // ---- movement goals ----

  /**
   * Hold a spot ≈ 1.8 u beside the player, on the side away from the foe nearest the player. The
   * spot is planned anew only when the player moved `ALLY.holdReplan` u from where it stood then,
   * or the foe came round to the spot's side of the player (and on the plan's beat while none was
   * found); a member standing there sets off only beyond `ALLY.holdSlack` u (a shove, the player's
   * step) and then walks to within `ALLY.holdStop` u — facing its foe on short steps. Standing, it
   * faces one foe steadily (`_lookFoe`).
   * @param {number} h
   * @param {boolean} replan
   */
  _holdSpot(h, replan) {
    const sys = this.sys;
    const P = sys.player.position;
    const p = this.member.position;
    const foe = this._lookFoe();
    const H = this._hold;
    let again = H.kind !== 'hold' || (replan && !H.ok) || Math.hypot(P.x - H.px, P.z - H.pz) > ALLY.holdReplan;
    // (the foe came round to the spot's side of the player: within 60° of it, seen from the player)
    if (!again && foe && H.ok) {
      const hx = H.x - P.x;
      const hz = H.z - P.z;
      const fx = foe.position.x - P.x;
      const fz = foe.position.z - P.z;
      if (hx * fx + hz * fz > 0.5 * Math.hypot(hx, hz) * Math.hypot(fx, fz)) again = true;
    }
    if (again) {
      H.kind = 'hold';
      H.px = P.x;
      H.pz = P.z;
      let ax;
      let az;
      if (foe) {
        ax = P.x - foe.position.x;
        az = P.z - foe.position.z;
      } else {
        ax = -sys.player.facing.x;
        az = -sys.player.facing.z;
      }
      const al = Math.hypot(ax, az) || 1;
      ax /= al;
      az /= al;
      const k = sys.allies.indexOf(this);
      const side = k % 2 === 0 ? 1 : -1;
      const tries = [[0.55, 0.85 * side], [0.55, -0.85 * side], [1, 0], [0.3, 0.95 * side]];
      this._hold.ok = false;
      for (const [fa, fs] of tries) {
        let dx = ax * fa + -az * fs;
        let dz = az * fa + ax * fs;
        const l = Math.hypot(dx, dz) || 1;
        dx /= l;
        dz /= l;
        const x = P.x + dx * ALLY.hold * (1 + 0.35 * Math.floor(k / 2));
        const z = P.z + dz * ALLY.hold * (1 + 0.35 * Math.floor(k / 2));
        if (sys.standable(x, z) && Math.abs(sys.groundAt(x, z) - P.y) <= 0.6 && this._enterable(x, z)) {
          this._hold.x = x;
          this._hold.z = z;
          this._hold.ok = true;
          break;
        }
      }
      if (!this._hold.ok) {
        this._hold.x = P.x;
        this._hold.z = P.z;
      }
    }
    // (sets off only beyond the slack, then walks all the way: no shuffle on every small shove)
    const far = Math.hypot(H.x - p.x, H.z - p.z);
    if (this._holdWalk || far > (H.ok ? ALLY.holdSlack : 1.0)) {
      const there = this._goTo(H.x, H.z, h, H.ok ? ALLY.holdStop : 1.0, false, far < ALLY.runFrom ? foe : null);
      this._holdWalk = !there;
      if (!there) return;
    }
    if (foe) this._faceSteady(foe.position.x, foe.position.z);
    this._play('idle');
  }

  /**
   * Face a point while standing — only once it is more than 35° off the facing (`STEADY_COS`; a foe
   * hopping about at a quadrant's edge does not turn the sprite to and fro).
   * @param {number} x
   * @param {number} z
   */
  _faceSteady(x, z) {
    const p = this.member.position;
    const f = this.member.facing;
    const dx = x - p.x;
    const dz = z - p.z;
    const l = Math.hypot(dx, dz);
    if (l < 1e-6) return;
    if ((dx * f.x + dz * f.z) / l >= STEADY_COS) return;
    this._face(x, z);
  }

  /**
   * The foe a holding member faces: the one it faced while it is still alive, awake, in the fight
   * and not more than `LOOK_KEEP` u farther from the player than the nearest such foe (that one
   * otherwise) — no turning to and fro between two foes about as near.
   * @returns {Enemy|null}
   */
  _lookFoe() {
    const near = this._foeNearPlayer();
    const cur = this._lookAt;
    if (cur && near && cur !== near && cur.alive && !cur.dormant && cur.aggro && cur.sprite.visible && !cur.passive) {
      const P = this.sys.player.position;
      if (Math.hypot(cur.position.x - P.x, cur.position.z - P.z) <= Math.hypot(near.position.x - P.x, near.position.z - P.z) + LOOK_KEEP) return cur;
    }
    this._lookAt = near;
    return near;
  }

  /** @param {number} h @param {boolean} replan */
  /**
   * Fall back: a spot `ALLY.retreat` u behind the player, away from the foe nearest the player —
   * planned anew as the hold spot is (`_holdSpot`: the player moved, or the foe's side turned by
   * more than 60°), walked to with the same slack.
   * @param {number} h
   * @param {boolean} replan
   */
  _retreat(h, replan) {
    const sys = this.sys;
    const P = sys.player.position;
    const p = this.member.position;
    const H = this._hold;
    const foe = this._foeNearPlayer() ?? this._foeNearMe();
    let ax = -sys.player.facing.x;
    let az = -sys.player.facing.z;
    if (foe) {
      ax = P.x - foe.position.x;
      az = P.z - foe.position.z;
    }
    const al = Math.hypot(ax, az) || 1;
    ax /= al;
    az /= al;
    let again = H.kind !== 'retreat' || (replan && !H.ok) || Math.hypot(P.x - H.px, P.z - H.pz) > ALLY.holdReplan;
    if (!again && foe && H.ok) {
      const hx = H.x - P.x;
      const hz = H.z - P.z;
      if (hx * ax + hz * az < 0.5 * Math.hypot(hx, hz)) again = true;
    }
    if (again) {
      H.kind = 'retreat';
      H.px = P.x;
      H.pz = P.z;
      H.x = P.x + ax * ALLY.retreat;
      H.z = P.z + az * ALLY.retreat;
      H.ok = sys.standable(H.x, H.z) && this._enterable(H.x, H.z);
      if (!H.ok) {
        H.x = P.x;
        H.z = P.z;
      }
    }
    const far = Math.hypot(H.x - p.x, H.z - p.z);
    if (this._holdWalk || far > (H.ok ? ALLY.holdSlack : 1.0)) {
      const there = this._goTo(H.x, H.z, h, H.ok ? ALLY.holdStop : 1.0);
      this._holdWalk = !there;
      if (!there) return;
    }
    const near = this._foeNearMe();
    if (near) this._faceSteady(near.position.x, near.position.z);
    this._play('idle');
  }

  /**
   * Outside a closed arena: wait in front of its gate.
   * @param {BossArena} a
   * @param {number} h
   */
  _waitAtGate(a, h) {
    const [x0, z0, x1, z1] = a.gate;
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    let ox = mx - a.center.x;
    let oz = mz - a.center.z;
    const ol = Math.hypot(ox, oz) || 1;
    ox /= ol;
    oz /= ol;
    const k = this.sys.allies.indexOf(this);
    const side = (k % 2 === 0 ? 1 : -1) * (0.8 + 0.6 * Math.floor(k / 2));
    let x = mx + ox * 1.6 - oz * side;
    let z = mz + oz * 1.6 + ox * side;
    if (!this.sys.standable(x, z)) {
      x = mx + ox * 2.2;
      z = mz + oz * 2.2;
    }
    if (this._goTo(x, z, h, 0.6)) {
      this._face(mx, mz);
      this._play('idle');
    }
  }

  /** The live, aggroed foe nearest the player (within 16 u), or null. */
  _foeNearPlayer() {
    const P = this.sys.player.position;
    return this._nearestFoe(P.x, P.z, 16, true);
  }

  /** The live foe nearest the member (within 12 u), or null. */
  _foeNearMe() {
    const p = this.member.position;
    return this._nearestFoe(p.x, p.z, 12, false);
  }

  /**
   * @param {number} x
   * @param {number} z
   * @param {number} r
   * @param {boolean} aggro only aggroed foes
   * @returns {Enemy|null}
   */
  _nearestFoe(x, z, r, aggro) {
    let best = null;
    let bd = r;
    for (const e of this.sys.enemies) {
      if (!e.alive || e.dormant || !e.sprite.visible || e.passive || (aggro && !e.aggro)) continue;
      const d = Math.hypot(e.position.x - x, e.position.z - z);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /**
   * Can it go to (x, z) by the arena rules: not into a closed arena from outside, not out of the
   * one it is in.
   * @param {number} x
   * @param {number} z
   */
  _enterable(x, z) {
    const a = this.sys.sealedArena();
    if (!a) return true;
    return this._arena ? a.contains(x, z) : !a.containsGrown(x, z, 0.4);
  }

  /**
   * Walk / run toward (x, z): straight while the walk grid's line is clear (inside a closed arena:
   * always), else along a path of the grid, round the player when it stands in the way (the
   * separation never lets a member push the player: walking into it got nowhere); true when within
   * `near` (it stands). No way there (no path, or stuck `ALLY.stuckGiveUp` s — measured by the net
   * progress of its last move after the frame's separation, not by the move alone): toward its
   * target (`forTarget`) the foe is given up for `ALLY.skipFor` s, else the spot is planned anew.
   * `look`: a foe it faces while it walks (a short step aside or back), else it turns to the way.
   * @param {number} x
   * @param {number} z
   * @param {number} h
   * @param {number} near
   * @param {boolean} [forTarget] the way to its target
   * @param {Enemy|null} [look]
   * @returns {boolean}
   */
  _goTo(x, z, h, near, forTarget = false, look = null) {
    const sys = this.sys;
    const p = this.member.position;
    const d = Math.hypot(x - p.x, z - p.z);
    const gp = this._gp;
    if (d <= near) {
      this._stuckT = 0;
      this._pathN = 0;
      gp.sub = -2;
      return true;
    }
    let tx = x;
    let tz = z;
    const nav = sys.nav;
    if (nav && !this._arena && !nav.lineClear(p.x, p.z, x, z, 0.3)) {
      const stale = this._pathN === 0 || Math.hypot(x - this._pathGX, z - this._pathGZ) > 1.2
        || sys.clock - this._pathAt > 1.5 || this._stuckT >= ALLY.stuckPath;
      if (stale && sys.clock - this._pathAt >= ALLY.pathEvery && sys.allySearches > 0) {
        sys.allySearches--;
        const n = nav.findPath(p.x, p.z, x, z, ALLY.pathMax, this._path);
        this._pathN = Math.max(0, n);
        this._pathI = 0;
        this._pathGX = x;
        this._pathGZ = z;
        this._pathAt = sys.clock;
        if (n < 0) this._giveUp(forTarget);
      }
      if (this._pathN > 0) {
        const k = this._followPath();
        tx = this._path[k * 2];
        tz = this._path[k * 2 + 1];
      }
    } else this._pathN = 0;
    let ux = tx - p.x;
    let uz = tz - p.z;
    const dl = Math.hypot(ux, uz);
    if (dl < 1e-6) {
      ux = x - p.x;
      uz = z - p.z;
    }
    let ul = Math.hypot(ux, uz) || 1;
    ux /= ul;
    uz /= ul;
    // the player in the way (ahead within ROUND.ahead u and nearer than the goal, less than the two
    // radii + a margin across the way): turn aside, away from the side it stands on
    const pc = sys.pc;
    if (pc.alive) {
      const P = sys.player.position;
      const ox = P.x - p.x;
      const oz = P.z - p.z;
      const along = ox * ux + oz * uz;
      if (along > 0 && along < Math.min(d, ROUND.ahead) && Math.abs(P.y - p.y) < 1) {
        const across = ox * -uz + oz * ux;
        const clear = ALLY.radius + pc.radius + ROUND.margin;
        if (Math.abs(across) < clear) {
          const s = Math.abs(across) > 1e-3 ? -Math.sign(across) : sys.allies.indexOf(this) % 2 === 0 ? 1 : -1;
          const k = ROUND.turn * (1 - Math.abs(across) / clear);
          const nx = ux - uz * s * k;
          const nz = uz + ux * s * k;
          ul = Math.hypot(nx, nz) || 1;
          ux = nx / ul;
          uz = nz / ul;
        }
      }
    }
    const run = d > ALLY.runFrom;
    const speed = run ? this.base.run : this.base.walk;
    const step = Math.min(d - near * 0.5, speed * h);
    // the net progress of its last move (that sub-step's move, then the frame's separation)
    const net = gp.sub === sys.stepNo - 1 && gp.step > 1e-6
      ? ((p.x - gp.x) * gp.ux + (p.z - gp.z) * gp.uz) / gp.step : NaN;
    gp.x = p.x;
    gp.z = p.z;
    gp.ux = ux;
    gp.uz = uz;
    gp.step = step;
    gp.sub = sys.stepNo;
    const fr = step > 1e-6 ? this._move(ux * step, uz * step, false) : 1;
    if (look) this._face(look.position.x, look.position.z);
    else this._turnTo(ux, uz, h);
    this._play(run ? 'run' : 'walk');
    if ((Number.isNaN(net) ? fr : net) < 0.25) this._stuckT += h;
    else this._stuckT = Math.max(0, this._stuckT - h);
    if (this._stuckT >= ALLY.stuckGiveUp) {
      this._stuckT = 0;
      this._giveUp(forTarget);
    }
    return false;
  }

  /**
   * Turn the facing toward the way it walks, eased over `TURN_TAU` s (a way that wavers about a
   * diagonal — a path's corner, going round the player — does not flip the sprite's row to and fro).
   * @param {number} ux
   * @param {number} uz
   * @param {number} h
   */
  _turnTo(ux, uz, h) {
    const f = this.member.facing;
    const k = Math.min(1, h / TURN_TAU);
    let x = f.x + (ux - f.x) * k;
    let z = f.z + (uz - f.z) * k;
    const l = Math.hypot(x, z);
    if (l < 0.2) {
      // (about to turn round: at once)
      x = ux;
      z = uz;
    } else {
      x /= l;
      z /= l;
    }
    f.x = x;
    f.z = z;
  }

  /** Along the current path: past each waypoint within 0.35 u, or once the next is in a clear line. */
  _followPath() {
    const p = this.member.position;
    const w = this._path;
    const n = this._pathN;
    const nav = this.sys.nav;
    let i = this._pathI;
    while (i < n - 1) {
      const dx = w[i * 2] - p.x;
      const dz = w[i * 2 + 1] - p.z;
      if (dx * dx + dz * dz <= 0.35 * 0.35 || nav.lineClear(p.x, p.z, w[i * 2 + 2], w[i * 2 + 3], 0, true)) i++;
      else break;
    }
    this._pathI = i;
    return i;
  }

  /**
   * The way failed: to its target — leave that foe for a while; the spot is planned anew.
   * @param {boolean} target
   */
  _giveUp(target) {
    if (target && this.target) {
      this._skip.set(this.target, this.sys.clock + ALLY.skipFor);
      this.target = null;
    }
    this._hold.ok = false;
    this._pathN = 0;
    this._planT = 0;
  }

  // ---- evade ----

  /**
   * Standing in an enemy telegraph that is filling (fill in [0.3, 1); magma: always): roll out.
   * @returns {boolean} it rolls
   */
  _evade() {
    const sys = this.sys;
    const p = this.member.position;
    for (const m of sys._mk) {
      if (m.h < 0 || !m.owner || m.owner === 'core') continue;
      const s = m.spec;
      if (s.style === 'enemy') {
        if (s.progress < ALLY.evadeFill - EPS || s.progress >= 1 - EPS) continue;
      } else if (s.style !== 'magma') continue;
      if (!this._escape(s, p.x, p.z)) continue;
      if (this._startRoll(this._esc.x, this._esc.z, s)) {
        this.mode = 'evade';
        return true;
      }
    }
    return false;
  }

  /**
   * Is (x, z) (with the hurt radius) inside the marker? If so `_esc` gets the way out.
   * @param {Required<MarkerSpec>} s
   * @param {number} x
   * @param {number} z
   * @returns {boolean}
   */
  _escape(s, x, z) {
    const R = ALLY.radius;
    const dx = x - s.x;
    const dz = z - s.z;
    const d = Math.hypot(dx, dz);
    const o = this._esc;
    const f = this.member.facing;
    switch (s.shape) {
      case 'circle':
      case 'ring': {
        if (d >= s.r + R || (s.shape === 'ring' && d <= (s.rInner ?? 0) - R)) return false;
        if (d > 1e-3) {
          o.x = dx / d;
          o.z = dz / d;
        } else {
          o.x = -f.z;
          o.z = f.x;
        }
        return true;
      }
      case 'sector': {
        if (d >= s.r + R) return false;
        let ax = s.dirX;
        let az = s.dirZ;
        const al = Math.hypot(ax, az) || 1;
        ax /= al;
        az /= al;
        if (d > 1e-3) {
          const cos = (dx * ax + dz * az) / d;
          const ang = Math.acos(Math.max(-1, Math.min(1, cos)));
          if (ang > (s.halfAngle * Math.PI) / 180 + Math.asin(Math.min(1, R / d))) return false;
        }
        const side = dx * -az + dz * ax >= 0 ? 1 : -1;
        o.x = -az * side;
        o.z = ax * side;
        return true;
      }
      case 'lane': {
        let ax = s.dirX;
        let az = s.dirZ;
        const al = Math.hypot(ax, az) || 1;
        ax /= al;
        az /= al;
        const t = dx * ax + dz * az;
        const perp = dx * -az + dz * ax;
        if (t < -R || t > s.len + R || Math.abs(perp) >= s.width / 2 + R) return false;
        const side = perp >= 0 ? 1 : -1;
        o.x = -az * side;
        o.z = ax * side;
        return true;
      }
      default:
        return false;
    }
  }

  // ------------------------------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------------------------------

  /** @param {AllyAction} action */
  _begin(action) {
    this.action = action;
    this.t = 0;
    this.frame = 0;
    this._prevFrame = -1;
    this._moved = 0;
    this._motion = null;
    this._lastCol = -1;
    this._lastRow = -1;
    this._trk.t = null;
  }

  _endAction() {
    this.action = null;
    this._actTarget = null;
    this._motion = null;
    this._lastCol = -1;
    this._lastRow = -1;
  }

  /** @param {number} h */
  _advance(h) {
    this.t += h;
    const prev = this.frame;
    this.frame = frameOf(this.t);
    this._prevFrame = prev;
    const a = this.action;
    if ((a === 'shot' || a === 'volley' || a === 'bolt') && this._actTarget?.alive) this._track(this._actTarget, h);
    this._runFrame();
  }

  /**
   * While it aims: the target's velocity (its moves per sub-step, smoothed over `ALLY.leadTau` s)
   * for the shot's lead (`_shoot`).
   * @param {Enemy} t
   * @param {number} h
   */
  _track(t, h) {
    const k = this._trk;
    const q = t.position;
    if (k.t !== t) {
      k.t = t;
      k.vx = 0;
      k.vz = 0;
    } else if (h > 1e-6) {
      const a = Math.min(1, h / ALLY.leadTau);
      k.vx += ((q.x - k.x) / h - k.vx) * a;
      k.vz += ((q.z - k.z) / h - k.vz) * a;
    }
    k.x = q.x;
    k.z = q.z;
  }

  /** Was frame n reached in this sub-step (frame 0 on the action's first)? @param {number} n */
  _at(n) {
    return this._prevFrame < n && this.frame >= n;
  }

  _runFrame() {
    switch (this.action) {
      case 'a1': case 'a2': this._frameMelee(); break;
      case 'sweep': this._frameSweep(); break;
      case 'shot': case 'volley': this._frameShot(); break;
      case 'bolt': this._frameBolt(); break;
      case 'flare': this._frameFlare(); break;
      case 'mend': this._frameMend(); break;
      case 'roll': this._frameRoll(); break;
      case 'hurt': this._frameHurt(); break;
      case 'knock': this._frameKnock(); break;
      case 'getup': this._frameGetUp(); break;
      default: break;
    }
  }

  /**
   * Show the pose of the frame from a table of [from, to, pose] spans.
   * @param {ReadonlyArray<ReadonlyArray<number|string>>} spans
   */
  _poseSpans(spans) {
    const f = this.frame;
    for (const s of spans) {
      if (f >= /** @type {number} */ (s[0]) && f <= /** @type {number} */ (s[1])) {
        this._pose(String(s[2]));
        return;
      }
    }
  }

  // ---- warden: the spear combo, Sweep ----

  /** @param {Enemy} t @param {number} k 0: the first thrust, 1: the second */
  _startMelee(t, k) {
    this._begin(k === 0 ? 'a1' : 'a2');
    this._actTarget = t;
    this._tag = this.sys.tags.next();
    this.swings++;
    this.counts.attacks++;
    this._face(t.position.x, t.position.z);
    this._runFrame();
  }

  _frameMelee() {
    const k = this.action === 'a1' ? 0 : 1;
    const H = /** @type {AllyMeleeHit} */ (KIT.warden.combo[k]);
    const f = this.frame;
    const t = this._actTarget;
    if (f >= H.total) {
      // the second thrust follows while the foe is still in reach
      if (k === 0 && t && t.alive && this._candidate(t)) {
        const p = this.member.position;
        const d = Math.hypot(t.position.x - p.x, t.position.z - p.z);
        if (d <= KIT.warden.reach + t.radius + 0.4 && Math.abs(t.position.y - p.y) <= MELEE_DY) {
          this._startMelee(t, 1);
          return;
        }
      }
      this.atkCd = KIT.warden.comboGap * this._pace();
      this._endAction();
      this._play('idle', true);
      return;
    }
    // the swing turns toward the foe until it strikes
    if (t && t.alive && f < H.active[0]) this._face(t.position.x, t.position.z);
    this._poseSpans(H.poses);
    const fc = this.member.facing;
    this._moveAlong(H.lunge, H.lungeFrames[0], H.lungeFrames[1] + 1, fc.x, fc.z);
    const sys = this.sys;
    const p = this.member.position;
    if (this._at(H.fxAt)) {
      sys.sfxAt(H.sfx, p.x, p.z, { volume: 0.55 });
      sys.fx.play(H.fx, p.x + fc.x * 0.85, p.y, p.z + fc.z * 0.85, { dirX: fc.x, dirZ: fc.z, scale: 0.85 });
    }
    if (f >= H.active[0] && f <= H.active[1]) {
      const s = this._baseSpec(H.mv, H.kb, H.poise);
      s.shape = 'sector';
      s.r = H.r;
      s.halfAngle = H.halfAngle;
      sys.addAllyHit(this, s, 'melee');
    }
  }

  /** @param {Enemy} t */
  _startSkill(t) {
    const S = this.kit.skill;
    this.mp -= S.mp;
    this.skillCd = S.cooldown * this._pace();
    this.counts.skills++;
    this._actTarget = t;
    this._face(t.position.x, t.position.z);
    this._tag = this.sys.tags.next();
    const a = this.cls === 'warden' ? 'sweep' : this.cls === 'ranger' ? 'volley' : 'flare';
    this._begin(a);
    this._actTarget = t;
    if (a === 'sweep') this.swings++;
    this._runFrame();
  }

  _frameSweep() {
    const S = KIT.warden.skill;
    const f = this.frame;
    if (f >= S.total) {
      this.atkCd = Math.max(this.atkCd, 0.25);
      this._endAction();
      this._play('idle', true);
      return;
    }
    this._pose(S.pose);
    const sys = this.sys;
    const p = this.member.position;
    if (this._at(3)) sys.sfxAt('whirl', p.x, p.z, { volume: 0.6 });
    if (this._at(S.active[0] - 2)) sys.fx.play('spin', p.x, p.y, p.z, { follow: p, scale: 0.95 });
    if (f >= S.active[0] && f <= S.active[1]) {
      const s = this._baseSpec(S.mv, S.kb, S.poise);
      s.shape = 'circle';
      s.r = S.r;
      sys.addAllyHit(this, s, 'skill');
    }
  }

  // ---- ranger: arrows, Volley; mystic: the ember bolt, Flare ----

  /** @param {Enemy} t */
  _startShot(t) {
    this._begin(this.cls === 'mystic' ? 'bolt' : 'shot');
    this._actTarget = t;
    this.counts.attacks++;
    this._face(t.position.x, t.position.z);
    this._runFrame();
  }

  _frameShot() {
    const volley = this.action === 'volley';
    const B = KIT.ranger.basic;
    const V = KIT.ranger.skill;
    const total = volley ? V.total : B.total;
    const release = volley ? V.release : B.release;
    const f = this.frame;
    if (f >= total) {
      this.atkCd = Math.max(this.atkCd, B.cooldown * this._pace());
      this._endAction();
      this._play('idle', true);
      return;
    }
    this._poseSpans(volley ? V.poses : B.poses);
    const t = this._actTarget;
    if (t && t.alive && f < release) this._face(t.position.x, t.position.z);
    if (this._at(release)) {
      const sys = this.sys;
      const n = volley ? V.n : 1;
      for (let i = 0; i < n; i++) {
        const a = n === 1 ? 0 : ((i - (n - 1) / 2) * V.spread * Math.PI) / 180;
        this._shoot('arrow', volley ? V : B, t, a, null);
      }
      const p = this.member.position;
      sys.sfxAt('arrow', p.x, p.z, { volume: 0.6 });
    }
  }

  _frameBolt() {
    const B = KIT.mystic.basic;
    const f = this.frame;
    if (f >= B.total) {
      this.atkCd = Math.max(this.atkCd, B.cooldown * this._pace());
      this._endAction();
      this._play('idle', true);
      return;
    }
    this._poseSpans(B.poses);
    const t = this._actTarget;
    if (t && t.alive && f < B.release) this._face(t.position.x, t.position.z);
    if (this._at(B.release)) {
      this._shoot('emberBolt', B, t, 0, B.splash);
      const p = this.member.position;
      this.sys.sfxAt('bolt', p.x, p.z, { volume: 0.55, pitch: 1.15 });
    }
  }

  /**
   * Launch one shot at `t` (aimed at its body middle where it will be when the shot arrives: its
   * tracked velocity × the time of flight, at most `ALLY.leadMax` u; turned by `angle` rad), else
   * along the facing.
   * @param {'arrow'|'emberBolt'} kind
   * @param {{ speed: number, range: number, radius: number, mv: number, kb: number, poise: number }} S
   * @param {Enemy|null} t
   * @param {number} angle
   * @param {{ r: number, mv: number }|null} splash
   */
  _shoot(kind, S, t, angle, splash) {
    const sys = this.sys;
    const p = this.member.position;
    const fc = this.member.facing;
    const s = this._proj;
    s.kind = kind;
    s.x = p.x + fc.x * 0.4;
    s.z = p.z + fc.z * 0.4;
    s.y = p.y + SHOT_Y;
    let dx = fc.x;
    let dz = fc.z;
    let d = 8;
    let aimY = s.y;
    if (t && t.alive) {
      let tx = t.position.x;
      let tz = t.position.z;
      const k = this._trk;
      if (k.t === t) {
        // (the time of flight to the led point, twice)
        let lx = 0;
        let lz = 0;
        for (let i = 0; i < 2; i++) {
          const tof = Math.hypot(tx + lx - s.x, tz + lz - s.z) / S.speed;
          lx = k.vx * tof;
          lz = k.vz * tof;
        }
        const ll = Math.hypot(lx, lz);
        if (ll > ALLY.leadMax) {
          lx *= ALLY.leadMax / ll;
          lz *= ALLY.leadMax / ll;
        }
        tx += lx;
        tz += lz;
      }
      dx = tx - s.x;
      dz = tz - s.z;
      d = Math.hypot(dx, dz);
      if (d > 1e-3) {
        dx /= d;
        dz /= d;
      } else {
        dx = fc.x;
        dz = fc.z;
      }
      const b = t.def.body;
      aimY = sys.bodyBase(t) + (b[0] + b[1]) / 2;
    }
    const c = Math.cos(angle);
    const sn = Math.sin(angle);
    s.dirX = dx * c - dz * sn;
    s.dirZ = dx * sn + dz * c;
    s.vy = aimVy(s.y, aimY, S.speed, d);
    s.speed = S.speed;
    s.range = S.range;
    s.radius = S.radius;
    s.mv = S.mv;
    s.kb = S.kb;
    s.poise = S.poise;
    s.pierce = false;
    s.splash = splash;
    s.arc = null;
    sys.spawnAllyProjectile(this, s);
  }

  _frameFlare() {
    const S = KIT.mystic.skill;
    const f = this.frame;
    if (f >= S.total) {
      this.atkCd = Math.max(this.atkCd, 0.3);
      this._endAction();
      this._play('idle', true);
      return;
    }
    this._pose(S.pose);
    const t = this._actTarget;
    if (t && t.alive && f < S.at) this._face(t.position.x, t.position.z);
    if (this._at(S.at)) {
      const sys = this.sys;
      const p = this.member.position;
      const q = t && t.alive ? t.position : null;
      const x = q ? q.x : p.x + this.member.facing.x * 4;
      const z = q ? q.z : p.z + this.member.facing.z * 4;
      const fl = this._flares.find((o) => !o.on);
      if (fl) {
        fl.on = true;
        fl.x = x;
        fl.z = z;
        fl.y = sys.groundAt(x, z);
        fl.t = S.delay;
        fl.tag = sys.tags.next();
        sys.burst('sparkle', x, fl.y + 0.4, z, 6);
      }
      sys.sfxAt('bolt', p.x, p.z, { volume: 0.45, pitch: 0.8 });
    }
  }

  /** Pending Flares count down and burst (a circle hit on the spot). @param {number} h */
  _stepFlares(h) {
    const sys = this.sys;
    for (const fl of this._flares) {
      if (!fl.on) continue;
      fl.t -= h;
      if (fl.t > EPS) {
        // a few sparks rise from the spot while it gathers (every ~0.15 s)
        if (Math.floor((fl.t + h) / 0.15) !== Math.floor(fl.t / 0.15)) sys.burst('emberBurst', fl.x, fl.y + 0.2, fl.z, 2);
        continue;
      }
      fl.on = false;
      const S = KIT.mystic.skill;
      const s = this._spec;
      s.shape = 'circle';
      s.x = fl.x;
      s.y = fl.y;
      s.z = fl.z;
      s.r = S.r;
      s.rInner = 0;
      s.dirX = 0;
      s.dirZ = 1;
      s.dy = MELEE_DY;
      s.mv = S.mv;
      s.kb = S.kb;
      s.poise = S.poise;
      s.knockdown = false;
      s.flat = 0;
      s.thin = false;
      s.tag = fl.tag;
      s.fromX = fl.x;
      s.fromZ = fl.z;
      sys.addAllyHit(this, s, 'skill');
      sys.fx.play('impact', fl.x, fl.y, fl.z, { scale: 1.5 });
      sys.burst('magicBurst', fl.x, fl.y + 0.6, fl.z, 16);
      sys.burst('emberBurst', fl.x, fl.y + 0.3, fl.z, 10);
      sys.sfxAt('hexBurst', fl.x, fl.z, { volume: 0.7 });
    }
  }

  // ---- Mend ----

  _startMend() {
    const M = this.kit.mend;
    this.mp -= M.mp;
    this.healCd = M.cooldown;
    this._begin('mend');
    const who = this._healWho;
    const q = who === 'player' ? this.sys.player.position : who && who !== this ? who.position : null;
    if (q) this._face(q.x, q.z);
    this._runFrame();
  }

  _frameMend() {
    const M = this.kit.mend;
    const f = this.frame;
    if (f >= M.total) {
      this._endAction();
      this._play('idle', true);
      return;
    }
    this._pose(f < M.at + 4 ? 'cast' : 'follow');
    if (this._at(M.at)) {
      const sys = this.sys;
      let who = this._healWho;
      // still needed? (a draught, another Mend or a level-up may have filled it meanwhile): else
      // the lowest other one below the threshold within reach, else it heals what it can when
      // that is at least half its Mend — or the cast fizzles and gives the MP back
      const at = HEAL_AT[this.rule.heal] ?? 0;
      if (!this._needsHeal(who, at)) {
        const other = this._pickHeal(at, M.range + 1);
        if (other) who = other;
        else if (!who || this._missing(who) < this._mendAmount(who) * 0.5) {
          this._healWho = null;
          this.mp = Math.min(this.mpMax, this.mp + M.mp);
          this.healCd = Math.min(this.healCd, MEND_FIZZLE_CD);
          this._endAction();
          this._play('idle', true);
          return;
        }
      }
      this._healWho = null;
      let got = 0;
      let q = null;
      if (who === 'player') {
        if (sys.pc.alive) {
          got = sys.pc.heal(Math.round(sys.pc.hpMax * M.frac + M.flat));
          q = sys.player.position;
        }
      } else if (who) {
        const a = /** @type {MemberCombat} */ (who);
        got = a.heal(Math.round(a.hpMax * M.frac + M.flat));
        q = a.position;
      }
      const p = this.member.position;
      sys.burst('healGlow', p.x, p.y + 1.2, p.z, 6);
      if (q) sys.burst('healGlow', q.x, q.y + 0.9, q.z, 12);
      sys.sfxAt('pickup', p.x, p.z, { volume: 0.55, pitch: 0.75 });
      this.counts.heals++;
      this.counts.healed += got;
      sys.events.emit('allyHeal', this.id, who === 'player' ? 'player' : who?.id ?? null, got);
    }
  }

  /**
   * Is `who` (up) below `at` of its max HP now?
   * @param {MemberCombat|'player'|null} who
   * @param {number} at
   */
  _needsHeal(who, at) {
    if (!who) return false;
    const pc = this.sys.pc;
    if (who === 'player') return pc.alive && pc.hp / pc.hpMax < at;
    return who.present && who.hp / who.hpMax < at;
  }

  /**
   * HP `who` lacks (0 when it cannot be healed: down, gone, the player fallen).
   * @param {MemberCombat|'player'} who
   */
  _missing(who) {
    const pc = this.sys.pc;
    if (who === 'player') return pc.alive ? Math.max(0, pc.hpMax - pc.hp) : 0;
    return who.present ? Math.max(0, who.hpMax - who.hp) : 0;
  }

  // ---- roll, hurt, knockdown, down, get up ----

  /**
   * Roll along (dx, dz) — or the first of ±30°, ±60° whose landing is standable, one step up or
   * down, out of the marker `s` and within the arena rules.
   * @param {number} dx
   * @param {number} dz
   * @param {Required<MarkerSpec>} s
   * @returns {boolean} started
   */
  _startRoll(dx, dz, s) {
    const sys = this.sys;
    const p = this.member.position;
    const D = ALLY.roll.dist;
    const y0 = sys.groundAt(p.x, p.z);
    const out = this._esc;
    for (const a of ROLL_TRIES) {
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const rx = dx * c - dz * sn;
      const rz = dx * sn + dz * c;
      const x = p.x + rx * D;
      const z = p.z + rz * D;
      const mx = p.x + rx * D * 0.5;
      const mz = p.z + rz * D * 0.5;
      if (!sys.standable(x, z) || !sys.standable(mx, mz)) continue;
      if (Math.abs(sys.groundAt(mx, mz) - y0) > 0.55 || Math.abs(sys.groundAt(x, z) - sys.groundAt(mx, mz)) > 0.55) continue;
      if (!this._enterable(x, z)) continue;
      if (this._escape(s, x, z)) continue;
      this._begin('roll');
      this.rollCd = ALLY.roll.cooldown;
      this.counts.rolls++;
      this.member.facing.x = rx;
      this.member.facing.z = rz;
      this._motion = { dist: D, f0: 0, f1: ALLY.roll.moveFrames + 1, dx: rx, dz: rz };
      sys.burst('footstep', p.x, p.y + 0.05, p.z, 4);
      sys.sfxAt('dodge', p.x, p.z, { volume: 0.5 });
      this._runFrame();
      return true;
    }
    // (_escape overwrote `_esc` with the last landing tested)
    out.x = dx;
    out.z = dz;
    return false;
  }

  _frameRoll() {
    const R = ALLY.roll;
    if (this.frame >= R.total) {
      this._endAction();
      this._play('idle', true);
      return;
    }
    this._poseSpans(R.poses);
    const m = this._motion;
    if (m) this._moveAlong(m.dist, m.f0, m.f1, m.dx, m.dz);
  }

  /**
   * An enemy hit landed (core computed the damage; the member is hittable): HP, reaction.
   * @param {number} damage
   * @param {number} kb
   * @param {number} dirX
   * @param {number} dirZ
   * @param {boolean} knockdown
   * @returns {'hurt'|'knockdown'|'armor'|'down'}
   */
  takeHit(damage, kb, dirX, dirZ, knockdown) {
    this.hp = Math.max(0, this.hp - damage);
    this.flashT = PLAYER_FLASH.time;
    this.counts.hurts++;
    this.counts.damageTaken += damage;
    if (this.hp <= 0) {
      this._goDown();
      return 'down';
    }
    if (this.action === 'sweep' && this.frame <= KIT.warden.skill.armor) return 'armor';
    if (!(kb > 0) && !knockdown && (this.action === 'mend' || this.action === 'flare')) return 'armor';
    this.shove(kb, dirX, dirZ, knockdown);
    return this.action === 'knock' ? 'knockdown' : 'hurt';
  }

  /**
   * Flat damage (magma): HP and the flash only — no reaction (as the player's `hurtFlat`).
   * @param {number} damage
   */
  hurtFlat(damage) {
    this.hp = Math.max(0, this.hp - damage);
    this.flashT = PLAYER_FLASH.time;
    this.counts.hurts++;
    this.counts.damageTaken += damage;
    if (this.hp <= 0) this._goDown();
  }

  /**
   * Hit stun (or a knockdown) with a slide along (dirX, dirZ); also a push without damage.
   * @param {number} kb
   * @param {number} dirX
   * @param {number} dirZ
   * @param {boolean} [knockdown]
   */
  shove(kb, dirX, dirZ, knockdown = false) {
    if (this.down || this.gone) return;
    const down = knockdown || kb >= ALLY.knockdown.kb;
    this._begin(down ? 'knock' : 'hurt');
    this._motion = { dist: Math.min(ALLY.kbCap, Math.max(0, kb)), f0: 0, f1: down ? ALLY.knockdown.slide : ALLY.hurt.slide, dx: dirX, dz: dirZ };
    if (Math.hypot(dirX, dirZ) > 1e-3) {
      this.member.facing.x = -dirX;
      this.member.facing.z = -dirZ;
    }
    this._runFrame();
  }

  _frameHurt() {
    const H = ALLY.hurt;
    if (this.frame >= H.total) {
      this.iframes = Math.max(this.iframes, H.iframes);
      this.blink = true;
      this._endAction();
      this._play('idle', true);
      return;
    }
    this._pose('hurt');
    const m = this._motion;
    if (m) this._moveAlong(m.dist, m.f0, m.f1, m.dx, m.dz, false);
  }

  _frameKnock() {
    const K = ALLY.knockdown;
    if (this.frame >= K.down + K.getUp) {
      this.iframes = Math.max(this.iframes, K.iframes);
      this.blink = true;
      this._endAction();
      this._play('idle', true);
      return;
    }
    this._pose(this.frame < K.down ? 'down' : 'tuck');
    const m = this._motion;
    if (m) this._moveAlong(m.dist, m.f0, m.f1, m.dx, m.dz, false);
  }

  /** HP 0: down until the fight is over; foes after it turn back to the player. */
  _goDown() {
    this._endAction();
    this.down = true;
    this.hp = 0;
    this.target = null;
    this._healWho = null;
    this.counts.downs++;
    this.iframes = 0;
    this.blink = false;
    this._pose('down');
    const sys = this.sys;
    const p = this.member.position;
    sys.sfxAt('playerDown', p.x, p.z, { volume: 0.45, pitch: 1.2 });
    sys.burst('hitSpark', p.x, p.y + 0.6, p.z, 6);
    sys.onAllyDown(this);
  }

  /** Out of the fight long enough: up with `ALLY.getUp` of its HP. */
  _getUp() {
    this.down = false;
    this.hp = Math.max(1, Math.round(this.hpMax * ALLY.getUp));
    this._begin('getup');
    const sys = this.sys;
    const p = this.member.position;
    sys.burst('healGlow', p.x, p.y + 0.8, p.z, 6);
    sys.events.emit('allyUp', this.id);
    this._runFrame();
  }

  _frameGetUp() {
    if (this.frame >= ALLY.getUpFrames) {
      this._endAction();
      this._play('idle', true);
      return;
    }
    this._pose('tuck');
  }

  // ------------------------------------------------------------------------------------------
  // Helpers: hit specs, facing, poses, displacement
  // ------------------------------------------------------------------------------------------

  /**
   * Its HitSpec at its feet along the facing (reused; the queue copies it).
   * @param {number} mv
   * @param {number} kb
   * @param {number} poise
   * @returns {HitSpec}
   */
  _baseSpec(mv, kb, poise) {
    const s = this._spec;
    const p = this.member.position;
    const f = this.member.facing;
    s.shape = 'sector';
    s.x = p.x;
    s.y = p.y;
    s.z = p.z;
    s.r = 1;
    s.rInner = 0;
    s.dirX = f.x;
    s.dirZ = f.z;
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
    s.tag = this._tag;
    s.fromX = p.x;
    s.fromZ = p.z;
    return s;
  }

  /** Face a world point (sets the facing; a shown pose turns with it next frame). @param {number} x @param {number} z */
  _face(x, z) {
    const p = this.member.position;
    const dx = x - p.x;
    const dz = z - p.z;
    const l = Math.hypot(dx, dz);
    if (l < 1e-6) return;
    this.member.facing.x = dx / l;
    this.member.facing.z = dz / l;
    if (!this.action && this.member.sprite) this.member.sprite.faceVector(dx, dz);
  }

  /**
   * A combat pose in the row of the facing (seen from the camera yaw), as PlayerCombat's `_pose`.
   * A sheet without combat poses (no `poses`) stands idle instead.
   * @param {string} name
   */
  _pose(name) {
    const s = this.member.sprite;
    if (!s) return;
    const poses = /** @type {{ poses?: Record<string, number> }} */ (s.sheet).poses;
    if (!poses) {
      this._play('idle');
      return;
    }
    const col = poses[name] ?? 0;
    const f = this.member.facing;
    const dir = Sprite3D.directionFromVector(f.x, f.z, globalUniforms.uCameraYaw.value, s.direction);
    const row = Math.max(0, DIRECTIONS.indexOf(dir));
    if (col === this._lastCol && row === this._lastRow && s.animation === null) return;
    s.direction = dir;
    s.setFrame(col, row);
    this._lastCol = col;
    this._lastRow = row;
    this._anim = '';
  }

  /**
   * A locomotion animation (resolved with the facing): no-op while it already plays.
   * @param {'idle'|'walk'|'run'} name
   * @param {boolean} [force] also after a pose
   */
  _play(name, force = false) {
    const s = this.member.sprite;
    if (!s) return;
    // (the cache is trusted only while the sprite still plays it: the follow plays its own)
    if (!force && this._anim === name && s.animation !== null && s.animation.startsWith(name)) {
      const f = this.member.facing;
      s.faceVector(f.x, f.z);
      return;
    }
    const f = this.member.facing;
    s.faceVector(f.x, f.z);
    s.play(name);
    this._anim = name;
    this._lastCol = -1;
    this._lastRow = -1;
  }

  /**
   * Move a total of `dist` u along (dx, dz), eased out between frames f0 and f1 (exclusive).
   * @param {number} dist
   * @param {number} f0
   * @param {number} f1
   * @param {number} dx
   * @param {number} dz
   * @param {boolean} [face] turn the facing with the motion (a lunge, a roll: it already faces it)
   */
  _moveAlong(dist, f0, f1, dx, dz, face = false) {
    if (!(dist > 0)) return;
    const t0 = F(f0);
    const t1 = F(f1);
    const u = Math.max(0, Math.min(1, (this.t - t0) / (t1 - t0)));
    const target = (1 - (1 - u) * (1 - u)) * dist;
    const step = target - this._moved;
    this._moved = target;
    if (step > 1e-6) this._move(dx * step, dz * step, face);
  }

  /**
   * Displace through the member's own `moveBy` (the TileMap, radius 0.3, step 0.55; no collider
   * of its own; x / z only — the party keeps it on the ground): never into a closed arena from
   * outside, never out of the one it is in (the move is cut to the rect first). `face`: turn the
   * facing toward the move (moveBy does); else the facing it had is kept (a slide, a push).
   * @param {number} dx
   * @param {number} dz
   * @param {boolean} face
   * @returns {number} the fraction of the requested move achieved
   */
  _move(dx, dz, face) {
    const len = Math.hypot(dx, dz);
    if (len < 1e-9) return 1;
    const m = this.member;
    const p = m.position;
    const a = this.sys.sealedArena();
    if (a) {
      if (this._arena) {
        const r = a.rect;
        dx = Math.min(r.maxX - 0.35, Math.max(r.minX + 0.35, p.x + dx)) - p.x;
        dz = Math.min(r.maxZ - 0.35, Math.max(r.minZ + 0.35, p.z + dz)) - p.z;
        if (Math.hypot(dx, dz) < 1e-9) return 0;
      } else if (a.containsGrown(p.x + dx, p.z + dz, 0.4) && !a.containsGrown(p.x, p.z, 0.4)) return 0;
    }
    const x0 = p.x;
    const z0 = p.z;
    const fx = m.facing.x;
    const fz = m.facing.z;
    m.moveBy(dx, dz);
    if (!face) {
      m.facing.x = fx;
      m.facing.z = fz;
    }
    return Math.min(1, Math.hypot(p.x - x0, p.z - z0) / len);
  }

  /**
   * A push of the separation (no facing change).
   * @param {number} dx
   * @param {number} dz
   */
  push(dx, dz) {
    this._move(dx, dz, false);
  }

  /** Put it at (x, z) at once (the arena's placement). @param {number} x @param {number} z */
  placeAt(x, z) {
    this.member.placeAt(x, z);
    this.onTeleport();
  }

  // ------------------------------------------------------------------------------------------
  // Per frame (CombatSystem.afterPlayer)
  // ------------------------------------------------------------------------------------------

  /**
   * After the player moved: velocity for the view, the pose row after camera turns, the hurt flash,
   * the i-frame blink, the sprite speed (0 in hit-stop, the player's time scale; 1 again when the
   * follow takes over).
   * @param {number} dt real seconds of the frame
   * @param {boolean} active the combat ran this frame
   * @param {boolean} playing the game is in play mode
   * @param {number} realAdvanced combat seconds advanced this frame
   */
  afterFrame(dt, active, playing, realAdvanced) {
    const s = this.member.sprite;
    if (this.gone || !s) return;
    const sys = this.sys;
    const p = this.member.position;
    if (active && dt > 0) {
      this.view.velocity.x = (p.x - this._prevX) / dt;
      this.view.velocity.z = (p.z - this._prevZ) / dt;
    }
    this._prevX = p.x;
    this._prevZ = p.z;
    const fighting = this.active;
    // the pose row after a camera turn
    if ((this.action || this.down) && this._lastCol >= 0) {
      const f = this.member.facing;
      const dir = Sprite3D.directionFromVector(f.x, f.z, globalUniforms.uCameraYaw.value, s.direction);
      const row = Math.max(0, DIRECTIONS.indexOf(dir));
      if (row !== this._lastRow) {
        s.direction = dir;
        s.setFrame(this._lastCol, row);
        this._lastRow = row;
      }
    }
    // hurt flash, i-frame blink
    if (this.flashT > 0) {
      this.flashT = Math.max(0, this.flashT - realAdvanced);
      if (!this._flashOn) s.setFlash(PLAYER_FLASH.r, PLAYER_FLASH.g, PLAYER_FLASH.b, PLAYER_FLASH.a);
      this._flashOn = true;
    } else if (this._flashOn) {
      s.setFlash(0, 0, 0, 0);
      this._flashOn = false;
    }
    if (this.blink && this.iframes <= 0) this.blink = false;
    const hide = this.blink && !this.down && Math.floor(sys.clock * BLINK_HZ * 2) % 2 === 1;
    if (s.mesh.visible === hide) s.mesh.visible = !hide;
    // animation speed while the combat drives it
    if (fighting) {
      s.speed = !playing ? 1 : !active || sys.stop > 0 ? 0 : sys.playerScale;
      this._speedSet = true;
    } else if (this._speedSet) {
      s.speed = 1;
      this._speedSet = false;
    }
  }

  // ------------------------------------------------------------------------------------------
  // Tests
  // ------------------------------------------------------------------------------------------

  /** Its state (`__game.combat.allies()`, `state().combat.allies`). @returns {AllyState} */
  info() {
    if (!this.gone) this.syncLevel();
    const p = this.member.position;
    const r3 = (v) => +v.toFixed(3);
    return {
      id: this.id, name: this.member.name, cls: this.cls, preset: presetOf(this.rule), level: this.level,
      hp: Math.ceil(this.hp), hpMax: this.hpMax, mp: r3(this.mp), mpMax: this.mpMax, atk: r3(this.atk), def: r3(this.def),
      down: this.down, active: this.active, mode: this.mode, action: this.action, actionFrame: this.frame,
      target: this.target?.uid ?? null, targetedBy: this.sys.targetedBy(this), kills: this.kills,
      x: r3(p.x), z: r3(p.z), invulnerable: this.invulnerable,
      cooldowns: { attack: r3(this.atkCd), skill: r3(this.skillCd), heal: r3(this.healCd), roll: r3(this.rollCd) },
      counts: { ...this.counts },
    };
  }
}

/** `_spaceOut`'s spots: [across the screen (its side first), toward the camera]. */
const SPACE_TRIES = [[1, 0], [-1, 0], [1, 0.6], [-1, 0.6]];

/** An aggroed foe this near the player (u; the combat's engage range) means a fight is on. */
const FIGHT_RANGE = 16;

/** A shooter in line with the player on screen steps aside before it shoots (`_spaceOut`; u). */
const SPACING = Object.freeze({ lateral: 0.9, depth: 2.4, step: 1.8 });

/**
 * A member at a spot this little across the screen from the player (u) and between `near` and
 * `depth` u in front of it (toward the camera) hides the player's body (`_covers`; measured: more
 * than a quarter of the player's body under the member's sprite).
 */
const COVER = Object.freeze({ lateral: 0.8, near: -0.1, depth: 2.2, ahead: 0.5 });

/** A melee member steps to a free spot between thrusts only this far (u). */
const RELOC_MAX = 2.2;

/** Going round the player (`_goTo`): ahead within `ahead` u, the radii + `margin` across; turned by up to atan(`turn`). */
const ROUND = Object.freeze({ ahead: 1.6, margin: 0.15, turn: 1.5 });

/** A shooter's spot counts as on screen within ±this (NDC, at shot height); off screen beyond `OFF_SCREEN`. */
const ON_SCREEN = 0.85;
const OFF_SCREEN = 0.95;

/** A holding member keeps facing its foe while that one is at most this much farther from the player than the nearest (u). */
const LOOK_KEEP = 2;

/** A walking member's facing follows its way over this long (s; `_turnTo`). */
const TURN_TAU = 0.12;

/** A standing member turns to its foe only once it is more than 35° off its facing (`_faceSteady`). */
const STEADY_COS = Math.cos((35 * Math.PI) / 180);

/** A Mend that fizzled (no one needed it at its heal frame): the MP back, the next one this soon (s). */
const MEND_FIZZLE_CD = 1;

/**
 * Added to the target score of a foe not yet in the fight (not aggroed, not the lock-on): the
 * fighting ones first — above every rule's bonus (the boss 1e6, an elite 1e5, the lock-on 1e6).
 */
const NOT_FIGHTING = 1e9;

/** A foe not in the fight yet is a target only this near the player (u; never an elite or the boss). */
const JOIN_NEAR = 6;

/** Farther than this from the player (u), an engaged member that nobody fights leaves it to the follow. */
const FAR_BEHIND = 18;

/** Roll directions tried, in order (rad from the way out). */
const ROLL_TRIES = [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3];

/** @returns {AllyState['counts']} */
function newCounts() {
  return { attacks: 0, hits: 0, crits: 0, skills: 0, heals: 0, healed: 0, rolls: 0, hurts: 0, damageDealt: 0, damageTaken: 0, downs: 0 };
}

/**
 * The action as the enemies read it (`ctx.player.action`): the player's names for the like moves
 * (a goblin hops back from a melee swing: 'attack' / 'skill1').
 * @param {AllyAction|null} a
 * @returns {string|null}
 */
function viewAction(a) {
  switch (a) {
    case 'a1': case 'a2': return 'attack';
    case 'sweep': return 'skill1';
    case 'shot': case 'volley': case 'bolt': case 'flare': return 'skill2';
    case 'roll': return 'roll';
    case 'hurt': return 'hitstun';
    case 'knock': return 'knockdown';
    case 'mend': return 'draught';
    default: return null;
  }
}
