import * as THREE from 'three';
import { Sprite3D, RNG, hashString, hash2, EventEmitter, clamp, UI } from '../../engine/index.js';
// the combat-only engine modules straight from their files (peaceful levels never load them)
import { FxQuads } from '../../engine/fx/FxQuads.js';
import { GroundMarkers } from '../../engine/fx/GroundMarkers.js';
import { createFxAtlas } from '../../engine/pixel/FxSprites.js';
import { createEnemySheet } from '../../engine/pixel/MonsterSprites.js';
import { CombatHUD } from '../../engine/ui/CombatHUD.js';
import { BossBar } from '../../engine/ui/BossBar.js';
import { WorldLabels } from '../../engine/ui/WorldLabels.js';
import { Announcer } from '../../engine/ui/Announcer.js';
import { DeathScreen } from '../../engine/ui/DeathScreen.js';
import { registerStrings, t, tn, sep } from '../../engine/i18n/I18n.js';
import { term, quietly } from '../../engine/i18n/ContentText.js';
import { enemyStartPoints } from '../../engine/level/ObjectCatalog.js';
import { hasStoryCondition } from '../../engine/level/Travel.js';
import { PARTY_PRESETS } from '../../engine/level/PartyRules.js';
import { CHARACTER_SPRITE_OPTS } from '../config.js';
import { ENEMY_DEFS } from '../combat/defs.js';
import { COMBAT_BINDINGS, COMBAT_PAD_BINDINGS, COMBAT_CONTROLS, COMBAT_PAD_CONTROLS, STICK_ZOOM } from '../combat/bindings.js';
import { Pickups } from '../combat/Pickups.js';
import { lootRng, splitCoins } from '../combat/Loot.js';
import { Waystones, Chests, placeName } from '../combat/Waystones.js';
import { BossArena } from '../combat/BossArena.js';
import { CombatFx } from '../combat/CombatFx.js';
import { CombatLook } from '../combat/Feel.js';
import { CombatMusic } from '../combat/CombatMusic.js';
import { Nav } from '../combat/Nav.js';
import COMBAT_STRINGS from '../combat/strings.js';
import GLAIVE_STRINGS from './strings.js';
import { Dice } from './dice.js';
import { Encounter } from './Encounter.js';
import { Sheet, BUILD_IDS } from './Sheet.js';
import { monsterStats } from './bestiary.js';
import { ZONES, rangeU, POTION_MAX, SHOP_WARES, shopWare, SILVER_LOSS, UPGRADES, XP_PER_SILVER, DRAUGHT_HEAL } from './rules.js';
import { SPELLS } from './spells.js';
import { ANCESTRY_IDS, talentChoices, TALENTS } from './talents.js';
import { Foe } from './Foe.js';
import { Stage, PcActor } from './Stage.js';
import { TurnHUD, CombatLog } from './TurnHUD.js';
import { makeHooks } from './hooks.js';
import { ResearchMode } from '../research/ResearchMode.js';
import { LedgerPanel } from '../research/LedgerPanel.js';

/**
 * @import { Game } from '../Game.js'
 * @import { LevelObject, LevelObjectOf } from '../../engine/level/types.js'
 * @import { PartyMember } from '../party/PartyMember.js'
 * @import { Combatant, CombatantInit, Action, Beat, EncounterWorld } from './Encounter.js'
 * @import { Checkpoint } from '../combat/Waystones.js'
 * @import { EnemyKind } from '../combat/defs.js'
 * @import { SfxName } from '../../engine/audio/AudioSystem.js'
 */

/**
 * GlaiveCombat — the turn-based GLAIVE combat of a combat level (docs/specs/GLAIVE.md §8). It
 * takes the place of the old real-time CombatSystem with the same outside surface (Game, the story,
 * campaigns, the party, the shop and the maps call the same members), so a level with `enemy`
 * objects still turns into a combat level and every peaceful level is untouched.
 *
 * Between fights the player walks freely: foes wander their home discs, chests and waystones work,
 * coins lie where foes fell. A foe that sees the player — or a foe the player strikes first with
 * the ambush key (J / left click / pad X) — starts a **fight**: the foes of its group and those
 * near it, and the party members near the player, become combatants of an `Encounter`, which runs
 * the GLAIVE rules turn by turn. The player chooses each of their turns from menus (the dialog
 * box's choices: Attack, Move, Maneuver, Spell, Draught, Talent, Flee, End turn), picks a foe or
 * a spot on the ground, and the `Stage` shows what happened. Companions act by their tactics rule,
 * foes by their kind. When the fight ends the party earns XP (and levels: a talent and an ability
 * to choose), the fallen roll on the injury table, coins drop; a lost fight is the death screen and
 * the last waystone.
 *
 * The player's GLAIVE character sheet (`sheet`) is made on the first combat level from a build and
 * an ancestry the player picks, and a campaign carries it on (`exportProgress`).
 */

/** The combat UI classes `ui.enableCombat` needs (imported here so peaceful levels never load them). */
const COMBAT_UI = Object.freeze({ CombatHUD, BossBar, WorldLabels, Announcer, DeathScreen });
/** Marker slots (turn ring, cursor, range, telegraphs, hazards, the arena barrier). */
const MARKER_SLOTS = 32;
/** @type {import("../../engine/fx/GroundMarkers.js").GroundMarkerSpec & Record<string, any>} GroundMarkers spec keys with their defaults */
const MARKER_DEFAULTS = {
  shape: 'circle', x: 0, y: 0.03, z: 0, r: 1, rInner: 0, dirX: 0, dirZ: 1, halfAngle: 60, len: 1, width: 1,
  w: 1, d: 1, progress: 0, style: 'enemy', alpha: 1, flash: 0,
};
const MARKER_KEYS = Object.keys(MARKER_DEFAULTS);
/** Height of a straight shot above the ground (sight lines). */
const SHOT_Y = 0.9;
/** The boss's pooled adds (bats). */
const ADDS_PER_BOSS = 4;
const ADD_LEVEL = 5;
/** A foe that lost the party (it fled) does not look for it again this long (s). */
const CALM_AFTER_FLEE = 8;
/** The ambush key reaches an unaware foe this close (u). */
const AMBUSH_REACH = 2.6;
/** The ground cursor's speed (u/s at full stick). */
const CURSOR_SPEED = 7;
/** Seconds of plain play before the character or level-up menu opens. */
const QUIET_S = 0.8;
/** Draughts a waystone rest leaves the player at least. */
const REST_DRAUGHTS = 2;
const _v = new THREE.Vector3();
const _vp = new THREE.Matrix4();
const _ray = new THREE.Raycaster();
const _ndc2 = new THREE.Vector2();
const _plane = new THREE.Plane();

// =================================================================================================
// The player's card and a companion's view (what the rest of the game reads)
// =================================================================================================

/**
 * The player as the rest of the game reads it (`combat.pc`: the story's gold, the shop, the
 * waystones, the pickups): the GLAIVE sheet behind the old names.
 */
class PlayerCard {
  /** @param {GlaiveCombat} sys */
  constructor(sys) {
    this.sys = sys;
    this.alive = true;
    this.deaths = 0;
  }

  get sheet() { return this.sys.sheet; }
  get gold() { return this.sheet.silver; }
  set gold(v) { this.sheet.silver = Math.max(0, Math.floor(v)); }
  get potions() { return this.sheet.potions; }
  set potions(v) { this.sheet.potions = Math.max(0, Math.min(POTION_MAX, Math.floor(v))); }
  get hp() { return this.sheet.hp; }
  set hp(v) { this.sheet.hp = Math.min(this.sheet.hpMax, Math.floor(v)); }
  get hpMax() { return this.sheet.hpMax; }
  get mp() { return this.sheet.castsLeft; }
  get mpMax() { return this.sheet.castsMax; }
  get level() { return this.sheet.level; }
  get xp() { return this.sheet.xp; }
  get xpNext() { return this.sheet.xpNext; }
  get potionMax() { return POTION_MAX; }
  /** The attack bonus (the shop's line). */
  get atk() { return this.sheet.attackBonus(); }
  /** The armour class (the shop's line). */
  get def() { return this.sheet.ac; }

  /** Full and up again (a rest, the story's `heal`). */
  refill() {
    this.sheet.longRest();
    this.alive = true;
  }

  /** @param {'maxHp'|'maxMp'|'attack'|'def'|'core'} what @param {number} [amount] */
  upgrade(what, amount) { this.sheet.applyUpgrade(what, amount); }

  /** @param {number} n @returns {number} HP gained */
  heal(n) {
    const before = this.sheet.hp;
    this.sheet.heal(n);
    return this.sheet.hp - before;
  }
}

/**
 * A party member in a combat level (`member.combat`, PARTY.md's AllyCombatView): its GLAIVE sheet
 * (its class's build at the player's level), whether a fight drives it, and its figure.
 */
class AllyView {
  /** @param {GlaiveCombat} sys @param {PartyMember} member */
  constructor(sys, member) {
    this.sys = sys;
    this.member = member;
    this.sheet = Sheet.forClass(member.record.cls, sys.sheet.level, member.name);
    /** A fight drives it (or it lies Out of Action). */
    this.active = false;
    /** Out of Action until a rest. */
    this.down = false;
    /** @type {PcActor|null} */
    this._actor = null;
  }

  get id() { return `ally:${this.member.id}`; }
  get hp() { return Math.max(0, this.sheet.hp); }
  get hpMax() { return this.sheet.hpMax; }
  get mp() { return this.sheet.castsLeft; }
  get mpMax() { return this.sheet.castsMax; }
  get level() { return this.sheet.level; }

  /** The figure the stage drives (null while the member has no sprite here). */
  get actor() {
    const s = this.member.sprite;
    if (!s) return null;
    if (!this._actor || this._actor.sprite !== s) this._actor = new PcActor(s, (x, z) => this.sys.groundAt(x, z));
    return this._actor;
  }

  refill() {
    this.sheet.longRest();
    this.down = false;
    this.active = false;
    this._actor?.up();
  }

  onTeleport() {}

  release() {
    this.active = false;
    this.member.sprite?.setFlash?.(0, 0, 0, 0);
  }

  /** Level with the player (talents and abilities in its class's order; full stays full). */
  syncLevel() {
    const L = this.sys.sheet.level;
    if (this.sheet.level === L) return;
    const full = this.sheet.hp >= this.sheet.hpMax;
    const spent = { ...this.sheet.spent };
    const old = this.sheet;
    this.sheet = Sheet.forClass(this.member.record.cls, L, this.member.name);
    this.sheet.spent = spent;
    this.sheet.hp = full ? this.sheet.hpMax : Math.min(this.sheet.hpMax, old.hp);
  }

  info() {
    return { id: this.member.id, hp: this.hp, hpMax: this.hpMax, level: this.level, down: this.down, active: this.active, ac: this.sheet.ac };
  }
}

// =================================================================================================

export class GlaiveCombat {
  /** @param {{ game: Game }} opts */
  constructor({ game }) {
    this.game = game;
    this.engine = game.engine;
    this.scene = game.engine.scene;
    this.tileMap = game.tileMap;
    this.level = game.level;
    this.world = game.world;
    this.player = game.player;
    this.rig = game.rig;
    this.ui = game.ui;
    this.audio = game.audio;
    this.particles = game.particles;
    this.spriteManager = game.spriteManager;
    this.postfx = game.postfx;
    this.input = game.engine.input;
    this.env = game.env ?? game.level.environment ?? {};

    /** Combat events: 'kill', 'fightStart', 'fightEnd', 'levelup', 'pickup', 'purchase', 'bossDefeated', 'attuned', 'chestFound', 'respawn'. */
    this.events = new EventEmitter();
    /** @type {Foe[]} level object order, then index; adds last */
    this.enemies = [];
    /** @type {Sprite3D[]} every foe sprite (the Game registers their shadows) */
    this.actorSprites = [];
    this.engaged = false;
    this.locksPlayer = false;
    this.bossDefeated = false;
    /** @type {{ x: number, z: number }[]} the minimap's red dots (foes in the fight) */
    this.minimapEnemies = [];
    this.tutorial = { combo: false, dodge: false, rewarded: false };
    /** @type {Set<string>} one-time shop wares bought */
    this.purchased = new Set();
    this.seedValue = hashString(this.level.name) >>> 0;
    this.rng = new RNG(this.seedValue);
    this.frame = 0;
    this.clock = 0;
    this.kills = 0;
    this.fights = 0;
    /** The player's GLAIVE sheet (a sellsword until a build is chosen). */
    this.sheet = Sheet.create('sellsword', 'human', '');
    /** A build was chosen (else the picker opens at the first quiet moment of play). */
    this.chosen = false;
    /**
     * The research overlay (`?research=<config>`, docs/design/RESEARCH_STATISTICS_RPG.md), or null.
     * @type {ResearchMode|null}
     */
    this.research = null;
    /** Seconds of plain play in a row (the menus open after QUIET_S). */
    this._quietFor = 0;
    this.pc = new PlayerCard(this);
    /** @type {AllyView[]} */
    this.allies = [];
    /** No foe ever damages the party (the `god` hook). */
    this.god = false;
    /** The player's turns are played by the companions' AI (the `auto` hook, tests). */
    this.autoPlayer = false;
    /** Foes never notice the player (the `freezeAI` hook: content tours). */
    this.freezeAI = false;
    /** @type {Encounter|null} the fight now */
    this.encounter = null;
    /** @type {Map<string, Foe|AllyView|'player'>} combatant id → its actor's owner */
    this._who = new Map();
    /** @type {{ t: number, fn: () => void }[]} */
    this._timers = [];
    this._device = null;
    this._padHinted = false;
    /** @type {{ keys: string, label: string, pad?: boolean }[]} */
    this.legendExtra = [];
    /** @type {Map<Foe, any>} foe → its level `enemy` object */
    this._groupOf = new Map();
    /** @type {Map<any, Foe[]>} level `enemy` object → its foes */
    this._members = new Map();
    /** @type {Map<Foe, Foe[]>} boss → its pooled adds */
    this._addsOf = new Map();
    /** @type {Set<any>} groups the story has taken away */
    this._absentGroups = new Set();
    /** @type {Foe|null} */
    this._boss = null;
    /** @type {Foe|null} the boss whose fight runs */
    this._bossFight = null;
    /** @type {{ x: number, z: number, kind: string, arena: BossArena }[]} */
    this._bossMarkers = [];
    this._awaiting = false;
    /** @type {((v?: any) => void)[]} resolvers waiting for the stage to go idle */
    this._idleWaiters = [];
    /** The ground cursor (picking a spot), or null. @type {null|{ x: number, z: number, cx: number, cz: number, max: number, radius: number, resolve: (p: {x:number,z:number}|null) => void, ring: number, dot: number, mouse: boolean, px: number, py: number }} */
    this._cursor = null;
    /** Picking a target among combatants, or null. @type {null|{ ids: string[], i: number, resolve: (id: string|null) => void, ring: number, why: string }} */
    this._picking = null;
    this._calmT = 0;
    this._deathGen = 0;
    this._respawning = false;
    this._levelQueue = 0;
    this._choosing = false;
    this._wasActive = false;
    this._ownPools = [];
    this.programsAtLoad = 0;
    this.navBuildMs = 0;
    /** @type {any[]} the sight test's collider scratch */
    this._losCs = [];
    /** @type {{ groundAt: (x: number, z: number) => number, move: (f: Foe, dx: number, dz: number) => void }|null} */
    this._moveCtx = null;
    this._mv = { x: 0, z: 0 };
    /** @type {{ kind: string, amount: number }[]} coin scratch */
    this._coins = Array.from({ length: 8 }, () => ({ kind: 'coin1', amount: 0 }));
    this._barsDirty = false;
    this._ready = false;
  }

