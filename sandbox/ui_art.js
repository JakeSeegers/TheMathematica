/**
 * Pixel UI art sandbox (docs/specs/PIXEL_UI.md §2–§4): the engine's pixel UI kit — the art, type
 * and layout ported from mockup G — on a real UI root (`new UI(container)`: the palette, the scale,
 * the filters, the fonts) over a backdrop of the game (docs/assets/screenshots/ui-backdrop-*.jpg),
 * in five sheets:
 *   ?page=frames  every frame style G uses (the clock, the minimap, skill slots, plates, the
 *                 dialogue and tactics windows, the choices, cards and slots, portraits)
 *   ?page=pieces  glyphs, gems, keycaps, bars, the boss bar, the reticle, pips, bands, hairlines,
 *                 the bubble, star, halo, day bar, coin, divider, the minimap, every icon
 *   ?page=type    every type role in the page's language (?lang=en|ja|zh; the sample strings are
 *                 this page's table, SAMPLES), outlines, wrapping, key hints, portraits from real
 *                 character sheets (the traveler preset, Sela's spec from
 *                 public/levels/cinderwatch-pass.json), the logo
 *   ?page=logo    the logo's alphabet: A–Z, figures, punctuation, accented capitals, the scales, the
 *                 fallback font
 *   ?page=titles  every shipped level's and campaign's title fitted to the title group (logoFit, 560)
 * The scale follows the window: 1280 × 720 is px 2, 1920 × 1080 px 3.
 *
 * `__uiArt.checks()` draws every painter case (`cases()`: frames and ornaments, glyphs, gems,
 * keycaps, bars, the boss bar, brackets, pips, bands, fades, hairlines, the bubble, star, halo, day
 * bar, coin, divider, the logo and the CJK logo of the page's language, portraits and the sprite
 * crop from real sheets, the minimap on Cinderwatch Pass, every icon in three colourings), hashes
 * each canvas (FNV-1a over size + RGBA, as sandbox/sprite_art.js) and compares it with the committed
 * baseline sandbox/ui_art.hashes.json — taken while these cases still matched mockup G's own code
 * canvas for canvas, so the baseline is G's art; a case that differs or that the baseline lacks
 * fails. It also checks the palette's CSS tokens, the Jersey aliases' widths (Japanese and Chinese),
 * the scale table (artScale, fitScale) and the shipped titles (each drawn in the logo's own capitals,
 * at most 560 art px wide), and throws (a page error) on any failure. `__uiArt.hashes()` gives the
 * current hashes (re-recording the baseline after an intentional art change: its "comment" says
 * how). sandbox/ui_art.json runs the checks and shoots the pages. Handle: window.__uiArt.
 */
import { UI } from '../src/engine/ui/UI.js';
import { artScale, fitScale } from '../src/engine/ui/UiScale.js';
import {
  PALETTE, pal, GEMS, art, gem, frameCanvas, glyph, dimGlyph, gemGlyph, GLYPHS, keycapArt, bar, fade, rgbOf, band,
  plate, hairline, selBand, bubble, star, halo, dayBar, coin, divider, logo, logoFit, canLogo, textLogo, LOGO_FONT, portraitCanvas,
  spriteCrop, PORTRAIT_CROPS, miniMap, renderPixelMap, icon as coreIcon, CORE_ICONS, GOLD_ICON, DUSK_ICON,
} from '../src/engine/ui/art/index.js';
import { bossBar, bracket } from '../src/engine/ui/art/combat.js';
import { pips } from '../src/engine/ui/art/party.js';
import { icon as combatIcon, COMBAT_ICONS } from '../src/engine/ui/art/icons/combat.js';
import { icon as partyIcon, PARTY_ICONS } from '../src/engine/ui/art/icons/party.js';
import { txt, txc, measure, cjk, UP, NAME, capMid, lang, FONT, aliasSpecs } from '../src/engine/ui/layout/type.js';
import { group, put, win, key, keyHints, section, numPair } from '../src/engine/ui/layout/layout.js';
import { createCharacterSheet, CHARACTER_PRESETS } from '../src/engine/pixel/CharacterSprites.js';

/** @import { FrameStyle } from '../src/engine/ui/art/frames.js' */
/** @typedef {any} Loose */

const params = new URLSearchParams(location.search);
let PAGE = params.get('page') ?? 'frames';

/** The backdrop behind each sheet (docs/assets/screenshots/ui-backdrop-<name>.jpg: the game with its UI hidden); others the crossroads. */
const BACKDROP = { frames: 'crossroads', pieces: 'caldera', type: 'crossroads' };
const backdropEl = document.getElementById('backdrop');
const app = /** @type {HTMLElement} */ (document.getElementById('app'));

// the UI root over the whole window (a contained root: the scale follows its ResizeObserver)
const ui = new UI(app);
ui.hud.visible = false;
ui.setHudVisible(false);

/** The sheet layer inside the root (z 3: over the stock components, which are hidden). */
const sc = document.createElement('div');
sc.className = 'lu-art-sandbox';
sc.style.cssText = 'position: absolute; inset: 0; z-index: 3;';
ui.root.append(sc);

/** A character sheet (cached by spec). @type {Map<string, HTMLCanvasElement>} */
const SHEETS = new Map();
/** @param {object} spec */
function sheet(spec) {
  const k = JSON.stringify(spec);
  if (!SHEETS.has(k)) SHEETS.set(k, createCharacterSheet(spec).canvas);
  return SHEETS.get(k);
}
const TRAVELER = { ...CHARACTER_PRESETS.traveler, preset: 'traveler' };
/** Cinderwatch Pass's level file (fetched once): Sela's spec, the minimaps' map and markers. @type {Promise<Loose>|null} */
let LEVEL = null;
const loadLevel = () => (LEVEL ??= fetch(`${import.meta.env.BASE_URL}levels/cinderwatch-pass.json`).then((r) => r.json()));
/** Sela as Cinderwatch Pass has her (Npc.js: the preset, then the level's spec over it). @type {object|null} */
let SELA = null;
async function loadSela() {
  if (SELA) return SELA;
  const level = await loadLevel();
  const def = level.objects.find((/** @type {Loose} */ o) => o.type === 'npc' && o.id === 'sela');
  SELA = { ...CHARACTER_PRESETS[def.preset], preset: def.preset, ...(def.spec || {}) };
  return SELA;
}

