import { combineMode } from './dice.js';
import {
  CONDITIONS, ZONES, rangeU, HL, DC, breaksMorale, injuryResult, injuryBonus, DRAUGHT_HEAL,
} from './rules.js';
import { SPELLS, spellDiceCount, castDc } from './spells.js';
import { HEAL_THRESHOLDS, RETREAT_THRESHOLDS, LEASH } from './allyRules.js';

/**
 * Encounter — one turn-based GLAIVE fight (docs/specs/GLAIVE.md §5): initiative, surprise, turns
 * and rounds, the actions a combatant may take, every roll and its consequence, the monsters' and
 * the companions' choices, morale, going Out of Action, and the end of the fight. Pure logic: it
 * never touches a sprite, the DOM or the clock. It is driven step by step by the game
 * (GlaiveCombat), which shows each step's **beats** — a list of plain records (a move, an attack
 * roll, damage, a save …) — before asking for the next step; tools/test-glaive.mjs drives it the
 * same way with a flat world.
 *
 * Protocol:
 *   const enc = new Encounter({ dice, world, combatants, ambush });
 *   beats = enc.start();                 // initiative, surprise, the first turn begins
 *   while (!enc.over) {
 *     if (enc.needsInput) beats = enc.act(actionFromThePlayer);   // the player's PC
 *     else beats = enc.step(enc.decide());                         // a foe or a companion
 *     // `act` ends the turn itself once the combatant has nothing left to do (or on 'end');
 *     // the next turn begins at once, and its start-of-turn beats are in the same list.
 *   }
 *   enc.result → { outcome, xp, … }
 *
 * The world adapter (`world`) answers geometry: `path(c, x, z, maxLen, stopDist)` → the ground
 * path a combatant walks toward (x, z), cut at `maxLen` u and where it comes within `stopDist` u
 * of the goal (fliers fly straight); `los(ax, az, bx, bz)`; `summon(kind, x, z)` → a new foe
 * combatant init or null (the boss's bats).
 */

/** @import { Dice, RollRecord, DamageRecord, RollMode } from './dice.js' */
/** @import { Sheet } from './Sheet.js' */
/** @import { MonsterStats } from './bestiary.js' */
/** @import { Ability, ConditionId } from './rules.js' */

/**
 * A live condition on a combatant: rounds left (counted down at the start of the bearer's turn;
 * null: until something removes it), an amount (warded), who laid it, and the save that ends it.
 * @typedef {{ rounds: number|null, amount?: number, source?: string, save?: Ability, dc?: number }} LiveCondition
 */

/**
 * What a combatant is in a fight.
 * - 'active': fights. 'down': Out of Action (HP ≤ 0, a PC). 'dead': killed. 'fled': routed or left.
 * @typedef {'active'|'down'|'dead'|'fled'} CombatantState
 */

/**
 * A combatant as the game creates it (`Encounter` options): a party member with a sheet, or a foe
 * with monster stats.
 * @typedef {object} CombatantInit
 * @property {string} id            unique in the fight
 * @property {'party'|'foe'} side
 * @property {string} name          shown in the log (already translated)
 * @property {string} kind          'player' | 'member' | a monster kind
 * @property {Sheet} [sheet]        party
 * @property {MonsterStats} [stats] foes
 * @property {number} x
 * @property {number} z
 * @property {number} [radius]      body radius (u): melee reach adds it
 * @property {boolean} [flier]
 * @property {'player'|'ai'} [controller]  who picks a party member's actions (foes: always ai)
 * @property {import('../../engine/level/PartyRules.js').PartyRule} [rule]  a companion's tactics
 * @property {number} [hp]          a foe's HP now (default its max)
 * @property {any} [ref]            the game's actor (the encounter never reads it)
 */

/**
 * A combatant in the fight (the init plus the fight's state).
 * @typedef {CombatantInit & {
 *   hp: number, hpMax: number, state: CombatantState, conditions: Map<ConditionId, LiveCondition>,
 *   initiative: number, surprised: boolean, moved: boolean, acted: boolean, attacksLeft: number,
 *   freeUsed: boolean, ripostes: number, opportunities: number, cleaves: number,
 *   missedRanged: boolean, missedMelee: string|null, poolIndex: number, poolHp: number,
 *   bossTurn: number, telegraph: { x: number, z: number, r: number }|null, routedFor?: string,
 *   lastTarget: string|null, summoned: boolean, everDown: boolean, lowestHp: number,
 *   mendUses: number, hexReady: boolean
 * }} Combatant
 */

/**
 * An action a combatant takes on its turn.
 * - move: walk toward (x, z), up to one zone (the turn's move).
 * - dash: a second move instead of the action.
 * - attack: the weapon (melee targets must be in reach — `approach` walks there first with the
 *   turn's move; ranged targets in range); `option`: 'smite'.
 * - maneuver: 'trip' | 'disarm' | 'feint' | 'defend' | 'grapple' | 'bash' (a shield bash).
 * - spell: a spellbook at a target or a point.
 * - draught: a Healing Draught for itself or a companion in reach (the party's pack: the player's).
 * - talent: a free or action talent ('rage' | 'radiance' | 'rush' | 'inspire').
 * - flee: the party tries to slip away (a group DEX save).
 * - end: end the turn.
 * @typedef {{ type: 'move'|'dash', x: number, z: number }
 *   | { type: 'attack', target: string, approach?: boolean, option?: 'smite' }
 *   | { type: 'maneuver', name: 'trip'|'disarm'|'feint'|'defend'|'grapple'|'bash', target?: string, approach?: boolean }
 *   | { type: 'spell', spell: string, target?: string, x?: number, z?: number }
 *   | { type: 'draught', target?: string }
 *   | { type: 'talent', talent: 'rage'|'radiance'|'rush'|'inspire', target?: string }
 *   | { type: 'flee' } | { type: 'end' }} Action
 */

/**
 * A beat: one thing that happened, for the game to show (and the log to tell). `who` / `target`
 * are combatant ids. Fields by type are listed in GLAIVE.md §5.6.
 * @typedef {{ t: string, who?: string, target?: string, [k: string]: any }} Beat
 */

/**
 * The fight's outcome.
 * @typedef {object} EncounterResult
 * @property {'victory'|'defeat'|'fled'} outcome
 * @property {number} xp               XP the party earns (foes killed; half for routed ones)
 * @property {string[]} killed         foe ids killed
 * @property {string[]} routed         foe ids that fled
 * @property {{ who: string, roll: number, bonus: number, result: import('./rules.js').InjuryResult, hp: number }[]} injuries
 * @property {number} rounds
 */

/** The boss: its furnace telegraph every this many of its turns; its reach (u) beyond the usual. */
const BOSS = Object.freeze({ furnaceEvery: 3, furnaceR: 3.6, furnaceDc: 14, furnaceDice: '4d6', magmaR: 1.8, magmaDc: 13, magmaDice: '2d6', bats: 2, summonCap: 4 });
/** A shaman's hex: the target saves WIL against this or is frightened for 2 rounds. */
const HEX_DC = 12;
/** A shaman's mend: uses per fight, healing. */
const MEND = Object.freeze({ uses: 2, dice: '1d6' });
/** Grapple DCs by the target's size. */
const GRAPPLE_DC = Object.freeze({ small: DC.normal, big: DC.hard });

export class Encounter {
  /**
   * @param {{ dice: Dice, world: EncounterWorld, combatants: CombatantInit[], ambush?: 'party'|'foes'|null, canFlee?: boolean, leader?: string }} opts
   *   ambush: 'party' — the party struck first (the foes are surprised); 'foes' — the foes caught the
   *   party (each PC saves WIS or is surprised); leader: the player's id (companions follow it)
   */
  constructor({ dice, world, combatants, ambush = null, canFlee = true, leader = 'player' }) {
    this.dice = dice;
    this.world = world;
    this.ambush = ambush;
    this.canFlee = canFlee;
    this.leader = leader;
    /** @type {Combatant[]} */
    this.list = [];
    /** @type {Map<string, Combatant>} */
    this.byId = new Map();
    for (const init of combatants) this._add(init);
    this.round = 0;
    /** @type {string[]} turn order of the round: combatant ids ('foes' block expanded) */
    this.order = [];
    this.turnIndex = -1;
    /** @type {Combatant|null} */
    this.current = null;
    this.over = false;
    /** @type {EncounterResult|null} */
    this.result = null;
    /** @type {Beat[]} */
    this._beats = [];
    /** The foe the player last attacked (companions with target 'leader' follow it). @type {string|null} */
    this.leaderTarget = null;
    /** Morale triggers already rolled. */
    this._morale = { blood: false, half: false, leader: false, solo: false };
    /**
     * Ground hazards (the boss's magma): a disc that burns whoever ends a turn in it.
     * @type {{ id: number, x: number, z: number, r: number, armed: boolean, rounds: number }[]}
     */
    this.hazards = [];
    this._hazardId = 0;
    this.potionsOwner = this.list.find((c) => c.id === leader && c.sheet) ?? null;
  }

  // =============================================================================================
  // Set-up
  // =============================================================================================

  /** @param {CombatantInit} init @returns {Combatant} */
  _add(init) {
    const hpMax = init.sheet ? init.sheet.hpMax : init.stats?.hpMax ?? 1;
    const hp = init.sheet ? init.sheet.hp : Math.min(hpMax, init.hp ?? hpMax);
    /** @type {Combatant} */
    const c = {
      ...init,
      radius: init.radius ?? 0.3,
      flier: !!(init.flier ?? init.stats?.flier),
      controller: init.side === 'foe' ? 'ai' : init.controller ?? 'ai',
      hp, hpMax,
      state: hp > 0 || init.side === 'foe' ? 'active' : 'down',
      conditions: new Map(),
      initiative: 0, surprised: false, moved: false, acted: false, attacksLeft: 1, freeUsed: false,
      ripostes: 0, opportunities: 0, cleaves: 0, missedRanged: false, missedMelee: null,
      poolIndex: 0, poolHp: init.stats?.pools ? init.stats.pools[0] : 0,
      bossTurn: 0, telegraph: null, lastTarget: null, summoned: false, everDown: hp <= 0, lowestHp: hp,
      mendUses: MEND.uses, hexReady: true,
    };
    if (c.stats?.pools) {
      // a boss that starts hurt (a fight resumed): its pools are spent from the first
      let left = c.hpMax - c.hp;
      while (left > 0 && c.poolIndex < c.stats.pools.length - 1 && left >= c.poolHp) { left -= c.poolHp; c.poolIndex++; c.poolHp = c.stats.pools[c.poolIndex]; }
      c.poolHp -= Math.max(0, left);
    }
    this.list.push(c);
    this.byId.set(c.id, c);
    return c;
  }

