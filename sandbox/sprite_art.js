/**
 * Sandbox: sprite art gallery for CharacterSprites.js / PropSprites.js.
 *
 * Query params:
 *   ?mode=gallery (default)  3D preview strip + every preset sheet + live walk previews + creatures + props
 *   ?mode=focus&names=a,b&z=6  big zoomed sheets for art review
 *   ?mode=props&z=6          prop sprites only (zoomed)
 *   ?mode=creatures&z=6      creature sheets only (zoomed)
 *   ?mode=hashes             FNV-1a hash of every existing sheet (baseline: sprite_art.hashes.json)
 *   ?mode=combat             combat art (COMBAT.md §10): enemy sheets, player combat sheet, FX atlas,
 *                            flash / glow sprites under PostFX bloom, hash + value-contrast checks
 *                            (&focus=<player|slime|…|golem|atlas>&z=N: one sheet, zoomed)
 *   ?t=1.25                  freeze animation time (seconds) for stable screenshots
 */
import * as THREE from 'three';
import { createCharacterSheet, createCreatureSheet, CHARACTER_PRESETS, COMBAT_POSE_NAMES } from '../src/engine/pixel/CharacterSprites.js';
import { createPropSprite, PROP_SPRITE_KINDS } from '../src/engine/pixel/PropSprites.js';
import { createEnemySheet, ENEMY_SHEET_KINDS } from '../src/engine/pixel/MonsterSprites.js';
import { createFxAtlas, FX_FRAMES } from '../src/engine/pixel/FxSprites.js';
import { TextureLibrary } from '../src/engine/pixel/Textures.js';
import { Sprite3D } from '../src/engine/sprite/Sprite3D.js';
import { PostFX } from '../src/engine/render/PostFX.js';
import { DIRECTIONS } from '../src/engine/constants.js';

/** @typedef {[number, number, number, number]} Rgba */

const params = new URLSearchParams(location.search);
const mode = params.get('mode') || 'gallery';
const Z = Number(params.get('z') || 0);
const frozenT = params.has('t') ? Number(params.get('t')) : null;
const app = document.getElementById('app');
/** three.js preview handle (gallery mode only). */
let three = null;

const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'style') e.style.cssText = v; else if (k === 'class') e.className = v; else e.setAttribute(k, v);
  }
  for (const k of kids) e.append(k);
  return e;
};

/** Live animation previews: each draws one animation of a sheet into its own canvas. */
const previews = [];
function addPreview(parent, sheet, anim, zoom, caption) {
  const a = sheet.animations[anim];
  const cv = el('canvas', { width: sheet.frameWidth * zoom, height: sheet.frameHeight * zoom });
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  previews.push({ ctx, sheet, a, zoom, cv });
  parent.append(el('div', { class: 'prev' }, cv, el('span', {}, caption ?? anim)));
  return cv;
}

function stripPreview(parent, sprite, zoom, caption) {
  // animated horizontal strip (props)
  const cv = el('canvas', { width: sprite.width * zoom, height: sprite.height * zoom });
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  previews.push({ ctx, strip: sprite, zoom, cv });
  parent.append(el('div', { class: 'prev' }, cv, el('span', {}, caption)));
}

function drawPreviews(t) {
  for (const p of previews) {
    const { ctx, zoom, cv } = p;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (p.atlas) {
      // FX atlas animation: frame rects are UVs with flipY (v1 = top edge)
      const s = p.atlas;
      const f = s.frames > 1 ? Math.floor(t * s.fps) % s.frames : 0;
      const [u0, , , v1] = s.atlasRects[f];
      ctx.drawImage(s.canvas, Math.round(u0 * 512), Math.round((1 - v1) * 512), s.width, s.height, 0, 0, s.width * zoom, s.height * zoom);
    } else if (p.strip) {
      const s = p.strip;
      const n = s.frames || 1;
      const fw = s.width;
      const f = n > 1 ? Math.floor(t * (s.fps || 8)) % n : 0;
      ctx.drawImage(s.canvas, f * fw, 0, fw, s.height, 0, 0, fw * zoom, s.height * zoom);
    } else {
      const { sheet, a } = p;
      const f = a.frames[Math.floor(t * a.fps) % a.frames.length];
      ctx.drawImage(sheet.canvas, f.col * sheet.frameWidth, f.row * sheet.frameHeight, sheet.frameWidth, sheet.frameHeight,
        0, 0, sheet.frameWidth * zoom, sheet.frameHeight * zoom);
    }
  }
}

function sheetCanvas(sheet, zoom) {
  const cv = el('canvas', { class: 'sheet', width: sheet.canvas.width * zoom, height: sheet.canvas.height * zoom });
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet.canvas, 0, 0, cv.width, cv.height);
  // faint frame grid
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  for (let x = 0; x <= sheet.columns; x++) { ctx.beginPath(); ctx.moveTo(x * sheet.frameWidth * zoom + 0.5, 0); ctx.lineTo(x * sheet.frameWidth * zoom + 0.5, cv.height); ctx.stroke(); }
  for (let y = 0; y <= sheet.rows; y++) { ctx.beginPath(); ctx.moveTo(0, y * sheet.frameHeight * zoom + 0.5); ctx.lineTo(cv.width, y * sheet.frameHeight * zoom + 0.5); ctx.stroke(); }
  return cv;
}

// ---------------------------------------------------------------------------
// Build content
// ---------------------------------------------------------------------------

const t0 = performance.now();
const presetNames = Object.keys(CHARACTER_PRESETS);
const sheets = {};
for (const name of presetNames) sheets[name] = createCharacterSheet({ preset: name });
/** @type {Parameters<typeof createCreatureSheet>[0][]} */
const creatureKinds = ['cat', 'dog', 'chicken', 'bird'];
const creatures = {};
for (const k of creatureKinds) creatures[k] = createCreatureSheet(k);
const props = {};
for (const k of PROP_SPRITE_KINDS) props[k] = createPropSprite(k, { seed: 7 });
/** Spec overrides recombining parts across presets, plus seeded random NPCs. */
const CUSTOM_SPECS = {
  'villager + long red hair, circlet, blue cape': { preset: 'villager', hairStyle: 'long', hair: 'hairRed', hat: 'circlet', outfit: { top: 'purple', bottom: 'black' }, cape: 'blue', female: true, blush: true },
  'guard, no helmet, sword, red cape': { preset: 'guard', hat: 'none', hairStyle: 'spiky', hair: 'hairBlonde', weapon: 'sword', cape: { color: 'red', style: 'cape' } },
  'traveler recoloured (hex)': { preset: 'traveler', skin: 'skinDark', hair: 'hairWhite', hairStyle: 'ponytail', outfit: { top: '#c9643c' }, cape: { color: '#3f5f88', style: 'cloak', lining: '#1d2a4d' } },
  'cleric, white hood, bun': { preset: 'cleric', hairStyle: 'bun', hair: 'hairBlack', hat: 'hood', hatColor: 'white', beard: false },
  'farmer + beard + bow': { preset: 'farmer', beard: 'full', weapon: 'bow', hat: 'cap', hatColor: 'green' },
  'villager, seed 101 (jitter)': { preset: 'villager', seed: 101 },
  'innkeeper, seed 7 (jitter)': { preset: 'innkeeper', seed: 7 },
};
for (let i = 1; i <= 7; i++) CUSTOM_SPECS[`random NPC seed ${i}`] = { randomize: true, seed: i * 7919 };
const custom = {};
for (const [k, spec] of Object.entries(CUSTOM_SPECS)) custom[k] = createCharacterSheet(spec);
const buildMs = performance.now() - t0;
console.log(`sprite_art: built ${presetNames.length} characters, ${creatureKinds.length} creatures, ${PROP_SPRITE_KINDS.length} props in ${buildMs.toFixed(1)} ms`);

