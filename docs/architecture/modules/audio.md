# Audio module: AudioSystem

> **Purpose.** This is the reference for Luminati's fully procedural WebAudio engine. It
> synthesises every sound at runtime, with no audio files: eight UI and gameplay sound effects,
> five crossfading ambience layers (wind, birds, crickets, fire, water) and "Emberfall Evening",
> a looping harp, string-pad and flute folk tune. Combat levels add 35 combat sound effects, two
> combat music tracks ("Ashes on the Wind", "Heart of Cinders") with crossfades and sections, and
> two stingers (§4.1, §6.1). The page covers the API, the audio graph, how each sound is built and
> how to schedule, mix and test it.
>
> **Audience:** game programmers wiring sound, anyone extending the sound set, and AI agents.
>
> **Source of truth:** [`src/engine/audio/AudioSystem.js`](../../../src/engine/audio/AudioSystem.js)
> (single file). Game-side mixing lives in [`src/game/AudioDirector.js`](../../../src/game/AudioDirector.js).
> Contract: [ARCHITECTURE.md §4.1 (audio)](../../../ARCHITECTURE.md).
>
> **Related:** [modules index](README.md) · [core.md](core.md) (Engine systems) · [GAME.md](../GAME.md)
> (AudioDirector, music toggle) · [PLAYING_THE_GAME.md](../../user/PLAYING_THE_GAME.md) (M = music) ·
> [KNOWN_ISSUES.md](../../ai/KNOWN_ISSUES.md) · [MODULE_NOTES.md](../../contracts/MODULE_NOTES.md#core)

---

## 1. At a glance

```js
import { AudioSystem, SFX_NAMES, AMBIENCE_LAYERS } from './engine/index.js';

const audio = new AudioSystem({ volume: 0.6 });
engine.addSystem(audio, 20);                      // update(dt) runs the scheduler
ui.title.onDismiss = () => audio.unlock();        // MUST be inside a user gesture
audio.startMusic();                               // allowed before unlock: remembered
audio.setAmbience({ wind: 0.5, birds: 0.6 });     // remembered too
audio.playSfx('confirm');                         // silent no-op (returns false) until unlocked
```

- `SFX_NAMES` = `['step', 'blip', 'confirm', 'cancel', 'open', 'close', 'chime', 'splash']`
- `AMBIENCE_LAYERS` = `['wind', 'birds', 'crickets', 'fire', 'water']`
- `COMBAT_SFX_NAMES` (35 names, §4.1), `MUSIC_TRACKS` = `['emberfall', 'battle', 'boss']` and
  `MUSIC_STINGERS` = `['victory', 'levelup']` (combat levels, [COMBAT.md §12](../../contracts/COMBAT.md)).
  All four are also exported by the engine barrel (`src/engine/index.js`).

**Sandbox:** [`sandbox/core.html`](../../../sandbox/core.html). Its gold-bordered panel has sfx
buttons, ambience sliders, a music toggle and an oscilloscope on the master output.
`window.__core.exerciseAudio()` plays everything, and `window.__core.analyzeAudio()` renders
offline and draws a spectrogram. The combat sounds and tracks have buttons in
[`sandbox/combat_fx.html`](../../../sandbox/combat_fx.html) (§7).

```bash
npm run check -- --page=sandbox/core.html --query= --out=core_audio --script=sandbox/core.audio.actions.json
```

> Headless Chrome produces no audible output. The module was verified by offline renders (levels,
> NaN checks, spectrograms), not by ear. See §8.

---

## 2. API

### 2.1 Constructor

```js
new AudioSystem({ volume = 0.6, musicVolume = 0.5, sfxVolume = 0.85, ambienceVolume = 0.7,
                  reverb = 0.32, suspendWhenHidden = true, bpm = 72, context = null } = {})
```

| Option | Default | Meaning |
| --- | --- | --- |
| `volume` | `0.6` | Master volume 0..1. |
| `musicVolume` / `sfxVolume` / `ambienceVolume` | `0.5` / `0.85` / `0.7` | Bus volumes 0..1. Internally multiplied by a make-up trim (music ×2.4, sfx ×1.9, ambience ×1.5). |
| `reverb` | `0.32` | Return level of the global convolution reverb. |
| `suspendWhenHidden` | `true` | Suspends the `AudioContext` while the tab is hidden and resumes it when visible. |
| `bpm` | `72` | Tempo of "Emberfall Evening". Public field, read by the scheduler each tick (the song instance's `bpm` is a getter on it; the combat tracks carry their own fixed tempo, §6.1). |
| `context` | `null` | Use this (`Offline`)`AudioContext` instead of creating one in `unlock()`, for example to render the soundtrack offline in tests (see `prescheduleOffline`). |

Nothing touches WebAudio in the constructor. Everything is created lazily in `unlock()`.

### 2.2 Members

| Member | Kind | Description |
| --- | --- | --- |
| `unlock()` | → `Promise<boolean>` | The first call creates the context (`latencyHint: 'interactive'`) and builds the graph. Every call resumes a suspended context. It resolves to `ready`, or to `false` if there is no WebAudio or creation failed. **Call it from a user gesture** (click or key). Otherwise Chrome logs "AudioContext was not allowed to start". Safe to call repeatedly. |
| `ready` | getter | Context exists, not disposed, and `state === 'running'` (always true for offline contexts). |
| `masterVolume` | get/set | 0..1, smoothed (τ 30 ms). |
| `muted` | get/set | Mutes the master, which keeps playing silently. |
| `musicVolume`, `sfxVolume`, `ambienceVolume` | get/set | Bus levels 0..1 (τ 50 ms). |
| `ambience` | getter | Copy of the current ambience targets `{ wind, birds, crickets, fire, water }`. |
| `playSfx(name, { volume = 1, pitch = 1, pan = 0, delay = 0 } = {})` | → boolean | Plays a one-shot from `SFX_NAMES` or `COMBAT_SFX_NAMES`. `volume` is a multiplier, `pitch` a frequency ratio (min 0.05), `pan` is −1..1 and `delay` is in seconds. Returns `false` when not ready, rate-limited, over the voice cap, or for an unknown name (which also logs one `console.warn` per name). |
| `setAmbience(levels, { replace = false, fade = 2.5 } = {})` | | Sets layer levels 0..1. **Only the layers you pass change**; `replace: true` fades the others to 0. `fade` is the approximate crossfade time in seconds (min 0.05). Remembered before unlock. |
| `startMusic({ fade = 2.5, track } = {})` | | Starts music with a fade-in. Before unlock it only records the wish, and playback starts on unlock. `track` is one of `MUSIC_TRACKS`; **without it the last requested track plays** (initially `'emberfall'`), so the unlock / resume path and `toggleMusic()` restart what was playing. The track that already plays is a no-op; a **different** track crossfades: the playing one takes the stop path with `fade` while the new one fades in over the same time. An unknown track logs one warning and changes nothing. |
| `stopMusic({ fade = 2.5 } = {})` | | Fades out and stops scheduling. Nodes are disconnected `fade + 4` s later. The requested track is remembered. |
| `musicPlaying` | getter | Reports **intent**: already `true` after `startMusic()` before unlock. |
| `musicTrack` | getter | The requested track while music is wanted, else `null`. |
| `musicSection` | getter | `'A'` / `'B'` of a playing combat track, else `null` (diagnostics). |
| `setMusicSection(name)` | | `'A'` or `'B'`: the current combat track switches at the next bar line (§6.1); ignored by `'emberfall'` and unknown names. Remembered for that track until another track starts. |
| `playStinger(name, { volume = 1 } = {})` | → boolean | `'victory'` (4-bar D-major fanfare) or `'levelup'` (a harp arpeggio and bells) over the music, which is ducked to 30 % underneath and swells back. Silent (`false`) before unlock and while the music is off. |
| `toggleMusic()` | → boolean | Start (the remembered track) or stop, returns the new state. |
| `update(dt)` | | Runs the music and ambience scheduler (engine-system compatible). |
| `prescheduleOffline(seconds)` | | Offline contexts only: runs the schedulers over `[0, seconds)` before `startRendering()`. |
| `dispose()` | | Stops the timer, removes the visibility listener, tears down layers and closes the context unless it was provided or is offline. Idempotent. |

---

## 3. Audio graph

```mermaid
flowchart LR
  subgraph voices
    S[sfx voices] --> SP[per-voice StereoPanner]
    A[ambience layers] --> LG[layer gain]
    M[music: harp · pad · flute buses<br/>+ taiko · bass on combat tracks] --> MO[music out gain]
    C[combat sfx voices] --> CP[shared panner bank<br/>9 positions, dry / wet]
  end
  SP --> SFX[sfx bus<br/>0.85×1.9]
  CP --> SFX
  CP -. wet bank, send 0.35 .-> RIN
  SP -. optional send .-> RIN
  LG --> AMB[ambience bus<br/>0.7×1.5]
  MO --> MUS[music bus<br/>0.5×2.4]
  MO -- send 0.55 --> RIN
  SFX --> MIX[mix]
  AMB --> MIX
  MUS --> MIX
  SFX -- send 0.22 --> RIN[reverb in]
  AMB -- send 0.12 --> RIN
  RIN --> HP[highpass 160 Hz] --> CONV[Convolver<br/>generated IR 2.8 s] --> ROUT[reverb out 0.32] --> MIX
  MIX --> COMP[Compressor<br/>−14 dB, knee 12, ratio 3,<br/>attack 6 ms, release 250 ms] --> MASTER[master gain] --> OUT((destination))
```

- **Impulse response** (`_makeImpulse(2.8, 2.3)`): stereo, 14 ms pre-delay, 10 sparse early
  reflections, and an exponentially decaying noise tail that gets darker over time (the lowpass
  coefficient drops with time), with a 100 ms fade at the end. Each channel is seeded differently.
- **Noise sources** built once at unlock: 2 s of white noise, and 6 s of brown noise made
  seamless by removing the end-to-end drift and the DC offset. Both are seeded, so the sound is
  deterministic.
- All randomness uses `mulberry32` seeds, never `Math.random()`.

---

## 4. Sound effects

| Name | Synthesis | Min re-trigger (s) |
| --- | --- | --- |
| `step` | Bandpassed white-noise tick (≈1050 Hz × random rate 0.82–1.18) plus a sine thump sweeping 125 → 58 Hz. The pan alternates left and right each step. | 0.045 |
| `blip` | Soft triangle (≈1150 Hz) plus a square an octave below through a 2.6 kHz lowpass, ~70 ms. Dialog typewriter tick. | 0.018 |
| `confirm` | Two inharmonic bell notes (MIDI 81 then 88, 75 ms apart). | 0.05 |
| `cancel` | Two descending triangle notes (MIDI 76 → 69) through a lowpass. | 0.05 |
| `open` / `close` | Karplus-Strong harp glissando up / down a D-scale (9 notes, 34 ms apart, pan sweep). `pitch` becomes a semitone transpose. | 0.08 |
| `chime` | Bell arpeggio (MIDI 86, 90, 93, 98) plus five high sine sparkles. | 0.1 |
| `splash` | White noise with a lowpass sweeping 6.5 kHz → 380 Hz, plus six rising sine "droplets". | 0.08 |

- **Bells** (`_bell`): four decaying sine partials at ratios 1, 2.0, 2.76 and 5.4.
- **Voice cap:** `playSfx` refuses when more than 96 tracked voices are alive. Each helper
  node group counts, so the cap is approximate. Music notes are dropped above 1.5 × 96.
- **Cleanup:** sources disconnect `onended`. Panners with reverb sends disconnect by
  `setTimeout` relative to the voice's scheduled start, so a `delay`ed sfx is not cut off.

How the demo uses them (see [GAME.md](../GAME.md)):

- `step` from the player's footsteps ([`src/game/Player.js`](../../../src/game/Player.js)).
- `blip` from the dialog typewriter (`ui.dialog.onChar`, every other character).
- The dialog's own sounds through `ui.dialog.onSound`.
- `open` / `close` when the world map opens or closes.
- `chime` when resting at the inn.

Scripted conversations can also play sounds (`sfx('chime')` in
[`src/game/dialogue.js`](../../../src/game/dialogue.js)), and so can examinable level objects
through their `sfx` field. Emberfall's well has `"sfx": "splash"`.

### 4.1 Combat sound effects (`COMBAT_SFX_NAMES`, combat levels)

A separate list, so `SFX_NAMES` keeps its 8 names. Each is a small synth of **at most 6 nodes
per play** (noise bursts through swept filters, pitch-dropping sine thumps, triangle rings, a
few FM / LFO voices; no raw square waves), seeded by its own RNG (`_crng`, never the shared
`_rng` the song and ambience use). The voices end in a **shared bank of stereo panners**
(9 fixed positions −0.8 … 0.8, a dry bank and a wet bank with a 0.35 reverb send) that is built
on the first combat sound, so peaceful levels never create it. Min re-trigger 30–60 ms (`hit`,
`coin` 30 ms). Combat plays them through `ctx.sfx(name, x, z)`: pan from the event's screen x,
volume by distance, ±4 % seeded pitch jitter (COMBAT.md §12.1).

| Group | Names (synthesis) |
| --- | --- |
| Player | `swing` (bandpass-swept whoosh + a faint steel zing), `swingHeavy` (lower, slower whoosh + sub), `hit` (170 → 52 Hz thump + filtered crack), `crit` (heavier thump, crack and a short metallic ring), `hurt` (dull blow + falling "oof" tones), `dodge` (airy roll whoosh + landing scuff), `perfect` (G6 / D7 bell dyad over a descending swish, wet), `whirl` (whoosh whose band spins at 11 Hz), `bolt` (rising fiery whoosh + tone), `boltHit` (small fire burst), `nova` (deep boom, falling air, D6 shimmer, wet), `drink` (three gulps + a sparkle, wet), `guard` (metallic clank + click) |
| Enemies | `enemyAlert` ("!": two rising blips), `windup` (charging whoosh + rising rumble), `arrow` (bow twang + whistle), `arrowHit` (thunk), `hexBurst` (flame eruption + boom, wet), `slimeHop` (squishy boing + squelch), `batScreech` (thin band-limited FM chirp), `boarSnort` (two nasal snorts), `boarCharge` (ground rumble + squeal), `stun` (dizzy warble), `enemyDie` (poof + falling blip) |
| Boss | `bossRoar` (1.3 s saw + brown-noise growl through a wobbling lowpass, wet), `slam` (huge thud + falling debris air, wet), `rockToss` (heave swoosh), `gateClose` (ember wall roar, then a stone thud, wet) |
| Loot / progress | `pickup` (two harp plucks from the song's Karplus-Strong cache), `coin` (bright two-step ding), `chestOpen` (lid creak, then a rising sparkle arpeggio, wet), `waystone` (D5 + A5 crystal with an airy shimmer, wet), `levelup` (rising D-major arpeggio + sparkle tail, wet), `playerDown` (a falling, softened sigh + thud, wet), `heartbeat` (low "lub-dub" with a quiet octave for small speakers) |

**Envelopes and tails** (the combat audio QA of 2026-09-28, KNOWN_ISSUES COMBAT-11): every
`env()` gain starts at 0 (with an attack delay it used to sit at the default 1.0 until the
envelope began — `swingHeavy` played a 20 ms full-gain 110 Hz blip, `arrow` 20 ms of raw noise);
a `bump()` re-trigger first releases a still-ringing bump over ≈ 6 ms (τ 1.2 ms) instead of
jumping to 0; every voice decays ≥ 60 dB before its `stop()` (16 sounds were cut 32–50 dB under
their peak). `boarCharge`, `bossRoar` and `gateClose` rumble on `_combatBrown()`: a 2 s seeded
brown-noise buffer high-passed at ≈ 35 Hz (two one-pole stages, a seamless loop), built on the
first of them (≈ 1–3 ms, ≈ 350 kB); `_brown`, the ambience, `SFX_NAMES`, the buses, compressor
and reverb are unchanged. `boarCharge`'s share below 40 Hz fell from 30.5 % to 2.8 %.

**Levels** — BS.1770 momentary loudness max (LUFS M) at the in-game call volumes, measured by
[`sandbox/combat_audio.html`](../../../sandbox/combat_audio.html); the song is −19.5 LUFS integrated:

| Role | Sounds (LUFS M) |
| --- | --- |
| Feedback | `hit` −23.0, `crit` −19.1, `hurt` −20.2, `boltHit` −24.3, `enemyDie` −27.2 |
| Actions | `swing` −31.8, `swingHeavy` −27.8, `dodge` −34.5, `whirl` −24.3 |
| Big moments | `nova` −18.3, `bossRoar` −17.4, `slam` −17.5, `gateClose` −17.6, `waystone` −17.9, `perfect` −19.2, `levelup` −19.3, `playerDown` −17.9 |
| Loot | `coin` −29.4, `pickup` −35.3, `chestOpen` −21.5 |

The big sounds were brought down 1–4 LU (`nova` −14.2, `bossRoar` −13.9, `slam` −15.4 before) and
`perfect` / `levelup` 3 dB softer: their 2–6 kHz band was 5 dB above the brightest peaceful sound
(now −30.3 / −30.5 dBFS against `splash`'s −32.9). Offline peaks (`sandbox/combat_fx.html`, sfx
volume 0.85, reverb 0) stay 0.096–0.545, no NaNs, no clipping.

---

## 5. Ambience layers

`setAmbience` sets a target per layer. Each change calls `setTargetAtTime(level × LAYER_GAIN,
now, fade / 3)`, so the fade reaches about 95 % in `fade` seconds. A layer's nodes are created
the first time its level rises above 0.001. After it fades to 0 and has been silent for
`fade × 2 + 1` s, it is torn down.

| Layer | Gain at level 1 | Built from |
| --- | --- | --- |
| `wind` | 0.62 | Brown noise through a bandpass (380 Hz, swept ±210 Hz by a 0.071 Hz LFO). A 0.13 Hz gust LFO on gain and a 0.043 Hz pan drift, plus an airy whistle (white noise, narrow 1.3 kHz bandpass, swept). |
| `birds` | 1.5 | Scheduled calls through a 1.4 kHz highpass. Three species: a descending trill, a two-tone "tee-yoo" whistle and an FM warble. Random pan and distance. The mean interval shrinks as the level rises. |
| `crickets` | 0.95 | Three sine voices (4420, 4780, 3960 Hz) gated into pulse trains (3, 4, 2 pulses every 0.64, 0.83, 1.07 s), plus a distant chorus of bandpassed noise at 5.2 kHz. |
| `fire` | 0.29 | A lowpassed brown-noise rumble (170 Hz, two slow LFOs), a bandpassed hiss (2.6 kHz) and Poisson crackles (rate `4 + 10·level` /s, 25 % arrive in clusters of 2–4). |
| `water` | 0.62 | Two bandpassed flows (brown at 520 Hz and white at 1.65 kHz, each LFO-swept) plus Poisson bubbles (rate `2.5 + 6·level` /s). |

The demo's `AudioDirector` recomputes the mix from time of day, weather and the distance to
fires and water, and calls `setAmbience(levels, { fade: 0.6 })` (see [GAME.md](../GAME.md)).

---

## 6. Music: "Emberfall Evening"

- **Form:** 72 bpm (`bpm`), 4/4. A 2-bar intro on Dm (harp and pad only), then a looping
  16-bar main section:
  - **A** (bars 1–8, D dorian): Dm · C · G · Dm · F · C · G · Am, with add9 / maj7 colours.
  - **B** (bars 9–16, D mixolydian): D · C · G · D · Em · G · C · D.
- **Harp:** rolling triplet-eighth arpeggios (12 notes per bar from three patterns), with the
  bass on beat 1 and a softer fifth or octave on beat 3. Velocity and timing are slightly
  humanised (seeded jitter ±6 ms). Pan follows pitch. Harp bus: lowpass 4.2 kHz.
- **Pad:** per note, two detuned saws with a stereo spread through a "breathing" lowpass
  (650 → 1350 → 800 Hz). Slow attack (≤ 1.2 s), release τ 0.45 s.
- **Flute melody** (47 notes over the 16 bars, the `MELODY` table): a sine plus 16 % triangle, vibrato (~5.1–5.5 Hz)
  that fades in after the attack, and bandpassed breath noise. Flute bus: lowpass 3.4 kHz.
- **Harp voice:** `_harpBuffer(midi)` pre-renders a Karplus-Strong plucked string at **32 kHz**:
  - The excitation is a two-pole lowpassed noise burst (brighter for high notes), with a
    pluck-position comb at 14 % and DC removal.
  - The feedback loop uses a linear-interpolated fractional delay and two-point averaging, with
    decay tuned to t60 = 75 % of the duration.
  - The result is normalised, with a 56-sample fade-in and a 25 % fade-out tail.
  - Buffers are mono, `clamp(3.4 − (midi − 38) × 0.045, 1.1, 3.2)` s long (1.6–3.2 s for the
    notes actually played) and cached per MIDI note. The
    song uses 23 distinct notes (MIDI 36–72), about 7.7 MB of Float32 samples once all are
    rendered; the `open` / `close` glissandi add up to 4 more (74, 76, 77, 79). Each buffer is
    rendered synchronously on first use (the builder measured about 0.5–1 ms per note), so the
    cost is spread over the first bars, not paid at unlock.
- **Scheduler:** a 40 ms `setInterval` plus every `update()` schedule events up to **0.35 s**
  ahead of `currentTime`. Events that fell more than 30 ms behind (a throttled background tab)
  are **skipped rather than played in a burst**.

Offline measurements at master 0.6: music ≈ −21 dB RMS (peak −9 dB), sfx peaks −8 to −10 dB,
ambience layers −25 to −41 dB RMS at level 1. No NaNs.

### 6.1 Combat tracks, sections and stingers (combat levels)

Built **lazily on first use** (`_combatTrack`), each from its own seeded RNG, after the song;
"Emberfall Evening", its scheduled note list and the shared `_rng` sequence are unchanged
(verified: the default song's scheduled events and the RNG position after 240 s are identical to
the pre-combat code). Same instruments as the song (the Karplus-Strong harp, the string pads,
the flute) plus two combat voices: a **taiko** (a pitch-dropping sine body with a filtered-noise
skin; the big drum on beats 1 and 3) and a **staccato saw bass** (a sawtooth through a plucked
resonant lowpass). Pads and flute of a combat track draw their detune / vibrato from the track's
own play RNG.

| Track | Title | Tempo, key | Form |
| --- | --- | --- | --- |
| `emberfall` | Emberfall Evening | 72 bpm (`bpm`), D dorian / mixolydian | 2-bar intro, then the 16-bar main section looped (§6) |
| `battle` | Ashes on the Wind | 132 bpm, D minor | **A** (8 bars: Dm Dm B♭ C Dm Dm Gm A; taiko in 8ths, saw-bass ostinato, 8th-note harp, a short flute motif) and **B** (8 bars: B♭ C Dm Dm Gm B♭ A A; busier drums, 16th-note harp, the flute melody, a 16th drum fill into the next A), played **A, B, A, B …** |
| `boss` | Heart of Cinders | 140 bpm, C phrygian | **A** (phase 1: Cm D♭ Cm D♭ A♭ B♭m D♭ Cm, low flute line) and **B** (phases 2–3: Cm Cm D♭ D♭ Fm A♭ D♭ C5, higher melody, 16th harp, drum fill); **each section loops** until `setMusicSection` changes it |

- **Per-instance tempo:** every music instance carries its own `bpm`; `_scheduleMusic` reads
  `m.bpm`.
- **Crossfade:** `startMusic({ track })` with a different track calls the stop path on the old
  instance (its out gain ramps to 0 over `fade`, scheduling stops) and starts the new instance
  with the same fade-in, so both overlap. Requesting the playing track changes nothing.
- **Remembered track:** `_musicTrackWanted`; the unlock path, `toggleMusic()` and
  `startMusic()` without a track restart it.
- **Sections:** `setMusicSection('B')` sets a pending section; the scheduler switches at the
  first bar line it has not scheduled yet (at most a bar away), and `battle` then keeps
  alternating from there.
- **Stingers** are scheduled at once on their own short-lived bus (harp, pad, flute, bells) into
  the music bus; `victory` is 4 bars at 108 bpm plus the held last chord (18 beats, 10 s),
  `levelup` ≈ 2 s. `playStinger(name, { volume = 1, duck = 0.3 })` ducks the playing track to
  `duck` underneath and swells it back. The `duck` option is additive (the default is the old
  behaviour); `duck: 0` hands the stage to the stinger — the playing track fades out over 0.35 s
  and ends, while the music stays *on* (`musicPlaying`, `musicTrack` unchanged) and nothing plays
  until the next `startMusic({ track })`. `CombatMusic.victory()` uses `duck: 0`: the C-phrygian
  boss track sounded at −10.5 dB under the D-major fanfare (minor-second clashes throughout), and
  its `VICTORY_STINGER` (18 beats at 108 bpm = 10 s; it assumed 140 bpm before, 6.86 s) now
  starts the level track after the last chord.
- **Levels** (offline, 24 s, master 0.6): Emberfall's main section ≈ −21 dB RMS, battle A ≈ −21 /
  B ≈ −19 dB, boss ≈ −19 dB (peaks ≈ 0.5): the fight music sits 0–2 dB above the song. Integrated
  loudness: battle A −18.2 / B −17.1, boss A −17.1 / B −16.7 LUFS against the song's −19.5; true
  peak ≤ −5.6 dBTP. **Dense mixes** (no combat-bus limiter was needed): the pack fight (10 hits plus
  swings, deaths and cues over battle B) peaks at −4.7 dBTP and pushes the music down 1.7 dB mean /
  2.0 dB max through the master compressor; the boss scene −4.4 dBTP, 1.5 / 2.4 dB; a stress scene
  (the 12 loudest sounds within 0.6 s) −3.7 dBTP; the peaceful reference scene 0.4 / 1.0 dB.

The game's `AudioDirector` has one combat input: `combatIntensity` (0..1, default 0 = no change)
scales the birds by `1 − 0.8·i`; combat sets 1 while engaged and eases it back over 3 s.

---

## 7. Testing and offline rendering

```js
const ctx = new OfflineAudioContext(2, 44100 * 20, 44100);
const audio = new AudioSystem({ context: ctx });
await audio.unlock();                       // builds the graph on the offline context
audio.startMusic({ fade: 0.1 });
audio.setAmbience({ wind: 1 });
audio.prescheduleOffline(20);               // offline contexts have no running clock
const buffer = await ctx.startRendering();  // analyse RMS / peaks / NaNs
```

`window.__core.analyzeAudio()` in the core sandbox does this and draws a spectrogram overlay.
The action scripts `sandbox/core.audio.actions.json` and `core.audio2.actions.json` run the
audio checks through the headless harness. [`sandbox/combat_fx.html`](../../../sandbox/combat_fx.html)
(`sandbox/combat_fx.actions.json`) renders every combat SFX offline (started, ≤ 6 nodes, finite,
audible, no clipping) and an Emberfall → battle crossfade → boss section B → stinger sequence
(tempo per track, no gap), and checks the remembered track; `window.__cfx.renderTrack(track,
seconds, mute)` measures a track's level per second (optionally with voices muted, e.g.
`['_taiko']`). When scheduling offline by hand, reset `audio._voices = 0` before each
`_scheduleMusic(now)`: no voice ends before rendering starts, so the voice cap would otherwise
drop notes after a few seconds of dense music. See
[TESTING_AND_VERIFICATION.md](../../development/TESTING_AND_VERIFICATION.md).

[`sandbox/combat_audio.html`](../../../sandbox/combat_audio.html) (`combat_audio.actions.json`,
`window.__caudio`) is the combat **audio QA and listening page**: it renders every combat SFX (at
its in-game call volume), both stingers, the five music sections, four dense scenes and the victory
sequence through the real `CombatMusic` offline at 44.1 kHz and measures sample peak and 4×
true peak, BS.1770 loudness (M / S / I), crest, DC, attack, the *cut* (what `stop()` removes, from
a second render with every stop delayed), gain steps (the logged gain automation), *leaks* (sound
before an envelope begins, from a render where new gains start at 0), the 2–6 kHz level and the
share below 40 Hz, and — in the dense scenes — the master compressor's gain reduction every 100 ms
with and without the SFX. Each row has a waveform with a dB envelope, a spectrogram and a ▶ button
(live playback); 12 checks (`results.allOk`: no NaN, true peak ≤ −1 dBTP, cuts ≤ −50 dB, no steps
or leaks, role loudness windows, 2–6 kHz ≤ the brightest peaceful sound + 3 dB, < 40 Hz ≤ 20 %,
tracks within ±3 LU of the song, the scenes, the victory sequence). `identity()` compares the
peaceful audio with recorded numbers (`PEACEFUL_GOLDEN`, song event hash `6e15567a`) and
`compare(url)` sample-by-sample with another `AudioSystem` module (an A/B against a copy of the
old file). Offline renders repeat only to ≈ 1e-7 (the song's reverb ≈ 1e-5: `onended` disconnect
timing), so identity is a sample difference, not a hash. The analysis takes 35–80 s. A new combat
sound belongs in its `GAME_VOL` and `ROLE` tables ([TASK_PLAYBOOKS §17](../../ai/TASK_PLAYBOOKS.md#17-add-a-sound-effect)).

---

## 8. Extension points and gotchas

- **Adding a sound effect:** add the name to `SFX_NAMES` and `SFX_MIN_INTERVAL`, write a
  `_sfxX(t, vol, pitch, pan)` that routes through `this._panner(pan, this._buses.sfx, send)`,
  and register cleanup with `_cleanup` / `_later`. Then add a case in `playSfx`. Keep the
  existing names; contract changes must be additive. `playSfx` (and the combat `sfxAt` /
  `ctx.sfx`) take an `SfxName` — the union of `SFX_NAMES` and `COMBAT_SFX_NAMES` — so the type
  check (`npm run typecheck`) rejects a name that is in neither list; the lists are the only place
  to add one.
- **Adding an ambience layer:** add it to `AMBIENCE_LAYERS`, `LAYER_GAIN` and `_ambTargets`, and
  build it in `_createLayer`. Scheduled events (like birds) go in `_scheduleAmbience`.
- **Unlock from a gesture.** The demo calls `unlock()` in `ui.title.onDismiss`, which runs
  synchronously inside the key or click that dismisses the title. With `?autostart=1` (headless
  runs, editor play-tests) there is no title, so `Game._armAudioUnlock` unlocks on the first
  `keydown` / `pointerdown` (capture phase) and starts the level's music.
- **`setAmbience` is partial by default.** Pass `{ replace: true }` to silence the unlisted layers.
- **Timers are wall-clock.** Panner and music-bus disconnects use `setTimeout`. If the tab is
  hidden while a tail rings (the context suspends), that tail can be cut short on return. Minor.
- **No listener position.** Sounds are stereo-panned only. Distance attenuation (fires, water)
  is done by the game through ambience levels.
- **Not heard by the harness.** Anyone changing timbres should do a listening pass in a real
  browser (`npm run dev`, open the core sandbox, press the sfx buttons, M for music; combat sounds
  in `sandbox/combat_audio.html`). Since 2026-10-07 `step` and `blip` stop only after their tails
  have decayed 60 dB (they were cut 45 / 50 dB under the peak, KNOWN_ISSUES AUD-06); what they sound
  like is unchanged (the recorded peaceful numbers still match).

## 9. Design notes

- **Core integration** (see [core.md §10](core.md#10-design-notes)).
  Verified by offline renders (levels, NaN checks, spectrograms) and a live oscilloscope, not
  by ear.
- **Audit fix:** a `playSfx(…, { delay })` voice was cut off before it sounded, because
  `_later()` scheduled the panner disconnect relative to *now* instead of the voice's start.
  Measured: `playSfx('splash', { delay: 1.9 })` peaked at 0.0000; it now peaks at 0.3885. The
  core sandbox has an `sfxDelay()` regression test.
- **Harp attack:** the pluck excitation was softened (two-pole lowpass plus a pluck-position
  comb) after spectrograms showed broadband click-like onsets.
- **Open items:**
  - Nobody has done a listening pass for taste (mix balance, the harp attack, the melody).
  - Wall-clock disconnect timers.
  - Harp buffers are rendered synchronously on first use (0.5–1 ms each). The builder's notes
    say "about 18 notes, roughly 5 MB"; counting the song's events gives 23 notes and about
    7.7 MB.
- **Later (Phase 4 review):** the demo's `AudioDirector` keeps its water sample points in a
  `Float32Array` (no per-call garbage).
- **Combat ( COMBAT.md §12):** `COMBAT_SFX_NAMES` synths, the `battle` /
  `boss` tracks with per-instance tempo, crossfading `startMusic({ track })`, the remembered
  track, `setMusicSection`, `playStinger` and `AudioDirector.combatIntensity`. All additive; the
  default song's construction and scheduled events are unchanged. The combat tracks were balanced
  with offline renders (taiko lowered by about 4 dB after the first pass); still no listening
  pass by ear.
- **Combat audio QA (2026-09-28, KNOWN_ISSUES COMBAT-11):** `sandbox/combat_audio.html` measured
  what the offline level checks had missed and six of its twelve checks failed on the combat
  commit: envelope leaks (`env()` gains started at 1), clicking `bump()` re-triggers, 16 truncated
  tails, over-loud big moments, a harsh `perfect` / `levelup`, sub-bass and DC in the brown-noise
  rumbles (now `_combatBrown()`), and the victory stinger ducking — instead of ending — the
  clashing boss track (`playStinger`'s additive `duck` option). All twelve pass since; the
  peaceful audio is identical to before (`identity()`, and an A/B `compare()` against the old
  module: the 8 SFX within 1.2e-7, the song within the run-to-run floor). A human listening pass
  is still open.
