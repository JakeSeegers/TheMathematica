#!/usr/bin/env node
/**
 * test-story-runtime.mjs — the Node self-test of the story runtime (part of `npm run story:test`):
 * the values conditions read (src/game/story/StoryState.js `storyReader`, also the boot-time
 * reader), the story state and its save (StoryState, CampaignState), and the runner's clock,
 * triggers and runs (src/game/story/StoryRunner.js) on a stub game — no browser, no level files —,
 * also with a content table installed (docs/specs/I18N.md §4: what the player reads is translated,
 * the trace, the `[once]` keys and the saved texts stay English).
 *
 *   node tools/test-story-runtime.mjs [--verbose]
 *
 * Prints a summary; exit code 1 when an assertion fails (each failure is listed with what it got).
 */
import { isDeepStrictEqual } from 'node:util';
import { StoryState, storyReader, storyKey, isLooseFlag, journeySeed, readPartyRecords } from '../src/game/story/StoryState.js';
import { CampaignState } from '../src/game/campaign/CampaignState.js';
import { buildStory } from '../src/game/campaign/StoryFormat.js';
import { cachedCondition, evalCondition, parseScript } from '../src/engine/level/StoryScript.js';
import { MAX_PARTY, ruleOfPreset, normalizeRule, PARTY_PRESETS } from '../src/engine/level/PartyRules.js';
import { setContentTables, term, contentMisses, clearContentMisses } from '../src/engine/i18n/ContentText.js';
import { guidOf, tagLine } from '../src/engine/i18n/ContentKeys.js';
import { registerCoreStrings } from '../src/engine/i18n/strings/index.js';
import { t, setLang } from '../src/engine/i18n/I18n.js';

// (StoryRunner reaches the whole game through its types: it is loaded by a computed path so the
// tools' type check stays out of the browser graph — tsconfig.json checks it)
const runnerPath = new URL('../src/game/story/StoryRunner.js', import.meta.url).href;
/** @type {{ StoryRunner: any }} */
const { StoryRunner } = await import(runnerPath);

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
    return JSON.stringify(v);
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
/** @param {string} name @param {unknown} got @param {unknown} want */
const eq = (name, got, want) => ok(name, isDeepStrictEqual(got, want), got);
/** The runtime's warnings (script errors, held-back events), checked instead of printed. @type {string[]} */
const warned = [];
console.warn = (...a) => { warned.push(a.join(' ')); };
/** Did the runtime warn with this text? @param {string} part */
const hasWarn = (part) => warned.some((w) => w.includes(part));

/** A story with one declared quest (three stages) and an actor. */
const { story } = buildStory([{ name: 'main.json', text: JSON.stringify({
  format: 'luminati-story', version: 1,
  quests: { declared: { title: 'Declared', stages: [{ id: 'one' }, { id: 'two' }, { id: 'three' }] } },
  actors: { wren: { name: 'Elder Wren' } },
}) }]);

/**
 * A stub game: what the runner touches, nothing drawn.
 * @param {{ hour?: number, campaign?: any }} [opts]
 * @returns {any}
 */
function stubGame({ hour = 9, campaign = null } = {}) {
  const g = {
    mode: 'play', busy: false, photoMode: false, mapOpen: false, journalOpen: false, combat: null, campaign,
    npcs: [], npcById: new Map(),
    level: { name: 'Test', width: 32, depth: 32, objects: [] },
    lighting: { timeOfDay: hour },
    weather: { weather: 'clear', setWeather(w) { this.weather = w; } },
    player: { position: { x: 1, z: 1 }, sprite: {}, faceTowards() {} },
    world: { interactables: [], applyStory: () => ({ rect: null, changed: [], mapChanged: false }), groundAt: () => 0 },
    ui: {
      dialog: { isOpen: false, isHeld: false, isChoosing: false, close() {}, open: async () => undefined },
      prompt: { hide() {} }, hud: { toast() {} }, fader: { opacity: 0, fadeIn: async () => {} },
      journal: null, emotes: null, banner: { show() {} },
    },
    audio: { playSfx() {} },
    refreshActors() {}, repaintLevelMap() {},
    setTime(h) { this.lighting.timeOfDay = ((h % 24) + 24) % 24; },
    /** @type {string[]} villagers `talkTo` was asked for */
    talked: [],
    rig: { snap() {} },
    _standable: (x, z) => ({ x, z }),
    _updateCameraBounds() {},
    talkTo(id) { this.talked.push(id); return true; },
  };
  return g;
}

/** A stub villager (what the runner directs). @returns {any} */
function stubNpc(id, name, actor = '') {
  return {
    id, name, storyObj: actor ? { actor } : {}, def: {}, present: true, directed: false, facing: '',
    position: { x: 4, z: 4 }, sprite: { setDirection(d) { this.dir = d; }, faceVector() {} },
    direct() { this.directed = true; }, release() { this.directed = false; }, stopWalk() { this.idle = (this.idle ?? 0) + 1; },
    placeAt(x, z) { this.position.x = x; this.position.z = z; },
    setPresent(on) { this.present = on; },
    walkStep(dt, tx, tz) {
      this.directed = true;
      const dx = tx - this.position.x;
      const dz = tz - this.position.z;
      const d = Math.hypot(dx, dz);
      const s = Math.min(d, 2 * dt);
      if (d > 0) { this.position.x += (dx / d) * s; this.position.z += (dz / d) * s; }
    },
  };
}

/** Let the runs' awaits settle (a few macrotasks). */
const settle = async (n = 4) => { for (let k = 0; k < n; k++) await new Promise((r) => setTimeout(r, 0)); };

/** An event object of the stub level. @returns {any} */
const ev = (id, props) => ({ id, type: 'event', minX: 0, maxX: 2, minZ: 0, maxZ: 2, run: ['set ran'], ...props });

/** A runner on a stub game with `objects` in its level, attached. */
function runnerWith(objects, { hour = 9, state = new StoryState(story), levelId = 'here' } = {}) {
  const g = stubGame({ hour });
  g.level.objects = objects;
  const r = new StoryRunner({ game: g, story, state, levelId });
  r.attachLevel(levelId);
  return { g, r, state };
}

// =================================================================================================
begin('reader: stages');
{
  const s = new StoryState(story);
  const read = storyReader(() => s, { story, level: () => 'here' });
  const holds = (c) => evalCondition(cachedCondition(c), read);
  ok('declared quest, not started: stage:q >= one is false', !holds('stage:declared >= one'));
  ok('… stage:q = one is false', !holds('stage:declared = one'));
  ok('… stage:q < one is true', holds('stage:declared < one'));
  s.questChange('declared', 'stage', { stage: 'two' });
  ok('at two: >= one', holds('stage:declared >= one'));
  ok('at two: >= two', holds('stage:declared >= two'));
  ok('at two: not >= three', !holds('stage:declared >= three'));
  ok('an unknown stage comes after every stage: not >= typo', !holds('stage:declared >= typo') && holds('stage:declared < typo'));
  // an undeclared quest: the log orders its stages
  ok('undeclared, not started: not = x, not >= x', !holds('stage:free = x') && !holds('stage:free >= x'));
  s.questChange('free', 'stage', { stage: 'a' });
  s.questChange('free', 'stage', { stage: 'b' });
  ok('undeclared at b: >= a and >= b', holds('stage:free >= a') && holds('stage:free >= b'));
  ok('undeclared at b: not >= c (not reached)', !holds('stage:free >= c') && holds('stage:free < c'));
  eq('text: ${stage:q} shows its id', read.text({ kind: 'stage', name: 'declared' }), 'two');
  eq('text: quest state', read.text({ kind: 'quest', name: 'nope' }), 'none');
  // the boot-time reader follows the same rules
  const boot = s.basicReader({ story });
  ok('basicReader: the same stage rule', !evalCondition(cachedCondition('stage:declared >= three'), boot) && evalCondition(cachedCondition('stage:declared >= one'), boot));
}

begin('reader: done, visits, visited, game values');
{
  const s = new StoryState(null);
  s.markDone('millbrook.ev_planks');
  s.markDone('story.ford-open');
  s.markDone('once:greet');
  s.visits['actor:wren'] = 2;
  s.visits['mill-road/odo'] = 1;
  const read = storyReader(() => s, { level: () => 'millbrook', visited: () => ['millbrook'], game: (n) => (n === 'hour' ? 20 : undefined) });
  const holds = (c) => evalCondition(cachedCondition(c), read);
  ok('done:<id> is this level\'s event', holds('done:ev_planks'));
  ok('done:<level>.<id> another level\'s', holds('done:millbrook.ev_planks'));
  ok('done: a story-file event, a once block', holds('done:ford-open') && holds('done:greet'));
  ok('visits:<actor> without the villager here', holds('visits:wren >= 2'));
  ok('visits: a villager of this level by id', !holds('visits:odo >= 1'));
  ok('visited:', holds('visited:millbrook') && !holds('visited:mill-road'));
  ok('game values from the context', holds('hour >= 18.5') && holds('level = millbrook'));
  ok('gold defaults to the story purse', !holds('gold > 0'));
  const other = storyReader(() => s, { level: () => 'mill-road' });
  ok('done:<id> reads the level given', !evalCondition(cachedCondition('done:ev_planks'), other) && evalCondition(cachedCondition('visits:odo >= 1'), other));
}

begin('state: flags, keys, quests, save');
{
  const s = new StoryState(null, ['met hollis', 'warned', ' bad ']);
  ok('loose flags from the campaign are set', s.has('met hollis') && s.has('warned'));
  ok('… a padded one is not a flag name', !s.has(' bad ') && !isLooseFlag(' bad '));
  ok('setFlag: a loose flag', s.setFlag('gold') && s.has('gold'));
  ok('setVar still refuses reserved words', !s.setVar('day', 3));
  ok('flagCondition reads a loose flag as written', evalCondition(cachedCondition('met hollis'), s.basicReader()));
  const back = StoryState.fromJSON(JSON.parse(JSON.stringify(s.toJSON())));
  ok('loose flags survive a save', back.has('met hollis') && back.has('gold'));
  const long = `opt:actor:wren:12:${'A long option label '.repeat(20)}`;
  ok('a long key is shortened to fit a save', storyKey(long).length <= 200 && storyKey(long) !== storyKey(`${long}x`));
  s.markDone(long);
  const back2 = StoryState.fromJSON(JSON.parse(JSON.stringify(s.toJSON())));
  ok('… and is still done after a reload', back2.isDone(long));
  s.questChange('q', 'stage', { stage: 'a' });
  s.questChange('q', 'done');
  eq('a stage on a finished quest re-opens it', [s.questChange('q', 'stage', { stage: 'b' }), s.quest('q')?.state], ['stage', 'active']);
  const v0 = s.version;
  eq('visit counts and bumps the version', [s.visit('actor:x'), s.visit('actor:x'), s.version > v0], [0, 1, true]);
  s.pending = ['event:here.e1', 'story:s1'];
  eq('pending runs survive a save', StoryState.fromJSON(JSON.parse(JSON.stringify(s.toJSON()))).pending, ['event:here.e1', 'story:s1']);
  eq('… hostile pending entries are dropped', StoryState.fromJSON({ pending: ['bark:x', 5, 'event:ok', 'talk:here/elder'] }).pending, ['event:ok', 'talk:here/elder']);
  const far = StoryState.fromJSON({ levels: { here: { homes: { a: [1e300, 2], b: [3, 4] } } } });
  eq('a saved home far off the map is dropped', far.levels.here.homes, Object.assign(Object.create(null), { b: [3, 4] }));
  const campaign = /** @type {any} */ ({ start: { level: 'a', entrance: '' }, levels: [{ id: 'a' }], flags: ['met hollis'], chapters: [] });
  const cs = new CampaignState(campaign, 'c');
  ok('CampaignState.set: a free-form flag', cs.set('saw the river') && cs.has('saw the river') && cs.has('met hollis'));
}

