#!/usr/bin/env node
/**
 * test-levelcheck.mjs — the Node self-test of the level checks' story states (`npm run level:test`):
 * `checkLevel` of tools/lib/levelcheck.mjs on small in-memory levels whose objects carry `when` /
 * `unless` (a ford whose bridge comes with a flag and whose flood debris goes with it), and the
 * story-state helpers of src/engine/level/StoryStates.js — comparisons read either way (also
 * against a word), the values a story can give (whole numbers, 0 / 1), independent groups of tests
 * and samples past the bound, the reused state work against checking every state from scratch — no
 * files, no browser.
 *
 *   node tools/test-levelcheck.mjs [--verbose]
 *     --verbose   list every section with its count
 *
 * Prints a summary; exit code 1 when an assertion fails (each failure is listed with what it got).
 */
import { isDeepStrictEqual } from 'node:util';
import { createEmptyLevel, addObject, normalizeLevel } from '../src/engine/level/LevelFormat.js';
import fs from 'node:fs';
import { presenceCondition, conditionSpace, canHoldTogether, storyStates } from '../src/engine/level/StoryStates.js';
import { cachedCondition } from '../src/engine/level/StoryCondition.js';
import { storyExclusive, travelIssues } from '../src/engine/level/Travel.js';
import { gridFromLevel, placerFromLevel, checkLevel, describeStates, defaultMaxStoryStates } from './lib/levelcheck.mjs';

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
    return JSON.stringify(v, (_, x) => (x instanceof Set ? [...x] : x));
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

/**
 * A 24 × 12 meadow (level 2) split by a river two tiles wide (x 11–13, level 0), one region over it
 * all, the spawn on the west bank — plus `objects` ([type, x, z, fields]; a bridge's x / z are its
 * first end, fields x1 / z1 the other; a rect's fields its bounds).
 * @param {[string, number, number, Record<string, any>][]} objects
 * @returns {Level}
 */
function ford(objects = []) {
  const raw = createEmptyLevel({ name: 'ford', width: 24, depth: 12, border: 0 });
  raw.tiles = raw.tiles.map((r) => `${r.slice(0, 11)}~~${r.slice(13)}`);
  raw.heights = raw.heights.map((r) => `${r.slice(0, 11)}00${r.slice(13)}`);
  raw.spawn = { x: 3, z: 6, facing: 'down' };
  const all = addObject(raw, 'region', 12, 6, { minX: 0, maxX: 24, minZ: 0, maxZ: 12, name: 'Ford' });
  all.id = 'all';
  for (const [type, x, z, fields = {}] of objects) {
    const o = addObject(raw, /** @type {any} */ (type), x, z, fields);
    if (fields.id) o.id = fields.id;
  }
  return normalizeLevel(raw).level;
}
/** checkLevel with its own grid and placer (story states on unless said; no story checks). */
const check = (level, opts = {}) => {
  const g = gridFromLevel(level);
  return checkLevel(level, { g, P: placerFromLevel(g, level) }, { storyStates: true, story: false, ...opts });
};
/** The bridge over the river (deck at the banks' height). */
const bridge = (fields = {}) => /** @type {[string, number, number, Record<string, any>]} */ (['bridge', 10.4, 6, { id: 'ford', x1: 13.6, z1: 6, deckY: 1, opts: { width: 2, arch: 0.2 }, ...fields }]);
/** An exit on the east bank. */
const eastExit = /** @type {[string, number, number, Record<string, any>]} */ (['exit', 23, 6, { id: 'east', to: 'next', minX: 22.5, maxX: 24, minZ: 4, maxZ: 8 }]);
/** Flood debris: a crate on the bridge's north railing, a barrel in the middle of its deck. */
const debris = (fields) => /** @type {[string, number, number, Record<string, any>][]} */ ([
  ['crate', 11.5, 5.1, { id: 'wreck_1', ...fields }],
  ['barrel', 12.2, 6, { id: 'wreck_2', ...fields }],
]);

