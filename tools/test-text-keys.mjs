#!/usr/bin/env node
/**
 * test-text-keys.mjs — the Node self-test of the content-text keys (`npm run keys:test`,
 * docs/specs/I18N.md §4.2, §4.10): the GUIDs and the script line tags (ContentKeys.js), the parser's
 * tags (`tk`, a banner's `tks`, `stray`), the carry library (TextKeys.js: alignment; insert, delete,
 * edit, move and reorder; dialogue choices; scripts — string and list, banners, stray and copied
 * tags; a level's, a campaign's, a story file's and a `.story` file's own texts; `assignTextKeys`
 * with the previous output, a chapter variant's base and a renamed object; determinism; hostile
 * data), the formats' round trip with keys (levels, campaign.json, story files), the extractor
 * (ContentStrings.js lists the keys the data holds, '' for a text without one), the shipped data
 * (every text keyed, one key one English) and the key tool (`tools/i18n-keys.mjs`) on a temp tree.
 *
 *   node tools/test-text-keys.mjs [--verbose]
 *     --verbose   list every section with its count
 *
 * Prints a summary; exit code 1 when an assertion fails (each failure is listed with what it got).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import {
  isGuid, isTextKey, subtitleKey, guidOf, randomGuid, splitLineTag, tagLine, textKeyOf, pageKeyOf, dialogueKeyOf,
  choiceKeyOf, questKeyOf, cleanTextKeysOf, cleanQuestTextKeys, LINE_TAG, toGuid, TEXT_KEY_FIELDS,
} from '../src/engine/i18n/ContentKeys.js';
import {
  alignTexts, carryObjectText, carryRootText, carryCampaignText, carryStoryFile, retagScript, retagStoryText,
  stripScriptTags, assignTextKeys, textKeyIssues, seededMint, levelTexts, campaignTexts, storyFileTexts,
  storyTextTexts, fileKeyIssues, scriptTextLines,
} from '../src/engine/i18n/TextKeys.js';
import { parseScript, scriptTextSlots, holdsText } from '../src/engine/level/StoryScript.js';
import { OBJECT_TYPES, normalizeObject } from '../src/engine/level/ObjectCatalog.js';
import { levelStrings, campaignStrings, keyConflicts, slotKey } from '../src/engine/i18n/ContentStrings.js';
import { createEmptyLevel, addObject, normalizeLevel, parseLevel, serializeLevel } from '../src/engine/level/LevelFormat.js';
import { normalizeCampaign, serializeCampaign } from '../src/game/campaign/CampaignFormat.js';
import { buildStory, serializeStory } from '../src/game/campaign/StoryFormat.js';
import * as storyFormatIds from '../src/game/campaign/StoryFormat.js';
import { eventIdOf, stageIdOf } from '../src/engine/level/StoryCondition.js';
import { main as keysTool } from './i18n-keys.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verbose = process.argv.includes('--verbose');
const t0 = performance.now();
let passed = 0;
/** @type {string[]} */
const failures = [];
let section = '';
/** @type {[string, number][]} */
const sections = [];
const show = (v) => {
  try { return JSON.stringify(v); } catch { return String(v); }
};
function begin(name) {
  section = name;
  sections.push([name, 0]);
}
/** One assertion. @param {string} name @param {unknown} cond @param {unknown} [got] shown on failure */
function ok(name, cond, got) {
  if (cond) {
    passed++;
    sections[sections.length - 1][1]++;
  } else failures.push(`${section} › ${name}${got !== undefined ? ` — got ${show(got)}` : ''}`);
}
const eq = (name, actual, expected) => ok(name, isDeepStrictEqual(actual, expected), actual);
/** Run `fn`; a throw is a failure. */
function noThrow(name, fn) {
  try { fn(); ok(name, true); } catch (e) { ok(name, false, e instanceof Error ? e.stack : e); }
}

/** A counting minter: 0…01, 0…02 … (readable keys in the tests). */
function counter() {
  let n = 0;
  return () => (++n).toString(16).toUpperCase().padStart(32, '0');
}
const G = (c) => c.repeat(32);
/** `addObject` with the id given in `fields` (addObject makes its own). @param {any} L @param {string} type @param {Record<string, any>} fields */
const place = (L, type, fields) => {
  const o = addObject(L, /** @type {any} */ (type), 2, 2, fields);
  if (fields.id) o.id = fields.id;
  return o;
};
const tagOf = (l) => splitLineTag(l).tag;
/** The key of each text slot of a script (ContentStrings.slotKey). @param {string[]} lines */
const parseScriptSlots = (lines) => scriptTextSlots(parseScript(lines).nodes).map(slotKey);

// =================================================================================================
begin('GUIDs and line tags (ContentKeys.js)');
{
  const g = randomGuid();
  ok('randomGuid: 32 upper-case hex digits', isGuid(g) && g !== randomGuid(), g);
  eq('guidOf: the same seed, the same key', guidOf('a|b'), guidOf('a|b'));
  ok('… another seed, another key; always a GUID', guidOf('a|b') !== guidOf('a|c') && isGuid(guidOf('')) && isGuid(guidOf('é ✓ 漢字')));
  ok('isGuid: lower case, 31 or 33 digits, non-strings are none', !isGuid(G('a')) && !isGuid('A'.repeat(31)) && !isGuid('A'.repeat(33)) && !isGuid(null) && !isGuid(12));
  ok('isTextKey: a GUID, a subtitle key, a code key — never a positional key', isTextKey(G('A')) && isTextKey(`${G('A')}.2`) && isTextKey('dlg.elder.welcome') && !isTextKey('emberfall:elder.text[0]') && !isTextKey(`${G('a')}.2`));
  eq('subtitleKey: <GUID>.2 (none for no GUID)', [subtitleKey(G('B')), subtitleKey('x')], [`${G('B')}.2`, '']);
  eq('splitLineTag: a trailing tag after white space', splitLineTag(`  - Hi. #line:${G('C')}`), { text: '  - Hi.', tag: G('C') });
  eq('… a tab before it, trailing spaces and a CR after it', splitLineTag(`- Hi.\t#line:${G('C')}  \r`), { text: '- Hi.', tag: G('C') });
  eq('… a tag-only line', splitLineTag(`#line:${G('C')}`), { text: '', tag: G('C') });
  eq('… glued to the text: no tag', splitLineTag(`- Room#line:${G('C')}`).tag, '');
  eq('… lower-case digits: a tag, read in upper case (M10)', splitLineTag(`- Hi #line:${G('c')}`), { text: '- Hi', tag: G('C') });
  eq('… a tag in the middle: no tag', splitLineTag(`- Hi #line:${G('C')} there`).tag, '');
  eq('… "#" in prose stays prose', splitLineTag('- Room #4, please.'), { text: '- Room #4, please.', tag: '' });
  eq('tagLine: adds, replaces and removes the tag', [tagLine('- Hi.', G('D')), tagLine(`- Hi. #line:${G('C')}`, G('D')), tagLine(`- Hi. #line:${G('C')}`, '')], [`- Hi. ${LINE_TAG}${G('D')}`, `- Hi. ${LINE_TAG}${G('D')}`, '- Hi.']);
  const hostile = `${' '.repeat(200000)}#line:${'A'.repeat(31)}x`;
  const t = performance.now();
  splitLineTag(hostile);
  ok('splitLineTag is linear on a hostile line (200 000 spaces)', performance.now() - t < 200, performance.now() - t);
}

// =================================================================================================
begin('the parser: tags become keys (StoryScript.parseScript)');
{
  const [A, B, C, D, E, F, H, I, J] = 'ABCDEF123'.split('').map(G);
  const { nodes: parsed, errors, stray, parked } = parseScript([
    `Pip: Hello there. #line:${A}`,
    `choice Which way? #line:${B}`,
    `  > [once] North #line:${C}`,
    '    - Good.',
    `  > South #line:${D}`,
    `banner The Ford | Open at last #line:${E}`,
    `toast Rung. #line:${F}`,
    `quest ferry stage asked Ask in town. #line:${H}`,
    `quest ferry start The Ferry #line:${I}`,
    `set flag #line:${J}`,
    `# a comment #line:${'4'.repeat(32)}`,
    `bark pip Hey! #line:${'5'.repeat(32)}`,
    'ending best Lanterns Home',
    `cycle c`,
    `  * - One. #line:${'6'.repeat(32)}`,
  ]);
  /** @type {any[]} (the nodes' fields by kind) */
  const nodes = parsed;
  eq('no errors', errors, []);
  eq('a say: tk, the text without the tag, the speaker', [nodes[0].tk, nodes[0].text, nodes[0].speaker], [A, 'Hello there.', 'Pip']);
  eq('a choice: its question\'s tk and each option\'s', [nodes[1].tk, nodes[1].text, nodes[1].options.map((o) => [o.tk, o.label, o.once])], [B, 'Which way?', [[C, 'North', true], [D, 'South', false]]]);
  eq('an untagged line has no tk', nodes[1].options[0].body[0].tk, undefined);
  eq('a banner: one tag, two keys (the subtitle G.2), both texts clean', [nodes[2].tks, nodes[2].args.title, nodes[2].args.subtitle], [[E, `${E}.2`], 'The Ford', 'Open at last']);
  eq('a toast and a quest stage: tk, clean text', [nodes[3].tk, nodes[3].args.text, nodes[4].tk, nodes[4].args.text], [F, 'Rung.', H, 'Ask in town.']);
  eq('a quest start title (a term) holds no tag and takes no key', [nodes[5].args.text, nodes[5].tk], ['The Ferry', undefined]);
  eq('a bark: tk, clean text', [nodes[7].tk, nodes[7].args.text], ['5'.repeat(32), 'Hey!']);
  eq('an untagged ending: no tk', nodes[8].tk, undefined);
  eq('a `*` alternative\'s inline say takes its line\'s tag', nodes[9].alts?.[0]?.[0]?.tk ?? nodes[9].body?.[0]?.tk, '6'.repeat(32));
  eq('stray: the tags on `quest … start` and `set`; a comment line\'s tag is parked (M4)', [stray, parked], [[9, 10], [11]]);
  const long = parseScript([`- ${'x'.repeat(1990)} #line:${A}`]);
  eq('the 2000-character limit counts the text, not the tag', long.errors, []);
  eq('a lower-case tag is a tag (upper case): the text is clean (M10)', [/** @type {any} */ (parseScript([`- Hi #line:${G('a')}`]).nodes[0]).text, /** @type {any} */ (parseScript([`- Hi #line:${G('a')}`]).nodes[0]).tk], ['Hi', G('A')]);
  eq('a string script parses as its lines', parseScript(`- One. #line:${A}\n- Two.`).nodes.map((n) => /** @type {any} */ (n).tk), [A, undefined]);
}

// =================================================================================================
begin('alignTexts: what each new text continues');
{
  eq('unchanged', alignTexts(['a', 'b'], ['a', 'b']), [0, 1]);
  eq('an insert at the top, in the middle, at the end', [alignTexts(['a', 'b'], ['x', 'a', 'b']), alignTexts(['a', 'b'], ['a', 'x', 'b']), alignTexts(['a', 'b'], ['a', 'b', 'x'])], [[-1, 0, 1], [0, -1, 1], [0, 1, -1]]);
  eq('a delete', alignTexts(['a', 'b', 'c'], ['a', 'c']), [0, 2]);
  eq('an edit in place (a run as long)', alignTexts(['a', 'b', 'c'], ['a', 'B!', 'c']), [0, 1, 2]);
  eq('an edit next to an insert: the similar line is the edit, the other new', alignTexts(['one two three four', 'b'], ['one two three five', 'a brand new line here', 'b']), [0, -1, 1]);
  eq('a line replaced by an unlike one with an insert: new', alignTexts(['the old lantern burns', 'b'], ['x', 'something else entirely now', 'b']), [-1, -1, 1]);
  eq('a move (reorder): the moved line keeps its key', alignTexts(['a', 'b', 'c'], ['b', 'c', 'a']), [1, 2, 0]);
  eq('a swap', alignTexts(['a', 'b'], ['b', 'a']), [1, 0]);
  eq('a reversal', alignTexts(['x y z', 'b', 'c'], ['c', 'b', 'x y z']), [2, 1, 0]);
  eq('repeated texts in order', alignTexts(['No.', 'Yes.', 'No.'], ['No.', 'Maybe.', 'Yes.', 'No.']), [0, -1, 1, 2]);
  eq('each old text is continued once', alignTexts(['a'], ['a', 'a']), [0, -1]);
  eq('from nothing, to nothing', [alignTexts([], ['a']), alignTexts(['a'], [])], [[-1], []]);
}