  // =============================================================================================
  // The party
  // =============================================================================================

  /**
   * A party member is here (Party.join / attachLevel): its view, also set as `member.combat`.
   * @param {PartyMember} member
   * @returns {AllyView|null}
   */
  addAlly(member) {
    if (!member || !this._ready) return null;
    const have = this.allies.find((a) => a.member === member);
    if (have) { member.combat = have; return have; }
    const a = new AllyView(this, member);
    this.allies.push(a);
    member.combat = a;
    try {
      const tex = member.sprite?.sheet?.texture;
      if (tex) this.engine.renderer.initTexture(tex);
    } catch { /* not a texture */ }
    return a;
  }

  /** @param {PartyMember} member */
  removeAlly(member) {
    if (!member) return;
    const i = this.allies.findIndex((a) => a.member === member);
    if (i < 0) { if (member.combat && !this.allies.includes(/** @type {any} */ (member.combat))) member.combat = null; return; }
    const a = this.allies[i];
    this.allies.splice(i, 1);
    a.release();
    member.combat = null;
  }

  /** Every companion full and up (the story's `heal`, a rest). */
  healAllies() {
    for (const a of this.allies) a.refill();
    return this.allies.length;
  }

  /** The boss whose fight runs, or null. */
  get bossFight() { return this._bossFight; }

  /** A zone's radius (area spells, the stage's markers). */
  get zoneR() { return ZONES.zone; }

  /** The closed arena, or null. */
  sealedArena() {
    for (const a of this.arenas) if (a.active) return a;
    return null;
  }

  // =============================================================================================
  // Load
  // =============================================================================================

  async load() {
    const t0 = performance.now();
    const { scene, tileMap: tm, level } = this;
    const groups = level.objects.filter((o) => o.type === 'enemy');
    const kinds = new Set(groups.map((g) => g.kind));
    if (kinds.has('golem')) kinds.add('bat');
    /** @type {Map<string, any>} */
    this.sheets = new Map();
    for (const k of kinds) {
      try { this.sheets.set(k, createEnemySheet(/** @type {EnemyKind} */ (k))); } catch (err) { console.warn(`[glaive] no sheet for "${k}":`, err); }
    }
    this.atlas = createFxAtlas();
    this.atlasFrames = this.atlas.frames;
    this.quads = new FxQuads({ atlas: this.atlas, capacity: 192 });
    scene.add(this.quads.object);
    this.markers = new GroundMarkers({
      capacity: MARKER_SLOTS,
      heightField: { sample: (x, z) => tm.getHeight(x, z), minX: 0, minZ: 0, maxX: tm.width, maxZ: tm.depth },
    });
    scene.add(this.markers.object);
    this._mk = [];
    for (let i = 0; i < MARKER_SLOTS; i++) this._mk.push({ h: -1, gen: 0, spec: { ...MARKER_DEFAULTS } });
    this._markerSpec = { ...MARKER_DEFAULTS };
    this.fx = new CombatFx(this.quads, this.atlas);
    this.pickups = new Pickups(this);
    this.look = new CombatLook(this.postfx);
    this.music = new CombatMusic(this.audio, this.env);
    this._ndc = { x: 0, y: 0 };
    this._vpe = new Float32Array(16);
    this._cacheViewProjection();
    /** @type {{ h: number, x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, t: number, dur: number }[]} shots in flight (a quad each) */
    this._shots = [];

    // ---- strings, UI, bindings ----
    registerStrings('combat', COMBAT_STRINGS);
    registerStrings('glaive', GLAIVE_STRINGS);
    this._shownNames = new WeakMap();
    UI.useCombatUI(COMBAT_UI);
    this.ui.enableCombat();
    this.hud = new TurnHUD(this.ui.hud.element);
    this.log = new CombatLog((id) => this.nameOf(id), (text, kind) => this.hud.line(text, /** @type {any} */ (kind)), (id) => this.combatantOf(id)?.side ?? null);
    // (research mode: a studied foe's rolls show their total only — the bonus is not observable)
    this.log.hideRoll = (id) => { const o = this._who.get(id); return o instanceof Foe && !!o.studied; };
    this._savedBindings = this.input.saveBindings();
    this.input.addBindings(COMBAT_BINDINGS, COMBAT_PAD_BINDINGS);
    this.input.enableMouseButtons?.(this.engine.renderer.domElement);
    this.rig.stickZoom = STICK_ZOOM;

    // ---- zones (the level's regions) ----
    this.zones = level.objects.filter((o) => o.type === 'region' && ['minX', 'maxX', 'minZ', 'maxZ'].every((k) => Number.isFinite(o[k])))
      .map((o) => ({ id: o.id, minX: o.minX, maxX: o.maxX, minZ: o.minZ, maxZ: o.maxZ, minY: Number.isFinite(o.minY) ? o.minY : null }));

    // ---- the research overlay (before the foes: studied ones get their own stat blocks) ----
    this.research = await ResearchMode.fromPage({ now: () => this.game.lighting?.timeOfDay ?? 0, armor: () => this.sheet.armor });
    /** @type {LedgerPanel|null} the research overlay's field ledger (L) */
    this.ledger = this.research ? new LedgerPanel(this.ui.root, this.research, { onClose: () => { this.game.busy = false; } }) : null;
    // (research mode is English-first, decision D9)
    if (this.ledger) this.later(4, () => this.ui.hud.toast('Research mode: press L for the field ledger', 5));

    // ---- foes ----
    /** @type {BossArena[]} */
    this.arenas = [];
    for (const g of groups) this._spawnGroup(g);
    for (const boss of this.enemies.filter((e) => e.boss)) this._createAdds(boss);

    // ---- the walk grid (fights walk on it; the party's follow and the story use it too) ----
    const tn = performance.now();
    this.nav = new Nav(tm, { blocked: (x, z) => this._inArena(x, z) });
    this.navBuildMs = Math.round((performance.now() - tn) * 10) / 10;
    this.nav.warm();
    /** @type {Nav} a second grid with the arenas open (the fight inside an arena walks there) */
    this.arenaNav = this.arenas.length ? new Nav(tm, {}) : this.nav;

    // ---- checkpoints, chests ----
    this.waystones = new Waystones(this);
    this.chests = new Chests(this);
    this.waystones.bind(this.world.interactables);
    this.chests.bind(this.world.interactables);
    this._storyGroups = [...this._members.keys()].filter((g) => hasStoryCondition(g));
    this._storyChests = this.chests.list.filter((c) => hasStoryCondition(c.obj));
    this._storyStones = this.waystones.list.filter((w) => w.obj && hasStoryCondition(w.obj));
    this._emitters = this.arenas.map((a) => {
      const r = a.rect;
      return this.particles.createEmitter({
        preset: 'embers',
        bounds: { center: new THREE.Vector3(a.center.x, a.y + 1.6, a.center.z), size: new THREE.Vector3(r.maxX - r.minX, 3.2, r.maxZ - r.minZ) },
        count: 90, enabled: false,
      });
    });
    this.stage = new Stage(this);
    this.playerActor = new PcActor(this.player.sprite, (x, z) => this.groundAt(x, z));
    this.hooks = makeHooks(this);
    this.loadMs = Math.round(performance.now() - t0);
    this._ready = true;
  }

  /** @param {LevelObjectOf<'enemy'>} g */
  _spawnGroup(g) {
    const kind = /** @type {EnemyKind} */ (g.kind);
    const sheet = this.sheets.get(kind);
    const def = ENEMY_DEFS[kind];
    if (!sheet || !def) return;
    const stats = monsterStats(kind, g.level ?? 1, !!g.elite);
    const tm = this.tileMap;
    const walk = def.flier ? (x, z) => tm.isWalkable(x, z) || tm.getWaterSurface(x, z) !== null : (x, z) => this.standable(x, z);
    // (a research study may give a studied pack more foes: `groupCounts`)
    const count = this.research ? this.research.groupCount(g.id, Number(g.count) || 1) : null;
    const spots = enemyStartPoints(count !== null && count !== g.count ? { ...g, count } : g, walk);
    const arena = kind === 'golem' ? new BossArena(g, this) : null;
    if (arena) this.arenas.push(arena);
    spots.forEach(([x, z], index) => {
      const name = g.name || (g.elite ? `Elite ${def.name}` : def.name);
      const e = this._createFoe({ uid: `${g.id}#${index}`, group: g, index, kind, name, stats, def, sheet, home: { x, z }, arena, isAdd: false });
      this._applyResearch(e);
      if (e.boss) this._boss ??= e;
      // its zone: the region round its group's centre (it never sees the player outside it)
      const gx = Number(g.x), gz = Number(g.z);
      const zi = this.zoneAt(gx, gz, this.groundAt(gx, gz));
      if (zi >= 0) {
        const r = this.zones[zi];
        const R = e.homeRadius;
        e.zoneRect = { minX: Math.min(r.minX, gx - R), maxX: Math.max(r.maxX, gx + R), minZ: Math.min(r.minZ, gz - R), maxZ: Math.max(r.maxZ, gz + R) };
      }
    });
  }

  /**
   * A foe of a studied group takes its individual's stat block for the current expedition.
   * @param {Foe} e
   */
  _applyResearch(e) {
    const r = this.research;
    if (!r || e.isAdd || e.kind !== r.family) return;
    const ind = r.individualFor(e.groupId, e.index);
    if (!ind) return;
    e.setStats(ind.stats);
    e.studied = ind.info;
  }

  /** @param {{ uid: string, group: any, index: number, kind: string, name: string, stats: any, def: any, sheet: any, home: {x:number,z:number}, arena: any, isAdd: boolean }} init */
  _createFoe(init) {
    const sprite = new Sprite3D(init.sheet, { ...CHARACTER_SPRITE_OPTS, ...init.sheet.spriteOptions, combatFx: true });
    sprite.position.set(init.home.x, this.groundAt(init.home.x, init.home.z), init.home.z);
    const e = new Foe({
      ...init, sprite, groupId: init.group?.id ?? '', homeRadius: Math.max(0.5, Number(init.group?.radius) || 3),
      rng: new RNG((hashString(init.uid) ^ this.seedValue) >>> 0),
    });
    e.place(init.home.x, init.home.z, (x, z) => this.groundAt(x, z));
    this.scene.add(sprite);
    this.spriteManager.add(sprite);
    this.actorSprites.push(sprite);
    this.enemies.push(e);
    this._groupOf.set(e, init.group);
    if (!init.isAdd && init.group) {
      const list = this._members.get(init.group);
      if (list) list.push(e); else this._members.set(init.group, [e]);
    }
    return e;
  }

