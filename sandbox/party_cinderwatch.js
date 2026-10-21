/**
 * Helpers of `sandbox/party.cinderwatch.json` — the party demo on Cinderwatch Pass
 * (docs/specs/PARTY.md §9): Sela, a warden of the Cinderwatch at the Crossroads Waystone, her talk
 * script (the offer, `party join sela as warden balanced`; as a member *Tactics…* / *Part ways* /
 * *Lead on*) and the two background events that set her rule (Guard Me on the quarry lip, Support
 * on the caldera stair); then (s15–s27) the two companions of the Waystone Camp — Sister Ilse
 * (`party join ilse as mystic support`) and Rook (`… rook as ranger balanced`), the same talk shape
 * —, the full party of three, the refused fourth join, the full party's answer instead of an offer
 * and their events (Rook: Hunt Casters in the Bramble Ruins; Ilse's word on the caldera stair, where
 * Sela's Support event keeps quiet while Ilse heals). Everything is driven like a player: `talkTo`
 * and real key presses through the dialog (Space, a click on a choice), G / Q / E / the arrows /
 * Space / Esc in the tactics panel, the player walked with `moveOverride` (`PF.drive`,
 * sandbox/party_follow.js); the party hooks only where a player could not (the fourth join, Pip as
 * the third member). Toasts and barks are recorded as the page shows them.
 *
 * Installed by an `eval` step: `import('/sandbox/party_cinderwatch.js')` → `window.PC` (and
 * `window.PF`). `PC.expect` records a failed check and throws it as a page error (the harness
 * exits 1).
 */
import PF from './party_follow.js';

const { sleep, until, frame } = PF;
const G = () => window.__game;
const game = () => window.__game.game;
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : v);

/**
 * The two companions of the Waystone Camp as the level's generator writes them
 * (tools/make-cinderwatch-pass.mjs: `people()`, ILSE_TALK, ROOK_TALK): the post, the look, the
 * join, and the English lines the checks compare (their beginnings).
 */
const COMPANIONS = {
  ilse: {
    name: 'Sister Ilse', title: 'Keeper of the Waystones', post: [50.5, 111.5], preset: 'cleric', cls: 'mystic', rule: 'support',
    // the first talk: three pages on the waystones, the fourth the reason to join
    first: /^The waystones remember the last traveller/, pages: 4, last: /^The pass has grown too loud for one blade/,
    ask: 'Shall I walk with you?', notYet: /^The stones will keep me\./, again: /^Back from the road\?/, joined: /^Then I come\./,
    toast: 'Sister Ilse joined your party · G: Tactics',
    orders: ['The stones are listening. Walk on.', 'Bruised? Stay where my light can reach you.', 'I am with you, traveller.'],
    memberAsk: 'How shall I serve?', sure: /^Here\? Are you certain\?/, stay: /^Then I stay\./, bye: /^The nearest stone will know where I am/,
    full: /^Three already walk at your back/,
  },
  rook: {
    name: 'Rook', title: 'Scout of the Cinderwatch', post: [40.5, 112.5], preset: 'hunter', cls: 'ranger', rule: 'balanced',
    first: /^Rook, scout of the Cinderwatch\./, pages: 3, last: /^Take me up the pass and I'll pick off/,
    ask: 'Want a bow at your back?', notYet: /^Suit yourself\./, again: /^Still here\. Still shooting straw\./, joined: /^About time!/,
    toast: 'Rook joined your party · G: Tactics',
    orders: ["Quiver's full. Point me at something.", 'Anything with a bow is mine. Anything bigger is yours.', 'Your call, traveller.'],
    memberAsk: "What's the plan?", sure: /^Here\? You sure\?/, stay: /^Good\. I was just getting my eye in\./, bye: /^Fair enough\. I'll watch the road from here\./,
    full: /^Your company's full\./,
  },
};

/**
 * Press a key (a real keydown, a frame or two, keyup) on the window the game's Input listens on.
 * Held for two drawn frames and followed by two more (at least 50 ms each): the game's Input latches
 * a press until its next frame ends, so two presses inside one slow frame (a busy GPU) would read
 * as one.
 */
async function press(code, key = code) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true }));
  await Promise.all([sleep(50), frame().then(frame)]);
  window.dispatchEvent(new KeyboardEvent('keyup', { code, key, bubbles: true }));
  await Promise.all([sleep(50), frame().then(frame)]);
}

