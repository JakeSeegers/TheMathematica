/**
 * UI sandbox: a small golden-hour diorama rendered with raw three.js plus every UI component.
 * Keys: any key dismisses the title · Space talk/advance · ↑/↓ choices · ` debug · H help ·
 * P photo mode · T advance time · B banner · G toast · V fade (F is confirm).
 * `?combat=1` adds the combat UI (COMBAT.md §13): 30 enemy cubes with bars / pips, numbers, edge
 * arrows, reticle, vitals, skill bar, loot feed, boss bar, announcer, death screen, a painted fake
 * minimap, and the title's destination row (keys there: J numbers · K damage · U cast Whirl Slash).
 * `__sandbox.combat.panelProbe()` / `panelOverlaps()` put labels and edge arrows right under the HUD
 * panels and measure what still overlaps one (COMBAT-07: nothing).
 * Handles for scripted checks: window.__ui, window.__sandbox (`window.__sandbox.combat` in combat mode).
 */
import * as THREE from 'three';
import { UI } from '../src/engine/ui/UI.js';
import { CombatHUD } from '../src/engine/ui/CombatHUD.js';
import { BossBar } from '../src/engine/ui/BossBar.js';
import { WorldLabels } from '../src/engine/ui/WorldLabels.js';
import { Announcer } from '../src/engine/ui/Announcer.js';
import { DeathScreen } from '../src/engine/ui/DeathScreen.js';
import { PixelCanvas } from '../src/engine/pixel/PixelCanvas.js';
import { PALETTE } from '../src/engine/pixel/Palette.js';
import { RNG, clamp, lerp, smoothstep, DEG2RAD } from '../src/engine/utils/math.js';

/** Combat UI test bench (`?combat=1`). */
const COMBAT = new URLSearchParams(location.search).get('combat') === '1';

// ---------------------------------------------------------------------------------------------
// Stub Input (the real Input module is written concurrently) — only what DialogBox needs + toggles
// ---------------------------------------------------------------------------------------------
class StubInput {
  constructor() {
    this.bindings = {
      confirm: ['Space', 'Enter', 'KeyF'], cancel: ['Escape', 'Backspace'],
      up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
      debug: ['Backquote', 'F1'], help: ['KeyH'], photo: ['KeyP'], time: ['KeyT'],
      banner: ['KeyB'], toast: ['KeyG'], fade: ['KeyV'],
    };
    this._pressed = new Set();
    this._down = new Set();
    this._onDown = (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1', 'Backquote'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this._pressed.add(e.code);
      this._down.add(e.code);
    };
    this._onUp = (e) => this._down.delete(e.code);
    window.addEventListener('keydown', this._onDown);
    window.addEventListener('keyup', this._onUp);
  }
  isDown(code) { return this._down.has(code); }
  wasPressed(code) { return this._pressed.has(code); }
  action(name) { const b = this.bindings[name]; if (!b) return false; for (const c of b) if (this._down.has(c)) return true; return false; }
  actionPressed(name) { const b = this.bindings[name]; if (!b) return false; for (const c of b) if (this._pressed.has(c)) return true; return false; }
  endFrame() { this._pressed.clear(); }
}

// ---------------------------------------------------------------------------------------------
// Renderer / scene
// ---------------------------------------------------------------------------------------------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 0.5, 400);
const camState = { yaw: 0, pitch: 32 * DEG2RAD, distance: 24, target: new THREE.Vector3(0, 0.6, 0) };

// sky gradient background
function makeSky(top, mid, bottom) {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top); grad.addColorStop(0.55, mid); grad.addColorStop(1, bottom);
  g.fillStyle = grad; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const skyDay = makeSky('#4a6b9c', '#e9b98a', '#f4c690');
const skyNight = makeSky('#070b1e', '#1b2448', '#2a3158');
scene.background = skyDay;
scene.fog = new THREE.Fog(0xe0a47a, 34, 80);

const disposables = [];
function track(o) { disposables.push(o); return o; }

// pixel textures (foundation PixelCanvas)
function grassTexture() {
  const pc = new PixelCanvas(16, 16);
  pc.wrap = true;
  pc.fillNoise(PALETTE.grass.slice(2, 5), { scale: 4, period: 4, seed: 11, dither: 0.45 });
  const rng = new RNG(5);
  pc.speckle(PALETTE.grass[4], 0.035, rng);
  pc.speckle(PALETTE.grass[5], 0.012, rng);
  const t = pc.toTexture({ wrap: 'repeat', mipmaps: true });
  t.repeat.set(30, 30);
  return track(t);
}
function stoneTexture() {
  const pc = new PixelCanvas(16, 16);
  pc.wrap = true;
  pc.fillNoise(PALETTE.stoneWarm.slice(2, 6), { scale: 4, period: 4, seed: 3, dither: 0.6 });
  const mortar = PALETTE.stoneWarm[1];
  for (let i = 0; i < 16; i++) { pc.set(i, 0, mortar); pc.set(i, 8, mortar); }
  for (let j = 0; j < 8; j++) { pc.set(0, j, mortar); pc.set(8, j + 8, mortar); }
  const t = pc.toTexture({ wrap: 'repeat', mipmaps: true });
  t.repeat.set(4, 4);
  return track(t);
}
function plasterTexture() {
  const pc = new PixelCanvas(16, 16);
  pc.wrap = true;
  pc.fillNoise(PALETTE.plaster.slice(2, 5), { scale: 3, period: 3, seed: 8, dither: 0.8 });
  const beam = PALETTE.wood[1];
  for (let i = 0; i < 16; i++) { pc.set(i, 0, beam); pc.set(i, 15, beam); pc.set(0, i, beam); }
  const t = pc.toTexture({ wrap: 'repeat', mipmaps: true });
  return track(t);
}
function roofTexture(ramp) {
  const pc = new PixelCanvas(16, 16);
  pc.wrap = true;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const row = y >> 2;
      const off = (row % 2) * 2;
      const edge = y % 4 === 3 || (x + off) % 4 === 0;
      pc.set(x, y, edge ? ramp[1] : ramp[(x * 7 + y * 3) % 3 + 2]);
    }
  }
  return track(pc.toTexture({ wrap: 'repeat', mipmaps: true }));
}

