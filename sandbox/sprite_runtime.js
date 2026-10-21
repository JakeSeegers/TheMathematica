/**
 * Sandbox for the sprite runtime (Sprite3D, SpriteManager, Foliage) and Particles.
 * Uses raw three.js + shared foundation files only; art is generated locally with PixelCanvas.
 *
 * window.__sb exposes handles for scripted checks:
 *   setNight(0..1), setYaw(deg), setView(name|{focus,yaw,pitch,dist}), weather('rain'|'snow'|null),
 *   stats(), textureStats(), spawnSprites(n) (async → upload stats), showSheet(bool), freeze(bool)
 */
import * as THREE from 'three';
import { PPU, DIRECTIONS } from '../src/engine/constants.js';
import { RNG, DEG2RAD, clamp, lerp, fbm2 } from '../src/engine/utils/math.js';
import { globalUniforms } from '../src/engine/render/GlobalUniforms.js';
import { PixelCanvas, makePixelTexture, shadeColor, parseColor, toCss } from '../src/engine/pixel/PixelCanvas.js';
import { PALETTE } from '../src/engine/pixel/Palette.js';
import { Sprite3D } from '../src/engine/sprite/Sprite3D.js';
import { SpriteManager } from '../src/engine/sprite/SpriteManager.js';
import { Foliage } from '../src/engine/sprite/Foliage.js';
import { Particles, PARTICLE_PRESETS } from '../src/engine/fx/Particles.js';

/**
 * @import { SpriteSheet, PropSheet } from '../src/engine/sprite/Sprite3D.js'
 * @import { FoliageSprite } from '../src/engine/sprite/Foliage.js'
 */

// ---------------------------------------------------------------------------
// Renderer / GL upload counter
// ---------------------------------------------------------------------------

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap is deprecated in r186 (falls back with a warning)
app.appendChild(renderer.domElement);

const gl = renderer.getContext();
const uploads = { texImage2D: 0, texSubImage2D: 0, texStorage2D: 0 };
for (const fn of Object.keys(uploads)) {
  const orig = gl[fn].bind(gl);
  gl[fn] = (...args) => { uploads[fn]++; return orig(...args); };
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, 0.5, 400);

// ---------------------------------------------------------------------------
// Procedural test art
// ---------------------------------------------------------------------------

const OUT = PALETTE.outline;
const SKIN = PALETTE.skinLight;
const HAIR = PALETTE.hairBrown;
const PANTS = PALETTE.brown;
const BOOTS = PALETTE.wood;
const GOLD = PALETTE.gold;
const TUNIC = { down: PALETTE.red, left: PALETTE.blue, right: PALETTE.green, up: PALETTE.purple };
const ACCENT = ['#ffffff', '#c9c9dc', '#ffd84a', '#5ad2ff', '#ff6ad5', '#8cff6a']; // per column: idle0, idle1, walk0..3

function drawLegFront(pc, x, lift, dark) {
  const p = dark ? PANTS[1] : PANTS[2];
  const b = dark ? BOOTS[1] : BOOTS[2];
  const y0 = 25 - lift;
  pc.rect(x, y0, 3, 3, p);
  pc.set(x + 2, y0, PANTS[1]);
  pc.rect(x, y0 + 3, 3, 3, b);
  pc.set(x, y0 + 3, BOOTS[3]);
}

function drawHeadFront(pc, oy, back) {
  pc.ellipse(15.5, 10 + oy, 5.5, 5, SKIN[3]);
  // skin shading
  for (let y = 5; y <= 15; y++) {
    pc.set(20, y + oy, pc.getAlpha(20, y + oy) ? SKIN[2] : null);
    pc.set(21, y + oy, pc.getAlpha(21, y + oy) ? SKIN[2] : null);
  }
  pc.hline(12, 19, 15 + oy, SKIN[2]);
  // hair cap
  const hairRows = back ? 10 : 3;
  for (let y = 5; y <= 5 + hairRows; y++) {
    for (let x = 10; x <= 21; x++) {
      if (!pc.getAlpha(x, y + oy)) continue;
      const edge = x >= 19 ? HAIR[1] : x <= 12 && y < 8 ? HAIR[3] : HAIR[2];
      pc.set(x, y + oy, edge);
    }
  }
  if (!back) {
    // fringe
    for (const x of [11, 12, 14, 15, 17, 19, 20]) pc.set(x, 14 - 5 + oy, HAIR[2]);
    pc.set(13, 9 + oy, HAIR[1]);
    pc.set(18, 9 + oy, HAIR[1]);
    // side locks
    for (let y = 10; y <= 13; y++) { pc.set(10, y + oy, HAIR[2]); pc.set(21, y + oy, HAIR[1]); }
    // face
    pc.set(13, 11 + oy, '#2a1a22'); pc.set(13, 12 + oy, '#2a1a22');
    pc.set(18, 11 + oy, '#2a1a22'); pc.set(18, 12 + oy, '#2a1a22');
    pc.set(12, 13 + oy, '#e79a86'); pc.set(19, 13 + oy, '#e79a86');
    pc.set(15, 14 + oy, SKIN[1]); pc.set(16, 14 + oy, SKIN[1]);
    pc.set(12, 10 + oy, SKIN[4]);
  } else {
    // back of head: hair highlights + nape
    pc.hline(12, 15, 6 + oy, HAIR[3]);
    pc.set(13, 9 + oy, HAIR[3]); pc.set(16, 11 + oy, HAIR[1]); pc.set(14, 13 + oy, HAIR[1]);
    pc.hline(13, 18, 15 + oy, HAIR[1]);
  }
  // hair highlight sheen
  pc.set(12, 6 + oy, HAIR[4]); pc.set(13, 6 + oy, HAIR[4]); pc.set(14, 7 + oy, HAIR[3]);
}