// ---------------------------------------------------------------------------
// Canvas hashes of every existing sheet (COMBAT.md §10: the combat art must leave them pixel-identical)
// ---------------------------------------------------------------------------

/** RGBA pixels of a canvas, read back once per canvas (repeated getImageData calls warn in Chrome). */
const _pixelCache = new WeakMap();
function pixelsOf(canvas) {
  let d = _pixelCache.get(canvas);
  if (!d) { d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; _pixelCache.set(canvas, d); }
  return d;
}

/** FNV-1a (32 bit) over a canvas's size and RGBA pixels → 8 hex digits. */
function canvasHash(canvas) {
  const d = pixelsOf(canvas);
  let h = 0x811c9dc5;
  const step = (b) => { h ^= b; h = Math.imul(h, 0x01000193); };
  for (const v of [canvas.width, canvas.height]) { step(v & 255); step(v >>> 8); }
  for (let i = 0; i < d.length; i++) step(d[i]);
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Hash every sheet that existed before the combat art: all CHARACTER_PRESETS, seeded random villagers
 * 1–8, the gallery's spec overrides, every creature kind and every prop sprite (default seed and seed 7).
 * `sandbox/sprite_art.hashes.json` is this output taken on the code before the combat edits.
 */
/** @returns {Record<string, string>} sheet name → FNV-1a hash (8 hex digits) */
function existingSheetHashes() {
  const out = {};
  for (const name of presetNames) out[`preset:${name}`] = canvasHash(sheets[name].canvas);
  for (let i = 1; i <= 8; i++) {
    const s = createCharacterSheet({ randomize: true, seed: i });
    out[`random:${i}`] = canvasHash(s.canvas);
    s.dispose();
  }
  for (const [k, s] of Object.entries(custom)) out[`custom:${k}`] = canvasHash(s.canvas);
  for (const k of creatureKinds) out[`creature:${k}`] = canvasHash(creatures[k].canvas);
  for (const k of PROP_SPRITE_KINDS) {
    const a = createPropSprite(k);
    out[`prop:${k}`] = canvasHash(a.canvas);
    a.dispose();
    out[`prop:${k}:seed7`] = canvasHash(props[k].canvas);
  }
  return out;
}

function characterCard(name, sheet, sheetZoom, prevZoom) {
  const card = el('div', { class: 'card' });
  card.append(el('div', { class: 'label' }, name, ' ', el('small', {}, `${sheet.canvas.width}×${sheet.canvas.height}`)));
  card.append(sheetCanvas(sheet, sheetZoom));
  const row = el('div', { class: 'row' });
  for (const d of DIRECTIONS) addPreview(row, sheet, `walk_${d}`, prevZoom, `walk ${d}`);
  addPreview(row, sheet, 'idle_down', prevZoom, 'idle');
  card.append(row);
  return card;
}

if (mode === 'gallery') {
  app.append(el('h2', {}, 'In the diorama (three.js, gameplay camera)'));
  const threeHost = el('div', { id: 'three' });
  app.append(threeHost);
  setupThree(threeHost);

  app.append(el('h2', {}, 'Characters'));
  const grid = el('div', { class: 'grid' });
  for (const name of presetNames) grid.append(characterCard(name, sheets[name], 2, 3));
  app.append(grid);

  app.append(el('h2', {}, 'Spec overrides & seeded NPCs'));
  const og = el('div', { class: 'grid' });
  for (const [k, sheet] of Object.entries(custom)) {
    const card = el('div', { class: 'card' });
    card.append(el('div', { class: 'label' }, el('small', {}, k)));
    const row = el('div', { class: 'row' });
    for (const d of DIRECTIONS) addPreview(row, sheet, `walk_${d}`, 3, d);
    card.append(row);
    og.append(card);
  }
  app.append(og);

  app.append(el('h2', {}, 'Creatures'));
  const cg = el('div', { class: 'grid' });
  for (const k of creatureKinds) cg.append(characterCard(k, creatures[k], 3, 4));
  app.append(cg);

  app.append(el('h2', {}, 'Prop sprites'));
  const pg = el('div', { class: 'grid props' });
  for (const k of PROP_SPRITE_KINDS) {
    const card = el('div', { class: 'card' });
    const s = props[k];
    const z = s.height > 24 ? 4 : 5;
    stripPreview(card, s, z, `${k}${s.frames ? ` (${s.frames}f)` : ''}`);
    pg.append(card);
  }
  app.append(pg);
} else if (mode === 'focus') {
  const names = (params.get('names') || 'traveler').split(',');
  const z = Z || 5;
  const grid = el('div', { class: 'grid focus' });
  for (const n of names) {
    const sheet = sheets[n] || creatures[n] || createCharacterSheet({ preset: n });
    const card = el('div', { class: 'card' });
    card.append(el('div', { class: 'label' }, n));
    card.append(sheetCanvas(sheet, z));
    grid.append(card);
  }
  app.append(grid);
} else if (mode === 'frames') {
  // selected frames at a big zoom: ?mode=frames&names=a,b&cols=0,2,3&rows=0,1,3&z=8
  const names = (params.get('names') || 'traveler').split(',');
  const cols = (params.get('cols') || '0,2,3,4,5').split(',').map(Number);
  const rowsSel = (params.get('rows') || '0,1,3').split(',').map(Number);
  const z = Z || 8;
  const wrap = el('div', { class: 'grid focus' });
  for (const n of names) {
    const sheet = sheets[n] || creatures[n];
    const card = el('div', { class: 'card' });
    card.append(el('div', { class: 'label' }, n));
    for (const r of rowsSel) {
      const row = el('div', { class: 'row' });
      for (const c of cols) {
        const cv = el('canvas', { class: 'sheet', width: sheet.frameWidth * z, height: sheet.frameHeight * z });
        const ctx = cv.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sheet.canvas, c * sheet.frameWidth, r * sheet.frameHeight, sheet.frameWidth, sheet.frameHeight, 0, 0, cv.width, cv.height);
        row.append(cv);
      }
      card.append(row);
    }
    wrap.append(card);
  }
  app.append(wrap);
} else if (mode === 'walk') {
  // every preset: walk frames for one direction side by side (for comparing proportions)
  const dir = params.get('dir') || 'down';
  const z = Z || 4;
  const grid = el('div', { class: 'grid focus' });
  for (const n of presetNames) {
    const card = el('div', { class: 'card' });
    card.append(el('div', { class: 'label' }, n));
    const row = el('div', { class: 'row' });
    addPreview(row, sheets[n], `walk_${dir}`, z, dir);
    card.append(row);
    grid.append(card);
  }
  app.append(grid);
} else if (mode === 'creatures') {
  const z = Z || 6;
  const grid = el('div', { class: 'grid focus' });
  for (const k of creatureKinds) {
    const card = el('div', { class: 'card' });
    card.append(el('div', { class: 'label' }, k));
    card.append(sheetCanvas(creatures[k], z));
    const row = el('div', { class: 'row' });
    for (const d of DIRECTIONS) addPreview(row, creatures[k], `walk_${d}`, z, `walk ${d}`);
    card.append(row);
    grid.append(card);
  }
  app.append(grid);
} else if (mode === 'hashes') {
  // ?mode=hashes — FNV-1a of every existing sheet (the committed baseline is sprite_art.hashes.json)
  const hashes = existingSheetHashes();
  window.__spriteHashes = hashes;
  app.append(el('h2', {}, `Existing-sheet hashes (${Object.keys(hashes).length})`));
  app.append(el('pre', { id: 'hashes', style: 'font: 12px/1.3 monospace; white-space: pre-wrap;' }, JSON.stringify(hashes, null, 2)));
} else if (mode === 'combat') {
  // ?mode=combat — combat sheets (COMBAT.md §10): every enemy sheet × pose × direction, the player
  // combat sheet, the FX atlas, flash / glow sprites under PostFX bloom, hash / contrast checks.
  // ?focus=<player|goblin|…|atlas>&z=N shows one sheet only, zoomed, for art review.
  await buildCombatView();
} else if (mode === 'props') {
  const z = Z || 6;
  const grid = el('div', { class: 'grid props' });
  for (const k of PROP_SPRITE_KINDS) {
    const s = props[k];
    const card = el('div', { class: 'card' });
    const cv = el('canvas', { class: 'sheet', width: s.sheetWidth * z, height: s.height * z });
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(s.canvas, 0, 0, cv.width, cv.height);
    card.append(cv, el('span', {}, `${k} ${s.width}×${s.height}${s.frames ? ` · ${s.frames}f @${s.fps}` : ''}`));
    grid.append(card);
  }
  app.append(grid);
}

