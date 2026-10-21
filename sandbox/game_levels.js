/**
 * Game ← level loading test cases. Each case builds a level with the LevelFormat helpers, saves it
 * to browser storage and opens it in the real game (`game.html?level=local:<slot>`), exactly like
 * the editor's play-test. `?case=<name>` runs one case straight away (used by the check harness);
 * without it the page lists the cases.
 *
 *   tiny        8×8 flat grass, no border, nothing placed, spawn in a corner
 *   bare        no forest border / outer scenery / god rays / dust, frozen noon clock
 *   wetspawn    the spawn stands in a pond (the game moves the player ashore)
 *   stormnight  rain at night, 14 light sources (over the 12-light budget), every NPC action
 *   everything  one of every object type, every particle preset, dogs and cats
 *   hamlet      public/levels/sample-hamlet.json copied into browser storage
 *   moved       Emberfall with the merchant / birds / chickens / child moved (object-relative
 *               talk point, chase area, yard and bird spots follow them)
 *   hostile     KNOWN_ISSUES LVL-17: a small valid level whose data carries Object.prototype
 *               names ("constructor", "__proto__", "toString" …) wherever a name is looked up in
 *               a table — raw objects of every such `type` (pushed straight into `objects`:
 *               createObject refuses them), legend tiles with such `stairs` / texture names,
 *               custom legend keys "constructor" / "__proto__", waterfall `facing`, tree /
 *               critter / enemy `kind`, NPC `preset` / `script` / `action` / `behaviour` /
 *               `facing` / `item` / `spec` colours, emitter `preset`, house / stall / well /
 *               windmill texture opts, house `door`, well `sfx`, environment `weather` /
 *               `border`, spawn `facing`. Each must act like any other unknown name: the load
 *               finishes, the bad types are skipped ("Unknown object type … skipped"), the
 *               custom legend keys are refused by the palette and painting ("Legend key … is not
 *               a single character"), the rest falls back. Also JSON objects with an own
 *               `toString` key (`{"toString": 1}`: String() / Number() throw on them) where the
 *               load converts a value — an object `type` / `id` / rect bound, `subtitle`,
 *               `version`, `waterLevel`, an extra tiles / heights row — and an array `type`;
 *               such values where the load used to keep them (LVL-18: a legend `top` / `riser`,
 *               an NPC `name` / `portraitColor`, a house `opts.roof`, environment `backdrop` /
 *               `title.title`: dropped, the defaults apply), and the colour names three.js
 *               resolves through Object.prototype (LVL-19: two `light` colours, a particle area's
 *               `color` / `colorEnd` / `colors`).
 *               sandbox/game_levels.hostile.json checks it in the game, then opens the same slot
 *               in the editor (particle preview on).
 */
import {
  createEmptyLevel, addObject, setTile, setHeightLevel,
} from '../src/engine/level/LevelFormat.js';
import { OBJECT_TYPES, EMITTER_PRESETS, CRITTER_KINDS } from '../src/engine/level/ObjectCatalog.js';
import { saveLocalLevel, loadProjectLevel } from '../src/engine/level/LevelStorage.js';

/** @import { ObjectType, TileDef } from '../src/engine/level/types.js' */

const fill = (level, i0, j0, i1, j1, ch, lvl) => {
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      if (ch != null) setTile(level, i, j, ch);
      if (lvl != null) setHeightLevel(level, i, j, lvl);
    }
  }
};

/**
 * Object.prototype member names a hand-written level could use as a name (KNOWN_ISSUES LVL-17;
 * the `hostile` case).
 */
export const HOSTILE_NAMES = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf',
  'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', '__defineGetter__', '__lookupGetter__'];