// =================================================================================================
begin('story-state helpers (StoryStates.js)');
{
  eq('presenceCondition: none', presenceCondition(/** @type {any} */ ({ type: 'rock' })), null);
  ok('presenceCondition: when and not unless', JSON.stringify(presenceCondition(/** @type {any} */ ({ when: 'a', unless: 'b' }))) === JSON.stringify({ op: 'and', a: cachedCondition('a'), b: { op: 'not', a: cachedCondition('b') } }));
  const sp = conditionSpace([cachedCondition('hour >= 20 or hour < 6'), cachedCondition('a and x != 0')]);
  eq('the tests, canonical (`hour < 6` is not `hour >= 6`; `x != 0` is x)', sp.tests.map((t) => t.label), ['hour >= 20', 'hour >= 6', 'a', 'x']);
  ok('a possible combination: hour >= 20 and >= 6', sp.possible([1, 1, 0, 0]));
  ok('an impossible one: hour >= 20 but not >= 6', !sp.possible([1, 0, 0, 0]));
  ok('canHoldTogether: hour >= 20 and hour < 6 cannot', canHoldTogether([cachedCondition('hour >= 20'), cachedCondition('hour < 6')]) === false);
  ok('canHoldTogether: item:plank >= 3 and < 4 can', canHoldTogether([cachedCondition('item:plank >= 3'), cachedCondition('item:plank < 4')]) === true);
  ok('canHoldTogether: quest states are one at a time', canHoldTogether([cachedCondition('quest:q = done'), cachedCondition('quest:q = active')]) === false
    && canHoldTogether([cachedCondition('quest:q = done'), cachedCondition('quest:q')]) === true
    && canHoldTogether([cachedCondition('quest:q = none'), cachedCondition('quest:q')]) === false);
  ok('canHoldTogether: a word for a number is free against other tests', canHoldTogether([cachedCondition('gold >= price'), cachedCondition('gold < cost')]) === true && canHoldTogether([cachedCondition('gold >= price'), cachedCondition('gold < 5')]) === true);
  ok('canHoldTogether: too many tests → null', canHoldTogether([cachedCondition('a and b and c')], 2) === null);
  const objs = /** @type {any[]} */ ([{ id: 'b', when: 'm' }, { id: 'w', unless: 'm' }, { id: 'h', when: 'h and not f' }, { id: 'r' }]);
  const ss = storyStates(objs);
  eq('storyStates: 3 tests in 2 groups, 4 states', [ss.tests.length, ss.groups.length, ss.states.length, ss.exhaustive], [3, 2, 4, true]);
  eq('… the groups: `m` (the bridge and its wreck), `h` and `f` (one condition)', ss.groups.map((gr) => [gr.tests, gr.patterns.length]), [[[0], 2], [[1, 2], 2]]);
  ok('storyStates: an object without a condition is in every state', ss.states.every((s) => s.present.has(objs[3])));
  ok('storyStates: the bridge and its wreck never together', ss.states.every((s) => s.present.has(objs[0]) !== s.present.has(objs[1])));
  const withB = new Set(ss.states.map((s, k) => (s.present.has(objs[0]) ? k : -1)).filter((k) => k >= 0));
  const noB = new Set(ss.states.map((_, k) => k).filter((k) => !withB.has(k)));
  eq('describeStates: with', describeStates(ss, withB, noB), 'with `m`');
  eq('describeStates: without', describeStates(ss, noB, withB), 'without `m`');
  const withH = new Set(ss.states.map((s, k) => (s.present.has(objs[2]) ? k : -1)).filter((k) => k >= 0));
  const noH = new Set(ss.states.map((_, k) => k).filter((k) => !withH.has(k)));
  eq('describeStates: a conjunction', describeStates(ss, withH, noH), 'when `h and not f`');
  eq('describeStates: a disjunction', describeStates(ss, noH, withH), 'when `not h or f`');
  const many = /** @type {any[]} */ (Array.from({ length: 8 }, (_, i) => ({ id: `o${i}`, when: `f${i}` })));
  const all = storyStates(many, { maxStates: 256 });
  eq('8 independent flags: 8 groups, every one of the 256 states', [all.groups.length, all.total, all.states.length, all.exhaustive, all.capped], [8, 256, 256, true, false]);
  const big = storyStates(many);
  eq('… past maxStates (64): a sample of 64, said so', [big.total, big.states.length, big.exhaustive, big.capped], [256, 64, false, true]);
  ok('… the sample: nothing there, everything there, each flag alone from either', big.states.some((st) => st.present.size === 0) && big.states.some((st) => st.present.size === 8)
    && many.every((o) => big.states.some((st) => st.present.size === 1 && st.present.has(o)) && big.states.some((st) => st.present.size === 7 && !st.present.has(o))), big.states.map((st) => st.present.size));
  ok('… the same sample every run', isDeepStrictEqual(storyStates(many).states.map((st) => st.pick), big.states.map((st) => st.pick)));
  eq('describeStates on a sample: no words for the states', describeStates(big, new Set([0, 1]), new Set([2])), 'in some of the story states checked');
  const wide = storyStates(/** @type {any[]} */ ([{ id: 'w', when: Array.from({ length: 13 }, (_, i) => `a${i}`).join(' and ') }, { id: 'x', when: 'b' }]));
  eq('a group of 13 tests (one condition): sampled, the other group whole', [wide.groups.map((gr) => [gr.tests.length, gr.exhaustive]), wide.exhaustive], [[[13, false], [1, true]], false]);
  eq('… maxTests 13: every combination', storyStates(/** @type {any[]} */ ([{ id: 'w', when: Array.from({ length: 13 }, (_, i) => `a${i}`).join(' and ') }]), { maxTests: 13 }).exhaustive, true);
  const ordered = storyStates(/** @type {any[]} */ ([{ id: 'p', when: 'a and c' }, { id: 'q', when: 'b' }]));
  eq('states in the order every combination of the tests meets them (test 0 the fastest)', ordered.states.map((st) => [...st.present].map((o) => o.id).join('+')), ['', 'p', 'q', 'p+q']);
  // the party: its count and its members are read together (party:<who> in any case)
  ok('canHoldTogether: a member while nobody travels with the player cannot', canHoldTogether([cachedCondition('party:sela'), cachedCondition('not party > 0')]) === false
    && canHoldTogether([cachedCondition('party:sela'), cachedCondition('party = 1')]) === true);
  ok('canHoldTogether: four members at once cannot (MAX_PARTY 3), three can', canHoldTogether([cachedCondition('party:a and party:b and party:c and party:d')]) === false
    && canHoldTogether([cachedCondition('party:a and party:b and party:c')]) === true && canHoldTogether([cachedCondition('party:a and party:b'), cachedCondition('party < 2')]) === false);
  ok('party:Sela is party:sela', canHoldTogether([cachedCondition('party:sela'), cachedCondition('not party:Sela')]) === false
    && conditionSpace([cachedCondition('party:sela or party:SELA')]).tests.length === 1);
  const camp = /** @type {any[]} */ ([{ id: 'with-sela', when: 'party:sela' }, { id: 'alone', unless: 'party > 0' }, { id: 'odd', when: 'party:Bram' }]);
  const ps = storyStates(camp);
  ok('storyStates: never a member with an empty party (the camp with Sela and the one alone are never together)', ps.states.length > 0 && ps.states.every((s) => !(s.present.has(camp[0]) && s.present.has(camp[1]))), ps.states.map((s) => [...s.present].map((o) => o.id)));
  eq('… one group: the count and the members', [ps.groups.length, ps.exhaustive], [1, true]);
  eq('… the states: alone; someone else; Sela; Bram; both', ps.states.map((s) => [...s.present].map((o) => o.id).sort().join('+')).sort(), ['', 'alone', 'odd', 'odd+with-sela', 'with-sela']);
  ok('storyExclusive (Travel.js) follows', storyExclusive(/** @type {any} */ ({ when: 'party:sela' }), /** @type {any} */ ({ unless: 'party > 0' })) && !storyExclusive(/** @type {any} */ ({ when: 'party:sela' }), /** @type {any} */ ({ when: 'party:bram' })));
}

