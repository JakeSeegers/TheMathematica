/**
 * Sandbox for src/engine/pixel/Textures.js
 *
 * Views (query `?view=` or `window.__tex.setView(name)`):
 *   atlas            DOM atlas: every texture tiled 2×2 at 4× (pixelated) + normal/emissive maps
 *                    (&group=terrain|sides|buildings|props, &scale=N, &only=a,b,c)
 *   gallery0..3      three.js gallery pages (terrain / walls / roofs & openings / props & nature)
 *   diorama          the diorama camera on a mini diorama (grass cliff, cobble path, timber house)
 *   (&night=1 or __tex.setNight(true) for the night lighting with glowing windows)
 */
import * as THREE from 'three';
import { TextureLibrary, TEXTURE_NAMES } from '../src/engine/pixel/Textures.js';
import { DEG2RAD } from '../src/engine/utils/math.js';

const params = new URLSearchParams(location.search);
const lib = new TextureLibrary({ seed: 1337, anisotropy: 4 });

const tGen0 = performance.now();
lib.preload();
const genMs = performance.now() - tGen0;
console.log(`[textures] generated ${TEXTURE_NAMES.length} textures in ${genMs.toFixed(1)} ms`);

// ---------------------------------------------------------------------------
// DOM atlas
// ---------------------------------------------------------------------------

const GROUPS = {
  terrain: ['grass', 'grass_dark', 'grass_flowers', 'dirt', 'dirt_path', 'cobblestone', 'stone_tiles', 'sand', 'farmland', 'moss_stone', 'riverbed', 'wood_deck'],
  sides: ['cliff', 'grass_side', 'dirt_side', 'stone_wall'],
  buildings: ['plaster', 'timber_frame', 'wood_planks', 'wood_planks_dark', 'log_wall', 'brick', 'stone_brick', 'roof_red', 'roof_blue', 'roof_thatch', 'roof_slate', 'door', 'window', 'chimney_stone'],
  props: ['bark', 'leaves', 'leaves_autumn', 'pine', 'hay', 'cloth_red', 'cloth_stripe', 'metal', 'barrel', 'crate', 'fence_wood', 'rope', 'well_stone', 'lantern_glass', 'sign_board', 'flowerbox'],
};

function tiledCanvas(src, tiles, scale, alpha) {
  const c = document.createElement('canvas');
  c.width = src.width * tiles * scale;
  c.height = src.height * tiles * scale;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) g.drawImage(src, tx * src.width * scale, ty * src.height * scale, src.width * scale, src.height * scale);
  }
  if (alpha) c.classList.add('checker');
  return c;
}

function buildAtlas() {
  const root = document.getElementById('atlas');
  root.innerHTML = '';
  const only = params.get('only')?.split(',').filter(Boolean);
  const group = params.get('group');
  const scaleQ = params.get('scale');
  const aux = params.get('aux') !== '0';
  const tiles = Number(params.get('tiles') ?? 2);
  const sections = only ? { selection: only } : group ? { [group]: GROUPS[group] } : GROUPS;
  for (const [title, names] of Object.entries(sections)) {
    const h = document.createElement('h2');
    h.textContent = title;
    root.appendChild(h);
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const name of names) {
      const meta = lib.meta(name);
      const px = lib.pixels(name);
      const scale = scaleQ ? Number(scaleQ) : meta.px[0] >= 64 ? 2 : 4;
      const card = document.createElement('div');
      card.className = 'card';
      const row = document.createElement('div');
      row.className = 'row';
      row.appendChild(tiledCanvas(px.color.toCanvas(), tiles, scale, meta.alpha));
      if (aux) {
        const col = document.createElement('div');
        col.className = 'aux';
        const auxScale = Math.max(1, Math.round(scale / 2));
        if (px.normal) col.appendChild(tiledCanvas(px.normal.toCanvas(), 1, auxScale, false));
        if (px.emissive) col.appendChild(tiledCanvas(px.emissive.toCanvas(), 1, auxScale, false));
        row.appendChild(col);
      }
      card.appendChild(row);
      const lbl = document.createElement('div');
      lbl.className = 'lbl';
      lbl.innerHTML = `${name} <span>${meta.px[0]}×${meta.px[1]}px · ${meta.units[0]}×${meta.units[1]}u${meta.alpha ? ' · alpha' : ''}${meta.emissive ? ' · emissive' : ''}</span>`;
      card.appendChild(lbl);
      grid.appendChild(card);
    }
    root.appendChild(grid);
  }
}

