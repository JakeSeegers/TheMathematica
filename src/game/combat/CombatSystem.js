import * as THREE from 'three';
import { Sprite3D, RNG, hashString, hash2, EventEmitter, clamp, UI } from '../../engine/index.js';
// the combat-only engine modules come straight from their files, not through the engine barrel:
// peaceful levels never download them (KNOWN_ISSUES COMBAT-17; vite.config.js marks them pure)
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
import { CHARACTER_SPRITE_OPTS } from '../config.js';
import { createEnemy } from './Enemy.js';
import { scaledDef } from './defs.js';
import {
  EPS, F, SHOT_Y, MELEE_DY, mitigation, CRIT, SKILLS, DRAUGHT, DRAUGHT_HEAL, POTION_MAX, HEART_HEAL, MANA_MOTE, SHOP_WARES, shopWare,
  ENGAGE, GOLD_LOSS, RESPAWN_IFRAMES, RESPAWN_GUARD, DEATH_SCREEN_DELAY, PERFECT, WAYSTONE, PLAYER_SEP_MASS, LEVEL_CAP, UPGRADES,
} from './rules.js';
import {
  COMBAT_BINDINGS, COMBAT_PAD_BINDINGS, COMBAT_CONTROLS, COMBAT_PAD_CONTROLS, STICK_ZOOM,
} from './bindings.js';
import { hitOverlaps, HitQueue, TagRegistry } from './Hitboxes.js';
import { CombatInput } from './CombatInput.js';
import { PlayerCombat, PLAYER_HIT_META } from './PlayerCombat.js';
import { Targeting } from './Targeting.js';
import { Projectiles } from './Projectiles.js';
import { Pickups } from './Pickups.js';
import { lootRng, rollLoot, splitCoins } from './Loot.js';
import { Waystones, Chests, placeName } from './Waystones.js';
import { BossArena } from './BossArena.js';
import { CombatFx } from './CombatFx.js';
import { CombatLook, HIT_STOP, SHAKE, playerHitStop, ENEMY_FLASH_TIME } from './Feel.js';
import { CombatMusic } from './CombatMusic.js';
import { makeHooks } from './hooks.js';
import { Nav } from './Nav.js';
import COMBAT_STRINGS from './strings.js';
// the party's companions (docs/specs/PARTY.md §5): a member's fight, made by `addAlly`
import { MemberCombat } from '../party/MemberCombat.js';
import { ALLY } from '../party/rules.js';

/**
 * @import { CombatContext, PlayerView, MarkerSpec, HitSpec, CombatState, CombatStats, EnemyKind,
 *   EnemySheet, EnemyInit, EnemyGroup, BossSignal, SfxOptions, ProjectileSpec, LiveProjectile,
 *   ProjectileContact, PlayerHitMeta, SwingRecord, PointXZ, UpgradeKind, Splash } from './types.js'
 * @import { Enemy } from './Enemy.js'
 * @import { LevelObject, LevelObjectOf } from '../../engine/level/types.js'
 * @import { Checkpoint } from './Waystones.js'
 * @import { Game } from '../Game.js'
 * @import { SfxName } from '../../engine/audio/AudioSystem.js'
 * @import { PartyMember } from '../party/PartyMember.js'
 */

/**
 * A marker slot of core's table (`_mk`).
 * @typedef {object} MarkerSlot
 * @property {number} h  the GroundMarkers handle (−1: free)
 * @property {Enemy|'core'|null} owner
 * @property {number} gen  generation: stale handles held by brains are ignored
 * @property {Required<MarkerSpec>} spec  the full spec
 */

/**
 * `_spawnAdd` as ctx.spawnAdd calls it: with the add's `level` as a 5th argument, which it does not
 * take (adds are pooled at ADD_LEVEL), so the argument is dropped.
 * @typedef {(...a: [...Parameters<CombatSystem['_spawnAdd']>, number]) => Enemy|null} SpawnAddCall
 */
/**
 * `_onSignal` as ctx.emit calls it: `_onSignal` takes (event, e, a) only (a = the bossPhase
 * phase), so the 4th argument `b` is dropped.
 * @typedef {(...a: [...Parameters<CombatSystem['_onSignal']>, any]) => void} OnSignalCall
 */

/**
 * CombatSystem — the ARPG combat of a combat level (COMBAT.md §4, §9.1): created by `Game.init`
 * only when `levelHasCombat(level)`; peaceful levels never construct it.
 *
 * It owns the combat clock (sub-steps of ≤ 1/60 s, a combat-wide hit-stop and per-side time
 * scales — `engine.time.timeScale` is never touched), the player kit (`PlayerCombat`), every
 * enemy (created at load from the level's `enemy` groups, the boss adds pooled), hit resolution,
 * projectiles, pickups, loot, checkpoints and chests, the boss arena and every global consequence
 * of the boss's signals, the feedback (hit-stop, shake, flashes, numbers, sparks, the look),
 * battle music, the combat HUD values and `window.__game.combat` (the `hooks`).
 *
 * Frame protocol (Game.update): `update(dt, active)` → `player.update` → `afterPlayer(dt, active)`
 * → … → `applyLook(dt)` after `weather.update`. Nothing is created or disposed mid-game: pools,
 * hidden sprites (opacity 0) and parked handles only.
 *
 * With a story, every enemy group, chest and waystone is loaded, present or not, and comes and goes
 * live (`applyPresence`, STORY_SCRIPT.md §9.5); a campaign remembers the groups defeated in a level
 * until a waystone rest (`defeatedGroups` / `markGroupsCleared`, CAMPAIGN_FORMAT.md §6.4).
 *
 * The party's members fight beside the player (`addAlly` → a MemberCombat per member, `allies`;
 * PARTY.md §5, COMBAT.md §28): they step after the player's kit, each enemy sees its target —
 * the player, or a companion that hit it — as `ctx.player`, their hits and the enemies' hits on
 * them are resolved after the player's. With no companion nothing of it runs.
 */

const SUBSTEP = 1 / 60;
const BUDGETS = Object.freeze({ melee: 3, ranged: 2 });
const DORMANT_RANGE = 32;
const CHECK_EVERY = 0.25;
const BAR_SLOTS = 32;
const EDGE_SLOTS = 8;
const EDGE_RANGE = 20;
const PIP_RANGE = 16;
const ELITE_BAR_RANGE = 20;
const BAR_TIME = 4;
const DUMMY_REFILL = F(120);
const LOW_HP = 0.25;
const HEART_BOOST_HP = 0.3;
const CALM_TIME = 5;
const HEARTBEAT = 0.9;
const INTRO_LOCK = F(108);
const KNEEL_CAP = 0.08;
const KNEEL_TIME = F(90);
const ADDS_PER_BOSS = 6;
const ADD_LEVEL = 5;
const MARKER_SLOTS = 48;
const TICK_SAMPLES = 240;
const SEP_ITER = 1;
/** The boss's sprite dithers to this opacity while the player stands behind it on screen. */
const SEE_THROUGH = 0.45;
/** Damage numbers of non-boss enemies spawn this far above their bar anchor (`labelY`). */
const NUMBER_OVER_BAR = 0.4;
/** A hit star moved to the head top of a target behind the player is drawn a little smaller. */
const STAR_SMALL = Object.freeze({ scale: 0.8 });
/** A companion's hit star: smaller than the player's (its hits are not the player's to feel). */
const ALLY_STAR = Object.freeze({ scale: 0.55 });
/** Path searches (Nav.findPath) allowed per combat sub-step; a refused enemy asks again later. */
const NAV_SEARCHES = 2;
/** The combat UI classes (`ui.enableCombat`; imported here so peaceful levels never load them). */
const COMBAT_UI = Object.freeze({ CombatHUD, BossBar, WorldLabels, Announcer, DeathScreen });
/**
 * The WorldLabels kind of a companion's damage number: the party's teal, a little smaller than the
 * player's (`.lu-num--ally`, combat.css).
 * @type {'ally'}
 */
const ALLY_NUMBER = 'ally';
/**
 * Volume of a companion's hit sound. Its hits have no hit-stop and no shake (the whole fight would
 * stutter with every companion's hit; the player's own hits keep theirs).
 */
const ALLY_HIT_SFX_VOLUME = 0.55;
/**
 * A companion's hitbox kinds as QueuedHit metadata (only `source` is read: no hit-stop, combo or
 * finisher for companions).
 * @type {Readonly<Record<'melee'|'skill'|'projectile', Readonly<PlayerHitMeta>>>}
 */
const ALLY_HIT_META = Object.freeze({
  melee: Object.freeze({ source: 'melee', stop: 0, finisher: false, combo: 0 }),
  skill: Object.freeze({ source: 'skill', stop: 0, finisher: false, combo: 0 }),
  projectile: Object.freeze({ source: 'projectile', stop: 0, finisher: false, combo: 0 }),
});

/** @type {Required<MarkerSpec>} MarkerSpec keys (GroundMarkers.set) with their defaults */
const MARKER_DEFAULTS = {
  shape: 'circle', x: 0, y: 0.03, z: 0, r: 1, rInner: 0, dirX: 0, dirZ: 1, halfAngle: 60, len: 1, width: 1,
  w: 1, d: 1, progress: 0, style: 'enemy', alpha: 1, flash: 0,
};
const MARKER_KEYS = Object.keys(MARKER_DEFAULTS);

const _v = new THREE.Vector3();
const _vp = new THREE.Matrix4();
const _ray = new THREE.Raycaster();
const _ndc2 = new THREE.Vector2();
const _plane = new THREE.Plane();

export class CombatSystem {
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
    this.lighting = game.lighting;
    this.spriteManager = game.spriteManager;
    this.postfx = game.postfx;
    this.input = game.engine.input;
    this.env = game.env ?? game.level.environment ?? {};

    /** Combat events (§9.6). */
    this.events = new EventEmitter();
    /** @type {Enemy[]} level object order, then index; adds last */
    this.enemies = [];
    /**
     * Every enemy, boss and add sprite (the Game's sprite loop registers their fill / blob).
     * @type {Sprite3D[]}
     */
    this.actorSprites = [];
    this.engaged = false;
    this.locksPlayer = false;
    this.bossDefeated = false;
    /**
     * Aggroed enemies' live positions (the minimap's red dots), refilled in place.
     * @type {PointXZ[]}
     */
    this.minimapEnemies = [];
    /** @type {PointXZ[]} the records `minimapEnemies` reuses */
    this._mmPool = [];
    this.tutorial = { combo: false, dodge: false, rewarded: false };
    /** Ids of the one-time shop wares bought this session (SHOP_WARES; the reset hook clears it). */
    this.purchased = new Set();