const grassMat = track(new THREE.MeshLambertMaterial({ map: grassTexture() }));
const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(60, 60)), grassMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const plaza = new THREE.Mesh(track(new THREE.PlaneGeometry(8, 8)), track(new THREE.MeshLambertMaterial({ map: stoneTexture() })));
plaza.rotation.x = -Math.PI / 2;
plaza.position.y = 0.01;
plaza.receiveShadow = true;
scene.add(plaza);

const plasterTex = plasterTexture();
const roofRed = roofTexture(PALETTE.roofRed);
const roofBlue = roofTexture(PALETTE.roofBlue);
const windowMat = track(new THREE.MeshLambertMaterial({ color: 0x2a1c14, emissive: 0xffb45a, emissiveIntensity: 0.8 }));
const doorMat = track(new THREE.MeshLambertMaterial({ color: 0x4a2c1a }));
const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));
const roofGeo = track(new THREE.ConeGeometry(1, 1, 4, 1));
const winGeo = track(new THREE.PlaneGeometry(0.5, 0.55));

function house(x, z, w, d, h, roofTex, rot = 0) {
  const g = new THREE.Group();
  const tex = plasterTex.clone();
  tex.repeat.set(w, h);
  track(tex);
  const body = new THREE.Mesh(boxGeo, track(new THREE.MeshLambertMaterial({ map: tex })));
  body.scale.set(w, h, d);
  body.position.y = h / 2;
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  const roof = new THREE.Mesh(roofGeo, track(new THREE.MeshLambertMaterial({ map: roofTex })));
  roof.scale.set(w * 0.82, 1.6, d * 0.82);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = h + 0.8;
  roof.castShadow = roof.receiveShadow = true;
  g.add(roof);
  for (let i = 0; i < 2; i++) {
    const win = new THREE.Mesh(winGeo, windowMat);
    win.position.set((i - 0.5) * w * 0.5, h * 0.62, d / 2 + 0.01);
    g.add(win);
  }
  const door = new THREE.Mesh(track(new THREE.PlaneGeometry(0.6, 1.0)), doorMat);
  door.position.set(w * 0.28, 0.5, d / 2 + 0.012);
  g.add(door);
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  scene.add(g);
  return g;
}
house(-5.5, -4.5, 3.4, 2.6, 2.2, roofRed, 0.12);
house(4.8, -5.2, 3.0, 2.4, 2.6, roofBlue, -0.18);
house(-7.5, 2.8, 2.6, 2.2, 1.9, roofBlue, 0.5);

// trees
const trunkMat = track(new THREE.MeshLambertMaterial({ color: 0x5c3a22 }));
const leafMat = track(new THREE.MeshLambertMaterial({ color: 0x4f8f3d, flatShading: true }));
const leafMat2 = track(new THREE.MeshLambertMaterial({ color: 0xc9772f, flatShading: true }));
const trunkGeo = track(new THREE.CylinderGeometry(0.16, 0.22, 1.4, 6));
const canopyGeo = track(new THREE.IcosahedronGeometry(1, 0));
const rng = new RNG(42);
const trees = [];
for (const [x, z, autumn] of /** @type {[number, number, boolean][]} */ ([[7.5, 1.5, false], [8.6, -1.8, true], [-2.5, -8.5, false], [2.2, -9, true], [-9.5, -1.5, false], [6.5, 6.5, false], [-4.5, 7.5, true]])) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 0.7;
  trunk.castShadow = true;
  const canopy = new THREE.Mesh(canopyGeo, autumn ? leafMat2 : leafMat);
  const s = rng.range(1.0, 1.35);
  canopy.scale.set(s, s * 1.1, s);
  canopy.position.y = 1.4 + s * 0.8;
  canopy.rotation.set(rng.range(0, 3), rng.range(0, 3), 0);
  canopy.castShadow = canopy.receiveShadow = true;
  g.add(trunk, canopy);
  g.position.set(x, 0, z);
  scene.add(g);
  trees.push(canopy);
}

// crates & a well-ish cylinder
const crateMat = track(new THREE.MeshLambertMaterial({ color: 0x9f6f40 }));
for (const [x, z, s] of [[2.8, 2.6, 0.8], [3.5, 2.4, 0.6], [3.1, 3.3, 0.7], [-2.6, 3.2, 0.7]]) {
  const c = new THREE.Mesh(boxGeo, crateMat);
  c.scale.setScalar(s);
  c.position.set(x, s / 2, z);
  c.rotation.y = x * 0.7;
  c.castShadow = c.receiveShadow = true;
  scene.add(c);
}
const well = new THREE.Mesh(track(new THREE.CylinderGeometry(0.8, 0.9, 0.8, 12)), track(new THREE.MeshLambertMaterial({ color: 0x8a7d72 })));
well.position.set(-1.8, 0.4, -1.4);
well.castShadow = well.receiveShadow = true;
scene.add(well);

