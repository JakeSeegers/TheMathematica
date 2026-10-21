import * as THREE from 'three';
import {
  Engine, CameraRig, PostFX, LightingSystem, TextureLibrary, Particles, GodRays, SpriteManager,
  AudioSystem, UI, DEG2RAD, DEFAULT_KEYFRAMES, clamp, lerp, smoothstep,
} from '../engine/index.js';
import { computeCameraBounds } from '../engine/level/ObjectBuilder.js';
import { CHARACTER_PRESET_NAMES, levelHasCombat, levelHasStory } from '../engine/level/ObjectCatalog.js';
import { renderLevelMap } from '../engine/level/LevelMap.js';
import { hasStoryCondition } from '../engine/level/Travel.js';
import { makeShadowOnly, primeShadowPrograms } from '../engine/world/ShadowCasters.js';
import { BlobBatch } from '../engine/sprite/BlobBatch.js';
import { LightPool } from '../engine/lighting/LightPool.js';
import { World, MAX_POINT_LIGHTS } from './World.js';
import { Player } from './Player.js';
import { Npc } from './Npc.js';
import { Critters } from './Critters.js';
import { Weather } from './Weather.js';
import { AudioDirector } from './AudioDirector.js';
import { ResolutionGovernor } from './ResolutionGovernor.js';
import { buildDebugControls } from './DebugControls.js';
import { conversationFor } from './dialogue.js';
import { installFogStart, setFogStart } from './AtmosphereFog.js';
import { cameraFraming, isInterior } from './LevelLook.js';
import { SHIPPED_LEVELS } from './levels.js';
// (the turn-based GlaiveCombat is imported dynamically in init, on combat levels only: peaceful
// levels never download or parse the combat code; bindings.js is a tiny import-free table)
import { PHOTO_PAD_DEFLECT, PHOTO_PAD_QUIET } from './combat/bindings.js';
import {
  CAMERA, TIME_SPEED, SUN_PATH, MOON_PATH, KEYFRAME_OVERRIDES, SPRITE_FILL,
} from './config.js';
import { t, getLang, saveLang, isCJK, LANG_CODES } from '../engine/i18n/I18n.js';
import { loc, term, quietly } from '../engine/i18n/ContentText.js';
import { textKeyOf, builtinLabel } from '../engine/i18n/ContentKeys.js';
import { coreStringsOf } from '../engine/i18n/strings/index.js';
import { phaseName } from '../engine/ui/HUD.js';

/**
 * @import { Level, LevelEnvironment, LevelObject, ObjectShapeOf } from '../engine/level/types.js'
 * @import { LevelPreparation } from './campaign/LevelPreparation.js'
 * @import { NpcDef } from './Npc.js'
 * @import { GlaiveCombat } from './glaive/GlaiveCombat.js'
 * @import { GlaiveHooks } from './glaive/hooks.js'
 * @import { CampaignRuntime, CampaignHooks } from './campaign/CampaignRuntime.js'
 */

/**
 * The controls legend's rows (`HUD.setControls`): `id` is stable (tests find a row by it, or by
 * the English label in English); `label` is the English, shown as `t('game.controls.<id>')`
 * (`controlRows`).
 */
const CONTROLS = [
  { keys: 'WASD', label: 'Move', id: 'move' },
  { keys: 'Shift', label: 'Run', id: 'run' },
  { keys: 'Space', label: 'Talk / Examine', id: 'talk' },
  { keys: 'Q/E', label: 'Rotate camera', id: 'camera' },
  { keys: 'Z/X', label: 'Zoom (or wheel)', id: 'zoom' },
  { keys: 'N/Tab', label: 'World map', id: 'map' },
  { keys: 'T', label: 'Time of day', id: 'time' },
  { keys: 'R', label: 'Weather', id: 'weather' },
  { keys: 'P', label: 'Photo mode', id: 'photo' },
  { keys: 'M', label: 'Music', id: 'music' },
  { keys: '`', label: 'Debug panel', id: 'debug' },
];

/**
 * The story journal's line in the controls legend (levels and campaigns with a story). B has no pad
 * button: `pad: false` — the combat legend's pad variant leaves the line out (KNOWN_ISSUES PARTY-02).
 */
const JOURNAL_CONTROL = { keys: 'B', label: 'Journal', id: 'journal', pad: false };
/**
 * The party's line in the controls legend (once someone joined: docs/specs/PARTY.md §4.4). G has
 * no pad button (every one is taken on a combat level; a pad opens the panel through a member's
 * talk): `pad: false` — the combat legend's pad variant leaves the line out.
 */
const PARTY_CONTROL = { keys: 'G', label: 'Party', id: 'party', pad: false };

/**
 * Legend rows as the player reads them: each label in the page's language (`game.controls.<id>`).
 * @param {{ keys: string, label: string, id: string, pad?: boolean }[]} rows
 */
const controlRows = (rows) => rows.map((r) => ({ ...r, label: t(`game.controls.${r.id}`) }));

/**
 * A villager's name as the player reads it (docs/specs/I18N.md §4.5, §4.8): its name is an identity
 * (scripts match villagers by it), translated as a term — or, for a villager the level left without
 * one (`npcDef` stands the English 'Villager' in for it: `def.unnamed`), the UI's default.
 * @param {{ name?: unknown, def?: { unnamed?: boolean } }|null|undefined} npc a villager (Npc)
 * @returns {string}
 */
export function villagerName(npc) {
  if (npc?.def?.unnamed) return t('game.default.villager');
  const name = npc?.name;
  return typeof name === 'string' ? term(name) : String(name ?? '');
}

/**
 * An interaction prompt's label as the player reads it (docs/specs/PIXEL_UI.md §8.1, I18N.md §4.8):
 * a built-in verb (ContentKeys.js `BUILTIN_LABELS`: Talk, Examine, Knock, Read, Look, Enter, Rest,
 * Open — also an exit's or an event's data label that is one, such as the catalog's `Enter`)
 * through `game.prompt.<id>`; any other label of an exit or an event by the key its object holds
 * (`textKeyOf(object, 'label')`, I18N.md §4.2; none: the English); anything else as it
 * is. The interactable keeps its English label (tests read `it.label === 'Enter'`).
 * @param {{ label?: unknown, object?: { type?: string, id?: unknown } }|null|undefined} it an
 *   interactable (World, CampaignRuntime's Space exits, StoryRunner's Space events: `object`)
 * @returns {string}
 */
export function promptLabel(it) {
  const label = typeof it?.label === 'string' ? it.label : String(it?.label ?? '');
  const verb = builtinLabel(label);
  if (verb) return t(`game.prompt.${verb}`);
  const o = it?.object;
  if (o && (o.type === 'exit' || o.type === 'event')) return loc(textKeyOf(o, 'label'), label, 'label');
  return label;
}

/**
 * A villager's small title beside the dialogue's name plate (DialogLine `title`, PIXEL_UI.md §8.1):
 * the npc's data `title` (*Warden of the Cinderwatch*; an optional catalog field, absent by
 * default) by the key its level object holds (`def.titleKey`: `textKeyOf(obj, 'title')`, I18N.md
 * §4.2; none: the English), else none — a sprite's look is not a job. For the game's
 * own talks; a talk script's line shows it the same way (StoryRunner).
 * @param {{ def?: { title?: unknown, titleKey?: unknown } }|null|undefined} npc a villager (Npc: its `def`)
 * @returns {string} '' for none
 */
export function speakerTitle(npc) {
  const title = npc?.def?.title;
  if (typeof title !== 'string' || !title.trim()) return '';
  const key = npc.def.titleKey;
  return loc(typeof key === 'string' ? key : '', title, 'title');
}

/** The title screen's language row (PIXEL_UI.md §8.1): each language in its own script. */
const LANGUAGE_LABELS = Object.freeze({ en: 'EN', ja: '日本語', zh: '中文' });

const INTERACT_RANGE = 1.6;
/** An interactable's `lookSpan` (a door's leaf) counts when the player faces it within 60°. */
const SPAN_FACING = 0.5;
const _spanPt = { x: 0, z: 0 };
/** Nearest point of a `lookSpan` segment `{ a, b }` to (x, z), horizontally; writes into `out`. */
function nearestOnSpan(span, x, z, out = _spanPt) {
  const ax = span.a.x;
  const az = span.a.z;
  const ex = span.b.x - ax;
  const ez = span.b.z - az;
  const len2 = ex * ex + ez * ez;
  const u = len2 > 1e-12 ? Math.min(1, Math.max(0, ((x - ax) * ex + (z - az) * ez) / len2)) : 0;
  out.x = ax + ex * u;
  out.z = az + ez * u;
  return out;
}
/**
 * Big levels: villagers and critters farther than this from the camera focus update every
 * FAR_EVERY-th frame with the accumulated time (same behaviour, a quarter of the CPU). The
 * distance grows with the zoom (1.15 × the camera distance + 4), so zoomed right out the actors in
 * the top corners of the view still move every frame.
 */
const FAR_ACTOR_DISTANCE = 42;
const FAR_EVERY = 4;
/** Seconds after a conversation closes during which confirm doesn't start a new one. */
const TALK_COOLDOWN = 0.8;
/** Real frames drawn behind the loading screen with every effect on (see start()). */
const WARM_FRAMES = 5;
/**
 * Frames drawn behind the fader after a level set aside was attached again (swapLevel): its
 * programs are compiled and were drawn before, so no warm-up — a frame or two to settle the view.
 */
const KEPT_FRAMES = 2;

const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const finite = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const isRect = (r) => !!r && ['minX', 'maxX', 'minZ', 'maxZ'].every((k) => Number.isFinite(r[k]));
const isPoint = (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);

/**
 * Automatic focus-bound margins (world units inside the walkable tile extent) for levels without
 * `environment.camera.bounds` — Emberfall's hand-tuned values: the camera looks north, so the
 * north edge needs almost none; east / west and south need more the further the camera is out.
 */
const AUTO_BOUNDS_MARGINS = {
  near: { x: 1.8, north: 0.5, south: 0.8 },
  mid: { x: 3.5, north: 0.5, south: 2 },
  far: { x: 4.5, north: 1, south: 3 },
};

/**
 * Level npc object → Npc definition (object-relative offsets resolved to world positions).
 * @param {ObjectShapeOf<'npc'>} obj (the npc's own fields only)
 * @returns {NpcDef}
 */
function npcDef(obj) {
  const x = obj.x;
  const z = obj.z;
  // `talkOffset` [dx, dz] and `area` {minX…} are relative to the NPC, so they move with it in the
  // editor; `talkPoint` / `bounds` (absolute world coordinates) are still honoured
  let talkPoint;
  if (isPoint(obj.talkOffset)) talkPoint = [x + obj.talkOffset[0], z + obj.talkOffset[1]];
  else if (isPoint(obj.talkPoint)) talkPoint = [obj.talkPoint[0], obj.talkPoint[1]];
  let bounds;
  if (isRect(obj.area)) bounds = { minX: x + obj.area.minX, maxX: x + obj.area.maxX, minZ: z + obj.area.minZ, maxZ: z + obj.area.maxZ };
  else if (isRect(obj.bounds)) bounds = { ...obj.bounds };
  // (level data is untrusted: a number or a boolean name is its text; anything else none — the
  // identity 'Villager' stands in for none, shown as the UI's default: `villagerName`)
  const name = typeof obj.name === 'string' ? obj.name
    : typeof obj.name === 'number' || typeof obj.name === 'boolean' ? String(obj.name) : '';
  return {
    id: obj.id,
    name: name || 'Villager',
    ...(name ? {} : { unnamed: true }),
    preset: CHARACTER_PRESET_NAMES.includes(obj.preset) ? obj.preset : 'villager',
    // hand-written sprite overrides (not a catalog field), drawn like the editor preview does
    spec: obj.spec && typeof obj.spec === 'object' ? obj.spec : undefined,
    home: [x, z],
    wander: Math.max(0, finite(obj.wander, 1.2)),
    speed: Math.max(0.1, finite(obj.speed, 1)),
    facing: ['down', 'up', 'left', 'right'].includes(obj.facing) ? obj.facing : 'down',
    behaviour: obj.behaviour,
    talkRadius: obj.talkRadius != null ? Math.max(0.5, finite(obj.talkRadius, 1.6)) : undefined,
    talkPoint,
    bounds,
    portraitColor: obj.portraitColor || '#c9a45c',
    // (the small title beside the name plate, `speakerTitle`, and the text key the object holds for
    // it; level data is untrusted: text only, a well-formed key only)
    title: typeof obj.title === 'string' && obj.title.trim() ? obj.title : undefined,
    titleKey: typeof obj.title === 'string' && obj.title.trim() ? textKeyOf(obj, 'title') || undefined : undefined,
  };
}

/**
 * Game — plays a Luminati level (Emberfall, or any level made in the editor): wires every engine
 * module together (engine loop, lighting, post, camera rig, UI, audio, world, characters), runs
 * the title → gameplay flow, input shortcuts, interactions and dialogues, and exposes
 * `window.__game` for automated checks.
 *
 * Everything level-specific comes from the level object (docs/contracts/LEVEL_EDITOR.md §5): terrain and
 * props (World), villagers (`npc` objects: `script` = a conversation in dialogue.js, otherwise
 * plain `dialogue` + `action`), critters, particle areas, regions (HUD plate / arrival banners),
 * spawn, camera tuning (`environment.camera`, `highGround`, `titleCamera`), titles (`name`,
 * `subtitle`, `environment.title`), time, clock, weather and music.
 *
 * Combat (docs/contracts/COMBAT.md): a level with `enemy` objects (or `environment.combat: true`)
 * gets a turn-based `GlaiveCombat` (`this.combat`); every other level plays exactly as before
 * (`this.combat === null`: no combat module, sheet, binding, DOM or program is created).
 *
 * Campaigns (docs/specs/CAMPAIGN_FORMAT.md): with a `campaign` (CampaignRuntime) the game plays a
 * story of several levels and switches between them without a reload (`swapLevel`): the engine,
 * renderer, post-processing, audio, UI, weather and one fixed pool of the 12 point lights stay;
 * the world, the characters and combat are built anew.
 */