function drawTorsoFront(pc, oy, T, col, armL, armR, back) {
  // tunic
  for (let y = 17; y <= 24; y++) {
    const x0 = y === 21 ? 13 : 12;
    const x1 = y === 21 ? 19 : 20;
    for (let x = x0; x <= x1; x++) {
      let c = T[3];
      if (x <= 13 && y < 21) c = T[4];
      if (x >= 19) c = T[2];
      if (y === 24) c = T[2];
      if (x === 16 && y >= 22) c = T[1];
      pc.set(x, y + oy, c);
    }
  }
  // belt
  pc.hline(13, 19, 21 + oy, GOLD[2]);
  pc.set(16, 21 + oy, GOLD[4]);
  // arms (swing ±1 px)
  const arm = (x, sw, shade) => {
    for (let y = 17; y <= 20; y++) { pc.set(x, y + oy + sw, shade ? T[1] : T[2]); pc.set(x + 1, y + oy + sw, shade ? T[2] : T[3]); }
    pc.rect(x, 21 + oy + sw, 2, 2, shade ? SKIN[2] : SKIN[3]);
  };
  arm(10, armL, false);
  arm(21, armR, true);
  // scarf / frame accent (colour changes per animation column)
  const a = ACCENT[col];
  pc.hline(12, 20, 16 + oy, a);
  pc.hline(13, 19, 17 + oy, shadeColor(a, -0.25));
  if (!back) { pc.set(18, 18 + oy, shadeColor(a, -0.3)); pc.set(18, 19 + oy + (col % 2), shadeColor(a, -0.4)); }
  else { pc.set(14, 18 + oy, shadeColor(a, -0.3)); pc.set(14, 19 + oy + (col % 2), shadeColor(a, -0.4)); }
}

function drawSide(pc, oy, T, col, walk, ph) {
  // legs (left-facing: -x is forward)
  const stride = walk && (ph === 0 || ph === 2);
  const backX = stride ? 17 : 16;
  const frontX = stride ? 12 : 14;
  const leg = (x, dark, lift) => {
    const y0 = 25 - lift;
    pc.rect(x, y0, 3, 3, dark ? PANTS[1] : PANTS[2]);
    pc.rect(x, y0 + 3, 3, 3, dark ? BOOTS[1] : BOOTS[2]);
    pc.set(x - 1, y0 + 5, dark ? BOOTS[1] : BOOTS[2]); // toe
    pc.set(x, y0 + 3, dark ? BOOTS[2] : BOOTS[3]);
  };
  leg(backX, true, walk && ph === 1 ? 1 : 0);
  leg(frontX, false, walk && ph === 3 ? 1 : 0);
  // tunic
  for (let y = 17; y <= 24; y++) {
    const x0 = y >= 22 ? 12 : 13;
    const x1 = y >= 22 ? 19 : 19;
    for (let x = x0; x <= x1; x++) {
      let c = T[3];
      if (x <= 14 && y < 21) c = T[4];
      if (x >= 18) c = T[2];
      if (y === 24) c = T[2];
      pc.set(x, y + oy, c);
    }
  }
  pc.hline(13, 19, 21 + oy, GOLD[2]);
  pc.set(13, 21 + oy, GOLD[4]);
  // head
  pc.ellipse(15.5, 10 + oy, 5.5, 5, SKIN[3]);
  for (let y = 5; y <= 15; y++) {
    for (let x = 14; x <= 21; x++) {
      if (!pc.getAlpha(x, y + oy)) continue;
      if (y <= 13 || x >= 17) pc.set(x, y + oy, x >= 19 ? HAIR[1] : HAIR[2]);
    }
    for (let x = 10; x <= 13; x++) if (pc.getAlpha(x, y + oy) && y <= 8) pc.set(x, y + oy, y <= 6 ? HAIR[3] : HAIR[2]);
  }
  pc.set(10, 9 + oy, HAIR[2]); pc.set(11, 9 + oy, HAIR[1]);
  pc.set(12, 11 + oy, '#2a1a22'); pc.set(12, 12 + oy, '#2a1a22');
  pc.set(12, 13 + oy, '#e79a86');
  pc.set(9, 12 + oy, SKIN[3]); // nose
  pc.set(11, 14 + oy, SKIN[1]);
  pc.set(13, 6 + oy, HAIR[4]); pc.set(14, 6 + oy, HAIR[4]);
  // scarf with a fluttering tail (secondary motion)
  const a = ACCENT[col];
  pc.hline(12, 19, 16 + oy, a);
  pc.hline(13, 19, 17 + oy, shadeColor(a, -0.25));
  const flutter = walk ? ph % 2 : 0;
  pc.set(20, 17 + oy - flutter, a);
  pc.set(21, 18 + oy - flutter, shadeColor(a, -0.25));
  pc.set(22, 18 + oy - flutter * 2, shadeColor(a, -0.4));
  // near arm swinging
  const swing = walk ? [-2, 0, 2, 0][ph] : 0;
  for (let y = 17; y <= 20; y++) { pc.set(15 + swing, y + oy, T[2]); pc.set(16 + swing, y + oy, T[3]); }
  pc.rect(15 + swing, 21 + oy, 2, 2, SKIN[3]);
}

function drawFrame(dir, col) {
  const pc = new PixelCanvas(32, 32);
  const T = TUNIC[dir];
  const walk = col >= 2;
  const ph = walk ? col - 2 : col;
  let bob = 0;
  if (!walk && ph === 1) bob = 1;
  if (walk && (ph === 1 || ph === 3)) bob = -1;
  if (dir === 'left' || dir === 'right') {
    drawSide(pc, bob, T, col, walk, ph);
  } else {
    const back = dir === 'up';
    drawLegFront(pc, 13, walk && ph === 0 ? 1 : 0, false);
    drawLegFront(pc, 17, walk && ph === 2 ? 1 : 0, true);
    const armL = walk ? [1, 0, -1, 0][ph] : 0;
    drawTorsoFront(pc, bob, T, col, armL, -armL, back);
    drawHeadFront(pc, bob, back);
  }
  pc.outline(OUT);
  return dir === 'right' ? pc.flippedX() : pc;
}

/**
 * Build a SpriteSheet matching the CharacterSprites typedef.
 * @returns {SpriteSheet & { canvas: HTMLCanvasElement }}
 */
