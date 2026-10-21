/**
 * Terrain & water sandbox — exercises TileMap, Water and createWaterfall standalone with raw
 * three.js (diorama camera: fov 28, pitch 32°, distance ~24).
 *
 * URL params: ?view=overview|diorama|cliffs|waterfall|edge|pond|terrace|fringe|lip
 *   &time=day|golden|night
 * window.__terrain exposes { THREE, renderer, scene, camera, map, tileMap, water, fall, lib,
 *   setView(name), setTime(name), setCamera({focus, yaw, pitch, distance}), runTests(), stats() }.
 */
import * as THREE from 'three';
import { TextureLibrary } from '../src/engine/pixel/Textures.js';
import { TileMap } from '../src/engine/world/TileMap.js';
import { Water, createWaterfall } from '../src/engine/world/Water.js';
import { globalUniforms } from '../src/engine/render/GlobalUniforms.js';
import { DEG2RAD } from '../src/engine/utils/math.js';

/**
 * @import { TileMapInput } from '../src/engine/world/TileMap.js'
 * @import { SceneNode } from '../src/engine/render/types.js'
 */

// ---------------------------------------------------------------------------
// Hand-made map: plateau with grassy cliffs, a river falling from it, a cobblestone plaza,
// dirt paths, two staircases (stone, cut into the cliff; wooden, up to a terrace), a pond with
// sand shore, void corners outside the diorama edge.
// ---------------------------------------------------------------------------

/** @type {TileMapInput} */
const MAP = {
  name: 'Sandbox Vale',
  legend: {
    g: { top: 'grass', side: 'cliff', lip: 'grass_side', walkable: true },
    G: { top: 'grass_dark', side: 'cliff', lip: 'grass_side', walkable: true },
    f: { top: 'grass_flowers', side: 'cliff', lip: 'grass_side', walkable: true },
    '.': { top: 'dirt_path', side: 'dirt_side', walkable: true },
    d: { top: 'dirt', side: 'dirt_side', walkable: true },
    c: { top: 'cobblestone', side: 'stone_wall', walkable: true },
    T: { top: 'stone_tiles', side: 'stone_wall', walkable: true },
    s: { top: 'sand', side: 'dirt_side', walkable: true },
    m: { top: 'moss_stone', side: 'cliff', walkable: true },
    F: { top: 'farmland', side: 'dirt_side', walkable: true },
    '~': { top: 'riverbed', side: 'cliff', water: true, walkable: false },
    o: { top: 'riverbed', side: 'cliff', water: true, walkable: false, flow: 0 },
    '^': { top: 'cobblestone', side: 'stone_wall', riser: 'stone_wall', stairs: 'N', walkable: true },
    '>': { top: 'wood_deck', side: 'wood_planks_dark', riser: 'wood_planks_dark', stairs: 'E', walkable: true },
    ' ': { void: true },
  },
  tiles: [
    'GGGgg~~gggfffgggggggggGG    ',
    'GGggm~~mggffggggggFFFFgGG   ',
    'Ggggm~~mgggffgggggFFFFggGGgg',
    'ggGgm~~m....TTTT..FFFFgggGGg',
    'ggggg~~mgffgg^^gggggggGgggGg',
    'Ggggm~~mgfgGg^^ggfggggGGgggg',
    'gggmm~~mmgggg^^ggggggggggGGg',
    'gGgg~~~~sgccccccccgggggggGgg',
    'Gggs~~~~sgccccccccggffggfggg',
    'ggggs~~sggcccccccc..>>gggggG',
    '.....~~...cccccccc..>>ggfggg',
    '.....~~...ccccccccgggggGgggg',
    'gGggs~~sgfccccccccgfgggGggdd',
    'Gggfs~~sgggfg..gggssssssggdg',
    'gggfs~~sggfgg..gggsooooosggg',
    'ggGggs~~sgggg..gfgsooooosgGg',
    'gggggs~~sgGgg..ggfsooooosggg',
    '   gGs~~sgggg..gggssooossggg',
    '   ggs~~sgfgg..ggggsssgGg   ',
    '    gs~~sgggg..gggggGggg    ',
  ],
  heights: [
    '4444433444444444444444440000',
    '4444433444444444444444444000',
    '4444433444444444444444444444',
    '4444433444444444444444444444',
    '4444433444444334444444444444',
    '4444433444444224444444444444',
    '4444433444444114444444444444',
    '1111000011111111111111333333',
    '1111000011111111111111333333',
    '1111100111111111111112333333',
    '1111100111111111111112333333',
    '1111100111111111111111333333',
    '1111100111111111111111111111',
    '1111100111111111111111111111',
    '1111100111111111111000001111',
    '1111110011111111111000001111',
    '1111110011111111111000001111',
    '1111110011111111111100011111',
    '1111110011111111111111111111',
    '1111110011111111111111111111',
  ],
  waterLevel: 0.35,
};

