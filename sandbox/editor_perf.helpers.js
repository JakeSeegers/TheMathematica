/**
 * Performance helpers for the level editor (sandbox/editor_perf.*.json).
 * Load from an eval step:  import('/sandbox/editor_perf.helpers.js').then((m) => m.install())
 *
 * window.P:
 *   setup(kind)      load a 64×64 test level with ~200 objects ('vale': the generated test valley,
 *                    'ember': Emberfall resized to 64×64 + 64 trees) in the split layout
 *   s2d(x, z)        viewport (client) coords of a world point in the 2D map
 *   s3d(x, z)        viewport (client) coords of a world point on the terrain in the 3D view
 *   path(view, pts)  [[x, z], …] world → [[cx, cy], …] client points (JSON), for harness drag
 *                    steps: { "drag": "P.path('2d', [[30, 30], [31.5, 30.5]])" } — the harness
 *                    evaluates the string when the step runs, so the stroke follows the layout
 *                    (editor_perf*.json draw every stroke this way)
 *   start()/stop(label)  in-page frame-time recorder (rAF deltas, long tasks, Viewport3D phases)
 *   fingerprint()    structure-independent checksum of the 3D scene (terrain + water + props)
 *   exactCheck()     fingerprint now vs after a forced full rebuild of the 3D view
 *
 * The dynamic imports are relative to this module (`../src/…`, `./editor3d.level.js`) and its fetch
 * starts with `import.meta.env.BASE_URL`, so the helpers also work under a sub-path.
 */

/**
 * @import { EditorHooks } from '../src/editor/EditorApp.js'
 * @import { Object3D } from 'three'
 * @import { Level } from '../src/engine/level/types.js'
 */

/**
 * Structure-independent checksum of the visible mesh vertices (`fingerprint()`).
 * @typedef {object} SceneFingerprint
 * @property {number} verts
 * @property {number} tris
 * @property {number} sx  sum of the world x of the vertices
 * @property {number} sy  sum of y
 * @property {number} sz  sum of z
 * @property {number} sq  sum of the squared coordinates
 * @property {number} meshes
 */

/**
 * `window.P`, set by `install()` (AUTOMATION_API.md §7); the helpers also read it back as the
 * bare global `P` (src/globals.d.ts).
 * @typedef {object} PerfHelpers
 * @property {EditorHooks} E  `window.__editor`
 * @property {(kind?: string) => Promise<string>} setup  load the 'vale' (default) or 'ember' test
 *   level in the split layout; JSON `{ objects, size, r2, r3 }`
 * @property {(x: number, z: number) => number[]} s2d  client [x, y] of a world point on the 2D map
 * @property {(x: number, z: number) => number[]} s3d  client [x, y] of a world point on the
 *   terrain in the 3D view
 * @property {(view: string, pts: number[][]) => string} path  JSON [[cx, cy], …] of world points
 *   in the '2d' or the 3D view
 * @property {() => string} start  start the frame-time recorder (`'recording'`)
 * @property {(label?: string) => string} stop  JSON frame-time summary, or `'not recording'`
 * @property {() => void} instrument  wrap the Viewport3D / Map2DView phases (once)
 * @property {(root?: Object3D|null) => SceneFingerprint} fingerprint
 *   of `root`, or of the 3D view's terrain + props
 * @property {() => Promise<string>} exactCheck  JSON: the scene now vs after a full rebuild
 * @property {(ms?: number) => Promise<void>} settle  wait until the 3D view is idle (max `ms`)
 * @property {() => Promise<void>} frame  one animation frame
 * @property {(ms: number) => Promise<void>} sleep
 * @property {(name: string) => Promise<string>} capture  render the 3D view and keep its pixels
 *   as `caps[name]`; returns `'<w>x<h>'`
 * @property {(a: string, b: string) => string} diff  JSON `{ mean, bigShare }` of two captures
 * @property {Record<string, ImageData>} [caps]  the captures, created by the first `capture`
 */

