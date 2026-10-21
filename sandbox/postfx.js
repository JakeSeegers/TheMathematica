/**
 * PostFX sandbox — a 2.5D test diorama exercising the post-processing stack standalone.
 *
 * URL params:  ?gui (lil-gui panel)  ?label (settings / GPU timing label)  ?samples=N  ?scale=0.5
 *              ?freeze (stop animation)
 * window.__postfx exposes handles for scripted checks (see bottom of file): set(path, v), reset(),
 * probeDepth() (proves the MSAA depth resolve), flickerTest() (temporal stability metrics),
 * nanTest() (NaN / Inf scrubbing), rebuild(opts), setPixelRatio(pr), zoom(x, y, s), memory(), info().
 *
 * Check scripts:  sandbox/postfx.actions.json (main screenshot set), postfx.robust.json (autofocus,
 * pixel ratio, MSAA off, dofScale variants, leak check), postfx.flicker.json, postfx.nan.json,
 * postfx.perf.json (min GPU ms per stage via EXT_disjoint_timer_query_webgl2).
 */
import * as THREE from 'three';
import { PostFX } from '../src/engine/render/PostFX.js';
import { PixelCanvas, makePixelTexture } from '../src/engine/pixel/PixelCanvas.js';
import { PALETTE } from '../src/engine/pixel/Palette.js';
import { RNG, DEG2RAD, clamp } from '../src/engine/utils/math.js';
import { globalUniforms } from '../src/engine/render/GlobalUniforms.js';

const params = new URLSearchParams(location.search);
const container = document.getElementById('app');

// ------------------------------------------------------------------------------------------------
// Renderer / scene / diorama camera
// ------------------------------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const FOG_COLOR = new THREE.Color().setRGB(0.62, 0.47, 0.36);
scene.background = FOG_COLOR.clone();
scene.fog = new THREE.FogExp2(FOG_COLOR, 0.011);

const camera = new THREE.PerspectiveCamera(28, container.clientWidth / container.clientHeight, 0.5, 400);
const CAM = { pitch: 32 * DEG2RAD, yaw: 0, distance: 24, target: new THREE.Vector3(0, 1, 0) };
function placeCamera() {
  const { pitch, yaw, distance, target } = CAM;
  camera.position.set(
    target.x + Math.sin(yaw) * Math.cos(pitch) * distance,
    target.y + Math.sin(pitch) * distance,
    target.z + Math.cos(yaw) * Math.cos(pitch) * distance,
  );
  camera.lookAt(target);
  camera.updateMatrixWorld();
}
placeCamera();

// ------------------------------------------------------------------------------------------------
// Pixel textures (PixelCanvas, NEAREST magnification)
// ------------------------------------------------------------------------------------------------
const P = PALETTE;
const worldTex = (pc) => makePixelTexture(pc.toCanvas(), { wrap: 'repeat', mipmaps: true, anisotropy: 8 });
const spriteTex = (pc) => makePixelTexture(pc.toCanvas(), { wrap: 'clamp', mipmaps: false });

function grassTexture() {
  const pc = new PixelCanvas(32, 32);
  pc.wrap = true;
  const g = P.grass;
  pc.fillNoise([g[1], g[2], g[2], g[3], g[3], g[4]], { scale: 4, period: 4, seed: 11, octaves: 3, dither: 0.9 });
  // one-unit checker (subtle), like mown garden tiles
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (((x >> 4) + (y >> 4)) & 1) pc.scale(x, y, 0.9);
  const rng = new RNG(5);
  for (let i = 0; i < 60; i++) {
    const x = rng.int(0, 31);
    const y = rng.int(0, 31);
    pc.set(x, y + 1, g[1]);
    pc.set(x, y, g[4]);
    if (rng.chance(0.5)) pc.set(x, y - 1, g[5]);
  }
  for (let i = 0; i < 5; i++) {
    const x = rng.int(0, 31);
    const y = rng.int(0, 31);
    pc.set(x, y, rng.chance(0.5) ? P.yellow[4] : P.white[3]);
    pc.set(x, y + 1, g[1]);
  }
  return worldTex(pc);
}

function cobbleTexture() {
  const pc = new PixelCanvas(32, 32, P.stoneWarm[1]);
  pc.wrap = true;
  const rng = new RNG(21);
  const s = P.stoneWarm;
  for (let row = 0; row < 5; row++) {
    const off = (row & 1) * 4;
    for (let col = 0; col < 4; col++) {
      const cx = col * 8 + off + 3.5 + rng.range(-0.6, 0.6);
      const cy = row * 6.4 + 3 + rng.range(-0.5, 0.5);
      const rx = 2.8 + rng.range(-0.4, 0.5);
      const ry = 2.2 + rng.range(-0.3, 0.4);
      const base = rng.pick([s[2], s[3], s[3]]);
      pc.ellipse(cx, cy, rx, ry, base);
      pc.set(Math.round(cx - 1), Math.round(cy - 1), s[4]);
      pc.set(Math.round(cx), Math.round(cy - 1), s[4]);
      pc.set(Math.round(cx - 2), Math.round(cy), s[4]);
      pc.set(Math.round(cx + 1), Math.round(cy + 1), s[1]);
      pc.set(Math.round(cx + 2), Math.round(cy), s[2]);
    }
  }
  for (let i = 0; i < 18; i++) pc.set(rng.int(0, 31), rng.int(0, 31), P.moss[2]);
  return worldTex(pc);
}

