/**
 * Sandbox for the combat engine additions of the fx-audio-input package (COMBAT.md §5.3,
 * §11.1–§11.3, §12), on the real pipeline (TileMap terrain, LightingSystem at golden hour, PostFX
 * with the game's tuning, the game's fog start):
 *  - FxQuads: every mode (flat slashes, billboards, screen-facing stars), animated atlas frames, a
 *    dither-fading slash, pickups / projectiles / ember wall;
 *  - GroundMarkers: every shape × style through progress on five ground types, and draped on stepped
 *    terrain — a boar lane across a one-level step, an archer lane down a two-level ledge, a Hex
 *    Flame circle on a stair, a shockwave ring and a goblin sector across the step;
 *  - the six combat bursts (asserting that `particles._poolList` grows by exactly 1), and in a second
 *    row the boss-death / level-up bursts before and after COMBAT-16 (the dim variants share pools);
 *  - combat SFX buttons, battle / boss tracks with a crossfade, sections, stingers (plus offline
 *    renders: levels, NaN, node counts, tempo);
 *  - mouse edges (`enableMouseButtons`) on / off the canvas, `lastDevice`, `addBindings`, and
 *    `rig.stickZoom`.
 *
 * URL params: ?view=overview|gallery|galleryNear|stepped|steppedYaw|steppedYawL|quads|probe|probeYaw|bursts  &t=<hour>
 * window.__cfx (typedef `CfxHandle`): { THREE, engine, rig, postfx, lighting, tileMap, quads,
 *   markers, particles, audio, input, peaceful, atlas, setView(name), setTime(h),
 *   setProgress(p|null), setAutoBursts(on), fireBursts(), step(n), play(), runChecks() (async →
 *   results), results, renderTrack(track, seconds, mute), stats(), mouse, drawCallsOf(object),
 *   warnings }
 * Failed checks are console.error'ed (the harness counts them); `results.allOk` sums them up.
 */
import * as THREE from 'three';
import {
  Engine, CameraRig, PostFX, LightingSystem, DEFAULT_KEYFRAMES, TextureLibrary, TileMap, Particles, FxQuads,
  GroundMarkers, createFxAtlas, FX_FRAMES, AudioSystem, SFX_NAMES, COMBAT_SFX_NAMES, MUSIC_TRACKS, Input, Sprite3D,
  createCharacterSheet, CHARACTER_PRESETS, createEnemySheet, PixelCanvas, makePixelTexture,
} from '../src/engine/index.js';
import { KEYFRAME_OVERRIDES, SUN_PATH, MOON_PATH, CHARACTER_SPRITE_OPTS, CAMERA } from '../src/game/config.js';
import { installFogStart } from '../src/game/AtmosphereFog.js';

/**
 * @import { FxQuadParams } from '../src/engine/fx/FxQuads.js'
 * @import { GroundMarkerSpec } from '../src/engine/fx/GroundMarkers.js'
 * @import { TileDef } from '../src/engine/level/types.js'
 */

const params = new URLSearchParams(location.search);
const results = { checks: {}, allOk: false, done: false };
const warnings = [];
{
  // count console warnings raised by the modules under test (they must stay at zero)
  const warn = console.warn.bind(console);
  console.warn = (...a) => { warnings.push(a.join(' ')); warn(...a); };
}

// ---------------------------------------------------------------------------------------------
// Engine, lighting, post (as in Game.init / _tunePost)
// ---------------------------------------------------------------------------------------------

installFogStart(CAMERA.distance - 7);
const engine = new Engine({ container: document.getElementById('app'), maxPixelRatio: 1, exposeGlobal: false });
const { scene, camera, renderer } = engine;
const keyframes = DEFAULT_KEYFRAMES.map((k) => ({ ...k, ...(KEYFRAME_OVERRIDES[k.name] ?? {}) }));
const lighting = new LightingSystem(engine, { timeOfDay: Number(params.get('t') ?? 17.2), shadowExtent: 26, sunPath: SUN_PATH, moonPath: MOON_PATH, keyframes });
lighting.sky.lowerClouds = 0.25;
const postfx = new PostFX(renderer, scene, camera, { maxTaps: 64, samples: 4 });
{
  const S = postfx.settings;
  Object.assign(S.dof, { focusRange: 6, maxBlur: 13, nearScale: 1.5, farScale: 1.15, tiltShift: 0.42, tiltCenter: 0.5, tiltWidth: 0.3, bokehBoost: 1.6 });
  Object.assign(S.bloom, { strength: 0.5, radius: 0.58, threshold: 1.05 });
  Object.assign(S.grade, { exposure: 1.03, contrast: 1.04, saturation: 1.3, temperature: 0.04, vignette: 0.55, grain: 0.03, shadowsTint: [-0.04, 0.05, 0.15] });
}
engine.events.on('resize', ({ width, height, pixelRatio }) => postfx.setSize(width, height, pixelRatio));
postfx.setSize(engine.width, engine.height, engine.pixelRatio);

// ---------------------------------------------------------------------------------------------
// Terrain (44 × 40): a burst pad (z 1–8), a cobbled strip for the quads (z 11–17), a flat gallery
// on five ground types (z 19–37) and a stepped zone (x ≥ 29): level 2 → a one-level step up to
// level 3 (z 28) → a two-level ledge up to level 5 (z 22) with a 6-wide stair (x 33–38, z 20–21)
// ---------------------------------------------------------------------------------------------

const W = 44;
const D = 40;
const Z0 = 10; // the gallery / stepped features start 10 rows south of the burst pad
/** @type {Record<string, TileDef>} */
const legend = {
  g: { top: 'grass', side: 'cliff', lip: 'grass_side', walkable: true },
  G: { top: 'grass_dark', side: 'cliff', lip: 'grass_side', walkable: true },
  d: { top: 'dirt_path', side: 'dirt_side', walkable: true },
  c: { top: 'cobblestone', side: 'stone_wall', walkable: true },
  s: { top: 'sand', side: 'dirt_side', walkable: true },
  m: { top: 'moss_stone', side: 'cliff', walkable: true },
  '^': { top: 'cobblestone', side: 'stone_wall', riser: 'stone_wall', stairs: 'N', walkable: true },
};
const GALLERY_GROUND = ['g', 'd', 'c', 'G', 's']; // one ground type per shape column
function cell(i, j) {
  const jj = j - Z0;
  if (i >= 29) {
    if (jj >= 18) return [i < 34 ? 'd' : 'g', 2];
    if (jj >= 12) return ['g', 3];
    if (i >= 33 && i <= 38 && (jj === 10 || jj === 11)) return ['^', jj === 11 ? 3 : 4];
    return [(i * 7 + j * 3) % 5 === 0 ? 'G' : 'm', 5];
  }
  if (jj < 0) return [i >= 1 && i <= 27 && j >= 1 && j <= 8 ? 'd' : 'g', 2];
  if (jj <= 7) return ['c', 2];
  if (i >= 1 && i <= 25 && jj >= 9 && jj <= 27) return [GALLERY_GROUND[Math.min(4, Math.floor((i - 1) / 5))], 2];
  return ['g', 2];
}
const tiles = [];
const heights = [];
for (let j = 0; j < D; j++) {
  let t = '';
  let h = '';
  for (let i = 0; i < W; i++) {
    const [ch, lv] = cell(i, j);
    t += ch;
    h += String(lv);
  }
  tiles.push(t);
  heights.push(h);
}
const textures = new TextureLibrary({ seed: 1337, anisotropy: 4 });
const tileMap = new TileMap({ name: 'Combat FX', legend, tiles, heights, waterLevel: 0 }, { textures });
scene.add(tileMap.object);
const groundY = (x, z) => tileMap.getHeight(x, z);