begin('runner: the clock');
{
  const { g, r, state } = runnerWith([ev('lamps', { on: 'time', at: 18.5, run: ['set lit'] })], { hour: 17 });
  g.busy = true; // (queued runs wait: the queue is what is checked)
  g.lighting.timeOfDay = 19;
  r.update(0.016);
  eq('time passing fires a `time` event', r.queue.map((q) => q.key), ['event:here.lamps']);
  r.queue.length = 0;
  g.lighting.timeOfDay = 9;
  r.resyncClock();
  r.update(0.016);
  eq('a re-synced jump fires nothing and adds no day', [r.queue.length, state.day], [0, 1]);
  r._advanceClock(21);
  eq('`time 21` at 9:00 (12 h) fires the event', r.queue.map((q) => q.key), ['event:here.lamps']);
  r.queue.length = 0;
  r._advanceClock(6);
  eq('`time 6` at 21:00 is a new day, no event', [state.day, r.queue.length], [2, 0]);
  r.update(0.016);
  eq('… and the next frame counts nothing twice', [state.day, r.queue.length], [2, 0]);
  g.lighting.timeOfDay = 23.9;
  r.update(0.016);
  eq('a jump of 12 h or more in one frame is the clock being set: no day', state.day, 2);
  g.lighting.timeOfDay = 0.1;
  r.update(0.016);
  eq('midnight passing is a new day', state.day, 3);
}

begin('runner: change events and conditions');
{
  const { g, r } = runnerWith([
    ev('flag', { on: 'change', if: 'a' }),
    ev('gold', { on: 'change', if: 'gold >= 10' }),
    ev('bare', { on: 'use', if: 'gold' }),
  ]);
  g.busy = true;
  ok('a bare reserved word in an event `if` reads the game value', !r._eventGuard(r.events[2]));
  r.state.gold = 12;
  ok('… the purse', r._eventGuard(r.events[2]));
  r.update(0.016);
  eq('a gold change is noticed without a story change', r.queue.map((q) => q.key), ['event:here.gold']);
  r.queue.length = 0;
  r.state.setVar('a', 1);
  r.update(0.016);
  eq('a flag change fires its `change` event', r.queue.map((q) => q.key), ['event:here.flag']);
  r.queue.length = 0;
  g.weather.weather = 'rain';
  r.update(0.016);
  eq('a weather change re-reads conditions (nothing new to fire)', r.queue.length, 0);
}

begin('runner: triggers, bursts, pending');
{
  const { r, state } = runnerWith([ev('a', { on: 'use', once: true }), ev('b', { on: 'use' })]);
  r._trigger(r.events[0]);
  r._trigger(r.events[1]);
  eq('pendingKeys: queued event runs', r.pendingKeys(), ['event:here.a', 'event:here.b']);
  // a reload: a new runner on the saved state resumes them
  state.pending = r.pendingKeys();
  const saved = StoryState.fromJSON(JSON.parse(JSON.stringify(state.toJSON())), story);
  const again = runnerWith([ev('a', { on: 'use', once: true, if: 'never-set' }), ev('b', { on: 'use' })], { state: saved });
  again.r.resumePending();
  eq('resumePending queues them again (a guard that held then is not asked again)', again.r.queue.map((q) => q.key), ['event:here.a', 'event:here.b']);
  eq('… once', [again.r.state.pending.length], [0]);
  // events that set each other off
  const loop = runnerWith([ev('x', { on: 'use' })]);
  for (let k = 0; k < 20; k++) {
    loop.r.enqueue({ kind: 'event', key: 'event:here.x', nodes: [] });
    loop.r.queue.length = 0;
  }
  ok('a burst of the same event is held back', loop.r._bursts.get('event:here.x').n > 8);
  loop.r.enqueue({ kind: 'event', key: 'event:here.x', nodes: [] });
  eq('… nothing more is queued in the window', loop.r.queue.length, 0);
  ok('… with one warning', warned.filter((w) => w.includes('held back')).length === 1, warned);
  loop.r._now += 3;
  loop.r.enqueue({ kind: 'event', key: 'event:here.x', nodes: [] });
  eq('… until the window passed', loop.r.queue.length, 1);
}

begin('runner: runs');
{
  const { r, state } = runnerWith([]);
  const run = async (lines) => {
    const p = parseScript(lines);
    await r._exec({ kind: 'test', key: `test:${lines[0]}`, nodes: p.nodes }, { ownBusy: true });
  };
  await run(['set seen', 'give apple 2', 'quest q start A ${item:apple} apples', 'var n = 3']);
  eq('commands change the state', [state.get('seen'), state.count('apple'), state.quest('q')?.title, state.get('n')], [1, 2, 'A 2 apples', 3]);
  await run(['once bonus', '  var n += 1']);
  await run(['once bonus', '  var n += 1']);
  eq('a once block runs once', state.get('n'), 4);
  const visitsBefore = state.visitsOf('actor:wren');
  const npc = /** @type {any} */ ({ id: 'elder', name: 'Elder Wren', storyObj: { actor: 'wren' }, def: {}, storyTalk: parseScript(['if visits = 0', '  set first']).nodes });
  await r.talk(npc);
  eq('a talk counts the visit when it ends; `visits` read the count before', [state.visitsOf('actor:wren'), state.get('first')], [visitsBefore + 1, 1]);
  await run(['call missing']);
  ok('an error ends the run, the player is free again', !r.run && !r.game.busy && r.errors === 1);
  ok('… and is reported with where it happened', warned.some((w) => w.includes('test:call missing: line 1: no script "missing"')), warned);
}

begin('runner: the background lane');
{
  const { g, r, state } = runnerWith([
    ev('chatter', { on: 'use', background: true, run: ['bark elder Lovely day, ${item:apple} apples!', 'set chatted'] }),
    ev('talky', { on: 'use', background: true, run: ['Elder: this needs the window'] }),
    ev('slow', { on: 'use', background: true, run: ['face elder left', 'wait 5', 'set slow-done'] }),
  ]);
  const elder = stubNpc('elder', 'Elder Wren', 'wren');
  g.npcs.push(elder);
  g.npcById.set('elder', elder);
  /** @type {string[]} */
  const barks = [];
  g.ui.emotes = { bark: (_s, text) => { barks.push(text); return 2; }, show() {}, clear() {} };
  state.addItem('apple', 3);
  r.hooks.fire('chatter');
  eq('a background event goes to its own queue', [r.queue.length, r.bgQueue.length], [0, 1]);
  r.update(0.016);
  await settle();
  eq('it runs beside play: the line is barked, the state changes, nobody is held', [barks, state.get('chatted'), g.busy], [['Lovely day, 3 apples!'], 1, false]);
  const errors = r.errors;
  r.hooks.fire('talky');
  r.update(0.016);
  await settle();
  ok('a dialogue line in a background run is an error that ends it', r.errors === errors + 1 && !r.bgRuns.length
    && warned.some((w) => w.includes('event:here.talky') && w.includes('background')), warned.slice(-2));
  g.busy = true;
  r.hooks.fire('slow');
  r.update(0.016);
  eq('it waits while the player is held', [r.bgRuns.length, r.bgQueue.length], [0, 1]);
  g.busy = false;
  r.update(0.016);
  await settle();
  eq('… and starts when the player is free', r.bgRuns.length, 1);
  g.busy = true;
  r.update(10);
  await settle();
  eq('its wait stands still while the player is held', state.get('slow-done'), 0);
  g.busy = false;
  // the main lane takes the villager: the background run stops where it is
  const main = parseScript(['face elder right', 'set main-done']);
  await r._exec({ kind: 'test', key: 'test:take', nodes: main.nodes }, { ownBusy: true });
  await settle();
  eq('the main lane takes the villager: the background run stops', [r.bgRuns.length, state.get('slow-done'), state.get('main-done'), elder.directed], [0, 0, 1, false]);
}

begin('runner: a conversation interrupted by a reload');
{
  const { g, r, state } = runnerWith([]);
  const elder = stubNpc('elder', 'Elder Wren', 'wren');
  g.npcs.push(elder);
  g.npcById.set('elder', elder);
  elder.storyTalk = parseScript(['Elder Wren: hello', 'wait 30', 'set talked']).nodes;
  const p = r.talk(elder);
  await settle();
  eq('pendingKeys holds the conversation going on', r.pendingKeys(), ['talk:here/elder']);
  state.pending = r.pendingKeys();
  const saved = StoryState.fromJSON(JSON.parse(JSON.stringify(state.toJSON())), story);
  const again = runnerWith([], { state: saved });
  again.g.npcs.push(elder);
  again.g.npcById.set('elder', elder);
  again.r.resumePending();
  again.r.update(0.016);
  eq('on Continue the player talks to the villager again', again.g.talked, ['elder']);
  r.skip();
  await p;
}

begin('state: the journey seed, the backup');
{
  const s = new StoryState(null);
  eq('a story without a seed picks as before (seed 0)', s.seed, 0);
  s.seed = 123456;
  eq('the seed survives a save', StoryState.fromJSON(JSON.parse(JSON.stringify(s.toJSON()))).seed, 123456);
  eq('a hostile seed is dropped', [StoryState.fromJSON({ seed: -4 }).seed, StoryState.fromJSON({ seed: 2 ** 40 }).seed, StoryState.fromJSON({ seed: '7' }).seed], [0, 0, 0]);
  const seeds = new Set(Array.from({ length: 8 }, () => journeySeed()));
  ok('journeySeed: a random non-zero u32 each journey', seeds.size > 1 && [...seeds].every((n) => Number.isInteger(n) && n > 0 && n <= 0xffffffff), [...seeds]);
  const { r } = runnerWith([]);
  eq('the seed hook', [r.hooks.seed(77), r.state.seed], [77, 77]);
  // the backup: the save as it was at the last travel, not a moment ago
  /** @type {Map<string, string>} */
  const store = new Map();
  const ls = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } };
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true, writable: true });
  try {
    const campaign = /** @type {any} */ ({ start: { level: 'a', entrance: '' }, levels: [{ id: 'a' }], flags: [], chapters: [] });
    const cs = new CampaignState(campaign, 'c');
    const key = CampaignState.key('c');
    const mark = (n) => { cs.playTime = n; return cs.save(); };
    mark(1);
    mark(2);
    ok('ordinary saves leave no backup', !store.has(`${key}.prev`));
    cs.playTime = 3;
    cs.save(null, { milestone: true });
    eq('a travel keeps the save it replaces as the backup', JSON.parse(store.get(`${key}.prev`)).playTime, 2);
    mark(4);
    mark(5);
    eq('… which later saves leave alone', JSON.parse(store.get(`${key}.prev`)).playTime, 2);
    // a save of an older version (or of none) is not read: a new game, which saves over it (a
    // newer one is read and never written over)
    warned.length = 0;
    const saves = [{ version: 1, flags: ['met hollis'], inventory: { plank: 2 }, level: 'a', playTime: 50 }, { story: { vars: { met: 1 } }, level: 'a', playTime: 50 },
      { version: 3, story: { vars: { met: 1 } }, level: 'a', playTime: 50 }];
    const seen = saves.map((data) => {
      store.clear();
      store.set(key, JSON.stringify(data));
      const read = CampaignState.fromJSON(campaign, 'c', data);
      const loaded = CampaignState.load(campaign, 'c');
      const was = [read.has('met hollis') || read.has('met'), read.story.count('plank'), read.playTime, read.readVersion, loaded?.playTime ?? null];
      read.playTime = 7;
      const wrote = read.save();
      const now = JSON.parse(store.get(key));
      return [...was, wrote, now.version, now.playTime];
    });
    eq('a version-1 and a version-less save: not read (a fresh game; load: none, with a warning) and written over; a newer one kept',
      [seen, warned.filter((w) => w.includes('older version')).length],
      [[[false, 0, 0, 2, null, true, 2, 7], [false, 0, 0, 2, null, true, 2, 7], [true, 0, 50, 3, 50, false, 3, 50]], 2]);
  } finally {
    if (had) Object.defineProperty(globalThis, 'localStorage', had);
    else delete globalThis.localStorage;
  }
}