// =================================================================================================
begin('a comparison read either way (review F1)');
{
  const one = (a, b) => conditionSpace([cachedCondition(a), cachedCondition(b)]).tests.map((t) => t.label);
  eq('`stage:q < bridge-fixed` is `not (stage:q >= bridge-fixed)`', one('stage:q >= bridge-fixed', 'stage:q < bridge-fixed'), ['stage:q >= bridge-fixed']);
  eq('`planks < needed` is `not (planks >= needed)`', one('planks >= needed', 'planks < needed'), ['planks >= needed']);
  eq('`planks > needed` is `not (planks <= needed)`', one('planks <= needed', 'planks > needed'), ['planks <= needed']);
  eq('`x != word` is `not (x = word)`', one('x = needed', 'x != needed'), ['x = needed']);
  ok('canHoldTogether: a test and its opposite against a word cannot', canHoldTogether([cachedCondition('stage:q >= bridge-fixed'), cachedCondition('stage:q < bridge-fixed')]) === false
    && canHoldTogether([cachedCondition('planks >= needed'), cachedCondition('planks < needed')]) === false
    && canHoldTogether([cachedCondition('planks > needed'), cachedCondition('planks <= needed')]) === false);
  ok('… two different words stay free', canHoldTogether([cachedCondition('stage:q >= bridge-fixed'), cachedCondition('stage:q < ferry-found')]) === true);
  const ent = (when) => /** @type {any} */ ({ type: 'entrance', id: 'e', name: 'west', when });
  ok('storyExclusive: story variants gated by a stage name', storyExclusive(ent('stage:find-ilse >= bridge-fixed'), ent('stage:find-ilse < bridge-fixed')));
  for (const [name, on, off] of [['a stage name', 'stage:find-ilse >= bridge-fixed', 'stage:find-ilse < bridge-fixed'], ['a variable', 'planks >= needed', 'planks < needed']]) {
    const L = ford([bridge({ when: on }), eastExit, ...debris({ when: off }),
      ['entrance', 3, 6, { id: 'e1', name: 'west', when: on }], ['entrance', 3, 7, { id: 'e2', name: 'west', when: off }]]);
    const r = check(L);
    ok(`${name}: two story states, not four`, hasMsg(r.info, 'story states: 2 — what is there depends on `'), r.info);
    ok(`${name}: no duplicate entrance (the check and the editor's travelIssues)`, !hasMsg(r.errors, 'both called') && travelIssues(L).length === 0, [r.errors, travelIssues(L)]);
    ok(`${name}: the bridge walks, nothing overlaps`, !hasMsg(r.errors, 'cannot be walked') && !hasMsg(r.warnings, 'overlap'), r);
    ok(`${name}: reached only when the test holds, named once`, hasMsg(r.warnings, `reached only when \`${on}\`: `, 'exit east') && !hasMsg(r.warnings, ' and stage:') && !hasMsg(r.warnings, ' and planks'), r.warnings);
    eq(`${name}: no errors`, r.errors, []);
  }
}

