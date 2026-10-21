import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildLevelTerrain, waterGlint } from '../../engine/level/ObjectBuilder.js';
import { toTileMapInput } from '../../engine/level/LevelFormat.js';
import { Water } from '../../engine/world/Water.js';
import { BATCH_LAYER } from './ObjectPreview.js';
import { buildShadowCasters, isProxyCaster } from '../../engine/world/ShadowCasters.js';
import { addGroundSnowCover } from '../../game/SnowCover.js';

/**
 * @import { TileMap } from '../../engine/world/TileMap.js'
 * @import { Level, TileRect } from '../../engine/level/types.js'
 * @import { TextureLibrary } from '../../engine/pixel/Textures.js'
 * @import { SceneNode } from '../../engine/render/types.js'
 */

/** Tiles per terrain mesh chunk: small so a brush stroke only re-bakes a few chunks. */
export const EDIT_CHUNK_SIZE = 16;
/**
 * Big levels (either side > BATCH_MIN_SIZE tiles): once editing pauses the chunk meshes are merged
 * per material into cells of BATCH_CELL × BATCH_CELL tiles (3 × 3 chunks — the game consolidates
 * its terrain the same way), so a 128 × 128 level draws ~120 terrain meshes instead of ~880.
 */
export const BATCH_CELL = 48;
const BATCH_MIN_SIZE = 64;
/** Tiles per shore-texture re-bake block (each job re-bakes one; ~5–10 ms on a GTX 1060). */
const SHORE_BLOCK = 12;

/**
 * TerrainPreview — the level's terrain (TileMap + Water) in the editor's 3D viewport, kept in
 * sync with the level being edited.
 *
 * Edits are applied in two steps so no frame ever does much work:
 *  - `sync(level)` diffs the level's tile / height rows against the last snapshot (so it works for
 *    every kind of change: strokes, undo / redo, loads) and updates the TileMap's tile DATA at once
 *    (`TileMap.updateTiles`: heights, water surfaces and every query are current immediately) —
 *    cheap. The mesh chunks the change touches (16×16 tiles, within 2 tiles of it) are queued;
 *  - `stepChunkSlices(budgetMs, focus)` re-bakes queued chunks a tile row at a time within a time
 *    budget (nearest the brush first; `TileMap.rebuildChunkSteps`), `stepChunks(n)` whole chunks.
 *    The old chunk meshes stay on screen until a chunk's new meshes are complete.
 *  - The Water mesh is updated in place (same material): `flushWater` re-reads the water tiles and
 *    rebuilds its geometry (cheap; the viewport throttles it during strokes), and re-bakes the
 *    shore texture of the changed area in blocks of SHORE_BLOCK tiles — windowed bakes equal to
 *    the full one — in a Web Worker (shoreWorker.js; results are applied as they arrive), or
 *    block by block on the main thread (`stepShore`) when workers are unavailable.
 * Size / legend / water-level / name changes need a full rebuild (swapped in once complete).
 * Once the queues are empty the meshes equal a fresh build of the level.
 *
 * Big levels batch the chunk meshes per BATCH_CELL cell (`stepBatches`, once editing pauses; see
 * TerrainBatcher): a cell is dissolved the moment one of its chunks is queued for a re-bake (the
 * chunk meshes, kept on BATCH_LAYER meanwhile, are drawn again at once) and merged again later.
 */