// =================================================================================================
begin('carryObjectText: an object\'s keys through edits');
{
  const mint = counter();
  const npc0 = { id: 'pip', type: 'npc', name: 'Pip', title: 'Ferry Boy', dialogue: ['Hi.', { text: 'Rest?', choices: ['No', 'Yes'] }, 'Bye.'], talk: ['- Hey.', 'set x', 'Pip: Bye.'] };
  const a = carryObjectText(null, structuredClone(npc0), mint, new Set());
  ok('a new object: every text keyed (title, pages, choice page and choices, talk lines with text)', isGuid(a.textKeys.title) && isGuid(a.textKeys.dialogue[0]) && isGuid(a.textKeys.dialogue[1].key) && a.textKeys.dialogue[1].choices.every(isGuid) && isGuid(a.textKeys.dialogue[2]), a.textKeys);
  eq('… the talk: a tag on each line with text, none on `set`', a.talk.map((l) => !!tagOf(l)), [true, false, true]);
  ok('… the name is a term: no key', !('name' in a.textKeys));
  // insert a page, reorder choices, edit the question, add a choice
  const b = structuredClone(a);
  b.dialogue = ['New first.', 'Hi.', { text: 'Rest now?', choices: ['Yes', 'Maybe', 'No'] }, 'Bye.'];
  carryObjectText(a, b, mint, new Set());
  eq('an inserted page: the pages after it keep their keys', [b.textKeys.dialogue[1], b.textKeys.dialogue[3]], [a.textKeys.dialogue[0], a.textKeys.dialogue[2]]);
  ok('… the new page a new key', isGuid(b.textKeys.dialogue[0]) && !Object.values(a.textKeys).flat().includes(b.textKeys.dialogue[0]));
  eq('an edited question keeps its key', b.textKeys.dialogue[2].key, a.textKeys.dialogue[1].key);
  eq('reordered choices keep theirs; an added one is new', [b.textKeys.dialogue[2].choices[0], b.textKeys.dialogue[2].choices[2]], [a.textKeys.dialogue[1].choices[1], a.textKeys.dialogue[1].choices[0]]);
  ok('… the added choice', isGuid(b.textKeys.dialogue[2].choices[1]) && !a.textKeys.dialogue[1].choices.includes(b.textKeys.dialogue[2].choices[1]));
  // delete a page
  const c = structuredClone(b);
  c.dialogue = ['Hi.', 'Bye.'];
  carryObjectText(b, c, mint, new Set());
  eq('a deleted page takes its key with it; the others keep theirs', c.textKeys.dialogue, [b.textKeys.dialogue[1], b.textKeys.dialogue[3]]);
  // the talk: a move, an edit, an insert
  const d = structuredClone(a);
  d.talk = ['Pip: Bye.', '- Hey.', 'set x', '- Brand new line.'];
  carryObjectText(a, d, mint, new Set());
  eq('talk lines moved (reordered) keep their tags', [tagOf(d.talk[0]), tagOf(d.talk[1])], [tagOf(a.talk[2]), tagOf(a.talk[0])]);
  ok('a new talk line gets a new one', isGuid(tagOf(d.talk[3])) && ![tagOf(a.talk[0]), tagOf(a.talk[2])].includes(tagOf(d.talk[3])));
  const d2 = structuredClone(a);
  d2.talk = ['- Hey there, you.', '- An inserted line, quite unlike.', 'set x', 'Pip: Bye.'];
  carryObjectText(a, d2, mint, new Set());
  eq('an edited talk line keeps its tag (an insert beside it is new)', [tagOf(d2.talk[0]), tagOf(d2.talk[3])], [tagOf(a.talk[0]), tagOf(a.talk[2])]);
  ok('… the inserted one', isGuid(tagOf(d2.talk[1])) && ![tagOf(a.talk[0]), tagOf(a.talk[2])].includes(tagOf(d2.talk[1])));
  // blank and built-in
  const e = structuredClone(a);
  e.title = '  ';
  carryObjectText(a, e, mint, new Set());
  ok('a blank title drops its key', !('title' in e.textKeys));
  const ex = carryObjectText(null, { id: 'e', type: 'exit', label: 'Enter', locked: ['Closed.', '', 'Barred.'] }, mint, new Set());
  ok('a built-in label takes no key; locked pages parallel to the raw list, null on a blank one', !('label' in ex.textKeys) && isGuid(ex.textKeys.locked[0]) && ex.textKeys.locked[1] === null && isGuid(ex.textKeys.locked[2]), ex.textKeys);
  const ex2 = carryObjectText(ex, { ...structuredClone(ex), label: 'Climb up' }, mint, new Set());
  ok('… a label of its own is keyed', isGuid(ex2.textKeys.label));
  const sign = carryObjectText(null, { id: 's', type: 'signpost', text: 'One string.' }, mint, new Set());
  ok('a one-string `lines` field: one key', Array.isArray(sign.textKeys.text) && sign.textKeys.text.length === 1 && isGuid(sign.textKeys.text[0]));
  const well = carryObjectText(null, { id: 'w', type: 'well', text: ['A.', 7, { x: 1 }] }, mint, new Set());
  ok('a number page is a page; an object entry is none', isGuid(well.textKeys.text[1]) && well.textKeys.text[2] === null, well.textKeys);
  const tree = carryObjectText(null, { id: 't', type: 'tree', textKeys: { text: [G('A')] } }, mint, new Set());
  ok('an object type with no texts: no textKeys', !('textKeys' in tree));
  // nothing changed but keys missing: fill in
  const f = structuredClone(a);
  delete f.textKeys.title;
  f.talk[0] = splitLineTag(f.talk[0]).text;
  carryObjectText(f, f, mint, new Set());
  ok('carryObjectText(obj, obj): fills in missing keys, keeps the rest', isGuid(f.textKeys.title) && f.textKeys.title !== a.textKeys.title && isDeepStrictEqual(f.textKeys.dialogue, a.textKeys.dialogue) && tagOf(f.talk[2]) === tagOf(a.talk[2]) && isGuid(tagOf(f.talk[0])), f);
  const g = structuredClone(a);
  carryObjectText(null, g, mint, new Set());
  eq('carryObjectText(null, obj) keeps the object\'s own keys', [g.textKeys, g.talk], [a.textKeys, a.talk]);
  // a key is used once in a level
  const used = new Set();
  const o1 = carryObjectText(null, structuredClone(a), mint, used);
  const o2 = carryObjectText(null, structuredClone(a), mint, used);
  ok('a key used once per `used` set: the copy gets fresh keys', o1.textKeys.title === a.textKeys.title && isGuid(o2.textKeys.title) && o2.textKeys.title !== a.textKeys.title && tagOf(o2.talk[0]) !== tagOf(a.talk[0]));
}

// =================================================================================================
begin('scripts: retagScript, stripScriptTags, scriptTextLines');
{
  const mint = counter();
  const s = retagScript(undefined, '- One.\nset x\nbanner Title | Sub\n- Two.', mint, new Set());
  ok('a string script stays a string', typeof s === 'string');
  const lines = String(s).split('\n');
  eq('tags on the lines with text (a banner: one tag)', lines.map((l) => !!tagOf(l)), [true, false, true, true]);
  const arr = /** @type {string[]} */ (retagScript(undefined, ['- One.', 'choice Go?', '  > Yes', '  > No'], mint, new Set()));
  ok('a list stays a list, one line per entry', Array.isArray(arr) && arr.length === 4 && arr.every((l) => !!tagOf(l)), arr);
  const stray = /** @type {string[]} */ (retagScript(arr, [`set x #line:${G('E')}`, ...arr], mint, new Set()));
  eq('a tag on a line with no text is dropped', stray[0], 'set x');
  const copied = /** @type {string[]} */ (retagScript(arr, [...arr, arr[0]], mint, new Set()));
  ok('a copied line (its tag twice): the copy gets a new tag', tagOf(copied[0]) === tagOf(arr[0]) && isGuid(tagOf(copied[4])) && tagOf(copied[4]) !== tagOf(arr[0]), copied);
  const own = /** @type {string[]} */ (retagScript(arr, [`- Mine. #line:${G('F')}`], mint, new Set()));
  eq('a line\'s own free tag wins', tagOf(own[0]), G('F'));
  eq('stripScriptTags: the same shape, no tags', [stripScriptTags(s), stripScriptTags(arr)], ['- One.\nset x\nbanner Title | Sub\n- Two.', ['- One.', 'choice Go?', '  > Yes', '  > No']]);
  eq('stripScriptTags leaves other values', [stripScriptTags(undefined), stripScriptTags(3)], [undefined, 3]);
  eq('scriptTextLines: the lines with text and their texts', [...scriptTextLines(['- A.', 'choice Q?', '  > Yes', '    - Y.', 'banner T | S', 'quest q stage s', 'ending e End'])], [[1, ['A.']], [2, ['Q?']], [3, ['Yes']], [4, ['Y.']], [5, ['T', 'S']], [7, ['End']]]);
  eq('a script that does not parse keeps the lines it has', /** @type {string[]} */ (retagScript(undefined, ['- Fine.', 'if (', '- Also fine.'], mint, new Set())).map((l) => !!tagOf(l)), [true, false, true]);
}

