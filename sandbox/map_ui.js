/**
 * Map UI sandbox: the HUD minimap and the world map (src/engine/ui/Minimap.js, docs/specs/PIXEL_UI.md
 * §5) on a real UI root over a backdrop of the game (docs/assets/screenshots/ui-backdrop-*.jpg),
 * fed from a shipped level's file like the game feeds them (`Game._setupMaps`: the painted
 * LevelMap, the level, its regions and points of interest), in the
 * page's language (?lang=en|ja|zh; the names and the levels' subtitles through a small content table
 * of this page — terms, and a unit under the text key the level holds for its subtitle, as the
 * game's `term()` / `loc()` would give them, docs/specs/I18N.md §4.2, §4.8).
 *
 * Cases (?case=): `emberfall` (default: a peaceful village), `cinderwatch` (combat: the legend's
 * Enemy / Waystone / Chest rows, foes, the boss's ruby, a companion), `campaign` (a wide overview of
 * two levels side by side with the level's origin, as CampaignRuntime.worldMap gives it), `painted`
 * (no level: the minimap draws the painted map in art pixels). ?map=1 opens the world map.
 * Handles for scripted checks (sandbox/map_ui.json): window.__map (`ready`, `info()`, `open(on)`,
 * `face(x, z)`, `party(n)`, `hashes()`, `at(where)` — the player on a marker kind ('boss',
 * 'waystone') or at [x, z] —, `clear()` — the world map's layers (the markers over the region
 * names) and the names lying over the player's arrow or a waystone / the boss).
 */
import { UI } from '../src/engine/ui/UI.js';
import { renderLevelMap } from '../src/engine/level/LevelMap.js';
import { normalizeLevel } from '../src/engine/level/LevelFormat.js';
import { setContentTables, term, loc } from '../src/engine/i18n/ContentText.js';
import { textKeyOf } from '../src/engine/i18n/ContentKeys.js';
import { getLang } from '../src/engine/i18n/I18n.js';

const q = new URLSearchParams(location.search);
const CASE = q.get('case') ?? 'emberfall';

/**
 * The names and the levels' subtitles as a translator would give them (this page's content table:
 * a level's subtitle is a unit under the key its level holds, `SUBTITLES`; everything else a term).
 */
const NAMES = {
  ja: {
    'Cinderwatch Pass': 'シンダーウォッチ峠', 'Where the Old Fires Wake': '古き火の目覚める地', 'The Caldera': 'カルデラ',
    'Waystone Camp': '道標石の野営地', 'The Crossroads': '四つ辻', 'Cinder Ridge': '燃えさしの尾根', 'Mossy Glade': '苔むす空き地',
    'Bramble Ruins': '茨の遺跡', 'Hollow Mire': 'うつろの沼', 'Cinder Quarry': '燃えさしの石切り場',
    Emberfall: 'エンバーフォール', 'Riverside Village': '川辺の村', 'Windmill Hill': '風車の丘', "Tobin's Farm": 'トビンの農場',
    'Amberleaf Grove': '琥珀葉の森', 'Campfire Meadow': 'たき火の草原', 'Emberfall Falls': 'エンバーフォールの滝', 'Village Square': '村の広場',
    "The Ferryman's Lantern": '渡し守のランタン',
  },
  zh: {
    'Cinderwatch Pass': '烬望隘口', 'Where the Old Fires Wake': '古火苏醒之地', 'The Caldera': '火山口',
    'Waystone Camp': '路标石营地', 'The Crossroads': '十字路口', 'Cinder Ridge': '烬岭', 'Mossy Glade': '苔藓林地',
    'Bramble Ruins': '荆棘遗迹', 'Hollow Mire': '空谷沼泽', 'Cinder Quarry': '烬石采石场',
    Emberfall: '余烬村', 'Riverside Village': '河畔村庄', 'Windmill Hill': '风车山', "Tobin's Farm": '托宾农场',
    'Amberleaf Grove': '琥珀叶林', 'Campfire Meadow': '篝火草地', 'Emberfall Falls': '余烬瀑布', 'Village Square': '村庄广场',
    "The Ferryman's Lantern": '摆渡人的提灯',
  },
};