export class TerrainPreview {
  /**
   * @param {{ textures: TextureLibrary, parent: THREE.Object3D, shadowLights?: THREE.Light[] }} opts
   *   shadowLights: the shadow-casting lights (big levels: a merged cell's opaque casters draw into
   *   their shadow maps through position-only proxies)
   */
  constructor({ textures, parent, shadowLights = null }) {
    this.textures = textures;
    this.shadowLights = shadowLights;
    this.object = new THREE.Group();
    this.object.name = 'Editor:terrain';
    parent.add(this.object);
    /** @type {TileMap|null} */
    this.tileMap = null;
    /** @type {Water|null} */
    this.water = null;
    /** Build statistics of the last sync / chunk / water update. */
    this.stats = { kind: 'none', ms: 0, waterMs: 0, chunks: 0, fullMs: 0, chunkMs: 0 };
    /** Increments on every change of the terrain DATA (dependants compare it). */
    this.version = 0;
    this._snap = null;
    /** Chunk keys ("ci,cj") whose meshes wait for a re-bake. */
    this.pendingChunks = new Set();
    /** When each chunk was last re-baked (performance.now()). */
    this._chunkAt = new Map();
    /** A chunk re-bake in progress: { key, it (TileMap.rebuildChunkSteps), ms }. */
    this._slice = null;
    /** Tiles whose water needs an update (see `flushWater`), or null. */
    this._waterRect = null;
    /** A water update is pending. */
    this.waterPending = false;
    /** Shore-texture blocks waiting for a re-bake: key "bi,bj" → tile rect (inclusive). */
    this._shoreBlocks = new Map();
    /** Shore bakes posted to the worker: id → { water, job }. */
    this._inflight = new Map();
    this._jobId = 0;
    this._worker = null;
    /** false: bake on the main thread (no worker support / it failed). */
    this.useWorker = typeof Worker === 'function';
    /** Objects to free after the next frame (their programs stay cached meanwhile). */
    this._graveyard = [];
    /** Big levels: the per-cell batches of the chunk meshes. */
    this.batcher = new TerrainBatcher(this);
  }

  /** Is mesh work (chunks / water / cell batches) still queued? */
  get busy() {
    return this.pendingChunks.size > 0 || !!this._slice || this.waterPending || this._shoreBlocks.size > 0 || this._inflight.size > 0 || this.batcher.pending;
  }

  /**
   * Merge one dirty terrain cell (big levels; call when editing pauses and no chunk waits).
   * @returns {boolean} whether a cell was processed
   */
  stepBatches() {
    if (this.pendingChunks.size || this._slice) return false;
    return this.batcher.step();
  }

  /** Can a queued chunk be re-baked now (none re-baked less than `minAge` ms ago)? */
  chunkReady(minAge = 0) {
    if (this._slice) return true;
    if (!minAge) return this.pendingChunks.size > 0;
    const now = performance.now();
    for (const k of this.pendingChunks) if (!(now - (this._chunkAt.get(k) ?? -Infinity) < minAge)) return true;
    return false;
  }

  /** Shore re-bake blocks waiting. */
  get shorePending() {
    return this._shoreBlocks.size;
  }

  /**
   * Bring the terrain DATA up to date with `level` (meshes follow through `stepChunks` /
   * `flushWater`).
   * @param {Level} level
   * @returns {{ changed: boolean, rect: TileRect|null, full: boolean }}
   *   rect = changed tiles (null = everything / nothing)
   */
  sync(level) {
    const snap = this._snap;
    // (the level name seeds the TileMap's tint noise: a renamed / newly loaded level gets a fresh build)
    const legendKey = JSON.stringify(level.legend);
    const full = !this.tileMap || !snap || snap.width !== level.width || snap.depth !== level.depth
      || snap.name !== level.name || snap.waterLevel !== level.waterLevel || snap.legendKey !== legendKey;
    if (full) {
      this._buildFull(level);
      return { changed: true, rect: null, full: true };
    }
    const waterKey = JSON.stringify(level.water ?? null);
    if (waterKey !== snap.waterKey) {
      // flow / reflection / tint are Water constructor options: a new Water (rare: settings)
      this._newWater(level);
      snap.waterKey = waterKey;
    }
    const rect = diffRows(snap, level);
    if (!rect) return { changed: false, rect: null, full: false };
    const t0 = performance.now();
    const waterTouched = this._touchesWater(level, rect);
    const keys = this.tileMap.updateTiles(toTileMapInput(level), rect);
    if (!keys) {
      this._buildFull(level);
      return { changed: true, rect: null, full: true };
    }
    for (const k of keys) {
      this.pendingChunks.add(k);
      this.batcher.touchChunk(k);
    }
    if (waterTouched) {
      this._waterRect = this._waterRect ? unionRect(this._waterRect, rect) : { ...rect };
      this.waterPending = true;
    }
    this._snapshot(level, legendKey);
    this.stats = { ...this.stats, kind: 'data', ms: +(performance.now() - t0).toFixed(2) };
    this.version++;
    return { changed: true, rect, full: false };
  }

