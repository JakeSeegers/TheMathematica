#!/usr/bin/env node
/**
 * Builds the demo campaign **The Ferryman's Lantern** — `public/campaigns/ferrymans-lantern/`:
 * `campaign.json`, its five level files and its story files `story/main.json` (items, quests,
 * actors, a campaign event, start presets) and `story/dialogue.story` (the actors' talk and the
 * cutscenes) (docs/specs/CAMPAIGN_FORMAT.md, docs/specs/STORY_SCRIPT.md,
 * docs/design/campaigns/ferrymans-lantern.md). A small story that uses every campaign and story
 * feature:
 *
 *   millbrook        (40 × 32, the start) a mill village. Its east road runs off the map into
 *                    mill-road across a seam (no entrance: the levels are placed side by side);
 *                    the mill's cellar door is a Space exit that needs the cellar key. Elder Wren
 *                    starts the quest, Hollis wants three oak planks (an event on the stack by the
 *                    road gives them) and walks off to the ford, Miller Odo's menu loop gives the key.
 *   mill-road        (56 × 18) the road east; its bridge over the Wolf Ford is built while the
 *                    player watches (an `enter` cutscene: `bridge-mended`, the bridge's `when`, the
 *                    flood debris' `unless` — live). Seams to millbrook and old-quarry.
 *   old-quarry       (36 × 30) a combat level: slimes (clearing the first pack makes Ilse call out:
 *                    a `cleared` event), a waystone, a chest — and Ilse by her fire, who hands over
 *                    the lantern (`lantern-found`).
 *   mill-cellar      (16 × 12) the interior behind the cellar door (entrance `from-mill`); the
 *                    ferry chart is a Space event. A room (`environment.interior`): no weather in
 *                    here, and Millbrook is kept while the player is down here (and the cellar
 *                    after they leave it), so the door is a light switch, not a level build.
 *   millbrook-dusk   chapter two's Millbrook (`lantern-found`): the village at dusk, an `arrive`
 *                    cutscene (Ilse walks to the green), and the ending (ask Ilse to row you over).
 *
 *   node tools/make-ferrymans-lantern.mjs [--out=<folder>] [--check] [--force] [--quiet]
 *     --out=<folder>  write the campaign elsewhere (relative to the repository root)
 *     --check         write nothing; exit 1 unless every file matches byte for byte
 *     --force         write even when the campaign check reports errors
 *
 * Every text carries its content-text key (docs/specs/I18N.md §4.10): `textKeys` in the level files,
 * campaign.json and story/main.json, a `#line:` tag on each line with text of the scripts — carried
 * from the current files at the default folder (never --out), a new text's minted from its file and
 * text; millbrook-dusk shares millbrook's key where its English is the same (a variant's changed text
 * never keeps a key millbrook holds), and an edit of millbrook's text whose key the variant holds
 * gets a key of its own (copy on write: `keyLevel`'s `shared`), so the variant keeps its translation;
 * `splitSharedKeys` after them is the safety net (a key the two hold with two Englishes stays with
 * the copy whose English did not change).
 *
 * Deterministic (no randomness). Before writing, the whole campaign goes through
 * `checkCampaign` (tools/lib/campaigncheck.mjs: every level's checkLevel, the links, the seams,
 * the story flags); an error stops the write unless --force.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createEmptyLevel, setTile, setHeightLevel, addObject, normalizeLevel, parseLevel, validateLevel, serializeLevel,
} from '../src/engine/level/LevelFormat.js';
import { OBJECT_TYPES, EVENT_TRIGGERS, isCampaignType, isStoryType } from '../src/engine/level/ObjectCatalog.js';
import { CAMPAIGN_FORMAT, normalizeCampaign, serializeCampaign, levelFile } from '../src/game/campaign/CampaignFormat.js';
import { buildStory, serializeStory, serializeStoryText, storyFile } from '../src/game/campaign/StoryFormat.js';
import { parseScript } from '../src/engine/level/StoryScript.js';
import { carryCampaignText, carryStoryFile, retagStoryText, seededMint, fileKeyIssues } from '../src/engine/i18n/TextKeys.js';
import { parseArgs, canonicalObject, keyLevel, keyIssueLines, splitSharedKeys, previousOutput, copyKeys } from './lib/levelgen.mjs';
import { checkCampaign } from './lib/campaigncheck.mjs';

/** @import { Level, LevelObject } from '../src/engine/level/types.js' */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
if (args.out === true || args.out === '') {
  console.error('--out needs a folder, e.g. --out=.check/ferrymans-lantern');
  process.exit(2);
}
const NAME = 'ferrymans-lantern';
const OUT = path.resolve(root, String(args.out ?? `public/campaigns/${NAME}`));
const log = (...a) => { if (!args.quiet) console.log(...a); };

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/** Fill tiles [i0, i1) × [j0, j1) with a char and / or a height level. */
function fill(L, i0, j0, i1, j1, ch, lvl) {
  for (let j = Math.max(0, j0); j < Math.min(L.depth, j1); j++) {
    for (let i = Math.max(0, i0); i < Math.min(L.width, i1); i++) {
      if (ch != null) setTile(L, i, j, ch);
      if (lvl != null) setHeightLevel(L, i, j, lvl);
    }
  }
}

/**
 * Add an object with a readable id.
 * @param {Level} L
 * @param {string} id
 * @param {string} type
 * @param {number} x
 * @param {number} z
 * @param {Record<string, any>} [fields]
 */
function put(L, id, type, x, z, fields = {}) {
  const o = addObject(L, /** @type {any} */ (type), x, z, fields);
  if (id) o.id = id;
  return o;
}

/** A tree on the map (its seed from the position). */
function tree(L, kind, x, z, height = 4.4, extra = {}) {
  return addObject(L, 'tree', x, z, { opts: { kind, height, seed: Math.round(x * 10 + z * 3) }, ...extra });
}

/** The door step of a house at (x, z) facing +Z, `depth` deep (LevelObjectBuilder: depth / 2 + 1). */
const doorStep = (x, z, depth) => ({ x, z: z + depth / 2 + 1 });

/**
 * A story event (docs/specs/STORY_SCRIPT.md §4) over the rect [x0, x1) × [z0, z1).
 * @param {Level} L
 * @param {string} id
 * @param {[number, number, number, number]} rect
 * @param {Record<string, any>} fields on, run (lines), label, if, once, at, group
 */
function event(L, id, [x0, z0, x1, z1], fields) {
  return put(L, id, 'event', 0, 0, { minX: x0, maxX: x1, minZ: z0, maxZ: z1, ...fields });
}