const backdrop = /** @type {HTMLElement} */ (document.getElementById('backdrop'));
backdrop.style.backgroundImage = `url("../docs/assets/screenshots/ui-backdrop-${CASE === 'cinderwatch' ? 'caldera' : 'crossroads'}.jpg")`;

const ui = new UI(document.body);
const lang = getLang();
/** The subtitles among NAMES (units, under the key the level holds for its subtitle: `useLevel`). */
const SUBTITLES = new Set(['Where the Old Fires Wake', 'Riverside Village']);
const table = Object.prototype.hasOwnProperty.call(NAMES, lang) ? NAMES[/** @type {'ja'|'zh'} */ (lang)] : null;
/** @type {Record<string, string>} */
const terms = {};
if (table) {
  for (const [en, target] of Object.entries(table)) if (!SUBTITLES.has(en)) terms[en] = target;
  setContentTables({ terms });
}

/**
 * The page's content table with the shown level's subtitle: a unit under the key the level holds
 * for it (`textKeyOf(level, 'subtitle')`), as the level's own table has it.
 * @param {any} level
 */
function useLevel(level) {
  if (!table) return;
  const key = textKeyOf(level, 'subtitle');
  const target = Object.prototype.hasOwnProperty.call(table, level.subtitle) ? table[level.subtitle] : '';
  setContentTables({ terms, units: key && target ? { [key]: { source: level.subtitle, target } } : {} });
}

/** @param {string} file */
async function loadLevel(file) {
  const raw = await (await fetch(`${import.meta.env.BASE_URL}levels/${file}.json`)).json();
  return normalizeLevel(raw).level;
}

/** @typedef {{ x: number, z: number }} XZ */
/** The game's map state (`Game._map`). */
const state = {
  /** @type {XZ} */ player: { x: 0, z: 0 },
  /** @type {XZ} */ facing: { x: 0, z: 1 },
  /** @type {XZ} */ view: { x: 0, z: -1 },
  /** @type {XZ[]} */ npcs: [],
  /** @type {{ x: number, z: number, kind: string, hidden?: boolean }[]} */ markers: [],
  /** @type {XZ[]|undefined} */ enemies: undefined,
  /** @type {XZ[]|undefined} */ party: undefined,
};

const MARK = { signpost: 'sign', well: 'well', campfire: 'fire', waystone: 'waystone', chest: 'chest', house: 'door' };

/**
 * Feed the maps from a level as the game does.
 * @param {any} level
 * @param {{ combat?: boolean, campaign?: any }} [o]
 */
function setup(level, o = {}) {
  useLevel(level);
  const map = renderLevelMap(level);
  ui.hud.setLocation(term('The Crossroads'), term(level.name));
  ui.hud.setTime(17.2);
  ui.minimap.setMap(map, { view: 34, ...(CASE === 'painted' ? {} : { level }) });
  ui.minimap.enabled = true;
  const regions = level.objects.filter((/** @type {any} */ r) => r.type === 'region').map((/** @type {any} */ r) => ({ ...r, name: term(r.name) }));
  if (o.campaign) {
    const c = o.campaign;
    ui.worldMap.setMap(c.map, { title: term(c.title), subtitle: term(level.name), regions: c.regions.map((/** @type {any} */ r) => ({ ...r, name: term(r.name) })), combat: !!o.combat, origin: c.origin });
  } else ui.worldMap.setMap(map, { title: term(level.name), subtitle: loc(textKeyOf(level, 'subtitle'), level.subtitle, 'title'), regions, ...(o.combat ? { combat: true } : {}) });
  const sp = level.spawn;
  state.player = { x: sp.x, z: sp.z };
  state.npcs = level.objects.filter((/** @type {any} */ n) => n.type === 'npc').map((/** @type {any} */ n) => ({ x: n.x, z: n.z }));
  state.markers = level.objects.filter((/** @type {any} */ m) => Object.prototype.hasOwnProperty.call(MARK, m.type) && Number.isFinite(m.x))
    .map((/** @type {any} */ m) => ({ x: m.type === 'house' ? m.x : m.x, z: m.type === 'house' ? m.z + (m.opts?.depth ?? 3) / 2 + 0.6 : m.z, kind: MARK[m.type] }));
  if (o.combat) {
    state.enemies = level.objects.filter((/** @type {any} */ e) => e.type === 'enemy').slice(0, 40).map((/** @type {any} */ e) => ({ x: e.x, z: e.z }));
    const boss = level.objects.find((/** @type {any} */ e) => e.type === 'enemy' && /boss|cinderheart/i.test(`${e.kind} ${e.id}`));
    if (boss) state.markers.push({ x: boss.x, z: boss.z, kind: 'boss' });
  }
}

