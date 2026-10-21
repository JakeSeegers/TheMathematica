/**
 * Title screen sandbox (src/engine/ui/TitleScreen.js, docs/specs/PIXEL_UI.md §5 / §8.1): the real
 * UI root over the title backdrop (docs/assets/screenshots/ui-backdrop-title.jpg), the title shown
 * in one state, in the page's language (?lang=en|ja|zh; the texts a caller would pass, as the UI
 * mockups' kit translated them):
 *   ?state=menu      the campaign's Continue (with its save line) / New Journey menu (default)
 *   ?state=chooser   the single-level chooser (the shipped levels, current Cinderwatch Pass)
 *   ?state=changed   the chooser moved on one (the "Travel to" prompt)
 *   ?state=plain     no destinations: "Press any key"
 *   &langs=1         with the language row (EN · 日本語 · 中文); &focus=1 with its focus (on the current language)
 *   &name=<id>       another title: cinderwatch (default), ferryman, interiors, brightwater, long
 * `__titleUi.checks()` drives every key, pad and pointer path (the chooser's, the menu's, the
 * language row's), checks the layout (texts inside their plates, nothing over another, the logo and
 * the rows inside the screen, the label hooks) and the logo fits; a failure throws (a page error).
 * sandbox/title_ui.json runs it. Handle: window.__titleUi.
 */
import { UI } from '../src/engine/ui/UI.js';
import { TITLE_LANGUAGES } from '../src/engine/ui/TitleScreen.js';
import { logoFit, textLogoFit } from '../src/engine/ui/art/logo.js';
import { UP, lang } from '../src/engine/ui/layout/type.js';

/** @typedef {any} Loose */

const params = new URLSearchParams(location.search);
const app = /** @type {HTMLElement} */ (document.getElementById('app'));
const ui = new UI(app);
ui.hud.visible = false;
ui.setHudVisible(false);
// the title state of the root (Game's ui.update sets it while the title is up): the HUD layers hide
ui.root.classList.add('lu-root--title');
const L = lang();

/**
 * The texts a caller passes (translated by the caller: G-game / G-story in the game), per title and
 * language — the UI mockups' kit's for Cinderwatch Pass.
 * @type {Record<string, Record<string, { title: string, sub: string }>>}
 */
const NAMES = {
  cinderwatch: {
    en: { title: 'CINDERWATCH PASS', sub: 'Where the Old Fires Wake' },
    ja: { title: 'シンダーウォッチ峠', sub: '古き火の目覚める地' },
    zh: { title: '烬望隘口', sub: '古火苏醒之地' },
  },
  ferryman: {
    en: { title: "THE FERRYMAN'S LANTERN", sub: 'A short tale of Millbrook' },
    ja: { title: '渡し守のランタン', sub: 'ミルブルックの小さな物語' },
    zh: { title: '摆渡人的灯笼', sub: '米尔布鲁克的小故事' },
  },
  interiors: {
    en: { title: 'EMBERFALL — OPEN DOORS', sub: 'Open Doors — every house has a room behind its door' },
    ja: { title: 'エンバーフォール\u200b開かれた扉', sub: 'どの家にも、扉の向こうに部屋がある' },
    zh: { title: '余烬镇·敞开的门', sub: '每座房子的门后都有一个房间' },
  },
  brightwater: {
    en: { title: 'BRIGHTWATER CROSSING', sub: 'A Luminati 2.5D Level' },
    ja: { title: 'ブライトウォーター・クロッシング', sub: 'Luminati 2.5D のステージ' },
    zh: { title: '明水渡口', sub: 'Luminati 2.5D 关卡' },
  },
  long: {
    en: { title: 'THE LANTERN FESTIVAL OF BRIGHTWATER CROSSING', sub: 'A very long title' },
    ja: { title: 'ブライトウォーター・クロッシングのランタン祭り', sub: 'とても長いタイトル' },
    zh: { title: '明水渡口的灯笼节与古老的河流传说', sub: '一个很长的标题' },
  },
};
const ENGLISH = { cinderwatch: 'Cinderwatch Pass', ferryman: "The Ferryman's Lantern", interiors: 'Emberfall — Open Doors', brightwater: 'Brightwater Crossing', long: 'The Lantern Festival of Brightwater Crossing' };
/** The menu, the chooser's levels and the footer per language (the UI mockups' kit's words). */
const WORDS = {
  en: { cont: 'Continue', fresh: 'New Journey', save: 'The Caldera · Lv 5 · 1:42:10', foot: 'A Luminati 2.5D action demo · three.js',
    levels: ['Emberfall', 'Cinderwatch Pass', 'Starfall Vale', 'Gildhaven', 'Brightwater Crossing', 'Willowmere'] },
  ja: { cont: '続きから', fresh: '新たな旅', save: 'カルデラ・Lv 5・1:42:10', foot: 'Luminati 2.5D アクションデモ・three.js',
    levels: ['エンバーフォール', 'シンダーウォッチ峠', 'スターフォール谷', 'ギルドヘイヴン', 'ブライトウォーター・クロッシング', 'ウィロウミア'] },
  zh: { cont: '继续游戏', fresh: '新的旅程', save: '火山口 · Lv 5 · 1:42:10', foot: 'Luminati 2.5D 动作演示 · three.js',
    levels: ['余烬镇', '烬望隘口', '星落谷', '吉尔德港', '明水渡口', '柳湖村'] },
};
const SLUGS = ['emberfall', 'cinderwatch-pass', 'starfall-vale', 'gildhaven', 'brightwater-crossing', 'sample-hamlet'];
const W = WORDS[L] ?? WORDS.en;