  /**
   * Re-bake up to `max` queued chunks (the nearest to `focus` first).
   * @param {number} [max]
   * @param {{x:number, z:number}|null} [focus] world point (the brush)
   * @param {{ minAge?: number }} [opts] minAge: skip chunks re-baked less than this many ms ago
   *   (during strokes the chunk under the brush changes every frame: re-baking it every few frames
   *   keeps the feedback well under 100 ms and leaves the other frames light)
   * @returns {number} chunks rebuilt
   */
  stepChunks(max = 1, focus = null, { minAge = 0 } = {}) {
    this._finishSliced();
    if (!this.pendingChunks.size || !this.tileMap) return 0;
    const cs = EDIT_CHUNK_SIZE;
    const now = performance.now();
    let keys = [...this.pendingChunks];
    if (minAge > 0) keys = keys.filter((k) => !(now - (this._chunkAt.get(k) ?? -Infinity) < minAge));
    if (!keys.length) return 0;
    if (keys.length > max) {
      const d = (k) => {
        if (!focus) return 0;
        const [ci, cj] = k.split(',').map(Number);
        return ((ci + 0.5) * cs - focus.x) ** 2 + ((cj + 0.5) * cs - focus.z) ** 2;
      };
      keys.sort((a, b) => d(a) - d(b));
      keys = keys.slice(0, max);
    }
    const t0 = performance.now();
    for (const k of keys) {
      this.pendingChunks.delete(k);
      this._chunkAt.set(k, t0);
    }
    this.tileMap.rebuildChunks(keys);
    this._snowPatch();
    this.stats.chunkMs = +(performance.now() - t0).toFixed(1);
    this.stats.chunks = keys.length;
    return keys.length;
  }

  /**
   * Re-bake queued chunks in slices of at most ~`budgetMs` (a row of tiles at a time; a chunk in
   * progress keeps its old meshes until its last row is emitted). The nearest chunk to `focus`
   * is started first; chunks re-baked less than `minAge` ms ago wait.
   * @returns {boolean} whether any work was done
   */
  stepChunkSlices(budgetMs, focus = null, { minAge = 0 } = {}) {
    if (!this.tileMap) return false;
    const t0 = performance.now();
    let did = false;
    while (performance.now() - t0 < budgetMs || !did) {
      if (!this._slice) {
        const key = this._nextChunk(focus, minAge);
        if (!key) break;
        this.pendingChunks.delete(key);
        this._chunkAt.set(key, performance.now());
        this._slice = { key, it: this.tileMap.rebuildChunkSteps(key), t0: performance.now(), ms: 0 };
      }
      const s0 = performance.now();
      const r = this._slice.it.next();
      this._slice.ms += performance.now() - s0;
      did = true;
      if (r.done) {
        this._snowPatch();
        this.stats.chunkMs = +this._slice.ms.toFixed(1);
        this.stats.chunks = 1;
        this._slice = null;
      }
    }
    return did;
  }

  /** Is a chunk re-bake in progress (sliced)? */
  get slicing() {
    return !!this._slice;
  }

  /** The queued chunk to re-bake next (nearest the focus, old enough), or null. */
  _nextChunk(focus, minAge) {
    const now = performance.now();
    const cs = EDIT_CHUNK_SIZE;
    let best = null;
    let bd = Infinity;
    for (const k of this.pendingChunks) {
      if (minAge > 0 && now - (this._chunkAt.get(k) ?? -Infinity) < minAge) continue;
      let d = 0;
      if (focus) {
        const [ci, cj] = k.split(',').map(Number);
        d = ((ci + 0.5) * cs - focus.x) ** 2 + ((cj + 0.5) * cs - focus.z) ** 2;
      }
      if (d < bd) { bd = d; best = k; }
      if (!focus) break;
    }
    return best;
  }

  /** Complete a sliced chunk re-bake now. */
  _finishSliced() {
    if (!this._slice) return;
    const it = this._slice.it;
    this._slice = null;
    while (!it.next().done) { /* finish */ }
    this._snowPatch();
  }

  /**
   * The game's snow-cover patch on every terrain material (World.js does it once after the build):
   * chained on at creation — a new tile kind painted in makes a new material — so the programs
   * always carry it and a weather change never compiles anything. Already patched materials are
   * skipped.
   */
  _snowPatch() {
    if (this.tileMap) addGroundSnowCover(this.tileMap.object);
  }

  /** Rebuild every queued chunk now. */
  flushChunks() {
    this._finishSliced();
    if (this.pendingChunks.size) this.stepChunks(this.pendingChunks.size);
  }