// =================================================================================================
begin('independent groups past 6 tests (review F2)');
{
  // the bridge needs two flags; two kinds of flood debris block its deck while their own flags hold;
  // three story rocks elsewhere — 7 tests, 6 groups, 64 states
  const objs = (rocks) => ford([
    bridge({ when: 'planks-bought and carpenter-hired' }),
    ['crate', 11.2, 6, { id: 'wreck_1', when: 'flood' }],
    ['barrel', 12.2, 6, { id: 'wreck_2', when: 'storm' }],
    eastExit,
    ...rocks.map((f, k) => /** @type {[string, number, number, Record<string, any>]} */ (['rock', 2 + 2 * k, 2, { id: `r${k}`, when: f, opts: { size: 0.4 } }])),
  ]);
  const r = check(objs(['e', 'f', 'g']));
  ok('7 tests in 6 groups: all 64 states', hasMsg(r.info, 'story states: 64 — ', '(every combination checked)'), r.info);
  ok('the exit: reached only with the bridge and no debris — not an error', hasMsg(r.warnings, 'reached only when `planks-bought and carpenter-hired and not flood and not storm`: exit east')
    && !hasMsg(r.errors, 'exit east') && !hasMsg(r.warnings, 'an unreachable walkable pocket'), r);
  ok('the blocked deck, named by state', hasMsg(r.errors, 'cannot be walked end to end', '(with `flood`)') && hasMsg(r.errors, 'cannot be walked end to end', '(when `not flood and storm`)'), r.errors);
  ok('debris in the river without the bridge: a disjunction of one group', hasMsg(r.warnings, 'wreck_1 stands on', '(when `not carpenter-hired or not planks-bought`)'), r.warnings);
  // a sample that misses the one state that reaches the exit (2 states: nothing there, everything there)
  const few = check(objs(['e', 'f', 'g']), { maxStoryStates: 2 });
  ok('a sample: the info line says what was not tried', hasMsg(few.info, 'story states: 2 checked — ', 'not every combination was tried', 'there are 64 states, more than the 2 checked'), few.info);
  ok('… what no state checked reaches is a warning, not the error', !hasMsg(few.errors, 'exit east') && hasMsg(few.warnings, 'exit east (→ next) cannot be reached from the spawn or an entrance in any of the 2 story states checked (not every combination was tried)'), few);
  ok('… the pocket too', hasMsg(few.warnings, 'a walkable pocket of', 'is reached in none of the 2 story states checked') && !hasMsg(few.warnings, 'an unreachable walkable pocket'), few.warnings);
  const strictFew = check(objs(['e', 'f', 'g']), { maxStoryStates: 2, strict: true });
  ok('… also with strict', !hasMsg(strictFew.errors, 'exit east') && !hasMsg(strictFew.errors, 'pocket'), strictFew.errors);
  const some = check(objs(['e', 'f', 'g']), { maxStoryStates: 20 });
  ok('… states of other findings are not named from a sample', hasMsg(some.errors, 'cannot be walked end to end', '(in some of the story states checked)') && !hasMsg([...some.errors, ...some.warnings], '`flood`'), some);
  ok('… what some sampled state reaches: "reached only in some of the story states checked"', hasMsg(some.warnings, 'reached only in some of the story states checked: exit east'), some.warnings);
  // a group of one condition's 13 tests: sampled
  const wide = check(ford([bridge(), ['rock', 3, 3, { id: 'w', when: Array.from({ length: 13 }, (_, i) => `a${i}`).join(' and '), opts: { size: 0.4 } }]]));
  ok('a group past maxTests: said so', hasMsg(wide.info, 'story states: ', ' checked — ', '13 tests that depend on each other', 'all of them off, all on and each one alone flipped'), wide.info);
}