/** Language switches the row asked for (the game saves and reloads instead). @type {string[]} */
const switched = [];

/**
 * The show() options of a state.
 * @param {string} state
 * @param {{ name?: string, langs?: boolean }} [o]
 */
function optionsOf(state, o = {}) {
  const id = o.name ?? params.get('name') ?? 'cinderwatch';
  const n = (NAMES[id] ?? NAMES.cinderwatch)[L] ?? NAMES.cinderwatch.en;
  /** @type {Loose} */
  const opts = { title: n.title, subtitle: n.sub, credit: W.foot, titleSource: ENGLISH[id] ?? ENGLISH.cinderwatch };
  if (state === 'menu') {
    Object.assign(opts, { menu: true, destinations: [{ value: 'continue', label: W.cont, detail: W.save }, { value: 'new', label: W.fresh }], current: 'continue' });
  } else if (state === 'chooser' || state === 'changed') {
    Object.assign(opts, { destinations: SLUGS.map((value, i) => ({ value, label: W.levels[i] })), current: 'cinderwatch-pass' });
  }
  if (o.langs ?? params.get('langs') === '1') Object.assign(opts, { languages: TITLE_LANGUAGES, lang: L, onLanguage: (/** @type {string} */ c) => switched.push(c) });
  return opts;
}

/** @type {{ source: unknown, destination: string|null }[]} */
const results = [];
/**
 * Show the title in a state; the result lands in `results`.
 * @param {string} state
 * @param {{ name?: string, langs?: boolean }} [o]
 */
function show(state, o) {
  const k = results.length;
  results.push({ source: 'pending', destination: null });
  ui.title.show(optionsOf(state, o)).then((source) => { results[k] = { source: source ?? 'undefined', destination: ui.title.destination }; });
  return k;
}

const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));
const press = (/** @type {string} */ code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
const pointer = (/** @type {Element|null} */ el) => el?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
const $ = (/** @type {string} */ s) => document.querySelector(s);
const label = () => $('.lu-title__dest-label')?.textContent ?? null;
/** Wait until the title is gone (the 1.15 s leave) and the arm delay of the next show() is past. */
const settle = async () => { for (let i = 0; i < 60 && ui.title.visible; i++) await sleep(50); };

/** A fake standard gamepad (navigator.getGamepads), pressed one button at a time. */
const pad = { buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
const realPads = navigator.getGamepads?.bind(navigator);
/** @param {number} b */
async function padPress(b) {
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [/** @type {Loose} */ (pad)] });
  await sleep(50);
  pad.buttons[b].pressed = true;
  await sleep(80);
  pad.buttons[b].pressed = false;
  await sleep(50);
}

/**
 * The rectangle of every element matching `sel` inside the title, in CSS px.
 * @param {string} sel
 */
const rects = (sel) => [...document.querySelectorAll(`.lu-title ${sel}`)].map((e) => e.getBoundingClientRect());
/** @param {DOMRect} a @param {DOMRect} b @param {number} [tol] */
const inside = (a, b, tol = 0.5) => a.left >= b.left - tol && a.right <= b.right + tol && a.top >= b.top - tol && a.bottom <= b.bottom + tol;
/** @param {DOMRect} a @param {DOMRect} b */
const overlaps = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;

/**
 * The layout checks of the title as it stands: every text inside the screen, nothing set over
 * another text, the selected label inside its plate, the logo inside the screen and at most 560 art
 * px, the gems either side of the prompt.
 * @param {string} what
 * @param {string[]} failed
 */