const PC = {
  PF,
  sleep,
  until,
  frame,
  press,
  /** Toast texts in the order shown. @type {string[]} */
  toasts: [],
  /** Bark texts in the order shown. @type {string[]} */
  barks: [],
  /** Pages and choices of every conversation (`talk` / `go`). @type {any[]} */
  talks: [],
  expect(ok, label) {
    return PF.expect(ok, label);
  },
  /** Wait for play; watch the toasts and the barks. */
  async ready() {
    PF.suite = 'party.cinderwatch';
    const r = await PF.ready();
    const seen = new WeakSet();
    const scan = () => {
      for (const el of document.querySelectorAll('.lu-toasts > *, .lu-bark')) {
        if (seen.has(el)) continue;
        const t = el.textContent.trim();
        if (!t) continue;
        seen.add(el);
        (el.classList.contains('lu-bark') ? PC.barks : PC.toasts).push(t);
      }
    };
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true, characterData: true });
    return r;
  },
  /**
   * The tactics panel (the party UI's PartyPanel: its test extras `memberId`, `focus`,
   * `focusedPreset` are not on PartyPanelLike).
   * @returns {import('../src/engine/ui/PartyPanel.js').PartyPanel|null}
   */
  panel() {
    return /** @type {any} */ (game().ui.party?.panel ?? null);
  },
  /** Sela's villager (Npc). */
  villager() {
    return PC.villagerOf('sela');
  },
  /** Sela as a member (PartyMember) or null. */
  member() {
    return PC.memberOf('sela');
  },
  /** `state().party.members[0]` (Sela's entry) or null. */
  info() {
    return PC.infoOf('sela');
  },
  /** The level's villager `id` (Npc) or null. @param {string} id */
  villagerOf(id) {
    return game().npcById.get(id) ?? null;
  },
  /** `id` as a member (PartyMember) or null. @param {string} id */
  memberOf(id) {
    return PF.member(id);
  },
  /** `id`'s entry of `state().party.members` or null. @param {string} id */
  infoOf(id) {
    return G().party.info()?.members?.find((m) => m.id === id) ?? null;
  },
  /** `id`'s fight (MemberCombat) or null. @param {string} id */
  allyOf(id) {
    return game().combat.allies?.find((a) => a.id === id) ?? null;
  },
  /** The members' ids in join order. */
  ids() {
    return game().party?.members.map((m) => m.id) ?? [];
  },
  /** How many members. */
  count() {
    return game().party?.count ?? 0;
  },
  /** Is the story's `holds(cond)` true? */
  holds(cond) {
    return !!G().story.holds(cond);
  },
  /** The player's distance to (x, z). */
  dist(x, z) {
    const P = game().player.position;
    return Math.hypot(P.x - x, P.z - z);
  },
  /** The story's executed lines (the trace) that contain `s`. */
  traced(s) {
    return (G().story.trace() ?? []).filter((l) => l.includes(s));
  },
  /**
   * Start a conversation with `id` (`talkTo`: a villager, or the member when its villager is
   * hidden) and run it like `go`.
   * @param {string} id
   * @param {number[]} answers the choices to pick, in order
   * @param {{ stop?: boolean }} [o] stop at the next choice once `answers` is used up
   */
  async talk(id, answers = [], o = {}) {
    const g = game();
    const d = g.ui.dialog;
    // (a member busy — a heal it is casting, a story walk — is not talked to: `talkTo` refuses, as
    // a player's Space would do nothing; a player waits for it, so does this)
    const busy = (m) => !!m && (m.talking || m.directed || !!m.combat?.active);
    const look = (m) => {
      if (!m) return null;
      // (on a combat level: engaged, and the foes awake near the player that keep it so)
      const sys = g.combat;
      const P = g.player.position;
      const foes = sys?.enemies.filter((e) => e.alive && e.aggro).map((e) => `${e.uid}:${e.kind}:${e.state}@${r3(Math.hypot(e.position.x - P.x, e.position.z - P.z))}`);
      return { talking: m.talking, directed: m.directed, active: !!m.combat?.active, mode: m.combat?.mode, action: m.combat?.action ?? null, engaged: sys?.engaged ?? null, linger: r3(sys?._engageLinger), foes };
    };
    const t0 = performance.now();
    const m0 = busy(PC.memberOf(id)) ? look(PC.memberOf(id)) : null;
    const freed = await until(() => !g.busy && !d.isOpen && g._talkCooldown <= 0 && !busy(PC.memberOf(id)), 8000);
    const ok = G().talkTo(id);
    PC._conv = { id, ok, speaker: '', title: '', pages: [], asks: [], offered: [], picked: [] };
    // (what the talk waited for, and why one was refused)
    if (m0) Object.assign(PC._conv, { waited: { ms: Math.round(performance.now() - t0), member: m0 } });
    if (!ok) Object.assign(PC._conv, { refused: { freed, busy: g.busy, dialog: d.isOpen, cooldown: g._talkCooldown, member: look(PC.memberOf(id)) } });
    PC.talks.push(PC._conv);
    return PC.go(answers, o);
  },
  /**
   * Go on with the conversation open now: Space through the pages (a typing line is completed
   * first), click the next of `answers` on a choice (the first one when none is left, unless
   * `stop`). Resolves `{ state: 'done' | 'choice' | 'menu', … }`: the window closed and nothing
   * holds the player; a choice waits (`stop`); the tactics panel opened (`party menu`).
   * @param {number[]} answers
   * @param {{ stop?: boolean }} [o]
   */
  async go(answers = [], { stop = false } = {}) {
    const g = game();
    const d = g.ui.dialog;
    const c = PC._conv;
    const left = [...answers];
    let state = 'timeout';
    for (let i = 0; i < 300; i++) {
      if (g.party?.menuOpen) { state = 'menu'; break; }
      if (!g.busy && !d.isOpen && !g.story?.run) { state = 'done'; break; }
      await sleep(100);
      if (!d.isOpen) continue;
      c.speaker = (d._speakerEl ?? d._nameEl)?.textContent?.trim() || c.speaker;
      c.title = d._titleEl?.textContent?.trim() || c.title;
      if (d.isTyping) {
        d.skip();
        continue;
      }
      const tx = d._textEl?.textContent?.trim() ?? '';
      if (tx && c.pages.at(-1) !== tx) c.pages.push(tx);
      // (a question asked under the held line — DialogLine `ask`: the speech kept, the question
      // under it — read from the line itself, whatever the window draws of it)
      const ask = d._lines?.[d._index]?.ask;
      if (typeof ask === 'string' && ask && c.asks.at(-1) !== ask) c.asks.push(ask);
      if (d._choicesActive) {
        if (d._guard > 0) continue;
        const opts = d._choiceEls.map((li) => li.textContent.trim());
        if (!left.length && stop) { state = 'choice'; c.waiting = opts; break; }
        c.offered.push(opts);
        const a = left.length ? left.shift() : 0;
        c.picked.push(opts[a]);
        d._choiceEls[a].click();
        await sleep(200);
        continue;
      }
      // (a page with choices waits for them — a Space would pick the first one)
      const line = d._lines?.[d._index];
      if (Array.isArray(line?.choices) && line.choices.length) continue;
      await press('Space', ' ');
    }
    if (state === 'done') await sleep(250);
    return { state, ...c, toasts: PC.toasts.slice(-3) };
  },
  /** Close the tactics panel with Esc (the panel's `cancel`), then let a `party menu` run end. */
  async closeMenu() {
    const g = game();
    await press('Escape', 'Escape');
    const closed = await until(() => !g.party.menuOpen, 3000);
    return { closed };
  },
  /**
   * Teleport the player to (x, z), facing the point (fx, fz) (default: north), snap the camera; the
   * members are put behind the player.
   */
  async put(x, z, fx = x, fz = z - 1) {
    const g = game();
    // (facing first: the members are put behind the way the player faces)
    g.player.faceTowards(g.player.position.x + fx - x, g.player.position.z + fz - z);
    G().teleport(x, z);
    g.player.faceTowards(fx, fz);
    g.rig.snap();
    await sleep(400);
    return [r3(g.player.position.x), r3(g.player.position.z)];
  },
  /**
   * Walk the player through the waypoints with `moveOverride` (before anyone joined: `PF.drive`
   * records the members). Resolves when the last one is reached (or after `timeout` ms).
   * @param {[number, number][]} points
   */
  async walk(points, timeout = 8000) {
    const pl = game().player;
    const t0 = performance.now();
    let i = 0;
    try {
      while (i < points.length && performance.now() - t0 < timeout) {
        const dx = points[i][0] - pl.position.x;
        const dz = points[i][1] - pl.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.25) { i++; continue; }
        pl.moveOverride = { x: dx / d, z: dz / d };
        await frame();
      }
    } finally {
      pl.moveOverride = null;
    }
    return i >= points.length;
  },
  /**
   * Wait `ms` of play: until the game's clock has moved on that much (and at least `ms` of wall
   * time; at most four times that).
   * @param {number} ms
   */
  async settle(ms) {
    const time = game().engine.time;
    const t0 = time.elapsed;
    const w0 = performance.now();
    await sleep(ms);
    await until(() => time.elapsed - t0 >= ms / 1000, ms * 3);
    return { game: r3(time.elapsed - t0), wall: r3((performance.now() - w0) / 1000) };
  },
  /** Every enemy still (no AI) and the player unhurt: the walks and talks below meet no fight. */
  calm(on = true) {
    G().combat.freezeAI(on);
    G().combat.god(on);
    return on;
  },

  // ---- the steps of party.cinderwatch.json (each returns what it saw) -------------------------

  /** Before anyone joined: Sela at her post, the level's story, no party. */
  async s01_before() {
    const r = await PC.ready();
    const g = game();
    const v = PC.villager();
    const s = G().state();
    PC.p0 = PF.programs();
    PC.expect(!!g.combat && !!g.story && !!G().story && !!g.engine.input.bindings.journal, 'Cinderwatch Pass is a combat level with a story now (the journal key B)');
    PC.expect(g.party === null && !('party' in s) && !g.engine.input.bindings.party, 'before a join: no party, no state().party, no G binding');
    PC.expect(!!v && v.present && v.sprite.visible && Math.hypot(v.position.x - 50.8, v.position.z - 78.1) < 0.6, `Sela stands at her post by the Crossroads Waystone (${v && [r3(v.position.x), r3(v.position.z)]})`);
    // (the sheet's resolved spec: createCharacterSheet types it as a plain object)
    const spec = /** @type {{ hat?: string, hair?: string, weapon?: string }} */ (v.sheet.spec ?? {});
    PC.expect(v.def.preset === 'guard' && spec.hair === 'hairWhite' && spec.hat === 'none' && spec.weapon === 'spear', `her look: the guard preset bare-headed, silver hair, the spear (${JSON.stringify({ hat: spec.hat, hair: spec.hair, weapon: spec.weapon })})`);
    PC.expect(Array.isArray(v.storyTalk) && v.storyTalk.length > 0, 'her talk script is parsed');
    PC.calm(true);
    // (the frames below: the legend hidden as with H; each region's arrival banner seen once first —
    // the quarry lip before Sela joins, so its event does not run here)
    g.ui.hud.showHelp(false);
    const banners = [];
    for (const [x, z] of [[48.5, 41.2], [39.6, 50.4], [48.5, 88.6]]) {
      await PC.put(x, z);
      await sleep(300);
      banners.push(g.ui.banner.visible);
      await until(() => !g.ui.banner.visible, 8000);
    }
    PC.expect(!PC.holds('done:ev_sela_lip'), 'without Sela the lip event does not run (its if: party:sela)');
    return { ...r, programs: PC.p0, sela: [r3(v.position.x), r3(v.position.z)], banners, story: G().story.info() };
  },

  /** The player comes up the glade road to the crossroads (a frame for the docs). */
  async s02_arrive() {
    await PC.put(49.4, 82.4, 49.6, 76);
    await PC.walk([[49.6, 80.6]]);
    await sleep(900);
    const P = game().player.position;
    return { player: [r3(P.x), r3(P.z)], dist: r3(PC.dist(50.8, 78.1)) };
  },

  /** The first talk: who she is, the offer (stopped at the choice for a frame). */
  async s03_offer() {
    const c = await PC.talk('sela', [], { stop: true });
    PC.expect(c.ok && c.state === 'choice', `talking to Sela: the offer waits for an answer (${c.state})`);
    PC.expect(/^Easy, traveller\. Sela, of the Cinderwatch/.test(c.pages[0] ?? '') && c.pages.length >= 3 && c.speaker === 'Sela', `the first talk tells who she is (${JSON.stringify(c.pages)})`);
    // (G's dialogue: her last line stays, the question under it — `ask` — with the options)
    PC.expect(c.waiting?.join('|') === 'Walk with me|Not yet' && /^A stone can keep itself/.test(c.pages.at(-1) ?? '') && c.asks.at(-1) === 'Shall my spear walk with you?',
      `the offer: her last line kept, the question asked under it (${JSON.stringify([c.pages.at(-1), c.asks, c.waiting])})`);
    return { pages: c.pages, asks: c.asks, waiting: c.waiting };
  },

  /** "Not yet": nobody joins, no party is made; the talk counted. */
  async s04_notYet() {
    const c = await PC.go([1]);
    const g = game();
    PC.expect(c.state === 'done' && /keep the stone warm/.test(c.pages.at(-1) ?? ''), `"Not yet": her answer (${JSON.stringify(c.pages.at(-1))})`);
    PC.expect(g.party === null && !PC.holds('party:sela') && PC.villager().present, '"Not yet": no party is made, Sela stays');
    const visits = g.story.state.visitsOf('sela');
    PC.expect(visits === 1, `one visit counted (${visits})`);
    return { last: c.pages.at(-1), visits };
  },

  /** The second talk is short; "Walk with me": she joins as a warden, Balanced; her villager hidden. */
  async s05_join() {
    const c = await PC.talk('sela', [0]);
    const g = game();
    const m = PC.info();
    PC.expect(c.state === 'done' && /^Back again\./.test(c.pages[0] ?? '') && c.pages.length <= 3, `the second talk is shorter (${JSON.stringify(c.pages)})`);
    PC.expect(!!m && m.cls === 'warden' && m.preset === 'balanced' && PC.holds('party:sela') && PC.holds('party = 1'), `party join sela as warden balanced: ${JSON.stringify(m)}`);
    PC.expect(PC.toasts.includes('Sela joined your party · G: Tactics'), `the join's toast (${JSON.stringify(PC.toasts)})`);
    await sleep(1500);
    const hidden = PF.checkHidden('Sela joined');
    const leg = document.querySelector('.lu-help')?.textContent ?? '';
    PC.expect(/Party/.test(leg), `the controls legend gains G — Party (${leg.slice(0, 160)})`);
    PC.expect(PF.programs() === PC.p0, `no program compiled by the join (${PF.programs()} / ${PC.p0})`);
    return { pages: c.pages, member: m, hidden, members: PF.brief() };
  },

  /** The party walks: from the glade road up past the stone toward the Ruins road (started; `s06b` waits). */
  async s06_walk() {
    await PC.put(48.5, 88.6);
    const pts = [[48.5, 84.2], [48.5, 81.6], [46.6, 79.4], [44.7, 76.7], [41.6, 75.4]];
    PC.route = PF.checkRoute([48.5, 88.6], pts);
    PC.expect(PC.route.length === 0, `the walk's route is standable (${JSON.stringify(PC.route)})`);
    PF.start(pts, { label: 'the glade road to the Ruins road' });
    await sleep(3300);
    return { members: PF.brief() };
  },

  async s06b_walked() {
    const r = PF.checkDrive(await PF.done());
    // (checkRest's moment after the stop — 2.2 s — of play: of the game's clock, which a slow frame
    // on a busy GPU holds back)
    await PC.settle(2200);
    const rest = await PF.checkRest('after the walk', 0);
    return { drive: r, rest };
  },

  /** Talking to the member: her orders; *Tactics…* opens the tactics panel on her (`party menu sela`). */
  async s07_tactics() {
    const c = await PC.talk('sela', [0]);
    const g = game();
    const panel = PC.panel();
    PC.expect(c.state === 'menu', `Tactics…: the tactics panel opens (${c.state})`);
    PC.expect(c.offered[0]?.join('|') === 'Tactics…|Part ways|Lead on', `the member's choices: ${JSON.stringify(c.offered)}`);
    PC.expect(c.pages.length === 1 && c.asks.join('|') === 'How do you want this spear?', `one of her lines as a member, her question under it (${JSON.stringify([c.pages, c.asks])})`);
    // (the dialog window the run held closes first: its fade may outlast the panel's first frame)
    await until(() => !g.ui.dialog.isOpen, 1500);
    const seen = { panel: !!panel?.isOpen, on: panel?.memberId, menuOpen: G().state().party.menuOpen, dialog: g.ui.dialog.isOpen, run: g.story.run?.key ?? null };
    PC.expect(seen.panel && seen.on === 'sela' && seen.menuOpen && !seen.dialog && !!seen.run, `the panel is open on Sela, the dialog closed, the run waits (${JSON.stringify(seen)})`);
    await sleep(700);
    return { pages: c.pages, offered: c.offered, focus: panel?.focus, preset: panel?.focusedPreset };
  },

  async s07b_closeTactics() {
    const g = game();
    const r = await PC.closeMenu();
    const ended = await until(() => !g.story.run && !g.busy && !g.ui.dialog.isOpen, 4000);
    PC.expect(r.closed && ended, 'Esc closes the panel; the talk ends');
    return { ...r, ended, members: PF.brief() };
  },

  /** Up the Ruins east lane onto the quarry lip: the background event — a bark, Guard Me. */
  async s08_lip() {
    const g = game();
    PC.expect(!PC.holds('done:ev_sela_lip'), 'the lip event has not run yet');
    await PC.put(39.6, 50.4, 39.8, 40);
    const r = await PF.drive([[39.8, 46.2], [40, 43.4], [42.4, 41.8]], { label: 'onto the quarry lip' });
    const ok = await until(() => PC.info()?.preset === 'guardian', 4000);
    PC.expect(ok, `on the quarry lip the story sets Sela's rule to Guard Me (${PC.info()?.preset})`);
    PC.expect(PC.toasts.includes('Sela: Guard Me'), `the rule's toast (${JSON.stringify(PC.toasts)})`);
    PC.expect(PC.barks.some((b) => b.startsWith('Boars on the lip')), `Sela's bark (${JSON.stringify(PC.barks)})`);
    PC.expect(!g.busy && !g.story.run, 'a background run: it held nobody');
    return { drive: { reached: r.reached, members: r.members.map((m) => m.id) }, preset: PC.info()?.preset, barks: PC.barks, trace: PC.traced('ev_sela_lip') };
  },

  async s08b_lipDone() {
    const ok = await until(() => PC.holds('done:ev_sela_lip') && G().story.info().background.length === 0, 6000);
    PC.expect(ok, 'the lip event ran once (done:ev_sela_lip)');
    return { done: PC.holds('done:ev_sela_lip') };
  },

  /** Up the arena road to the caldera stair: the second event — Support. */
  async s09_caldera() {
    await PC.put(48.5, 31.2, 48.5, 20);
    const r = await PF.drive([[48.5, 28.4], [48.5, 25.7]], { label: 'to the caldera stair' });
    const ok = await until(() => PC.info()?.preset === 'support', 4000);
    PC.expect(ok, `at the caldera stair the story sets Sela's rule to Support (${PC.info()?.preset})`);
    PC.expect(PC.toasts.includes('Sela: Support'), `the rule's toast (${JSON.stringify(PC.toasts)})`);
    PC.expect(PC.barks.some((b) => b.startsWith("That's Cinderheart")), `Sela's bark (${JSON.stringify(PC.barks)})`);
    return { reached: r.reached, preset: PC.info()?.preset };
  },

  /** The player changes it back: G, ← to Balanced, Space, Esc — no toast for the player's own change. */
  async s10_playerRule() {
    const g = game();
    const done = await until(() => G().story.info().background.length === 0 && PC.holds('done:ev_sela_caldera'), 6000);
    PC.expect(done, 'the caldera event ran once (done:ev_sela_caldera)');
    const n0 = PC.toasts.length;
    await press('KeyG', 'g');
    const open = await until(() => g.party.menuOpen, 2000);
    const panel = PC.panel();
    const f0 = panel.focusedPreset;
    for (let k = 0; k < 3; k++) await press('ArrowLeft', 'ArrowLeft');
    const f1 = panel.focusedPreset;
    await press('Space', ' ');
    await sleep(200);
    const preset = PC.info()?.preset;
    const r = await PC.closeMenu();
    PC.expect(open && f0 === 'support' && f1 === 'balanced', `G opens the panel on her preset (${f0}); ← ← ← reaches Balanced (${f1})`);
    PC.expect(preset === 'balanced' && r.closed, `the player picks Balanced back (${preset})`);
    PC.expect(PC.toasts.length === n0, `no toast for the player's own change (${JSON.stringify(PC.toasts.slice(n0))})`);
    return { f0, f1, preset };
  },

  /** *Part ways*, asked twice: "No — stay with me" keeps her; "Yes, part ways" — she is a villager again where she stood. */
  async s11_partWays() {
    const g = game();
    const stay = await PC.talk('sela', [1, 0]);
    PC.expect(stay.state === 'done' && PC.holds('party:sela') && /followed you anyway/.test(stay.pages.at(-1) ?? ''), `"No — stay with me": she stays (${JSON.stringify(stay.pages)})`);
    PC._leftAt = null;
    const onLeave = () => { PC._leftAt = { ...PC._lastMemberAt }; };
    const track = setInterval(() => { const mm = PC.member(); if (mm) PC._lastMemberAt = { x: mm.position.x, z: mm.position.z }; }, 0);
    g.party.events.on('leave', onLeave);
    const go = await PC.talk('sela', [1, 1]);
    clearInterval(track);
    g.party.events.off('leave', onLeave);
    const v = PC.villager();
    await sleep(300);
    PC.expect(go.state === 'done' && g.party.count === 0 && !PC.holds('party:sela') && PC.holds('party = 0'), `"Yes, part ways": party leave sela (${JSON.stringify(go.pages)})`);
    PC.expect(/this is where I keep watch/.test(go.pages.at(-1) ?? ''), `her goodbye (${JSON.stringify(go.pages.at(-1))})`);
    // (where the member stood when she left: she stepped up to the player for the talk)
    const left = PC._leftAt;
    PC.expect(!!left && v.present && v.sprite.visible && Math.hypot(v.position.x - left.x, v.position.z - left.z) < 0.2, `her villager is back where the member stood (${[r3(v.position.x), r3(v.position.z)]} / ${left && [r3(left.x), r3(left.z)]})`);
    // (`home sela`: her post is there now — she does not walk back to the crossroads through the player)
    await sleep(1500);
    const P = g.player.position;
    PC.expect(Math.hypot(v.position.x - left.x, v.position.z - left.z) < 0.2 && Math.hypot(v.home.x - left.x, v.home.z - left.z) < 0.2 && Math.hypot(v.position.x - P.x, v.position.z - P.z) > 0.6, `she keeps her new post (${[r3(v.position.x), r3(v.position.z)]}, home ${[r3(v.home.x), r3(v.home.z)]}, the player ${[r3(P.x), r3(P.z)]})`);
    return { stay: stay.pages, go: go.pages, villager: [r3(v.position.x), r3(v.position.z)], player: [r3(P.x), r3(P.z)] };
  },

  /** Re-join: the short offer again; Balanced (a new join); the events stay done. */
  async s12_rejoin() {
    const c = await PC.talk('sela', [0]);
    const m = PC.info();
    PC.expect(c.state === 'done' && /^Back again\./.test(c.pages[0] ?? ''), `the short offer again (${JSON.stringify(c.pages)})`);
    PC.expect(!!m && m.preset === 'balanced' && m.cls === 'warden' && !PC.villager().present, `she joins again, Balanced (${JSON.stringify(m)})`);
    await sleep(800);
    PF.checkHidden('Sela joined again');
    const info = G().story.info();
    PC.expect(info.errors === 0, `no story errors (${info.errors})`);
    PC.expect(PF.programs() === PC.p0, `no program compiled by anything the party or the story did (${PF.programs()} / ${PC.p0})`);
    return { pages: c.pages, member: m, story: info, programs: [PC.p0, PF.programs()], toasts: PC.toasts, barks: PC.barks, failed: PF.failed };
  },

  // ---- Sela in the fights (party combat, PARTY.md §5): the player in god mode never attacks, and
  // Sela cannot be downed (`allyGod`) — her own fighting is checked, not her survival -------------

  /** Sela's fight (MemberCombat) or null. */
  ally() {
    return game().combat.allies?.find((a) => a.id === 'sela') ?? null;
  },
  /** The foes of an enemy group. @param {string} gid */
  foes(gid) {
    return game().combat.enemies.filter((e) => e.uid.startsWith(`${gid}#`));
  },
  /**
   * A fight: the player (god mode, no input) `d` u from group `gid` — toward `angle` (radians from
   * +x; π/2 south) first —, on a standable spot in a clear line to it, the group woken — companions never start a fight. Runs until Sela is mid-attack
   * (two attacks or skills begun, one running), then returns for the frame; `fightEnd` finishes it.
   * @param {string} gid
   * @param {{ d?: number, level?: number, angle?: number }} [o]
   */
  async fight(gid, { d = 7, level = 3, angle = Math.PI / 2 } = {}) {
    const g = game();
    const sys = g.combat;
    const c = G().combat;
    c.freezeAI(false);
    c.god(true);
    // (Sela cannot be downed either — `allyGod`: alone against a pack, with a player who never
    // attacks, a companion can go down since the balance passes (PARTY.md §11 PC25; the enemies are
    // balanced for a party of four now), and a downed one leaves the pack to a god-mode player who
    // never attacks: the fight would never end. What these steps check is her own fighting — her
    // attacks, hits and kills, her rule's leash —, not whether she survives a pack alone)
    c.allyGod(true);
    c.setPlayer({ level });
    const o = g.level.objects.find((x) => x.id === gid);
    let at = [o.x, o.z + d];
    for (let k = 0; k < 16; k++) {
      const a = angle + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
      const x = o.x + Math.cos(a) * d;
      const z = o.z + Math.sin(a) * d;
      if (!sys.standable(x, z) || Math.abs(sys.groundAt(x, z) - sys.groundAt(o.x, o.z)) > 0.6) continue;
      if (sys.nav && !sys.nav.lineClear(x, z, o.x, o.z, 1)) continue;
      at = [x, z];
      break;
    }
    await PC.put(at[0], at[1], o.x, o.z);
    const a = PC.ally();
    PC.expect(!!a && a.member === PC.member(), 'Sela is an ally of the combat (combat.addAlly)');
    const group = PC.foes(gid);
    for (const e of group) c.wake(e.uid);
    PC._fight = { gid, t0: performance.now(), counts0: { ...a.counts }, kills0: a.kills, maxD: 0, active: 0, modes: {} };
    const f = PC._fight;
    const P = g.player.position;
    const ATTACKS = ['a1', 'a2', 'sweep'];
    const mid = await until(() => {
      if (a.active) {
        f.active++;
        f.maxD = Math.max(f.maxD, Math.hypot(a.position.x - P.x, a.position.z - P.z));
      }
      return a.counts.attacks + a.counts.skills - f.counts0.attacks - f.counts0.skills >= 2 && ATTACKS.includes(a.action) && group.some((e) => e.alive);
    }, 30000);
    PC.expect(mid, `Sela fights ${gid}: two attacks begun (${JSON.stringify(a.info())})`);
    return { gid, at: at.map(r3), rule: a.info().preset, ally: a.info() };
  },
  /** Finish the fight started by `fight` (the group dead, or it gave up): Sela's kills and hits. */
  async fightEnd({ maxLeash = Infinity } = {}) {
    const g = game();
    const sys = g.combat;
    const a = PC.ally();
    const f = PC._fight;
    const group = PC.foes(f.gid);
    const P = g.player.position;
    const over = await until(() => {
      if (a.active) {
        f.active++;
        f.maxD = Math.max(f.maxD, Math.hypot(a.position.x - P.x, a.position.z - P.z));
        f.modes[a.mode] = (f.modes[a.mode] ?? 0) + 1;
      }
      return group.every((e) => !e.alive) || (group.every((e) => !e.alive || !e.aggro) && !sys.engaged);
      // (generous: one companion against a pack balanced for a party of four, on a shared GPU)
    }, 120000);
    const info = a.info();
    const out = {
      gid: f.gid, seconds: r3((performance.now() - f.t0) / 1000), cleared: group.every((e) => !e.alive), kills: a.kills - f.kills0,
      hits: info.counts.hits - (f.counts0.hits ?? 0), attacks: info.counts.attacks - f.counts0.attacks, skills: info.counts.skills - f.counts0.skills,
      maxDist: r3(f.maxD), modes: f.modes, hp: info.hp, hpMax: info.hpMax, preset: info.preset, playerHp: sys.pc.hp,
    };
    PC.expect(over, `the fight with ${f.gid} ended (${JSON.stringify(out)})`);
    PC.expect(out.kills >= 1 && out.hits >= 1, `Sela's own kills and hits (the player never attacks): ${JSON.stringify(out)}`);
    PC.expect(out.maxDist <= maxLeash, `Sela stays within her rule's leash of the player (${out.maxDist} ≤ ${maxLeash})`);
    await sleep(1500);
    return out;
  },
  /** The glade: Sela (Balanced) against the goblin pair. */
  async s13_glade() {
    PC.expect(PC.info()?.preset === 'balanced', `Balanced before the glade fight (${PC.info()?.preset})`);
    return PC.fight('glade_goblins', { d: 7, level: 2, angle: Math.PI });
  },
  async s13b_gladeEnd() {
    return PC.fightEnd();
  },
  /**
   * The quarry: the story sets Guard Me (as the lip event does) and Sela fights the terrace goblins
   * at the player's side — never past the Guard Me leash (4 u) and her reach.
   */
  async s14_quarry() {
    await G().story.run(['party rule sela guardian']);
    PC.expect(PC.info()?.preset === 'guardian' && PC.ally()?.info().preset === 'guardian', `the story's rule reaches her fight (${PC.ally()?.info().preset})`);
    // (she comes from the glade fight hurt: full first, as after the story's `heal` — alone against
    // the terrace pack, the player never attacking, she would go down since the balance passes,
    // PARTY.md §11 PC25; `fight` keeps her up with `allyGod` now)
    G().combat.healAllies();
    return PC.fight('quarry_goblins', { d: 7, level: 5 });
  },
  async s14b_quarryEnd() {
    const r = await PC.fightEnd({ maxLeash: 4 + 1.85 + 0.6 });
    PC.calm(true);
    G().combat.allyGod(false);
    PC.expect(PF.programs() === PC.p0, `no program compiled by Sela's fights (${PF.programs()} / ${PC.p0})`);
    return { ...r, programs: [PC.p0, PF.programs()], failed: PF.failed };
  },

  // ---- the companions of the Waystone Camp (s15–s22): Sister Ilse, then Rook — each with Sela in
  // the party (as s14b left her), each the same talk shape as hers --------------------------------

  /**
   * The first talk to companion `id`: at the post with the preset and a talk script, never talked
   * to, not a member; the speaker's plate and title, the pages, the question under the last one,
   * the offer (stopped at the choice for a frame).
   * @param {'ilse'|'rook'} id
   */
  async offer(id) {
    const C = COMPANIONS[id];
    const g = game();
    const v = PC.villagerOf(id);
    PC.expect(!!v && v.present && v.sprite.visible && Math.hypot(v.position.x - C.post[0], v.position.z - C.post[1]) < 0.6,
      `${C.name} stands at the post in the Waystone Camp (${v && [r3(v.position.x), r3(v.position.z)]})`);
    PC.expect(v.behaviour === 'post' && v.def.preset === C.preset && Array.isArray(v.storyTalk) && v.storyTalk.length > 0,
      `${C.name}: a post villager, the ${C.preset} preset, a talk script (${v.behaviour}, ${v.def.preset})`);
    const visits0 = g.story.state.visitsOf(id);
    PC.expect(visits0 === 0 && !PC.holds(`party:${id}`) && !PC.memberOf(id), `${C.name}: never talked to, not a member (${visits0} visits)`);
    PC._n0 = PC.count();
    const c = await PC.talk(id, [], { stop: true });
    PC.expect(c.ok && c.state === 'choice', `talking to ${C.name}: the offer waits for an answer (${c.state}${c.refused ? `; talk refused: ${JSON.stringify(c.refused)}` : ''})`);
    PC.expect(c.speaker === C.name && c.title === C.title, `${C.name}'s name plate and title (${JSON.stringify([c.speaker, c.title])})`);
    PC.expect(c.pages.length === C.pages && C.first.test(c.pages[0] ?? '') && C.last.test(c.pages.at(-1) ?? ''), `${C.name}'s first talk: ${C.pages} pages (${JSON.stringify(c.pages)})`);
    PC.expect(c.waiting?.join('|') === 'Walk with me|Not yet' && c.asks.at(-1) === C.ask,
      `${C.name}'s offer: the question asked under the last line (${JSON.stringify([c.asks, c.waiting])})`);
    return { id, speaker: c.speaker, title: c.title, pages: c.pages, asks: c.asks, waiting: c.waiting, members: PC.ids() };
  },

  /** "Not yet" (the offer `offer` stopped at): no join, the companion stays; one visit counted. @param {'ilse'|'rook'} id */
  async notYet(id) {
    const C = COMPANIONS[id];
    const c = await PC.go([1]);
    PC.expect(c.state === 'done' && C.notYet.test(c.pages.at(-1) ?? ''), `"Not yet": ${C.name}'s answer (${JSON.stringify(c.pages.at(-1))})`);
    PC.expect(PC.count() === PC._n0 && !PC.holds(`party:${id}`) && PC.villagerOf(id).present, `"Not yet": ${C.name} does not join and stays (${PC.ids()})`);
    const visits = game().story.state.visitsOf(id);
    PC.expect(visits === 1, `${C.name}: one visit counted (${visits})`);
    return { last: c.pages.at(-1), visits, members: PC.ids() };
  },

  /**
   * The short second talk and "Walk with me": the companion joins with its class and preset (one
   * more member), the toast, a fight beside the player, its villager hidden, no program compiled.
   * @param {'ilse'|'rook'} id
   */
  async join(id) {
    const C = COMPANIONS[id];
    const n0 = PC.count();
    const t0 = PC.toasts.length;
    const c = await PC.talk(id, [0]);
    const m = PC.infoOf(id);
    PC.expect(c.state === 'done' && c.pages.length === 2 && C.again.test(c.pages[0] ?? '') && C.joined.test(c.pages[1] ?? ''),
      `${C.name}'s second talk is short: a line, the offer, the join (${JSON.stringify(c.pages)})`);
    PC.expect(c.offered[0]?.join('|') === 'Walk with me|Not yet' && c.asks.at(-1) === C.ask, `${C.name}'s offer again (${JSON.stringify([c.asks, c.offered])})`);
    PC.expect(!!m && m.cls === C.cls && m.preset === C.rule && PC.holds(`party:${id}`) && PC.count() === n0 + 1 && PC.holds(`party = ${n0 + 1}`),
      `party join ${id} as ${C.cls} ${C.rule}: ${JSON.stringify(m && { cls: m.cls, preset: m.preset })}, ${PC.count()} members (${PC.ids()})`);
    PC.expect(PC.toasts.slice(t0).includes(C.toast), `${C.name}'s join toast (${JSON.stringify(PC.toasts.slice(t0))})`);
    PC.expect(!!PC.allyOf(id) && PC.allyOf(id).info().cls === C.cls, `${C.name} fights beside the player (combat.addAlly: ${PC.allyOf(id)?.info().cls})`);
    await sleep(1500);
    const hidden = PF.checkHidden(`${C.name} joined`);
    PC.expect(PF.programs() === PC.p0, `no program compiled by ${C.name}'s join (${PF.programs()} / ${PC.p0})`);
    return { pages: c.pages, member: m && { id: m.id, cls: m.cls, preset: m.preset }, members: PF.brief(), hidden };
  },

  /**
   * Talking to the member: one of its orders, its question; *Tactics…* opens the tactics panel on
   * it (`party menu <id>`), the run waiting (Esc: `s07b_closeTactics`).
   * @param {'ilse'|'rook'} id
   */
  async memberTalk(id) {
    const C = COMPANIONS[id];
    const g = game();
    const c = await PC.talk(id, [0]);
    const panel = PC.panel();
    PC.expect(c.state === 'menu', `${C.name}'s Tactics…: the tactics panel opens (${c.state}${c.refused ? `; talk refused: ${JSON.stringify(c.refused)}` : ''})`);
    PC.expect(c.offered[0]?.join('|') === 'Tactics…|Part ways|Lead on', `${C.name}'s choices as a member: ${JSON.stringify(c.offered)}`);
    PC.expect(c.pages.length === 1 && C.orders.includes(c.pages[0]) && c.asks.join('|') === C.memberAsk,
      `one of ${C.name}'s lines as a member, the question under it (${JSON.stringify([c.pages, c.asks])})`);
    await until(() => !g.ui.dialog.isOpen, 1500);
    const seen = { panel: !!panel?.isOpen, on: panel?.memberId, menuOpen: G().state().party.menuOpen, dialog: g.ui.dialog.isOpen, run: g.story.run?.key ?? null, preset: panel?.focusedPreset };
    PC.expect(seen.panel && seen.on === id && seen.menuOpen && !seen.dialog && !!seen.run, `the panel is open on ${C.name}, the dialog closed, the run waits (${JSON.stringify(seen)})`);
    await sleep(700);
    return { pages: c.pages, offered: c.offered, seen, waited: c.waited ?? null };
  },

  /**
   * *Part ways*, asked twice: "No — stay with me" keeps the member; "Yes, part ways" — a villager
   * again where the member stood, keeping that post (`home <id>`); the others stay.
   * @param {'ilse'|'rook'} id
   */
  async partWays(id) {
    const C = COMPANIONS[id];
    const g = game();
    const n0 = PC.count();
    const others = PC.ids().filter((x) => x !== id);
    const stay = await PC.talk(id, [1, 0]);
    PC.expect(stay.state === 'done' && PC.holds(`party:${id}`) && PC.count() === n0 && stay.pages.some((p) => C.sure.test(p)) && C.stay.test(stay.pages.at(-1) ?? ''),
      `"No — stay with me": ${C.name} stays (${JSON.stringify(stay.pages)})`);
    PC._leftAt = null;
    PC._lastMemberAt = null;
    const onLeave = (rec) => { if (rec?.id === id) PC._leftAt = PC._lastMemberAt && { ...PC._lastMemberAt }; };
    const track = setInterval(() => { const mm = PC.memberOf(id); if (mm) PC._lastMemberAt = { x: mm.position.x, z: mm.position.z }; }, 0);
    g.party.events.on('leave', onLeave);
    const go = await PC.talk(id, [1, 1]);
    clearInterval(track);
    g.party.events.off('leave', onLeave);
    const v = PC.villagerOf(id);
    await sleep(300);
    PC.expect(go.state === 'done' && PC.count() === n0 - 1 && !PC.holds(`party:${id}`) && PC.holds(`party = ${n0 - 1}`) && PC.ids().join(',') === others.join(','),
      `"Yes, part ways": party leave ${id}, the others stay (${PC.ids()}; ${JSON.stringify(go.pages)})`);
    PC.expect(go.pages.some((p) => C.sure.test(p)) && C.bye.test(go.pages.at(-1) ?? ''), `${C.name}'s goodbye (${JSON.stringify(go.pages.at(-1))})`);
    // (where the member stood when it left: it stepped up to the player for the talk)
    const left = PC._leftAt;
    PC.expect(!!left && v.present && v.sprite.visible && Math.hypot(v.position.x - left.x, v.position.z - left.z) < 0.2,
      `${C.name}'s villager is back where the member stood (${[r3(v.position.x), r3(v.position.z)]} / ${left && [r3(left.x), r3(left.z)]})`);
    await sleep(1500);
    const P = g.player.position;
    PC.expect(Math.hypot(v.position.x - left.x, v.position.z - left.z) < 0.2 && Math.hypot(v.home.x - left.x, v.home.z - left.z) < 0.2 && Math.hypot(v.position.x - P.x, v.position.z - P.z) > 0.6,
      `${C.name} keeps the new post (${[r3(v.position.x), r3(v.position.z)]}, home ${[r3(v.home.x), r3(v.home.z)]}, the player ${[r3(P.x), r3(P.z)]})`);
    return { stay: stay.pages, go: go.pages, villager: [r3(v.position.x), r3(v.position.z)], members: PC.ids() };
  },

  /** Sister Ilse's first talk at the camp (Sela in the party). */
  async s15_ilseOffer() {
    PC.expect(PC.ids().join(',') === 'sela', `Sela alone in the party before the camp's companions (${PC.ids()})`);
    return PC.offer('ilse');
  },
  async s15b_ilseNotYet() {
    return PC.notYet('ilse');
  },
  /** "Walk with me": Ilse joins as a mystic, Support — the second member. */
  async s16_ilseJoin() {
    const r = await PC.join('ilse');
    PC.expect(PC.ids().join(',') === 'sela,ilse', `Sela and Ilse (${PC.ids()})`);
    return r;
  },
  async s17_ilseTactics() {
    return PC.memberTalk('ilse');
  },
  async s17b_ilseCloseTactics() {
    return PC.s07b_closeTactics();
  },
  async s18_ilsePartWays() {
    return PC.partWays('ilse');
  },
  /** Rook's first talk at the camp (Sela in the party). */
  async s19_rookOffer() {
    return PC.offer('rook');
  },
  async s19b_rookNotYet() {
    return PC.notYet('rook');
  },
  /** "Walk with me": Rook joins as a ranger, Balanced. */
  async s20_rookJoin() {
    const r = await PC.join('rook');
    PC.expect(PC.ids().join(',') === 'sela,rook', `Sela and Rook (${PC.ids()})`);
    return r;
  },
  async s21_rookTactics() {
    return PC.memberTalk('rook');
  },
  async s21b_rookCloseTactics() {
    return PC.s07b_closeTactics();
  },
  async s22_rookPartWays() {
    return PC.partWays('rook');
  },

  // ---- the full party of three (s23–s25) ---------------------------------------------------------

  /**
   * Sela leaves (the hook, at the camp); then Ilse, Rook and Sela join by their talks — Sela as the
   * third hears her line for a company (`if party = 1` … `else`): a full party of three.
   */
  async s23_fullParty() {
    await PC.put(48.5, 113.5);
    PC.expect(G().party.leave('sela') && PC.count() === 0 && PC.villager().present, `Sela leaves (__game.party.leave): nobody in the party (${PC.ids()})`);
    await sleep(600);
    const t0 = PC.toasts.length;
    const ilse = await PC.talk('ilse', [0]);
    const rook = await PC.talk('rook', [0]);
    const n2 = PC.count();
    const sela = await PC.talk('sela', [0]);
    for (const [id, c] of /** @type {const} */ ([['ilse', ilse], ['rook', rook]])) {
      const C = COMPANIONS[id];
      PC.expect(c.state === 'done' && C.again.test(c.pages[0] ?? '') && C.joined.test(c.pages.at(-1) ?? ''), `${C.name} joins again (${JSON.stringify(c.pages)})`);
    }
    PC.expect(n2 === 2 && sela.state === 'done' && /^Back again\./.test(sela.pages[0] ?? '') && /^Then the watch marches with you\./.test(sela.pages.at(-1) ?? ''),
      `Sela joins a company: her other line (if party = 1 … else; ${n2} before her: ${JSON.stringify(sela.pages)})`);
    const ids = PC.ids();
    PC.expect(ids.join(',') === 'ilse,rook,sela' && PC.count() === 3 && PC.holds('party = 3') && PC.holds('party >= 3') && ids.every((id) => PC.holds(`party:${id}`)),
      `a full party of three (${ids})`);
    const brief = ids.map((id) => PC.infoOf(id)).map((m) => `${m.id}:${m.cls}:${m.preset}`).join(' ');
    PC.expect(brief === 'ilse:mystic:support rook:ranger:balanced sela:warden:balanced', `their classes and presets (${brief})`);
    const toasts = PC.toasts.slice(t0);
    PC.expect([COMPANIONS.ilse.toast, COMPANIONS.rook.toast, 'Sela joined your party · G: Tactics'].every((x) => toasts.includes(x)), `the three join toasts (${JSON.stringify(toasts)})`);
    PC.expect(ids.every((id) => !!PC.allyOf(id)), `all three fight beside the player (${game().combat.allies?.map((a) => a.id)})`);
    await sleep(1200);
    const hidden = PF.checkHidden('the full party');
    PC.expect(PF.programs() === PC.p0, `no program compiled by the full party (${PF.programs()} / ${PC.p0})`);
    return { ilse: ilse.pages, rook: rook.pages, sela: sela.pages, members: brief, hidden };
  },

  /** The full party walks across the camp (started; `s23c` waits): the three on their trail points. */
  async s23b_walk() {
    await PC.put(60.5, 114.5, 50, 114.5);
    const pts = [[56.5, 114.5], [50.5, 114.5], [44.5, 114.5]];
    PC.route3 = PF.checkRoute([60.5, 114.5], pts);
    PC.expect(PC.route3.length === 0, `the camp walk's route is standable (${JSON.stringify(PC.route3)})`);
    PF.start(pts, { label: 'the full party across the camp' });
    // (the frame: the player past the campfire, the three in the open behind — by place, not time:
    // a busy GPU draws fewer frames)
    await until(() => game().player.position.x <= 49.5, 15000);
    return { members: PF.brief() };
  },
  async s23c_walked() {
    const r = PF.checkDrive(await PF.done());
    PC.expect(r.members.map((m) => m.id).join(',') === 'ilse,rook,sela', `the three were followed (${r.members.map((m) => m.id)})`);
    await PC.settle(2200);
    const rest = await PF.checkRest('the full party after the walk', 0);
    return { drive: r, rest };
  },

  /** G opens the tactics panel; E steps through the three members (and wraps), Q back; Esc closes it. */
  async s24_tactics3() {
    const g = game();
    await press('KeyG', 'g');
    const open = await until(() => g.party.menuOpen, 2000);
    const panel = /** @type {any} */ (PC.panel());
    const order = PC.ids();
    // (the member shown, its preset card marked current — `is-current` —, and the cursor: it starts
    // on the shown member's preset at the open and stays on its card while Q / E switch members)
    const look = () => {
      const k = panel?._cards?.findIndex((c) => c.el.classList.contains('is-current')) ?? -1;
      return { on: panel?.memberId, current: k >= 0 ? panel._presets[k]?.name : '', cursor: panel?.focusedPreset, tabs: panel?._members?.length };
    };
    const seen = [look()];
    for (const code of ['KeyE', 'KeyE', 'KeyE', 'KeyQ']) {
      await press(code, code.slice(3).toLowerCase());
      await sleep(150);
      seen.push(look());
    }
    const i0 = order.indexOf(seen[0].on);
    const want = [0, 1, 2, 3, 2].map((k) => order[(i0 + k) % 3]);
    PC.expect(open && i0 >= 0 && seen[0].tabs === 3 && seen.map((s) => s.on).join(',') === want.join(','),
      `G opens the panel on one of three members; E E E steps through them and wraps, Q steps back (${JSON.stringify(seen.map((s) => s.on))} / ${want})`);
    const presets = Object.fromEntries(order.map((id) => [id, PC.infoOf(id)?.preset]));
    PC.expect(seen.every((s) => s.current === presets[s.on]) && seen[0].cursor === presets[seen[0].on],
      `each member shown with its own preset marked; the cursor opens on it (${JSON.stringify(seen)} / ${JSON.stringify(presets)})`);
    return { open, order, seen };
  },
  async s24b_closeTactics3() {
    const r = await PC.closeMenu();
    PC.expect(r.closed && PC.count() === 3, `Esc closes the panel (${PC.ids()})`);
    return r;
  },

  /**
   * A fourth join is refused (the hook: `__game.party.join('pip')` → null). Ilse's answer to a full
   * party: she leaves (the hook), Pip joins in her place (the hook: no talk of his offers it) — her
   * talk is her line and no offer; then Pip leaves.
   */
  async s25_fullAnswer() {
    const g = game();
    const pip = PC.villagerOf('pip');
    const r4 = await G().party.join('pip');
    PC.expect(r4 === null && PC.count() === 3 && !PC.memberOf('pip') && !!pip?.present && g.canJoin('pip') === null,
      `a fourth join is refused (__game.party.join('pip') → ${JSON.stringify(r4)}; still ${PC.ids()})`);
    PC.expect(G().party.leave('ilse') && PC.ids().join(',') === 'rook,sela' && PC.villagerOf('ilse').present, `Ilse leaves (__game.party.leave: ${PC.ids()})`);
    const rp = await G().party.join('pip');
    PC.expect(!!rp && PC.ids().join(',') === 'rook,sela,pip' && PC.holds('party = 3'), `Pip joins in her place (__game.party.join: ${PC.ids()})`);
    await sleep(600);
    const c = await PC.talk('ilse', []);
    const C = COMPANIONS.ilse;
    PC.expect(c.ok && c.state === 'done' && c.speaker === C.name && c.pages.length === 2 && C.again.test(c.pages[0] ?? '') && C.full.test(c.pages[1] ?? ''),
      `a full party: Ilse's line instead of the offer (${JSON.stringify(c.pages)})`);
    PC.expect(c.offered.length === 0 && c.asks.length === 0 && !PC.holds('party:ilse') && PC.count() === 3 && PC.villagerOf('ilse').present,
      `no offer to a full party, Ilse stays (${JSON.stringify([c.offered, c.asks])}; ${PC.ids()})`);
    PC.expect(G().party.leave('pip') && PC.ids().join(',') === 'rook,sela' && PC.villagerOf('pip').present, `Pip leaves (__game.party.leave: ${PC.ids()})`);
    return { refused: r4, full: c.pages, members: PC.ids() };
  },

  // ---- the companions' events (s26–s27) ----------------------------------------------------------

  /**
   * Rook in the party, into the Bramble Ruins up the road from the crossroads: the background event
   * — an emote, a bark, Hunt Casters. (The player passed through the ruins in s01 and s08 without
   * him: the event did not run and stayed unspent.)
   */
  async s26_rookRuins() {
    const g = game();
    PC.expect(!PC.holds('done:ev_rook_ruins') && PC.holds('party:rook') && PC.infoOf('rook')?.preset === 'balanced',
      `the ruins event has not run without Rook (s01, s08); Rook in the party, Balanced (${PC.infoOf('rook')?.preset})`);
    const t0 = PC.toasts.length;
    const b0 = PC.barks.length;
    await PC.put(34.5, 75.5, 34.5, 70);
    const r = await PF.drive([[34.5, 72.8], [34.5, 68.5]], { label: 'into the Bramble Ruins' });
    const ok = await until(() => PC.infoOf('rook')?.preset === 'hunter', 6000);
    PC.expect(r.reached && ok, `in the Bramble Ruins the story sets Rook's rule to Hunt Casters (${PC.infoOf('rook')?.preset})`);
    PC.expect(PC.toasts.slice(t0).includes('Rook: Hunt Casters'), `the rule's toast (${JSON.stringify(PC.toasts.slice(t0))})`);
    PC.expect(PC.barks.slice(b0).some((b) => b.startsWith('Archers on the walls')), `Rook's bark (${JSON.stringify(PC.barks.slice(b0))})`);
    PC.expect(PC.traced('ev_rook_ruins').some((l) => / emote$/.test(l)), `Rook's emote (${JSON.stringify(PC.traced('ev_rook_ruins'))})`);
    PC.expect(!g.busy && !g.story.run, 'a background run: it held nobody');
    PC.expect(PC.infoOf('sela')?.preset === 'balanced', `Sela's rule untouched (${PC.infoOf('sela')?.preset})`);
    return { reached: r.reached, rook: PC.infoOf('rook')?.preset, barks: PC.barks.slice(b0), trace: PC.traced('ev_rook_ruins') };
  },
  async s26b_ruinsDone() {
    const ok = await until(() => PC.holds('done:ev_rook_ruins') && G().story.info().background.length === 0, 6000);
    PC.expect(ok, 'the ruins event ran once (done:ev_rook_ruins)');
    return { done: PC.holds('done:ev_rook_ruins') };
  },

  /**
   * Ilse joins again (the third), then up to the caldera stair with Sela and Ilse: Ilse's word
   * (`ev_ilse_caldera`); Sela's Support event keeps quiet while Ilse heals — its guard `party:sela
   * and not party:ilse`. (It ran in s09, Sela alone: its `once` key is taken out of the story's done
   * set here, so what keeps it from running is the guard, not the `once`.)
   */
  async s27_ilseCaldera() {
    const g = game();
    const C = COMPANIONS.ilse;
    const c = await PC.talk('ilse', [0]);
    PC.expect(c.state === 'done' && C.again.test(c.pages[0] ?? '') && C.joined.test(c.pages.at(-1) ?? '') && PC.ids().join(',') === 'rook,sela,ilse' && PC.holds('party = 3'),
      `Ilse joins again, the third (${PC.ids()}; ${JSON.stringify(c.pages)})`);
    PC.expect(!PC.holds('done:ev_ilse_caldera'), 'Ilse\'s caldera event has not run — the player reached the stair without her (s09)');
    const ev = g.level.objects.find((o) => o.id === 'ev_sela_caldera');
    PC._selaKey = G().story.info().done.find((k) => k.endsWith('.ev_sela_caldera')) ?? '';
    const spent = !!PC._selaKey && g.story.state.done.delete(PC._selaKey);
    PC.expect(spent && !PC.holds('done:ev_sela_caldera'), `Sela's caldera event: spent in s09, un-spent for this check (${PC._selaKey})`);
    PC.expect(ev?.if === 'party:sela and not party:ilse' && !PC.holds(ev.if) && PC.holds('party:sela'), `its guard does not hold with Ilse in the party (${ev?.if})`);
    PC._t27 = PC.toasts.length;
    PC._b27 = PC.barks.length;
    await PC.put(48.5, 31.2, 48.5, 20);
    const r = await PF.drive([[48.5, 28.4], [48.5, 25.7]], { label: 'to the caldera stair with Ilse' });
    const ok = await until(() => PC.barks.slice(PC._b27).some((b) => b.startsWith('Cinderheart…')), 6000);
    PC.expect(r.reached && ok, `at the caldera stair Ilse speaks (${JSON.stringify(PC.barks.slice(PC._b27))})`);
    PC.expect(!g.busy && !g.story.run, 'a background run: it held nobody');
    return { reached: r.reached, barks: PC.barks.slice(PC._b27), members: PF.brief() };
  },
  async s27b_calderaDone() {
    const g = game();
    const ok = await until(() => PC.holds('done:ev_ilse_caldera') && G().story.info().background.length === 0, 6000);
    PC.expect(ok, 'Ilse\'s caldera event ran once (done:ev_ilse_caldera)');
    await sleep(1000);
    const sela = PC.infoOf('sela')?.preset;
    const toasts = PC.toasts.slice(PC._t27);
    const barks = PC.barks.slice(PC._b27);
    PC.expect(!PC.holds('done:ev_sela_caldera') && sela === 'balanced' && !toasts.includes('Sela: Support') && !barks.some((b) => b.startsWith("That's Cinderheart")),
      `with Ilse in the party Sela's caldera event does not run: no bark, no Support (${sela}; ${JSON.stringify({ toasts, barks })})`);
    // (spent again, as s09 left it)
    if (PC._selaKey) g.story.state.markDone(PC._selaKey);
    PC.calm(true);
    const info = G().story.info();
    PC.expect(info.errors === 0, `no story errors (${info.errors})`);
    PC.expect(PF.programs() === PC.p0, `no program compiled by the companions, the full party or their events (${PF.programs()} / ${PC.p0})`);
    // (the talks that waited for a busy member, or were refused)
    const waits = PC.talks.filter((t) => t.waited || t.refused).map((t) => ({ id: t.id, waited: t.waited, refused: t.refused }));
    return { members: PC.ids().map((id) => `${id}:${PC.infoOf(id)?.preset}`), story: { done: info.done, errors: info.errors }, programs: [PC.p0, PF.programs()], waits, toasts: PC.toasts, barks: PC.barks, failed: PF.failed };
  },
};

Object.assign(window, { PC });
export default PC;