function crateTexture() {
  const w = P.wood;
  const pc = new PixelCanvas(16, 16, w[3]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((y % 4) === 3) pc.set(x, y, w[2]);
  for (let i = 1; i < 15; i++) { pc.set(i, 15 - i, w[4]); pc.set(i + 1, 15 - i, w[2]); }
  pc.strokeRect(0, 0, 16, 16, w[1]);
  pc.strokeRect(1, 1, 14, 14, w[4]);
  pc.hline(2, 13, 2, w[5]);
  for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) pc.set(x, y, P.metal[4]);
  return worldTex(pc);
}

function stoneBlockTexture() {
  const s = P.stone;
  const pc = new PixelCanvas(16, 16, s[1]);
  const rng = new RNG(9);
  for (let row = 0; row < 4; row++) {
    const off = (row & 1) * 4;
    for (let col = -1; col < 3; col++) {
      const x0 = col * 8 + off;
      const c = rng.pick([s[2], s[3], s[3]]);
      pc.rect(x0 + 1, row * 4 + 1, 7, 3, c);
      pc.hline(x0 + 1, x0 + 7, row * 4 + 1, s[4]);
      pc.set(x0 + 7, row * 4 + 3, s[1]);
    }
  }
  return worldTex(pc);
}

function plasterTexture() {
  const pc = new PixelCanvas(16, 16);
  pc.wrap = true;
  const p = P.plaster;
  pc.fillNoise([p[2], p[3], p[3], p[4]], { scale: 2, period: 2, seed: 4, dither: 1 });
  const w = P.wood;
  pc.rect(0, 0, 2, 16, w[1]);
  pc.vline(1, 0, 15, w[2]);
  pc.rect(0, 14, 16, 2, w[1]);
  pc.hline(0, 15, 14, w[2]);
  return worldTex(pc);
}

function roofTexture() {
  const r = P.roofRed;
  const pc = new PixelCanvas(16, 16, r[2]);
  for (let row = 0; row < 4; row++) {
    const off = (row & 1) * 2;
    for (let x = 0; x < 16; x++) {
      const y0 = row * 4;
      pc.set(x, y0, r[4]);
      pc.set(x, y0 + 1, r[3]);
      if (((x + off) & 3) === 0) pc.vline(x, y0, y0 + 3, r[1]);
    }
    pc.hline(0, 15, row * 4 + 3, r[1]);
  }
  return worldTex(pc);
}

function windowTexture() {
  const pc = new PixelCanvas(8, 10, P.gold[5]);
  pc.rect(1, 1, 6, 8, P.gold[4]);
  pc.rect(1, 5, 6, 4, P.gold[3]);
  pc.strokeRect(0, 0, 8, 10, P.wood[1]);
  pc.vline(4, 0, 9, P.wood[1]);
  pc.hline(0, 7, 4, P.wood[1]);
  return spriteTex(pc);
}

function treeSprite(seed, ramp = P.leaves) {
  const pc = new PixelCanvas(48, 64);
  const rng = new RNG(seed);
  const b = P.bark;
  pc.rect(21, 40, 6, 24, b[2]);
  pc.vline(21, 40, 63, b[1]);
  pc.vline(26, 42, 63, b[3]);
  pc.set(23, 50, b[1]); pc.set(24, 55, b[1]);
  pc.line(26, 46, 33, 38, b[2]);
  pc.line(21, 48, 14, 41, b[2]);
  const blobs = [[24, 24, 16], [13, 31, 10], [35, 30, 10], [24, 12, 11], [16, 19, 9], [32, 18, 9], [24, 34, 12]];
  const mask = new PixelCanvas(48, 64);
  for (const [x, y, r] of blobs) mask.circle(x + rng.range(-1, 1), y + rng.range(-1, 1), r, '#fff');
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 48; x++) {
      if (!mask.getAlpha(x, y)) continue;
      // light from the upper right, dithered
      let t = 0.55 - (y / 48) * 0.55 + (x / 48) * 0.35 + (rng.next() - 0.5) * 0.3;
      if (!mask.getAlpha(x + 2, y - 2)) t += 0.35;
      if (!mask.getAlpha(x - 2, y + 2)) t -= 0.25;
      const idx = clamp(Math.floor(1 + t * 4), 1, ramp.length - 1);
      pc.set(x, y, ramp[idx]);
    }
  }
  for (let i = 0; i < 40; i++) {
    const x = rng.int(4, 44);
    const y = rng.int(2, 44);
    if (mask.getAlpha(x, y) && mask.getAlpha(x, y + 1)) pc.set(x, y, ramp[1]);
  }
  pc.outline(P.outline);
  return spriteTex(pc);
}

function pineSprite(seed) {
  const pc = new PixelCanvas(32, 64);
  const rng = new RNG(seed);
  const pn = P.pine;
  pc.rect(14, 52, 4, 12, P.bark[2]);
  pc.vline(14, 52, 63, P.bark[1]);
  for (let layer = 0; layer < 5; layer++) {
    const top = 4 + layer * 9;
    const h = 16;
    for (let y = 0; y < h; y++) {
      const hw = Math.floor((y / h) * (7 + layer * 2.2)) + 1;
      for (let x = -hw; x <= hw; x++) {
        let t = 0.5 + (x / (hw + 1)) * 0.45 - (y / h) * 0.3 + (rng.next() - 0.5) * 0.25;
        const idx = clamp(Math.floor(t * pn.length), 0, pn.length - 1);
        pc.set(16 + x, top + y, pn[idx]);
      }
    }
  }
  pc.outline(P.outline);
  return spriteTex(pc);
}

