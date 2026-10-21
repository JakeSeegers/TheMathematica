/**
 * Party UI sandbox: the party UI of `UI.usePartyUI()` (docs/specs/PARTY.md §6) — the tactics panel,
 * the party's HUD frames and the party dots on the minimap and the world map — over a small meadow
 * with the player and three companions (the engine's character sheets on THREE.Sprites, raw
 * three.js). `?combat=1` adds the combat UI (vitals, skill bar): the frames sit under the vitals and
 * show the level, HP / MP bars, *Down*, low HP and the fighting pulse. The page's language (`?lang=`
 * or the harness's `--lang`): the panel and the frames get the rule vocabulary as Party.openMenu /
 * Party.frames hand it (src/game/party/strings.js), and the checks expect the translations
 * (`__party.L(english, …keys)`: the English as written in English).
 * Keys: G the tactics panel (↑/↓ choose, ←/→ change, Space pick, Q/E member, Esc or G close) · N the
 * world map · 1–3 hurt that member (combat) · 4 heal all · 5 member 2 down / up · 6 fighting on / off
 * · D a dialog · H the HUD on / off · P photo mode (hides everything).
 * Handles for scripted checks (sandbox/party_ui.json): window.__ui, window.__party.
 */
import * as THREE from 'three';
import { UI } from '../src/engine/ui/UI.js';
import { CombatHUD } from '../src/engine/ui/CombatHUD.js';
import { BossBar } from '../src/engine/ui/BossBar.js';
import { WorldLabels } from '../src/engine/ui/WorldLabels.js';
import { Announcer } from '../src/engine/ui/Announcer.js';
import { DeathScreen } from '../src/engine/ui/DeathScreen.js';
import { partyUIClasses } from '../src/game/party/partyUI.js';
import {
  RULE_KEYS, PARTY_CLASSES, normalizeRule, ruleOfPreset, presetOf, isRuleValue,
} from '../src/engine/level/PartyRules.js';
import { classLabel, classHelp, roleLabel, weaponLabel, presetLabel, localFields, localPresets } from '../src/game/party/strings.js';
import { getLang, t, sep } from '../src/engine/i18n/I18n.js';
import { COMBAT_CONTROLS } from '../src/game/combat/bindings.js';
import { createCharacterSheet } from '../src/engine/pixel/CharacterSprites.js';
import { PixelCanvas } from '../src/engine/pixel/PixelCanvas.js';
import { PALETTE } from '../src/engine/pixel/Palette.js';
import { RNG } from '../src/engine/utils/math.js';

/**
 * @import { PartyRule, PartyFrameEntry, PartyPanelOpts } from '../src/game/party/types.js'
 * @import { PartyPanel } from '../src/engine/ui/PartyPanel.js'
 * @import { PartyFrames } from '../src/engine/ui/PartyFrames.js'
 */

const COMBAT = new URLSearchParams(location.search).get('combat') === '1';

// ---------------------------------------------------------------------------------------------
// Input: named actions like the engine's Input (pressed edges, held state, consumeAction)
// ---------------------------------------------------------------------------------------------
class StubInput {
  constructor() {
    /** @type {Record<string, string[]>} */
    this.bindings = {
      confirm: ['Space', 'Enter', 'KeyF'], cancel: ['Escape', 'Backspace'],
      up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
      camLeft: ['KeyQ'], camRight: ['KeyE'],
      party: ['KeyG'], map: ['KeyN'], dialog: ['KeyT'], hud: ['KeyH'], photo: ['KeyP'],
    };
    this._pressed = new Set();
    this._down = new Set();
    this._onDown = (/** @type {KeyboardEvent} */ e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this._pressed.add(e.code);
      this._down.add(e.code);
    };
    this._onUp = (/** @type {KeyboardEvent} */ e) => this._down.delete(e.code);
    window.addEventListener('keydown', this._onDown);
    window.addEventListener('keyup', this._onUp);
  }
  /** @param {string} code */
  wasPressed(code) { return this._pressed.has(code); }
  /** @param {string} name */
  action(name) { return (this.bindings[name] ?? []).some((c) => this._down.has(c)); }
  /** @param {string} name */
  actionPressed(name) { return (this.bindings[name] ?? []).some((c) => this._pressed.has(c)); }
  /** @param {string} name */
  consumeAction(name) {
    const was = this.actionPressed(name);
    if (was) for (const c of this.bindings[name]) this._pressed.delete(c);
    return was;
  }
  endFrame() { this._pressed.clear(); }
}

