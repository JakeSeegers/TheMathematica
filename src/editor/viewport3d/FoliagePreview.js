import * as THREE from 'three';
import * as GROUND from '../../game/GroundDetail.js';
import { addSnowCover } from '../../game/SnowCover.js';
import { boxUnion } from '../../engine/world/Props.js';
import { groundDetailArgs, foliageMaxInstances } from '../../game/LevelLook.js';

/**
 * @import { Level } from '../../engine/level/types.js'
 * @import { TileMap } from '../../engine/world/TileMap.js'
 * @import { ObjectPreview } from './ObjectPreview.js'
 */

/**
 * FoliagePreview — the game's ground foliage (grass tufts, flower beds, reeds, bushes from
 * src/game/GroundDetail.js) scattered over the level exactly as the game does it: kept clear of
 * prop colliders and house doors, ferns around tree roots, short grass where villagers stand, and
 * the level's `environment.foliage` flower / shrub areas.
 *
 * Part of the full diorama preview (state.view.atmosphere): tall grass would hide tile edges while
 * editing. Rebuilt (debounced) once edits pause; the old field stays until the new one is ready.
 */
export class FoliagePreview {
  /** @param {{ parent: THREE.Object3D }} opts */
  constructor({ parent }) {
    this.object = new THREE.Group();
    this.object.name = 'Editor:foliage';
    parent.add(this.object);
    this.available = typeof GROUND.buildGroundDetail === 'function';
    this._detail = null;
    /** Fields replaced by build(), freed by collect() once their successor rendered. */
    this._retired = [];
    this.enabled = false;
    this.pending = false;
    this._at = 0;
    this.stats = { ms: 0, grass: 0, flowers: 0 };
  }

  /** Turn the foliage on / off (off frees it). */
  setEnabled(on) {
    this.enabled = !!on && this.available;
    if (this.enabled) this.schedule(0);
    else this.clear();
  }

  /** Ask for a rebuild once editing pauses. */
  schedule(now = performance.now()) {
    if (!this.enabled) return;
    this.pending = true;
    this._at = now;
  }

  /** Should the pending rebuild run now? */
  due(now, inTransaction, quietMs = 600) {
    return this.enabled && this.pending && !inTransaction && now - this._at >= quietMs;
  }

  /**
   * @param {Level} level
   * @param {TileMap} tileMap
   * @param {ObjectPreview} props built props (colliders, doors)
   */
  build(level, tileMap, props) {
    this.pending = false;
    if (!this.enabled || !tileMap) return;
    const t0 = performance.now();
    const colliders = [];
    const houses = [];
    for (const e of props.entries.values()) {
      const cs = e.built.colliders ?? [];
      for (const c of cs) colliders.push(c);
      if (e.obj.type === 'house') {
        // (its box colliders together, as the game's World: one box, or a turned house's strips)
        const box = boxUnion(cs);
        if (box) houses.push({ ...box, door: e.built.interact?.position?.clone() ?? null });
      }
    }
    const isFree = (x, z) => {
      for (let k = 0; k < colliders.length; k++) {
        const c = colliders[k];
        if (c.type === 'circle') {
          const r = c.r + 0.1;
          if ((x - c.x) ** 2 + (z - c.z) ** 2 < r * r) return false;
        } else if (x > c.minX - 0.15 && x < c.maxX + 0.15 && z > c.minZ - 0.15 && z < c.maxZ + 0.15) return false;
      }
      return true;
    };
    let detail = null;
    try {
      // (the game's arguments — LevelLook: ferns, clearings, seed, sanitised areas, field size)
      detail = GROUND.buildGroundDetail({
        tileMap,
        isFree,
        houses,
        ...groundDetailArgs(level),
        maxInstances: foliageMaxInstances(level),
      });
    } catch (err) {
      console.warn('[Viewport3D] foliage preview unavailable:', err);
      this.available = false;
      this.enabled = false;
      return;
    }
    // the old field leaves the scene now but is freed only after the new one rendered (collect):
    // the new materials take over its shader programs instead of compiling them again
    const old = this._detail;
    if (old) {
      old.object.removeFromParent();
      this._retired.push(old);
    }
    this._detail = detail;
    // frosted tips under settled snow (the game's patch, see World.js; compiled in, so a weather
    // change never compiles anything)
    for (const f of detail.fields ?? []) addSnowCover(f.material, 'foliage');
    this.object.add(detail.object);
    this.stats = { ms: +(performance.now() - t0).toFixed(1), ...(detail.stats ?? {}) };
  }

  /** Free the fields build() replaced (after a render, like ObjectPreview / TerrainPreview.collect). */
  collect() {
    if (!this._retired.length) return;
    for (const d of this._retired) d.dispose?.();
    this._retired.length = 0;
  }

  clear() {
    this.collect();
    if (!this._detail) return;
    this._detail.dispose?.();
    this._detail.object.removeFromParent();
    this._detail = null;
  }

  dispose() {
    this.clear();
    this.object.removeFromParent();
  }
}
