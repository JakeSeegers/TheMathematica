/**
 * The content-text tour (docs/specs/I18N.md §4.8; `sandbox/i18n.tour.json`): visits a single level
 * in the page's language and shows everything its data says, through the game's own display — then
 * fails on any text the tables could not translate (`window.__luminati.content.misses`, §4.2).
 *
 * - the title screen (a page without `autostart`): its texts and the shipped levels' names (the
 *   destinations row cycled through), then a confirm key into play;
 * - what the story runs at the start (a cutscene on arrival, a line that holds the player): paged
 *   through first, so the villagers are free to talk;
 * - every villager: `__game.talkTo(id)`, three visits (hand-written conversations change by visit),
 *   every page with real confirm presses until the conversation is over, a choice answered with its
 *   first option — and once more with its last option for a villager whose talk asked a question
 *   (the action it runs: the rest, the shop's toast with the item's name, the music). A villager the
 *   story has away is listed as `absent`; one that is there but could not be talked to as
 *   `notTalked` (a failure). A villager whose talk may end the story or leave the level (an `ending`
 *   or a `travel`, in its talk or a script it calls) is talked to last, by `IT.last()` after
 *   `IT.finish()` (`log.last`); a talk that ends the story or leaves the level anyway stops the tour
 *   (`log.stopped`, a failure);
 * - every interactable of the world (a sign, a door, a well; a chest or a waystone on a peaceful
 *   level): the player put in front of it, its prompt read, then a confirm press — the game's own
 *   interaction when the prompt is its own, else `_interact` (counted as `forced`) — and its pages
 *   paged through;
 * - every region: the player put inside it (a standable point of its box above its `minY`, never in
 *   a campaign's walk-in exit), so its plate and its banner show (a region no point of which is
 *   standable, or that an earlier region covers, is listed as not shown);
 * - the world map opened and closed.
 *
 * Combat levels (COMBAT.md): `god` and `freezeAI` keep the foes from interrupting the talks; chests
 * and waystones open and rest there (their own `onInteract`, no examine text): only their prompts are
 * shown (`skipped`), as for a campaign's exits and a story's events.
 *
 * A report-only English-leak scan reads the visible text of the dialog, the prompt, the banner, the
 * location plate, the toasts, the world map and the title while they are up: runs of three or more
 * Latin letters that are not allowed vocabulary (HP MP SP XP Lv ATK DEF G, key names) are listed for
 * a human to read — the tour never fails on them. English pages skip it.
 *
 * Installed by an `eval` step: `await import('/sandbox/i18n_tour.js')` → `window.IT`. The tour runs
 * in the page (`IT.start()`); `IT.wait(ms)` steps poll it (each under the harness's 180 s protocol
 * limit); `IT.finish()` checks the misses; `IT.last()` then talks to the villagers kept for last (an
 * ending stays on its end card). `IT.expect` records a failed check and throws it as a page error
 * (the harness exits 1), like sandbox/party_follow.js. `IT.tour()` is one level's visit without the
 * misses bookkeeping (sandbox/i18n_campaign.js runs it on every level of a campaign).
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));
const G = () => window.__game;
const game = () => window.__game.game;

/** Words that may stay Latin in a translated UI (stats, key names, the engine's name). */
const ALLOWED = new Set([
  'HP', 'MP', 'SP', 'XP', 'Lv', 'ATK', 'DEF', 'G', 'WASD', 'Shift', 'Space', 'Esc', 'Tab', 'Enter',
  'LB', 'RB', 'LT', 'RT', 'LS', 'RS', 'Ctrl', 'Alt', 'Luminati', '2.5D', 'three', 'js',
]);
/** The UI parts the leak scan reads (when shown). */
const SCAN = [
  ['dialog', '.lu-dialog'], ['prompt', '.lu-prompt.is-on'], ['banner', '.lu-banner'], ['location', '.lu-loc'],
  ['toast', '.lu-toasts'], ['map', '.lu-worldmap'], ['title', '.lu-title'],
];

