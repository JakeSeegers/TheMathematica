/**
 * Story UI sandbox: the story components of `UI.useStoryUI()` — journal, emote bubbles, cutscene
 * letterbox with the skip hint, end card, the toast kinds and `setHudVisible` — over a small plaza
 * with nine pixel-art villagers (raw three.js, the engine's character sheets).
 * Keys: J journal (then Q/E or ←/→ tabs, ↑/↓ or W/S select, Esc close) · 1–9 an emote over that
 * villager · 0 all nine · C cutscene on/off (hold Esc to skip it) · D a dialog · K end card ·
 * T the three toast kinds · H HUD on/off. Space / Enter / F confirm.
 * Handles for scripted checks (sandbox/story_ui.json): window.__ui, window.__story.
 */
import * as THREE from 'three';
import { UI } from '../src/engine/ui/UI.js';
import { Journal } from '../src/engine/ui/Journal.js';
import { Emotes } from '../src/engine/ui/Emotes.js';
import { EndCard } from '../src/engine/ui/EndCard.js';
import { createCharacterSheet } from '../src/engine/pixel/CharacterSprites.js';
import { PixelCanvas } from '../src/engine/pixel/PixelCanvas.js';
import { PALETTE } from '../src/engine/pixel/Palette.js';
import { RNG } from '../src/engine/utils/math.js';
import { t as uiString } from '../src/engine/i18n/I18n.js';
import STORY_UI from '../src/engine/i18n/strings/story-ui.js';

/** @import { JournalData } from '../src/engine/ui/types.js' */

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
      journal: ['KeyJ'], cutscene: ['KeyC'], dialog: ['KeyD'], end: ['KeyK'], toasts: ['KeyT'], hud: ['KeyH'],
    };
    this._pressed = new Set();
    this._down = new Set();
    this._onDown = (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this._pressed.add(e.code);
      this._down.add(e.code);
    };
    this._onUp = (e) => this._down.delete(e.code);
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
// Renderer / scene: a plaza at golden hour, nine villagers in an arc
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
scene.background = new THREE.Color(0xd9a77c);
scene.fog = new THREE.Fog(0xd9a77c, 26, 60);
const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.5, 200);
camera.position.set(0, 8.5, 19);
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
  new THREE.MeshLambertMaterial({ map: noiseTexture(PALETTE.grass.slice(2, 5), 11, 80) }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const plaza = new THREE.Mesh(new THREE.CircleGeometry(10, 40),
  new THREE.MeshLambertMaterial({ map: noiseTexture(PALETTE.stoneWarm.slice(2, 6), 3, 14) }));
plaza.rotation.x = -Math.PI / 2;
plaza.position.y = 0.01;
scene.add(plaza);
// a few trees behind the plaza for depth
const rng = new RNG(7);
const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c3a22 });
const leafMat = new THREE.MeshLambertMaterial({ color: 0x4f8f3d, flatShading: true });
for (let i = 0; i < 9; i++) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.6, 6), trunkMat);
  trunk.position.y = 0.8;
  const s = rng.range(1.2, 1.7);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), leafMat);
  crown.position.y = 1.6 + s * 0.8;
  g.add(trunk, crown);
  g.position.set(-14 + i * 3.5 + rng.range(-0.6, 0.6), 0, -9 - rng.range(0, 4));
  scene.add(g);
}
scene.add(new THREE.HemisphereLight(0xb8c4ff, 0x6a4a34, 1.3));
const sun = new THREE.DirectionalLight(0xffc08a, 2.6);
sun.position.set(-10, 12, 8);
scene.add(sun);