export const CASES = {
  tiny() {
    const L = createEmptyLevel({ name: 'Tiny', width: 8, depth: 8, border: 0 });
    L.spawn = { x: 0.4, z: 7.6, facing: 'up' };
    return L;
  },

  bare() {
    const L = createEmptyLevel({ name: 'Bare Field', width: 16, depth: 12, border: 1 });
    Object.assign(L.environment, { border: 'none', outerScenery: false, godRays: false, dust: false, clock: false, timeOfDay: 12, music: false });
    addObject(L, 'npc', 8.5, 5.5, { name: 'Lonely', dialogue: [] });
    L.spawn = { x: 8.5, z: 8.5, facing: 'up' };
    return L;
  },

  wetspawn() {
    const L = createEmptyLevel({ name: 'Wet Feet', width: 20, depth: 16, border: 2 });
    fill(L, 7, 5, 13, 11, 's', 1);
    fill(L, 8, 6, 12, 10, 'o', 0);
    addObject(L, 'tree', 5.5, 5.5);
    L.spawn = { x: 10, z: 8, facing: 'down' };
    return L;
  },

  stormnight() {
    const L = createEmptyLevel({ name: 'Storm Night', width: 30, depth: 20, border: 2 });
    Object.assign(L.environment, { weather: 'rain', timeOfDay: 22, clock: false });
    for (let k = 0; k < 6; k++) addObject(L, 'lamppost', 5 + k * 4, 8.5);
    for (let k = 0; k < 4; k++) addObject(L, 'house', 6 + k * 6, 5, { light: true, text: [`House ${k + 1}. The shutters rattle in the wind.`] });
    addObject(L, 'campfire', 15, 14);
    addObject(L, 'light', 24, 14, { color: '#8fd3ff', intensity: 10 });
    addObject(L, 'wallTorch', 20.5, 6.5);
    addObject(L, 'wallTorch', 8.5, 6.5);
    addObject(L, 'npc', 10, 12, { name: 'Innkeeper', preset: 'innkeeper', action: 'rest', dialogue: ['A terrible night to be out.'] });
    addObject(L, 'npc', 13, 12, { name: 'Peddler', preset: 'merchant', action: 'shop', item: 'Umbrella', dialogue: ['Everything must go!'] });
    addObject(L, 'npc', 18, 12, { name: 'Minstrel', preset: 'bard', action: 'music', wander: 0, dialogue: ['A song for the storm?'] });
    addObject(L, 'npc', 21, 12, { name: 'Guard', preset: 'guard', script: 'guard' });
    L.spawn = { x: 15, z: 11, facing: 'up' };
    return L;
  },

  everything() {
    const L = createEmptyLevel({ name: 'Everything', width: 40, depth: 30, border: 2 });
    fill(L, 18, 2, 21, 28, '~', 0);
    fill(L, 30, 4, 36, 10, null, 5);
    setTile(L, 32, 10, '^');
    fill(L, 3, 20, 9, 26, 'o', 1);
    let x = 3;
    let z = 4;
    for (const [type, def] of Object.entries(OBJECT_TYPES)) {
      if (['fence', 'bridge', 'region', 'waterfall', 'npc', 'critters', 'emitter'].includes(type) || def.kind !== 'prop') continue;
      addObject(L, /** @type {ObjectType} */ (type), x + 0.5, z + 0.5);
      x += 4;
      if (x > 15) { x = 3; z += 4; }
    }
    addObject(L, 'fence', 23, 14, { x1: 28, z1: 14 });
    addObject(L, 'bridge', 17.5, 16, { x1: 21.5, z1: 16 });
    addObject(L, 'waterfall', 33, 10.5, { facing: 'S', width: 2 });
    CRITTER_KINDS.forEach((kind, k) => addObject(L, 'critters', 24 + k * 3, 20, { kind, count: kind === 'cat' || kind === 'dog' ? 1 : 3, radius: 1.5 }));
    EMITTER_PRESETS.forEach((preset, k) => addObject(L, 'emitter', 23 + (k % 5) * 3, 24 + Math.floor(k / 5) * 3, { preset, size: [3, 2, 3], count: 12 }));
    addObject(L, 'npc', 12, 18, { name: 'Chaser', preset: 'child', behaviour: 'chase', dialogue: ['Catch me if you can!'] });
    addObject(L, 'npc', 25, 17, { name: 'Unknown script', preset: 'scholar', script: 'nobody', dialogue: ['My script is missing, so I say this.'] });
    addObject(L, 'region', 0, 0, { name: 'The Heights', minX: 29, maxX: 37, minZ: 3, maxZ: 11, minY: 2, banner: 'A test banner' });
    addObject(L, 'region', 0, 0, { name: 'Everywhere', minX: 0, maxX: 40, minZ: 0, maxZ: 30 });
    L.spawn = { x: 12, z: 22, facing: 'up' };
    return L;
  },

  async hamlet() {
    const { level } = await loadProjectLevel('sample-hamlet');
    return level;
  },

  /** LVL-17: Object.prototype names in every level field that is looked up by name (see the header). */
  hostile() {
    const L = createEmptyLevel({ name: 'Hostile Names', width: 32, depth: 24, border: 1 });
    Object.assign(L.environment, { weather: 'constructor', border: '__proto__', combat: false, clock: false, timeOfDay: 16.5 });
    /** @type {(def: object) => TileDef} a raw legend entry (names the type does not allow) */
    const tile = (def) => /** @type {any} */ (def);
    // stairs named like prototype members (they stay plain tiles), texture names likewise (the
    // magenta "unknown texture" fallback), and real stairs with a bad riser / side texture
    L.legend.Q = tile({ top: 'cobblestone', side: 'stone_wall', riser: 'stone_wall', stairs: 'constructor', walkable: true });
    L.legend.R = tile({ top: 'cobblestone', side: 'stone_wall', riser: 'stone_wall', stairs: '__proto__', walkable: true });
    L.legend.U = tile({ top: 'cobblestone', side: 'stone_wall', riser: 'stone_wall', stairs: 'toString', walkable: true });
    L.legend.V = tile({ top: 'constructor', side: 'toString', lip: '__proto__', walkable: true });
    L.legend.Y = tile({ top: 'cobblestone', side: 'hasOwnProperty', riser: 'valueOf', stairs: 'E', walkable: true });
    // custom legend keys named like prototype members (own keys, as JSON.parse makes them)
    for (const key of ['constructor', '__proto__']) {
      Object.defineProperty(L.legend, key, { value: tile({ top: 'grass', side: 'cliff', lip: 'grass_side', walkable: true }), enumerable: true, writable: true, configurable: true });
    }
    fill(L, 20, 3, 31, 9, null, 5); // a plateau (level 5): the stairs above and two waterfalls on its south edge
    setTile(L, 21, 9, 'Q');
    setTile(L, 22, 9, 'R');
    setTile(L, 23, 9, 'U');
    fill(L, 3, 3, 6, 6, 'V', 3); // a raised block of unknown textures, real stairs up to it
    setTile(L, 2, 4, 'Y');
    addObject(L, 'waterfall', 26, 9, { facing: '__proto__', width: 2 });
    addObject(L, 'waterfall', 29, 9, { facing: 'constructor', width: 1.5 });
    addObject(L, 'house', 9, 14, { opts: { wall: 'constructor', upperWall: 'toString', plinth: '__proto__', gable: 'valueOf', roof: 'hasOwnProperty', stories: 2, gableFront: true, door: /** @type {any} */ ('constructor') } });
    addObject(L, 'house', 15, 14, { opts: { wall: 'valueOf', roof: '__proto__' } });
    addObject(L, 'marketStall', 20, 14.5, { opts: { cloth: 'constructor' } });
    addObject(L, 'marketStall', 24, 14.5, { opts: { cloth: '__proto__' } });
    addObject(L, 'well', 4, 18, { opts: { roof: 'toString' }, sfx: 'constructor', text: ['The water smells of prototypes.'] });
    addObject(L, 'windmill', 28.5, 20.5, { opts: { roof: 'constructor', wall: '__proto__' } });
    addObject(L, 'tree', 11, 4.5, { opts: { kind: 'constructor' } });
    addObject(L, 'tree', 14, 4.5, { opts: { kind: '__proto__' } });
    addObject(L, 'tree', 17, 4.5, { opts: { kind: 'toString' } });
    addObject(L, 'critters', 10, 19.5, { kind: 'constructor', count: 2, radius: 1.5 });
    addObject(L, 'critters', 14, 19.5, { kind: '__proto__', count: 2, radius: 1.5 });
    // (`spec`: the colour overrides the editor's NPC preview reads)
    Object.assign(addObject(L, 'npc', 7, 9.5, { name: 'Proto', preset: 'constructor', behaviour: 'constructor', facing: '__proto__', action: 'constructor', dialogue: ['My preset, behaviour and action are prototype names.'] }), { spec: { eyes: 'constructor', hair: '__proto__' } });
    addObject(L, 'npc', 9, 9.5, { name: 'Owner', script: 'hasOwnProperty', dialogue: ['My script is hasOwnProperty, so I say this.'] });
    addObject(L, 'npc', 11, 9.5, { name: 'Shadow', script: '__proto__', dialogue: ['My script is __proto__, so I say this.'] });
    addObject(L, 'npc', 13, 9.5, { name: 'Builder', action: 'shop', item: 'Constructor', dialogue: ['Take one.'] });
    addObject(L, 'npc', 15, 9.5, { name: 'Ancestor', action: 'shop', item: '__proto__', dialogue: ['Take one too.'] });
    addObject(L, 'emitter', 9, 21.5, { preset: 'constructor', size: [3, 2, 3], count: 12 });
    addObject(L, 'emitter', 13, 21.5, { preset: '__proto__', size: [3, 2, 3], count: 12 });
    addObject(L, 'emitter', 17, 21.5, { preset: 'fireflies', size: [3, 2, 3], count: 12 });
    addObject(L, 'enemy', 23, 20.5, { kind: 'constructor', count: 1, radius: 2 });
    addObject(L, 'region', 0, 0, { name: 'The Prototype Chain', minX: 1, maxX: 31, minZ: 1, maxZ: 23 });
    // an object of every prototype-named type, straight into `objects` (createObject refuses them)
    HOSTILE_NAMES.forEach((type, k) => L.objects.push(/** @type {any} */ ({ id: `proto_${k}`, type, x: 4.5 + k, z: 11.5 })));
    // values String() / Number() cannot convert (JSON objects with an own `toString` key): the
    // load must still finish — an object / array type is skipped, an object id renamed
    // ('region_2'), an object number takes its default, an object text field its default
    const noText = () => /** @type {any} */ ({ toString: 1 });
    L.objects.push(/** @type {any} */ ({ id: 'odd_type', type: noText(), x: 6.5, z: 13.5 }));
    L.objects.push(/** @type {any} */ ({ id: 'odd_list', type: ['house'], x: 7.5, z: 13.5 }));
    L.objects.push(/** @type {any} */ ({ id: noText(), type: 'region', name: 'Odd Corner', minX: { toString: 1, valueOf: 1 }, maxX: 4, minZ: 1, maxZ: 4 }));
    Object.assign(L, { subtitle: noText(), version: noText(), waterLevel: noText() });
    L.tiles.push(noText()); // a 25th row (depth 24: "Row count 25 ≠ depth 24")
    L.heights.push(noText());
    // LVL-18: values the load used to keep as they were (texture names, an NPC's name and portrait
    // colour, house opts, environment text) — dropped at load, their defaults apply
    L.legend.W = tile({ top: noText(), side: 'stone_wall', riser: noText(), walkable: true });
    fill(L, 18, 18, 20, 20, 'W', null);
    addObject(L, 'npc', 17, 9.5, { name: noText(), portraitColor: noText(), dialogue: ['My name could not be read, so I am a villager.'] });
    addObject(L, 'house', 4, 14, { opts: { roof: noText(), wall: 'stone_wall' } });
    Object.assign(L.environment, { backdrop: noText(), title: { title: noText(), prompt: 'Press any key' } });
    // LVL-19: colour names three.js resolves through Object.prototype (they gave black): the lights
    // take the default colour, the particles act as for an unknown name (white)
    addObject(L, 'light', 12, 17, { color: 'constructor' });
    addObject(L, 'light', 14.5, 17, { color: '__proto__' });
    addObject(L, 'emitter', 20.5, 21.5, { preset: 'fireflies', size: [3, 2, 3], count: 12, params: { color: 'constructor', colorEnd: '__proto__' } });
    addObject(L, 'emitter', 24.5, 21.5, { preset: 'fireflies', size: [3, 2, 3], count: 12, params: { colors: ['__proto__', 'constructor'] } });
    L.spawn = /** @type {any} */ ({ x: 16.5, z: 17.5, facing: 'constructor' });
    return L;
  },

  /** Emberfall with villagers / critters moved as the editor would (only x / z change): their
   *  talk point, chase area, chicken yard and bird spots are object-relative and must follow. */
  async moved() {
    const { level } = await loadProjectLevel('emberfall');
    const get = (id) => level.objects.find((o) => o.id === id);
    get('merchant').x += 3;
    get('birds').z -= 3;
    get('chickens').x += 1.5;
    get('child').x += 1.5;
    level.name = 'Emberfall (moved)';
    return level;
  },
};