// =================================================================================================
begin('reuse across story states (review F3)');
{
  // a house in front of a villager (the camera looks north: the house south of her hides her) with a
  // flag, a bridge with its debris, story trees and a well: the reused report is the from-scratch one
  const L = ford([bridge({ when: 'mended' }), eastExit, ...debris({ unless: 'mended' }),
    ['npc', 5, 3, { id: 'ada', name: 'Ada' }],
    ['house', 5, 7.5, { id: 'hut', name: 'Hut', when: 'built', opts: { width: 4, depth: 3, stories: 2 } }],
    ['well', 18, 4, { id: 'well_e', unless: 'dry' }],
    ['tree', 7, 9, { id: 'oak', when: 'grown', opts: { kind: 'oak', height: 6 } }],
    ['npc', 19, 8, { id: 'bo', name: 'Bo', when: 'built' }]]);
  const a = check(L);
  const b = check(L, { reuseStates: false });
  eq('reused = from scratch', a, b);
  ok('the villager behind the house wherever both are there; behind the oak when the house is not', hasMsg(a.warnings, 'villager ada at (5.0, 3.0) is hidden from the camera behind hut') && hasMsg(a.warnings, 'villager ada at (5.0, 3.0) is 93 % hidden behind oak (without `built`)'), a.warnings);
  eq('reused = from scratch, strict', check(L, { strict: true }), check(L, { strict: true, reuseStates: false }));
  const S = ford([bridge(), eastExit, ...Array.from({ length: 4 }, (_, k) => /** @type {[string, number, number, Record<string, any>]} */ (['house', 3 + 5 * (k % 2), 3 + 5 * (k >> 1), { id: `h${k}`, name: `H${k}`, when: `f${k}`, opts: { width: 3, depth: 2.5 } }]))]);
  eq('four house flags: reused = from scratch', check(S), check(S, { reuseStates: false }));
}

