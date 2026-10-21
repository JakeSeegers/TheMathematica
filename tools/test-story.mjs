#!/usr/bin/env node
/**
 * test-story.mjs — the Node self-test of the story system (`npm run story:test`): assertions on the
 * condition and script language (src/engine/level/StoryScript.js), the story files
 * (src/game/campaign/StoryFormat.js), the level story checks (src/engine/level/StoryChecks.js),
 * story conditions on objects (src/engine/level/Travel.js), campaign.json
 * (src/game/campaign/CampaignFormat.js) and the campaign check's story and link rules
 * (tools/lib/campaigncheck.mjs), on small in-memory fixtures — no files, no browser; and the format ids
 * the files are written with (ADR-053).
 *
 *   node tools/test-story.mjs [--verbose]
 *     --verbose   list every section with its count
 *
 * Prints a summary; exit code 1 when an assertion fails (each failure is listed with what it got).
 */
import { isDeepStrictEqual } from 'node:util';
import { readFileSync } from 'node:fs';
import {
  parseCondition, flagCondition, cachedCondition, evalCondition, conditionRefs, isStoryName, isFlagName, parseScript,
  scriptLines, hasScript, splitArgs, scriptRefs, interpolate, varyIndex, editDistance, SCRIPT_LIMITS, SCRIPT_COMMANDS, RESERVED_WORDS,
  isPlayerName,
  cachedScriptCondition, plainNumber, parseRef, isBareName, emptyRefs, addConditionRefs,
  BACKGROUND_OPS, backgroundIssue, backgroundIssues, walkNodes, PARTY_VERBS, closestName,
} from '../src/engine/level/StoryScript.js';
import { PRESET_NAMES, CLASS_NAMES, RULE_KEYS, RULE_FIELDS, MAX_PARTY } from '../src/engine/level/PartyRules.js';
import { valueRange } from '../src/engine/level/StoryStates.js';
import * as StoryCondition from '../src/engine/level/StoryCondition.js';
import * as StoryScript from '../src/engine/level/StoryScript.js';
import {
  storyIssues, levelStoryRefs, formatStoryIssue, scriptSpeakers, levelNames, readCondition, conditionError, refIssues, conditionFields, partyTests,
  stagedActors, backgroundErrors,
} from '../src/engine/level/StoryChecks.js';
import { OBJECT_TYPES } from '../src/engine/level/ObjectCatalog.js';
import { CampaignState } from '../src/game/campaign/CampaignState.js';
import {
  storyExclusive, applyStory, storyAllows, findEntrance, entranceName, storyFlags, conditionTester, LIVE_STORY_TYPES,
} from '../src/engine/level/Travel.js';
import {
  buildStory, isStoryFileName, storyFileList, serializeStory, serializeStoryText, titleCase, storyFile, MAX_STORY_FILES,
  STORY_FORMAT,
} from '../src/game/campaign/StoryFormat.js';
import {
  normalizeCampaign, serializeCampaign, parseCampaign, activeChapter, chapterLevelId, levelVariants, acrossSeam, isLevelId,
  CAMPAIGN_FORMAT,
} from '../src/game/campaign/CampaignFormat.js';
import {
  createEmptyLevel, addObject, normalizeLevel, serializeLevel, parseLevel, LEVEL_FORMAT,
} from '../src/engine/level/LevelFormat.js';
import { checkCampaign, couldHold } from './lib/campaigncheck.mjs';

/** @import { Level } from '../src/engine/level/types.js' */