// lantern post + warm point light
const post = new THREE.Mesh(track(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 6)), track(new THREE.MeshLambertMaterial({ color: 0x23222f })));
post.position.set(1.6, 1.2, -2.2);
post.castShadow = true;
scene.add(post);
const lanternMat = track(new THREE.MeshLambertMaterial({ color: 0x3a2a10, emissive: 0xffc27a, emissiveIntensity: 2.2 }));
const lantern = new THREE.Mesh(track(new THREE.BoxGeometry(0.34, 0.42, 0.34)), lanternMat);
lantern.position.set(1.6, 2.5, -2.2);
scene.add(lantern);
const lanternLight = new THREE.PointLight(0xffb46b, 9, 9, 2);
lanternLight.position.set(1.6, 2.3, -2.2);
scene.add(lanternLight);

// the moving "NPC" cube that the interaction prompt tracks
const npc = new THREE.Mesh(track(new THREE.BoxGeometry(0.8, 1.2, 0.8)), track(new THREE.MeshLambertMaterial({ color: 0xbf3b3b })));
npc.castShadow = npc.receiveShadow = true;
scene.add(npc);

// lights
const sun = new THREE.DirectionalLight(0xffb070, 3.2);
sun.position.set(-14, 9, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
sun.shadow.radius = 3;
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xa9bcff, 0x6a4a34, 1.15);
scene.add(hemi);

// ---------------------------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------------------------
const input = new StubInput();
const ui = new UI(document.body);
ui.hud.visible = false;
ui.hud.setLocation('Emberfall', 'Riverside Village');
ui.hud.setControls([
  { keys: 'WASD', label: 'Move' },
  { keys: 'Space', label: 'Talk / Confirm' },
  { keys: 'Q/E', label: 'Rotate camera' },
  { keys: 'Wheel', label: 'Zoom' },
  { keys: 'T', label: 'Time of day' },
  { keys: 'P', label: 'Photo mode' },
  { keys: '`', label: 'Debug panel' },
]);
ui.prompt.keyHint = 'Space';

const state = {
  time: 17.2,
  timeSpeed: 0,
  introDone: false,
  talking: false,
  charCount: 0,
  results: [],
  faded: false,
};
ui.dialog.onChar = () => { state.charCount++; };

const COLORS = {
  sunDay: new THREE.Color(0xffb070), sunNight: new THREE.Color(0x7d95d8),
  hemiSkyDay: new THREE.Color(0x9fb4ff), hemiSkyNight: new THREE.Color(0x2a3a78),
  fogDay: new THREE.Color(0xe0a47a), fogNight: new THREE.Color(0x141a36),
};
function applyTime(h) {
  // 0 = day, 1 = night (smooth around 6h / 19.5h)
  const night = 1 - smoothstep(4.8, 7, h) * (1 - smoothstep(18.6, 20.8, h));
  sun.color.copy(COLORS.sunDay).lerp(COLORS.sunNight, night);
  sun.intensity = lerp(params.sun, 0.55, night);
  hemi.color.copy(COLORS.hemiSkyDay).lerp(COLORS.hemiSkyNight, night);
  hemi.intensity = lerp(1.15, 0.5, night);
  scene.fog.color.copy(COLORS.fogDay).lerp(COLORS.fogNight, night);
  scene.background = night > 0.5 ? skyNight : skyDay;
  state.lanternBase = params.lantern * lerp(0.25, 1.6, night);
  windowMat.emissiveIntensity = lerp(0.4, 2.2, night);
  ui.hud.setTime(h);
}

// ---------------------------------------------------------------------------------------------
// Debug panel sample controls
// ---------------------------------------------------------------------------------------------
const params = {
  sun: 3.2, lantern: 9, exposure: 1.1, typeSpeed: 45, orbit: true,
  bloom: true, dofRange: 5, grade: 'Golden Hour', tint: '#ffb46b', label: 'Talk',
};
const fLight = ui.debug.addFolder('Time & Lighting');
fLight.add(state, 'time', 0, 24, 0.01).name('Time of day').listen().onChange((v) => applyTime(v));
fLight.add(state, 'timeSpeed', 0, 2, 0.01).name('Hours / sec');
fLight.add(params, 'sun', 0, 5, 0.05).name('Sun intensity').onChange(() => applyTime(state.time));
fLight.add(params, 'lantern', 0, 30, 0.1).name('Lantern').onChange(() => applyTime(state.time));
fLight.add(params, 'exposure', 0.4, 2, 0.01).name('Exposure').onChange((v) => { renderer.toneMappingExposure = v; });
fLight.addColor(params, 'tint').name('Lantern color').onChange((v) => lanternLight.color.set(v));
const fPost = ui.debug.addFolder('Post FX');
fPost.add(params, 'bloom').name('Bloom');
fPost.add(params, 'dofRange', 1, 12, 0.1).name('Focus range');
fPost.add(params, 'grade', ['Golden Hour', 'Cool Night', 'Neutral']).name('Grade');
const fUI = ui.debug.addFolder('Interface');
fUI.add(params, 'typeSpeed', 5, 120, 1).name('Typewriter cps').onChange((v) => { ui.dialog.speed = v; });
fUI.add(params, 'orbit').name('Animate NPC');
fUI.add(params, 'label').name('Prompt label');
fUI.add({ dialog: () => startDialog() }, 'dialog').name('Open dialog');
fUI.add({ banner: () => ui.banner.show('Emberfall', 'The Riverside Village') }, 'banner').name('Show banner');
fUI.add({ toast: () => ui.hud.toast('Journal updated: The Old Mill') }, 'toast').name('Toast');
fUI.add({ fade: () => ui.fader.fadeOut(0.6).then(() => ui.fader.fadeIn(0.6)) }, 'fade').name('Fade out / in');
fPost.close();