  /**
   * Roll initiative and surprise, begin round 1 and its first turn.
   * @returns {Beat[]}
   */
  start() {
    const out = this._open();
    // surprise: the side that did not see it coming (GLAIVE: a WIS save each for the PCs; the
    // foes, caught by the party, are surprised — saves stay player-facing)
    if (this.ambush === 'party') {
      for (const c of this.foes()) { c.surprised = true; out.push({ t: 'surprised', who: c.id }); }
    } else if (this.ambush === 'foes') {
      for (const c of this.party()) {
        const s = c.sheet;
        const adv = s && (s.has('skulker') || s.has('alert') || s.has('sneakyGit')) ? 1 : 0;
        const r = this.dice.d20(s ? s.saveBonus('wis') : 0, DC.normal, combineMode(adv, 0));
        out.push({ t: 'save', who: c.id, ability: 'wis', roll: r, reason: 'surprise' });
        if (!r.success) { c.surprised = true; out.push({ t: 'surprised', who: c.id }); }
      }
    }
    // initiative: each PC d20 + DEX (Alert: + WIS); the foes roll once, + their best DEX
    const init = [];
    for (const c of this.party()) {
      const s = c.sheet;
      const mod = (s ? s.abilities.dex + (s.has('alert') ? s.abilities.wis : 0) + s.fatiguePenalty : 0);
      c.initiative = this.dice.die(20) + mod;
      init.push({ who: c.id, total: c.initiative });
    }
    const foes = this.foes();
    if (foes.length) {
      const best = Math.max(...foes.map((c) => c.stats?.dex ?? 0));
      const roll = this.dice.die(20) + best;
      for (const c of foes) c.initiative = roll;
      init.push({ who: 'foes', total: roll });
    }
    out.push({ t: 'initiative', list: init });
    this._newRound(out);
    this._nextTurn(out);
    return this._close();
  }

  // =============================================================================================
  // Queries
  // =============================================================================================

  /** Party combatants still fighting. */
  party() { return this.list.filter((c) => c.side === 'party' && c.state === 'active'); }
  /** Foes still fighting. */
  foes() { return this.list.filter((c) => c.side === 'foe' && c.state === 'active'); }
  /** @param {string} id */
  get(id) { return this.byId.get(id) ?? null; }

  /** True when the current combatant waits for the player's choice. */
  get needsInput() {
    const c = this.current;
    return !this.over && !!c && c.controller === 'player' && c.side === 'party';
  }

  /** @param {Combatant} a @param {Combatant} b */
  dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

  /** Melee reach between two combatants (u, centre to centre). @param {Combatant} a @param {Combatant} b */
  reachOf(a, b) { return ZONES.reach + Math.max(0, a.radius - 0.3) + Math.max(0, b.radius - 0.3); }

  /** Is b in a's melee reach? @param {Combatant} a @param {Combatant} b */
  inReach(a, b) { return this.dist(a, b) <= this.reachOf(a, b) + 1e-6; }

  /** Live foes of `c`. @param {Combatant} c */
  enemiesOf(c) { return c.side === 'party' ? this.foes() : this.party(); }
  /** Live friends of `c` (itself included). @param {Combatant} c */
  friendsOf(c) { return c.side === 'party' ? this.party() : this.foes(); }

  /** @param {Combatant} c @param {ConditionId} id */
  has(c, id) { return c.conditions.has(id); }

  /** Armour class now (sheet or stats, conditions, a ward). @param {Combatant} c @param {boolean} [vsRanged] */
  acOf(c, vsRanged = false) {
    let ac = c.sheet ? c.sheet.ac : c.stats?.ac ?? 10;
    for (const [id, lc] of c.conditions) {
      ac += CONDITIONS[id]?.acMod ?? 0;
      if (id === 'warded') ac += lc.amount ?? 2;
    }
    if (vsRanged && c.sheet?.shield && c.sheet.has('shieldMaster')) ac += 2;
    return ac;
  }

  /** The ranged weapon's reach of `c` (u); 0 when it has none. @param {Combatant} c */
  rangeOf(c) {
    if (c.sheet) {
      const w = c.sheet.weaponDef;
      return w.range > 0 ? rangeU(w.range) : 0;
    }
    const a = c.stats?.attacks.find((x) => x.range > 0);
    return a ? rangeU(a.range) : 0;
  }

  /** Can `c` shoot `t` from where it stands? @param {Combatant} c @param {Combatant} t */
  canShoot(c, t) {
    const r = this.rangeOf(c);
    return r > 0 && this.dist(c, t) <= r && this.world.los(c.x, c.z, t.x, t.z);
  }

  /**
   * The actions the current combatant may take now (for the menu): which are open and their targets.
   * @returns {{ move: boolean, action: boolean, attack: string[], approach: string[], shoot: string[],
   *   maneuvers: string[], spells: { id: string, ok: boolean }[], draught: boolean, talents: string[],
   *   flee: boolean, rage: boolean }}
   */
  options() {
    const c = this.current;
    const none = { move: false, action: false, attack: [], approach: [], shoot: [], maneuvers: [], spells: [], draught: false, talents: [], flee: false, rage: false };
    if (!c || this.over) return none;
    const s = c.sheet;
    const canMove = !c.moved && !this._noMove(c);
    const action = !c.acted;
    const foes = this.enemiesOf(c);
    const ranged = s ? s.ranged : false;
    const attack = [], approach = [], shoot = [];
    if (action) {
      for (const f of foes) {
        if (ranged) { if (this.canShoot(c, f)) shoot.push(f.id); }
        else if (this.inReach(c, f)) attack.push(f.id);
        else if (canMove && this.dist(c, f) <= ZONES.move + this.reachOf(c, f)) approach.push(f.id);
      }
    }
    const maneuvers = action && !ranged && (attack.length || approach.length) ? ['trip', 'disarm', 'feint', 'grapple', ...(s?.shield ? ['bash'] : [])] : [];
    if (action) maneuvers.push('defend');
    const spells = s && !this.has(c, 'raging') ? s.spells.map((id) => ({ id, ok: action && s.canCast(id) })) : [];
    const talents = [];
    if (s) {
      if (s.has('rage') && !c.freeUsed && !this.has(c, 'raging') && s.usesLeft('rage') > 0) talents.push('rage');
      if (s.has('radiance') && !c.freeUsed && s.usesLeft('radiance') > 0) talents.push('radiance');
      if (s.has('rush') && !c.freeUsed && c.moved && action && s.usesLeft('rush') > 0) talents.push('rush');
      if (s.has('inspire') && action && this.party().some((p) => p !== c && this.dist(c, p) <= rangeU(1))) talents.push('inspire');
    }
    const owner = this.potionsOwner?.sheet;
    const draught = action && !!owner && owner.potions > 0;
    const flee = action && this.canFlee && c.side === 'party' && this.party().every((p) => foes.every((f) => this.dist(p, f) > ZONES.flee));
    return { move: canMove, action, attack, approach, shoot, maneuvers, spells, draught, talents, flee, rage: talents.includes('rage') };
  }

  // =============================================================================================
  // Turns
  // =============================================================================================

  /** @param {Beat[]} out */
  _newRound(out) {
    this.round++;
    // the order: highest initiative first; ties go to the party; the foes act as one block
    const party = this.list.filter((c) => c.side === 'party' && c.state === 'active');
    const foes = this.list.filter((c) => c.side === 'foe' && c.state === 'active');
    const slots = party.map((c) => ({ ids: [c.id], init: c.initiative, party: 1 }));
    if (foes.length) slots.push({ ids: foes.map((c) => c.id), init: foes[0].initiative, party: 0 });
    slots.sort((a, b) => b.init - a.init || b.party - a.party);
    this.order = slots.flatMap((s) => s.ids);
    this.turnIndex = -1;
    for (const c of this.list) { c.ripostes = 0; c.opportunities = 0; c.cleaves = 0; }
    out.push({ t: 'round', n: this.round, order: [...this.order] });
    // hazards armed last round burn on; their timers run down
    for (const h of this.hazards) h.rounds--;
    const gone = this.hazards.filter((h) => h.rounds <= 0);
    for (const h of gone) out.push({ t: 'hazardOff', id: h.id });
    this.hazards = this.hazards.filter((h) => h.rounds > 0);
    for (const h of this.hazards) if (!h.armed) { h.armed = true; out.push({ t: 'hazardOn', id: h.id, x: h.x, z: h.z, r: h.r }); }
  }

  /** Advance to the next combatant who can take a turn, starting it. @param {Beat[]} out */
  _nextTurn(out) {
    for (let guard = 0; guard < 400; guard++) {
      if (this._checkEnd(out)) return;
      this.turnIndex++;
      if (this.turnIndex >= this.order.length) {
        this._newRound(out);
        continue;
      }
      const c = this.get(this.order[this.turnIndex]);
      if (!c || c.state !== 'active') continue;
      this.current = c;
      if (this._beginTurn(c, out)) return;
      // a lost turn (surprised, asleep, stunned without a save): straight on to the next one
      this._finishTurn(c, out);
    }
  }

