/**
 * Sandbox for src/engine/world/Props.js — a showcase diorama lot.
 *
 * Raw three.js + foundation files + TextureLibrary only (other modules are stubbed locally:
 * point lights come straight from PropResult.lights, emissives are driven by hand, and a tiny
 * local sprite stub previews the smoke / ember emitter descriptors).
 *
 * window.__props: { renderer, scene, camera, factory, textures, results, setNight(bool),
 *                   frame(name | {x, z, dist, yaw, pitch}), info(), check() }
 * Query: ?night=1  ?view=house|trees|market|bridge|windmill|campfire|overview  ?mode=gallery  ?merge=1
 * ?mode=interior: three furnished rooms (a home, an inn, a mill — props/Furniture.js) and a gallery of
 * every furniture option; views `interior`, `roomHome`, `roomInn`, `roomMill`, `gBeds`, `gRow2`,
 * `gRow2b`, `gRow3`, `gHearth`, `gTables`
 * (the gallery's back row holds the combat props: chests closed / open, waystones idle / attuned —
 * frame them with `__props.frame('gCombat')` or `'gChests'`)
 */
import * as THREE from 'three';
import { TextureLibrary } from '../src/engine/pixel/Textures.js';
import { PropFactory, boxUnion } from '../src/engine/world/Props.js';
import { interiorFootprint, objectBounds } from '../src/engine/level/ObjectCatalog.js';
import { MeshBuilder } from '../src/engine/world/props/MeshBuilder.js';
import { globalUniforms } from '../src/engine/render/GlobalUniforms.js';
import { DEG2RAD, lerp, clamp, valueNoise2 } from '../src/engine/utils/math.js';

/**
 * @import { PropResult } from '../src/engine/world/Props.js'
 * @import { SceneNode, SceneMaterial, SolidMesh } from '../src/engine/render/types.js'
 * @import { HouseOptions } from '../src/engine/world/props/House.js'
 * @import { LevelObject } from '../src/engine/level/types.js'
 */

const params = new URLSearchParams(location.search);

// ---------------------------------------------------------------------------------------------
// renderer / scene / camera
// ---------------------------------------------------------------------------------------------
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
const camera = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 0.5, 400);