/**
 * The type sheet's sample strings per language (Sela's offer at the Crossroads Waystone, the
 * tactics panel's words, the title; `{…}` marks a keyword). `name` is the logo's: in ja / zh drawn
 * in the language's face over the English wordmark.
 * @typedef {{ levelUp: string, place: string, text: string, prompt: string, region: string, sep: string, phase: string,
 *   presets: string, preset: string, time: string, rules: string, custom: string, keys: { keys: string[], label: string }[], name: string }} Sample
 * @type {Record<'en'|'ja'|'zh', Sample>}
 */
const SAMPLES = {
  en: {
    levelUp: 'Level 6', place: 'The Crossroads', region: 'Cinderwatch Pass', sep: ' · ', phase: 'Golden Hour', time: '16:47',
    text: 'A stone can keep itself. If you mean to climb to the {Caldera}, I\'d rather be climbing with you.', prompt: 'Shall my spear walk with you?',
    presets: 'Presets', preset: 'Balanced', rules: 'Rules', custom: 'Custom',
    keys: [{ keys: ['↑', '↓'], label: 'Choose' }, { keys: ['←', '→'], label: 'Change' }, { keys: ['Space'], label: 'Pick' }, { keys: ['Esc', 'G'], label: 'Close' }],
    name: 'Cinderwatch Pass',
  },
  ja: {
    levelUp: 'レベル 6', place: '四つ辻', region: 'シンダーウォッチ峠', sep: '・', phase: '夕映え', time: '16:47',
    text: '石の番は、石に任せておけばいい。{カルデラ}を目指すなら、私も一緒に登らせてくれ。', prompt: 'この槍、旅に連れていくか？',
    presets: '方針', preset: 'バランス', rules: '指示', custom: 'カスタム',
    keys: [{ keys: ['↑', '↓'], label: '選択' }, { keys: ['←', '→'], label: '変更' }, { keys: ['Space'], label: '決定' }, { keys: ['Esc', 'G'], label: '閉じる' }],
    name: 'シンダーウォッチ峠',
  },
  zh: {
    levelUp: '升至 6 级', place: '十字路口', region: '烬望隘口', sep: ' · ', phase: '夕照', time: '16:47',
    text: '这块石头自己守得住。你若要登上{火山口}，我宁愿陪你一道去。', prompt: '要我这杆长枪与你同行吗？',
    presets: '预设', preset: '均衡', rules: '规则', custom: '自定义',
    keys: [{ keys: ['↑', '↓'], label: '选择' }, { keys: ['←', '→'], label: '切换' }, { keys: ['Space'], label: '确定' }, { keys: ['Esc', 'G'], label: '关闭' }],
    name: '烬望隘口',
  },
};
/** The page language's samples (English for any other). */
const sample = () => SAMPLES[/** @type {'en'|'ja'|'zh'} */ (lang())] ?? SAMPLES.en;
/** The logo sheet's title the Roman capitals cannot draw (the fallback font: LOGO_FALLBACK_FONT). */
const LOGO_FALLBACK_SAMPLE = 'Château №5 · 龍の村';

// ---------------------------------------------------------------------------------------------
// The sheet pages
// ---------------------------------------------------------------------------------------------

/** A caption under a piece (the line role, dim). */
const cap = (/** @type {Element} */ g, /** @type {string} */ s, /** @type {number} */ x, /** @type {number} */ y) => txt(g, s, x, y, { font: 'line', color: pal().tx2, ol: true });