  /**
   * Start-of-turn: conditions run down and end saves are rolled; a surprised or unconscious
   * combatant loses the turn. Returns true when it may act.
   * @param {Combatant} c
   * @param {Beat[]} out
   */
  _beginTurn(c, out) {
    c.moved = false;
    c.acted = false;
    c.freeUsed = false;
    c.attacksLeft = c.sheet?.has('professionalKiller') && !c.sheet.ranged ? 2 : c.stats?.attacksPerTurn ?? 1;
    out.push({ t: 'turn', who: c.id, round: this.round });
    // what lasted "until your next turn" ends now
    for (const id of /** @type {ConditionId[]} */ (['defending', 'offBalance'])) {
      if (c.conditions.delete(id)) out.push({ t: 'condition', who: c.id, id, on: false });
    }
    if (c.surprised) {
      c.surprised = false;
      out.push({ t: 'lostTurn', who: c.id, reason: 'surprised' });
      return false;
    }
    // prone: standing up takes the move
    if (c.conditions.delete('prone')) {
      c.moved = true;
      out.push({ t: 'condition', who: c.id, id: 'prone', on: false, stood: true });
    }
    // timed conditions; an end save (WIL for fear, STR for a grapple …) is tried at the start of the turn
    for (const [id, lc] of [...c.conditions]) {
      if (lc.save) {
        const r = this._save(c, lc.save, lc.dc ?? DC.normal, out, `end:${id}`);
        if (r.success) { c.conditions.delete(id); out.push({ t: 'condition', who: c.id, id, on: false }); continue; }
      }
      if (lc.rounds !== null) {
        lc.rounds--;
        if (lc.rounds <= 0) { c.conditions.delete(id); out.push({ t: 'condition', who: c.id, id, on: false }); }
      }
    }
    if (this.has(c, 'unconscious')) {
      out.push({ t: 'lostTurn', who: c.id, reason: 'asleep' });
      return false;
    }
    if (c.stats?.moves.includes('passive')) {
      out.push({ t: 'lostTurn', who: c.id, reason: 'passive' });
      return false;
    }
    if (this.has(c, 'stunned') && c.side === 'foe') {
      // a stunned foe reels for the turn (a PC may still act, with DISADV)
      out.push({ t: 'lostTurn', who: c.id, reason: 'stunned' });
      return false;
    }
    return true;
  }

  /** End-of-turn: hazards burn whoever stands in them. @param {Combatant} c @param {Beat[]} out */
  _finishTurn(c, out) {
    if (c.state !== 'active' || c.flier) return;
    for (const h of this.hazards) {
      if (!h.armed || Math.hypot(c.x - h.x, c.z - h.z) > h.r) continue;
      const r = this._save(c, 'dex', BOSS.magmaDc, out, 'magma');
      if (!r.success) this._damage(c, this.dice.roll(BOSS.magmaDice).total, null, out, 'fire');
      break;
    }
  }

  /**
   * Take an action for the current combatant. Returns the beats; when its turn is over (both move
   * and action spent, 'end', or it fell) the next turn begins and its start beats follow.
   * @param {Action} a
   * @returns {Beat[]}
   */
  act(a) {
    const out = this._open();
    const c = this.current;
    if (!c || this.over) return this._close();
    let endTurn = false;
    const was = `${c.moved}|${c.acted}|${c.freeUsed}|${c.x}|${c.z}`;
    switch (a?.type) {
      case 'move': this._move(c, a.x, a.z, false, out); break;
      case 'dash': this._dash(c, a.x, a.z, out); break;
      case 'attack': this._attackAction(c, a, out); break;
      case 'maneuver': this._maneuver(c, a, out); break;
      case 'spell': this._spell(c, a, out); break;
      case 'draught': this._draught(c, a, out); break;
      case 'talent': this._talent(c, a, out); break;
      case 'flee': this._flee(c, out); break;
      case 'end': endTurn = true; break;
      default: endTurn = true;
    }
    if (this.over) return this._close();
    // an AI choice the rules refused (nothing changed): its turn ends rather than asking again
    if (c.controller === 'ai' && !out.length && was === `${c.moved}|${c.acted}|${c.freeUsed}|${c.x}|${c.z}`) endTurn = true;
    const spent = c.state !== 'active' || (c.acted && (c.moved || this._noMove(c))) || endTurn || this._checkEnd(out);
    // an AI combatant always ends its turn after its action (it moved first if it wanted to)
    if (spent || (c.controller === 'ai' && c.acted)) {
      if (!this.over) {
        this._finishTurn(c, out);
        this._nextTurn(out);
      }
    }
    return this._close();
  }

  /** @param {Combatant} c */
  _noMove(c) {
    for (const id of c.conditions.keys()) if (CONDITIONS[id]?.noMove) return true;
    return false;
  }

  // =============================================================================================
  // Movement
  // =============================================================================================

  /**
   * Walk toward (x, z), up to one zone. `free`: a move that costs nothing (Rush, a charge).
   * @param {Combatant} c
   * @param {number} x
   * @param {number} z
   * @param {boolean} free
   * @param {Beat[]} out
   * @param {number} [stopDist] stop this close to (x, z)
   * @param {number} [maxLen]
   */
  _move(c, x, z, free, out, stopDist = 0, maxLen = ZONES.move) {
    if (!free && (c.moved || this._noMove(c))) {
      c.moved = true;
      return false;
    }
    if (this.has(c, 'slowed') && c.side === 'party') {
      // slowed: a STR save to move at all
      const r = this._save(c, 'str', DC.normal, out, 'slowed');
      if (!r.success) { c.moved = true; return false; }
    }
    const p = this.world.path(c, x, z, maxLen, stopDist, this.list.filter((o) => o !== c && o.state === 'active'));
    if (!free) c.moved = true;
    if (!p || p.len < 0.05) return false;
    const fromX = c.x, fromZ = c.z;
    c.x = p.x;
    c.z = p.z;
    out.push({ t: 'move', who: c.id, points: p.points, fly: c.flier, len: p.len });
    // grapples break when either side walks off
    if (this.has(c, 'grappled')) { c.conditions.delete('grappled'); out.push({ t: 'condition', who: c.id, id: 'grappled', on: false }); }
    // Opportunist: leaving a warrior's reach provokes a free attack
    for (const o of this.enemiesOf(c)) {
      if (!o.sheet?.has('opportunist') || o.opportunities >= HL(o.sheet.level) || o.sheet.ranged) continue;
      const wasIn = Math.hypot(fromX - o.x, fromZ - o.z) <= this.reachOf(o, c);
      if (wasIn && !this.inReach(o, c)) {
        o.opportunities++;
        out.push({ t: 'talent', who: o.id, id: 'opportunist' });
        // (struck where it left from: the swing lands as it turns away)
        const keepX = c.x, keepZ = c.z;
        c.x = fromX; c.z = fromZ;
        this._strike(o, c, out, { free: true });
        c.x = keepX; c.z = keepZ;
        if (c.state !== 'active') return true;
      }
    }
    return true;
  }

  /** A second move in place of the action. @param {Combatant} c @param {number} x @param {number} z @param {Beat[]} out */
  _dash(c, x, z, out) {
    if (c.acted || this._noMove(c)) return;
    c.acted = true;
    const wasMoved = c.moved;
    this._move(c, x, z, true, out);
    c.moved = wasMoved || true;
  }

  /**
   * Walk into reach of `t` with the turn's move (if needed and still free). True when in reach after.
   * @param {Combatant} c
   * @param {Combatant} t
   * @param {Beat[]} out
   */
  _approach(c, t, out) {
    if (this.inReach(c, t)) return true;
    if (c.moved || this._noMove(c)) return false;
    this._move(c, t.x, t.z, false, out, this.reachOf(c, t) - 0.15);
    return c.state === 'active' && this.inReach(c, t);
  }

  // =============================================================================================
  // Attacks
  // =============================================================================================

  /** @param {Combatant} c @param {Extract<Action, { type: 'attack' }>} a @param {Beat[]} out */
  _attackAction(c, a, out) {
    if (c.acted) return;
    const t = this.get(a.target);
    if (!t || t.state !== 'active' || t.side === c.side) return;
    const ranged = c.sheet ? c.sheet.ranged : false;
    if (ranged) {
      if (!this.canShoot(c, t)) return;
    } else if (!this.inReach(c, t)) {
      if (!a.approach || !this._approach(c, t, out)) return;
    }
    c.acted = true;
    if (c.id === this.leader) this.leaderTarget = t.id;
    c.lastTarget = t.id;
    // the attacks of the turn: Professional Killer swings twice; Quick Shot shoots again if it stood still
    let n = c.attacksLeft;
    if (ranged && c.sheet?.has('quickShot') && !c.moved) n = 2;
    let target = t;
    for (let i = 0; i < n; i++) {
      if (!target || target.state !== 'active') {
        target = this._nextTarget(c, ranged);
        if (!target) break;
      }
      this._strike(c, target, out, { option: i === 0 ? a.option : undefined });
      if (c.state !== 'active' || this._checkEnd(out)) break;
    }
  }

  /** Another foe to hit (a follow-up attack after a kill). @param {Combatant} c @param {boolean} ranged */
  _nextTarget(c, ranged) {
    let best = null, bd = Infinity;
    for (const f of this.enemiesOf(c)) {
      const ok = ranged ? this.canShoot(c, f) : this.inReach(c, f);
      const d = this.dist(c, f);
      if (ok && d < bd) { bd = d; best = f; }
    }
    return best;
  }