export class Game {
  /**
   * @param {{ container: HTMLElement, level: Level,
   *   autostart?: boolean, source?: string, campaign?: CampaignRuntime|null,
   *   lang?: string, fonts?: import('../engine/ui/FontLoader.js').FontLoader|null }} opts
   *   level: a normalised level (LevelFormat.normalizeLevel / LevelStorage loaders); campaign: the
   *   campaign it belongs to (null: a level played on its own); lang, fonts: the page's language and
   *   font loader, handed to the UI (src/main.js; docs/specs/I18N.md §1, §5)
   */
  constructor({ container, level, autostart = false, source = '', campaign = null, lang = undefined, fonts = null }) {
    /** The UI's options (`new UI(document.body, uiOptions)` in init). */
    this.uiOptions = { lang, fonts };
    if (!level || !Array.isArray(level.tiles)) throw new Error('Game: a level is required');
    this.container = container;
    this.source = source;
    this.autostart = autostart;
    /**
     * The campaign being played, or null (a single level: exits and entrances are ignored).
     * @type {CampaignRuntime|null}
     */
    this.campaign = campaign;
    this._applyLevel(level);
    /** 'loading' | 'title' | 'play' | 'travel' (a campaign switching levels behind the fader) */
    this.mode = 'loading';
    this.photoMode = false;
    /** World map overlay open (gameplay input paused). */
    this.mapOpen = false;
    this.busy = false; // talking / fading: player frozen
    /** The player wants music (M toggles it; a campaign's next level starts it again unless off). */
    this.musicWanted = true;
    /** @type {Record<string, number>} count by item name (no prototype: shop items are level data) */
    this.inventory = Object.assign(Object.create(null), { apples: 0 });
    this.visits = new Map();
    this._regionTimer = 0;
    this._burstTimer = 0;
    this._sparkleTimer = 0;
    this._talkCooldown = 0;
    this._tmp = new THREE.Vector3();
    this._focusPos = new THREE.Vector3();
    this._target = { kind: '', npc: null, it: null };
    this._timeouts = new Set();
    this._photoTimer = 0;
    this._removeAudioUnlock = null;
    this._disposed = false;
    this._warmFrames = 0;
    /** @type {GlaiveCombat|null} */
    this.combat = null;
    /**
     * The story runtime (docs/specs/STORY_SCRIPT.md): a campaign, or a level with events / talk
     * scripts (`levelHasStory`); null otherwise — such a level plays exactly as before.
     * @type {import('./story/StoryRunner.js').StoryRunner|null}
     */
    this.story = null;
    /**
     * The player's party (docs/specs/PARTY.md): made on demand by `ensureParty` — the first join, or
     * a save that holds members — and kept across a campaign's levels; null until then (a game
     * nobody joins never loads the party's code).
     * @type {import('./party/Party.js').Party|null}
     */
    this.party = null;
    /** Whether the party's HUD frames show (`_updatePartyHud`; only once a party exists). */
    this._partyHudShown = false;
    /** Seconds since the move vector was last deflected > 0.35 (the pad photo guard, combat levels). */
    this._padQuiet = 0;
    /**
     * Resolves once the first frames (with every effect on) have been drawn behind the loader.
     * @type {Promise<void>}
     */
    this.warmedUp = new Promise((resolve) => { this._resolveWarm = resolve; });
    campaign?.attach(this);
  }

  /**
   * Everything the game derives from the level it plays: camera framing (CAMERA defaults +
   * `environment.camera`) and focus bounds, the high-ground tilt, regions, combat (COMBAT.md §3:
   * `combat` is created by `_buildLevel`), the title camera's drift. The constructor's, and a
   * campaign's on every `swapLevel`.
   * @param {Level} level
   */
  _applyLevel(level) {
    this.level = level;
    /** @type {Partial<LevelEnvironment>} ({} without one) */
    this.env = level.environment ?? {};
    const cam = this.env.camera ?? {};
    // (distance 8–80, pitch 10–80°, the zoom range widened to the distance: LevelLook, shared with
    // the editor's game camera)
    this.camera = Object.freeze({ ...CAMERA, ...cameraFraming(cam) });
    // the fog starts 7 units short of this level's framing distance (a uniform: no recompile)
    setFogStart(this.camera.distance - 7);
    this.cameraBounds = this._resolveCameraBounds(cam.bounds);
    const hg = this.env.highGround;
    this.highGround = hg && Number.isFinite(finite(hg.minY, NaN)) ? { minY: finite(hg.minY, 0), pitch: clamp(finite(hg.pitch, this.camera.pitch), 10, 80) } : null;
    this.regions = level.objects.filter((o) => o.type === 'region');
    this._bannersShown = new Set();
    this.region = '';
    /** Combat level (COMBAT.md §3): evaluated per level; `combat` is created by `_buildLevel`. */
    this.combatEnabled = levelHasCombat(level);
    this._cine = { t: 0, target: new THREE.Vector3(), ...this._titleCamera() };
    this._cine.target.set(this._cine.x, this._cine.y, this._cine.z + Math.sin(1) * this._cine.driftZ);
  }