// =================================================================================================
begin('the values a story can give (review F4, F5)');
{
  ok('StoryStates.js holds no NUL byte (git sees text)', !fs.readFileSync(new URL('../src/engine/level/StoryStates.js', import.meta.url)).includes(0));
  const never = (a, b) => canHoldTogether([cachedCondition(a), cachedCondition(b)]) === false;
  ok('whole numbers: `day > 2` and `day < 3` never hold together', never('day > 2', 'day < 3'));
  ok('… `item:plank > 2` and `item:plank < 3`, `gold > 9` and `gold < 10`, `visits:ada > 0` and `visits:ada < 1`', never('item:plank > 2', 'item:plank < 3') && never('gold > 9', 'gold < 10') && never('visits:ada > 0', 'visits:ada < 1'));
  ok('… `stage:q > 1` and `stage:q < 2`', never('stage:q > 1', 'stage:q < 2'));
  ok('the hour and variables are any number: `hour > 2` / `hour < 3`, `x > 2` / `x < 3` can', !never('hour > 2', 'hour < 3') && !never('x > 2', 'x < 3'));
  ok('counts are never below 0, the day never below 1', canHoldTogether([cachedCondition('item:plank < 0')]) === false && canHoldTogether([cachedCondition('day < 1')]) === false && canHoldTogether([cachedCondition('x < 0')]) === true);
  ok('`visited:` and `done:` are 0 or 1', never('visited:mill', 'visited:mill = 0') && never('visited:mill >= 1', 'visited:mill < 1') && canHoldTogether([cachedCondition('visited:mill = 2')]) === false && never('done:mill.fixed > 0', 'done:mill.fixed = 0'));
  const crate = (when, unless) => /** @type {any} */ ({ type: 'crate', id: 'c', ...(when ? { when } : {}), ...(unless ? { unless } : {}) });
  ok('storyExclusive: `visited:quarry` and `unless: visited:quarry = 1`', storyExclusive(crate('visited:quarry'), crate('', 'visited:quarry = 1')));
  ok('storyExclusive: `day > 2` and `day < 3`', storyExclusive(crate('day > 2'), crate('day < 3')));
  ok('… a flag is a variable (`var x = 2` is allowed): `x` and `unless: x = true` can hold together', !storyExclusive(crate('bridge-mended'), crate('', 'bridge-mended = true')));
  eq('a count compared with 1 is the count standing alone', conditionSpace([cachedCondition('item:plank >= 1'), cachedCondition('item:plank > 0'), cachedCondition('visited:mill = 1'), cachedCondition('done:x != 1')]).tests.map((t) => t.label), ['item:plank', 'visited:mill', 'done:x']);
  const ss = storyStates(/** @type {any[]} */ ([{ id: 'a', when: 'visited:quarry' }, { id: 'b', unless: 'visited:quarry = 1' }]));
  eq('… so `when: visited:x` / `unless: visited:x = 1` make two states, one test', [ss.tests.length, ss.states.length], [1, 2]);
}