// ---------------------------------------------------------------------------
// three.js preview: sprites standing in a tiny diorama with the gameplay camera
// ---------------------------------------------------------------------------

function setupThree(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2a3440');
  scene.fog = new THREE.FogExp2('#2a3440', 0.018);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.5, 400);
  const pitch = 32 * Math.PI / 180, dist = 24;
  const focus = new THREE.Vector3(0, 1, 0);
  camera.position.set(focus.x, focus.y + Math.sin(pitch) * dist, focus.z + Math.cos(pitch) * dist);
  camera.lookAt(focus);

  // golden-hour key light + cool sky fill
  scene.add(new THREE.HemisphereLight('#9fb8e8', '#5a4030', 1.15));
  const sun = new THREE.DirectionalLight('#ffc88a', 2.8);
  sun.position.set(-9, 8, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 9, bottom: -9 });
  scene.add(sun);

  // simple pixel ground
  const gcv = document.createElement('canvas');
  gcv.width = gcv.height = 16;
  const gx = gcv.getContext('2d');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const n = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
    const v = Math.abs(n);
    gx.fillStyle = v > 0.8 ? '#77a345' : v > 0.4 ? '#4a7d3a' : '#446f36';
    gx.fillRect(x, y, 1, 1);
  }
  const gtex = new THREE.CanvasTexture(gcv);
  gtex.magFilter = THREE.NearestFilter;
  gtex.wrapS = gtex.wrapT = THREE.RepeatWrapping;
  gtex.repeat.set(36, 14);
  gtex.colorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(36, 14), new THREE.MeshLambertMaterial({ map: gtex }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const actors = [];
  /** Minimal local stand-in for Sprite3D: a lit, shadow-casting quad animated via texture offset. */
  const place = (sheet, x, z, anim, { y = 0, emissive = false } = {}) => {
    const tex = sheet.texture.clone();
    tex.repeat.set(1 / sheet.columns, 1 / sheet.rows);
    const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
    if (emissive) { mat.emissive = new THREE.Color('#ffffff'); mat.emissiveMap = tex; mat.emissiveIntensity = 1.2; }
    const w = sheet.frameWidth / sheet.pixelsPerUnit, h = sheet.frameHeight / sheet.pixelsPerUnit;
    const geo = new THREE.PlaneGeometry(w, h);
    geo.translate(0, h / 2, 0);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = !emissive;
    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ map: tex, alphaTest: 0.5, depthPacking: THREE.RGBADepthPacking });
    mesh.position.set(x, y, z);
    scene.add(mesh);
    actors.push({ mesh, tex, sheet, anim });
    return mesh;
  };
  /** Wrap a PropSprite result as a one-row sheet. */
  const propSheet = (s) => ({
    texture: s.texture, columns: s.columns, rows: 1, frameWidth: s.width, frameHeight: s.height, pixelsPerUnit: s.pixelsPerUnit,
    animations: { play: { frames: Array.from({ length: s.columns }, (_, i) => ({ col: i, row: 0 })), fps: s.fps || 1, loop: true } },
  });
  // characters gathered around a campfire
  presetNames.forEach((n, i) => {
    const a = (i / presetNames.length) * Math.PI * 2 + 0.42;
    const r = i % 2 ? 3.2 : 4.6;
    const x = Math.cos(a) * r * 1.5, z = Math.sin(a) * r * 0.55;
    const dir = Math.abs(Math.cos(a)) > 0.6 ? (Math.cos(a) > 0 ? 'left' : 'right') : (Math.sin(a) > 0 ? 'up' : 'down');
    place(sheets[n], x, z, `${i % 3 === 0 ? 'idle' : 'walk'}_${dir}`);
  });
  creatureKinds.forEach((k, i) => place(creatures[k], -7 + i * 4.5, 3.6 - (i % 2) * 0.6, `walk_${DIRECTIONS[(i + 1) % 4]}`));
  if (props.campfire) {
    place(propSheet(props.campfire), 0, 0, 'play', { emissive: true });
    const pl = new THREE.PointLight('#ffb46b', 14, 9, 2);
    pl.position.set(0, 1.1, 0.3);
    scene.add(pl);
  }
  // scattered foliage billboards (seeded layout)
  const foliage = ['grass_tuft', 'grass_tuft', 'grass_tuft', 'grass_tall', 'flower_red', 'flower_yellow', 'flower_white', 'flower_blue', 'bush', 'fern', 'reeds', 'mushroom', 'rock_small'];
  let sd = 12345;
  const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const k = foliage[i % foliage.length];
    if (!props[k]) continue;
    const x = (rnd() * 2 - 1) * 15, z = (rnd() * 2 - 1) * 5.6;
    if (Math.abs(x) < 8 && Math.abs(z) < 3.4) continue; // keep the gathering clear
    place(propSheet(props[k]), x, z, 'play');
  }
  // interaction icons
  if (props.speech_bubble) place(propSheet(props.speech_bubble), Math.cos(0.2) * 6.9, Math.sin(0.2) * 2.53 + 0.01, 'play', { y: 2.05, emissive: true });
  if (props.exclamation) place(propSheet(props.exclamation), -6.9, -0.6, 'play', { y: 2.1, emissive: true });

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = `${w}px`;
    renderer.domElement.style.height = `${h}px`;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);
  three = {
    renderer, scene, camera, actors,
    update(t) {
      for (const a of actors) {
        const an = a.sheet.animations[a.anim];
        const f = an.frames[Math.floor(t * an.fps) % an.frames.length];
        a.tex.offset.set(f.col / a.sheet.columns, 1 - (f.row + 1) / a.sheet.rows);
      }
      renderer.render(scene, camera);
    },
  };
}