// ---------------------------------------------------------------------------------------------
// Camera and views (each view shows only the objects it is about, so a bright batch elsewhere
// does not wash the shot out through bloom)
// ---------------------------------------------------------------------------------------------

const focus = new THREE.Vector3(22, 1.5, 25);
const rig = new CameraRig(camera, { distance: CAMERA.distance, pitch: CAMERA.pitch, fov: CAMERA.fov, minDistance: CAMERA.minDistance, maxDistance: CAMERA.maxDistance, yaw: 0, lookAhead: 0 });
rig.setTarget(focus);
lighting.followTarget(focus);
/**
 * Named camera views: f focus point, d distance, yaw (degrees), show the `groups` drawn in it.
 * @type {Record<string, { f: [number, number, number], d: number, yaw: number, show: string[] }>}
 */
const VIEWS = {
  overview: { f: [22, 1.5, 22], d: 42, yaw: 0, show: ['quads', 'probe', 'markers'] },
  gallery: { f: [13.5, 1.0, 28.8], d: 34, yaw: 0, show: ['markers'] },
  galleryNear: { f: [8.5, 1.0, 23.2], d: 22, yaw: 0, show: ['markers'] },
  stepped: { f: [36, 1.8, 24.5], d: 28, yaw: 0, show: ['markers'] },
  steppedYaw: { f: [36, 1.8, 24.5], d: 28, yaw: 45, show: ['markers'] },
  steppedYawL: { f: [36, 1.8, 24.5], d: 28, yaw: -45, show: ['markers'] },
  quads: { f: [13, 1.4, 14.2], d: 22, yaw: 0, show: ['quads'] },
  probe: { f: [22.5, 1.4, 14.6], d: 18, yaw: 0, show: ['probe'] },
  probeYaw: { f: [22.5, 1.4, 14.6], d: 18, yaw: 40, show: ['probe'] },
  bursts: { f: [11.8, 1.4, 5.4], d: 19, yaw: 0, show: [] },
};
const groups = {}; // name → object (filled below)
/** @type {string[]|null} the `groups` the current view shows (null: all) */
let viewShow = null;
/**
 * @param {string} name  a `VIEWS` key ('overview' when unknown)
 * @returns {string} name
 */
function setView(name) {
  const v = VIEWS[name] ?? VIEWS.overview;
  focus.set(...v.f);
  rig.distanceTarget = v.d;
  rig.setAngles(v.yaw, CAMERA.pitch);
  rig.snap();
  viewShow = v.show;
  applyShow();
  return name;
}
function applyShow() {
  for (const [k, obj] of Object.entries(groups)) obj.visible = !viewShow || viewShow.includes(k);
}

// ---------------------------------------------------------------------------------------------
// FX atlas + FxQuads (every mode)
// ---------------------------------------------------------------------------------------------

const atlas = createFxAtlas();
const quads = new FxQuads({ atlas, capacity: 256 });
scene.add(quads.object);
groups.quads = quads.object;
const GQ = groundY(10, Z0 + 4); // ground of the cobbled strip (level 2 → 1.0)
const HDR = {
  slash: [3.0, 3.0, 2.6], slashBig: [3.2, 2.8, 2.0], thrust: [3.0, 3.0, 2.8], spin: [2.8, 2.6, 2.0],
  impact: [3.5, 3.2, 2.4], crit: [4.0, 3.2, 1.2], dust: [1.0, 0.95, 0.85], stun: [3.0, 2.6, 0.8],
  pillar: [2.4, 2.0, 0.9], wallFlame: [2.6, 1.2, 0.4], emberBolt: [3.0, 1.4, 0.5], boulder: [1.0, 0.85, 0.75],
  arrow: [1.1, 1.0, 0.9], heart: [2.4, 0.55, 0.55], mana: [0.6, 1.1, 2.4], draught: [0.9, 1.9, 0.8],
  upgrade: [2.2, 1.8, 0.7], core: [2.6, 1.2, 0.5],
};
/**
 * @type {{ batch: FxQuads, h: number, p: FxQuadParams, fps: number, n: number, fade?: boolean,
 *   phase: number }[]}
 */
const quadItems = [];
/**
 * Add one quad to a batch; the frame loop animates it through its frames.
 * @param {FxQuadParams & { rgb?: number[], fade?: boolean }} p
 *   rgb: its HDR colour (default `HDR[frame]`); fade: a looping dither fade
 * @param {FxQuads} [batch]
 * @param {Record<string, { n: number, fps: number }>} [frames]  that batch's atlas frames
 * @returns {number} the handle
 */
function addQuad(p, batch = quads, frames = FX_FRAMES) {
  const h = batch.alloc();
  const fr = frames[p.frame];
  const [r, g, b] = p.rgb ?? HDR[p.frame] ?? [1, 1, 1];
  const q = { x: 0, y: 0, z: 0, frame: p.frame, index: 0, scale: 1, rot: 0, mode: 'billboard', dirX: 0, dirZ: 1, r, g, b, a: 1, flipX: false, ...p };
  delete q.rgb;
  quadItems.push({ batch, h, p: q, fps: fr.fps, n: fr.n, fade: !!p.fade, phase: quadItems.length * 0.37 });
  batch.set(h, q);
  return h;
}
const QZ = Z0; // strip origin
// flat (hip height 0.8), along several directions; one mirrored
addQuad({ frame: 'slash', mode: 'flat', x: 3, y: GQ + 0.8, z: QZ + 3.6, dirX: 0, dirZ: -1 });
addQuad({ frame: 'slash', mode: 'flat', x: 3, y: GQ + 0.8, z: QZ + 6.2, dirX: 1, dirZ: 0, flipX: true });
addQuad({ frame: 'slashBig', mode: 'flat', x: 7.5, y: GQ + 0.8, z: QZ + 3.8, dirX: 0, dirZ: -1 });
addQuad({ frame: 'thrust', mode: 'flat', x: 7.5, y: GQ + 0.8, z: QZ + 6.4, dirX: 0.7071, dirZ: -0.7071 });
addQuad({ frame: 'spin', mode: 'flat', x: 12, y: GQ + 0.5, z: QZ + 4.4 });
addQuad({ frame: 'slash', mode: 'flat', x: 16, y: GQ + 0.8, z: QZ + 2.4, dirX: 0, dirZ: -1, fade: true });
// billboards
addQuad({ frame: 'impact', x: 16, y: GQ + 1.0, z: QZ + 4.8 });
addQuad({ frame: 'crit', x: 17.6, y: GQ + 1.0, z: QZ + 4.8 });
addQuad({ frame: 'dust', x: 19.2, y: GQ + 0.5, z: QZ + 4.8 });
addQuad({ frame: 'stun', x: 20.8, y: GQ + 1.9, z: QZ + 4.8 });
addQuad({ frame: 'pillar', x: 23.5, y: GQ + 2.0, z: QZ + 5.2 });
for (let k = 0; k < 6; k++) addQuad({ frame: 'wallFlame', x: 21.5 + k * 0.6, y: GQ + 0.75, z: QZ + 2.2 });
// screen-facing
addQuad({ frame: 'impact', mode: 'screen', x: 16, y: GQ + 1.0, z: QZ + 6.8 });
addQuad({ frame: 'crit', mode: 'screen', x: 17.6, y: GQ + 1.0, z: QZ + 6.8, scale: 1.5 });
// pickups and projectiles
[[1.35, 0.72, 0.42], [1.45, 1.45, 1.55], [2.0, 1.6, 0.5]].forEach((rgb, k) => addQuad({ frame: 'coin', x: 10 + k * 0.7, y: GQ + 0.35, z: QZ + 7.2, rgb }));
['heart', 'mana', 'draught', 'upgrade', 'core'].forEach((f, k) => addQuad({ frame: f, x: 12.4 + k * 0.9, y: GQ + 0.45, z: QZ + 7.2 }));
addQuad({ frame: 'emberBolt', x: 19.5, y: GQ + 0.9, z: QZ + 7.0 });
addQuad({ frame: 'boulder', x: 21, y: GQ + 0.6, z: QZ + 7.0 });
addQuad({ frame: 'arrow', mode: 'flat', x: 22.8, y: GQ + 0.9, z: QZ + 7.0, dirX: 1, dirZ: 0, rot: Math.PI / 2 }); // drawn pointing +U: rot π/2 flies along dir

