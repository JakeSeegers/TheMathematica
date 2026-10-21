/**
 * Combat fixture (COMBAT.md §21) — a small flat test level for the combat core, built in-page (no
 * file in public/levels/): 48 × 40, flat grass at level 2, with
 *  - 3 training dummies, and a slime, goblin, bat, boar and shaman group on open ground;
 *  - a 2-level ledge (level 4, stair flight on its south-east corner) holding 2 archers;
 *  - a chest, two waystones, a drillmaster (Captain Maren) and a draught seller (Bram);
 *  - Cinderheart in an arena (24 × 14 u, level 4) with a rim 2 levels up on N / E / W, a 2-level
 *    cliff to the south and a gate with a 2-tile stair flight, holding two campfires as braziers.
 * Every group uses `spotOffsets`, so the enemies stand exactly where `FIXTURE` says.
 *
 * Scripts play it with `__luminati.playLocal(makeCombatFixture(), 'combat-fixture')` (from the game
 * page) or, from any page of the dev server, `saveCombatFixture()` and then
 * `game.html?level=local:combat-fixture&autostart=1`.
 */
import { createEmptyLevel, addObject, setTile, setHeightLevel, normalizeLevel } from '../src/engine/level/LevelFormat.js';
import { saveLocalLevel } from '../src/engine/level/LevelStorage.js';

/** @import { Level } from '../src/engine/level/types.js' */

export const FIXTURE_SLOT = 'combat-fixture';

/** Named coordinates (world units) for scripts. */
export const FIXTURE = Object.freeze({
  spawn: { x: 24.5, z: 37.5 },
  // dummies (spots −2.5 / 0 / +2.5 around x 33.5); the front spot is 1.7 u south of the middle one
  dummyMid: { x: 33.5, z: 33.5, uid: 'dummies#1' },
  dummyLeft: { x: 31.0, z: 33.5, uid: 'dummies#0' },
  dummyRight: { x: 36.0, z: 33.5, uid: 'dummies#2' },
  dummyFront: { x: 33.5, z: 35.2 },
  slimes: { x: 18.5, z: 30.5, uids: ['slimes#0', 'slimes#1', 'slimes#2'] },
  goblins: { x: 40.5, z: 24.5, uids: ['goblins#0', 'goblins#1'] },
  bats: { x: 14.5, z: 34.5, uids: ['bats#0', 'bats#1'] },
  boar: { x: 41.5, z: 31.5, uid: 'boar#0' },
  shaman: { x: 30.5, z: 26.5, uid: 'shaman#0' },
  // the ledge: tiles x 3–10, z 20–28 at level 4 (y 2.0); the floor around is level 2 (y 1.0)
  ledge: { minX: 3, maxX: 10, minZ: 20, maxZ: 28, y: 2.0 },
  ledgeArchers: { x: 6.5, z: 23.5, uids: ['archers#0', 'archers#1'] },
  archer0: { x: 7.5, z: 22.0 },
  archer1: { x: 8.0, z: 25.0 },
  /** Floor spot 5.5–6 u east of the archers (in their range, below the ledge). */
  ledgeFloor: { x: 13.5, z: 23.5 },
  /** At the foot of the ledge wall / on its rim, 0.9 u apart across the 1 u cliff. */
  ledgeFoot: { x: 10.45, z: 22.5 },
  ledgeRim: { x: 9.55, z: 22.5 },
  ledgeStairs: { x: 11.0, z: 27.0 },
  chest: { x: 44.0, z: 36.5, id: 'chest_fixture' },
  waystoneA: { x: 27.5, z: 36.5, id: 'waystone_camp' },
  waystoneB: { x: 29.5, z: 20.5, id: 'waystone_gate' },
  maren: { x: 37.5, z: 37.5, id: 'maren' },
  bram: { x: 19.5, z: 37.5, id: 'bram' },
  // the boss arena: world rect x 12–36, z 3–17 at level 4 (y 2.0); gate x 22–26 on z 17
  golem: { x: 24, z: 10, uid: 'cinderheart#0' },
  arena: { minX: 12, maxX: 36, minZ: 3, maxZ: 17, y: 2.0 },
  arenaCenter: { x: 24, z: 10 },
  gate: { x: 24, z: 17 },
  gateOutside: { x: 24, z: 20.0 },
  arenaInside: { x: 24, z: 15.0 },
  braziers: [{ x: 17.5, z: 8.5 }, { x: 30.5, z: 8.5 }],
  /** Killed before the ledge-archer shots (nothing else near the player). */
  isolate: ['slimes#0', 'slimes#1', 'slimes#2', 'goblins#0', 'goblins#1', 'bats#0', 'bats#1', 'boar#0', 'shaman#0'],
  /** Killed before the greedy boss run. */
  greedyKill: ['goblins#0', 'goblins#1', 'bats#0', 'bats#1', 'boar#0', 'shaman#0', 'archers#0', 'archers#1', 'slimes#0', 'slimes#1', 'slimes#2'],
});

/** Enemy group: `addObject` + explicit id and relative spots. */
function group(level, id, kind, x, z, spots, extra = {}) {
  const o = addObject(level, 'enemy', x, z, { kind, count: spots.length, radius: 2, level: 1, elite: false, name: '', ...extra });
  o.id = id;
  o.spotOffsets = spots;
  return o;
}

/**
 * @returns {Level} a (raw) luminati-level object — normalise
 *   before use (`playLocal` does).
 */
export function makeCombatFixture() {
  const L = createEmptyLevel({ name: 'Combat Fixture', width: 48, depth: 40, fill: 'g', level: 2, border: 2 });
  L.subtitle = 'A Test Ground for Blades';
  Object.assign(L.environment, { timeOfDay: 16.8, clock: false, weather: 'clear', music: true, dust: false });
  L.spawn = { x: FIXTURE.spawn.x, z: FIXTURE.spawn.z, facing: 'up' };
  const rect = (i0, i1, j0, j1, ch, lvl) => {
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (ch) setTile(L, i, j, ch);
        if (lvl !== undefined) setHeightLevel(L, i, j, lvl);
      }
    }
  };

  // ---- ground variety: a dirt path from the camp to the gate, cobbles around the camp ----
  rect(23, 25, 19, 36, '.');
  rect(19, 30, 35, 38, 'c');
  rect(38, 45, 20, 34, 'G');

  // ---- the ledge (level 4) with a 2-tile stair flight up west at its south-east corner ----
  rect(3, 9, 20, 27, 'm', 4);
  rect(10, 10, 26, 27, '<', 3);
  rect(11, 11, 26, 27, '<', 2);

  // ---- the arena (level 4), rim (level 6, blocked) on N / E / W, a cliff to the south ----
  rect(11, 36, 2, 2, 'x', 6);
  rect(11, 11, 2, 16, 'x', 6);
  rect(36, 36, 2, 16, 'x', 6);
  rect(12, 35, 3, 16, 'k', 4);
  rect(15, 32, 6, 13, 'm');
  rect(20, 27, 8, 11, 'k');
  // the gate: a 2-tile stair flight up north (level 2 → 4)
  rect(22, 25, 18, 18, '^', 2);
  rect(22, 25, 17, 17, '^', 3);

  // ---- combat objects ----
  group(L, 'dummies', 'dummy', 33.5, 33.5, [[-2.5, 0], [0, 0], [2.5, 0]]);
  group(L, 'slimes', 'slime', FIXTURE.slimes.x, FIXTURE.slimes.z, [[-1.5, 0], [0, 1.2], [1.5, 0]]);
  group(L, 'goblins', 'goblin', FIXTURE.goblins.x, FIXTURE.goblins.z, [[-1, 0], [1, 0]]);
  group(L, 'bats', 'bat', FIXTURE.bats.x, FIXTURE.bats.z, [[-1, 0], [1, 0.5]]);
  group(L, 'boar', 'boar', FIXTURE.boar.x, FIXTURE.boar.z, [[0, 0]], { radius: 1.5 });
  group(L, 'shaman', 'shaman', FIXTURE.shaman.x, FIXTURE.shaman.z, [[0, 0]], { radius: 1.5 });
  group(L, 'archers', 'archer', FIXTURE.ledgeArchers.x, FIXTURE.ledgeArchers.z, [[1, -1.5], [1.5, 1.5]], { radius: 1.5 });
  const golem = group(L, 'cinderheart', 'golem', FIXTURE.golem.x, FIXTURE.golem.z, [[0, 0]], { radius: 1, level: 6, name: 'Cinderheart' });
  golem.arena = { minX: -12, maxX: 12, minZ: -7, maxZ: 7 };
  golem.gate = [-2, 7, 2, 7];
  for (const b of FIXTURE.braziers) addObject(L, 'campfire', b.x, b.z);

  const chest = addObject(L, 'chest', FIXTURE.chest.x, FIXTURE.chest.z, { gold: 20, potions: 1, upgrade: 'attack' });
  chest.id = FIXTURE.chest.id;
  const wa = addObject(L, 'waystone', FIXTURE.waystoneA.x, FIXTURE.waystoneA.z, { name: 'Camp Waystone' });
  wa.id = FIXTURE.waystoneA.id;
  const wb = addObject(L, 'waystone', FIXTURE.waystoneB.x, FIXTURE.waystoneB.z, { name: 'Gate Waystone' });
  wb.id = FIXTURE.waystoneB.id;

  // ---- people ----
  const maren = addObject(L, 'npc', FIXTURE.maren.x, FIXTURE.maren.z, {
    name: 'Captain Maren', preset: 'swordsman', behaviour: 'post', facing: 'left', script: 'drillmaster',
    dialogue: ['Keep your guard up, traveler.', 'The dummies do not hit back. Everything past the gate does.'],
  });
  maren.id = FIXTURE.maren.id;
  const bram = addObject(L, 'npc', FIXTURE.bram.x, FIXTURE.bram.z, {
    name: 'Bram', preset: 'merchant', behaviour: 'post', facing: 'right', action: 'shop', item: 'Healing Draught', script: 'shopkeeper',
    dialogue: ['Draughts! Fresh draughts! Bottled courage, twenty-five gold a flask.', 'Whetstones and tonic too, if your purse is heavy.'],
  });
  bram.id = FIXTURE.bram.id;
  return L;
}