// =================================================================================================
begin('levels without conditions');
{
  const L = ford([bridge(), eastExit]);
  const a = check(L);
  const b = check(L, { storyStates: false });
  eq('the same report with story states on or off', a, b);
  ok('no story-state line', !hasMsg(a.info, 'story states'), a.info);
  ok('the walk line as before', hasMsg(a.info, 'walk grid: ', 'standable nodes reachable from the spawn') && !hasMsg(a.info, 'in some story state'), a.info);
  eq('a clean ford', [a.errors, a.warnings], [[], []]);
  const blocked = check(ford([bridge(), eastExit, ...debris({})]));
  ok('debris without a condition overlaps the bridge', hasMsg(blocked.warnings, 'overlap: ford × wreck_1') || hasMsg(blocked.warnings, 'overlap: wreck_1 × ford'), blocked.warnings);
  ok('… and blocks it', hasMsg(blocked.errors, 'bridge ford cannot be walked end to end'), blocked.errors);
}

// =================================================================================================
begin('the bridge and its flood debris');
{
  const r = check(ford([bridge({ when: 'mended' }), eastExit, ...debris({ unless: 'mended' })]));
  ok('two story states', hasMsg(r.info, 'story states: 2 — what is there depends on `mended`'), r.info);
  ok('the walk line over the states', hasMsg(r.info, 'walk grid: ', 'in some story state', 'in all 2'), r.info);
  ok('no overlap of the bridge and the debris it replaces', !hasMsg(r.warnings, 'overlap'), r.warnings);
  ok('the bridge walks end to end where it is', !hasMsg(r.errors, 'cannot be walked'), r.errors);
  ok('the exit is no error', !hasMsg(r.errors, 'exit east'), r.errors);
  ok('the far bank and the exit: reached only with `mended` (one warning)', r.warnings.filter((m) => m.startsWith('reached only with `mended`: ')).length === 1
    && hasMsg(r.warnings, 'reached only with `mended`: ', 'exit east (→ next)', 'the walkable ground round'), r.warnings);
  ok('the debris stands in the river when it is there', hasMsg(r.warnings, 'wreck_1 stands on "~"') && hasMsg(r.warnings, 'wreck_2 stands on "~"'), r.warnings);
  eq('no errors', r.errors, []);

  const other = check(ford([bridge({ when: 'mended' }), eastExit, ...debris({ unless: 'cleared' })]));
  ok('debris of another flag still overlaps the bridge', hasMsg(other.warnings, 'overlap: ', 'ford', 'wreck_1'), other.warnings);
  ok('… and blocks it in the states it is there: named', hasMsg(other.errors, 'bridge ford cannot be walked end to end', '(without `cleared`)'), other.errors);
  ok('… the far bank: reached only with `mended` and `cleared`', hasMsg(other.warnings, 'reached only when `mended and cleared`: ', 'exit east'), other.warnings);

  const never = check(ford([eastExit, ['npc', 4, 4, { id: 'pip', name: 'Pip', when: 'mended' }]]));
  ok('no way over in any state: the old error', hasMsg(never.errors, 'exit east (→ next) cannot be reached from the spawn or an entrance'), never.errors);
  ok('… and the old pocket', hasMsg(never.warnings, 'an unreachable walkable pocket of'), never.warnings);
  ok('… and no "reached only"', !hasMsg(never.warnings, 'reached only'), never.warnings);

  const npcs = check(ford([bridge({ when: 'mended' }), eastExit,
    ['npc', 18, 3, { id: 'gwil', name: 'Gwil', when: 'mended' }],
    ['npc', 18, 9, { id: 'wren', name: 'Wren', unless: 'mended' }]]));
  ok('a villager on the far bank who comes with the bridge: fine', !hasMsg([...npcs.errors, ...npcs.warnings], 'gwil'), npcs);
  ok('one who is there only without it: unreachable whenever there (the old error)', hasMsg(npcs.errors, 'NPC wren (Wren) cannot be reached to talk') && !hasMsg(npcs.errors, '(with'), npcs.errors);
  ok('a villager reached only in some of its states: in the "reached only" warning',
    hasMsg(check(ford([bridge({ when: 'mended' }), ['npc', 18, 3, { id: 'gwil', name: 'Gwil', when: 'met' }]])).warnings, 'reached only with `mended`: ', 'NPC gwil (Gwil)'));
}

