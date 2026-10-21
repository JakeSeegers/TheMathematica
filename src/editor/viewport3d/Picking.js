import * as THREE from 'three';
import { LEVEL_HEIGHT } from '../../engine/constants.js';
import { charToLevel } from '../../engine/level/LevelFormat.js';
import { isOwnKey } from '../../engine/utils/own.js';

/** @import { Level } from '../../engine/level/types.js' */

const AUTO_WATER_DEPTH = 0.35; // TileMap: water tiles above the global level get this depth
const STAIR_DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const EPS = 1e-5;

/**
 * Terrain surface helpers read straight from the level data (so picking always matches the level
 * being edited, even while a throttled terrain rebuild is still pending).
 */
export class LevelSurface {
  /** @param {() => Level} getLevel */
  constructor(getLevel) {
    this.getLevel = getLevel;
    this.minY = 0;
    this.maxY = 1;
    this.baseY = -2;
    this._key = null;
    this.invalidate();
  }

  /** Recompute the height range (call after terrain edits). */
  invalidate() {
    const level = this.getLevel();
    if (!level) return;
    let lo = Infinity;
    let hi = -Infinity;
    for (let j = 0; j < level.depth; j++) {
      const row = level.heights[j];
      const trow = level.tiles[j];
      for (let i = 0; i < level.width; i++) {
        const def = level.legend[trow[i]];
        if (!def || def.void) continue;
        const h = charToLevel(row[i]) * LEVEL_HEIGHT;
        if (h < lo) lo = h;
        const top = h + (def.stairs ? LEVEL_HEIGHT : 0) + (def.water ? 1 : 0);
        if (top > hi) hi = top;
      }
    }
    if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
    this.minY = lo;
    this.maxY = Math.max(hi, (level.waterLevel ?? 0) + 0.1);
    this.baseY = lo - 2;
  }

  /** Legend entry at (i, j) or null (outside / void / unknown). */
  def(i, j) {
    const level = this.getLevel();
    if (i < 0 || j < 0 || i >= level.width || j >= level.depth) return null;
    const d = level.legend[level.tiles[j][i]];
    return d && !d.void ? d : null;
  }

  /** Bed height (world Y) of tile (i, j); null outside / void. */
  bed(i, j) {
    const level = this.getLevel();
    if (i < 0 || j < 0 || i >= level.width || j >= level.depth) return null;
    const d = level.legend[level.tiles[j][i]];
    if (!d || d.void) return null;
    return charToLevel(level.heights[j][i]) * LEVEL_HEIGHT;
  }

  /** Water surface of a water tile (TileMap rules), or null. */
  waterSurface(i, j) {
    const d = this.def(i, j);
    if (!d || !d.water) return null;
    const h = this.bed(i, j);
    if (typeof d.waterLevel === 'number') return d.waterLevel;
    if (typeof d.waterDepth === 'number') return h + d.waterDepth;
    const wl = this.getLevel().waterLevel ?? 0.35;
    return wl > h + 0.02 ? wl : h + AUTO_WATER_DEPTH;
  }

  /**
   * Ground height at a world point, like TileMap.getHeight (stairs ramp, water → bed height,
   * void / outside → baseY).
   */
  groundAt(x, z) {
    const i = Math.floor(x);
    const j = Math.floor(z);
    const d = this.def(i, j);
    if (!d) return this.baseY;
    const h = this.bed(i, j);
    if (isOwnKey(STAIR_DIRS, d.stairs)) return h + Math.min(1, Math.max(0, stairProgress(d.stairs, x - i, z - j))) * LEVEL_HEIGHT;
    return h;
  }

  /** Visible surface height (water surface on water tiles, ramp on stairs). */
  surfaceAt(x, z) {
    const i = Math.floor(x);
    const j = Math.floor(z);
    const w = this.waterSurface(i, j);
    return w != null ? Math.max(w, this.bed(i, j)) : this.groundAt(x, z);
  }