  /**
   * Update the water mesh for the tiles changed since the last call (in place, same material):
   * the geometry now, the shore texture of the changed area queued as blocks (`stepShore`).
   * @returns {boolean} whether anything was done
   */
  flushWater(level) {
    if (!this.waterPending || !this.tileMap) return false;
    const t0 = performance.now();
    const rect = this._waterRect;
    this.waterPending = false;
    this._waterRect = null;
    if (this.water) {
      const { flowChanged } = this.water.updateTiles();
      const W = this.tileMap.width;
      const D = this.tileMap.depth;
      // the texels to re-bake: around the change, or — the flow scale changed — wherever there
      // is water (dry texels far from water keep their value whatever the scale)
      const reach = this.water.shoreReach;
      const area = flowChanged || !rect ? { minI: 0, maxI: W - 1, minJ: 0, maxJ: D - 1 } : {
        minI: Math.max(0, rect.minI - reach), maxI: Math.min(W - 1, rect.maxI + reach),
        minJ: Math.max(0, rect.minJ - reach), maxJ: Math.min(D - 1, rect.maxJ + reach),
      };
      const B = SHORE_BLOCK;
      for (let bj = Math.floor(area.minJ / B); bj * B <= area.maxJ; bj++) {
        for (let bi = Math.floor(area.minI / B); bi * B <= area.maxI; bi++) {
          const r = {
            minI: Math.max(area.minI, bi * B), maxI: Math.min(area.maxI, bi * B + B - 1),
            minJ: Math.max(area.minJ, bj * B), maxJ: Math.min(area.maxJ, bj * B + B - 1),
          };
          if ((flowChanged || !rect) && !this._waterNear(r, 2)) continue;
          const key = `${bi},${bj}`;
          const q = this._shoreBlocks.get(key);
          this._shoreBlocks.set(key, q ? unionRect(q, r) : r);
        }
      }
      // off the main thread when possible (all at once: the worker works through them in order)
      if (this._getWorker()) while (this._shoreBlocks.size) this.stepShore();
      else this.stepShore();
    } else if (hasWater(level)) this._newWater(level);
    this.stats.waterMs = +(performance.now() - t0).toFixed(1);
    return true;
  }

  /**
   * Re-bake one queued shore-texture block (the one nearest `focus`).
   * @param {{x:number, z:number}|null} [focus]
   * @returns {boolean} whether a block was processed
   */
  stepShore(focus = null) {
    if (!this._shoreBlocks.size || !this.water) { this._shoreBlocks.clear(); return false; }
    let key = null;
    let best = Infinity;
    for (const [k, r] of this._shoreBlocks) {
      const d = focus ? ((r.minI + r.maxI) / 2 - focus.x) ** 2 + ((r.minJ + r.maxJ) / 2 - focus.z) ** 2 : 0;
      if (d < best) { best = d; key = k; }
      if (!focus) break;
    }
    const r = this._shoreBlocks.get(key);
    this._shoreBlocks.delete(key);
    const t0 = performance.now();
    const w = this.water;
    const worker = this._getWorker();
    const job = worker ? w.shoreJob(r, { expand: false }) : null;
    if (job) {
      const id = ++this._jobId;
      this._inflight.set(id, { water: w, job, rect: r });
      worker.postMessage({ id, input: w.shoreInput(true), a0: job.a0, b0: job.b0, W: job.W, H: job.H });
    } else if (!worker) w.rebakeShore(r, { expand: false });
    this.stats.shoreMs = +(performance.now() - t0).toFixed(1);
    return true;
  }

  /** The shore-bake worker (created on first use), or null (main-thread bakes). */
  _getWorker() {
    if (this._worker || !this.useWorker) return this._worker;
    try {
      const w = new Worker(new URL('./shoreWorker.js', import.meta.url), { type: 'module' });
      w.onmessage = (e) => this._onShore(e.data);
      w.onerror = (e) => {
        console.warn('[Viewport3D] shore worker failed, baking on the main thread:', e.message ?? e);
        e.preventDefault?.();
        this._workerFailed();
      };
      this._worker = w;
    } catch (err) {
      console.warn('[Viewport3D] shore worker unavailable:', err);
      this.useWorker = false;
    }
    return this._worker;
  }