function makeTestSheet() {
  const FW = 32, FH = 32, COLS = 6, ROWS = 4;
  const sheet = new PixelCanvas(FW * COLS, FH * ROWS);
  DIRECTIONS.forEach((dir, row) => {
    for (let col = 0; col < COLS; col++) sheet.blit(drawFrame(dir, col), col * FW, row * FH);
  });
  const canvas = sheet.toCanvas();
  const texture = makePixelTexture(canvas, { wrap: 'clamp', mipmaps: false, name: 'test_character_sheet' });
  const animations = {};
  DIRECTIONS.forEach((d, row) => {
    animations[`idle_${d}`] = { frames: [{ col: 0, row }, { col: 1, row }], fps: 2.5, loop: true };
    const walk = [2, 3, 4, 5].map((col) => ({ col, row }));
    animations[`walk_${d}`] = { frames: walk, fps: 8, loop: true };
    animations[`run_${d}`] = { frames: walk, fps: 13, loop: true };
  });
  return { texture, canvas, frameWidth: FW, frameHeight: FH, columns: COLS, rows: ROWS, pixelsPerUnit: PPU, anchor: [0.5, 0], animations };
}

/**
 * Foliage strip: 4 frames of 16x16 (tuft A, tuft B, tall grass, flowers).
 * @returns {FoliageSprite}
 */
function makeFoliageSprite() {
  const N = 16;
  const pc = new PixelCanvas(N * 4, N);
  const rng = new RNG(4242);
  const G = PALETTE.grass;
  const blade = (ox, x0, h, lean, bright) => {
    const x1 = x0 + lean;
    const steps = h;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(lerp(x0, x1, t * t));
      const y = N - 1 - i;
      const ci = t < 0.25 ? 1 : t < 0.6 ? 2 + bright : Math.min(5, 3 + bright);
      pc.set(ox + x, y, G[ci]);
      if (i < steps * 0.35) pc.set(ox + x + 1, y, G[t < 0.15 ? 1 : 2]);
    }
  };
  const tuft = (ox, count, hMin, hMax) => {
    for (let i = 0; i < count; i++) {
      const x0 = 4 + Math.floor(rng.next() * 7);
      const h = hMin + Math.floor(rng.next() * (hMax - hMin + 1));
      const lean = Math.round((x0 - 7.5) * 0.6 + (rng.next() * 2 - 1) * 1.5);
      blade(ox, x0, h, lean, rng.next() < 0.5 ? 1 : 0);
    }
  };
  tuft(0, 7, 5, 9);
  tuft(N, 9, 4, 8);
  tuft(N * 2, 8, 9, 14);
  tuft(N * 3, 6, 4, 8);
  const flowers = [['#fff4f0', '#f2c94c'], ['#ffd84a', '#c9731f'], ['#f7a8c4', '#fff0a0']];
  const fpos = [[5, 6], [10, 8], [8, 4]];
  fpos.forEach(([x, y], i) => {
    const [petal, center] = flowers[i];
    const ox = N * 3;
    pc.set(ox + x, y + 1, G[3]); pc.set(ox + x, y + 2, G[3]); pc.set(ox + x, y + 3, G[2]);
    pc.set(ox + x - 1, y, petal); pc.set(ox + x + 1, y, petal); pc.set(ox + x, y - 1, petal); pc.set(ox + x, y + 1, petal);
    pc.set(ox + x, y, center);
  });
  const texture = makePixelTexture(pc.toCanvas(), { wrap: 'clamp', mipmaps: false, name: 'test_foliage' });
  return { texture, width: N, height: N, pixelsPerUnit: PPU, anchor: [0.5, 0], frames: 4 };
}

function makeGrassTexture() {
  const N = 64;
  const pc = new PixelCanvas(N, N);
  pc.wrap = true;
  const G = PALETTE.grass;
  pc.fillNoise([G[1], G[2], G[2], G[3], G[3], G[4]], { scale: 4, period: 4, seed: 11, octaves: 4, dither: 0.8 });
  const rng = new RNG(99);
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(rng.next() * N);
    const y = Math.floor(rng.next() * N);
    const v = fbm2(x / 16, y / 16, { seed: 5, period: 4 });
    const c = v > 0.52 ? G[4] : G[3];
    pc.set(x, y, c);
    pc.set(x, y + 1, shadeColor(c, -0.25));
    if (rng.next() < 0.2) pc.set(x + 1, y - 1, G[5]);
  }
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(rng.next() * N);
    const y = Math.floor(rng.next() * N);
    pc.set(x, y, rng.next() < 0.5 ? '#f3efe0' : '#f2d45a');
  }
  const tex = makePixelTexture(pc.toCanvas(), { wrap: 'repeat', mipmaps: true, anisotropy: 4, name: 'test_grass' });
  return tex;
}

function makeStoneTexture() {
  const N = 32;
  const pc = new PixelCanvas(N, N);
  pc.wrap = true;
  const S = PALETTE.stoneWarm;
  pc.fillNoise([S[2], S[3], S[3], S[4]], { scale: 3, period: 3, seed: 3, dither: 0.7 });
  const rng = new RNG(7);
  // flagstones: 2x2 per texture, jittered mortar
  for (let k = 0; k < 2; k++) {
    const y = k * 16;
    pc.hline(0, N - 1, y, S[1]);
    for (let j = 0; j < 2; j++) {
      const x = j * 16 + (k ? 8 : 0);
      pc.vline(x, y, y + 15, S[1]);
    }
  }
  for (let i = 0; i < 40; i++) pc.set(Math.floor(rng.next() * N), Math.floor(rng.next() * N), S[5]);
  // top-left bevel highlight
  for (let k = 0; k < 2; k++) pc.hline(1, N - 2, k * 16 + 1, S[4]);
  return makePixelTexture(pc.toCanvas(), { wrap: 'repeat', mipmaps: true, anisotropy: 4, name: 'test_stone' });
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

const sheet = makeTestSheet();
/** @type {HTMLCanvasElement} */ (document.getElementById('sheet')).width = sheet.canvas.width;
/** @type {HTMLCanvasElement} */ (document.getElementById('sheet')).height = sheet.canvas.height;
/** @type {HTMLCanvasElement} */ (document.getElementById('sheet')).getContext('2d').drawImage(sheet.canvas, 0, 0);
document.getElementById('sheet').style.width = `${sheet.canvas.width * 3}px`;

const grassTex = makeGrassTexture();
grassTex.repeat.set(60 / 4, 60 / 4);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshLambertMaterial({ map: grassTex }));
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, 0, -6);
ground.receiveShadow = true;
scene.add(ground);

