/**
 * Core sandbox — exercises Engine, Input, CameraRig and AudioSystem standalone with raw three.js
 * and the shared foundation files. Exposes `window.__core` for scripted checks.
 */
import * as THREE from 'three';
import '@fontsource/crimson-pro/400.css';
import '@fontsource/crimson-pro/400-italic.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/pixelify-sans/400.css';
import { Engine } from '../src/engine/core/Engine.js';
import { CameraRig } from '../src/engine/core/CameraRig.js';
import { AudioSystem, SFX_NAMES, AMBIENCE_LAYERS } from '../src/engine/audio/AudioSystem.js';
import { PixelCanvas, normalMapFromHeight, mixColor } from '../src/engine/pixel/PixelCanvas.js';
import { PALETTE } from '../src/engine/pixel/Palette.js';
import { RNG, clamp, damp, hash2, fbm2, DEG2RAD, RAD2DEG } from '../src/engine/utils/math.js';
import { globalUniforms } from '../src/engine/render/GlobalUniforms.js';

/**
 * @import { EventEmitter } from '../src/engine/core/EventEmitter.js'
 * @import { ActionName } from '../src/engine/core/Input.js'
 */

// -------------------------------------------------------------------------------------------
// Engine, camera, audio
// -------------------------------------------------------------------------------------------

const app = document.getElementById('app');
const engine = new Engine({ container: app, clearColor: 0x1a1420 });
const { scene, camera, input, renderer } = engine;
const rig = new CameraRig(camera, { pitch: 32, yaw: 0, distance: 24 });
rig.bounds = { minX: -18, maxX: 18, minZ: -18, maxZ: 18 };
const audio = new AudioSystem({ volume: 0.6 });

const resizeLog = [];
engine.events.on('resize', (e) => resizeLog.push(e));

// -------------------------------------------------------------------------------------------
// Procedural pixel textures (16 px per world unit)
// -------------------------------------------------------------------------------------------

function grassTexture() {
  const W = 64; // 4×4 units
  const pc = new PixelCanvas(W, W);
  pc.wrap = true;
  const G = PALETTE.grass;
  // Calm mid-tone base with small-scale variation: big dark blotches read as fake cloud shadows
  // and compete with the real sun shadows.
  pc.fillNoise([G[2], G[3], G[3], G[4]], { scale: 8, period: 8, seed: 7, octaves: 2, dither: 1.0 });
  const rng = new RNG(11);
  // Tufts: a few blades each, shaded root + lit tip (hand-placed pixel detail).
  for (let i = 0; i < 80; i++) {
    const cx = rng.int(0, W - 1);
    const cy = rng.int(0, W - 1);
    const n = rng.int(2, 4);
    for (let k = 0; k < n; k++) {
      const x = cx + rng.int(-2, 2);
      const y = cy + rng.int(-1, 1);
      pc.set(x, y + 1, G[1]);
      pc.set(x, y, G[rng.chance(0.55) ? 4 : 3]);
      if (rng.chance(0.3)) pc.set(x, y - 1, G[5]);
    }
  }
  for (let i = 0; i < 10; i++) {
    const x = rng.int(0, W - 1);
    const y = rng.int(0, W - 1);
    const col = rng.pick([PALETTE.yellow[4], PALETTE.white[3], PALETTE.red[4], PALETTE.blue[4], PALETTE.yellow[5]]);
    pc.set(x, y, col);
    pc.set(x, y + 1, PALETTE.grass[1]);
  }
  return pc.toTexture({ mipmaps: true, anisotropy: 4, name: 'sb_grass' });
}

function flagstoneTextures() {
  const W = 32; // 2×2 units
  const pc = new PixelCanvas(W, W);
  pc.wrap = true;
  const height = new Float32Array(W * W);
  const ramp = PALETTE.stoneWarm;
  // Running-bond flagstones: 2 rows of 16 px; the second row is offset by 8 px.
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const row = Math.floor(y / 16);
      const xo = (x + (row % 2) * 8) % W;
      const col = Math.floor(xo / 16);
      const lx = xo % 16;
      const ly = y % 16;
      const tone = hash2(col, row, 5) * 0.8 - 0.4;
      const n = fbm2(x / 8, y / 8, { seed: 3, period: 4, octaves: 2 });
      const edge = Math.min(lx, ly, 15 - lx, 15 - ly);
      let idx = 3 + Math.round((n - 0.5) * 2.2 + tone);
      let h = 1;
      if (edge === 0) {
        idx = 1;
        h = 0;
      } else if (edge === 1) {
        h = 0.6;
        if (lx === 1 || ly === 1) idx += 1; // lit top-left bevel
        else idx -= 1; // shaded bottom-right bevel
      }
      pc.set(x, y, ramp[clamp(idx, 1, 5)]);
      height[y * W + x] = h - (hash2(x, y, 9) < 0.06 ? 0.3 : 0);
    }
  }
  const rng = new RNG(4);
  for (let i = 0; i < 6; i++) {
    let x = rng.int(0, W - 1);
    let y = rng.int(0, W - 1);
    for (let k = 0; k < 5; k++) {
      pc.set(x, y, ramp[1]);
      height[((y + W) % W) * W + ((x + W) % W)] = 0.4;
      x += rng.int(-1, 1);
      y += 1;
    }
  }
  for (let i = 0; i < 14; i++) pc.set(rng.int(0, W - 1), rng.int(0, W - 1), PALETTE.moss[rng.int(1, 3)]);
  const map = pc.toTexture({ mipmaps: true, anisotropy: 4, name: 'sb_flag' });
  const normal = normalMapFromHeight(W, W, (x, y) => height[y * W + x], { strength: 2.2 }).toTexture({ mipmaps: true, srgb: false, name: 'sb_flag_n' });
  return { map, normal };
}

function crateTextures() {
  const W = 16;
  const pc = new PixelCanvas(W, W);
  const wood = PALETTE.wood;
  const height = new Float32Array(W * W);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const plank = Math.floor((y - 2) / 4);
      const grain = hash2(x >> 2, y, 13) < 0.2 ? -1 : 0;
      let idx = 3 + grain + (plank % 2 ? 0 : 1) * 0;
      let h = 0.5;
      if ((y - 2) % 4 === 3) {
        idx = 1;
        h = 0.2;
      }
      pc.set(x, y, wood[clamp(idx, 0, 5)]);
      height[y * W + x] = h;
    }
  }
  // Frame + brace.
  for (let i = 0; i < W; i++) {
    for (const [x, y] of [[i, 0], [i, 1], [i, 14], [i, 15], [0, i], [1, i], [14, i], [15, i]]) {
      const edgeLit = y === 0 || x === 0;
      pc.set(x, y, edgeLit ? wood[4] : (y === 15 || x === 15 ? wood[1] : wood[2]));
      height[y * W + x] = 1;
    }
  }
  for (let i = 2; i < 14; i++) {
    pc.set(i, 15 - i, wood[4]);
    pc.set(i, 16 - i, wood[2]);
    height[(15 - i) * W + i] = 0.9;
  }
  for (const [x, y] of [[1, 1], [14, 1], [1, 14], [14, 14]]) pc.set(x, y, PALETTE.metal[4]);
  const map = pc.toTexture({ mipmaps: true, name: 'sb_crate' });
  const normal = normalMapFromHeight(W, W, (x, y) => height[y * W + x], { strength: 2.5, wrap: false }).toTexture({ mipmaps: true, srgb: false, name: 'sb_crate_n' });
  return { map, normal };
}