// =================================================================================================
begin('a level\'s, a campaign\'s and a story file\'s own texts');
{
  const mint = counter();
  const lv = { subtitle: 'A Sub', environment: { title: { title: 'T', prompt: 'Press' } } };
  carryRootText(null, lv, mint, new Set());
  ok('a level: subtitle and the title overrides', isGuid(lv.textKeys.subtitle) && isGuid(lv.textKeys['title.title']) && isGuid(lv.textKeys['title.prompt']) && !('title.credit' in lv.textKeys), lv.textKeys);
  const lv2 = { subtitle: 'A Sub, edited', environment: { title: { title: 'T' } } };
  carryRootText(lv, lv2, mint, new Set());
  eq('… an edit keeps the key; a cleared text loses it', [lv2.textKeys.subtitle, lv2.textKeys['title.title'], 'title.prompt' in lv2.textKeys], [lv.textKeys.subtitle, lv.textKeys['title.title'], false]);
  const camp = { subtitle: 'S', title: { title: 'T' }, chapters: [{ id: 'one', title: 'One', subtitle: 'First' }, { id: 'two', title: 'Two' }] };
  carryCampaignText(null, camp, mint);
  ok('a campaign: its texts and each chapter\'s', isGuid(camp.textKeys.subtitle) && isGuid(camp.chapters[0].textKeys.subtitle) && isGuid(camp.chapters[1].textKeys.title) && !('subtitle' in camp.chapters[1].textKeys));
  const camp2 = structuredClone(camp);
  delete camp2.textKeys; for (const c of camp2.chapters) delete c.textKeys;
  camp2.chapters.reverse();
  carryCampaignText(camp, camp2, mint);
  eq('… chapters matched by id', [camp2.chapters[1].textKeys, camp2.chapters[0].textKeys], [camp.chapters[0].textKeys, camp.chapters[1].textKeys]);
  const story = {
    items: { plank: { name: 'Plank', text: 'A plank.' }, rope: { name: 'Rope' } },
    quests: { q: { title: 'Q', text: 'Go.', stages: [{ id: 'a', text: 'A.' }, { id: 'b', text: 'B.' }], goals: [{ text: 'One.' }, { text: '' }, { text: 'Two.' }] } },
    scripts: { s: ['- Hi.', 'set x'] },
    actors: { wren: { name: 'Wren', talk: ['- Child.'] }, odo: { name: 'Odo', talk: 'odo' } },
    events: [{ id: 'e1', run: ['toast Done.'] }, { id: 'e2', run: 'named' }],
  };
  carryStoryFile(null, story, mint);
  ok('a story file: items (none for no text), quests, stages, goals (null for a blank one)', isGuid(story.items.plank.textKeys.text) && !story.items.rope.textKeys && isGuid(story.quests.q.textKeys.text) && isGuid(story.quests.q.textKeys.stages.b) && story.quests.q.textKeys.goals[1] === null && isGuid(story.quests.q.textKeys.goals[2]), story);
  ok('… its scripts, an actor\'s inline talk, an event\'s inline run', isGuid(tagOf(story.scripts.s[0])) && !tagOf(story.scripts.s[1]) && isGuid(tagOf(story.actors.wren.talk[0])) && story.actors.odo.talk === 'odo' && isGuid(tagOf(story.events[0].run[0])) && story.events[1].run === 'named');
  const story2 = structuredClone(story);
  story2.quests.q.stages.reverse();
  story2.quests.q.goals = [{ text: 'Zero.' }, { text: 'One.' }, { text: 'Two.' }];
  story2.scripts.s = ['- New.', '- Hi.'];
  carryStoryFile(story, story2, mint);
  eq('… stages by id, goals aligned by text, script lines carried', [story2.quests.q.textKeys.stages, story2.quests.q.textKeys.goals.slice(1), tagOf(story2.scripts.s[1])], [story.quests.q.textKeys.stages, [story.quests.q.textKeys.goals[0], story.quests.q.textKeys.goals[2]], tagOf(story.scripts.s[0])]);
  const st0 = '== wren\n- Ah, a traveller.\nchoice Help?\n  > Yes\n\n== odo\n- Flour.\n';
  const st1 = retagStoryText('', st0, mint);
  ok('a .story file: its scripts\' lines tagged, headers never, the final line break kept', /^== wren\n- Ah, a traveller\. #line:[0-9A-F]{32}\nchoice Help\? #line:[0-9A-F]{32}\n {2}> Yes #line:[0-9A-F]{32}\n\n== odo\n- Flour\. #line:[0-9A-F]{32}\n$/.test(st1), st1);
  const st2 = retagStoryText(st1, '== odo\n- Flour.\n- More flour.\n\n== wren\n- Ah, a traveller.\nchoice Help?\n  > Yes\n', mint);
  eq('… scripts matched by id (reordered), a new line minted', [tagOf(st2.split('\n')[1]), tagOf(st2.split('\n')[5])], [tagOf(st1.split('\n')[6]), tagOf(st1.split('\n')[1])]);
  const crlf = retagStoryText('', '== a\r\n- One.\r\n', mint);
  ok('… a CRLF file keeps its line ending, tags at the line ends (M9)', /^== a\r\n- One\. #line:[0-9A-F]{32}\r\n$/.test(crlf), crlf);
}

// =================================================================================================
begin('assignTextKeys: the generators\' pass');
{
  /** @returns {any} */
  const level = (objects, extra = {}) => ({ objects, subtitle: 'The Sub', ...extra });
  const v1 = level([
    { id: 'well', type: 'well', text: ['Deep.', 'Cold.'] },
    { id: 'pip', type: 'npc', name: 'Pip', dialogue: ['Hi.', 'Hello, traveler!'], talk: ['- Hey.'] },
    { id: 'sign', type: 'signpost', text: ['North.'] },
  ]);
  const r1 = assignTextKeys(v1, { mint: seededMint('file.json') });
  eq('a first run: everything minted', [r1.minted, r1.carried, r1.shared], [7, 0, 0]);
  const again = structuredClone(v1);
  for (const o of again.objects) { delete o.textKeys; if (o.talk) o.talk = stripScriptTags(o.talk); }
  delete again.textKeys;
  const r2 = assignTextKeys(again, { previous: v1, mint: seededMint('file.json') });
  ok('a second run with the previous output: every key carried, the same level', r2.minted === 0 && isDeepStrictEqual(again, v1), r2);
  const fresh = structuredClone(again);
  for (const o of fresh.objects) { delete o.textKeys; if (o.talk) o.talk = stripScriptTags(o.talk); }
  delete fresh.textKeys;
  assignTextKeys(fresh, { mint: seededMint('file.json') });
  eq('deterministic: the same input, the same keys (no previous)', fresh, v1);
  const other = structuredClone(fresh);
  for (const o of other.objects) { delete o.textKeys; if (o.talk) o.talk = stripScriptTags(o.talk); }
  delete other.textKeys;
  assignTextKeys(other, { mint: seededMint('another.json') });
  ok('… another file, other keys', other.objects[0].textKeys.text[0] !== v1.objects[0].textKeys.text[0]);
  // an edit, an insert and a renamed object
  const v2 = structuredClone(v1);
  for (const o of v2.objects) delete o.textKeys;
  v2.objects[0].text = ['Very deep.', 'Cold.'];
  v2.objects[2].id = 'sign_north';
  v2.objects.push({ id: 'sign_2', type: 'signpost', text: ['North.'] });
  assignTextKeys(v2, { previous: v1, mint: seededMint('file.json') });
  eq('an edited text keeps its key', v2.objects[0].textKeys.text[0], v1.objects[0].textKeys.text[0]);
  eq('a renamed object keeps its texts\' keys (type, field and English)', v2.objects[2].textKeys.text[0], v1.objects[2].textKeys.text[0]);
  ok('… another new object with that English gets its own', isGuid(v2.objects[3].textKeys.text[0]) && v2.objects[3].textKeys.text[0] !== v1.objects[2].textKeys.text[0]);
  const v3 = structuredClone(v1);
  for (const o of v3.objects) delete o.textKeys;
  v3.objects.unshift({ id: 'sign_0', type: 'signpost', text: ['North.'] });
  assignTextKeys(v3, { previous: v1, mint: seededMint('file.json') });
  ok('an object still there keeps its keys; a new one placed before it never takes them', v3.objects[3].textKeys.text[0] === v1.objects[2].textKeys.text[0] && v3.objects[0].textKeys.text[0] !== v1.objects[2].textKeys.text[0], v3.objects.map((o) => o.textKeys));
  // a chapter variant
  const variant = level([
    { id: 'well', type: 'well', text: ['Deep.', 'Colder now.'] },
    { id: 'pip', type: 'npc', name: 'Pip', dialogue: ['Hi.', 'Hello, traveler!'], talk: ['- Hey.', '- Lanterns!'] },
    { id: 'ilse', type: 'npc', name: 'Ilse', dialogue: ['Hi.'] },
  ], { subtitle: 'The Sub' });
  const rv = assignTextKeys(variant, { base: v1, mint: seededMint('variant.json') });
  eq('a variant shares the base\'s key for the same English at the same place', [variant.objects[0].textKeys.text[0], variant.objects[1].textKeys.dialogue, tagOf(variant.objects[1].talk[0]), variant.textKeys.subtitle], [v1.objects[0].textKeys.text[0], v1.objects[1].textKeys.dialogue, tagOf(v1.objects[1].talk[0]), v1.textKeys.subtitle]);
  ok('… a changed text, a new line and another villager\'s same English get their own', ![...levelTexts(v1)].map((t) => t.key).includes(variant.objects[0].textKeys.text[1]) && !levelTexts(v1).map((t) => t.key).includes(tagOf(variant.objects[1].talk[1])) && variant.objects[2].textKeys.dialogue[0] !== v1.objects[1].textKeys.dialogue[0]);
  eq('… counted', [rv.shared, rv.minted], [5, 3]);
  eq('textKeyIssues of a keyed level: none', [textKeyIssues(v1), textKeyIssues(variant)], [[], []]);
}

// =================================================================================================
begin('issues and keyed texts');
{
  const L = {
    subtitle: 'Sub',
    objects: [
      { id: 'h', type: 'house', text: ['A.', '', 'B.'], textKeys: { text: [G('A'), G('B'), null] } },
      { id: 'n', type: 'npc', name: 'N', title: '', dialogue: [{ text: 'Q?', choices: ['Y', 'N'] }], textKeys: { title: G('C'), dialogue: [{ key: G('A'), choices: [G('D')] }] }, talk: [`set x #line:${G('E')}`, '- Hi.'] },
    ],
  };
  const issues = textKeyIssues(L);
  const kinds = (k) => issues.filter((i) => i.kind === k).map((i) => i.where);
  eq('missing: a page, a choice, a talk line, the subtitle', kinds('missing'), ['h › text[2]', 'n › dialogue[0].choices[1]', 'n › talk:2', 'level › subtitle']);
  eq('stray: a key on a blank page, on a blank title, a tag on `set`', kinds('stray'), ['h › text[1]', 'n › title', 'n › talk:1']);
  eq('repeated: one key on two texts (an error)', issues.filter((i) => i.kind === 'repeated').map((i) => [i.where, i.severity]), [['n.textKeys.dialogue[0].key', 'error']]);
  const texts = levelTexts(L);
  eq('levelTexts: every text with its key (\'\' when none)', texts.map((t) => [t.where, t.key ? t.key[0] : '']), [['h › text[0]', 'A'], ['h › text[2]', ''], ['n › dialogue[0]', 'A'], ['n › dialogue[0].choices[0]', 'D'], ['n › dialogue[0].choices[1]', ''], ['n › talk:2', ''], ['level › subtitle', '']]);
  const mint = counter();
  for (const t of texts) if (!t.key) t.set(mint());
  texts.find((t) => t.where === 'n › dialogue[0]')?.set(mint());
  eq('… set: makes the holders as needed, retags a script line', textKeyIssues(L).filter((i) => i.kind !== 'stray'), []);
  eq('… the choice list and the page entry', L.objects[1].textKeys.dialogue[0].choices.length, 2);
  const camp = { subtitle: 'S', textKeys: { 'title.title': G('A') }, chapters: [{ id: 'c', title: 'T', textKeys: { title: G('A'), subtitle: G('B') } }] };
  eq('a campaign file: missing, stray (a key on no text is no text: no repeat)', fileKeyIssues('campaign', camp).map((i) => [i.kind, i.where]), [['missing', 'campaign › subtitle'], ['stray', 'campaign › title.title'], ['stray', 'chapter c › subtitle']]);
  const camp2 = { subtitle: 'S', textKeys: { subtitle: G('A') }, chapters: [{ id: 'c', title: 'T', textKeys: { title: G('A') } }] };
  eq('… repeated: one key on two texts', fileKeyIssues('campaign', camp2).map((i) => [i.kind, i.where, i.severity]), [['repeated', 'chapter c › title', 'error']]);
  const story = { items: { a: { text: '', textKeys: { text: G('A') } } }, quests: { q: { text: 'Q', stages: [{ id: 's', text: 'S' }], textKeys: { text: G('B'), stages: { gone: G('C') }, goals: [G('D')] } } }, scripts: { x: [`- Hi. #line:${G('B')}`, `wait 1 #line:${G('E')}`] } };
  eq('a story file: missing, stray, repeated', fileKeyIssues('story', story).map((i) => [i.kind, i.where]), [['missing', 'quest q › stage s'], ['repeated', 'script x:1'], ['stray', 'item a › text'], ['stray', 'quest q › stage gone'], ['stray', 'quest q › goal[0]'], ['stray', 'script x:2']]);
  eq('a .story file: missing, stray (also before the first header)', fileKeyIssues('storyText', `#line:${G('A')}\n== s\n- One.\nset x #line:${G('B')}`).map((i) => [i.kind, i.where]), [['missing', 'line 3 (s)'], ['stray', 'line 1'], ['stray', 'line 4 (s)']]);
  const lines = ['== s', '- One.', '', '== t', '- Two.'];
  const st = storyTextTexts(lines);
  st[1].set(G('F'));
  eq('storyTextTexts: by the file\'s lines; set retags in place', [st.map((t) => t.where), lines[4]], [['line 2 (s)', 'line 5 (t)'], `- Two. #line:${G('F')}`]);
  eq('campaignTexts / storyFileTexts: the texts in order', [campaignTexts(camp).map((t) => t.where), storyFileTexts(story).map((t) => t.where)], [['campaign › subtitle', 'chapter c › title'], ['quest q › text', 'quest q › stage s', 'script x:1']]);
}

// =================================================================================================
begin('hostile data');
{
  const mint = counter();
  const proto = JSON.parse(`{ "id": "x", "type": "npc", "dialogue": ["Hi."], "textKeys": { "__proto__": { "polluted": "${G('A')}" }, "constructor": "${G('A')}", "dialogue": "${G('B')}", "title": 5 } }`);
  eq('readers: own well-formed keys only', [textKeyOf({ textKeys: {} }, 'constructor'), textKeyOf(proto, 'title'), dialogueKeyOf(proto, 0), pageKeyOf(proto, 'dialogue', 0), choiceKeyOf(proto, 0, 0), textKeyOf({}, 'toString'), questKeyOf({ textKeys: { stages: { __proto__: G('A') } } }, 'stage', '__proto__')], ['', '', '', '', '', '', '']);
  const cleaned = cleanTextKeysOf('npc', proto.textKeys);
  ok('cleanTextKeysOf: unknown fields and wrong shapes dropped and counted', cleaned.keys === undefined && cleaned.dropped >= 3 && !({}).polluted, cleaned);
  const q = cleanQuestTextKeys({ text: 'x', stages: { __proto__: G('A'), ok: G('B') }, goals: [G('C'), 'bad', null], junk: 1 });
  eq('cleanQuestTextKeys: a malformed key in a list becomes null', q.keys, { stages: { ok: G('B') }, goals: [G('C'), null, null] });
  const nasty = [
    { id: '__proto__', type: 'npc', name: 'X', dialogue: [null, 7, { text: 5 }, { text: 'Q', choices: [null, {}, 'Y'] }], talk: [1, null, '- Hi.'], textKeys: 'junk' },
    { id: 'c', type: 'constructor', text: ['x'] },
    { id: 'h', type: 'house', text: { 0: 'not a list' }, textKeys: { text: { length: 5 } } },
    null, 'string', [],
  ];
  const L = { objects: nasty, textKeys: [] };
  noThrow('carryObjectText, assignTextKeys, textKeyIssues, levelTexts: no throw on hostile objects', () => {
    for (const o of nasty) if (o && typeof o === 'object' && !Array.isArray(o)) carryObjectText(o, structuredClone(o), mint, new Set());
    assignTextKeys(structuredClone(L), { previous: L, base: L, mint });
    textKeyIssues(L);
    levelTexts(L);
  });
  noThrow('the story and campaign carriers on hostile files', () => {
    carryStoryFile({ items: 5 }, { items: { a: null, b: { text: 3 } }, quests: { q: { stages: 'x', goals: [null, 4] } }, scripts: { s: 7 }, actors: [null], events: { e: { run: [1, '- Hi.'] } } }, mint);
    carryCampaignText({ chapters: 'x' }, { chapters: [null, { id: {}, title: 7 }], title: 'flat' }, mint);
    fileKeyIssues('story', { quests: { q: { textKeys: { stages: 5, goals: 'x' } } } });
    fileKeyIssues('campaign', null);
    fileKeyIssues('storyText', null);
  });
  const big = Array.from({ length: 3000 }, (_, i) => `Line ${i % 50}.`);
  const t = performance.now();
  alignTexts(big, [...big.slice(1), 'tail']);
  ok('alignTexts on 3000 lines in well under a second', performance.now() - t < 1500, performance.now() - t);
}

// =================================================================================================
begin('review: keys reserved, two phases (M1, C8)');
{
  // the generators' pass: an edit keeps its key; a text inserted later whose seed made that key gets another
  const mk = (pages) => ({ objects: [{ id: 'elder', type: 'npc', name: 'E', title: '', dialogue: pages }] });
  const run = (pages, prev) => { const lv = mk(pages); assignTextKeys(lv, { previous: prev, mint: seededMint('f.json') }); return lv; };
  const r1 = run(['Hello'], null);
  const r2 = run(['Hello there'], r1);
  const r3 = run(['Hello', 'Hello there'], r2);
  const d = (lv) => /** @type {any} */ (lv).objects[0].textKeys.dialogue;
  ok('M1: assignTextKeys — the edit keeps its key, the text inserted with the first one\'s seed gets another', d(r2)[0] === d(r1)[0] && d(r3)[1] === d(r1)[0] && isGuid(d(r3)[0]) && d(r3)[0] !== d(r3)[1] && textKeyIssues(r3).length === 0, [d(r1), d(r2), d(r3)]);
  // the editor's carry: the same, in two phases (every kept key taken before any is minted)
  const mint = seededMint('t');
  const o1 = carryObjectText(null, { id: 'n', type: 'npc', dialogue: ['Hello'] }, mint, new Set());
  const o2 = carryObjectText(o1, { id: 'n', type: 'npc', dialogue: ['Hello there'] }, mint, new Set());
  const o3 = carryObjectText(o2, { id: 'n', type: 'npc', dialogue: ['Hello', 'Hello there'] }, seededMint('t'), new Set());
  ok('M1: carryObjectText — the carried key is taken before the new text is minted', o3.textKeys.dialogue[1] === o1.textKeys.dialogue[0] && isGuid(o3.textKeys.dialogue[0]) && o3.textKeys.dialogue[0] !== o3.textKeys.dialogue[1], o3.textKeys);
  // a minter that gives a key already taken: asked again; what it mints is added to `used`
  const used = new Set([G('A')]);
  let calls = 0;
  const stubborn = () => (++calls < 3 ? G('A') : G('B'));
  const o4 = carryObjectText(null, { id: 'n', type: 'npc', dialogue: ['One.', 'Two.'] }, stubborn, used);
  ok('M1: a minted key is never one in `used`; each one minted is added', !o4.textKeys.dialogue.includes(G('A')) && o4.textKeys.dialogue.every(isGuid) && new Set(o4.textKeys.dialogue).size === 2 && o4.textKeys.dialogue.every((k) => used.has(k)), [o4.textKeys, [...used]]);
  const s1 = /** @type {string[]} */ (retagScript(undefined, ['- One.', '- Two.'], () => G('C'), new Set()));
  ok('M1: a minter that always gives one key: the others are derived (no repeat)', new Set(s1.map(tagOf)).size === 2 && s1.every((l) => isGuid(tagOf(l))), s1);
  // the previous output's keys are reserved: a new text never gets a key the previous file held
  const prev = { objects: [{ id: 's', type: 'signpost', text: ['Old'], textKeys: { text: [guidOf('f.json|s.text|0|New')] } }] };
  const lv = { objects: [{ id: 's', type: 'signpost', text: ['New'] }] };
  assignTextKeys(lv, { previous: prev, mint: seededMint('f.json') });
  ok('M1: a key the previous output held is never minted again (an unlike text replaced it)', isGuid(lv.objects[0].textKeys.text[0]) && lv.objects[0].textKeys.text[0] !== prev.objects[0].textKeys.text[0], lv.objects[0].textKeys);
  // C8: `used` is required where a key must be unique in the level
  const throws = (fn) => { try { fn(); return false; } catch (e) { return e instanceof TypeError; } };
  ok('C8: carryObjectText, carryRootText and retagScript require `used`', throws(() => /** @type {any} */ (carryObjectText)(null, { id: 'x', type: 'npc', title: 'T' }, mint)) && throws(() => /** @type {any} */ (carryRootText)(null, { subtitle: 'S' }, mint)) && throws(() => /** @type {any} */ (retagScript)(undefined, ['- A.'], mint)));
}

// =================================================================================================
begin('review: the generators\' pass (M2, M3, S1)');
{
  const sg = (id, t) => ({ id, type: 'signpost', text: [t] });
  const prev = { objects: [sg('signpost_1', 'North: the mill.'), sg('signpost_2', 'East: the harbour.'), sg('signpost_3', 'South: the abbey.')] };
  assignTextKeys(prev, { mint: seededMint('lv') });
  const next = { objects: [sg('signpost_1', 'North: the mill.'), sg('signpost_2', 'West: the quarry.'), sg('signpost_3', 'East: the harbour.'), sg('signpost_4', 'South: the abbey.')] };
  assignTextKeys(next, { previous: prev, mint: seededMint('lv') });
  const k = (lv, n) => lv.objects[n].textKeys.text[0];
  eq('M2: a sign inserted before counter-named ones — every text keeps its key, the new one gets its own', [k(next, 0), k(next, 2), k(next, 3)], [k(prev, 0), k(prev, 1), k(prev, 2)]);
  ok('… the inserted text: a new key', isGuid(k(next, 1)) && ![k(prev, 0), k(prev, 1), k(prev, 2)].includes(k(next, 1)) && textKeyIssues(next).length === 0);
  const unlike = { objects: [sg('signpost_1', 'Completely other words here.'), sg('signpost_2', 'East: the harbour, by the old pier.'), sg('signpost_3', 'South: the abbey.')] };
  assignTextKeys(unlike, { previous: prev, mint: seededMint('lv') });
  ok('M2: the same id, an unlike text: a new key (no blind pairing); a similar edit keeps its key', k(unlike, 0) !== k(prev, 0) && k(unlike, 1) === k(prev, 1) && k(unlike, 2) === k(prev, 2), unlike.objects.map((o) => o.textKeys));
  // a renamed object's text, and a text now held by another object, keep their keys; one still held never moves
  const p2 = { objects: [{ id: 'g1', type: 'npc', name: 'A', title: 'Night Watch' }, { id: 'g9', type: 'npc', name: 'Z', title: 'Ferryman' }] };
  assignTextKeys(p2, { mint: seededMint('f') });
  const n2 = { objects: [{ id: 'g2', type: 'npc', name: 'B', title: 'Night Watch' }, { id: 'g1', type: 'npc', name: 'A', title: 'Night Watch' }, { id: 'g3', type: 'npc', name: 'Y', title: 'Ferryman' }] };
  assignTextKeys(n2, { previous: p2, mint: seededMint('f') });
  ok('M2: g1 keeps its key (still there); the new g2 with its English gets its own; g9 gone → g3 takes its text\'s key', n2.objects[1].textKeys.title === p2.objects[0].textKeys.title && n2.objects[0].textKeys.title !== p2.objects[0].textKeys.title && n2.objects[2].textKeys.title === p2.objects[1].textKeys.title && textKeyIssues(n2).length === 0, n2.objects.map((o) => o.textKeys));
  // M3: a chapter variant's changed text never keeps a key its base holds with other English
  const base = { objects: [{ id: 'sign', type: 'signpost', text: ['Old bridge ahead.'] }], subtitle: 'The Vale' };
  assignTextKeys(base, { mint: seededMint('base') });
  const v1 = { objects: [{ id: 'sign', type: 'signpost', text: ['Old bridge ahead.'] }], subtitle: 'The Vale' };
  assignTextKeys(v1, { base, mint: seededMint('var') });
  const v2 = { objects: [{ id: 'sign', type: 'signpost', text: ['The bridge is mended.'] }], subtitle: 'The Vale at dusk' };
  const r2 = assignTextKeys(v2, { previous: v1, base, mint: seededMint('var') });
  ok('M3: the variant shares the base\'s key while its English is the same', v1.objects[0].textKeys.text[0] === base.objects[0].textKeys.text[0] && v1.textKeys.subtitle === base.textKeys.subtitle);
  ok('M3: … its changed text and subtitle get their own (the base keeps its key)', v2.objects[0].textKeys.text[0] !== base.objects[0].textKeys.text[0] && v2.textKeys.subtitle !== base.textKeys.subtitle && isGuid(v2.textKeys.subtitle), [v2.objects[0].textKeys, v2.textKeys]);
  const v3 = { objects: [{ id: 'sign', type: 'signpost', text: ['Old bridge ahead, nearly.'] }], subtitle: 'The Vale' };
  const r3 = assignTextKeys(v3, { previous: v1, base, mint: seededMint('var') });
  ok('M3: a similar edit of a shared text: a new key too, listed in `split` (the edited subtitle above too; the unlike text was no edit)', v3.objects[0].textKeys.text[0] !== base.objects[0].textKeys.text[0] && r3.split.length === 1 && r3.split[0].was === base.objects[0].textKeys.text[0] && r3.split[0].key === v3.objects[0].textKeys.text[0] && isDeepStrictEqual(r2.split.map((s) => s.where), ['level › subtitle']), [r2, r3]);
  // the base edited, its variant not: with the variant's keys as `shared`, the base's edit gets the new key (copy on write)
  const b2 = { objects: [{ id: 'sign', type: 'signpost', text: ['Old bridge ahead, nearly.'] }], subtitle: 'The Vale' };
  assignTextKeys(b2, { previous: base, shared: new Map([[v1.objects[0].textKeys.text[0], 'Old bridge ahead.']]), mint: seededMint('base') });
  const v4 = structuredClone(v1);
  for (const o of v4.objects) delete o.textKeys;
  delete v4.textKeys;
  assignTextKeys(v4, { previous: v1, base: b2, mint: seededMint('var') });
  ok('M3: the base\'s edit of a key its variant holds: the base gets a new key, the unchanged variant keeps the old one', b2.objects[0].textKeys.text[0] !== base.objects[0].textKeys.text[0] && v4.objects[0].textKeys.text[0] === base.objects[0].textKeys.text[0] && b2.textKeys.subtitle === base.textKeys.subtitle, [b2.objects[0].textKeys, v4.objects[0].textKeys]);
  // the editor's copy on write (the hook for M7): carryObjectText / carryRootText with `shared`
  const ed0 = carryObjectText(null, { id: 'sign', type: 'signpost', text: ['Old bridge ahead.'] }, seededMint('e'), new Set());
  const k0 = ed0.textKeys.text[0];
  const edit = () => ({ id: 'sign', type: 'signpost', text: ['Old bridge ahead, rotten.'] });
  const ed1 = carryObjectText(ed0, edit(), seededMint('e'), new Set(), { shared: new Map([[k0, 'Old bridge ahead.']]) });
  const ed2 = carryObjectText(ed0, edit(), seededMint('e'), new Set());
  const ed3 = carryObjectText(ed0, edit(), seededMint('e'), new Set(), { shared: new Map([[k0, ['Old bridge ahead, rotten.', 'x']]]) });
  ok('copy on write: carryObjectText with `shared` — an edit of a key a copy holds with other English gets a new key; the same English, or no `shared`: it keeps it', isGuid(ed1.textKeys.text[0]) && ed1.textKeys.text[0] !== k0 && ed2.textKeys.text[0] === k0 && ed3.textKeys.text[0] === k0, [ed1.textKeys, ed2.textKeys, ed3.textKeys]);
  const rt0 = carryRootText(null, { subtitle: 'The Vale' }, seededMint('e'), new Set());
  const rt1 = carryRootText(rt0, { subtitle: 'The Vale, at dusk' }, seededMint('e'), new Set(), { shared: new Map([[rt0.textKeys.subtitle, 'The Vale']]) });
  ok('… carryRootText too', isGuid(rt1.textKeys.subtitle) && rt1.textKeys.subtitle !== rt0.textKeys.subtitle);
  // a variant whose text comes back to the base's English shares the base's key again
  const v5 = { objects: [{ id: 'sign', type: 'signpost', text: ['Old bridge ahead.'] }], subtitle: 'The Vale' };
  assignTextKeys(v5, { previous: v2, base, mint: seededMint('var') });
  eq('M3: a variant text equal to the base\'s again shares its (free) key', [v5.objects[0].textKeys.text[0], v5.textKeys.subtitle], [base.objects[0].textKeys.text[0], base.textKeys.subtitle]);
  // S1: repeated lines share each of the base's keys, in order
  const bt = { objects: [{ id: 'n', type: 'npc', dialogue: ['Thank you.', 'Hm.', 'Thank you.'] }] };
  assignTextKeys(bt, { mint: seededMint('b') });
  const vt = { objects: [{ id: 'n', type: 'npc', dialogue: ['Thank you.', 'Hm.', 'Thank you.'] }] };
  const rt = assignTextKeys(vt, { base: bt, mint: seededMint('v') });
  eq('S1: a variant\'s repeated lines share each base key (not only the first)', [vt.objects[0].textKeys.dialogue, rt.shared, rt.minted], [bt.objects[0].textKeys.dialogue, 3, 0]);
  // `extended`: a copy of a level of another table shares its keys for the same English, may diverge
  const ext = { objects: [{ id: 'w', type: 'well', text: ['Deep.', 'Cold.'] }] };
  assignTextKeys(ext, { mint: seededMint('shipped') });
  const copy = { objects: [{ id: 'w', type: 'well', text: ['Deep.', 'Warm.'] }] };
  const rc = assignTextKeys(copy, { extended: ext, mint: seededMint('copy') });
  ok('`extended`: the same English shares the extended level\'s key, other English gets its own', copy.objects[0].textKeys.text[0] === ext.objects[0].textKeys.text[0] && copy.objects[0].textKeys.text[1] !== ext.objects[0].textKeys.text[1] && rc.shared === 1, copy.objects[0].textKeys);
  const kept = structuredClone(copy);
  kept.objects[0].text = ['Deep, and dark.', 'Warm.'];
  assignTextKeys(kept, { previous: copy, extended: ext, mint: seededMint('copy') });
  eq('… a copy may diverge from the extended level under its key (another table: no split)', kept.objects[0].textKeys.text, copy.objects[0].textKeys.text);
}

// =================================================================================================
begin('review: parked script lines (M4, S4)');
{
  let n = 0;
  const mint = () => (++n).toString(16).toUpperCase().padStart(32, '0');
  const s0 = ['if gold >= 5', '  - You are rich.', '  - Very rich.', '- Bye.'];
  const t0 = /** @type {string[]} */ (retagScript(undefined, s0, mint, new Set()));
  const t1 = /** @type {string[]} */ (retagScript(t0, stripScriptTags(['if gold >= ', ...s0.slice(1)]), mint, new Set()));
  const t2 = /** @type {string[]} */ (retagScript(t1, stripScriptTags(['if gold >= 6', ...s0.slice(1)]), mint, new Set()));
  eq('M4: lines in a block whose header has an error keep their tags; fixed, they still have them', [t1.map(tagOf), t2.map(tagOf)], [t0.map(tagOf), t0.map(tagOf)]);
  const c1 = /** @type {string[]} */ (retagScript(t0, ['if gold >= 5', '  # - You are rich.', '  - Very rich.', '- Bye.'], mint, new Set()));
  const c2 = /** @type {string[]} */ (retagScript(c1, stripScriptTags(s0), mint, new Set()));
  ok('M4: a line commented out keeps its tag, and has it again when it reads again', tagOf(c1[1]) === tagOf(t0[1]) && c1[1].startsWith('  # - You are rich.') && tagOf(c2[1]) === tagOf(t0[1]), [c1, c2]);
  const nine = ['choice Pick', ...Array.from({ length: 9 }, (_, i) => `  > Opt ${i}`)];
  const ch0 = /** @type {string[]} */ (retagScript(undefined, nine.slice(0, 9), mint, new Set()));
  const ch1 = /** @type {string[]} */ (retagScript(ch0, stripScriptTags([...ch0, nine[9]]), mint, new Set()));
  ok('M4: a choice with 9 options (an error): its options keep their tags, the new one gets none', ch1.slice(0, 9).every((l, i) => tagOf(l) === tagOf(ch0[i])) && !tagOf(ch1[9]), ch1);
  const long = `- ${'x'.repeat(2100)}`;
  const l0 = /** @type {string[]} */ (retagScript(undefined, ['- Short.', '- Two.'], mint, new Set()));
  const l1 = /** @type {string[]} */ (retagScript(l0, ['- Short.', long], mint, new Set()));
  ok('M4: a line over the length limit keeps the tag of the line it continues', tagOf(l1[1]) === tagOf(l0[1]), l1.map(tagOf));
  const many = Array.from({ length: 4002 }, (_, i) => `- Line ${i}.`);
  const m0 = /** @type {string[]} */ (retagScript(undefined, many, mint, new Set()));
  ok('M4: lines past the line limit keep their own tags, never get new ones', isGuid(tagOf(m0[3999])) && !tagOf(m0[4000]) && !tagOf(m0[4001]), [m0[3999], m0[4000]]);
  const own = /** @type {string[]} */ (retagScript(undefined, [...many.slice(0, 4000), `- Line 4000. #line:${G('D')}`], mint, new Set()));
  eq('… and keep a tag they have', tagOf(own[4000]), G('D'));
  const ind = /** @type {string[]} */ (retagScript(t0, stripScriptTags(['if gold >= 5', '  - You are rich.', '      - Very rich.', '- Bye.']), mint, new Set()));
  eq('M4: a line with wrong indentation keeps its tag', tagOf(ind[2]), tagOf(t0[2]));
  const drop = /** @type {string[]} */ (retagScript(t0, ['if gold >= 5', `  set rich #line:${tagOf(t0[1])}`, t0[2], t0[3]], mint, new Set()));
  eq('M4: a line that parses to a command with no text loses its tag', drop.map(tagOf), ['', '', tagOf(t0[2]), tagOf(t0[3])]);
  const npc = { id: 'n', type: 'npc', talk: [`# - Parked. #line:${G('A')}`, `if (  #line:${G('B')}`, `  - Child. #line:${G('C')}`, `set x #line:${G('E')}`] };
  const iss = textKeyIssues({ objects: [npc] });
  eq('M4: textKeyIssues calls only the `set` tag stray (a comment, an error, its block: parked)', iss.map((i) => [i.kind, i.where]), [['stray', 'n › talk:4']]);
  eq('M4: parseScript lists them as parked, not stray', [parseScript(npc.talk).stray, parseScript(npc.talk).parked], [[4], [1, 2, 3]]);
  eq('M4: a .story file\'s parked tags are no problem either', fileKeyIssues('storyText', `== s\n# - Old. #line:${G('A')}\n- New. #line:${G('B')}`), []);
  // S4: one rule — a slot holds text when its text is not blank
  ok('S4: holdsText — a string that is not blank', holdsText('Hi') && !holdsText('  ') && !holdsText(undefined) && !holdsText(5));
  const blankQ = parseScript([`choice #line:${G('A')}`, `  > Yes #line:${G('B')}`]);
  ok('S4: a choice with no question: its line holds no text — not keyed, its tag stray; its option keyed', /** @type {any} */ (blankQ.nodes[0]).tk === undefined && /** @type {any} */ (blankQ.nodes[0]).options[0].tk === G('B') && isDeepStrictEqual(blankQ.stray, [1]), blankQ);
  ok('S4: scriptTextSlots marks it, scriptTextLines leaves it out', scriptTextSlots(blankQ.nodes).map((s) => s.held).join() === 'false,true' && isDeepStrictEqual([...scriptTextLines(['choice', '  > Yes']).keys()], [2]));
}

// =================================================================================================
begin('review: long scripts, tags in the text, line endings (M6, M9, M10)');
{
  const big = Array.from({ length: 3000 }, (_, i) => (i % 10 === 0 ? '' : `- line ${i}`));
  const nb = big.slice();
  nb[5] = '';
  nb[2995] = '- changed end';
  const m = alignTexts(big, nb);
  eq('M6: a 3000-line script with an edit near each end: every other line continues its own', m.filter((i, j) => i !== j && j !== 5 && j !== 2995).length, 0);
  const shifted = ['- a brand new first line', ...big];
  const ms = alignTexts(big, shifted);
  ok('M6: a line inserted at the top of 3000: every old line continues itself', ms[0] === -1 && ms.slice(1).every((i, j) => i === j), ms.slice(0, 5));
  const blanks = [...Array.from({ length: 1500 }, (_, i) => (i % 2 ? '' : `- a${i}`)), ...Array.from({ length: 1500 }, (_, i) => (i % 2 ? '' : `- b${i}`))];
  const nbl = ['', ...blanks.slice(0, 1500).map((t) => (t ? `${t}!` : t)), ...blanks.slice(1500)];
  const mb = alignTexts(blanks, nbl);
  ok('M6: blank lines never anchor: the unchanged half is aligned, the edited half is not scrambled into it', mb.slice(1501).every((i, j) => i === 1500 + j), mb.slice(1495, 1505));
  const t0 = performance.now();
  alignTexts(Array.from({ length: 4000 }, (_, i) => `- old ${i * 7}`), Array.from({ length: 4000 }, (_, i) => `- new ${i * 11}`));
  ok('M6: 4000 unlike lines on each side align in well under a second', performance.now() - t0 < 1000, performance.now() - t0);
  const words = (seed, n) => Array.from({ length: n }, (_, i) => `w${(seed * 7919 + i * 104729) % 100003}`).join(' ');
  const t1 = performance.now();
  alignTexts(Array.from({ length: 300 }, (_, i) => words(i, 60)), Array.from({ length: 299 }, (_, i) => words(i + 1000, 60)));
  ok('… 300 long unlike lines (the edits\' similarity is bounded in work, not only in count)', performance.now() - t1 < 1000, performance.now() - t1);
  // M9
  eq('M9: tagLine cuts the text\'s trailing white space and a carriage return', [tagLine('- Hi   ', G('A')), tagLine('- Hi\r', G('A')), tagLine('- Hi', G('a'))], [`- Hi ${LINE_TAG}${G('A')}`, `- Hi ${LINE_TAG}${G('A')}`, `- Hi ${LINE_TAG}${G('A')}`]);
  eq('… a line with no tag and no key comes back as it is', tagLine('- Hi  ', ''), '- Hi  ');
  const crlf = String(retagStoryText('', '== a\r\n- One.\r\n- Two.  \r\n', seededMint('s')));
  ok('M9: a CRLF .story file keeps CRLF, tags at the line ends', /^== a\r\n- One\. #line:[0-9A-F]{32}\r\n- Two\. #line:[0-9A-F]{32}\r\n$/.test(crlf), crlf);
  const str = String(retagScript(undefined, '- One.\r\n- Two.', seededMint('s'), new Set()));
  ok('M9: a string script with CRLF keeps CRLF', /^- One\. #line:[0-9A-F]{32}\r\n- Two\. #line:[0-9A-F]{32}$/.test(str), str);
  // M10
  for (const [what, line] of /** @type {[string, string][]} */ ([
    ['two tags', `- Hi #line:${G('A')} #line:${G('B')}`], ['a tag of 31 digits', `- Hi #line:${'A'.repeat(31)}`], ['a tag of 33 digits', `- Hi #line:${'A'.repeat(33)}`],
    ['a space after the colon', `- Hi #line: ${G('A')}`], ['a tag in the middle', `- Hi #line:${G('A')} there`],
  ])) {
    const p = parseScript([line, '- Fine.']);
    ok(`M10: ${what}: a parse error — never shown`, p.errors.length === 1 && p.errors[0].line === 1 && p.nodes.length === 1 && /** @type {any} */ (p.nodes[0]).text === 'Fine.', p);
  }
  eq('M10: a lower-case tag is read (upper case)', /** @type {any} */ (parseScript([`- Hi #line:${G('a')}`]).nodes[0]).tk, G('A'));
  const lower = /** @type {string[]} */ (retagScript(undefined, [`- Hi #line:${G('b')}`], seededMint('s'), new Set()));
  eq('M10: retag writes a lower-case tag in upper case', lower, [`- Hi #line:${G('B')}`]);
  eq('M10: toGuid — either case to upper; anything else ""', [toGuid(G('a')), toGuid(G('A')), toGuid('A'.repeat(31)), toGuid(`${G('a').slice(0, 31)}g`), toGuid(5)], [G('A'), G('A'), '', '', '']);
  const cl = cleanTextKeysOf('npc', { title: G('c'), dialogue: [G('d'), { key: G('e'), choices: [G('f')] }] });
  eq('M10: the cleaners write lower-case keys in upper case (counted, not dropped)', [cl.keys, cl.dropped, cl.upcased], [{ title: G('C'), dialogue: [G('D'), { key: G('E'), choices: [G('F')] }] }, 0, 4]);
  eq('… a quest\'s keys too', cleanQuestTextKeys({ text: G('a'), stages: { s: G('b') }, goals: [G('c')] }).keys, { text: G('A'), stages: { s: G('B') }, goals: [G('C')] });
}

// =================================================================================================
begin('review: story files, chapters, headers (S2, S3, C7, C9)');
{
  // S2: the loader's ids — an id-less event `event-<n>`, a stage's numeric or blank id `<n>`
  const story = {
    quests: { q: { title: 'Q', stages: [{ id: '', text: 'First.' }, { id: 7, text: 'Second.' }, { id: 'x', text: 'Third.' }] } },
    events: [{ on: 'change', if: 'a', run: ['- Ringing.'] }, { id: 'named', on: 'change', if: 'b', run: ['- Named.'] }],
  };
  carryStoryFile(null, story, seededMint('s'), new Set());
  const qs = /** @type {any} */ (story.quests.q).textKeys.stages;
  eq('S2: stages keyed by the loader\'s stage id (blank or numeric id: its place)', Object.keys(qs), ['1', '2', 'x']);
  const built = buildStory([{ name: 'main.json', text: serializeStory(story) }]).story;
  eq('… the loader reads each stage\'s key', built.quests.q.stages.map((s) => s.textKey), [qs['1'], qs['2'], qs.x]);
  const edited = structuredClone(story);
  edited.events[0].run = ['- Ringing loudly.', '- Ringing.'];
  carryStoryFile(story, edited, seededMint('s'), new Set());
  eq('S2: an id-less event (`event-1`) keeps its lines\' keys through a change', tagOf(edited.events[0].run[1]), tagOf(story.events[0].run[0]));
  eq('… storyFileTexts names it by the loader\'s id', storyFileTexts(edited).filter((t) => t.where.startsWith('event')).map((t) => t.where), ['event event-1 › run:1', 'event event-1 › run:2', 'event named › run:1']);
  // S3: repeated headers by occurrence; a renamed script keeps its lines' keys
  const t0 = retagStoryText('', '== a\n- One.\n== a\n- Two.\n== b\n- Three.\n', seededMint('s'));
  const L0 = t0.split('\n');
  const t1 = retagStoryText(t0, '== a\n- One.\n== a\n- Zero.\n- Two.\n== renamed\n- Three.\n', seededMint('s'));
  const L1 = t1.split('\n');
  eq('S3: a repeated `== a`: each copy retagged against its own (by occurrence)', [tagOf(L1[1]), tagOf(L1[4])], [tagOf(L0[1]), tagOf(L0[3])]);
  eq('S3: a renamed script\'s lines keep their tags (the one line of the file with that text)', tagOf(L1[6]), tagOf(L0[5]));
  const t2 = retagStoryText(t0, '== c\n- One.\n== a\n- One.\n== a\n- Two.\n== b\n- Three.\n', seededMint('s'));
  const L2 = t2.split('\n');
  ok('S3: a copied line in a new script never takes the tag its own line keeps', tagOf(L2[3]) === tagOf(L0[1]) && isGuid(tagOf(L2[1])) && tagOf(L2[1]) !== tagOf(L0[1]), L2);
  // C7: a tagged header
  const th = `== s\n- One. #line:${G('A')}\n== t #line:${G('B')}\n- Two. #line:${G('C')}\n`;
  ok('C7: a tag on a `== id` header is reported (the line is no header then)', fileKeyIssues('storyText', th).some((i) => i.kind === 'stray' && /header/.test(i.msg) && i.where === 'line 3 (s)'), fileKeyIssues('storyText', th));
  const fixed = retagStoryText(th, th, seededMint('s'));
  ok('C7: retagStoryText makes it a header again (no tag), the lines keep theirs', fixed.split('\n')[2] === '== t' && tagOf(fixed.split('\n')[3]) === G('C') && fileKeyIssues('storyText', fixed).length === 0, fixed);
  // C9: chapters without an id, matched as the loader names them
  const camp = { chapters: [{ title: 'One' }, { title: 'Two' }, { id: 'three', title: 'Three' }] };
  carryCampaignText(null, camp, seededMint('c'), new Set());
  const camp2 = structuredClone(camp);
  for (const c of camp2.chapters) delete c.textKeys;
  camp2.chapters[1].title = 'Two, retitled';
  carryCampaignText(camp, camp2, seededMint('c'), new Set());
  ok('C9: chapters without an id each keep their own keys (chapter-1, chapter-2)', camp.chapters[0].textKeys.title !== camp.chapters[1].textKeys.title && camp2.chapters.every((c, i) => c.textKeys.title === camp.chapters[i].textKeys.title), camp2.chapters);
  eq('… campaignTexts names them by the loader\'s id', campaignTexts(camp2).map((t) => t.where), ['chapter chapter-1 › title', 'chapter chapter-2 › title', 'chapter three › title']);
}

// =================================================================================================
begin('review: blank questions, bounded key lists, seeds, the catalog (S5, S6, S7, S11, C3)');
{
  const n = carryObjectText(null, { id: 'n', type: 'npc', dialogue: [{ text: ' ', choices: ['A', 'B'] }, 'Hi.'] }, seededMint('t'), new Set());
  ok('S5: a choice page with a blank question: `{ key: null, choices }`', n.textKeys.dialogue[0].key === null && n.textKeys.dialogue[0].choices.every(isGuid) && isGuid(n.textKeys.dialogue[1]), n.textKeys);
  eq('… no missing key for it, and levelTexts leaves it out', [textKeyIssues({ objects: [n] }), levelTexts({ objects: [n] }).map((t) => t.where)], [[], ['n › dialogue[0].choices[0]', 'n › dialogue[0].choices[1]', 'n › dialogue[1]']]);
  eq('… a key on it is stray', textKeyIssues({ objects: [{ ...n, textKeys: { dialogue: [{ key: G('A'), choices: n.textKeys.dialogue[0].choices }, n.textKeys.dialogue[1]] } }] }).map((i) => [i.kind, i.where]), [['stray', 'n › dialogue[0]']]);
  // S6
  const report = { textKeys: 0, upcased: 0 };
  const huge = new Array(1_000_000).fill(null);
  huge[0] = G('A');
  const t = performance.now();
  const o = normalizeObject({ id: 's', type: 'signpost', x: 1, z: 1, text: ['A.', 'B.'], textKeys: { text: huge } }, report);
  ok('S6: a key list is cut to its field\'s length (fast), the rest counted', isDeepStrictEqual(o.textKeys, { text: [G('A'), null] }) && report.textKeys === 999_998 && performance.now() - t < 500, [o.textKeys, report]);
  const r2 = { textKeys: 0, upcased: 0 };
  const o2 = normalizeObject({ id: 'n', type: 'npc', x: 1, z: 1, name: 'N', dialogue: [{ text: 'Q?', choices: ['Y'] }], textKeys: { title: G('A'), dialogue: [{ key: G('B'), choices: [G('C'), G('D'), G('E')] }, G('F')] } }, r2);
  ok('S6: a key of a field the object does not hold is dropped; a page\'s choices cut to the page\'s', !('title' in /** @type {any} */ (o2).textKeys) && isDeepStrictEqual(/** @type {any} */ (o2).textKeys.dialogue, [{ key: G('B'), choices: [G('C')] }]) && r2.textKeys === 4, [/** @type {any} */ (o2).textKeys, r2]);
  const raw = createEmptyLevel({ name: 'bounds', width: 8, depth: 8 });
  place(raw, 'well', { id: 'w', text: ['A.'], textKeys: { text: [G('A'), G('B'), G('C')] } });
  const nl = normalizeLevel(JSON.parse(JSON.stringify(raw)));
  ok('S6: normalizeLevel warns once with normalizeObject\'s count', nl.warnings.length === 1 && /2 malformed or unknown text key/.test(nl.warnings[0]) && textKeyIssues(nl.level).length === 0, nl.warnings);
  const lc = normalizeLevel({ ...JSON.parse(JSON.stringify(raw)), objects: [{ id: 'w', type: 'well', x: 1, z: 1, text: ['A.'], textKeys: { text: [G('a')] } }] });
  ok('… lower-case keys: written in upper case, with a warning', lc.level.objects[0].textKeys.text[0] === G('A') && lc.warnings.some((w) => /lower-case/.test(w)), lc.warnings);
  // S7
  const bad = ['C:\\x\\y.json', 'C:/x.json', '/abs/x.json', 'a\\b', '../x', 'a//b', './x', ''];
  ok('S7: seededMint refuses an OS path (keys would differ between machines)', bad.every((p) => { try { seededMint(p); return false; } catch { return true; } }));
  ok('… a repository-relative POSIX path or a file stem is fine', [/** @type {any} */ ('public/levels/x.json'), 'x', 'campaigns/c/levels/a.json'].every((p) => isGuid(seededMint(p)('s'))));
  // S11: TEXT_KEY_FIELDS is the catalog's translatable fields but the names (terms)
  const TERMS = new Set(['signpost.speaker', 'npc.name', 'npc.item', 'region.name', 'enemy.name', 'waystone.name']);
  /** @type {Record<string, Record<string, string>>} */
  const fromCatalog = {};
  for (const [type, def] of Object.entries(OBJECT_TYPES)) {
    for (const f of /** @type {any[]} */ (def.fields)) {
      if (!f.i18n || TERMS.has(`${type}.${f.key}`)) continue;
      (fromCatalog[type] ??= {})[f.key] = f.type;
    }
  }
  eq('S11: TEXT_KEY_FIELDS = the catalog\'s i18n fields minus the terms (a new translatable field must get keys)', JSON.parse(JSON.stringify(TEXT_KEY_FIELDS)), fromCatalog);
  // C3
  const L = createEmptyLevel({ name: 'order', width: 8, depth: 8 });
  L.subtitle = 'S';
  carryRootText(null, L, seededMint('o'), new Set());
  const rawL = JSON.parse(serializeLevel(normalizeLevel(L).level));
  const tk = rawL.textKeys;
  delete rawL.textKeys;
  rawL.zzz = 1;
  rawL.textKeys = tk;
  rawL.aaa = 2;
  const s1 = serializeLevel(normalizeLevel(rawL).level);
  ok('C3: an unknown root field before `textKeys` stays before it (and one after, after)', s1.indexOf('"zzz"') < s1.indexOf('"textKeys"') && s1.indexOf('"textKeys"') < s1.indexOf('"aaa"') && serializeLevel(parseLevel(s1).level) === s1, s1.slice(-140));
}

// =================================================================================================
begin('the formats keep the keys');
{
  const raw = createEmptyLevel({ name: 'keys', width: 8, depth: 8 });
  raw.subtitle = 'A Sub';
  place(raw, 'well', { id: 'w', text: ['A.', '', 'B.'] });
  place(raw, 'npc', { id: 'n', name: 'N', dialogue: ['Hi.', { text: 'Q?', choices: ['Y', 'N'] }], talk: ['- Hey.'] });
  const { level } = normalizeLevel(raw);
  assignTextKeys(level, { mint: seededMint('keys.json') });
  const text = serializeLevel(level);
  const back = parseLevel(text);
  ok('a level with keys: parse → serialise is byte-identical, no warning', serializeLevel(back.level) === text && back.warnings.length === 0, back.warnings);
  ok('… the root keys on one line after the objects', /\n {2}\],\n {2}"textKeys": \{"subtitle":"[0-9A-F]{32}"\}\n\}\n$/.test(text), text.slice(-120));
  ok('… the script tags kept in the file', /"talk":\["- Hey\. #line:[0-9A-F]{32}"\]/.test(text));
  const bad = JSON.parse(text);
  bad.objects.find((o) => o.id === 'w').textKeys.text[0] = 'bad';
  bad.textKeys.junk = G('A');
  const r = normalizeLevel(bad);
  ok('malformed keys are dropped with a warning; the rest stays', r.warnings.length === 2 && r.level.objects.find((o) => o.id === 'w').textKeys.text[0] === null && !('junk' in r.level.textKeys), r.warnings);
  const camp = { format: 'luminati-campaign', version: 1, name: 'C', subtitle: 'S', levels: [{ id: 'a' }], chapters: [{ id: 'one', title: 'One' }] };
  carryCampaignText(null, camp, seededMint('c'));
  const cs = serializeCampaign(normalizeCampaign(camp).campaign);
  ok('campaign.json: root and chapter keys round trip', cs === serializeCampaign(normalizeCampaign(JSON.parse(cs)).campaign) && JSON.parse(cs).chapters[0].textKeys.title === camp.chapters[0].textKeys.title && JSON.parse(cs).textKeys.subtitle === camp.textKeys.subtitle);
  const story = { items: { a: { name: 'A', text: 'An a.' } }, quests: { q: { title: 'Q', text: 'Go.', stages: [{ id: 's', text: 'S.' }], goals: [{ text: '' }, { text: 'G.' }] } }, scripts: { x: ['- Hi.'] } };
  carryStoryFile(null, story, seededMint('s'));
  const built = buildStory([{ name: 'main.json', text: serializeStory(story) }]);
  eq('a story file: the built item, quest, stage and goal carry their keys (a goal by its raw index)', [built.story.items.a.textKey, built.story.quests.q.textKey, built.story.quests.q.stages[0].textKey, built.story.quests.q.goals.map((g) => g.textKey)], [story.items.a.textKeys.text, story.quests.q.textKeys.text, story.quests.q.textKeys.stages.s, [story.quests.q.textKeys.goals[1]]]);
  eq('… the script\'s lines keep their tags (the parser reads them)', /** @type {any} */ (parseScript(built.story.scripts.x.lines).nodes[0]).tk, tagOf(story.scripts.x[0]));
  eq('… no warnings', built.warnings, []);
}

// =================================================================================================
begin('the extractor lists the keys the data holds (ContentStrings.js)');
{
  const L = {
    name: 'X', subtitle: 'Sub', environment: { title: { title: 'T' } },
    objects: [
      { id: 'w', type: 'well', text: ['A.', 'B.'] },
      { id: 'n', type: 'npc', name: 'N', title: 'Smith', dialogue: ['Hi.', { text: 'Q?', choices: ['Y', 'N'] }] },
      { id: 't', type: 'npc', name: 'T', talk: ['- Hey.', 'banner Ford | Open', 'set x'] },
      { id: 'e', type: 'event', label: 'Ring', on: 'use', run: ['toast Rung.'] },
    ],
  };
  carryObjectText(null, L.objects[0], seededMint('x'), new Set());
  carryObjectText(null, L.objects[1], seededMint('x'), new Set());
  carryObjectText(null, L.objects[2], seededMint('x'), new Set());
  carryRootText(null, L, seededMint('x'), new Set());
  const units = levelStrings(L, { file: 'levels/x.json' }).filter((e) => !e.term);
  const by = (where) => units.find((e) => e.where.endsWith(where))?.key;
  eq('object fields: the readers\' keys', [by('w (well) › text[1]'), by('n (npc) › title'), by('n (npc) › dialogue[1]'), by('n (npc) › dialogue[1].choices[0]')],
    [pageKeyOf(L.objects[0], 'text', 1), textKeyOf(L.objects[1], 'title'), dialogueKeyOf(L.objects[1], 1), choiceKeyOf(L.objects[1], 1, 0)]);
  const tags = L.objects[2].talk.map(tagOf);
  eq('script lines: the line\'s tag; a banner\'s subtitle <tag>.2', units.filter((e) => e.field.startsWith('npc.talk')).map((e) => e.key), [tags[0], tags[1], `${tags[1]}.2`]);
  eq('the level\'s own texts: its textKeys', [by('› subtitle'), by('environment.title.title')], [L.textKeys.subtitle, L.textKeys['title.title']]);
  eq('a text with no key: listed with key \'\' (it stays English; the checker says so)', [by('e (event) › label'), units.filter((e) => e.field.startsWith('event.run')).map((e) => [e.key, e.text])], ['', [['', 'Rung.']]]);
  const camp = { name: 'C', subtitle: 'S', title: { title: 'T' }, chapters: [{ id: 'one', title: 'One', subtitle: 'First', levels: {} }] };
  carryCampaignText(null, camp, seededMint('c'));
  const story = { items: { a: { name: 'A', text: 'An a.' } }, quests: { q: { title: 'Q', text: 'Go.', stages: [{ id: 's', text: 'S.' }], goals: [{ text: 'G.' }] } }, scripts: { x: ['Wren: Hi.'] } };
  carryStoryFile(null, story, seededMint('s'));
  const built = buildStory([{ name: 'main.json', text: serializeStory(story) }]).story;
  const cu = campaignStrings(normalizeCampaign({ format: 'luminati-campaign', version: 1, levels: [{ id: 'x' }], ...camp }).campaign, [], built, { file: 'campaigns/c' }).filter((e) => !e.term);
  const cby = (where) => cu.find((e) => e.where.endsWith(where))?.key;
  eq('campaign.json and its chapters: their textKeys', [cby('campaign.json › subtitle'), cby('title.title'), cby('chapter one › subtitle')], [camp.textKeys.subtitle, camp.textKeys['title.title'], camp.chapters[0].textKeys.subtitle]);
  eq('a story: the built item\'s, quest\'s, stage\'s and goal\'s textKey; a script line\'s tag', [cby('item a › text'), cby('quest q › text'), cby('quest q › stage s'), cby('quest q › goal[0]'), cby('script x:1')],
    [story.items.a.textKeys.text, story.quests.q.textKeys.text, story.quests.q.textKeys.stages.s, story.quests.q.textKeys.goals[0], tagOf(story.scripts.x[0])]);
  eq('slotKey: an option\'s, a banner\'s and a say\'s', parseScriptSlots([`choice Q? #line:${G('A')}`, `  > Y #line:${G('B')}`, `banner T | S #line:${G('C')}`]), [G('A'), G('B'), G('C'), `${G('C')}.2`]);
  eq('keyConflicts: one key, two Englishes (\'\' never conflicts)', keyConflicts([{ key: G('A'), text: 'a', kind: 'line', where: 'x', field: 'f' }, { key: G('A'), text: 'b', kind: 'line', where: 'y', field: 'f' }, { key: '', text: 'c', kind: 'line', where: 'z', field: 'f' }, { key: '', text: 'd', kind: 'line', where: 'z', field: 'f' }]).map((c) => c.key), [G('A')]);
}

// =================================================================================================
begin('the shipped data');
{
  /** @type {string[]} */
  const out = [];
  const code = keysTool(['--quiet', `--root=${ROOT}`], { log: (s) => out.push(s), err: (s) => out.push(s) });
  ok('npm run i18n:keys: every shipped text keyed, no stray or repeated key, one key one English', code === 0, out.slice(-5));
  ok('… the summary', /^\d+ file\(s\), (\d+) texts, \1 keyed · 0 problem\(s\)$/.test(out[out.length - 1] ?? ''), out[out.length - 1]);
}

// =================================================================================================
begin('the key tool on a temp tree');
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'luminati-keys-'));
  try {
    const put = (rel, text) => { const f = path.join(tmp, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); return f; };
    const levelText = (name, objects, sub = 'A small place') => {
      const L = createEmptyLevel({ name, width: 8, depth: 8 });
      L.subtitle = sub;
      for (const [type, fields] of objects) place(L, type, fields);
      return serializeLevel(normalizeLevel(L).level);
    };
    const run = (...argv) => {
      /** @type {string[]} */
      const lines = [];
      const code = keysTool([...argv, `--root=${tmp}`], { log: (s) => lines.push(s), err: (s) => lines.push(s) });
      return { code, lines, text: lines.join('\n') };
    };
    const a = put('public/levels/a.json', levelText('A', [['well', { id: 'w', text: ['Deep.', 'Cold.'] }], ['npc', { id: 'n', name: 'N', dialogue: ['Hi.'] }]]));
    const gen = put('public/levels/starfall-vale.json', levelText('Starfall Vale', [['well', { id: 'w', text: ['A well.'] }]]));
    const genBefore = fs.readFileSync(gen, 'utf8');
    // a campaign with a chapter variant and story files
    const cdir = 'public/campaigns/c';
    put(`${cdir}/campaign.json`, serializeCampaign(normalizeCampaign({ format: 'luminati-campaign', version: 1, name: 'C', subtitle: 'A tale', levels: [{ id: 'town' }], chapters: [{ id: 'one', title: 'One' }, { id: 'two', title: 'Two', when: 'f', levels: { town: 'town-dusk' } }], story: ['main.json', 'talk.story'] }).campaign));
    put(`${cdir}/levels/town.json`, levelText('Town', [['well', { id: 'w', text: ['Deep.', 'Cold.'] }]]));
    put(`${cdir}/levels/town-dusk.json`, levelText('Town', [['well', { id: 'w', text: ['Deep.', 'Colder at dusk.'] }]]));
    put(`${cdir}/story/main.json`, serializeStory({ items: { a: { name: 'A', text: 'An a.' } } }));
    put(`${cdir}/story/talk.story`, '== s\n- One.\nset x\n- Two.\n');

    const c0 = run(a);
    ok('--check a keyless level: exit 1, every text listed as missing', c0.code === 1 && /a\.json: 4 texts, 0 keyed — 4 missing/.test(c0.text) && (c0.text.match(/missing: /g) ?? []).length === 4, c0.text);
    const usage = [run('--assign'), run('--nope'), run('public/levels/none.json'), run('--check', '--fix', 'public/levels/a.json')];
    eq('usage errors: exit 2 (--assign naming nothing, an unknown option, no such file, two modes)', usage.map((r) => r.code), [2, 2, 2, 2]);
    const as1 = run('--assign', a);
    const keyed1 = fs.readFileSync(a, 'utf8');
    ok('--assign: written, every text keyed, exit 0', as1.code === 0 && /wrote public\/levels\/a\.json/.test(as1.text) && textKeyIssues(parseLevel(keyed1).level).length === 0, as1.text);
    const as2 = run('--assign', a);
    ok('… again: nothing written, the file as it was', as2.code === 0 && !/wrote/.test(as2.text) && fs.readFileSync(a, 'utf8') === keyed1, as2.text);
    // reproducible: the same file in another tree gets the same keys
    const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'luminati-keys-'));
    try {
      const a2 = path.join(tmp2, 'public/levels/a.json');
      fs.mkdirSync(path.dirname(a2), { recursive: true });
      fs.writeFileSync(a2, levelText('A', [['well', { id: 'w', text: ['Deep.', 'Cold.'] }], ['npc', { id: 'n', name: 'N', dialogue: ['Hi.'] }]]));
      keysTool(['--assign', 'public/levels/a.json', `--root=${tmp2}`, '--quiet'], { log: () => {}, err: () => {} });
      eq('… seeded by the file and the text: another tree, the same keys', fs.readFileSync(a2, 'utf8'), keyed1);
    } finally { fs.rmSync(tmp2, { recursive: true, force: true }); }
    const g1 = run('--assign', 'starfall-vale');
    ok('--assign on a generated file: refused, its generator named, the file untouched (exit 1)', g1.code === 1 && /make-starfall-vale\.mjs/.test(g1.text) && fs.readFileSync(gen, 'utf8') === genBefore, g1.text);
    // a hand-edited layout: refused unless --force
    const loose = put('public/levels/loose.json', JSON.stringify(JSON.parse(levelText('Loose', [['well', { id: 'w', text: ['A.'] }]]))));
    const l1 = run('--assign', loose);
    ok('a file whose round trip is not byte-identical: refused without --force', l1.code === 1 && /round trip/.test(l1.text) && !fs.readFileSync(loose, 'utf8').includes('textKeys'), l1.text);
    const l2 = run('--assign', '--force', loose);
    ok('… written with --force', l2.code === 0 && fs.readFileSync(loose, 'utf8').includes('textKeys'), l2.text);
    // the campaign
    const ca = run('--assign', path.join(tmp, cdir));
    const town = parseLevel(fs.readFileSync(path.join(tmp, cdir, 'levels/town.json'), 'utf8')).level;
    const dusk = parseLevel(fs.readFileSync(path.join(tmp, cdir, 'levels/town-dusk.json'), 'utf8')).level;
    const talk = fs.readFileSync(path.join(tmp, cdir, 'story/talk.story'), 'utf8');
    ok('--assign a campaign: every file keyed (exit 0)', ca.code === 0 && /5 file\(s\), (\d+) texts, \1 keyed · 0 problem/.test(ca.text), ca.text);
    ok('… the variant shares its base\'s key where the English is the same, its own where not', dusk.objects[0].textKeys.text[0] === town.objects[0].textKeys.text[0] && dusk.objects[0].textKeys.text[1] !== town.objects[0].textKeys.text[1] && dusk.textKeys.subtitle === town.textKeys.subtitle);
    ok('… the .story file: lines with text tagged, `set` and the header not', /^== s\n- One\. #line:[0-9A-F]{32}\nset x\n- Two\. #line:[0-9A-F]{32}\n$/.test(talk), talk);
    ok('… campaign.json and the story file keyed', JSON.parse(fs.readFileSync(path.join(tmp, cdir, 'campaign.json'), 'utf8')).chapters[1].textKeys?.title && JSON.parse(fs.readFileSync(path.join(tmp, cdir, 'story/main.json'), 'utf8')).items.a.textKeys?.text);
    // the variant's line edited by hand, keeping its key: two Englishes
    const duskFile = path.join(tmp, cdir, 'levels/town-dusk.json');
    const sharedKey = town.objects[0].textKeys.text[0];
    fs.writeFileSync(duskFile, fs.readFileSync(duskFile, 'utf8').replace('"Deep."', '"Deep, and dark."'));
    const k1 = run(path.join(tmp, cdir));
    ok('--check: a key with two Englishes across the campaign (exit 1)', k1.code === 1 && k1.text.includes(`text key ${sharedKey}: one key, 2 Englishes`), k1.text);
    const f1 = run('--fix', path.join(tmp, cdir));
    const dusk2 = parseLevel(fs.readFileSync(duskFile, 'utf8')).level;
    ok('--fix: no table translates it — the variant gets the new key', f1.code === 0 && dusk2.objects[0].textKeys.text[0] !== sharedKey && isGuid(dusk2.objects[0].textKeys.text[0]) && run(path.join(tmp, cdir)).code === 0, f1.text);
    // the base edited, the tables translating the variant's (old) English: the base gets the new key
    const townFile = path.join(tmp, cdir, 'levels/town.json');
    fs.writeFileSync(duskFile, fs.readFileSync(duskFile, 'utf8').replace(dusk2.objects[0].textKeys.text[0], sharedKey).replace('"Deep, and dark."', '"Deep."'));
    fs.writeFileSync(townFile, fs.readFileSync(townFile, 'utf8').replace('"Deep."', '"Deep indeed."'));
    put('public/i18n/ja/campaigns/c.json', JSON.stringify({ format: 'luminati-i18n', version: 3, lang: 'ja', source: 'campaigns/c', extends: [], terms: {}, units: { [sharedKey]: { source: 'Deep.', target: '深い。' } } }));
    const f2 = run('--fix', path.join(tmp, cdir));
    const town2 = parseLevel(fs.readFileSync(townFile, 'utf8')).level;
    const dusk3 = parseLevel(fs.readFileSync(duskFile, 'utf8')).level;
    ok('--fix: the copy whose English the tables do not translate gets the new key (here the base)', f2.code === 0 && dusk3.objects[0].textKeys.text[0] === sharedKey && town2.objects[0].textKeys.text[0] !== sharedKey, f2.text);
    // --shipped: tracked files only
    const git = (...g) => spawnSync('git', g, { cwd: tmp, encoding: 'utf8' });
    if (git('init', '-q').status === 0) {
      const b = put('public/levels/b.json', levelText('B', [['well', { id: 'w', text: ['Bee.'] }]]));
      const user = put('public/levels/user.json', levelText('User', [['well', { id: 'w', text: ['Mine.'] }]]));
      git('add', 'public/levels/b.json', 'public/levels/a.json', 'public/levels/starfall-vale.json', `${cdir}`);
      const userBefore = fs.readFileSync(user, 'utf8');
      const sh = run('--assign', '--shipped');
      ok('--assign --shipped: a tracked hand-made level keyed; the untracked user level not read or written; the generated one refused', fs.readFileSync(b, 'utf8').includes('textKeys') && fs.readFileSync(user, 'utf8') === userBefore && !sh.text.includes('user.json') && /starfall-vale\.json: not written — a generated file/.test(sh.text) && sh.code === 1, sh.text);
      const named = run('--assign', user);
      ok('… a user\'s untracked level is written when named', named.code === 0 && fs.readFileSync(user, 'utf8').includes('textKeys'), named.text);
    } else ok('git is available for the --shipped test', false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// =================================================================================================
begin('review: the key tool — one table\'s sources, its units, ranks (M8, S8)');
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'luminati-keys-'));
  try {
    const put = (rel, text) => { const f = path.join(tmp, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); return f; };
    const levelText = (name, objects) => {
      const L = createEmptyLevel({ name, width: 8, depth: 8 });
      for (const [type, fields] of objects) place(L, type, fields);
      return serializeLevel(normalizeLevel(L).level);
    };
    const campaign = (dir, levels, chapters = []) => put(`${dir}/campaign.json`, serializeCampaign(normalizeCampaign({ format: 'luminati-campaign', version: 1, name: 'C', levels: levels.map((id) => ({ id })), chapters }).campaign));
    const table = (lang, id, units, ext = []) => put(`public/i18n/${lang}/${id}.json`, `${JSON.stringify({ format: 'luminati-i18n', version: 3, lang, source: id, extends: ext, terms: {}, units }, null, 2)}\n`);
    const readTable = (lang, id) => JSON.parse(fs.readFileSync(path.join(tmp, `public/i18n/${lang}/${id}.json`), 'utf8'));
    const run = (...argv) => {
      /** @type {string[]} */
      const lines = [];
      const code = keysTool([...argv, `--root=${tmp}`, '--quiet'], { log: (s) => lines.push(s), err: (s) => lines.push(s) });
      return { code, lines, text: lines.join('\n') };
    };
    const keysOf = (rel) => parseLevel(fs.readFileSync(path.join(tmp, rel), 'utf8')).level.objects[0].textKeys.text;

    // S8: a campaign's copy of a shipped level shares its keys for the same English
    put('public/levels/town.json', levelText('Town', [['well', { id: 'w', text: ['Deep.', 'Cold.'] }]]));
    campaign('public/campaigns/c', ['town']);
    put('public/campaigns/c/levels/town.json', levelText('Town', [['well', { id: 'w', text: ['Deep.', 'Cold, in the copy.'] }]]));
    const a1 = run('--assign', 'public/levels/town.json', 'public/campaigns/c');
    const shipped = keysOf('public/levels/town.json');
    const copy = keysOf('public/campaigns/c/levels/town.json');
    ok('S8: --assign — the copy shares the shipped level\'s key for the same English, its own for other English', a1.code === 0 && copy[0] === shipped[0] && copy[1] !== shipped[1] && isGuid(copy[1]), [a1.text, shipped, copy]);
    // M8: divergence along `extends` is no conflict: the copy edited under the shipped key
    const cf = path.join(tmp, 'public/campaigns/c/levels/town.json');
    fs.writeFileSync(cf, fs.readFileSync(cf, 'utf8').replace('"Deep."', '"Deep, in the copy."'));
    const c1 = run('public/levels/town.json', 'public/campaigns/c');
    ok('M8: one key, two Englishes in two tables\' sources (a campaign copy and the shipped level): no conflict', c1.code === 0 && !/Englishes/.test(c1.text), c1.text);

    // M8: --fix moves the units of the English that leaves the key, in every language's table
    campaign('public/campaigns/d', ['base'], [{ id: 'two', when: 'f', levels: { base: 'base-dusk' } }]);
    const K = G('7');
    put('public/campaigns/d/levels/base.json', levelText('Base', [['well', { id: 'w', text: ['Deep.'], textKeys: { text: [K] } }]]));
    put('public/campaigns/d/levels/base-dusk.json', levelText('Base', [['well', { id: 'w', text: ['Deep, and dark.'], textKeys: { text: [K] } }]]));
    table('ja', 'campaigns/d', { [K]: { source: 'Deep.', target: '深い。' } });
    table('zh', 'campaigns/d', { [K]: { source: 'Deep, and dark.', target: '又深又暗。' } });
    const f1 = run('--fix', 'public/campaigns/d');
    const dusk = keysOf('public/campaigns/d/levels/base-dusk.json')[0];
    const ja = readTable('ja', 'campaigns/d').units;
    const zh = readTable('zh', 'campaigns/d').units;
    ok('M8: --fix — the copy whose English the (first) table translates keeps the key; the other copy\'s zh unit moves with it', f1.code === 0 && keysOf('public/campaigns/d/levels/base.json')[0] === K && dusk !== K && ja[K]?.target === '深い。' && !(K in zh) && zh[dusk]?.source === 'Deep, and dark.' && zh[dusk]?.target === '又深又暗。', [f1.text, ja, zh]);

    // M8: "the later file": POSIX path order (not the order campaign.json lists them)
    campaign('public/campaigns/e', ['b', 'a']);
    const J = G('8');
    put('public/campaigns/e/levels/b.json', levelText('B', [['well', { id: 'w', text: ['From b.'], textKeys: { text: [J] } }]]));
    put('public/campaigns/e/levels/a.json', levelText('A', [['well', { id: 'w', text: ['From a.'], textKeys: { text: [J] } }]]));
    const f2 = run('--fix', 'public/campaigns/e');
    ok('M8: --fix — no table, no variant: the first file in POSIX path order (a.json) keeps the key', f2.code === 0 && keysOf('public/campaigns/e/levels/a.json')[0] === J && keysOf('public/campaigns/e/levels/b.json')[0] !== J, f2.text);

    // M8: a tracked (shipped) file is never re-keyed for a user's (untracked) one
    const git = (...g) => spawnSync('git', g, { cwd: tmp, encoding: 'utf8' });
    if (git('init', '-q').status === 0) {
      campaign('public/campaigns/f', ['base'], [{ id: 'two', when: 'f', levels: { base: 'base-mine' } }]);
      const H = G('9');
      put('public/campaigns/f/levels/base.json', levelText('Base', [['well', { id: 'w', text: ['Shipped.'], textKeys: { text: [H] } }]]));
      put('public/campaigns/f/levels/base-mine.json', levelText('Base', [['well', { id: 'w', text: ['Mine.'], textKeys: { text: [H] } }]]));
      table('ja', 'campaigns/f', { [H]: { source: 'Mine.', target: '私の。' } });
      git('add', 'public/campaigns/f/campaign.json', 'public/campaigns/f/levels/base.json');
      const f3 = run('--fix', 'public/campaigns/f');
      const mine = keysOf('public/campaigns/f/levels/base-mine.json')[0];
      const jf = readTable('ja', 'campaigns/f').units;
      ok('M8: --fix — the tracked file keeps the key though the tables translate the user\'s English; the unit moves to the user\'s new key', f3.code === 0 && keysOf('public/campaigns/f/levels/base.json')[0] === H && mine !== H && jf[mine]?.target === '私の。' && !(H in jf), [f3.text, jf]);
    } else ok('git is available for the rank test', false);

    // S7: a file outside the tree is seeded by its name (no OS path in the seed)
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'luminati-keys-out-'));
    try {
      const f = path.join(out, 'outside.json');
      fs.writeFileSync(f, levelText('Out', [['well', { id: 'w', text: ['Far.'] }]]));
      const o1 = run('--assign', f);
      ok('S7: --assign on a file outside the tree: seeded by its file name', o1.code === 0 && keysOf(path.relative(tmp, f))[0] === guidOf('outside.json|w.text|0|Far.'), o1.text);
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// =================================================================================================
begin('review wave D: the engine never imports the game (rc F1)');
{
  const src = fs.readFileSync(path.join(ROOT, 'src/engine/i18n/TextKeys.js'), 'utf8');
  ok('F1: TextKeys.js imports nothing from src/game', !/^\s*import\b[^;]*from\s+['"][^'"]*\/game\//m.test(src));
  eq('F1: StoryFormat re-exports the engine\'s eventIdOf / stageIdOf (one function each)', [storyFormatIds.eventIdOf === eventIdOf, storyFormatIds.stageIdOf === stageIdOf], [true, true]);
  eq('F1: … read as the loader reads them', [eventIdOf({ id: 'ford' }, 0), eventIdOf({ id: '' }, 2), eventIdOf('x', 4), eventIdOf({ id: 7 }, 1), stageIdOf({ id: 'a' }, 0), stageIdOf('A bare stage.', 3), stageIdOf(null, 0)], ['ford', 'event-3', 'event-5', 'event-2', 'a', '4', '1']);
}

// =================================================================================================
begin('review wave D: the level\'s own stray keys (rc F2, rk COULD 7)');
{
  const K = G('C');
  const L = createEmptyLevel({ name: 'Stray', width: 8, depth: 8 });
  L.subtitle = '';
  L.environment.title = { title: 'T' };
  /** @type {any} */ (L).textKeys = { subtitle: K, 'title.title': G('D'), 'title.prompt': G('E') };
  const n = normalizeLevel(L);
  eq('normalizeLevel: a key of a title line the environment lacks is dropped, with a warning; a blank subtitle keeps its key', [n.level.textKeys, n.warnings.length, /1 malformed or unknown text key/.test(n.warnings[0] ?? '')], [{ subtitle: K, 'title.title': G('D') }, 1, true]);
  const issues = textKeyIssues(n.level);
  eq('textKeyIssues: the key on the blank subtitle is stray (`level › subtitle`)', issues.map((i) => `${i.kind} ${i.where}`), ['stray level › subtitle']);
  const ok2 = normalizeLevel({ ...structuredClone(L), subtitle: 'Now a subtitle' });
  eq('… a subtitle with text: no issue', textKeyIssues(ok2.level), []);
  const again = parseLevel(serializeLevel(n.level));
  eq('… the cleaned level round-trips with no warning', [again.warnings, serializeLevel(again.level) === serializeLevel(n.level)], [[], true]);
}

// =================================================================================================
begin('review wave D: edits across runs and best-first pairing (rc F6, rk COULD 3)');
{
  eq('F6: a line moved and edited in one edit keeps its key (paired across runs)', alignTexts(['Alpha one two three.', 'Bravo four five six.'], ['Bravo four five six!', 'Alpha one two three.']), [1, 0]);
  eq('F6: … also in the generators (blind false)', alignTexts(['Alpha one two three.', 'Bravo four five six.'], ['Bravo four five six!', 'Alpha one two three.'], { blind: false }), [1, 0]);
  eq('COULD 3: a new first page, the old first page edited, the last deleted: the edit keeps its own key (the new page takes what is left, blindly)', alignTexts(['hens lay eggs like mad every day', 'the fox came by last night again'], ['A new opening page about hens.', 'hens lay eggs like crazy every day']), [1, 0]);
  eq('… without blind (the generators) the new page stays new', alignTexts(['hens lay eggs like mad every day', 'the fox came by last night again'], ['A new opening page about hens.', 'hens lay eggs like crazy every day'], { blind: false }), [-1, 0]);
  eq('two edited lines swapped in one run: each keeps its own key (most alike first)', alignTexts(['a b c d', 'e f g h'], ['e f g x', 'a b c y']), [1, 0]);
  eq('an unlike edit in place still keeps its key in the editor (blind leftovers)', alignTexts(['x', 'the old lantern burns'], ['x', 'something else entirely now']), [0, 1]);
  const mint = counter();
  const s0 = carryObjectText(null, { id: 's', type: 'signpost', text: ['Alpha one two three.', 'Bravo four five six.'] }, mint, new Set());
  const s1 = carryObjectText(s0, { ...structuredClone(s0), text: ['Bravo four five six!', 'Alpha one two three.'] }, mint, new Set());
  eq('F6: the editor\'s carry: both sign pages keep their keys (rc editor-probe step 3)', s1.textKeys.text, [s0.textKeys.text[1], s0.textKeys.text[0]]);
}

// =================================================================================================
begin('review wave D: a story file\'s renamed ids keep their keys (rk S2)');
{
  const mint = counter();
  const story = {
    items: { plank: { name: 'Plank', text: 'A sound oak plank.' }, rope: { name: 'Rope', text: 'Rope.' } },
    quests: { 'find-ilse': { title: 'Find Ilse', text: 'Ilse is missing.', stages: [{ id: 'planks', text: 'Find planks.' }, { id: 'ford', text: 'Cross the ford.' }], goals: [{ text: 'Three planks.' }] } },
    scripts: { greet: ['- Hello there, traveller.', 'set met'] },
    actors: { wren: { name: 'Wren', talk: ['- A child\'s line.'] } },
    events: [{ id: 'ford-open', on: 'change', run: ['toast The ford is open.'] }],
  };
  carryStoryFile(null, story, mint);
  const k = structuredClone(story);
  /** @type {any} */
  const ren = structuredClone(story);
  for (const sec of ['items', 'quests']) for (const e of Object.values(ren[sec])) delete e.textKeys;
  ren.items = { 'oak-plank': { name: 'Plank', text: 'A sound oak plank.' }, rope: ren.items.rope };
  ren.quests = { 'find-ferryman': { ...ren.quests['find-ilse'], stages: [{ id: 'timber', text: 'Find planks.' }, { id: 'ford', text: 'Cross the ford.' }] } };
  ren.scripts = { hello: ['- Hello there, traveller.', 'set met'] };
  ren.actors = { robin: { name: 'Robin', talk: ['- A child\'s line.'] } };
  ren.events = [{ id: 'ford-opened', on: 'change', run: ['toast The ford is open.'] }];
  carryStoryFile(k, ren, mint);
  const q0 = k.quests['find-ilse'].textKeys;
  const q1 = ren.quests['find-ferryman'].textKeys;
  eq('S2: an item, a quest (text, stages, goals) renamed keep their keys', [ren.items['oak-plank'].textKeys.text, q1.text, q1.stages.timber, q1.stages.ford, q1.goals[0]], [k.items.plank.textKeys.text, q0.text, q0.stages.planks, q0.stages.ford, q0.goals[0]]);
  eq('S2: … a script, an actor\'s talk, an event\'s run renamed keep their lines\' tags', [tagOf(ren.scripts.hello[0]), tagOf(ren.actors.robin.talk[0]), tagOf(ren.events[0].run[0])], [tagOf(k.scripts.greet[0]), tagOf(k.actors.wren.talk[0]), tagOf(k.events[0].run[0])]);
  // the old holder still there with that English: it keeps its key; a copy elsewhere gets a new one
  /** @type {any} */
  const both = structuredClone(k);
  both.items.copy = { name: 'Copy', text: 'A sound oak plank.' };
  delete both.items.copy.textKeys;
  carryStoryFile(k, both, mint);
  ok('S2: … but not while the old holder still holds that English (the copy gets a new key)', both.items.plank.textKeys.text === k.items.plank.textKeys.text && isGuid(both.items.copy.textKeys.text) && both.items.copy.textKeys.text !== k.items.plank.textKeys.text, both.items);
  // an English two texts of the kind had: no guess
  /** @type {any} */
  const two = { items: { a: { name: 'A', text: 'Same.' }, b: { name: 'B', text: 'Same.' } } };
  carryStoryFile(null, two, mint);
  /** @type {any} */
  const two2 = { items: { c: { name: 'C', text: 'Same.' } } };
  carryStoryFile(two, two2, mint);
  ok('S2: … nor for an English the previous file had twice', ![two.items.a.textKeys.text, two.items.b.textKeys.text].includes(two2.items.c.textKeys.text));
  // the generator's rerun: the same input, the same keys
  const again = structuredClone(ren);
  for (const sec of ['items', 'quests']) for (const e of Object.values(again[sec])) delete /** @type {any} */ (e).textKeys;
  again.scripts.hello = ['- Hello there, traveller.', 'set met'];
  carryStoryFile(ren, again, mint);
  eq('S2: … and an unchanged rerun keeps every key', again, ren);
}

// =================================================================================================
begin('review wave D: --assign never replaces a valid key; --fix realigns (rk M1, S1, COULD 9; rc F7)');
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'luminati-keys-'));
  try {
    const put = (rel, text) => { const f = path.join(tmp, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); return f; };
    const levelText = (name, objects) => {
      const L = createEmptyLevel({ name, width: 8, depth: 8 });
      for (const [type, fields] of objects) place(L, type, fields);
      return serializeLevel(normalizeLevel(L).level);
    };
    const campaign = (dir, levels, chapters = [], story = []) => put(`${dir}/campaign.json`, serializeCampaign(normalizeCampaign({ format: 'luminati-campaign', version: 1, name: 'C', levels: levels.map((id) => ({ id })), chapters, story }).campaign));
    const table = (lang, id, units) => put(`public/i18n/${lang}/${id}.json`, `${JSON.stringify({ format: 'luminati-i18n', version: 3, lang, source: id, extends: [], terms: {}, units }, null, 2)}\n`);
    const run = (...argv) => {
      /** @type {string[]} */
      const lines = [];
      const code = keysTool([...argv, `--root=${tmp}`, '--quiet'], { log: (s) => lines.push(s), err: (s) => lines.push(s) });
      return { code, lines, text: lines.join('\n') };
    };
    const level = (rel) => parseLevel(fs.readFileSync(path.join(tmp, rel), 'utf8')).level;
    const A = G('A');
    const B = G('B');
    const U = (source) => ({ source, target: `訳:${source}` });

    // M1: the base's two pages swapped by hand, its key list left as it was
    const dir = 'public/campaigns/m';
    campaign(dir, ['town'], [{ id: 'two', when: 'f', levels: { town: 'town-dusk' } }]);
    const baseRel = `${dir}/levels/town.json`;
    const duskRel = `${dir}/levels/town-dusk.json`;
    put(baseRel, levelText('Town', [['exit', { id: 'x', label: 'Enter', locked: ['Second page.', 'First page.'], textKeys: { locked: [A, B] } }]]));
    put(duskRel, levelText('Town', [['exit', { id: 'x', label: 'Enter', locked: ['First page.', 'Second page.'], textKeys: { locked: [A, B] } }]]));
    table('ja', 'campaigns/m', { [A]: U('First page.'), [B]: U('Second page.') });
    const duskBefore = fs.readFileSync(path.join(tmp, duskRel), 'utf8');
    const baseBefore = fs.readFileSync(path.join(tmp, baseRel), 'utf8');
    const a1 = run('--assign', dir);
    ok('M1: --assign while a key has two Englishes: refused (exit 1), nothing written, --fix named', a1.code === 1 && /campaigns\/m: not assigned — 2 text key\(s\) with two Englishes/.test(a1.text) && /--fix first/.test(a1.text) && fs.readFileSync(path.join(tmp, duskRel), 'utf8') === duskBefore && fs.readFileSync(path.join(tmp, baseRel), 'utf8') === baseBefore, a1.text);
    const f1 = run('--fix', dir);
    eq('M1: --fix realigns before it splits: the base\'s keys swapped back (no new key), the variant untouched, 0 problems', [level(baseRel).objects[0].textKeys.locked, level(duskRel).objects[0].textKeys.locked, f1.code, run(dir).code], [[B, A], [A, B], 0, 0]);
    // the same with a page inserted at the top by hand: the keyless page the key's English moved to takes it
    put(baseRel, levelText('Town', [['exit', { id: 'x', label: 'Enter', locked: ['A new page.', 'First page.', 'Second page.'], textKeys: { locked: [A, B, null] } }]]));
    const f2 = run('--fix', dir);
    const ins = level(baseRel).objects[0].textKeys.locked;
    ok('M1: a page inserted above: --fix swaps the shifted key back and gives the keyless page its key; only the new page gets a new key', f2.code === 0 && ins[1] === A && ins[2] === B && isGuid(ins[0]) && ![A, B].includes(ins[0]) && / 0 problem\(s\)/.test(f2.lines.at(-1) ?? ''), [ins, f2.text]);
    const a2 = run('--assign', dir);
    ok('… then --assign has nothing left to block (exit 0)', a2.code === 0, a2.text);

    // S1: a page copied with its key above itself, the top copy edited (one file, two Englishes)
    const sRel = 'public/levels/s.json';
    put(sRel, levelText('S', [['npc', { id: 'n', name: 'N', dialogue: ['Slimes everywhere!', 'Slimes in the quarry.'], textKeys: { dialogue: [B, B] } }]]));
    table('ja', 'levels/s', { [B]: U('Slimes in the quarry.') });
    const s1 = run('--assign', sRel);
    ok('S1: --assign on a key repeated with two Englishes: refused, the original keeps its key', s1.code === 1 && /levels\/s: not assigned/.test(s1.text) && /on two texts of one file/.test(s1.text) && isDeepStrictEqual(level(sRel).objects[0].textKeys.dialogue, [B, B]), s1.text);
    const s2 = run('--fix', sRel);
    const sk = level(sRel).objects[0].textKeys.dialogue;
    ok('S1: --fix (it reads the tables): the original keeps the key, the edited copy gets a new one', s2.code === 0 && sk[1] === B && isGuid(sk[0]) && sk[0] !== B, [sk, s2.text]);

    // COULD 9: a CRLF .story file stays CRLF
    const cdir = 'public/campaigns/crlf';
    campaign(cdir, ['a'], [], ['talk.story']);
    put(`${cdir}/levels/a.json`, levelText('A', [['well', { id: 'w', text: ['Deep.'] }]]));
    const story = put(`${cdir}/story/talk.story`, '== s\r\n- One.\r\nset x\r\n- Two.\r\n');
    const c1 = run('--assign', cdir);
    const out = fs.readFileSync(story, 'utf8');
    ok('COULD 9: --assign keeps a CRLF .story file CRLF', c1.code === 0 && /^== s\r\n- One\. #line:[0-9A-F]{32}\r\nset x\r\n- Two\. #line:[0-9A-F]{32}\r\n$/.test(out), JSON.stringify(out));

    // F7: messages name the table
    put(duskRel, fs.readFileSync(path.join(tmp, duskRel), 'utf8').replace('"First page."', '"First page, at dusk."'));
    const k1 = run(dir);
    ok('F7: the conflict line names the table (`campaigns/m\'s files`)', k1.code === 1 && /in campaigns\/m's files/.test(k1.text), k1.text);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// =================================================================================================
const ms = Math.round(performance.now() - t0);
if (verbose) for (const [name, n] of sections) console.log(`  ${name}: ${n}`);
for (const f of failures) console.error(`  ✗ ${f}`);
console.log(`text-key self-test: ${passed} passed, ${failures.length} failed (${sections.length} sections, ${ms} ms)`);
process.exit(failures.length ? 1 : 0);