// ---------------------------------------------------------------------------------------------
// Dialog / flow
// ---------------------------------------------------------------------------------------------
function startDialog() {
  if (ui.dialog.isOpen) return ui.dialog;
  state.talking = true;
  ui.prompt.hide();
  const p = ui.dialog.open({
    speaker: 'Agnea',
    portraitColor: '#e0674f',
    lines: [
      'Welcome to {Emberfall}, traveler! The river runs gentle this time of year, and the lanterns are lit by dusk…',
      { speaker: 'Old Hedric', text: 'Mind the path after dark. The fireflies gather by the {old windmill}, and the stones grow slick with dew.' },
      { speaker: 'Old Hedric', text: 'They say the mill has turned without rest for a hundred years. Some nights, you can hear it sing.' },
      { speaker: 'Agnea', text: 'Will you rest at the inn tonight?', choices: ['Yes, a warm bed sounds lovely.', 'Not yet — I would see the village first.', 'Tell me more about the mill.'] },
    ],
  });
  p.then((choice) => {
    state.results.push(choice);
    state.talking = false;
    if (choice !== undefined) ui.hud.toast(['You rest at the Ember Inn.', 'You set off to explore.', 'Hedric smiles knowingly.'][choice] ?? 'Farewell.');
  });
  return p;
}

async function intro() {
  await ui.fontsReady;
  await ui.title.show({ title: 'Luminati', subtitle: 'Chronicles of the Ember Road', prompt: 'Press any key',
    ...(COMBAT ? { destinations: DESTINATIONS, current: 'emberfall' } : {}) });
  await new Promise((r) => setTimeout(r, 650));
  ui.hud.visible = true;
  await ui.banner.show('Emberfall', 'The Riverside Village');
  state.introDone = true;
}
intro();

// ---------------------------------------------------------------------------------------------
// Combat UI (?combat=1): the COMBAT.md §13 components on the same diorama
// ---------------------------------------------------------------------------------------------
const DESTINATIONS = [
  { value: 'emberfall', label: 'Emberfall' },
  { value: 'cinderwatch-pass', label: 'Cinderwatch Pass' },
  { value: 'starfall-vale', label: 'Starfall Vale' },
  { value: 'gildhaven', label: 'Gildhaven' },
  { value: 'brightwater-crossing', label: 'Brightwater Crossing' },
  { value: 'sample-hamlet', label: 'Willowmere' },
];
/** @type {Parameters<CombatHUD['configureSkills']>[0]} */
const SKILLS = [
  { id: 'skill1', label: 'Whirl Slash', keys: 'U/1', padKeys: 'LT+X', icon: 'whirl' },
  { id: 'skill2', label: 'Ember Bolt', keys: 'I/2', padKeys: 'LT+Y', icon: 'bolt' },
  { id: 'skill3', label: 'Radiant Nova', keys: 'O/3', padKeys: 'LT+B', icon: 'nova' },
  { id: 'draught', label: 'Draught', keys: 'C/4', padKeys: 'Y', icon: 'draught' },
];
/** @type {Parameters<WorldLabels['number']>[4][]} */
const NUMBER_KINDS = ['dmg', 'crit', 'hurt', 'heal', 'mp', 'guard', 'perfect', 'dmg', 'dmg'];
const ENEMY_NAMES = ['Bramble Goblin', 'Thorn Archer', 'Hex Shaman', 'Ironhide Boar', 'Moss Slime'];

/**
 * Build the combat test bench: 30 enemy cubes, the combat UI, a painted fake minimap and the
 * `window.__sandbox.combat` hooks used by `ui.combat.actions.json`.
 */