// ---------------------------------------------------------------------------
// Renderer / scene
// ---------------------------------------------------------------------------

const params = new URLSearchParams(location.search);
const container = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#c4d4e4', 0.009);
const camera = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 0.5, 400);

// vertical gradient background (the engine's Sky module is not used in this sandbox)
const bgCanvas = document.createElement('canvas');
bgCanvas.width = 4;
bgCanvas.height = 256;
const bgTex = new THREE.CanvasTexture(bgCanvas);
bgTex.colorSpace = THREE.SRGBColorSpace;
scene.background = bgTex;
function paintBackground(top, horizon) {
  const g = bgCanvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(0.75, horizon);
  grad.addColorStop(1, horizon);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  bgTex.needsUpdate = true;
}

const hemi = new THREE.HemisphereLight('#a6c4ec', '#6e5c46', 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffe6c4', 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 90 });
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 0.05;
sun.shadow.radius = 2.5;
scene.add(sun, sun.target);

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

const lib = new TextureLibrary({ seed: 1337, anisotropy: 4 });
const t0 = performance.now();
const tileMap = new TileMap(MAP, { textures: lib });
const buildMs = performance.now() - t0;
scene.add(tileMap.object);

// Rocks standing in the water (colliders → foam rings around them).
const rockGeo = new THREE.DodecahedronGeometry(1, 0);
const rockMat = new THREE.MeshLambertMaterial({ map: lib.get('cliff'), normalMap: lib.normal('cliff') });
/** @type {{ x: number, z: number, r: number, s: [number, number, number] }[]} r: radius, s: scale */
const rocks = [
  { x: 7.35, z: 16.6, r: 0.32, s: [0.42, 0.34, 0.38] },
  { x: 21.3, z: 15.3, r: 0.36, s: [0.46, 0.3, 0.4] },
  { x: 5.0, z: 13.4, r: 0.22, s: [0.28, 0.24, 0.26] },
];
for (const r of rocks) {
  const m = new THREE.Mesh(rockGeo, rockMat);
  m.scale.set(...r.s);
  m.position.set(r.x, tileMap.getHeight(r.x, r.z) + r.s[1] * 0.6, r.z);
  m.rotation.set(0.3, r.x * 3.1, 0.2);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
  tileMap.addCollider({ type: 'circle', x: r.x, z: r.z, r: r.r });
}

const t1 = performance.now();
const water = new Water(tileMap, { flow: [0, 0.55] });
const waterMs = performance.now() - t1;
scene.add(water.object);

const upper = tileMap.getWaterSurface(5.5, 6.5);
const lower = tileMap.getWaterSurface(5.5, 7.5);
const fall = createWaterfall({ x: 6, z: 7, width: 2, top: upper, bottom: lower, facing: 'S' });
scene.add(fall.object);

// A simple plank bridge (sandbox stand-in for Props.bridge) + its walk surface.
const BRIDGE = { minX: 4.55, maxX: 7.45, minZ: 10.1, maxZ: 11.9, y: 0.64 };
const bridge = new THREE.Group();
{
  const deckMat = new THREE.MeshLambertMaterial({ map: lib.get('wood_deck').clone(), normalMap: lib.normal('wood_deck') });
  deckMat.map.repeat.set((BRIDGE.maxX - BRIDGE.minX) / 4, (BRIDGE.maxZ - BRIDGE.minZ) / 4);
  deckMat.map.needsUpdate = true;
  const w = BRIDGE.maxX - BRIDGE.minX;
  const d = BRIDGE.maxZ - BRIDGE.minZ;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), deckMat);
  deck.position.set((BRIDGE.minX + BRIDGE.maxX) / 2, BRIDGE.y - 0.05, (BRIDGE.minZ + BRIDGE.maxZ) / 2);
  bridge.add(deck);
  const beamMat = new THREE.MeshLambertMaterial({ map: lib.get('wood_planks_dark'), normalMap: lib.normal('wood_planks_dark') });
  for (const z of [BRIDGE.minZ + 0.06, BRIDGE.maxZ - 0.06]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.08, 0.1), beamMat);
    rail.position.set(deck.position.x, BRIDGE.y + 0.48, z);
    bridge.add(rail);
    for (const x of [BRIDGE.minX + 0.08, (BRIDGE.minX + BRIDGE.maxX) / 2, BRIDGE.maxX - 0.08]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.12), beamMat);
      post.position.set(x, BRIDGE.y + 0.24, z);
      bridge.add(post);
    }
  }
  for (const x of [5.1, 6.9]) {
    const pile = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.8, d - 0.2), beamMat);
    pile.position.set(x, BRIDGE.y - 0.45, deck.position.z);
    bridge.add(pile);
  }
  bridge.traverse((/** @type {SceneNode} */ o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  scene.add(bridge);
}

// ---------------------------------------------------------------------------
// Lighting presets (approximating LightingSystem keyframes) → global uniforms
// ---------------------------------------------------------------------------

const TIMES = {
  day: { dir: [-0.55, 0.72, -0.42], sun: '#ffe6c4', sunI: 3.3, sky: '#a6c4ec', ground: '#6e5c46', hemiI: 1.1,
    fog: '#c9d8e6', density: 0.008, exp: 1.0, night: 0, top: '#4f86d6', horizon: '#d6e6f0' },
  golden: { dir: [-0.62, 0.34, -0.7], sun: '#ffb466', sunI: 5.2, sky: '#7078cc', ground: '#9a6444', hemiI: 1.45,
    fog: '#e8a07a', density: 0.0098, exp: 1.1, night: 0, top: '#3e4c9a', horizon: '#f7a068' },
  night: { dir: [0.45, 0.72, 0.35], sun: '#7294ff', sunI: 0.85, sky: '#2a48b4', ground: '#101430', hemiI: 1.12,
    fog: '#1c2b5c', density: 0.011, exp: 1.3, night: 1, top: '#050a1f', horizon: '#1b2a5c' },
};
const state = { time: 'day', focus: new THREE.Vector3(14, 0.8, 10), yaw: 0, pitch: 32, distance: 24, view: 'diorama' };

/** @param {string} name  a `TIMES` key ('day' when unknown) */
function setTime(name) {
  const p = TIMES[name] ?? TIMES.day;
  state.time = name;
  const dir = new THREE.Vector3(...p.dir).normalize();
  const c = new THREE.Vector3(14, 0, 10);
  sun.position.copy(c).addScaledVector(dir, 40);
  sun.target.position.copy(c);
  sun.target.updateMatrixWorld();
  sun.color.set(p.sun);
  sun.intensity = p.sunI;
  hemi.color.set(p.sky);
  hemi.groundColor.set(p.ground);
  hemi.intensity = p.hemiI;
  scene.fog.color.set(p.fog);
  /** @type {THREE.FogExp2} */ (scene.fog).density = p.density;
  renderer.toneMappingExposure = p.exp;
  paintBackground(p.top, p.horizon);
  globalUniforms.uSunDirection.value.copy(dir);
  globalUniforms.uSunColor.value.copy(sun.color).multiplyScalar(p.sunI / 3.5);
  globalUniforms.uFogColor.value.copy(scene.fog.color);
  globalUniforms.uNight.value = p.night;
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

/**
 * @typedef {object} CameraPose
 * @property {[number, number, number]} [focus]
 * @property {number} [yaw]
 * @property {number} [pitch]
 * @property {number} [distance]
 */
/** @type {Record<string, Required<CameraPose>>} yaw / pitch in degrees */
const VIEWS = {
  overview: { focus: [14, 0.6, 10], distance: 44, yaw: 0, pitch: 34 },
  diorama: { focus: [13, 0.9, 10.5], distance: 24, yaw: 0, pitch: 32 },
  cliffs: { focus: [12.2, 1.1, 7.2], distance: 12, yaw: -12, pitch: 30 },
  waterfall: { focus: [6.2, 0.9, 9], distance: 12.5, yaw: 8, pitch: 30 },
  edge: { focus: [9, 0.2, 15.5], distance: 19, yaw: 32, pitch: 26 },
  pond: { focus: [20.5, 0.4, 14.5], distance: 13, yaw: -10, pitch: 34 },
  terrace: { focus: [21, 1.0, 10.2], distance: 12, yaw: -20, pitch: 30 },
  fringe: { focus: [9.6, 0.5, 11.2], distance: 7, yaw: 10, pitch: 34 },
  lip: { focus: [17.5, 1.4, 7.2], distance: 7.5, yaw: -18, pitch: 26 },
};

/**
 * Move the diorama camera; a missing member keeps its current value.
 * @param {CameraPose} [pose]  focus point, yaw / pitch in degrees, distance
 */
function setCamera({ focus, yaw, pitch, distance } = {}) {
  if (focus) state.focus.set(...focus);
  if (yaw !== undefined) state.yaw = yaw;
  if (pitch !== undefined) state.pitch = pitch;
  if (distance !== undefined) state.distance = distance;
  const y = state.yaw * DEG2RAD;
  const p = state.pitch * DEG2RAD;
  camera.position.set(
    state.focus.x + Math.sin(y) * Math.cos(p) * state.distance,
    state.focus.y + Math.sin(p) * state.distance,
    state.focus.z + Math.cos(y) * Math.cos(p) * state.distance,
  );
  camera.lookAt(state.focus);
  globalUniforms.uCameraYaw.value = y;
  globalUniforms.uCameraPosition.value.copy(camera.position);
}

/** @param {string} name  a `VIEWS` key ('diorama' when unknown) */
function setView(name) {
  const v = VIEWS[name] ?? VIEWS.diorama;
  state.view = name;
  setCamera(v);
}

// drag to orbit, wheel to zoom (manual inspection)
let drag = null;
renderer.domElement.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, yaw: state.yaw, pitch: state.pitch }; });
window.addEventListener('pointerup', () => { drag = null; });
window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  setCamera({ yaw: drag.yaw - (e.clientX - drag.x) * 0.25, pitch: Math.max(10, Math.min(80, drag.pitch + (e.clientY - drag.y) * 0.2)) });
});
window.addEventListener('wheel', (e) => setCamera({ distance: Math.max(6, Math.min(80, state.distance * (1 + Math.sign(e.deltaY) * 0.08))) }));
window.addEventListener('keydown', (e) => {
  const keys = Object.keys(VIEWS);
  if (e.code.startsWith('Digit')) { const k = Number(e.code.slice(5)) - 1; if (keys[k]) setView(keys[k]); }
  if (e.code === 'KeyT') setTime(state.time === 'day' ? 'golden' : state.time === 'golden' ? 'night' : 'day');
});

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------------------
// Automated checks
// ---------------------------------------------------------------------------

