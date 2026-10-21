/**
 * Enemy AI sandbox (COMBAT.md §7–§9, §21) — every enemy brain against a scripted fake player with a
 * mock CombatContext that implements exactly the §9.2 list, on a small stepped test map:
 *
 * - a grass floor (level 2), a 1 u ledge (level 4, x 30–46, z 2–10) with a two-tile stair at
 *   x 36–38 (the ledge-archer and stair-chase cases), a rock wall (x 40–42, z 20–31; boar stun);
 * - a boss arena (x 8–28, z 18–35, rim 2 u up, gate x 16–20 on the south side) with two brazier
 *   colliders at (12.5, 22.5) and (23.5, 22.5).
 *
 * The mock context carries the real walk grid (`ctx.nav`, Nav.js: chase and return paths; the
 * arena grown by 0.5 u is closed like in the game), rebuilt by tests that add a collider.
 *
 * The mock core does what CombatSystem does for enemies (§9.1 sub-step order): enemy updates,
 * projectiles (the §7.6 height model: straight shots with `vy`, arcs), hit resolution against the
 * fake player (§9.5 shapes, the melee height rule, one hit per tag, i-frames), token budgets
 * (melee 3 / ranged 2), separation (inverse mass), dormancy, the arena exclusion, the boss HP floor
 * (`e.hpFloor`), adds, and scripted player swings against enemies (receiveHit / die). Real
 * GroundMarkers / FxQuads / Particles are used when their packages have landed (a placeholder
 * `alloc()` returns −1); a debug overlay always draws markers (orange, white at progress 1),
 * the last sub-step's hitboxes (red) and projectiles (yellow) draped on the terrain.
 *
 * window.__sb (scripts): load(name, seed?), step(n), until(pred | {kind|uid, state, minF}, max),
 * pause(on), view(name), offscreen(on), player(opts), hit(uid, dmg, poise, kb), enemy(uid|kind),
 * state(), dump(), events(filter?), check(name, cond, detail?), results(), tests.<name>() and
 * runAll(); every test is a deterministic stepped run that ends at a moment worth a screenshot.
 */
import * as THREE from 'three';
import { TextureLibrary } from '../src/engine/pixel/Textures.js';
import { TileMap } from '../src/engine/world/TileMap.js';
import { globalUniforms } from '../src/engine/render/GlobalUniforms.js';
import { RNG, hashString, DEG2RAD } from '../src/engine/utils/math.js';
import { Sprite3D } from '../src/engine/sprite/Sprite3D.js';
import { createEnemySheet } from '../src/engine/pixel/MonsterSprites.js';
import { createCharacterSheet, CHARACTER_PRESETS } from '../src/engine/pixel/CharacterSprites.js';
import { createFxAtlas } from '../src/engine/pixel/FxSprites.js';
import { GroundMarkers } from '../src/engine/fx/GroundMarkers.js';
import { FxQuads } from '../src/engine/fx/FxQuads.js';
import { Particles } from '../src/engine/fx/Particles.js';
import { CHARACTER_SPRITE_OPTS } from '../src/game/config.js';
import { createEnemy } from '../src/game/combat/Enemy.js';
import { scaledDef } from '../src/game/combat/defs.js';
import { Nav } from '../src/game/combat/Nav.js';

/**
 * @import { CombatContext, EnemyArena, PlayerView } from '../src/game/combat/types.js'
 * @import { Enemy } from '../src/game/combat/Enemy.js'
 * @import { TileMapInput } from '../src/engine/world/TileMap.js'
 */

/**
 * An enemy of the mock core: `_pooled` marks a boss add parked in the pool (hidden, skipped by
 * the mock core's updates; the real core pools its adds its own way).
 * @typedef {Enemy & { _pooled?: boolean }} MockEnemy
 */

const FRAME = 1 / 60;
const EPS = 1e-6;

// -------------------------------------------------------------------------------------------------
// Test map
// -------------------------------------------------------------------------------------------------

const W = 50;
const D = 40;
const ARENA_RECT = { minX: 8, maxX: 28, minZ: 18, maxZ: 35 };
const GATE = [16, 35, 20, 35];
const BRAZIERS = [[12.5, 22.5], [23.5, 22.5]];

/** @returns {TileMapInput} */
function buildMap() {
  const tiles = [];
  const heights = [];
  for (let j = 0; j < D; j++) {
    let t = '';
    let hs = '';
    for (let i = 0; i < W; i++) {
      let c = 'g';
      let h = '2';
      if (i >= 30 && i < 46 && j >= 2 && j < 10) { c = 'm'; h = '4'; }
      if (i >= 36 && i < 38 && j === 10) { c = '^'; h = '3'; }
      if (i >= 36 && i < 38 && j === 11) { c = '^'; h = '2'; }
      if (i >= 6 && i < 30 && j >= 16 && j < 37) { c = 'r'; h = '6'; }
      if (i >= 8 && i < 28 && j >= 18 && j < 35) { c = 'k'; h = '2'; }
      if (i >= 16 && i < 20 && j >= 35 && j < 37) { c = 'k'; h = '2'; }
      if (i >= 40 && i < 42 && j >= 20 && j < 31) { c = 'r'; h = '6'; }
      if ((j === 13 || j === 14) && i < 30 && i > 1) c = c === 'g' ? '.' : c;
      t += c;
      hs += h;
    }
    tiles.push(t);
    heights.push(hs);
  }
  return {
    name: 'Enemy AI Sandbox',
    legend: {
      g: { top: 'grass', side: 'cliff', lip: 'grass_side', walkable: true },
      '.': { top: 'dirt_path', side: 'dirt_side', walkable: true },
      m: { top: 'moss_stone', side: 'cliff', walkable: true },
      k: { top: 'stone_tiles', side: 'stone_wall', walkable: true },
      r: { top: 'moss_stone', side: 'cliff', walkable: false },
      '^': { top: 'cobblestone', side: 'stone_wall', riser: 'stone_wall', stairs: 'N', walkable: true },
    },
    tiles,
    heights,
    waterLevel: 0,
  };
}

// -------------------------------------------------------------------------------------------------
// Renderer, scene, light
// -------------------------------------------------------------------------------------------------

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#9fb6cf');
scene.fog = new THREE.FogExp2('#c9d8e6', 0.006);
const camera = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, 0.5, 400);

const hemi = new THREE.HemisphereLight('#a6c4ec', '#6e5c46', 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffe6c4', 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 120 });
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);
{
  const dir = new THREE.Vector3(-0.5, 0.75, -0.42).normalize();
  const c = new THREE.Vector3(W / 2, 0, D / 2);
  sun.position.copy(c).addScaledVector(dir, 60);
  sun.target.position.copy(c);
  sun.target.updateMatrixWorld();
  globalUniforms.uSunDirection.value.copy(dir);
  globalUniforms.uSunColor.value.copy(sun.color).multiplyScalar(3.2 / 3.5);
  globalUniforms.uFogColor.value.copy(scene.fog.color);
  globalUniforms.uNight.value = 0;
}

const lib = new TextureLibrary({ seed: 1337, anisotropy: 4 });
const tileMap = new TileMap(buildMap(), { textures: lib });
scene.add(tileMap.object);

// braziers (static colliders: the boss's charge-stun targets)
{
  const stone = new THREE.MeshLambertMaterial({ color: '#6d6a72' });
  const coal = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.3, 0.4) });
  for (const [x, z] of BRAZIERS) {
    const y = tileMap.getHeight(x, z);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.4, 0.9, 10), stone);
    bowl.position.set(x, y + 0.45, z);
    bowl.castShadow = bowl.receiveShadow = true;
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 8), coal);
    fire.position.set(x, y + 1.2, z);
    scene.add(bowl, fire);
    tileMap.addCollider({ type: 'circle', x, z, r: 0.5 });
  }
}

// the enemies' walk grid (as CombatSystem builds it: the arena grown by 0.5 u is closed)
const navBlocked = (x, z) => x > ARENA_RECT.minX - 0.5 && x < ARENA_RECT.maxX + 0.5 && z > ARENA_RECT.minZ - 0.5 && z < ARENA_RECT.maxZ + 0.5;
const nav = new Nav(tileMap, { blocked: navBlocked });

// engine combat batches (placeholders until fx-audio-input lands: alloc() → −1)
const markers = new GroundMarkers({
  heightField: { sample: (x, z) => tileMap.getHeight(x, z), minX: 0, minZ: 0, maxX: W, maxZ: D, res: 4 },
});
scene.add(markers.object);
const atlas = createFxAtlas();
const fxq = new FxQuads({ atlas });
scene.add(fxq.object);
const particles = new Particles(scene);

// -------------------------------------------------------------------------------------------------
// Camera views
// -------------------------------------------------------------------------------------------------

const cam = { focus: new THREE.Vector3(18, 1, 20), yaw: 0, pitch: 34, dist: 30 };
/**
 * @typedef {object} CamView
 * @property {[number, number, number]} [focus]
 * @property {number} [dist]
 * @property {number} [yaw]
 * @property {number} [pitch]
 */
/** @type {Record<string, CamView>} */
const VIEWS = {
  overview: { focus: [25, 1, 20], dist: 62 },
  roster: { focus: [15, 1, 12.5], dist: 26 },
  field: { focus: [12, 1, 13.5], dist: 22 },
  ledge: { focus: [39, 1.5, 9.5], dist: 20 },
  wall: { focus: [36, 1, 25], dist: 20 },
  arena: { focus: [18, 1, 27], dist: 34 },
};

/**
 * @param {string|CamView} v  a `VIEWS` name (unknown: overview) or a view; yaw / pitch in degrees
 */
function setView(v) {
  const o = typeof v === 'string' ? VIEWS[v] ?? VIEWS.overview : v;
  if (o.focus) cam.focus.set(...o.focus);
  if (o.dist !== undefined) cam.dist = o.dist;
  if (o.yaw !== undefined) cam.yaw = o.yaw;
  if (o.pitch !== undefined) cam.pitch = o.pitch;
  const y = cam.yaw * DEG2RAD;
  const p = cam.pitch * DEG2RAD;
  camera.position.set(
    cam.focus.x + Math.sin(y) * Math.cos(p) * cam.dist,
    cam.focus.y + Math.sin(p) * cam.dist,
    cam.focus.z + Math.cos(y) * Math.cos(p) * cam.dist,
  );
  camera.lookAt(cam.focus);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  globalUniforms.uCameraYaw.value = y;
  globalUniforms.uCameraPosition.value.copy(camera.position);
}
const vp = new THREE.Matrix4();
const _v4 = new THREE.Vector4();

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  setView({});
}
addEventListener('resize', resize);

// -------------------------------------------------------------------------------------------------
// Debug overlay (draped lines: markers, hitboxes, projectiles, arena)
// -------------------------------------------------------------------------------------------------

class DebugLines {
  constructor(max = 80000) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry = g;
    this.object = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, toneMapped: false }));
    this.object.renderOrder = 999;
    this.object.frustumCulled = false;
    this.n = 0;
  }

  begin() { this.n = 0; }

  seg(x0, y0, z0, x1, y1, z1, c) {
    if (this.n + 2 > this.max) return;
    const p = this.pos;
    const k = this.n * 3;
    p[k] = x0; p[k + 1] = y0; p[k + 2] = z0;
    p[k + 3] = x1; p[k + 4] = y1; p[k + 5] = z1;
    for (let i = 0; i < 2; i++) {
      this.col[k + i * 3] = c[0];
      this.col[k + i * 3 + 1] = c[1];
      this.col[k + i * 3 + 2] = c[2];
    }
    this.n += 2;
  }

  /** Segment draped on the terrain (sampled every ≤ 0.5 u). */
  drape(x0, z0, x1, z1, c, lift = 0.06) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.5));
    let px = x0;
    let pz = z0;
    let py = tileMap.getHeight(px, pz) + lift;
    for (let i = 1; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const z = z0 + ((z1 - z0) * i) / n;
      const y = tileMap.getHeight(x, z) + lift;
      this.seg(px, py, pz, x, y, z, c);
      px = x;
      py = y;
      pz = z;
    }
  }

  arc(x, z, r, a0, a1, c, lift) {
    if (r <= 0.01) return;
    const n = Math.max(6, Math.ceil(((a1 - a0) * r) / 0.35));
    for (let i = 0; i < n; i++) {
      const u0 = a0 + ((a1 - a0) * i) / n;
      const u1 = a0 + ((a1 - a0) * (i + 1)) / n;
      this.drape(x + Math.cos(u0) * r, z + Math.sin(u0) * r, x + Math.cos(u1) * r, z + Math.sin(u1) * r, c, lift);
    }
  }

  circle(x, z, r, c, lift) { this.arc(x, z, r, 0, Math.PI * 2, c, lift); }

  end() {
    this.geometry.setDrawRange(0, this.n);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}
