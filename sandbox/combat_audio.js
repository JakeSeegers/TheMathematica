/**
 * Combat audio QA and listening page (KNOWN_ISSUES COMBAT-11).
 *
 * Every combat SFX, both stingers and a stretch of every music section is rendered offline
 * (OfflineAudioContext, 44.1 kHz, the game's AudioSystem settings: master 0.6, sfx 0.85, music 0.5,
 * reverb 0.32, each SFX at its in-game call volume) and measured against the 8 peaceful SFX and
 * "Emberfall Evening":
 *   - peak and true peak (4× windowed-sinc interpolation) at the output, i.e. clipping;
 *   - loudness per ITU-R BS.1770 (K-weighting, 400 ms momentary max "M", 3 s short-term max "S",
 *     gated integrated "I" for music) — the level-matching figure;
 *   - crest factor (peak over the RMS of the sound's active part), DC offset;
 *   - onset: attack time to −6 dB and the level of the first 0.25 ms (an instant onset clicks);
 *   - "cut": the tail a voice's stop() removes — a second dry render with every stop() delayed by
 *     0.6 s, differenced against the normal dry render (the removed tail's peak, dB under the
 *     sound's peak; above −50 dB the cut is an audible click);
 *   - gain steps: every gain automation of a sound is logged and evaluated — a setValueAtTime
 *     that jumps away from the value the envelope has at that moment (a re-trigger dropping a
 *     ringing voice to 0) clicks; "leak": a third dry render with every new GainNode starting at
 *     0 — whatever differs sounded before its envelope began (a gain left at its default 1.0);
 *   - harsh energy: the share and level of 2–6 kHz; sub-bass: the share below 40 Hz;
 *   - two dense combat scenes (10 hits, swings, deaths and cues over battle B; a boss phase-3
 *     flurry over boss B) and a peaceful reference scene, with the master compressor's gain
 *     reduction sampled every 50 ms: how much the SFX push the music down (pumping);
 *   - the victory sequence (boss B → stinger → level track) through the real CombatMusic, and
 *     how much of the playing track sounds under the stinger in clashing harmony.
 * The peaceful sounds are also compared against recorded numbers (and, with `compare(url)`,
 * sample by sample against another AudioSystem module), so a change to the combat audio can be
 * shown not to touch the peaceful mix.
 *
 * Buttons play every sound on a live AudioSystem (the first click unlocks audio); clicking a row
 * draws that render's waveform (with its dB envelope) and spectrogram.
 *
 * window.__caudio (typedef `CaudioHandle`): { ready, results, run(), compare(audioUrl, musicUrl?),
 *   identity(), play(name), select(name), summary(), peacefulPrint(url?), live, internals, and the
 *   tables SCENES, GAME_VOL, ROLE, WINDOW, LIMIT }
 */
import * as CUR_AUDIO from '../src/engine/audio/AudioSystem.js';
import * as CUR_MUSIC from '../src/game/combat/CombatMusic.js';

const SR = 44100;
const DB = (x) => 20 * Math.log10(Math.max(1e-12, x));
const PDB = (p) => 10 * Math.log10(Math.max(1e-24, p));
const LUFS = (p) => -0.691 + PDB(p);
const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : v === -Infinity ? '−∞' : '—');

/** In-game volume of each sound at ≤ 6 u from the player (the call sites in Game / Player / combat). */
const GAME_VOL = {
  step: 0.55, blip: 0.22, confirm: 0.7, cancel: 0.7, open: 0.45, close: 0.4, chime: 0.6, splash: 0.7,
  swing: 0.8, swingHeavy: 0.8, hit: 0.9, crit: 0.9, hurt: 1, dodge: 0.7, perfect: 1, whirl: 0.9, bolt: 0.85, boltHit: 1,
  nova: 1, drink: 0.8, guard: 0.8, enemyAlert: 1, windup: 1, arrow: 1, arrowHit: 0.5, hexBurst: 1, slimeHop: 1,
  batScreech: 1, boarSnort: 1, boarCharge: 1, stun: 1, enemyDie: 0.9, bossRoar: 1, slam: 1, rockToss: 1, gateClose: 1,
  pickup: 0.6, coin: 0.55, chestOpen: 1, waystone: 0.9, levelup: 1, playerDown: 1, heartbeat: 0.7,
};
GAME_VOL.arrowHit = 1; // (1 when it hits the player, with 'hurt'; 0.5 against a wall)

/**
 * Role of each combat sound and its loudness window: momentary max, LU relative to the integrated
 * loudness of "Emberfall Evening" (≈ −19.5 LUFS; the battle and boss tracks sit 1–3 LU above it).
 * Feedback (a hit landing, the player hurt) leads; the player's own actions and enemy cues sit
 * under it; loot sits with the UI sounds; the rare big moments may reach the music's own level but
 * not stand above the loudest 3 s of the combat tracks.
 */
const ROLE = {
  hit: 'feedback', crit: 'feedback', hurt: 'feedback', boltHit: 'feedback', arrowHit: 'feedback', guard: 'feedback', enemyDie: 'feedback',
  swing: 'action', swingHeavy: 'action', dodge: 'action', whirl: 'action', bolt: 'action', drink: 'action',
  enemyAlert: 'cue', windup: 'cue', arrow: 'cue', slimeHop: 'cue', batScreech: 'cue', boarSnort: 'cue', boarCharge: 'cue',
  stun: 'cue', rockToss: 'cue', heartbeat: 'cue',
  perfect: 'big', nova: 'big', hexBurst: 'big', bossRoar: 'big', slam: 'big', gateClose: 'big', levelup: 'big', playerDown: 'big',
  waystone: 'big', pickup: 'loot', coin: 'loot', chestOpen: 'loot',
};
const WINDOW = { feedback: [-10, 1], action: [-16, -3], cue: [-16, -2], big: [-8, 2.5], loot: [-17, -2], ref: [-Infinity, Infinity] };

/** Thresholds of the flags (see the legend on the page). */
const LIMIT = {
  truePeak: -1, // dBTP at the output
  cut: -50, // dB under the sound's peak
  step: -40, // dB: a gain jump relative to that envelope's maximum
  leak: -60, // dB under the peak: sound before its envelope began
  startLevel: -12, // dB: level of the first 0.25 ms after the onset, relative to the peak
  harshOver: 3, // dB: 2–6 kHz band level above the brightest peaceful sound's
  subShare: 0.2, // share of the energy below 40 Hz
  dc: -50, // dBFS mean over the active part
  crestHi: 24, // dB
  pumping: 3, // dB of extra master gain reduction on the music during a dense scene
};

/**
 * Recorded peaceful numbers (Chrome, 44.1 kHz, from the AudioSystem before the combat audio pass,
 * 2026-09-28): the 8 SFX at their in-game volumes (sample peak, momentary max), 16 s of the song
 * (integrated, peak), 6 s of all five ambience layers and the hash of the song's scheduled events.
 * `identity()` compares against them (±0.05 dB, the event hash exactly) — a change to a peaceful
 * sound shows up here; `compare(url)` checks sample by sample against another module.
 */
const PEACEFUL_GOLDEN = {
  events: '6e15567a',
  sfx: {
    step: { peakDb: -17.794, mMax: -36.114 }, blip: { peakDb: -37.049, mMax: -55.355 }, confirm: { peakDb: -12.437, mMax: -19.784 },
    cancel: { peakDb: -18.111, mMax: -29.25 }, open: { peakDb: -17.957, mMax: -28.27 }, close: { peakDb: -20.218, mMax: -28.902 },
    chime: { peakDb: -15.999, mMax: -21.841 }, splash: { peakDb: -13.031, mMax: -22.439 },
  },
  song: { integrated: -20.271, peakDb: -9.994 },
  ambience: { peakDb: -14.638, mMax: -25.21 },
};

// ---------------------------------------------------------------------------------------------
// DSP helpers
// ---------------------------------------------------------------------------------------------

/** RBJ biquad coefficients [b0, b1, b2, a1, a2] (a0-normalised). */
function rbj(type, f, q, sr = SR) {
  const w = (2 * Math.PI * f) / sr;
  const c = Math.cos(w);
  const al = Math.sin(w) / (2 * q);
  const a0 = 1 + al;
  const b = type === 'lowpass' ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : [(1 + c) / 2, -(1 + c), (1 + c) / 2];
  return [b[0] / a0, b[1] / a0, b[2] / a0, (-2 * c) / a0, (1 - al) / a0];
}

/** BS.1770 K-weighting (libebur128's sample-rate independent design): [pre-filter, RLB high-pass]. */
function kCoefs(sr = SR) {
  let K = Math.tan((Math.PI * 1681.974450955533) / sr);
  let Q = 0.7071752369554196;
  const Vh = 10 ** (3.999843853973347 / 20);
  const Vb = Vh ** 0.4996667741545416;
  let a0 = 1 + K / Q + K * K;
  const pre = [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
  K = Math.tan((Math.PI * 38.13547087602444) / sr);
  Q = 0.5003270373238773;
  a0 = 1 + K / Q + K * K;
  const rlb = [1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
  return [pre, rlb];
}
const K_COEFS = kCoefs();

function biquad(x, [b0, b1, b2, a1, a2]) {
  const out = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    out[i] = y0;
  }
  return out;
}
const chain = (x, list) => list.reduce((acc, c) => biquad(acc, c), x);

/** Mean power per window (sum over the given channels), windows of `win` s every `hop` s. */
function blocks(chs, win, hop, sr = SR) {
  const n = chs[0].length;
  const W = Math.round(win * sr);
  const H = Math.round(hop * sr);
  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (const c of chs) s += c[i] * c[i];
    cum[i + 1] = cum[i] + s;
  }
  const out = [];
  for (let s = 0; s + W <= n; s += H) out.push((cum[s + W] - cum[s]) / W);
  if (!out.length) out.push(cum[n] / W);
  return out;
}

function gatedIntegrated(bl) {
  const abs = bl.filter((p) => LUFS(p) > -70);
  if (!abs.length) return -Infinity;
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const rel = LUFS(mean(abs)) - 10;
  const g = abs.filter((p) => LUFS(p) > rel);
  return LUFS(mean(g.length ? g : abs));
}