// ---------------------------------------------------------------------------
// three.js scene
// ---------------------------------------------------------------------------

const container = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
container.appendChild(renderer.domElement);

const scene = /** @type {THREE.Scene & { background: THREE.Color, fog: THREE.FogExp2 }} */ (new THREE.Scene());
scene.background = new THREE.Color('#1b2130');
scene.fog = new THREE.FogExp2('#1b2130', 0.006);
const camera = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 0.5, 400);

const hemi = new THREE.HemisphereLight('#a9bde0', '#4a3a2e', 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffd6a0', 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -18; sun.shadow.camera.right = 18;
sun.shadow.camera.top = 18; sun.shadow.camera.bottom = -18;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 80;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 3;
scene.add(sun, sun.target);
const point = new THREE.PointLight('#ffb46b', 14, 9, 2);
point.castShadow = false;
const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffe2b0' }));
point.add(bulb);
scene.add(point);

// --- geometry helpers (world-space UVs: uv = world size / meta units) ---

/** Scale a geometry's UVs so one texture repeat = meta(name).units world units. */
function boxWorld(name, W, H, D, { top = null, sides = null } = {}) {
  const geo = new THREE.BoxGeometry(W, H, D);
  const uv = geo.attributes.uv;
  // face order: +x, -x, +y, -y, +z, -z ; each 4 verts
  const faceSize = [[D, H], [D, H], [W, D], [W, D], [W, H], [W, H]];
  const faceTex = [sides ?? name, sides ?? name, top ?? name, top ?? name, sides ?? name, sides ?? name];
  for (let f = 0; f < 6; f++) {
    const [fu, fv] = faceSize[f];
    const u = lib.meta(faceTex[f]).units;
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, (uv.getX(i) * fu) / u[0], (uv.getY(i) * fv) / u[1]);
    }
  }
  const mats = faceTex.map((n) => lib.material(n));
  const mesh = new THREE.Mesh(geo, mats);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function planeWorld(name, W, H, extra) {
  const geo = new THREE.PlaneGeometry(W, H);
  const u = lib.meta(name).units;
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * W) / u[0], (uv.getY(i) * H) / u[1]);
  const mesh = new THREE.Mesh(geo, lib.material(name, extra));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinderWorld(name, r, H, { open = false, seg = 16, capName = null } = {}) {
  const geo = new THREE.CylinderGeometry(r, r, H, seg, 1, open);
  const u = lib.meta(name).units;
  const uv = geo.attributes.uv;
  const circ = Math.PI * 2 * r;
  const sideCount = (seg + 1) * 2;
  for (let i = 0; i < sideCount; i++) uv.setXY(i, (uv.getX(i) * circ) / u[0], (uv.getY(i) * H) / u[1]);
  const mats = open ? lib.material(name) : [lib.material(name), lib.material(capName ?? name), lib.material(capName ?? name)];
  const mesh = new THREE.Mesh(geo, mats);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Tiny builder for terrain-style quads with explicit world UVs, grouped by material. */
class QuadBuilder {
  constructor() { this.groups = new Map(); }
  quad(name, a, b, c, d, uvs) {
    let g = this.groups.get(name);
    if (!g) { g = { pos: [], uv: [], idx: [] }; this.groups.set(name, g); }
    const base = g.pos.length / 3;
    for (const p of [a, b, c, d]) g.pos.push(p[0], p[1], p[2]);
    for (const t of uvs) g.uv.push(t[0], t[1]);
    g.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  /** Horizontal top face over [x0,x1]×[z0,z1] at height y. */
  top(name, x0, x1, z0, z1, y) {
    const [uw, uh] = lib.meta(name).units;
    const U = (x, z) => [x / uw, -z / uh];
    this.quad(name, [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [U(x0, z1), U(x1, z1), U(x1, z0), U(x0, z0)]);
  }
  /** Vertical face facing +Z at z, spanning x0..x1 and y0..y1; v anchored at `vTop` (v=1 at the top). */
  frontZ(name, x0, x1, y0, y1, z, vAnchorTop = null) {
    const [uw, uh] = lib.meta(name).units;
    const V = (y) => (vAnchorTop == null ? y / uh : 1 - (vAnchorTop - y) / uh);
    this.quad(name, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [[x0 / uw, V(y0)], [x1 / uw, V(y0)], [x1 / uw, V(y1)], [x0 / uw, V(y1)]]);
  }
  /** Vertical face facing +X / -X at x, spanning z0..z1. */
  sideX(name, x, z0, z1, y0, y1, facing = 1, vAnchorTop = null) {
    const [uw, uh] = lib.meta(name).units;
    const V = (y) => (vAnchorTop == null ? y / uh : 1 - (vAnchorTop - y) / uh);
    const za = facing > 0 ? z1 : z0, zb = facing > 0 ? z0 : z1;
    this.quad(name, [x, y0, za], [x, y0, zb], [x, y1, zb], [x, y1, za], [[-za / uw * facing, V(y0)], [-zb / uw * facing, V(y0)], [-zb / uw * facing, V(y1)], [-za / uw * facing, V(y1)]]);
  }
  build() {
    const group = new THREE.Group();
    for (const [name, g] of this.groups) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
      geo.setIndex(g.idx);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, lib.material(name));
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }
    return group;
  }
}

// --- gallery pages ---

const labels = [];
const labelRoot = document.getElementById('labels');
function addLabel(text, pos) {
  const el = document.createElement('div');
  el.textContent = text;
  labelRoot.appendChild(el);
  labels.push({ el, pos: pos.clone() });
}

const pages = [];
const neutral = new THREE.MeshLambertMaterial({ color: '#2b2f3a' });

function makePage(index, items, { cols = 6, pitchX = 3.6, pitchZ = 5, focusDz = 0 } = {}) {
  const origin = new THREE.Vector3(index * 60, 0, 0);
  const g = new THREE.Group();
  g.position.copy(origin);
  const rows = Math.ceil(items.length / cols);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(cols * pitchX + 4, 0.2, rows * pitchZ + 6), neutral);
  floor.position.set(0, -0.1, ((rows - 1) * pitchZ) / 2);
  floor.receiveShadow = true;
  g.add(floor);
  items.forEach(([name, build], k) => {
    const c = k % cols, r = Math.floor(k / cols);
    const x = (c - (cols - 1) / 2) * pitchX;
    const z = r * pitchZ;
    const obj = build(name);
    obj.position.x += x;
    obj.position.z += z;
    g.add(obj);
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    addLabel(name, new THREE.Vector3(origin.x + x, box.max.y + 0.35, origin.z + z));
  });
  scene.add(g);
  const focus = new THREE.Vector3(origin.x, 0.6, ((rows - 1) * pitchZ) / 2 + focusDz);
  pages.push({ focus, distance: 30 });
}