  /** @param {Foe} boss */
  _createAdds(boss) {
    const sheet = this.sheets.get('bat');
    if (!sheet) return;
    const def = ENEMY_DEFS.bat;
    const stats = monsterStats('bat', ADD_LEVEL);
    const c = boss.arena?.center ?? boss.home;
    const list = [];
    for (let i = 0; i < ADDS_PER_BOSS; i++) {
      const e = this._createFoe({ uid: `${boss.uid}:add#${i}`, group: this._groupOf.get(boss), index: i, kind: 'bat', name: def.name, stats, def, sheet, home: { x: c.x, z: c.z }, arena: null, isAdd: true });
      e.hide();
      e.alive = false;
      list.push(e);
    }
    this._addsOf.set(boss, list);
  }

  /** @param {{ minX: number, maxX: number, minZ: number, maxZ: number }|null} [rect] */
  rebuildNav(rect = null) {
    if (!this.nav) return;
    if (rect) this.nav.buildRect(rect.minX, rect.maxX, rect.minZ, rect.maxZ);
    else this.nav.build((x, z) => this._inArena(x, z));
    if (this.arenaNav !== this.nav) {
      if (rect) this.arenaNav.buildRect(rect.minX, rect.maxX, rect.minZ, rect.maxZ);
      else this.arenaNav.build(null);
    }
  }

  /** @param {number} x @param {number} z */
  _inArena(x, z) {
    for (const a of this.arenas) if (a.present && a.containsGrown(x, z, 0.5)) return true;
    return false;
  }

  // =============================================================================================
  // UI and maps
  // =============================================================================================

  setupUI() {
    const hud = this.ui.combat?.hud;
    this._device = null;
    this._syncDevice();
    hud?.configureSkills([{ id: 'draught', label: t('combat.skill.draught'), keys: 'Menu', padKeys: 'Menu', icon: 'draught' }]);
    hud?.setVitalLabels?.({ mp: t('glaive.vital.mp'), sp: t('glaive.vital.sp') });
    this._vitals = { hp: 0, hpMax: 0, mp: 0, mpMax: 0, sp: 0, spMax: 0, level: 1, xp: 0, xpNext: 1, winded: false };
    this._updateHud();
  }

  /** @param {{ markers: { x: number, z: number, kind: string }[], enemies?: any[] }} map */
  attachMaps(map) {
    this._map = map;
    map.enemies = this.minimapEnemies;
    for (let i = map.markers.length - 1; i >= 0; i--) if (map.markers[i].kind === 'chest') map.markers.splice(i, 1);
    this.chests.markers = map.markers;
    for (const c of this.chests.list) if (c.discovered) map.markers.push(c.marker);
    for (const a of this.arenas) {
      const m = { x: a.center.x, z: a.center.z, kind: 'boss', arena: a };
      Object.defineProperty(m, 'hidden', { get: () => !a.present, enumerable: true });
      this._bossMarkers.push(m);
      map.markers.push(m);
    }
  }

  /** @param {THREE.Vector3} far */
  warmup(far) {
    const r = this.engine.renderer;
    const init = (tex) => { try { if (tex) r.initTexture(tex); } catch { /* not a texture */ } };
    for (const s of this.sheets.values()) init(s.texture);
    init(this.player.sheet?.texture);
    for (const a of this.allies) init(a.member.sprite?.sheet?.texture);
    init(this.atlas.texture);
    init(this.markers.heightTexture);
    this._warmQuad = this.quads.alloc();
    if (this._warmQuad >= 0) this.quads.set(this._warmQuad, { x: far.x, y: far.y, z: far.z, frame: 'impact', index: 0, scale: 1, rot: 0, mode: 'billboard', dirX: 0, dirZ: 1, r: 1, g: 1, b: 1, a: 1 });
    this._warmMarker = this.markers.alloc();
    if (this._warmMarker >= 0) this.markers.set(this._warmMarker, { ...MARKER_DEFAULTS, x: far.x, y: far.y, z: far.z, progress: 0.5 });
    this.quads.object.frustumCulled = false;
    this.markers.object.frustumCulled = false;
    this.quads.update();
    this.markers.update();
    const before = new Set(this.particles.burstPools());
    for (const p of ['hitSpark', 'emberBurst', 'deathPoof', 'gooPoof', 'healGlow', 'magicBurst', 'sparkle', 'splash', 'footstep', 'victoryEmbers', 'victorySparkle', 'levelSparkle']) {
      this.particles.burst(p, far, 1);
    }
    this._ownPools = this.particles.burstPools().filter((p) => !before.has(p));
  }

  endWarmup() {
    if (this._warmQuad >= 0) this.quads.free(this._warmQuad);
    if (this._warmMarker >= 0) this.markers.free(this._warmMarker);
    this._warmQuad = -1;
    this._warmMarker = -1;
    this.quads.update();
    this.markers.update();
    this.programsAtLoad = this.engine.renderer.info.programs?.length ?? 0;
  }

  refreshLegend() {
    this._device = null;
    if (this._ready) this._syncDevice();
  }

  _syncDevice() {
    const dev = this.input.lastDevice === 'gamepad' ? 'gamepad' : 'keyboard';
    if (dev === this._device) return;
    this._device = dev;
    const extra = dev === 'gamepad' ? this.legendExtra.filter((l) => l.pad !== false) : this.legendExtra;
    const rows = (dev === 'gamepad' ? COMBAT_PAD_CONTROLS : COMBAT_CONTROLS).map((r) => ({ ...r, label: t(`combat.controls.${r.id}`) }));
    this.ui.hud.setControls([...rows, ...extra]);
    this.ui.combat?.hud.setDevice(dev);
    if (dev === 'gamepad' && !this._padHinted) {
      this._padHinted = true;
      this.ui.hud.toast(t('combat.padHint'), 6);
    }
  }

  // =============================================================================================
  // World helpers (the stage, the waystones, the pickups and the arena call these)
  // =============================================================================================

  /** @param {number} x @param {number} z */
  groundAt(x, z) { return this.tileMap.getHeight(x, z); }

  /** @param {number} x @param {number} z @param {number|null} [y] */
  zoneAt(x, z, y = null) {
    const zs = this.zones;
    if (!zs) return -1;
    for (let i = 0; i < zs.length; i++) {
      const r = zs[i];
      if (x >= r.minX && x < r.maxX && z >= r.minZ && z < r.maxZ && (r.minY == null || y == null || y > r.minY)) return i;
    }
    return -1;
  }

  /** Walkable and not open water. @param {number} x @param {number} z */
  standable(x, z) {
    const tm = this.tileMap;
    if (!tm.isWalkable(x, z)) return false;
    const tile = tm.tileAt(Math.floor(x), Math.floor(z));
    return !(tile && tile.water) || tm.getHeight(x, z) > (tile.waterSurface ?? -Infinity);
  }