function brickTextures() {
  const W = 16;
  const pc = new PixelCanvas(W, W);
  const height = new Float32Array(W * W);
  const ramp = PALETTE.stone;
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const row = Math.floor(y / 4);
      const xo = (x + (row % 2) * 4) % W;
      const bx = Math.floor(xo / 8);
      const lx = xo % 8;
      const ly = y % 4;
      const tone = Math.round(hash2(bx, row, 21) * 2 - 1);
      let idx = 3 + tone;
      let h = 1;
      if (lx === 0 || ly === 0) {
        idx = 1;
        h = 0;
      } else if (ly === 1) idx += 1;
      pc.set(x, y, ramp[clamp(idx, 1, 5)]);
      height[y * W + x] = h;
    }
  }
  const map = pc.toTexture({ mipmaps: true, name: 'sb_brick' });
  const normal = normalMapFromHeight(W, W, (x, y) => height[y * W + x], { strength: 2 }).toTexture({ mipmaps: true, srgb: false, name: 'sb_brick_n' });
  return { map, normal };
}

function leafTexture() {
  const W = 16;
  const pc = new PixelCanvas(W, W);
  pc.wrap = true;
  pc.fillNoise(PALETTE.leaves.slice(1, 6), { scale: 4, period: 4, seed: 17, octaves: 2, dither: 0.9 });
  const rng = new RNG(3);
  for (let i = 0; i < 18; i++) pc.set(rng.int(0, 15), rng.int(0, 15), PALETTE.leaves[5]);
  return pc.toTexture({ mipmaps: true, name: 'sb_leaf' });
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#5a6a9a');
  grad.addColorStop(0.35, '#b79aa8');
  grad.addColorStop(0.7, '#e6b48c');
  grad.addColorStop(1, '#e2b08a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// -------------------------------------------------------------------------------------------
// Scene
// -------------------------------------------------------------------------------------------

const disposables = [];
const track = (...items) => {
  disposables.push(...items);
  return items[0];
};

scene.background = track(skyTexture());
scene.fog = new THREE.FogExp2(0xe2b08a, 0.017);

const sun = new THREE.DirectionalLight(0xffc38a, 3.8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 80;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 3;
const sunDir = new THREE.Vector3(-0.62, 0.42, -0.35).normalize();
scene.add(sun, sun.target);
globalUniforms.uSunDirection.value.copy(sunDir);

// Cool, lower fill so golden-hour shadows read clearly (lifted, slightly blue — not black).
const hemi = new THREE.HemisphereLight(0x8fa6dc, 0x5a4034, 0.8);
scene.add(hemi);

const grass = track(grassTexture());
const GROUND = 160;
grass.repeat.set(GROUND / 4, GROUND / 4);
const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(GROUND, GROUND)), track(new THREE.MeshLambertMaterial({ map: grass })));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Raised flagstone plaza.
const PLAZA = 10;
const PLAZA_H = 0.3;
const flag = flagstoneTextures();
track(flag.map, flag.normal);
flag.map.repeat.set(PLAZA / 2, PLAZA / 2);
flag.normal.repeat.set(PLAZA / 2, PLAZA / 2);
const flagSideMap = track(flag.map.clone());
flagSideMap.repeat.set(PLAZA / 2, PLAZA_H / 2);
const plazaTop = track(new THREE.MeshLambertMaterial({ map: flag.map, normalMap: flag.normal }));
const plazaSide = track(new THREE.MeshLambertMaterial({ map: flagSideMap, color: 0xb8a898 }));
const plaza = new THREE.Mesh(track(new THREE.BoxGeometry(PLAZA, PLAZA_H, PLAZA)), [plazaSide, plazaSide, plazaTop, plazaSide, plazaSide, plazaSide]);
plaza.position.y = PLAZA_H / 2;
plaza.castShadow = plaza.receiveShadow = true;
scene.add(plaza);

// Crates (with simple AABB colliders).
const crate = crateTextures();
track(crate.map, crate.normal);
const crateMat = track(new THREE.MeshLambertMaterial({ map: crate.map, normalMap: crate.normal }));
const crateGeo = track(new THREE.BoxGeometry(1, 1, 1));
const colliders = [];
const rng = new RNG(2024);
const cratePositions = [];
for (let i = 0; i < 22; i++) {
  const a = rng.range(0, Math.PI * 2);
  const r = rng.range(7.2, 16);
  const x = Math.round(Math.cos(a) * r) + 0.5;
  const z = Math.round(Math.sin(a) * r) + 0.5;
  if (cratePositions.some(([px, pz]) => Math.abs(px - x) < 1.5 && Math.abs(pz - z) < 1.5)) continue;
  cratePositions.push([x, z]);
  const stack = rng.chance(0.3) ? 2 : 1;
  for (let s = 0; s < stack; s++) {
    const m = new THREE.Mesh(crateGeo, crateMat);
    m.position.set(x + (s ? rng.range(-0.08, 0.08) : 0), 0.5 + s, z);
    m.rotation.y = s ? rng.range(-0.3, 0.3) : 0;
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }
  colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
}

// Stone pillars with warm lanterns at the plaza corners.
const brick = brickTextures();
track(brick.map, brick.normal);
brick.map.repeat.set(1, 2.6);
brick.normal.repeat.set(1, 2.6);
const pillarMat = track(new THREE.MeshLambertMaterial({ map: brick.map, normalMap: brick.normal }));
const pillarGeo = track(new THREE.BoxGeometry(0.9, 2.6, 0.9));
const capGeo = track(new THREE.BoxGeometry(1.1, 0.18, 1.1));
// Dark iron cap: the lantern's point light sits only ~0.2 units above it, so a light albedo
// clips to a flat white slab; a dark one gives a warm glow gradient instead.
const capMat = track(new THREE.MeshLambertMaterial({ color: 0x3e3844 }));
const lampGeo = track(new THREE.BoxGeometry(0.34, 0.42, 0.34));
const lampMat = track(new THREE.MeshBasicMaterial({ color: 0xffb35c }));
const lampFrameMat = track(new THREE.MeshLambertMaterial({ color: 0x2a2530 }));
const lampFrameGeo = track(new THREE.BoxGeometry(0.42, 0.08, 0.42));
for (const [px, pz] of [[-4.2, -4.2], [4.2, -4.2], [-4.2, 4.2], [4.2, 4.2]]) {
  const g = new THREE.Group();
  g.position.set(px, PLAZA_H, pz);
  const p = new THREE.Mesh(pillarGeo, pillarMat);
  p.position.y = 1.3;
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.y = 2.69;
  const lamp = new THREE.Mesh(lampGeo, lampMat);
  lamp.position.y = 3.0;
  const lid = new THREE.Mesh(lampFrameGeo, lampFrameMat);
  lid.position.y = 3.25;
  for (const m of [p, cap, lid]) m.castShadow = m.receiveShadow = true;
  const light = new THREE.PointLight(0xffb46b, 7, 9, 2);
  light.position.y = 3.0;
  g.add(p, cap, lamp, lid, light);
  scene.add(g);
  colliders.push({ minX: px - 0.45, maxX: px + 0.45, minZ: pz - 0.45, maxZ: pz + 0.45 });
}

// Bushes around the edge.
const leafMap = track(leafTexture());
const bushMat = track(new THREE.MeshLambertMaterial({ map: leafMap, flatShading: true }));
const bushGeo = track(new THREE.IcosahedronGeometry(0.9, 1));
for (let i = 0; i < 26; i++) {
  const a = rng.range(0, Math.PI * 2);
  const r = rng.range(17, 22);
  const b = new THREE.Mesh(bushGeo, bushMat);
  const s = rng.range(0.7, 1.5);
  b.scale.set(s, s * rng.range(0.7, 0.95), s);
  b.position.set(Math.cos(a) * r, s * 0.45, Math.sin(a) * r);
  b.rotation.y = rng.range(0, 6);
  b.castShadow = b.receiveShadow = true;
  scene.add(b);
}

// -------------------------------------------------------------------------------------------
// The controllable marker: a floating save-crystal on a glowing ring
// -------------------------------------------------------------------------------------------

const marker = new THREE.Group();
marker.name = 'marker';
const crystalMat = track(new THREE.MeshStandardMaterial({ color: 0xbfefff, emissive: 0x2a8fff, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.05, flatShading: true }));
const crystal = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.32, 0)), crystalMat);
crystal.scale.set(1, 1.7, 1);
crystal.castShadow = true;
const ringMat = track(new THREE.MeshBasicMaterial({ color: 0x8fdcff, transparent: true, opacity: 0.75, depthWrite: false }));
const ring = new THREE.Mesh(track(new THREE.RingGeometry(0.46, 0.56, 32)), ringMat);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.02;
const arrowShape = new THREE.Shape([new THREE.Vector2(0, 0.26), new THREE.Vector2(0.16, 0), new THREE.Vector2(-0.16, 0)]);
const arrow = new THREE.Mesh(track(new THREE.ShapeGeometry(arrowShape)), ringMat);
arrow.rotation.x = -Math.PI / 2;
const arrowPivot = new THREE.Group();
arrowPivot.position.y = 0.025;
arrow.position.z = -0.7;
arrow.rotation.z = 0;
arrowPivot.add(arrow);
const markerLight = new THREE.PointLight(0x7fcfff, 3.5, 6, 2);
markerLight.position.y = 1.2;
marker.add(crystal, ring, arrowPivot, markerLight);
scene.add(marker);

