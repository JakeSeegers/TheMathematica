/**
 * Helpers of the room checks (`sandbox/campaign.interior.json`, `campaign.interior.big.json`;
 * docs/specs/CAMPAIGN_FORMAT.md §6.3, levels set aside): walks in and out of a room (the demo's
 * mill cellar) and records, per travel, the times, whether the level was attached again instead of
 * built, the programs at the arrival and after a moment of play, the GPU memory and the scene's
 * size, the world's hash when it was left and when it came back, the lights, the weather shown and
 * the villagers. `expect` records a failed check and throws it as a page error (the harness exits
 * 1).
 *
 * Installed by an `eval` step: `import('/sandbox/campaign_interior.js')` → `window.CI`. Read-only on
 * builds without levels set aside (the `kept` fields are then null), so it measures the old code
 * too (or this code with `__game.game.campaign.keepRooms = false`). Uses the world hash of
 * `sandbox/campaign_prepare.js`.
 */
import CP from './campaign_prepare.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** The games whose level-half methods are wrapped (`CI.ready`). */
const wrapped = new WeakSet();
const G = () => window.__game;
const game = () => window.__game.game;
const r1 = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : v);

/** Every object in the scene (a scene-graph leak shows here). */
function sceneSize() {
  let n = 0;
  game().engine.scene.traverse(() => { n++; });
  return { children: game().engine.scene.children.length, objects: n };
}

/** The renderer's GPU memory counters and programs. */
function gpu() {
  const info = game().engine.renderer.info;
  return { geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs.length };
}

/** Wait until `fn()` holds (every 50 ms, at most `ms`). */
async function until(fn, ms = 20000) {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    if (fn()) return true;
    await sleep(50);
  }
  return false;
}