/** Small chibi character, 16×28 px. */
function characterSprite({ skin = P.skinLight, hair = P.hairBrown, top = P.red, bottom = P.brown, cape = null } = {}) {
  const pc = new PixelCanvas(16, 28);
  // legs & boots
  pc.rect(5, 21, 2, 5, bottom[2]); pc.rect(9, 21, 2, 5, bottom[2]);
  pc.rect(5, 25, 3, 2, P.black[2]); pc.rect(9, 25, 3, 2, P.black[2]);
  // cape
  if (cape) { pc.rect(3, 12, 10, 11, cape[1]); pc.vline(3, 13, 22, cape[0]); }
  // torso
  pc.rect(4, 12, 8, 10, top[2]);
  pc.rect(5, 12, 6, 9, top[3]);
  pc.vline(10, 13, 20, top[1]);
  pc.hline(4, 11, 18, P.brown[1]); pc.set(8, 18, P.gold[3]);
  // arms
  pc.rect(3, 13, 1, 6, top[1]); pc.rect(12, 13, 1, 6, top[2]);
  pc.set(3, 19, skin[2]); pc.set(12, 19, skin[2]);
  // head
  pc.rect(4, 3, 8, 9, skin[3]);
  pc.rect(4, 9, 8, 2, skin[2]);
  pc.set(6, 7, P.outline); pc.set(9, 7, P.outline);
  pc.set(6, 6, P.white[4]);
  pc.set(7, 9, skin[1]); pc.set(8, 9, skin[1]);
  // hair
  pc.rect(3, 1, 10, 4, hair[2]);
  pc.rect(3, 4, 2, 5, hair[2]); pc.rect(11, 4, 2, 4, hair[1]);
  pc.hline(5, 9, 1, hair[3]); pc.set(6, 2, hair[4]); pc.set(7, 2, hair[4]);
  pc.set(6, 5, hair[2]); pc.set(9, 5, hair[2]);
  pc.outline(P.outline);
  return spriteTex(pc);
}

function bushSprite(seed, ramp = P.leaves) {
  const pc = new PixelCanvas(24, 16);
  const rng = new RNG(seed);
  const mask = new PixelCanvas(24, 16);
  for (const [x, y, r] of [[7, 10, 6], [16, 10, 6], [12, 7, 6]]) mask.circle(x, y, r, '#fff');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 24; x++) {
    if (!mask.getAlpha(x, y)) continue;
    let t = 0.75 - y / 16 + (x / 24) * 0.3 + (rng.next() - 0.5) * 0.35;
    pc.set(x, y, ramp[clamp(Math.floor(1 + t * 4), 1, ramp.length - 1)]);
  }
  for (let i = 0; i < 4; i++) pc.set(rng.int(4, 19), rng.int(4, 10), rng.pick([P.red[4], P.yellow[4], P.white[4]]));
  pc.outline(P.outline);
  return spriteTex(pc);
}

// ------------------------------------------------------------------------------------------------
// Geometry helpers
// ------------------------------------------------------------------------------------------------
/** Box whose UVs repeat once per world unit on every face (16 px / unit texel density). */
function unitBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const faceScale = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * faceScale[f][0], uv.getY(i) * faceScale[f][1]);
    }
  }
  return g;
}

/** Upright sprite plane with its origin at the bottom centre; normals lean toward sky & camera. */
function spritePlane(tex, pxW, pxH, scale = 1) {
  const w = (pxW / 16) * scale;
  const h = (pxH / 16) * scale;
  const g = new THREE.PlaneGeometry(w, h);
  g.translate(0, h / 2, 0);
  const n = g.attributes.normal;
  const lean = new THREE.Vector3(0.15, 0.55, 0.82).normalize();
  for (let i = 0; i < n.count; i++) n.setXYZ(i, lean.x, lean.y, lean.z);
  const m = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ------------------------------------------------------------------------------------------------
// Diorama
// ------------------------------------------------------------------------------------------------
const tex = {
  grass: grassTexture(),
  cobble: cobbleTexture(),
  crate: crateTexture(),
  stone: stoneBlockTexture(),
  plaster: plasterTexture(),
  roof: roofTexture(),
  window: windowTexture(),
};
const mats = {
  grass: new THREE.MeshLambertMaterial({ map: tex.grass }),
  cobble: new THREE.MeshLambertMaterial({ map: tex.cobble }),
  crate: new THREE.MeshLambertMaterial({ map: tex.crate }),
  stone: new THREE.MeshLambertMaterial({ map: tex.stone }),
  plaster: new THREE.MeshLambertMaterial({ map: tex.plaster }),
  roof: new THREE.MeshLambertMaterial({ map: tex.roof }),
  metal: new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(0.05, 0.05, 0.07) }),
  window: new THREE.MeshBasicMaterial({ map: tex.window, color: new THREE.Color(3.2, 2.0, 1.0) }),
};