/** 4× oversampled peak (12-tap-per-side Hann-windowed sinc), evaluated near the large samples. */
const TP_TAPS = 12;
const TP_H = [1, 2, 3].map((p) => {
  const f = p / 4;
  const h = [];
  for (let k = -TP_TAPS + 1; k <= TP_TAPS; k++) {
    const d = k - f;
    const sinc = d === 0 ? 1 : Math.sin(Math.PI * d) / (Math.PI * d);
    h.push(sinc * (0.5 + 0.5 * Math.cos((Math.PI * d) / TP_TAPS)));
  }
  return h;
});
function truePeak(x, samplePeak) {
  let tp = 0;
  const thr = samplePeak * 0.5;
  for (let i = TP_TAPS; i < x.length - TP_TAPS; i++) {
    const v = Math.abs(x[i]);
    if (v > tp) tp = v;
    if (v < thr && Math.abs(x[i + 1]) < thr) continue;
    for (const h of TP_H) {
      let y = 0;
      for (let k = 0; k < h.length; k++) y += x[i - TP_TAPS + 1 + k] * h[k];
      if (Math.abs(y) > tp) tp = Math.abs(y);
    }
  }
  return Math.max(tp, samplePeak);
}

const LP40 = [rbj('lowpass', 40, 0.707), rbj('lowpass', 40, 0.707)];
const BP26 = [rbj('highpass', 2000, 0.707), rbj('highpass', 2000, 0.707), rbj('lowpass', 6000, 0.707), rbj('lowpass', 6000, 0.707)];

/**
 * Measure one stereo render. `dry` / `ext` / `leak` (optional): the dry render, the same with every
 * stop() delayed and with every new gain starting at 0 — for the cut and leak columns; `steps`: the
 * gain-step analysis of the dry render's automation.
 */
function measure(L, R, { dry = null, ext = null, leak = null, steps = null, sr = SR, music = false } = {}) {
  const n = L.length;
  const mono = new Float32Array(n);
  let peak = 0;
  let nan = 0;
  for (let i = 0; i < n; i++) {
    const l = L[i];
    const r = R[i];
    if (!Number.isFinite(l) || !Number.isFinite(r)) { nan++; continue; }
    mono[i] = (l + r) / 2;
    const a = Math.max(Math.abs(l), Math.abs(r));
    if (a > peak) peak = a;
  }
  const tp = Math.max(truePeak(L, peak), truePeak(R, peak));
  const kL = chain(L, K_COEFS);
  const kR = chain(R, K_COEFS);
  const mBlocks = blocks([kL, kR], 0.4, 0.1, sr);
  const mMax = LUFS(Math.max(...mBlocks));
  const sBlocks = blocks([kL, kR], 3, 0.1, sr);
  const sMax = LUFS(Math.max(...sBlocks));
  const integrated = music ? gatedIntegrated(mBlocks) : null;
  // active part: from the onset (−60 dB) to the last sample above −40 dB of the peak
  let on = -1;
  let last = -1;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(mono[i]);
    if (on < 0 && a > peak * 1e-3) on = i;
    if (a > peak * 0.01) last = i;
  }
  if (on < 0) on = 0;
  if (last <= on) last = Math.min(n - 1, on + 1);
  let sum = 0;
  let mean = 0;
  for (let i = on; i <= last; i++) {
    sum += mono[i] * mono[i];
    mean += mono[i];
  }
  const len = last - on + 1;
  const rms = Math.sqrt(sum / len);
  mean /= len;
  let monoPeak = 0;
  for (let i = on; i <= last; i++) monoPeak = Math.max(monoPeak, Math.abs(mono[i]));
  // onset: attack to −6 dB, level of the first 0.25 ms
  let a6 = on;
  while (a6 < n && Math.abs(mono[a6]) < monoPeak * 0.5) a6++;
  let first = 0;
  for (let i = on; i < Math.min(n, on + Math.round(0.00025 * sr)); i++) first = Math.max(first, Math.abs(mono[i]));
  // bands over the active part
  const seg = mono.subarray(on, last + 1);
  const pow = (x) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return s; };
  const eAll = pow(seg) + 1e-30;
  const sub = chain(seg, LP40);
  const harsh = chain(seg, BP26);
  const harshBl = blocks([harsh], 0.4, 0.1, sr);
  const res = {
    seconds: +(len / sr).toFixed(2),
    peakDb: DB(peak),
    tpDb: DB(tp),
    mMax,
    sMax,
    integrated,
    crestDb: DB(monoPeak / (rms + 1e-12)),
    dcDb: DB(Math.abs(mean)),
    attackMs: ((a6 - on) / sr) * 1000,
    startDb: DB(first / (monoPeak + 1e-12)),
    harshShare: pow(harsh) / eAll,
    harshDb: PDB(Math.max(...harshBl)),
    subShare: pow(sub) / eAll,
    nan,
    onset: on / sr,
    end: last / sr,
  };
  if (dry) {
    let dPeak = 0;
    for (let i = 0; i < dry.L.length; i++) dPeak = Math.max(dPeak, Math.abs(dry.L[i]), Math.abs(dry.R[i]));
    const diff = (o) => {
      let v = 0;
      let at = -1;
      for (let i = 0; i < dry.L.length; i++) {
        const d = Math.max(Math.abs(dry.L[i] - o.L[i]), Math.abs(dry.R[i] - o.R[i]));
        if (d > v) { v = d; at = i; }
      }
      return { db: v > 0 ? DB(v / dPeak) : -Infinity, at: at / sr };
    };
    if (ext) {
      const c = diff(ext);
      res.cutDb = c.db;
      res.cutAt = c.at;
    }
    if (leak) {
      const l = diff(leak);
      res.leakDb = l.db;
      res.leakAt = l.at;
    }
  }
  if (steps) {
    res.stepDb = steps.maxDb;
    res.stepAt = steps.at;
  }
  return res;
}

// ---------------------------------------------------------------------------------------------
// Offline renders
// ---------------------------------------------------------------------------------------------

/**
 * Render `seconds` offline with a fresh AudioSystem of module `mod`. `setup(a, off)` schedules the
 * sounds (it may register `off.suspend` callbacks). Created compressors are captured in `comps`
 * (the master compressor first).
 */
async function render(mod, seconds, setup, opts = {}) {
  const off = new OfflineAudioContext(2, Math.ceil(SR * seconds), SR);
  const comps = [];
  const mk = off.createDynamicsCompressor.bind(off);
  off.createDynamicsCompressor = () => {
    const c = mk();
    comps.push(c);
    return c;
  };
  const a = new mod.AudioSystem({ context: off, ...opts });
  await a.unlock();
  const extra = await setup(a, off, comps);
  const buf = await off.startRendering();
  a.dispose();
  return { L: buf.getChannelData(0), R: buf.getChannelData(1), comps, extra };
}

/** Delay every source's stop() by `by` seconds while `fn` builds the graph (the "cut" render). */
function withLateStops(by, fn) {
  const proto = AudioScheduledSourceNode.prototype;
  const orig = proto.stop;
  proto.stop = function lateStop(when = 0) {
    return orig.call(this, (when || 0) + by);
  };
  try {
    return fn();
  } finally {
    proto.stop = orig;
  }
}

const SFX_DELAY = 0.05;
const SFX_SECONDS = { waystone: 5.2, bossRoar: 4.4, gateClose: 4.2, levelup: 4, playerDown: 4.2, chestOpen: 3.8, nova: 4, stun: 3.6, whirl: 3.4, open: 4.6, close: 4.6, perfect: 4.2, drink: 3.6, hexBurst: 3.6, slam: 3.6, boarCharge: 3.6 };
const sfxSeconds = (name) => SFX_SECONDS[name] ?? 3;

/** Every new GainNode of `ctx` starts at 0 while `fn` builds the graph (the "leak" render). */
function withSilentGains(ctx, fn) {
  const mk = ctx.createGain.bind(ctx);
  ctx.createGain = () => {
    const g = mk();
    g.gain.value = 0;
    return g;
  };
  try {
    return fn();
  } finally {
    delete ctx.createGain;
  }
}

/** Log the automation of every gain param `ctx` creates while `fn` builds the graph. */
function withGainLog(ctx, fn) {
  const gains = new WeakSet();
  const log = new Map();
  const mk = ctx.createGain.bind(ctx);
  ctx.createGain = () => {
    const g = mk();
    gains.add(g.gain);
    return g;
  };
  const P = AudioParam.prototype;
  const orig = { set: P.setValueAtTime, lin: P.linearRampToValueAtTime, exp: P.exponentialRampToValueAtTime, target: P.setTargetAtTime };
  const rec = (type) => function logged(v, t, tau) {
    if (gains.has(this)) {
      let l = log.get(this);
      if (!l) log.set(this, (l = []));
      l.push({ type, v, t, tau, i: l.length });
    }
    return orig[type].call(this, v, t, tau);
  };
  P.setValueAtTime = rec('set');
  P.linearRampToValueAtTime = rec('lin');
  P.exponentialRampToValueAtTime = rec('exp');
  P.setTargetAtTime = rec('target');
  try {
    fn();
  } finally {
    Object.assign(P, { setValueAtTime: orig.set, linearRampToValueAtTime: orig.lin, exponentialRampToValueAtTime: orig.exp, setTargetAtTime: orig.target });
    delete ctx.createGain;
  }
  return log;
}

/**
 * Gain steps: evaluate each logged gain envelope and find every setValueAtTime (after the first
 * event) that jumps away from the value the envelope has just before it. Returns the largest jump
 * relative to that envelope's maximum (dB) and the times of the jumps above LIMIT.step.
 */
