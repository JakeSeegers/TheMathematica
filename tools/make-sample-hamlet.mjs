#!/usr/bin/env node
/**
 * Builds the small hand-authored sample level `public/levels/sample-hamlet.json` ("Willowmere")
 * with the LevelFormat helpers — a compact example of what a level made in the editor contains:
 * painted tiles and heights (a raised north terrace with a stair, a sunken pond), houses, trees,
 * lampposts, a well, a fence, a signpost, NPCs with plain dialogue (one with the built-in `shop`
 * action), critters, a firefly and a petal area and three regions. Automatic camera bounds and title
 * camera.
 *
 *   node tools/make-sample-hamlet.mjs [--out=public/levels/sample-hamlet.json] [--check]
 *     --out=<path>  write somewhere else (relative to the repository root), e.g. a scratch file
 *     --check       write nothing; compare the generated text with the --out file and exit 1 if
 *                   it differs (says whether the data differs or only the key order / formatting;
 *                   CRLF line endings count as identical — git stores the file with LF)
 *   then play it at game.html?level=sample-hamlet
 *
 * The output is deterministic (no randomness; a second run is byte-identical) and each object
 * line has a canonical key order of its own (see `canonicalObject`), so the file does not change
 * when `createObject` changes the key order it builds objects in. Every text carries its
 * content-text key (`textKeys`, docs/specs/I18N.md §4.10): carried from the current file at the
 * default path (never --out), a new text's minted from the file and the text.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createEmptyLevel, setTile, setHeightLevel, addObject, normalizeLevel, parseLevel, validateLevel, serializeLevel, levelStats,
} from '../src/engine/level/LevelFormat.js';
import { OBJECT_TYPES } from '../src/engine/level/ObjectCatalog.js';
import { keyLevel, keyIssueLines } from './lib/levelgen.mjs';

/** @import { LevelObject } from '../src/engine/level/types.js' */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
if (args.out === true || args.out === '') {
  console.error('--out needs a path, e.g. --out=.check/sample-hamlet.json');
  process.exit(2);
}
const OUT = path.resolve(root, String(args.out ?? 'public/levels/sample-hamlet.json'));

const W = 28;
const D = 22;
const level = createEmptyLevel({ name: 'Willowmere', width: W, depth: D, fill: 'g', level: 2, border: 2 });
level.subtitle = 'A Hamlet by the Pond';
level.author = 'Luminati';
level.description = 'A small sample level: a green with a well, three cottages, a pond with fireflies and a raised orchard terrace.';
level.environment = { ...level.environment, timeOfDay: 16.8 };

/** Fill a tile rectangle [i0, i1) × [j0, j1) with a tile char and / or a height level. */
function fill(i0, j0, i1, j1, ch, lvl) {
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      if (ch != null) setTile(level, i, j, ch);
      if (lvl != null) setHeightLevel(level, i, j, lvl);
    }
  }
}

// ---- terrain -----------------------------------------------------------------------------------
// a little grass variety
fill(2, 2, W - 2, 5, 'G');
for (const [i, j] of [[4, 9], [5, 9], [9, 17], [10, 17], [22, 9], [23, 10], [16, 18], [17, 18]]) setTile(level, i, j, 'f');
fill(3, 17, 7, 20, 'f');
// raised orchard terrace along the north (level 3, the forest behind it a step higher) with a
// stone stair in the middle
fill(0, 0, W, 5, null, 3);
fill(0, 0, W, 2, null, 4);
setTile(level, 13, 5, '^');
setTile(level, 14, 5, '^');
// dirt roads: west → east through the green, and north → south
fill(2, 11, W - 2, 13, '.');
fill(13, 6, 15, D - 2, '.');
// the green: cobbles around the well
fill(10, 9, 18, 15, 'c');
// the pond, sunk below the meadow, with a sandy shore
fill(18, 15, 25, 20, 's', 1);
fill(19, 16, 24, 19, 'o', 0);
// vegetable patch south of the green
fill(8, 17, 12, 20, 'F');