const ground = (name) => { const m = boxWorld(name, 3, 0.4, 3); m.position.y = 0.2; return m; };
const wall = (name) => { const m = boxWorld(name, 3, 3, 0.4); m.position.y = 1.5; return m; };
const sideWall = (name) => {
  // grass top slab + side texture (the way TileMap uses lips)
  const g = new THREE.Group();
  const qb = new QuadBuilder();
  qb.top('grass', -1.5, 1.5, -1.2, 0.2, 3);
  qb.frontZ(name, -1.5, 1.5, 2, 3, 0.2, 3);
  qb.frontZ('cliff', -1.5, 1.5, 0, 2, 0.2);
  g.add(qb.build());
  return g;
};
const roof = (name) => {
  const g = new THREE.Group();
  const p = planeWorld(name, 3, 3);
  p.rotation.x = -55 * DEG2RAD;
  p.position.set(0, 1.25, 0);
  g.add(p);
  return g;
};
const onWall = (name) => {
  const g = new THREE.Group();
  const w = boxWorld('plaster', 3, 3, 0.4);
  w.position.y = 1.5;
  g.add(w);
  const meta = lib.meta(name);
  const p = planeWorld(name, meta.units[0], meta.units[1]);
  p.position.set(0, name === 'door' ? 1.0 : 1.7, 0.205);
  g.add(p);
  if (name === 'window') {
    const p2 = planeWorld(name, 1, 1);
    p2.position.set(-1, 1.7, 0.205);
    p.position.x = 0.8;
    g.add(p2);
  }
  return g;
};
const block = (name) => { const m = boxWorld(name, 2, 2, 2); m.position.y = 1; return m; };
const barrel = (name) => {
  const g = new THREE.Group();
  for (const [x, z] of [[-0.6, 0], [0.6, 0.2], [0, -0.9]]) {
    const m = cylinderWorld(name, 0.45, 1, { capName: 'wood_planks' });
    m.position.set(x, 0.5, z);
    g.add(m);
  }
  return g;
};
const crate = (name) => {
  const g = new THREE.Group();
  const a = boxWorld(name, 1, 1, 1); a.position.set(-0.6, 0.5, 0.2);
  const b = boxWorld(name, 1, 1, 1); b.position.set(0.55, 0.5, -0.3); b.rotation.y = 0.3;
  const c = boxWorld(name, 1, 1, 1); c.position.set(-0.5, 1.5, 0.1); c.rotation.y = -0.2;
  g.add(a, b, c);
  return g;
};
const trunk = (name) => { const m = cylinderWorld(name, 0.5, 3, { capName: 'wood_planks' }); m.position.y = 1.5; return m; };
/** A canopy of camera-facing leaf cards (how a tree would use the texture) over a trunk. */
const foliage = (name) => {
  const g = new THREE.Group();
  const t = cylinderWorld('bark', 0.22, 1.6);
  t.position.y = 0.8;
  g.add(t);
  const cards = [[0, 2.5, 0, 2.6], [-0.8, 2.0, 0.3, 2.0], [0.8, 2.1, 0.2, 2.1], [0, 1.8, 0.6, 1.9], [-0.4, 3.1, -0.3, 1.8], [0.5, 3.0, -0.2, 1.7]];
  for (const [x, y, z, sz] of cards) {
    const p = planeWorld(name, sz, sz);
    p.position.set(x, y, z);
    p.rotation.x = -0.25;
    g.add(p);
  }
  return g;
};
const pineTree = (name) => {
  const g = new THREE.Group();
  const t = cylinderWorld('bark', 0.18, 1.2);
  t.position.y = 0.6;
  g.add(t);
  const tiers = [[1.35, 1.6, 0.8], [1.05, 1.4, 1.75], [0.72, 1.2, 2.6]];
  for (const [r, hgt, y] of tiers) {
    const geo = new THREE.ConeGeometry(r, hgt, 14, 1, true);
    const u = lib.meta(name).units;
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * Math.PI * 2 * r) / u[0], (uv.getY(i) * hgt) / u[1]);
    const m = new THREE.Mesh(geo, lib.material(name));
    m.position.y = y;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
};
const fence = (name) => {
  const g = new THREE.Group();
  const p = planeWorld(name, 3, 1);
  p.position.set(0, 0.5, 0);
  g.add(p);
  const p2 = planeWorld(name, 3, 1);
  p2.position.set(0, 0.5, -1.2);
  g.add(p2);
  return g;
};
const rope = (name) => {
  const g = new THREE.Group();
  const coil = new THREE.TorusGeometry(0.7, 0.14, 8, 24);
  const u = lib.meta(name).units;
  const uv = coil.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * Math.PI * 2 * 0.7) / u[0], (uv.getY(i) * Math.PI * 2 * 0.14) / u[1]);
  for (let k = 0; k < 3; k++) {
    const m = new THREE.Mesh(coil, lib.material(name));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.14 + k * 0.24;
    m.scale.setScalar(1 - k * 0.12);
    m.castShadow = true;
    g.add(m);
  }
  return g;
};
const well = (name) => {
  const g = new THREE.Group();
  const m = cylinderWorld(name, 1.1, 1.0, { seg: 20, capName: 'riverbed' });
  m.position.y = 0.5;
  g.add(m);
  return g;
};
const lantern = (name) => {
  const g = new THREE.Group();
  const post = boxWorld('metal', 0.14, 2.2, 0.14);
  post.position.y = 1.1;
  const box = boxWorld(name, 0.6, 0.8, 0.6, { top: 'metal' });
  box.position.y = 2.6;
  const cap = boxWorld('metal', 0.8, 0.14, 0.8);
  cap.position.y = 3.07;
  g.add(post, box, cap);
  return g;
};
const sign = (name) => {
  const g = new THREE.Group();
  const post = boxWorld('wood_planks_dark', 0.2, 2.4, 0.2);
  post.position.set(0, 1.2, -0.12);
  const board = boxWorld(name, 2, 1, 0.12, { sides: name });
  board.position.set(0, 1.8, 0);
  g.add(post, board);
  return g;
};
const flowerbox = (name) => {
  const g = new THREE.Group();
  const w = boxWorld('plaster', 3, 2.4, 0.4);
  w.position.set(0, 1.2, -0.4);
  const p = planeWorld(name, 3, 1);
  p.position.set(0, 0.5, 0.1);
  g.add(w, p);
  return g;
};
const awning = (name) => {
  const g = new THREE.Group();
  const p = planeWorld(name, 3, 2.4);
  p.rotation.x = -35 * DEG2RAD;
  p.position.set(0, 1.9, 0);
  const posts = [[-1.4, 0.8], [1.4, 0.8]].map(([x, z]) => { const m = boxWorld('wood_planks_dark', 0.14, 1.6, 0.14); m.position.set(x, 0.8, z); return m; });
  const table = boxWorld('wood_planks', 3, 0.9, 1.2);
  table.position.set(0, 0.45, 0);
  g.add(p, table, ...posts);
  return g;
};