function gainSteps(log) {
  let maxDb = -Infinity;
  const at = [];
  for (const raw of log.values()) {
    const evs = [...raw].sort((a, b) => a.t - b.t || a.i - b.i);
    const top = Math.max(...evs.map((e) => Math.abs(e.v)));
    if (!(top > 0)) continue;
    /**
     * The envelope segment in force: a value, or a setTargetAtTime approach.
     * @type {{ v?: number, target?: number, t0?: number, v0?: number, tau?: number }}
     */
    let cur = { v: evs[0].v };
    const valAt = (c, x) => (c.tau ? c.target + (c.v0 - c.target) * Math.exp(-(x - c.t0) / c.tau) : c.v);
    for (let k = 0; k < evs.length; k++) {
      const e = evs[k];
      const before = valAt(cur, e.t);
      if (e.type === 'set' && k > 0) {
        const db = DB(Math.abs(before - e.v) / top);
        if (db > maxDb) maxDb = db;
        if (db > LIMIT.step) at.push(+(e.t * 1000).toFixed(0));
      }
      cur = e.type === 'target' ? { target: e.v, t0: e.t, v0: before, tau: e.tau } : { v: e.v };
    }
  }
  return { maxDb, at };
}

/**
 * Render one SFX four ways: in-game chain (wet), dry (+ gain log), dry with late stops, dry with
 * silent new gains. The three dry renders keep their voices connected (`_cleanup` stubbed): the
 * disconnect on `onended` lands at a timing-dependent point of an offline render, which would add
 * noise (≈ −70 dB) to the differences between them.
 */
async function renderSfx(mod, name) {
  const secs = sfxSeconds(name);
  const vol = GAME_VOL[name] ?? 1;
  const play = (a) => { a._voices = 0; return a.playSfx(name, { delay: SFX_DELAY, volume: vol }); };
  const still = (a) => { a._cleanup = () => {}; return a; };
  let log = null;
  const [wet, dry, ext, leak] = await Promise.all([
    render(mod, secs, (a) => play(a)),
    render(mod, secs, (a, off) => { log = withGainLog(off, () => play(still(a))); }, { reverb: 0 }),
    render(mod, secs, (a) => withLateStops(0.6, () => play(still(a))), { reverb: 0 }),
    render(mod, secs, (a, off) => withSilentGains(off, () => play(still(a))), { reverb: 0 }),
  ]);
  return { wet, dry, ext, leak, steps: gainSteps(log) };
}

/** Music scheduling for an offline render (the voice cap reads live voices; offline none end). */
function preschedule(a, from, to) {
  for (let now = from; now < to; now += 0.175) {
    a._voices = 0;
    a._scheduleMusic(now);
  }
}

async function renderSection(mod, track, section, seconds) {
  return render(mod, seconds, (a) => {
    a.startMusic({ track, fade: 0.05 });
    if (section && section !== 'A') a.setMusicSection(section);
    preschedule(a, 0, seconds);
  });
}

async function renderStinger(mod, name, seconds) {
  return render(mod, seconds, (a) => {
    a._musicWanted = true; // the stinger alone (it is silent while the music is off)
    return a.playStinger(name);
  });
}

// ---------------------------------------------------------------------------------------------
// Dense scenes
// ---------------------------------------------------------------------------------------------

const SCENES = {
  pack: {
    title: 'Pack fight: 10 hits, swings, 2 deaths, cues over battle B',
    track: 'battle', section: 'B', at: 3, seconds: 8,
    events: [
      [0.0, 'swing', 0.8, -0.1], [0.08, 'hit', 0.9, 0.2], [0.22, 'swing', 0.8, -0.1], [0.3, 'hit', 0.9, 0.3],
      [0.45, 'swingHeavy', 0.8, 0], [0.55, 'crit', 0.9, 0.1], [0.6, 'enemyDie', 0.9, 0.25], [0.66, 'arrow', 0.8, -0.6],
      [0.8, 'arrowHit', 0.5, 0], [0.84, 'hurt', 1, 0], [0.95, 'dodge', 0.7, 0], [1.1, 'whirl', 0.9, 0],
      [1.2, 'hit', 0.9, -0.4], [1.27, 'hit', 0.9, 0.4], [1.36, 'hit', 0.9, -0.2], [1.45, 'boltHit', 1, 0.5],
      [1.52, 'hit', 0.9, 0.2], [1.6, 'enemyDie', 0.9, -0.3], [1.7, 'coin', 0.55, 0], [1.76, 'coin', 0.55, 0],
      [1.9, 'hit', 0.9, 0], [2.0, 'enemyAlert', 0.8, 0.6], [2.1, 'batScreech', 0.8, -0.5], [2.3, 'windup', 0.9, 0.3],
    ],
  },
  boss: {
    title: 'Boss phase 3: wind-up, slam, hex bursts, roar, hits over boss B',
    track: 'boss', section: 'B', at: 3, seconds: 9,
    events: [
      [0.0, 'windup', 1, 0], [0.4, 'slam', 1, 0], [0.55, 'hurt', 1, 0], [0.7, 'hexBurst', 1, -0.4], [0.85, 'hexBurst', 0.8, 0.5],
      [1.0, 'dodge', 0.7, 0], [1.05, 'perfect', 1, 0], [1.3, 'swing', 0.8, 0.1], [1.38, 'hit', 0.9, 0.1], [1.55, 'swing', 0.8, 0.1],
      [1.63, 'hit', 0.9, 0.1], [1.8, 'swingHeavy', 0.8, 0.1], [1.9, 'crit', 0.9, 0.1], [2.1, 'nova', 1, 0], [2.2, 'hit', 0.9, 0.1],
      [2.4, 'bossRoar', 1, 0], [2.6, 'rockToss', 1, 0.3], [3.0, 'boltHit', 1, 0.2], [3.2, 'hurt', 1, 0], [3.3, 'heartbeat', 0.7, 0],
    ],
  },
  stress: {
    title: 'Stress (worst case): the 12 loudest combat sounds within 0.6 s over boss B',
    track: 'boss', section: 'B', at: 3, seconds: 9,
    events: ['nova', 'bossRoar', 'slam', 'gateClose', 'perfect', 'levelup', 'playerDown', 'crit', 'hurt', 'hexBurst', 'waystone', 'windup']
      .map((n, i) => [i * 0.05, n, 1, ((i % 5) - 2) * 0.3]),
  },
  village: {
    title: 'Peaceful reference: Emberfall Evening, running steps, a chime, dialogue blips',
    track: 'emberfall', section: null, at: 9, seconds: 14,
    events: [
      ...Array.from({ length: 12 }, (_, i) => [i * 0.3, 'step', 0.55, (i % 2 ? 0.12 : -0.12)]),
      [0.5, 'chime', 0.6, 0], [1.4, 'confirm', 0.7, 0],
      ...Array.from({ length: 10 }, (_, i) => [2 + i * 0.07, 'blip', 0.22, 0]),
      [2.9, 'splash', 0.7, 0.2],
    ],
  },
};

/** Render a scene with / without its SFX (and SFX alone), sampling the compressors every 50 ms. */
async function renderScene(mod, scene, { withMusic = true, withSfx = true } = {}) {
  const { seconds, at } = scene;
  const trace = [];
  const played = [];
  const r = await render(mod, seconds, (a, off, comps) => {
    if (withMusic) {
      a.startMusic({ track: scene.track, fade: 0.05 });
      if (scene.section && scene.section !== 'A') a.setMusicSection(scene.section);
      preschedule(a, 0, seconds);
    }
    if (withSfx) {
      for (const [dt, name, vol, pan] of scene.events) {
        a._voices = 0;
        played.push(a.playSfx(name, { delay: at + dt, volume: vol, pan }));
      }
    }
    for (let t = Math.max(0.1, at - 0.6); t < Math.min(seconds - 0.01, at + 3.2); t += 0.1) {
      off.suspend(t).then(() => {
        trace.push({ t: off.currentTime, gr: comps.map((c) => c.reduction) });
        off.resume();
      });
    }
  });
  return { ...r, trace, rejected: played.filter((p) => !p).length };
}

function grStats(trace, t0, t1, k = 0) {
  const w = trace.filter((s) => s.t >= t0 && s.t < t1 && s.gr.length > k).map((s) => -s.gr[k]);
  if (!w.length) return { mean: 0, max: 0 };
  return { mean: w.reduce((s, v) => s + v, 0) / w.length, max: Math.max(...w) };
}

async function analyseScene(mod, key) {
  const sc = SCENES[key];
  const t0 = sc.at;
  const t1 = sc.at + 2.8;
  const [full, musicOnly, sfxOnly] = await Promise.all([renderScene(mod, sc), renderScene(mod, sc, { withSfx: false }), renderScene(mod, sc, { withMusic: false })]);
  const win = (x) => x.subarray(Math.floor(t0 * SR), Math.floor(t1 * SR));
  const mFull = measure(win(full.L), win(full.R));
  const mMusic = measure(win(musicOnly.L), win(musicOnly.R));
  const mSfx = measure(win(sfxOnly.L), win(sfxOnly.R));
  const grMusic = grStats(musicOnly.trace, t0, t1);
  const grFull = grStats(full.trace, t0, t1);
  const lim = grStats(full.trace, t0, t1, 1);
  const nan = measure(full.L, full.R).nan;
  return {
    key, title: sc.title,
    truePeakDb: mFull.tpDb, peakDb: mFull.peakDb,
    musicS: mMusic.sMax, fightM: mFull.mMax, sfxM: mSfx.mMax, sfxOverMusic: mSfx.mMax - mMusic.sMax,
    grMusicMean: grMusic.mean, grMusicMax: grMusic.max, grFullMean: grFull.mean, grFullMax: grFull.max,
    pumpingMean: grFull.mean - grMusic.mean, pumpingMax: grFull.max - grMusic.max,
    limiterMean: full.comps.length > 1 ? lim.mean : null, limiterMax: full.comps.length > 1 ? lim.max : null,
    rejected: full.rejected, nan,
    render: full,
  };
}

// ---------------------------------------------------------------------------------------------
// Victory sequence: boss B → victory stinger → level track, through the real CombatMusic
// ---------------------------------------------------------------------------------------------