// ---------------------------------------------------------------------------
// Combat view (?mode=combat): COMBAT.md §10 art review and checks
// ---------------------------------------------------------------------------

/** sRGB relative luminance of an [r, g, b] (0–255) colour. @param {number[]} rgb */
function relLuminance([r, g, b]) {
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contrast ratio (L1 + 0.05) / (L2 + 0.05) with L1 the lighter. */
function contrastRatio(a, b) {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * The value a sheet reads as against the ground: its opaque texels minus the outline, sorted by
 * luminance; the "mid-tones" are the 40th–60th percentile band, whose average colour is returned
 * (a robust median that ignores rim lights, eye whites and deep shadows).
 */
function midToneAverage(canvas) {
  const d = pixelsOf(canvas);
  const px = [];
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    if (d[i] === 20 && d[i + 1] === 15 && d[i + 2] === 23) continue; // PALETTE.outline
    px.push([d[i], d[i + 1], d[i + 2]]);
  }
  px.sort((a, b) => relLuminance(a) - relLuminance(b));
  const lo = Math.floor(px.length * 0.4), hi = Math.max(lo + 1, Math.ceil(px.length * 0.6));
  const avg = [0, 0, 0];
  for (let i = lo; i < hi; i++) for (let k = 0; k < 3; k++) avg[k] += px[i][k] / (hi - lo);
  return avg;
}

/** Average colour of the `g` (grass) and `G` (grass_dark) tile top textures. */
function grassAverage() {
  const lib = new TextureLibrary();
  const sum = [0, 0, 0];
  for (const name of ['grass', 'grass_dark']) {
    const pc = lib.pixels(name).color;
    const s = [0, 0, 0];
    for (let i = 0; i < pc.data.length; i += 4) for (let k = 0; k < 3; k++) s[k] += pc.data[i + k];
    for (let k = 0; k < 3; k++) sum[k] += s[k] / (pc.data.length / 4) / 2;
  }
  return sum;
}

/** Count texels by alpha class: opaque (255), glow (204), other partial alpha. */
function alphaCensus(canvas) {
  const d = pixelsOf(canvas);
  const out = { opaque: 0, glow: 0, other: 0 };
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] === 255) out.opaque++;
    else if (d[i] === 204) out.glow++;
    else if (d[i] !== 0) out.other++;
  }
  return out;
}

/**
 * Frames whose 1 px border is not transparent (the combat columns keep a transparent margin,
 * SPR-04; the bottom row may hold the outline under the feet).
 */
function marginViolations(sheet, firstCol = 0) {
  const { canvas, frameWidth: fw, frameHeight: fh } = sheet;
  const d = pixelsOf(canvas);
  const W = canvas.width;
  const bad = [];
  for (let r = 0; r < sheet.rows; r++) {
    for (let c = firstCol; c < sheet.columns; c++) {
      let n = 0;
      for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++) {
          if (!(x === 0 || x === fw - 1 || y === 0)) continue;
          if (d[((r * fh + y) * W + c * fw + x) * 4 + 3]) n++;
        }
      }
      if (n) bad.push(`r${r}c${c}:${n}`);
    }
  }
  return bad;
}

/** Big zoomed sheet with the pose name of every column above it. */
function labelledSheet(sheet, zoom, names) {
  const wrap = el('div', {});
  const head = el('div', { style: `display:grid;grid-template-columns:repeat(${sheet.columns}, ${sheet.frameWidth * zoom}px);font-size:10px;color:var(--ink-dim)` });
  for (let c = 0; c < sheet.columns; c++) head.append(el('span', { style: 'overflow:hidden;white-space:nowrap' }, `${c} ${names[c] ?? ''}`));
  wrap.append(head, sheetCanvas(sheet, zoom));
  return wrap;
}

/** Column → pose names (aliases joined) of a sheet with a `poses` map. */
function columnNames(sheet) {
  const names = [];
  for (const [n, c] of Object.entries(sheet.poses)) names[c] = names[c] ? `${names[c]}/${n}` : n;
  return names;
}

/**
 * `window.__spriteCombat` (?mode=combat; sprite_art.combat.json): exposed first, then filled while
 * the view builds (the optional members) and by `verify()` (glowProbe, fail).
 * @typedef {object} SpriteCombatReport
 * @property {string[]|null} hashDiffs  existing sheets whose hash differs from the baseline
 * @property {number} [hashCount]  baseline sheets
 * @property {Record<string, { midTone: number[], L: number, grassL: number, ratio: number }>} contrast
 *   value contrast of slime / goblin / bat against the grass
 * @property {number} paintMs  cold paint of the 8 enemy sheets + the player combat sheet
 * @property {number} [paintMsWarm]  the same, warm
 * @property {number} [atlasMs]  FX atlas paint
 * @property {Record<string, object>} sheets  per sheet: frame size, columns, rows, canvas size,
 *   texture name, pose / animation counts, spriteOptions
 * @property {Record<string, AlphaCensus>} glow  per sheet
 * @property {AlphaCensus} [atlasCensus]
 * @property {Record<string, string[]>} margins  frames with border texels, per sheet
 * @property {boolean|null} plainIdentical  player combat sheet columns 0–5 == the plain sheet
 * @property {() => { golemTexelsBrightened: number, slimeTexelsBrightened: number }} [probeGlow]
 * @property {() => string[]|string} [verify]  every assertion: the failures, or a pass line
 * @property {() => string[]} [programs]  Sprite3D program cache keys compiled so far
 * @property {{ golemTexelsBrightened: number, slimeTexelsBrightened: number }} [glowProbe]
 * @property {string[]} [fail]  verify()'s failures
 */