const CI = {
  sleep,
  until,
  sceneSize,
  gpu,
  /** Every travel recorded (`trip`). */
  trips: [],
  /** Failed checks (`expect`). */
  failed: [],
  /** World hashes taken when a level was left, by its source (`hashOn`). */
  leftHash: new Map(),
  /** The hash of the world right after the last `_buildLevel`. */
  builtHash: null,
  /** Milliseconds the hashes of the travel going on took (taken off its times). */
  hashMs: 0,
  /** Hash the worlds when left and when (re)attached (≈ 1 s on a 128 × 128 level). */
  hashOn: true,
  /** Milliseconds by phase of the travel going on (the wrapped Game methods). */
  phases: {},
  /** The suite's name in the page errors of failed checks. */
  suite: 'campaign.interior',
  /**
   * A check: a failure is recorded and thrown as a page error (the harness exits 1).
   * @param {unknown} ok
   * @param {string} label
   */
  expect(ok, label) {
    if (ok) return true;
    CI.failed.push(label);
    setTimeout(() => { throw new Error(`${CI.suite}: ${label}`); });
    return false;
  },
  /**
   * Wait for the first gameplay frames; answer story choices without windows; give the cellar key
   * (`give`: another item, or null for none — a campaign without that item); wrap the game's
   * level-half methods to time them and to hash the worlds.
   * @param {{ give?: string|null }} [o]
   */
  async ready({ give = 'cellar-key' } = {}) {
    for (let i = 0; i < 600 && !window.__luminati?.loadMs; i++) await sleep(100);
    G().story?.auto(true);
    if (give && !G().story?.holds(`item:${give}`)) G().story?.give(give);
    const g = game();
    if (!wrapped.has(g)) {
      wrapped.add(g);
      const time = (name) => {
        const fn = g[name].bind(g);
        g[name] = (...args) => {
          const t = performance.now();
          const out = fn(...args);
          const done = (v) => { CI.phases[name] = r1((CI.phases[name] ?? 0) + performance.now() - t); return v; };
          return out && typeof out.then === 'function' ? out.then(done) : done(out);
        };
      };
      // (hash the world being left before it goes; by its file: `campaign.levelId` is the
      // target's already)
      const detach = g._detachLevel.bind(g);
      g._detachLevel = (...args) => {
        if (CI.hashOn && g.world) {
          const t = performance.now();
          CI.leftHash.set(g.source, CP.hashWorld(g.world).hash);
          CI.hashMs += performance.now() - t;
        }
        const t = performance.now();
        const out = detach(...args);
        CI.phases._detachLevel = r1(performance.now() - t);
        return out;
      };
      const build = g._buildLevel.bind(g);
      g._buildLevel = async (...args) => {
        const t = performance.now();
        const out = await build(...args);
        CI.phases._buildLevel = r1(performance.now() - t);
        if (CI.hashOn) {
          const th = performance.now();
          CI.builtHash = CP.hashWorld(g.world).hash;
          CI.hashMs += performance.now() - th;
        }
        return out;
      };
      for (const name of ['_setupMaps', '_compileScene', '_frames', '_disposeDetached', '_primeShadows']) if (typeof g[name] === 'function') time(name);
    }
    return { loadMs: window.__luminati?.loadMs ?? null, level: G().state().campaign.level, source: g.source };
  },
  /** Is level object `id` of the level played now there as the story stands? */
  present(id) {
    const o = game().level.objects.find((x) => x.id === id);
    return o ? game().story.present(o) : null;
  },
  /**
   * One travel through exit `exit` of the level played now (its prompt / walk-in as the player
   * would), after standing `wait` ms beside it (0: at once); then `settle` ms of play with the
   * frame probe on. The record: times (the hashes' taken off), attached again or built, programs
   * at the arrival and after the play, memory, scene size, the hashes, lights, weather, villagers.
   * @param {string} exit an exit id of the level played now
   * @param {{ wait?: number, settle?: number, at?: [number, number], label?: string }} [o]
   *   at: stand there first (else a step beside the exit)
   */
  async trip(exit, { wait = 0, settle = 1500, at = null, label = '' } = {}) {
    const s0 = G().state();
    const from = s0.campaign.level;
    const ex = game().campaign._exits.find((e) => e.id === exit);
    if (!ex) throw new Error(`no exit ${exit} in ${from}`);
    const to = ex.to;
    const cx = (ex.minX + ex.maxX) / 2;
    const cz = (ex.minZ + ex.maxZ) / 2;
    // (a story run going on — an `arrive` cutscene — holds the player: an exit waits for it)
    await until(() => !game().busy && !game().story?.run, 30000);
    if (at) G().teleport(at[0], at[1]);
    else G().teleport(cx, cz + (from === 'mill-cellar' ? -1 : 1));
    if (wait) await sleep(wait);
    // (the level built ahead meanwhile: none toward a level set aside)
    const prepBefore = G().state().campaign.prep ?? null;
    CI.phases = {};
    CI.hashMs = 0;
    CI.builtHash = null;
    const t0 = performance.now();
    const ok = await G().campaign.exit(exit);
    const wallMs = performance.now() - t0;
    const G1 = G();
    const st = G1.state();
    const c = st.campaign;
    const atArrival = gpu();
    const sz = sceneSize();
    // villagers: present now, and which walk or animate in the next `settle` ms
    const npcs = game().npcs;
    const npcs0 = npcs.map((n) => [n.id, n.present, n.position.x, n.position.z, n.sprite.frame, n.sprite.animation]);
    const stop = CP.probe();
    // (a villager's sprite animates: its frame or animation changes at some point meanwhile)
    const anim = new Set();
    for (let t = 0; t < settle; t += 100) {
      await sleep(100);
      npcs.forEach((n, i) => { if (n.present && (n.sprite.frame !== npcs0[i][4] || n.sprite.animation !== npcs0[i][5])) anim.add(n); });
    }
    const frames = stop();
    const moved = npcs.filter((n, i) => n.present && Math.hypot(n.position.x - npcs0[i][2], n.position.z - npcs0[i][3]) > 0.05).length;
    const animated = anim.size;
    const afterPlay = gpu();
    const hashMs = Math.round(CI.hashMs);
    const leftBefore = CI.leftHash.get(game().source) ?? null;
    const rec = {
      route: label || `${from}→${to}`,
      from,
      ok,
      level: c.level,
      waitedMs: wait,
      kept: c.stats.lastKept ?? null,
      lastAside: c.stats.lastAside ?? null,
      aside: c.aside ?? null,
      travelMs: c.stats.lastMs - hashMs,
      buildMs: c.stats.lastBuildMs - hashMs,
      swapMs: game().loadStats.lastSwap - hashMs,
      wallMs: Math.round(wallMs - hashMs),
      hashMs,
      phases: { ...CI.phases },
      prepBefore: prepBefore ? `${prepBefore.to}:${prepBefore.state}` : null,
      prepUsed: c.stats.lastPrep?.used ?? null,
      programsAtArrival: atArrival.programs,
      programsAfterPlay: afterPlay.programs,
      memory: { geometries: afterPlay.geometries, textures: afterPlay.textures },
      scene: sz,
      // the world when it came back vs when it was left last (null: not left before)
      hash: CI.builtHash,
      leftHash: CI.hashOn ? leftBefore : null,
      sameHash: null,
      lights: st.pointLights,
      weather: st.weather,
      weatherShown: st.weatherShown ?? null,
      rain: +G1.weather.rain.intensity.toFixed(3),
      snow: +G1.weather.snow.intensity.toFixed(3),
      snowCover: +G1.weather.snowCover.toFixed(3),
      overcast: +G1.weather.factor('overcast').toFixed(3),
      npcs: { all: npcs0.length, present: npcs0.filter((n) => n[1]).length, moved, animated },
      frames,
      drawCalls: st.drawCalls,
      travels: c.stats.travels,
      reattached: c.stats.kept ?? null,
      dropped: c.stats.dropped ?? null,
    };
    rec.sameHash = rec.leftHash && rec.hash ? rec.hash === rec.leftHash : null;
    CI.trips.push(rec);
    return rec;
  },
  /** The trips so far, by route (and how they went): medians and every value. */
  summary() {
    const by = new Map();
    for (const r of CI.trips) {
      const k = `${r.route}${r.kept ? ' (kept)' : r.kept === false ? ' (built)' : ''}${r.waitedMs ? ' waited' : ' at once'}`;
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(r);
    }
    const out = {};
    for (const [k, list] of by) {
      out[k] = {
        n: list.length,
        travelMs: CP.median(list.map((r) => r.travelMs)),
        buildMs: CP.median(list.map((r) => r.buildMs)),
        all: list.map((r) => r.travelMs),
        builds: list.map((r) => r.buildMs),
        programs: [...new Set(list.map((r) => `${r.programsAtArrival}/${r.programsAfterPlay}`))],
        memory: [...new Set(list.map((r) => `${r.memory.geometries}g ${r.memory.textures}t`))],
        scene: [...new Set(list.map((r) => `${r.scene.children}/${r.scene.objects}`))],
        hashes: [...new Set(list.map((r) => r.hash).filter(Boolean))],
        sameHash: list.map((r) => r.sameHash),
        maxFrame: Math.max(...list.map((r) => r.frames.max)),
      };
    }
    return { failed: CI.failed, routes: out };
  },
};

window.CI = CI;
export default CI;