/** Pitch classes sounding at `beat` in an event list ({beat, kind, midi|notes, dur}). */
function pcsAt(events, beat, beatSec) {
  const out = new Set();
  for (const e of events) {
    if (e.beat > beat) break;
    let dur = e.dur ?? 1;
    if (e.kind === 'harp') dur = 0.6 / beatSec; // a plucked note rings ~0.6 s
    if (e.kind === 'bell') dur = 1.5 / beatSec;
    if (e.kind === 'pad') dur = (e.dur ?? 4) + 0.9 / beatSec; // + release
    if (e.kind === 'taiko') continue;
    if (beat < e.beat + dur) for (const m of e.notes ?? [e.midi]) out.add(((m % 12) + 12) % 12);
  }
  return out;
}
const clashes = (a, b) => {
  let n = 0;
  for (const x of a) for (const y of b) { const d = (x - y + 12) % 12; if (d === 1 || d === 11) n++; }
  return n;
};

/**
 * Render the in-game victory sequence and analyse it: how loud the playing boss track stays under
 * the stinger, how much of that time the two clash (minor seconds between their sounding pitch
 * classes, averaged over 16 entry points into the boss loop), and when the level track comes in
 * relative to the stinger's last chord.
 */
async function analyseVictory(mod, musicMod) {
  const T_VICTORY = 4;
  const seconds = 20;
  let stingerRef = null;
  let bossRef = null;
  let old = null;
  let duck = null;
  const log = [];
  const r = await render(mod, seconds, (a, off) => {
    const music = new musicMod.CombatMusic(a, { music: true });
    a.startMusic({ track: 'emberfall', fade: 0.05 });
    const step = 0.1;
    let done = false;
    for (let t = step; t < seconds - 0.01; t += step) {
      off.suspend(t).then(() => {
        const now = off.currentTime;
        if (!done && now >= T_VICTORY) {
          done = true;
          old = a._music;
          music.victory();
          stingerRef = a._stingers?.get('victory') ?? null;
          log.push({ t: now, ev: 'victory' });
        }
        const prev = a.musicTrack;
        music.update(step, false, !done);
        if (!done && now < 0.2) music.setSection('B');
        if (old && duck === null && now >= T_VICTORY + 2.5) duck = old.out.gain.value; // the boss track's gain under the stinger
        if (a.musicTrack !== prev) log.push({ t: +now.toFixed(2), ev: `track ${a.musicTrack}` });
        a._voices = 0;
        a._scheduleMusic(now);
        off.resume();
      });
    }
    bossRef = a._combatTrack?.('boss') ?? null;
  });
  const st = stingerRef;
  const out = { log, render: r, duck, stingerBpm: st?.bpm ?? null, stingerSeconds: st ? (st.lengthBeats * 60) / st.bpm : null };
  const levelStart = log.find((e) => e.ev === 'track emberfall');
  out.levelTrackAt = levelStart ? +(levelStart.t - T_VICTORY).toFixed(2) : null;
  if (st && bossRef) {
    // the stinger's last chord: the latest pad start + its duration
    const beat = 60 / st.bpm;
    const lastPad = st.events.filter((e) => e.kind === 'pad').reduce((m, e) => Math.max(m, (e.beat + e.dur) * beat), 0);
    out.stingerChordEnds = +lastPad.toFixed(2);
    // symbolic clash with boss section B (averaged over 16 entry points)
    const sec = bossRef.sections.B;
    const bb = 60 / bossRef.bpm;
    let clashT = 0;
    let total = 0;
    for (let k = 0; k < 16; k++) {
      const off0 = (k / 16) * sec.lengthBeats; // entry beat in the boss loop
      for (let t = 0; t < lastPad; t += 0.125) {
        const sp = pcsAt(st.events, t / beat, beat);
        const tb = (off0 + t / bb) % sec.lengthBeats;
        const tp = pcsAt(sec.events, tb, bb);
        total++;
        if (sp.size && clashes(sp, tp) > 0) clashT++;
      }
    }
    out.clashShare = clashT / total;
  }
  // loudness of the old track under the stinger window vs before: from the render
  const seg = (t0, t1) => measure(r.L.subarray(Math.floor(t0 * SR), Math.floor(t1 * SR)), r.R.subarray(Math.floor(t0 * SR), Math.floor(t1 * SR)));
  out.bossBefore = seg(1.5, T_VICTORY).sMax;
  out.duringStinger = seg(T_VICTORY + 0.5, T_VICTORY + 6).sMax;
  out.nan = measure(r.L, r.R).nan;
  return out;
}

// ---------------------------------------------------------------------------------------------
// Identity of the peaceful audio
// ---------------------------------------------------------------------------------------------

