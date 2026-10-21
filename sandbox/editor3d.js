/**
 * Sandbox for the level editor's 3D viewport (src/editor/viewport3d/Viewport3D.js).
 *
 * Mounts a full-window Viewport3D on an EditorState holding either the real Emberfall level
 * (public/levels/emberfall.json, `?level=emberfall`, when it exists) or a generated 64×64 test
 * valley with ~200 objects, and registers tiny local tools following the §7 tool interface
 * (select / move, paint, height, place, erase, player start) so pointer forwarding, previews and
 * incremental rebuilds can be exercised without the editor shell. `?realtools` uses
 * src/editor/tools/index.js instead when it exists.
 *
 * `window.__vp` exposes the viewport, state, tools and helpers for scripted checks:
 *   sandbox/editor3d.actions.json         tour of every feature on the generated 64×64 level
 *   sandbox/editor3d.real.actions.json    Emberfall + the real tools (`?level=emberfall&realtools`)
 *   sandbox/editor3d.audit.actions.json   robustness: brush re-drape, lost pointerup, tool switch
 *                                         mid-stroke, sky clicks / drags, leaks, lights when hidden
 *   sandbox/editor3d.tilemap.actions.json TileMap.rebuildRect vs. fresh builds (`?level=emberfall`)
 *   sandbox/editor3d.app.actions.json     the viewport inside editor.html (`--page=editor.html
 *                                         --query=open=emberfall`)
 */
import { TextureLibrary } from '../src/engine/pixel/Textures.js';
import { EditorState } from '../src/editor/EditorState.js';
import { createEmptyLevel, getHeightLevel } from '../src/engine/level/LevelFormat.js';
import { OBJECT_TYPES, createObject } from '../src/engine/level/ObjectCatalog.js';
import { loadProjectLevel } from '../src/engine/level/LevelStorage.js';
import { Viewport3D } from '../src/editor/viewport3d/Viewport3D.js';
import { generateTestLevel } from './editor3d.level.js';

/**
 * @import { Tool } from '../src/editor/tools/index.js'
 * @import * as ToolRegistry from '../src/editor/tools/index.js'
 */

const q = new URLSearchParams(location.search);
const hud = document.getElementById('hud');

// ---------------------------------------------------------------------------------------------
// Local test tools (docs/contracts/LEVEL_EDITOR.md §7)
// ---------------------------------------------------------------------------------------------

const snap = (v, step = 0.5) => Math.round(v / step) * step;
const brushCells = (st, ev) => {
  const n = st.toolOptions.brushSize ?? 1;
  const r = Math.floor((n - 1) / 2);
  const cells = [];
  for (let dj = -r; dj <= n - 1 - r; dj++) for (let di = -r; di <= n - 1 - r; di++) cells.push({ i: ev.i + di, j: ev.j + dj });
  return cells.filter((c) => st.inBounds(c.i, c.j));
};

const selectTool = {
  id: 'select', label: 'Select', shortcut: 'V', icon: '', help: 'Click to select, drag to move', cursor: 'default',
  _drag: null,
  pointerDown(ev, st) {
    const id = ev.hitSpawn ? 'spawn' : ev.hitObjectId;
    if (!id) { st.clearSelection(); return; }
    if (!st.selection.includes(id)) st.select([id], { additive: ev.shift });
    st.begin('Move');
    this._drag = { x: ev.x, z: ev.z, dx: 0, dz: 0 };
  },
  pointerMove(ev, st) {
    const d = this._drag;
    if (!d || ev.button !== 0) return;
    const dx = ev.alt ? ev.x - d.x : snap(ev.x - d.x);
    const dz = ev.alt ? ev.z - d.z : snap(ev.z - d.z);
    if (dx !== d.dx || dz !== d.dz) {
      st.moveObjects(st.selection, dx - d.dx, dz - d.dz);
      d.dx = dx;
      d.dz = dz;
    }
  },
  pointerUp(ev, st) {
    if (this._drag) st.commit();
    this._drag = null;
  },
  preview() { return null; },
};