function checkLayout(what, failed) {
  const vw = innerWidth, vh = innerHeight;
  const screen = new DOMRect(0, 0, vw, vh);
  const texts = [...document.querySelectorAll('.lu-title .tx')].filter((e) => e.closest('.lu-title__prompt.is-hidden') === null);
  const rs = texts.map((e) => /** @type {HTMLElement} */ (e)).map((e) => ({ e, r: e.getBoundingClientRect() })).filter((x) => x.r.width > 0);
  for (const { e, r } of rs) if (!inside(r, screen, 1)) failed.push(`${what}: "${e.textContent}" off screen ${JSON.stringify([r.left, r.top, r.right, r.bottom].map(Math.round))}`);
  for (let i = 0; i < rs.length; i++) {
    for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j];
      // a keycap's label sits on its keycap; the text boxes themselves must not overlap
      if (a.e.classList.contains('keylab') || b.e.classList.contains('keylab')) continue;
      if (overlaps(a.r, b.r)) failed.push(`${what}: "${a.e.textContent}" over "${b.e.textContent}"`);
    }
  }
  const px = ui.px / (window.devicePixelRatio || 1);
  for (const c of document.querySelectorAll('.lu-title canvas.lu-title__logo')) {
    const r = c.getBoundingClientRect();
    if (!inside(r, screen, 1)) failed.push(`${what}: logo off screen`);
    if (r.width / px > 560.5) failed.push(`${what}: logo ${Math.round(r.width / px)} art px wide`);
  }
  // the selected label inside its plate (the chooser: the label box holds the plate; the menu: the plate is in its item)
  const lab = $('.lu-title__dest-label');
  if (lab) {
    const plate = lab.tagName === 'DIV' && lab.querySelector('canvas') ? lab.querySelector('canvas') : lab.closest('.lu-title__menu-item')?.querySelector('canvas:not(.nudge)');
    const tx = lab.classList.contains('tx') ? lab : lab.querySelector('.tx');
    if (plate && tx && !inside(tx.getBoundingClientRect(), plate.getBoundingClientRect(), 0.5)) failed.push(`${what}: the label "${tx.textContent}" outside its plate`);
  }
  // the language plates: each lit label inside its plate; the row inside the screen
  for (const opt of document.querySelectorAll('.lu-title__lang-opt.is-lit')) {
    const cs = [...opt.querySelectorAll('canvas, .tx')];
    const pl = cs[0]?.getBoundingClientRect();
    for (const c of cs.slice(1)) if (pl && !c.classList.contains('nudge') && !inside(c.getBoundingClientRect(), pl, 0.5)) failed.push(`${what}: a language label outside its plate`);
  }
  for (const r of rects('.lu-title__lang-opt')) if (!inside(r, screen, 1)) failed.push(`${what}: a language plate off screen`);
  // no fractional art pixel where the art fits: from 512 × 360 art px (1024 × 768 at px 2) the title's
  // centred groups stay unscaled (TitleScreen._fitGroups: the logo and the tagline fit the room)
  if (ui.artW >= 512 && ui.artH >= 360) {
    for (const g of document.querySelectorAll('.lu-title__part > .grp[data-fit="shrunk"]')) failed.push(`${what}: a title group scaled ×${getComputedStyle(g).getPropertyValue('--lu-fit')} at ${ui.artW} × ${ui.artH} art px`);
  }
}