// Focus / look-ahead indicator.
const focusMat = track(new THREE.MeshBasicMaterial({ color: 0xffe3a0, transparent: true, opacity: 0.8, depthWrite: false }));
const focusDot = new THREE.Mesh(track(new THREE.RingGeometry(0.12, 0.2, 16)), focusMat);
focusDot.rotation.x = -Math.PI / 2;
scene.add(focusDot);

rig.setTarget(marker);
rig.snap();

// -------------------------------------------------------------------------------------------
// Systems
// -------------------------------------------------------------------------------------------

const state = {
  heading: 0,
  speed: 0,
  stepDist: 0,
  showFocus: true,
  lastPressed: [],
  log: [],
};
const _dir = new THREE.Vector3();

function groundHeight(x, z) {
  return Math.abs(x) <= PLAZA / 2 && Math.abs(z) <= PLAZA / 2 ? PLAZA_H : 0;
}

function collide(x, z, r) {
  for (const c of colliders) {
    const cx = clamp(x, c.minX, c.maxX);
    const cz = clamp(z, c.minZ, c.maxZ);
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 1e-4;
      x = cx + (dx / d) * r;
      z = cz + (dz / d) * r;
    }
  }
  return [x, z];
}

const player = {
  name: 'player',
  update(dt, t, eng) {
    const inp = eng.input;
    const mv = inp.getMoveVector();
    const run = inp.action('run');
    const speed = (run ? 7 : 4) * Math.hypot(mv.x, mv.y);
    rig.toWorldDirection(mv.x, mv.y, _dir);
    if (speed > 0.01) {
      const len = _dir.length() || 1;
      let nx = marker.position.x + (_dir.x / len) * speed * dt;
      let nz = marker.position.z + (_dir.z / len) * speed * dt;
      [nx, nz] = collide(nx, nz, 0.4);
      nx = clamp(nx, -21, 21);
      nz = clamp(nz, -21, 21);
      const moved = Math.hypot(nx - marker.position.x, nz - marker.position.z);
      marker.position.x = nx;
      marker.position.z = nz;
      const target = Math.atan2(_dir.x, _dir.z);
      let d = target - state.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      state.heading += d * damp(14, dt);
      state.stepDist += moved;
      const stride = run ? 1.5 : 1.1;
      if (state.stepDist > stride) {
        state.stepDist -= stride;
        audio.playSfx('step', { volume: run ? 0.9 : 0.7 });
      }
    }
    state.speed = speed;
    const gy = groundHeight(marker.position.x, marker.position.z);
    marker.position.y += (gy - marker.position.y) * damp(18, dt);
    arrowPivot.rotation.y = state.heading + Math.PI;
    arrow.visible = speed > 0.05;

    // Crystal idle animation.
    crystal.position.y = 1.15 + Math.sin(t * 2.2) * 0.1;
    crystal.rotation.y = t * 1.3;
    ring.scale.setScalar(1 + Math.sin(t * 3) * 0.05);
    ringMat.opacity = 0.55 + Math.sin(t * 3) * 0.2;

    if (inp.actionPressed('confirm')) {
      audio.playSfx('confirm');
      rig.shake(0.18, 0.35);
    }
    if (inp.actionPressed('cancel')) audio.playSfx('cancel');
    if (inp.actionPressed('music')) {
      audio.unlock();
      audio.toggleMusic();
    }
    if (inp.actionPressed('help')) audio.playSfx('chime');
    if (inp.anyPressed()) {
      for (const code of inp._pressed) state.lastPressed.push({ code, t: performance.now() });
    }
  },
};
engine.addSystem(player, 0);