/**
 * Save the fixture (normalised) into this browser's level storage; open it with
 * `game.html?level=local:<slot>&autostart=1`.
 * @param {string} [slot]
 * @returns {string} the slot
 */
export function saveCombatFixture(slot = FIXTURE_SLOT) {
  const { level, warnings } = normalizeLevel(makeCombatFixture());
  if (warnings.length) console.warn('[combat_fixture]', warnings.join('; '));
  return saveLocalLevel(slot, level);
}

// =============================================================================================
// Scripted checks (sandbox/combat.*.json): each returns a result object; a failed assertion
// throws asynchronously (the harness exits 1, TOOL-01) and is listed in `result.failures`.
// =============================================================================================

/** Wait until the game page finished loading (`__luminati.loadMs`) and lock the resolution governor. */
export async function ready(timeoutMs = 60000) {
  const t0 = performance.now();
  while (!(window.__luminati && window.__luminati.loadMs && window.__game)) {
    if (performance.now() - t0 > timeoutMs) throw new Error('combat fixture: the game did not load');
    await new Promise((r) => setTimeout(r, 100));
  }
  const g = window.__game;
  g.game.resolution.enabled = false;
  g.engine.renderScale = 1;
  return g;
}

function checker(name) {
  const failures = [];
  const check = (ok, msg, detail) => {
    if (ok) return true;
    const text = `[${name}] ${msg}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`;
    failures.push(text);
    setTimeout(() => { throw new Error(text); });
    return false;
  };
  return { failures, check };
}

/**
 * Named points of either set: FIXTURE's, or `cinderwatch()`'s (fewer points, plus `nav`).
 * @typedef {Partial<typeof FIXTURE> & Partial<ReturnType<typeof cinderwatch>>} FixturePoints
 */
/**
 * The coordinates the checks run with: FIXTURE (default) or `cinderwatch()` — select with
 * `use(points)` before calling a test.
 * @type {FixturePoints}
 */
let P = FIXTURE;
/**
 * @param {FixturePoints|(() => FixturePoints)} [points]  a point set, or a function resolving one now
 * @returns {FixturePoints}
 */
export function use(points = FIXTURE) {
  P = typeof points === 'function' ? points() : points;
  return P;
}

const G = () => window.__game;
const C = () => window.__game.combat;
const enemy = (uid) => C().system.enemies.find((e) => e.uid === uid);
/** The player's action and combo are over (`stepUntil(idle)`). */
const idle = () => {
  const pc = C().system.pc;
  return pc.action === null && pc.combo === 0;
};
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * A clean, frozen fixture: seed 1, reset, AI frozen, no overrides, the player at (x, z).
 *
 * It also marks combat as running in the frame before (`_wasActive`), which `reset()` leaves as it
 * was: whether the real-time frames between two eval steps ran while combat was active is a matter
 * of wall-clock timing. After a conversation (the shop) its dialog closes on a real 320 ms timeout;
 * when no real frame ran between that and the next test, the next test's first stepped frame was a
 * "resuming" one, and the resume guard dropped the press made before it — the flaky `[ledge]`
 * "Ember Bolt from the floor hits a ledge archer" (`[]`, KNOWN_ISSUES TOOL-19). With the flag set
 * the first frame never resumes (unless a dialog is really open: then it is inactive anyway).
 */
function fresh(x = P.spawn.x, z = P.spawn.z, { freeze = true } = {}) {
  const c = C();
  c.seed(1);
  c.reset();
  c.freezeAI(freeze);
  c.god(false);
  c.aim(null);
  c.move(null);
  G().teleport(x, z);
  c.system._wasActive = true;
  return c;
}

/**
 * Record every HUD toast's text while it is shown (the HUD removes a toast ~3 s later on a real
 * timer, so a check that reads the DOM after a slow stretch finds nothing). `stop()` restores
 * `toast`.
 * @returns {{ texts: string[], stop: () => void }}
 */
function recordToasts() {
  const hud = G().game.ui.hud;
  const own = Object.prototype.hasOwnProperty.call(hud, 'toast');
  const keep = hud.toast;
  /** @type {string[]} */
  const texts = [];
  hud.toast = function recordToast(text, ...rest) {
    texts.push(String(text ?? ''));
    return keep.call(this, text, ...rest);
  };
  return {
    texts,
    stop() {
      if (own) hud.toast = keep;
      else delete hud.toast;
    },
  };
}

/** Real time (a closing DialogBox resolves its page after a real 320 ms timeout). */
const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));

/** A real confirm key (Space) as the player presses it, over two stepped frames: pages advance, a choice is taken. */
function pressConfirm() {
  const c = C();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
  c.step(1);
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
  c.step(1);
}

/**
 * Leave Bram's shop menu open for a screenshot (the end of `combat.fight.json`): 180 gold, the
 * pages confirmed until the choice list is up.
 * @param {string} [npc]  the seller's id
 * @returns {string} the menu's labels, as a JSON array
 */
export function shopMenuShot(npc = 'bram') {
  const c = fresh();
  c.setPlayer({ gold: 180 });
  G().teleport(P.bram.x - 1.2, P.bram.z);
  c.step(2);
  G().talkTo(npc);
  const dlg = G().game.ui.dialog;
  for (let k = 0; k < 40 && !dlg.isChoosing; k++) {
    pressConfirm();
    c.step(10);
  }
  return JSON.stringify(dlg._choiceEls.map((li) => li.querySelector('.lu-choice__label')?.textContent ?? ''));
}

/** Record events of the combat system while `fn` runs. */
function record(fn) {
  const sys = C().system;
  const log = { hits: [], hurts: [], kills: [], levelups: [] };
  const on = {
    hit: (t, d, crit, src) => log.hits.push({ uid: t?.uid ?? t, d, crit, src }),
    playerHurt: (d) => log.hurts.push(d),
    kill: (e) => log.kills.push(e.uid),
    levelup: (l) => log.levelups.push(l),
  };
  for (const k in on) sys.events.on(k, on[k]);
  try {
    return { out: fn(), log };
  } finally {
    for (const k in on) sys.events.off(k, on[k]);
  }
}