// ground: long field receding into the distance, cobble path down the middle
{
  const L = 90;
  const zMid = -30;
  const g = new THREE.PlaneGeometry(70, L);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, zMid);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * 70) / 2, (uv.getY(i) * L) / 2);
  const ground = new THREE.Mesh(g, mats.grass);
  ground.receiveShadow = true;
  scene.add(ground);

  const pg = new THREE.PlaneGeometry(3, L);
  pg.rotateX(-Math.PI / 2);
  pg.translate(0, 0.01, zMid);
  const puv = pg.attributes.uv;
  for (let i = 0; i < puv.count; i++) puv.setXY(i, (puv.getX(i) * 3) / 2, (puv.getY(i) * L) / 2);
  const path = new THREE.Mesh(pg, mats.cobble);
  path.receiveShadow = true;
  scene.add(path);
}

const rng = new RNG(1234);
const animated = [];
const glowSpheres = [];
const sphereGeo = new THREE.SphereGeometry(1, 12, 8);

function addBox(x, z, w, h, d, mat, y = 0, rot = 0) {
  const m = new THREE.Mesh(unitBox(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = rot;
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

function addSprite(t, pxW, pxH, x, z, scale = 1, y = 0) {
  const s = spritePlane(t, pxW, pxH, scale);
  s.position.set(x, y, z);
  scene.add(s);
  return s;
}

function addGlow(x, y, z, r, color, intensity) {
  const m = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }));
  m.scale.setScalar(r);
  m.position.set(x, y, z);
  scene.add(m);
  glowSpheres.push(m);
  return m;
}

function addLamp(x, z, h = 2.4, withLight = true) {
  addBox(x, z, 0.14, h, 0.14, mats.metal);
  addBox(x, z, 0.36, 0.08, 0.36, mats.metal, h);
  const g = addGlow(x, h - 0.18, z, 0.13, 0xffb05a, 9);
  addBox(x, z, 0.3, 0.06, 0.3, mats.metal, h - 0.38);
  if (withLight) {
    const l = new THREE.PointLight(0xffb46b, 7, 8, 2);
    l.position.set(x, h - 0.3, z);
    scene.add(l);
  }
  return g;
}

function addHouse(x, z, w, h, d) {
  addBox(x, z, w, h, d, mats.plaster);
  // gable roof: two slabs
  const pitch = 0.62;
  const half = d / 2 + 0.35;
  const slope = half / Math.cos(pitch);
  for (const s of [-1, 1]) {
    const slab = new THREE.Mesh(unitBox(w + 0.5, 0.16, slope), mats.roof);
    slab.rotation.x = s * pitch;
    slab.position.set(x, h + Math.tan(pitch) * half * 0.5 - 0.02, z + (s * half) / 2);
    slab.castShadow = true;
    slab.receiveShadow = true;
    scene.add(slab);
  }
  // gable triangles
  const tri = new THREE.Shape();
  tri.moveTo(-d / 2, 0);
  tri.lineTo(d / 2, 0);
  tri.lineTo(0, Math.tan(pitch) * (d / 2));
  const tg = new THREE.ShapeGeometry(tri);
  for (const s of [-1, 1]) {
    const gm = new THREE.Mesh(tg, mats.plaster);
    gm.rotation.y = (s * Math.PI) / 2;
    gm.position.set(x + (s * w) / 2, h, z);
    gm.castShadow = true;
    scene.add(gm);
  }
  // glowing windows on the front face
  const wg = new THREE.PlaneGeometry(0.5, 0.62);
  for (const wx of [-w / 4, w / 4]) {
    const win = new THREE.Mesh(wg, mats.window);
    win.position.set(x + wx, h * 0.55, z + d / 2 + 0.01);
    scene.add(win);
  }
}

const treeTex = [treeSprite(3), treeSprite(8), treeSprite(15, P.leavesAutumn)];
const pineTex = [pineSprite(4), pineSprite(12)];
const bushTex = [bushSprite(2), bushSprite(6, P.leavesAutumn)];
const heroTex = characterSprite({ top: P.red, hair: P.hairBrown, cape: P.blue });
const npcTex = [
  characterSprite({ top: P.blue, hair: P.hairBlonde, skin: P.skinTan }),
  characterSprite({ top: P.green, hair: P.hairBlack, skin: P.skinDark }),
  characterSprite({ top: P.purple, hair: P.hairRed }),
];

// --- focus band: the hero, a lantern, crates
const hero = addSprite(heroTex, 16, 28, 0, 0, 1);
animated.push((t) => { hero.scale.y = 1 + Math.sin(t * 2.4) * 0.012; });
addLamp(1.6, -0.6);
addBox(-1.9, -0.4, 1, 1, 1, mats.crate);
addBox(-2.9, -0.2, 1, 1, 1, mats.crate, 0, 0.2);
addBox(-2.35, -0.3, 1, 1, 1, mats.crate, 1, -0.1);
addSprite(npcTex[0], 16, 28, 3.4, 0.8, 1);
addSprite(bushTex[0], 24, 16, -4.3, 1.2);