  /**
   * The modes of an attack by `c` on `t`: ADV / DISADV sources (GLAIVE: they cancel, never stack).
   * @param {Combatant} c
   * @param {Combatant} t
   * @param {boolean} ranged
   * @param {{ maneuver?: boolean, charge?: boolean }} [o]
   * @returns {{ mode: RollMode, situational: boolean }}
   */
  _attackMode(c, t, ranged, o = {}) {
    let adv = 0, dis = 0, situational = false;
    for (const id of c.conditions.keys()) {
      const d = CONDITIONS[id];
      if (d?.attackAdv) adv++;
      if (d?.attackDisadv) dis++;
    }
    if (this.has(c, 'feinting') || this.has(c, 'rushing')) { adv++; situational = true; }
    for (const id of t.conditions.keys()) {
      const d = CONDITIONS[id];
      if (d?.attackedAdv && !(id === 'prone' && ranged)) { adv++; situational = true; }
      if (d?.attackedDisadv) dis++;
      if (d?.rangedAttackedDisadv && ranged) dis++;
    }
    if (t.surprised) { adv++; situational = true; }
    const s = c.sheet;
    if (ranged) {
      // a shot at a foe in the same zone has DISADV (Inhuman Accuracy ignores it)
      if (!s?.has('inhumanAccuracy') && this.enemiesOf(c).some((f) => this.dist(c, f) <= ZONES.zone)) dis++;
      if (s?.has('deadeye') && c.missedRanged) adv++;
    } else {
      if (s?.has('heavensTouch') && c.missedMelee === t.id) adv++;
      if (o.maneuver && s?.has('veteran')) adv++;
      // the goblin's gang-up: another foe of the target already in its reach
      if (c.stats?.moves.includes('gang') && this.friendsOf(c).some((f) => f !== c && this.inReach(f, t))) { adv++; situational = true; }
      // flanking: an ally of the attacker stands in reach of the target on its far side
      if (s && this.friendsOf(c).some((f) => f !== c && this.inReach(f, t) && (f.x - t.x) * (c.x - t.x) + (f.z - t.z) * (c.z - t.z) < 0)) { adv++; situational = true; }
    }
    if (o.charge) { adv++; situational = true; }
    return { mode: combineMode(adv, dis), situational };
  }

  /**
   * One weapon attack (or a maneuver's roll) of `c` against `t`, with every consequence: the roll,
   * the hit, damage, a laid condition, a kill, Cleave, Riposte. Returns whether it hit.
   * @param {Combatant} c
   * @param {Combatant} t
   * @param {Beat[]} out
   * @param {{ option?: 'smite', free?: boolean, maneuver?: string, attack?: import('./bestiary.js').MonsterAttack, charge?: boolean, half?: boolean }} [o]
   */
  _strike(c, t, out, o = {}) {
    const s = c.sheet;
    const atk = o.attack ?? (c.stats ? this._monsterAttack(c, t) : null);
    const ranged = s ? s.ranged : !!(atk && atk.range > 0);
    const { mode, situational } = this._attackMode(c, t, ranged, { maneuver: !!o.maneuver, charge: o.charge });
    // used up by the attack
    for (const id of /** @type {ConditionId[]} */ (['feinting', 'rushing'])) if (c.conditions.delete(id)) out.push({ t: 'condition', who: c.id, id, on: false });
    let mod = s ? s.attackBonus(ranged) : (c.stats?.atk ?? 0);
    let inspired = 0;
    if (c.conditions.has('inspired')) {
      inspired = this.dice.die(4);
      mod += inspired;
      c.conditions.delete('inspired');
    }
    const critFrom = s?.has('hackSlash') && !ranged ? 18 : 20;
    const ac = this.acOf(t, ranged);
    let roll = this.dice.d20(mod, ac, mode, critFrom);
    // the dummy and the unconscious: every hit lands as a critical
    if (t.conditions.has('unconscious')) roll = { ...roll, success: true, crit: true };
    const name = s ? s.weaponDef.name : atk?.name ?? 'Attack';
    /** @type {Beat} */
    const beat = { t: 'attack', who: c.id, target: t.id, name, ranged, roll, hit: roll.success, crit: roll.success && roll.crit, maneuver: o.maneuver ?? null, inspired, free: !!o.free, dmg: 0 };
    out.push(beat);
    if (!roll.success) {
      if (ranged) c.missedRanged = true; else c.missedMelee = t.id;
      if (roll.fumble && !c.conditions.has('offBalance')) {
        c.conditions.set('offBalance', { rounds: null });
        out.push({ t: 'condition', who: c.id, id: 'offBalance', on: true });
      }
      return false;
    }
    if (ranged) c.missedRanged = false; else c.missedMelee = null;
    // damage: the weapon (a crit or a rage rolls it with ADV), STR, Savage Strike, Smite, Backstab
    const dmgMode = beat.crit || this.has(c, 'raging') ? 'adv' : 'normal';
    const expr = s ? s.damageDice : atk?.damage ?? '1d4';
    let dmg = this.dice.roll(expr, { mode: dmgMode, extraMod: s ? s.damageBonus : 0 });
    if (s?.has('savageStrike') && sumDice(dmg) <= 3) {
      const again = this.dice.roll(expr, { mode: dmgMode, extraMod: s.damageBonus });
      if (again.total > dmg.total) dmg = again;
      out.push({ t: 'talent', who: c.id, id: 'savageStrike' });
    }
    let total = dmg.total;
    /** @type {string[]} */
    const extras = [];
    if (s && o.option === 'smite' && s.has('smite') && s.usesLeft('smite') > 0 && !ranged) {
      s.spend('smite');
      const r = this.dice.roll({ count: HL(s.level), sides: 6, mod: 0 });
      total += r.total;
      extras.push(`smite:${r.total}`);
    }
    if (s?.has('backstab') && !ranged && (situational || mode === 'adv')) {
      const r = this.dice.roll({ count: HL(s.level), sides: 6, mod: 0 });
      total += r.total;
      extras.push(`backstab:${r.total}`);
    }
    if (s?.has('monsterSlayer') && t.side === 'foe' && t.hp <= t.hpMax / 2 && s.usesLeft('monsterSlayer') > 0 && !o.maneuver) {
      s.spend('monsterSlayer');
      const max = parseMax(expr) + s.damageBonus;
      if (max > dmg.total) { total += max - dmg.total; extras.push('monsterSlayer'); }
    }
    if (t.conditions.has('blinded')) total += 2;
    // a maneuver deals half (GLAIVE: disarm, feint, trip, shield bash)
    if (o.maneuver || o.half) total = Math.ceil(total / 2);
    beat.damage = dmg;
    beat.extras = extras;
    const before = t.state;
    beat.dmg = this._damage(t, total, c, out, 'physical');
    // a crit with a two-handed brute weapon knocks prone
    if (beat.crit && s?.weaponDef.proneOnCrit && t.state === 'active') this._lay(t, 'prone', { rounds: null, source: c.id }, out);
    // the monster's rider (slime's grip, boar's gore, golem's slam): the target saves or suffers it
    if (atk?.condition && t.state === 'active') {
      const r = this._save(t, atk.save ?? 'str', atk.dc ?? DC.normal, out, `resist:${atk.condition}`);
      if (!r.success) this._lay(t, atk.condition, { rounds: atk.rounds ?? 1, source: c.id }, out);
    }
    // Cleave: a kill earns another swing at a foe in reach
    if (before === 'active' && t.state !== 'active' && s?.has('cleave') && !ranged && c.cleaves < HL(s.level)) {
      const next = this._nextTarget(c, false);
      if (next) {
        c.cleaves++;
        out.push({ t: 'talent', who: c.id, id: 'cleave' });
        this._strike(c, next, out, { free: true });
      }
    }
    // Riposte: struck in melee, a warrior strikes back
    if (!ranged && t.state === 'active' && t.sheet?.has('riposte') && t.ripostes < 1 && !t.sheet.ranged && this.inReach(t, c) && c.state === 'active' && !o.free) {
      t.ripostes++;
      out.push({ t: 'talent', who: t.id, id: 'riposte' });
      this._strike(t, c, out, { free: true });
    }
    return true;
  }

  /** The attack a monster uses on `t` (its ranged one when the target is out of reach). @param {Combatant} c @param {Combatant} t */
  _monsterAttack(c, t) {
    const list = c.stats?.attacks ?? [];
    if (!list.length) return null;
    if (this.inReach(c, t)) return list.find((a) => a.range === 0) ?? list[0];
    return list.find((a) => a.range > 0) ?? list[0];
  }

  /**
   * Deal damage to `t` (after rage, wards …); handles Out of Action and death. Returns the HP taken.
   * @param {Combatant} t
   * @param {number} amount
   * @param {Combatant|null} from
   * @param {Beat[]} out
   * @param {'physical'|'magic'|'fire'} kind
   */
  _damage(t, amount, from, out, kind) {
    if (t.state !== 'active' || amount <= 0) return 0;
    let n = Math.round(amount);
    const s = t.sheet;
    /** @type {string[]} */
    const notes = [];
    if (kind === 'physical' && this.has(t, 'raging')) { n = Math.ceil(n / 2); notes.push('rage'); }
    if (kind !== 'physical' && s?.has('magicWard')) { n = Math.ceil(n / 2); notes.push('magicWard'); }
    if (s?.has('girdedLoins') && s.usesLeft('girdedLoins') > 0 && n >= Math.max(4, Math.ceil(t.hpMax / 4))) {
      s.spend('girdedLoins');
      n = Math.ceil(n / 2);
      notes.push('girdedLoins');
    }
    // a sleeper wakes when hurt
    if (t.conditions.delete('unconscious')) out.push({ t: 'condition', who: t.id, id: 'unconscious', on: false });
    // the boss: damage comes off its current pool; a spent pool is a new phase
    if (t.stats?.pools) {
      const take = Math.min(n, t.poolHp);
      t.poolHp -= take;
      t.hp -= take;
      out.push({ t: 'damage', who: t.id, amount: take, from: from?.id ?? null, kind, notes, hp: t.hp });
      if (t.poolHp <= 0 && t.poolIndex < t.stats.pools.length - 1) {
        t.poolIndex++;
        t.poolHp = t.stats.pools[t.poolIndex];
        t.telegraph = null;
        t.conditions.clear();
        out.push({ t: 'phase', who: t.id, phase: t.poolIndex + 1 });
        this._bossPhaseStart(t, out);
      } else if (t.poolHp <= 0) this._kill(t, from, out);
      return take;
    }
    if (t.stats?.moves.includes('passive')) {
      // the training dummy takes the hit, shows it, and stands full again
      out.push({ t: 'damage', who: t.id, amount: n, from: from?.id ?? null, kind, notes, hp: t.hpMax });
      return n;
    }
    t.hp -= n;
    t.lowestHp = Math.min(t.lowestHp, t.hp);
    out.push({ t: 'damage', who: t.id, amount: n, from: from?.id ?? null, kind, notes, hp: t.hp });
    if (t.hp > 0) {
      if (t.side === 'foe') this._moraleOnHurt(t, out);
      return n;
    }
    if (t.side === 'foe') {
      this._kill(t, from, out);
      return n;
    }
    // a PC at 0 or below: Die Hard / Tough as Nails keep it up once a rest; else Out of Action,
    // or dead below −(5 + STR)
    if (s && t.hp > s.deathAt) {
      for (const id of ['dieHard', 'toughAsNails']) {
        if (s.has(id) && s.usesLeft(id) > 0) {
          s.spend(id);
          t.hp = 1;
          out.push({ t: 'talent', who: t.id, id });
          out.push({ t: 'heal', who: t.id, amount: 0, hp: 1 });
          return n;
        }
      }
    }
    t.state = s && t.hp < s.deathAt ? 'dead' : 'down';
    t.everDown = true;
    t.conditions.clear();
    out.push({ t: t.state === 'dead' ? 'dead' : 'down', who: t.id, hp: t.hp });
    return n;
  }