  /** A baked window came back: write it into the texture (if that water still exists). */
  _onShore({ id, out, error }) {
    const f = this._inflight.get(id);
    this._inflight.delete(id);
    if (!f) return;
    if (error) {
      console.warn('[Viewport3D] shore bake failed:', error);
      if (f.water === this.water) f.water.rebakeShore(f.rect, { expand: false });
      return;
    }
    if (f.water === this.water) f.water.applyShore(f.job, out);
  }

  /** The worker broke: bake what it had on the main thread from now on. */
  _workerFailed() {
    this.useWorker = false;
    this._worker?.terminate();
    this._worker = null;
    const pending = [...this._inflight.values()];
    this._inflight.clear();
    for (const f of pending) if (f.water === this.water) f.water.rebakeShore(f.rect, { expand: false });
  }

  /** Is there a water tile within `m` tiles of the rect? */
  _waterNear(r, m) {
    const tm = this.tileMap;
    for (let j = r.minJ - m; j <= r.maxJ + m; j++) {
      for (let i = r.minI - m; i <= r.maxI + m; i++) if (tm.tileAt(i, j)?.water) return true;
    }
    return false;
  }

  /** Force a complete rebuild (e.g. after a load). */
  rebuild(level) {
    this._buildFull(level);
  }

  /** Free what was replaced a frame ago (called once per frame, after rendering). */
  collect() {
    if (!this._graveyard.length) return;
    const list = this._graveyard;
    this._graveyard = [];
    for (const fn of list) fn();
  }

  _buildFull(level) {
    const t0 = performance.now();
    const next = buildLevelTerrain(level, { textures: this.textures, chunkSize: EDIT_CHUNK_SIZE });
    const ms = performance.now() - t0;
    // swap only once the new terrain is complete (the old one stays visible until now)
    const old = this._built;
    const oldWater = this.water;
    this._built = next;
    this.tileMap = next.tileMap;
    this.water = next.water;
    this._snowPatch();
    this.object.add(next.object);
    this.batcher.reset(next.tileMap);
    if (old) {
      old.object.removeFromParent();
      // freed after the new terrain rendered once (its shaders stay compiled meanwhile)
      this._graveyard.push(() => disposeBuilt(old, oldWater));
    }
    this.pendingChunks.clear();
    this._slice = null;
    this.waterPending = false;
    this._waterRect = null;
    this._shoreBlocks.clear();
    this._snapshot(level);
    this.stats = { ...this.stats, kind: 'full', ms, waterMs: 0, chunks: 0, fullMs: ms };
    this.version++;
  }

  /** A new Water mesh with the level's water options (replacing the current one). */
  _newWater(level) {
    const old = this.water;
    this.water = null;
    if (hasWater(level)) {
      const w = level.water ?? {};
      this.water = new Water(this.tileMap, { flow: w.flow ?? [0, 0.45], reflect: w.reflect ?? 0.2, neutral: w.neutral ?? 0.2, glint: waterGlint(level) });
      this._built.object.add(this.water.object);
    }
    if (old) {
      old.object.removeFromParent();
      this._graveyard.push(() => old.dispose());
    }
    this.waterPending = false;
    this._waterRect = null;
    this._shoreBlocks.clear();
  }

  /** Do the changed tiles (±1) hold water before or after the edit? */
  _touchesWater(level, rect) {
    const tm = this.tileMap;
    for (let j = rect.minJ - 1; j <= rect.maxJ + 1; j++) {
      for (let i = rect.minI - 1; i <= rect.maxI + 1; i++) {
        if (tm.tileAt(i, j)?.water) return true;
        if (j < 0 || i < 0 || j >= level.depth || i >= level.width) continue;
        if (level.legend[level.tiles[j][i]]?.water) return true;
      }
    }
    return false;
  }

  _snapshot(level, legendKey = JSON.stringify(level.legend)) {
    this._snap = {
      name: level.name,
      width: level.width,
      depth: level.depth,
      waterLevel: level.waterLevel,
      legendKey,
      waterKey: JSON.stringify(level.water ?? null),
      tiles: [...level.tiles],
      heights: [...level.heights],
    };
  }

  /** Animated water (per frame). */
  update(dt) {
    this.water?.update(dt);
  }