/** @typedef {{ opaque: number, glow: number, other: number }} AlphaCensus */

async function buildCombatView() {
  const focus = params.get('focus');
  /** @type {SpriteCombatReport} */
  const out = { hashDiffs: null, contrast: {}, paintMs: 0, sheets: {}, glow: {}, margins: {}, plainIdentical: null };
  window.__spriteCombat = out;

  // --- paint every combat sheet (timed: budget 8 enemy sheets + player ≤ 120 ms) ---
  const t0 = performance.now();
  const enemy = {};
  for (const k of ENEMY_SHEET_KINDS) enemy[k] = createEnemySheet(k);
  const playerSpec = { ...CHARACTER_PRESETS.traveler, preset: 'traveler', weapon: 'sword' };
  const player = createCharacterSheet(playerSpec, { combat: true });
  out.paintMs = performance.now() - t0;
  // a second (warm) paint: the CPU budget check uses the better of the two (other page work can
  // stall the cold one), both are reported
  {
    const t2 = performance.now();
    for (const k of ENEMY_SHEET_KINDS) createEnemySheet(k).dispose();
    createCharacterSheet(playerSpec, { combat: true }).dispose();
    out.paintMsWarm = performance.now() - t2;
  }
  const t1 = performance.now();
  const atlas = createFxAtlas();
  out.atlasMs = performance.now() - t1;
  out.sheets = Object.fromEntries([...Object.entries(enemy), ['player', player]].map(([k, s]) => [k, {
    fw: s.frameWidth, fh: s.frameHeight, columns: s.columns, rows: s.rows, w: s.canvas.width, h: s.canvas.height,
    name: s.texture.name, poses: Object.keys(s.poses).length, anims: Object.keys(s.animations).length,
    spriteOptions: s.spriteOptions ?? null,
  }]));
  for (const [k, s] of Object.entries({ ...enemy, player })) out.glow[k] = alphaCensus(s.canvas);
  out.atlasCensus = alphaCensus(atlas.canvas);

  // player combat sheet columns 0–5 == the plain sheet
  {
    const plain = createCharacterSheet(playerSpec);
    const a = pixelsOf(plain.canvas);
    const b = pixelsOf(player.canvas); // columns 0–5 = the left part of each row of the wider canvas
    const wa = plain.canvas.width * 4, wb = player.canvas.width * 4;
    let diff = 0;
    for (let y = 0; y < plain.canvas.height; y++) for (let i = 0; i < wa; i++) if (a[y * wa + i] !== b[y * wb + i]) diff++;
    out.plainIdentical = diff === 0;
    plain.dispose();
  }
  // margins: combat columns of the humanoid sheets, every frame of the monster sheets
  out.margins.player = marginViolations(player, 6);
  for (const k of ENEMY_SHEET_KINDS) out.margins[k] = marginViolations(enemy[k], enemy[k].frameWidth === 32 && enemy[k].frameHeight === 32 ? 6 : 0);

  // --- value contrast against the grass tops (COMBAT.md §10.3) ---
  const grass = grassAverage();
  const Lg = relLuminance(grass);
  for (const k of ['slime', 'goblin', 'bat']) {
    const avg = midToneAverage(enemy[k].canvas);
    const L = relLuminance(avg);
    out.contrast[k] = { midTone: avg.map(Math.round), L: +L.toFixed(4), grassL: +Lg.toFixed(4), ratio: +contrastRatio(L, Lg).toFixed(3) };
  }

  // --- existing-sheet hashes vs the committed baseline ---
  const base = await fetch('./sprite_art.hashes.json').then((r) => r.json());
  const now = existingSheetHashes();
  const diffs = [];
  for (const [k, v] of Object.entries(base.hashes)) if (now[k] !== v) diffs.push(`${k}: ${v} → ${now[k]}`);
  for (const k of Object.keys(now)) if (!(k in base.hashes)) diffs.push(`${k}: new`);
  out.hashDiffs = diffs;
  out.hashCount = Object.keys(base.hashes).length;

  // --- page ---
  const zoomOf = (s) => (Z || (s.frameWidth >= 64 ? 2 : s.frameWidth >= 32 ? 3 : 4));
  if (focus) {
    const s = focus === 'player' ? player : enemy[focus];
    if (focus === 'atlas') {
      const cv = el('canvas', { width: 512 * (Z || 2), height: 512 * (Z || 2), style: 'background:#1a1620' });
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(atlas.canvas, 0, 0, cv.width, cv.height);
      app.append(cv);
    } else if (s && params.has('cols')) {
      // selected columns (all rows) at a big zoom: &cols=6,7,8
      const z = Z || 8;
      const names = columnNames(s);
      const cols = params.get('cols').split(',').map(Number);
      const grid = el('div', { style: `display:grid;grid-template-columns:repeat(${cols.length}, auto);gap:4px` });
      for (const c of cols) grid.append(el('span', { style: 'font-size:11px' }, `${c} ${names[c] ?? ''}`));
      for (let r = 0; r < s.rows; r++) {
        for (const c of cols) {
          const cv = el('canvas', { class: 'sheet', width: s.frameWidth * z, height: s.frameHeight * z });
          const g = cv.getContext('2d');
          g.imageSmoothingEnabled = false;
          g.drawImage(s.canvas, c * s.frameWidth, r * s.frameHeight, s.frameWidth, s.frameHeight, 0, 0, cv.width, cv.height);
          grid.append(cv);
        }
      }
      app.append(grid);
    } else if (s) {
      app.append(el('div', { class: 'card' }, el('div', { class: 'label' }, focus), labelledSheet(s, Z || 6, columnNames(s))));
    }
    return;
  }

  const summary = el('pre', { id: 'combat-summary', style: 'font: 12px/1.35 monospace; white-space: pre-wrap; margin: 0 0 8px;' });
  summary.textContent = [
    `paint: 8 enemy sheets + player ${out.paintMs.toFixed(1)} ms, FX atlas ${out.atlasMs.toFixed(1)} ms`,
    `existing-sheet hashes: ${diffs.length ? `${diffs.length} DIFFER` : `all ${out.hashCount} equal the baseline`}`,
    `player combat sheet columns 0–5 identical to the plain sheet: ${out.plainIdentical}`,
    `value contrast vs grass (g + G, L ${Lg.toFixed(3)}): ${Object.entries(out.contrast).map(([k, v]) => `${k} ${v.ratio} (L ${v.L})`).join(' · ')}`,
    `glow texels (alpha 204): ${Object.entries(out.glow).map(([k, v]) => `${k} ${v.glow}`).join(' · ')}`,
  ].join('\n');
  app.append(el('h2', {}, 'Checks'), summary);

  app.append(el('h2', {}, 'Flash / glow (Sprite3D combatFx, PostFX bloom)'));
  const host = el('div', { id: 'three', style: 'height:420px' });
  app.append(host);
  const fx = setupCombatThree(host, { enemy, player });
  out.probeGlow = () => fx.probeGlow();
  out.verify = () => verifyCombat(out, { enemy, player, atlas });
  out.programs = () => fx.programs();

  app.append(el('h2', {}, 'Player combat sheet (traveler + sword)'));
  app.append(el('div', { class: 'card' }, labelledSheet(player, 2, columnNames(player))));

  app.append(el('h2', {}, 'Enemy sheets'));
  for (const k of ENEMY_SHEET_KINDS) {
    const s = enemy[k];
    const card = el('div', { class: 'card', style: 'margin-bottom:10px' });
    card.append(el('div', { class: 'label' }, k, ' ', el('small', {}, `${s.canvas.width}×${s.canvas.height} · ${s.frameWidth}×${s.frameHeight} · ${JSON.stringify(s.spriteOptions)}`)));
    card.append(labelledSheet(s, s.frameWidth >= 64 ? 1 : 2, columnNames(s)));
    const row = el('div', { class: 'row' });
    for (const d of DIRECTIONS) addPreview(row, s, `walk_${d}`, zoomOf(s), `walk ${d}`);
    addPreview(row, s, 'idle_down', zoomOf(s), 'idle');
    card.append(row);
    app.append(card);
  }

  app.append(el('h2', {}, 'FX atlas (512 × 512)'));
  const fxRow = el('div', { class: 'row', style: 'align-items:flex-start;gap:14px' });
  const cv = el('canvas', { width: 1024, height: 1024, style: 'background:#1a1620;width:512px;height:512px' });
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlas.canvas, 0, 0, 1024, 1024);
  const anims = el('div', { class: 'grid', style: 'background:#1a1620;padding:8px;max-width:900px' });
  for (const [name, f] of Object.entries(atlas.frames)) {
    const z = f.w >= 48 ? 2 : f.w >= 24 ? 3 : 4;
    const strip = {
      canvas: atlas.canvas, frames: f.n, fps: f.fps || 1, width: f.w, height: f.h, atlasRects: f.rects,
    };
    const c2 = el('canvas', { width: f.w * z, height: f.h * z });
    const cx2 = c2.getContext('2d');
    cx2.imageSmoothingEnabled = false;
    previews.push({ ctx: cx2, atlas: strip, zoom: z, cv: c2 });
    anims.append(el('div', { class: 'prev' }, c2, el('span', {}, `${name} ${f.w}×${f.h}×${f.n}`)));
  }
  fxRow.append(cv, anims);
  app.append(fxRow);
}

