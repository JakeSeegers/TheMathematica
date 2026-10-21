/**
 * The content-text check of the campaigns, the story and the party (docs/specs/I18N.md §4.8;
 * `sandbox/i18n.campaign.json`): plays them in the page's language through the game's own display —
 * real dialog windows paged with real key presses, never the story's `auto` — and fails on any text
 * the tables could not translate (`window.__luminati.content.misses`, §4.2). It asserts no English
 * text (KNOWN_ISSUES I18N-10): only the misses, and where the story stands (flags, levels, the files played),
 * so the run means something in every language; in English it records no miss and must simply run
 * without a page error.
 *
 *   npm run check -- --page=game.html --query= --out=i18n_campaign --wait=0 --fps=0 --lang=ja --script=sandbox/i18n.campaign.json
 *
 * (`--lang=zh` too; the script navigates itself, so `--query` does not matter.) Its pages:
 *
 * 1. `?campaign=ferrymans-lantern&new=1` — *The Ferryman's Lantern* from its title screen to its
 *    ending: Watchman Bran's warning, the cellar door locked, a tour of Millbrook (sandbox/
 *    i18n_tour.js: every villager three times, every sign, door and well, the prompts of the exits
 *    and events, every region, the world map), the planks searched for (a Space event), Hollis's
 *    cutscene, the time / leave / background events (a toast, barks), the journal on both tabs; the
 *    mill cellar (its tour, the chart read twice: a `call`ed script, `give`), back up the stair; the
 *    Mill Road (the ford sign, the peddler, the barks, the ford cutscene, its tour); the Old Quarry
 *    (its arrival line, the slimes killed: the cleared event, Ilse found: the chapter switch, its
 *    tour); back home to *Millbrook at dusk* (the chapter's variant: its welcome cutscene, its
 *    tour, the shop's Festival Bun, the barks, the journal); last, Ilse's talk to the ending — the
 *    misses checked on its end card — and the title screen again, with its Continue line.
 * 2. `?campaign=emberfall-interiors&autostart=1&new=1` — *Emberfall — Open Doors*: the town's tour,
 *    then every room through its door (the exits used as a player would), each room's tour (its
 *    villagers, the prompts of its custom exit labels — Go upstairs, Go out …, its region, the map)
 *    and back out.
 * 3. `?level=cinderwatch-pass&autostart=1` — the party: Sela (`not yet`, then she joins), her
 *    party frame, the tactics panel (G, then her *Tactics…*), her talks as a member (*Lead on*,
 *    *Part ways* → stay), the two background events that bark and set her rule, then she parts ways.
 *    Then the Waystone Camp's two: Sister Ilse and Rook, each `not yet`, then joining, their talks
 *    as members (*Tactics…*, *Lead on*, *Part ways* → stay; every line of their orders' cycles);
 *    Rook's background event in the Bramble Ruins (his bark, his rule set) and Ilse's on the
 *    caldera stair; Sela joining a party that has members already (her other join line); and a
 *    full party (Pip added by the hook to fill it) turning each of the three away — Ilse, Rook and
 *    Sela each part ways (*Part ways* → *Yes*) and each says the full party's line.
 *
 * Installed by an `eval` step: `await import('/sandbox/i18n_campaign.js')` → `window.CT` (and
 * `window.IT`). A part runs in the page (`CT.go(name)`); `CT.wait()` steps poll it (each under the
 * harness's 180 s protocol limit; a part done answers at once); `CT.check(label)` fails on the
 * misses. `IT.expect` records a failed check and throws it as a page error (the harness exits 1).
 * A part may end with a dialog window or a bark left up (`peek`, `enterBark`) for the script's
 * `shot` step; the next part pages on (`resume`) or waits the bark out (`settle`).
 */
import { IT, press, until, sleep } from './i18n_tour.js';

const G = () => window.__game;
const game = () => window.__game.game;

