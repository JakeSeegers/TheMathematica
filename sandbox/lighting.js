/**
 * Sandbox for the lighting module: LightingSystem (day/night, sun/moon, shadows, fog, exposure,
 * point lights, emissives), Sky and GodRays — exercised with raw three.js and a small diorama.
 *
 * URL params: ?t=17.2 (start time) &speed=0 (hours/sec) &post=0 (disable bloom composer) &view=default
 * window.__lighting exposes handles for scripted checks (see bottom of file).
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { LightingSystem } from '../src/engine/lighting/LightingSystem.js';
import { GodRays } from '../src/engine/fx/GodRays.js';
import { globalUniforms } from '../src/engine/render/GlobalUniforms.js';
import { PixelCanvas, normalMapFromHeight, shadeColor } from '../src/engine/pixel/PixelCanvas.js';
import { PALETTE } from '../src/engine/pixel/Palette.js';
import { RNG, clamp, DEG2RAD, RAD2DEG, hash2 } from '../src/engine/utils/math.js';

const params = new URLSearchParams(location.search);
const START_TIME = Number(params.get('t') ?? 17.2);
const USE_POST = params.get('post') !== '0';

// ---------------------------------------------------------------------------
// Renderer / scene / camera (Engine stub)
// ---------------------------------------------------------------------------
const container = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = /** @type {THREE.Scene & { fog: THREE.FogExp2 }} */ (new THREE.Scene());
const camera = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 0.5, 400);

const engine = { renderer, scene, camera, events: null };

// ---------------------------------------------------------------------------
// Procedural pixel textures (sandbox-only stand-ins for TextureLibrary)
// ---------------------------------------------------------------------------
const texCache = [];
function tex(pc, { units = 1, srgb = true } = {}) {
  const t = pc.toTexture({ wrap: 'repeat', mipmaps: true, srgb, anisotropy: 4 });
  t.repeat.set(1 / units, 1 / units);
  texCache.push(t);
  return t;
}

function grassTexture() {
  const pc = new PixelCanvas(32, 32);
  pc.wrap = true;
  const g = PALETTE.grass;
  pc.fillNoise([g[1], g[2], g[3], g[3], g[4]], { scale: 4, period: 4, seed: 11, octaves: 3, dither: 0.8 });
  const rng = new RNG(5);
  for (let i = 0; i < 90; i++) {
    const x = rng.int(0, 31);
    const y = rng.int(0, 31);
    const light = rng.chance(0.55);
    pc.set(x, y, light ? g[4] : g[1]);
    pc.set(x + (rng.chance(0.5) ? 1 : 0), y - 1, light ? g[5] : g[2]);
  }
  for (let i = 0; i < 6; i++) {
    const x = rng.int(0, 31);
    const y = rng.int(0, 31);
    pc.set(x, y, rng.pick(['#f2d45a', '#f6f0e0', '#e0674f', '#a9c7ee']));
  }
  return pc;
}

function dirtTexture() {
  const pc = new PixelCanvas(16, 16);
  pc.wrap = true;
  const d = PALETTE.dirt;
  pc.fillNoise([d[0], d[1], d[2], d[2], d[3]], { scale: 2, period: 2, seed: 3, octaves: 3, dither: 0.8 });
  const rng = new RNG(8);
  for (let y = 3; y < 16; y += 5) for (let x = 0; x < 16; x++) if (rng.chance(0.7)) pc.set(x, y, d[1]);
  for (let i = 0; i < 10; i++) pc.set(rng.int(0, 15), rng.int(0, 15), PALETTE.stoneWarm[3]);
  return pc;
}

/** Voronoi cobblestones: returns { color, normal } PixelCanvas pair. 32 px = 2 units. */
function cobbleTextures() {
  const W = 32;
  const G = 4;
  const cs = W / G;
  const rng = new RNG(21);
  const pts = [];
  for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
    pts.push({ x: (gx + rng.range(0.25, 0.75)) * cs, y: (gy + rng.range(0.25, 0.75)) * cs, tone: rng.int(0, 2) });
  }
  const height = new Float32Array(W * W);
  const color = new PixelCanvas(W, W);
  const ramp = PALETTE.stoneWarm;
  const wrapD = (a) => (a > W / 2 ? a - W : a < -W / 2 ? a + W : a);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    let d1 = 1e9, d2 = 1e9, best = null, bdx = 0, bdy = 0;
    for (const p of pts) {
      const dx = wrapD(x + 0.5 - p.x);
      const dy = wrapD(y + 0.5 - p.y);
      const dd = Math.hypot(dx, dy);
      if (dd < d1) { d2 = d1; d1 = dd; best = p; bdx = dx; bdy = dy; } else if (dd < d2) d2 = dd;
    }
    const edge = d2 - d1;
    const h = edge < 1.1 ? 0 : Math.min(1, Math.sqrt((edge - 1.1) / 3.2));
    height[y * W + x] = h;
    if (edge < 1.1) { color.set(x, y, hash2(x, y, 4) < 0.25 ? PALETTE.moss[1] : ramp[1]); continue; }
    const lightSide = -(bdx + bdy) / (Math.hypot(bdx, bdy) + 1e-3);
    let idx = 2 + best.tone * 0.5 + (edge < 2.1 ? (lightSide > 0.2 ? 1 : -0.6) : 0.4);
    if (hash2(x, y, 9) < 0.08) idx -= 1;
    color.set(x, y, ramp[clamp(Math.round(idx), 1, 5)]);
  }
  const normal = normalMapFromHeight(W, W, (x, y) => height[y * W + x], { strength: 2.2 });
  return { color, normal };
}

