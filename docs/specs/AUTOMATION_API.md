# Automation API

> **Purpose.** Everything a script, test or AI agent can use to drive Luminati without a human: the
> page globals (`window.__game`, `window.__luminati`, `window.__engine`, `window.__editor` and the
> sandbox hooks), the URL query parameters of every page, and the headless check harness
> (`npm run check`, [`tools/check.mjs`](../../tools/check.mjs)) with every action-script step. It
> ends with worked recipes: scripting a playthrough, driving the editor, play-testing a level,
> measuring performance.
>
> **Audience.** AI agents and developers who verify changes, write regression scripts or capture
> screenshots; anyone extending the hooks.
>
> **Source of truth.** [`src/game/Game.js`](../../src/game/Game.js) (`_exposeGlobal`, `state`),
> [`src/main.js`](../../src/main.js) (`exposeHook`, query parameters),
> [`src/engine/core/Engine.js`](../../src/engine/core/Engine.js) (`window.__engine`),
> [`src/editor/EditorApp.js`](../../src/editor/EditorApp.js) (`window.__editor`, editor query
> parameters), [`tools/check.mjs`](../../tools/check.mjs) (the harness), the sandbox pages in
> [`sandbox/`](../../sandbox/) and their helper modules; the hook types (`GameHooks`,
> `EditorHooks`, `LuminatiHooks`, `CombatHooks`, `CampaignHooks`, [`src/globals.d.ts`](../../src/globals.d.ts)). The `__game` return values, the recipes
> and the `tab` behaviour on this page were checked with the harness against the current code.
>
> **Related.** [../development/TESTING_AND_VERIFICATION.md](../development/TESTING_AND_VERIFICATION.md)
> (when and what to verify) · [INPUT_AND_CONTROLS.md](INPUT_AND_CONTROLS.md) (key codes and
> actions) · [LEVEL_FORMAT.md](LEVEL_FORMAT.md) · [LEVEL_STORAGE_API.md](LEVEL_STORAGE_API.md) ·
> [../ai/AGENT_ONBOARDING.md](../ai/AGENT_ONBOARDING.md) ·
> [../architecture/GAME.md](../architecture/GAME.md) · [../architecture/EDITOR.md](../architecture/EDITOR.md)

---

## Contents