// Orientation probe: a small sandbox atlas whose frame shows +U (a red arrow pointing right) and
// +V (a white bar along the top), drawn with the same batch class in every mode — flat along N /
// E / NE, mirrored, rotated; billboard; screen; and a dither fade.
const probeAtlas = (() => {
  const pc = new PixelCanvas(32, 16);
  const red = [255, 90, 60, 255];
  const white = [255, 255, 255, 255];
  const gold = [255, 214, 110, 255];
  const fw = 24;
  const fh = 12;
  const x0 = 1;
  const y0 = 1;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (x === 0 || y === fh - 1 || x === fw - 1) pc.set(x0 + x, y0 + y, gold);
  for (let x = 0; x < fw; x++) { pc.set(x0 + x, y0, white); pc.set(x0 + x, y0 + 1, white); } // top edge = +V
  for (let x = 3; x < 19; x++) { pc.set(x0 + x, y0 + 6, red); pc.set(x0 + x, y0 + 7, red); } // shaft
  for (let k = 0; k < 4; k++) for (let d = -k; d <= k + 1; d++) pc.set(x0 + 22 - k, y0 + 6 + d, red); // head → +U
  const texture = makePixelTexture(pc.toCanvas(), { wrap: 'clamp', mipmaps: false, srgb: true, name: 'fx:probe' });
  const S = 32;
  const T = 16;
  return { texture, frames: { probe: { w: fw, h: fh, n: 1, fps: 0, rects: [[x0 / S, 1 - (y0 + fh) / T, (x0 + fw) / S, 1 - y0 / T]] } } };
})();
const probe = new FxQuads({ atlas: probeAtlas, capacity: 16, name: 'fx:probe' });
scene.add(probe.object);
groups.probe = probe.object;
const PZ = QZ + 4.6;
const PF = probeAtlas.frames;
const PC = [1, 1, 1]; // no bloom: the glyph must stay readable
addQuad({ frame: 'probe', mode: 'flat', x: 19.5, y: GQ + 0.05, z: PZ - 2, dirX: 0, dirZ: -1, rgb: PC }, probe, PF); // +V north
addQuad({ frame: 'probe', mode: 'flat', x: 22.5, y: GQ + 0.05, z: PZ - 2, dirX: 1, dirZ: 0, rgb: PC }, probe, PF); // +V east
addQuad({ frame: 'probe', mode: 'flat', x: 25.5, y: GQ + 0.05, z: PZ - 2, dirX: 0.7071, dirZ: -0.7071, rgb: PC }, probe, PF);
addQuad({ frame: 'probe', mode: 'flat', x: 19.5, y: GQ + 0.05, z: PZ + 0.4, dirX: 0, dirZ: -1, flipX: true, rgb: PC }, probe, PF);
addQuad({ frame: 'probe', mode: 'flat', x: 22.5, y: GQ + 0.05, z: PZ + 0.4, dirX: 0, dirZ: -1, rot: Math.PI / 2, rgb: PC }, probe, PF);
addQuad({ frame: 'probe', mode: 'flat', x: 25.5, y: GQ + 0.05, z: PZ + 0.4, dirX: 0, dirZ: -1, fade: true, rgb: PC }, probe, PF);
addQuad({ frame: 'probe', mode: 'billboard', x: 20.5, y: GQ + 1.2, z: PZ + 2.8, rgb: PC }, probe, PF);
addQuad({ frame: 'probe', mode: 'billboard', x: 22.5, y: GQ + 1.2, z: PZ + 2.8, rot: 0.5, scale: 1.5, rgb: PC }, probe, PF);
addQuad({ frame: 'probe', mode: 'screen', x: 24.8, y: GQ + 1.2, z: PZ + 2.8, rgb: PC }, probe, PF);

// ---------------------------------------------------------------------------------------------
// GroundMarkers: gallery (5 shapes × 5 styles) + stepped cases, draped on the terrain
// ---------------------------------------------------------------------------------------------

const markers = new GroundMarkers({ capacity: 48, heightField: { sample: groundY, minX: 0, minZ: 0, maxX: W, maxZ: D } });
scene.add(markers.object);
groups.markers = markers.object;
const SHAPES = ['circle', 'ring', 'sector', 'lane', 'rect'];
const STYLES = ['enemy', 'player', 'lock', 'barrier', 'magma'];
const GZ = Z0 + 11; // first gallery row
/** @type {{h:number, spec:GroundMarkerSpec, phase:number, lock?:boolean}[]} */
const markerItems = [];
/**
 * Add one marker; the frame loop cycles its progress (0 → 1).
 * @param {GroundMarkerSpec} spec
 * @param {number} [phase]  offset into the progress cycle (fractions of it)
 * @param {boolean} [lock]  flash at the lock-in point (lanes)
 * @returns {number} the handle
 */
function addMarker(spec, phase = 0, lock = false) {
  const h = markers.alloc();
  const s = { y: 0.03, progress: 0, alpha: 1, flash: 0, dirX: 0, dirZ: 1, ...spec };
  markerItems.push({ h, spec: s, phase, lock });
  markers.set(h, s);
  return h;
}
STYLES.forEach((style, si) => SHAPES.forEach((shape, k) => {
  const x = 3.5 + k * 5;
  const z = GZ + si * 3.6;
  const base = { style, shape, x, z };
  if (shape === 'circle') Object.assign(base, { r: 1.3 });
  else if (shape === 'ring') Object.assign(base, { r: 1.5, rInner: 0.9 });
  else if (shape === 'sector') Object.assign(base, { z: z + 0.9, r: 1.9, halfAngle: 50, dirX: 0, dirZ: -1 });
  else if (shape === 'lane') Object.assign(base, { z: z + 1.4, len: 2.9, width: 1.0, dirX: 0, dirZ: -1 });
  else Object.assign(base, { w: 3.2, d: 2.4 });
  addMarker(base, si * 0.23 + k * 0.11, shape === 'lane');
}));
const STEPPED = [
  { name: 'boar lane across a 1-level step', spec: { shape: 'lane', style: 'enemy', x: 31.5, z: Z0 + 24.2, dirX: 0, dirZ: -1, len: 9, width: 1.4 }, lock: true },
  { name: 'archer lane down a 2-level ledge', spec: { shape: 'lane', style: 'enemy', x: 41, z: Z0 + 5.6, dirX: 0, dirZ: 1, len: 10.5, width: 0.5 }, lock: true },
  { name: 'Hex Flame circle on the stair', spec: { shape: 'circle', style: 'enemy', x: 35.5, z: Z0 + 11, r: 1.6 } },
  { name: 'shockwave ring over the step', spec: { shape: 'ring', style: 'enemy', x: 37.5, z: Z0 + 21.5, r: 3.6, rInner: 3.0 } },
  { name: 'goblin sector on the step edge', spec: { shape: 'sector', style: 'enemy', x: 41, z: Z0 + 19.4, r: 1.6, halfAngle: 45, dirX: 0, dirZ: -1 } },
  { name: 'diagonal lane', spec: { shape: 'lane', style: 'enemy', x: 29.6, z: Z0 + 28.6, dirX: 0.7071, dirZ: -0.7071, len: 6, width: 1.0 }, lock: true },
  { name: 'lock ring (target on the ledge)', spec: { shape: 'circle', style: 'lock', x: 41, z: Z0 + 5.6, r: 0.7 } },
];
STEPPED.forEach((c, i) => addMarker(c.spec, i * 0.17, !!c.lock));
let frozenProgress = null;