// --- rows of boxes / sprites at many depths
const rows = [-4, -7.5, -11, -15, -19, -24, 3.5];
for (const z of rows) {
  for (const side of [-1, 1]) {
    const x = side * rng.range(2.3, 3.4);
    if (rng.chance(0.55)) addBox(x, z, 1, 1, 1, rng.chance(0.5) ? mats.crate : mats.stone, 0, rng.range(-0.3, 0.3));
    else addBox(x, z, 1.4, rng.pick([0.5, 1, 1.5]), 1, mats.stone);
    const sx = side * rng.range(4.6, 7.5);
    const k = rng.next();
    if (k < 0.45) addSprite(rng.pick(treeTex), 48, 64, sx, z - 0.5, rng.range(0.9, 1.15));
    else if (k < 0.7) addSprite(rng.pick(pineTex), 32, 64, sx, z - 0.5, rng.range(0.9, 1.2));
    else addSprite(rng.pick(npcTex), 16, 28, sx * 0.7, z, 1);
    if (rng.chance(0.7)) addSprite(rng.pick(bushTex), 24, 16, side * rng.range(1.8, 9), z + rng.range(0.6, 1.5));
  }
}
// houses in the back
addHouse(-6, -16, 4, 2.6, 3);
addHouse(6.5, -21, 5, 3.0, 3.2);
addHouse(-2.5, -28, 4.5, 3.2, 3);
addHouse(9, -30, 4, 2.8, 3);
// tall far trees filling the top of the frame
for (let i = 0; i < 16; i++) {
  const x = -16 + i * 2.1 + rng.range(-0.6, 0.6);
  const z = -33 - rng.range(0, 6);
  if (rng.chance(0.5)) addSprite(rng.pick(pineTex), 32, 64, x, z, rng.range(1.4, 1.9));
  else addSprite(rng.pick(treeTex), 48, 64, x, z, rng.range(1.2, 1.6));
}
// lamps along the path at several depths
for (const [x, z] of [[-1.9, -8], [1.9, -14], [-1.9, -21], [1.9, -29], [-1.9, 5.5]]) addLamp(x, z, 2.4, z > -22);
// foreground (near field): fence, bushes, big trees framing the lower corners, a lamp
for (let i = -7; i <= 7; i++) {
  if (Math.abs(i) < 2) continue;
  addBox(i * 1.1, 6.9, 0.16, 0.9, 0.16, mats.crate);
}
addBox(-5.5, 6.9, 7.8, 0.12, 0.08, mats.crate, 0.62);
addBox(5.5, 6.9, 7.8, 0.12, 0.08, mats.crate, 0.62);
for (let i = 0; i < 8; i++) addSprite(rng.pick(bushTex), 24, 16, -8.5 + i * 2.4 + rng.range(-0.4, 0.4), 7.4 + rng.range(0, 0.6), 1.3);
addSprite(treeTex[0], 48, 64, -6.6, 7.9, 1.55);
addSprite(treeTex[2], 48, 64, 7.4, 8.3, 1.45);
addLamp(-3.2, 7.2, 3.0);

// bokeh specks: fireflies / embers near and far (HDR emissive)
const glowColors = [0xffb35a, 0xffd27a, 0xff8a3a, 0x9fe8ff, 0xc8ff7a];
for (let i = 0; i < 22; i++) {
  const x = (i & 1 ? 1 : -1) * rng.range(1.3, 8); // keep the centre column (hero) clear
  const z = rng.range(2.5, 8);
  const y = rng.range(1.8, 5.2);
  const s = addGlow(x, y, z, rng.range(0.05, 0.09), rng.pick(glowColors), rng.range(5, 12));
  s.userData.base = s.position.clone();
  s.userData.phase = rng.range(0, 6.28);
}
for (let i = 0; i < 46; i++) {
  const x = rng.range(-14, 14);
  const z = rng.range(-36, -9);
  const y = rng.range(0.6, 6.5);
  const s = addGlow(x, y, z, rng.range(0.06, 0.12), rng.pick(glowColors), rng.range(5, 12));
  s.userData.base = s.position.clone();
  s.userData.phase = rng.range(0, 6.28);
}
for (let i = 0; i < 8; i++) {
  const s = addGlow((i & 1 ? 1 : -1) * rng.range(1.4, 5), rng.range(0.8, 2.4), rng.range(-2, 2), 0.045, rng.pick(glowColors), 8);
  s.userData.base = s.position.clone();
  s.userData.phase = rng.range(0, 6.28);
}

// --- lights: warm low sun (golden hour), cool sky fill
const sunDir = new THREE.Vector3(0.78, 0.5, 0.36).normalize();
const sun = new THREE.DirectionalLight(0xffc48a, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -26;
sun.shadow.camera.right = 26;
sun.shadow.camera.top = 26;
sun.shadow.camera.bottom = -26;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 140;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 2;
sun.target.position.set(0, 0, -10);
sun.position.copy(sun.target.position).addScaledVector(sunDir, 60);
scene.add(sun, sun.target);
globalUniforms.uSunDirection.value.copy(sunDir);
const hemi = new THREE.HemisphereLight(0x9ab4e8, 0x5a4230, 1.25);
scene.add(hemi);

// ------------------------------------------------------------------------------------------------
// PostFX
// ------------------------------------------------------------------------------------------------
let postfx = new PostFX(renderer, scene, camera, {
  samples: params.has('samples') ? Number(params.get('samples')) : 4,
  dofScale: params.has('scale') ? Number(params.get('scale')) : 0.5,
});
postfx.warmup();
const DEFAULT_SETTINGS = JSON.parse(JSON.stringify(postfx.settings));
postfx.setFocus(camera.position.distanceTo(CAM.target), true);

function onResize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  postfx.setSize(w, h, renderer.getPixelRatio());
}
window.addEventListener('resize', onResize);