export const tests = {
  /**
   * The deterministic stepped combo on the middle dummy (COMBAT.md §21), run twice: 3 hits,
   * each within its damage band, combo back to 0, identical states.
   */
  combo() {
    const { failures, check } = checker('combo');
    const F = P;
    const run = () => record(() => {
      const c = fresh(F.dummyFront.x, F.dummyFront.z);
      c.aim(F.dummyMid.x, F.dummyMid.z);
      c.press('attack');
      const a = c.step(14);
      c.press('attack');
      const b = c.step(15);
      c.press('attack');
      // (A3 and its recovery: hit-stop freezes whole sub-steps — wait for the state, COMBAT-04)
      const n = c.stepUntil(idle, 120);
      const s = c.state();
      return { a, b, s, n };
    });
    const r1 = run();
    const r2 = run();
    const { s } = r1.out;
    const atk = s.player.atk;
    const mvs = [1.0, 1.1, 1.8];
    check(r1.log.hits.length === 3, '3 hits', r1.log.hits);
    r1.log.hits.forEach((h, i) => {
      check(h.uid === F.dummyMid.uid, `hit ${i + 1} on the middle dummy`, h);
      const lo = Math.max(1, Math.round(atk * mvs[i] * 0.92));
      const hi = Math.round(atk * mvs[i] * 1.08 * 1.75);
      check(h.d >= lo && h.d <= hi, `hit ${i + 1} within [${lo}, ${hi}]`, h);
    });
    check(r1.out.n > 0 && s.player.combo === 0 && s.player.action === null, 'combo reset to A1 afterwards', { combo: s.player.combo, action: s.player.action, frames: r1.out.n });
    check(JSON.stringify(r1.out.s) === JSON.stringify(r2.out.s), 'two runs give identical states');
    check(JSON.stringify(r1.log.hits) === JSON.stringify(r2.log.hits), 'two runs give identical hits');
    return { hits: r1.log.hits, total: r1.log.hits.reduce((n, h) => n + h.d, 0), sp: s.player.sp, mp: s.player.mp, failures };
  },

  /** SP / MP costs, the skill cooldown refusal, the Lv 2 lock of Ember Bolt, dodges, the draught. */
  costs() {
    const { failures, check } = checker('costs');
    const c = fresh(P.dummyFront.x, P.dummyFront.z);
    c.press('attack');
    let s = c.step(1);
    check(s.player.action === 'attack' && s.player.sp === 95, 'A1 costs 5 SP', s.player);
    check(c.stepUntil(idle, 120) > 0, 'A1 ends');
    c.press('skill1');
    s = c.step(1);
    check(s.player.action === 'skill1' && Math.abs(s.player.mp - 30) < 0.1 && s.player.cooldowns[0] > 3.9, 'Whirl Slash: 10 MP, 4 s cooldown', s.player);
    s = c.step(50);
    const mp = s.player.mp;
    c.press('skill1');
    s = c.step(2);
    check(s.player.action === null && s.player.mp < mp + 0.1, 'Whirl Slash refused on cooldown', s.player);
    c.press('skill2');
    s = c.step(2);
    check(s.player.action === null, 'Ember Bolt refused at Lv 1 (locked)', s.player);
    c.press('dodge');
    s = c.step(1);
    check(s.player.action === 'backstep' && s.player.sp < 100, 'backstep without move input (15 SP)', s.player);
    c.step(30);
    c.move(1, 0);
    c.press('dodge');
    s = c.step(2);
    c.move(null);
    check(s.player.action === 'roll' && s.player.invulnerable, 'roll with move input, invulnerable', s.player);
    c.step(40);
    c.setPlayer({ hp: 50 });
    c.press('draught');
    s = c.step(20);
    check(s.player.potions === 2 && s.player.hp === 90, 'draught heals 40 % at f18', s.player);
    return { failures };
  },

  /**
   * `zoneAt` follows the location plate's rule (Game `_updateRegion`, COMBAT-19 review): the first
   * region containing the point wins, and a region with `minY` holds only ground above that height.
   * Two made-up regions stand in for the level's for the call (restored afterwards).
   */
  zones() {
    const { failures, check } = checker('zones');
    const sys = C().system;
    const keep = sys.zones;
    try {
      sys.zones = [
        { id: 'hill', minX: 0, maxX: 10, minZ: 0, maxZ: 10, minY: 1.5 },
        { id: 'vale', minX: 0, maxX: 20, minZ: 0, maxZ: 20, minY: null },
      ];
      const r = { low: sys.zoneAt(5, 5, 1.0), high: sys.zoneAt(5, 5, 2.0), noY: sys.zoneAt(5, 5), vale: sys.zoneAt(15, 5, 2.0), none: sys.zoneAt(25, 5, 0) };
      check(r.low === 1 && r.high === 0 && r.noY === 0 && r.vale === 1 && r.none === -1, 'zoneAt: first match; a region with minY only above that height', r);
      return { ...r, failures };
    } finally {
      sys.zones = keep;
    }
  },

  /** Level-up from a kill: level +1, the announcer card. */
  async levelUp() {
    const { failures, check } = checker('levelUp');
    const c = fresh();
    const s0 = c.state();
    c.setPlayer({ xp: s0.player.xpNext - 1 });
    const { log } = record(() => c.damage(P.slimes.uids[0], 9999));
    const s = c.step(2);
    await new Promise((r) => setTimeout(r, 60)); // the announcer shows on its queue (a microtask later)
    const card = document.querySelector('.lu-announce');
    check(s.player.level === 2, 'level 2', s.player);
    check(log.levelups[0] === 2, 'levelup event', log);
    check(s.player.hp === s.player.hpMax && s.player.mp === s.player.mpMax, 'full HP / MP after the level-up', s.player);
    check(!!card && /lu-announce--level/.test(card.className), '.lu-announce visible', card?.className);
    return { level: s.player.level, card: card?.textContent?.trim(), failures };
  },

  /**
   * The combat shop (the gold sink, rules.js SHOP_WARES): prices, each one-time ware applied once
   * (ATK, max HP, DEF) and then sold out, draughts up to the carry cap, too little gold refused, the
   * `purchase` event; then Bram's `shopkeeper` menu through the real dialogue — "Nothing more"
   * first, a ware bought from the list, sold-out wares gone from it; a later visit's "Tell me again"
   * and "(not enough)" marks; the shop shut while engaged — and the reset hook restocking.
   */
  async shop({ npc = 'bram' } = {}) {
    const { failures, check } = checker('shop');
    const c = fresh();
    const sys = c.system;
    const bought = [];
    const onBuy = (item, price) => bought.push([item, price]);
    sys.events.on('purchase', onBuy);
    const toastLog = recordToasts();
    try {
      const offers = sys.shopOffers();
      const price = Object.fromEntries(offers.map((o) => [o.name, o.price]));
      check(offers.map((o) => `${o.name}:${o.gain}`).join(' ') === 'Healing Draught:heals 40 % Whetstone:ATK +2 Ironbark Tonic:Max HP +15 Warding Charm:DEF +3', 'the wares, in menu order', offers);
      check(price['Healing Draught'] === 25 && offers.every((o) => o.price > 0) && sys.priceOf('Crisp Apple') === null, 'prices: the draught 25 (§6.12), anything else not for sale', price);
      c.setPlayer({ gold: price.Whetstone - 1, potions: 3 });
      check(sys.buy('Whetstone').reason === 'gold' && sys.pc.gold === price.Whetstone - 1, 'too little gold: refused, nothing taken');
      c.setPlayer({ gold: 1000 });
      let g = 1000;
      const s0 = c.state().player;
      const w = sys.buy('Whetstone');
      const s1 = c.state().player;
      g -= price.Whetstone;
      check(w.ok && s1.atk === s0.atk + 2 && s1.gold === g, 'Whetstone: ATK +2', { s0, s1 });
      check(sys.buy('Whetstone').reason === 'sold' && c.state().player.gold === g, 'the Whetstone sells once');
      sys.buy('Ironbark Tonic');
      const s2 = c.state().player;
      g -= price['Ironbark Tonic'];
      check(s2.hpMax === s0.hpMax + 15 && s2.hp === s0.hp + 15 && s2.gold === g, 'Ironbark Tonic: max HP +15 (and HP)', s2);
      sys.buy('Warding Charm');
      const s3 = c.state().player;
      g -= price['Warding Charm'];
      check(s3.def === s0.def + 3 && s3.gold === g, 'Warding Charm: DEF +3', s3);
      check(sys.buy('Healing Draught').ok && sys.buy('Healing Draught').ok && sys.buy('Healing Draught').reason === 'full', 'draughts up to the carry cap of 5', c.state().player);
      check(c.state().player.potions === 5 && c.state().player.gold === g - 50, '2 draughts for 50', c.state().player);
      check(bought.map((b) => b[0]).join(',') === 'Whetstone,Ironbark Tonic,Warding Charm,Healing Draught,Healing Draught', 'purchase events', bought);
      const left = sys.shopOffers();
      check(left.filter((o) => o.sold).length === 3 && left[0].reason === 'full', 'offers: three sold out, the draught full', left);
      check(JSON.stringify(c.state().shop.purchased) === '["whetstone","tonic","charm"]', 'state().shop', c.state().shop);
      // the menu, through the real dialogue (a closing dialog resolves its page after 320 ms of
      // real time, so the conversation's next step needs real waits between the stepped frames)
      c.reset();
      c.setPlayer({ gold: price.Whetstone + 30, potions: 3 });
      G().teleport(P.bram.x - 1.2, P.bram.z);
      c.step(2);
      check(G().talkTo(npc), `talking to ${npc} starts`);
      const dlg = G().game.ui.dialog;
      const labels = () => dlg._choiceEls.map((li) => li.querySelector('.lu-choice__label')?.textContent ?? '');
      const atk0 = c.state().player.atk;
      const toMenu = async () => {
        for (let k = 0; k < 60 && !dlg.isChoosing; k++) {
          pressConfirm();
          c.step(10);
          await waitMs(40);
        }
        c.step(20); // (past the choice guard)
        return dlg.isChoosing;
      };
      await toMenu();
      const menu1 = labels();
      check(dlg.isChoosing && menu1[0] === 'Nothing more' && menu1.length === 5 && menu1[2] === `Whetstone (ATK +2) — ${price.Whetstone} gold`, 'the menu: "Nothing more" first, then the four wares with gain and price', menu1);
      dlg._setChoice(2, true);
      pressConfirm();
      await waitMs(400);
      await toMenu();
      const menu2 = labels();
      check(c.state().player.atk === atk0 + 2 && c.state().player.gold === 30, 'bought the Whetstone from the menu', c.state().player);
      check(dlg.isChoosing && menu2.length === 4 && !menu2.some((l) => l.startsWith('Whetstone')), 'the Whetstone is gone from the menu', menu2);
      dlg._setChoice(0, true);
      pressConfirm(); // "Nothing more"
      for (let k = 0; k < 30 && (dlg.isOpen || G().game.busy); k++) {
        await waitMs(120);
        pressConfirm();
        c.step(10);
      }
      check(!dlg.isOpen && !G().game.busy, 'the conversation ends');
      // (the texts passed to HUD.toast, recorded when shown: the DOM toast may be gone by now)
      const toasts = toastLog.texts;
      check(toasts.some((t) => t === `Obtained: Whetstone — ATK ${atk0} → ${atk0 + 2}`), 'the upgrade toast shows the change (ATK a → b)', toasts);
      // a later visit: its last page only, "Tell me again" (the earlier pages) last in the menu, the
      // menu line with ATK and DEF, wares the gold does not reach marked
      c.setPlayer({ gold: 10 });
      check(G().talkTo(npc), `talking to ${npc} again starts`);
      await toMenu();
      const menu3 = labels();
      const text3 = dlg._textEl.textContent;
      check(dlg.isChoosing && menu3.at(-1) === 'Tell me again' && menu3.length === 5 && menu3.slice(1, -1).every((l) => l.endsWith('(not enough)')),
        'a later visit: "Tell me again" last, the wares out of reach marked "(not enough)"', menu3);
      check(/You carry 10 gold · ATK \d+ · DEF \d+\./.test(text3), 'the menu line shows the gold, ATK and DEF', text3);
      dlg._setChoice(menu3.length - 1, true);
      pressConfirm(); // "Tell me again": the earlier pages, then the menu again
      await waitMs(400);
      let heard = '';
      for (let k = 0; k < 60 && !dlg.isChoosing; k++) {
        if (dlg.isOpen && !heard) heard = dlg._textEl.textContent;
        pressConfirm();
        c.step(10);
        await waitMs(40);
      }
      c.step(20);
      const pages = (G().game.level.objects.find((o) => o.id === npc)?.dialogue ?? []).filter((d) => typeof d === 'string');
      check(dlg.isChoosing && pages.length > 1 && heard.length > 0 && pages[0].startsWith(heard.slice(0, 12)), '"Tell me again" replays the earlier pages, then the menu', { heard, first: pages[0] });
      dlg._setChoice(0, true);
      pressConfirm();
      for (let k = 0; k < 30 && (dlg.isOpen || G().game.busy); k++) {
        await waitMs(120);
        pressConfirm();
        c.step(10);
      }
      check(!dlg.isOpen && !G().game.busy, 'the second conversation ends');
      // like resting, the shop is shut while foes are engaged (the script reads it as it starts)
      sys.engaged = true;
      check(G().talkTo(npc), `talking to ${npc} while engaged starts`);
      c.step(30);
      await waitMs(200);
      c.step(30);
      const shut = { text: dlg._textEl.textContent, choosing: dlg.isChoosing };
      for (let k = 0; k < 30 && (dlg.isOpen || G().game.busy); k++) {
        pressConfirm();
        c.step(10);
        await waitMs(120);
      }
      check(/^Not with foes/.test(shut.text) && !shut.choosing && !dlg.isOpen, 'engaged: the shop refuses, no menu', shut);
      c.reset();
      check(sys.shopOffers().every((o) => !o.sold), 'reset() restocks the wares');
      return { menu1, menu2, bought: bought.length, failures };
    } finally {
      sys.events.off('purchase', onBuy);
      toastLog.stop();
    }
  },

  /**
   * Walk-grid checks at the Ruins ledge stair (Cinderwatch only: `use(cinderwatch)`; the fixture
   * level has no `nav` points and skips it). God mode, stepped, seed 1.
   * - COMBAT-18: a ledge archer sent home from the court floor at the stair's foot or beside the
   *   cliff walks home up the stair — no snap, no fade — within 600 frames.
   * - COMBAT-06: a court goblin with the player at the edge of the ledge above (in its wind-up
   *   range) takes the stair and reaches the player's level within 300 frames, without winding up
   *   below the cliff.
   * - A ledge archer in a nook (walls east and south, the player 1.5 u away): its retreat takes a
   *   way the body fits, or strafes when cornered — it never stands still in engage for > 30 f.
   * - The player running up and down the stair between the ledge and the court (`kiteLegs` legs,
   *   seeded pauses) with the Ruins packs awake: no enemy gives up (`stuck` or `unreachable`) —
   *   the player is reachable all the time.
   */
  nav({ kiteLegs = 14 } = {}) {
    const { failures, check } = checker('nav');
    const N = P.nav;
    if (!N) return { skipped: 'no nav points (use(cinderwatch))', failures };
    const c0 = C();
    const out = { returns: [], climbs: [], kite: null };
    const sleepOthers = (keep) => {
      for (const o of c0.system.enemies) if (o !== keep && !o.boss && !o.isAdd && o.alive) o.sleep();
    };
    const setup = (px, pz) => {
      const c = fresh(px, pz, { freeze: false });
      c.god(true);
      return c;
    };
    // COMBAT-18: home from the stair's foot
    for (const r of N.returns) {
      const c = setup(N.returnPlayer.x, N.returnPlayer.z);
      const e = enemy(r.uid);
      sleepOthers(e);
      e.position.set(r.x, c.system.groundAt(r.x, r.z), r.z);
      e.dormant = false;
      e.sendHome(c.system.ctx);
      let jumps = 0;
      let minOp = 1;
      let lx = e.position.x;
      let lz = e.position.z;
      const n = c.stepUntil(() => {
        if (Math.hypot(e.position.x - lx, e.position.z - lz) > 0.6) jumps++;
        lx = e.position.x;
        lz = e.position.z;
        minOp = Math.min(minOp, e.sprite.opacity);
        return e.state !== 'return';
      }, 600);
      const res = { from: [r.x, r.z], frames: n, jumps, minOpacity: +minOp.toFixed(3), state: e.state, at: [+e.position.x.toFixed(2), +e.position.z.toFixed(2)] };
      out.returns.push(res);
      check(n >= 0 && e.state === 'idle' && jumps === 0 && minOp === 1, `${r.uid} walks home from (${r.x}, ${r.z}) up the stair (no snap, no fade)`, res);
    }
    // COMBAT-06: up the stair to a player at the ledge's edge
    for (const pt of N.edges) {
      const c = setup(pt.x, pt.z);
      const e = enemy(N.climber.uid);
      sleepOthers(e);
      e.position.set(N.climber.x, c.system.groundAt(N.climber.x, N.climber.z), N.climber.z);
      e.dormant = false;
      c.step(1);
      c.wake(e.uid);
      const Pp = G().player.position;
      let low = 0;
      let prev = e.state;
      const n = c.stepUntil(() => {
        if (e.state === 'windup' && prev !== 'windup' && Pp.y - e.position.y > 0.6) low++;
        prev = e.state;
        return Math.abs(e.position.y - Pp.y) < 0.3 && Math.hypot(e.position.x - Pp.x, e.position.z - Pp.z) < 2;
      }, 300);
      const res = { player: [pt.x, pt.z], frames: n, lowWindups: low, state: e.state };
      out.climbs.push(res);
      check(n >= 0 && low === 0, `${e.uid} climbs to a player at the ledge edge (${pt.x}, ${pt.z}) within 300 frames, no wind-up below`, res);
    }
    // a cornered archer does not press itself into the wall (the player held beside it)
    if (N.corner) {
      const K = N.corner;
      const c = setup(K.player.x, K.player.z);
      const e = enemy(K.uid);
      sleepOthers(e);
      e.position.set(K.x, c.system.groundAt(K.x, K.z), K.z);
      e.dormant = false;
      c.step(1);
      c.wake(e.uid);
      const Pp = G().player.position;
      let still = 0;
      let maxStill = 0;
      let lx = e.position.x;
      let lz = e.position.z;
      for (let f = 0; f < 300; f++) {
        if (Math.hypot(Pp.x - K.player.x, Pp.z - K.player.z) > 0.05) G().teleport(K.player.x, K.player.z);
        c.step(1);
        const d = Math.hypot(e.position.x - lx, e.position.z - lz);
        still = e.state === 'engage' && d < 1e-3 ? still + 1 : 0;
        maxStill = Math.max(maxStill, still);
        lx = e.position.x;
        lz = e.position.z;
      }
      out.corner = { maxStill, at: [+e.position.x.toFixed(2), +e.position.z.toFixed(2)], state: e.state };
      check(maxStill <= 30, `${e.uid} cornered next to the player: never stands still in engage for more than 30 frames`, out.corner);
    }
    // kiting up and down the stair: nobody gives up while the player is reachable
    {
      const K = N.kite;
      const c = setup(K.b.x, K.b.z);
      const way = c.path(K.a.x, K.a.z, K.b.x, K.b.z) ?? [[K.b.x, K.b.z]];
      const toB = way.map(([x, z]) => ({ x, z }));
      const toA = [...toB.slice(0, -1).reverse(), { x: K.a.x, z: K.a.z }];
      const list = K.uids.map(enemy).filter(Boolean);
      const gave = [];
      for (const e of list) {
        e.sendHome = function sendHomeWatched(ctx) {
          if (this.state === 'engage' && (this.stuck || this.unreachable)) {
            const Pp = G().player.position;
            gave.push({ uid: this.uid, why: this.stuck ? 'stuck' : 'unreachable', e: [+this.position.x.toFixed(2), +this.position.z.toFixed(2)], P: [+Pp.x.toFixed(2), +Pp.z.toFixed(2)] });
          }
          return Object.getPrototypeOf(this).sendHome.call(this, ctx);
        };
      }
      const shift = (type) => window.dispatchEvent(new KeyboardEvent(type, { code: 'ShiftLeft', key: 'Shift', bubbles: true }));
      const legs = [];
      let frames = 0;
      try {
        c.step(60);
        shift('keydown');
        const pos = G().player.position;
        for (let i = 0; i < kiteLegs; i++) {
          const pts = i % 2 ? toB : toA;
          let k = 0;
          let f = 0;
          for (; f < 480 && k < pts.length; f++) {
            const dx = pts[k].x - pos.x;
            const dz = pts[k].z - pos.z;
            if (Math.hypot(dx, dz) < 0.3) {
              k++;
              f--;
              continue;
            }
            c.move(dx, dz);
            c.step(1);
          }
          c.move(0, 0);
          const pause = 18 + ((i * 17 + 29) % 45);
          c.step(pause);
          frames += f + pause;
          legs.push(f);
        }
      } finally {
        shift('keyup');
        c.move(null);
        for (const e of list) delete e.sendHome;
      }
      const aggro = list.filter((e) => e.aggro).length;
      out.kite = { legs: legs.join(','), frames, gaveUp: gave, aggroAtEnd: aggro };
      check(gave.length === 0, 'kiting up and down the Ruins stair: no enemy gives up while the player is reachable', out.kite);
    }
    out.failures = failures;
    return out;
  },

  /**
   * Ledge shots (the height model): the player's Ember Bolt from the floor hits a ledge archer;
   * a melee swing from the foot of the 1 u cliff does not; a woken ledge archer hits the player
   * on the floor.
   */
  ledge({ archerSteps = 480 } = {}) {
    const { failures, check } = checker('ledge');
    const F = P;
    // Ember Bolt up onto the ledge
    let c = fresh(F.ledgeFloor.x, F.ledgeFloor.z);
    c.setPlayer({ level: 2 });
    c.aim(F.archer0.x, F.archer0.z);
    const bolt = record(() => {
      c.press('skill2');
      return c.step(60);
    });
    check(bolt.log.hits.some((h) => F.ledgeArchers.uids.includes(h.uid) && h.src === 'projectile'), 'Ember Bolt from the floor hits a ledge archer', bolt.log.hits);
    // melee from below
    c = fresh(F.ledgeFoot.x, F.ledgeFoot.z);
    c.place(F.ledgeArchers.uids[0], F.ledgeRim.x, F.ledgeRim.z);
    c.aim(F.ledgeRim.x, F.ledgeRim.z);
    const melee = record(() => {
      c.press('attack');
      return c.step(40);
    });
    const a0 = enemy(F.ledgeArchers.uids[0]);
    check(dist(G().player.position, a0.position) < 1.9, 'the archer is within sword reach (horizontally)', dist(G().player.position, a0.position));
    check(!melee.log.hits.some((h) => h.uid === F.ledgeArchers.uids[0]), 'melee from below the cliff does not hit', melee.log.hits);
    // the ledge archers shoot down at the player
    c = fresh(F.ledgeFloor.x, F.ledgeFloor.z, { freeze: false });
    for (const uid of F.isolate) c.kill(uid);
    c.step(2);
    c.wake(F.ledgeArchers.uids[0]);
    c.wake(F.ledgeArchers.uids[1]);
    let arrows = 0;
    const shot = record(() => {
      for (let i = 0; i < archerSteps; i += 4) {
        c.step(4);
        if (C().system.projectiles.items.some((p) => p.alive && p.kind === 'arrow')) arrows++;
        G().teleport(F.ledgeFloor.x, F.ledgeFloor.z);
      }
      return c.state();
    });
    check(arrows > 0, 'the ledge archers loose arrows', arrows);
    check(shot.log.hurts.length > 0, 'a ledge archer hits the player on the floor', shot.log.hurts);
    return { boltHits: bolt.log.hits, meleeHits: melee.log.hits, arrowFrames: arrows, hurts: shot.log.hurts, failures };
  },

  /** Photo mode on a combat level freezes the player (and pauses combat). */
  /**
   * COMBAT-07 in a boss fight (visual review): with the controls legend and the boss bar both up
   * (every boss fight — the legend is on by default) the open lower middle of the screen stays
   * free: numbers anchored between the player and the boss bar are drawn at their anchors (the
   * legend + boss-bar union zone lifted them beside the player). Stepped, AI frozen.
   */
  labelsBoss() {
    const { failures, check } = checker('labelsBoss');
    const c = fresh(P.arenaInside.x, P.arenaInside.z);
    const ui = G().game.ui;
    const L = ui.combat.labels;
    const help = ui.hud.helpElement && !ui.hud.helpElement.classList.contains('is-hidden');
    ui.hud.showHelp(true);
    ui.combat.boss.show({ name: 'Probe', phases: 3 });
    c.step(3);
    const p = G().player.position;
    const nums = [];
    for (const dz of [1.5, 2.5, 3.5]) {
      const x = p.x;
      const y = p.y + 0.5;
      const z = p.z + dz;
      L.number(x, y, z, 77, 'dmg');
      c.step(2);
      const n = L._nums.find((o) => o.live && o.wx === x && o.wz === z);
      L._screen(x, y, z);
      const ax = L._sx + (n?.dx ?? 0);
      const ay = L._sy + (n?.dy ?? 0);
      nums.push({ dz, anchor: [Math.round(ax), Math.round(ay)], drawn: n ? [n.x, n.y] : null, drift: n ? +Math.hypot(n.x - ax, n.y - ay).toFixed(2) : null });
    }
    const zones = L._zones.slice(0, L._zoneN).map((z) => [z.l, z.t, z.r, z.b].map(Math.round));
    const panels = L._panels.filter((q) => q.on).length;
    const out = { panels, zones, nums };
    // (the legend steps aside while the boss bar shows: BossBar's lu-root--boss; it leaves its zone)
    check(nums.every((n) => n.drift !== null && n.drift <= 2), 'boss fight, boss bar shown (the legend steps aside): numbers in the open lower middle stay at their anchors', out);
    ui.combat.boss.hide();
    L.clear();
    ui.hud.showHelp(help);
    c.step(1);
    out.failures = failures;
    return out;
  },

  photo() {
    const { failures, check } = checker('photo');
    const c = fresh();
    const g = G();
    const on = g.photo(true);
    c.move(1, 0);
    const p0 = g.player.position.clone();
    const f0 = c.state().frame;
    c.step(30);
    const p1 = g.player.position.clone();
    const f1 = c.state().frame;
    g.photo(false);
    c.step(30);
    const p2 = g.player.position.clone();
    c.move(null);
    check(on === true, 'photo mode on (not engaged)');
    check(p0.distanceTo(p1) < 1e-6, 'the player does not move in photo mode', [p0, p1]);
    check(f0 === f1, 'combat paused in photo mode', [f0, f1]);
    check(p1.distanceTo(p2) > 1, 'the player moves again afterwards', [p1, p2]);
    return { moved: +p1.distanceTo(p2).toFixed(3), failures };
  },

  /** Resume guard: a dodge held while the map closes does not fire until released. */
  resume() {
    const { failures, check } = checker('resume');
    const c = fresh();
    const g = G();
    g.map(true);
    c.step(2);
    c.hold('dodge', 40);
    c.step(2);
    g.map(false);
    let s = c.step(3);
    check(s.player.action === null, 'no dodge in the resume frame (held)', s.player.action);
    check(s.guards.resume === true, 'resume guard active while held', s.guards);
    s = c.step(45);
    check(s.player.action === null && s.guards.resume === false, 'released: still no dodge, guard off', { a: s.player.action, g: s.guards });
    c.press('dodge');
    s = c.step(1);
    check(s.player.action === 'backstep', 'a fresh press dodges', s.player.action);
    c.step(30);
    return { failures };
  },

  /** Device-aware legend: pad rows, swapped keycaps, the pad hint once. */
  padLegend() {
    const { failures, check } = checker('padLegend');
    const c = fresh();
    const input = G().engine.input;
    const labels = () => [...document.querySelectorAll('.lu-help__label')].map((e) => e.textContent);
    const hints = () => [...document.querySelectorAll('.lu-toast__text')].filter((e) => /^Pad:/.test(e.textContent)).length;
    const kb = labels();
    input.lastDevice = 'gamepad';
    let s = c.step(2);
    const pad = labels();
    const h1 = hints();
    input.lastDevice = 'keyboard';
    c.step(2);
    const back = labels();
    input.lastDevice = 'gamepad';
    s = c.step(2);
    const h2 = hints();
    input.lastDevice = 'keyboard';
    c.step(2);
    // the combat's 12 rows, plus the game's own where they apply: Journal on a level with a story
    // (Cinderwatch Pass has one; keyboard only), Party once someone has joined
    const extra = (pad) => (G().game.story && !pad ? 1 : 0) + (G().game.party ? 1 : 0);
    const own = (rows) => rows.filter((r) => r !== 'Journal' && r !== 'Party');
    check(kb.includes('Zoom (or wheel)') && own(kb).length === 12 && kb.length === 12 + extra(false), 'keyboard legend (12 combat rows + Journal / Party)', kb);
    check(pad.includes('Zoom') && pad.includes('Photo') && own(pad).length === 12 && pad.length === 12 + extra(true), 'pad legend (12 combat rows + Party)', pad);
    check(JSON.stringify(back) === JSON.stringify(kb), 'keyboard legend again');
    check(h1 === 1 && h2 === 1, 'one pad hint toast', [h1, h2]);
    check(s.device === 'gamepad', 'state().combat.device', s.device);
    return { pad, failures };
  },
};