/**
 * Every assertion of sprite_art.combat.json (COMBAT.md §10 / §21): existing-sheet hashes, value
 * contrast, the paint budget, sheet shapes / pose maps / animations / sprite options, margins,
 * glow and alpha classes, the FX atlas layout, the Sprite3D combatFx program keys and uniforms,
 * and the glow render probe. Failures throw asynchronously (the harness exits 1, TOOL-01).
 */
function verifyCombat(out, { enemy, player, atlas }) {
  const fail = [];
  const need = (cond, msg) => { if (!cond) fail.push(msg); };
  need(out.hashDiffs.length === 0, `existing sheets changed: ${out.hashDiffs.join('; ')}`);
  for (const k of ['slime', 'goblin', 'bat']) need(out.contrast[k].ratio >= 1.6, `contrast ${k} ${out.contrast[k].ratio} < 1.6`);
  need(Math.min(out.paintMs, out.paintMsWarm) <= 120, `paint ${out.paintMs.toFixed(1)} / ${out.paintMsWarm.toFixed(1)} ms > 120`);
  need(out.plainIdentical, 'player combat sheet columns 0–5 differ from the plain sheet');
  for (const [k, m] of Object.entries(out.margins)) need(m.length === 0, `${k}: border texels in ${m.join(', ')}`);
  // sheet shapes and pose maps (§10.3)
  const COMMON = ['idle0', 'idle1', 'move0', 'move1', 'move2', 'move3', 'windup', 'attack', 'hurt', 'dead'];
  /**
   * kind → frame width, height, columns, extra poses, spriteOptions, pose aliases
   * @type {Record<string, [number, number, number, string[], object, Record<string, string>?]>}
   */
  const EXPECT = {
    slime: [20, 16, 11, ['land'], { blobSize: [0.9, 0.45] }],
    goblin: [32, 32, 18, ['attack2'], {}, { windup: 'wind', attack: 'slash', attack2: 'backhand', dead: 'down' }],
    archer: [32, 32, 18, ['shove'], {}, { windup: 'aim', attack: 'follow', shove: 'thrust', dead: 'down' }],
    shaman: [32, 32, 18, ['blink'], {}, { windup: 'cast', attack: 'aim', blink: 'tuck', dead: 'down' }],
    bat: [20, 20, 10, [], { castShadow: false, blobSize: [0.7, 0.35] }],
    boar: [32, 24, 13, ['charge0', 'charge1', 'stun'], { blobSize: [1.6, 0.7] }],
    dummy: [16, 24, 11, ['hurt2'], { blobSize: [0.7, 0.35] }],
    golem: [64, 64, 17, ['slamWind', 'slam', 'sweepWind', 'sweep', 'throw', 'roar', 'kneel'], { blobSize: [2.6, 1.2] }],
  };
  const OPT_KEYS = new Set(['blobSize', 'castShadow', 'normalUp', 'wrap', 'roundness']);
  for (const [k, [fw, fh, cols, extra, opts, alias]] of Object.entries(EXPECT)) {
    const s = enemy[k];
    need(s.frameWidth === fw && s.frameHeight === fh && s.columns === cols && s.rows === 4, `${k}: frame ${s.frameWidth}×${s.frameHeight} × ${s.columns}`);
    need(s.canvas.width === fw * cols && s.canvas.height === fh * 4, `${k}: canvas ${s.canvas.width}×${s.canvas.height}`);
    need(s.texture.name === `enemy:${k}` && s.kind === k && s.pixelsPerUnit === 16 && s.anchor[0] === 0.5 && s.anchor[1] === 0, `${k}: name / kind / ppu / anchor`);
    for (const p of [...COMMON, ...extra]) need(Number.isInteger(s.poses[p]) && s.poses[p] >= 0 && s.poses[p] < cols, `${k}: pose ${p} missing`);
    for (const [a, b] of Object.entries(alias ?? {})) need(s.poses[a] === s.poses[b], `${k}: alias ${a} ≠ ${b}`);
    need(JSON.stringify(s.spriteOptions) === JSON.stringify(opts), `${k}: spriteOptions ${JSON.stringify(s.spriteOptions)}`);
    for (const key of Object.keys(s.spriteOptions)) need(OPT_KEYS.has(key), `${k}: spriteOptions key ${key}`);
    for (const d of DIRECTIONS) for (const a of ['idle', 'walk', 'run']) need(s.animations[`${a}_${d}`]?.frames.length > 0, `${k}: animation ${a}_${d}`);
    for (let r = 0; r < 4; r++) need(rowPainted(s, r), `${k}: row ${r} empty`);
  }
  need(enemy.bat.animations.idle_down.fps === 10 && enemy.bat.animations.idle_down.frames.map((f) => f.col).join() === [2, 3, 4, 5].join(), 'bat: idle uses move0–3 at 10 fps');
  let unknownThrows = false;
  // @ts-expect-error an unknown kind on purpose: it must throw
  try { createEnemySheet('dragon'); } catch (e) { unknownThrows = true; }
  need(unknownThrows, 'createEnemySheet: unknown kind does not throw');
  // player combat sheet (§10.2)
  need(player.columns === 18 && player.canvas.width === 576 && player.canvas.height === 128, `player: ${player.canvas.width}×${player.canvas.height}`);
  need(player.texture.name === 'character:traveler:combat', `player texture ${player.texture.name}`);
  COMBAT_POSE_NAMES.forEach((n, i) => need(player.poses[n] === 6 + i, `player pose ${n}`));
  for (const a of ['attack1', 'attack2', 'attack3', 'spin', 'cast', 'aim', 'hurt', 'dodge', 'down']) need(player.animations[`${a}_left`]?.loop === false, `player animation ${a}`);
  // alpha classes: glow texels only where intended, nothing else partial
  for (const [k, c] of Object.entries(out.glow)) {
    need(c.other === 0, `${k}: ${c.other} partial-alpha texels besides glow`);
    need(['golem', 'bat', 'shaman'].includes(k) ? c.glow > 0 : c.glow === 0, `${k}: glow texels ${c.glow}`);
  }
  // FX atlas (§10.4)
  need(atlas.canvas.width <= 512 && atlas.canvas.height <= 512, 'atlas larger than 512²');
  need(out.atlasCensus.other === 0 && out.atlasCensus.glow === 0, 'atlas alpha not binary');
  const t = atlas.texture;
  need(t.magFilter === THREE.NearestFilter && t.minFilter === THREE.NearestFilter && t.colorSpace === THREE.SRGBColorSpace && t.wrapS === THREE.ClampToEdgeWrapping, 'atlas texture settings');
  const A = pixelsOf(atlas.canvas);
  const alphaAt = (x, y) => (x < 0 || y < 0 || x >= 512 || y >= 512 ? 0 : A[(y * 512 + x) * 4 + 3]);
  for (const [name, spec] of Object.entries(FX_FRAMES)) {
    const f = atlas.frames[name];
    need(f && f.w === spec.w && f.h === spec.h && f.n === spec.n && f.rects.length === spec.n, `atlas frame ${name}`);
    if (!f) continue;
    f.rects.forEach(([u0, v0, u1, v1], i) => {
      const x0 = Math.round(u0 * 512), y0 = Math.round((1 - v1) * 512), w = Math.round((u1 - u0) * 512), h = Math.round((v1 - v0) * 512);
      need(w === spec.w && h === spec.h, `atlas ${name}[${i}] rect ${w}×${h}`);
      let painted = 0, gutter = 0;
      for (let y = y0 - 1; y <= y0 + h; y++) {
        for (let x = x0 - 1; x <= x0 + w; x++) {
          const inside = x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
          if (inside) painted += alphaAt(x, y) ? 1 : 0;
          else gutter += alphaAt(x, y) ? 1 : 0;
        }
      }
      need(painted > 0, `atlas ${name}[${i}] empty`);
      need(gutter === 0, `atlas ${name}[${i}] gutter not transparent (${gutter})`);
    });
  }
  // Sprite3D combatFx: program keys and uniforms (§10.1)
  const fxs = new Sprite3D(enemy.slime, { combatFx: true });
  const plain = new Sprite3D(enemy.slime, {});
  need(fxs.material.customProgramCacheKey() === 'luminati-sprite3d-lit-fx-v1', 'fx program key');
  need(plain.material.customProgramCacheKey() === 'luminati-sprite3d-lit-v1', 'plain program key');
  need(plain.mesh.customDepthMaterial.customProgramCacheKey() === 'luminati-sprite3d-depth-v1' && fxs.mesh.customDepthMaterial.customProgramCacheKey() === 'luminati-sprite3d-depth-v1', 'depth program key');
  need(!('uFlash' in plain._uniforms) && !('uGlow' in plain._uniforms) && !('uHighlight' in plain._uniforms), 'plain sprite has fx uniforms');
  need(fxs._uniforms.uFlash.value.isVector4 && fxs._uniforms.uGlow.value.isVector4 && fxs._uniforms.uHighlight.value.isVector4, 'fx uniforms are Vector4');
  plain.setFlash(1, 1, 1, 1).setGlow(1, 1, 1, 1).setHighlight(1, 1, 1, 1);
  need(plain.flash.every((v) => v === 0) && plain.glow.every((v) => v === 0) && plain.highlight.every((v) => v === 0), 'setFlash / setGlow / setHighlight change a plain sprite');
  fxs.setFlash(2.2, 2.2, 2.2, 0.85).setGlow(1, 0.45, 0.15, 3).setHighlight(1.6, 0.7, 0.3, 0.9);
  const cl = fxs.clone();
  need(cl.flash[3] === 0.85 && cl.glow[3] === 3 && cl.highlight[3] === 0.9, 'clone keeps flash / glow / highlight');
  for (const s of [fxs, plain, cl]) s.dispose();
  const probe = out.probeGlow();
  out.glowProbe = probe;
  need(probe.golemTexelsBrightened > 50 && probe.slimeTexelsBrightened === 0, `glow probe ${JSON.stringify(probe)}`);
  out.fail = fail;
  if (fail.length) setTimeout(() => { throw new Error(`sprite_art.combat: ${fail.join(' | ')}`); });
  return fail.length ? fail : `all checks passed (hashes ${out.hashCount}, paint ${out.paintMs.toFixed(1)} / ${out.paintMsWarm.toFixed(1)} ms, contrast ${Object.entries(out.contrast).map(([k, v]) => `${k} ${v.ratio}`).join(' ')}, glow probe golem ${probe.golemTexelsBrightened} / slime ${probe.slimeTexelsBrightened} texels)`;
}