// ---- buildings, lights & props -----------------------------------------------------------------
addObject(level, 'house', 7, 7.8, {
  name: 'Rosehip Cottage', light: true, text: ['Lavender hangs drying by the door. Someone inside is humming.'],
  opts: { width: 4, depth: 3, wall: 'plaster', roof: 'roof_thatch', woodpile: true, seed: 3 },
});
addObject(level, 'house', 20.5, 7.6, {
  name: 'The Willow Inn', light: true, text: ['Warm light and the clink of mugs behind the door. The inn is full tonight.'],
  opts: { width: 5, depth: 3.5, stories: 2, wall: 'plaster', upperWall: 'timber_frame', roof: 'roof_red', sign: true, doorHood: true, seed: 12 },
});
addObject(level, 'house', 5.3, 16.6, {
  rotation: Math.PI / 2, name: 'Mossy Cottage', light: false, text: ['Nobody answers. A cat flap swings gently in the breeze.'],
  opts: { width: 4, depth: 3, wall: 'stone_brick', roof: 'roof_slate', seed: 7 },
});
addObject(level, 'well', 14, 10, { text: ['The water is clear and very cold.', 'Your reflection looks back — a little tired, but content.'] });
addObject(level, 'lamppost', 10.4, 9.4);
addObject(level, 'lamppost', 17.6, 14.6, { rotation: Math.PI });
addObject(level, 'lamppost', 17.8, 9.4, { rotation: Math.PI });
addObject(level, 'campfire', 23.5, 14.2, { opts: { seat: true } });
addObject(level, 'signpost', 12.3, 13.6, {
  rotation: 0.2, speaker: 'Signpost',
  text: ['↑ {Orchard Terrace} · → {Mirror Pond}\n← {Rosehip Cottage}'], opts: { boards: 3 },
});
addObject(level, 'bench', 16.9, 13.4, { rotation: -Math.PI / 2 });
addObject(level, 'barrel', 23.2, 9.8, { rotation: 0.4 });
addObject(level, 'crateStack', 24.2, 9.4, { rotation: -0.3, opts: { count: 2 } });
addObject(level, 'flowerbox', 19.2, 9.75, { opts: { length: 1.4 } });
addObject(level, 'flowerbox', 21.8, 9.75, { opts: { length: 1.4 } });
addObject(level, 'haystack', 9.2, 15.9, { opts: { size: 0.8 } });
addObject(level, 'rock', 24.8, 17.2, { opts: { size: 0.8 } });
addObject(level, 'rock', 18.3, 19.4, { opts: { size: 0.6 } });
addObject(level, 'fence', 7.8, 16.7, { x1: 12.2, z1: 16.7 });

// ---- trees -------------------------------------------------------------------------------------
/** @type {[kind: string, x: number, z: number, height: number][]} */
const trees = [
  ['oak', 4.2, 3.4, 4.6], ['autumn', 8.8, 3.2, 4.2], ['birch', 18.2, 3.3, 4.8], ['oak', 23.6, 3.6, 4.4],
  ['pine', 25.3, 6.4, 4.8], ['birch', 2.9, 10.2, 4.4], ['oak', 25.0, 14.4, 4.4], ['autumn', 7.4, 19.3, 4.0],
  ['pine', 21.4, 19.6, 4.2], ['birch', 25.2, 19.4, 4.4],
];
for (const [kind, x, z, height] of trees) addObject(level, 'tree', x, z, { opts: { kind, height, seed: Math.round(x * 10 + z) } });

// ---- villagers ---------------------------------------------------------------------------------
addObject(level, 'npc', 15.6, 12.2, {
  name: 'Mira', preset: 'villager', wander: 1.4, portraitColor: '#8fb3d9',
  dialogue: [
    'Welcome to {Willowmere}! We are small, but the pond makes up for it.',
    { text: 'Have you seen the fireflies over {Mirror Pond}?', choices: ['Not yet', 'They are lovely'] },
    'Come back after dark — they are brightest then.',
  ],
});
addObject(level, 'npc', 5.6, 12.4, {
  name: 'Old Fen', preset: 'farmer', wander: 1.8, speed: 0.8, portraitColor: '#cfb25a',
  dialogue: ['The carrots are late this year.', 'Mind the chickens. They think the road is theirs.'],
});
addObject(level, 'npc', 22.2, 11.2, {
  name: 'Tilda', preset: 'merchant', wander: 0.4, speed: 0.8, portraitColor: '#78b35b',
  action: 'shop', item: 'Honey Cake',
  dialogue: ['Fresh from the oven! Honey from the orchard hives.'],
});

// readable ids for the villagers (e.g. __game.talkTo('tilda'))
for (const [name, id] of [['Mira', 'mira'], ['Old Fen', 'fen'], ['Tilda', 'tilda']]) level.objects.find((o) => o.name === name).id = id;

