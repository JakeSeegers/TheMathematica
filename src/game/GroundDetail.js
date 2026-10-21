import * as THREE from 'three';
import { Foliage } from '../engine/sprite/Foliage.js';
import { createPropSprite } from '../engine/pixel/PropSprites.js';
import { makePixelTexture } from '../engine/pixel/PixelCanvas.js';
import { RNG, fbm2 } from '../engine/utils/math.js';
import { kdSplitSteps } from '../engine/world/SpatialSplit.js';
import { runSteps } from '../engine/utils/steps.js';

/** @import { TileMap } from '../engine/world/TileMap.js' */

/**
 * Ground detail: deterministic Foliage fields (one instanced draw call each) of grass tufts, tall
 * grass, flowers, reeds, bushes, ferns, mushrooms and pebbles scattered over the terrain.
 *
 * Several PropSprites kinds of similar size are packed into one horizontal atlas strip so a whole
 * family (e.g. four flower colours) is a single Foliage with per-instance frames.
 */

/**
 * Pack prop sprites into one strip of equal cells (each sprite bottom-centred in its cell).
 * @param {{kind: string, seed?: number}[]} list
 * @returns {{ texture: THREE.Texture, width: number, height: number, pixelsPerUnit: number,
 *             anchor: [number, number], frames: number }}
 */
export function makeSpriteStrip(list) {
  const sprites = list.map(({ kind, seed }) => createPropSprite(kind, { seed }));
  const cw = Math.max(...sprites.map((s) => s.frameWidth)) + 2;
  const ch = Math.max(...sprites.map((s) => s.frameHeight)) + 1;
  const canvas = document.createElement('canvas');
  canvas.width = cw * sprites.length;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  sprites.forEach((s, i) => {
    const dx = i * cw + Math.floor((cw - s.frameWidth) / 2);
    const dy = ch - s.frameHeight;
    ctx.drawImage(s.canvas, 0, 0, s.frameWidth, s.frameHeight, dx, dy, s.frameWidth, s.frameHeight);
    s.dispose();
  });
  const texture = makePixelTexture(canvas, { wrap: 'clamp', mipmaps: false, srgb: true, name: 'foliage-strip' });
  return { texture, width: cw, height: ch, pixelsPerUnit: 16, anchor: [0.5, 0], frames: sprites.length };
}

const GRASSY = new Set(['g', 'G', 'f']);

/** Flower frames outside any `flowerAreas` zone (yellow, white, blue). */
const DEFAULT_FLOWERS = [1, 2, 3, 1, 2];

/**
 * Build every foliage field for the map.
 * @param {{ tileMap: TileMap, isFree: (x:number, z:number) => boolean, seed?: number,
 *           houses?: {minX:number, maxX:number, minZ:number, maxZ:number, door?: {x:number, z:number}|null}[],
 *           trees?: {x:number, z:number, r?:number}[], clearings?: {x:number, z:number, r:number}[],
 *           flowerAreas?: {minX:number, maxX:number, minZ:number, maxZ:number, palette:number[]}[],
 *           shrubAreas?: {minX:number, maxX:number, minZ:number, maxZ:number, chance:number}[],
 *           maxInstances?: number }} ctx
 *   `isFree` rejects spots under props / houses (collider test); `houses` (footprint boxes) and
 *   `trees` (trunks) get accent bushes and ferns hugging their walls and roots. Inside
 *   `clearings` (e.g. where villagers stand) only short grass grows: no tall grass, flowers or
 *   bushes that would swallow a character's legs. The random sequence is unchanged, so the rest of
 *   the map keeps its exact layout.
 *   Tile-space zones (tile (i, j) is inside when minX ≤ i < maxX and minZ ≤ j < maxZ; first match
 *   wins): `flowerAreas` pick the flower colours there (frames 0 red, 1 yellow, 2 white, 3 blue;
 *   default [1, 2, 3, 1, 2]), `shrubAreas` raise the bush / fern chance on open grass (default 0.05).
 *   `maxInstances` (big levels; default Infinity = one instanced mesh per field): a field with
 *   more tufts is cut into spatially compact instanced meshes of at most this many (k-d split),
 *   so the camera and the shadow pass cull what they cannot see. The placement is unchanged; only
 *   the per-tuft brightness jitter differs from the unsplit field.
 * @returns {{ fields: Foliage[], object: THREE.Group, stats: Record<string, number>,
 *   dispose(): void }}
 */
export function buildGroundDetail(ctx) {
  return runSteps(groundDetailSteps(ctx));
}

/**
 * {@link buildGroundDetail} as a step generator (src/engine/utils/steps.js): a step per 32 tiles
 * scattered, per k-d split step and per field made. Run to its end it returns what
 * buildGroundDetail returns.
 * @param {Parameters<typeof buildGroundDetail>[0]} ctx
 * @returns {Generator<undefined, ReturnType<typeof buildGroundDetail>>}
 */