// =================================================================================================
begin('when the conditions apply');
{
  const L = ford([bridge({ when: 'mended' }), eastExit, ...debris({ unless: 'mended' })]);
  const plain = check(L, { storyStates: undefined });
  ok('a level without a story: its conditions are not applied (said so)', hasMsg(plain.info, 'story conditions on 3 objects are not applied'), plain.info);
  ok('… everything is there: the overlap and the blocked bridge', hasMsg(plain.warnings, 'overlap') && hasMsg(plain.errors, 'cannot be walked'), plain);
  const told = ford([bridge({ when: 'mended' }), eastExit, ...debris({ unless: 'mended' }), ['event', 4, 4, { id: 'ev', on: 'enter', run: ['set mended'], minX: 2, maxX: 6, minZ: 2, maxZ: 6 }]]);
  const st = check(told, { storyStates: undefined });
  ok('a level with a story: story states by default', hasMsg(st.info, 'story states: 2') && !hasMsg(st.warnings, 'overlap'), st);
  const lamps = check(ford([bridge(), ['light', 4, 4, { when: 'night-market' }]]));
  ok('conditions on objects that change nothing else (a light) make no story states', !hasMsg(lamps.info, 'story states'), lamps.info);
}

// =================================================================================================
begin('entrances: story variants share a name');
{
  const L = ford([bridge(), eastExit,
    ['entrance', 3, 3, { id: 'gate_a', name: 'gate', when: 'a and b' }],
    ['entrance', 3, 9, { id: 'gate_b', name: 'gate', unless: 'a' }]]);
  const r = check(L);
  ok('`a and b` and `unless: a` never together: no duplicate-name error', !hasMsg(r.errors, 'both called'), r.errors);
  const r2 = check(ford([bridge(), eastExit,
    ['entrance', 3, 3, { id: 'gate_a', name: 'gate', when: 'a' }],
    ['entrance', 3, 9, { id: 'gate_b', name: 'gate', when: 'b' }]]));
  ok('`a` and `b` can be together: the error', hasMsg(r2.errors, 'Entrances "gate_a" and "gate_b" are both called "gate"'), r2.errors);
}

// =================================================================================================
begin('many tests');
{
  const rocks = /** @type {[string, number, number, Record<string, any>][]} */ (Array.from({ length: 7 }, (_, i) => ['rock', 3 + i * 1.1, 1.5, { id: `rock${i}`, when: `f${i}`, opts: { size: 0.4 } }]));
  const r = check(ford([bridge(), ...rocks]));
  ok('7 flags of their own on a small level: all 128 states (the bound grows as the level shrinks)', hasMsg(r.info, 'story states: 128 — ', '(every combination checked)'), r.info);
  eq('… the bound: 64 on a 128 × 128 level, up to 256', [defaultMaxStoryStates({ W: 128, D: 128 }), defaultMaxStoryStates({ W: 24, D: 12 }), defaultMaxStoryStates({ W: 96, D: 120 })], [64, 256, 90]);
  const capped = check(ford([bridge(), ...rocks]), { maxStoryStates: 64 });
  ok('maxStoryStates 64: a sample of 64 of the 128 — said so', hasMsg(capped.info, 'story states: 64 checked', 'there are 128 states, more than the 64 checked') && !hasMsg(capped.info, 'every combination checked'), capped.info);
}

// =================================================================================================
const ms = Math.round(performance.now() - t0);
if (verbose) for (const [name, n] of sections) console.log(`  ${name}: ${n}`);
for (const f of failures) console.log(`  ✗ ${f}`);
console.log(`level-check self-test: ${passed} passed, ${failures.length} failed (${sections.length} sections, ${ms} ms)`);
process.exit(failures.length ? 1 : 0);