const hemi = new THREE.HemisphereLight('#a9bde0', '#4a3a2e', 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffc98a', 3);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const SE = 26;
Object.assign(sun.shadow.camera, { left: -SE, right: SE, top: SE, bottom: -SE, near: 1, far: 120 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.035;
sun.shadow.radius = 3;
scene.add(sun, sun.target);

// ---------------------------------------------------------------------------------------------
// ground diorama: two grass banks with cliff sides, a river bed and a water plane
// ---------------------------------------------------------------------------------------------
const textures = new TextureLibrary({ seed: 1337, anisotropy: 8 });
const factory = new PropFactory({ textures, seed: 42 });

const X0 = -20;
const X1 = 20;
const Z0 = -13;
const Z1 = 12;
const RIVER = [6.5, 9.5];
const BASE = -2.0;
const BED = -1.0;
const WATER = -0.42;

function buildGround() {
  const b = new MeshBuilder(textures, { ao: (x, y) => 0.55 + 0.45 * clamp((y - BASE) / 1.6, 0, 1) });
  const bank = (xa, xb) => {
    const w = xb - xa;
    const d = Z1 - Z0;
    const cx = (xa + xb) / 2;
    const cz = (Z0 + Z1) / 2;
    // grass top
    b.box('grass', [w, 0.02, d], { at: [cx, -0.01, cz], faces: { py: { off: [xa - X0, 0] }, ny: false, pz: false, nz: false, px: false, nx: false } });
    // grass lip (top unit) + cliff below
    b.box('grass_side', [w, 1, d], { at: [cx, -0.5, cz], faces: { py: false, ny: false }, off: [0, 0] });
    b.box('cliff', [w, -BASE - 1, d], { at: [cx, (BASE - 1) / 2, cz], faces: { py: false, ny: false } });
  };
  bank(X0, RIVER[0]);
  bank(RIVER[1], X1);
  // river bed + its banks' inner edge is already the cliff of each bank
  const rw = RIVER[1] - RIVER[0];
  b.box('riverbed', [rw, BED - BASE, Z1 - Z0], { at: [(RIVER[0] + RIVER[1]) / 2, (BED + BASE) / 2, (Z0 + Z1) / 2], faces: { ny: false, px: false, nx: false } });
  // dirt path from the bridge into the village and cobbles around the well
  const path = textures.material('dirt_path', { vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  b.box(path, [12.5, 0.02, 2.2], { at: [0.25, 0.005, 1.1], faces: { py: {}, ny: false, pz: false, nz: false, px: false, nx: false } });
  b.box(path, [2.2, 0.02, 7.5], { at: [-2.6, 0.005, -3.6], faces: { py: {}, ny: false, pz: false, nz: false, px: false, nx: false } });
  b.box(path, [9.5, 0.02, 2.0], { at: [14.75, 0.005, 1.1], faces: { py: {}, ny: false, pz: false, nz: false, px: false, nx: false } });
  const cob = textures.material('stone_tiles', { vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  b.box(cob, [5, 0.02, 4], { at: [-5.5, 0.008, 1.2], faces: { py: {}, ny: false, pz: false, nz: false, px: false, nx: false } });
  b.box('farmland', [6, 0.04, 4.5], { at: [14.5, 0.0, 7.3], faces: { ny: false } });
  const { group } = b.build('ground');
  return group;
}
const MODE = params.get('mode') || 'lot';
if (MODE === 'lot') scene.add(buildGround());

// water plane
const waterMat = new THREE.MeshStandardMaterial({ color: '#2f6f9a', roughness: 0.18, metalness: 0.0, transparent: true, opacity: 0.82, emissive: '#0b2a44', emissiveIntensity: 0.4 });
const water = new THREE.Mesh(new THREE.PlaneGeometry(RIVER[1] - RIVER[0], Z1 - Z0), waterMat);
water.rotation.x = -Math.PI / 2;
water.position.set((RIVER[0] + RIVER[1]) / 2, WATER, (Z0 + Z1) / 2);
water.receiveShadow = true;
if (MODE === 'lot') scene.add(water);

// ---------------------------------------------------------------------------------------------
// props
// ---------------------------------------------------------------------------------------------
/** @typedef {PropResult & { name?: string }} NamedProp */
/** @type {NamedProp[]} every built prop, tagged with its sandbox name */
const results = [];
/** @param {string} name @param {NamedProp} r @returns {NamedProp} */
const add = (name, r) => { r.name = name; scene.add(r.object); results.push(r); return r; };

const tBuild = performance.now();
function buildLot() {
  // houses
  add('houseA', factory.house(-9, 0, -6.5, { width: 4, depth: 3, wall: 'timber_frame', roof: 'roof_red', seed: 3, sign: false }));
  add('houseB', factory.house(-1.5, 0, -7.2, { width: 5, depth: 3.5, stories: 2, wall: 'brick', upperWall: 'timber_frame', roof: 'roof_blue', seed: 11, sign: true }));
  add('houseC', factory.house(-15, 0, -1.5, { width: 4, depth: 4, wall: 'log_wall', roof: 'roof_thatch', rotation: Math.PI / 2, gableFront: true, seed: 5, chimney: true }));
  add('houseD', factory.house(15.5, 0, -8.5, { width: 4, depth: 3, wall: 'stone_brick', roof: 'roof_slate', seed: 21, rotation: -0.15 }));

  // trees
  /** @type {[kind: string, x: number, z: number, height: number][]} */
  const trees = [
    ['oak', -17.5, -9.5, 5.2], ['oak', -12.8, -10.6, 4.6], ['oak', 3.5, -10.5, 5.0],
    ['autumn', -5.5, -10.3, 4.6], ['autumn', 11.5, 3.5, 4.4],
    ['pine', 18, -3.5, 5.6], ['pine', 17.8, -11.2, 5.0], ['pine', 4.8, 8.8, 4.8],
    ['birch', 11.8, -11.0, 5.2],
    // grove (front-left)
    ['oak', -17.6, 5.2, 4.8], ['autumn', -14.2, 8.9, 4.2], ['birch', -11.6, 8.2, 5.0], ['pine', -19.0, 9.6, 5.2], ['oak', -15.8, 11.0, 3.8],
  ];
  for (const [kind, x, z, h] of trees) add(`tree:${kind}`, factory.tree(x, 0, z, { kind, height: h }));

  // lampposts along the path
  add('lamp1', factory.lamppost(-0.8, 0, 2.6, { rotation: Math.PI }));
  add('lamp2', factory.lamppost(4.8, 0, -0.4, { rotation: 0 }));
  add('lamp3', factory.lamppost(-8.6, 0, -0.9, { rotation: Math.PI }));
  add('lamp4', factory.lamppost(11.2, 0, -0.3, { rotation: 0, style: 'top' }));

  // well, market, campfire, bench, signpost
  add('well', factory.well(-5.5, 0, 1.0));
  add('stall', factory.marketStall(1.2, 0, -2.2, { rotation: 0 }));
  add('campfire', factory.campfire(-8.2, 0, 6.0));
  add('bench', factory.bench(-5.6, 0, 4.4, { rotation: Math.PI }));
  add('bench2', factory.bench(-10.8, 0, 4.6, { rotation: Math.PI / 2 + 0.35, back: false, length: 1.6 }));
  add('signpost', factory.signpost(4.9, 0, 2.7, { rotation: 0.2 }));

  // bridge over the river (deck at bank height)
  add('bridge', factory.bridge(5.4, 1.1, 10.6, 1.1, 0.0, { width: 2 }));

  // windmill + farm on the east bank
  add('windmill', factory.windmill(14.5, 0, -3.5, { rotation: -0.35 }));
  add('haystack', factory.haystack(17.5, 0, 3.8));
  add('haystack2', factory.haystack(12.2, 0, 7.6, { size: 0.75 }));
  add('fenceF1', factory.fence(11.0, 4.6, 18.8, 4.6, 0));
  add('fenceF2', factory.fence(11.0, 4.6, 11.0, 10.5, 0));
  add('fenceF3', factory.fence(18.8, 4.6, 18.8, 10.5, 0));

  // village fence along the front edge
  add('fence1', factory.fence(-12.2, 10.8, -8.5, 10.8, 0));
  add('fence2', factory.fence(-7.5, 10.8, 0.5, 10.8, 0));

  // crates / barrels
  add('crates1', factory.crateStack(3.3, 0, -4.4, { rotation: 0.1 }));
  add('barrel1', factory.barrel(-6.3, 0, -4.1));
  add('barrel2', factory.barrel(-5.5, 0, -4.4, { height: 0.9 }));
  add('barrel3', factory.barrel(-12.5, 0, -3.5, { lying: true, rotation: 0.4 }));
  add('crate1', factory.crate(-1.4, 0, -3.8, { size: 0.8 }));
  add('crates2', factory.crateStack(12.8, 0, -7.2, { rotation: -0.5, count: 2 }));

  // rocks
  add('rock1', factory.rock(2.6, 0, 6.6, { size: 1.3 }));
  add('rock2', factory.rock(10.4, 0, -4.8, { size: 0.9 }));
  add('rock3', factory.rock(-19, 0, 2.8, { size: 1.4 }));
  add('rock4', factory.rock(0.6, 0, 7.4, { size: 0.6 }));
  add('rock5', factory.rock(19.1, 0, 10.8, { size: 0.8 }));

  // flower boxes + wall torch on house D
  add('flowers1', factory.flowerbox(-4.1, 0, -4.4, { rotation: 0 }));
  add('flowers2', factory.flowerbox(-11.8, 0, -4.4, { rotation: 0.1, length: 1.0 }));
  add('torch', factory.wallTorch(14.0, 1.9, -6.95, { rotation: -0.15 }));
  add('torch2', factory.wallTorch(1.02, 2.1, -6.3, { rotation: Math.PI / 2 }));
}

/** Option-coverage gallery on a flat grass plane (?mode=gallery). */
function buildGallery() {
  const g = new MeshBuilder(textures, {});
  g.box('grass', [64, 0.02, 44], { at: [0, -0.01, 2], faces: { py: {}, ny: false, pz: false, nz: false, px: false, nx: false } });
  scene.add(g.build('galleryGround').group);
  /** @type {HouseOptions[]} */
  const houses = [
    { width: 5, depth: 4, stories: 2, wall: 'plaster', roof: 'roof_red', gableFront: true, seed: 1 },
    { width: 6, depth: 3, wall: 'log_wall', roof: 'roof_thatch', door: 'left', seed: 2 },
    { width: 4, depth: 4, stories: 2, wall: 'stone_brick', upperWall: 'timber_frame', roof: 'roof_slate', rotation: 0.5, seed: 3 },
    { width: 3, depth: 3, wall: 'brick', roof: 'roof_blue', door: 'back', rotation: Math.PI - 0.3, seed: 4 },
    { width: 5, depth: 3.5, stories: 2, wall: 'timber_frame', roof: 'roof_thatch', sign: true, windowLights: true, seed: 5, chimney: false },
  ];
  houses.forEach((o, i) => add(`gHouse${i}`, factory.house(-22 + i * 11, 0, -10, o)));
  /** @type {[kind: string, height: number][]} */
  const kinds = [['oak', 3.5], ['oak', 4.5], ['oak', 5.5], ['autumn', 4], ['autumn', 5], ['pine', 4], ['pine', 6.5], ['birch', 4.5], ['birch', 5.5]];
  kinds.forEach(([kind, h], i) => add(`gTree${i}`, factory.tree(-24 + i * 6, 0, 2, { kind, height: h, seed: i * 7 })));
  add('gFenceDiag', factory.fence(-26, 8, -18, 14, 0));
  add('gBridgeZ', factory.bridge(-12, 8, -12, 15, 0.4, { width: 2.5, arch: 0.5 }));
  add('gLampTop', factory.lamppost(-6, 0, 10, { style: 'top' }));
  add('gLampArm', factory.lamppost(-4, 0, 10, { rotation: 2.2 }));
  add('gBarrelLying', factory.barrel(0, 0, 10, { lying: true }));
  add('gCrate', factory.crate(2, 0, 10, { size: 1 }));
  add('gStack', factory.crateStack(5, 0, 10, { count: 3, barrel: true }));
  add('gBench', factory.bench(9, 0, 10, { back: false }));
  add('gFlowerWall', factory.flowerbox(12, 0.8, 10, { wall: true }));
  add('gHay', factory.haystack(16, 0, 10, { size: 0.6 }));
  add('gRock', factory.rock(20, 0, 10, { size: 2 }));
  add('gRockFlat', factory.rock(24, 0, 10, { size: 1, flat: true }));
  add('gStall', factory.marketStall(-2, 0, 16, { cloth: 'cloth_red', rotation: 0.4, width: 2.4 }));
  add('gWell', factory.well(6, 0, 16, { roof: 'roof_red', rotation: 0.6 }));
  add('gCamp', factory.campfire(12, 0, 16, { seat: false }));
  add('gSign', factory.signpost(16, 0, 16, { boards: 1, rotation: -0.5 }));
  add('gMill', factory.windmill(22, 0, 17, { roof: 'roof_slate', wall: 'wood_planks', height: 5, rotation: 0.4 }));
  // combat props (COMBAT.md §14.3): a closed and an opened chest, an idle and an attuned waystone
  add('gChest', factory.chest(-9, 0, 21, { rotation: 0.3 }));
  add('gChestOpen', factory.chest(-6.5, 0, 21, { rotation: -0.2 })).controls.open(true);
  add('gWaystone', factory.waystone(-2.5, 0, 20.5));
  add('gWaystoneOn', factory.waystone(1.5, 0, 20.5)).controls.setAttuned(true);
}
/**
 * A room shell like a tile level's: a floor, walls 3 high on the north / west / east and a low south
 * wall (the camera looks north into it), x0…x0 + W by z0…z0 + D.
 * @param {MeshBuilder} g
 */
function roomShell(g, x0, z0, W, D, { floor = 'wood_deck', wall = 'plaster', wallH = 3 } = {}) {
  const cx = x0 + W / 2;
  const cz = z0 + D / 2;
  const top = { py: { mat: 'stone_wall', color: [0.55, 0.5, 0.48] } };
  g.box(floor, [W, 0.2, D], { at: [cx, -0.1, cz], faces: { ny: false, pz: false, nz: false, px: false, nx: false } });
  g.box(wall, [W + 2, wallH, 1], { at: [cx, wallH / 2 - 0.2, z0 - 0.5], faces: { ...top, ny: false, nz: false }, off: [x0, 0] });
  for (const sx of [-1, 1]) g.box(wall, [1, wallH, D], { at: [sx < 0 ? x0 - 0.5 : x0 + W + 0.5, wallH / 2 - 0.2, cz], faces: { ...top, ny: false }, off: [z0, 0] });
  g.box('stone_wall', [W + 2, 0.7, 1], { at: [cx, 0.15, z0 + D + 0.5], faces: { ny: false } });
}

/**
 * The furniture built in ?mode=interior, by sandbox name: what `furnitureCheck` compares with the
 * catalog's footprints.
 * @type {Map<string, { type: FurnitureType, x: number, z: number, opts: Record<string, any> }>}
 */
const furniture = new Map();
/** @typedef {'bed'|'table'|'chair'|'shelf'|'hearth'|'counter'|'rug'|'staircase'|'wardrobe'|'wallWindow'|'sacks'} FurnitureType */
/**
 * Build a furniture piece on the floor (y 0) and record it.
 * @param {string} name @param {FurnitureType} type @param {number} x @param {number} z
 * @param {Record<string, any>} [opts]
 */
function fur(name, type, x, z, opts = {}) {
  furniture.set(name, { type, x, z, opts });
  const make = /** @type {(x: number, y: number, z: number, o: object) => PropResult} */ (factory[type].bind(factory));
  return add(name, make(x, 0, z, opts));
}

/** Furnished rooms (a home, an inn, a mill) and a gallery of every furniture option (?mode=interior). */
function buildInterior() {
  const g = new MeshBuilder(textures, { ao: (x, y) => 0.7 + 0.3 * clamp(y / 1.5, 0, 1) });
  roomShell(g, -21, -5, 12, 9, { wall: 'plaster' });
  roomShell(g, -6, -5, 12, 9, { wall: 'timber_frame' });
  roomShell(g, 9, -5, 12, 9, { floor: 'stone_tiles', wall: 'stone_wall' });
  g.box('wood_deck', [46, 0.2, 16], { at: [0, -0.1, 15], faces: { ny: false } });
  g.box('plaster', [10, 3, 0.6], { at: [11, 1.3, 15.2], faces: { ny: false } }); // a wall for the window variants
  scene.add(g.build('rooms').group);
  const H = Math.PI / 2;
  // ---- a home: double bed, wardrobe and drawers on the north wall, a hearth on the west wall,
  // a round table on a rug, a bookshelf on the east wall, a window with flowers
  fur('hWindow', 'wallWindow', -14.5, -5, { panes: 2, flowers: true });
  fur('hBed', 'bed', -19.2, -3.9, { width: 1.9, blanket: 'blue', seed: 2 });
  fur('hDrawers', 'wardrobe', -17, -4.75, { kind: 'drawers', width: 1.0, seed: 1 });
  fur('hWardrobe', 'wardrobe', -11.2, -4.7, { width: 1.4 });
  fur('hHearth', 'hearth', -20.5, 0.6, { rotation: H, pot: true, height: 2.8 });
  fur('hRug', 'rug', -14.5, 0.3, { rotation: H, width: 2.5, length: 3.5 });
  fur('hTable', 'table', -14.5, 0.3, { shape: 'round', width: 1.2, seed: 3 });
  fur('hChair1', 'chair', -15.65, 0.3, { rotation: H });
  fur('hChair2', 'chair', -13.35, 0.3, { rotation: -H });
  fur('hStool', 'chair', -14.5, 1.45, { style: 'stool' });
  fur('hShelf', 'shelf', -9.25, -1.5, { rotation: -H, width: 1.6 });
  // ---- an inn: a bar with a pantry shelf behind it, a stair up on the north wall, a hearth on the
  // east wall, tables with chairs and stools, a warm window on the west wall
  fur('iCounter', 'counter', -2.6, -2.6, { width: 3.2 });
  fur('iPantry', 'shelf', -2.6, -4.75, { kind: 'pantry', width: 2.4 });
  add('iBarrel', factory.barrel(-5.3, 0, -4.4));
  fur('iStairs', 'staircase', 3.5, -4.4, { steps: 7, height: 2.8 });
  fur('iHearth', 'hearth', 5.5, 0.4, { rotation: -H, width: 2.0 });
  fur('iWindow', 'wallWindow', -6, 0.5, { rotation: H, glow: 'warm', curtains: 'linen' });
  fur('iTable1', 'table', -2.4, 1.5, { cloth: true, candle: true, seed: 4 });
  fur('iChair1', 'chair', -2.8, 0.7, { seed: 1 });
  fur('iChair2', 'chair', -2.0, 2.3, { rotation: Math.PI });
  fur('iTable2', 'table', 2.2, 1.6, { shape: 'round', width: 1.3, seed: 6 });
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + 0.4;
    fur(`iStool${k}`, 'chair', 2.2 + Math.cos(a) * 1.0, 1.6 + Math.sin(a) * 1.0, { style: 'stool', seed: k });
  }
  fur('iRug', 'rug', 0.2, -0.6, { rotation: H, width: 1.4, length: 4, color: 'green' });
  // ---- a mill: sacks, a shop counter, a stairwell down, crates and hay, a pantry shelf
  fur('mSacks4', 'sacks', 11, -4.4, { count: 4 });
  fur('mSacks2', 'sacks', 12.9, -4.5, { count: 2, rotation: 0.3, seed: 2 });
  fur('mSacks3', 'sacks', 19.5, 2.6, { count: 3, rotation: H, seed: 3 });
  fur('mCounter', 'counter', 15, -1.4, { style: 'shop', width: 2.6 });
  fur('mDown', 'staircase', 18.6, -3.6, { dir: 'down', steps: 5 });
  fur('mWindow', 'wallWindow', 15, -5, { curtains: 'none' });
  add('mCrates', factory.crateStack(20, 0, -4.3, { rotation: 0, count: 2 }));
  add('mHay', factory.haystack(10.8, 0, 2.6, { size: 0.75 }));
  fur('mShelf', 'shelf', 9.25, -0.5, { rotation: H, kind: 'pantry', width: 2.0, height: 1.7 });
  fur('mStool', 'chair', 14.2, 0.6, { style: 'stool' });
  // ---- gallery (open floor, z 8–21): every option
  ['red', 'blue', 'green', 'ochre', 'plum'].forEach((c, i) => fur(`gBed_${c}`, 'bed', -20 + i * 3, 9.8, { blanket: c, width: i % 2 ? 1.9 : 1.2, seed: i }));
  ['red', 'blue', 'green'].forEach((c, i) => fur(`gRug_${c}`, 'rug', -3 + i * 2.8, 9.8, { color: c, width: 2.2, length: 3 }));
  fur('gTableRect', 'table', 6.5, 9.4, { cloth: true, candle: true });
  fur('gTableRound', 'table', 9.5, 9.4, { shape: 'round', cloth: true, width: 1.4 });
  fur('gTableBare', 'table', 12.5, 9.4, { items: false, width: 1.4, depth: 0.8 });
  fur('gChair', 'chair', 15, 9.2);
  fur('gChairTurned', 'chair', 16, 9.2, { rotation: 0.8 });
  fur('gStool', 'chair', 17, 9.2, { style: 'stool' });
  fur('gShelfBooks', 'shelf', -19, 14, { width: 2.4, height: 2.6 });
  fur('gShelfPantry', 'shelf', -16, 14, { kind: 'pantry', width: 1.6 });
  fur('gShelfSmall', 'shelf', -13.8, 14, { width: 1.0, height: 1.2 });
  fur('gWardrobe', 'wardrobe', -11.5, 14, { width: 1.6 });
  fur('gDrawers', 'wardrobe', -9.2, 14, { kind: 'drawers' });
  fur('gCounterBar', 'counter', -5.6, 14, { width: 3 });
  fur('gCounterShop', 'counter', -1.6, 14, { style: 'shop', width: 2.2 });
  fur('gHearthCold', 'hearth', 2.2, 14, { lit: false, width: 1.8, height: 2.2 });
  fur('gHearthWide', 'hearth', 5.6, 14, { width: 3.2, height: 3.2, pot: true });
  fur('gWin1', 'wallWindow', 8, 15.5, { glow: 'daylight' });
  fur('gWin2', 'wallWindow', 10.5, 15.5, { panes: 2, glow: 'warm', curtains: 'linen', flowers: true });
  fur('gWin3', 'wallWindow', 14, 15.5, { panes: 3, curtains: 'none', beam: false });
  fur('gStairsUp', 'staircase', -18, 19, { steps: 6, height: 2.2 });
  fur('gStairsFlip', 'staircase', -13, 19, { flip: true, width: 1.0, rail: false });
  fur('gStairsDown', 'staircase', -8.5, 19, { dir: 'down', width: 1.4 });
  [1, 2, 3, 4].forEach((n, i) => fur(`gSacks${n}`, 'sacks', -4.5 + i * 2.2, 19, { count: n, seed: n }));
}

if (MODE === 'gallery') buildGallery();
else if (MODE === 'interior') buildInterior();
else buildLot();
// ?merge=1 → batch every static prop mesh into one mesh per material (PropFactory.mergeStatic)
const merged = params.get('merge') === '1' ? factory.mergeStatic(results) : null;
if (merged) scene.add(merged.object);
const buildMs = performance.now() - tBuild;

// ---------------------------------------------------------------------------------------------
// point lights straight from the descriptors
// ---------------------------------------------------------------------------------------------
const plights = [];
for (const r of results) {
  for (const d of r.lights) {
    const l = new THREE.PointLight(d.color ?? 0xffb46b, 0, d.distance ?? 8, 2);
    l.position.copy(d.position);
    scene.add(l);
    plights.push({ light: l, d, seed: plights.length * 7.31 });
  }
}
const emissives = [];
for (const r of results) for (const e of r.emissives) if (!emissives.some((x) => x.material === e.material)) emissives.push(e);

// ---------------------------------------------------------------------------------------------
// tiny local particle stub (smoke & embers) to preview emitter descriptors
// ---------------------------------------------------------------------------------------------
function softTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const soft = softTexture();
const stubs = [];
for (const r of results) {
  for (const e of r.emitters) {
    const smoke = e.preset === 'smoke';
    const n = smoke ? 10 : 14;
    const sprites = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.SpriteMaterial({
        map: soft, color: smoke ? '#b8b4b0' : '#ffb060', transparent: true, depthWrite: false,
        blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending, opacity: 0, fog: true,
      });
      const s = new THREE.Sprite(m);
      s.renderOrder = 50;
      scene.add(s);
      sprites.push({ s, phase: i / n, rx: Math.sin(i * 12.9898) * 0.5 + 0.5, rz: Math.cos(i * 78.233) * 0.5 + 0.5 });
    }
    stubs.push({ e, smoke, sprites });
  }
}
function updateStubs(t) {
  for (const st of stubs) {
    const life = st.smoke ? 4.5 : 1.6;
    for (const p of st.sprites) {
      const a = ((t / life + p.phase) % 1 + 1) % 1;
      const s = p.s;
      if (st.smoke) {
        s.position.set(st.e.position.x + (p.rx - 0.5) * 0.3 + a * 0.9, st.e.position.y + a * 2.6, st.e.position.z + (p.rz - 0.5) * 0.3 - a * 0.3);
        const sc = 0.35 + a * 1.3;
        s.scale.set(sc, sc, 1);
        s.material.opacity = Math.sin(a * Math.PI) * 0.4;
      } else {
        s.position.set(st.e.position.x + (p.rx - 0.5) * 0.5 + Math.sin(t * 3 + p.phase * 20) * 0.1 * a, st.e.position.y + a * 1.8, st.e.position.z + (p.rz - 0.5) * 0.5);
        const sc = 0.07 + 0.04 * (1 - a);
        s.scale.set(sc, sc, 1);
        s.material.opacity = (1 - a) * (0.4 + 0.6 * night);
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// lighting presets
// ---------------------------------------------------------------------------------------------
let night = params.get('night') === '1' ? 1 : 0;
/**
 * @typedef {object} LightPreset
 * @property {string} bg
 * @property {string} fog
 * @property {number} fogD
 * @property {string} sunColor
 * @property {number} sunI
 * @property {[number, number, number]} sunDir
 * @property {string} hemiSky
 * @property {string} hemiGround
 * @property {number} hemiI
 * @property {number} exposure
 */
/** @type {LightPreset} */
const DAY = {
  bg: '#e9b88a', fog: '#d7a987', fogD: 0.0075, sunColor: '#ffbf7a', sunI: 3.4, sunDir: [-0.62, 0.42, 0.5],
  hemiSky: '#9fb3d8', hemiGround: '#6a5040', hemiI: 0.95, exposure: 1.02,
};
/** @type {LightPreset} */
const NIGHT = {
  bg: '#0d1530', fog: '#101a36', fogD: 0.011, sunColor: '#8ea6ff', sunI: 0.55, sunDir: [0.45, 0.62, 0.35],
  hemiSky: '#3b4f86', hemiGround: '#14131f', hemiI: 0.42, exposure: 1.1,
};
const skyTex = {};
function skyGradient(key, top, mid, bottom) {
  if (skyTex[key]) return skyTex[key];
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, top);
  grd.addColorStop(0.55, mid);
  grd.addColorStop(1, bottom);
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  skyTex[key] = t;
  return t;
}
function applyLighting() {
  const P = night ? NIGHT : DAY;
  scene.background = night ? skyGradient('n', '#050a1c', '#101c3e', '#1d2548') : skyGradient('d', '#6f8fc2', '#e8b98e', '#f4c48f');
  scene.fog = new THREE.FogExp2(P.fog, P.fogD);
  sun.color.set(P.sunColor);
  sun.intensity = P.sunI;
  sunDir.set(...P.sunDir).normalize();
  hemi.color.set(P.hemiSky);
  hemi.groundColor.set(P.hemiGround);
  hemi.intensity = P.hemiI;
  renderer.toneMappingExposure = P.exposure;
  globalUniforms.uNight.value = night;
  globalUniforms.uSunDirection.value.copy(sunDir);
  for (const e of emissives) e.material.emissiveIntensity = lerp(e.day ?? 0, e.night ?? 1.6, night);
  waterMat.color.set(night ? '#1b3a66' : '#3b86a8');
  waterMat.emissive.set(night ? '#07142a' : '#0e3350');
}
const sunDir = new THREE.Vector3();

// ---------------------------------------------------------------------------------------------
// camera framing (diorama: fov 28, pitch ~32°)
// ---------------------------------------------------------------------------------------------
const VIEWS = {
  overview: { x: -0.5, z: -0.5, y: 0, dist: 47, yaw: 0, pitch: 34 },
  house: { x: -3.2, z: -6.2, y: 2.4, dist: 17, yaw: 0.28, pitch: 26 },
  houseA: { x: -8.8, z: -6.2, y: 2.0, dist: 14, yaw: -0.3, pitch: 28 },
  houseC: { x: -14.5, z: -1.2, y: 2.0, dist: 15, yaw: 0.45, pitch: 30 },
  trees: { x: -15.2, z: 8.2, y: 2.4, dist: 19, yaw: 0.12, pitch: 24 },
  trees2: { x: 12.5, z: -4.5, y: 2.5, dist: 22, yaw: 0.2, pitch: 28 },
  market: { x: 0.8, z: -1.5, y: 1.2, dist: 13, yaw: 0.25, pitch: 30 },
  bridge: { x: 7.5, z: 1.4, y: 0.2, dist: 15, yaw: -0.35, pitch: 32 },
  windmill: { x: 14.5, z: -3.2, y: 3.8, dist: 20, yaw: -0.3, pitch: 24 },
  campfire: { x: -8.4, z: 5.8, y: 0.8, dist: 11, yaw: 0.35, pitch: 30 },
  well: { x: -5.3, z: 1.6, y: 1.0, dist: 11, yaw: -0.25, pitch: 30 },
  flames: { x: -8.2, z: 6.0, y: 0.7, dist: 6.5, yaw: 0.2, pitch: 22 },
  torch: { x: 1.3, z: -6.3, y: 2.1, dist: 5.5, yaw: 1.0, pitch: 16 },
  pines: { x: 18.0, z: -6.0, y: 2.6, dist: 16, yaw: 0.55, pitch: 24 },
  gallery: { x: 0, z: 3, y: 0, dist: 62, yaw: 0, pitch: 34 },
  gHouses: { x: -11, z: -10, y: 2.5, dist: 34, yaw: 0, pitch: 28 },
  gHouses2: { x: 11, z: -10, y: 2.5, dist: 28, yaw: 0.3, pitch: 28 },
  gTrees: { x: 0, z: 2, y: 2.5, dist: 44, yaw: 0, pitch: 22 },
  gProps: { x: -1, z: 11, y: 0.5, dist: 26, yaw: 0, pitch: 34 },
  gProps2: { x: 14, z: 15, y: 1.5, dist: 24, yaw: 0, pitch: 30 },
  gCombat: { x: -3.8, z: 20.6, y: 1.2, dist: 14, yaw: 0, pitch: 30 },
  gChests: { x: -7.8, z: 21, y: 0.3, dist: 6, yaw: 0.35, pitch: 32 },
  small: { x: 3.8, z: -2.0, y: 0.6, dist: 12, yaw: 0.5, pitch: 30 },
  rocks: { x: 1.8, z: 6.9, y: 0.5, dist: 9, yaw: -0.2, pitch: 30 },
  farm: { x: 15.0, z: 7.0, y: 1.0, dist: 15, yaw: -0.2, pitch: 32 },
  // ?mode=interior: the three rooms at the room camera (distance 20, pitch 38) and the gallery rows
  interior: { x: 0, z: -0.5, y: 0.5, dist: 50, yaw: 0, pitch: 38 },
  roomHome: { x: -15, z: -0.3, y: 0.6, dist: 20, yaw: 0, pitch: 38 },
  roomInn: { x: 0, z: -0.3, y: 0.6, dist: 20, yaw: 0, pitch: 38 },
  roomMill: { x: 15, z: -0.3, y: 0.6, dist: 20, yaw: 0, pitch: 38 },
  gBeds: { x: -11, z: 9.8, y: 0.5, dist: 24, yaw: 0, pitch: 38 },
  gRow2: { x: -9, z: 14, y: 0.8, dist: 22, yaw: 0, pitch: 34 },
  gRow2b: { x: 5, z: 13.5, y: 1, dist: 20, yaw: 0, pitch: 34 },
  gRow3: { x: -9, z: 19, y: 0.7, dist: 20, yaw: 0, pitch: 38 },
  gHearth: { x: 4, z: 14.2, y: 1.2, dist: 11, yaw: 0, pitch: 30 },
  gStairs: { x: -11, z: 19, y: 0.8, dist: 12, yaw: 0, pitch: 38 },
  gTables: { x: 11, z: 9.3, y: 0.6, dist: 12, yaw: 0, pitch: 38 },
};
let view = { ...VIEWS[params.get('view') || (MODE === 'interior' ? 'interior' : 'overview')] };
const target = new THREE.Vector3();
function applyCamera() {
  const p = view.pitch * DEG2RAD;
  target.set(view.x, view.y ?? 0, view.z);
  camera.position.set(
    target.x + Math.sin(view.yaw) * Math.cos(p) * view.dist,
    target.y + Math.sin(p) * view.dist,
    target.z + Math.cos(view.yaw) * Math.cos(p) * view.dist,
  );
  camera.lookAt(target);
  globalUniforms.uCameraYaw.value = view.yaw;
  globalUniforms.uCameraPosition.value.copy(camera.position);
  // sun shadow follows the framing
  sun.position.copy(target).addScaledVector(sunDir, 50);
  sun.target.position.copy(target);
}

// ---------------------------------------------------------------------------------------------
// loop
// ---------------------------------------------------------------------------------------------
const timer = new THREE.Timer();
timer.connect(document);
let t = 0;
const hud = document.getElementById('hud');
let frames = 0;
let fpsT = 0;
let fps = 0;
function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 1 / 20);
  t += dt;
  globalUniforms.uTime.value = t;
  for (const r of results) r.update?.(dt);
  for (const pl of plights) {
    const d = pl.d;
    const base = (d.intensity ?? 8) * (d.nightOnly === false ? lerp(0.35, 1, night) : lerp(0.0, 1, night));
    const n = valueNoise2(t * 5 + pl.seed, pl.seed, 3) * 2 - 1;
    pl.light.intensity = base * (1 + n * (d.flicker ?? 0.3) * 0.6);
  }
  updateStubs(t);
  renderer.render(scene, camera);
  frames++;
  fpsT += dt;
  if (fpsT > 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; }
  hud.textContent = `props · ${night ? 'night' : 'golden hour'} · ${fps.toFixed(0)} fps · ${renderer.info.render.calls} calls · ${(renderer.info.render.triangles / 1000).toFixed(1)}k tris · build ${buildMs.toFixed(0)} ms`;
  requestAnimationFrame(frame);
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

applyLighting();
applyCamera();
frame();

// ---------------------------------------------------------------------------------------------
// scripted-check handles
// ---------------------------------------------------------------------------------------------
/**
 * A mesh inside a prop: props give every mesh one material (flames use a ShaderMaterial).
 * @typedef {SolidMesh & { material: SceneMaterial }} PropMesh
 */
/** Meshes (≈ draw calls) of the prop named `name`. @param {string} name */
function drawCallsPer(name) {
  const r = results.find((x) => x.name === name);
  let n = 0;
  r?.object.traverse((/** @type {SceneNode} */ o) => { if (o.isMesh) n++; });
  return n;
}
/**
 * `window.__props` (AUTOMATION_API.md §7), read by sandbox/props*.json.
 * @typedef {object} PropsHandle
 * @property {THREE.WebGLRenderer} renderer
 * @property {THREE.Scene} scene
 * @property {THREE.PerspectiveCamera} camera
 * @property {PropFactory} factory
 * @property {TextureLibrary} textures
 * @property {NamedProp[]} results  every built prop, tagged with its name
 * @property {THREE.DirectionalLight} sun
 * @property {THREE.HemisphereLight} hemi
 * @property {typeof globalUniforms} globalUniforms
 * @property {(v: boolean|number) => number} setNight  switch the lighting preset; returns 0 / 1
 * @property {(v: string|Partial<typeof view>) => typeof view} frame  a named view (`VIEWS`) or
 *   camera fields `{ x, z, y, dist, yaw (rad), pitch (deg) }` merged into the current one
 * @property {() => object} info  prop / light / emitter counts, build time, draw calls,
 *   `meshesPerProp`
 * @property {() => object} disposeTest  build, render and dispose a few props: GPU memory must
 *   return to its baseline (`{ before, during, after, merged, ok }`)
 * @property {() => { ok: boolean, problems: string[], walkRects: number }} check  every result's
 *   object, colliders, lights, emitters and shadow flags
 * @property {() => { ok: boolean, pieces: number, worst: number, problems: string[] }} furnitureCheck
 *   ?mode=interior: every furniture piece's colliders against the catalog's footprint
 *   (`interiorFootprint` through `objectBounds`, within 0.02)
 */
window.__props = {
  renderer, scene, camera, factory, textures, results, sun, hemi, globalUniforms,
  setNight(v) { night = v ? 1 : 0; applyLighting(); applyCamera(); return night; },
  frame(v) {
    view = typeof v === 'string' ? { ...VIEWS[v] } : { ...view, ...v };
    applyCamera();
    return view;
  },
  info() {
    const per = {};
    for (const r of results) per[r.name] = drawCallsPer(r.name);
    return {
      props: results.length, buildMs: Math.round(buildMs), lights: plights.length, emissives: emissives.length,
      mergedMeshes: merged ? merged.meshes.length : 0,
      emitters: results.reduce((a, r) => a + r.emitters.length, 0), calls: renderer.info.render.calls,
      tris: renderer.info.render.triangles, meshesPerProp: per,
    };
  },
  /** Build a few props with a throw-away factory, render, dispose → GPU memory must return to baseline. */
  disposeTest() {
    renderer.render(scene, camera);
    const before = { ...renderer.info.memory };
    const tf = new PropFactory({ textures, seed: 7 });
    const rs = [tf.house(40, 0, 40, { stories: 2 }), tf.tree(44, 0, 40, { kind: 'birch' }), tf.campfire(46, 0, 40), tf.windmill(50, 0, 40), tf.rock(53, 0, 40)];
    for (const r of rs) {
      scene.add(r.object);
      r.object.traverse((o) => { o.frustumCulled = false; });
    }
    // batch the static parts of the campfire, windmill and rock (sails / flame / foliage stay put)
    const mh = tf.mergeStatic(rs.slice(2));
    scene.add(mh.object);
    mh.object.traverse((o) => { o.frustumCulled = false; });
    renderer.render(scene, camera);
    const during = { ...renderer.info.memory };
    rs[0].dispose();
    for (const r of rs.slice(1)) scene.remove(r.object);
    mh.dispose();
    tf.dispose();
    renderer.render(scene, camera);
    const after = { ...renderer.info.memory };
    return { before, during, after, merged: mh.meshes.length, ok: after.geometries === before.geometries && after.textures === before.textures };
  },
  furnitureCheck() {
    // every built piece's colliders against the catalog footprint (objectBounds / interiorFootprint)
    const problems = [];
    let worst = 0;
    for (const [name, f] of furniture) {
      const r = results.find((x) => x.name === name);
      const obj = /** @type {LevelObject} */ (/** @type {unknown} */ ({ id: name, type: f.type, x: f.x, z: f.z, rotation: f.opts.rotation ?? 0, opts: f.opts }));
      const fp = interiorFootprint(obj);
      if (!fp) { problems.push(`${name}: no footprint`); continue; }
      if (!fp.solid) { if (r.colliders.length) problems.push(`${name}: colliders on a non-solid piece`); continue; }
      let b = boxUnion(r.colliders);
      for (const c of r.colliders) {
        if (c.type !== 'circle') continue;
        const cb = { minX: c.x - c.r, maxX: c.x + c.r, minZ: c.z - c.r, maxZ: c.z + c.r };
        b = b ? { minX: Math.min(b.minX, cb.minX), maxX: Math.max(b.maxX, cb.maxX), minZ: Math.min(b.minZ, cb.minZ), maxZ: Math.max(b.maxZ, cb.maxZ) } : cb;
      }
      if (!b) { problems.push(`${name}: no collider`); continue; }
      const ob = objectBounds(obj);
      const d = Math.max(Math.abs(b.minX - ob.minX), Math.abs(b.maxX - ob.maxX), Math.abs(b.minZ - ob.minZ), Math.abs(b.maxZ - ob.maxZ));
      worst = Math.max(worst, d);
      if (d > 0.02) problems.push(`${name}: colliders ${JSON.stringify(b)} vs footprint ${JSON.stringify(ob)}`);
    }
    return { ok: problems.length === 0, pieces: furniture.size, worst: Math.round(worst * 1e4) / 1e4, problems };
  },
  check() {
    const problems = [];
    for (const r of results) {
      if (!r.object?.isObject3D) problems.push(`${r.name}: no object`);
      for (const c of r.colliders) {
        if (c.type === 'circle' && !(c.r > 0)) problems.push(`${r.name}: bad circle`);
        if (c.type === 'box' && !(c.maxX > c.minX && c.maxZ > c.minZ)) problems.push(`${r.name}: bad box`);
      }
      for (const l of r.lights) if (!l.position?.isVector3) problems.push(`${r.name}: light w/o position`);
      for (const e of r.emitters) if (!e.position?.isVector3 || !e.preset) problems.push(`${r.name}: bad emitter`);
      r.object.traverse((/** @type {PropMesh} */ o) => {
        if (o.isMesh && !o.material.isShaderMaterial && o.material.userData.castShadow !== false && !(o.castShadow && o.receiveShadow)) problems.push(`${r.name}: ${o.name} shadow flags`);
      });
    }
    for (const o of merged?.meshes ?? []) {
      if (/** @type {THREE.Material} */ (o.material).userData.castShadow !== false && !(o.castShadow && o.receiveShadow)) problems.push(`merged: ${o.name} shadow flags`);
    }
    const bridge = results.find((r) => r.name === 'bridge');
    return { ok: problems.length === 0, problems, walkRects: bridge?.walkRects?.length ?? 0 };
  },
};
console.log('[props] built', results.length, 'props in', buildMs.toFixed(1), 'ms');