  dispose() {
    this._worker?.terminate();
    this._worker = null;
    this._inflight.clear();
    this.collect();
    this.batcher.reset(null);
    if (this._built) disposeBuilt(this._built, this.water);
    this._built = null;
    this.tileMap = null;
    this.water = null;
    this.object.removeFromParent();
  }
}

/**
 * TerrainBatcher — merges the terrain chunk meshes of a big level per material (name, material,
 * shadow flags, render order and attribute layout, like TileMap.consolidateChunks) into cells of
 * BATCH_CELL tiles. The merged meshes live in their own group under the terrain; the chunk meshes
 * they replace move to BATCH_LAYER (still in the TileMap, still re-baked by it, just not drawn).
 * `touchChunk` dissolves a cell before one of its chunks is re-baked, so the merged copy never
 * shows stale ground; `step` merges one dirty cell. Every vertex stays where the chunk put it, so
 * the view (and `busy === false`) still equals a fresh build.
 */
class TerrainBatcher {
  /** @param {TerrainPreview} preview */
  constructor(preview) {
    this.preview = preview;
    this.group = new THREE.Group();
    this.group.name = 'Editor:terrain:batches';
    preview.object.add(this.group);
    /** cell key "ci,cj" → { meshes: merged meshes, originals: chunk meshes they draw } */
    this.cells = new Map();
    /** Cells to (re-)merge. */
    this.dirty = new Set();
    /** Only big levels batch (small ones keep exactly the meshes they were tuned with). */
    this.enabled = false;
    this.stats = { cells: 0, meshes: 0, ms: 0 };
  }

  get pending() {
    return this.enabled && this.dirty.size > 0;
  }

  /** A new TileMap (full build) or none: drop every batch; a big level merges all its cells again. */
  reset(tileMap) {
    for (const k of [...this.cells.keys()]) this._unbatch(k);
    this.dirty.clear();
    this.enabled = !!tileMap && (tileMap.width > BATCH_MIN_SIZE || tileMap.depth > BATCH_MIN_SIZE);
    if (this.enabled) {
      for (let cj = 0; cj * BATCH_CELL < tileMap.depth; cj++) for (let ci = 0; ci * BATCH_CELL < tileMap.width; ci++) this.dirty.add(`${ci},${cj}`);
    }
    this._count();
  }

  /** The chunk "ci,cj" (EDIT_CHUNK_SIZE units) is about to be re-baked: show its cell unmerged. */
  touchChunk(key) {
    if (!this.enabled) return;
    const cell = this._cellOf(key);
    this._unbatch(cell);
    this.dirty.add(cell);
  }

  /** Merge one dirty cell. @returns {boolean} whether one was processed */
  step() {
    if (!this.pending) return false;
    const cell = this.dirty.values().next().value;
    this.dirty.delete(cell);
    const t0 = performance.now();
    this._unbatch(cell);
    this._merge(cell);
    this.stats.ms = +(performance.now() - t0).toFixed(1);
    return true;
  }

  _cellOf(chunkKey) {
    const [ci, cj] = chunkKey.split(',').map(Number);
    const per = BATCH_CELL / EDIT_CHUNK_SIZE;
    return `${Math.floor(ci / per)},${Math.floor(cj / per)}`;
  }

  _unbatch(cell) {
    const c = this.cells.get(cell);
    if (!c) return;
    this.cells.delete(cell);
    for (const m of c.meshes) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    for (const o of c.originals) {
      o.layers.enable(0);
      o.layers.disable(BATCH_LAYER);
    }
    c.casters?.dispose();
    for (const o of c.shadowed) o.castShadow = true;
    this._count();
  }

