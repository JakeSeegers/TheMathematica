import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

/**
 * Shared look & building blocks of the viewport's editor overlays (drawn in a separate pass on
 * top of the rendered image, never tone-mapped, fogged or blurred): fat anti-aliased lines,
 * thin grid lines, translucent fills, screen-sized handles and bracket boxes.
 */

/** Overlay palette (Luminati navy / gold accents). */
export const COLORS = Object.freeze({
  hover: '#8fe3ff',
  select: '#ffc94d',
  selectDim: '#ffe7a8',
  hoverObject: '#ffffff',
  brush: '#8fe3ff',
  ghost: '#bfe8ff',
  line: '#ffd36b',
  rect: '#ffd36b',
  region: '#e3b35c',
  exit: '#7fd6a8',
  event: '#e8c25a',
  spawn: '#7fe3ff',
  critters: '#f0a060',
  gridMinor: '#ffffff',
  gridMajor: '#ffffff',
  gridBorder: '#e8c068',
});

const _css = new THREE.Color();

/**
 * Parse a CSS colour, keeping its alpha (THREE.Color ignores — and warns about — alpha):
 * '#rgb', '#rrggbb', '#rrggbbaa', 'rgb()/rgba()', 'hsl()/hsla()', named colours.
 * @param {string|number|null|undefined} css
 * @param {string} [fallback]
 * @returns {{ color: THREE.Color, alpha: number }} (the colour object is reused — copy it)
 */
export function parseCss(css, fallback = '#ffffff') {
  let alpha = 1;
  let s = css ?? fallback;
  if (typeof s === 'number') return { color: _css.setHex(s), alpha };
  s = String(s).trim();
  let m = s.match(/^(rgba?|hsla?)\(\s*([^)]*)\)$/i);
  if (m) {
    const parts = m[2].split(/\s*[,/]\s*|\s+/).filter(Boolean);
    if (parts.length >= 4) {
      const a = parts[3];
      alpha = a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a);
      if (!Number.isFinite(alpha)) alpha = 1;
    }
    s = `${m[1].toLowerCase().startsWith('rgb') ? 'rgb' : 'hsl'}(${parts.slice(0, 3).join(',')})`;
  } else if ((m = s.match(/^#([0-9a-f]{8})$/i))) {
    alpha = parseInt(m[1].slice(6), 16) / 255;
    s = `#${m[1].slice(0, 6)}`;
  } else if ((m = s.match(/^#([0-9a-f]{4})$/i))) {
    alpha = parseInt(m[1][3] + m[1][3], 16) / 255;
    s = `#${m[1].slice(0, 3)}`;
  }
  try {
    _css.setStyle(s);
  } catch {
    _css.set(fallback);
  }
  return { color: _css, alpha: Math.max(0, Math.min(1, alpha)) };
}

/** Emitter preset → marker colour. */
export const EMITTER_COLORS = {
  fireflies: '#b8f07a', leaves: '#e7a23f', petals: '#f3a5c8', dust: '#efe3c2', embers: '#ff8a3d',
  smoke: '#b8b2ae', mist: '#bfe6ff', sparkle: '#fff2a8', snow: '#f4f8ff', rain: '#8fb8ff',
};

let _handleTexture = null;
/** Round handle sprite (white fill, dark rim) — tinted by the material colour. */
function handleTexture() {
  if (_handleTexture) return _handleTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.beginPath();
  g.arc(32, 32, 26, 0, Math.PI * 2);
  g.fillStyle = '#10141f';
  g.fill();
  g.beginPath();
  g.arc(32, 32, 19, 0, Math.PI * 2);
  g.fillStyle = '#ffffff';
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  _handleTexture = t;
  return t;
}

let _glowTexture = null;
/** Soft round glow (markers for invisible lights, emitter centres). */
export function glowTexture() {
  if (_glowTexture) return _glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.22)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  _glowTexture = t;
  return t;
}

/**
 * Factory + registry of overlay materials (fat-line materials need the viewport resolution).
 */
export class GizmoKit {
  constructor() {
    this._lineMats = new Set();
    this._owned = new Set();
    this.resolution = new THREE.Vector2(1, 1);
    this.pixelRatio = 1;
  }

  /** Keep fat lines / handles at a constant on-screen size. */
  setResolution(width, height, pixelRatio = 1) {
    this.resolution.set(width, height);
    this.pixelRatio = pixelRatio;
    for (const m of this._lineMats) m.resolution.set(width, height);
  }

  /**
   * Fat line material (screen-space width in CSS px).
   * @param {{ color?: string, width?: number, opacity?: number, depthTest?: boolean, dashed?: boolean, dashSize?: number, gapSize?: number }} [o]
   */
  lineMaterial({ color = '#ffffff', width = 2, opacity = 1, depthTest = true, dashed = false, dashSize = 0.4, gapSize = 0.25 } = {}) {
    const m = new LineMaterial({
      color: new THREE.Color(color).getHex(),
      linewidth: width,
      transparent: true,
      opacity,
      depthTest,
      depthWrite: false,
      dashed,
      dashSize,
      gapSize,
      worldUnits: false,
    });
    m.toneMapped = false;
    m.resolution.copy(this.resolution);
    this._lineMats.add(m);
    this._owned.add(m);
    return m;
  }

  /** Thin (1 px) line material. */
  thinMaterial({ color = '#ffffff', opacity = 1, depthTest = true } = {}) {
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest, depthWrite: false, toneMapped: false, fog: false });
    this._owned.add(m);
    return m;
  }

  /** Translucent fill material (double sided). */
  fillMaterial({ color = '#ffffff', opacity = 0.2, depthTest = true, blending = THREE.NormalBlending } = {}) {
    const m = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthTest, depthWrite: false, side: THREE.DoubleSide,
      toneMapped: false, fog: false, blending,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
    this._owned.add(m);
    return m;
  }

  /** Screen-sized round handles. */
  handleMaterial({ color = '#ffffff', size = 11, depthTest = false } = {}) {
    const m = new THREE.PointsMaterial({
      color, map: handleTexture(), size, sizeAttenuation: false, transparent: true, alphaTest: 0.05,
      depthTest, depthWrite: false, toneMapped: false, fog: false,
    });
    this._owned.add(m);
    return m;
  }

  /** Soft glow sprites (world-sized). */
  glowMaterial({ color = '#ffffff', size = 0.9, opacity = 0.9, depthTest = true } = {}) {
    const m = new THREE.PointsMaterial({
      color, map: glowTexture(), size, sizeAttenuation: true, transparent: true, opacity,
      depthTest, depthWrite: false, toneMapped: false, fog: false, blending: THREE.AdditiveBlending,
    });
    this._owned.add(m);
    return m;
  }

  /** Release a material made by this kit. */
  release(m) {
    if (!m) return;
    this._lineMats.delete(m);
    this._owned.delete(m);
    m.dispose();
  }

  dispose() {
    for (const m of this._owned) m.dispose();
    this._owned.clear();
    this._lineMats.clear();
  }
}