makePage(0, GROUPS.terrain.map((n) => [n, ground]), { cols: 6, pitchX: 3.5, pitchZ: 4 });
makePage(1, [
  ['cliff', wall], ['grass_side', sideWall], ['dirt_side', wall], ['stone_wall', wall], ['plaster', wall], ['timber_frame', wall],
  ['wood_planks', wall], ['wood_planks_dark', wall], ['log_wall', wall], ['brick', wall], ['stone_brick', wall], ['chimney_stone', wall],
], { cols: 6, pitchX: 3.6, pitchZ: 6.5 });
makePage(2, [
  ['roof_red', roof], ['roof_blue', roof], ['roof_thatch', roof], ['roof_slate', roof], ['door', onWall], ['window', onWall],
  ['cloth_red', wall], ['cloth_stripe', awning], ['hay', block], ['metal', block], ['rope', rope], ['sign_board', sign],
], { cols: 6, pitchX: 3.6, pitchZ: 6.5 });
makePage(3, [
  ['bark', trunk], ['leaves', foliage], ['leaves_autumn', foliage], ['pine', pineTree], ['barrel', barrel], ['crate', crate],
  ['fence_wood', fence], ['well_stone', well], ['lantern_glass', lantern], ['flowerbox', flowerbox],
], { cols: 5, pitchX: 4.2, pitchZ: 6.5 });