const OTHERS = () => [...P.goblins.uids, ...P.bats.uids, P.boar.uid, P.shaman.uid, ...P.ledgeArchers.uids];

Object.assign(tests, {
  /**
   * I-frames and the perfect dodge (stepped): a slime's leap. A roll pressed when its wind-up has
   * ≤ 4 f left leaves HP unchanged and counts a perfect dodge; without the roll the leap hurts.
   */
  iframes() {
    const { failures, check } = checker('iframes');
    const run = (dodge) => {
      const c = fresh(21.6, 30.0);
      for (const uid of [...OTHERS(), P.slimes.uids[1], P.slimes.uids[2]]) c.kill(uid);
      c.place(P.slimes.uids[0], 20.0, 30.0);
      G().teleport(21.6, 30.0);
      c.freezeAI(false);
      c.wake(P.slimes.uids[0]);
      const e = enemy(P.slimes.uids[0]);
      const hp0 = c.state().player.hp;
      let pressedAt = -1;
      let leapt = false;
      for (let i = 0; i < 480; i++) {
        if (dodge && pressedAt < 0 && e.state === 'windup' && e.t >= (30 - 4) / 60 - 1e-6) {
          const p = G().player.position;
          c.move(e.position.x - p.x, e.position.z - p.z); // roll through it
          c.press('dodge');
          pressedAt = i;
          c.step(1);
          c.move(null);
          continue;
        }
        c.step(1);
        if (e.state === 'active') leapt = true;
        if (leapt && e.state === 'recover') {
          c.step(30);
          break;
        }
      }
      const s = c.state();
      return { hp0, hp: s.player.hp, perfect: s.player.perfectDodges, leapt, pressedAt, slime: e.state };
    };
    const a = run(true);
    const b = run(false);
    check(a.leapt && a.pressedAt >= 0, 'the slime leapt and the roll was pressed in its last 4 wind-up frames', a);
    check(a.hp === a.hp0, 'rolled through the leap: HP unchanged', a);
    check(a.perfect === 1, 'a perfect dodge counted', a);
    check(b.leapt && b.hp < b.hp0, 'control run without the roll: the leap hurts', b);
    return { dodge: a, control: b, failures };
  },

  /** Death, part 1 (real time): a kill to remember, gold, the checkpoint, then HP 0. */
  deathSetup() {
    const c = fresh(P.waystoneA.x + 3, P.waystoneA.z + 1.5);
    c.setPlayer({ gold: 100 });
    c.kill(P.slimes.uids[0]);
    c.checkpoint(P.waystoneA.id);
    G().teleport(P.dummyFront.x + 2, P.dummyFront.z);
    c.damagePlayer(9999);
    return c.state();
  },

  /** Death, part 2: the death screen is up (checked before the key press). */
  deathScreenUp() {
    const { failures, check } = checker('death');
    const d = G().ui.combat.death;
    check(d.visible, 'the death screen is shown');
    check(C().state().player.hp === 0, 'HP 0');
    return { visible: d.visible, failures };
  },

  /** Death, part 3 (after the key and the fades): at the checkpoint, full HP, −10 % gold, kills stay dead. */
  deathCheck() {
    const { failures, check } = checker('death');
    const s = C().state();
    const p = G().player.position;
    const stand = { x: P.waystoneA.x, z: P.waystoneA.z + 1.2 };
    check(dist(p, stand) < 1.5, 'respawned within 1.5 u of the checkpoint', { p: [p.x, p.z], stand });
    check(s.player.hp === s.player.hpMax, 'HP full', s.player);
    check(s.player.gold === 90, 'gold −10 %', s.player.gold);
    check(s.player.deaths === 1, 'one fall counted', s.player.deaths);
    check(!enemy(P.slimes.uids[0]).alive, 'a killed enemy stays dead');
    check(G().game.busy === false && !s.guards.respawn === !s.guards.respawn, 'play resumed');
    check(!G().ui.combat.death.visible, 'death screen hidden');
    return { player: s.player, failures };
  },
});