function hashFloats(...arrays) {
  let h = 0x811c9dc5;
  for (const a of arrays) {
    const u = new Uint32Array(a.buffer, a.byteOffset, a.length);
    for (let i = 0; i < u.length; i++) {
      h ^= u[i];
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(16).padStart(8, '0');
}
function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Renders of the peaceful audio of module `mod`: the 8 SFX, 16 s of the song, 6 s of ambience —
 * with voices kept connected (`_cleanup` stubbed: its `onended` disconnects land at a
 * timing-dependent point of an offline render) and the voice cap reset while scheduling (offline,
 * no voice ends before the render starts), so two runs agree to ~1e-7.
 */
async function peacefulRenders(mod) {
  const a = new mod.AudioSystem();
  const events = hashString(JSON.stringify([a._intro, a._main]));
  a.dispose();
  const still = (s) => { s._cleanup = () => {}; return s; };
  const schedule = (s, secs) => {
    for (let now = 0; now < secs; now += 0.175) {
      s._voices = 0;
      s._scheduleMusic(now);
      s._scheduleAmbience(now);
    }
  };
  const sfx = {};
  for (const name of mod.SFX_NAMES) sfx[name] = await render(mod, sfxSeconds(name), (s) => still(s).playSfx(name, { delay: SFX_DELAY, volume: GAME_VOL[name] }));
  const song = await render(mod, 16, (s) => { still(s).startMusic({ fade: 1 }); schedule(s, 16); });
  const ambience = await render(mod, 6, (s) => { still(s).setAmbience({ wind: 0.5, birds: 0.7, crickets: 0.5, fire: 0.6, water: 0.6 }); schedule(s, 6); });
  return { events, sfx, song, ambience };
}

/** Largest sample difference of two stereo renders (offline renders repeat to ~1e-7, not bit for bit). */
function maxDiff(a, b) {
  if (a.L.length !== b.L.length) return Infinity;
  let m = 0;
  for (let i = 0; i < a.L.length; i++) m = Math.max(m, Math.abs(a.L[i] - b.L[i]), Math.abs(a.R[i] - b.R[i]));
  return m;
}
const SAME = 1e-5; // −100 dBFS: "sample-identical" (an offline render repeats to ~1e-7, the song's reverb to ~1e-5)

/** Fingerprint numbers of the peaceful audio of module `mod` (for PEACEFUL_GOLDEN). */
async function peacefulPrint(mod) {
  const p = await peacefulRenders(mod);
  const num = (r, music = false) => {
    const m = measure(r.L, r.R, { music });
    return music ? { integrated: +m.integrated.toFixed(3), peakDb: +m.peakDb.toFixed(3) } : { peakDb: +m.peakDb.toFixed(3), mMax: +m.mMax.toFixed(3) };
  };
  return { events: p.events, sfx: Object.fromEntries(Object.entries(p.sfx).map(([n, r]) => [n, num(r)])), song: num(p.song, true), ambience: num(p.ambience) };
}

// ---------------------------------------------------------------------------------------------
// The full analysis
// ---------------------------------------------------------------------------------------------

const MUSIC_ROWS = [
  ['emberfall', null, 24, 'Emberfall Evening (intro + main, reference)'],
  ['battle', 'A', 16, 'battle A'],
  ['battle', 'B', 16, 'battle B'],
  ['boss', 'A', 15, 'boss A (phase 1)'],
  ['boss', 'B', 15, 'boss B (phases 2–3)'],
];

/**
 * Render and measure everything: every SFX (combat and peaceful), the music sections, the
 * stingers, the dense scenes and the victory sequence; then flag() it.
 * @param {typeof CUR_AUDIO} [mod]  the AudioSystem module to measure (default: the current one)
 * @param {typeof CUR_MUSIC} [musicMod]  the CombatMusic module (default: the current one)
 * @param {{ onProgress?: (message: string) => void, keepRenders?: boolean }} [opts]
 *   keepRenders: keep the samples of every render for the waveform view (true)
 */
async function analyse(mod = CUR_AUDIO, musicMod = CUR_MUSIC, { onProgress = () => {}, keepRenders = true } = {}) {
  const t0 = performance.now();
  const out = { sfx: {}, ref: {}, music: {}, stingers: {}, scenes: {}, victory: null, renders: {} };
  const all = [...mod.SFX_NAMES.map((n) => ['ref', n]), ...mod.COMBAT_SFX_NAMES.map((n) => ['sfx', n])];
  let k = 0;
  const one = async ([group, name]) => {
    const r = await renderSfx(mod, name);
    const m = measure(r.wet.L, r.wet.R, { dry: r.dry, ext: r.ext, leak: r.leak, steps: r.steps });
    m.volume = GAME_VOL[name] ?? 1;
    m.role = group === 'ref' ? 'ref' : ROLE[name] ?? 'cue';
    out[group][name] = m;
    if (keepRenders) out.renders[name] = { L: r.wet.L, R: r.wet.R, marks: { onset: m.onset, end: m.end, cut: m.cutAt } };
    onProgress(`rendered ${name} (${++k}/${all.length})`);
  };
  for (let i = 0; i < all.length; i += 4) await Promise.all(all.slice(i, i + 4).map(one));
  // (keep the table order: peaceful first, then the combat list)
  for (const g of ['ref', 'sfx']) out[g] = Object.fromEntries(all.filter(([gg]) => gg === g).map(([, n]) => [n, out[g][n]]));
  onProgress('rendering the music sections');
  await Promise.all(MUSIC_ROWS.map(async ([track, section, secs, title]) => {
    const r = await renderSection(mod, track, section, secs);
    const m = measure(r.L.subarray(Math.floor(1 * SR)), r.R.subarray(Math.floor(1 * SR)), { music: true });
    m.title = title;
    const key = section ? `${track} ${section}` : track;
    out.music[key] = m;
    if (keepRenders) out.renders[key] = { L: r.L, R: r.R };
  }));
  out.music = Object.fromEntries(MUSIC_ROWS.map(([track, section]) => (section ? `${track} ${section}` : track)).map((key) => [key, out.music[key]]));
  for (const [name, secs] of [['victory', 13], ['levelup', 5]]) {
    onProgress(`rendering stinger ${name}`);
    const r = await renderStinger(mod, name, secs);
    const m = measure(r.L, r.R, { music: true });
    out.stingers[name] = m;
    if (keepRenders) out.renders[`stinger ${name}`] = { L: r.L, R: r.R };
  }
  for (const key of Object.keys(SCENES)) {
    onProgress(`rendering scene ${key}`);
    const s = await analyseScene(mod, key);
    if (keepRenders) out.renders[`scene ${key}`] = { L: s.render.L, R: s.render.R, marks: { onset: SCENES[key].at } };
    delete s.render;
    out.scenes[key] = s;
  }
  onProgress('rendering the victory sequence');
  const v = await analyseVictory(mod, musicMod);
  if (keepRenders) out.renders['victory sequence'] = { L: v.render.L, R: v.render.R, marks: { onset: 4 } };
  delete v.render;
  out.victory = v;
  out.ms = Math.round(performance.now() - t0);
  flag(out);
  return out;
}

/** Flags per sound + the checks list. */
function flag(res) {
  const refs = Object.values(res.ref);
  const refM = refs.map((m) => m.mMax).sort((a, b) => a - b);
  const median = (refM[3] + refM[4]) / 2;
  const refHarsh = Math.max(...refs.map((m) => m.harshDb));
  res.refMedian = median;
  res.refHarsh = refHarsh;
  const songI = res.music.emberfall?.integrated ?? -20;
  res.songI = songI;
  for (const [group, set] of [['ref', res.ref], ['sfx', res.sfx]]) {
    for (const [name, m] of Object.entries(set)) {
      const f = [];
      m.rel = m.mMax - songI;
      if (m.tpDb > LIMIT.truePeak) f.push(['bad', 'clip']);
      if (m.cutDb > LIMIT.cut) f.push(['bad', 'cut']);
      if (m.stepDb > LIMIT.step) f.push(['bad', 'step']);
      if (m.leakDb > LIMIT.leak) f.push(['bad', 'leak']);
      if (m.startDb > LIMIT.startLevel) f.push(['warn', 'hard start']);
      if (m.harshDb > refHarsh + LIMIT.harshOver) f.push(['bad', 'harsh']);
      if (m.subShare > LIMIT.subShare) f.push(['bad', 'sub']);
      if (m.dcDb > LIMIT.dc) f.push(['warn', 'dc']);
      if (m.crestDb > LIMIT.crestHi) f.push(['warn', 'spiky']);
      if (m.nan) f.push(['bad', 'NaN']);
      if (group === 'sfx') {
        const [lo, hi] = WINDOW[m.role];
        if (m.rel > hi) f.push(['bad', 'loud']);
        if (m.rel < lo) f.push(['bad', 'quiet']);
      }
      m.flags = f;
    }
  }
  for (const m of [...Object.values(res.music), ...Object.values(res.stingers)]) {
    const f = [];
    if (m.tpDb > LIMIT.truePeak) f.push(['bad', 'clip']);
    if (m.subShare > LIMIT.subShare) f.push(['bad', 'sub']);
    if (m.dcDb > LIMIT.dc) f.push(['warn', 'dc']);
    if (m.nan) f.push(['bad', 'NaN']);
    m.rel = m.integrated - songI;
    m.flags = f;
  }
  const checks = {};
  const add = (label, ok, info) => { checks[label] = { ok: !!ok, info }; };
  const sfx = Object.entries(res.sfx);
  const bad = (tag) => sfx.filter(([, m]) => m.flags.some(([lvl, t]) => lvl === 'bad' && t === tag)).map(([n]) => n);
  add('every combat SFX, track, stinger and scene renders finite (0 NaN)',
    [...sfx.map(([, m]) => m.nan), ...Object.values(res.music).map((m) => m.nan), ...Object.values(res.stingers).map((m) => m.nan),
      ...Object.values(res.scenes).map((s) => s.nan), res.victory.nan].every((n) => n === 0));
  add(`no combat SFX clips (true peak ≤ ${LIMIT.truePeak} dBTP)`, !bad('clip').length, bad('clip'));
  add(`no truncation clicks (stop() cuts ≤ ${LIMIT.cut} dB under the peak)`, !bad('cut').length, bad('cut'));
  add(`no gain steps (≤ ${LIMIT.step} dB) and no sound before its envelope (≤ ${LIMIT.leak} dB)`, !bad('step').length && !bad('leak').length, { step: bad('step'), leak: bad('leak') });
  add('combat SFX loudness inside the role windows', !bad('loud').length && !bad('quiet').length, { loud: bad('loud'), quiet: bad('quiet') });
  add(`no harsh combat SFX (2–6 kHz level ≤ the brightest peaceful sound + ${LIMIT.harshOver} dB)`, !bad('harsh').length, bad('harsh'));
  add(`no sub-bass heavy combat SFX (< 40 Hz share ≤ ${LIMIT.subShare * 100} %)`, !bad('sub').length, bad('sub'));
  add('combat tracks within ±3 LU of the song, no clipping',
    ['battle A', 'battle B', 'boss A', 'boss B'].every((k) => res.music[k] && Math.abs(res.music[k].rel) <= 3 && res.music[k].tpDb <= LIMIT.truePeak),
    Object.fromEntries(Object.entries(res.music).map(([k, m]) => [k, +m.rel.toFixed(1)])));
  const scenes = res.scenes;
  const vil = scenes.village;
  add(`stress scene: no clipping (true peak ≤ ${LIMIT.truePeak} dBTP)`, scenes.stress.truePeakDb <= LIMIT.truePeak, { tp: +scenes.stress.truePeakDb.toFixed(1) });
  for (const key of ['pack', 'boss']) {
    const s = scenes[key];
    add(`${key} scene: no clipping, music pushed down ≤ ${LIMIT.pumping} dB more than the peaceful scene`,
      s.truePeakDb <= LIMIT.truePeak && s.pumpingMean - vil.pumpingMean <= LIMIT.pumping,
      { tp: +s.truePeakDb.toFixed(1), pumpingMean: +s.pumpingMean.toFixed(1), villagePumping: +vil.pumpingMean.toFixed(1), rejected: s.rejected });
  }
  const v = res.victory;
  add('victory: the boss track does not sound under the stinger (≤ −30 dB) and the level track waits for its last chord',
    v.duck !== null && DB(v.duck) <= -30 && v.levelTrackAt !== null && v.levelTrackAt >= v.stingerChordEnds - 0.6,
    { duckDb: v.duck !== null ? +DB(v.duck).toFixed(1) : null, clashShare: v.clashShare, levelTrackAt: v.levelTrackAt, stingerChordEnds: v.stingerChordEnds });
  res.checks = checks;
  res.allOk = Object.values(checks).every((c) => c.ok);
}

// ---------------------------------------------------------------------------------------------
// Page: tables, waveform + spectrogram, live playback
// ---------------------------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids) e.append(k);
  return e;
};

/**
 * A measure() result plus the fields analyse() (volume, role) and flag() (rel, flags) add to it.
 * @typedef Measured
 * @type {ReturnType<typeof measure> & { volume?: number, role?: string, rel?: number,
 *   flags?: [string, string][] }}
 */
/**
 * Table columns of a sound's measures.
 * @type {[heading: string, tooltip: string, cell: (m: Measured) => string][]}
 */
const COLS = [
  ['vol', 'Call volume in game (≤ 6 u from the player)', (m) => fmt(m.volume, 2)],
  ['dur s', 'Active length (onset to −40 dB)', (m) => fmt(m.seconds, 2)],
  ['peak', 'Sample peak at the output, dBFS', (m) => fmt(m.peakDb)],
  ['TP', 'True peak (4× oversampled), dBTP — above −1 flags "clip"', (m) => fmt(m.tpDb)],
  ['M max', 'Momentary loudness max (BS.1770, 400 ms), LUFS', (m) => fmt(m.mMax)],
  ['Δ song', 'M max relative to the integrated loudness of Emberfall Evening (LU); the role window in brackets', (m) => `${fmt(m.rel)}${m.role && m.role !== 'ref' ? ` [${WINDOW[m.role].join('…')}]` : ''}`],
  ['crest', 'Peak over the RMS of the active part, dB', (m) => fmt(m.crestDb)],
  ['DC', 'Mean over the active part, dBFS', (m) => fmt(m.dcDb, 0)],
  ['atk ms', 'Onset to −6 dB of the peak', (m) => fmt(m.attackMs, 1)],
  ['start', 'Level of the first 0.25 ms relative to the peak, dB (instant onsets click)', (m) => fmt(m.startDb, 0)],
  ['cut', 'Tail removed by stop(), dB under the peak (> −50 flags "cut")', (m) => fmt(m.cutDb, 0)],
  ['step', 'Largest jump of a gain envelope (setValueAtTime away from its current value), dB of that envelope’s max (> −40 flags "step"); times in ms', (m) => `${fmt(m.stepDb, 0)}${m.stepAt?.length ? ` @${m.stepAt.slice(0, 3).join(',')}` : ''}`],
  ['leak', 'Sound before its envelope began (a gain left at its default 1.0), dB under the peak (> −60 flags "leak")', (m) => fmt(m.leakDb, 0)],
  ['2–6k %', 'Share of energy in 2–6 kHz', (m) => fmt(m.harshShare * 100, 0)],
  ['2–6k dB', 'Loudest 400 ms of the 2–6 kHz band, dBFS', (m) => fmt(m.harshDb)],
  ['<40 %', 'Share of energy below 40 Hz', (m) => fmt(m.subShare * 100, 1)],
];

let selected = null;
let results = null;

function renderTables(res) {
  const t = $('qa');
  t.innerHTML = '';
  const head = el('tr', {}, el('th', { className: 'name', textContent: 'sound', title: 'click a row to draw its render' }), el('th', { textContent: '' }),
    el('th', { className: 'name', textContent: 'role' }), ...COLS.map(([h, tip]) => el('th', { textContent: h, title: tip })), el('th', { className: 'name', textContent: 'flags' }));
  t.append(el('thead', {}, head));
  const body = el('tbody');
  const group = (title, set) => {
    body.append(el('tr', { className: 'group' }, el('td', { colSpan: COLS.length + 4, textContent: title })));
    for (const [name, m] of Object.entries(set)) {
      const tr = el('tr', { className: 'row' });
      tr.dataset.name = name;
      const btn = el('button', { textContent: '▶', title: 'play live' });
      btn.onclick = (e) => { e.stopPropagation(); play(name); };
      tr.append(el('td', { className: 'name', textContent: name }), el('td', {}, btn), el('td', { className: 'name', textContent: m.role }));
      for (const [, , get] of COLS) tr.append(el('td', { textContent: get(m) }));
      tr.append(el('td', { className: 'flags', innerHTML: m.flags.map(([lvl, f]) => `<span class="f ${lvl}">${f}</span>`).join('') || '<span class="f ok">ok</span>' }));
      tr.onclick = () => select(name);
      body.append(tr);
    }
  };
  group(`Combat SFX (${Object.keys(res.sfx).length})`, res.sfx);
  group('Peaceful SFX (reference, unchanged)', res.ref);
  t.append(body);

  const mt = $('music');
  mt.innerHTML = '';
  mt.append(el('thead', {}, el('tr', {}, ...['section', '', 'I LUFS', 'Δ song LU', 'S max', 'peak', 'TP', 'crest', 'DC', '2–6k %', '<40 %', 'flags'].map((h, i) => el('th', { className: i === 0 || i === 11 ? 'name' : '', textContent: h })))));
  const mb = el('tbody');
  const row = (key, m, playKey) => {
    const tr = el('tr', { className: 'row' });
    tr.dataset.name = key;
    const btn = el('button', { textContent: '▶', title: 'play live' });
    btn.onclick = (e) => { e.stopPropagation(); play(playKey); };
    tr.append(el('td', { className: 'name', textContent: m.title ?? key }), el('td', {}, btn));
    for (const v of [fmt(m.integrated), fmt(m.rel), fmt(m.sMax), fmt(m.peakDb), fmt(m.tpDb), fmt(m.crestDb), fmt(m.dcDb, 0), fmt(m.harshShare * 100, 0), fmt(m.subShare * 100, 1)]) tr.append(el('td', { textContent: v }));
    tr.append(el('td', { className: 'flags', innerHTML: m.flags.map(([lvl, f]) => `<span class="f ${lvl}">${f}</span>`).join('') || '<span class="f ok">ok</span>' }));
    tr.onclick = () => select(key);
    mb.append(tr);
  };
  for (const [k, m] of Object.entries(res.music)) row(k, m, `music ${k}`);
  for (const [k, m] of Object.entries(res.stingers)) row(`stinger ${k}`, { ...m, title: `stinger ${k} (alone)` }, `stinger ${k}`);
  mt.append(mb);

  const lines = [];
  for (const s of Object.values(res.scenes)) {
    lines.push(`${s.title}`);
    lines.push(`  output peak ${fmt(s.peakDb)} dBFS · true peak ${fmt(s.truePeakDb)} dBTP · plays rejected (min interval) ${s.rejected}`);
    lines.push(`  music alone S ${fmt(s.musicS)} LUFS · SFX alone M ${fmt(s.sfxM)} (${fmt(s.sfxOverMusic)} LU over the music) · together M ${fmt(s.fightM)}`);
    lines.push(`  master compressor reduction: music alone ${fmt(s.grMusicMean)} dB mean / ${fmt(s.grMusicMax)} max · with the SFX ${fmt(s.grFullMean)} / ${fmt(s.grFullMax)} → music pushed down ${fmt(s.pumpingMean)} dB mean, ${fmt(s.pumpingMax)} max`
      + (s.limiterMean !== null ? ` · combat bus limiter ${fmt(s.limiterMean)} mean / ${fmt(s.limiterMax)} max` : ''));
    lines.push('');
  }
  const v = res.victory;
  lines.push('Victory sequence (boss B → CombatMusic.victory() at 4 s → level track)');
  lines.push(`  stinger ${fmt(v.stingerSeconds, 2)} s at ${v.stingerBpm} bpm, last chord until ${fmt(v.stingerChordEnds, 2)} s · level track requested at +${fmt(v.levelTrackAt, 2)} s`);
  const duckText = v.duck === null ? '—' : v.duck < 1e-6 ? '−∞ dB (faded out and ended)' : `${fmt(DB(v.duck))} dB`;
  lines.push(`  boss track under the stinger: ${duckText} · the two harmonies clash (minor seconds, C phrygian vs D major) during ${fmt(v.clashShare * 100, 0)} % of the stinger — audible only while the track sounds under it`);
  lines.push(`  loudness: boss before S ${fmt(v.bossBefore)} LUFS · during the stinger S ${fmt(v.duringStinger)} LUFS`);
  lines.push(`  events: ${v.log.map((e) => `${fmt(e.t, 2)} ${e.ev}`).join(' · ')}`);
  $('mix').textContent = lines.join('\n');

  $('checks').innerHTML = Object.entries(res.checks).map(([k, c]) => `<span class="${c.ok ? 'ok' : 'bad'}">${c.ok ? '✓' : '✗'} ${k}</span>${c.ok ? '' : `  ${JSON.stringify(c.info)}`}`).join('\n')
    + `\n\nreference: peaceful SFX median M ${fmt(res.refMedian)} LUFS · loudest peaceful 2–6 kHz band ${fmt(res.refHarsh)} dBFS · song I ${fmt(res.songI)} LUFS · analysis ${res.ms} ms`;
}

function drawRender(name) {
  const r = results?.renders[name];
  const wave = /** @type {HTMLCanvasElement} */ ($('wave'));
  const spec = /** @type {HTMLCanvasElement} */ ($('spec'));
  const gw = wave.getContext('2d');
  const gs = spec.getContext('2d');
  gw.fillStyle = '#07060d';
  gw.fillRect(0, 0, wave.width, wave.height);
  gs.fillStyle = '#07060d';
  gs.fillRect(0, 0, spec.width, spec.height);
  if (!r) return;
  // SFX: show the active span (onset − 50 ms … end + 30 %, at least 0.6 s); music and scenes: all
  let i0 = 0;
  let i1 = r.L.length;
  if (r.marks?.end > 0) {
    const t0 = Math.max(0, r.marks.onset - 0.05);
    const t1 = Math.max(t0 + 0.6, r.marks.end + 0.3 * (r.marks.end - r.marks.onset) + 0.05);
    i0 = Math.floor(t0 * SR);
    i1 = Math.min(r.L.length, Math.ceil(t1 * SR));
  }
  const n = i1 - i0;
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) mono[i] = (r.L[i0 + i] + r.R[i0 + i]) / 2;
  const label = (g, text, x, y) => {
    g.font = '13px Georgia';
    const w = g.measureText(text).width;
    g.fillStyle = 'rgba(7,6,13,0.8)';
    g.fillRect(x - 4, y - 13, w + 8, 18);
    g.fillStyle = '#f3e2b5';
    g.fillText(text, x, y);
  };
  // waveform: min / max per column, dB envelope (−60 … 0) as a line
  const W = wave.width;
  const H = wave.height;
  const per = n / W;
  gw.strokeStyle = 'rgba(201,164,92,0.25)';
  for (const db of [-6, -20, -40]) {
    const y = H * (-db / 60);
    gw.beginPath(); gw.moveTo(0, y); gw.lineTo(W, y); gw.stroke();
  }
  gw.fillStyle = '#c9a45c';
  const env = [];
  for (let x = 0; x < W; x++) {
    let lo = 0;
    let hi = 0;
    let s = 0;
    const i0 = Math.floor(x * per);
    const i1 = Math.max(i0 + 1, Math.floor((x + 1) * per));
    for (let i = i0; i < i1; i++) {
      const v = mono[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
      s += v * v;
    }
    gw.fillRect(x, H / 2 - hi * (H / 2), 1, Math.max(1, (hi - lo) * (H / 2)));
    env.push(Math.max(-60, DB(Math.sqrt(s / (i1 - i0)))));
  }
  gw.strokeStyle = '#7fd0ff';
  gw.beginPath();
  env.forEach((db, x) => (x ? gw.lineTo(x, H * (-db / 60)) : gw.moveTo(x, H * (-db / 60))));
  gw.stroke();
  const seconds = n / SR;
  const tStart = i0 / SR;
  const mark = (t, color) => {
    if (!(t >= tStart && t <= tStart + seconds)) return;
    const x = ((t - tStart) / seconds) * W;
    gw.strokeStyle = color;
    gw.beginPath(); gw.moveTo(x, 0); gw.lineTo(x, H); gw.stroke();
  };
  mark(r.marks?.onset, '#a8e07a');
  mark(r.marks?.cut, '#ff8a70');
  label(gw, `${name} · ${tStart.toFixed(2)}–${(tStart + seconds).toFixed(2)} s · waveform (gold) · RMS envelope 0 … −60 dB (blue) · onset (green) · last stop (red)`, 8, 17);
  // spectrogram (log frequency 30 Hz … 16 kHz)
  const N = 2048;
  const SW = spec.width;
  const SH = spec.height;
  const hop = Math.max(32, Math.floor(Math.max(0, n - N) / SW));
  const frames = Math.min(SW, Math.max(1, Math.floor((n - N) / hop)));
  const img = gs.createImageData(SW, SH);
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  const win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  const fMin = 30;
  const fMax = 16000;
  const colW = SW / Math.max(1, frames);
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < N; i++) { re[i] = (mono[f * hop + i] ?? 0) * win[i]; im[i] = 0; }
    fft(re, im);
    for (let y = 0; y < SH; y++) {
      const freq = fMin * (fMax / fMin) ** (1 - y / (SH - 1));
      const bin = Math.min(N / 2 - 1, Math.round((freq / SR) * N));
      const mag = (Math.hypot(re[bin], im[bin]) * 4) / N;
      const v = Math.min(1, Math.max(0, (DB(mag) + 90) / 72));
      const [cr, cg, cb] = heat(v);
      for (let x = Math.floor(f * colW); x < Math.floor((f + 1) * colW); x++) {
        const o = (y * SW + x) * 4;
        img.data[o] = cr; img.data[o + 1] = cg; img.data[o + 2] = cb; img.data[o + 3] = 255;
      }
    }
  }
  gs.putImageData(img, 0, 0);
  gs.font = '12px Georgia';
  for (const [fq, text] of /** @type {[number, string][]} */ ([[40, '40 Hz'], [2000, '2 kHz'], [6000, '6 kHz']])) {
    const y = (1 - Math.log(fq / fMin) / Math.log(fMax / fMin)) * (SH - 1);
    gs.strokeStyle = 'rgba(127,208,255,0.45)';
    gs.beginPath(); gs.moveTo(0, y); gs.lineTo(SW, y); gs.stroke();
    gs.fillStyle = '#7fd0ff';
    gs.fillText(text, SW - 48, y - 3);
  }
  label(gs, 'spectrogram · 30 Hz – 16 kHz (log) · −90 … −18 dB', 8, 17);
}