function approx(a, b, eps = 1e-3) { return Math.abs(a - b) <= eps; }

function runTests() {
  const r = {};
  const tm = tileMap;
  const res = [];
  const check = (name, ok, info) => { res.push({ name, ok: !!ok, info }); };

  // Heights
  check('flat plaza', approx(tm.getHeight(12.5, 9.5), 0.5), tm.getHeight(12.5, 9.5));
  check('flat plateau', approx(tm.getHeight(10.5, 1.5), 2.0), tm.getHeight(10.5, 1.5));
  check('terrace', approx(tm.getHeight(24.5, 9.5), 1.5), tm.getHeight(24.5, 9.5));
  check('river bed', approx(tm.getHeight(5.5, 12.5), 0.0), tm.getHeight(5.5, 12.5));
  check('upper river bed', approx(tm.getHeight(5.5, 3.5), 1.5), tm.getHeight(5.5, 3.5));
  check('water surfaces', approx(tm.getWaterSurface(5.5, 12.5), 0.35) && approx(tm.getWaterSurface(5.5, 3.5), 1.85), [tm.getWaterSurface(5.5, 12.5), tm.getWaterSurface(5.5, 3.5)]);
  check('void height', tm.getHeight(0.5, 18.5) < 0, tm.getHeight(0.5, 18.5));
  // stairs: smooth ramp from 0.5 (plaza) to 2.0 (landing) along the stone staircase
  let prev = tm.getHeight(13.5, 7.6);
  let maxJump = 0;
  let mono = true;
  for (let z = 7.55; z >= 2.5; z -= 0.05) {
    const h = tm.getHeight(13.5, z);
    maxJump = Math.max(maxJump, Math.abs(h - prev));
    if (h < prev - 1e-6) mono = false;
    prev = h;
  }
  check('stairs mid', tm.getHeight(13.5, 5.5) > 1.0 && tm.getHeight(13.5, 5.5) < 1.5, tm.getHeight(13.5, 5.5));
  check('stairs smooth+monotonic', mono && maxJump < 0.1, { maxJump: +maxJump.toFixed(4), mono });
  check('stairs top/bottom', approx(tm.getHeight(13.5, 3.99), 2.0, 0.07) && approx(tm.getHeight(13.5, 6.99), 0.5, 0.07), [tm.getHeight(13.5, 3.99), tm.getHeight(13.5, 6.99)]);
  check('wooden stairs E', tm.getHeight(20.2, 9.5) < tm.getHeight(21.8, 9.5), [tm.getHeight(20.2, 9.5), tm.getHeight(21.8, 9.5)]);

  // Walkability
  check('walkable grass', tm.isWalkable(2.5, 12.5));
  check('water not walkable', !tm.isWalkable(5.5, 12.5));
  check('void not walkable', !tm.isWalkable(0.5, 18.5));

  // move(): blocked by the plateau cliff north of the plaza
  let p = tm.move({ x: 11.5, z: 7.6 }, 0, -1.5);
  check('cliff blocks', p.z >= 7.29 && approx(p.x, 11.5), p);
  // blocked by water (east bank → river)
  p = tm.move({ x: 8.6, z: 13.5 }, -1.5, 0);
  check("water blocks", p.x >= 7.29, p);
  // sliding along the cliff: diagonal push keeps x motion
  p = tm.move({ x: 11.0, z: 7.4 }, 0.6, -0.6);
  check('slides along wall', approx(p.x, 11.6, 0.02) && p.z >= 7.29, p);
  // climbing the stone staircase in small steps reaches the plateau
  let q = { x: 13.5, z: 7.8 };
  for (let k = 0; k < 60; k++) q = tm.move(q, 0, -0.1);
  check('climb stairs', q.z < 3.9 && approx(tm.getHeight(q.x, q.z), 2.0), { ...q, h: tm.getHeight(q.x, q.z) });
  // cannot step sideways off a stair onto the plateau (height gap > maxStep)
  p = tm.move({ x: 13.4, z: 5.5 }, -1.0, 0);
  check('stairs side blocked', p.x > 13.25, p);
  // cannot jump down the cliff from the plateau edge
  p = tm.move({ x: 10.5, z: 6.5 }, 0, 1.5);
  check('no cliff drop', p.z <= 6.71, p);
  // escaping invalid starts: from inside the river onto the bank; from overlapping the cliff
  q = { x: 5.5, z: 12.5 };
  for (let k = 0; k < 30; k++) q = tm.move(q, 0.1, 0);
  check('escape from water', q.x > 7.3 && tm.isWalkable(q.x, q.z), q);
  p = tm.move({ x: 11.5, z: 7.1 }, 0, -1.0);
  const p2 = tm.move({ x: 11.5, z: 7.1 }, 0, 0.5);
  check('escape wall overlap (no climbing)', p.z >= 7.0 && p2.z > 7.5 && approx(tm.getHeight(p.x, p.z), 0.5), { up: p, down: p2 });
  p = tm.move({ x: 4.5, z: 7.2 }, 0, -1.5);
  check('no climbing out of water up a cliff', p.z >= 7.0, p);
  // map bounds
  p = tm.move({ x: 0.5, z: 12.5 }, -2, 0);
  check('map bounds', p.x >= 0.299, p);
  // circle collider push-out (rock at 7.35,16.6 is in water; add a temporary one on grass)
  const col = tm.addCollider({ type: 'circle', x: 3.5, z: 13.5, r: 0.4 });
  p = tm.move({ x: 2.6, z: 13.45 }, 1.2, 0);
  const dCol = Math.hypot(p.x - 3.5, p.z - 13.5);
  check('circle collider', dCol >= 0.699, { ...p, d: +dCol.toFixed(3) });
  tm.removeCollider(col);
  const box = tm.addCollider({ type: 'box', minX: 1, maxX: 2, minZ: 13, maxZ: 14 });
  p = tm.move({ x: 0.5, z: 13.5 }, 1.2, 0);
  check('box collider', p.x <= 0.701, p);
  tm.removeCollider(box);

  // Walk surface: bridge deck over the river
  const had = tm.walkSurfaces.includes(BRIDGE);
  if (had) tm.removeWalkSurface(BRIDGE);
  const before = tm.isWalkable(5.5, 10.5);
  let b = tm.move({ x: 3.5, z: 11.0 }, 6, 0);
  const blockedBefore = b.x < 4.8;
  tm.addWalkSurface(BRIDGE);
  const after = tm.isWalkable(5.5, 10.5);
  const hb = tm.getHeight(6.0, 11.0);
  b = { x: 3.5, z: 11.0 };
  for (let k = 0; k < 40; k++) b = tm.move(b, 0.15, 0);
  check('bridge walk surface', !before && blockedBefore && after && approx(hb, BRIDGE.y) && b.x > 8.5, { before, blockedBefore, after, hb, end: b });
  // fall off the bridge sideways into the water is prevented
  p = tm.move({ x: 6.0, z: 11.0 }, 0, 2);
  check('bridge edge', p.z <= 11.91, p);

  // tile API
  const tile = tm.tileAt(13, 5);
  check('tileAt stairs', tile && tile.stairs === 'N' && tile.level === 2 && tile.walkable, tile && { char: tile.char, level: tile.level, h: tile.h });
  check('tileAt void', tm.tileAt(0, 19) === null && tm.tileAt(-1, 0) === null);
  const c = tm.tileCenter(12, 9);
  check('tileCenter', approx(c.x, 12.5) && approx(c.y, 0.5) && approx(c.z, 9.5), c.toArray());
  const wt = tm.worldToTile(3.7, 12.2);
  check('worldToTile', wt.i === 3 && wt.j === 12, wt);
  tm.blockTile(2, 12);
  const blk = !tm.isWalkable(2.5, 12.5);
  tm.unblockTile(2, 12);
  check('blockTile', blk && tm.isWalkable(2.5, 12.5));
  let count = 0;
  tm.forEachTile(() => count++);
  check('forEachTile', count > 500, count);
  check('tileAt fractional / NaN', tm.tileAt(12.7, 9.2) === tm.tileAt(12, 9) && tm.tileAt(NaN, 3) === null && tm.tileAt(-0.5, 3) === null);

  // Water shore texture: rebuilt only when colliders touching water change
  const tex0 = water.shoreTexture;
  const dry = tm.addCollider({ type: 'circle', x: 12.5, z: 9.5, r: 0.4 });
  water.update(0.016);
  const dryKept = water.shoreTexture === tex0;
  const wet = tm.addCollider({ type: 'circle', x: 5.5, z: 12.5, r: 0.3 });
  water.update(0.016);
  const wetRebuilt = water.shoreTexture !== tex0;
  tm.removeCollider(dry);
  tm.removeCollider(wet);
  water.update(0.016);
  check('water shore rebuild only for wet colliders', dryKept && wetRebuilt, { dryKept, wetRebuilt });

  r.passed = res.filter((x) => x.ok).length;
  r.failed = res.filter((x) => !x.ok).map((x) => ({ name: x.name, info: x.info }));
  r.total = res.length;
  r.results = res;
  return r;
}