begin('runner: the two lanes (review fixes)');
{
  const setup = () => {
    const env = runnerWith([]);
    const elder = stubNpc('elder', 'Elder Wren', 'wren');
    env.g.npcs.push(elder);
    env.g.npcById.set('elder', elder);
    /** @type {string[]} */
    const barks = [];
    env.g.ui.emotes = { bark: (_s, text) => { barks.push(text); return 2; }, show() {}, clear() {} };
    return { ...env, elder, barks };
  };
  const bg = (r, lines, key = 'event:here.bg', onceKey = '') => r._enqueueBg({ kind: 'event', key, nodes: parseScript(lines).nodes, onceKey });
  const step = async (r, dt, n = 1) => { for (let k = 0; k < n; k++) { r.update(dt); await settle(1); } };
  // a main `wait <who>` on a villager the background lane walks: the main lane takes it, no deadlock
  {
    const { r, state } = setup();
    bg(r, ['walk elder 30 30 nowait', 'wait 60']);
    await step(r, 0.016, 2);
    const main = r._exec({ kind: 'test', key: 'test:w', nodes: parseScript(['wait elder', 'set main-done']).nodes }, { ownBusy: true });
    let done = false;
    main.then(() => { done = true; });
    await step(r, 0.1, 5);
    eq('a main `wait <who>` on a background walk ends (the main lane takes the villager)', [done, state.get('main-done'), r.bgRuns.length], [true, 1, 0]);
  }
  // no background line runs while the main lane holds the player
  {
    const { r, g, state } = setup();
    bg(r, ['wait 0.5', 'set bg-flag']);
    await step(r, 0.016, 2);
    const main = r._exec({ kind: 'test', key: 'test:hold', nodes: parseScript(['wait 3', 'set main-done']).nodes }, { ownBusy: true });
    await step(r, 1, 2);
    eq('held: the background wait stands still', [state.get('bg-flag'), g.busy], [0, true]);
    await step(r, 1, 3);
    await main;
    await step(r, 0.3, 3);
    eq('free again: it goes on', [state.get('main-done'), state.get('bg-flag')], [1, 1]);
  }
  // a background run never takes the main lane's villager
  {
    const { r, elder, state } = setup();
    const main = r._exec({ kind: 'test', key: 'test:own', nodes: parseScript(['walk elder 20 4', 'set main-walked']).nodes }, { ownBusy: true });
    await settle();
    r._mainActors.add(elder);
    const run = { kind: 'event', key: 'event:here.x', nodes: [], self: null, visits: 0, visitKey: '', onceKey: '', steps: 0, fast: false, cutscene: false, calls: 0, background: true, stopped: false, actors: new Set() };
    let threw = false;
    try { r._takeActor(elder, /** @type {any} */ (run)); } catch { threw = true; }
    ok('a background run that wants the main lane\'s villager stops', threw && run.stopped);
    r.skip();
    await main;
    eq('… the main walk is untouched', state.get('main-walked'), 1);
  }
  // a `nowait` walk at the end of a background script goes on to its goal
  {
    const { r, elder } = setup();
    bg(r, ['bark elder Off to the well!', 'walk elder 6 4 nowait']);
    await step(r, 0.016, 2);
    eq('the run ended, its walk goes on', [r.bgRuns.length, r.walks.has(elder), elder.directed], [0, true, true]);
    await step(r, 0.05, 60);
    ok('… to its goal, and the villager is released there', !r.walks.has(elder) && !elder.directed && Math.hypot(elder.position.x - 6, elder.position.z - 4) < 0.3, elder.position);
  }
  // paused background walkers stand idle (once)
  {
    const { r, g, elder } = setup();
    bg(r, ['walk elder 30 4']);
    await step(r, 0.016, 2);
    const before = elder.idle ?? 0;
    g.busy = true;
    await step(r, 0.1, 3);
    eq('a paused walker takes the idle pose once', (elder.idle ?? 0) - before, 1);
    g.busy = false;
  }
  // a line break in a bark reaches the bubble as a line feed
  {
    const { r, barks } = setup();
    bg(r, ['bark elder Line one' + String.fromCharCode(92) + 'nLine two']);
    await step(r, 0.016, 2);
    eq('a script line break in a bark reaches the bubble as a line feed', barks, ['Line one' + String.fromCharCode(10) + 'Line two']);
  }
  // a new journey ends the old journey's background lane; a `once` background run is pending
  {
    const { r, state } = setup();
    bg(r, ['wait 5', 'set late'], 'event:here.late', 'here.late');
    bg(r, ['set queued'], 'event:here.q2', 'here.q2');
    r.game.busy = true;
    await step(r, 0.016, 1);
    eq('once background runs (queued) are kept as pending', r.pendingKeys(), ['event:here.late', 'event:here.q2']);
    r.setState(new StoryState(story));
    r.game.busy = false;
    await step(r, 0.016, 3);
    eq('a new journey drops the old background lane', [r.bgRuns.length, r.bgQueue.length, r.state.get('queued'), state.get('queued')], [0, 0, 0, 0]);
  }
}

// =================================================================================================
// The party (docs/specs/PARTY.md §7): a stub Party with the contract's API, on the stub game
// =================================================================================================

/** A story whose actor has a talk script (a member of another level talks with it). */
const partyStory = buildStory([{ name: 'main.json', text: JSON.stringify({
  format: 'luminati-story', version: 1,
  actors: { 'sela-actor': { name: 'Sela', talk: ['Sela: from the story files.', 'set actor-talked'] }, wren: { name: 'Elder Wren' } },
}) }]).story;

/** A stub party member (what the runner directs, as on an Npc). @returns {any} */
function stubMember(record) {
  const m = stubNpc(record.id, record.name, record.actor);
  return Object.assign(m, { record, storyTalk: null, combat: { refills: 0, refill() { this.refills++; } }, sprite: { ...m.sprite, member: record.id } });
}

/**
 * A stub Party (the contract's API: find, holds, join, leave, setRule, setField, openMenu,
 * menuOpen, count, members), writing its records into the story's state as the Party does.
 * @returns {any}
 */
function stubParty(g, stateOf) {
  const party = {
    members: [], records: [], calls: [], menuOpen: false,
    get count() { return this.records.length; },
    find(who) {
      const s = String(who ?? '').trim();
      if (!s) return null;
      const low = s.toLowerCase();
      return this.members.find((m) => m.id === s) ?? this.members.find((m) => (m.record.actor && m.record.actor.toLowerCase() === low) || m.id.toLowerCase() === low || m.name.toLowerCase() === low) ?? null;
    },
    holds(v) {
      const actor = typeof v?.actor === 'string' ? v.actor : typeof v?.storyObj?.actor === 'string' ? v.storyObj.actor : '';
      return this.records.some((r) => r.id === v?.id || (!!actor && r.actor === actor));
    },
    join(npc, opts = {}) {
      this.calls.push(['join', typeof npc === 'string' ? npc : npc.id, { ...opts }]);
      if (this.count >= MAX_PARTY || this.holds(npc)) return null;
      const record = { id: npc.id, name: npc.name, actor: npc.storyObj?.actor ?? '', preset: 'villager', spec: null, color: '#c9a45c', cls: opts.cls ?? 'warden', rule: ruleOfPreset(opts.preset ?? 'balanced'), level: g.levelOf ?? '' };
      this.records.push(record);
      const m = stubMember(record);
      this.members.push(m);
      npc.setPresent(false);
      stateOf().setParty(this.records);
      return m;
    },
    leave(who) {
      this.calls.push(['leave', who]);
      const m = this.find(who);
      if (!m) return false;
      this.members.splice(this.members.indexOf(m), 1);
      this.records.splice(this.records.indexOf(m.record), 1);
      const npc = g.npcById.get(m.id);
      if (npc) npc.setPresent(g.story ? g.story.present(g.level.objects.find((o) => o.id === m.id) ?? npc.storyObj) : true);
      stateOf().setParty(this.records);
      return true;
    },
    setRule(who, rule, opts = {}) {
      this.calls.push(['rule', who, rule, { ...opts }]);
      const m = this.find(who);
      if (!m) return null;
      m.record.rule = typeof rule === 'string' ? ruleOfPreset(rule) : normalizeRule(rule, m.record.rule);
      stateOf().setParty(this.records);
      return { ...m.record.rule };
    },
    setField(who, field, value, opts = {}) {
      this.calls.push(['set', who, field, value, { ...opts }]);
      const m = this.find(who);
      if (!m) return null;
      m.record.rule = normalizeRule({ ...m.record.rule, [field]: value });
      stateOf().setParty(this.records);
      return { ...m.record.rule };
    },
    openMenu(who) {
      this.calls.push(['menu', who]);
      if (!this.count) return false;
      this.menuOpen = true;
      return true;
    },
  };
  return party;
}

/**
 * A runner on a stub game whose level has villagers Sela (actor `sela-actor`, a talk script of her
 * own) and Pip, Mara and Odo, with the party made on demand (`ensureParty`).
 */
function partyRunner({ campaign = null, objects = [], state = new StoryState(partyStory) } = {}) {
  const g = stubGame({ campaign });
  const villagers = [
    { id: 'sela', type: 'npc', name: 'Sela', actor: 'sela-actor', talk: ['Sela: my own words.', 'set own-talked'] },
    { id: 'pip', type: 'npc', name: 'Pip' },
    { id: 'mara', type: 'npc', name: 'Mara' },
    { id: 'odo', type: 'npc', name: 'Odo', when: 'odo-here' },
  ];
  g.level.objects = [...villagers, ...objects];
  for (const o of villagers) {
    const npc = stubNpc(o.id, o.name, o.actor ?? '');
    npc.storyObj = o;
    g.npcs.push(npc);
    g.npcById.set(o.id, npc);
  }
  g.ensures = 0;
  g.syncs = 0;
  g.ensureParty = async () => { g.ensures++; g.party ??= stubParty(g, () => r.state); return g.party; };
  g.syncParty = async () => { g.syncs++; };
  /** @type {string[]} */
  const barks = [];
  g.ui.emotes = { bark: (sprite, text) => { barks.push(`${sprite.member ?? 'npc'}:${text}`); return 2; }, show() {}, clear() {} };
  const r = new StoryRunner({ game: g, story: partyStory, state, levelId: 'here' });
  g.story = r;
  r.attachLevel('here');
  const run = async (lines, key = `test:${lines[0]}`) => {
    const p = parseScript(lines);
    if (p.errors.length) throw new Error(JSON.stringify(p.errors));
    await r._exec({ kind: 'test', key, nodes: p.nodes }, { ownBusy: true });
  };
  const npc = (id) => g.npcById.get(id);
  return { g, r, run, npc, barks };
}