// ---------------------------------------------------------------------------------------------
// Millbrook (and its chapter-two variant at dusk)
// ---------------------------------------------------------------------------------------------

/** The road east: rows 15–17, world z 15–18 (mill-road rows 7–9, old-quarry rows 13–15). */
const ROAD = { j0: 15, j1: 18 };
const MILL = { x: 9, z: 9.5, depth: 3.5 };

/** @param {boolean} dusk chapter two (the lantern festival) */
function millbrook(dusk) {
  const W = 40;
  const D = 32;
  const L = createEmptyLevel({ name: 'Millbrook', width: W, depth: D, fill: 'g', level: 2, border: 2 });
  L.subtitle = dusk ? 'The Night of Lanterns' : 'A Mill by the Brook';
  L.author = 'Luminati';
  L.description = dusk
    ? 'Chapter two of The Ferryman\'s Lantern: Millbrook at dusk, lanterns hung for the ferryman\'s return.'
    : 'The start of The Ferryman\'s Lantern: a mill village whose road runs east to the Wolf Ford and the old quarry.';
  L.environment = dusk
    ? { ...L.environment, timeOfDay: 19.4, clock: false }
    : { ...L.environment, timeOfDay: 9.5 };

  // ---- terrain ----
  fill(L, 2, 2, W - 2, 6, 'G');
  fill(L, 0, 0, W, 7, null, 3); // the north terrace (the mill hill)
  fill(L, 0, 0, W, 2, null, 4);
  setTile(L, 18, 7, '^');
  setTile(L, 19, 7, '^');
  // the brook along the west, sunk below the meadow, and a pond
  fill(L, 2, 20, 9, 30, 's', 1);
  fill(L, 3, 21, 8, 29, 'o', 0);
  // roads: the east road off the map, the lane north to the stair, the green
  fill(L, 10, ROAD.j0, W, ROAD.j1, '.');
  fill(L, 18, 8, 20, ROAD.j0, '.');
  fill(L, 13, 11, 25, 15, 'c');
  fill(L, 26, 20, 34, 27, 'F'); // the vegetable fields
  fill(L, 11, 22, 16, 27, 'f');
  // the east road leaves the map: open the forest border there
  fill(L, W - 2, ROAD.j0, W, ROAD.j1, '.');

  // ---- buildings ----
  put(L, 'mill_house', 'house', MILL.x, MILL.z, {
    name: 'The Mill House',
    opts: { width: 5, depth: MILL.depth, stories: 2, wall: 'stone_brick', upperWall: 'timber_frame', roof: 'roof_slate', doorHood: true, seed: 21 },
  });
  put(L, 'windmill', 'windmill', 4.5, 4, { rotation: 0.3 });
  put(L, 'elder_house', 'house', 23.5, 9.2, {
    name: 'Elder Wren\'s House', light: true, text: ['A sprig of rosemary hangs over the door. The elder is out on the green.'],
    opts: { width: 4.5, depth: 3, wall: 'plaster', roof: 'roof_red', woodpile: true, seed: 5 },
  });
  put(L, 'workshop', 'house', 31.5, 9.6, {
    name: 'Hollis\'s Workshop', light: true, text: ['Sawdust drifts out under the door. A plane rasps somewhere inside.'],
    opts: { width: 5, depth: 3.2, wall: 'wood_planks', roof: 'roof_thatch', sign: true, seed: 8 },
  });
  put(L, 'cottage', 'house', 5, 14.5, {
    name: 'Brookside Cottage', light: true, text: ['Nobody answers. Through the window: a cat asleep on a chair.'],
    opts: { width: 4, depth: 3, wall: 'timber_frame', roof: 'roof_blue', seed: 13 },
  });
  put(L, 'well', 'well', 13.8, 12.6, { text: ['The rope is new. Hollis must have seen to it.'] });
  put(L, 'sign_east', 'signpost', 34.5, 14.3, {
    rotation: 0.15, text: ['→ {Mill Road} · {Wolf Ford} · {the Old Quarry}', '← {Millbrook Green}'], opts: { boards: 2 },
  });
  for (const [x, z, r] of [[14.4, 14.6, 0], [24.4, 14.6, Math.PI], [12, 18.4, 0], [30.5, 18.4, Math.PI]]) addObject(L, 'lamppost', x, z, { rotation: r });
  addObject(L, 'bench', 16, 11.6, { rotation: 0 }); // (the green's north edge)
  addObject(L, 'barrel', 26.3, 11.3, { rotation: 0.3 });
  addObject(L, 'crateStack', 35.4, 12.6, { rotation: -0.2, opts: { count: 2 } });
  addObject(L, 'flowerbox', 22.6, 10.95, { opts: { length: 1.3 } });
  addObject(L, 'haystack', 32.5, 25.5, { opts: { size: 0.9 } });
  addObject(L, 'fence', 25.5, 19.6, { x1: 34.5, z1: 19.6 });

  // ---- trees ----
  /** @type {[string, number, number, number][]} */
  const trees = [
    ['oak', 13.5, 4.4, 4.6], ['birch', 27.5, 3.8, 4.8], ['autumn', 33.6, 4.2, 4.2], ['pine', 36.4, 6.8, 4.8],
    ['oak', 27.6, 29.6, 4.4], ['birch', 10.2, 29.0, 4.4], ['oak', 33.8, 29.2, 4.4], ['autumn', 21.4, 28.6, 4.0],
    ['pine', 36.5, 28.7, 4.4], ['birch', 36.2, 25.8, 4.6],
  ];
  for (const [kind, x, z, h] of trees) tree(L, kind, x, z, h);

  // ---- villagers (the recurring characters are actors: their talk is in story/dialogue.story) ----
  if (!dusk) {
    put(L, 'elder', 'npc', 20.6, 12.4, { name: 'Elder Wren', preset: 'elder', wander: 1.2, speed: 0.7, portraitColor: '#c9a45c', actor: 'wren' });
    // (gone while he is at the ford: he walks off at the end of his conversation)
    put(L, 'hollis', 'npc', 31.4, 12.8, { name: 'Hollis', preset: 'farmer', wander: 0.6, speed: 0.8, portraitColor: '#b07b44', actor: 'hollis', unless: 'hollis-at-ford' });
    put(L, 'odo', 'npc', 11.4, 14.2, { name: 'Miller Odo', preset: 'merchant', wander: 0.8, speed: 0.8, portraitColor: '#d8b453', actor: 'odo' });
    // (a plain conversation: `dialogue`, and a villager's `flag` set when it ends)
    put(L, 'guard', 'npc', 36.2, 16.6, {
      name: 'Watchman Bran', preset: 'guard', behaviour: 'post', wander: 0, facing: 'left', portraitColor: '#8fb3d9', unless: 'lantern-found', flag: 'warned',
      dialogue: ['Slimes have crept into the old quarry since the rain. Keep your blade handy past the ford.'],
    });
    put(L, 'pip', 'npc', 22.5, 17.6, {
      name: 'Pip', preset: 'child', wander: 2, speed: 1.3, portraitColor: '#e27aa8',
      talk: [
        'cycle pip-chatter',
        '  * Pip: Ilse lets me ring the ferry bell! When she comes back, I mean.',
        '  * Pip: Do slimes taste like jam? Hollis says no, but he won\'t say how he knows.',
        '  * Pip: You\'ve been to ${visited-count} places? I\'ve been to the well. Twice.',
      ],
    });
    // the oak planks Hollis wants, stacked to dry by the east road
    event(L, 'ev_planks', [34.1, 11.6, 36.7, 13.6], {
      on: 'use', label: 'Search', once: true, if: 'stage:find-ilse >= planks and not hollis-at-ford',
      run: [': Oak planks, stacked to dry. Hollis said three would do.', 'give plank 3'],
    });
    // Bran stops a traveller heading east before the elder has spoken to them
    event(L, 'ev_bran', [33, 15, 37.5, 18], {
      on: 'enter', once: true, if: 'not quest:find-ilse and not warned',
      run: ['face guard left', 'Watchman Bran: Hold on, traveller — Elder Wren was asking for you. On the green.'],
    });
    // leaving the green with the quest: a call after the player
    event(L, 'ev_farewell', [13, 11, 25, 15], {
      on: 'leave', once: true, if: 'quest:find-ilse = active',
      run: ['toast "Mind the ford, traveller!" — Elder Wren'],
    });
    // every evening
    event(L, 'ev_lamps', [2, 2, 4, 4], { on: 'time', at: 18.5, run: ['toast The lamps of Millbrook are lit.'] });
    // Pip calls out to whoever walks across the green — beside play (a background event: nobody is held)
    event(L, 'ev_pip_calls', [18, 15, 27, 19], {
      on: 'enter', background: true,
      run: [
        'cycle pip-calls',
        '  * bark pip Race you to the well!',
        '  * bark pip Ilse lets me ring the {ferry bell}!',
        '  * emote pip note',
        '    bark pip La la la, the lantern\'s on the hill…',
      ],
    });
    put(L, 'east_road', 'marker', 37.6, 16.5, { name: 'east-road', facing: 'right' });
  } else {
    put(L, 'elder', 'npc', 20.6, 12.4, { name: 'Elder Wren', preset: 'elder', wander: 1, speed: 0.7, portraitColor: '#c9a45c', actor: 'wren' });
    // (she comes home along the east road: the arrival cutscene walks her to the green)
    put(L, 'ilse', 'npc', 37.4, 16.4, { name: 'Ilse', preset: 'hunter', wander: 0.8, speed: 0.8, portraitColor: '#7fd6a8', actor: 'ilse', facing: 'left' });
    put(L, 'hollis', 'npc', 31.4, 12.8, { name: 'Hollis', preset: 'farmer', wander: 0.6, speed: 0.8, portraitColor: '#b07b44', actor: 'hollis' });
    // the miller cries his buns to whoever passes the mill (beside play)
    event(L, 'ev_odo_cries', [7, 12, 16, 17.5], {
      on: 'enter', background: true,
      run: ['bark odo Festival buns! Fresh from the oven!', 'wait 2.5', 'bark odo Honey from the elder\'s own bees!'],
    });
    put(L, 'odo', 'npc', 11.4, 14.2, {
      name: 'Miller Odo', preset: 'merchant', wander: 0.8, speed: 0.8, portraitColor: '#d8b453', action: 'shop', item: 'Festival Bun',
      dialogue: ['Festival buns, fresh from the oven — the flour is mine, the honey is Wren\'s.'],
    });
    put(L, 'bard', 'npc', 17.2, 16.4, {
      name: 'Tamsin', preset: 'bard', behaviour: 'perform', wander: 0, facing: 'down', portraitColor: '#e2a85c', action: 'music',
      dialogue: ['A song for the ferryman? I know just the one.'],
    });
    put(L, 'pip', 'npc', 22.5, 17.6, {
      name: 'Pip', preset: 'child', wander: 2, speed: 1.4, portraitColor: '#e27aa8',
      dialogue: ['I rang the bell! Did you hear it? I rang it SO loud.'],
    });
    put(L, 'green_centre', 'marker', 21.2, 13.6, { name: 'green-centre', facing: 'down' });
    event(L, 'ev_welcome', [0, 0, 3, 3], { on: 'arrive', once: true, run: ['call welcome-home'] });
    // the festival: lanterns over the green, a stall, a campfire
    for (const [x, z] of [[15, 12.2], [23, 12.2], [15, 16.8], [23, 16.8]]) addObject(L, 'light', x, z, { color: '#ffb46b', intensity: 6, distance: 7, dy: 2.4 });
    addObject(L, 'marketStall', 27.7, 13.9, { rotation: 0, opts: { width: 3, cloth: 'cloth_stripe', seed: 4 } });
    addObject(L, 'campfire', 16.5, 23.5, { opts: { seat: true } });
    addObject(L, 'emitter', 19, 14.5, { preset: 'sparkle', size: [10, 3, 6], count: 24, dy: 2.2 });
  }

  // ---- critters, particles, regions ----
  addObject(L, 'critters', 27.5, 24.5, { kind: 'chicken', count: 3, radius: 1.8 });
  addObject(L, 'emitter', 5.5, 25, { preset: 'fireflies', size: [6, 2, 8], count: 22, dy: 0.9 });
  addObject(L, 'region', 0, 0, { name: 'Mill Hill', sub: 'Millbrook', minX: 0, maxX: W, minZ: 0, maxZ: 7.5, minY: 1.3, banner: 'Where the sails turn' });
  addObject(L, 'region', 0, 0, { name: 'The East Road', sub: 'Millbrook', minX: 33, maxX: W, minZ: 13, maxZ: 20 });
  addObject(L, 'region', 0, 0, { name: 'Millbrook Green', sub: 'Millbrook', minX: 0, maxX: W, minZ: 0, maxZ: D });

  // ---- travel ----
  // east: the road runs on into mill-road across the seam (both levels are placed in campaign.json)
  put(L, 'exit_east', 'exit', 0, 0, { minX: W - 1.5, maxX: W, minZ: ROAD.j0, maxZ: ROAD.j1, to: 'mill-road' });
  // the mill's cellar door: Space, with the miller's key
  const door = doorStep(MILL.x, MILL.z, MILL.depth);
  put(L, 'exit_cellar', 'exit', 0, 0, {
    minX: door.x - 0.9, maxX: door.x + 0.9, minZ: door.z - 0.7, maxZ: door.z + 0.5,
    to: 'mill-cellar', entrance: 'from-mill', mode: 'use', label: 'Enter', requires: 'item:cellar-key',
    locked: ['The cellar door is locked.', 'Miller Odo keeps the key on his belt.'],
  });
  put(L, 'mill_door', 'entrance', door.x, door.z + 0.6, { name: 'mill-door', facing: 'down' });
  L.spawn = { x: 19, z: 18.4, facing: 'up' };
  return L;
}