function setupCombat() {
  // (the documented form: register the classes once, then `enableCombat()` without arguments)
  UI.useCombatUI({ CombatHUD, BossBar, WorldLabels, Announcer, DeathScreen });
  const c = ui.enableCombat();
  const crng = new RNG(0xc0ba7);
  // 30 "enemies" on a jittered 6 × 5 grid round the plaza
  const enemyMat = track(new THREE.MeshLambertMaterial({ color: 0x6b2c4a }));
  const eliteMat = track(new THREE.MeshLambertMaterial({ color: 0xc9a45c }));
  const enemyGeo = track(new THREE.BoxGeometry(0.5, 0.7, 0.5));
  const enemies = [];
  for (let j = 0; j < 5; j++) {
    for (let i = 0; i < 6; i++) {
      const k = enemies.length;
      const m = new THREE.Mesh(enemyGeo, k % 7 === 0 ? eliteMat : enemyMat);
      const x = -8.5 + i * 3.4 + crng.range(-0.6, 0.6);
      const z = -6 + j * 3 + crng.range(-0.5, 0.5);
      m.position.set(x, 0.35, z);
      m.castShadow = true;
      scene.add(m);
      enemies.push({ mesh: m, home: m.position.clone(), phase: crng.range(0, 6.28) });
    }
  }
  // off-screen anchors for the edge arrows: left, right, far (top), near (bottom), diagonals, behind
  const offscreen = [
    new THREE.Vector3(-34, 0, 0), new THREE.Vector3(34, 0, -2), new THREE.Vector3(0, 0, -90), new THREE.Vector3(2, 0, 15),
    new THREE.Vector3(-30, 0, -40), new THREE.Vector3(30, 0, 12), new THREE.Vector3(-16, 0, 40), new THREE.Vector3(6, 0, 60),
  ];

  const vit = { hp: 148, hpMax: 148, mp: 60, mpMax: 60, sp: 100, spMax: 100, level: 5, xp: 212, xpNext: 409, winded: false };
  const cds = [0, 0, 0];
  const cdTotal = [4, 1.5, 12];
  const skillState = [{ locked: false }, { locked: false }, { locked: true }];
  let gold = 128;
  let potions = 3;

  // fake painted map (40 × 40 u, 4 px per u) for the minimap: grass, a path, a pond
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = 160;
  mapCanvas.height = 160;
  {
    const g = mapCanvas.getContext('2d');
    g.fillStyle = '#4f7a3a'; g.fillRect(0, 0, 160, 160);
    g.fillStyle = '#b18a5c'; g.fillRect(0, 76, 160, 8); g.fillRect(76, 0, 8, 160);
    g.fillStyle = '#3b7fa6'; g.beginPath(); g.arc(122, 38, 16, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#a4493b'; g.fillRect(40, 40, 18, 14); g.fillRect(96, 100, 16, 14);
  }
  const map = { canvas: mapCanvas, pixelsPerTile: 4, width: 40, depth: 40 };
  ui.minimap.setMap(map, { view: 34 });
  ui.worldMap.setMap(map, { title: 'Combat Sandbox', subtitle: 'COMBAT.md §13', combat: true });
  const mapState = {
    player: new THREE.Vector3(20, 0, 20),
    facing: { x: 0, z: -1 },
    view: { x: 0, z: -1 },
    npcs: [{ x: 16, z: 22 }],
    markers: [{ x: 26, z: 16, kind: 'waystone' }, { x: 12, z: 26, kind: 'chest' }, { x: 28, z: 28, kind: 'boss' }, { x: 20, z: 13, kind: 'fire' }],
    enemies: enemies.map((e) => ({ x: 20 + e.home.x, z: 20 + e.home.z })),
  };

  function setup() {
    c.hud.configureSkills(SKILLS);
    c.hud.setGold(gold);
    c.hud.setPotions(potions, 5);
    c.hud.setCalm(false);
  }

  function frame(dt, t) {
    // enemies bob and sway (the labels must follow)
    for (const e of enemies) {
      e.mesh.position.x = e.home.x + Math.sin(t * 0.7 + e.phase) * 0.35;
      e.mesh.position.y = e.home.y + Math.abs(Math.sin(t * 3 + e.phase)) * 0.12;
    }
    // per-frame HUD writes like combat's afterPlayer (they only touch the DOM on change)
    c.hud.setVitals(vit);
    for (let i = 0; i < 3; i++) {
      if (cds[i] > 0) cds[i] = Math.max(0, cds[i] - dt);
      c.hud.setSkill(i, { cooldown: cds[i] / cdTotal[i], seconds: cds[i], locked: skillState[i].locked, affordable: vit.mp >= [10, 8, 18][i] });
    }
    c.hud.setSkill(3, { cooldown: 0, seconds: 0, locked: false, affordable: potions > 0 });
    c.hud.setPotions(potions, 5);
    c.hud.setGold(gold);
    if (ui.minimap.visible) ui.minimap.update(mapState);
    if (ui.worldMap.isOpen) ui.worldMap.update(dt, mapState);
  }

  const results = { title: [], death: [] };
  let fakePad = null;
  /** World anchors of panelProbe() (kept alive: the labels read them every frame). */
  const panelAnchors = [];
  const api = {
    enemies,
    vit,
    results,
    setup,
    /** Spawn n floating numbers over the enemies, cycling every kind. */
    numbers(n = 40) {
      for (let i = 0; i < n; i++) {
        const e = enemies[i % enemies.length].mesh.position;
        const kind = NUMBER_KINDS[i % NUMBER_KINDS.length];
        c.labels.number(e.x, e.y + 0.35, e.z, 5 + ((i * 37) % 180), kind);
      }
      return c.labels.liveNumbers;
    },
    /** n bars on the first n enemies, the last `pips` of them in pip mode; every 7th elite. */
    bars(n = 30, pips = 10) {
      for (let i = 0; i < n; i++) {
        const elite = i % 7 === 0;
        c.labels.bar(i).anchor(enemies[i].mesh.position, 0.95)
          .set(0.15 + ((i * 29) % 85) / 100, { elite, level: 1 + (i % 6), name: elite ? `${ENEMY_NAMES[i % 5]} Captain` : ENEMY_NAMES[i % 5], pip: i >= n - pips })
          .show();
      }
      for (let i = n; i < 32; i++) c.labels.bar(i).hide();
    },
    hideBars() { for (let i = 0; i < 32; i++) c.labels.bar(i).hide(); },
    /** Damage bar i to frac (the lag fill trails). */
    hitBar(i, frac) { const elite = i % 7 === 0; c.labels.bar(i).set(frac, { elite, level: 1 + (i % 6), name: elite ? `${ENEMY_NAMES[i % 5]} Captain` : ENEMY_NAMES[i % 5] }); },
    edges(n = 8) {
      for (let i = 0; i < 8; i++) {
        const h = c.labels.edge(i);
        if (i < n) h.anchor(offscreen[i], 1).set({ windup: i % 2 === 0 }).show();
        else h.hide();
      }
    },
    /** Screen boxes of the visible edge arrows (tests). */
    edgeBoxes() {
      return [...document.querySelectorAll('.lu-edge.is-on:not(.is-in) .lu-edge__a')].map((el) => {
        const r = el.getBoundingClientRect();
        return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)];
      });
    },
    reticle(i = 3) { c.labels.reticle(i == null ? null : enemies[i].mesh.position, 0.35); },
    alerts() { for (let i = 0; i < 8; i++) c.labels.alert(enemies[20 + i].mesh.position, 1.05); },
    /** Player takes damage: the HP bar drains with its lag, a hurt number over the NPC. */
    damage(n = 40) {
      vit.hp = Math.max(0, vit.hp - n);
      c.labels.number(npc.position.x, npc.position.y + 0.9, npc.position.z, n, 'hurt');
      return vit.hp;
    },
    heal(n = 60) { vit.hp = Math.min(vit.hpMax, vit.hp + n); c.labels.number(npc.position.x, npc.position.y + 0.9, npc.position.z, n, 'heal'); },
    setVitals(v) { Object.assign(vit, v); },
    cast(i) { cds[i] = cdTotal[i]; vit.mp = Math.max(0, vit.mp - [10, 8, 18][i]); },
    unlock(i, on = true) { skillState[i].locked = !on; },
    drink() { potions = Math.max(0, potions - 1); },
    addGold(n) { gold += n; },
    /** @param {[string, Parameters<CombatHUD['loot']>[1]][]} [list]  [text, kind] rows */
    loot(list = [['+12 gold', 'gold'], ['Heart', 'heart'], ['Mana mote', 'mana'], ['Healing Draught', 'draught'], ['Max HP +10', 'upgrade'], ['Ember Core', 'core']]) {
      for (const [t, k] of list) c.hud.loot(t, k);
    },
    device(d) {
      c.hud.setDevice(d);
      return [...document.querySelectorAll('.lu-skill__keys')].filter((el) => getComputedStyle(el).display !== 'none').map((el) => el.textContent).join(' | ');
    },
    boss(on = true) {
      if (on) { c.boss.show({ name: 'Cinderheart', epithet: 'The Last Fire of the Pass', phases: 3 }); c.boss.set(1, 1); } else c.boss.hide();
    },
    bossHit(frac, phase) { c.boss.set(frac, phase); },
    announce() {
      results.announce = [];
      c.announcer.announce('Level 6', 'Max HP +12 · ATK +3 · Radiant Nova learned').then(() => results.announce.push('level'));
      c.announcer.announce('Cinderwatch Pass — Cleared', '4:12 · 37 foes · 2 falls · 5 perfect dodges · Lv 6', { duration: 7, kind: 'results' })
        .then(() => results.announce.push('results'));
    },
    death(armDelay = 1.0) {
      results.death.push('pending');
      const k = results.death.length - 1;
      c.death.show({ title: 'You Have Fallen', subtitle: '', prompt: 'Press any key to rise at the camp', armDelay })
        .then((how) => { results.death[k] = how ?? 'undefined'; });
    },
    /** Top of the vitals box (tests: it must not move with the location plate). */
    vitalsTop() { return Math.round(c.hud.vitalsElement.getBoundingClientRect().top * 100) / 100; },
    /** Show the title with the destination row; the result lands in results.title. */
    titleCase(withDest = true) {
      results.title.push({ source: 'pending', destination: null });
      const k = results.title.length - 1;
      ui.title.show({ title: 'Luminati', subtitle: 'Chronicles of the Ember Road', ...(withDest ? { destinations: DESTINATIONS, current: 'emberfall' } : {}) })
        .then((source) => { results.title[k] = { source: source ?? 'undefined', destination: ui.title.destination }; });
      return k;
    },
    /** Replace navigator.getGamepads with one fake standard pad (tests). */
    installFakePad() {
      fakePad = { id: 'fake', mapping: 'standard', connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
      navigator.getGamepads = () => [fakePad];
      return true;
    },
    /** Press gamepad button b for ms (needs installFakePad). */
    padPress(b, ms = 120) {
      fakePad.buttons[b].pressed = true;
      setTimeout(() => { fakePad.buttons[b].pressed = false; }, ms);
    },
    /**
     * COMBAT-07: labels and edge arrows right under the HUD panels. For every shown panel a world
     * point on the ground (y 0) that projects onto the panel's centre gets a number, a bar (slot
     * 24 + k) and an alert; edge arrows 0..4 point at far points beyond the panels' corners (top
     * left: plate, top right: clock / minimap, bottom left: legend, bottom right: skills, bottom
     * centre: boss bar). Returns the panel count.
     */
    panelProbe() {
      const panels = c.labels._panels.filter((p) => p.on);
      const ray = new THREE.Raycaster();
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const W = window.innerWidth;
      const H = window.innerHeight;
      const ground = (nx, ny, far = 0) => {
        ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
        const hit = new THREE.Vector3();
        if (!far && ray.ray.intersectPlane(plane, hit)) return hit;
        return ray.ray.at(far || 60, hit);
      };
      panelAnchors.length = 0;
      panels.forEach((p, k) => {
        const nx = ((p.l + p.r) / 2 / W) * 2 - 1;
        const ny = 1 - ((p.t + p.b) / 2 / H) * 2;
        const v = ground(nx, ny);
        panelAnchors.push(v);
        c.labels.number(v.x, v.y, v.z, 100 + k, k % 2 ? 'crit' : 'dmg');
        c.labels.bar(24 + (k % 8)).anchor(v, 0).set(0.6, { elite: k === 2, level: 3, name: 'Panel Probe', pip: k === 4 }).show();
        c.labels.alert(v, 0.6);
      });
      // off-screen points past the panel corners: their arrows land on the panels
      const dirs = [[-1.4, 1.4], [1.4, 1.35], [-1.4, -1.35], [1.4, -1.4], [0.02, -1.6]];
      dirs.forEach(([nx, ny], i) => {
        const v = ground(nx, ny, 0);
        const far = ny > 0 ? ground(nx, ny, 90) : v;
        panelAnchors.push(far);
        c.labels.edge(i).anchor(far, 0).set({ windup: false }).show();
      });
      for (let i = dirs.length; i < 8; i++) c.labels.edge(i).hide();
      return panels.length;
    },
    /**
     * COMBAT-07 (review fix): with every HUD panel shown — the controls legend and the boss bar
     * included — a number, a bar (slot 31) and the reticle anchored on the ground at screen point
     * (fx, fy) (default: the open lower middle, between the legend and the skill bar, above the boss
     * bar) are drawn at their anchor. The legend + boss-bar union used to be one keep-out zone that
     * pushed them up beside the player. Resolves the drift (px) of each after two frames and the
     * frame's keep-out zones.
     */
    openDrift(fx = 0.5, fy = 0.8) {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(fx * 2 - 1, 1 - fy * 2), camera);
      const v = new THREE.Vector3();
      ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), v);
      panelAnchors.push(v);
      const L = c.labels;
      L.number(v.x, v.y, v.z, 77, 'dmg');
      L.bar(31).anchor(v, 0).set(0.5, { level: 2, name: 'Open Probe' }).show();
      L.reticle(v, 0);
      const r2 = (x) => Math.round(x * 100) / 100;
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
        L._screen(v.x, v.y, v.z);
        const ax = L._sx;
        const ay = L._sy;
        const n = L._nums.find((o) => o.live && o.wx === v.x && o.wz === v.z);
        const b = L._bars[31];
        const r = L._reticle;
        const drift = {
          number: n ? r2(Math.hypot(n.x - (ax + n.dx), n.y - (ay + n.dy))) : null,
          bar: r2(Math.hypot(b.x - ax, b.y - ay)),
          reticle: r2(Math.hypot(r.x - ax, r.y - ay)),
        };
        resolve({
          anchor: [Math.round(ax), Math.round(ay)],
          panels: L._panels.filter((p) => p.on).length,
          zones: L._zones.slice(0, L._zoneN).map((z) => [z.l, z.t, z.r, z.b].map(Math.round)),
          drift,
        });
      })));
    },
    /**
     * Boxes of the visible labels (numbers, bars, alerts, reticle corners, edge arrows) that overlap
     * a shown HUD panel (tests; layout reads — call outside timed windows).
     */
    panelOverlaps() {
      const panels = c.labels._panels.filter((p) => p.on).map((p) => ({ name: p.el.className.split(' ')[0], r: p.el.getBoundingClientRect() }));
      const sel = '.lu-num.is-a:not(.is-out) .lu-num__t, .lu-num.is-b:not(.is-out) .lu-num__t, .lu-ebar.is-on:not(.is-out) .lu-ebar__frame, '
        + '.lu-ebar.is-on:not(.is-out) .lu-ebar__pip, .lu-ebar.is-on:not(.is-out) .lu-ebar__name, .lu-alert.is-a:not(.is-out) .lu-alert__i, .lu-alert.is-b:not(.is-out) .lu-alert__i, '
        + '.lu-reticle.is-on:not(.is-out) .lu-reticle__c, .lu-edge.is-on:not(.is-in) .lu-edge__a';
      const out = [];
      let checked = 0;
      for (const el of document.querySelectorAll(sel)) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        checked++;
        for (const p of panels) {
          const r = p.r;
          const ox = Math.min(b.right, r.right) - Math.max(b.left, r.left);
          const oy = Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top);
          if (ox > 1 && oy > 1) out.push({ label: el.className, panel: p.name, box: [b.left, b.top, b.right, b.bottom].map(Math.round) });
        }
      }
      return { checked, panels: panels.map((p) => p.name), overlaps: out };
    },
    /** Count the DOM nodes of the combat layers (pools must not grow). */
    nodes() {
      return {
        worldfx: document.querySelectorAll('.lu-worldfx *').length,
        loot: document.querySelectorAll('.lu-loot *').length,
        skills: document.querySelectorAll('.lu-skills *').length,
      };
    },
    /** Mean / max ms of WorldLabels.update over the next `frames` frames. */
    perf(frames = 120) {
      return new Promise((resolve) => {
        const orig = c.labels.update;
        const times = [];
        c.labels.update = function (...a) {
          const t0 = performance.now();
          orig.apply(this, a);
          times.push(performance.now() - t0);
          if (times.length >= frames) {
            c.labels.update = orig;
            const mean = times.reduce((s, x) => s + x, 0) / times.length;
            resolve({ frames: times.length, meanMs: +mean.toFixed(4), maxMs: +Math.max(...times).toFixed(4) });
          }
        };
      });
    },
    /** Count layout reads (offset* / client* / getBoundingClientRect / getComputedStyle) over ms. */
    layoutReads(ms = 1000) {
      return new Promise((resolve) => {
        let count = 0;
        const undo = [];
        const wrapGetter = (proto, name) => {
          const d = Object.getOwnPropertyDescriptor(proto, name);
          Object.defineProperty(proto, name, { configurable: true, get() { count++; return d.get.call(this); } });
          undo.push(() => Object.defineProperty(proto, name, d));
        };
        for (const n of ['offsetWidth', 'offsetHeight', 'offsetTop', 'offsetLeft']) wrapGetter(HTMLElement.prototype, n);
        for (const n of ['clientWidth', 'clientHeight']) wrapGetter(Element.prototype, n);
        const gbcr = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = function () { count++; return gbcr.call(this); };
        undo.push(() => { Element.prototype.getBoundingClientRect = gbcr; });
        const gcs = window.getComputedStyle;
        window.getComputedStyle = function (...a) { count++; return gcs.apply(this, a); };
        undo.push(() => { window.getComputedStyle = gcs; });
        setTimeout(() => { for (const u of undo) u(); resolve(count); }, ms);
      });
    },
  };
  return { api, frame };
}