// --- diorama ---

function buildDiorama() {
  const origin = new THREE.Vector3(260, 0, 0);
  const g = new THREE.Group();
  g.position.copy(origin);
  const qb = new QuadBuilder();
  // lower ground (y = 0): grass with a cobblestone path, floating-chunk edges
  const X0 = -9, X1 = 9, ZF = 6, ZC = -2, ZB = -10;
  qb.top('grass', X0, -1, ZC, ZF, 0);
  qb.top('cobblestone', -1, 1.5, ZC, ZF, 0);
  qb.top('grass_flowers', 1.5, X1, ZC, ZF, 0);
  qb.frontZ('grass_side', X0, -1, -1, 0, ZF, 0);
  qb.frontZ('stone_wall', -1, 1.5, -2, 0, ZF);
  qb.frontZ('grass_side', 1.5, X1, -1, 0, ZF, 0);
  qb.frontZ('cliff', X0, -1, -2, -1, ZF);
  qb.frontZ('cliff', 1.5, X1, -2, -1, ZF);
  // plateau (y = 2) with grass lip on its front cliff
  const ZS = ZC - 2; // stairs notch depth
  qb.top('grass', X0, -1, ZB, ZC, 2);
  qb.top('grass', 1.5, X1, ZB, ZC, 2);
  qb.top('grass', -1, 1.5, ZB, ZS, 2);
  qb.frontZ('grass_side', X0, -1, 1, 2, ZC, 2);
  qb.frontZ('cliff', X0, -1, 0, 1, ZC);
  qb.frontZ('grass_side', 1.5, X1, 1, 2, ZC, 2);
  qb.frontZ('cliff', 1.5, X1, 0, 1, ZC);
  // stone stairs cut into the cliff where the path climbs
  for (let s = 0; s < 4; s++) {
    const y0 = s * 0.5, y1 = (s + 1) * 0.5;
    const zf = ZC - s * 0.5, zb = ZC - (s + 1) * 0.5;
    qb.top('stone_tiles', -1, 1.5, zb, zf, y1);
    qb.frontZ('stone_brick', -1, 1.5, y0, y1, zf);
  }
  qb.sideX('stone_wall', -1, ZS, ZC, 0, 2, 1);
  qb.sideX('stone_wall', 1.5, ZS, ZC, 0, 2, -1);
  // chunk sides
  qb.sideX('grass_side', X1, ZB, ZF, -1, 0, 1, 0);
  qb.sideX('cliff', X1, ZB, ZF, -2, -1, 1);
  g.add(qb.build());

  // House on the plateau: timber-frame walls, red tile gable roof, door, window, flower box.
  const hx0 = -7.5, hx1 = -2.5, hz0 = -8.5, hz1 = -4.5, hy0 = 2, hy1 = 4.5;
  const hb = new QuadBuilder();
  hb.frontZ('timber_frame', hx0, hx1, hy0, hy1, hz1);
  hb.sideX('timber_frame', hx1, hz0, hz1, hy0, hy1, 1);
  // gable triangle (plaster)
  g.add(hb.build());
  const gableGeo = new THREE.BufferGeometry();
  const ridgeY = 6.3, ridgeZ = (hz0 + hz1) / 2;
  const pu = lib.meta('plaster').units;
  gableGeo.setAttribute('position', new THREE.Float32BufferAttribute([hx1, hy1, hz1, hx1, hy1, hz0, hx1, ridgeY, ridgeZ], 3));
  gableGeo.setAttribute('uv', new THREE.Float32BufferAttribute([-hz1 / pu[0], hy1 / pu[1], -hz0 / pu[0], hy1 / pu[1], -ridgeZ / pu[0], ridgeY / pu[1]], 2));
  gableGeo.computeVertexNormals();
  const gable = new THREE.Mesh(gableGeo, lib.material('plaster'));
  gable.castShadow = gable.receiveShadow = true;
  g.add(gable);
  // roof slopes with overhang
  const over = 0.45;
  const slopeLen = Math.hypot(ridgeY - hy1, hz1 - ridgeZ) + over * 1.3;
  const roofW = hx1 - hx0 + over * 2;
  const ang = Math.atan2(ridgeY - hy1, hz1 - ridgeZ);
  for (const side of [1, -1]) {
    const p = planeWorld('roof_red', roofW, slopeLen);
    p.material = lib.material('roof_red', { side: THREE.DoubleSide });
    const cz = ridgeZ + side * (Math.cos(ang) * slopeLen) / 2;
    const cy = ridgeY - (Math.sin(ang) * slopeLen) / 2 + 0.05;
    p.position.set((hx0 + hx1) / 2, cy, cz);
    p.rotation.set(side > 0 ? -(Math.PI / 2 - ang) : Math.PI / 2 - ang, side > 0 ? 0 : Math.PI, 0);
    if (side < 0) p.rotation.set(-(Math.PI / 2 - ang), Math.PI, 0);
    g.add(p);
  }
  const ridge = boxWorld('wood_planks_dark', roofW, 0.22, 0.3);
  ridge.position.set((hx0 + hx1) / 2, ridgeY + 0.08, ridgeZ);
  g.add(ridge);
  const chimney = boxWorld('chimney_stone', 0.8, 2.2, 0.8, { top: 'metal' });
  chimney.position.set(hx0 + 1.2, ridgeY + 0.2, ridgeZ - 1.0);
  g.add(chimney);
  const door = planeWorld('door', 1, 2);
  door.position.set(-6.2, hy0 + 1, hz1 + 0.02);
  g.add(door);
  for (const wx of [-4.6, -3.4]) {
    const win = planeWorld('window', 1, 1);
    win.position.set(wx, hy0 + 1.35, hz1 + 0.02);
    g.add(win);
  }
  const fb = planeWorld('flowerbox', 2.2, 0.55);
  fb.position.set(-4, hy0 + 0.72, hz1 + 0.18);
  g.add(fb);
  const fbBox = boxWorld('wood_planks', 2.2, 0.25, 0.28);
  fbBox.position.set(-4, hy0 + 0.57, hz1 + 0.12);
  g.add(fbBox);
  // lantern by the door
  const lp = boxWorld('metal', 0.12, 2.4, 0.12); lp.position.set(-7.9, 3.2 - 0, -3.9);
  const lb = boxWorld('lantern_glass', 0.45, 0.6, 0.45, { top: 'metal' }); lb.position.set(-7.9, 4.6, -3.9);
  g.add(lp, lb);
  // tree on the plateau
  const tr = cylinderWorld('bark', 0.3, 2.6);
  tr.position.set(4.5, 2 + 1.3, -6.5);
  g.add(tr);
  for (const [dx, dy, dz, sz] of [[0, 3.9, 0, 3.4], [-1.1, 3.2, 0.4, 2.6], [1.1, 3.3, 0.3, 2.7], [0, 2.9, 0.8, 2.4], [-0.6, 4.7, -0.4, 2.4], [0.7, 4.6, -0.3, 2.3]]) {
    const p = planeWorld('leaves', sz, sz);
    p.position.set(4.5 + dx, 2 + dy, -6.5 + dz);
    p.rotation.x = -0.25;
    g.add(p);
  }
  const tree2 = foliage('leaves_autumn');
  tree2.position.set(7.2, 0, 1.2);
  tree2.scale.setScalar(1.15);
  g.add(tree2);
  // pine on the lower ground
  const pine = pineTree('pine');
  pine.position.set(-7, 0, 2.5);
  pine.scale.setScalar(1.2);
  g.add(pine);
  // props along the path
  const br = cylinderWorld('barrel', 0.4, 0.9, { capName: 'wood_planks' }); br.position.set(2.4, 0.45, 1.2); g.add(br);
  const cr = boxWorld('crate', 0.9, 0.9, 0.9); cr.position.set(3.4, 0.45, 0.8); cr.rotation.y = 0.35; g.add(cr);
  const fz = 3.6;
  for (let k = 0; k < 3; k++) { const f = planeWorld('fence_wood', 1, 1); f.position.set(3 + k, 0.5, fz); g.add(f); }
  scene.add(g);
  return new THREE.Vector3(origin.x - 0.5, 1.6, -2.6);
}
const dioramaFocus = buildDiorama();