export const helpers = {};

/**
 * Step one frame at a time until `cond()` (or `max` frames): the `stepUntil` hook. Returns the
 * frames stepped, −1 if `cond` never held.
 */
function stepUntil(cond, max) {
  return C().stepUntil(() => cond(), max);
}

/** Only `move` may be picked next by the boss (null: none) — the `boss.force` hook. */
function forceBossMove(move) {
  C().boss.force(move);
}

/** The boss's live damaging shockwave rings (`boss.hazards('ring')`; the phase-2 push has mv 0). */
function rings() {
  return C().boss.hazards('ring').filter((h) => h.delay <= 0 && h.mv > 0);
}

/** The boss's move in progress (`boss.info()`). */
const bossMove = () => C().boss.info().move;

Object.assign(tests, {
  /**
   * The boss (stepped, COMBAT.md §21 combat.boss): intro (arena closes, a woken goblin is sent home
   * and never enters), phase 2 adds, the phase-3 kneel damage cap, a charge into a brazier (stun)
   * and into the rim (skid), a Shockwave ring (standing: hit; a timed inward roll: no damage), the
   * kill (arena open, victory, results card).
   */
  async boss({ uid = P.golem.uid, goblin = P.goblins.uids[0], near = P.goblins, inside = P.arenaInside, braziers = P.braziers } = {}) {
    const { failures, check } = checker('boss');
    const out = {};
    const c = fresh(near.x - 1.5, near.z + 1.5, { freeze: false });
    const sys = C().system;
    const b = enemy(uid);
    const arena = b.arena;
    c.setPlayer({ level: 6 });
    // a goblin woken beforehand
    const gob = goblin ? enemy(goblin) : null;
    if (gob) {
      c.wake(gob.uid);
      stepUntil(() => gob.aggro && gob.state === 'engage', 120);
      check(gob.aggro, 'the goblin is aggroed before the intro', gob.state);
    }
    // into the arena: the intro
    G().teleport(inside.x, inside.z);
    let entered = false;
    const introAt = stepUntil(() => b.state === 'intro', 30);
    check(introAt >= 0, 'the intro starts when the player stands inside', b.state);
    check(arena.active, 'the arena closes (ember wall)');
    check(c.state().player && sys.locksPlayer, 'the player is locked during the intro');
    for (let i = 0; i < 130; i++) {
      c.step(1);
      if (gob && arena.containsGrown(gob.position.x, gob.position.z, 0)) entered = true;
    }
    out.goblin = gob ? { state: gob.state, aggro: gob.aggro, x: +gob.position.x.toFixed(2), z: +gob.position.z.toFixed(2) } : null;
    if (gob) {
      check(!gob.aggro, 'the goblin was sent home', out.goblin);
      check(!entered, 'the goblin never entered the arena', out.goblin);
    }
    let s = c.state();
    check(s.boss.state === 'engage' && !sys.locksPlayer, 'the fight runs after the 108 f intro', s.boss);
    check(G().ui.combat.boss.visible, 'the boss bar is shown');
    check(s.engaged, 'engaged during the fight');
    // phase 2: adds
    c.god(true);
    c.setBossHp(0.69);
    stepUntil(() => b.phase === 2 && b.state !== 'phase', 300);
    const adds = sys.enemies.filter((e) => e.isAdd && e.alive && e.sprite.visible);
    out.adds = adds.length;
    check(b.phase === 2, 'phase 2', b.phase);
    check(adds.length === 3, '3 bat adds at the phase change', adds.length);
    for (const a of adds) c.kill(a.uid);
    // phase 3: the exposed core, damage capped at 8 %
    const hp3 = Math.round(b.hpMax * 0.34);
    c.setBossHp(0.34);
    stepUntil(() => b.state === 'kneel', 30);
    check(b.state === 'kneel', 'phase 3 kneel', b.state);
    G().teleport(b.position.x, b.position.z + b.radius + 1.3);
    c.aim(b.position.x, b.position.z);
    const kneel = record(() => {
      for (let i = 0; i < 120 && b.state === 'kneel'; i++) {
        c.press('attack');
        c.step(1);
      }
      return b.hp;
    });
    c.aim(null);
    const dealt = kneel.log.hits.filter((h) => h.uid === uid).reduce((n, h) => n + h.d, 0);
    out.kneel = { dealt, cap: Math.round(b.hpMax * 0.08), hits: kneel.log.hits.length, crits: kneel.log.hits.filter((h) => h.crit).length };
    check(dealt > 0 && dealt <= Math.round(b.hpMax * 0.08) + 1, 'kneel damage capped at 8 % of max HP', out.kneel);
    check(kneel.log.hits.filter((h) => h.uid === uid && h.d > 0).every((h) => h.crit), 'kneel hits are forced crits', kneel.log.hits);
    check(b.hp >= hp3 - Math.round(b.hpMax * 0.08) - 1, 'HP floor held', b.hp);
    stepUntil(() => b.state === 'engage', 200);
    // a charge into a brazier: stun
    // (the brazier nearest the arena's west edge; the player behind it, inside the arena)
    const br = [...braziers].sort((u, v) => (u.x - arena.rect.minX) - (v.x - arena.rect.minX))[0];
    c.place(uid, br.x + 5.5, br.z);
    G().teleport(Math.max(arena.rect.minX + 0.6, br.x - 4.2), br.z);
    c.step(2);
    forceBossMove('charge');
    let st = stepUntil(() => b.state === 'stun' || (bossMove() === null && b.state === 'engage' && b.t > 0.2), 400);
    out.brazier = { state: b.state, blockedBy: b.blockedBy, frames: st };
    check(b.state === 'stun', 'a charge into a brazier stuns the boss', out.brazier);
    stepUntil(() => b.state === 'engage', 200);
    // a charge into the rim: skid, no stun
    // (an east–west run as far as possible from every brazier)
    const clear = (z) => Math.min(...braziers.map((q) => Math.abs(q.z - z)));
    let rz = arena.center.z;
    for (let z = arena.rect.minZ + 1.5; z <= arena.rect.maxZ - 1.5; z += 0.5) if (clear(z) > clear(rz)) rz = z;
    c.place(uid, arena.rect.minX + 4, rz);
    G().teleport(arena.rect.maxX - 1.0, rz);
    c.step(2);
    forceBossMove('charge');
    let skid = false;
    let stunned = false;
    st = stepUntil(() => {
      const bi = C().boss.info();
      if (bi.skid) skid = true;
      if (b.state === 'stun') stunned = true;
      return stunned || (skid && b.state === 'recover') || (bi.move === null && b.t > 0.5 && b.state === 'engage');
    }, 400);
    out.rim = { skid, stunned, state: b.state, frames: st };
    check(skid && !stunned, 'a charge into the rim skids (no stun)', out.rim);
    stepUntil(() => b.state === 'engage', 200);
    // Shockwave Slam: rings. (1) standing still → hit
    const ring = (dodge) => {
      // a quiet start: no adds, no move in progress, no hazard left over
      for (const a of sys.enemies) if (a.isAdd && a.alive && a.sprite.visible) c.kill(a.uid);
      forceBossMove(null);
      stepUntil(() => b.state === 'engage' && b.hazardCount === 0, 600);
      // the boss near the north rim, facing south: the rings (to r 10) cross the whole arena and an
      // inward roll from the south edge ends outside the slam's magma pool (r 2)
      const bz = arena.rect.minZ + 3.2;
      c.place(uid, arena.center.x, bz);
      G().teleport(arena.center.x, bz + 2.6);
      c.step(2);
      forceBossMove('slam');
      stepUntil(() => b.state === 'windup', 60);
      forceBossMove(null); // one slam only
      // out of the slam circle, at the south edge
      G().teleport(arena.center.x, arena.rect.maxZ - 0.6);
      stepUntil(() => rings().length > 0, 200);
      // the rings expand from the slam point (1.6 u ahead of the boss): stand 8.6 u south of it
      // (inside the rings' reach of 10 u and the arena)
      const rc = rings()[0];
      G().teleport(rc.x, Math.min(arena.rect.maxZ - 0.6, rc.z + 8.6));
      c.god(false);
      const hp0 = c.state().player.hp;
      const p = G().player.position;
      const d0 = Math.hypot(p.x - rc.x, p.z - rc.z);
      let rolled = -1;
      const got = record(() => {
        for (let i = 0; i < 150; i++) {
          const rs = rings();
          const r = rs.length ? Math.max(...rs.map((h) => h.r)) : 0;
          if (dodge && rolled < 0 && r >= d0 - 0.45 && c.state().player.action === null) {
            c.move(rc.x - p.x, rc.z - p.z);
            c.press('dodge');
            rolled = i;
            c.step(1);
            c.move(null);
            continue;
          }
          c.step(1);
          if (!rings().length && i > 20) break;
        }
        return c.state().player.hp;
      });
      c.god(true);
      return { hp0, hp: got.out, hurts: got.log.hurts, rolled, d0: +d0.toFixed(2) };
    };
    out.ringStand = ring(false);
    check(out.ringStand.hurts.length > 0, 'standing still: a Shockwave ring hits', out.ringStand);
    stepUntil(() => b.state === 'engage', 300);
    c.setPlayer({ hp: 9999 });
    out.ringRoll = ring(true);
    check(out.ringRoll.rolled >= 0 && out.ringRoll.hurts.length === 0, 'rolling inward through the rings: no damage', out.ringRoll);
    // the kill: arena open, victory, results card
    c.kill(uid);
    c.step(10);
    s = c.state();
    check(s.bossDefeated && s.boss.defeated, 'the boss is defeated', s.boss);
    check(!arena.active, 'the arena opens');
    // the results card 1.5 s of game time after the kill: step there (a real-time wait depended on
    // the frame rate of a shared GPU), then let the announcer's queue show it
    c.step(100);
    await new Promise((r) => setTimeout(r, 200));
    const card = document.querySelector('.lu-announce');
    out.card = card?.textContent?.replace(/\s+/g, ' ').trim();
    check(!!card && /lu-announce--results/.test(card.className), 'the results card', card?.className);
    return { ...out, failures };
  },

  /**
   * The greedy run (§8.3): Lv 5, god mode, always moving into range and attacking, skills when
   * ready — a lower bound of the fight's length. Asserts fight ≥ 30 s and phase 3 ≥ 7 s. `level` /
   * `upgrades` (setPlayer) run it with another loadout: `combat.boss.cw.json` also runs the best
   * one a player can bring (Lv 5, both branches' chests and every shop ware).
   */
  greedy({ uid = P.golem.uid, inside = P.arenaInside, maxFrames = 9000, level = 5, upgrades = null } = {}) {
    const { failures, check } = checker('greedy');
    const c = fresh(inside.x, inside.z + 4, { freeze: false });
    for (const u of P.greedyKill) c.kill(u);
    c.setPlayer({ level, potions: 5, ...(upgrades ? { upgrades } : {}) });
    const atk = c.state().player.atk;
    // the setup kills above level the player 1 → 2; drop that card, or (the run below is stepped
    // synchronously) it only shows after the victory, over the Lv 6 results
    G().game.ui.combat?.announcer.clear?.();
    c.god(true);
    const b = enemy(uid);
    G().teleport(inside.x, inside.z);
    stepUntil(() => b.state === 'engage', 300);
    const t0 = c.state().time;
    let frames = 0;
    while (b.alive && frames < maxFrames) {
      const p = G().player.position;
      const dx = b.position.x - p.x;
      const dz = b.position.z - p.z;
      const d = Math.hypot(dx, dz);
      c.move(d > b.radius + 1.2 ? dx : 0, d > b.radius + 1.2 ? dz : 0);
      if (d <= b.radius + 2.2) c.press('attack');
      const s = c.state().player;
      for (let i = 0; i < 3; i++) if (s.cooldowns[i] <= 0 && s.action === null) c.press(`skill${i + 1}`);
      c.step(1);
      frames++;
    }
    c.move(null);
    c.god(false);
    const s = c.state();
    const fight = s.boss.fightTime;
    const [p1, p2, p3] = s.boss.phaseTimes;
    const res = { defeated: s.boss.defeated, fight, phases: [p1, p2, p3], frames, combatTime: +(s.time - t0).toFixed(2), level: s.player.level, atk };
    console.info(`[combat] greedy run: fight ${fight} s, phases ${[p1, p2, p3].join(' / ')} s, ${frames} frames`);
    check(res.defeated, 'the greedy player defeats the boss', res);
    check(fight >= 30, 'greedy fight ≥ 30 s', res);
    check(p3 >= 7, 'greedy phase 3 ≥ 7 s', res);
    return { ...res, failures };
  },
});