  /**
   * Corner heights of a tile's visible surface: [NW, NE, SE, SW] (x0z0, x1z0, x1z1, x0z1).
   * @returns {number[]|null}
   */
  corners(i, j, out = [0, 0, 0, 0]) {
    const d = this.def(i, j);
    if (!d) return null;
    const w = this.waterSurface(i, j);
    const h = w != null ? Math.max(w, this.bed(i, j)) : this.bed(i, j);
    out[0] = out[1] = out[2] = out[3] = h;
    if (w == null && isOwnKey(STAIR_DIRS, d.stairs)) {
      const up = h + LEVEL_HEIGHT;
      if (d.stairs === 'N') { out[0] = up; out[1] = up; }
      else if (d.stairs === 'S') { out[2] = up; out[3] = up; }
      else if (d.stairs === 'E') { out[1] = up; out[2] = up; }
      else { out[0] = up; out[3] = up; }
    }
    return out;
  }
}

/** 0 at the low edge → 1 at the high edge of a stairs tile (local coords 0..1). */
export function stairProgress(dir, lx, lz) {
  switch (dir) {
    case 'N': return 1 - lz;
    case 'S': return lz;
    case 'E': return lx;
    default: return 1 - lx;
  }
}

/**
 * @typedef {object} TerrainHit
 * @property {boolean} hit
 * @property {number} i
 * @property {number} j
 * @property {number} x  the picked world point (on side faces nudged into the tile the face
 *   belongs to)
 * @property {number} y  ground height there (TileMap convention: water → bed)
 * @property {number} z  see x
 * @property {number} surfaceY  the visible surface hit
 * @property {number} t
 * @property {'top'|'side'|'plane'|'none'} face
 * @property {THREE.Vector3} normal
 */

/**
 * Ray vs. the level's height field (blocky tops, stairs ramps, water surfaces, cliff faces) with
 * a 2D grid DDA — exact for Luminati terrain and far cheaper than raycasting the terrain meshes.
 * Clicks on a cliff face resolve to the higher tile the face belongs to (the tile the user sees).
 * Misses fall back to a horizontal plane (`fallbackY`), so pointers beyond the map edge still
 * map to (out-of-map) tiles.
 */
export class TerrainPicker {
  /** @param {LevelSurface} surface */
  constructor(surface) {
    this.surface = surface;
    /** Height of the fallback plane used when the ray misses the terrain. */
    this.fallbackY = 1;
    this._n = new THREE.Vector3();
  }

  /**
   * @param {THREE.Ray} ray world-space ray (normalised direction)
   * @param {Partial<TerrainHit>} [out] filled in and returned (default: a new object)
   * @returns {TerrainHit}
   */
  pick(ray, out = {}) {
    out.normal ??= new THREE.Vector3();
    const s = this.surface;
    const level = s.getLevel();
    const O = ray.origin;
    const Dv = ray.direction;
    const W = level.width;
    const D = level.depth;
    const yTop = s.maxY + 0.01;
    const yBot = s.baseY;

    // clip against the map box [0,W]×[baseY,maxY]×[0,D]
    let t0 = 0;
    let t1 = Infinity;
    const clip = (o, d, lo, hi) => {
      if (Math.abs(d) < 1e-12) return o >= lo && o <= hi;
      let a = (lo - o) / d;
      let b = (hi - o) / d;
      if (a > b) [a, b] = [b, a];
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
      return t0 <= t1;
    };
    let hit = clip(O.x, Dv.x, 0, W) && clip(O.z, Dv.z, 0, D) && clip(O.y, Dv.y, yBot, yTop);
    if (hit) hit = this._march(O, Dv, t0, t1, level, out);
    if (hit) return /** @type {TerrainHit} */ (out); // (_march filled it)
    return this._plane(O, Dv, out);
  }

