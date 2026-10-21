# Module implementation notes

> **Purpose.** A descriptive record of engine implementation choices, integration details,
> and performance observations from the original build and later reviews. It records
> deviations from the contract, extras, caveats and measurements at the time they were written.
> It is **not binding** and it lags the code in places (see the errata below).
>
> **Audience.** Developers and AI agents who want the rationale and caveats of a module before
> wiring or changing it. For the current API, read the module pages first.
>
> **Source of truth.** The code under [`src/engine/`](../../src/engine/). Canonical, verified
> module references: [`docs/architecture/modules/`](../architecture/modules/README.md). Binding
> contract: [`ARCHITECTURE.md`](../../ARCHITECTURE.md) §4.
>
> **Related.** [contracts/README.md](README.md) (what is binding, precedence) ·
> [ai/KNOWN_ISSUES.md](../ai/KNOWN_ISSUES.md) · [Architecture overview](../architecture/OVERVIEW.md)
>
> **Combat modules are not in this file.** Combat implementation decisions are recorded
> in [COMBAT.md §27](COMBAT.md#27-deviations-integration) instead, and their pieces are described in
> the module pages (`FxQuads` / `GroundMarkers` in fx.md, `MonsterSprites` / `FxSprites` in pixel.md,
> the `Sprite3D` combat variant in sprite.md, the combat UI in ui.md). Where a note below says
> `SFX_NAMES` or the default bindings, that is still true: combat adds separate lists.
>
> **Errata (checked against the code on 2026-09-27).** These statements below are stale; the code
> and the module pages are right:
>
> | Section | Stale statement | Current code |
> | --- | --- | --- |
> | core (Input) | Gamepad "Start = help, Back = photo" | Back / View = `map`, right-stick click (`GamepadRS`) = `photo`, Start = `help` ([core.md](../architecture/modules/core.md)) |
> | postfx | "48 taps at the defaults" | The tap count follows the drawing-buffer height (48 → 64 → 96); 48 only up to ~917 px; the game caps it at 64 ([render.md](../architecture/modules/render.md)) |
> | lighting | "12 keyframes" | `DEFAULT_KEYFRAMES` has 13 (night at 0.0 h and 21.4 h) |
> | lighting (API summary) | `Sky`: depth test off, `renderOrder` −1000 | Default `earlyZ: true`: depth test on, `renderOrder` 1e6 (`Sky.EARLY_Z_RENDER_ORDER`) |
> | lighting (deviation 5) | God-ray shafts `frustumCulled = false` | Culled per shaft with a sphere test (`frustumCulled = true`) |
> | lighting (API summary) | `uSunColor` ≈ 1.43 at golden hour | ≈ 1.71 (sunI 6.0 / 3.5) |
> | ui | Sentence-end pause 0.3 s | 0.22 s for `. ! ?`, 0.16 s for `; :`, 0.14 s for `—` (`DialogBox` `PAUSES`) |
> | ui (2026-10-10) | The look of every UI note below: `@fontsource` faces imported by `UI.js` (Cinzel, Crimson Pro, Pixelify Sans), gold double borders, `clamp()` / `vw` sizes, SVG arrows falling back to Georgia | The UI is pixel art after mockup G in three languages: fonts from `FontLoader.js` (Google first, else `dist/`), art px at `--px`, pixel glyph fonts ([PIXEL_UI.md](../specs/PIXEL_UI.md), [ui.md](../architecture/modules/ui.md)) |
> | core (audio) | Harp "about 18 notes, roughly 5 MB" | 23 notes, ≈ 7.7 MB once all are rendered ([audio.md](../architecture/modules/audio.md)) |
> | terrain | Option lists | `TileMap` also takes `wallBounce`, `Water` also `deferShore` ([world.md](../architecture/modules/world.md)) |
> | core (2026-10-11) | "index.html should keep overflow: hidden" | The game page is `game.html` and keeps it; `index.html` is the launcher ([Launcher architecture](../architecture/OVERVIEW.md)) |
> | textures | "door, window and lantern_glass look the same for every seed; the other 43 vary" | Only `window` and `lantern_glass` ignore the library seed; `door`'s wood grain uses it (44 vary) ([pixel.md](../architecture/modules/pixel.md)) |
>
> *Paths in the "Files" lists were made repository-relative in the documentation pass (they were
> absolute Windows paths copied from the agent reports). On 2026-10-07 each stale statement in
> the table above also got a short inline* [Errata: …] *mark with the current value where it
> stands (KNOWN_ISSUES DOC-09, DOC-11). Nothing else in the notes was changed.*

## core

### Files
- src/engine/core/EventEmitter.js
- src/engine/core/Input.js
- src/engine/core/Engine.js
- src/engine/core/CameraRig.js
- src/engine/audio/AudioSystem.js
- sandbox/core.html
- sandbox/core.js
- sandbox/core.actions.json
- sandbox/core.audio.actions.json
- sandbox/core.audio2.actions.json

### API summary (builder)
All five core/audio modules are written, and every member in contract section 4.1 is implemented with the names, parameters and defaults it specifies. The sandbox runs with 0 page errors, 0 console errors, 0 warnings and 0 failed requests, and all 13 scripted self-tests pass (window.__core.runAllTests().allOk === true, plus the async tests.resize()).

EventEmitter
- on / off / once / emit as specified.
- Listener lists are copy-on-write, so a listener can unsubscribe itself during emit and emit does not allocate for up to 4 args.
- Extras: listeners(event), listenerCount(event), clear(), and off(event) with no fn removes all listeners.

Engine(opts)
- Renderer: antialias false, 'high-performance', stencil false, shadows on, ACESFilmic tone mapping, SRGB output. Camera is PerspectiveCamera(28, 0.5, 400).
- The canvas fills the container (100%/100%, display block). A ResizeObserver on the container, plus window resize for zoom/DPR changes, sets pixelRatio = min(dpr, maxPixelRatio 1.5) × renderScale (clamped 0.25..1), calls setSize, updates the camera aspect and emits 'resize' {width, height, pixelRatio}. If the container is document.body, the canvas is position:fixed and sized to the window.
- setAnimationLoop runs the contract frame order exactly. delta is clamped to 1/20 s and multiplied by timeScale.
- Systems are sorted by order, with ties kept in insertion order.
- A throwing system, listener or render function is logged once by name via console.error. Later ones still run, the loop keeps going, and an 'error' event is emitted.
- window.__engine is set when the URL has ?debug or ?autostart.
- dispose() stops the loop, calls each system's dispose in reverse order, removes input listeners and observers, walks the scene disposing geometry, materials and textures, calls renderer.dispose + forceContextLoss, removes the canvas and clears window.__engine.
- Extras:
  - time also has realDelta, realElapsed and a smoothed fps.
  - step(realDt) advances one frame manually.
  - Getters: running, canvas, drawingBufferSize, systems.
  - resize().
  - Events 'start', 'stop', 'dispose', 'contextlost', 'contextrestored'.
  - Options preserveDrawingBuffer, inputTarget and exposeGlobal.
  - Exported helper disposeObjectTree(root).

Input(target = window, opts)
- Default bindings are exactly as in the contract (exported as DEFAULT_BINDINGS).
- Pressed/released edge sets last until endFrame, so a key tapped between frames still registers.
- preventDefault is called only for bound keys, never while Ctrl, Meta or Alt is held. Keys typed while focus is in an input, textarea, select or contenteditable element are neither registered nor prevented.
- Window blur and hidden visibility release every key (release edges fire).
- Wheel deltaY is accumulated and normalised for deltaMode. Wheel events over lil-gui panels, form fields or [data-input-ignore] are ignored.
- pointer is {x, y, down}, plus extras buttons and inside.
- Gamepad (standard mapping) is polled in update() once a gamepadconnected event has been seen. The left stick uses a 0.2 radial, rescaled deadzone. Buttons appear as virtual codes (GamepadA, GamepadB, GamepadLB, GamepadRB, GamepadRT (analog, threshold 0.35), GamepadDpadUp, …), usable with isDown/wasPressed and through the new padBindings table: A = confirm, B = cancel, LB/RB = camLeft/camRight, RT = run, d-pad = move, Y/X = zoomIn/zoomOut, Start = help, Back = photo. *[Errata: Back / View = `map` and the right-stick click (`GamepadRS`) = `photo` — see the table at the top.]*
- getMoveVector(out?) combines keys and stick, with length ≤ 1. It returns a reused object.
- Extras: anyPressed(), consumeAction(name) (swallows a pressed edge, e.g. for a dialog), getLookVector() (right stick), gamepad info object, reset(), deadzone, triggerThreshold.

CameraRig(camera, opts)
- Option defaults: pitch 32°, yaw 0°, distance 24 within [14, 36], fov 28, followLambda 5, lookAhead 1.0, targetOffsetY 1.0, freeYaw false.
- Camera position uses exactly the contract formula (test shows 0 error).
- Focus, yaw, pitch and distance are smoothed with damp().
- Look-ahead: up to `lookAhead` units in the direction of the target's smoothed XZ velocity, reached at 4 u/s.
- bounds clamp the focus point.
- Shake uses smooth valueNoise2 in the camera's right/up axes plus a little roll, with quadratic decay.
- Holding Q/E rotates at 70°/s (the right stick also rotates). yawTarget is clamped to ±60° around the initial yaw unless freeYaw.
- The wheel (0.012 units per px) and held zoomIn/zoomOut (14 u/s) change distanceTarget, clamped.
- update() writes globalUniforms.uCameraYaw and uCameraPosition.
- getMoveBasis(out?) returns forward = camera→focus direction on XZ, and right. The object is reused.
- update(dt, input) also accepts the engine-system signature (dt, t, engine).
- setTarget accepts an Object3D or a Vector3.
- A target jump of more than autoSnapDistance (8) in one frame auto-snaps the camera.
- Extras: toWorldDirection(x, y, out), zoomIn/zoomOut(amount), setAngles(yawDeg, pitchDeg), fov accessor, shakeAmount, inputEnabled, velocity, lookOffset, yawCenter, plus tuning options (yawLimit, rotateSpeed, rotateLambda, zoomLambda, pitchLambda, zoomKeySpeed, wheelZoomScale, minPitch/maxPitch, lookAheadSpeed, lookAheadLambda).

AudioSystem({volume = 0.6})
- unlock() creates everything lazily. Graph: buses → mix → compressor (threshold −14 dB, knee 12, ratio 3) → master gain → output. A reverb send feeds a ConvolverNode with a generated stereo impulse (pre-delay, early reflections, tail that darkens over time). unlock() returns Promise<ready>.
- Before unlock, every call is a silent no-op, but ambience levels and a startMusic() request are remembered and applied on unlock.
- ready, masterVolume and muted work as specified.
- playSfx(name, {volume, pitch}) supports all 8 names:
  - step: filtered noise tick + low thump, random pitch, alternating pan
  - blip: soft triangle/square tick
  - confirm: two-note inharmonic bell
  - cancel: descending triangle notes
  - open/close: Karplus-Strong harp glissando up/down
  - chime: bell arpeggio + sparkles
  - splash: noise with lowpass sweep + droplets
- Each sfx has a minimum re-trigger interval and there is a voice cap.
- setAmbience({wind, birds, crickets, fire, water}) crossfades each layer smoothly:
  - wind: LFO-swept bandpassed brown noise, gusts, airy whistle, pan drift
  - birds: scheduled FM/sweep chirps, 3 species, random intervals
  - crickets: pulse trains on sine carriers + distant chorus
  - fire: rumble + hiss + clustered Poisson crackles
  - water: two bandpassed flows + bubbles
- Layers are created on demand and torn down after fading to silence.
- Music: "Emberfall Evening" at 72 bpm, 4/4, a 2-bar intro followed by a looping 16-bar progression. A section is D dorian (Dm C G Dm F C G Am, with add9/maj7 colours); B section is D mixolydian (D C G D Em G C D). Harp is cached Karplus-Strong plucks with fractional-delay tuning in rolling triplet arpeggios plus bass. Pads are detuned saws through a breathing lowpass with a slow attack. The flute-like melody is sine + triangle with delayed vibrato and breath noise.
- A 40 ms lookahead timer (0.35 s window) schedules notes and also runs from update(). startMusic/stopMusic fade; musicPlaying works as specified.
- update(dt) and dispose() (closes the context) as specified.
- Extras: musicVolume / sfxVolume / ambienceVolume properties, ambience getter, toggleMusic(), setAmbience options {replace, fade}, playSfx options {pan, delay}, opts.context (use a provided or Offline AudioContext) with prescheduleOffline(seconds) for offline rendering. Exports SFX_NAMES and AMBIENCE_LAYERS.
- Offline measurements at master 0.6: music RMS about −21 dB (peak −9), sfx peaks −8 to −10 dB, ambience layers −25 to −41 dB RMS at level 1. No NaNs.

Sandbox
- sandbox/core.html and core.js build a golden-hour diorama with pixel textures made through PixelCanvas: grass, a raised flagstone plaza with normal maps, crates, brick pillars with warm lantern point lights, bushes, fog, shadows and a CSS vignette.
- A floating crystal marker moves with WASD (Shift runs) relative to the camera basis, collides with crates and pillars, and plays footsteps.
- Q/E rotate, the wheel and Z/X zoom, Space triggers confirm sfx + shake, M toggles music.
- A live readout shows keys, edges, actions, move vector, pointer, gamepad, camera values and audio state. A gold-bordered control panel has sfx, ambience and music controls plus an oscilloscope on the master output.
- window.__core exposes runAllTests, the individual tests, exerciseAudio, analyzeAudio (offline render plus a spectrogram overlay) and teardown.

### Deviations / additions
Two things differ from the contract text:

1. **Shadow map type.** In three r186, PCFSoftShadowMap has been removed: WebGLShadowMap logs "PCFSoftShadowMap has been removed. Using PCFShadowMap instead" every time it is set. In r186, PCFShadowMap is itself the soft, radius-aware filter. So Engine defaults to THREE.PCFShadowMap and silently maps an explicit PCFSoftShadowMap to it. Setting PCFSoftShadowMap literally would add a console warning on every page.
2. **Readable engine-system name.** CameraRig has `name = 'CameraRig'` so the engine's error log shows a readable name.

Interpretations where the contract was open:
- setAmbience changes only the layers you pass; pass {replace: true} to fade out the rest.
- musicPlaying reports intent, so it is already true if startMusic() was called before unlock().
- lookAhead is in world units, reached at 4 u/s target speed.
- The ±60° yaw limit is measured around the initial yaw.
- Wheel scroll down means zoom out.
- camLeft (Q) decreases yaw.

Everything else is additive extras, listed in the API summary.

### Integrator notes (auditor)
**Contract compliance**
- Every member in contract section 4.1 is present with the specified names, defaults and return shapes. The rest are additive extras.
- Deliberate deviation: the shadow map type is `PCFShadowMap`. r186 removed `PCFSoftShadowMap` and prints a warning every time it is set; in r186 `PCFShadowMap` is itself soft and uses `shadow.radius`. An explicit `PCFSoftShadowMap` is mapped to it silently. LightingSystem does the same.

**Frame order and wiring**
- Update the CameraRig after gameplay moves the player, and before SpriteManager and Foliage. Those read `globalUniforms.uCameraYaw`. For example:
  - `engine.addSystem({ name: 'camera', lateUpdate: (dt) => rig.update(dt, engine.input) }, 100)`
  - then SpriteManager at a later order, or in lateUpdate after the rig.
- `rig.update(dt, t, engine)` also works if you register the rig directly as a system; it then takes the input from `engine.input`.
- After `rig.setTarget(player)` at scene start, call `rig.snap()`. Otherwise the camera pans over from the origin.
- A target jump of more than 8 units in one frame (for example a teleport) snaps automatically.
- Use `rig.getMoveBasis()` or `rig.toWorldDirection(mv.x, mv.y, out)` with `input.getMoveVector()` for camera-relative movement. It returns reused objects.
- Set `rig.bounds` to the map's extents.
- `rig.focusDistance` feeds `postfx.setFocus()`.
- `rig.inputEnabled = false` freezes Q/E and zoom during dialogs.

**Resize**
- The engine emits `'resize' {width, height, pixelRatio}` once on the first `start()` and on every real change.
- `PostFX.setSize(width, height, pixelRatio)` matches this signature, and PostFX also re-syncs itself every frame.

**Input**
- `DialogBox.update` and the player's talk check both read `actionPressed('confirm')`. Use `input.consumeAction('confirm')` in whichever runs first, so one press doesn't close a line and re-open a talk.
- Bound keys (Space, Enter, arrows, F1, Esc, Backspace) are `preventDefault`-ed, except while focus is in an input, textarea, select or contenteditable element. So a focused HTML button will not activate on Space or Enter; blur UI buttons after a click.
- `input.enabled = false` zeroes every query, including `wheelDelta`.
- Gamepad codes (`GamepadA` and so on) work with `isDown` and `wasPressed`.

**Audio**
- Call `audio.unlock()` only from a user gesture, for example the TitleScreen "press any key" handler. Creating the context outside a gesture makes Chrome log "AudioContext was not allowed to start".
- `startMusic()` and `setAmbience()` before unlock are remembered and applied on unlock.
- `setAmbience` changes only the keys you pass. Use `setAmbience({...}, { replace: true })` to fade out the others.
- `engine.addSystem(audio, order)` is supported (`update(dt)`).
- `playSfx` returns false when locked, rate-limited or over the voice cap.

**Teardown**
- `engine.dispose()` calls `dispose()` on every registered system in reverse order, then disposes the whole scene: geometries, materials and textures, including shared ones.
- Modules registered as systems must tolerate being disposed twice (they already guard this), or you can pass `{ disposeScene: false }`.
- `window.__engine` is set when the URL has `?debug` or `?autostart`.

**Files changed**
- `src/engine/audio/AudioSystem.js`
- `src/engine/core/Input.js`
- `src/engine/core/Engine.js`
- `sandbox/core.js`
- `sandbox/core.actions.json`

No foundation files were modified.

### Known limitations
- **Audio is unheard.** Headless Chrome produces no audible output, so I judged the sound by numbers and pictures, not by ear. I rendered offline to measure levels and check for NaNs, drew spectrograms (the pitches line up with the chord and melody plan), and watched a live oscilloscope on the master output. Someone should do a listening pass for taste: mix balance, how loud the harp attack is, and the melody.
- **Mild pluck transients.** The harp plucks show broadband attack transients in the spectrogram. I softened the excitation (two-pole lowpass plus a pluck-position comb) and they now look like normal pluck onsets, not clicks.
- **Background-tab audio.** Music and ambience are scheduled from both a 40 ms timer and update(). In a throttled background tab late events are skipped rather than played in a burst. By default the AudioContext is suspended while the tab is hidden anyway.
- **Gamepad needs a first press.** Polling starts only after the browser fires gamepadconnected, which needs a button press on that page (the standard Gamepad API rule). The simulated-pad test covers the logic.
- **Harp buffer memory.** Plucks are pre-rendered lazily per MIDI note at 32 kHz, about 18 notes and roughly 5 MB total for the whole song. *[Errata: 23 notes, ≈ 7.7 MB once all are rendered.]*
- **Engine.dispose() frees the whole scene.** It walks the scene and disposes all geometries, materials and textures, including shared ones. Pass {disposeScene: false} to skip that.
- **Button activation and Space.** preventDefault on bound keys also stops Space/Enter from activating a focused button (intended: confirm should not click UI). The sandbox blurs its buttons after a click.
- **FPS.** The GPU was shared with other agents during checks; the sandbox measured about 60 fps.

### Remaining audit issues
- Audio has only been checked by numbers, not by ear. Offline renders show no NaNs, music about -22 dB RMS (peak -9), sfx peaks -8 to -10 dB, ambience -27 to -41 dB RMS. Someone should still listen to judge the mix and the melody.
- Before-unlock no-ops are an interpretation of the contract. setAmbience() only changes the layers you pass. To fade out the layers you leave out, pass {replace: true}. musicPlaying reports intent: it is already true if startMusic() was called before unlock().
- Some cleanup uses wall-clock timers. SFX panners and the music bus disconnect via setTimeout, not the audio clock. If the tab is hidden while an sfx tail is still ringing (the context suspends), that tail can be cut when the tab comes back. This is minor.
- Harp pluck buffers are rendered synchronously the first time each note is used, about 0.5 to 1 ms per note and about 18 notes in total *[Errata: 23]*. This happens during the first bars of the music, not at unlock.
- In full-window mode (container = document.body), size comes from window.innerWidth/innerHeight. If the page has a visible scrollbar the canvas is stretched by the scrollbar width. index.html should keep overflow: hidden. *[Errata: the game page is `game.html` (2026-10-11); it keeps `overflow: hidden`.]*
- The Q/E yaw limit is ±60° around the initial yaw given to the constructor, not around world yaw 0.

## postfx

### Files
- src/engine/render/PostFX.js
- src/engine/render/shaders/DofShaders.js
- src/engine/render/shaders/GradeShader.js
- src/engine/render/shaders/BloomShaders.js
- src/engine/render/shaders/PostCommon.js
- sandbox/postfx.html
- sandbox/postfx.js
- sandbox/postfx.actions.json
- sandbox/postfx.robust.json
- sandbox/postfx.flicker.json
- sandbox/postfx.nan.json
- sandbox/postfx.perf.json

### API summary (builder)
PostFX (src/engine/render/PostFX.js) implements contract 4.2 exactly.

Constructor: `new PostFX(renderer, scene, camera, { samples = 4, dofScale = 0.5, maxTaps = 96 })`. Contract `settings` object with every contract default. `setSize(width, height, pixelRatio)` takes CSS px and uses floor(w*pr), as the renderer does. `render()` also re-syncs to `renderer.getDrawingBufferSize()` every frame, so resize, pixel-ratio and renderScale changes need no extra call.

`setFocus(distance, immediate = false)`: with `autoFocus` on, `focusDistance` damps toward the target at `focusSpeed` (default 4 /s). Verified 24 → 28.9 after 150 ms → 34.0 after 2.6 s. With `autoFocus` off the target is stored and `focusDistance` stays manual.

`render(dt)` runs:
- scene into a HalfFloat target with 4x MSAA and a DepthTexture, resolved by blit;
- DOF at half res: MRT prefilter, golden-angle scatter-as-gather (48/64/96 taps), CoC-aware 3x3 tent, highlight point-sprite scatter, then a full-res composite with bilateral upsample;
- UnrealBloomPass;
- OutputPass (ACES from `renderer.toneMapping` / `toneMappingExposure`, plus sRGB);
- grade pass to the screen.

With `settings.enabled = false` the renderer draws straight to the screen. Every toggle and slider is read each frame (verified live).

`get depthTexture()` returns the resolved scene DepthTexture. MSAA depth resolve is proven: `probeDepth()` reads linear depth exactly 24.00 at the focus object, 19.4 at the bottom edge and 40.3 at the top, and the CoC debug view is correct. `dispose()` frees everything; 5 rebuilds leave texture, geometry and program counts unchanged.

Extra public API:
- `warmup()` precompiles all shader variants so later setting changes don't hitch.
- `get sceneTarget`, `get size` ({ width, height, dofWidth, dofHeight }), `get taps`.
- `enableTimings(on)`, `get timings` (EMA ms per stage), `get timingsMin` (via EXT_disjoint_timer_query_webgl2).

Extra settings:
- `dof.debug` (false): CoC view with near = amber, far = blue, focus = green, near-field spill = magenta.
- `dof.bokehThreshold` (1.5, HDR, divided by `toneMappingExposure`), `dof.bokehSprites` (true), `dof.tiltFeather` (0.3), `dof.focusSpeed` (4).
- `bloom.warmth` (0.25), `bloom.knee` (0.35).
- `grade.vignetteRoundness` (0.65), `grade.vignetteColor`, `grade.grainSize` (1), `grade.dither` (1).

Orthographic cameras are handled in the CoC.

Shader modules: DofShaders.js exports `createCocUniforms`, `DOF_COC_GLSL`, `DofPrefilterShader`, `goldenAngleKernel`, `createDofGatherShader(taps)`, `DofTentShader`, `DofBokehSpriteShader`, `DofCompositeShader`. The others are GradeShader.js (`GradeShader`), BloomShaders.js (`BloomBrightPassShader`) and PostCommon.js (`FULLSCREEN_VERTEX`, `POST_COMMON_GLSL`, `CopyShader`).

Measured best-case GPU time at 1600x900 on the reference desktop GPU (shared GPU, so minimum over frames): scene about 1.1 ms, DOF chain 0.75–1.05 ms (highlight sprites about 0.25 ms of that), bloom 0.30 ms, output + grade 0.25 ms.

### Deviations / additions
No contract names or signatures changed. The following are behaviour choices and additions:

1. **bokehBoost is a gain on a highlight-scatter pass, not a weight inside the gather average.** Weight-boosting in the gather gave stippled, overexposed discs at large blur. It also flickered (tile luminance second-difference 5.9 vs 0.8 baseline).
   - Highlight energy above bokehThreshold (smooth ramp from T to 2T, decided per full-res pixel) is moved from the gather into anti-aliased point-sprite discs of the pixel's own CoC.
   - The share moved is scaled by isolation (neighbourhood mean vs local peak), so lone specks become crisp boosted discs while large bright areas stay in the normalised gather (no dark halos).
   - Far discs use the gather's min(CoC) visibility rule and are attenuated by near coverage; near discs go to their own layer composited on top.
   - `dof.bokehSprites = false` gives a pure-gather fallback.
2. **UnrealBloomPass's stock bright pass is replaced** by a subtractive soft-knee pass (same uniform names, NaN-scrubbed, firefly-clamped). The stock pass forwards whole pixels above threshold, which washed the frame out. `bloom.threshold` therefore means: HDR energy above it blooms.
3. **Bloom sizing.** UnrealBloomPass is sized to the full buffer, so its bright pass and first mip are at half resolution (it halves internally). Sizing it at half res would undersample small highlights.
4. **CoC curve specifics.**
   - Fully sharp within focusDistance ± focusRange/2, then a smoothstep ramp to 1 over 1.5 × focusRange, times nearScale or farScale.
   - Tilt term: tiltShift, ramped in over `tiltFeather` (0.3 uv) outside tiltCenter ± tiltWidth/2. The final value is the larger magnitude; its sign follows the depth side, or the screen side inside the focus band.
   - Kernel radius = maxBlur × H/1080 × max(scales) × dofScale.
5. **Gather tap count** steps 48 → 64 → 96 (bounded by maxTaps) to keep about 0.3 taps/px² when maxBlur is raised. 48 is used at the defaults. *[Errata: the count follows the drawing-buffer height — 48 only up to ~917 px, then 64 and 96; the game caps it at 64.]*
6. **Composite small-CoC blur.** For |CoC| of 0.3–4 px the composite adds a 12-tap full-res, depth-aware disc blur. The half-res layer only takes over above 2–4 px, so the focus falloff is gradual while the in-focus band stays pixel-exact.
7. **Debug view** renders straight to the screen, skipping bloom and grade. It works even when dof.enabled is false.
8. **DOF off with bloom on** copies the resolved scene into a non-MSAA HDR target first. three invalidates the MSAA colour buffer after resolve, so blending into it is invalid.
9. **Grade dither** is an 8×8 Bayer matrix; film grain advances at 24 fps.

### Integrator notes (auditor)
Contract 4.2 is implemented exactly, and the additions are strict supersets:
- setFocus(distance, immediate=false)
- warmup()
- getters: sceneTarget, size, taps, timings, timingsMin, sceneInfo
- enableTimings(on)
- extra settings: dof.debug / bokehThreshold / bokehSprites / tiltFeather / focusSpeed; bloom.warmth / knee; grade.vignetteRoundness / vignetteColor / grainSize / dither

Wiring:
1. PostFX does NOT set renderer.toneMapping. The Engine must keep ACESFilmicToneMapping and SRGB output, because OutputPass reads them (and LightingSystem's toneMappingExposure). With settings.enabled=false the renderer tone-maps straight to the screen.
2. Use engine.setRenderFn((dt) => postfx.render(dt)). Calling postfx.setSize(width, height, pixelRatio) on the Engine 'resize' event is optional, because render() re-syncs to renderer.getDrawingBufferSize() every frame (renderScale and pixel ratio are picked up automatically).
3. Each frame, before render, call postfx.setFocus(distance). autoFocus damps toward it at dof.focusSpeed (4/s). Pass immediate=true after teleports. The value is compared with linear view depth, so the best subject is the player's view depth (`-(camera.matrixWorldInverse × playerChest).z`); `cameraRig.focusDistance` drifts off the player wherever the rig's focus bounds clamp (Emberfall focuses on the player while playing).
4. Call postfx.warmup() once at load (e.g. under the title screen) to avoid first-use shader hitches (gather variants up to `maxTaps`, debug view, bloom, output). warmup() draws every pass into the kind of target it uses at runtime (grade and the CoC debug view to the screen, the rest to render targets): three keys programs by the bound target's colour space / tone mapping, so a pass warmed against the wrong target compiles an unused variant.
4b. Scene materials: compile them with the scene target bound — `renderer.setRenderTarget(postfx.sceneTarget); await renderer.compileAsync(scene, camera); renderer.setRenderTarget(null)`. Compiling with no target bound builds the sRGB screen variants, which the HDR pipeline never uses (Emberfall: 84 → 57 programs, first frame 3.2 s → ~0.4 s). A few frames drawn behind the loading screen then absorb what ANGLE finishes lazily at first draw (shadow-depth variants).
5. For DebugPanel stats, read postfx.sceneInfo.calls / .triangles. renderer.info auto-resets on every post pass, so it only shows the last pass (1 call).
6. grade.shadowsTint, highlightsTint and vignetteColor are plain [r,g,b] arrays.
7. dof.debug renders the CoC view straight to the screen (near = amber, far = blue, focus = green, near spill = magenta) and skips bloom and grade.
8. three r186 has removed PCFSoftShadowMap: it logs a warning and falls back to PCFShadowMap. Engine should use THREE.PCFShadowMap plus shadow.radius, even though the contract text says PCFSoftShadowMap.
9. Depth-based DOF needs depth. Opaque or alpha-tested geometry (water included) should write depth. Additive glows and particles without depth take the CoC of what is behind them. A sky dome with depthWrite=false reads as far, so it is maximally blurred, which is correct.
10. Non-finite scene pixels (NaN/Inf) are scrubbed to black, so they never smear through the blur or bloom.
11. Keep dofScale at 0.5 (default); 0.25 aliases in the prefilter.

### Known limitations
- **For the core agent:** three r186 has removed PCFSoftShadowMap. Using it logs "WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead." ARCHITECTURE.md tells Engine to use it; the sandbox uses PCFShadowMap to stay warning-free.
- **For the integrator:** PostFX does not set `renderer.toneMapping`. It must be ACES on the renderer, because OutputPass reads it.
- **Temporal stability.** Measured by panning in 1-px steps (grain off):
  - Per-pixel shimmer in blurred regions is about 0.8–1.0 vs 4.6–6.7 with DOF off.
  - Frame-to-frame determinism is 0 to 0.0014 / 255.
  - A residual ±0.5 / 255 tile-mean alternation from the half-res sampling phase remains; it is not visible.
- **Occlusion of bokeh sprites.** Far discs obey the gather's min(CoC) rule. Near discs are drawn on top without occlusion by other near geometry.
- **Upright sprites a few units behind focus keep sharp tops**, because a 32° pitch puts their upper parts close to the focal plane. This is physically correct; top-of-frame softness comes from tilt-shift (tunable via tiltShift / tiltFeather).
- **Depth sampling at edges.** The MSAA depth resolve picks one sample (NEAREST blit), so the CoC at anti-aliased silhouettes comes from that one sample.
- **Non-finite scene values** (NaN/Inf) become black pixels, contained so they never smear through the blur or bloom.
- **Untested paths:** orthographic cameras are only exercised in code, not in the sandbox. dofScale 0.25 and 1 were only checked visually.
- **Timing accuracy.** GPU timings are noisy while other agents share the GPU; the numbers above are per-stage minimums.
- **First-use hitch.** The gather variants compile on first use unless `warmup()` is called at load; scene materials need the target-bound compile described in integrator note 4b.

### Remaining audit issues
- There is still a small grid-phase alternation (about 4/255 mean over a 60x50 px window) for one near firefly that is partly occluded by the dark outline of a near bush. It is not visible in step-by-step crops, and whole-frame flicker now equals the no-sprite baseline.
- dofScale 0.25 (not the default): the prefilter reads only a 2x2 footprint of each 4x4 block, which aliases. Keep dofScale at 0.5 (default) or 1. This limitation predates the audit.
- Near bokeh sprites are drawn on top without being occluded by other near geometry. The builder documented this; it is not visible in the diorama.
- The orthographic-camera CoC path exists only in code; the sandbox does not exercise it.
- Transparent or additive FX that don't write depth (particles, god rays) take the CoC of the surface behind them. This is inherent to depth-based DOF.

## sprite_art

### Files
- src/engine/pixel/CharacterSprites.js
- src/engine/pixel/PropSprites.js
- sandbox/sprite_art.html
- sandbox/sprite_art.js
- sandbox/sprite_art.actions.json

### API summary (builder)
CharacterSprites.js
- createCharacterSheet(spec = {}) -> SpriteSheet { texture, canvas, frameWidth: 32, frameHeight: 32, columns: 6, rows: 4, pixelsPerUnit: 16, anchor: [0.5, 0], animations, name, spec, dispose() }.
  - Rows follow DIRECTIONS (down, left, right, up). Columns are [idle0, idle1, walk0 contact, walk1 passing, walk2 contact, walk3 passing].
  - Animations for each direction d: idle_d (2 frames, 2.5 fps), walk_d (4 frames, 8 fps), run_d (same 4 frames, 13 fps), all loop: true.
  - Texture: NearestFilter min and mag, generateMipmaps false, SRGBColorSpace, ClampToEdge (checked in the page).
  - Adults: feet on row 30, outline on row 31, 27 px tall plus outline, head 12 px wide and about 11 px tall. Child build is about 20 px tall.
  - Spec (contract fields, all working): preset, seed, skin, hair, hairStyle ('short'|'long'|'ponytail'|'bald'|'spiky'|'bun'), outfit { top, bottom, accent }, cape, hat ('none'|'hood'|'wide'|'cap'|'helmet'|'circlet'), weapon ('none'|'sword'|'staff'|'bow'|'lute'), beard. Colours are PALETTE ramp names or hex.
- CHARACTER_PRESETS: traveler, swordsman, merchant, cleric, scholar, dancer, hunter, villager, farmer, elder, child, guard, innkeeper, bard (plain spec objects).
- createCreatureSheet(kind, spec = {}) for 'cat' | 'dog' | 'chicken' | 'bird'. Same row order and animation names; unknown kinds fall back to cat.
  - Frame sizes: cat 24x16, dog 28x20, chicken 18x16, bird 16x16. Anchor [0.5, 0], feet 1 px above the frame bottom (outline row).
  - Optional colour overrides: fur, fur2, fur3, eyes, nose, beak, comb.
  - Cat: tabby with tail sway and a blink idle. Dog: tail wag. Chicken: pecking idle. Bird: hop cycle.
- Extra export: materialRamp(spec, {base}) returns a 5-tone ramp [deep, shadow, base, light, shine].

PropSprites.js
- createPropSprite(kind, { seed } = {}) -> { texture, canvas, width, height, pixelsPerUnit: 16, anchor: [0.5, 0], frames?, fps?, frameWidth, frameHeight, sheetWidth, columns, kind, dispose() }.
  - Same seed gives identical pixels. Unknown kind throws.
- PROP_SPRITE_KINDS (23): grass_tuft 16x12, grass_tall 16x24, flower_red 13x15, flower_yellow 12x12, flower_white 14x14, flower_blue 12x14, bush 24x18, fern 20x16, reeds 14x26, mushroom 13x11, rock_small 14x9, campfire 24x26 (8 frames at 10 fps), torch_flame 10x16 (6 frames at 12 fps), candle_flame 5x8 (4 frames at 9 fps), speech_bubble 17x15, exclamation 6x15, sparkle 11x11, leaf 7x6, petal 5x4, ember 5x5, smoke_puff 24x24, dust 4x4, bokeh_soft 32x32.
- Textures are Nearest, no mipmaps, SRGB, ClampToEdge, except smoke_puff and bokeh_soft, which use LinearFilter so they stay soft.
- Plants have binary alpha, which works with alphaTest. Particles use soft alpha.

### Deviations / additions
No contract member was renamed or changed in meaning. Additions and interpretations other modules should know about:
1. PropSprites width/height are the size of ONE frame in pixels (world size = px / 16). For animated kinds the canvas is width * frames wide. Extras frameWidth, frameHeight, sheetWidth, columns and kind make this explicit. A consumer that reads width as the whole strip will get campfire and torch quads 6-8 times too wide.
2. Every prop kind, particles included, returns anchor [0.5, 0], exactly as the contract lists it. Particles can simply ignore the anchor and centre themselves.
3. Extra spec fields on createCharacterSheet: outfit.style ('tunic'|'vest'|'robe'|'dress'|'dancer'|'overalls'|'tabard'), outfit.shirt, eyes, blush, female, build ('normal'|'stout'|'elder'|'child'), gear { satchel, pack, quiver, scarf, pauldrons, bracers, gloves, glasses, book, apron, sash, sashes, boots, leather, belt, staffGem }, hatColor, hatBand, feather (the cap's feather only appears when this is set).
4. Extra spec values: weapon 'spear' and 'cane'. cape can be false, a colour, true, or { color, style: 'cloak'|'cape'|'short', lining }. beard can be true ('full'), 'full', 'mustache', 'goatee', or a colour (full beard in that colour).
5. randomize: true, or preset: 'random', builds a seeded random villager that fills every field the caller did not set.
6. An explicit seed on a preset now adds a subtle deterministic colour variation (hue/lightness of top, bottom and hair, plus eye colour, only where not overridden) so crowds vary. With no seed, presets render exactly as designed.
7. SpriteSheet extras: name, spec (the resolved spec) and dispose(). Prop results also have dispose().
8. The right-facing row is the left row mirrored, so its light comes from the upper-right. Asymmetric gear is redrawn on the correct side: the sword on the left hip sits behind the body when facing right, the pole goes in the right hand, and the satchel moves to the correct hip.

### Integrator notes (auditor)
Files changed: src/engine/pixel/CharacterSprites.js, src/engine/pixel/PropSprites.js, sandbox/sprite_art.actions.json.

- **Prop size:** `createPropSprite()` `width`/`height` are ONE frame in pixels (world size = px / 16). Animated kinds are a horizontal strip `width * frames` wide (`sheetWidth`). Never use `width` as the strip width.
- **Props in Sprite3D:** every prop result is also a valid one-row SpriteSheet (`frameWidth`, `frameHeight`, `columns`, `rows: 1`, `animations`). Animated kinds (campfire 8f @ 10 fps, torch_flame 6f @ 12, candle_flame 4f @ 9) have a looping `idle` that Sprite3D auto-plays. Pass them straight to `new Sprite3D(createPropSprite('torch_flame'), { emissive, ... })` (verified). `spriteSheetFromProp()` returns them unchanged.
- **Foliage:** takes the prop object directly; static kinds have binary alpha, which suits alphaTest 0.5.
- **Particle textures:** smoke_puff and bokeh_soft use LinearFilter (soft alpha). sparkle, ember and dust use soft alpha, so use additive/transparent blending rather than alphaTest.
- **Character sheets:** 32x32 frames, 6 columns [idle0, idle1, walk0-3] x 4 rows (down, left, right, up). Anchor [0.5, 0], PPU 16, about 2 units tall. Feet are on row 30, with the outline on row 31.
- **Animations:** `idle_<dir>` (2.5 fps), `walk_<dir>` (8 fps), `run_<dir>` (same frames, 13 fps), all looping.
- **Spec shortcuts:** `createCharacterSheet('traveler')` works as a shorthand. `{ preset, seed }` gives a subtle deterministic colour variation for crowds. `{ randomize: true, seed }` builds a seeded random villager.
- **Colours:** PALETTE ramp names, hex strings, 0xRRGGBB numbers, THREE.Color or CSS names.
- **Extra spec fields:** outfit.style ('tunic'|'vest'|'robe'|'dress'|'dancer'|'overalls'|'tabard'), outfit.shirt, gear {satchel, pack, quiver, scarf, pauldrons, bracers, gloves, glasses, book, apron, sash, sashes, boots, leather, belt, staffGem}, hatColor, hatBand, feather, eyes, blush, female, build ('normal'|'stout'|'elder'|'child').
- **Extra weapons:** 'spear' and 'cane'.
- **Creatures:** `createCreatureSheet(kind)` frames are cat 24x16, dog 28x20, chicken 18x16, bird 16x16. Same row order and animation names; unknown kinds fall back to cat.
- **Generation cost:** about 3-5 ms CPU per character sheet, once, and it needs a DOM. Cache and share sheets for identical specs, e.g. one chicken sheet for all chickens.
- **Disposal:** each result has `dispose()`, which frees only its own texture. Sprite3D clones must be disposed by their owners.
- **UV inset:** frames touch the top row in bob frames, so a half-texel UV inset in Sprite3D would be a safe future hardening.

### Known limitations
- Frames use the full 32 px height, as the contract requires. In the 1 px bob frames, the outline of tall hats and spiky hair touches the frame's top row. No actual content is clipped (checked in the page). Sprite3D should still inset frame UVs by half a texel so NEAREST sampling does not bleed between the stacked rows of the sheet.
- The right-facing row flips the upper-left light to the upper-right, as noted above.
- Creature art is simpler than the characters. The cat and dog back views are basic, and the dog's front body is somewhat tall.
- The child build reuses the adult head template, so it has a very large head (intentional chibi look) and 2-row arms.
- There are no optional talk or wave columns; sheets have exactly 6 columns.
- Sheets are generated on the CPU into canvas elements, which needs a DOM. That takes about 3-5 ms per sheet and runs once, not per frame.
- Only the returned texture is a GPU resource. Clones made by sprites must be disposed by whoever owns them.
- The sandbox's 3D strip uses a small local stand-in for Sprite3D: plain lit quads with shadow depth materials, no billboard rotation, and a fixed camera at yaw 0.

### Remaining audit issues
- Every frame uses the full 32 px height. In the 1-px bob frames, the outline of tall hats, spiky hair and spear tips touches row 0 of the frame, and the bottom row holds the feet outline. Content is never clipped (checked). There is no bleed at the diorama camera's magnification, but the frames have no transparent gutter, so under heavy minification NEAREST could sample the neighbouring row. Sprite3D currently does no half-texel inset. This is a Sprite3D-side concern.
- The right-facing row is the left row mirrored, so light comes from the upper-right on that row. Asymmetric gear is still redrawn on the correct side.
- Minor art: creature back views are basic. The scholar's white hair (hairWhite ramp at base 3) reads as a bright, fairly flat dome. Seeded random NPCs have limited variety (two of seven samples share a similar blue top).
- Sheets are generated on the CPU into DOM canvases: about 3-5 ms per character sheet, about 100 ms for the whole 55-asset gallery. They need `document`, so they will not run in a Worker.
- The creature return object has no `spec` field (character sheets do). This is not required by the contract.

## sprite_runtime

### Files
- src/engine/sprite/Sprite3D.js
- src/engine/sprite/SpriteManager.js
- src/engine/sprite/Foliage.js
- src/engine/fx/Particles.js
- sandbox/sprite_runtime.html
- sandbox/sprite_runtime.js
- sandbox/sprite_runtime.actions.json

### API summary (builder)
All four modules are finished and match contracts 4.4 and 4.5. The final sandbox run had 0 page errors, 0 console errors, 0 warnings and ran at 60 fps.

**Sprite3D** (`src/engine/sprite/Sprite3D.js`): `class Sprite3D extends THREE.Group`, built as `constructor(sheet, opts)`.
- **Contract options and defaults:** billboard 'cylindrical', tilt 0, castShadow true, shadowMode 'sunFacing', blobShadow true, lit true, alphaTest 0.5, emissive, emissiveIntensity 1, scale 1, renderOrder 0.
- **Contract members:** mesh, sheet, animation, direction, `play(name, {restart, speed})`, `setDirection` (keeps frame phase), `setFrame`, playing, speed, flipX, tint (the material colour), opacity, `update(dt, camera)`, `dispose()`.
- **Structure:** the group origin is the feet. The quad is frameWidth/PPU × frameHeight/PPU, pivoted at sheet.anchor.
- **Texture:** each sprite gets a per-instance clone animated via offset/repeat (negative repeat for flipX). `cloneSharedTexture` restores `source.version`, because `Texture.copy()` would otherwise bump it. Verified: spawning 10 sprites at runtime adds 0 texImage/texSubImage/texStorage calls and 0 GPU textures.
- **Billboard modes:**
  - 'cylindrical' uses `globalUniforms.uCameraYaw`, with optional tilt from the camera pitch.
  - 'spherical' copies the camera rotation.
  - 'none' leaves the quad alone.
- **Lighting:** MeshLambertMaterial patched in `onBeforeCompile`. The normal is bent toward a mix of toward-camera and world-up, with a horizontal "roundness" so a side lantern lights one side. Diffuse is wrap lighting, so sprites never go black with the sun behind them, and they pick up point lights warmly.
- **Opacity:** a 4x4 Bayer dither discard that works with alphaTest, in screen or texel space. The shadow and blob fade with it.
- **Emissive:** glows with the sprite's own texture colours (emissive × diffuse).
- **'sunFacing' shadows:** a proxy quad (colorWrite/depthWrite false) turns about Y to face `uSunDirection`. It casts through a customDepthMaterial (MeshDepthMaterial, RGBADepthPacking, same map, alphaTest, dither).
- **'billboard' shadows:** the visible quad casts with the same depth material.
- **Receiving shadows:** the lookup position is pushed toward the sun just past the sprite's own proxy plane, so it never shadows itself.
- **blobShadow:** a soft ellipse decal at y+0.012 (transparent, depthWrite false, polygonOffset, RENDER_ORDER.DECALS). Its texture and geometry are shared and reference-counted.

**Sprite3D extras (beyond the contract):**
- Options: receiveShadow, normalUp, wrap, roundness, ditherMode, blobSize, blobOpacity, tint, animation, direction.
- `play()` also accepts a base name ('walk' becomes walk_<direction>) and `keepPhase`. A missing left/right animation is mirrored from the other side.
- `faceVector(dx, dz, yaw?)` and `static directionFromVector()` pick a camera-relative direction, with hysteresis.
- Callbacks: `onFrameChange(frame, anim)` (the sandbox uses it for footstep bursts) and `onAnimationEnd`.
- Getters: `frame`, `size`. Live setters: `castShadow`, `receiveShadow`, `shadowMode`.
- Exported helpers: `patchSpriteLighting`, `cloneSharedTexture`, `GLSL_BAYER4`.

**SpriteManager:** `constructor(camera)`, `add`, `remove`, `get sprites`, `update(dt)`, plus `dispose({disposeSprites})`. It works as an engine system.

**Foliage:** `constructor({sprite, instances, wind = 1, castShadow = false, receiveShadow = true})`, members `object` (an InstancedMesh, one draw call), `update()` (does nothing), `dispose()`.
- The vertex shader billboards each tuft by uCameraYaw, anchored at the root. Only the top vertices sway, driven by uTime/uWind/uWindStrength with a per-instance phase and travelling gust waves.
- Per-instance scale; tint goes through instanceColor. Lighting matches Sprite3D. When castShadow is on, the depth material faces each tuft toward the sun so shadows are full silhouettes.
- Tested with 3000 tufts.
- Extras: sprite `frames` with a per-instance `frame` (or `randomFrames`), alphaTest, normalUp, wrap, roundness, rootDarken, variance, seed. Live setters: `castShadow`, `receiveShadow`, `wind`.

**Particles:** `constructor(scene)`, `createEmitter(config)` returns an Emitter `{object, enabled, intensity, position, dispose()}`, `burst(preset, position, count = 12, overrides)`, `update(dt, camera)`, `dispose()`, and `PARTICLE_PRESETS` with all 12 presets.
- **Continuous emitters:** one instanced draw each, animated entirely on the GPU from gl_InstanceID, a per-emitter seed and uTime. Motion models are drift, emit (closed-form drag + gravity + wind + turbulence), fall (tumbling) and precip (a wrapped box that can follow the camera, with rain drawn as velocity-aligned streaks).
- **Bursts:** written into a 512-slot ring buffer per material state and animated on the GPU with only the changed range uploaded. Resolved burst configs are cached, so a burst call with no overrides reuses them.
- **Blending:**
  - Glows (dust, fireflies, embers, sparkle) are additive with no depth write and HDR colour above 1. Fog fades them out.
  - Smoke, mist, rain, snow and footstep are normal-blended and mix toward the fog colour.
  - Leaves and petals are pixel cutouts with dithered fades.
  - The fog depth comes from three's standard `fog_vertex` chunk, so a game that patches that chunk (the Emberfall demo starts its fog a few units in front of the camera) fogs particles the same way as every other material.
- **Lit particles:** tinted by uSunColor plus ambient and darker at night.
- **Special behaviours:** fireflies blink and only appear when uNight is high; dust glints and dims at night.
- **Textures:** pixel-crisp procedural textures are built internally (leaf, petal, square, star, snow, pixel smoke puff) plus a soft glow. You can pass `map` and `variants` to override them.
- **intensity and enabled:** intensity scales the live count (instanceCount plus a per-particle gate) and fades alpha at low values. `enabled` toggles visibility. Verified: 320 → 80 → hidden → 320.
- Extras: `Particles.object` (the group), `Emitter.config`, `count` and `followDistance`, and `rate`/`seed` config.

### Deviations / additions
No contract member was renamed or given a different meaning. Deviations and additions:
1. **leaves/petals blending:** these default to blending 'cutout' (alpha-tested, depth-writing, dithered fade) instead of plain alpha blending, so pixel leaves sort correctly and give DOF real depth. `blending: 'normal'` can be passed to override.
2. **play() speed:** `speed` is applied only when the option is passed explicitly, so calling `play()` every frame never resets a speed the caller set. A repeated `play()` with the same name only sets `playing = true`.
3. **setFrame(col, row):** it pauses playback (`playing = false`) so the chosen cell stays until `play()` is called again.
4. **burst() count:** it keeps the contract default of 12 rather than each preset's own count. Callers should pass a count (for example 3–8 for footsteps).
5. **Particles group transform:** particle meshes assume the Particles group has an identity transform, because world positions are computed in the shader.
6. **Group rotation:** Sprite3D's own Y rotation is compensated, but a rotated ancestor is not supported in camera-facing modes.
7. **Animation lookup cache:** `_resolve(name, dir)` results are cached per sprite (name → direction), so `play()` every frame no longer allocates; treat the result as read-only.

All of the extras are listed in the API summary.

### Integrator notes (auditor)
**Imports:** `import { Sprite3D, spriteSheetFromProp, patchSpriteLighting, cloneSharedTexture, GLSL_BAYER4 } from 'src/engine/sprite/Sprite3D.js'`; `SpriteManager`; `Foliage`; `import { Particles, PARTICLE_PRESETS, Emitter } from 'src/engine/fx/Particles.js'`.

**Frame order:**
- Register SpriteManager after CameraRig.update in the frame (for example a higher-order system or `lateUpdate`). Billboards read `globalUniforms.uCameraYaw`, so updating before the rig makes sprites lag a frame while the camera rotates.
- Call `particles.update(dt, camera)` every frame. It moves followCamera rain and snow, updates culling spheres and hides finished burst pools.

**Sprite3D:**
- `play()` follows the contract. A new animation gets `speed = opts.speed ?? 1`. Calling `play()` with the same name is a no-op (it resumes if paused; `speed` changes only when passed). A finished non-looping animation restarts.
- `play('walk')` resolves to `walk_<direction>`. A missing left/right animation is mirrored from the other side.
- `faceVector(dx, dz)` picks a camera-relative direction with hysteresis.
- `setFrame(col, row)` enters manual mode: `animation` becomes null and `playing` false.
- `sprite.material` (the lit MeshLambertMaterial) can be passed to `LightingSystem.registerEmissive`. Construct with `emissive` so the emissive colour is non-black.
- It accepts a PropSprites result directly (flames, etc.). Animated props autoplay an `idle` loop at `prop.fps`.
- `dispose()` does not unregister from SpriteManager, so call `spriteManager.remove(s)` first. `clone()` works.
- Keep sprite parents unrotated.

**Foliage:**
- Construct with `{sprite, instances: [{x, y, z, scale?, tint?, frame?}]}`, then add `foliage.object` to the scene.
- Toggle shadows with the `foliage.castShadow` setter, not `object.castShadow`; the setter keeps the self-shadow uniforms in sync.
- For grass, keep `castShadow` false (the default).

**Particles:**
- `new Particles(scene)` adds `particles.object`, a Group that must keep an identity transform.
- `createEmitter({preset, position | bounds: {center, size}, count, rate, color, size, followCamera, intensity, enabled, seed, map, variants, ...overrides})` returns an Emitter. Mutating `emitter.position` moves it live.
- Area presets given only a `position` (fireflies, dust, leaves) place the bottom of the box at `position.y`, using the preset's default bounds.
- Weather: `createEmitter({preset: 'rain'})` or `'snow'` follows the camera automatically; `dispose()` it to stop.
- `burst(preset, pos, count = 12)` keeps the contract default count, so pass small counts yourself (about 3–8 for footsteps).
- The `lit` presets expect `globalUniforms.uSunColor` in linear, intensity-scaled 0 to ~1.5 (as LightingSystem specifies). Glows use HDR colours tuned for the PostFX bloom threshold of 0.82.
- Wire Props `emitters` straight into `createEmitter(e)`.

**Engine:** use PCFShadowMap plus `shadow.radius` (PCFSoftShadowMap warns in r186).

**Files:**
- src/engine/sprite/Sprite3D.js
- src/engine/fx/Particles.js
- sandbox/sprite_runtime.js
- sandbox/sprite_runtime.actions.json

SpriteManager.js and Foliage.js were audited and left unchanged.

### Known limitations
- **For the Engine owner, not this module:** in three r186, `renderer.shadowMap.type = PCFSoftShadowMap` logs a warning ("PCFSoftShadowMap has been removed. Using PCFShadowMap instead."). ARCHITECTURE.md specifies PCFSoftShadowMap, so the Engine should use PCFShadowMap with `shadow.radius` for softness. The sandbox does this.
- **Sandbox without post-processing:** there is no bloom or DOF, so the HDR glows (fireflies, embers, sparkle) look whiter than they will through PostFX. Preset HDR values are tuned so the colour survives ACES tone mapping and still blooms.
- **Shadow self-skip:** a sprite's shadow lookup ignores occluders within about half the sprite's width toward the sun. A wall right next to the sprite on the sun side may fail to shadow it.
- **Particles are camera-facing quads:** they don't collide with terrain (rain and leaves pass through it and fade at the end of their life). Normal-blended particles within one emitter are not depth-sorted.
- **Shadow-proxy draw call:** the proxy costs a cheap extra draw in the colour pass (colorWrite off), because three filters shadow casters by the main camera's layers. Each sprite is about 3 draws: quad, proxy and blob.
- **Test art only:** the sandbox's character sheet and textures are local stand-ins; the real art comes from the CharacterSprites and Textures modules.
- **Line endings:** Python on Windows briefly wrote CRLF into files I patched. All owned files were normalized back to LF, matching `.gitattributes`.

### Remaining audit issues
- By design, each sunFacing sprite costs 3 colour-pass draws (quad, a shadow proxy with colorWrite off, blob) plus 1 shadow-pass draw. WebGLShadowMap culls casters with the main camera's layers and material.visible, so the proxy cannot be hidden from the colour pass without hacks. About 20 NPCs cost about 80 draws, within the 300 budget.
- Known limitation, documented by the builder: the self-shadow-free receive lookup pushes a sprite's shadow lookup toward the sun by up to half the frame width divided by the horizontal sun component. For 32 px frames that is about 1.1 units at golden hour, so a wall right next to a sprite on its sun side may fail to shadow part of it.
- Ancestor rotations are not compensated in the cylindrical and spherical billboard modes; only the sprite group's own rotation is. Parent sprites to unrotated groups.
- Particle 'lit' tinting uses uSunColor plus a fixed ambient only. Point lights do not light leaves or smoke, so leaves near lanterns stay dark at night.
- Particles have no soft-particle depth fade, so smoke and mist intersect the ground with hard edges. They have no terrain collision, and normal-blended particles within one emitter are not depth-sorted.
- Stateless GPU motion multiplies velocity by uTime in float32. After many hours of uptime, rain and dust positions start to quantise and jitter visibly (cosmetic only).
- SpriteManager.update iterates the live array. Removing a sprite from inside a sprite callback during update (onAnimationEnd or onFrameChange) can skip one other sprite for that frame.
- Engine contract issue, not this module: ARCHITECTURE specifies PCFSoftShadowMap, which r186 replaces with PCFShadowMap and logs a warning. The Engine should use PCFShadowMap plus shadow.radius, as the sandbox does.
- Fireflies' hot core tone-maps to pale yellow-white under ACES; the green-gold hue lives in the halo and will come mostly from PostFX bloom. The sandbox has no bloom, so this could not be judged exactly there.

## lighting

### Files
- src/engine/lighting/LightingSystem.js
- src/engine/lighting/Sky.js
- src/engine/fx/GodRays.js
- sandbox/lighting.html
- sandbox/lighting.js
- sandbox/lighting.actions.json
- sandbox/lighting.quick.json
- sandbox/lighting.shadow.json

### API summary (builder)
All three modules are written and match the contract. The sandbox check reports 0 page errors, 0 console errors and 0 warnings, at 60 fps on the reference desktop GPU.

**LightingSystem(engine, { timeOfDay=17.2, timeSpeed=0, shadowMapSize=2048, shadowExtent=22 })**
- Uses only engine.renderer, engine.scene and engine.camera. It has name 'lighting', so it can be added with engine.addSystem.
- Members: sun, hemi, sky, timeOfDay, timeSpeed, paused, setTime(h), nightFactor, sunDirection, settings { sunMul, ambientMul, fogMul, shadows, exposureMul, pointLightMul, flicker }, followTarget(obj | Vector3 | null), addPointLight(...) → { light, dispose() }, registerEmissive(mat, { day=0, night=1.6 }), update(dt), dispose().
- **Palette:** 12 keyframes *[Errata: 13 — night at 0.0 h and 21.4 h]* across 24h (night, late night, pre-dawn, pink dawn, sunrise, morning, noon, afternoon, golden hour 17.2, sunset, purple dusk, blue hour). They are interpolated with a monotone cubic spline that wraps at midnight, colours in linear space, so it never overshoots.
- **What the palette drives:**
  - sun colour and intensity; shadow intensity and radius (2.5 by day, 3.2 at night)
  - hemisphere sky/ground colours and intensity
  - FogExp2 colour and density (fog colour equals the horizon colour)
  - toneMappingExposure
  - the sky state
  - uNight, uSunDirection and uSunColor (colour × intensity / 3.5: about 1.0 at noon, 1.43 at golden hour *[Errata: ≈ 1.71 — sunI 6.0 / 3.5]*), and uFogColor
- **Sun and moon paths:** each moves on a tilted circle, rotated so the sun sits behind-left (azimuth -125°, about 16° up) at 17.2. Golden-hour shadows therefore run long and diagonally toward the lower-right of screen. The moon culminates behind-right at night.
- **Light direction:** blended from sun to moon in azimuth/elevation space during twilight, when direct intensity is low. Elevation is softly clamped to 10–68°. Measured over a full 24h, the largest change is 0.31° per 0.01h, so there is no jump.
- **Shadows:** 2048 map, orthographic ±22, bias -0.0002, normalBias 0.055. The frustum is centred on the follow target (or the camera's look-at point) and snapped to shadow texels in light space; the measured snap error is about 1e-13.
- **Point lights:** intensity = base × lerp(dayIntensity, 1, night) (when nightOnly) × smooth fbm flicker × pointLightMul. Lights are never added, removed or hidden after creation, and the shader program count stayed at 21 through a full day cycle.

**Sky({ radius=180 })**
- object is a back-side sphere with depthWrite and depthTest off, no fog, renderOrder -1000 *[Errata: the default is `earlyZ: true` — depth test on, `renderOrder` 1e6, `Sky.EARLY_Z_RENDER_ORDER`]*. It re-centres on whichever camera renders it, just before drawing.
- setState({ top, horizon, bottom, sunDirection, sunColor, night }); update(dt); dispose().
- The shader draws:
  - the top/horizon/bottom gradient
  - an HDR sun halo, a low-sun horizon band and a pixel-crisp sun disc
  - a pixel gibbous moon with a halo
  - pixel-crisp twinkling stars (1-px stars plus rarer plus-shaped bright ones)
  - pixel-quantised, sun-tinted clouds whose pixels are a constant size on screen
  - a slow "sea of clouds" haze below the horizon

**GodRays()**
- object (Group), addShaft({ position, direction?, length=14, width=3, intensity=1, color? }) → { mesh, intensity (get/set), dispose() }, populate(bounds, count, seed=7) (deterministic jittered grid), intensity, update(dt), dispose().
- Each shaft is one additive quad that turns around its own axis to face the camera, with depthWrite off, fog-aware, renderOrder GODRAYS. It has a gaussian falloff across its width, a taper, a fade-in at the top and a fade toward the ground by height, and slowly scrolling streaks with a gentle pulse.
- It fades when the camera is close, when looking straight down the beam, at night (uNight), when the sun is high, and as the light nears the horizon. Colour is a slightly desaturated uSunColor.

**Additions beyond the contract**
- LightingSystem:
  - read-only: trueSunDirection, moonDirection, phaseName, state (current interpolated values)
  - settable: shadowExtent, shadowRadius { day, night }, shadowForward
  - setKeyframes(list); DEFAULT_KEYFRAMES export
  - constructor options: sunPath, moonPath, minElevation, maxElevation, lightDistance, followPlaneY, sky
  - addPointLight also accepts seed and flickerSpeed and returns base intensity and live flickerFactor; registerEmissive accepts `flicker: pointLightHandle` so lantern glass flickers in sync, and returns a handle with dispose().
- Sky: setState also takes moonDirection, glow and clouds; cloudCover and lowerClouds are settable; constructor options for starDensity, sunSize, moonSize, sunIntensity, cloudPixel and wind.
- GodRays constructor options: steepness (0.45), color, nightStrength, nearFade, fadeHeight, gain, horizonFade. addShaft also takes topWidth and seed.

**Sandbox handles:** window.__lighting provides setTime, setSpeed, setView ('default' | 'far' | 'wide' | 'low' | 'close' | 'sky' with 'sun' or 'moon'), moveFocus, sweep (24h continuity check), snapCheck, programs() and info().

### Deviations / additions
1. **Renderer settings touched.** LightingSystem sets renderer.shadowMap.enabled = true. If the shadow type is PCFSoftShadowMap it switches it to PCFShadowMap: three r186 has removed PCFSoft for WebGL and would make the same switch itself, but with a console warning. shadow.radius provides the soft look.
2. **Shadows toggle.** settings.shadows sets sun.shadow.intensity to 0 and shadow.autoUpdate to false, rather than turning castShadow off, so toggling never forces a shader recompile.
3. **What "sun direction" means at night.** The sunDirection getter and uSunDirection give the directional light's direction (the moon at night, softly clamped to 10–68° elevation), so shadows, sprite shadow proxies and water glints stay consistent. The true sun and moon directions are separate getters (trueSunDirection, moonDirection).
4. **God-ray default direction.** Without a direction, a shaft follows the live sun azimuth but its elevation is steepened by `steepness` (0.45) to keep the slanted diagonal of Square Enix's HD-2D games. Set steepness to 0 for an exact -sunDirection. Beams also fade out as the light approaches its 10° elevation clamp, i.e. at sunset and sunrise.
5. **Shaft geometry.** Each shaft is one axis-billboarded quad instead of crossed quads or a tapered box, so it is never seen edge-on as a hard plane. Only the mesh's world translation is used (orientation comes from the shader), and frustumCulled is false. *[Errata: each shaft is culled with a sphere test, `frustumCulled = true`.]*
6. **Colour scaling.** uSunColor = sun colour × intensity / 3.5.
7. **Extra members.** Additional optional fields and return values are listed in the API summary; no contract member was renamed or changed.

### Integrator notes (auditor)
**Contract status.** Every ARCHITECTURE 4.5 and 4.6 member exists with the specified defaults. The extras are strict supersets: LightingSystem `lateUpdate`, trueSunDirection/moonDirection/phaseName/state, setKeyframes, DEFAULT_KEYFRAMES; Sky options including `earlyZ`; GodRays options.

1. Register with `engine.addSystem(lighting)`. Any order works: `update` runs the clock, palette and uniforms, and `lateUpdate` re-centres the shadow frustum after the CameraRig and player have moved. When driving it manually, call `update` after positioning the camera.
2. Call `lighting.followTarget(player)` so the shadow box follows the player. With no target it follows the camera's ground look-at point.
3. `lighting.sunDirection` and `globalUniforms.uSunDirection` give the direction of the current directional light: the sun by day and the moon at night, with elevation softly clamped to 10-68 deg. They are not the raw sun direction, so sprite shadow proxies and water glints match the actual shadows. Use `trueSunDirection` or `moonDirection` for astronomy.
4. `uSunColor` = sun colour × intensity / 3.5, so about 1.0 at noon and about 1.7 at golden hour (sunI is now 6.0).
5. LightingSystem owns `renderer.toneMappingExposure` (1.0-1.3), `scene.fog` (FogExp2) and `renderer.shadowMap.enabled`, and switches PCFSoftShadowMap to PCFShadowMap.
6. Sky dome (`earlyZ`, the default) draws after all opaque objects with a far-plane depth test and never writes depth. Requirements:
   - The scene must render into a target that has a depth buffer. The canvas and PostFX's scene target both do.
   - Any opaque (non-transparent) material that does not write depth would be painted over by the sky. Give such effects `transparent: true`.
   - `new Sky({ earlyZ: false })` restores draw-first behaviour; pass it through `new LightingSystem(engine, { sky: { earlyZ: false } })`.
   - Sky pixels leave depth at 1.0, so DOF treats them as far background.
7. Lights and emissives:
   - Add every point light at load time. Never toggle `light.visible`; a light count change recompiles every lit shader. Fade lights with the handle's `intensity`, or `dispose()` them.
   - `registerEmissive(mat, { day, night, flicker: lightHandle })` syncs lantern glass flicker with its light.
   - The ≤12 point-light budget is not enforced.
8. GodRays: add `godRays.object` to the scene and call `godRays.update(dt)` each frame; it is also engine-system compatible. Use `populate(bounds, count, seed)` to scatter shafts; each shaft in view is one draw call (shafts are culled by a sphere round their base).
9. Integration check: `npm run check -- --page=sandbox/lighting_engine.html --out=lighting_engine --script=sandbox/lighting_engine.actions.json`.

**Files:**
- src/engine/lighting/LightingSystem.js
- src/engine/lighting/Sky.js
- src/engine/fx/GodRays.js
- sandbox/lighting.js
- sandbox/lighting.actions.json
- sandbox/lighting_engine.html
- sandbox/lighting_engine.js
- sandbox/lighting_engine.actions.json

### Known limitations
- **Shimmer while time runs.** Texel snapping stops shadow shimmer when the camera moves. While the clock is advancing, the light direction rotates and slight shadow crawl is unavoidable; with timeSpeed 0 shadows are fully stable.
- **Frame lag.** The shadow frustum's forward offset reads the camera's world matrix, which lags one frame if the camera rig updates after the lighting system. This is harmless.
- **Sky is mostly unseen in gameplay.** At the default camera (pitch 32°, fov 28) only the sky below the horizon shows behind the diorama. That band is the horizon haze plus the "sea of clouds" (Sky option lowerClouds, default 0.5), which suits a floating-chunk map; integration may want to tune or disable it. The sun disc, moon, stars and upper clouds only appear in low or photo-mode camera angles.
- **Cloud pixel artefacts.** Cloud pixels are snapped on a latitude/longitude grid, so there is a one-column seam toward -X and cells stretch near the zenith; both are hard to notice.
- **Stand-in scene.** The sandbox uses PCFShadowMap, a stand-in bloom plus output chain and plain alpha-tested planes as sprites. There is no depth of field or colour grade, and no Sprite3D wrap lighting, so backlit sprites at golden hour look darker than they will in the final. The palette was tuned expecting the PostFX grade (contrast, saturation, lifted teal shadows) to add further punch, especially for sunset and night.
- **Group must stay put.** The LightingSystem's internal group must stay untransformed, because sun and target positions are written in world space.
- **Flicker range.** Lantern flicker is ±(0.85 × flicker), about ±25% at the default 0.3. Point lights never cast shadows.

### Remaining audit issues
- Sunset (about 18.0-18.6h) is still moody and fairly dark, mean luminance about 46/255. At that hour the default camera sees the shaded sides of everything under 11-deg light. It is acceptable and PostFX grading adds contrast, but a lighting artist may want lanterns to come on earlier: nightFactor is only 0.22 at 18.45, so lanterns sit at about 34% of full intensity. Per-light `dayIntensity` can tune this.
- Sprites look dark at golden hour because they are backlit. That is expected with the plain Lambert stand-in planes; Sprite3D's wrap/normal-override lighting (another module) is meant to fix it.
- Wide or far views (distance 60 or more) look washed out at golden hour from FogExp2, the 'sea of clouds' haze and bloom. This is outside the CameraRig's 14-36 unit range. Tune with `settings.fogMul` or `sky.lowerClouds` if needed.
- Known and minor: cloud pixels snap to a latitude/longitude grid, so there is a one-column seam toward -X and cells stretch near the zenith. Clouds overhead at noon become large soft blobs. The sky above the horizon is rarely seen from the gameplay camera.

## ui

### Files
- src/engine/ui/UI.js
- src/engine/ui/DialogBox.js
- src/engine/ui/Banner.js
- src/engine/ui/TitleScreen.js
- src/engine/ui/HUD.js
- src/engine/ui/InteractPrompt.js
- src/engine/ui/Fader.js
- src/engine/ui/DebugPanel.js
- src/engine/ui/ui.css
- sandbox/ui.html
- sandbox/ui.js
- sandbox/ui.actions.json

### API summary (builder)
The UI module is finished and matches contract 4.8. The sandbox runs with 0 page errors, 0 console errors, 0 warnings and 0 failed requests at 1280x720, 1600x900 and 2560x1440. Scripted checks confirmed: choice index resolves (Down + Space returned 1), onChar fires, the fader promises settle, clicking the dialog completes and then advances a line, clicking the title resolves 'pointer', and title.visible turns false after the fade.

UI.js — `new UI(container = document.body)`
- Members: `root` (#luminati-ui.lu-root; the pointer passes through except on interactive children), `dialog`, `banner`, `title`, `hud`, `prompt`, `fader`, `debug`.
- `setVisible(bool)` is photo mode: everything fades except the fader. There is also a `visible` getter.
- `update(dt, {camera, input})` calls `dialog.update` (input is passed only while the overlay is visible and no title is showing), then `prompt.update(camera)`, then `hud.update`.
- It sets root classes automatically: `lu-root--dialog` hides the controls legend and the prompt while talking; `lu-root--title` hides the HUD and prompt while the title is up.
- Extras: `fontsReady` Promise (preloads every font face) and `dispose()`.
- It imports all @fontsource faces (Cinzel 400/600/700, Crimson Pro 400/500/600 plus 400/600 italic, Pixelify Sans 400) and ui.css, and re-exports all the component classes.

DialogBox — `new DialogBox(parent)`
- `open({speaker, lines, portraitColor})` returns a Promise that resolves after the close animation with the last choice index or undefined.
  - `lines` can be a string or an array of strings / `{speaker, text, choices}`.
  - `speaker` is the default name for lines without one; `portraitColor` tints a gem on the name plate.
- `isOpen` stays true until the close animation ends, so the confirm press that closes a dialog can't reopen it in the same frame.
- `update(dt, input)`:
  - Input is handled before the typewriter.
  - `confirm` while typing completes the line, otherwise it advances or selects the choice; `cancel` while typing completes the line; `up`/`down` move the choice cursor.
  - Confirm is ignored for 0.15 s after open, so the Talk press doesn't skip text.
- Typewriter: `speed` defaults to 45 chars/s. Punctuation pauses are `,` 0.12 s and `.`/`!`/`?` 0.3 s, and `…` or `...` 0.42 s. *[Errata: `.`/`!`/`?` 0.22 s; also `;`/`:` 0.16 s and `—` 0.14 s (`DialogBox` `PAUSES`).]*
- `onChar(char)` fires for each visible character; `close()`.
- Extras: `onSound(name)` hook with names matching AudioSystem ('open', 'close', 'confirm', 'blip'), `isTyping`, `isChoosing`, `skip()`, `speed`, `inputGuard`, `dispose()`.
- Markup: `{word}` shows the word highlighted in gold; `\n` is a line break. Clicking the window acts as confirm; hovering or clicking a choice selects it.

Banner — `new Banner(parent)`
- `show(title, subtitle = '', {duration = 3.5})` returns a Promise that resolves when the fade-out finishes. `duration` is the time until the fade-out starts; the fade adds about 1.1 s. A new `show()` replaces the current banner.
- Extras: `hide()`, `visible`, `dispose()`.

TitleScreen — `new TitleScreen(parent)`
- `show({title = 'Luminati', subtitle, prompt = 'Press any key', credit = 'Luminati 2.5D Pixel-Art Engine — three.js'})` resolves with 'key' | 'pointer' | 'gamepad' as soon as the player presses; the screen then fades out over about 1.1 s.
  - Input is accepted after `armDelay` (0.45 s).
  - The key listener runs in the capture phase and calls stopPropagation, so the dismissing key doesn't reach gameplay input.
  - Gamepads are polled with requestAnimationFrame only while the title is visible, and only a newly pressed button counts.
- `hide()` resolves a pending show with undefined; `visible` is true until the fade finishes.
- Extras: `onDismiss(source)` runs synchronously inside the user gesture (the right place to unlock audio), `armDelay`, `dispose()`.

HUD — `new HUD(parent)`
- `setTime(hours)` is safe to call every frame: the DOM changes only when the minute changes, and no strings are allocated for the digits.
- Phases: Night (≥20.5 or <4.75), Dawn (<7), Morning (<11), Midday (<14), Afternoon (<16.5), Golden Hour (<18.75), Dusk.
- `setLocation(name, subtitle?)`, `showHelp(bool)`, `toggleHelp()` (returns the new state), `toast(text, seconds = 2.5)`, `setControls([{keys, label}])`, `visible` getter/setter.
  - `keys` can be a string ('WASD', 'Q/E', 'Shift+Space') or an array.
- Extras: `clockElement`, `hours`, `phase`, `helpVisible`, `helpKey` (default 'H'), `maxToasts` (3), `update()` (does nothing), `dispose()`.
- Named exports: `DEFAULT_CONTROLS` (used when no legend is set), `TIME_PHASES`, `timePhase(h)`, `createKeycaps(keys)`.

InteractPrompt — `new InteractPrompt(parent)`
- `show(worldPos, label = 'Talk', {offsetY = 0, key})`: a Vector3 is copied; an Object3D is followed via its world position.
- `hide()`; `update(camera)` projects the point each frame and hides the prompt when it is behind the camera or off-screen. It only writes the transform when the rounded pixel position changes.
- Extras: `keyHint` (keycap shown before the label), `visible`, `dispose()`.
- The pixel-art speech bubble is scaled by a whole number (roughly viewport width / 430) so its pixels stay even.

Fader — `new Fader(parent)`
- `fadeOut(seconds = 0.6, color = '#000')` and `fadeIn(seconds = 0.6)` return Promises settled by a timer, so they resolve even if `transitionend` never fires. A new fade resolves the previous one and continues from the current opacity.
- Extras: `set(opacity, color?)`, `opacity`, `busy`, `dispose()`.

DebugPanel — `new DebugPanel(parent, {anchor, title})`
- `gui` (themed lil-gui), `addFolder(name)`, `toggle()` (returns the new state), `visible` getter/setter. It is hidden by default and placed below the HUD clock.
- `stats.update(renderer, dt)`: on the first call it sets `renderer.info.autoReset = false`; every call reads calls, triangles, geometries, textures and programs, then calls `renderer.info.reset()`.
  - fps and frame ms come from performance.now() and refresh 4 times per second, so time scaling and dt clamping don't affect them. There is also a worst-frame value and a small fps graph.
  - The on-screen numbers only update while the panel is visible, but the counter reset happens every frame.
- Also exported: `DebugStats`.

### Deviations / additions
No contract member was renamed or changed in meaning. Additions and interpretations:

1. Every component constructor takes `(parent)`, which UI passes as its root. DebugPanel also takes `{anchor, title}`.
2. The TitleScreen promise resolves when the player presses, and the fade-out follows. That is how I read the brief; `visible` stays true until the fade ends. If you need to wait for the fade, add about 1.1 s before showing a banner.
3. `Banner.show` `duration` counts from show until the fade-out starts; the 1.1 s fade comes on top.
4. `stats.update(renderer, dt)` accepts `dt` but measures with performance.now() instead, because the engine's dt is clamped and time-scaled.
5. Behaviours the contract doesn't specify:
   - UI hides the HUD and prompt while the title shows, and tucks the controls legend and prompt away while a dialog is open.
   - `setVisible(false)` hides the debug panel too, but not the fader.
6. The Backquote key is shown as a '~' keycap.
6b. DialogBox: `choiceGuard` (0.25 s) ignores input right after choices appear, so mashing confirm through the text doesn't pick the pre-selected first choice; sentence-end pauses ('.', '!', '?') are 0.22 s (ellipsis 0.42 s).
6c. Banner: the flourish drop shadow is baked into the SVG (no CSS `filter`), `.lu-banner` has `will-change: opacity, transform`, and the title's fade-out drift is a transform instead of a letter-spacing animation — the lazily built filtered layer used to cost a one-time ~200 ms GPU stall on the first fade-out.
6d. The controls legend (`.lu-help`) is hidden on windows shorter than 540 px, where it would cover the location plate.
7. Keyboard shortcuts for help, debug and photo mode are left to the game, e.g. `if (input.actionPressed('debug')) ui.debug.toggle()`. UI does not handle them, to avoid double toggles.

### Integrator notes (auditor)
Setup:
- Create once: `const ui = new UI(document.body)`. Optionally `await ui.fontsReady` before the first title or dialog to avoid a fallback-font flash.

Per frame:
- Call `ui.update(dt, { camera: engine.camera, input: engine.input })` after CameraRig has updated, e.g. on engine.events 'lateUpdate', so the prompt doesn't lag a frame.
- Call `ui.debug.stats.update(engine.renderer, dt)` on 'afterRender' every frame. It turns off renderer.info.autoReset and resets the counters itself, so multi-pass PostFX frames are counted in full.

Dialog:
- `ui.dialog.open({ speaker, lines, portraitColor })` returns a Promise that resolves after the close animation with the last choice index, or undefined.
- `lines` can be a string, or an array of strings / `{ speaker, text, choices }`. Markup: `{word}` shows the word in gold; `\n` is a line break.
- `isOpen` stays true until the close animation ends (about 320 ms). Gate talk and movement on `!ui.dialog.isOpen`.
- The dialog uses `input.consumeAction` when present, so the presses it handles are swallowed for the rest of the frame.
- Confirm is ignored for 0.15 s after open(), so the Talk press can't skip text. Clicking the window acts as confirm.
- Hooks: `ui.dialog.onChar = (ch) => audio.playSfx('blip', ...)`; `ui.dialog.onSound = (name) => audio.playSfx(name)` (names: open, close, confirm, blip).
- A new open() interrupts the current dialog; the old promise resolves at once with its choice so far.

Title screen:
- `ui.title.show({ title, subtitle, prompt, credit })` resolves with 'key' | 'pointer' | 'gamepad' as soon as the player presses; the fade-out (about 1.15 s) follows, and `title.visible` stays true until it ends.
- Unlock audio in `ui.title.onDismiss = () => audio.unlock()`, which runs synchronously inside the user gesture.
- Ignore gameplay input while `ui.title.visible`: a gamepad dismissal is also seen by Input, and keys during the 0.45 s arm delay leak through.
- UI hides the HUD and prompt while the title shows. For `?autostart=1`, just don't call show().

Banner:
- `ui.banner.show(title, subtitle, { duration })`: `duration` is the time until the fade-out starts; the fade adds about 1.1 s. The Promise resolves when the fade ends.

HUD:
- `setTime(h)` is cheap to call every frame.
- `setLocation(name, subtitle?)`, `setControls([{ keys, label }])`. `keys` can be 'WASD', 'Q/E', 'Shift+Space', or an array.
- `showHelp`, `toggleHelp`, `toast(text, seconds)`, and a `visible` getter/setter.

Interact prompt:
- `ui.prompt.show(target, 'Talk', { offsetY, key })` is safe to call every frame; `hide()` hides it.
- Pass an Object3D (e.g. an NPC Sprite3D) to follow it; its origin is the feet, so use offsetY of about 2.2–2.4. A Vector3 is copied instead.
- `ui.prompt.keyHint = 'Space'` adds a keycap.

Fader:
- `ui.fader.fadeOut(s, color)` / `fadeIn(s)` return timer-settled Promises.

Photo mode and debug:
- `ui.setVisible(bool)` hides everything except the fader, including the debug panel.
- UI does not bind keys. The game wires them, e.g. `if (input.actionPressed('debug')) ui.debug.toggle()`, and likewise help → `ui.hud.toggleHelp()` and photo → `ui.setVisible(!ui.visible)`.
- `ui.debug.addFolder(name)` returns a lil-gui folder; `ui.debug.gui` is the root.

Other exports and side effects:
- UI.js re-exports DialogBox, Banner, TitleScreen, HUD, InteractPrompt, Fader and DebugPanel.
- HUD.js also exports DEFAULT_CONTROLS, TIME_PHASES, timePhase and createKeycaps; DebugPanel.js exports DebugStats.
- The only import-time side effects are the CSS and font imports.

Files changed:
- src/engine/ui/TitleScreen.js
- src/engine/ui/DialogBox.js
- src/engine/ui/InteractPrompt.js
- src/engine/ui/UI.js
- src/engine/ui/HUD.js
- src/engine/ui/ui.css
- sandbox/ui.actions.json

### Known limitations
- The sandbox uses a local StubInput (the real Input module was not available). Gamepad dismissal of the title screen couldn't be tested headless; the code path is simple polling.
- Call `ui.update()` after CameraRig updates (e.g. on 'lateUpdate' or 'beforeRender'). `prompt.update` calls `camera.updateMatrixWorld()` itself, but if it runs before the camera moves, the prompt lags one frame.
- The debug panel is fixed pixel width, stepped up by media query at 1880 px and 2300 px wide. At 1280x720 it overlaps the right part of the dialog and choices when both are open. The lil-gui list scrolls when it runs out of height.
- Continuous CSS animations (dialog ▼, choice cursor, prompt bob and dots, clock sun rays, title glow/shimmer/motes) cost a little every frame. Most are transform/opacity; the sun rays and title shimmer are small repaints. `prefers-reduced-motion` shortens them all.
- The dialog panel has no backdrop blur: `backdrop-filter` inside an element whose opacity is animating would switch on abruptly when the fade ends. The panel is simply more opaque instead.
- The typewriter builds one span per character when a line starts (DOM allocation per line, not per frame). Fonts load lazily; `ui.fontsReady` can be awaited before the first title or dialog to avoid a brief fallback font.
- The sandbox's 3D background (boxes, cones, pixel grass) is only a backdrop for judging the UI, not engine-quality art.

### Remaining audit issues
- UI does not bind any keys (the builder's documented deviation 7). The game must wire the `debug`/`help`/`photo` actions itself, e.g. `if (input.actionPressed('debug')) ui.debug.toggle()`. Only the game should toggle, otherwise a double toggle cancels out.
- Gameplay input can leak around the title screen. A key pressed during the 0.45 s arm delay reaches Input. A gamepad button that dismisses the title is also seen by Input's own polling, because the title polls pads independently. The game should ignore gameplay input (talk, move) while `ui.title.visible`.
- While a dialog is open, W/S/arrows are consumed only when a choice list is active. The game must freeze player movement and talk checks while `ui.dialog.isOpen`, which stays true through the 320 ms close animation.
- At 1280x720 the debug panel (fixed px width, scaled up by media query at ≥1880 px) overlaps the right part of an open dialog or choice list. Acceptable for a dev tool; left as is.
- DebugStats sets renderer.info.autoReset = false on its first call. If the integrator calls stats.update only sometimes, the counters accumulate between calls. Call it every frame on 'afterRender'.
- The ← and → keycap glyphs fall back to Georgia because Crimson Pro's latin subset lacks U+2190/U+2192. Cosmetic.

## textures

### Files
- src/engine/pixel/Textures.js
- sandbox/textures.html
- sandbox/textures.js
- sandbox/textures.actions.json

### API summary (builder)
src/engine/pixel/Textures.js exports `TEXTURE_NAMES` (the 46 contract names, in contract order) and `class TextureLibrary({ seed = 1337, anisotropy = 4 } = {})`.

Contract members, all implemented:
- `get(name)` returns a cached THREE.CanvasTexture made with makePixelTexture: SRGB, RepeatWrapping, NEAREST mag, LinearMipmapLinear min with mipmaps, anisotropy from the constructor. Nothing is painted until first use.
- `normal(name)` returns a tangent-space normal map (NoColorSpace, mipmapped) built with normalMapFromHeight from a height field painted alongside the colour. Every known texture has one.
- `emissive(name)` returns an SRGB mask (white = glows) for `window` (glass panes, dimmer curtain edges) and `lantern_glass` (radial glow). Returns null for the others.
- `meta(name)` returns `{ px:[w,h], units:[px/16], alpha, emissive, normal }`.
- `material(name, extra = {})` returns a cached MeshLambertMaterial; the cache key is `name + '|' + JSON.stringify(extra)`.
  - Sets map, normalMap and a per-texture normalScale (roughly 0.45–0.8).
  - Emissive textures get emissiveMap, emissive #ffb870 and emissiveIntensity = extra.emissiveIntensity ?? 1.
  - Alpha textures get alphaTest 0.5, DoubleSide and userData.alpha = true.
  - `extra` is spread last, so it can override anything.
- `has(name)`, `list()`, `dispose()` (disposes every texture, material and the fallback, and clears the caches).

Helpers added beyond the contract:
- `pixels(name)` returns the painted `{ color, normal, emissive, height }` PixelCanvases.
- `canvas(name)` returns the colour HTMLCanvasElement (for DOM previews).
- `preload(names = TEXTURE_NAMES)` generates everything up front.
- `seedOf(name)` gives the deterministic per-texture seed.
- `material` also accepts a plain number for `normalScale` and sets `material.userData.texture = name`.
- An unknown name gives one console.warn plus a magenta checker from get(), a 1×1 default from meta(), and null from normal()/emissive().

Sizes (always scale UVs as uv = worldPos / meta.units):
- 4×4 units (64 px): all 12 terrain tops and plaster.
- 2×2 units (32 px): stone_wall, timber_frame, the plank walls, log_wall, brick, stone_brick, the four roofs, chimney_stone, leaves, leaves_autumn, pine, hay, both cloths, well_stone.
- 1×2 units: door (16×32), bark (16×32).
- 2×1 units: sign_board (32×16).
- 1×1 units (16 px): cliff, grass_side, dirt_side, window, metal, barrel, crate, fence_wood, rope, lantern_glass, flowerbox.

Layout notes for the TileMap/Props authors (also in the file header):
- cliff and grass_side rock layers start at rows 0 and 8, so any 0.5-unit vertical offset keeps the strata aligned. grass_side is the cliff body with a jagged grass lip (3–6 px plus hanging blades); map its v = 1 to the face's top edge.
- stone_wall, stone_brick and well_stone use 8 px block rows, which also line up with the 0.5-unit level height.
- timber_frame: posts and sill/plate straddle the seams (2 px each side, so 4 px beams when tiled). Mid rail at 1 unit, knee braces above, St Andrew's cross below.
- Roofs: 2 tile rows per unit; canvas up points toward the ridge.
- leaves / leaves_autumn: 5 scalloped clumps kept inside the canvas with transparent gaps, so they work on single cards.
- pine: 4 drooping 8 px tiers; tiles horizontally for cones.
- fence_wood: two posts plus full-width rails; tiles along u. flowerbox: planter in the bottom 7 px; tiles along u.
- barrel hoops sit near v ≈ 0.15 and 0.85.

Sandbox (sandbox/textures.html + textures.js):
- Views, chosen with `?view=` or `window.__tex.setView()`:
  - `atlas`: DOM grid of every texture tiled 2×2, pixelated, with labels plus normal and emissive thumbnails. Filters: `&group=`, `&only=`, `&scale=`.
  - `gallery0`–`gallery3`: 3D pages for terrain slabs; walls and sides; roofs, door, window, cloth, hay, metal, rope and sign; trees and props.
  - `diorama`: grass plateau with grass_side lip over cliff, stone stairs cut into the cliff, cobblestone path, timber_frame house with roof_red, door, windows and flowerbox, chimney, lantern, oak, autumn tree and pine, barrel, crate and fence. Diorama camera: fov 28, pitch 32°, distance 24.
- Lighting: a low warm sun with shadows, a hemisphere fill and an orbiting warm point light. `setNight(true)` switches to night lighting with glowing windows and lantern.
- `window.__tex` exposes `lib, renderer, scene, camera, sun, hemi, point, state`, plus:
  - `setView`, `setNight`, `setLightAngle`, `frame(dx, dz, dist)`
  - `check()`, which validates all names, sizes, formats, colour spaces, alpha setup and material caching.
- `sandbox/textures.actions.json` drives the screenshot run.

### Deviations / additions
No contract member is renamed or changes meaning. Three additions or interpretations:

1. **Texture sizes.** The contract says "most are 16×16 px = 1×1 unit". I kept every size the contract states exactly: cliff, grass_side, window, barrel, crate and fence_wood at 1×1; timber_frame, leaves, leaves_autumn and pine at 2×2; door and bark at 1×2. For names where the contract gives no size, I made large repeating surfaces bigger so they don't visibly repeat over 20×20 tiles: all terrain tops and plaster are 4×4 units, most walls/roofs/cloth/hay/well/chimney are 2×2, and sign_board is 2×1. **TileMap and Props must scale UVs by `meta(name).units`**, which the contract already requires ("1 unit = 1 repeat unless meta says otherwise").
2. **Normal maps everywhere.** Every texture has a normal map, so `normal()` returns null only for unknown names. The contract requires them only for relief textures.
3. **meta() extra fields.** `meta()` also returns `emissive` and `normal` flags. The extra helpers are listed in the API summary.

sandbox/textures.actions.json is an extra sandbox file.

### Integrator notes (auditor)
- **Scale UVs by meta.units, always.** For every face use uv = worldPos / meta(name).units. Sizes:
  - 4×4 units: all terrain tops and plaster.
  - 2×2 units: stone_wall, timber_frame, the plank walls, log_wall, brick, stone_brick, the four roofs, chimney_stone, leaves, leaves_autumn, pine, hay, both cloths, well_stone.
  - 1×2: door, bark. 2×1: sign_board.
  - 1×1: cliff, grass_side, dirt_side, window, metal, barrel, crate, fence_wood, rope, lantern_glass, flowerbox.

  Hard-coding 1 unit per repeat will squeeze the larger textures.
- **Terrain tops:** u = x/uw, v = -z/uh (canvas up points toward -Z).
- **Cliff faces (TileMap):** anchor grass_side per column so v = 1 at the top edge of the face (v = 1 - (topY - y)); texture the rest of the face with cliff (or the legend side) using world-space v = y. Tops at half-unit (LEVEL_HEIGHT) heights meet without a visible seam.
- **Everything is shared and cached.** get(), normal(), emissive() and material() return shared objects:
  - Never set .repeat, .offset or onBeforeCompile on them directly unless you want every user to change.
  - For per-use variants, pass params: material(name, { side, onBeforeCompile, color, ... }). The cache key now distinguishes different onBeforeCompile functions (by source) and different texture params (by uuid).
  - Or clone the returned object.
- **material(name, extra):**
  - Always sets map and normalMap. The normalScale default is per texture (about 0.45–0.8); a number is accepted as shorthand.
  - Emissive textures (window, lantern_glass) get emissiveMap, emissive #ffb870 and emissiveIntensity = extra.emissiveIntensity ?? 1. So they glow in daytime too unless LightingSystem.registerEmissive(material, { day: 0, night: 1.6 }) drives them. Props must return them in `emissives`.
  - Alpha textures (leaves, leaves_autumn, pine, fence_wood, flowerbox) get alphaTest 0.5, DoubleSide and userData.alpha = true. three's shadow map picks up map + alphaTest automatically, so cut-out shadows work when castShadow is set.
- **Decals:** door, window, lantern_glass, crate, barrel, metal and sign_board map 0..1 across one face. Barrel hoops sit near v≈0.15 and v≈0.85.
- **Timber frame:** posts and plates straddle the texture seams (4 px beams when tiled), with the mid rail at 1 unit.
- **Roofs:** canvas up points toward the ridge, 2 tile rows per unit.
- **Tiling props:** fence_wood and flowerbox tile along u. pine tiles along u, so wrap it around cones.
- **Extras beyond the contract:** pixels(name), canvas(name), preload(), seedOf(name), and meta() also returns emissive and normal flags. normal() is non-null for every known name.
- **Unknown names:** one console.warn, a magenta checker from get(), a default meta, and null from normal() and emissive().
- **Generation:** painting is lazy on first use; call preload() behind a loading screen to avoid first-use hitches (about 200 ms total).
- **Tests:** sandbox/textures.html plus textures.actions.json run the regression check, including the new material-key test.

Files changed: src/engine/pixel/Textures.js and sandbox/textures.js. No foundation files were touched.

### Known limitations
- **1×1 side textures repeat every unit.** cliff, grass_side and dirt_side stay at the contract's 1×1 size, so some regularity is visible along long cliff faces. I reduced it with partial fissures and two tones per layer, but it can't be removed at this size.
- **Alpha textures on distant foliage.** Alpha textures are uploaded from a 2D canvas, which throws away the colour under fully transparent pixels. So colour can't be bled into the gaps: at distant mip levels leaf edges come out slightly darker, and alphaTest 0.5 can thin foliage far away. It is invisible at the normal diorama zoom, where textures are magnified. I removed a "bleed colour into transparent pixels" step because the canvas upload discarded its result anyway.
- **Normal strength is tuned for sandbox lights only.** normalScale was tuned under the sandbox's lights, without PostFX or LightingSystem. If the final lighting shows it too strong or weak, callers can override per material, e.g. `material(name, { normalScale: 0.4 })`.
- **Generation cost.** Painting all 46 textures takes about 150–190 ms in the browser. Painting happens per texture on first use; `preload()` exists for a loading screen.
- **Hand-drawn decals are seed-independent.** door, window and lantern_glass look the same for every seed; the other 43 vary with the seed. *[Errata: only `window` and `lantern_glass` ignore the seed; `door`'s wood grain uses it (44 vary).]*
- **Sign lettering.** sign_board carries carved pseudo-lettering, not real text.
- **Night window brightness.** Windows look near white-hot at emissiveIntensity 1.6 without bloom and grading; LightingSystem controls that intensity.
- **Verification.** Visual checks were in the sandbox only, with raw three.js and ACES tone mapping and no depth of field or bloom. A Node run confirmed all 46 textures are deterministic and match their meta sizes, and that alpha textures have real cut-outs while opaque ones have no holes.

### Remaining audit issues
- All 1×1 side textures (cliff, grass_side, dirt_side) still repeat every world unit horizontally because the contract fixes them at 1×1. The redesign makes the repeat much quieter (continuous strata instead of hot spots), but it can't be removed at 16 px. If the team accepts a contract change, a 64×16 cliff/grass_side/dirt_side (units [4,1]) would remove it; TileMap already has to read meta.units for stone_wall and all tops.
- Alpha foliage (leaves, leaves_autumn, pine, fence_wood, flowerbox) is uploaded from a 2D canvas, so colour under fully transparent texels is lost. At mip levels ≥ 1 edges darken slightly. In practice mip 0 is always used at the diorama zoom (about 3–5 screen px per texel at distances 24–36), so this is left as is. Uploading an ImageData with bled colour would fix it but would change the type of texture.image.
- The grass_side lip uses the PALETTE.grass ramp. It matches the grass and grass_flowers tops but will look brighter than grass_dark tops if a map puts grass_side under grass_dark.
- normalScale values were tuned under raw sandbox lighting only (no PostFX or LightingSystem). Override per material if needed, e.g. material(name, { normalScale: 0.4 }).
- The seam heuristic in the Node validation flags stone_tiles, stone_wall, stone_brick, wood_deck, well_stone, roof_red, farmland and wood_planks_dark on the y axis. These are false positives: block rows start at y=0, so the wrap seam coincides with a mortar or shadow row, exactly like the interior rows. The 2×2 tiled atlas confirms they tile cleanly.

## terrain

### Files
- src/engine/world/TileMap.js
- src/engine/world/Water.js
- sandbox/terrain.html
- sandbox/terrain.js
- sandbox/terrain.actions.json
- sandbox/terrain.quick.json
- sandbox/terrain.detail.json
- sandbox/terrain.perf.json

### API summary (builder)
TileMap.js exports TileMap, plus helpers ORGANIC_TOPS, GRASS_TOPS, FRINGE_RECEIVERS, FRINGE_PRIORITY and paintDecalMask(seed).

TileMap(map, { textures, seed?, baseDepth = 2, chunkSize = 32, uvVariation = true, fringes = true, overhangs = true, aoStrength = 1.1, tintStrength = 1, sideVariation = false }). *[Errata: also `wallBounce`.]*

Contract members, all implemented:
- object: a Group of merged meshes, one per (material, 32×32 chunk). The sandbox map uses 26 meshes. All cast and receive shadows, except ground fringes, which only receive.
- width, depth.
- tileAt(i, j) returns { char, type, level, h, walkable, i, j, water, stairs, blocked, waterSurface }, or null for void or out of bounds.
- worldToTile(x, z, out?), tileCenter(i, j, out?).
- getHeight(x, z): walk surfaces override (highest wins). Stairs give a smooth ramp, clamped to [h, h + 0.5]. Water tiles give the bed height. Void or outside gives baseY.
- isWalkable(x, z): walk surface, or a walkable unblocked tile; false inside colliders and outside the map.
- addCollider(c) (returns c), removeCollider(c), blockTile(i, j).
- addWalkSurface(rect) (returns rect).
- move(from, dx, dz, radius = 0.3, maxStep = 0.55, out?): sub-stepped circle vs grid using the centre plus 8 perimeter samples. A step is blocked if the ground is not walkable, the height change is over maxStep, or it leaves the map bounds. Stairs are only enterable where heights connect. Sliding goes full, then x-only, then z-only. Circle and box colliders push the character out. An invalid start (overlapping a wall, or in water) uses a relaxed test so the character can walk out but never climb more than maxStep.
- forEachTile(fn), which skips void tiles.
- dispose(): frees geometries, TileMap's own materials and the mask texture, never library textures.

Extras:
- baseY, minHeight, maxHeight, bounds, waterLevel, colliders[], walkSurfaces[].
- getWaterSurface(x, z), waterSurfaceOf(tile, level), unblockTile, removeWalkSurface, stats.

Geometry:
- Tops are subdivided on a 4×4 lattice, so there are no T-junctions.
- Stairs have 4 real treads and risers, with nosing highlights and AO at the back of each tread.
- Vertical faces appear where a neighbour is lower (quarter-segment edge profiles, so stair sides are stepped), or at void or map edge down to baseY.
- Face textures: a 1-unit lip band (v = 1 at the top), then the side texture with world v = y / units. UVs are world-space and honour meta.units.
- Vertex colours bake:
  - horizon-based AO from the height field (inner corners, wall bases, edges below higher tiles);
  - contact AO fading up walls and concave-corner AO;
  - shade under grass overhangs;
  - a dark fade toward the diorama base;
  - a low-frequency warm/cool tint;
  - mossy and rock-patch tint on faces;
  - wet darkening of banks and the waterline.
- Organic tops vary through the shader (a jittered, pixel-quantised cell field choosing a quarter-turn or mirror). It uses textureGrad, and normal-map samples are rotated back.
- Decals are alpha-tested, use a PixelCanvas mask on uv1, and continue the grass world UV:
  - grass fringes where grass meets path, cobble, sand and similar at the same height;
  - priority fringes between grass variants;
  - corner tufts;
  - a jagged 3 px brim plus a hanging skirt of up to 7 px on grassy cliff tops, which casts a shadow.

Optional legend extras:
- riser, uvVariation: false, fringe: false, overhang: false.
- Water tiles: waterLevel (absolute surface), waterDepth (surface = bed + depth), flow ([x, z] or a multiplier; 0 = still).
- Water tiles whose bed is at or above map.waterLevel automatically get a surface 0.35 above the bed.

Water.js exports Water and createWaterfall.

Water(tileMap, { level?, flow = [0, 0.3], resolution = 8, opacity = 0.9, shallowOpacity = 0.58, glint = 1, foam = 1, brightness = 1.15, deepAt = 0.34, reflect = 0.1, saturation = 1.12, neutral = 0.35, maxDistance = 2, maxDepth = 1.5 }). *[Errata: also `deferShore`.]*
- object: one mesh with surface quads plus cross-section faces at map edges and at drops to lower water.
- ShaderMaterial with fog, lights, transparent, depthWrite true, renderOrder RENDER_ORDER.WATER, receives shadows.
- Baked shore DataTexture (R = shore/obstacle distance, G = depth, BA = flow; chamfer distance, blurred).
- Shading:
  - depth bands from PALETTE.water with dithered edges and deep patches;
  - flow-map advected pixel ripple dashes (16 px/unit);
  - contact foam and rolling foam lines along shores and colliders;
  - fresnel mix with uFogColor;
  - HDR 4-point glints from uSunDirection and uSunColor, masked by shadow; moon glints at night;
  - lit by the real scene lights (ambient, hemisphere, directional with shadow, point lights).
- update(dt) rebuilds the shore texture when the TileMap collider count changes; refresh() does it manually.
- dispose().
- References the globalUniforms objects directly.

createWaterfall({ x, z, width = 2, top, bottom, facing, seed?, pool = true, lip = 0.3 }) returns { object, update, dispose, sheet, pool, emitters: [{ preset: 'mist', position, width }] }.
- Curved lip sheet (x proportional to sqrt(drop)).
- Pixel streaks that accelerate downward, top-lip foam, bottom foam, HDR droplet sparkles, ragged edges.
- Churning foam pool decal.
- Lit and shadowed like the water.

### Deviations / additions
No contract member is renamed or changes meaning. Interpretations and additions:

1. **Organic UV variation is in the shader, not per-tile geometry.** The library's terrain tops are 4×4-unit textures. Per-tile 90° geometry rotation, which I implemented first, gave an obvious patchwork grid, confirmed in screenshots. The shader version is a pure function of world position, so fringes and brims match exactly. Directional textures are never rotated.
2. **Per-tile water surfaces.** Beyond map.waterLevel: automatic surface 0.35 above the bed when the bed is at or above waterLevel, and the legend waterLevel, waterDepth and flow extras. This makes an upper river on a plateau plus a waterfall work. Water opts.level overrides tiles that use the global level.
3. **Void handling.** tileAt returns null for void tiles too, and forEachTile skips them. getHeight returns baseY for void or outside the map.
4. **isWalkable** also returns false inside colliders and outside the map.
5. **move()** has an optional 6th `out` argument, to avoid allocation, and the escape mode for invalid starts.
6. **Water lighting.** The task said lights were not required; Water still uses lights: true so it matches Lambert terrain brightness at every time of day and receives sun shadows. The waterfall and pool are also lit.
7. **createWaterfall extras.** It also returns sheet, pool and emitters. `top` and `bottom` are water-surface Y values.
8. **Default Water flow is [0, 0.3].** Ponds should set legend flow: 0.
9. **Mesh chunking.** Meshes are merged per material and per 32×32 chunk.
9b. **Shadow casters.** Top meshes do not cast shadows: they face the (always above-horizon) sun, so the shadow pass would render only culled back faces. Sides, brims and skirts cast (saves ~10 shadow draw calls and ~60k shadow-pass triangles on Emberfall, with identical shadows).
10. **Extra sandbox files:** sandbox/terrain.actions.json (asserts plus all shots), terrain.quick.json, terrain.detail.json and terrain.perf.json.

### Integrator notes (auditor)
Contract members are all present with the specified signatures and return shapes (the extras are strict supersets):
- TileMap: object, width, depth, tileAt, worldToTile, tileCenter, getHeight, isWalkable, addCollider (returns c), removeCollider, blockTile, addWalkSurface (returns rect), move(from, dx, dz, radius=0.3, maxStep=0.55), forEachTile, dispose.
- Water: object (a single Mesh), update, dispose.
- createWaterfall({x, z, width, top, bottom, facing}) returns {object, update, dispose} plus sheet, pool and emitters.

Wiring notes:
1. TileMap materials read globalUniforms.uSunColor and uSunDirection for the wall bounce, so LightingSystem must be updating them; without it, the bounce uses the GlobalUniforms defaults. Tune with `tileMap.wallBounce` (0 = off).
2. Call water.update(dt) each frame. It is cheap and only rebuilds the shore texture when colliders in water are added or removed. Call water.refresh() after moving an existing collider that sits in water.
3. Pass fall.emitters[i] directly to particles.createEmitter; it is preset 'mist' with spawnSize and velocity oriented to `facing`. Waterfall `top` and `bottom` are water-surface Y values; use tileMap.getWaterSurface(x, z).
4. Water uses lights: true and receives sun shadows. It renders as transparent with depthWrite (renderOrder RENDER_ORDER.WATER) so DOF sees the surface.
5. The default Water flow is [0, 0.3]. Give ponds `flow: 0` in their legend entry. The legend also supports waterLevel, waterDepth, riser, uvVariation: false, fringe: false and overhang: false.
6. With the default maxStep, one-level (0.5) ledges are walkable; design blocking cliffs as at least 2 levels.
7. tileMap.dispose() frees only TileMap-owned materials, geometries and the mask texture, never TextureLibrary textures. water.dispose() and fall.dispose() also remove their objects from the scene. A leak check showed geometries and textures returning to their baseline.

Files: src/engine/world/TileMap.js, src/engine/world/Water.js, sandbox/terrain.js.

### Known limitations
- **Stairs:** one level (0.5 units) per stair tile with 4 steps of 2 px risers, so steps read thin from far away. High-contrast tread textures such as stone_tiles look busy; cobblestone or wood_deck treads read better.
- **Cliff texture:** the 1×1-unit cliff and grass_side textures still look fairly regular (horizontal brick-like strata). Large-scale vertex tint softens it; sideVariation (random pixel offset per face) is off by default because it breaks joint continuity.
- **Static terrain:** geometry, AO and tint are baked at build time. Terrain edits need a new TileMap; colliders and walk surfaces are dynamic.
- **Fringe coverage:** fringes only appear between tiles at the same height and only from grass tiles. Other material pairs, such as sand to dirt, keep straight borders.
- **Brim corners:** brims only extend over convex corners on N/S faces, to avoid coplanar overlap. E/W corners rely on the skirts meeting.
- **Water reflections:** no geometry reflections, only a sky/fog colour fresnel.
- **Shore texture:** 8 texels per tile. It rebuilds when the collider count changes; call water.refresh() if colliders are swapped without the count changing. Colliders on dry land also trigger one rebuild of about 25 ms.
- **Waterfall:** axis-aligned facing only, and no particles of its own; it returns a mist emitter spec instead.
- **move() precision:** move() tests the centre plus 8 perimeter points rather than an exact circle-vs-tile test, so a tile corner can intrude up to about 2% of the radius.
- **Build cost:** about 32 ms geometry and 28 ms water for the 28×20 map with textures cached. First-use texture painting adds about 100 ms.
- **Lighting check:** visual checks used the sandbox's approximation of the LightingSystem keyframes without PostFX. Shaded vertical faces are quite dark under that approximation; final brightness depends on LightingSystem and grading.

### Remaining audit issues
- By contract default (maxStep 0.55 > LEVEL_HEIGHT 0.5), any one-level (0.5) ledge is walkable, and you can also step onto a one-level stair tile from its side. Cliffs need at least 2 levels to block, unless move() is called with maxStep < 0.5 (stairs still work then, since the ramps are continuous).
- move() escape mode: a character that starts overlapping a wall, for example after a teleport next to a cliff, may keep moving until its centre reaches the wall edge before it is stopped. It never climbs, but the sprite can half-clip the cliff. This does not happen when spawning at tile centres.
- Night water stays a fairly bright, saturated royal blue compared with the dark terrain under the LightingSystem's blue night fill. I left this as a stylistic choice; it can be tuned with the `brightness` option.
- Sunlit water at golden hour still leans slate or mauve, which is the physically plausible orange-horizon reflection over dark deep water. Shaded water is fixed.
- Cost of the organic UV-variation shader is about 1.2 ms at 1600x900 with MSAA (terrain total about 2.7 ms including the shadow pass, measured interleaved on a shared GPU). It is acceptable for the budget. If the frame gets tight, the next step is to cache the per-texel variation index in a small data texture.
- Water with `opts.level`: TileMap.getWaterSurface() and tile.waterSurface still report map.waterLevel. Only the Water mesh uses the override.

## props

### Files
- src/engine/world/Props.js
- src/engine/world/props/MeshBuilder.js
- src/engine/world/props/Wind.js
- src/engine/world/props/Flame.js
- src/engine/world/props/PropTextures.js
- src/engine/world/props/Details.js
- src/engine/world/props/House.js
- src/engine/world/props/Trees.js
- src/engine/world/props/LightProps.js
- src/engine/world/props/Structures.js
- src/engine/world/props/SmallProps.js
- sandbox/props.html
- sandbox/props.js
- sandbox/props.actions.json
- sandbox/props.gallery.json
- sandbox/props.flame.json
- sandbox/props.wind.json

### API summary (builder)
**Module:** `src/engine/world/Props.js` exports `class PropFactory({ textures, seed = 42 })`. Every contract member is implemented with the contract's exact signature and defaults:

- `house(x, y, z, { width=4, depth=3, stories=1, roof='roof_red', wall='timber_frame', rotation=0, chimney=true, door='front' })`
- `tree(x, y, z, { kind='oak', height=4.5, seed })` — kind is `'oak' | 'autumn' | 'pine' | 'birch'`
- `lamppost`, `wallTorch`, `campfire`, `well`, `barrel`, `crate`, `crateStack`, `signpost`, `bench`, `windmill`, `haystack`, `flowerbox` — all `(x, y, z, opts)`
- `fence(x0, z0, x1, z1, y, opts)`
- `marketStall(x, y, z, { cloth='cloth_stripe', rotation })`
- `bridge(x0, z0, x1, z1, y, { width=2 })` — also returns `walkRects`
- `rock(x, y, z, { size=1 })`
- `dispose()`

**PropResult** (every factory returns one):
- `object`: placed at (x, y, z), rotated about Y by `opts.rotation`.
- `colliders`: world-space circles or AABBs.
- `lights`: `{ position, color, intensity, distance, flicker, nightOnly }`.
- `emissives`: `{ material, day, night }`, deduplicated per result.
- `emitters`: `{ preset, position, rate, ... }`.
- `update?`, `interact?`.
- Extras beyond the contract: `dispose()` and, on the windmill, `sails`.

**What each factory produces:**
- **House**
  - Stone-brick plinth; walls in timber_frame, plaster, brick, log_wall or stone_brick, with style-specific trim: corner posts and sill for timber/plaster, stone quoins for brick, interlocking log ends for log_wall.
  - Optional jettied 2nd story with joist ends.
  - Gable triangles in the wall or plank texture, with tie beam and king post.
  - Roof: two thick sloped slabs with 0.35 overhang on all sides, tile rows running along the eaves, dark fascia and barge boards, diamond ridge cap.
  - Chimney in chimney_stone with a smoke emitter at the top.
  - Door: door texture in a dark frame, lintel, threshold, stone step, optional hood.
  - Windows: window texture plus emissive mask, frame, sill and lintel; optional tinted shutters and flower boxes.
  - Wall lantern (emissive plus light), optional hanging sign, optional woodpile.
  - Collider is the footprint box. A house is 10–13 draw calls.
- **Trees**
  - Oak, autumn and birch: 7-sided tapered trunk with seeded root-flare bulges and a gentle bend, plus 2–3 branches. The canopy is 9–12 clusters of camera-facing 2×2-unit leaf cards (exactly 16 px/unit), each cluster a 2-card billboard clump. Clusters have authored spherical normals, wrap lighting, per-cluster tint variation, and are darker toward the interior and underside. Autumn trees add fallen-leaf decals.
  - Pine: 4–7 drooping, jagged cone tiers, each with a dark underside band.
  - Wind: the vertex shader uses `uTime`, `uWind` and `uWindStrength`, height-weighted, with the same displacement in `customDepthMaterial`. Shadows sway and are alpha-tested (dappled). In the shadow pass the billboard cards face the sun, so the canopy always casts a full silhouette.
  - 2–3 draw calls per tree.
- **Flame shader**
  - Y-billboard driven by `uCameraYaw`, quantised to 16 px/unit and stepped at 12 fps.
  - Teardrop profile with licking lobes and noise tongues, coloured from the palette fire ramp. Only the white core is HDR, so it blooms while the edges stay saturated after ACES.
  - Alpha-tested so it writes depth, and fogged. A soft additive glow card sits behind it and brightens with `uNight`.
- **Light props**
  - Lamppost: square iron post with collars, curled scroll arm, hanging lantern (or `style: 'top'`). Light flicker 0.2, nightOnly.
  - Wall torch: bracket, handle, flame. Light flicker 0.45.
  - Campfire: ring of stones, ash bed, crossed charred logs, log seat, flame. Emits embers and smoke; light flicker 0.5, `nightOnly: false`.
- **Other props**
  - Fence: posts with pointed caps and rails; box colliders, split into short pieces on diagonal runs.
  - Well: octagonal well_stone wall with cap stones, water, posts, gable roof (default wood_planks), windlass, rope and bucket.
  - Market stall: frame, sloped awning with a scalloped valance, counter with a cloth skirt and produce crates (apples, oranges, cabbages, grapes), tilted display crates in front, and side crates.
  - Bridge: wood_deck planks on a slight arch, stringers, posts and rails. Returns stepped `walkRects` at deck height plus rail colliders.
  - Signpost: arrow boards with sign_board texture.
  - Rock: faceted, displaced icosahedron in grey granite with moss on the upward-facing facets.
  - Also: bench, barrel (standing or lying), crate, crateStack, haystack with pole and straw clumps, flowerbox (on legs or `wall: true`).
  - Windmill: tapered octagonal stone and plaster tower with battens, conical cap, door, windows, and 4 lattice sails that rotate in `update(dt)` with no allocations.

**Public helpers on PropFactory** (for custom props): `rng`, `builder`, `finish`, `world`, `boxCollider`, `localRect`, `result`, `flame`, `windowMaterial`, `glassMaterial`, `windMaterial`, `foliageMaterial(name, { billboard })`, `decalMaterial`, `rockGeom`, `track`, and `extra` (a `PropTextureSet`).

**Helper modules** (`src/engine/world/props/`):
- `MeshBuilder`: merged geometry per material, with world-space UVs = size / `meta(name).units`, so density is 16 px/unit everywhere. It emits boxes (per-face materials and specs), polys, quads, tris, lathes and tubes, bakes vertex-colour AO, and writes the `aSway`, `aPhase` and `aCenter` attributes.
- `Wind` (`applyWind`, `createWindDepthMaterial`), `Flame` (`createFlame`, `createFlameMaterial`, `createGlowMaterial`), `PropTextures` (`PropTextureSet`).

**Sandbox:** `sandbox/props.html` shows the showcase lot, and `?mode=gallery` shows an option-coverage gallery.
- `window.__props` exposes `setNight`, `frame(view | {x, z, y, dist, yaw, pitch})`, `info()`, `check()` and `disposeTest()`, plus handles to the renderer, scene, camera, factory, textures, results and globalUniforms.
- Final runs: 0 page errors, 0 console errors, 0 warnings; `check()` ok; `disposeTest` returns GPU geometries and textures exactly to baseline.

### Deviations / additions
No contract member was renamed and none changes meaning. Additions and interpretations:

1. **PropResult extras.** Every result also has `dispose()`, which frees that prop's own geometries and flame materials and removes the object. The windmill result also exposes `sails` (a THREE.Group). The bridge adds `walkRects`, as the contract specifies.
2. **Extra options** beyond the contract defaults (all optional):
   - `house`: `seed`, `gableFront`, `upperWall`, `gable`, `pitch` (deg), `overhang`, `roofThickness`, `plinth`, `plinthHeight`, `storyHeight`, `upperHeight`, `jetty`, `shutters`, `flowerboxes`, `lantern`, `sign`, `woodpile`, `doorHood`, `doorOffset`, `windowLights`, `chimneySide`, `ridge`, `id`. `door` also accepts `'back' | 'left' | 'right' | 'none'`.
   - `tree`: `rotation`, `fallenLeaves`.
   - `lamppost`: `style: 'arm' | 'top'`, `height`, `intensity`, `distance`.
   - `wallTorch`: `embers`.
   - `campfire`: `stones`, `logs`, `seat`.
   - `marketStall`: `width`, `depth`, `display`.
   - `bridge`: `arch`, `postDepth`, `rails`.
   - `fence`: `spacing`, `height`, `rails`.
   - Others: `rock.flat`, `barrel.lying`, `crateStack.count` / `.barrel`, `signpost.boards`, `bench.back` / `.length`, `windmill.height` / `.roof` / `.wall` / `.speed` / `.sailLength`, `flowerbox.wall` / `.length`.
3. **Emissive starting value.** Emissive materials (windows, lantern glass) are TextureLibrary material variants created with `emissiveIntensity: 0`, so they are dark by day until LightingSystem drives them via `registerEmissive`. Descriptors: windows night 1.6, lantern glass night 2.2–2.4.
4. **Emitter descriptors** add `rate` (and `size` on chimney smoke) as preset overrides: chimney smoke rate 3; campfire embers rate 6 and smoke rate 2.5; optional torch embers.
5. **Prop textures not in the library.** A few are painted locally in `PropTextures.js`: birch bark, market produce atlas, windmill sail lattice, fallen-leaf litter, campfire ash, and granite boulder (plain and mossy). All are 16 px/unit, built with PixelCanvas and the PALETTE, with normal maps. `Textures.js` was not edited.
6. **Canopy construction.** Canopy clusters are billboard clumps (2 camera-facing cards per cluster, facing the sun in the shadow pass), which the task allowed as "or a billboard clump". Intersecting 3-quad cards looked sparse from the diorama camera.

### Integrator notes (auditor)
Construction and scene setup
- Create one factory: `new PropFactory({ textures, seed })`. Every factory returns a PropResult. Add `result.object` to the scene at the root: all positions, colliders and lights are computed in world space at build time. Do not reparent props under transformed parents or move them afterwards.

Wiring each result
- `lights`: pass each descriptor straight to `lighting.addPointLight(d)`. Fields map 1:1: position, color, intensity, distance, flicker, nightOnly.
- Light budget: each house with a door lantern, each lamppost, each torch and each campfire returns one light (11 in the sandbox lot). Choose which descriptors become real lights to stay within the 12-light budget.
- `emissives`: call `lighting.registerEmissive(e.material, { day: e.day, night: e.night })`.
  - Window and lantern-glass materials are shared by every prop that uses the same TextureLibrary, so the same material appears in many results. Dedupe by material if you like; duplicate registrations are harmless now that all descriptors agree (window 1.6, glass 2.4).
  - These materials start at emissiveIntensity 0, so windows stay dark until registered.
- `emitters`: pass each descriptor straight to `particles.createEmitter(d)`. They carry preset plus position plus a `rate` override: chimney smoke 3, campfire embers 6 and smoke 2.5, optional torch embers 2.
- `colliders`: call `tileMap.addCollider(c)` for each.
- Bridges: also call `tileMap.addWalkSurface(r)` for each entry in `bridgeResult.walkRects`. They are stepped along the arch at deck height.
- `update`: call `result.update?.(dt)` every frame. Only the windmill has one.
- `interact`: `{ position, radius, id }`. Pass `opts.id` to get unique ids.

Things that need no wiring
- Flames, glows and foliage animate on the GPU from `globalUniforms`: uTime, uCameraYaw, uWind, uWindStrength, uNight and uSunDirection. They need no update calls and no PropSprites or Particles dependency.

Performance (strongly recommended)
- After building all props, call `const s = factory.mergeStatic(results); scene.add(s.object);` and still add every `result.object`.
- The result objects keep wind trees, flames and windmill sails. Everything else static is batched into one mesh per material, which cuts the lot from 436 to 212 draw calls with identical visuals.
- Call it once props are placed at the scene root or under a common identity parent.
- A merged prop's own `dispose()` no longer frees its merged parts. Use `s.dispose()` or `factory.dispose()`.
- Mark any custom animated child with `userData.dynamic = true` so it is not merged.

Disposal
- `factory.dispose()` frees factory-owned geometries, materials and textures. It does not touch the TextureLibrary's.

Extras beyond the contract
- `result.dispose()`, `windmill.sails`, `bridge.walkRects`, `PropFactory.mergeStatic`.
- `createGlowMaterial({ baseV })`.
- Many optional opts, as listed in the builder's report.
- *Added 2026-10-07 (additive):* the interior furniture methods `bed`, `table`, `chair`, `shelf`,
  `hearth`, `counter`, `rug`, `staircase`, `wardrobe`, `wallWindow`, `sacks`
  (`props/Furniture.js`; the catalog's `interior: true` types) — see
  [world.md §4.2](../architecture/modules/world.md#42-factory-methods).

### Known limitations
- **Draw calls per house.** Houses are 10–13 draw calls: 2-story brick houses with a sign reach 13 because every texture is its own material, and chimney_stone and sign_board each add one.
- **Shared materials across props.** Library materials are shared by every prop (e.g. one window material for all houses). The same material therefore appears in the `emissives` of several results, so the integrator should dedupe (or `registerEmissive` should be idempotent). Driving it affects all houses together, which is the intended behaviour.
- **Light budget.** Each house with a door lantern, each lamppost, torch and campfire returns one light. In the showcase lot that is 11 lights, so a larger village must choose which descriptors become real PointLights to respect the 12-light budget.
- **Draw-call count in the sandbox.** The sandbox lot shows about 435 calls in `renderer.info`, but that figure includes the shadow pass. The colour pass is roughly half, and the showcase packs 52 props onto one lot.
- **Diagonal bridges.** Bridge `walkRects` and rail colliders are world AABBs of rotated pieces, so on a diagonal bridge they slightly over-cover the water beside the deck. Axis-aligned bridges are exact. Diagonal fence runs are split into 0.3-unit boxes to stay tight.
- **Canopy billboard orientation.** The camera-facing canopy cards use `uCameraYaw` (the same convention as Sprite3D and Foliage), so their tilt assumes the default pitch of about 32°. The shadow-pass cards face `uSunDirection`, which LightingSystem must keep current; the sandbox writes it manually.
- **Flame, smoke and embers.** Flames are procedural shader billboards and are not tied to PropSprites. Smoke and ember particles are only descriptors; the sandbox previews them with a tiny local sprite stub.
- **Rendering path not tested.** Colour grading and bloom were not tested here, because the sandbox uses a raw renderer with ACES tone mapping and no PostFX. Flame and window HDR values were tuned so the edges stay saturated and only the cores exceed 1.0, which should bloom.
- **Wind and bounds.** Wind displacement is small by design (about 0.1 units at strength 1). Bounding volumes of wind and billboard meshes are padded, so culling stays correct.
- **Fixed sizes.** House story heights are fixed at 3 (ground) and 2 (upper) so timber beams align. Heights other than the defaults are possible via options but may misalign the timber_frame beam pattern.

### Remaining audit issues
- Unmerged houses cost 10–13 draw calls each; a 2-story brick house with a sign is 13, above the brief's ~12. A full village without mergeStatic would exceed the 300-call budget once the shadow pass is counted. The integrator should call mergeStatic.
- Bridge `walkRects` and rail colliders are AABBs of rotated pieces. On diagonal bridges they slightly over-cover the water beside the deck; axis-aligned bridges are exact.
- Canopy billboard cards use a fixed tilt of about 23°, tuned for the default ~32° camera pitch. They face `uCameraYaw` in the colour pass and `uSunDirection` in the shadow pass, so LightingSystem must keep `uSunDirection` current (it does).
- With a wall torch viewed more than about 30° off the wall normal, the glow card can still meet the wall along a faint vertical line. The glow is about 5% there, so it is barely visible. A proper soft-particle fade would need the scene depth, which is not available in the scene pass.
- Default interact ids repeat: every house is 'house', every stall 'stall', and so on. The integrator should pass `opts.id`.
- `house` stories are clamped to 1–2. Story heights other than the defaults (3 and 2) can misalign the timber_frame beams.
- The sandbox renders without PostFX (raw ACES), so bloom and grading on flames and windows are untested here. Values were chosen so that only the cores exceed the bloom threshold.
- Outside this module: ARCHITECTURE §4.1 asks for PCFSoftShadowMap, but r186 removed it. WebGLShadowMap warns and falls back to PCFShadowMap. This is for the Engine owner.

## scalability (big levels, 128 × 128)

### Files
- `src/engine/lighting/LightPool.js` — a fixed set of point lights shared by any number of light descriptors.
- `src/engine/world/SpatialSplit.js` — `kdSplit(items, { x, z, weight, maxWeight, maxExtent, minWeight })`, `triangleCount(geometry)`, `cullByBox(mesh, { pad, only })`.
- `src/engine/world/ShadowCasters.js` — `buildShadowCasters(pieces, { lights, maxTriangles, maxExtent, name })`, `isProxyCaster(mesh)`, `makeShadowOnly(mesh, lights)`, `isShadowFrustum(lights, frustum)`.
- `src/engine/world/shoreWorker.js` — the shore bake of `Water.refreshAsync()` in a worker.
- `src/engine/level/LevelMap.js` — `renderLevelMap(level, { pixelsPerTile })` → `{ canvas, pixelsPerTile, width, depth }`.
- `src/engine/ui/Minimap.js` — `Minimap` (HUD, `ui.minimap`) and `WorldMap` (overlay, `ui.worldMap`).

### API additions (all additive)
- `LightingSystem`: `retargetPointLight(handle, opts)`, `flickerAt(seed, amount, speed)`, `setShadowDepthRange(up, down)` (bias rescaled to the same world-space bias); point-light handles get `fade` (0..1, default 1 — `fade === 1` leaves the intensity maths bit-identical).
- `TileMap`: a spatial hash grid of the colliders (2-unit cells, rebuilt lazily after `addCollider` / `removeCollider` / a length change; `dynamic: true` colliders — the villagers — are tested on every query, `collidersChanged()` after moving another collider in place); `_pushOut` visits exactly the colliders, in the order, of the linear scan (verified identical on 30 000 random moves); `queryColliders(minX, minZ, maxX, maxZ, out)`; `consolidateChunks({ maxTriangles, maxExtent, minTriangles })` (the game, after the build; a later `rebuildChunks` rebuilds every chunk of a touched batch).
- `Water`: `refreshAsync()`, constructor option `deferShore`; `buildLevelTerrain(level, { deferShore })`. `bakeShore` tests only the colliders touching each wet tile (byte-identical result).
- `PropFactory.mergeStatic(results, { maxTriangles, maxExtent, minTriangles, shadowCasters })`, `Scenery.mergeTrees(results, { maxTriangles, maxExtent, minTriangles })`, `buildGroundDetail({ maxInstances })` — defaults unchanged (one batch per material / field).
- `Particles` area / point emitters recompute their culling radius when the wind changes (rain and snow blow 2–5× harder than at creation).
- `Input`: action `map` (KeyN, Tab; gamepad Back). Photo mode moved from gamepad Back to the right stick click.
- `UI`: `minimap` (`setMap(map, { view })`, `enabled`, `update(markers)`) and `worldMap` (`setMap(map, { title, subtitle, regions })`, `open()`, `close()`, `toggle()`, `isOpen`, `setRegion(name)`, `update(dt, markers)`); CSS `.lu-minimap`, `.lu-worldmap*` in ui.css (world map z-index 7).

### Addendum (2026-09-27): LightPool for the editor (all additive)
- `new LightPool(lighting, descs, { fixed: true })`: always exactly `size` lights (spares parked, intensity 0).
- `setDescriptors(descs, { snap })`: replaces the set without creating or removing a light; static while it fits, pooled above (coming from static: no hysteresis bonus in the first ranking); a descriptor passed again — or a new one with the same `tag` and index within that tag — keeps its light; `setDescriptors([])` starts afresh.
- `used` (alias of `activeCount`); static `activeCount` = min(handles, descriptors).
- Module exports `sanitizeLightDescriptor(d)` and `sanitizeLightDescriptors(descs, { cache })` — the sorting and clamping formerly inline in `World._wireLights`. The editor's private `LightPool` class in `ObjectPreview.js` was removed; the preview now uses this one ([lighting.md §4](../architecture/modules/lighting.md#4-lightpool-sharing-12-lights)).

### Integrator notes
- `World` applies all of it only to levels bigger than 64 tiles on a side (`BIG_LEVEL_BATCHING`); Emberfall, the sample hamlet and Brightwater Crossing build exactly the same meshes and lights as before (draw calls, triangles and light parameters identical; screenshots with frozen time identical up to villagers' positions).
- Shadow-only meshes rely on three.js r16x+ routing frustum culling through `Object3D.intersectsFrustum(frustum)`: a proxy returns false for every frustum but the shadow frustum of its lights.
- `cullByBox` caches the world box: the mesh must not move afterwards (static batches only).
- `LightPool.snap()` (the game calls it on `teleport`) re-ranks at the next update without fades; a light it moves is re-lit in that same frame (`retargetPointLight(handle, {})` recomputes the intensity LightingSystem had already set from the old owner). A light handed over outside a snap is dark from the frame it moves and fades in (LightingSystem computes intensities before the pool runs).

### Integration pass (Starfall Vale)
- **LightPool:** a snap (teleport, `talkTo`) no longer leaves every moved light dark for one frame — measured before: all 12 lights at 0 for exactly the frame after the teleport; after: ≥ 10 lit on every frame of the traces.
- **GodRays:** shafts are frustum-culled by a sphere round their base (radius `uLength + uWidth / 2 + 0.1`, valid for any sun direction — the quad is placed in the vertex shader) through `Object3D.intersectsFrustum`. Starfall Vale's 22 shafts no longer all draw everywhere (−10 to −15 draw calls per view); Emberfall renders identically (one call fewer at one of the compared views).
- **WorldMap:** a region name whose spots round its centre are taken tries a 5 × 5 grid of spots inside its own region rect (nearest the centre first) before it is hidden. Starfall Vale: 3 of 30 names hidden (was 5), "Hearthwick" and "Mount Lumen" now shown.
- **Scenery:** `FOREST_KINDS`, `forestKindAreas(env)` and `scatterForest({ kindAreas })` — `environment.forest.areas` picks the kinds of border / outer trees by area (World and the editor's SceneryPreview pass it; `shiftLevelContent` moves the rects). Without the field the scatter is unchanged.
- **Editor:** the Lights stat no longer warns above 12 (`92 · 12 lit`; the pool shares them); Level › Check for problems lists bridge ends whose first plank is more than a step (0.55) above or below the flat bank beyond them (`bridgeStepIssues` in EditorApp: 0.5 + arch · sin(π / 2n) on a bank one level down).

### Review pass (Starfall Vale)
- **LightPool:** `priorityWeight` defaults to 1.5 (was 4): at 4 a house lantern (priority 3) counted as 8 units farther than a torch, so lamps 5–7 units from the player stayed dark at night while torches 9–10 units away were lit (114 of 272 sampled Hearthwick spots; 3 at 1.5). Static pools (≤ 12 descriptors) are unaffected.
- **Water:** `dynamic` colliders (walking villagers) are left out of the shore signature and the shore bake (`shoreInput`), so the villagers added after the worker bake no longer trigger a synchronous re-bake on the first frame (420–450 ms on Starfall Vale) or carve posts into the shore where they stand on a pier. `water.glint` (level format) reaches the `Water` constructor through `waterGlint(level)` (ObjectBuilder; the editor preview too).
- **Game:** the waterfall spray / glint burst pools (when the level has splashing falls) and the running-dust pool are primed with one particle far below the world before the load-time compile (no 100–300 ms compile on the first approach to a waterfall); the far-actor throttle distance grows with the zoom (`max(42, 1.15 × distance + 4)`).
- **World:** big levels switch off particle areas, waterfall mist and chimney smoke whose box is more than `BIG_LEVEL_BATCHING.particleCull` (34) units from the camera focus (via `Emitter.enabled`).
- **Weather:** `environment.fogScale` (optional, default 1) multiplies the fog density (`levelFog`).
- **ResolutionGovernor:** decides on the median of the last 5 GPU samples; steps down after 4 slow medians, up after 20 fast ones, at most once per 3 s (each step reallocates the targets: a hitch of a few ms to ~0.2 s on a busy GPU).
- **Minimap / WorldMap:** the minimap window is clamped to the map (the arrow moves off-centre near edges; margins of maps smaller than the window take the map's edge colour); an area name with no free spot retries with `.lu-worldmap__label--compact` before hiding; a label over the player arrow fades to 0.3 (label boxes kept by `_layoutLabels`); the legend column has a fixed width.
- **AudioDirector:** water sample points in a `Float32Array` (`waterXZ`), no per-call garbage. **DebugPanel:** `syncListening()` pauses `listen()`ing controllers while the panel is hidden.
- **Editor:** `app.ready` resolves after the 3D preview exists (`__editor.ready3d` after its first build); the tile palette, status-bar dot and brush previews colour custom legend chars by `tileColor(ch, def)` (tools/common.js); the 2D map shimmers each water flow its own way (one clip path per flow); Level settings keeps unknown `water` keys and edits `glint`. Big levels: props batched per 32-tile chunk, terrain chunks merged per 48-tile cell (`TerrainBatcher`), shadow proxies for merged chunks / cells; sprite shadow quads shadow-only (every level).
- **BlobBatch** (`src/engine/sprite/BlobBatch.js`, exported): `adopt(sprite)` moves a Sprite3D's blob contact shadow off layer 0 and draws all adopted blobs in one InstancedMesh (per-instance opacity attribute on the blob's own material look), `update()` per frame after the sprites. The game uses it on big levels only (a busy Starfall Vale view drew ~35 blobs one call each; the worst zoomed-out town view went from 344 to ~300 draw calls with the particle cull).
