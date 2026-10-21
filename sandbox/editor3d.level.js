/**
 * Procedural test level for the 3D viewport sandbox: a 64×64 valley with a plateau, an upper
 * stream falling into a river (waterfall), a cobbled plaza, farmland, stairs, and ~200 objects of
 * every catalog type (props, lights, NPCs, critters, particle areas, regions).
 */
import { createEmptyLevel, setTile, setHeightLevel, getTile, getHeightLevel, addObject } from '../src/engine/level/LevelFormat.js';
import { RNG, fbm2 } from '../src/engine/utils/math.js';

/** @import { Level } from '../src/engine/level/types.js' */

/** @param {{ width?: number, depth?: number, seed?: number }} [opts] @returns {Level} level */
export function generateTestLevel({ width = 64, depth = 64, seed = 7 } = {}) {
  const level = createEmptyLevel({ name: 'Test Vale', width, depth, fill: 'g', level: 2, border: 3 });
  level.subtitle = 'Viewport sandbox';
  const rng = new RNG(seed);
  const W = width;
  const D = depth;
  const set = (i, j, t, h) => {
    if (i < 3 || j < 3 || i >= W - 3 || j >= D - 3) return;
    if (t != null) setTile(level, i, j, t);
    if (h != null) setHeightLevel(level, i, j, h);
  };
  const plateauZ = Math.round(D * 0.25); // north plateau: z < plateauZ
  const riverX = (z) => Math.round(W * 0.62 + Math.sin(z * 0.11) * 4);

  // ---- base ground: dark grass / flowers patches, gentle south-east hill
  for (let j = 3; j < D - 3; j++) {
    for (let i = 3; i < W - 3; i++) {
      const n = fbm2(i * 0.09, j * 0.09, { octaves: 3, seed: seed + 1 });
      if (n > 0.62) set(i, j, 'G');
      else if (n < 0.32) set(i, j, 'f');
      const hill = fbm2(i * 0.05 + 3, j * 0.05 + 9, { octaves: 2, seed: seed + 2 });
      if (i > W * 0.7 && j > D * 0.55) set(i, j, null, 2 + Math.max(0, Math.round((hill - 0.35) * 8)));
    }
  }
  // ---- north plateau (level 6) with an upper stream
  for (let j = 3; j < plateauZ; j++) for (let i = 3; i < W - 3; i++) set(i, j, j < 6 ? 'G' : 'g', 6 + (i < 12 && j < 10 ? 2 : 0));
  // ---- river: upper stream on the plateau, waterfall, lower river down to the south edge
  for (let j = 3; j < D - 3; j++) {
    const cx = riverX(j);
    for (let i = cx - 1; i <= cx + 1; i++) {
      if (j < plateauZ) set(i, j, j === plateauZ - 1 ? 'w' : '~', 5);
      else set(i, j, j < plateauZ + 2 ? 'p' : '~', 0);
    }
    if (j >= plateauZ + 2) { set(cx - 2, j, 's', 2); set(cx + 2, j, 's', 2); }
  }
  // pond (still water) in the west meadow
  for (let j = 38; j < 43; j++) for (let i = 5; i < 11; i++) if ((i - 8) ** 2 / 9 + (j - 40.5) ** 2 / 6.25 < 1) set(i, j, 'o', 1);
  // ---- stairs from the valley to the plateau (4 levels up, rising north)
  for (let k = 0; k < 4; k++) for (const i of [20, 21]) set(i, plateauZ + 3 - k, '^', 2 + k);
  for (let j = plateauZ + 4; j < plateauZ + 6; j++) for (const i of [20, 21]) set(i, j, '.', 2);
  // ---- plaza (cobblestone) and paths
  const plaza = { minI: 14, maxI: 27, minJ: 30, maxJ: 40 };
  for (let j = plaza.minJ; j <= plaza.maxJ; j++) for (let i = plaza.minI; i <= plaza.maxI; i++) set(i, j, 'c', 2);
  for (let j = plateauZ + 4; j < plaza.minJ; j++) for (const i of [20, 21]) set(i, j, '.');
  const bridgeZ = 36;
  for (let i = plaza.maxI + 1; i < riverX(bridgeZ) - 2; i++) for (const j of [bridgeZ, bridgeZ + 1]) set(i, j, '.');
  for (let i = riverX(bridgeZ) + 3; i < W - 6; i++) for (const j of [bridgeZ, bridgeZ + 1]) set(i, j, '.');
  for (let j = plaza.maxJ + 1; j < D - 4; j++) for (const i of [18, 19]) set(i, j, '.');
  // ---- farmland (south-west)
  for (let j = 46; j < 56; j++) for (let i = 5; i < 15; i++) set(i, j, (i % 3 === 0) ? 'd' : 'F');
  // plateau cliff path decoration: mossy stones
  for (let i = 30; i < 36; i++) for (let j = 8; j < 11; j++) set(i, j, 'm');

  const tileAt = (x, z) => getTile(level, Math.floor(x), Math.floor(z));
  const hAt = (x, z) => getHeightLevel(level, Math.floor(x), Math.floor(z));
  const free = new Set();
  const occupy = (x, z, r) => {
    for (let j = Math.floor(z - r); j <= Math.floor(z + r); j++) for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++) free.add(`${i},${j}`);
  };
  const isFree = (x, z, r, tiles = 'gGf') => {
    for (let j = Math.floor(z - r); j <= Math.floor(z + r); j++) {
      for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++) {
        if (free.has(`${i},${j}`)) return false;
        const t = getTile(level, i, j);
        if (!t || !tiles.includes(t)) return false;
        if (getHeightLevel(level, i, j) !== hAt(x, z)) return false;
      }
    }
    return true;
  };
  const add = (type, x, z, o = {}, r = 0.6) => { occupy(x, z, r); return addObject(level, type, x, z, o); };

  // ---- houses around the plaza
  const walls = ['timber_frame', 'plaster', 'brick', 'stone_brick', 'log_wall'];
  const roofs = ['roof_red', 'roof_blue', 'roof_thatch', 'roof_slate'];
  const houseSpots = [
    [16, 27.5, 0], [22.5, 27.5, 0], [11, 32, Math.PI / 2], [11, 38.5, Math.PI / 2], [31.5, 31.5, -Math.PI / 2],
    [16, 44, Math.PI], [23, 44, Math.PI], [9, 24.5, 0.3], [30.5, 42.5, Math.PI], [28.5, 24, 0],
  ];
  houseSpots.forEach(([x, z, rot], k) => {
    add('house', x, z, {
      rotation: rot, name: `House ${k + 1}`, light: k % 3 === 0,
      opts: { width: 4 + (k % 3) * 0.5, depth: 3 + (k % 2) * 0.5, stories: k % 4 === 1 ? 2 : 1, wall: walls[k % walls.length], roof: roofs[k % roofs.length], sign: k === 2, woodpile: k % 3 === 1, seed: k + 1 },
    }, 3);
  });
  // plaza furniture
  add('well', 20.5, 35, { rotation: 0.4 }, 1.2);
  add('marketStall', 16.5, 33, { rotation: 0.2 }, 1.5);
  add('marketStall', 25, 32.5, { rotation: -0.25, opts: { cloth: 'cloth_red', width: 3 } }, 1.5);
  add('marketStall', 24.5, 38.5, { rotation: Math.PI + 0.2 }, 1.5);
  for (const [x, z] of [[14.5, 30.5], [26.5, 30.5], [14.5, 40.5], [26.5, 40.5], [20.5, 29.5], [20.5, 41.5], [29.5, 36.5], [36.5, 38.5]]) add('lamppost', x, z, { rotation: 0 }, 0.4);
  add('wallTorch', 16, 29.4, { rotation: 0 });
  add('wallTorch', 22.5, 29.4, { rotation: 0 });
  for (const [type, x, z, rot] of [['bench', 18, 37.5, 0], ['bench', 23, 37.5, 0], ['barrel', 13.5, 34.5, 0], ['barrel', 13.4, 35.4, 0.5], ['crate', 27.2, 34.7, 0.3],
    ['crateStack', 27.4, 36.2, 0], ['flowerbox', 17.5, 30.2, 0], ['signpost', 21.5, 42.5, 0.2], ['barrel', 26.7, 39.5, 0], ['crate', 13.6, 38.2, 0]]) {
    add(type, x, z, { rotation: rot }, 0.5);
  }
  // plateau: windmill, campfire, torch
  add('windmill', 10.5, 8.5, { rotation: 0.15, opts: { height: 6.2, roof: 'roof_red' } }, 2.5);
  add('campfire', 28.5, 12.5, { opts: { seat: true } }, 1.2);
  add('signpost', 23.5, plateauZ - 1.5, { rotation: 0, text: ['↑ Windmill Hill'] });
  add('light', 21, 44, { dy: 1.8, color: '#ffc27a', intensity: 6 });
  // bridge + waterfall
  const bx = riverX(bridgeZ);
  add('bridge', bx - 2.5, bridgeZ + 1, { x1: bx + 2.5 + 1, z1: bridgeZ + 1, opts: { width: 2, arch: 0.25 } }, 0);
  const bx2 = riverX(52);
  add('bridge', bx2 - 2.5, 52.5, { x1: bx2 + 3.5, z1: 52.5, opts: { width: 1.6, arch: 0.18 } }, 0);
  add('waterfall', riverX(plateauZ) + 0.5, plateauZ, { width: 3, facing: 'S' }, 0);
  // farm: fences + haystacks
  add('fence', 4.5, 45.5, { x1: 15.5, z1: 45.5 }, 0);
  add('fence', 4.5, 56.5, { x1: 15.5, z1: 56.5 }, 0);
  add('fence', 15.5, 45.5, { x1: 15.5, z1: 50 }, 0);
  add('fence', 15.5, 52, { x1: 15.5, z1: 56.5 }, 0);
  add('fence', riverX(30) - 2.5, 28, { x1: riverX(30) - 2.5, z1: 33 }, 0);
  for (const [x, z] of [[7, 48], [12, 53], [9, 50.5]]) add('haystack', x, z, {}, 1);
  // ---- trees (scattered on grass) and rocks
  const kinds = ['oak', 'oak', 'birch', 'pine', 'autumn'];
  let trees = 0;
  for (let tries = 0; tries < 4000 && trees < 120; tries++) {
    const x = Math.floor(rng.range(4, W - 4)) + 0.5 + rng.range(-0.2, 0.2);
    const z = Math.floor(rng.range(4, D - 4)) + 0.5 + rng.range(-0.2, 0.2);
    if (!isFree(x, z, 1)) continue;
    const t = tileAt(x, z);
    const kind = z < plateauZ ? rng.pick(['pine', 'pine', 'oak']) : t === 'G' ? rng.pick(['oak', 'autumn']) : rng.pick(kinds);
    add('tree', x, z, { opts: { kind, height: rng.range(3.6, 6), seed: trees + 1 } }, 1);
    trees++;
  }
  let rocks = 0;
  for (let tries = 0; tries < 600 && rocks < 12; tries++) {
    const x = Math.floor(rng.range(4, W - 4)) + 0.5;
    const z = Math.floor(rng.range(4, D - 4)) + 0.5;
    if (!isFree(x, z, 0.5, 'gGfsm')) continue;
    add('rock', x, z, { opts: { size: rng.range(0.6, 1.6), seed: rocks } }, 0.7);
    rocks++;
  }
  // ---- characters
  const npcs = [
    ['Elder Maren', 'elder', 20.5, 33.2, 'down'], ['Tomas', 'merchant', 16.5, 34.2, 'down'], ['Guard', 'guard', 21.5, 44.8, 'down'],
    ['Lina', 'child', 18.2, 36.4, 'left'], ['Farmer Bo', 'farmer', 10.5, 49.5, 'right'], ['Bard', 'bard', 27.5, 13.8, 'down'],
    ['Innkeeper', 'innkeeper', 23.5, 29.8, 'down'], ['Scholar', 'scholar', 34.5, 37.5, 'left'],
  ];
  for (const [name, preset, x, z, facing] of npcs) add('npc', x, z, { name, preset, facing, dialogue: [`Hello, I am ${name}.`] }, 0.3);
  add('critters', 9.5, 52, { kind: 'chicken', count: 5, radius: 2.4 });
  add('critters', 24.5, 35.5, { kind: 'bird', count: 4, radius: 2 });
  add('critters', 12.5, 36, { kind: 'cat', count: 1, radius: 2 });
  // ---- particle areas and regions
  add('emitter', 8, 40.5, { preset: 'fireflies', size: [8, 2.2, 7], count: 30, dy: 1.1 });
  add('emitter', 48, 50, { preset: 'leaves', size: [10, 3.5, 10], count: 30, dy: 2 });
  add('emitter', 30, 50, { preset: 'petals', size: [14, 3, 8], count: 30, dy: 1.6 });
  addObject(level, 'region', 0, 0, { name: 'Village Square', sub: 'Test Vale', minX: 14, maxX: 28, minZ: 30, maxZ: 41 });
  addObject(level, 'region', 0, 0, { name: 'Windmill Hill', minX: 3, maxX: 61, minZ: 3, maxZ: plateauZ });
  addObject(level, 'region', 0, 0, { name: 'Old Farm', minX: 4.5, maxX: 15.5, minZ: 45.5, maxZ: 56.5 });

  level.spawn = { x: 20.5, z: 38.5, facing: 'down' };
  level.environment = { ...level.environment, timeOfDay: 17.2 };
  return level;
}