// ---------------------------------------------------------------------------------------------
// Renderer / scene: a meadow path at golden hour, the player and three companions behind
// ---------------------------------------------------------------------------------------------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COMBAT ? 0x6f5a64 : 0xd9a77c);
scene.fog = new THREE.Fog(COMBAT ? 0x6f5a64 : 0xd9a77c, 24, 58);
const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.5, 200);
camera.position.set(0, 8.5, 18);
camera.lookAt(0, 1.2, 0);

/** @param {string[]} ramp palette colours @param {number} seed @param {number} repeat */
function noiseTexture(ramp, seed, repeat) {
  const pc = new PixelCanvas(16, 16);
  pc.wrap = true;
  pc.fillNoise(ramp, { scale: 4, period: 4, seed, dither: 0.5 });
  const t = pc.toTexture({ wrap: 'repeat', mipmaps: true });
  t.repeat.set(repeat, repeat);
  return t;
}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80),
  new THREE.MeshLambertMaterial({ map: noiseTexture(COMBAT ? PALETTE.stoneWarm.slice(1, 4) : PALETTE.grass.slice(2, 5), 11, 80) }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const path = new THREE.Mesh(new THREE.PlaneGeometry(4, 60),
  new THREE.MeshLambertMaterial({ map: noiseTexture(PALETTE.stoneWarm.slice(2, 6), 3, 12) }));
path.rotation.x = -Math.PI / 2;
path.position.y = 0.01;
scene.add(path);
const rng = new RNG(5);
const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c3a22 });
const leafMat = new THREE.MeshLambertMaterial({ color: COMBAT ? 0x6d6a3a : 0x4f8f3d, flatShading: true });
for (let i = 0; i < 12; i++) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.6, 6), trunkMat);
  trunk.position.y = 0.8;
  const s = rng.range(1.2, 1.7);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), leafMat);
  crown.position.y = 1.6 + s * 0.8;
  g.add(trunk, crown);
  const side = i % 2 ? 1 : -1;
  g.position.set(side * rng.range(5, 13), 0, -12 + Math.floor(i / 2) * 3.5 + rng.range(-0.8, 0.8));
  scene.add(g);
}
scene.add(new THREE.HemisphereLight(0xb8c4ff, 0x6a4a34, 1.3));
const sun = new THREE.DirectionalLight(0xffc08a, 2.6);
sun.position.set(-10, 12, 8);
scene.add(sun);

/**
 * A character on a THREE.Sprite (row 0 of its sheet: facing down), feet at its origin.
 * @param {string} preset @param {number} x @param {number} z
 */
function character(preset, x, z) {
  const sheet = createCharacterSheet(preset);
  const tex = sheet.texture.clone();
  tex.repeat.set(1 / sheet.columns, 1 / sheet.rows);
  tex.offset.set(0, tex.flipY ? 1 - 1 / sheet.rows : 0);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.5 }));
  sprite.center.set(0.5, 0);
  sprite.scale.set(sheet.frameWidth / sheet.pixelsPerUnit, sheet.frameHeight / sheet.pixelsPerUnit, 1);
  sprite.position.set(x, 0, z);
  scene.add(sprite);
  return { sprite, tex, sheet };
}
const player = character('traveler', 0, 3);