const dbg = new DebugLines();
scene.add(dbg.object);
const COL = {
  enemy: [1.0, 0.45, 0.12], enemyFull: [1.0, 1.0, 1.0], magma: [1.0, 0.15, 0.05], hit: [1.0, 0.1, 0.15],
  proj: [1.0, 0.9, 0.2], arena: [0.9, 0.75, 0.3], player: [0.3, 0.9, 1.0], home: [0.35, 0.8, 0.35],
};

function drawShape(s, c, lift, progress = 1) {
  const sh = s.shape;
  if (sh === 'circle') {
    dbg.circle(s.x, s.z, s.r, c, lift);
    if (progress < 1) dbg.circle(s.x, s.z, s.r * progress, c, lift);
  } else if (sh === 'ring') {
    dbg.circle(s.x, s.z, s.r, c, lift);
    if (s.rInner > 0.02) dbg.circle(s.x, s.z, s.rInner, c, lift);
  } else if (sh === 'sector') {
    const a = Math.atan2(s.dirZ, s.dirX);
    const ha = (s.halfAngle ?? 60) * DEG2RAD;
    dbg.arc(s.x, s.z, s.r, a - ha, a + ha, c, lift);
    if (progress < 1) dbg.arc(s.x, s.z, s.r * progress, a - ha, a + ha, c, lift);
    dbg.drape(s.x, s.z, s.x + Math.cos(a - ha) * s.r, s.z + Math.sin(a - ha) * s.r, c, lift);
    dbg.drape(s.x, s.z, s.x + Math.cos(a + ha) * s.r, s.z + Math.sin(a + ha) * s.r, c, lift);
  } else if (sh === 'lane') {
    const px = -s.dirZ * s.width * 0.5;
    const pz = s.dirX * s.width * 0.5;
    const ex = s.x + s.dirX * s.len;
    const ez = s.z + s.dirZ * s.len;
    dbg.drape(s.x + px, s.z + pz, ex + px, ez + pz, c, lift);
    dbg.drape(s.x - px, s.z - pz, ex - px, ez - pz, c, lift);
    dbg.drape(ex + px, ez + pz, ex - px, ez - pz, c, lift);
    dbg.drape(s.x + px, s.z + pz, s.x - px, s.z - pz, c, lift);
    if (progress < 1) {
      const fx = s.x + s.dirX * s.len * progress;
      const fz = s.z + s.dirZ * s.len * progress;
      dbg.drape(fx + px, fz + pz, fx - px, fz - pz, c, lift);
    }
  } else if (sh === 'rect') {
    const hw = (s.w ?? 1) / 2;
    const hd = (s.d ?? 1) / 2;
    dbg.drape(s.x - hw, s.z - hd, s.x + hw, s.z - hd, c, lift);
    dbg.drape(s.x + hw, s.z - hd, s.x + hw, s.z + hd, c, lift);
    dbg.drape(s.x + hw, s.z + hd, s.x - hw, s.z + hd, c, lift);
    dbg.drape(s.x - hw, s.z + hd, s.x - hw, s.z - hd, c, lift);
  }
}

// -------------------------------------------------------------------------------------------------
// Fake player (PlayerView + a small script)
// -------------------------------------------------------------------------------------------------

const playerSheet = createCharacterSheet({ ...CHARACTER_PRESETS.traveler, preset: 'traveler', weapon: 'sword' });
const playerSprite = new Sprite3D(playerSheet, { ...CHARACTER_SPRITE_OPTS });
scene.add(playerSprite);

/**
 * PlayerView of §9.2 (position is the sprite's, y = ground).
 * @type {PlayerView}
 */
const P = {
  position: playerSprite.position,
  radius: 0.3,
  body: [0, 1.8],
  facing: { x: 0, z: -1 },
  velocity: { x: 0, z: 0 },
  alive: true,
  invulnerable: false,
  dodging: false,
  action: null,
};
/** Script state: mode 'stand' | 'path' | 'fight', waypoints, speed, swing cadence. */
const ps = {
  mode: 'stand', path: [], pathI: 0, loop: true, speed: 3.2, attack: false, swingT: 0, actionT: 0,
  hp: 100, hpMax: 100, iframes: 0, god: true, kbX: 0, kbZ: 0, kbT: 0, kbD: 0, hits: 0, hitLog: [],
};

function placePlayer(x, z) {
  P.position.set(x, tileMap.getHeight(x, z), z);
  P.velocity.x = P.velocity.z = 0;
}

function stepPlayer(h) {
  const p = P.position;
  const x0 = p.x;
  const z0 = p.z;
  if (ps.iframes > 0) ps.iframes -= h;
  P.invulnerable = ps.iframes > 0;
  if (ps.actionT > 0) {
    ps.actionT -= h;
    if (ps.actionT <= 0) P.action = null;
  }
  // knockback slide (10 f ease-out)
  if (ps.kbT < 10 / 60 && ps.kbD > 0) {
    const T = 10 / 60;
    const t1 = Math.min(T, ps.kbT + h);
    const s = ps.kbD * ((1 - (1 - t1 / T) ** 2) - (1 - (1 - ps.kbT / T) ** 2));
    const out = tileMap.move(p, ps.kbX * s, ps.kbZ * s, 0.3, 0.55);
    p.x = out.x;
    p.z = out.z;
    ps.kbT = t1;
  } else if (ps.mode === 'path' && ps.path.length) {
    const [tx, tz] = ps.path[ps.pathI];
    const dx = tx - p.x;
    const dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.1) {
      ps.pathI++;
      if (ps.pathI >= ps.path.length) {
        if (ps.loop) ps.pathI = 0;
        else {
          ps.mode = 'stand';
          ps.pathI = ps.path.length - 1;
        }
      }
    } else {
      const s = Math.min(d, ps.speed * h);
      const out = tileMap.move(p, (dx / d) * s, (dz / d) * s, 0.3, 0.55);
      p.x = out.x;
      p.z = out.z;
      P.facing.x = dx / d;
      P.facing.z = dz / d;
    }
  }
  const gy = tileMap.getHeight(p.x, p.z);
  p.y = gy;
  P.velocity.x = (p.x - x0) / h;
  P.velocity.z = (p.z - z0) / h;
  // scripted swings at the nearest enemy in reach (tests receiveHit / stagger / boss poise)
  if (ps.attack) {
    ps.swingT -= h;
    if (ps.swingT <= 0) {
      ps.swingT = 40 / 60;
      const t = nearestTarget(2.4);
      if (t) {
        const dx = t.position.x - p.x;
        const dz = t.position.z - p.z;
        const d = Math.hypot(dx, dz) || 1;
        P.facing.x = dx / d;
        P.facing.z = dz / d;
        P.action = 'a1';
        ps.actionT = 22 / 60;
        playerSwing(t, 1.0, 10, 0.5);
      }
    }
  }
  if (Math.hypot(P.velocity.x, P.velocity.z) > 0.2) playerSprite.faceVector(P.velocity.x, P.velocity.z);
  playerSprite.play(Math.hypot(P.velocity.x, P.velocity.z) > 0.2 ? 'walk' : 'idle');
}