/** @type {Record<string, (g: HTMLDivElement) => Promise<void>|void>} */
const PAGES = {
  async frames(g) {
    const k = pal();
    /** @type {[string, FrameStyle, number, number, number, number][]} [caption, style, x, y, w, h] */
    const F = [
      ['clock XS', { size: 'XS', corners: GEMS.gold(), cornerR: 2 }, 20, 20, 70, 31],
      ['minimap M', { size: 'M', corners: GEMS.gold(), cornerR: 2, trio: true, sides: true, trioR: 2 }, 112, 20, 76, 76],
      ['slot', { size: 'XS', socket: true, corners: GEMS.gold(), cornerR: 1, tone: null, fill: k.ink1 }, 212, 20, 22, 22],
      ['locked', { size: 'XS', socket: true, corners: null, cornerR: 1, tone: 'dim', fill: k.ink1 }, 248, 20, 22, 22],
      ['choices XS', { size: 'XS', corners: GEMS.gold(), cornerR: 2 }, 290, 20, 100, 44],
      ['M scrolls', { size: 'M', scrolls: true }, 412, 20, 90, 50],
      ['M pendant', { size: 'M', corners: GEMS.ruby(), pendant: true }, 522, 20, 96, 50],
      ['name plate S', { size: 'S', notch: 3, corners: null, ends: true, endR: 2, bands: [k.plate0, k.plate1], stops: [0, 0.5], sheen: false }, 20, 128, 90, 16],
      ['boss plate S', { size: 'S', notch: 3, corners: GEMS.ruby(), cornerR: 1, bands: [k.plate0, k.plate1], stops: [0, 0.5], sheen: false }, 128, 128, 100, 16],
      ['chosen card S', { size: 'S', notch: 3, sel: true, corners: GEMS.gold(), cornerR: 1, bands: [k['card-sel0'], k['card-sel1'], k['card-sel2']], stops: [0, 0.35, 0.7], sheen: false }, 248, 120, 120, 35],
      ['member slot', { size: 'S', notch: 3, sel: true, corners: GEMS.amber(), cornerR: 1, bands: [k['card-sel0'], k['card-sel1'], k['card-sel2']], stops: [0, 0.35, 0.7], sheen: false }, 388, 118, 40, 40],
      ['idle card XS', { size: 'XS', tone: 'dim', corners: null, fill: k['card-glass'], sheen: false }, 448, 120, 100, 35],
      ['empty slot', { size: 'XS', tone: 'dim', corners: null, fill: k['slot-glass'], sheen: false }, 568, 118, 40, 40],
      ['dialogue L', { size: 'L', lattice: true, beads: 6, trio: true, trioTop: true, sides: true }, 20, 196, 330, 70],
      ['tactics L + crown', { size: 'L', lattice: true, beads: 6, crown: true, trio: true, sides: true }, 380, 206, 240, 110],
    ];
    for (const [c, o, x, y, w, h] of F) {
      win(g, o, x, y, w, h);
      cap(g, c, x, y + h + 6);
    }
    put(g, gemGlyph(3, GEMS.dusk(), { setting: [k.dm1, k.dm2, k.dm3] }), 568 + 16, 118 + 9);
    // a portrait frame (G's thick XS) from the traveler's real sheet
    put(g, portraitCanvas(sheet(TRAVELER), PORTRAIT_CROPS.dialogue), 20 + 23, 196 + Math.floor((70 - 42) / 2));
    cap(g, 'L: lattice, beads, trio, sides · XS portrait', 20, 290);
  },

  async pieces(g) {
    const k = pal();
    // glyphs, then the same in dim gilt
    let x = 14;
    for (const name of Object.keys(GLYPHS)) {
      put(g, glyph(name), x, 14);
      put(g, dimGlyph(name), x, 28);
      x += GLYPHS[name][0].length + 6;
    }
    // gems: every ramp at r 1–4
    x = 14;
    for (const ramp of ['gold', 'sapphire', 'amber', 'ruby', 'ember', 'dusk', 'way']) {
      for (const r of [1, 2, 3, 4]) { put(g, gemGlyph(r, GEMS[ramp]()), x, 44 + (4 - r)); x += 2 * r + 5; }
      x += 4;
    }
    // keycaps (DOM labels over A's keys) and the arrows
    x = 14;
    for (const k1 of ['Space', 'Esc', 'G', 'U', '1', '4', '↑', '↓', '←', '→']) x += key(g, k1, x, 62) + 3;
    key(g, 'J', x + 4, 62, { dim: true });
    keyHints(g, [{ keys: ['↑', '↓'], label: 'Choose' }, { keys: ['Space'], label: 'Start' }, { keys: ['Esc', 'G'], label: 'Close' }], 380, 62, { color: k.tx2, ol: true });
    // bars: HP (ring, notches), MP, SP, chip, the party strip's, the boss bar
    const RAMP = { hp: [k.hp0, k.hp1, k.hp2, k.hp3], mp: [k.mp0, k.mp1, k.mp2, k.mp3], sp: [k.sp0, k.sp1, k.sp1, k.sp2] };
    put(g, art(71, 7, (p) => bar(p, 71, 7, 0.58, RAMP.hp, { ring: k.dm1, notch: 4 })), 14, 82);
    put(g, art(71, 7, (p) => bar(p, 71, 7, 0.37, RAMP.mp, { ring: k.dm1 })), 14, 91);
    put(g, art(71, 6, (p) => bar(p, 71, 6, 0.35, RAMP.sp, { ring: k.dm1 })), 14, 100);
    put(g, art(48, 4, (p) => bar(p, 48, 4, 0.7, RAMP.hp, { chip: 0.85 })), 96, 82);
    put(g, art(48, 3, (p) => bar(p, 48, 3, 0.6, RAMP.mp)), 96, 89);
    numPair(g, [86, 148], 150, 82 - 2.5);
    put(g, art(334, 11, (p) => bossBar(p, 334, 0.46, 0.53, 3)), 200, 86);
    // the reticle (four brackets and the ruby heart), pips
    const [bx, by] = [570, 100];
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const b = bracket(sx, sy);
      const ex = sx > 0 ? 2 : b.width - 3, ey = sy > 0 ? 2 : b.height - 3;
      put(g, b, bx + (sx > 0 ? -15 : 14) - ex, by + (sy > 0 ? -15 : 14) - ey, 1, 'step').style.cssText += `--sx: ${sx}; --sy: ${sy};`;
    }
    put(g, gemGlyph(2, GEMS.ruby()), bx - 3, by - 3);
    put(g, pips(4, 1, false), 14, 112);
    put(g, pips(4, 2, true), 40, 112);
    // bands, the plate, hairlines, selection bands
    put(g, band(160, 22), 14, 124);
    put(g, hairline(140), 14, 124);
    put(g, hairline(140), 14, 145);
    put(g, plate(130, 16), 190, 126);
    put(g, hairline(120, 'both'), 340, 128);
    put(g, selBand(120, 16), 340, 132);
    put(g, selBand(120, 16, { lines: 'dim' }), 480, 132);
    put(g, fade(120, 40, rgbOf(k.band), (u, v) => Math.max(0, 1 - Math.hypot((u - 0.5) / 0.5, (v - 0.5) / 0.5)) * 1.4 * 0.7, [0.25, 0.5, 0.7]), 500, 150);
    // the bubble, stars, halo with the clock's icons, day bar, coin, divider
    put(g, bubble(), 14, 156);
    put(g, star(11), 46, 158);
    put(g, star(25), 64, 152);
    x = 100;
    for (const ph of ['sun', 'golden', 'moon', 'dawn', 'dusk']) {
      put(g, halo(22), x, 152);
      put(g, coreIcon(ph), x + 3, 155);
      x += 26;
    }
    put(g, dayBar(60, 0.7), 236, 160);
    put(g, coin(), 306, 158);
    put(g, divider(219), 330, 178);
    // the minimap: G's look on Cinderwatch Pass itself (the level file, round the waystone)
    const level = await loadLevel();
    const way = level.objects.find((/** @type {Loose} */ o) => o.id === 'waystone_crossroads') ?? { x: 48, z: 60 };
    const base = renderPixelMap(level, 3);
    win(g, { size: 'M', corners: GEMS.gold(), cornerR: 2, trio: true, sides: true, trioR: 2 }, 14, 196, 76, 76);
    const mm = miniMap(base, {
      player: { x: way.x + 1.1, z: way.z + 1.9, facing: 'left' },
      markers: [{ kind: 'waystone', x: way.x, z: way.z }, { kind: 'npc', x: way.x + 3, z: way.z - 2 }, { kind: 'party', x: way.x + 2.3, z: way.z + 0.6 }, { kind: 'enemy', x: way.x - 12, z: way.z + 12 }],
      V: 70, ppt: 3,
    });
    put(g, mm, 17, 199);
    txt(g, 'N', 14 + 38, 199, { font: 'tiny', color: k.g5, align: 'center', ol: true });
    // every icon: core, combat, party; then G's idle tones
    x = 110; let y = 200;
    const all = [...Object.keys(CORE_ICONS).map((n) => coreIcon(n)), ...Object.keys(COMBAT_ICONS).map((n) => combatIcon(n)), ...Object.keys(PARTY_ICONS).map((n) => partyIcon(n))];
    for (const c of all) {
      put(g, c, x, y);
      x += 19;
      if (x > 620) { x = 110; y += 19; }
    }
    x = 110; y += 22;
    for (const n of ['target', 'scales', 'spear', 'heart']) { put(g, partyIcon(n, GOLD_ICON()), x, y); put(g, partyIcon(n, DUSK_ICON()), x + 19, y); x += 44; }
    put(g, combatIcon('nova', DUSK_ICON()), x, y);
  },

  async type(g) {
    const k = pal();
    const S = sample();
    /** @type {[import('../src/engine/ui/layout/type.js').RoleId, string, Loose][]} */
    const ROWS = [
      ['head', UP(S.levelUp), { track: 1, color: k.g5, ol: true }],
      ['name', UP(S.place), { ...NAME, color: k.tx1, drop: true }],
      ['body', S.text, { color: k.tx1, drop: true }],
      ['line', `${S.region}${S.sep}${S.phase}`, { color: k.g4, drop: true }],
      ['small', UP(S.presets), { track: 1, color: k.g4, drop: true }],
      ['val', S.preset, { color: k.sel, drop: true }],
      ['num', '112/148 · 1284', { color: k.tx1, drop: true }],
      ['big', `${S.time} 0.8 12`, { track: 1, color: k.g5, drop: true }],
      ['numL', '5 43', { color: k.crit, ol8: true }],
      ['tiny', 'Lv HP MP SP G N', { color: k.g4, drop: true }],
    ];
    let y = 14;
    for (const [role, text, o] of ROWS) {
      txt(g, role, 14, y + FONT[role].L / 2 - capMid('line'), { font: 'line', color: k.tx3 });
      const el = txt(g, text, 60, y, { font: role, ...o });
      el.dataset.role = role;
      y += Math.max(12, Math.ceil(FONT[role].L)) + 4;
    }
    // wrapped body (the dialogue at G's width), outlines, the section heading
    const w = txt(g, `${S.text} ${S.prompt}`, 60, y + 2, { font: 'body', color: k.tx1, maxW: 280, drop: true });
    y += 2 + w.lines * w.lh + 8;
    txc(g, 'ol 0123', 60, y + 6, { font: 'big', color: k.hit, ol: true });
    txc(g, 'ol8 43', 120, y + 6, { font: 'big', color: k.crit, ol8: true });
    txc(g, 'olx 12', 180, y + 6, { font: 'big', color: k.mint, olx: true });
    section(g, UP(S.rules), 240, 360, y + 6, S.custom);
    // portraits from the real sheets: the traveler preset, Sela as Cinderwatch Pass has her
    const sela = await loadSela();
    const px0 = 380;
    put(g, portraitCanvas(sheet(TRAVELER), PORTRAIT_CROPS.dialogue), px0, 14);
    put(g, portraitCanvas(sheet(sela), PORTRAIT_CROPS.dialogue), px0 + 46, 14);
    put(g, portraitCanvas(sheet(sela), { ...PORTRAIT_CROPS.tactics, glow: 'sapphire' }), px0 + 92, 14);
    put(g, spriteCrop(sheet(sela), PORTRAIT_CROPS.slot.crop), px0 + 166, 18, 2);
    keyHints(g, S.keys, px0 + 125, 100, { align: 'center', color: k.tx2, ol: true });
    // the logo across the foot: G's Roman capitals in English; in ja / zh the name drawn from the
    // language's face, the English name under it as a wordmark
    const name = S.name;
    let ly = 258;
    if (LOGO_FONT[lang()]) {
      const [font, scale, gap, plainL, marks] = LOGO_FONT[lang()];
      await ui.fonts.ensure(name);
      await document.fonts.load(font, name);
      const lg = textLogo(name, font, scale, gap, plainL, marks);
      put(g, lg, 320 - Math.floor(lg.width / 2), ly - Math.max(0, lg.height - 42));
      ly += 44;
      const wm = logo(SAMPLES.en.name.toUpperCase(), 1);
      put(g, wm, 320 - Math.floor(wm.width / 2), ly);
    } else {
      const lg = logo(UP(name));
      put(g, lg, 320 - Math.floor(lg.width / 2), ly);
      ly += lg.height + 2;
      const wm = logo(UP(name), 1);
      put(g, wm, 320 - Math.floor(wm.width / 2), ly);
    }
    put(g, divider(219), 211, 336);
  },

  /** The logo's alphabet: A–Z, the figures, the punctuation, marks, the small wordmark, the fallback font. */
  async logo(g) {
    const k = pal();
    let y = 4;
    /** @param {HTMLCanvasElement} c @param {string} label */
    const row = (c, label) => {
      put(g, c, 320 - Math.floor(c.width / 2), y);
      cap(g, label, 6, y + Math.floor(c.height / 2) - 4);
      y += c.height + 1;
    };
    row(logo('ABCDEFGHIJKLM'), '3');
    row(logo('NOPQRSTUVWXYZ'), '3');
    row(logo('0123456789 QUIZ'), '3');
    row(logo(`' " - – — . , : ; ! ? & · … ( ) / +`, 2), '2');
    row(logo('ÉCLAT ÀÂÈÊËÎÏÔÛÜÑÅÇ ŐČŻ', 2), '2 marks');
    row(logo('THE JOVIAL FOX & QUAKING BOG', 1), '1');
    // fitted to 300 art px: a long title on two lines; a title the capitals cannot draw, in the fallback font
    const two = logoFit('The Lantern Festival of Brightwater Crossing', { maxW: 300 });
    put(g, two.canvas, 170 - Math.floor(two.canvas.width / 2), y);
    const fb = logoFit(LOGO_FALLBACK_SAMPLE, { maxW: 300 });
    put(g, fb.canvas, 480 - Math.floor(fb.canvas.width / 2), y);
    txt(g, `fit ${two.scale} · ${two.lines.length}`, 6, y + 2, { font: 'line', color: k.tx2, ol: true });
    txt(g, `fallback ${fb.scale} · ${fb.lines.length}`, 330, y + 2, { font: 'line', color: k.tx2, ol: true });
    txt(g, `canLogo: ${canLogo('Emberfall — Open Doors')} / ${canLogo('龍の村')}`, 6, 350, { font: 'line', color: k.tx2, ol: true });
  },

  /** Every shipped level's and campaign's title fitted to the title group's 560 art px (logoFit). */
  async titles(g) {
    const k = pal();
    let y = 2;
    for (const name of SHIPPED_TITLES) {
      const f = logoFit(UP(name), { maxW: 560 });
      f.canvas.dataset.fit = `${f.scale}×${f.lines.length}`;
      put(g, f.canvas, 320 - Math.floor(f.canvas.width / 2), y);
      txt(g, `${f.scale} · ${f.lines.length}`, 6, y + 2, { font: 'line', color: k.tx2, ol: true });
      y += f.canvas.height;
      if (y > 340) break;
    }
  },
};

