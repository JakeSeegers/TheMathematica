import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LevelObjectBuilder, bridgeDeckHeight } from '../../engine/level/ObjectBuilder.js';
import { OBJECT_TYPES, objectBounds, objectCenter } from '../../engine/level/ObjectCatalog.js';
import { buildShadowCasters, isProxyCaster } from '../../engine/world/ShadowCasters.js';
import { LightPool, sanitizeLightDescriptors } from '../../engine/lighting/LightPool.js';
import { addGroundSnowCover } from '../../game/SnowCover.js';
import { waterfallDir } from '../../engine/world/Water.js';
import { SMOKE, waterfallMist } from '../../game/LevelLook.js';

/**
 * @import { LevelObject, TileRect } from '../../engine/level/types.js'
 * @import { BuiltObject } from '../../engine/level/ObjectBuilder.js'
 * @import { PropResult } from '../../engine/world/Props.js'
 * @import { Emitter, Particles } from '../../engine/fx/Particles.js'
 * @import { TileMap } from '../../engine/world/TileMap.js'
 * @import { TextureLibrary } from '../../engine/pixel/Textures.js'
 * @import { LightingSystem } from '../../engine/lighting/LightingSystem.js'
 */

/**
 * Point-light budget of the engine (all created once; see docs/contracts/LEVEL_EDITOR.md §9): the
 * preview's LightPool always has exactly this many lights, as big as the game's (MAX_POINT_LIGHTS).
 */
export const LIGHT_POOL_SIZE = 12;
/** Tiles per static-batching chunk (props of one chunk are merged per material). */
export const BATCH_CHUNK = 16;
/**
 * …on levels bigger than 64 tiles (either side): fewer, fuller merged meshes — a 128 × 128 village
 * leaves far fewer materials alone in a chunk (each one a draw call of its own, and another in the
 * shadow pass). A re-merge after an edit handles a bigger chunk, once editing pauses.
 */
export const BATCH_CHUNK_BIG = 32;
/** The batching chunk size for a level (by its TileMap). */
const batchChunkFor = (tileMap) => (tileMap && (tileMap.width > 64 || tileMap.depth > 64) ? BATCH_CHUNK_BIG : BATCH_CHUNK);
/**
 * Render layer of the original meshes of batched props: they leave layer 0 (the merged chunk
 * mesh draws them) but stay in the scene for picking (raycasts include this layer) and for the
 * selection outlines (which render their own layers).
 */
export const BATCH_LAYER = 27;

/** Softer, greyer chimney / campfire smoke than the preset (the game's look). */
/** Types whose picking needs a real mesh hit (their bounds contain a lot of empty space). */
const PRECISE_PICK = new Set(['house', 'windmill', 'marketStall', 'well', 'bridge', 'fence', 'waterfall', 'tree']);

const _box = new THREE.Box3();
const _m = new THREE.Matrix4();
const _inv = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _hitPoint = new THREE.Vector3();

/**
 * Ground samples a built prop depends on (TileMap heights / water surfaces at the points the
 * builder reads). When they change after a terrain edit the prop is rebuilt so it keeps standing
 * on the ground.
 */
export function groundKey(obj, tm) {
  const h = (x, z) => tm.getHeight(x, z);
  switch (obj.type) {
    case 'fence': return h((obj.x0 + obj.x1) / 2, (obj.z0 + obj.z1) / 2).toFixed(3);
    case 'bridge': return (obj.deckY ?? bridgeDeckHeight(tm, obj)).toFixed(3);
    case 'waterfall': {
      const [fx, fz] = waterfallDir(obj.facing);
      const surf = (x, z) => tm.getWaterSurface(x, z) ?? tm.getHeight(x, z);
      return `${surf(obj.x - fx * 0.5 + 0.01, obj.z - fz * 0.5 + 0.01).toFixed(3)}|${surf(obj.x + fx * 0.5 + 0.01, obj.z + fz * 0.5 + 0.01).toFixed(3)}`;
    }
    case 'wallTorch': {
      const r = obj.rotation ?? 0;
      return h(obj.x + Math.sin(r) * 0.6, obj.z + Math.cos(r) * 0.6).toFixed(3);
    }
    default: return h(obj.x, obj.z).toFixed(3);
  }
}

/** Translation (dx, dz) between two versions of an object when nothing but its position changed. */
function pureTranslation(a, b) {
  if (a.type !== b.type) return null;
  const def = OBJECT_TYPES[a.type];
  const keys = def.placement === 'line' ? ['x0', 'z0', 'x1', 'z1'] : def.placement === 'rect' ? ['minX', 'minZ', 'maxX', 'maxZ'] : ['x', 'z'];
  const dx = b[keys[0]] - a[keys[0]];
  const dz = b[keys[1]] - a[keys[1]];
  if (keys.length === 4 && (Math.abs(b[keys[2]] - a[keys[2]] - dx) > 1e-9 || Math.abs(b[keys[3]] - a[keys[3]] - dz) > 1e-9)) return null;
  const strip = (o) => {
    const c = { ...o };
    for (const k of keys) delete c[k];
    return JSON.stringify(c);
  };
  return strip(a) === strip(b) ? { dx, dz } : null;
}

/** Batching chunk of a level object (by its centre). */
function chunkKeyOf(obj, size = BATCH_CHUNK) {
  const c = objectCenter(obj);
  return `${Math.floor(c.x / size)},${Math.floor(c.z / size)}`;
}