const combat = COMBAT ? setupCombat() : null;
if (combat) {
  combat.api.setup();
  window.addEventListener('keydown', (e) => {
    if (e.repeat || ui.title.visible) return;
    if (e.code === 'KeyJ') combat.api.numbers(6);
    else if (e.code === 'KeyK') combat.api.damage(17);
    else if (e.code === 'KeyU') combat.api.cast(0);
  });
}

// ---------------------------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------------------------
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

applyTime(state.time);
const timer = new THREE.Timer();
let elapsed = 0;
let npcAngle = 0.6;
function frame(timestamp) {
  timer.update(timestamp);
  const dt = Math.min(timer.getDelta(), 0.05);
  elapsed += dt;

  // toggles
  if (input.actionPressed('debug')) ui.debug.toggle();
  if (input.actionPressed('help')) ui.hud.toggleHelp();
  if (input.actionPressed('photo')) ui.setVisible(!ui.visible);
  if (input.actionPressed('time')) { state.time = (state.time + 1.5) % 24; applyTime(state.time); }
  if (input.actionPressed('banner')) ui.banner.show('Emberfall', 'The Riverside Village');
  if (input.actionPressed('toast')) ui.hud.toast('A cool breeze drifts from the river.');
  if (input.actionPressed('fade')) ui.fader.fadeOut(0.5).then(() => ui.fader.fadeIn(0.5));

  if (state.timeSpeed > 0) { state.time = (state.time + state.timeSpeed * dt) % 24; applyTime(state.time); }

  // camera: diorama framing with a gentle yaw sway
  camState.yaw = Math.sin(elapsed * 0.15) * 6 * DEG2RAD;
  const cp = Math.cos(camState.pitch);
  camera.position.set(
    camState.target.x + Math.sin(camState.yaw) * cp * camState.distance,
    camState.target.y + Math.sin(camState.pitch) * camState.distance,
    camState.target.z + Math.cos(camState.yaw) * cp * camState.distance,
  );
  camera.lookAt(camState.target);

  // NPC wanders around the plaza; the prompt follows it
  if (params.orbit && !state.talking) npcAngle += dt * 0.35;
  npc.position.set(Math.cos(npcAngle) * 3.2, 0.6 + Math.abs(Math.sin(elapsed * 4)) * 0.08, Math.sin(npcAngle) * 2.2 + 0.6);
  npc.rotation.y = -npcAngle;
  for (let i = 0; i < trees.length; i++) trees[i].rotation.z = Math.sin(elapsed * 0.8 + i) * 0.03;
  lanternLight.intensity = (state.lanternBase ?? 9) * (0.94 + 0.06 * Math.sin(elapsed * 7.3) * Math.sin(elapsed * 3.1 + 1));

  if (state.introDone && !state.talking) {
    ui.prompt.show(npc, params.label, { offsetY: 0.75 });
    if (input.actionPressed('confirm')) startDialog();
  }

  if (combat) combat.frame(dt, elapsed);
  ui.update(dt, { camera, input });
  renderer.render(scene, camera);
  ui.debug.stats.update(renderer, dt);
  input.endFrame();
}
renderer.setAnimationLoop(frame);