const stoneTex = makeStoneTexture();
const stoneMat = new THREE.MeshLambertMaterial({ map: stoneTex });
const woodMat = new THREE.MeshLambertMaterial({ color: '#6b4a32' });
const darkWoodMat = new THREE.MeshLambertMaterial({ color: '#3c2a1e' });

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

// Lights
const sun = new THREE.DirectionalLight('#ffb36b', 4.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -22;
sun.shadow.camera.right = 22;
sun.shadow.camera.top = 22;
sun.shadow.camera.bottom = -22;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 90;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.025;
sun.shadow.radius = 3;
scene.add(sun, sun.target);

const hemi = new THREE.HemisphereLight('#a9c8ff', '#5d4a34', 0.8);
scene.add(hemi);

const lantern = new THREE.PointLight('#ffb46b', 2, 9, 2);
lantern.position.set(3.4, 2.15, 2.9);
scene.add(lantern);
box(0.14, 2.0, 0.14, darkWoodMat, 3.4, 1.0, 2.9);
box(0.5, 0.08, 0.14, darkWoodMat, 3.3, 2.0, 2.9);
const lanternGlassMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc27a').multiplyScalar(2.2) });
const lanternBox = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.22), lanternGlassMat);
lanternBox.position.set(3.4, 2.1 - 0.22, 2.9);
lanternBox.position.set(3.14, 1.8, 2.9);
scene.add(lanternBox);

const SUN_DAY = new THREE.Vector3(-0.78, 0.42, 0.46).normalize();
const SUN_NIGHT = new THREE.Vector3(-0.45, 0.72, 0.3).normalize();

// ---------------------------------------------------------------------------
// Particle zones (4 x 3 grid)
// ---------------------------------------------------------------------------

const particles = new Particles(scene);
const emitters = {};
const zoneCenters = {};
const ZONES = [
  ['dust', 'fireflies', 'embers', 'smoke'],
  ['leaves', 'petals', 'rain', 'snow'],
  ['mist', 'footstep', 'splash', 'sparkle'],
];
const ZX = [-8.4, -2.8, 2.8, 8.4];
const ZZ = [-20.5, -13.75, -7];
const pointLights = [];

ZONES.forEach((row, ri) => row.forEach((name, ci) => {
  const x = ZX[ci];
  const z = ZZ[ri];
  zoneCenters[name] = new THREE.Vector3(x, 0, z);
  box(4.4, 0.1, 3.8, stoneMat, x, 0.05, z).castShadow = false;
  const top = 0.1;
  const P = (dx, dy, dz) => new THREE.Vector3(x + dx, top + dy, z + dz);
  switch (name) {
    case 'dust':
      emitters.dust = particles.createEmitter({ preset: 'dust', bounds: { center: P(0, 1.5, 0), size: [3.8, 3, 3.4] }, count: 60 });
      break;
    case 'fireflies': {
      emitters.fireflies = particles.createEmitter({ preset: 'fireflies', bounds: { center: P(0, 1.1, 0), size: [3.8, 1.8, 3.2] }, count: 30 });
      break;
    }
    case 'embers': {
      // campfire: logs, glowing core, light
      const l1 = box(1.0, 0.16, 0.18, darkWoodMat, x, top + 0.1, z); l1.rotation.y = 0.6;
      const l2 = box(1.0, 0.16, 0.18, darkWoodMat, x, top + 0.14, z); l2.rotation.y = -0.6;
      const fire = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9a3c').multiplyScalar(2.5) }));
      fire.position.copy(P(0, 0.4, 0));
      scene.add(fire);
      const fl = new THREE.PointLight('#ff9448', 3, 7, 2);
      fl.position.copy(P(0, 0.8, 0));
      scene.add(fl);
      pointLights.push({ light: fl, day: 3, night: 12 });
      emitters.embers = particles.createEmitter({ preset: 'embers', position: P(0, 0.35, 0) });
      break;
    }
    case 'smoke': {
      box(0.8, 2.2, 0.8, stoneMat, x, top + 1.1, z);
      emitters.smoke = particles.createEmitter({ preset: 'smoke', position: P(0, 2.3, 0) });
      break;
    }
    case 'leaves':
    case 'petals': {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.18, 1.8, 7), woodMat);
      trunk.position.copy(P(-1.2, 0.9, -1.1)); trunk.castShadow = true; scene.add(trunk);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), new THREE.MeshLambertMaterial({ color: name === 'leaves' ? '#c8622c' : '#f0a3bf', flatShading: true }));
      crown.position.copy(P(-1.2, 2.1, -1.1)); crown.castShadow = true; scene.add(crown);
      emitters[name] = particles.createEmitter({ preset: name, bounds: { center: P(0, 1.4, 0), size: [3.8, 2.8, 3.4] }, count: name === 'leaves' ? 16 : 24 });
      break;
    }
    case 'rain':
      emitters.rain = particles.createEmitter({ preset: 'rain', followCamera: false, bounds: { center: P(0, 2.0, 0), size: [3.8, 4.0, 3.2] }, count: 320 });
      break;
    case 'snow':
      emitters.snow = particles.createEmitter({ preset: 'snow', followCamera: false, bounds: { center: P(0, 2.0, 0), size: [3.8, 4.0, 3.2] }, count: 200 });
      break;
    case 'mist': {
      box(4.2, 1.8, 0.6, stoneMat, x, top + 0.9, z - 1.55);
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), new THREE.MeshLambertMaterial({ color: '#8fd0ee', emissive: '#3d7fa6', emissiveIntensity: 0.5 }));
      fall.position.copy(P(0, 0.9, -1.23)); scene.add(fall);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(1.3, 20), new THREE.MeshLambertMaterial({ color: '#3f8fb8' }));
      pool.rotation.x = -Math.PI / 2; pool.position.copy(P(0, 0.01, -0.3)); scene.add(pool);
      emitters.mist = particles.createEmitter({ preset: 'mist', position: P(0, 0.2, -0.6), spawnSize: [1.4, 0.3, 0.3] });
      break;
    }
    case 'splash': {
      const pool = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), new THREE.MeshLambertMaterial({ color: '#3f8fb8' }));
      pool.rotation.x = -Math.PI / 2; pool.position.copy(P(0, 0.012, 0)); scene.add(pool);
      break;
    }
    case 'sparkle': {
      box(1.0, 0.6, 0.7, woodMat, x, top + 0.3, z);
      box(1.04, 0.1, 0.74, new THREE.MeshLambertMaterial({ color: '#d6a33a' }), x, top + 0.62, z);
      emitters.sparkle = particles.createEmitter({ preset: 'sparkle', bounds: { center: P(0, 1.0, 0), size: [2.4, 1.2, 1.8] }, count: 8, life: [0.6, 1.4] });
      break;
    }
    default:
      break;
  }
}));

