/**
 * Integration smoke test for the lighting module: LightingSystem registered as an Engine system
 * (update + lateUpdate), CameraRig following a moving target, PostFX (MSAA HDR target, DOF, bloom,
 * grade) and GodRays — i.e. the real pipeline instead of the stand-ins used by lighting.js.
 * window.__lightEngine exposes handles for scripted checks.
 */
import * as THREE from 'three';
import { Engine } from '../src/engine/core/Engine.js';
import { CameraRig } from '../src/engine/core/CameraRig.js';
import { PostFX } from '../src/engine/render/PostFX.js';
import { LightingSystem } from '../src/engine/lighting/LightingSystem.js';
import { GodRays } from '../src/engine/fx/GodRays.js';
import { PixelCanvas } from '../src/engine/pixel/PixelCanvas.js';
import { PALETTE } from '../src/engine/pixel/Palette.js';
import { RNG } from '../src/engine/utils/math.js';

const engine = new Engine({ exposeGlobal: false });
const { scene, camera, renderer } = engine;

const lighting = new LightingSystem(engine, { timeOfDay: 17.2 });
const godRays = new GodRays();
scene.add(godRays.object);
godRays.populate({ minX: -10, maxX: 10, minZ: -9, maxZ: 5, y: 0 }, 5, 7);

// --- tiny diorama -------------------------------------------------------------
const grassPc = new PixelCanvas(16, 16);
grassPc.wrap = true;
grassPc.fillNoise(PALETTE.grass.slice(1, 5), { scale: 3, period: 3, seed: 4, octaves: 2, dither: 0.8 });
const grassTex = grassPc.toTexture({ wrap: 'repeat', mipmaps: true });
grassTex.repeat.set(30, 30);
const ground = new THREE.Mesh(new THREE.BoxGeometry(30, 2, 30), new THREE.MeshLambertMaterial({ map: grassTex }));
ground.position.y = -1;
ground.receiveShadow = true;
scene.add(ground);

const wallMat = new THREE.MeshLambertMaterial({ color: '#d8c8b0' });
const roofMat = new THREE.MeshLambertMaterial({ color: '#b04a38' });
const rng = new RNG(3);
for (let i = 0; i < 6; i++) {
  const x = -10 + i * 4 + rng.range(-0.5, 0.5);
  const z = -7 + rng.range(-1, 1);
  const h = rng.range(2.2, 3.4);
  const house = new THREE.Mesh(new THREE.BoxGeometry(3, h, 3), wallMat);
  house.position.set(x, h / 2, z);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.6, 4), roofMat);
  roof.position.set(x, h + 0.8, z);
  roof.rotation.y = Math.PI / 4;
  for (const m of [house, roof]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
}
const lanternMat = new THREE.MeshLambertMaterial({ color: '#f6d9a0', emissive: '#ffaa4c', emissiveIntensity: 0 });
for (const [x, z] of [[-4, 0], [4, 0], [0, 4]]) {
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.4, 0.14), new THREE.MeshLambertMaterial({ color: '#2a2a34' }));
  post.position.set(x, 1.2, z);
  post.castShadow = true;
  scene.add(post);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.26), lanternMat);
  lamp.position.set(x, 2.5, z);
  scene.add(lamp);
  const handle = lighting.addPointLight({ position: new THREE.Vector3(x, 2.4, z), intensity: 14, distance: 10 });
  lighting.registerEmissive(lanternMat, { day: 0.15, night: 3.2, flicker: handle });
}

// A moving "player" the camera rig and the shadow frustum follow.
const player = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.3), new THREE.MeshLambertMaterial({ color: '#c04040' }));
player.geometry.translate(0, 0.9, 0);
player.castShadow = true;
scene.add(player);
lighting.followTarget(player);

const rig = new CameraRig(camera, {});
rig.setTarget(player);
rig.snap?.();

const postfx = new PostFX(renderer, scene, camera, {});
engine.events.on('resize', ({ width, height, pixelRatio }) => postfx.setSize(width, height, pixelRatio));
postfx.setSize(engine.width, engine.height, engine.pixelRatio);

let walk = true;
engine.addSystem({
  name: 'player+rig',
  update(dt, t) {
    if (walk) player.position.set(Math.sin(t * 0.4) * 5, 0, Math.cos(t * 0.3) * 3);
    rig.update(dt, engine.input);
  },
});
// Registered BEFORE the rig system on purpose: lateUpdate must still centre the shadow box on the
// final camera/player positions of this frame.
engine.addSystem(lighting, -10);
engine.addSystem(godRays, 5);
engine.setRenderFn((dt) => {
  if (postfx.settings.dof.autoFocus && rig.focusDistance) postfx.setFocus(rig.focusDistance);
  postfx.render(dt);
});
engine.start();

/**
 * How far (world units) the shadow frustum centre moves when re-placed now, between frames.
 * 0 means the frame's lateUpdate already centred it on the final player/camera positions.
 * @returns {number}
 */
function shadowLag() {
  const before = lighting.sun.target.position.clone();
  lighting.lateUpdate();
  return before.distanceTo(lighting.sun.target.position);
}

/**
 * `window.__lightEngine` (AUTOMATION_API.md §7).
 * @typedef {object} LightEngineHandle
 * @property {Engine} engine
 * @property {LightingSystem} lighting
 * @property {GodRays} godRays
 * @property {PostFX} postfx
 * @property {CameraRig} rig
 * @property {THREE.Mesh} player  the walking box the rig and the shadow frustum follow
 * @property {(h: number) => number} setTime  set the clock (hours); returns the time of day
 * @property {(v: boolean) => boolean} setWalk  start / stop the player's walk
 * @property {typeof shadowLag} shadowLag
 * @property {() => number} programs  compiled shader programs
 */
window.__lightEngine = {
  engine, lighting, godRays, postfx, rig, player,
  setTime(h) { lighting.setTime(h); return lighting.timeOfDay; },
  setWalk(v) { walk = v; return v; },
  shadowLag,
  programs: () => renderer.info.programs.length,
};
console.log('lighting engine sandbox ready');