/** Half-timbered plaster, 32 px = 2 units. */
function timberTexture() {
  const pc = new PixelCanvas(32, 32);
  pc.wrap = true;
  const p = PALETTE.plaster;
  pc.fillNoise([p[2], p[3], p[3], p[4]], { scale: 4, period: 4, seed: 31, octaves: 2, dither: 0.9 });
  const w = PALETTE.wood;
  const beam = (x0, y0, x1, y1) => pc.line(x0, y0, x1, y1, w[1]);
  for (let y = 0; y < 32; y++) { pc.set(0, y, w[1]); pc.set(1, y, w[2]); pc.set(16, y, w[1]); pc.set(17, y, w[2]); }
  for (let x = 0; x < 32; x++) { pc.set(x, 0, w[1]); pc.set(x, 1, w[2]); pc.set(x, 15, w[1]); pc.set(x, 16, w[2]); }
  beam(2, 30, 15, 17); beam(2, 31, 15, 18);
  beam(18, 17, 31, 30); beam(18, 18, 31, 31);
  const rng = new RNG(2);
  for (let i = 0; i < 12; i++) pc.set(rng.int(3, 30), rng.int(3, 30), p[1]);
  return pc;
}

/** Roof tiles: 16 px = 1 unit. Canvas top = toward the ridge. Returns { color, normal }. */
function roofTextures(ramp) {
  const W = 16;
  const color = new PixelCanvas(W, W);
  const height = new Float32Array(W * W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const row = Math.floor(y / 4);
    const r = y % 4;
    const off = (row % 2) * 2;
    const sep = (x + off) % 4 === 0;
    let idx = [1, 2, 3, 4][r];
    if (sep && r < 3) idx = Math.max(0, idx - 2);
    if (hash2(x, y, 12) < 0.07) idx = Math.max(1, idx - 1);
    color.set(x, y, ramp[clamp(idx, 0, ramp.length - 1)]);
    height[y * W + x] = sep ? 0.2 : r / 3;
  }
  const normal = normalMapFromHeight(W, W, (x, y) => height[y * W + x], { strength: 1.6 });
  return { color, normal };
}

function stoneBrickTextures() {
  const W = 16;
  const color = new PixelCanvas(W, W);
  const height = new Float32Array(W * W);
  const ramp = PALETTE.stone;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const row = Math.floor(y / 4);
    const off = (row % 2) * 4;
    const mortar = y % 4 === 3 || (x + off) % 8 === 7;
    const bid = Math.floor((x + off) / 8) + row * 3;
    let idx = 3 + (hash2(bid, 0, 5) < 0.4 ? -1 : 0) + (y % 4 === 0 ? 1 : 0);
    if (hash2(x, y, 7) < 0.1) idx -= 1;
    color.set(x, y, mortar ? ramp[1] : ramp[clamp(idx, 2, 5)]);
    height[y * W + x] = mortar ? 0 : 1;
  }
  const normal = normalMapFromHeight(W, W, (x, y) => height[y * W + x], { strength: 1.2 });
  return { color, normal };
}

function woodTexture(ramp = PALETTE.wood) {
  const pc = new PixelCanvas(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const plank = Math.floor(x / 4);
    const edge = x % 4 === 0;
    let idx = 2 + (hash2(plank, 0, 3) < 0.5 ? 1 : 0);
    if (hash2(x, Math.floor(y / 3), plank + 5) < 0.15) idx -= 1;
    pc.set(x, y, edge ? ramp[0] : ramp[clamp(idx, 1, ramp.length - 1)]);
  }
  return pc;
}