// ---------------------------------------------------------------------------------------------
// Mill Road
// ---------------------------------------------------------------------------------------------

function millRoad() {
  const W = 56;
  const D = 18;
  const L = createEmptyLevel({ name: 'Mill Road', width: W, depth: D, fill: 'g', level: 2, border: 2 });
  L.subtitle = 'Down to the Wolf Ford';
  L.author = 'Luminati';
  L.description = 'The road from Millbrook to the old quarry, across the Wolf Ford.';
  L.environment = { ...L.environment, timeOfDay: 11 };
  const R = { j0: 7, j1: 10 };
  fill(L, 2, 2, W - 2, 5, 'G');
  fill(L, 0, R.j0, W, R.j1, '.');
  // the Wolf Ford: a river across the road
  fill(L, 28, 0, 36, D, 's', 1);
  fill(L, 29, 0, 35, D, '~', 0);
  fill(L, 0, 0, 2, D, 'T');
  fill(L, W - 2, 0, W, D, 'T');
  fill(L, 0, R.j0, 2, R.j1, '.');
  fill(L, W - 2, R.j0, W, R.j1, '.');
  fill(L, 28, R.j0, 29, R.j1, 's'); // (the road meets the shore)
  fill(L, 35, R.j0, 36, R.j1, 's');
  fill(L, 8, 11, 14, 15, 'f');
  fill(L, 42, 3, 50, 6, 'f');

  // the bridge: there once Hollis has mended it; the flood's wreckage until then
  put(L, 'ford_bridge', 'bridge', 27.4, 8.5, { x1: 36.6, z1: 8.5, when: 'bridge-mended', opts: { width: 2.4, arch: 0.3 } });
  put(L, 'wreck_1', 'crate', 26.9, 12.3, { rotation: 0.6, unless: 'bridge-mended' });
  put(L, 'wreck_2', 'barrel', 36.8, 6.6, { rotation: 1.2, opts: { lying: true }, unless: 'bridge-mended' });
  put(L, 'ford_sign', 'signpost', 26.2, 6.4, {
    rotation: 0.2, speaker: 'Notice',
    text: ['WOLF FORD — the bridge is out.', 'Ask {Hollis} in Millbrook. — Elder Wren'],
    unless: 'bridge-mended', opts: { boards: 1 },
  });
  put(L, 'sign_road', 'signpost', 6.5, 6.4, { rotation: 0.1, text: ['← {Millbrook}', '→ {Wolf Ford} · {the Old Quarry}'], opts: { boards: 2 } });
  addObject(L, 'lamppost', 25.6, 10.4, { rotation: Math.PI });
  addObject(L, 'lamppost', 38.4, 6.6, { rotation: 0 });
  addObject(L, 'campfire', 12, 12.6, { opts: { seat: true } });
  addObject(L, 'rock', 46.5, 12.5, { opts: { size: 0.9 } });
  addObject(L, 'rock', 20.5, 4.6, { opts: { size: 0.7 } });
  /** @type {[string, number, number, number][]} */
  const trees = [
    ['oak', 4.6, 3.5, 4.4], ['pine', 15.5, 3.6, 4.8], ['birch', 22.5, 14.6, 4.4], ['oak', 40.5, 14.4, 4.6],
    ['pine', 44.8, 4.2, 4.8], ['autumn', 51.5, 13.8, 4.2], ['birch', 52.4, 3.8, 4.6], ['oak', 4.5, 14.6, 4.4],
  ];
  for (const [kind, x, z, h] of trees) tree(L, kind, x, z, h);
  put(L, 'peddler', 'npc', 13.6, 11.4, {
    name: 'Gwil the Peddler', preset: 'merchant', wander: 0.4, speed: 0.6, portraitColor: '#a0703f',
    talk: [
      'if bridge-mended',
      '  - The bridge is back! I\'ll be over it by supper.',
      '  stop',
      'pick gwil',
      '  * - Resting my feet. Nobody gets over the ford these days.',
      '  * - Ilse? Saw her lantern bobbing up toward the {Old Quarry} the night of the flood.',
      '  * - Hollis? Slow as a mule, sure as one too.',
    ],
  });
  // the peddler hails whoever comes along the road (beside play; `pick`: the journey's seed decides)
  event(L, 'ev_gwil_hails', [10, 9, 17.5, 14], {
    on: 'enter', background: true,
    run: [
      'pick gwil-hails',
      '  * bark peddler Buttons! Ribbons! Nobody? Nobody.',
      '  * bark peddler Mind the ford, friend — the water\'s still high.',
      '  * bark peddler A copper for news of the east road!',
    ],
  });
  // Hollis at the ford with the planks (he walked off from Millbrook), until the story moves on
  put(L, 'hollis_ford', 'npc', 26.9, 11.1, {
    name: 'Hollis', preset: 'farmer', behaviour: 'post', wander: 0, facing: 'right', portraitColor: '#b07b44', actor: 'hollis',
    when: 'hollis-at-ford and not lantern-found',
  });
  // walking up to the broken bridge with Hollis there: he builds it (live: the bridge appears)
  event(L, 'ev_ford', [21.5, 6, 26.5, 11], { on: 'enter', once: true, if: 'hollis-at-ford and not bridge-mended', run: ['call ford-scene'] });
  // Gwil cheers when the bridge stands
  event(L, 'ev_cheer', [12, 10, 15, 13], { on: 'change', if: 'bridge-mended', run: ['emote peddler note 2'] });
  addObject(L, 'critters', 18, 13, { kind: 'bird', count: 3, radius: 2.2 });
  addObject(L, 'emitter', 32, 8.5, { preset: 'mist', size: [6, 1.6, 14], count: 18, dy: 0.4 });
  addObject(L, 'region', 0, 0, { name: 'Wolf Ford', sub: 'Mill Road', minX: 24, maxX: 40, minZ: 0, maxZ: D, banner: 'Where the river runs wide' });
  addObject(L, 'region', 0, 0, { name: 'Mill Road', sub: 'Between Millbrook and the Old Quarry', minX: 0, maxX: W, minZ: 0, maxZ: D });
  put(L, 'exit_west', 'exit', 0, 0, { minX: 0, maxX: 1.5, minZ: R.j0, maxZ: R.j1, to: 'millbrook' });
  put(L, 'exit_east', 'exit', 0, 0, { minX: W - 1.5, maxX: W, minZ: R.j0, maxZ: R.j1, to: 'old-quarry' });
  L.spawn = { x: 6, z: 8.5, facing: 'right' };
  return L;
}