engine.addSystem({
  name: 'camera',
  lateUpdate(dt, t, eng) {
    rig.update(dt, eng.input);
    // Sun + shadow camera follow the focus point (texel-snapped to avoid shimmering).
    const f = rig.focusPoint;
    const texel = (sc.right - sc.left) / sun.shadow.mapSize.x;
    const fx = Math.round(f.x / texel) * texel;
    const fz = Math.round(f.z / texel) * texel;
    sun.target.position.set(fx, 0, fz);
    sun.position.set(fx + sunDir.x * 40, sunDir.y * 40, fz + sunDir.z * 40);
    focusDot.visible = state.showFocus;
    focusDot.position.set(f.x, groundHeight(f.x, f.z) + 0.03, f.z);
  },
}, 100);

engine.addSystem(audio, 200);

// -------------------------------------------------------------------------------------------
// UI: live readout + control panel
// -------------------------------------------------------------------------------------------

const readout = document.getElementById('readout');
const controls = document.getElementById('controls');
const fmt = (v, d = 2) => (v >= 0 ? '+' : '') + v.toFixed(d);
let hudTimer = 0;

engine.events.on('afterRender', (dt) => {
  hudTimer -= engine.time.realDelta;
  if (hudTimer > 0) return;
  hudTimer = 0.1;
  const now = performance.now();
  state.lastPressed = state.lastPressed.filter((p) => now - p.t < 1200);
  const down = [...input._down, ...input._padDown];
  const actions = Object.keys(input.bindings).filter((a) => input.action(/** @type {ActionName} */ (a)));
  const mv = input.getMoveVector();
  const f = rig.focusPoint;
  const gp = input.gamepad;
  const amb = audio.ambience;
  const ambStr = AMBIENCE_LAYERS.filter((k) => amb[k] > 0).map((k) => `${k} ${amb[k].toFixed(2)}`).join('  ') || '—';
  const audioState = audio.ctx ? audio.ctx.state : 'locked (click Unlock)';
  readout.innerHTML = [
    `<b>fps</b>     ${engine.time.fps.toFixed(1).padStart(5)}   frame ${engine.time.frame}   ×${engine.time.timeScale.toFixed(2)}`,
    `<b>size</b>    ${engine.width}×${engine.height} @${engine.pixelRatio.toFixed(2)}  scale ${engine.renderScale.toFixed(2)}`,
    `<b>keys</b>    ${down.join(' ') || '—'}`,
    `<b>pressed</b> ${[...new Set(state.lastPressed.map((p) => p.code))].join(' ') || '—'}`,
    `<b>actions</b> ${actions.join(' ') || '—'}`,
    `<b>move</b>    (${fmt(mv.x)}, ${fmt(mv.y)})  speed ${state.speed.toFixed(1)}`,
    `<b>pointer</b> ${Math.round(input.pointer.x)}, ${Math.round(input.pointer.y)}  ${input.pointer.down ? 'down' : 'up'}`,
    `<b>gamepad</b> ${gp.connected ? gp.id.slice(0, 28) : 'none'}`,
    ``,
    `<b>yaw</b>     ${fmt(rig.yaw * RAD2DEG, 1)}°  → ${fmt(rig.yawTarget * RAD2DEG, 1)}°${rig.freeYaw ? ' (free)' : ''}`,
    `<b>pitch</b>   ${(rig.pitch * RAD2DEG).toFixed(1)}°   fov ${camera.fov.toFixed(0)}°`,
    `<b>dist</b>    ${rig.distance.toFixed(2)} → ${rig.distanceTarget.toFixed(2)}  focus ${rig.focusDistance.toFixed(2)}`,
    `<b>focus</b>   (${fmt(f.x, 1)}, ${fmt(f.y, 1)}, ${fmt(f.z, 1)})  ahead ${Math.hypot(rig.lookOffset.x, rig.lookOffset.z).toFixed(2)}`,
    `<b>shake</b>   ${rig.shakeAmount.toFixed(3)}`,
    ``,
    `<b>audio</b>   ${audioState}  voices ${audio._voices}`,
    `<b>music</b>   ${audio.musicPlaying ? 'playing' : 'off'}`,
    `<b>amb</b>     ${ambStr}`,
  ].join('\n');
  // Keep the button in sync when music is toggled with the M key.
  musicBtn.textContent = audio.musicPlaying ? 'Stop music' : 'Start music';
  musicBtn.classList.toggle('on', audio.musicPlaying);
  drawScope();
});

function el(tag, props = {}, ...children) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const c of children) e.append(c);
  return e;
}

function button(label, onClick, cls = '') {
  const b = el('button', { textContent: label, className: cls });
  b.addEventListener('click', (ev) => {
    onClick(ev, b);
    b.blur(); // keep Space/Enter for the game
  });
  return b;
}

function section(title, ...children) {
  return el('section', {}, el('h2', { textContent: title }), ...children);
}

const unlockBtn = button('Unlock audio', async (_, b) => {
  const ok = await audio.unlock();
  b.textContent = ok ? 'Audio ready' : 'Audio unavailable';
  b.classList.toggle('on', ok);
  attachScope();
}, 'wide');

const sfxGrid = el('div', { className: 'grid' });
for (const name of SFX_NAMES) sfxGrid.append(button(name, () => audio.playSfx(name)));

const ambRows = AMBIENCE_LAYERS.map((name) => {
  const val = el('span', { textContent: '0.00' });
  const range = el('input', { type: 'range', min: 0, max: 1, step: 0.01, value: 0 });
  range.addEventListener('input', () => {
    val.textContent = Number(range.value).toFixed(2);
    audio.setAmbience({ [name]: Number(range.value) });
  });
  range.dataset.layer = name;
  return el('label', { className: 'row' }, el('span', { textContent: name }), range, val);
});
const syncAmbSliders = () => {
  const amb = audio.ambience;
  for (const row of ambRows) {
    const r = row.querySelector('input');
    r.value = amb[r.dataset.layer];
    row.lastChild.textContent = Number(r.value).toFixed(2);
  }
};
const presets = el('div', { className: 'grid two' },
  button('Day meadow', () => { audio.setAmbience({ wind: 0.45, birds: 0.7, crickets: 0, fire: 0, water: 0.25 }); syncAmbSliders(); }),
  button('Night camp', () => { audio.setAmbience({ wind: 0.2, birds: 0, crickets: 0.75, fire: 0.8, water: 0 }); syncAmbSliders(); }),
  button('Riverside', () => { audio.setAmbience({ wind: 0.25, birds: 0.35, crickets: 0, fire: 0, water: 0.9 }); syncAmbSliders(); }),
  button('Silence', () => { audio.setAmbience({ wind: 0, birds: 0, crickets: 0, fire: 0, water: 0 }); syncAmbSliders(); }),
);