const PRESETS = ['innkeeper', 'bard', 'elder', 'merchant', 'child', 'guard', 'farmer', 'scholar', 'dancer'];
const ICONS = ['!', '?', '…', '♪', '♥', 'zzz', '#', '💧', '✦'];
/** @type {{ sprite: THREE.Sprite, tex: THREE.Texture, sheet: ReturnType<typeof createCharacterSheet>, home: THREE.Vector3 }[]} */
const villagers = PRESETS.map((preset, i) => {
  const sheet = createCharacterSheet(preset);
  const tex = sheet.texture.clone();
  tex.repeat.set(1 / sheet.columns, 1 / sheet.rows);
  tex.offset.set(0, tex.flipY ? 1 - 1 / sheet.rows : 0); // row 0: facing down
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.5 }));
  sprite.center.set(0.5, 0);
  sprite.scale.set(sheet.frameWidth / sheet.pixelsPerUnit, sheet.frameHeight / sheet.pixelsPerUnit, 1);
  const a = (i - 4) * 0.135;
  const home = new THREE.Vector3(Math.sin(a) * 15, 0, 15 - Math.cos(a) * 15 - 3);
  sprite.position.copy(home);
  scene.add(sprite);
  return { sprite, tex, sheet, home };
});

// ---------------------------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------------------------
const input = new StubInput();
const ui = new UI(document.body);
/** story DOM before useStoryUI (must be 0) */
const storyNodesBefore = document.querySelectorAll('.lu-journal, .lu-emote, .lu-emotes, .lu-letterbox, .lu-endcard').length;
ui.useStoryUI({ Journal, Emotes, EndCard });
ui.hud.setLocation("Ferryman's Rest", 'The Lantern Coast');
ui.hud.setTime(17.4);
ui.hud.setControls([
  { keys: 'J', label: 'Journal' },
  { keys: '1/9', label: 'Emotes (0: all)' },
  { keys: 'C', label: 'Cutscene' },
  { keys: 'D', label: 'Dialog' },
  { keys: 'K', label: 'End card' },
  { keys: 'T', label: 'Toasts' },
  { keys: 'H', label: 'HUD' },
]);
ui.prompt.keyHint = 'Space';
ui.prompt.show(villagers[4].sprite, 'Talk', { offsetY: 2.35 });
// a painted minimap (so the cutscene's hiding of it shows)
const mapCanvas = document.createElement('canvas');
mapCanvas.width = mapCanvas.height = 160;
{
  const g = mapCanvas.getContext('2d');
  g.fillStyle = '#4f7a3a'; g.fillRect(0, 0, 160, 160);
  g.fillStyle = '#8f8576'; g.beginPath(); g.arc(80, 80, 40, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#3b7fa6'; g.fillRect(0, 130, 160, 30);
  g.fillStyle = '#a4493b'; g.fillRect(30, 30, 18, 14); g.fillRect(110, 36, 16, 14);
}
ui.minimap.setMap({ canvas: mapCanvas, pixelsPerTile: 4, width: 40, depth: 40 }, { view: 34 });
const mapState = { player: new THREE.Vector3(20, 0, 24), facing: { x: 0, z: -1 }, view: { x: 0, z: -1 }, npcs: villagers.map((v) => ({ x: 20 + v.home.x, z: 20 + v.home.z })) };

/** @type {JournalData} */
const JOURNAL = {
  gold: 1240,
  quests: [
    {
      id: 'lantern', title: "The Ferryman's Lantern", state: 'active',
      text: 'Old {Maren} lost her lantern to the river the night the ferry stopped running. Without its light, no one dares the crossing after dusk.',
      log: [
        'Maren told you of the lantern she lost to the river.',
        'A fisher saw something glint near the {old weir}.',
        'You found the lantern caught in the weir — but its flame is out.',
      ],
      goals: [
        { text: 'Search the riverbank', done: true },
        { text: 'Find a way to relight the lantern', done: false },
        { text: 'Return the lantern to Maren', done: false },
      ],
    },
    {
      id: 'song', title: 'A Song for Wren', state: 'active',
      text: 'The bard {Wren} has forgotten the last verse of the old ferry song, and the festival is three days away.',
      log: ['Wren asked you to listen for the ferry song.'],
      goals: [{ text: 'Ask the elders about the song', done: false }],
    },
    {
      id: 'chronicle', title: 'Chronicle of the Tides', state: 'active',
      text: 'The keeper of the tide-house writes down every high water since the founding of the village. Some pages have gone missing, and with them the reason the ferry was built where it stands.',
      log: [
        'The tide-keeper showed you the chronicle.', 'Three pages are missing from the year of the great flood.',
        'One page was used to wrap fish at the market.', 'The fishmonger kept it — for a price.',
        'You bought the page for two river pearls.', 'The second page lines a bird\'s nest in the bell tower.',
        'A climb, a scolding from the bell-ringer, and the second page.', 'The last page, they say, went downriver.',
        'A trader from Gildhaven may have it.', 'The trader will return with the spring boats.',
        'The spring boats are late this year.', 'A storm upriver, the ferryman says.',
        'The trader arrived at last — without the page.', 'He sold it, he says, to a woman with a lantern.',
      ],
      goals: [{ text: 'Find the missing pages (2/3)', done: false }, { text: 'Bring them to the tide-keeper', done: false }],
    },
    { id: 'planks', title: 'Planks for the Pier', state: 'active', text: 'The pier needs mending before the boats return.', goals: [{ text: 'Gather planks (2/3)', done: false }] },
    { id: 'mill', title: 'Mending the Mill', state: 'done', text: 'The mill wheel turns again.', log: ['You freed the wheel from the reeds.', 'The miller paid you in flour and thanks.'] },
    { id: 'letter', title: 'The Lost Letter', state: 'failed', text: 'The letter was meant for the ferryman. It never arrived.', log: ['The rain washed the ink away.'] },
    { id: 'first', title: 'First Light', state: 'done', text: 'You arrived at dawn.' },
    { id: 'bed', title: 'A Warm Bed', state: 'done', text: 'The inn had a room after all.' },
    { id: 'supper', title: 'Fish for Supper', state: 'done', text: 'Three trout, one boot.' },
  ],
  items: [
    { id: 'lantern', name: 'Brass Lantern', key: true, text: 'Maren\'s lantern, dented and cold. The glass is whole; the {wick} is not.' },
    { id: 'token', name: 'Ferry Token', key: true, count: 2, text: 'Worn brass tokens. The ferryman takes one per crossing.' },
    { id: 'chart', name: 'Old River Chart', key: true, text: 'The river as it ran fifty years ago. The weir is marked with an X.' },
    { id: 'apple', name: 'Apple', count: 4, text: 'Crisp and a little sour.' },
    { id: 'plank', name: 'Plank', count: 2, text: 'Good oak, a little damp.' },
    { id: 'herb', name: 'Healing Herb', count: 3, text: 'Bitter, but it helps.' },
    { id: 'line', name: 'Fishing Line', count: 1 },
    { id: 'candle', name: 'Candle Stub', count: 5, text: 'Not enough to light a lantern for long.' },
    { id: 'pearl', name: 'River Pearl', count: 1, text: 'Small and grey, and worth more than it looks.' },
  ],
};
ui.journal.setData(JOURNAL);

const state = {
  ready: false,
  /** journal closes reported by update() / onClose */
  closes: 0,
  onCloseCalls: 0,
  /** skip hold progress (0..1); `skipOverride` pins it for screenshots */
  skip: 0,
  skipOverride: -1,
  skipped: 0,
  endResolved: 0,
  dialogResults: [],
  storyNodesBefore,
  sway: true,
};
ui.journal.onClose = () => { state.onCloseCalls++; };

ui.fontsReady.then(() => { state.ready = true; });

// ---------------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------------
/** @param {boolean} [open] */
function journal(open = !ui.journal.isOpen, tab = undefined) {
  if (open) ui.journal.open(tab);
  else ui.journal.close();
  return ui.journal.isOpen;
}
/** @param {number} i @param {string} [icon] @param {number} [seconds] */
function emote(i, icon = ICONS[i], seconds = 1.6) {
  ui.emotes.show(villagers[i].sprite, icon, seconds);
}
/** @param {number} [seconds] */
function emoteAll(seconds = 2.5) {
  villagers.forEach((v, i) => ui.emotes.show(v.sprite, ICONS[i], seconds));
  return ui.emotes.count;
}
/** @param {boolean} on */
function cutscene(on) { return ui.setCutscene(on); }
function dialog() {
  if (ui.dialog.isOpen) return false;
  ui.dialog.open({
    speaker: 'Maren',
    portraitColor: '#7fb0e0',
    lines: [
      'You found it! My {lantern}… though the flame is long gone.',
      { speaker: 'Wren', text: 'They say only the {first light} of the festival can rekindle it.' },
    ],
  }).then((c) => state.dialogResults.push(c ?? null));
  return true;
}
function endCard() {
  ui.endCard.show({
    title: 'The Lantern Burns',
    subtitle: 'The ferry crosses again',
    text: 'Every dusk since, a small light has crossed the river and come back again.\nThe song has its last verse now. Wren sings it a little differently every time.',
  }).then(() => { state.endResolved++; });
  return ui.endCard.visible;
}
function toasts() {
  ui.hud.toast('New quest: The Ferryman\'s Lantern', 4, { kind: 'quest' });
  ui.hud.toast('Obtained: Brass Lantern', 4, { kind: 'item' });
  ui.hud.toast('story/main.story:42 — unknown command "glimmer"', 4, { kind: 'error' });
}
/** @param {boolean} [on] */
function hud(on = !ui.hudVisible) { ui.setHudVisible(on); return ui.hudVisible; }

/** The story UI's English words → their 'story-ui' keys (the checks write the English). */
const UI_WORDS = new Map(Object.entries(STORY_UI.en).filter(([, v]) => typeof v === 'string').map(([k, v]) => [v, k]));

/**
 * An expected value in the page's language: every string that is one of the story UI's English
 * words ('story-ui', `UI_WORDS`) becomes that word's `t()` of the page's language (`--lang=ja|zh`),
 * in arrays and objects too; anything else as it is (English: unchanged).
 * @param {unknown} v
 * @returns {unknown}
 */
function inPageLanguage(v) {
  if (typeof v === 'string') {
    const key = UI_WORDS.get(v);
    return key ? uiString(`story-ui.${key}`) : v;
  }
  if (Array.isArray(v)) return v.map(inPageLanguage);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, inPageLanguage(x)]));
  return v;
}