// ---------------------------------------------------------------------------------------------
// The Old Quarry (combat)
// ---------------------------------------------------------------------------------------------

function oldQuarry() {
  const W = 36;
  const D = 30;
  const L = createEmptyLevel({ name: 'The Old Quarry', width: W, depth: D, fill: 'g', level: 2, border: 2 });
  L.subtitle = 'Where the Lantern Went';
  L.author = 'Luminati';
  L.description = 'An abandoned quarry east of the Wolf Ford, overrun by slimes since the flood. Ilse the ferryman waits on the ledge.';
  L.environment = { ...L.environment, timeOfDay: 15.5 };
  const R = { j0: 13, j1: 16 };
  fill(L, 2, 2, W - 2, D - 2, 'd');
  fill(L, 2, 2, 12, 9, 'G');
  fill(L, 0, R.j0, 14, R.j1, '.');
  // the ledge in the north-east (one level up) behind a rock face, a stair through it
  fill(L, 20, 3, 33, 10, 'm', 3);
  fill(L, 19, 10, 34, 11, 'x', 4);
  fill(L, 19, 2, 20, 10, 'x', 4);
  fill(L, 33, 2, 34, 10, 'x', 4);
  fill(L, 26, 10, 28, 11, '^', 2);
  fill(L, 14, 20, 20, 25, 'x', 3);
  fill(L, 2, 22, 8, 27, 'G');
  fill(L, 0, 0, 2, D, 'T');
  fill(L, 0, R.j0, 2, R.j1, '.');
  addObject(L, 'rock', 12.5, 19.4, { opts: { size: 1.1 } });
  addObject(L, 'rock', 30.5, 22.5, { opts: { size: 1.2 } });
  addObject(L, 'rock', 23.4, 15.6, { opts: { size: 0.8 } });
  addObject(L, 'crateStack', 9.4, 10.6, { rotation: 0.4, opts: { count: 3 } });
  addObject(L, 'barrel', 12.6, 9.4, { rotation: 0.2 });
  /** @type {[string, number, number, number][]} */
  const trees = [['pine', 4.4, 4.2, 4.8], ['birch', 9.5, 3.6, 4.4], ['pine', 4.2, 25.5, 4.6], ['oak', 33.0, 27.0, 4.4]];
  for (const [kind, x, z, h] of trees) tree(L, kind, x, z, h);

  put(L, 'waystone', 'waystone', 6.5, 17.6, { name: 'Quarry Gate' });
  put(L, 'slimes_floor', 'enemy', 18, 15, { kind: 'slime', count: 3, radius: 2.6, level: 1 });
  put(L, 'slimes_south', 'enemy', 26, 21.5, { kind: 'slime', count: 3, radius: 2.4, level: 2 });
  put(L, 'chest', 'chest', 31.2, 26.2, { rotation: Math.PI, gold: 40, potions: 1, upgrade: 'maxHp' });
  // (she waits on the ledge until she is home: then the quarry is empty — the ending is asked in Millbrook)
  put(L, 'ilse', 'npc', 27.2, 6.4, {
    name: 'Ilse', preset: 'hunter', behaviour: 'post', wander: 0, facing: 'down', portraitColor: '#7fd6a8', actor: 'ilse',
    unless: 'quest:find-ilse = done',
  });
  // the pack before the ledge falls: Ilse calls down
  event(L, 'ev_cleared', [16, 13, 20, 17], { on: 'cleared', group: 'slimes_floor', once: true, run: ['call quarry-cleared'] });
  event(L, 'ev_quarry', [2, 13, 5, 16], { on: 'arrive', once: true, run: [': Slime trails glisten on the quarry floor.'] });
  addObject(L, 'campfire', 25.4, 7.4, { opts: { seat: true } });
  addObject(L, 'light', 28.6, 6.0, { color: '#ffd27a', intensity: 5, distance: 6, dy: 1.2, nightOnly: false });
  addObject(L, 'emitter', 18, 16, { preset: 'dust', size: [14, 3, 10], count: 30, dy: 1.4 });
  addObject(L, 'region', 0, 0, { name: 'Ferryman\'s Ledge', sub: 'The Old Quarry', minX: 20, maxX: 33, minZ: 2, maxZ: 10.5, minY: 1.2, banner: 'A lantern still burns' });
  addObject(L, 'region', 0, 0, { name: 'The Old Quarry', sub: 'East of the Wolf Ford', minX: 0, maxX: W, minZ: 0, maxZ: D, banner: 'Mind the slimes' });
  put(L, 'exit_west', 'exit', 0, 0, { minX: 0, maxX: 1.5, minZ: R.j0, maxZ: R.j1, to: 'mill-road' });
  L.spawn = { x: 5, z: 14.5, facing: 'right' };
  return L;
}