function nearestTarget(r) {
  let best = null;
  let bd = r;
  for (const e of core.enemies) {
    if (!e.targetable || e._pooled) continue;
    const d = Math.hypot(e.position.x - P.position.x, e.position.z - P.position.z);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/** A scripted player hit on an enemy (damage like §6.3, no crit): receiveHit or die. */
function playerSwing(e, mv, poise, kb, dmgOverride = null) {
  const def = e.def;
  const roll = 0.92 + 0.16 * core.rng.next();
  let dmg = dmgOverride ?? Math.max(1, Math.round(12 * mv * roll * (40 / (40 + 2 * def.def)) * e.vuln));
  const guarded = e.guarded || e.state === 'return';
  if (guarded) dmg = 0;
  if (e.boss) dmg = Math.min(dmg, Math.max(0, e.hp - e.hpFloor));
  const dx = e.position.x - P.position.x;
  const dz = e.position.z - P.position.z;
  const d = Math.hypot(dx, dz) || 1;
  e.hp -= dmg;
  e.hitFlash = 4 / 60;
  core.log(`hit ${e.uid} ${guarded ? 'Guard' : dmg} (hp ${Math.round(e.hp)}) st=${e.state}`);
  core.counts.playerHits++;
  if (e.hp <= 0) {
    e.hp = 0;
    e.die(core.ctx);
    core.log(`kill ${e.uid}`);
    return;
  }
  e.receiveHit({ damage: dmg, crit: false, mv, kb, kbDirX: dx / d, kbDirZ: dz / d, poise, knockdown: false, source: 'melee', tag: core.ctx.frame, guarded }, core.ctx);
}

// -------------------------------------------------------------------------------------------------
// Mock combat core + CombatContext (§9.2)
// -------------------------------------------------------------------------------------------------

const sheets = {};
const _tmp = { x: 0, z: 0 };
const _cols = [];

class MockCore {
  constructor() {
    this.enemies = [];
    this.adds = [];
    this.hitboxes = [];
    this.projectiles = [];
    this.projN = 0;
    this.markers = new Map();
    this.markerN = 0;
    this.events = [];
    this.logLines = [];
    this.tokens = { melee: 3, ranged: 2 };
    this.offscreen = false;
    this.seed = 1;
    this.rng = new RNG(1);
    this.arena = null;
    this.counts = this._zeroCounts();
    this.dormT = 0;
    this.ctx = this._makeContext();
  }

  _zeroCounts() {
    return { windups: 0, hitsOnPlayer: 0, playerHits: 0, projectiles: 0, heals: 0, bursts: 0, sfx: 0, alerts: 0, shakes: 0, fx: 0 };
  }

  log(s) {
    const line = `${String(this.ctx?.frame ?? 0).padStart(5)} ${s}`;
    this.logLines.push(line);
    if (this.logLines.length > 400) this.logLines.shift();
  }

  _makeContext() {
    const core = this;
    /** @type {CombatContext} */
    const ctx = {
      time: 0,
      frame: 0,
      player: P,
      tileMap,
      moveGround(e, dx, dz) { return core.moveGround(e, dx, dz); },
      moveFly(e, dx, dz) { core.moveFly(e, dx, dz); },
      groundAt(x, z) { return tileMap.getHeight(x, z); },
      walkable(x, z) { return tileMap.isWalkable(x, z) && tileMap.getWaterSurface(x, z) === null; },
      los(ax, az, bx, bz) { return core.los(ax, az, bx, bz); },
      onScreen(x, y, z) {
        if (core.offscreen) return false;
        _v4.set(x, y, z, 1).applyMatrix4(vp);
        if (_v4.w <= 0) return false;
        return Math.abs(_v4.x / _v4.w) <= 0.92 && Math.abs(_v4.y / _v4.w) <= 0.92;
      },
      requestToken(e) {
        const t = e.def.token;
        if (!t) return true;
        if (core.tokens[t.type] < t.cost) return false;
        core.tokens[t.type] -= t.cost;
        e.token = true;
        return true;
      },
      releaseToken(e) {
        const t = e.def.token;
        if (!t || !e.token) return;
        core.tokens[t.type] += t.cost;
        e.token = false;
      },
      hitbox(e, spec) { core.hitboxes.push({ e, s: { ...spec } }); },
      projectile(e, spec) { return core.spawnProjectile(e, spec); },
      marker(spec) { return core.markerAlloc(spec); },
      setMarker(h, spec) { core.markerSet(h, spec); },
      freeMarker(h) { core.markerFree(h); },
      fx(name, x, y, z, opts) { core.counts.fx++; core.event('fx', name); },
      burst(preset, x, y, z, count) {
        core.counts.bursts++;
        core.event('burst', preset);
        _burstPos.set(x, y, z);
        particles.burst(preset, _burstPos, count);
      },
      sfx(name) { core.counts.sfx++; core.event('sfx', name); },
      shake(amp, dur) { core.counts.shakes++; core.event('shake', `${amp}/${dur}`); },
      heal(target, amount) {
        core.counts.heals++;
        target.hp = Math.min(target.hpMax, target.hp + amount);
        core.log(`heal ${target.uid} +${amount}`);
      },
      alert(e) { core.counts.alerts++; core.event('alert', e.uid); },
      wakeGroup(e) { core.wakeGroup(e); },
      nav,
      enemiesNear(x, z, r, out) {
        out.length = 0;
        for (const o of core.enemies) {
          if (!o.alive || o.dormant || o._pooled) continue;
          if (Math.hypot(o.position.x - x, o.position.z - z) <= r) out.push(o);
        }
        return out;
      },
      spawnAdd(kind, x, z, level) { return core.spawnAdd(kind, x, z, level); },
      emit(event, e, ...args) { core.onEmit(event, e, args); },
    };
    return ctx;
  }

  event(type, name) {
    this.events.push({ f: this.ctx.frame, type, name });
    if (this.events.length > 4000) this.events.shift();
  }

  // ----- world queries -----

  moveGround(e, dx, dz) {
    const p = e.position;
    const x0 = p.x;
    const z0 = p.z;
    const r = e.def.moveRadius;
    const out = tileMap.move(p, dx, dz, r, 0.55, _tmp);
    let nx = out.x;
    let nz = out.z;
    let blocked = null;
    if (!e.boss && !e.isAdd && this.arena && this.inArena(nx, nz, 0.5) && !this.inArena(x0, z0, 0.5)) {
      nx = x0;
      nz = z0;
      blocked = 'arena';
    }
    p.x = nx;
    p.z = nz;
    const want = Math.hypot(dx, dz);
    const fr = want > 1e-9 ? Math.min(1, Math.hypot(nx - x0, nz - z0) / want) : 1;
    if (fr < 0.999 && !blocked) {
      tileMap.queryColliders(x0 + dx - r - 0.1, z0 + dz - r - 0.1, x0 + dx + r + 0.1, z0 + dz + r + 0.1, _cols);
      let hitCol = false;
      for (const c of _cols) {
        if (c.type === 'circle' && Math.hypot(x0 + dx - c.x, z0 + dz - c.z) < c.r + r + 0.1) hitCol = true;
      }
      blocked = hitCol ? 'collider' : 'terrain';
    }
    e.blockedBy = fr < 0.999 ? blocked : null;
    return fr;
  }

  moveFly(e, dx, dz) {
    const p = e.position;
    const m = e.homeRadius + 8;
    let x = Math.min(e.home.x + m, Math.max(e.home.x - m, p.x + dx));
    let z = Math.min(e.home.z + m, Math.max(e.home.z - m, p.z + dz));
    x = Math.min(W - 0.3, Math.max(0.3, x));
    z = Math.min(D - 0.3, Math.max(0.3, z));
    e.blockedBy = null;
    if (!e.isAdd && this.arena && this.inArena(x, z, 0.5) && !this.inArena(p.x, p.z, 0.5)) {
      e.blockedBy = 'arena';
      return;
    }
    if (x !== p.x + dx || z !== p.z + dz) e.blockedBy = 'terrain';
    p.x = x;
    p.z = z;
  }

  inArena(x, z, grow = 0) {
    const a = this.arena;
    if (!a) return false;
    const r = a.rect;
    return x > r.minX - grow && x < r.maxX + grow && z > r.minZ - grow && z < r.maxZ + grow;
  }

  /** §7.6 height model: ground + 0.9 → ground + 0.9, blocked where terrain > y − 0.1 or inside a collider. */
  los(ax, az, bx, bz) {
    const ya = tileMap.getHeight(ax, az) + 0.9;
    const yb = tileMap.getHeight(bx, bz) + 0.9;
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(d / 0.25));
    tileMap.queryColliders(Math.min(ax, bx) - 1, Math.min(az, bz) - 1, Math.max(ax, bx) + 1, Math.max(az, bz) + 1, _cols);
    for (let i = 1; i < n; i++) {
      const u = i / n;
      const x = ax + (bx - ax) * u;
      const z = az + (bz - az) * u;
      const y = ya + (yb - ya) * u;
      if (tileMap.getHeight(x, z) > y - 0.1) return false;
      for (const c of _cols) if (c.type === 'circle' && Math.hypot(x - c.x, z - c.z) < c.r) return false;
    }
    return true;
  }

  // ----- markers -----

  markerAlloc(spec) {
    const h = ++this.markerN;
    const m = { spec: { ...spec }, gm: markers.alloc() };
    if (m.gm >= 0) markers.set(m.gm, m.spec);
    this.markers.set(h, m);
    return h;
  }

  markerSet(h, spec) {
    const m = this.markers.get(h);
    if (!m) return;
    Object.assign(m.spec, spec);
    if (m.gm >= 0) markers.set(m.gm, m.spec);
  }

  markerFree(h) {
    const m = this.markers.get(h);
    if (!m) return;
    if (m.gm >= 0) markers.free(m.gm);
    this.markers.delete(h);
  }

  // ----- projectiles -----

  spawnProjectile(e, s) {
    this.counts.projectiles++;
    const q = { ...s, owner: e, id: ++this.projN, t: 0, travelled: 0, sx: s.x, sy: s.y, sz: s.z, fx: -1 };
    if (s.arc) {
      q.tx = s.arc.tx;
      q.tz = s.arc.tz;
    }
    q.fx = fxq.alloc();
    this.projectiles.push(q);
    this.log(`projectile ${s.kind} from ${e.uid} vy=${(s.vy ?? 0).toFixed(2)}`);
    return this.projectiles.length - 1;
  }

  stepProjectiles(h) {
    const list = this.projectiles;
    for (let i = list.length - 1; i >= 0; i--) {
      const q = list[i];
      let done = false;
      if (q.arc) {
        q.t += h;
        const u = Math.min(1, q.t / q.arc.time);
        const gy = tileMap.getHeight(q.tx, q.tz);
        q.x = q.sx + (q.tx - q.sx) * u;
        q.z = q.sz + (q.tz - q.sz) * u;
        q.y = q.sy + (gy - q.sy) * u + 4 * q.arc.apex * u * (1 - u);
        if (u >= 1) {
          done = true;
          this.hitPlayer(q.owner, { shape: 'circle', x: q.tx, y: gy, z: q.tz, r: q.radius, dy: 0.6, mv: q.mv, kb: q.kb, thin: false, tag: `proj${q.id}`, flat: 0, knockdown: false }, 'projectile');
        }
      } else {
        const n = Math.max(1, Math.ceil((q.speed * h) / 0.25));
        const dt = h / n;
        for (let k = 0; k < n && !done; k++) {
          q.x += q.dirX * q.speed * dt;
          q.z += q.dirZ * q.speed * dt;
          q.y += (q.vy ?? 0) * dt;
          q.travelled += q.speed * dt;
          if (tileMap.getHeight(q.x, q.z) > q.y - 0.1 || q.travelled >= q.range) {
            done = true;
            break;
          }
          // swept vs the player: horizontal < radius + 0.3 and the vertical span overlaps the body band
          const d = Math.hypot(P.position.x - q.x, P.position.z - q.z);
          if (d < q.radius + P.radius && q.y + q.radius >= P.position.y + P.body[0] && q.y - q.radius <= P.position.y + P.body[1]) {
            if (!P.invulnerable) this.damagePlayer(q.owner, q.mv, q.kb, q.dirX, q.dirZ, 0, false, 'projectile');
            done = true;
          }
        }
      }
      if (done) {
        if (q.fx >= 0) fxq.free(q.fx);
        list.splice(i, 1);
      }
    }
  }

  // ----- hits -----

  /** §9.5 overlap of a HitSpec with the fake player; one hit per tag. */
  hitPlayer(e, s, source = 'enemy') {
    if (!P.alive || P.invulnerable) return false;
    const px = P.position.x;
    const pz = P.position.z;
    if (Math.abs(P.position.y - s.y) > (s.dy ?? 0.6)) return false;
    const tr = s.thin ? 0 : P.radius;
    const dx = px - s.x;
    const dz = pz - s.z;
    const d = Math.hypot(dx, dz);
    let hit = false;
    switch (s.shape) {
      case 'circle': hit = d < s.r + tr; break;
      case 'ring': hit = d > (s.rInner ?? 0) - tr && d < s.r + tr; break;
      case 'sector': {
        if (d >= s.r + tr) break;
        if (d < 1e-6) { hit = true; break; }
        const cos = (dx * s.dirX + dz * s.dirZ) / d;
        const ang = Math.acos(Math.max(-1, Math.min(1, cos))) / DEG2RAD;
        hit = ang <= (s.halfAngle ?? 60) + Math.asin(Math.min(1, tr / d)) / DEG2RAD;
        break;
      }
      case 'lane': {
        const t = dx * s.dirX + dz * s.dirZ;
        const perp = Math.abs(-dx * s.dirZ + dz * s.dirX);
        hit = t >= 0 && t <= s.len && perp < s.width / 2 + tr;
        break;
      }
      default: break;
    }
    if (!hit) return false;
    const key = s.tag;
    if (key && this.tagsHit.has(key)) return false;
    if (key) this.tagsHit.add(key);
    const fx = s.fromX ?? s.x;
    const fz = s.fromZ ?? s.z;
    const kl = Math.hypot(px - fx, pz - fz) || 1;
    this.damagePlayer(e, s.mv, s.kb, (px - fx) / kl, (pz - fz) / kl, s.flat || 0, !!s.knockdown, source);
    return true;
  }

  damagePlayer(e, mv, kb, kx, kz, flat, knockdown, source) {
    let dmg;
    if (flat > 0) dmg = flat;
    else if (mv <= 0) dmg = 0;
    else {
      const roll = 0.92 + 0.16 * this.rng.next();
      dmg = Math.max(1, Math.round(e.def.atk * mv * roll * (40 / (40 + 2 * 4))));
    }
    ps.hp = Math.max(ps.god ? 1 : 0, ps.hp - dmg);
    ps.hits++;
    this.counts.hitsOnPlayer++;
    ps.hitLog.push({ f: this.ctx.frame, uid: e.uid, dmg, source, flat: flat > 0 });
    this.log(`player hurt ${dmg} by ${e.uid} (${source}${flat ? ' flat' : ''}${knockdown ? ' knockdown' : ''})`);
    if (flat <= 0) {
      ps.iframes = knockdown ? 1.2 : 0.8;
      ps.kbD = Math.min(3, kb);
      ps.kbX = kx;
      ps.kbZ = kz;
      ps.kbT = 0;
    }
  }

  // ----- groups / adds / emits -----

  wakeGroup(src) {
    for (const o of this.enemies) {
      if (o === src || !o.alive || o._pooled || o.aggro) continue;
      const same = o.groupId && o.groupId === src.groupId;
      const near = o.zone === src.zone && Math.hypot(o.position.x - src.position.x, o.position.z - src.position.z) <= 6
        && this.los(src.position.x, src.position.z, o.position.x, o.position.z);
      if (same || near) o.wake(this.ctx);
    }
  }

  spawnAdd(kind, x, z, level) {
    for (const a of this.adds) {
      if (!a._pooled) continue;
      a._pooled = false;
      a.home.x = x;
      a.home.z = z;
      a.reset(this.ctx);
      a.sprite.opacity = 1;
      a.wake(this.ctx);
      this.log(`spawnAdd ${a.uid} ${kind} Lv${level} at ${x.toFixed(1)},${z.toFixed(1)}`);
      return a;
    }
    return null;
  }

  onEmit(event, e, args) {
    this.log(`emit ${event} ${e.uid} ${args.join(' ')}`);
    this.event('emit', `${event}${args.length ? ':' + args.join(',') : ''}`);
    if (event === 'bossIntro' && this.arena) {
      this.arena.active = true;
      // core: every other enemy (not an add) that is aggroed or inside the arena goes home
      for (const o of this.enemies) {
        if (o === e || o.isAdd || !o.alive) continue;
        if (o.aggro || this.inArena(o.position.x, o.position.z)) o.sendHome(this.ctx);
      }
    }
  }

  // ----- the sub-step -----

  step(h = FRAME) {
    const ctx = this.ctx;
    ctx.time += h;
    ctx.frame++;
    stepPlayer(h);
    this.hitboxes.length = 0;
    nav.beginStep(2);
    for (const e of this.enemies) {
      if (e.dormant || e._pooled) continue;
      const s0 = e.serial;
      e.update(h, ctx);
      if (e.state === 'windup' && e.serial !== s0) this.counts.windups++;
    }
    this.stepProjectiles(h);
    for (const hb of this.hitboxes) this.hitPlayer(hb.e, hb.s);
    this.separate();
    // dummies refill 120 f after the last hit; dormancy every 0.25 s (32 u)
    this.dormT += h;
    if (this.dormT >= 0.25 - EPS) {
      this.dormT = 0;
      for (const e of this.enemies) {
        if (!e.alive || e._pooled) continue;
        const d = Math.hypot(e.position.x - P.position.x, e.position.z - P.position.z);
        if (!e.dormant && !e.aggro && d > 32) e.sleep();
        else if (e.dormant && d <= 32) e.dormant = false;
      }
    }
  }

  /** Separation (§7.6): move radii, inverse mass; the player counts with mass 4; fliers among themselves. */
  separate() {
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive || a.dormant || a._pooled) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.alive || b.dormant || b._pooled || a.flier !== b.flier) continue;
        this.push(a, b.position, a.def.moveRadius + b.def.moveRadius, a.mass, b.mass, b);
      }
      if (!a.flier && P.alive && !P.dodging) this.push(a, P.position, a.def.moveRadius + P.radius, a.mass, 4, null);
    }
  }

  push(a, bp, min, ma, mb, b) {
    const dx = a.position.x - bp.x;
    const dz = a.position.z - bp.z;
    const d = Math.hypot(dx, dz);
    if (d >= min || d < 1e-6) return;
    const ia = Number.isFinite(ma) ? 1 / ma : 0;
    const ib = Number.isFinite(mb) ? 1 / mb : 0;
    if (ia + ib <= 0) return;
    const over = min - d;
    const sa = (ia / (ia + ib)) * over;
    const sb = (ib / (ia + ib)) * over;
    if (sa > 0) this.moveOrFly(a, (dx / d) * sa, (dz / d) * sa);
    if (sb > 0) {
      if (b) this.moveOrFly(b, (-dx / d) * sb, (-dz / d) * sb);
      else {
        const out = tileMap.move(P.position, (-dx / d) * sb, (-dz / d) * sb, 0.3, 0.55);
        P.position.x = out.x;
        P.position.z = out.z;
      }
    }
  }

  moveOrFly(e, dx, dz) {
    if (e.flier) this.moveFly(e, dx, dz);
    else this.moveGround(e, dx, dz);
  }

  clear() {
    for (const e of this.enemies) {
      e.reset(null);
      scene.remove(e.sprite);
      e.sprite.dispose();
    }
    for (const [, m] of this.markers) if (m.gm >= 0) markers.free(m.gm);
    for (const q of this.projectiles) if (q.fx >= 0) fxq.free(q.fx);
    markers.clear();
    fxq.clear();
    this.enemies = [];
    this.adds = [];
    this.hitboxes.length = 0;
    this.projectiles = [];
    this.markers.clear();
    this.events = [];
    this.logLines = [];
    this.tokens = { melee: 3, ranged: 2 };
    this.offscreen = false;
    this.arena = null;
    this.counts = this._zeroCounts();
    this.tagsHit = new Set();
    this.ctx.time = 0;
    this.ctx.frame = 0;
    this.dormT = 0;
  }
}
const _burstPos = new THREE.Vector3();
const core = new MockCore();
core.tagsHit = new Set();