// ---------------------------------------------------------------------------------------------
// Characters for scale / context (player on the step, archer on the ledge, boar at its lane)
// ---------------------------------------------------------------------------------------------

const sprites = [];
function addSprite(sheet, x, z, anim, face, opts = {}) {
  const s = new Sprite3D(sheet, { ...CHARACTER_SPRITE_OPTS, ...(sheet.spriteOptions ?? {}), ...opts });
  s.position.set(x, groundY(x, z), z);
  s.play(anim);
  if (face) s.faceVector(face[0], face[1]);
  scene.add(s);
  sprites.push(s);
  return s;
}
addSprite(createCharacterSheet({ ...CHARACTER_PRESETS.traveler, preset: 'traveler' }), 35.8, Z0 + 16.4, 'idle', [0, -1]);
addSprite(createCharacterSheet({ ...CHARACTER_PRESETS.traveler, preset: 'traveler' }), 8.5, Z0 + 16.2, 'idle', [0, -1]);
addSprite(createEnemySheet('archer'), 41, Z0 + 5.4, 'idle', [0, 1]);
addSprite(createEnemySheet('boar'), 31.5, Z0 + 24.8, 'idle', [0, -1]);

// ---------------------------------------------------------------------------------------------
// Particles: prime the three existing burst pools like the game, then the six combat presets
// ---------------------------------------------------------------------------------------------

const particles = new Particles(scene);
const far = new THREE.Vector3(0, -1000, 0);
for (const p of ['sparkle', 'splash', 'footstep']) particles.burst(p, far, 1);
const poolsPrimed = particles._poolList.length;
/** @type {[preset: string, count: number][]} */
const BURSTS = [['hitSpark', 12], ['emberBurst', 10], ['deathPoof', 12], ['gooPoof', 12], ['healGlow', 8], ['magicBurst', 24]];
/**
 * Second row (z 8.2): the boss-death / level-up bursts before and after COMBAT-16 — emberBurst 24 |
 * victoryEmbers 12 | sparkle 24 | victorySparkle 12 | sparkle 14 | levelSparkle 14 (no new pool).
 */
/** @type {[preset: string, count: number][]} */
const BURSTS2 = [['emberBurst', 24], ['victoryEmbers', 12], ['sparkle', 24], ['victorySparkle', 12], ['sparkle', 14], ['levelSparkle', 14]];
const _bp = new THREE.Vector3();
function fireBursts() {
  BURSTS.forEach(([name, n], k) => particles.burst(name, _bp.set(5.5 + k * 2.4, groundY(5.5 + k * 2.4, 5) + (k < 2 ? 1.0 : 0.3), 5), n));
  BURSTS2.forEach(([name, n], k) => particles.burst(name, _bp.set(5.5 + k * 2.4, groundY(5.5 + k * 2.4, 8.2) + 1.2, 8.2), n));
  return particles._poolList.length;
}

// ---------------------------------------------------------------------------------------------
// Input: combat bindings + mouse edges on the canvas; a "peaceful" Input on its own target
// ---------------------------------------------------------------------------------------------

const input = engine.input;
const canvas = renderer.domElement;
input.addBindings(
  { attack: ['KeyJ', 'Mouse0'], dodge: ['KeyK', 'Mouse2'], lock: ['KeyL', 'Mouse1'] },
  { attack: ['GamepadX'], dodge: ['GamepadB'], lock: ['GamepadRS'], zoomIn: [], zoomOut: [] },
);
input.enableMouseButtons(canvas);
const mouse = { attack: 0, dodge: 0, lock: 0, released: 0, last: 'keyboard' };
const peacefulEl = document.createElement('div');
const peaceful = new Input(peacefulEl);

// ---------------------------------------------------------------------------------------------
// Audio (live context, unlocked by the first button press or by the checks)
// ---------------------------------------------------------------------------------------------

const audio = new AudioSystem({ volume: 0.6 });
engine.addSystem(audio, 20);
const sfxEl = document.getElementById('sfx');
for (const name of COMBAT_SFX_NAMES) {
  const b = document.createElement('button');
  b.textContent = name;
  b.onclick = () => audio.unlock().then(() => audio.playSfx(name));
  sfxEl.appendChild(b);
}
const musicEl = document.getElementById('music');
/** @type {Record<string, () => unknown>} */
const MUSIC_BUTTONS = {
  emberfall: () => audio.startMusic({ track: 'emberfall', fade: 2 }),
  battle: () => audio.startMusic({ track: 'battle', fade: 1.2 }),
  boss: () => audio.startMusic({ track: 'boss', fade: 1.2 }),
  'section A': () => audio.setMusicSection('A'),
  'section B': () => audio.setMusicSection('B'),
  victory: () => audio.playStinger('victory'),
  levelup: () => audio.playStinger('levelup'),
  stop: () => audio.stopMusic({ fade: 1 }),
};
for (const [label, fn] of Object.entries(MUSIC_BUTTONS)) {
  const b = document.createElement('button');
  b.textContent = label;
  b.dataset.music = label;
  b.onclick = () => audio.unlock().then(fn);
  musicEl.appendChild(b);
}

// ---------------------------------------------------------------------------------------------
// Frame loop
// ---------------------------------------------------------------------------------------------

const tagsEl = document.getElementById('tags');
const tags = [];
function addTag(text, x, y, z) {
  const el = document.createElement('div');
  el.className = 'tag';
  el.textContent = text;
  tagsEl.appendChild(el);
  tags.push({ el, v: new THREE.Vector3(x, y, z) });
}
STYLES.forEach((s, si) => addTag(s, 0.9, 1.2, GZ + si * 3.6));
SHAPES.forEach((s, k) => addTag(s, 3.5 + k * 5, 1.4, GZ - 1.9));
addTag('flat', 5, GQ + 1.6, QZ + 3);
addTag('billboard', 19, GQ + 2.4, QZ + 4.8);
addTag('probe: flat N / E / NE', 22.5, GQ + 0.9, PZ - 2.9);
addTag('flipX / rot 90° / fade', 22.5, GQ + 0.9, PZ - 0.5);
addTag('billboard / screen', 22.5, GQ + 2.3, PZ + 2.8);
BURSTS.forEach(([n], k) => addTag(n, 5.5 + k * 2.4, GQ + 2.2, 5));
BURSTS2.forEach(([n, c], k) => addTag(`${n} ${c}`, 5.5 + k * 2.4, GQ + 0.5, 8.9));
addTag('screen', 16.8, GQ + 1.9, QZ + 6.8);
addTag('step +1', 31.5, 1.9, Z0 + 18);
addTag('ledge +2', 41, 3.0, Z0 + 12);
addTag('stair', 35.5, 2.9, Z0 + 10.2);
const _tp = new THREE.Vector3();
function updateTags() {
  for (const t of tags) {
    _tp.copy(t.v).project(camera);
    const vis = _tp.z < 1 && Math.abs(_tp.x) < 1.05 && Math.abs(_tp.y) < 1.05;
    t.el.style.display = vis ? '' : 'none';
    if (vis) t.el.style.transform = `translate(${((_tp.x + 1) / 2) * innerWidth}px, ${((1 - _tp.y) / 2) * innerHeight}px) translate(-50%, -100%)`;
  }
}