  /** Straight-shot line of sight (ground and static colliders). @param {number} ax @param {number} az @param {number} bx @param {number} bz */
  los(ax, az, bx, bz) {
    const tm = this.tileMap;
    const ya = tm.getHeight(ax, az) + SHOT_Y;
    const yb = tm.getHeight(bx, bz) + SHOT_Y;
    const dx = bx - ax, dz = bz - az;
    const d = Math.hypot(dx, dz);
    if (d < 0.3) return true;
    const cs = tm.queryColliders(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), this._losCs);
    for (let s = 0.25; s < d - 0.2; s += 0.25) {
      const u = s / d;
      const x = ax + dx * u, z = az + dz * u, y = ya + (yb - ya) * u;
      if (tm.getHeight(x, z) > y - 0.1) return false;
      for (const c of cs) {
        if (c.dynamic) continue;
        if (c.type === 'circle') {
          const ex = x - c.x, ez = z - c.z;
          if (ex * ex + ez * ez < c.r * c.r) return false;
        } else if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return false;
      }
    }
    return true;
  }

  _cacheViewProjection() {
    const cam = this.engine.camera;
    _vp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this._vpe.set(_vp.elements);
  }

  /** @param {number} x @param {number} y @param {number} z @param {{x:number,y:number}} out */
  projectNdc(x, y, z, out) {
    const m = this._vpe;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w <= 1e-6) { out.x = out.y = 99; return false; }
    out.x = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    out.y = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    return Math.abs(out.x) <= 1 && Math.abs(out.y) <= 1;
  }

  /** @param {string} preset @param {number} x @param {number} y @param {number} z @param {number} count */
  burst(preset, x, y, z, count) {
    this.particles.burst(preset, _v.set(x, y, z), Math.max(0, Math.min(24, count | 0)));
  }

  /** @param {SfxName} name @param {number} x @param {number} z @param {{ volume?: number, pitch?: number }} [opts] */
  sfxAt(name, x, z, opts) {
    const p = this.player.position;
    const d = Math.hypot(x - p.x, z - p.z);
    const vol = d <= 6 ? 1 : Math.max(0, 1 - (d - 6) / 24);
    if (vol <= 0.01) return;
    this.projectNdc(x, p.y + 1, z, this._ndc);
    const pan = clamp(Number.isFinite(this._ndc.x) ? this._ndc.x : 0, -0.8, 0.8);
    const j = (hash2(Math.floor(x * 16), Math.floor(z * 16), this.frame) - 0.5) * 0.08;
    this.audio.playSfx(name, { volume: vol * (opts?.volume ?? 1), pitch: (opts?.pitch ?? 1) * (1 + j), pan });
  }

  /** @param {number} amp @param {number} dur */
  shake(amp, dur) { this.rig.shake(amp, dur); }

  /** @param {number} x @param {number} y @param {number} z @param {string} text @param {any} kind */
  number(x, y, z, text, kind) { this.ui.combat?.labels.number(x, y, z, text, kind); }

  /** @param {{x:number,y:number,z:number}} pos @param {number} oy */
  alert(pos, oy) { this.ui.combat?.labels.alert(pos, oy); }

  /** Run `fn` after `seconds` (real time while the level plays). @param {number} seconds @param {() => void} fn */
  later(seconds, fn) { this._timers.push({ t: seconds, fn }); }

  // ---- ground markers ----

  markerAllocCore() {
    let slot = -1;
    for (let i = 0; i < MARKER_SLOTS; i++) if (this._mk[i].h < 0) { slot = i; break; }
    if (slot < 0) return -1;
    const h = this.markers.alloc();
    if (h < 0) return -1;
    const m = this._mk[slot];
    m.h = h;
    m.gen = (m.gen + 1) & 0x3ffff;
    for (const k of MARKER_KEYS) m.spec[k] = MARKER_DEFAULTS[k];
    this.markers.set(h, m.spec);
    return m.gen * 64 + slot;
  }

  /** @param {number} id */
  _markerSlot(id) {
    if (!(id >= 0)) return null;
    const m = this._mk[id % 64];
    if (!m || m.h < 0 || m.gen !== Math.floor(id / 64)) return null;
    return m;
  }

  /** @param {number} id @param {Record<string, any>} spec */
  markerSetCore(id, spec) {
    const m = this._markerSlot(id);
    if (!m) return;
    for (const k of MARKER_KEYS) if (spec[k] !== undefined) m.spec[k] = spec[k];
    this.markers.set(m.h, m.spec);
  }

  /** @param {number} id */
  markerFreeCore(id) {
    const m = this._markerSlot(id);
    if (!m) return;
    this.markers.free(m.h);
    m.h = -1;
  }

  get markerCount() {
    let n = 0;
    for (const m of this._mk) if (m.h >= 0) n++;
    return n;
  }

  /** An arrow / bolt flying from a to b over `dur` s (a quad). @param {{x:number,y:number,z:number}} a @param {{x:number,y:number,z:number}} b @param {number} dur */
  shot(a, b, dur) {
    const h = this.quads.alloc();
    if (h < 0) return;
    this._shots.push({ h, x0: a.x, z0: a.z, y0: a.y + 1, x1: b.x, z1: b.z, y1: b.y + 0.9, t: 0, dur: Math.max(0.05, dur) });
  }

  /** @param {number} dt */
  _shotsStep(dt) {
    for (let i = this._shots.length - 1; i >= 0; i--) {
      const s = this._shots[i];
      s.t += dt;
      const u = Math.min(1, s.t / s.dur);
      const dx = s.x1 - s.x0, dz = s.z1 - s.z0;
      const l = Math.hypot(dx, dz) || 1;
      this.quads.set(s.h, {
        x: s.x0 + dx * u, y: s.y0 + (s.y1 - s.y0) * u + Math.sin(u * Math.PI) * 0.4, z: s.z0 + dz * u,
        frame: 'arrow', index: 0, scale: 1, rot: 0, mode: 'flat', dirX: dx / l, dirZ: dz / l, r: 1, g: 1, b: 1, a: 1,
      });
      if (u >= 1) { this.quads.free(s.h); this._shots.splice(i, 1); }
    }
  }

  // =============================================================================================
  // Names
  // =============================================================================================

  /** A foe's shown name (translated at display; an elite's or a named group's as a term). @param {Foe} e */
  displayName(e) {
    let n = this._shownNames.get(e);
    if (n !== undefined) return n;
    const key = `combat.enemy.${e.kind}`;
    const kindName = t(key);
    const base = kindName === key ? e.def.name : kindName;
    const g = e.isAdd ? null : this._groupOf.get(e);
    const own = g?.name ? String(g.name) : '';
    const shown = own ? quietly(() => term(own)) : '';
    const asKind = !!own && shown === own && own === e.def.name;
    if (own && !asKind) term(own);
    n = own ? (asKind ? base : shown) : e.elite ? t('combat.elite', { name: base }) : base;
    this._shownNames.set(e, n);
    return n;
  }

  /** A combatant's name as the log and the order strip show it. @param {string} id */
  nameOf(id) {
    const c = this.encounter?.get(id);
    return c?.name ?? id;
  }

  /** @param {string} id */
  combatantOf(id) { return this.encounter?.get(id) ?? null; }

  /** The figure of a combatant (the stage moves it). @param {string} id */
  actorOf(id) {
    const o = this._who.get(id);
    if (!o) return null;
    if (o === 'player') return this.playerActor;
    if (o instanceof Foe) return o;
    return o.actor;
  }

  /**
   * A sheet pose for a generic step: foes have windup / attack / hurt / dead; humanoids the
   * character combat poses.
   * @param {string} id
   * @param {'windup'|'attack'|'aim'|'release'|'hurt'|'cast'|'prone'} what
   */
  poseFor(id, what) {
    const o = this._who.get(id);
    if (o instanceof Foe) {
      if (o.kind === 'golem') return { windup: 'slamWind', attack: 'slam', aim: 'throw', release: 'throw', hurt: 'hurt', cast: 'roar', prone: 'hurt' }[what];
      return { windup: 'windup', attack: 'attack', aim: 'windup', release: 'attack', hurt: 'hurt', cast: 'windup', prone: 'hurt' }[what];
    }
    return { windup: 'wind', attack: 'slash', aim: 'aim', release: 'follow', hurt: 'hurt', cast: 'cast', prone: 'down' }[what];
  }

  // =============================================================================================
  // Frame
  // =============================================================================================

  /**
   * Before the player moves (Game.update): exploration or the running fight.
   * @param {number} dt
   * @param {boolean} active
   */
  update(dt, active) {
    if (!this._ready) return;
    this.frame++;
    this._wasActive = active;
    if (!active) return;
    // the field ledger (research mode): L opens it between fights; it holds the game while open
    if (this.ledger && !this.ledger.isOpen && this.input.actionPressed('ledger') && !this.encounter && !this.game.busy && !this.ui.dialog.isOpen) this.openLedger();
    this.clock += dt;
    this._cacheViewProjection();
    this._runTimers(dt);
    this._shotsStep(dt);
    this.fx.update(dt);
    for (const a of this.arenas) a.update(dt);
    const moveCtx = this._moveCtx ?? (this._moveCtx = {
      groundAt: (x, z) => this.groundAt(x, z),
      move: (f, dx, dz) => {
        const p = f.position;
        if (f.flier) { p.x += dx; p.z += dz; return; }
        const out = this.tileMap.move(p, dx, dz, f.def.moveRadius ?? 0.3, 0.55, this._mv);
        if (!this._inArena(out.x, out.z) || f.boss) { p.x = out.x; p.z = out.z; }
      },
    });
    const exploring = !this.encounter;
    for (const e of this.enemies) e.update(dt, moveCtx, exploring);
    if (this.encounter) {
      this.playerActor.update(dt);
      for (const a of this.allies) a.actor?.update(dt);
      this._fightStep(dt);
    } else {
      this._explore(dt);
    }
  }

  /** @param {number} dt @param {boolean} active */
  afterPlayer(dt, active) {
    if (!this._ready) return;
    const playing = this.game.mode === 'play';
    if (active) {
      if (!this.encounter) {
        this.pickups.update(dt);
        this.waystones.update(dt);
        this.chests.update(dt);
      }
      this._syncDevice();
      this.stage.followTurn();
    }
    for (const s of this.actorSprites) s.speed = !playing ? 1 : active ? 1 : 0;
    this.music.update(dt, this.engaged, !!this._bossFight);
    this._updateHud();
    this._updateLabels();
    this._updateMinimap();
    this.quads.update();
    this.markers.update();
    // the menus wait for a moment of quiet (a story event queued just after the load goes first)
    this._quietFor = playing && active && this._quiet() ? this._quietFor + dt : 0;
    const calm = this._quietFor >= QUIET_S;
    if (calm && !this.chosen && !this._choosing) this._chooseBuild();
    if (calm && this._levelQueue === 0 && this.sheet.pendingLevels > 0 && !this.encounter && !this._choosing) this._levelUps();
  }

  /**
   * The game is in plain play: no dialog, no cutscene, no travel, no menu — and the story has
   * nothing running or queued (its scenes come first; the character and level menus wait).
   */
  _quiet() {
    const g = this.game;
    const story = g.story;
    if (story && (story.run || story.queue?.length)) return false;
    return g.mode === 'play' && !g.busy && !this.ui.dialog.isOpen && !this.ui.cutscene && !g.campaign?.traveling && !g.mapOpen && !g.photoMode && !g.journalOpen && !g.partyMenuOpen && !this._respawning;
  }

  /** @param {number} dt */
  applyLook(dt) {
    if (!this._ready) return;
    const low = this.sheet.hp > 0 && this.sheet.hp < this.sheet.hpMax * 0.25;
    this.look.apply(this._wasActive ? dt : 0, this.engaged, low);
  }

  /** @param {number} dt */
  _runTimers(dt) {
    for (let i = this._timers.length - 1; i >= 0; i--) {
      const tm = this._timers[i];
      tm.t -= dt;
      if (tm.t <= 0) { this._timers.splice(i, 1); tm.fn(); }
    }
  }

  // =============================================================================================
  // Exploration: foes see the player, the ambush key, the boss's arena
  // =============================================================================================

  /** @param {number} dt */
  _explore(dt) {
    if (this._calmT > 0) this._calmT -= dt;
    if (this.locksPlayer || this._respawning || !this.pc.alive) return;
    const p = this.player.position;
    // the boss's arena: walking in wakes it
    for (const a of this.arenas) {
      const boss = this.enemies.find((e) => e.boss && e.arena === a && !e.gone);
      if (!boss || !a.present || this.bossDefeated) continue;
      if (a.contains(p.x, p.z) && !this.freezeAI) { this._startBoss(boss); return; }
    }
    // the ambush: strike an unaware foe within reach first (its group is surprised)
    if (this.input.consumeAction?.('attack') || this.input.actionPressed?.('attack')) {
      let best = null, bd = AMBUSH_REACH;
      for (const e of this.enemies) {
        if (e.gone || e.boss || e.isAdd) continue;
        const d = Math.hypot(e.position.x - p.x, e.position.z - p.z);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        if (best.passive) this._strikeDummy(best);
        else { this.startFight(best, best.aggro ? null : 'party'); return; }
      }
    }
    if (this._calmT > 0 || this.freezeAI) return;
    const los = (ax, az, bx, bz) => this.los(ax, az, bx, bz);
    for (const e of this.enemies) {
      if (e.gone) continue;
      if (e.sees(dt, p, los)) {
        this.alert(e.position, e.labelY);
        this.sfxAt('enemyAlert', e.position.x, e.position.z, { volume: 0.8 });
        this.startFight(e, 'foes');
        return;
      }
    }
  }

  /** The training dummy: a swing and a roll, no fight. @param {Foe} e */
  _strikeDummy(e) {
    const d = new Dice((this.seedValue ^ (this.frame * 2654435761)) >>> 0);
    const s = this.sheet;
    const r = d.d20(s.attackBonus(), e.stats.ac, 'normal', s.has('hackSlash') ? 18 : 20);
    const p = this.player.position;
    this.playerActor.face(e.position.x, e.position.z);
    e.flash();
    const dmg = r.success ? d.roll(s.damageDice, { extraMod: s.damageBonus, mode: r.crit ? 'adv' : 'normal' }).total : 0;
    this.number(e.position.x, e.position.y + e.labelY, e.position.z, r.success ? String(dmg) : t('glaive.word.miss'), r.success ? (r.crit ? 'crit' : 'dmg') : 'mp');
    this.sfxAt(r.success ? 'hit' : 'swing', p.x, p.z);
    this.ui.hud.toast(t('glaive.dummy', { roll: `${r.natural}${r.mod >= 0 ? '+' : ''}${r.mod}=${r.total}`, ac: r.target }), 2.2);
    this.tutorial.combo = true;
    this.tutorial.dodge = true;
  }

  // =============================================================================================
  // Fights
  // =============================================================================================

  /**
   * Start a fight with `trigger`'s group and the foes near it.
   * @param {Foe} trigger
   * @param {'party'|'foes'|null} ambush
   * @param {{ boss?: boolean }} [opts]
   */
  startFight(trigger, ambush, { boss = false } = {}) {
    if (this.encounter || !trigger || trigger.gone) return false;
    // the foes: the trigger's group, then every foe within a zone of one already in (same region)
    const zone = trigger.zoneRect;
    /** @type {Set<Foe>} */
    const set = new Set();
    const add = (e) => { if (!e.gone && !e.passive && !e.isAdd && !set.has(e)) set.add(e); };
    if (boss) add(trigger);
    else {
      for (const e of this._members.get(this._groupOf.get(trigger)) ?? [trigger]) add(e);
      // another group joins whole when one of its foes stands within a zone of the fight and sees it
      const joined = new Set([this._groupOf.get(trigger)]);
      for (let grew = true; grew;) {
        grew = false;
        for (const e of this.enemies) {
          const g = this._groupOf.get(e);
          if (set.has(e) || joined.has(g) || e.gone || e.passive || e.boss || e.isAdd) continue;
          if (zone && e.zoneRect && e.zoneRect !== zone && (e.zoneRect.minX !== zone.minX || e.zoneRect.minZ !== zone.minZ)) continue;
          for (const f of set) {
            const near = Math.hypot(e.position.x - f.position.x, e.position.z - f.position.z) <= ZONES.join;
            if (near && this.los(e.position.x, e.position.z, f.position.x, f.position.z)) {
              joined.add(g);
              for (const m of this._members.get(g) ?? [e]) add(m);
              grew = true;
              break;
            }
          }
        }
      }
    }
    const foes = [...set];
    if (!foes.length) return false;
    this.fights++;
    this._who.clear();
    /** @type {CombatantInit[]} */
    const list = [];
    const p = this.player.position;
    this.sheet.name = this.sheet.name || t('glaive.player');
    list.push({ id: 'player', side: 'party', name: t('glaive.player'), kind: 'player', sheet: this.sheet, x: p.x, z: p.z, controller: this.autoPlayer ? 'ai' : 'player', rule: PARTY_PRESETS.aggressive.rule });
    this._who.set('player', 'player');
    for (const a of this.allies) {
      const m = a.member;
      if (!m.sprite || a.down) continue;
      const q = m.position;
      if (Math.hypot(q.x - p.x, q.z - p.z) > ZONES.partyJoin && !boss) continue;
      a.syncLevel();
      a.active = true;
      list.push({ id: a.id, side: 'party', name: term(m.name), kind: 'member', sheet: a.sheet, x: q.x, z: q.z, controller: 'ai', rule: m.record.rule });
      this._who.set(a.id, a);
    }
    for (const e of foes) {
      e.aggro = true;
      e.inFight = true;
      e.stopWalk();
      e.pose(null);
      list.push({ id: e.uid, side: 'foe', name: this.displayName(e), kind: e.kind, stats: e.stats, x: e.position.x, z: e.position.z, radius: e.radius, flier: e.flier, hp: e.hp });
      this._who.set(e.uid, e);
    }
    const dice = new Dice((this.seedValue ^ Math.imul(this.fights, 0x9E3779B1)) >>> 0);
    this.encounter = new Encounter({ dice, world: this._world(boss), combatants: list, ambush, canFlee: !boss, leader: 'player' });
    this.research?.fightStart(foes.map((e) => ({ id: e.uid, studied: e.studied })));
    this.engaged = true;
    this.locksPlayer = true;
    this.player.action = 'fight';
    this.player.sprite.play('idle');
    this.game.toggleMap?.(false);
    this.hud.show(true);
    this.ui.hud.toast(t(ambush === 'party' ? 'glaive.start.ambush' : ambush === 'foes' ? 'glaive.start.caught' : 'glaive.start.fight'), 2.4);
    this.events.emit('fightStart', foes.map((e) => e.uid));
    const beats = this.encounter.start();
    this.hud.set(this._orderEntries(), null);
    this._play(beats);
    return true;
  }

  /** The boss's arena closes and its fight begins. @param {Foe} boss */
  _startBoss(boss) {
    const a = boss.arena;
    a?.close();
    this._bossFight = boss;
    // the companions near enough are inside with the player
    const p = this.player.position;
    for (const al of this.allies) {
      const m = al.member;
      if (!m.sprite || al.down) continue;
      if (Math.hypot(m.position.x - p.x, m.position.z - p.z) > ZONES.partyJoin) continue;
      if (a && !a.contains(m.position.x, m.position.z)) {
        const ang = this.allies.indexOf(al) * 2.1;
        const x = clamp(p.x + Math.cos(ang) * 1.5, a.rect.minX + 0.6, a.rect.maxX - 0.6);
        const z = clamp(p.z + Math.sin(ang) * 1.5, a.rect.minZ + 0.6, a.rect.maxZ - 0.6);
        m.placeAt?.(x, z);
      }
    }
    this.ui.combat?.boss.show({ name: this.displayName(boss), epithet: t('combat.epithet.golem'), phases: boss.stats.pools?.length ?? 1 });
    this.ui.banner?.show(this.displayName(boss).toUpperCase?.() ?? this.displayName(boss), t('combat.epithet.golem'), { duration: 2.6 });
    this.sfxAt('bossRoar', boss.position.x, boss.position.z, { volume: 1 });
    this.shake(0.3, 0.6);
    this.startFight(boss, null, { boss: true });
  }

  /**
   * The geometry the encounter asks for, on the level: paths on the walk grid (the arena's open
   * grid in the boss fight), straight lines for fliers, sight lines, and the boss's pooled bats.
   * @param {boolean} boss
   * @returns {EncounterWorld}
   */
  _world(boss) {
    const nav = boss ? this.arenaNav : this.nav;
    const buf = new Float32Array(48);
    const arena = boss ? this._bossFight?.arena ?? null : null;
    return {
      path: (c, x, z, maxLen, stopDist, others, straight = false) => {
        let pts;
        if (c.flier || straight) pts = [c.x, c.z, x, z];
        else {
          const n = nav.findPath(c.x, c.z, x, z, Math.max(24, maxLen * 4), buf);
          if (n < 1) return null;
          pts = [c.x, c.z];
          for (let i = 0; i < n; i++) pts.push(buf[i * 2], buf[i * 2 + 1]);
        }
        const out = trimPath(pts, maxLen, stopDist, x, z);
        // keep off other bodies at the end
        for (let k = 0; k < 10 && out.points.length >= 4; k++) {
          const ex = out.x, ez = out.z;
          const hit = others.some((o) => Math.hypot(o.x - ex, o.z - ez) < (o.radius ?? 0.3) + (c.radius ?? 0.3) + 0.05);
          const bad = (!c.flier && !this.standable(ex, ez)) || (arena && !arena.contains(ex, ez));
          if (!hit && !bad) break;
          shortenPath(out, 0.35);
        }
        if (arena && !arena.contains(out.x, out.z)) return null;
        return out;
      },
      los: (ax, az, bx, bz) => this.los(ax, az, bx, bz),
      summon: (kind, x, z) => {
        const boss0 = this._bossFight;
        const pool = boss0 ? this._addsOf.get(boss0) ?? [] : [];
        const e = pool.find((b) => b.hidden);
        if (!e) return null;
        const a = boss0?.arena;
        const sx = a ? clamp(x, a.rect.minX + 0.8, a.rect.maxX - 0.8) : x;
        const sz = a ? clamp(z, a.rect.minZ + 0.8, a.rect.maxZ - 0.8) : z;
        e.appear(sx, sz, (qx, qz) => this.groundAt(qx, qz));
        e.inFight = true;
        e.aggro = true;
        this._who.set(e.uid, e);
        return { id: e.uid, side: 'foe', name: this.displayName(e), kind, stats: e.stats, x: sx, z: sz, radius: e.radius, flier: true };
      },
    };
  }

  /** The order strip's entries. */
  _orderEntries() {
    const enc = this.encounter;
    if (!enc) return [];
    const seen = new Set();
    const out = [];
    for (const id of enc.order.length ? enc.order : enc.list.map((c) => c.id)) {
      const c = enc.get(id);
      if (!c || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, name: c.name, foe: c.side === 'foe', down: c.state !== 'active' });
    }
    return out;
  }

  /** @param {number} dt */
  _fightStep(dt) {
    const enc = this.encounter;
    this.stage.update(dt);
    if (this._cursor) this._cursorStep(dt);
    if (this._picking) this._pickStep();
    if (this.stage.busy) return;
    if (this._idleWaiters.length) {
      const w = this._idleWaiters.splice(0);
      for (const fn of w) fn();
      return;
    }
    if (this._awaiting || !enc) return;
    if (enc.over) { this._endFight(); return; }
    if (enc.needsInput) {
      this._awaiting = true;
      this._playerTurn().catch((err) => console.error('[glaive] turn failed:', err)).finally(() => { this._awaiting = false; });
      return;
    }
    this._play(enc.step(enc.decide()));
    this.hud.set(this._orderEntries(), null);
  }

  /**
   * Beats to the stage (and to the research recorder first: it records what the stage will show).
   * @param {Beat[]} beats
   */
  _play(beats) {
    this.research?.beats(beats);
    this.stage.play(beats);
  }

  /**
   * Open the field ledger (research mode): the game holds while it is open.
   * @param {import('../research/LedgerPanel.js').Tab} [tab]
   */
  openLedger(tab) {
    if (!this.ledger || this.ledger.isOpen) return false;
    this.game.busy = true;
    this.ledger.open(tab);
    return true;
  }

  /** A promise that resolves once the stage has played everything queued. */
  _idle() {
    return new Promise((resolve) => { this._idleWaiters.push(resolve); });
  }

  // ---- the player's turn ----

  /**
   * The menu of the player's turn, until the turn is over: top level, then a target, a spot or a
   * spell as the action needs.
   */
  async _playerTurn() {
    const enc = this.encounter;
    const me = enc?.current;
    if (!enc || !me) return;
    for (let guard = 0; guard < 40 && this.encounter === enc && enc.current === me && enc.needsInput; guard++) {
      const action = await this._chooseAction(enc, me);
      if (this.encounter !== enc || enc.over) return;
      if (!action) continue;
      this._play(enc.act(action));
      this.hud.set(this._orderEntries(), null);
      await this._idle();
    }
  }

  /**
   * One choice of the player: an Action, or null (backed out).
   * @param {Encounter} enc
   * @param {Combatant} me
   * @returns {Promise<Action|null>}
   */
  async _chooseAction(enc, me) {
    const o = enc.options();
    const s = me.sheet;
    /** @type {{ id: string, label: string }[]} */
    const items = [];
    const targets = [...o.attack, ...o.approach, ...o.shoot];
    if (targets.length) items.push({ id: 'attack', label: t(s.ranged ? 'glaive.menu.shoot' : 'glaive.menu.attack') });
    if (o.move) items.push({ id: 'move', label: t('glaive.menu.move') });
    if (o.maneuvers.length > (o.maneuvers.includes('defend') ? 1 : 0) || o.maneuvers.includes('defend')) items.push({ id: 'maneuver', label: t('glaive.menu.maneuver') });
    if (o.spells.some((x) => x.ok)) items.push({ id: 'spell', label: t('glaive.menu.spell', { n: s.castsLeft }) });
    if (o.talents.length) items.push({ id: 'talent', label: t('glaive.menu.talent') });
    if (o.draught) items.push({ id: 'draught', label: t('glaive.menu.draught', { n: enc.potionsOwner?.sheet.potions ?? 0 }) });
    if (o.action && !o.move) { /* (the move is spent) */ }
    if (o.action) items.push({ id: 'dash', label: t('glaive.menu.dash') });
    if (o.flee) items.push({ id: 'flee', label: t('glaive.menu.flee') });
    items.push({ id: 'end', label: t('glaive.menu.end') });
    const status = [
      t('glaive.menu.status', { hp: Math.max(0, me.hp), hpMax: me.hpMax, ac: enc.acOf(me), round: enc.round }),
      !o.move ? t('glaive.menu.moved') : '', !o.action ? t('glaive.menu.acted') : '',
    ].filter(Boolean).join(sep());
    const pick = await this._menu(status, items.map((i) => i.label));
    const id = items[pick ?? items.length - 1]?.id ?? 'end';
    switch (id) {
      case 'attack': {
        const target = await this._pickTarget(targets, 'attack');
        if (!target) return null;
        let option;
        if (s.has('smite') && s.usesLeft('smite') > 0 && !s.ranged) {
          const c = await this._menu(t('glaive.menu.smiteQ', { n: s.usesLeft('smite') }), [t('glaive.menu.strike'), t('glaive.talent.smite.name'), t('glaive.menu.back')]);
          if (c === 2 || c === undefined) return null;
          if (c === 1) option = 'smite';
        }
        return { type: 'attack', target, approach: true, option };
      }
      case 'move': {
        const pt = await this._pickPoint(me, ZONES.move);
        return pt ? { type: 'move', x: pt.x, z: pt.z } : null;
      }
      case 'dash': {
        const pt = await this._pickPoint(me, ZONES.move);
        return pt ? { type: 'dash', x: pt.x, z: pt.z } : null;
      }
      case 'maneuver': {
        const names = o.maneuvers;
        const c = await this._menu(t('glaive.menu.maneuverQ'), [...names.map((n) => `${t(`glaive.maneuver.${n}`)} — ${t(`glaive.maneuver.${n}.hint`)}`), t('glaive.menu.back')]);
        if (c === undefined || c >= names.length) return null;
        const name = /** @type {any} */ (names[c]);
        if (name === 'defend') return { type: 'maneuver', name };
        const target = await this._pickTarget([...o.attack, ...o.approach], 'maneuver');
        return target ? { type: 'maneuver', name, target, approach: true } : null;
      }
      case 'spell': {
        const books = o.spells.filter((x) => x.ok).map((x) => x.id);
        const c = await this._menu(t('glaive.menu.spellQ'), [...books.map((b) => `${t(`glaive.spell.${b}.name`)} — ${t(`glaive.spell.${b}.text`)}`), t('glaive.menu.back')]);
        if (c === undefined || c >= books.length) return null;
        const spell = books[c];
        const def = SPELLS[spell];
        const reach = def.range > 0 ? rangeU(def.range) : ZONES.reach + 0.6;
        if (def.target === 'foe') {
          const ids = enc.foes().filter((f) => enc.dist(me, f) <= reach && this.los(me.x, me.z, f.x, f.z)).map((f) => f.id);
          if (!ids.length) { this.ui.hud.toast(t('glaive.menu.noTarget'), 2); return null; }
          const target = await this._pickTarget(ids, 'spell');
          return target ? { type: 'spell', spell, target } : null;
        }
        if (def.target === 'ally') {
          const ids = enc.list.filter((p) => p.side === 'party' && p.state !== 'dead' && p.state !== 'fled' && (p === me || enc.dist(me, p) <= reach)).map((p) => p.id);
          const target = await this._pickTarget(ids, 'ally');
          return target ? { type: 'spell', spell, target } : null;
        }
        if (def.target === 'self') return { type: 'spell', spell, target: me.id };
        const pt = await this._pickPoint(me, reach, def.target === 'zone' ? ZONES.zone : 0);
        return pt ? { type: 'spell', spell, x: pt.x, z: pt.z } : null;
      }
      case 'talent': {
        const list = o.talents;
        const c = await this._menu(t('glaive.menu.talentQ'), [...list.map((n) => `${t(`glaive.talent.${n}.name`)} — ${t(`glaive.talent.${n}.text`)}`), t('glaive.menu.back')]);
        if (c === undefined || c >= list.length) return null;
        const talent = /** @type {any} */ (list[c]);
        if (talent === 'inspire') {
          const ids = enc.party().filter((p) => p !== me && enc.dist(me, p) <= rangeU(1)).map((p) => p.id);
          const target = await this._pickTarget(ids, 'ally');
          return target ? { type: 'talent', talent, target } : null;
        }
        return { type: 'talent', talent };
      }
      case 'draught': {
        const ids = enc.list.filter((p) => p.side === 'party' && p.state !== 'dead' && p.state !== 'fled' && (p === me || enc.dist(me, p) <= ZONES.move + ZONES.reach)).map((p) => p.id);
        const target = ids.length > 1 ? await this._pickTarget(ids, 'ally') : me.id;
        return target ? { type: 'draught', target } : null;
      }
      case 'flee': return { type: 'flee' };
      default: return { type: 'end' };
    }
  }

  /**
   * A menu in the dialog box (instant text): the chosen index (undefined when it closed otherwise).
   * @param {string} text
   * @param {string[]} choices
   * @param {string} [speaker] the name plate (default: "Your turn")
   * @returns {Promise<number|undefined>}
   */
  async _menu(text, choices, speaker = t('glaive.menu.title')) {
    const dlg = this.ui.dialog;
    const speed = dlg.speed;
    dlg.speed = 0;
    try {
      return await dlg.open({ speaker, lines: [{ text, choices }] });
    } finally {
      dlg.speed = speed;
    }
  }

  /**
   * Choose a combatant on the field: arrows / WASD cycle, Space confirms, Esc backs out. A ring and
   * the reticle mark the one chosen; a toast tells its HP, AC and the odds.
   * @param {string[]} ids
   * @param {'attack'|'maneuver'|'spell'|'ally'} why
   * @returns {Promise<string|null>}
   */
  _pickTarget(ids, why) {
    if (!ids.length) return Promise.resolve(null);
    const enc = this.encounter;
    // the nearest first
    const me = enc?.current;
    const sorted = me ? [...ids].sort((a, b) => enc.dist(me, enc.get(a)) - enc.dist(me, enc.get(b))) : ids;
    return new Promise((resolve) => {
      const ring = this.markerAllocCore();
      this._picking = { ids: sorted, i: 0, resolve, ring, why };
      this._pickShow();
    });
  }

  _pickShow() {
    const pk = this._picking;
    const enc = this.encounter;
    if (!pk || !enc) return;
    const id = pk.ids[pk.i];
    const c = enc.get(id);
    const a = this.actorOf(id);
    if (!c || !a) return;
    this.markerSetCore(pk.ring, { shape: 'ring', x: a.position.x, z: a.position.z, r: 0.95, rInner: 0.7, style: c.side === 'foe' ? 'enemy' : 'player', progress: 1 });
    this.ui.combat?.labels.reticle(a.position, a.labelY ?? 2);
    const me = enc.current;
    let odds = '';
    if (me?.sheet && c.side === 'foe' && pk.why !== 'spell') {
      const ranged = me.sheet.ranged;
      const need = enc.acOf(c, ranged) - me.sheet.attackBonus(ranged);
      const p = Math.max(5, Math.min(95, (21 - need) * 5));
      odds = t('glaive.pick.odds', { p });
    }
    // (a studied foe: its visible weapon, never its HP numbers — research mode hides what the
    // player cannot observe)
    const studied = this._who.get(id) instanceof Foe ? /** @type {Foe} */ (this._who.get(id)).studied : null;
    const info = studied
      ? t('glaive.pick.infoStudied', { name: c.name, weapon: studied.weaponName, ac: enc.acOf(c) })
      : t('glaive.pick.info', { name: c.name, hp: Math.max(0, c.hp), hpMax: c.hpMax, ac: enc.acOf(c) });
    this.ui.hud.toast(info + (odds ? `${sep()}${odds}` : ''), 1.4);
  }

  _pickStep() {
    const pk = this._picking;
    if (!pk) return;
    const inp = this.input;
    const press = (n) => (typeof inp.consumeAction === 'function' ? inp.consumeAction(n) : inp.actionPressed(n));
    let moved = 0;
    if (press('right') || press('down')) moved = 1;
    if (press('left') || press('up')) moved = -1;
    if (moved) {
      pk.i = (pk.i + moved + pk.ids.length) % pk.ids.length;
      this.audio.playSfx('blip', { volume: 0.4 });
      this._pickShow();
    }
    if (press('confirm') || press('attack')) this._pickDone(pk.ids[pk.i]);
    else if (press('cancel')) this._pickDone(null);
  }

  /** @param {string|null} id */
  _pickDone(id) {
    const pk = this._picking;
    if (!pk) return;
    this._picking = null;
    this.markerFreeCore(pk.ring);
    this.ui.combat?.labels.reticle(null);
    this.audio.playSfx(id ? 'confirm' : 'cancel', { volume: 0.5 });
    pk.resolve(id);
  }

  /**
   * Choose a spot on the ground within `max` u of `me`: the stick / WASD moves a cursor (or the
   * mouse), Space / a click confirms, Esc backs out. `radius` > 0 shows the area too.
   * @param {Combatant} me
   * @param {number} max
   * @param {number} [radius]
   * @returns {Promise<{x:number,z:number}|null>}
   */
  _pickPoint(me, max, radius = 0) {
    return new Promise((resolve) => {
      const ring = this.markerAllocCore();
      const dot = this.markerAllocCore();
      this.markerSetCore(ring, { shape: 'ring', x: me.x, z: me.z, r: max, rInner: Math.max(0, max - 0.12), style: 'player', progress: 1, alpha: 0.6 });
      const pt = this.input.pointer;
      this._cursor = { x: me.x, z: me.z, cx: me.x, cz: me.z, max, resolve, ring, dot, radius, mouse: false, px: pt.x, py: pt.y };
      this._cursorDraw();
      this.ui.hud.toast(t('glaive.pick.point'), 2.4);
    });
  }

  _cursorDraw() {
    const c = this._cursor;
    if (!c) return;
    const r = c.radius > 0 ? c.radius : 0.45;
    this.markerSetCore(c.dot, { shape: c.radius > 0 ? 'circle' : 'ring', x: c.x, z: c.z, r, rInner: c.radius > 0 ? 0 : 0.28, style: 'player', progress: 1 });
  }

  /** @param {number} dt */
  _cursorStep(dt) {
    const c = this._cursor;
    if (!c) return;
    const inp = this.input;
    const mv = inp.getMoveVector();
    const pt = inp.pointer;
    if (Math.hypot(mv.x, mv.y) > 0.05) {
      const { forward, right } = this.rig.getMoveBasis();
      c.x += (right.x * mv.x + forward.x * mv.y) * CURSOR_SPEED * dt;
      c.z += (right.z * mv.x + forward.z * mv.y) * CURSOR_SPEED * dt;
      c.mouse = false;
    } else if (pt.inside && (Math.abs(pt.x - c.px) > 2 || Math.abs(pt.y - c.py) > 2)) {
      const hit = this._mousePoint();
      if (hit) { c.x = hit.x; c.z = hit.z; c.mouse = true; }
    }
    c.px = pt.x;
    c.py = pt.y;
    const dx = c.x - c.cx, dz = c.z - c.cz;
    const d = Math.hypot(dx, dz);
    if (d > c.max) { c.x = c.cx + (dx / d) * c.max; c.z = c.cz + (dz / d) * c.max; }
    this._cursorDraw();
    const press = (n) => (typeof inp.consumeAction === 'function' ? inp.consumeAction(n) : inp.actionPressed(n));
    if (press('confirm') || press('attack')) this._cursorDone({ x: c.x, z: c.z });
    else if (press('cancel')) this._cursorDone(null);
  }

  /** @param {{x:number,z:number}|null} p */
  _cursorDone(p) {
    const c = this._cursor;
    if (!c) return;
    this._cursor = null;
    this.markerFreeCore(c.ring);
    this.markerFreeCore(c.dot);
    this.audio.playSfx(p ? 'confirm' : 'cancel', { volume: 0.5 });
    c.resolve(p);
  }

  /** The ground point under the mouse (the plane at the player's feet), or null. */
  _mousePoint() {
    const canvas = this.engine.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const pt = this.input.pointer;
    if (!rect.width || !rect.height) return null;
    _ndc2.set(((pt.x - rect.left) / rect.width) * 2 - 1, -((pt.y - rect.top) / rect.height) * 2 + 1);
    _ray.setFromCamera(_ndc2, this.engine.camera);
    _plane.set(_v.set(0, 1, 0), -this.player.position.y);
    const hit = _ray.ray.intersectPlane(_plane, _v);
    return hit ? { x: hit.x, z: hit.z } : null;
  }

  // ---- stage callbacks ----

  /** A foe died (or a PC was slain). @param {string} id */
  onDeath(id) {
    const o = this._who.get(id);
    if (o instanceof Foe) {
      o.die();
      this.kills++;
      this.sfxAt('enemyDie', o.position.x, o.position.z, { volume: 0.8 });
      this.burst(o.kind === 'slime' ? 'gooPoof' : 'deathPoof', o.position.x, o.position.y + 0.6, o.position.z, 14);
      if (!o.isAdd && !o.boss) this._dropLoot(o);
      this.events.emit('kill', { uid: o.uid, groupId: o.groupId, kind: o.kind, isAdd: o.isAdd });
      if (o.boss) this._bossDefeated(o);
    } else this.onDown(id);
    this.refreshBars();
  }

  /** A PC is Out of Action. @param {string} id */
  onDown(id) {
    const a = this.actorOf(id);
    if (a && 'down' in a) /** @type {PcActor} */ (a).down();
    const o = this._who.get(id);
    if (o instanceof AllyView) o.down = true;
    if (o === 'player') {
      this.sfxAt('playerDown', this.player.position.x, this.player.position.z, { volume: 1 });
      this.look.startDeath();
    }
  }

  /** @param {string} id @param {number[]} points */
  onRout(id, points) {
    const o = this._who.get(id);
    if (!(o instanceof Foe)) return;
    o.rout(points);
    this.events.emit('kill', { uid: o.uid, groupId: o.groupId, kind: o.kind, isAdd: o.isAdd, routed: true });
  }

  /** @param {string} id @param {number} x @param {number} z */
  onSummon(id, x, z) {
    const o = this._who.get(id);
    if (!(o instanceof Foe)) return;
    this.burst('emberBurst', x, this.groundAt(x, z) + 1.3, z, 12);
    this.sfxAt('batScreech', x, z, { volume: 0.7 });
  }

  /** @param {string} id @param {number} phase */
  onPhase(id, phase) {
    const o = this._who.get(id);
    if (!(o instanceof Foe)) return;
    o.pose('roar');
    this.shake(0.35, 0.7);
    this.look.pulsePhase();
    this.sfxAt('bossRoar', o.position.x, o.position.z, { volume: 1 });
    if (phase >= 2) for (const em of this._emitters) em.enabled = true;
    this.music.setSection(phase >= 2 ? 'B' : 'A');
    this.later(0.9, () => o.pose(null));
  }

  /** @param {Beat} b */
  onInjury(b) {
    const o = this._who.get(b.who);
    const a = this.actorOf(b.who);
    if (b.result !== 'dead' && a instanceof PcActor) a.up();
  }

  /** HP bars follow the fight. */
  refreshBars() { this._barsDirty = true; }

  // ---- the end of a fight ----

  _endFight() {
    const enc = this.encounter;
    if (!enc) return;
    const res = enc.result;
    this.encounter = null;
    this.engaged = false;
    this.stage.clear();
    this.hud.show(false);
    this.ui.combat?.labels.reticle(null);
    for (const c of enc.list) {
      const o = this._who.get(c.id);
      if (!(o instanceof Foe)) continue;
      o.inFight = false;
      if (!o.gone) o.hp = Math.max(1, c.hp);
    }
    // sheets: the uses that come back after every fight; injuries leave their marks
    const injured = new Map(res.injuries.map((i) => [i.who, i]));
    for (const c of enc.list) {
      if (!c.sheet) continue;
      const inj = injured.get(c.id);
      if (inj) {
        if (inj.result === 'fatigued') c.sheet.fatigue = Math.min(4, c.sheet.fatigue + 1);
        if (inj.result === 'wounded' || inj.result === 'scarred' || inj.result === 'maimed') c.sheet.wounds = Math.min(3, c.sheet.wounds + 1);
        if (inj.result === 'scarred' || inj.result === 'maimed') c.sheet.marks.push(inj.result);
      }
      c.sheet.afterFight();
    }
    for (const a of this.allies) {
      const c = enc.get(a.id);
      a.active = false;
      if (c && (c.state === 'dead' || c.state === 'down')) { a.down = true; a.active = true; }
    }
    const playerC = enc.get('player');
    const playerDead = !playerC || playerC.state === 'dead' || (playerC.state === 'down' && res.outcome !== 'defeat' && injured.get('player')?.result === 'dead');
    this.events.emit('fightEnd', res.outcome);
    if (res.outcome === 'defeat' || playerDead) {
      this._defeat();
      return;
    }
    this.player.action = null;
    this.locksPlayer = false;
    this.playerActor.up();
    this.playerActor.pose(null);
    if (res.outcome === 'fled') {
      // the foes walk home whole; they leave the party be a moment
      for (const c of enc.list) {
        const o = this._who.get(c.id);
        if (o instanceof Foe && !o.gone && !o.boss) { o.reset((x, z) => this.groundAt(x, z)); }
      }
      this._calmT = CALM_AFTER_FLEE;
      this.ui.hud.toast(t('glaive.end.fled'), 2.4);
      return;
    }
    // victory: XP (and silver counts as XP when it is picked up)
    const before = this.sheet.pendingLevels;
    this.sheet.gainXp(res.xp);
    if (res.xp > 0) this.ui.combat?.hud.loot(t('glaive.loot.xp', { n: res.xp }), 'upgrade');
    this.audio.playStinger?.('victory', { duck: 0.5 });
    if (this.sheet.pendingLevels > before) this.ui.hud.toast(t('glaive.level.ready'), 2.6);
  }

  /** The party fell: the death screen, then the last waystone. */
  _defeat() {
    this.pc.alive = false;
    this.pc.deaths++;
    this.music.death();
    this.events.emit('playerDeath');
    this.later(1.0, () => this._deathScreen());
  }

  async _deathScreen() {
    const game = this.game;
    const ui = this.ui;
    const gen = ++this._deathGen;
    game.busy = true;
    this._respawning = true;
    try {
      game.toggleMap?.(false);
      const cp = this.waystones.checkpoint;
      await ui.combat.death.show({ title: t('combat.death.title'), subtitle: '', prompt: t('combat.death.prompt', { place: placeName(cp) }), armDelay: 1.0 });
      if (game._disposed || gen !== this._deathGen) return;
      await ui.fader.fadeOut(0.8);
      if (game._disposed || gen !== this._deathGen) { ui.fader.fadeIn?.(0.3); return; }
      ui.combat.death.hide();
      const at = this.waystones.checkpoint;
      this.resetEncounter();
      this._respawnAt(at);
      await ui.fader.fadeIn(1.0);
      ui.hud.toast(t('combat.death.risen', { place: placeName(at) }), 2.4);
    } finally {
      if (gen === this._deathGen) { this._respawning = false; game.busy = false; }
    }
  }

  /** @param {Checkpoint} cp */
  _respawnAt(cp) {
    const stand = cp.stand ?? cp;
    this.game.teleport(stand.x, stand.z);
    this.locksPlayer = false;
    this.player.action = null;
    this.playerActor.up();
    this.look.reset();
    this.music.respawn();
    this.events.emit('respawn', cp.id);
  }

  // ---- loot ----

  /** @param {Foe} e */
  _dropLoot(e) {
    const rng = lootRng(e.uid, e.deathCount, this.seedValue);
    const [g0, g1] = e.stats.silver;
    const silver = g1 > 0 ? rng.int(Math.round(g0), Math.round(g1)) : 0;
    const y = this.groundAt(e.position.x, e.position.z);
    if (silver > 0) this.dropGold(silver, e.position.x, y + 0.3, e.position.z, rng);
    if (rng.next() < e.stats.draughtChance) this.pickups.drop('draught', 1, e.position.x, y + 0.3, e.position.z, rng);
  }

  /** @param {number} gold @param {number} x @param {number} y @param {number} z @param {RNG} rng */
  dropGold(gold, x, y, z, rng) {
    const n = splitCoins(gold, this._coins);
    for (let i = 0; i < n; i++) this.pickups.drop(this._coins[i].kind, this._coins[i].amount, x, y, z, rng);
  }

  /** @param {string} kind */
  wantsPickup(kind) {
    if (kind === 'draught') return this.pc.potions < POTION_MAX;
    if (kind === 'heart' || kind === 'mana') return false;
    return true;
  }

  /** @param {string} what */
  upgradeText(what) {
    if (what === 'core') return `${t('combat.upgrade.core')}${sep()}${t('glaive.upgrade.maxHp', { n: UPGRADES.core })}`;
    if (what === 'maxHp' || what === 'maxMp' || what === 'attack' || what === 'def') return t(`glaive.upgrade.${what}`, { n: UPGRADES[what] });
    return t('combat.upgrade.other');
  }

  /**
   * A pickup reached the player: silver (and its XP), a draught, an upgrade.
   * @param {string} kind @param {number} amount @param {string} extra @param {number} x @param {number} y @param {number} z
   */
  collectPickup(kind, amount, extra, x, y, z) {
    const pc = this.pc;
    const feed = this.ui.combat?.hud;
    const p = this.player.position;
    if (!this.wantsPickup(kind)) return false;
    if (kind.startsWith('coin')) {
      pc.gold += amount;
      this.sheet.gainXp(amount * XP_PER_SILVER);
      feed?.loot(t('glaive.loot.silver', { n: amount }), 'gold');
      this.audio.playSfx('coin', { volume: 0.55, pitch: kind === 'coin25' ? 0.85 : kind === 'coin5' ? 1 : 1.12 });
    } else if (kind === 'draught') {
      pc.potions = Math.min(POTION_MAX, pc.potions + 1);
      feed?.loot(t('combat.loot.draught'), 'draught');
      this.audio.playSfx('pickup', { volume: 0.7 });
    } else if (kind === 'upgrade' || kind === 'core') {
      const what = kind === 'core' ? 'core' : extra;
      pc.upgrade(/** @type {any} */ (what));
      feed?.loot(this.upgradeText(what), kind === 'core' ? 'core' : 'upgrade');
      this.ui.hud.toast(t('combat.obtained', { item: this.upgradeText(what) }), 2.4);
      this.audio.playSfx('levelup', { volume: 0.5 });
      this.burst('levelSparkle', p.x, p.y + 1.9, p.z, 12);
    }
    this.events.emit('pickup', kind, amount);
    return true;
  }

  // ---- the boss ----

  /** @param {Foe} e */
  _bossDefeated(e) {
    const a = e.arena;
    if (a?.deathBursts) a.deathBursts(/** @type {any} */ (e));
    this.shake(0.5, 0.8);
    this.music.victory();
    a?.open?.();
    this.bossDefeated = true;
    this._bossFight = null;
    for (const em of this._emitters) em.enabled = false;
    for (const add of this._addsOf.get(e) ?? []) if (!add.hidden) { add.die(); }
    for (let i = this._bossMarkers.length - 1; i >= 0; i--) {
      const m = this._bossMarkers[i];
      if (m.arena !== a) continue;
      const k = this._map?.markers.indexOf(m) ?? -1;
      if (k >= 0) this._map.markers.splice(k, 1);
    }
    // its treasure and its core
    const rng = lootRng(e.uid, e.deathCount, this.seedValue);
    const y = this.groundAt(e.position.x, e.position.z);
    this.dropGold(e.stats.silver[1], e.position.x, y, e.position.z, rng);
    this.pickups.drop('core', 1, e.position.x, y, e.position.z, rng);
    this.events.emit('bossDefeated', e);
    this.later(0.4, () => this.ui.banner?.show(t('combat.victory.title'), t('combat.victory.sub'), { duration: 3.4 }));
    this.later(1.8, () => this._resultsCard());
    this.later(2.0, () => this.ui.combat?.boss.hide());
  }

  _resultsCard() {
    const secs = Math.round(this.clock);
    const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const line = [mmss, tn('glaive.results.foes', this.kills), tn('glaive.results.fights', this.fights), t('combat.results.lv', { n: this.sheet.level })].join(sep());
    this.ui.combat?.announcer.announce(t('combat.results.title', { place: term(this.level.name) }), line, { duration: 7, kind: 'results' });
  }

  // =============================================================================================
  // Character creation and levels (dialog menus)
  // =============================================================================================

  /** The first quiet moment of play: the player picks a calling and an ancestry. */
  async _chooseBuild() {
    if (this._choosing || this.chosen) return;
    this._choosing = true;
    this.game.busy = true;
    try {
      const builds = BUILD_IDS;
      const title = t('glaive.create.title');
      const b = await this._menuLong(t('glaive.create.intro'), builds.map((id) => `${t(`glaive.build.${id}`)} — ${t(`glaive.build.${id}.hint`)}`), title);
      // (chosen meanwhile: the `choose` hook)
      if (this.chosen) return;
      const build = builds[b ?? 0] ?? 'sellsword';
      const anc = await this._menuLong(t('glaive.create.ancestry'), ANCESTRY_IDS.map((id) => `${t(`glaive.ancestry.${id}`)} — ${t(`glaive.ancestry.${id}.hint`)}`), title);
      const ancestry = ANCESTRY_IDS[anc ?? 0] ?? 'human';
      // (chosen meanwhile: the `choose` hook)
      if (this.chosen) return;
      const keep = { silver: this.sheet.silver, potions: this.sheet.potions, level: this.sheet.level, xp: this.sheet.xp, upgrades: { ...this.sheet.upgrades } };
      const s = Sheet.create(build, ancestry, '');
      s.silver = keep.silver;
      s.potions = keep.potions;
      s.upgrades = keep.upgrades;
      s.xp = keep.xp;
      s.hp = s.hpMax;
      this.sheet = s;
      this.chosen = true;
      for (const a of this.allies) a.syncLevel();
      this.ui.hud.toast(t('glaive.create.done', { build: t(`glaive.build.${build}`), ancestry: t(`glaive.ancestry.${ancestry}`), hp: s.hpMax, ac: s.ac }), 3.4);
    } finally {
      this.game.busy = false;
      this._choosing = false;
    }
  }

  /** Levels owed: a talent and an ability to raise for each. */
  async _levelUps() {
    if (this._choosing) return;
    this._choosing = true;
    this._levelQueue = this.sheet.pendingLevels;
    this.game.busy = true;
    try {
      while (this.sheet.pendingLevels > 0) {
        const s = this.sheet;
        const next = s.level + 1;
        let talent = null;
        if (s.talents.length < 6) {
          const opts = talentChoices(s.talents, s.ancestry).filter((id) => TALENTS[id].group !== 'ancestry' || TALENTS[id].ancestry === s.ancestry);
          // a short list: the build's own archetype first, then the rest by catalogue
          const list = opts.slice(0, 7);
          const c = await this._menuLong(t('glaive.level.talentQ', { n: next }), list.map((id) => `${t(`glaive.talent.${id}.name`)} — ${t(`glaive.talent.${id}.text`)}`), t('glaive.level.title'));
          talent = list[c ?? 0] ?? null;
        }
        const raise = s.raisable();
        let ability = null;
        if (raise.length) {
          const c = await this._menuLong(t('glaive.level.abilityQ'), raise.map((k) => `${t(`glaive.ability.${k}`)} +${s.abilities[k]} → +${s.abilities[k] + 1}`), t('glaive.level.title'));
          ability = raise[c ?? 0] ?? null;
        }
        s.levelUp(talent, ability);
        s.hp = s.hpMax;
        for (const a of this.allies) a.syncLevel();
        const p = this.player.position;
        this.ui.combat?.announcer.announce(t('combat.level.title', { n: s.level }), [t('glaive.level.hp', { n: s.hpMax }), talent ? t(`glaive.talent.${talent}.name`) : ''].filter(Boolean).join(sep()), { duration: 2.6, kind: 'level' });
        this.fx.play('pillar', p.x, p.y, p.z, { follow: p, duration: 1 });
        this.burst('levelSparkle', p.x, p.y + 1.9, p.z, 14);
        this.sfxAt('levelup', p.x, p.z, { volume: 1 });
        this.events.emit('levelup', s.level);
      }
    } finally {
      this.game.busy = false;
      this._choosing = false;
      this._levelQueue = 0;
    }
  }

  /**
   * A menu with typed text (the creation and level menus). Long lists open in pages of five.
   * @param {string} text
   * @param {string[]} choices
   * @param {string} [speaker]
   */
  async _menuLong(text, choices, speaker) {
    const PAGE = 5;
    if (choices.length <= PAGE + 1) return this._menu(text, choices, speaker);
    for (let page = 0; ; page = (page + 1) % Math.ceil(choices.length / PAGE)) {
      const slice = choices.slice(page * PAGE, page * PAGE + PAGE);
      const c = await this._menu(text, [...slice, t('glaive.menu.more')], speaker);
      if (c === undefined) return undefined;
      if (c < slice.length) return page * PAGE + c;
    }
  }

  // =============================================================================================
  // HUD, labels, minimap
  // =============================================================================================

  _updateHud() {
    const hud = this.ui.combat?.hud;
    if (!hud || !this._vitals) return;
    const s = this.sheet;
    const v = this._vitals;
    v.hp = Math.max(0, s.hp);
    v.hpMax = s.hpMax;
    v.mp = s.castsLeft;
    v.mpMax = s.castsMax;
    v.sp = Math.max(0, 4 - s.fatigue - s.wounds);
    v.spMax = 4;
    v.level = s.level;
    v.xp = s.xp;
    v.xpNext = s.xpNext;
    v.winded = s.fatigue + s.wounds > 0;
    hud.setVitals(v);
    hud.setSkill(0, { cooldown: 0, seconds: 0, left: 0, locked: false, affordable: s.potions > 0 });
    hud.setPotions(s.potions, POTION_MAX);
    hud.setGold(s.silver);
  }

  _updateLabels() {
    const labels = this.ui.combat?.labels;
    if (!labels) return;
    let slot = 0;
    const enc = this.encounter;
    if (enc) {
      for (const c of enc.list) {
        if (c.side !== 'foe' || c.state !== 'active' || slot >= 32) continue;
        const e = this._who.get(c.id);
        if (!(e instanceof Foe) || e.boss) continue;
        const bar = labels.bar(slot++);
        bar.anchor(e.position, e.labelY);
        bar.set(Math.max(0, c.hp) / c.hpMax, e.elite ? { elite: true, level: e.level, name: this.displayName(e) } : undefined);
        bar.show();
      }
      const boss = this._bossFight ? enc.get(this._bossFight.uid) : null;
      if (boss) this.ui.combat?.boss.set(Math.max(0, boss.hp) / boss.hpMax, boss.poolIndex + 1);
    }
    for (; slot < 32; slot++) labels.bar(slot).hide();
  }

  _updateMinimap() {
    const out = this.minimapEnemies;
    out.length = 0;
    if (!this.encounter) return;
    for (const c of this.encounter.list) {
      if (c.side !== 'foe' || c.state !== 'active') continue;
      const e = this._who.get(c.id);
      if (e instanceof Foe) out.push({ x: e.position.x, z: e.position.z });
    }
  }

  // =============================================================================================
  // Rest, reset, shop
  // =============================================================================================

  /**
   * After a lost fight (`full` false): living foes home and whole, the fallen stay fallen, the boss
   * reset; the player loses a share of the silver and gets up. `full` (a rest): every foe but a
   * defeated boss comes back, nothing is taken.
   * @param {{ full?: boolean }} [opts]
   */
  resetEncounter({ full = false } = {}) {
    if (this.encounter) {
      this.research?.abort();
      this.encounter = null;
      this.stage.clear();
      this.hud.show(false);
    }
    if (this._picking) this._pickDone(null);
    if (this._cursor) this._cursorDone(null);
    const ground = (x, z) => this.groundAt(x, z);
    for (const e of this.enemies) {
      if (e.isAdd) { e.hide(); e.alive = false; continue; }
      if (this._absentGroups.has(this._groupOf.get(e))) continue;
      if (e.boss) { if (!this.bossDefeated) e.reset(ground); continue; }
      if (full || !e.gone) e.reset(ground);
    }
    for (const a of this.arenas) a.open();
    for (const em of this._emitters ?? []) em.enabled = false;
    this._bossFight = null;
    this.ui.combat?.boss.hide();
    this.music.setSection('A');
    this.engaged = false;
    this.locksPlayer = false;
    this.player.action = null;
    this.fx.clear();
    if (!full) {
      this.pickups.clear();
      this.pc.gold = Math.floor(this.pc.gold * (1 - SILVER_LOSS));
      this.sheet.hp = this.sheet.hpMax;
      this.sheet.fatigue = 0;
      this.pc.alive = true;
    }
    this.healAllies();
  }

  /** Rest at a waystone: a GLAIVE long rest for the party, every foe back. */
  restAll() {
    this.resetEncounter({ full: true });
    // a research study: the expedition ends; the packs come back as new individuals
    if (this.research) {
      this.research.startExpedition();
      for (const e of this.enemies) this._applyResearch(e);
    }
    this.pc.refill();
    this.pc.potions = Math.max(this.pc.potions, REST_DRAUGHTS);
  }

  /** @param {string} item */
  buy(item) {
    const w = shopWare(item);
    if (!w) return { ok: false, reason: 'item' };
    const pc = this.pc;
    if (w.once && this.purchased.has(w.id)) return { ok: false, reason: 'sold' };
    if (!w.upgrade && pc.potions >= POTION_MAX) return { ok: false, reason: 'full' };
    if (pc.gold < w.price) return { ok: false, reason: 'gold' };
    pc.gold -= w.price;
    if (w.upgrade) pc.upgrade(/** @type {any} */ (w.upgrade), w.amount);
    else pc.potions++;
    if (w.once) this.purchased.add(w.id);
    this.events.emit('purchase', w.name, w.price);
    return { ok: true };
  }

  /** @param {string} item */
  priceOf(item) { return shopWare(item)?.price ?? null; }

  shopOffers() {
    const pc = this.pc;
    return SHOP_WARES.map((w) => {
      const sold = w.once && this.purchased.has(w.id);
      const reason = sold ? 'sold' : !w.upgrade && pc.potions >= POTION_MAX ? 'full' : pc.gold < w.price ? 'gold' : null;
      return {
        id: w.id, name: w.name, price: w.price, gain: w.gain, once: w.once, upgrade: w.upgrade, sold, available: !reason, reason,
        label: t(`combat.ware.${w.id}.name`), gainLabel: t(`glaive.ware.${w.id}`, { n: w.amount, dice: DRAUGHT_HEAL }),
      };
    });
  }

  /** @param {string} item */
  wareLabel(item) {
    const w = shopWare(item);
    return w ? t(`combat.ware.${w.id}.name`) : term(String(item ?? ''));
  }

  /** The drillmaster's reward (after a swing at a dummy): 2 draughts, once. */
  rewardTutorial() {
    const tt = this.tutorial;
    if (tt.rewarded || !tt.combo) return 0;
    tt.rewarded = true;
    const given = Math.max(0, Math.min(2, POTION_MAX - this.pc.potions));
    this.pc.potions += given;
    return given;
  }

  // =============================================================================================
  // Progress (campaigns)
  // =============================================================================================

  exportProgress() {
    const s = this.sheet;
    return { level: s.level, xp: s.xp, gold: s.silver, potions: s.potions, upgrades: { maxHp: s.upgrades.maxHp ?? 0, maxMp: s.upgrades.maxMp ?? 0, attack: s.upgrades.attack ?? 0, def: s.upgrades.def ?? 0 }, wares: [...this.purchased], sheet: s.toJSON(), chosen: this.chosen };
  }

  /** @param {any} p */
  importProgress(p) {
    if (!p || typeof p !== 'object') return;
    const n = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
    if (p.sheet && typeof p.sheet === 'object') this.sheet = Sheet.from(p.sheet);
    else {
      this.sheet.level = n(p.level, 1, 10);
      this.sheet.xp = n(p.xp, 0, 1e7);
      this.sheet.potions = n(p.potions, 0, POTION_MAX);
      for (const k of ['maxHp', 'maxMp', 'attack', 'def']) this.sheet.upgrades[k] = n(p.upgrades?.[k], 0, 999);
    }
    this.sheet.silver = n(p.gold, 0, 1e7);
    this.chosen = !!p.chosen;
    this.purchased = new Set((Array.isArray(p.wares) ? p.wares : []).filter((w) => typeof w === 'string' && SHOP_WARES.some((s) => s.id === w)));
    this.sheet.longRest();
    for (const a of this.allies) a.syncLevel();
  }

  openedChests() { return this.chests.list.filter((c) => c.opened).map((c) => c.id); }

  /** @param {string[]} ids */
  markChestsOpened(ids) {
    for (const c of this.chests.list) {
      if (!ids.includes(c.id) || c.opened) continue;
      c.opened = true;
      if (c.it) c.it.disabled = true;
      c.prop?.open?.(true);
      this.chests.discover(c);
    }
  }

  defeatedGroups() {
    const out = [];
    for (const [g, members] of this._members) {
      const id = typeof g.id === 'string' ? g.id : '';
      if (id && members.length && members.every((e) => !e.alive)) out.push(id);
    }
    return out;
  }

  /** @param {string[]} ids */
  markGroupsCleared(ids) {
    const want = new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === 'string'));
    if (!want.size) return;
    for (const [g, members] of this._members) {
      if (!want.has(g.id)) continue;
      for (const e of members) {
        if (!e.alive) continue;
        e.alive = false;
        e.sprite.visible = false;
        e.sprite.opacity = 0;
        if (!e.boss) continue;
        this.bossDefeated = true;
        e.arena?.open?.();
        for (let i = this._bossMarkers.length - 1; i >= 0; i--) {
          const m = this._bossMarkers[i];
          if (m.arena !== e.arena) continue;
          const k = this._map?.markers.indexOf(m) ?? -1;
          if (k >= 0) this._map.markers.splice(k, 1);
        }
      }
    }
  }

  // =============================================================================================
  // The story's presence
  // =============================================================================================

  /** @param {(o: LevelObject) => boolean} present */
  applyPresence(present) {
    if (!this._ready) return;
    for (const g of this._storyGroups) {
      const on = !!present(g);
      if (on !== this._absentGroups.has(g)) continue;
      this._setGroupPresent(g, on);
    }
    for (const c of this._storyChests) {
      c.absent = !present(c.obj);
      if (c.it) c.it.disabled = c.absent || c.opened;
    }
    for (const w of this._storyStones) this.waystones.setAbsent(w, !present(w.obj));
  }

  /** @param {any} g @param {boolean} on */
  _setGroupPresent(g, on) {
    const members = this._members.get(g) ?? [];
    const ground = (x, z) => this.groundAt(x, z);
    if (on) this._absentGroups.delete(g); else this._absentGroups.add(g);
    for (const e of members) {
      if (on) { if (e.alive) e.show(ground); else e.hidden = false; continue; }
      // a group taken away mid-fight leaves it
      if (this.encounter?.get(e.uid)?.state === 'active') this.encounter.get(e.uid).state = 'fled';
      if (e.boss && this._bossFight === e) { this.resetEncounter({ full: false }); }
      e.hide();
    }
    for (const e of members) {
      const a = e.boss ? e.arena : null;
      if (!a || a.present === on) continue;
      a.present = on;
      const r = a.rect;
      this.nav?.buildRect(r.minX - 0.5, r.maxX + 0.5, r.minZ - 0.5, r.maxZ + 0.5);
    }
  }

  /** The track combat wants (Game.setMusic restarts it). */
  get musicTrack() { return this.music?.musicTrack ?? 'emberfall'; }

  onTeleport() {}

  onMapOpen() {}

  // =============================================================================================
  // State
  // =============================================================================================

  /** `state().combat`: what the tests read. */
  state() {
    const s = this.sheet;
    const enc = this.encounter;
    let alive = 0, total = 0;
    for (const e of this.enemies) {
      if (e.hidden) continue;
      total++;
      if (e.alive) alive++;
    }
    return {
      rules: 'glaive',
      player: {
        hp: s.hp, hpMax: s.hpMax, ac: s.ac, level: s.level, xp: s.xp, xpNext: s.xpNext, gold: s.silver, potions: s.potions,
        build: s.build, ancestry: s.ancestry, abilities: { ...s.abilities }, talents: [...s.talents], spells: [...s.spells],
        casts: s.castsLeft, fatigue: s.fatigue, wounds: s.wounds, checkpoint: this.waystones.checkpoint.id, deaths: this.pc.deaths, chosen: this.chosen,
      },
      engaged: this.engaged,
      fight: enc ? {
        round: enc.round, current: enc.current?.id ?? null, needsInput: enc.needsInput, order: [...enc.order],
        combatants: enc.list.map((c) => ({ id: c.id, side: c.side, kind: c.kind, hp: c.hp, hpMax: c.hpMax, state: c.state, x: +c.x.toFixed(2), z: +c.z.toFixed(2), conditions: [...c.conditions.keys()] })),
        options: enc.needsInput ? enc.options() : null,
        picking: this._picking ? this._picking.ids[this._picking.i] : null,
        cursor: this._cursor ? { x: +this._cursor.x.toFixed(2), z: +this._cursor.z.toFixed(2) } : null,
        busy: this.stage.busy,
      } : null,
      fights: this.fights,
      kills: this.kills,
      research: this.research ? { expedition: this.research.expedition, counts: this.research.dataset.counts(), byHabitat: this.research.dataset.byHabitat(), missing: this.research.dataset.missing(), recording: this.research.recorder.active } : null,
      bossDefeated: this.bossDefeated,
      enemies: { total, alive },
      boss: this._boss ? { uid: this._boss.uid, alive: this._boss.alive, defeated: this.bossDefeated } : null,
      log: [...this.log.history.slice(-12)],
      markers: this.markerCount,
      pickups: this.pickups.count,
      tutorial: { ...this.tutorial },
      shop: { purchased: [...this.purchased] },
      ...(this.allies.length ? { allies: this.allies.map((a) => a.info()) } : {}),
    };
  }

  stats() {
    return {
      programs: this.engine.renderer.info.programs?.length ?? 0,
      programsAtLoad: this.programsAtLoad,
      drawCalls: this.postfx.sceneInfo.calls,
      pools: { fx: this.quads.count, markers: this.markerCount, pickups: this.pickups.count },
      nav: { ...this.nav.stats, cells: this.nav.cols * this.nav.rows, buildMs: this.navBuildMs },
    };
  }

  // =============================================================================================
  // Dispose
  // =============================================================================================

  dispose() {
    if (!this._ready) return;
    this._ready = false;
    if (this.ledger?.isOpen) this.ledger.close();
    this.ledger?.dispose();
    if (this._picking) this._pickDone(null);
    if (this._cursor) this._cursorDone(null);
    for (const a of this.allies) a.release();
    this.allies.length = 0;
    try { this.look.restore(); } catch { /* post already gone */ }
    this.pickups.clear();
    this.fx.clear();
    this.stage.clear();
    this.hud.dispose();
    for (const s of this.actorSprites) { this.spriteManager.remove(s); s.dispose(); }
    this.actorSprites.length = 0;
    this.enemies.length = 0;
    for (const em of this._emitters ?? []) em.dispose?.();
    this.particles.releaseBurstPools(this._ownPools);
    this._ownPools = [];
    this.quads.dispose();
    this.markers.dispose();
    this.atlas.texture.dispose();
    for (const s of this.sheets.values()) s.dispose?.();
    this.sheets.clear();
    this.events.clear();
    this._timers.length = 0;
    if (this._savedBindings) this.input.restoreBindings(this._savedBindings);
    this.input.disableMouseButtons?.();
    this.rig.stickZoom = 0;
    this.player.action = null;
    this.ui.disableCombat?.();
  }
}

