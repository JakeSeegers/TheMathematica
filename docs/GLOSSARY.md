# Glossary

> **Purpose.** One place that defines the words Luminati's code and documentation use — the
> 2.5D pixel-art rendering vocabulary, level-format terms, game and editor concepts, and the names of the
> development tools. Several words mean two things in this project (a *level*
> is a file **and** a height step; an *emitter* is a particle system **and** a level object);
> those are called out. Each entry links to the canonical document for the details.
>
> **Audience.** Everyone new to the project — players and level designers meeting a term in the
> editor, developers and AI agents meeting it in the code or documentation.
>
> **Source of truth.** The code named in each entry; the values quoted here were read from
> [`src/engine/constants.js`](../src/engine/constants.js),
> [`src/engine/level/LevelFormat.js`](../src/engine/level/LevelFormat.js),
> [`src/engine/level/ObjectCatalog.js`](../src/engine/level/ObjectCatalog.js),
> [`src/engine/level/ObjectBuilder.js`](../src/engine/level/ObjectBuilder.js),
> [`src/game/World.js`](../src/game/World.js), [`src/game/config.js`](../src/game/config.js) and
> [`src/game/Weather.js`](../src/game/Weather.js).
>
> **Related.** [README.md](README.md) (documentation index) ·
> [features/FEATURES.md](features/FEATURES.md) · [specs/LEVEL_FORMAT.md](specs/LEVEL_FORMAT.md) ·
> [architecture/OVERVIEW.md](architecture/OVERVIEW.md) · [ai/AGENT_ONBOARDING.md](ai/AGENT_ONBOARDING.md)

---

## Contents

