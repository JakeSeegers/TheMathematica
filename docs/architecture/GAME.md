# Game architecture — `src/main.js` + `src/game/`

> **Purpose.** How the playable game is put together: how a level file becomes a running 2.5D
> diorama, what runs every frame and in which order, how the player, villagers, critters,
> conversations, weather, ambience and the performance governor work, and which tunables live
> where. Read this before changing anything in `src/game/` or `src/main.js`.
>
> **Audience.** Developers and AI agents working on gameplay, level loading, the demo's look or
> its performance.
>
> **Source of truth.** [`src/main.js`](../../src/main.js),
> [`src/game/Game.js`](../../src/game/Game.js), [`src/game/World.js`](../../src/game/World.js),
> [`Player.js`](../../src/game/Player.js), [`Npc.js`](../../src/game/Npc.js),
> [`Critters.js`](../../src/game/Critters.js), [`dialogue.js`](../../src/game/dialogue.js),
> [`Weather.js`](../../src/game/Weather.js), [`WeatherLook.js`](../../src/game/WeatherLook.js),
> [`LevelLook.js`](../../src/game/LevelLook.js),
> [`AudioDirector.js`](../../src/game/AudioDirector.js),
> [`ResolutionGovernor.js`](../../src/game/ResolutionGovernor.js),
> [`Scenery.js`](../../src/game/Scenery.js), [`GroundDetail.js`](../../src/game/GroundDetail.js),
> [`SnowCover.js`](../../src/game/SnowCover.js), [`AtmosphereFog.js`](../../src/game/AtmosphereFog.js),
> [`DebugControls.js`](../../src/game/DebugControls.js), [`config.js`](../../src/game/config.js),
> [`levels.js`](../../src/game/levels.js), the combat modules in
> [`src/game/combat/`](../../src/game/combat/) ([§15](#15-combat-combat-levels-only)) and the
> campaign modules in [`src/game/campaign/`](../../src/game/campaign/) ([§3.9](#39-campaigns-the-level-half-and-swaplevel)),
> the story runtime in [`src/game/story/`](../../src/game/story/StoryRunner.js) ([§3.10](#310-the-story-runtime)),
> the party in [`src/game/party/`](../../src/game/party/Party.js) ([§3.11](#311-the-party)).
> Where this page and the code disagree, the code wins.
>
> **Related.** [OVERVIEW.md](OVERVIEW.md) (the whole system) ·
> [RENDER_PIPELINE.md](RENDER_PIPELINE.md) · [PERFORMANCE.md](PERFORMANCE.md) ·
> [EDITOR.md](EDITOR.md) · engine modules: [level](modules/level.md), [world](modules/world.md),
> [lighting](modules/lighting.md), [ui](modules/ui.md), [core](modules/core.md) ·
> [specs/LEVEL_FORMAT.md](../specs/LEVEL_FORMAT.md) (every level field) ·
> [specs/AUTOMATION_API.md](../specs/AUTOMATION_API.md) (`window.__game`, `window.__luminati`) ·
> [specs/INPUT_AND_CONTROLS.md](../specs/INPUT_AND_CONTROLS.md) ·
> [user/PLAYING_THE_GAME.md](../user/PLAYING_THE_GAME.md) · binding contract:
> [contracts/LEVEL_EDITOR.md §5](../contracts/LEVEL_EDITOR.md) and [ARCHITECTURE.md](../../ARCHITECTURE.md).

![Emberfall: a conversation with the elder at golden hour](../assets/screenshots/emberfall-dialogue.jpg)

---

## 1. The big picture

The game is a thin layer over the engine (`src/engine/`, public API in
[`src/engine/index.js`](../../src/engine/index.js)). It plays **any** `luminati-level` JSON file.
The only Emberfall-specific pieces are the default level name (`DEFAULT_LEVEL = 'emberfall'` in
`main.js`), the eight hand-written conversations in `dialogue.js`, and a few tunables that were
tuned on Emberfall but apply to every level (`config.js`, `AUTO_BOUNDS_MARGINS` in `Game.js`, the
automatic tree-kind mix in `Scenery.js`).

```mermaid
flowchart LR
  subgraph Page["game.html"]
    L["loading screen (div id loading)"]
    APP["canvas container (div id app)"]
  end
  MAIN["src/main.js<br/>boot()"] -->|"resolveLevelFromURL / loadProjectLevel"| LS["engine/level/LevelStorage"]
  MAIN -->|"new Game(level)"| GAME["game/Game"]
  GAME --> ENG["Engine loop<br/>(systems)"]
  GAME --> WORLD["game/World<br/>terrain + props + scenery"]
  GAME --> ACT["Player · Npc · Critters"]
  GAME --> WX["Weather · AudioDirector<br/>ResolutionGovernor"]
  GAME --> UI["engine UI<br/>(dialog, HUD, maps, title)"]
  WORLD -->|"buildLevelTerrain<br/>LevelObjectBuilder"| OB["engine/level/ObjectBuilder"]
  WORLD --> SC["game/Scenery<br/>game/GroundDetail"]
  GAME -->|"conversationFor(obj) per NPC"| DLG["game/dialogue"]
```

| Layer | Owns | Does not own |
| --- | --- | --- |
| `src/main.js` | URL → level resolution, the loading screen (progress bar, error screen with links), `window.__luminati` | anything that renders |
| `Game` | wiring of every engine module, modes (loading / title / play), input shortcuts, interaction and dialogue flow, camera framing, maps, `window.__game` | how the world is built |
| `World` | building the level into the scene and wiring every `BuiltObject` (lights, emissives, emitters, colliders, walk surfaces, updaters), scenery, foliage, snow cover, big-level batching | actors, input, UI |
| `Player`, `Npc`, `Critters` | movement, behaviour and animation of sprites | camera, dialogue text |
| `dialogue.js` | conversation scripts and the built-in NPC actions | where NPCs stand (level data) |
| `Weather` | time-of-day glides, weather blending (light, fog, wind, grade, particles, lamps, water, snow) | the 24 h palette itself (`LightingSystem`) |
| `AudioDirector` | the ambience mix (wind, birds, crickets, fire, water) | synthesis (`AudioSystem`) |
| `ResolutionGovernor` | pixel budget and dynamic render scale | post-processing itself |
| `combat/CombatSystem` (combat levels only) | the combat clock, the player kit, enemies, hits, loot, checkpoints, chests, the boss arena, combat feedback, battle music, the combat HUD values, `window.__game.combat` ([§15](#15-combat-combat-levels-only)) | peaceful levels (never created there) |

---

## 2. Entry point: `src/main.js`

`boot()` runs once per page load:

0. **Language, strings and fonts first** ([I18N.md](../specs/I18N.md)): `setLang(resolveLang())`
   (`?lang=`, the saved choice, else English; `<html lang>` follows), `registerCoreStrings()` (the
   loading screen's steps and error page are `t('game.load.*')` / `t('game.error.*')`), and
   `startFonts({ lang, px })` — the UI fonts start loading (Google first, else `dist/`) in parallel
   with the level; `window.__luminati.fonts` is their report.
1. `exposeHook()` installs `window.__luminati` = `{ storage: { saveLocalLevel, loadLocalLevel,
   listLocalLevels, loadProjectLevel, PLAYTEST_SLOT }, playLocal(level, slot = 'test', query =
   'autostart=1') }` — a test hook that stores a (possibly partial) level in browser storage and
   reloads the tab on `?level=local:<slot>`.
2. `progress(0.03, t('game.load.map'))`; the **content tables** start loading
   (`loadContentTables(lang, …)`, English fetches nothing) — a campaign's and the default level's
   at once, a requested level's once its source is known, plus `&i18n=<table>`; then `loadLevel()`:
   `resolveLevelFromURL(location.search)` (see the table), else `loadProjectLevel('emberfall')`.
3. Load failures become a user-facing error `Could not load <what>: <why>` (`err.levelLoad =
   true`; the loading screen shows it in the page's language, `t('game.error.*')`, the console
   in English). A missing project level is normally caught by `loadProjectLevel` itself, which treats
   a non-OK response or an HTML answer (the dev server answers unknown paths with `index.html`) as
   `Level "<name>" not found`. A missing browser slot gives `No level "<slot>" in this browser's
   storage`. `main.js` rewrites two cases: that `not found` of a project level (no HTTP status, or
   404; not for a campaign or a `local:` slot) becomes "`levels/<slug>.json` does not exist", and a
   `SyntaxError` (a file or slot that came back but does not parse) becomes "the level is not
   valid JSON (…)". Any failure of `boot()` (a load
   error or an exception while building the game) then switches the loading screen to `.is-error`,
   shows the message and offers links: **Play Emberfall** (`game.html`; only when another level
   was requested), **Play Cinderwatch Pass** (`game.html?level=cinderwatch-pass`; unless that is
   the level that failed) and **Open the level editor** (`editor.html`). Load errors are logged with `console.warn`, other failures with
   `console.error`.
4. A blank level name becomes `Untitled`; normalisation warnings and `validateLevel` problems go
   to the console as `[Luminati] <source>: …` (they never stop the game).
5. The content tables are awaited (before anything shows the level's text: prose by its key,
   `loc(key, english)`, names as terms, `term(name)`; [I18N.md §4](../specs/I18N.md)), then
   `window.__luminati.content` (`lang, tables, strings, units, terms, warnings`, and live getters
   `misses`, `missCount`, `missDropped`, `clearMisses()`: what was shown untranslated); the loading
   screen's name and the tab title are translated (`term(name)`, `t('game.page.title', { name })`);
   `new Game({ container: #app, level, source, autostart, campaign, lang, fonts })` (a play-test's
   `&i18n=<table>` only adds that table to the chain: the keys are in the level's data),
   `await game.init(progress)`, `game.start()`, `await game.warmedUp`
   (five real frames drawn behind the loader), then `window.__luminati.loadMs` (navigation start →
   first gameplay frame) is set and the loader fades out (`is-done`, removed after 900 ms).
   `window.__luminati` also carries `level`, `source` and `warnings` once the level is loaded.
6. Japanese and Chinese: once play starts, `prefetchGlyphs` loads the glyphs of every translated
   text the page can show (the content tables and the core UI tables) in idle time, so a dialogue
   opened later lays out at once. Not awaited.

The game's page is `game.html`; the front page, `index.html`, is the launcher (a list of every
campaign and level with links here; it ignores any query,
[Launcher architecture](OVERVIEW.md)).

| `game.html` query | Level loaded | `source` string |
| --- | --- | --- |
| *(none)* | `public/levels/emberfall.json` | `levels/emberfall.json` |
| `?level=<name>` | `public/levels/<slugify(name)>.json` (dev and production builds) | `levels/<slug>.json` |
| `?level=local:<slot>` | browser storage slot (`localStorage` key `luminati.level.<slot>`); the editor's play-test uses `local:__playtest__` | `local:<slot>` |
| `?autostart=1` (any value but `0`) | skips the title screen (play-tests, the check harness) | — |
| `?debug` or `?autostart` | the `Engine` also exposes `window.__engine` | — |

The canonical description of storage and slugs is
[specs/LEVEL_STORAGE_API.md](../specs/LEVEL_STORAGE_API.md).

---

## 3. `Game` — lifecycle and modes

`Game` ([`src/game/Game.js`](../../src/game/Game.js)) is constructed with a **normalised** level
(`LevelFormat.normalizeLevel` / the `LevelStorage` loaders) and, for a campaign, its
`CampaignRuntime`. The constructor only derives configuration (`_applyLevel`); `init()` builds
everything — the persistent half itself, the level half through `_buildLevel` — and `start()`
begins the loop. A campaign later replaces the level half with `swapLevel` ([§3.9](#39-campaigns-the-level-half-and-swaplevel)).

### 3.1 Construction (no GPU work)

- **Camera framing** `this.camera` = `CAMERA` from `config.js` merged with
  `environment.camera`: `distance` (default 30, clamped 8–80), `pitch` (default 32°, clamped
  10–80), `minDistance = min(18, distance)`, `maxDistance = max(42, distance)`, fov 28.
- **Fog start** `setFogStart(distance − 7)` writes the shared uniform `uFogStart`
  ([§11.4](#114-atmospherefogjs--fog-that-starts-in-front-of-the-player)) — a campaign's
  `swapLevel` runs `_applyLevel` again, so every level gets its own.
- **Focus bounds** `_resolveCameraBounds(environment.camera.bounds)`: three rects `near / mid /
  far` (one rect or `{ near, mid, far }` in the file; swapped min/max are accepted). Without
  bounds they are computed from the walkable area (`computeCameraBounds(level, 0)`) shrunk by
  `AUTO_BOUNDS_MARGINS` — Emberfall's hand-tuned margins (near `x 1.8, north 0.5, south 0.8`,
  mid `3.5 / 0.5 / 2`, far `4.5 / 1 / 3`).
- **High ground** `environment.highGround = { minY, pitch }`: above `minY` the gameplay pitch
  becomes `pitch` (Windmill Hill tilts down a little).
- **Title camera** `environment.titleCamera` (`x, z, y, driftX, driftZ, distance`). The fallbacks
  are:
  - position: the middle of the mid bounds, at the most common walkable height (`_typicalGround()`)
    plus 0.5;
  - drift: `min(7, ¼ of the mid-bounds width)` and `min(5, ¼ of its depth)`;
  - distance: `clamp(max(level.width, level.depth) × 0.8, 22, 35)` (the level size in tiles); any
    distance, given or computed, is finally clamped to 8–80.
- `regions` = every `region` object (HUD plate, arrival banners, world-map names).
- State: `mode` (`'loading' | 'title' | 'play' | 'travel'` — `travel` while a campaign switches levels), `photoMode`, `mapOpen`, `busy` (a conversation
  or fade is running — the player is frozen), `inventory` (`{ apples: 0 }` plus shop items; a
  null-prototype object, since item names are level data), `visits` (per-NPC talk counter),
  `warmedUp` (a promise).
- **Combat** `combatEnabled = levelHasCombat(level)` (`environment.combat === true`, or not
  `false` and the level has an `enemy` object); `combat = null` until `init` creates the
  `CombatSystem` ([§15](#15-combat-combat-levels-only)). Peaceful levels never create it.

### 3.2 `init(onProgress)` — build order

```mermaid
sequenceDiagram
  autonumber
  participant HTML as game.html loader
  participant Main as main.js boot()
  participant Store as LevelStorage
  participant Game
  participant World
  participant GL as renderer.compileAsync
  HTML->>Main: module script runs
  Main->>Main: exposeHook() sets window.__luminati
  Main->>Store: resolveLevelFromURL() or loadProjectLevel('emberfall')
  Store-->>Main: level, warnings, source
  Main->>Game: new Game({ container, level, source, autostart })
  Main->>Game: await init(progress)
  Game->>Game: installFogStart(), Engine, TextureLibrary, LightingSystem
  Game->>Game: Particles, GodRays, SpriteManager, CameraRig, PostFX, ResolutionGovernor, UI, AudioSystem
  Game->>World: await build() with progress scaled by 0.9
  World-->>Game: tileMap, lights, interactables, fires, falls, batching
  Game->>GL: earlyCompile = compile scene for postfx.sceneTarget
  Game->>Game: 0.92 Player, Npcs (conversationFor), Critters, BlobBatch, sprite fill
  Game->>Game: Weather, AudioDirector, HUD and dialog setup, debug panel, maps
  Game->>Game: addSystem lighting (-10), game (0), audio (20), render fn
  Game->>GL: 0.96 rain and snow on, one-particle bursts far below, await both compiles
  Game->>Game: postfx.warmup(), shadow primer (one proxy per depth variant), precipitation off, start weather, window.__game
  Main->>Game: start() draws 5 warm frames, title or gameplay
  Main->>Game: await warmedUp
  Main->>HTML: fade the loader out
```

Step by step (progress fractions are those shown on the loading bar):

| Progress | Label | Work |
| --- | --- | --- |
| — | — | `installFogStart()` patches three's fog chunks to read the fog start from the uniform `uFogStart` **before any material compiles** (the constructor's `_applyLevel` already set it to `camera.distance − 7`; see [§11.4](#114-atmospherefogjs--fog-that-starts-in-front-of-the-player)). |
| — | — | `Engine({ container, maxPixelRatio: 1.25 })`; `TextureLibrary({ seed: 1337, anisotropy: 4 })`; `LightingSystem(engine, { timeOfDay: environment.timeOfDay ?? 17.2 (wrapped into 0–24), shadowExtent: 26, sunPath: SUN_PATH, moonPath: MOON_PATH, keyframes: DEFAULT_KEYFRAMES + KEYFRAME_OVERRIDES })`, `sky.lowerClouds = 0.25`, `timeSpeed = environment.clock === false ? 0 : TIME_SPEED`, clock **paused** until gameplay. |
| — | — | `Particles(scene)`, `GodRays({ gain: 0.2 })`, `SpriteManager(camera)`, `CameraRig(camera, { ...camera, yaw: 0, lookAhead: 1.3 })` with `bounds = mid`. |
| — | — | `PostFX(renderer, scene, camera, { maxTaps: 64, samples })` — 2× MSAA when the drawing buffer exceeds 1.8 MP, else 4× — then `_tunePost()` (the demo's DOF / bloom / grade values), a resize listener, `ResolutionGovernor`. |
| — | — | `UI(document.body, { lang, fonts })`, `AudioSystem({ volume: 0.6 })`; the wait for `ui.fontsReady` starts here (awaited after the villagers, below). |
| ≈ 0.07–0.79 | World labels (`t('game.load.textures' … 'merge')`; World fraction × 0.9) | `World.build()` ([§4](#4-world--building-a-level-into-the-scene)). Big levels then call `lighting.setShadowDepthRange(60, 45)`. |
| — | — | `earlyCompile = _compileScene()` — the world's programs start compiling in parallel (`KHR_parallel_shader_compile`) while actors are created. |
| 0.92 | `t('game.load.villagers')` (Waking the villagers) | `Player` (combat levels: the sword and the combat sheet, [§5](#5-player)) (added to the scene and the `SpriteManager`, `lighting.followTarget(player.sprite)`), `_ensureStandingSpawn()`, one `Npc` per `npc` object (sheets cached per preset; a failing NPC is skipped with a warning), `Critters`, the chicken "threats" list, the far-actor throttle (big levels). |
| — | — | **The fonts** (`_fontsIn`): `await ui.fontsReady` (`loadStats.fontsWait`: what the build still waited) and, in Japanese and Chinese, the glyphs of what the level shows first (`fonts.ensure`, started with the world build by `_glyphsFor`, which looks `_shownTexts()` up inside `quietly()`: nothing is shown yet, so an untranslated text records no miss; `loadStats.glyphsWait`) — before the HUD's first layout. |
| 0.94 | `t('game.load.blades')` (Sharpening blades) | Combat levels only: `await import('./combat/CombatSystem.js')` (dynamic: peaceful levels never download or parse the combat code — Vite puts it in its own chunk; only the import-free `combat/bindings.js` is static), `new CombatSystem({ game })`, `await combat.load()` — enemy sheets, the FX atlas, `FxQuads`, `GroundMarkers` (its height texture bakes in ≤ 6 ms slices), every enemy (and the boss's adds, hidden), the enemies' walk grid (`Nav`, ≈ 20 ms on Cinderwatch) and zones, `UI.useCombatUI(…)` + `ui.enableCombat()`, the combat bindings, `rig.stickZoom` ([§15](#15-combat-combat-levels-only)). |
| — | — | `BlobBatch` (big levels and combat levels), `registerEmissive(sprite.material, SPRITE_FILL)` on every character, critter and enemy sprite, `makeShadowOnly(shadowProxy)` on big levels and combat levels, `Weather`, `AudioDirector`. |
| — | — | HUD (`setControls` with translated rows `{ keys, label, id }`; combat levels then `combat.setupUI()`: the combat legend, vitals and skill slots), `setLocation(..._levelPlate())` (`term(level.name)`, `loc(textKeyOf(level, 'subtitle'), subtitle)`), prompt key hint `Space`, dialog speed 55 chars/s with a `blip` on every second non-space character, `buildDebugControls(this)`, `_setupMaps()` (combat levels end it with `combat.attachMaps(map)`: enemy dots, chest markers only once discovered, the boss marker). |
| — | — | Frame wiring ([§3.4](#34-the-frame)). |
| 0.96 | `t('game.load.warmup')` (Warming up the lanterns) | Rig snapped to the player; rain and snow intensity forced to 1; one `particles.update`; one-particle `splash` / `sparkle` (only when a waterfall splashes) and `footstep` bursts at y = −1000 (their pools are created on first use); combat levels: `combat.warmup(far)` (combat textures, one FX quad and one marker far below, one particle of every combat burst); `await earlyCompile`; `await _compileScene()`; `postfx.warmup()`; `_primeShadows()` — one shadow-only proxy per depth-program variant of the level's casters (`ShadowCasters.primeShadowPrograms`, KNOWN_ISSUES REN-13: `compileAsync` builds no shadow-pass programs, and three.js builds a caster kind's depth program when one first enters the sun's shadow frustum), far below the world and drawn only by the shadow pass of the warm-up frames, disposed when `warmedUp` resolves; precipitation back to 0; the level's starting weather applied instantly; `_exposeGlobal()`. |
| 1 | `t('game.load.ready')` | `loadStats = { engine, world, characters, compile, map }` (milliseconds), plus `shadowVariants` (the primer's proxy count), `fontsWait` and `glyphsWait`. |

> **Why compile against `postfx.sceneTarget`?** three.js keys programs by the render target they
> draw into. The scene renders into PostFX's linear HDR target; compiling for the canvas would
> build unused sRGB variants and leave the real ones to stall the first frame (or the first rain).
> See [RENDER_PIPELINE.md](RENDER_PIPELINE.md) and the invariant in [AGENTS.md](../../AGENTS.md).

### 3.3 Modes: title and gameplay

```mermaid
stateDiagram-v2
  [*] --> loading
  loading --> title: start() without autostart
  loading --> play: start() with ?autostart (enterGameplay instant)
  title --> play: title dismissed (any key, click or gamepad button)
  play --> play: photo mode, world map, conversations (sub-states)
```

- `start()` sets `_warmFrames = 5` and starts the engine loop. During those frames `update()`
  keeps rain and snow at full intensity, because ANGLE finishes some programs only at their first
  real draw and the shadow-depth variants are built by the shadow pass (the shadow primer's proxies give it
  every caster kind of the level, wherever it stands); the fifth frame calls
  `combat.endWarmup()` (frees the warm instances, records `programsAtLoad`) and resolves
  `warmedUp`.
- **Title** (`showTitle`): `mode = 'title'`, the player's x-ray silhouette off, clock paused, the
  rig follows a drifting cinematic target (`_updateCinematic`: slow sine drift, yaw ±18°,
  distance ±3). `ui.title.show({ title, subtitle, prompt, credit, titleSource, languages, lang,
  onLanguage })` uses `environment.title` by the keys the level holds (`_titleTexts`:
  `loc(textKeyOf(level, 'title.<k>'), text)`; defaults: the level name as a term in capitals, `level.subtitle` by its key,
  else the UI strings `game.default.subtitle` "A Luminati 2.5D Level", `game.default.prompt` "Press any
  key" and `game.default.credit` "Luminati 2.5D Pixel-Art Engine · three.js"; a blank title or prompt takes its
  default, a subtitle or credit set to `''` stays blank; `titleSource` the English name for the
  wordmark under a translated logo), and the language row (`TITLE_LANGUAGES`; `onLanguage` = `setLanguage`: save the choice
  and reload, [I18N.md §1](../specs/I18N.md#1-choosing-the-language)). A level loaded from `levels/<slug>.json` whose slug is
  one of `SHIPPED_LEVELS` ([`levels.js`](../../src/game/levels.js)) also passes
  `destinations: SHIPPED_LEVELS, current: slug` (the ◂ label ▸ row); when the title resolves on
  another destination the page navigates to `?level=<destination>` (other query parameters kept,
  `autostart` dropped). Dismissing it unlocks WebAudio and calls `enterGameplay()`.
- **Gameplay** (`enterGameplay({ instant })`): `mode = 'play'`, silhouette on, clock running, rig
  on the player at yaw 0 and the level pitch / distance. `instant` (autostart) snaps the camera
  and DOF and arms a one-shot audio unlock on the first key / pointer press (which also starts
  the music — unless that key is the music key itself). Otherwise the music starts right away
  (`environment.music !== false`). After 0.2 s (instant) or 0.9 s the level banner shows for
  3.2 s and the controls legend appears.

### 3.4 The frame

The engine's loop order (see [modules/core.md](modules/core.md)) with the game's systems:

```mermaid
flowchart TD
  A["input.update()"] --> B["LightingSystem.update (order -10)<br/>clock, palette, lights, fog, sky"]
  B --> C["Game.update (order 0)"]
  C --> D["AudioSystem.update (order 20)"]
  D --> E["LightingSystem.lateUpdate<br/>shadow frustum around the rig"]
  E --> F["event lateUpdate: ui.update(dt, camera, input)<br/>dialog input, prompt, HUD, maps"]
  F --> G["render fn: postfx.setFocus(player chest depth)<br/>postfx.render(dt)"]
  G --> H["event afterRender: debug stats"]
  H --> I["input.endFrame()"]
```

`Game.update(dt)` runs these steps, in this order:

1. **Talk cooldown** ticks down (`TALK_COOLDOWN = 0.8` s after a conversation, during which
   confirm cannot start a new one).
2. **Shortcuts** (only in `play`):
   - `debug` toggles the debug panel, even with the map open or during a conversation.
   - `map` opens the world map, except while talking or in photo mode. `map` or `cancel` closes it.
   - With the map closed, `help` toggles the legend.
   - With the map closed and no conversation running: `photo` (or `cancel` in photo mode), `time`
     (`cycleTime`), `weather` (`cycleWeather`) and `music` (toggle + toast). On combat levels the
     pad's photo button is an LS click (`photoPad`), ignored while the move vector is longer than
     0.35 and for 0.3 s after.

   `cancel` is bound to **Escape and Backspace** (`Input.DEFAULT_BINDINGS`), so Backspace also
   closes the map and leaves photo mode. All bindings:
   [specs/INPUT_AND_CONTROLS.md](../specs/INPUT_AND_CONTROLS.md).
3. **Player and combat**: `active = playing && !talking && !mapOpen && !photoMode`;
   `frozen = !playing || talking || mapOpen || (combat && (photoMode || combat.locksPlayer))` (the
   extra term only exists on combat levels); `combat.update(dt, active)` (input → player action,
   enemies, projectiles, hits, in sub-steps); `player.update(dt, input)` (locomotion only while no
   combat action runs); `combat.afterPlayer(dt, active)` (separation, arena clamp, pickups,
   checkpoints, dormancy, lock-on / boss focus, engagement, music, HUD, labels, minimap);
   silhouette brightness `lerp(1, 0.5, nightFactor)`.
4. **Interaction prompt** (play, not talking, not photo, map closed, no combat lock): `_findInteractable()`;
   show the prompt over the NPC (`Talk`, 2.35 u up, 1.9 for the `child` preset) or at the
   object's prompt point with its label (`promptLabel(it)`: a built-in verb —
   `BUILTIN_LABELS`, also an exit's or event's data label that is one — as `t('game.prompt.<id>')`,
   any other exit or event label by the key its object holds, `textKeyOf(it.object, 'label')`; the
   interactable keeps its English `label`); on `confirm` (and no cooldown) the press is consumed
   (`input.consumeAction('confirm')`, so the dialog does not also see it) and `_interact()`
   starts.
5. **Villagers and critters**: every NPC `update(dt, ctx)`; on big levels far actors are
   throttled ([§6.4](#64-far-actor-throttling-big-levels)). `critters.update(dt, { player, threats })`.
6. **Camera**: `rig.inputEnabled = playing && !talking && !mapOpen`; title → `_updateCinematic`,
   play → `_updatePlayCamera` ([§3.6](#36-camera-framing)); `rig.update(dt, input)`;
   `spriteManager.update(dt)`; `blobs.update()`.
7. **World and atmosphere**: the `dust` emitter follows the camera focus
   (`focus + (0, 1.2, −2)`); `weather.zoomFog = clamp(((distance₀ − 7) / (distance − 7))², 0.4, 1)`;
   `weather.update(dt)`; `combat.applyLook(dt)` (the combat grade / DOF offsets on top of what
   Weather wrote); warm-frame bookkeeping; `world.update(dt, { focus, camera })` (animated
   props, water, the light pool, big-level particle culling); `godRays.update`; `_waterfallFx`
   (a `splash` burst ×4 every 0.28 s and a `sparkle` ×2 every 0.9 s at every splashing waterfall
   within 30 u of the focus); `particles.update`; `resolution.update`.
8. **HUD and audio**: clock (`hud.setTime`), region plate and banners (`_updateRegion`, every
   0.3 s), minimap / world map (`_updateMaps`), `audioDirector.update(dt, playerPosition)`.

### 3.5 Interactions and the conversation flow

`_findInteractable()` scores every NPC (at its `interactPoint`: the NPC, or its `talkOffset` /
`talkPoint`) and every world interactable (doors, signs, wells, chests, waystones —
[§4.3](#43-interactables-fires-and-falls)); an interactable with `disabled` set (an opened chest)
is skipped:

- skip when farther than its radius (NPC `talkRadius` ?? `INTERACT_RANGE` 1.6; object `radius`)
  or more than 1.3 u above / below the player;
- beyond 0.55 u it must be roughly in front: `dot(facing, direction) ≥ 0.25`;
- an object with a `lookSpan` (house doors: the door leaf, edge to edge) has a second target
  inside the same reach: the nearest point of that segment counts when the player faces it within
  60° (`SPAN_FACING` = 0.5), scored `distanceToThatPoint − 0.7 × dot`, and the object keeps the
  better of its two scores. A player who walks on into a door stops at the wall with the door-step
  point behind them — the leaf in front still shows *Knock* (straight on and at up to ≈ 60°
  diagonals). NPCs never use a span;
- lowest `distance − 0.7 × dot` wins. The returned object is reused — copy its fields.

`_interact(target)` sets `busy`, hides the prompt, and runs the conversation (the player turns
toward the NPC, the object's position, or — for a door — the nearest point of its leaf); objects
show their text (`_examineText(it)`: each page by the key its object holds, `text.keys[k]` —
`World.textPagesOf`'s `pageKeyOf`; an interactable without `keys` shows its lines as they are —,
the plate a term, a code default standing in for a blank one — `speakerDefault`,
`linesDefault` — as `t('game.default.<id>')`, and `t('game.default.nothing')` "Nothing of note."
for none; [§4.3](#43-interactables-fires-and-falls)) — unless the item has an `onInteract(game, it)` (combat levels: waystones rest, chests open), which is awaited
instead. `finally` always ends the
NPC's talk state, clears `busy` and starts the cooldown, so a throwing script never locks the game.

```mermaid
sequenceDiagram
  autonumber
  actor P as Player
  participant G as Game.update
  participant I as Input
  participant N as Npc
  participant C as conversation (dialogue.js)
  participant D as ui.dialog (DialogBox)
  P->>I: presses Space, Enter or F (confirm)
  G->>G: _findInteractable() returns the NPC
  G->>I: consumeAction('confirm')
  G->>G: _interact(target) sets busy and hides the prompt
  G->>N: beginTalk(px, pz) - state talk, faces the player
  G->>G: player.faceTowards(npc), visits + 1
  G->>C: await npc.talk({ say, visits, game, npc, toast, sfx })
  C->>D: say(lines) opens the dialog as this NPC
  loop every page
    D->>I: ui.update reads input - confirm advances, cancel completes the line, up and down pick
  end
  D-->>C: chosen index or undefined
  opt built-in action
    C->>G: restUntilMorning(), inventory and toast, or setMusic()
  end
  C-->>G: done
  G->>N: endTalk() - idle again after 1.2 to 2.5 s
  G->>G: busy = false, 0.8 s cooldown
```

`say(lines, opts?)` opens `ui.dialog` with the speaker — the villager's own plate,
`villagerName(npc)` (`term(npc.name)`, or `t('game.default.villager')` for a villager the level
left unnamed: `def.unnamed`), else `term(opts.speaker)` —, the NPC's `portraitColor`, and for its
own plate its character sheet (`sheet: npc.sheet.canvas`: the portrait) and its title
(`speakerTitle(npc)`: the villager's data `title` by the key its object holds, `def.titleKey` =
`textKeyOf(obj, 'title')`, else none). Lines are strings or `{ text, choices }`, already translated
by the conversation (`dialogue.js`: its own lines `loc('dlg.<conversation>.<name>', 'English')`, a
villager's data pages by the keys its object holds over `dialogueUnits` — `dialogueKeyOf(obj, i)`,
`choiceKeyOf(obj, i, j)` for each choice —, [§8](#8-dialoguejs--conversations-and-built-in-actions)); `{word}`
renders in gold. The promise
resolves with the last chosen index (or `undefined`).

`talkTo(id)` (automation) works as follows:

1. It closes the world map.
2. It looks for a clear spot next to the NPC's interact point. The candidate offsets are tried in
   this order: left / right (±1.15, 0), the two front diagonals (±0.85, +0.85), in front
   (0, +1.15), behind (0, −1.15). A spot is clear when the point and four probes 0.32 u around it
   are walkable, and its ground is within 0.3 u of the interact point's ground height.
3. It teleports there (no teleport when no spot is clear), faces the NPC and calls `_interact`.

It returns `false` for an unknown id, or while busy, a dialog is open, the mode is not `play`, or
photo mode is on.

`restUntilMorning()` (the `rest` action and the innkeeper): fade out 1 s → `weather.setTime(8)`
→ chime → 0.7 s → fade in 1.1 s → toast "You feel well rested."

### 3.6 Camera framing

- **Zoom-dependent focus bounds** (`_updateCameraBounds`): the rig's focus rect is interpolated
  near ↔ mid between `minDistance` and the level distance, mid ↔ far between the level distance
  and `maxDistance`. So the player stays in frame (and in the DOF band) right up to the map edges
  whatever the zoom.
- **High ground**: pitch target = `highGround.pitch` while `player.y > highGround.minY`, else the
  level pitch (`game.camera.pitch`). The debug panel's *Camera › pitch* slider writes whichever
  of the two is in use, so it sticks; its *reset* restores the level's values
  (`DebugControls.js`).
- **Edge-aware yaw**: near the west edge, the negative yaw limit shrinks smoothly from −60° to
  −10°; near the east edge, the positive limit shrinks from +60° to +10°. The band starts
  `e0 = min(9, W / 5)` tiles from the edge and is fully applied at `e1 = e0 × 5/9`. This keeps the
  camera from swinging out over the border forest. Away from the edges this code applies no clamp.
  Neither the high-ground pitch nor the edge clamp runs in photo mode (only the focus bounds do).
- **DOF focus** while playing = view depth of the player's chest (`y + 0.9`)
  (`_playerFocusDistance`), not the bounds-clamped rig focus.
- `teleport(x, z)` snaps to the nearest standable point within 3 u (rings every 0.25 u) or
  returns `null`, then updates bounds, snaps the rig, `lightPool.snap()`s the lights and snaps the
  DOF. `_ensureStandingSpawn()` handles a spawn on water / walls / off the map: it first tries the
  same 3 u ring search around the spawn, then the ring search around the nearest walkable tile
  centre that yields a standable spot, and moves the player there with a console warning.

### 3.7 Time, weather, photo mode, music, maps

| Feature | API | Notes |
| --- | --- | --- |
| Time | `cycleTime()` (T), `setTime(h)` | `Weather.cycleTime` glides 2 s forward to the next preset (6.5 Dawn, 12.5 Midday, 17.2 Golden Hour, 18.9 Dusk, 22.5 Night) and toasts its name. `setTime` ignores non-numbers. |
| Weather | `cycleWeather()` (R), `setWeather(name)` | `clear → rain → snow → clear`, blended ([§9](#9-weather--time-glides-and-weather-blending)). In a room (`environment.interior`) none shows: R changes the weather outside (toast "Rain outside"). |
| Photo mode | `togglePhotoMode({ instant })` (P, leave with P or `cancel`) | Refused while busy, in a dialog, outside play or with the map open — and on combat levels while engaged or dead (toast "Not while foes are near"), where photo mode also freezes the player and pauses combat. From the keyboard a toast shows, the UI hides 1.2 s later; `instant` (automation) hides it at once. |
| Music | `setMusic(on)` (M) | `AudioSystem.startMusic/stopMusic`; `environment.music === false` keeps a level silent at start. On combat levels `setMusic(true)` starts the track combat wants (`combat.musicTrack`: `emberfall`, `battle` or `boss`). |
| Minimap / world map | `toggleMap(open)` (N / Tab, gamepad Back) | `renderLevelMap(level)` is painted once at load (`_setupMaps`); minimap `view: 34`, disabled by `environment.minimap === false`; the world map shows regions and markers (NPCs, interactables and fires from `World.mapMarkers()` — a live story prop's marker hides while it is absent; combat levels: enemy dots, waystones, discovered chests, the boss) and only opens in play, not during a conversation or photo mode (combat levels: nor while dead or in the boss intro; it pauses combat and releases the lock-on). While it is open the player stands still, but the clock and villagers carry on. |
| Regions | `_updateRegion` | Every 0.3 s: the first `region` containing the player (and above its `minY`, if set) sets the HUD plate (`term(name)`; `sub` by the key the region holds, `textKeyOf(region, 'sub')`, or the level name as a term); a `banner` (by `textKeyOf(region, 'banner')`, the name a term) shows once per play session (per region name: `_bannersShown` is cleared by `enterGameplay` and made anew by `_applyLevel`, so a campaign's travel shows them again; walking back into a region does not). Between regions the last plate stays. |

### 3.8 Debug panel and automation hooks

- **Debug panel** (`` ` `` / F1, only in play): `buildDebugControls(game)` fills the engine's
  lil-gui `DebugPanel` with folders **Time & Weather**, **Post FX** (Depth of field, Bloom, Grade,
  Split toning & vignette colour), **Lighting**, **Camera**, **Atmosphere** and **Render**
  (render scale — setting it makes the resolution governor manual —, dynamic resolution, stats
  overlay, photo mode). Lighting / atmosphere sliders edit `weather.tuning`, the base values the
  weather multiplies on top of, so the panel and the weather never fight.
- **`window.__game`** (set at the end of `init`; typed by `GameHooks` / `GameState` above
  `_exposeGlobal`, which the object is type-checked against): `engine, rig, postfx, lighting, ui, audio,
  tileMap, textures, particles, godRays, player, npcs, world, weather, game, level, levelSource`
  plus `setTime, teleport, talkTo, setWeather, cycleTime, cycleWeather, setMusic, photo(on), map(on),
  state()`. `state()` returns mode, level, player (position, tile, facing, animation, speed),
  region, time, phase, night, weather, dialog / busy / photo / map flags, music, audioReady,
  `nearest` interactable id, `drawCalls` / `triangles` (PostFX scene info — the scene incl. the
  shadow pass, not the post passes), fps, `pointLights`, `activeLights`, `renderScale`,
  `pixelRatio`, `gpuMs`, camera and inventory — plus, on combat levels only, `combat` (the combat
  state) and `window.__game.combat` (the combat test hooks). Canonical reference:
  [specs/AUTOMATION_API.md](../specs/AUTOMATION_API.md).
- `dispose()` cancels timers and the audio-unlock listeners, stops the engine and disposes
  everything in reverse order (the combat system first, then the game objects while the renderer
  is alive, then the engine and the UI); each step is isolated in `try/catch`.

### 3.9 Campaigns: the level half and `swapLevel`

A campaign ([CAMPAIGN_FORMAT.md](../specs/CAMPAIGN_FORMAT.md),
[Campaign lifecycle](../specs/CAMPAIGN_FORMAT.md)) plays
several levels in one page. `Game` therefore has two halves:

| Lives as long as the page (`init`) | Belongs to a level (`_applyLevel` + `_buildLevel`) |
| --- | --- |
| `Engine`, renderer, `TextureLibrary`, `LightingSystem`, `Particles` (and the burst pools), `GodRays`, `SpriteManager`, `CameraRig`, `PostFX`, `ResolutionGovernor`, `UI`, `AudioSystem`, `Weather` (its rain and snow emitters), the debug panel, the frame wiring, the fog-start patch; for a campaign one `LightPool` of 12 lights with `fixed: true` (`this.lightPool`, handed to every `World`) | camera framing and bounds, the fog start (`uFogStart`), high ground, regions, the combat flag, the title drift (`_applyLevel`); `World`, `Player`, villagers (+ their sheets), `Critters`, `CombatSystem`, `BlobBatch`, the actors' warm-fill registrations, `AudioDirector`, the HUD's location and controls, the maps (`_buildLevel`) |

`init` calls `_buildLevel` once, exactly where it built the level before (single levels are
unchanged: same order, same programs). `swapLevel(level, { spawn, source })` — called by
`CampaignRuntime.travel` behind the fader — sets `mode = 'travel'` (`update` returns at once),
closes the map and photo mode, then:

1. `_detachLevel`: disposes combat now (it undoes its HUD, key bindings, mouse buttons and stick
   zoom, and releases the burst pools only its warm-up made — `Particles.releaseBurstPools`, so a
   peaceful level next keeps its own program count, KNOWN_ISSUES CMP-05; `window.__game.combat`
   goes) and keeps the rest of the level for later — with `keep` (a room's travel, below) it is
   set aside at once (`_setAside`);
2. `_applyLevel(level)`, the rig's distance range and bounds;
3. `_buildLevel(…, { spawn, prepared })`: the new level — its world built ahead when the travel
   hands one over (`prepared`, below: the build steps not run yet, then `world.attach()` where
   `new World` + `build()` would run, the world's story presence switched to the runner's), else
   built here —, the player at the arrival point (moved quietly onto standable ground),
   `campaign.attachWorld` (Space exits become interactables), the maps (the campaign overview on
   placed levels, `refreshWorldMap` when the other levels' maps arrive);
4. the detached level is disposed (its world's god-ray shafts with it: `World.shafts`) — **after**
   the build, so programs both levels use stay compiled — unless it was set aside;
5. the camera snaps to the arrival, then init's warm-up: rain and snow on, the one-shot bursts,
   `combat.warmup`, both compiles, the shadow primer, five drawn frames (`_frames`), the primer
   disposed, `combat.endWarmup` — for a level attached again (`kept`) only the compile check and
   `KEPT_FRAMES` (2) frames;
6. the previous mode returns, `window.__game` is exposed again (new objects), `loadStats.lastSwap`;
   it returns `{ aside }`, the level left when it was set aside.

**Levels set aside** ([CAMPAIGN_FORMAT.md §6.3](../specs/CAMPAIGN_FORMAT.md#rooms-the-levels-set-aside)).
Around rooms (`environment.interior`) the campaign keeps levels instead of releasing them:
`swapLevel(level, { keep })` sets the level left aside (never a combat level; a campaign only — it
needs the shared light pool) and returns it as a `KeptLevel` (`_setAside`: `World.detach()`, the
traveler's, villagers' and critters' sprites out of the scene and the sprite manager, their warm
fill out of the lighting, the contact-shadow batch out of the scene, a talk or a script's walk on
them reset; the level, its source, the villagers' sheets, the `AudioDirector` and the painted map
with the story presence it was painted for kept); `swapLevel(kept.level, { kept })` attaches one
again where `_buildLevel` would build: `world.attach()` (root, emissive registrations, emitters,
god-ray shafts back; `_wireLights` hands the shared pool its descriptors again, the story groups'
lamps hidden as they were), the same `Player` (`arrive(spawn)`: at the arrival spot, idle, nothing
left over), villagers, critters, batch and ambience back, the actors' warm fill registered again,
the painted map reused while `_mapPresence()` (which story-conditioned objects are there) is the
same, then `campaign.attachWorld` and `story.attachLevel` as for a build — the story's changes
since are applied there (`applyPresence`). `disposeKept(kept)` releases one (`_disposeDetached`).
`World.detach()` takes an attached world out of the running game without disposing anything (its
root, emissive registrations — registered again from `baseDay` on attach —, emitters, god-ray
shafts, and the prompts others added after the build: `interactables` back to the world's own
`_ownInteractables`); `attach()` runs the deferred steps of a world built ahead the first time and
puts a detached one back after that (`attached` says which). A failed build or attach releases the
level left (set aside or not) and the level being attached, and `_forget` clears what the game
still points at of them, so the caller's rollback releases nothing twice. `Game.dispose` releases
the levels set aside first (`campaign.dropAside()`).

`CampaignRuntime` ([`src/game/campaign/CampaignRuntime.js`](../../src/game/campaign/CampaignRuntime.js))
drives the rest: walk exits in `update` (called from `Game.update` while playing), the arrival
point, the level's clock / weather / music / backdrop on entering, combat progress, opened
chests and the enemy groups defeated there (`CampaignState.cleared`: `combat.defeatedGroups()` at
every save in the level and on leaving, `combat.markGroupsCleared(ids)` on entering — those groups
are simply not there until a waystone rest; KNOWN_ISSUES CMP-03), story flags (`Game._interact`
calls `setFlag` with a villager's `storyFlag` after the
conversation), chapters, saves (`CampaignState`, version 2: no save before `onStart`, a run's saves
atomic, play-tests under `….test`), the title's Continue / New journey, a failed build's way back,
and the levels set aside around rooms (`_aside`: the `parent` and the last `room`, each an
`AsideEntry` — base id, file, its text, the parsed file `levelRaw` and the game's `KeptLevel`;
`travel` takes the target out with `_takeAside`, attaches it while `_asideHolds` — the same file and
text, the same objects from `storyLevel` —, releases everything with `dropAside` before a level that
is neither a room nor set aside, and keeps the level left with `_putAside`; `keepRooms = false`
turns it off).
The start itself (the saved game or `&level=` / `&story=`, the level file, the arrival spot) is
`loadCampaignStart` in [`CampaignStart.js`](../../src/game/campaign/CampaignStart.js), which
`src/main.js` imports only for `?campaign=`: a single level loads no campaign or story-state code.

**Content text across levels** ([I18N.md §4.8](../specs/I18N.md)). Every display site reads the
text key from the object it shows (`textKeys`, `#line:` tags; I18N.md §4.2), so a text keeps its
key on any level, in a world built ahead, a room set aside or a party member's talk, with nothing
to remember per file. `swapLevel`'s `source` is the file whose text is played, which the campaign
takes from `CampaignRuntime.sourceOf(fileId)` = `CampaignLevels.textPath(fileId)`: for a chapter
variant started with `&level=<variantId>` or play-tested with `&as=`,
`CampaignLevels.override(id, text, textFile)` remembers the variant's file, so its own keys are
read (shared with the base where the English is the same) while `state().campaign.file` stays the
base id. The campaign's own texts: an exit's locked pages by `pageKeyOf(exit, 'locked', i)` (a
blank `locked`: `t('campaign.exit.closed')`), the arrival banner `term(level.name)` and the
subtitle by `textKeyOf(level, 'subtitle')`, chapter banners by `textKeyOf(chapter, 'title' |
'subtitle')`, the title screen by `textKeyOf(campaign, 'title.<k>')` / `textKeyOf(campaign,
'subtitle')` (blank: `game.default.prompt` / `game.default.credit`), and the names on the save
line, the world map and the travel toast as terms.

**The next level built ahead** (KNOWN_ISSUES CMP-01;
[`LevelPreparation.js`](../../src/game/campaign/LevelPreparation.js)). Every 0.5 s
`CampaignRuntime.update` looks for the nearest exit within 12 u that is there and whose `requires`
holds (the preload rule, which also fetches every such exit's file): its level is prepared —
unless it is set aside (it is attached as it is) — one at a time; another target, a chapter that swaps the file, or no exit toward it within 24 u
drops the preparation. Each frame asks for an idle callback (`requestIdleCallback`), which works
on it for what the frame leaves (at most 8 ms, 3 ms kept free; after 120 ms without idle time a
3 ms slice anyway; a browser without idle callbacks: 3 ms in the frame):

1. the file's text (`CampaignLevels.text`) parsed, the story applied as it stands **in that level**
   (`CampaignRuntime.storyLevel`) and its *presence key* taken (`CampaignRuntime.presence`: one
   character per story-conditioned object of the file — there or not — and a snapshot presence
   test the world is built with, so a story change mid-build cannot give it a mix);
2. `Game.prepareWorld(level, present)`: a `World` made with `defer: true`, built by
   `buildSteps({ paced: true })` one step after another ([§4.1](#41-build-phases)) — terrain,
   props, trees, waterfalls, foliage, the merges, snow, culling, the shore in its worker. Nothing of
   it reaches the running game: its root waits outside the scene, its colliders go into its own
   TileMap, and the emissive registrations, the props' and waterfalls' emitters, the light pool's
   descriptors and the atmosphere (dust, particle areas, god rays) wait in `world._pending`.

A preparation whose key no longer matches the story (checked every 0.5 s) is begun again. The
travel (`CampaignRuntime.travel`) takes the preparation of its file and uses it when the text and
the presence key are still the same — else it is disposed and the level built as before; either way
the rest of the travel is unchanged. `Game.swapLevel(level, { prepared })` runs the steps not done
yet at full speed behind the fader (`LevelPreparation.finish`, a frame every ~12 ms) and attaches
the world where `build()` would have run: the scene, every program in use, the draw calls and the
particle seeds are those of a world built there (verified by hashing the built worlds). What stays
at the travel: the villagers, critters, player and combat (scene objects, sprites, bindings), the
weather's and the ambience's view of the level, the maps (a painted map is ≈ 6–35 ms of one
uninterruptible step; the villagers' sheets ≈ 7–15 ms), and the compile and warm-up. A failure
anywhere from the hand-off on is a failed build: the travel's rollback builds the level left again.
`state().campaign.prep` shows the preparation, `stats.lastPrep` the last travel's (with `used`);
`campaign.prepareAhead = false` turns it off. Measurements:
[PERFORMANCE.md §2.7](PERFORMANCE.md#27-campaign-travel).

### 3.10 The story runtime

A campaign — or a single level with a story (`levelHasStory`: an `event`, or a villager with
`talk` / `actor`) — gets a `StoryRunner` ([`src/game/story/StoryRunner.js`](../../src/game/story/StoryRunner.js),
[STORY_SCRIPT.md](../specs/STORY_SCRIPT.md)), created by `Game._createStory` in `init` **before**
the level is built and imported lazily together with its UI (`ui.useStoryUI`: the journal, emote
bubbles, the end card, the letterbox; the `journal` key B is bound then). A level without a story
creates none of it (`game.story === null`), and `World` gets `story: null` (the old build path).

- **Persistent half.** The runner outlives `swapLevel`: `_buildLevel` begins with
  `story.setLevelId(levelId)` (conditions read the new level's `level` and `done:` while its world
  is built) and ends with `story.attachLevel(levelId)` (index the level's events — Space events
  become interactables —, give villagers their talk scripts and saved homes, subscribe to combat
  `kill` for `cleared` events, apply presence at once); `_detachLevel` calls `story.detachLevel()`
  (the camera back to the game, the level's queued events dropped). Its state is the campaign
  save's `StoryState` (a single level: a session one). Conditions read the story through
  `storyReader` (StoryState.js) — the same rules the campaign uses at boot, before the runner
  exists (`CampaignRuntime._holdsIn`; a travel reads the level being entered: `storyLevel(level,
  to)`, `holdsIn(to)`).
- **Presence.** `World` is built with `story.present`: the props of `LIVE_STORY_TYPES` with a
  `when` / `unless` — houses, windmills, wells and waterfalls included — and the particle areas
  become story groups (`World._storyGroupOf`, `storyRanges`, `applyStory`);
  `story.applyPresence()` (on every story change) toggles them, the critters groups
  (`Critters.applyStory`: an absent group's animals hidden, not updated, out of `chickens`; back
  at their start points) and the villagers (`Npc.setPresent`), moves actors off ground that went
  away, refreshes the chickens' threats and the minimap's villagers (`Game.refreshActors`) and
  repaints the maps (`Game.repaintLevelMap`, painted from `_mapLevel`: absent story objects left
  out).
  A group's props are merged into the level's own batches like any other, and the group hides by
  collapsing its vertex ranges there and hiding its props' own roots (what the merge leaves there:
  flame billboards and glows, a windmill's sails — its `update` skipped while absent —, a
  waterfall's sheet and foam pool) — no draw call of its own, none added or removed
  ([§4.9](#49-live-story-groups-in-the-levels-batches)). `world.fires` holds only the campfires
  there now and `world.fallAnchors` only the roaring waterfalls (both changed in place: the
  AudioDirector's crackle and roar follow; `Game._waterfallFx` skips a fall whose `hidden` is
  true); their map markers, like the group's prompts' (doors, wells, signs), read `hidden` from
  the group (`World.mapMarkers`). The shore re-bakes only
  around the changed colliders standing in water (`_wetTiles`, clustered by `_clusterRects`), a
  big level's in a worker (`Water.rebakeShoreAsync`). `applyStory` returns `{ changed, rect,
  mapChanged }`: `mapChanged` is true when a changed group holds a type the painted map shows
  (`LEVEL_MAP_TYPES`: a lamp, a crate or a sign alone need no repaint).
- **The frame.** `Game.update` calls `story.update(dt)` after the player and combat (walks, waits,
  the camera director, the skip hold, the clock — the campaign's hour (`campaign.hour()`), so an
  interior's own hour is no jump: a new day, `time` events —; when the story version, the tenth of
  an hour, the weather or the gold changed: presence, `change` events, chapters through
  `campaign.onStoryChange`; `enter` / `leave` events; the next queued run when the player is free).
  The game setting the clock is no time passing: `CampaignRuntime.onStart` (Continue) and
  `newGame` call `story.resyncClock()`. While the story owns the camera (`story.ownsCamera`),
  `_updatePlayCamera` is skipped and the DOF focuses on the rig's focus. On a combat level a
  presence change that moves colliders rebuilds the enemies' walk grid (`combat.rebuildNav(rect)`:
  given `World.applyStory`'s rect, only the cells a change there can reach — `Nav.buildRect`, the
  same grid as a full build in ≈ 0.05–0.1 ms for a bridge; without a rect, the whole grid), and
  the combat legend gets the journal line (`combat.legendExtra`).
- **Interaction.** `_interact` runs a villager's talk script (`story.talk(npc)`, which counts the
  visit when the run ends) instead of its conversation; other villagers' visits count in the
  story's state too, by actor or `<level>/<id>` (`story.visitKey`, `StoryState.visit`).
  `_findInteractable` skips absent villagers and prefers a story event's prompt at the same spot.
  A run holds the player through `busy`; the journal (`toggleJournal`, `journalOpen`) pauses play
  and combat like the world map.
- **Continue.** `enterGameplay` runs the level's `arrive` events — except on a continued campaign
  (`campaign.hasSave`), which instead runs again the event runs saved as queued or going on
  (`story.resumePending()`, `StoryState.pending`, written by `CampaignRuntime._saveObject` from
  `story.pendingKeys()`) and talks to the villager of an interrupted conversation again
  (`game.talkTo`).
- **The background lane.** `background: true` events run as `story.bgRuns` (`_execBg`, at most 8,
  their own queue `bgQueue`): no `busy`, no saves held, no window — `bark` lines go to
  `ui.emotes.bark` (the emote layer's text bubbles); `StoryScript.backgroundIssue` refuses any node
  that needs the player. They pause (walks, waits) while `_bgPaused()` (a run, `busy`, a dialog, the
  map, the journal, photo mode, a travel); a main run that directs a villager stops the background
  run directing it (`_takeActor`); `detachLevel` stops them.
- **Text** ([I18N.md §4.2, §4.8](../specs/I18N.md)). A script line's key is its `#line:` tag:
  `parseScript` cuts the tag off and puts the key on the node, so nothing is stamped at run time.
  `_parse(key, source, where)` caches a parse by its source key (`talk:<level>/<id>`,
  `level:<level>/<event>`, `script:<id>`) and its text, tags included: a chapter variant's unchanged
  talk is the same parse with the same keys, an edited one a parse of its own, and a parse's errors
  are reported once. Lines, questions, options, barks, toasts, banners, stage texts and the
  ending's title are shown by their keys (`loc(node.tk, text)`, `option.tk`, a banner's `node.tks`)
  and their values filled after (a blank ending title: `t('story.ending.default')`); a `call` keeps
  the called script's keys; speakers, item, quest and actor names and the ending's subtitle are
  terms. The journal shows declared item, quest, stage and goal texts by the key the story file
  holds (the built story's `textKey`), and a script's own stage text by the key and English saved
  beside it (`q.keys`, `q.src`; only a GUID is kept — a key that is no GUID is dropped
  with its English, so the text is shown as saved, in English, a `nokey` miss, as is one saved
  without a key; a text that had `${…}` values is shown as saved, in English, with no miss). A villager's title comes from `def.titleKey`, else
  `textKeyOf(storyObj, 'title')` (`_titleOf`). Lines no window shows (`auto` answers, the lines a
  skipped cutscene passes over) are looked up `quietly`; `__game.story.run` lines have no keys
  (English in every language, a `nokey` miss each; nothing is looked up by its English). A shop item the story names from a name is kept under that
  name (`StoryState.itemNames`).
- **Rest, time, endings.** `restUntilMorning` tells the campaign (`onRest`: an interior keeps its
  hour, the campaign's clock moves to the morning) and the runner (`rested`: a new day past
  midnight); `returnToTitle` (a script's `ending`) reloads to the title.

### 3.11 The party

The villagers who joined the player ([PARTY.md](../specs/PARTY.md) §4): [`src/game/party/`](../../src/game/party/Party.js)
— `Party` (records, the player's trail, the follow, joins and leaves, the talk, the tactics
panel's wiring) and `PartyMember` (a member's sprite and its moves). Made on demand
(`Game.ensureParty`: the party chunk, its UI — `ui.usePartyUI` —, the G binding): on a level
nobody joins on `game.party` is null and nothing of it runs or exists.

- **Persistent half.** The party outlives a campaign's travel; its records are the story's
  (`StoryState.party`, saved with a campaign; `Game.syncParty` → `Party.syncFromState` on Continue
  and a new journey). Each level gets the members as actors: `attachLevel` at the end of
  `_buildLevel` (built, prepared or set aside and attached again) registers them like the level's
  actors (scene, sprite manager, `SPRITE_FILL`, the contact-shadow batch and `makeShadowOnly` on
  batched / combat levels) and places them behind the player; `detachLevel` in `_detachLevel`
  releases them — a level set aside keeps no member. Their villagers are hidden on every level
  (`Party.holds`, by id or actor; `refreshActors` and the maps skip them; the story's `present`
  asks it too).
- **The follow.** `party.update(dt)` after the story in `Game.update`, only while playing with no
  map, journal or tactics panel open: the trail grows (a point every 0.12 u), each member walks to
  its point `1.1 · (k + 1)` u behind the player along it — a beat after the one before it, easing
  in and out, to the side where the trail runs toward the camera (it would hide the player), back
  further where it cannot step aside; it rests beside or behind the player on the screen and makes
  way when the player walks into it (catch-up on the walk grid beyond 4 u, else along the trail, a
  snap beyond 20 u, stuck 2 s or with no way back); a teleport (`Game.teleport`, a jump > 2.5 u) puts
  them behind the player, clear of it on the screen. A member the combat drives
  (`member.combat.active`), a script directs or the player talks to waits. While a member in front
  covers the player on the screen (`party.coversPlayer`) the player's x-ray silhouette fades out
  (`Player.fadeSilhouette`); every `_buildLevel` binds G again while a party exists (`_bindParty`).
- **Talk.** `_findInteractable` offers members standing still; `_interact` → `Party.talk` (the
  story's `talkFor` script, else the party conversation: *Tactics…*, *Part ways*, *Carry on*);
  `talkTo(id)` falls back to the member. A member's title, talk and pages use the keys its
  villager's level object holds (`PartyMember.storyObj`, taken at `attach`; a stand-in made from the
  record alone, `{ id, actor }`, holds no title and no pages: its talk is its story actor's, whose
  lines carry their own tags), so they keep their keys on any level;
  the frames, the panel and the toasts name it
  with `Party.memberName` (`term(name)`, `t('game.default.villager')` for 'Villager').
- **Tactics panel and HUD.** `togglePartyMenu` (G, *Tactics…*, the hook) opens the panel; while it
  is open play pauses like the journal (`partyMenuOpen` in `update`'s `mapOpen`). The legend gains
  *G — Party* (`_controls`, `_legendExtra`, `refreshPartyLegend`), the HUD frames are fed every
  frame (`_updatePartyHud`), the maps get `map.party` (`refreshActors`).

---

## 4. `World` — building a level into the scene

[`src/game/World.js`](../../src/game/World.js) turns a normalised level into meshes, lights,
particles and gameplay anchors. The per-object geometry comes from the engine's
[`ObjectBuilder.js`](../../src/engine/level/ObjectBuilder.js) — **the same builders the editor's
3D preview uses** ([EDITOR.md §10](EDITOR.md#10-how-the-editor-stays-in-sync-with-the-game)).

### 4.1 Build phases

`build(onProgress)` is `async`: it runs `buildSteps()`, a step generator
([`src/engine/utils/steps.js`](../../src/engine/utils/steps.js)), and between phases yields a
macrotask (`setTimeout(0)`) so the loading screen keeps animating; `stats.phases` records the CPU
milliseconds of each phase (yields excluded). The long builders inside are step generators too —
`buildLevelTerrainSteps` (`TileMap.buildSteps`: a step per tile, per tile's fringes, per mesh),
`shadowCasterSteps`, `TileMap.consolidateChunkSteps`, `PropFactory.mergeStaticSteps`,
`mergeTreeSteps`, `scatterForestSteps`, `outerGroundSteps`, `groundDetailSteps`, `kdSplitSteps` —
whose synchronous forms (`buildLevelTerrain`, `mergeStatic` …, what the editor calls) run the same
generator to its end (`runSteps`): one code path, the same result. A whole build runs them in one
go. A campaign's next level built ahead ([§3.9](#39-campaigns-the-level-half-and-swaplevel)) is a
world made with `defer: true` and built by `buildSteps({ paced: true })`, a step at a time: a slice
point after every tile, object, tree, batch and field (props: before every object), the shore baked
in its worker on any level, and what reaches the running game — the root into the scene, the
emissive registrations, the props' and waterfalls' emitters (their `Particles` seeds count up as
they are made), the lights and the atmosphere (phase 7) — held in `_pending` until `attach()`,
which does it in this order where `build()` would have run. Its `stats.buildMs` is CPU time.

| # | Label (World progress) | Phase key | What happens |
| --- | --- | --- | --- |
| 0 | — | — | `batching = World.isBigLevel(level) ? { ...BIG_LEVEL_BATCHING } : null` (`max(width, depth) > 64`). |
| 1 | Painting textures (0.08) | `textures` | `textures.preload()` — every procedural texture painted up front. |
| 2 | Raising the land (0.18) | `terrain` | `buildLevelTerrain(level, { chunkSize: big ? 32 : 64, deferShore: true })` → `TileMap` + `Water`. Big levels: the opaque casting faces (`isProxyCaster`) get merged shadow-only proxies (`buildShadowCasters`, name `terrain:shadow`) and stop casting themselves; then `tileMap.consolidateChunks({ maxTriangles: 48000, maxExtent: 48, minTriangles: 12000 })`. |
| 3 | Building the village (0.30–0.44) | `props` | `LevelObjectBuilder({ seed: 42 })`; the `*_buildProps()` generator builds every buildable object except trees and waterfalls, yielding about every 12 ms; each result is wired ([§4.2](#42-the-builtobject-wiring)); houses / signposts / wells / campfires register interactables and anchors. |
| 4 | Planting the forest (0.45) | `trees` | Level trees built (colliders kept unless `collider: false`, not added individually), then — on big levels and in a world built ahead — `water.refreshAsync()` starts the shore bake in a worker; `_buildTrees()` scatters the forest border and outer forest and merges everything ([§4.5](#45-scenery-forest-border-outer-forest-outer-ground)); a live story tree is merged with the others, tagged with its group ([§4.9](#49-live-story-groups-in-the-levels-batches)). |
| 5 | Letting the water run (0.58) | `water` | `_buildWaterfalls()` (a world built ahead keeps its emitters for `attach()`); small levels built in one go bake the shore now (`water.refresh()`), after every collider standing in water exists. |
| 6 | Growing the meadow (0.68) | `foliage` | `_buildGroundDetail()` ([§4.6](#46-ground-foliage-grounddetailjs)). |
| 7 | Lighting the lanterns (0.80) | `lights` | `_wireLights()` (the `LightPool`, [§4.4](#44-lights-emissives-and-emitters)) and `_buildAtmosphere()` (dust, particle areas, god rays); a world built ahead: at `attach()`. |
| 8 | Merging meshes (0.88) | `merge`, `shoreWait` | `_mergeProps()` → `factory.mergeStatic(results, { name: 'village:static', …split, shadowCasters, tags })` (`tags`: the live story props' groups, only when there are any — [§4.9](#49-live-story-groups-in-the-levels-batches)); a level whose shore bakes in the worker then awaits it (re-baking once more if a collider changed meanwhile). |
| 9 | — | `snow` | `addSnowCover` on terrain meshes, the outer ground (`'ground'`), foliage fields (`'foliage'`) and merged roof materials (`ROOF_MATERIAL` = `/^luminati:roof/`, exported by `SnowCover.js`). |
| 10 | — | `culling` | Big levels only: `cullByBox` on terrain meshes, merged prop meshes, tree groups and foliage fields (the foliage with `pad: 0.8`). |

Afterwards `stats` holds `buildMs`, `colliders`, `pointLights`, `objects`, `batching`,
`terrainMeshes` (big), `trees { village, border, outer }`, `foliage`, `lightDescriptors`,
`lightsPooled` and `phases`.

### 4.2 The `BuiltObject` wiring

`LevelObjectBuilder.build(obj, tileMap)` returns a `BuiltObject` (or `null` for actors and
markers). `World._build()` wires every field (a builder exception is logged and the object is
skipped — a broken object never stops the level):

| `BuiltObject` field | Consumer |
| --- | --- |
| `object` | added to `World.root` (except level trees, which are only merged) |
| `propResult` | pushed to `results` for `PropFactory.mergeStatic` (not for `light` / `waterfall`, not for trees); a live story prop's too, and `_storyTags` maps it to its group |
| `colliders` | `tileMap.addCollider(c)` (circles and boxes; queried through a spatial grid) |
| `walkRects` | `tileMap.addWalkSurface(r)` (bridge decks) |
| `emissives` | `lighting.registerEmissive(material, { day ?? 0, night ?? 1.6 })`, once per material; the entry gets `baseDay` so the weather can light windows on grey days (a world built ahead: at `attach()`) |
| `lights` | collected as descriptors for the light pool (tagged `<type>:<id>`, `priority` from `LIGHT_PRIORITY`, other types 3; a house's door lantern only when `obj.light` is set) |
| `emitters` | `particles.createEmitter(e)` — `smoke` gets the softer, greyer `SMOKE` look; waterfall mist gets `count = max(4, round(8 × width))`, `alpha 0.07` (overridable per waterfall with `mist: { count, alpha }`); a world built ahead creates them at `attach()` |
| `update` | pushed to `updaters`, called every frame (windmill sails, waterfalls) |
| `interact` / `anchor` | door positions (with the door leaf, `interact.lookSpan`), well / sign anchors, campfire and waterfall anchors |

### 4.3 Interactables, fires and falls

| Level object | Registered as | Radius | Label | Text |
| --- | --- | --- | --- | --- |
| `house` with a non-empty `text` | id `door:<id>`, kind `door`, at the builder's door-step point (0.9 in front of the wall collider), `lookSpan` = the door leaf ([§3.5](#35-interactions-and-the-conversation-flow)) | 1.0 (set here; the prop's own `interact.radius` 1.1 is unused) | Knock | `text` pages, no speaker; keyed by the **house's** id (`of: <id>`), not `door:<id>` |
| `signpost` with `text` | kind `sign`, at the anchor | 1.35 | Read | speaker `obj.speaker` (a term; `''` none), absent: 'Signpost' shown as `t('game.default.signpost')` (`speakerDefault`) |
| `well` with `text` | kind `well`, prompt 4.2 u above and 0.3 u north | 1.75 | Look | sfx `obj.sfx ?? 'splash'` |
| `campfire` | `fires[]` (ambience; a live story group's only while it is there), a `fire` marker (`mapMarkers()`), `anchors.campfire` = first | — | — | — |
| `waterfall` | `falls[] = { id, x, z, width, dir, anchor, splash }` (spray; a live story fall also `hidden`, a getter: true while its group is absent) and `fallAnchors` (the roar: the splashing falls there now) | — | — | — |

A house without text has **no interactive door** (the editor's level check warns about it). A live
story object's prompt is in its group and `disabled` while the group is absent.

The text stays the level's English (`InteractText`): `lines` are the field's pages from
`World.textPagesOf(obj)` (ContentKeys.js `textPages`: blank entries skipped, their indices not
reused), and `keys` the text key the object holds for each page (`pageKeyOf(obj, 'text', i)` at
its raw index; `''` where it holds none), so `Game._examineText` shows each page by its own key.
`speakerDefault` / `linesDefault` mark a code default standing in for blank data (the sign's
'Signpost', an unnamed waystone's 'Waystone', the chest and waystone examine lines on a peaceful
level), shown as `t('game.default.<id>')`. The pages of an interactable without `keys` (one another
module made) are shown as they are.

### 4.4 Lights, emissives and emitters

**Point lights** go through the engine's [`LightPool`](../../src/engine/lighting/LightPool.js)
with `MAX_POINT_LIGHTS = 12` (`World.js`):

1. Descriptors are sorted by `priority` (`LIGHT_PRIORITY` in `ObjectBuilder.js`: campfire, hearth 0,
   `wallTorch` / `light` 1, lamppost 2, house door lantern 3; any other type 3), ties by level
   order.
2. Hand-edited numbers are sanitised when they are present. `intensity` is clamped to 0–200,
   `distance` to 0.5–100 and `flicker` to 0–1. An invalid value falls back to 8 / 8 / 0.2. An
   absent value keeps the `LightingSystem.addPointLight` default (intensity 8, distance 8,
   flicker 0.3). `nightOnly` defaults to `true`. A `light`
   object gets its own builder defaults: intensity 8, distance 8, flicker 0.2, colour `#ffb46b`,
   1.5 u above the ground (`dy`).
3. `new LightPool(lighting, descs, { size: 12 })` then works in one of two modes:
   - **static mode** (≤ 12 descriptors): one permanent light per descriptor, created in order. A
     small level looks exactly as it did with hand-created lights.
   - **pooled mode** (> 12): every 0.2 s the pool hands its 12 lights to the best-scoring
     descriptors. Only descriptors whose light sphere (range + 4 u margin) touches the camera
     frustum take part. The score is distance to the focus plus `priority × 1.5`
     (`priorityWeight`), with a bonus of 2 for lights already lit (hysteresis) and a penalty of up
     to 10 for lanterns that are dark by day. A light that changes owner fades out and in again
     (0.35 s each way).

   `World.lights` holds the pool's handles. `World.update()` calls
   `lightPool.update(dt, { focus, camera })`.

> **Invariant.** The point-light count is fixed after the first frame: `min(12, light descriptors)`
> in the game (a level with 5 light descriptors has exactly 5 point lights, one with 30 has 12), always 12
> in the editor preview (the same `LightPool`, created with `fixed: true`). Adding or removing a light or toggling `light.visible` recompiles every
> lit shader. Fade intensities instead.

**Atmosphere** (`_buildAtmosphere`):

- `dust` (unless `environment.dust === false`): a 20 × 4.5 × 16 box of 120 motes that the game
  moves with the camera focus every frame;
- every `emitter` object: `createEmitter({ ...params, preset, bounds, count })` with `dy`
  (default 1.2, −5…30) above the ground, `size` default `[8, 2.4, 8]` (clamped), `count` default
  30 (1–1000); failures are logged and skipped; kept in `areaEmitters` (driven by the weather)
  and `emitters[id]`;
- god rays (unless `environment.godRays === false`): `environment.godRayAreas`, else one area
  over the walkable ground (`LevelLook.godRayLayout` / `autoGodRayArea`, shared with the editor: `computeCameraBounds(level, 1)`, the most common
  walkable height, `count = clamp(round(area / 90), 1, 6)`, seed 7); each area `count` 0–12
  (default 3).

### 4.5 Scenery: forest border, outer forest, outer ground

[`Scenery.js`](../../src/game/Scenery.js) makes the diorama read as part of a continuous world:

- `makeOuterHeight(tileMap)` — a height function that continues the map's edge heights, rolls,
  rises into northern hills and far mountain ridges, and gentle hills east / west / south.
- `scatterForest({ tileMap, heightAt, avoid, southGap, kindAreas, seed = 77 })` — deterministic
  placement: **border** trees on every tile whose legend char is `T` (none in the last 3 rows —
  shrubs only there —, one try per tile in the first 3 rows, two elsewhere; from row 9 on, the
  third column from the east / west edge stays open and the second gets 20 % lower trees, so no
  tall tree stands between the north-looking camera and a player walking along the edge) and
  **outer** trees (5200 random candidates in the band up to 34 u around the map: x from −34 to
  W + 34, z from −44 to D + 20.4, clustered by noise and thinning with distance). There are no
  outer trees in the `southGap` band south of the map, and none within 2.5 u of an *open* map
  edge (a run of 3 or more walkable edge tiles). The scatter also keeps clear of the level's own
  trees: each gets an avoid radius of 1.2 u (1.8 u when it stands outside the map), added to the
  new tree's own 0.85–1.5 u radius. Tree kinds follow `environment.forest.areas`
  (`forestKindAreas`, first matching area wins) or the automatic mix: half pines north of z = 6,
  half autumn trees where x > 0.72 W and z > 8, an oak / pine / birch mix elsewhere. Kinds never
  change positions: the random sequence is the same with or without kind areas.
- `mergeTrees(results, { name, castShadow, maxTriangles, maxExtent, minTriangles, tags })` — merges
  PropFactory trees per material into world space, folding each tree's sway phase into `aPhase`
  and transforming `aCenter`, so merged canopies billboard and sway exactly like separate ones.
  `tags` (result → live story group) puts each group's vertices next to each other in every
  batch and returns them as `ranges` ([§4.9](#49-live-story-groups-in-the-levels-batches)).
- `buildOuterGround()` / `outerGroundSteps()` — a fogged tensor-product heightfield (1 u spacing
  near the map, 2 u then 10 u farther out, extent 170) with a hole where the map is. The generator
  form lets the editor build it in time slices.

`World._buildTrees()` wiring:

| | Small level (≤ 64) | Big level (> 64) |
| --- | --- | --- |
| Level trees + border trees | one `mergeTrees` → `trees:map` | same, split by `treeTriangles 16000` / `treeExtent 96` |
| Outer trees | four quadrant groups `trees:outer:n/s/e/w`, `castShadow: false` (frustum culling skips what is behind) | one `trees:outer` group, k-d split into compact pieces |
| Outer ground | `buildOuterGround()` unless `environment.outerScenery === false` | same |

`environment.border === 'forest'` enables the border trees; `environment.outerScenery !== false`
the outer forest and ground; `environment.scenery.southGap` (default `SOUTH_GAP = 5`, `LevelLook.js`) keeps the
meadow south of the map open (the camera looks north).

### 4.6 Ground foliage (`GroundDetail.js`)

`buildGroundDetail()` scatters deterministic `Foliage` fields (one instanced draw call each):
`Foliage:grass` (tuft + tall grass strip), `Foliage:flowers` (red, yellow, white, blue),
`Foliage:reeds`, `Foliage:shrubs` (bush, fern, mushroom, small rock; the only field that casts
shadows). Placement is keyed on the **legend characters** of the built-in tiles:

| Tile char | Foliage |
| --- | --- |
| `g`, `G`, `f` (grassy) | tufts (3, or 5 in dense clumps), tall grass in clumps, flowers (3 per `f` tile, sprinkled elsewhere), shrubs (`shrubAreas` chance, default 0.05), mushrooms / pebbles |
| `T` (forest floor) | 2 tinted tufts per tile, shrubs with chance 0.55 |
| `s` (sand) | reeds next to water, pebbles elsewhere |
| `F` (farmland) | a few weeds |
| `d`, `.` (dirt, path) | sparse tufts |
| `m` (mossy stone) | occasional ferns / pebbles |

Extras: bushes along house walls (not in front of doors), ferns around trees on the map, and
**clearings** around every NPC (radius `min(8, max(0, wander)) + 0.8`) where only short grass
grows. Spots under colliders are rejected by `World._isFreeForFoliage`, a collider-grid query
with 0.1 u around circles and 0.15 u around boxes — and around the colliders of every live story
group absent at build (a house, a well, a crate that may come later: no grass pokes through it).
So a story house, windmill or well that is absent leaves a bare footprint, and a house its wall
bushes (the foliage is scattered once, at the build). It runs before any NPC exists, so villagers' colliders play no part. The `T`, `F` and `m` scatters skip this test. `environment.foliage`
supplies `seed` (default 2024), `flowerAreas` (tile rects with a palette of frames 0–3) and
`shrubAreas` (tile rects with a `chance`). Big levels cap a field at `foliageInstances` (4000) per
instanced mesh (k-d split; placement unchanged).

> Custom legend characters get **no foliage** and a custom blocked-forest character gets **no
> border trees**, because both are keyed on `g G f T s F d . m`.

### 4.7 Snow cover (`SnowCover.js`)

`addSnowCover(material, 'ground' | 'foliage')` chains an extra `onBeforeCompile` step after the
material's own patch and appends `|luminati-snow-<kind>` to its program cache key. The shared
uniform `snowCover.value` (0–1) whitens up-facing surfaces (`'ground'`) or frosts the upper part
of foliage sprites (`'foliage'`). Programs are built once at load with the uniform always present,
so snowfall never compiles anything. The weather drives the value ([§9](#9-weather--time-glides-and-weather-blending)).
The editor's 3D preview installs the same patches as its materials are created
(`addGroundSnowCover(root, { roofsOnly })` for terrain and prop roofs, `addSnowCover` for the
outer ground and the foliage fields — [EDITOR.md §10](EDITOR.md#10-how-the-editor-stays-in-sync-with-the-game)),
so a weather change there never compiles anything either.

### 4.8 Small and big levels

`World.isBigLevel(level)` (`max(width, depth) > 64`) switches on `BIG_LEVEL_BATCHING`. Levels up
to 64 × 64 must render exactly as they were tuned (Emberfall, Brightwater Crossing, the sample
hamlet).

| Budget (`BIG_LEVEL_BATCHING`) | Value | Used by |
| --- | --- | --- |
| `terrainChunk` | 32 | `buildLevelTerrain` chunk size (small levels: 64) |
| `terrainTriangles` / `terrainExtent` / `terrainMinTriangles` | 48000 / 48 / 12000 | `TileMap.consolidateChunks` |
| `propTriangles` / `propExtent` | 16000 / 64 | `mergeStatic` split |
| `treeTriangles` / `treeExtent` | 16000 / 96 | `mergeTrees` split |
| `minTriangles` | 3000 | batches lighter than this are not extent-split |
| `casterTriangles` / `casterExtent` | 96000 / 64 | shadow-only proxies (`ShadowCasters`) |
| `foliageInstances` | 4000 | `GroundDetail` `maxInstances` |
| `shadowUp` / `shadowDown` | 60 / 45 | `LightingSystem.setShadowDepthRange` (set by `Game`) |
| `particleCull` | 34 | particle areas / smoke / mist farther than this from the focus are disabled |

Game-side big-level extras: far-actor throttling ([§6.4](#64-far-actor-throttling-big-levels)),
`BlobBatch` (every contact shadow in one instanced draw), sprite shadow quads drawn in the shadow
pass only (`makeShadowOnly`). Measured budgets and trade-offs:
[PERFORMANCE.md](PERFORMANCE.md).

### 4.9 Live story groups in the level's batches

A level played with a story builds the props of `LIVE_STORY_TYPES` that carry a `when` / `unless`
— every prop type but the combat ones, houses, windmills, wells and waterfalls included — and its
particle areas as **story groups**, one per condition pair (`_storyGroupOf`;
[STORY_SCRIPT.md §9.5](../specs/STORY_SCRIPT.md#95-objects-that-come-and-go)). Their meshes cost
no draw call of their own:

- **Merged with everything else.** A story prop's `PropResult` goes into `results` (a tree into
  the `trees:map` merge) like any prop's, and `_storyTags` maps it to its group. `mergeStatic` and
  `mergeTrees` take that map as `tags`: the batches — per material, cut by the same k-d split on
  a big level, with the same shadow-only proxies — are the ones the level would get without the
  conditions; within each batch and proxy a group's vertices lie next to each other
  (`SpatialSplit.groupByTag`, the untagged ones first in their order), and the merges return
  where (`ranges`: one range per group and batch). A level without story conditions takes the old
  path untouched (`tags: null`; its batches are byte-identical).
- **`World.storyRanges`** (`SpatialSplit.CollapsibleRanges`) holds those ranges with a copy of
  their values. A group that is absent — at build, before anything is uploaded, or later in
  `applyStory` — has every vertex of each range written onto the range's first vertex in the
  attributes that place it (`position`; a tree batch also `aCenter`, `aSway`, `aPhase`, or the
  sway would pull the triangles open again): every triangle is degenerate, so nothing is drawn in
  the colour pass or the shadow pass (which draws the same geometry; a big level's proxies have
  ranges of their own). Coming back copies the saved values in. Only the range is uploaded
  (`BufferAttribute.addUpdateRange` + `needsUpdate`). The collapsed point is one of the group's
  own vertices, so bounding spheres and boxes (and the `cullByBox` boxes) stay valid.
- **What stays per group:** the props' own roots (`objects`: what the merge leaves there — flame
  billboards and glows, wind-swayed, animated or mirrored meshes, a windmill's sails, a
  waterfall's sheet and foam pool) are hidden with `visible`, and their `update` (the sails) is
  skipped while the group is absent; colliders, walk surfaces, prompts (doors, wells, signs),
  particles (smoke, embers, mist, particle areas), campfires, waterfalls (`fallAnchors`, `hidden`),
  lamps (`LightPool.setHidden`) and map markers as described in
  [§3.10](#310-the-story-runtime). A house's windows and lantern glass glow through shared
  emissive materials, drawn only by the house's own (collapsed) vertices: an absent house does not
  glow, and nothing is registered or released.

No mesh, material, program or light is created or removed by a change. Measured (2026-10-07,
Gildhaven with every second of its 333 live props given `when: sa` / `when: sb`, at the spawn):
175 draw calls with both groups present, one or none — the same as the level without conditions
(before: 212 / 190 / 170, each group merged on its own); the demo campaign's Mill Road ford
draws 98 calls with the bridge or with the debris (before: 95 / 105). Collapsing or restoring a
group of ~45 000 vertices takes 0.1–0.2 ms; a whole `applyStory` there takes 0.9–1.9 ms (before:
0.5–1.6 ms), and the next frame's upload adds ~0.1–0.3 ms. Mill Road's toggle stays at ~6–7 ms,
the shore re-bake on the main thread. An absent group's degenerate triangles still pass through
the vertex shader — cheap for the props that stand alone.

Houses, windmills, wells, waterfalls, critters and particle areas (2026-10-07): Emberfall with its
inn (a door lantern), windmill, well, both waterfalls, chickens and two particle areas `unless:
gone`, two lit houses, the cat and the leaves `when: built` (`sandbox/story.presence.json`) draws
exactly what the level without conditions draws — the same 188 draws in the colour, shadow and
post passes by object and material, the same triangles, 12 lights, 57 programs, day and night —
with everything there; with `gone` set the draws lose only the waterfalls' sheets and pools, the
sails' shadow draws, the inn's smoke, the mists and the two areas (175), and coming back restores
the geometry, colliders, prompts, emitters, falls, lamps and markers byte for byte (one
`applyStory` 0.1–0.3 ms). Gildhaven with its 87 objects of these types split into `when: sa` /
`when: sb`: 201 draws with both groups there (as without conditions), 194 with one, 182 with
none (10 shadow-proxy draws throughout), 59 programs and 12 lights throughout; `applyStory`
0.4–0.7 ms, but a change of a painted type (a house) repaints the maps: ≈ 30–45 ms on its
128 × 128 map, once per change (as a bridge or a tree does).

---

## 5. `Player`

[`src/game/Player.js`](../../src/game/Player.js) is the traveler: `createCharacterSheet({
...CHARACTER_PRESETS.traveler, preset: 'traveler' })`, drawn as a `Sprite3D` with
`CHARACTER_SPRITE_OPTS`, starting at `level.spawn` and facing its `facing`.

| Aspect | Implementation |
| --- | --- |
| Movement | `input.getMoveVector()` (keys + left stick) → world XZ through `rig.getMoveBasis()` (camera-relative). Walk 3.2 u/s, run 5.6 u/s (`run` action), scaled by stick magnitude. |
| Collision | `tileMap.move(position, dx, dz, RADIUS 0.3, maxStep 0.55, out)` — walkability, step height (stairs only enter where heights connect), walk surfaces, colliders (pushed out), map bounds, sliding (full → x-only → z-only). |
| Height | `tileMap.getHeight(x, z)` (stairs ramps, walk surfaces / bridge arches) followed smoothly: `damp(22)` going up, `damp(16)` going down. |
| Facing | 4 directions from the screen-space movement (`sprite.faceVector`); `facing` keeps the world vector for interaction tests and is re-applied while idle so Q / E orbits keep the sprite facing what the prompt refers to. |
| Animation | `walk` / `run` with playback speed from the actual speed (so pushing into a wall walks slowly in place); `idle` at `IDLE_SPEED[0] + 0.04`. |
| Footsteps | `onFrameChange` on frames 0 and 2 of walk / run plays the `step` sfx (volume 0.4 walking, 0.55 running). Its pitch depends on the ground: any walk surface such as a bridge deck 1.25, `cobblestone` / `stone_tiles` / `moss_stone` tops 1.1, `sand` 0.85, anything else 1. Every other step is 6 % lower. Running also bursts 4 `footstep` dust particles. |
| X-ray silhouette | a pale copy of the sprite quad (`MeshBasicMaterial`, `depthFunc: GreaterDepth`, `renderOrder 60`, vertices pulled 1.3 u toward the camera) that draws only where walls, roofs or canopies hide the player. It writes its own depth so the DOF keeps it sharp. `setSilhouetteEnabled(false)` on the title screen changes render states only (no recompile); `setSilhouetteLevel` dims it at night. The villager the player can talk to (the *Talk* prompt's, kept while talking) gets the same silhouette — one more mesh of the same program, moved from villager to villager by `Player.setTalkSilhouette(sprite)`, a draw call only while there is one — so a keeper behind a stall's awning shows (KNOWN_ISSUES PROP-13). |
| Combat levels (`combat: true`) | The sheet is `createCharacterSheet({ ...traveler, weapon: 'sword' }, { combat: true })` (18 columns: the 6 locomotion frames plus the combat poses) and the sprite uses the `combatFx` program (hit flash, glow). `action` (a string while the combat core owns the sprite: `update` then only follows the ground and returns before any `play` / face / speed write), `faceOverride` (a unit vector the sprite faces while walking or standing — lock-on strafing, the walk cycle instead of run), `moveOverride` (a world-space move vector replacing the input's — automation), `speedMul` (1), `moveBy(dx, dz)` (`tileMap.move` with radius 0.3, max step 0.55; returns the fraction moved — lunges, rolls, knockback, separation). On peaceful levels all of this stays unused and the player is exactly as above. |

---

## 6. `Npc` — villagers

[`src/game/Npc.js`](../../src/game/Npc.js). `npcDef(obj)` (a module function in `Game.js`) turns a level `npc` object into a
definition: `name` (default "Villager"; `unnamed` set when the level gave none, so the plate shows
`t('game.default.villager')` — `villagerName`), `preset` (unknown → `villager`), `spec` (the object's
hand-written sprite overrides, when it is an object), `home`, `wander`
(default 1.2), `speed`, `facing`, `behaviour`, `talkRadius` (≥ 0.5), `talkPoint` (from the
relative `talkOffset`, or the legacy absolute `talkPoint`), `bounds` (from the relative `area`, or
the legacy absolute `bounds`) and `portraitColor` (default `#c9a45c`). Loaded levels are already
normalised, so missing fields carry the **catalog defaults** (`ObjectCatalog` npc defaults: speed
1, wander 1.2, facing down, behaviour wander, action none…) and legacy absolute fields have been
converted to the relative ones; `npcDef`'s own fallbacks only apply to un-normalised input
(they match the catalog: speed 1 — `npcDef` and `Npc` fell back to 1.3 before 2026-10-07).
`npcDef` also carries `titleKey` (`textKeyOf(obj, 'title')`, the key of the villager's `title`;
absent without one): its title, like its dialogue pages and talk script, is looked up by the keys
its own object holds, also while its level is set aside and attached again.

### 6.1 Common mechanics

- Sheets are cached per `{ preset, ...spec }` (`sheetCache` shared by all NPCs). `npcDef` passes
  an npc object's hand-written `spec` (since 2026-10-07; before, the game ignored it and only the
  editor preview drew it — see [EDITOR.md §10](EDITOR.md#10-how-the-editor-stays-in-sync-with-the-game)),
  so NPCs share a sheet when their preset and `spec` match. No shipped level has a `spec`.
- Each NPC owns a **dynamic** circle collider (r 0.34) that follows it — the TileMap tests
  dynamic colliders on every query instead of gridding them, and they never carve the water shore.
  Its own collider is parked at `x = Infinity` while it moves (`_withoutSelf`), since the TileMap
  push-out uses `c.r + moverRadius`.
- Movement: `tileMap.move(p, …, RADIUS 0.3, 0.55)`; height follows with `damp(18)`.
- Randomness per NPC: `new RNG(hashString(id))` — deterministic. Idle speed in
  `IDLE_SPEED` (0.5–0.62) so villagers do not breathe in lockstep.
- **Yielding:** a walking NPC stops when the player is within 1 u ahead of it.
- **Stuck detection:** moving less than 25 % of the step for 0.4 s ends the walk.

### 6.2 Behaviours (`behaviour`)

| Behaviour | Loop |
| --- | --- |
| `wander` (default) | Idle 2.5–6.5 s (glancing at the player every 0.4 s within 2.4 u, which also delays leaving), then walk up to 6 s to a random walkable point 0.4…`wander` u from home (6 tries, else home). `wander ≤ 0.2` never walks. |
| `post` | Stand at home (walk back if pushed more than 0.15 u); face the player within 2.2 u; otherwise look around every 2.5–5 s (`down / left / right / home facing` ×2). |
| `perform` | Like `post`, but looks mostly down (`down, down, left, right`) — the bard at the campfire. |
| `chase` | Idle, then pick a random chicken inside its chase bounds ± 2 u. The chase bounds are the relative `area`, or the square of `max(0.5, wander)` around home. When no chicken is near, it retries every 1 s. It runs after the chicken (2.6 u/s, run animation, target clamped to the bounds) for 2.5–4.5 s, or until within 0.55 u or stuck, then idles 0.8–2.2 s. Chasing villagers are also "threats" the chickens flee from. |

### 6.3 Talk state

`beginTalk(px, pz)` sets `talking`, plays idle and faces the player; `endTalk()` resumes after
1.2–2.5 s. While `talking`, behaviours do not run (the height and collider still follow).
`npc.talk` is the conversation function from `conversationFor(obj)` ([§8](#8-dialoguejs--conversations-and-built-in-actions)).

### 6.4 Far-actor throttling (big levels)

Only when `world.batching` is set: NPCs farther than `max(42, 1.15 × rig.distance + 4)` from the
camera focus (`FAR_ACTOR_DISTANCE`) update every 4th frame (`FAR_EVERY`, staggered by index) with
the accumulated time capped at 0.25 s; a talking NPC always updates. Critters use the same rule
(`critters.throttle`). Small levels keep exact per-frame behaviour.

---

## 7. `Critters`

[`src/game/Critters.js`](../../src/game/Critters.js) spawns one group per `critters` object
(`kind`, `count` 0–16, `x, z`, `radius` roam radius — catalog defaults chicken / 4 / 2.5 —, optional relative `area` /
`spotOffsets`, legacy absolute `bounds` / `spots`, `seed`, `seedBase`, `speed`). Placement:

- The first animals take the exact spots.
- The rest scatter over the yard with the group's seeded RNG, with up to 6 tries onto walkable
  ground. The yard is `area`, else `bounds`, else the square of `radius`.
- A group of one without spots stands at `(x, z)`.
- `TileMap.isWalkable` already includes the villagers' dynamic colliders at this point, because
  NPCs are created before critters.

A group that throws is skipped with a warning.

| Kind | Class | Speed / radius | Behaviour |
| --- | --- | --- | --- |
| `chicken` | `Chicken` | 0.8 / 0.15 | Peck (idle), short walks inside the yard; flee (3.4 u/s for 0.5–0.8 s) from any threat within 1.7 u — the player and `chase` villagers. |
| `cat` | `Cat` | 1.1 / 0.18 | Idle 3–8 s looking at the player within 2 u, then walk to a walkable point within `radius` of home. Ginger coat. |
| `dog` | `Cat` | 1.3 / 0.22 | Same as the cat, default creature colours. |
| `bird` | `Bird` | 0.9 / 0.1 | Hops 0.5 u at a time, pulled back when a hop would leave the group's `radius` around home. It takes flight when the player is within 2.3 u and fades out while rising. It stays away 9–15 s, then lands again once the player is more than 5 u from home. No sun shadow. |

Critter placement lives in the engine: `Critters._spawnGroup` starts the animals at
`ObjectCatalog.critterStartPoints(g, (x, z) => tileMap.isWalkable(x, z))` and keeps chickens in
`critterYard(g)` (else the `radius` square) — the same functions the editor uses to show the
animals where the game spawns them, so a change to the placement rules reaches both (one copy
since 2026-10-07; the start positions on Emberfall, Starfall Vale, Gildhaven and Willowmere were
checked identical).

A group with a story condition (`when` / `unless`) is one of `Critters.storyGroups` and follows
the story live ([STORY_SCRIPT.md §9.5](../specs/STORY_SCRIPT.md#95-objects-that-come-and-go)):
`applyStory(present)` (called by `StoryRunner.applyPresence`; a level without a story never calls
it) marks an absent group's animals `absent` — hidden, skipped by `update` (they stand still, the
far-critter throttle too) and taken out of `chickens`, the array the `chase` villagers read (one
array, changed in place; a villager chasing one gives up) — and puts a group that comes back at its
start points (`Critter.reset`: idle, shown, a bird landed). The critters are not on the minimap
either way.

---

## 8. `dialogue.js` — conversations and built-in actions

A conversation is `async (ctx, obj) => void` with
`ctx = { say(lines, opts?), toast(text), sfx(name), visits, game, npc }` and `obj` the level NPC
object.

- **`CONVERSATIONS`** — Emberfall's hand-written scripts, keyed by the npc `script` id:
  `elder`, `innkeeper` (rest), `merchant` (apples), `guard`, `farmer`, `child`, `bard` (music),
  `scholar` (explains the controls), plus the combat **`drillmaster`** (Cinderwatch's Captain
  Maren): on a combat level it explains the combat keys (keyboard or pad keys by
  `input.lastDevice`), asks for a full 3-hit combo on a dummy and one dodge
  (`combat.tutorial`), rewards 2 Healing Draughts once both are done (`combat.rewardTutorial()`),
  and speaks two post-victory pages once the boss has fallen; on a peaceful level it plays the
  NPC's own `dialogue` pages. And the combat **`shopkeeper`** (Bram, Odo): on a combat level its
  `dialogue` pages (all on the first visit, then the last page only, with *Tell me again* last in
  the menu to replay the others), then a menu as a dialogue choice — *Nothing more* first (mashing
  confirm never buys), then every ware not sold out with its gain and price, marked
  *(not enough)* when the gold does not reach (`combat.shopOffers()`) — repeated after each
  purchase until *Nothing more*. The menu line shows the gold, ATK and DEF; a bought upgrade's
  toast shows the change (`Obtained: Whetstone — ATK 20 → 22`); while enemies are engaged it
  refuses ("Not with foes at your heels!…"). On a peaceful level it plays the NPC's own dialogue
  and action. The ids must match `ObjectCatalog.NPC_SCRIPTS`.
- **`levelConversation(obj)`** — every other NPC: its `dialogue` pages (strings or `{ text,
  choices }`) followed by its built-in `action`:

| `action` | Behaviour |
| --- | --- |
| `none` (default) | Just the pages. `…` shows only when the list is empty or blank. A normalised NPC without a `dialogue` key gets the catalog default `Hello, traveler!`. |
| `rest` | Appends "Will you rest until morning? [Not yet / Rest until morning]" unless the pages already end with a choice; any answer but the first runs `game.restUntilMorning()` — with a one-choice closing page of the designer's own, its only answer runs it. |
| `shop` | Appends "Would you like the `<item>`? [Just looking / Yes, please]" unless the pages already end with a choice; any answer but the first adds `inventory[item.toLowerCase()]`, plays `chime` and toasts "Obtained: `<item>`" (the item a term; a blank item keeps the identity "Crisp Apple" in the inventory and is shown as `t('game.default.item')`, looked up only for the shop action); with a one-choice closing page of the designer's own, its only answer runs it. On a combat level an item the combat system sells (`combat.priceOf(item)`: the Healing Draught, 25 gold, or a ware of `SHOP_WARES` by name) is bought instead: the question reads "Would you like the Healing Draught? (25 gold)" and "Yes" calls `combat.buy(item)` (toast "Obtained: Healing Draught", "Not enough gold", "You cannot carry more" or "Not for sale" for a one-time ware already bought). |
| `music` | Silent → the music starts (toast "♪ Music"). Already playing → "Another song, or a little quiet? [Keep playing / Some quiet]", the second answer stops it. With the designer's own closing question, any answer but the first — or the only answer of a one-choice page — plays the music and never stops it. |

- A `{ text, choices }` page with **at least one** non-blank choice is a choice page; blank or
  whitespace-only choices are dropped, and a page left without choices shows as plain text. A
  single choice (the editor's `Ready? [Okay |]`) shows as a one-item choice list. A one-choice
  closing page counts as "ends with a choice", so no built-in question is appended, and its only
  answer (index 0) runs the action (`firstYes` = 0 instead of 1).
- **Text** ([I18N.md §4.8](../specs/I18N.md)): everything a conversation hands `say` / `toast` is
  already translated — its own lines as code keys, `loc('dlg.<conversation>.<name>', 'English')`
  (sentences with values are whole templates filled after the lookup, `contentFormat`); a level
  villager's pages and choices by the keys its object holds over `dialogueUnits`' raw indices
  (`showPages(units, obj)`: `dialogueKeyOf(obj, i)`, `choiceKeyOf(obj, i, j)` per choice; a page
  without a key in English, a `nokey` miss); the combat shop's wares by the
  labels `combat.shopOffers()` gives (`label`, `gainLabel`). Game and StoryRunner translate only the
  speaker.
- **`conversationFor(obj)`** — the script when `script` names one (called as `script(ctx, obj)`;
  an unknown script logs a warning and falls back to the dialogue), else `levelConversation(obj)`.
- Convention: the non-committal answer comes **first**, so mashing confirm through the text never
  triggers an action. A one-choice closing page has no such answer: mashing confirm through it
  runs its action by design (use two choices, non-committal first, when the player should be able
  to decline).

---

## 9. `Weather` — time glides and weather blending

[`src/game/Weather.js`](../../src/game/Weather.js) is updated from `Game.update` after the lighting
system (which recomputes its palette every frame), so everything it multiplies never accumulates.
The weather *look* — the table below, the precipitation emitter configs and the functions that
apply a weather state (lighting multipliers, overcast colours, grade offsets, wind, lamp and window
day glow, lantern-glass level, particle-area intensities) — lives in
[`src/game/WeatherLook.js`](../../src/game/WeatherLook.js), shared with the editor's 3D preview,
which shows a level's `environment.weather` at its settled values
([EDITOR.md §10](EDITOR.md#10-how-the-editor-stays-in-sync-with-the-game)). `Weather.js` keeps the
time glides, the blending, the debug `tuning` and the time-of-day parts (golden-hour god rays,
night desaturation, calmer water and fewer leaves at night, snow settling / melting).

- **Time.** `setTime(h, { duration })` jumps, or glides forward (never backward) with a
  smoothstep over `duration` seconds; `cycleTime()` uses `TIME_PRESETS` with a 2 s glide.
- **Weather.** `setWeather('clear' | 'rain' | 'snow', { instant })` (other names are ignored — an
  own-property test, so e.g. `'toString'` is too); `update()` blends `WEATHER_PARAMS`
  (`WeatherLook.js`, frozen) with `damp(1.1)`. `instant` jumps (used for a level's starting weather).
- **Rooms.** `setWorld` reads the level's `environment.interior` (`indoors`): in a room the look
  blends toward clear skies (`shown`, `LevelLook.shownWeather` — no rain or snow drawn, no snow
  settling, no overcast grey, the clear wind, fog and grade) while `weather` goes on — R
  (`cycleWeather`, toast "… outside"), `setWeather` and a campaign's save change and keep it, and it
  shows again in the next level outdoors. `instant` jumps to what is shown. The water's base
  brightness and glint are read once per world (`World.waterBase`): a level set aside and attached
  again has the night-scaled values in its uniforms.

| Parameter | clear | rain | snow | Drives |
| --- | --- | --- | --- | --- |
| `sun` / `ambient` / `exposure` | 1 / 1 / 1 | 0.26 / 0.9 / 0.92 | 0.45 / 1.15 / 1.04 | `lighting.settings.*Mul` × `tuning` |
| `fog` | 1 | 2.1 | 1.9 | `fogMul = tuning.fogMul (2.0) × fog × zoomFog × environment.fogScale` |
| `wind`, `windX`, `windZ` | 1, 1.0, 0.35 | 2.3, 2.2, 0.9 | 1.3, 1.2, 0.5 | `globalUniforms.uWindStrength`, `uWind` |
| `temp`, `sat` | 0, 0 | −0.12, −0.24 | −0.3, −0.42 | grade temperature / saturation (night also removes 0.22 saturation) |
| `rays` | 1 | 0 | 0.25 | god-ray intensity × a golden-hour / dawn curve |
| `dust`, `bugs`, `leaves` | 1, 1, 1 | 0.15, 0, 1.6 | 0, 0, 0.3 | particle-area intensities by preset (`fireflies`, `leaves` thinning at night, `petals` off in rain / snow, `dust`, `smoke`, `mist`) |
| `rain`, `snow` | 0, 0 | 1, 0 | 0, 1 | the camera-following `rain` (2600 drops, 44 × 16 × 44 box) and `snow` (2400 flakes, 44 × 15 × 44) emitters (`precipitationEmitter`), created at load with intensity 0; below 0.02 they draw nothing |
| `overcast` | 0 | 0.72 | 0.62 | greys fog, sun, hemisphere colours toward a cool grey of the same luminance |

Also per frame: lanterns (`nightOnly` lights and the pool's `nightDayIntensity`) glow
`lerp(0.05, 0.45, overcast)` by day; window emissives rise toward `night × 0.4` under an overcast
sky; the lantern glass albedo dims while the lamps are unlit; water brightness and glints calm
down at night; **snow cover** settles at 1/15 per second while it snows and melts at 1/8 per
second otherwise. `tuning` holds the debug panel's base values; `factor(key)` exposes the blended
values (used by the audio director).

---

## 10. `AudioDirector` — the ambience mix

[`src/game/AudioDirector.js`](../../src/game/AudioDirector.js) recomputes the mix every 0.25 s
(when `enabled`, i.e. in gameplay) and hands it to `audio.setAmbience(levels, { fade: 0.6 })`:

| Channel | Formula (clamped 0–1) |
| --- | --- |
| `wind` | 0.28 (+0.12 above y 3) + 0.55 × storm |
| `birds` | (1 − night) × (1 − 0.85 storm) × 0.75 |
| `crickets` | smoothstep(0.35, 0.9, night) × (1 − storm) × 0.8 |
| `fire` | (1 − smoothstep(2, 15, distance to the nearest campfire))^1.5 × 0.9 |
| `water` | max((1 − smoothstep(1, 11, d_water)) × 0.55, (1 − smoothstep(3, 20, d_fall)) × 0.95) |

`storm = rain + snow` (weather factors). Water distances use the centre of every water tile
(packed in a `Float32Array`, no garbage) and the foot of every splashing waterfall.

---

## 11. Tunables and helpers

### 11.1 `config.js`

| Export | Value | Meaning |
| --- | --- | --- |
| `CAMERA` | `{ distance: 30, pitch: 32, fov: 28, minDistance: 18, maxDistance: 42 }` | Gameplay framing defaults (per-level override: `environment.camera`). Also the editor's "game camera". |
| `TIME_SPEED` | `1 / 90` | Game hours per real second (one hour ≈ 90 s). |
| `SUN_PATH` | `{ noon: 12.6, lat: 32, dec: 14, refTime: 17.2, refAzimuth: −112 }` | Golden hour puts the sun ~25° up, behind-left of the default view. |
| `MOON_PATH` | `{ refAzimuth: 40 }` | The moon keys the night from the front-right. |
| `KEYFRAME_OVERRIDES` | night / late night / blue hour / sunset / purple dusk / golden hour | Bluer, brighter nights; lifted dusk; teal golden-hour shadows. Merged over `DEFAULT_KEYFRAMES` by name. |
| `CHARACTER_SPRITE_OPTS` | `normalUp 0.6, wrap 0.6, roundness 0.55, emissive #ffe9d2, emissiveIntensity 0.06` | Shared look of every character / critter sprite (readable when backlit). The game and the editor register every such sprite with `registerEmissive(…, SPRITE_FILL)`, which rewrites `emissiveIntensity` at once and every frame: the 0.06 only lights unregistered sprites (the `combat_fx` / `enemy_ai` sandboxes). |
| `SPRITE_FILL` | `{ day: 0.05, night: 0.03 }` | `registerEmissive` levels of that fill. |
| `IDLE_SPEED` | `[0.5, 0.62]` | Idle "breathing" playback speed range. |

`Game.js` constants: `INTERACT_RANGE 1.6`, `FAR_ACTOR_DISTANCE 42`, `FAR_EVERY 4`,
`TALK_COOLDOWN 0.8`, `WARM_FRAMES 5`, `AUTO_BOUNDS_MARGINS`. `World.js`: `MAX_POINT_LIGHTS 12`,
`BIG_LEVEL_BATCHING`; `LevelLook.js` (shared with the editor's preview): `SMOKE`, `MIST`,
`SOUTH_GAP 5`, `SMALL_LEVEL 64`, `BIG_FOLIAGE_INSTANCES 4000`, `DUST_BOX` 20 × 4.5 × 16, the level's
camera framing (`cameraFraming`). The diorama post look is set
in `Game._tunePost()` (DOF focus range 6, max blur 13, tilt-shift 0.42; bloom 0.5 / threshold 1.05;
grade saturation 1.3, vignette 0.55, teal shadows `[−0.04, 0.05, 0.15]`).

### 11.2 `ResolutionGovernor`

1. **Pixel budget**: whenever the canvas size changes, `engine.maxPixelRatio =
   min(1.25, √(2.1 MP / (width × height)))` — a 2560 × 1440 window renders at ≈ 1930 × 1086.
2. **Dynamic resolution** (needs `EXT_disjoint_timer_query`; `postfx.enableTimings(true)`): every
   0.5 s the summed PostFX GPU timings are sampled; decisions use the median of the last 5
   samples. Median above 13.5 ms for 4 samples (2 s) → `renderScale − 0.1` (not below 0.7); below
   8.5 ms for 20 samples (10 s) → `+ 0.1`; 3 s cooldown after a step (2 s at start). Each step
   reallocates the render targets (a one-off hitch). `manual = true` (the debug panel's render
   scale) disables it; the pixel budget still applies.

### 11.3 `DebugControls.js`

See [§3.8](#38-debug-panel-and-automation-hooks). Controllers that also change from gameplay use
`.listen()`; the panel calls `syncListening()` so hidden panels cost nothing.

### 11.4 `AtmosphereFog.js` — fog that starts in front of the player

`installFogStart()` replaces three's global `fog_vertex` chunk with
`vFogDepth = max(0, -mvPosition.z - uFogStart.x)` (and declares `uniform vec2 uFogStart` in
`fog_pars_vertex`), so FogExp2 starts `uFogStart.x` units from the camera. The band around the
player stays crisp and saturated; everything beyond melts into the horizon colour. It affects every
material that uses the standard chunks (including particles). The patch is global and installed
once per page (tagged; later calls only set the value), and must run before the first material
compiles. The editor does not install it.

The start itself is the shared uniform `globalUniforms.uFogStart`
([render.md §2](modules/render.md#2-globaluniforms)): `setFogStart(start)` writes it, and
`Game._applyLevel` calls it with `camera.distance − 7` (23 for the default framing) — in the
constructor and on every `swapLevel`, so each level of a campaign fogs from its own camera
distance (the cellar of the demo campaign, distance 20, from 13). A change takes effect in the
next frame and compiles nothing: three's built-in materials reach the uniform through
`THREE.ShaderLib` (and `THREE.UniformsLib.fog`), the engine's fogged `ShaderMaterial`s reference
it themselves. `installFogStart(start)` with an argument (the combat FX sandbox) also sets it.

---

## 12. Invariants and gotchas

- **At most 12 point lights, all created before the first frame** (`min(12, descriptors)`).
  Never add / remove lights or toggle `visible` at runtime; use intensities or the `LightPool`.
- **New materials must be warmed at load.** Anything that first appears mid-game (a new particle
  preset, a burst, a weather effect) must be compiled during `init` against
  `postfx.sceneTarget`, or it hitches. Follow the pattern of the far-below bursts.
- **Small levels must not change.** Code paths for big levels are gated on `world.batching`;
  Emberfall, Brightwater Crossing and the sample hamlet must keep identical draw calls, triangles
  and light lists. Fingerprint them before and after
  ([TASK_PLAYBOOKS.md §16](../ai/TASK_PLAYBOOKS.md#16-regression-check-before-you-finish)).
- **Determinism.** Placement and looks use seeded `RNG` / `hashString` / `fbm2`. Only transient
  effects use `Math.random()` (dialog blip pitch, waterfall spray jitter).
- **Hand-edited levels are sanitised, never trusted.** Numbers are clamped (lights, particle
  areas, critter counts), bad objects are skipped with a console warning, an unstandable spawn is
  moved. Keep that robustness when adding fields.
- **Conversation scripts are code.** A new `script` id needs an entry in `CONVERSATIONS` *and* in
  `ObjectCatalog.NPC_SCRIPTS` (the editor's dropdown); its lines are code keys
  (`loc('dlg.<conversation>.<name>', 'English')`, both literal — the checker extracts them).
- **Text is translated at display, by key.** Prose shown from data goes through `loc(key, english)`
  with the key the object shown holds, read with `ContentKeys.js`' readers (`textKeyOf`,
  `pageKeyOf`, `dialogueKeyOf`, `choiceKeyOf`, a node's `tk`); names through `term(name)`; defaults
  for blank data through `t('game.default.*')`. The data, interactables (`label`, `InteractText`)
  and saves keep the English. The game never makes or changes a key (`TextKeys.js` stays out of
  its chunks). A new display site reads the key the extractor lists
  ([TASK_PLAYBOOKS.md §27](../ai/TASK_PLAYBOOKS.md#27-add-a-display-site-or-a-translatable-field)).
- **`Weather` owns the multipliers.** Do not write `lighting.settings.*Mul`, grade temperature /
  saturation or particle-area intensities elsewhere — edit `weather.tuning` instead. A change to
  the weather look itself belongs in `WeatherLook.js`, so the editor preview follows.

---

## 13. Extension points

| Task | Where | Notes |
| --- | --- | --- |
| A new hand-written conversation | `CONVERSATIONS` in `dialogue.js` + `NPC_SCRIPTS` in `ObjectCatalog.js` | Put the non-committal answer first; every line `loc('dlg.<name>.<line>', 'English')`, then translate it ([TASK_PLAYBOOKS.md §26](../ai/TASK_PLAYBOOKS.md#26-translate-or-fix-content-text-with-the-worklist)). |
| A new built-in NPC action | `levelConversation` + `NPC_ACTIONS` (catalog) | Document it in [LEVEL_FORMAT.md](../specs/LEVEL_FORMAT.md) and the contract (additively). |
| A new NPC behaviour | `Npc.update` switch + `NPC_BEHAVIOURS` | The editor preview shows NPCs idle only. |
| A new critter kind | `KINDS` in `Critters.js`, `CRITTER_KINDS`, a creature sheet | List it in both: `critterStartPoints` (shared by the game and the editor) reads `CRITTER_KINDS`. |
| A new weather | `WEATHER_PARAMS` + `WEATHERS` in `WeatherLook.js` (a precipitation config in `precipitationEmitter`), the toast label in `Game.cycleWeather`, the hand-written Weather lists of the editor's inspector (`ui/Inspector.js`) and Level settings (`ui/dialogs.js`) | Create its emitters in the `Weather` constructor and warm them in `Game.init`. The editor preview applies the look through `WeatherLook.js` by itself, but a new precipitation emitter must also be created and warmed in `Viewport3D._setAtmosphere` / `_warmWeatherFx`. |
| A new `environment` option | read it in `Game` / `World`, normalise it in `LevelFormat` | Make the editor preview honour it too ([EDITOR.md §10](EDITOR.md#10-how-the-editor-stays-in-sync-with-the-game)). |

Step-by-step recipes: [ai/TASK_PLAYBOOKS.md](../ai/TASK_PLAYBOOKS.md).

---

## 14. Known limits (from the review history)

- The first user gesture creates the `AudioContext`: one 90–126 ms frame when the title is
  dismissed (or on the first key with `?autostart=1`).
- The first time the debug panel opens costs one ~108 ms frame (lil-gui first layout).
- A teleport to a far, never-seen area of Starfall Vale can cost one ~53 ms frame (geometry and
  texture first use; no shader compiles).
- Each dynamic-resolution step reallocates the post targets.
- In lantern-lit places the night can read brighter than dusk.
- Houses can hide stretches of road from the north-looking camera; the x-ray silhouette keeps the
  player readable there.

More in [ai/KNOWN_ISSUES.md](../ai/KNOWN_ISSUES.md); measurements in [PERFORMANCE.md](PERFORMANCE.md).

---

## 15. Combat (combat levels only)

Binding contract: [contracts/COMBAT.md](../contracts/COMBAT.md) (rules, timings, interfaces,
automation). A level is a combat level when `levelHasCombat(level)`: `environment.combat === true`,
or the key is not `false` and the level has an `enemy` object (Cinderwatch Pass, the combat
fixture, editor play-tests with enemies). Every other level creates **nothing** combat-related:
`game.combat === null`, no combat sheet, program, binding, DOM or legend row — and the combat
modules are not even loaded (`Game.init` imports `CombatSystem.js` dynamically). Party companions
fight beside the player through `CombatSystem.addAlly` and `src/game/party/MemberCombat.js`
([contracts/COMBAT.md §28](../contracts/COMBAT.md#28-party-allies), [specs/PARTY.md §5](../specs/PARTY.md#5-companions-in-combat-party-combat)):
each enemy's update reads its target's view as `ctx.player` — the player's unless a companion drew it.

| File ([`src/game/combat/`](../../src/game/combat/)) | Role |
| --- | --- |
| `CombatSystem.js` | orchestration: `load()` (sheets, FX atlas, `FxQuads`, `GroundMarkers`, every enemy and the boss adds, the walk grid and the zones, `UI.useCombatUI` + `ui.enableCombat()`, the combat bindings — the engine's combat modules are imported from their own files, never through the barrel), the combat clock and sub-steps, the `CombatContext` of the enemies, hit resolution and damage, kills / XP / loot, boss signals and victory, separation, dormancy, engagement, the look, HUD values, labels, minimap dots, death and respawn, the shop (`buy`, `priceOf`, `shopOffers`), `state()`, `stats()` |
| `Nav.js` | the enemies' walk grid (0.5 u cells with their ground height; open = walkable, not open water, clear of static colliders and the map edge, outside the boss arenas) and a bounded, allocation-free A* string-pulled into waypoints; ≤ 2 searches per combat sub-step (`beginStep` / `spend`); `warm()` at load. `build(blocked)` remembers `blocked`; `buildRect(minX, maxX, minZ, maxZ)` recomputes only the cells a change of colliders or walk surfaces inside that world rect can reach (2 cells beyond it grown by 0.2 u) — cell for cell what a full `build` gives; `CombatSystem.rebuildNav(rect)` uses it after a story presence change (KNOWN_ISSUES STORY-04). The open cells are labelled by connected part on the first search after a build: a goal in another part fails at once, without a search (STORY-14; `stats.apart`, `stats.parts`, `connected(ax, az, bx, bz)`); `buildSteps(blocked, rowsPerStep)` is `build` as a step generator (the story's own grid, built ahead in idle time, `new Nav(tm, { defer: true })`) |
| `PlayerCombat.js` | the player kit: stats and levels, HP / MP / SP, the 3-hit combo (magnet, lunges, cancel windows), roll / backstep with i-frames and the perfect dodge, Whirl Slash / Ember Bolt / Radiant Nova, the Healing Draught, hitstun / knockdown, death |
| `CombatInput.js`, `bindings.js` | the 10 f input buffer (keyboard, mouse buttons, pad with LT skills, virtual presses), resume / respawn guards, lock tap / hold; the combat bindings, legends and the pad hint |
| `Targeting.js` | aim direction, soft target (auto-aim, melee magnet), lock-on inside the frustum, the lock and boss-framing camera focus |
| `Hitboxes.js`, `Projectiles.js` | hit shapes and the "one hit per tag" registry; the projectile pool (the height model: vy aiming, terrain and collider blocking, body bands, arcs) |
| `Pickups.js`, `Loot.js` | seeded loot rolls, coins / hearts / mana / draughts / upgrades with arcs, magnet and landing on standable ground |
| `Waystones.js`, `BossArena.js` | checkpoints (attune, rest), chests (discovery, open); the boss arena (ember wall, barrier, player clamp) |
| `CombatFx.js`, `Feel.js`, `CombatMusic.js` | named effects on `FxQuads`; hit-stop / shake / flash tables and the combat look; battle / boss music |
| `rules.js`, `hooks.js` | every player number and the shop's wares (`SHOP_WARES`); `window.__game.combat` ([specs/AUTOMATION_API.md §3.4](../specs/AUTOMATION_API.md#34-window__gamecombat-combat-levels-only)) |
| `Enemy.js`, `defs.js`, `ai/*` | the enemy actor (the shared state machine of COMBAT.md §7.4, telegraph / hazard helpers), its stats and the eight brains; the brain interface (`init`, `idle`, `engage`, `attack`, `stun`, `cancel`, `onHit`, `die`, `glow`, `update` for the boss) is the table at the top of [`ai/index.js`](../../src/game/combat/ai/index.js). Brains see only the `CombatContext` (plus pure helpers such as `aimVy`) and never import `Enemy.js`. Chasing and returning use the walk grid (`ctx.nav`, below); the old fade-and-snap home stays only as a last resort. |

**The combat clock.** `update(dt, active)` runs `n = ceil(dt·60 − ε)` sub-steps of `dt / n`; in each:
the input buffer, `PlayerCombat.step`, every non-dormant enemy's `update(h · enemyScale, ctx)`,
projectiles, then hits in a fixed order (player hitboxes vs enemies, player projectiles, enemy
hitboxes vs the player, enemy projectiles). A **hit-stop** freezes whole sub-steps (the victim's quad
jitters ±1/16 u); slow motion scales the player's / the enemies' time (perfect dodge, death, the
boss's death). `engine.time.timeScale` is never touched, so camera shake, particles, water, the
clock and the UI keep running. `active` is false on the title, in dialogs, with the map open and in
photo mode: nothing advances. The first active frame drops that frame's action edges and ignores
still-held keys until released (the resume guard); a respawn ignores edges for 0.25 s.

**Feel.** Hits land with hit-stop (4 f, A3 7 f, skills 3 f, +2 crit, +4 kill, ≤ 10 f), camera shake,
the enemy's white flash, knockback (by mass), a hit star or crit star, streak sparks, a damage
number and a panned hit / crit sound; the player's hurt adds a red flash, a vignette pulse and
knockback / knockdown. Grade and DOF offsets (`applyLook`, after `weather.update`) tighten the
DOF while engaged, redden the vignette on hurts and desaturate at low HP, on a perfect dodge and on
death. A perfect dodge also keeps the player invulnerable while the enemy slow motion lasts.

**Death and respawn** (the `restUntilMorning` pattern): HP 0 → the `down` pose, slow motion, the
music fades, enemies go home; 1.2 s later `busy`, the death screen ("Press any key to rise at …"),
fade out, `resetEncounter()` (living enemies home, the boss reset, pickups cleared, gold −10 %,
HP / MP / SP full, draughts ≥ 2), a teleport to the checkpoint's stand point, 2 s i-frames, fade in.

**Paths and zones** (since 2026-09-28, KNOWN_ISSUES COMBAT-06 / -18 / -19). A chaser walks straight
at the player while the way is clear on the same level (as before) and otherwise follows a path on
the walk grid — up stairs, onto ledges, around rocks — renewed when the player moves on or the walk
sticks; melee kinds wind up only with the player within melee height and a clear straight way
(`Enemy.canMelee`), so none swings at a ledge edge from below. A player with no path within reach
(`Enemy.unreachable`) makes the enemy give up at once (home, calm 6 s). The walk home follows a path
too; the 18 f fade-and-snap stays only when there is no path home or the walk is blocked for good.
Each group's **zone** is the first `region` containing its centre (the location plate's rule),
grown to hold its home disc: a noticing enemy wakes others only in its zone, a player outside the
zone + 3 u is not seen, and the leash breaks when the enemy leaves that margin or 1 s after the
player did — a fight in one zone no longer pulls in the next zone's pack. Levels without regions
have no zone rules.

**Shop** (the gold sink). An NPC with the `shopkeeper` script (Bram at the camp, Odo at the Quarry
Waystone) sells the Healing Draught (25 gold, up to the carry cap) and three one-time wares
(`SHOP_WARES` in `rules.js`: Whetstone ATK +2 for 120, Ironbark Tonic max HP +15 for 90, Warding
Charm DEF +3 for 150) through a dialogue menu (§8); `combat.buy(item)` applies an upgrade at once
(`PlayerCombat.upgrade(kind, amount)`), bought wares stay bought through death and rest, and the
shop is shut while enemies are engaged. `state().combat.shop.purchased` lists them; the event is
`purchase`.

**Names on screen** ([I18N.md §4.8](../specs/I18N.md)). The data keeps the English (identities: `buy`,
`priceOf`, `state()`); the display translates. An enemy's name (`displayName(e)`, cached per enemy:
an elite's bar, the boss bar and banner): a named group's `name` as a term, else the kind's name
(`combat.enemy.<kind>`, a UI string; a group named as its kind reads as the kind's name where the
tables have no term for it). The wares: `shopOffers()` adds `label` / `gainLabel` (UI strings),
`wareLabel(item)` a ware's UI name or, for an NPC's own item, a term. A checkpoint (`placeName`,
Waystones.js: the toasts, the death screen): the spawn's place as a UI string, a waystone's name as a
term, an unnamed waystone (`Checkpoint.unnamed`, additive: `name` still holds 'Waystone') as
`t('game.default.waystone')`. The results card names the level as a term.

**Boss arena.** While a boss arena is closed the player is *sealed* in with its boss
(`PlayerView.sealed`): enemies outside it neither aggro (sight, a neighbour's wake-up) nor get an
attack token, and one that is engaged anyway walks home and stays calm for 6 s — the fight stays a
1-on-1 with the boss and its adds (quarry archers used to shoot into the arena). The boss keeps
the player at its hurt radius (1.2 u, not its 0.6 u move radius), and its sprite dithers to 45 %
opacity while the player stands behind it on screen (`Sprite3D.bodyOpacity`: the quad only — its
shadow and blob stay solid), so the player is never hidden inside it. Its death plays small,
dim bursts beyond it (`BossArena.deathBursts`), a warm death flash, and drops its coins and core
beyond it, so the player stays readable in the kill frames.

**Readability.** Damage numbers of enemies spawn above their HP bars and stack upward when several
land at once; a hit star on a target standing behind the player on screen moves to the target's
head top and aside; wind-ups, the elite shimmer and the boss's hit flash tint the sprite's own
shading through the Sprite3D **highlight** (`setHighlight`), so the wind-up pose stays readable on
every sheet (the golem's cracks also flare); a level-up while engaged shows a smaller card
higher up, and one granted by the boss's kill waits for the results card; skill slots cast on
click (a click never reaches the canvas as an attack). Pickups that would give nothing (a heart at
full HP, a mana mote at full MP, a draught at the carry cap) stay on the ground, even after the
magnet caught them.

**The story and the campaign** (2026-10-07, KNOWN_ISSUES CMP-03 / CMP-04). Enemy groups, chests
and waystones are `LIVE_STORY_TYPES`: a level with a story loads every one whatever its `when` /
`unless` (a campaign keeps them in the level it builds), and `StoryRunner.applyPresence` calls
`combat.applyPresence(present)` right after `World.applyStory`. An absent group's foes are hidden
and dormant (`_absent`, also in `_hidden` with the unspawned adds: excluded from AI, hits, the
minimap, the counts — `state().combat.enemies.absent` — and the hooks); one taken mid-fight drops
the lock-on, aggro, tokens, markers and projectiles, goes home at full HP, and its boss's fight
ends; an absent boss's arena closes nothing (`BossArena.present`). A group that comes back spawns at
home, its fallen stay fallen; the death reset, a rest and the `reset` hook keep absent groups
away. Chests and waystones are World story groups (prop, collider, prompt, paint, marker); combat
marks the records `absent` (no discovery, opening, attuning or rest; an opened chest that comes
back stays offering nothing; a checkpoint that goes falls back to the spawn). A campaign remembers
defeated groups per level (`defeatedGroups` / `markGroupsCleared`, above): no death, drop, XP or
`kill` event on entering, a boss stays defeated.

**Integration points in `Game`**: the constructor (`combatEnabled`), `init` (§3.2 rows 0.94 and
0.96), the frame (§3.4 steps 3 and 7), `_setupMaps` (`attachMaps`), `toggleMap` (`onMapOpen`),
`teleport` (`onTeleport`: the lock releases, the focus vectors jump), `togglePhotoMode`
(refused while engaged), `setMusic` (`musicTrack`), `_findInteractable` (`disabled`),
`_interact` (`onInteract`), `state()` (`combat`), `_exposeGlobal` (`combat` hooks), `dispose`
(first). The test fixture is [`sandbox/combat_fixture.js`](../../sandbox/combat_fixture.js)
(`sandbox/combat.*.json`); [`sandbox/combat_play.js`](../../sandbox/combat_play.js) (`combat.play.json`)
plays all of Cinderwatch Pass with real key events — in fixed step (`&fixedstep=1`: the engine's
`manualStep`, a virtual page clock), so a run is deterministic and comparable by its `digest`
([TESTING_AND_VERIFICATION §8.2](../development/TESTING_AND_VERIFICATION.md#82-scripted-suites)).