/** True when a sheet row has any opaque texel. */
function rowPainted(s, r) {
  const d = pixelsOf(s.canvas);
  const W = s.canvas.width;
  for (let y = r * s.frameHeight; y < (r + 1) * s.frameHeight; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3]) return true;
  return false;
}

/**
 * Tiny dusk diorama with the real Sprite3D (combatFx) + PostFX bloom: hit flash, wind-up flash,
 * elite rim, glow on the golem cracks, bat eyes and shaman gem, and the player.
 */
function setupCombatThree(host, { enemy, player }) {
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2a3246');
  const camera = new THREE.PerspectiveCamera(28, 1, 0.5, 200);
  const pitch = 30 * Math.PI / 180, dist = 22;
  camera.position.set(0, 1.4 + Math.sin(pitch) * dist, Math.cos(pitch) * dist);
  camera.lookAt(0, 1.4, 0);
  scene.add(new THREE.HemisphereLight('#a8b8e0', '#4a3a2c', 1.9));
  const sun = new THREE.DirectionalLight('#ffc080', 3.4);
  sun.position.set(-8, 6, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 8, bottom: -8 });
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), new THREE.MeshLambertMaterial({ color: '#4a6a3a' }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const sprites = [];
  /**
   * @param sheet  an enemy sheet or the player combat sheet (its `spriteOptions`, if any, apply)
   * @param {number} x @param {number} z
   * @param {string} pose  a `sheet.poses` name
   * @param {number} row  direction row
   * @param {{ flash?: Rgba, glow?: Rgba, highlight?: Rgba, y?: number, opts?: object }} [o]
   *   Sprite3D setFlash / setGlow / setHighlight arguments, mesh height, extra sprite options
   */
  const add = (sheet, x, z, pose, row, { flash = null, glow = null, highlight = null, y = 0, opts = {} } = {}) => {
    const s = new Sprite3D(sheet, { ...sheet.spriteOptions, ...opts, combatFx: true });
    s.position.set(x, 0, z);
    s.mesh.position.y = y;
    s.setFrame(sheet.poses[pose], row);
    if (flash) s.setFlash(...flash);
    if (glow) s.setGlow(...glow);
    if (highlight) s.setHighlight(...highlight);
    scene.add(s);
    sprites.push(s);
    return s;
  };
  const L = 1; // left row
  add(player, -9, 1, 'slash', L);
  add(enemy.goblin, -6.5, 1, 'wind', 2, { highlight: [1.6, 0.7, 0.3, 0.9] });     // wind-up highlight
  add(enemy.goblin, -4.2, 1.6, 'hurt', 0, { flash: [2.2, 2.2, 2.2, 0.85] });       // hit flash
  add(enemy.archer, -2.2, 0.6, 'aim', 0, { highlight: [1.6, 1.3, 0.5, 0.24] });   // elite shimmer
  add(enemy.shaman, -0.2, 1.2, 'cast', 0, { glow: [0.5, 1.0, 0.6, 2.0] });         // gem glow
  const slime = add(enemy.slime, 1.8, 2.2, 'idle0', 0);
  add(enemy.bat, 3.2, 1.8, 'windup', 0, { glow: [1.0, 0.3, 0.1, 2.5], y: 1.3 });   // eye glow
  add(enemy.boar, 6.2, 2.4, 'charge0', L);
  add(enemy.dummy, 3.6, -0.6, 'hurt', 0);
  const golem = add(enemy.golem, 9.2, 0, 'roar', 0, { glow: [1.0, 0.45, 0.15, 3.0] }); // phase 3 glow

  const postfx = new PostFX(renderer, scene, camera, { samples: 0 });
  postfx.settings.dof.enabled = false;
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = `${w}px`;
    renderer.domElement.style.height = `${h}px`;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    postfx.setSize(w, h, 1);
  };
  resize();
  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const s of sprites) s.update(dt, camera);
    postfx.render(dt);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return {
    /** Programs compiled so far with their cache keys (fx variant vs plain). */
    programs() {
      return [...new Set(renderer.info.programs.map((p) => (p.cacheKey.match(/luminati-sprite3d-[a-z-]+-v[0-9]/) || [null])[0]).filter(Boolean))];
    },
    /**
     * Glow survives the upload: render the golem alone into a float target with its glow on and
     * off; alpha-204 texels must come out brighter than 1.0 (HDR) only with the glow on.
     */
    probeGlow() {
      // render one sprite alone into a float target (no tone mapping) with its glow off and on;
      // alpha-204 texels must brighten, every opaque texel must stay unchanged
      const rt = new THREE.WebGLRenderTarget(128, 128, { type: THREE.FloatType });
      const cam = new THREE.PerspectiveCamera(20, 1, 0.5, 100);
      const shot = (s) => {
        const vis = sprites.map((o) => o.visible);
        for (const o of sprites) o.visible = o === s;
        ground.visible = false;
        cam.position.set(s.position.x, 2 + 2.2, s.position.z + 14);
        cam.lookAt(s.position.x, 2, s.position.z);
        const tm = renderer.toneMapping;
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.setRenderTarget(rt);
        renderer.render(scene, cam);
        const buf = new Float32Array(128 * 128 * 4);
        renderer.readRenderTargetPixels(rt, 0, 0, 128, 128, buf);
        renderer.setRenderTarget(null);
        renderer.toneMapping = tm;
        sprites.forEach((o, i) => { o.visible = vis[i]; });
        ground.visible = true;
        return buf;
      };
      const changed = (s, glow) => {
        const keep = s.glow;
        s.setGlow(0, 0, 0, 0);
        const off = shot(s);
        s.setGlow(...glow);
        const on = shot(s);
        s.setGlow(...keep);
        let n = 0;
        for (let i = 0; i < on.length; i += 4) if (on[i] - off[i] > 0.3) n++;
        return n;
      };
      const out = {
        golemTexelsBrightened: changed(golem, [1.0, 0.45, 0.15, 3.0]),
        slimeTexelsBrightened: changed(slime, [1.0, 0.45, 0.15, 3.0]), // no glow texels: must stay 0
      };
      rt.dispose();
      return out;
    },
  };
}

// ---------------------------------------------------------------------------
// Loop + handles
// ---------------------------------------------------------------------------

let paused = false;
function loop(now) {
  const t = frozenT ?? now / 1000;
  if (!paused) {
    drawPreviews(t);
    if (three) three.update(t);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/**
 * `window.__sprites` (AUTOMATION_API.md §7), the gallery handles.
 * @typedef {object} SpritesHandle
 * @property {typeof sheets} sheets  every CHARACTER_PRESETS sheet by name
 * @property {typeof creatures} creatures  creature sheets by kind
 * @property {typeof props} props  prop sprites by kind (seed 7)
 * @property {typeof custom} custom  the CUSTOM_SPECS sheets by label
 * @property {number} buildMs  time to build all of the above
 * @property {() => typeof three} three  the 3D preview handle (gallery mode; else null)
 * @property {(v?: boolean) => void} pause  stop / resume the preview animation
 * @property {string[]} presets  the preset names
 */
window.__sprites = {
  sheets, creatures, props, custom, buildMs, three: () => three,
  pause(v = true) { paused = v; },
  presets: presetNames,
};
