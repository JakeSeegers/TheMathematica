import * as THREE from 'three';
import * as SCENERY from '../../game/Scenery.js';
import { addSnowCover } from '../../game/SnowCover.js';
import { southGap, forestBorderOn, outerSceneryOn } from '../../game/LevelLook.js';

/**
 * @import { PropFactory } from '../../engine/world/Props.js'
 * @import { Level } from '../../engine/level/types.js'
 * @import { TileMap } from '../../engine/world/TileMap.js'
 * @import { TextureLibrary } from '../../engine/pixel/Textures.js'
 */

/**
 * SceneryPreview — the level's surroundings as the game builds them (docs/contracts/LEVEL_EDITOR.md §5):
 * trees scattered on the blocked forest-border tiles (`environment.border: 'forest'`) and the
 * fogged outer world — rolling ground with tree clusters — around the map
 * (`environment.outerScenery`). Uses the game's own scenery builders (src/game/Scenery.js), so the
 * editor shows the diorama exactly as it will be played; when they are unavailable the preview
 * simply has no surroundings.
 *
 * Rebuilt (≈ 100–300 ms of work) only when the environment changes or terrain near the map edge /
 * on forest tiles changes, once editing pauses, in time slices of a few milliseconds per frame
 * (`step`); the old surroundings stay until the new ones are complete.
 */
export class SceneryPreview {
  /** @param {{ parent: THREE.Object3D, textures: TextureLibrary, factory: PropFactory }} opts */
  constructor({ parent, textures, factory }) {
    this.textures = textures;
    this.factory = factory;
    this.object = new THREE.Group();
    this.object.name = 'Editor:scenery';
    parent.add(this.object);
    this.available = ['scatterForest', 'mergeTrees', 'makeOuterHeight', 'buildOuterGround'].every((k) => typeof SCENERY[k] === 'function');
    this._built = [];
    this._ground = null;
    this.stats = { ms: 0, border: 0, outer: 0 };
    this._key = '';
    /** A rebuild is wanted (see `schedule`). */
    this.pending = false;
    this._at = 0;
    /** Time-sliced rebuild in progress (a generator), or null. */
    this._job = null;
    this._jobMs = 0;
  }

  /** Environment signature the scenery depends on. */
  static envKey(level) {
    const e = level.environment ?? {};
    return JSON.stringify([e.border, e.outerScenery, e.interior === true, e.scenery ?? null, e.forest ?? null, level.width, level.depth]);
  }

  /** Does a changed tile rect affect the scenery (forest tiles or the map edge)? */
  static touches(level, rect) {
    if (!rect) return true;
    const m = 4;
    if (rect.minI < m || rect.minJ < m || rect.maxI >= level.width - m || rect.maxJ >= level.depth - m) return true;
    for (let j = rect.minJ; j <= rect.maxJ; j++) {
      const row = level.tiles[j];
      if (!row) continue;
      for (let i = rect.minI; i <= rect.maxI; i++) if (row[i] === 'T') return true;
    }
    return false;
  }

  /** Ask for a rebuild once editing pauses (a rebuild in progress restarts). */
  schedule(now = performance.now()) {
    this._cancel();
    this.pending = true;
    this._at = now;
  }

  /** Should the pending rebuild run (or continue) now? */
  due(now, inTransaction, quietMs = 450) {
    if (this._job) return true;
    return this.pending && !inTransaction && now - this._at >= quietMs;
  }

  /** Is a time-sliced rebuild in progress? */
  get building() {
    return !!this._job;
  }

  /**
   * Advance the rebuild by about `budgetMs` (the new surroundings replace the old ones when
   * complete; the old ones stay visible until then).
   * @param {Level} level
   * @param {TileMap} tileMap
   * @param {number} [budgetMs]
   * @returns {boolean} whether the rebuild finished
   */
  step(level, tileMap, budgetMs = 8) {
    if (!this._job) {
      this.pending = false;
      this._jobMs = 0;
      this._job = this._steps(level, tileMap);
    }
    const t0 = performance.now();
    let done = false;
    while (!done && performance.now() - t0 < budgetMs) done = !!this._job.next().done;
    this._jobMs += performance.now() - t0;
    if (done) {
      this._job = null;
      this.stats.ms = +this._jobMs.toFixed(1);
    }
    return done;
  }

  /**
   * Rebuild the surroundings for `level` on `tileMap` at once.
   * @param {Level} level
   * @param {TileMap} tileMap
   */
  build(level, tileMap) {
    this._cancel();
    this.pending = false;
    const t0 = performance.now();
    const it = this._steps(level, tileMap);
    while (!it.next().done) { /* run to completion */ }
    this.stats.ms = +(performance.now() - t0).toFixed(1);
  }