begin('party: join, rule, set, leave');
{
  const { g, r, run, npc } = partyRunner();
  ok('no party before a join', g.party === undefined || g.party === null);
  await run(['party rule sela guardian', 'party leave sela', 'party menu']);
  ok('rule / leave / menu without a party: warnings, and no party is made', !g.party && g.ensures === 0 && warned.filter((w) => w.includes('party rule') || w.includes('party leave') || w.includes('party menu')).length === 3, warned.slice(-3));
  const errors = r.errors;
  await run(['party join sela as ranger guardian']);
  eq('join: the party is made, the villager joins as the class with the preset', [g.ensures, g.party.calls[0], g.party.members.map((m) => [m.id, m.record.cls, m.record.rule.distance])], [1, ['join', 'sela', { cls: 'ranger', preset: 'guardian' }], [['sela', 'ranger', 'close']]]);
  eq('join without a class or preset passes neither', (await run(['party join pip']), g.party.calls.at(-1)), ['join', 'pip', { cls: undefined, preset: undefined }]);
  ok('the records reach the state', r.state.party.map((x) => x.id).join() === 'sela,pip', r.state.party);
  ok('conditions: party, party:<id>, party:<actor>, party:<name> in any case', ['party = 2', 'party >= 2', 'party:sela', 'party:sela-actor', 'party:SELA', 'party:Pip', 'not party:mara'].every((c) => r.test(c)) && !r.test('party:mara') && !r.test('party > 2'));
  ok('… and when / unless (the flag rule) too', r.holds('party:sela') && !r.holds('party:odo'));
  // refused: a member already, no such villager, not there as the story stands, a full party
  const calls = g.party.calls.length;
  await run(['party join Sela', 'party join ghost', 'party join odo']);
  ok('a member already, no villager here, absent as the story stands: warnings, no join', g.party.calls.length === calls && g.party.count === 2
    && hasWarn('"Sela" is in the party already') && hasWarn('"ghost" is no villager here') && hasWarn('"odo" is not here as the story stands'), warned.slice(-3));
  await run(['party join mara']);
  r.state.setVar('odo-here', 1);
  r.applyPresence();
  await run(['party join odo']);
  ok('a full party: a warning, nobody joins', g.party.count === MAX_PARTY && !g.party.find('odo') && hasWarn(`the party is full (${MAX_PARTY})`), warned.slice(-2));
  ok('script errors: none (refusals are warnings)', r.errors === errors, r.errors);
  // rule / set
  await run(['party rule sela support', 'party set "Sela" heal often', 'party set pip evade off']);
  eq('rule and set: the member\'s id, the story as the source (it toasts)', g.party.calls.slice(-3), [
    ['rule', 'sela', 'support', { source: 'story', quiet: false }], ['set', 'sela', 'heal', 'often', { source: 'story', quiet: false }], ['set', 'pip', 'evade', 'off', { source: 'story', quiet: false }],
  ]);
  eq('… the rules now', [g.party.find('sela').record.rule.attack, g.party.find('sela').record.rule.heal, g.party.find('pip').record.rule.evade], ['assist', 'often', 'off']);
  await run(['party set nobody heal low']);
  ok('set on no member: a warning', hasWarn('"nobody" is not in the party'), warned.slice(-1));
  // presence: the villager stays hidden while held
  const sela = npc('sela');
  ok('present() is false for a held villager (its object, by id and by actor)', !r.present(g.level.objects[0]) && !r.present(/** @type {any} */ ({ id: 'other', type: 'npc', actor: 'sela-actor' })) && r.present(/** @type {any} */ ({ id: 'other', type: 'npc' })));
  ok('… props are not asked', r.present(/** @type {any} */ ({ id: 'sela', type: 'rock' })));
  sela.present = true;
  r.applyPresence();
  ok('applyPresence never shows a held villager again', sela.present === false);
  r.state.version++;
  r.update(0.016);
  ok('… nor does a story change', sela.present === false);
  // leave
  await run(['party leave sela-actor']);
  ok('leave: by actor; the villager is back', g.party.calls.at(-1)?.[0] === 'leave' && !g.party.find('sela') && sela.present === true && !r.test('party:sela') && r.test('party = 2'), g.party.calls.at(-1));
  await run(['party leave sela']);
  ok('leave a member who is not one: a warning', hasWarn('"sela" is not in the party'), warned.slice(-1));
}

begin('party: staging a member, the menu, heal, background');
{
  const { g, r, run, npc, barks } = partyRunner();
  await run(['party join sela']);
  const m = g.party.find('sela');
  ok('_npc / _actor find the member first; _villager the level\'s villager', r._npc('sela') === m && r._actor('Sela') === m && r._npc('sela-actor') === m && r._villager('sela') === npc('sela'));
  await run(['bark sela Lead on!', 'emote sela !', 'face sela left', 'teleport sela 6 6']);
  eq('bark, face, teleport: the member', [barks, m.sprite.dir, [m.position.x, m.position.z]], [['sela:Lead on!'], 'left', [6, 6]]);
  const walk = r._exec({ kind: 'test', key: 'test:walk', nodes: parseScript(['walk sela 9 6', 'set walked']).nodes }, { ownBusy: true });
  for (let k = 0; k < 120 && !r.state.get('walked'); k++) { r.update(0.05); await settle(1); }
  await walk;
  ok('walk: the member walks there and is given back to the follow after the run', Math.hypot(m.position.x - 9, m.position.z - 6) < 0.4 && !m.directed && r.state.get('walked') === 1, [m.position, m.directed]);
  // home: nothing for a member
  await run(['home sela 2 2']);
  ok('home on a member: a warning, no home kept', hasWarn('"sela" is in the party') && !Object.keys(r.state.levelMemory('here').homes).length);
  // the menu: opens on the member, the run waits until it closes
  let closed = 0;
  g.ui.dialog.isHeld = true;
  g.ui.dialog.close = () => { closed++; g.ui.dialog.isHeld = false; };
  const menu = r._exec({ kind: 'test', key: 'test:menu', nodes: parseScript(['Sela: Your orders?', 'party menu sela', 'set after-menu']).nodes }, { ownBusy: true });
  await settle();
  r.update(0.016);
  await settle();
  ok('menu: opens on the member (its id), closes the held window first', g.party.calls.at(-1)?.[0] === 'menu' && g.party.calls.at(-1)?.[1] === 'sela' && closed >= 1 && g.party.menuOpen, g.party.calls.at(-1));
  ok('… the run waits while it is open', r.state.get('after-menu') === 0 && r.run?.key === 'test:menu');
  g.party.menuOpen = false;
  r.update(0.016);
  await menu;
  ok('… and goes on once it closed (frame-polled)', r.state.get('after-menu') === 1 && !r.run);
  g.ui.dialog.close = () => {};
  r.hooks.auto(true);
  const before = g.party.calls.length;
  await run(['party menu', 'set auto-menu']);
  ok('menu with `auto` (tests answer for the player): nothing opens, the run goes on', g.party.calls.length === before && r.state.get('auto-menu') === 1);
  r.hooks.auto(false);
  // heal: the members too
  let pcRefills = 0;
  let allies = 0;
  g.combat = { pc: { refill() { pcRefills++; } }, healAllies() { allies++; }, applyPresence() {}, onTeleport() {}, rebuildNav() {} };
  await run(['heal']);
  eq('heal: the player and the combat\'s allies (healAllies)', [pcRefills, allies, m.combat.refills], [1, 1, 0]);
  delete g.combat.healAllies;
  await run(['heal']);
  eq('… without healAllies: each member\'s refill', [pcRefills, m.combat.refills], [2, 1]);
  g.combat = null;
  // background: rule / set / join / leave may run there, menu ends the run with an error
  const errs = r.errors;
  r._enqueueBg({ kind: 'event', key: 'event:here.bg', nodes: parseScript(['party rule sela hunter', 'bark sela On it.', 'party menu sela', 'set never']).nodes, onceKey: '' });
  for (let k = 0; k < 3; k++) { r.update(0.016); await settle(); }
  ok('a background run: party rule works beside play, party menu is an error that ends it', g.party.find('sela').record.rule.target === 'ranged' && r.errors === errs + 1 && r.state.get('never') === 0
    && warned.some((w) => w.includes('event:here.bg') && w.includes('tactics panel')), warned.slice(-2));
  ok('… quiet only when skipping: a background rule toasts', g.party.calls.find((c) => c[0] === 'rule' && c[2] === 'hunter')?.[3]?.quiet === false);
  // a skipped cutscene: changes still happen, quietly
  const skipped = r._exec({ kind: 'test', key: 'test:skip', nodes: parseScript(['cutscene', 'wait 30', 'party rule sela passive', 'party set sela heal never', 'party menu']).nodes }, { ownBusy: true });
  await settle();
  r.skip();
  await skipped;
  const last = g.party.calls.slice(-2);
  ok('a skipped cutscene: the rule changes still happen (quietly), no panel', g.party.find('sela').record.rule.heal === 'never' && last.every((c) => c[0] !== 'menu' && c.at(-1).quiet === true), last);
  // a party member's walk ends when it leaves; a villager's when it joins
  const walking = r._exec({ kind: 'test', key: 'test:walk2', nodes: parseScript(['walk pip 20 20 nowait', 'party join pip', 'walk sela 20 4 nowait', 'party leave sela', 'set done2']).nodes }, { ownBusy: true });
  await settle();
  await walking;
  ok('join ends the villager\'s walk where it stands, leave the member\'s (not at their goals)', npc('pip').position.x === 4 && npc('pip').position.z === 4 && m.position.x !== 20 && r.state.get('done2') === 1, [npc('pip').position, m.position]);
}

begin('party: talk, visits, a new journey, the save');
{
  const campaign = { hour: () => 9, holdSaves() { this.held = JSON.stringify(g.story.state.toJSON()); }, releaseSaves() { this.held = null; }, save() {}, onStoryChange() {}, state: { visited: [] }, chapterId: () => '', traveling: false, levelId: 'here', held: null };
  const { g, r, run } = partyRunner({ campaign });
  g.levelOf = 'here';
  // atomic runs: a save taken during the run holds the party as it was when it began
  let during = null;
  const atomic = r._exec({ kind: 'test', key: 'test:atomic', nodes: parseScript(['party join sela', 'wait 5', 'set x']).nodes }, { ownBusy: true });
  await settle();
  during = JSON.parse(campaign.held ?? '{}');
  r.skip();
  await atomic;
  ok('a save during a run: the party as it was when the run began', during && !during.party && r.state.party.length === 1, during?.party);
  const m = g.party.find('sela');
  // talk: the villager's own talk script on its level, else its actor's
  eq('talkFor: the level object\'s talk on its level', r.talkFor(m)?.map((x) => x.t), ['say', 'cmd']);
  await r.talk(m);
  eq('talk(member): its villager\'s script, the visit under its actor', [r.state.get('own-talked'), r.state.visitsOf('actor:sela-actor')], [1, 1]);
  // on another level (its villager not there): its actor's talk script
  g.npcById.delete('sela');
  g.level.objects = g.level.objects.filter((o) => o.id !== 'sela');
  eq('talkFor: elsewhere, its actor\'s talk script', r.talkFor(m)?.map((x) => x.t), ['say', 'cmd']);
  await r.talk(m);
  eq('… run with the same visit key', [r.state.get('actor-talked'), r.state.visitsOf('actor:sela-actor')], [1, 2]);
  // a member without an actor or a script: null (the party's conversation); visits under its level
  await run(['party join pip']);
  const pip = g.party.find('pip');
  g.npcById.get('pip').storyTalk = null;
  ok('talkFor: no script → null', r.talkFor(pip) === null);
  eq('visitKey: a member without an actor counts under the level it joined in', r.visitKey(pip), 'here/pip');
  pip.record.level = 'mill';
  eq('… also on another level', r.visitKey(pip), 'mill/pip');
  ok('talkFor: anything else → null', r.talkFor(/** @type {any} */ ({})) === null && r.talkFor(/** @type {any} */ ({ id: 'nobody' })) === null);
  // a new journey: the party follows the new state
  const syncs = g.syncs;
  r.setState(new StoryState(partyStory));
  ok('setState calls game.syncParty', g.syncs === syncs + 1 && r.state.party.length === 0);
}