// ---------------------------------------------------------------------------------------------
// The mill cellar (an interior)
// ---------------------------------------------------------------------------------------------

function millCellar() {
  const W = 16;
  const D = 12;
  const L = createEmptyLevel({ name: 'The Mill Cellar', width: W, depth: D, fill: 'k', level: 1, border: 0 });
  L.subtitle = 'Under the Mill House';
  L.author = 'Luminati';
  L.description = 'The miller\'s cellar: sacks, barrels and an old ferry chart.';
  // (its own hour: the campaign clock pauses down here and goes on outside)
  // (a dark backdrop round the room instead of the outdoor sky)
  // (a room: no weather down here — the campaign's goes on outside —, Millbrook set aside while the
  // player is in it and the cellar after they leave: CAMPAIGN_FORMAT.md §6.3)
  L.environment = { ...L.environment, timeOfDay: 11, clock: false, border: 'none', outerScenery: false, godRays: false, minimap: false, backdrop: '#0d0b12', camera: { distance: 20, pitch: 38 }, interior: true };
  // stone walls round a flagged floor; the stair up in the south wall
  fill(L, 0, 0, W, 2, 'x', 6);
  fill(L, 0, 0, 2, D, 'x', 6);
  fill(L, W - 2, 0, W, D, 'x', 6);
  fill(L, 0, D - 1, W, D, 'x', 2);
  fill(L, 7, D - 1, 9, D, 'b', 1);
  addObject(L, 'crateStack', 3.4, 3.2, { rotation: 0.1, opts: { count: 3 } });
  addObject(L, 'barrel', 6.0, 3.0, { rotation: 0.4 });
  addObject(L, 'barrel', 12.6, 3.1, { rotation: -0.3 });
  addObject(L, 'crate', 12.5, 6.4, { rotation: 0.2 });
  addObject(L, 'haystack', 3.2, 8.2, { opts: { size: 0.7 } });
  addObject(L, 'wallTorch', 8, 2.1, { rotation: 0 });
  addObject(L, 'light', 8, 6.5, { color: '#ffc98a', intensity: 6, distance: 9, dy: 2.2, nightOnly: false });
  put(L, 'chart', 'signpost', 10.4, 4.4, { rotation: 0, opts: { boards: 1 } });
  event(L, 'ev_chart', [9.6, 4.2, 11.2, 5.6], { on: 'use', label: 'Read', run: ['call ferry-chart'] });
  addObject(L, 'critters', 7, 8, { kind: 'cat', count: 1, radius: 2 });
  addObject(L, 'region', 0, 0, { name: 'The Mill Cellar', sub: 'Millbrook', minX: 0, maxX: W, minZ: 0, maxZ: D });
  put(L, 'exit_stairs', 'exit', 0, 0, { minX: 6.6, maxX: 9.4, minZ: 9.6, maxZ: 11, to: 'millbrook', entrance: 'mill-door', mode: 'use', label: 'Climb up' });
  put(L, 'from_mill', 'entrance', 8, 9.2, { name: 'from-mill', facing: 'up' });
  L.spawn = { x: 8, z: 9.2, facing: 'up' };
  return L;
}