// ---------------------------------------------------------------------------------------------
// The party (fake members: what Party.openMenu / Party.frames hand the UI)
// ---------------------------------------------------------------------------------------------
/**
 * @typedef {object} FakeMember
 * @property {string} id
 * @property {string} name
 * @property {string} color
 * @property {string} cls a PARTY_CLASSES name
 * @property {PartyRule} rule
 * @property {number} hp
 * @property {number} hpMax
 * @property {number} mp
 * @property {number} mpMax
 * @property {boolean} down
 * @property {boolean} fighting
 * @property {ReturnType<typeof character>} actor
 */
/** @type {FakeMember[]} */
const members = [
  { id: 'sela', name: 'Sela', color: '#d9776a', cls: 'warden', rule: ruleOfPreset('balanced'), hp: 182, hpMax: 210, mp: 40, mpMax: 60, down: false, fighting: false, actor: character('guard', -1.3, 5.2) },
  { id: 'wren', name: 'Wren', color: '#78b35b', cls: 'ranger', rule: ruleOfPreset('hunter'), hp: 120, hpMax: 150, mp: 70, mpMax: 70, down: false, fighting: false, actor: character('hunter', 1.2, 6.4) },
  // a custom mix (Support, but heals below half)
  { id: 'ilse', name: 'Sister Ilse', color: '#a7c7e7', cls: 'mystic', rule: { ...ruleOfPreset('support'), heal: 'half' }, hp: 96, hpMax: 130, mp: 88, mpMax: 120, down: false, fighting: false, actor: character('cleric', -0.4, 7.7) },
];

// ---------------------------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------------------------
const input = new StubInput();
const ui = new UI(document.body);
const vitals = { hp: 248, hpMax: 260, mp: 64, mpMax: 90, sp: 80, spMax: 100, level: 7, xp: 420, xpNext: 700, winded: false };
/** party DOM before usePartyUI (must be 0; its CSS is already here: Vite injects a module's CSS when it is imported) */
const partyNodesBefore = document.querySelectorAll('.lu-party, .lu-pframes, .lu-pframe').length;
ui.hud.setLocation('Cinderwatch Road', 'The Ashen Foothills');
ui.hud.setTime(17.4);
ui.hud.showHelp(true);
if (COMBAT) {
  UI.useCombatUI({ CombatHUD, BossBar, WorldLabels, Announcer, DeathScreen });
  ui.enableCombat();
  ui.combat.hud.configureSkills([
    { id: 'skill1', label: 'Whirl Slash', keys: 'U/1', padKeys: 'LT+X', icon: 'whirl' },
    { id: 'skill2', label: 'Ember Bolt', keys: 'I/2', padKeys: 'LT+Y', icon: 'bolt' },
    { id: 'skill3', label: 'Radiant Nova', keys: 'O/3', padKeys: 'LT+B', icon: 'nova' },
    { id: 'draught', label: 'Draught', keys: 'C/4', padKeys: 'Y', icon: 'draught' },
  ]);
  ui.combat.hud.setGold(340);
  ui.combat.hud.setPotions(3, 5);
  ui.hud.setControls([...COMBAT_CONTROLS, { keys: 'G', label: 'Party' }]);
} else {
  ui.hud.setControls([
    { keys: 'WASD', label: 'Move' },
    { keys: 'Shift', label: 'Run' },
    { keys: 'Space', label: 'Talk / Confirm' },
    { keys: 'Q/E', label: 'Rotate camera' },
    { keys: 'N/Tab', label: 'World map' },
    { keys: 'G', label: 'Party' },
    { keys: 'P', label: 'Photo mode' },
  ]);
}

const made = ui.usePartyUI(partyUIClasses());
// (the classes are known here: the test reads the components' own getters too)
const panel = /** @type {PartyPanel} */ (made.panel);
const frames = /** @type {PartyFrames} */ (made.frames);

