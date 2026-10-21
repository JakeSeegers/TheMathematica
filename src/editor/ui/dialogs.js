/**
 * The editor's dialogs (docs/contracts/LEVEL_EDITOR.md §8): New level, Open, Save As, Level settings,
 * Resize, Keyboard shortcuts, restore-autosave, play-test problems and Find by text key. Each
 * returns a promise; the app performs the actual storage operations.
 */
import { h, icon, clear, formatBytes, formatTime, shortcutLabel } from './dom.js';
import { showDialog, confirmDialog } from './Dialog.js';
import { numberControl, selectControl, textControl, boolControl, colorControl, segmented } from './fields.js';
import { paintTileSwatch } from './ToolOptions.js';
import { ICONS } from '../icons.js';
import {
  TILE_TYPES, MIN_SIZE, MAX_SIZE, MAX_LEVEL, resizeLevel, DEFAULT_ENVIRONMENT,
} from '../../engine/level/LevelFormat.js';
import {
  listLocalLevels, deleteLocalLevel, listProjectLevels, deleteProjectLevel, slugify, listProjectCampaigns, projectLevelPath,
} from '../../engine/level/LevelStorage.js';
import { listRecovered, deleteRecovered, recoveredSize } from '../autosave.js';
import { parseStoryValues, storyHiddenIds, storyConditionCount } from '../story.js';
import { rootRows } from '../textKeys.js';
import { fillKeyView, copyText } from './keyView.js';
import { ROOM_DEFAULTS, ROOM_WALL, ROOM_LOOK, ROOM_CAMERA, ROOM_BACKDROP, roomLookChanges, backdropKind } from '../rooms.js';

/**
 * @import { EditorApp } from '../EditorApp.js'
 * @import { ResizeAnchor } from '../../engine/level/LevelFormat.js'
 */

const row = (label, control, hint = '') => h('div', { class: 'le-form-row' },
  h('label', { class: 'le-form-label' }, label),
  h('div', { class: 'le-form-control' }, control, hint ? h('div', { class: 'le-form-hint' }, hint) : null));

const groundTiles = () => TILE_TYPES.filter((t) => t.category !== 'stairs').map((t) => ({ value: t.char, label: `${t.name}  “${t.char}”` }));
/** Can a room's floor be this tile (walkable, not water, not void: the player starts on it)? @param {string} ch */
const roomFloorTile = (ch) => { const d = TILE_TYPES.find((t) => t.char === ch)?.def; return !!d && d.walkable === true && !d.water && !d.void; };

// ---------------------------------------------------------------------------------------------
// New level
// ---------------------------------------------------------------------------------------------

const SIZE_PRESETS = [
  { label: 'Small', w: 24, d: 18 }, { label: 'Medium', w: 32, d: 24 }, { label: 'Large', w: 48, d: 40 }, { label: 'Huge', w: 64, d: 64 },
];
/** Room sizes (File › New › Room). */
const ROOM_SIZE_PRESETS = [
  { label: 'Small', w: 12, d: 10 }, { label: 'Room', w: ROOM_DEFAULTS.width, d: ROOM_DEFAULTS.depth }, { label: 'Hall', w: 24, d: 18 },
];
/** What each kind of new level starts with (a kind switch resets these). */
const NEW_KIND_DEFAULTS = {
  level: { width: 32, depth: 24, fill: 'g', level: 2 },
  room: { width: ROOM_DEFAULTS.width, depth: ROOM_DEFAULTS.depth, fill: ROOM_DEFAULTS.fill, level: ROOM_DEFAULTS.level },
};

/**
 * File › New: an outdoor level (`createEmptyLevel`) or a room (`rooms.createRoomLevel`: kind 'room',
 * walls `wall` levels above the floor, `environment.interior` and the room look).
 * @returns {Promise<{ kind: 'level'|'room', name: string, width: number, depth: number, fill: string, level: number, border: number, wall: number }|null>}
 */
export function newLevelDialog(app) {
  /** @type {{ kind: 'level'|'room', name: string, width: number, depth: number, fill: string, level: number, border: number, wall: number }} */
  const v = { kind: 'level', name: 'Untitled', ...NEW_KIND_DEFAULTS.level, border: 2, wall: ROOM_DEFAULTS.wall };
  const name = textControl({ value: v.name, onChange: (x) => { v.name = x; }, onInput: (x) => { v.name = x; } });
  name.input.setAttribute('autofocus', '');
  const w = numberControl({ value: v.width, min: MIN_SIZE, max: MAX_SIZE, step: 1, int: true, slider: false, onChange: (x) => { v.width = clampSize(x); upd(); } });
  const d = numberControl({ value: v.depth, min: MIN_SIZE, max: MAX_SIZE, step: 1, int: true, slider: false, onChange: (x) => { v.depth = clampSize(x); upd(); } });
  const presets = h('div', { class: 'le-chips' });
  const sw = h('canvas', { class: 'le-swatch-canvas' });
  const fill = selectControl({ value: v.fill, options: groundTiles(), onChange: (x) => { v.fill = x; upd(); } });
  const lvl = numberControl({ value: v.level, min: 0, max: MAX_LEVEL, step: 1, int: true, onChange: (x) => { v.level = Math.max(0, Math.min(MAX_LEVEL, x ?? 0)); } });
  const border = numberControl({ value: v.border, min: 0, max: 8, step: 1, int: true, onChange: (x) => { v.border = Math.max(0, Math.min(8, x ?? 0)); upd(); } });
  const wall = numberControl({ value: v.wall, min: 1, max: 12, step: 1, int: true, onChange: (x) => { v.wall = Math.max(1, Math.min(12, x ?? ROOM_DEFAULTS.wall)); upd(); } });
  const summary = h('div', { class: 'le-form-summary' });
  // (rows the kind switch relabels or hides)
  const groundRow = row('Ground', h('div', { class: 'le-inline' }, h('span', { class: 'le-swatch is-static' }, sw), fill.el));
  const levelRow = row('Ground level', lvl.el, '');
  const borderRow = row('Forest border', border.el, 'Blocked forest tiles around the edge; the game scatters trees on them.');
  const wallRow = row('Wall height', wall.el, 'Rock walls on the north, west and east, this many levels above the floor (5 = 2.5 units); a low south wall with a door in its middle — the camera looks north over it.');
  const relabel = (r, label, hint) => {
    r.querySelector('.le-form-label').textContent = label;
    const hintEl = r.querySelector('.le-form-hint');
    if (hintEl) hintEl.textContent = hint;
    else if (hint) r.querySelector('.le-form-control').appendChild(h('div', { class: 'le-form-hint' }, hint));
  };
  function showPresets() {
    clear(presets).append(...(v.kind === 'room' ? ROOM_SIZE_PRESETS : SIZE_PRESETS).map((p) => h('button', {
      class: 'le-chip-btn', type: 'button', onClick: () => { v.width = p.w; v.depth = p.d; w.set(p.w); d.set(p.d); upd(); },
    }, `${p.label} ${p.w}×${p.d}`)));
  }
  function setKind(k) {
    v.kind = k;
    Object.assign(v, NEW_KIND_DEFAULTS[k]);
    const room = k === 'room';
    // (a room's floor holds the player start: no water, void or blocked ground on offer)
    for (const o of fill.el.querySelectorAll('option')) o.disabled = room && !roomFloorTile(o.value);
    w.set(v.width); d.set(v.depth); fill.set(v.fill); lvl.set(v.level);
    relabel(groundRow, room ? 'Floor' : 'Ground', '');
    relabel(levelRow, room ? 'Floor level' : 'Ground level', room ? 'Height level of the floor (level 1 = 0.5 units).' : 'Leave room below for rivers and ponds (level 2 = 1.0 units).');
    borderRow.hidden = room;
    wallRow.hidden = !room;
    showPresets();
    upd();
  }
  function upd() {
    paintTileSwatch(sw, TILE_TYPES.find((t) => t.char === v.fill)?.def, v.fill, app.textures);
    if (v.kind === 'room') {
      const fw = Math.max(0, v.width - 2 * ROOM_WALL);
      const fd = Math.max(0, v.depth - ROOM_WALL - 1);
      summary.textContent = `${v.width} × ${v.depth} tiles · a ${fw} × ${fd} floor inside rock walls, a door in the south wall · an interior: no sky, weather, forest border or outer scenery; the clock stopped, no minimap, a closer camera (Level settings › Environment)`;
      return;
    }
    const inner = Math.max(0, v.width - v.border * 2) * Math.max(0, v.depth - v.border * 2);
    summary.textContent = v.border > 0
      ? `${v.width} × ${v.depth} tiles · ${inner} playable tiles inside a ${v.border}-tile forest border`
      : `${v.width} × ${v.depth} tiles · no border: the player can walk to the edge of the map`;
  }
  const kind = segmented({
    options: [{ value: 'level', label: 'Outdoor level' }, { value: 'room', label: 'Room (interior)' }],
    value: v.kind, onChange: setKind, className: 'le-tabs le-new-kind',
  });
  setKind('level');
  return showDialog({
    title: 'New level', icon: ICONS.newFile, width: 520,
    content: [
      kind.el,
      row('Name', name.el),
      row('Size', h('div', null, h('div', { class: 'le-inline' }, w.el, h('span', { class: 'le-times' }, '×'), d.el), presets), `${MIN_SIZE}–${MAX_SIZE} tiles each way`),
      groundRow,
      levelRow,
      borderRow,
      wallRow,
      summary,
    ],
    buttons: [{ label: 'Cancel', value: null }, { label: 'Create', primary: true, onClick: () => { v.name = name.input.value.trim() || 'Untitled'; } }],
  }).result.then((r) => (r === 'Create' ? { ...v } : null));
}