- [Words with two meanings](#words-with-two-meanings)
- [The 2.5D pixel-art look and rendering](#the-25d-pixel-art-look-and-rendering)
- [Levels and the world](#levels-and-the-world)
- [Story-game terms](#story-game-terms)
- [Lights](#lights)
- [The game](#the-game)
- [Languages and translation](#languages-and-translation)
- [Combat](#combat)
- [The editor](#the-editor)
- [Tools, verification and process](#tools-verification-and-process)

---

## Words with two meanings

| Word | Meaning 1 | Meaning 2 |
| --- | --- | --- |
| **level** | A level **file**: one `luminati-level` JSON document (terrain, environment, spawn, objects) in `public/levels/` or browser storage ([LEVEL_FORMAT.md](specs/LEVEL_FORMAT.md)). Players never see the word for a place ([story-game terms](#story-game-terms)). | A terrain **height step**: an integer 0–35 (`MAX_LEVEL`) stored per tile in `heights`; world height = level × 0.5 (`LEVEL_HEIGHT`). The editor's height tools work in levels, while positions, `minY` and `waterLevel` are in **world units**. |
| **emitter** | A particle system instance created by `Particles.createEmitter` (one draw call) — [fx.md](architecture/modules/fx.md). | The level object type `emitter`, shown in the editor as a **particle area**: a box plus a preset (fireflies, leaves, petals, dust, embers, smoke, mist, sparkle, rain, snow) — [OBJECT_CATALOG.md](specs/OBJECT_CATALOG.md). |
| **region** | A level object type (`region`, *Region name* in the editor): a rectangle that names an area, shows its name on the HUD location plate and optionally an arrival **banner**. | Informally, an area of a level ("the market region"); level design docs use the object's name. |
| **map** | The **tile map** — `TileMap`, the terrain built from `tiles` + `heights` ([world.md](architecture/modules/world.md)). | The **minimap** / **world map** UI (N / Tab), painted by `LevelMap` ([ui.md](architecture/modules/ui.md)). |
| **light** | A real three.js **point light** — at most 12 exist, all created at load. | A **light descriptor** — a light *source* in the level (lamppost, torch, campfire, `light` object, lit window); any number may exist and a `LightPool` assigns the real lights to them. |
| **level (combat)** | The player's **character level** — *Lv* 1–10 on the vitals, raised by XP ([PLAYING_THE_GAME.md](user/PLAYING_THE_GAME.md)). | An enemy group's `level` field (1–10), which scales its HP, damage, XP and gold ([OBJECT_CATALOG.md](specs/OBJECT_CATALOG.md)). Neither is a level file or a height step. |
| **marker** | A **ground marker**: a combat telegraph decal (circle, ring, sector, lane, rect) draped over the terrain by `GroundMarkers` ([fx.md](architecture/modules/fx.md)). | A **map marker**: a symbol on the minimap / world map (door, sign, well, campfire, waystone, chest, boss). Also the `marker` **object** (a *story marker*): a named spot story scripts walk actors to ([OBJECT_CATALOG.md](specs/OBJECT_CATALOG.md#marker)). |
| **event** | The `event` **object**: a rectangle whose story script runs on a trigger ([STORY_SCRIPT.md §6](specs/STORY_SCRIPT.md#6-events-and-triggers)); a story file's **campaign event** is the same without a place. | An `EventEmitter` event (`engine.events`, `combat.events`: `kill`, `bossDefeated` …) — code, not data. |
| **run** | A story **run**: one script running (a conversation, an event's script), holding the player ([STORY_SCRIPT.md §9.1](specs/STORY_SCRIPT.md#91-runs)). | To *run* the player (Shift), or a harness run. |
| **unit** | A **world unit**: the engine's length unit — one tile is 1 × 1 world units, 16 texels each way (`PPU`); positions, heights and radii are in world units. | A content **unit**: one translatable piece of prose in a content table — a dialogue page, a sign's paragraph, a script line — with its key, the English it was translated from and the translation ([languages](#languages-and-translation)). Names are **terms**, not units. |
| **sandbox** | A standalone test page per engine module under [`sandbox/`](../sandbox/index.html) (`/sandbox/` on the dev server). | — (the word is not used for anything else, but note that sandboxes are *not* part of the build). |

---

## The 2.5D pixel-art look and rendering

| Term | Definition | Details |
| --- | --- | --- |
| **2.5D pixel-art** | The art style Luminati targets, inspired by Square Enix's HD-2D games: pixel-art sprites and textures in a lit, shadowed 3D diorama, with tilt-shift depth of field, bloom and a colour grade. | [VISUAL_DESIGN.md](design/VISUAL_DESIGN.md), [`ARCHITECTURE.md`](../ARCHITECTURE.md) §1 |
| **Diorama** | The playable map seen from a high, narrow-FOV camera, ringed by a fogged **outer world** (forest border, heightfield, distant ridges) so it never looks like a floating island. | [GAME.md](architecture/GAME.md) |
| **Diorama camera** (`CameraRig`) | The follow camera: FOV 28°, pitch 32°, distance 30 (18–42 in the game), Q / E orbit up to ±60°, look-ahead, focus bounds. Engine defaults differ; the game sets `CAMERA` in `game/config.js`. | [core.md](architecture/modules/core.md) |
| **PPU** | Pixels (texels) per world unit: **16**, for textures and sprites alike. One tile = 1 world unit = 16 texels. | `constants.js` |
| **NEAREST** | The texture magnification filter that keeps pixel art crisp; all pixel textures go through `makePixelTexture` / `PixelCanvas#toTexture`. | [pixel.md](architecture/modules/pixel.md) |
| **Tilt-shift / DOF** | Depth of field with a sharp band around the focus (the player) and blurred foreground and background — the miniature look. Computed per pixel as a **CoC**. | [render.md](architecture/modules/render.md) |
| **CoC** (circle of confusion) | The per-pixel blur radius derived from depth relative to the focus distance. Effects that do not write depth take the CoC of the surface behind them. | [RENDER_PIPELINE.md](architecture/RENDER_PIPELINE.md) |
| **Bokeh / highlight scatter** | Bright specks turned into soft discs by the DOF's scatter pass (half-resolution gather + scattered sprites). | [render.md](architecture/modules/render.md) |
| **Scene target** (`postfx.sceneTarget`) | The MSAA, linear, HDR render target the scene is drawn into before post-processing. Shaders must be compiled against it (not the canvas) or they recompile at first use. | [RENDER_PIPELINE.md](architecture/RENDER_PIPELINE.md) |
| **Warm-up** | Compiling every shader program during loading (`renderer.compileAsync` against the scene target, then a few frames with rain and snow on behind the loader) so nothing compiles — and hitches — during play. | [RENDER_PIPELINE.md](architecture/RENDER_PIPELINE.md) |
| **Program** (shader program) | A compiled WebGL program; three.js caches one per material configuration and render target. The count after loading is a regression signal (Emberfall 57, Starfall Vale 59). | [PERFORMANCE.md](architecture/PERFORMANCE.md) |
| **Tone mapping / grade** | ACES tone mapping happens once, in PostFX's `OutputPass`; the **grade** (contrast, saturation, temperature, vignette, grain, chromatic aberration, sharpen) runs after it in display space. `LightingSystem` owns `renderer.toneMappingExposure`. | [render.md](architecture/modules/render.md) |
| **Global uniforms** | The shared uniform objects in `render/GlobalUniforms.js` (`uTime`, `uNight`, wind, camera yaw, sun direction and colour, fog colour) through which modules stay in sync without calling each other. | [OVERVIEW.md](architecture/OVERVIEW.md) |
| **Night factor** (`uNight`) | 0 by day … 1 at night, written by `LightingSystem` each frame; drives lamp and window glow, fireflies, crickets. | [lighting.md](architecture/modules/lighting.md) |
| **Keyframes / palette** | The 13 time-of-day keyframes of `DEFAULT_KEYFRAMES` (sun, sky, fog, ambient, exposure), interpolated over 24 h; the game overrides some (`KEYFRAME_OVERRIDES`). | [lighting.md](architecture/modules/lighting.md) |
| **Emissive** | A material that glows (windows, lantern glass, flames), faded between a day and a night level by `LightingSystem.registerEmissive`. | [lighting.md](architecture/modules/lighting.md) |
| **God rays** | Soft additive light shafts that follow the sun, placed in `godRayAreas` (or automatically). One draw call per shaft in view. | [fx.md](architecture/modules/fx.md) |
| **Texel snapping** | Moving the sun's shadow frustum only in whole shadow-map texels so shadows do not shimmer when the camera moves. | [lighting.md](architecture/modules/lighting.md) |
| **Sprite shadow proxy** | A sun-facing silhouette quad (colour writes off) that casts a sprite's full shadow; on big levels it is shadow-pass only. | [sprite.md](architecture/modules/sprite.md) |
| **Blob shadow** / `BlobBatch` | The soft contact shadow under a character; `BlobBatch` draws all of them in one instanced call on big levels. | [sprite.md](architecture/modules/sprite.md) |
| **Wrap lighting / bent normals** | Sprite lighting tricks that keep backlit characters warm instead of black. | [sprite.md](architecture/modules/sprite.md) |
| **X-ray silhouette** | The pale outline of the player drawn when a roof or canopy hides them. | [GAME.md](architecture/GAME.md) |
| **Resolution governor** | `ResolutionGovernor` (game only): lowers the render scale (down to 0.7) when the median GPU time stays high, raises it again when it is low. | [PERFORMANCE.md](architecture/PERFORMANCE.md) |

---

## Levels and the world

| Term | Definition | Details |
| --- | --- | --- |
| **`luminati-level`** | The level file format (`format: "luminati-level"`, `version: 1`), plain JSON, written byte-stably by `serializeLevel`. | [LEVEL_FORMAT.md](specs/LEVEL_FORMAT.md) |
| **Width × depth** | A level's size in tiles along x and z, 8–128 each (`MIN_SIZE`, `MAX_SIZE`). Rows of `tiles` / `heights` run toward +z. | [LEVEL_FORMAT.md](specs/LEVEL_FORMAT.md) |
| **Tile (i, j)** | The square `x ∈ [i, i+1], z ∈ [j, j+1]`; its centre is `(i + 0.5, j + 0.5)`. Y is up. | [OVERVIEW.md](architecture/OVERVIEW.md) |
| **Tile char / legend** | Each tile is one character; the level's **legend** maps characters to tile definitions (top texture, walkable, water…). 22 built-in types (`TILE_TYPES`) are always present; a level may add custom characters. | [LEVEL_FORMAT.md](specs/LEVEL_FORMAT.md) |
| **Step vs cliff** | Characters can climb a height difference up to 0.55 (`maxStep`): one level (0.5) is a walkable step, two or more levels form a cliff that only stairs or a bridge cross. | [LEVEL_DESIGN_GUIDE.md](design/LEVEL_DESIGN_GUIDE.md) |
| **Stairs** | Four tile types (`^` north, `v` south, `>` east, `<` west) whose legend `stairs` direction makes the tile rise one level that way, built as four steps; the editor's Stairs tool picks the direction of the higher neighbour. | [LEVEL_FORMAT.md](specs/LEVEL_FORMAT.md) |
| **Water level / water surface** | `waterLevel` is the default surface height (world units) of water tiles; legends can set a per-tile `waterLevel` or `waterDepth`. | [LEVEL_FORMAT.md](specs/LEVEL_FORMAT.md) |
| **Environment** | Level-wide settings: time and clock, weather, fog, camera, title camera, scenery, foliage, forest, god-ray areas, minimap, water look. | [LEVEL_FORMAT.md](specs/LEVEL_FORMAT.md) |
| **Spawn** | The player start (`spawn: { x, z, facing }`); the editor treats it as a pseudo-object with id `spawn`. | [LEVEL_FORMAT.md](specs/LEVEL_FORMAT.md) |
| **Object / object type** | An entry of `objects` (`id`, `type`, position, fields). The **object catalog** (`OBJECT_TYPES`) defines 42 types in 10 categories, each with defaults, inspector fields and a placement style. | [OBJECT_CATALOG.md](specs/OBJECT_CATALOG.md) |
| **Placement** | How a type is positioned: `point` (`x`, `z`), `line` (`x0, z0 → x1, z1`: fences, bridges) or `rect` (regions). | [OBJECT_CATALOG.md](specs/OBJECT_CATALOG.md) |
| **Kind** (`prop` / `actor` / `marker`) | The catalog's split between things `LevelObjectBuilder` builds as props, characters the game spawns (NPCs, critters) and invisible markers (particle areas, regions). | [level.md](architecture/modules/level.md) |
| **Normalisation** | `normalizeLevel` / `normalizeObject` fill every missing default and repair invalid values on load; that is why adding a default changes every saved file on its next save. | [LEVEL_FORMAT.md](specs/LEVEL_FORMAT.md) |
| **Byte-stable round trip** | `serializeLevel(parseLevel(text)) === text` for every shipped level: opening and saving a level unchanged must leave `git diff` empty. | [TESTING_AND_VERIFICATION.md](development/TESTING_AND_VERIFICATION.md) |
| **`BuiltObject`** | What `LevelObjectBuilder.build` returns for a prop object: the positioned `object`, `colliders`, `walkRects`, light descriptors, `emissives`, particle `emitters`, an optional `interact` point and `update`. The game and the editor wire these lists to their owners. | [level.md](architecture/modules/level.md) |
| **`PropResult`** | What a `PropFactory` method returns (meshes plus the same kinds of lists); `mergeStatic` batches many of them. | [world.md](architecture/modules/world.md) |
| **Collider / walk rect** | Collision shapes registered with the `TileMap` (props, villagers) and walkable surfaces that override the terrain (bridge decks). Dynamic colliders move (villagers). | [world.md](architecture/modules/world.md) |
| **Interactable** | A point the player can use with the confirm key: villagers (*Talk*), doors (*Knock*), signposts (*Read*), wells (*Look*). A door also has a `lookSpan` (its leaf), which counts when the player faces it. | [PLAYING_THE_GAME.md](user/PLAYING_THE_GAME.md) |
| **Villager / NPC** | An `npc` object: preset, dialogue pages, an **action** (`none`, `rest`, `shop`, `music`), a **behaviour** (`wander`, `post`, `perform`, `chase`) or one of Emberfall's eight hand-written **scripts**. | [OBJECT_CATALOG.md](specs/OBJECT_CATALOG.md) |
| **Relative offsets** | `talkOffset`, `area` (NPCs) and `spotOffsets`, `area` (critters) are stored relative to the object so they move with it (and turn with it on quarter turns in the editor). | [OBJECT_CATALOG.md](specs/OBJECT_CATALOG.md) |
| **Critters** | A group of animals of one kind — `chicken`, `cat`, `bird` or `dog` — that roam, scatter or take flight. | [OBJECT_CATALOG.md](specs/OBJECT_CATALOG.md) |
| **Particle area** | The editor name of the `emitter` object (see [two meanings](#words-with-two-meanings)). | [OBJECT_CATALOG.md](specs/OBJECT_CATALOG.md) |
| **Banner** | The large arrival title shown when play starts and the first time the player enters a region that has a `banner` line. | [ui.md](architecture/modules/ui.md) |
| **Camera bounds / focus bounds** | The rectangle the camera's focus may move in (from `environment.camera.bounds` or computed automatically); it widens as you zoom in. | [GAME.md](architecture/GAME.md) |
| **High ground** | An optional camera tilt applied while the player stands above a given height (Emberfall's Windmill Hill). | [LEVEL_FORMAT.md](specs/LEVEL_FORMAT.md) |
| **Title camera** | The slow drifting view behind the title screen (`environment.titleCamera`, automatic when absent). | [LEVEL_FORMAT.md](specs/LEVEL_FORMAT.md) |
| **Big level** | A level wider or deeper than 64 tiles. The game (and the editor preview) switch to the `BIG_LEVEL_BATCHING` path: spatially split batches with box culling, shadow-only proxy casters, far-actor throttling. Small levels keep the original path and must render identically. | [PERFORMANCE.md](architecture/PERFORMANCE.md) |
| **`SpatialSplit`** (k-d batching) | Cuts merged batches into spatially compact pieces the camera and the shadow pass can cull by bounding box. | [world.md](architecture/modules/world.md) |
| **`ShadowCasters`** | A few merged, shadow-pass-only proxy meshes that draw the shadows of opaque props and cliffs on big levels. | [world.md](architecture/modules/world.md) |
| **Shore bake** | The water's shore-foam texture, computed from the terrain and the static colliders in water (in a worker: `WaterShore` / `shoreWorker`). | [world.md](architecture/modules/world.md) |
| **Generator** | A deterministic Node script in `tools/make-*.mjs` that writes and validates level or campaign data. Four generators make standalone levels; `make-ferrymans-lantern.mjs` and `make-emberfall-interiors.mjs` make campaigns. Generated content is changed through its generator. | [Level workflow](development/DEVELOPMENT_WORKFLOW.md#7-working-with-levels) |

---

## Story-game terms

The words for a story game made of several levels — a **campaign**
([CAMPAIGN_FORMAT.md](specs/CAMPAIGN_FORMAT.md)). They were fixed before the code was written
(2026-10-07) so the code, the docs and the editor use the same ones. Three words are kept out of it
because they already mean something here: *map* (the tile map, the minimap and world map — see
[two meanings](#words-with-two-meanings)), *area* (particle, forest and god-ray areas; the NPC and
critter `area` field) and *world* (`src/game/World.js`, the level as built in the game; world
units; the world map).

| Term | Definition | Details |
| --- | --- | --- |
| **Level (in a story game)** | One place of the story — a town, a route, a dungeon floor — kept as one level file in its campaign's `levels/` folder. The code, the files and the editor keep the word *level*, but what players see never uses it for a place: players read *level* as their character level. The game names the place instead — the level's name on the arrival banner and the location plate, region names inside it. | [two meanings](#words-with-two-meanings) |
| **Campaign** | Connected places and their story, kept in `public/campaigns/<name>/`. Its `campaign.json` lists the levels by id, their positions on the campaign plane, the start, chapters and initial flags. Level files live in `levels/`; optional scripts, items, quests and actors live in `story/`. Played with `game.html?campaign=<name>`. Standalone levels stay in `public/levels/`. | [CAMPAIGN_FORMAT.md](specs/CAMPAIGN_FORMAT.md) |
| **Exit** | An `exit` object: a rect that takes the player to another level of the campaign — walking in (a road at the map edge) or with Space (a door) — at a named entrance, across the seam, or to the target's player start. `requires` / `locked`: closed until a story flag is set. A level played on its own ignores it. | [OBJECT_CATALOG.md](specs/OBJECT_CATALOG.md#exit) |
| **Entrance** | An `entrance` object: a named arrival point (position and facing) that exits lead to. The level's `spawn` stays its default. | [OBJECT_CATALOG.md](specs/OBJECT_CATALOG.md#entrance) |
| **Campaign plane / seam** | The shared plane on which `campaign.json` places levels (`at`: where a level's corner sits). Placed levels that touch or overlap join at a **seam**: an exit without an entrance arrives at the same plane point on the other side; the world map shows them side by side. | [CAMPAIGN_FORMAT.md §3](specs/CAMPAIGN_FORMAT.md#3-levels-the-campaign-plane-and-seams) |
| **Travel** | Switching to another level of the campaign without a reload (`CampaignRuntime.travel` → `Game.swapLevel`), behind the fader: the engine, UI, audio, weather and one fixed pool of the 12 point lights stay, the destination world and its actors are built or reused from prepared or retained levels. | [Campaign format](specs/CAMPAIGN_FORMAT.md) |
| **Story flag / variable** | A named fact of the story (`bridge-mended`) — a flag is a variable whose value is 1 (`deliveries = 3` is a variable). Set by scripts (`set`, `var`), a villager's `flag` after a conversation, the campaign's starting `flags` and the story files' `vars`; read by conditions. Saved with the game. | [STORY_SCRIPT.md §3](specs/STORY_SCRIPT.md#3-conditions) |
| **Condition** | A small expression over the story (`not refused and item:plank >= 3`, `quest:x = done`, `hour >= 20`) — in `when` / `unless`, exits' `requires`, chapters' `when`, events' `if`, quest goals' `done`, scripts. One bare name is a flag in `when` / `unless` / `requires` / a chapter's `when` (the flag rule); elsewhere it is read as scripts write it (`if: gold` reads the purse). | [STORY_SCRIPT.md §3](specs/STORY_SCRIPT.md#3-conditions) |
| **Story conditions** | `when` / `unless` on any object (`STORY_FIELDS`): there only while `when` holds / gone while `unless` holds — live for every type: villagers, exits, events, critters, particle areas, every prop (props and particle areas with one condition pair: a **story group**) and the combat objects (enemy groups, chests, waystones). | [STORY_SCRIPT.md §9.5](specs/STORY_SCRIPT.md#95-objects-that-come-and-go) |
| **Script** | A story script: lines of the story language (dialogue `Name: text`, `choice`, `if`, commands …) in a villager's `talk`, an event's `run` or a story file. | [STORY_SCRIPT.md §4](specs/STORY_SCRIPT.md#4-scripts) |
| **Talk script / actor** | A villager's `talk` script replaces its plain dialogue; its `actor` names the story character it is (one talk script, name and visit count across levels and chapter variants). | [STORY_SCRIPT.md §7](specs/STORY_SCRIPT.md#7-talk-scripts-and-actors) |
| **Story files** | A campaign's `story/*.json` (variables, items, quests, actors, scripts, campaign events, start presets) and `story/*.story` (scripts as plain text), listed in campaign.json `story`. | [STORY_SCRIPT.md §8](specs/STORY_SCRIPT.md#8-story-files) |
| **Quest / stage / goal** | A quest (journal): started, moved to named **stages**, done or failed by scripts; **goals** are conditions the journal ticks. | [STORY_SCRIPT.md §8](specs/STORY_SCRIPT.md#8-story-files) |
| **Cutscene** | A run with the `cutscene` command: letterbox, no HUD, the camera directed, skippable by holding Esc. | [STORY_SCRIPT.md §9.2](specs/STORY_SCRIPT.md#92-staging) |
| **Journal** | The story's overlay (B): quests and items with gold. | [STORY_SCRIPT.md §9.4](specs/STORY_SCRIPT.md#94-the-journal) |
| **Chapter** | A stage of the story: the last chapter whose `when` flag is set is in force, and its `levels` swap a level for a **variant** file from the campaign's `levels/` folder (The Ferryman's Lantern's Millbrook at dusk). A chapter's start shows its title in a banner. | [CAMPAIGN_FORMAT.md §5](specs/CAMPAIGN_FORMAT.md#5-story-flags-conditions-chapters) |
| **Saved game** | One per campaign and browser (`localStorage` `luminati.campaign.<name>`, version 2; play-tests `….test`): the story (variables, items, gold, quests, events done, visits, the day, homes), the place, the hour, the weather, combat progress, opened chests, visited levels. A run is saved as a whole. The title offers Continue / New journey. | [CAMPAIGN_FORMAT.md §7](specs/CAMPAIGN_FORMAT.md#7-saved-games) |

---

## Lights

| Term | Definition | Details |
| --- | --- | --- |
| **Light descriptor** | `{ position, color, intensity, distance, flicker, nightOnly, tag }` — one per light source a built object reports. | [OBJECT_CATALOG.md](specs/OBJECT_CATALOG.md) |
| **`LightPool`** | Owns the real point lights. **Static** mode (≤ 12 descriptors): one permanent light each. **Pooled** mode (> 12): 12 lights re-assigned every 0.2 s to the best-ranked descriptors in view, crossfading on hand-over. | [lighting.md](architecture/modules/lighting.md) |
| **`LIGHT_PRIORITY`** | Importance when lights are ranked — **lower is more important**: campfire and hearth 0, wall torch and `light` 1, lamppost 2, house window 3. | [OBJECT_CATALOG.md](specs/OBJECT_CATALOG.md) |
| **Point-light budget** | At most 12 point lights, created before the first frame; the count never changes afterwards (a change recompiles every lit shader). The editor preview uses the same `LightPool` with `fixed: true`, so it always has 12. | [RENDER_PIPELINE.md](architecture/RENDER_PIPELINE.md) |

---

## The game

| Term | Definition | Details |
| --- | --- | --- |
| **Launcher / game page** | The site's front page, `index.html`, is the **launcher**: a plain English page with no script that lists every campaign and level with *Play* and *Edit* links, and the editor; the Vite plugin `tools/vite-launcher.js` writes the list from `public/` (on every request on the dev server, once in a build). The game itself is the **game page**, `game.html` (`?level=`, `?campaign=` …). | [GETTING_STARTED.md](user/GETTING_STARTED.md#44-the-launcher) |
| **Title mode / play mode** | The game boots into the title screen over a drifting camera and enters gameplay from it (the key press also unlocks WebAudio); `?autostart=1` skips the title. | [GAME.md](architecture/GAME.md) |
| **Game hour** | 90 real seconds (`TIME_SPEED` = 1/90 h per second); a level can stop the clock (`environment.clock: false`). | [PLAYING_THE_GAME.md](user/PLAYING_THE_GAME.md) |
| **Time presets** | What **T** cycles through: Dawn 6.5 h, Midday 12.5 h, Golden Hour 17.2 h, Dusk 18.9 h, Night 22.5 h (a 2-second glide). | [PLAYING_THE_GAME.md](user/PLAYING_THE_GAME.md) |
| **Weather** | `clear`, `rain` or `snow` (**R** cycles). `Weather` blends sun, fog, wind, grade and particles and rewrites those live settings every frame; the look itself (`WEATHER_PARAMS` and the functions that apply it) is `WeatherLook.js`, which the editor preview uses too. | [GAME.md](architecture/GAME.md) |
| **Photo mode** | **P**: hides the whole UI for screenshots; you can still walk, turn and zoom, and the game stops re-applying its camera pitch and edge-of-map yaw limit. | [PLAYING_THE_GAME.md](user/PLAYING_THE_GAME.md) |
| **Minimap / world map** | The small north-up map under the clock and the full-screen map (N / Tab) with region names; both painted once at load by `LevelMap`. | [ui.md](architecture/modules/ui.md) |
| **`window.__game`** | The automation hook of the game page: engine handles plus `teleport`, `setTime`, `setWeather`, `talkTo`, `map`, `state()` … | [AUTOMATION_API.md](specs/AUTOMATION_API.md) |

---

## Languages and translation

The game plays in English, Japanese and Simplified Chinese. The UI's own words are **UI strings**
(`t('<ns>.<key>')`, string tables per component); what levels, campaigns and stories say is
**content text**, looked up at display from `public/i18n/<lang>/` by the **text key** the data holds
beside each text — the data holds keys, never translations
([I18N.md](specs/I18N.md)).

| Term | Definition | Details |
| --- | --- | --- |
| **UI string** | A word of the UI in a string table, by id, in en / ja / zh: `t('game.prompt.enter')`. Also the code defaults that stand in for blank data (*Signpost*, *Nothing of note.*, *The way is closed.*) and the prompt's built-in verbs (Enter, Look, Read …). | [I18N.md §2](specs/I18N.md#2-ui-strings) |
| **Content table** | A file `public/i18n/<lang>/<id>.json` (`common`, `levels/<name>`, `campaigns/<name>`; version 3: `{ terms, units }`, units keyed by text keys) listed in `index.json`; one may `extends` another (a campaign built on a shipped level). The tools write them; translators never edit them by hand. | [I18N.md §4.1](specs/I18N.md#41-tables) |
| **Content unit** | One piece of prose in a table: its **key**, `source` (the English it was translated from) and `target`. `loc(key, english)` shows the translation only while that English is still the text shown. See [unit](#words-with-two-meanings). | [I18N.md §4](specs/I18N.md#4-content-text) |
| **Term** | A name translated by the name itself — villagers, speakers, places, levels, campaigns, items, quests, foes, waystones: `term(name)`. Names are identities (scripts match them, saves keep them, `level.name` seeds the terrain), so they stay English in the data; one glossary entry per name, the same wherever it is shown. | [I18N_GLOSSARY.md](specs/I18N_GLOSSARY.md) |
| **Text key** (content key) | The GUID a translatable text carries in the data, as Unreal's FText keys: 32 upper-case hex digits (`9F2A1B3C4D5E6F708192A3B4C5D6E7F8`), made when the text is made (by the editor, a generator or `npm run i18n:keys -- --assign`) and kept through every edit — an edited text keeps it (*changed*), a moved text and a renamed object's texts keep theirs, a new text gets a new one. A content unit is keyed by it. A banner's subtitle has `<GUID>.2`; the lines of `dialogue.js` have **code keys** (`dlg.elder.inn-tip`). The game reads keys with ContentKeys' readers (`textKeyOf`, `pageKeyOf`, `dialogueKeyOf`, `choiceKeyOf`, a script node's `tk`); `TextKeys.js` carries them through edits. Nobody types one. | [I18N.md §4.2](specs/I18N.md#42-keys-and-lookup) |
| **`textKeys`** | The side field that holds the text keys of a level object, a level's root, `campaign.json` or a chapter, or a story file's item or quest, mirroring its translatable fields (`TEXT_KEY_FIELDS`): a key per one-string field, a list parallel to a field's pages, a key or `{ key, choices }` per dialogue page. Optional, and absent when there is nothing to key. | [I18N.md §4.2](specs/I18N.md#42-keys-and-lookup) |
| **`#line:` tag** | A script line's text key, written at its end: `- Ah, a traveller. #line:9F2A…` (a villager's `talk`, an event's `run`, story scripts), as Yarn Spinner's line tags. Only a line that holds text has one. `parseScript` cuts it off before the line is read and puts the key on the node (`tk`); the editor's script fields hide the tags and keep them on Apply. | [STORY_SCRIPT.md](specs/STORY_SCRIPT.md), [I18N.md §4.2](specs/I18N.md#42-keys-and-lookup) |
| **Parked line** | A script line that keeps its `#line:` tag although nothing reads its text: a comment, a line with a parse error, a line over a limit (`ParsedScript.parked`). Its tag is never reported as stray, so the text keeps its key when the line is fixed or uncommented. | [I18N.md §4.10](specs/I18N.md) |
| **Copy-on-write** | Copies of a level — a chapter variant and its base, a campaign's copy of a shipped level, a *Save As* copy — share their text keys, and so their translations, while the English is the same; an edit that makes one copy's English differ gives that copy a new key, and the other copy keeps the shared key and its translation (one key, one English per table). The generators and the editor do it themselves; `npm run i18n:keys -- --fix` splits a copy edited by hand. | [I18N.md §4.2](specs/I18N.md#42-keys-and-lookup) |
| **Changed / orphan / no key** | What the checker calls a unit whose text was edited — the same key now holds other English, so the game shows English until a translator reviews it (*changed*); a unit whose key no source holds any more, or a term no reader shows — a deleted villager (*orphan*: `--prune`); a text the data holds no key for, which stays English (*no key*: `npm run i18n:keys -- --assign`). | [I18N.md §4.7](specs/I18N.md#47-checker-worklist-and-exchange) |
| **Miss** | A text shown untranslated, in English, on a Japanese or Chinese page — `missing` (no table holds its key), `stale` (its English was edited), `nokey` (the data holds no key for it), `term` (a name with no term) — recorded by `loc` / `term` in `window.__luminati.content.misses`; the i18n tours fail on any. Nothing is translated by its English instead ([content lookup](specs/I18N.md)). | [TESTING_AND_VERIFICATION.md §8.5](development/TESTING_AND_VERIFICATION.md#85-languages-and-fonts) |
| **Worklist** | A translator's file per language and table (JSON, or gettext PO with `--format=po`) written by `tools/i18n-worklist.mjs` (version 3): the untranslated and changed units with their text key (PO `msgctxt`), English, speaker and context; filled and merged back with `--merge`. | [TASK_PLAYBOOKS.md §26](ai/TASK_PLAYBOOKS.md#26-translate-or-fix-content-text-with-the-worklist) |

---

## Combat

Only on levels with enemies (or `environment.combat: true`). Fights are turn-based on the GLAIVE
rules ([GLAIVE.md](specs/GLAIVE.md)); the engine additions are in [COMBAT.md](contracts/COMBAT.md);
how to play is in [PLAYING_THE_GAME.md](user/PLAYING_THE_GAME.md). Terms of the old real-time
combat (hit-stop, hurt radius, sub-step, the bot's digest) are kept below for reading the history.

| Term | Definition | Details |
| --- | --- | --- |
| **Combat level / peaceful level** | A level on which `levelHasCombat(level)` is true — it has an `enemy` object and no `environment.combat: false`, or `environment.combat: true` — gets the combat system; every other level is **peaceful** and creates nothing combat-related (`game.combat === null`). | [COMBAT.md §3](contracts/COMBAT.md#3-enabling-combat-per-level) |
| **Cinderwatch Pass** | The combat demo level (`cinderwatch-pass`, 96 × 120), generated by `tools/make-cinderwatch-pass.mjs`. | [cinderwatch-pass.md](design/levels/cinderwatch-pass.md) |
| **Enemy group / pack** | One `enemy` level object: a *kind*, a *count* (1–8), a home radius, a level, *elite*; its members start scattered over the home radius and return there. | [OBJECT_CATALOG.md](specs/OBJECT_CATALOG.md) |
| **Kind** | An enemy type from `ENEMY_KINDS`: slime, goblin, archer, shaman, bat, boar, dummy, golem (the boss). | [COMBAT.md §7.1](contracts/COMBAT.md#71-roster-base-stats-at-enemy-level-1-srcgamecombatdefsjs--enemy_defs) |
| **Elite** | An enemy with more HP and damage, a guaranteed heart and a gold-framed health bar with a name plate (Old Ironhide). | [COMBAT.md §7.2](contracts/COMBAT.md#72-level-scaling-and-elites) |
| **Boss / Cinderheart / adds** | The three-phase stone golem of the caldera; *adds* are the bats it summons in phase 2. | [COMBAT.md §8](contracts/COMBAT.md#8-boss-cinderheart-aigolemjs-arena-from-bossarenajs) |
| **Arena / gate / ember wall** | The boss group's relative `arena` rectangle and `gate` segment: entering the arena starts the fight, an **ember wall** closes the gate and nobody else may enter until the fight ends. | [COMBAT.md §8.1](contracts/COMBAT.md#81-arena-and-intro) |
| **Waystone** | A checkpoint prop: walking close **attunes** it (the respawn point); Space **rests** (full heal, draughts topped up to 3, enemies return). | [COMBAT.md §6.12](contracts/COMBAT.md#612-waystones-chests-shop-engagement) |
| **Chest / upgrade** | A treasure prop opened with Space on a combat level; it can hold gold, draughts and a permanent upgrade (Max HP +20, Max MP +10, Attack +3). | [OBJECT_CATALOG.md](specs/OBJECT_CATALOG.md) |
| **HP / MP / SP** | Health, mana (for skills) and stamina (for dodges; attacks cost a little). At 0 SP the player is **winded** — slower recovery, never refused. | [COMBAT.md §6.2](contracts/COMBAT.md#62-resources) |
| **Healing Draught** | The consumable heal (40 % HP; carry up to 5; Bram and Odo sell them for 25 gold). | [COMBAT.md §6.7](contracts/COMBAT.md#67-healing-draught) |
| **Shop / wares / shopkeeper** | The combat gold sink: an NPC with the `shopkeeper` script sells draughts and three one-time **wares** (`SHOP_WARES`: Whetstone ATK +2, Ironbark Tonic max HP +15, Warding Charm DEF +3) from a dialogue menu. | [COMBAT.md §6.12](contracts/COMBAT.md#612-waystones-chests-shop-engagement) |
| **Combo (A1–A3)** | The 3-hit sword string: press attack again as the blade returns; A3 is the heavy finisher. | [COMBAT.md §6.4](contracts/COMBAT.md#64-melee-combo) |
| **Motion value (mv) / knockback (kb)** | The damage multiplier of a hit, and the distance it pushes the victim (divided by its mass). | [COMBAT.md](contracts/COMBAT.md) (conventions) |
| **Hit-stop** | A few frames in which combat freezes when a hit lands (4 f, more for finishers, crits and kills), while the camera shake, particles and UI keep running. Combat-local — `engine.time.timeScale` is never touched. | [Combat contract](contracts/COMBAT.md) |
| **i-frames / dodge roll / backstep** | Invulnerable frames: the roll (with a direction) and the backstep (without one) give the player a short window in which enemy hits miss. | [COMBAT.md §6.5](contracts/COMBAT.md#65-dodge-roll-backstep-perfect-dodge) |
| **Perfect dodge** | A roll that starts just before an enemy hit would land: *Perfect!*, enemies slow down for 0.6 s, SP and MP back. | [COMBAT.md §6.5](contracts/COMBAT.md#65-dodge-roll-backstep-perfect-dodge) |
| **Telegraph / wind-up** | How every enemy attack announces itself: a **wind-up** of at least 18 frames in which the enemy glows (the highlight pulse) and, for areas and ranged attacks, a red **ground marker** that fills up and resolves when it is full. | [COMBAT.md §7.3](contracts/COMBAT.md#73-telegraph-grammar-binding-for-every-enemy-attack) |
| **Lane / lock** | A long marker for arrows and charges; it follows the player, then **locks** (a white flash on its rim) 12–15 frames before it fires — the cue to move or roll. | [COMBAT.md §7.3](contracts/COMBAT.md#73-telegraph-grammar-binding-for-every-enemy-attack) |
| **Highlight** | The `Sprite3D` tint (`setHighlight`) that brightens a sprite's own shading — used for wind-ups, the elite shimmer and the boss's hit flash; short silhouette flashes use `setFlash`. | [Sprite rendering](architecture/modules/sprite.md) |
| **Attack token** | A slot an enemy must hold to attack (3 melee, 2 ranged at a time), so a pack takes turns instead of all striking at once. | [COMBAT.md §7.5](contracts/COMBAT.md#75-attack-tokens-activation-engagement) |
| **Aggro / notice / leash / return** | An enemy **aggroes** when it sees the player (range and line of sight, or within 3 u), shows a `!` (**notice**) and wakes its pack; beyond its **leash** it walks home (**return**), guarded and healing. | [COMBAT.md §7.4](contracts/COMBAT.md#74-shared-state-machine-enemyjs) |
| **Dormant** | An enemy more than 32 u from the player that is not aggroed: it is not updated at all. | [COMBAT.md §7.4](contracts/COMBAT.md#74-shared-state-machine-enemyjs) |
| **Walk grid / path (`Nav`)** | The enemies' 0.5 u navigation grid (heights and open cells, built at load) and its bounded A*: chasers follow a path when the straight way is blocked (stairs, ledges, rocks) and walk home along one; no path within reach makes an enemy give up (**unreachable**). | [Combat navigation](architecture/GAME.md#15-combat-combat-levels-only) |
| **Zone** | A pack's part of the level: the first `region` containing its centre, grown to hold its home disc. A pack wakes only packs of its zone, does not see a player outside zone + 3 u and turns back when it leaves that margin. | [Combat navigation](architecture/GAME.md#15-combat-combat-levels-only) |
| **Poise / stagger / Broken / stun** | Hits drain **poise**; at 0 the enemy **staggers** (the boss is **Broken** for 3 s). A boar or the boss charging into a wall or brazier is **stunned**. | [COMBAT.md §7.4](contracts/COMBAT.md#74-shared-state-machine-enemyjs), [§8.3](contracts/COMBAT.md#83-phases) |
| **Kneel** | The boss's collapse at 35 % HP: its core is exposed for 90 frames (every hit a crit, damage capped at 8 % of its HP). | [COMBAT.md §8.3](contracts/COMBAT.md#83-phases) |
| **Lock-on / soft target / boss framing** | **L** locks the camera focus and attacks onto one enemy; without a lock, attacks turn toward the nearest enemy in front (**soft target**); during the boss fight the camera keeps the boss in frame. | [COMBAT.md §6.9](contracts/COMBAT.md#69-targeting-and-lock-on-targetingjs) |
| **Engaged** | True while aggroed enemies are near: battle music, a tighter depth of field, no photo mode, no resting. | [COMBAT.md §6.12](contracts/COMBAT.md#612-waystones-chests-shop-engagement) |
| **Sub-step / combat clock / stepped mode** | Each frame's time is split into equal steps of at most 1/60 s; the hooks' `step(n)` advances exact frames, so a scripted fight repeats bit for bit. | [Combat contract](contracts/COMBAT.md), [AUTOMATION_API.md §3.4](specs/AUTOMATION_API.md#34-window__gamecombat-combat-levels-only) |
| **Height model / body band** | One rule for line of sight, arrows, bolts and the level validator: a shot runs from ground + 0.9 to the target's body middle and is blocked by terrain above it; a hit needs the projectile to overlap the target's body band. | [COMBAT.md §7.6](contracts/COMBAT.md#76-movement-separation-line-of-sight-projectiles) |
| **Hurt radius / move radius / separation** | Hits test the **hurt** radius, movement the **move** radius; overlapping actors are pushed apart in inverse proportion to their mass (enemies have no TileMap colliders). | [Combat contract](contracts/COMBAT.md) |
| **Pickups / magnet** | Coins, hearts, mana motes, draughts, upgrades and the boss's core pop out of defeated enemies and chests and fly to a player within about 2 u. | [COMBAT.md §7.8](contracts/COMBAT.md#78-loot) |
| **Results card** | The summary shown after the boss falls: time, foes defeated, falls, perfect dodges, level. | [COMBAT.md §6.12](contracts/COMBAT.md#612-waystones-chests-shop-engagement) |
| **GLAIVE / encounter / beat** | The tabletop rules the turn-based combat follows ([GLAIVE.md](specs/GLAIVE.md)); one fight's rules state (`Encounter`); one thing that happened in it (an attack, a save, a move), which the stage animates and the log writes. *The old real-time terms — combat fixture, greedy run, play-through bot — went with the real-time combat.* | [GLAIVE.md](specs/GLAIVE.md) |
| **Fixed step / digest** | The bot's deterministic mode: the page is loaded with `&fixedstep=1` (`Engine#manualStep`, no animation loop), the bot steps the engine at exactly 1/60 s and a virtual page clock replaces the timers; the run's `digest` (a hash of every actor's state, every frame) is the same for the same code on any machine load. | [Automation API](specs/AUTOMATION_API.md) |

---

## The editor

| Term | Definition | Details |
| --- | --- | --- |
| **`EditorState`** | The single source of truth of the editor: the level document, selection, active tool, undo / redo. Views and tools never keep their own copy. | [EDITOR.md](architecture/EDITOR.md) |
| **Transaction** | `begin()` … `commit()` around a set of mutations; one transaction = one undo step (a whole stroke or drag). Mutations outside one are auto-wrapped. | [EDITOR.md](architecture/EDITOR.md) |
| **Stroke** | One pointer-down → move → up gesture of a tool (a paint stroke, a drag). | [EDITOR.md](architecture/EDITOR.md) |
| **`PointerEv`** | The view-agnostic pointer event a view sends to a tool: the tile (`i`, `j`), the world point (`x`, `y`, `z`), the button, the Shift / Ctrl / Alt modifiers, the view (`2d` / `3d`), the object or spawn under the pointer, and `cancelled` when a gesture was interrupted. | [EDITOR.md](architecture/EDITOR.md) |
| **Tool preview** | What a tool asks the views to draw while hovering or dragging (brush outline, ghost object, box). | [EDITOR.md](architecture/EDITOR.md) |
| **`change` event** | Emitted by `EditorState` after each mutation with the dirty object ids and tile rectangles, so views update incrementally. | [EDITOR.md](architecture/EDITOR.md) |
| **Job queue** | The 3D viewport's one-job-per-frame queue of incremental rebuilds (terrain chunks, water, prop batches) that keeps strokes at the display rate. | [EDITOR.md](architecture/EDITOR.md) |
| **Ghost** | The translucent preview of the object the Place tool will put down. | [LEVEL_EDITOR_GUIDE.md](user/LEVEL_EDITOR_GUIDE.md) |
| **Project folder** | `public/levels/<name>.json`, written through the dev server's level API (only under `npm run dev`). | [LEVEL_STORAGE_API.md](specs/LEVEL_STORAGE_API.md) |
| **Browser slot** | A level kept in `localStorage` under `luminati.level.<slot>`; the game opens one with `?level=local:<slot>`, the editor with `?local=<slot>`. | [LEVEL_STORAGE_API.md](specs/LEVEL_STORAGE_API.md) |
| **Play-test slot** | The browser slot `__playtest__` the editor writes before opening the game on it (F5 / Play ▶). | [LEVEL_STORAGE_API.md](specs/LEVEL_STORAGE_API.md) |
| **Autosave / recovered work** | The working copy saved every ~20 s to the `__autosave__` slot; copies the editor could not offer are kept as *Recovered unsaved work*. | [LEVEL_EDITOR_GUIDE.md](user/LEVEL_EDITOR_GUIDE.md) |
| **Slug** | The file-safe name a display name becomes (`slugify`: lowercase, `a-z 0-9 -`); "Untitled" becomes `untitled`. | [LEVEL_STORAGE_API.md](specs/LEVEL_STORAGE_API.md) |
| **`window.__editor`** | The automation hook of the editor page: `app, state, tools, view3d, view2d, textures, ready3d`. | [AUTOMATION_API.md](specs/AUTOMATION_API.md) |

---

## Tools, verification and process

| Term | Definition | Details |
| --- | --- | --- |
| **Harness** | `npm run check` ([`tools/check.mjs`](../tools/check.mjs)): starts its own Vite server, drives headless Chrome on the real GPU, writes screenshots and `report.json` to `.check/<out>/`. The project's equivalent of a test run. | [TESTING_AND_VERIFICATION.md](development/TESTING_AND_VERIFICATION.md) |
| **Action script** | A JSON list of harness steps (`wait`, `key`, `press`, `eval`, `shot`, `fps`, `click`, `dblclick`, `move`, `mouse`, `drag`, `wheel`, `type`, `combo`, `goto`, `tab`). | [AUTOMATION_API.md](specs/AUTOMATION_API.md) |
| **`.check/`** | The gitignored folder of harness outputs; disposable and local to each checkout. Share only the relevant, reviewed output when reporting a problem. | [DEVELOPMENT_WORKFLOW.md](development/DEVELOPMENT_WORKFLOW.md) |
| **Fingerprint** | Hashes of Emberfall's lights, colliders and meshes (plus interactables and the program count) used to prove a change did not alter the reference level. | [TESTING_AND_VERIFICATION.md](development/TESTING_AND_VERIFICATION.md) |
| **Binding contract** | An engine or feature specification that defines names, interfaces and behavior that changes must preserve. Additions need corresponding documentation and typed interfaces; the contract index lists the applicable documents. | [contracts/README.md](contracts/README.md) |
| **Module notes** | `docs/contracts/MODULE_NOTES.md`: the builders' and auditors' descriptive notes per module — not binding, partly stale. | [contracts/README.md](contracts/README.md) |
| **Type check** | `npm run typecheck` ([`tools/typecheck.mjs`](../tools/typecheck.mjs)): `tsc` with `checkJs` over the plain JavaScript and its JSDoc in two programs (`src/` + `sandbox/`; the Node `tools/`). Emits nothing; Vite never type-checks. | [CONVENTIONS.md §3.1](development/CONVENTIONS.md#31-the-type-check) |
| **Contract types (typed copy)** | The types a contract's interfaces are declared as and the code is checked against: `src/engine/level/types.d.ts` (level format), `src/game/combat/types.d.ts` (combat §9), `Tool` / `PointerEv` (editor tools), `GameHooks` / `EditorHooks` / `LuminatiHooks` (automation). Written from the code; where the contract text differs they follow the code. | [CONVENTIONS.md §3.1](development/CONVENTIONS.md#31-the-type-check) |
| **Module augmentation** | Declaring extra members of a class from a folder's `types.d.ts` (`declare module './Foo.js' { interface Foo { … } }`) — how fields created lazily (`this._x ??= …`) are typed without a code change. Never a `Foo.d.ts` beside `Foo.js`. | [CONVENTIONS.md §3.1](development/CONVENTIONS.md#31-the-type-check) |
| **Mutation test** | Breaking the code on purpose (renames, typos, wrong shapes), one change at a time in a copy of the tree, to measure what a check catches without changing the working tree. | [TESTING_AND_VERIFICATION.md §8.4](development/TESTING_AND_VERIFICATION.md#84-the-type-check) |
| **`level:check`** | `npm run level:check -- <level>` ([`tools/check-level.mjs`](../tools/check-level.mjs)): the generators' level checks (`checkLevel` of [`tools/lib/levelcheck.mjs`](../tools/lib/levelcheck.mjs)) on any level file — reachability, stairs, bridges, waterfalls, overlaps, what the camera cannot see; `--strict` for the generators' bar; `--campaign=<name>` for a whole campaign (every level file and the links between them). | [LEVEL_DESIGN_GUIDE §14](design/LEVEL_DESIGN_GUIDE.md#14-validation) |
| **`docs:check`** | `npm run docs:check` ([`tools/check-docs-links.mjs`](../tools/check-docs-links.mjs)): validates every relative link, image and anchor in `docs/` and all root Markdown files. | [DEVELOPMENT_WORKFLOW.md](development/DEVELOPMENT_WORKFLOW.md) |