  /** Drop a rebuild in progress (and what it built so far). */
  _cancel() {
    if (!this._job) return;
    this._job.return();
    this._job = null;
  }

  /** The rebuild as small steps (a generator: one tree batch / merge / ground per step). */
  * _steps(level, tileMap) {
    this._key = SceneryPreview.envKey(level);
    const next = { built: [], ground: null };
    let adopted = false;
    try {
      if (!this.available || !tileMap) { this.clear(); adopted = true; return; }
      const env = level.environment ?? {};
      // (the game's rule, never in a room: LevelLook.isInterior)
      const forest = forestBorderOn(env);
      const outerOn = outerSceneryOn(env);
      if (!forest && !outerOn) { this.clear(); adopted = true; return; }
      const heightAt = SCENERY.makeOuterHeight(tileMap);
      const inMap = (x, z) => x >= 0 && z >= 0 && x <= level.width && z <= level.depth;
      const avoid = level.objects.filter((o) => o.type === 'tree').map((o) => ({ x: o.x, z: o.z, r: inMap(o.x, o.z) ? 1.2 : 1.8 }));
      const gap = southGap(env);
      const kindAreas = SCENERY.forestKindAreas?.(env) ?? [];
      let { border, outer } = SCENERY.scatterForest({ tileMap, heightAt, avoid, southGap: gap, kindAreas });
      if (!forest) border = [];
      if (!outerOn) outer = [];
      yield;
      const f = this.factory;
      const tree = ([kind, x, y, z, height]) => f.tree(x, y, z, { kind, height, fallenLeaves: false });
      // trees in small batches (each step stays short), merged per group
      const groups = [];
      if (border.length) groups.push({ list: border, name: 'editor:trees:border', castShadow: true });
      // outer trees: four quadrants so frustum culling can skip what the camera can't see
      const W = tileMap.width;
      const D = tileMap.depth;
      const quads = { n: [], s: [], e: [], w: [] };
      for (const t of outer) {
        const [, x, , z] = t;
        quads[z < 0 ? 'n' : z > D ? 's' : x < W / 2 ? 'w' : 'e'].push(t);
      }
      for (const [q, list] of Object.entries(quads)) if (list.length) groups.push({ list, name: `editor:trees:outer:${q}`, castShadow: false });
      for (const g of groups) {
        const results = [];
        try {
          for (let k = 0; k < g.list.length; k++) {
            results.push(tree(g.list[k]));
            if (k % 12 === 11) yield;
          }
          next.built.push(SCENERY.mergeTrees(results, { name: g.name, castShadow: g.castShadow }));
        } finally {
          // (mergeTrees disposes the sources; a cancelled batch frees them here)
          if (!next.built.length || next.built[next.built.length - 1].object.name !== g.name) for (const r of results) r.dispose?.();
        }
        yield;
      }
      if (outerOn) {
        // the heightfield in row batches when the game exposes the generator form
        next.ground = typeof SCENERY.outerGroundSteps === 'function'
          ? yield* SCENERY.outerGroundSteps({ textures: this.textures, tileMap, heightAt })
          : SCENERY.buildOuterGround({ textures: this.textures, tileMap, heightAt });
      }
      // swap in the complete surroundings
      this.clear();
      for (const m of next.built) this._add(m);
      if (next.ground) {
        this._ground = next.ground;
        // the outer hills whiten under settled snow (the game's patch, see World.js)
        addSnowCover(next.ground.material, 'ground');
        this.object.add(next.ground);
      }
      adopted = true;
      this.stats = { ...this.stats, border: border.length, outer: outer.length };
    } catch (err) {
      console.warn('[Viewport3D] scenery preview unavailable:', err);
      this.clear();
      this.available = false;
    } finally {
      if (!adopted) {
        for (const m of next.built) m.dispose();
        next.ground?.geometry.dispose();
      }
    }
  }

  _add(merged) {
    this.object.add(merged.object);
    this._built.push(merged);
  }

  /** Has the environment changed since the last build? */
  stale(level) {
    return SceneryPreview.envKey(level) !== this._key;
  }

  clear() {
    for (const m of this._built) m.dispose();
    this._built = [];
    if (this._ground) {
      this._ground.geometry.dispose(); // the material is the shared TextureLibrary one
      this._ground.removeFromParent();
      this._ground = null;
    }
  }

  setVisible(v) {
    this.object.visible = v;
  }

  dispose() {
    this._cancel();
    this.clear();
    this.object.removeFromParent();
  }
}