// -------------------------------------------------------------------------------------------------
// Spawning
// -------------------------------------------------------------------------------------------------

/**
 * Create an enemy exactly as combat-core does (sheet shared per kind, Sprite3D with combatFx,
 * scaledDef, per-enemy RNG seeded by uid ^ seed).
 * @param kind  an ENEMY_DEFS kind
 * @param {string} uid
 * @param {number} x @param {number} z  home
 * @param {{ group?: string, radius?: number, index?: number, level?: number, elite?: boolean,
 *   name?: string, isAdd?: boolean, arena?: EnemyArena|null, facing?: [number, number] }} [o]
 * @returns {MockEnemy}
 */
function spawn(kind, uid, x, z, o = {}) {
  const sheet = sheets[kind] ?? (sheets[kind] = createEnemySheet(kind));
  const sprite = new Sprite3D(sheet, { ...CHARACTER_SPRITE_OPTS, ...sheet.spriteOptions, combatFx: true });
  scene.add(sprite);
  const groupId = o.group ?? uid.split('#')[0];
  const e = createEnemy({
    uid, group: { id: groupId, radius: o.radius ?? 2 }, index: o.index ?? 0, kind,
    level: o.level ?? 1, elite: !!o.elite, name: o.name ?? '',
    home: { x, z }, def: scaledDef(kind, o.level ?? 1, !!o.elite), sheet, sprite,
    rng: new RNG((hashString(uid) ^ core.seed) >>> 0), isAdd: !!o.isAdd, arena: o.arena ?? null,
  });
  e.reset(core.ctx);
  if (o.facing) e.faceDir(o.facing[0], o.facing[1]);
  core.enemies.push(e);
  return e;
}