const paintTool = {
  id: 'paint', label: 'Paint', shortcut: 'B', icon: '', help: 'Paint tiles', cursor: 'crosshair',
  _on: false,
  pointerDown(ev, st) { this._on = true; st.begin('Paint'); this._paint(ev, st); },
  pointerMove(ev, st) { if (this._on) this._paint(ev, st); st.emit('preview'); },
  pointerUp(ev, st) { if (this._on) st.commit(); this._on = false; },
  _paint(ev, st) { st.editTiles(brushCells(st, ev).map((c) => ({ ...c, tile: st.toolOptions.tile })), 'Paint'); },
  preview(st) {
    const h = st.hover;
    if (!h) return null;
    return { cells: brushCells(st, h), cellColor: '#8fe3ff', label: `${st.toolOptions.tile} ×${st.toolOptions.brushSize}` };
  },
};

const heightTool = {
  id: 'height', label: 'Height', shortcut: 'H', icon: '', help: 'Raise / lower terrain', cursor: 'cell',
  _done: null,
  pointerDown(ev, st) { this._done = new Set(); st.begin('Height'); this._apply(ev, st); },
  pointerMove(ev, st) { if (this._done) this._apply(ev, st); st.emit('preview'); },
  pointerUp(ev, st) { if (this._done) st.commit(); this._done = null; },
  _apply(ev, st) {
    const dir = (st.toolOptions.heightMode === 'lower') !== ev.shift ? -1 : 1;
    const cells = brushCells(st, ev).filter((c) => !this._done.has(`${c.i},${c.j}`));
    for (const c of cells) this._done.add(`${c.i},${c.j}`);
    st.editTiles(cells.map((c) => ({ ...c, height: Math.max(0, getHeightLevel(st.level, c.i, c.j) + dir) })), 'Height');
  },
  preview(st) {
    const h = st.hover;
    if (!h) return null;
    return { cells: brushCells(st, h), cellColor: st.toolOptions.heightMode === 'lower' ? '#ff9a6b' : '#9dff8f', label: st.toolOptions.heightMode === 'lower' ? 'Lower' : 'Raise' };
  },
};

const placeTool = {
  id: 'place', label: 'Place', shortcut: 'O', icon: '', help: 'Place objects', cursor: 'copy',
  _line: null,
  _rect: null,
  _ghost(st) {
    const h = st.hover;
    if (!h) return null;
    const type = st.toolOptions.objectType;
    const def = OBJECT_TYPES[type];
    const x = def.placement === 'point' && def.snap ? snap(h.x, def.snap) : snap(h.x);
    const z = def.placement === 'point' && def.snap ? snap(h.z, def.snap) : snap(h.z);
    const o = createObject(type, x, z, def.rotatable ? { rotation: st.toolOptions.rotation ?? 0 } : {});
    if (def.placement === 'line' && this._line) Object.assign(o, { x0: this._line.x, z0: this._line.z, x1: x, z1: z });
    return o;
  },
  pointerDown(ev, st) {
    const type = st.toolOptions.objectType;
    const def = OBJECT_TYPES[type];
    const x = snap(ev.x);
    const z = snap(ev.z);
    if (def.placement === 'line') {
      if (!this._line) { this._line = { x, z }; st.emit('preview'); return; }
      st.addObject(type, this._line.x, this._line.z, { x1: x, z1: z });
      this._line = null;
      return;
    }
    if (def.placement === 'rect') { this._rect = { x, z, x1: x, z1: z }; return; }
    const g = this._ghost(st);
    st.addObject(type, g.x, g.z, def.rotatable ? { rotation: g.rotation } : {});
  },
  pointerMove(ev, st) {
    if (this._rect) { this._rect.x1 = snap(ev.x); this._rect.z1 = snap(ev.z); }
    st.emit('preview');
  },
  pointerUp(ev, st) {
    const r = this._rect;
    if (!r) return;
    this._rect = null;
    if (Math.abs(r.x1 - r.x) < 0.5 || Math.abs(r.z1 - r.z) < 0.5) return;
    st.addObject(st.toolOptions.objectType, 0, 0, { minX: Math.min(r.x, r.x1), maxX: Math.max(r.x, r.x1), minZ: Math.min(r.z, r.z1), maxZ: Math.max(r.z, r.z1) });
  },
  preview(st) {
    const def = OBJECT_TYPES[st.toolOptions.objectType];
    if (this._rect) return { rect: { minX: this._rect.x, maxX: this._rect.x1, minZ: this._rect.z, maxZ: this._rect.z1 }, label: `${Math.abs(this._rect.x1 - this._rect.x)} × ${Math.abs(this._rect.z1 - this._rect.z)}` };
    const g = this._ghost(st);
    if (!g) return null;
    const p = { ghost: g, label: def.label };
    if (def.placement === 'line' && this._line) p.line = { x0: g.x0, z0: g.z0, x1: g.x1, z1: g.z1 };
    if (def.placement === 'rect') return { cells: [{ i: st.hover.i, j: st.hover.j }], cellColor: '#ffd36b', label: 'Drag a rectangle' };
    return p;
  },
};