function leavesTexture() {
  const pc = new PixelCanvas(16, 16);
  pc.wrap = true;
  const l = PALETTE.leaves;
  pc.fillNoise([l[1], l[2], l[3], l[4]], { scale: 3, period: 3, seed: 44, octaves: 2, dither: 1.0 });
  const rng = new RNG(4);
  for (let i = 0; i < 14; i++) { const x = rng.int(0, 15); const y = rng.int(0, 15); pc.set(x, y, l[5]); pc.set(x + 1, y, l[4]); }
  for (let i = 0; i < 10; i++) pc.set(rng.int(0, 15), rng.int(0, 15), l[0]);
  return pc;
}

function barkTexture() {
  const pc = new PixelCanvas(16, 16);
  const b = PALETTE.bark;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = hash2(x, Math.floor(y / 4), 2);
    pc.set(x, y, x % 3 === 0 ? b[0] : v < 0.5 ? b[2] : b[3]);
  }
  return pc;
}

/** 16x16 window: dark frame, 4 panes. Returns { color, emissive }. */
function windowTextures() {
  const color = new PixelCanvas(16, 16);
  const emissive = new PixelCanvas(16, 16, '#000000');
  const w = PALETTE.wood;
  color.fill(w[1]);
  color.strokeRect(0, 0, 16, 16, w[0]);
  for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) {
    if (x === 7 || x === 8 || y === 7 || y === 8) { color.set(x, y, w[2]); continue; }
    const g = y < 5 ? '#4a6488' : '#34496a';
    color.set(x, y, (x + y) % 7 === 0 ? '#7f9cc0' : g);
    emissive.set(x, y, y < 5 ? '#ffe2a8' : '#ffc070');
  }
  return { color, emissive };
}

/** Upright stand-in sprite (16x32 px): a little cloaked traveler. */
function figureTexture({ cloak, hair, skin = PALETTE.skinLight, pants = PALETTE.brown, seed = 1 }) {
  const pc = new PixelCanvas(16, 32);
  // legs
  pc.rect(5, 26, 2, 5, pants[1]); pc.rect(9, 26, 2, 5, pants[1]);
  pc.rect(5, 30, 2, 1, PALETTE.black[1]); pc.rect(9, 30, 2, 1, PALETTE.black[1]);
  // cloak body (trapezoid)
  pc.polygon([[4, 13], [12, 13], [14, 27], [2, 27]], cloak[2]);
  pc.polygon([[8, 13], [12, 13], [14, 27], [9, 27]], cloak[3]);
  pc.vline(8, 15, 26, cloak[1]);
  pc.hline(3, 13, 26, cloak[1]);
  // arms / hands
  pc.rect(2, 18, 2, 5, cloak[1]); pc.rect(12, 18, 2, 5, cloak[3]);
  pc.set(2, 23, skin[3]); pc.set(13, 23, skin[3]);
  // head
  pc.ellipse(8, 8, 4, 4.5, skin[3]);
  pc.rect(6, 9, 1, 2, PALETTE.black[1]); pc.rect(10, 9, 1, 2, PALETTE.black[1]);
  pc.hline(6, 11, 12, skin[2]);
  // hair
  pc.ellipse(8, 5, 4.5, 3, hair[2]);
  pc.rect(3, 5, 2, 6, hair[1]); pc.rect(12, 5, 2, 5, hair[2]);
  pc.hline(6, 10, 3, hair[3]);
  // belt
  pc.hline(4, 12, 20, PALETTE.brown[1]);
  pc.set(8, 20, PALETTE.gold[4]);
  pc.outline(PALETTE.outline);
  const rng = new RNG(seed);
  if (rng.chance(0.5)) pc.set(rng.int(5, 11), rng.int(15, 24), cloak[4]);
  return pc;
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
const cob = cobbleTextures();
const roofR = roofTextures(PALETTE.roofRed);
const roofB = roofTextures(PALETTE.roofBlue);
const sbrick = stoneBrickTextures();
const win = windowTextures();

const mats = {
  grass: new THREE.MeshLambertMaterial({ map: tex(grassTexture(), { units: 2 }) }),
  dirt: new THREE.MeshLambertMaterial({ map: tex(dirtTexture()) }),
  cobble: new THREE.MeshLambertMaterial({
    map: tex(cob.color, { units: 2 }), normalMap: tex(cob.normal, { units: 2, srgb: false }),
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
  }),
  timber: new THREE.MeshLambertMaterial({ map: tex(timberTexture(), { units: 2 }) }),
  roofRed: new THREE.MeshLambertMaterial({ map: tex(roofR.color), normalMap: tex(roofR.normal, { srgb: false }), side: THREE.DoubleSide }),
  roofBlue: new THREE.MeshLambertMaterial({ map: tex(roofB.color), normalMap: tex(roofB.normal, { srgb: false }), side: THREE.DoubleSide }),
  stone: new THREE.MeshLambertMaterial({ map: tex(sbrick.color), normalMap: tex(sbrick.normal, { srgb: false }) }),
  wood: new THREE.MeshLambertMaterial({ map: tex(woodTexture()) }),
  woodDark: new THREE.MeshLambertMaterial({ map: tex(woodTexture(PALETTE.woodGray)) }),
  leaves: new THREE.MeshLambertMaterial({ map: tex(leavesTexture()), flatShading: true }),
  bark: new THREE.MeshLambertMaterial({ map: tex(barkTexture()) }),
  iron: new THREE.MeshLambertMaterial({ color: '#2a2a34' }),
  water: new THREE.MeshStandardMaterial({
    color: '#2a6680', roughness: 0.42, metalness: 0.0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  }),
};
const windowMatTemplate = {
  map: tex(win.color), emissiveMap: tex(win.emissive), emissive: new THREE.Color('#ffb05a'), emissiveIntensity: 0,
  polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
};

// ---------------------------------------------------------------------------
// Geometry helpers (world-space UVs: 1 unit = 1 uv unit; texture.repeat does the rest)
// ---------------------------------------------------------------------------
function worldUVBox(geo, w, h, d) {
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
  }
  return geo;
}