Object.assign(helpers, { stepUntil, forceBossMove, rings, fresh, record, enemy, checker });

/**
 * The same named points on Cinderwatch Pass (COMBAT.md §15.3; `combat.fight.cw.json`,
 * `combat.boss.cw.json`), resolved at runtime from the loaded level (the generator may move a
 * group ≤ 3 u): the camp dummies, a glade slime, the west Ruins ledge archers with a floor spot
 * below them in their range and a rim / foot pair across the ledge wall, the quarry goblins and
 * Cinderheart's arena with its four braziers.
 */
export function cinderwatch() {
  const g = window.__game;
  const sys = g.combat.system;
  const L = g.level;
  const tm = g.tileMap;
  const group = (id) => sys.enemies.filter((e) => e.groupId === id && !e.isAdd);
  const uids = (id) => group(id).map((e) => e.uid);
  const ok = (x, z) => [[0, 0], [0.32, 0], [-0.32, 0], [0, 0.32], [0, -0.32]].every(([dx, dz]) => sys.standable(x + dx, z + dz));
  const dm = sys.enemies.find((e) => e.uid === 'dummies#1');
  // the west ledge archers (level 6) and the Ruins floor below (level 4)
  const a0 = group('ruins_archers_w')[0];
  const ax = a0.home.x;
  const az = a0.home.z;
  const ay = tm.getHeight(ax, az);
  let ledgeFloor = null;
  for (let d = 5.5; d <= 8.5 && !ledgeFloor; d += 0.5) {
    for (let k = 0; k < 16; k++) {
      const x = ax + Math.cos((k * Math.PI) / 8) * d;
      const z = az + Math.sin((k * Math.PI) / 8) * d;
      if (ok(x, z) && tm.getHeight(x, z) <= ay - 0.9 && sys.los(ax, az, x, z)) {
        ledgeFloor = { x, z };
        break;
      }
    }
  }
  let ledgeRim = null;
  let ledgeFoot = null;
  for (let k = 0; k < 16 && !ledgeRim; k++) {
    const dx = Math.cos((k * Math.PI) / 8);
    const dz = Math.sin((k * Math.PI) / 8);
    for (let s = 0.2; s < 10; s += 0.1) {
      const x = ax + dx * s;
      const z = az + dz * s;
      const h = tm.getHeight(x, z);
      if (Math.abs(h - ay) < 0.05) continue;
      if (h <= ay - 0.9) {
        const rim = { x: x - dx * 0.5, z: z - dz * 0.5 };
        const foot = { x: x + dx * 0.45, z: z + dz * 0.45 };
        if (ok(rim.x, rim.z) && Math.abs(tm.getHeight(rim.x, rim.z) - ay) < 0.05 && ok(foot.x, foot.z) && tm.getHeight(foot.x, foot.z) <= ay - 0.9) {
          ledgeRim = rim;
          ledgeFoot = foot;
        }
      }
      break;
    }
  }
  const boss = sys.enemies.find((e) => e.boss);
  const arena = boss.arena;
  const braziers = L.objects.filter((o) => o.type === 'campfire' && arena.contains(o.x, o.z)).map((o) => ({ x: o.x, z: o.z }));
  const ws = L.objects.find((o) => o.id === 'waystone_camp');
  const gob = group('quarry_goblins')[0];
  const ruins = ['ruins_court', 'ruins_shaman', 'ruins_gate_goblins', 'ruins_slimes', 'ruins_archers_n'].flatMap(uids);
  return {
    spawn: { x: L.spawn.x, z: L.spawn.z },
    dummyMid: { x: dm.home.x, z: dm.home.z, uid: dm.uid },
    dummyFront: { x: dm.home.x, z: dm.home.z + 1.7 },
    slimes: { x: group('glade_slimes_w')[0].home.x, z: group('glade_slimes_w')[0].home.z, uids: uids('glade_slimes_w') },
    goblins: { x: gob.home.x, z: gob.home.z, uids: uids('quarry_goblins') },
    bats: { uids: uids('mire_bats_s') },
    boar: { uid: uids('quarry_boar_w')[0] },
    shaman: { uid: uids('ruins_shaman')[0] },
    ledgeArchers: { x: ax, z: az, uids: uids('ruins_archers_w') },
    archer0: { x: ax, z: az },
    archer1: { x: group('ruins_archers_w')[1].home.x, z: group('ruins_archers_w')[1].home.z },
    ledgeFloor,
    ledgeRim,
    ledgeFoot,
    waystoneA: { x: ws.x, z: ws.z, id: ws.id },
    golem: { x: boss.home.x, z: boss.home.z, uid: boss.uid },
    arenaCenter: { x: arena.center.x, z: arena.center.z },
    arenaInside: { x: arena.center.x, z: arena.rect.maxZ - 2.5 },
    braziers,
    isolate: ruins,
    greedyKill: [],
    // the Ruins ledge stair (tiles x 16–18, z 58–59, down south onto the court) and the 1 u cliff
    // east of it (x 19–21, z 58): the spots of the play review (COMBAT-06 / COMBAT-18, `tests.nav`)
    nav: {
      returns: [
        { uid: 'ruins_archers_n#0', x: 19.6, z: 59.2 },
        { uid: 'ruins_archers_n#0', x: 20.5, z: 59.5 },
        { uid: 'ruins_archers_n#0', x: 19.5, z: 58.4 },
        { uid: 'ruins_archers_n#0', x: 22, z: 59 },
      ],
      returnPlayer: { x: 23, z: 62 },
      climber: { uid: uids('ruins_court')[0], x: 21.5, z: 58.6 },
      edges: [{ x: 19.5, z: 55.5 }, { x: 20.2, z: 56.5 }],
      // a nook of the ledge where the play bot's archer walked into the edge for good
      corner: { uid: 'ruins_archers_n#0', x: 21.75, z: 52.95, player: { x: 21.2, z: 51.5 } },
      kite: { a: { x: 16.5, z: 52.5 }, b: { x: 22.7, z: 60.5 }, uids: [...ruins, ...uids('ruins_archers_w')] },
    },
  };
}