1. [Pages and globals at a glance](#1-pages-and-globals-at-a-glance)
2. [Query parameters](#2-query-parameters)
3. [`window.__game`](#3-window__game) (… [3.8 `__game.party`](#38-window__gameparty-every-level))
4. [`window.__luminati`](#4-window__luminati)
5. [`window.__engine`](#5-window__engine)
6. [`window.__editor`](#6-window__editor)
7. [Sandbox hooks](#7-sandbox-hooks)
8. [The check harness (`npm run check`)](#8-the-check-harness-npm-run-check)
9. [Action scripts](#9-action-scripts)
10. [Recipes](#10-recipes)
11. [Pitfalls](#11-pitfalls)

---

## 1. Pages and globals at a glance

| Page | Global | Set when | Wait for readiness with |
| --- | --- | --- | --- |
| `game.html` (game) | `window.__luminati` | at boot (storage helpers), updated after the level loads and after warm-up | `window.__luminati.loadMs` (set when the first gameplay-ready frames are drawn and the loading screen starts to fade) |
| `game.html` | `window.__game` | at the end of `Game.init()`, before the title / play starts | `window.__game.state().mode === 'play'` |
| `game.html` | `window.__engine` | only with `?debug` or `?autostart` in the URL | — |
| `editor.html` | `window.__editor` | in the `EditorApp` constructor | `await __editor.app.ready` (first level loaded, 3D view created), then `await __editor.ready3d` (first full 3D build) |
| `sandbox/*.html` | `window.__core`, `__terrain`, `__props`, … | per page | see [§7](#7-sandbox-hooks) |
| `index.html` (the launcher) | none (no script) | — | the `load` event: its list is in the HTML |

All hooks are plain properties on `window`; `page.evaluate` / the harness `eval` step can use them
directly. They are for automation and debugging, not a stable public API for shipped games — but
agents and the sandbox scripts rely on them, so keep them backward compatible.

**Types.** Each hook object is typed next to the code that builds it — `GameHooks` (and
`GameState` for `state()`) above `Game._exposeGlobal` in [`Game.js`](../../src/game/Game.js),
`CombatHooks` in [`combat/types.d.ts`](../../src/game/combat/types.d.ts), `LuminatiHooks` above
`exposeHook` in [`main.js`](../../src/main.js), `EditorHooks` above the `EditorApp` class in
[`EditorApp.js`](../../src/editor/EditorApp.js), and every sandbox handle by a typedef in its sandbox
file — and [`src/globals.d.ts`](../../src/globals.d.ts) gives `window` those members.
`npm run typecheck` checks the objects against their typedefs (a member added without its typedef
line, or listed but never set, is an error) and the JavaScript that reads them — the game, the
editor and the sandbox helpers (`editor_shell.helpers.js`, `editor_perf.helpers.js`). The `eval` strings of the JSON action scripts are not
checked: a typo there shows only when the harness runs the script (KNOWN_ISSUES TC-01). A new hook
needs its typedef line, then a row here.

## 2. Query parameters

### Launcher (`index.html`)

No parameters: a plain page without script that lists every campaign and level with links into
the game and the editor (`game.html?campaign=<name>`, `game.html?level=<name>`,
`editor.html?open=<name>` / `?open=<campaign>/<level>`, `editor.html?new` / `?new=room`; on the dev
server also `sandbox/index.html` and `docs/index.html`). The list is written into the page by
[`tools/vite-launcher.js`](../../tools/vite-launcher.js) — on the dev server at every request, in a
build once — and a file it cannot list is named in a *Not listed* note (`.lu-skipped`). A query is
ignored, so a script that still opens `index.html?level=…` lands here, with no `window.__game`
([Launcher architecture](../architecture/OVERVIEW.md)).

### Game (`game.html` → [`src/main.js`](../../src/main.js))

| Parameter | Effect |
| --- | --- |
| *(none)* | Plays Emberfall (`public/levels/emberfall.json`). |
| `level=<name>` | Plays `public/levels/<slugify(name)>.json` (served as `levels/<slug>.json`, also in production builds). |
| `level=local:<slot>` | Plays the level in browser storage slot `<slot>` (`localStorage["luminati.level.<slot>"]`). The editor's play-test uses `local:__playtest__`. |
| `autostart` | Skips the title screen and enters play at once. `autostart=0` counts as off (but still exposes `window.__engine`). Audio unlocks at the first key or click. |
| `debug` | Exposes `window.__engine` (also done by `autostart`). |
| `fixedstep` | Together with `autostart` or `debug` (alone it is ignored; `fixedstep=0` counts as off): the engine starts in **manual-step mode** (`Engine#manualStep`) — no animation loop, frames advance only through `engine.step()`. The fight scripts load the level this way ([§10.6](#106-playing-a-fight-in-fixed-step)). A page in this mode stands still until a script steps it. |
| `lang=en\|ja\|zh` | The language for this load (also `ja-JP`, `zh-CN` …), not saved; else the saved choice (`localStorage['luminati.lang']`), else English — never the browser's locale ([I18N.md §1](I18N.md#1-choosing-the-language)). |
| `fonts=auto\|google\|local\|google-fail\|gstatic-fail` | How the UI fonts load ([I18N.md §5](I18N.md#5-fonts)): `auto` (default) Google Fonts first, then the copies in `dist/`; `google` / `local` one source only; `google-fail` / `gstatic-fail` force a Google failure (tests of the fallback). Also `localStorage['luminati.fonts']`. |
| `i18n=<table>` | One more content table to load, by id (`levels/<name>`, [I18N.md §4.3](I18N.md#43-loader-api)). The editor's play-test of a level outside a campaign adds `&i18n=<origin>`, the table of the project file the level was opened from (a copy saved under another name keeps it: `EditorState#origin`), so a browser-slot level is translated like its file. It only adds the table: the keys are in the level's data ([I18N.md §4.2](I18N.md#42-keys-and-lookup)). Ignored in English. |
| `campaign=<name>` | Plays the campaign `public/campaigns/<name>/` ([CAMPAIGN_FORMAT.md §6.1](CAMPAIGN_FORMAT.md#61-starting)): the saved game in this browser, else its start. With it: `new=1` forgets the saved game; `level=<id>[&entrance=<name>]` starts in that level of the campaign (a fresh story; a chapter variant id plays as its level); `level=local:<slot>&as=<id>` plays a browser-slot level as level `<id>` (the editor's play-test; a `level=` start saves under `luminati.campaign.<name>.test`, never over the real game); `story=<preset>` starts a new game from a story start preset ([STORY_SCRIPT.md §8](STORY_SCRIPT.md#8-story-files)). |

A level that cannot be loaded shows the reason on the loading screen (e.g.
`Could not load level "nope-level": Level "nope-level" not found`, or `… the file is not valid level
JSON (…)`) with links "Play Emberfall", "Play Cinderwatch Pass" (each unless it is the level that
failed) and "Open the level editor"; no `window.__game` is created
(scripts can read `#loading .label`). The bar is hidden in the error state; the message and the links
are in the page's language (`t('game.error.*')`; the console's English). On a Japanese or Chinese page
the loading screen's static English texts are hidden (`#loading .is-pending`) until `src/main.js`
writes the translated ones, at most 2.5 s. Normalisation warnings and validation errors go to the
console as `[Luminati] <source>: <message>` warnings.

### Editor (`editor.html` → [`EditorApp._openFirst`](../../src/editor/EditorApp.js))

| Parameter | Effect |
| --- | --- |
| `open=<name>` | Opens `public/levels/<slugify(name)>.json`. If this browser holds an autosave of that same project level from another session, the restore prompt is offered. `open=<campaign>/<name>` opens a campaign's level, `public/campaigns/<campaign>/levels/<name>.json`. |
| `local=<slot>` | Opens browser slot `<slot>` (same restore rule for that slot). |
| `new` | Starts an empty "Untitled" 32 × 24 level; no restore prompt. `new=room` starts a new room instead, as File › New › *Room (interior)* makes it. |
| *(none)* | Offers to restore an unresolved autosave from an earlier session, otherwise starts empty. |

A start through `open` / `local` / `new` never destroys an earlier session's autosave: it moves to
File › Open › This browser › Recovered unsaved work once this session autosaves
([LEVEL_STORAGE_API.md §3](LEVEL_STORAGE_API.md#3-browser-storage-localstorage)).

### Sandbox pages

| Page | Parameters |
| --- | --- |
| `sandbox/game_levels.html` | `case=<tiny\|bare\|wetspawn\|stormnight\|everything\|hamlet\|moved\|hostile>` builds a test level, saves it to slot `test-<case>` and opens `game.html?level=local:test-<case>&autostart=1`; `autostart=0` shows the title. Without `case`: a list of buttons. |
| `sandbox/editor3d.html` | `level=<name>` (a project level; default, or when it cannot be loaded: a generated test valley of `size=<n>` × `<n>` tiles, default 64), `empty` (a blank 32 × 24 level), `time=<hour>` (default 14), `postfx`, `atmosphere`, `realtools` (use the editor's real tools). |
| `sandbox/terrain.html` | `time=<day\|golden\|night>` (default `day`), `view=<diorama\|overview\|cliffs\|waterfall\|edge\|pond\|terrace\|fringe\|lip>` (default `diorama`) |
| `sandbox/props.html` | `mode=<lot\|gallery>`, `night=1`, `merge=1`, `view=<name>` |
| `sandbox/textures.html` | `view=<gallery0…3\|atlas\|diorama>`, `night=1`, `only=`, `group=`, `scale=`, `aux=0`, `tiles=` |
| `sandbox/sprite_art.html` | `mode=<gallery\|focus\|frames\|walk\|creatures\|props>` (default `gallery`), `names=a,b`, `z=<zoom>`, `t=<time>`, `cols=`, `rows=`, `dir=` |
| `sandbox/lighting.html` | `t=<hour>`, `post=0`, `speed=<h/s>`, `view=<name>` |
| `sandbox/postfx.html` | `samples=`, `scale=`, `gui`, `freeze`, `label` |
| `sandbox/ui_art.html` | `page=frames\|pieces\|type\|logo\|titles`; `lang=` |
| `sandbox/title_ui.html` | `state=menu\|chooser\|changed\|plain`; `langs=1`, `focus=1`; `name=cinderwatch\|ferryman\|interiors\|brightwater\|long`; `lang=` |
| `sandbox/map_ui.html` | `case=emberfall\|cinderwatch\|campaign\|painted`; `map=1`; `lang=` |
| `sandbox/party_ui.html` | `combat=1` |

[`sandbox/index.html`](../../sandbox/index.html) links every sandbox with its useful views.

## 3. `window.__game`

Created by `Game._exposeGlobal()` ([`Game.js`](../../src/game/Game.js)) and removed when the game
is disposed. Typed by `GameHooks` (`state()` by `GameState`), the full member list.

### 3.1 Objects

| Member | What it is |
| --- | --- |
| `game` | the `Game` instance (everything below is also reachable from it) |
| `engine` | `Engine` (renderer, scene, camera, `input`, `time`, systems) |
| `rig` | `CameraRig` (`yaw`, `pitch`, `distance` in radians / units, `focusPoint`, `bounds`, `setAngles(yawDeg, pitchDeg)`, `snap()`) |
| `postfx` | `PostFX` (settings, `sceneInfo`, `enableTimings(true)` + `timings`) |
| `lighting` | `LightingSystem` (`timeOfDay`, `nightFactor`, `phaseName`, `timeSpeed`, `paused`) |
| `ui` | the DOM overlay (`dialog`, `hud`, `banner`, `title`, `prompt`, `minimap`, `worldMap`, `debug`; `combat`, `journal` / `emotes` / `endCard`, `party` where they exist; the scale `px`, `fpx`, `cornerShrink`, `artW`, `artH`; `lang`, `fonts`). Test hooks there: `ui.title.language` → `{ current, selected, focused }` or null (the title's language row); `ui.banner.box` → the area banner's keep-out `{ x, y, w, h, fit }` (art px) while it shows, else null; legend rows carry `data-id` (`.lu-help [data-id="map"]`) |
| `audio` | `AudioSystem` (`ready`, `musicPlaying`, `playSfx(name)`) |
| `tileMap` | `TileMap` (`getHeight(x, z)`, `isWalkable(x, z)`, `tileAt(i, j)`, colliders) |
| `textures`, `particles`, `godRays` | `TextureLibrary`, `Particles`, `GodRays` |
| `player` | `Player` (`position`, `facing`, `speed`, `sprite`) |
| `npcs` | `Npc[]` (each has `id`, `name`, `position`, `behaviour`, `talking`) |
| `world` | `World` (`built`, `interactables`, `lights`, `lightPool`, `stats`, `falls`, `fires`, `fallAnchors`, `batching`; with a story `storyGroups`, `storyRanges`). Each `interactables` entry is `{ id, position, radius, label, kind, prompt, lookSpan, text }`; `lookSpan` is `{ a, b }` (two `THREE.Vector3`, the door leaf's edges) for house doors and `null` otherwise ([GAME.md §3.5](../architecture/GAME.md#35-interactions-and-the-conversation-flow)) |
| `weather` | `Weather` (`weather`, `time`, `snowCover`, `tuning`; `indoors` and `shown`: in a room — `environment.interior` — the weather goes on but shows clear skies) |
| `level` | the normalised level object being played |
| `levelSource` | where it came from: `levels/<slug>.json` or `local:<slot>` |
| `combat` | **combat levels only** (a level with `enemy` objects or `environment.combat: true`): the combat test hooks of [§3.4](#34-window__gamecombat-combat-levels-only); absent on peaceful levels |
| `party` | every level: the party hooks of [§3.8](#38-window__gameparty-every-level) (the party itself is made on the first `join`) |

### 3.2 Methods

| Method | Returns | Behaviour |
| --- | --- | --- |
| `state()` | object ([§3.3](#33-state-shape)) | Snapshot of the game for assertions. |
| `teleport(x, z)` | `{ x, y, z }` or `null` | Moves the player to `(x, z)`, or to the nearest standable spot within 3 units (water, walls, off-map points snap); `null` (and no move) when there is none. Snaps the camera, the point-light pool and the focus. |
| `talkTo(id)` | `boolean` | Walk-free talk: places the player beside the NPC (side by side, then in front, then behind), faces it and starts its conversation. `false` for an unknown id, or while busy, talking, in photo mode or not in play. Closes the world map first. |
| `setTime(h)` | current hour (number) | Jumps to hour `h` (wrapped to 0–24). Non-numbers are ignored. |
| `cycleTime()` | the preset's hour | Glides (2 s) to the next time preset (6.5, 12.5, 17.2, 18.9, 22.5) and toasts its name. |
| `setWeather(name)` | the current weather name | `"clear"`, `"rain"` or `"snow"` (blended over a few seconds); an unknown name changes nothing and returns the current weather. |
| `cycleWeather()` | the new weather name | clear → rain → snow → clear, with a toast (in a room: "… outside" — the weather changes, none shows inside). |
| `setMusic(on)` | `boolean` (music wanted / playing) | Starts or stops the procedural music (it starts sounding once audio is unlocked). |
| `photo(on = !photoMode)` | `boolean` (photo mode) | Enters / leaves photo mode with the UI hidden **at once** (no hint toast). Refused (returns `false`) while talking, with the map open or not in play — and on combat levels while engaged or dead (toast "Not while foes are near"). On combat levels photo mode also freezes the player and pauses combat. |
| `map(on = !mapOpen)` | `boolean` (map open) | Opens / closes the world map. Refused while talking, in photo mode or not in play (combat levels: also while dead or in the boss intro). The open map pauses combat and releases the lock-on. |
| `setLanguage(code)` | the language saved (`'en'` \| `'ja'` \| `'zh'`; anything else: English) | The title's language switch: saves the choice (`localStorage['luminati.lang']`), drops `?lang=` from the address and **reloads the page** — unsaved play is lost, and `window.__game` goes with the page. The page's own language with no `?lang=` to drop changes nothing. ([I18N.md §1](I18N.md#1-choosing-the-language)) |

Talking is asynchronous: `talkTo` returns `true` as soon as the conversation starts. Advance it
with key presses (`confirm`: Space / Enter / F) and poll `state().dialogOpen`
([§10.1](#101-script-a-playthrough)).

### 3.3 `state()` shape

Captured on Emberfall at night in the rain:

```json
{
  "mode": "play",
  "level": "Emberfall",
  "player": { "x": 19.45, "y": 1, "z": 20.1, "tile": { "i": 19, "j": 20 }, "facing": "left", "animation": "idle_left", "speed": 0 },
  "region": "Village Square",
  "time": 21.556,
  "phase": "night",
  "night": 1,
  "weather": "rain",
  "weatherShown": "rain",
  "dialogOpen": false,
  "busy": false,
  "photoMode": false,
  "mapOpen": false,
  "music": true,
  "audioReady": true,
  "nearest": "elder",
  "drawCalls": 218,
  "triangles": 341358,
  "fps": 60,
  "pointLights": 12,
  "activeLights": 12,
  "renderScale": 1,
  "pixelRatio": 1,
  "gpuMs": 7.21,
  "camera": { "yaw": 0, "pitch": 32, "distance": 30, "focus": [19.45, 2, 20.1] },
  "inventory": { "apples": 0 },
  "lang": "en",
  "fonts": { "mode": "local", "px": 2, "sources": { "latin": "local" }, "ms": 160 }
}
```

| Field | Meaning |
| --- | --- |
| `mode` | `"loading"`, `"title"` or `"play"` |
| `level` | `level.name` |
| `player` | position (3 decimals), tile indices, facing (`down`/`up`/`left`/`right`), sprite animation (`idle_*`, `walk_*`, `run_*`), measured speed (units/s) |
| `region` | name of the current `region` object ("" before the first one is entered) |
| `time`, `phase`, `night` | hour (0–24), nearest lighting keyframe name (`night`, `late night`, `pre-dawn`, `pink dawn`, `sunrise`, `morning`, `noon`, `afternoon`, `golden hour`, `sunset`, `purple dusk`, `blue hour`), night factor 0–1 |
| `weather` | `clear` / `rain` / `snow` — the weather (a campaign's goes on through its rooms) |
| `weatherShown` | the weather the level shows: `weather`, or `clear` in a room (`environment.interior`, LevelLook.shownWeather) |
| `dialogOpen`, `busy` | a dialog is open; the player is frozen by a conversation or a fade |
| `photoMode`, `mapOpen` | UI states |
| `music`, `audioReady` | music wanted / playing; AudioContext running |
| `nearest` | id of the interactable the prompt points at, or `null`: an NPC id, a signpost / well id, or `door:<house id>` (also while the player stands against the wall facing the door) |
| `drawCalls`, `triangles` | of the last scene render (shadow pass included) |
| `fps` | smoothed frame rate |
| `pointLights`, `activeLights` | pooled lights (≤ 12) and how many are lit now |
| `renderScale`, `pixelRatio`, `gpuMs` | resolution governor state and its GPU-time estimate |
| `camera` | yaw and pitch in degrees, distance, focus point |
| `inventory` | items received (`apples` from Emberfall's merchant; a `shop` NPC adds the lower-cased item name — any name, `constructor` or `__proto__` too, is an ordinary key: the game's inventory has no prototype) |
| `lang` | the page's language: `'en'`, `'ja'` or `'zh'` ([I18N.md §1](I18N.md#1-choosing-the-language)) |
| `fonts` | the UI fonts: `{ mode, px, sources: { latin, ja?, zh? } ('google' \| 'local' \| 'none' \| 'pending'), ms }` (`ms` null until every set is in; `null` without a font loader); the full report is `window.__luminati.fonts` |
| `combat` | **combat levels only** (the key is absent otherwise): the combat state of [§3.5](#35-statecombat-combat-levels-only) |
| `campaign` | **campaigns only**: where the campaign stands ([§3.6](#36-window__gamecampaign-campaigns-only)) |
| `story` | **a story only**: the story's values, runs and events ([§3.7](#37-window__gamestory-a-story-only)); with a story, the generic shop's items are the story's (`story.items`), not `inventory` |
| `party` | **once a party exists** (the first join, or a save that holds members; the key is absent otherwise): the members and the tactics panel ([§3.8](#38-window__gameparty-every-level)) |

### 3.4 `window.__game.combat` (combat levels only)

The turn-based combat's test hooks ([`src/game/glaive/hooks.js`](../../src/game/glaive/hooks.js),
reference: [GLAIVE.md §10](GLAIVE.md#10-test-hooks)):

| Hook | Returns / does |
| --- | --- |
| `state()` | `state().combat` (§3.5) |
| `system` | the `GlaiveCombat` itself (scripted checks read `system.enemies`, `system.defeatedGroups()` …) |
| `choose(build = 'sellsword', ancestry = 'human')` | makes the player's character without the menus (closes the picker if it is open); the sheet as JSON |
| `fight(uidOrGroupId, ambush = null)` | starts a fight with that foe or group (`'party'`: the foes are surprised; `'foes'`: the party saves against surprise); the boss: its arena fight |
| `auto(on = true)` | the companions' AI plays the player's turns (an open turn menu closes) |
| `pace(k = 1)` | the stage's speed-up (0.1–20) |
| `god(on = true)` | +900 max HP for the party, full HP |
| `xp(n)` → levels owed · `levelUp(talent, ability)` → boolean | progress without the menus |
| `rest(id?)` → boolean | attunes a waystone (default: the checkpoint) and rests there |
| `reset()` | every foe home and whole, the boss too, pickups cleared, no fight |
| `kill(uid)` → boolean | a foe falls at once: its XP, no loot, its `kill` event (the content tours) |
| `freezeAI(on = true)` | foes never notice the player and the boss's arena does not close (the content tours) |
| `foes()` / `enemies()`, `log()` | the foes (uid, kind, group, alive, hidden, boss, position); the last log lines |
| `showcase()` | every effect, marker style and pickup once (program checks) |

Fights advance with the frames. In manual-step mode (`fixedstep=1`) a script plays a fight quickly
by stepping without drawing: `for (…) __engine.step(1 / 30, { render: false }); __engine.redraw();`.
The dialog box closes on a real-time timer, so give a menu a few hundred milliseconds of real time
after a key press before reading the next state.

### 3.5 `state().combat` (combat levels only)

`rules: 'glaive'`, `player` (HP, max HP, AC, level, XP, XP to next, silver as `gold`, draughts,
`build`, `ancestry`, `abilities`, `talents`, `spells`, `casts`, `fatigue`, `wounds`, `checkpoint`,
`deaths`, `chosen`), `engaged`, `fight` — null between fights, else `{ round, current, needsInput,
order, combatants: [{ id, side, kind, hp, hpMax, state, x, z, conditions }], options (the player's
choices while it is their turn), picking (the target under the picker), cursor (the ground
cursor), busy (the stage is playing) }` —, `fights`, `kills`, `bossDefeated`, `enemies: { total,
alive }`, `boss: { uid, alive, defeated }`, `log` (the last 12 lines), `markers`, `pickups`,
`tutorial`, `shop: { purchased }` and, once a companion fights here, `allies`.

### 3.6 `window.__game.campaign` (campaigns only)

Present while a campaign plays (`?campaign=`; [CAMPAIGN_FORMAT.md](CAMPAIGN_FORMAT.md)); typed by
`CampaignHooks` in [`CampaignRuntime.js`](../../src/game/campaign/CampaignRuntime.js).
`window.__game` is replaced after every travel (new world, player, villagers): read it again after
a `travel`, never keep the old object.

| Hook | Effect / result |
| --- | --- |
| `info()` | Where the story stands (the same as `state().campaign`, below). |
| `travel(to, entrance?)` | Switch to level `to` (a base id; the chapter picks the file) at `entrance`, else across the seam, else its player start → `Promise<boolean>` (false: the file could not be loaded, the level failed to build — the player is put back —, or a travel runs). A story script that is running ends first (up to 10 s). |
| `exit(id)` | Use exit `id` of the current level as the player would (its `requires` check and `locked` text included) → `Promise<boolean>`. |
| `setFlag(flag)` | Set a story flag → true when it was new (a new chapter shows its banner; variants apply from the next travel). |
| `has(flag)` | Is a flag set. |
| `save()` | Save now → false when browser storage refused (or before the game has started). |
| `newGame()` | Forget the saved game and travel to the start → `Promise<boolean>`. |

On the runtime itself (`__game.game.campaign`, not in the hook object): `titleOptions()` → the
title screen's options, translated — `title`, `titleSource` (the English name), `subtitle`,
`prompt`, `credit`, and with a saved game `menu: true`, `destinations` (`continue` with its
`detail`, then `new`) and `current: 'continue'`; `saveLine()` → the Continue entry's second line:
the place of the saved spot (its region, else the level), `Lv n` once combat progress exists and
the time played (`h:mm:ss`), e.g. `Millbrook · Lv 3 · 0:12:40`; the place alone for a save without a
play time. (`state().campaign` and the save keep English identities in every language.)

`state().campaign`:

```json
{ "name": "ferrymans-lantern", "title": "The Ferryman's Lantern", "level": "mill-road", "file": "mill-road",
  "chapter": "the-flood", "flags": ["hollis-at-ford"],
  "exits": [{ "id": "exit_west", "to": "millbrook", "entrance": "", "mode": "walk", "requires": "", "open": true }],
  "armed": true, "traveling": false, "visited": ["millbrook", "mill-road"], "mapLevels": ["millbrook", "mill-road", "old-quarry"],
  "started": true, "test": false,
  "stats": { "travels": 1, "lastMs": 548, "lastBuildMs": 171, "prepared": 1,
             "lastPrep": { "to": "mill-road", "file": "mill-road", "state": "taken", "cpuMs": 147.2, "slices": 21,
                           "maxSliceMs": 8.5, "steps": 3045, "maxStepMs": 2.8, "maxStepAt": "Planting the forest",
                           "ms": 352, "used": true },
             "kept": 0, "lastKept": false, "lastAside": "", "dropped": 0 },
  "prep": null,
  "aside": [] }
```

`level` is the base id, `file` the file played for it (a chapter's variant; a start on a variant
with `&level=` / `&as=` plays the variant's text under the base `file`, and the game's `source`
names the variant's file — [§4](#4-window__luminati)); `armed`: walk exits
fire (false until the player has stood outside every exit since arriving or a refusal); `flags`:
the story variables that are not 0; `open`: the exit is there as the story stands and its
`requires` holds; `started`: saves are allowed (after the warm-up); `test`: the play-test save key;
`stats`:
the last travel from the fade-out to the fade-in (`lastMs`) and its `swapLevel` part
(`lastBuildMs`), the travels that used a level built ahead (`prepared`) and the last travel's
preparation (`lastPrep`, null when it had none; `used`: false when the story or the file had
changed since); the levels set aside around rooms
([CAMPAIGN_FORMAT.md §6.3](CAMPAIGN_FORMAT.md#rooms-the-levels-set-aside)): `kept`, the travels
that attached a level set aside again instead of building it, `lastKept` whether the last one did,
`lastAside` where the last travel set the level it left aside (`parent`, `room`, `""` none),
`dropped` the levels set aside released since (replaced, dropped by a travel elsewhere, stale).
`prep`: the level being built ahead now (KNOWN_ISSUES CMP-01,
[GAME.md §3.9](../architecture/GAME.md#39-campaigns-the-level-half-and-swaplevel)), or null —
`state` (`loading`, `building`, `ready`, `failed`, then `taken` / `disposed`), its CPU
milliseconds, the idle slices that did some work, the longest slice and step (`maxStepAt`: the
build phase it was in, or `parse`), the build steps run and the wall milliseconds from its start to
ready (or now) — never a level set aside. `aside`: the levels set aside now, `[{ slot, level, file
}]` (`slot` `parent`: the level the player came from while they are in rooms; `room`: the last
room). `__game.game.campaign.prepareAhead = false` stops building levels ahead,
`__game.game.campaign.keepRooms = false` stops setting levels aside and releases those set aside
now (every travel builds its level and releases the one left, as before — A/B checks),
`__game.game.campaign.dropAside()` releases the
levels set aside now. Scripted checks: [`sandbox/campaign.travel.json`](../../sandbox/campaign.travel.json)
(travel, seams, the locked door, the combat level and back, the chapter variant, save and continue,
program counts after each arrival), [`sandbox/campaign.title.json`](../../sandbox/campaign.title.json)
(Continue / New journey), [`sandbox/campaign.prepare.json`](../../sandbox/campaign.prepare.json) /
[`campaign.prepare.big.json`](../../sandbox/campaign.prepare.big.json) (travel times, the frames
of the walks toward the exits while the next level is built ahead, the built worlds' hashes; the
helpers in [`campaign_prepare.js`](../../sandbox/campaign_prepare.js), `window.CP`) and
[`campaign.prepare.checks.json`](../../sandbox/campaign.prepare.checks.json) (a story change before
the travel, the rollback of a failed attach and of a failed build),
[`campaign.interior.json`](../../sandbox/campaign.interior.json) /
[`campaign.interior.big.json`](../../sandbox/campaign.interior.big.json) (rooms: the levels set
aside and attached again — times, hashes, memory, programs, weather, the failure rollbacks; the
helpers in [`campaign_interior.js`](../../sandbox/campaign_interior.js), `window.CI`).

### 3.7 `window.__game.story` (a story only)

Present when the game plays a story — a campaign, or a level with an `event` or a villager with a
talk script or an actor ([STORY_SCRIPT.md](STORY_SCRIPT.md)); typed by `StoryHooks` in
[`StoryRunner.js`](../../src/game/story/StoryRunner.js). The story runtime belongs to the game's
persistent half: its state (and `auto`) carries over a campaign's travel, though `window.__game`
itself is replaced.

| Hook | Effect / result |
| --- | --- |
| `info()` | The story now (the same as `state().story`, below). |
| `get(name)` · `set(name, value = 1)` · `holds(cond)` | A flag / variable · set one (→ changed; with 1 or 0 also a flag of the older free form, `met hollis`) · does a condition hold (the `when` rule: one bare name is a flag). |
| `give(item, n = 1)` | Give (n < 0: take) an item, `gold` too → the count. |
| `run(lines)` | Queue a script (a string or lines) as if an event ran it → `Promise<boolean>` once it ended (false: it does not parse). Its lines have no content keys: they stay English in every language and record a `nokey` miss each ([I18N.md §4.2](I18N.md#42-keys-and-lookup)). |
| `fire(id)` | Queue level event `id`'s script, whatever its trigger and its `if` (its `once` is honoured; a `background` event goes to the background lane) → false for an unknown id. |
| `seed(n?)` | The journey's seed for `pick` (`story.seed`); a positive `n` sets it. The page's `&seed=<n>` gives a new journey that seed. |
| `auto(answers = true)` | Tests: dialogue opens no window; a choice takes the next of `answers` (`true`: always the first option); `false`: the player answers again. |
| `skip()` | Skip the cutscene running now (as holding Esc does) → false when there is none. |
| `trace()` | The last 60 executed lines (`<run>:<line> <command>`, dialogue as `“speaker: text”`, picks as `> label`) — always the **source** (English) text, in every language, so a trace compares across languages. |
| `journal()` | What the journal shows: `{ quests: [{ id, title, state, text, log, goals }], items: [{ id, name, count, text, key }], gold }`. |

`state().story`:

```json
{ "level": "mill-road", "vars": { "hollis-at-ford": 1, "bridge-mended": 1 }, "items": { "plank": 3 }, "gold": 0,
  "quests": { "find-ilse": { "state": "active", "stage": "bridge" } }, "day": 1,
  "done": ["millbrook.ev_planks", "once:hollis-asks"], "running": "", "queued": [],
  "background": [], "backgroundQueued": [],
  "events": [{ "id": "ev_ford", "on": "enter", "present": true, "done": true }],
  "ownsCamera": false, "errors": 0, "ending": "" }
```

`running` / `queued`: the run going on and those waiting (`talk:<level>/<npc>`,
`event:<level>.<id>`, `story:<id>`, `test:…`); `background` / `backgroundQueued`: the background
lane's runs and those waiting (`background: true` events; bark lines show in `trace()` as
`‹who: text›`); `errors`: script errors so far (parse errors and
failed commands; 0 in a clean run; a script text's parse errors count once: a parse is cached by
its source and its text with the `#line:` tags, so a chapter variant's unchanged talk is its base's
parse). The game
itself: `game.story` (the StoryRunner),
`game.toggleJournal(open)`, `game.journalOpen`. Scripted checks:
[`sandbox/story.play.json`](../../sandbox/story.play.json) (the demo story from the first
conversation to chapter two, with `auto(true)`: events, talk scripts, the walk-off, the bridge
cutscene, the cleared event, the welcome cutscene, the save, Continue), and the editor's
[`sandbox/editor_shell.story.json`](../../sandbox/editor_shell.story.json).

The turn-based combat's browser checks ([`sandbox/combat.glaive.fight.json`](../../sandbox/combat.glaive.fight.json),
[`sandbox/combat.glaive.boss.json`](../../sandbox/combat.glaive.boss.json)) drive fights through
the hooks of §3.4 in manual-step mode.

### 3.8 `window.__game.party` (every level)

The player's party ([PARTY.md](PARTY.md)); typed by `PartyHooks` in
[`src/game/party/types.d.ts`](../../src/game/party/types.d.ts) (the party core's two additions in
[`src/game/types.d.ts`](../../src/game/types.d.ts)). Present on every level: the party itself
(`game.party`, its chunk, the G binding, the party UI) is made on the first `join` — on a level
nobody joined `game.party` is null and `state()` has no `party` key. The party belongs to the
game's persistent half (it follows a campaign's travel); `window.__game` is replaced after a travel,
`__game.party` with it.

| Hook | Effect / result |
| --- | --- |
| `join(who, { cls, preset })` | A villager of this level joins (id, actor or name, case-insensitive; `cls` a class, `preset` a rule preset) → `Promise` of `info()`, or null: the party is full (3), it is a member already, no such villager is here (or the story has it away), a travel goes on. The villager is looked up first (`game.canJoin(who)`): a refused join makes no party. Its villager is hidden; the member appears where it stood and walks to the player. |
| `leave(who)` | A member leaves (id, actor or name) → false when it is none. On its own level its villager appears where it stood — its home from then on (with a story also in the story's memory of the level, as a script's `home`); elsewhere it goes (its villager is back home). |
| `rule(who, presetOrRule)` · `set(who, field, value)` | Its combat rule: a preset name or a partial rule merged over its own · one field → the rule now, or null (no member, a bad preset / field / value). |
| `menu(open = toggle, who)` | Open (on member `who`) / close the tactics panel → open now (`Game.togglePartyMenu` with `force`: also during a dialog; never outside play). |
| `info()` | `state().party`, or null without a party. |
| `trail(who?, max = 60)` | *(party core)* the follow as tests read it, or null: `{ n, total, length, points: [[x, z, y, run], …] (newest first), members: [{ id, k, mode, held, x, y, z, target: { x, z, short }, off, goal: { x, z }, gap, v, lat, side, hang, spacing, rest, anim, speed, snaps, catchups }], spacing, covers, stats: { snaps, catchups, placements, jumps, plans, unplaced } }` — `target` is the member's trail point at `spacing · (k + 1)` behind the player and `off` its distance from it (the follow lags it on purpose: a beat late, braking, to the side); `goal` is where it walked to this frame (its trail point a beat late, to the side; its rest spot; the catch-up's goal) and `gap` its distance from it; `v` its eased pace, `lat` / `side` its offset beside the trail, `hang` how far it hangs back, `spacing` its own (jitter and sway); `rest` its rest spot while the player stands; `covers`: a member in front covers the player on screen (the silhouette fades); `unplaced`: placements with no spot near (put on the player's). |
| `sync()` | *(party core)* `Game.syncParty()` (the party brought in line with the story's records, checked as a save's) → `Promise` of `info()` or null. |

`state().party` (once a party exists):

```json
{ "members": [{ "id": "elder", "name": "Elder Maren", "cls": "warden", "preset": "balanced",
    "rule": { "target": "leader", "distance": "mid", "attack": "free", "skills": "free", "heal": "low", "evade": "on", "retreat": "low" },
    "x": 18.942, "y": 1, "z": 23.211, "mode": "follow", "follow": "trail", "attached": true, "dist": 1.135 }],
  "menuOpen": false }
```

`mode`: `follow` · `combat` (the combat drives it) · `script` (a story directs it) · `talk`;
`follow` (the follow's own state): `placed` (put behind the player, waiting until they walk on) ·
`trail` · `catchup`; `attached`: it has a sprite on this level; `hp` / `hpMax` / `down` on combat
levels. The game itself: `game.party` (Party: `members`, `records`, `trail`, `find`, `holds`,
`canTake`, `join`, `leave`, `setRule`, `coversPlayer` …), `game.ensureParty()`, `game.syncParty()`,
`game.findVillager(who)` (a villager of this level by id, actor or name, or null),
`game.canJoin(who)` (that villager when it could join now, else null — asks nothing of a party not
made yet), `game.togglePartyMenu(open, who, { force })`, `game.partyMenuOpen`; `talkTo(id)` talks
to a member when its villager is hidden, and refuses while the tactics panel is open. Scripted checks: [`sandbox/party.follow.json`](../../sandbox/party.follow.json)
(Emberfall), [`party.follow.review.json`](../../sandbox/party.follow.review.json) (Emberfall: the
review's fixes), [`party.follow.combat.json`](../../sandbox/party.follow.combat.json) (Cinderwatch
Pass) and [`party.follow.campaign.json`](../../sandbox/party.follow.campaign.json) (the demo
campaigns), with the helpers [`sandbox/party_follow.js`](../../sandbox/party_follow.js)
(`window.PF`: `drive`, `checkDrive`, `checkRest`, `checkPlaced`, `checkHidden`, `coverage`,
`stopStart`, `sweep`, `talk`, `travel`). Cinderwatch Pass's three companions in a fight: [`sandbox/combat.glaive.boss.json`](../../sandbox/combat.glaive.boss.json) (the party of four against the boss; GLAIVE.md §8.5).

## 4. `window.__luminati`

Set by [`src/main.js`](../../src/main.js) (`exposeHook`, typed by `LuminatiHooks`), merged in three
steps. It took over the hook of the engine's former name with the rename, every member
under the same name; there is **no alias** under the old global, so a script written before the
rename must be renamed (KNOWN_ISSUES TOOL-21).

| Member | Available | Meaning |
| --- | --- | --- |
| `storage` | at boot | `{ saveLocalLevel, loadLocalLevel, listLocalLevels, loadProjectLevel, PLAYTEST_SLOT }` from [`LevelStorage.js`](../../src/engine/level/LevelStorage.js) |
| `playLocal(level, slot = 'test', query = 'autostart=1')` | at boot | Normalises `level` (any, possibly partial, level object), saves it to browser slot `slot` (slugified) and, 50 ms later, navigates this tab to `?level=local:<slot>&<query>`. Returns the slot name. |
| `level`, `source`, `warnings` | after the level loaded | The normalised level, its source (`levels/emberfall.json`, `campaigns/<c>/levels/<file>.json`, `local:<slot>`) and its normalisation warnings. A campaign started on a chapter variant (`&level=<variant>`, `&as=<variant>`) has the variant's file as its source, while `state().campaign.file` is the base level's id ([CAMPAIGN_FORMAT.md §6.1](CAMPAIGN_FORMAT.md#61-starting)). The level played now is `__game.game.source` (it follows each travel). |
| `fonts` | at boot (filled in as the fonts load) | The font loader's report: `{ lang, px, mode, sources: { latin, ja?, zh? } ('google' \| 'local' \| 'none' \| 'pending'), ms, googleError, localError, remembered, aliases, glyphs }` ([I18N.md §5](I18N.md#5-fonts)): `aliases` the CJK Jersey aliases with their source and `size-adjust`, `glyphs` the pixel glyph faces. |
| `content` | after the level loaded | The content tables installed for the page's language: `{ lang, tables, strings, units, terms, warnings, misses, missCount, missDropped, clearMisses() }` (`ContentText.contentInfo()` and the loader's warnings, [I18N.md §4.3](I18N.md#43-loader-api)); English has none (`tables: []`). `misses`, `missCount` and `missDropped` are live: the texts shown untranslated so far, each `{ key?, name?, source, why }` (`why`: `missing` — no table holds the key —, `stale` — its unit records other English —, `nokey` — the data holds no key for the text, one per English —, `term` — a name with no term; each key, name or keyless English once, at most 500), how many the list holds, and how many more did not fit; `clearMisses()` forgets them. English records none. The tours read them ([I18N.md §4.8](I18N.md#48-call-sites)). |
| `loadMs` | after warm-up | Milliseconds from navigation start to the first gameplay-ready frames. **The readiness signal for scripts.** (Meaningless in a fixed-step bot run, whose page clock is virtual.) |

`playLocal` is how a script plays a level it just built without the dev-server API: the harness
cannot reload a page with new storage otherwise.

**Load timings** (`__game.game.loadStats`, ms): `engine`, `world`, `characters`, `compile`, `map`,
`shadowVariants` (a count), `lastSwap` after a campaign's travel, and — the fonts — `fontsWait`
(how long `_buildLevel` still waited for `ui.fontsReady` once the world and the villagers were
built: 0 when the fonts came in during the build) and `glyphsWait` (the same for the glyphs of the
level's first texts, `fonts.ensure`; Japanese and Chinese only).

## 5. `window.__engine`

The `Engine` instance, exposed when the URL contains `debug` or `autostart` (the rule is in the
`Engine` constructor, so it holds on every page that creates an `Engine`: `exposeGlobal: true`
forces it, `exposeGlobal: false` suppresses it); `Engine.dispose()` deletes it again (if it is
still this engine). The harness's default `--query=autostart=1` therefore exposes it on the
sandbox pages too. Useful members:
`renderer`, `scene`, `camera`, `input`, `time` (`fps`, `delta`, `frame`, `timeScale`),
`renderScale`, `pixelRatio`, `events`, `addSystem`. See
[../architecture/modules/core.md](../architecture/modules/core.md).

## 6. `window.__editor`

Set in the `EditorApp` constructor ([`EditorApp.js`](../../src/editor/EditorApp.js)), typed by
`EditorHooks`:

| Member | What it is |
| --- | --- |
| `app` | the `EditorApp`; `app.ready` resolves once the first level is loaded **and** the 3D view exists (or failed to start) |
| `state` | the `EditorState` — the document, selection, tool, view, undo history |
| `tools` | `{ select, paint, fill, rect, height, stairs, place, spawn, eyedropper, erase }` tool objects |
| `textures` | the shared `TextureLibrary` |
| `view2d` | the `Map2DView` (getter; `null` until mounted) |
| `view3d` | the `Viewport3D` (getter; `null` if the 3D preview could not start). `view3d.busy` is `true` while meshes are still being rebuilt; `view3d.stats` has `drawCalls`, `triangles`, `fps`, `lights` (= `lightPool.activeCount`), `lightDescriptors`… `view3d.props.lightPool` is the engine `LightPool` (`fixed`: `handles` always 12; `pooled`, `active`, `activeCount` / `used`, `descriptors`, `snap()`); `view3d.props.refreshLights(objects, { snap, reset })` / `updateLights(dt, view)` feed and run it (they replace the former `assignLights(focus)`). |
| `ready3d` | a Promise (getter) that resolves after `app.ready` and the 3D view's first full build |
| `seedTextKeys(prefix)` | makes the keys the editor gives new texts deterministic (`state.seedTextKeys`; `null` / no prefix: random again) — scripted checks assert exact keys with it |

Useful for scripts:

| Call | Effect |
| --- | --- |
| `app.run('<command id>')` | Runs any menu command (`file.save`, `edit.undo`, `view.3d`, `level.validate`, … — ids in [INPUT_AND_CONTROLS.md §7.1](INPUT_AND_CONTROLS.md#71-commands)). Commands that open dialogs wait for the user. A disabled command does nothing; `app.canRun(id)` says whether it would run. |
| `app.openProject(name, { confirm })`, `app.openLocal(slot, { confirm })` | Open a level (resolve `true` / `false`; `confirm: false` skips the unsaved-changes question). |
| `app.playtest()` | Validates, saves slot `__playtest__`, opens `game.html?level=local:__playtest__&autostart=1` in the window named `luminati-playtest`; returns `true` (also when the pop-up was blocked — the status bar says so), `false` with a problems dialog when the level is not playable or storage is full. Following the pop-up from the harness: [§10.4](#104-play-test-from-the-editor). |
| `app.validate()` | Shows the "Check for problems" dialog. |
| `app.selectAll()`, `app.focusIds(ids)`, `app.paste(objs)` | Selection helpers. |
| `app.assignTextKeys()` | Level › Assign text keys: reads the levels a campaign's level shares keys with (`app._assignSources()`: a chapter variant's base, a campaign copy's shipped level), then `state.assignTextKeys`; resolves to `{ objects, root }`. |
| `app.findTextKey(input)`, `app.locateTextKey(input)`, `app.showTextKey(hit)` | Edit › Find by text key… without its dialog: `locateTextKey` finds where a key (a GUID in any case, braces and hyphens allowed, a `#line:` tag, `<GUID>.2`) is in the open level (`{ found, key, message, id?, row?, root?, more }`), `showTextKey` selects and shows it, `findTextKey` does both. |
| `app._copiedRead` | A Promise that settles once the file a *Save As* left has been read back for copy-on-write (scripts await it before the next edit). |
| `state.level` | The level document (read it; change it only through `state` methods). |
| `state.addObject(type, x, z, overrides?)`, `updateObject(id, patch)`, `moveObjects(ids, dx, dz)`, `removeObjects(ids)` | Object edits (each is one undo step unless inside `begin()`/`commit()`). |
| `state.setTile(i, j, ch)`, `setHeight(i, j, level)`, `editTiles(cells)` | Terrain edits; `cells = [{ i, j, tile?, height? }]`. |
| `state.setSpawn(x, z, facing?)`, `setLevelProps(patch)` | Player start, level settings. |
| `state.begin(label)` / `commit()` / `cancel()` | Group edits into one undo step (a stroke). |
| `state.undo()`, `redo()`, `canUndo`, `canRedo`, `dirty`, `revision`, `fileRef` | History and save state. |
| `state.select(ids)`, `selection`, `setTool(id)`, `setToolOption(key, value)`, `setView(patch)` | Selection, tools (`brushSize`, `tile`, `objectType`, `heightMode`…), layout (`{ layout: 'split' \| '3d' \| '2d' }`). |
| `state.snapshot()` | A deep copy of the level (what Save writes). |
| `state.assignTextKeys(label?, { sources })`, `state.seedTextKeys(prefix)` | Level › Assign text keys as one undo step (`sources`: the keyed texts of levels this one copies, shared first; returns `{ objects, root }`); deterministic keys for new texts (`seededMint(prefix)`; `null`: random again; throws for an OS path or an empty prefix) — [I18N.md §4.10](I18N.md#410-keys-through-edits-the-editor-the-generators-the-tools) |
| `state.sharedTexts(key)`, `state.otherTexts`, `state.addCopiedTexts(file, texts)`, `state.forgetCopiedTexts(file)` | Copy-on-write's view of other files: the texts other files hold under a key (`[{ file, text, where }]` or undefined); the campaign's other files (set by the app from the story context); the file a *Save As* left, remembered and forgotten |
| `state.origin`, `state.loads` | The content table the document's keys come from (`levels/<name>`, `campaigns/<name>`; '' none — the play-test passes it); how many documents were loaded (an async read compares it) |
| `state.on('change', fn)` | Events: `change`, `selection`, `tool`, `toolOptions`, `view`, `hover`, `dirty`, `history`, `status`. |

Helper modules for editor scripts (import them from an `eval` step):

- [`sandbox/editor_shell.helpers.js`](../../sandbox/editor_shell.helpers.js) —
  `import('/sandbox/editor_shell.helpers.js').then((m) => m.install())` defines `window.T`:
  `T.drag([[x, z], …], { shift, ctrl, alt })` (a synthetic pointer stroke on the 2D map in world
  coordinates; resolves to the object count), `T.click(x, z)`, `T.hover(x, z)`,
  `T.key(key, { ctrl, shift, alt, code })` (a synthetic `keydown` on the focused element; returns
  whether a handler called `preventDefault`), `T.clickText(selector, text)`,
  `T.setInput(elOrSelector, value)`, `T.field(label)` (an inspector control), `T.summary()`,
  `T.frame()`, `T.sleep(ms)`, `T.screen(x, z)`, `T.fire(type, x, z, opts)`, `T.E` (= `__editor`).
  The 2D map must be visible (layout split or 2D). `T.fire` events carry `buttons`: the bit of
  `opts.button` (left 1, middle 4, right 2) on `pointerdown` and on moves with `opts.down`, 0 on
  other moves and on `pointerup` (`opts.buttons` overrides it). A move without `down` during a
  stroke is a lost release to the 2D map — it ends the stroke as cancelled — so stroke moves need
  `down: true` (`T.drag` sets it).
- [`sandbox/editor_perf.helpers.js`](../../sandbox/editor_perf.helpers.js) —
  `import('/sandbox/editor_perf.helpers.js').then((m) => m.install())` defines `window.P`:
  `setup(kind)` (`'vale'` default or `'ember'`: a 64 × 64 test level with ~200 objects),
  `s2d(x, z)` / `s3d(x, z)` (client coordinates of a world point in the 2D map /
  3D view, for real-mouse `drag` steps), `path(view, pts)`, `start()` / `stop(label)` (frame-time
  recorder), `fingerprint()`, `exactCheck()` (3D scene vs a fresh full rebuild).
- [`sandbox/campaign_prepare.js`](../../sandbox/campaign_prepare.js) —
  `import('/sandbox/campaign_prepare.js')` defines `window.CP` for the campaign travel checks
  (`campaign.prepare*.json`): `ready()` (waits for `loadMs`, answers story choices, hashes every
  world right after `Game._buildLevel` into `CP.built`), `travel(to, { x, z, wait, hash, label })`
  (teleport near the exit, stand until the level built ahead is ready or `wait` ms, travel; the
  record has the times, the build phases, the frames meanwhile, `prepUsed`, draw calls, programs,
  the world hash), `walk(dir, ms, { from })` (hold a direction key with a rAF gap probe: `max`,
  `p99`, frames over 25 / 34 ms, long tasks), `hashWorld(world)` (FNV-1a over every object under
  the world's root — names, flags, matrices, materials and their program keys, attributes, index,
  instance matrices — and its colliders, walk surfaces, interactables, lights, emitters, falls,
  fires and shore texels), `programNames()`, `probe()`, `summary()` (medians per route and the
  walks' frames).
- [`sandbox/editor_textkeys.js`](../../sandbox/editor_textkeys.js) —
  `import('/sandbox/editor_textkeys.js').then((m) => m.install('tk'))` (after
  `editor_shell.helpers.js`) defines `window.K` for `sandbox/editor_shell.textkeys.json`: the
  editor (`E`), the key modules (`F` LevelFormat, `CK` ContentKeys, `TK` TextKeys, `S`
  LevelStorage), `ok(c, m)` / `fails` (a failed assertion throws a page error), `expect(seed)`
  (the key the seeded editor gives a text), `obj(id)`, `json(id)`, `tags(v)`, `lines(v)`,
  `keys(o)`, `issues(ids?)`, `hiddenLeak()` (no inspector field shows a key or tag but the
  read-only key lines), `keyLines(field)`, `keyToggle(field)`, `rows(o)`, `until(fn, ms)` and
  `disk(name)` (a project level as the level API reads it from disk).

## 7. Sandbox hooks

Each module sandbox exposes its internals for scripted checks ([`sandbox/`](../../sandbox/)). Each
handle's full member list is the typedef next to its assignment in the sandbox file
(`CoreHandle`, `TerrainHandle`, `SpriteCombatReport`, `VpHandle` …; `src/globals.d.ts` names them):

| Page | Global |
| --- | --- |
| `core.html` | `window.__core` (`engine`, `rig`, `runAllTests()`, `tests.*`, `analyzeAudio()`…); `window.__engine` only with `?debug` / `?autostart` (the harness default) |
| `terrain.html` | `window.__terrain` |
| `props.html` | `window.__props` (`furnitureCheck()` in `?mode=interior`: every furniture piece's colliders against its catalog footprint) |
| `textures.html` | `window.__tex` |
| `sprite_art.html` | `window.__sprites`; with `?mode=hashes` `window.__spriteHashes` (the FNV-1a hash of every existing sheet by name — the baseline of `sandbox/sprite_art.hashes.json`); with `?mode=combat` `window.__spriteCombat` (the combat-sheet report: hash diffs, contrast, timings; `sprite_art.combat.json`) |
| `sprite_runtime.html` | `window.__sb` |
| `lighting.html` / `lighting_engine.html` | `window.__lighting` / `window.__lightEngine` |
| `postfx.html` | `window.__postfx` |
| `ui.html` | `window.__ui`, `window.__sandbox` (with `?combat=1` also `panelProbe()` / `panelOverlaps()`: where the world labels land relative to the HUD panels) |
| `ui_art.html` | `window.__uiArt` (`ready`, `show(page)`, `checks()` — every painter case hashed (FNV-1a over size and RGBA) against the baseline `sandbox/ui_art.hashes.json`, recorded while the cases matched mockup G's own code: a changed or missing hash fails; the palette tokens, the Jersey aliases' widths, the scale table and `fitScale`, every shipped title's logo, `canLogo`; throws on a difference —, `hashes()` — the current hashes, to re-record the baseline after an intentional art change —, `info()`, `pause()`): the pixel UI kit, [PIXEL_UI.md §2.1](PIXEL_UI.md#21-the-api) |
| `title_ui.html` | `window.__ui`, `window.__titleUi` (`ready`, `checks()` — every key, pad and pointer path of the chooser, the menu and the language row, the layout and the logo fits; throws on a failure) |
| `map_ui.html` | `window.__ui`, `window.__map` (`ready`, `info()`, `open(on)`, `face(x, z)`, `party(n)`, `hashes()`, `at(where)` — the player on a marker kind or at `[x, z]` —, `clear()` — the world map's layers and the names over the arrow, a waystone or the boss) |
| `party_ui.html` | `window.__ui`, `window.__party` (`menu(open, focus)`, `members`, `state`, `frameList`, `hurt`, `setDown`, `info()`, `mapHashes()`, `L(english, …parts)` — the text a check expects: the English as written in English, else the parts joined (party string keys, `=literal`, `~` the separator) —, `expect` …: the party UI, [ui.md §11a](../architecture/modules/ui.md#11a-party-ui-once-someone-joins)) |
| `story_ui.html` | `window.__ui`, `window.__story` (`journal(open, tab)`, `emote(i, icon, s)`, `cutscene(on)`, `endCard()`, `toasts()`, `hud(on)`, `info()`, `expect(actual, expected, label)` …: the story UI, [ui.md §11](../architecture/modules/ui.md#11-story-ui-story-levels-only)) |
| `combat_fx.html` | `window.__cfx` (`renderTrack(track, seconds, mute)` …) |
| `combat_audio.html` | `window.__caudio` (`results`, `identity()`, `compare(url)` …: the combat audio QA, [audio.md §7](../architecture/modules/audio.md#7-testing-and-offline-rendering)) |
| `editor3d.html` | `window.__vp` (`vp`, `state`, `view()`, `frames(n)`, `hoverWorld`, `clickWorld`, `strokeWorld`, `fire`…) |
| `game_levels.html` | `window.__levelCases` (`CASES`, `runCase(name)`); the module also exports `HOSTILE_NAMES` (the `Object.prototype` names of the `hostile` case, imported by `game_levels.hostile.json`) |
| `level_builder.html` | `window.__smoke` |
| `i18n_tour.js` (a module, imported by an `eval` step on the game page) | `window.IT` (`ready()`, `enter()`, `start()`, `wait(ms)`, `finish()`, `last()`, `tour()`, `talkThrough(npc, answers)`, `drain(answer, ms)`, `show(what)`, `close()`, `misses()`, `counts()`, `log` …): the content-text tour of one level, `sandbox/i18n.tour.json` ([I18N.md §4.8](I18N.md#48-call-sites)) |
| `i18n_campaign.js` (a module, imported by an `eval` step on the game page) | `window.CT` (`go(name)` — a part: `ferryTitle` … `titleAgain`, `rooms`, `party`, and Cinderwatch's companions `camp`, `campTalks`, `ruins`, `caldera`, `selaJoins`, `fullIlse`, `fullOthers` —, `wait()`, `check(label)`, `dismissEnding()`, `talk(id, answer)`, `peek(id, picks, nth)` — a talk held open at its choice or at the `nth` page after the picks, for the script's `shot` —, `resume(answer)` — pages on through the window `peek` left —, `enterBark(id, x, z)` — the player put into a background `enter` event's box, its bark left up —, `settle(id)` — until that event ran to its end —, `member(id)`, `members()`, `rule(id)`, `barkUp()`, `results`, `trail` …) and `window.IT`: the content-text check of the campaigns, the story and the party, `sandbox/i18n.campaign.json` ([I18N.md §4.8](I18N.md#48-call-sites)) |

The ready-made scripts next to them (`sandbox/*.actions.json`, `sandbox/editor_shell.*.json`,
`sandbox/editor3d.*.actions.json`, `sandbox/editor_perf*.json`, `sandbox/combat.*.json`) are the
best examples of what each hook can do. The combat scripts:

```bash
npm run check -- --page=game.html --query="level=cinderwatch-pass&autostart=1&fixedstep=1" --out=glaive-fight --wait=2000 --script=sandbox/combat.glaive.fight.json
npm run check -- --page=game.html --query="level=cinderwatch-pass&autostart=1&fixedstep=1" --out=glaive-boss --wait=2000 --script=sandbox/combat.glaive.boss.json
npm run check -- --page=game.html --query=autostart=1 --out=peaceful --wait=2000 --fps=0 --script=sandbox/combat.peaceful.json
npm run check -- --page=sandbox/combat_audio.html --query= --out=caudio --wait=1000 --fps=0 --script=sandbox/combat_audio.actions.json
```

## 8. The check harness (`npm run check`)

[`tools/check.mjs`](../../tools/check.mjs) is the project's test runner: it starts its own Vite
dev server (with the level API), opens a page in headless Chrome on the real GPU, collects errors,
runs an optional action script, measures fps and writes screenshots and a JSON report.

```bash
npm run check -- --page=<path.html> --query=<query> --out=<name> [--wait=ms] [--script=file.json] \
                 [--width=px --height=px] [--fps=ms] [--headful] [--keep-cache] [--strict] \
                 [--lang=ja|zh] [--fonts=…] [--base=project] [--dist]
```

| Option | Default | Meaning |
| --- | --- | --- |
| `--page` | `game.html` | Page path relative to the repository root (`editor.html`, `index.html` — the launcher —, `sandbox/terrain.html`, `docs/index.html`…). |
| `--query` | `autostart=1` | Query string without `?`. **The default applies to every page**; pass `--query=` for none, quote values with `&` (`--query="level=starfall-vale&autostart=1"`). |
| `--fonts` | `local` | How the page loads its UI fonts (written to `localStorage['luminati.fonts']` before every navigation, so `goto` steps and the play-test pop-up get it too): `local` (the `@fontsource` copies: no network, the same CJK glyphs every run), `google`, `auto` (the game's default: Google first), `google-fail`, `gstatic-fail`. |
| `--lang` | *(none)* | The language, written to `localStorage['luminati.lang']` the same way (`en`, `ja`, `zh`); `?lang=` in `--query` works for the first page only. |
| `--out` | the page's base name | Output folder `.check/<out>/` (gitignored). Old `*.png` and `report.json` there are deleted first. |
| `--wait` | `4000` | Milliseconds to wait after the `load` event before the first screenshot and the script. |
| `--width`, `--height` | `1600`, `900` | Viewport size. |
| `--script` | none | Action script (JSON array, [§9](#9-action-scripts)), path relative to the repo root (or absolute). |
| `--fps` | `3000` | Length of the initial fps measurement (after `initial.png`); `0` skips it. |
| `--headful` | off | Show the browser window. |
| `--keep-cache` | off | Keep the Vite dependency cache, named after `--out`, for the next run with the same name (by default each run deletes its own). |
| `--strict` | off | Also exit `1` on console errors, console warnings, failed requests and `eval` steps that throw (listed on a `Strict:` line and in `strictFailures`). |
| `--base` | none | Serve the project under a sub-path (Vite's `base`, slashes added: `--base=project` is `/project/`; Git Bash turns an argument `/project/` into a Windows path, which is refused): the page and `goto` steps open under it; root paths an `eval` writes itself do not follow it. |
| `--dist` | off | Check `dist/` through `vite preview` instead of the sources (`npm run build` first; `index.html`, `game.html` and `editor.html`, no level API). |

Environment: `CHROME_PATH` selects the browser; otherwise the first existing of Chrome
(x86 and x64 Program Files) or Edge is used. Chrome runs with `--use-angle=d3d11`,
`--ignore-gpu-blocklist`, `--enable-gpu`, `--enable-webgl` and
`--autoplay-policy=no-user-gesture-required`. Each run picks a random port (5200–5899) and its own
Vite dependency cache (`node_modules/.vite-check/<out>-<pid>`, deleted when the run ends unless
`--keep-cache`), so several checks can run at once. The
browser starts with a fresh temporary profile, so `localStorage` is empty at the start of every
run (levels saved with `playLocal` or the editor survive only within one run, across `goto` steps).

**What it does, in order:** start Vite (root = repo, `vite.config.js`, HMR off; `--dist`: `vite preview`
on `dist/`) → open `http://127.0.0.1:<port>/<page>?<query>` (under `--base`'s sub-path with one) → record the WebGL renderer string → wait `--wait` →
screenshot `initial.png` → measure fps for `--fps` ms (label `initial`) → run the script steps →
close the browser and the server → write `report.json` → print a summary.

**Report** (`.check/<out>/report.json`):

| Field | Content |
| --- | --- |
| `page`, `query` | what was opened |
| `gl` | the unmasked WebGL renderer (e.g. `ANGLE (vendor, GPU model, graphics backend …)`), or `NO WEBGL2` |
| `console` | every console message `{ type, text }` from every watched tab |
| `errors` | console errors, except favicon / `status of 404 (Not Found)` messages |
| `warnings` | console warnings |
| `pageErrors` | uncaught exceptions; harness failures appear here as `HARNESS: …` |
| `failedRequests` | failed requests and responses with HTTP status ≥ 400 (except `/favicon.ico`) |
| `evals` | `{ code, result }` or `{ code, error }` per `eval` step, and `{ code: "tab …", result: <url> }` per `tab` step |
| `fps` | `{ label, fps, p50ms, p95ms }` per measurement (requestAnimationFrame deltas) |
| `shots` | screenshot paths relative to the repo root |
| `base`, `dist` | the sub-path served under (`/` by default) and whether `dist/` was checked |
| `strict`, `strictFailures` | whether `--strict` was given, and with it the reasons it exits 1 besides page errors (`"1 console error"`, `"2 eval steps threw"` …) |

**Exit codes:** `1` when `pageErrors` is not empty (an uncaught page exception or a harness
error) — with `--strict` also when `strictFailures` is not empty — `2` when no Chrome / Edge was
found, an option is invalid or `--dist` finds no `dist/<page>`, otherwise `0`. **Without `--strict`, console errors, warnings, failed requests and throwing
evals do not fail the run** — read the summary (URL, GPU, FPS, the first 20 unique page and console errors,
10 warnings, 10 failed requests, every eval result truncated to 400 characters, screenshot list)
and look at the PNGs.

## 9. Action scripts

A script is a JSON array of steps executed in order. Each step is an object; the keys are tested
in this order and the **first one with a truthy value** decides what the step does: `wait`, `key`,
`press`, `eval`, `shot`, `fps`, `click`, `dblclick`, `move`, `mouse` (only `"down"` / `"up"`),
`drag`, `wheel`, `type` (any defined value, even `""`), `combo`, `goto`, `tab` (any defined value,
even `0`). So `{ "wait": 0 }` alone does nothing, `{ "wait": 0, "shot": "x" }` takes the shot, and a
step with two action keys only runs the first. A step with no recognised key is skipped silently.
Coordinates are viewport CSS pixels — or, for `click`, `dblclick`, `move`, `wheel` and `drag`, a
string: a JavaScript expression evaluated in the page when the step runs, whose value (or its JSON
text) gives them. With [`editor_perf.helpers.js`](../../sandbox/editor_perf.helpers.js) installed,
`{ "drag": "P.path('2d', [[30, 30], [31.5, 30.5]])", "steps": 3 }` drags through world points of the
2D map (`'3d'`: of the 3D view), whatever the window size and layout.

| Step | Example | Effect |
| --- | --- | --- |
| `wait` | `{ "wait": 1000 }` | Sleep (ms). |
| `key` | `{ "key": "KeyW", "hold": 800 }` | Hold a key for `hold` ms (default 300). Names are Puppeteer key names: `KeyW`, `Space`, `ShiftLeft`, `ArrowUp`, `Enter`, `Escape`, `Tab`, `Backquote`, `Digit1`, `F5`… |
| `press` | `{ "press": "Space" }` | Tap a key. Single characters also work (`"b"`, `"]"`, `"3"`). |
| `eval` | `{ "eval": "window.__game.setTime(21)" }` | Evaluate JavaScript in the page. Promises are awaited; the (JSON-serialisable) result or the error text is stored in `evals`. Wrap multi-statement code in an async IIFE and return a string (`JSON.stringify(…)`) for complex values. |
| `shot` | `{ "shot": "night" }` | Screenshot to `.check/<out>/night.png`. |
| `fps` | `{ "fps": 2000, "label": "night" }` | Measure fps / p50 / p95 frame time over `fps` ms. |
| `click` | `{ "click": [800, 450], "button": "right", "count": 2 }` | Mouse click; `button` `left` (default) / `right` / `middle`; `count` 2 sends a real double click. |
| `dblclick` | `{ "dblclick": [800, 450] }` | Double click. |
| `move` | `{ "move": [640, 300], "steps": 10 }` | Move the mouse (hover) in `steps` interpolated moves (default 1). |
| `mouse` | `{ "mouse": "down", "button": "left" }` | Press (`down`) or release (`up`) at the current mouse position. |
| `drag` | `{ "drag": [[400, 300], [600, 300], [600, 500]], "button": "left", "steps": 8, "pause": 30, "modifiers": ["Shift"] }` | A real mouse drag through the points: `steps` moves per segment (default 8), `pause` ms after each segment, `modifiers` held during the drag (`Shift`, `Control`, `Alt`). |
| `wheel` | `{ "wheel": [800, 450], "deltaY": -240 }` | Move there and scroll (`deltaY` default −240, negative = zoom in). |
| `type` | `{ "type": "Mossbrook", "selector": ".le-dialog input", "delay": 10 }` | Type text; with `selector`, triple-click that field first (select its text). `delay` ms between keys (default 10). |
| `combo` | `{ "combo": ["Control", "KeyZ"] }` | Hold every key but the last, tap the last, release (`["Control", "Shift", "KeyS"]`). |
| `goto` | `{ "goto": "game.html?level=local:__playtest__&autostart=1" }` | Navigate (relative to the server's base — the site root, or `--base`'s sub-path — or an absolute `http…` URL). Same origin, so browser storage is kept. |
| `tab` | `{ "tab": "last" }`, `{ "tab": 1 }`, `{ "tab": "last", "timeout": 20000 }` | Continue in another tab: `last` = the newest tab (the last entry of `browser.pages()`) — when that is the current page, the step first **waits** up to `timeout` ms (default 10000) for a new tab and fails (`HARNESS: tab last: no new tab opened …`) if none opens; a number = that index, waited for up to `timeout`. A tab opened during the run then gets the rest of `timeout` to load. The tab gets the same viewport and is watched for errors; every `tab` step is logged in `evals` as `tab …` with the URL. See the note below. |

Keys pressed with `key` / `press` / `combo` are real keyboard events: they go through `Input`, the
title screen and the editor's shortcut dispatch like a user's keys.

**The `tab` step and pop-ups.** The browser starts with an empty `about:blank` tab, so
`browser.pages()` is `[about:blank, <the checked page>, …tabs it opened]` from the start: `tab: 0`
is that blank tab, `tab: 1` the checked page. Right after the editor's `app.playtest()` (or Play /
F5) the pop-up is usually not listed yet; `tab: "last"` then sees that the newest tab is the current
page and waits for the new one, so no `wait` step is needed. A pop-up that is already listed (the
reused `luminati-playtest` window after a second play-test, or a tab opened before a `wait`) is taken
at once. Until 2026-10-07 `last` did not wait and silently stayed on the editor page (KNOWN_ISSUES
TOOL-11); [`sandbox/editor_shell.playtest.json`](../../sandbox/editor_shell.playtest.json) checks
the current behaviour ([§10.4](#104-play-test-from-the-editor)).

## 10. Recipes

### 10.1 Script a playthrough

Verified on Emberfall (`npm run check -- --page=game.html --query=autostart=1 --out=play --wait=1000 --fps=0 --script=play.json`):

```json
[
  { "eval": "(async () => { for (let k = 0; k < 200 && !(window.__luminati && window.__luminati.loadMs); k++) await new Promise((r) => setTimeout(r, 100)); return window.__luminati.loadMs; })()" },
  { "key": "KeyW", "hold": 800 },
  { "eval": "JSON.stringify(window.__game.state().player)" },
  { "eval": "window.__game.talkTo('elder')" },
  { "wait": 600 },
  { "shot": "elder" },
  { "eval": "(async () => { const g = window.__game; for (let k = 0; k < 40 && g.state().dialogOpen; k++) { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true })); await new Promise((r) => setTimeout(r, 50)); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true })); await new Promise((r) => setTimeout(r, 250)); } return g.state().dialogOpen; })()" },
  { "eval": "window.__game.setTime(21.5)" },
  { "eval": "window.__game.setWeather('rain')" },
  { "eval": "window.__game.photo(true)" },
  { "wait": 1500 },
  { "shot": "night_rain" },
  { "eval": "window.__game.photo(false)" },
  { "eval": "window.__game.map(true)" },
  { "wait": 500 },
  { "shot": "world_map" },
  { "eval": "window.__game.map(false)" },
  { "fps": 2000, "label": "night" },
  { "eval": "JSON.stringify(window.__game.state())" }
]
```

Notes:

- The first step waits for `__luminati.loadMs`, so `--wait` can stay short on any level size.
- The dialog loop presses Space until `dialogOpen` is false. Each press first completes the typing
  line, then advances; choices take the preselected **first** answer. To pick another answer,
  dispatch `ArrowDown` (`code: 'ArrowDown'`) before the last Space. For a level NPC whose closing
  page has a **single** choice, that first answer runs its `rest` / `shop` / `music` action.
- `teleport(x, z)` moves the player instantly; walk with `key` steps to test collisions and stairs.
- `photo(true)` hides the whole UI immediately — the cleanest screenshots.
- Emberfall's NPC ids: `elder`, `innkeeper`, `merchant`, `guard`, `farmer`, `child`, `bard`,
  `scholar`; Cinderwatch Pass's: `maren`, `bram`, `ilse`, `pip`, `odo`, `sela`, `rook` (Ilse, Rook
  and Sela join the party by their talks); Starfall Vale uses readable ids too (`aldous`,
  `marigold`, …); editor-made levels use `npc_1`, `npc_2`, … Read them from
  `window.__game.npcs.map((n) => n.id)`.

### 10.2 Play a level you just built (no dev server needed)

```json
[
  { "eval": "(async () => { for (let k = 0; k < 200 && !(window.__luminati && window.__luminati.loadMs); k++) await new Promise((r) => setTimeout(r, 100)); const { createEmptyLevel, addObject } = await import('/src/engine/level/LevelFormat.js'); const L = createEmptyLevel({ name: 'Probe', width: 16, depth: 12 }); addObject(L, 'npc', 8.5, 5.5, { name: 'Ada' }); return window.__luminati.playLocal(L, 'probe'); })()" },
  { "wait": 1500 },
  { "eval": "(async () => { for (let k = 0; k < 300 && !(window.__luminati && window.__luminati.loadMs); k++) await new Promise((r) => setTimeout(r, 100)); return JSON.stringify({ source: window.__luminati.source, warnings: window.__luminati.warnings, mode: window.__game.state().mode }); })()" },
  { "shot": "probe" }
]
```

`playLocal` navigates the tab, so the next step must wait for the new page's `loadMs` again. The
source becomes `local:probe`. `sandbox/game_levels.html?case=<name>` does the same for its
prepared test levels.

### 10.3 Drive the editor

```bash
npm run check -- --page=editor.html --query=open=emberfall --out=ed --wait=1000 --fps=0 --script=ed.json
```

```json
[
  { "eval": "(async () => { await window.__editor.app.ready; await window.__editor.ready3d; return window.__editor.state.level.objects.length; })()" },
  { "eval": "import('/sandbox/editor_shell.helpers.js').then((m) => m.install())" },
  { "press": "3" },
  { "eval": "T.E.state.setTool('paint'); T.E.state.setToolOption('tile', '.'); T.drag([[10, 10], [14, 10]]).then(() => T.E.state.undoLabel)" },
  { "eval": "(() => { const o = T.E.state.addObject('lamppost', 20.5, 20.5); return o.id; })()" },
  { "combo": ["Control", "KeyZ"] },
  { "eval": "JSON.stringify(T.summary())" },
  { "press": "1" },
  { "wait": 800 },
  { "shot": "editor" }
]
```

Drawing with real mouse input: `drag` steps with client coordinates from
`window.P.s2d(x, z)` / `s3d(x, z)` ([`editor_perf.helpers.js`](../../sandbox/editor_perf.helpers.js)).
Wait for `__editor.view3d.busy === false` before comparing the 3D view with a fresh build.

### 10.4 Play-test from the editor

`app.playtest()` saves the level to browser slot `__playtest__` and opens the game in a pop-up
window named `luminati-playtest` (the harness does not block it: `window.open` called from an `eval`
step returns a window). Two ways to continue in the game, both verified on 2026-09-27:

1. **Follow the pop-up** — `tab: "last"` waits for it to open and load (see the `tab` note in
   [§9](#9-action-scripts); `sandbox/editor_shell.playtest.json` does this with F5):

   ```json
   [
     { "eval": "(async () => { await window.__editor.app.ready; return window.__editor.app.playtest(); })()" },
     { "tab": "last" },
     { "eval": "(async () => { for (let k = 0; k < 300 && !(window.__luminati && window.__luminati.loadMs); k++) await new Promise((r) => setTimeout(r, 100)); return JSON.stringify({ href: location.href, source: window.__luminati.source }); })()" }
   ]
   ```

2. **Navigate the same tab** — `goto` the play-test URL (same origin, so the slot is there):

   ```json
   [
     { "eval": "(async () => { await window.__editor.app.ready; return window.__editor.app.playtest(); })()" },
     { "goto": "game.html?level=local:__playtest__&autostart=1" },
     { "eval": "(async () => { for (let k = 0; k < 300 && !(window.__luminati && window.__luminati.loadMs); k++) await new Promise((r) => setTimeout(r, 100)); return JSON.stringify({ source: window.__luminati.source, level: window.__game.state().level }); })()" }
   ]
   ```

If no tab opens within the step's `timeout` (a blocked pop-up, a level with problems: the editor
shows its problems dialog instead), the step fails the run with `HARNESS: tab last: no new tab
opened …` rather than going on in the editor page.

### 10.5 Measure performance

- `fps` steps give frame-time percentiles; headless Chrome caps them at the compositor rate
  (~57–60 fps), so fps alone cannot prove headroom.
- `window.__game.state().drawCalls` / `triangles` (budget: ≤ ~300 scene draw calls including the
  shadow pass on the reference desktop GPU) and `world.stats` (build phases, lights, batching).
- GPU stage timings: `window.__game.postfx.enableTimings(true)`, wait a second, then read
  `window.__game.postfx.timings` (smoothed ms per stage) or `timingsMin`.
- Editor strokes: `sandbox/editor_perf.json` / `editor_perf.stress.json`
  (`npm run check -- --page=editor.html --query=new --out=perf --fps=0 --script=sandbox/editor_perf.json`).
- Details and reference numbers: [../architecture/PERFORMANCE.md](../architecture/PERFORMANCE.md).

### 10.6 Playing a fight in fixed step

The real-time play-through bot (`sandbox/combat_play.js`) went with the real-time combat. A fight
is now played through the hooks of §3.4 in manual-step mode:

```json
[
  { "eval": "window.S = (n) => { for (let i = 0; i < n; i++) __engine.step(1 / 30, { render: false }); __engine.redraw(); return n; }; 'ok'" },
  { "eval": "S(30); __game.combat.choose('sellsword', 'human'); __game.combat.fight('glade_goblins', 'party'); __game.combat.auto(true); __game.combat.pace(4); 'fight'" },
  { "eval": "(async () => { for (let i = 0; i < 6000 && __game.combat.state().fight; i++) { __engine.step(1 / 30, { render: false }); if (i % 50 === 49) await new Promise((r) => setTimeout(r, 0)); } __engine.redraw(); return JSON.stringify(__game.combat.state().player); })()" },
  { "shot": "after-the-fight" }
]
```

Run it with `--query="level=cinderwatch-pass&autostart=1&fixedstep=1"`. The Node self-test
(`npm run glaive:test`) plays hundreds of fights without a browser.

## 11. Pitfalls

- **Big levels load slowly.** Starfall Vale takes several seconds; wait for `__luminati.loadMs`
  rather than trusting `--wait`.
- **`--query` defaults to `autostart=1`** even for the editor and docs pages; pass `--query=` when
  that matters.
- **Audio** unlocks only after a key or click (the autoplay flag lets Chrome play once unlocked):
  `state().audioReady` stays `false` in a script that never presses a key.
- **The title screen swallows the first key** (without `autostart`), and accepts input only after
  0.45 s.
- **Dialogs block** `talkTo`, `photo` and `map` until they close; check `state().dialogOpen` /
  `busy`.
- **`tab: "last"` takes the newest tab at once unless that is the current page**; then it waits
  (up to `timeout`) for a new one and fails the run if none opens ([§9](#9-action-scripts)).
- **Keys pressed while a text field has focus** never reach the game or the editor shortcuts
  ([INPUT_AND_CONTROLS.md §5](INPUT_AND_CONTROLS.md#5-game-focus-and-browser-rules)); blur fields
  (`document.activeElement.blur()`) before key steps.
- **Screenshots show the live frame**: dust, particles, the clock and villagers move; for
  comparable shots freeze the clock (`window.__game.lighting.timeSpeed = 0`) and use `photo(true)`.
- **A page loaded with `?fixedstep`** (plus `autostart` / `debug`) does not run by itself: only
  `engine.step()` advances it. Use it only for scripts that step the engine (the fixed-step bot).
- **Never commit `.check/`**; it is gitignored scratch output. Do not write test levels into
  `public/levels/` unless the task asks for it (use browser slots via `playLocal`), and never touch an
  untracked level you did not create.