function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(worldUVBox(new THREE.BoxGeometry(w, h, d), w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Gable roof with ridge along X. Groups: 0 = slopes (roof), 1 = gables (wall). */
function gableRoofGeometry(w, d, rh, overhang = 0.35) {
  const W = w / 2 + overhang;
  const D = d / 2 + overhang;
  const slope = Math.hypot(D, rh);
  const pos = [];
  const uv = [];
  const norm = [];
  const quad = (a, b, c, e, uvs, n) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...e);
    uv.push(...uvs[0], ...uvs[1], ...uvs[2], ...uvs[0], ...uvs[2], ...uvs[3]);
    for (let i = 0; i < 6; i++) norm.push(...n);
  };
  const nf = new THREE.Vector3(0, D, rh).normalize();
  // front slope (+Z)
  quad([-W, 0, D], [W, 0, D], [W, rh, 0], [-W, rh, 0], [[-W, 0], [W, 0], [W, slope], [-W, slope]], [nf.x, nf.y, nf.z]);
  // back slope (-Z)
  quad([W, 0, -D], [-W, 0, -D], [-W, rh, 0], [W, rh, 0], [[-W, 0], [W, 0], [W, slope], [-W, slope]], [0, nf.y, -nf.z]);
  const slopeCount = pos.length / 3;
  // gables (inset to the wall plane)
  const gw = w / 2;
  const gd = d / 2;
  const gh = rh * (gd / D);
  const tri = (a, b, c, uvs, n) => {
    pos.push(...a, ...b, ...c);
    uv.push(...uvs[0], ...uvs[1], ...uvs[2]);
    for (let i = 0; i < 3; i++) norm.push(...n);
  };
  tri([gw, 0, gd], [gw, 0, -gd], [gw, gh, 0], [[gd, 0], [-gd, 0], [0, gh]], [1, 0, 0]);
  tri([-gw, 0, -gd], [-gw, 0, gd], [-gw, gh, 0], [[-gd, 0], [gd, 0], [0, gh]], [-1, 0, 0]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.addGroup(0, slopeCount, 0);
  g.addGroup(slopeCount, pos.length / 3 - slopeCount, 1);
  return g;
}

// ---------------------------------------------------------------------------
// Lighting + sky + god rays (the module under test)
// ---------------------------------------------------------------------------
const lighting = new LightingSystem(engine, { timeOfDay: START_TIME, timeSpeed: Number(params.get('speed') ?? 0) });
const godRays = new GodRays();
scene.add(godRays.object);

// ---------------------------------------------------------------------------
// Diorama
// ---------------------------------------------------------------------------
const world = new THREE.Group();
scene.add(world);

// Ground slab (floating chunk)
{
  const S = 36;
  const H = 3;
  const g = worldUVBox(new THREE.BoxGeometry(S, H, S), S, H, S);
  const ground = new THREE.Mesh(g, [mats.dirt, mats.dirt, mats.grass, mats.dirt, mats.dirt, mats.dirt]);
  ground.position.y = -H / 2;
  ground.receiveShadow = true;
  ground.castShadow = true;
  world.add(ground);
}

function plane(w, d, material, x, y, z) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w + x - w / 2, uv.getY(i) * d - z - d / 2);
  const m = new THREE.Mesh(g, material);
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}
world.add(plane(15, 9, mats.cobble, 0, 0.002, 0.5));
world.add(plane(3, 12.5, mats.cobble, 0, 0.002, 11.25));