/**
 * Compare for a scripted check: a mismatch throws a page error (the harness exits 1). The story
 * UI's own words in `expected` are written in English and compared in the page's language
 * (`inPageLanguage`), so the checks pass in ja and zh too.
 * @param {unknown} actual @param {unknown} expected @param {string} label
 * @returns {string}
 */
function expect(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(inPageLanguage(expected));
  if (a === e) return `ok ${label}: ${a}`;
  setTimeout(() => { throw new Error(`[story_ui] ${label}: got ${a}, expected ${e}`); });
  return `FAIL ${label}: got ${a}, expected ${e}`;
}

/** DOM / state summary for scripted checks. */
function info() {
  const r = (sel) => document.querySelector(sel)?.getBoundingClientRect();
  const box = (b) => (b ? [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)] : null);
  const vis = (sel) => { const el = document.querySelector(sel); return !!el && getComputedStyle(el).visibility === 'visible' && Number(getComputedStyle(el).opacity) > 0.01; };
  return {
    journalOpen: ui.journal.isOpen, tab: ui.journal.tab, selected: ui.journal.selectedId,
    entries: document.querySelectorAll('.lu-journal__entry').length,
    emotes: ui.emotes.count, emotesInView: document.querySelectorAll('.lu-emote.is-inview').length,
    cutscene: ui.cutscene, hudVisible: ui.hudVisible,
    endCard: { visible: ui.endCard.visible, active: ui.endCard.active, resolved: state.endResolved },
    closes: state.closes, onCloseCalls: state.onCloseCalls, skipped: state.skipped,
    window: box(r('.lu-journal__window')), detail: box(r('.lu-journal__detail')), list: box(r('.lu-journal__list')),
    detailScroll: document.querySelector('.lu-journal__detail')?.scrollTop ?? 0,
    shown: { loc: vis('.lu-loc'), clock: vis('.lu-clock'), help: vis('.lu-help'), minimap: vis('.lu-minimap'), prompt: vis('.lu-prompt'), dialog: vis('.lu-dialog'), toasts: vis('.lu-toasts'), skip: vis('.lu-skip') },
    storyNodesBefore: state.storyNodesBefore,
  };
}