const musicBtn = button('Start music', (_, b) => {
  audio.toggleMusic();
  b.textContent = audio.musicPlaying ? 'Stop music' : 'Start music';
  b.classList.toggle('on', audio.musicPlaying);
}, 'wide');

const volRow = (() => {
  const val = el('span', { textContent: audio.masterVolume.toFixed(2) });
  const range = el('input', { type: 'range', min: 0, max: 1, step: 0.01, value: audio.masterVolume });
  range.addEventListener('input', () => {
    audio.masterVolume = Number(range.value);
    val.textContent = audio.masterVolume.toFixed(2);
  });
  return el('label', { className: 'row' }, el('span', { textContent: 'master' }), range, val);
})();

const scope = el('canvas', { id: 'scope', width: 260, height: 64 });

const freeYaw = el('input', { type: 'checkbox' });
freeYaw.addEventListener('change', () => {
  rig.freeYaw = freeYaw.checked;
  if (!rig.freeYaw) rig.rotate(0);
});
const showFocus = el('input', { type: 'checkbox', checked: true });
showFocus.addEventListener('change', () => (state.showFocus = showFocus.checked));

const camGrid = el('div', { className: 'grid two' },
  button('Shake (light)', () => rig.shake(0.15, 0.4)),
  button('Shake (heavy)', () => rig.shake(0.6, 0.9)),
  button('Reset yaw', () => rig.setAngles(0)),
  button('Snap', () => rig.snap()),
  button('Zoom in', () => rig.zoomIn(4)),
  button('Zoom out', () => rig.zoomOut(4)),
);

const timeRow = (() => {
  const val = el('span', { textContent: '1.00' });
  const range = el('input', { type: 'range', min: 0, max: 2, step: 0.05, value: 1 });
  range.addEventListener('input', () => {
    engine.time.timeScale = Number(range.value);
    val.textContent = engine.time.timeScale.toFixed(2);
  });
  return el('label', { className: 'row' }, el('span', { textContent: 'time' }), range, val);
})();
const scaleRow = (() => {
  const val = el('span', { textContent: '1.00' });
  const range = el('input', { type: 'range', min: 0.25, max: 1, step: 0.05, value: 1 });
  range.addEventListener('input', () => {
    engine.renderScale = Number(range.value);
    val.textContent = engine.renderScale.toFixed(2);
  });
  return el('label', { className: 'row' }, el('span', { textContent: 'res' }), range, val);
})();

controls.append(
  section('Audio', unlockBtn, volRow, scope),
  section('Sound effects', sfxGrid),
  section('Ambience', ...ambRows, presets),
  section('Music', musicBtn),
  section('Camera',
    el('label', { className: 'check' }, freeYaw, 'Free yaw (no ±60° limit)'),
    el('label', { className: 'check' }, showFocus, 'Show focus point'),
    camGrid),
  section('Engine', timeRow, scaleRow,
    el('div', { className: 'grid two' },
      button('Pause', (_, b) => {
        if (engine.running) engine.stop(); else engine.start();
        b.textContent = engine.running ? 'Pause' : 'Resume';
      }),
      button('Step', () => engine.step(1 / 60)))),
);

// Oscilloscope on the master output.
let analyser = null;
let scopeData = null;
function attachScope() {
  if (analyser || !audio.ctx) return;
  analyser = audio.ctx.createAnalyser();
  analyser.fftSize = 1024;
  scopeData = new Float32Array(analyser.fftSize);
  audio._master.connect(analyser);
}
function drawScope() {
  const g = scope.getContext('2d');
  const w = scope.width;
  const h = scope.height;
  g.clearRect(0, 0, w, h);
  g.strokeStyle = 'rgba(201,164,92,0.25)';
  g.beginPath();
  g.moveTo(0, h / 2);
  g.lineTo(w, h / 2);
  g.stroke();
  if (!analyser) return;
  analyser.getFloatTimeDomainData(scopeData);
  g.strokeStyle = '#f0d58f';
  g.lineWidth = 1.2;
  g.beginPath();
  for (let i = 0; i < scopeData.length; i++) {
    const x = (i / (scopeData.length - 1)) * w;
    const y = h / 2 - scopeData[i] * h * 0.9;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
}

// Unlock audio on the first real user gesture as well.
const gestureUnlock = () => {
  audio.unlock().then((ok) => {
    if (ok) {
      unlockBtn.textContent = 'Audio ready';
      unlockBtn.classList.add('on');
      attachScope();
    }
  });
};
window.addEventListener('pointerdown', gestureUnlock, { once: true });
window.addEventListener('keydown', gestureUnlock, { once: true });

engine.start();

// -------------------------------------------------------------------------------------------
// Scripted self-tests (used by tools/check.mjs actions)
// -------------------------------------------------------------------------------------------

/**
 * @param {string} type  'keydown' / 'keyup'
 * @param {string} code  KeyboardEvent.code (also used as `key`)
 * @param {KeyboardEventInit & { target?: EventTarget }} [extra]  more event fields; `target`
 *   defaults to window
 * @returns {KeyboardEvent}
 */
function dispatchKey(type, code, extra = {}) {
  const ev = new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true, ...extra });
  (extra.target ?? window).dispatchEvent(ev);
  return ev;
}

/** Run fn with console.error captured (so intentional errors don't pollute the report). */
function captureErrors(fn) {
  const orig = console.error;
  const captured = [];
  console.error = (...a) => captured.push(a.map(String).join(' '));
  try {
    fn();
  } finally {
    console.error = orig;
  }
  return captured;
}