// Houses
const emissiveWindows = [];
function house(x, z, { w = 5, d = 4, h = 3, roof = mats.roofRed, ridge = 'x', rh = 1.8, chimney = false, windows = 2 } = {}) {
  const grp = new THREE.Group();
  grp.position.set(x, 0, z);
  grp.add(box(w, h, d, mats.timber, 0, h / 2, 0));
  // stone plinth
  grp.add(box(w + 0.12, 0.45, d + 0.12, mats.stone, 0, 0.225, 0));
  const rw = ridge === 'x' ? w : d;
  const rd = ridge === 'x' ? d : w;
  const roofMesh = new THREE.Mesh(gableRoofGeometry(rw, rd, rh), [roof, mats.timber]);
  roofMesh.position.y = h;
  if (ridge === 'z') roofMesh.rotation.y = Math.PI / 2;
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  grp.add(roofMesh);
  // door (front, +Z)
  const door = new THREE.Mesh(worldUVBox(new THREE.BoxGeometry(1, 1.8, 0.08), 1, 1.8, 0.08), mats.woodDark);
  door.position.set(-w * 0.18, 0.9 + 0.02, d / 2 + 0.02);
  door.castShadow = true;
  grp.add(door);
  // windows (front and one side)
  const winMat = new THREE.MeshLambertMaterial({ ...windowMatTemplate });
  emissiveWindows.push(winMat);
  const wg = new THREE.PlaneGeometry(0.9, 0.9);
  const x0 = -w * 0.18 + 1.2;
  const x1 = w / 2 - 0.75;
  for (let i = 0; i < windows; i++) {
    const m = new THREE.Mesh(wg, winMat);
    m.position.set(windows === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (windows - 1), h * 0.55, d / 2 + 0.011);
    grp.add(m);
  }
  const side = new THREE.Mesh(wg, winMat);
  side.position.set(w / 2 + 0.011, h * 0.55, 0);
  side.rotation.y = Math.PI / 2;
  grp.add(side);
  const side2 = new THREE.Mesh(wg, winMat);
  side2.position.set(-w / 2 - 0.011, h * 0.55, 0);
  side2.rotation.y = -Math.PI / 2;
  grp.add(side2);
  if (chimney) grp.add(box(0.7, 1.8, 0.7, mats.stone, w * 0.28, h + 1.2, -d * 0.15));
  world.add(grp);
  return grp;
}
house(-7.2, -8.2, { w: 5, d: 4, h: 3, roof: mats.roofRed, chimney: true });
house(0.6, -9.2, { w: 6, d: 4.4, h: 3.6, roof: mats.roofBlue, rh: 2.1, windows: 3 });
house(8.2, -7.6, { w: 4.4, d: 4.2, h: 3, roof: mats.roofRed, ridge: 'z', rh: 1.7 });
house(-12.6, 1.5, { w: 4, d: 5, h: 2.8, roof: mats.roofBlue, ridge: 'z', rh: 1.6 });
house(12.4, 3.2, { w: 4.2, d: 4.4, h: 2.8, roof: mats.roofRed, chimney: true, windows: 1 });

// Pillars
for (const [x, z, h] of [[-6.8, -3.6, 3.4], [6.8, -3.6, 3.4], [-6.8, 4.6, 1.6], [6.8, 4.6, 1.6]]) {
  world.add(box(0.7, h, 0.7, mats.stone, x, h / 2, z));
  world.add(box(0.95, 0.25, 0.95, mats.stone, x, h + 0.125, z));
}

// Trees
function tree(x, z, s = 1) {
  const grp = new THREE.Group();
  grp.position.set(x, 0, z);
  grp.add(box(0.4 * s, 2.4 * s, 0.4 * s, mats.bark, 0, 1.2 * s, 0));
  const rng = new RNG(Math.floor(x * 13 + z * 7));
  for (let i = 0; i < 4; i++) {
    const r = rng.range(1.0, 1.5) * s;
    const g = new THREE.IcosahedronGeometry(r, 0);
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 6, uv.getY(k) * 3);
    const m = new THREE.Mesh(g, mats.leaves);
    m.position.set(rng.range(-0.8, 0.8) * s, (2.6 + rng.range(0, 1.4)) * s, rng.range(-0.7, 0.7) * s);
    m.rotation.set(rng.range(0, 3), rng.range(0, 3), rng.range(0, 3));
    m.castShadow = true;
    m.receiveShadow = true;
    grp.add(m);
  }
  world.add(grp);
}
tree(-13.2, -9.5, 1.15); tree(-10.2, -13.5, 1.0); tree(13.8, -11.5, 1.2); tree(14.5, 10.5, 1.0); tree(-14.2, 11.5, 1.1); tree(-4.2, -13.8, 0.9);