const clampSize = (x) => Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(Number(x) || MIN_SIZE)));

// ---------------------------------------------------------------------------------------------
// Open
// ---------------------------------------------------------------------------------------------

/**
 * @returns {Promise<{ kind: 'project'|'local'|'file'|'recovered', name?: string, campaign?: string }|null>}
 *   project / local: the level's name / slot (project + campaign: a campaign's level); recovered:
 *   the recovered copy's id (autosave.js); file: pick one from disk (no name)
 */
export function openLevelDialog(app, { tab = null } = {}) {
  let current = tab ?? (app.projectApi ? 'project' : 'local');
  let choice = null;
  const list = h('div', { class: 'le-file-list le-scroll', role: 'listbox' });
  const tabs = segmented({
    options: [
      { value: 'project', label: 'Project folder', icon: ICONS.folder },
      { value: 'local', label: 'This browser', icon: ICONS.browser },
      { value: 'file', label: 'File on disk', icon: ICONS.file },
    ],
    value: current, onChange: (x) => { current = x; fill(); }, className: 'le-tabs',
  });
  let dlg = null;
  const pick = (c) => { choice = c; dlg?.close('open'); };

  /**
   * One list row: open on double-click / Enter / its Open button, select on click.
   * @param {{ title: string, sub: string, meta: string, onOpen: () => void,
   *   onDelete?: () => Promise<boolean>, active?: boolean }} row  onDelete resolves true when
   *   the entry was deleted (the list refills); active: the open document's own entry
   */
  const item = ({ title, sub, meta, onOpen, onDelete, active }) => {
    const del = onDelete ? h('button', {
      class: 'le-icon-btn is-danger', type: 'button', title: 'Delete…',
      onClick: async (e) => { e.stopPropagation(); if (await onDelete()) fill(); },
    }, icon(ICONS.trash)) : null;
    return h('div', {
      class: ['le-file-item', active && 'is-current'], role: 'option', tabIndex: 0,
      onDblclick: onOpen, onKeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onOpen(); } },
      onClick: (e) => { for (const x of list.querySelectorAll('.is-selected')) x.classList.remove('is-selected'); e.currentTarget.classList.add('is-selected'); selectedOpen = onOpen; setOpenEnabled(true); },
    },
    icon(ICONS.map, 'le-icon le-file-icon'),
    h('div', { class: 'le-file-main' }, h('div', { class: 'le-file-title' }, title), h('div', { class: 'le-file-sub' }, sub)),
    h('div', { class: 'le-file-meta' }, meta),
    h('button', { class: 'le-btn is-small', type: 'button', onClick: (e) => { e.stopPropagation(); onOpen(); } }, 'Open'),
    del);
  };
  let selectedOpen = null;
  /** The footer "Open" button acts on the highlighted row: disabled until one is picked. */
  const setOpenEnabled = (on) => {
    const b = dlg?.button('Open');
    if (!b) return;
    b.dataset.disabled = on ? '0' : '1';
    b.disabled = !on;
  };

  async function fill() {
    selectedOpen = null;
    setOpenEnabled(false);
    clear(list);
    if (current === 'project') {
      if (!app.projectApi) {
        list.appendChild(h('div', { class: 'le-empty' }, icon(ICONS.info), h('div', null, 'The project folder is only available while the dev server runs (', h('code', null, 'npm run dev'), '). Published levels can still be opened by name with ', h('code', null, 'editor.html?open=<name>'), '.')));
        return;
      }
      list.appendChild(h('div', { class: 'le-empty' }, 'Loading…'));
      let levels = [];
      let campaigns = [];
      try {
        levels = await listProjectLevels();
        // (an older dev server without the campaign API: no campaigns)
        campaigns = await listProjectCampaigns().catch(() => []);
      } catch (e) { clear(list).appendChild(h('div', { class: 'le-empty is-error' }, `Could not list levels: ${e.message}`)); return; }
      clear(list);
      if (!levels.length) list.appendChild(h('div', { class: 'le-empty' }, 'No levels in public/levels/ yet. Use File › Save As… to save one there.'));
      const ref = app.state.fileRef;
      /** One project level row (`campaign`: a campaign's own level). */
      const levelItem = (l, campaign = '') => item({
        title: l.title || l.name, sub: `public/${l.file}`, meta: [formatBytes(l.size), formatTime(l.modified)].join(' · '),
        active: ref.kind === 'project' && ref.name === l.name && (ref.campaign ?? '') === campaign,
        onOpen: () => pick(campaign ? { kind: 'project', name: l.name, campaign } : { kind: 'project', name: l.name }),
        onDelete: async () => {
          const ok = await confirmDialog({ title: 'Delete level file?', message: `Permanently delete public/${l.file} from the project folder? This cannot be undone.`, danger: true, buttons: [{ label: 'Cancel', value: false }, { label: 'Delete file', value: true, danger: true }] });
          if (!ok) return false;
          try { await deleteProjectLevel(l.name, { campaign }); app.state.notify(`Deleted public/${l.file}`); } catch (e) { app.state.notify(`Delete failed: ${e.message}`); }
          return true;
        },
      });
      for (const l of levels) list.appendChild(levelItem(l));
      // campaigns (docs/specs/CAMPAIGN_FORMAT.md): each one's own levels
      for (const c of campaigns) {
        list.appendChild(h('div', { class: 'le-file-group' }, `Campaign · ${c.title}`, h('span', { class: 'le-dim' }, ` — public/campaigns/${c.name}/levels/`)));
        if (!c.levels.length) list.appendChild(h('div', { class: 'le-empty' }, 'No levels yet.'));
        for (const l of c.levels) list.appendChild(levelItem(l, c.name));
      }
    } else if (current === 'local') {
      const levels = listLocalLevels();
      const recovered = listRecovered();
      if (recovered.length) {
        list.appendChild(h('div', { class: 'le-file-group' }, 'Recovered unsaved work', h('span', { class: 'le-dim' }, ' — from editor sessions that closed or were replaced before saving')));
        for (const e of recovered) {
          list.appendChild(item({
            title: e.name || 'Untitled',
            sub: `recovered copy${e.fileRef?.kind === 'project' ? ` of public/${projectLevelPath(e.fileRef.name, { campaign: e.fileRef.campaign })}` : e.fileRef?.kind === 'local' ? ` of browser slot “${e.fileRef.name}”` : e.fileRef?.kind === 'file' ? ` of ${e.fileRef.name}` : ''}${e.exported ? ' (was downloaded)' : ''}`,
            meta: [`${e.width ?? '?'}×${e.depth ?? '?'}`, formatBytes(recoveredSize(e.id)), formatTime(e.savedAt)].filter(Boolean).join(' · '),
            onOpen: () => pick({ kind: 'recovered', name: e.id }),
            onDelete: async () => {
              const ok = await confirmDialog({ title: 'Delete recovered copy?', message: `Delete the recovered copy of “${e.name || 'Untitled'}”? This cannot be undone.`, danger: true, buttons: [{ label: 'Cancel', value: false }, { label: 'Delete', value: true, danger: true }] });
              if (!ok) return false;
              deleteRecovered(e.id);
              return true;
            },
          }));
        }
        if (levels.length) list.appendChild(h('div', { class: 'le-file-group' }, 'Saved in this browser'));
      }
      if (!levels.length && !recovered.length) list.appendChild(h('div', { class: 'le-empty' }, 'No levels saved in this browser yet.'));
      for (const l of levels) {
        list.appendChild(item({
          title: l.name, sub: `browser slot “${l.slot}”`, meta: [`${l.width}×${l.depth}`, localSize(l.slot), formatTime(l.savedAt)].filter(Boolean).join(' · '),
          active: app.state.fileRef.kind === 'local' && app.state.fileRef.name === l.slot,
          onOpen: () => pick({ kind: 'local', name: l.slot }),
          onDelete: async () => {
            const ok = await confirmDialog({ title: 'Delete saved level?', message: `Delete “${l.name}” from this browser's storage? This cannot be undone.`, danger: true, buttons: [{ label: 'Cancel', value: false }, { label: 'Delete', value: true, danger: true }] });
            if (!ok) return false;
            deleteLocalLevel(l.slot);
            return true;
          },
        }));
      }
    } else {
      const drop = h('div', { class: 'le-dropzone' },
        icon(ICONS.upload, 'le-icon le-dropzone-icon'),
        h('div', { class: 'le-dropzone-title' }, 'Open a level file'),
        h('div', { class: 'le-dropzone-text' }, 'Choose a .json level exported from the editor, or drop it anywhere on the editor window.'),
        h('button', { class: 'le-btn is-primary', type: 'button', onClick: () => pick({ kind: 'file' }) }, icon(ICONS.open), 'Choose file…'));
      list.appendChild(drop);
    }
  }
  fill();
  dlg = showDialog({
    title: 'Open level', icon: ICONS.open, width: 680, className: 'is-open-dialog',
    content: [tabs.el, list],
    buttons: [{ label: 'Cancel', value: null }, { label: 'Open', primary: true, disabled: true, onClick: () => { if (selectedOpen) { selectedOpen(); } return false; } }],
  });
  return dlg.result.then(() => choice);
}