/** The titles of the shipped levels and campaigns (the logo must draw every one in its own capitals). */
const SHIPPED_TITLES = ['Cinderwatch Pass', 'Emberfall', 'Gildhaven', 'Starfall Vale', 'Brightwater Crossing', 'Willowmere', "The Ferryman's Lantern", 'Emberfall — Open Doors'];

/** The fonts' slices for the page's strings, then the page. @param {string} page */
async function show(page) {
  PAGE = page;
  sc.replaceChildren();
  backdropEl.style.backgroundImage = `url("../docs/assets/screenshots/ui-backdrop-${BACKDROP[page] ?? 'crossroads'}.jpg")`;
  await ui.fontsReady;
  await ui.fonts.ensure([sample(), LOGO_FALLBACK_SAMPLE]);
  const g = group(sc, 'mc', 0, 0, 640, 360);
  await PAGES[page](g);
  return page;
}

// ---------------------------------------------------------------------------------------------
// Checks: every painter case hashed against the committed baseline (sandbox/ui_art.hashes.json)
// ---------------------------------------------------------------------------------------------

/**
 * FNV-1a (32 bit) over a canvas's size and RGBA pixels → 8 hex digits (as sandbox/sprite_art.js).
 * @param {HTMLCanvasElement} canvas
 */