begin('party: the save (untrusted)');
{
  const s = new StoryState(null);
  ok('a save without members has no party key', !('party' in s.toJSON()));
  const rec = { id: 'sela', name: 'Sela', actor: 'sela-actor', preset: 'guard', spec: { weapon: 'bow', outfit: { top: '#123', style: 'tunic' }, beard: false }, color: '#b07b44', cls: 'ranger', rule: { ...PARTY_PRESETS.support.rule }, level: 'millbrook' };
  s.setParty([rec]);
  const json = JSON.parse(JSON.stringify(s.toJSON()));
  eq('setParty → toJSON → fromJSON: the same records', StoryState.fromJSON(json).party, [rec]);
  /** @type {any} */ (s.party[0].spec).outfit.top = '#fff';
  ok('toJSON copies (a later change does not reach the save)', json.party[0].spec.outfit.top === '#123', json.party[0].spec);
  // through a campaign's save
  const campaign = /** @type {any} */ ({ start: { level: 'a', entrance: '' }, levels: [{ id: 'a' }], flags: [], chapters: [] });
  const cs = new CampaignState(campaign, 'c');
  cs.story.setParty([rec]);
  eq('a campaign\'s save holds the party', CampaignState.fromJSON(campaign, 'c', JSON.parse(JSON.stringify(cs.toJSON()))).story.party.map((x) => x.id), ['sela']);
  // hostile data
  const bad = [
    'nope', null, { id: 3 }, { id: 'a b' }, { id: '' },
    { id: 'ok', name: `Long\u0007${'n'.repeat(100)}`, actor: 'bad actor!', preset: { x: 1 }, spec: JSON.parse('{"weapon":"staff","bad key":1,"constructor":"x","__proto__":{"polluted":1},"nested":{"deep":{"deeper":1}},"arr":[1,2],"fn":"f"}'),
      color: 'red', cls: 'wizard', rule: JSON.parse('{"target":"nearest","heal":"always","__proto__":{"polluted":1},"extra":"x"}'), level: '../x' },
    { id: 'ok', name: 'Duplicate id' },
    { id: 'twin', actor: 'sela-actor' }, { id: 'twin2', actor: 'sela-actor' },
    { id: 'm3' }, { id: 'm4' }, { id: 'm5' },
  ];
  const back = readPartyRecords(bad);
  eq('hostile: bad ids and duplicate ids / actors dropped, at most MAX_PARTY', back.map((x) => x.id), ['ok', 'twin', 'm3'].slice(0, MAX_PARTY));
  const ok0 = back[0];
  ok('… a long name with control characters is cleaned and capped', ok0.name.length === 60 && !/[\u0000-\u001f]/.test(ok0.name), ok0.name);
  eq('… a bad actor, preset, colour, level → the plain ones', [ok0.actor, ok0.preset, ok0.color, ok0.level], ['', 'villager', '#c9a45c', '']);
  eq('… the look: plain values, one level of plain objects; bad keys and values dropped', ok0.spec, { weapon: 'staff', nested: {}, fn: 'f' });
  eq('… an unknown class → by the weapon it carries', ok0.cls, 'mystic');
  eq('… a bad rule field → the default preset\'s, unknown keys dropped', ok0.rule, { ...PARTY_PRESETS.balanced.rule, target: 'nearest' });
  ok('… nothing polluted', /** @type {any} */ ({}).polluted === undefined && !('extra' in ok0.rule));
  const huge = Object.fromEntries(Array.from({ length: 4 }, (_, k) => [`k${k}`, Object.fromEntries(Array.from({ length: 20 }, (_, j) => [`j${j}`, 'x'.repeat(200)]))]));
  eq('hostile: not a list / a look too big / a number out of range', [readPartyRecords({ id: 'x' }), readPartyRecords([{ id: 'big', spec: huge }])[0].spec, readPartyRecords([{ id: 'n', spec: { a: Infinity, b: 2 } }])[0].spec], [[], null, { b: 2 }]);
  ok('hostile: through fromJSON', StoryState.fromJSON({ party: bad }).party.length === Math.min(3, MAX_PARTY) && StoryState.fromJSON({ party: 'x' }).party.length === 0);
  // the reader at boot reads them too
  const st = StoryState.fromJSON({ party: [{ id: 'sela', name: 'Sela Thorn', actor: 'sela-actor' }, { id: 'npc_7', name: 'Mara' }] });
  const read = st.basicReader();
  ok('basicReader: party and party:<id / actor / name>', ['party = 2', 'party:sela', 'party:SELA-ACTOR', 'party:Mara', 'party:npc_7'].every((c) => evalCondition(cachedCondition(c), read))
    && !evalCondition(cachedCondition('party:wren'), read) && !evalCondition(cachedCondition('party:thorn'), read));
}

begin('review fixes: the tactics panel holds the story');
{
  const { g, r, run } = partyRunner();
  // (the game's getter)
  Object.defineProperty(g, 'partyMenuOpen', { get() { return !!g.party?.menuOpen; }, configurable: true });
  await run(['party join sela']);
  g.party.menuOpen = true;
  r.enqueue({ kind: 'event', key: 'event:here.fg', nodes: parseScript(['set fg-ran']).nodes });
  r._enqueueBg({ kind: 'event', key: 'event:here.bg', nodes: parseScript(['set bg-ran']).nodes, onceKey: '' });
  for (let k = 0; k < 3; k++) { r.update(0.016); await settle(); }
  eq('while the tactics panel is open a queued run and a background run wait', [r.state.get('fg-ran'), r.state.get('bg-ran'), r.queue.length, r.bgQueue.length, !!r.run], [0, 0, 1, 1, false]);
  g.party.menuOpen = false;
  for (let k = 0; k < 4; k++) { r.update(0.016); await settle(); }
  eq('… and run once it closed', [r.state.get('fg-ran'), r.state.get('bg-ran')], [1, 1]);
  // a background run already going stands still while the panel is open (its waits too)
  r._enqueueBg({ kind: 'event', key: 'event:here.bg2', nodes: parseScript(['wait 0.5', 'set bg2-ran']).nodes, onceKey: '' });
  r.update(0.016);
  await settle();
  g.party.menuOpen = true;
  for (let k = 0; k < 3; k++) { r.update(1); await settle(); }
  eq('… a background run going on stands still meanwhile', [r.state.get('bg2-ran'), r.bgRuns.length], [0, 1]);
  g.party.menuOpen = false;
  for (let k = 0; k < 3; k++) { r.update(0.3); await settle(); }
  eq('… and goes on after', [r.state.get('bg2-ran'), r.bgRuns.length], [1, 0]);
}

begin('review fixes: a refused join makes no party');
{
  const { g, r, run } = partyRunner();
  await run(['party join ghost', 'party join odo']);
  ok('no villager here, not there as the story stands: warnings, and no party is made', !g.party && g.ensures === 0
    && hasWarn('"ghost" is no villager here — nobody joins') && hasWarn('"odo" is not here as the story stands'), warned.slice(-2));
  // (the story's records hold Sela — a save read before the party was made)
  r.state.setParty([{ id: 'sela', name: 'Sela', actor: 'sela-actor', preset: 'villager', spec: null, color: '#c9a45c', cls: 'warden', rule: ruleOfPreset('balanced'), level: 'here' }]);
  await run(['party join Sela']);
  ok('a member of the records already: a warning, no party made', !g.party && g.ensures === 0 && hasWarn('"Sela" is in the party already'), warned.slice(-1));
  r.state.setParty([]);
  await run(['party join pip']);
  ok('a join that happens makes the party', g.ensures === 1 && g.party?.find('pip') && g.party.count === 1);
}

begin('review fixes: a choice after a block goes on the held line');
{
  const { g, r } = runnerWith([]);
  /** @type {any[][]} */
  const opens = [];
  let skips = 0;
  /** @type {any} a dialog that records what it shows and holds its last line (the player picks `pickNext`) */
  const dlg = {
    isOpen: false, isHeld: false, isChoosing: false, held: null, pickNext: 1,
    get heldLine() { return this.isHeld && this.held ? { ...this.held } : null; },
    open({ lines, hold }) {
      opens.push(lines.map((l) => ({ ...l })));
      this.isHeld = !!hold;
      this.held = lines[lines.length - 1];
      return Promise.resolve(lines.some((l) => l.choices) ? this.pickNext : undefined);
    },
    close() { this.isHeld = false; this.isOpen = false; this.held = null; },
    skip() { skips++; },
  };
  g.ui.dialog = dlg;
  const exec = (lines, key) => r._exec({ kind: 'test', key, nodes: parseScript(lines).nodes }, { ownBusy: true });
  await exec(['set flag', 'if flag', '  Hollis: The bridge is out.', 'else', '  Hollis: Safe travels.', 'choice', '  > Ask why', '    set asked-why', '  > Leave', '    set left'], 'test:held-if');
  const shown = opens.at(-1);
  eq('after an if block: one page, the held line (its speaker, its text) with the options, shown whole (no retyping)', [opens.length, shown.length, shown[0].speaker, shown[0].text, shown[0].choices, skips],
    [2, 1, 'Hollis', 'The bridge is out.', ['Ask why', 'Leave'], 1]);
  eq('… the pick runs its option', [r.state.get('asked-why'), r.state.get('left')], [0, 1]);
  opens.length = 0;
  dlg.pickNext = 0;
  await exec(['cycle turns', '  * Hollis: One.', '  * Hollis: Two.', 'choice', '  > A', '    set a', '  > B'], 'test:held-cycle');
  eq('after a cycle: the same', [opens.length, opens.at(-1)[0].text, opens.at(-1)[0].choices, r.state.get('a')], [2, 'One.', ['A', 'B'], 1]);
  opens.length = 0;
  const skips0 = skips;
  await exec(['choice', '  > A', '  > B'], 'test:no-held');
  eq('no held window: a page of its own with the options (empty text, typed as before)', [opens.length, opens[0][0].text, opens[0][0].choices, skips], [1, '', ['A', 'B'], skips0]);
  opens.length = 0;
  await exec(['Hollis: Hello.', 'choice Which way?', '  > North', '  > South'], 'test:question');
  eq('a choice with its question and lines before it: as before (the question a line of its own)', [opens.length, opens[0].map((l) => l.text), opens[0][1].choices], [1, ['Hello.', 'Which way?'], ['North', 'South']]);
}

begin('runner: translations (I18N.md §4)');
{
  const { g, r, state } = runnerWith([]);
  /** @type {any} a character sheet's canvas (what the dialog crops the portrait from) */
  const SHEET = { sheet: 'pip' };
  const pip = stubNpc('pip', 'Pip');
  pip.def = { portraitColor: '#78b35b' };
  pip.sheet = { canvas: SHEET };
  g.npcs = [pip];
  g.npcById = new Map([['pip', pip]]);
  /** @type {any[][]} */
  const opens = [];
  /** @type {any} a dialog that records its pages and answers `pick` */
  const dlg = {
    isOpen: false, isHeld: false, isChoosing: false, heldLine: null, pick: 0,
    open({ lines }) { opens.push(lines.map((l) => ({ ...l }))); return Promise.resolve(lines.some((l) => l.choices) ? this.pick : undefined); },
    close() {}, skip() {},
  };
  g.ui.dialog = dlg;
  /** @type {string[]} */
  const toasts = [];
  g.ui.hud.toast = (msg) => { toasts.push(msg); };
  setLang('ja');
  // (a version-3 table: units by the GUIDs of the lines' `#line:` tags, names as terms — `Leave` has
  // another translation under another key)
  const K = (/** @type {string} */ s) => guidOf(`runtime-tr:${s}`);
  setContentTables({
    terms: { Pip: 'ピップ', Declared: '約束の依頼', Apple: 'りんご' },
    units: {
      [K('0')]: { source: 'Hello, traveller.', target: 'こんにちは、旅の方。' },
      [K('1')]: { source: 'Which way?', target: 'どちらへ？' },
      [K('2')]: { source: 'Ask about the bridge', target: '橋のことを聞く' },
      [K('3')]: { source: 'Leave', target: '去る' },
      [K('odo')]: { source: 'Leave', target: '立ち去る' },
    },
  });
  const exec = (lines, key) => r._exec({ kind: 'test', key, nodes: r._parse(`test:${key}`, lines, key).nodes }, { ownBusy: true });
  const script = [tagLine('Pip: Hello, traveller.', K('0')), tagLine('choice Which way?', K('1')), tagLine('  > [once] Ask about the bridge', K('2')), '    set asked', tagLine('  > Leave', K('3'))];
  try {
    await exec(script, 'test:tr');
    const page = opens.at(-1) ?? [];
    eq('a say line: the speaker (a term) and the text translated by its key, the villager\'s sheet with it', [page[0]?.speaker, page[0]?.text, page[0]?.sheet === SHEET], ['ピップ', 'こんにちは、旅の方。', true]);
    eq('… the question and each option translated by its own key (another key\'s "Leave" is another translation)', [page.at(-1)?.text, page.at(-1)?.choices], ['どちらへ？', ['橋のことを聞く', '去る']]);
    const trace = r.hooks.trace();
    ok('the trace keeps the source: the option\'s English label, nothing translated', trace.includes('  > Ask about the bridge') && !trace.some((l) => /[぀-ヿ一-鿿]/.test(l)), trace.slice(-6));
    ok('the [once] key holds the English label', state.get('asked') === 1 && [...state.done].some((k) => k.endsWith(':Ask about the bridge')), [...state.done]);
    await exec(script, 'test:tr');
    eq('… so the option chosen once is gone the next time (in any language)', opens.at(-1)?.at(-1)?.choices, ['去る']);
    r.hooks.auto(true);
    await exec(['Pip: Hello, traveller.'], 'test:tr-auto');
    r.hooks.auto(false);
    ok('auto (tests answer, no window): the trace line in the source text', r.hooks.trace().includes('  “Pip: Hello, traveller.”'), r.hooks.trace().slice(-3));
    toasts.length = 0;
    await exec(['quest declared start', 'give apple'], 'test:tr-toasts');
    eq('quest and item toasts: the story strings with the names as terms', toasts, [
      t('story.quest.start', { title: term('Declared') }), t('story.item.received', { item: term('Apple'), n: 1 }),
    ]);
    ok('… in the language (約束の依頼, りんご), the saved quest English', toasts.join('|').includes('約束の依頼') && toasts.join('|').includes('りんご') && r.questTitle('declared') === 'Declared', toasts);
    eq('… and nothing shown untranslated', contentMisses(), []);
  } finally {
    setContentTables(null);
    setLang('en');
  }
}