function heat(v) {
  const stops = [[7, 6, 13], [60, 20, 70], [201, 100, 60], [255, 210, 120], [255, 250, 225]];
  const x = v * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  return stops[i].map((c, k) => Math.round(c + (stops[i + 1][k] - c) * f));
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

function select(name) {
  selected = name;
  for (const tr of /** @type {NodeListOf<HTMLTableRowElement>} */ (document.querySelectorAll('tr.row'))) tr.classList.toggle('sel', tr.dataset.name === name);
  drawRender(results?.renders[name] ? name : name.replace(/^music /, ''));
  const m = results?.sfx[name] ?? results?.ref[name] ?? results?.music[name] ?? results?.stingers[name.replace(/^stinger /, '')] ?? null;
  const detail = $('detail');
  if (!m) {
    detail.textContent = results?.renders[name] ? `${name}\n\n(see the dense-mix section below)` : `${name}: no render`;
    return name;
  }
  const lines = [`${name}${m.role ? ` · ${m.role}` : ''}${m.volume !== undefined ? ` · volume ${m.volume}` : ''}`, ''];
  for (const [h, , get] of COLS) lines.push(`${h.padEnd(8)} ${String(get(m))}`);
  if (m.integrated !== null && m.integrated !== undefined) lines.push(`${'I LUFS'.padEnd(8)} ${fmt(m.integrated)}`);
  lines.push('', `flags: ${m.flags.map(([, f]) => f).join(', ') || 'none'}`, '', '(hover a column heading of the table for its meaning)');
  detail.textContent = lines.join('\n');
  return name;
}

// ---- live playback ----------------------------------------------------------------------------

let live = null;
let liveMusic = null;
let rafOn = false;
function liveAudio() {
  if (!live) live = new CUR_AUDIO.AudioSystem({ volume: 0.6 });
  return live;
}

function loop() {
  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (liveMusic) liveMusic.cm.update(dt, false, liveMusic.boss());
    requestAnimationFrame(tick);
  };
  if (!rafOn) { rafOn = true; requestAnimationFrame(tick); }
}