/** progress cycle: 0 → 1 over 1.6 s, hold 1 for 0.25 s */
const cycle = (t) => Math.min(1, (t % 1.85) / 1.6);
let autoBursts = true;
let burstTimer = 1.0;
engine.addSystem({
  name: 'combat-fx-sandbox',
  update(dt, t) {
    // markers
    for (const it of markerItems) {
      const p = frozenProgress ?? cycle(t + it.phase * 1.85);
      it.spec.progress = p;
      it.spec.flash = it.lock && p >= 0.75 && p < 0.82 ? 1 : 0;
      markers.set(it.h, it.spec);
    }
    markers.update();
    // quads
    for (const it of quadItems) {
      if (it.n > 1 && it.fps > 0) it.p.index = Math.floor((t + it.phase) * it.fps) % it.n;
      if (it.fade) it.p.a = 1 - ((t * 0.5) % 1);
      it.batch.set(it.h, it.p);
    }
    quads.update();
    probe.update();
    applyShow();
    // bursts
    if (autoBursts) {
      burstTimer -= dt;
      if (burstTimer <= 0) {
        burstTimer = 2.4;
        fireBursts();
      }
    }
    particles.update(dt, camera);
    for (const s of sprites) s.update(dt, camera);
    // input readout
    if (input.actionPressed('attack')) mouse.attack++;
    if (input.actionPressed('dodge')) mouse.dodge++;
    if (input.actionPressed('lock')) mouse.lock++;
    if (input.wasReleased('Mouse0') || input.wasReleased('Mouse1') || input.wasReleased('Mouse2')) mouse.released++;
    mouse.last = input.lastDevice;
    rig.update(dt, input);
  },
  lateUpdate() {
    updateTags();
  },
}, 0);
engine.addSystem(lighting, -10);
engine.setRenderFn((dt) => {
  if (postfx.settings.dof.autoFocus && rig.focusDistance) postfx.setFocus(rig.focusDistance);
  postfx.render(dt);
});
setView(params.get('view') ?? 'overview');
engine.start();

const statsEl = document.getElementById('stats');
const mouseEl = document.getElementById('mouse');
const musicStateEl = document.getElementById('musicState');
setInterval(() => {
  const s = stats();
  statsEl.textContent = `programs ${s.programs} · quads ${s.quads} · markers ${s.markers}\nheight tex ${s.heightTex} @${s.heightRes}/u, bake ${s.bakeMs} ms in ${s.bakeSlices} slice(s)\nburst pools ${s.pools} (primed ${poolsPrimed})`;
  const md = ['Mouse0', 'Mouse1', 'Mouse2'].map((c) => `${c}:${input.isDown(c) ? 'down' : 'up'}`).join(' ');
  mouseEl.textContent = `${md}\nattack ${mouse.attack} · dodge ${mouse.dodge} · lock ${mouse.lock} · released ${mouse.released}\nlastDevice ${input.lastDevice} · stickZoom ${rig.stickZoom}`;
  musicStateEl.textContent = `ready ${audio.ready} · track ${audio.musicTrack} · section ${audio.musicSection} · bpm ${audio._music?.bpm ?? '-'}`;
}, 250);

function stats() {
  return {
    programs: renderer.info.programs?.length ?? 0,
    quads: quads.count,
    markers: markers.count,
    heightTex: `${markers.heightTexture.image.width}×${markers.heightTexture.image.height}`,
    heightRes: markers.heightRes,
    bakeMs: markers.bakeMs,
    bakeSlices: markers.bakeSlices,
    pools: particles._poolList.length,
  };
}

// ---------------------------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------------------------

/** @returns {Promise<void>} */
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
async function frames(n) { for (let i = 0; i < n; i++) await nextFrame(); }
function check(name, ok, detail = {}) {
  results.checks[name] = { ok: !!ok, ...detail };
  if (!ok) console.error(`[combat_fx] FAIL ${name} ${JSON.stringify(detail)}`);
  return !!ok;
}

/**
 * Draw calls this object adds to one render of the scene (rendered into the HDR scene target).
 * @param {THREE.Object3D} object
 * @returns {number}
 */