// Pond
{
  const g = new THREE.CircleGeometry(2.6, 28);
  g.rotateX(-Math.PI / 2);
  const pond = new THREE.Mesh(g, mats.water);
  pond.position.set(7.2, 0.01, 9.2);
  pond.receiveShadow = true;
  world.add(pond);
  const rng = new RNG(99);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rng.range(-0.1, 0.1);
    const r = rng.range(0.25, 0.45);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mats.stone);
    rock.position.set(7.2 + Math.cos(a) * 2.75, r * 0.4, 9.2 + Math.sin(a) * 2.75);
    rock.rotation.set(rng.range(0, 3), rng.range(0, 3), 0);
    rock.castShadow = true;
    rock.receiveShadow = true;
    world.add(rock);
  }
}

// Stand-in sprites (upright alpha-tested quads, cast shadows)
const sprites = [];
const figureSpecs = [
  { x: 0.2, z: 1.0, cloak: PALETTE.red, hair: PALETTE.hairBrown },
  { x: -2.4, z: -0.8, cloak: PALETTE.blue, hair: PALETTE.hairBlonde },
  { x: 2.8, z: 2.2, cloak: PALETTE.green, hair: PALETTE.hairBlack },
  { x: -3.4, z: 3.4, cloak: PALETTE.purple, hair: PALETTE.hairRed },
  { x: 5.2, z: 7.6, cloak: PALETTE.cream, hair: PALETTE.hairWhite },
];
figureSpecs.forEach((s, i) => {
  const t = figureTexture({ ...s, seed: i + 1 }).toTexture({ wrap: 'clamp', mipmaps: false });
  texCache.push(t);
  const m = new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide });
  const g = new THREE.PlaneGeometry(1, 2);
  g.translate(0, 1, 0);
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(s.x, 0, s.z);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  world.add(mesh);
  sprites.push(mesh);
});

// Lanterns: post + arm + glowing lantern registered as emissive + flickering point light
const lanterns = [];
function lantern(x, z, facing = 1) {
  const grp = new THREE.Group();
  grp.position.set(x, 0, z);
  grp.add(box(0.14, 2.5, 0.14, mats.iron, 0, 1.25, 0));
  grp.add(box(0.2, 0.3, 0.2, mats.iron, 0, 0.15, 0));
  grp.add(box(0.55, 0.07, 0.07, mats.iron, 0.25 * facing, 2.42, 0));
  const glass = new THREE.MeshLambertMaterial({ color: '#f6d9a0', emissive: new THREE.Color('#ffaa4c'), emissiveIntensity: 0 });
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.24), glass);
  lamp.position.set(0.48 * facing, 2.15, 0);
  lamp.castShadow = false;
  grp.add(lamp);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.16, 4), mats.iron);
  cap.position.set(0.48 * facing, 2.39, 0);
  cap.rotation.y = Math.PI / 4;
  grp.add(cap);
  world.add(grp);
  const light = lighting.addPointLight({
    position: new THREE.Vector3(x + 0.48 * facing, 2.0, z),
    intensity: 14, distance: 10, flicker: 0.3,
  });
  const emissive = lighting.registerEmissive(glass, { day: 0.15, night: 3.2, flicker: light });
  lanterns.push({ grp, light, emissive });
}
lantern(-4.6, -3.0, 1);
lantern(4.6, -3.0, -1);
lantern(-4.6, 4.4, 1);
lantern(4.6, 4.4, -1);
lantern(1.9, 11.0, -1);
emissiveWindows.forEach((m) => lighting.registerEmissive(m, { day: 0, night: 1.5 }));

// God rays over the village
const shafts = godRays.populate({ minX: -12, maxX: 12, minZ: -11, maxZ: 7, y: 0 }, 6, 7);