// Labels
const labels = [];
for (const name of Object.keys(zoneCenters)) {
  const el = document.createElement('div');
  el.className = 'zone-label';
  el.textContent = name;
  document.body.appendChild(el);
  labels.push({ el, pos: zoneCenters[name].clone().add(new THREE.Vector3(0, 0.1, 1.9)) });
}

// ---------------------------------------------------------------------------
// Sprites
// ---------------------------------------------------------------------------

const spriteManager = new SpriteManager(camera);
const walkers = [];

function addWalker({ cx, cz, r, speed, ccw = false, run = false, opts = {}, phase = 0, y = 0 }) {
  const s = new Sprite3D(sheet, opts);
  scene.add(s);
  spriteManager.add(s);
  const w = { sprite: s, cx, cz, r, speed, ccw, run, angle: phase, fade: false, y };
  s.onFrameChange = (f, anim) => {
    if ((anim.startsWith('walk') || anim.startsWith('run')) && (f === 0 || f === 2)) {
      particles.burst('footstep', s.position, 3);
    }
  };
  walkers.push(w);
  return w;
}

const walkerA = addWalker({ cx: -6.2, cz: 1.4, r: 1.7, speed: 1.6, phase: 0 });
const walkerB = addWalker({ cx: -1.6, cz: 1.6, r: 1.8, speed: 3.2, ccw: true, run: true, phase: 1.5, opts: { tilt: 0.35 } });
const walkerC = addWalker({ cx: 2.2, cz: 0.4, r: 1.3, speed: 1.3, phase: 3.0, opts: { tint: '#d8e4ff', ditherMode: 'texel' } });
walkerC.fade = true;
const walkerD = addWalker({ cx: 6.6, cz: 1.4, r: 1.6, speed: 1.5, ccw: true, phase: 4.2, opts: { shadowMode: 'billboard' } });
const walkerE = addWalker({ cx: ZX[1], cz: ZZ[2], r: 1.0, speed: 1.4, phase: 0.8, y: 0.1 }); // footstep zone walker

const idler = new Sprite3D(sheet, { emissive: '#6ab8ff', emissiveIntensity: 0.0 });
idler.position.set(2.7, 0, 3.4);
scene.add(idler);
spriteManager.add(idler);
idler.play('idle_down');

// Floating spirit: spherical billboard, emissive (glows with its own colours), no contact blob.
const spirit = new Sprite3D(sheet, { billboard: 'spherical', emissive: '#9fd4ff', emissiveIntensity: 0.9, tint: '#a8c8ff', blobShadow: false, scale: 0.7 });
spirit.position.set(5.4, 1.2, 3.8);
scene.add(spirit);
spriteManager.add(spirit);
spirit.play('idle_down', { speed: 1.6 });

// Fixed-orientation sprite ('none' billboard, mirrored, manual frame) — e.g. a painted standee.
const standee = new Sprite3D(sheet, { billboard: 'none', lit: false, tint: '#d8d0c4' });
standee.position.set(-3.9, 0, 4.6);
standee.rotation.y = 0.55;
standee.flipX = true;
standee.setFrame(0, 2);
scene.add(standee);
spriteManager.add(standee);

// ---------------------------------------------------------------------------
// Foliage (~3000 tufts in one draw call)
// ---------------------------------------------------------------------------

const foliageSprite = makeFoliageSprite();
const tufts = [];
{
  const rng = new RNG(2024);
  const blocked = (x, z) => {
    for (const c of Object.values(zoneCenters)) if (Math.abs(x - c.x) < 2.4 && Math.abs(z - c.z) < 2.1) return true;
    for (const w of walkers) if (Math.abs(Math.hypot(x - w.cx, z - w.cz) - w.r) < 0.7) return true;
    if (Math.hypot(x - 3.3, z - 3.0) < 0.6) return true;
    if (Math.hypot(x + 3.9, z - 4.6) < 0.7) return true;
    return false;
  };
  let guard = 0;
  while (tufts.length < 3000 && guard++ < 200000) {
    const x = rng.range(-19, 19);
    const z = rng.range(-26, 8.5);
    if (blocked(x, z)) continue;
    // clumpy distribution with open meadow patches
    const density = fbm2(x * 0.16 + 10, z * 0.16 + 3, { seed: 8 });
    if (rng.next() > (density - 0.38) * 3.2) continue;
    const r = rng.next();
    const frame = r < 0.42 ? 0 : r < 0.76 ? 1 : r < 0.86 ? 2 : 3;
    tufts.push({ x, y: 0, z, scale: rng.range(0.62, 0.95), frame, tint: rng.next() < 0.3 ? '#d8f0a0' : '#ffffff' });
  }
}
const foliage = new Foliage({ sprite: foliageSprite, instances: tufts, wind: 1, castShadow: false });
scene.add(foliage.object);

// ---------------------------------------------------------------------------
// Camera, day/night, weather
// ---------------------------------------------------------------------------