const tests = {
  /** A key pressed and released between two frames must still register wasPressed. */
  edgeBetweenFrames() {
    const wasRunning = engine.running;
    engine.stop();
    const seen = [];
    const probe = { name: 'probe', update: (dt, t, e) => seen.push({ pressed: e.input.wasPressed('KeyK'), down: e.input.isDown('KeyK'), released: e.input.wasReleased('KeyK') }) };
    engine.addSystem(probe, -10);
    dispatchKey('keydown', 'KeyK');
    dispatchKey('keyup', 'KeyK');
    engine.step(1 / 60);
    engine.step(1 / 60);
    engine.removeSystem(probe);
    if (wasRunning) engine.start();
    return { firstFrame: seen[0], secondFrame: seen[1], ok: seen[0].pressed && seen[0].released && !seen[0].down && !seen[1].pressed };
  },

  /** Bound keys are preventDefault-ed; unbound keys, modified keys and keys typed in inputs are not. */
  preventDefault() {
    const arrow = dispatchKey('keydown', 'ArrowDown');
    dispatchKey('keyup', 'ArrowDown');
    const unbound = dispatchKey('keydown', 'KeyK');
    dispatchKey('keyup', 'KeyK');
    const ctrlR = dispatchKey('keydown', 'KeyR', { ctrlKey: true });
    dispatchKey('keyup', 'KeyR', { ctrlKey: true });
    const field = el('input', { type: 'text' });
    document.body.append(field);
    field.focus();
    const typed = dispatchKey('keydown', 'KeyW', { target: field });
    const registered = input.isDown('KeyW');
    dispatchKey('keyup', 'KeyW', { target: field });
    field.remove();
    return {
      arrowPrevented: arrow.defaultPrevented,
      unboundPrevented: unbound.defaultPrevented,
      ctrlRPrevented: ctrlR.defaultPrevented,
      inputPrevented: typed.defaultPrevented,
      inputRegistered: registered,
      ok: arrow.defaultPrevented && !unbound.defaultPrevented && !ctrlR.defaultPrevented && !typed.defaultPrevented && !registered,
    };
  },

  /** Window blur releases every held key. */
  blurClears() {
    dispatchKey('keydown', 'KeyD');
    const before = input.isDown('KeyD');
    window.dispatchEvent(new Event('blur'));
    const after = input.isDown('KeyD');
    const releasedEdge = input.wasReleased('KeyD');
    return { before, after, releasedEdge, ok: before && !after && releasedEdge };
  },

  /** A throwing system is logged exactly once (with its name) and the loop keeps running. */
  throwingSystem() {
    const wasRunning = engine.running;
    engine.stop();
    const bomb = { name: 'Exploder', update() { throw new Error('boom'); } };
    let ticks = 0;
    const after = { name: 'after', update() { ticks++; } };
    engine.addSystem(bomb, 5);
    engine.addSystem(after, 6);
    const f0 = engine.time.frame;
    const errors = captureErrors(() => {
      for (let i = 0; i < 6; i++) engine.step(1 / 60);
    });
    engine.removeSystem(bomb);
    engine.removeSystem(after);
    if (wasRunning) engine.start();
    return {
      errorsLogged: errors.length,
      mentionsName: errors.some((e) => e.includes('Exploder')),
      framesAdvanced: engine.time.frame - f0 >= 6,
      laterSystemTicks: ticks,
      ok: errors.length === 1 && errors[0].includes('Exploder') && ticks === 6,
    };
  },

  /** Systems run in ascending order, stable for equal orders; delta clamped + scaled. */
  orderAndTime() {
    const wasRunning = engine.running;
    engine.stop();
    const calls = [];
    const mk = (n) => ({ name: n, update: () => calls.push(n), lateUpdate: () => calls.push(n + '.late') });
    const a = mk('a');
    const b = mk('b');
    const c = mk('c');
    engine.addSystem(b, 5);
    engine.addSystem(c, -5);
    engine.addSystem(a, 5);
    const evOrder = [];
    const offs = ['update', 'lateUpdate', 'beforeRender', 'afterRender'].map((e) => engine.events.on(e, () => evOrder.push(e)));
    engine.time.timeScale = 0.5;
    engine.step(0.5); // huge hitch → clamped to 1/20, then × 0.5
    const delta = engine.time.delta;
    engine.time.timeScale = 1;
    offs.forEach((off) => off());
    [a, b, c].forEach((s) => engine.removeSystem(s));
    if (wasRunning) engine.start();
    const mine = calls.filter((x) => /^[abc]/.test(x));
    return { order: mine.join(','), events: evOrder.join(','), delta, ok: mine.join(',') === 'c,b,a,c.late,b.late,a.late' && Math.abs(delta - 0.025) < 1e-9 && evOrder.join(',') === 'update,lateUpdate,beforeRender,afterRender' };
  },

  /** Camera position follows the contract formula; basis is camera-relative. */
  cameraFormula() {
    const f = rig.focusPoint;
    const p = rig.pitch;
    const y = rig.yaw;
    const d = rig.distance;
    const expected = new THREE.Vector3(f.x + Math.sin(y) * Math.cos(p) * d, f.y + Math.sin(p) * d, f.z + Math.cos(y) * Math.cos(p) * d);
    const err = rig.shakeAmount > 0 ? null : expected.distanceTo(camera.position);
    const { forward, right } = rig.getMoveBasis();
    const toFocus = new THREE.Vector3().subVectors(f, camera.position).setY(0).normalize();
    return {
      positionError: err,
      forwardDot: forward.dot(toFocus),
      orthogonal: Math.abs(forward.dot(right)) < 1e-9,
      yawUniform: globalUniforms.uCameraYaw.value === rig.yaw,
      camUniformError: globalUniforms.uCameraPosition.value.distanceTo(camera.position),
      ok: (err === null || err < 1e-4) && forward.dot(toFocus) > 0.9999,
    };
  },

  /** Simulated standard gamepad: stick → move vector, A → confirm, RB → camRight. */
  gamepad() {
    const wasRunning = engine.running;
    engine.stop();
    const btn = (pressed, value = pressed ? 1 : 0) => ({ pressed, touched: pressed, value });
    const pad = { id: 'Sandbox Virtual Pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', axes: [0.9, -0.9, 0, 0], buttons: Array.from({ length: 17 }, () => btn(false)) };
    pad.buttons[0] = btn(true);
    pad.buttons[5] = btn(true);
    pad.buttons[7] = btn(false, 0.8);
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad, null, null, null], configurable: true, writable: true });
    window.dispatchEvent(new Event('gamepadconnected'));
    const out = {};
    const probe = {
      name: 'padprobe',
      update: (dt, t, e) => {
        const mv = e.input.getMoveVector();
        out[`f${e.time.frame}`] = { mx: +mv.x.toFixed(3), my: +mv.y.toFixed(3), len: +Math.hypot(mv.x, mv.y).toFixed(3), confirm: e.input.action('confirm'), confirmPressed: e.input.actionPressed('confirm'), confirmReleased: e.input.actionReleased('confirm'), camRight: e.input.action('camRight'), run: e.input.action('run') };
      },
    };
    engine.addSystem(probe, -20);
    const yaw0 = rig.yawTarget;
    engine.step(1 / 60);
    pad.buttons[0] = btn(false);
    pad.buttons[5] = btn(false);
    pad.axes = [0.1, 0.1, 0, 0];
    engine.step(1 / 60);
    pad.connected = false;
    engine.step(1 / 60);
    engine.removeSystem(probe);
    delete navigator.getGamepads;
    window.dispatchEvent(new Event('gamepaddisconnected'));
    const frames = Object.values(out);
    const yawMoved = rig.yawTarget !== yaw0;
    rig.yawTarget = yaw0;
    if (wasRunning) engine.start();
    return {
      frames,
      yawMoved,
      connectedAfter: input.gamepad.connected,
      ok: frames[0].confirm && frames[0].confirmPressed && frames[0].camRight && frames[0].run && frames[0].len <= 1.0001 && frames[0].len > 0.9 &&
        frames[1].confirmReleased && !frames[1].confirm && frames[1].len === 0 && !input.gamepad.connected,
    };
  },

  /** Wheel accumulates within a frame and zooms the rig; it resets at endFrame. */
  wheel() {
    const before = rig.distanceTarget;
    const wasRunning = engine.running;
    engine.stop();
    renderer.domElement.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true }));
    renderer.domElement.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true }));
    const acc = input.wheelDelta;
    engine.step(1 / 60);
    const after = rig.distanceTarget;
    const reset = input.wheelDelta;
    if (wasRunning) engine.start();
    return { accumulated: acc, before, after, reset, ok: acc === 240 && after > before && reset === 0 };
  },

  /** renderScale changes the pixel ratio and emits 'resize'; container resize is observed. */
  async resize() {
    const n0 = resizeLog.length;
    const pr0 = engine.pixelRatio;
    engine.renderScale = 0.5;
    const pr1 = engine.pixelRatio;
    engine.renderScale = 1;
    app.style.right = '400px';
    await new Promise((r) => setTimeout(r, 250));
    const w1 = engine.width;
    app.style.right = '';
    await new Promise((r) => setTimeout(r, 250));
    const w2 = engine.width;
    return { pr0, pr1, shrunkWidth: w1, restoredWidth: w2, events: resizeLog.length - n0, last: resizeLog[resizeLog.length - 1], ok: Math.abs(pr1 - pr0 * 0.5) < 1e-6 && w1 === w2 - 400 && resizeLog.length - n0 >= 4 };
  },

  /** With input.enabled = false every query is false/zero, but key state is still tracked. */
  inputDisabled() {
    input.enabled = false;
    dispatchKey('keydown', 'KeyW');
    const w0 = input.wheelDelta;
    renderer.domElement.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true }));
    const mv = input.getMoveVector();
    const r = { action: input.action('up'), pressed: input.wasPressed('KeyW'), move: [mv.x, mv.y], down: input.isDown('KeyW'), wheelWhileDisabled: input.wheelDelta - w0 };
    input.enabled = true;
    r.downAfterEnable = input.isDown('KeyW');
    dispatchKey('keyup', 'KeyW');
    r.ok = !r.action && !r.pressed && !r.down && mv.x === 0 && mv.y === 0 && r.downAfterEnable && r.wheelWhileDisabled === 0;
    return r;
  },

  /** A delayed sfx must still sound (its panner used to be disconnected before it started). */
  async sfxDelay() {
    const ok = await audio.unlock();
    if (!ok) return { ok: false, reason: 'audio unavailable' };
    const an = audio.ctx.createAnalyser();
    an.fftSize = 2048;
    audio._master.connect(an);
    const buf = new Float32Array(an.fftSize);
    const t0 = performance.now();
    let peak = 0;
    audio.playSfx('splash', { delay: 1.9, volume: 1 });
    await new Promise((/** @type {(value?: void) => void} */ resolve) => {
      const iv = setInterval(() => {
        const ms = performance.now() - t0;
        if (ms > 1900) {
          an.getFloatTimeDomainData(buf);
          for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
        }
        if (ms > 2900) {
          clearInterval(iv);
          resolve();
        }
      }, 30);
    });
    audio._master.disconnect(an);
    return { peakAfterDelay: +peak.toFixed(4), ok: peak > 0.005 };
  },

  /** Everything on the AudioSystem is a silent no-op before unlock(). */
  audioBeforeUnlock() {
    const a = new AudioSystem();
    const played = a.playSfx('step');
    a.setAmbience({ wind: 1, birds: 0.5 });
    a.startMusic();
    const wanted = a.musicPlaying;
    a.masterVolume = 0.3;
    a.muted = true;
    a.musicVolume = 0.2;
    a.update(1 / 60);
    a.stopMusic();
    const r = { played, ctx: a.ctx, ready: a.ready, wantedWhileLocked: wanted, musicAfterStop: a.musicPlaying, ambience: a.ambience };
    a.dispose();
    r.ok = played === false && r.ctx === null && r.ready === false && wanted === true && r.musicAfterStop === false && r.ambience.wind === 1;
    return r;
  },

  /** Bounds clamp the focus point; look-ahead leads a moving target; snap jumps to targets. */
  rigBoundsAndLookAhead() {
    const cam = new THREE.PerspectiveCamera(28, 16 / 9, 0.5, 400);
    const r2 = new CameraRig(cam, { lookAhead: 1.2 });
    const tgt = new THREE.Vector3(50, 0, 50);
    r2.setTarget(tgt);
    r2.bounds = { minX: -5, maxX: 5, minZ: -5, maxZ: 5 };
    r2.snap();
    const clamped = [r2.focusPoint.x, r2.focusPoint.z];
    r2.bounds = null;
    tgt.set(0, 0, 0);
    r2.snap();
    for (let i = 0; i < 120; i++) {
      tgt.x += 4 / 60;
      r2.update(1 / 60);
    }
    const lead = r2.focusPoint.x - tgt.x;
    r2.rotate(10);
    const clampedYaw = r2.yawTarget * RAD2DEG;
    r2.zoom(1000);
    const maxDist = r2.distanceTarget;
    // Restore the shared uniforms for the main rig.
    rig.update(0);
    return { clamped, lookOffsetX: +r2.lookOffset.x.toFixed(3), lead: +lead.toFixed(3), clampedYaw: +clampedYaw.toFixed(2), maxDist, ok: clamped[0] === 5 && clamped[1] === 5 && r2.lookOffset.x > 0.9 && lead > 0.3 && Math.abs(clampedYaw - 60) < 1e-6 && maxDist === 36 };
  },

  /** EventEmitter semantics. */
  emitter() {
    const ev = engine.events.constructor ? new /** @type {typeof EventEmitter} */ (engine.events.constructor)() : null;
    const log = [];
    const offA = ev.on('x', (a, b) => log.push(`a${a}${b}`));
    ev.once('x', (a) => log.push(`once${a}`));
    const selfOff = ev.on('x', () => {
      log.push('self');
      selfOff();
    });
    ev.emit('x', 1, 2);
    ev.emit('x', 3, 4);
    offA();
    ev.emit('x', 5, 6);
    const many = [];
    ev.on('m', (...args) => many.push(args.length));
    ev.emit('m', 1, 2, 3, 4, 5, 6);
    ev.emit('m');
    return { log: log.join(','), many, ok: log.join(',') === 'a12,once1,self,a34' && many.join(',') === '6,0' };
  },
};