/**
 * Cut a polyline [x0, z0, …] at `maxLen` u, and where it first comes within `stopDist` of (gx, gz).
 * @param {number[]} pts
 * @param {number} maxLen
 * @param {number} stopDist
 * @param {number} gx
 * @param {number} gz
 * @returns {{ x: number, z: number, points: number[], len: number }}
 */
function trimPath(pts, maxLen, stopDist, gx, gz) {
  const out = [pts[0], pts[1]];
  let len = 0;
  for (let i = 2; i + 1 < pts.length; i += 2) {
    const ax = out[out.length - 2], az = out[out.length - 1];
    const bx = pts[i], bz = pts[i + 1];
    const seg = Math.hypot(bx - ax, bz - az);
    if (seg < 1e-6) continue;
    // where along this segment we come within stopDist of the goal (or run out of length)
    let cut = Math.min(seg, maxLen - len);
    if (stopDist > 0) {
      for (let s = 0; s <= cut + 1e-9; s += 0.1) {
        const x = ax + ((bx - ax) * s) / seg, z = az + ((bz - az) * s) / seg;
        if (Math.hypot(x - gx, z - gz) <= stopDist) { cut = s; break; }
      }
    }
    const x = ax + ((bx - ax) * cut) / seg, z = az + ((bz - az) * cut) / seg;
    out.push(x, z);
    len += cut;
    if (cut < seg - 1e-6 || len >= maxLen - 1e-6) break;
  }
  return { x: out[out.length - 2], z: out[out.length - 1], points: out, len };
}

/** Pull a path's end back by `d` u. @param {{ x: number, z: number, points: number[], len: number }} p @param {number} d */
function shortenPath(p, d) {
  const pts = p.points;
  while (d > 1e-6 && pts.length >= 4) {
    const n = pts.length;
    const ax = pts[n - 4], az = pts[n - 3], bx = pts[n - 2], bz = pts[n - 1];
    const seg = Math.hypot(bx - ax, bz - az);
    if (seg <= d) { pts.length = n - 2; d -= seg; p.len -= seg; continue; }
    const k = (seg - d) / seg;
    pts[n - 2] = ax + (bx - ax) * k;
    pts[n - 1] = az + (bz - az) * k;
    p.len -= d;
    d = 0;
  }
  p.x = pts[pts.length - 2];
  p.z = pts[pts.length - 1];
}