// ---------------------------------------------------------------------------
// Camera views (diorama rig stand-in)
// ---------------------------------------------------------------------------
const view = { focus: new THREE.Vector3(0, 0.6, 1), yaw: 0, pitch: 32 * DEG2RAD, distance: 24 };
function applyView() {
  if (view.override) {
    camera.position.copy(view.override.eye);
    camera.lookAt(view.override.target);
    camera.updateMatrixWorld();
    globalUniforms.uCameraPosition.value.copy(camera.position);
    return;
  }
  const { focus, yaw, pitch, distance } = view;
  camera.position.set(
    focus.x + Math.sin(yaw) * Math.cos(pitch) * distance,
    focus.y + Math.sin(pitch) * distance,
    focus.z + Math.cos(yaw) * Math.cos(pitch) * distance,
  );
  camera.lookAt(focus);
  camera.updateMatrixWorld();
  globalUniforms.uCameraYaw.value = yaw;
  globalUniforms.uCameraPosition.value.copy(camera.position);
}
const VIEWS = {
  default: () => Object.assign(view, { focus: new THREE.Vector3(0, 0.6, 1), yaw: 0, pitch: 32 * DEG2RAD, distance: 24 }),
  far: () => Object.assign(view, { focus: new THREE.Vector3(0, 0.6, 1), yaw: 0.5, pitch: 32 * DEG2RAD, distance: 36 }),
  wide: () => Object.assign(view, { focus: new THREE.Vector3(0, 0, 0), yaw: 0, pitch: 28 * DEG2RAD, distance: 62 }),
  low: () => Object.assign(view, { focus: new THREE.Vector3(0, 1.5, -2), yaw: 0.35, pitch: 12 * DEG2RAD, distance: 34 }),
  /** Look toward a body (sun/moon) from inside the village, slightly upward. */
  sky: (body = 'sun') => {
    const d = body === 'moon' ? lighting.moonDirection : lighting.trueSunDirection;
    const az = Math.atan2(d.x, d.z);
    const el = Math.asin(clamp(d.y, -1, 1));
    // Stand in the village and look up toward the body (keep it in the upper part of the frame).
    const lookEl = clamp(el - 8 * DEG2RAD, 3 * DEG2RAD, 45 * DEG2RAD);
    const eye = new THREE.Vector3(-Math.sin(az) * 9, 1.8, -Math.cos(az) * 9 + 2);
    const target = eye.clone().add(new THREE.Vector3(Math.sin(az) * Math.cos(lookEl), Math.sin(lookEl), Math.cos(az) * Math.cos(lookEl)));
    view.override = { eye, target };
  },
  close: () => Object.assign(view, { focus: new THREE.Vector3(-1, 1, 0.5), yaw: -0.3, pitch: 26 * DEG2RAD, distance: 13 }),
};
const initialView = params.get('view') ?? 'default';
(VIEWS[initialView] ?? VIEWS.default)();
applyView();

// ---------------------------------------------------------------------------
// Post (bloom + output) — mimics the engine's PostFX tone-mapping chain
// ---------------------------------------------------------------------------
let composer = null;
let bloom = null;
if (USE_POST) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.55, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (composer) composer.setSize(w, h);
}
window.addEventListener('resize', onResize);

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
const hud = document.getElementById('hud');
let last = performance.now();
let frames = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;
  globalUniforms.uTime.value += dt;
  applyView();
  lighting.update(dt);
  lighting.lateUpdate(); // what Engine does after the camera rig; harmless when called manually
  godRays.update(dt);
  if (composer) composer.render(dt);
  else renderer.render(scene, camera);
  frames++;
  if (frames % 6 === 0) updateHud();
  requestAnimationFrame(frame);
}