// optional GUI
if (params.has('gui')) {
  import('lil-gui').then(({ default: GUI }) => {
    const gui = new GUI({ title: 'PostFX' });
    const s = postfx.settings;
    gui.add(s, 'enabled');
    const fd = gui.addFolder('DOF');
    fd.add(s.dof, 'enabled'); fd.add(s.dof, 'debug'); fd.add(s.dof, 'autoFocus');
    fd.add(s.dof, 'focusDistance', 5, 60, 0.1).listen(); fd.add(s.dof, 'focusRange', 0.5, 20, 0.1);
    fd.add(s.dof, 'maxBlur', 0, 40, 0.5); fd.add(s.dof, 'nearScale', 0, 3, 0.05); fd.add(s.dof, 'farScale', 0, 3, 0.05);
    fd.add(s.dof, 'tiltShift', 0, 1, 0.01); fd.add(s.dof, 'tiltCenter', 0, 1, 0.01); fd.add(s.dof, 'tiltWidth', 0, 1, 0.01);
    fd.add(s.dof, 'bokehBoost', 0, 6, 0.05); fd.add(s.dof, 'bokehThreshold', 0, 4, 0.05);
    const fb = gui.addFolder('Bloom');
    fb.add(s.bloom, 'enabled'); fb.add(s.bloom, 'strength', 0, 3, 0.01); fb.add(s.bloom, 'radius', 0, 1, 0.01);
    fb.add(s.bloom, 'threshold', 0, 3, 0.01); fb.add(s.bloom, 'warmth', 0, 1, 0.01); fb.add(s.bloom, 'knee', 0, 2, 0.01);
    const fg = gui.addFolder('Grade');
    fg.add(s.grade, 'enabled'); fg.add(s.grade, 'exposure', 0, 2, 0.01); fg.add(s.grade, 'contrast', 0.5, 1.6, 0.01);
    fg.add(s.grade, 'saturation', 0, 2, 0.01); fg.add(s.grade, 'temperature', -1, 1, 0.01); fg.add(s.grade, 'tint', -1, 1, 0.01);
    fg.add(s.grade, 'vignette', 0, 1, 0.01); fg.add(s.grade, 'vignetteSoftness', 0, 1, 0.01); fg.add(s.grade, 'vignetteRoundness', 0, 1, 0.01);
    fg.add(s.grade, 'grain', 0, 0.2, 0.001); fg.add(s.grade, 'chromaticAberration', 0, 0.01, 0.0001); fg.add(s.grade, 'sharpen', 0, 1, 0.01);
  });
}

// ------------------------------------------------------------------------------------------------
// Loop
// ------------------------------------------------------------------------------------------------
let lastT = performance.now();
let t = 0;
let frozen = params.has('freeze');
let shimmerWorst = null;
let focusOverride = null;
let nanTestGroup = null;
let frames = 0;
const label = document.getElementById('label');