/** Ground samples of a prop lie within this many tiles of its catalog bounds. */
const GROUND_REACH = 1.5;

/**
 * World bounds of what a build adds to the TileMap's placement test (its colliders and walk
 * rects), or null when it adds nothing.
 */
function placementBounds(built) {
  let b = null;
  const add = (minX, maxX, minZ, maxZ) => {
    if (!b) b = { minX, maxX, minZ, maxZ };
    else { b.minX = Math.min(b.minX, minX); b.maxX = Math.max(b.maxX, maxX); b.minZ = Math.min(b.minZ, minZ); b.maxZ = Math.max(b.maxZ, maxZ); }
  };
  for (const c of built?.colliders ?? []) {
    if (c.type === 'circle') add(c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r);
    else add(c.minX, c.maxX, c.minZ, c.maxZ);
  }
  for (const r of built?.walkRects ?? []) add(r.minX, r.maxX, r.minZ, r.maxZ);
  return b;
}

/**
 * @typedef {object} PropEntry
 * @property {string} id
 * @property {LevelObject} obj   copy of the level object it was built from (or translated to)
 * @property {string} sig        JSON signature of `obj`
 * @property {string} gkey       ground samples the current mesh stands on (see groundKey)
 * @property {BuiltObject} built LevelObjectBuilder build
 * @property {THREE.Object3D} root
 * @property {THREE.Box3} box    world AABB (picking)
 * @property {THREE.Box3} localBox bounds in the root's local frame (selection outlines)
 * @property {THREE.Matrix4} frame root world matrix of `localBox`
 * @property {PropResult['lights']} lights  light descriptors (world; `built.lights`, moved along
 *                               by a fast translation)
 * @property {boolean} exact     false after a fast translation (an exact rebuild is pending)
 * @property {Emitter[]} emitters
 *                               live particle emitters (atmosphere on; disabled while the prop
 *                               is hidden: `_emitting`)
 * @property {THREE.Material[]} emissiveMats  its registered emissive materials (one per
 *                               `built.emissives` entry; shared records in `_emissives`)
 * @property {string} chunk      batching chunk key
 * @property {{minX:number,maxX:number,minZ:number,maxZ:number}} fp  footprint (ground samples inside)
 * @property {THREE.Mesh[]|null} batched  original meshes currently drawn by a merged chunk mesh
 * @property {THREE.Mesh[]|null} shadowed lone meshes whose shadow the chunk's shadow proxy draws (big levels)
 * @property {THREE.Vector3} offset  translation applied since the build (fast translations;
 *                               new emitters follow it)
 */

/**
 * ObjectPreview — the prop-kind level objects (houses, trees, lights, fences, bridges, waterfalls…)
 * in the editor's 3D view, built one by one with LevelObjectBuilder and kept in sync cheaply:
 *  - `sync()` only looks at the objects the editor reported as changed (dirty ids; a full
 *    signature diff only after undo / redo / loads) and, after terrain edits, only at the props
 *    whose footprint touches the changed tiles (ground samples compared);
 *  - while a transaction is open (a stroke / drag) nothing is rebuilt: moved props and props whose
 *    ground moved are translated instantly, and the exact rebuilds are queued for when it ends;
 *  - builds run from a queue (`step()`, time-sliced by the viewport); replaced builds are freed a
 *    frame later (`collect()`), so their shader programs never get dropped and recompiled;
 *  - static meshes are batched per 16×16-tile chunk (32×32 on big levels; one merged mesh per
 *    material; wind-swayed foliage baked like the game's tree merging): a chunk whose props change
 *    is unbatched at once
 *    and re-merged when editing pauses. The original meshes stay in the scene on BATCH_LAYER for
 *    picking and the selection outlines.
 */
export class ObjectPreview {
  /**
   * @param {{ textures: TextureLibrary, parent: THREE.Object3D, lighting: LightingSystem }} opts
   */
  constructor({ textures, parent, lighting }) {
    this.builder = new LevelObjectBuilder({ textures, seed: 42 });
    this.lighting = lighting;
    this.object = new THREE.Group();
    this.object.name = 'Editor:props';
    parent.add(this.object);
    /** @type {Map<string, PropEntry>} */
    this.entries = new Map();
    /** Current level objects by id (buildable types only). */
    this._objs = new Map();
    /** Ids waiting for an (exact) build. */
    this._queue = new Set();
    /** Ids whose mesh is only translated (exact rebuild after the transaction). */
    this._inexact = new Set();
    this._graveyard = [];
    /**
     * The engine LightPool — the game's ranking (focus distance, priority, day penalty,
     * hysteresis), view test and crossfades. `fixed`: always LIGHT_POOL_SIZE lights, so a light
     * count change (and the shader recompiles it causes) can never happen, even when an edit
     * takes the level across the static / pooled boundary (≤ 12 descriptors: one light each, as
     * in the game).
     */
    this.lightPool = new LightPool(lighting, [], { size: LIGHT_POOL_SIZE, fixed: true });
    /** Raw → sanitised light descriptor (a prop that was not rebuilt keeps its descriptor objects). */
    this._lightCache = new WeakMap();
    this._emissives = new Map(); // material → { entry, n }
    /**
     * The registerEmissive entries of the props (windows, lantern glass), each with `baseDay` = its
     * own day level — the weather raises `day` under an overcast sky (WeatherLook.applyEmissiveDay).
     */
    this.emissiveEntries = [];
    this._particles = null;
    this._raycaster = new THREE.Raycaster();
    this._raycaster.layers.enable(BATCH_LAYER);
    this.lightsDirty = true;
    /** Object types hidden in the views (state.view.hiddenTypes). */
    this.hiddenTypes = new Set();
    /** Objects the story preview hides (src/editor/story.js). */
    this.hiddenIds = new Set();
    /** Milliseconds spent building in the last step / sync, and how many were built. */
    this.lastBuildMs = 0;
    this.lastBuilt = 0;
    this.batcher = new PropBatcher(this);
    /** Set to false to keep every prop unbatched (debugging / comparisons). */
    this.batching = true;
    /** Tiles per batching chunk (BATCH_CHUNK; BATCH_CHUNK_BIG on big levels). */
    this.batchChunk = BATCH_CHUNK;
    /**
     * Bumped whenever a build that has colliders / walk rects appears or goes (the placement test
     * of critters and enemies changes; a translated build keeps its old colliders until the exact
     * rebuild). `takePlacementChanges()` hands out the world rects concerned.
     */
    this.version = 0;
    this._placementRects = [];
  }