function drawCallsOf(object) {
  const info = renderer.info;
  const auto = info.autoReset;
  info.autoReset = false;
  const count = () => {
    info.reset();
    renderer.setRenderTarget(postfx.sceneTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    return info.render.calls;
  };
  const was = object.visible;
  object.visible = true;
  const on = count();
  object.visible = false;
  const off = count();
  object.visible = was;
  info.autoReset = auto;
  return on - off;
}

function checkQuadsApi() {
  const q = new FxQuads({ atlas, capacity: 4 });
  const hs = [q.alloc(), q.alloc(), q.alloc(), q.alloc()];
  const full = q.alloc();
  q.set(hs[1], { frame: 'impact', x: 1, y: 2, z: 3, index: 5, r: 2 }); // index wraps (4 frames)
  q.free(hs[0]); // the last slot moves into slot 0
  q.update();
  const moved = q._slotOf[hs[3]] === 0 && q._handleAt[0] === hs[3];
  const again = q.alloc();
  q.free(again);
  q.free(again); // double free is ignored
  const countAfter = q.count;
  const rect = atlas.frames.impact.rects[1];
  const uv = q._attrs.iUv.array;
  const slot = q._slotOf[hs[1]];
  const wrapped = uv[slot * 4] === Math.fround(rect[0]) && uv[slot * 4 + 3] === Math.fround(rect[3]);
  q.clear();
  q.update();
  const cleared = q.count === 0 && q.object.visible === false && q.object.count === 0;
  q.dispose();
  return check('quads API (alloc/full/free/swap/clear, index wrap)', full === -1 && moved && countAfter === 3 && cleared && wrapped,
    { full, moved, countAfter, cleared, wrapped });
}

function checkMarkersApi() {
  const m = new GroundMarkers({ capacity: 2 });
  const a = m.alloc();
  const b = m.alloc();
  const c = m.alloc();
  m.set(a, { shape: 'circle', x: 1, z: 2, r: 1, progress: 0.5, style: 'enemy' });
  m.free(a);
  m.update();
  const one = m.count === 1 && m.object.count === 1 && m.object.visible;
  const noField = m.heightRes === 0 && m.heightTexture.image.width === 1;
  m.dispose();
  return check('markers API (capacity, free, no heightField → 1×1 texture)', c === -1 && b >= 0 && one && noField, { c, one, noField });
}

function checkDrape() {
  // the baked height texture equals the terrain at texel centres (steps, ledge, stair treads)
  const img = markers.heightTexture.image;
  const res = markers.heightRes;
  let worst = 0;
  const probes = [[31.5, 18.1], [31.5, 17.9], [41, 12.1], [41, 11.9], [35.5, 10.1], [35.5, 10.4], [35.5, 10.6], [35.5, 11.9], [10, 20]].map(([x, z]) => [x, z + Z0]);
  for (const [x, z] of probes) {
    const i = Math.floor(x * res);
    const j = Math.floor(z * res);
    const v = THREE.DataUtils.fromHalfFloat(img.data[j * img.width + i]);
    const ref = groundY((i + 0.5) / res, (j + 0.5) / res);
    worst = Math.max(worst, Math.abs(v - ref));
  }
  return check('marker height texture matches the terrain (res 4, baked)', worst < 0.01 && res === 4 && markers.heightReady,
    { worst: +worst.toFixed(4), res, ready: markers.heightReady, bakeMs: markers.bakeMs, slices: markers.bakeSlices, size: [img.width, img.height] });
}

/**
 * COMBAT-09: a big, slow height field (128 × 128 u, ≈ 0.5 µs per sample on top of the terrain
 * lookup: a cold bake under load) still bakes at 4 texels per unit, in slices — the constructor
 * returns after one ≤ 6 ms slice (+ one row), the pump and update() finish it without a long task,
 * and the result equals the sampler at texel centres. A draw before the pump is done
 * (`onBeforeRender`) finishes the bake first.
 */
async function checkSlicedBake() {
  const N = 128;
  const slow = (x, z) => {
    let a = 0;
    for (let k = 0; k < 24; k++) a += Math.sin(x * 0.37 + z * 0.11 + k);
    return Math.floor(x / 5) * 0.5 + (Math.floor(z / 3) % 4) * 0.25 + a * 1e-9;
  };
  const hf = { sample: slow, minX: 0, minZ: 0, maxX: N, maxZ: N };
  const t0 = performance.now();
  const m = new GroundMarkers({ capacity: 2, name: 'check:bake', heightField: hf });
  const ctorMs = performance.now() - t0;
  const readyAtOnce = m.heightReady;
  const t1 = performance.now();
  let frames = 0;
  while (!m.heightReady && performance.now() - t1 < 20000) {
    m.update();
    await nextFrame();
    frames++;
  }
  const wallMs = Math.round(performance.now() - t1);
  const img = m.heightTexture.image;
  let worst = 0;
  for (let k = 0; k < 64; k++) {
    const i = (k * 131) % img.width;
    const j = (k * 197 + 11) % img.height;
    const v = THREE.DataUtils.fromHalfFloat(img.data[j * img.width + i]);
    worst = Math.max(worst, Math.abs(v - slow((i + 0.5) / m.heightRes, (j + 0.5) / m.heightRes)));
  }
  // one row of this field costs ~ bakeMs / 512: a slice may overrun its budget by that much
  const rowMs = m.bakeMs / img.height;
  const sliced = m.bakeSlices > 1 && m.bakeLongestMs <= 6 + 2 * rowMs + 1;
  m.dispose();
  // a draw before the bake is done finishes it first
  const m2 = new GroundMarkers({ capacity: 1, name: 'check:bake2', heightField: hf });
  const pending = !m2.heightReady;
  // (cast: GroundMarkers' hook ignores the six render arguments Object3D declares)
  /** @type {() => void} */ (m2.object.onBeforeRender)();
  const forced = m2.heightReady && m2.heightRes === 4;
  m2.dispose();
  return check('slow 128 × 128 height bake: res 4, sliced, no long task (COMBAT-09)',
    !readyAtOnce && m.heightRes === 4 && img.width === N * 4 && worst < 0.01 && sliced && ctorMs <= 6 + 2 * rowMs + 1 && pending && forced,
    { res: m.heightRes, size: [img.width, img.height], bakeMs: m.bakeMs, slices: m.bakeSlices, longestMs: m.bakeLongestMs,
      rowMs: +rowMs.toFixed(2), ctorMs: +ctorMs.toFixed(1), frames, wallMs, worst: +worst.toFixed(4), pending, forced });
}

function checkParticles() {
  const before = poolsPrimed;
  const after = fireBursts();
  const cfg = (n) => particles._burstConfigs.get(n)?._pool;
  const shared = cfg('hitSpark') === cfg('emberBurst') && cfg('deathPoof') === cfg('footstep') && cfg('gooPoof') === cfg('footstep')
    && cfg('healGlow') === cfg('sparkle') && cfg('magicBurst') === cfg('sparkle')
    && cfg('victoryEmbers') === cfg('emberBurst') && cfg('victorySparkle') === cfg('sparkle') && cfg('levelSparkle') === cfg('sparkle');
  // COMBAT-16 / COMBAT-15: the boss-death and level-up variants peak at about the 1.05 bloom threshold
  const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const peak = (n) => { const k = particles._burstConfigs.get(n); return Math.max(...(k._palette ?? [k._color]).map(lum)); };
  const peaks = Object.fromEntries(['victoryEmbers', 'victorySparkle', 'levelSparkle', 'emberBurst', 'sparkle'].map((n) => [n, +peak(n).toFixed(2)]));
  const dim = peaks.victoryEmbers <= 1.1 && peaks.victorySparkle <= 1.25 && peaks.levelSparkle <= 1.25;
  return check('combat bursts add exactly one pool; the COMBAT-16 variants share it and stay near the bloom threshold', after - before === 1 && shared && dim,
    { before, after, shared, peaks });
}

async function checkPrograms() {
  await frames(3);
  const keys = (renderer.info.programs ?? []).map((p) => p.cacheKey);
  const fxq = keys.filter((k) => k.includes('luminati-fxquads-v1')).length;
  const gm = keys.filter((k) => k.includes('luminati-groundmarkers-v1')).length;
  const callsQ = drawCallsOf(quads.object);
  const callsM = drawCallsOf(markers.object);
  return check('one program + one draw call each (fxquads-v1, groundmarkers-v1)', fxq === 1 && gm === 1 && callsQ === 1 && callsM === 1,
    { fxq, gm, callsQ, callsM, quads: quads.count, markers: markers.count });
}

function checkInput() {
  // peaceful Input: J / mouse unbound, not preventDefault'ed; addBindings binds and prevents
  const kd = (el, code) => {
    const e = new KeyboardEvent('keydown', { code, cancelable: true, bubbles: true });
    el.dispatchEvent(e);
    const up = new KeyboardEvent('keyup', { code, cancelable: true, bubbles: true });
    el.dispatchEvent(up);
    return e.defaultPrevented;
  };
  const peacefulJ = kd(peacefulEl, 'KeyJ');
  const peacefulMouseCodes = peaceful._down.has('Mouse0') || peaceful.isDown('Mouse0');
  const q = new Input(document.createElement('div'));
  q.addBindings({ attack: ['KeyJ'] }, { attack: ['GamepadX'], zoomIn: [] });
  const tgt = q.target;
  const boundJ = kd(tgt, 'KeyJ');
  const replaced = JSON.stringify(q.padBindings.zoomIn) === '[]' && q.padBindings.zoomOut.join() === 'GamepadX'
    && q.bindings.confirm.join() === 'Space,Enter,KeyF';
  q.dispose();

  // synthetic pointer events: presses only on the canvas, releases anywhere
  const pd = (target, button, buttons) => target.dispatchEvent(new PointerEvent('pointerdown', { button, buttons, bubbles: true, cancelable: true }));
  const pu = (target, button, buttons) => target.dispatchEvent(new PointerEvent('pointerup', { button, buttons, bubbles: true, cancelable: true }));
  const panel = document.getElementById('panel');
  input.lastDevice = 'keyboard';
  pd(panel, 0, 1);
  const offCanvas = !input.isDown('Mouse0') && input.lastDevice === 'keyboard';
  pu(panel, 0, 0);
  pd(canvas, 2, 2);
  const onCanvas = input.isDown('Mouse2') && input.wasPressed('Mouse2') && input.actionPressed('dodge') && input.lastDevice === 'mouse';
  pu(panel, 2, 0); // released over a UI panel still releases
  const releasedAnywhere = !input.isDown('Mouse2') && input.wasReleased('Mouse2');
  pd(canvas, 0, 1);
  canvas.dispatchEvent(new PointerEvent('pointermove', { button: 1, buttons: 5, bubbles: true })); // chord: middle added
  const chord = input.isDown('Mouse0') && input.isDown('Mouse1');
  window.dispatchEvent(new Event('blur')); // blur releases every button
  const blurred = !input.isDown('Mouse0') && !input.isDown('Mouse1') && input._mouseDown.size === 0;
  const cm = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  canvas.dispatchEvent(cm);
  const cmPanel = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  panel.dispatchEvent(cmPanel);
  const menu = cm.defaultPrevented && !cmPanel.defaultPrevented;
  kd(window, 'KeyJ');
  const kb = input.lastDevice === 'keyboard';
  input._setPad('GamepadX', true);
  const pad = input.lastDevice === 'gamepad';
  input._setPad('GamepadX', false);
  input.lastDevice = 'keyboard';
  return check('input: addBindings, mouse edges on/off the canvas, chords, blur, context menu, lastDevice',
    !peacefulJ && !peacefulMouseCodes && boundJ && replaced && offCanvas && onCanvas && releasedAnywhere && chord && blurred && menu && kb && pad,
    { peacefulJ, peacefulMouseCodes, boundJ, replaced, offCanvas, onCanvas, releasedAnywhere, chord, blurred, menu, kb, pad });
}

function checkStickZoom() {
  const cam = new THREE.PerspectiveCamera(28, 16 / 9, 0.5, 400);
  const stick = { x: 0, y: 1 };
  const fake = { enabled: true, action: () => false, wheelDelta: 0, getLookVector: () => stick };
  const run = (sz) => {
    const r = new CameraRig(cam, { distance: 30, minDistance: 18, maxDistance: 42 });
    r.stickZoom = sz;
    for (let i = 0; i < 30; i++) r.update(1 / 60, fake);
    return r.distanceTarget;
  };
  const off = run(0);
  const on = run(14);
  stick.y = -1;
  const out = run(14);
  rig.update(0, input); // restore the shared camera uniforms for the main rig
  return check('stickZoom: off by default, 14 u/s at full deflection (up = zoom in)',
    off === 30 && Math.abs(on - (30 - 7)) < 1e-6 && Math.abs(out - (30 + 7)) < 1e-6, { off, on: +on.toFixed(4), out: +out.toFixed(4) });
}

async function checkAudioOffline() {
  const sr = 44100;
  const out = {};
  // SFX lists
  const namesOk = SFX_NAMES.join() === 'step,blip,confirm,cancel,open,close,chime,splash' && COMBAT_SFX_NAMES.length === 35
    && MUSIC_TRACKS.join() === 'emberfall,battle,boss';
  // every combat SFX: started, ≤ 6 own nodes, finite samples, sane peak
  const spacing = 2.4;
  const len = COMBAT_SFX_NAMES.length * spacing + 1;
  const off = new OfflineAudioContext(2, Math.ceil(sr * len), sr);
  const a = new AudioSystem({ context: off, reverb: 0 });
  await a.unlock();
  a._combatOut(0, false); // build the shared panner bank first (not a per-voice cost)
  let created = 0;
  for (const k of ['createGain', 'createOscillator', 'createBufferSource', 'createBiquadFilter', 'createStereoPanner', 'createConstantSource', 'createWaveShaper', 'createDelay']) {
    const orig = off[k].bind(off);
    off[k] = (...args) => { created++; return orig(...args); };
  }
  const nodes = {};
  let started = 0;
  COMBAT_SFX_NAMES.forEach((n, i) => {
    const c0 = created;
    if (a.playSfx(n, { delay: 0.2 + i * spacing }) === true) started++;
    nodes[n] = created - c0;
  });
  const buf = await off.startRendering();
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const per = {};
  let nan = 0;
  COMBAT_SFX_NAMES.forEach((n, i) => {
    const s0 = Math.floor((0.2 + i * spacing) * sr);
    const s1 = Math.min(L.length, Math.floor((0.2 + (i + 1) * spacing) * sr));
    let peak = 0;
    let sum = 0;
    for (let s = s0; s < s1; s++) {
      const l = L[s];
      const r = R[s];
      if (!Number.isFinite(l) || !Number.isFinite(r)) { nan++; continue; }
      peak = Math.max(peak, Math.abs(l), Math.abs(r));
      sum += l * l + r * r;
    }
    per[n] = { peak: +peak.toFixed(3), rmsDb: +(10 * Math.log10(sum / ((s1 - s0) * 2) + 1e-12)).toFixed(1), nodes: nodes[n] };
  });
  const maxNodes = Math.max(...Object.values(nodes));
  const peaks = Object.values(per).map((p) => p.peak);
  const silent = Object.entries(per).filter(([, p]) => p.peak < 0.01).map(([n]) => n);
  const hot = Object.entries(per).filter(([, p]) => p.peak > 0.95).map(([n]) => n);
  out.sfx = per;
  check('combat SFX: all 35 start, ≤ 6 nodes each, finite, audible, no clipping',
    namesOk && started === 35 && maxNodes <= 6 && nan === 0 && !silent.length && !hot.length,
    { namesOk, started, maxNodes, nan, silent, hot, peakMin: Math.min(...peaks), peakMax: Math.max(...peaks) });

  // reference: the existing SFX at the same settings (loudness comparison)
  const off2 = new OfflineAudioContext(2, Math.ceil(sr * 8), sr);
  const a2 = new AudioSystem({ context: off2, reverb: 0 });
  await a2.unlock();
  SFX_NAMES.forEach((n, i) => a2.playSfx(n, { delay: 0.2 + i * 0.9 }));
  const b2 = (await off2.startRendering()).getChannelData(0);
  let refPeak = 0;
  for (let s = 0; s < b2.length; s++) refPeak = Math.max(refPeak, Math.abs(b2[s]));
  out.refPeak = +refPeak.toFixed(3);

  // music: tempo per track, section switch at a bar line, crossfade overlap, levels per second
  const secs = 14;
  const off3 = new OfflineAudioContext(2, sr * secs, sr);
  const m = new AudioSystem({ context: off3 });
  await m.unlock();
  m.startMusic({ fade: 0.5 });
  const t0 = { track: m.musicTrack, bpm: m._music.bpm };
  for (let now = 0; now < 5; now += 0.175) { m._voices = 0; m._scheduleMusic(now); }
  let cross = null;
  off3.suspend(5).then(() => {
    const old = m._music;
    m.startMusic({ track: 'battle', fade: 1.2 });
    cross = { oldStopping: old.stopping, newTrack: m._music.track, bpm: m._music.bpm, musicTrack: m.musicTrack };
    for (let now = 5; now < 9.5; now += 0.175) { m._voices = 0; m._scheduleMusic(now); }
    off3.resume();
  });
  let sect = null;
  off3.suspend(9.5).then(() => {
    m.startMusic({ track: 'boss', fade: 0.8 });
    const bpm = m._music.bpm;
    m.setMusicSection('B');
    const pending = m._music.pending;
    for (let now = 9.5; now < secs; now += 0.175) { m._voices = 0; m._scheduleMusic(now); }
    sect = { bpm, pending, section: m.musicSection, stinger: m.playStinger('levelup') };
    off3.resume();
  });
  const b3 = await off3.startRendering();
  const M = b3.getChannelData(0);
  const perSecond = [];
  for (let s = 0; s < secs; s++) {
    let sum = 0;
    for (let k = s * sr; k < (s + 1) * sr; k++) sum += M[k] * M[k];
    perSecond.push(+(10 * Math.log10(sum / sr + 1e-12)).toFixed(1));
  }
  out.music = { t0, cross, sect, perSecond };
  const gap = perSecond.slice(1).some((db) => db < -45);
  check('music: emberfall 72 → battle 132 crossfade → boss 140 section B, stinger, no gap',
    t0.track === 'emberfall' && t0.bpm === 72 && cross?.oldStopping && cross.newTrack === 'battle' && cross.bpm === 132
      && cross.musicTrack === 'battle' && sect?.bpm === 140 && sect.section === 'B' && sect.stinger === true && !gap,
    { t0, cross, sect, perSecond });

  // remembered track: toggle / stop / start restart it; a new track resets the section wish
  const r = new AudioSystem();
  r.startMusic({ track: 'boss' });
  r.setMusicSection('B');
  r.toggleMusic();
  const offTrack = r.musicTrack;
  r.toggleMusic();
  const again = r.musicTrack;
  const secWish = r._sectionWanted;
  r.startMusic({ track: 'battle' });
  const reset = r._sectionWanted;
  r.dispose();
  check('music: remembered track and section across toggles (before unlock)', offTrack === null && again === 'boss' && secWish === 'B' && reset === null,
    { offTrack, again, secWish, reset });
  return out;
}

/**
 * Offline-render a music track (optionally with voice methods muted, e.g. ['_taiko']) and return
 * the RMS level (dB) per second plus the peak — the tool used to balance the combat tracks.
 * @param {string} [track]  a MUSIC_TRACKS name ('battle')
 * @param {number} [seconds]  (12)
 * @param {string[]} [mute]  AudioSystem voice method names replaced by no-ops
 */
async function renderTrack(track = 'battle', seconds = 12, mute = []) {
  const sr = 44100;
  const off = new OfflineAudioContext(2, sr * seconds, sr);
  const a = new AudioSystem({ context: off });
  for (const m of mute) a[m] = () => {};
  await a.unlock();
  a.startMusic({ track, fade: 0.05 });
  // (offline: no voice ends before rendering, so reset the voice count the cap reads — as live)
  for (let now = 0; now < seconds; now += 0.175) { a._voices = 0; a._scheduleMusic(now); }
  const b = (await off.startRendering()).getChannelData(0);
  const perSecond = [];
  let peak = 0;
  let all = 0;
  for (let s = 0; s < seconds; s++) {
    let sum = 0;
    for (let k = s * sr; k < (s + 1) * sr; k++) { sum += b[k] * b[k]; peak = Math.max(peak, Math.abs(b[k])); }
    all += sum;
    perSecond.push(+(10 * Math.log10(sum / sr + 1e-12)).toFixed(1));
  }
  return { track, mute, rmsDb: +(10 * Math.log10(all / (sr * seconds) + 1e-12)).toFixed(1), peak: +peak.toFixed(3), perSecond };
}

async function runChecks() {
  results.done = false;
  const w0 = warnings.length;
  checkQuadsApi();
  checkMarkersApi();
  checkDrape();
  await checkSlicedBake();
  checkParticles();
  await checkPrograms();
  checkInput();
  checkStickZoom();
  results.audio = await checkAudioOffline();
  // live context (autoplay allowed in the harness): every combat SFX once, then battle → boss
  const ok = await audio.unlock();
  if (ok) {
    COMBAT_SFX_NAMES.forEach((n, i) => audio.playSfx(n, { delay: i * 0.05, volume: 0.3 }));
    audio.startMusic({ track: 'battle', fade: 1 });
  }
  check('no warnings from the modules under test', warnings.length === w0, { warnings: warnings.slice(w0) });
  results.allOk = Object.values(results.checks).every((c) => c.ok);
  results.done = true;
  const el = document.getElementById('checks');
  el.innerHTML = Object.entries(results.checks).map(([k, v]) => `<span class="${v.ok ? 'ok' : 'bad'}">${v.ok ? '✓' : '✗'} ${k}</span>`).join('\n');
  return { allOk: results.allOk, checks: Object.fromEntries(Object.entries(results.checks).map(([k, v]) => [k, v.ok])) };
}

/**
 * `window.__cfx` (AUTOMATION_API.md §7), read by sandbox/combat_fx.actions.json.
 * @typedef {object} CfxHandle
 * @property {typeof THREE} THREE
 * @property {Engine} engine
 * @property {CameraRig} rig
 * @property {PostFX} postfx
 * @property {LightingSystem} lighting
 * @property {TileMap} tileMap
 * @property {FxQuads} quads  the main quad batch (every mode)
 * @property {GroundMarkers} markers  the gallery + stepped markers, draped on the terrain
 * @property {Particles} particles
 * @property {AudioSystem} audio  the live audio system (the SFX / music buttons)
 * @property {Input} input  the engine's Input with the combat bindings and mouse buttons
 * @property {Input} peaceful  an Input on a detached element, without combat bindings
 * @property {ReturnType<typeof createFxAtlas>} atlas
 * @property {typeof results} results  `checks` by name ({ ok, …detail }), `allOk`, `done`,
 *   `audio` (after runChecks)
 * @property {typeof mouse} mouse  combat actions / mouse releases counted by the frame loop
 * @property {typeof setView} setView
 * @property {(h: number) => number} setTime  set the clock (hours); returns the time of day
 * @property {(p: number|null) => number|null} setProgress  freeze every marker's progress (null:
 *   cycle again)
 * @property {(on: boolean) => boolean} setAutoBursts  fire the bursts every 2.4 s (default on)
 * @property {typeof fireBursts} fireBursts  both burst rows now; returns the pool count
 * @property {(n?: number) => number} step  stop the loop and advance exactly n frames; returns
 *   the frame number
 * @property {() => boolean} play  restart the loop
 * @property {typeof runChecks} runChecks
 * @property {typeof renderTrack} renderTrack
 * @property {typeof stats} stats
 * @property {typeof drawCallsOf} drawCallsOf
 * @property {string[]} warnings  console warnings raised since load
 */
window.__cfx = {
  THREE, engine, rig, postfx, lighting, tileMap, quads, markers, particles, audio, input, peaceful, atlas, results, mouse,
  setView,
  setTime(h) { lighting.setTime(h); return lighting.timeOfDay; },
  setProgress(p) { frozenProgress = p; return p; },
  setAutoBursts(on) { autoBursts = !!on; return autoBursts; },
  fireBursts,
  /** Stop the loop and advance exactly n frames (deterministic screenshots of short effects). */
  step(n = 1) { engine.stop(); for (let i = 0; i < n; i++) engine.step(1 / 60); return engine.time.frame; },
  play() { engine.start(); return true; },
  runChecks,
  renderTrack,
  stats,
  drawCallsOf,
  warnings,
};
console.log('combat_fx sandbox ready');