/** Fat line segments object from flat xyz pairs. */
export function fatSegments(positions, material) {
  const g = new LineSegmentsGeometry();
  g.setPositions(positions.length ? positions : [0, -1e4, 0, 0, -1e4, 0]);
  const l = new LineSegments2(g, material);
  if (material.dashed) l.computeLineDistances();
  l.frustumCulled = false;
  l.renderOrder = 10;
  return l;
}

/** Thin line segments from flat xyz pairs. */
export function thinSegments(positions, material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const l = new THREE.LineSegments(g, material);
  l.frustumCulled = false;
  return l;
}

/** Mesh from flat triangle positions. */
export function fillMesh(positions, material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions instanceof Float32Array ? positions : new Float32Array(positions), 3));
  const m = new THREE.Mesh(g, material);
  m.frustumCulled = false;
  return m;
}

/** Points from flat xyz. */
export function pointsObject(positions, material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const p = new THREE.Points(g, material);
  p.frustumCulled = false;
  p.renderOrder = 20;
  return p;
}

const _c = [];
for (let k = 0; k < 8; k++) _c.push(new THREE.Vector3());

/**
 * Corner brackets of a (possibly rotated) box: `localBox` in the frame `matrix`.
 * @param {THREE.Box3} localBox
 * @param {THREE.Matrix4} matrix
 * @param {number} [frac] bracket length as a fraction of each edge
 * @param {number[]} [out]
 * @returns {number[]} flat xyz pairs
 */
export function bracketSegments(localBox, matrix, frac = 0.25, out = []) {
  const a = localBox.min;
  const b = localBox.max;
  let k = 0;
  for (const x of [a.x, b.x]) for (const y of [a.y, b.y]) for (const z of [a.z, b.z]) _c[k++].set(x, y, z);
  const size = [b.x - a.x, b.y - a.y, b.z - a.z];
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  for (let n = 0; n < 8; n++) {
    const c = _c[n];
    const dirs = [
      [c.x === a.x ? 1 : -1, 0, 0, size[0]],
      [0, c.y === a.y ? 1 : -1, 0, size[1]],
      [0, 0, c.z === a.z ? 1 : -1, size[2]],
    ];
    for (const [dx, dy, dz, len] of dirs) {
      const l = Math.min(len * frac, 1.2);
      p.copy(c).applyMatrix4(matrix);
      q.set(c.x + dx * l, c.y + dy * l, c.z + dz * l).applyMatrix4(matrix);
      out.push(p.x, p.y, p.z, q.x, q.y, q.z);
    }
  }
  return out;
}

/** All 12 edges of a (rotated) box as segment pairs. */
export function boxEdges(localBox, matrix, out = []) {
  const a = localBox.min;
  const b = localBox.max;
  const P = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(matrix);
  const c = [P(a.x, a.y, a.z), P(b.x, a.y, a.z), P(b.x, a.y, b.z), P(a.x, a.y, b.z), P(a.x, b.y, a.z), P(b.x, b.y, a.z), P(b.x, b.y, b.z), P(a.x, b.y, b.z)];
  const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (const [i, j] of E) out.push(c[i].x, c[i].y, c[i].z, c[j].x, c[j].y, c[j].z);
  return out;
}

/** Dispose an overlay object's geometry (materials are owned by the kit). */
export function disposeGeometry(o) {
  o?.traverse?.((c) => c.geometry?.dispose());
  o?.removeFromParent();
}