begin('runner: content keys (I18N.md §4.2)');
{
  // (keys as the data holds them: the GUID of each script line's `#line:` tag, the story files'
  // `textKeys`, an npc object's `textKeys.title` — seeded here so the test reads them back)
  const K = (/** @type {string} */ s) => guidOf(`runtime-keys:${s}`);
  const T = (/** @type {string} */ line, /** @type {string} */ s) => tagLine(line, K(s));
  const { story: keyed } = buildStory([{ name: 'main.json', text: JSON.stringify({
    format: 'luminati-story', version: 1,
    items: { lamp: { name: 'Ferry Lamp', text: 'A lamp for the ferry.', textKeys: { text: K('lamp') } } },
    quests: { ferry: { title: 'The Ferry', text: 'Find the ferryman.', stages: [{ id: 'asked', text: 'Ask in town.' }], goals: [{ text: 'Mend the bridge.' }, { text: 'Bring ${planks} planks.' }],
      textKeys: { text: K('ferry'), stages: { asked: K('asked') }, goals: [K('goal0'), K('goal1')] } } },
    scripts: { greet: [T('Wren: Hello from greet.', 'g0'), T('toast Greeted.', 'g1')] },
    actors: { wren: { name: 'Elder Wren', talk: [T('- Hello, child.', 'w0')] } },
    events: [{ id: 'ford-open', on: 'change', if: 'ford', run: [T('banner The Ford | Open at last', 'b0')] }],
  }) }]);
  const g = stubGame();
  const pipTalk = [T('- Good day.', 'p0'), T('choice Which way?', 'p1'), T('  > North', 'p2'), T('  > South', 'p3')];
  const pipObj = { type: 'npc', id: 'pip', name: 'Pip', title: 'Ferry Boy', talk: pipTalk, textKeys: { title: K('title') } };
  const pip = stubNpc('pip', 'Pip');
  pip.storyObj = pipObj;
  pip.def = { portraitColor: '#78b35b' };
  const wren = stubNpc('wren', 'Elder Wren');
  wren.storyObj = { type: 'npc', id: 'wren', name: 'Elder Wren', actor: 'wren' };
  // (a villager whose level object gives no name: the game shows the default 'Villager')
  const anon = stubNpc('anon', 'Villager');
  anon.storyObj = { type: 'npc', id: 'anon', name: '', talk: [T('- Hm.', 'anon0')] };
  g.npcs = [pip, wren, anon];
  g.npcById = new Map(g.npcs.map((n) => [n.id, n]));
  const evRun = [T('Pip: Hello.', 'a0'), 'call greet', 'quest errand start Fetch Water', T('quest errand stage s1 Found ${n} planks.', 'a1'), T('quest errand stage s2 Crossed the river.', 'a2'), 'quest ferry stage asked', 'give lamp'];
  g.level.objects = [pipObj, ev('ev_a', { on: 'enter', run: evRun }), ev('ev_end', { on: 'enter', run: ['ending good'] }), ev('ev_end2', { on: 'enter', run: [T('ending best Lanterns Home', 'end2')] }), ev('ev_use', { on: 'use', label: 'Ring the bell', run: ['toast Rung.'] })];
  const r = new StoryRunner({ game: g, story: keyed, state: new StoryState(keyed), levelId: 'millbrook' });
  r.attachLevel('millbrook');
  const le = (id) => r.events.find((e) => e.obj.id === id);

  // the keys: each line's tag, as the parser puts it on the node
  eq('an event\'s run: each text line\'s tag is its key (a call, a quest start\'s title — a term — and a stage without text have none)', le('ev_a').nodes.map((n) => n.tk), [K('a0'), undefined, undefined, K('a1'), K('a2'), undefined, undefined]);
  const a = pip.storyTalk;
  eq('a villager\'s talk: the line, the question and each option by their tags', [a[0].tk, a[1].tk, a[1].options.map((o) => o.tk)], [K('p0'), K('p1'), [K('p2'), K('p3')]]);
  eq('… the texts without their tags (the label, the [once] key and the trace read the English)', [a[0].text, a[1].text, a[1].options.map((o) => o.label)], ['Good day.', 'Which way?', ['North', 'South']]);
  eq('an actor\'s inline talk: its line\'s tag', wren.storyTalk?.[0]?.tk, K('w0'));
  eq('a story script: its lines\' tags', r._script('greet').nodes.map((n) => n.tk), [K('g0'), K('g1')]);
  eq('a story event\'s inline run: a banner\'s tag, its subtitle <tag>.2', r._script('event.ford-open').nodes[0].tks, [K('b0'), `${K('b0')}.2`]);
  const prompt = g.world.interactables.find((i) => i.id === 'event:ev_use');
  eq('a Space event\'s prompt: its label as written (an identity) and its object (whose key the prompt shows), no scope', [prompt?.label, prompt?.object?.id, prompt && 'textScope' in prompt], ['Ring the bell', 'ev_use', false]);

  // the parse cache keys on the text (tags included)
  r.detachLevel();
  pip.storyObj = { ...pipObj, talk: [...pipTalk] };
  r.attachLevel('millbrook');
  ok('a chapter variant with the same lines (the same tags): the same parse, the same keys', pip.storyTalk === a && a[0].tk === K('p0'));
  r.detachLevel();
  const variantTalk = [T('- Good evening.', 'v0'), T('choice Which way now?', 'v1'), T('  > North', 'p2'), T('  > South', 'p3')];
  const variant = { ...pipObj, talk: variantTalk };
  pip.storyObj = variant;
  r.attachLevel('millbrook');
  const b = pip.storyTalk;
  ok('a variant whose lines were edited (new tags): a parse of its own with its own keys, the lines it kept with theirs', b !== a && b[0].tk === K('v0') && b[1].tk === K('v1') && b[1].options[0].tk === K('p2'), [b[0].tk, b[1].tk]);
  eq('… and the first parse keeps its keys', [a[0].tk, a[1].options[1].tk], [K('p0'), K('p3')]);
  r.detachLevel();
  pip.storyObj = { ...pipObj, talk: ['- Good day.', 'choice Which way?', '  > North', '  > South'] };
  r.attachLevel('millbrook');
  ok('lines without tags (a level from before keys): no keys, a parse of its own', pip.storyTalk !== a && pip.storyTalk[0].tk === undefined && pip.storyTalk[1].options[0].tk === undefined);
  r.detachLevel();
  pip.storyObj = pipObj;
  r.attachLevel('millbrook');
  ok('back to the first lines: the cached parse', pip.storyTalk === a);

  // what the player reads, in Japanese
  /** @type {any[][]} */
  const opens = [];
  g.ui.dialog = {
    isOpen: false, isHeld: false, isChoosing: false, heldLine: null,
    open({ lines }) { opens.push(lines.map((l) => ({ ...l }))); return Promise.resolve(lines.some((l) => l.choices) ? 0 : undefined); },
    close() {}, skip() {},
  };
  /** @type {string[]} */
  const toasts = [];
  g.ui.hud.toast = (msg) => { toasts.push(msg); };
  /** @type {any[]} */
  const banners = [];
  g.ui.banner = { show(title, sub) { banners.push([title, sub]); } };
  /** @type {any[]} */
  const cards = [];
  g.ui.endCard = { show(o) { cards.push(o); return Promise.resolve(); } };
  g.returnToTitle = () => {};
  registerCoreStrings();
  setLang('ja');
  const units = {
    [K('p0')]: { source: 'Good day.', target: 'こんにちは。' },
    [K('p1')]: { source: 'Which way?', target: 'どっち？' },
    [K('p2')]: { source: 'North', target: '北' },
    [K('p3')]: { source: 'South', target: '南' },
    [K('title')]: { source: 'Ferry Boy', target: '渡し守の子' },
    [K('anon0')]: { source: 'Hm.', target: 'ふむ。' },
    [K('a0')]: { source: 'Hello.', target: 'やあ。' },
    [K('a1')]: { source: 'Found ${n} planks.', target: '板を${n}枚見つけた。' },
    [K('a2')]: { source: 'Crossed the river.', target: '川を渡った。' },
    [K('end2')]: { source: 'Lanterns Home', target: '灯の帰る家' },
    [K('g0')]: { source: 'Hello from greet.', target: 'グリートから、こんにちは。' },
    [K('g1')]: { source: 'Greeted.', target: '挨拶した。' },
    [K('w0')]: { source: 'Hello, child.', target: 'やあ、子よ。' },
    [K('b0')]: { source: 'The Ford', target: '浅瀬' },
    [`${K('b0')}.2`]: { source: 'Open at last', target: 'ついに開いた' },
    [K('ferry')]: { source: 'Find the ferryman.', target: '渡し守を探せ。' },
    [K('asked')]: { source: 'Ask in town.', target: '町で尋ねる。' },
    [K('goal0')]: { source: 'Mend the bridge.', target: '橋を直す。' },
    [K('goal1')]: { source: 'Bring ${planks} planks.', target: '板を${planks}枚持ってくる。' },
    [K('lamp')]: { source: 'A lamp for the ferry.', target: '渡しのためのランプ。' },
  };
  const terms = { Pip: 'ピップ', 'Elder Wren': 'レン長老', 'Fetch Water': '水くみ', 'The Ferry': '渡し舟', 'Ferry Lamp': '渡しのランプ', Test: 'テスト' };
  setContentTables({ terms, units });
  try {
    await r.talk(pip);
    const page = opens.at(-1) ?? [];
    eq('a talk: the plate a term, the title by the key its object holds, the line, the question and the options by their tags', [page[0]?.speaker, page[0]?.title, page[0]?.text, page.at(-1)?.text, page.at(-1)?.choices], ['ピップ', '渡し守の子', 'こんにちは。', 'どっち？', ['北', '南']]);
    await r.talk(anon);
    eq('a villager without a name: the UI\'s default (game.default.villager), its line by its key', [opens.at(-1)?.[0]?.speaker, opens.at(-1)?.[0]?.text], [t('game.default.villager'), 'ふむ。']);
    ok('… which reads 村人', t('game.default.villager') === '村人', t('game.default.villager'));
    await r.talk(wren);
    eq('an actor\'s talk: its script\'s key', opens.at(-1)?.[0]?.text, 'やあ、子よ。');
    r.state.setVar('n', 3);
    r.state.setVar('planks', 2);
    opens.length = 0;
    toasts.length = 0;
    await r._exec({ kind: 'event', key: 'event:millbrook.ev_a', nodes: le('ev_a').nodes }, { ownBusy: true });
    eq('an event: its line by its key; a `call`ed script keeps its own keys (speaker: the villager by actor, a term)', opens.map((p) => p.map((l) => [l.speaker, l.text])), [[['ピップ', 'やあ。']], [['レン長老', 'グリートから、こんにちは。']]]);
    eq('… the called script\'s toast, the quest and item toasts (names as terms)', toasts, ['挨拶した。', t('story.quest.start', { title: '水くみ' }), t('story.quest.stage', { title: '水くみ' }), t('story.quest.stage', { title: '水くみ' }), t('story.quest.start', { title: '渡し舟' }), t('story.item.received', { item: '渡しのランプ', n: 1 })]);
    const q = r.state.quest('errand');
    eq('a script\'s stage texts: saved in English (values filled in), with the line\'s GUID and the English before the values beside them', [q.texts.s1, q.keys.s1, q.src.s1, q.texts.s2, q.keys.s2, q.src.s2, q.title], ['Found 3 planks.', K('a1'), 'Found ${n} planks.', 'Crossed the river.', K('a2'), 'Crossed the river.', 'Fetch Water']);
    const j = r.journalData();
    const errand = j.quests.find((x) => x.id === 'errand');
    const ferry = j.quests.find((x) => x.id === 'ferry');
    eq('the journal: a script\'s quest — its title a term, a stage text with values as saved (English), one without by its key', [errand?.title, errand?.log], ['水くみ', ['Found 3 planks.', '川を渡った。']]);
    eq('… a declared quest: text, stage and goals by the keys the story file holds (goal values filled in after)', [ferry?.title, ferry?.text, ferry?.log, ferry?.goals.map((x) => x.text)], ['渡し舟', '渡し守を探せ。', ['町で尋ねる。'], ['橋を直す。', '板を2枚持ってくる。']]);
    eq('… an item: its name a term, its text by its key', j.items.map((i) => [i.name, i.text]), [['渡しのランプ', '渡しのためのランプ。']]);
    eq('… and nothing shown untranslated (the text with values is no miss)', contentMisses(), []);
    // a banner (a story event's run), an ending with and without a title
    await r._exec({ kind: 'story', key: 'story:ford-open', nodes: r._script('event.ford-open').nodes }, { ownBusy: true });
    eq('a banner: title and subtitle by their two keys (the tag and <tag>.2)', banners.at(-1), ['浅瀬', 'ついに開いた']);
    await r._exec({ kind: 'event', key: 'event:millbrook.ev_end', nodes: le('ev_end').nodes }, { ownBusy: true });
    eq('an ending without a title: the UI\'s default (story.ending.default), the level\'s name a term', cards.at(-1), { title: 'おわり', subtitle: 'テスト' });
    await r._exec({ kind: 'event', key: 'event:millbrook.ev_end2', nodes: le('ev_end2').nodes }, { ownBusy: true });
    eq('an ending\'s title by its key', cards.at(-1)?.title, '灯の帰る家');
    // an ad-hoc script (`__game.story.run`: lines without tags) — no key: its English, a nokey miss
    opens.length = 0;
    await r._exec({ kind: 'test', key: 'test:adhoc', nodes: parseScript(['Pip: Hello.', 'Pip: Not in any table.']).nodes }, { ownBusy: true });
    eq('an ad-hoc line: no key, its English — never found by the English, though a unit translates it', opens[0]?.map((l) => l.text), ['Hello.', 'Not in any table.']);
    eq('… each a nokey miss', contentMisses().map((m) => `${m.source} ${m.why}`), ['Hello. nokey', 'Not in any table. nokey']);
    clearContentMisses();
    // a variant's file: the lines it kept share their keys (and translations), an edited line has
    // its own key — a miss until it is translated, never the base line's translation
    r.detachLevel();
    pip.storyObj = variant;
    r.attachLevel('millbrook');
    setContentTables({ terms, units: { ...units, [K('v0')]: { source: 'Good evening.', target: 'こんばんは。' } } });
    await r.talk(pip);
    eq('a chapter variant\'s talk: its own line\'s translation, the lines it kept translated as the base\'s', [opens.at(-1)?.[0]?.text, opens.at(-1)?.[0]?.title, opens.at(-1)?.at(-1)?.choices], ['こんばんは。', '渡し守の子', ['北', '南']]);
    eq('… its edited line with no unit: shown in English, a miss under its own key', [opens.at(-1)?.at(-1)?.text, contentMisses().map((m) => `${m.key} ${m.why}`)], ['Which way now?', [`${K('v1')} missing`]]);
    // a key whose unit records other English (a line edited by hand, its tag kept): stale
    r.detachLevel();
    pip.storyObj = { ...pipObj, talk: [T('- Good day to you.', 'p0'), ...pipTalk.slice(1)] };
    r.attachLevel('millbrook');
    setContentTables({ terms, units });
    await r.talk(pip);
    eq('a line edited with its tag kept: its English, a stale miss under its key', [opens.at(-1)?.[0]?.text, contentMisses().map((m) => `${m.key} ${m.why}`)], ['Good day to you.', [`${K('p0')} stale`]]);
    r.detachLevel();
    pip.storyObj = pipObj;
    r.attachLevel('millbrook');
    // the save: keys and English kept, read back; a save without them loads
    const saved = JSON.parse(JSON.stringify(r.state.toJSON()));
    eq('the save holds the stage keys (GUIDs) and English beside the texts', [saved.quests.errand.keys, saved.quests.errand.src], [{ s1: K('a1'), s2: K('a2') }, { s1: 'Found ${n} planks.', s2: 'Crossed the river.' }]);
    ok('… a quest without a script\'s stage text saves none', !('keys' in saved.quests.ferry) && !('src' in saved.quests.ferry), saved.quests.ferry);
    const back = StoryState.fromJSON(saved, keyed);
    eq('… read back', [back.quest('errand').keys.s2, back.quest('errand').src.s1], [K('a2'), 'Found ${n} planks.']);
    r.setState(back);
    setContentTables({ terms, units });
    eq('… the journal after a reload: the same', r.journalData().quests.find((x) => x.id === 'errand')?.log, ['Found 3 planks.', '川を渡った。']);
    const bare = StoryState.fromJSON({ quests: { errand: { state: 'active', stage: 's2', log: ['s1', 's2'], title: 'Fetch Water', texts: { s1: 'Found 3 planks.', s2: 'Crossed the river.' } } } }, keyed);
    eq('a save of stage texts without keys loads (no keys, no English beside)', [bare.quest('errand').texts.s2, Object.keys(bare.quest('errand').keys ?? {}), JSON.parse(JSON.stringify(bare.toJSON())).quests.errand], ['Crossed the river.', [], { state: 'active', stage: 's2', log: ['s1', 's2'], title: 'Fetch Water', texts: { s1: 'Found 3 planks.', s2: 'Crossed the river.' } }]);
    r.setState(bare);
    eq('… its stage texts in English (no key), each a nokey miss', [r.journalData().quests.find((x) => x.id === 'errand')?.log, contentMisses().map((m) => `${m.source} ${m.why}`)], [['Found 3 planks.', 'Crossed the river.'], ['Found 3 planks. nokey', 'Crossed the river. nokey']]);
    clearContentMisses();
    const noGuid = StoryState.fromJSON({ quests: { errand: { state: 'active', stage: 's2', log: ['s1', 's2'], title: 'Fetch Water', texts: { s1: 'Found 3 planks.', s2: 'Crossed the river.' },
      keys: { s1: 'millbrook:ev_a.run#1', s2: 'millbrook:ev_a.run#2' }, src: { s1: 'Found ${n} planks.', s2: 'Crossed the river.' } } } }, keyed);
    eq('a save whose stage keys are no GUIDs: the keys dropped with their English, the texts kept', [Object.keys(noGuid.quest('errand').keys), Object.keys(noGuid.quest('errand').src), noGuid.quest('errand').texts.s2], [[], [], 'Crossed the river.']);
    r.setState(noGuid);
    eq('… its stage texts in English (no key), each a nokey miss', [r.journalData().quests.find((x) => x.id === 'errand')?.log, contentMisses().map((m) => `${m.source} ${m.why}`)], [['Found 3 planks.', 'Crossed the river.'], ['Found 3 planks. nokey', 'Crossed the river. nokey']]);
    clearContentMisses();
    const odd = StoryState.fromJSON({ quests: { errand: { state: 'active', stage: 's2', log: ['s2'], texts: { s2: 'Crossed.', s3: 'x' }, keys: { s2: K('x2'), s3: K('x3'), s4: K('x4'), s5: 7 }, src: { s3: 'x', s4: 'y' } } } });
    eq('an untrusted save: a key kept only with its English and a text (else dropped)', [Object.keys(odd.quest('errand').keys), Object.keys(odd.quest('errand').src)], [['s3'], ['s3']]);
    const long = StoryState.fromJSON({ quests: { e: { texts: { s: 'a' }, keys: { s: 'k'.repeat(2001) }, src: { s: 'a' } } } });
    eq('… a key too long to be one is dropped, never cut', Object.keys(long.quest('e').keys), []);
    const low = StoryState.fromJSON({ quests: { e: { texts: { s: 'a' }, keys: { s: K('lc').toLowerCase() }, src: { s: 'a' } } } });
    eq('… a key that is no GUID (lower case) is dropped', Object.keys(low.quest('e').keys), []);
    const st = new StoryState(null);
    st.questChange('w', 'stage', { stage: 's', text: 'Keyed.', key: K('w1'), src: 'Keyed.' });
    eq('a stage text given with its line\'s GUID keeps it', [st.quest('w').keys.s, st.quest('w').src.s], [K('w1'), 'Keyed.']);
    st.questChange('w', 'stage', { stage: 's', text: 'Ad hoc.' });
    eq('a stage text given again without a key drops the old key', [st.quest('w').texts.s, Object.keys(st.quest('w').keys)], ['Ad hoc.', []]);
    st.questChange('w', 'stage', { stage: 's', text: 'Old.', key: 'k#0', src: 'Old.' });
    eq('… a key that is no GUID is not kept', [st.quest('w').texts.s, Object.keys(st.quest('w').keys)], ['Old.', []]);
  } finally {
    setContentTables(null);
    setLang('en');
  }
  // English: the same texts as before keys (no table: loc and term give the English)
  opens.length = 0;
  r.setState(new StoryState(keyed));
  r.detachLevel();
  r.attachLevel('millbrook');
  await r.talk(pip);
  eq('English: the plate, the title, the line and the options as written (no tag shown)', [opens.at(-1)?.[0]?.speaker, opens.at(-1)?.[0]?.title, opens.at(-1)?.[0]?.text, opens.at(-1)?.at(-1)?.choices], ['Pip', 'Ferry Boy', 'Good day.', ['North', 'South']]);
  await r._exec({ kind: 'event', key: 'event:millbrook.ev_end', nodes: le('ev_end').nodes }, { ownBusy: true });
  eq('English: an ending without a title reads The End', cards.at(-1), { title: 'The End', subtitle: 'Test' });
  await r.talk(anon);
  eq('English: a villager without a name reads Villager', opens.at(-1)?.[0]?.speaker, 'Villager');
}