  /** A foe dies. @param {Combatant} t @param {Combatant|null} from @param {Beat[]} out */
  _kill(t, from, out) {
    t.state = 'dead';
    t.hp = Math.min(t.hp, 0);
    t.conditions.clear();
    out.push({ t: 'dead', who: t.id, by: from?.id ?? null });
    this._moraleOnDeath(t, out);
  }

  /**
   * Heal `t` (never above max; a downed PC comes back up).
   * @param {Combatant} t
   * @param {number} n
   * @param {Beat[]} out
   * @param {Combatant|null} [from]
   */
  _heal(t, n, out, from = null) {
    if (t.state === 'dead' || t.state === 'fled' || n <= 0) return 0;
    const before = t.hp;
    t.hp = Math.min(t.hpMax, Math.max(t.hp, 0) + n);
    if (t.sheet) t.sheet.hp = t.hp;
    if (t.state === 'down' && t.hp > 0) {
      t.state = 'active';
      out.push({ t: 'up', who: t.id });
      // back in the order of the next round (it lost this round's turn)
    }
    const amount = t.hp - Math.max(before, 0);
    out.push({ t: 'heal', who: t.id, amount, hp: t.hp, from: from?.id ?? null });
    return amount;
  }

  /**
   * Lay a condition (renewing a longer one).
   * @param {Combatant} t
   * @param {ConditionId} id
   * @param {LiveCondition} lc
   * @param {Beat[]} out
   */
  _lay(t, id, lc, out) {
    if (t.state !== 'active') return;
    // the boss shrugs off what would pin a mountain of stone
    if (t.stats?.boss && ['prone', 'grappled', 'unconscious', 'slowed', 'stunned', 'frightened', 'disarmed'].includes(id)) {
      out.push({ t: 'immune', who: t.id, id });
      return;
    }
    if (t.sheet?.has('thriceDivided') && (id === 'unconscious' || id === 'frightened')) {
      out.push({ t: 'immune', who: t.id, id });
      return;
    }
    const have = t.conditions.get(id);
    if (have && have.rounds !== null && lc.rounds !== null && have.rounds >= lc.rounds && (have.amount ?? 0) >= (lc.amount ?? 0)) return;
    t.conditions.set(id, { ...lc });
    out.push({ t: 'condition', who: t.id, id, on: true, rounds: lc.rounds });
  }

  /**
   * A save by `c`: d20 + its ability (a foe: its save bonus) against `dc`, with ADV / DISADV from
   * conditions and talents.
   * @param {Combatant} c
   * @param {Ability} ability
   * @param {number} dc
   * @param {Beat[]} out
   * @param {string} reason
   * @returns {RollRecord}
   */
  _save(c, ability, dc, out, reason) {
    let adv = 0, dis = 0;
    for (const id of c.conditions.keys()) if (CONDITIONS[id]?.saveDisadv) dis++;
    const s = c.sheet;
    if (s) {
      if (ability === 'str' && s.has('brickOuthouse')) adv++;
      if (ability === 'str' && s.has('rootsOfMountain') && /prone/.test(reason)) adv++;
      if (ability === 'dex' && s.has('evasion')) adv++;
      if (s.has('girdedLoins') && /frightened|morale/.test(reason)) adv++;
    }
    let mod = s ? s.saveBonus(ability) : (c.stats?.saves?.[ability] ?? 0);
    let inspired = 0;
    if (c.conditions.has('inspired')) { inspired = this.dice.die(4); mod += inspired; c.conditions.delete('inspired'); }
    let r = this.dice.d20(mod, dc, combineMode(adv, dis));
    // a failed save: Luck of the Small Folk / Signs & Portents reroll it once a rest
    if (!r.success && s) {
      for (const id of ['luckOfSmallFolk', 'signsPortents']) {
        if (s.has(id) && s.usesLeft(id) > 0) {
          s.spend(id);
          out.push({ t: 'talent', who: c.id, id });
          r = this.dice.d20(mod, dc, combineMode(adv, dis));
          break;
        }
      }
    }
    out.push({ t: 'save', who: c.id, ability, roll: r, reason, inspired });
    return r;
  }

  // =============================================================================================
  // Maneuvers, spells, draughts, talents, fleeing
  // =============================================================================================

  /** @param {Combatant} c @param {Extract<Action, { type: 'maneuver' }>} a @param {Beat[]} out */
  _maneuver(c, a, out) {
    if (c.acted) return;
    if (a.name === 'defend') {
      c.acted = true;
      this._lay(c, 'defending', { rounds: null }, out);
      out.push({ t: 'maneuver', who: c.id, name: 'defend' });
      return;
    }
    const t = this.get(a.target ?? '');
    if (!t || t.state !== 'active' || t.side === c.side || c.sheet?.ranged) return;
    if (a.name === 'bash' && !c.sheet?.shield) return;
    if (!this.inReach(c, t) && !(a.approach && this._approach(c, t, out))) return;
    c.acted = true;
    if (c.id === this.leader) this.leaderTarget = t.id;
    out.push({ t: 'maneuver', who: c.id, name: a.name, target: t.id });
    if (a.name === 'grapple') {
      // a STR save to grab hold (harder on a big foe; the boss cannot be held)
      const big = (t.radius ?? 0.3) > 0.45 || (t.stats?.hd ?? 1) >= 3;
      const r = this._save(c, 'str', t.stats?.boss ? 99 : big ? GRAPPLE_DC.big : GRAPPLE_DC.small, out, 'grapple');
      if (r.success) this._lay(t, 'grappled', { rounds: 2, source: c.id, save: 'str', dc: DC.normal }, out);
      return;
    }
    const hit = this._strike(c, t, out, { maneuver: a.name });
    if (!hit || t.state !== 'active') return;
    if (a.name === 'trip') {
      if (t.flier) out.push({ t: 'immune', who: t.id, id: 'prone' });
      else this._lay(t, 'prone', { rounds: null, source: c.id }, out);
    } else if (a.name === 'disarm') {
      if (t.stats && ['slime', 'bat', 'boar', 'golem'].includes(t.kind)) out.push({ t: 'immune', who: t.id, id: 'disarmed' });
      else this._lay(t, 'disarmed', { rounds: 1, source: c.id }, out);
    } else if (a.name === 'feint') {
      this._lay(c, 'feinting', { rounds: 2 }, out);
    } else if (a.name === 'bash') {
      this._lay(t, 'stunned', { rounds: 1, source: c.id }, out);
    }
  }

  /** @param {Combatant} c @param {Extract<Action, { type: 'spell' }>} a @param {Beat[]} out */
  _spell(c, a, out) {
    const s = c.sheet;
    const def = SPELLS[a.spell];
    if (c.acted || !s || !def || !s.canCast(a.spell) || this.has(c, 'raging')) return;
    const L = s.level;
    const reach = def.range > 0 ? rangeU(def.range) : ZONES.reach + 0.6;
    /** @type {Combatant[]} */
    let targets = [];
    let px = c.x, pz = c.z;
    if (def.target === 'self') targets = [c];
    else if (def.target === 'foe' || def.target === 'ally') {
      const t = this.get(a.target ?? '') ?? (def.target === 'ally' ? c : null);
      if (!t || t.state === 'dead' || t.state === 'fled') return;
      if (def.target === 'foe' && (t.side === c.side || t.state !== 'active')) return;
      if (def.target === 'ally' && t.side !== c.side) return;
      if (t !== c && (this.dist(c, t) > reach || !this.world.los(c.x, c.z, t.x, t.z))) return;
      targets = [t];
      px = t.x; pz = t.z;
    } else {
      px = Number.isFinite(a.x) ? a.x : c.x;
      pz = Number.isFinite(a.z) ? a.z : c.z;
      if (Math.hypot(px - c.x, pz - c.z) > reach + 1e-6) return;
      if (def.target === 'zone') {
        targets = this.list.filter((o) => o.state === 'active' && Math.hypot(o.x - px, o.z - pz) <= ZONES.zone);
        // mind spells only touch hostile minds
        if (def.kind === 'sleep' || def.kind === 'morale') targets = targets.filter((o) => o.side !== c.side);
      }
    }
    c.acted = true;
    s.castSpell(a.spell);
    /** @type {Beat} */
    const beat = { t: 'cast', who: c.id, spell: a.spell, x: px, z: pz, targets: targets.map((o) => o.id), success: true };
    out.push(beat);
    let success = true;
    if (def.cast === 'wil') {
      const hd = Math.max(1, ...targets.filter((o) => o.side !== c.side).map((o) => o.stats?.hd ?? o.sheet?.level ?? 1));
      const r = this._save(c, 'wil', castDc(hd), out, `cast:${a.spell}`);
      success = r.success;
      beat.success = success;
      beat.roll = r;
    }
    switch (def.kind) {
      case 'damage': {
        const n = spellDiceCount(def.dice.count, L);
        for (const t of targets) {
          let dmg = this.dice.roll({ count: n, sides: def.dice.sides, mod: def.dice.plusL ? L : 0 }).total;
          if (!success) dmg = Math.ceil(dmg / 2);
          this._damage(t, dmg, c, out, 'magic');
        }
        break;
      }
      case 'heal': {
        for (const t of targets) this._heal(t, this.dice.roll({ count: def.dice.count === 'HL' ? HL(L) : /** @type {number} */ (def.dice.count), sides: def.dice.sides, mod: def.dice.plusL ? L : 0 }).total, out, c);
        break;
      }
      case 'condition': {
        if (!success) break;
        const rounds = this._rounds(def.rounds, L);
        for (const t of targets) this._lay(t, def.condition, { rounds, amount: def.amount, source: c.id }, out);
        break;
      }
      case 'sleep': {
        if (!success) break;
        // the weakest first, up to [L] + 2 hit dice in all
        let budget = L + 2;
        for (const t of [...targets].sort((a1, b1) => (a1.stats?.hd ?? 1) - (b1.stats?.hd ?? 1))) {
          const hd = Math.max(1, t.stats?.hd ?? 1);
          if (hd > budget) continue;
          budget -= hd;
          this._lay(t, 'unconscious', { rounds: this._rounds(def.rounds, L), source: c.id }, out);
        }
        break;
      }
      case 'morale': {
        if (!success) break;
        for (const t of targets) if ((t.stats?.hd ?? 99) <= L) this._moraleRoll(t, out, 'dread');
        break;
      }
      case 'teleport': {
        const keepX = c.x, keepZ = c.z;
        const p = this.world.path(c, px, pz, reach, 0, this.list.filter((o) => o !== c && o.state === 'active'), true);
        if (p) { c.x = p.x; c.z = p.z; }
        out.push({ t: 'teleport', who: c.id, x: c.x, z: c.z, fromX: keepX, fromZ: keepZ });
        break;
      }
    }
  }