/**
 * Render the soundtrack offline and report levels (+ draw a spectrogram).
 * @param {number} [seconds]
 * @param {{ parts?: ('music'|'ambience'|'sfx')[], draw?: boolean, ambience?: object,
 *   mute?: string[] }} [opts]  `mute`: AudioSystem methods to stub out (debugging aid, e.g. '_pad')
 */
async function analyzeAudio(seconds = 16, { parts = ['music', 'ambience', 'sfx'], draw = true, ambience = null, mute = [] } = {}) {
  const sr = 44100;
  const off = new OfflineAudioContext(2, sr * seconds, sr);
  const a = new AudioSystem({ context: off });
  for (const m of mute) a[m] = () => {}; // debugging aid: silence one voice type (e.g. '_pad')
  await a.unlock();
  if (parts.includes('ambience')) a.setAmbience(ambience ?? { wind: 0.4, birds: 0.6, water: 0.3, fire: 0.3, crickets: 0.4 });
  if (parts.includes('music')) a.startMusic({ fade: 1 });
  a.prescheduleOffline(seconds);
  if (parts.includes('sfx')) SFX_NAMES.forEach((n, i) => a.playSfx(n, { delay: 0.5 + i * 0.9 }));
  const t0 = performance.now();
  const buf = await off.startRendering();
  const renderMs = Math.round(performance.now() - t0);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  let peak = 0;
  let sum = 0;
  let nan = 0;
  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    const r = R[i];
    if (!Number.isFinite(l) || !Number.isFinite(r)) nan++;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
    sum += l * l + r * r;
  }
  const rmsDb = 10 * Math.log10(sum / (L.length * 2) + 1e-12);
  const perSecond = [];
  for (let s = 0; s < seconds; s++) {
    let acc = 0;
    let pk = 0;
    for (let i = s * sr; i < (s + 1) * sr; i++) {
      acc += L[i] * L[i];
      pk = Math.max(pk, Math.abs(L[i]));
    }
    perSecond.push(`${(10 * Math.log10(acc / sr + 1e-12)).toFixed(0)}/${(20 * Math.log10(pk + 1e-9)).toFixed(0)}`);
  }
  if (draw) drawSpectrogram(L, sr, parts.join(' + '));
  const harpNotesCached = a._harpCache.size;
  a.dispose();
  return { parts: parts.join('+'), seconds, renderMs, peakDb: +(20 * Math.log10(peak + 1e-9)).toFixed(1), rmsDb: +rmsDb.toFixed(1), nan, perSecondRmsPeakDb: perSecond.join(' '), harpNotesCached };
}