// a painted map (48 × 48 world units) for the minimap and the world map
const mapCanvas = document.createElement('canvas');
mapCanvas.width = mapCanvas.height = 192;
{
  const g = mapCanvas.getContext('2d');
  g.fillStyle = COMBAT ? '#5f5848' : '#4f7a3a'; g.fillRect(0, 0, 192, 192);
  g.fillStyle = '#b18a5c'; g.fillRect(88, 0, 16, 192);
  g.fillStyle = '#3b7fa6'; g.beginPath(); g.arc(150, 48, 22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#25432a'; g.fillRect(10, 20, 50, 60); g.fillRect(120, 120, 60, 56);
  g.fillStyle = '#a4493b'; g.fillRect(40, 120, 22, 16); g.fillRect(130, 90, 18, 14);
}
const map = { canvas: mapCanvas, pixelsPerTile: 4, width: 48, depth: 48 };
ui.minimap.setMap(map, { view: 34 });
ui.worldMap.setMap(map, { title: COMBAT ? 'Cinderwatch Pass' : 'Ashen Foothills', subtitle: 'Party sandbox', combat: COMBAT });
const MAP_ORIGIN = 24;
/** The map's marker state (as the game's `_map`): `party` holds the members' live positions. */
const mapState = {
  player: { x: MAP_ORIGIN + player.sprite.position.x, z: MAP_ORIGIN + player.sprite.position.z },
  facing: { x: 0, z: -1 },
  view: { x: 0, z: -1 },
  npcs: [{ x: 18, z: 30 }, { x: 31, z: 22 }],
  markers: [{ x: 20, z: 14, kind: 'sign' }, { x: 30, z: 33, kind: 'fire' }],
  enemies: COMBAT ? [{ x: 26, z: 18 }, { x: 22, z: 17 }] : undefined,
  /** @type {{ x: number, z: number }[]} */
  party: members.map((m) => ({ x: MAP_ORIGIN + m.actor.sprite.position.x, z: MAP_ORIGIN + m.actor.sprite.position.z })),
};

const state = {
  ready: false,
  partyNodesBefore,
  /** panel closes reported by update() (the page reads it first, like the game) / onClose calls */
  closes: 0,
  onCloseCalls: 0,
  /** @type {{ id: string, rule: PartyRule, valid: boolean }[]} every onRule call */
  rules: [],
  /** @type {string[]} every onSound name */
  sounds: [],
  /** feed the frames every frame (false: a script drives them) */
  feed: true,
  /** @type {{ choice: number|null }[]} */
  dialogResults: [],
};
panel.onRule = (id, rule) => {
  // the game's side (Party.setRule): the rule must already be full and valid
  const full = normalizeRule(rule);
  const valid = Object.keys(rule).length === RULE_KEYS.length && RULE_KEYS.every((k) => isRuleValue(k, rule[k]) && full[k] === rule[k]);
  state.rules.push({ id, rule: { ...rule }, valid });
  const m = members.find((x) => x.id === id);
  if (m) m.rule = full;
};
panel.onClose = () => { state.onCloseCalls++; };
panel.onSound = (name) => { state.sounds.push(name); };
ui.fontsReady.then(() => { state.ready = true; });

/** @param {string} [focus] @returns {PartyPanelOpts} */
function panelOpts(focus) {
  return {
    members: members.map((m) => ({
      id: m.id, name: m.name, color: m.color, cls: classLabel(m.cls), clsHelp: classHelp(m.cls), clsId: m.cls,
      role: roleLabel(PARTY_CLASSES[m.cls].role), weapon: weaponLabel(PARTY_CLASSES[m.cls].weapon),
      portrait: m.actor.sheet.canvas, rule: { ...m.rule },
    })),
    focus,
    presets: localPresets(),
    fields: localFields(),
    closeKey: 'G',
  };
}

/** The HUD's lines (as Party.frames()). @returns {PartyFrameEntry[]} */
function frameList() {
  return members.map((m) => ({
    id: m.id, name: m.name, color: m.color, cls: classLabel(m.cls), tactic: presetLabel(presetOf(m.rule)),
    ...(COMBAT ? { hp: m.hp, hpMax: m.hpMax, mp: m.mp, mpMax: m.mpMax, down: m.down, fighting: m.fighting, level: vitals.level } : {}),
  }));
}

/**
 * The text a check expects: in English the English as the check writes it; in another language
 * the parts joined — a 'party' string key, '=literal' (a name: data stays as it is here) or '~'
 * (the language's separator).
 * @param {string} en
 * @param {...string} parts
 */
function L(en, ...parts) {
  if (getLang() === 'en') return en;
  return parts.map((k) => (k === '~' ? sep() : k.startsWith('=') ? k.slice(1) : t(`party.${k}`))).join('');
}

// ---------------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------------
/** @param {boolean} [open] @param {string} [focus] */
function menu(open = !panel.isOpen, focus = undefined) {
  if (open) panel.open(panelOpts(focus));
  else panel.close();
  return panel.isOpen;
}
/** @param {number} i @param {number} n */
function hurt(i, n) {
  const m = members[i];
  if (!m) return null;
  m.hp = Math.max(0, Math.min(m.hpMax, m.hp - n));
  if (m.hp <= 0) m.down = true;
  return m.hp;
}
function healAll() {
  for (const m of members) { m.hp = m.hpMax; m.mp = m.mpMax; m.down = false; }
}
/** @param {number} i @param {boolean} [down] */
function setDown(i, down = !members[i].down) {
  const m = members[i];
  m.down = down;
  m.hp = down ? 0 : Math.round(m.hpMax * 0.3);
  return m.down;
}
/** @param {boolean} [on] */
function fighting(on = !members[0].fighting) {
  for (const m of members) m.fighting = on && !m.down;
  return on;
}
function dialog() {
  if (ui.dialog.isOpen) return false;
  ui.dialog.open({ speaker: 'Sela', portraitColor: '#d9776a', lines: ['Lead on. I will keep to your {left}.'] })
    .then((c) => state.dialogResults.push({ choice: c ?? null }));
  return true;
}

/**
 * Compare for a scripted check: a mismatch throws a page error (the harness exits 1).
 * @param {unknown} actual @param {unknown} expected @param {string} label
 * @returns {string}
 */
function expect(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return `ok ${label}: ${a}`;
  setTimeout(() => { throw new Error(`[party_ui] ${label}: got ${a}, expected ${e}`); });
  return `FAIL ${label}: got ${a}, expected ${e}`;
}

/** Party CSS rules in the page's stylesheets (the game check: 0 on a level nobody joins). */
function countPartyRules() {
  let n = 0;
  for (const sheet of [...document.styleSheets]) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const r of [...rules]) if (/\.lu-(party|pframe)/.test(r.cssText)) n++;
  }
  return n;
}

