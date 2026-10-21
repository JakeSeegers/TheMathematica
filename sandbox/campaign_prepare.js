/**
 * Helpers of the campaign travel checks (`sandbox/campaign.prepare.json`, `campaign.prepare.big.json`,
 * `campaign.prepare.checks.json`; KNOWN_ISSUES CMP-01): travels measured with the next level
 * prepared ahead, a frame-gap probe for the walk toward an exit, and a hash of the built world so a
 * prepared travel can be compared with a travel that built the level behind the fader.
 *
 * Installed by an `eval` step: `import('/sandbox/campaign_prepare.js')` → `window.CP`. Read-only on
 * builds without the preparation (the old code): `prep` fields are then null.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** The games whose `_buildLevel` is wrapped (`CP.ready`). */
const wrapped = new WeakSet();

/** FNV-1a over the bytes of a typed array (or a string), continuing from `h`. */
function fnv(h, data) {
  if (typeof data === 'string') {
    for (let k = 0; k < data.length; k++) { h ^= data.charCodeAt(k); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  const b = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  for (let k = 0; k < b.length; k++) { h ^= b[k]; h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

const r4 = (v) => (Number.isFinite(v) ? +v.toFixed(4) : v);

/**
 * A hash of everything a world built into the scene: every object under `world.root` (type, name,
 * flags, matrix, materials and their custom program cache keys, every attribute, index, draw range, instance
 * matrices), the colliders, walk surfaces, interactables, light descriptors, emitters, emissive
 * registrations, falls and fires. Equal hashes: the same scene.
 * @param {any} world
 */
function hashWorld(world) {
  let h = 2166136261;
  let objects = 0;
  let floats = 0;
  world.root.updateMatrixWorld(true);
  world.root.traverse((o) => {
    objects++;
    h = fnv(h, `${o.type}|${o.name}|${o.visible}|${o.castShadow}|${o.receiveShadow}|${o.renderOrder}|${o.frustumCulled}|${o.layers.mask}|`);
    h = fnv(h, new Float32Array(o.matrixWorld.elements));
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      h = fnv(h, `${m.type}|${m.name}|${m.transparent}|${m.side}|${m.alphaTest}|${m.depthWrite}|${m.customProgramCacheKey?.() ?? ''}|${m.map?.name ?? ''}|${JSON.stringify(m.defines ?? {})}|`);
    }
    const g = o.geometry;
    if (g) {
      for (const [name, a] of Object.entries(g.attributes)) {
        h = fnv(h, `${name}:${a.itemSize}:${a.count}:`);
        if (a.array) { h = fnv(h, a.array); floats += a.array.length; }
      }
      if (g.index) h = fnv(h, g.index.array);
      h = fnv(h, `${g.drawRange.start}:${g.drawRange.count}:${JSON.stringify(g.groups)}`);
    }
    if (o.isInstancedMesh) { h = fnv(h, o.instanceMatrix.array); h = fnv(h, `n${o.count}`); }
  });
  const tm = world.tileMap;
  h = fnv(h, JSON.stringify(tm.colliders.map((c) => (c.type === 'circle' ? [r4(c.x), r4(c.z), r4(c.r)] : [r4(c.minX), r4(c.maxX), r4(c.minZ), r4(c.maxZ)]))));
  h = fnv(h, JSON.stringify(tm.walkSurfaces.map((r) => [r4(r.minX), r4(r.maxX), r4(r.minZ), r4(r.maxZ), r4(r.y)])));
  h = fnv(h, JSON.stringify(world.interactables.map((it) => [it.id, it.kind, it.label, r4(it.position.x), r4(it.position.y), r4(it.position.z), !!it.disabled])));
  h = fnv(h, JSON.stringify(world.lightPool?.descriptors?.map?.((d) => [d.tag, r4(d.position.x), r4(d.position.y), r4(d.position.z), d.intensity, d.distance]) ?? []));
  h = fnv(h, JSON.stringify(world.falls.map((f) => [f.id, r4(f.anchor.x), r4(f.anchor.z), f.splash])));
  h = fnv(h, JSON.stringify(world.fires.map((p) => [r4(p.x), r4(p.y), r4(p.z)])));
  const emitters = [...world.propEmitters, ...world.areaEmitters.map((a) => a.emitter)];
  h = fnv(h, JSON.stringify(emitters.map((e) => [e.count ?? e.max ?? 0, r4(e.position?.x), r4(e.position?.z), e.enabled])));
  if (world.water) h = fnv(h, world.water._shoreData ?? new Uint8Array(0));
  return {
    hash: (h >>> 0).toString(16).padStart(8, '0'),
    objects,
    floats,
    colliders: tm.colliders.length,
    emissives: world.emissiveEntries.length,
    emitters: emitters.length,
    lights: world.lights.length,
  };
}

/**
 * A rAF gap probe: call the returned function to stop it and get the gaps (ms between frames).
 * @returns {() => { n: number, max: number, p99: number, mean: number, over25: number, over34: number }}
 */
function probe() {
  const gaps = [];
  let on = true;
  let last = 0;
  // long tasks (≥ 50 ms) meanwhile, where the browser reports them
  const long = [];
  let obs = null;
  try {
    obs = new PerformanceObserver((list) => { for (const e of list.getEntries()) long.push(Math.round(e.duration)); });
    obs.observe({ type: 'longtask', buffered: false });
  } catch { /* not supported */ }
  const f = (t) => {
    if (!on) return;
    if (last) gaps.push(t - last);
    last = t;
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
  return () => {
    on = false;
    obs?.disconnect();
    const s = [...gaps].sort((a, b) => a - b);
    const mean = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length);
    return {
      n: gaps.length,
      max: +(s.at(-1) ?? 0).toFixed(1),
      p99: +(s[Math.floor(s.length * 0.99)] ?? 0).toFixed(1),
      mean: +mean.toFixed(2),
      over25: gaps.filter((g) => g > 25).length,
      over34: gaps.filter((g) => g > 34).length,
      longTasks: long,
    };
  };
}

/** The shader programs alive now (their names, sorted). */
const programNames = () => (window.__game?.engine.renderer.info.programs ?? []).map((p) => p.name).sort();

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};

/** The game's preparation state (null on builds without it). */
const prepInfo = () => window.__game?.state().campaign?.prep ?? null;

const CP = {
  sleep,
  probe,
  hashWorld,
  median,
  /** Every travel measured so far. */
  results: [],
  /** Every walk measured so far (`walk`). */
  walks: [],
  /** The world's hash right after the last `_buildLevel` (before any frame moved anything). */
  built: null,
  /** Milliseconds the last of those hashes took. */
  builtMs: 0,
  /**
   * Wait for the first gameplay frames; answer story choices without windows; hash every world
   * right after `Game._buildLevel` from now on (`CP.built`: the animated props have not moved yet).
   */
  async ready() {
    for (let i = 0; i < 400 && !window.__luminati?.loadMs; i++) await sleep(100);
    window.__game?.story?.auto(true);
    const game = window.__game?.game;
    if (game && !wrapped.has(game)) {
      wrapped.add(game);
      const build = game._buildLevel.bind(game);
      game._buildLevel = async (...args) => {
        const out = await build(...args);
        const t = performance.now();
        CP.built = CP.hashOn ? hashWorld(game.world) : null;
        // (the hash's own time, taken off the travel's times in `travel`)
        CP.builtMs = performance.now() - t;
        return out;
      };
    }
    return window.__luminati?.loadMs ?? null;
  },
  /** Hash every world built (`CP.built`; costs a few ms on a small level, ~1 s on a big one). */
  hashOn: true,
  programNames,
  /** The hash of the world being played now (`hashWorld`). */
  hash() {
    return hashWorld(window.__game.world);
  },
  /**
   * One measured travel: teleport to (x, z) (near the exit toward `to`), stand there `wait` ms —
   * the probe records the frames meanwhile, the preparation (if any) runs — then travel; the
   * record holds the travel's times, the world's build phases, the frames while waiting and, with
   * `hash`, the world's hash after arrival.
   * @param {string} to
   * @param {{ x: number, z: number, wait?: number, hash?: boolean, entrance?: string, label?: string }} o
   */
  async travel(to, { x, z, wait = 4000, hash = false, entrance = '', label = '' }) {
    const G0 = window.__game;
    const from = G0.state().campaign.level;
    G0.combat?.god(true);
    G0.teleport(x, z);
    const stop = probe();
    const t0 = performance.now();
    // (stand until the preparation is done, at most `wait` ms; without one the whole wait)
    while (performance.now() - t0 < wait) {
      await sleep(100);
      const p = prepInfo();
      if (p && p.state === 'ready' && performance.now() - t0 > 600) break;
    }
    const frames = stop();
    const before = prepInfo();
    CP.builtMs = 0;
    const ok = await G0.campaign.travel(to, entrance);
    const hashMs = Math.round(CP.builtMs);
    await sleep(250);
    const G = window.__game;
    G.combat?.god(true);
    const s = G.state();
    const game = G.game;
    const rec = {
      route: label || `${from}→${to}`,
      ok,
      level: s.campaign.level,
      // (without the hash taken inside the build)
      travelMs: s.campaign.stats.lastMs - hashMs,
      buildMs: s.campaign.stats.lastBuildMs - hashMs,
      swapMs: game.loadStats.lastSwap - hashMs,
      hashMs,
      worldMs: game.loadStats.world,
      phases: { ...G.world.stats.phases },
      waitedMs: Math.round(performance.now() - t0),
      prepBefore: before,
      prepUsed: s.campaign.stats.lastPrep ?? null,
      frames,
      drawCalls: s.drawCalls,
      programs: G.engine.renderer.info.programs.length,
      lights: s.pointLights,
    };
    if (hash) rec.world = CP.built ?? hashWorld(G.world);
    CP.results.push(rec);
    return rec;
  },
  /**
   * Walk for `ms` (the right / left / up / down key held through the game's input) with the probe
   * on: the frames while the next level is built ahead during a walk toward its exit. With `from`,
   * teleport there first and settle for 800 ms.
   * @param {'right'|'left'|'up'|'down'} dir
   * @param {number} ms
   * @param {{ from?: [number, number], label?: string }} [o]
   */
  async walk(dir, ms, { from = null, label = '' } = {}) {
    window.__game.combat?.god(true);
    if (from) {
      window.__game.teleport(from[0], from[1]);
      await sleep(800);
    }
    const code = { right: 'KeyD', left: 'KeyA', up: 'KeyW', down: 'KeyS' }[dir];
    const level = window.__game.state().campaign?.level ?? '';
    const stop = probe();
    window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code.slice(3).toLowerCase() }));
    await sleep(ms);
    window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code.slice(3).toLowerCase() }));
    const frames = stop();
    const rec = { label: label || `${level} ${dir}`, frames, player: window.__game.state().player, prep: prepInfo() };
    CP.walks.push(rec);
    return rec;
  },
  /** Medians per route of the travels measured, and the walks' frames. */
  summary() {
    const by = new Map();
    for (const r of CP.results) {
      if (!by.has(r.route)) by.set(r.route, []);
      by.get(r.route).push(r);
    }
    const out = {};
    for (const [route, list] of by) {
      out[route] = {
        n: list.length,
        travelMs: median(list.map((r) => r.travelMs)),
        buildMs: median(list.map((r) => r.buildMs)),
        worldMs: median(list.map((r) => r.worldMs)),
        all: list.map((r) => r.buildMs),
        maxFrameWhileWaiting: Math.max(...list.map((r) => r.frames.max)),
        prepared: list.map((r) => r.prepUsed?.used ?? null),
        prepCpuMs: list.map((r) => r.prepUsed?.cpuMs ?? null),
        prepMaxSliceMs: Math.max(0, ...list.map((r) => r.prepUsed?.maxSliceMs ?? 0)),
        hashes: [...new Set(list.map((r) => r.world?.hash).filter(Boolean))],
        drawCalls: list.map((r) => r.drawCalls),
        programs: [...new Set(list.map((r) => r.programs))],
      };
    }
    if (CP.walks.length) {
      const all = CP.walks.map((w) => w.frames);
      out.walks = {
        n: CP.walks.length,
        frames: all.reduce((a, f) => a + f.n, 0),
        max: Math.max(...all.map((f) => f.max)),
        maxEach: all.map((f) => f.max),
        over25: all.reduce((a, f) => a + f.over25, 0),
        over34: all.reduce((a, f) => a + f.over34, 0),
        prepMaxSliceMs: Math.max(0, ...CP.walks.map((w) => w.prep?.maxSliceMs ?? 0)),
        prepMaxStepMs: Math.max(0, ...CP.walks.map((w) => w.prep?.maxStepMs ?? 0)),
        prepStates: CP.walks.map((w) => w.prep?.state ?? null),
      };
    }
    return out;
  },
};

window.CP = CP;
export default CP;