const eraseTool = {
  id: 'erase', label: 'Erase', shortcut: 'X', icon: '', help: 'Click objects to delete them', cursor: 'pointer',
  pointerDown(ev, st) { if (ev.hitObjectId) st.removeObjects([ev.hitObjectId]); },
  pointerMove(ev, st) { st.emit('preview'); },
  pointerUp() {},
  preview() { return null; },
};

const spawnTool = {
  id: 'spawn', label: 'Player start', shortcut: 'P', icon: '', help: 'Click to move the player start', cursor: 'crosshair',
  pointerDown(ev, st) { st.setSpawn(snap(ev.x) + 0.0, snap(ev.z)); },
  pointerMove(ev, st) { st.emit('preview'); },
  pointerUp() {},
  preview(st) { return st.hover ? { cells: [{ i: st.hover.i, j: st.hover.j }], cellColor: '#7fe3ff', label: 'Player start' } : null; },
};

// The literals' `cursor` strings widen to string, so the map is cast to the §7 Tool it holds.
const LOCAL_TOOLS = /** @type {Record<string, Tool>} */ (Object.fromEntries([selectTool, paintTool, heightTool, placeTool, eraseTool, spawnTool].map((t) => [t.id, t])));

// ---------------------------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------------------------

async function loadLevel() {
  const name = q.get('level');
  if (name) {
    try {
      const { level } = await loadProjectLevel(name);
      return level;
    } catch (err) {
      console.info(`[editor3d] level "${name}" unavailable (${err.message}); using the generated test level`);
    }
  }
  if (q.has('empty')) return createEmptyLevel({ name: 'Empty', width: 32, depth: 24 });
  const size = Number(q.get('size')) || 64;
  return generateTestLevel({ width: size, depth: size });
}

const textures = new TextureLibrary({ seed: 1337 });
const level = await loadLevel();
const state = new EditorState(level);
state.setView({ timeOfDay: Number(q.get('time')) || 14 });
if (q.has('postfx')) state.setView({ postfx: true });
if (q.has('atmosphere')) state.setView({ atmosphere: true });

/** @type {typeof ToolRegistry|null} */
let realTools = null;
if (q.has('realtools')) {
  const mods = import.meta.glob('../src/editor/tools/index.js');
  const load = mods['../src/editor/tools/index.js'];
  if (load) realTools = /** @type {typeof ToolRegistry} */ (await load());
  else console.info('[editor3d] src/editor/tools/index.js does not exist yet; using local tools');
}
const getTool = (id) => (realTools ? realTools.getTool(id) : LOCAL_TOOLS[id] ?? null);

const t0 = performance.now();
const vp = new Viewport3D(document.getElementById('viewport'), state, { textures, getTool: realTools ? null : getTool });
await vp.ready;
const readyMs = Math.round(performance.now() - t0);

// ---------------------------------------------------------------------------------------------
// Scripted-test helpers
// ---------------------------------------------------------------------------------------------

const canvas = vp.canvas;
let pid = 10;
/**
 * Dispatch a synthetic mouse PointerEvent on the viewport canvas.
 * @param {string} type  'pointerdown' / 'pointermove' / 'pointerup' …
 * @param {number} x  client x (CSS px)
 * @param {number} y  client y (CSS px)
 * @param {{ button?: number, buttons?: number, shift?: boolean, alt?: boolean, ctrl?: boolean,
 *   id?: number }} [opts]  `id`: pointerId (default: the current stroke's id)
 */
function fire(type, x, y, { button = 0, buttons = 1, shift = false, alt = false, ctrl = false, id } = {}) {
  canvas.dispatchEvent(new PointerEvent(type, {
    clientX: x, clientY: y, button, buttons, shiftKey: shift, altKey: alt, ctrlKey: ctrl,
    pointerId: id ?? pid, pointerType: 'mouse', isPrimary: true, bubbles: true, cancelable: true,
  }));
}