/** Install `window.P` (`PerfHelpers`). @returns {string} */
export function install() {
  const E = window.__editor;
  /** @type {PerfHelpers['frame']} */
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  /** @type {PerfHelpers['sleep']} */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** @param {string} [kind] */
  async function setup(kind = 'vale') {
    let level;
    if (kind === 'ember') {
      const LF = await import('../src/engine/level/LevelFormat.js');
      const src = await (await fetch(`${import.meta.env.BASE_URL}levels/emberfall.json`)).json();
      // (the `??` fallback is for an older normalizeLevel that returned the level itself)
      const base = /** @type {Level} */ (LF.normalizeLevel(src).level ?? LF.normalizeLevel(src));
      level = LF.resizeLevel(base, 64, 64, { anchor: 'nw' });
      for (let k = 0; k < 64; k++) LF.addObject(level, 'tree', 50 + (k % 8) * 1.5, 6 + Math.floor(k / 8) * 1.7, { opts: { kind: k % 3 ? 'oak' : 'pine', height: 4.5, seed: k + 1 } });
    } else {
      const m = await import('./editor3d.level.js');
      level = m.generateTestLevel({ width: 64, depth: 64 });
    }
    E.state.replaceLevel(level, { kind: 'new', name: '' });
    E.state.setView({ layout: 'split' });
    await E.view3d?.ready;
    for (let k = 0; k < 90; k++) await frame();
    E.view3d?.frameLevel({ instant: true });
    for (let k = 0; k < 30; k++) await frame();
    const r2 = canvas2d().getBoundingClientRect();
    const r3 = E.view3d.canvas.getBoundingClientRect();
    return JSON.stringify({ objects: level.objects.length, size: `${level.width}x${level.depth}`, r2: [r2.left, r2.top, r2.width, r2.height].map(Math.round), r3: [r3.left, r3.top, r3.width, r3.height].map(Math.round) });
  }

  const canvas2d = () => document.querySelector('.le-map2d-canvas');

  /** @param {number} x @param {number} z */
  function s2d(x, z) {
    const r = canvas2d().getBoundingClientRect();
    const p = E.view2d.worldToScreen(x, z);
    return [Math.round(r.left + p.x), Math.round(r.top + p.y)];
  }

  /** @param {number} x @param {number} z */
  function s3d(x, z) {
    const v = E.view3d;
    const r = v.canvas.getBoundingClientRect();
    const THREE_V = v.camera.position.clone();
    const p = THREE_V.set(x, v.surface.surfaceAt(x, z), z).project(v.camera);
    return [Math.round(r.left + (p.x + 1) / 2 * r.width), Math.round(r.top + (1 - p.y) / 2 * r.height)];
  }

  /** @param {string} view @param {number[][]} pts */
  function path(view, pts) {
    return JSON.stringify(pts.map(([x, z]) => (view === '2d' ? s2d(x, z) : s3d(x, z))));
  }

  // ---------------------------------------------------------------------------------------------
  // Frame recorder + Viewport3D phase profiler
  // ---------------------------------------------------------------------------------------------

  const prof = { cur: {}, frames: [] };
  let wrapped = false;
  function wrap(obj, name, key) {
    const fn = obj?.[name];
    if (typeof fn !== 'function') return;
    obj[name] = function wrappedFn(...args) {
      const t0 = performance.now();
      try { return fn.apply(this, args); } finally { prof.cur[key] = (prof.cur[key] ?? 0) + performance.now() - t0; }
    };
  }
  function instrument() {
    if (wrapped) return;
    wrapped = true;
    const v = E.view3d;
    if (!v) return;
    wrap(v, '_update', 'update');
    wrap(v, '_render', 'render');
    wrap(v, '_syncAll', 'syncAll');
    wrap(v, '_refreshOverlays', 'overlays');
    wrap(v.terrain, 'sync', 'terrainSync');
    wrap(v.terrain, 'flushWater', 'water');
    wrap(v.props, 'sync', 'propsSync');
    wrap(v.actors, 'sync', 'actorsSync');
    wrap(v.overlays, 'buildGrid', 'grid');
    wrap(v.scenery, 'build', 'scenery');
    wrap(v.foliage, 'build', 'foliage');
    if (v.props.batcher) wrap(v.props.batcher, 'step', 'batch');
    wrap(v.scenery, 'step', 'scenery');
    wrap(v.props, 'step', 'propsBuild');
    wrap(v.terrain, 'stepChunks', 'chunks');
    wrap(v.outline, 'render', 'outline');
    wrap(v.overlays, 'setSelection', 'selOverlay');
    wrap(v.lighting, 'lateUpdate', 'lighting');
    if (v.terrain.water) { const W = Object.getPrototypeOf(v.terrain.water); wrap(W, '_bakeShore', 'shoreBake'); wrap(W, '_buildGeometry', 'waterGeo'); wrap(W, '_readTiles', 'waterRead'); }
    wrap(v.labels, 'update', 'labels');
    const m2 = E.view2d;
    if (m2) {
      wrap(m2, '_render', 'map2d');
      wrap(m2, '_updateTerrain', 'map2dTerrain');
    }
  }

  let rec = null;
  function start() {
    instrument();
    rec = { frames: [], phases: [], last: performance.now(), running: true, long: [] };
    try {
      rec.po = new PerformanceObserver((l) => { for (const e of l.getEntries()) rec.long.push(e.duration); });
      rec.po.observe({ type: 'longtask', buffered: false });
    } catch { /* unsupported */ }
    prof.cur = {};
    const r = rec;
    const loop = (t) => {
      if (!r.running) return;
      r.frames.push(t - r.last);
      r.phases.push(prof.cur);
      prof.cur = {};
      r.last = t;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return 'recording';
  }

  /** @param {string} [label] */
  function stop(label = '') {
    if (!rec) return 'not recording';
    rec.running = false;
    rec.po?.disconnect();
    const f = rec.frames.slice(1);
    const s = [...f].sort((a, b) => a - b);
    const q = (p) => +(s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0).toFixed(1);
    // phase totals and the worst frame's breakdown
    const tot = {};
    const mx = {};
    for (const ph of rec.phases) for (const [k, v] of Object.entries(ph)) { tot[k] = (tot[k] ?? 0) + v; mx[k] = Math.max(mx[k] ?? 0, v); }
    let worst = 0;
    for (let k = 1; k < rec.frames.length; k++) if (rec.frames[k] > rec.frames[worst]) worst = k;
    const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +v.toFixed(1)]));
    const out = {
      label, frames: f.length, p50: q(0.5), p95: q(0.95), max: q(1), over25: f.filter((x) => x > 25).length, over50: f.filter((x) => x > 50).length,
      long: rec.long.length, longMax: +(Math.max(0, ...rec.long)).toFixed(0),
      phaseMax: round(mx), phaseAvg: round(Object.fromEntries(Object.entries(tot).map(([k, v]) => [k, v / Math.max(1, rec.phases.length)]))),
      worst: { ms: +(rec.frames[worst] ?? 0).toFixed(1), prevPhases: round(rec.phases[worst - 1] ?? {}), phases: round(rec.phases[worst] ?? {}) },
      undo: E.state.undoLabel, drawCalls: E.view3d?.stats.drawCalls,
    };
    rec = null;
    return JSON.stringify(out);
  }

  // ---------------------------------------------------------------------------------------------
  // Exactness: the 3D scene after a stroke equals a fresh full rebuild
  // ---------------------------------------------------------------------------------------------

  /**
   * Structure-independent checksum of every visible (layer 0) mesh vertex in world space.
   * @returns {SceneFingerprint}
   */
  function fingerprint(root = null) {
    const v = E.view3d;
    const roots = root ? [root] : [v.terrain.object, v.props.object];
    let n = 0; let sx = 0; let sy = 0; let sz = 0; let sq = 0; let tris = 0; let meshes = 0;
    const p = v.camera.position.clone();
    // (animated parts — windmill sails — excluded: they turn between the two measurements)
    const visibleChain = (o) => { for (let x = o; x; x = x.parent) if (!x.visible || x.userData.dynamic) return false; return true; };
    for (const r of roots) {
      r.updateMatrixWorld(true);
      r.traverse((o) => {
        if (!o.isMesh || !o.geometry || !visibleChain(o) || !o.layers.isEnabled(0)) return;
        const pos = o.geometry.getAttribute('position');
        if (!pos) return;
        meshes++;
        const idx = o.geometry.index;
        tris += (idx ? idx.count : pos.count) / 3;
        for (let k = 0; k < pos.count; k++) {
          p.fromBufferAttribute(pos, k).applyMatrix4(o.matrixWorld);
          n++; sx += p.x; sy += p.y; sz += p.z; sq += p.x * p.x * 0.001 + p.y * p.y + p.z * p.z * 0.001;
        }
      });
    }
    return { verts: n, tris: Math.round(tris), sx: +sx.toFixed(2), sy: +sy.toFixed(2), sz: +sz.toFixed(2), sq: +sq.toFixed(2), meshes };
  }

  /** @param {number} [ms] */
  async function settle(ms = 1500) {
    const t0 = performance.now();
    const v = E.view3d;
    while (performance.now() - t0 < ms) {
      await frame();
      const busy = v.busy ?? (v.terrain.waterPending || v._dirty?.terrain || v._dirty?.objects);
      if (!busy && !v._dirty?.terrain && !v._dirty?.objects && performance.now() - t0 > 400) break;
    }
  }

  async function exactCheck() {
    const v = E.view3d;
    await settle(3000);
    const a = fingerprint();
    const t = fingerprint(v.terrain.object);
    const pr = fingerprint(v.props.object);
    const shore = v.terrain.water?._shoreData?.slice() ?? null;
    const waterVisible = !!v.terrain.water?.object.visible;
    // a forced full rebuild of everything the view shows
    v.terrain.rebuild(E.state.level);
    v.overlays.buildGrid(E.state.level);
    if (v.props.rebuildAll) v.props.rebuildAll(E.state.level.objects, v.terrain.tileMap);
    else {
      for (const id of [...v.props.entries.keys()]) v.props._remove(id);
      v.props.sync(E.state.level.objects, v.terrain.tileMap, {});
    }
    await settle(3000);
    const b = fingerprint();
    const t2 = fingerprint(v.terrain.object);
    const pr2 = fingerprint(v.props.object);
    const same = (x, y) => ['verts', 'tris', 'sx', 'sy', 'sz', 'sq'].every((k) => Math.abs(x[k] - y[k]) <= Math.max(0.05, Math.abs(y[k]) * 1e-6));
    // the water shore texture (incrementally re-baked in blocks) must equal a fresh bake
    const fresh = v.terrain.water?._shoreData ?? null;
    let shoreDiff = -1;
    if (shore && fresh && shore.length === fresh.length && (waterVisible || v.terrain.water?.object.visible)) {
      shoreDiff = 0;
      for (let k = 0; k < fresh.length; k++) if (shore[k] !== fresh[k]) shoreDiff++;
    } else if (!shore && !fresh) shoreDiff = 0;
    return JSON.stringify({ identical: same(a, b) && shoreDiff === 0, terrain: same(t, t2), props: same(pr, pr2), shoreDiffBytes: shoreDiff, after: a, fresh: b, terrainAfter: t, terrainFresh: t2, propsAfter: pr, propsFresh: pr2 });
  }

  // ---------------------------------------------------------------------------------------------
  // Pixels: capture the 3D view (synchronous render) and compare captures
  // ---------------------------------------------------------------------------------------------

  /**
   * Render the 3D view now and copy its pixels (wind stilled so foliage does not sway).
   * @param {string} name
   */
  async function capture(name) {
    const v = E.view3d;
    const G = await import('../src/engine/render/GlobalUniforms.js');
    const U = G.globalUniforms;
    const wind = U.uWindStrength?.value;
    if (U.uWindStrength) U.uWindStrength.value = 0;
    v._render(0);
    const c = document.createElement('canvas');
    c.width = v.canvas.width;
    c.height = v.canvas.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(v.canvas, 0, 0);
    if (U.uWindStrength) U.uWindStrength.value = wind;
    (P.caps ??= {})[name] = ctx.getImageData(0, 0, c.width, c.height);
    return `${c.width}x${c.height}`;
  }

  /**
   * Mean absolute channel difference and share of pixels differing by > 24 between captures.
   * @param {string} a @param {string} b
   */
  function diff(a, b) {
    const A = P.caps[a].data;
    const B = P.caps[b].data;
    let sum = 0;
    let big = 0;
    for (let k = 0; k < A.length; k += 4) {
      const d = Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]);
      sum += d;
      if (d > 24) big++;
    }
    const n = A.length / 4;
    return JSON.stringify({ mean: +(sum / n / 3).toFixed(3), bigShare: +(big / n).toFixed(5) });
  }

  window.P = { E, setup, s2d, s3d, path, start, stop, instrument, fingerprint, exactCheck, settle, frame, sleep, capture, diff };
  return 'installed';
}