/** Stored size of a browser level (same key scheme as LevelStorage). */
function localSize(slot) {
  try {
    const text = localStorage.getItem(`luminati.level.${slot}`);
    return text ? formatBytes(text.length) : '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------------------------
// Save As
// ---------------------------------------------------------------------------------------------

/** "my-river-village" → "My River Village". */
const titleFromSlug = (s) => String(s).split(/[-_\s]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

/**
 * @param {EditorApp} app
 * @param {{ askName?: boolean }} [opts] askName: the level still has a default name ("Untitled"):
 *   also ask for its display name (prefilled from the file name)
 * @returns {Promise<{ name: string, dest: 'project'|'local'|'download', levelName?: string,
 *   campaign?: string }|null>} campaign: the project destination is that campaign's levels/ (a
 *   campaign level is saved beside its siblings)
 */
export function saveAsDialog(app, { askName = false } = {}) {
  const ref = app.state.fileRef;
  const L = app.state.level;
  /** A campaign level saves into its campaign's levels/ folder (docs/specs/CAMPAIGN_FORMAT.md). */
  const campaign = ref.kind === 'project' ? ref.campaign ?? '' : '';
  /** @type {{ name: string, dest: 'project'|'local'|'download', levelName?: string }} */
  const v = {
    name: ref.kind === 'project' || ref.kind === 'local' ? ref.name : slugify(L.name),
    dest: ref.kind === 'project' || ref.kind === 'local' ? ref.kind : app.projectApi ? 'project' : 'local',
  };
  if (ref.kind === 'file') v.dest = 'download';
  if (v.dest === 'project' && !app.projectApi) v.dest = 'local'; // the dev-server API is not running
  const target = h('div', { class: 'le-form-summary is-mono' });
  // the display name (title screen, banner): asked while the level is still "Untitled"
  let levelNameTouched = false;
  v.levelName = askName ? (ref.kind === 'new' && v.name === 'untitled' ? '' : titleFromSlug(v.name)) : L.name;
  const levelName = askName ? textControl({ value: v.levelName, placeholder: 'e.g. Riverside Village', maxLength: 80, onInput: (x) => { v.levelName = x; levelNameTouched = true; upd(); }, onChange: (x) => { v.levelName = x; levelNameTouched = true; upd(); } }) : null;
  const name = textControl({
    value: v.name, maxLength: 60,
    onInput: (x) => { v.name = x; if (levelName && !levelNameTouched) { v.levelName = titleFromSlug(slugify(x) === 'untitled' ? '' : x); levelName.set(v.levelName); } upd(); },
    onChange: (x) => { v.name = x; upd(); },
  });
  name.input.setAttribute('autofocus', '');
  const nameHint = h('div', { class: 'le-form-hint' });
  /**
   * The destination cards (`off`: the text of a disabled card).
   * @type {{ value: 'project'|'local'|'download', title: string, text: string, icon: string,
   *   disabled?: boolean, off?: string }[]}
   */
  const dests = [
    campaign
      ? { value: 'project', title: 'Campaign folder', text: `public/campaigns/${campaign}/levels/ — beside the campaign's other levels`, icon: ICONS.folder, disabled: !app.projectApi, off: 'Needs the dev server (npm run dev)' }
      : { value: 'project', title: 'Project folder', text: 'public/levels/ — ships with the game; playable at ?\u2060level=<name>', icon: ICONS.folder, disabled: !app.projectApi, off: 'Needs the dev server (npm run dev)' },
    { value: 'local', title: 'This browser', text: 'Browser storage — quick, private to this browser', icon: ICONS.browser },
    { value: 'download', title: 'Download file', text: 'A .level.json file you can share or keep in version control', icon: ICONS.download },
  ];
  const cards = h('div', { class: 'le-dest-cards', role: 'radiogroup' });
  const cardEls = new Map();
  for (const d of dests) {
    const c = h('button', {
      class: ['le-dest-card', d.disabled && 'is-disabled'], type: 'button', role: 'radio', disabled: !!d.disabled,
      onClick: () => { v.dest = d.value; upd(); },
    }, icon(d.icon, 'le-icon le-dest-icon'), h('div', { class: 'le-dest-title' }, d.title), h('div', { class: 'le-dest-text' }, d.disabled ? d.off : d.text));
    cardEls.set(d.value, c);
    cards.appendChild(c);
  }
  function upd() {
    for (const [k, c] of cardEls) { c.classList.toggle('is-active', k === v.dest); c.setAttribute('aria-checked', k === v.dest ? 'true' : 'false'); }
    const slug = slugify(v.name || v.levelName || L.name);
    target.textContent = v.dest === 'project' ? `→ public/${projectLevelPath(slug, { campaign })}` : v.dest === 'local' ? `→ browser slot “${slug}”` : `→ ${slug}.level.json (download)`;
    const display = (levelName ? v.levelName : L.name).trim() || 'Untitled';
    nameHint.textContent = slug !== slugify(display) ? `The game shows the level as “${display}”; the file is named “${slug}”.` : 'Letters, digits and dashes.';
  }
  upd();
  return showDialog({
    title: 'Save level as', icon: ICONS.saveAs, width: 600,
    content: [
      row('File name', h('div', null, name.el, nameHint)),
      levelName ? row('Level name', levelName.el, 'Shown on the title screen and in the banner; follows the file name until you edit it (Level settings can change it later).') : null,
      row('Save to', cards), target,
    ],
    buttons: [{ label: 'Cancel', value: null }, { label: 'Save', primary: true }],
  }).result.then((r) => {
    if (r !== 'Save') return null;
    const out = { name: slugify(name.input.value.trim() || v.name || v.levelName || L.name), dest: v.dest };
    if (campaign && out.dest === 'project') out.campaign = campaign;
    if (levelName) out.levelName = (levelName.input.value.trim() || titleFromSlug(out.name === 'untitled' ? 'Untitled' : out.name));
    return out;
  });
}

// ---------------------------------------------------------------------------------------------
// Level settings
// ---------------------------------------------------------------------------------------------

/** Edit name / texts / environment / camera / water. Applies one undoable edit. */
export function levelSettingsDialog(app) {
  const st = app.state;
  const L = st.level;
  const env = { ...DEFAULT_ENVIRONMENT, ...L.environment };
  const cam = env.camera && typeof env.camera === 'object' ? { ...env.camera } : null;
  const hg = env.highGround && typeof env.highGround === 'object' ? { ...env.highGround } : null;
  const v = {
    name: L.name, subtitle: L.subtitle, author: L.author, description: L.description,
    env: { ...env },
    camDistance: cam?.distance ?? null, camPitch: cam?.pitch ?? null,
    hgOn: !!hg, hgMinY: hg?.minY ?? 3, hgPitch: hg?.pitch ?? 40,
    waterLevel: L.waterLevel, flowX: L.water?.flow?.[0] ?? 0, flowZ: L.water?.flow?.[1] ?? 0.45, reflect: L.water?.reflect ?? 0.2, neutral: L.water?.neutral ?? 0.2,
    glint: Number.isFinite(L.water?.glint) ? L.water.glint : 1,
    // COMBAT.md §3 / §17: `environment.combat` absent = auto (on iff the level has an enemy group)
    combat: env.combat === true ? 'on' : env.combat === false ? 'off' : 'auto',
  };
  const enemyGroups = L.objects.filter((o) => o.type === 'enemy').length;
  const text = (k, opts = {}) => textControl({ value: v[k], onChange: (x) => { v[k] = x; }, onInput: (x) => { v[k] = x; }, ...opts }).el;
  const num = (get, setv, o = {}) => numberControl({ value: get(), slider: false, ...o, onChange: (x) => setv(x) }).el;
  const sw = (k) => boolControl({ value: !!v.env[k], onChange: (x) => { v.env[k] = x; } }).el;

  // ---- a room (`environment.interior`, LEVEL_FORMAT.md §9.2; absent = an outdoor level) and the
  // fields the room look sets: their controls are kept, so "Use the room look" shows what it changed
  const interior0 = env.interior === true;
  v.interior = interior0;
  const bk0 = backdropKind(env.backdrop);
  const bdColor0 = bk0 === 'color' ? String(env.backdrop).trim() : ROOM_BACKDROP;
  v.backdrop = bk0;
  v.backdropColor = bdColor0;
  const ctl = {
    clock: boolControl({ value: !!v.env.clock, onChange: (x) => { v.env.clock = x; updRoom(); } }),
    weather: selectControl({ value: v.env.weather, options: [{ value: 'clear', label: 'Clear' }, { value: 'rain', label: 'Rain' }, { value: 'snow', label: 'Snow' }], onChange: (x) => { v.env.weather = x; } }),
    border: selectControl({ value: v.env.border, options: [{ value: 'forest', label: 'Forest (trees on blocked grass)' }, { value: 'none', label: 'None' }], onChange: (x) => { v.env.border = x; updRoom(); } }),
    outerScenery: boolControl({ value: !!v.env.outerScenery, onChange: (x) => { v.env.outerScenery = x; updRoom(); } }),
    godRays: boolControl({ value: !!v.env.godRays, onChange: (x) => { v.env.godRays = x; updRoom(); } }),
    minimap: boolControl({ value: v.env.minimap !== false, onChange: (x) => { v.env.minimap = x; updRoom(); } }),
    backdrop: selectControl({
      value: bk0,
      options: [
        { value: 'sky', label: 'None (the sky)' },
        { value: 'void', label: 'Void (black)' },
        { value: 'color', label: 'Colour' },
        // (a value the game cannot read stays as it is until another choice is made)
        ...(bk0 === 'invalid' ? [{ value: 'invalid', label: `“${String(env.backdrop).slice(0, 24)}” (not a colour: the sky is shown)` }] : []),
      ],
      onChange: (x) => { v.backdrop = x; updRoom(); },
    }),
    backdropColor: colorControl({ value: bdColor0, onChange: (x) => { v.backdropColor = x; } }),
    interior: boolControl({ value: v.interior, label: 'This level is a room', onChange: (x) => { v.interior = x; roomSet = false; if (!x) undoRoomLook(); updRoom(); } }),
  };
  const camDist = numberControl({ value: v.camDistance, slider: false, nullable: true, step: 1, min: 12, max: 60, placeholder: 'auto (30)', onChange: (x) => { v.camDistance = x; updRoom(); } });
  const camPitch = numberControl({ value: v.camPitch, slider: false, nullable: true, step: 1, min: 10, max: 80, placeholder: 'auto (32°)', suffix: '°', onChange: (x) => { v.camPitch = x; updRoom(); } });
  const cameraAuto = () => v.camDistance == null && v.camPitch == null && !cam?.bounds;
  /** The environment as the dialog would write it (for the room-look test). */
  const shownEnv = () => ({ ...v.env, backdrop: v.backdrop === 'void' ? 'void' : v.backdrop === 'color' ? v.backdropColor : v.backdrop === 'invalid' ? env.backdrop : undefined });
  /** "Use the room look": the room fields of ROOM_LOOK (a backdrop the level has is kept), the closer camera while it is automatic. */
  /** The values the room look replaced (put back when Interior is switched off again in this dialog). */
  let beforeLook = null;
  /** Did the room look set the camera (it was automatic)? */
  let lookCamera = false;
  const LOOK_KEYS = /** @type {const} */ (['clock', 'border', 'outerScenery', 'godRays', 'minimap']);
  const undoRoomLook = () => {
    const b = beforeLook;
    beforeLook = null;
    if (!b) return;
    for (const k of LOOK_KEYS) {
      v.env[k] = b.env[k];
      // (an absent `minimap` is the default: shown)
      ctl[k].set(k === 'minimap' ? b.env[k] !== false : b.env[k]);
    }
    v.backdrop = b.backdrop;
    v.backdropColor = b.backdropColor;
    ctl.backdrop.set(b.backdrop);
    ctl.backdropColor.set(b.backdropColor);
    v.camDistance = b.camDistance;
    v.camPitch = b.camPitch;
    camDist.set(v.camDistance);
    camPitch.set(v.camPitch);
    lookCamera = false;
  };
  const useRoomLook = () => {
    beforeLook ??= {
      env: Object.fromEntries(LOOK_KEYS.map((k) => [k, v.env[k]])),
      backdrop: v.backdrop, backdropColor: v.backdropColor, camDistance: v.camDistance, camPitch: v.camPitch,
    };
    for (const k of LOOK_KEYS) {
      v.env[k] = ROOM_LOOK[k];
      ctl[k].set(ROOM_LOOK[k]);
    }
    if (v.backdrop !== 'void' && v.backdrop !== 'color') {
      v.backdrop = 'color';
      v.backdropColor = ROOM_BACKDROP;
      ctl.backdrop.set('color');
      ctl.backdropColor.set(ROOM_BACKDROP);
    }
    if (cameraAuto()) {
      v.camDistance = ROOM_CAMERA.distance;
      v.camPitch = ROOM_CAMERA.pitch;
      camDist.set(v.camDistance);
      camPitch.set(v.camPitch);
      lookCamera = true;
    }
    roomSet = true;
    updRoom();
    // (the button is gone: the focus back on the switch, not lost outside the dialog)
    ctl.interior.input.focus();
  };
  let roomSet = false;
  /** The room look's button (Enter presses it, not the dialog's Apply). */
  const roomLookButton = () => {
    const btn = h('button', { class: 'le-btn is-small le-room-look-btn', type: 'button', onClick: useRoomLook }, 'Use the room look');
    btn.dataset.keepsEnter = '1';
    return btn;
  };
  const roomOffer = h('div', { class: 'le-form-summary le-room-offer', role: 'status' });
  const roomNote = () => h('div', { class: 'le-form-hint le-room-note' }, 'Not shown in a room (kept for when the level is outdoors again; “Use the room look” sets the room’s own).');
  const ignoredRow = (label, control, hint = '') => {
    const r = row(label, control, hint);
    r.querySelector('.le-form-control').appendChild(roomNote());
    return r;
  };
  const ignoredRows = [
    ignoredRow('Weather', ctl.weather.el, 'The 3D preview shows its grey light and lanterns; the rain / snow, haze and snow cover with View › 3D: particles & god rays.'),
    ignoredRow('Map border', ctl.border.el),
    ignoredRow('Outer scenery', ctl.outerScenery.el, 'Fogged hills and trees around the map.'),
    ignoredRow('God rays', ctl.godRays.el),
  ];
  function updRoom() {
    for (const r of ignoredRows) r.classList.toggle('is-room-ignored', v.interior);
    ctl.backdropColor.el.hidden = v.backdrop !== 'color';
    const changes = v.interior ? roomLookChanges(shownEnv(), { cameraAuto: cameraAuto() }) : [];
    roomOffer.hidden = !v.interior || (!changes.length && !roomSet);
    if (roomOffer.hidden) return;
    if (!changes.length) {
      clear(roomOffer).append('The room look is set: no border, outer scenery or god rays, a backdrop instead of the sky, no minimap, the clock stopped',
        lookCamera ? ', a closer camera.' : '.', ' Apply saves it with the other settings, as one undo step.');
      return;
    }
    clear(roomOffer).append(
      h('div', null, `${interior0 ? 'Part of the room look is missing' : 'This level is set up for the outdoors'}. The room look sets ${changes.map((c) => c.label).join(', ')}.`),
      roomLookButton(),
    );
  }

  // the subtitle's text key, read-only (docs/specs/I18N.md §4.10; Apply keeps it, or gives a
  // changed subtitle a new one)
  const subtitleKeys = h('div', { class: 'le-text-keys is-form', dataset: { field: 'subtitle' } });
  fillKeyView(subtitleKeys, rootRows(L).filter((r) => r.field === 'subtitle'), {
    pages: false, open: true, onToggle: () => {},
    onCopy: (key) => { copyText(key).then((ok) => st.notify(ok ? `Copied the text key ${key}` : `Text key ${key} (the clipboard is not available: select it to copy)`)); },
  });
  const panes = {
    general: h('div', { class: 'le-form' },
      row('Name', text('name', { maxLength: 80 }), 'Shown on the title screen and in the banner.'),
      row('Subtitle', [text('subtitle', { placeholder: 'e.g. Riverside Village' }), subtitleKeys]),
      row('Author', text('author')),
      row('Description', textControl({ value: v.description, multiline: true, rows: 4, onChange: (x) => { v.description = x; }, onInput: (x) => { v.description = x; } }).el)),
    environment: h('div', { class: 'le-form' },
      row('Interior (room)', h('div', null, ctl.interior.el, roomOffer), 'A house’s floor, a cellar: inside, the game shows no forest border, outer scenery, god rays or weather (a campaign’s weather goes on outside), and a campaign keeps the level the player came from while they are in the room. The 3D preview shows it the same way.'),
      row('Start time', numberControl({ value: v.env.timeOfDay, min: 0, max: 24, step: 0.25, suffix: 'h', onChange: (x) => { v.env.timeOfDay = x ?? 12; } }).el, '17.2 = golden hour, 21+ = night. The 3D preview shows this hour (sun slider in the 3D view bar).'),
      row('Clock runs', ctl.clock.el, 'Time advances while playing. Off: the level keeps its start time (a room usually stops it).'),
      ...ignoredRows,
      row('Backdrop', h('div', { class: 'le-inline' }, ctl.backdrop.el, ctl.backdropColor.el), 'Instead of the sky: the background and the fog in one colour — for rooms, cellars and caves (Void = black). The 3D preview shows it.'),
      row('Dust motes', sw('dust')),
      row('Music', sw('music'), 'Start the music when the game starts.'),
      row('Minimap', ctl.minimap.el, 'The HUD minimap under the clock (N / Tab opens the world map either way); a room usually hides it.'),
      row('Combat', selectControl({
        value: v.combat,
        options: [
          { value: 'auto', label: `Auto (${enemyGroups ? 'on: the level has enemies' : 'off: no enemies placed'})` },
          { value: 'on', label: 'On' },
          { value: 'off', label: 'Off (peaceful)' },
        ],
        onChange: (x) => { v.combat = x; },
      }).el, 'Auto turns combat on when the level has an enemy group. On gives the player the sword, skills and draughts without enemies; Off keeps the level peaceful — enemies are not spawned, chests and waystones are only examined.')),
    camera: h('div', { class: 'le-form' },
      row('Distance', camDist.el, `Blank = the default diorama distance. A room looks closer (${ROOM_CAMERA.distance}).`),
      row('Pitch', camPitch.el),
      row('High ground', boolControl({ value: v.hgOn, label: 'Steeper camera on high ground', onChange: (x) => { v.hgOn = x; } }).el),
      row('…above height (world units)', num(() => v.hgMinY, (x) => { v.hgMinY = x ?? 3; }, { step: 0.5, min: 0, max: 20 }), 'World height (level × 0.5) where the tilt starts.'),
      row('…pitch', num(() => v.hgPitch, (x) => { v.hgPitch = x ?? 40; }, { step: 1, min: 10, max: 80, suffix: '°' })),
      cam?.bounds ? h('p', { class: 'le-hint' }, 'This level also defines custom camera focus bounds (kept as they are).') : null),
    water: h('div', { class: 'le-form' },
      row('Water level (world units)', num(() => v.waterLevel, (x) => { v.waterLevel = x ?? 0.4; }, { step: 0.05, min: -2, max: 12 }), 'World height of the water surface. Water tiles whose bed is above it get a shallow depth.'),
      row('Flow', h('div', { class: 'le-inline' }, num(() => v.flowX, (x) => { v.flowX = x ?? 0; }, { step: 0.05 }), h('span', { class: 'le-times' }, 'x · z'), num(() => v.flowZ, (x) => { v.flowZ = x ?? 0; }, { step: 0.05 })), 'Default ripple drift (x, z); tiles can override the speed.'),
      row('Reflection', num(() => v.reflect, (x) => { v.reflect = x ?? 0.2; }, { step: 0.05, min: 0, max: 1 })),
      row('Neutral tint', num(() => v.neutral, (x) => { v.neutral = x ?? 0.2; }, { step: 0.05, min: 0, max: 1 })),
      row('Glints', num(() => v.glint, (x) => { v.glint = x ?? 1; }, { step: 0.05, min: 0, max: 2 }), 'Density of the sun and moon sparkles (1 = default; a big, calm lake reads better with fewer).')),
  };
  const body = h('div', { class: 'le-settings-body' });
  const show = (k) => { clear(body).appendChild(panes[k]); };
  const tabs = segmented({
    options: [{ value: 'general', label: 'General' }, { value: 'environment', label: 'Environment' }, { value: 'camera', label: 'Camera' }, { value: 'water', label: 'Water' }],
    value: 'general', onChange: show, className: 'le-tabs',
  });
  show('general');
  updRoom();
  return showDialog({
    title: 'Level settings', icon: ICONS.settings, width: 620, subtitle: `${L.width} × ${L.depth} tiles${interior0 ? ' · a room' : ''}`,
    content: [tabs.el, body],
    buttons: [{ label: 'Cancel', value: null }, { label: 'Apply', primary: true }],
  }).result.then((r) => {
    if (r !== 'Apply') return false;
    const camera = v.camDistance == null && v.camPitch == null && !cam?.bounds ? null
      : { ...(cam ?? {}), distance: v.camDistance ?? undefined, pitch: v.camPitch ?? undefined };
    if (camera) { if (camera.distance == null) delete camera.distance; if (camera.pitch == null) delete camera.pitch; }
    // `minimap` is optional (absent = on): don't write the default into files that never had it
    const environment = { ...v.env, camera, highGround: v.hgOn ? { minY: v.hgMinY, pitch: v.hgPitch } : null };
    if (environment.minimap === true && L.environment?.minimap !== true) {
      // (set back to the default: removed again — an undefined key is dropped when serialised)
      if ('minimap' in (L.environment ?? {})) environment.minimap = undefined;
      else delete environment.minimap;
    }
    // `combat` is optional too: written only for On / Off; back to Auto removes it (an undefined
    // key is dropped when the level is serialised — setLevelProps merges the environment)
    if (v.combat === 'auto') {
      if ('combat' in (L.environment ?? {})) environment.combat = undefined;
      else delete environment.combat;
    } else environment.combat = v.combat === 'on';
    // `interior` is optional (absent = an outdoor level): written as `true` when switched on,
    // removed when switched off; untouched, the file's own value (or its absence) stays
    if (v.interior !== interior0) environment.interior = v.interior ? true : undefined;
    // `backdrop` likewise (absent = the sky): written only when changed — a file's own spelling
    // (upper-case hex, a value the game cannot read) stays while the choice is left alone
    if (v.backdrop !== bk0 || (v.backdrop === 'color' && v.backdropColor !== bdColor0)) {
      if (v.backdrop === 'void') environment.backdrop = 'void';
      else if (v.backdrop === 'color') environment.backdrop = v.backdropColor;
      else if ('backdrop' in (L.environment ?? {})) environment.backdrop = undefined;
      else delete environment.backdrop;
    }
    // water: the file's other keys are kept, in their order; `glint` is only written when set
    const water = { ...(L.water ?? {}), flow: [v.flowX, v.flowZ], reflect: v.reflect, neutral: v.neutral };
    // (set back to 1 — the default — it goes again; a file's own `glint: 1` stays)
    if (v.glint !== 1 || L.water?.glint === 1) water.glint = v.glint;
    else delete water.glint;
    st.setLevelProps({
      name: v.name.trim() || 'Untitled', subtitle: v.subtitle, author: v.author, description: v.description,
      environment,
      waterLevel: v.waterLevel,
      water,
    }, 'Level settings');
    st.notify('Level settings updated');
    return true;
  });
}

// ---------------------------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------------------------

/** @type {ResizeAnchor[]} in grid order */
const ANCHORS = ['nw', 'n', 'ne', 'w', 'c', 'e', 'sw', 's', 'se'];

/** Resize with a 3×3 anchor; applies one undoable edit. */
export function resizeDialog(app) {
  const st = app.state;
  const L = st.level;
  /** @type {{ width: number, depth: number, anchor: ResizeAnchor, fill: string }} */
  const v = { width: L.width, depth: L.depth, anchor: 'c', fill: 'g' };
  const w = numberControl({ value: v.width, min: MIN_SIZE, max: MAX_SIZE, step: 1, int: true, slider: false, onChange: (x) => { v.width = clampSize(x); upd(); } });
  const d = numberControl({ value: v.depth, min: MIN_SIZE, max: MAX_SIZE, step: 1, int: true, slider: false, onChange: (x) => { v.depth = clampSize(x); upd(); } });
  const grid = h('div', { class: 'le-anchor-grid', role: 'radiogroup', 'aria-label': 'Anchor' });
  const cells = new Map();
  for (const a of ANCHORS) {
    const b = h('button', { class: 'le-anchor-cell', type: 'button', title: `Keep content anchored ${a === 'c' ? 'in the centre' : `to the ${a.toUpperCase()}`}`, onClick: () => { v.anchor = a; upd(); } });
    cells.set(a, b);
    grid.appendChild(b);
  }
  const fill = selectControl({ value: v.fill, options: groundTiles(), onChange: (x) => { v.fill = x; } });
  const summary = h('div', { class: 'le-form-summary' });
  function upd() {
    // arrows point away from the anchor (the directions the map grows / shrinks)
    const ai = ANCHORS.indexOf(v.anchor);
    const ax = ai % 3;
    const az = Math.floor(ai / 3);
    ANCHORS.forEach((a, k) => {
      const x = k % 3;
      const z = Math.floor(k / 3);
      const b = cells.get(a);
      b.classList.toggle('is-active', a === v.anchor);
      const dx = x - ax;
      const dz = z - az;
      b.textContent = a === v.anchor ? '■' : Math.abs(dx) <= 1 && Math.abs(dz) <= 1 ? arrowFor(dx, dz) : '';
    });
    const dw = v.width - L.width;
    const dd = v.depth - L.depth;
    const fmtD = (n, what) => (n === 0 ? `same ${what}` : `${n > 0 ? '+' : '−'}${Math.abs(n)} ${what}`);
    const lost = (dw < 0 || dd < 0) ? ' — tiles outside the new edges are removed (objects are kept)' : '';
    summary.textContent = `${L.width} × ${L.depth} → ${v.width} × ${v.depth}  (${fmtD(dw, 'columns')}, ${fmtD(dd, 'rows')})${lost}`;
  }
  upd();
  return showDialog({
    title: 'Resize level', icon: ICONS.resize, width: 520,
    content: [
      row('New size', h('div', { class: 'le-inline' }, w.el, h('span', { class: 'le-times' }, '×'), d.el), `${MIN_SIZE}–${MAX_SIZE} tiles`),
      row('Anchor', h('div', { class: 'le-inline' }, grid, h('div', { class: 'le-form-hint' }, 'The content stays attached to this side; new tiles appear on the others.'))),
      row('New tiles', fill.el),
      summary,
    ],
    buttons: [{ label: 'Cancel', value: null }, { label: 'Resize', primary: true }],
  }).result.then((r) => {
    if (r !== 'Resize') return false;
    if (v.width === L.width && v.depth === L.depth) return false;
    const next = resizeLevel(st.level, v.width, v.depth, { anchor: v.anchor, fill: v.fill });
    st.setLevel(next, 'Resize level');
    st.notify(`Resized to ${v.width} × ${v.depth}`);
    return true;
  });
}

function arrowFor(dx, dz) {
  const k = `${dx},${dz}`;
  return { '-1,-1': '↖', '0,-1': '↑', '1,-1': '↗', '-1,0': '←', '1,0': '→', '-1,1': '↙', '0,1': '↓', '1,1': '↘' }[k] ?? '';
}

// ---------------------------------------------------------------------------------------------
// Story preview
// ---------------------------------------------------------------------------------------------

/**
 * View › Story preview… (KNOWN_ISSUES CMP-06): the story values to preview, one per line, and the
 * on / off switch. Changes apply at once (view state: never saved with the level).
 * @param {EditorApp} app
 */
export function storyPreviewDialog(app) {
  const st = app.state;
  // the views follow the typing after a short pause: a changed hidden set re-batches the 3D
  // view's chunks it touches, which a big level must not pay at every keystroke
  let timer = 0;
  const apply = (t) => {
    clearTimeout(timer);
    timer = 0;
    st.setView({ storyValues: t });
    upd();
  };
  const values = textControl({
    value: st.view.storyValues ?? '', multiline: true, rows: 9, mono: true,
    placeholder: 'bridge-mended\ndeliveries = 3\nitem:plank = 2\nquest:find-ilse = active\nstage:find-ilse = cross-ford\nhour = 20\nchapter = lanterns-home',
    onChange: (t) => apply(t),
    onInput: (t) => { clearTimeout(timer); timer = setTimeout(() => apply(t), STORY_INPUT_DELAY); },
  });
  values.input.setAttribute('spellcheck', 'false');
  values.input.classList.add('le-story-values');
  const on = boolControl({ value: !!st.view.storyPreview, label: 'Preview on', onChange: (x) => { st.setView({ storyPreview: x }); upd(); } });
  const issues = h('ul', { class: 'le-dialog-list is-errors le-story-issues', hidden: true });
  const summary = h('div', { class: 'le-form-summary le-story-summary' });
  function upd() {
    const { errors } = parseStoryValues(values.input.value);
    clear(issues);
    issues.hidden = !errors.length;
    for (const e of errors) issues.appendChild(h('li', null, `line ${e.line}: ${e.msg}`));
    const n = storyConditionCount(st.level);
    const hidden = storyHiddenIds(st).size;
    summary.textContent = !n
      ? 'No object of this level has a story condition (Story: only when / gone when).'
      : st.view.storyPreview
        ? `${n} object${n === 1 ? ' has' : 's have'} a story condition · ${hidden} hidden now`
        : `${n} object${n === 1 ? ' has' : 's have'} a story condition · the preview is off: all are shown`;
  }
  upd();
  return showDialog({
    title: 'Story preview', icon: ICONS.eye, width: 560, className: 'is-story-preview',
    subtitle: 'Not saved with the level',
    content: [
      h('p', { class: 'le-dialog-text' }, 'While the preview is on, objects whose “Story: only when” / “Story: gone when” do not allow them with these values are hidden in the 2D map and the 3D view (and cannot be picked).'),
      h('div', { class: 'le-story-toggle' }, on.el),
      values.el,
      issues,
      h('div', { class: 'le-form-hint' }, 'One value per line: a flag name alone is set; name = number (a variable, item:<id>, visits:<actor>, visited:<level>, done:<key>); quest:<id> = none | active | done | failed; stage:<quest> = <stage>; hour, day, gold, chapter, level, weather = value (hour: the 3D preview\'s hour when not given). # starts a comment.'),
      summary,
    ],
    buttons: [{ label: 'Done', primary: true }],
  }).result.then((r) => {
    // (values typed just before the dialog closed still apply)
    if (timer) apply(values.input.value);
    return r;
  });
}

/** Story preview: ms after the last keystroke in its values before the views follow. */
const STORY_INPUT_DELAY = 200;

// ---------------------------------------------------------------------------------------------
// Find by text key
// ---------------------------------------------------------------------------------------------

/**
 * Edit › Find by text key… (docs/specs/I18N.md §4.10): asks for a text key — a GUID from a
 * translation table, a review note or the inspector (any case; braces and hyphens are fine), a
 * script line's `#line:` tag, a banner subtitle's `<GUID>.2` — and, when the level holds it,
 * closes and shows the text (`EditorApp#showTextKey`: the object selected, the line or page
 * selected in its field). A key the level does not hold keeps the dialog open and says so (and
 * which other file of the campaign holds it). Resolves whether a text was shown.
 * @param {EditorApp} app
 * @returns {Promise<boolean>}
 */
export function findTextKeyDialog(app) {
  const input = textControl({ value: '', onChange: () => {}, placeholder: '9F2A1B3C4D5E6F708192A3B4C5D6E7F8  or  #line:9F2A…' });
  input.input.classList.add('le-hex');
  input.input.setAttribute('autocomplete', 'off');
  input.input.setAttribute('aria-label', 'Text key');
  const intro = 'Every text a player reads has a text key that names it in the translation tables (the inspector shows it under the field). Paste one, or a script line’s #line: tag.';
  const msg = h('div', { class: 'le-form-hint le-find-key-msg' }, intro);
  input.input.addEventListener('input', () => { msg.textContent = intro; msg.classList.remove('is-error'); });
  /** @type {ReturnType<EditorApp['locateTextKey']>|null} */
  let hit = null;
  return showDialog({
    title: 'Find by text key', icon: ICONS.search, width: 540, className: 'is-find-key',
    content: [h('div', { class: 'le-form' }, row('Text key', input.el)), msg],
    buttons: [
      { label: 'Cancel', value: null },
      {
        label: 'Find', primary: true,
        onClick: () => {
          const r = app.locateTextKey(input.input.value);
          if (!r.found) {
            msg.textContent = r.message;
            msg.classList.add('is-error');
            input.input.focus();
            return false;
          }
          hit = r;
          return true;
        },
      },
    ],
  }).result.then((v) => {
    if (v !== 'Find' || !hit) return false;
    app.showTextKey(hit);
    return true;
  });
}

// ---------------------------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------------------------

/** @param {{ title: string, items: [string, string][] }[]} groups  items: [keys ("A / B"), label] */
export function shortcutsDialog(groups) {
  const keys = (k) => h('span', { class: 'le-sc-keys' }, k.split(' / ').map((x, i) => [i ? h('span', { class: 'le-dim' }, '/') : null, h('kbd', { class: 'le-kbd' }, shortcutLabel(x))]));
  const content = h('div', { class: 'le-shortcuts' }, groups.map((g) => h('section', { class: 'le-shortcut-group' },
    h('h3', null, g.title),
    g.items.map(([k, label]) => h('div', { class: 'le-sc-row' }, h('span', { class: 'le-sc-label' }, label), keys(k))))));
  return showDialog({ title: 'Keyboard shortcuts', icon: ICONS.keyboard, width: 860, content, buttons: [{ label: 'Close', primary: true }] }).result;
}

// ---------------------------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------------------------

/**
 * Offer to restore the autosaved working copy.
 * @returns {Promise<boolean|null>} true = restore, false = discard, null = dismissed (keep it)
 */
export function restoreDialog(meta, { older = 0, reopened = false } = {}) {
  const when = formatTime(meta.savedAt);
  return confirmDialog({
    title: 'Restore unsaved work?', icon: ICONS.info, width: 460,
    message: h('div', null,
      h('p', { class: 'le-dialog-text' }, reopened
        ? 'This level has unsaved changes from an earlier editor session. Restore them?'
        : 'The editor closed with unsaved changes. A working copy was autosaved:'),
      h('div', { class: 'le-restore-card' }, icon(ICONS.map, 'le-icon le-file-icon'), h('div', null, h('div', { class: 'le-file-title' }, meta.name || 'Untitled'), h('div', { class: 'le-file-sub' }, `${meta.width ?? '?'} × ${meta.depth ?? '?'} · autosaved ${when}`))),
      h('p', { class: 'le-dialog-text le-dim' }, `Close this prompt to decide later: the copy is kept in File › Open › This browser.${older ? ` ${older} older recovered cop${older === 1 ? 'y is' : 'ies are'} there too.` : ''}`)),
    buttons: [{ label: 'Discard', value: false }, { label: 'Restore', value: true, primary: true }],
  });
}

/** validateLevel wording → what the editor calls things (the UI says "player start"). */
export function friendlyProblem(msg) {
  const m = String(msg);
  if (m === 'spawn is not on walkable ground') return 'The player start is on water, void or blocked ground. Move it onto walkable ground or a bridge.';
  if (m === 'spawn is outside the map') return 'The player start is outside the map. Move it back onto the level.';
  if (/^tiles row count|^heights row count|row \d+ has length/.test(m)) return `The map data is damaged (${m}). Resize the level or re-open the file.`;
  return m.charAt(0).toUpperCase() + m.slice(1);
}

/** Play-test blocked by validation errors. */
export function problemsDialog(title, errors, { fixSpawn = null } = {}) {
  return showDialog({
    title, icon: ICONS.warning, width: 500,
    content: [h('p', { class: 'le-dialog-text' }, 'The level cannot be played until these problems are fixed:'), h('ul', { class: 'le-dialog-list is-errors' }, errors.map((e) => h('li', null, e)))],
    buttons: [fixSpawn ? { label: 'Select player start', left: true, onClick: fixSpawn } : null, { label: 'OK', primary: true }].filter(Boolean),
  }).result;
}

/** About box. */
export function aboutDialog() {
  return showDialog({
    title: 'Luminati Level Editor', icon: ICONS.help, width: 480,
    content: h('div', { class: 'le-about' },
      h('div', { class: 'le-about-logo' }, 'Luminati'),
      h('p', { class: 'le-dialog-text' }, 'A visual map editor for the Luminati 2.5D pixel-art engine: paint terrain, sculpt heights, place houses, trees, lights, props and villagers, then play-test the level in the real game.'),
      h('p', { class: 'le-dialog-text le-dim' }, 'Levels are plain JSON (luminati-level v1). Save them to public/levels/ to ship them with the game, or keep them in the browser / as files.')),
    buttons: [{ label: 'Close', primary: true }],
  }).result;
}