// ---------------------------------------------------------------------------
// Views & lighting modes
// ---------------------------------------------------------------------------

const state = { view: params.get('view') ?? 'gallery0', night: params.get('night') === '1', t: 0, focus: new THREE.Vector3(), distance: 24, lightOrbit: 5.5 };
const emissiveMats = [lib.material('window'), lib.material('lantern_glass')];

/** @param {boolean} on */
function setNight(on) {
  state.night = on;
  if (on) {
    sun.color.set('#7f9cff'); sun.intensity = 0.45;
    hemi.color.set('#34466e'); hemi.groundColor.set('#141820'); hemi.intensity = 0.55;
    point.intensity = 18;
    scene.background.set('#0b1020'); scene.fog.color.set('#0b1020');
    emissiveMats.forEach((m) => { m.emissiveIntensity = 1.6; });
  } else {
    sun.color.set('#ffcf94'); sun.intensity = 2.8;
    hemi.color.set('#a9bde0'); hemi.groundColor.set('#4a3a2e'); hemi.intensity = 0.9;
    point.intensity = 14;
    scene.background.set('#1b2130'); scene.fog.color.set('#1b2130');
    emissiveMats.forEach((m) => { m.emissiveIntensity = 0.0; });
  }
}

/** @param {string} v  'atlas', 'gallery0'…'gallery3' or 'diorama' */
function setView(v) {
  state.view = v;
  const atlas = document.getElementById('atlas');
  const isAtlas = v === 'atlas';
  atlas.classList.toggle('on', isAtlas);
  container.style.display = isAtlas ? 'none' : 'block';
  labelRoot.style.display = isAtlas || v === 'diorama' ? 'none' : 'block';
  if (isAtlas) { if (!atlas.childElementCount) buildAtlas(); return; }
  if (v === 'diorama') { state.focus.copy(dioramaFocus); state.distance = 24; state.lightOrbit = 3.5; }
  else {
    const p = pages[Number(v.replace('gallery', '')) || 0];
    state.focus.copy(p.focus); state.distance = p.distance; state.lightOrbit = 6;
  }
  placeCamera();
}