let ready = null;
if (CASE === 'cinderwatch') {
  ready = loadLevel('cinderwatch-pass').then((level) => {
    setup(level, { combat: true });
    const way = level.objects.find((/** @type {any} */ w) => w.id === 'waystone_crossroads') ?? { x: 48, z: 60 };
    state.player = { x: way.x + 1.1, z: way.z + 1.9 };
    state.facing = { x: -1, z: 0 };
    // two foes near the crossroads, one beyond the window (a pip), a companion beside the player
    state.enemies = [...(state.enemies ?? []), { x: way.x - 6, z: way.z + 8 }, { x: way.x + 9, z: way.z - 5 }, { x: way.x - 30, z: way.z + 4 }];
    state.party = [{ x: way.x + 2.3, z: way.z + 0.6 }];
  });
} else if (CASE === 'campaign') {
  ready = Promise.all([loadLevel('emberfall'), loadLevel('sample-hamlet').catch(() => null)]).then(([a, b]) => {
    const ma = renderLevelMap(a);
    const mb = b ? renderLevelMap(b) : ma;
    const pad = 2, gap = 6;
    const W = pad * 2 + ma.width + gap + mb.width, D = pad * 2 + Math.max(ma.depth, mb.depth);
    const ppt = Math.max(1, Math.min(ma.pixelsPerTile, mb.pixelsPerTile));
    const canvas = document.createElement('canvas');
    canvas.width = W * ppt; canvas.height = D * ppt;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1b2132';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(ma.canvas, pad * ppt, pad * ppt, ma.width * ppt, ma.depth * ppt);
    ctx.globalAlpha = 0.45;
    ctx.drawImage(mb.canvas, (pad + ma.width + gap) * ppt, pad * ppt, mb.width * ppt, mb.depth * ppt);
    ctx.globalAlpha = 1;
    const regions = [
      { name: a.name, minX: pad, maxX: pad + ma.width, minZ: pad, maxZ: pad + ma.depth },
      { name: b?.name ?? 'Sample Hamlet', minX: pad + ma.width + gap, maxX: pad + ma.width + gap + mb.width, minZ: pad, maxZ: pad + mb.depth },
      ...a.objects.filter((/** @type {any} */ r) => r.type === 'region').map((/** @type {any} */ r) => ({ name: r.name, minX: r.minX + pad, maxX: r.maxX + pad, minZ: r.minZ + pad, maxZ: r.maxZ + pad })),
    ];
    setup(a, { campaign: { map: { canvas, pixelsPerTile: ppt, width: W, depth: D }, origin: [pad, pad], title: "The Ferryman's Lantern", regions } });
  });
} else {
  ready = loadLevel('emberfall').then((level) => setup(level));
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (ui.minimap.visible) ui.minimap.update(state);
  if (ui.worldMap.isOpen) ui.worldMap.update(dt, state);
  requestAnimationFrame(frame);
}