/**
 * `window.__sandbox` (AUTOMATION_API.md §7); `window.__ui` is the UI instance itself.
 * @typedef {object} UISandboxHandle
 * @property {typeof THREE} THREE
 * @property {THREE.WebGLRenderer} renderer
 * @property {THREE.Scene} scene
 * @property {THREE.PerspectiveCamera} camera
 * @property {typeof npc} npc  the talking cube
 * @property {StubInput} input
 * @property {typeof state} state
 * @property {typeof params} params  the debug-panel parameters (label, orbit …)
 * @property {typeof state.results} results  (getter) state.results
 * @property {boolean} faded  (getter / setter) state.faded
 * @property {typeof startDialog} startDialog
 * @property {(h: number) => string} setTime  set the hour; returns `ui.hud.phase`
 * @property {(v?: boolean) => boolean} showDebug
 * @property {() => void} skipIntro  hide the title, show the HUD
 * @property {ReturnType<typeof setupCombat>['api']|null} combat  the combat bench hooks
 *   (`?combat=1` only)
 * @property {() => void} dispose
 */

// handles for scripted checks
window.__ui = ui;
window.__sandbox = {
  THREE, renderer, scene, camera, npc, input, state, params,
  get results() { return state.results; },
  get faded() { return state.faded; },
  set faded(v) { state.faded = v; },
  startDialog,
  setTime(h) { state.time = h; applyTime(h); return ui.hud.phase; },
  showDebug(v = true) { ui.debug.visible = v; return ui.debug.visible; },
  skipIntro() { ui.title.hide(); ui.hud.visible = true; state.introDone = true; },
  /** Combat bench hooks (`?combat=1` only, else null). */
  combat: combat ? combat.api : null,
  dispose() {
    renderer.setAnimationLoop(null);
    ui.dispose();
    disposables.forEach((d) => d.dispose());
    renderer.dispose();
  },
};