  /**
   * An interior's backdrop (`environment.backdrop`: 'void' or '#rrggbb') instead of the sky; the sky
   * again for a level without one.
   */
  _applyBackdrop() {
    const b = typeof this.env.backdrop === 'string' ? this.env.backdrop.trim() : '';
    let color = null;
    if (b === 'void') color = new THREE.Color(0, 0, 0);
    else if (/^#[0-9a-fA-F]{6}$/.test(b)) color = new THREE.Color(b);
    else if (b) console.warn(`[Luminati] environment.backdrop "${b}" is neither "void" nor #rrggbb: the sky is shown`);
    if (this.lighting) this.lighting.settings.backdrop = color;
  }

  /**
   * near / mid / far focus bounds: environment.camera.bounds (one rect or three), else automatic —
   * the walkable area shrunk by AUTO_BOUNDS_MARGINS (the same framing Emberfall was tuned to).
   */
  _resolveCameraBounds(b) {
    // (hand-written rects: accept swapped min / max)
    const rect = (r) => ({ minX: Math.min(r.minX, r.maxX), maxX: Math.max(r.minX, r.maxX), minZ: Math.min(r.minZ, r.maxZ), maxZ: Math.max(r.minZ, r.maxZ) });
    if (b && isRect(b.near) && isRect(b.mid) && isRect(b.far)) return { near: rect(b.near), mid: rect(b.mid), far: rect(b.far) };
    if (isRect(b) || isRect(b?.mid)) {
      const c = rect(isRect(b) ? b : b.mid);
      return { near: { ...c }, mid: { ...c }, far: { ...c } };
    }
    const walk = computeCameraBounds(this.level, 0);
    const shrink = (lo, hi, a, b2) => (hi - lo >= a + b2 ? [lo + a, hi - b2] : Array(2).fill(lo + (hi - lo) * (a / Math.max(1e-6, a + b2))));
    const out = {};
    for (const [k, m] of Object.entries(AUTO_BOUNDS_MARGINS)) {
      const [minX, maxX] = shrink(walk.minX, walk.maxX, m.x, m.x);
      const [minZ, maxZ] = shrink(walk.minZ, walk.maxZ, m.north, m.south);
      out[k] = { minX, maxX, minZ, maxZ };
    }
    return out;
  }

  /** Title-screen drift: environment.titleCamera, else around the middle of the playable area. */
  _titleCamera() {
    const t = this.env.titleCamera ?? {};
    const mid = this.cameraBounds.mid;
    const cx = (mid.minX + mid.maxX) / 2;
    const cz = (mid.minZ + mid.maxZ) / 2;
    const size = Math.max(this.level.width, this.level.depth);
    return {
      x: finite(t.x, cx),
      z: finite(t.z, cz),
      y: finite(t.y, this._typicalGround() + 0.5),
      driftX: finite(t.driftX, Math.min(7, (mid.maxX - mid.minX) * 0.25)),
      driftZ: finite(t.driftZ, Math.min(5, (mid.maxZ - mid.minZ) * 0.25)),
      distance: clamp(finite(t.distance, Math.min(35, Math.max(22, size * 0.8))), 8, 80),
    };
  }

  /** Most common height of the walkable tiles (world units). */
  _typicalGround() {
    const L = this.level;
    const hist = new Map();
    L.tiles.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const d = L.legend[row[i]];
        if (!d || d.void || d.water || d.walkable === false) continue;
        const h = L.heights[j][i];
        hist.set(h, (hist.get(h) ?? 0) + 1);
      }
    });
    let best = -1;
    let ch = '0';
    for (const [h, n] of hist) if (n > best) { best = n; ch = h; }
    const c = ch.charCodeAt(0);
    return (c >= 97 ? c - 87 : c - 48) * 0.5;
  }

  /**
   * Build everything (async; reports progress for the loading indicator).
   * @param {(fraction:number, label:string) => void} [onProgress]
   */
  async init(onProgress = () => {}) {
    const t0 = performance.now();
    /** Loading milliseconds by phase (wall clock, the loading screen's frames included). */
    this.loadStats = {};
    // three's fog chunks read the fog start from a uniform (set per level by _applyLevel)
    installFogStart();
    const engine = new Engine({ container: this.container, maxPixelRatio: 1.25 });
    this.engine = engine;
    const { scene, camera, renderer } = engine;

    this.textures = new TextureLibrary({ seed: 1337, anisotropy: 4 });
    const keyframes = DEFAULT_KEYFRAMES.map((k) => ({ ...k, ...(KEYFRAME_OVERRIDES[k.name] ?? {}) }));
    const timeOfDay = ((finite(this.env.timeOfDay, 17.2) % 24) + 24) % 24;
    this.lighting = new LightingSystem(engine, { timeOfDay, shadowExtent: 26, sunPath: SUN_PATH, moonPath: MOON_PATH, keyframes });
    this.lighting.sky.lowerClouds = 0.25;
    this._applyBackdrop();
    // the clock runs while playing (paused on the loading / title screens); levels may stop it
    this.lighting.timeSpeed = this.env.clock === false ? 0 : TIME_SPEED;
    this.lighting.paused = true;
    this.particles = new Particles(scene);
    this.godRays = new GodRays({ gain: 0.2 });
    scene.add(this.godRays.object);
    this.spriteManager = new SpriteManager(camera);

    this.rig = new CameraRig(camera, { ...this.camera, yaw: 0, lookAhead: 1.3 });
    this.rig.bounds = { ...this.cameraBounds.mid };

    // 64 taps is plenty for this blur radius (96 cost 0.06–0.26 ms more at 1080p — DOF 1.94–2.14
    // vs 1.88 ms, workflow 02 — for no visible gain);
    // 2× MSAA on big drawing buffers (4× costs ~0.9 ms at 1080p), 4× below.
    const dpr = Math.min(window.devicePixelRatio || 1, engine.maxPixelRatio);
    const bufferPixels = window.innerWidth * window.innerHeight * dpr * dpr;
    this.postfx = new PostFX(renderer, scene, camera, { maxTaps: 64, samples: bufferPixels > 1.8e6 ? 2 : 4 });
    this._tunePost(this.postfx.settings);
    engine.events.on('resize', ({ width, height, pixelRatio }) => this.postfx.setSize(width, height, pixelRatio));
    this.resolution = new ResolutionGovernor({ engine, postfx: this.postfx });

    this.ui = new UI(document.body, this.uiOptions);
    this.audio = new AudioSystem({ volume: 0.6 });
    // campaigns: one fixed pool of the 12 point lights for every level (LightPool `fixed`): the
    // light count — and with it every lit program — stays the same from level to level
    /** @type {LightPool|null} */
    this.lightPool = this.campaign ? new LightPool(this.lighting, [], { size: MAX_POINT_LIGHTS, fixed: true }) : null;
    const tw = performance.now();
    this.loadStats.engine = Math.round(tw - t0);

    // ---- the story (a campaign, or a level with a story of its own): before the level is built ----
    if (this.campaign || levelHasStory(this.level)) await this._createStory();

    // the language's fonts before the HUD's first layout (docs/specs/PIXEL_UI.md §3): awaited by
    // `_buildLevel` once the world and the villagers are built (`_fontsIn`), so the fonts load while
    // the world builds instead of before it (`loadStats.fontsWait`: what the build still waited)
    this._fontsPending = this.ui.fontsReady;

    // ---- the level: world, characters, combat, weather and ambience, HUD and maps ----
    const { earlyCompile } = await this._buildLevel(onProgress, { t0: tw });

    // ---- UI ----
    const ui = this.ui;
    ui.hud.showHelp(false);
    ui.prompt.keyHint = 'Space';
    ui.dialog.speed = 55;
    ui.dialog.onSound = (name) => this.audio.playSfx(name, { volume: 0.7 });
    let blip = 0;
    ui.dialog.onChar = (ch) => {
      if (ch === ' ' || (blip++ & 1)) return;
      this.audio.playSfx('blip', { volume: 0.22, pitch: 0.94 + Math.random() * 0.12 });
    };
    buildDebugControls(this);

    // ---- frame wiring ----
    // lighting: update = clock/palette (before gameplay), lateUpdate = shadow frustum (after the rig)
    engine.addSystem(this.lighting, -10);
    engine.addSystem({ name: 'game', update: (dt, t) => this.update(dt, t) }, 0);
    engine.addSystem(this.audio, 20);
    engine.events.on('lateUpdate', (dt) => this.ui.update(dt, { camera, input: engine.input }));
    engine.setRenderFn((dt) => {
      // DOF follows the player (not the bounds-clamped camera focus point) while playing
      this.postfx.setFocus(this.mode === 'play' && !this.story?.ownsCamera ? this._playerFocusDistance() : this.rig.focusDistance);
      this.postfx.render(dt);
    });
    engine.events.on('afterRender', (dt) => this.ui.debug.stats.update(renderer, dt));

    // ---- warm-up: compile every program now (lights are final), incl. the weather emitters ----
    // Programs are keyed by the render target they draw into: the scene renders into PostFX's
    // linear HDR target, so compile against that target (compiling for the canvas would build
    // unused sRGB variants and leave the real ones to stall the first frame / first rain).
    const tCompile = performance.now();
    this.loadStats.characters = Math.round(tCompile - tw - this.loadStats.world);
    onProgress(0.96, t('game.load.warmup'));
    await wait(0);
    this.rig.setTarget(this.player.sprite);
    this.rig.snap();
    this.weather.rain.intensity = 1;
    this.weather.snow.intensity = 1;
    this.particles.update(1 / 60, camera);
    // the one-shot bursts (waterfall spray and glints, running dust) create their pools on first
    // use: one particle each, far below the world, so their programs compile now and not on the
    // first approach to a waterfall (a 100–300 ms hitch on a big level whose spawn is far from one)
    const far = this._tmp.set(0, -1000, 0);
    if (this.world.falls.some((f) => f.splash)) {
      this.particles.burst('splash', far, 1);
      this.particles.burst('sparkle', far, 1, { size: [0.2, 0.34] });
    }
    this.particles.burst('footstep', far, 1);
    // combat: textures, one FX quad / marker far below, every combat burst (COMBAT.md §19)
    this.combat?.warmup(far);
    await earlyCompile;
    await this._compileScene();
    this.postfx.warmup();
    // the shadow pass's depth programs of every caster kind, drawn by the warm-up frames (REN-13)
    const primer = this._primeShadows();
    this.warmedUp.then(() => primer.dispose());
    this.weather.rain.intensity = 0;
    this.weather.snow.intensity = 0;
    // the level's starting weather (after the warm-up, which forced both precipitations on) — a
    // room has none of its own (LevelLook.isInterior)
    if (this.env.weather && this.env.weather !== 'clear' && !isInterior(this.env)) this.weather.setWeather(this.env.weather, { instant: true });
    // a continued campaign: its saved time, weather, inventory, visits and combat progress
    this.campaign?.onStart();
    // the party a save holds (docs/specs/PARTY.md §2)
    await this.syncParty();
    this._exposeGlobal();
    this.loadStats.compile = Math.round(performance.now() - tCompile);
    onProgress(1, t('game.load.ready'));
  }

  /**
   * Build the level `this.level` into the running engine: the world, the player (at `spawn`),
   * villagers, critters, combat, the actors' contact shadows and warm fill, the weather's and the
   * ambience's view of it, the HUD's location and controls, the maps. init's, and a campaign's on
   * every `swapLevel`. The world's programs start compiling as soon as it is built (in parallel,
   * KHR_parallel_shader_compile) while the rest is set up: `earlyCompile`.
   * @param {(fraction:number, label:string) => void} onProgress
   * @param {{ t0?: number, spawn?: { x: number, z: number, facing?: string },
   *   prepared?: LevelPreparation|null, kept?: KeptLevel|null }} [opts]
   *   t0: when the build began (loadStats); spawn: where the player starts (the level's spawn);
   *   prepared: this level's world built ahead (a campaign's travel, `prepareWorld`); kept: this
   *   level set aside on an earlier visit (`swapLevel`): its world, player, villagers, critters and
   *   painted map are attached again instead of made
   * @returns {Promise<{ earlyCompile: Promise<unknown> }>}
   */
  async _buildLevel(onProgress, { t0 = performance.now(), spawn = this.level.spawn, prepared = null, kept = null } = {}) {
    const engine = this.engine;
    const { scene } = engine;
    // (the story reads `level` and `done:` for this level already while its world is built)
    this.story?.setLevelId(this.campaign?.levelId ?? this._storyLevelId());
    // (Japanese and Chinese: the glyphs of the level's names and the game's lines load while the
    // world builds; awaited before the HUD below)
    const glyphs = this._glyphsFor();
    // ---- world ----
    if (kept) {
      // set aside when the player left it (CAMPAIGN_FORMAT.md §6.3): back into the running game —
      // the story's changes since are applied by `story.attachLevel` below (every type is live)
      this.world = kept.world;
      this.world.story = this.story ? { present: this.story.present } : null;
      this.world.attach();
    } else if (prepared?.world && prepared.level === this.level) {
      // built ahead (CampaignRuntime's preparation, KNOWN_ISSUES CMP-01): the steps not done yet,
      // then into the running game here, where a build would have put it (the world is ours now:
      // a failure from here on is a failed build — swapLevel's caller rolls it back)
      this.world = prepared.world;
      await prepared.finish();
      // (its story presence read the level being entered; now the runner reads that level)
      this.world.story = this.story ? { present: this.story.present } : null;
      this.world.attach();
    } else {
      this.world = new World({
        engine, textures: this.textures, lighting: this.lighting, particles: this.particles, godRays: this.godRays, level: this.level, lightPool: this.lightPool,
        story: this.story ? { present: this.story.present } : null,
      });
      await this.world.build((f, label) => onProgress(f * 0.9, label));
    }
    this.tileMap = this.world.tileMap;
    // big level: the shadow pass only draws casters that can shade what the camera sees
    const B = this.world.batching;
    if (B) this.lighting.setShadowDepthRange(B.shadowUp, B.shadowDown);
    else if (this.campaign) this.lighting.setShadowDepthRange(); // (the default again after a big level)
    this.loadStats.world = Math.round(performance.now() - t0);
    // the world's shader programs start compiling now (in parallel, KHR_parallel_shader_compile)
    // while the villagers, weather and UI are set up; the compile below only adds theirs
    const earlyCompile = this._compileScene();

    // ---- characters ----
    if (kept) {
      // the level's own traveler, villagers and critters, as they were left (the villagers and
      // the animals go on from where they were): back into the scene
      this.player = kept.player;
      this.npcs = kept.npcs;
      this._npcSheets = kept.sheets;
      this.critters = kept.critters;
      for (const s of this._actorSprites()) {
        scene.add(s);
        this.spriteManager.add(s);
      }
      this.player.arrive(spawn);
      this.lighting.followTarget(this.player.sprite);
      this._ensureStandingSpawn({ quiet: spawn !== this.level.spawn });
    } else {
      onProgress(0.92, t('game.load.villagers'));
      await wait(0);
      this.player = new Player({ tileMap: this.tileMap, rig: this.rig, particles: this.particles, audio: this.audio, spawn, combat: this.combatEnabled });
      scene.add(this.player.sprite);
      this.spriteManager.add(this.player.sprite);
      this.lighting.followTarget(this.player.sprite);
      // (an arrival across a seam may be a little off the walkable ground: moved without a warning)
      this._ensureStandingSpawn({ quiet: spawn !== this.level.spawn });

      const sheetCache = new Map();
      /** The villagers' sprite sheets (by preset), disposed with the level. */
      this._npcSheets = sheetCache;
      this.npcs = [];
      for (const obj of this.level.objects) {
        if (obj.type !== 'npc') continue;
        try {
          const npc = new Npc({ def: npcDef(obj), tileMap: this.tileMap, sheetCache });
          npc.storyObj = obj;
          npc.talk = conversationFor(obj);
          // campaigns: the story flag this villager sets after a conversation
          npc.storyFlag = typeof obj.flag === 'string' ? obj.flag.trim() : '';
          scene.add(npc.sprite);
          this.spriteManager.add(npc.sprite);
          this.npcs.push(npc);
        } catch (err) {
          console.warn(`[Luminati] could not create NPC "${obj.id}":`, err);
        }
      }
      this.critters = new Critters({
        tileMap: this.tileMap, scene, spriteManager: this.spriteManager,
        groups: this.level.objects.filter((o) => o.type === 'critters'),
      });
    }
    this.npcById = new Map(this.npcs.map((n) => /** @type {[string, Npc]} */ ([n.id, n])));
    // chickens scatter from the player and from villagers who chase them
    this._threats = [this.player.position, ...this.npcs.filter((n) => n.behaviour === 'chase').map((n) => n.position)];
    this._npcCtx = { player: this.player.position, chickens: this.critters.chickens };
    this._critterCtx = { player: this.player.position, threats: this._threats };
    // far actors are throttled on big levels only (a small level keeps its exact behaviour)
    this._throttle = this.world.batching ? { far2: FAR_ACTOR_DISTANCE ** 2, every: FAR_EVERY, frame: 0, npcDt: new Float32Array(this.npcs.length) } : null;
    if (this._throttle) this.critters.throttle = { focus: this.rig.focusPoint, far2: FAR_ACTOR_DISTANCE ** 2, every: FAR_EVERY };
    // the UI's fonts and the glyphs of this level's names and of the game's own lines, before the
    // combat UI is made and the HUD laid out (docs/specs/PIXEL_UI.md §3, I18N.md §5)
    await this._fontsIn(glyphs);
    // combat level: foes, the GLAIVE rules, FX batches, combat UI and bindings (docs/specs/GLAIVE.md §8)
    if (this.combatEnabled) {
      onProgress(0.94, t('game.load.blades'));
      await wait(0);
      const { GlaiveCombat } = await import('./glaive/GlaiveCombat.js');
      this.combat = new GlaiveCombat({ game: this });
      await this.combat.load();
    }
    // warm fill on every character / critter sprite (fades down at night)
    // big level (and every combat level): every blob contact shadow in one instanced draw call (a
    // busy view holds dozens)
    const batchActors = this.world.batching || !!this.combat;
    // (a level set aside keeps its batch: its actors' blobs are adopted already)
    this.blobs = kept ? kept.blobs : batchActors ? new BlobBatch() : null;
    const actors = this._actorSprites();
    if (this.combat) actors.push(...this.combat.actorSprites);
    /** The actors' warm-fill registrations (released with the level, or when it is set aside). */
    this._actorEmissives = [];
    for (const s of actors) {
      // (character sprites are lit: MeshLambertMaterial)
      this._actorEmissives.push(this.lighting.registerEmissive(/** @type {THREE.MeshLambertMaterial} */ (s.material), SPRITE_FILL));
      if (kept) continue;
      // big / combat level: the sun-facing shadow quad (it draws nothing in the colour pass) only
      // takes a draw call in the shadow pass
      if (batchActors && s.shadowProxy) makeShadowOnly(s.shadowProxy, [this.lighting.sun]);
      this.blobs?.adopt(s);
    }
    if (this.blobs?.mesh) engine.scene.add(this.blobs.mesh);

    if (this.weather) this.weather.setWorld(this.world);
    else this.weather = new Weather({ lighting: this.lighting, particles: this.particles, postfx: this.postfx, godRays: this.godRays, world: this.world });
    // (its water sample points are the level's: kept with it)
    this.audioDirector = kept?.audioDirector ?? new AudioDirector({
      audio: this.audio, lighting: this.lighting, weather: this.weather, tileMap: this.tileMap,
      // (both live arrays: a story's campfires and waterfalls come and go in them)
      fires: this.world.fires, falls: this.world.fallAnchors,
    });

    // ---- HUD ----
    const ui = this.ui;
    ui.hud.setControls(this._controls());
    // combat: the combat legend (keyboard or pad; with the journal line when there is a story, the
    // party's once someone joined), vitals and skill slots
    if (this.combat) {
      const extra = this._legendExtra();
      if (extra.length) this.combat.legendExtra = extra;
    }
    this.combat?.setupUI();
    // (names translated at display: the level keeps its English — I18N.md §4.5)
    ui.hud.setLocation(...this._levelPlate());
    // campaigns: the level's exits (Space ones become interactables of the world)
    this.campaign?.attachWorld(this.world);
    this._setupMaps(kept);
    // the story: the level's events, talk scripts, who is there as the story stands
    this.story?.attachLevel(this.campaign?.levelId ?? this._storyLevelId());
    // the party's members arrive with the player (docs/specs/PARTY.md §4) — and its G key: a combat
    // level left put back the bindings it saved at its load, from before the party was made
    if (this.party) this._bindParty();
    this.party?.attachLevel();
    // the maps' villagers and the chickens' threats: who is there now (a kept level's villager the
    // story had taken before it was set aside changes nothing on attach — a ghost map dot else)
    this.refreshActors();
    return { earlyCompile };
  }

  /**
   * The sprites of a level's traveler, villagers and critters (a new array).
   * @param {{ player?: Player|null, npcs?: Npc[]|null, critters?: Critters|null }} [of] the
   *   level played now, or one detached
   * @returns {import('../engine/sprite/Sprite3D.js').Sprite3D[]}
   */
  _actorSprites(of = this) {
    const out = of.player ? [of.player.sprite] : [];
    for (const n of of.npcs ?? []) out.push(n.sprite);
    for (const c of of.critters?.all ?? []) out.push(c.sprite);
    return out;
  }

  /**
   * Japanese and Chinese: start loading the font slices of what the level shows first (`_shownTexts`:
   * CJK faces come in unicode-range slices; `fonts.ensure` loads the missing ones, I18N.md §5) —
   * while the world builds; `_fontsIn` awaits them before the HUD's first layout. Null in English
   * (the Latin set holds every glyph) or without a font loader. The texts are looked up
   * `quietly` (I18N.md §4.2): nothing is shown yet, so an untranslated one is no miss now — it is
   * one when the game shows it.
   * @returns {Promise<void>|null}
   */
  _glyphsFor() {
    const fonts = this.ui.fonts;
    if (!isCJK(getLang()) || typeof fonts?.ensure !== 'function') return null;
    return fonts.ensure(quietly(() => this._shownTexts()));
  }

  /**
   * The UI's fonts in before the HUD's first layout (docs/specs/PIXEL_UI.md §3): init's
   * `ui.fontsReady`, awaited once — here, after the world and the villagers are built, so the fonts
   * load meanwhile (`loadStats.fontsWait`: how long the build still waited) — and the glyphs of
   * what the level shows first (`_glyphsFor`, started with the build; `loadStats.glyphsWait`).
   * @param {Promise<void>|null} glyphs
   */
  async _fontsIn(glyphs) {
    if (this._fontsPending) {
      const t0 = performance.now();
      await this._fontsPending;
      this._fontsPending = null;
      this.loadStats.fontsWait = Math.round(performance.now() - t0);
    }
    if (glyphs) {
      const t0 = performance.now();
      await glyphs;
      this.loadStats.glyphsWait = Math.round(performance.now() - t0);
    }
  }

  /**
   * What the level shows first, as the player reads it — read from the level's data, before
   * anything is built, through the lookups the display uses (the same keys and names; nothing the
   * game never shows is asked — `_glyphsFor` runs it `quietly`): its name and subtitle, the title
   * screen's texts (a single level's), its regions', villagers' and signs' words, the prompts of its
   * Space exits (a campaign's) and Space events (with a story), the shipped levels' names and the
   * core UI tables of the page's language (the HUD's, the dialogue's, the maps', the title's and the
   * game's lines).
   * @returns {unknown[]} strings and string tables (`fonts.ensure` reads their JSON)
   */
  _shownTexts() {
    const L = this.level;
    /** @type {unknown[]} */
    const out = [...this._levelPlate()];
    if (!this.campaign) out.push(...Object.values(this._titleTexts()));
    for (const o of L.objects) {
      if (o.type === 'region') {
        out.push(term(o.name), loc(textKeyOf(o, 'sub'), o.sub, 'title'), loc(textKeyOf(o, 'banner'), o.banner, 'title'));
      } else if (o.type === 'npc') {
        const def = npcDef(o);
        out.push(villagerName({ name: def.name, def }), speakerTitle({ def }));
      } else if (o.type === 'signpost') {
        out.push(o.speaker == null ? t('game.default.signpost') : term(o.speaker));
      } else if ((o.type === 'exit' && this.campaign && o.mode === 'use') || (o.type === 'event' && this.story && (o.on ?? 'use') === 'use')) {
        if (typeof o.label === 'string' && o.label.trim()) out.push(promptLabel({ label: o.label.trim(), object: o }));
      }
    }
    for (const l of SHIPPED_LEVELS) out.push(term(l.label));
    out.push(...coreStringsOf(getLang()));
    return out;
  }

  /**
   * A world for `level` built ahead of a campaign's travel (CampaignRuntime's preparation,
   * LevelPreparation, KNOWN_ISSUES CMP-01): made with `defer`, so the preparation can run its
   * `buildSteps({ paced: true })` in slices while this level plays without anything reaching the
   * running game; `swapLevel(level, { prepared })` attaches it.
   * @param {Level} level the level as it will be played (the story applied)
   * @param {(o: LevelObject) => boolean} present is an object there as the story stands in that
   *   level (the runner reads the level played now until the travel)
   * @returns {World}
   */
  prepareWorld(level, present) {
    return new World({
      engine: this.engine, textures: this.textures, lighting: this.lighting, particles: this.particles, godRays: this.godRays, level, lightPool: this.lightPool,
      story: this.story ? { present } : null, defer: true,
    });
  }

  /**
   * A campaign level set aside (CAMPAIGN_FORMAT.md §6.3, `swapLevel` with `keep`): detached from
   * the running game, nothing disposed — its world (`World.detach`), traveler, villagers, critters,
   * contact-shadow batch, ambience and painted map — until a travel attaches it again
   * (`swapLevel` with `kept`) or the campaign drops it (`disposeKept`).
   * @typedef {object} KeptLevel
   * @property {Level} level   the level as it was played (the story applied)
   * @property {string} source  where it came from (`campaigns/<c>/levels/<file>.json`)
   * @property {World} world
   * @property {Player} player
   * @property {Npc[]} npcs
   * @property {Critters} critters
   * @property {BlobBatch|null} blobs
   * @property {Map<string, any>|null} sheets  the villagers' sprite sheets
   * @property {AudioDirector|null} audioDirector
   * @property {ReturnType<typeof renderLevelMap>|null} levelMap   the painted level map (LevelMap), reused while `mapKey` holds
   * @property {string} mapKey  the story presence it was painted for (`_mapKey`)
   * @property {any[]} emissives  (empty: the actors' warm fill is registered again on attach)
   */

  /**
   * Switch to another level of the campaign without a reload (CampaignRuntime.travel, behind the
   * fader): the current level's world, characters and combat are released — combat first, so its
   * UI and bindings are gone before a next combat level installs its own — the new level is built
   * (the old world is disposed only once the new one exists, so the shader programs both use stay
   * compiled) and its programs are compiled before play goes on.
   *
   * Levels set aside (CAMPAIGN_FORMAT.md §6.3): with `keep`, the level left is not released but
   * detached and returned (`aside`) for the campaign to keep — never a combat level; with `kept`,
   * the level is not built: that level, set aside on an earlier visit, is attached again (its
   * programs are compiled and were drawn: no warm-up, `KEPT_FRAMES` frames). A failure releases
   * both — the level left and the one being attached — and throws (the caller's rollback builds
   * the level left again from its file).
   * @param {Level} level a normalised level (the story applied; `kept.level` with `kept`)
   * @param {{ spawn?: { x: number, z: number, facing?: string }, source?: string,
   *   onProgress?: (fraction: number, label: string) => void, prepared?: LevelPreparation|null,
   *   kept?: KeptLevel|null, keep?: boolean }} [opts]
   *   spawn: where the player arrives (default the level's player start); prepared: the level's
   *   world built ahead (`prepareWorld`; used when `prepared.level` is `level`); kept: the level
   *   set aside to attach again; keep: set the level left aside instead of releasing it
   * @returns {Promise<{ aside: KeptLevel|null }>} aside: the level left, set aside (`keep`)
   */
  async swapLevel(level, { spawn = level.spawn, source = '', onProgress = () => {}, prepared = null, kept = null, keep = false } = {}) {
    const prevMode = this.mode;
    this.mode = 'travel';
    this.toggleMap(false);
    this.ui.prompt.hide();
    if (this.photoMode) this.togglePhotoMode({ instant: true });
    const t0 = performance.now();
    // (never a combat level: its GlaiveCombat goes with the detach; a campaign only — a world
    // needs the shared light pool to be detached)
    const keepOld = keep && !this.combatEnabled && !!this.lightPool;
    const old = this._detachLevel();
    /** @type {KeptLevel|null} */
    let aside = null;
    if (keepOld) {
      try {
        aside = this._setAside(old);
      } catch (err) {
        console.warn('[Luminati] setting the level aside failed (it is released instead):', err);
      }
    }
    this.source = source;
    this._applyLevel(level);
    this._applyBackdrop();
    const rig = this.rig;
    rig.minDistance = this.camera.minDistance;
    rig.maxDistance = this.camera.maxDistance;
    rig.bounds = { ...this.cameraBounds.mid };
    let earlyCompile;
    try {
      ({ earlyCompile } = await this._buildLevel(onProgress, { t0, spawn, prepared, kept }));
    } catch (err) {
      // the level left is released either way (set aside or not) — the caller's rollback builds
      // it again from its file — and so is a level set aside that was being attached; what of a
      // new one was made before the failure goes with the rollback's own detach (else every
      // failed travel left a copy of a level in the scene)
      for (const b of [old, kept]) {
        if (!b) continue;
        try {
          this._disposeDetached(b);
        } catch (err2) {
          console.error('[Luminati] releasing a level after a failed build:', err2);
        }
      }
      // (what the game still points at of them is not released twice by the rollback's detach)
      this._forget([old, kept]);
      throw err;
    }
    // (the old world's god-ray shafts go with it: World.dispose)
    if (!aside) this._disposeDetached(old);
    // the arrival view: the camera on the player (the fader still hides it)
    rig.setTarget(this.player.sprite);
    rig.setAngles(0, this.camera.pitch);
    rig.distanceTarget = this.camera.distance;
    this._updateCameraBounds();
    rig.snap();
    this.world.lightPool?.snap();
    this.postfx.setFocus(this._playerFocusDistance(), true);
    if (kept) {
      // a level set aside: every program it uses was compiled and drawn when it was played (its
      // materials kept them alive meanwhile) — the compile only checks that; a frame or two
      await earlyCompile;
      await this._compileScene();
      await this._frames(KEPT_FRAMES);
    } else {
      // init's warm-up, behind the fader: rain and snow on, the one-shot bursts this level uses
      // (waterfall spray), the combat FX; every program compiled, then a few real frames drawn
      // (ANGLE finishes some programs at their first draw, the shadow pass builds its variants)
      const far = this._tmp.set(0, -1000, 0);
      this.weather.rain.intensity = 1;
      this.weather.snow.intensity = 1;
      this.particles.update(1 / 60, this.engine.camera);
      if (this.world.falls.some((f) => f.splash)) {
        this.particles.burst('splash', far, 1);
        this.particles.burst('sparkle', far, 1, { size: [0.2, 0.34] });
      }
      this.particles.burst('footstep', far, 1);
      this.combat?.warmup(far);
      await earlyCompile;
      await this._compileScene();
      const primer = this._primeShadows(); // (the depth programs, as in init: REN-13)
      await this._frames(WARM_FRAMES);
      primer.dispose();
      this.weather.rain.intensity = 0;
      this.weather.snow.intensity = 0;
      this.combat?.endWarmup();
    }
    this.mode = prevMode === 'travel' ? 'play' : prevMode;
    if (this.mode === 'play') {
      this.player.setSilhouetteEnabled(true);
      this.audioDirector.enabled = true;
      this.audioDirector.update(1, this.player.position);
    }
    this._exposeGlobal();
    this.loadStats.lastSwap = Math.round(performance.now() - t0);
    return { aside };
  }

  /**
   * Set a detached level aside (`swapLevel` with `keep`): its world out of the running game
   * (`World.detach`), its actors' sprites out of the scene and the sprite manager, their warm fill
   * out of the lighting, the contact-shadow batch out of the scene, and what a travel may leave
   * half done on the actors (a talk, a script's walk) reset. Nothing is disposed.
   * @param {ReturnType<Game['_detachLevel']>} old
   * @returns {KeptLevel}
   */
  _setAside(old) {
    old.world.detach();
    for (const e of old.emissives) e.dispose();
    old.emissives = [];
    old.blobs?.mesh?.removeFromParent();
    for (const s of this._actorSprites(old)) {
      this.spriteManager.remove(s);
      s.removeFromParent();
    }
    old.player.setTalkSilhouette(null);
    old.player.scripted = null;
    for (const n of old.npcs) {
      if (n.talking) n.endTalk();
      if (n.directed) n.release();
    }
    if (old.audioDirector) old.audioDirector.enabled = false;
    return /** @type {KeptLevel} */ (old);
  }

  /**
   * Release a level set aside that will not be played again (the campaign drops it: another level
   * set aside in its place, a travel to a level that is neither a room nor set aside, a file that
   * changed, the game's end).
   * @param {KeptLevel} kept
   */
  disposeKept(kept) {
    if (!kept) return;
    this._disposeDetached(kept);
  }

  /**
   * After a failed build: the game's level half no longer points at what of `bundles` was
   * released (the rollback's `_detachLevel` would release it a second time).
   * @param {(Partial<KeptLevel>|null)[]} bundles
   */
  _forget(bundles) {
    for (const b of bundles) {
      if (!b) continue;
      if (this.world === b.world) this.world = null;
      if (this.player === b.player) this.player = null;
      if (this.npcs === b.npcs) this.npcs = [];
      if (this.critters === b.critters) this.critters = null;
      if (this.blobs === b.blobs) this.blobs = null;
      if (this._npcSheets === b.sheets) this._npcSheets = null;
      if (this.audioDirector === b.audioDirector) this.audioDirector = null;
    }
    // (the warm-fill registrations of a failed level are released by the rollback's detach; those
    // of the bundles were released with them)
    if (bundles.some((b) => b && this._actorEmissives === b.emissives)) this._actorEmissives = [];
  }

  /**
   * Resolves after `n` frames have been drawn (the engine's `afterRender`; at most ~1 s in all, in
   * case the page is hidden and draws nothing).
   * @param {number} n
   */
  _frames(n) {
    return new Promise((resolve) => {
      let left = n;
      const done = () => { clearTimeout(timer); off(); resolve(undefined); };
      const off = this.engine.events.on('afterRender', () => { if (--left <= 0) done(); });
      const timer = setTimeout(done, 1000);
    });
  }

  /**
   * Take the current level's objects out of play (swapLevel): combat is disposed at once (its UI,
   * bindings and FX batches), the rest is returned for `_disposeDetached` once the next level exists.
   */
  _detachLevel() {
    this.story?.detachLevel();
    this.toggleJournal(false);
    // (the members' actors go with the level; their records stay — never part of a level set aside)
    if (this.party) {
      this.togglePartyMenu(false);
      this.party.detachLevel();
    }
    const old = {
      world: this.world, player: this.player, npcs: this.npcs, critters: this.critters, blobs: this.blobs,
      emissives: this._actorEmissives ?? [], sheets: this._npcSheets ?? null,
      // (what a level set aside keeps besides: `_setAside`)
      level: this.level, source: this.source, audioDirector: this.audioDirector ?? null,
      levelMap: this.levelMap ?? null, mapKey: this._mapKey ?? '',
    };
    if (this.combat) {
      try { this.combat.dispose(); } catch (err) { console.warn('[Luminati] combat dispose failed:', err); }
      this.combat = null;
      delete window.__game?.combat;
    }
    return old;
  }

  /**
   * Release a detached level (swapLevel, after the next level was built) — or a level set aside
   * (`disposeKept`).
   * @param {Partial<ReturnType<Game['_detachLevel']>>} old
   */
  _disposeDetached(old) {
    const steps = [
      () => { for (const e of old.emissives) e.dispose(); },
      () => old.blobs?.dispose(),
      () => old.critters?.dispose(this.spriteManager),
      () => { for (const n of old.npcs ?? []) { this.spriteManager.remove(n.sprite); n.dispose(); } },
      () => { for (const s of old.sheets?.values() ?? []) s.dispose?.(); },
      () => { if (old.player) { this.spriteManager.remove(old.player.sprite); old.player.dispose(); } },
      () => old.world?.dispose(),
    ];
    for (const step of steps) {
      try { step(); } catch (err) { console.warn('[Luminati] releasing the previous level failed:', err); }
    }
  }

  /**
   * The shadow pass's depth programs (KNOWN_ISSUES REN-13): `_compileScene` builds main-pass
   * programs only, and three.js builds a caster kind's depth program when one first enters the
   * sun's shadow frustum — mid-play on a level whose spawn has none of that kind nearby. One
   * shadow-only proxy per depth variant of the level's casters (ShadowCasters.primeShadowPrograms)
   * goes into the scene for the warm-up frames, which draw the shadow map; the caller disposes it.
   * @returns {{ dispose(): void }}
   */
  _primeShadows() {
    const primer = primeShadowPrograms(this.engine.scene, { lights: [this.lighting.sun] });
    this.engine.scene.add(primer.object);
    this.loadStats.shadowVariants = primer.count;
    return primer;
  }

  /** compileAsync every program of the scene for PostFX's HDR scene target (see init). */
  _compileScene() {
    const renderer = this.engine.renderer;
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.postfx.sceneTarget);
    const compiled = renderer.compileAsync(this.engine.scene, this.engine.camera);
    renderer.setRenderTarget(prevTarget);
    return compiled;
  }

  /**
   * The painted level map (LevelMap) for the HUD minimap (unless `environment.minimap` is false)
   * and the world map overlay (N / Tab), with the level's regions and points of interest. A level
   * set aside brings its painted map (`kept`): used again while the story has the same objects
   * there (`_mapPresence`).
   * @param {KeptLevel|null} [kept]
   */
  _setupMaps(kept = null) {
    const t0 = performance.now();
    const key = this._mapPresence();
    const map = kept?.levelMap && kept.mapKey === key ? kept.levelMap : renderLevelMap(this._mapLevel());
    this.levelMap = map;
    /** The story presence `levelMap` was painted for (`_mapPresence`). */
    this._mapKey = key;
    const ui = this.ui;
    ui.minimap.setMap(map, { view: 34, level: this._mapLevel() });
    ui.minimap.enabled = this.env.minimap !== false;
    this._setWorldMap(map);
    const W = this.world;
    /** @type {GameMapState} */
    this._map = {
      player: this.player.position,
      facing: this.player.facing,
      view: { x: 0, z: -1 },
      npcs: this.npcs.map((n) => n.position),
      // interactables and campfires (a live story prop's marker hides while its group is absent)
      markers: W.mapMarkers(),
    };
    // combat: enemy dots, chest markers once discovered, the boss marker
    if (this.combat) this.combat.attachMaps(this._map);
    this.loadStats.map = Math.round(performance.now() - t0);
  }

  /**
   * The minimap's and the world map's live state (`_setupMaps`; read every frame by both): the
   * combat adds `enemies` (and its chest / boss markers), the party `party` (its members' live
   * positions, docs/specs/PARTY.md §4.4).
   * @typedef {{ player: THREE.Vector3, facing: THREE.Vector3, view: { x: number, z: number },
   *   npcs: THREE.Vector3[], markers: { x: number, z: number, kind: string, hidden?: boolean }[],
   *   enemies?: any[], party?: THREE.Vector3[] }} GameMapState
   */

  /**
   * The level as the maps paint it: with a story, without the live story objects absent now (a
   * bridge not built yet).
   */
  _mapLevel() {
    const s = this.story;
    if (!s) return this.level;
    const objects = this.level.objects.filter((o) => !hasStoryCondition(o) || s.present(o));
    return objects.length === this.level.objects.length ? this.level : { ...this.level, objects };
  }

  /**
   * Which of the level's story-conditioned objects the story has there now ('1' / '0' each, in
   * level order; '' without a story): what the painted map shows of them (`_mapLevel`).
   */
  _mapPresence() {
    const s = this.story;
    if (!s) return '';
    let key = '';
    for (const o of this.level.objects) if (hasStoryCondition(o)) key += s.present(o) ? '1' : '0';
    return key;
  }

  /** Live story objects came or went (StoryRunner.applyPresence): paint the minimap and the world map again. */
  repaintLevelMap() {
    if (!this.levelMap || this.mode === 'travel') return;
    // (what came or went may stand in the way: the party's own walk grid is built again)
    this.party?.dropNav();
    const map = renderLevelMap(this._mapLevel());
    this.levelMap = map;
    this._mapKey = this._mapPresence();
    this.ui.minimap.setMap(map, { view: 34, level: this._mapLevel() });
    this._setWorldMap(map);
  }

  /**
   * A campaign's overview gained other levels' maps (CampaignRuntime._loadMaps): set the world map
   * again (the minimap keeps the level's own).
   */
  refreshWorldMap() {
    if (!this.campaign || this.mode === 'travel' || !this.levelMap || this._disposed) return;
    this._setWorldMap(this.levelMap, { campaignOnly: true });
  }

  /**
   * The world map overlay (N / Tab): the level's painted map, its name, subtitle and regions — or,
   * in a level a campaign places, the campaign's overview (every placed level on its place). The
   * names are translated here, at display (docs/specs/PIXEL_UI.md §8.1: the map renders what it
   * gets; the regions keep their English `name` in the level — `_bannersShown`, `state().region`).
   * @param {ReturnType<typeof renderLevelMap>} map the painted level map (LevelMap)
   * @param {{ campaignOnly?: boolean }} [o] campaignOnly: nothing without a campaign overview
   */
  _setWorldMap(map, { campaignOnly = false } = {}) {
    /** @param {any[]} regions */
    const named = (regions) => (Array.isArray(regions) ? regions.map((r) => (r && typeof r === 'object' ? { ...r, name: term(r.name) } : r)) : regions);
    // (combat levels: the extra legend rows — enemy, waystone, chest)
    const wm = this.campaign?.worldMap(map, this.level) ?? null;
    if (wm) {
      // (the campaign's name over the level's; the regions: the placed levels' names and this one's
      // places — all translated already, CampaignRuntime.worldMap)
      this.ui.worldMap.setMap(wm.map, { title: wm.title, subtitle: wm.subtitle, regions: wm.regions, combat: !!this.combat, origin: wm.origin });
    } else if (!campaignOnly) {
      const [title, subtitle] = this._levelPlate();
      this.ui.worldMap.setMap(map, { title, subtitle, regions: named(this.regions), ...(this.combat ? { combat: true } : {}) });
    }
  }

  /** Open / close the world map (only while playing, not during a conversation or photo mode). */
  toggleMap(open = !this.mapOpen) {
    const ui = this.ui;
    if (open && (this.mode !== 'play' || this.busy || ui.dialog.isOpen || this.photoMode || !this.levelMap || this.combat?.locksPlayer || this.partyMenuOpen)) return this.mapOpen;
    if (open === this.mapOpen) return this.mapOpen;
    this.mapOpen = open;
    if (open) {
      this.combat?.onMapOpen();
      ui.worldMap.setRegion(term(this.region));
      ui.worldMap.open();
      ui.prompt.hide();
      this.audio.playSfx('open', { volume: 0.45 });
    } else {
      ui.worldMap.close();
      this.audio.playSfx('close', { volume: 0.4 });
    }
    return this.mapOpen;
  }

  /** Per frame: the minimap follows the player; the world map redraws while open. */
  _updateMaps(dt) {
    const m = this._map;
    if (!m) return;
    const e = this.engine.camera.matrixWorld.elements;
    const vx = -e[8];
    const vz = -e[10];
    const len = Math.hypot(vx, vz) || 1;
    m.view.x = vx / len;
    m.view.z = vz / len;
    if (this.mode === 'play' && !this.photoMode) this.ui.minimap.update(m);
    if (this.mapOpen) this.ui.worldMap.update(dt, m);
  }

  /** Diorama post look tuned for this scene (DOF band around the player, warm grade, teal shadows). */
  _tunePost(S) {
    Object.assign(S.dof, { focusRange: 6, maxBlur: 13, nearScale: 1.5, farScale: 1.15, tiltShift: 0.42, tiltCenter: 0.5, tiltWidth: 0.3, bokehBoost: 1.6 });
    // threshold above 1: sunlit sprites / white hair / spray stop blooming; lantern glass still does
    Object.assign(S.bloom, { strength: 0.5, radius: 0.58, threshold: 1.05 });
    // lifted, slightly teal shadows (ARCHITECTURE §1.5), saturation compensating the lower contrast
    Object.assign(S.grade, { exposure: 1.03, contrast: 1.04, saturation: 1.3, temperature: 0.04, vignette: 0.55, grain: 0.03, shadowsTint: [-0.04, 0.05, 0.15] });
  }

  // ---------------------------------------------------------------------------------------------
  // Flow
  // ---------------------------------------------------------------------------------------------

  start() {
    // Draw a few real frames with the rain & snow emitters on while the loading screen is still
    // up: ANGLE finishes some programs only at their first real draw (and the shadow-depth
    // variants are only built by the shadow pass), so those stalls happen here, not in play.
    this._warmFrames = WARM_FRAMES;
    this.engine.start();
    if (this.autostart) this.enterGameplay({ instant: true });
    else this.showTitle();
  }

  async showTitle() {
    this.mode = 'title';
    // the title camera drifts over the level: no x-ray figure of the player on a roof
    this.player.setSilhouetteEnabled(false);
    this.lighting.paused = true;
    const rig = this.rig;
    rig.setTarget(this._cine.target);
    rig.distanceTarget = this._cine.distance;
    rig.snap();
    this.ui.title.onDismiss = () => this.audio.unlock();
    // a campaign: its title, Continue / New journey when a saved game exists (and the language row)
    if (this.campaign) {
      const campaignOpts = { ...this.campaign.titleOptions(), ...this._languageOptions() };
      await this.ui.title.show(campaignOpts);
      if (this._disposed) return;
      if (this.ui.title.destination === 'new') {
        await this.campaign.newGame();
        // (a new journey's party: none — the members a Continue brought go)
        await this.syncParty();
      }
      this.enterGameplay({ instant: false });
      return;
    }
    // (the texts translated at display — the level's own by their keys, else the UI's defaults —
    // and the shipped levels' names as terms: a shipped level offers the others as destinations,
    // COMBAT.md §13.4; the `value` is the file's slug)
    const T = this.env.title ?? {};
    const slug = this._shippedSlug();
    const opts = {
      ...this._titleTexts(),
      titleSource: T.title || this.level.name.toUpperCase(),
      ...(slug ? { destinations: SHIPPED_LEVELS.map((l) => ({ value: l.value, label: term(l.label) })), current: slug } : {}),
      ...this._languageOptions(),
    };
    await this.ui.title.show(opts);
    if (this._disposed) return;
    const dest = slug ? this.ui.title.destination : undefined;
    if (dest && dest !== slug && SHIPPED_LEVELS.some((l) => l.value === dest)) {
      const params = new URLSearchParams(window.location.search);
      params.delete('autostart');
      params.set('level', dest);
      window.location.search = params.toString();
      return;
    }
    this.enterGameplay({ instant: false });
  }

  /** The SHIPPED_LEVELS slug of this level when it was loaded from `levels/<slug>.json`, else null. */
  _shippedSlug() {
    const m = /^levels\/([^/]+)\.json$/.exec(this.source || '');
    return m && SHIPPED_LEVELS.some((l) => l.value === m[1]) ? m[1] : null;
  }

  /**
   * The title screen's language row (docs/specs/PIXEL_UI.md §8.1, I18N.md §1): every language in
   * its own script (EN · 日本語 · 中文), the page's, and the switch — saved, then the page reloads.
   * @returns {{ languages: { code: string, label: string }[], lang: string, onLanguage: (code: string) => void }}
   */
  _languageOptions() {
    return {
      languages: LANG_CODES.map((code) => ({ code, label: LANGUAGE_LABELS[code] ?? code })),
      lang: getLang(),
      onLanguage: (code) => { this.setLanguage(code); },
    };
  }

  /**
   * Switch the language (the title's language row; `__game.setLanguage`): the choice is saved
   * (`localStorage['luminati.lang']`), `?lang=` leaves the address (it would override the choice) and
   * the page reloads — there is no hot switch (I18N.md §1). The page's own language with no `?lang=`
   * to drop changes nothing.
   * @param {string} code 'en' | 'ja' | 'zh' (anything else: English)
   * @returns {string} the language saved
   */
  setLanguage(code) {
    const lang = saveLang(code);
    const params = new URLSearchParams(window.location.search);
    const hadParam = params.has('lang');
    if (!hadParam && lang === getLang()) return lang;
    params.delete('lang');
    if (hadParam) window.location.search = params.toString();
    else window.location.reload();
    return lang;
  }

  enterGameplay({ instant = false } = {}) {
    this.mode = 'play';
    this.player.setSilhouetteEnabled(true);
    this.lighting.paused = false;
    const rig = this.rig;
    rig.setTarget(this.player.sprite);
    rig.setAngles(0, this.camera.pitch);
    rig.distanceTarget = this.camera.distance;
    if (instant) {
      this._updateCameraBounds();
      rig.snap();
      this.postfx.setFocus(this._playerFocusDistance(), true);
      // ?autostart skips the title (whose key press unlocks WebAudio): unlock on the first gesture
      this._armAudioUnlock();
    }
    this.audioDirector.enabled = true;
    this.audioDirector.update(1, this.player.position);
    if (!instant && this.env.music !== false) this.audio.startMusic();
    this._later(instant ? 0.2 : 0.9, () => {
      this.ui.banner.show(...this._levelPlate(), { duration: 3.2 });
      this.ui.hud.showHelp(true);
    });
    this._bannersShown.clear();
    // the story: the level's `arrive` events (they run once the player is free) — a continued
    // game arrived before it was saved: the event runs it was in the middle of run again instead
    if (this.campaign?.hasSave) this.story?.resumePending();
    else this.story?.onArrive();
  }

  /**
   * Create the story runtime (lazily imported: a level without a story loads none of it): the
   * campaign's story and saved state, or a session-only state for a single level; its UI (journal,
   * emotes, letterbox, end card) and the journal key B.
   */
  async _createStory() {
    const { StoryRunner, StoryState, journeySeed } = await import('./story/StoryRunner.js');
    const c = this.campaign;
    const state = c ? c.state.story : new StoryState(null);
    // (a single level's story lives for the session: a seed of its own for `pick`)
    if (!c) state.seed = journeySeed();
    this.story = new StoryRunner({ game: this, story: c?.story ?? null, state, levelId: c?.levelId ?? this._storyLevelId() });
    c?.attachStory(this.story);
    this.engine.input.addBindings({ journal: ['KeyB'] }, {});
    const { storyUIClasses } = await import('./story/storyUI.js');
    this.ui.useStoryUI(storyUIClasses());
    if (this.ui.journal) this.ui.journal.onSound = (name) => this.audio.playSfx(name, { volume: 0.5 });
  }

  /**
   * The party, made on first use (its chunk, its UI, the G key): resolves to `this.party`.
   * @returns {Promise<import('./party/Party.js').Party>}
   */
  async ensureParty() {
    if (this.party) return this.party;
    this._partyLoad ??= (async () => {
      const [{ Party }, { partyUIClasses }] = await Promise.all([import('./party/Party.js'), import('./party/partyUI.js')]);
      this.ui.usePartyUI(partyUIClasses());
      this._bindParty();
      const party = new Party({ game: this });
      this.party = party;
      // the tactics panel's sounds and its close (docs/specs/PARTY.md §6.5; `openMenu` sets `onRule`)
      party.wireUI();
      // (made while a level is played: its members' actors belong to that level from now on)
      if (this.mode !== 'travel' && this.player && this.world) party.attachLevel();
      return party;
    })();
    return this._partyLoad;
  }

  /**
   * The party's key: G (`party`) — keyboard only: every pad button is taken on a combat level (and
   * the pad opens the panel through a member's talk, *Tactics…*; PARTY.md §4.4). Bound by
   * `ensureParty` and again by every level built while a party exists (a combat level's
   * GlaiveCombat puts back, when it goes, the bindings it saved at its load — from before the
   * party was made, maybe).
   */
  _bindParty() {
    this.engine.input.addBindings({ party: ['KeyG'] }, {});
  }

  /**
   * A villager of the level being played by id, actor or name (case-insensitive; names and ids
   * coerced to text: level data is untrusted), or null.
   * @param {string} who
   * @returns {Npc|null}
   */
  findVillager(who) {
    const s = String(who ?? '').trim();
    if (!s) return null;
    const byId = this.npcById?.get(s);
    if (byId) return byId;
    const low = s.toLowerCase();
    const npcs = this.npcs ?? [];
    return npcs.find((n) => typeof n.storyObj?.actor === 'string' && n.storyObj.actor.trim().toLowerCase() === low)
      ?? npcs.find((n) => String(n.id).toLowerCase() === low || String(n.name).toLowerCase() === low) ?? null;
  }

  /**
   * The villager `who` could join the party now — there as the story stands, not in the party, a
   * place free, no travel — or null. Asks nothing of a party not made yet (the join hook and the
   * story's `party join` ask it first: a refused join makes no party).
   * @param {string} who id, actor or name
   * @returns {Npc|null}
   */
  canJoin(who) {
    const npc = this.findVillager(who);
    if (!npc || !npc.present || this.mode === 'travel') return null;
    if (this.party && (this.party.find(npc.id) || !this.party.canTake(npc))) return null;
    return npc;
  }

  /**
   * The story's party records (a continued save, a new journey) into the running game: the party
   * is made when they hold a member, and its members follow them.
   */
  async syncParty() {
    if (!this.party && !this.story?.state.party?.length) return;
    const party = await this.ensureParty();
    party.syncFromState();
  }

  /**
   * The controls legend of a level without combat: the journal's line with a story, the party's
   * once someone joined. Rows `{ keys, label, id, pad? }`, the labels in the page's language.
   */
  _controls() {
    const party = this.party?.count ? [PARTY_CONTROL] : [];
    if (this.story) return controlRows([...CONTROLS.slice(0, 6), JOURNAL_CONTROL, ...party, ...CONTROLS.slice(6)]);
    return controlRows(party.length ? [...CONTROLS.slice(0, 6), ...party, ...CONTROLS.slice(6)] : CONTROLS);
  }

  /** The lines the game adds to the combat legend (`combat.legendExtra`), the labels translated. */
  _legendExtra() {
    return controlRows([...(this.story ? [JOURNAL_CONTROL] : []), ...(this.party?.count ? [PARTY_CONTROL] : [])]);
  }

  /** The party changed (a join, a leave): the controls legend gains / loses *G — Party*. */
  refreshPartyLegend() {
    if (!this.ui || !this.player || this.mode === 'travel') return;
    const combat = this.combat;
    if (combat) {
      combat.legendExtra = this._legendExtra();
      combat.refreshLegend();
    } else this.ui.hud.setControls(this._controls());
  }

  /** Is the party's tactics panel open? (Play pauses meanwhile, like the journal.) */
  get partyMenuOpen() {
    return !!this.party?.menuOpen;
  }

  /**
   * Open / close the party's tactics panel (G, a member's *Tactics…*, the story's `party menu`):
   * open only while playing — not in a dialog, the map, the journal, photo mode, a cutscene or
   * while the combat locks the player, nor in the frame the panel closed itself in (the G press
   * that closed it) — `force` (a conversation, a script, a test) skips those. Play pauses while it
   * is open (`update`: as the journal).
   * @param {boolean} [open] default: toggle
   * @param {string} [who] the member it shows first (id, actor or name)
   * @param {{ force?: boolean }} [opts]
   * @returns {boolean} open now
   */
  togglePartyMenu(open = !this.partyMenuOpen, who, { force = false } = {}) {
    const party = this.party;
    if (!party || !this.ui.party) return false;
    if (!open) {
      party.closeMenu();
      return false;
    }
    if (this.partyMenuOpen) return true;
    if (this.mode !== 'play') return false;
    if (!force && (this.busy || this.ui.dialog.isOpen || this.photoMode || this.mapOpen || this.journalOpen
      || this.combat?.locksPlayer || this.ui.cutscene || party.closedFrame === this.engine.time.frame)) return false;
    if (!party.count) {
      this.ui.hud.toast(t('game.toast.noParty'), 1.6);
      return false;
    }
    const ok = party.openMenu(who);
    if (ok) {
      this.ui.prompt.hide();
      this.combat?.onMapOpen();
    }
    return ok;
  }

  /**
   * The party's HUD frames (once a party exists): every frame while playing; hidden in photo mode,
   * a cutscene, on the title screen and while nobody travels with the player.
   * @param {boolean} playing
   */
  _updatePartyHud(playing) {
    const frames = this.ui.party?.frames;
    if (!frames) return;
    const show = playing && !this.photoMode && !this.ui.cutscene && this.party.count > 0;
    if (show !== this._partyHudShown) {
      this._partyHudShown = show;
      frames.setVisible(show);
      if (!show) frames.update([]);
    }
    if (show) frames.update(this.party.frames());
  }

  /**
   * The level's name and subtitle as the player reads them (the HUD's plate, the arrival banner,
   * the world map's title): the name a term, the subtitle by the key the level holds
   * (`textKeyOf(level, 'subtitle')`, I18N.md §4.2).
   * @returns {[string, string]}
   */
  _levelPlate() {
    return [term(this.level.name), loc(textKeyOf(this.level, 'subtitle'), this.level.subtitle, 'title')];
  }

  /**
   * A single level's title screen texts as the player reads them (I18N.md §4.8): the level's
   * `environment.title` by the keys the level holds (`textKeyOf(level, 'title.<k>')`, I18N.md §4.2),
   * else its name (in capitals) and subtitle, else the UI's defaults. As in English, a blank title or
   * prompt takes its default; a subtitle or a credit set to '' stays blank (`??`).
   * @returns {{ title: string, subtitle: string, prompt: string, credit: string }}
   */
  _titleTexts() {
    const T = this.env.title ?? {};
    const L = this.level;
    return {
      title: T.title ? loc(textKeyOf(L, 'title.title'), T.title, 'title') : term(L.name).toUpperCase(),
      subtitle: T.subtitle != null ? loc(textKeyOf(L, 'title.subtitle'), T.subtitle, 'title')
        : L.subtitle ? loc(textKeyOf(L, 'subtitle'), L.subtitle, 'title') : t('game.default.subtitle'),
      prompt: T.prompt ? loc(textKeyOf(L, 'title.prompt'), T.prompt, 'title') : t('game.default.prompt'),
      credit: T.credit != null ? loc(textKeyOf(L, 'title.credit'), T.credit, 'title') : t('game.default.credit'),
    };
  }

  /**
   * What examining an interactable shows (a sign, a door, a well; a chest or a waystone on a
   * peaceful level), as the player reads it (I18N.md §4.8): the pages by the keys their object holds
   * (`keys`, read by World with `pageKeyOf`; a page without one: its English), the plate a term,
   * the code defaults standing in for blank data UI strings (`game.default.*`) — and *Nothing of
   * note.* for an interactable without text. The pages of an interactable without `keys` (one
   * another module made) are shown as they are.
   * @param {import('./World.js').Interactable} it
   * @returns {{ speaker: string, lines: string[] }}
   */
  _examineText(it) {
    const text = it.text;
    if (!text?.lines?.length) return { speaker: '', lines: [t('game.default.nothing')] };
    /** @param {string} l @param {number} k */
    const page = (l, k) => {
      if (typeof l !== 'string') return l;
      if (text.linesDefault) return t(`game.default.${text.linesDefault}`);
      if (!Array.isArray(text.keys)) return l;
      const key = text.keys[k];
      return loc(typeof key === 'string' ? key : '', l);
    };
    return {
      speaker: text.speakerDefault ? t(`game.default.${text.speakerDefault}`) : term(text.speaker),
      lines: text.lines.map(page),
    };
  }

  /** A single level's id for the story (its file slug, else its name). */
  _storyLevelId() {
    const m = /^levels\/([^/]+)\.json$/.exec(this.source || '');
    return m ? m[1] : String(this.level.name || 'level').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  }

  /** Open / close the story journal (B): only while playing, not during a conversation or the map. */
  toggleJournal(open = !this.journalOpen) {
    const j = this.ui.journal;
    if (!j || !this.story) return false;
    if (open && (this.mode !== 'play' || this.busy || this.ui.dialog.isOpen || this.photoMode || this.mapOpen || this.combat?.locksPlayer || this.partyMenuOpen)) return this.journalOpen;
    if (open === this.journalOpen) return this.journalOpen;
    // (the journal plays its own open / close sounds: `onSound`)
    if (open) {
      j.setData(this.story.journalData());
      j.open('quests');
      this.ui.prompt.hide();
      this.combat?.onMapOpen();
    } else j.close();
    return this.journalOpen;
  }

  /** Is the story journal open? */
  get journalOpen() {
    return !!this.ui?.journal?.isOpen;
  }

  /**
   * The villagers' presence changed (the story): chickens flee only from villagers who are there,
   * the minimap shows only them.
   */
  refreshActors() {
    // (a villager the party holds is not there: its member is — docs/specs/PARTY.md §4.1)
    const party = this.party;
    const present = this.npcs.filter((n) => n.present && !party?.holds(n));
    if (this._threats) {
      this._threats.length = 0;
      this._threats.push(this.player.position, ...present.filter((n) => n.behaviour === 'chase').map((n) => n.position));
      // (chickens scatter from the party's members too)
      if (party) this._threats.push(...party.mapPositions());
    }
    if (this._map) {
      this._map.npcs = present.map((n) => n.position);
      // the maps' party dots: the members' live positions (§4.4)
      if (party) this._map.party = party.mapPositions();
    }
  }

  /** Back to the title screen (a story's `ending`): the page starts again (a campaign: Continue / New journey). */
  returnToTitle() {
    const params = new URLSearchParams(window.location.search);
    for (const k of ['autostart', 'new', 'story', 'entrance']) params.delete(k);
    window.location.search = params.toString();
  }

  /** setTimeout that dispose() cancels. */
  _later(seconds, fn) {
    const id = setTimeout(() => {
      this._timeouts.delete(id);
      if (!this._disposed) fn();
    }, seconds * 1000);
    this._timeouts.add(id);
    return id;
  }

  _armAudioUnlock() {
    if (this._removeAudioUnlock || this.audio.ready) return;
    const unlock = (e) => {
      this._removeAudioUnlock?.();
      this.audio.unlock();
      // the level's music starts like after the title screen (?autostart: editor play-tests) —
      // unless that first key is the music key itself, which toggles it on in the same frame
      const musicKey = e?.type === 'keydown' && (this.engine?.input?.bindings?.music ?? ['KeyM']).includes(e.code);
      if (this.mode === 'play' && this.env.music !== false && !this.audio.musicPlaying && !musicKey) this.audio.startMusic();
    };
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('pointerdown', unlock, true);
    this._removeAudioUnlock = () => {
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('pointerdown', unlock, true);
      this._removeAudioUnlock = null;
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Actions (keys, __game API)
  // ---------------------------------------------------------------------------------------------

  cycleTime() {
    const p = this.weather.cycleTime();
    // (the preset's phase name as the clock writes it: Weather.js TIME_PRESETS `id`, HUD.js `phaseName`)
    this.ui.hud.toast(phaseName(p.id), 1.6);
    return p.h;
  }

  /** Set the hour (non-numbers are ignored). Returns the current time of day. */
  setTime(h) {
    this.weather.setTime(h);
    return this.lighting.timeOfDay;
  }

  setWeather(name) {
    return this.weather.setWeather(name);
  }

  cycleWeather() {
    const w = this.weather.cycleWeather();
    // (in a room the weather changes outside: none shows in here — LevelLook.shownWeather; whole
    // sentences per weather, no words glued in code)
    this.ui.hud.toast(t(`game.toast.${this.weather.indoors ? 'outside' : 'weather'}.${w}`), 1.6);
    return w;
  }

  setMusic(on) {
    // (a campaign's next level starts the music again unless the player turned it off)
    this.musicWanted = !!on;
    // combat levels restart the track combat wants (battle / boss while fighting)
    if (on) this.audio.startMusic(this.combat ? { track: this.combat.musicTrack } : undefined);
    else this.audio.stopMusic();
    return this.audio.musicPlaying;
  }

  /**
   * Photo mode hides the UI (not while a conversation is running: the dialog would be hidden but
   * still waiting for input). From the keyboard a short hint shows first; `instant` (automation)
   * hides the UI right away.
   */
  togglePhotoMode({ instant = false } = {}) {
    if (!this.photoMode && (this.busy || this.ui.dialog.isOpen || this.mode !== 'play' || this.mapOpen || this.partyMenuOpen)) return this.photoMode;
    // combat levels: no photo mode in a fight (COMBAT.md §6.12)
    if (!this.photoMode && (this.combat?.engaged || this.combat?.locksPlayer)) {
      this.ui.hud.toast(t('game.toast.foes'), 1.6);
      return this.photoMode;
    }
    this.photoMode = !this.photoMode;
    clearTimeout(this._photoTimer);
    this._timeouts.delete(this._photoTimer);
    if (this.photoMode) {
      this.ui.prompt.hide();
      if (instant) this.ui.setVisible(false);
      else {
        this.ui.hud.toast(t('game.toast.photo'), 1.6);
        this._photoTimer = this._later(1.2, () => { if (this.photoMode) this.ui.setVisible(false); });
      }
    } else this.ui.setVisible(true);
    return this.photoMode;
  }

  /**
   * Move the player to (x, z). A spot the player can't stand on (water, inside a house, off the
   * map) snaps to the nearest standable point within 3 u; returns null (and doesn't move) if none.
   */
  teleport(x, z) {
    const spot = this._standable(Number(x), Number(z));
    if (!spot) return null;
    this.player.teleport(spot.x, spot.z);
    // combat: the lock releases and the camera focus vectors jump with the player
    this.combat?.onTeleport();
    // the party's members with the player
    this.party?.onTeleport();
    this._updateCameraBounds();
    this.rig.snap();
    // pooled point lights jump to the new surroundings (no fade from the old spot)
    this.world.lightPool?.snap();
    this.postfx.setFocus(this.mode === 'play' ? this._playerFocusDistance() : this.rig.focusDistance, true);
    return { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z };
  }

  /**
   * A spawn that isn't standable (water, a wall, off the map — e.g. a level edited carelessly)
   * moves to the nearest standable spot, so a sparse or broken level still starts. `quiet`: no
   * console warning (a campaign arrival, which may land a little off the walkable ground).
   * @param {{ quiet?: boolean }} [opts]
   */
  _ensureStandingSpawn({ quiet = false } = {}) {
    const p = this.player.position;
    const spot = this._nearestStandable(p.x, p.z);
    if (spot && (spot.x !== p.x || spot.z !== p.z)) {
      if (!quiet) console.warn(`[Luminati] spawn (${p.x}, ${p.z}) is not standable; moved to (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)})`);
      this.player.teleport(spot.x, spot.z);
    }
  }

  /**
   * The standable spot nearest to (x, z): within 3 u (`_standable`), else the nearest walkable tile
   * anywhere on the map that has one; null when the map has none.
   * @param {number} x @param {number} z
   */
  _nearestStandable(x, z) {
    let spot = this._standable(x, z);
    if (spot) return spot;
    let best = Infinity;
    this.tileMap.forEachTile((i, j, t) => {
      if (!t.walkable) return;
      const d = (i + 0.5 - x) ** 2 + (j + 0.5 - z) ** 2;
      if (d >= best) return;
      const s = this._standable(i + 0.5, j + 0.5);
      if (s) { best = d; spot = s; }
    });
    return spot;
  }

  _standable(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    const tm = this.tileMap;
    const r = this.player.radius;
    const ok = (px, pz) => tm.isWalkable(px, pz) && tm.isWalkable(px + r, pz) && tm.isWalkable(px - r, pz)
      && tm.isWalkable(px, pz + r) && tm.isWalkable(px, pz - r);
    if (ok(x, z)) return { x, z };
    for (let d = 0.25; d <= 3.001; d += 0.25) {
      const n = Math.max(8, Math.round(d * 12));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const px = x + Math.cos(a) * d;
        const pz = z + Math.sin(a) * d;
        if (ok(px, pz)) return { x: px, z: pz };
      }
    }
    return null;
  }

  async restUntilMorning() {
    const wasBusy = this.busy;
    this.busy = true;
    try {
      await this.ui.fader.fadeOut(1.0);
      // a campaign's level with its own hour (an inn's room) keeps it: the morning is outside
      const h0 = this.campaign ? this.campaign.hour() : this.lighting.timeOfDay;
      if (!(this.campaign && this.env.clock === false)) this.weather.setTime(8.0);
      this.campaign?.onRest();
      this.story?.rested(h0);
      this.audio.playSfx('chime', { volume: 0.6 });
      await wait(0.7);
      await this.ui.fader.fadeIn(1.1);
      this.ui.hud.toast(t('game.toast.rested'), 2.2);
    } finally {
      this.busy = wasBusy;
    }
  }

  /**
   * Walk-free talk (for scripts): place the player beside the NPC and start the dialogue.
   * Returns false for an unknown id, or while another conversation / fade / photo mode is active
   * or the party's tactics panel is open.
   */
  talkTo(id) {
    // (the party's tactics panel holds play — and the story with it — until it closes)
    if (this.partyMenuOpen) return false;
    // a party member (its villager is hidden — Continue resumes an interrupted talk this way too):
    // it steps up to the player, who stays where they are
    const villager = this.npcById.get(id);
    const member = villager?.present ? null : this.party?.members.find((m) => m.id === id && m.sprite) ?? null;
    if (member) {
      if (this.busy || this.ui.dialog.isOpen || this.mode !== 'play' || this.photoMode || member.talking || member.directed || member.combat?.active) return false;
      this.toggleMap(false);
      this.party.standBeside(member);
      this.player.faceTowards(member.position.x, member.position.z);
      this._interact({ kind: 'npc', npc: member, it: null });
      return true;
    }
    const npc = villager;
    if (!npc || !npc.present || this.busy || this.ui.dialog.isOpen || this.mode !== 'play' || this.photoMode) return false;
    this.toggleMap(false);
    const ip = npc.interactPoint;
    // side-by-side first (both faces stay visible to the camera), then in front, then behind
    const cands = [[-1.15, 0], [1.15, 0], [-0.85, 0.85], [0.85, 0.85], [0, 1.15], [0, -1.15]];
    const tm = this.tileMap;
    const clear = (x, z) => tm.isWalkable(x, z) && [[0.32, 0], [-0.32, 0], [0, 0.32], [0, -0.32]].every(([ox, oz]) => tm.isWalkable(x + ox, z + oz))
      && Math.abs(tm.getHeight(x, z) - tm.getHeight(ip.x, ip.z)) < 0.3;
    let spot = null;
    for (const [dx, dz] of cands) {
      const x = ip.x + dx;
      const z = ip.z + dz;
      if (clear(x, z)) { spot = [x, z]; break; }
    }
    if (spot) this.teleport(spot[0], spot[1]);
    this.player.faceTowards(npc.position.x, npc.position.z);
    this._interact({ kind: 'npc', npc, it: null });
    return true;
  }

  // ---------------------------------------------------------------------------------------------
  // Interaction
  // ---------------------------------------------------------------------------------------------

  /**
   * Best interactable in front of the player, or null. Returns a reused object
   * `{ kind: 'npc'|'object', npc, it }` (copy the fields to keep them).
   */
  _findInteractable() {
    const p = this.player.position;
    const f = this.player.facing;
    let bestScore = Infinity;
    let bestNpc = null;
    let bestIt = null;
    const npcs = this.npcs;
    const items = this.world.interactables;
    const n = npcs.length;
    for (let k = 0; k < n + items.length; k++) {
      const isNpc = k < n;
      const ref = isNpc ? npcs[k] : items[k - n];
      // an opened chest (combat levels) offers nothing; a villager the story took away is not there
      if (isNpc ? !ref.present : ref.disabled) continue;
      const pos = isNpc ? ref.interactPoint : ref.position;
      const radius = isNpc ? (ref.talkRadius ?? INTERACT_RANGE) : (ref.radius ?? INTERACT_RANGE);
      const dx = pos.x - p.x;
      const dz = pos.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > radius || Math.abs(pos.y - p.y) > 1.3) continue;
      const dot = d > 1e-3 ? (dx * f.x + dz * f.z) / d : 1;
      // must be (roughly) in front, unless the player stands on it
      let score = d <= 0.55 || dot >= 0.25 ? d - dot * 0.7 : Infinity;
      // a story event over a door or a sign wins at the same spot (it is what the story wants now)
      if (!isNpc && ref.storyEvent) score -= 0.3;
      // an object's `lookSpan` (a door's leaf) is a second target within the same reach: its
      // nearest point counts when faced, scored by the distance to it. A player who walks on into
      // a door stops at the wall with the door-step point `pos` behind them.
      const span = isNpc ? null : ref.lookSpan;
      if (span) {
        const q = nearestOnSpan(span, p.x, p.z);
        const lx = q.x - p.x;
        const lz = q.z - p.z;
        const ld = Math.hypot(lx, lz);
        const ldot = ld > 1e-3 ? (lx * f.x + lz * f.z) / ld : 1;
        if (ldot >= SPAN_FACING) score = Math.min(score, ld - ldot * 0.7);
      }
      if (score < bestScore) {
        bestScore = score;
        bestNpc = isNpc ? ref : null;
        bestIt = isNpc ? null : ref;
      }
    }
    // the party's members offer Talk like villagers (not while a fight, a script or a talk holds
    // one, nor while it is down — nor on the move: a party walking behind the player flashes no
    // prompts; docs/specs/PARTY.md §4.3)
    const members = this.party?.members;
    if (members) {
      for (const m of members) {
        if (!m.sprite || m.talking || m.directed || m.combat?.active || m.combat?.down || m.follow.speed > 0.5) continue;
        const pos = m.interactPoint;
        const dx = pos.x - p.x;
        const dz = pos.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > m.talkRadius || Math.abs(pos.y - p.y) > 1.3) continue;
        const dot = d > 1e-3 ? (dx * f.x + dz * f.z) / d : 1;
        const score = d <= 0.55 || dot >= 0.25 ? d - dot * 0.7 : Infinity;
        if (score < bestScore) {
          bestScore = score;
          bestNpc = m;
          bestIt = null;
        }
      }
    }
    if (!bestNpc && !bestIt) return null;
    const t = this._target;
    t.kind = bestNpc ? 'npc' : 'object';
    t.npc = bestNpc;
    t.it = bestIt;
    return t;
  }

  async _interact(target) {
    if (this.busy) return;
    const { kind, npc, it } = target;
    this.busy = true;
    this.ui.prompt.hide();
    try {
      if (kind === 'npc') {
        npc.beginTalk(this.player.position.x, this.player.position.z);
        this.player.faceTowards(npc.position.x, npc.position.z);
        if (this.party?.members.includes(npc)) {
          // a party member: its talk script, else the party conversation (docs/specs/PARTY.md §4.3)
          await this.party.talk(npc);
        } else if (this.story && npc.storyTalk) {
          // a talk script (docs/specs/STORY_SCRIPT.md)
          await this.story.talk(npc);
        } else {
          // (with a story, visits count in the story's state: `visits:` conditions read them)
          const st = this.story?.state;
          let visits;
          if (st) visits = st.visit(this.story.visitKey(npc));
          else {
            visits = this.visits.get(npc.id) ?? 0;
            this.visits.set(npc.id, visits + 1);
          }
          // the villager speaks: its name plate (translated at display), its portrait — the
          // character sheet's canvas, DialogBox crops and frames it — and its small title beside
          // the name (docs/specs/PIXEL_UI.md §8.1); another speaker (`opts.speaker`) has neither.
          // The lines come translated from the conversation (dialogue.js)
          const title = speakerTitle(npc);
          const say = (lines, opts = {}) => {
            const own = opts.speaker == null;
            const o = { speaker: own ? villagerName(npc) : term(opts.speaker), lines, portraitColor: npc.def.portraitColor };
            if (own && npc.sheet?.canvas) o.sheet = npc.sheet.canvas;
            if (own && title) o.title = title;
            return this.ui.dialog.open(o);
          };
          await npc.talk({
            say, visits, game: this, npc,
            toast: (msg) => this.ui.hud.toast(msg, 2.4),
            sfx: (n) => this.audio.playSfx(n, { volume: 0.7 }),
          });
        }
        // the villager's story flag
        if (npc.storyFlag) {
          if (this.campaign) this.campaign.setFlag(npc.storyFlag);
          else this.story?.state.setFlag(npc.storyFlag);
        }
      } else {
        // a door: face its leaf, not the door-step point (behind a player who stands at the wall)
        const q = it.lookSpan ? nearestOnSpan(it.lookSpan, this.player.position.x, this.player.position.z) : it.position;
        this.player.faceTowards(q.x, q.z);
        if (it.onInteract) {
          // combat levels: waystones rest, chests open (set by the GlaiveCombat)
          await it.onInteract(this, it);
        } else {
          if (it.text?.sfx && it.text.lines?.length) this.audio.playSfx(it.text.sfx, { volume: 0.6 });
          // a sign's, a door's, a well's text (and the defaults standing in for none) translated
          // at display: the interactable keeps the level's English
          await this.ui.dialog.open(this._examineText(it));
        }
      }
    } catch (err) {
      if (!this._disposed) console.error('[Luminati] interaction failed:', err);
    } finally {
      if (kind === 'npc') npc.endTalk();
      this.busy = false;
      this._talkCooldown = TALK_COOLDOWN;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------------------------

  /**
   * One frame of the game (the 'game' engine system, priority 0; its `t` is not used).
   * @type {(dt: number, t?: number) => void}
   */
  update(dt) {
    // (a campaign switching levels: the old level is being taken down behind the fader)
    if (this.mode === 'travel') return;
    const { engine, ui, rig, player } = this;
    const input = engine.input;
    const playing = this.mode === 'play';
    const talking = this.busy || ui.dialog.isOpen;
    if (this._talkCooldown > 0) this._talkCooldown -= dt;

    // ---- shortcuts (the game, not the UI, owns these) ----
    if (playing) {
      if (input.actionPressed('debug')) ui.debug.toggle();
      // world map: N / Tab (gamepad Back) opens it; the map key or Esc closes it
      if (this.mapOpen) {
        if (input.actionPressed('map') || input.actionPressed('cancel')) this.toggleMap(false);
      } else if (this.journalOpen) {
        // the story journal (B): B or Esc closes it
        if (input.actionPressed('journal') || input.actionPressed('cancel')) this.toggleJournal(false);
      } else if (this.partyMenuOpen) {
        // the party's tactics panel (G): G or Esc closes it (the press is the game's: consumed)
        if (input.actionPressed('party') || input.actionPressed('cancel')) {
          input.consumeAction?.('party');
          this.togglePartyMenu(false);
        }
      } else if (!talking && !this.photoMode && input.actionPressed('map')) this.toggleMap(true);
      else if (this.story && !talking && !this.photoMode && input.actionPressed('journal')) this.toggleJournal(true);
      else if (this.party && !talking && !this.photoMode && input.actionPressed('party')) {
        input.consumeAction?.('party');
        this.togglePartyMenu(true);
      }
    }
    // (the journal and the party's tactics panel pause play like the map)
    const mapOpen = this.mapOpen || this.journalOpen || this.partyMenuOpen;
    // combat levels: photo mode is on an LS click, ignored while (and 0.3 s after) the move
    // vector is deflected (COMBAT.md §5.2)
    let photoPad = false;
    if (this.combat) {
      const mv = input.getMoveVector();
      this._padQuiet = Math.hypot(mv.x, mv.y) > PHOTO_PAD_DEFLECT ? 0 : this._padQuiet + dt;
      photoPad = input.actionPressed('photoPad') && this._padQuiet >= PHOTO_PAD_QUIET - 1e-6;
    }
    if (playing && !mapOpen) {
      if (input.actionPressed('help')) ui.hud.toggleHelp();
      if (!talking) {
        if (input.actionPressed('photo') || photoPad || (this.photoMode && input.actionPressed('cancel'))) this.togglePhotoMode();
        if (input.actionPressed('time')) this.cycleTime();
        if (input.actionPressed('weather')) this.cycleWeather();
        if (input.actionPressed('music')) {
          const on = this.setMusic(!this.audio.musicPlaying);
          ui.hud.toast(t(on ? 'game.toast.musicOn' : 'game.toast.musicOff'), 1.4);
        }
      }
    }

    // ---- player (and combat, COMBAT.md §4.2) ----
    // combat runs while playing without a dialog, the map or photo mode; on combat levels photo
    // mode and the combat locks (death, boss intro) also freeze the player
    const combat = this.combat;
    const active = playing && !talking && !mapOpen && !this.photoMode;
    player.frozen = !playing || talking || mapOpen || (!!combat && (this.photoMode || combat.locksPlayer));
    combat?.update(dt, active);
    player.update(dt, input);
    combat?.afterPlayer(dt, active);
    // the story: triggers, the run going on (its walks, waits, camera)
    this.story?.update(dt);
    // the party's members: the follow (the combat drives a member in a fight)
    if (playing && !mapOpen) this.party?.update(dt);
    player.setSilhouetteLevel(lerp(1, 0.5, this.lighting.nightFactor));
    // (a member in front of the player on the screen: the player's x-ray silhouette fades out — it
    // painted a pale ghost of the player over that member; docs/specs/PARTY.md §4.2)
    if (this.party) player.fadeSilhouette(this.party.coversPlayer, dt);

    // ---- interaction prompt / confirm ----
    // the villager the player can talk to (kept while talking): its x-ray silhouette where hidden
    let talkSprite = talking ? player.talkSprite : null;
    if (playing && !talking && !this.photoMode && !mapOpen && !combat?.locksPlayer) {
      const target = this._findInteractable();
      if (target) {
        // (the verb in the page's language: built-in verbs through game.prompt.<id>, data labels —
        // an exit's, an event's — through the content tables; PIXEL_UI.md §8.1)
        if (target.kind === 'npc') {
          ui.prompt.show(target.npc.sprite, t('game.prompt.talk'), { offsetY: target.npc.def.preset === 'child' ? 1.9 : 2.35 });
          talkSprite = target.npc.sprite;
        } else ui.prompt.show(target.it.prompt, promptLabel(target.it));
        if (this._talkCooldown <= 0 && input.actionPressed('confirm')) {
          input.consumeAction?.('confirm');
          this._interact(target);
        }
      } else ui.prompt.hide();
    } else if (!talking) ui.prompt.hide();
    player.setTalkSilhouette(talkSprite);
    // campaigns: walk exits, levels fetched ahead
    if (this.campaign && playing) this.campaign.update(dt, { blocked: talking || this.photoMode || mapOpen || !!combat?.locksPlayer });

    // ---- villagers & critters ----
    const pp = player.position;
    const ctx = this._npcCtx;
    const th = this._throttle;
    if (th) {
      th.frame++;
      const far = Math.max(FAR_ACTOR_DISTANCE, rig.distance * 1.15 + 4);
      th.far2 = far * far;
      if (this.critters.throttle) this.critters.throttle.far2 = th.far2;
      const fp = rig.focusPoint;
      for (let i = 0; i < this.npcs.length; i++) {
        const n = this.npcs[i];
        const d2 = (n.position.x - fp.x) ** 2 + (n.position.z - fp.z) ** 2;
        th.npcDt[i] += dt;
        if (d2 < th.far2 || n.talking || (th.frame + i) % th.every === 0) {
          n.update(Math.min(th.npcDt[i], 0.25), ctx);
          th.npcDt[i] = 0;
        }
      }
    } else for (let i = 0; i < this.npcs.length; i++) this.npcs[i].update(dt, ctx);
    this.critters.update(dt, this._critterCtx);

    // ---- camera ----
    rig.inputEnabled = playing && !talking && !mapOpen;
    if (this.mode === 'title') this._updateCinematic(dt);
    // (a story cutscene directs the camera itself: no play-camera tilt or bounds)
    else if (playing && !this.story?.ownsCamera) this._updatePlayCamera();
    rig.update(dt, input);
    this.spriteManager.update(dt);
    this.blobs?.update();

    // ---- world & atmosphere ----
    const dust = this.world.emitters.dust;
    if (dust) dust.position.set(rig.focusPoint.x, rig.focusPoint.y + 1.2, rig.focusPoint.z - 2);
    // fog scales with zoom: the fog start is fixed, so far zoom would bury the focus band in haze
    this.weather.zoomFog = clamp(((this.camera.distance - 7) / Math.max(1, rig.distance - 7)) ** 2, 0.4, 1);
    this.weather.update(dt);
    // combat look: grade / DOF offsets on top of what Weather wrote this frame
    combat?.applyLook(dt);
    if (this._warmFrames > 0) {
      this._warmFrames--;
      this.weather.rain.intensity = 1;
      this.weather.snow.intensity = 1;
      if (this._warmFrames === 0) {
        combat?.endWarmup();
        this._resolveWarm();
      }
    }
    const wv = (this._worldView ??= { focus: rig.focusPoint, camera: engine.camera });
    this.world.update(dt, wv);
    this.godRays.update(dt);
    this._waterfallFx(dt);
    this.particles.update(dt, engine.camera);
    this.resolution.update(dt);

    // ---- HUD / audio ----
    ui.hud.setTime(this.lighting.timeOfDay);
    this._updateRegion(dt);
    this._updateMaps(dt);
    // (once a party exists: its frames under the vitals / location plate)
    if (this.party) this._updatePartyHud(playing);
    this.audioDirector.update(dt, pp);
  }

  /** Gameplay camera extras: zoom-dependent bounds, the hill tilt, edge-aware yaw. */
  _updatePlayCamera() {
    const rig = this.rig;
    const p = this.player.position;
    if (!this.photoMode) {
      // high ground (Windmill Hill): tilt down a little so the blurred roofs below don't fill the frame
      const hg = this.highGround;
      rig.pitchTarget = (hg && p.y > hg.minY ? hg.pitch : this.camera.pitch) * DEG2RAD;
      // near the east / west edges don't let the camera swing out over the border forest
      // (the trees would stand between it and the player); the edge band shrinks on narrow maps so
      // Q / E still turn the camera there
      const W = this.level.width;
      const e0 = Math.min(9, W / 5);
      const e1 = e0 * (5 / 9);
      const east = smoothstep(W - e0, W - e1, p.x);
      const west = smoothstep(e0, e1, p.x);
      if (east > 0 || west > 0) {
        rig.yawTarget = clamp(rig.yawTarget, -(60 - 50 * west) * DEG2RAD, (60 - 50 * east) * DEG2RAD);
      }
    }
    this._updateCameraBounds();
  }

  /** Camera focus bounds for the current zoom (near ↔ mid ↔ far, see environment.camera.bounds). */
  _updateCameraBounds() {
    const d = this.rig.distance;
    const C = this.camera;
    const { near, mid, far } = this.cameraBounds;
    let a;
    let c;
    let t;
    if (d <= C.distance) {
      a = near;
      c = mid;
      t = clamp((d - C.minDistance) / Math.max(1e-6, C.distance - C.minDistance));
    } else {
      a = mid;
      c = far;
      t = clamp((d - C.distance) / Math.max(1e-6, C.maxDistance - C.distance));
    }
    const b = this.rig.bounds;
    b.minX = lerp(a.minX, c.minX, t);
    b.maxX = lerp(a.maxX, c.maxX, t);
    b.minZ = lerp(a.minZ, c.minZ, t);
    b.maxZ = lerp(a.maxZ, c.maxZ, t);
  }

  /** View depth of the player's chest (the DOF focus while playing). */
  _playerFocusDistance() {
    const p = this.player.position;
    const cam = this.engine.camera;
    const v = this._focusPos.set(p.x, p.y + 0.9, p.z).applyMatrix4(cam.matrixWorldInverse);
    return Math.max(1, -v.z);
  }

  _updateCinematic(dt) {
    const c = this._cine;
    c.t += dt;
    const s = c.t * 0.045;
    c.target.set(c.x + Math.sin(s) * c.driftX, c.y, c.z + Math.sin(s * 0.7 + 1) * c.driftZ);
    this.rig.yawTarget = Math.sin(c.t * 0.05) * 18 * DEG2RAD;
    this.rig.distanceTarget = c.distance + Math.sin(c.t * 0.07) * 3;
  }

  /** Spray bursts and glints at the foot of every splashing waterfall near the camera. */
  _waterfallFx(dt) {
    this._burstTimer -= dt;
    this._sparkleTimer -= dt;
    const falls = this.world.falls;
    if (!falls.length) return;
    const burst = this._burstTimer <= 0;
    const sparkle = this._sparkleTimer <= 0;
    if (!burst && !sparkle) return;
    const fp = this.rig.focusPoint;
    let any = false;
    for (let i = 0; i < falls.length; i++) {
      const f = falls[i];
      const a = f.anchor;
      // only bother when the falls could be on screen (and are there: a story's absent fall is hidden)
      if (!f.splash || f.hidden || Math.hypot(a.x - fp.x, a.z - fp.z) > 30) continue;
      any = true;
      const [fx, fz] = f.dir;
      // lateral axis across the fall (+X for a fall toward +Z)
      const rx = fz;
      const rz = -fx;
      if (burst) {
        const u = (Math.random() - 0.5) * f.width * 0.9;
        this.particles.burst('splash', this._tmp.set(f.x + rx * u + fx * 0.85, a.y + 0.05, f.z + rz * u + fz * 0.85), 4);
      }
      if (sparkle) {
        const u = (Math.random() - 0.5) * f.width * 1.4;
        this.particles.burst('sparkle', this._tmp.set(f.x + rx * u + fx * 1.1, a.y + 0.5, f.z + rz * u + fz * 1.1), 2, { size: [0.2, 0.34] });
      }
    }
    if (!any) return;
    if (burst) this._burstTimer = 0.28;
    if (sparkle) this._sparkleTimer = 0.9;
  }

  _updateRegion(dt) {
    this._regionTimer -= dt;
    if (this._regionTimer > 0 || this.mode !== 'play') return;
    this._regionTimer = 0.3;
    const p = this.player.position;
    // first matching region object wins; `minY` = only while the player stands above that height
    const r = this.regions.find((g) => p.x >= g.minX && p.x < g.maxX && p.z >= g.minZ && p.z < g.maxZ && (g.minY == null || p.y > g.minY));
    // between regions (e.g. a stretch no region covers) keep the current plate instead of
    // flashing a generic fallback
    if (!r) return;
    // (`region` and `_bannersShown` keep the English name; the plate and the banner show it translated)
    if (r.name !== this.region) {
      this.region = r.name;
      this.ui.hud.setLocation(term(r.name), r.sub ? loc(textKeyOf(r, 'sub'), r.sub, 'title') : term(this.level.name));
    }
    // arrival banner, once per region name and gameplay session: `_bannersShown` is cleared by
    // enterGameplay (after the title) and made anew by _applyLevel (a campaign's travel), so
    // walking back into a region shows none (Windmill Hill's waits for the plateau itself: its
    // region has minY, the stair below it is a separate region without a banner)
    if (r.banner && !this._bannersShown.has(r.name)) {
      this._bannersShown.add(r.name);
      this.ui.banner.show(term(r.name), loc(textKeyOf(r, 'banner'), r.banner, 'title'), { duration: 2.6 });
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Automation hooks
  // ---------------------------------------------------------------------------------------------

  state() {
    const p = this.player.position;
    const info = this.postfx.sceneInfo;
    const target = this.mode === 'play' ? this._findInteractable() : null;
    const s = {
      mode: this.mode,
      level: this.level.name,
      player: {
        x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3),
        tile: { i: Math.floor(p.x), j: Math.floor(p.z) },
        facing: this.player.sprite.direction,
        animation: this.player.sprite.animation,
        speed: +this.player.speed.toFixed(2),
      },
      region: this.region,
      time: +this.lighting.timeOfDay.toFixed(3),
      phase: this.lighting.phaseName,
      night: +this.lighting.nightFactor.toFixed(3),
      weather: this.weather.weather,
      // (what the level shows of it: 'clear' in a room)
      weatherShown: this.weather.shown,
      dialogOpen: this.ui.dialog.isOpen,
      busy: this.busy,
      photoMode: this.photoMode,
      mapOpen: this.mapOpen,
      music: this.audio.musicPlaying,
      audioReady: this.audio.ready,
      nearest: target ? (target.kind === 'npc' ? target.npc.id : target.it.id) : null,
      drawCalls: info.calls,
      triangles: info.triangles,
      fps: +this.engine.time.fps.toFixed(1),
      pointLights: this.world.lights.length,
      activeLights: this.world.lightPool?.activeCount ?? this.world.lights.length,
      renderScale: +this.engine.renderScale.toFixed(2),
      pixelRatio: +this.engine.pixelRatio.toFixed(3),
      gpuMs: +this.resolution.gpuMs.toFixed(2),
      camera: { yaw: +(this.rig.yaw / DEG2RAD).toFixed(1), pitch: +(this.rig.pitch / DEG2RAD).toFixed(1), distance: +this.rig.distance.toFixed(2), focus: this.rig.focusPoint.toArray().map((v) => +v.toFixed(2)) },
      inventory: { ...this.inventory },
      // the page's language and its UI fonts (docs/specs/I18N.md §1, §5): where each set came from
      lang: getLang(),
      fonts: this._fontsState(),
    };
    // combat levels only (COMBAT.md §20.2)
    if (this.combat) s.combat = this.combat.state();
    // campaigns only (docs/specs/CAMPAIGN_FORMAT.md)
    if (this.campaign) s.campaign = this.campaign.info();
    // a story only (docs/specs/STORY_SCRIPT.md)
    if (this.story) s.story = this.story.info();
    // once a party exists (docs/specs/PARTY.md)
    if (this.party) s.party = this.party.info();
    return s;
  }

  /**
   * The UI fonts for `state().fonts`: the mode, the scale and each set's source (google / local /
   * none / pending), the ms they took (null until in); null without a font loader.
   * @returns {{ mode: string, px: number, sources: Record<string, string>, ms: number|null }|null}
   */
  _fontsState() {
    const r = this.ui?.fonts?.report;
    return r ? { mode: r.mode, px: r.px, sources: { ...r.sources }, ms: r.ms } : null;
  }

  /**
   * `__game.state()`: a snapshot for assertions (docs/specs/AUTOMATION_API.md §3.3; `combat` on
   * combat levels only, §3.5).
   * @typedef {ReturnType<Game['state']>} GameState
   */

  /**
   * `window.__game` (docs/specs/AUTOMATION_API.md §3): the game's objects and thin wrappers of its
   * actions for scripts. Set at the end of `init()` (before the title / play starts), deleted on
   * dispose; absent when the level failed to load. Built by `_exposeGlobal` below.
   * @typedef {object} GameHooks
   * @property {Game} game  the Game itself (everything below is reachable from it)
   * @property {Game['engine']} engine  renderer, scene, camera, input, time, systems
   * @property {Game['rig']} rig  CameraRig (yaw, pitch, distance, focusPoint, bounds …)
   * @property {Game['postfx']} postfx  PostFX (settings, sceneInfo, enableTimings / timings)
   * @property {Game['lighting']} lighting  LightingSystem (timeOfDay, nightFactor, phaseName,
   *   timeSpeed …)
   * @property {Game['ui']} ui  the DOM overlay (dialog, hud, banner, title, prompt, maps, debug)
   * @property {Game['audio']} audio  AudioSystem (ready, musicPlaying, playSfx)
   * @property {Game['tileMap']} tileMap  TileMap (getHeight, isWalkable, tileAt, colliders)
   * @property {Game['textures']} textures  the TextureLibrary
   * @property {Game['particles']} particles  Particles
   * @property {Game['godRays']} godRays  GodRays
   * @property {Game['player']} player  Player (position, facing, speed, sprite)
   * @property {Game['npcs']} npcs  the villagers (id, name, position, behaviour, talking)
   * @property {Game['world']} world  World (built, interactables, lights, lightPool, stats …)
   * @property {Game['weather']} weather  Weather (weather, time, snowCover, tuning)
   * @property {Game['level']} level  the normalised level being played
   * @property {Game['source']} levelSource  where it came from: `levels/<slug>.json` or
   *   `local:<slot>`
   * @property {Game['setTime']} setTime  jump to hour h (wrapped to 0–24; non-numbers ignored) →
   *   the hour
   * @property {Game['teleport']} teleport  move the player to (x, z) or the nearest standable spot
   *   within 3 u → { x, y, z } | null
   * @property {Game['talkTo']} talkTo  walk-free talk to NPC `id` → false when unknown / not now
   * @property {Game['setWeather']} setWeather  'clear' | 'rain' | 'snow' (unknown: no change) → the
   *   current weather
   * @property {Game['cycleTime']} cycleTime  glide to the next time preset (toast) → its hour
   * @property {Game['cycleWeather']} cycleWeather  clear → rain → snow (toast) → the new weather
   * @property {(on: boolean) => boolean} setMusic  start (truthy) / stop the music → music wanted
   * @property {(on?: boolean) => boolean} photo  enter / leave photo mode with the UI hidden at
   *   once (default: toggle) → photo mode
   * @property {(on?: boolean) => boolean} map  open / close the world map (default: toggle) → open
   * @property {Game['setLanguage']} setLanguage  the title's language switch: save 'en' | 'ja' |
   *   'zh' as the player's choice, drop `?lang=` and reload the page (unsaved play is lost; the
   *   page's own language without `?lang=`: nothing) → the language saved
   * @property {() => GameState} state  the snapshot above
   * @property {GlaiveHooks} [combat]  combat levels only: the turn-based combat's test hooks
   *   (docs/specs/GLAIVE.md §10)
   * @property {CampaignHooks} [campaign]  campaigns only: travel, story flags, saves (§3.6)
   * @property {import('./story/StoryRunner.js').StoryHooks} [story]  a story only: values, scripts,
   *   events, the trace (§3.7)
   * @property {import('./party/types.js').PartyHooks} party  every level: the party (made on the
   *   first `join`; docs/specs/PARTY.md §8)
   */

  /**
   * Sets `window.__game` (`GameHooks` above, the type of `Window.__game` in src/globals.d.ts: a
   * member added to the object must be added to the typedef too).
   */
  _exposeGlobal() {
    const g = this;
    window.__game = {
      engine: g.engine, rig: g.rig, postfx: g.postfx, lighting: g.lighting, ui: g.ui, audio: g.audio,
      tileMap: g.tileMap, textures: g.textures, particles: g.particles, godRays: g.godRays, player: g.player, npcs: g.npcs,
      world: g.world, weather: g.weather, game: g, level: g.level, levelSource: g.source,
      setTime: (h) => g.setTime(h),
      teleport: (x, z) => g.teleport(x, z),
      talkTo: (id) => g.talkTo(id),
      setWeather: (name) => g.setWeather(name),
      cycleTime: () => g.cycleTime(),
      cycleWeather: () => g.cycleWeather(),
      setMusic: (on) => g.setMusic(!!on),
      photo: (on = !g.photoMode) => (on !== g.photoMode ? g.togglePhotoMode({ instant: true }) : g.photoMode),
      map: (on = !g.mapOpen) => g.toggleMap(!!on),
      setLanguage: (code) => g.setLanguage(code),
      state: () => g.state(),
      party: {
        join: async (who, opts = {}) => {
          // (a refused join makes no party: the villager is looked up first)
          const npc = g.canJoin(who);
          if (!npc) return null;
          const party = await g.ensureParty();
          return party.join(npc, { cls: opts.cls, preset: opts.preset }) ? party.info() : null;
        },
        leave: (who) => !!g.party?.leave(who),
        rule: (who, rule) => g.party?.setRule(who, rule, { source: 'test' }) ?? null,
        set: (who, field, value) => g.party?.setField(who, field, value, { source: 'test' }) ?? null,
        menu: (open = !g.party?.menuOpen, who) => g.togglePartyMenu(!!open, who, { force: true }),
        info: () => g.party?.info() ?? null,
        trail: (who, max) => g.party?.trailInfo(who, max) ?? null,
        sync: async () => {
          await g.syncParty();
          return g.party?.info() ?? null;
        },
      },
    };
    // combat levels only: the combat test hooks (COMBAT.md §20.1)
    if (g.combat) window.__game.combat = g.combat.hooks;
    // campaigns only: travel, story flags, saves
    if (g.campaign) window.__game.campaign = g.campaign.hooks;
    // a story only: values, scripts, events, the trace
    if (g.story) window.__game.story = g.story.hooks;
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    for (const id of this._timeouts) clearTimeout(id);
    this._timeouts.clear();
    this._removeAudioUnlock?.();
    this._resolveWarm?.();
    this.engine?.stop();
    // game objects first (the renderer is still alive), then the engine (systems: lighting, audio;
    // the scene graph) and the UI
    const steps = [
      () => this.story?.dispose(),
      // (the campaign's levels set aside, while the renderer is alive)
      () => this.campaign?.dropAside(),
      () => this.combat?.dispose(),
      () => this.party?.dispose(),
      () => this.resolution?.dispose(),
      () => this.blobs?.dispose(),
      () => this.weather?.dispose(),
      () => this.critters?.dispose(this.spriteManager),
      () => this.npcs?.forEach((n) => n.dispose()),
      () => this.player?.dispose(),
      () => this.world?.dispose(),
      () => this.lightPool?.dispose(),
      () => this.campaign?.dispose(),
      () => this.spriteManager?.dispose(),
      () => this.godRays?.dispose(),
      () => this.particles?.dispose(),
      () => this.postfx?.dispose(),
      () => this.engine?.dispose(),
      () => this.ui?.dispose(),
    ];
    for (const step of steps) {
      try {
        step();
      } catch (err) {
        console.warn('[Luminati] dispose step failed:', err);
      }
    }
    if (window.__game?.game === this) delete window.__game;
  }
}