/** The rooms of Emberfall — Open Doors, in the order the tour walks: [exit used, level reached]. */
const ROOMS_ROUTE = [
  ['door_inn', 'inn'], ['exit_stairs', 'inn-upstairs'], ['exit_stairs', 'inn'], ['exit_out', 'emberfall'],
  ['door_windmill', 'windmill'], ['exit_stairs', 'windmill-upper'], ['exit_stairs', 'windmill'], ['exit_out', 'emberfall'],
  ['door_barn', 'barn'], ['exit_stairs', 'barn-loft'], ['exit_stairs', 'barn'], ['exit_out', 'emberfall'],
  ['door_elder_house', 'elder-house'], ['exit_out', 'emberfall'],
  ['door_riverside_house', 'riverside-house'], ['exit_out', 'emberfall'],
  ['door_thatch_cottage', 'thatch-cottage'], ['exit_out', 'emberfall'],
  ['door_lodge', 'lodge'], ['exit_out', 'emberfall'],
];

const CT = {
  suite: 'i18n.campaign',
  /** The part running or last run. */
  name: '',
  done: true,
  /** @type {string|null} */
  error: null,
  step: '',
  /** Each part's summary. @type {Record<string, unknown>} */
  results: {},
  /** What each part did, step by step (for the report). @type {unknown[]} */
  trail: [],
  /** Rook's rule before the Bramble Ruins' event (`rule`). @type {string|null} */
  ruleBefore: null,

  /** @param {unknown} ok @param {string} label */
  expect(ok, label) { return IT.expect(ok, label); },

  /**
   * Start a part in the page (the harness polls it with `wait`).
   * @param {'ferryTitle'|'millbrook'|'cellar'|'millRoad'|'quarry'|'dusk'|'ending'|'titleAgain'|'rooms'|'party'
   *   |'camp'|'campTalks'|'ruins'|'caldera'|'selaJoins'|'fullIlse'|'fullOthers'} name
   */
  go(name) {
    if (!CT.done) return `busy with ${CT.name}`;
    CT.name = name;
    CT.done = false;
    CT.error = null;
    CT.step = '';
    CT[name]().then((r) => { CT.results[name] = r; }, (err) => {
      CT.error = String(err?.stack ?? err);
      CT.expect(false, `${name} ran without an error: ${CT.error}`);
    }).finally(() => { CT.done = true; });
    return `started ${name}`;
  },

  /** Wait for the part (at most `ms`). @param {number} [ms] */
  async wait(ms = 170000) {
    const t0 = performance.now();
    while (!CT.done && performance.now() - t0 < ms) await sleep(250);
    return JSON.stringify({ part: CT.name, done: CT.done, step: CT.step, phase: IT.phase, error: CT.error, result: CT.done ? CT.results[CT.name] : undefined, ...IT.counts() });
  },

  /** @param {string} s */
  note(s) { CT.step = s; CT.trail.push(`${CT.name}: ${s}`); },

  /** The story's values now (flags, items, quests). */
  story() { return G().story?.info() ?? null; },
  /** @param {string} name */
  flag(name) { return (G().story?.get(name) ?? 0) > 0; },
  /** Has a level event run (`once`)? @param {string} id */
  eventDone(id) { return !!G().story?.info().events.find((e) => e.id === id)?.done; },

  /** Until the player is free: no dialog, no story run, no travel, in play. @param {number} [ms] */
  async idle(ms = 30000) {
    const g = game();
    return until(() => {
      const s = G().story?.info();
      return !g.busy && !g.ui.dialog.isOpen && g.mode === 'play' && !G().state().campaign?.traveling && (!s || (!s.running && !s.queued.length));
    }, ms);
  },

  /**
   * Until the campaign has arrived at `level` (in play, the travel over), then what the arrival runs
   * paged through.
   * @param {string} level a base id
   */
  async at(level) {
    const g = game();
    const ok = await until(() => G().state().campaign?.level === level && g.mode === 'play' && !G().state().campaign?.traveling, 60000);
    CT.expect(ok, `the campaign arrives at ${level} (at ${G().state().campaign?.level})`);
    await sleep(700);
    const r = await IT.drain('first', 60000);
    IT.log.startPages += r.pages;
    return ok;
  },

  /** @param {string} id an interactable's id (`exit:<id>`, `event:<id>`, a sign's object id) */
  it(id) { return game().world.interactables.find((i) => i.id === id) ?? null; },

  /**
   * Use an interactable as the player does: in front of it, its prompt read, a confirm press (the
   * game's `_interact` when another interactable is nearer: `forced`); its pages paged through.
   * @param {string} id
   * @param {import('./i18n_tour.js').Answer} [answer]
   */
  async use(id, answer = 'first') {
    const g = game();
    await CT.idle();
    const it = CT.it(id);
    CT.expect(it && !it.disabled, `${id} is there to use`);
    if (!it || it.disabled) return null;
    await until(() => !(/** @type {any} */ (g)._talkCooldown > 0), 3000);
    const own = await IT.faceUp(it);
    if (own) {
      IT.log.prompts++;
      IT.scan();
      await press('Enter');
    } else {
      IT.log.forced++;
      g._interact({ kind: 'object', npc: null, it });
    }
    const r = await IT.drain(answer);
    CT.note(`used ${id}: ${r.pages} page(s)`);
    return { own, ...r };
  },

  /**
   * Talk to a villager (a member too) and page through, answering `answer`.
   * @param {string} id
   * @param {import('./i18n_tour.js').Answer} [answer]
   */
  async talk(id, answer = 'first') {
    const ok = await CT.startTalk(id);
    CT.expect(ok, `talking to ${id} starts (${CT.name})`);
    if (!ok) return null;
    const r = await IT.drain(answer);
    IT.talks.push({ id, visit: 0, answer, ...r });
    IT.log.visits++;
    CT.expect(r.pages > 0 || r.ended, `talking to ${id} shows its pages (${CT.name})`);
    CT.note(`talked to ${id}: ${r.pages} page(s), ${r.choices} choice(s)`);
    return r;
  },

  /**
   * Start a talk to `id` once the player is free (`talkTo`); asked again for a while when refused —
   * a member steps up only while neither the combat nor a story drives it.
   * @param {string} id
   */
  async startTalk(id) {
    await CT.idle();
    let ok = G().talkTo(id);
    for (let k = 0; !ok && k < 40; k++) {
      await sleep(250);
      await CT.idle();
      ok = G().talkTo(id);
    }
    return ok;
  },

  /**
   * Talk to `id` as `talk` does — real keys, the choices answered `picks` in order — but stop with
   * the window open for the script's `shot` step: at the `nth` page shown whole after the last pick,
   * or (`nth` 0) at the first choice after it, its options up. The next part pages on (`resume`).
   * @param {string} id @param {number[]} [picks] @param {number} [nth]
   */
  async peek(id, picks = [], nth = 0) {
    const g = game();
    const d = g.ui.dialog;
    const ok = await CT.startTalk(id);
    CT.expect(ok, `talking to ${id} starts (${CT.name})`);
    if (!ok) return null;
    const left = [...picks];
    let pages = 0, after = 0, choices = 0, held = false, seen = '';
    const t0 = performance.now();
    await until(() => d.isOpen, 3000);
    while (performance.now() - t0 < 60000 && (g.busy || d.isOpen)) {
      if (!d.isOpen) { await sleep(80); continue; }
      const text = d._textEl?.textContent ?? '';
      if (!d.isTyping && text !== seen) { seen = text; pages++; if (!left.length) after++; IT.scan(); }
      if (!left.length && !d.isTyping && (nth > 0 ? after >= nth : d.isChoosing)) { held = true; break; }
      if (d.isChoosing) {
        await sleep(300);
        IT.scan();
        const n = d._choiceEls?.length ?? 0;
        const want = Math.min(n - 1, Math.max(0, left.shift() ?? 0));
        for (let k = 0; k < 2 * n && d._choiceIndex !== want; k++) await press(d._choiceIndex < want ? 'ArrowDown' : 'ArrowUp');
        choices++;
        await press('Enter');
        // (the pick taken before anything else: a slow frame keeps the options up a while)
        await until(() => !d.isChoosing, 3000);
        await sleep(120);
        continue;
      }
      await press('Enter');
      await sleep(60);
    }
    // (the window settles: its options faded in, the layout done)
    await sleep(700);
    IT.scan();
    IT.log.pages += pages;
    IT.log.choices += choices;
    IT.log.visits++;
    CT.expect(held, `talking to ${id}: the window is held open at ${nth ? `page ${nth} after the answers` : 'its choice'} (${CT.name}; ${pages} page(s))`);
    CT.note(`peeked at ${id}: ${pages} page(s), ${choices} choice(s), held ${held}`);
    return { pages, choices, held, choosing: d.isChoosing };
  },

  /**
   * Page on through the window a `peek` left open, answering `answer` (as `talk`).
   * @param {import('./i18n_tour.js').Answer} [answer]
   */
  async resume(answer = 'first') {
    const r = await IT.drain(answer);
    CT.note(`paged on: ${r.pages} page(s), ${r.choices} choice(s)`);
    return r;
  },

  /** Is `id` a member of the party now? @param {string} id */
  member(id) { return !!game().party?.members.some((m) => m.id === id); },
  /** The party's members now, in join order (ids). */
  members() { return game().party?.members.map((m) => m.id) ?? []; },
  /** A member's combat rule now (a copy), or null. @param {string} id */
  rule(id) {
    const m = game().party?.members.find((x) => x.id === id);
    return m ? JSON.stringify(m.record.rule) : null;
  },

  /** Is a bark's bubble up? */
  barkUp() {
    return [...document.querySelectorAll('.lu-emote--bark')].some((el) => {
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0;
    });
  },

  /**
   * Put the player into a background `enter` event's box (from outside it) and wait until its run
   * barks; the bubble is left up for the script's `shot` step (the next part: `settle`).
   * @param {string} id the event @param {number} x @param {number} z
   */
  async enterBark(id, x, z) {
    await CT.idle();
    CT.expect(!CT.eventDone(id), `${id} has not run yet`);
    // (the last bark and an area banner gone first: the screenshot shows this bark alone)
    await until(() => !CT.barkUp() && !(/** @type {any} */ (game().ui).banner?.box), 10000);
    await CT.put(x, z);
    const barked = await until(() => CT.barkUp(), 15000);
    CT.expect(barked, `${id}: the bark shows`);
    await sleep(300);
    IT.scan();
    CT.note(`entered ${id}'s box at (${x}, ${z}): bark ${barked}`);
    return { barked };
  },

  /** Until the background event `id` ran to its end (no background run left). @param {string} id */
  async settle(id) {
    const ok = await until(() => CT.eventDone(id) && !G().story.info().background.length, 20000);
    IT.scan();
    CT.expect(ok, `the background event ${id} ran`);
    return ok;
  },

  /**
   * Run a level event's script (`fire`: whatever its trigger), wait `ms` for what a background run
   * shows (barks), then page through what it shows.
   * @param {string} id @param {number} [ms]
   */
  async fire(id, ms = 1500) {
    await CT.idle();
    const ok = G().story.fire(id);
    CT.expect(ok, `the event ${id} runs`);
    await sleep(ms);
    IT.scan();
    const r = await IT.drain('first', 30000);
    await until(() => !(G().story.info().background.length), 15000);
    CT.note(`fired ${id}: ${r.pages} page(s)`);
    return r;
  },

  /** Put the player at (x, z) — an `enter` event's box, a walk-in exit. @param {number} x @param {number} z */
  async put(x, z) {
    const p = G().teleport(x, z);
    await sleep(500);
    return p;
  },

  /** One level's tour (sandbox/i18n_tour.js), its checks. @param {string} where */
  async tour(where) {
    CT.note(`tour of ${where}`);
    const n0 = { v: IT.log.villagers, i: IT.log.interactables, r: IT.log.regions, p: IT.log.prompts };
    await IT.tour();
    IT.expectVisited(where);
    const out = { where, source: game().source, villagers: IT.log.villagers - n0.v, interactables: IT.log.interactables - n0.i, regions: IT.log.regions - n0.r, prompts: IT.log.prompts - n0.p };
    CT.trail.push(out);
    return out;
  },

  /** The journal opened, every entry of both tabs selected (real keys), closed. */
  async journal() {
    const g = game();
    await CT.idle();
    const open = g.toggleJournal(true);
    CT.expect(open, 'the journal opens');
    await sleep(800);
    IT.scan();
    const j = /** @type {any} */ (g.ui).journal;
    const tabs = [];
    for (let t = 0; t < 2; t++) {
      const n = document.querySelectorAll('.lu-journal__entry').length;
      for (let k = 0; k < n; k++) { await press('ArrowDown'); await sleep(250); IT.scan(); }
      tabs.push({ tab: j?.tab, entries: n });
      await press('KeyE');
      await sleep(500);
      IT.scan();
    }
    CT.expect(tabs.map((x) => x.tab).join() === 'quests,items', `the journal showed both tabs (${JSON.stringify(tabs)})`);
    g.toggleJournal(false);
    await until(() => !g.journalOpen, 3000);
    await sleep(300);
    CT.note(`journal: ${JSON.stringify(tabs)}`);
    return tabs;
  },

  /**
   * The misses of this page so far (since it loaded): none.
   * @param {string} label
   */
  check(label) {
    const misses = IT.misses();
    CT.expect(misses.length === 0, `${label}: every text shown was translated (${misses.length} misses): ${JSON.stringify(misses)}`);
    const c = window.__luminati?.content;
    return { label, misses, missCount: c?.missCount ?? null, missDropped: c?.missDropped ?? null, failed: IT.failed, leaks: Object.fromEntries([...IT.leaks].map(([k, v]) => [k, [...v]])) };
  },

  // -----------------------------------------------------------------------------------------------
  // 1. The Ferryman's Lantern
  // -----------------------------------------------------------------------------------------------

  /** Its title screen (no save: `new=1`). */
  async ferryTitle() {
    IT.suite = CT.suite;
    const r = /** @type {any} */ (await IT.ready());
    CT.expect(r.mode === 'title', `the campaign opens on its title screen (${r.mode})`);
    return { title: IT.log.title, lang: IT.log.lang };
  },

  /** Into play (a confirm key on the title), then Millbrook, chapter one. */
  async millbrook() {
    const g = game();
    if (g.mode === 'title') {
      const e = await IT.enter();
      CT.expect(e.mode === 'play', 'a confirm key on the title starts the journey');
    }
    await CT.at('millbrook');
    // Watchman Bran stops the player on the road (an `enter` event: a line that holds the player)
    await CT.put(36, 16.5);
    await CT.put(34.5, 16.5);
    await IT.drain('first', 30000);
    CT.expect(CT.eventDone('ev_bran'), 'Watchman Bran warned the player (ev_bran)');
    // the cellar door before Odo's key: its locked pages
    const locked = await CT.use('exit:exit_cellar');
    CT.expect(locked?.pages > 0 && G().state().campaign.level === 'millbrook', 'the cellar door is locked: its pages, no travel');
    const tour = await CT.tour('millbrook');
    CT.expect(G().story.info().quests['find-ilse']?.stage === 'planks' && (G().story.info().items['cellar-key'] ?? 0) > 0,
      `the tour's talks moved the story: the planks asked for, the cellar key given (${JSON.stringify(G().story.info().quests)})`);
    // the planks searched for (a Space event), then Hollis with them: his cutscene
    await CT.use('event:ev_planks');
    CT.expect((G().story.info().items.plank ?? 0) >= 3, 'the plank stack gave three planks');
    await CT.talk('hollis');
    await CT.idle();
    CT.expect(CT.flag('hollis-at-ford'), 'Hollis took the planks to the ford');
    // the time event's toast, the leave event's toast (once), the background barks (a cycle of 3)
    await CT.fire('ev_lamps');
    if (!CT.eventDone('ev_farewell')) await CT.fire('ev_farewell');
    for (let k = 0; k < 3; k++) await CT.fire('ev_pip_calls', 2500);
    const journal = await CT.journal();
    // down to the cellar with Odo's key
    await CT.use('exit:exit_cellar');
    await CT.at('mill-cellar');
    return { tour, journal, source: g.source };
  },

  /** The mill cellar: its tour, the chart read twice, back up the stair. */
  async cellar() {
    const g = game();
    const tour = await CT.tour('mill-cellar');
    await CT.use('event:ev_chart');
    CT.expect((G().story.info().items['ferry-chart'] ?? 0) > 0, 'the chart was taken (ferry-chart)');
    await CT.use('event:ev_chart');
    await CT.use('exit:exit_stairs');
    await CT.at('millbrook');
    return { tour, source: g.source };
  },

  /** The Mill Road: the ford sign, the peddler, the barks, the ford cutscene, its tour. */
  async millRoad() {
    const g = game();
    await CT.idle();
    await CT.put(38.6, 16.5);
    await CT.at('mill-road');
    const sign = await CT.use('ford_sign');
    await CT.talk('peddler');
    await CT.talk('peddler');
    await CT.talk('hollis_ford');
    for (let k = 0; k < 3; k++) await CT.fire('ev_gwil_hails', 2000);
    // the ford: Hollis's cutscene (an `enter` event), the bridge mended; the `change` event's toast
    await CT.put(20, 8.5);
    await CT.put(23.5, 8.5);
    await IT.drain('first', 90000);
    await CT.idle(60000);
    await sleep(1500);
    CT.expect(CT.flag('bridge-mended') && CT.eventDone('ev_ford'), 'the ford cutscene mended the bridge');
    const tour = await CT.tour('mill-road');
    return { sign: sign?.pages, tour, source: g.source };
  },

  /** The Old Quarry: the arrival line, the slimes, Ilse found (chapter two), its tour. */
  async quarry() {
    const g = game();
    await CT.idle();
    await CT.put(31.5, 8.5);
    await CT.put(55.2, 8.5);
    const ok = await until(() => G().state().campaign?.level === 'old-quarry' && g.mode === 'play' && !G().state().campaign?.traveling, 60000);
    // (foes kept from interrupting the talks)
    if (g.combat) { G().combat.god(true); G().combat.freezeAI(true); }
    CT.expect(ok, 'the campaign arrives at old-quarry');
    await CT.at('old-quarry');
    const c = G().combat;
    const floor = g.combat.enemies.filter((e) => e.groupId === 'slimes_floor');
    for (const e of floor) c.kill(e.uid);
    await sleep(1200);
    await IT.drain('first', 60000);
    await CT.idle(60000);
    CT.expect(CT.eventDone('ev_cleared'), 'the floor cleared: Ilse calls from the ledge (ev_cleared)');
    // Ilse: the lantern, `lantern-found` — chapter two's banner (her talk may end the story: the
    // tour keeps her for last, so she is talked to here)
    await CT.talk('ilse');
    await sleep(3500);
    IT.scan();
    await CT.talk('ilse');
    CT.expect(CT.flag('lantern-found') && G().state().campaign.chapter === 'lanterns-home', `Ilse found: chapter two (${G().state().campaign.chapter})`);
    const tour = await CT.tour('old-quarry');
    return { killed: floor.length, tour, source: g.source };
  },

  /** Home: Millbrook at dusk (the chapter's variant), its tour, the shop, the barks, the journal. */
  async dusk() {
    const g = game();
    await CT.idle();
    CT.note('travel to mill-road');
    CT.expect(await G().campaign.travel('mill-road', ''), 'the travel back to the Mill Road');
    await CT.at('mill-road');
    // the peddler after the bridge, once more
    await CT.talk('peddler');
    CT.note('travel to millbrook');
    CT.expect(await G().campaign.travel('millbrook', ''), 'the travel home');
    await CT.at('millbrook');
    await CT.idle(60000);
    CT.expect(/\/levels\/millbrook-dusk\.json$/.test(g.source) && G().story.info().quests['find-ilse']?.state === 'done',
      `home at dusk: the chapter's variant's file played (${g.source}), the welcome cutscene ran (${JSON.stringify(G().story.info().quests)})`);
    const tour = await CT.tour('millbrook-dusk');
    CT.expect(IT.log.last.includes('ilse'), 'Ilse is kept for last: her talk ends the story');
    // Odo's cries (a background event: two barks 2.5 s apart)
    await CT.fire('ev_odo_cries', 4000);
    const journal = await CT.journal();
    return { tour, journal, source: g.source };
  },

  /** Ilse last: *Another night*, then the ride home — the ending; its end card stays up. */
  async ending() {
    const r = JSON.parse(await IT.last());
    CT.expect(r.ending, `Ilse's talk ran the story's ending: its end card is up (${JSON.stringify(r.last)})`);
    return { ...r, ...CT.check('The Ferryman\'s Lantern, to its end card') };
  },

  /** After the end card (a confirm: back to the title, the page reloads): the title with Continue. */
  async titleAgain() {
    IT.suite = CT.suite;
    const r = /** @type {any} */ (await IT.ready());
    CT.expect(r.mode === 'title', `the ending returned to the title screen (${r.mode})`);
    // the menu (Continue with its save line, New journey): each entry, then back
    for (const code of ['ArrowDown', 'ArrowUp']) { await press(code); await sleep(400); IT.scan(); }
    return { title: IT.log.title, ...CT.check('The Ferryman\'s Lantern\'s title after the ending') };
  },

  /** Press confirm on the armed end card (the page then returns to the title: no wait here). */
  async dismissEnding() {
    const ok = await until(() => !!document.querySelector('.lu-endcard.is-armed'), 10000);
    CT.expect(ok, 'the end card takes a key');
    setTimeout(() => { press('Enter'); }, 50);
    return 'dismissed';
  },

  // -----------------------------------------------------------------------------------------------
  // 2. Emberfall — Open Doors
  // -----------------------------------------------------------------------------------------------

  /** The town's tour, then every room through its door, each room's tour, and back out. */
  async rooms() {
    IT.suite = CT.suite;
    await IT.ready();
    await CT.at('emberfall');
    const tours = [await CT.tour('emberfall (town)')];
    const seen = new Set(['emberfall']);
    for (const [exit, level] of ROOMS_ROUTE) {
      await CT.use(`exit:${exit}`);
      await CT.at(level);
      if (seen.has(level)) continue;
      seen.add(level);
      tours.push(await CT.tour(level));
    }
    CT.expect(seen.size === 11, `every room was visited (${[...seen].join(', ')})`);
    return { tours, ...CT.check('Emberfall — Open Doors') };
  },

  // -----------------------------------------------------------------------------------------------
  // 3. The party on Cinderwatch Pass
  // -----------------------------------------------------------------------------------------------

  /** Sela: not yet, then she joins; the tactics panel; her talks as a member; she parts ways. */
  async party() {
    IT.suite = CT.suite;
    await IT.ready();
    const g = game();
    G().combat.god(true);
    G().combat.freezeAI(true);
    await IT.drain('first', 30000);
    const isMember = () => !!g.party?.members.some((m) => m.id === 'sela');
    // her first talk: *Not yet*; the next: *Walk with me* — she joins (a toast)
    await CT.talk('sela', [1]);
    CT.expect(!isMember(), 'Not yet: Sela stays at her stone');
    await CT.talk('sela', [0]);
    await sleep(1500);
    IT.scan();
    CT.expect(isMember(), 'Walk with me: Sela joins the party');
    // the tactics panel with G (its presets walked through), closed with Esc
    await CT.idle();
    await press('KeyG');
    const opened = await until(() => g.partyMenuOpen, 3000);
    CT.expect(opened, 'G opens the tactics panel');
    await sleep(600);
    IT.scan();
    for (const code of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowUp']) { await press(code); await sleep(250); IT.scan(); }
    await press('Escape');
    CT.expect(await until(() => !g.partyMenuOpen, 3000), 'Esc closes the tactics panel');
    // her talks as a member: Tactics… (the panel again), Lead on, Part ways → stay
    await CT.talk('sela', [0]);
    await CT.talk('sela', [2]);
    await CT.talk('sela', [1, 0]);
    CT.expect(isMember(), 'Part ways → No: Sela stays in the party');
    // the background events on the quarry lip and the caldera stair: her barks, her rule set
    await CT.put(42.4, 41.8);
    await sleep(2500);
    IT.scan();
    await until(() => CT.eventDone('ev_sela_lip') && !G().story.info().background.length, 8000);
    await CT.put(48.5, 25.7);
    await sleep(2500);
    IT.scan();
    await until(() => CT.eventDone('ev_sela_caldera') && !G().story.info().background.length, 8000);
    CT.expect(CT.eventDone('ev_sela_lip') && CT.eventDone('ev_sela_caldera'), 'both of Sela\'s background events ran');
    // she parts ways (and walks home)
    await CT.talk('sela', [1, 1]);
    await sleep(1500);
    CT.expect(!isMember(), 'Part ways → Yes: Sela leaves the party');
    return CT.check('the party on Cinderwatch Pass');
  },

  /** Sister Ilse at the Waystone Camp: her first talk paged up to her offer, left open. */
  async camp() {
    CT.expect(CT.members().length === 0, `the party is empty again (${CT.members()})`);
    const r = await CT.peek('ilse', [], 0);
    CT.expect(r?.pages >= 4 && r.choosing, `Ilse's first talk: her four pages, her offer's options up (${JSON.stringify(r)})`);
    return r;
  },

  /**
   * Ilse: *Not yet*, then she joins; Rook the same; each one's talks as a member (*Tactics…*, *Lead
   * on*, *Part ways* → stay: the three lines of each one's orders); Ilse's orders asked once more,
   * left open at their question.
   */
  async campTalks() {
    await CT.resume([1]);
    CT.expect(!CT.member('ilse'), 'Not yet: Ilse stays at the camp');
    await CT.talk('ilse', [0]);
    await sleep(1500);
    IT.scan();
    CT.expect(CT.member('ilse'), 'Walk with me: Ilse joins the party');
    await CT.talk('rook', [1]);
    CT.expect(!CT.member('rook'), 'Not yet: Rook stays at the camp');
    await CT.talk('rook', [0]);
    await sleep(1500);
    IT.scan();
    CT.expect(CT.member('rook') && CT.members().length === 2, `Walk with me: Rook joins the party (${CT.members()})`);
    for (const id of ['ilse', 'rook']) {
      await CT.talk(id, [0]);
      await CT.talk(id, [2]);
      await CT.talk(id, [1, 0]);
      CT.expect(CT.member(id), `Part ways → No: ${id} stays in the party`);
    }
    const r = await CT.peek('ilse', [], 0);
    CT.expect(r?.choosing, 'Ilse\'s orders: her question\'s options up');
    return { members: CT.members(), ...r };
  },

  /** *Lead on*; then the Bramble Ruins with Rook: his background event's bark, left up. */
  async ruins() {
    await CT.resume([2]);
    CT.ruleBefore = CT.rule('rook');
    return CT.enterBark('ev_rook_ruins', 34.5, 66.5);
  },

  /** Rook's event done (his rule set); then the caldera stair with Ilse: her bark, left up. */
  async caldera() {
    await CT.settle('ev_rook_ruins');
    const rule = CT.rule('rook');
    CT.expect(rule && rule !== CT.ruleBefore, `ev_rook_ruins set Rook's rule (${CT.ruleBefore} → ${rule})`);
    return CT.enterBark('ev_ilse_caldera', 48.5, 25.7);
  },

  /** Ilse's event done; Sela joins a party that has two members: her other line, left open. */
  async selaJoins() {
    await CT.settle('ev_ilse_caldera');
    CT.expect(!CT.member('sela') && CT.members().length === 2, `Ilse and Rook walk with the player (${CT.members()})`);
    const r = await CT.peek('sela', [0], 1);
    CT.expect(CT.member('sela'), 'Walk with me: Sela joins the party');
    return r;
  },

  /** A full party: Ilse parts ways, Pip fills her place (the hook), her full party's line left open. */
  async fullIlse() {
    await CT.resume();
    CT.expect(CT.members().length === 3, `three walk with the player (${CT.members()})`);
    await CT.talk('ilse', [1, 1]);
    await sleep(1500);
    CT.expect(!CT.member('ilse'), 'Part ways → Yes: Ilse leaves the party');
    const pip = await G().party.join('pip');
    await sleep(1000);
    CT.expect(pip && CT.members().length === 3, `Pip fills the party (${CT.members()})`);
    const r = await CT.peek('ilse', [], 2);
    return r;
  },

  /**
   * Ilse turned away; Rook parts ways, Ilse takes his place, Rook is turned away; Sela parts ways,
   * Rook takes hers, Sela is turned away.
   */
  async fullOthers() {
    await CT.resume();
    CT.expect(!CT.member('ilse') && CT.members().length === 3, `the party full: Ilse made no offer (${CT.members()})`);
    await CT.talk('rook', [1, 1]);
    await sleep(1500);
    CT.expect(!CT.member('rook'), 'Part ways → Yes: Rook leaves the party');
    await CT.talk('ilse', [0]);
    await sleep(1500);
    CT.expect(CT.member('ilse') && CT.members().length === 3, `Ilse joins again (${CT.members()})`);
    await CT.talk('rook');
    CT.expect(!CT.member('rook') && CT.members().length === 3, `the party full: Rook made no offer (${CT.members()})`);
    await CT.talk('sela', [1, 1]);
    await sleep(1500);
    CT.expect(!CT.member('sela'), 'Part ways → Yes: Sela leaves the party');
    await CT.talk('rook', [0]);
    await sleep(1500);
    CT.expect(CT.member('rook') && CT.members().length === 3, `Rook joins again (${CT.members()})`);
    await CT.talk('sela');
    CT.expect(!CT.member('sela') && CT.members().length === 3, `the party full: Sela made no offer (${CT.members()})`);
    return { members: CT.members(), ...CT.check('the party on Cinderwatch Pass: Ilse, Rook and a full party') };
  },
};

/** @type {any} */ (window).CT = CT;
export { CT };