const verbose = process.argv.includes('--verbose');
const t0 = performance.now();
let passed = 0;
/** @type {string[]} */
const failures = [];
let section = '';
/** @type {[string, number][]} */
const sections = [];
const show = (v) => {
  try {
    return JSON.stringify(v, (_, x) => (x instanceof Set ? [...x] : x instanceof Map ? Object.fromEntries(x) : x));
  } catch {
    return String(v);
  }
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
/** Does some message of the list contain every one of the parts? @param {string[]} list */
const hasMsg = (list, ...parts) => list.some((m) => parts.every((p) => m.includes(p)));

// helpers for scripts (the node union is read loosely here)
/** @returns {any} */
const cond = (s) => parseCondition(s).cond;
/** @returns {any} */
const fc = (s) => flagCondition(s);
/** A partial level object (the story fields read only a few keys). @param {object} o @returns {any} */
const obj = (o) => o;
const condErr = (s) => parseCondition(s).error;
/** @returns {any[]} */
const nodes = (src) => parseScript(src).nodes;
/** @returns {any} */
const node = (src) => nodes(src)[0];
/** The args of a one-line command. @returns {any} */
const args = (line) => node([line])?.args;
/** The first error message of a script ('' none). */
const error = (src) => parseScript(src).errors[0]?.msg ?? '';
/** Every error message of a script, one per line. */
const errors = (src) => parseScript(src).errors.map((e) => `${e.line}: ${e.msg}`).join(' | ');
const errorLine = (src) => parseScript(src).errors[0]?.line ?? 0;

/** A reader of story values: flags / variables from `vars`, items, quests, the game values. */
const reader = (vars = {}, more = {}) => ({
  get: (r) => {
    if (r.kind === '') return vars[r.name] ?? 0;
    if (r.kind === 'game') return more[r.name] ?? 0;
    if (r.kind === 'item') return more[`item:${r.name}`] ?? 0;
    if (r.kind === 'quest') return more[`quest:${r.name}`] ?? 'none';
    return 0;
  },
  word: (r, w) => (r.kind === '' || r.kind === 'game' || r.kind === 'item' ? vars[w] ?? 0 : w),
});

// =================================================================================================
begin('conditions');
eq('empty is always', cond(''), { op: 'const', value: true });
eq('blank is always', cond('   '), { op: 'const', value: true });
eq('a flag', cond('bridge-mended'), { op: 'ref', ref: { kind: '', name: 'bridge-mended' } });
eq('not / and / item compare', cond('not refused and item:plank >= 3'), {
  op: 'and', a: { op: 'not', a: { op: 'ref', ref: { kind: '', name: 'refused' } } },
  b: { op: 'cmp', ref: { kind: 'item', name: 'plank' }, cmp: '>=', value: 3 },
});
eq('quest state', cond('quest:find-ilse = active'), { op: 'cmp', ref: { kind: 'quest', name: 'find-ilse' }, cmp: '=', value: 'active' });
eq('game values and or', cond('hour >= 20 or hour < 6').op, 'or');
eq('hour is a game value', cond('hour >= 20').a ?? cond('hour >= 20').ref, { kind: 'game', name: 'hour' });
eq('symbols ! && ||', cond('!a && (b || c)'), {
  op: 'and', a: { op: 'not', a: { op: 'ref', ref: { kind: '', name: 'a' } } },
  b: { op: 'or', a: { op: 'ref', ref: { kind: '', name: 'b' } }, b: { op: 'ref', ref: { kind: '', name: 'c' } } },
});
eq('== is =', cond('a == 1').cmp, '=');
eq('and binds tighter than or', cond('a or b and c').op, 'or');
eq('words are case-insensitive', cond('a AND NOT b').op, 'and');
eq('stage compared to a word', cond('stage:q >= found').value, 'found');
eq('negative numbers', cond('debt < -2').value, -2);
ok('quest needs a state', condErr('quest:x = maybe').includes('a quest is'), condErr('quest:x = maybe'));
ok('quest is no number', condErr('quest:x > 1').includes('compared to a word'), condErr('quest:x > 1'));
ok('chapter only = / !=', condErr('chapter < two').includes('only be compared with = or !='), condErr('chapter < two'));
ok('unknown kind', condErr('foo:bar').includes('unknown kind'), condErr('foo:bar'));
ok('a number alone', condErr('3').includes('cannot stand alone'), condErr('3'));
ok('reserved word', condErr('ending').includes('reserved'), condErr('ending'));
eq('party: a game value (how many members)', cond('party >= 2'), { op: 'cmp', ref: { kind: 'game', name: 'party' }, cmp: '>=', value: 2 });
eq('party:<who>: a reference', cond('party:sela'), { op: 'ref', ref: { kind: 'party', name: 'sela' } });
ok('ends too early', condErr('a and').includes('ends too early'), condErr('a and'));
ok('missing )', condErr('(a or b').includes(')'), condErr('(a or b'));
ok('two names', condErr('a b').includes('unexpected "b"'), condErr('a b'));
ok('value missing', condErr('a =').includes('value is missing'), condErr('a ='));
ok('bad character', condErr('a $ b').includes('cannot be in a condition'), condErr('a $ b'));
ok('nested too deeply', condErr(`${'('.repeat(40)}a${')'.repeat(40)}`).includes('nested too deeply'));
ok('too long', condErr(`a${' or a'.repeat(120)}`).includes('longer than 500'));
eq('an error gives const false', cond('a and'), { op: 'const', value: false });
ok('isStoryName ok', isStoryName('a-b.c_d') && isStoryName('Ferry2'));
ok('isStoryName rejects numbers, signs, length, non-strings', !isStoryName('3') && !isStoryName('-x') && !isStoryName('a b') && !isStoryName('x'.repeat(81)) && !isStoryName(3) && !isStoryName(null));
ok('isFlagName rejects reserved words in any case', !isFlagName('gold') && !isFlagName('Gold') && !isFlagName('none') && !isFlagName('and') && isFlagName('bridge'));
ok('RESERVED_WORDS has the game values', RESERVED_WORDS.has('hour') && RESERVED_WORDS.has('chapter'));
// back-compat: bare names in when / unless / requires / chapter when are always that flag
eq('flagCondition: a reserved bare name is a flag', flagCondition('gold'), { op: 'ref', ref: { kind: '', name: 'gold' } });
eq('flagCondition: level too', fc('level').ref, { kind: '', name: 'level' });
eq('flagCondition: a flag with spaces is that literal flag', flagCondition('my flag'), { op: 'ref', ref: { kind: '', name: 'my flag' } });
eq('flagCondition: a condition parses', flagCondition('a and b').op, 'and');
eq('flagCondition: kind:name parses', fc('item:plank').ref, { kind: 'item', name: 'plank' });
eq('flagCondition: blank', flagCondition(''), { op: 'const', value: true });
eq('flagCondition: a number is a literal flag', fc('3').ref, { kind: '', name: '3' });
ok('cachedCondition caches by text', cachedCondition('x and y') === cachedCondition('x and y'));
{
  const r = reader({ a: 1, n: 4, 'inn.price': 5 }, { gold: 7, 'item:plank': 3, 'quest:q': 'active' });
  const holds = (s) => evalCondition(cond(s), r);
  ok('eval flag', holds('a') && !holds('b'));
  ok('eval not / and / or', holds('a and not b') && holds('b or a') && !holds('a and b'));
  ok('eval numbers', holds('n >= 4') && holds('n != 3') && !holds('n < 4') && holds('item:plank = 3'));
  ok('eval text', holds('quest:q = active') && holds('quest:q != done') && !holds('quest:q = done'));
  ok('eval a variable on the right', holds('gold >= inn.price') && !holds('n >= inn.price'));
  ok('conditionTester', conditionTester(r)('a and n > 3') && !conditionTester(r)('b'));
}
eq('conditionRefs', conditionRefs(cond('a and not item:x > 2 or quest:q = done')).map((x) => [x.ref.kind, x.ref.name, x.value ?? null]), [['', 'a', null], ['item', 'x', 2], ['quest', 'q', 'done']]);

// =================================================================================================
begin('script lines');
eq('dialogue', node(['Hollis: Hello there.']), { t: 'say', line: 1, speaker: 'Hollis', text: 'Hello there.' });
eq('narrator', node([': The river roars.']).speaker, '');
eq('a quoted speaker', node(['"A voice": Psst.']).speaker, 'A voice');
eq('- with no line above: the villager talked to', node(['- Hello.']).speaker, null);
eq('- repeats the speaker above', nodes(['Hollis: One.', '- Two.'])[1].speaker, 'Hollis');
{
  // lexical: the nearest line of dialogue above in the text, whatever branch it sits in
  const n = nodes(['choice Which?', '  > A', '    Wren: One.', '  > B', '    - Two.']);
  eq('- is lexical across options', n[0].options[1].body[0].speaker, 'Wren');
}
eq('a command word goes first', node(['toast Obtained: an apple']), { t: 'cmd', line: 1, op: 'toast', args: { text: 'Obtained: an apple' } });
eq('\\n is a line break', node(['Hollis: One\\ntwo']).text, 'One\ntwo');
eq('\\\\ is a backslash', node(['Hollis: a\\\\b']).text, 'a\\b');
eq('comments and blank lines keep line numbers', nodes(['# note', '', 'Hollis: Hi.'])[0].line, 3);
ok('a misspelt command is an error, with a hint', error(['wiat 2']).includes('did you mean "wait"'), error(['wiat 2']));
ok('plain text is an error', error(['hello there']).includes('is not a command'));
ok('an empty line of dialogue', error(['Hollis:']).includes('says nothing'));
ok('dialogue takes no block', error(['Hollis: a', '  stop']).includes('takes no indented block'));
eq('unexpected indentation', parseScript(['if a', '    x: 1', '  y: 2']).errors.map((e) => [e.line, e.msg]), [[3, 'unexpected indentation']]);
eq('the rest of a script runs after an error', nodes(['bogus', 'Hollis: still here']).length, 1);
eq('the error has its line', errorLine([': ok', '', 'bogus']), 3);
ok('a block command needs a block', error(['if a']).includes('an indented block must follow'));
ok('stop takes no block', error(['stop', '  Hollis: x']).includes('takes no indented block'));
eq('scriptLines: a string splits', scriptLines('a\nb\r\nc'), ['a', 'b', 'c']);
eq('scriptLines: array entries split, non-strings dropped', scriptLines(['a\nb', 3, null, 'c']), ['a', 'b', 'c']);
eq('scriptLines: anything else is none', scriptLines({ a: 1 }), []);
ok('hasScript', hasScript(['# only a comment', 'stop']) && !hasScript(['# only a comment', '  ']) && !hasScript(undefined));
eq('splitArgs quotes', splitArgs('a "b c" "d \\" e"'), ['a', 'b c', 'd " e']);
{
  const big = Array.from({ length: SCRIPT_LIMITS.lines + 1 }, () => ': x');
  const p = parseScript(big);
  ok('at most 4000 lines', p.errors.some((e) => e.line === SCRIPT_LIMITS.lines + 1) && p.nodes.length === SCRIPT_LIMITS.lines);
  ok('a line longer than 2000 characters', parseScript([`: ${'x'.repeat(2001)}`]).errors[0]?.line === 1);
}

// =================================================================================================
begin('script blocks');
{
  const n = node(['if a', '  : one', 'elif b and c', '  : two', 'else', '  : three']);
  eq('if / elif / else', [n.t, n.branches.length, n.branches[1].src, n.otherwise.length], ['if', 2, 'b and c', 1]);
  ok('elif without if', error(['elif a', '  stop']).includes('elif without an if'));
  ok('else without if', error(['else', '  stop']).includes('else without an if'));
  ok('else takes nothing', error(['if a', '  stop', 'else now', '  stop']).includes('takes nothing'));
  ok('a bad if condition', error(['if a and', '  stop']).startsWith('if:'));
}
{
  const n = node(['choice Give the planks?', '  > Not yet', '    : Later.', '  > [if item:plank >= 3] Here', '    take plank 3', '  > [once] Thanks', '  > [once if a] Both']);
  eq('choice text and options', [n.t, n.text, n.options.length], ['choice', 'Give the planks?', 4]);
  eq('option plain', [n.options[0].label, n.options[0].cond, n.options[0].once, n.options[0].body.length], ['Not yet', null, false, 1]);
  eq('option [if]', [n.options[1].label, n.options[1].src, n.options[1].cond.op], ['Here', 'item:plank >= 3', 'cmp']);
  eq('option [once]', [n.options[2].once, n.options[2].cond, n.options[2].body], [true, null, []]);
  eq('option [once if]', [n.options[3].once, n.options[3].src], [true, 'a']);
  eq('a choice without a question', node(['choice', '  > Ok']).text, '');
  eq('a choice holds only options', errors(['choice', '  : hi']), '1: a choice needs at least one option | 2: a choice holds only options ("> label")');
  ok('an option outside a choice', error(['> Ok']).includes('must be inside a choice'));
  ok('an option without a label', errors(['choice', '  > [once]']).includes('2: the option has no label'), errors(['choice', '  > [once]']));
  ok('a bad option condition', errors(['choice', '  > [if a and] X', '  > Y']) === '2: option condition: the condition ends too early', errors(['choice', '  > [if a and] X', '  > Y']));
  ok('at most 8 options', error(['choice', ...Array.from({ length: 9 }, (_, k) => `  > O${k}`)]).includes('at most 8'));
}
{
  eq('loop / break', node(['loop', '  break']).body[0], { t: 'cmd', line: 2, op: 'break', args: {} });
  eq('once', [node(['once met', '  : Hi.']).t, node(['once met', '  : Hi.']).key], ['once', 'met']);
  ok('once needs a key', error(['once', '  stop']).includes('once <key>'));
  const v = node(['cycle greet', '  * Hollis: Morning.', '  * : Nothing.', '  *', '    : Two', '    : lines']);
  eq('cycle alternatives', [v.t, v.mode, v.key, v.alts.length, v.alts[2].length], ['vary', 'cycle', 'greet', 3, 2]);
  eq('an inline alternative command', node(['seq s', '  * set a']).alts[0][0].op, 'set');
  eq('pick', node(['pick p', '  * : a']).mode, 'pick');
  ok('a vary holds only alternatives', errors(['cycle c', '  : x']).includes('2: a cycle / seq / pick holds only "*" alternatives'), errors(['cycle c', '  : x']));
  ok('a vary needs an alternative', errors(['cycle c', '  : x']).includes('1: a cycle needs at least one "*" alternative'));
  ok('an alternative outside a vary', error(['* : x']).includes('must be inside a cycle'));
  ok('an empty alternative', errors(['seq s', '  *', '  * : ok']) === '2: an empty alternative', errors(['seq s', '  *', '  * : ok']));
  ok('a block command inline in an alternative', errors(['seq s', '  * if a', '  * : ok']).includes('2: "if" needs a line of its own'), errors(['seq s', '  * if a', '  * : ok']));
  const deep = (n) => [...Array.from({ length: n }, (_, k) => `${'  '.repeat(k)}loop`), `${'  '.repeat(n)}break`];
  ok('16 nested blocks are fine', parseScript(deep(16)).errors.length === 0, parseScript(deep(16)).errors);
  ok('17 nested blocks are not', error(deep(17)).includes('nested deeper than 16'), error(deep(17)));
}

// =================================================================================================
begin('commands');
ok('every command has help', Object.values(SCRIPT_COMMANDS).every((c) => typeof c.help === 'string' && c.help));
for (const op of ['stop', 'rest', 'heal', 'shop', 'cutscene', 'break']) {
  eq(`${op} takes nothing`, args(op), {});
}
ok('stop takes nothing after it', error(['stop now']).includes('takes nothing'));
eq('call', args('call intro'), { script: 'intro' });
ok('call needs a name', error(['call']).includes('missing'));
eq('builtin', args('builtin elder'), { script: 'elder' });
eq('wait seconds', args('wait 2.5'), { seconds: 2.5 });
eq('wait for an actor', args('wait hollis'), { who: 'hollis' });
ok('wait: too long', error(['wait 700']).includes('not a time'));
ok('wait: one word', error(['wait a b']).includes('wait <seconds>'));
eq('set', args('set bridge-mended'), { name: 'bridge-mended' });
eq('clear', args('clear bridge-mended'), { name: 'bridge-mended' });
ok('set: a reserved word', error(['set Gold']).includes('reserved'));
ok('set: one flag', error(['set a b']).includes('set <flag>'));
eq('var =', args('var deliveries = 2'), { name: 'deliveries', by: '=', value: 2 });
eq('var +=', args('var deliveries += 1').by, '+');
eq('var - negative', args('var debt - -1.5'), { name: 'debt', by: '-', value: -1.5 });
ok('var: unknown operator', error(['var x * 2']).includes('is not = + or -'));
ok('var: not a number', error(['var x = abc']).includes('is not a number'));
eq('give', args('give plank 3'), { item: 'plank', count: 3 });
eq('give one', args('give plank'), { item: 'plank', count: 1 });
eq('take', args('take plank 2'), { item: 'plank', count: 2 });
ok('give: a whole count', error(['give plank 0']).includes('whole number') && error(['give plank 1.5']).includes('whole number'));
eq('quest start', args('quest find-ilse start Find Ilse'), { id: 'find-ilse', verb: 'start', text: 'Find Ilse' });
eq('quest stage', args('quest find-ilse stage found She is safe.'), { id: 'find-ilse', verb: 'stage', stage: 'found', text: 'She is safe.' });
eq('quest done / fail', [args('quest q done'), args('quest q fail')], [{ id: 'q', verb: 'done' }, { id: 'q', verb: 'fail' }]);
ok('quest done takes nothing', error(['quest q done now']).includes('takes nothing'));
ok('quest: unknown verb', error(['quest q finish']).includes('quest <id> start'));
eq('home', args('home hollis'), { who: 'hollis' });
eq('home x z', args('home hollis 3 4.5'), { who: 'hollis', x: 3, z: 4.5 });
ok('home: x and z', error(['home hollis 3']).includes('home <who> [x z]'));
eq('time hour', args('time 20'), { hour: 20 });
eq('time hh:mm', args('time 6:30'), { hour: 6.5 });
ok('time: 0–24', error(['time 25']).includes('time <hour'));
eq('weather', args('weather rain'), { weather: 'rain' });
ok('weather: known ones', error(['weather fog']).includes('weather clear'));
eq('travel', args('travel mill-road'), { level: 'mill-road', entrance: '' });
eq('travel to an entrance', args('travel mill-road from-ford'), { level: 'mill-road', entrance: 'from-ford' });
ok('travel: a level', error(['travel']).includes('travel <level>'));
eq('ending', args('ending home The Lantern Comes Home'), { id: 'home', title: 'The Lantern Comes Home' });
eq('walk to a point', args('walk hollis 3 4'), { who: 'hollis', run: false, wait: true, x: 3, z: 4 });
eq('walk to a target, run, nowait', args('walk hollis well run nowait'), { who: 'hollis', run: true, wait: false, to: 'well' });
ok('walk: where to', error(['walk hollis']).includes('walk <who>'));
eq('teleport with facing', args('teleport hollis 3 4 left'), { who: 'hollis', facing: 'left', x: 3, z: 4 });
eq('face a direction', args('face hollis up'), { who: 'hollis', dir: 'up' });
eq('face an actor', args('face hollis wren'), { who: 'hollis', to: 'wren' });
eq('emote by name', args('emote hollis heart'), { who: 'hollis', icon: '♥', seconds: 1.6 });
eq('emote ... and seconds', args('emote hollis ... 2'), { who: 'hollis', icon: '…', seconds: 2 });
ok('emote: unknown icon', error(['emote hollis nope']).includes('is not an emote'));
eq('camera reset', args('camera reset'), { reset: true, seconds: 0.8 });
eq('camera point', args('camera 3 4 2'), { x: 3, z: 4, seconds: 2 });
eq('camera actor', args('camera hollis 1.5'), { who: 'hollis', seconds: 1.5 });
ok('camera reset: one time', error(['camera reset 1 2']).includes('camera reset'));
eq('shake', args('shake'), { amount: 0.3 });
ok('shake: 0–2', error(['shake 3']).includes('shake [amount'));
eq('fade', [args('fade out'), args('fade in 1')], [{ dir: 'out', seconds: 0.5 }, { dir: 'in', seconds: 1 }]);
ok('fade: out or in', error(['fade sideways']).includes('fade out | in'));
eq('banner with a subtitle', args('banner Chapter Two | Lanterns Home'), { title: 'Chapter Two', subtitle: 'Lanterns Home' });
eq('banner \\| is a bar', args('banner A \\| B'), { title: 'A | B', subtitle: '' });
eq('sfx / music', [args('sfx chime'), args('music on')], [{ name: 'chime' }, { track: 'on' }]);
ok('a removed command is no command', !Object.hasOwn(SCRIPT_COMMANDS, 'constructor') && error(['constructor x']).includes('is not a command'));

// =================================================================================================
begin('references and text');
{
  const r = scriptRefs(nodes([
    'if a and item:plank >= 3 and quest:q = active',
    '  set b',
    'choice',
    '  > [if stage:q >= found] X',
    '    var c + 1',
    'give plank',
    'take chart',
    'give gold 5',
    'quest q stage found',
    'call intro',
    'builtin elder',
    'walk hollis well',
    'face wren player',
    'camera bench',
    'travel mill-road ford',
    'once met',
    '  Hollis: hi',
    'sfx chime',
    'music festival',
    'if gold >= inn.price and visited:mill-road and done:met',
    '  stop',
  ]));
  eq('reads', [...r.reads].sort(), ['a', 'inn.price']);
  eq('writes', [...r.writes].sort(), ['b', 'c']);
  eq('items (gold is money)', [...r.items].sort(), ['chart', 'plank']);
  eq('gives', [...r.gives], ['plank']);
  eq('quests and stages', [[...r.quests], r.stages], [['q'], [{ quest: 'q', stage: 'found' }, { quest: 'q', stage: 'found' }]]);
  eq('scripts / builtins', [[...r.scripts], [...r.builtins]], [['intro'], ['elder']]);
  eq('actors (player left out)', [...r.actors].sort(), ['hollis', 'wren']);
  eq('targets', [...r.targets].sort(), ['bench', 'well']);
  eq('speakers', [...r.speakers], ['Hollis']);
  eq('levels and travels', [[...r.levels].sort(), r.travels], [['mill-road'], [{ level: 'mill-road', entrance: 'ford', line: 15 }]]);
  eq('onces, done, sounds, tracks', [[...r.onces], [...r.done], [...r.sounds], [...r.tracks]], [['met'], ['met'], ['chime'], ['festival']]);
}
{
  const r = reader({ deliveries: 3 }, { gold: 12.345, 'item:plank': 2, hour: 7 });
  eq('${} values', interpolate('You have ${gold} gold, ${item:plank} planks, ${deliveries} done at ${hour}.', r), 'You have 12.35 gold, 2 planks, 3 done at 7.');
  eq('$$ is a dollar', interpolate('$$5', r), '$5');
  eq('a reference that does not parse stays', interpolate('${foo:bar} ${a b}', r), '${foo:bar} ${a b}');
  eq('no $: the same text', interpolate('plain', r), 'plain');
}
eq('varyIndex cycle', [0, 1, 2, 3, 4].map((c) => varyIndex('cycle', 3, c, 'k', 1)), [0, 1, 2, 0, 1]);
eq('varyIndex seq', [0, 1, 2, 3, 4].map((c) => varyIndex('seq', 3, c, 'k', 1)), [0, 1, 2, 2, 2]);
{
  const picks = Array.from({ length: 30 }, (_, c) => varyIndex('pick', 4, c, 'greet', 2));
  ok('varyIndex pick in range', picks.every((p) => Number.isInteger(p) && p >= 0 && p < 4));
  ok('varyIndex pick is deterministic', isDeepStrictEqual(picks, Array.from({ length: 30 }, (_, c) => varyIndex('pick', 4, c, 'greet', 2))));
  ok('varyIndex pick varies', new Set(picks).size > 1);
  ok('varyIndex one alternative', varyIndex('pick', 1, 5, 'k', 3) === 0 && varyIndex('cycle', 0, 5, 'k', 3) === 0);
}
ok('editDistance', editDistance('wait', 'wait') === 0 && editDistance('wiat', 'wait') === 2 && editDistance('a', 'abcdef') === 99);

// =================================================================================================
begin('story files');
ok('isStoryFileName', isStoryFileName('main.json') && isStoryFileName('act-1.story') && !isStoryFileName('Main.json') && !isStoryFileName('con.json') && !isStoryFileName('a.txt') && !isStoryFileName('../x.json'));
eq('storyFile', storyFile('main.json'), 'story/main.json');
{
  const w = [];
  eq('storyFileList: valid names once', storyFileList(['main.json', 'main.json', 'BAD.json', 3, 'talk.story'], w), ['main.json', 'talk.story']);
  ok('storyFileList: a warning per bad name', w.length === 2, w);
}
{
  const { story, warnings } = buildStory([{ name: 'main.json', text: JSON.stringify({
    format: 'luminati-story', version: 1,
    vars: { deliveries: 0, open: true, gold: 1, 'bad name': 2, odd: 'x' },
    items: { plank: { name: 'Oak plank', key: false }, chart: 'Ferry chart', gold: 'x', 'lantern-key': { key: true } },
    quests: { 'find-ilse': { title: 'Find Ilse', stages: ['Asked', { id: 'found', text: 'Found' }, { id: 'found', text: 'again' }, { id: 'bad stage' }], goals: [{ text: 'Reach the ford', done: 'bridge-mended' }, { done: 'x' }] } },
    actors: { hollis: { name: 'Hollis', preset: 'farmer', talk: 'hollis-talk', portraitColor: '#b07b44' }, wren: { talk: ['Wren: Hi.'], preset: 'dragon' }, odo: { talk: 'not a name' } },
    scripts: { 'hollis-talk': ['Hollis: Yes?'], 'bad id!': ['stop'] },
    events: [{ id: 'flood', on: 'change', if: 'bridge-mended', once: true, run: 'hollis-talk' }, { on: 'arrive', level: 'mill-road', run: ['toast Hi'] }, { id: 'x', on: 'tick', run: 'hollis-talk' }, { id: 'y', run: 'not ok!' }, 5],
    starts: { late: { level: 'old-quarry', vars: { open: 1, gold: 3 }, items: { plank: 2, gold: 5 }, quests: { 'find-ilse': 'found' }, gold: 40.7 } },
  }) }]);
  eq('vars: booleans become numbers, bad names dropped', { ...story.vars }, { deliveries: 0, open: 1, odd: 0 });
  ok('vars warnings', hasMsg(warnings, 'main.json: vars: "gold"') && hasMsg(warnings, '"bad name"') && hasMsg(warnings, '"odd" must start as a number'), warnings);
  eq('items: shorthand, key items, gold is built in', Object.keys(story.items), ['plank', 'chart', 'lantern-key']);
  eq('item names', [story.items.chart.name, story.items['lantern-key'].name, story.items['lantern-key'].key], ['Ferry chart', 'Lantern Key', true]);
  eq('quest stages: strings numbered, duplicates and bad names dropped', story.quests['find-ilse'].stages.map((s) => s.id), ['1', 'found']);
  eq('quest goals (a goal needs text)', story.quests['find-ilse'].goals, [{ text: 'Reach the ford', done: 'bridge-mended' }]);
  eq('actor', { ...story.actors.hollis }, { name: 'Hollis', preset: 'farmer', portraitColor: '#b07b44', talk: 'hollis-talk' });
  eq('actor: inline talk is the script actor.<id>', [story.actors.wren.talk, story.scripts['actor.wren'].lines], ['actor.wren', ['Wren: Hi.']]);
  ok('actor: a bad look and talk are warned and ignored', story.actors.wren.preset === '' && story.actors.odo.talk === '' && hasMsg(warnings, '"dragon"') && hasMsg(warnings, 'talk "not a name"'), warnings);
  ok('scripts: a bad id is dropped', !('bad id!' in story.scripts) && hasMsg(warnings, '"bad id!"'));
  eq('events', story.events.map((e) => [e.id, e.on, e.run, e.once, e.level]), [['flood', 'change', 'hollis-talk', true, ''], ['event-2', 'arrive', 'event.event-2', false, 'mill-road'], ['x', 'change', 'hollis-talk', false, '']]);
  ok('events: warnings for a bad on, a bad run, a non-object', hasMsg(warnings, 'event "x": "on"') && hasMsg(warnings, 'event "y": "run" names no script') && hasMsg(warnings, 'events[4] is not an object'), warnings);
  eq('starts', { ...story.starts.late, vars: { ...story.starts.late.vars }, items: { ...story.starts.late.items }, quests: { ...story.starts.late.quests } },
    { level: 'old-quarry', entrance: '', vars: { open: 1 }, items: { plank: 2 }, quests: { 'find-ilse': 'found' }, gold: 40 });
  ok('maps are prototype-less', Object.getPrototypeOf(story.items) === null && story.items.constructor === undefined && Object.getPrototypeOf(story.scripts) === null);
}
{
  const src = ['# The dialogue of act one', '', '== hollis-talk', 'Hollis: Hi.', '  ', '', '== wren-talk', 'Wren: Yo.', '- Bye.', '', '== hollis-talk', 'dup', '== bad!', 'x'].join('\n');
  const { story, warnings } = buildStory([{ name: 'talk.story', text: src }]);
  eq('.story: scripts by header', Object.keys(story.scripts), ['hollis-talk', 'wren-talk']);
  eq('.story: trailing blank lines are not part of a script', story.scripts['hollis-talk'].lines, ['Hollis: Hi.']);
  eq('.story: where a script starts (the line after its header)', [story.scripts['hollis-talk'].line, story.scripts['wren-talk'].line, story.scripts['wren-talk'].file], [4, 8, 'talk.story']);
  ok('.story: a duplicate and a bad id are warned with their line', hasMsg(warnings, 'talk.story:11: script "hollis-talk" is declared twice') && hasMsg(warnings, 'talk.story:13:'), warnings);
  ok('.story: text before the first header', hasMsg(buildStory([{ name: 'a.story', text: 'Hollis: hi\n== x\nstop' }]).warnings, 'a.story:1: text before'));
}
{
  const { story, warnings } = buildStory([
    { name: 'a.json', text: JSON.stringify({ format: 'luminati-story', items: { plank: 'First' }, scripts: { s: ['stop'] } }) },
    { name: 'b.story', text: '== s\n: second' },
    { name: 'c.json', text: JSON.stringify({ format: 'luminati-story', items: { plank: 'Second' } }) },
    { name: 'd.json', text: '{ nope' },
    { name: 'e.json', text: '[1]' },
    { name: 'f.json', text: JSON.stringify({ format: 'other', version: 9 }) },
  ]);
  eq('duplicates across files: the first wins', [story.items.plank.name, story.scripts.s.file], ['First', 'a.json']);
  ok('duplicate warnings', hasMsg(warnings, 'c.json: item "plank" is declared twice') && hasMsg(warnings, 'b.story:1: script "s" is declared twice'), warnings);
  ok('not JSON / not an object / format / version', hasMsg(warnings, 'd.json: not valid JSON') && hasMsg(warnings, 'e.json: not a JSON object') && hasMsg(warnings, 'f.json: "format"') && hasMsg(warnings, 'f.json: version 9'), warnings);
}
{
  const vars = Object.fromEntries(Array.from({ length: 5000 }, (_, k) => [`v${k}`, k]));
  eq('at most 4096 entries a section', Object.keys(buildStory([{ name: 'big.json', text: JSON.stringify({ format: 'luminati-story', vars }) }]).story.vars).length, 4096);
  const proto = buildStory([{ name: 'p.json', text: '{"format":"luminati-story","items":{"__proto__":"Odd","constructor":"Also"}}' }]).story;
  ok('hostile names stay data', Object.getPrototypeOf(proto.items) === null && proto.items.constructor?.name === 'Also' && Object.keys(proto.items).length === 2);
}
{
  const text = serializeStory({ vars: { a: 1 }, items: { plank: { name: 'Plank' } }, scripts: { s: ['Hollis: hi', 'stop'] }, events: [] });
  const back = buildStory([{ name: 'x.json', text }]);
  ok('serializeStory: a luminati-story file, empty sections left out', text.startsWith('{\n  "format": "luminati-story",\n  "version": 1,') && !text.includes('"events"') && text.endsWith('}\n'));
  eq('serializeStory round trip', [back.warnings, back.story.scripts.s.lines, back.story.items.plank.name], [[], ['Hollis: hi', 'stop'], 'Plank']);
  const st = serializeStoryText({ a: ['Hollis: hi'], b: ['stop'] });
  eq('serializeStoryText', st, '== a\nHollis: hi\n\n== b\nstop\n');
  eq('serializeStoryText round trip', Object.entries(buildStory([{ name: 'x.story', text: st }]).story.scripts).map(([k, v]) => [k, v.lines, v.line]), [['a', ['Hollis: hi'], 2], ['b', ['stop'], 5]]);
}
eq('titleCase', titleCase('ferry-lantern_old.one'), 'Ferry Lantern Old One');

// =================================================================================================
begin('level story checks');
/**
 * A small grass level with objects: [type, x, z, fields] (fields.id sets the id).
 * @returns {Level}
 */
function makeLevel(name, objects = [], { width = 16, depth = 12 } = {}) {
  const raw = createEmptyLevel({ name, width, depth, border: 0 });
  for (const [type, x, z, fields = {}] of objects) {
    const o = addObject(raw, /** @type {any} */ (type), x, z, fields);
    if (fields.id) o.id = fields.id;
  }
  return normalizeLevel(raw).level;
}
/** A prop type the game applies on entering only (not LIVE_STORY_TYPES), or null once every one is live. */
const ENTRY_ONLY_PROP = Object.keys(OBJECT_TYPES).find((t) => OBJECT_TYPES[t].kind === 'prop' && !LIVE_STORY_TYPES.has(t)) ?? null;
{
  const L = makeLevel('story-checks', [
    ['npc', 4, 4, { id: 'hollis', name: 'Hollis', talk: ['Hollis: Hi.', '"A voice": Psst.', 'Stranger: Who?', 'Stranger: Again.', 'bogus', 'call intro', 'give plank', 'quest q stage lost', 'travel nowhere'], flag: 'met-hollis', actor: 'hollis-actor' }],
    ['npc', 8, 4, { id: 'wren', name: 'Wren', flag: 'gold' }],
    ['event', 6, 6, { id: 'clock', on: 'time', run: ['stop'] }],
    ['event', 6, 6, { id: 'watch', on: 'change', run: ['stop'] }],
    ['event', 6, 6, { id: 'fight', on: 'cleared', run: ['stop'] }],
    ['event', 6, 6, { id: 'empty', on: 'use', run: [] }],
    ['house', 10, 8, { id: 'hut', when: 'met-hollis' }],
    ...(ENTRY_ONLY_PROP ? [[ENTRY_ONLY_PROP, 14, 8, { id: 'still', when: 'met-hollis' }]] : []),
    ['tree', 2, 9, { id: 'oak', when: 'a and' }],
    ['tree', 3, 9, { id: 'birch', unless: '3' }],
    ['tree', 4, 9, { id: 'elm', when: 'my flag' }],
  ]);
  const plain = storyIssues(L);
  const msgs = plain.map((i) => formatStoryIssue(i, L));
  ok('a script line that does not parse: an error with its line', plain.some((i) => i.severity === 'error' && i.id === 'hollis' && i.field === 'talk' && i.line === 5), msgs);
  ok('a quoted speaker is meant as written', !hasMsg(msgs, 'speaker "A voice"'), msgs);
  ok('an unknown speaker: one warning, at its first line', plain.filter((i) => i.msg.includes('speaker "Stranger"')).map((i) => [i.severity, i.line]).join() === 'warning,3', msgs);
  ok('call without story files: a warning', plain.some((i) => i.severity === 'warning' && i.msg.includes('"call" needs')), msgs);
  ok('a clock event needs an hour', hasMsg(msgs, 'event clock › at', 'clock event'), msgs);
  ok('a change event needs a condition', hasMsg(msgs, 'event watch › if'), msgs);
  ok('a cleared event needs a group', hasMsg(msgs, 'event fight › group'), msgs);
  ok('an event without a script', hasMsg(msgs, 'event empty › run', 'no script'), msgs);
  ok('a condition that does not parse', plain.some((i) => i.severity === 'error' && i.id === 'oak' && i.field === 'when'), msgs);
  ok('a number is no flag name', plain.some((i) => i.severity === 'error' && i.id === 'birch' && i.field === 'unless'), msgs);
  ok('a flag name with spaces', plain.some((i) => i.severity === 'error' && i.id === 'elm' && i.msg.includes('read as one flag named "my flag"')), msgs);
  ok('a reserved word as a villager flag', hasMsg(msgs, 'npc wren "Wren" › flag', 'not a usable flag name'), msgs);
  ok('a house (live) reads a flag set in its own level: no warning', !plain.some((i) => i.id === 'hut' && i.msg.includes('only when the level is entered')), msgs);
  if (ENTRY_ONLY_PROP) ok(`an entry-only object (${ENTRY_ONLY_PROP}) reads a flag set in its own level`, plain.some((i) => i.id === 'still' && i.severity === 'warning' && i.msg.includes('only when the level is entered')), msgs);
  ok('formatStoryIssue names the villager', hasMsg(msgs, 'npc hollis "Hollis" › talk:5:'), msgs);
  ok('no story context: names are not checked against declarations', !hasMsg(msgs, 'not declared') && !hasMsg(msgs, 'no stage'), msgs);
  const ctx = { items: new Set(['chart']), quests: new Map([['q', ['found']]]), scripts: new Set(['other']), actors: new Map([['wren-actor', 'Wren']]), levels: new Set(['story-checks']) };
  const withCtx = storyIssues(L, ctx).map((i) => `${i.severity} ${formatStoryIssue(i, L)}`);
  ok('ctx: a script that is not in the story files', hasMsg(withCtx, 'error', 'script "intro" is not in the story files'), withCtx);
  ok('ctx: an undeclared item', hasMsg(withCtx, 'warning', 'item "plank" is not declared'), withCtx);
  ok('ctx: a quest stage that does not exist', hasMsg(withCtx, 'error', 'quest "q" has no stage "lost"'), withCtx);
  ok('ctx: travel to a level the campaign lacks', hasMsg(withCtx, 'error', 'travel: "nowhere"'), withCtx);
  ok('ctx: an undeclared actor', hasMsg(withCtx, 'warning', 'actor "hollis-actor" is not declared'), withCtx);
  ok('ctx: call has story files now', !hasMsg(withCtx, '"call" needs'), withCtx);
  eq('levelStoryRefs: villager flags and script writes', [...levelStoryRefs(makeLevel('r', [['npc', 4, 4, { flag: 'a', talk: ['set b', 'if c', '  stop'] }]])).sets].sort(), ['a', 'b']);
  const names = levelNames(L);
  ok('levelNames: villagers, actors, objects', names.actors.has('hollis') && names.actors.has('hollis-actor') && names.npcNames.get('wren') === 'wren' && names.places.has('hut'));
  eq('scriptSpeakers', scriptSpeakers(['Hollis: a', '"A voice": b', 'seq s', '  * "Echo": c', '  * Wren: d'], nodes(['Hollis: a', '"A voice": b', 'seq s', '  * "Echo": c', '  * Wren: d'])).map((s) => [s.speaker, s.line, s.quoted]),
    [['Hollis', 1, false], ['A voice', 2, true], ['Echo', 4, true], ['Wren', 5, false]]);
}

// =================================================================================================
begin('object conditions (Travel)');
ok('storyExclusive: when / unless', storyExclusive(obj({ when: 'a' }), obj({ unless: 'a' })) && storyExclusive(obj({ unless: 'a' }), obj({ when: 'a' })));
ok('storyExclusive: x / not x', storyExclusive(obj({ when: 'a' }), obj({ when: 'not a' })) && storyExclusive(obj({ unless: 'not b' }), obj({ unless: 'b' })));
ok('storyExclusive: unrelated or unconditioned', !storyExclusive(obj({ when: 'a' }), obj({ when: 'b' })) && !storyExclusive(obj({}), obj({})) && !storyExclusive(obj({ when: 'a' }), obj({ when: 'a' })));
ok('storyExclusive: by what the conditions test, not their text', storyExclusive(obj({ when: 'a and b' }), obj({ unless: 'a' })) && storyExclusive(obj({ when: 'a', unless: 'b' }), obj({ when: 'b' }))
  && storyExclusive(obj({ when: 'x != 0' }), obj({ when: 'x = 0' })) && !storyExclusive(obj({ when: 'a or b' }), obj({ unless: 'a' })));
ok('storyExclusive: numbers and words', storyExclusive(obj({ when: 'hour >= 20' }), obj({ when: 'hour < 6' })) && !storyExclusive(obj({ when: 'hour >= 20 or hour < 6' }), obj({ when: 'hour < 6' }))
  && storyExclusive(obj({ when: 'item:plank >= 3' }), obj({ when: 'item:plank < 2' })) && !storyExclusive(obj({ when: 'item:plank >= 3' }), obj({ when: 'item:plank < 4' }))
  && storyExclusive(obj({ when: 'quest:q = done' }), obj({ when: 'quest:q = active' })) && !storyExclusive(obj({ when: 'quest:q = done' }), obj({ when: 'quest:q != active' }))
  && storyExclusive(obj({ when: 'chapter = two' }), obj({ when: 'chapter = three' })));
ok('storyExclusive: a comparison against a word read either way; whole numbers; visited 0 / 1', storyExclusive(obj({ when: 'stage:q >= bridge-fixed' }), obj({ when: 'stage:q < bridge-fixed' }))
  && storyExclusive(obj({ when: 'planks > needed' }), obj({ when: 'planks <= needed' })) && !storyExclusive(obj({ when: 'stage:q >= a' }), obj({ when: 'stage:q < b' }))
  && storyExclusive(obj({ when: 'day > 2' }), obj({ when: 'day < 3' })) && !storyExclusive(obj({ when: 'hour > 2' }), obj({ when: 'hour < 3' }))
  && storyExclusive(obj({ when: 'visited:mill' }), obj({ unless: 'visited:mill = 1' })));
ok('storyExclusive: an unconditioned object and one that can be there', !storyExclusive(obj({}), obj({ when: 'a' })) && !storyExclusive(obj({ unless: 'a' }), obj({})));
ok('storyExclusive: past 12 tests, the textual rule', storyExclusive(obj({ when: Array.from({ length: 13 }, (_, i) => `f${i}`).join(' and ') }), obj({ unless: Array.from({ length: 13 }, (_, i) => `f${i}`).join(' and ') }))
  && !storyExclusive(obj({ when: Array.from({ length: 13 }, (_, i) => `f${i}`).join(' and ') }), obj({ unless: 'f0' })));
{
  const L = makeLevel('apply', [
    ['npc', 4, 4, { id: 'keeper', when: 'open' }],
    ['house', 10, 8, { id: 'hut', when: 'open' }],
    ['tree', 2, 9, { id: 'oak', unless: 'open' }],
    ['rock', 3, 9, { id: 'stone' }],
    ['entrance', 5, 5, { id: 'e1', name: 'gate', when: 'not open' }],
    ['entrance', 6, 5, { id: 'e2', name: 'gate', when: 'open' }],
  ]);
  const closed = (c) => c === 'not open';
  const ids = (l) => l.objects.map((o) => o.id);
  eq('applyStory: what the story allows', ids(applyStory(L, closed)), ['oak', 'stone', 'e1']);
  eq('applyStory live: live types stay for the game to show and hide', ids(applyStory(L, closed, { live: true })), ['keeper', 'hut', 'oak', 'stone', 'e1', 'e2']);
  ok('applyStory live keeps every live object', applyStory(L, () => true, { live: true }).objects.length === 6);
  const plainL = makeLevel('plain', [['rock', 3, 3, {}]]);
  ok('applyStory: nothing dropped → the same object', applyStory(plainL, () => false) === plainL);
  ok('LIVE_STORY_TYPES', LIVE_STORY_TYPES.has('npc') && LIVE_STORY_TYPES.has('tree') && ['house', 'windmill', 'well', 'waterfall', 'critters', 'emitter'].every((t) => LIVE_STORY_TYPES.has(t)));
  ok('LIVE_STORY_TYPES: catalog types only', [...LIVE_STORY_TYPES].every((t) => Object.hasOwn(OBJECT_TYPES, t)));
  ok('storyAllows', storyAllows(obj({ when: 'a', unless: 'b' }), (c) => c === 'a') && !storyAllows(obj({ when: 'a', unless: 'b' }), () => true));
  eq('findEntrance: any story state without holds', findEntrance(L, 'gate')?.id, 'e1');
  eq('findEntrance: the one the story has now', findEntrance(L, 'gate', (c) => c === 'open')?.id, 'e2');
  ok('findEntrance: unknown or blank', findEntrance(L, 'nope') === null && findEntrance(L, '') === null);
  ok('entranceName: name, else id', entranceName(obj({ id: 'x', name: 'gate' })) === 'gate' && entranceName(obj({ id: 'x', name: '' })) === 'x');
  const f = storyFlags(makeLevel('flags', [['npc', 4, 4, { flag: 'met' }], ['exit', 8, 8, { to: 'b', requires: 'key and not lost' }], ['rock', 2, 2, { when: 'n >= limit' }]]));
  eq('storyFlags', [[...f.reads].sort(), [...f.sets]], [['key', 'limit', 'lost', 'n'], ['met']]);
}

// =================================================================================================
begin('campaign.json');
{
  const raw = {
    format: 'luminati-campaign', version: 1, name: 'Test', start: { level: 'a' },
    levels: [{ id: 'a', at: [0, 0] }, { id: 'b', at: [16, 0] }, 'c', { id: 'Bad' }, { id: 'a' }],
    chapters: [
      { id: 'one' },
      { id: 'two', when: 'key', levels: { a: 'a-two', zz: 'v', b: 'Bad_Id', c: 'b' } },
      { id: 'three', when: 'quest:q = done', levels: { b: 'a-two' } },
      'nope',
    ],
    flags: ['started', '  ', 3],
    story: ['main.json', 'talk.story', 'main.json', 'BAD.json'],
    mods: { keep: true },
  };
  const { campaign: c, warnings, errors } = normalizeCampaign(raw);
  eq('levels: string entries, bad and repeated ids dropped', c.levels, [{ id: 'a', at: [0, 0] }, { id: 'b', at: [16, 0] }, { id: 'c', at: null }]);
  eq('no errors', errors, []);
  eq('the story list', c.story, ['main.json', 'talk.story']);
  ok('a bad story file name is warned', hasMsg(warnings, 'story: "BAD.json"'), warnings);
  eq('variants: only valid ones', [{ ...c.chapters[1].levels }, { ...c.chapters[2].levels }], [{ a: 'a-two' }, {}]);
  ok('variant warnings: unknown level, bad id, a campaign level, one variant for two levels', hasMsg(warnings, '"zz" is not one of') && hasMsg(warnings, '"Bad_Id"') && hasMsg(warnings, '"b" is a level of the campaign itself') && hasMsg(warnings, 'already stands for "a"') && hasMsg(warnings, 'chapters[3]'), warnings);
  eq('flags: text only', c.flags, ['started']);
  eq('unknown keys are kept', c.extra, { mods: { keep: true } });
  const text = serializeCampaign(c);
  ok('serialize keeps the story list and unknown keys', text.includes('"story": [\n    "main.json",\n    "talk.story"\n  ]') && text.includes('"mods": {'), text);
  ok('serialize: an at pair on one line', text.includes('"at": [16, 0]'));
  eq('serialize → parse → serialize is stable', serializeCampaign(parseCampaign(text).campaign), text);
  eq('activeChapter: the last whose condition holds', [activeChapter(c, () => false)?.id, activeChapter(c, (w) => w === 'key')?.id, activeChapter(c, () => true)?.id], ['one', 'two', 'three']);
  eq('chapterLevelId', [chapterLevelId(c, 'a', () => false), chapterLevelId(c, 'a', (w) => w === 'key'), chapterLevelId(c, 'a', () => true)], ['a', 'a-two', 'a']);
  eq('levelVariants', [levelVariants(c, 'a'), levelVariants(c, 'b')], [['a', 'a-two'], ['b']]);
  eq('acrossSeam', [acrossSeam(c, 'a', 'b', 15.5, 3), acrossSeam(c, 'a', 'c', 1, 1)], [{ x: -0.5, z: 3 }, null]);
  ok('isLevelId', isLevelId('mill-road') && !isLevelId('Mill') && !isLevelId('con') && !isLevelId('-x') && !isLevelId('a'.repeat(61)));
  const bad = normalizeCampaign({ format: 'x', levels: [], start: { level: 'q' } });
  ok('errors: format, no levels', hasMsg(bad.errors, '"format"') && hasMsg(bad.errors, 'no levels'), bad.errors);
  ok('errors: an unknown start level', hasMsg(normalizeCampaign({ format: 'luminati-campaign', levels: ['a'], start: { level: 'q' } }).errors, 'start level "q"'));
}

// =================================================================================================
begin('campaign check');
{
  // a (16 × 12) | b (16 × 12) side by side; c an interior; d placed off by half a tile, unreached
  const levels = {
    a: makeLevel('a', [
      ['npc', 4, 4, { id: 'giver', name: 'Giver', flag: 'got-key' }],
      ['exit', 15.5, 6, { id: 'east', to: 'b', minX: 15, maxX: 16, minZ: 4, maxZ: 8 }],
      ['exit', 3, 10, { id: 'vault', to: 'c', entrance: 'from-a', mode: 'use', requires: 'vault-open', minX: 2, maxX: 4, minZ: 9, maxZ: 11 }],
      ['entrance', 8, 6, { id: 'home', name: 'home' }],
    ]),
    'a-two': makeLevel('a-two', [
      ['exit', 15.5, 6, { id: 'east', to: 'b', minX: 15, maxX: 16, minZ: 4, maxZ: 8 }],
      ['entrance', 8, 6, { id: 'gate', name: 'gate' }],
      ['exit', 1, 1, { id: 'locked', to: 'b', requires: 'never-set', minX: 0, maxX: 2, minZ: 0, maxZ: 2 }],
    ], { depth: 10 }),
    b: makeLevel('b', [
      ['exit', 0.5, 6, { id: 'west', to: 'a', minX: 0, maxX: 1, minZ: 4, maxZ: 8 }],
      ['exit', 8, 1, { id: 'to-gate', to: 'a', entrance: 'gate', mode: 'use', minX: 7, maxX: 9, minZ: 0, maxZ: 2 }],
      ['exit', 8, 10, { id: 'to-gate-later', to: 'a', entrance: 'gate', mode: 'use', when: 'got-key', minX: 7, maxX: 9, minZ: 9, maxZ: 11 }],
      ['exit', 12, 10, { id: 'to-nowhere', to: 'a', entrance: 'nowhere', mode: 'use', minX: 11, maxX: 13, minZ: 9, maxZ: 11 }],
      ['npc', 4, 4, { id: 'teller', name: 'Teller', talk: ['Teller: Hi.', 'call intro', 'take chart', 'travel a no-such'] }],
    ]),
    c: makeLevel('c', [
      ['entrance', 8, 6, { id: 'from-a', name: 'from-a' }],
      ['npc', 4, 4, { id: 'keeper', name: 'Keeper', flag: 'vault-open' }],
      ['exit', 8, 10, { id: 'out', to: 'a', entrance: 'home', mode: 'use', minX: 7, maxX: 9, minZ: 9, maxZ: 11 }],
    ]),
    d: makeLevel('d'),
  };
  const campaignRaw = {
    format: 'luminati-campaign', name: 'Check', start: { level: 'a' },
    levels: [{ id: 'a', at: [0, 0] }, { id: 'b', at: [16, 0] }, { id: 'c' }, { id: 'd', at: [0.5, 40] }],
    chapters: [{ id: 'one' }, { id: 'two', when: 'got-key', levels: { a: 'a-two' } }, { id: 'bad', when: 'got-key and' }],
    story: ['main.json', 'talk.story', 'missing.json'],
  };
  const storyFiles = {
    'main.json': JSON.stringify({
      format: 'luminati-story',
      vars: { counter: 0 },
      items: { chart: 'Chart', spare: 'Spare' },
      quests: { q: { stages: [{ id: 'one' }] } },
      actors: { teller: { name: 'Teller', talk: 'teller-talk' }, ghost: { name: 'Ghost', talk: 'no-script' } },
      scripts: { intro: ['Teller: Welcome.', 'quest q stage two', 'set intro-seen', 'Narrator: hm', 'set lonely-flag'] },
      events: [{ id: 'arrive-b', on: 'arrive', level: 'b', run: 'intro', if: 'counter >= 2' }],
    }),
    'talk.story': ['# talk', '== teller-talk', 'Teller: Yes?', 'if intro-seen', '  - Again.', 'whatt', 'call gone'].join('\n'),
  };
  const { campaign } = normalizeCampaign(campaignRaw);
  const read = (id) => (Object.hasOwn(levels, id) ? { level: levels[id], warnings: [] } : null);
  const r = checkCampaign(campaign, read, { levelChecks: false, readStory: (n) => storyFiles[n] ?? null });
  const lv = (id) => [...r.levels.get(id).report.errors, ...r.levels.get(id).report.warnings];
  ok('a variant of another size is an error', hasMsg(r.errors, 'levels/a-two.json is 16 × 10', 'a chapter variant must keep its base\'s size'), r.errors);
  ok('a fractional at is a warning', hasMsg(r.warnings, 'level "d": "at" [0.5, 40] is not on whole tiles'), r.warnings);
  ok('an entrance in no file of the target is an error', hasMsg(r.errors, 'exit to-nowhere arrives at entrance "nowhere"'), r.errors);
  ok('an entrance only in a chapter variant is a warning', hasMsg(r.warnings, 'exit to-gate arrives at entrance "gate"', 'only levels/a-two.json') && !hasMsg(r.errors, 'exit to-gate '), r.warnings);
  ok('… and only info for an exit with a story condition', hasMsg(r.info, 'exit to-gate-later arrives at entrance "gate"', 'fine if'), r.info);
  ok('seams are checked for chapter variants too', hasMsg(r.info, 'seam a | b:') && hasMsg(r.info, 'seam a-two | b (chapter two):'), r.info);
  ok('a story file that does not exist', hasMsg(r.errors, 'story/missing.json does not exist'), r.errors);
  ok('a chapter condition that does not parse', hasMsg(r.errors, 'chapter "bad": when "got-key and"'), r.errors);
  ok('.story script errors carry the file line', hasMsg(r.errors, 'story/talk.story:6: "whatt" is not a command'), r.errors);
  ok('call targets in story scripts', hasMsg(r.errors, 'story/talk.story:7: call: script "gone"'), r.errors);
  ok('quest stages in story scripts', hasMsg(r.errors, 'story/main.json › script "intro" line 2: quest "q" has no stage "two"'), r.errors);
  ok('an actor\'s talk names a script', hasMsg(r.errors, 'actor "ghost": talk names script "no-script"'), r.errors);
  ok('a speaker that is no actor', hasMsg(r.warnings, 'script "intro" line 4: speaker "Narrator"') && !hasMsg(r.warnings, 'speaker "Teller"'), r.warnings);
  ok('level scripts: an entrance a travel names exists somewhere', hasMsg(r.errors, 'levels/b.json › npc teller › talk:4: travel: level "a" has no entrance "no-such"'), r.errors);
  ok('level files get storyIssues with the story context', !hasMsg(lv('b'), '"call" needs') && !hasMsg(lv('b'), 'item "chart" is not declared'), lv('b'));
  ok('an item taken but never given', hasMsg(r.warnings, 'item "chart" is taken (levels/b.json › npc teller › talk:3) but never given'), r.warnings);
  ok('a variable read but never written … is declared (vars count as written)', !hasMsg(r.warnings, 'story flag "counter"'), r.warnings);
  ok('the fixpoint: an exit whose flag is set only where the player cannot go', hasMsg(r.warnings, 'levels/a.json: exit vault (→ c) can never open', '"vault-open" is set only by levels/c.json › npc keeper › flag'), r.warnings);
  ok('the fixpoint: an exit whose flag nothing sets', hasMsg(r.warnings, 'levels/a-two.json: exit locked (→ b) can never open: it needs "never-set"'), r.warnings);
  ok('the fixpoint: a level behind exits that never open', hasMsg(r.warnings, 'level "c" is reached only through exits that can never open'), r.warnings);
  ok('the fixpoint: a flag set only where the player cannot go', hasMsg(r.warnings, 'story flag "vault-open" is set only where the player cannot get to'), r.warnings);
  ok('a flag read but never set', hasMsg(r.warnings, 'story flag "never-set" (read by levels/a-two.json › exit locked › requires) is never set'), r.warnings);
  ok('a level no exit reaches', hasMsg(r.warnings, 'level "d" cannot be reached'), r.warnings);
  ok('declared but unused: info', hasMsg(r.info, 'item "spare" is declared but') && hasMsg(r.info, 'actor "ghost" is declared but') && !hasMsg(r.info, 'actor "teller" is declared'), r.info);
  ok('flags set and read: no info', !hasMsg(r.info, 'story flag "got-key" is set') && !hasMsg(r.info, 'story flag "intro-seen"'), r.info);
  ok('a flag set but never read: info', hasMsg(r.info, 'story flag "lonely-flag" is set (story/main.json › script "intro") but nothing reads it') && !hasMsg(r.info, 'story flag "counter" is set'), r.info);
  ok('nothing unreadable', r.unreadable.length === 0 && r.story !== null);
  // unreadable files: per-file errors, the rest still checked
  const r2 = checkCampaign(campaign, (id) => { if (id === 'c') throw new Error('Unexpected token'); return read(id); }, {
    levelChecks: false, readStory: (n) => (n === 'main.json' ? '{ nope' : storyFiles[n] ?? null),
  });
  eq('unreadable files are listed', r2.unreadable, ['levels/c.json', 'story/main.json']);
  ok('… a per-file error for a level', hasMsg(r2.levels.get('c').report.errors, 'cannot be read: Unexpected token'), r2.levels.get('c').report.errors);
  ok('… and for a story file', hasMsg(r2.errors, 'story/main.json cannot be read: not valid JSON'), r2.errors);
  ok('… the other files are still checked', hasMsg(r2.errors, 'story/talk.story:6:'), r2.errors);
  const r3 = checkCampaign(campaign, read, { levelChecks: false });
  ok('story files listed but no readStory: an error', hasMsg(r3.errors, 'story/main.json: not checked'), r3.errors);
  // couldHold
  const S = new Set(['a']);
  ok('couldHold', couldHold(flagCondition('a'), S) && !couldHold(flagCondition('b'), S) && couldHold(flagCondition('a or b'), S)
    && !couldHold(flagCondition('a and b'), S) && couldHold(flagCondition('not b'), S) && couldHold(flagCondition('n < 3'), S)
    && !couldHold(flagCondition('n >= 1'), S) && couldHold(flagCondition('item:x >= 3'), S) && couldHold(flagCondition('gold'), new Set(['gold'])));
}

// =================================================================================================
begin('A: stage references');
{
  const L = makeLevel('stages', [
    ['tree', 2, 2, { id: 'when-stage', when: 'stage:q >= lost' }],
    ['exit', 8, 8, { id: 'req-stage', to: 'x', requires: 'stage:q = gone' }],
    ['event', 6, 6, { id: 'if-stage', on: 'change', if: 'stage:q >= missing', run: ['stop'] }],
    ['npc', 4, 4, { id: 'teller', name: 'Teller', talk: ['if stage:q >= nope', '  stop', 'choice', '  > [if stage:q > nada] X', '  > Y', 'if stage:other >= one', '  stop'] }],
    ['rock', 3, 3, { id: 'ok-stage', when: 'stage:q >= found' }],
  ]);
  const ctx = { quests: new Map([['q', ['asked', 'found']]]) };
  const msgs = storyIssues(L, ctx).map((i) => `${i.severity} ${formatStoryIssue(i, L)}`);
  ok('an unknown stage in a when', hasMsg(msgs, 'error', 'tree when-stage › when', 'no stage "lost"'), msgs);
  ok('… in an exit\'s requires', hasMsg(msgs, 'error', 'exit req-stage › requires', 'no stage "gone"'), msgs);
  ok('… in an event\'s if', hasMsg(msgs, 'error', 'event if-stage › if', 'no stage "missing"'), msgs);
  ok('… in a script\'s if and an option\'s [if]', hasMsg(msgs, 'error', 'talk', 'no stage "nope"') && hasMsg(msgs, 'error', 'talk', 'no stage "nada"'), msgs);
  ok('a declared stage is fine', !hasMsg(msgs, 'ok-stage'), msgs);
  ok('stage: of a quest the story files do not declare: a warning about its order', hasMsg(msgs, 'warning', 'quest "other" is not declared', 'no declared order'), msgs);
  ok('no story files: stages are not checked', storyIssues(L).every((i) => !i.msg.includes('stage')), storyIssues(L));
}

// =================================================================================================
begin('B: done:, visited:, once keys');
{
  const L = makeLevel('keys', [
    ['event', 6, 6, { id: 'ford', on: 'use', once: true, run: ['stop'] }],
    ['event', 9, 6, { id: 'look', on: 'use', run: ['stop'] }],
    ['npc', 4, 4, { id: 'a', name: 'A', talk: ['once met', '  : hi', 'if done:ford and done:met and done:keys.ford', '  stop', 'if done:look', '  stop', 'if done:nothing', '  stop', 'cycle greet', '  * : one'] }],
    ['npc', 8, 4, { id: 'b', name: 'B', talk: ['once met', '  : hello', 'cycle greet', '  * : two', 'once met', '  : again'] }],
    ['npc', 10, 4, { id: 'c1', name: 'C', actor: 'cara', talk: ['once cara-met', '  : x'] }],
    ['npc', 12, 4, { id: 'c2', name: 'C', actor: 'cara', talk: ['once cara-met', '  : y'] }],
  ]);
  const msgs = storyIssues(L).map((i) => `${i.severity} ${formatStoryIssue(i, L)}`);
  ok('done: a once event, a once block, <level>.<id> on a single level: fine', !hasMsg(msgs, 'done:ford') && !hasMsg(msgs, 'done:met') && !hasMsg(msgs, 'done:keys.ford'), msgs);
  ok('done: an event that is not once', hasMsg(msgs, 'warning', 'done:look reads an event that is not "once"'), msgs);
  ok('done: nothing of that name', hasMsg(msgs, 'warning', 'done:nothing names no "once" event or "once" block of this level'), msgs);
  ok('a once key in two scripts', hasMsg(msgs, 'warning', 'npc b "B" › talk', 'once key "met" is also used by npc a › talk'), msgs);
  ok('… once per script', msgs.filter((m) => m.includes('once key "met"')).length === 1, msgs);
  ok('a cycle key in two scripts', hasMsg(msgs, 'warning', 'npc b "B" › talk', '"greet", the key of a cycle / seq / pick, is also used by npc a › talk'), msgs);
  ok('one actor\'s villagers are one character: no warning', !hasMsg(msgs, 'cara-met'), msgs);
  // a campaign: its events and once keys
  const ctx = {
    levels: new Set(['keys', 'other']), level: 'keys', onceKeys: new Set(['met', 'elsewhere']),
    events: new Map([['keys.ford', true], ['keys.look', false], ['other.gate', true], ['other.idle', false], ['story.prologue', true]]),
  };
  const refs = (c) => {
    const r = emptyRefs();
    addConditionRefs(parseCondition(c).cond, r);
    return refIssues(r, ctx).map((i) => i.msg);
  };
  eq('campaign: this level\'s event, another level\'s, a story event, a once block anywhere', refs('done:ford and done:other.gate and done:prologue and done:story.prologue and done:elsewhere'), []);
  ok('campaign: another level\'s event that is not once', hasMsg(refs('done:other.idle'), 'not "once"'), refs('done:other.idle'));
  ok('campaign: no such event', hasMsg(refs('done:other.nope'), 'names no "once" event or "once" block of the campaign'), refs('done:other.nope'));
  ok('campaign: visited: a level of the campaign', refs('visited:other').length === 0, refs('visited:other'));
  ok('campaign: visited: no level of the campaign', hasMsg(refs('visited:nowhere'), 'visited:nowhere names no level of the campaign'), refs('visited:nowhere'));
  const r = emptyRefs();
  addConditionRefs(cond('done:x'), r);
  ok('a campaign level without the campaign\'s events (the editor): done: is not guessed', refIssues(r, { levels: new Set(['a']) }).length === 0);
  const sr = scriptRefs(nodes(['once a', '  stop', 'pick b', '  * stop', 'if visited:mill and stage:q >= x', '  stop']));
  eq('ScriptRefs: once keys, vary keys, visited, stage reads', [[...sr.onceKeys], [...sr.varyKeys], [...sr.visited], [...sr.stageReads], [...sr.onces].sort()], [['a'], ['b'], ['mill'], ['q'], ['a', 'b']]);
}

// =================================================================================================
begin('C: a chapter that reads the chapter');
{
  const c = normalizeCampaign({ format: 'luminati-campaign', levels: ['a'], chapters: [{ id: 'one' }, { id: 'two', when: 'chapter = one and k' }, { id: 'three', when: 'chapter = three' }] }).campaign;
  const vars = { k: 0 };
  /** @type {import('../src/engine/level/StoryScript.js').RefReader} */
  const rd = { get: (r) => (r.kind === 'game' && r.name === 'chapter' ? activeChapter(c, holds)?.id ?? '' : vars[r.name] ?? 0) };
  function holds(w) { return evalCondition(cachedCondition(w), rd); }
  let got = '';
  let threw = '';
  try { got = activeChapter(c, holds)?.id; } catch (e) { threw = e.message; }
  ok('no endless recursion', !threw, threw);
  eq('the inner question gets the chapter decided so far', got, 'one');
  vars.k = 1;
  eq('… so "chapter = one and k" moves on to two (three asks itself: never)', activeChapter(c, holds)?.id, 'two');
  eq('… and the next call is the same (no state kept between calls)', activeChapter(c, holds)?.id, 'two');
  const c2 = normalizeCampaign({ format: 'luminati-campaign', levels: ['a'], chapters: [{ id: 'first', when: 'chapter = first' }, { id: 'second', when: 'x' }] }).campaign;
  /** @type {import('../src/engine/level/StoryScript.js').RefReader} */
  const r2 = { get: (r) => (r.kind === 'game' ? activeChapter(c2, (w) => evalCondition(cachedCondition(w), r2))?.id ?? '' : 0) };
  eq('re-entered before any chapter held: the first chapter', activeChapter(c2, (w) => evalCondition(cachedCondition(w), r2))?.id, 'first');
}

// =================================================================================================
begin('D: the flag rule and script conditions');
eq('readCondition: the flag rule keeps a bare reserved word a flag', readCondition('gold', 'flag').cond, { op: 'ref', ref: { kind: '', name: 'gold' } });
eq('readCondition: a script condition reads the purse', readCondition('gold', 'script').cond, { op: 'ref', ref: { kind: 'game', name: 'gold' } });
eq('readCondition: the flag rule\'s fallback', readCondition('my flag', 'flag'), { cond: { op: 'ref', ref: { kind: '', name: 'my flag' } }, error: 'unexpected "flag"' });
eq('cachedScriptCondition', [/** @type {any} */ (cachedScriptCondition('gold')).ref, cachedScriptCondition('gold') === cachedScriptCondition('gold'), cachedScriptCondition('a and').op], [{ kind: 'game', name: 'gold' }, true, 'const']);
ok('conditionError: a reserved bare name under the flag rule, with a hint', conditionError('gold', 'flag').includes('can never be set') && conditionError('gold', 'flag').includes('"gold > 0"')
  && conditionError('day', 'flag').includes('day > 1') && conditionError('chapter', 'flag').includes('chapter = <chapter id>') && conditionError('Ending', 'flag').includes('name the flag otherwise')
  && conditionError('party', 'flag').includes('"party > 0"') && conditionError('party', 'flag').includes('party:<who>'));
ok('conditionError: the same words are fine as script conditions', conditionError('gold', 'script') === '' && conditionError('day', 'script') === '');
ok('conditionError: a reserved word that is no game value is an error in a script condition too', conditionError('ending', 'script').includes('reserved') && conditionError('self', 'script').includes('reserved'));
ok('conditionError: party is a game value in a script condition (no error)', conditionError('party', 'script') === '' && conditionError('party:sela', 'script') === '');
ok('conditionError: flag names', conditionError('bridge-mended', 'flag') === '' && conditionError('1e3', 'flag').includes('not a usable flag name') && conditionError('a and', 'flag').includes('read as one flag named'));
eq('conditionFields: the rule of each field', conditionFields(obj({ type: 'event', when: 'a', unless: 'b', if: 'c' })).map(([f, , rule]) => `${f}:${rule}`), ['when:flag', 'unless:flag', 'if:script']);
{
  const L = makeLevel('rules', [
    ['tree', 2, 2, { id: 'gold-flag', when: 'gold' }],
    ['tree', 3, 2, { id: 'day-flag', unless: 'day' }],
    ['exit', 8, 8, { id: 'weather-flag', to: 'x', requires: 'weather' }],
    ['event', 6, 6, { id: 'purse', on: 'change', if: 'gold', run: ['stop'] }],
    ['event', 9, 6, { id: 'ending', on: 'change', if: 'ending', run: ['stop'] }],
    ['event', 9, 9, { id: 'members', on: 'change', if: 'party', run: ['stop'] }],
  ]);
  const msgs = storyIssues(L).map((i) => `${i.severity} ${formatStoryIssue(i, L)}`);
  ok('when: gold is an error, with the hint', hasMsg(msgs, 'error', 'tree gold-flag › when', 'can never be set', 'gold > 0'), msgs);
  ok('unless: day and requires: weather too', hasMsg(msgs, 'error', 'tree day-flag › unless') && hasMsg(msgs, 'error', 'exit weather-flag › requires', 'weather = rain'), msgs);
  ok('an event\'s if: gold reads the purse — no error', !hasMsg(msgs, 'event purse'), msgs);
  ok('an event\'s if: a reserved word is a parse error there', hasMsg(msgs, 'error', 'event ending › if', 'reserved'), msgs);
  ok('an event\'s if: party reads the party (no error)', !hasMsg(msgs, 'event members'), msgs);
  const ev = makeLevel('purse', [['event', 6, 6, { on: 'change', if: 'gold and met', run: ['stop'] }]]);
  eq('levelStoryRefs and storyFlags: an event\'s if: gold is no flag', [[...levelStoryRefs(ev).reads], [...storyFlags(ev).reads]], [['met'], ['met']]);
}

// =================================================================================================
begin('E: the right of a comparison');
eq('true / false are 1 / 0', [cond('met = true').value, cond('met != false').value, cond('n >= TRUE').value], [1, 0, 1]);
ok('… and evaluate so', evalCondition(cond('met = true'), reader({ met: 1 })) && !evalCondition(cond('met = true'), reader({})) && evalCondition(cond('met = false'), reader({})));
eq('true / false alone are constants', [cond('true'), cond('not false')], [{ op: 'const', value: true }, { op: 'not', a: { op: 'const', value: false } }]);
ok('true cannot be compared', condErr('true = 1').includes('cannot be compared'), condErr('true = 1'));
ok('a game value on the right is an error', condErr('gold >= day').includes('"day" is a game value'), condErr('gold >= day'));
ok('a reserved word on the right is an error', condErr('n > ending').includes('"ending" is a reserved word'), condErr('n > ending'));
ok('… party on the right is a game value', condErr('n > party').includes('"party" is a game value'), condErr('n > party'));
ok('an exponent is no number', condErr('n > 1e3').includes('exponent') && condErr('n > 2.5E-1').includes('exponent'), condErr('n > 1e3'));
ok('… and no name either', condErr('1e3').includes('exponent') && !isStoryName('1e3') && !isStoryName('2E5') && isStoryName('e3') && isStoryName('1e') && !isFlagName('1e3'));
eq('plain decimals', [cond('n > 1000').value, cond('n > .5').value, cond('n > -2.25').value, plainNumber('3.'), Number.isNaN(plainNumber('1e3')), Number.isNaN(plainNumber('0x10'))], [1000, 0.5, -2.25, 3, true, true]);
ok('a variable on the right is still one; a stage compares with its name', cond('gold >= inn.price').value === 'inn.price' && cond('stage:q >= true').value === 'true');
ok('quest states and the text values: words as before', cond('quest:q = none').value === 'none' && cond('weather = rain').value === 'rain' && cond('chapter != two').value === 'two');
ok('var: an exponent is no number', error(['var x = 1e3']).includes('is not a number'));
ok('parseRef', typeof parseRef('gold') === 'object' && typeof parseRef('1e3') === 'string' && typeof parseRef('nope:x') === 'string');
ok('isBareName', isBareName('a.b-c') && !isBareName('3') && !isBareName('a b') && !isBareName('item:x'));

// =================================================================================================
begin('F: names as the game finds them');
{
  const L = makeLevel('names', [
    ['npc', 4, 4, { id: 'npc_7', name: 'Pip', talk: ['HOLLIS: Hi.', 'pip: lower case', 'emote Pip heart', 'face pip well-side', 'walk "Elder Wren" well-side', 'teleport WREN-V well-side', 'walk hollis 3 4', 'camera hollis', 'Stranger: Hm.'] }],
    ['npc', 8, 4, { id: 'wren-v', name: 'Elder Wren', actor: 'wren' }],
    ['marker', 6, 6, { id: 'marker_1', name: 'well-side' }],
  ]);
  const ctx = { actors: new Map([['wren', 'Old Wren'], ['hollis', 'Hollis']]) };
  const msgs = storyIssues(L, ctx).map((i) => `${i.severity} ${formatStoryIssue(i, L)}`);
  ok('a speaker: an actor\'s id in another case', !hasMsg(msgs, 'speaker "HOLLIS"'), msgs);
  ok('a villager by its name in any case', !hasMsg(msgs, 'speaker "pip"') && !hasMsg(msgs, '"Pip" is no'), msgs);
  ok('face <who> <marker>', !hasMsg(msgs, 'well-side'), msgs);
  ok('a quoted name with spaces', !hasMsg(msgs, 'Elder Wren'), msgs);
  ok('an id in another case', !hasMsg(msgs, 'WREN-V'), msgs);
  ok('an actor of the story files with no villager here: walk stops the script', hasMsg(msgs, 'warning', '"hollis" is an actor of the story files, but no villager of this level is', 'walk'), msgs);
  ok('… and so does camera', hasMsg(msgs, 'warning', '"hollis" is an actor of the story files', 'camera'), msgs);
  ok('an unknown speaker still warns', hasMsg(msgs, 'speaker "Stranger"'), msgs);
  const travelling = makeLevel('names2', [['npc', 4, 4, { id: 'guide', talk: ['travel elsewhere', 'walk hollis 3 4'] }]]);
  ok('a script that travels may direct an actor of the story files', !storyIssues(travelling, ctx).some((i) => i.msg.includes('hollis')), storyIssues(travelling, ctx));
  eq('stagedActors', [...stagedActors(nodes(['walk a 1 2', 'emote b !', 'if visits:c > 0', '  wait d', 'camera e', 'face f g', 'home player']))].sort(), ['a', 'b', 'd', 'f']);
  eq('quoted names in commands', [args('walk "Elder Wren" "Old Mill"'), args('emote "Elder Wren" !').who, args('face "Elder Wren" "Old Mill"'), args('wait "2"'), args('camera "reset"'), args('teleport "A B" "up"')],
    [{ who: 'Elder Wren', run: false, wait: true, to: 'Old Mill' }, 'Elder Wren', { who: 'Elder Wren', to: 'Old Mill' }, { who: '2' }, { who: 'reset', seconds: 1 }, { who: 'A B', facing: '', to: 'up' }]);
  ok('a quoted name has 1–60 characters', error([`walk "${'x'.repeat(61)}" 1 2`]).includes('1–60') && error(['walk "  " 1 2']).includes('1–60'));
  ok('face <who> <place>: a place, not an actor', [...scriptRefs(nodes(['face hollis well'])).targets].join() === 'well' && !scriptRefs(nodes(['face hollis well'])).actors.has('well'));
  eq('levelNames: villagers in lower case', [...levelNames(L).villagers].sort(), ['elder wren', 'npc_7', 'pip', 'player', 'wren', 'wren-v']);
}

// =================================================================================================
begin('G: parser edge cases');
ok('[if ] without a condition', errors(['choice', '  > [if ] X', '  > Y']) === '2: option condition: the condition is missing — [if <condition>]', errors(['choice', '  > [if ] X', '  > Y']));
{
  const n = node(['choice', '  > [ONCE] A', '  > [Once If a] B', '  > [ once ] C', '  > [iffy] D', '  > [once Lie] E']);
  eq('option modifiers in any case; anything else stays in the label', n.options.map((o) => [o.label, o.once, o.src]), [['A', true, ''], ['B', true, 'a'], ['C', true, ''], ['[iffy] D', false, ''], ['[once Lie] E', false, '']]);
}
ok('call / builtin take one name', error(['call a b']).includes('call takes one script name') && error(['builtin a b']).includes('builtin takes one conversation name'));
ok('time: minutes 00–59', error(['time 12:75']).includes('minutes 00–59') && args('time 12:59').hour === 12 + 59 / 60 && args('time 24:00').hour === 24);
{
  const src = ['cycle c', '  * : a', '  * bogus', '  * : c', '  *'];
  const v = node(src);
  eq('a broken alternative keeps its place (empty)', [v.alts.length, v.alts[1], v.alts[2][0].text, v.alts[3]], [4, [], 'c', []]);
  ok('… with its error', errors(src) === '3: "bogus" is not a command | 5: an empty alternative', errors(src));
  ok('a vary whose alternatives are all broken is an error', errors(['seq s', '  * bogus']).includes('1: a seq needs at least one'), errors(['seq s', '  * bogus']));
}
{
  const p = parseScript(['if a', '\tHollis: hi', '    Wren: yo', 'stop']);
  eq('tabs and spaces: the line of dialogue is kept, the line under it reported', [/** @type {any} */ (p.nodes[0]).branches[0].body.map((x) => x.speaker), p.nodes.length, p.errors.map((e) => e.line)], [['Hollis'], 2, [3]]);
  ok('… with a hint about tabs', p.errors[0]?.msg.includes('takes no indented block') && p.errors[0]?.msg.includes('tabs and with spaces'), p.errors);
  ok('no hint without tabs', !error(['Hollis: a', '  stop']).includes('tabs'));
  eq('a command keeps its line too', [nodes(['set a', '  stop'])[0].op, errorLine(['set a', '  stop']), error(['set a', '  stop', '  stop'])], ['set', 2, 'unexpected indentation: "set" takes no indented block — these 2 lines are left out']);
  eq('an inline alternative command takes the lines under its star', node(['seq s', '  * set a', '    : more']).alts[0].map((x) => x.t), ['cmd', 'say']);
}
ok('Name:text — the colon needs a space (said so)', error(['Hollis:Hi there']).includes('colon needs a space'), error(['Hollis:Hi there']));

// =================================================================================================
begin('H: ${…} text');
{
  /** @type {import('../src/engine/level/StoryScript.js').RefReader} */
  const r = {
    get: (ref) => (ref.kind === 'game' ? 12 : ref.kind === 'stage' ? 2 : ref.kind === 'quest' ? 'active' : 0),
    text: (ref) => (ref.kind === 'stage' ? 'found' : undefined),
  };
  eq('$${x}: a dollar sign, then the value', interpolate('Price: $${gold}', r), 'Price: $12');
  eq('$$${x}: the same', interpolate('$$${gold}', r), '$12');
  eq('$$ elsewhere: one dollar sign', interpolate('$$5 and $$$$', r), '$5 and $$');
  eq('a lone $ stays', interpolate('5$ and $x', r), '5$ and $x');
  eq('spaces inside the braces', interpolate('${ gold } ${  item:x}', r), '12 0');
  eq('${stage:q} through the reader\'s text: the stage reached', interpolate('${stage:q}', r), 'found');
  eq('… text undefined: the value', interpolate('${quest:q}', r), 'active');
  eq('… no text: the value', interpolate('${stage:q}', { get: r.get }), '2');
  eq('a reference with inner spaces stays as written', interpolate('${a b}', r), '${a b}');
}

// =================================================================================================
begin('I: story files');
{
  const { story, warnings } = buildStory([
    { name: 'talk.story', text: '== event.flood\n: from the story file\n== actor.wren\nWren: from the story file' },
    {
      name: 'main.json',
      text: JSON.stringify({
        format: 'luminati-story',
        actors: { wren: { name: 'Wren', talk: ['Wren: inline'] } },
        events: [{ id: 'flood', on: 'change', if: 'a', run: [': inline'] }, { id: 'walk-in', on: 'change', if: 'b', level: 'mill', run: 'x' }, { id: 'arrive', on: 'arrive', level: 'Bad Level', run: 'x' }],
      }),
    },
  ]);
  eq('an inline run does not overwrite the story file\'s event.<id>', story.scripts['event.flood'].lines, [': from the story file']);
  ok('… and is warned', hasMsg(warnings, 'main.json: event "flood": its inline run is the script "event.flood", which is declared twice (also in talk.story)'), warnings);
  eq('an actor\'s inline talk does not overwrite actor.<id>', [story.scripts['actor.wren'].lines, story.actors.wren.talk], [['Wren: from the story file'], 'actor.wren']);
  ok('… and is warned', hasMsg(warnings, 'actor "wren": its inline talk is the script "actor.wren", which is declared twice'), warnings);
  eq('level on a change event: ignored', story.events.find((e) => e.id === 'walk-in')?.level, '');
  ok('… with a warning', hasMsg(warnings, 'event "walk-in": "level" applies to "arrive" events only'), warnings);
  ok('a level that is no level id: warned', hasMsg(warnings, 'event "arrive": level "Bad Level" is not a level id'), warnings);
}
{
  const files = Array.from({ length: 8 }, (_, f) => ({ name: `e${f}.json`, text: JSON.stringify({ format: 'luminati-story', events: Array.from({ length: 4096 }, (_, k) => ({ id: `f${f}-e${k}`, run: 'x', if: 'a' })) }) }));
  const t = performance.now();
  const { story, warnings } = buildStory([...files, { name: 'dup.json', text: JSON.stringify({ format: 'luminati-story', events: [{ id: 'f0-e1', run: 'x', if: 'a' }] }) }]);
  const dt = performance.now() - t;
  ok(`32 768 events in 8 files: linear (${Math.round(dt)} ms)`, story.events.length === 32768 && dt < 1500, dt);
  ok('… a duplicate across files is still found', hasMsg(warnings, 'dup.json: event "f0-e1" is declared twice'), warnings.slice(0, 3));
}
{
  const w = [];
  const list = storyFileList(Array.from({ length: 70 }, (_, k) => `s${k}.story`), w);
  ok(`at most ${MAX_STORY_FILES} story files`, list.length === MAX_STORY_FILES && hasMsg(w, `more than ${MAX_STORY_FILES} story files`, '"s64.story"'), w);
}

// =================================================================================================
begin('J: hostile data');
{
  const hostile = { toString: 1 };
  const w = [];
  let threw = '';
  try { storyFileList([hostile, [hostile]], w); } catch (e) { threw = e.message; }
  ok('storyFileList: an object with an own toString', !threw && hasMsg(w, 'story: "{"toString":1}" is not a story file name'), threw || w);
  let n = null;
  try { n = normalizeCampaign({ format: 'luminati-campaign', levels: ['a', { id: hostile }, [hostile]], chapters: [{ id: 'two', levels: { a: hostile } }] }); } catch (e) { threw = e.message; }
  ok('normalizeCampaign: hostile level ids and variants', !threw && hasMsg(n?.warnings ?? [], 'levels[1]: "{"toString":1}"') && hasMsg(n?.warnings ?? [], 'variant "{"toString":1}" of "a"'), threw || n?.warnings);
  const lv = {
    a: makeLevel('a', [['exit', 8, 8, { id: 'odd', to: 'b', entrance: hostile }], ['exit', 4, 8, { id: 'odder', to: hostile }]]),
    b: makeLevel('b'),
  };
  const { campaign } = normalizeCampaign({ format: 'luminati-campaign', levels: ['a', 'b'] });
  try { checkCampaign(campaign, (id) => (Object.hasOwn(lv, id) ? { level: lv[id], warnings: [] } : null), { levelChecks: false }); } catch (e) { threw = e.message; }
  ok('checkCampaign: exits whose to / entrance have an own toString', !threw, threw);
}
{
  // patterns that backtracked over a line: 4 000 crafted lines took 11.5 s and 22.9 s
  const pad = ' '.repeat(1990);
  const time = (lines) => {
    const t = performance.now();
    const p = parseScript(lines);
    return { ms: performance.now() - t, p };
  };
  const a = time(Array.from({ length: 4000 }, () => `x${pad}y`));
  ok(`4 000 lines with inner runs of spaces parse in linear time (${Math.round(a.ms)} ms)`, a.ms < 1500 && a.p.errors.length === 4000, a.ms);
  const b = time(['choice', ...Array.from({ length: 3999 }, () => `  > [if${pad}`)]);
  ok(`4 000 option lines with an open "[if" (${Math.round(b.ms)} ms)`, b.ms < 1500, b.ms);
  const c = time(Array.from({ length: 4000 }, () => `if${pad.slice(0, 1980)}\rX\rY`));
  ok(`4 000 command lines with inner carriage returns (${Math.round(c.ms)} ms)`, c.ms < 1500 && c.p.errors.length === 4000, c.ms);
  let threw = '';
  let count = 0;
  try { count = scriptLines(['\n'.repeat(200000)]).length; } catch (e) { threw = e.message; }
  ok('a script entry with 200 000 line breaks does not overflow the stack', !threw && count === 200001, threw || count);
}
{
  const raw = JSON.parse('{"format":"luminati-campaign","levels":["a"],"__proto__":{"polluted":1},"constructor":5,"mods":{"keep":true}}');
  const { campaign: c } = normalizeCampaign(raw);
  ok('campaign.json extra: __proto__ / constructor are not copied, other fields are', Object.getPrototypeOf(c.extra) === Object.prototype && c.extra.polluted === undefined && isDeepStrictEqual({ ...c.extra }, { mods: { keep: true } }), c.extra);
  ok('… and round-trip', serializeCampaign(parseCampaign(serializeCampaign(c)).campaign).includes('"mods": {'));
  const s = CampaignState.fromJSON(c, 't', JSON.parse('{"version":2,"__proto__":{"polluted":1},"prototype":2,"future":{"x":1}}'));
  ok('the save\'s extra: the same', Object.getPrototypeOf(s.extra) === Object.prototype && s.extra.polluted === undefined && isDeepStrictEqual(s.extra, { future: { x: 1 } }) && /** @type {any} */ (s.toJSON()).future?.x === 1, s.extra);
}

// =================================================================================================
begin('K: the condition module');
{
  const names = ['parseCondition', 'flagCondition', 'cachedCondition', 'cachedScriptCondition', 'evalCondition', 'conditionRefs', 'isStoryName', 'isFlagName', 'scriptLines', 'hasScript', 'parseRef', 'plainNumber', 'isBareName', 'isTextRef'];
  ok('StoryScript.js re-exports the condition module (the same functions)', names.every((k) => typeof StoryCondition[k] === 'function' && StoryScript[k] === StoryCondition[k])
    && StoryScript.RESERVED_WORDS === StoryCondition.RESERVED_WORDS && StoryScript.GAME_REFS === StoryCondition.GAME_REFS && StoryScript.REF_KINDS === StoryCondition.REF_KINDS && StoryScript.QUEST_STATES === StoryCondition.QUEST_STATES);
  const importsOf = (file) => [...readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').matchAll(/^import [^;]*? from '([^']+)'/gm)].map((m) => m[1]);
  for (const f of ['src/engine/level/Travel.js', 'src/engine/level/ObjectCatalog.js', 'src/game/campaign/StoryFormat.js', 'src/game/campaign/CampaignFormat.js']) {
    const list = importsOf(f);
    ok(`${f} does not import the script parser`, list.length > 0 && !list.some((p) => p.endsWith('/StoryScript.js')), list);
  }
  ok('StoryCondition.js imports nothing', importsOf('src/engine/level/StoryCondition.js').length === 0);
}

// =================================================================================================
begin('campaign check: conditions, keys, names');
{
  const levels = {
    a: makeLevel('a', [
      ['event', 6, 6, { id: 'gate', on: 'use', once: true, run: ['once shared', '  : a'] }],
      ['npc', 4, 4, { id: 'pip', name: 'Pip', talk: ['if done:b.idle or done:b.nope', '  stop'] }],
      ['exit', 15.5, 6, { id: 'east', to: 'b', minX: 15, maxX: 16, minZ: 4, maxZ: 8 }],
    ]),
    b: makeLevel('b', [
      ['event', 6, 6, { id: 'idle', on: 'use', run: ['stop'] }],
      ['exit', 0.5, 6, { id: 'west', to: 'a', minX: 0, maxX: 1, minZ: 4, maxZ: 8 }],
    ]),
  };
  const storyText = JSON.stringify({
    format: 'luminati-story',
    actors: { hollis: { name: 'Hollis' } },
    quests: { q: { stages: [{ id: 'one' }], goals: [{ text: 'G', done: 'stage:q >= zero' }, { text: 'Purse', done: 'gold >= 10' }, { text: 'Bad', done: 'ending' }, { text: 'Company', done: 'party >= 1' }] } },
    scripts: { s: ['once shared', '  : s', 'walk hollis 1 1', 'HOLLIS: hi', 'pip: hi', 'if done:gate and done:a.gate and visited:b and done:missing and visited:zz', '  stop'] },
    events: [{ id: 'ev', on: 'change', if: 'gold', run: 's' }, { id: 'ev2', on: 'change', if: 'stage:q = none-such', run: 's' }],
  });
  const { campaign } = normalizeCampaign({
    format: 'luminati-campaign', levels: [{ id: 'a', at: [0, 0] }, { id: 'b', at: [16, 0] }], story: ['main.json'],
    chapters: [{ id: 'one' }, { id: 'two', when: 'chapter = one and k' }, { id: 'three', when: 'gold' }, { id: 'four', when: 'stage:q >= nada' }],
  });
  const r = checkCampaign(campaign, (id) => (Object.hasOwn(levels, id) ? { level: levels[id], warnings: [] } : null), { levelChecks: false, readStory: (n) => (n === 'main.json' ? storyText : null) });
  const all = [...r.errors, ...r.warnings];
  const lvA = [...r.levels.get('a').report.errors, ...r.levels.get('a').report.warnings];
  ok('a chapter that reads the chapter: an error', hasMsg(r.errors, 'chapter "two": when "chapter = one and k" reads "chapter"'), r.errors);
  ok('a chapter\'s when: gold (the flag rule): an error, with the hint', hasMsg(r.errors, 'chapter "three": when "gold"', 'gold > 0'), r.errors);
  ok('an unknown stage in a chapter\'s when', hasMsg(r.errors, 'chapter "four": when "stage:q >= nada"', 'no stage "nada"'), r.errors);
  ok('… in a goal\'s done', hasMsg(r.errors, 'goal "G": done "stage:q >= zero"', 'no stage "zero"'), r.errors);
  ok('… in a story event\'s if', hasMsg(r.errors, 'event "ev2": if "stage:q = none-such"', 'no stage "none-such"'), r.errors);
  ok('a story event\'s if: gold and a goal\'s done: gold >= 10 read the purse', !hasMsg(r.errors, 'event "ev": if') && !hasMsg(r.errors, 'goal "Purse"') && !hasMsg(all, 'story flag "gold" (read by story'), all);
  ok('a goal\'s done: a reserved word is an error', hasMsg(r.errors, 'goal "Bad": done "ending"', 'reserved'), r.errors);
  ok('a goal\'s done: party >= 1 is fine', !hasMsg(all, 'goal "Company"'), all);
  ok('a level: done: of another level\'s event that is not once / that does not exist', hasMsg(lvA, 'done:b.idle reads an event that is not "once"') && hasMsg(lvA, 'done:b.nope names no "once" event'), lvA);
  ok('story scripts: done: a level\'s event by its id or <level>.<id>; visited: a level', !hasMsg(all, 'done:gate') && !hasMsg(all, 'done:a.gate') && !hasMsg(all, 'visited:b names'), all);
  ok('story scripts: done: and visited: of nothing', hasMsg(r.warnings, 'script "s"', 'done:missing names no "once" event') && hasMsg(r.warnings, 'visited:zz names no level'), r.warnings);
  ok('a once key in a level and in a story script', hasMsg(r.warnings, 'once key "shared" is used by levels/a.json › event gate › run and story/main.json › script "s"'), r.warnings);
  ok('story scripts: speakers in any case', !hasMsg(all, 'speaker "HOLLIS"') && !hasMsg(all, 'speaker "pip"'), all);
  ok('story scripts: an actor no villager is cannot be directed', hasMsg(r.warnings, '"hollis" is an actor of the story files, but no villager of the campaign\'s levels is'), r.warnings);
}

// =================================================================================================
begin('L: bark');
{
  eq('bark: the node', node(['bark hollis Mind the ford!']), { t: 'cmd', line: 1, op: 'bark', args: { who: 'hollis', text: 'Mind the ford!' } });
  eq('bark: the rest of the line as written, ${…} and {gold} kept for the runtime', args('bark hollis   Bring me ${count} {oak planks},  please.  '), { who: 'hollis', text: 'Bring me ${count} {oak planks},  please.' });
  eq('bark: a quoted name', args('bark "Elder Wren" Hush now: "listen".'), { who: 'Elder Wren', text: 'Hush now: "listen".' });
  eq('bark: a quoted name with a \\" inside', args('bark "A \\"B\\"" Hi'), { who: 'A "B"', text: 'Hi' });
  eq('bark: the player', args('bark player Phew.'), { who: 'player', text: 'Phew.' });
  eq('bark: \\n is a line break', args('bark hollis One\\ntwo').text, 'One\ntwo');
  ok('bark: a command word goes first (no dialogue)', error(['bark Hollis: hi']).includes('"Hollis:" is not a actor'), error(['bark Hollis: hi']));
  ok('bark: needs a text', error(['bark hollis']) === 'bark <who> <text>' && error(['bark']) === 'bark <who> <text>' && error(['bark "Elder Wren"']) === 'bark <who> <text>', errors(['bark hollis']));
  ok('bark: an unclosed quote swallows the line: no text', error(['bark "Elder Wren hi']) === 'bark <who> <text>', error(['bark "Elder Wren hi']));
  ok('bark: a bad name', error(['bark h!x hi']).includes('is not a actor') && error(['bark "  " hi']).includes('1–60'), errors(['bark h!x hi', 'bark "  " hi']));
  eq('bark: inline in an alternative', node(['cycle c', '  * bark hollis Morning!', '  * bark wren Evening!']).alts.map((a) => a[0].args.text), ['Morning!', 'Evening!']);
  ok('bark: in the command reference', SCRIPT_COMMANDS.bark?.args === '<who> <text>' && SCRIPT_COMMANDS.bark.help.includes('background'));
  ok('bark: takes no block', error(['bark hollis hi', '  stop']).includes('"bark" takes no indented block'));
  const r = scriptRefs(nodes(['bark hollis Hi', 'bark player Ho', 'bark "Elder Wren" Hm']));
  eq('bark: scriptRefs — actors, as emote (player left out)', [...r.actors].sort(), ['Elder Wren', 'hollis']);
  eq('bark: stagedActors', [...stagedActors(nodes(['bark hollis Hi', 'bark player Ho']))], ['hollis']);
  const L = makeLevel('barks', [
    ['npc', 4, 4, { id: 'hollis', name: 'Hollis', talk: ['bark hollis Hi', 'bark HOLLIS Hi', 'bark player Hm', 'bark ghost Boo', 'bark wren Hm'] }],
  ]);
  const msgs = storyIssues(L, { actors: new Map([['wren', 'Wren']]) }).map((i) => `${i.severity} ${formatStoryIssue(i, L)}`);
  ok('bark: an unknown villager — the warning of emote', hasMsg(msgs, 'warning', '"ghost" is no villager, actor or "player" of this level') && !hasMsg(msgs, '"hollis" is') && !hasMsg(msgs, '"HOLLIS" is') && !hasMsg(msgs, '"player" is'), msgs);
  ok('bark: an actor of the story files no villager here is — bark does nothing', hasMsg(msgs, 'warning', '"wren" is an actor of the story files', 'emote, bark and wait do nothing'), msgs);
}

// =================================================================================================
begin('M: background runs');
{
  eq('BACKGROUND_OPS', [...BACKGROUND_OPS].sort(), ['banner', 'bark', 'break', 'call', 'clear', 'emote', 'face', 'give', 'heal', 'home', 'music', 'party', 'quest', 'set', 'sfx', 'shake', 'stop', 'take', 'teleport', 'toast', 'var', 'wait', 'walk', 'weather']);
  ok('BACKGROUND_OPS: commands of the language, none a block', [...BACKGROUND_OPS].every((op) => Object.hasOwn(SCRIPT_COMMANDS, op)) && !['if', 'elif', 'else', 'choice', 'loop', 'once', 'cycle', 'seq', 'pick'].some((op) => BACKGROUND_OPS.has(op)));
  const one = (line) => backgroundIssue(node([line]));
  eq('backgroundIssue: dialogue, the narrator, "- text"', [one('Hollis: Hi.'), one(': The river roars.'), one('- Hm.')], ['dialogue needs the player', 'dialogue needs the player', 'dialogue needs the player']);
  eq('backgroundIssue: a choice', backgroundIssue(node(['choice Well?', '  > Yes'])), 'a choice needs the player\'s answer');
  eq('backgroundIssue: commands that hold or move the player, or take the screen', ['cutscene', 'camera hollis', 'fade out', 'travel b', 'rest', 'shop', 'builtin elder', 'ending home', 'time 6'].map(one), [
    'a cutscene holds the player', 'the camera stays with the player', 'a fade takes the screen from the player', 'travel takes the player to another level',
    'resting holds the player', 'the shop needs the player', 'a conversation needs the player', 'the ending holds the player',
    'a clock jump re-lights the scene and runs the time events at once',
  ]);
  eq('backgroundIssue: the player is not walked, turned or teleported', ['walk player 3 4', 'face player up', 'teleport player well'].map(one), [
    '"walk player": the player is the player\'s in the background', '"face player": the player is the player\'s in the background', '"teleport player": the player is the player\'s in the background',
  ]);
  const allowed = ['bark hollis Hi', 'bark player Phew', 'emote player !', 'walk hollis 3 4 nowait', 'face hollis player', 'teleport hollis well', 'home hollis', 'wait 2', 'wait hollis',
    'set a', 'clear a', 'var n + 1', 'give plank', 'take plank', 'quest q stage s', 'heal', 'sfx chime', 'toast Hi', 'banner A | B', 'music festival', 'weather rain', 'shake', 'call x', 'stop', 'break'];
  eq('backgroundIssue: the allowed ones', allowed.map(one).filter(Boolean), []);
  eq('backgroundIssue: blocks are allowed (their lines are asked one by one)', [node(['if a', '  Hollis: hi']), node(['loop', '  break']), node(['once k', '  : hi']), node(['pick p', '  * : hi'])].map(backgroundIssue), ['', '', '', '']);
  ok('backgroundIssue: every command is allowed or has a reason', Object.keys(SCRIPT_COMMANDS).filter((op) => !['if', 'elif', 'else', 'choice', 'loop', 'once', 'cycle', 'seq', 'pick'].includes(op))
    .every((op) => BACKGROUND_OPS.has(op) === !backgroundIssue(/** @type {any} */ ({ t: 'cmd', line: 1, op, args: {} }))));
  ok('backgroundIssue: an unknown command or node kind is never allowed', backgroundIssue(/** @type {any} */ ({ t: 'cmd', line: 1, op: 'constructor', args: {} })) === '"constructor" needs the player'
    && backgroundIssue(/** @type {any} */ ({ t: 'alt', line: 1 })) !== '' && backgroundIssue(/** @type {any} */ (null)) !== '');
  const src = [
    'bark hollis Morning!',                  // 1
    'if a',                                  // 2
    '  Hollis: In a branch.',                // 3
    'else',                                  // 4
    '  camera hollis',                       // 5
    'loop',                                  // 6
    '  walk player 1 1',                     // 7
    '  break',                               // 8
    'once k',                                // 9
    '  choice Well?',                        // 10
    '    > Yes',                             // 11
    '      : Inside an option.',             // 12
    'cycle c',                               // 13
    '  * : An alternative.',                 // 14
    '  * toast fine',                        // 15
    'walk hollis 2 2',                       // 16
  ];
  eq('backgroundIssues: every line inside every block, by line', backgroundIssues(nodes(src)).map((i) => i.line), [3, 5, 7, 10, 12, 14]);
  eq('backgroundIssues: { line, msg }', backgroundIssues(nodes(['Hollis: hi'])), [{ line: 1, msg: 'dialogue needs the player' }]);
  eq('backgroundIssues: a clean script', backgroundIssues(nodes(['bark hollis Hi', 'set seen', 'call more'])), []);
  const seen = [];
  walkNodes(nodes(src), (n) => seen.push(n.line));
  eq('walkNodes: every node in order, blocks included', seen, [1, 2, 3, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16]);
  eq('backgroundErrors: the check message (dialogue: use bark)', backgroundErrors(nodes(['Hollis: hi', 'camera hollis'])), [
    { line: 1, msg: 'cannot run in the background: dialogue needs the player — drop "background" or use "bark"' },
    { line: 2, msg: 'cannot run in the background: the camera stays with the player — drop "background"' },
  ]);
  // the catalog field: absent by default
  const ev = OBJECT_TYPES.event;
  ok('catalog: no default for background (absent from every file that does not use it)', !Object.hasOwn(ev.defaults, 'background'), ev.defaults);
  const f = ev.fields.find((x) => x.key === 'background');
  ok('catalog: the inspector field', f?.type === 'bool' && f.label === 'Runs in the background' && typeof f.help === 'string' && f.help.length > 20, f);
  const plainEv = makeLevel('bg-absent', [['event', 6, 6, { id: 'e', on: 'enter', run: ['bark player Hm'] }]]);
  ok('a new event has no background key; the file round-trips without one', !('background' in plainEv.objects[0]) && !serializeLevel(plainEv).includes('background')
    && serializeLevel(parseLevel(serializeLevel(plainEv)).level) === serializeLevel(plainEv));
  const bgEv = makeLevel('bg-set', [['event', 6, 6, { id: 'e', on: 'enter', background: true, run: ['bark player Hm'] }]]);
  ok('background: true round-trips', /** @type {any} */ (parseLevel(serializeLevel(bgEv)).level.objects[0]).background === true && serializeLevel(parseLevel(serializeLevel(bgEv)).level) === serializeLevel(bgEv));
  // the level checks
  const L = makeLevel('bg', [
    ['npc', 4, 4, { id: 'hollis', name: 'Hollis' }],
    ['event', 6, 6, { id: 'chatter', on: 'enter', background: true, run: ['bark hollis Morning!', 'Hollis: Morning!', 'walk hollis 2 2', 'if a', '  camera hollis', 'walk player 3 3', 'call elsewhere'] }],
    ['event', 9, 6, { id: 'fore', on: 'enter', run: ['Hollis: Morning!', 'camera hollis'] }],
    ['event', 9, 9, { id: 'off', on: 'enter', background: false, run: ['Hollis: Morning!'] }],
    ['event', 2, 9, { id: 'odd', on: 'enter', background: 'yes', run: ['Hollis: Morning!'] }],
    ['event', 2, 2, { id: 'clean', on: 'arrive', background: true, run: ['bark hollis Hi', 'set greeted', 'wait 2', 'emote hollis !', 'pick p', '  * toast a', '  * sfx chime'] }],
  ]);
  const issues = storyIssues(L);
  const bg = issues.filter((i) => i.msg.startsWith('cannot run in the background'));
  eq('storyIssues: an error per offending line of a background event', bg.map((i) => [i.severity, i.id, i.field, i.line]), [['error', 'chatter', 'run', 2], ['error', 'chatter', 'run', 5], ['error', 'chatter', 'run', 6]]);
  eq('… the message', formatStoryIssue(bg[0], L), 'event chatter › run:2: cannot run in the background: dialogue needs the player — drop "background" or use "bark"');
  ok('… nothing for foreground events, background: false, or a clean background event', !issues.some((i) => ['fore', 'off', 'clean'].includes(i.id) && i.msg.includes('background')), issues);
  ok('background: a non-boolean is a warning and is read as false', issues.some((i) => i.id === 'odd' && i.severity === 'warning' && i.field === 'background' && i.msg.includes('true or false'))
    && !issues.some((i) => i.id === 'odd' && i.msg.startsWith('cannot run')), issues);
  // story files
  const { story, warnings } = buildStory([{ name: 'main.json', text: JSON.stringify({
    format: 'luminati-story',
    events: [{ id: 'a', on: 'change', if: 'x', run: 's', background: true }, { id: 'b', on: 'change', if: 'x', run: 's', background: false }, { id: 'c', on: 'arrive', run: 's' },
      { id: 'd', on: 'change', if: 'x', run: 's', background: 'yes' }, { id: 'e', on: 'change', if: 'x', run: 's', background: 1 }],
  }) }]);
  eq('story files: background is a boolean (true only when written true)', story.events.map((e) => e.background), [true, false, false, false, false]);
  ok('… a non-boolean is warned', hasMsg(warnings, 'event "d": "background" must be true or false') && hasMsg(warnings, 'event "e": "background"') && warnings.length === 2, warnings);
}
{
  // the campaign check: story-file events, and `call` followed into the story files
  const levels = {
    a: makeLevel('a', [
      ['npc', 4, 4, { id: 'hollis', name: 'Hollis' }],
      ['event', 6, 6, { id: 'lv-bg', on: 'enter', background: true, run: ['bark hollis Hi', 'call from-level'] }],
      ['event', 9, 6, { id: 'lv-own', on: 'enter', background: true, run: ['Hollis: own line'] }],
      ['event', 9, 9, { id: 'lv-fore', on: 'enter', run: ['call fore-only'] }],
    ]),
  };
  const storyText = JSON.stringify({
    format: 'luminati-story',
    vars: { x: 0 },
    scripts: {
      'from-level': ['bark hollis Hm', 'choice Well?', '  > Yes'],
      'fore-only': ['Hollis: Fine here.', 'camera hollis'],
      ping: ['toast ping', 'call pong'],
      pong: ['call ping', 'fade out'],
    },
    events: [
      { id: 'bg-inline', if: 'x', background: true, run: ['bark hollis Inline', 'Hollis: Inline line'] },
      { id: 'bg-named', if: 'x', background: true, run: 'chain' },
      { id: 'bg-loop', if: 'x', background: true, run: 'ping' },
      { id: 'fore', if: 'x', run: 'deep' },
    ],
  });
  const talk = ['== chain', 'bark hollis One', 'call deep', '', '== deep', 'set y', 'travel a'].join('\n');
  const { campaign } = normalizeCampaign({ format: 'luminati-campaign', levels: ['a'], story: ['main.json', 'talk.story'] });
  const r = checkCampaign(campaign, (id) => (Object.hasOwn(levels, id) ? { level: levels[id], warnings: [] } : null), {
    levelChecks: false, readStory: (n) => (n === 'main.json' ? storyText : n === 'talk.story' ? talk : null),
  });
  const bgErr = r.errors.filter((m) => m.includes('cannot run in the background'));
  ok('a background story event\'s inline run', hasMsg(bgErr, 'story/main.json › script "event.bg-inline" line 2: cannot run in the background: dialogue needs the player — drop "background" or use "bark" (run in the background by story event "bg-inline")'), bgErr);
  ok('… its named run, and a script it calls (with the file line)', hasMsg(bgErr, 'story/talk.story:7: cannot run in the background: travel takes the player to another level', 'story event "bg-named" (through "call")'), bgErr);
  ok('a level event\'s call into the story files', hasMsg(bgErr, 'script "from-level" line 2: cannot run in the background: a choice needs the player\'s answer', 'levels/a.json › event lv-bg (through "call")'), bgErr);
  ok('a call cycle ends', hasMsg(bgErr, 'script "pong" line 2', 'fade', 'story event "bg-loop" (through "call")'), bgErr);
  ok('scripts only foreground events run: nothing', !hasMsg(bgErr, 'fore-only'), bgErr);
  ok('one error per line (two events reach "deep": one of them background)', bgErr.filter((m) => m.includes('talk.story:7')).length === 1, bgErr);
  const lvA = r.levels.get('a').report.errors;
  ok('a level event\'s own script: in its level\'s report', hasMsg(lvA, 'story: event lv-own › run:1: cannot run in the background: dialogue needs the player'), lvA);
  eq('the clean lines are not reported', bgErr.length, 4);
}

// =================================================================================================
begin('N: \\$ — a literal ${…}');
{
  /** @type {import('../src/engine/level/StoryScript.js').RefReader} */
  const r = { get: (ref) => (ref.kind === 'game' && ref.name === 'gold' ? 12 : ref.kind === '' ? 3 : 0), text: (ref) => (ref.kind === 'stage' ? 'found' : undefined) };
  const I = (s) => interpolate(s, r);
  // (in these JS strings `\\` is one backslash of the story text)
  eq('\\${x} shows ${x}', I('Write \\${gold} to show your gold.'), 'Write ${gold} to show your gold.');
  eq('\\$ is a dollar sign', I('\\$5 and \\$'), '$5 and $');
  eq('\\$${x}: a dollar sign, then the value', I('\\$${gold}'), '$12');
  eq('\\$$5: a dollar sign, then $5', I('\\$$5'), '$$5');
  eq('\\\\${x}: a backslash, then the value', I('\\\\${gold}'), '\\12');
  eq('\\\\\\${x}: a backslash, then ${x}', I('\\\\\\${gold}'), '\\${gold}');
  eq('backslashes elsewhere stay', I('a\\b \\\\c ${gold}'), 'a\\b \\\\c 12');
  eq('$$ is still one dollar sign, $${x} still a dollar and the value', [I('$$5'), I('$${gold}'), I('$$$$')], ['$5', '$12', '$$']);
  eq('no $: the same text (backslashes too)', I('a\\b'), 'a\\b');
  eq('${…} still works around an escaped one', I('${gold} \\${gold} ${deliveries}'), '12 ${gold} 3');
  eq('\\${stage:q}', I('\\${stage:q} = ${stage:q}'), '${stage:q} = found');
  // through the parser: `\n` is still a line break, the backslashes before a `$` reach interpolate
  const shown = (line) => {
    const n = node([line]);
    return I(n.t === 'say' ? n.text : n.args.text ?? n.args.title);
  };
  eq('dialogue', shown('Hollis: It costs \\${price}, friend.'), 'It costs ${price}, friend.');
  eq('the narrator and - text', [shown(': \\${x}'), shown('- \\${x}')], ['${x}', '${x}']);
  eq('toast', shown('toast Type \\${gold} \\$\\$'), 'Type ${gold} $$');
  eq('bark', shown('bark hollis \\${gold}? I have ${gold}.'), '${gold}? I have 12.');
  eq('quest start title', shown('quest q start The \\${x} Riddle'), 'The ${x} Riddle');
  eq('quest stage text', I(args('quest q stage s Found \\${x}').text), 'Found ${x}');
  eq('ending title', I(args('ending e The \\${end}').title), 'The ${end}');
  const banner = args('banner \\${a} | \\${b} ${gold}');
  eq('banner title and subtitle', [I(banner.title), I(banner.subtitle)], ['${a}', '${b} 12']);
  const ch = node(['choice Pay \\${gold}?', '  > Pay \\${gold}', '  > [if a] Keep ${gold}']);
  eq('a choice and its option labels', [I(ch.text), ...ch.options.map((o) => I(o.label))], ['Pay ${gold}?', 'Pay ${gold}', 'Keep 12']);
  eq('\\n is still a line break, \\\\ still a backslash', [node(['Hollis: a\\nb']).text, node(['Hollis: a\\\\nb']).text, node(['Hollis: a\\\\b']).text, node(['Hollis: a\\tb']).text], ['a\nb', 'a\\nb', 'a\\b', 'a\\tb']);
  eq('\\\\${x} in a script: a backslash, then the value (as before)', shown('Hollis: \\\\${gold}'), '\\12');
  eq('\\\\\\${x} in a script: a backslash, then ${x}', shown('Hollis: \\\\\\${gold}'), '\\${gold}');
  eq('\\n$ and \\\\n${x}', [shown('Hollis: a\\n${gold}'), shown('Hollis: a\\\\n${gold}')], ['a\n12', 'a\\n12']);
  eq('the parse node keeps the backslashes before a $ for interpolate', node(['Hollis: \\${x} \\\\${y} \\\\z']).text, '\\${x} \\\\${y} \\z');
  // story-file texts (goals, stage texts) are interpolated as written: the same escape
  eq('a story-file text', I('Planks (\\${item:plank} of 3)'), 'Planks (${item:plank} of 3)');
  // without a backslash, interpolate is the function it was (a seeded fuzz against a copy of it)
  const oldInterpolate = (text, read) => {
    if (!text.includes('$')) return text;
    return text.replace(/\$\{([^{}]{1,90})\}|\$\$(?!\{)/g, (all, tt) => {
      if (tt === undefined) return '$';
      const ref = parseRef(tt.trim());
      if (typeof ref === 'string') return all;
      const shownText = (ref.kind === 'stage' || ref.kind === 'quest') && read.text ? read.text(ref) : undefined;
      if (shownText !== undefined) return String(shownText);
      const v = read.get(ref);
      return typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v);
    });
  };
  let seed = 7;
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 2 ** 32; };
  const pieces = ['$', '$', '{', '}', 'gold', 'stage:q', ' ', 'a', 'item:x', ':', 'b c', 'hour', 'x'.repeat(95)];
  let fuzzSame = 0;
  const fuzzDiff = [];
  for (let k = 0; k < 3000; k++) {
    let s = '';
    const len = 1 + Math.floor(rnd() * 12);
    for (let j = 0; j < len; j++) s += pieces[Math.floor(rnd() * pieces.length)];
    if (I(s) === oldInterpolate(s, r)) fuzzSame++; else if (fuzzDiff.length < 3) fuzzDiff.push([s, I(s), oldInterpolate(s, r)]);
  }
  ok('without a backslash: the same text as before \\$ (3 000 seeded texts)', fuzzSame === 3000, fuzzDiff);
  // linear in hostile input
  const slashes = '\\'.repeat(1990);
  let t = performance.now();
  const p = parseScript(Array.from({ length: 4000 }, (_, k) => `: ${slashes}${k % 2 ? '$' : 'n'}`));
  const parseMs = performance.now() - t;
  ok(`4 000 lines of 1 990 backslashes parse in linear time (${Math.round(parseMs)} ms)`, parseMs < 1500 && p.errors.length === 0, parseMs);
  t = performance.now();
  for (let k = 0; k < 4000; k++) interpolate(`${slashes}$`, r);
  const interpMs = performance.now() - t;
  ok(`… and interpolate in linear time (${Math.round(interpMs)} ms)`, interpMs < 1500, interpMs);
  // the campaign check: a `\${x}` shown as text reads no variable
  const { campaign } = normalizeCampaign({ format: 'luminati-campaign', levels: ['a'], story: ['main.json'] });
  const lv = { a: makeLevel('a', [['npc', 4, 4, { id: 'pip', name: 'Pip', talk: ['Pip: \\${secret} and ${counted}', 'bark pip ${barked}'] }]]) };
  const rc = checkCampaign(campaign, (id) => (Object.hasOwn(lv, id) ? { level: lv[id], warnings: [] } : null), { levelChecks: false, readStory: () => JSON.stringify({ format: 'luminati-story' }) });
  ok('campaign check: ${x} is read, \\${x} is not', hasMsg(rc.warnings, 'story flag "counted"', 'never set') && hasMsg(rc.warnings, 'story flag "barked"', 'never set') && !hasMsg(rc.warnings, '"secret"'), rc.warnings);
}

// =================================================================================================
begin('O: pick and the journey\'s seed');
{
  /** varyIndex as it was before seeds (2026-10-07): the reference for seed 0. */
  const oldVaryIndex = (mode, n, count, key, day) => {
    if (n <= 1) return 0;
    if (mode === 'cycle') return count % n;
    if (mode === 'seq') return Math.min(count, n - 1);
    let h = 2166136261;
    const s = `${key}|${day}|${count}`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % n;
  };
  let same = 0;
  let total = 0;
  const diff = [];
  for (const mode of /** @type {const} */ (['cycle', 'seq', 'pick'])) {
    for (const key of ['greet', 'k', 'a.b-c_d', 'hollis-gossip', '', 'Ünïcode', 'x'.repeat(80)]) {
      for (let n = 0; n <= 9; n++) {
        for (const day of [0, 1, 2, 3, 7, 30, 365, 1000]) {
          for (let count = 0; count < 40; count++) {
            const want = oldVaryIndex(mode, n, count, key, day);
            total += 2;
            if (varyIndex(mode, n, count, key, day) === want) same++; else if (diff.length < 3) diff.push([mode, n, count, key, day]);
            if (varyIndex(mode, n, count, key, day, 0) === want) same++; else if (diff.length < 3) diff.push([mode, n, count, key, day, 0]);
          }
        }
      }
    }
  }
  ok(`seed 0 (or none) picks exactly as before (${total} cases)`, same === total, diff);
  const seq = (seed) => Array.from({ length: 24 }, (_, c) => varyIndex('pick', 4, c, 'greet', 2, seed));
  ok('a seed is deterministic', isDeepStrictEqual(seq(12345), seq(12345)));
  const seqs = [0, 1, 2, 12345, 0x9e3779b9, 0xffffffff].map((s) => seq(s).join(''));
  ok('different seeds pick differently', new Set(seqs).size === seqs.length, seqs);
  ok('a seed is a u32 (2^32 is 0, -1 is 0xffffffff)', isDeepStrictEqual(seq(2 ** 32), seq(0)) && isDeepStrictEqual(seq(-1), seq(0xffffffff)));
  let threw = '';
  let odd = [];
  try { odd = [/** @type {any} */ ('7'), { toString: 1 }, null, NaN, Infinity].map((s) => seq(s).join('')); } catch (e) { threw = e.message; }
  ok('a seed that is no number counts as 0 (never throws)', !threw && odd.every((s) => s === seq(0).join('')), threw || odd);
  // spread: one block, one turn, many journeys
  const counts = [0, 0, 0, 0];
  for (let s = 1; s <= 4000; s++) counts[varyIndex('pick', 4, 0, 'greet', 1, s * 2654435761 >>> 0)]++;
  ok('over 4 000 journeys each alternative is picked about as often', counts.every((c) => c > 850 && c < 1150), counts);
  const counts3 = [0, 0, 0];
  for (let s = 1; s <= 3000; s++) counts3[varyIndex('pick', 3, 5, 'k', 4, s)]++;
  ok('… also with consecutive seeds and three alternatives', counts3.every((c) => c > 850 && c < 1150), counts3);
  ok('cycle and seq ignore the seed', varyIndex('cycle', 3, 4, 'k', 1, 99) === 1 && varyIndex('seq', 3, 7, 'k', 1, 99) === 2 && varyIndex('pick', 1, 4, 'k', 1, 99) === 0);
}

begin('review fixes: the player in any case, home, the seed');
{
  ok('isPlayerName: any case', isPlayerName('player') && isPlayerName('Player') && isPlayerName('PLAYER') && !isPlayerName('players') && !isPlayerName(undefined));
  const bg = (line) => backgroundIssue(parseScript([line]).nodes[0]);
  ok('a background run may not move "Player" either', bg('walk Player 3 3') !== '' && bg('face PLAYER left') !== '' && bg('walk pip 3 3') === '');
  const L = createEmptyLevel({ width: 16, depth: 16 });
  addObject(L, 'npc', 4, 4, { id: 'pip', name: 'Pip', talk: ['home Player 3 3', 'home pip 2 2'] });
  const issues = storyIssues(L);
  ok('"home player" is an error (the player has no home)', issues.some((i) => i.severity === 'error' && /home.*player/i.test(i.msg) && i.line === 1) && !issues.some((i) => i.line === 2 && i.severity === 'error'), issues);
  // every bit of a seed moves some pick (two alternatives)
  const flips = [];
  for (let bit = 0; bit < 32; bit++) {
    let moved = 0;
    for (let c = 0; c < 64 && !moved; c++) if (varyIndex('pick', 2, c, 'k', 1, 0x1234567) !== varyIndex('pick', 2, c, 'k', 1, (0x1234567 ^ (1 << bit)) >>> 0)) moved = 1;
    flips.push(moved);
  }
  ok('every bit of the seed can change a pick', flips.every(Boolean), flips.map((f, i) => (f ? '' : i)).filter((x) => x !== ''));
}

// =================================================================================================
begin('P: the party (docs/specs/PARTY.md §7)');
{
  // the command and its forms
  ok('party: in the command reference', SCRIPT_COMMANDS.party?.args.startsWith('join <who> [as <class>] [<preset>]') && SCRIPT_COMMANDS.party.help.includes('party set sela heal often'), SCRIPT_COMMANDS.party);
  eq('PARTY_VERBS', [...PARTY_VERBS], ['join', 'leave', 'rule', 'set', 'menu']);
  eq('join', args('party join sela'), { verb: 'join', who: 'sela', cls: '', preset: '' });
  eq('join as a class', args('party join sela as warden'), { verb: 'join', who: 'sela', cls: 'warden', preset: '' });
  eq('join as a class with a preset', args('party join sela as warden guardian'), { verb: 'join', who: 'sela', cls: 'warden', preset: 'guardian' });
  eq('… the preset first', args('party join sela support as mystic'), { verb: 'join', who: 'sela', cls: 'mystic', preset: 'support' });
  eq('join a quoted name', args('party join "Sela of the Watch" hunter'), { verb: 'join', who: 'Sela of the Watch', cls: '', preset: 'hunter' });
  eq('leave', args('party leave sela'), { verb: 'leave', who: 'sela' });
  eq('rule', args('party rule sela guardian'), { verb: 'rule', who: 'sela', preset: 'guardian' });
  eq('set', args('party set sela heal often'), { verb: 'set', who: 'sela', field: 'heal', value: 'often' });
  eq('menu', [args('party menu'), args('party menu sela'), args('party menu "Elder Wren"')], [{ verb: 'menu', who: '' }, { verb: 'menu', who: 'sela' }, { verb: 'menu', who: 'Elder Wren' }]);
  ok('every preset, class, field and value parses', PRESET_NAMES.every((p) => args(`party rule a ${p}`)?.preset === p) && CLASS_NAMES.every((c) => args(`party join a as ${c}`)?.cls === c)
    && Object.entries(RULE_FIELDS).every(([f, d]) => d.values.every((v) => args(`party set a ${f} ${v}`)?.value === v)));
  // errors: missing, extra and unknown words, with the closest name
  const e = (line) => error([line]);
  ok('party alone: the forms', e('party').includes('party join | leave | rule | set | menu') && e('party').includes('party set <who> <field> <value>'), e('party'));
  ok('an unknown verb: did you mean', e('party jion sela') === '"jion" is not a party command (join, leave, rule, set, menu) — did you mean "join"?', e('party jion sela'));
  ok('a verb in quotes is no verb', e('party "join" sela').includes('party join | leave'), e('party "join" sela'));
  ok('the villager is missing', e('party join') === 'party join <who> [as <class>] [<preset>]: the villager is missing' && e('party rule').includes('the villager is missing') && e('party leave').includes('the villager is missing'), e('party join'));
  ok('the player leads the party', e('party join player').includes('the player leads the party') && e('party rule Player guardian').includes('the player leads the party') && e('party menu PLAYER').includes('the player leads the party'), e('party join player'));
  ok('a bad name', e('party join h!x').includes('is not a villager') && e('party join "  "').includes('1–60'), e('party join h!x'));
  ok('join: "as" without a class', e('party join sela as') === 'party join <who> [as <class>] [<preset>]: the class is missing after "as" (warden, ranger, mystic)', e('party join sela as'));
  ok('join: an unknown class', e('party join sela as wizard') === '"wizard" is not a class (warden, ranger, mystic)' && e('party join sela as wardne').endsWith('did you mean "warden"?'), [e('party join sela as wizard'), e('party join sela as wardne')]);
  ok('join: a class without "as"', e('party join sela warden') === '"warden" is a class — write "as warden" (party join <who> [as <class>] [<preset>])', e('party join sela warden'));
  ok('join: an unknown preset, with the closest', e('party join sela gaurdian') === '"gaurdian" is not a preset (balanced, aggressive, guardian, support, hunter, passive) — did you mean "guardian"?', e('party join sela gaurdian'));
  ok('join: a preset in another case is not one (said so)', e('party join sela Guardian').endsWith('did you mean "guardian"?'), e('party join sela Guardian'));
  ok('join: twice', e('party join sela balanced guardian').includes('the preset is given twice') && e('party join sela as warden as ranger').includes('the class is given twice'));
  ok('leave: nothing after the villager', e('party leave sela now') === 'party leave <who> — nothing after the villager', e('party leave sela now'));
  ok('rule: the preset is missing (listed)', e('party rule sela') === 'party rule <who> <preset>: the preset is missing (balanced, aggressive, guardian, support, hunter, passive)', e('party rule sela'));
  ok('rule: an unknown preset', e('party rule sela agressive').endsWith('did you mean "aggressive"?') && e('party rule sela xyz') === '"xyz" is not a preset (balanced, aggressive, guardian, support, hunter, passive)', [e('party rule sela agressive'), e('party rule sela xyz')]);
  ok('rule: a field is no preset (the fix said)', e('party rule sela heal') === '"heal" is a field of the rule — write "party set sela heal <value>" (party rule <who> <preset>)', e('party rule sela heal'));
  ok('rule: … a quoted name kept quoted in the fix', e('party rule "Old Sela" heal').includes('write "party set "Old Sela" heal <value>"'), e('party rule "Old Sela" heal'));
  ok('rule: one preset', e('party rule sela guardian support') === 'party rule <who> <preset> — one preset, nothing after it', e('party rule sela guardian support'));
  ok('set: the field is missing (listed)', e('party set sela') === 'party set <who> <field> <value>: the field is missing (target, distance, attack, skills, heal, evade, retreat)', e('party set sela'));
  ok('set: an unknown field, with the closest', e('party set sela hael often') === '"hael" is not a field of the rule (target, distance, attack, skills, heal, evade, retreat) — did you mean "heal"?', e('party set sela hael often'));
  ok('set: a preset is no field (the fix said)', e('party set sela guardian') === '"guardian" is a preset — write "party rule sela guardian" (party set <who> <field> <value>)', e('party set sela guardian'));
  ok('set: the value is missing (the field\'s values listed)', e('party set sela heal') === 'party set <who> <field> <value>: the value is missing (heal: never, low, half, often)', e('party set sela heal'));
  ok('set: a value of another field', e('party set sela heal far') === '"far" is not a value of heal (never, low, half, often)' && e('party set sela distance clsoe').endsWith('did you mean "close"?'), [e('party set sela heal far'), e('party set sela distance clsoe')]);
  ok('set: one value', e('party set sela heal often low') === 'party set <who> <field> <value> — one value, nothing after it', e('party set sela heal often low'));
  ok('menu: at most one member', e('party menu sela wren') === 'party menu [<who>] — at most one member, nothing after it', e('party menu sela wren'));
  ok('party takes no block', error(['party rule sela guardian', '  stop']).includes('"party" takes no indented block'));
  eq('party inline in an alternative', node(['cycle c', '  * party rule sela guardian', '  * party rule sela support']).alts.map((x) => x[0].args.preset), ['guardian', 'support']);
  ok('a speaker called Party is still dialogue', node(['Party: Hello.'])?.t === 'say' && node(['"party": Hi.'])?.speaker === 'party');
  ok('closestName', closestName('hael', RULE_KEYS) === 'heal' && closestName('x', RULE_KEYS) === '' && closestName('GUARDIAN', PRESET_NAMES) === 'guardian');
  // (review fixes: the hints guess less and say more)
  ok('closestName: a swap of two neighbours is one edit; a short word takes one edit at most', closestName('jion', PARTY_VERBS) === 'join' && closestName('lw', ['never', 'low', 'half']) === 'low'
    && closestName('near', ['close', 'mid', 'far']) === '' && closestName('no', ['on', 'off']) === 'on', [closestName('near', ['close', 'mid', 'far'])]);
  ok('a quoted class / preset / value: write it without quotes (not "did you mean" itself)', e('party join sela as "warden"') === '"warden" is quoted — a class is written without quotes: warden (party join <who> [as <class>] [<preset>])'
    && e('party rule sela "Guardian"').startsWith('"Guardian" is quoted — a preset is written without quotes: guardian') && e('party set sela heal "often"').startsWith('"often" is quoted — a value of heal is written without quotes: often'),
  [e('party join sela as "warden"'), e('party rule sela "Guardian"'), e('party set sela heal "often"')]);
  ok('join: a preset after "as" is said to be one', e('party join sela as balanced') === '"balanced" is a preset, not a class (warden, ranger, mystic) — a preset is written without "as": party join sela balanced'
    && e('party join "Old Sela" as Support').endsWith('party join "Old Sela" support'), [e('party join sela as balanced'), e('party join "Old Sela" as Support')]);
  ok('rule: a class is said to be one', e('party rule sela warden') === '"warden" is a class, not a preset (balanced, aggressive, guardian, support, hunter, passive) — a member\'s class is chosen when it joins: party join sela as warden', e('party rule sela warden'));
  ok('set: a word that means a value suggests it (near → close, no → off …), never an opposite', e('party set sela distance near').endsWith('did you mean "close"?') && e('party set sela evade no').endsWith('did you mean "off"?')
    && e('party set sela distance medium').endsWith('did you mean "mid"?') && e('party set sela heal always').endsWith('did you mean "often"?') && e('party set sela heal of') === '"of" is not a value of heal (never, low, half, often)',
  [e('party set sela distance near'), e('party set sela evade no'), e('party set sela heal of')]);
  ok('set: the synonyms are a field\'s own ("constructor" is none)', e('party set sela distance constructor') === '"constructor" is not a value of distance (close, mid, far)', e('party set sela distance constructor'));
  // references
  const r = scriptRefs(nodes(['party join sela as warden', 'party rule wren guardian', 'party set "Old Sela" heal often', 'party leave pip', 'party menu', 'party menu odo', 'if party:mara and party >= 2', '  stop']));
  eq('scriptRefs: joins and members', [[...r.joins], [...r.members].sort()], [['sela'], ['Old Sela', 'mara', 'odo', 'pip', 'wren']]);
  ok('… not actors, flags or reads', !r.actors.size && !r.reads.size && !r.writes.size, r);
  eq('stagedActors: party commands direct nobody', [...stagedActors(nodes(['party join sela', 'party rule sela guardian']))], []);
  // background
  const bg = (line) => backgroundIssue(node([line]));
  eq('background: join, leave, rule, set may run there', ['party join sela', 'party leave sela', 'party rule sela guardian', 'party set sela heal often'].map(bg), ['', '', '', '']);
  eq('background: menu may not', [bg('party menu'), bg('party menu sela')], ['the tactics panel needs the player', 'the tactics panel needs the player']);
  eq('backgroundErrors: the check message', backgroundErrors(nodes(['party rule sela guardian', 'party menu sela'])), [{ line: 2, msg: 'cannot run in the background: the tactics panel needs the player — drop "background"' }]);
}
{
  // conditions
  eq('parseRef: party and party:<who>', [parseRef('party'), parseRef('PARTY'), parseRef('party:Sela')], [{ kind: 'game', name: 'party' }, { kind: 'game', name: 'party' }, { kind: 'party', name: 'Sela' }]);
  ok('party is no flag name', !isFlagName('party') && !isFlagName('Party') && error(['set party']).includes('reserved') && error(['var party = 2']).includes('reserved'));
  ok('party:<who> needs a name', condErr('party:') !== '' && condErr('party:3').includes('"3" is not a name'), [condErr('party:'), condErr('party:3')]);
  eq('the flag rule: party alone is a flag (an error with a hint)', flagCondition('party'), { op: 'ref', ref: { kind: '', name: 'party' } });
  eq('… party:<who> in a when parses', flagCondition('party:sela'), { op: 'ref', ref: { kind: 'party', name: 'sela' } });
  const rd = { get: (ref) => (ref.kind === 'game' && ref.name === 'party' ? 2 : ref.kind === 'party' ? (ref.name === 'sela' ? 1 : 0) : 0) };
  ok('evaluated', evalCondition(cond('party >= 2 and party:sela and not party:wren'), rd) && !evalCondition(cond('party > 2 or party:wren'), rd));
  eq('${party} shows the count, ${party:x} 1 / 0', interpolate('${party} with you; sela: ${party:sela}', rd), '2 with you; sela: 1');
  const refs = emptyRefs();
  addConditionRefs(cond('party:sela and party >= 2 and met'), refs);
  eq('addConditionRefs: party:<who> is a member, party no flag', [[...refs.members], [...refs.reads]], [['sela'], ['met']]);
  eq('valueRange: party:<who> 0 / 1, party 0 to MAX_PARTY', [valueRange({ kind: 'party', name: 'x' }), valueRange({ kind: 'game', name: 'party' })], [{ int: true, min: 0, max: 1 }, { int: true, min: 0, max: MAX_PARTY }]);
  // (what every level loads — Travel.js, StoryStates.js, StoryCondition.js — never pulls the party's vocabulary in)
  const importsOf = (file) => [...readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').matchAll(/^import [^;]*? from '([^']+)'/gm)].map((m) => m[1]);
  for (const f of ['src/engine/level/Travel.js', 'src/engine/level/StoryStates.js', 'src/engine/level/StoryCondition.js']) {
    ok(`${f} does not import PartyRules.js`, !importsOf(f).some((x) => x.endsWith('/PartyRules.js')), importsOf(f));
  }
  ok('storyExclusive: party:<who> and its opposite, the count', storyExclusive(obj({ when: 'party:sela' }), obj({ unless: 'party:sela' })) && storyExclusive(obj({ when: 'party >= 2' }), obj({ when: 'party < 2' }))
    && !storyExclusive(obj({ when: 'party:sela' }), obj({ when: 'party:wren' })));
  // (review fixes: a member and the count are read together; names in any case)
  ok('storyExclusive: a member and an empty party never hold together', storyExclusive(obj({ when: 'party:sela' }), obj({ unless: 'party > 0' })) && storyExclusive(obj({ when: 'party:sela' }), obj({ when: 'party = 0' }))
    && !storyExclusive(obj({ when: 'party:sela' }), obj({ when: 'party = 1' })));
  ok('storyExclusive: no more members than the count, at most MAX_PARTY', storyExclusive(obj({ when: 'party:sela and party:bram' }), obj({ when: 'party = 1' }))
    && storyExclusive(obj({ when: 'party:sela and party:bram and party:ivy and party:pip' }), obj({ when: 'party < 4' })) && !storyExclusive(obj({ when: 'party:sela and party:bram and party:ivy' }), obj({ when: 'party >= 3' })));
  ok('storyExclusive: party:<who> in any case is one test', storyExclusive(obj({ when: 'party:sela' }), obj({ unless: 'party:Sela' })) && storyExclusive(obj({ when: 'party:SELA' }), obj({ when: 'not party:sela' })));
}
{
  // the level checks
  const L = makeLevel('party-checks', [
    ['npc', 4, 4, { id: 'sela', name: 'Sela', actor: 'sela-actor', talk: [
      'party join sela as warden balanced', // 1
      'party join ghost',                   // 2
      'party rule Sela guardian',           // 3
      'party leave nobody',                 // 4
      'if party:sela-actor',                // 5
      '  stop',                             // 6
      'if party:nobody2 or party >= 1',     // 7
      '  stop',                             // 8
      'party join sela as wizard',          // 9
      'party menu',                         // 10
      'if party:player',                    // 11
      '  stop',                             // 12
    ] }],
    ['npc', 8, 4, { id: 'pip', name: 'Pip' }],
    ['event', 6, 6, { id: 'tactics', on: 'enter', background: true, run: ['party set sela heal often', 'party menu sela'] }],
    ['rock', 2, 2, { id: 'with-ghost', when: 'party:ghost-x' }],
    ['rock', 3, 2, { id: 'with-sela', when: 'party:sela and party >= 1' }],
    ['rock', 4, 2, { id: 'bare-party', when: 'party' }],
  ]);
  const msgs = storyIssues(L).map((i) => `${i.severity} ${formatStoryIssue(i, L)}`);
  ok('join: a villager of this level is fine', !hasMsg(msgs, '"sela" is no') && !hasMsg(msgs, '"Sela" (party)') && !hasMsg(msgs, '"sela" (party)'), msgs);
  ok('join: no villager of this level — a warning', hasMsg(msgs, 'warning', 'npc sela "Sela" › talk', '"ghost" is no villager of this level — "party join" is refused'), msgs);
  ok('a member who is no villager or actor — a warning', hasMsg(msgs, 'warning', '"nobody" (party) is no villager of this level') && hasMsg(msgs, 'warning', '"nobody2" (party) is no villager of this level'), msgs);
  ok('party:<actor> of a villager here is fine', !hasMsg(msgs, 'sela-actor'), msgs);
  ok('party:player: never a member', hasMsg(msgs, 'warning', '"party:player"'), msgs);
  ok('an unknown class: an error with its line', hasMsg(msgs, 'error', 'talk:9: "wizard" is not a class'), msgs);
  ok('a background event: party set is fine, party menu is an error', hasMsg(msgs, 'error', 'event tactics › run:2: cannot run in the background: the tactics panel needs the player') && !hasMsg(msgs, 'event tactics › run:1'), msgs);
  ok('a condition field: party:<who> naming nobody — a warning under the field', hasMsg(msgs, 'warning', 'rock with-ghost › when', '"ghost-x" (party)'), msgs);
  ok('… naming a villager here: fine', !hasMsg(msgs, 'with-sela'), msgs);
  ok('when: party alone — the flag rule\'s error, with the hint', hasMsg(msgs, 'error', 'rock bare-party › when', '"party > 0"'), msgs);
  // story actors and campaigns
  const actors = new Map([['wren', 'Old Wren']]);
  const L2 = makeLevel('party-actors', [['npc', 4, 4, { id: 'pip', name: 'Pip', talk: ['party join wren', 'party rule wren guardian', 'if party:old-wren or party:Wren', '  stop', 'party rule far-away support', 'party join pip'] }]]);
  const one = (ctx) => storyIssues(L2, ctx).map((i) => `${i.severity} ${formatStoryIssue(i, L2)}`);
  const m2 = one({ actors });
  ok('join: an actor of the story files no villager here is — refused here (a warning)', hasMsg(m2, 'warning', '"wren" is an actor of the story files, but no villager of this level is — "party join" is refused here'), m2);
  ok('members: an actor of the story files (id or name) is fine', !hasMsg(m2, '"wren" (party)') && !hasMsg(m2, '"Wren" (party)'), m2);
  ok('a single level: a member who is no villager here — a warning', hasMsg(m2, 'warning', '"far-away" (party) is no villager of this level'), m2);
  ok('a campaign level, its other levels not known: not doubted', !hasMsg(one({ actors, levels: new Set(['party-actors']) }), 'far-away'), one({ actors, levels: new Set(['party-actors']) }));
  ok('a campaign level: a villager of another level is fine', !hasMsg(one({ actors, levels: new Set(['party-actors']), villagers: new Set(['far-away']) }), 'far-away'));
  ok('… and one of no level is a warning', hasMsg(one({ actors, levels: new Set(['party-actors']), villagers: new Set(['pip']) }), 'warning', '"far-away" (party) is no villager of the campaign\'s levels and no actor'));
  const travels = makeLevel('party-travel', [['npc', 4, 4, { id: 'pip', name: 'Pip', talk: ['travel elsewhere', 'party join wren'] }]]);
  ok('a script that travels may take an actor of the story files along', !storyIssues(travels, { actors }).some((i) => i.msg.includes('"wren"')), storyIssues(travels, { actors }));
  // (review fixes) staging a member of another level of the campaign in a script that tests for it
  const staging = ['sela: The road narrows here.', 'bark sela Careful.', 'emote sela !', 'face sela player', 'walk sela 6 6', 'camera sela'];
  const road = makeLevel('road', [
    ['npc', 4, 4, { id: 'pip', name: 'Pip' }],
    ['event', 2, 2, { id: 'guarded', on: 'enter', run: ['if party:sela', ...staging.map((l) => `  ${l}`)] }],
    ['event', 8, 2, { id: 'by-if', on: 'enter', if: 'party:Sela', run: staging }],
    ['event', 10, 2, { id: 'by-when', on: 'enter', when: 'party:sela', run: staging }],
    ['event', 12, 2, { id: 'unguarded', on: 'enter', run: staging }],
    ['event', 14, 2, { id: 'other-member', on: 'enter', run: ['if party:bram', ...staging.map((l) => `  ${l}`)] }],
  ]);
  const roadMsgs = (ctx) => storyIssues(road, ctx).map((i) => `${i.severity} ${formatStoryIssue(i, road)}`);
  const camp = { levels: new Set(['millbrook', 'road']), level: 'road', villagers: new Set(['player', 'sela', 'pip', 'bram']) };
  const rm = roadMsgs(camp);
  ok('a campaign villager staged in a script that tests party:<it> (its lines, its event\'s if, its when): no warning', !hasMsg(rm, 'event guarded') && !hasMsg(rm, 'event by-if') && !hasMsg(rm, 'event by-when'), rm);
  ok('… a script that does not test for it still warns (no villager, no object, no speaker)', hasMsg(rm, 'warning', 'event unguarded', '"sela" is no villager, actor or "player" of this level')
    && hasMsg(rm, 'warning', 'event unguarded', '"sela" names no object') && hasMsg(rm, 'warning', 'event unguarded', 'speaker "sela" is no villager'), rm);
  ok('… and so does one that tests another member', hasMsg(rm, 'warning', 'event other-member', '"sela" is no villager'), rm);
  const lone = roadMsgs({ levels: camp.levels, level: 'road', villagers: new Set(['player', 'pip']) });
  ok('… a name no level of the campaign has warns, tested or not', hasMsg(lone, 'warning', 'event guarded', '"sela" is no villager'), lone);
  ok('… a campaign level whose other levels are not known: not doubted', !hasMsg(roadMsgs({ levels: camp.levels, level: 'road' }), 'event guarded'));
  ok('… a single level: warned (a member joined here)', hasMsg(roadMsgs({}), 'warning', 'event guarded', '"sela" is no villager'));
  eq('partyTests: the names a script, its event\'s if and the object\'s when test (lower case)', [...partyTests(/** @type {any} */ ({ type: 'event', id: 'e', if: 'party:Ivy', when: 'party:odo' }), nodes(['if party:Sela or party >= 2', '  stop', 'choice', '  > [if party:bram] Bram?', '    stop']))].sort(), ['bram', 'ivy', 'odo', 'sela']);
}
{
  // the campaign check
  const levels = {
    a: makeLevel('a', [
      ['npc', 4, 4, { id: 'sela', name: 'Sela', talk: ['party join sela as warden', 'party join pip'] }],
      ['exit', 15.5, 6, { id: 'east', to: 'b', minX: 15, maxX: 16, minZ: 4, maxZ: 8 }],
    ]),
    b: makeLevel('b', [
      ['npc', 4, 4, { id: 'pip', name: 'Pip', talk: ['if party:sela', '  party rule sela guardian', 'if party:ghost', '  stop', 'party leave nobody'] }],
      ['exit', 0.5, 6, { id: 'west', to: 'a', minX: 0, maxX: 1, minZ: 4, maxZ: 8 }],
      ['rock', 6, 6, { id: 'with-sela', when: 'party:sela' }],
    ]),
  };
  const storyText = JSON.stringify({
    format: 'luminati-story',
    actors: { hollis: { name: 'Hollis' }, odo: { name: 'Odo' } },
    scripts: { s: ['party join hollis', 'party join zed', 'party leave sela', 'party set hollis heal often', 'if party:zed2', '  stop', 'party menu'] },
    events: [{ id: 'ev', on: 'change', if: 'party:sela and party >= 1', run: 's' }, { id: 'ev2', on: 'change', if: 'party:ghost3', run: 's' }],
  });
  const { campaign } = normalizeCampaign({ format: 'luminati-campaign', levels: [{ id: 'a', at: [0, 0] }, { id: 'b', at: [16, 0] }], story: ['main.json'] });
  const r = checkCampaign(campaign, (id) => (Object.hasOwn(levels, id) ? { level: levels[id], warnings: [] } : null), { levelChecks: false, readStory: (n) => (n === 'main.json' ? storyText : null) });
  const all = [...r.errors, ...r.warnings];
  const lv = (id) => [...r.levels.get(id).report.errors, ...r.levels.get(id).report.warnings];
  ok('a level: a member who joined in another level is fine', !hasMsg(lv('b'), '"sela"'), lv('b'));
  ok('… a member of no level: a warning (of the campaign)', hasMsg(lv('b'), '"ghost" (party) is no villager of the campaign\'s levels') && hasMsg(lv('b'), '"nobody" (party)'), lv('b'));
  ok('a level: party join of a villager of another level — refused here', hasMsg(lv('a'), '"pip" is no villager of this level — "party join" is refused'), lv('a'));
  ok('a story script: join an actor no villager is — a warning', hasMsg(r.warnings, 'script "s"', '"hollis" is an actor of the story files, but no villager of the campaign\'s levels is — "party join" is refused'), r.warnings);
  ok('… join nobody at all — a warning', hasMsg(r.warnings, 'script "s"', '"zed" is no villager of the campaign\'s levels — "party join" is refused'), r.warnings);
  ok('… members: a villager of a level or an actor is fine, nobody is a warning', !hasMsg(all, '"sela" (party)') && !hasMsg(all, '"hollis" (party)') && hasMsg(r.warnings, 'script "s"', '"zed2" (party)'), all);
  ok('a story event\'s if: party:<who> naming nobody', hasMsg(r.warnings, 'event "ev2": if "party:ghost3"', '"ghost3" (party)') && !hasMsg(all, 'event "ev": if'), all);
  ok('an actor named only by party commands is in use', !hasMsg(r.info, 'actor "hollis" is declared') && hasMsg(r.info, 'actor "odo" is declared'), r.info);
  ok('party is no flag: nothing read but never set', !hasMsg(all, 'story flag "party"') && !hasMsg(all, 'story flag "sela"'), all);
}

// =================================================================================================
begin('Q: the format ids (ADR-053)');
{
  eq('the ids', [LEVEL_FORMAT, CAMPAIGN_FORMAT, STORY_FORMAT], ['luminati-level', 'luminati-campaign', 'luminati-story']);
  const level = normalizeLevel({ format: LEVEL_FORMAT, version: 1, name: 'Vale', width: 8, depth: 8, tiles: Array(8).fill('gggggggg'), heights: Array(8).fill('22222222') }).level;
  ok('each file is written with its id', serializeLevel(level).startsWith('{\n  "format": "luminati-level",\n')
    && serializeCampaign(normalizeCampaign({ format: CAMPAIGN_FORMAT, levels: ['a'] }).campaign).startsWith('{\n  "format": "luminati-campaign",')
    && serializeStory({ items: { jar: { name: 'Clay Jar' } } }).startsWith('{\n  "format": "luminati-story",'));
}

// =================================================================================================
const ms = Math.round(performance.now() - t0);
if (verbose) for (const [name, n] of sections) console.log(`  ${name}: ${n}`);
for (const f of failures) console.log(`  ✗ ${f}`);
console.log(`story self-test: ${passed} passed, ${failures.length} failed (${sections.length} sections, ${ms} ms)`);
process.exit(failures.length ? 1 : 0);