export function* groundDetailSteps({ tileMap, isFree, seed = 2024, houses = [], trees = [], clearings = [], flowerAreas = [], shrubAreas = [], maxInstances = Infinity }) {
  const rng = new RNG(seed);
  const group = new THREE.Group();
  group.name = 'GroundDetail';

  const grass = [];
  const flowers = [];
  const reeds = [];
  const shrubs = [];

  const inClearing = (x, z) => {
    for (let k = 0; k < clearings.length; k++) {
      const c = clearings[k];
      if ((x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return true;
    }
    return false;
  };

  const zone = (areas, i, j) => {
    for (let k = 0; k < areas.length; k++) {
      const a = areas[k];
      if (i >= a.minX && i < a.maxX && j >= a.minZ && j < a.maxZ) return a;
    }
    return null;
  };
  const near = (i, j, pred) => {
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const t = tileMap.tileAt(i + di, j + dj);
        if (t && pred(t)) return true;
      }
    }
    return false;
  };

  const scatterTile = (i, j, t) => {
    const ch = t.char;
    const y = t.h;
    const forest = ch === 'T';
    if (GRASSY.has(ch) || forest) {
      // meadow clumps: fbm mask controls tall grass / flower density so fields read as patches
      const clump = fbm2(i * 0.23, j * 0.23, { seed: seed + 1, octaves: 3 });
      const nTuft = forest ? 2 : 3 + (clump > 0.55 ? 2 : 0);
      for (let k = 0; k < nTuft; k++) {
        const x = i + rng.next();
        const z = j + rng.next();
        if (!forest && !isFree(x, z)) continue;
        const tall = clump > 0.58 && rng.chance(0.45);
        const scale = rng.range(0.7, 1.05);
        const tint = rng.chance(0.25) ? '#e2f2a8' : forest ? '#b8c8a0' : '#ffffff';
        const open = !forest && inClearing(x, z);
        grass.push({ x, y, z, scale: open ? scale * 0.75 : scale, frame: tall && !open ? 1 : 0, tint });
      }
      // flowers: dense on flowery tiles, sprinkled elsewhere
      const nFlower = forest ? 0 : ch === 'f' ? 3 : clump > 0.6 ? 1 : rng.chance(0.25) ? 1 : 0;
      const palette = zone(flowerAreas, i, j)?.palette ?? DEFAULT_FLOWERS;
      for (let k = 0; k < nFlower; k++) {
        const x = i + rng.next();
        const z = j + rng.next();
        if (!isFree(x, z)) continue;
        const scale = rng.range(0.75, 1.0);
        const frame = palette[rng.int(0, palette.length - 1)];
        if (!inClearing(x, z)) flowers.push({ x, y, z, scale, frame });
      }
      // shrubs: bushes / ferns in the forest border, along cliff bases and the grove; mushrooms in shade
      const shrubChance = forest ? 0.55 : zone(shrubAreas, i, j)?.chance ?? 0.05;
      if (rng.chance(shrubChance)) {
        const x = i + rng.range(0.15, 0.85);
        const z = j + rng.range(0.15, 0.85);
        if (forest || isFree(x, z)) {
          const r = rng.next();
          const frame = r < 0.45 ? 0 : r < 0.85 ? 1 : 2;
          const scale = rng.range(0.8, 1.2);
          if (forest || !inClearing(x, z)) shrubs.push({ x, y, z, scale, frame });
        }
      }
      if (!forest && rng.chance(0.035)) {
        const x = i + rng.next();
        const z = j + rng.next();
        if (isFree(x, z)) shrubs.push({ x, y, z, scale: rng.range(0.8, 1.1), frame: 3 });
      }
    } else if (ch === 's') {
      // reeds on sand banks next to water, pebbles elsewhere on the sand
      const wet = near(i, j, (n) => n.water);
      const n = wet ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const x = i + rng.next();
        const z = j + rng.next();
        if (!isFree(x, z)) continue;
        if (wet && rng.chance(0.7)) reeds.push({ x, y, z, scale: rng.range(0.75, 1.1) });
        else shrubs.push({ x, y, z, scale: rng.range(0.7, 1.0), frame: 3 });
      }
    } else if (ch === 'F') {
      // a few weeds between the furrows
      if (rng.chance(0.3)) grass.push({ x: i + rng.next(), y, z: j + rng.next(), scale: rng.range(0.55, 0.75), frame: 0, tint: '#d8e4a0' });
    } else if (ch === 'd' || ch === '.') {
      // path edges: sparse tufts
      if (rng.chance(0.12)) {
        const x = i + rng.next();
        const z = j + rng.next();
        if (isFree(x, z)) grass.push({ x, y, z, scale: rng.range(0.5, 0.7), frame: 0, tint: '#d8e0a0' });
      }
    } else if (ch === 'm') {
      if (rng.chance(0.35)) shrubs.push({ x: i + rng.next(), y, z: j + rng.next(), scale: rng.range(0.7, 1), frame: rng.chance(0.5) ? 1 : 3 });
    }
  };
  // (tileMap.forEachTile's order: row by row, void tiles skipped)
  for (let j = 0; j < tileMap.depth; j++) {
    for (let i = 0; i < tileMap.width; i++) {
      const t = tileMap.tileAt(i, j);
      if (t) scatterTile(i, j, t);
      if ((i & 31) === 31) yield;
    }
    yield;
  }

  // ---- accents: bushes along house walls (not in front of doors), ferns around tree roots ----
  const grassyAt = (x, z) => {
    const t = tileMap.tileAt(Math.floor(x), Math.floor(z));
    return t && GRASSY.has(t.char) ? t : null;
  };
  const accent = (x, z, frame, scale) => {
    const t = grassyAt(x, z);
    if (!t || !isFree(x, z) || inClearing(x, z)) return false;
    shrubs.push({ x, y: t.h, z, scale, frame });
    return true;
  };
  for (const b of houses) {
    const edges = [
      [b.minX, b.maxZ, b.maxX, b.maxZ, 0, 1], [b.minX, b.minZ, b.maxX, b.minZ, 0, -1],
      [b.minX, b.minZ, b.minX, b.maxZ, -1, 0], [b.maxX, b.minZ, b.maxX, b.maxZ, 1, 0],
    ];
    for (const [x0, z0, x1, z1, nx, nz] of edges) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / 0.95));
      for (let k = 0; k < n; k++) {
        if (!rng.chance(0.62)) continue;
        const u = (k + rng.range(0.2, 0.8)) / n;
        const off = rng.range(0.28, 0.55);
        const x = x0 + (x1 - x0) * u + nx * off;
        const z = z0 + (z1 - z0) * u + nz * off;
        if (b.door && Math.hypot(x - b.door.x, z - b.door.z) < 1.25) continue;
        const r = rng.next();
        accent(x, z, r < 0.62 ? 0 : 1, rng.range(0.75, 1.1));
      }
    }
  }
  for (const t of trees) {
    const n = rng.int(1, 3);
    for (let k = 0; k < n; k++) {
      const a = rng.range(0, Math.PI * 2);
      const d = (t.r ?? 0.3) + rng.range(0.35, 0.8);
      accent(t.x + Math.cos(a) * d, t.z + Math.sin(a) * d, rng.chance(0.6) ? 1 : 0, rng.range(0.7, 1.05));
    }
  }

  const fields = [];
  /** @returns {Generator<undefined, Foliage[]>} */
  const add = function* (name, sprite, instances, opts = {}) {
    if (!instances.length) return [];
    const groups = instances.length > maxInstances
      ? yield* kdSplitSteps(instances, { x: (it) => it.x, z: (it) => it.z, maxWeight: maxInstances })
      : [instances];
    const parts = groups.map((list, k) => [groups.length > 1 ? `${name}#${k}` : name, list]);
    const made = [];
    for (const [n, list] of parts) {
      const f = new Foliage({ sprite, instances: list, name: n, seed: seed + fields.length, ...opts });
      group.add(f.object);
      fields.push(f);
      made.push(f);
      yield;
    }
    return made;
  };
  const grassStrip = makeSpriteStrip([{ kind: 'grass_tuft' }, { kind: 'grass_tall' }]);
  const flowerStrip = makeSpriteStrip([{ kind: 'flower_red' }, { kind: 'flower_yellow' }, { kind: 'flower_white' }, { kind: 'flower_blue' }]);
  const shrubStrip = makeSpriteStrip([{ kind: 'bush' }, { kind: 'fern' }, { kind: 'mushroom' }, { kind: 'rock_small' }]);
  const reedSprite = createPropSprite('reeds');
  yield;

  yield* add('Foliage:grass', grassStrip, grass, { wind: 1.0 });
  yield* add('Foliage:flowers', flowerStrip, flowers, { wind: 1.1 });
  yield* add('Foliage:reeds', reedSprite, reeds, { wind: 1.4 });
  const shrubFields = yield* add('Foliage:shrubs', shrubStrip, shrubs, { wind: 0.5, rootDarken: 0.25 });
  for (const sh of shrubFields) sh.castShadow = true;

  return {
    fields,
    object: group,
    stats: { grass: grass.length, flowers: flowers.length, reeds: reeds.length, shrubs: shrubs.length },
    dispose() {
      for (const f of fields) f.dispose();
      grassStrip.texture.dispose();
      flowerStrip.texture.dispose();
      shrubStrip.texture.dispose();
      reedSprite.dispose();
    },
  };
}