function updateHud() {
  const t = lighting.timeOfDay;
  const hh = String(Math.floor(t)).padStart(2, '0');
  const mm = String(Math.floor((t % 1) * 60)).padStart(2, '0');
  const st = lighting.state;
  hud.textContent = `${hh}:${mm}  ${lighting.phaseName}\n` +
    `night ${st.night.toFixed(2)}  sun el ${(st.sunElevation * RAD2DEG).toFixed(1)}°  light el ${(st.lightElevation * RAD2DEG).toFixed(1)}°\n` +
    `exp ${renderer.toneMappingExposure.toFixed(2)}  fog ${scene.fog.density.toFixed(4)}  sunI ${lighting.sun.intensity.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Scripted-check handles
// ---------------------------------------------------------------------------
/**
 * Sample every output of the lighting system over 24h and report the largest step-to-step jump.
 * @param {number} [step]  hours between samples (0.01)
 */
function sweep(step = 0.01) {
  const saved = lighting.timeOfDay;
  const groups = {};
  const snap = () => {
    const s = lighting.sun;
    const h = lighting.hemi;
    const f = scene.fog;
    const u = lighting.sky.uniforms;
    const dir = lighting.sunDirection;
    return {
      sunRadiance: [s.color.r * s.intensity, s.color.g * s.intensity, s.color.b * s.intensity],
      hemiSky: [h.color.r * h.intensity, h.color.g * h.intensity, h.color.b * h.intensity],
      hemiGround: [h.groundColor.r * h.intensity, h.groundColor.g * h.intensity, h.groundColor.b * h.intensity],
      fogColor: [f.color.r, f.color.g, f.color.b],
      fogDensity: [f.density * 50],
      exposure: [renderer.toneMappingExposure],
      night: [lighting.nightFactor],
      lightDirDeg: [dir.x, dir.y, dir.z],
      skyTop: [u.uTop.value.r, u.uTop.value.g, u.uTop.value.b],
      shadowIntensity: [lighting.sun.shadow.intensity],
    };
  };
  let prev = null;
  const n = Math.round(24 / step);
  for (let i = 0; i <= n; i++) {
    const t = (i * step) % 24;
    lighting.setTime(t);
    const cur = snap();
    if (prev) {
      for (const k of Object.keys(cur)) {
        let d = 0;
        if (k === 'lightDirDeg') {
          const dot = clamp(cur[k][0] * prev[k][0] + cur[k][1] * prev[k][1] + cur[k][2] * prev[k][2], -1, 1);
          d = Math.acos(dot) * RAD2DEG;
        } else {
          for (let c = 0; c < cur[k].length; c++) d = Math.max(d, Math.abs(cur[k][c] - prev[k][c]));
        }
        const g = (groups[k] ??= { max: 0, at: 0, sum: 0, n: 0 });
        g.sum += d; g.n++;
        if (d > g.max) { g.max = d; g.at = +t.toFixed(3); }
      }
    }
    prev = cur;
  }
  lighting.setTime(saved);
  const out = {};
  for (const [k, g] of Object.entries(groups)) out[k] = { maxStep: +g.max.toFixed(5), at: g.at, meanStep: +(g.sum / g.n).toFixed(5), ratio: +(g.max / (g.sum / g.n + 1e-9)).toFixed(1) };
  return out;
}

/** Shadow camera centre in light space, modulo the texel size (should be ~0 → snapped). */
function snapCheck() {
  const sh = lighting.sun.shadow;
  const L = lighting.sunDirection;
  const up = sh.camera.up;
  const right = new THREE.Vector3().crossVectors(up, L).normalize();
  const upv = new THREE.Vector3().crossVectors(L, right);
  const texel = (2 * lighting.shadowExtent) / lighting.shadowMapSize;
  const p = lighting.sun.position;
  const fx = p.dot(right) / texel;
  const fy = p.dot(upv) / texel;
  return { texel, errX: +(fx - Math.round(fx)).toExponential(2), errY: +(fy - Math.round(fy)).toExponential(2) };
}

/**
 * `window.__lighting` (AUTOMATION_API.md §7). The scene fog is the LightingSystem's FogExp2.
 * @typedef {object} LightingHandle
 * @property {typeof THREE} THREE
 * @property {LightingSystem} lighting
 * @property {GodRays} godRays
 * @property {LightingSystem['sky']} sky
 * @property {THREE.Scene} scene
 * @property {THREE.PerspectiveCamera} camera
 * @property {THREE.WebGLRenderer} renderer
 * @property {typeof shafts} shafts  the god-ray shafts over the village
 * @property {typeof lanterns} lanterns  `{ grp, light, emissive }` per lantern
 * @property {typeof sprites} sprites  the stand-in figure quads
 * @property {UnrealBloomPass|null} bloom  (getter) null with `?post=0`
 * @property {(h: number) => number} setTime  returns the time of day
 * @property {(s: number) => number} setSpeed  clock speed in hours per second
 * @property {(name: string, arg?: string) => string} setView  a camera view: 'default', 'far',
 *   'wide', 'low', 'close', or 'sky' with 'sun' / 'moon'
 * @property {(dx: number, dz: number) => number[]} moveFocus  returns the focus [x, z]
 * @property {typeof sweep} sweep
 * @property {typeof snapCheck} snapCheck
 * @property {() => number} programs  compiled shader programs
 * @property {() => object} info  time, night, sun / light elevation, light direction, sun
 *   intensity, exposure, fog density, draw calls, programs, point-light intensities
 */
window.__lighting = {
  THREE, lighting, godRays, sky: lighting.sky, scene, camera, renderer, shafts, lanterns, sprites,
  get bloom() { return bloom; },
  setTime(h) { lighting.setTime(h); updateHud(); return lighting.timeOfDay; },
  setSpeed(s) { lighting.timeSpeed = s; return s; },
  setView(name, arg) { view.override = null; (VIEWS[name] ?? VIEWS.default)(arg); applyView(); return name; },
  moveFocus(dx, dz) { view.focus.x += dx; view.focus.z += dz; applyView(); return [view.focus.x, view.focus.z]; },
  sweep,
  snapCheck,
  programs: () => renderer.info.programs.length,
  info: () => ({
    time: +lighting.timeOfDay.toFixed(3),
    night: +lighting.nightFactor.toFixed(3),
    sunElevationDeg: +(lighting.state.sunElevation * RAD2DEG).toFixed(2),
    lightElevationDeg: +(lighting.state.lightElevation * RAD2DEG).toFixed(2),
    lightDir: lighting.sunDirection.toArray().map((v) => +v.toFixed(3)),
    sunIntensity: +lighting.sun.intensity.toFixed(3),
    exposure: +renderer.toneMappingExposure.toFixed(3),
    fog: +scene.fog.density.toFixed(5),
    calls: renderer.info.render.calls,
    programs: renderer.info.programs.length,
    pointLights: lanterns.map((l) => +l.light.light.intensity.toFixed(2)),
  }),
};

requestAnimationFrame(frame);
console.log('lighting sandbox ready');