/** Play a sound, a music section, a stinger or a scene on the live AudioSystem. */
async function play(name) {
  const a = liveAudio();
  const ok = await a.unlock();
  $('status').textContent = ok ? `audio ready · ${name}` : 'audio unavailable';
  if (!ok) return false;
  loop();
  if (GAME_VOL[name] !== undefined) return a.playSfx(name, { volume: GAME_VOL[name] });
  const [kind, key, sec] = name.split(' ');
  if (kind === 'music') {
    liveMusic = null;
    a.startMusic({ track: key, fade: 1 });
    if (sec) a.setMusicSection(sec);
    return true;
  }
  if (name === 'stop') {
    liveMusic = null;
    a.stopMusic({ fade: 1 });
    return true;
  }
  if (kind === 'stinger' && key === 'levelup') {
    if (!a.musicPlaying) a.startMusic({ track: 'emberfall', fade: 1 });
    return a.playStinger('levelup');
  }
  if (kind === 'stinger' || name === 'victory sequence') {
    // the game's sequence: boss B for 4 s, then CombatMusic.victory() → stinger → level track
    const cm = new CUR_MUSIC.CombatMusic(a, { music: true });
    let boss = true;
    liveMusic = { cm, boss: () => boss };
    if (!a.musicPlaying) a.startMusic({ track: 'emberfall', fade: 0.5 });
    cm.update(0, false, true);
    cm.setSection('B');
    setTimeout(() => { boss = false; cm.victory(); }, 4000);
    return true;
  }
  if (kind === 'scene') {
    const sc = SCENES[key];
    liveMusic = null;
    a.startMusic({ track: sc.track, fade: 0.5 });
    if (sc.section && sc.section !== 'A') a.setMusicSection(sc.section);
    for (const [dt, n, vol, pan] of sc.events) a.playSfx(n, { delay: 2 + dt, volume: vol, pan });
    return true;
  }
  return false;
}

function buildBars() {
  const mb = $('musicBar');
  const btn = (label, key) => {
    const b = el('button', { textContent: label });
    b.onclick = () => play(key);
    return b;
  };
  mb.append(btn('Emberfall Evening', 'music emberfall'), btn('battle A', 'music battle A'), btn('battle B', 'music battle B'),
    btn('boss A', 'music boss A'), btn('boss B', 'music boss B'), btn('victory (boss → stinger → level track)', 'victory sequence'),
    btn('levelup stinger', 'stinger levelup'), btn('stop music', 'stop'));
  const sb = $('sceneBar');
  for (const key of Object.keys(SCENES)) {
    const b = el('button', { textContent: `scene: ${key}`, title: SCENES[key].title });
    b.onclick = () => play(`scene ${key}`);
    sb.append(b);
    const v = el('button', { textContent: 'view', title: 'draw the offline render of this scene' });
    v.onclick = () => select(`scene ${key}`);
    sb.append(v);
  }
  const vb = el('button', { textContent: 'view victory sequence' });
  vb.onclick = () => select('victory sequence');
  sb.append(vb);
}

function buildLegend() {
  const items = [
    '<b>Settings</b>: master 0.6, sfx 0.85, music 0.5, reverb 0.32 (the game\'s), 44.1 kHz; each SFX at its in-game call volume (the "vol" column), panned centre, pitch 1.',
    '<b>Loudness</b>: BS.1770 K-weighted; "M max" = loudest 400 ms, "S" = loudest 3 s, "I" = gated integrated. "Δ song" compares a sound with the integrated loudness of "Emberfall Evening" (the combat tracks sit 1–3 LU above it); each combat role has a window: feedback −10…+1, the player’s actions −16…−3, enemy cues −16…−2, big moments −8…+2.5, loot −17…−2 LU.',
    '<b>Clicks</b>: "cut" renders each sound again with every <code>stop()</code> 0.6 s later and measures what the stop removed; "step" evaluates every gain envelope and finds jumps (a re-trigger dropping a ringing voice to 0); "leak" renders it with every new gain starting at 0 and measures what sounded before its envelope began. "start" is the level of the first 0.25 ms — hits start hard on purpose.',
    '<b>Spectrum</b>: "2–6 kHz" is where harshness lives (flagged when it holds most of a sound\'s energy AND is louder than the brightest peaceful sound there); "&lt;40 Hz" is sub-bass that small speakers cannot play and that makes the master compressor pump.',
    '<b>Dense mix</b>: the master compressor\'s gain reduction sampled every 50 ms, with and without the SFX; the difference is how far the fight pushes the music down.',
    '<b>Still for a human</b>: whether each sound reads as what it is (a hit, a parry, a bat), fatigue over a long fight, the balance on laptop speakers vs headphones, the character of the tracks and whether the victory fanfare feels earned. These numbers only rule out the technical faults.',
  ];
  $('legend').innerHTML = items.map((s) => `<li>${s}</li>`).join('');
}

// ---- compare with another module (e.g. the previous AudioSystem) ------------------------------