/** The boss arena as the mock core hands it to the golem (no BossArena extras). @returns {EnemyArena} */
function makeArena() {
  const r = ARENA_RECT;
  return {
    rect: { ...r }, gate: [...GATE], y: tileMap.getHeight((r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2), active: false,
    contains(x, z) { return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ; },
  };
}

// -------------------------------------------------------------------------------------------------
// Scenarios
// -------------------------------------------------------------------------------------------------

let scenario = '';
const SCENARIOS = {
  roster() {
    const kinds = ['slime', 'goblin', 'archer', 'shaman', 'bat', 'boar', 'dummy'];
    kinds.forEach((k, i) => spawn(k, `${k}#0`, 3.5 + i * 3.4, 12.5, { facing: [0, 1] }));
    const g = spawn('golem', 'golem#0', 18, 25.5, { arena: makeArena() });
    g.faceDir(0, 1);
    spawn('goblin', 'elite#0', 27.5, 12.5, { elite: true, level: 3, name: 'Elite Goblin', facing: [0, 1] });
    placePlayer(22, 1.5);
    setView({ focus: [16, 1.2, 17], dist: 36 });
  },
  slime() {
    for (let i = 0; i < 3; i++) spawn('slime', `slime#${i}`, 6 + i * 1.5, 12.5 + (i % 2), { index: i, group: 'slime' });
    placePlayer(11.5, 13.5);
    setView('field');
  },
  goblin() {
    spawn('goblin', 'goblin#0', 7.5, 13.5, { group: 'goblin' });
    spawn('goblin', 'goblin#1', 7.5, 15.5, { group: 'goblin', index: 1 });
    placePlayer(12.5, 13.5);
    setView('field');
  },
  archer() {
    spawn('archer', 'archer#0', 5.5, 13.5);
    placePlayer(12.5, 13.5);
    Object.assign(ps, { mode: 'path', path: [[12.5, 11.5], [12.5, 15.5]], speed: 1.2, loop: true });
    setView('field');
  },
  shaman() {
    spawn('shaman', 'shaman#0', 5.5, 13.5);
    const hurt = spawn('slime', 'ally#0', 3.5, 11.5, { group: 'ally' });
    hurt.hp = Math.round(hurt.hpMax * 0.3);
    placePlayer(12.5, 13.5);
    setView('field');
  },
  bat() {
    for (let i = 0; i < 3; i++) spawn('bat', `bat#${i}`, 7 + i, 12 + i, { index: i, group: 'bat', radius: 3 });
    placePlayer(12.5, 13.5);
    setView('field');
  },
  boar() {
    spawn('boar', 'boar#0', 32.5, 25.5, { radius: 1.5, facing: [1, 0] });
    placePlayer(38.2, 25.5);
    setView('wall');
  },
  boarElite() {
    spawn('boar', 'boarE#0', 34.5, 12.5, { radius: 1.5, elite: true, level: 4, name: 'Old Ironhide', facing: [0, 1] });
    placePlayer(34.5, 18.5);
    setView({ focus: [36, 1, 17], dist: 24 });
  },
  dummy() {
    for (let i = 0; i < 3; i++) spawn('dummy', `dummy#${i}`, 8 + i * 2.5, 12.5, { index: i, group: 'dummy' });
    placePlayer(10.5, 14);
    ps.attack = true;
    setView('field');
  },
  ledge() {
    spawn('archer', 'ledge#0', 42.5, 5.5, { facing: [0, 1] });
    placePlayer(42.5, 12.5);
    setView('ledge');
  },
  stairs() {
    spawn('goblin', 'stairs#0', 33.5, 14.5);
    placePlayer(36.9, 13.2);
    Object.assign(ps, { mode: 'path', path: [[36.9, 12.2], [36.9, 9.2], [38.5, 6.5], [41.5, 5.5]], speed: 2.4, loop: false });
    setView('ledge');
  },
  offscreen() {
    spawn('goblin', 'off#0', 7.5, 13.5);
    placePlayer(11.5, 13.5);
    setView('field');
  },
  boss() {
    core.arena = makeArena();
    const g = spawn('golem', 'golem#0', 18, 24.5, { arena: core.arena, radius: 1 });
    g.faceDir(0, 1);
    for (let i = 0; i < 6; i++) {
      const a = spawn('bat', `golem#0:add#${i}`, 18, 24.5, { isAdd: true, level: 5, group: 'golem#0', radius: 1 });
      a.sleep();
      a.sprite.opacity = 0;
      a._pooled = true;
      core.adds.push(a);
    }
    // a goblin outside the arena that the intro must send home
    spawn('goblin', 'outside#0', 23.5, 38.5);
    placePlayer(17.9, 38.5);
    Object.assign(ps, { mode: 'path', path: [[17.9, 36.0], [17.9, 31.5]], speed: 3.0, loop: false });
    setView('arena');
  },
  mix() {
    spawn('slime', 'mix_s#0', 6.5, 12.5, { group: 'mix_s' });
    spawn('slime', 'mix_s#1', 7.5, 14.5, { group: 'mix_s', index: 1 });
    spawn('goblin', 'mix_g#0', 4.5, 13.5);
    spawn('archer', 'mix_a#0', 3.5, 11.0);
    spawn('bat', 'mix_b#0', 9.5, 11.5, { radius: 3 });
    spawn('shaman', 'mix_h#0', 3.0, 15.5);
    spawn('boar', 'mix_r#0', 15.5, 10.0, { radius: 1.5 });
    placePlayer(11.5, 13.5);
    Object.assign(ps, { mode: 'path', path: [[11.5, 12.0], [13.5, 13.5], [11.5, 15.0], [9.5, 13.5]], speed: 1.6, loop: true, attack: true });
    setView('field');
  },
  perf() {
    const kinds = ['slime', 'goblin', 'archer', 'shaman', 'bat', 'boar'];
    for (let i = 0; i < 30; i++) {
      const k = kinds[i % kinds.length];
      spawn(k, `perf${k}#${i}`, 3 + (i % 10) * 2.4, 10 + Math.floor(i / 10) * 1.6, { index: i });
    }
    placePlayer(14, 14);
    Object.assign(ps, { mode: 'path', path: [[12, 13], [16, 14], [14, 15.5]], speed: 1.5, loop: true, attack: true });
    setView('field');
  },
};

/**
 * Clear the mock core and set up a scenario.
 * @param {string} name  a `SCENARIOS` key
 * @param {number} [seed]
 * @returns {number} the enemies spawned
 */
function load(name, seed = 1) {
  core.clear();
  core.seed = seed >>> 0;
  core.rng = new RNG(core.seed ^ 0x5eed);
  Object.assign(ps, { mode: 'stand', path: [], pathI: 0, loop: true, speed: 3.2, attack: false, swingT: 0.4, actionT: 0, hp: 100, iframes: 0, god: true, kbD: 0, kbT: 1, hits: 0, hitLog: [] });
  P.alive = true;
  P.action = null;
  P.facing.x = 0;
  P.facing.z = -1;
  scenario = name;
  SCENARIOS[name]();
  document.getElementById('scen').textContent = `· ${name} (seed ${seed})`;
  core.log(`load ${name} seed ${seed}`);
  return core.enemies.length;
}

// -------------------------------------------------------------------------------------------------
// Stepping, dumps, checks
// -------------------------------------------------------------------------------------------------

let paused = false;
/** @type {{ name: string, ok: boolean, detail: string }[]} every `check()` so far */
const results = [];

/** Step the mock core `n` frames. @param {number} [n] @returns {number} the frame reached */
function step(n = 1) {
  for (let i = 0; i < n; i++) core.step(FRAME);
  return core.ctx.frame;
}

/**
 * @param {string|MockEnemy} q  a uid, or a kind (its first unpooled enemy); an enemy is returned as is
 * @returns {MockEnemy|undefined}
 */
function find(q) {
  if (typeof q !== 'string') return q;
  return core.enemies.find((e) => e.uid === q) ?? core.enemies.find((e) => e.kind === q && !e._pooled);
}

/**
 * Step until `pred()` is true (or a {who, state, minF} spec matches), at most `max` frames.
 * @param pred  a predicate, or `{ who (uid or kind), state, minF (frames in that state) }`
 * @param {number} [max]
 * @returns {number} frames stepped, or −1 when it never happened
 */
function until(pred, max = 600) {
  let fn = pred;
  if (typeof pred === 'object') {
    const { who, state, minF = 0 } = pred;
    fn = () => {
      const list = who ? core.enemies.filter((e) => (e.uid === who || e.kind === who) && !e._pooled) : core.enemies;
      return list.some((e) => e.state === state && e.t >= minF / 60 - EPS);
    };
  }
  for (let i = 0; i < max; i++) {
    if (fn()) return i;
    core.step(FRAME);
  }
  return fn() ? max : -1;
}

/**
 * Record a check (PASS / FAIL in the log and `results()`).
 * @param {string} name
 * @param {unknown} cond  truthy: passed
 * @param {unknown} [detail]  anything; stored as String(detail)
 */
function check(name, cond, detail = '') {
  const ok = !!cond;
  results.push({ name, ok, detail: String(detail) });
  core.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`);
  if (!ok) console.warn(`[enemy_ai] FAIL ${name} ${detail}`);
  return ok;
}

/** Deterministic state dump: every enemy's live state, brain state, hazards, the player and counters. */
function dump() {
  const round = (v) => (typeof v === 'number' ? (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : String(v)) : v);
  const plain = (o, depth = 0) => {
    if (o === null || o === undefined) return o;
    if (typeof o === 'number') return round(o);
    if (typeof o !== 'object') return o;
    if (depth > 3) return '…';
    if (Array.isArray(o)) return o.map((x) => (x && typeof x === 'object' && x.uid ? x.uid : plain(x, depth + 1)));
    if (o.uid) return o.uid;
    const out = {};
    for (const k of Object.keys(o).sort()) out[k] = plain(o[k], depth + 1);
    return out;
  };
  return JSON.stringify({
    frame: core.ctx.frame,
    player: { x: round(P.position.x), z: round(P.position.z), hp: ps.hp, hits: ps.hitLog },
    tokens: core.tokens,
    counts: core.counts,
    enemies: core.enemies.map((e) => ({
      uid: e.uid, state: e.state, t: round(e.t), hp: round(e.hp), poise: round(e.poise), alive: e.alive, aggro: e.aggro,
      x: round(e.position.x), y: round(e.position.y), z: round(e.position.z), fx: round(e.facing.x), fz: round(e.facing.z),
      token: e.token, hover: round(e.hover), phase: e.phase, ai: plain(e.ai), hazards: e.hazardCount,
    })),
    markers: [...core.markers.values()].map((m) => plain(m.spec)),
    projectiles: core.projectiles.map((q) => [q.kind, round(q.x), round(q.y), round(q.z)]),
  });
}

function stateSummary() {
  return core.enemies.filter((e) => !e._pooled).map((e) => `${e.uid.padEnd(16)} ${e.state.padEnd(8)} t=${String(Math.round(e.t * 60)).padStart(4)}f hp=${Math.round(e.hp)}/${e.hpMax}${e.token ? ' tok' : ''}${e.boss ? ` ph${e.phase} floor${Math.round(e.hpFloor)}` : ''}${e.guarded ? ' guard' : ''}${e.exposed ? ' exposed' : ''}`).join('\n');
}

// -------------------------------------------------------------------------------------------------
// Tests (deterministic, stepped; each ends at a moment worth a screenshot)
// -------------------------------------------------------------------------------------------------

const count = (type, name) => core.events.filter((ev) => ev.type === type && (!name || ev.name === name)).length;

/** Every pose name the brains show (Enemy.pose falls back to idle0 when one is missing). */
const POSES_USED = {
  slime: ['idle0', 'move0', 'move1', 'move2', 'windup', 'attack', 'land', 'hurt', 'dead'],
  goblin: ['windup', 'attack', 'attack2', 'follow', 'tuck', 'hurt', 'dead'],
  archer: ['windup', 'attack', 'wind', 'shove', 'follow', 'hurt', 'dead'],
  shaman: ['windup', 'attack', 'blink', 'hurt', 'dead'],
  bat: ['windup', 'attack', 'hurt', 'dead'],
  boar: ['windup', 'attack', 'charge0', 'charge1', 'stun', 'hurt', 'dead'],
  dummy: ['hurt', 'hurt2', 'dead'],
  golem: ['kneel', 'idle0', 'roar', 'slamWind', 'slam', 'sweepWind', 'sweep', 'throw', 'dead'],
};

const tests = {
  idle() {
    load('roster');
    for (const [kind, names] of Object.entries(POSES_USED)) {
      const sheet = sheets[kind];
      const missing = names.filter((n) => !Number.isInteger(sheet?.poses?.[n]));
      const anims = ['idle', 'walk', 'run'].filter((a) => !sheet?.animations?.[`${a}_down`]);
      check(`sheet ${kind}: every pose and locomotion animation the brain uses exists`, !missing.length && !anims.length, [...missing, ...anims].join(','));
    }
    step(120);
    check('idle: nobody aggroes the far player', core.enemies.every((e) => !e.aggro), stateSummary());
    check('idle: boss kneels dormant, guarded', find('golem').state === 'dormant' && find('golem').guarded);
    check('idle: bat hovers', find('bat').sprite.mesh.position.y > 1.0, find('bat').sprite.mesh.position.y);
    return stateSummary();
  },
  slime() {
    load('slime');
    const n1 = until({ who: 'slime', state: 'notice' }, 60);
    check('slime: notices within aggro 6', n1 >= 0, n1);
    const n2 = until({ who: 'slime', state: 'windup', minF: 20 }, 600);
    check('slime: wind-up (squash)', n2 >= 0, n2);
    const e = core.enemies.find((x) => x.state === 'windup');
    check('slime: wind-up only on screen with a token', e && e.token);
    const n3 = until(() => ps.hits > 0, 600);
    check('slime: leap hits the player', n3 >= 0, n3);
    until({ who: 'slime', state: 'active', minF: 5 }, 400);
    return stateSummary();
  },
  goblin() {
    load('goblin');
    const n = until({ who: 'goblin', state: 'windup', minF: 22 }, 600);
    check('goblin: wind-up ≥ 18 f reached', n >= 0, n);
    const hit = until(() => ps.hits > 0, 900);
    check('goblin: slash hits', hit >= 0, hit);
    // run long enough to see a follow-up (30 %) and verify it re-enters windup
    let followUps = 0;
    for (let i = 0; i < 2400; i++) {
      const before = core.enemies.map((e) => e.state + (e.ai.follow ? 'F' : ''));
      step(1);
      core.enemies.forEach((e, k) => { if (e.state === 'windup' && e.ai.follow && before[k] === 'active') followUps++; });
    }
    check('goblin: follow-up has its own wind-up (re-pulse)', followUps > 0, followUps);
    // 40 s of slashes knocked everyone against the arena rim: a fresh scene for the screenshot
    load('goblin');
    until({ who: 'goblin', state: 'windup', minF: 14 }, 900);
    return `followUps ${followUps}\n${stateSummary()}`;
  },
  archer() {
    load('archer');
    const n = until({ who: 'archer', state: 'windup', minF: 38 }, 900);
    check('archer: shot wind-up with a locked lane', n >= 0, n);
    const lanes = [...core.markers.values()].filter((m) => m.spec.shape === 'lane');
    check('archer: lane marker (width 0.5, draped y 0.03)', lanes.length >= 1 && lanes[0].spec.width === 0.5 && lanes[0].spec.y === 0.03);
    // a player who keeps walking across the locked lane is missed (that is the dodge cue);
    // one who stands still is hit
    Object.assign(ps, { mode: 'stand' });
    const hit = until(() => ps.hitLog.some((x) => x.source === 'projectile'), 900);
    check('archer: arrow hits the standing player', hit >= 0, hit);
    Object.assign(ps, { mode: 'path' });
    const shots = until(() => find('archer').ai.shots >= 2 && find('archer').state === 'windup' && find('archer').t > 30 / 60, 2400);
    const vol = [...core.markers.values()].filter((m) => m.spec.shape === 'lane').length;
    check('archer: every 3rd shot is a 3-lane volley', shots >= 0 && vol === 3, `lanes ${vol}`);
    return stateSummary();
  },
  shaman() {
    load('shaman');
    // Mend first: the hurt ally still stands beside it (the 480 f timer is nearly due)
    find('shaman').ai.mendT = 470 / 60;
    const heal = until(() => core.counts.heals > 0, 300);
    check('shaman: Mend heals the hurt ally (0.3 × max)', heal >= 0 && find('ally#0').hp > find('ally#0').hpMax * 0.3, find('ally#0').hp);
    const n = until(() => find('shaman').hazardCount > 0 && core.markers.size > 0, 900);
    check('shaman: Hex Flame circle placed after its wind-up', n >= 0, n);
    const circle = [...core.markers.values()].find((m) => m.spec.shape === 'circle');
    check('shaman: circle r 1.6', circle && Math.abs(circle.spec.r - 1.6) < 1e-9);
    step(30);
    const shotAt = core.ctx.frame;
    const erupt = until(() => count('sfx', 'hexBurst') > 0, 200);
    check('shaman: eruption at progress 1 (66 f fill)', erupt >= 0, core.ctx.frame - shotAt);
    // blink: stand right next to it for 60 f
    const sh = find('shaman');
    const d0 = () => Math.hypot(sh.position.x - P.position.x, sh.position.z - P.position.z);
    Object.assign(ps, { mode: 'stand' });
    let blinked = -1;
    for (let i = 0; i < 400 && blinked < 0; i++) {
      if (d0() > 1.2) placePlayer(sh.position.x + 1.0, sh.position.z);
      const b = count('burst', 'deathPoof');
      step(1);
      if (count('burst', 'deathPoof') > b) blinked = i;
    }
    check('shaman: blinks away after 60 f within 2.5 u', blinked >= 0 && d0() > 2.5, `${blinked} d=${d0().toFixed(2)}`);
    placePlayer(12.5, 13.5);
    until(() => find('shaman').hazardCount > 0 && core.markers.size > 0, 900);
    step(40);
    return stateSummary();
  },
  bat() {
    load('bat');
    const n = until({ who: 'bat', state: 'windup', minF: 12 }, 900);
    check('bat: swoop wind-up with a dive-point marker', n >= 0 && [...core.markers.values()].some((m) => m.spec.shape === 'circle' && Math.abs(m.spec.r - 0.6) < 1e-9), n);
    const b = core.enemies.find((e) => e.state === 'windup');
    let bx = b.position.x;
    let bz = b.position.z;
    const dive = until(() => {
      if (b.state === 'windup') {
        bx = b.position.x;
        bz = b.position.z;
      }
      return b.state === 'active';
    }, 30);
    const expect = Math.ceil(((Math.hypot(b.ai.diveX - bx, b.ai.diveZ - bz) + 1.5) / 9) * 60);
    check('bat: dive frames = ceil((dist + 1.5) / 9 · 60)', dive >= 0 && b.ai.diveF === expect, `${b.ai.diveF} vs ${expect}`);
    step(6);
    check('bat: hover drops toward 0.6 in the dive', b.hover < 1.0, b.hover.toFixed(2));
    const hit = until(() => ps.hits > 0, 900);
    check('bat: a dive hits', hit >= 0, hit);
    until({ who: 'bat', state: 'active', minF: 3 }, 900);
    return stateSummary();
  },
  boar() {
    load('boar');
    const n = until({ who: 'boar', state: 'windup', minF: 50 }, 900);
    const b = find('boar');
    check('boar: charge wind-up 60 f with a free-run lane', n >= 0 && b.ai.move === 'charge', `${n} len=${b.ai.len} end=${b.ai.end}`);
    check('boar: lane stops at the wall (obstacle)', b.ai.end === 'obstacle' && b.ai.len < 8, `${b.ai.len}`);
    // the intended counter: stand before the wall, roll out of the locked lane as the charge starts
    until(() => b.state === 'active', 60);
    placePlayer(P.position.x - 1.0, P.position.z + 2.6);
    const stun = until(() => b.state === 'stun', 200);
    check('boar: charges into the wall → stun (vuln 1.5, exposed)', stun >= 0 && b.vuln === 1.5 && b.exposed, `${stun} ${b.state}`);
    check('boar: the dodged charge did not hit', !ps.hitLog.some((x) => x.uid === b.uid));
    step(20);
    return stateSummary();
  },
  boarSkid() {
    load('boarElite');
    const b = find('boar');
    const n = until({ who: 'boar', state: 'active' }, 900);
    check('boar (elite): charge in the open', n >= 0 && b.ai.end === 'max', `${b.ai.len} ${b.ai.end}`);
    const sk = until(() => b.state === 'recover' && b.ai.skid, 200);
    check('boar: open charge ends in a skid (no stun)', sk >= 0 && b.state !== 'stun');
    check('boar: the charge knocked the standing player down', ps.hitLog.some((x) => x.uid === b.uid));
    const second = until(() => b.state === 'windup' && b.ai.second, 60);
    check('boar (elite): second charge wind-up 30 f', second >= 0);
    step(15);
    return stateSummary();
  },
  dummy() {
    load('dummy');
    step(10);
    const d = find('dummy');
    const n = until(() => core.counts.playerHits >= 3, 600);
    check('dummy: takes hits, never aggroes / moves', n >= 0 && core.enemies.every((e) => !e.aggro && e.state === 'idle'), n);
    const w = until(() => core.enemies.some((x) => x.ai.wob >= 0 && x.ai.wob < 6 / 60), 200);
    check('dummy: wobble (hurt → hurt2)', w >= 0, w);
    return stateSummary();
  },
  ledge() {
    load('ledge');
    const a = find('archer');
    check('ledge: archer stands 1 u above the player', Math.abs(a.position.y - P.position.y - 1.0) < 1e-6, `${a.position.y} ${P.position.y}`);
    check('ledge: LOS from the ledge down into the floor', core.los(a.position.x, a.position.z, P.position.x, P.position.z));
    const n = until({ who: 'archer', state: 'windup', minF: 40 }, 900);
    check('ledge: shot wind-up (lane down the ledge)', n >= 0, n);
    const hit = until(() => ps.hitLog.some((x) => x.source === 'projectile'), 200);
    check('ledge: the arrow hits the player on the floor below', hit >= 0, hit);
    until({ who: 'archer', state: 'windup', minF: 40 }, 900);
    return stateSummary();
  },
  stairs() {
    load('stairs');
    const g = find('goblin');
    until(() => g.aggro, 120);
    const up = until(() => g.position.y > 1.9 && Math.hypot(g.position.x - P.position.x, g.position.z - P.position.z) < 4, 1200);
    check('stairs: the goblin follows the player up the stairs onto the ledge', up >= 0, `y=${g.position.y.toFixed(2)} st=${g.state}`);
    return stateSummary();
  },
  offscreen() {
    load('offscreen');
    const g = find('goblin');
    core.offscreen = true;
    const w0 = core.counts.windups;
    step(360);
    check('offscreen: no wind-up while ctx.onScreen is false', !core.enemies.some((e) => e.state === 'windup' || e.state === 'active') && core.counts.windups === w0 && ps.hits === 0, `windups ${core.counts.windups - w0} state ${g.state}`);
    check('offscreen: it still approaches (engaged, close)', g.aggro && Math.hypot(g.position.x - P.position.x, g.position.z - P.position.z) < 3.6);
    core.offscreen = false;
    const n = until({ who: 'goblin', state: 'windup' }, 240);
    check('offscreen: on screen again → wind-up', n >= 0, n);
    step(14);
    return stateSummary();
  },
  boss() {
    load('boss');
    const g = find('golem');
    const gob = find('outside#0');
    // wake the goblin outside first: the intro must send it home
    gob.wake(core.ctx);
    const intro = until(() => g.state === 'intro', 400);
    check('boss: intro when the player enters the arena rect', intro >= 0, intro);
    check('boss: bossIntro emitted, other enemies sent home', count('emit', 'bossIntro') === 1 && gob.state === 'return');
    const awake = until(() => count('emit', 'bossAwake') > 0, 120);
    check('boss: bossAwake at intro f60', awake >= 0 && g.t >= 60 / 60 - 1e-6 && g.t < 62 / 60, Math.round(g.t * 60));
    step(8);
    return stateSummary();
  },
  bossFight() {
    tests.boss();
    const g = find('golem');
    const eng = until(() => g.state === 'engage', 120);
    check('boss: engages after the 108 f intro', eng >= 0 && !g.guarded);
    // slam: stand close
    placePlayer(g.position.x, g.position.z + 2.6);
    Object.assign(ps, { mode: 'stand' });
    g.ai.cd.sweep = 99;
    g.ai.gap = 0;
    const slam = until(() => g.state === 'windup' && g.ai.move === 'slam' && g.t > 40 / 60, 400);
    check('boss: Hammer Slam wind-up with a circle r 2.6 ahead', slam >= 0 && [...core.markers.values()].some((m) => Math.abs(m.spec.r - 2.6) < 1e-9), slam);
    return stateSummary();
  },
  bossPhase2() {
    tests.boss();
    const g = find('golem');
    until(() => g.state === 'engage', 120);
    g.hp = Math.round(g.hpMax * 0.69);
    step(1);
    check('boss: 70 % → phase 2 transition (guarded roar)', g.phase === 2 && g.state === 'phase' && g.guarded && count('emit', 'bossPhase:2') === 1);
    const hpFloor = g.hpFloor;
    check('boss: hpFloor is the 35 % threshold in phase 2', Math.abs(hpFloor - g.hpMax * 0.35) < 1e-6, hpFloor);
    until(() => g.t >= 62 / 60, 80);
    check('boss: 3 bat adds spawned at f60', core.adds.filter((a) => !a._pooled).length === 3, core.adds.filter((a) => !a._pooled).length);
    check('boss: push ring (mv 0) at f60', g.hazardCount >= 1);
    step(4);
    return stateSummary();
  },
  bossCharge() {
    tests.boss();
    const g = find('golem');
    until(() => g.state === 'engage', 120);
    g.setPhase(2, core.ctx);
    // brazier behind the player: boss (23.5, 31.5) → player (23.5, 26.3) → brazier (23.5, 22.5)
    g.position.set(23.5, g.position.y, 31.5);
    g.faceDir(0, -1);
    placePlayer(23.5, 26.3);
    Object.assign(ps, { mode: 'stand' });
    Object.assign(g.ai.cd, { slam: 99, sweep: 99, toss: 99, rain: 99, charge: 0 });
    g.ai.gap = 0;
    const w = until(() => g.state === 'windup' && g.ai.move === 'charge' && g.t > 44 / 60, 300);
    check('boss: Charge lane to the brazier', w >= 0 && g.ai.end === 'obstacle', `${g.ai.len} ${g.ai.end}`);
    const stun = until(() => g.state === 'stun', 200);
    check('boss: charge into the brazier → stun 120 f (vuln 1.5, exposed)', stun >= 0 && g.vuln === 1.5 && g.exposed, stun);
    step(10);
    return stateSummary();
  },
  bossSkid() {
    tests.boss();
    const g = find('golem');
    until(() => g.state === 'engage', 120);
    g.setPhase(2, core.ctx);
    g.position.set(13.5, g.position.y, 28);
    g.faceDir(1, 0);
    placePlayer(19.5, 28);
    Object.assign(ps, { mode: 'stand' });
    Object.assign(g.ai.cd, { slam: 99, sweep: 99, toss: 99, rain: 99, charge: 0 });
    g.ai.gap = 0;
    const a = until(() => g.state === 'active' && g.ai.move === 'charge', 300);
    check('boss: charge lane ends at the arena rect (inset 1)', a >= 0 && g.ai.end === 'rect', `${g.ai.len} ${g.ai.end}`);
    const sk = until(() => g.state === 'recover' && g.ai.skid, 200);
    check('boss: arena edge → 45 f skid, no stun', sk >= 0 && g.vuln === 1, sk);
    step(12);
    return stateSummary();
  },
  bossPhase3() {
    tests.boss();
    const g = find('golem');
    until(() => g.state === 'engage', 120);
    g.setPhase(2, core.ctx);
    g.hp = Math.round(g.hpMax * 0.34);
    step(1);
    check('boss: 35 % → kneel (exposed, not guarded)', g.phase === 3 && g.state === 'kneel' && g.exposed && !g.guarded && count('emit', 'bossPhase:3') === 1);
    check('boss: kneel damage cap = 8 % of max (hpFloor)', Math.abs(g.hp - g.hpFloor - 0.08 * g.hpMax) < 1e-6, `${g.hp} ${g.hpFloor}`);
    placePlayer(g.position.x, g.position.z + 2.0);
    Object.assign(ps, { mode: 'stand' });
    for (let i = 0; i < 20; i++) playerSwing(g, 1, 0, 0, 30);
    check('boss: kneel damage stops at the cap', Math.abs(g.hp - g.hpFloor) < 1e-6, g.hp);
    until(() => g.state === 'phase', 100);
    check('boss: guarded roar after the 90 f kneel', g.guarded && g.ai.trans === 3);
    until(() => g.state === 'engage', 80);
    // shockwave slam: rings expand from the slam point, thin
    placePlayer(g.position.x, g.position.z + 2.4);
    Object.assign(g.ai.cd, { slam: 0, sweep: 99, toss: 99, rain: 99, charge: 99 });
    g.ai.gap = 0;
    const w = until(() => g.state === 'windup' && g.ai.move === 'slam', 300);
    check('boss: phase-3 wind-up × 0.75 (45 f)', w >= 0);
    const t0 = core.ctx.frame;
    until(() => g.state === 'recover', 60);
    check('boss: slam wind-up lasted 45 f', core.ctx.frame - t0 - 6 === 45 || core.ctx.frame - t0 - 6 === 46, core.ctx.frame - t0);
    step(30);
    const rings = [...core.markers.values()].filter((m) => m.spec.shape === 'ring').length;
    check('boss: Shockwave rings (18 f apart) + magma pool', rings >= 2 && [...core.markers.values()].some((m) => m.spec.style === 'magma'), `rings ${rings}`);
    return stateSummary();
  },
  bossRain() {
    tests.boss();
    const g = find('golem');
    until(() => g.state === 'engage', 120);
    g.setPhase(2, core.ctx);
    placePlayer(g.position.x + 4, g.position.z + 4);
    Object.assign(ps, { mode: 'path', path: [[g.position.x + 4, g.position.z + 4], [g.position.x - 3, g.position.z + 5]], speed: 1.5, loop: true });
    Object.assign(g.ai.cd, { slam: 99, sweep: 99, toss: 99, rain: 0, charge: 99 });
    g.ai.gap = 0;
    const n = until(() => g.state === 'active' && g.ai.move === 'rain' && g.t > 50 / 60, 300);
    const circles = [...core.markers.values()].filter((m) => m.spec.shape === 'circle' && Math.abs(m.spec.r - 1.2) < 1e-9).length;
    check('boss: Ember Rain circles staggered 15 f (r 1.2)', n >= 0 && circles >= 3, `circles ${circles}`);
    return stateSummary();
  },
  bossToss() {
    tests.boss();
    const g = find('golem');
    until(() => g.state === 'engage', 120);
    placePlayer(g.position.x, g.position.z + 8.5);
    Object.assign(ps, { mode: 'stand' });
    Object.assign(g.ai.cd, { slam: 99, sweep: 99, toss: 0, rain: 99, charge: 99 });
    g.ai.gap = 0;
    until(() => g.state === 'recover' && g.ai.move === 'toss', 300);
    step(1);
    const circles = [...core.markers.values()].filter((m) => Math.abs(m.spec.r - 1.4) < 1e-9).length;
    check('boss: Rock Toss — 3 landing circles + 3 boulders', circles === 3 && core.projectiles.filter((q) => q.kind === 'boulder').length === 3, circles);
    step(40);
    return stateSummary();
  },
  interrupts() {
    load('goblin');
    const g = find('goblin#0');
    until({ who: 'goblin#0', state: 'windup', minF: 6 }, 900);
    check('highlight: wind-up pulse 0.45 ↔ 0.9, no flash mix', g._highlight[3] >= 0.45 - 1e-9 && g._highlight[3] <= 0.9 + 1e-9 && g._highlight[0] === 1.6 && g._flash[3] === 0, `${g._highlight.join(',')} / ${g._flash.join(',')}`);
    const tok = core.tokens.melee;
    playerSwing(g, 1, 10, 0.5, 1);
    check('poise: a hit on poise > 0 does not interrupt', g.state === 'windup' && g.poise === g.poiseMax - 10, `${g.state} ${g.poise}`);
    check('flash: hit flash wins over the wind-up pulse', g._flash[0] === 2.2 && g._flash[3] === 0.85 && g._highlight[3] === 0, `${g._flash.join(',')} / ${g._highlight.join(',')}`);
    playerSwing(g, 1, 10, 0.5, 1);
    check('poise: ≤ 0 → stagger, attack cancelled, token and markers released', g.state === 'stagger' && !g.token && core.tokens.melee === tok + 1, `${g.state} tok ${core.tokens.melee}`);
    step(37); // entered during hit resolution: frames 0–35 run in the next 36 sub-steps
    check('stagger: 36 f, poise refilled', g.state !== 'stagger' && g.poise === g.poiseMax, `${g.state} ${g.poise}`);
    load('slime');
    const s = find('slime#0');
    until({ who: 'slime#0', state: 'windup', minF: 4 }, 900);
    playerSwing(s, 1, 0, 0.8, 1);
    check('hitstun: poise-0 kinds are interrupted by every hit', s.state === 'hitstun' && !s.token, s.state);
    step(13);
    check('hitstun: still hurt after 13 sub-steps (frames 0–12)', s.state === 'hitstun', s.state);
    step(1);
    check('hitstun: 13 f, then engage', s.state === 'engage', s.state);
    load('roster');
    const el = find('elite#0');
    step(3);
    check('highlight: elite gold shimmer 0.12 ↔ 0.24 when not flashing', el._highlight[0] === 1.6 && el._highlight[1] === 1.3 && el._highlight[3] >= 0.12 - 1e-9 && el._highlight[3] <= 0.24 + 1e-9 && el._flash[3] === 0, `${el._highlight.join(',')} / ${el._flash.join(',')}`);
    return stateSummary();
  },
  goblinHop() {
    load('goblin');
    const g = find('goblin#0');
    until(() => g.state === 'engage', 60);
    // the player swings (action edge 'a1') every 30 f right next to it
    let hop = -1;
    let swings = 0;
    for (let i = 0; i < 1800 && hop < 0; i++) {
      if (g.state === 'engage' && g.ai.hopT < 0 && Math.hypot(g.position.x - P.position.x, g.position.z - P.position.z) > 1.8) {
        placePlayer(g.position.x + 1.5, g.position.z);
      }
      if (i % 30 === 0) {
        P.action = 'a1';
        ps.actionT = 20 / 60;
        swings++;
      }
      step(1);
      if (g.ai.hopT >= 0) hop = i;
    }
    check('goblin: back-hop (20 %, seeded) when the player swings within 2 u', hop >= 0, `after ${swings} swings`);
    step(6);
    return stateSummary();
  },
  goblinHopSkills() {
    // which player actions count as a melee start (KNOWN_ISSUES COMBAT-24): the core names
    // Whirl Slash 'skill1' — a melee skill, so it can start a hop; Ember Bolt 'skill2' never does
    const hopUnder = (action) => {
      load('goblin');
      const g = find('goblin#0');
      until(() => g.state === 'engage', 60);
      for (let i = 0; i < 1800; i++) {
        if (g.state === 'engage' && g.ai.hopT < 0 && Math.hypot(g.position.x - P.position.x, g.position.z - P.position.z) > 1.8) {
          placePlayer(g.position.x + 1.5, g.position.z);
        }
        if (i % 30 === 0) {
          P.action = action;
          ps.actionT = 20 / 60;
        }
        step(1);
        if (g.ai.hopT >= 0) return i;
      }
      return -1;
    };
    const whirl = hopUnder('skill1');
    check('goblin: back-hop when Whirl Slash (skill1) starts within 2 u', whirl >= 0, `frame ${whirl}`);
    const bolt = hopUnder('skill2');
    check('goblin: no back-hop from Ember Bolt (skill2, not melee) in 60 casts', bolt < 0, `frame ${bolt}`);
    return stateSummary();
  },
  shove() {
    load('archer');
    Object.assign(ps, { mode: 'stand' });
    setView({ focus: [4, 1, 13.5], dist: 26 }); // the camera follows the player in the game: keep both on screen
    const a = find('archer');
    let n = -1;
    for (let i = 0; i < 400 && n < 0; i++) {
      if (Math.hypot(a.position.x - P.position.x, a.position.z - P.position.z) > 1.2) placePlayer(a.position.x + 1.0, a.position.z);
      step(1);
      if (a.state === 'windup' && a.ai.move === 'shove') n = i;
    }
    check('archer: shove after the player stays within 1.6 u for 60 f', n >= 55, n);
    const hit = until(() => ps.hitLog.some((x) => x.uid === a.uid && x.source === 'enemy'), 60);
    check('archer: shove hits (sector r 1.2)', hit >= 0, hit);
    until(() => a.state === 'engage', 60);
    step(10);
    check('archer: retreats after the shove', a.ai.retreatT > 0);
    return stateSummary();
  },
  gore() {
    load('boar');
    const b = find('boar');
    placePlayer(b.position.x + 1.6, b.position.z);
    const n = until({ who: 'boar', state: 'windup', minF: 12 }, 300);
    const sector = [...core.markers.values()].find((m) => m.spec.shape === 'sector');
    check('boar: Gore at d ≤ 2 with a sector marker (r 1.6, ±45°)', n >= 0 && b.ai.move === 'gore' && sector && sector.spec.halfAngle === 45, n);
    return stateSummary();
  },
  leash() {
    load('goblin');
    const g = find('goblin#0');
    until(() => g.state === 'engage', 60);
    playerSwing(g, 1, 0, 0, 20);
    // the player runs far away: after 3 s farther than leash + radius + 6 from home it goes home
    Object.assign(ps, { mode: 'path', path: [[34, 13.5], [34, 1.5], [48, 1.5]], speed: 6, loop: false });
    const ret = until(() => g.state === 'return', 900);
    check('leash: return when the player stays far from home', ret >= 0 && g.guarded && !g.aggro && !g.token, `${ret} ${g.state}`);
    const hp0 = g.hp;
    step(20);
    check('return: guarded, regenerates 20 % max HP/s', g.hp > hp0 || g.hp === g.hpMax, `${hp0} → ${g.hp}`);
    const home = until(() => g.state === 'idle', 900);
    check('return: at home → idle, full HP', home >= 0 && g.hp === g.hpMax && !g.guarded, `${home} ${g.hp}`);
    return stateSummary();
  },
  unreachable() {
    load('goblin');
    const g = find('goblin#0');
    // the player stands still on the ledge (1 u up) above a goblin: no footsteps lead there, the
    // path search does (the stairs at x 36–38)
    g.home.x = 38.5;
    g.home.z = 13.5;
    g.reset(core.ctx);
    find('goblin#1').die(core.ctx);
    placePlayer(33.5, 8.5);
    setView('ledge');
    g.wake(core.ctx);
    const up = until(() => g.position.y > 1.9 && Math.hypot(g.position.x - P.position.x, g.position.z - P.position.z) < 3.6, 900);
    check('path: a goblin reaches a player standing still on the ledge (up the stairs)', up >= 0 && g.aggro, `${up} ${g.state} y=${g.position.y.toFixed(2)}`);
    // the same with the stairs walled off: no way up — it gives up at once (return, calm)
    load('goblin');
    const g2 = find('goblin#0');
    g2.home.x = 38.5;
    g2.home.z = 13.5;
    g2.reset(core.ctx);
    find('goblin#1').die(core.ctx);
    const wall = tileMap.addCollider({ type: 'box', minX: 35.6, maxX: 38.4, minZ: 9.8, maxZ: 12.2 });
    nav.build(navBlocked);
    try {
      placePlayer(33.5, 8.5);
      setView('ledge');
      g2.wake(core.ctx);
      // (it stands at home: the return ends in the same sub-step)
      const gave = until(() => g2.state !== 'notice' && !g2.aggro && g2._calmT > 0, 900);
      check('path: no way up (stairs walled off) — it gives up at once (home, calm)', gave >= 0 && gave < 60 && !g2.unreachable, `${gave} ${g2.state}`);
      step(120);
      check('path: … and stays calm at home (sight aggro suppressed)', !g2.aggro && (g2.state === 'idle' || g2.state === 'return') && Math.hypot(g2.position.x - g2.home.x, g2.position.z - g2.home.z) < g2.homeRadius + 0.5, `${g2.state}`);
      // the player within touch range (< 3 u) of the home, on the unreachable ledge above it: one
      // notice, then calm — no notice → give up → return loop every ≈ 1.25 s (code review)
      load('goblin');
      const g3 = find('goblin#0');
      g3.home.x = 33.5;
      g3.home.z = 11.5;
      g3.reset(core.ctx);
      find('goblin#1').die(core.ctx);
      placePlayer(33.5, 9.3);
      let notices = 0;
      let prev = g3.state;
      for (let f = 0; f < 600; f++) {
        step(1);
        if (g3.state === 'notice' && prev !== 'notice') notices++;
        prev = g3.state;
      }
      check('path: a player in touch range on the unreachable ledge above its home — one notice in 10 s, then calm', notices === 1 && !g3.aggro && g3._calmT > 0, `notices ${notices} ${g3.state}`);
    } finally {
      tileMap.removeCollider(wall);
      nav.build(navBlocked);
    }
    return stateSummary();
  },

  /**
   * A player at the edge of the ledge (1 u up), within a goblin's wind-up range from the floor
   * below: out of melee reach, so the goblin does not wind up under the cliff — it takes the
   * stairs and reaches the player's level (COMBAT-06, play review: the ledge edge was a safe spot).
   */
  ledgeEdge() {
    load('goblin');
    const g = find('goblin#0');
    g.home.x = 33.5;
    g.home.z = 12.0;
    g.reset(core.ctx);
    find('goblin#1').die(core.ctx);
    placePlayer(33.5, 9.3);
    setView('ledge');
    g.wake(core.ctx);
    let low = 0;
    let prev = g.state;
    const up = until(() => {
      if (g.state === 'windup' && prev !== 'windup' && P.position.y - g.position.y > 0.6) low++;
      prev = g.state;
      return Math.abs(g.position.y - P.position.y) < 0.3 && Math.hypot(g.position.x - P.position.x, g.position.z - P.position.z) < 2;
    }, 400);
    check('ledge edge: the goblin below takes the stairs to the player (no wind-up under the cliff)', up >= 0 && low === 0 && g.aggro, `${up} low wind-ups ${low} ${g.state} y=${g.position.y.toFixed(2)}`);
    return stateSummary();
  },

  /**
   * A goblin that chased the player up the stairs onto the ledge walks home the same way — along
   * a path, not a straight line into the ledge wall and no snap (COMBAT-18).
   */
  returnPath() {
    tests.stairs();
    const g = find('goblin');
    // sent home from the ledge's east end: the straight line home runs into the ledge wall
    Object.assign(ps, { mode: 'stand' });
    g.position.set(45, g.position.y, 4);
    g.sendHome(core.ctx);
    check('return: the ledge chaser goes home', g.state === 'return' && g.position.y > 1.9, `${g.state} y ${g.position.y.toFixed(2)}`);
    let snaps = 0;
    let lastX = g.position.x;
    let lastZ = g.position.z;
    let maxStep = 0;
    const home = until(() => {
      const d = Math.hypot(g.position.x - lastX, g.position.z - lastZ);
      if (d > 0.5) snaps++;
      maxStep = Math.max(maxStep, d);
      lastX = g.position.x;
      lastZ = g.position.z;
      return g.state === 'idle';
    }, 1200);
    check('return: walks home down the stairs along a path (no snap, no fade)', home >= 0 && snaps === 0 && g.sprite.opacity === 1 && Math.abs(g.position.y - 1.0) < 0.05, `${home} snaps ${snaps} max ${maxStep.toFixed(3)} y ${g.position.y.toFixed(2)}`);
    return stateSummary();
  },

  /**
   * Zones (COMBAT-19): the group wake stays in the waker's zone; a chaser turns back at its zone's
   * edge (+3 u) and is not sight-aggroed by a player outside it.
   */
  zones() {
    load('goblin');
    const a = find('goblin#0');
    const b = find('goblin#1');
    // two lone goblins 2 u apart in different zones (the zone line at z 14.5)
    a.groupId = 'za';
    b.groupId = 'zb';
    a.zone = 0;
    a.zoneRect = { minX: 0, maxX: 50, minZ: 0, maxZ: 14.5 };
    b.zone = 1;
    b.zoneRect = { minX: 0, maxX: 50, minZ: 14.5, maxZ: 40 };
    a.wake(core.ctx);
    core.wakeGroup(a);
    step(2);
    check('zones: a notice does not wake a goblin of another zone 2 u away', a.aggro && !b.aggro, `${a.state} ${b.state}`);
    // a's zone is x < 20: the player runs east out of it (+3 u); a turns back within ~1 s
    a.zoneRect = { minX: 0, maxX: 20, minZ: 0, maxZ: 40 };
    Object.assign(ps, { mode: 'path', path: [[34, 13.5]], speed: 5, loop: false });
    const back = until(() => a.state === 'return', 600);
    check('zones: the chaser goes home once the player left its zone (+3 u)', back >= 0 && a.position.x < 20 + 3 + 0.5, `${back} x ${a.position.x.toFixed(2)}`);
    // b never sight-aggroes a player standing outside its zone (+3 u)
    load('goblin');
    const c = find('goblin#1');
    find('goblin#0').die(core.ctx);
    c.zone = 1;
    c.zoneRect = { minX: 0, maxX: 50, minZ: 18, maxZ: 40 };
    placePlayer(7.5, 9.5);
    step(120);
    check('zones: no sight aggro on a player outside the zone (+3 u)', !c.aggro, c.state);
    return stateSummary();
  },
  death() {
    load('slime');
    const s = find('slime#0');
    const b0 = count('burst', 'gooPoof');
    playerSwing(s, 1, 0, 0, 999);
    check('death: dead state, not targetable, gooPoof 12 at once', s.state === 'dead' && !s.targetable && count('burst', 'gooPoof') === b0 + 1);
    step(31);
    check('death: 30 f dither fade to opacity 0', s.sprite.opacity === 0, s.sprite.opacity);
    load('bat');
    const b = find('bat#0');
    step(2);
    playerSwing(b, 1, 0, 0, 999);
    step(6);
    check('death: a bat falls toward the ground first', b.hover < 1.2 && b.sprite.opacity === 1, `${b.hover.toFixed(2)} ${b.sprite.opacity}`);
    step(40);
    check('death: bat faded, deathPoof', b.sprite.opacity === 0 && count('burst', 'deathPoof') >= 1);
    b.reset(core.ctx);
    check('reset: alive, idle, full HP, visible, no markers', b.alive && b.state === 'idle' && b.hp === b.hpMax && b.sprite.opacity === 1 && b.hazardCount === 0);
    return stateSummary();
  },
  bossBroken() {
    tests.boss();
    const g = find('golem');
    until(() => g.state === 'engage', 120);
    placePlayer(g.position.x, g.position.z + 2.4);
    Object.assign(ps, { mode: 'stand' });
    for (let i = 0; i < 26 && g.state !== 'stagger'; i++) playerSwing(g, 1, 10, 0, 5);
    check('boss: 250 poise spent → Broken (vuln 1.3, exposed)', g.state === 'stagger' && g.broken && g.vuln === 1.3 && g.exposed, g.state);
    step(181);
    check('boss: Broken 180 f, then poise refills', g.state !== 'stagger' && g.poise === g.poiseMax, `${g.state} ${g.poise}`);
    return stateSummary();
  },
  bossSweep() {
    tests.boss();
    const g = find('golem');
    until(() => g.state === 'engage', 120);
    Object.assign(g.ai.cd, { slam: 99, toss: 99, rain: 99, charge: 99 });
    g.ai.gap = 2;
    // stand behind it (> 70° off the facing, within 3.2 u) for 60 f
    Object.assign(ps, { mode: 'stand' });
    let n = -1;
    for (let i = 0; i < 400 && n < 0; i++) {
      placePlayer(g.position.x - g.facing.x * 2.4, g.position.z - g.facing.z * 2.4);
      step(1);
      if (g.state === 'windup' && g.ai.move === 'sweep') n = i;
    }
    check('boss: Sweep when the player lingers behind it for 60 f', n >= 0, n);
    step(20);
    return stateSummary();
  },
  bossAdds() {
    tests.boss();
    const g = find('golem');
    until(() => g.state === 'engage', 120);
    g.hp = Math.round(g.hpMax * 0.69);
    until(() => g.state === 'engage', 200);
    step(1);
    until(() => g.state === 'engage', 200);
    const first = core.adds.filter((a) => !a._pooled).length;
    g.hp = Math.round(g.hpMax * 0.51);
    step(2);
    const held = core.adds.filter((a) => !a._pooled).length;
    for (const a of core.adds) if (!a._pooled) a.die(core.ctx);
    step(2);
    const second = core.adds.filter((a) => a.alive && !a._pooled).length;
    step(2);
    for (const a of core.adds) if (a.alive && !a._pooled) a.die(core.ctx);
    step(2);
    const third = core.adds.filter((a) => a.alive && !a._pooled).length;
    check('boss: ≤ 52 % with < 2 adds alive → 3 more adds, once', first === 3 && held === 3 && second === 3 && third === 0, `${first} ${held} ${second} ${third}`);
    return stateSummary();
  },
  determinism() {
    const run = (seed) => {
      load('mix', seed);
      step(900);
      return dump();
    };
    const a = run(7);
    const b = run(7);
    const c = run(8);
    check('determinism: same seed + steps → identical state dump', a === b, `${a.length} chars`);
    check('determinism: another seed differs', a !== c);
    return `dump ${a.length} chars, equal ${a === b}`;
  },
  perf() {
    load('perf');
    step(120);
    const t0 = performance.now();
    const N = 600;
    step(N);
    const ms = (performance.now() - t0) / N;
    const aggro = core.enemies.filter((e) => e.aggro).length;
    check('perf: 30 enemies, enemy + mock core step', ms < 2.0, `${ms.toFixed(3)} ms/step, ${aggro} aggro`);
    return `${ms.toFixed(3)} ms per sub-step (30 enemies, ${aggro} aggro)`;
  },
};

/**
 * Run tests (default: all) in order.
 * @param {string[]} [names]
 * @returns {string[]} every failed check so far, with its detail
 */
function runAll(names = Object.keys(tests)) {
  const out = {};
  for (const n of names) {
    try {
      out[n] = tests[n]();
    } catch (err) {
      check(`${n}: threw`, false, err.message);
      console.error(err);
    }
  }
  return results.filter((r) => !r.ok).map((r) => `${r.name} ${r.detail}`);
}

// -------------------------------------------------------------------------------------------------
// Render loop
// -------------------------------------------------------------------------------------------------

const labelsRoot = document.getElementById('labels');
const labelPool = [];
const _proj = new THREE.Vector3();

function drawOverlay() {
  dbg.begin();
  if (core.arena) {
    const r = core.arena.rect;
    drawShape({ shape: 'rect', x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2, w: r.maxX - r.minX, d: r.maxZ - r.minZ }, COL.arena, 0.08);
  }
  for (const [, m] of core.markers) {
    const s = m.spec;
    const c = s.style === 'magma' ? COL.magma : (s.progress ?? 0) >= 1 ? COL.enemyFull : COL.enemy;
    drawShape(s, c, 0.07, s.progress ?? 1);
  }
  for (const hb of core.hitboxes) drawShape(hb.s, COL.hit, 0.12);
  for (const q of core.projectiles) {
    const l = q.arc ? 0.4 : 0.7;
    dbg.seg(q.x - (q.dirX ?? 0) * l, q.y, q.z - (q.dirZ ?? 0) * l, q.x, q.y, q.z, COL.proj);
    dbg.seg(q.x, q.y - 0.15, q.z, q.x, q.y + 0.15, q.z, COL.proj);
    if (q.fx >= 0) {
      fxq.set(q.fx, { x: q.x, y: q.y, z: q.z, frame: q.kind === 'boulder' ? 'boulder' : 'arrow', mode: q.kind === 'boulder' ? 'billboard' : 'flat', dirX: q.dirX, dirZ: q.dirZ, r: 1.6, g: 1.2, b: 0.8, a: 1 });
    }
  }
  dbg.circle(P.position.x, P.position.z, P.radius, COL.player, 0.05);
  dbg.end();
}

function drawLabels() {
  const list = core.enemies.filter((e) => !e._pooled && e.sprite.opacity > 0.01);
  while (labelPool.length < list.length) {
    const el = document.createElement('div');
    el.className = 'elabel';
    labelsRoot.appendChild(el);
    labelPool.push(el);
  }
  labelPool.forEach((el, i) => {
    const e = list[i];
    if (!e) {
      el.style.display = 'none';
      return;
    }
    _proj.set(e.position.x, e.position.y + e.def.labelY + (e.flier ? 0 : 0), e.position.z).project(camera);
    el.style.display = _proj.z < 1 ? 'block' : 'none';
    el.style.transform = `translate(${((_proj.x + 1) / 2) * innerWidth}px, ${((1 - _proj.y) / 2) * innerHeight}px) translate(-50%, -100%)`;
    el.className = `elabel ${e.state}`;
    el.textContent = `${e.kind}${e.elite ? '*' : ''} ${e.state}${e.state === 'windup' || e.state === 'active' ? ` ${Math.round(e.t * 60)}f` : ''}${e.boss ? ` P${e.phase}` : ''}`;
  });
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) {
    const n = Math.max(1, Math.ceil(dt * 60 - EPS));
    for (let i = 0; i < n; i++) core.step(dt / n);
  }
  globalUniforms.uTime.value += dt;
  for (const e of core.enemies) e.sprite.update(paused ? 0 : dt, camera);
  playerSprite.update(paused ? 0 : dt, camera);
  drawOverlay();
  markers.update();
  fxq.update();
  particles.update(dt, camera);
  renderer.render(scene, camera);
  drawLabels();
  document.getElementById('stats').textContent =
    `frame ${core.ctx.frame}${paused ? ' (paused)' : ''} · player hp ${ps.hp} hits ${ps.hits} · tokens m${core.tokens.melee}/r${core.tokens.ranged}`
    + ` · markers ${core.markers.size} · projectiles ${core.projectiles.length}${core.offscreen ? ' · onScreen=false' : ''}\n${stateSummary()}`;
  document.getElementById('log').textContent = core.logLines.slice(-22).join('\n');
}

setView('overview');
load('roster');
requestAnimationFrame(frame);

/**
 * `window.__sb` on enemy_ai.html (AUTOMATION_API.md §7), read by sandbox/enemy_ai.actions.json.
 * @typedef {object} EnemyAiHandle
 * @property {typeof THREE} THREE
 * @property {THREE.Scene} scene
 * @property {THREE.PerspectiveCamera} camera
 * @property {THREE.WebGLRenderer} renderer
 * @property {TileMap} tileMap
 * @property {MockCore} core  the mock combat core (enemies, adds, projectiles, markers, ctx …)
 * @property {PlayerView} P  the fake player's PlayerView
 * @property {typeof ps} ps  the fake player's script state (mode, path, speed, hp, hits …)
 * @property {GroundMarkers} markers
 * @property {FxQuads} fxq
 * @property {Particles} particles
 * @property {typeof tests} tests  the stepped tests by name
 * @property {typeof load} load
 * @property {typeof step} step
 * @property {typeof until} until
 * @property {typeof find} find
 * @property {typeof check} check
 * @property {typeof dump} dump
 * @property {typeof runAll} runAll
 * @property {typeof setView} view
 * @property {(on?: boolean) => boolean} pause  stop / resume the render loop's stepping
 * @property {(on?: boolean) => boolean} offscreen  ctx.onScreen() answers false while on
 * @property {(o?: { x?: number, z?: number, script?: object }) => { x: number, z: number,
 *   hp: number }} player  place the player and / or merge `script` into `ps`
 * @property {(uid: string, dmg?: number, poise?: number, kb?: number) => string} hit  a scripted
 *   player swing; returns the enemy's state
 * @property {(q: string) => object} enemy  uid, state, t, hp, position and brain state of one enemy
 * @property {() => string} state  one line per enemy
 * @property {(type?: string) => object[]} events  the core's events (of one type)
 * @property {() => typeof results} results  every check
 * @property {() => typeof results} failures  the failed checks
 * @property {() => string} assertAll  throw asynchronously when a check failed; else a pass count
 */
window.__sb = {
  THREE, scene, camera, renderer, tileMap, core, P, ps, markers, fxq, particles, tests, results,
  load, step, until, find, check, dump, runAll,
  view: setView,
  pause(on = true) { paused = !!on; return paused; },
  offscreen(on = true) { core.offscreen = !!on; return core.offscreen; },
  player(o = {}) {
    if (o.x !== undefined) placePlayer(o.x, o.z);
    Object.assign(ps, o.script ?? {});
    return { x: P.position.x, z: P.position.z, hp: ps.hp };
  },
  hit(uid, dmg = 10, poise = 10, kb = 0.5) { const e = find(uid); if (e) playerSwing(e, 1, poise, kb, dmg); return e?.state; },
  enemy(q) { const e = find(q); return e && { uid: e.uid, state: e.state, t: e.t, hp: e.hp, x: e.position.x, y: e.position.y, z: e.position.z, ai: e.ai }; },
  state: () => stateSummary(),
  events: (type) => core.events.filter((ev) => !type || ev.type === type),
  // @ts-expect-error duplicate key: this function replaces the `results` array listed above (dead)
  results: () => results,
  failures: () => results.filter((r) => !r.ok),
  /** Throw asynchronously (→ harness page error, exit 1) when any check failed. */
  assertAll() {
    const bad = results.filter((r) => !r.ok);
    if (bad.length) setTimeout(() => { throw new Error(`[enemy_ai] ${bad.length} check(s) failed: ${bad.map((b) => b.name).join('; ')}`); });
    return `${results.length - bad.length}/${results.length} passed`;
  },
};