begin('review fixes: what no window shows records no miss (I18N.md §4.2)');
{
  const K = (/** @type {string} */ s) => guidOf(`runtime-unseen:${s}`);
  const T = (/** @type {string} */ line, /** @type {string} */ s) => tagLine(line, K(s));
  const g = stubGame();
  const pip = stubNpc('pip', 'Pip');
  pip.storyObj = { type: 'npc', id: 'pip', name: 'Pip', title: 'Ferry Boy', textKeys: { title: K('title') } };
  pip.def = { portraitColor: '#78b35b' };
  g.npcs = [pip];
  g.npcById = new Map([['pip', pip]]);
  /** @type {any[][]} */
  const opens = [];
  g.ui.dialog = {
    isOpen: false, isHeld: false, isChoosing: false, heldLine: null,
    open({ lines }) { opens.push(lines.map((l) => ({ ...l }))); return Promise.resolve(lines.some((l) => l.choices) ? 1 : undefined); },
    close() {}, skip() {},
  };
  /** @type {string[]} */
  const toasts = [];
  g.ui.hud.toast = (msg) => { toasts.push(msg); };
  /** @type {any[]} */
  const barks = [];
  g.ui.emotes = { bark(_s, text) { barks.push(text); return 2; }, show() {}, clear() {} };
  const r = new StoryRunner({ game: g, story, state: new StoryState(story), levelId: 'here' });
  r.attachLevel('here');
  const nodes = (lines, key) => r._parse(`test:${key}`, lines, key).nodes;
  const misses = () => contentMisses().map((m) => (m.key ? `${m.key} ${m.why}` : `${m.why} ${m.name ?? m.source}`)).sort();
  const want = (/** @type {string[]} */ list) => [...list].sort();
  // (a table with nothing these lines need: every lookup of a shown text is a miss)
  registerCoreStrings();
  setLang('ja');
  setContentTables({ terms: { Unrelated: '無関係' } });
  try {
    // a cutscene skipped while it waits: the lines after it are passed over (c0 c1 the says, c2 the
    // banner, c4 the bark); only the page that asks shows (c5 the question — no speaker: the item
    // given ends the batch before it —, c6 c7 the options)
    const cut = ['cutscene', 'wait 5', T('Pip: A line nobody reads.', 'c0'), T('Pip: Nor this one.', 'c1'), T('banner The Ford | Open', 'c2'), T('bark pip Psst.', 'c4'), 'give ferry-lamp', T('choice Which way?', 'c5'), T('  > North', 'c6'), T('  > South', 'c7'), '    set south'];
    const done = r._exec({ kind: 'test', key: 'test:cut', nodes: nodes(cut, 'cut') }, { ownBusy: true });
    await settle(2);
    ok('the skip takes (the run waits)', r.skip());
    await done;
    eq('skipped: one page opens, the question with its options', [opens.length, opens[0]?.map((l) => [l.text, l.choices ?? null])], [1, [['Which way?', ['North', 'South']]]]);
    ok('… the answer runs', r.state.get('south') === 1);
    eq('… nothing passed over is missed: only the asking page (the question, the options)', misses(), want([`${K('c5')} missing`, `${K('c6')} missing`, `${K('c7')} missing`]));
    ok('… no bark, banner or item toast shown', !barks.length && !toasts.length, [barks, toasts]);
    // a choice without a question after lines: the batch's last line asks — it alone is shown
    setContentTables({ terms: { Unrelated: '無関係' } });
    opens.length = 0;
    const done3 = r._exec({ kind: 'test', key: 'test:cut3', nodes: nodes(['cutscene', 'wait 5', T('Pip: Passed over.', 'd0'), T('Pip: The asking line.', 'd1'), 'choice', T('  > Yes', 'd3'), T('  > No', 'd4')], 'cut3') }, { ownBusy: true });
    await settle(2);
    r.skip();
    await done3;
    eq('skipped, the last line asks: that page only', opens.map((p) => p.map((l) => [l.speaker, l.text, l.choices ?? null])), [[['Pip', 'The asking line.', ['Yes', 'No']]]]);
    eq('… its misses (plate, title, the line, the options — the question is blank), not the line passed over', misses(), want([`${K('d1')} missing`, `${K('d3')} missing`, `${K('d4')} missing`, `${K('title')} missing`, 'term Pip']));
    // a skipped cutscene with no choice: nothing shows, nothing is missed
    setContentTables({ terms: { Unrelated: '無関係' } });
    opens.length = 0;
    const done2 = r._exec({ kind: 'test', key: 'test:cut2', nodes: nodes(['cutscene', 'wait 5', T('Pip: Passed over.', 'e0'), 'give ferry-lamp'], 'cut2') }, { ownBusy: true });
    await settle(2);
    r.skip();
    await done2;
    eq('skipped, no choice: no page, no miss (the item toast\'s name not looked up)', [opens.length, misses()], [0, []]);
    // tests answering for the player (`auto`): no window, no miss — the trace in the source text
    r.hooks.auto([1]);
    await r._exec({ kind: 'test', key: 'test:auto', nodes: nodes([T('Pip: Unseen in tests.', 'f0'), T('choice Pick?', 'f1'), T('  > A', 'f2'), T('  > B', 'f3'), '    set picked'], 'auto') }, { ownBusy: true });
    r.hooks.auto(false);
    eq('auto: no page, the answer given, no miss', [opens.length, r.state.get('picked'), misses()], [0, 1, []]);
    ok('… the trace keeps the line (without its tag)', r.hooks.trace().includes('  “Pip: Unseen in tests.”'), r.hooks.trace().slice(-4));
    // the same lines shown: their misses are recorded
    await r._exec({ kind: 'test', key: 'test:shown', nodes: nodes([T('Pip: Now it shows.', 's0')], 'shown') }, { ownBusy: true });
    eq('shown: its misses are recorded', [opens.length, misses()], [1, want([`${K('s0')} missing`, `${K('title')} missing`, 'term Pip'])]);
  } finally {
    setContentTables(null);
    setLang('en');
  }
}