  /** Record that the placement test changed inside the bounds of `built` (if it has colliders / walk rects). */
  _placementChanged(built) {
    const b = placementBounds(built);
    if (!b) return;
    this._placementRects.push(b);
    this.version++;
  }

  /**
   * World rects in which built props' colliders / walk rects appeared or went since the last call
   * (the viewport re-scatters the critter / enemy groups there).
   * @returns {{minX:number,maxX:number,minZ:number,maxZ:number}[]}
   */
  takePlacementChanges() {
    if (!this._placementRects.length) return this._placementRects;
    const out = this._placementRects;
    this._placementRects = [];
    return out;
  }

  /** Another size class of level: re-key every entry's batching chunk (all re-merged later). */
  _setBatchChunk(size) {
    const B = this.batcher;
    for (const key of [...B.chunks.keys()]) B._unbatch(key);
    B.members.clear();
    B.dirty.clear();
    this.batchChunk = size;
    for (const e of this.entries.values()) {
      e.chunk = chunkKeyOf(e.obj, size);
      B.add(e);
    }
  }

  /** Number of built props. */
  get count() {
    return this.entries.size;
  }

  /**
   * Bring the props in line with the level (cheap; builds are queued — see `step`).
   * @param {LevelObject[]} objects level.objects
   * @param {TileMap} tileMap
   * @param {{ ids?: Iterable<string>|null, terrainRect?: TileRect|null,
   *           terrainAll?: boolean, dragging?: boolean }} [opts]
   *   ids: the objects that changed (null = diff every object); terrainRect / terrainAll: tiles
   *   whose terrain changed (the props standing there follow); dragging: a transaction is open —
   *   translate instead of rebuilding
   * @returns {string[]} ids that were moved, removed or queued
   */
  sync(objects, tileMap, { ids = null, terrainRect = null, terrainAll = false, dragging = false } = {}) {
    const t0 = performance.now();
    const touched = [];
    const bc = batchChunkFor(tileMap);
    if (bc !== this.batchChunk) this._setBatchChunk(bc);
    // changed here (queued / translated / removed): the terrain pass below leaves them alone.
    // Objects a full diff found unchanged are NOT in it — after an undone height stroke (a full
    // diff) the props standing there must still follow the ground.
    const handled = new Set();
    const seenIds = new Set();
    const check = (id, obj) => {
      const e = this.entries.get(id);
      if (!obj) {
        this._objs.delete(id);
        if (e || this._queue.has(id)) { this._remove(id); touched.push(id); }
        handled.add(id);
        return;
      }
      this._objs.set(id, obj);
      const sig = JSON.stringify(obj);
      if (e && e.sig === sig) return;
      handled.add(id);
      if (e && dragging) {
        const tr = pureTranslation(e.obj, obj);
        if (tr) {
          this._translate(e, JSON.parse(sig), sig, tr, tileMap);
          touched.push(id);
          return;
        }
      }
      this._queue.add(id);
      touched.push(id);
    };
    if (ids == null) {
      const seen = new Set();
      for (const obj of objects) {
        if (!LevelObjectBuilder.isBuildable(obj.type)) continue;
        seen.add(obj.id);
        check(obj.id, obj);
      }
      for (const id of [...this.entries.keys(), ...this._queue]) if (!seen.has(id)) check(id, null);
    } else {
      let byId = null;
      for (const id of ids) {
        if (seenIds.has(id) || id === 'spawn') continue;
        seenIds.add(id);
        if (!byId) byId = new Map(objects.map((o) => [o.id, o]));
        const obj = byId.get(id);
        check(id, obj && LevelObjectBuilder.isBuildable(obj.type) ? obj : null);
      }
    }
    // terrain edits: props whose ground samples moved follow the ground
    if (terrainRect || terrainAll) {
      const r = terrainRect;
      for (const e of this.entries.values()) {
        if (handled.has(e.id) || this._queue.has(e.id)) continue;
        const f = e.fp;
        if (r && (f.maxX < r.minI - GROUND_REACH || f.minX > r.maxI + 1 + GROUND_REACH || f.maxZ < r.minJ - GROUND_REACH || f.minZ > r.maxJ + 1 + GROUND_REACH)) continue;
        const g = groundKey(e.obj, tileMap);
        if (g === e.gkey) continue;
        if (dragging) this._translate(e, e.obj, e.sig, { dx: 0, dz: 0 }, tileMap, g);
        else this._queue.add(e.id);
        touched.push(e.id);
      }
    }
    // the transaction ended: translated props get their exact build
    if (!dragging && this._inexact.size) {
      for (const id of this._inexact) this._queue.add(id);
      this._inexact.clear();
    }
    if (touched.length) this.lightsDirty = true;
    this.lastSyncMs = performance.now() - t0;
    return touched;
  }