function drawSpectrogram(data, sr, label = '') {
  const N = 2048;
  const hop = 1024;
  const frames = Math.floor((data.length - N) / hop);
  const H = 220;
  const cv = el('canvas', { width: frames, height: H });
  Object.assign(cv.style, { position: 'fixed', left: '360px', right: '320px', bottom: '64px', height: '240px', width: 'calc(100% - 680px)', zIndex: 20, imageRendering: 'pixelated', border: '1px solid rgba(201,164,92,0.6)', background: '#000' });
  const g = cv.getContext('2d');
  const img = g.createImageData(frames, H);
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  const win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  const fMin = 60;
  const fMax = 9000;
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < N; i++) {
      re[i] = data[f * hop + i] * win[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let y = 0; y < H; y++) {
      const freq = fMin * (fMax / fMin) ** (1 - y / (H - 1));
      const bin = Math.min(N / 2 - 1, Math.round((freq / sr) * N));
      const mag = (Math.hypot(re[bin], im[bin]) * 4) / N; // Hann-normalised amplitude
      const db = 20 * Math.log10(mag + 1e-9);
      const v = clamp((db + 84) / 66, 0, 1);
      const [r, gg, b] = mixColor('#07060d', v > 0.5 ? mixColor('#c9643c', '#fff3c0', (v - 0.5) * 2) : mixColor('#07060d', '#c9643c', v * 2), 1);
      const o = (y * frames + f) * 4;
      img.data[o] = r;
      img.data[o + 1] = gg;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  g.font = '12px sans-serif';
  g.fillStyle = '#f3e2b5';
  g.fillText(`${label} · 60 Hz–9 kHz (log)`, 6, 14);
  cv.id = 'spectrogram';
  document.getElementById('spectrogram')?.remove();
  document.body.append(cv);
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k + len / 2] = re[i + k] - ar;
        im[i + k + len / 2] = im[i + k] - ai;
        re[i + k] += ar;
        im[i + k] += ai;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

/** Exercise every sound on the live context; returns what played. */
async function exerciseAudio() {
  const ok = await audio.unlock();
  attachScope();
  unlockBtn.textContent = ok ? 'Audio ready' : 'Audio unavailable';
  unlockBtn.classList.toggle('on', ok);
  const played = {};
  SFX_NAMES.forEach((n, i) => (played[n] = audio.playSfx(n, { delay: i * 0.25 })));
  audio.setAmbience({ wind: 0.5, birds: 0.7, crickets: 0.4, fire: 0.5, water: 0.6 });
  syncAmbSliders();
  if (!audio.musicPlaying) musicBtn.click();
  return { ready: audio.ready, state: audio.ctx?.state, played, musicPlaying: audio.musicPlaying };
}

function runAllTests() {
  const out = {};
  for (const [k, fn] of Object.entries(tests)) {
    if (k === 'resize' || k === 'sfxDelay') continue; // async — run separately
    try {
      out[k] = fn();
    } catch (err) {
      out[k] = { ok: false, error: String(err?.stack ?? err) };
    }
  }
  out.allOk = Object.values(out).every((r) => r.ok);
  return out;
}

function teardown() {
  audio.dispose();
  for (const d of disposables) d.dispose?.();
  engine.dispose();
  return {
    canvasRemoved: !document.querySelector('canvas.luminati-canvas'),
    engineGlobalCleared: window.__engine === undefined,
    audioClosed: audio.ctx === null,
  };
}

/**
 * `window.__core` (AUTOMATION_API.md §7), read by sandbox/core*.actions.json.
 * @typedef {object} CoreHandle
 * @property {Engine} engine
 * @property {CameraRig} rig
 * @property {AudioSystem} audio
 * @property {Engine['input']} input
 * @property {THREE.Group} marker  the controllable save-crystal marker
 * @property {typeof THREE} THREE
 * @property {typeof tests} tests  the self-tests by name; each returns `{ ok, … }` (`resize` and
 *   `sfxDelay` are async)
 * @property {typeof runAllTests} runAllTests  every sync test: `{ [name]: result, allOk }`
 * @property {typeof analyzeAudio} analyzeAudio  offline soundtrack render with levels
 * @property {typeof exerciseAudio} exerciseAudio  play every sound on the live context
 * @property {typeof teardown} teardown  dispose everything and report what was cleaned up
 * @property {typeof state} state  heading, speed, stepDist, showFocus, lastPressed, log
 * @property {{ width: number, height: number, pixelRatio: number }[]} resizeLog  every Engine
 *   'resize' event
 * @property {typeof dispatchKey} dispatchKey  dispatch a synthetic KeyboardEvent
 */
window.__core = { engine, rig, audio, input, marker, THREE, tests, runAllTests, analyzeAudio, exerciseAudio, teardown, state, resizeLog, dispatchKey };