/** FNV-1a of a canvas's PNG. @param {HTMLCanvasElement} c */
function canvasHash(c) {
  const s = c.toDataURL('image/png');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

/** @param {string} sel */
const box = (sel) => {
  const r = document.querySelector(sel)?.getBoundingClientRect();
  return r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null;
};

/** @type {any} */ (window).__map = {
  ui, state,
  ready: ready.then(() => { requestAnimationFrame(frame); if (q.get('map') === '1') ui.worldMap.open(); return ui.fontsReady; }),
  /** @param {boolean} [on] */
  open(on = true) { if (on) { ui.worldMap.setRegion(term(q.get('region') ?? (CASE === 'emberfall' ? 'Village Square' : 'The Crossroads'))); ui.worldMap.open(); } else ui.worldMap.close(); return ui.worldMap.isOpen; },
  /** @param {number} x @param {number} z */
  face(x, z) { state.facing = { x, z }; return true; },
  /** @param {number} n */
  party(n) { state.party = Array.from({ length: n }, (_, i) => ({ x: state.player.x + 1.5 + i, z: state.player.z + 1 })); return n; },
  /**
   * Put the player on the first marker of a kind ('boss', 'waystone', 'fire' …) or at [x, z]; the
   * world map places its region names for it at the next frame. Returns where.
   * @param {string|number[]} where
   */
  at(where) {
    const m = Array.isArray(where) ? { x: where[0], z: where[1] } : state.markers.find((k) => k.kind === where);
    if (m) state.player = { x: m.x + (Array.isArray(where) ? 0 : 0.6), z: m.z + (Array.isArray(where) ? 0 : 0.4) };
    return [state.player.x, state.player.z];
  },
  /**
   * The world map's marker layer and its region names: `layered` (the live markers' canvas over the
   * names: after them in the map's box, a higher z-index) and `over` (each shown name whose box
   * covers the player's arrow, a waystone or the boss: "NAME > player" …), `names` (each shown
   * name's box on the map, art px).
   */
  clear() {
    const wm = /** @type {any} */ (ui.worldMap);
    const labels = wm._labels;
    const z = (/** @type {Element|null} */ e) => (e ? Number(getComputedStyle(e).zIndex) || 0 : 0);
    const layered = !!labels && wm.canvas.parentElement === labels.parentElement
      && !!(labels.compareDocumentPosition(wm.canvas) & Node.DOCUMENT_POSITION_FOLLOWING) && z(wm.canvas) > z(labels);
    const S = wm._scale, [ox, oz] = wm._origin;
    const keep = [{ kind: 'player', x: state.player.x, z: state.player.z, r: 5 }, ...state.markers.filter((m) => !m.hidden && (m.kind === 'waystone' || m.kind === 'boss')).map((m) => ({ kind: m.kind, x: m.x, z: m.z, r: m.kind === 'boss' ? 4 : 3 }))];
    const over = [];
    const names = [];
    for (const l of wm._labelList) {
      const b = l._box;
      if (!b || l.style.visibility === 'hidden') continue;
      names.push(`${l.textContent} [${b.left},${b.top},${b.right},${b.bottom}]`);
      for (const k of keep) {
        const x = Math.floor((k.x + ox) * S), y = Math.floor((k.z + oz) * S);
        if (b.left < x + k.r + 1 && b.right > x - k.r && b.top < y + k.r + 1 && b.bottom > y - k.r) over.push(`${l.textContent} > ${k.kind}`);
      }
    }
    return { layered, over, names };
  },
  hashes() {
    const base = { ...state, party: undefined };
    const out = {};
    ui.minimap.update(base);
    out.miniNone = canvasHash(ui.minimap.canvas);
    ui.minimap.update({ ...base, party: [] });
    out.miniEmpty = canvasHash(ui.minimap.canvas);
    ui.minimap.update({ ...base, party: [{ x: state.player.x + 2, z: state.player.z + 2 }] });
    out.miniParty = canvasHash(ui.minimap.canvas);
    return out;
  },
  info() {
    const legend = [...document.querySelectorAll('.lu-worldmap__legend li')].map((li) => li.textContent);
    const labels = [...document.querySelectorAll('.lu-worldmap__label')].map((l) => `${l.textContent}${/** @type {HTMLElement} */ (l).style.visibility === 'hidden' ? ' (hidden)' : ''}`);
    return {
      lang, case: CASE, scale: ui.scale && { px: ui.px, artW: ui.artW, artH: ui.artH },
      minimap: box('.lu-minimap'), clock: box('.lu-clock'), window: box('.lu-worldmap__window'), map: box('.lu-worldmap__map'),
      canvas: [ui.worldMap.canvas.width, ui.worldMap.canvas.height], legend, labels,
      title: document.querySelector('.lu-worldmap__title')?.textContent ?? '', sub: document.querySelector('.lu-worldmap__sub')?.textContent ?? '',
      region: document.querySelector('.lu-worldmap__region')?.textContent ?? '',
    };
  },
};