/**
 * Screen position of a world point (CSS px).
 * @param {number} x @param {number} y @param {number} z
 * @returns {{ x: number, y: number }}
 */
function toScreen(x, y, z) {
  const v = vp.camera.position.clone().set(x, y, z).project(vp.camera);
  const r = canvas.getBoundingClientRect();
  return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
}

/**
 * Screen position of the ground at world (x, z).
 * @param {number} x @param {number} z
 */
function groundScreen(x, z) {
  return toScreen(x, vp.surface.surfaceAt(x, z), z);
}

/** @param {number} ms @returns {Promise<void>} */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** Wait `n` animation frames. @param {number} [n] @returns {Promise<void>} */
const frames = (n = 2) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });

/**
 * Drag with the left button through world points [[x, z], …] (synthetic pointer events).
 * @param {[number, number][]} points
 * @param {{ stepMs?: number, mods?: Parameters<typeof fire>[3] }} [opts]  `stepMs` between moves,
 *   `mods` added to every event
 */
async function strokeWorld(points, { stepMs = 16, mods = {} } = {}) {
  pid++;
  const p0 = groundScreen(points[0][0], points[0][1]);
  fire('pointermove', p0.x, p0.y, { buttons: 0, button: -1, ...mods });
  fire('pointerdown', p0.x, p0.y, mods);
  const times = [];
  for (let k = 1; k < points.length; k++) {
    const p = groundScreen(points[k][0], points[k][1]);
    const t = performance.now();
    fire('pointermove', p.x, p.y, { button: -1, ...mods });
    times.push(performance.now() - t);
    await wait(stepMs);
  }
  const pl = groundScreen(points[points.length - 1][0], points[points.length - 1][1]);
  fire('pointerup', pl.x, pl.y, { buttons: 0, ...mods });
  await frames(3);
  return { moves: points.length - 1, maxMoveMs: +Math.max(0, ...times).toFixed(1) };
}

/**
 * Click (left) at a world ground point; returns the selection afterwards.
 * @param {number} x @param {number} z
 * @param {Parameters<typeof fire>[3]} [mods]
 */
async function clickWorld(x, z, mods = {}) {
  pid++;
  const p = groundScreen(x, z);
  fire('pointermove', p.x, p.y, { buttons: 0, button: -1, ...mods });
  fire('pointerdown', p.x, p.y, mods);
  fire('pointerup', p.x, p.y, { buttons: 0, ...mods });
  await frames(3);
  return state.selection.slice();
}

/** Hover a world ground point; returns `state.hover`. @param {number} x @param {number} z */
async function hoverWorld(x, z) {
  const p = groundScreen(x, z);
  fire('pointermove', p.x, p.y, { buttons: 0, button: -1 });
  await frames(2);
  return state.hover;
}

/**
 * Measure how long a terrain edit takes to show up in the 3D view (edit → rebuilt meshes).
 * @param {number} i @param {number} j  the brush's first cell
 * @param {{ size?: number, raise?: number }} [opts]  square brush size, height levels to add
 */
async function brushLatency(i, j, { size = 3, raise = 1 } = {}) {
  const v0 = vp.terrain.version;
  const t = performance.now();
  state.begin('Latency test');
  const cells = [];
  for (let dj = 0; dj < size; dj++) for (let di = 0; di < size; di++) cells.push({ i: i + di, j: j + dj, height: Math.max(0, getHeightLevel(state.level, i + di, j + dj) + raise) });
  state.editTiles(cells, 'Height');
  while (vp.terrain.version === v0 && performance.now() - t < 2000) await new Promise((r) => requestAnimationFrame(r));
  const ms = performance.now() - t;
  state.commit();
  await frames(2);
  return { ms: +ms.toFixed(1), rebuildMs: vp.stats.terrainMs, water: vp.stats.waterMs, chunks: vp.terrain.stats.chunks, kind: vp.terrain.stats.kind };
}

/**
 * Set the camera (degrees) and wait for it to settle.
 * @param {{ x?: number, z?: number, distance?: number, pitch?: number, yaw?: number,
 *   instant?: boolean }} [opts]  a missing x / z keeps the current focus; `instant` snaps
 */
async function view({ x, z, distance, pitch, yaw, instant = true } = {}) {
  const f = vp.cam.focusTarget;
  vp.cam.lookAt(x ?? f.x, vp.surface.surfaceAt(x ?? f.x, z ?? f.z), z ?? f.z, { distance, pitch, yaw });
  if (instant) vp.cam.snap();
  await frames(3);
  return { x: vp.cam.focus.x, z: vp.cam.focus.z, distance: vp.cam.distance };
}