// ---------------------------------------------------------------------------------------------
// The campaign
// ---------------------------------------------------------------------------------------------

const campaignRaw = {
  format: CAMPAIGN_FORMAT,
  version: 1,
  name: 'The Ferryman\'s Lantern',
  subtitle: 'A Luminati campaign',
  title: { title: 'THE FERRYMAN\'S LANTERN', subtitle: 'A short tale of Millbrook', credit: 'Luminati 2.5D Pixel-Art Engine · three.js' },
  start: { level: 'millbrook', entrance: '' },
  levels: [
    { id: 'millbrook', at: [0, 0] },
    { id: 'mill-road', at: [40, 8] },
    { id: 'old-quarry', at: [96, 2] },
    { id: 'mill-cellar' },
  ],
  chapters: [
    { id: 'the-flood', title: 'Chapter One', subtitle: 'The Broken Ford' },
    { id: 'lanterns-home', title: 'Chapter Two', subtitle: 'Lanterns Home', when: 'lantern-found', levels: { millbrook: 'millbrook-dusk' } },
  ],
  story: ['main.json', 'dialogue.story'],
};

// ---------------------------------------------------------------------------------------------
// The story files
// ---------------------------------------------------------------------------------------------

/** story/main.json: what the whole story shares. */
const STORY_MAIN = {
  vars: { 'visited-count': 1 },
  items: {
    plank: { name: 'Oak Plank', text: 'A sound oak plank from the stack by Millbrook\'s east road.' },
    'cellar-key': { name: 'Cellar Key', text: 'Miller Odo\'s iron key to the mill cellar.', key: true },
    'ferry-chart': { name: 'Ferry Chart', text: 'Ilse\'s chart of the river. "If the ford floods, wait it out on the quarry ledge."', key: true },
    'ferry-lantern': { name: 'Ferry Lantern', text: 'Ilse\'s lantern. It has not gone out since the flood.', key: true },
    'festival-bun': { name: 'Festival Bun', text: 'Millbrook flour, the elder\'s honey.' },
  },
  quests: {
    'find-ilse': {
      title: 'The Missing Ferryman',
      text: 'Ilse rowed east to the Old Quarry with the ferry lantern three nights ago and has not come back.',
      stages: [
        { id: 'asked', text: 'Elder Wren asked me to find Ilse. The bridge on the Mill Road is out — Hollis the carpenter might help.' },
        { id: 'planks', text: 'Hollis will mend the bridge, but the flood took his timber: he needs three oak planks from the stack by the east road.' },
        { id: 'bridge', text: 'Hollis mended the bridge at the Wolf Ford. The Old Quarry lies beyond it.' },
        { id: 'found', text: 'Ilse was on the quarry ledge, the lantern still burning. Time to bring her home.' },
        { id: 'home', text: 'Ilse and the lantern are home. Millbrook has lit every window.' },
      ],
      goals: [{ text: 'Oak planks for Hollis (${item:plank} of 3)', done: 'item:plank >= 3 or hollis-at-ford' }],
    },
  },
  actors: {
    wren: { name: 'Elder Wren', preset: 'elder', portraitColor: '#c9a45c', talk: 'wren' },
    hollis: { name: 'Hollis', preset: 'farmer', portraitColor: '#b07b44', talk: 'hollis' },
    odo: { name: 'Miller Odo', preset: 'merchant', portraitColor: '#d8b453', talk: 'odo' },
    ilse: { name: 'Ilse', preset: 'hunter', portraitColor: '#7fd6a8', talk: 'ilse' },
  },
  events: [
    { id: 'ford-open', on: 'change', if: 'bridge-mended', once: true, run: ['toast The way east lies open.'] },
    { id: 'count-places', on: 'arrive', run: ['var visited-count + 1'] },
  ],
  starts: {
    'at-the-ford': { level: 'mill-road', items: { plank: 3 }, vars: { 'hollis-at-ford': 1 }, quests: { 'find-ilse': 'planks' } },
    'chapter-two': { level: 'old-quarry', vars: { 'hollis-at-ford': 1, 'bridge-mended': 1 }, items: { 'cellar-key': 1 }, quests: { 'find-ilse': 'bridge' } },
  },
};