function canvasHash(canvas) {
  const d = canvas.width && canvas.height ? canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data : new Uint8ClampedArray(0);
  let h = 0x811c9dc5;
  const step = (/** @type {number} */ b) => { h ^= b; h = Math.imul(h, 0x01000193); };
  for (const v of [canvas.width, canvas.height]) { step(v & 255); step(v >>> 8); }
  for (let i = 0; i < d.length; i++) step(d[i]);
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * The minimap cases' views of Cinderwatch Pass (the two areas around the Crossroads and the caldera
 * that mockup G's snapshot cropped, 32 × 32 tiles from `area`): the villagers, waystones, campfires
 * and foes standing in the area are the markers (the foe with an arena the boss; the villager `party`
 * names drawn as the companion), the player and `companion` placed by hand.
 * @type {Record<string, { area: [number, number], player: { x: number, z: number, facing: string }, party?: string, companion?: { x: number, z: number } }>}
 */
const MAP_VIEWS = {
  crossroads: { area: [33, 62], player: { x: 49.6, z: 79.4, facing: 'left' }, party: 'sela' },
  caldera: { area: [33, 1], player: { x: 48.5, z: 18.8, facing: 'up' }, companion: { x: 50.5, z: 15.9 } },
};

/**
 * A view's markers (miniMap's `markers`) from the level's objects.
 * @param {Loose} level
 * @param {typeof MAP_VIEWS[string]} view
 * @returns {{ kind: string, x: number, z: number }[]}
 */
function viewMarkers(level, view) {
  const [x0, z0] = view.area;
  /** @type {Record<string, string>} */
  const KIND = { npc: 'npc', waystone: 'waystone', campfire: 'campfire', enemy: 'enemy' };
  const out = [];
  for (const o of level.objects) {
    if (!Object.prototype.hasOwnProperty.call(KIND, o.type) || !(o.x >= x0 && o.x < x0 + 32 && o.z >= z0 && o.z < z0 + 32)) continue;
    const kind = o.type === 'npc' && o.id === view.party ? 'party' : o.type === 'enemy' && o.arena ? 'boss' : KIND[o.type];
    out.push({ kind, x: o.x, z: o.z });
  }
  if (view.companion) out.push({ kind: 'party', ...view.companion });
  return out;
}

/** @typedef {[string, () => HTMLCanvasElement]} ArtCase [name (the baseline's key), the engine's canvas] */

/**
 * Every painter case: the frames G uses (base and ornaments), glyphs, dim glyphs, gem glyphs,
 * keycaps, bars, the boss bar, brackets, pips, band / plate, fades, hairlines, selection bands, the
 * bubble, stars, the halo, day bars, the coin, dividers, the logo (scales 3 and 1, logoFit, the CJK
 * face's in this page's language: `textLogo ja` / `textLogo zh`), portraits and the slot's sprite
 * crop from real character sheets (the traveler preset, Sela from public/levels/cinderwatch-pass.json),
 * the minimap on Cinderwatch Pass (its flat tile map, and with the objects as the game's minimap
 * draws it), every icon in its three colourings (own, G's gold, mono). The parameters are those the
 * comparison with mockup G's own code used.
 * @returns {Promise<ArtCase[]>}
 */
async function cases() {
  const k = pal();
  /** @type {ArtCase[]} */
  const C = [];
  // every frame style G uses (and the ones its kit offered), base and ornaments
  /** @type {[string, FrameStyle, number, number][]} */
  const FRAMES = [
    ['clock', { size: 'XS', corners: GEMS.gold(), cornerR: 2 }, 70, 31],
    ['minimap', { size: 'M', corners: GEMS.gold(), cornerR: 2, trio: true, sides: true, trioR: 2 }, 76, 76],
    ['slot', { size: 'XS', socket: true, corners: GEMS.gold(), cornerR: 1, tone: null, fill: k.ink1 }, 22, 22],
    ['slot locked', { size: 'XS', socket: true, corners: null, cornerR: 1, tone: 'dim', fill: k.ink1 }, 22, 22],
    ['plate', { size: 'S', notch: 3, corners: null, ends: true, endR: 2, bands: [k.plate0, k.plate1], stops: [0, 0.5], sheen: false }, 57, 16],
    ['plate cjk', { size: 'S', notch: 3, corners: null, ends: true, endR: 2, bands: [k.plate0, k.plate1], stops: [0, 0.5], sheen: false }, 61, 20],
    ['boss plate', { size: 'S', notch: 3, corners: GEMS.ruby(), cornerR: 1, bands: [k.plate0, k.plate1], stops: [0, 0.5], sheen: false }, 95, 16],
    ['dialogue', { size: 'L', lattice: true, beads: 6, trio: true, trioTop: true, sides: true }, 496, 66],
    ['dialogue no top', { size: 'L', lattice: true, beads: 6, trio: true, trioTop: false, sides: true }, 496, 62],
    ['tactics', { size: 'L', lattice: true, beads: 6, crown: true, trio: true, sides: true }, 608, 328],
    ['choices', { size: 'XS', corners: GEMS.gold(), cornerR: 2 }, 107, 44],
    ['card chosen', { size: 'S', notch: 3, sel: true, corners: GEMS.gold(), cornerR: 1, bands: [k['card-sel0'], k['card-sel1'], k['card-sel2']], stops: [0, 0.35, 0.7], sheen: false }, 186, 35],
    ['slot member', { size: 'S', notch: 3, sel: true, corners: GEMS.amber(), cornerR: 1, bands: [k['card-sel0'], k['card-sel1'], k['card-sel2']], stops: [0, 0.35, 0.7], sheen: false }, 40, 40],
    ['card idle', { size: 'XS', tone: 'dim', corners: null, fill: k['card-glass'], sheen: false }, 186, 35],
    ['slot empty', { size: 'XS', tone: 'dim', corners: null, fill: k['slot-glass'], sheen: false }, 40, 40],
    ['note', { size: 'XS', tone: 'dim', corners: null, fill: k['card-glass'], sheen: false }, 140, 63],
    ['M scrolls', { size: 'M', scrolls: true }, 90, 50],
    ['M pendant', { size: 'M', corners: GEMS.ruby(), pendant: true, sideR: 3, sides: true }, 96, 50],
    ['default', {}, 80, 40],
  ];
  for (const [name, o, w, h] of FRAMES) {
    C.push([`frame ${name}`, () => frameCanvas(o, w, h).base]);
    C.push([`ornaments ${name}`, () => frameCanvas(o, w, h).orn]);
  }
  for (const name of Object.keys(GLYPHS)) {
    C.push([`glyph ${name}`, () => glyph(name)]);
    C.push([`dimGlyph ${name}`, () => dimGlyph(name)]);
  }
  for (const ramp of Object.keys(GEMS)) for (const r of [1, 2, 3, 4]) C.push([`gemGlyph ${ramp} ${r}`, () => gemGlyph(r, GEMS[ramp]())]);
  C.push(['gemGlyph set', () => gemGlyph(1, GEMS.gold(), { setting: [k.g5, k.g4, k.g3] })]);
  C.push(['gemGlyph open', () => art(9, 9, (p) => gem(p, 4, 4, 3, GEMS.ruby(), { open: 'rl' }))]);
  for (const [w, arrow, dim] of /** @type {[number, string|null, boolean][]} */ ([[11, null, false], [27, null, false], [19, null, true], [11, 'kUp', false], [11, 'kDown', false], [11, 'kLeft', true], [11, 'kRight', false]])) {
    C.push([`keycap ${w} ${arrow} ${dim}`, () => keycapArt(w, 11, arrow, dim)]);
  }
  const RAMP = { hp: [k.hp0, k.hp1, k.hp2, k.hp3], mp: [k.mp0, k.mp1, k.mp2, k.mp3], sp: [k.sp0, k.sp1, k.sp1, k.sp2] };
  /** @type {[number, number, number, string[], Loose][]} */
  const BARS = [[71, 7, 0.58, RAMP.hp, { ring: k.dm1, notch: 4 }], [71, 7, 1, RAMP.mp, { ring: k.dm1 }], [71, 6, 0.35, RAMP.sp, { ring: k.dm1 }], [48, 4, 0.7, RAMP.hp, {}], [48, 3, 0.6, RAMP.mp, {}], [80, 9, 0.3, RAMP.hp, { chip: 0.6 }], [60, 2, 0.5, [k.g1, k.g2, k.g3], {}]];
  BARS.forEach(([w, h, v, r, o], i) => C.push([`bar ${i}`, () => art(w, h, (p) => bar(p, w, h, v, r, o))]));
  for (const [v, chip, ph] of [[0.46, 0.53, 3], [1, 1, 3], [0.1, 0.4, 2], [0, 0, 4]]) C.push([`bossBar ${v}`, () => art(334, 11, (p) => bossBar(p, 334, v, chip, ph))]);
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) C.push([`bracket ${sx} ${sy}`, () => bracket(sx, sy)]);
  for (const [n, i, f] of /** @type {[number, number, boolean][]} */ ([[4, 1, false], [4, 2, true], [3, 0, false], [5, 4, true]])) C.push([`pips ${n} ${i} ${f}`, () => pips(n, i, f)]);
  C.push(['band', () => band(171, 22)]);
  C.push(['band vitals', () => band(155, 32, 0.84, 0.7, 0.58)]);
  C.push(['plate', () => plate(110, 16)]);
  C.push(['fade radial', () => fade(380, 52, rgbOf(k.band), (u, v) => Math.max(0, 1 - Math.hypot((u - 0.5) / 0.5, (v - 0.62) / 0.62)) * 1.3 * 0.74, [0.25, 0.5, 0.74])]);
  C.push(['fade even', () => fade(64, 20, '10, 20, 30', (u) => u, 6)]);
  for (const [w, e] of /** @type {[number, 'r'|'both'][]} */ ([[108, 'r'], [219, 'both'], [37, 'r']])) C.push([`hairline ${w} ${e}`, () => hairline(w, e)]);
  C.push(['hairline dim', () => hairline(120, 'both', k.dm1)]);
  C.push(['selBand', () => selBand(95, 16)]);
  C.push(['selBand dim', () => selBand(426, 19, { lines: 'dim' })]);
  C.push(['bubble', () => bubble()]);
  for (const s of [11, 25, 15]) C.push([`star ${s}`, () => star(s)]);
  C.push(['halo 22', () => halo(22)]);
  for (const f of [0, 0.7, 1]) C.push([`dayBar ${f}`, () => dayBar(58, f)]);
  C.push(['coin', () => coin()]);
  C.push(['divider 219', () => divider(219)]);
  C.push(['divider ruby', () => divider(101, GEMS.ruby())]);
  C.push(['logo 3', () => logo('CINDERWATCH PASS')]);
  C.push(['logo 1', () => logo('CINDERWATCH PASS', 1)]);
  C.push(['logo fit', () => logoFit('Cinderwatch Pass', { maxW: 560 }).canvas]);
  // the logo in the page's CJK face (its font in this language only)
  if (LOGO_FONT[lang()]) {
    const name = lang() === 'ja' ? 'シンダーウォッチ峠' : '烬望隘口';
    const [font, scale, gap, plainL, marks] = LOGO_FONT[lang()];
    await document.fonts.load(font, name);
    C.push([`textLogo ${lang()}`, () => textLogo(name, font, scale, gap, plainL, marks)]);
  }
  // portraits and the slot's sprite crop from the real sheets
  const SHEET = { traveler: sheet(TRAVELER), sela: sheet(await loadSela()) };
  for (const [nm, size, crop, kz, glow] of /** @type {['traveler'|'sela', number, number[], number, string][]} */ ([['sela', 40, [8, 2, 17, 17], 2, 'amber'], ['sela', 68, [1, 0, 31, 31], 2, 'amber'], ['traveler', 40, [8, 2, 17, 17], 2, 'sapphire'], ['traveler', 24, [8, 2, 17, 17], 1, 'amber']])) {
    C.push([`portrait ${nm} ${size}`, () => portraitCanvas(SHEET[nm], { size, crop, k: kz, glow })]);
  }
  C.push(['sprite crop', () => spriteCrop(SHEET.sela, [8, 1, 16, 16])]);
  // the minimap on Cinderwatch Pass: its flat tile map (G's look), and with the objects (Minimap.js's base)
  const level = await loadLevel();
  const tiles = renderPixelMap(level, 3), withObjects = renderPixelMap(level, 3, { objects: true });
  for (const [name, view] of Object.entries(MAP_VIEWS)) {
    const o = { player: view.player, markers: viewMarkers(level, view), V: 70, ppt: 3 };
    C.push([`miniMap ${name}`, () => miniMap(tiles, o)]);
    C.push([`miniMap ${name} objects`, () => miniMap(withObjects, o)]);
  }
  // every icon (core, combat, party) in its own colours, G's gold and mono
  for (const [table, paint] of /** @type {[Record<string, unknown>, (name: string, o?: Loose) => HTMLCanvasElement][]} */ ([[CORE_ICONS, coreIcon], [COMBAT_ICONS, combatIcon], [PARTY_ICONS, partyIcon]])) {
    for (const name of Object.keys(table)) {
      C.push([`icon ${name}`, () => paint(name)]);
      C.push([`icon ${name} gold`, () => paint(name, GOLD_ICON())]);
      C.push([`icon ${name} mono`, () => paint(name, { mono: k.g3, outline: k.ink0 })]);
    }
  }
  return C;
}