/** Every path and layout check; throws (a page error) on a failure. */
async function checks() {
  /** @type {string[]} */
  const failed = [];
  const expect = (/** @type {boolean} */ ok, /** @type {string} */ m) => { if (!ok) failed.push(m); };
  const log = [];
  ui.title.armDelay = 0.05;

  // --- the layouts of every state (in this language, at this size) ---
  for (const state of ['menu', 'chooser', 'plain']) {
    for (const name of ['cinderwatch', 'ferryman', 'interiors', 'long']) {
      show(state, { name, langs: true });
      await ui.fonts.ensure(JSON.stringify(optionsOf(state, { name })));
      await sleep(120);
      checkLayout(`${state}/${name}`, failed);
      ui.title.hide();
      await settle();
    }
  }

  // --- the menu: ↑↓ ←→ W S cycle, other keys do nothing, a confirm starts with the entry ---
  let k = show('menu');
  await sleep(120);
  expect(label() === W.cont, `menu: first label ${label()}`);
  expect(!$('.lu-title__dest-arrow'), 'menu: no arrows');
  expect(!!$('.lu-title__dest.is-menu'), 'menu: the menu is the destination row');
  press('ArrowDown'); expect(label() === W.fresh, `menu: ArrowDown → ${label()}`);
  press('KeyX'); press('KeyD'); press('Escape');
  expect(ui.title.visible && !ui.title.element.classList.contains('is-leaving'), 'menu: other keys dismissed it');
  press('ArrowUp'); expect(label() === W.cont, `menu: ArrowUp → ${label()}`);
  press('ArrowRight'); expect(label() === W.fresh, `menu: ArrowRight → ${label()}`);
  press('KeyS'); expect(label() === W.cont, `menu: S wraps → ${label()}`);
  press('KeyW'); expect(label() === W.fresh, `menu: W → ${label()}`);
  press('Enter');
  await sleep(30);
  expect(results[k].source === 'key' && results[k].destination === 'new', `menu: Enter → ${JSON.stringify(results[k])}`);
  await settle();
  // a click on an entry chooses and confirms it; a click elsewhere does nothing
  k = show('menu');
  await sleep(120);
  pointer(ui.title.element);
  expect(ui.title.visible && results[k].source === 'pending', 'menu: a click outside the entries dismissed it');
  pointer(document.querySelectorAll('.lu-title__menu-item')[1]);
  await sleep(30);
  expect(results[k].source === 'pointer' && results[k].destination === 'new', `menu: click → ${JSON.stringify(results[k])}`);
  await settle();
  // the pad: d-pad down, B nothing, A starts
  k = show('menu');
  await sleep(120);
  await padPress(13);
  expect(label() === W.fresh, `menu: pad down → ${label()}`);
  await padPress(1);
  expect(ui.title.visible && results[k].source === 'pending', 'menu: pad B dismissed it');
  await padPress(0);
  expect(results[k].source === 'gamepad' && results[k].destination === 'new', `menu: pad A → ${JSON.stringify(results[k])}`);
  await settle();

  // --- the chooser: the prompt changes, any other key resets and dismisses (COMBAT.md §13.4) ---
  k = show('chooser');
  await sleep(120);
  const promptText = () => $('.lu-title__prompt-text')?.textContent ?? null;
  expect(label() === W.levels[1], `chooser: label ${label()}`);
  expect(promptText() === ui.title._promptText, `chooser: prompt ${promptText()}`);
  press('ArrowRight');
  expect(label() === W.levels[2] && !!$('.lu-title__dest.is-changed'), `chooser: ArrowRight → ${label()}`);
  expect(promptText() !== ui.title._promptText && String(promptText()).includes(W.levels[2]), `chooser: changed prompt ${promptText()}`);
  expect($('.lu-title__prompt')?.querySelectorAll('canvas.key').length === 2, 'chooser: the Enter / A keycaps');
  pointer($('.lu-title__dest-arrow--prev'));
  expect(label() === W.levels[1] && ui.title.visible, `chooser: the ◀ glyph → ${label()}`);
  pointer($('.lu-title__dest-arrow--next'));
  pointer($('.lu-title__dest-label'));
  await sleep(30);
  expect(results[k].source === 'pointer' && results[k].destination === 'starfall-vale', `chooser: label click → ${JSON.stringify(results[k])}`);
  await settle();

  // --- the language row: L focuses it on the current language, L again moves on, ← → choose, Esc
  // goes back, Enter switches (Enter on the current language only leaves the row) ---
  switched.length = 0;
  k = show('plain', { langs: true });
  await sleep(120);
  const lg = () => ui.title.language;
  expect(lg()?.current === L && !lg()?.focused, `langs: start ${JSON.stringify(lg())}`);
  expect(document.querySelectorAll('.lu-title__lang-opt').length === 3, 'langs: three plates');
  expect(!!$(`.lu-title__lang-opt.is-lit[data-lang="${L}"]`), 'langs: the current language lit');
  const codes = /** @type {string[]} */ (TITLE_LANGUAGES.map((x) => x.code));
  const next = (/** @type {string} */ c, d = 1) => codes[(codes.indexOf(c) + d + codes.length) % codes.length];
  press('KeyL');
  expect(lg()?.focused && lg()?.selected === L, `langs: the first L focuses the current language → ${JSON.stringify(lg())}`);
  expect(!!$('.lu-title__lang .nudge'), 'langs: the cursor gem on the chosen language');
  press('KeyL');
  expect(lg()?.focused && lg()?.selected === next(L), `langs: L again → ${JSON.stringify(lg())}`);
  press('ArrowRight');
  expect(lg()?.selected === next(L, 2), `langs: ArrowRight → ${JSON.stringify(lg())}`);
  press('Escape');
  expect(!lg()?.focused && lg()?.selected === L && ui.title.visible && !ui.title.element.classList.contains('is-leaving'), `langs: Esc → ${JSON.stringify(lg())}`);
  press('KeyL'); press('KeyQ');
  expect(!lg()?.focused && ui.title.visible && results[k].source === 'pending', 'langs: another key leaves the row without dismissing');
  press('KeyL'); press('Enter');
  expect(!switched.length && !lg()?.focused && ui.title.visible && results[k].source === 'pending', `langs: L, Enter switched or dismissed ${JSON.stringify(switched)}`);
  press('KeyL'); press('ArrowRight'); press('Enter');
  expect(switched.join() === next(L) && ui.title.visible && results[k].source === 'pending', `langs: Enter switched ${JSON.stringify(switched)}`);
  expect(lg()?.current === next(L), `langs: the new language current ${JSON.stringify(lg())}`);
  pointer($(`.lu-title__lang-opt[data-lang="${L}"]`));
  expect(switched.join() === `${next(L)},${L}` && ui.title.visible, `langs: a click switched ${JSON.stringify(switched)}`);
  pointer($(`.lu-title__lang-opt[data-lang="${L}"]`));
  expect(switched.length === 2 && ui.title.visible, 'langs: a click on the current language did something');
  // the pad: RB focuses on the current language, RB again moves on, B goes back, LB LB / A switch
  await padPress(5);
  expect(lg()?.focused && lg()?.selected === L, `langs: pad RB → ${JSON.stringify(lg())}`);
  await padPress(5);
  expect(lg()?.focused && lg()?.selected === next(L), `langs: pad RB again → ${JSON.stringify(lg())}`);
  await padPress(1);
  expect(!lg()?.focused && ui.title.visible, 'langs: pad B');
  await padPress(4);
  await padPress(4);
  await padPress(0);
  expect(switched.at(-1) === next(L, -1) && ui.title.visible, `langs: pad LB LB + A switched ${JSON.stringify(switched)}`);
  // without a row, L dismisses as any key
  press('Enter');
  await sleep(30);
  expect(results[k].source === 'key', `langs: Enter dismissed ${JSON.stringify(results[k])}`);
  await settle();
  k = show('plain', { langs: false });
  await sleep(120);
  expect(!$('.lu-title__lang-opt') && ui.title.language === null, 'no row without onLanguage');
  press('KeyL');
  await sleep(30);
  expect(results[k].source === 'key', `no row: L dismissed ${JSON.stringify(results[k])}`);
  await settle();
  // the chooser with the row: L leaves the destination alone, Enter on the row does not travel
  k = show('chooser', { langs: true });
  await sleep(120);
  press('ArrowRight'); press('KeyL'); press('Escape');
  expect(label() === W.levels[2] && ui.title.visible, `chooser + langs: ${label()}`);
  press('Enter');
  await sleep(30);
  expect(results[k].destination === 'starfall-vale', `chooser + langs: Enter → ${JSON.stringify(results[k])}`);
  await settle();
  if (realPads) Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: realPads });

  // --- the logo fits: every shipped title one line, long ones within 560 ---
  for (const id of Object.keys(NAMES)) {
    const n = NAMES[id][L] ?? NAMES[id].en;
    const f = /[぀-ヿ㐀-鿿]/.test(n.title) && (L === 'ja' || L === 'zh') ? textLogoFit(n.title, L, { maxW: 560 }) : logoFit(UP(n.title), { maxW: 560 });
    log.push(`${id}: ${f.canvas.width}×${f.canvas.height} ×${f.scale} ${f.lines.length} line(s)`);
    expect(f.canvas.width <= 560, `logo ${id}: ${f.canvas.width} wide`);
    if (id !== 'long') expect(f.lines.length === 1, `logo ${id}: ${f.lines.length} lines`);
  }

  ui.title.armDelay = 0.45;
  const report = { lang: L, px: ui.px, failed, log };
  if (failed.length) setTimeout(() => { throw new Error(`[title_ui] ${failed.length} failed: ${failed.join(' | ')}`); });
  return report;
}

const state = params.get('state') ?? 'menu';
const ready = (async () => {
  await ui.fontsReady;
  show(state);
  if (state === 'changed') { await sleep(600); press('ArrowRight'); }
  if (params.get('focus') === '1') { await sleep(600); press('KeyL'); }
})();

Object.assign(window, { __titleUi: { ui, ready, show, optionsOf, results, switched, checks, checkLayout: (/** @type {string} */ w) => { /** @type {string[]} */ const f = []; checkLayout(w, f); return f; } } });