  _merge(cell) {
    const tm = this.preview.tileMap;
    if (!tm) return;
    const groups = new Map();
    for (const m of /** @type {SceneNode[]} */ (tm.object.children)) {
      if (!m.isMesh || !m.userData.chunk || !m.layers.isEnabled(0) || Array.isArray(m.material)) continue;
      if (this._cellOf(m.userData.chunk) !== cell) continue;
      const g = m.geometry;
      const layout = Object.keys(g.attributes).sort().join(',') + (g.index ? '|i' : '');
      const k = `${m.name}|${m.material.uuid}|${+m.castShadow}|${+m.receiveShadow}|${m.renderOrder}|${m.customDepthMaterial?.uuid ?? ''}|${layout}`;
      let list = groups.get(k);
      if (!list) groups.set(k, (list = []));
      list.push(m);
    }
    const meshes = [];
    const originals = [];
    // the cell's opaque casters draw into the shadow map through position-only proxies (like the
    // game's big-level terrain): lone chunk meshes join them too
    const lights = this.preview.shadowLights;
    const pieces = [];
    const shadowed = [];
    for (const list of groups.values()) {
      if (list.length < 2) {
        const m = list[0];
        if (lights && isProxyCaster(m) && isIdentity(m.matrixWorld)) {
          pieces.push({ geometry: m.geometry, side: m.material.side });
          shadowed.push(m);
        }
        continue; // nothing to save in the colour pass
      }
      // world-space copies (the chunk geometries already are: the TileMap and its chunks sit at
      // the origin — baked anyway should that ever change)
      const plain = list.every((m) => isIdentity(m.matrixWorld));
      const geos = plain ? list.map((m) => m.geometry) : list.map((m) => m.geometry.clone().applyMatrix4(m.matrixWorld));
      const g = mergeGeometries(geos, false);
      if (!plain) for (const x of geos) x.dispose();
      if (!g) continue;
      g.computeBoundingSphere();
      g.computeBoundingBox();
      const src = list[0];
      const mesh = new THREE.Mesh(g, src.material);
      mesh.name = src.name;
      mesh.castShadow = src.castShadow;
      mesh.receiveShadow = src.receiveShadow;
      mesh.renderOrder = src.renderOrder;
      mesh.matrixAutoUpdate = false;
      if (src.customDepthMaterial) mesh.customDepthMaterial = src.customDepthMaterial;
      mesh.userData.kind = src.userData.kind;
      mesh.userData.batchCell = cell;
      mesh.updateMatrixWorld(true);
      this.group.add(mesh);
      meshes.push(mesh);
      for (const o of list) {
        o.layers.disable(0);
        o.layers.enable(BATCH_LAYER);
        originals.push(o);
      }
      if (lights && isProxyCaster(mesh)) {
        pieces.push({ geometry: g, side: mesh.material.side });
        mesh.castShadow = false;
      }
    }
    const casters = pieces.length ? buildShadowCasters(pieces, { lights, maxTriangles: Infinity, maxExtent: Infinity, name: `terrain:${cell}:shadow` }) : null;
    if (casters) {
      this.group.add(casters.object);
      for (const m of shadowed) m.castShadow = false;
    }
    if (meshes.length || casters) this.cells.set(cell, { meshes, originals, casters, shadowed: casters ? shadowed : [] });
    this._count();
  }

  _count() {
    this.stats.cells = this.cells.size;
    let n = 0;
    for (const c of this.cells.values()) n += c.meshes.length;
    this.stats.meshes = n;
  }
}

function hasWater(level) {
  return level.tiles.some((row) => [...row].some((ch) => level.legend[ch]?.water));
}

const IDENTITY = new THREE.Matrix4();
const isIdentity = (m) => m.equals(IDENTITY);

function unionRect(a, b) {
  return {
    minI: Math.min(a.minI, b.minI), maxI: Math.max(a.maxI, b.maxI),
    minJ: Math.min(a.minJ, b.minJ), maxJ: Math.max(a.maxJ, b.maxJ),
  };
}

/** Dispose a buildLevelTerrain result whose water mesh may have been replaced since. */
function disposeBuilt(built, water) {
  water?.dispose();
  built.tileMap.dispose();
  built.object.removeFromParent();
}

/** Bounding rect of the tiles whose char or height differs between the snapshot and the level. */
function diffRows(snap, level) {
  let rect = null;
  for (let j = 0; j < level.depth; j++) {
    const a = level.tiles[j];
    const b = snap.tiles[j];
    const ha = level.heights[j];
    const hb = snap.heights[j];
    if (a === b && ha === hb) continue;
    for (let i = 0; i < level.width; i++) {
      if (a[i] === b[i] && ha[i] === hb[i]) continue;
      if (!rect) rect = { minI: i, maxI: i, minJ: j, maxJ: j };
      else {
        if (i < rect.minI) rect.minI = i;
        if (i > rect.maxI) rect.maxI = i;
        if (j < rect.minJ) rect.minJ = j;
        if (j > rect.maxJ) rect.maxJ = j;
      }
    }
  }
  return rect;
}