/** A short hash of a canvas's pixels (toDataURL: no getImageData readbacks, no warning). @param {HTMLCanvasElement} c */
function canvasHash(c) {
  const s = c.toDataURL('image/png');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

/**
 * The maps drawn with and without the party, in one synchronous step (no frame in between):
 * the minimap and the world map hashes without `party`, with `party: []` and with the members.
 */
function mapHashes() {
  const base = { ...mapState, party: undefined };
  const out = {};
  ui.minimap.update(base);
  out.miniNone = canvasHash(ui.minimap.canvas);
  ui.minimap.update({ ...base, party: [] });
  out.miniEmpty = canvasHash(ui.minimap.canvas);
  ui.minimap.update(mapState);
  out.miniParty = canvasHash(ui.minimap.canvas);
  if (ui.worldMap.isOpen) {
    ui.worldMap.update(0, base);
    out.worldNone = canvasHash(ui.worldMap.canvas);
    out.legendNone = document.querySelectorAll('.lu-worldmap__legend li').length;
    ui.worldMap.update(0, { ...base, party: [] });
    out.worldEmpty = canvasHash(ui.worldMap.canvas);
    ui.worldMap.update(0, mapState);
    out.worldParty = canvasHash(ui.worldMap.canvas);
    out.legendParty = document.querySelectorAll('.lu-worldmap__legend li').length;
    out.companion = !!document.querySelector('.lu-worldmap__legend .lu-wm-key--party');
  }
  return out;
}

/** DOM / state summary for scripted checks. */
function info() {
  const r = (/** @type {string} */ sel) => document.querySelector(sel)?.getBoundingClientRect();
  const box = (/** @type {DOMRect|undefined} */ b) => (b ? [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)] : null);
  const vis = (/** @type {string} */ sel) => { const el = document.querySelector(sel); return !!el && getComputedStyle(el).visibility === 'visible' && Number(getComputedStyle(el).opacity) > 0.01 && getComputedStyle(el).display !== 'none'; };
  const txt = (/** @type {string} */ sel) => [...document.querySelectorAll(sel)].map((e) => e.textContent.trim());
  return {
    open: panel.isOpen,
    member: panel.memberId,
    focus: panel.focus,
    focusedPreset: panel.focusedPreset,
    rule: panel.rule,
    tabs: txt('.lu-party__tab'),
    current: document.querySelector('.lu-party__current')?.textContent ?? '',
    currentCard: document.querySelector('.lu-party__card.is-current')?.getAttribute('data-preset') ?? '',
    focusCard: document.querySelector('.lu-party__presets.is-focus .lu-party__card.is-focus')?.getAttribute('data-preset') ?? '',
    selRow: document.querySelector('.lu-party__row.is-sel')?.getAttribute('data-field') ?? '',
    values: txt('.lu-party__value-t'),
    // the note box's label and help (a value's hint shown there — cut in its row, or no hint column on a narrow window — is descHint)
    desc: [...document.querySelectorAll('.lu-party__desc .lu-party__desc-k, .lu-party__desc .lu-party__desc-t')].map((e) => e.textContent.trim()).join(''),
    descHint: document.querySelector('.lu-party__desc .lu-party__desc-hint')?.textContent.trim() ?? '',
    // the focused rule row's value hint (the language's), and whether its row shows it whole
    focusHint: (() => { const f = localFields()[panel.focus]; const v = panel.rule?.[panel.focus]; return f && v ? f.hints[v] ?? '' : ''; })(),
    focusHintShown: document.querySelector('.lu-party__row.is-sel .lu-party__hint')?.textContent.trim() ?? '',
    hints: txt('.lu-party__hint'),
    name: document.querySelector('.lu-party__name')?.textContent ?? '',
    frames: txt('.lu-pframe'),
    frameClasses: [...document.querySelectorAll('.lu-pframe')].map((e) => e.className),
    closes: state.closes, onCloseCalls: state.onCloseCalls,
    window: box(r('.lu-party__window')), body: box(r('.lu-party__body')),
    framesBox: box(r('.lu-pframes')), loc: box(r('.lu-loc')), vitals: box(r('.lu-vitals')), help: box(r('.lu-help')),
    bodyScrolls: (() => { const b = document.querySelector('.lu-party__body'); return b ? b.scrollHeight > b.clientHeight + 1 : null; })(),
    shown: { frames: vis('.lu-pframes'), loc: vis('.lu-loc'), minimap: vis('.lu-minimap'), panel: vis('.lu-party') },
  };
}

