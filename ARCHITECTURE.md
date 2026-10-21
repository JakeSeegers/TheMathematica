# Luminati — 2.5D Pixel-Art Engine Architecture & Module Contracts

Luminati is a three.js (r186) **2.5D pixel-art** engine inspired by Square Enix's HD-2D games:
hand-crafted pixel-art sprites living inside a lit, shadowed, depth-of-field-blurred 3D diorama.
Game textures, sprites, sounds and music are **procedurally generated at runtime**. UI fonts
load from Google Fonts first, with packaged fonts available locally; documentation screenshots
and UI sandbox backdrops are the repository's image assets.

This file is the single source of truth for module boundaries. Every module MUST implement the
exact exported names and signatures below. If you need something extra, add it — but never rename
or change the meaning of a contract member. See the
[contract change rules](docs/contracts/README.md#3-how-to-change-a-contract-the-additive-rule).

---

## 1. The look we are targeting (read this first)

The 2.5D pixel-art look (Square Enix's HD-2D games are the reference) is the combination of:

1. **Pixel-art everything, at a consistent density.** Characters are small 2D pixel sprites
   (~24–32 px tall) standing upright in 3D. Environment geometry is simple and blocky, but every
   surface wears a crisp, low-resolution pixel texture (16 px per world unit, NEAREST magnification)
   with a rich, hue-shifted palette and visible hand-placed detail (cracks, moss, grass blades,
   wood grain, roof tiles). Normal maps make pixel textures react to light.
2. **Diorama camera.** A narrow-FOV perspective camera (~26–30°) looking down at ~30–35°, far away,
   smoothly following the player. The scene feels like a miniature model.
3. **Strong depth of field / tilt-shift.** Only a band around the player is sharp; the foreground
   near the camera and the background fall into soft bokeh blur. Bright specks become bokeh discs.
   This is THE signature of the style.
4. **Rich lighting.** A warm directional sun with soft shadows (sprites cast shadows too), cool
   ambient fill, warm flickering point lights (lanterns, torches, windows, campfires) that pool
   light on the ground and on sprites, and a day/night cycle with golden hour and blue night.
5. **Bloom + color grading + vignette.** Emissive lights and sunlit sparkles glow. Colors are warm
   and saturated with lifted, slightly teal shadows; a heavy vignette darkens corners; subtle film
   grain and a touch of chromatic aberration at the edges.
6. **Atmosphere.** Floating dust motes glinting in the light, god-ray light shafts, fireflies at
   night, drifting leaves, chimney smoke, campfire embers, animated water with sparkles, gentle
   wind sway on foliage, distance fog.
7. **Ornate UI.** Dark translucent dialog windows with thin gold double borders and corner
   ornaments, serif typography, speaker name plates, typewriter text; elegant area-title banners.

Performance target: **60 fps at 1600×900 with hardware-accelerated desktop rendering**. Budget:
≤ 300 draw calls, ≤ 12 active point lights, one 2048² directional shadow map, DOF at half resolution.
Actual performance depends on the browser and hardware; see the
[measurement conditions and profiling guide](docs/architecture/PERFORMANCE.md).

---

## 2. Conventions

- **three.js r186**, ES modules, `import * as THREE from 'three'`; addons from `'three/addons/...'`
  (e.g. `three/addons/postprocessing/EffectComposer.js` — *note 2026-10-07, following the code
  (KNOWN_ISSUES DOC-12): only an example of the import path; `PostFX` uses no `EffectComposer`
  and drives `UnrealBloomPass`, `OutputPass` and `FullScreenQuad` itself*). Plain JavaScript (no TypeScript source
  files), JSDoc comments on public APIs. No external asset files; fonts come from `@fontsource/*`
  npm packages. *(Added 2026-09-30, additive: the JSDoc is type-checked by `tsc` with `checkJs` and
  `noEmit` — `npm run typecheck`, which must report 0 errors; types JSDoc cannot express live in
  type-only `types.d.ts` files that no bundle includes. See
  [CONVENTIONS.md §3.1](docs/development/CONVENTIONS.md#31-the-type-check).)*
- **Units:** `PPU = 16` texels per world unit; 1 tile = 1 unit; terrain level height `LEVEL_HEIGHT = 0.5`
  (see `src/engine/constants.js`). Characters are ~2 units tall (32 px frames).
- **Axes:** Y up. Map tile `(i, j)` covers `x∈[i,i+1], z∈[j,j+1]`, centre `(i+0.5, h, j+0.5)`.
  Rows of a map string array run along +Z. Camera yaw 0 = camera on the +Z side looking toward -Z,
  so screen-down = +Z. Sprite sheet directions: `down` (+Z, faces camera), `left` (-X), `right` (+X),
  `up` (-Z).
- **Color management:** `renderer.outputColorSpace = SRGBColorSpace`; color textures use
  `SRGBColorSpace`, data textures (normal/masks) use `NoColorSpace`. Tone mapping is
  `ACESFilmicToneMapping`, applied once by `OutputPass` inside PostFX. `renderer.toneMappingExposure`
  is owned by `LightingSystem`.
- **Lights are physically based** (three r155+): point lights use `decay = 2`; intensities are in
  candela, so warm lanterns typically need intensity ~4–20 with `distance` 6–10.
- **Materials:** world geometry uses `MeshLambertMaterial` (per-fragment in r186, supports `map`,
  `normalMap`, `emissiveMap`) unless a module has a good reason for `MeshStandardMaterial` or a
  custom `ShaderMaterial`. Custom shaders that should be fogged must set `fog: true`, include the
  fog chunks and reference `globalUniforms.uFogStart` (as `uFogStart`, the game's fog start).
- **Pixel textures:** create them via `PixelCanvas#toTexture()` / `makePixelTexture()`
  (`src/engine/pixel/PixelCanvas.js`) — NEAREST mag filter always.
- **Shared uniforms:** `src/engine/render/GlobalUniforms.js` exports `globalUniforms`
  (`uTime`, `uNight`, `uWind`, `uWindStrength`, `uCameraYaw`, `uCameraPosition`, `uSunDirection`,
  `uSunColor`, `uFogColor`, `uFogStart`). Custom shaders reference these objects directly (never
  copy the value).
- **Randomness:** always seeded (`RNG` / `hash2` / `fbm2` from `src/engine/utils/math.js`) so the
  world looks identical on every load. Never `Math.random()` for procedural content.
- **Disposal:** every class that allocates GPU resources has `dispose()`.
- **No global side effects on import** (except UI CSS/font imports inside `src/engine/ui`).

### Shared foundation files (already written — use, don't rewrite)
| File | Exports |
| --- | --- |
| `src/engine/constants.js` | `PPU, TILE_SIZE, LEVEL_HEIGHT, DIRECTIONS, RENDER_ORDER` |
| `src/engine/utils/math.js` | `clamp, lerp, invLerp, remap, smoothstep, fract, damp, angleDelta, DEG2RAD, RAD2DEG, mulberry32, hashString, RNG, hash2, valueNoise2, fbm2, bayer4` |
| `src/engine/render/GlobalUniforms.js` | `globalUniforms` |
| `src/engine/pixel/PixelCanvas.js` | `PixelCanvas, parseColor, toHex, toCss, toThreeColor, mixColor, rgbToHsl, hslToRgb, shadeColor, rampFrom, makePixelTexture, normalMapFromHeight` |
| `src/engine/pixel/Palette.js` | `PALETTE, rampAt` |
| `tools/check.mjs` | headless Chrome harness (`npm run check -- --page=... --out=...`) |

You may make small, backwards-compatible additions to a shared foundation file if truly needed.

---

## 3. Directory layout & ownership

```
index.html                     the launcher: the list of campaigns and levels (tools/vite-launcher.js)
game.html                      (integration) the game page
src/main.js                    (integration) boots the game
src/engine/index.js            (integration) barrel re-exporting the public engine API
src/engine/core/               Engine.js, Input.js, EventEmitter.js, CameraRig.js
src/engine/audio/              AudioSystem.js
src/engine/render/             PostFX.js, shaders/*.js
src/engine/pixel/              Textures.js, CharacterSprites.js, PropSprites.js
src/engine/sprite/             Sprite3D.js, SpriteManager.js, Foliage.js
src/engine/fx/                 Particles.js, GodRays.js
src/engine/lighting/           LightingSystem.js, Sky.js
src/engine/world/              TileMap.js, Water.js, Props.js (+ optional world/props/*.js)
src/engine/ui/                 UI.js, DialogBox.js, Banner.js, TitleScreen.js, HUD.js,
                               InteractPrompt.js, DebugPanel.js, Fader.js, ui.css
src/game/                      (integration) village map, player, NPCs, game wiring
src/game/glaive/               (combat levels only, docs/specs/GLAIVE.md) GlaiveCombat, Encounter, Sheet, bestiary, Foe, Stage
src/game/combat/               shared combat-level pieces: waystones, chests, pickups, boss arena, FX, music, Nav, defs
sandbox/<module>.html|.js      per-module standalone test pages (owned by that module's author)
```

*Added 2026-10-07, following the code (KNOWN_ISSUES DOC-02; all additive — every file above is
still there).* The layout predates these engine files and folders; the complete, current map is
[docs/architecture/OVERVIEW.md §3](docs/architecture/OVERVIEW.md#3-engine-module-map) and the
module pages in [docs/architecture/modules/](docs/architecture/modules/README.md):

```
src/engine/constants.js, utils/math.js, utils/own.js   shared foundation (own.js: own-key
                               lookups of level names)
src/engine/level/              LevelFormat.js, ObjectCatalog.js, ObjectBuilder.js, LevelStorage.js,
                               LevelMap.js, Travel.js, StoryScript.js, StoryChecks.js (docs/contracts/LEVEL_EDITOR.md)
src/engine/lighting/           + LightPool.js (at most 12 point lights shared by any number of sources)
src/engine/world/              + SpatialSplit.js, ShadowCasters.js (big-level batching), WaterShore.js,
                               shoreWorker.js (the shore bake), world/props/*.js (the prop builders)
src/engine/sprite/             + BlobBatch.js (instanced contact shadows)
src/engine/pixel/              + Palette.js, PixelCanvas.js; MonsterSprites.js, FxSprites.js (combat, §4.9)
src/engine/fx/                 + FxQuads.js, GroundMarkers.js (combat, §4.9)
src/engine/ui/                 + Minimap.js (minimap + world map); combat and story UI (CombatHUD, BossBar,
                               WorldLabels, Announcer, DeathScreen, Journal, Emotes, EndCard; combat.css, story.css)
src/engine/*/types.d.ts        type-only declarations for the type check (§2), in no bundle
src/editor/                    the level editor (docs/contracts/LEVEL_EDITOR.md §6)
src/game/campaign/, src/game/story/   campaigns (§5) and the story runtime (docs/specs/STORY_SCRIPT.md)
```

---

## 4. Module contracts

### 4.1 Core — `src/engine/core/`

```js
// EventEmitter.js
export class EventEmitter {
  on(event, fn)   // → unsubscribe function
  off(event, fn)
  once(event, fn) // → unsubscribe function
  emit(event, ...args)
}

// Engine.js
export class Engine {
  /** @param {{container?:HTMLElement, maxPixelRatio?:number, renderScale?:number,
   *           shadowMapType?:THREE.ShadowMapType, clearColor?:THREE.ColorRepresentation}} opts */
  constructor(opts)
  renderer   // THREE.WebGLRenderer: antialias false, powerPreference 'high-performance',
             // shadowMap.enabled = true, PCFSoftShadowMap, ACESFilmic, SRGB output
  scene      // THREE.Scene
  camera     // THREE.PerspectiveCamera(fov 28, near 0.5, far 400)
  input      // Input
  events     // EventEmitter: 'resize' ({width, height, pixelRatio}), 'update' (dt, t),
             // 'lateUpdate' (dt, t), 'beforeRender' (dt, t), 'afterRender' (dt, t)
  time       // { elapsed, delta, frame, timeScale }  (delta clamped to ≤ 1/20 s, scaled)
  renderScale      // 0.25..1 multiplier on the device pixel ratio (setter triggers resize)
  get width(); get height(); get pixelRatio(); get aspect()
  addSystem(system, order = 0) // system: { name?, update?(dt, t, engine), lateUpdate?(dt, t, engine), dispose?() }
  removeSystem(system)
  setRenderFn(fn)  // fn(dt, t) replaces the default renderer.render(scene, camera)
  start(); stop(); dispose()
}
```
Frame order: `input.update()` → systems `update` (ascending `order`) → `events 'update'` →
systems `lateUpdate` → `events 'lateUpdate'` → write `globalUniforms.uTime` → `'beforeRender'` →
render fn → `'afterRender'` → `input.endFrame()`. The engine resizes to its container
(ResizeObserver) and emits `'resize'`. Exposes itself as `window.__engine` when `?debug` or
`?autostart` is in the URL.

*Correction 2026-10-07, following the code (KNOWN_ISSUES DOC-01):* three r186 removed
`PCFSoftShadowMap` for WebGL (it would fall back with a console warning). `Engine` defaults to
`THREE.PCFShadowMap` — soft and radius-aware in r186 — and maps an explicit
`shadowMapType: THREE.PCFSoftShadowMap` to it silently; `LightingSystem` does the same with the
renderer it is given.

```js
// Input.js
export class Input {
  constructor(target = window)
  isDown(code) ; wasPressed(code) ; wasReleased(code)   // KeyboardEvent.code, e.g. 'KeyW'
  action(name) ; actionPressed(name) ; actionReleased(name)
  getMoveVector()   // {x, y} in [-1,1], y>0 = up/forward (screen up), from WASD/arrows + gamepad stick, length ≤ 1
  wheelDelta        // accumulated mouse-wheel deltaY this frame (reset in endFrame)
  pointer           // { x, y, down } in CSS px
  enabled           // when false all queries return false/zero
  update(); endFrame(); dispose()
  bindings          // { [action]: string[] } editable
}
```
Default action bindings: `up` KeyW/ArrowUp, `down` KeyS/ArrowDown, `left` KeyA/ArrowLeft,
`right` KeyD/ArrowRight, `run` ShiftLeft/ShiftRight, `confirm` Space/Enter/KeyF,
`cancel` Escape/Backspace, `camLeft` KeyQ, `camRight` KeyE, `zoomIn` KeyZ/Equal,
`zoomOut` KeyX/Minus, `debug` Backquote/F1, `time` KeyT, `photo` KeyP, `help` KeyH, `weather` KeyR,
`music` KeyM, `map` KeyN/Tab (world map). Gamepad (standard mapping): A=confirm, B=cancel,
LB/RB=camLeft/camRight, left stick = move, RT = run, Back/View = map, right stick click = photo. Keys pressed between frames must still register `wasPressed` on the
next frame. Prevent default browser behaviour for bound keys (arrows/space scrolling, F1 help).
*Added 2026-10-07, following the code (KNOWN_ISSUES DOC-12):* the constructor is
`Input(target = window, { deadzone = 0.2, wheelIgnoreSelector })` — `deadzone` is the radial,
rescaled stick deadzone; wheel events whose target is inside an element matching
`wheelIgnoreSelector` (default `.lil-gui, input, textarea, select, [contenteditable],
[data-input-ignore]`) do not reach `wheelDelta`. Both are also writable members.

```js
// CameraRig.js
export class CameraRig {
  /** @param {THREE.PerspectiveCamera} camera
   *  @param {{pitch?:number(deg, default 32), yaw?:number(deg, 0), distance?:number(24),
   *           minDistance?:number(14), maxDistance?:number(36), fov?:number(28),
   *           followLambda?:number(5), lookAhead?:number(1.0), targetOffsetY?:number(1.0)}} opts */
  constructor(camera, opts)
  setTarget(object3D)              // follow target (e.g. the player sprite root)
  focusPoint                       // THREE.Vector3 — smoothed point the camera looks at
  yaw; pitch; distance             // current (smoothed) values, radians / units
  yawTarget; pitchTarget; distanceTarget
  bounds                           // null or {minX, maxX, minZ, maxZ} clamping focusPoint
  rotate(deltaRadians)             // adds to yawTarget
  zoom(delta)                      // adds to distanceTarget (clamped)
  shake(intensity, duration)
  snap()                           // jump instantly to targets
  update(dt, input?)               // input: hold camLeft/camRight rotates smoothly (~70°/s, yaw
                                   // clamped to ±60° unless opts.freeYaw), wheel & zoomIn/zoomOut zoom
  get focusDistance()              // camera → focusPoint distance (for DOF autofocus)
  getMoveBasis()                   // { forward: Vector3, right: Vector3 } on XZ plane for camera-relative movement
}
```
Camera position = `focusPoint + (sin(yaw)·cos(pitch), sin(pitch), cos(yaw)·cos(pitch)) · distance`.
`update()` writes `globalUniforms.uCameraYaw` and `uCameraPosition`. Look-ahead shifts the focus
point in the target's movement direction.
*Note 2026-10-07 (KNOWN_ISSUES DOC-06):* the defaults above are the engine's. The game passes its
own — `CAMERA` in `src/game/config.js`: distance 30 (zoom 18–42), pitch 32°, fov 28, plus
look-ahead 1.3 — and a level's `environment.camera` (distance, pitch) and `environment.highGround`
(a steeper pitch above a height) override those in turn (`Game._applyLevel`; the zoom range
widens to include a level's distance).

```js
// audio/AudioSystem.js — procedural WebAudio, no files
export class AudioSystem {
  constructor({ volume = 0.6 } = {})
  unlock()                     // call from a user gesture; creates/resumes AudioContext
  get ready()
  masterVolume; muted
  playSfx(name, { volume, pitch } = {})  // 'step' | 'blip' | 'confirm' | 'cancel' | 'open' | 'close' | 'chime' | 'splash'
  setAmbience({ wind, birds, crickets, fire, water } /* 0..1 each */)  // smooth crossfades
  startMusic(); stopMusic(); get musicPlaying()  // gentle procedural harp/strings folk loop
  update(dt); dispose()
}
```

**Combat additions (additive, [COMBAT.md](docs/contracts/COMBAT.md) §5.3, §12).**
`input.addBindings(keyBindings, padBindings)` merges extra actions at runtime (combat levels
register J / K / L / U / I / O / C / 1–4 and the pad X / Y / B / LT / RS / LS actions this way, never
through `DEFAULT_BINDINGS`); `input.enableMouseButtons(canvas)` turns canvas mouse buttons into the
virtual codes `Mouse0` / `Mouse1` / `Mouse2`; `input.lastDevice` is `'keyboard' | 'mouse' |
'gamepad'`. `CameraRig.stickZoom` (default 0 = off) zooms with the right stick's Y axis.
`AudioSystem` adds `COMBAT_SFX_NAMES` (35 names, played only on combat levels; `SFX_NAMES` is
unchanged), `startMusic({ track })` with the tracks `emberfall` / `battle` / `boss`,
`setMusicSection`, `playStinger` (`victory`, `levelup`) and the getter `musicTrack`. Without these
calls every behaviour above is unchanged.

### 4.2 Post-processing — `src/engine/render/PostFX.js`

```js
export class PostFX {
  /** @param {THREE.WebGLRenderer} renderer @param {THREE.Scene} scene @param {THREE.PerspectiveCamera} camera
   *  @param {{samples?:number(4), dofScale?:number(0.5)}} opts */
  constructor(renderer, scene, camera, opts)
  settings = {
    enabled: true,
    dof:   { enabled: true, focusDistance: 24, focusRange: 5, maxBlur: 12 /*px @1080p*/, nearScale: 1.4,
             farScale: 1.0, tiltShift: 0.35, tiltCenter: 0.52, tiltWidth: 0.28, bokehBoost: 1.5, autoFocus: true },
    bloom: { enabled: true, strength: 0.55, radius: 0.55, threshold: 0.82 },
    grade: { enabled: true, exposure: 1.0 /*post-tonemap multiply*/, contrast: 1.08, saturation: 1.12,
             temperature: 0.08, tint: 0.0, shadowsTint: [0.02, 0.04, 0.08], highlightsTint: [0.06, 0.03, -0.02],
             vignette: 0.5, vignetteSoftness: 0.55, grain: 0.035, chromaticAberration: 0.0015, sharpen: 0.15 },
  }
  setSize(width, height, pixelRatio)
  setFocus(distance)      // used when settings.dof.autoFocus (focusDistance smoothly follows)
  render(dt)              // renders scene → DOF → bloom → OutputPass (tone map + sRGB) → grade
  get depthTexture()      // scene depth (for optional consumers)
  dispose()
}
```
Pipeline: scene rendered to a HalfFloat multisampled target with a `DepthTexture` → DOF (circle of
confusion from linear depth vs focus + screen-space tilt-shift term; half-res golden-angle bokeh
gather; composited over full-res sharp image by CoC so in-focus pixels stay crisp) → bloom
(`UnrealBloomPass`) → `OutputPass` → grade/vignette/grain/CA/sharpen in display space. When
`settings.enabled` is false render directly. Every sub-effect toggle must work live.

### 4.3 Pixel art — `src/engine/pixel/`

```js
// Textures.js — procedural world texture library (all seamless-tiling where it makes sense)
export class TextureLibrary {
  constructor({ seed = 1337, anisotropy = 4 } = {})
  get(name)          // → THREE.Texture (color, SRGB, RepeatWrapping, mipmaps, NEAREST mag); cached
  normal(name)       // → THREE.Texture normal map (NoColorSpace) or null if the texture has none
  emissive(name)     // → THREE.Texture emissive mask (SRGB) or null
  meta(name)         // → { px: [w, h], units: [uw, uh], alpha: bool }  (units = world size of one repeat)
  material(name, extra = {}) // → cached MeshLambertMaterial with map/normalMap/emissiveMap set up
                             //   (alphaTest 0.5 + DoubleSide when meta.alpha); extra = material params
  has(name); list()  // list() → string[] of all names
  dispose()
}
export const TEXTURE_NAMES // string[] — exactly the names below
```
Required texture names (units = world size of one texture repeat; most are 16×16 px = 1×1 unit):
- terrain tops: `grass`, `grass_dark`, `grass_flowers`, `dirt`, `dirt_path`, `cobblestone`,
  `stone_tiles`, `sand`, `farmland`, `moss_stone`, `riverbed`, `wood_deck`
- terrain sides: `cliff` (1×1, rocky strata), `grass_side` (1×1: dirt with a grass lip hanging
  from the top edge; used for the top unit of a grassy cliff face), `dirt_side`, `stone_wall`
- buildings: `plaster`, `timber_frame` (2×2 units, half-timbered plaster), `wood_planks`,
  `wood_planks_dark`, `log_wall`, `brick`, `stone_brick`, `roof_red`, `roof_blue`, `roof_thatch`,
  `roof_slate`, `door` (1×2 units), `window` (1×1, with emissive mask: glass glows at night),
  `chimney_stone`
- nature & props: `bark` (1×2), `leaves` (2×2, alpha cut-out foliage clumps), `leaves_autumn` (2×2
  alpha), `pine` (2×2 alpha), `hay`, `cloth_red`, `cloth_stripe`, `metal`, `barrel` (1×1),
  `crate` (1×1), `fence_wood` (1×1 alpha), `rope`, `well_stone`, `lantern_glass` (emissive),
  `sign_board`, `flowerbox`
Every opaque texture with relief (stone, bricks, cobbles, roofs, bark, cliff, planks) must provide
a normal map. Textures must look good tiled over large areas (no obvious seams/repetition hot-spots).
*Correction 2026-10-07, following the code (KNOWN_ISSUES DOC-03):* "most are 16×16 px" does not
hold. The terrain tops and `plaster` are 64×64 px (4×4 units, so large fields do not repeat
visibly); most walls, roofs and cloths — `brick`, `stone_brick`, `stone_wall`, `wood_planks`,
`wood_planks_dark`, `log_wall`, `timber_frame`, the four roofs, `chimney_stone`, `well_stone`,
`hay`, `cloth_red`, `cloth_stripe`, `leaves`, `leaves_autumn`, `pine` — are 32×32 px (2×2 units);
`bark` and `door` 16×32 (1×2), `sign_board` 32×16 (2×1); only `cliff`, `grass_side`, `dirt_side`,
`window`, `barrel`, `crate`, `fence_wood`, `metal`, `rope`, `lantern_glass` and `flowerbox` are
16×16 px (1×1). Scale world-space UVs by `meta(name).units` (uv = position / units), never by an
assumed size.

```js
// CharacterSprites.js — procedural character & creature sprite sheets
/** @typedef {{ texture: THREE.Texture, canvas: HTMLCanvasElement, frameWidth: number, frameHeight: number,
 *              columns: number, rows: number, pixelsPerUnit: number,
 *              anchor: [number, number],  // normalised pivot inside a frame; [0.5, 0] = bottom centre (feet)
 *              animations: Record<string, { frames: {col:number,row:number}[], fps: number, loop: boolean }> }} SpriteSheet */
export function createCharacterSheet(spec)  // → SpriteSheet
export function createCreatureSheet(kind, spec = {}) // kind: 'cat' | 'dog' | 'chicken' | 'bird'  → SpriteSheet
export const CHARACTER_PRESETS // { traveler, swordsman, merchant, cleric, scholar, dancer, hunter,
                               //   villager, farmer, elder, child, guard, innkeeper, bard }  (spec objects)
```
Character sheets: frames 32×32 px (feet at the bottom row of the frame, character ~26–30 px tall),
rows = `DIRECTIONS` order (down, left, right, up), columns = `[idle0, idle1, walk0, walk1, walk2, walk3]`
(optionally more, e.g. `talk`/`wave`). Animations present for every direction `d`:
`idle_${d}` (2 frames, ~2.5 fps, subtle breathing), `walk_${d}` (4 frames, ~8 fps), and
`run_${d}` (same frames, ~13 fps). Spec fields (all optional, defaults from a preset):
`{ preset, seed, skin, hair, hairStyle ('short'|'long'|'ponytail'|'bald'|'spiky'|'bun'),
outfit: { top, bottom, accent }, cape, hat ('none'|'hood'|'wide'|'cap'|'helmet'|'circlet'), weapon ('none'|'sword'|'staff'|'bow'|'lute'), beard }`
— colors are palette ramp names (keys of `PALETTE`) or hex. Style: like the sprites of
Square Enix's HD-2D games — slightly chibi proportions (big head ≈ 1/3 height), dark outline (`PALETTE.outline`, not pure black),
2–3 shades per material, readable silhouettes, subtle cloth/hair secondary motion in walk frames.
Creature sheets use the same row/animation naming (frames may be smaller, e.g. 16×16 or 24×16).
Textures: NEAREST, no mipmaps, SRGB, ClampToEdge.
*Note 2026-10-07, following the code (KNOWN_ISSUES DOC-12):* no sheet has the optional `talk` /
`wave` columns: a character sheet has exactly the six columns above (`POSES` in
`CharacterSprites.js`), and the only extra columns are the combat poses of
`createCharacterSheet(spec, { combat: true })` (columns 6–17, below).

```js
// PropSprites.js — small billboard sprites & animated FX sprites
export function createPropSprite(kind, { seed } = {})
// → { texture, canvas, width, height /* px */, pixelsPerUnit: 16, anchor: [0.5, 0],
//     frames?: number, fps?: number }  (animated kinds lay frames out horizontally)
export const PROP_SPRITE_KINDS // string[]
```
Required kinds: `grass_tuft`, `grass_tall`, `flower_red`, `flower_yellow`, `flower_white`,
`flower_blue`, `bush`, `fern`, `reeds`, `mushroom`, `rock_small`, `campfire` (animated flames,
≥ 6 frames), `torch_flame` (animated, ≥ 4 frames), `candle_flame` (animated), `speech_bubble`
(interaction icon, "…" in a bubble), `exclamation`, `sparkle` (4-point star), `leaf` (particle),
`petal` (particle), `ember` (particle), `smoke_puff` (particle, soft), `dust` (particle),
`bokeh_soft` (soft round particle texture, not pixelated — used for glows/fireflies).

**Combat additions (additive, COMBAT.md §10).** `createCharacterSheet(spec, { combat: true })`
returns a separate sheet (`character:<preset>:combat`) with the combat poses after the six plain
columns; without the option the sheet is byte-for-byte today's. `MonsterSprites.js`:
`createEnemySheet(kind)` for every `ENEMY_SHEET_KINDS` kind (monster painters or combat character
sheets, a `poses` map, `idle_` / `walk_` / `run_` animations). `FxSprites.js`: `createFxAtlas()`, a
512² atlas of combat effect frames (`FX_FRAMES`). **Glow texels** are painted with alpha exactly
204 (0.8): they pass the 0.5 alpha test and mark emissive pixels for the combat sprite variant.
Every existing sheet stays pixel-identical (`sandbox/sprite_art.hashes.json`).

### 4.4 Sprites — `src/engine/sprite/`

```js
// Sprite3D.js — an animated, lit, shadow-casting billboard
export class Sprite3D extends THREE.Group {
  /** @param {SpriteSheet} sheet
   *  @param {{ billboard?: 'cylindrical'|'spherical'|'none' (cylindrical), tilt?: number (0..1, 0),
   *            castShadow?: boolean (true), shadowMode?: 'sunFacing'|'billboard' ('sunFacing'),
   *            blobShadow?: boolean (true), lit?: boolean (true), alphaTest?: number (0.5),
   *            emissive?: THREE.ColorRepresentation, emissiveIntensity?: number,
   *            scale?: number (1), renderOrder?: number }} opts */
  constructor(sheet, opts)
  mesh            // the visible quad (child); sized frameWidth/PPU × frameHeight/PPU world units, pivot at sheet.anchor
  sheet
  animation       // current animation name
  direction       // 'down'|'left'|'right'|'up'
  play(name, { restart = false, speed = 1 } = {})   // no-op if already playing (unless restart)
  setDirection(dir)                                // switches e.g. walk_down → walk_left keeping frame phase
  setFrame(col, row)
  playing; speed; flipX
  tint            // THREE.Color multiply
  opacity         // 0..1 (uses dithered/alpha fade compatible with alphaTest)
  update(dt, camera)   // advance animation, orient billboard toward camera (uses globalUniforms.uCameraYaw
                       // for cylindrical so all sprites share one orientation), update shadow proxy
  dispose()
}
```
Requirements: The group's origin is the character's feet. Each Sprite3D clones the sheet texture
(cheap: shares the image source) to animate via `offset/repeat`. It must be lit by the sun,
hemisphere and point lights **without** harsh N·L darkening when the sun is behind the sprite
(e.g. override the normal toward a blend of "up" and "toward camera", plus wrap lighting), so it
glows warmly beside a lantern at night. `castShadow` produces a silhouette shadow: in
`'sunFacing'` mode a shadow-only proxy quad (renders nothing in the colour pass: `colorWrite:false,
depthWrite:false`, but casts via a `customDepthMaterial` with alphaTest) rotates about Y to face the
sun so the shadow is always a full silhouette. `blobShadow` adds a soft dark ellipse decal on the
ground under the feet (contact shadow). Must not z-fight with the ground.

```js
// SpriteManager.js — updates every registered sprite each frame
export class SpriteManager {
  constructor(camera)
  add(sprite) ; remove(sprite) ; get sprites()
  update(dt)            // calls sprite.update(dt, camera) for all; engine system-compatible
}

// Foliage.js — thousands of instanced billboard sprites (grass tufts, flowers, reeds …)
export class Foliage {
  /** @param {{ sprite: {texture,width,height,pixelsPerUnit,anchor}, instances: {x,y,z,scale?,tint?}[],
   *            wind?: number (1), castShadow?: boolean (false), receiveShadow?: boolean (true) }} opts */
  constructor(opts)
  object          // THREE.InstancedMesh (one draw call per Foliage)
  update(dt)      // (uniform-driven; may be a no-op)
  dispose()
}
```
Foliage billboards face `globalUniforms.uCameraYaw` in the vertex shader and sway with
`uTime`/`uWind`/`uWindStrength` (top vertices only; roots fixed). Lit like Sprite3D.

**Combat additions (additive, COMBAT.md §10.1).** `new Sprite3D(sheet, { combatFx: true })` selects
the program variant `luminati-sprite3d-lit-fx-v1` with three per-sprite uniforms: `setFlash(r, g, b,
a)` (a mix toward a colour — short silhouette flashes), `setGlow(r, g, b, a)` (additive emissive on
glow texels) and `setHighlight(r, g, b, a)` (a tint proportional to the texel's own shading — long
tints such as wind-ups). Without the option (and with `lit: false`) the three methods are no-ops and
the plain program keys are untouched.

### 4.5 FX — `src/engine/fx/`

```js
// Particles.js
export class Particles {
  constructor(scene)
  /** config: { preset, position?: Vector3, bounds?: {center: Vector3, size: Vector3}, count?, rate?,
   *            color?, size?, followCamera?: boolean, ...preset overrides } → Emitter */
  createEmitter(config)
  burst(preset, position, count = 12, overrides = {})   // one-shot (e.g. 'footstep', 'splash', 'sparkle')
  update(dt, camera)
  dispose()
}
// Emitter: { object: THREE.Object3D, enabled, intensity /*0..1 multiplier*/, position: Vector3, dispose() }
export const PARTICLE_PRESETS // Record<string, object>
```
Presets: `dust` (area, slow drifting motes that glint in sunlight, bloom slightly), `fireflies`
(area, blink, green-gold, strong glow, visible only at night via `uNight`), `embers` (point,
rising sparks from a fire), `smoke` (point, soft grey puffs rising & expanding, normal blending),
`leaves` (area, falling tumbling leaves, lit color), `petals`, `rain` (area, streaks, follows camera),
`snow` (area, follows camera), `mist` (point/area, waterfall spray), `footstep` (burst dust),
`splash` (burst), `sparkle` (burst/area glints). Prefer stateless GPU animation
(position computed in the vertex shader from seed + `uTime`) for continuous emitters; bursts may
use a small CPU pool. Additive glows must not write depth. Particles must respect fog.

```js
// GodRays.js — volumetric-looking light shafts (additive, soft, animated)
export class GodRays {
  constructor()
  object                              // THREE.Group
  addShaft({ position, direction? /* defaults to -sunDirection */, length = 14, width = 3,
             intensity = 1, color? }) // → shaft handle { mesh, intensity, dispose() }
  populate(bounds /* {minX,maxX,minZ,maxZ,y} */, count, seed = 7)  // scatter shafts over an area
  intensity                           // global multiplier; also auto-fades with uNight
  update(dt)
  dispose()
}
```

**Combat additions (additive, COMBAT.md §11).** `FxQuads` — one instanced batch of atlas quads
(billboards or flat quads, `alloc()` / `set(h, p)` / `free(h)`, one draw call, key
`luminati-fxquads-v1`). `GroundMarkers` — one instanced batch of telegraph decals (circle, ring,
sector, lane, rect; styles `enemy` / `player` / `lock` / `barrier` / `magma`) whose 24 × 24 grid is
draped over a baked height texture in the vertex shader (one draw call, key
`luminati-groundmarkers-v1`). `PARTICLE_PRESETS` gains six override-free burst presets (`hitSpark`,
`emberBurst`, `deathPoof`, `gooPoof`, `healGlow`, `magicBurst`) that add exactly one pool. No
runtime point lights.

### 4.6 Lighting — `src/engine/lighting/`

```js
// LightingSystem.js
export class LightingSystem {
  /** @param {Engine} engine
   *  @param {{ timeOfDay?: number (17.2), timeSpeed?: number (0 — hours per real second),
   *            shadowMapSize?: number (2048), shadowExtent?: number (22) }} opts */
  constructor(engine, opts)
  sun             // THREE.DirectionalLight (castShadow; shadow camera follows target, texel-snapped)
  hemi            // THREE.HemisphereLight
  sky             // Sky (added to scene)
  timeOfDay; timeSpeed; paused
  setTime(hours)
  get nightFactor()   // 0 day … 1 night (smooth through dusk/dawn)
  get sunDirection()  // Vector3 pointing toward the sun
  settings        // { sunMul: 1, ambientMul: 1, fogMul: 1, shadows: true, exposureMul: 1, pointLightMul: 1, flicker: true }
  followTarget(object3DOrVector3)
  addPointLight({ position, color = 0xffb46b, intensity = 8, distance = 8, decay = 2, flicker = 0.3,
                  nightOnly = true, dayIntensity = 0.15 /* fraction at noon */ }) // → { light, dispose() }
  registerEmissive(material, { day = 0, night = 1.6 })   // drives material.emissiveIntensity by nightFactor
  update(dt)       // advances time, interpolates keyframes, updates sun/hemi/fog/sky/exposure,
                   // global uniforms (uNight, uSunDirection, uSunColor, uFogColor), point-light flicker
  dispose()
}
```
Keyframed palette over 24h: deep blue night (moonlight directional, cool, shadows still on) → pink
dawn → bright warm day → **golden hour** (default demo time ~17.2h: long warm shadows, orange sun) →
purple dusk → night. Sets `scene.fog` (`FogExp2`) color/density, `renderer.toneMappingExposure`,
hemisphere colors. Point-light flicker is smooth noise (not random jitter). `sun.shadow` uses
normalBias/bias tuned for acne-free pixel textures; shadow radius soft.

```js
// Sky.js — gradient sky dome with sun/moon glow, stars at night, soft pixel clouds
export class Sky {
  constructor({ radius = 180 } = {})
  object          // THREE.Mesh (BackSide, depthWrite false, fog false)
  setState({ top, horizon, bottom, sunDirection, sunColor, night })  // colors THREE.Color
  update(dt)
  dispose()
}
```

### 4.7 World — `src/engine/world/`

Map format (input to TileMap):
```js
{
  name: 'Emberfall',
  legend: {            // one char → tile type
    'g': { top: 'grass', side: 'cliff', lip: 'grass_side', walkable: true },
    '.': { top: 'dirt_path', side: 'dirt_side', walkable: true },
    'c': { top: 'cobblestone', side: 'stone_wall', walkable: true },
    '~': { top: 'riverbed', side: 'cliff', water: true, walkable: false },
    '^': { top: 'cobblestone', side: 'stone_wall', stairs: 'N', walkable: true }, // stairs rising toward -Z
    ' ': { void: true },  // no geometry
  },
  tiles:   [ 'gggg..cc', ... ],   // rows (z), each char a legend key (x)
  heights: [ '11112222', ... ],   // same shape; char → level (0-9, a-z = 10-35); world h = level * LEVEL_HEIGHT
  waterLevel: 0.35,               // world Y of water surface (for water tiles)
}
```
Stairs: `stairs: 'N'|'S'|'E'|'W'` means the tile rises one level toward that direction (N = -Z,
S = +Z, E = +X, W = -X); geometry is 4 real steps; walk height interpolates smoothly.

```js
// TileMap.js
export class TileMap {
  /** @param {object} map (format above) @param {{ textures: TextureLibrary }} opts */
  constructor(map, opts)
  object                 // THREE.Group with merged terrain meshes (few draw calls: group by material)
  width; depth           // in tiles
  tileAt(i, j)           // → { char, type (legend entry), level, h, walkable } | null
  worldToTile(x, z)      // → { i, j }
  tileCenter(i, j)       // → THREE.Vector3 at top surface height
  getHeight(x, z)        // ground height at world pos (stairs interpolate; water tiles → bed height)
  isWalkable(x, z)
  addCollider(c)         // c: { type:'circle', x, z, r } | { type:'box', minX, maxX, minZ, maxZ }; returns c
  removeCollider(c)
  blockTile(i, j)
  addWalkSurface(rect)   // rect: { minX, maxX, minZ, maxZ, y } — extra walkable ground (bridge decks);
                         // overrides water/non-walkable tiles inside the rect and getHeight() returns y there
  /** Move a circle of `radius` from `from` by (dx, dz) with sliding; respects walkability, max step
   *  height, colliders and map bounds. Returns the new {x, z}. */
  move(from /* {x,z} */, dx, dz, radius = 0.3, maxStep = 0.55)
  forEachTile(fn)        // fn(i, j, tile)
  dispose()
}
```
Terrain geometry: tops textured per legend `top` with world-space UVs (1 unit = 1 repeat unless
meta says otherwise); vertical faces emitted where a neighbour is lower (or at the map edge down to
a base depth so the diorama reads as a floating chunk), textured with `lip` on the top unit
and `side` below. Bake soft vertex-color ambient occlusion (darker at inner corners and at the base
of cliffs). All terrain casts & receives shadows.

```js
// Water.js
export class Water {
  /** @param {TileMap} tileMap @param {{ level?: number }} opts */
  constructor(tileMap, opts)
  object          // THREE.Mesh surface over all water tiles (one mesh)
  update(dt)
  dispose()
}
export function createWaterfall({ x, z, width, top, bottom, facing /* 'N'|'S'|'E'|'W' */ }) // → { object, update(dt), dispose() }
```
Water: pixel-quantised animated ripples, depth-tinted (lighter near shores via a baked
shore-distance texture), foam lines along shores, sparkling specular glints from `uSunDirection`
(bright enough to bloom), reflects sky/fog color, night-darkened by `uNight`. Opaque-ish (writes
depth) so DOF works; slight transparency acceptable via alpha blending of the tint.

```js
// Props.js — procedural diorama props. Every factory returns a PropResult:
/** @typedef {{ object: THREE.Object3D,
 *              colliders: ({type:'circle',x,z,r}|{type:'box',minX,maxX,minZ,maxZ})[],  // world space
 *              lights: { position: THREE.Vector3, color?, intensity?, distance?, flicker?, nightOnly? }[],
 *              emissives: { material: THREE.Material, day?: number, night?: number }[],
 *              emitters: { preset: string, position: THREE.Vector3, [k:string]: any }[],
 *              update?: (dt:number) => void,
 *              interact?: { position: THREE.Vector3, radius: number, id: string,
 *                           lookSpan?: { a: THREE.Vector3, b: THREE.Vector3 } },
 *              walkRects?: { minX, maxX, minZ, maxZ, y }[],   // bridges: walkable deck rects
 *              sails?: THREE.Group,                          // windmills: the turning sails
 *              controls?: { opened?, open?(instant), attuned?, setAttuned?(on) }, // chests, waystones
 *              lid?: THREE.Group, crystal?: THREE.Group,     // chests / waystones: animated parts
 *              dispose: () => void }} PropResult */
//   (interact.lookSpan: optional segment the player may face instead of position — a house door's leaf)
//   (walkRects … dispose: additive, recorded 2026-09-30; the type-checked copy is the PropResult
//    typedef in src/engine/world/Props.js, docs/architecture/modules/world.md §4.1)
export class PropFactory {
  constructor({ textures /* TextureLibrary */, seed = 42 })
  // Every method: (x, y, z, opts) where (x, z) is the world position (usually a tile centre or
  // corner) and y is the ground height there. `opts.rotation` (radians about Y) where it makes sense.
  house(x, y, z, { width = 4, depth = 3, stories = 1, roof = 'roof_red', wall = 'timber_frame',
                   rotation = 0, chimney = true, door = 'front' } = {})   // lit windows at night, chimney smoke emitter
  tree(x, y, z, { kind = 'oak' | 'autumn' | 'pine' | 'birch', height = 4.5, seed } = {}) // canopy sways with wind
  lamppost(x, y, z, opts)   // iron post + glowing lantern + point light
  wallTorch(x, y, z, opts)  // flame sprite + light
  campfire(x, y, z, opts)   // logs + animated fire + embers + smoke + light
  fence(x0, z0, x1, z1, y, opts) // straight run of fence posts & rails between two points
  well(x, y, z, opts)
  marketStall(x, y, z, { cloth = 'cloth_stripe', rotation } = {})
  barrel(x, y, z, opts); crate(x, y, z, opts); crateStack(x, y, z, opts)
  bridge(x0, z0, x1, z1, y, { width = 2 } = {})  // wooden plank bridge (walkable surface returned via `walkRects`)
  signpost(x, y, z, opts)
  rock(x, y, z, { size = 1 } = {})
  bench(x, y, z, opts)
  windmill(x, y, z, opts)   // rotating sails (update)
  haystack(x, y, z, opts)
  flowerbox(x, y, z, opts)
  // interior furniture (additive, 2026-10-07; props/Furniture.js, the catalog's `interior: true` types):
  // (x, y, z) = the footprint's centre on the floor (wallWindow: the wall face), front = local +Z
  bed(x, y, z, opts); table(x, y, z, opts); chair(x, y, z, opts); shelf(x, y, z, opts)
  hearth(x, y, z, opts)     // stone fireplace: flame + glowing embers + one light (day and night)
  counter(x, y, z, opts); rug(x, y, z, opts); staircase(x, y, z, opts); wardrobe(x, y, z, opts)
  wallWindow(x, y, z, opts) // window seen from inside: emissive panes, curtains, a light shaft by day
  sacks(x, y, z, opts)
  dispose()
}
```
Style: chunky, slightly irregular low-poly shapes wearing pixel textures (never flat colors),
world-space-consistent texel density (16 px/unit), dark trim and beams, windows with warm emissive
glow (registered via `emissives`), roofs with overhang and ridge, everything `castShadow`/`receiveShadow`.
Tree canopies: clusters of alpha-tested foliage cards/clumps (`leaves`/`pine` textures) that read as
lush pixel-art trees from the diorama camera and sway gently (vertex shader with `uTime`, `uWind`).
The integrator wires `lights` → `LightingSystem.addPointLight`, `emissives` → `registerEmissive`,
`emitters` → `Particles.createEmitter`, `colliders` → `TileMap.addCollider`.
`bridge()` additionally returns `walkRects: [{minX,maxX,minZ,maxZ,y}]` so the map can treat the
deck as walkable ground at height `y` (TileMap should support `addWalkSurface(rect)` for this).

### 4.8 UI — `src/engine/ui/` (DOM overlay, imports `ui.css` + @fontsource fonts)

```js
// UI.js
export class UI {
  constructor(container = document.body)
  root            // #luminati-ui overlay div (pointer-events none except interactive children)
  dialog          // DialogBox
  banner          // Banner
  title           // TitleScreen
  hud             // HUD
  prompt          // InteractPrompt
  fader           // Fader
  debug           // DebugPanel
  setVisible(bool)   // photo mode
  update(dt, { camera, input })   // forwards to children
  dispose()
}

// DialogBox.js
export class DialogBox {
  /** lines: string | (string | { speaker?, text, choices? })[] → Promise (resolves to last choice index or undefined) */
  open({ speaker, lines, portraitColor? })
  get isOpen()
  update(dt, input)     // consumes input.actionPressed('confirm') (skip typewriter → next line → close),
                        // arrow keys for choices; typewriter ~45 chars/s; blinking ▼ indicator
  onChar              // optional callback(char) — hook for dialog blip sfx
  close()
}

// Banner.js — area title in the manner of Square Enix's HD-2D games: ornamental lines, serif title, subtitle, fade in/out
export class Banner { show(title, subtitle = '', { duration = 3.5 } = {}) /* → Promise */ }

// TitleScreen.js — elegant title over the live 3D scene; resolves when the player presses a key/click
export class TitleScreen { show({ title, subtitle, prompt = 'Press any key' }) /* → Promise */ ; hide() ; get visible() }

// HUD.js — clock (time-of-day with sun/moon icon), controls help (toggle), toast messages
export class HUD {
  setTime(hours); setLocation(name); showHelp(bool); toggleHelp(); toast(text, seconds = 2.5)
  setControls([{ keys: 'WASD', label: 'Move' }, ...])
  visible
}

// InteractPrompt.js — floating icon/label above a world position (projected each frame)
export class InteractPrompt { show(worldPos /* Vector3 */, label = 'Talk'); hide(); update(camera) }

// Fader.js — full-screen fades
export class Fader { fadeOut(seconds = 0.6, color = '#000') /* → Promise */; fadeIn(seconds = 0.6) /* → Promise */ }

// DebugPanel.js — themed lil-gui wrapper (hidden by default, toggled with the `debug` action)
export class DebugPanel {
  gui                // lil-gui GUI instance
  addFolder(name)    // → lil-gui folder
  toggle(); visible
  stats              // small overlay: fps, frame ms, draw calls, triangles; stats.update(renderer, dt)
}
```
*Note 2026-10-07, following the code (KNOWN_ISSUES DOC-12):* the `stats` overlay (`DebugStats`)
shows more than the four metrics above: fps and the mean frame time, an fps history graph, draw
calls, triangles, geometries, textures, shader programs and the worst frame of each sampling
interval. It switches the renderer's `info.autoReset` off and resets the counters itself after
each frame, so multi-pass frames count in full (which is why `renderer.info.render` reads 0 in
the game; `__game.state().drawCalls` comes from `PostFX.sceneInfo`).

Visual style: dialog = bottom-centre, ~70% width, dark navy→black translucent gradient, thin gold
(#c9a45c-ish) double border with small diamond corner ornaments, speaker name plate on the top-left
edge, serif font (`Crimson Pro` body, `Cinzel` titles), soft drop shadow, fade/slide in. Pixel font
(`Pixelify Sans`) only for small HUD numerics if desired. Scales with viewport (`clamp()` sizes).

**Combat additions (additive, COMBAT.md §13).** `ui.enableCombat()` (idempotent; combat levels only)
creates `ui.combat = { hud: CombatHUD, boss: BossBar, labels: WorldLabels, announcer: Announcer,
death: DeathScreen }` — pooled DOM, world-anchored labels updated from `UI.update`; `ui.combat` is
`null` otherwise. `Minimap` / `WorldMap` draw optional red enemy dots and the waystone, chest and
boss markers; `TitleScreen.show({ destinations, current })` adds the level-destination row; `HUD`
labels the mouse codes (`LMB` / `MMB` / `RMB`). Since 2026-09-28 the combat classes reach
`enableCombat()` through the static registry `UI.useCombatUI({ CombatHUD, BossBar, WorldLabels,
Announcer, DeathScreen })` (or as `enableCombat(classes)`), so `UI.js` imports none of them;
`WorldLabels.setPanels(list)` keeps the labels out of the HUD panels and `DeathScreen.prime()`
pre-renders the death screen (COMBAT.md §27.14).

### 4.9 Combat additions (2026-09-28, additive)

The ARPG combat of levels with enemies added opt-in engine pieces; every default reproduces the
behaviour above, and peaceful levels never construct them. The binding text is
[`docs/contracts/COMBAT.md`](docs/contracts/COMBAT.md): `Input.addBindings` /
`enableMouseButtons` / `lastDevice` and `CameraRig.stickZoom` (§5.3), `createCharacterSheet(spec,
{ combat: true })`, `createEnemySheet`, `createFxAtlas` and the `Sprite3D` option `combatFx` with
`setFlash` / `setGlow` / `setHighlight` (§10, §27.10), `FxQuads`, `GroundMarkers` and six burst presets (§11),
`COMBAT_SFX_NAMES`, music tracks and stingers (§12), `UI.enableCombat()` with `CombatHUD`,
`BossBar`, `WorldLabels`, `Announcer`, `DeathScreen`, minimap enemy dots and title destinations
(§13), and the `enemy` / `chest` / `waystone` catalog types (§14). Revision 5 (§27.13–§27.20)
added, still additively: `Sprite3D.bodyOpacity`, `Engine#manualStep` / `step(dt, { render })` /
`redraw()` (a manual-stepping mode for bots), `UI.useCombatUI`, `WorldLabels.setPanels`,
`DeathScreen.prime`, three more burst presets, the `duck` option of `playStinger`, the on-demand
`crag` texture outside `TEXTURE_NAMES`, and the sliced height bake of `GroundMarkers`. The combat
engine modules are marked side-effect free in `vite.config.js`, so the barrel's exports put them
into no chunk that does not use them.

---

## 5. Integration (the game) — `src/game/`, `src/main.js`, `game.html`

The demo, "Emberfall", is a small riverside village at golden hour: multi-level terrain with
cliffs and stairs, a river with a bridge and a waterfall, houses, trees, market, well, lampposts,
campfire, windmill, flowers & grass, NPCs with dialog, a cat and chickens. The player (a traveler)
walks with WASD, talks with Space, rotates the camera with Q/E, zooms with the wheel, cycles time
of day with T, toggles weather with R, photo mode with P, debug panel with ` (backquote).
`window.__game` exposes `{ engine, setTime(h), teleport(x, z), player, postfx, lighting, ui }` for
automated checks. `?autostart=1` skips the title screen.
*Note 2026-10-07, following the code (KNOWN_ISSUES DOC-12):* those members are a subset —
`Game._exposeGlobal` exposes many more (the rig, audio, tile map, world, weather, the `Game`
itself, `talkTo`, `setWeather`, `photo`, `map`, `state()` …, and `combat` / `campaign` / `story`
where they exist); the full surface is [docs/specs/AUTOMATION_API.md](docs/specs/AUTOMATION_API.md)
and its typed copy `GameHooks` in `src/game/Game.js`.

**Combat (additive, [GLAIVE.md](docs/specs/GLAIVE.md), [COMBAT.md](docs/contracts/COMBAT.md)).** A
level with `enemy` objects (the shipped one: Cinderwatch Pass, `?level=cinderwatch-pass`) plays with
turn-based combat on the GLAIVE rules:
`Game` imports and creates a `GlaiveCombat` (`src/game/glaive/`) only when `levelHasCombat(level)`,
and on every other level `game.combat` is `null` and nothing combat-related exists. The frame order
gains `combat.update` → `player.update` → `combat.afterPlayer` … `weather.update` →
`combat.applyLook`; `window.__game.combat` holds the test hooks.

**Campaigns (additive, [docs/specs/CAMPAIGN_FORMAT.md](docs/specs/CAMPAIGN_FORMAT.md)).** A
campaign (`?campaign=<name>`, `public/campaigns/<name>/`) plays several levels in one page: `exit`
and `entrance` objects join them, story flags gate exits and objects, chapters swap in variant
files. `Game` keeps the engine, renderer, post, UI, audio, weather and one `fixed` light pool of
12 for the whole page and rebuilds the level half (`_buildLevel`) on every travel
(`swapLevel`, behind the fader, warmed up before play goes on); a single level builds exactly as
before (`src/game/campaign/`).

---

## 6. Testing each module in isolation

Each module has a `sandbox/<module>.html` (+ `.js`) that exercises it with three.js and the
shared foundation. Keep these checks small enough to isolate a failure; stub unrelated systems
when needed. Verify with:

```bash
npm run check -- --page=sandbox/<module>.html --out=<module> --wait=3000
```
Then inspect `.check/<module>/*.png` and fix every console error and page error.
A module is not done until its sandbox renders correctly with zero errors.