/** story/dialogue.story: the actors' talk and the cutscenes (`== <script id>` sections). */
const STORY_TEXT = {
  wren: [
    'if quest:find-ilse = done',
    '  - The whole village owes you, traveller. Look at the green!',
    '  stop',
    'if quest:find-ilse',
    '  cycle wren-reminder',
    '    * - Any word of Ilse? The ford first, then the {Old Quarry}.',
    '    * - Hollis will see to the bridge. He is slow, but he is sure.',
    '  stop',
    '- Ah, a traveller. Millbrook has a favour to ask of you.',
    '- Ilse the ferryman rowed east to the {Old Quarry} three nights ago, with the {ferry lantern}. She has not come back.',
    '- Without the lantern nobody crosses the Wolf Ford after dark.',
    'choice Would you look for her?',
    '  > I will find her',
    '    - Bless you. The bridge on the Mill Road is out — ask {Hollis} at his workshop.',
    '    quest find-ilse stage asked',
    '  > Not today',
    '    - Then the ford stays dark. Come back if your feet change their mind.',
  ],
  hollis: [
    'if bridge-mended',
    '  - She\'ll hold. I built that span to outlast me.',
    '  stop',
    'if hollis-at-ford',
    '  - The planks are in the water and the pegs are cut. Walk up to the bank when you\'re ready.',
    '  stop',
    'if not quest:find-ilse',
    '  - The ford bridge? The spring flood took the middle span clean away.',
    '  - Not much point mending it with nobody to cross.',
    '  stop',
    'if item:plank >= 3',
    '  - Three good oak planks! That will do it.',
    '  take plank 3',
    '  - Meet me at the Wolf Ford. Mind you don\'t fall in before I\'ve finished.',
    '  cutscene',
    '  camera hollis 0.8',
    '  walk hollis east-road run',
    '  set hollis-at-ford',
    '  camera reset 1',
    '  stop',
    'once hollis-asks',
    '  - For Ilse\'s sake I\'ll mend it. But the flood took my timber too.',
    '  - Bring me three {oak planks}: the miller stacks them by the east road to dry.',
    '  quest find-ilse stage planks',
    '  stop',
    '- Three {oak planks}, from the stack by the east road. You have ${item:plank}.',
  ],
  odo: [
    '- Flour, flour, always flour. And rats in the cellar, which is why I keep it locked.',
    'loop',
    '  choice What brings you to the mill?',
    '    > [once] Rats?',
    '      - Big as cats. Bigger than {my} cat, anyway.',
    '    > [if quest:find-ilse and not item:cellar-key] I\'m looking for Ilse.',
    '      - Ilse? She keeps an old ferry chart pinned up in my cellar. Here — the {cellar key}.',
    '      give cellar-key',
    '      break',
    '    > Good day.',
    '      - Mind the flour.',
    '      break',
  ],
  ilse: [
    'if quest:find-ilse = done',
    '  - The ford is lit again. If you are ever this way after dark, I will row you over myself.',
    '  choice',
    '    > Will you row me across tonight?',
    '      - Tonight? Under all these lanterns? Climb in.',
    '      ending lanterns-home The Lantern Home',
    '    > Another night.',
    '      - Another night, then.',
    '  stop',
    'if lantern-found',
    '  - Let\'s take it home. Millbrook will want to see it burning.',
    '  stop',
    '- You came all this way? The slimes cornered me up here when the flood came through.',
    '- The {ferry lantern} is safe — I kept it lit the whole time. Look.',
    'emote ilse ! 1.2',
    'give ferry-lantern',
    'set lantern-found',
    'quest find-ilse stage found',
    '- Let\'s take it home. Millbrook will want to see it burning.',
  ],
  'ford-scene': [
    'cutscene',
    'face player right',
    'camera hollis 1.2',
    'Hollis: There you are! Stand back from the bank.',
    'fade out 0.6',
    'sfx chime',
    'set bridge-mended',
    'quest find-ilse stage bridge',
    'wait 0.6',
    'fade in 0.8',
    'camera ford_bridge 1.2',
    'emote hollis note',
    'Hollis: Good as new. Better, even. Go and find her.',
    'camera reset 1',
  ],
  'quarry-cleared': [
    'camera ilse 1',
    'emote ilse !',
    'Ilse: Up here! The stair is round the east side of the rock.',
    'camera reset 1',
  ],
  'ferry-chart': [
    'if item:ferry-chart',
    '  : The beam where the chart hung is bare.',
    '  stop',
    ': An old chart of the river, pinned to a beam. A note in Ilse\'s hand:',
    ': {"If the ford floods, wait it out on the quarry ledge."}',
    'give ferry-chart',
  ],
  'welcome-home': [
    'cutscene',
    'camera green-centre 1.5',
    'walk ilse green-centre',
    'face ilse down',
    'Elder Wren: Ilse! Thank the river.',
    'Ilse: I said I would bring it home, didn\'t I?',
    'emote pip heart',
    'Pip: The lantern! I\'m ringing the bell!',
    'quest find-ilse stage home',
    'quest find-ilse done',
    'home ilse',
    'camera reset 1.2',
  ],
};

/** @type {[id: string, level: Level][]} */
const built = [
  ['millbrook', millbrook(false)],
  ['millbrook-dusk', millbrook(true)],
  ['mill-road', millRoad()],
  ['old-quarry', oldQuarry()],
  ['mill-cellar', millCellar()],
];

// ---- normalise, key, serialise, check ----
const problems = [];
/** @type {Map<string, string>} file → text */
const texts = new Map();
/** @type {Map<string, Level>} */
const levels = new Map();
// the content-text keys (docs/specs/I18N.md §4.10): every file's carried from the current file at
// its default path (never --out), new ones seeded by the file and the text; a chapter variant shares
// its base's key where its English is the same (the base is keyed first: `built` lists it first)
const DIR = `public/campaigns/${NAME}`;
/** @type {Map<string, string>} chapter variant → its base level */
const baseOf = new Map(campaignRaw.chapters.flatMap((ch) => Object.entries(ch.levels ?? {}).map(([b, v]) => [v, b])));
/** @type {Map<string, string[]>} base level → its chapter variants */
const variantsOf = new Map();
for (const [variant, base] of baseOf) variantsOf.set(base, [...(variantsOf.get(base) ?? []), variant]);
/** @type {Map<string, { level: Level, warnings: string[], previous: any }>} */
const keyed = new Map();
for (const [id, raw] of built) {
  const { level, warnings } = normalizeLevel(raw);
  level.objects = level.objects.map((o) => /** @type {LevelObject} */ (canonicalObject(o)));
  const base = baseOf.has(id) ? keyed.get(baseOf.get(id))?.level ?? null : null;
  // (a base's edit of a text its variants hold under the same key gets a key of its own: copy on
  // write — the variants keep theirs, and their translation)
  const shared = variantsOf.has(id) ? copyKeys(variantsOf.get(id).map((v) => previousOutput(root, `${DIR}/${levelFile(v)}`))) : null;
  const { previous } = keyLevel(level, { root, file: `${DIR}/${levelFile(id)}`, base, shared });
  keyed.set(id, { level, warnings, previous });
}
// (one key, one English: a key a variant and its base now hold with two Englishes stays with the
// copy whose English did not change; the other gets a new one)
for (const [variant, base] of baseOf) {
  const copies = [base, variant].map((id) => ({ file: `${DIR}/${levelFile(id)}`, ...keyed.get(id) }));
  const split = splitSharedKeys(copies);
  if (split) log(`  · text keys: ${split} text(s) of ${variant} and ${base} got a key of their own (their English differs now)`);
}
for (const [id, { level, warnings }] of keyed) {
  const errs = [...validateLevel(level), ...keyIssueLines(level)];
  const text = serializeLevel(level);
  if (serializeLevel(parseLevel(text).level) !== text) errs.push('does not re-serialise byte-identically');
  for (const m of [...warnings, ...errs]) problems.push(`${id}: ${m}`);
  texts.set(levelFile(id), text);
  levels.set(id, parseLevel(text).level);
}
// coverage: the demo campaign places every campaign type and uses every story field (a new one
// fails here until the campaign shows it, as Starfall Vale's coverage does for the other types)
const all = [...levels.values()].flatMap((l) => l.objects);
for (const type of Object.keys(OBJECT_TYPES).filter(isCampaignType)) {
  if (!all.some((o) => o.type === type)) problems.push(`coverage: no "${type}" object in the campaign`);
}
for (const [what, test] of /** @type {[string, (o: LevelObject) => boolean][]} */ ([
  ['a walk exit', (o) => o.type === 'exit' && o.mode === 'walk'], ['a Space exit', (o) => o.type === 'exit' && o.mode === 'use'],
  ['an exit with `requires`', (o) => o.type === 'exit' && !!o.requires], ['a villager `flag`', (o) => o.type === 'npc' && !!o.flag],
  ['a `when` object', (o) => !!o.when], ['an `unless` object', (o) => !!o.unless],
])) if (!all.some(test)) problems.push(`coverage: no ${what} in the campaign`);