  /**
   * Run queued builds.
   * @param {TileMap} tileMap
   * @param {{ budgetMs?: number, max?: number }} [opts] stop after `max` builds or once the
   *   budget is spent (at least one build runs)
   * @returns {number} builds done
   */
  step(tileMap, { budgetMs = 8, max = Infinity } = {}) {
    if (!this._queue.size) return 0;
    const t0 = performance.now();
    let n = 0;
    for (const id of [...this._queue]) {
      if (n >= max || (n > 0 && performance.now() - t0 >= budgetMs)) break;
      this._queue.delete(id);
      const obj = this._objs.get(id);
      if (!obj) { this._remove(id); continue; }
      this._build(obj, JSON.stringify(obj), tileMap);
      n++;
    }
    this.lastBuildMs = performance.now() - t0;
    this.lastBuilt = n;
    if (n) this.lightsDirty = true;
    return n;
  }

  /** Build everything queued now (tests / loads). */
  flush(tileMap) {
    while (this._queue.size) this.step(tileMap, { budgetMs: Infinity });
  }

  /** Throw every build away and rebuild all props from `objects` at once (tests). */
  rebuildAll(objects, tileMap) {
    for (const id of [...this.entries.keys()]) this._remove(id);
    this._queue.clear();
    this._inexact.clear();
    this._objs.clear();
    this.sync(objects, tileMap, {});
    this.flush(tileMap);
  }

  /** Is mesh work still queued (builds, exact rebuilds, chunk merges)? */
  get busy() {
    return this._queue.size > 0 || this._inexact.size > 0 || this.batcher.pending;
  }

  /** Are some props only translated / not built yet (an exact rebuild is pending)? */
  get hasPendingExact() {
    return this._queue.size > 0 || this._inexact.size > 0;
  }

  _build(obj, sig, tileMap) {
    const old = this.entries.get(obj.id);
    const copy = JSON.parse(sig);
    let built = null;
    try {
      built = this.builder.build(copy, tileMap);
    } catch (err) {
      console.error(`[Viewport3D] building "${obj.id}" (${obj.type}) failed:`, err);
    }
    if (old) {
      this._placementChanged(old.built);
      this._disposeEntry(old);
    }
    this._placementChanged(built);
    this._inexact.delete(obj.id);
    if (!built) {
      this.entries.delete(obj.id);
      return null;
    }
    const root = built.object;
    // settled snow on the roofs (the game's patch, always compiled in: a weather change never
    // compiles anything)
    addGroundSnowCover(root, { roofsOnly: true });
    root.userData.levelObjectId = obj.id;
    root.traverse((o) => { o.userData.levelObjectId = obj.id; });
    this.object.add(root);
    const e = {
      id: obj.id,
      obj: copy,
      sig,
      gkey: groundKey(copy, tileMap),
      built,
      root,
      box: new THREE.Box3(),
      localBox: new THREE.Box3(),
      frame: new THREE.Matrix4(),
      lights: built.lights,
      exact: true,
      emitters: [],
      emissiveMats: [],
      chunk: chunkKeyOf(copy, this.batchChunk),
      fp: objectBounds(copy),
      batched: null,
      shadowed: null,
      offset: new THREE.Vector3(),
    };
    this._measure(e);
    root.visible = !this._hides(copy.type, obj.id);
    for (const em of built.emissives ?? []) this._addEmissive(e, em);
    if (this._particles) this._spawnEmitters(e);
    this.entries.set(obj.id, e);
    this.batcher.add(e);
    return e;
  }

  /**
   * Fast path during transactions: move the existing build (exact rebuild when it ends).
   * @param {PropEntry} e
   * @param {LevelObject} obj the object's new state (a private copy)
   * @param {string} sig
   * @param {{dx:number, dz:number}} d
   * @param {TileMap} tileMap
   * @param {string} [gkey] its ground key on the current terrain (computed when omitted)
   */
  _translate(e, obj, sig, { dx, dz }, tileMap, gkey = groundKey(obj, tileMap)) {
    const dy = groundY(gkey) - groundY(e.gkey);
    const d = new THREE.Vector3(dx, Number.isFinite(dy) ? dy : 0, dz);
    this.batcher.remove(e);
    e.offset.add(d);
    e.root.position.add(d);
    e.root.updateMatrixWorld(true);
    for (const l of e.lights) l.position.add(d);
    for (const em of e.emitters) em.position.add(d);
    e.obj = obj;
    e.sig = sig;
    e.gkey = gkey;
    e.exact = false;
    e.fp = objectBounds(obj);
    e.chunk = chunkKeyOf(obj, this.batchChunk);
    this._inexact.add(e.id);
    this._measure(e);
    this.lightsDirty = true;
  }