/**
 * The current hash of every case (re-record the baseline from it after an intentional art change).
 * @returns {Promise<Record<string, string>>}
 */
async function hashes() {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [name, paint] of await cases()) out[name] = canvasHash(paint());
  return out;
}

/** The committed baseline's hashes (sandbox/ui_art.hashes.json). @returns {Promise<Record<string, string>>} */
async function loadBaseline() {
  const r = await fetch('./ui_art.hashes.json', { cache: 'no-store' });
  if (!r.ok) throw new Error(`ui_art.hashes.json: ${r.status}`);
  return (await r.json()).hashes;
}

/** The language whose page draws a case: `textLogo <lang>` only there, every other case on every page. @param {string} name */
const langOfCase = (name) => /^textLogo (\w+)$/.exec(name)?.[1] ?? lang();

/**
 * What `checks()` returns: the cases drawn and the baseline's size, the failures (none when it
 * returns), the aliases' widths (ja / zh), the palette tokens, the scale table and the titles' fits.
 * @typedef {{ cases: number, baseline: number, failed: string[], aliases?: Loose, palette?: string, scale?: string[], titles?: string[] }} CheckReport
 */

/**
 * Run every check; throws when one fails (the harness reports a page error).
 * @returns {Promise<CheckReport>}
 */
async function checks() {
  /** @type {string[]} */
  const failed = [];
  const C = await cases();
  const byName = new Map(C);
  if (byName.size !== C.length) failed.push(`case names repeat: ${C.length - byName.size}`);
  // every case against the committed baseline (taken while each matched mockup G's own code)
  const base = await loadBaseline();
  for (const [name, paint] of C) {
    let h;
    try { h = canvasHash(paint()); } catch (e) { failed.push(`${name}: threw ${e?.message ?? e}`); continue; }
    if (!Object.prototype.hasOwnProperty.call(base, name)) failed.push(`${name}: not in the baseline (${h})`);
    else if (base[name] !== h) failed.push(`${name}: ${h}, the baseline ${base[name]}`);
  }
  // a baseline case no longer drawn (another language's are drawn on its own page)
  for (const name of Object.keys(base)) if (!byName.has(name) && langOfCase(name) === lang()) failed.push(`${name}: in the baseline, not drawn`);
  // the palette's CSS tokens on a bare root: base.css says what palette.js says
  const probe = document.createElement('div');
  probe.className = 'lu-root';
  probe.style.cssText = 'position: absolute; visibility: hidden;';
  document.body.append(probe);
  const cs = getComputedStyle(probe);
  const badTokens = Object.entries(PALETTE).filter(([t, v]) => cs.getPropertyValue(`--g-${t}`).trim() !== v).map(([t]) => t);
  probe.remove();
  if (badTokens.length) failed.push(`palette tokens differ in base.css: ${badTokens.join(', ')}`);
  // the Jersey aliases (ja / zh): a string of numbers at the alias's size is as wide as at Jersey's own
  /** @type {Loose} */
  let aliases = null;
  if (lang() !== 'en') {
    await ui.fonts.ready;
    const ctx = document.createElement('canvas').getContext('2d');
    const s = 'Lv 12 +120 1:42';
    const P = ui.px;
    aliases = {};
    for (const spec of aliasSpecs(lang(), P)) {
      // the source face at its own whole-pixel size (spec.size: its em × k device px)
      const own = spec.size;
      if (Math.abs(own / (spec.source === 'Jersey 15' ? 27 : 56 / 3) - spec.k) > 1e-9) failed.push(`alias ${spec.family}: ${own} px is not ${spec.k} px per font pixel`);
      ctx.font = `${own}px "${spec.source}"`;
      const want = ctx.measureText(s).width;
      ctx.font = `${own / spec.sizeAdjust}px "${spec.family}"`;
      const got = ctx.measureText(s).width;
      aliases[spec.family] = { want: +want.toFixed(3), got: +got.toFixed(3), sizeAdjust: spec.sizeAdjust };
      if (Math.abs(got - want) > 0.01) failed.push(`alias ${spec.family}: ${got} vs ${want}`);
    }
  }
  // the scale table (UiScale.artScale: device-pixel based)
  // fpx = ⌈px / 2⌉; the corner groups shrink only under 512 × 300 art px (1024 × 600 device px at px 2)
  /** @type {[number, number, number, number, number, number][]} [w, h, dpr, px, fpx, shrink×1000] */
  const TABLE = [[1280, 720, 1, 2, 1, 1000], [1600, 900, 1, 2, 1, 1000], [1920, 1080, 1, 3, 2, 1000], [2560, 1440, 1, 4, 2, 1000], [1024, 768, 1, 2, 1, 1000], [1024, 600, 1, 2, 1, 1000], [1000, 700, 1, 2, 1, 977], [800, 600, 1, 2, 1, 781], [1920, 953, 1, 2, 1, 1000], [1536, 864, 1.25, 3, 2, 1000], [1280, 720, 1.5, 3, 2, 1000], [3840, 2160, 1, 6, 3, 1000], [1920, 1080, 2, 6, 3, 1000], [3200, 1800, 1, 5, 3, 1000], [1280, 719, 1, 2, 1, 1000], [1366, 657, 1, 2, 1, 1000]];
  const scale = TABLE.map(([w, h, dpr, px, fpx, sh]) => {
    const r = artScale({ w, h, dpr });
    if (r.px !== px || r.fpx !== fpx || Math.round(r.shrink * 1000) !== sh || r.cornerShrink !== r.shrink) failed.push(`artScale ${w}×${h}@${dpr}: ${r.px}/${r.fpx}/${r.shrink}`);
    return `${w}×${h}@${dpr}: px ${r.px} fpx ${r.fpx} shrink ${+r.shrink.toFixed(3)} art ${r.artW}×${r.artH} --px ${+r.cssPx.toFixed(3)}`;
  });
  // a centred group is scaled only when it does not fit (its margins up to 16 art px)
  /** @type {[string, number, number, number, number, number, number, number][]} [anchor, x, y, w, h, artW, artH, fit×1000] */
  const FITS = [['mc', 16, 20, 608, 328, 512, 384, 789], ['mc', 16, 20, 608, 328, 640, 360, 1000], ['bc', 153, 300, 334, 40, 512, 384, 1000], ['tc', 60, 48, 520, 60, 512, 384, 923], ['mc', 40, 50, 560, 300, 640, 300, 824], ['tl', 10, 10, 200, 50, 400, 300, 1000], ['mc', 100, 80, 440, 200, 512, 384, 1000]];
  for (const [a, x, y, w, h, aw, ah, f] of FITS) {
    const got = fitScale(a, x, y, w, h, aw, ah);
    if (Math.round(got * 1000) !== f) failed.push(`fitScale ${a} ${x},${y} ${w}×${h} in ${aw}×${ah}: ${got}`);
  }
  // every shipped title in the logo's own capitals, fitted to the title group (560 art px)
  const titles = SHIPPED_TITLES.map((n) => {
    const f = logoFit(UP(n), { maxW: 560 });
    if (!f.roman) failed.push(`logo: ${n} not in the Roman capitals`);
    if (f.canvas.width > 560) failed.push(`logo: ${n} is ${f.canvas.width} wide`);
    return `${n}: scale ${f.scale}, ${f.lines.length} line(s), ${f.canvas.width}×${f.canvas.height}`;
  });
  if (canLogo('龍の村') || !canLogo('Ünder Ça Été 1:42 — (Act II)?')) failed.push('logo: canLogo');
  const report = { cases: C.length, baseline: Object.keys(base).length, failed, aliases, palette: badTokens.length ? 'differs' : 'same', scale, titles };
  if (failed.length) throw new Error(`ui_art checks: ${failed.length} of ${C.length} failed: ${failed.slice(0, 12).join(' | ')}`);
  return report;
}