/** Wait until `fn()` holds (every 50 ms, at most `ms`). */
async function until(fn, ms = 20000) {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    if (fn()) return true;
    await sleep(50);
  }
  return false;
}

/** A real key press on the window (the game's Input and the dialog read it in the next frame). */
async function press(code, key = code) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true }));
  await frame();
  await frame();
  window.dispatchEvent(new KeyboardEvent('keyup', { code, key, bubbles: true }));
  await frame();
}

/** Thrown by `IT.halt`: the tour cannot go on on this level (an ending, a travel). */
class TourStop extends Error {}

/**
 * How a choice is answered: 'first' / 'last' (see `drain`), or the option indices in order (then the
 * first option).
 * @typedef {'first'|'last'|number[]} Answer
 */

const IT = {
  suite: 'i18n.tour',
  /** @type {string[]} failed checks */
  failed: [],
  /** What the tour did (counts, what it could not show). */
  log: {
    lang: '', level: '', villagers: 0, visits: 0, pages: 0, choices: 0, lastAnswers: 0, startPages: 0,
    /** @type {string[]} present villagers it could not talk to (a failure) */ notTalked: [],
    /** @type {string[]} villagers the story has away */ absent: [],
    /** @type {string[]} villagers whose talk may end the story or leave the level: `IT.last()` */ last: [],
    /** @type {string[]} */ fewerVisits: [],
    interactables: 0, forced: 0, /** @type {string[]} */ skipped: [], prompts: 0, regions: 0,
    /** @type {string[]} */ regionsNotShown: [], map: false,
    /** @type {null|{ destinations: number, misses: unknown[] }} */ title: null,
    /** @type {string|null} why the tour stopped early (an ending, a travel, the game left play) */ stopped: null,
  },
  /** English-leak scan: `where → Set of 'word ‹ context›'`. @type {Map<string, Set<string>>} */
  leaks: new Map(),
  /** Every visit to a villager: what `drain` saw. @type {{ id: string, visit: number, answer: Answer }[]} */
  talks: [],
  /** The misses recorded before the tour cleared them (the load, the title). @type {unknown[]} */
  atLoad: [],
  /** The tour in progress (`start`). @type {Promise<unknown>|null} */
  run: null,
  done: false,
  /** @type {string|null} */
  error: null,
  phase: '',
  /** The level the visit in progress is on (`tour`). @type {object|null} */
  level0: null,

  /**
   * A check: a failure is recorded and thrown as a page error (the harness exits 1).
   * @param {unknown} ok
   * @param {string} label
   */
  expect(ok, label) {
    if (ok) return true;
    IT.failed.push(label);
    setTimeout(() => { throw new Error(`${IT.suite}: ${label}`); });
    return false;
  },

  misses() { return [...(window.__luminati?.content?.misses ?? [])]; },
  lang() { return window.__luminati?.content?.lang ?? game().state?.().lang ?? 'en'; },

  /** Read the visible text of the UI parts for Latin runs (report-only; not in English). */
  scan() {
    if (IT.log.lang === 'en' || !IT.log.lang) return;
    for (const [where, sel] of SCAN) {
      const el = /** @type {HTMLElement|null} */ (document.querySelector(sel));
      if (!el) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      if (where === 'dialog' && !game().ui.dialog.isOpen) continue;
      if (where === 'map' && !game().mapOpen) continue;
      const text = el.innerText || '';
      for (const m of text.matchAll(/[A-Za-z][A-Za-z'’-]{2,}/g)) {
        const w = m[0].replace(/[-'’]+$/, '');
        if (w.length < 3 || ALLOWED.has(w)) continue;
        const at = m.index ?? 0;
        const ctx = text.slice(Math.max(0, at - 12), at + w.length + 12).replace(/\s+/g, ' ');
        let set = IT.leaks.get(where);
        if (!set) IT.leaks.set(where, (set = new Set()));
        if (set.size < 60) set.add(`${w} ‹${ctx}›`);
      }
    }
  },

  /**
   * Wait for the page: the title screen (a page without autostart) or the first gameplay frames.
   * @returns {Promise<object>}
   */
  async ready() {
    for (let i = 0; i < 900 && !(window.__game && ['title', 'play'].includes(window.__game.game?.mode)); i++) await sleep(100);
    const g = game();
    IT.log.lang = IT.lang();
    IT.log.level = g.level.name;
    if (g.mode === 'title') {
      await until(() => !!document.querySelector('.lu-title:not(.is-gone)'), 10000);
      await sleep(1800);
      IT.scan();
      // the destinations row (a shipped level): every shipped level's name, cycled through and back
      const dests = /** @type {any} */ (g.ui.title)._dests;
      const n = Array.isArray(dests) ? dests.length : 0;
      for (let k = 0; k < n; k++) { await press('ArrowRight'); await sleep(250); IT.scan(); }
      IT.log.title = { destinations: n, misses: IT.misses() };
      return { mode: 'title', lang: IT.log.lang, level: IT.log.level, misses: IT.log.title.misses };
    }
    await until(() => !!window.__luminati?.loadMs, 30000);
    await sleep(600);
    return { mode: g.mode, lang: IT.log.lang, level: IT.log.level, misses: IT.misses() };
  },

  /** From the title into play (a confirm key: the destination is the level itself). */
  async enter() {
    const g = game();
    for (let k = 0; k < 6 && g.mode === 'title'; k++) {
      await press('Enter');
      await until(() => g.mode === 'play', 3000);
    }
    await until(() => g.mode === 'play' && !g.busy, 20000);
    await sleep(1500);
    IT.scan();
    return { mode: g.mode };
  },

  /** Is a story's end card up (the `ending` command: it waits for a key, then the title)? */
  ending() {
    return !!/** @type {any} */ (game().ui).endCard?.active;
  },

  /**
   * Page through whatever the game shows now — a conversation, an examine text, a script a teleport
   * started — with real confirm presses until the player is free again. Stops at a story's end card
   * (`ended`; the card is left up: a confirm would return to the title).
   * @param {Answer} [answer] which option a choice gets: 'first'; 'last' (for the first three
   *   choices met, then 'first': a menu that offers its question again ends); or the option
   *   indices in order (then 'first')
   * @param {number} [ms]
   * @returns {Promise<{ pages: number, choices: number, lastPage: 'choice'|'text'|'', ended: boolean }>}
   */
  async drain(answer = 'first', ms = 60000) {
    const g = game();
    const d = g.ui.dialog;
    const picks = Array.isArray(answer) ? [...answer] : null;
    let pages = 0, choices = 0, lasts = 0, lastPage = /** @type {'choice'|'text'|''} */ ('');
    let seen = '';
    let ended = false;
    const t0 = performance.now();
    // (a conversation opens its window a frame or two after the talk starts)
    await until(() => d.isOpen || !g.busy, 1500);
    while (performance.now() - t0 < ms && (g.busy || d.isOpen || g.partyMenuOpen)) {
      if (IT.ending() && !d.isOpen) { ended = true; await sleep(1200); IT.scan(); break; }
      // (a member's *Tactics…* opens the party's panel: read, then closed)
      if (g.partyMenuOpen && !d.isOpen) {
        await sleep(400);
        IT.scan();
        g.togglePartyMenu(false);
        await until(() => !g.partyMenuOpen, 3000);
        continue;
      }
      if (!d.isOpen) { await sleep(80); continue; }
      const text = d._textEl?.textContent ?? '';
      if (!d.isTyping && text !== seen) { seen = text; pages++; IT.scan(); }
      if (d.isChoosing) {
        await sleep(300);
        IT.scan();
        const n = d._choiceEls?.length ?? 0;
        let want = 0;
        if (picks) want = Math.min(n - 1, Math.max(0, picks.shift() ?? 0));
        else if (answer === 'last' && lasts < 3 && n > 1) { want = n - 1; lasts++; }
        for (let k = 0; k < 2 * n && d._choiceIndex !== want; k++) await press(d._choiceIndex < want ? 'ArrowDown' : 'ArrowUp');
        choices++;
        lastPage = 'choice';
        await press('Enter');
        await sleep(120);
        continue;
      }
      if (!d.isTyping) lastPage = 'text';
      await press('Enter');
      await sleep(60);
    }
    if (!ended && IT.ending()) { ended = true; await sleep(1200); IT.scan(); }
    IT.log.pages += pages;
    IT.log.choices += choices;
    IT.log.lastAnswers += lasts;
    return { pages, choices, lastPage, ended };
  },

  /**
   * Stop the visit when the game is not on its level in play any more (an ending's card, a travel, a
   * return to the title): `log.stopped`, a failure in `finish`.
   * @param {string} what what was being shown
   */
  checkStill(what) {
    const g = game();
    const why = IT.ending() ? 'the story ended (its end card is up)'
      : IT.level0 && g.level !== IT.level0 ? 'the game left the level'
        : g.mode !== 'play' ? `the game left play (mode ${g.mode})` : '';
    if (!why) return;
    IT.log.stopped = `${what}: ${why}`;
    throw new TourStop(IT.log.stopped);
  },

  /**
   * Could talking to `npc` end the story or leave the level: an `ending` or a `travel` in its talk
   * script, or in a story script it `call`s? (Talked to last: `IT.last()`.)
   * @param {any} npc
   */
  async mayEnd(npc) {
    const story = /** @type {any} */ (game().story);
    if (!story || !npc.storyTalk) return false;
    const { walkNodes } = await import('../src/engine/level/StoryScript.js');
    const seen = new Set();
    /** @param {any[]} nodes @returns {boolean} */
    const look = (nodes) => {
      let found = false;
      walkNodes(nodes, (n) => {
        if (found || n.t !== 'cmd') return;
        if (n.op === 'ending' || n.op === 'travel') found = true;
        else if (n.op === 'call' && !seen.has(n.args.script)) {
          seen.add(n.args.script);
          const sc = story._script?.(n.args.script);
          if (sc && look(sc.nodes)) found = true;
        }
      });
      return found;
    };
    return look(npc.storyTalk);
  },

  /**
   * Talk to one villager: three visits, plus one answering with the last option when it asked.
   * @param {any} npc
   * @param {Answer[]} [answers] the answer of each visit (default: 'first' ×3, then 'last')
   */
  async talkThrough(npc, answers = ['first', 'first', 'first', 'last']) {
    const g = game();
    IT.phase = `villager ${npc.id}`;
    let asked = false;
    let talked = 0;
    let absent = false;
    try {
      for (let v = 0; v < answers.length; v++) {
        if (v === 3 && !asked) break;
        await until(() => !g.busy && !g.ui.dialog.isOpen, 20000);
        IT.checkStill(`before talking to ${npc.id}`);
        // (a villager who joined the party talks as a member: `talkTo` steps it up to the player)
        const member = !npc.present && !!g.party?.members.some((m) => m.id === npc.id);
        if (!npc.present && !member) {
          absent = !talked;
          break;
        }
        const ok = G().talkTo(npc.id);
        if (!ok) break;
        talked++;
        const r = await IT.drain(answers[v]);
        IT.talks.push({ id: npc.id, visit: v + 1, answer: answers[v], ...r });
        IT.expect(r.pages > 0 || r.ended, `talking to ${npc.id} (visit ${v + 1}) shows its pages`);
        if (r.choices) asked = true;
        IT.log.visits++;
        // (a member's talk may open the tactics panel: closed again)
        if (g.partyMenuOpen && !r.ended) {
          await sleep(400);
          IT.scan();
          g.togglePartyMenu(false);
          await until(() => !g.partyMenuOpen, 3000);
        }
        IT.checkStill(`talking to ${npc.id} (visit ${v + 1})`);
        await sleep(150);
      }
    } finally {
      if (talked) IT.log.villagers++;
      else if (absent) IT.log.absent.push(npc.id);
      else IT.log.notTalked.push(npc.id);
      // (fewer than three: the villager left — the story took it away, it joined the party — or
      // the story ended)
      if (talked && talked < 3) IT.log.fewerVisits.push(`${npc.id}: ${talked}${npc.present ? '' : ' (gone)'}`);
    }
    return talked;
  },

  /** Every villager (those that may end the story or leave the level kept for `IT.last()`). */
  async villagers() {
    const g = game();
    for (const npc of [...g.npcs]) {
      if (await IT.mayEnd(npc)) {
        if (!IT.log.last.includes(npc.id)) IT.log.last.push(npc.id);
        continue;
      }
      await IT.talkThrough(npc);
    }
  },

  /**
   * Put the player in front of an interactable (facing it); true when it is the one the game
   * offers (its prompt is up).
   * @param {any} it
   */
  async faceUp(it) {
    const g = game();
    const at = G().teleport(it.position.x, it.position.z);
    if (!at) return false;
    const pl = g.player;
    const dx = it.position.x - pl.position.x;
    const dz = it.position.z - pl.position.z;
    const len = Math.hypot(dx, dz);
    if (len > 1e-3) {
      pl.facing.set(dx / len, 0, dz / len);
      pl.sprite.faceVector(dx, dz);
    }
    await frame();
    await frame();
    await sleep(120);
    return g.state().nearest === it.id && g.ui.prompt.visible;
  },

  /** Every interactable of the world: its prompt, then what examining it shows. */
  async interactables() {
    const g = game();
    const items = [...g.world.interactables];
    for (const it of items) {
      if (it.disabled) continue;
      IT.phase = `interactable ${it.id}`;
      await until(() => !g.busy && !g.ui.dialog.isOpen, 20000);
      IT.checkStill(`before ${it.id}`);
      const own = await IT.faceUp(it);
      if (own) { IT.log.prompts++; IT.scan(); }
      if (it.onInteract) {
        // (combat levels' chests and waystones, a campaign's exits, a story's events: what they do
        // is not examining)
        IT.log.skipped.push(`${it.id} (${it.kind}: ${own ? 'prompt only' : 'not offered'})`);
        continue;
      }
      // (confirm starts nothing for a moment after a conversation closed: TALK_COOLDOWN)
      await until(() => !(g._talkCooldown > 0), 3000);
      let opened = false;
      if (own) {
        await press('Enter');
        opened = await until(() => g.ui.dialog.isOpen, 1500);
      }
      if (!opened) {
        IT.log.forced++;
        g._interact({ kind: 'object', npc: null, it });
        opened = await until(() => g.ui.dialog.isOpen, 1500);
      }
      IT.expect(opened, `examining ${it.id} (${it.kind}) opens the dialog`);
      const r = await IT.drain('first');
      IT.expect(r.pages > 0, `examining ${it.id} (${it.kind}) shows its pages`);
      IT.log.interactables++;
      IT.checkStill(`examining ${it.id}`);
      await sleep(200);
    }
  },

  /**
   * Is (x, z) in or near (1 unit) a campaign exit the player walks into (it would travel)?
   * @param {number} x @param {number} z
   */
  inWalkExit(x, z) {
    const exits = /** @type {any} */ (game().campaign)?._exits ?? [];
    return exits.some((o) => o.mode !== 'use' && x >= o.minX - 1 && x < o.maxX + 1 && z >= o.minZ - 1 && z < o.maxZ + 1);
  },

  /** Every region: the player inside it, its plate and banner up. */
  async regions() {
    const g = game();
    for (const r of [...g.regions]) {
      IT.phase = `region ${r.id}`;
      await until(() => !g.busy && !g.ui.dialog.isOpen, 20000);
      IT.checkStill(`before region ${r.id}`);
      // (the middle first, then a 5 × 5 grid over the box)
      const N = 5;
      const spots = [[0.5, 0.5]];
      for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) spots.push([(a + 0.5) / N, (b + 0.5) / N]);
      let inside = false;
      for (const [fx, fz] of spots) {
        const x = r.minX + (r.maxX - r.minX) * fx;
        const z = r.minZ + (r.maxZ - r.minZ) * fz;
        if (IT.inWalkExit(x, z)) continue;
        const p = G().teleport(x, z);
        if (!p || p.x < r.minX || p.x >= r.maxX || p.z < r.minZ || p.z >= r.maxZ || (r.minY != null && !(p.y > r.minY))) continue;
        await sleep(450);
        if ((inside = g.region === r.name)) break;
      }
      if (!inside) { IT.log.regionsNotShown.push(r.id); continue; }
      IT.log.regions++;
      await sleep(250);
      IT.scan();
      // (a story's event may have started where the player stands)
      await IT.drain('first', 30000);
      IT.checkStill(`region ${r.id}`);
    }
  },

  /** The world map, opened and closed. */
  async map() {
    const g = game();
    IT.phase = 'map';
    await until(() => !g.busy && !g.ui.dialog.isOpen, 20000);
    IT.log.map = !!G().map(true);
    await sleep(900);
    IT.scan();
    G().map(false);
    await sleep(300);
  },

  /**
   * One level's visit: what the story runs at the start, every villager, interactable and region,
   * the map. Resolves when done or stopped (`log.stopped`); a `TourStop` is not rethrown.
   */
  async tour() {
    const g = game();
    IT.level0 = g.level;
    if (g.combat) {
      G().combat.god(true);
      G().combat.freezeAI(true);
    }
    try {
      // (a cutscene on arrival, a line that holds the player: paged through first)
      IT.phase = 'start';
      const r = await IT.drain('first', 60000);
      IT.log.startPages += r.pages;
      IT.checkStill('the start');
      await IT.villagers();
      await IT.interactables();
      await IT.regions();
      await IT.map();
      IT.phase = 'done';
    } catch (err) {
      if (!(err instanceof TourStop)) throw err;
      IT.phase = `stopped (${IT.phase})`;
    }
  },

  /** Start the tour in the page (the harness polls it with `wait`). */
  start() {
    if (IT.run) return 'running';
    IT.run = (async () => {
      // what the load and the title showed untranslated, then the tour's own
      IT.atLoad = IT.misses();
      window.__luminati?.content?.clearMisses?.();
      await IT.tour();
    })().then(() => { IT.done = true; }, (err) => { IT.done = true; IT.error = String(err?.stack ?? err); });
    return 'started';
  },

  /**
   * Wait for the tour (at most `ms`).
   * @param {number} [ms]
   */
  async wait(ms = 170000) {
    const t0 = performance.now();
    while (!IT.done && performance.now() - t0 < ms) await sleep(250);
    return JSON.stringify({ done: IT.done, phase: IT.phase, ...IT.counts() });
  },

  counts() {
    const l = IT.log;
    return { villagers: l.villagers, visits: l.visits, pages: l.pages, choices: l.choices, interactables: l.interactables, prompts: l.prompts, regions: l.regions };
  },

  /**
   * The checks of the visits so far: they ran, stopped nowhere and talked to every villager there.
   * @param {string} [where] the level, for the labels
   */
  expectVisited(where = IT.log.level) {
    IT.expect(!IT.log.stopped, `the tour of ${where} ran to its end — it stopped: ${IT.log.stopped} (a villager whose talk may end the story or leave the level is talked to last, by IT.last())`);
    IT.expect(IT.log.notTalked.length === 0, `every villager there was talked to: not ${JSON.stringify(IT.log.notTalked)}`);
  },

  /** The tour's end: the misses must be none (the load's, the title's and the tour's). */
  finish() {
    const misses = IT.misses();
    IT.expect(IT.done, `the tour finished (it stopped at: ${IT.phase})`);
    IT.expect(!IT.error, `the tour ran without an error: ${IT.error}`);
    IT.expectVisited();
    IT.expect(!IT.log.title || IT.log.title.misses.length === 0, `the title screen showed every text translated: ${JSON.stringify(IT.log.title?.misses)}`);
    IT.expect(IT.atLoad.length === 0, `the load showed every text translated: ${JSON.stringify(IT.atLoad)}`);
    IT.expect(misses.length === 0, `the tour showed every text translated (${misses.length} misses): ${JSON.stringify(misses)}`);
    const leaks = Object.fromEntries([...IT.leaks].map(([k, v]) => [k, [...v]]));
    return JSON.stringify({ ...IT.log, atLoad: IT.atLoad, misses, leaks, failed: IT.failed });
  },

  /**
   * After `finish`: the villagers kept for last (`log.last`: their talk may end the story or leave
   * the level) — a visit answering with the last option, then with the first ones, until the story
   * ends (its end card is left up), the level is left or three visits are done; then the misses.
   */
  async last() {
    const g = game();
    const out = [];
    for (const id of IT.log.last) {
      const npc = g.npcs.find((n) => n.id === id);
      if (!npc || IT.ending() || g.mode !== 'play' || (IT.level0 && g.level !== IT.level0)) break;
      IT.log.stopped = null;
      const k = IT.talks.length;
      try {
        await IT.talkThrough(npc, ['last', 'first', 'first']);
      } catch (err) {
        if (!(err instanceof TourStop)) throw err;
      }
      out.push({ id, stopped: IT.log.stopped, visits: IT.talks.slice(k) });
    }
    IT.expect(IT.log.notTalked.length === 0, `every villager kept for last was talked to: not ${JSON.stringify(IT.log.notTalked)}`);
    const misses = IT.misses();
    IT.expect(misses.length === 0, `the villagers talked to last showed every text translated (${misses.length} misses): ${JSON.stringify(misses)}`);
    return JSON.stringify({ last: out, ending: IT.ending(), misses, failed: IT.failed });
  },

  /** Hold a view for a screenshot: a villager's first page, a sign's, or the world map. @param {'npc'|'sign'|'map'} what */
  async show(what) {
    const g = game();
    await until(() => !g.busy && !g.ui.dialog.isOpen, 20000);
    if (what === 'map') { G().map(true); await sleep(900); return 'map'; }
    if (what === 'npc') {
      const ok = (n) => n.present && !IT.log.last.includes(n.id);
      const npc = g.npcs.find((n) => ok(n) && n.def.title) ?? g.npcs.find(ok);
      if (!npc) return 'none';
      G().talkTo(npc.id);
    } else {
      const it = g.world.interactables.find((i) => i.kind === 'sign' && !i.disabled) ?? g.world.interactables.find((i) => !i.onInteract && !i.disabled);
      if (!it) return 'none';
      await IT.faceUp(it);
      g._interact({ kind: 'object', npc: null, it });
    }
    await until(() => g.ui.dialog.isOpen, 3000);
    await sleep(400);
    // (the first page typed out)
    if (g.ui.dialog.isTyping) await press('Enter');
    await sleep(600);
    return what;
  },

  /** Close what `show` opened. */
  async close() {
    const g = game();
    if (g.mapOpen) G().map(false);
    await IT.drain('first', 20000);
    return 'closed';
  },
};

/** @type {any} */ (window).IT = IT;
export { IT, press, until, sleep, frame };
