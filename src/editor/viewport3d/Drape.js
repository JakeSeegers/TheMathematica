import * as THREE from 'three';

/** @import { LevelSurface } from './Picking.js' */

/**
 * Geometry helpers that drape editor overlays over the terrain surface (read from the level data
 * through a LevelSurface): cell highlights, rectangles, lines and circles that follow cliffs,
 * stairs and water surfaces.
 */

const C = [0, 0, 0, 0];

/** Bilinear height inside a tile from its corners [NW, NE, SE, SW] at local (u, v). */
function cornerLerp(c, u, v) {
  const top = c[0] + (c[1] - c[0]) * u;
  const bot = c[3] + (c[2] - c[3]) * u;
  return top + (bot - top) * v;
}

/**
 * Filled quads over a list of cells (one quad per tile, following its surface).
 * @param {LevelSurface} surface
 * @param {{i:number,j:number}[]} cells
 * @param {number} [lift]
 * @param {number} [inset] shrink each quad (world units)
 * @returns {Float32Array} triangle positions
 */
export function cellQuads(surface, cells, lift = 0.03, inset = 0) {
  const out = new Float32Array(cells.length * 18);
  let n = 0;
  for (const { i, j } of cells) {
    const c = surface.corners(i, j, C);
    const y = c ? null : surface.baseY + 2;
    const x0 = i + inset, x1 = i + 1 - inset, z0 = j + inset, z1 = j + 1 - inset;
    const h = (u, v) => (c ? cornerLerp(c, u, v) : y) + lift;
    const a = [x0, h(inset, inset), z0];
    const b = [x1, h(1 - inset, inset), z0];
    const cc = [x1, h(1 - inset, 1 - inset), z1];
    const d = [x0, h(inset, 1 - inset), z1];
    for (const p of [a, d, cc, a, cc, b]) { out[n++] = p[0]; out[n++] = p[1]; out[n++] = p[2]; }
  }
  return out;
}

/**
 * Boundary edges of a set of cells (edges not shared with another cell of the set), as line
 * segment pairs following the terrain.
 * @returns {number[]} flat xyz pairs
 */
export function cellOutline(surface, cells, lift = 0.04) {
  const set = new Set(cells.map((c) => `${c.i},${c.j}`));
  const out = [];
  for (const { i, j } of cells) {
    const c = surface.corners(i, j, C) ?? [surface.baseY + 2, surface.baseY + 2, surface.baseY + 2, surface.baseY + 2];
    const [nw, ne, se, sw] = c;
    if (!set.has(`${i},${j - 1}`)) out.push(i, nw + lift, j, i + 1, ne + lift, j);
    if (!set.has(`${i + 1},${j}`)) out.push(i + 1, ne + lift, j, i + 1, se + lift, j + 1);
    if (!set.has(`${i},${j + 1}`)) out.push(i + 1, se + lift, j + 1, i, sw + lift, j + 1);
    if (!set.has(`${i - 1},${j}`)) out.push(i, sw + lift, j + 1, i, nw + lift, j);
  }
  return out;
}

/**
 * Filled rectangle draped over the terrain (per-tile pieces clipped to the rect).
 * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} r
 * @returns {Float32Array} triangle positions
 */
export function rectFill(surface, r, lift = 0.03) {
  const pos = [];
  const i0 = Math.floor(r.minX);
  const i1 = Math.ceil(r.maxX) - 1;
  const j0 = Math.floor(r.minZ);
  const j1 = Math.ceil(r.maxZ) - 1;
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > 40000) return new Float32Array(0);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const c = surface.corners(i, j, C);
      const x0 = Math.max(i, r.minX), x1 = Math.min(i + 1, r.maxX);
      const z0 = Math.max(j, r.minZ), z1 = Math.min(j + 1, r.maxZ);
      if (x1 <= x0 || z1 <= z0) continue;
      const h = (x, z) => (c ? cornerLerp(c, x - i, z - j) : surface.baseY + 2) + lift;
      const a = [x0, h(x0, z0), z0], b = [x1, h(x1, z0), z0], cc = [x1, h(x1, z1), z1], d = [x0, h(x0, z1), z1];
      for (const p of [a, d, cc, a, cc, b]) pos.push(p[0], p[1], p[2]);
    }
  }
  return new Float32Array(pos);
}

/**
 * Points along a polyline, sampled every `step` units and lifted above the terrain surface
 * (cliffs produce steep little steps, which reads well).
 * @param {{x:number,z:number}[]} pts
 * @returns {THREE.Vector3[]}
 */
export function drapedPath(surface, pts, { step = 0.25, lift = 0.05, closed = false } = {}) {
  const out = [];
  const list = closed ? [...pts, pts[0]] : pts;
  for (let k = 0; k < list.length - 1; k++) {
    const a = list[k];
    const b = list[k + 1];
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(L / step));
    for (let s = k === 0 ? 0 : 1; s <= n; s++) {
      const t = s / n;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      out.push(new THREE.Vector3(x, surface.surfaceAt(x, z) + lift, z));
    }
  }
  return out;
}

/** Draped circle (world units). */
export function drapedCircle(surface, cx, cz, r, { segments = 48, lift = 0.05 } = {}) {
  const pts = [];
  for (let k = 0; k < segments; k++) {
    const a = (k / segments) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r });
  }
  return drapedPath(surface, pts, { step: Math.max(0.2, (2 * Math.PI * r) / segments), lift, closed: true });
}

/** Rect outline as a closed draped path. */
export function drapedRect(surface, r, opts = {}) {
  return drapedPath(surface, [
    { x: r.minX, z: r.minZ }, { x: r.maxX, z: r.minZ }, { x: r.maxX, z: r.maxZ }, { x: r.minX, z: r.maxZ },
  ], { ...opts, closed: true });
}

/** Convert a point path into LineSegments pairs (flat xyz). */
export function pathToSegments(path, out = []) {
  for (let k = 0; k < path.length - 1; k++) {
    const a = path[k];
    const b = path[k + 1];
    out.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  return out;
}