/** Analyse another AudioSystem (and CombatMusic) module and diff it against the current one. */
async function compare(audioUrl, musicUrl = null) {
  const mod = await import(/* @vite-ignore */ audioUrl);
  const mm = musicUrl ? await import(/* @vite-ignore */ musicUrl) : CUR_MUSIC;
  const other = await analyse(mod, mm, { keepRenders: false });
  const [pa, pb, pc] = [await peacefulRenders(mod), await peacefulRenders(CUR_AUDIO), await peacefulRenders(CUR_AUDIO)];
  // [difference other ↔ current, run-to-run noise of the current module]; identical when the
  // difference stays within max(1e-5, 3 × that noise) — the song's reverb repeats only to ~1e-5
  /** @returns {[number, number]} */
  const d = (x, y, z) => [+maxDiff(x, y).toExponential(1), +maxDiff(y, z).toExponential(1)];
  const same = {
    events: pa.events === pb.events,
    sfx: Object.fromEntries(Object.keys(pa.sfx).map((n) => [n, d(pa.sfx[n], pb.sfx[n], pc.sfx[n])])),
    song: d(pa.song, pb.song, pc.song),
    ambience: d(pa.ambience, pb.ambience, pc.ambience),
  };
  const ok = ([diff, noise]) => diff <= Math.max(SAME, 3 * noise);
  same.identical = same.events && Object.values(same.sfx).every(ok) && ok(same.song) && ok(same.ambience);
  const cur = results;
  const rows = {};
  for (const name of Object.keys(cur.sfx)) {
    const a = other.sfx[name];
    const b = cur.sfx[name];
    rows[name] = {
      M: [+a.mMax.toFixed(1), +b.mMax.toFixed(1)], rel: [+a.rel.toFixed(1), +b.rel.toFixed(1)], tp: [+a.tpDb.toFixed(1), +b.tpDb.toFixed(1)],
      cut: [+a.cutDb.toFixed(0), +b.cutDb.toFixed(0)], step: [+a.stepDb.toFixed(0), +b.stepDb.toFixed(0)], leak: [+a.leakDb.toFixed(0), +b.leakDb.toFixed(0)], harsh: [+(a.harshShare * 100).toFixed(0), +(b.harshShare * 100).toFixed(0)],
      harshDb: [+a.harshDb.toFixed(1), +b.harshDb.toFixed(1)], sub: [+(a.subShare * 100).toFixed(1), +(b.subShare * 100).toFixed(1)],
      flags: [a.flags.map(([, f]) => f).join(','), b.flags.map(([, f]) => f).join(',')],
    };
  }
  const music = Object.fromEntries(Object.keys(cur.music).map((k) => [k, { I: [+other.music[k].integrated.toFixed(1), +cur.music[k].integrated.toFixed(1)], tp: [+other.music[k].tpDb.toFixed(1), +cur.music[k].tpDb.toFixed(1)] }]));
  const scenes = Object.fromEntries(Object.keys(cur.scenes).map((k) => {
    const a = other.scenes[k];
    const b = cur.scenes[k];
    return [k, { tp: [+a.truePeakDb.toFixed(1), +b.truePeakDb.toFixed(1)], pumping: [+a.pumpingMean.toFixed(1), +b.pumpingMean.toFixed(1)], pumpingMax: [+a.pumpingMax.toFixed(1), +b.pumpingMax.toFixed(1)], sfxOverMusic: [+a.sfxOverMusic.toFixed(1), +b.sfxOverMusic.toFixed(1)], limiter: [a.limiterMean, b.limiterMean && +b.limiterMean.toFixed(1)] }];
  }));
  const duckDb = (v) => (v === null ? null : +DB(v).toFixed(1));
  const victory = { duckDb: [duckDb(other.victory.duck), duckDb(cur.victory.duck)], levelTrackAt: [other.victory.levelTrackAt, cur.victory.levelTrackAt], clash: [other.victory.clashShare, cur.victory.clashShare] };
  const checks = Object.fromEntries(Object.keys(cur.checks).map((k) => [k, [other.checks[k]?.ok ?? null, cur.checks[k].ok]]));
  return { same, sfx: rows, music, scenes, victory, checks, otherRef: { median: other.refMedian, harsh: other.refHarsh, songI: other.songI } };
}

/** The peaceful fingerprint of the current module, against PEACEFUL_GOLDEN (±0.05 dB, exact event hash). */
async function identity() {
  const p = await peacefulPrint(CUR_AUDIO);
  const g = PEACEFUL_GOLDEN;
  if (!g) return { recorded: false, print: p };
  const near = (x, y) => Math.abs(x - y) <= 0.05;
  const sfx = Object.fromEntries(Object.keys(g.sfx).map((n) => [n, near(p.sfx[n].peakDb, g.sfx[n].peakDb) && near(p.sfx[n].mMax, g.sfx[n].mMax)]));
  const song = near(p.song.integrated, g.song.integrated) && near(p.song.peakDb, g.song.peakDb);
  const ambience = near(p.ambience.peakDb, g.ambience.peakDb) && near(p.ambience.mMax, g.ambience.mMax);
  const ok = p.events === g.events && song && ambience && Object.values(sfx).every(Boolean);
  return { recorded: true, ok, events: p.events === g.events, sfx, song, ambience };
}

function summary() {
  const r = results;
  if (!r) return null;
  const sfx = Object.fromEntries(Object.entries(r.sfx).map(([n, m]) => [n, `${fmt(m.mMax)}LUFS Δ${fmt(m.rel)} tp${fmt(m.tpDb)} cut${fmt(m.cutDb, 0)} step${fmt(m.stepDb, 0)} leak${fmt(m.leakDb, 0)} st${fmt(m.startDb, 0)} h${fmt(m.harshShare * 100, 0)}%/${fmt(m.harshDb)} sub${fmt(m.subShare * 100, 1)}% dc${fmt(m.dcDb, 0)} ${m.flags.map(([, f]) => f).join(',')}`]));
  const ref = Object.fromEntries(Object.entries(r.ref).map(([n, m]) => [n, `${fmt(m.mMax)}LUFS Δ${fmt(m.rel)} tp${fmt(m.tpDb)} cut${fmt(m.cutDb, 0)} step${fmt(m.stepDb, 0)} leak${fmt(m.leakDb, 0)} h${fmt(m.harshShare * 100, 0)}%/${fmt(m.harshDb)} sub${fmt(m.subShare * 100, 1)}%`]));
  const music = Object.fromEntries(Object.entries({ ...r.music, ...Object.fromEntries(Object.entries(r.stingers).map(([k, v]) => [`stinger ${k}`, v])) }).map(([n, m]) => [n, `I${fmt(m.integrated)} Δ${fmt(m.rel)} S${fmt(m.sMax)} tp${fmt(m.tpDb)} h${fmt(m.harshShare * 100, 0)}% sub${fmt(m.subShare * 100, 1)}%`]));
  const scenes = Object.fromEntries(Object.entries(r.scenes).map(([k, s]) => [k, `tp${fmt(s.truePeakDb)} musicS${fmt(s.musicS)} sfxM${fmt(s.sfxM)} (+${fmt(s.sfxOverMusic)}) GR music ${fmt(s.grMusicMean)}/${fmt(s.grMusicMax)} full ${fmt(s.grFullMean)}/${fmt(s.grFullMax)} pump ${fmt(s.pumpingMean)}/${fmt(s.pumpingMax)} lim ${s.limiterMean === null ? '-' : `${fmt(s.limiterMean)}/${fmt(s.limiterMax)}`} rej ${s.rejected}`]));
  const v = r.victory;
  return {
    allOk: r.allOk, ms: r.ms, refMedian: +r.refMedian.toFixed(1), refHarsh: +r.refHarsh.toFixed(1), songI: +r.songI.toFixed(1),
    checks: Object.fromEntries(Object.entries(r.checks).map(([k, c]) => [k, c.ok ? true : c.info])),
    sfx, ref, music, scenes,
    victory: `duck ${v.duck !== null ? fmt(DB(v.duck)) : '-'} dB · clash ${fmt(v.clashShare * 100, 0)}% · level track +${v.levelTrackAt} s · stinger ${fmt(v.stingerSeconds, 2)} s, last chord ${v.stingerChordEnds} s · S before ${fmt(v.bossBefore)} during ${fmt(v.duringStinger)} · ${v.log.map((e) => `${e.t}:${e.ev}`).join(' ')}`,
  };
}

async function run() {
  const t = performance.now();
  results = await analyse(CUR_AUDIO, CUR_MUSIC, { onProgress: (s) => { $('status').textContent = s; } });
  api.results = results;
  renderTables(results);
  select(selected ?? 'hit');
  $('status').textContent = `analysed ${Object.keys(results.sfx).length} combat SFX, ${Object.keys(results.ref).length} peaceful SFX, ${Object.keys(results.music).length} music sections, 2 stingers, ${Object.keys(results.scenes).length} scenes in ${Math.round(performance.now() - t)} ms · ${results.allOk ? 'all checks pass' : 'some checks fail'} · click ▶ to listen (the first click unlocks audio)`;
  return { allOk: results.allOk, ms: results.ms };
}

/**
 * What run() stores in `__caudio.results`: analyse()'s measures plus what flag() adds (per sound
 * `rel` and `flags`, the reference numbers, the checks).
 * @typedef QaResults
 * @type {Awaited<ReturnType<typeof analyse>> & { refMedian: number, refHarsh: number,
 *   songI: number, checks: Record<string, { ok: boolean, info: any }>, allOk: boolean }}
 */
/**
 * `window.__caudio` (AUTOMATION_API.md §7), read by sandbox/combat_audio.actions.json.
 * @typedef {object} CaudioHandle
 * @property {Promise<{ allOk: boolean, ms: number }>|null} ready  the analysis started at load
 * @property {QaResults|null} results  the last analysis (null until it finished)
 * @property {typeof run} run  analyse the current modules again and redraw the page
 * @property {typeof compare} compare  analyse another AudioSystem (+ CombatMusic) module by URL
 *   and diff it against the current results
 * @property {typeof identity} identity  the peaceful fingerprint against PEACEFUL_GOLDEN
 * @property {typeof play} play  play a sound / 'music <track> [section]' / 'stinger <name>' /
 *   'scene <key>' / 'victory sequence' / 'stop' on the live AudioSystem
 * @property {typeof select} select  draw that render and its detail
 * @property {typeof summary} summary  one line per sound, track and scene, plus the checks
 * @property {typeof SCENES} SCENES
 * @property {typeof GAME_VOL} GAME_VOL
 * @property {typeof ROLE} ROLE
 * @property {typeof WINDOW} WINDOW
 * @property {typeof LIMIT} LIMIT
 * @property {(url?: string|null) => ReturnType<typeof peacefulPrint>} peacefulPrint
 * @property {{ render: typeof render, renderSfx: typeof renderSfx, measure: typeof measure,
 *   hashFloats: typeof hashFloats, maxDiff: typeof maxDiff, CUR_AUDIO: typeof CUR_AUDIO }} internals
 * @property {CUR_AUDIO.AudioSystem|null} live  (getter) the live AudioSystem once play() made it
 */
/** @type {CaudioHandle} */
const api = {
  ready: null, results: null, run, compare, identity, play, select, summary, SCENES, GAME_VOL, ROLE, WINDOW, LIMIT,
  /** Fingerprint numbers of the peaceful audio (of another AudioSystem module when `url` is given). */
  async peacefulPrint(url = null) { return peacefulPrint(url ? await import(/* @vite-ignore */ url) : CUR_AUDIO); },
  internals: { render, renderSfx, measure, hashFloats, maxDiff, CUR_AUDIO },
  get live() { return live; },
};
window.__caudio = api;
buildBars();
buildLegend();
api.ready = run().catch((err) => {
  $('status').textContent = `analysis failed: ${err?.stack ?? err}`;
  throw err;
});