  _measure(e) {
    const root = e.root;
    root.updateMatrixWorld(true);
    e.frame.copy(root.matrixWorld);
    _inv.copy(root.matrixWorld).invert();
    const lb = e.localBox.makeEmpty();
    root.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      // tight bounds from the vertices: wind / billboard geometries carry padded bounding boxes
      const pos = o.geometry.getAttribute('position');
      if (!pos || !pos.count) return;
      _box.setFromBufferAttribute(pos);
      if (o.material?.isShaderMaterial) _box.expandByScalar(0.1); // flames / glows: billboard quads
      _m.multiplyMatrices(_inv, o.matrixWorld);
      _box.applyMatrix4(_m);
      lb.union(_box);
    });
    if (lb.isEmpty()) {
      // invisible props (point lights): a small box around the light / origin
      const p = e.lights[0]?.position ?? root.getWorldPosition(_v);
      _v.copy(p).applyMatrix4(_inv);
      lb.setFromCenterAndSize(_v, new THREE.Vector3(0.5, 0.5, 0.5));
    }
    e.box.copy(lb).applyMatrix4(root.matrixWorld);
  }

  _addEmissive(e, em) {
    let rec = this._emissives.get(em.material);
    if (!rec) {
      rec = { entry: this.lighting.registerEmissive(em.material, { day: em.day ?? 0, night: em.night ?? 1.6 }), n: 0 };
      rec.entry.baseDay = rec.entry.day;
      this._emissives.set(em.material, rec);
      this.emissiveEntries.push(rec.entry);
    }
    rec.n++;
    e.emissiveMats.push(em.material);
  }

  _releaseEmissives(e) {
    for (const m of e.emissiveMats) {
      const rec = this._emissives.get(m);
      if (!rec) continue;
      if (--rec.n <= 0) {
        rec.entry.dispose();
        this._emissives.delete(m);
        const i = this.emissiveEntries.indexOf(rec.entry);
        if (i >= 0) this.emissiveEntries.splice(i, 1);
      }
    }
    e.emissiveMats.length = 0;
  }

  _disposeEntry(e) {
    this.batcher.remove(e);
    this._releaseEmissives(e);
    for (const em of e.emitters) em.dispose();
    e.emitters.length = 0;
    e.root.removeFromParent();
    // freed after the next frame: the replacement renders first, so shader programs it shares
    // with the old build (flames…) stay compiled
    const built = e.built;
    this._graveyard.push(() => {
      try {
        built.dispose();
      } catch (err) {
        console.error('[Viewport3D] dispose failed:', err);
      }
    });
  }

  _remove(id) {
    this._queue.delete(id);
    this._inexact.delete(id);
    const e = this.entries.get(id);
    if (!e) return;
    this._placementChanged(e.built);
    this._disposeEntry(e);
    this.entries.delete(id);
    this.lightsDirty = true;
  }

  /** Free replaced builds (call once per frame, after rendering). */
  collect() {
    if (!this._graveyard.length) return;
    const list = this._graveyard;
    this._graveyard = [];
    for (const fn of list) fn();
  }

  // -------------------------------------------------------------------------------------------
  // Atmosphere (prop particle emitters: chimney smoke, campfire embers, waterfall mist)
  // -------------------------------------------------------------------------------------------

  /** @param {Particles|null} particles null = off */
  setParticles(particles) {
    if (particles === this._particles) return;
    for (const e of this.entries.values()) {
      for (const em of e.emitters) em.dispose();
      e.emitters.length = 0;
    }
    this._particles = particles;
    if (particles) for (const e of this.entries.values()) this._spawnEmitters(e);
  }

  _spawnEmitters(e) {
    for (const d of e.built.emitters ?? []) {
      let cfg = d;
      if (d.preset === 'smoke') cfg = { ...d, ...SMOKE };
      // (the game's mist: by the waterfall's width, its own `mist` first)
      else if (d.preset === 'mist') cfg = { ...d, ...waterfallMist(e.obj) };
      try {
        const em = this._particles.createEmitter(cfg);
        // follow a translated build (the descriptor holds the build position)
        em.position.add(e.offset);
        // a hidden prop's smoke / embers / mist stop with it (shown again with it)
        em.enabled = this._emitting(e);
        e.emitters.push(em);
      } catch (err) {
        console.error('[Viewport3D] emitter failed:', err);
      }
    }
  }

  /**
   * Do a prop's emitters run: the props shown (Show objects), the prop neither of a hidden type
   * nor hidden by the story preview?
   * @param {PropEntry} e
   */
  _emitting(e) {
    return this.object.visible && !this._hides(e.obj.type, e.id);
  }

  /** Switch every prop's emitters on / off as the props are shown. */
  _syncEmitters() {
    for (const e of this.entries.values()) {
      if (!e.emitters.length) continue;
      const on = this._emitting(e);
      for (const em of e.emitters) if (em.enabled !== on) em.enabled = on;
    }
  }

  // -------------------------------------------------------------------------------------------
  // Per frame
  // -------------------------------------------------------------------------------------------

  /** Animated props (windmill sails, waterfalls). */
  update(dt) {
    for (const e of this.entries.values()) {
      const u = e.built.update;
      if (u) u(dt);
    }
  }

  /**
   * Merge one dirty batching chunk (call when editing pauses).
   * @returns {boolean} whether a chunk was merged
   */
  stepBatches() {
    return this.batching ? this.batcher.step() : false;
  }

  /**
   * Hand the light descriptors of the built props to the point-light pool — the list the game
   * builds (`sanitizeLightDescriptors`: level object order, sorted by priority, numbers clamped),
   * so the pool ranks exactly the game's descriptors. Call when `lightsDirty`; the pool keeps
   * its lights (`LightPool.setDescriptors`).
   * @param {LevelObject[]} objects level.objects (the order breaks priority ties, as in the game)
   * @param {{ snap?: boolean, reset?: boolean }} [opts] snap: jump to the new assignment without
   *   crossfades; reset: a new document — the pool forgets the previous set first, so it starts
   *   exactly as the game's pool does on a level load (the old level's lamps pass neither their
   *   lights nor their hysteresis bonus to lamps of the new one that share a tag, such as
   *   `lamppost:lamppost_1`)
   * @returns {number} light descriptors handed to the pool
   */
  refreshLights(objects, { snap = false, reset = false } = {}) {
    const raw = [];
    // hidden props (showObjects off / hidden types) do not light the scene either
    if (this.object.visible) {
      for (const obj of objects) {
        const e = this.entries.get(obj.id);
        if (!e || !e.lights.length || this._hides(e.obj.type, e.id)) continue;
        for (const l of e.lights) raw.push(l);
      }
    }
    // (an empty set parks every light and drops the pooled state: no THREE light is added or removed)
    if (reset) this.lightPool.setDescriptors([]);
    this.lightPool.setDescriptors(sanitizeLightDescriptors(raw, { cache: this._lightCache }), { snap });
    this.lightsDirty = false;
    return raw.length;
  }

  /**
   * Per frame, after the camera moved: the pool's re-ranking and crossfades (more descriptors
   * than lights), as the game's `World.update`.
   * @param {number} dt
   * @param {{ focus: THREE.Vector3, camera: THREE.Camera }} view the camera focus the lights are
   *   ranked around and the camera whose view they must touch
   */
  updateLights(dt, view) {
    this.lightPool.update(dt, view);
  }

  /** Total light descriptors of all props. */
  get lightCount() {
    let n = 0;
    for (const e of this.entries.values()) n += e.lights.length;
    return n;
  }

  // -------------------------------------------------------------------------------------------
  // Picking
  // -------------------------------------------------------------------------------------------

  /**
   * Nearest prop hit by the ray.
   * @param {THREE.Ray} ray
   * @param {number} [maxT]
   * @returns {{ id: string, t: number }|null}
   */
  pick(ray, maxT = Infinity) {
    if (!this.object.visible) return null;
    const cands = [];
    for (const e of this.entries.values()) {
      if (!e.root.visible) continue;
      const p = ray.intersectBox(e.box, _hitPoint);
      if (!p) continue;
      const t = _hitPoint.distanceTo(ray.origin);
      if (t <= maxT + 0.5) cands.push({ e, t });
    }
    cands.sort((a, b) => a.t - b.t);
    let best = null;
    const rc = this._raycaster;
    rc.ray.copy(ray);
    rc.near = 0;
    rc.far = maxT + 0.5;
    for (const { e, t } of cands) {
      if (best && t > best.t) break;
      if (!PRECISE_PICK.has(e.obj.type)) {
        if (!best || t < best.t) best = { id: e.id, t };
        continue;
      }
      /** @type {THREE.Intersection<THREE.Object3D & { isPoints?: boolean, isLine?: boolean }>[]} */
      const hits = rc.intersectObject(e.root, true);
      const h = hits.find((x) => !x.object.isPoints && !x.object.isLine);
      if (h && (!best || h.distance < best.t)) best = { id: e.id, t: h.distance };
    }
    return best;
  }

  /** Every built entry (read-only). */
  get(id) {
    return this.entries.get(id) ?? null;
  }

  setVisible(v) {
    if (this.object.visible === v) return;
    this.object.visible = v;
    this.lightsDirty = true;
    this._syncEmitters();
  }

  /** Is a prop of this type / id hidden (a hidden type, or the story preview)? */
  _hides(type, id) {
    return this.hiddenTypes.has(type) || this.hiddenIds.has(id);
  }

  /** Hide the props of some object types (state.view.hiddenTypes). */
  setHiddenTypes(types) {
    this._setHidden(new Set(types ?? []), this.hiddenIds);
  }

  /**
   * Hide these props (the story preview: their `when` / `unless` do not allow them); they are not
   * drawn, picked, batched or lit.
   * @param {Iterable<string>} ids
   */
  setHiddenIds(ids) {
    this._setHidden(this.hiddenTypes, new Set(ids));
  }

  /** @param {Set<string>} types @param {Set<string>} ids */
  _setHidden(types, ids) {
    for (const e of this.entries.values()) {
      const was = this._hides(e.obj.type, e.id);
      const hide = types.has(e.obj.type) || ids.has(e.id);
      if (hide !== was) this.batcher.invalidate(e);
      e.root.visible = !hide;
    }
    this.hiddenTypes = types;
    this.hiddenIds = ids;
    this.lightsDirty = true;
    this._syncEmitters();
  }

  dispose() {
    this.batcher.dispose();
    for (const e of this.entries.values()) this._disposeEntry(e);
    this.entries.clear();
    this.collect();
    this.lightPool.dispose();
    for (const rec of this._emissives.values()) rec.entry.dispose();
    this._emissives.clear();
    this.emissiveEntries.length = 0;
    this.builder.dispose();
    this.object.removeFromParent();
  }
}