function stats() {
  renderer.render(scene, camera);
  return {
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    tileMap: tileMap.stats,
    waterTiles: water.tiles.length,
    buildMs: +buildMs.toFixed(1),
    waterMs: +waterMs.toFixed(1),
    programs: renderer.info.programs?.length,
  };
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

tileMap.addWalkSurface(BRIDGE);
setTime(params.get('time') ?? 'day');
setView(params.get('view') ?? 'diorama');

const hud = document.getElementById('hud');
let last = performance.now();
let frames = 0;
let fpsT = 0;
let fps = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  globalUniforms.uTime.value += dt;
  water.update(dt);
  fall.update(dt);
  renderer.render(scene, camera);
  frames++;
  fpsT += dt;
  if (fpsT > 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; }
  const info = renderer.info.render;
  hud.textContent = `${state.view} · ${state.time} · ${fps.toFixed(0)} fps · ${info.calls} calls · ${(info.triangles / 1000).toFixed(1)}k tris · build ${buildMs.toFixed(0)} ms + water ${waterMs.toFixed(0)} ms   [1-7 views, T time, drag/wheel]`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/**
 * `window.__terrain` (AUTOMATION_API.md §7), read by sandbox/terrain*.json.
 * @typedef {object} TerrainHandle
 * @property {typeof THREE} THREE
 * @property {THREE.WebGLRenderer} renderer
 * @property {THREE.Scene} scene
 * @property {THREE.PerspectiveCamera} camera
 * @property {typeof MAP} map  the hand-made sandbox map
 * @property {TileMap} tileMap
 * @property {Water} water
 * @property {ReturnType<typeof createWaterfall>} fall  the river's waterfall off the plateau
 * @property {TextureLibrary} lib
 * @property {THREE.DirectionalLight} sun
 * @property {THREE.HemisphereLight} hemi
 * @property {typeof globalUniforms} globalUniforms
 * @property {typeof BRIDGE} BRIDGE  the plank bridge's walk surface
 * @property {typeof setView} setView  a named camera view (`views`)
 * @property {typeof setTime} setTime  'day' / 'golden' / 'night'
 * @property {typeof setCamera} setCamera
 * @property {typeof runTests} runTests  heights, walkability, move(), colliders, walk surfaces,
 *   tile API, shore rebuild: `{ passed, failed, total, results }`
 * @property {typeof stats} stats  one render's calls / triangles, TileMap stats, build times
 * @property {string[]} views  the `VIEWS` names
 * @property {(t: number) => void} setClock  freeze the animation clock at t seconds
 */
window.__terrain = {
  THREE, renderer, scene, camera, map: MAP, tileMap, water, fall, lib, sun, hemi, globalUniforms, BRIDGE,
  setView, setTime, setCamera, runTests, stats, views: Object.keys(VIEWS),
  /** Freeze the animation clock at t seconds (deterministic screenshots). */
  setClock(t) { globalUniforms.uTime.value = t; },
};