// ---------------------------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------------------------
let last = performance.now();
let t = 0;
let frameT = 0;
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  t += dt;
  // idle animation (2 frames at 2.5 fps) and one villager strolling (the bubble must follow)
  frameT += dt;
  const col = Math.floor(frameT * 2.5) % 2;
  for (const v of villagers) v.tex.offset.x = col / v.sheet.columns;
  if (state.sway) villagers[1].sprite.position.x = villagers[1].home.x + Math.sin(t * 0.8) * 0.8;

  if (!ui.journal) {
    // after __ui.disableStoryUI(): the scene and the plain UI only
    renderer.render(scene, camera);
    ui.update(dt, { camera, input });
    input.endFrame();
    return;
  }
  if (!ui.journal.isOpen && !ui.endCard.active && !ui.dialog.isOpen) {
    if (input.consumeAction('journal')) journal(true);
    for (let i = 0; i < 9; i++) if (input.wasPressed(`Digit${i + 1}`)) emote(i);
    if (input.wasPressed('Digit0')) emoteAll();
    if (input.consumeAction('cutscene')) cutscene(!ui.cutscene);
    if (input.consumeAction('dialog')) dialog();
    if (input.consumeAction('end')) endCard();
    if (input.consumeAction('toasts')) toasts();
    if (input.consumeAction('hud')) hud();
  } else if (ui.journal.isOpen && input.consumeAction('journal')) journal(false);
  // journal input: read here first (like a game would), so the close flag is seen
  if (ui.journal.isOpen && ui.journal.update(dt, input)) state.closes++;

  // cutscene skip: hold cancel; the ring fills in 1.2 s, empties when released
  if (ui.cutscene) {
    state.skip = input.action('cancel') ? Math.min(1, state.skip + dt / 1.2) : Math.max(0, state.skip - dt * 2);
    if (state.skip >= 1) {
      state.skip = 0;
      state.skipped++;
      cutscene(false);
      ui.hud.toast('Cutscene skipped');
    }
  }
  if (ui.cutscene) ui.setSkipHint(true, state.skipOverride >= 0 ? state.skipOverride : state.skip);

  ui.minimap.update(mapState);
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
 * Handle of the story UI sandbox (`window.__story`, read by sandbox/story_ui.json).
 * @typedef {object} StoryUIHandle
 * @property {typeof THREE} THREE
 * @property {THREE.Scene} scene
 * @property {THREE.PerspectiveCamera} camera
 * @property {typeof villagers} villagers
 * @property {StubInput} input
 * @property {typeof state} state
 * @property {JournalData} data  the sample journal data
 * @property {typeof journal} journal  open / close the journal (`(open?, tab?)`)
 * @property {typeof emote} emote  an emote over villager i
 * @property {typeof emoteAll} emoteAll  one of each icon over the nine villagers
 * @property {typeof cutscene} cutscene
 * @property {typeof dialog} dialog
 * @property {typeof endCard} endCard
 * @property {typeof toasts} toasts  the three toast kinds
 * @property {typeof hud} hud  `setHudVisible` toggle
 * @property {typeof info} info  DOM / state summary
 * @property {typeof expect} expect  `(actual, expected, label)`: a mismatch throws a page error
 */

window.__ui = ui;
/** @type {StoryUIHandle} */
const handle = {
  THREE, scene, camera, villagers, input, state, data: JOURNAL,
  journal, emote, emoteAll, cutscene, dialog, endCard, toasts, hud, info, expect,
};
window.__story = handle;