const VIEWS = {
  overview: { focus: [0, 0, -8.4], yaw: 0, pitch: 32, dist: 40 },
  plaza: { focus: [0, 0, 1.6], yaw: 0, pitch: 30, dist: 15 },
  zones: { focus: [0, 0, -13.75], yaw: 0, pitch: 34, dist: 27 },
  rowFar: { focus: [0, 0, -20.5], yaw: 0, pitch: 32, dist: 18 },
  rowMid: { focus: [0, 0, -13.75], yaw: 0, pitch: 32, dist: 18 },
  rowNear: { focus: [0, 0, -7], yaw: 0, pitch: 32, dist: 18 },
  dust: { focus: [-8.4, 1, -20.5], yaw: 0, pitch: 30, dist: 9 },
  fireflies: { focus: [-2.8, 1, -20.5], yaw: 0, pitch: 30, dist: 9 },
  embers: { focus: [2.8, 1, -20.5], yaw: 0, pitch: 30, dist: 9 },
  rain: { focus: [2.8, 1, -13.75], yaw: 0, pitch: 30, dist: 9 },
  lantern: { focus: [2.6, 0, 2.6], yaw: 0, pitch: 30, dist: 9 },
  rotated: { focus: [0, 0, -4.5], yaw: 40, pitch: 32, dist: 30 },
};
const view = { focus: new THREE.Vector3(), yaw: 0, pitch: 32 * DEG2RAD, dist: 24 };
/**
 * @param {string|{ focus?: number[], yaw?: number, pitch?: number, dist?: number }} v  a `VIEWS`
 *   name or a view (yaw / pitch in degrees)
 * @returns {boolean} false for an unknown name
 */
function setView(v) {
  const p = typeof v === 'string' ? VIEWS[v] : v;
  if (!p) return false;
  if (p.focus) view.focus.fromArray(p.focus);
  if (p.yaw != null) view.yaw = p.yaw * DEG2RAD;
  if (p.pitch != null) view.pitch = p.pitch * DEG2RAD;
  if (p.dist != null) view.dist = p.dist;
  return true;
}
setView('overview');

let night = 0;
function applyTimeOfDay() {
  const n = night;
  globalUniforms.uNight.value = n;
  const sunDir = globalUniforms.uSunDirection.value.copy(SUN_DAY).lerp(SUN_NIGHT, n).normalize();
  sun.color.set('#ffb36b').lerp(new THREE.Color('#8ea6ff'), n);
  sun.intensity = lerp(4.2, 0.6, n);
  globalUniforms.uSunColor.value.copy(sun.color).multiplyScalar(sun.intensity / 3.5);
  hemi.color.set('#a9c8ff').lerp(new THREE.Color('#2a3c78'), n);
  hemi.groundColor.set('#5d4a34').lerp(new THREE.Color('#10121e'), n);
  hemi.intensity = lerp(0.8, 0.55, n);
  lantern.intensity = lerp(1.5, 16, n);
  lanternGlassMat.color.set('#ffc27a').multiplyScalar(lerp(1.2, 3.2, n));
  for (const p of pointLights) p.light.intensity = lerp(p.day, p.night, n);
  const fogCol = new THREE.Color('#e3bf95').lerp(new THREE.Color('#0d1428'), n);
  scene.fog.color.copy(fogCol);
  /** @type {THREE.Color} */ (scene.background).copy(fogCol);
  globalUniforms.uFogColor.value.copy(fogCol);
  renderer.toneMappingExposure = lerp(1.0, 1.25, n);
  idler.material.emissiveIntensity = lerp(0, 0.35, n);
  standee.tint.set('#d8d0c4').multiplyScalar(lerp(1, 0.28, n)); // unlit sprite: dim by hand at night
  return { sunDir: sunDir.toArray() };
}
scene.fog = new THREE.FogExp2('#e3bf95', 0.012);
scene.background = new THREE.Color('#e3bf95');
applyTimeOfDay();