    // clock
    this.seedValue = hashString(this.level.name) >>> 0;
    this.rng = new RNG(this.seedValue);
    this.stop = 0;
    this.playerScale = 1;
    this.enemyScale = 1;
    this._slow = 0;
    this.clock = 0;
    this.enemyTime = 0;
    this.frame = 0;
    this.stepNo = 1;
    this._advanced = 0;
    this._wasActive = false;
    this.kills = 0;
    this.god = false;
    this.freezeAI = false;
    /** @type {PointXZ|null} the `aim` hook's aim point (null: the mouse) */
    this.aimOverride = null;
    this._tokens = { melee: 0, ranged: 0 };
    this._engageLinger = 0;
    this._calm = 0;
    this._heartbeat = 0;
    this._checkT = 0;
    this._deathT = -1;
    this._introT = 0;
    this._respawning = false;
    /** @type {{ t: number, fn: () => void }[]} `_later` callbacks (real seconds left) */
    this._timers = [];
    /** @type {(Enemy|'player')[]} hit-stop victims (they jitter while it lasts) */
    this._stopVictims = [];
    /** @type {'keyboard'|'gamepad'|null} the legend's device */
    this._device = null;
    this._padHinted = false;
    /**
     * Lines the game adds to the combat legend (a story's journal key, the party's *G — Party*);
     * `pad: false` — no pad button: left out of the gamepad legend.
     * @type {{ keys: string, label: string, pad?: boolean }[]}
     */
    this.legendExtra = [];
    /** @type {Map<Enemy, EnemyGroup|null>} enemy → its level `enemy` object (adds: the boss's) */
    this._groupOf = new Map();
    /** @type {Map<Enemy, Enemy[]>} boss → its pooled adds */
    this._addsOf = new Map();
    /**
     * Pooled adds not spawned, and the foes of the groups the story has taken away (`_absent`):
     * hidden, dormant, excluded from everything.
     * @type {Set<Enemy>}
     */
    this._hidden = new Set();
    /** @type {Map<LevelObjectOf<'enemy'>, Enemy[]>} level `enemy` object → its foes (adds not included) */
    this._members = new Map();
    /** @type {Set<Enemy>} foes of a group the story has taken away (`applyPresence`; also in `_hidden`) */
    this._absent = new Set();
    /** @type {Set<LevelObjectOf<'enemy'>>} the groups absent now */
    this._absentGroups = new Set();
    /**
     * The burst pools this level's warm-up created — the presets only combat uses — released by
     * `dispose` (a campaign's next, peaceful level keeps its own program count: KNOWN_ISSUES CMP-05).
     * @type {ReturnType<import('../../engine/fx/Particles.js').Particles['burstPools']>}
     */
    this._ownPools = [];
    /** @type {Enemy|null} the level's boss (the first golem) */
    this._boss = null;
    /** @type {Enemy|null} the boss whose fight runs (intro to defeat / reset) */
    this._bossFight = null;
    this._bossAwake = false;
    /**
     * The phase-3 kneel window of a brain without `hpFloor` (fallback of `_bossClamp`).
     * @type {{ boss: Enemy, until: number, cap: number, taken: number }|null}
     */
    this._kneel = null;
    this._fightStart = 0;
    this._phaseStart = [0, 0, 0];
    this._phaseTimes = [0, 0, 0];
    /** @type {{ x: number, z: number, kind: string, arena: BossArena }[]} the arenas' map markers */
    this._bossMarkers = [];
    this.programsAtLoad = 0;
    this._programWarned = false;
    this._ticks = new Float32Array(TICK_SAMPLES);
    this._tickN = 0;
    this._tickT = 0;
    /** Bumped by every death screen and by the `respawn()` hook (a stale death screen stops). */
    this._deathGen = 0;
    /**
     * A level-up at the boss's kill waits for the results card ({ level, gains } or null).
     * @type {{ level: number, gains: string }|null}
     */
    this._levelAfterResults = null;
    this._bossKillXp = false;
    /**
     * The party's members fighting beside the player (docs/specs/PARTY.md §5; `addAlly`): their
     * MemberCombat, in join order.
     * @type {MemberCombat[]}
     */
    this.allies = [];
    /** No enemy hit reaches a companion (the `allyGod` test hook). */
    this.allyGod = false;
    /** Path searches the companions may still run in this sub-step (one per sub-step for all). */
    this.allySearches = 0;
    this._ready = false;
  }

  /**
   * A party member fights beside the player on this level (Party.join / attachLevel; PARTY.md
   * §5.1): its MemberCombat, also set as `member.combat`. Again for the same member: the one it
   * has. Its sheet's texture is uploaded now (a join mid-game: not in a frame's draw; before the
   * warm-up, `warmup` uploads it again harmlessly). Null before `load`.
   * @param {PartyMember} member
   * @returns {MemberCombat|null}
   */
  addAlly(member) {
    if (!member || !this._ready) return null;
    const have = this.allies.find((a) => a.member === member);
    if (have) {
      member.combat = have;
      return have;
    }
    const a = new MemberCombat(this, member);
    this.allies.push(a);
    member.combat = a;
    try {
      const tex = member.sprite?.sheet?.texture;
      if (tex) this.engine.renderer.initTexture(tex);
    } catch { /* not a texture */ }
    return a;
  }

  /**
   * A member leaves the fight (it left the party, the level goes): the foes after it turn back to
   * the player, its shots in flight go, its sprite's look is plain again.
   * @param {PartyMember} member
   */
  removeAlly(member) {
    if (!member) return;
    const i = this.allies.findIndex((a) => a.member === member);
    if (i < 0) {
      if (member.combat && !this.allies.includes(/** @type {MemberCombat} */ (member.combat))) member.combat = null;
      return;
    }
    const a = this.allies[i];
    this.allies.splice(i, 1);
    for (const e of this.enemies) if (e.target === a) e.target = null;
    this.projectiles?.removeOwner(a);
    a.release();
    member.combat = null;
  }

  /**
   * The story's `heal` (and the `healAllies` hook): every companion full and up again.
   * @returns {number} the companions refilled
   */
  healAllies() {
    for (const a of this.allies) a.refill();
    return this.allies.length;
  }

  /** The boss whose fight runs (intro to defeat), or null. */
  get bossFight() { return this._bossFight; }

  /** The closed boss arena (the player is sealed in with its boss), or null. @returns {BossArena|null} */
  sealedArena() {
    for (let i = 0; i < this.arenas.length; i++) if (this.arenas[i].active) return this.arenas[i];
    return null;
  }

  /** Does a live foe have this companion as its target? @param {MemberCombat} a */
  isTargeted(a) {
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) if (list[i].target === a && list[i].alive) return true;
    return false;
  }

  /** How many live foes target this companion. @param {MemberCombat} a */
  targetedBy(a) {
    let n = 0;
    for (const e of this.enemies) if (e.target === a && e.alive) n++;
    return n;
  }

  // =============================================================================================
  // Load
  // =============================================================================================

  /** Everything of COMBAT.md §4.5: sheets, atlas, batches, enemies, UI, bindings, checkpoints. */
  async load() {
    const t0 = performance.now();
    const { scene, tileMap: tm, level } = this;

    // ---- art ----
    const groups = level.objects.filter((o) => o.type === 'enemy');
    const kinds = new Set(groups.map((g) => g.kind));
    if (kinds.has('golem')) kinds.add('bat');
    /** @type {Map<string, EnemySheet>} kind → EnemySheet (shared by every sprite of the kind) */
    this.sheets = new Map();
    for (const k of kinds) {
      try { this.sheets.set(k, createEnemySheet(/** @type {EnemyKind} */ (k))); } catch (err) { console.warn(`[combat] no sheet for "${k}":`, err); }
    }
    this.atlas = createFxAtlas();
    this.atlasFrames = this.atlas.frames;
    this.quads = new FxQuads({ atlas: this.atlas, capacity: 256 });
    scene.add(this.quads.object);
    this.markers = new GroundMarkers({
      capacity: MARKER_SLOTS,
      heightField: { sample: (x, z) => tm.getHeight(x, z), minX: 0, minZ: 0, maxX: tm.width, maxZ: tm.depth },
    });
    scene.add(this.markers.object);
    /** @type {MarkerSlot[]} */
    this._mk = [];
    for (let i = 0; i < MARKER_SLOTS; i++) this._mk.push({ h: -1, owner: null, gen: 0, spec: { ...MARKER_DEFAULTS } });
    this._markerSpec = { ...MARKER_DEFAULTS };

    // ---- runtime pieces ----
    this.fx = new CombatFx(this.quads, this.atlas);
    this.tags = new TagRegistry();
    this.playerHits = new HitQueue(16);
    this.enemyHits = new HitQueue(32);
    /** The companions' hitboxes of the sub-step (owner: the MemberCombat; resolved after the player's). */
    this.allyHits = new HitQueue(8);
    /** @type {ProjectileContact[]} pooled; the first `_contactN` are this sub-step's */
    this._contacts = [];
    this._contactN = 0;
    this.projectiles = new Projectiles(this);
    this.pickups = new Pickups(this);
    this.cin = new CombatInput(this.input);
    this.look = new CombatLook(this.postfx);
    this.music = new CombatMusic(this.audio, this.env);
    /** @type {PlayerView} the player as enemies see it (`ctx.player`, §9.2) */
    this._pv = {
      position: this.player.position, radius: 0.3, body: [0, 1.8], facing: { x: 0, z: 1 }, velocity: { x: 0, z: 0 },
      alive: true, invulnerable: false, dodging: false, action: null, swing: 0, sealed: false,
    };
    this._prevPos = new THREE.Vector3().copy(this.player.position);
    this.ctx = this._makeContext();
    this._ndc = { x: 0, y: 0, on: false };
    this._vpe = new Float32Array(16);
    this._cacheViewProjection();

    // ---- UI, bindings ----
    // the combat's words (docs/specs/I18N.md §2): registered before the UI that shows them
    registerStrings('combat', COMBAT_STRINGS);
    /** @type {WeakMap<Enemy, string>} each enemy's name as shown (`displayName`) */
    this._shownNames = new WeakMap();
    UI.useCombatUI(COMBAT_UI);
    this.ui.enableCombat();
    // (put back by dispose: a campaign may travel on to a peaceful level)
    this._savedBindings = this.input.saveBindings();
    this.input.addBindings(COMBAT_BINDINGS, COMBAT_PAD_BINDINGS);
    this.input.enableMouseButtons?.(this.engine.renderer.domElement);
    this.rig.stickZoom = STICK_ZOOM;

    // ---- zones: the level's regions, first match (the location plate's rule, `minY` included) ----
    this.zones = level.objects.filter((o) => o.type === 'region' && ['minX', 'maxX', 'minZ', 'maxZ'].every((k) => Number.isFinite(o[k])))
      .map((o) => ({ id: o.id, minX: o.minX, maxX: o.maxX, minZ: o.minZ, maxZ: o.maxZ, minY: Number.isFinite(o.minY) ? o.minY : null }));

    // ---- enemies (level object order, then index), adds last ----
    /** @type {BossArena[]} one per golem group */
    this.arenas = [];
    for (const g of groups) this._spawnGroup(g);
    for (const boss of this.enemies.filter((e) => e.boss)) this._createAdds(boss);

    // ---- the enemies' walk grid (paths up stairs, around rocks, home; the arenas are closed) ----
    const tn = performance.now();
    this.nav = new Nav(tm, { blocked: (x, z) => this._inArena(x, z) });
    this.nav.buildMs = Math.round((performance.now() - tn) * 10) / 10;
    this.nav.warm();
    this.ctx.nav = this.nav;

    // ---- player kit, targeting, checkpoints, chests ----
    this.pc = new PlayerCombat(this);
    this.targeting = new Targeting(this);
    this.waystones = new Waystones(this);
    this.chests = new Chests(this);
    this.waystones.bind(this.world.interactables);
    this.chests.bind(this.world.interactables);
    // the story's conditions on them (`applyPresence`): only the objects that carry one are read
    /** @type {LevelObjectOf<'enemy'>[]} */
    this._storyGroups = [...this._members.keys()].filter((g) => hasStoryCondition(g));
    this._storyChests = this.chests.list.filter((c) => hasStoryCondition(c.obj));
    this._storyStones = this.waystones.list.filter((w) => w.obj && hasStoryCondition(w.obj));

    // ---- the caldera ember emitter per arena (created disabled; the boss's phase 2 enables it) ----
    this._emitters = this.arenas.map((a) => {
      const r = a.rect;
      return this.particles.createEmitter({
        preset: 'embers',
        bounds: { center: new THREE.Vector3(a.center.x, a.y + 1.6, a.center.z), size: new THREE.Vector3(r.maxX - r.minX, 3.2, r.maxZ - r.minZ) },
        count: 90, enabled: false,
      });
    });

    this.hooks = makeHooks(this);
    this.loadMs = Math.round(performance.now() - t0);
    this._ready = true;
  }

  /**
   * Create the enemies of one level `enemy` object.
   * @param {LevelObjectOf<'enemy'>} g
   */
  _spawnGroup(g) {
    // (a kind without an enemy sheet — not an ENEMY_KINDS entry — returns below)
    const kind = /** @type {EnemyKind} */ (g.kind);
    const sheet = this.sheets.get(kind);
    if (!sheet) return;
    const def = scaledDef(kind, g.level ?? 1, !!g.elite);
    const tm = this.tileMap;
    /** @type {(x: number, z: number) => boolean} */
    const walk = def.flier
      ? (x, z) => tm.isWalkable(x, z) || tm.getWaterSurface(x, z) !== null
      : (x, z) => this.standable(x, z);
    const spots = enemyStartPoints(g, walk);
    const arena = kind === 'golem' ? new BossArena(g, this) : null;
    if (arena) this.arenas.push(arena);
    spots.forEach(([x, z], index) => {
      const e = this._createEnemy({
        uid: `${g.id}#${index}`, group: g, index, kind, level: def.level, elite: !!g.elite,
        name: g.name || (g.elite ? `Elite ${def.name}` : def.name), home: { x, z }, def, sheet, arena, isAdd: false,
      });
      if (e.boss) this._boss ??= e;
    });
  }

  /** @param {Omit<EnemyInit, 'sprite'|'rng'|'tagSlot'>} init @returns {Enemy} */
  _createEnemy(init) {
    const sprite = new Sprite3D(init.sheet, { ...CHARACTER_SPRITE_OPTS, ...init.sheet.spriteOptions, combatFx: true });
    sprite.position.set(init.home.x, this.groundAt(init.home.x, init.home.z), init.home.z);
    const e = createEnemy({ ...init, sprite, rng: new RNG((hashString(init.uid) ^ this.seedValue) >>> 0), tagSlot: this.enemies.length + 1 });
    if (!init.isAdd && !e.boss && init.group) {
      // the zone of its group's centre (COMBAT-19: wake, sight aggro and leash stay in the zone);
      // the rect grows to hold the whole home disc (a pack at a region's edge)
      const gx = Number(init.group.x);
      const gz = Number(init.group.z);
      e.zone = this.zoneAt(gx, gz, this.groundAt(gx, gz));
      if (e.zone >= 0) {
        const r = this.zones[e.zone];
        const R = e.homeRadius;
        e.zoneRect = { minX: Math.min(r.minX, gx - R), maxX: Math.max(r.maxX, gx + R), minZ: Math.min(r.minZ, gz - R), maxZ: Math.max(r.maxZ, gz + R) };
      }
    }
    this.scene.add(sprite);
    this.spriteManager.add(sprite);
    this.actorSprites.push(sprite);
    this.enemies.push(e);
    this._groupOf.set(e, init.group);
    if (!init.isAdd && init.group) {
      const g = /** @type {LevelObjectOf<'enemy'>} */ (init.group);
      const list = this._members.get(g);
      if (list) list.push(e);
      else this._members.set(g, [e]);
    }
    e._barT = -Infinity;
    return e;
  }

  /**
   * The boss's pool of 6 bats (level 5, no XP, no loot, never return), hidden until spawnAdd.
   * @param {Enemy} boss
   */
  _createAdds(boss) {
    const sheet = this.sheets.get('bat');
    if (!sheet) return;
    const def = scaledDef('bat', ADD_LEVEL, false);
    const a = boss.arena;
    const list = [];
    for (let i = 0; i < ADDS_PER_BOSS; i++) {
      const home = a ? { x: a.center.x, z: a.center.z } : { x: boss.home.x, z: boss.home.z };
      const e = this._createEnemy({
        uid: `${boss.uid}:add#${i}`, group: this._groupOf.get(boss), index: i, kind: 'bat', level: ADD_LEVEL, elite: false,
        name: def.name, home, def, sheet, arena: null, isAdd: true,
      });
      e._boss = boss;
      this._hideAdd(e);
      list.push(e);
    }
    this._addsOf.set(boss, list);
  }

  /**
   * Out of play: a pooled add not spawned, or a foe of a group the story has taken away.
   * @param {Enemy} e
   */
  _hideAdd(e) {
    e.sleep();
    e.aggro = false;
    e.sprite.opacity = 0;
    e.sprite.visible = false;
    this._hidden.add(e);
  }

  // =============================================================================================
  // UI and maps
  // =============================================================================================

  /**
   * (Re)build the enemies' walk grid from the tile map as it is now: objects the story brought or
   * took away (StoryRunner.applyPresence) — a bridge, a wall of crates — are walked around. With a
   * `rect` (world units: the union of the colliders and walk surfaces that changed, as
   * `World.applyStory` returns it) only the cells a change there can reach are recomputed
   * (`Nav.buildRect`: the same grid as a full build, a fraction of a millisecond for a bridge);
   * without one, the whole grid.
   * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }|null} [rect]
   */
  rebuildNav(rect = null) {
    if (!this.nav) return;
    if (rect) this.nav.buildRect(rect.minX, rect.maxX, rect.minZ, rect.maxZ);
    else this.nav.build((x, z) => this._inArena(x, z));
  }

  /**
   * The walk grid's closed ground: inside an arena (grown 0.5 u, the other enemies' exclusion, §7.6)
   * whose boss's group is there.
   * @param {number} x
   * @param {number} z
   * @returns {boolean}
   */
  _inArena(x, z) {
    for (const a of this.arenas) if (a.present && a.containsGrown(x, z, 0.5)) return true;
    return false;
  }

  /** Legend (keyboard or pad), vitals, skill slots (after `ui.hud.setControls(CONTROLS)`). */
  setupUI() {
    const hud = this.ui.combat?.hud;
    this._device = null;
    this._syncDevice();
    // (the names translated by id: rules.js SKILLS stays English; `unlock`: a locked slot's plate)
    hud?.configureSkills([
      ...SKILLS.map((K) => ({ id: K.id, label: t(`combat.skill.${K.id}`), keys: K.keys, padKeys: K.padKeys, icon: K.icon, unlock: K.unlock })),
      { id: 'draught', label: t('combat.skill.draught'), keys: 'C/4', padKeys: 'Y', icon: 'draught' },
    ]);
    this._skillArgs = [0, 1, 2, 3].map(() => ({ cooldown: 0, seconds: 0, left: 0, locked: false, affordable: true }));
    // a click on a slot casts it (a press through the combat input: buffer, guards, refusals)
    if (hud) hud.onSlotPress = (i) => this.cin.press(i < SKILLS.length ? SKILLS[i].id : 'draught');
    this._vitals = { hp: 0, hpMax: 0, mp: 0, mpMax: 0, sp: 0, spMax: 0, level: 1, xp: 0, xpNext: 1, winded: false };
    this._updateHud(0);
  }

  /**
   * End of `Game._setupMaps`: the minimap's enemy dots, chest markers only once discovered, the
   * boss marker at each undefeated arena.
   * @param {{ markers: { x: number, z: number, kind: string }[], enemies?: PointXZ[] }} map the
   *   shared minimap / world-map state
   */
  attachMaps(map) {
    this._map = map;
    map.enemies = this.minimapEnemies;
    for (let i = map.markers.length - 1; i >= 0; i--) if (map.markers[i].kind === 'chest') map.markers.splice(i, 1);
    this.chests.markers = map.markers;
    for (const c of this.chests.list) if (c.discovered) map.markers.push(c.marker);
    for (const a of this.arenas) {
      const m = { x: a.center.x, z: a.center.z, kind: 'boss', arena: a };
      // (the maps skip a hidden marker: an arena whose group the story took away)
      Object.defineProperty(m, 'hidden', { get: () => !a.present, enumerable: true });
      this._bossMarkers.push(m);
      map.markers.push(m);
    }
  }

  // =============================================================================================
  // Warm-up (§19)
  // =============================================================================================

  /**
   * Before `Game._compileScene()`: upload every combat texture, one FxQuads / GroundMarkers
   * instance far below the world (kept through the warm frames), one particle of every burst.
   * @param {THREE.Vector3} far
   */
  warmup(far) {
    const r = this.engine.renderer;
    /** @type {(t: THREE.Texture|null|undefined) => void} */
    const init = (t) => { try { if (t) r.initTexture(t); } catch { /* not a texture */ } };
    for (const s of this.sheets.values()) init(s.texture);
    init(this.player.sheet?.texture);
    // the companions already here (a level built with the party: travel, a kept level)
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
    // the pools only combat made (the game's warm-up made the level's own before): `dispose` frees them
    this._ownPools = this.particles.burstPools().filter((p) => !before.has(p));
  }

  /** After the warm frames: free the warm instances, record the program count. */
  endWarmup() {
    if (this._warmQuad >= 0) this.quads.free(this._warmQuad);
    if (this._warmMarker >= 0) this.markers.free(this._warmMarker);
    this._warmQuad = -1;
    this._warmMarker = -1;
    this.quads.update();
    this.markers.update();
    this.programsAtLoad = this.engine.renderer.info.programs?.length ?? 0;
  }

  // =============================================================================================
  // The combat context (§9.2)
  // =============================================================================================

  /** The one context every enemy update receives (types: ./types.d.ts). @returns {CombatContext} */
  _makeContext() {
    const sys = this;
    return {
      time: 0,
      frame: 0,
      player: this._pv,
      tileMap: this.tileMap,
      moveGround: (e, dx, dz) => sys._moveGround(e, dx, dz),
      moveFly: (e, dx, dz) => sys._moveFly(e, dx, dz),
      groundAt: (x, z) => sys.tileMap.getHeight(x, z),
      walkable: (x, z) => sys.standable(x, z),
      los: (ax, az, bx, bz) => sys.los(ax, az, bx, bz),
      onScreen: (x, y, z) => sys.projectNdc(x, y, z, sys._ndc, 0.92),
      requestToken: (e) => sys._requestToken(e),
      releaseToken: (e) => sys._releaseToken(e),
      hitbox: (e, spec) => { sys.enemyHits.add(e, spec); },
      projectile: (e, spec) => sys.spawnProjectile(e, spec),
      marker: (spec) => sys._markerAlloc(sys._cur, spec),
      setMarker: (h, spec) => sys._markerSet(h, spec),
      freeMarker: (h) => sys._markerFree(h),
      fx: (name, x, y, z, opts) => sys.fx.play(name, x, y, z, opts),
      burst: (preset, x, y, z, count) => sys.burst(preset, x, y, z, count),
      sfx: (name, x, z, opts) => sys.sfxAt(name, x, z, opts),
      shake: (amp, dur) => sys.shake(amp, dur),
      heal: (target, amount) => sys._healEnemy(target, amount),
      alert: (e) => sys.ui.combat?.labels.alert(e.position, sys.labelY(e)),
      wakeGroup: (e) => sys._wakeGroup(e),
      /** The walk grid (Nav.js; set once the enemies are created): paths for chase and return. */
      nav: null,
      enemiesNear: (x, z, r, out) => sys._enemiesNear(x, z, r, out),
      // (the casts allow the one extra argument each, see SpawnAddCall / OnSignalCall)
      spawnAdd: (kind, x, z, level) => /** @type {SpawnAddCall} */ (sys._spawnAdd)(sys._cur, kind, x, z, level),
      emit: (event, e, a, b) => /** @type {OnSignalCall} */ (sys._onSignal)(event, e, a, b),
    };
  }

  /**
   * Ground height.
   * @param {number} x
   * @param {number} z
   * @returns {number}
   */
  groundAt(x, z) {
    return this.tileMap.getHeight(x, z);
  }

  /**
   * Index of the first level region containing (x, z) — the location plate's rule (Game
   * `_updateRegion`): a region with `minY` holds only ground above that height (`y`; omitted: any)
   * — or -1: none.
   * @param {number} x
   * @param {number} z
   * @param {number|null} [y]
   * @returns {number}
   */
  zoneAt(x, z, y = null) {
    const zs = this.zones;
    if (!zs) return -1;
    for (let i = 0; i < zs.length; i++) {
      const r = zs[i];
      if (x >= r.minX && x < r.maxX && z >= r.minZ && z < r.maxZ && (r.minY == null || y == null || y > r.minY)) return i;
    }
    return -1;
  }

  /**
   * Standable: walkable and not water (bridges count).
   * @param {number} x
   * @param {number} z
   * @returns {boolean}
   */
  standable(x, z) {
    const tm = this.tileMap;
    if (!tm.isWalkable(x, z)) return false;
    // a walk surface (bridge deck) over water is ground; open water is not
    const t = tm.tileAt(Math.floor(x), Math.floor(z));
    return !(t && t.water) || tm.getHeight(x, z) > (t.waterSurface ?? -Infinity);
  }

  /**
   * Body-band base of an enemy (fliers: the live hover height).
   * @param {Enemy} e
   * @returns {number}
   */
  bodyBase(e) {
    return e.position.y + (e.flier ? e.hover ?? 0 : 0);
  }

  /**
   * Height (u above the feet) for the enemy's bar and '!' alert.
   * @param {Enemy} e
   * @returns {number}
   */
  labelY(e) {
    return e.def.labelY ?? 2;
  }

  /**
   * World y of an enemy's damage numbers: above its HP bar (the bar is anchored at `labelY`;
   * numbers under it ran into the bar), an elite's name plate included; the boss (no world bar)
   * just above its body.
   * @param {Enemy} e
   * @returns {number}
   */
  numberY(e) {
    if (e.boss) return this.bodyBase(e) + e.def.body[1] + 0.2;
    return e.position.y + this.labelY(e) + NUMBER_OVER_BAR + (e.elite ? 0.3 : 0);
  }

  /**
   * The hit / crit star of a player hit. Normally on the body just in front of the target; when
   * the target stands behind the player on screen (up-screen attacks, the main direction of
   * travel) the star moves to the target's head top and a little aside along the camera's right
   * axis, so it no longer crowns the player's own head (a landed hit read as being struck).
   * @param {Enemy} e
   * @param {boolean} crit
   * @param {number} dx
   * @param {number} dz
   */
  _impactStar(e, crit, dx, dz) {
    const x = e.position.x;
    const z = e.position.z;
    const hy = this.bodyBase(e);
    const top = e.def.body[1];
    let sx = x - dx * 0.2;
    let sy = hy + (top - 1.0) * 0.5;
    let sz = z - dz * 0.2;
    const m = this.engine.camera.matrixWorld.elements;
    // camera right (column 0) and forward (−column 2) on XZ
    const rx = m[0];
    const rz = m[2];
    let fx = -m[8];
    let fz = -m[10];
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl;
    fz /= fl;
    const P = this.player.position;
    const ex = x - P.x;
    const ez = z - P.z;
    const depth = ex * fx + ez * fz;
    const lateral = ex * rx + ez * rz;
    const behind = depth > 0.3 && Math.abs(lateral) < 1.2;
    if (behind) {
      const side = lateral >= 0 ? 1 : -1;
      sx = x + rx * 0.6 * side;
      sz = z + rz * 0.6 * side;
      sy = hy + top + 0.4 - 1.0; // the effects add their lift (1.0)
    }
    this.fx.play(crit ? 'crit' : 'impact', sx, sy, sz, behind ? STAR_SMALL : undefined);
  }

  /**
   * Straight-shot line of sight (§7.6): from `groundAt(a) + 0.9` to `groundAt(b) + 0.9`, blocked
   * where the ground rises above the line − 0.1 or inside a static collider (samples every 0.25 u).
   * @param {number} ax
   * @param {number} az
   * @param {number} bx
   * @param {number} bz
   * @returns {boolean}
   */
  los(ax, az, bx, bz) {
    const tm = this.tileMap;
    const ya = tm.getHeight(ax, az) + SHOT_Y;
    const yb = tm.getHeight(bx, bz) + SHOT_Y;
    const dx = bx - ax;
    const dz = bz - az;
    const d = Math.hypot(dx, dz);
    if (d < 0.3) return true;
    const cs = tm.queryColliders(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), this._losCs ??= []);
    for (let s = 0.25; s < d - 0.2; s += 0.25) {
      const u = s / d;
      const x = ax + dx * u;
      const z = az + dz * u;
      const y = ya + (yb - ya) * u;
      if (tm.getHeight(x, z) > y - 0.1) return false;
      for (let i = 0; i < cs.length; i++) {
        const c = cs[i];
        if (c.dynamic) continue;
        if (c.type === 'circle') {
          const ex = x - c.x;
          const ez = z - c.z;
          if (ex * ex + ez * ez < c.r * c.r) return false;
        } else if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return false;
      }
    }
    return true;
  }

  /** Cache the camera's view-projection (the matrix rendered last frame; §9.1). */
  _cacheViewProjection() {
    const cam = this.engine.camera;
    _vp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this._vpe.set(_vp.elements);
  }

  /**
   * Project a world point with the cached view-projection into `out` ({x, y} NDC).
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {{ x: number, y: number }} out
   * @param {number} [limit]
   * @returns {boolean} in front of the camera and within ±limit
   */
  projectNdc(x, y, z, out, limit = 1) {
    const m = this._vpe;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w <= 1e-6) {
      out.x = out.y = 99;
      return false;
    }
    out.x = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    out.y = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    return Math.abs(out.x) <= limit && Math.abs(out.y) <= limit;
  }

  /**
   * World-space move input into `out` ({x, z} unit); returns its magnitude (0..1).
   * @param {PointXZ} out
   * @returns {number}
   */
  moveWorld(out) {
    const mo = this.player.moveOverride;
    let mx;
    let mz;
    if (mo) {
      mx = mo.x;
      mz = mo.z;
    } else {
      const mv = this.input.getMoveVector();
      const { forward, right } = this.rig.getMoveBasis();
      mx = right.x * mv.x + forward.x * mv.y;
      mz = right.z * mv.x + forward.z * mv.y;
      const mag = Math.min(1, Math.hypot(mv.x, mv.y));
      const l = Math.hypot(mx, mz);
      if (l < 1e-6 || mag < 1e-3) { out.x = 0; out.z = 0; return 0; }
      out.x = mx / l;
      out.z = mz / l;
      return mag;
    }
    const l = Math.hypot(mx, mz);
    if (l < 1e-6) { out.x = 0; out.z = 0; return 0; }
    out.x = mx / l;
    out.z = mz / l;
    return Math.min(1, l);
  }

  /**
   * The mouse aim point (the `aim` hook's override first): the camera ray through the pointer on
   * the plane y = player.y + 0.8. Returns false when there is none.
   * @param {{x:number, z:number}} out
   * @returns {boolean}
   */
  aimPoint(out) {
    if (this.aimOverride) {
      out.x = this.aimOverride.x;
      out.z = this.aimOverride.z;
      return true;
    }
    const canvas = this.engine.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const pt = this.input.pointer;
    if (!rect.width || !rect.height) return false;
    _ndc2.set(((pt.x - rect.left) / rect.width) * 2 - 1, -((pt.y - rect.top) / rect.height) * 2 + 1);
    _ray.setFromCamera(_ndc2, this.engine.camera);
    _plane.set(_v.set(0, 1, 0), -(this.player.position.y + 0.8));
    const hit = _ray.ray.intersectPlane(_plane, _v);
    if (!hit) return false;
    out.x = hit.x;
    out.z = hit.z;
    return true;
  }

  // ---- movement (§7.6) ----

  /**
   * tileMap.move with the move radius; blockedBy; the arena exclusion for every other enemy.
   * @param {Enemy} e
   * @param {number} dx
   * @param {number} dz
   * @returns {number} the fraction moved
   */
  _moveGround(e, dx, dz) {
    const len = Math.hypot(dx, dz);
    e.blockedBy = null;
    if (len < 1e-9) return 1;
    const p = e.position;
    const out = this.tileMap.move(p, dx, dz, e.def.moveRadius ?? 0.3, 0.55, this._moveOut ??= { x: 0, z: 0 });
    let nx = out.x;
    let nz = out.z;
    const excluded = !e.boss && !e.isAdd;
    if (excluded && this.arenas.length) {
      for (const a of this.arenas) {
        if (a.present && a.containsGrown(nx, nz, 0.5) && !a.containsGrown(p.x, p.z, 0.5)) {
          // stop where the path enters the grown rect
          let lo = 0;
          let hi = 1;
          for (let k = 0; k < 10; k++) {
            const m = (lo + hi) / 2;
            if (a.containsGrown(p.x + (nx - p.x) * m, p.z + (nz - p.z) * m, 0.5)) hi = m; else lo = m;
          }
          nx = p.x + (nx - p.x) * lo;
          nz = p.z + (nz - p.z) * lo;
          e.blockedBy = 'arena';
        }
      }
    }
    const moved = Math.hypot(nx - p.x, nz - p.z);
    const frac = Math.min(1, moved / len);
    if (!e.blockedBy && frac < 0.999) e.blockedBy = this._blockKind(p.x, p.z, dx / len, dz / len, e.def.moveRadius ?? 0.3);
    p.x = nx;
    p.z = nz;
    return frac;
  }

  /**
   * What stopped a ground move: a static collider ahead, or terrain.
   * @param {number} x
   * @param {number} z
   * @param {number} ux
   * @param {number} uz
   * @param {number} r
   * @returns {'collider'|'terrain'}
   */
  _blockKind(x, z, ux, uz, r) {
    const tm = this.tileMap;
    const ax = x + ux * (r + 0.2);
    const az = z + uz * (r + 0.2);
    const cs = tm.queryColliders(ax - 0.3, az - 0.3, ax + 0.3, az + 0.3, this._blkCs ??= []);
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c.type === 'circle') {
        const ex = ax - c.x;
        const ez = az - c.z;
        const rr = c.r + 0.15;
        if (ex * ex + ez * ez < rr * rr) return 'collider';
      } else if (ax > c.minX - 0.15 && ax < c.maxX + 0.15 && az > c.minZ - 0.15 && az < c.maxZ + 0.15) return 'collider';
    }
    return 'terrain';
  }

  /**
   * Fliers: free movement clamped to home ± (radius + 8) (adds: their arena), the map, the arena
   * exclusion.
   * @param {Enemy} e
   * @param {number} dx
   * @param {number} dz
   */
  _moveFly(e, dx, dz) {
    const p = e.position;
    const tm = this.tileMap;
    e.blockedBy = null;
    let nx = p.x + dx;
    let nz = p.z + dz;
    if (e.isAdd && e._boss?.arena) {
      const r = e._boss.arena.rect;
      nx = clamp(nx, r.minX + 0.5, r.maxX - 0.5);
      nz = clamp(nz, r.minZ + 0.5, r.maxZ - 0.5);
    } else {
      const R = (Number(this._groupOf.get(e)?.radius) || 3) + 8;
      nx = clamp(nx, e.home.x - R, e.home.x + R);
      nz = clamp(nz, e.home.z - R, e.home.z + R);
    }
    nx = clamp(nx, 0.3, tm.width - 0.3);
    nz = clamp(nz, 0.3, tm.depth - 0.3);
    if (!e.boss && !e.isAdd) {
      for (const a of this.arenas) {
        if (a.present && a.containsGrown(nx, nz, 0.5) && !a.containsGrown(p.x, p.z, 0.5)) {
          nx = p.x;
          nz = p.z;
          e.blockedBy = 'arena';
        }
      }
    }
    if (!e.blockedBy && (Math.abs(nx - (p.x + dx)) > 1e-6 || Math.abs(nz - (p.z + dz)) > 1e-6)) e.blockedBy = 'terrain';
    p.x = nx;
    p.z = nz;
  }

  // ---- tokens (§7.5) ----

  /** @param {Enemy} e @returns {boolean} */
  _requestToken(e) {
    const t = e.def.token;
    if (!t) return false;
    if (e.token) return true;
    // the player fights a boss inside its closed arena: nobody from outside attacks
    if (this._pv.sealed && !e.boss && !e.isAdd) return false;
    const budget = BUDGETS[t.type] ?? 0;
    if (this._tokens[t.type] + t.cost > budget) return false;
    this._tokens[t.type] += t.cost;
    e.token = true;
    return true;
  }

  /** @param {Enemy} e */
  _releaseToken(e) {
    const t = e.def.token;
    if (!t || !e.token) return;
    this._tokens[t.type] = Math.max(0, this._tokens[t.type] - t.cost);
    e.token = false;
  }

  // ---- markers: slot table with generations (a freed handle held by a brain is ignored) ----

  /**
   * @param {Enemy|'core'|null} owner
   * @param {Partial<MarkerSpec>|null} spec
   * @returns {number} handle or −1
   */
  _markerAlloc(owner, spec) {
    let slot = -1;
    for (let i = 0; i < MARKER_SLOTS; i++) if (this._mk[i].h < 0) { slot = i; break; }
    if (slot < 0) return -1;
    const h = this.markers.alloc();
    if (h < 0) return -1;
    const m = this._mk[slot];
    m.h = h;
    m.owner = owner ?? null;
    m.gen = (m.gen + 1) & 0x3ffff;
    const s = m.spec;
    for (let k = 0; k < MARKER_KEYS.length; k++) s[MARKER_KEYS[k]] = MARKER_DEFAULTS[MARKER_KEYS[k]];
    this._markerCopy(s, spec);
    this.markers.set(h, s);
    return m.gen * 64 + slot;
  }

  /** @param {number} id @returns {MarkerSlot|null} */
  _markerSlot(id) {
    if (!(id >= 0)) return null;
    const m = this._mk[id % 64];
    if (!m || m.h < 0 || m.gen !== Math.floor(id / 64)) return null;
    return m;
  }

  /** @param {Required<MarkerSpec>} s @param {Partial<MarkerSpec>|null} spec */
  _markerCopy(s, spec) {
    if (!spec) return;
    for (let k = 0; k < MARKER_KEYS.length; k++) {
      const key = MARKER_KEYS[k];
      const v = spec[key];
      if (v !== undefined) s[key] = v;
    }
  }

  /** @param {number} id @param {Partial<MarkerSpec>} spec */
  _markerSet(id, spec) {
    const m = this._markerSlot(id);
    if (!m) return;
    this._markerCopy(m.spec, spec);
    this.markers.set(m.h, m.spec);
  }

  /** @param {number} id */
  _markerFree(id) {
    const m = this._markerSlot(id);
    if (!m) return;
    this.markers.free(m.h);
    m.h = -1;
    m.owner = null;
  }

  /**
   * Free every marker of `owner` (an enemy sent home) or, with null, every enemy marker.
   * @param {Enemy|null} owner
   */
  _freeMarkersOf(owner) {
    for (const m of this._mk) {
      if (m.h < 0 || m.owner === 'core') continue;
      // (cast: TS narrowed 'core' away above, which makes the null case's re-test always true)
      if (owner === null ? /** @type {MarkerSlot['owner']} */ (m.owner) !== 'core' : m.owner === owner) {
        this.markers.free(m.h);
        m.h = -1;
        m.owner = null;
      }
    }
  }

  /**
   * Core-owned markers (lock ring, nova ring, the arena barrier).
   * @returns {number}
   */
  markerAllocCore() { return this._markerAlloc('core', null); }
  /** @param {number} id @param {Partial<MarkerSpec>} spec */
  markerSetCore(id, spec) { this._markerSet(id, spec); }
  /** @param {number} id */
  markerFreeCore(id) { this._markerFree(id); }

  get markerCount() {
    let n = 0;
    for (const m of this._mk) if (m.h >= 0) n++;
    return n;
  }

  // ---- feedback helpers ----

  /**
   * @param {string} preset
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} count
   */
  burst(preset, x, y, z, count) {
    this.particles.burst(preset, _v.set(x, y, z), Math.max(0, Math.min(24, count | 0)));
  }

  /**
   * A combat sound at a world point: pan by its screen x (±0.8), volume 1 within 6 u of the
   * player → 0 at 30 u, pitch jitter ±4 % from hash2(position, frame).
   * @param {SfxName} name
   * @param {number} x
   * @param {number} z
   * @param {SfxOptions} [opts]
   */
  sfxAt(name, x, z, opts) {
    const p = this.player.position;
    const d = Math.hypot(x - p.x, z - p.z);
    const vol = d <= 6 ? 1 : Math.max(0, 1 - (d - 6) / 24);
    if (vol <= 0.01) return;
    this.projectNdc(x, p.y + 1, z, this._ndc, 1);
    const pan = clamp(Number.isFinite(this._ndc.x) ? this._ndc.x : 0, -0.8, 0.8);
    const j = (hash2(Math.floor(x * 16), Math.floor(z * 16), this.frame) - 0.5) * 0.08;
    this.audio.playSfx(name, { volume: vol * (opts?.volume ?? 1), pitch: (opts?.pitch ?? 1) * (1 + j), pan });
  }

  /** @param {number} amp @param {number} dur */
  shake(amp, dur) {
    this.rig.shake(amp, dur);
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {string} text
   * @param {'crit'|'dmg'|'guard'|'heal'|'hurt'|'mp'|'perfect'} kind
   */
  number(x, y, z, text, kind) {
    this.ui.combat?.labels.number(x, y, z, text, kind);
  }

  /**
   * A companion's damage number (`ALLY_NUMBER`: the kind WorldLabels draws it in).
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {string} text
   */
  allyNumber(x, y, z, text) {
    this.ui.combat?.labels.number(x, y, z, text, ALLY_NUMBER);
  }

  /** @param {number} seconds @param {Enemy|'player'} [victim] */
  _hitStop(seconds, victim) {
    if (seconds > this.stop) this.stop = seconds;
    if (victim && !this._stopVictims.includes(victim)) this._stopVictims.push(victim);
  }

  /**
   * Slow motion (combat real time): scales for `time` s (the stronger slow wins).
   * @param {number} playerScale
   * @param {number} enemyScale
   * @param {number} time
   */
  _slowMotion(playerScale, enemyScale, time) {
    if (this._slow > 0 && enemyScale > this.enemyScale && playerScale >= this.playerScale) return;
    this.playerScale = playerScale;
    this.enemyScale = enemyScale;
    this._slow = time;
  }

  // =============================================================================================
  // Frame
  // =============================================================================================

  /**
   * Input → player action, enemies, projectiles, hits — in `n = ceil(dt·60 − EPS)` sub-steps.
   * Inactive (title, dialog, map, photo, death screen): nothing advances.
   * @param {number} dt
   * @param {boolean} active
   */
  update(dt, active) {
    if (!this._ready) return;
    const t0 = performance.now();
    this._tickT = 0;
    if (!active) {
      this._wasActive = false;
      return;
    }
    const resuming = !this._wasActive;
    this._wasActive = true;
    this._cacheViewProjection();
    this.cin.collect(dt, resuming);
    if (this.cin.lockEvent && this.pc.alive) this.targeting.onLockEvent(this.cin.lockEvent);
    this._advanced = 0;
    this._realAdvanced = 0;
    const n = Math.max(1, Math.ceil(dt / SUBSTEP - EPS));
    const h = dt / n;
    for (let k = 0; k < n; k++) this._substep(h);
    this._tickT += performance.now() - t0;
  }

  /** @param {number} h */
  _substep(h) {
    this.frame++;
    this.ctx.frame = this.frame;
    this.clock += h;
    if (this.stop > 0) {
      this.stop = Math.max(0, this.stop - h);
      return;
    }
    this._realAdvanced += h;
    if (this._slow > 0) {
      this._slow -= h;
      if (this._slow <= EPS) {
        this._slow = 0;
        this.playerScale = 1;
        this.enemyScale = 1;
      }
    }
    const hp = h * this.playerScale;
    const he = h * this.enemyScale;
    this._advanced += hp;
    this.enemyTime += he;
    this.ctx.time = this.enemyTime;
    this._syncPlayerView();

    // player (the input buffer counts down after the decision: a press lives 10 full frames)
    this.pc.step(hp);
    this.cin.tick(h);
    this._syncPlayerView();

    // the companions (PARTY.md §5.1: after the player's kit, on the player's time scale)
    const allies = this.allies;
    if (allies.length) {
      this.allySearches = 1;
      for (let i = 0; i < allies.length; i++) allies[i].step(hp);
    }

    // enemies (each sees its target as `ctx.player`: the player's view, or a companion's)
    this.nav.beginStep(NAV_SEARCHES);
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dormant) continue;
      if (!e.alive && e.sprite.opacity <= 0.001) continue;
      if (this.freezeAI && e.alive) {
        // frozen AI (tests): only the hit flash keeps decaying (the enemy writes its own uFlash)
        e.decayFlash(he);
        continue;
      }
      this._cur = e;
      if (e.target) this._retarget(e, he);
      const t = e.target;
      if (t) {
        // (back to the player's view whatever the brain does: a throw must not leave the next
        // enemies — and every later sub-step — seeing the companion as the player)
        this.ctx.player = t.view;
        try {
          e.update(he, this.ctx);
        } finally {
          this.ctx.player = this._pv;
        }
      } else e.update(he, this.ctx);
    }
    this._cur = null;

    // projectiles, hits, timers
    this.projectiles.step(hp, he);
    this._resolve();
    this._timersStep(he);
    this.tags.sweep(this.stepNo);
    this.playerHits.clear();
    this.enemyHits.clear();
    this.allyHits.clear();
    this._contactN = 0;
    this.stepNo++;
  }

  _syncPlayerView() {
    const v = this._pv;
    const pc = this.pc;
    v.facing.x = this.player.facing.x;
    v.facing.z = this.player.facing.z;
    v.alive = pc.alive;
    v.invulnerable = pc.invulnerable || this.god;
    v.dodging = pc.dodging;
    v.action = pc.action;
    v.swing = pc.swings;
    // a closed arena holds the player inside (the clamp of afterPlayer; a knockback slide may
    // cross the rect for a sub-step): while one is closed the player is sealed in with its boss
    let sealed = false;
    for (let i = 0; i < this.arenas.length; i++) if (this.arenas[i].active) { sealed = true; break; }
    v.sealed = sealed;
  }

  /**
   * An enemy whose target is a companion (PARTY.md §5.3): back to the player at once when the
   * companion is down or gone (or the player fell, or it walks home); every `ALLY.checkTarget` s,
   * once the hold of `ALLY.holdTarget` s is over, back to the player when the player is clearly
   * nearer (< `ALLY.playerNearer` × the companion's distance); a companion that falls back
   * (`mode` 'retreat') is let go as soon as the player is the nearer, hold or not.
   * @param {Enemy} e
   * @param {number} he enemy-scaled seconds
   */
  _retarget(e, he) {
    const t = e.target;
    if (!t) return;
    if (t.gone || t.down || !e.alive || !this.pc.alive || e.state === 'return' || e.boss || e.isAdd) {
      e.target = null;
      return;
    }
    e.targetHold -= he;
    e.targetCheck -= he;
    if (e.targetCheck > 0) return;
    e.targetCheck += ALLY.checkTarget;
    if (e.targetCheck <= 0) e.targetCheck = ALLY.checkTarget;
    // (a companion falling back behind the player — its `retreat` rule — leaves its foes to the
    // player: the hold does not keep them on it, and the player only has to be the nearer)
    const back = t.mode === 'retreat';
    if (e.targetHold > 0 && !back) return;
    const P = this.player.position;
    const q = t.position;
    const dA = Math.hypot(e.position.x - q.x, e.position.z - q.z);
    const dP = Math.hypot(e.position.x - P.x, e.position.z - P.z);
    if (dP < (back ? 1 : ALLY.playerNearer) * dA) e.target = null;
  }

  /**
   * A companion hit an enemy (PARTY.md §5.3): it turns on the companion when the companion is
   * nearer to it than `ALLY.threat` × the player's distance — an archer or a shaman (a ranged foe)
   * also when the companion's shot came from within `ALLY.rangedAggro` u — and holds it ≥
   * `ALLY.holdTarget` s (another hit renews the hold). The boss and its adds stay on the player; a
   * foe held on another companion stays.
   * @param {Enemy} e
   * @param {MemberCombat} a
   * @param {'melee'|'skill'|'projectile'} [source] the companion's hit
   */
  _allyAggro(e, a, source = 'melee') {
    if (e.boss || e.isAdd || e.passive || !e.alive || a.down || a.gone) return;
    if (e.target === a) {
      e.targetHold = Math.max(e.targetHold, ALLY.holdTarget);
      return;
    }
    if (e.target && e.targetHold > 0) return;
    const P = this.player.position;
    const q = a.position;
    const dA = Math.hypot(e.position.x - q.x, e.position.z - q.z);
    const dP = Math.hypot(e.position.x - P.x, e.position.z - P.z);
    const shotBack = source === 'projectile' && e.def.token?.type === 'ranged' && dA <= ALLY.rangedAggro;
    if (dA < dP * ALLY.threat || shotBack) {
      e.target = a;
      e.targetHold = ALLY.holdTarget;
      e.targetCheck = ALLY.checkTarget;
      this.events.emit('allyTargeted', e, a.id);
    }
  }

  /**
   * A companion went down: the foes after it turn back to the player (at once, not at their next
   * check), and it is announced (`allyDown`).
   * @param {MemberCombat} a
   */
  onAllyDown(a) {
    for (const e of this.enemies) if (e.target === a) e.target = null;
    this.events.emit('allyDown', a.id);
  }

  /**
   * Per-sub-step timers: the dummies' refill (120 f after the last hit), the intro lock.
   * @param {number} he enemy-scaled seconds
   */
  _timersStep(he) {
    if (this._introT > 0) {
      this._introT -= he;
      if (this._introT <= 0) this._introT = 0;
    }
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.kind === 'dummy' && e.alive && e.hp < e.hpMax && this.enemyTime - (e._refillFrom ?? 0) >= DUMMY_REFILL - EPS) e.hp = e.hpMax;
    }
  }

  // =============================================================================================
  // Hits (§6.3, §9.1 step 5)
  // =============================================================================================

  /**
   * Queue a player hitbox for this sub-step (meta: PLAYER_HIT_META entry; swing: MP bookkeeping).
   * @param {HitSpec} spec
   * @param {PlayerHitMeta} meta
   * @param {SwingRecord|null} swing
   * @returns {Required<HitSpec>}
   */
  addPlayerHit(spec, meta, swing) {
    const s = this.playerHits.add('player', spec);
    const it = this.playerHits.items[this.playerHits.length - 1];
    it.meta = meta;
    it.swing = swing;
    return s;
  }

  /**
   * A companion's hitbox for this sub-step (resolved after the player's, with its ATK).
   * @param {MemberCombat} a
   * @param {HitSpec} spec
   * @param {'melee'|'skill'|'projectile'} source
   */
  addAllyHit(a, spec, source) {
    this.allyHits.add(a, spec);
    const it = this.allyHits.items[this.allyHits.length - 1];
    it.meta = ALLY_HIT_META[source] ?? ALLY_HIT_META.melee;
    it.swing = null;
  }

  /**
   * A companion's shot: a player-side projectile (it tests the enemies, on the player's time
   * scale) owned by the companion.
   * @param {MemberCombat} a
   * @param {ProjectileSpec} spec
   * @returns {number} handle, or −1
   */
  spawnAllyProjectile(a, spec) {
    return this.projectiles.spawn('player', spec, a);
  }

  /**
   * @param {Enemy|'player'|'fx'} owner
   * @param {ProjectileSpec} spec
   * @returns {number} handle, or −1
   */
  spawnProjectile(owner, spec) {
    return this.projectiles.spawn(owner, spec);
  }

  /** @returns {ProjectileContact} */
  _contact() {
    if (this._contactN === this._contacts.length) {
      this._contacts.push({ p: null, target: null, x: 0, y: 0, z: 0, dirX: 0, dirZ: 1, mv: 1, kb: 0, poise: 0, tag: 0, owner: null, splash: null, splashTag: 0, kind: '', player: false, ally: null });
    }
    return this._contacts[this._contactN++];
  }

  /**
   * A projectile touched a target (resolved in order after every contact of the sub-step): an
   * enemy (player-side shots, a companion's too), the player or a companion (enemy shots).
   * @param {LiveProjectile} p
   * @param {Enemy|'player'|MemberCombat} target
   */
  queueProjectileHit(p, target) {
    const c = this._contact();
    c.target = target;
    c.x = p.x;
    c.y = p.y;
    c.z = p.z;
    c.dirX = p.dirX;
    c.dirZ = p.dirZ;
    c.mv = p.mv;
    c.kb = p.kb;
    c.poise = p.poise;
    c.tag = p.tag;
    c.owner = /** @type {Enemy|'player'|MemberCombat} */ (p.owner); // ('fx' shots never touch: Projectiles._contact)
    c.splash = p.splash;
    c.splashTag = p.splashTag;
    c.kind = p.kind;
    c.player = p.player;
    c.ally = p.ally;
    this.tags.add(p.tag, target, this.stepNo);
  }

  /**
   * An Ember Bolt that hit a wall splashes (no primary target).
   * @param {LiveProjectile} p
   */
  queueSplash(p) {
    if (p.ally) this._allySplash(p.ally, p.x, p.y, p.z, p.splash, null, p.tag, p.splashTag);
    else this._splash(p.x, p.y, p.z, p.splash, null, p.tag, p.splashTag);
  }

  /**
   * An arc projectile landed: a circle hit at its target (melee height rule).
   * @param {LiveProjectile} p
   */
  queueLanding(p) {
    const s = this._landSpec ??= /** @type {HitSpec} */ ({});
    s.shape = 'circle';
    s.x = p.arc.tx;
    s.y = p.ty;
    s.z = p.arc.tz;
    s.r = p.radius;
    s.dy = MELEE_DY;
    s.mv = p.mv;
    s.kb = p.kb;
    s.poise = p.poise;
    s.knockdown = false;
    s.flat = 0;
    s.thin = false;
    s.tag = p.tag;
    s.fromX = p.arc.tx;
    s.fromZ = p.arc.tz;
    if (p.owner !== 'fx') this.enemyHits.add(p.owner, s);
    this.fx.play('dust', s.x, s.y, s.z, { scale: 1.6 });
    this.burst('emberBurst', s.x, s.y + 0.2, s.z, 8);
    this.sfxAt('slam', s.x, s.z, { volume: 0.7 });
  }

  _resolve() {
    const S = this.stepNo;
    const list = this.enemies;
    // 1. player hitboxes vs enemies (enemy order)
    const ph = this.playerHits;
    for (let k = 0; k < ph.length; k++) {
      const it = ph.items[k];
      const spec = it.spec;
      this.tags.touch(spec.tag, S);
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || e.dormant || !e.sprite.visible) continue;
        if (this.tags.has(spec.tag, e)) continue;
        if (!hitOverlaps(spec, e.position.x, e.position.y, e.position.z, e.radius)) continue;
        this.tags.add(spec.tag, e, S);
        this._hitEnemy(e, spec.mv, spec.kb, spec.poise, spec.knockdown && !e.boss,
          Number.isFinite(spec.fromX) ? spec.fromX : spec.x, Number.isFinite(spec.fromZ) ? spec.fromZ : spec.z, it.meta, it.swing, spec.tag);
      }
    }
    // 1b. the companions' hitboxes vs enemies (PARTY.md §5.2; no friendly fire)
    const ah = this.allyHits;
    for (let k = 0; k < ah.length; k++) {
      const it = ah.items[k];
      const spec = it.spec;
      const a = /** @type {MemberCombat} */ (it.owner);
      this.tags.touch(spec.tag, S);
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || e.dormant || !e.sprite.visible) continue;
        if (this.tags.has(spec.tag, e)) continue;
        if (!hitOverlaps(spec, e.position.x, e.position.y, e.position.z, e.radius)) continue;
        this.tags.add(spec.tag, e, S);
        this._allyHitEnemy(a, e, spec.mv, spec.kb, spec.poise, spec.knockdown && !e.boss,
          Number.isFinite(spec.fromX) ? spec.fromX : spec.x, Number.isFinite(spec.fromZ) ? spec.fromZ : spec.z, it.meta.source, spec.tag);
      }
    }
    // 2. player projectiles vs enemies (a companion's shots too)
    for (let k = 0; k < this._contactN; k++) {
      const c = this._contacts[k];
      if (!c.player || c.target === 'player') continue;
      // (a player-side shot only ever touches enemies: Projectiles._contact)
      const e = /** @type {Enemy} */ (c.target);
      if (!e.alive) continue;
      if (c.ally) {
        this._allyShotHit(c, e);
        continue;
      }
      this._hitEnemy(e, c.mv, c.kb, c.poise, false, c.x - c.dirX, c.z - c.dirZ, PLAYER_HIT_META.bolt, null, c.tag);
      if (c.splash) this._splash(c.x, c.y, c.z, c.splash, e, c.tag, c.splashTag);
      this.fx.play('impact', c.x, c.y - 1.0, c.z);
      this.burst('emberBurst', c.x, c.y, c.z, 8);
      this.sfxAt('boltHit', c.x, c.z);
    }
    // 3. enemy hitboxes vs the player
    const eh = this.enemyHits;
    const pp = this.player.position;
    for (let k = 0; k < eh.length; k++) {
      const it = eh.items[k];
      const spec = it.spec;
      this.tags.touch(spec.tag, S);
      if (!this.pc.alive || this.tags.has(spec.tag, 'player')) continue;
      if (!hitOverlaps(spec, pp.x, pp.y, pp.z, this.pc.radius)) continue;
      if (this.god) continue;
      if (!this.pc.hittable) {
        // (a magma tick is no attack to dodge)
        if (!(spec.flat > 0)) this.pc.notePerfectDodge();
        continue;
      }
      this.tags.add(spec.tag, 'player', S);
      this._hitPlayer(/** @type {Enemy} */ (it.owner), spec.mv, spec.kb, spec.knockdown, spec.flat,
        Number.isFinite(spec.fromX) ? spec.fromX : spec.x, Number.isFinite(spec.fromZ) ? spec.fromZ : spec.z);
    }
    // 4. enemy projectiles vs the player
    for (let k = 0; k < this._contactN; k++) {
      const c = this._contacts[k];
      if (c.player || c.target !== 'player') continue;
      if (!this.pc.alive || this.god) continue;
      if (!this.pc.hittable) {
        this.pc.notePerfectDodge();
        continue;
      }
      // (an enemy shot: its owner is the enemy)
      this._hitPlayer(/** @type {Enemy} */ (c.owner), c.mv, c.kb, false, 0, c.x - c.dirX, c.z - c.dirZ, 'projectile');
      this.sfxAt('arrowHit', c.x, c.z);
    }
    if (this.allies.length) this._resolveAllies(S);
  }

  /**
   * Enemy hitboxes and shots against the companions (PARTY.md §5.3), after the player: one hit per
   * tag per companion; a companion with i-frames (rolling, after a hit) or down is passed through.
   * @param {number} S the sub-step
   */
  _resolveAllies(S) {
    const A = this.allies;
    // 3b. enemy hitboxes
    const eh = this.enemyHits;
    for (let k = 0; k < eh.length; k++) {
      const it = eh.items[k];
      const spec = it.spec;
      for (let i = 0; i < A.length; i++) {
        const a = A[i];
        if (!a.present || this.tags.has(spec.tag, a)) continue;
        const q = a.position;
        if (!hitOverlaps(spec, q.x, q.y, q.z, ALLY.radius)) continue;
        if (!a.hittable) continue;
        this.tags.add(spec.tag, a, S);
        this._hitAlly(a, /** @type {Enemy} */ (it.owner), spec.mv, spec.kb, spec.knockdown, spec.flat,
          Number.isFinite(spec.fromX) ? spec.fromX : spec.x, Number.isFinite(spec.fromZ) ? spec.fromZ : spec.z);
      }
    }
    // 4b. enemy shots (Projectiles._contact queued them with the companion as the target)
    for (let k = 0; k < this._contactN; k++) {
      const c = this._contacts[k];
      if (c.player || !c.target || c.target === 'player' || !(/** @type {MemberCombat} */ (c.target).isAlly)) continue;
      const a = /** @type {MemberCombat} */ (c.target);
      if (!a.hittable) continue;
      this._hitAlly(a, /** @type {Enemy} */ (c.owner), c.mv, c.kb, false, 0, c.x - c.dirX, c.z - c.dirZ);
      this.sfxAt('arrowHit', c.x, c.z, { volume: 0.7 });
    }
  }

  /**
   * An enemy hit on a companion: flat damage (magma) or the player's formula against the
   * companion's DEF (its own RNG), hit stun / knockdown / down; a number in the hurt colour, sparks
   * and a sound — no hit-stop, shake or vignette (those are the player's). Event `allyHurt`.
   * @param {MemberCombat} a
   * @param {Enemy|null} owner
   * @param {number} mv
   * @param {number} kb
   * @param {boolean} knockdown
   * @param {number} flat
   * @param {number} fromX
   * @param {number} fromZ
   */
  _hitAlly(a, owner, mv, kb, knockdown, flat, fromX, fromZ) {
    const p = a.position;
    let dx = p.x - fromX;
    let dz = p.z - fromZ;
    const dl = Math.hypot(dx, dz);
    if (dl > 1e-6) { dx /= dl; dz /= dl; } else { dx = -a.member.facing.x; dz = -a.member.facing.z; }
    if (flat > 0) {
      a.hurtFlat(flat);
      this.number(p.x, p.y + 1.9, p.z, String(flat), 'hurt');
      this.events.emit('allyHurt', a.id, flat);
      return;
    }
    if (!(mv > 0)) {
      if (kb > 0) a.shove(kb, dx, dz);
      return;
    }
    const atk = owner?.def?.atk ?? 10;
    const roll = 0.92 + 0.16 * a.rng.next();
    const damage = Math.max(1, Math.round(atk * mv * roll * mitigation(a.def)));
    a.takeHit(damage, kb, dx, dz, knockdown);
    this.number(p.x, p.y + 1.9, p.z, String(damage), 'hurt');
    this.sfxAt('hurt', p.x, p.z, { volume: 0.55, pitch: 1.15 });
    this.burst('hitSpark', p.x, p.y + 1.0, p.z, 5);
    this.events.emit('allyHurt', a.id, damage);
  }

  /**
   * A companion's hit (a hitbox, a shot, a splash) on an enemy (PARTY.md §5.1–5.3): the player's
   * damage formula with the companion's ATK and its own RNG (crits: base, rear, exposed), the
   * boss's floors; the kill gives the player XP and loot and counts; the foe may turn on the
   * companion. A companion's damage number (`ALLY_NUMBER`), a smaller star and sound — no
   * hit-stop or shake. Events `allyHit` (id, enemy, damage, crit) and, on a kill, `allyKill`.
   * @param {MemberCombat} a
   * @param {Enemy} e
   * @param {number} mv
   * @param {number} kb
   * @param {number} poise
   * @param {boolean} knockdown
   * @param {number} fromX
   * @param {number} fromZ
   * @param {'melee'|'skill'|'projectile'} source
   * @param {number} tag
   */
  _allyHitEnemy(a, e, mv, kb, poise, knockdown, fromX, fromZ, source, tag) {
    if (a.gone) return;
    let dx = e.position.x - fromX;
    let dz = e.position.z - fromZ;
    const dl = Math.hypot(dx, dz);
    if (dl > 1e-6) { dx /= dl; dz /= dl; } else { dx = a.member.facing.x; dz = a.member.facing.z; }
    const info = this._allyInfo ??= {
      damage: 0, crit: false, mv: 0, kb: 0, kbDirX: 0, kbDirZ: 0, poise: 0, knockdown: false, source: 'melee', tag: 0, guarded: false,
    };
    info.mv = mv;
    info.kb = kb;
    info.kbDirX = dx;
    info.kbDirZ = dz;
    info.poise = poise;
    info.knockdown = knockdown;
    info.source = source;
    info.tag = tag;
    const x = e.position.x;
    const z = e.position.z;
    const yNum = this.numberY(e);
    if (e.guarded) {
      info.damage = 0;
      info.crit = false;
      info.guarded = true;
      e.receiveHit(info, this.ctx);
      this.number(x, yNum, z, 'Guard', 'guard');
      this.sfxAt('guard', x, z, { volume: 0.5 });
      this.burst('hitSpark', x, this.bodyBase(e) + 0.9, z, 3);
      return;
    }
    info.guarded = false;
    const roll = 0.92 + 0.16 * a.rng.next();
    const critRoll = a.rng.next();
    const rear = dx * e.facing.x + dz * e.facing.z > 0.3;
    const exposed = !!e.exposed || e.state === 'stagger' || e.state === 'stun';
    const kneel = e.boss && (typeof e.hpFloor === 'number'
      ? e.state === 'kneel'
      : !!this._kneel && this._kneel.boss === e && this.enemyTime < this._kneel.until);
    const chance = CRIT.base + (rear ? CRIT.rear : 0) + (exposed ? CRIT.exposed : 0);
    const crit = kneel || critRoll < chance;
    let damage = Math.max(1, Math.round(a.atk * mv * roll * mitigation(e.def.def ?? 0) * (crit ? CRIT.mult : 1) * (e.vuln || 1)));
    if (e.boss) damage = this._bossClamp(e, damage, kneel);
    e.hp = Math.max(0, e.hp - damage);
    info.damage = damage;
    info.crit = crit;
    e.hitFlash = ENEMY_FLASH_TIME;
    e._barT = this.clock;
    if (e.kind === 'dummy') e._refillFrom = this.enemyTime;
    a.counts.hits++;
    a.counts.damageDealt += damage;
    if (crit) a.counts.crits++;
    if (e.hp <= 0) {
      this._kill(e);
      a.kills++;
      this.events.emit('allyKill', a.id, e);
    } else {
      e.receiveHit(info, this.ctx);
      this._allyAggro(e, a, source);
    }
    const hy = this.bodyBase(e);
    this.allyNumber(x, yNum, z, damage > 0 ? String(damage) : 'Guard');
    this.fx.play(crit ? 'crit' : 'impact', x - dx * 0.2, hy + (e.def.body[1] - 1.0) * 0.5, z - dz * 0.2, ALLY_STAR);
    this.burst('hitSpark', x - dx * 0.25, hy + Math.min(1.1, e.def.body[1] * 0.55), z - dz * 0.25, crit ? 7 : 4);
    this.sfxAt(crit ? 'crit' : 'hit', x, z, { volume: ALLY_HIT_SFX_VOLUME });
    this.events.emit('allyHit', a.id, e, damage, crit);
  }

  /**
   * A companion's shot reached an enemy: the hit, a bolt's splash, its impact look and sound.
   * @param {ProjectileContact} c
   * @param {Enemy} e
   */
  _allyShotHit(c, e) {
    const a = c.ally;
    this._allyHitEnemy(a, e, c.mv, c.kb, c.poise, false, c.x - c.dirX, c.z - c.dirZ, 'projectile', c.tag);
    if (c.splash) this._allySplash(a, c.x, c.y, c.z, c.splash, e, c.tag, c.splashTag);
    if (c.kind === 'emberBolt') {
      this.fx.play('impact', c.x, c.y - 1.0, c.z, { scale: 0.8 });
      this.burst('emberBurst', c.x, c.y, c.z, 6);
      this.sfxAt('boltHit', c.x, c.z, { volume: 0.7 });
    } else this.sfxAt('arrowHit', c.x, c.z, { volume: 0.6 });
  }

  /**
   * A companion's bolt splash (as `_splash`, with the companion's ATK).
   * @param {MemberCombat} a
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {Splash} splash
   * @param {Enemy|null} primary
   * @param {number} tag
   * @param {number} splashTag
   */
  _allySplash(a, x, y, z, splash, primary, tag, splashTag) {
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e === primary || !e.alive || e.dormant || !e.sprite.visible) continue;
      const d = Math.hypot(e.position.x - x, e.position.z - z);
      if (d >= splash.r + e.radius) continue;
      const b = e.def.body;
      const base = this.bodyBase(e);
      if (y < base + b[0] - splash.r || y > base + b[1] + splash.r) continue;
      if (this.tags.has(splashTag, e)) continue;
      this.tags.add(splashTag, e, this.stepNo);
      this._allyHitEnemy(a, e, splash.mv, 0.4, 0, false, x, z, 'projectile', tag);
    }
  }

  /**
   * Damage a companion directly (the `allyHurt` hook; no RNG, no reaction but going down).
   * @param {MemberCombat} a
   * @param {number} n
   * @returns {number} its HP after
   */
  hurtAlly(a, n) {
    if (!a || a.gone || a.down) return a ? Math.ceil(a.hp) : 0;
    const d = Math.max(0, Math.round(Number(n) || 0));
    const p = a.position;
    this.number(p.x, p.y + 1.9, p.z, String(d), 'hurt');
    a.hp = Math.max(0, a.hp - d);
    a.counts.damageTaken += d;
    if (a.hp <= 0) a._goDown();
    return Math.ceil(a.hp);
  }

  /**
   * Ember Bolt splash: r 1.0 at mv 0.6 around the impact (not the primary target); `splashTag`
   * (the projectile's precomputed `<tag>:s`) keeps it to one splash hit per enemy.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {Splash} splash
   * @param {Enemy|null} primary
   * @param {number} tag
   * @param {number} splashTag
   */
  _splash(x, y, z, splash, primary, tag, splashTag) {
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e === primary || !e.alive || e.dormant || !e.sprite.visible) continue;
      const d = Math.hypot(e.position.x - x, e.position.z - z);
      if (d >= splash.r + e.radius) continue;
      const b = e.def.body;
      const base = this.bodyBase(e);
      if (y < base + b[0] - splash.r || y > base + b[1] + splash.r) continue;
      if (this.tags.has(splashTag, e)) continue;
      this.tags.add(splashTag, e, this.stepNo);
      this._hitEnemy(e, splash.mv, 0.4, 0, false, x, z, PLAYER_HIT_META.bolt, null, tag);
    }
  }

  /**
   * A player hit on an enemy: guard, damage (combat RNG draws #1 roll, #2 crit), boss floors,
   * flash, reactions or death, numbers, sparks, hit-stop, shake, MP.
   * @param {Enemy} e
   * @param {number} mv
   * @param {number} kb
   * @param {number} poise
   * @param {boolean} knockdown
   * @param {number} fromX
   * @param {number} fromZ
   * @param {PlayerHitMeta} meta
   * @param {SwingRecord|null} swing
   * @param {number} tag
   */
  _hitEnemy(e, mv, kb, poise, knockdown, fromX, fromZ, meta, swing, tag) {
    const pc = this.pc;
    // (a companion with `attack: assist` goes for a foe the player hit lately)
    e.playerHitAt = this.clock;
    let dx = e.position.x - fromX;
    let dz = e.position.z - fromZ;
    const dl = Math.hypot(dx, dz);
    if (dl > 1e-6) { dx /= dl; dz /= dl; } else { dx = this.player.facing.x; dz = this.player.facing.z; }
    const info = this._info ??= {
      damage: 0, crit: false, mv: 0, kb: 0, kbDirX: 0, kbDirZ: 0, poise: 0, knockdown: false, source: 'melee', tag: 0, guarded: false,
    };
    info.mv = mv;
    info.kb = kb;
    info.kbDirX = dx;
    info.kbDirZ = dz;
    info.poise = poise;
    info.knockdown = knockdown;
    info.source = meta.source;
    info.tag = tag;
    const x = e.position.x;
    const z = e.position.z;
    const yNum = this.numberY(e);
    if (e.guarded) {
      info.damage = 0;
      info.crit = false;
      info.guarded = true;
      e.receiveHit(info, this.ctx);
      this.number(x, yNum, z, 'Guard', 'guard');
      this.sfxAt('guard', x, z, { volume: 0.8 });
      this.burst('hitSpark', x, this.bodyBase(e) + 0.9, z, 4);
      this._hitStop(F(HIT_STOP.guard), e);
      return;
    }
    info.guarded = false;
    // damage (§6.3)
    const roll = 0.92 + 0.16 * this.rng.next();
    const critRoll = this.rng.next();
    const rear = dx * e.facing.x + dz * e.facing.z > 0.3;
    const exposed = !!e.exposed || e.state === 'stagger' || e.state === 'stun';
    // the phase-3 exposed core: the boss's own 'kneel' state (a brain without one: the 90 f
    // window after the bossPhase(3) signal)
    const kneel = e.boss && (typeof e.hpFloor === 'number'
      ? e.state === 'kneel'
      : !!this._kneel && this._kneel.boss === e && this.enemyTime < this._kneel.until);
    const chance = CRIT.base + (rear ? CRIT.rear : 0) + (exposed ? CRIT.exposed : 0) + (meta.finisher ? CRIT.finisher : 0);
    const crit = kneel || critRoll < chance;
    let damage = Math.max(1, Math.round(pc.atk * mv * roll * mitigation(e.def.def ?? 0) * (crit ? CRIT.mult : 1) * (e.vuln || 1)));
    if (e.boss) damage = this._bossClamp(e, damage, kneel);
    const kill = damage >= e.hp;
    e.hp = Math.max(0, e.hp - damage);
    info.damage = damage;
    info.crit = crit;
    e.hitFlash = ENEMY_FLASH_TIME;
    e._barT = this.clock;
    if (e.kind === 'dummy') e._refillFrom = this.enemyTime;
    // reactions / death
    if (e.hp <= 0) this._kill(e);
    else e.receiveHit(info, this.ctx);
    // feedback
    const hy = this.bodyBase(e);
    if (damage > 0) this.number(x, yNum, z, String(damage), crit ? 'crit' : 'dmg');
    else this.number(x, yNum, z, 'Guard', 'guard');
    this._impactStar(e, crit, dx, dz);
    this.burst('hitSpark', x - dx * 0.25, hy + Math.min(1.1, e.def.body[1] * 0.55), z - dz * 0.25, crit ? 10 : 6);
    this.sfxAt(crit ? 'crit' : 'hit', x, z, { volume: 0.9 });
    const stopBase = e.boss ? HIT_STOP.boss : meta.stop;
    this._hitStop(playerHitStop(stopBase, crit, kill && e.hp <= 0, e.boss), e);
    const sh = crit ? SHAKE.crit : meta.finisher ? SHAKE.finisher : kill ? SHAKE.kill : SHAKE.hit;
    this.shake(sh[0], sh[1]);
    if (meta.source === 'melee') pc.onMeleeLanded(swing);
    if (meta.combo === 3 && e.kind === 'dummy') this.tutorial.combo = true;
    this.events.emit('hit', e, damage, crit, meta.source);
  }

  /**
   * The boss's HP floors (§8.3): never below the next phase threshold while it is pending or
   * running, and at most 8 % of max HP during the phase-3 kneel. The Enemy's own `hpFloor`
   * (when it provides one) is authoritative.
   * @param {Enemy} e
   * @param {number} damage
   * @param {boolean} kneel
   * @returns {number}
   */
  _bossClamp(e, damage, kneel) {
    let floor = 0;
    if (typeof e.hpFloor === 'number') floor = e.hpFloor;
    else {
      const ph = e.def.phases ?? [0.7, 0.35];
      const phase = Math.max(e.phase || 1, this._bossPhaseSeen ?? 1);
      if (phase <= ph.length) floor = Math.ceil(e.hpMax * ph[phase - 1]);
      if (kneel) floor = Math.max(floor, e.hp - Math.max(0, this._kneel.cap - this._kneel.taken));
    }
    if (kneel && typeof e.hpFloor !== 'number') {
      const room = Math.max(0, this._kneel.cap - this._kneel.taken);
      damage = Math.min(damage, room);
    }
    damage = Math.max(0, Math.min(damage, e.hp - floor));
    if (kneel && this._kneel) this._kneel.taken += damage;
    return damage;
  }

  /**
   * An enemy's HP reached 0: die, XP, loot, events; the boss's victory.
   * @param {Enemy} e
   * @param {{ loot?: boolean }} [opts] loot: XP and loot (false: remaining adds)
   */
  _kill(e, { loot = true } = {}) {
    const x = e.position.x;
    const y = e.position.y;
    const z = e.position.z;
    e.die(this.ctx);
    this._releaseToken(e);
    this.fx.stopFollowing(e.position);
    this.kills += e.passive ? 0 : 1;
    this.sfxAt('enemyDie', x, z, { volume: 0.9 });
    const rewarded = loot && !e.passive && !e.isAdd;
    if (rewarded) {
      this._bossKillXp = e.boss;
      this.pc.gainXp(e.def.xp ?? 0);
      this._bossKillXp = false;
      if (e.boss) this._bossLoot(e);
      else this._dropLoot(e, x, y, z);
    }
    e.deathCount++;
    this.events.emit('kill', e);
    if (e.boss) this._bossDefeated(e);
  }

  /** @param {Enemy} e @param {number} x @param {number} y @param {number} z */
  _dropLoot(e, x, y, z) {
    const rng = lootRng(e.uid, e.deathCount, this.seedValue);
    const r = rollLoot(e.def, rng, this.pc.hp < this.pc.hpMax * HEART_BOOST_HP, this._loot ??= { gold: 0, heart: false, mana: false, draught: false });
    this.dropGold(r.gold, x, y, z, rng);
    if (r.heart) this.pickups.drop('heart', 1, x, y, z, rng);
    if (r.mana) this.pickups.drop('mana', 1, x, y, z, rng);
    if (r.draught) this.pickups.drop('draught', 1, x, y, z, rng);
  }

  /**
   * Gold as coin pickups (25 / 5 / 1, at most 6).
   * @param {number} gold
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {RNG} rng
   */
  dropGold(gold, x, y, z, rng) {
    if (!(gold > 0)) return;
    const coins = this._coins ??= Array.from({ length: 6 }, () => ({ kind: 'coin1', amount: 0 }));
    const n = splitCoins(gold, coins);
    for (let i = 0; i < n; i++) this.pickups.drop(coins[i].kind, coins[i].amount, x, y, z, rng);
  }

  /**
   * Would this pickup give the player anything now? A heart at full HP, a mana mote at full MP
   * and a draught at the carry cap stay on the ground (§7.8; Pickups asks before magnetising,
   * every frame of the magnet and before collecting).
   * @param {string} kind
   * @returns {boolean}
   */
  wantsPickup(kind) {
    const pc = this.pc;
    if (kind === 'heart') return pc.hp < pc.hpMax;
    if (kind === 'mana') return pc.mp < pc.mpMax - EPS;
    if (kind === 'draught') return pc.potions < POTION_MAX;
    return true;
  }

  /**
   * An upgrade as the loot feed and its toast name it ("Max HP +20", "Cinderheart Core · Max HP
   * +20"), in the page's language.
   * @param {string} what 'maxHp' | 'maxMp' | 'attack' | 'core'
   * @returns {string}
   */
  upgradeText(what) {
    if (what === 'maxHp') return t('combat.upgrade.maxHp', { n: UPGRADES.maxHp });
    if (what === 'maxMp') return t('combat.upgrade.maxMp', { n: UPGRADES.maxMp });
    if (what === 'attack') return t('combat.upgrade.attack', { n: UPGRADES.attack });
    if (what === 'core') return `${t('combat.upgrade.core')}${sep()}${t('combat.upgrade.maxHp', { n: UPGRADES.core })}`;
    return t('combat.upgrade.other');
  }

  /**
   * An upgrade's toast as a sentence of the page's language ('最大HPが20上がった', not
   * '最大HP +20を手に入れた'; the English reads as before: "Obtained: Max HP +20").
   * @param {string} what 'maxHp' | 'maxMp' | 'attack' | 'core'
   * @returns {string}
   */
  _upgradeToast(what) {
    if (what === 'maxHp' || what === 'maxMp' || what === 'attack') return t(`combat.upgraded.${what}`, { n: UPGRADES[what] });
    if (what === 'core') return t('combat.upgraded.core', { item: t('combat.upgrade.core'), n: UPGRADES.core });
    return t('combat.obtained', { item: t('combat.upgrade.other') });
  }

  /**
   * An enemy's name as the player reads it (the bars of elites, the boss bar and banner),
   * translated at display — `e.name` stays the English (identity, `state()`): a named group's
   * name as a term (`term`, docs/specs/I18N.md §4.8), else its kind's name ("Elite …" for an
   * elite). Cached per enemy (the page's language never changes).
   * @param {Enemy} e
   * @returns {string}
   */
  displayName(e) {
    let n = this._shownNames.get(e);
    if (n !== undefined) return n;
    const key = `combat.enemy.${e.kind}`;
    const kindName = t(key);
    const base = kindName === key ? e.def.name : kindName;
    const g = e.isAdd ? null : /** @type {LevelObjectOf<'enemy'>|undefined} */ (this._groupOf.get(e));
    const own = g?.name ? String(g.name) : '';
    // a group named as its kind (Cinderwatch's 'Cinderheart') reads as the kind's name where the
    // content tables have no term for it (asked quietly: then the untranslated term is no miss)
    const shown = own ? quietly(() => term(own)) : '';
    const asKind = !!own && shown === own && own === e.def.name;
    if (own && !asKind) term(own);
    n = own ? (asKind ? base : shown) : e.elite ? t('combat.elite', { name: base }) : base;
    this._shownNames.set(e, n);
    return n;
  }

  /**
   * A pickup reached the player.
   * @param {string} kind
   * @param {number} amount
   * @param {string} extra an upgrade's kind
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {boolean} false when it gave nothing (it stays on the ground)
   */
  collectPickup(kind, amount, extra, x, y, z) {
    const pc = this.pc;
    const feed = this.ui.combat?.hud;
    const p = this.player.position;
    if (!this.wantsPickup(kind)) return false;
    if (kind.startsWith('coin')) {
      pc.gold += amount;
      feed?.loot(t('combat.loot.gold', { n: amount }), 'gold');
      this.audio.playSfx('coin', { volume: 0.55, pitch: kind === 'coin25' ? 0.85 : kind === 'coin5' ? 1 : 1.12 });
    } else if (kind === 'heart') {
      const got = pc.heal(Math.round(pc.hpMax * HEART_HEAL));
      feed?.loot(t('combat.loot.heart', { n: got }), 'heart');
      this.audio.playSfx('pickup', { volume: 0.6 });
    } else if (kind === 'mana') {
      const before = pc.mp;
      pc.mp = Math.min(pc.mpMax, pc.mp + MANA_MOTE);
      const got = Math.max(1, Math.round(pc.mp - before));
      if (got > 0) this.number(p.x, p.y + 1.9, p.z, `+${got}`, 'mp');
      feed?.loot(t('combat.loot.mana', { n: got }), 'mana');
      this.audio.playSfx('pickup', { volume: 0.6, pitch: 1.15 });
    } else if (kind === 'draught') {
      pc.potions = Math.min(POTION_MAX, pc.potions + 1);
      feed?.loot(t('combat.loot.draught'), 'draught');
      this.audio.playSfx('pickup', { volume: 0.7 });
    } else if (kind === 'upgrade' || kind === 'core') {
      const what = kind === 'core' ? 'core' : extra;
      pc.upgrade(/** @type {UpgradeKind} */ (what)); // (a chest's kind, checked when it was read)
      const text = this.upgradeText(what);
      feed?.loot(text, kind === 'core' ? 'core' : 'upgrade');
      this.ui.hud.toast(this._upgradeToast(what), 2.4);
      this.audio.playSfx('levelup', { volume: 0.5 });
      // (the level-up's sparkles, below the bloom threshold and around the head: the hdr-6
      // 'sparkle' on the chest whited the player out when the core was collected, COMBAT-16)
      this.burst('levelSparkle', p.x, p.y + 1.9, p.z, 12);
    }
    this.events.emit('pickup', kind, amount);
    return true;
  }

  /**
   * An enemy hit on the player (§6.3, §6.8): flat damage (magma) or ATK·mv·roll·mit, reaction,
   * hit-stop 6 f, shake, red flash, vignette pulse, SFX, number; events `hit('player', damage,
   * false, source)` (source 'melee' | 'projectile' | 'hazard' for flat damage) and `playerHurt`.
   * @param {Enemy|'player'|null} owner
   * @param {number} mv
   * @param {number} kb
   * @param {boolean} knockdown
   * @param {number} flat
   * @param {number} fromX
   * @param {number} fromZ
   * @param {'melee'|'projectile'} [source]
   */
  _hitPlayer(owner, mv, kb, knockdown, flat, fromX, fromZ, source = 'melee') {
    const pc = this.pc;
    const p = this.player.position;
    if (flat > 0) {
      pc.hurtFlat(flat);
      this.number(p.x, p.y + 1.9, p.z, String(flat), 'hurt');
      this.look.pulseHurt();
      this.events.emit('hit', 'player', flat, false, 'hazard');
      if (!pc.alive) return;
      this.events.emit('playerHurt', flat);
      return;
    }
    let dx = p.x - fromX;
    let dz = p.z - fromZ;
    const dl = Math.hypot(dx, dz);
    if (dl > 1e-6) { dx /= dl; dz /= dl; } else { dx = -this.player.facing.x; dz = -this.player.facing.z; }
    if (!(mv > 0)) {
      // a push without damage (the boss's phase-2 ring, mv 0, §8.3): the slide only
      if (kb > 0) pc.shove(kb, dx, dz);
      this.shake(SHAKE.hurt[0] * 0.6, SHAKE.hurt[1]);
      return;
    }
    const atk = owner && owner !== 'player' ? owner.def?.atk ?? 10 : 10;
    const roll = 0.92 + 0.16 * this.rng.next();
    const damage = Math.max(1, Math.round(atk * mv * roll * mitigation(pc.def)));
    const res = pc.hurt({ damage, kb, kbDirX: dx, kbDirZ: dz, knockdown });
    this.number(p.x, p.y + 1.9, p.z, String(damage), 'hurt');
    this.look.pulseHurt();
    this.sfxAt('hurt', p.x, p.z, { volume: 1 });
    this.burst('hitSpark', p.x, p.y + 1.0, p.z, 6);
    this._hitStop(F(HIT_STOP.playerHurt), 'player');
    const sh = res === 'knockdown' ? SHAKE.knockdown : SHAKE.hurt;
    this.shake(sh[0], sh[1]);
    this.events.emit('hit', 'player', damage, false, source);
    this.events.emit('playerHurt', damage);
  }

  /**
   * Mend (shaman): HP capped, green number, healGlow 8.
   * @param {Enemy} target
   * @param {number} amount
   */
  _healEnemy(target, amount) {
    if (!target || !target.alive) return;
    const before = target.hp;
    target.hp = Math.min(target.hpMax, target.hp + Math.max(0, amount));
    const got = Math.round(target.hp - before);
    const p = target.position;
    if (got > 0) this.number(p.x, this.bodyBase(target) + target.def.body[1] + 0.2, p.z, `+${got}`, 'heal');
    this.burst('healGlow', p.x, this.bodyBase(target) + 0.8, p.z, 8);
    target._barT = this.clock;
  }

  /**
   * A noticing enemy wakes its group and any enemy of its own zone within 6 u in line of sight
   * (COMBAT-19: never the pack of another zone; the quarry terrace's goblins, bats and west boar
   * are one zone and still wake together).
   * @param {Enemy} e
   */
  _wakeGroup(e) {
    const gid = e.groupId;
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o === e || !o.alive || o.isAdd || o.boss || this._hidden.has(o)) continue;
      if (o.groupId === gid && gid) o.wake(this.ctx);
      else if (!o.aggro && o.zone === e.zone && Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z) <= 6
        && this.los(e.position.x, e.position.z, o.position.x, o.position.z)) o.wake(this.ctx);
    }
  }

  /**
   * @param {number} x
   * @param {number} z
   * @param {number} r
   * @param {Enemy[]} [out]
   * @returns {Enemy[]}
   */
  _enemiesNear(x, z, r, out = []) {
    out.length = 0;
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || e.dormant || !e.sprite.visible) continue;
      if (Math.hypot(e.position.x - x, e.position.z - z) <= r) out.push(e);
    }
    return out;
  }

  /**
   * Boss adds: a pooled bat of `boss`, placed, shown and woken (null when the pool is used up).
   * @param {Enemy|null} boss
   * @param {EnemyKind} kind
   * @param {number} x
   * @param {number} z
   * @returns {Enemy|null}
   */
  _spawnAdd(boss, kind, x, z) {
    const pool = boss ? this._addsOf.get(boss) : null;
    if (!pool) return null;
    const e = pool.find((a) => a.kind === kind && (this._hidden.has(a) || (!a.alive && a.sprite.opacity <= 0.001)));
    if (!e) return null;
    this._hidden.delete(e);
    e.home.x = x;
    e.home.z = z;
    e.reset(this.ctx);
    e.dormant = false;
    e.wake(this.ctx);
    this.burst('deathPoof', x, this.groundAt(x, z) + 1.2, z, 8);
    return e;
  }

  // =============================================================================================
  // Boss signals (§8.1, §8.3)
  // =============================================================================================

  /**
   * @param {BossSignal} event
   * @param {Enemy} e
   * @param {number} [a] `bossPhase`: the new phase
   */
  _onSignal(event, e, a) {
    if (!e) return;
    const arena = /** @type {BossArena|null} */ (e.arena); // (core's enemies carry a BossArena)
    if (event === 'bossIntro') {
      arena?.close?.();
      this._introT = INTRO_LOCK;
      this._bossFight = e;
      this._bossAwake = false;
      this._fightStart = this.clock;
      this._phaseStart = [this.clock, 0, 0];
      this._phaseTimes = [0, 0, 0];
      this._bossPhaseSeen = 1;
      this.targeting.release();
      // every other enemy aggroed or inside the arena goes home (inside: at once)
      for (const o of this.enemies) {
        if (o === e || !o.alive || o._boss === e || this._hidden.has(o)) continue;
        const inside = arena?.contains ? arena.contains(o.position.x, o.position.z) : false;
        if (!o.aggro && !inside) continue;
        this._sendHome(o, inside);
      }
      this.projectiles.clearEnemy();
      // the companions near the player come in with them (PARTY.md §5.3)
      if (arena && this.allies.length) this._alliesIntoArena(arena);
    } else if (event === 'bossAwake') {
      this._bossAwake = true;
      // (shown translated: the group's name from the content tables, the epithet by kind)
      const shown = this.displayName(e);
      const ek = `combat.epithet.${e.kind}`;
      const epithet = e.def.epithet ? (t(ek) !== ek ? t(ek) : e.def.epithet) : '';
      this.ui.banner.show(shown || t('combat.enemy.golem'), epithet || t('combat.epithet.golem'), { duration: 3 });
      this.ui.combat?.boss.show({ name: shown, epithet, phases: 3 });
      this.ui.combat?.boss.set(e.hp / e.hpMax, 1);
      this.targeting.setBoss(e);
    } else if (event === 'bossPhase') {
      const n = Number(a) || 2;
      this._hitStop(F(HIT_STOP.bossPhase), e);
      this.look.pulsePhase();
      this._bossPhaseSeen = n;
      if (n >= 2 && n <= 3) {
        this._phaseTimes[n - 2] = this.clock - this._phaseStart[n - 2];
        this._phaseStart[n - 1] = this.clock;
      }
      this.ui.combat?.boss.set(e.hp / e.hpMax, n);
      if (n >= 2) {
        const i = this.arenas.indexOf(arena);
        if (i >= 0 && this._emitters[i]) this._emitters[i].enabled = true;
        this.music.setSection('B');
      }
      if (n === 3) this._kneel = { boss: e, until: this.enemyTime + KNEEL_TIME, cap: Math.round(e.hpMax * KNEEL_CAP), taken: 0 };
      this.events.emit('bossPhase', n);
    }
  }

  /**
   * The arena closes: every companion within `ALLY.arenaPull` u of the player is placed inside,
   * behind the player (fanned out, on standable ground within the rect); the others wait at the
   * gate (MemberCombat: `wait`) until it opens.
   * @param {BossArena} arena
   */
  _alliesIntoArena(arena) {
    const P = this.player.position;
    const f = this.player.facing;
    const r = arena.rect;
    let k = 0;
    for (const a of this.allies) {
      if (a.gone || !a.member.sprite) continue;
      const q = a.position;
      if (Math.hypot(q.x - P.x, q.z - P.z) > ALLY.arenaPull) continue;
      const side = (k % 2 === 0 ? 1 : -1) * (0.75 + 0.6 * Math.floor(k / 2));
      k++;
      let placed = false;
      for (const back of [1.4, 0.8, 0.3]) {
        const x = Math.min(r.maxX - 0.8, Math.max(r.minX + 0.8, P.x - f.x * back - f.z * side));
        const z = Math.min(r.maxZ - 0.8, Math.max(r.minZ + 0.8, P.z - f.z * back + f.x * side));
        if (!this.standable(x, z)) continue;
        a.placeAt(x, z);
        placed = true;
        break;
      }
      if (!placed) a.placeAt(Math.min(r.maxX - 0.8, Math.max(r.minX + 0.8, P.x)), Math.min(r.maxZ - 0.8, Math.max(r.minZ + 0.8, P.z)));
    }
  }

  /**
   * Send an enemy home (return, guarded); `now`: place it at home at once.
   * @param {Enemy} o
   * @param {boolean} now
   */
  _sendHome(o, now) {
    this._releaseToken(o);
    this._freeMarkersOf(o);
    this.projectiles.removeOwner(o);
    if (now) {
      o.reset(this.ctx);
      return;
    }
    if (typeof o.sendHome === 'function') o.sendHome(this.ctx);
    else o.reset(this.ctx);
  }

  /** @param {Enemy} e */
  _bossLoot(e) {
    // dropped 1.2 u beyond the boss from the player (like its death bursts, COMBAT-16): the coins'
    // arcs no longer glow over the player's head at the kill
    let x = e.position.x;
    let z = e.position.z;
    const P = this.player.position;
    const dx = x - P.x;
    const dz = z - P.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-3 && this.standable(x + (dx / d) * 1.2, z + (dz / d) * 1.2)) {
      x += (dx / d) * 1.2;
      z += (dz / d) * 1.2;
    }
    const y = this.groundAt(x, z);
    const rng = lootRng(e.uid, e.deathCount, this.seedValue);
    const g = e.def.gold ?? [150, 150];
    this.dropGold(Math.round(g[1]), x, y, z, rng);
    this.pickups.drop('core', 1, x, y, z, rng);
  }

  /** @param {Enemy} e */
  _bossDefeated(e) {
    const x = e.position.x;
    const y = e.position.y;
    const z = e.position.z;
    this._hitStop(F(HIT_STOP.bossDeath), e);
    this._slowMotion(0.4, 0.4, 1.5);
    // (COMBAT-16: dimmer bursts beyond the boss, so a kill in melee range leaves the player readable)
    if (e.arena?.deathBursts) e.arena.deathBursts(e);
    else {
      for (let k = 0; k < 3; k++) this.burst('emberBurst', x + (k - 1) * 0.8, y + 1.2 + k * 0.6, z, 24);
      this.burst('sparkle', x, y + 2, z, 24);
    }
    this.shake(SHAKE.bossDeath[0], SHAKE.bossDeath[1]);
    this.music.victory();
    e.arena?.open?.();
    this.bossDefeated = true;
    this._phaseTimes[Math.max(0, Math.min(2, (this._bossPhaseSeen ?? 1) - 1))] = this.clock - this._phaseStart[Math.max(0, Math.min(2, (this._bossPhaseSeen ?? 1) - 1))];
    this._fightTime = this.clock - this._fightStart;
    this._bossFight = null;
    this._bossAwake = false;
    this._kneel = null;
    this.targeting.setBoss(null);
    // remaining adds die without loot
    for (const a of this._addsOf.get(e) ?? []) if (a.alive && !this._hidden.has(a)) this._kill(a, { loot: false });
    this._dropBossMarker(e);
    this.events.emit('bossDefeated', e);
    // the banner once the slow motion eases, the results card 1.5 s after the stinger (§6.12)
    this._later(0.4, () => this.ui.banner.show(t('combat.victory.title'), t('combat.victory.sub'), { duration: 3.4 }));
    this._later(1.5, () => this._resultsCard());
    this._later(2.0, () => this.ui.combat?.boss.hide());
  }

  /**
   * The boss's arena marker leaves the map (its defeat).
   * @param {Enemy} e
   */
  _dropBossMarker(e) {
    for (let i = this._bossMarkers.length - 1; i >= 0; i--) {
      const m = this._bossMarkers[i];
      if (m.arena !== e.arena) continue;
      const k = this._map?.markers.indexOf(m) ?? -1;
      if (k >= 0) this._map.markers.splice(k, 1);
    }
  }

  _resultsCard() {
    const secs = Math.round(this.clock);
    const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const pc = this.pc;
    // (the level's name translated at display: `level.name` seeds the noise and stays English)
    const line = [mmss, tn('combat.results.foes', this.kills), tn('combat.results.falls', pc.deaths),
      tn('combat.results.dodges', pc.perfectDodges), t('combat.results.lv', { n: pc.level })].join(sep());
    this.ui.combat?.announcer.announce(t('combat.results.title', { place: term(this.level.name) }), line,
      { duration: 7, kind: 'results', y: this._announceAt('results') });
    // a level-up granted by the boss's kill: its card follows the results (the announcer queues)
    // and its pillar, sparkles and chime play now, not over the boss's death bursts (COMBAT-16)
    const lv = this._levelAfterResults;
    this._levelAfterResults = null;
    if (lv) {
      this.ui.combat?.announcer.announce(t('combat.level.title', { n: lv.level }), lv.gains, { duration: 2.6, kind: 'level', y: this._announceAt('level') });
      this._levelUpFlare();
    }
  }

  /**
   * Where an announcement's card goes (the Announcer's `y`, read when the card shows — it may wait
   * in the queue): below the area banner while one shows (a region's foes woken by entering it, a
   * kill levelling the player under 'MOSSY GLADE'; the VICTORY banner over the results card) — the
   * level card at 108 art px, the results window at 104, under the banner's lower rule (93–97) and
   * its shade —, else the card's own place (null).
   * @param {'level'|'results'} kind
   * @returns {() => (number|null)}
   */
  _announceAt(kind) {
    return () => (this.ui.banner?.visible ? (kind === 'results' ? 104 : 108) : null);
  }

  /**
   * Run `fn` after `seconds` of active combat (real time).
   * @param {number} seconds
   * @param {() => void} fn
   */
  _later(seconds, fn) {
    this._timers.push({ t: seconds, fn });
  }

  // =============================================================================================
  // Player events
  // =============================================================================================

  onPerfectDodge() {
    const p = this.player.position;
    this._slowMotion(1, PERFECT.enemyScale, PERFECT.time);
    this.number(p.x, p.y + 2.1, p.z, 'Perfect!', 'perfect');
    this.sfxAt('perfect', p.x, p.z, { volume: 1 });
    this.look.pulsePerfect();
    this.burst('sparkle', p.x, p.y + 1, p.z, 10);
  }

  /**
   * Level-up: the card (smaller and higher on screen while engaged, so it does not cover the
   * fight; after the results card when the boss's kill granted it), pillar, sparkles, SFX.
   * @param {number} level
   * @param {string} gains the card's text
   */
  onLevelUp(level, gains) {
    if (this._bossKillXp) {
      // (the boss's kill: card, pillar and sparkles wait for the results card, 1.5 s later)
      this._levelAfterResults = { level, gains };
    } else {
      this.ui.combat?.announcer.announce(t('combat.level.title', { n: level }), gains, { duration: 2.6, kind: 'level', compact: this.engaged, y: this._announceAt('level') });
      this._levelUpFlare();
    }
    // the party levels with the player: the companions are refreshed with it
    for (const a of this.allies) {
      a.syncLevel();
      if (a.down) continue;
      a.hp = a.hpMax;
      a.mp = a.mpMax;
    }
    this.events.emit('levelup', level);
  }

  /** The level-up pillar, sparkles and chime on the player. */
  _levelUpFlare() {
    const p = this.player.position;
    this.fx.play('pillar', p.x, p.y, p.z, { follow: p, duration: F(60) });
    this.burst('levelSparkle', p.x, p.y + 1.9, p.z, 14);
    this.sfxAt('levelup', p.x, p.z, { volume: 1 });
  }

  /**
   * Skill (or draught, i = 3) refused: the slot shakes, SFX cancel.
   * @param {number} i
   */
  refuseSkill(i) {
    this.audio.playSfx('cancel', { volume: 0.5 });
    this.ui.combat?.hud.refuse?.(i);
  }

  onPlayerDeath() {
    const p = this.player.position;
    this._slowMotion(0.3, 0.3, 1.0);
    this.look.startDeath();
    this.sfxAt('playerDown', p.x, p.z, { volume: 1 });
    this.music.death();
    this.targeting.release();
    this.cin.clearBuffer();
    this.locksPlayer = true;
    this._deathT = DEATH_SCREEN_DELAY;
    for (const e of this.enemies) {
      if (!e.alive || e.boss || e.isAdd || e.passive || this._hidden.has(e)) continue;
      if (e.aggro || e.token) this._sendHome(e, false);
    }
    // the companions stop where they stand (PARTY.md §5.3); no foe goes after them
    for (const e of this.enemies) e.target = null;
    for (const a of this.allies) a.onPlayerDeath();
    this.events.emit('playerDeath');
  }

  /**
   * The death screen → fade → reset → checkpoint (the restUntilMorning pattern, §6.11). The
   * `respawn()` test hook bumps `_deathGen` and resets at once; a death screen of an older
   * generation then stops after its await (it would otherwise reset and cut gold a second time).
   */
  async _deathScreen() {
    const game = this.game;
    const ui = this.ui;
    const cp = this.waystones.checkpoint;
    const place = placeName(cp);
    const gen = ++this._deathGen;
    game.busy = true;
    this._respawning = true;
    try {
      game.toggleMap(false);
      await ui.combat.death.show({ title: t('combat.death.title'), subtitle: '', prompt: t('combat.death.prompt', { place }), armDelay: 1.0 });
      if (game._disposed || gen !== this._deathGen) return;
      await ui.fader.fadeOut(0.8);
      if (game._disposed || gen !== this._deathGen) {
        ui.fader.fadeIn?.(0.3);
        return;
      }
      ui.combat.death.hide();
      // (read again: the story may have taken the stone away while the screen waited)
      const at = this.waystones.checkpoint;
      this.resetEncounter();
      this._respawnAt(at);
      await ui.fader.fadeIn(1.0);
      ui.hud.toast(t('combat.death.risen', { place: placeName(at) }), 2.4);
    } finally {
      if (gen === this._deathGen) {
        this._respawning = false;
        game.busy = false;
      }
    }
  }

  /**
   * Put the player at a checkpoint's stand point with the respawn i-frames and guard.
   * @param {Checkpoint} cp
   */
  _respawnAt(cp) {
    const stand = cp.stand ?? cp;
    this.game.teleport(stand.x, stand.z);
    this.pc.iframes = RESPAWN_IFRAMES;
    this.pc.blink = true;
    this.cin.respawnGuard = RESPAWN_GUARD;
    this.cin.clearBuffer();
    this.locksPlayer = false;
    this._deathT = -1;
    this.look.reset();
    this.music.respawn();
    this.events.emit('respawn', cp.id);
  }

  // =============================================================================================
  // After the player moved (§9.1)
  // =============================================================================================

  /**
   * Separation, arena clamp, pickups, checkpoints, chests, dormancy, lock-on / boss focus,
   * engagement, music, sprite speeds, legend, HUD, bars / pips / edge arrows, minimap.
   * @param {number} dt
   * @param {boolean} active
   */
  afterPlayer(dt, active) {
    if (!this._ready) return;
    const t0 = performance.now();
    const playing = this.game.mode === 'play';
    if (active) {
      this._playerVelocity(dt);
      this._separation();
      if (this.allies.length) this._allySeparation();
      this._arenaClamp();
      const adv = this._advanced;
      this.pickups.update(adv);
      const cm = this.engine.camera.matrixWorld.elements;
      const cl = Math.hypot(cm[8], cm[10]) || 1;
      this.fx.viewX = -cm[8] / cl;
      this.fx.viewZ = -cm[10] / cl;
      this.fx.update(this._realAdvanced);
      for (const a of this.arenas) a.update(dt);
      this.waystones.update(dt);
      this.chests.update(dt);
      this._dormancy(dt);
      this._engagement(dt);
      this.music.update(dt, this.engaged, !!this._bossFight && this._bossAwake);
      this.pc._applyVisuals(this._realAdvanced, this.clock);
      this._runTimers(dt);
      if (this._deathT > 0 && !this._respawning) {
        this._deathT -= dt;
        if (this._deathT <= 0) this._deathScreen().catch((err) => console.error('[combat] death screen failed:', err));
      }
      this._heartbeatStep(dt);
    }
    this.pc.refreshPose();
    for (let i = 0; i < this.allies.length; i++) this.allies[i].afterFrame(dt, active, playing, active ? this._realAdvanced : 0);
    this.locksPlayer = !this.pc.alive || this._respawning || this._introT > 0;
    this.targeting.update(dt, active);
    this._seeThrough(dt);
    this._spriteSpeeds(playing, active);
    this._jitterStep();
    this._syncDevice();
    this._updateHud(active ? dt : 0);
    this._updateLabels();
    this._updateMinimap();
    this.quads.update();
    this.markers.update();
    const ad = this.game.audioDirector;
    if (ad) {
      const target = this.engaged ? 1 : 0;
      const cur = ad.combatIntensity ?? 0;
      ad.combatIntensity = target > cur ? target : Math.max(0, cur - dt / 3);
    }
    this._programCheck();
    this._tickT += performance.now() - t0;
    // (only frames where combat ran: title / map / dialog frames would flatter the percentiles)
    if (active) this._ticks[this._tickN++ % TICK_SAMPLES] = this._tickT;
  }

  /**
   * The boss's sprite dithers to SEE_THROUGH while the player stands behind it inside its screen
   * footprint (the 4 u sprite hid the player completely; the x-ray silhouette ignores occluders
   * this close). Eased; only while the boss is alive. Through `Sprite3D.bodyOpacity`: the quad
   * dithers, its shadow and contact blob stay solid (COMBAT-16).
   * @param {number} dt
   */
  _seeThrough(dt) {
    const b = this._boss;
    if (!b || !b.alive || this._hidden.has(b)) return;
    const P = this.player.position;
    const cam = this.engine.camera;
    const m = cam.matrixWorld.elements;
    let behind = false;
    const ex = P.x - b.position.x;
    const ez = P.z - b.position.z;
    // farther from the camera than the boss (camera forward on XZ) …
    const fx = -m[8];
    const fz = -m[10];
    const fl = Math.hypot(fx, fz) || 1;
    if ((ex * fx + ez * fz) / fl > 0.05) {
      // … and inside the sprite's footprint on screen: laterally within its half width, and the
      // player's body (feet … head) overlapping the sprite's height band once projected
      const lateral = Math.abs(ex * m[0] + ez * m[2]);
      const half = 1.6;
      if (lateral < half + 0.3) {
        const n = this._ndc;
        this.projectNdc(b.position.x, b.position.y + 3.9, b.position.z, n, 99);
        const top = n.y;
        this.projectNdc(b.position.x, b.position.y, b.position.z, n, 99);
        const bottom = n.y;
        this.projectNdc(P.x, P.y + 0.4, P.z, n, 99);
        const feet = n.y;
        this.projectNdc(P.x, P.y + 1.4, P.z, n, 99);
        const head = n.y;
        behind = Math.max(feet, head) > bottom && Math.min(feet, head) < top;
      }
    }
    const target = behind && this.pc.alive ? SEE_THROUGH : 1;
    const cur = b.sprite.bodyOpacity;
    let next = cur + (target - cur) * Math.min(1, dt * 12);
    if (Math.abs(next - target) < 0.01) next = target;
    if (next !== cur) b.sprite.bodyOpacity = next;
  }

  /** @param {number} dt */
  _playerVelocity(dt) {
    const p = this.player.position;
    const v = this._pv.velocity;
    if (dt > 0) {
      v.x = (p.x - this._prevPos.x) / dt;
      v.z = (p.z - this._prevPos.z) / dt;
    }
    this._prevPos.copy(p);
  }

  /**
   * Inverse-mass separation of overlapping actors (move radii; the player counts with mass 4).
   * The boss keeps the player at its hurt radius (1.2 u) instead of its move radius (0.6 u): at
   * 0.9 u the player stood inside the 4 u sprite, hidden (melee still reaches: 1.6 + 1.2 u).
   */
  _separation() {
    const act = this._act ??= [];
    act.length = 0;
    for (const e of this.enemies) if (e.alive && !e.dormant && e.sprite.visible) act.push(e);
    for (let it = 0; it < SEP_ITER; it++) {
      for (let i = 0; i < act.length; i++) {
        const a = act[i];
        for (let j = i + 1; j < act.length; j++) {
          const b = act[j];
          if (a.flier !== b.flier) continue;
          this._separatePair(a, b, i, j);
        }
      }
    }
    const pc = this.pc;
    if (!pc.alive || pc.dodging) return;
    const p = this.player.position;
    for (let i = 0; i < act.length; i++) {
      const e = act[i];
      if (e.flier) continue;
      const r = pc.radius + (e.boss ? e.radius : (e.def.moveRadius ?? 0.3));
      let dx = p.x - e.position.x;
      let dz = p.z - e.position.z;
      const d = Math.hypot(dx, dz);
      if (d >= r || Math.abs(p.y - e.position.y) > 1.0) continue;
      if (d < 1e-5) { dx = 0; dz = 1; } else { dx /= d; dz /= d; }
      const overlap = r - d;
      const ip = 1 / PLAYER_SEP_MASS;
      // an armoured enemy (a charging boar or boss) plows through: infinite mass against the player
      const ie = !e.armored && Number.isFinite(e.mass) && e.mass > 0 ? 1 / e.mass : 0;
      const sp = ip / (ip + ie);
      this.player.moveBy(dx * overlap * sp, dz * overlap * sp);
      if (ie > 0) this._separateMove(e, -dx * overlap * (1 - sp), -dz * overlap * (1 - sp));
    }
  }

  /** @param {Enemy} a @param {Enemy} b @param {number} i @param {number} j */
  _separatePair(a, b, i, j) {
    const r = (a.def.moveRadius ?? 0.3) + (b.def.moveRadius ?? 0.3);
    let dx = b.position.x - a.position.x;
    let dz = b.position.z - a.position.z;
    const d = Math.hypot(dx, dz);
    if (d >= r || (!a.flier && Math.abs(a.position.y - b.position.y) > 1.0)) return;
    if (d < 1e-5) {
      const ang = ((i * 7 + j * 13) % 16) * (Math.PI / 8);
      dx = Math.cos(ang);
      dz = Math.sin(ang);
    } else { dx /= d; dz /= d; }
    const overlap = r - d;
    const ia = Number.isFinite(a.mass) && a.mass > 0 ? 1 / a.mass : 0;
    const ib = Number.isFinite(b.mass) && b.mass > 0 ? 1 / b.mass : 0;
    if (ia + ib <= 0) return;
    const sa = ia / (ia + ib);
    if (ia > 0) this._separateMove(a, -dx * overlap * sa, -dz * overlap * sa);
    if (ib > 0) this._separateMove(b, dx * overlap * (1 - sa), dz * overlap * (1 - sa));
  }

  /** @param {Enemy} e @param {number} dx @param {number} dz */
  _separateMove(e, dx, dz) {
    if (e.flier) this._moveFly(e, dx, dz);
    else {
      const keep = e.blockedBy;
      this._moveGround(e, dx, dz);
      e.blockedBy = keep;
    }
  }

  _arenaClamp() {
    const p = this.player.position;
    for (const a of this.arenas) if (a.active && this.pc.alive) a.clamp(p, 0.35);
    // companions sealed in with the player are held inside too
    for (const m of this.allies) {
      const ar = m.gone ? null : m._arena;
      if (ar && ar.active) ar.clamp(m.position, 0.35);
    }
  }

  /**
   * The companions in the separation (PARTY.md §5.3), after the enemies' and the player's: an
   * enemy and a companion split the overlap by inverse mass (a companion's is `ALLY.mass`; an
   * armoured enemy plows through), companions split evenly, and a companion gives way to the
   * player entirely (it never pushes the player). Only companions the combat drives, up and not
   * rolling; fliers are not separated (as for the player).
   */
  _allySeparation() {
    const act = this._act ?? [];
    const A = this.allies;
    const sep = this._allySep ??= [];
    sep.length = 0;
    for (const m of A) if (m.present && m.active && m.action !== 'roll') sep.push(m);
    if (!sep.length) return;
    const im = 1 / ALLY.mass;
    for (let i = 0; i < sep.length; i++) {
      const m = sep[i];
      const p = m.position;
      for (let j = 0; j < act.length; j++) {
        const e = act[j];
        if (e.flier) continue;
        const r = ALLY.radius + (e.boss ? e.radius : (e.def.moveRadius ?? 0.3));
        let dx = p.x - e.position.x;
        let dz = p.z - e.position.z;
        const d = Math.hypot(dx, dz);
        if (d >= r || Math.abs(p.y - e.position.y) > 1.0) continue;
        if (d < 1e-5) { dx = 0; dz = 1; } else { dx /= d; dz /= d; }
        const overlap = r - d;
        const ie = !e.armored && Number.isFinite(e.mass) && e.mass > 0 ? 1 / e.mass : 0;
        const sm = im / (im + ie);
        m.push(dx * overlap * sm, dz * overlap * sm);
        if (ie > 0) this._separateMove(e, -dx * overlap * (1 - sm), -dz * overlap * (1 - sm));
      }
    }
    for (let i = 0; i < sep.length; i++) {
      for (let j = i + 1; j < sep.length; j++) {
        const a = sep[i].position;
        const b = sep[j].position;
        const r = ALLY.radius * 2;
        let dx = b.x - a.x;
        let dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d >= r || Math.abs(a.y - b.y) > 1.0) continue;
        if (d < 1e-5) {
          const ang = ((i * 7 + j * 13) % 16) * (Math.PI / 8);
          dx = Math.cos(ang);
          dz = Math.sin(ang);
        } else { dx /= d; dz /= d; }
        const half = (r - d) / 2;
        sep[i].push(-dx * half, -dz * half);
        sep[j].push(dx * half, dz * half);
      }
    }
    const pc = this.pc;
    if (!pc.alive) return;
    const P = this.player.position;
    for (const m of sep) {
      const p = m.position;
      const r = ALLY.radius + pc.radius;
      let dx = p.x - P.x;
      let dz = p.z - P.z;
      const d = Math.hypot(dx, dz);
      if (d >= r || Math.abs(p.y - P.y) > 1.0) continue;
      if (d < 1e-5) { dx = -this.player.facing.x; dz = -this.player.facing.z; } else { dx /= d; dz /= d; }
      m.push(dx * (r - d), dz * (r - d));
    }
  }

  /** @param {number} dt */
  _dormancy(dt) {
    this._checkT -= dt;
    if (this._checkT > 0) return;
    this._checkT = CHECK_EVERY;
    const p = this.player.position;
    for (const e of this.enemies) {
      if (!e.alive || this._hidden.has(e)) continue;
      const d = Math.hypot(e.position.x - p.x, e.position.z - p.z);
      // (an enemy walking home keeps walking: it would otherwise wake up away from home)
      if (!e.aggro && e.state !== 'return' && d > DORMANT_RANGE) {
        if (!e.dormant) {
          this._releaseToken(e);
          e.sleep();
        }
      } else if (e.dormant && d <= DORMANT_RANGE) e.dormant = false;
    }
    // faded corpses stop drawing
    for (const e of this.enemies) if (!e.alive && e.sprite.visible && e.sprite.opacity <= 0.001) e.sprite.visible = false;
  }

  /**
   * Force the engaged state (resets): emits `engaged(false)` when it was on (§9.6).
   * @param {boolean} on
   */
  setEngaged(on) {
    this._engageLinger = 0;
    if (this.engaged === !!on) return;
    this.engaged = !!on;
    this.events.emit('engaged', this.engaged);
  }

  /** @param {number} dt */
  _engagement(dt) {
    const p = this.player.position;
    let cond = !!this._bossFight;
    if (!cond) {
      for (const e of this.enemies) {
        if (!e.alive || !e.aggro || e.passive || e.dormant || !e.sprite.visible) continue;
        if (Math.hypot(e.position.x - p.x, e.position.z - p.z) <= ENGAGE.range) { cond = true; break; }
      }
    }
    if (cond) {
      this._engageLinger = ENGAGE.linger;
      if (!this.engaged) {
        this.engaged = true;
        this.events.emit('engaged', true);
      }
    } else if (this.engaged) {
      this._engageLinger -= dt;
      if (this._engageLinger <= 0) {
        this.engaged = false;
        this.events.emit('engaged', false);
      }
    }
  }

  /** @param {number} dt */
  _runTimers(dt) {
    const T = this._timers;
    for (let i = T.length - 1; i >= 0; i--) {
      T[i].t -= dt;
      if (T[i].t <= 0) {
        const fn = T[i].fn;
        T.splice(i, 1);
        fn();
      }
    }
  }

  /** @param {number} dt */
  _heartbeatStep(dt) {
    const pc = this.pc;
    const low = pc.alive && pc.hp < pc.hpMax * LOW_HP;
    if (!low) {
      this._heartbeat = 0;
      return;
    }
    this._heartbeat -= dt;
    if (this._heartbeat <= 0) {
      this._heartbeat = HEARTBEAT;
      this.audio.playSfx('heartbeat', { volume: 0.7 });
    }
  }

  /**
   * Enemy sprites: `speed = !playing ? 1 : (!active || stop > 0 ? 0 : enemyScale)` (§4.3).
   * @param {boolean} playing
   * @param {boolean} active
   */
  _spriteSpeeds(playing, active) {
    const s = !playing ? 1 : !active || this.stop > 0 ? 0 : this.enemyScale;
    for (let i = 0; i < this.enemies.length; i++) this.enemies[i].sprite.speed = s;
  }

  /** Hit-stop victims shake ±1/16 u on alternate frames (mesh.position.x; Sprite3D never writes it). */
  _jitterStep() {
    const V = this._stopVictims;
    if (!V.length) return;
    const on = this.stop > 0;
    const off = (this.frame & 1 ? 1 : -1) / 16;
    for (let i = V.length - 1; i >= 0; i--) {
      const v = V[i];
      const mesh = v === 'player' ? this.player.sprite.mesh : v.sprite.mesh;
      mesh.position.x = on ? off : 0;
      if (!on) V.splice(i, 1);
    }
  }

  /**
   * Build the combat legend again (the game changed `legendExtra`, e.g. the party's *G — Party*
   * line): at once while the combat is loaded.
   */
  refreshLegend() {
    this._device = null;
    if (this._ready) this._syncDevice();
  }

  /** Device-aware legend (§5.2) and the one-time pad hint. */
  _syncDevice() {
    const dev = this.input.lastDevice === 'gamepad' ? 'gamepad' : 'keyboard';
    if (dev === this._device) return;
    this._device = dev;
    // (the game's own lines: on the pad only those that have a pad button)
    const extra = dev === 'gamepad' ? this.legendExtra.filter((l) => l.pad !== false) : this.legendExtra;
    // the rows' labels translated by id (bindings.js keeps the English: tests read it)
    const rows = (dev === 'gamepad' ? COMBAT_PAD_CONTROLS : COMBAT_CONTROLS).map((r) => ({ ...r, label: t(`combat.controls.${r.id}`) }));
    this.ui.hud.setControls([...rows, ...extra]);
    this.ui.combat?.hud.setDevice(dev);
    if (dev === 'gamepad' && !this._padHinted) {
      this._padHinted = true;
      this.ui.hud.toast(t('combat.padHint'), 6);
    }
  }

  /** @param {number} dt */
  _updateHud(dt) {
    const hud = this.ui.combat?.hud;
    if (!hud || !this._vitals) return;
    const pc = this.pc;
    const v = this._vitals;
    v.hp = Math.ceil(pc.hp);
    v.hpMax = pc.hpMax;
    v.mp = Math.floor(pc.mp);
    v.mpMax = pc.mpMax;
    v.sp = Math.floor(pc.sp);
    v.spMax = pc.spMax;
    v.level = pc.level;
    v.xp = pc.xp;
    v.xpNext = pc.xpNext;
    v.winded = pc.winded;
    hud.setVitals(v);
    for (let i = 0; i < 3; i++) {
      const K = SKILLS[i];
      const a = this._skillArgs[i];
      a.cooldown = pc.cooldowns[i] > 0 ? pc.cooldowns[i] / K.cooldown : 0;
      a.seconds = Math.ceil(pc.cooldowns[i] - EPS);
      a.left = Math.max(0, pc.cooldowns[i]);
      a.locked = pc.level < K.unlock;
      a.affordable = pc.mp >= K.mp - EPS;
      hud.setSkill(i, a);
    }
    const d = this._skillArgs[3];
    d.cooldown = pc.draughtCd > 0 ? pc.draughtCd / DRAUGHT.cooldown : 0;
    d.seconds = Math.ceil(pc.draughtCd - EPS);
    d.left = Math.max(0, pc.draughtCd);
    d.locked = false;
    d.affordable = pc.potions > 0;
    hud.setSkill(3, d);
    hud.setPotions(pc.potions, POTION_MAX);
    hud.setGold(pc.gold);
    const full = pc.hp >= pc.hpMax && pc.mp >= pc.mpMax - 0.5;
    this._calm = !this.engaged && full ? this._calm + dt : 0;
    const calm = this._calm >= CALM_TIME;
    if (calm !== this._calmShown) {
      /** @type {boolean|undefined} the calm hint on the HUD (undefined before the first update) */
      this._calmShown = calm;
      hud.setCalm(calm);
    }
  }

  /** Enemy HP bars / aggro pips (32 slots, nearest first) and off-screen edge arrows (8). */
  _updateLabels() {
    const labels = this.ui.combat?.labels;
    if (!labels) return;
    const p = this.player.position;
    const cands = this._barCands ??= [];
    const edges = this._edgeCands ??= [];
    cands.length = 0;
    edges.length = 0;
    const lock = this.targeting.lock;
    for (const e of this.enemies) {
      if (!e.alive || e.boss || !e.sprite.visible || e.dormant) continue;
      const d = Math.hypot(e.position.x - p.x, e.position.z - p.z);
      e._barD = d;
      const damaged = this.clock - (e._barT ?? -Infinity) < BAR_TIME;
      const bar = damaged || e === lock || (e.elite && d <= ELITE_BAR_RANGE);
      const pip = !bar && e.aggro && d <= PIP_RANGE;
      e._barMode = bar ? 1 : pip ? 2 : 0;
      if (e._barMode) cands.push(e);
      if (e.aggro && d <= EDGE_RANGE) {
        const b = e.def.body;
        if (!this.projectNdc(e.position.x, this.bodyBase(e) + (b[0] + b[1]) / 2, e.position.z, this._ndc, 0.92)) edges.push(e);
      }
    }
    sortByDist(cands);
    sortByDist(edges);
    // stable slots: the 32 nearest candidates get bars, but an enemy keeps the slot it already
    // holds (re-anchoring a slot snaps its lagging fill, so re-sorting by distance every frame
    // made the recent-damage chunk of a pack's bars vanish whenever two enemies swapped order)
    const bars = this._barOf ??= new Array(BAR_SLOTS).fill(null);
    const opts = this._barOpts ??= { elite: false, level: 1, name: '', pip: false };
    const stamp = this._barStamp = (this._barStamp ?? 0) + 1;
    const n = Math.min(BAR_SLOTS, cands.length);
    for (let i = 0; i < n; i++) cands[i]._barPick = stamp;
    for (let s = 0; s < BAR_SLOTS; s++) {
      const e = bars[s];
      if (e && e._barPick !== stamp) {
        e.barSlot = -1;
        bars[s] = null;
        labels.bar(s).hide();
      }
    }
    let free = 0;
    for (let i = 0; i < n; i++) {
      const e = cands[i];
      if (e.barSlot >= 0 && bars[e.barSlot] === e) continue;
      while (bars[free]) free++;
      bars[free] = e;
      e.barSlot = free;
      labels.bar(free).anchor(e.position, this.labelY(e)).show();
    }
    for (let s = 0; s < BAR_SLOTS; s++) {
      const e = bars[s];
      if (!e) continue;
      opts.elite = e.elite;
      opts.level = e.level;
      opts.name = e.elite ? this.displayName(e) : '';
      opts.pip = e._barMode === 2;
      labels.bar(s).set(e.hp / e.hpMax, opts);
    }
    const arrows = this._edgeOf ??= new Array(EDGE_SLOTS).fill(null);
    const eo = this._edgeOpts ??= { windup: false };
    this._edgeCount = Math.min(EDGE_SLOTS, edges.length);
    for (let s = 0; s < EDGE_SLOTS; s++) {
      const e = s < edges.length ? edges[s] : null;
      const h = labels.edge(s);
      if (!e) {
        if (arrows[s]) { h.hide(); arrows[s] = null; }
        continue;
      }
      if (arrows[s] !== e) {
        h.anchor(e.position, this.labelY(e) * 0.5);
        h.show();
        arrows[s] = e;
      }
      eo.windup = e.state === 'windup';
      h.set(eo);
    }
    // the boss bar follows the boss's HP
    if (this._bossFight && this._bossAwake) this.ui.combat.boss.set(this._bossFight.hp / this._bossFight.hpMax, Math.max(1, this._bossPhaseSeen ?? this._bossFight.phase ?? 1));
  }

  _updateMinimap() {
    const out = this.minimapEnemies;
    const pool = this._mmPool;
    let n = 0;
    for (const e of this.enemies) {
      if (!e.alive || !e.aggro || e.passive || !e.sprite.visible) continue;
      if (n === pool.length) pool.push({ x: 0, z: 0 });
      const m = pool[n];
      m.x = e.position.x;
      m.z = e.position.z;
      out[n++] = m;
    }
    out.length = n;
  }

  _programCheck() {
    if (!this.programsAtLoad || this._programWarned || !import.meta.env?.DEV) return;
    const n = this.engine.renderer.info.programs?.length ?? 0;
    if (n > this.programsAtLoad) {
      this._programWarned = true;
      console.warn(`[combat] program compiled mid-game: ${this.programsAtLoad} → ${n}`);
    }
  }

  // =============================================================================================
  // Look
  // =============================================================================================

  /**
   * After `weather.update`: the grade / DOF offsets (§11.4).
   * @param {number} dt
   */
  applyLook(dt) {
    if (!this._ready) return;
    const pc = this.pc;
    const low = pc.alive && pc.hp < pc.hpMax * LOW_HP;
    this.look.apply(this._wasActive ? dt : 0, this.engaged, low);
  }

  // =============================================================================================
  // Encounters, rest, shop
  // =============================================================================================

  /**
   * The death reset (§6.11): alive non-boss enemies home at full HP (killed ones stay dead), an
   * undefeated boss reset (arena open), projectiles / markers / pickups / FX cleared, the lock
   * released, tokens reset; the player loses 10 % gold and gets HP / MP / SP full, draughts ≥ 2.
   * `full` (rest, the reset hook): every non-boss enemy respawns (killed ones too), nothing is
   * taken from the player.
   * @param {{ full?: boolean }} [opts]
   */
  resetEncounter({ full = false } = {}) {
    const ctx = this.ctx;
    for (const e of this.enemies) {
      if (e.isAdd) {
        if (!this._hidden.has(e)) {
          e.reset(ctx);
          this._hideAdd(e);
        }
        continue;
      }
      if (e.boss) {
        if (e.alive || !this.bossDefeated) e.reset(ctx);
        continue;
      }
      if (full || e.alive) e.reset(ctx);
    }
    // a group the story has taken away stays away (its foes were reset above like the others)
    for (const e of this._absent) this._hideAdd(e);
    this._resetBoss();
    this._tokens.melee = 0;
    this._tokens.ranged = 0;
    for (const e of this.enemies) e.token = false;
    this.projectiles.clear();
    this._freeMarkersOf(null);
    this.fx.clear();
    if (!full) this.pickups.clear();
    this.targeting.release();
    this.stop = 0;
    this._slow = 0;
    this.playerScale = 1;
    this.enemyScale = 1;
    this.setEngaged(false);
    const pc = this.pc;
    if (!full) {
      pc.gold = Math.floor(pc.gold * (1 - GOLD_LOSS));
      pc.revive();
    }
    // the companions: no foe after them, full and up (a respawn, a rest)
    for (const e of this.enemies) e.target = null;
    this.healAllies();
  }

  /** An undefeated boss's fight state back to the start (arena open, framing off, bar hidden). */
  _resetBoss() {
    for (const a of this.arenas) a.open();
    for (const em of this._emitters ?? []) em.enabled = false;
    this._bossFight = null;
    this._bossAwake = false;
    this._kneel = null;
    this._bossPhaseSeen = 1;
    this._introT = 0;
    this.targeting.setBoss(null);
    this.ui.combat?.boss.hide();
    this.music.setSection('A');
  }

  /** Rest at a waystone: full resources, draughts ≥ 3, every non-boss group home (§6.12). */
  restAll() {
    this.resetEncounter({ full: true });
    const pc = this.pc;
    pc.refill();
    pc.potions = Math.max(pc.potions, WAYSTONE.restDraughts);
  }

  /**
   * Buy from a shop NPC on a combat level (`action: 'shop'`, or the `shopkeeper` script's menu): the
   * Healing Draught (up to the carry cap) or a one-time ware of SHOP_WARES (its upgrade is applied at
   * once; `sold` when already bought this session). Emits `purchase` (item, price).
   * @param {string} item
   * @returns {{ ok: boolean, reason?: 'gold'|'full'|'item'|'sold' }}
   */
  buy(item) {
    const w = shopWare(item);
    if (!w) return { ok: false, reason: 'item' };
    const pc = this.pc;
    if (w.once && this.purchased.has(w.id)) return { ok: false, reason: 'sold' };
    if (!w.upgrade && pc.potions >= POTION_MAX) return { ok: false, reason: 'full' };
    if (pc.gold < w.price) return { ok: false, reason: 'gold' };
    pc.gold -= w.price;
    if (w.upgrade) pc.upgrade(w.upgrade, w.amount);
    else pc.potions++;
    if (w.once) this.purchased.add(w.id);
    this.events.emit('purchase', w.name, w.price);
    return { ok: true };
  }

  /**
   * The player's progress a campaign carries to its next combat level (src/game/campaign/
   * CampaignState.js): level, XP, gold, draughts, upgrades and the one-time wares bought.
   * @returns {import('../campaign/CampaignState.js').CombatProgress}
   */
  exportProgress() {
    const pc = this.pc;
    return { level: pc.level, xp: pc.xp, gold: pc.gold, potions: pc.potions, upgrades: { ...pc.upgrades }, wares: [...this.purchased] };
  }

  /**
   * Restore `exportProgress`'s result on entering a combat level of a campaign (a saved game is
   * untrusted: every number is clamped); the player starts with full HP, MP and SP, and the
   * companions — added at the fresh combat's level 1 — are scaled to the player's level
   * (`MemberCombat.syncLevel`: full stays full).
   * @param {import('../campaign/CampaignState.js').CombatProgress} p
   */
  importProgress(p) {
    const pc = this.pc;
    const n = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
    pc.level = n(p.level, 1, LEVEL_CAP);
    pc.xp = n(p.xp, 0, 1e7);
    pc.gold = n(p.gold, 0, 1e7);
    pc.potions = n(p.potions, 0, POTION_MAX);
    for (const k of ['maxHp', 'maxMp', 'attack', 'def']) pc.upgrades[k] = n(p.upgrades?.[k], 0, 999);
    this.purchased = new Set((Array.isArray(p.wares) ? p.wares : []).filter((w) => typeof w === 'string' && SHOP_WARES.some((s) => s.id === w)));
    pc.refill();
    for (const a of this.allies) a.syncLevel();
  }

  /** Ids of the level's chests opened this visit (a campaign keeps them open). */
  openedChests() {
    return this.chests.list.filter((c) => c.opened).map((c) => c.id);
  }

  /**
   * Chests opened on an earlier visit of this level (a campaign): open, empty, on the map.
   * @param {string[]} ids
   */
  markChestsOpened(ids) {
    for (const c of this.chests.list) {
      if (!ids.includes(c.id) || c.opened) continue;
      c.opened = true;
      if (c.it) c.it.disabled = true;
      // (at once: opened on an earlier visit — no swing when the story brings it into view later)
      c.prop?.open?.(true);
      this.chests.discover(c);
    }
  }

  /**
   * The price of a shop ware (25 for 'Healing Draught'), null when it is not for sale.
   * @param {string} item @returns {number|null}
   */
  priceOf(item) {
    return shopWare(item)?.price ?? null;
  }

  /**
   * The shop menu (the `shopkeeper` script lists the ones not `sold`): every ware of SHOP_WARES in
   * order, with whether buying it now would work (`available`) or why not (`reason`). `name` and
   * `gain` are the English (`buy(name)` looks the ware up by it); `label` and `gainLabel` are what
   * a menu shows, in the page's language (additive; `wareLabel`).
   * @returns {{ id: string, name: string, price: number, gain: string, once: boolean, upgrade: string|null,
   *   sold: boolean, available: boolean, reason: null|'gold'|'full'|'sold', label: string, gainLabel: string }[]}
   */
  shopOffers() {
    const pc = this.pc;
    return SHOP_WARES.map((w) => {
      const sold = w.once && this.purchased.has(w.id);
      const reason = sold ? 'sold' : !w.upgrade && pc.potions >= POTION_MAX ? 'full' : pc.gold < w.price ? 'gold' : null;
      return {
        id: w.id, name: w.name, price: w.price, gain: w.gain, once: w.once, upgrade: w.upgrade, sold, available: !reason, reason,
        label: t(`combat.ware.${w.id}.name`), gainLabel: t(`combat.ware.${w.id}.gain`, { n: w.upgrade ? w.amount : Math.round(DRAUGHT_HEAL * 100) }),
      };
    });
  }

  /**
   * A shop ware's name as a menu or a toast shows it, in the page's language (`buy`, `priceOf` and
   * the `purchase` event keep the English name): a ware of SHOP_WARES by its English name, else the
   * name as a term (an NPC's `item`, docs/specs/I18N.md §4.8).
   * @param {string} item the English name
   * @returns {string}
   */
  wareLabel(item) {
    const w = shopWare(item);
    return w ? t(`combat.ware.${w.id}.name`) : term(String(item ?? ''));
  }

  /**
   * The drillmaster's reward (once, after a full combo on a dummy and a dodge): 2 draughts, capped.
   * @returns {number} draughts given (0 when not due or the satchel is full)
   */
  rewardTutorial() {
    const t = this.tutorial;
    if (t.rewarded || !t.combo || !t.dodge) return 0;
    t.rewarded = true;
    const pc = this.pc;
    const given = Math.max(0, Math.min(2, POTION_MAX - pc.potions));
    pc.potions += given;
    return given;
  }

  // =============================================================================================
  // The story: groups, chests and waystones that come and go (STORY_SCRIPT.md §9.5)
  // =============================================================================================

  /**
   * Who is there as the story stands (StoryRunner.applyPresence, after `World.applyStory`: when the
   * level is attached and on every story change). Every enemy group, chest and waystone of the level
   * was loaded and warmed, present or not (they are `LIVE_STORY_TYPES`: a campaign keeps them in the
   * level); an absent one is out of play. Only the objects with a `when` / `unless` are read.
   * - An **enemy group** the story takes away goes silently, also mid-fight: its foes leave the
   *   lock-on and the aggro, their tokens, markers and projectiles go, the living are put back home
   *   at full HP, and all are hidden and dormant (`_absent`, `_hidden`: no AI, not drawn, not hit,
   *   not on the minimap, not counted — `state().combat.enemies.absent` —, no `kill` and so no
   *   `cleared` event). Its boss's fight ends (the gate opens, the adds go, the bar hides) and its
   *   arena closes nothing (no exclusion, the walk grid opens there, no map marker). A group that
   *   comes back spawns at home, no reward replayed; its fallen stay fallen (a waystone rest brings
   *   them back as usual, present or not).
   * - A **chest** or **waystone**: the World's story group shows / hides the prop, its collider and
   *   its prompt; here an absent chest is not discovered, opened or on the maps (an opened chest
   *   that comes back still offers nothing), an absent waystone is not attuned or rested at (the
   *   checkpoint it held falls back to the level's start).
   * @param {(o: LevelObject) => boolean} present
   */
  applyPresence(present) {
    if (!this._ready) return;
    for (const g of this._storyGroups) {
      const on = !!present(g);
      if (on !== this._absentGroups.has(g)) continue;
      this._setGroupPresent(g, on);
    }
    for (const c of this._storyChests) {
      c.absent = !present(c.obj);
      // (World.applyStory enables a prompt whose group came back: an opened chest offers nothing)
      if (c.it) c.it.disabled = c.absent || c.opened;
    }
    for (const w of this._storyStones) this.waystones.setAbsent(w, !present(w.obj));
  }

  /**
   * One group comes or goes (`applyPresence`).
   * @param {LevelObjectOf<'enemy'>} g
   * @param {boolean} on
   */
  _setGroupPresent(g, on) {
    const members = this._members.get(g) ?? [];
    const ctx = this.ctx;
    if (on) this._absentGroups.delete(g);
    else this._absentGroups.add(g);
    for (const e of members) {
      if (on) {
        this._absent.delete(e);
        this._hidden.delete(e);
        // the living spawn at home (visible, idle); the fallen stay fallen
        if (e.alive) e.reset(ctx);
        continue;
      }
      if (this.targeting.lock === e) this.targeting.release();
      if (e.boss && this._bossFight === e) {
        // its fight ends: the gate opens, the bar and the framing go, the adds below
        this._resetBoss();
      }
      for (const a of e.boss ? this._addsOf.get(e) ?? [] : []) {
        if (this._hidden.has(a)) continue;
        this._sendHome(a, true);
        this._hideAdd(a);
      }
      if (e.alive) this._sendHome(e, true);
      else {
        this._freeMarkersOf(e);
        this.projectiles.removeOwner(e);
      }
      this.fx.stopFollowing(e.position);
      this._absent.add(e);
      this._hideAdd(e);
    }
    // a boss's arena: its exclusion, walk-grid block and map marker follow the group
    for (const e of members) {
      const a = e.boss ? /** @type {BossArena|null} */ (e.arena) : null;
      if (!a || a.present === on) continue;
      a.present = on;
      const r = a.rect;
      this.nav?.buildRect(r.minX - 0.5, r.maxX + 0.5, r.minZ - 0.5, r.maxZ + 0.5);
    }
  }

  // =============================================================================================
  // A campaign's memory of the level (CAMPAIGN_FORMAT.md §6.4, §7)
  // =============================================================================================

  /**
   * The level's enemy groups defeated now — every foe of the group fallen (a boss's adds do not
   * count), present or not — for a campaign to remember (`CampaignState.cleared`). A waystone rest
   * brings the fallen back (a boss excepted) and so takes their groups off this list.
   * @returns {string[]} group ids, in level order
   */
  defeatedGroups() {
    const out = [];
    for (const [g, members] of this._members) {
      const id = typeof g.id === 'string' ? g.id : '';
      if (id && members.length && members.every((e) => !e.alive)) out.push(id);
    }
    return out;
  }

  /**
   * Groups a campaign remembers as defeated on an earlier visit (CampaignRuntime._restoreCombat,
   * as the level is entered): their foes are simply not there — fallen, not drawn — with no death,
   * drop, XP, `kill` event (so no `cleared` event) or effect; a boss stays defeated (its arena
   * open, off the maps, `bossDefeated`). A waystone rest brings the non-boss ones back as usual.
   * Unknown ids are ignored (a chapter's variant of the level may not have them).
   * @param {string[]} ids
   */
  markGroupsCleared(ids) {
    const want = new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === 'string'));
    if (!want.size) return;
    for (const [g, members] of this._members) {
      if (!want.has(g.id)) continue;
      for (const e of members) {
        if (!e.alive) continue;
        if (this.targeting.lock === e) this.targeting.release();
        this._releaseToken(e);
        this._freeMarkersOf(e);
        this.projectiles.removeOwner(e);
        e.vanish();
        if (!e.boss) continue;
        this.bossDefeated = true;
        if (this._bossFight === e) this._resetBoss();
        this._dropBossMarker(e);
      }
    }
  }

  /** The track combat wants (Game.setMusic restarts it). */
  get musicTrack() { return this.music?.musicTrack ?? 'emberfall'; }

  // ---- Game notifications ----

  /** Game.teleport: the lock releases, the focus vectors jump with the player. */
  onTeleport() {
    if (!this._ready) return;
    this.targeting.release();
    this.targeting.snap();
    this._prevPos.copy(this.player.position);
  }

  /** The world map opened: the lock releases. */
  onMapOpen() {
    if (this._ready) this.targeting.release();
  }

  // =============================================================================================
  // State (§20.2)
  // =============================================================================================

  /** The `state()` hook and `Game.state().combat`. @returns {CombatState} */
  state() {
    const pc = this.pc;
    let alive = 0;
    let activeN = 0;
    let aggro = 0;
    let total = 0;
    let absent = 0;
    for (const e of this.enemies) {
      if (this._absent.has(e)) absent++;
      // (hidden: an add not spawned, or a foe of a group the story has taken away)
      if (this._hidden.has(e)) continue;
      total++;
      if (e.alive) alive++;
      if (e.alive && !e.dormant) activeN++;
      if (e.alive && e.aggro) aggro++;
    }
    const b = this._boss;
    /** @type {(v: number) => number} */
    const r3 = (v) => +v.toFixed(3);
    const fightTime = this._bossFight ? this.clock - this._fightStart : this._fightTime ?? 0;
    const ph = [...this._phaseTimes];
    if (this._bossFight) {
      const i = Math.max(0, Math.min(2, (this._bossPhaseSeen ?? 1) - 1));
      ph[i] = this.clock - this._phaseStart[i];
    }
    return {
      player: {
        hp: Math.ceil(pc.hp), hpMax: pc.hpMax, mp: r3(pc.mp), mpMax: pc.mpMax, sp: r3(pc.sp), spMax: pc.spMax,
        level: pc.level, xp: pc.xp, xpNext: pc.xpNext, gold: pc.gold, potions: pc.potions, atk: pc.atk, def: pc.def,
        action: pc.action, actionFrame: pc.frame, invulnerable: pc.invulnerable, combo: pc.combo, winded: pc.winded,
        lock: this.targeting.lock?.uid ?? null, checkpoint: this.waystones.checkpoint.id,
        cooldowns: pc.cooldowns.map(r3), deaths: pc.deaths, perfectDodges: pc.perfectDodges,
      },
      engaged: this.engaged,
      time: r3(this.clock),
      frame: this.frame,
      seed: this.seedValue,
      kills: this.kills,
      bossDefeated: this.bossDefeated,
      device: this.input.lastDevice,
      enemies: { total, alive, active: activeN, aggro, absent },
      boss: b ? {
        uid: b.uid, hp: Math.ceil(b.hp), hpMax: b.hpMax, phase: Math.max(b.phase || 1, this._bossFight ? this._bossPhaseSeen ?? 1 : 1),
        state: b.state, broken: !!b.broken, defeated: this.bossDefeated && !b.alive,
        fightTime: r3(fightTime), phaseTimes: ph.map(r3),
      } : null,
      projectiles: this.projectiles.count,
      markers: this.markerCount,
      pickups: this.pickups.count,
      fx: this.fx.count,
      edgeArrows: this._edgeCount ?? 0,
      tokens: { melee: this._tokens.melee, ranged: this._tokens.ranged },
      guards: { resume: this.cin.resumeGuard, respawn: this.cin.respawnGuard > 0 },
      tutorial: { ...this.tutorial },
      shop: { purchased: [...this.purchased] },
      // the party's companions (PARTY.md §8; only once one fights here)
      ...(this.allies.length ? { allies: this.allies.map((a) => a.info()) } : {}),
    };
  }

  /** Performance / pool figures (the `stats()` hook). @returns {CombatStats} */
  stats() {
    const n = Math.min(this._tickN, TICK_SAMPLES);
    const s = Array.from(this._ticks.subarray(0, n)).sort((a, b) => a - b);
    /** @type {(f: number) => number} the `f` quantile (ms) */
    const q = (f) => (n ? +s[Math.min(n - 1, Math.floor(n * f))].toFixed(3) : 0);
    return {
      programs: this.engine.renderer.info.programs?.length ?? 0,
      programsAtLoad: this.programsAtLoad,
      drawCalls: this.postfx.sceneInfo.calls,
      tickMsP50: q(0.5),
      tickMsP95: q(0.95),
      pools: { fx: this.quads.count, markers: this.markerCount, projectiles: this.projectiles.count, pickups: this.pickups.count },
      nav: { ...this.nav.stats, cells: this.nav.cols * this.nav.rows, buildMs: this.nav.buildMs },
    };
  }

  // =============================================================================================
  // Dispose
  // =============================================================================================

  dispose() {
    if (!this._ready) return;
    this._ready = false;
    // the companions' fights go (the party keeps the members; a next combat level adds them again)
    for (const a of this.allies) a.release();
    this.allies.length = 0;
    try { this.look.restore(); } catch { /* post already gone */ }
    this.projectiles.clear();
    this.pickups.clear();
    this.fx.clear();
    for (const s of this.actorSprites) {
      this.spriteManager.remove(s);
      s.dispose();
    }
    this.actorSprites.length = 0;
    this.enemies.length = 0;
    for (const em of this._emitters ?? []) em.dispose?.();
    // the burst pools only combat made (and their programs): a next, peaceful level has its own count
    this.particles.releaseBurstPools(this._ownPools);
    this._ownPools = [];
    this.quads.dispose();
    this.markers.dispose();
    this.atlas.texture.dispose();
    for (const s of this.sheets.values()) s.dispose?.();
    this.sheets.clear();
    this.events.clear();
    this._timers.length = 0;
    // what load() installed on the shared game objects (a campaign travels on without a reload)
    if (this._savedBindings) this.input.restoreBindings(this._savedBindings);
    this.input.disableMouseButtons?.();
    this.rig.stickZoom = 0;
    this.ui.disableCombat?.();
  }
}

/**
 * Insertion sort by `_barD` (allocation-free; a few dozen entries).
 * @param {Enemy[]} a
 */
function sortByDist(a) {
  for (let i = 1; i < a.length; i++) {
    const x = a[i];
    let j = i - 1;
    while (j >= 0 && a[j]._barD > x._barD) {
      a[j + 1] = a[j];
      j--;
    }
    a[j + 1] = x;
  }
}