begin('review fixes: parse errors reported once per script text');
{
  const g = stubGame();
  const broken = [tagLine('- Hello.', guidOf('runtime-errors:0')), 'glimmer the moon'];
  const pip = stubNpc('pip', 'Pip');
  pip.storyObj = { type: 'npc', id: 'pip', name: 'Pip', talk: broken };
  g.npcs = [pip];
  g.npcById = new Map([['pip', pip]]);
  warned.length = 0;
  const r = new StoryRunner({ game: g, story, state: new StoryState(story), levelId: 'millbrook' });
  r.attachLevel('millbrook');
  const first = pip.storyTalk;
  eq('a broken talk: its error counted and warned once', [r.errors, warned.filter((w) => w.includes('glimmer')).length], [1, 1]);
  ok('… its line keeps its tag\'s key', first[0].tk === guidOf('runtime-errors:0'), first[0]?.tk);
  // its chapter variant's file with the same lines: the same parse, not counted or warned again
  r.detachLevel();
  pip.storyObj = { ...pip.storyObj, talk: [...broken] };
  r.attachLevel('millbrook');
  ok('the variant (the same text, its own file): the same parse', pip.storyTalk === first);
  eq('… its errors not counted or warned again (state().story.errors as before keys)', [r.errors, r.info().errors, warned.filter((w) => w.includes('glimmer')).length], [1, 1, 1]);
  r.detachLevel();
  r.attachLevel('millbrook');
  eq('attached again: nothing again', [r.errors, warned.filter((w) => w.includes('glimmer')).length], [1, 1]);
  // another text (an edit, another villager's talk): its errors are its own
  r.detachLevel();
  pip.storyObj = { ...pip.storyObj, talk: [...broken, 'set'] };
  r.attachLevel('millbrook');
  eq('another text: its errors reported', [r.errors, warned.filter((w) => w.includes('glimmer')).length, hasWarn('set <flag>')], [3, 2, true]);
}

begin('review fixes: a shop item keeps the name it was given by');
{
  const LAMP_KEY = '5A1E0C2B7D9F4E3A8B6C1D2E3F405162';
  const { story: shop } = buildStory([{ name: 'main.json', text: JSON.stringify({
    format: 'luminati-story', version: 1,
    items: { lamp: { name: 'Ferry Lamp', text: 'A lamp for the ferry.', textKeys: { text: LAMP_KEY } } },
  }) }]);
  const g = stubGame();
  /** @type {string[]} */
  const toasts = [];
  g.ui.hud.toast = (msg) => { toasts.push(msg); };
  const r = new StoryRunner({ game: g, story: shop, state: new StoryState(shop), levelId: 'here' });
  r.attachLevel('here');
  eq('giveNamed: an undeclared name → an id made from it, the name kept beside', [r.giveNamed("Ilse's Lantern"), r.state.itemNames['ilse-s-lantern']], [{ id: 'ilse-s-lantern', count: 1 }, "Ilse's Lantern"]);
  eq('… a declared item\'s name → its id, no name kept', [r.giveNamed('ferry lamp'), Object.keys(r.state.itemNames)], [{ id: 'lamp', count: 1 }, ['ilse-s-lantern']]);
  eq('the journal (English): the name given, not the id\'s title case; the declared item its own', r.journalData().items.map((i) => [i.id, i.name]), [['ilse-s-lantern', "Ilse's Lantern"], ['lamp', 'Ferry Lamp']]);
  eq('itemName: the same (the toasts\' name)', [r.itemName('ilse-s-lantern'), r.itemName('lamp'), r.itemName('honey-cake')], ["Ilse's Lantern", 'Ferry Lamp', 'Honey Cake']);
  await r._exec({ kind: 'test', key: 'test:take', nodes: parseScript(['take ilse-s-lantern']).nodes }, { ownBusy: true });
  eq('… a `take` toast names it so', toasts.at(-1), t('story.item.given', { item: "Ilse's Lantern", n: 1 }));
  r.giveNamed("Ilse's Lantern");
  // translated: the name given is the term (what the extractor lists for a shop's item)
  setLang('ja');
  setContentTables({ terms: { "Ilse's Lantern": 'イルゼのランタン', 'Ferry Lamp': '渡しのランプ' }, units: { [LAMP_KEY]: { source: 'A lamp for the ferry.', target: '渡しのためのランプ。' } } });
  try {
    eq('the journal (ja): the given name\'s term, no miss', [r.journalData().items.map((i) => [i.id, i.name]), contentMisses()], [[['lamp', '渡しのランプ'], ['ilse-s-lantern', 'イルゼのランタン']], []]);
  } finally {
    setContentTables(null);
    setLang('en');
  }
  // the save
  const saved = JSON.parse(JSON.stringify(r.state.toJSON()));
  eq('the save holds the names', saved.itemNames, { 'ilse-s-lantern': "Ilse's Lantern" });
  const back = StoryState.fromJSON(saved, shop);
  r.setState(back);
  eq('… read back: the journal the same', r.journalData().items.map((i) => [i.id, i.name]), [['lamp', 'Ferry Lamp'], ['ilse-s-lantern', "Ilse's Lantern"]]);
  ok('a state without names saves none', !('itemNames' in JSON.parse(JSON.stringify(new StoryState(shop).toJSON()))));
  const bare = StoryState.fromJSON({ items: { 'ilse-s-lantern': 1 } }, shop);
  r.setState(bare);
  eq('a save without names loads: the id\'s title case', [Object.keys(bare.itemNames), r.journalData().items.map((i) => i.name)], [[], ['Ilse S Lantern']]);
  const odd = StoryState.fromJSON(JSON.parse(JSON.stringify({ items: { a: 1 }, itemNames: { a: '  Apple\u0007 ', gold: 'Gold', 'a b': 'Bad id', '1e5': 'A number', b: '', c: 7, ['d'.repeat(81)]: 'Long id', e: 'x'.repeat(300) } }).replace('"itemNames":{', '"itemNames":{"__proto__":"x","constructor":"y",')));
  eq('an untrusted save: plain names of item ids kept (control characters out, trimmed, cut at 200), the rest dropped', [Object.keys(odd.itemNames).sort(), odd.itemNames.a, odd.itemNames.e?.length], [['__proto__', 'a', 'constructor', 'e'], 'Apple', 200]);
  ok('… "__proto__" and "constructor" plain keys of a prototype-less map', Object.getPrototypeOf(odd.itemNames) === null && odd.itemNameOf('__proto__') === 'x' && odd.itemNameOf('toString') === '' && odd.itemNameOf('hasOwnProperty') === '');
}

// =================================================================================================
const ms = Math.round(performance.now() - t0);
if (verbose) for (const [name, n] of sections) console.log(`  ${name}: ${n}`);
for (const f of failures) console.log(`  ✗ ${f}`);
console.log(`story runtime self-test: ${passed} passed, ${failures.length} failed (${sections.length} sections, ${ms} ms)`);
process.exit(failures.length ? 1 : 0);