// the story types, every event trigger, talk scripts and actors
for (const type of Object.keys(OBJECT_TYPES).filter(isStoryType)) {
  if (!all.some((o) => o.type === type)) problems.push(`coverage: no "${type}" object in the campaign`);
}
for (const { value } of EVENT_TRIGGERS) if (!all.some((o) => o.type === 'event' && o.on === value)) problems.push(`coverage: no "${value}" event in the campaign`);
for (const [what, test] of /** @type {[string, (o: LevelObject) => boolean][]} */ ([
  ['a villager `talk` script', (o) => o.type === 'npc' && Array.isArray(o.talk)], ['a villager `actor`', (o) => o.type === 'npc' && !!o.actor],
  ['a condition in `when`', (o) => /\s/.test(o.when ?? '')], ['an exit `requires` condition', (o) => o.type === 'exit' && /:/.test(o.requires ?? '')],
  ['a background event', (o) => o.type === 'event' && o.background === true],
  ['a `bark` line', (o) => o.type === 'event' && (Array.isArray(o.run) ? o.run : []).some((l) => /^\s*bark\s/.test(l))],
])) if (!all.some(test)) problems.push(`coverage: no ${what} in the campaign`);

// campaign.json and the story files: keyed as the levels are (carried from the current files)
const campaignKeyed = structuredClone(campaignRaw);
carryCampaignText(previousOutput(root, `${DIR}/campaign.json`), campaignKeyed, seededMint(`${DIR}/campaign.json`));
const storyMain = structuredClone(STORY_MAIN);
carryStoryFile(previousOutput(root, `${DIR}/${storyFile('main.json')}`), storyMain, seededMint(`${DIR}/${storyFile('main.json')}`));
const storyText = retagStoryText(previousOutput(root, `${DIR}/${storyFile('dialogue.story')}`, { text: true }) ?? '', serializeStoryText(STORY_TEXT), seededMint(`${DIR}/${storyFile('dialogue.story')}`));
for (const [file, issues] of /** @type {[string, ReturnType<typeof fileKeyIssues>][]} */ ([
  ['campaign.json', fileKeyIssues('campaign', campaignKeyed)], [storyFile('main.json'), fileKeyIssues('story', storyMain)],
  [storyFile('dialogue.story'), fileKeyIssues('storyText', storyText)],
])) for (const i of issues) problems.push(`${file}: text keys: ${i.where}: ${i.msg}`);

const { campaign, warnings: cw, errors: ce } = normalizeCampaign(campaignKeyed);
problems.push(...cw.map((m) => `campaign.json: ${m}`), ...ce.map((m) => `campaign.json: ${m}`));
texts.set('campaign.json', serializeCampaign(campaign));
texts.set(storyFile('main.json'), serializeStory(storyMain));
texts.set(storyFile('dialogue.story'), storyText);
// the story files read back as the game reads them: no warnings, every script parses
const { story, warnings: sw } = buildStory(campaign.story.map((f) => ({ name: f, text: texts.get(storyFile(f)) })));
problems.push(...sw.map((m) => `story: ${m}`));
for (const [id, sc] of Object.entries(story.scripts)) for (const e of parseScript(sc.lines).errors) problems.push(`${sc.file} › ${id}:${e.line}: ${e.msg}`);

const report = checkCampaign(campaign, (id) => (levels.has(id) ? { level: levels.get(id), warnings: [] } : null), {
  strict: false, readStory: (f) => texts.get(storyFile(f)) ?? null,
});
let nErr = problems.length + report.errors.length;
for (const [id, r] of report.levels) {
  nErr += r.report.errors.length;
  for (const m of r.report.errors) problems.push(`${id}: ✗ ${m}`);
  for (const m of r.report.warnings) log(`  ${id}: ! ${m}`);
}
for (const m of report.info) log(`  · ${m}`);
for (const m of report.warnings) log(`  ! ${m}`);
for (const m of [...problems, ...report.errors]) console.error(`  ✗ ${m}`);
log(`check: ${nErr} error(s), ${report.warnings.length + [...report.levels.values()].reduce((n, r) => n + r.report.warnings.length, 0)} warning(s)`);

const rel = path.relative(root, OUT) || '.';
if (args.check) {
  let differ = 0;
  for (const [file, text] of texts) {
    const f = path.join(OUT, file);
    const old = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : null;
    if (old !== text) { differ++; console.error(`${path.join(rel, file)} ${old == null ? 'does not exist' : 'differs from the generator output'}`); }
  }
  if (differ || nErr) process.exit(1);
  console.log(`${rel}: all ${texts.size} files are up to date (byte-identical).`);
  process.exit(0);
}
if (nErr && !args.force) {
  console.error(`not written: ${nErr} error(s) (--force writes anyway)`);
  process.exit(1);
}
for (const [file, text] of texts) {
  const f = path.join(OUT, file);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
}
console.log(`The Ferryman's Lantern → ${rel}: ${texts.size} files (${[...levels.entries()].map(([id, l]) => `${id} ${l.width}×${l.depth}`).join(', ')})`);