  _march(O, Dv, tStart, tEnd, level, out) {
    const s = this.surface;
    const W = level.width;
    const D = level.depth;
    let t = tStart;
    let x = O.x + Dv.x * t;
    let z = O.z + Dv.z * t;
    let i = Math.min(W - 1, Math.max(0, Math.floor(x)));
    let j = Math.min(D - 1, Math.max(0, Math.floor(z)));
    const stepI = Dv.x > 0 ? 1 : -1;
    const stepJ = Dv.z > 0 ? 1 : -1;
    const dx = Math.abs(Dv.x) > 1e-12 ? Math.abs(1 / Dv.x) : Infinity;
    const dz = Math.abs(Dv.z) > 1e-12 ? Math.abs(1 / Dv.z) : Infinity;
    let tMaxX = Dv.x > 0 ? (i + 1 - O.x) / Dv.x : Dv.x < 0 ? (i - O.x) / Dv.x : Infinity;
    let tMaxZ = Dv.z > 0 ? (j + 1 - O.z) / Dv.z : Dv.z < 0 ? (j - O.z) / Dv.z : Infinity;
    let entryFace = null; // normal of the face through which the ray entered the cell
    let guard = W + D + 4;
    while (guard-- > 0 && t <= tEnd + EPS) {
      const tExit = Math.min(tMaxX, tMaxZ, tEnd);
      const d = s.def(i, j);
      if (d) {
        const w = s.waterSurface(i, j);
        const bed = s.bed(i, j);
        const top = w != null ? Math.max(w, bed) : bed;
        const stairs = w == null && isOwnKey(STAIR_DIRS, d.stairs) ? d.stairs : null;
        const heightAt = (px, pz) => (stairs ? top + Math.min(1, Math.max(0, stairProgress(stairs, px - i, pz - j))) * LEVEL_HEIGHT : top);
        const ye = O.y + Dv.y * t;
        const xe = O.x + Dv.x * t;
        const ze = O.z + Dv.z * t;
        if (ye <= heightAt(xe, ze) + 1e-4) {
          // entered below the surface: a vertical face of this tile (cliff / map edge)
          const n = entryFace ?? this._n.set(-Math.sign(Dv.x) || 0, 0, 0);
          return this._fill(out, i, j, xe, ye, ze, t, 'side', n);
        }
        // crossing of the (flat or ramped) top inside the cell
        let th = null;
        if (!stairs) {
          if (Dv.y < 0) th = (top - O.y) / Dv.y;
        } else {
          // y(t) = top + L·p(x(t), z(t)), p linear → solve linearly
          const [sx, sz] = STAIR_DIRS[stairs];
          const k0 = stairProgress(stairs, O.x - i, O.z - j);
          const kd = sx * Dv.x + sz * Dv.z; // dp/dt
          const denom = Dv.y - LEVEL_HEIGHT * kd;
          if (Math.abs(denom) > 1e-9) th = (top + LEVEL_HEIGHT * k0 - O.y) / denom;
        }
        if (th != null && th >= t - EPS && th <= tExit + EPS) {
          const hx = O.x + Dv.x * th;
          const hz = O.z + Dv.z * th;
          return this._fill(out, i, j, hx, O.y + Dv.y * th, hz, th, 'top', this._n.set(0, 1, 0));
        }
      }
      // step to the next cell
      if (tMaxX < tMaxZ) {
        t = tMaxX;
        tMaxX += dx;
        i += stepI;
        entryFace = this._n.set(-stepI, 0, 0);
      } else {
        t = tMaxZ;
        tMaxZ += dz;
        j += stepJ;
        entryFace = this._n.set(0, 0, -stepJ);
      }
      if (i < 0 || j < 0 || i >= W || j >= D) return false;
      if (t > tEnd) return false;
      x = O.x + Dv.x * t;
      z = O.z + Dv.z * t;
    }
    return false;
  }

  _fill(out, i, j, x, y, z, t, face, normal) {
    // nudge into the tile the face belongs to, so floor() resolves to (i, j)
    const e = 1e-3;
    out.x = Math.min(i + 1 - e, Math.max(i + e, x));
    out.z = Math.min(j + 1 - e, Math.max(j + e, z));
    out.i = i;
    out.j = j;
    out.surfaceY = y;
    out.y = this.surface.groundAt(out.x, out.z);
    out.t = t;
    out.face = face;
    out.hit = true;
    out.normal.copy(normal);
    return true;
  }

  _plane(O, Dv, out) {
    const y = this.fallbackY;
    let t;
    if (Dv.y < -1e-6) t = (y - O.y) / Dv.y;
    if (t == null || t < 0) {
      // above the horizon: a far point along the view direction
      const h = Math.hypot(Dv.x, Dv.z) || 1;
      t = 600;
      out.x = O.x + (Dv.x / h) * t;
      out.z = O.z + (Dv.z / h) * t;
      out.hit = false;
      out.face = 'none';
    } else {
      out.x = O.x + Dv.x * t;
      out.z = O.z + Dv.z * t;
      out.hit = true;
      out.face = 'plane';
    }
    out.i = Math.floor(out.x);
    out.j = Math.floor(out.z);
    out.surfaceY = y;
    out.y = y;
    out.t = t;
    out.normal.set(0, 1, 0);
    return out;
  }
}