/** Numeric ground height of a groundKey (the upper surface for waterfalls). */
function groundY(gkey) {
  return parseFloat(gkey);
}

/**
 * PropBatcher — static batching of the prop meshes per 16×16-tile chunk (32×32 on big levels) for
 * the 3D preview (the game batches the whole village with PropFactory.mergeStatic + mergeTrees;
 * the editor needs chunks it can re-merge when a prop changes).
 *
 * A merged chunk holds one mesh per (material, shadow flags, render order, attribute layout) with
 * world-space vertices. Wind-swayed meshes (tree trunks / canopies) are baked so the merged mesh
 * renders exactly like the separate ones: billboard pivots (`aCenter`) go to world space while
 * each card keeps its object-space offset from its pivot (the billboard shader re-orients it to
 * the camera; a rotated tree's cards must not be squeezed), and the per-mesh sway phase the
 * unmerged shader derives from the model matrix is folded into `aPhase` — batching or unbatching
 * a tree never makes it jump. Flames / glows (shader materials), animated parts
 * (`userData.dynamic`), mirrored and multi-material meshes stay unbatched.
 */
class PropBatcher {
  /** @param {ObjectPreview} preview */
  constructor(preview) {
    this.preview = preview;
    this.group = new THREE.Group();
    this.group.name = 'Editor:props:batches';
    preview.object.add(this.group);
    /** chunk key → { meshes: THREE.Mesh[], ids: Set<string> } */
    this.chunks = new Map();
    /** chunk key → Set of entry ids (members, batched or not) */
    this.members = new Map();
    /** Chunks to (re-)merge. */
    this.dirty = new Set();
    this.stats = { chunks: 0, meshes: 0, ms: 0 };
  }