  /** @param {number|string|undefined} r @param {number} L */
  _rounds(r, L) {
    if (typeof r === 'number') return r;
    if (r === 'L+1') return L + 1;
    if (r === 'HL+1') return HL(L) + 1;
    if (typeof r === 'string') return this.dice.roll(r).total || 1;
    return 1;
  }

  /** @param {Combatant} c @param {Extract<Action, { type: 'draught' }>} a @param {Beat[]} out */
  _draught(c, a, out) {
    const owner = this.potionsOwner?.sheet;
    if (c.acted || !owner || owner.potions <= 0) return;
    const t = this.get(a.target ?? c.id) ?? c;
    if (t.side !== 'party' || t.state === 'dead') return;
    if (t !== c && !this.inReach(c, t) && !this._approach(c, t, out)) return;
    c.acted = true;
    owner.potions--;
    out.push({ t: 'draught', who: c.id, target: t.id, left: owner.potions });
    this._heal(t, this.dice.roll(DRAUGHT_HEAL, { extraMod: t.sheet?.level ?? 1 }).total, out, c);
  }

  /** @param {Combatant} c @param {Extract<Action, { type: 'talent' }>} a @param {Beat[]} out */
  _talent(c, a, out) {
    const s = c.sheet;
    if (!s || !s.has(a.talent)) return;
    const L = s.level;
    switch (a.talent) {
      case 'rage':
        if (c.freeUsed || this.has(c, 'raging') || s.usesLeft('rage') <= 0) return;
        c.freeUsed = true;
        s.spend('rage');
        out.push({ t: 'talent', who: c.id, id: 'rage' });
        this._lay(c, 'raging', { rounds: L + 2 }, out);
        // (a rage is immune to fear)
        if (c.conditions.delete('frightened')) out.push({ t: 'condition', who: c.id, id: 'frightened', on: false });
        break;
      case 'radiance':
        if (c.freeUsed || s.usesLeft('radiance') <= 0) return;
        c.freeUsed = true;
        s.spend('radiance');
        out.push({ t: 'talent', who: c.id, id: 'radiance' });
        for (const p of this.party().filter((p1) => this.dist(c, p1) <= ZONES.zone + 1).slice(0, HL(L) + 1)) this._lay(p, 'warded', { rounds: L + 1, amount: 2 }, out);
        break;
      case 'rush':
        if (c.freeUsed || !c.moved || c.acted || s.usesLeft('rush') <= 0) return;
        c.freeUsed = true;
        s.spend('rush');
        c.moved = false;
        out.push({ t: 'talent', who: c.id, id: 'rush' });
        this._lay(c, 'rushing', { rounds: 1 }, out);
        break;
      case 'inspire': {
        if (c.acted) return;
        const t = this.get(a.target ?? '');
        if (!t || t.side !== 'party' || t === c || t.state !== 'active' || this.dist(c, t) > rangeU(1)) return;
        c.acted = true;
        out.push({ t: 'talent', who: c.id, id: 'inspire', target: t.id });
        this._lay(t, 'inspired', { rounds: null }, out);
        break;
      }
    }
  }

  /** The party tries to slip away: one DEX save for all (GLAIVE's group save). @param {Combatant} c @param {Beat[]} out */
  _flee(c, out) {
    if (c.acted || !this.canFlee || !this.options().flee) return;
    c.acted = true;
    const r = this._save(c, 'dex', DC.normal, out, 'flee');
    if (r.success) this._end('fled', out);
  }

  // =============================================================================================
  // Morale (GLAIVE: first blood, half the group down, the leader down, a lone foe at half HP)
  // =============================================================================================

  /** @param {Combatant} t @param {Beat[]} out */
  _moraleOnDeath(t, out) {
    const foes = this.list.filter((c) => c.side === 'foe' && !c.summoned);
    const down = foes.filter((c) => c.state !== 'active').length;
    /** @type {string|null} */
    let why = null;
    if (!this._morale.blood) { this._morale.blood = true; why = 'blood'; }
    else if (!this._morale.half && down * 2 >= foes.length) { this._morale.half = true; why = 'half'; }
    if (t.stats?.elite && !this._morale.leader) { this._morale.leader = true; why = 'leader'; }
    if (!why) return;
    for (const c of this.foes()) this._moraleRoll(c, out, why);
  }

  /** @param {Combatant} t @param {Beat[]} out */
  _moraleOnHurt(t, out) {
    if (this._morale.solo || this.foes().length !== 1 || t.hp > t.hpMax / 2) return;
    this._morale.solo = true;
    this._moraleRoll(t, out, 'solo');
  }

  /** @param {Combatant} c @param {Beat[]} out @param {string} why */
  _moraleRoll(c, out, why) {
    if (c.state !== 'active' || !c.stats || c.stats.morale >= 12) return;
    const roll = this.dice.twoD6();
    const broke = breaksMorale(roll, c.stats.morale);
    out.push({ t: 'morale', who: c.id, roll, rating: c.stats.morale, broke, why });
    if (!broke) return;
    c.state = 'fled';
    c.conditions.clear();
    // it runs from the nearest of the party (the game walks it off, then it is gone)
    const near = this.party().sort((a, b) => this.dist(c, a) - this.dist(c, b))[0];
    const dx = near ? c.x - near.x : 0, dz = near ? c.z - near.z : 1;
    const l = Math.hypot(dx, dz) || 1;
    const p = this.world.path(c, c.x + (dx / l) * 8, c.z + (dz / l) * 8, 8, 0, []);
    if (p) { c.x = p.x; c.z = p.z; }
    out.push({ t: 'flee', who: c.id, points: p?.points ?? [c.x, c.z], fly: c.flier });
  }

  // =============================================================================================
  // The end
  // =============================================================================================

  /** @param {Beat[]} out @returns {boolean} over */
  _checkEnd(out) {
    if (this.over) return true;
    if (!this.foes().length) { this._end('victory', out); return true; }
    if (!this.party().length) { this._end('defeat', out); return true; }
    return false;
  }

  /**
   * @param {'victory'|'defeat'|'fled'} outcome
   * @param {Beat[]} out
   */
  _end(outcome, out) {
    if (this.over) return;
    this.over = true;
    this.current = null;
    let xp = 0;
    const killed = [], routed = [];
    for (const c of this.list) {
      if (c.side !== 'foe' || c.summoned) continue;
      if (c.state === 'dead') { killed.push(c.id); xp += c.stats?.xp ?? 0; }
      else if (c.state === 'fled') { routed.push(c.id); xp += Math.floor((c.stats?.xp ?? 0) / 2); }
    }
    // injuries: every PC who went Out of Action rolls on the injury table once the danger has passed
    const injuries = [];
    if (outcome !== 'defeat') {
      for (const c of this.list) {
        if (c.side !== 'party' || !c.everDown || c.state === 'dead') continue;
        const bonus = injuryBonus(c.lowestHp);
        const roll = this.dice.die(12);
        const result = injuryResult(roll + bonus);
        let hp = c.hp;
        if (c.state === 'down') {
          hp = result === 'dead' ? c.hp : this.dice.die(6);
          c.hp = hp;
          if (result !== 'dead') c.state = 'active';
        }
        injuries.push({ who: c.id, roll, bonus, result, hp });
        out.push({ t: 'injury', who: c.id, roll, bonus, result, hp });
      }
    }
    // the sheets keep the HP left
    for (const c of this.list) if (c.sheet) c.sheet.hp = Math.max(c.state === 'active' ? 1 : 0, Math.min(c.hpMax, c.hp));
    this.result = { outcome, xp: outcome === 'defeat' ? 0 : xp, killed, routed, injuries, rounds: this.round };
    out.push({ t: 'end', outcome, xp: this.result.xp });
  }

  // =============================================================================================
  // Choices: the foes' and the companions'
  // =============================================================================================

  /**
   * The current combatant's next action (a foe or a companion). Called repeatedly during one turn:
   * a move first, then the action, then 'end'.
   * @returns {Action}
   */
  decide() {
    const c = this.current;
    if (!c) return { type: 'end' };
    if (c.side === 'foe') return this._decideFoe(c);
    return this._decideAlly(c);
  }