// ---- critters, particles, regions --------------------------------------------------------------
addObject(level, 'critters', 4.6, 12, { kind: 'chicken', count: 3, radius: 1.4 });
addObject(level, 'critters', 11.5, 15.5, { kind: 'cat', count: 1, radius: 2.5 });
addObject(level, 'emitter', 21.5, 17.5, { preset: 'fireflies', size: [8, 2, 6], count: 26, dy: 0.9 });
addObject(level, 'emitter', 13.5, 3.5, { preset: 'petals', size: [20, 3.5, 4], count: 24, dy: 2.2 });
addObject(level, 'region', 0, 0, { name: 'Orchard Terrace', sub: 'Willowmere', minX: 0, maxX: W, minZ: 0, maxZ: 5.5, minY: 1.3, banner: 'Where the old trees keep watch' });
addObject(level, 'region', 0, 0, { name: 'Mirror Pond', sub: 'Willowmere', minX: 17, maxX: W, minZ: 14, maxZ: D });
addObject(level, 'region', 0, 0, { name: 'Willowmere Green', sub: 'Willowmere', minX: 0, maxX: W, minZ: 0, maxZ: D });

level.spawn = { x: 13.9, z: 16.5, facing: 'up' };

// ---- output ------------------------------------------------------------------------------------

const PLACEMENT_KEYS = { point: ['x', 'z'], line: ['x0', 'z0', 'x1', 'z1'], rect: ['minX', 'maxX', 'minZ', 'maxZ'] };
const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Copy of `obj` with the keys in `lead` first (those it has, in that order), then the rest as they
 * are.
 * @param {Record<string, any>} obj
 * @param {string[]} lead
 * @returns {Record<string, any>}
 */
function orderKeys(obj, lead) {
  const out = {};
  for (const k of lead) if (Object.hasOwn(obj, k)) out[k] = obj[k];
  for (const k of Object.keys(obj)) if (!Object.hasOwn(out, k)) out[k] = obj[k];
  return out;
}

/**
 * The canonical key order of an object line: `id`, `type`, the position keys of its placement,
 * then the catalog defaults in catalog order, then any other keys in the order this script sets
 * them; a nested plain object with catalog defaults (`opts`) likewise lists its defaults first.
 * `normalizeObject` keeps an object's own key order (so load → save is byte-stable), which means
 * the file's order would otherwise be whatever `createObject` builds today (LVL-11: a
 * `createObject` change once reordered all 38 object lines of an unchanged level).
 * @param {LevelObject} o
 * @returns {LevelObject}
 */
function canonicalObject(o) {
  const def = OBJECT_TYPES[o.type];
  const out = orderKeys(o, ['id', 'type', ...PLACEMENT_KEYS[def.placement], ...Object.keys(def.defaults)]);
  for (const [k, d] of Object.entries(def.defaults)) {
    if (isPlain(d) && isPlain(out[k])) out[k] = orderKeys(out[k], Object.keys(d));
  }
  return /** @type {LevelObject} */ (out);
}

const { level: out, warnings } = normalizeLevel(level);
out.objects = out.objects.map(canonicalObject);
// the content-text keys (docs/specs/I18N.md §4.10): carried from the current file at the default
// path (never --out), new ones seeded by the file and the text
keyLevel(out, { root, file: 'public/levels/sample-hamlet.json' });
const errors = [...validateLevel(out), ...keyIssueLines(out)];
const text = serializeLevel(out);
// what the editor does on open → save unchanged: must give the same bytes
if (serializeLevel(parseLevel(text).level) !== text) errors.push('the output does not re-serialise byte-identically (parseLevel → serializeLevel)');
if (warnings.length || errors.length) {
  console.error([...warnings, ...errors].join('\n'));
  process.exit(1);
}
const rel = path.relative(root, OUT);

if (args.check) {
  const raw = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  // CRLF line endings in a working copy are not a difference: git stores the file with LF
  const old = raw == null ? null : raw.replace(/\r\n/g, '\n');
  if (old === text) {
    console.log(raw === text ? `${rel} is up to date (byte-identical).`
      : `${rel} is up to date (identical apart from CRLF line endings, which git stores as LF).`);
    process.exit(0);
  }
  if (old == null) {
    console.error(`${rel} does not exist.`);
    process.exit(1);
  }
  // same data in another key order, or different data?
  const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys)
    : isPlain(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
  let sameData = false;
  try { sameData = JSON.stringify(sortKeys(JSON.parse(old))) === JSON.stringify(sortKeys(JSON.parse(text))); } catch { /* not JSON */ }
  const a = old.split('\n');
  const b = text.split('\n');
  let lines = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) lines++;
  console.error(`${rel} differs from the generator output in ${lines} line(s): ${sameData ? 'same data, different key order or formatting' : 'the data differs'}. Re-run without --check to rewrite it.`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, text);
const s = levelStats(out);
console.log(`Willowmere → ${rel}: ${s.width}×${s.depth}, ${s.objects} objects, ${s.water} water tiles`, s.counts);