  get pending() {
    return this.dirty.size > 0;
  }

  /** A new build joined its chunk (merged into it later). */
  add(e) {
    let set = this.members.get(e.chunk);
    if (!set) this.members.set(e.chunk, (set = new Set()));
    set.add(e.id);
    this.markDirty(e.chunk);
  }

  /**
   * An entry is about to change (translate / dispose / hide): its chunk is unbatched now (the
   * merged copy would be stale) and queued for a re-merge; the entry leaves the chunk.
   */
  remove(e) {
    if (e.batched || e.shadowed) this._unbatch(e.chunk);
    const set = this.members.get(e.chunk);
    if (set?.delete(e.id) && !set.size) this.members.delete(e.chunk);
  }

  /** An entry's look / visibility changed in place: unbatch its chunk and re-merge it later. */
  invalidate(e) {
    if (e.batched || e.shadowed) this._unbatch(e.chunk);
    this.markDirty(e.chunk);
  }

  markDirty(key) {
    this.dirty.add(key);
  }

  /** Restore the originals of a chunk and drop its merged meshes. */
  _unbatch(key) {
    const c = this.chunks.get(key);
    if (!c) return;
    this.chunks.delete(key);
    for (const m of c.meshes) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    c.casters?.dispose();
    for (const id of c.ids) {
      const e = this.preview.entries.get(id);
      if (!e) continue;
      for (const o of e.batched ?? []) {
        o.layers.enable(0);
        o.layers.disable(BATCH_LAYER);
      }
      e.batched = null;
      // lone meshes whose shadow the chunk's proxy drew cast their own again
      for (const o of e.shadowed ?? []) o.castShadow = true;
      e.shadowed = null;
    }
    this.dirty.add(key);
  }

  /**
   * Merge one dirty chunk.
   * @returns {boolean} whether one was processed
   */
  step() {
    const it = this.dirty.values().next();
    if (it.done) return false;
    const key = it.value;
    this.dirty.delete(key);
    const t0 = performance.now();
    this._unbatch(key);
    this.dirty.delete(key);
    this._merge(key);
    this.stats.ms = +(performance.now() - t0).toFixed(1);
    return true;
  }