function placeCamera() {
  const pitch = 32 * DEG2RAD;
  camera.position.set(state.focus.x, state.focus.y + Math.sin(pitch) * state.distance, state.focus.z + Math.cos(pitch) * state.distance);
  camera.lookAt(state.focus);
  // warm low sun from the upper-left-front
  sun.position.set(state.focus.x - 16, state.focus.y + 12, state.focus.z + 10);
  sun.target.position.copy(state.focus);
  sun.target.updateMatrixWorld();
}

const _v = new THREE.Vector3();
function updateLabels() {
  if (labelRoot.style.display === 'none') return;
  const w = window.innerWidth, h = window.innerHeight;
  for (const l of labels) {
    _v.copy(l.pos).project(camera);
    const vis = _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
    l.el.style.display = vis ? 'block' : 'none';
    if (vis) { l.el.style.left = `${((_v.x + 1) / 2) * w}px`; l.el.style.top = `${((1 - _v.y) / 2) * h}px`; }
  }
}

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

const hud = document.getElementById('hud');
let last = performance.now();
let frames = 0, fpsT = 0, fps = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.t += dt;
  frames++; fpsT += dt;
  if (fpsT > 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; }
  if (state.view !== 'atlas') {
    const a = state.t * 0.6;
    point.position.set(state.focus.x + Math.cos(a) * state.lightOrbit, state.focus.y + (state.view === 'diorama' ? 2.4 : 1.8), state.focus.z + Math.sin(a) * state.lightOrbit * 0.6);
    renderer.render(scene, camera);
    updateLabels();
    const info = renderer.info.render;
    hud.textContent = `${state.view}${state.night ? ' · night' : ''} · ${fps.toFixed(0)} fps · ${info.calls} calls · gen ${genMs.toFixed(0)} ms`;
  } else hud.textContent = '';
  requestAnimationFrame(frame);
}

