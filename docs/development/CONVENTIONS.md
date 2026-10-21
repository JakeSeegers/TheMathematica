# Code conventions

> **Purpose.** The conventions the Luminati code actually follows — module structure, naming,
> JSDoc and the type check, determinism, disposal, allocation-free frames, units and axes, colour
> spaces, texture creation, shader patching in three r186, shared uniforms, error handling,
> contract changes, UI theming and documentation. Each rule is taken from the code and the binding
> contract, with the reason it exists. Follow them so new code fits and the invariants hold.
>
> **Audience:** anyone writing or reviewing code in `src/`, `tools/` or `sandbox/`, and AI agents
> before their first edit.
>
> **Source of truth:** [`ARCHITECTURE.md`](../../ARCHITECTURE.md) §2 (binding conventions), the
> foundation files [`src/engine/constants.js`](../../src/engine/constants.js),
> [`src/engine/utils/math.js`](../../src/engine/utils/math.js),
> [`src/engine/utils/own.js`](../../src/engine/utils/own.js),
> [`src/engine/render/GlobalUniforms.js`](../../src/engine/render/GlobalUniforms.js),
> [`src/engine/pixel/PixelCanvas.js`](../../src/engine/pixel/PixelCanvas.js), and the patterns in
> [`src/engine/world/TileMap.js`](../../src/engine/world/TileMap.js) (`_patchMaterial`),
> [`src/game/SnowCover.js`](../../src/game/SnowCover.js) (`addSnowCover`),
> [`src/engine/lighting/LightPool.js`](../../src/engine/lighting/LightPool.js); for the type
> check, [`tsconfig.json`](../../tsconfig.json), [`tools/tsconfig.json`](../../tools/tsconfig.json),
> [`tools/typecheck.mjs`](../../tools/typecheck.mjs) and the `types.d.ts` files named in
> [§3.1](#31-the-type-check).
>
> **Related:** [contracts/README.md](../contracts/README.md) (how to change a contract) ·
> [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md) · [TESTING_AND_VERIFICATION.md](TESTING_AND_VERIFICATION.md) ·
> [architecture/RENDER_PIPELINE.md](../architecture/RENDER_PIPELINE.md) ·
> [architecture/modules/](../architecture/modules/README.md)

---

## 1. Language and modules

- **Plain JavaScript ES modules, type-checked through JSDoc.** No `.ts` source files, no
  framework, no bundler-specific syntax apart from Vite's `import.meta.glob`,
  `new URL(…, import.meta.url)` for workers, and the guarded `import.meta.env?.BASE_URL` that every
  URL of the site's files and of the level API starts with (`LevelStorage`, `CampaignStorage`,
  `ContentText`, the editor's story context; the `?.` keeps those modules usable from Node). Never a
  path from the site root (`/levels/…`): the site may live under a sub-path
  ([GETTING_STARTED §5](../user/GETTING_STARTED.md#5-build-and-deploy)). The JSDoc types
  are checked by the TypeScript compiler (`tsc` with `checkJs`, `npm run typecheck`,
  [§3.1](#31-the-type-check)); it only checks — Vite builds the same bytes with or without it.
  Declarations the JSDoc cannot express live in **type-only `.d.ts` files** that no bundle
  includes: a `types.d.ts` in the folders that need one (contract types, module augmentation) and
  [`src/globals.d.ts`](../../src/globals.d.ts) (the `window.__*` hooks). There is no linter or
  formatter; match the surrounding style (2-space indent, single quotes, semicolons, trailing
  commas in multi-line literals; comments wrapped near 100 characters, aim for code lines
  under 120).
- **three.js imports:** `import * as THREE from 'three'`; add-ons from `'three/addons/…'`
  (for example `three/addons/postprocessing/UnrealBloomPass.js`,
  `three/addons/utils/BufferGeometryUtils.js`).
- **Relative imports with the `.js` extension** (`'../utils/math.js'`). Node scripts in `tools/`
  import the same engine modules (`LevelFormat.js`, `ObjectCatalog.js`, `math.js`,
  `combat/defs.js`), so modules they use must not touch `window` or `document` at import time.
- **The public engine API is the barrel** [`src/engine/index.js`](../../src/engine/index.js). Add
  new public exports there, in the section of their module. Game and editor code may import from
  the barrel or from a module file directly (both are used).
- **No side effects on import** (ARCHITECTURE §2). The only exception is CSS: the modules in
  `src/engine/ui/` import their stylesheets (`ui.css`, `layout/base.css`, their own), and the editor
  entry `src/editor/main.js` imports `editor.css` and one Cinzel weight. Apart from the two entry
  points (`src/main.js` of `game.html`, `src/editor/main.js` of `editor.html`; the launcher
  `index.html` has no script), no module touches the DOM, creates WebGL resources or sets globals
  at import time (module-level scratch vectors are fine).
- **Workers:** `new Worker(new URL('./shoreWorker.js', import.meta.url), { type: 'module' })`
  (see [`Water.js`](../../src/engine/world/Water.js) and
  [`TerrainPreview.js`](../../src/editor/viewport3d/TerrainPreview.js)). Keep the worker's logic a pure
  function in a separate module (`WaterShore.js`) so the main thread can fall back to it.
- **Optional heavy modules** are loaded through `import.meta.glob` so a failure degrades
  gracefully and production builds still bundle them: `EditorApp` mounts `Viewport3D` this way and
  shows a placeholder with *Retry* when it fails.

## 2. Files and naming

| Thing | Convention | Examples |
| --- | --- | --- |
| Class modules | `PascalCase.js`, one main exported class per file | `TileMap.js`, `LightPool.js`, `EditorState.js`, `Viewport3D.js` |
| Function / data modules | `camelCase.js` | `math.js`, `config.js`, `dialogue.js`, `autosave.js`, `fields.js` |
| Constants and tables | `UPPER_SNAKE_CASE`; newer shared tables are `Object.freeze`d (`DEFAULT_BINDINGS`, `BIG_LEVEL_BATCHING`, `CAMERA`), older ones are not (`RENDER_ORDER`, `DIRECTIONS`) — never mutate them either way | `PPU`, `LEVEL_HEIGHT`, `OBJECT_TYPES`, `BIG_LEVEL_BATCHING`, `MAX_POINT_LIGHTS`, `DEFAULT_BINDINGS` |
| Private members | leading underscore | `_patchMaterial`, `_runJobs`, `this._tmpTint` |
| Module-level scratch objects | leading underscore, created once | `const _v = new THREE.Vector3();` |
| Shader uniforms | `u` + PascalCase | `uTime`, `uSunDirection`, `uSnowCover`, `uLmBounce` |
| Texture / material names | `luminati:<name>` | `luminati:grass`, `luminati:grass:normal` |
| Program cache keys | `luminati-<feature>[-variant][-vN]` (game-only materials may use their own prefix) | `luminati-tilemap-var-decal`, `luminati-sprite3d-lit-v1`, `luminati-wind-depth-bb`; `emberfall-player-silhouette-v2` (`src/game/Player.js`) |
| Browser storage keys | `luminati.<area>[.<name>]` in `localStorage` ([LEVEL_STORAGE_API.md §3](../specs/LEVEL_STORAGE_API.md#3-browser-storage-localstorage)) | `luminati.level.<slot>`, `luminati.campaign.<name>`, `luminati.editor.prefs`, `luminati.lang` |
| File-format ids | `luminati-<kind>` in a document's `format` (a `<NAME>_FORMAT` constant beside its reader) | `luminati-level`, `luminati-campaign`, `luminati-story`, `luminati-i18n`, `luminati-objects` (the editor clipboard) |
| Engine UI CSS classes and tokens | `lu-` prefix | `.lu-root`, `.lu-worldmap__label--compact`, `--lu-gold` |
| Editor CSS classes and tokens | `le-` prefix | `.le-dialog`, `.le-map2d-canvas`, `--le-bg1` |
| Test hooks | `window.__<name>` | `__game`, `__editor`, `__luminati`, `__terrain`, `__vp` |
| Console messages | `[Module]` prefix | `[Luminati]`, `[Engine]`, `[Viewport3D]`, `[editor]`, `[TileMap]`, `[AudioSystem]`, `[TextureLibrary]` |
| Sandbox files | `sandbox/<module>.html` + `.js`, scripts `sandbox/<module>[.<suite>].json` or `.actions.json` | `terrain.html`, `terrain.quick.json`, `core.actions.json` |
| Typedefs | PascalCase, named after what they describe, declared next to the code that produces the value | `PropResult` (`Props.js`), `GameHooks` (`Game.js`), `PointerEv` (`tools/index.js`), `LightKeyframe`, `TileMapInput` |
| Type-only files | `types.d.ts` in the folder whose modules it types; never `Foo.d.ts` beside `Foo.js` (it would shadow the module); `Window` members in `src/globals.d.ts` | `src/engine/level/types.d.ts`, `src/game/combat/types.d.ts`, `src/engine/core/types.d.ts` |

## 3. Comments and JSDoc

- **Every file starts with a header comment** that says what the module is for, how it fits in,
  and the non-obvious rules (see the headers of `LightPool.js`, `World.js`, `SnowCover.js`,
  `ResolutionGovernor.js`). Reasons and measurements belong there: `LightPool` explains why
  `priorityWeight` is 1.5 with the numbers that led to it.
- **JSDoc on public APIs** (ARCHITECTURE §2) — and the type check reads it, so it must be true
  ([§3.1](#31-the-type-check)). Options objects use inline types with `?` for optional keys and
  list the defaults in prose:

  ```js
  /**
   * @param {{ size?: number, interval?: number, fadeTime?: number }} [opts]
   *   - size (12): number of THREE point lights
   *   - interval (0.2 s): re-ranking period
   */
  ```
- **Shader code** lives in template literals tagged with `/* glsl */` so editors highlight it.
- **Say why, not what.** Comments in this code base usually record a decision or a measured
  trade-off (`Game.init`: "64 taps is plenty for this blur radius (96 cost 0.06–0.26 ms more at
  1080p … for no visible gain)"), which is what a later reader needs before changing it. Keep that
  habit — and quote the measurement, not a guess.
- Refer to docs by repository path (`docs/contracts/LEVEL_EDITOR.md §5`).

### 3.1 The type check

`npm run typecheck` ([`tools/typecheck.mjs`](../../tools/typecheck.mjs)) runs the TypeScript
compiler over the JavaScript and its JSDoc in two programs and exits 1 if either reports an error
(both run, so one call lists every error; about a second each):

| Program | Config | Checks |
| --- | --- | --- |
| Browser | [`tsconfig.json`](../../tsconfig.json) | `src/**/*.js`, `src/**/*.d.ts`, `sandbox/**/*.js` with DOM and `vite/client` types |
| Node tools | [`tools/tsconfig.json`](../../tools/tsconfig.json) (extends it) | `tools/**` with Node types, plus the `src/` modules the generators import (checked a second time under Node globals) |

Nothing is emitted, and **Vite never type-checks**: `npm run dev` and `npm run build` succeed
with type errors, so run the check yourself. The settings that shape what it can catch:
`allowJs` + `checkJs` + `noEmit`; **`strict: false`** — no `noImplicitAny` (an unannotated
parameter or a read of an unknown member of a plain object literal is `any`, silently) and no
`strictNullChecks` (`null` fits every type), so the check catches wrong names, shapes, literal
unions and call arities wherever the code is typed, not missing null checks; `skipLibCheck: false`
(the project's `.d.ts` files and the assertions in them are checked); `moduleResolution: bundler`;
`lib` ES2023 + DOM; no `paths`, so an import from the site root (`import('/src/…')`) fails the
check — the site may live under a sub-path. The dev dependencies are `typescript`
^7.0.2, `@types/three` ^0.186.0 (bump it together with `three`) and `@types/node` ^24.19.0.
JSDoc keeps the runtime sources directly executable as JavaScript while checking their interfaces. See [TESTING_AND_VERIFICATION.md §8.4](TESTING_AND_VERIFICATION.md#84-the-type-check)
for what the checker catches and its limits.

**Rules.**

- **Run `npm run typecheck` with the other checks before finishing.** Both programs report 0
  errors today, with no `@ts-nocheck`; keep it that way.
- **Type new public APIs with JSDoc**: parameters, return values, option bags (inline
  `{{ size?: number }}` or a `@typedef` with `@property` lines), class fields that start as
  `null` (`/** @type {Viewport3D|null} */ this.view3d = null`). A literal that must stay a union
  needs its type (`/** @type {EnemyState} */`), or it widens to `string`.
- **Typedefs live next to their producer** (`@typedef` + `@property` above the code that builds the
  value: `PropResult` in `Props.js`, `GameHooks` above `Game._exposeGlobal`, `PointerEv` in
  `tools/index.js`). Types JSDoc cannot express — a union derived from data, an interface shared
  by several folders, a module augmentation — go into the folder's `types.d.ts`.
- **One `@import` block per file**, after the runtime imports, for every type the file uses more
  than once: `/** @import { Level, LevelObject } from '../engine/level/types.js' */` (the `.js`
  path resolves to `types.d.ts`). Do not repeat inline `import('…')` types through a file.
- **Prefer fixing the declared type to casting.** When the checker cannot follow correct code,
  cast one expression: `/** @type {X} */ (expr)` — the parentheses are part of the syntax. No
  `/** @type {any} */` casts.
- **Lazily created fields** (`this._x ??= …`) and fields another module writes are declared by
  module augmentation in the folder's `types.d.ts` (`declare module './Foo.js' { interface Foo {
  _x?: … } }`), never in a `Foo.d.ts` beside `Foo.js`, which would shadow the module and hide its
  code from the check.
- **`// @ts-expect-error <reason>`** only with its reason on the same line, for code that is right
  but cannot be typed; never `@ts-ignore`. When the cause goes away the directive itself fails
  (TS2578) — delete it in the same change. **`// @ts-nocheck`** only as a last resort, with the
  reason in the file header; there is none today.
- **Contract additions are typed where the contract's checked copy lives** (table below): a new
  object type's optional fields in `ObjectExtras`, a new enemy field in the `defs.js` typedefs, a
  new hook in its `…Hooks` typedef, a new editor event in `EditorEvents`. What the check asks for
  when you add an object type, enemy kind, sound, input action, particle preset, editor event or
  hook is listed in [TASK_PLAYBOOKS §21](../ai/TASK_PLAYBOOKS.md#21-fix-a-failing-type-check).
- **Keep the browser graph out of the Node program.** A module the generators import
  (`LevelFormat.js`, `ObjectCatalog.js`, `math.js`, `combat/defs.js`) must not import browser
  modules through its types: that is why `defs.js` keeps its enemy typedefs as JSDoc.
- **Private helpers** may use a one-line block: `/** @param {number} x @param {number} z */`.

**Where the contract types live** (the checked copies of the contracts' interfaces; where the
contract text and the code differ they follow the code and say so):

| Types | File | Describes |
| --- | --- | --- |
| `Level`, `LevelEnvironment`, `LevelWater`, `LevelSpawn`, `TileDef`, `ObjectType`, `LevelObject`, `LevelObjectOf<T>`, `ObjectExtras`, `ObjectTypeDef`, `FieldDef`, `Rect`, `TileRect` | [`src/engine/level/types.d.ts`](../../src/engine/level/types.d.ts) | the `luminati-level` document (LEVEL_EDITOR.md §1–§2). `LevelObject` is a union discriminated on `type`, derived from `OBJECT_TYPES` (checked against `ObjectTypeDef` with `@satisfies`), so a new catalog type or default is typed without editing the file |
| `ObjectTextKeys`, `Level.textKeys`, `StoryFields.textKeys`; `Mint`, `SharedKeys`, `KeyedText` | [`src/engine/level/types.d.ts`](../../src/engine/level/types.d.ts); [`TextKeys.js`](../../src/engine/i18n/TextKeys.js) | the text keys a level's own texts and its objects hold ([I18N.md §4.2](../specs/I18N.md#42-keys-and-lookup)); a minter, copy-on-write's other copies and a keyed text with its English (I18N.md §4.10). `campaign.json`'s and a chapter's `textKeys` are typed in [`CampaignFormat.js`](../../src/game/campaign/CampaignFormat.js) |
| `PropResult`, `PropParts`; `TileMapInput`, `Tile`, `Collider` | [`Props.js`](../../src/engine/world/Props.js); [`TileMap.js`](../../src/engine/world/TileMap.js) | prop results (ARCHITECTURE §4 Props.js); the terrain's input, tiles and colliders. [`world/types.d.ts`](../../src/engine/world/types.d.ts) also asserts that every catalog prop type has a `PropFactory` method that declares its default `opts` |
| `CombatContext`, `PlayerView`, `Brain`, `HitSpec`, `ProjectileSpec`, `MarkerSpec`, `HitInfo`, `EnemyInit`, `CombatHooks`, `CombatState` …; `EnemyKind`, `EnemyDef`, `ScaledEnemyDef` | [`src/game/combat/types.d.ts`](../../src/game/combat/types.d.ts); [`combat/defs.js`](../../src/game/combat/defs.js) | the combat interfaces (COMBAT.md §9, §20) |
| `Tool`, `RotatableTool`, `PointerEv`, `ToolPreview`, `ToolCursor`; `EditorEvents` | [`src/editor/tools/index.js`](../../src/editor/tools/index.js); [`src/editor/types.d.ts`](../../src/editor/types.d.ts) | the tool interface (LEVEL_EDITOR.md §7); the `EditorState` events by name |
| `GameHooks`, `EditorHooks`, `LuminatiHooks`; `Window` members | [`Game.js`](../../src/game/Game.js), [`EditorApp.js`](../../src/editor/EditorApp.js), [`main.js`](../../src/main.js); [`src/globals.d.ts`](../../src/globals.d.ts) | the automation hooks (AUTOMATION_API.md); the sandbox handles are typed by a typedef in each sandbox file |
| `GlobalUniforms`, `SceneNode`, `SolidMesh`; `ActionName` / `ExtraActions`; `SfxName`; `Direction` | [`render/types.d.ts`](../../src/engine/render/types.d.ts); [`Input.js`](../../src/engine/core/Input.js) / [`core/types.d.ts`](../../src/engine/core/types.d.ts); [`AudioSystem.js`](../../src/engine/audio/AudioSystem.js); [`constants.js`](../../src/engine/constants.js) | the shared uniforms and scene-graph walks; input action names (runtime actions by augmenting `ExtraActions`); sound names; the four facings |

**Reasons for existing `@ts-expect-error` annotations:** the `castShadow` / `receiveShadow` accessors of `Sprite3D`
(an accessor overriding an `Object3D` field, TS2611); the `= {}` defaults of the `PropFactory`,
`TileMap` and `Viewport3D` constructors (they lack `textures` on purpose — the constructors throw
without it, and an optional `textures` would stop flagging a caller that forgets it) and of
`createWaterfall`; `self.postMessage(…, [transfer])` in the two `shoreWorker.js` files (the
worker scope is typed as `Window`); a duplicate key in `sandbox/enemy_ai.js`'s `window.__sb`; the
unknown kind `sandbox/sprite_art.js` passes on purpose to prove `createEnemySheet` throws; and
`headless: 'new'` in `tools/check.mjs` (puppeteer 25's types dropped the value; it still runs).
What the check does not see is listed in
[KNOWN_ISSUES § Type check](../ai/KNOWN_ISSUES.md#type-check).

## 4. Units, axes and conventions

| Convention | Value | Defined in |
| --- | --- | --- |
| Up axis | +Y | ARCHITECTURE §2 |
| Texel density | `PPU = 16` texels per world unit (textures and sprites) | `constants.js` |
| Tile size | `TILE_SIZE = 1` world unit; tile `(i, j)` covers `x ∈ [i, i+1]`, `z ∈ [j, j+1]`, centre `(i + 0.5, h, j + 0.5)` | `constants.js` |
| Rows | Map rows (`tiles`, `heights` strings) run along +Z | `LevelFormat.js` |
| Terrain height | `LEVEL_HEIGHT = 0.5` world units per level; level chars `0`–`9`, `a`–`z` = 0–35 (upper-case `A`–`Z` are read as 10–35 too; anything else reads as 0) | `constants.js`, `LevelFormat.charToLevel` |
| Camera yaw 0 | camera on the +Z side looking toward −Z, so screen-down = +Z | `constants.js` |
| Sprite directions | `DIRECTIONS = ['down', 'left', 'right', 'up']` (+Z faces the camera, −X, +X, −Z), in sheet row order | `constants.js` |
| Characters | ~2 units tall (32 px frames) | ARCHITECTURE §2 |
| Transparent render order | `RENDER_ORDER = { WATER: 10, DECALS: 20, GODRAYS: 40, PARTICLES: 50, UI_WORLD: 90 }` | `constants.js` |
| Light units | physically based: `decay = 2`, intensity in candela (lanterns ~4–20 with distance 6–10) | ARCHITECTURE §2 |
| Time of day | hours 0–24 (`17.2` = golden hour, 17:12) | `LightingSystem` |
| Angles in data | level files store rotations in radians; the editor shows degrees | `ObjectCatalog.js` fields |

## 5. Colour management

- `renderer.outputColorSpace = SRGBColorSpace`. Colour textures (albedo, emissive) use
  `SRGBColorSpace`; data textures (normal maps, masks) use `NoColorSpace`
  (`makePixelTexture(canvas, { srgb: false })`).
- **Tone mapping happens once**, in PostFX's `OutputPass` (ACES Filmic). The grade after it works
  on display-space values.
- **`LightingSystem` owns `renderer.toneMappingExposure`.** It writes it every frame; apart from
  `Engine` initialising it to 1, nothing else does.
- Colours in pixel-art code go through `PALETTE` ramps and the `PixelCanvas` colour helpers
  (`parseColor`, `mixColor`, `shadeColor`, `rampFrom`). Keep HDR values in mind: a value that is far
  above 1 after lighting tone-maps to cream, and the bloom threshold in the game is 1.05.

## 6. Determinism

- **Procedural content is seeded.** Use `RNG`, `mulberry32`, `hash2`, `valueNoise2`, `fbm2` and
  `hashString` from [`src/engine/utils/math.js`](../../src/engine/utils/math.js). Never
  `Math.random()` for anything that shapes the world, a texture, a sprite, level data or a
  generator's output. The world must look identical on every load: regression fingerprints,
  screenshot comparisons and the generators' byte-identical output depend on it.
- **Accepted exceptions** (all transient or local to one session): the dialog blip's pitch and the
  waterfall splash offsets in `Game.js`; editor session and DOM ids (`autosave.js`,
  `ui/Dialog.js`); the next Place-tool seed (`PlaceTool.js`, stored into the placed object's
  `opts.seed`, so the level itself stays reproducible); the harness's port.
- **Text keys** are identities, made once and then kept: the editor mints them with `randomGuid`
  (Web Crypto, never `Math.random`); the generators and `npm run i18n:keys` with
  `seededMint(<repository-relative path>)` (`guidOf` of the file and the text: the same input gives
  the same keys, so their output stays byte for byte — an OS path would differ between machines, so
  it throws); scripted checks seed the editor with `__editor.seedTextKeys(prefix)`.
- **Seeds derive from content**, not from load order: props seed variation from kind and position,
  `TextureLibrary` from its seed (1337 by default) and the texture name, flicker from the light
  position. Adding an object must not reshuffle unrelated ones — except in generators with
  sequential scatter, where a new rule early in the sequence reshuffles everything after it
  (documented in `make-starfall-vale.mjs`).
- **Level data round-trips byte-for-byte**:
  `normalizeObject` keeps an object's own key order and only *appends* catalog defaults it lacks,
  unknown fields survive, and optional fields without a catalog default (`environment.minimap`,
  `water.glint`, …) are written only when set. A file that is already normalised — every shipped
  level — therefore loads and saves to the same bytes.

## 7. Disposal and ownership

- Every class that allocates GPU resources has `dispose()` (ARCHITECTURE §2). Prop results,
  sprite sheets and builders have one too.
- `disposeObjectTree(root)` ([`Engine.js`](../../src/engine/core/Engine.js)) disposes geometries,
  materials and textures under a node once each. `Engine.dispose()` does this for the whole scene;
  pass `{ disposeScene: false }` when the scene shares resources you do not own — the editor's
  `Viewport3D` does, because the app's `TextureLibrary` outlives it.
- **Shared resources are never disposed by consumers**: the `TextureLibrary` and its cached
  materials, `globalUniforms`, shared uniform objects such as `snowCover`.
- When replacing a built mesh at runtime, free the old one **after** its replacement has rendered,
  so programs they share are not released and recompiled (the editor frees replaced terrain,
  water, props, ghosts and ground-foliage fields one frame late).
- `Game.dispose()` tears down in a fixed order, each step guarded by `try / catch`, and deletes
  `window.__game`. Follow that pattern for new top-level objects.

## 8. No per-frame allocations

Avoid allocations in `update()` and render paths: garbage collection can interrupt frame pacing.

- Take an optional `out` argument. Per-frame getters default it to an internal object
  (`Input.getMoveVector(out = this._move)`, `CameraRig.getMoveBasis(out = this._basis)`);
  where the default allocates (`TileMap.move(from, dx, dz, radius, maxStep, out = { x: 0, z: 0 })`),
  the per-frame callers pass their own `out`.
- Keep scratch vectors, quaternions, matrices and colours at module level (`const _v = new
  THREE.Vector3()`), or as `this._tmp…` members.
- Use indexed `for` loops in hot paths, not `forEach` / `map` / spread / destructuring of arrays;
  hoist option objects out of loops (`TileMap._tint` caches its `fbm2` options); store point lists
  in typed arrays (`AudioDirector`'s water points became a `Float32Array` after the Starfall review).
- Cache per-name lookups (`Sprite3D._resolve` caches per animation and direction, so NPCs calling
  `play('idle')` every frame allocate nothing).
- Static meshes set `matrixAutoUpdate = false` (the prop `MeshBuilder` does) — hundreds of props
  otherwise recompose their matrices every frame.
- DOM: write styles only when a value changes; pause hidden animations; the debug panel stops
  `listen()`ing while hidden.

## 9. Rendering invariants

These are the rules that are easiest to break (also listed in [`AGENTS.md`](../../AGENTS.md)):

1. **The point-light count is fixed after the first frame — at most 12** (one per light
   descriptor up to 12, else 12 shared ones). Adding or removing lights, or toggling
   `light.visible`, recompiles every lit shader. Fade intensities instead; levels with more light
   sources share the 12 through `LightPool`.
2. **Warm up shaders against `postfx.sceneTarget`**, the linear HDR target, not the canvas. A
   material or effect that first appears mid-game must be compiled at load (the game primes
   particle burst pools for this reason).
3. **Toggle shadows through intensity**, not `castShadow` (LightingSystem's `shadows` setting sets
   `shadow.intensity` to 0 and stops auto-updates, so no recompile happens).
4. **Tone map once; LightingSystem owns exposure** (§5).
5. **Custom shaders read `globalUniforms` by reference** (§12).
6. **Rendering budgets** at 1600 × 900: ≤ ~300 scene draw calls including the shadow pass,
   one 2048² sun shadow map, DOF at half resolution, 60 fps
   ([architecture/PERFORMANCE.md](../architecture/PERFORMANCE.md)).
7. **Big-level code paths are gated** (`World.isBigLevel`: either side > 64 tiles) so small levels
   keep building exactly the same meshes and lights.

## 10. Textures and materials

- **Pixel textures** are created only through `PixelCanvas#toTexture()` or
  `makePixelTexture(canvas, { wrap, mipmaps, srgb, anisotropy, name })`: NEAREST magnification
  always; minification NEAREST without mipmaps (default) or trilinear
  (`LinearMipmapLinearFilter`) with `mipmaps: true`; `wrap: 'repeat'` (default) `| 'clamp' |
  'mirror'`; `srgb: true` (default) for colour, `false` for data (normal maps, masks).
- **World textures** come from `TextureLibrary` (`get(name)`, `normal(name)`, `emissive(name)`,
  `pixels(name)`, `meta(name)`, `material(name, extra)`). Scale UVs by `meta(name).units` — many
  textures cover 2 × 2 or 4 × 4 world units, not one.
- **`material(name, extra)` returns a cached, shared `MeshLambertMaterial`.** Never mutate it; pass
  the variant you need in `extra` (the cache key includes functions such as `onBeforeCompile` by
  their source and textures by uuid), or create your own material from the library's textures
  (as `TileMap` does).
- Emissive surfaces (windows, lantern glass) keep their `emissiveMap` bound at all times and are
  registered with `LightingSystem.registerEmissive(material, { day = 0, night = 1.6, flicker })`,
  which drives `emissiveIntensity` with the night factor each frame — dark by day, lit at night,
  and never a recompile (the map is never added or removed).
- Prop-specific textures that are not in the library are painted in
  [`props/PropTextures.js`](../../src/engine/world/props/PropTextures.js) with the same density
  and palette.

## 11. Shader patching with `onBeforeCompile`

The engine extends built-in materials instead of writing full shaders where it can. The
pattern, abridged from `TileMap._patchMaterial` (`BOUNCE_PARS`, `BOUNCE_APPLY`, `VARIATION_*`
and `DECAL_ALPHA` are GLSL strings defined in the same file):

```js
m.onBeforeCompile = (shader) => {
  // attach SHARED uniform objects (one write per frame updates every material)
  shader.uniforms.uLmBounce = this._bounceUniform;
  shader.uniforms.uSunColor = globalUniforms.uSunColor;
  shader.uniforms.uSunDirection = globalUniforms.uSunDirection;
  let fs = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${BOUNCE_PARS}${variation ? VARIATION_GLSL : ''}`)
    .replace('#include <lights_fragment_maps>', BOUNCE_APPLY);
  if (variation) fs = fs.replace('#include <map_fragment>', VARIATION_MAP).replace('#include <normal_fragment_maps>', VARIATION_NORMAL);
  if (decal) fs = fs.replace('#include <alphamap_fragment>', DECAL_ALPHA);
  shader.fragmentShader = fs;
};
// one program per distinct patch variant
m.customProgramCacheKey = () => `luminati-tilemap${variation ? '-var' : ''}${decal ? '-decal' : ''}`;
```

Rules:

- **Anchor on chunk includes** and keep the original include in your replacement when you only
  add code before or after it.
- **`customProgramCacheKey` must be unique per variant.** Overriding it with a constant means every
  material returning that constant shares one program — encode every option that changes the GLSL.
- **Chain, don't overwrite, when a material may already be patched.** `addSnowCover` keeps the
  previous `onBeforeCompile`, calls it first, then appends its own step and extends the key
  (`${baseKey}|luminati-snow-ground`). Set `material.needsUpdate = true` after installing a patch on
  a material that may already have compiled.
- **Guard the maths.** `pow()` of a negative base or a division by zero produces NaN, and one NaN
  pixel spreads through the bloom mip chain as black and white blocks. Wrap long-running time
  hashes with `mod(…)` so float precision does not degrade after hours of `uTime`.
- **Custom `ShaderMaterial`s that should be fogged** set `fog: true` and include the fog chunks
  (`fog_pars_vertex`, `fog_vertex`, `fog_pars_fragment`, `fog_fragment`) and put
  `uFogStart: globalUniforms.uFogStart` into their uniforms; do not compute `vFogDepth` yourself
  or the demo's fog-start offset is bypassed.

**Chunk anchors used in the code** (all exist in three r186 under
`node_modules/three/src/renderers/shaders/ShaderChunk/`): `common`, `uv_vertex`, `begin_vertex`,
`beginnormal_vertex`, `project_vertex`, `shadowmap_vertex`, `map_fragment`, `alphamap_fragment`,
`alphatest_fragment`, `normal_fragment_begin`, `normal_fragment_maps`, `emissivemap_fragment`,
`lights_lambert_pars_fragment`, `lights_fragment_maps`.

**`MeshLambertMaterial` fragment `main()` order in r186** (from
`node_modules/three/src/renderers/shaders/ShaderLib/meshlambert.glsl.js`) — use it to pick where a
patch must go:

```
clipping_planes_fragment → logdepthbuf_fragment → map_fragment → color_fragment → alphamap_fragment → alphatest_fragment
→ alphahash_fragment → specularmap_fragment → normal_fragment_begin → normal_fragment_maps
→ emissivemap_fragment → lights_lambert_fragment → lights_fragment_begin → lights_fragment_maps
→ lights_fragment_end → aomap_fragment → (outgoingLight) → envmap_fragment → opaque_fragment
→ tonemapping_fragment → colorspace_fragment → fog_fragment → premultiplied_alpha_fragment
→ dithering_fragment
```

For example, `SnowCover` inserts before `emissivemap_fragment`, where the normal-mapped `normal`
and the final albedo are both available; `TileMap` adds its wall bounce at `lights_fragment_maps`.
When upgrading three.js, re-check every anchor above.

## 12. Global uniforms

Modules do not talk to each other for per-frame sync. They share the uniform objects in
[`GlobalUniforms.js`](../../src/engine/render/GlobalUniforms.js); custom shaders attach the
objects themselves (`uniforms.uTime = globalUniforms.uTime`), never a copy of the value.

| Uniform | Meaning | Written by |
| --- | --- | --- |
| `uTime` | seconds since start (affected by `timeScale`) | `Engine` |
| `uNight` | 0 = day … 1 = full night | `LightingSystem` |
| `uWind`, `uWindStrength` | XZ wind direction × speed, gust strength | anyone (the demo's `Weather`) |
| `uCameraYaw`, `uCameraPosition` | billboard orientation, camera position | `CameraRig` |
| `uSunDirection` | normalised, points from the scene toward the light (the moon at night) | `LightingSystem` |
| `uSunColor` | linear, intensity-scaled | `LightingSystem` |
| `uFogColor` | fog colour | `LightingSystem` |

## 13. Error handling and logging

- **The harness fails a run on page errors and reports console errors**, so reserve
  `console.error` for real failures and use `console.warn` for expected problems (a hand-edited
  level that needed repair, the light budget, an unknown dialogue script).
- **Level data never throws for recoverable problems.** `normalizeLevel` returns
  `{ level, warnings }` and throws only when the input is not a Luminati level at all;
  `validateLevel` returns the hard errors that make a level unplayable. The game logs both as
  `[Luminati] <source>: …` warnings and shows load failures on the loading screen with links out.
- **Names from level data are untrusted keys.** Look a name read from a level (a type, kind,
  preset, facing, script, texture or colour name …) up with `isOwnKey(TABLE, name)` or
  `ownValue(TABLE, name) ?? fallback` from [`src/engine/utils/own.js`](../../src/engine/utils/own.js),
  never `TABLE[name]` or `name in TABLE`: those find `Object.prototype` members, so
  `"constructor"` or `"__proto__"` would pass the test and break on the value (KNOWN_ISSUES
  LVL-17). `Array#includes` on a list of names and a `Map` are safe too. A dictionary that stores
  entries under level strings is a `Map` or `Object.create(null)` (`Game.inventory`). At load,
  convert a value that should be text or a number with `toText` / `toNumber`, and put any value
  into a message with `showValue`: `String()`, `Number()` and template literals throw on a JSON
  object with its own `toString` key.
- **Keep the loop alive.** `Engine` catches a throwing system, listener or render function, logs
  it once by name and emits `'error'`; the frame continues.
- **Validate public and automation APIs.** `setTime(NaN)` is ignored, `teleport` returns `null`
  when no standable spot is near, `talkTo` returns `false` while busy.
- **Restore state in `finally`** (a throwing conversation must still end the NPC's talk state;
  `restUntilMorning` restores the busy flag).
- UI callbacks catch their own errors (a failing dialog button logs and keeps the dialog open).

## 14. Contracts and additive changes

Never rename or change the meaning of a member of `ARCHITECTURE.md` or
`docs/contracts/LEVEL_EDITOR.md`; add optional members and fields with defaults that reproduce the
old behaviour, gate new behaviour so existing content is unchanged, and update the docs in the
same change. The full rules and examples are in [contracts/README.md §3](../contracts/README.md#3-how-to-change-a-contract-the-additive-rule).

For level fields in particular:

- `normalizeLevel` / `normalizeObject` write catalog defaults into files. Prefer optional
  fields absent by default; if a new default is necessary, regenerate or re-save every affected
  shipped level in the same change.
- The editor must not write a default into a file that did not have the field (Level settings
  writes `environment.minimap` only when it is `false` or the file already had the key, and
  `water.glint` only when it is not 1 or was already there) and must keep unknown keys (it copies
  the file's `water` object and only overwrites the keys it edits).
- Behaviour that depends on an object's position is stored relative to the object.

## 15. UI and CSS theming

- **Engine UI** ([`src/engine/ui/`](../../src/engine/ui/), contract
  [PIXEL_UI.md](../specs/PIXEL_UI.md)): pixel art after mockup G. Colours only from G's palette
  (`art/palette.js` `PALETTE`; CSS `var(--g-<token>)` on `.lu-root`); sizes only in art px
  (`calc(var(--px) * n)`, `layout.js` `U(n)`) — no `vw` / `clamp()`; text only through `txt()` in a
  type role (`layout/type.js`); the fonts come from `FontLoader.js` (Google Fonts first, else the
  `@fontsource` copies in `dist/`), never an `@fontsource` import in the game UI. Every word the
  player reads is a string-table key (`t()`, en / ja / zh; also the defaults standing in for blank
  data and the prompt's built-in verbs) or data translated at display by the caller — prose by the
  key the data holds, `loc(key, english)` with the key read by `ContentKeys.js`' readers
  (`textKeyOf`, `pageKeyOf`, `dialogueKeyOf`, `choiceKeyOf`) or a script node's `tk`, names as
  terms, `term(name)` — never written back into data or state, and no key is ever formatted or
  typed by hand ([I18N.md](../specs/I18N.md) §4; a code
  line of the game's own is `loc('<ns>.<name>', 'English')` with both literal, so the extractor
  finds it). Each component has its own stylesheet, scoped `.lu-root .lu-x …`.
  Layering inside `#luminati-ui`: HUD 2 · banner 3 · dialog 4 · prompt 4 · toasts 5 · title 6 ·
  world map 7 · fader 8 · debug 9.
- **Launcher** (`index.html`, [`src/launcher/launcher.css`](../../src/launcher/launcher.css)): a
  plain English page in the sandbox gallery's look, outside the pixel UI and its languages — tokens
  on `:root` (`--gold`, `--panel` …), `lu-` classes at the page root (no `.lu-root`), Cinzel and
  Crimson Pro from `@fontsource`. Its list is HTML written by
  [`tools/vite-launcher.js`](../../tools/vite-launcher.js): every text read from a file escaped,
  every link relative.
- **Editor UI** ([`src/editor/editor.css`](../../src/editor/editor.css)): tokens on `:root` —
  navy backgrounds `--le-bg0` `#080c18` … `--le-bg5` `#2a3758` (`--le-bg1` is `#0e1424`), gold
  `--le-gold` `#c9a45c`, text `--le-text`, status colours `--le-danger`, `--le-ok`, `--le-warn`,
  base size `--le-fs` 13 px (14 px from 2200 px wide).
- **The UI does not bind gameplay keys itself**; the game wires input actions to UI calls, so a
  key cannot toggle something twice (the dialog reads `confirm` / `cancel` / `up` / `down` through
  the `Input` passed to `ui.update` and consumes them). The only raw listeners are the title
  screen's "press any key" handlers (`keydown` on `window`, `pointerdown` on the title, a gamepad
  poll), attached only while the title is shown, and click handlers on the dialog panel and its
  choices. `Input` takes no keys while a text
  field has focus, and the wheel over lil-gui panels, form fields and `[data-input-ignore]`
  elements (`Input.wheelIgnoreSelector`) is not fed to it.
- **Buttons clicked with the mouse are blurred** (editor, sandboxes) so a later Space / Enter does
  not re-trigger them.

## 16. Documentation conventions

- Docs live in `docs/` ([README](../README.md)); the binding contracts stay where they are
  (`ARCHITECTURE.md` at the root, `docs/contracts/LEVEL_EDITOR.md`). [`AGENTS.md`](../../AGENTS.md)
  holds shared guidance for contributors and coding tools; `CLAUDE.md` points to it.
- Reference documents start with a header block: purpose, audience, source of truth (the code paths it
  describes), related docs.
- Keep examples portable: use repository-relative paths or named placeholders, and exclude
  personal account details, machine names, credentials and private session logs. Benchmark
  hardware and software belong only with the measurements they explain.
- Link relatively, to docs and to source files; refer to code by path and symbol name, never by
  line number.
- One canonical place per topic: link instead of copying (the level format lives in
  [specs/LEVEL_FORMAT.md](../specs/LEVEL_FORMAT.md), module APIs in
  [architecture/modules/](../architecture/modules/README.md), controls in [user/](../user/GETTING_STARTED.md)).
- When behaviour changes, update the docs in the same change: the contract if it is binding, the
  reference page, `README.md` if users see it, and `MODULE_NOTES.md` when a module deviates from its
  contract.