  _merge(key) {
    const P = this.preview;
    const ids = this.members.get(key);
    if (!ids?.size) return;
    const tracked = P.builder.factory._geometries;
    const buckets = new Map();
    const perEntry = new Map();
    for (const id of ids) {
      const e = P.entries.get(id);
      if (!e || !e.exact || !e.root.visible || P._hides(e.obj.type, e.id)) continue;
      e.root.updateMatrixWorld(true);
      const list = [];
      const visit = (o) => {
        if (o.userData.dynamic || o.visible === false) return;
        if (o.isMesh && this._eligible(o, tracked)) list.push(o);
        for (const c of o.children) visit(c);
      };
      visit(e.root);
      if (!list.length) continue;
      perEntry.set(e, list);
      for (const o of list) {
        const g = o.geometry;
        const m = o.material;
        const layout = Object.keys(g.attributes).sort().join(',') + (g.index ? '|i' : '');
        const bk = `${m.uuid}|${+o.castShadow}|${+o.receiveShadow}|${o.renderOrder}|${o.customDepthMaterial?.uuid ?? ''}|${layout}`;
        let b = buckets.get(bk);
        if (!b) buckets.set(bk, (b = { material: m, src: o, geos: [], meshes: [], wind: !!m.userData.wind }));
        b.geos.push(bakeGeometry(o));
        b.meshes.push(o);
      }
    }
    if (!buckets.size) return;
    const meshes = [];
    const merged = new Set();
    // big levels: the chunk's opaque casters (merged meshes and lone ones) draw into the shadow map
    // through position-only proxies (ShadowCasters, one per face side) instead of one call each —
    // the game draws its big levels' shadows the same way
    const proxies = P.batchChunk === BATCH_CHUNK_BIG && !!P.lighting?.sun;
    const pieces = [];
    const lone = new Set();
    const temp = [];
    for (const b of buckets.values()) {
      if (b.geos.length < 2) {
        // nothing to save in the colour pass (its shadow may still join the chunk's proxy)
        const o = b.meshes[0];
        if (proxies && isProxyCaster(o)) {
          pieces.push({ geometry: b.geos[0], side: o.material.side });
          temp.push(b.geos[0]);
          lone.add(o);
        } else for (const g of b.geos) g.dispose();
        continue;
      }
      const g = mergeGeometries(b.geos, false);
      for (const x of b.geos) x.dispose();
      if (!g) continue; // incompatible attributes: leave these meshes unbatched
      g.computeBoundingSphere();
      g.computeBoundingBox();
      if (b.wind) {
        // wind + billboards move vertices on the GPU: pad the culling bounds
        g.boundingSphere.radius += 1.8;
        g.boundingBox.expandByScalar(1.8);
      }
      const mesh = new THREE.Mesh(g, b.material);
      mesh.name = `batch:${key}:${b.material.name || 'mat'}`;
      mesh.castShadow = b.src.castShadow;
      mesh.receiveShadow = b.src.receiveShadow;
      mesh.renderOrder = b.src.renderOrder;
      if (b.src.customDepthMaterial) mesh.customDepthMaterial = b.src.customDepthMaterial;
      mesh.matrixAutoUpdate = false;
      mesh.userData.batchChunk = key;
      meshes.push(mesh);
      for (const o of b.meshes) merged.add(o);
    }
    if (proxies) {
      for (const m of meshes) {
        if (!isProxyCaster(m)) continue;
        pieces.push({ geometry: m.geometry, side: m.material.side });
        m.castShadow = false;
      }
    }
    const casters = pieces.length ? buildShadowCasters(pieces, { lights: [P.lighting.sun], maxTriangles: Infinity, maxExtent: Infinity, name: `batch:${key}:shadow` }) : null;
    for (const g of temp) g.dispose();
    if (!meshes.length && !casters) return;
    for (const m of meshes) this.group.add(m);
    if (casters) this.group.add(casters.object);
    const cids = new Set();
    for (const [e, list] of perEntry) {
      const done = list.filter((o) => merged.has(o));
      const shadowed = list.filter((o) => lone.has(o));
      if (!done.length && !shadowed.length) continue;
      for (const o of done) {
        o.layers.disable(0);
        o.layers.enable(BATCH_LAYER);
      }
      for (const o of shadowed) o.castShadow = false;
      e.batched = done.length ? done : null;
      e.shadowed = shadowed.length ? shadowed : null;
      cids.add(e.id);
    }
    this.chunks.set(key, { meshes, ids: cids, casters });
    this.stats.chunks = this.chunks.size;
    this.stats.meshes = 0;
    for (const c of this.chunks.values()) this.stats.meshes += c.meshes.length;
  }

  _eligible(o, tracked) {
    const m = o.material;
    if (!m || Array.isArray(m) || m.isShaderMaterial || !o.geometry?.getAttribute('position')) return false;
    if (!tracked.has(o.geometry) || !o.layers.isEnabled(0)) return false;
    if (o.matrixWorld.determinant() < 0) return false; // mirrored: would flip the winding
    return true;
  }

  dispose() {
    for (const key of [...this.chunks.keys()]) this._unbatch(key);
    this.dirty.clear();
    this.members.clear();
    this.group.removeFromParent();
  }
}

/** World-space copy of a mesh's geometry for merging (wind attributes fixed up). */
function bakeGeometry(o) {
  const mw = o.matrixWorld;
  const src = o.geometry;
  const g = src.clone();
  g.applyMatrix4(mw);
  if (o.material.userData.wind) {
    const c = o.material.userData.billboard ? g.getAttribute('aCenter') : null;
    if (c) {
      // billboard cards: pivot → world; the card offset stays as authored (× the model's scale),
      // exactly what the unmerged shader computes (Wind.js)
      const c0 = src.getAttribute('aCenter');
      const p0 = src.getAttribute('position');
      const pos = g.getAttribute('position');
      const el = mw.elements;
      const sc = Math.hypot(el[0], el[1], el[2]);
      for (let i = 0; i < c.count; i++) {
        _v.fromBufferAttribute(c0, i).applyMatrix4(mw);
        c.setXYZ(i, _v.x, _v.y, _v.z);
        pos.setXYZ(i, _v.x + (p0.getX(i) - c0.getX(i)) * sc, _v.y + (p0.getY(i) - c0.getY(i)) * sc, _v.z + (p0.getZ(i) - c0.getZ(i)) * sc);
      }
    }
    // the unmerged shader adds (origin.x * 0.23 + origin.z * 0.17) to the phase (Wind.js)
    const ph = g.getAttribute('aPhase');
    if (ph) {
      const off = mw.elements[12] * 0.23 + mw.elements[14] * 0.17;
      for (let i = 0; i < ph.count; i++) ph.setX(i, ph.getX(i) + off);
    }
  }
  return g;
}