setNight(state.night);
setView(state.view);
requestAnimationFrame(frame);

/**
 * `window.__tex` (AUTOMATION_API.md §7).
 * @typedef {object} TexHandle
 * @property {TextureLibrary} lib
 * @property {typeof THREE} THREE
 * @property {THREE.WebGLRenderer} renderer
 * @property {THREE.Scene} scene
 * @property {THREE.PerspectiveCamera} camera
 * @property {THREE.DirectionalLight} sun
 * @property {THREE.HemisphereLight} hemi
 * @property {THREE.PointLight} point  the orbiting point light
 * @property {typeof pages} pages  the gallery pages ({ focus, distance, … })
 * @property {typeof state} state  view, night, t, focus, distance, lightOrbit
 * @property {number} genMs  generation time of every texture
 * @property {typeof setView} setView
 * @property {typeof setNight} setNight
 * @property {(dx?: number, dz?: number, distance?: number) => void} frame  move the diorama camera
 *   (focus offset in world units, distance)
 * @property {(a: number) => void} setLightAngle  freeze the orbiting light at angle `a` (rad)
 * @property {typeof TEXTURE_NAMES} names
 * @property {() => object} check  texture / material consistency: { count, list, missing, bad,
 *   emissive, cached, keyed }
 */
window.__tex = {
  lib, THREE, renderer, scene, camera, sun, hemi, point, pages, state, genMs,
  setView, setNight,
  /** Move the diorama camera (focus offset in world units, distance). */
  frame(dx = 0, dz = 0, distance = state.distance) { state.focus.x += dx; state.focus.z += dz; state.distance = distance; placeCamera(); },
  /** Freeze the orbiting point light at a given angle (for deterministic shots). */
  setLightAngle(a) { state.t = a / 0.6; },
  names: TEXTURE_NAMES,
  check() {
    const missing = TEXTURE_NAMES.filter((n) => !lib.has(n));
    const bad = [];
    for (const n of TEXTURE_NAMES) {
      const t = lib.get(n);
      const m = lib.meta(n);
      if (!t || !t.image || t.image.width !== m.px[0] || t.image.height !== m.px[1]) bad.push(n);
      if (t.colorSpace !== THREE.SRGBColorSpace || t.wrapS !== THREE.RepeatWrapping || t.magFilter !== THREE.NearestFilter) bad.push(`${n}:fmt`);
      const nm = lib.normal(n);
      if (nm && nm.colorSpace !== THREE.NoColorSpace) bad.push(`${n}:normal-cs`);
      const mat = lib.material(n);
      if (m.alpha && !(mat.alphaTest === 0.5 && mat.side === THREE.DoubleSide && mat.userData.alpha)) bad.push(`${n}:alpha`);
      const em = lib.emissive(n);
      if (em && (em.colorSpace !== THREE.SRGBColorSpace || mat.emissiveMap !== em)) bad.push(`${n}:emissive`);
      if (!!em !== m.emissive) bad.push(`${n}:emissive-flag`);
    }
    // material cache: same params → same material; different onBeforeCompile hooks / textures → different materials
    const hookA = (sh) => sh;
    const hookB = (sh) => { sh.defines = { LUMINATI_TEST: 1 }; };
    const keyed = lib.material('grass', { side: THREE.DoubleSide }) === lib.material('grass', { side: THREE.DoubleSide })
      && lib.material('leaves', { onBeforeCompile: hookA }) !== lib.material('leaves', { onBeforeCompile: hookB })
      && lib.material('plaster', { map: lib.get('brick') }) !== lib.material('plaster', { map: lib.get('stone_brick') })
      && lib.material('plaster', { map: lib.get('brick') }).map === lib.get('brick');
    return { count: TEXTURE_NAMES.length, list: lib.list().length, missing, bad, emissive: TEXTURE_NAMES.filter((n) => lib.emissive(n)), cached: lib.material('grass') === lib.material('grass'), keyed };
  },
};