  /** @param {Combatant} c @returns {Action} */
  _decideFoe(c) {
    const st = c.stats;
    if (!st || c.acted) return { type: 'end' };
    if (st.moves.includes('boss')) return this._decideBoss(c);
    const targets = this.party();
    if (!targets.length) return { type: 'end' };
    const nearest = [...targets].sort((a, b) => this.dist(c, a) - this.dist(c, b))[0];
    // the shaman: mend a hurt friend, hex the nearest, or bolt from range
    if (st.moves.includes('mend') && c.mendUses > 0) {
      const hurt = this.foes().filter((f) => f.hp < f.hpMax / 2 && this.dist(c, f) <= rangeU(1)).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0];
      if (hurt) return /** @type {any} */ ({ type: 'monster', move: 'mend', target: hurt.id });
    }
    if (st.moves.includes('hex') && c.hexReady) {
      const t = targets.filter((p) => this.dist(c, p) <= rangeU(2) && this.world.los(c.x, c.z, p.x, p.z) && !this.has(p, 'frightened'))
        .sort((a, b) => this.dist(c, a) - this.dist(c, b))[0];
      if (t) return /** @type {any} */ ({ type: 'monster', move: 'hex', target: t.id });
    }
    // skirmishers and casters: back away from a foe in reach, shoot from range
    if (st.moves.includes('skirmish') || st.moves.includes('hex')) {
      const ranged = st.attacks.find((a) => a.range > 0);
      const r = ranged ? rangeU(ranged.range) : 0;
      if (!c.moved && targets.some((p) => this.inReach(c, p))) {
        const away = this._awayPoint(c, ZONES.move);
        if (away) return { type: 'move', x: away.x, z: away.z };
      }
      const shoot = targets.filter((p) => this.dist(c, p) <= r && this.world.los(c.x, c.z, p.x, p.z)).sort((a, b) => a.hp - b.hp)[0];
      if (shoot) return /** @type {any} */ ({ type: 'monster', move: 'attack', target: shoot.id });
      if (!c.moved) return { type: 'move', x: nearest.x, z: nearest.z };
      return { type: 'end' };
    }
    // the bat: bite, then dart away
    if (st.moves.includes('flit') && this.inReach(c, nearest)) return /** @type {any} */ ({ type: 'monster', move: 'attack', target: nearest.id, flit: true });
    // the boar: a charge from up to two zones off, in a straight line
    if (st.moves.includes('charge') && !c.moved && !this.inReach(c, nearest)) {
      const d = this.dist(c, nearest);
      if (d <= ZONES.move * 2 && this.world.los(c.x, c.z, nearest.x, nearest.z)) return /** @type {any} */ ({ type: 'monster', move: 'charge', target: nearest.id });
    }
    // everyone else: close in and hit (the weakest in reach, else the nearest)
    const inReach = targets.filter((p) => this.inReach(c, p)).sort((a, b) => a.hp - b.hp)[0];
    if (inReach) return /** @type {any} */ ({ type: 'monster', move: 'attack', target: inReach.id });
    if (!c.moved) return /** @type {any} */ ({ type: 'monster', move: 'attack', target: nearest.id, approach: true });
    return { type: 'end' };
  }

  /**
   * A foe's own move (not in the party's action list). Called through `act` with
   * `{ type: 'monster', … }`.
   * @param {Combatant} c
   * @param {{ move: string, target?: string, approach?: boolean, flit?: boolean }} a
   * @param {Beat[]} out
   */
  _monsterMove(c, a, out) {
    const t = this.get(a.target ?? '');
    switch (a.move) {
      case 'attack': {
        if (!t || t.state !== 'active') { c.acted = true; return; }
        const atk = this._monsterAttack(c, t);
        if (atk && atk.range === 0 && !this.inReach(c, t)) {
          if (!a.approach || !this._approach(c, t, out)) { c.acted = !!c.moved; return; }
        }
        c.acted = true;
        for (let i = 0; i < Math.max(1, c.attacksLeft) && t.state === 'active' && c.state === 'active'; i++) this._strike(c, t, out);
        if (a.flit && c.state === 'active' && !c.moved) {
          const away = this._awayPoint(c, 3);
          if (away) this._move(c, away.x, away.z, false, out);
        }
        return;
      }
      case 'charge': {
        if (!t) { c.acted = true; return; }
        c.moved = true;
        this._move(c, t.x, t.z, true, out, this.reachOf(c, t) - 0.15, ZONES.move * 2);
        c.acted = true;
        if (c.state === 'active' && this.inReach(c, t)) {
          out.push({ t: 'charge', who: c.id, target: t.id });
          this._strike(c, t, out, { charge: true });
        }
        return;
      }
      case 'mend': {
        c.acted = true;
        c.mendUses--;
        if (!t) return;
        out.push({ t: 'monsterSpell', who: c.id, spell: 'mend', target: t.id });
        this._heal(t, this.dice.roll(MEND.dice, { extraMod: c.stats?.hd ?? 1 }).total, out, c);
        return;
      }
      case 'hex': {
        c.acted = true;
        c.hexReady = false;
        if (!t) return;
        out.push({ t: 'monsterSpell', who: c.id, spell: 'hex', target: t.id });
        const r = this._save(t, 'wil', HEX_DC, out, 'hex');
        if (!r.success) this._lay(t, 'frightened', { rounds: 2, source: c.id, save: 'wil', dc: HEX_DC }, out);
        return;
      }
    }
  }

  /** A point `len` u from c away from its nearest foes (null: no way out). @param {Combatant} c @param {number} len */
  _awayPoint(c, len) {
    let dx = 0, dz = 0;
    for (const p of this.enemiesOf(c)) {
      const d = Math.max(0.5, this.dist(c, p));
      dx += (c.x - p.x) / (d * d);
      dz += (c.z - p.z) / (d * d);
    }
    const l = Math.hypot(dx, dz);
    if (l < 1e-6) return null;
    return { x: c.x + (dx / l) * len, z: c.z + (dz / l) * len };
  }

  // ---- the boss: Cinderheart ----

  /** @param {Combatant} c @param {Beat[]} out */
  _bossPhaseStart(c, out) {
    if (c.poolIndex === 1) {
      out.push({ t: 'telegraph', who: c.id, key: 'roar' });
      this._summon(c, BOSS.bats, out);
    } else if (c.poolIndex === 2) {
      out.push({ t: 'telegraph', who: c.id, key: 'magma' });
    }
  }

  /** @param {Combatant} c @param {number} n @param {Beat[]} out */
  _summon(c, n, out) {
    const live = this.list.filter((o) => o.summoned && o.state === 'active').length;
    for (let i = 0; i < n && live + i < BOSS.summonCap; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2 + this.round;
      const init = this.world.summon?.('bat', c.x + Math.cos(a) * 3, c.z + Math.sin(a) * 3);
      if (!init) break;
      const b = this._add(init);
      b.summoned = true;
      b.initiative = c.initiative;
      // it acts from the next round on (inserted into the foes' block then)
      out.push({ t: 'summon', who: b.id, by: c.id, x: b.x, z: b.z });
    }
  }

  /** @param {Combatant} c @returns {Action} */
  _decideBoss(c) {
    if (c.acted) return { type: 'end' };
    return /** @type {any} */ ({ type: 'monster', move: 'boss' });
  }

  /**
   * The boss's turn: a furnace telegraphed one turn ahead (everyone in the marked disc saves DEX or
   * burns), a slam on whoever stands in reach (it lumbers toward the nearest otherwise), bats in
   * phase 2, magma pools and a kneel that bares its core in phase 3.
   * @param {Combatant} c
   * @param {Beat[]} out
   */
  _bossTurn(c, out) {
    c.acted = true;
    c.bossTurn++;
    const party = this.party();
    if (!party.length) return;
    // a telegraphed furnace goes off now
    if (c.telegraph) {
      const g = c.telegraph;
      c.telegraph = null;
      out.push({ t: 'furnace', who: c.id, x: g.x, z: g.z, r: g.r });
      for (const p of this.party()) {
        if (Math.hypot(p.x - g.x, p.z - g.z) > g.r + p.radius) continue;
        const r = this._save(p, 'dex', BOSS.furnaceDc, out, 'furnace');
        let dmg = this.dice.roll(BOSS.furnaceDice).total;
        if (r.success) dmg = p.sheet?.has('evasion') || p.sheet?.has('shieldMaster') && p.sheet.shield ? 0 : Math.ceil(dmg / 2);
        if (dmg > 0) this._damage(p, dmg, c, out, 'fire');
      }
      // phase 3: the effort brings it to its knees — its core lies bare until its next turn
      if (c.poolIndex >= 2) {
        out.push({ t: 'telegraph', who: c.id, key: 'kneel' });
        this._lay(c, 'exposed', { rounds: 1 }, out);
        return;
      }
    }
    // phase 2: keep its bats coming
    if (c.poolIndex >= 1 && this.list.filter((o) => o.summoned && o.state === 'active').length < BOSS.bats) this._summon(c, 1, out);
    // phase 3: magma wells up under the nearest of the party (it burns from the next round)
    if (c.poolIndex >= 2) {
      const t = party[(c.bossTurn + this.round) % party.length];
      const h = { id: ++this._hazardId, x: t.x, z: t.z, r: BOSS.magmaR, armed: false, rounds: 4 };
      this.hazards.push(h);
      out.push({ t: 'hazardMark', id: h.id, x: h.x, z: h.z, r: h.r });
    }
    // every few turns: mark the furnace on the largest knot of the party
    if (c.bossTurn % BOSS.furnaceEvery === 0) {
      let best = party[0], bn = -1;
      for (const p of party) {
        const n = party.filter((q) => Math.hypot(q.x - p.x, q.z - p.z) <= BOSS.furnaceR).length;
        if (n > bn) { bn = n; best = p; }
      }
      c.telegraph = { x: best.x, z: best.z, r: BOSS.furnaceR };
      out.push({ t: 'telegraph', who: c.id, key: 'furnace', x: best.x, z: best.z, r: BOSS.furnaceR });
      return;
    }
    // otherwise: lumber toward the nearest and slam whoever is in reach (its two fists: two
    // different foes when it can)
    const near = [...party].sort((a, b) => this.dist(c, a) - this.dist(c, b))[0];
    if (!this.inReach(c, near)) this._move(c, near.x, near.z, false, out, this.reachOf(c, near) - 0.2, ZONES.move * 0.6);
    for (let i = 0; i < (c.stats?.attacksPerTurn ?? 1) && c.state === 'active'; i++) {
      const inReach = this.party().filter((p) => this.inReach(c, p)).sort((a, b) => this.dist(c, a) - this.dist(c, b));
      if (!inReach.length) break;
      this._strike(c, inReach[i % inReach.length], out);
    }
  }

  /**
   * A companion's choice by its tactics rule (PartyRules): heal, fall back, defend, or fight its
   * chosen foe — its spells and talents as the rule allows.
   * @param {Combatant} c
   * @returns {Action}
   */
  _decideAlly(c) {
    const s = c.sheet;
    if (!s) return { type: 'end' };
    const rule = c.rule ?? { target: 'leader', distance: 'mid', attack: 'free', skills: 'free', heal: 'low', evade: 'on', retreat: 'low' };
    const party = this.party();
    const leader = this.get(this.leader);
    const foes = this.foes();
    const frac = c.hp / c.hpMax;
    // 0. step out of a telegraphed furnace or a marked magma pool
    if (!c.moved && rule.evade === 'on' && this._inDanger(c)) {
      const safe = this._safePoint(c);
      if (safe) return { type: 'move', x: safe.x, z: safe.z };
    }
    if (c.acted) return { type: 'end' };
    // 1. heal the most hurt friend below the rule's threshold (or a downed one)
    const healAt = HEAL_THRESHOLDS[rule.heal] ?? 0;
    if (healAt > 0 && s.spells.includes('mendingLight') && s.canCast('mendingLight')) {
      const hurt = this.list.filter((p) => p.side === 'party' && p.state !== 'dead' && p.state !== 'fled' && (p.state === 'down' || p.hp / p.hpMax < healAt))
        .sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0];
      if (hurt) {
        if (hurt === c || (this.dist(c, hurt) <= rangeU(1) && this.world.los(c.x, c.z, hurt.x, hurt.z))) return { type: 'spell', spell: 'mendingLight', target: hurt.id };
        if (!c.moved) return { type: 'move', x: hurt.x, z: hurt.z };
      }
    }
    // 2. fall back to the leader when hurt
    const retreatAt = RETREAT_THRESHOLDS[rule.retreat] ?? 0;
    if (frac < retreatAt && leader && leader !== c) {
      if (!c.moved && this.dist(c, leader) > 2.5) {
        const back = this._behind(leader);
        return { type: 'move', x: back.x, z: back.z };
      }
      return { type: 'maneuver', name: 'defend' };
    }
    if (rule.attack === 'never' || !foes.length) {
      if (!c.moved && leader && leader !== c && this.dist(c, leader) > 3) return { type: 'move', x: leader.x, z: leader.z };
      return { type: 'maneuver', name: 'defend' };
    }
    // 3. pick the foe by the rule
    const leash = LEASH[rule.distance] ?? 8;
    const near = leader && leader !== c ? foes.filter((f) => this.dist(f, leader) <= leash + ZONES.move) : foes;
    let pool = near.length ? near : foes;
    if (rule.attack === 'assist') {
      const fighting = pool.filter((f) => f.lastTarget && this.get(f.lastTarget)?.side === 'party' || f.id === this.leaderTarget);
      if (fighting.length) pool = fighting;
    }
    const target = this._pickTarget(c, pool, rule.target);
    if (!target) return { type: 'maneuver', name: 'defend' };
    // 4. skills: a free talent first (rage, radiance), then an offensive spell
    const skills = rule.skills !== 'never';
    if (skills && !c.freeUsed) {
      if (s.has('rage') && s.usesLeft('rage') > 0 && !this.has(c, 'raging') && this.dist(c, target) <= ZONES.move + 2) return { type: 'talent', talent: 'rage' };
      if (s.has('radiance') && s.usesLeft('radiance') > 0 && rule.skills === 'free' && party.filter((p) => this.dist(c, p) <= ZONES.zone + 1).length >= 2 && foes.length >= 2) return { type: 'talent', talent: 'radiance' };
    }
    if (skills && s.spells.includes('emberDart') && s.canCast('emberDart') && (rule.skills === 'free' || s.castsLeft > 1) && this.dist(c, target) <= rangeU(2) && this.world.los(c.x, c.z, target.x, target.z) && !target.stats?.moves.includes('passive')) {
      return { type: 'spell', spell: 'emberDart', target: target.id };
    }
    // 5. the weapon
    if (s.ranged) {
      if (this.canShoot(c, target)) {
        // a foe in the same zone: step back first (DISADV otherwise), unless Inhuman Accuracy
        if (!c.moved && !s.has('inhumanAccuracy') && foes.some((f) => this.dist(c, f) <= ZONES.zone)) {
          const away = this._awayPoint(c, ZONES.move);
          if (away) return { type: 'move', x: away.x, z: away.z };
        }
        return { type: 'attack', target: target.id };
      }
      if (!c.moved) return { type: 'move', x: target.x, z: target.z };
      return { type: 'end' };
    }
    if (this.inReach(c, target) || (!c.moved && this.dist(c, target) <= ZONES.move + this.reachOf(c, target))) {
      const smite = s.has('smite') && s.usesLeft('smite') > 0 && skills ? 'smite' : undefined;
      // a warrior with a shield bashes a dangerous foe; otherwise a plain attack
      return { type: 'attack', target: target.id, approach: true, option: smite };
    }
    if (!c.moved) return { type: 'move', x: target.x, z: target.z };
    return { type: 'maneuver', name: 'defend' };
  }

  /** @param {Combatant} c @param {Combatant[]} pool @param {string} how */
  _pickTarget(c, pool, how) {
    if (!pool.length) return null;
    const live = pool.filter((f) => !f.stats?.moves.includes('passive'));
    const list = live.length ? live : pool;
    const byDist = [...list].sort((a, b) => this.dist(c, a) - this.dist(c, b));
    switch (how) {
      case 'leader': return this.get(this.leaderTarget ?? '')?.state === 'active' ? this.get(this.leaderTarget) : byDist[0];
      case 'weakest': return [...list].sort((a, b) => a.hp - b.hp || this.dist(c, a) - this.dist(c, b))[0];
      case 'strongest': return [...list].sort((a, b) => (b.stats?.boss ? 1 : 0) - (a.stats?.boss ? 1 : 0) || (b.stats?.elite ? 1 : 0) - (a.stats?.elite ? 1 : 0) || b.hp - a.hp)[0];
      case 'ranged': return byDist.find((f) => f.stats?.moves.some((m) => m === 'skirmish' || m === 'hex')) ?? byDist[0];
      default: return byDist[0];
    }
  }

  /** @param {Combatant} c */
  _inDanger(c) {
    for (const f of this.foes()) if (f.telegraph && Math.hypot(c.x - f.telegraph.x, c.z - f.telegraph.z) <= f.telegraph.r + c.radius) return true;
    for (const h of this.hazards) if (Math.hypot(c.x - h.x, c.z - h.z) <= h.r + c.radius) return true;
    return false;
  }

  /** A nearby point out of every marked danger. @param {Combatant} c */
  _safePoint(c) {
    for (let ring = 1; ring <= 3; ring++) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const x = c.x + Math.cos(a) * ring * 1.8, z = c.z + Math.sin(a) * ring * 1.8;
        const probe = { ...c, x, z };
        if (!this._inDanger(/** @type {Combatant} */ (probe))) return { x, z };
      }
    }
    return null;
  }

  /** A spot behind the leader, away from the foes. @param {Combatant} leader */
  _behind(leader) {
    const away = this._awayPoint(leader, 1.8);
    return away ?? { x: leader.x, z: leader.z + 1.8 };
  }

  // =============================================================================================
  // Beat collection
  // =============================================================================================

  _open() {
    this._beats = [];
    return this._beats;
  }

  _close() {
    const b = this._beats;
    this._beats = [];
    return b;
  }

  /**
   * `act` with a foe's own move too (`decide` may return `{ type: 'monster', … }`).
   * @param {Action|{ type: 'monster', move: string, target?: string, approach?: boolean, flit?: boolean }} a
   */
  step(a) {
    if (a && a.type === 'monster') {
      const out = this._open();
      const c = this.current;
      if (!c || this.over) return this._close();
      if (/** @type {any} */ (a).move === 'boss') this._bossTurn(c, out);
      else this._monsterMove(c, /** @type {any} */ (a), out);
      // a foe's own move is always the last thing of its turn
      c.acted = true;
      if (!this.over && !this._checkEnd(out)) {
        this._finishTurn(c, out);
        this._nextTurn(out);
      }
      return this._close();
    }
    return this.act(/** @type {Action} */ (a));
  }
}

/**
 * The world an encounter asks for geometry (GlaiveCombat implements it on the level; the Node test
 * on a flat plane).
 * @typedef {object} EncounterWorld
 * @property {(c: Combatant, x: number, z: number, maxLen: number, stopDist: number, others: Combatant[], straight?: boolean) => { x: number, z: number, points: number[], len: number }|null} path
 * @property {(ax: number, az: number, bx: number, bz: number) => boolean} los
 * @property {(kind: string, x: number, z: number) => CombatantInit|null} [summon]
 */

/** @param {DamageRecord} d */
function sumDice(d) {
  let s = 0;
  for (const v of d.dice) s += v;
  return s;
}

/** The highest a dice expression rolls (dice only). @param {string} expr */
function parseMax(expr) {
  const m = /^(\d*)d(\d+)/.exec(expr);
  if (!m) return 0;
  return (m[1] === '' ? 1 : Number(m[1])) * Number(m[2]);
}