function frame() {
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.1);
  lastT = now;
  if (!frozen) t += dt;
  globalUniforms.uTime.value = t;
  for (const fn of animated) fn(t);
  for (const s of glowSpheres) {
    const b = s.userData.base;
    if (!b) continue;
    const ph = s.userData.phase;
    s.position.set(b.x + Math.sin(t * 0.5 + ph) * 0.25, b.y + Math.sin(t * 0.8 + ph * 1.7) * 0.18, b.z);
  }
  postfx.setFocus(focusOverride ?? camera.position.distanceTo(CAM.target));
  postfx.render(dt);
  frames++;
  if (label && params.has('label') && frames % 15 === 0) {
    const s = postfx.settings;
    const tm = postfx.timings;
    label.textContent = `DOF ${s.dof.enabled ? 'on' : 'off'}  taps ${postfx.taps}  bloom ${s.bloom.enabled ? 'on' : 'off'}  grade ${s.grade.enabled ? 'on' : 'off'}`
      + (tm.dof !== undefined ? `\nGPU ms  scene ${tm.scene?.toFixed(2)}  dof ${tm.dof?.toFixed(2)}  bloom ${tm.bloom?.toFixed(2)}  out+grade ${tm.output?.toFixed(2)}` : '');
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ------------------------------------------------------------------------------------------------
// Scripted-check handles
// ------------------------------------------------------------------------------------------------
const probe = (() => {
  const N = 8;
  const rt = new THREE.WebGLRenderTarget(N, 1, { type: THREE.FloatType, depthBuffer: false });
  const pts = Array.from({ length: N }, () => new THREE.Vector2());
  const mat = new THREE.ShaderMaterial({
    uniforms: { tDepth: { value: null }, uPts: { value: pts }, uNear: { value: 0.5 }, uFar: { value: 400 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `#include <packing>
      uniform sampler2D tDepth; uniform vec2 uPts[${N}]; uniform float uNear; uniform float uFar;
      void main() {
        int i = int(gl_FragCoord.x);
        float d = texture2D(tDepth, uPts[i]).x;
        gl_FragColor = vec4(d, -perspectiveDepthToViewZ(d, uNear, uFar), 0.0, 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const buf = new Float32Array(N * 4);
  /** @type {[u: number, v: number, name: string][]} the probe points (screen uv) */
  const where = [[0.5, 0.5, 'centre'], [0.5, 0.08, 'bottom'], [0.5, 0.95, 'top'], [0.1, 0.5, 'left'], [0.9, 0.5, 'right'], [0.5, 0.3, 'lower'], [0.5, 0.7, 'upper'], [0.25, 0.85, 'upperLeft']];
  return () => {
    where.forEach(([x, y], i) => pts[i].set(x, y));
    mat.uniforms.tDepth.value = postfx.depthTexture;
    mat.uniforms.uNear.value = camera.near;
    mat.uniforms.uFar.value = camera.far;
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    renderer.render(quad, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, N, 1, buf);
    renderer.setRenderTarget(prevTarget);
    const out = {};
    where.forEach(([, , name], i) => { out[name] = { raw: +buf[i * 4].toFixed(5), viewDepth: +buf[i * 4 + 1].toFixed(2) }; });
    return out;
  };
})();

/**
 * @param {string} path  dotted `postfx.settings` path ('dof.focusDistance')
 * @param {any} value
 * @returns {any} value
 */
function setPath(path, value) {
  const keys = path.split('.');
  let o = postfx.settings;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = value;
  return value;
}

/** Restore the settings PostFX started with. @returns {boolean} */
function reset() {
  const src = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  for (const k of Object.keys(src)) {
    if (typeof src[k] === 'object') Object.assign(postfx.settings[k], src[k]);
    else postfx.settings[k] = src[k];
  }
  return true;
}

/** @typedef {{ samples?: number, dofScale?: number, maxTaps?: number }} RebuildOpts */
/**
 * What `flickerTest` measures over a slow pan.
 * @typedef {object} FlickerReport
 * @property {number} determinism
 * @property {number} maxSecondDiff
 * @property {number} meanSecondDiff
 * @property {{ far: number, focus: number, near: number }} shimmer
 */
/**
 * `window.__postfx` (AUTOMATION_API.md §7).
 * @typedef {object} PostfxHandle
 * @property {PostFX} postfx  (getter) the current PostFX (`rebuild` replaces it)
 * @property {THREE.WebGLRenderer} renderer
 * @property {THREE.Scene} scene
 * @property {THREE.PerspectiveCamera} camera
 * @property {typeof CAM} CAM  the orbit camera: pitch, yaw, distance, target (call setTargetX
 *   or rebuild the view after changing it)
 * @property {typeof setPath} set  set a settings value by dotted path; returns the value
 * @property {typeof reset} reset  restore the default settings
 * @property {typeof probe} probeDepth  resolved scene depth (raw, view depth) at eight named
 *   screen points: proves the MSAA depth resolve
 * @property {(on?: boolean) => boolean} freeze  stop (default) / resume the animation clock
 * @property {(pr: number) => number} setPixelRatio  returns the renderer's pixel ratio
 * @property {(opts?: RebuildOpts) => { samples: number, dofScale: number }} rebuild  dispose and
 *   re-create PostFX with new options, keeping the current settings
 * @property {(cx?: number, cy?: number, scale?: number) => boolean} zoom  magnify the canvas
 *   around CSS point (cx, cy) by `scale` (3); no `cx` resets
 * @property {(steps?: number, dx?: number) => FlickerReport} flickerTest  temporal stability of
 *   a slow pan (see the method)
 * @property {object|null} shimmerWorst  (getter) the worst tile of the last flickerTest
 * @property {(on?: boolean) => boolean} nanTest  add (default) / remove the NaN and +Inf quads
 * @property {(d: number|null) => number|null} focusOn  autofocus distance override (null = the
 *   camera target)
 * @property {() => { textures: number, geometries: number, programs: number }} memory
 * @property {(x: number) => number} setTargetX  move the camera target and refocus
 * @property {() => object} info  three revision, size, samples, taps, focus, GPU timings, draw
 *   calls, scene info, programs, textures
 */
window.__postfx = {
  get postfx() { return postfx; },
  renderer,
  scene,
  camera,
  CAM,
  set: setPath,
  reset,
  probeDepth: probe,
  freeze(on = true) { frozen = on; return frozen; },
  setPixelRatio(pr) { renderer.setPixelRatio(pr); onResize(); return renderer.getPixelRatio(); },
  rebuild(opts = {}) {
    const s = JSON.parse(JSON.stringify(postfx.settings));
    postfx.dispose();
    postfx = new PostFX(renderer, scene, camera, opts);
    for (const k of Object.keys(s)) {
      if (typeof s[k] === 'object') Object.assign(postfx.settings[k], s[k]);
      else postfx.settings[k] = s[k];
    }
    return { samples: postfx.samples, dofScale: postfx.dofScale };
  },
  /** Magnify a region of the canvas (CSS px) for close inspection in screenshots. */
  zoom(cx, cy, scale = 3) {
    const c = renderer.domElement;
    if (!cx) { c.style.transform = ''; c.style.imageRendering = ''; return false; }
    c.style.transformOrigin = `${cx}px ${cy}px`;
    c.style.transform = `scale(${scale})`;
    c.style.imageRendering = 'pixelated';
    return true;
  },
  /**
   * Temporal stability check: pans the camera in small steps (grain off), reads the frame back and
   * returns, per 8×5 screen tile, the largest |second difference| of mean luminance over time
   * (0..255 units). A smooth pan gives small values; popping / flickering bokeh gives spikes.
   * Also reports frame-to-frame determinism of a static frame (should be exactly 0).
   */
  flickerTest(steps = 24, dx = 0.013) {
    const gl = renderer.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const buf = new Uint8Array(w * h * 4);
    const TX = 8, TY = 5;
    const grain = postfx.settings.grade.grain;
    postfx.settings.grade.grain = 0;
    const wasFrozen = frozen;
    frozen = true;
    const tiles = () => {
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      const sums = new Float64Array(TX * TY);
      const counts = new Float64Array(TX * TY);
      for (let y = 0; y < h; y += 2) {
        const ty = Math.min(TY - 1, Math.floor((y / h) * TY));
        for (let x = 0; x < w; x += 2) {
          const i = (y * w + x) * 4;
          const k = ty * TX + Math.min(TX - 1, Math.floor((x / w) * TX));
          sums[k] += 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2];
          counts[k]++;
        }
      }
      return Array.from(sums, (s, k) => s / counts[k]);
    };
    // determinism: two identical frames
    postfx.render(0);
    const a = tiles();
    postfx.render(0);
    const b = tiles();
    const determinism = Math.max(...a.map((v, k) => Math.abs(v - b[k])));
    const x0 = CAM.target.x;
    const series = [];
    // per-pixel luminance history (every 3rd pixel) for shimmer bands: far (top 22%),
    // focus (45..60%), near (bottom 18%) — in GL coordinates y=0 is the bottom
    const SX = 3;
    const cols = Math.floor(w / SX);
    const rows = Math.floor(h / SX);
    const hist = [];
    for (let s = 0; s < steps; s++) {
      CAM.target.x = x0 + s * dx;
      placeCamera();
      postfx.setFocus(camera.position.distanceTo(CAM.target), true);
      postfx.render(0);
      series.push(tiles());
      const lum = new Float32Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = (r * SX * w + c * SX) * 4;
          lum[r * cols + c] = 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2];
        }
      }
      hist.push(lum);
    }
    const band = (y0, y1) => {
      let sum = 0;
      let n = 0;
      for (let r = Math.floor(y0 * rows); r < Math.floor(y1 * rows); r++) {
        for (let c = 0; c < cols; c++) {
          const k = r * cols + c;
          for (let s = 1; s < steps - 1; s++) {
            sum += Math.abs(hist[s + 1][k] - 2 * hist[s][k] + hist[s - 1][k]);
            n++;
          }
        }
      }
      return +(sum / n).toFixed(3);
    };
    const shimmer = { far: band(0.78, 1.0), focus: band(0.4, 0.55), near: band(0.0, 0.18) };
    CAM.target.x = x0;
    placeCamera();
    postfx.settings.grade.grain = grain;
    frozen = wasFrozen;
    const worst = new Array(TX * TY).fill(0);
    let worstAt = null;
    let worstVal = -1;
    for (let s = 1; s < steps - 1; s++) {
      for (let k = 0; k < TX * TY; k++) {
        const d2 = Math.abs(series[s + 1][k] - 2 * series[s][k] + series[s - 1][k]);
        worst[k] = Math.max(worst[k], d2);
        if (d2 > worstVal) { worstVal = d2; worstAt = { step: s, tileX: k % TX, tileY: TY - 1 - Math.floor(k / TX), series: series.map((f) => +f[k].toFixed(2)) }; }
      }
    }
    shimmerWorst = worstAt;
    return {
      determinism: +determinism.toFixed(4),
      maxSecondDiff: +Math.max(...worst).toFixed(3),
      meanSecondDiff: +(worst.reduce((p, c) => p + c, 0) / worst.length).toFixed(3),
      shimmer,
    };
  },
  get shimmerWorst() { return shimmerWorst; },
  /** Adds (or removes) two small quads that output NaN and +Inf, to prove the post chain scrubs them. */
  nanTest(on = true) {
    if (!nanTestGroup) {
      nanTestGroup = new THREE.Group();
      const mk = (expr, x, z) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.ShaderMaterial({
          uniforms: { uNeg: { value: -1 }, uZero: { value: 0 } },
          vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: `uniform float uNeg; uniform float uZero; void main(){ gl_FragColor = vec4(vec3(${expr}), 1.0); }`,
        }));
        m.position.set(x, 1.6, z);
        nanTestGroup.add(m);
      };
      mk('sqrt(uNeg)', -3.5, -12);   // NaN, far field
      mk('1.0 / uZero', 3.8, -1.5);  // +Inf, focus band
    }
    if (on) scene.add(nanTestGroup); else scene.remove(nanTestGroup);
    return on;
  },
  /** Override the autofocus target (null = focus on the camera target). */
  focusOn(d) { focusOverride = d; return d; },
  memory() { const m = renderer.info.memory; return { textures: m.textures, geometries: m.geometries, programs: renderer.info.programs.length }; },
  setTargetX(x) { CAM.target.x = x; placeCamera(); postfx.setFocus(camera.position.distanceTo(CAM.target), true); return x; },
  info() {
    const gl = renderer.getContext();
    return {
      three: THREE.REVISION,
      size: postfx.size,
      samples: postfx.sceneTarget.samples,
      maxSamples: renderer.capabilities.maxSamples,
      msaaRTTExt: !!gl.getExtension('WEBGL_multisampled_render_to_texture'),
      taps: postfx.taps,
      focus: +postfx.settings.dof.focusDistance.toFixed(3),
      timingsSupported: postfx.enableTimings(true),
      timings: postfx.timings,
      drawCalls: renderer.info.render.calls,
      sceneInfo: { ...postfx.sceneInfo },
      programs: renderer.info.programs?.length,
      textures: renderer.info.memory.textures,
    };
  },
};
console.log('postfx sandbox ready');