function info() {
  return {
    readyMs,
    stats: { ...vp.stats },
    terrain: { ...vp.terrain.stats },
    objects: state.level.objects.length,
    props: vp.props.count,
    actors: vp.actors.entries.size,
    lights: vp.props.lightPool.used,
    lightHandles: vp.lighting._pointLights?.length,
    selection: state.selection.slice(),
    tool: state.toolId,
    programs: vp.renderer.info.programs?.length,
    geometries: vp.renderer.info.memory.geometries,
    textures: vp.renderer.info.memory.textures,
  };
}

/**
 * `window.__vp` (AUTOMATION_API.md §7), read by sandbox/editor3d*.actions.json.
 * @typedef {object} VpHandle
 * @property {Viewport3D} vp
 * @property {EditorState} state
 * @property {TextureLibrary} textures
 * @property {typeof LOCAL_TOOLS} tools  the page's local tools by id
 * @property {boolean} realTools  `?realtools`: the viewport uses src/editor/tools/index.js
 * @property {typeof realTools} toolsModule  that module, or null
 * @property {typeof fire} fire
 * @property {typeof toScreen} toScreen
 * @property {typeof groundScreen} groundScreen
 * @property {typeof strokeWorld} strokeWorld
 * @property {typeof clickWorld} clickWorld
 * @property {typeof hoverWorld} hoverWorld
 * @property {typeof brushLatency} brushLatency
 * @property {typeof view} view
 * @property {typeof info} info  readyMs, viewport / terrain stats, counts, selection, tool …
 * @property {typeof frames} frames
 * @property {typeof wait} wait
 */
window.__vp = {
  vp, state, textures, tools: LOCAL_TOOLS, realTools: !!realTools, toolsModule: realTools,
  fire, toScreen, groundScreen, strokeWorld, clickWorld, hoverWorld, brushLatency, view, info, frames, wait,
};

// ---------------------------------------------------------------------------------------------
// HUD + keyboard shortcuts for manual testing
// ---------------------------------------------------------------------------------------------

const TOOL_KEYS = { KeyV: 'select', KeyB: 'paint', KeyH: 'height', KeyO: 'place', KeyX: 'erase', KeyP: 'spawn' };
window.addEventListener('keydown', (e) => {
  if (e.defaultPrevented) return;
  // the local tools have no keyDown; the real ones (`?realtools`) may
  const tool = /** @type {Tool|null} */ (getTool(state.toolId));
  if (tool?.keyDown?.(e, state)) { e.preventDefault(); return; }
  if (e.ctrlKey && e.code === 'KeyZ') { state.undo(); return; }
  if (e.ctrlKey && e.code === 'KeyY') { state.redo(); return; }
  if (e.code === 'Delete') { state.removeObjects(state.selection.filter((id) => id !== 'spawn')); return; }
  if (e.code === 'KeyG') state.setView({ cameraMode: state.view.cameraMode === 'game' ? 'edit' : 'game' });
  else if (e.code === 'KeyN') state.setView({ postfx: !state.view.postfx });
  else if (e.code === 'KeyM') state.setView({ atmosphere: !state.view.atmosphere });
  else if (e.code === 'KeyT') state.setView({ timeOfDay: (state.view.timeOfDay + 3) % 24 });
  else if (e.code === 'Home') vp.frameLevel();
  else if (TOOL_KEYS[e.code] && !e.ctrlKey) state.setTool(TOOL_KEYS[e.code]);
});

setInterval(() => {
  const s = vp.stats;
  hud.textContent = `${state.level.name} ${state.level.width}×${state.level.depth} · ${s.objects} objects · tool ${state.toolId}\n`
    + `fps ${s.fps} · cpu ${s.cpuMs} ms · calls ${s.drawCalls} · tris ${(s.triangles / 1000).toFixed(0)}k · terrain ${s.terrainMs} ms · water ${s.waterMs} ms · lights ${s.lights}/${s.lightDescriptors}\n`
    + `V select · B paint · H height · O place · X erase · P start · G game cam · N postfx · M atmosphere · T time · RMB orbit · MMB pan · wheel zoom · F focus`;
}, 250);