/**
 * DOM writes of `frames.update` over `n` calls with `list` (a MutationObserver on the frames):
 * the number of mutation records, and the time per call.
 * @param {PartyFrameEntry[]} list @param {number} [n]
 */
async function frameWrites(list, n = 200) {
  const el = document.querySelector('.lu-pframes');
  let count = 0;
  const mo = new MutationObserver((recs) => { count += recs.length; });
  mo.observe(el, { subtree: true, childList: true, attributes: true, characterData: true });
  const t0 = performance.now();
  for (let i = 0; i < n; i++) frames.update(list);
  const ms = (performance.now() - t0) / n;
  await new Promise((res) => setTimeout(res, 0));
  mo.disconnect();
  return { writes: count, usPerCall: Math.round(ms * 1000) };
}

// ---------------------------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------------------------
let last = performance.now();
let frameT = 0;
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  // idle animation (2 frames at 2.5 fps)
  frameT += dt;
  const col = Math.floor(frameT * 2.5) % 2;
  for (const c of [player, ...members.map((m) => m.actor)]) c.tex.offset.x = col / c.sheet.columns;

  // the page's own shortcuts (a game's): G the panel, N the map; the panel's input read here first
  if (panel.isOpen) {
    if (input.consumeAction('party')) menu(false);
    else if (panel.update(dt, input)) state.closes++;
  } else if (ui.worldMap.isOpen) {
    if (input.consumeAction('map') || input.consumeAction('cancel')) ui.worldMap.close();
  } else if (!ui.dialog.isOpen) {
    if (input.consumeAction('party')) menu(true);
    if (input.consumeAction('map')) ui.worldMap.open();
    if (input.consumeAction('dialog')) dialog();
    if (input.consumeAction('hud')) ui.setHudVisible(!ui.hudVisible);
    if (input.consumeAction('photo')) ui.setVisible(!ui.visible);
    for (let i = 0; i < 3; i++) if (input.wasPressed(`Digit${i + 1}`)) hurt(i, 37);
    if (input.wasPressed('Digit4')) healAll();
    if (input.wasPressed('Digit5')) setDown(1);
    if (input.wasPressed('Digit6')) fighting();
  }
  if (state.feed) frames.update(frameList());
  if (COMBAT) ui.combat.hud.setVitals(vitals);
  if (ui.minimap.visible) ui.minimap.update(mapState);
  if (ui.worldMap.isOpen) ui.worldMap.update(dt, mapState);
  renderer.render(scene, camera);
  ui.update(dt, { camera, input });
  input.endFrame();
}
requestAnimationFrame(frame);

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/**
 * Handle of the party UI sandbox (`window.__party`, read by sandbox/party_ui.json).
 * @typedef {object} PartyUIHandle
 * @property {boolean} combat  `?combat=1`
 * @property {typeof members} members  the fake members (rule, hp, down, fighting …)
 * @property {typeof vitals} vitals  the player's vitals (combat; its level is the members' `Lv`)
 * @property {typeof state} state  onRule calls, sounds, closes …
 * @property {typeof panel} panel
 * @property {typeof frames} frames
 * @property {typeof mapState} mapState
 * @property {typeof panelOpts} panelOpts  `PartyPanelOpts` as Party.openMenu builds them
 * @property {typeof frameList} frameList  the HUD's lines as Party.frames() builds them
 * @property {typeof menu} menu  open (focus a member) / close the panel
 * @property {typeof hurt} hurt  `(i, n)`
 * @property {typeof healAll} healAll
 * @property {typeof setDown} setDown  `(i, down?)`
 * @property {typeof fighting} fighting  `(on?)`
 * @property {typeof dialog} dialog
 * @property {typeof info} info  DOM / state summary
 * @property {typeof mapHashes} mapHashes  the maps with no / an empty / the party
 * @property {typeof frameWrites} frameWrites  `(list, n)`: DOM writes and µs per frames.update
 * @property {typeof countPartyRules} countPartyRules
 * @property {typeof expect} expect  `(actual, expected, label)`: a mismatch throws a page error
 * @property {typeof L} L  `(english, …parts)`: the text a check expects in the page's language
 * @property {typeof normalizeRule} normalizeRule
 * @property {typeof ruleOfPreset} ruleOfPreset
 */

window.__ui = ui;
/** @type {PartyUIHandle} */
const handle = {
  combat: COMBAT, members, vitals, state, panel, frames, mapState, panelOpts, frameList,
  menu, hurt, healAll, setDown, fighting, dialog, info, mapHashes, frameWrites, countPartyRules, expect, L,
  normalizeRule, ruleOfPreset,
};
Object.assign(window, { __party: handle });