/**
 * The page's handle (sandbox/ui_art.json).
 * @typedef {object} UiArtHandle
 * @property {UI} ui
 * @property {Promise<string>} ready  the first page (?page=, default 'frames') is built
 * @property {(page: string) => Promise<string>} show  build a sheet page: 'frames' | 'pieces' | 'type' | 'logo' | 'titles'
 * @property {() => Promise<CheckReport>} checks  every painter case against the baseline sandbox/ui_art.hashes.json, the
 *   palette tokens, the aliases' widths, the scale table, the shipped titles (throws on a failure)
 * @property {() => Promise<Record<string, string>>} hashes  every painter case's current FNV-1a hash (case name → 8 hex
 *   digits; this page's language's textLogo only), to re-record the baseline after an intentional art change
 * @property {() => object} info  the root's scale, the fonts' report, the language, the page
 * @property {() => void} pause  stop the idle motion at its first frame (for pixel diffs)
 */

/** @type {UiArtHandle} */
const handle = {
  ui,
  ready: show(PAGE),
  show,
  checks,
  hashes,
  info: () => ({ scale: ui.scale, fonts: ui.fonts.report, lang: lang(), cjk: cjk(), page: PAGE, measureHello: measure('Hello', 'body') }),
  pause() { for (const a of document.getAnimations()) { a.pause(); a.currentTime = 0; } },
};
window.__uiArt = handle;