/**
 * Build a case, save it to browser storage and open it in the game.
 * @param {string} name  a `CASES` key
 * @param {{ autostart?: boolean }} [opts]  autostart (true): skip the title screen
 * @returns {Promise<string>} the storage slot
 */
export async function runCase(name, { autostart = true } = {}) {
  const make = CASES[name];
  if (!make) throw new Error(`unknown case "${name}"`);
  const level = await make();
  const slot = saveLocalLevel(`test-${name}`, level);
  const q = `level=local:${encodeURIComponent(slot)}${autostart ? '&autostart=1' : ''}`;
  window.location.href = new URL(`../game.html?${q}`, window.location.href).href;
  return slot;
}

const params = new URLSearchParams(window.location.search);
const which = params.get('case');
const list = document.getElementById('cases');
if (which) {
  runCase(which, { autostart: params.get('autostart') !== '0' }).catch((e) => {
    document.body.textContent = String(e?.message ?? e);
    console.error(e);
  });
} else if (list) {
  for (const name of Object.keys(CASES)) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.textContent = name;
    b.onclick = () => runCase(name);
    li.append(b);
    list.append(li);
  }
}
/**
 * `window.__levelCases` (AUTOMATION_API.md §7).
 * @typedef {{ CASES: typeof CASES, runCase: typeof runCase }} LevelCasesHandle
 */
window.__levelCases = { CASES, runCase };