let weatherEmitter = null;
/** @param {'rain'|'snow'|null} kind  null (or anything else): none @returns {string} */
function weather(kind) {
  if (weatherEmitter) { weatherEmitter.dispose(); weatherEmitter = null; }
  if (kind === 'rain' || kind === 'snow') weatherEmitter = particles.createEmitter({ preset: kind });
  return kind || 'none';
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

let lastT = performance.now();
let elapsed = 0;
let frozen = false;
let burstTimer = 0;
let fps = 0;
const statsEl = document.getElementById('stats');
const tmpV = new THREE.Vector3();

function updateCamera() {
  const { focus, yaw, pitch, dist } = view;
  camera.position.set(
    focus.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    focus.y + Math.sin(pitch) * dist,
    focus.z + Math.cos(yaw) * Math.cos(pitch) * dist,
  );
  camera.lookAt(focus);
  camera.updateMatrixWorld();
  globalUniforms.uCameraYaw.value = yaw;
  globalUniforms.uCameraPosition.value.copy(camera.position);
  // shadow camera follows the focus (texel snapping is LightingSystem's job; fine here)
  const sd = globalUniforms.uSunDirection.value;
  sun.target.position.copy(focus);
  sun.position.copy(focus).addScaledVector(sd, 45);
  sun.target.updateMatrixWorld();
}

function updateWalkers(dt) {
  for (const w of walkers) {
    const dir = w.ccw ? -1 : 1;
    w.angle += (w.speed / w.r) * dt * dir;
    const s = w.sprite;
    s.position.set(w.cx + Math.cos(w.angle) * w.r, w.y, w.cz + Math.sin(w.angle) * w.r);
    const vx = -Math.sin(w.angle) * dir;
    const vz = Math.cos(w.angle) * dir;
    s.play(w.run ? 'run' : 'walk');
    s.faceVector(vx, vz);
    if (w.fade) s.opacity = 0.5 + 0.5 * Math.sin(elapsed * 1.3);
  }
  spirit.position.y = 1.2 + Math.sin(elapsed * 1.7) * 0.15;
  // idler turns around slowly (shows every direction while idle)
  const k = Math.floor(elapsed / 2.5) % 4;
  idler.setDirection(DIRECTIONS[k]);
}

function updateLabels() {
  const w = renderer.domElement.clientWidth;
  const h = renderer.domElement.clientHeight;
  for (const l of labels) {
    tmpV.copy(l.pos).project(camera);
    const visible = tmpV.z < 1 && Math.abs(tmpV.x) < 1.1 && Math.abs(tmpV.y) < 1.1;
    l.el.style.display = visible ? 'block' : 'none';
    if (visible) l.el.style.transform = `translate(-50%, -100%) translate(${((tmpV.x + 1) / 2) * w}px, ${((1 - tmpV.y) / 2) * h}px)`;
  }
}

function frame() {
  const nowT = performance.now();
  const rawDt = Math.min((nowT - lastT) / 1000, 1 / 20);
  lastT = nowT;
  const dt = frozen ? 0 : rawDt;
  elapsed += dt;
  globalUniforms.uTime.value = elapsed;
  fps = lerp(fps || 60, 1 / Math.max(rawDt, 1e-4), 0.05);

  updateCamera();
  updateWalkers(dt);
  spriteManager.update(dt);
  foliage.update(dt);

  if (!frozen) {
    burstTimer -= dt;
    if (burstTimer <= 0) {
      burstTimer = 0.9;
      const sp = zoneCenters.splash;
      particles.burst('splash', tmpV.set(sp.x + Math.sin(elapsed * 3.1) * 0.6, 0.05, sp.z + Math.cos(elapsed * 2.3) * 0.5), 16);
      const sk = zoneCenters.sparkle;
      particles.burst('sparkle', tmpV.set(sk.x, 0.9, sk.z), 8);
      const fs = zoneCenters.footstep;
      particles.burst('footstep', tmpV.set(fs.x + 1.2, 0.02, fs.z + 0.9), 8);
    }
  }
  particles.update(dt, camera);

  renderer.render(scene, camera);
  updateLabels();
  const info = renderer.info;
  statsEl.textContent = `${fps.toFixed(0)} fps · ${info.render.calls} draws · ${(info.render.triangles / 1000).toFixed(1)}k tris · ${tufts.length} tufts · ${spriteManager.sprites.length} sprites · night ${night.toFixed(2)}`;
  requestAnimationFrame(frame);
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
camera.aspect = innerWidth / innerHeight;
camera.updateProjectionMatrix();
requestAnimationFrame(frame);

// ---------------------------------------------------------------------------
// Hooks for scripted checks
// ---------------------------------------------------------------------------

/** Wait `n` animation frames. @param {number} [n] @returns {Promise<void>} */
const nextFrames = (n = 2) => new Promise((resolve) => {
  let k = 0;
  const tick = () => (++k >= n ? resolve() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
});

/**
 * `window.__sb` on sprite_runtime.html (AUTOMATION_API.md §7), read by
 * sandbox/sprite_runtime.actions.json.
 * @typedef {object} SpriteRuntimeHandle
 * @property {typeof THREE} THREE
 * @property {THREE.WebGLRenderer} renderer
 * @property {THREE.Scene} scene
 * @property {THREE.PerspectiveCamera} camera
 * @property {typeof sheet} sheet  the local test character sheet
 * @property {SpriteManager} spriteManager
 * @property {typeof walkers} walkers  the circling sprites (`sprite`, centre, radius, speed …)
 * @property {Sprite3D} idler  turns through every direction while idle
 * @property {Sprite3D} spirit  spherical billboard, emissive, no contact blob
 * @property {Sprite3D} standee  'none' billboard, mirrored, manual frame
 * @property {Foliage} foliage
 * @property {Particles} particles
 * @property {Record<string, ReturnType<Particles['createEmitter']>>} emitters  the zone emitters by
 *   preset name
 * @property {typeof PARTICLE_PRESETS} PARTICLE_PRESETS
 * @property {(n: number|string) => { sunDir: number[] }} setNight  0 (day) … 1 (night)
 * @property {(deg: number) => number} setYaw  camera yaw in degrees
 * @property {typeof setView} setView
 * @property {typeof weather} weather
 * @property {(b?: boolean) => boolean} freeze  stop the clock (stable screenshots)
 * @property {(b?: boolean) => boolean} showSheet  show the sheet canvas
 * @property {() => object} stats  draw calls, triangles, GPU memory, programs, counts
 * @property {() => object} textureStats  GL texture uploads so far + GPU textures
 * @property {() => object} testEmitterToggles  emitter intensity / enabled round trip
 * @property {() => object} testDirectionPhase  setDirection keeps the frame phase
 * @property {() => object} testPlaySemantics  play() / setFrame() semantics, prop-sheet input,
 *   clone
 * @property {() => { ok: boolean }} testRegistryAndWarnings  SpriteManager removals from inside
 *   an update (SPR-06), one warning per unknown animation name (SPR-13), parseColor's numbers,
 *   CSS names and warning (PROP-11)
 * @property {(n?: number) => Promise<object>} spawnSprites  create n sprites; report the GL
 *   texture uploads they caused (should be 0)
 */
window.__sb = {
  THREE, renderer, scene, camera, sheet, spriteManager, walkers, idler, spirit, standee, foliage, particles, emitters, PARTICLE_PRESETS,
  setNight(n) { night = clamp(+n, 0, 1); return applyTimeOfDay(); },
  setYaw(deg) { view.yaw = deg * DEG2RAD; return deg; },
  setView,
  weather,
  freeze(b = true) { frozen = !!b; return frozen; },
  showSheet(b = true) { document.getElementById('sheet').style.display = b ? 'block' : 'none'; return b; },
  stats() {
    const i = renderer.info;
    return { calls: i.render.calls, triangles: i.render.triangles, textures: i.memory.textures, geometries: i.memory.geometries, programs: i.programs.length, sprites: spriteManager.sprites.length, emitters: particles.emitters.length, tufts: tufts.length, foliageDraws: 1 };
  },
  textureStats() { return { ...uploads, gpuTextures: renderer.info.memory.textures }; },
  /** Emitter intensity/enabled round trip. */
  testEmitterToggles() {
    const e = emitters.rain;
    e.intensity = 0.25;
    const quarter = e.object.geometry.instanceCount;
    e.enabled = false;
    const hidden = !e.object.visible;
    e.enabled = true;
    e.intensity = 1;
    return { count: e.count, quarter, hidden, restored: e.object.geometry.instanceCount, visible: e.object.visible };
  },
  /** setDirection keeps the frame phase of the running animation. */
  testDirectionPhase() {
    const s = walkers[0].sprite;
    const before = { anim: s.animation, frame: s.frame };
    s.setDirection(s.direction === 'left' ? 'up' : 'left');
    return { before, after: { anim: s.animation, frame: s.frame } };
  },
  /** play()/setFrame() semantics + PropSprites-shaped input (audit regression checks). */
  testPlaySemantics() {
    const s = new Sprite3D(sheet, { blobShadow: false, castShadow: false });
    const out = {};
    s.play('walk_left', { speed: 2 });
    out.explicitSpeed = s.speed; // 2
    s.play('walk_left');
    out.samePlayKeepsSpeed = s.speed; // 2 (no-op)
    s.play('idle_left');
    out.newAnimDefaultSpeed = s.speed; // 1 (contract default)
    s.play('walk_right');
    s.update(0.3);
    s.setFrame(0, 3);
    out.afterSetFrame = { animation: s.animation, playing: s.playing };
    s.play('walk_right');
    out.resumed = { animation: s.animation, playing: s.playing, frame: s.frame };
    s.dispose();
    // prop-sprite shaped input: 4 horizontal frames (width = whole strip)
    /** @type {PropSheet} */
    const prop = { texture: foliageSprite.texture, canvas: null, width: 64, height: 16, pixelsPerUnit: PPU, anchor: [0.5, 0], frames: 4, fps: 6 };
    const p = new Sprite3D(prop, { blobShadow: false });
    out.prop = { animation: p.animation, size: p.size.toArray(), repeat: p.texture.repeat.toArray() };
    p.update(0.2);
    out.prop.frameAfter = p.frame;
    p.dispose();
    // Object3D-style clone keeps sheet, options and state
    const c = walkers[2].sprite.clone();
    out.clone = { animation: c.animation, tint: c.tint.getHexString(), opacity: +c.opacity.toFixed(2), sameSheet: c.sheet === sheet };
    c.dispose();
    return out;
  },
  testRegistryAndWarnings() {
    const out = { ok: true, fails: [] };
    const want = (cond, what) => { if (!cond) { out.ok = false; out.fails.push(what); } };
    // SPR-06: removals from inside a sprite's update (a callback) skip no other sprite
    const sm = new SpriteManager(camera);
    const seen = [];
    /** @type {Record<string, { update(): void }>} */
    const S = {};
    const mk = (name, fn = null) => (S[name] = { update() { seen.push(name); fn?.(); } });
    for (const n of ['a', 'b', 'c', 'd', 'f', 'g', 'h', 'e']) mk(n);
    S.b.update = () => { seen.push('b'); sm.remove(S.b); }; // itself
    S.f.update = () => { seen.push('f'); sm.remove(S.a); }; // one already updated
    S.g.update = () => { seen.push('g'); sm.remove(S.h); sm.add(S.x); }; // one not yet reached; add one
    mk('x');
    for (const n of ['a', 'b', 'c', 'd', 'f', 'g', 'h', 'e']) sm.add(S[n]);
    sm.update(1 / 60);
    out.frame1 = seen.join('');
    seen.length = 0;
    sm.update(1 / 60);
    out.frame2 = seen.join('');
    want(out.frame1 === 'abcdfgex', `SpriteManager frame 1 ${out.frame1} (want abcdfgex)`);
    want(out.frame2 === 'cdfgex', `SpriteManager frame 2 ${out.frame2} (want cdfgex)`);
    sm.dispose();
    // SPR-13: one warning per unknown animation name, whatever sprite asks
    const warned = [];
    const warn = console.warn;
    console.warn = (...a) => { warned.push(a.map(String).join(' ')); };
    try {
      const s1 = new Sprite3D(sheet, { blobShadow: false, castShadow: false });
      const s2 = new Sprite3D(sheet, { blobShadow: false, castShadow: false });
      s1.play('spr13_nope_a'); s1.play('spr13_nope_b'); s2.play('spr13_nope_a'); s2.play('spr13_nope_c'); s1.play('spr13_nope_a');
      s1.dispose();
      s2.dispose();
    } finally {
      console.warn = warn;
    }
    out.animationWarnings = warned.slice();
    want(JSON.stringify(warned) === JSON.stringify(['a', 'b', 'c'].map((k) => `Sprite3D: unknown animation "spr13_nope_${k}"`)), 'animation warnings');
    // PROP-11: numbers, CSS names, hex as before, one warning for an unknown name (opaque black)
    warned.length = 0;
    console.warn = (...a) => { warned.push(a.map(String).join(' ')); };
    try {
      out.colors = {
        number: [...parseColor(0xff8000)], name: [...parseColor('red')], upper: [...parseColor(' Beige ')],
        hex: [...parseColor('#ff8000')], bare: [...parseColor('ff8000')], short: [...parseColor('#abc')],
        unknown: [...parseColor('prop11-no-such-colour')], again: [...parseColor('prop11-no-such-colour')],
        css: toCss(0x336699),
      };
    } finally {
      console.warn = warn;
    }
    out.colorWarnings = warned.slice();
    const C = out.colors;
    want(JSON.stringify(C.number) === '[255,128,0,255]' && JSON.stringify(C.hex) === '[255,128,0,255]' && JSON.stringify(C.bare) === '[255,128,0,255]', 'parseColor number / hex');
    want(JSON.stringify(C.name) === '[255,0,0,255]' && JSON.stringify(C.upper) === '[245,245,220,255]' && JSON.stringify(C.short) === '[170,187,204,255]', 'parseColor names / short hex');
    want(JSON.stringify(C.unknown) === '[0,0,0,255]' && JSON.stringify(C.again) === '[0,0,0,255]' && C.css === 'rgba(51,102,153,1.000)', 'parseColor unknown / toCss');
    want(JSON.stringify(warned) === '["[PixelCanvas] unknown colour \\"prop11-no-such-colour\\"; using black"]', 'parseColor warning');
    return out;
  },
  /** Create n sprites at runtime and report GL texture uploads caused by them (should be 0). */
  async spawnSprites(n = 10) {
    const before = { ...uploads, gpuTextures: renderer.info.memory.textures };
    const made = [];
    for (let i = 0; i < n; i++) {
      const s = new Sprite3D(sheet, { blobShadow: true });
      s.position.set(-10 + i * 0.9, 0, 5.5);
      s.play('walk_down');
      scene.add(s);
      spriteManager.add(s);
      made.push(s);
    }
    await nextFrames(3);
    const after = { ...uploads, gpuTextures: renderer.info.memory.textures };
    for (const s of made) { spriteManager.remove(s); s.dispose(); }
    await nextFrames(2);
    const afterDispose = { ...uploads, gpuTextures: renderer.info.memory.textures };
    return { before, after, afterDispose, sheetStillValid: renderer.properties.get(sheet.texture) !== undefined };
  },
};
console.log('sprite_runtime sandbox ready', THREE.REVISION);
