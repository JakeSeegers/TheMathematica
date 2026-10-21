# Luminati Combat — Design & Contracts

> **Superseded in part (the GLAIVE conversion).** Fights on combat levels are now turn-based on the
> GLAIVE rules: **[GLAIVE.md](../specs/GLAIVE.md)** is the reference for how combat plays. The
> real-time parts below no longer describe the code — the player kit (§5.1–§5.2 bindings, §6), the
> enemy actor and brains (§7.3–§7.7, §9.2–§9.3), Cinderheart's real-time moves (§8.2–§8.3), the hit,
> projectile and lock-on records (§9.5), the fixed-step play-through bot and its digests (§21,
> §27.18), and the companions' real-time fight (§28). Their files (`CombatSystem.js`, `Enemy.js`,
> `ai/*.js`, `PlayerCombat.js`, `Hitboxes.js`, `Projectiles.js`, `Targeting.js`, `CombatInput.js`,
> `party/MemberCombat.js`) were removed. What still holds: enabling combat per level (§3), the
> engine additions (FX quads, ground markers, particles, sprites, audio, input, the combat UI
> components, §10–§13), the level data and the catalog (§14), Cinderwatch Pass and its generator
> (§15), the editor support (§17) and the shared world pieces in `src/game/combat/` (waystones,
> chests, pickups, the boss arena, effects, music, the walk grid). The rest is kept as the history
> of the real-time design.

> **Status.** **Binding contract** for the ARPG combat system, its engine additions, the combat
> catalog types and the demo level *Cinderwatch Pass*. Like the other contracts it may only be
> changed additively ([contracts/README.md](README.md)). Document any necessary deviation
> alongside the code change and record its reason in §27.
>
> **Audience.** Contributors changing combat, its engine dependencies, level data or tests.
>
> **Revision 2** (after the design review): the review findings and how each was resolved —
> including the ones rejected, with the reason — are listed in §26.
>
> **Revision 3** (integration, 2026-09-28): every deviation of the seven packages that was kept,
> and the integrator's own changes after playing the level end to end, are recorded in **§27**.
> Where a row of §27 and the text above disagree, §27 describes the code.
>
> **Revision 4** (review fix passes and final verification, 2026-09-28): three fix passes after the
> code review (game, art-level, editor) and the final regression pass are recorded in
> **§27.9–§27.12**. The values those passes changed are also amended in place in the sections
> above, each marked *(rev. 4, §27.x Nn)*, so the text describes the shipped code; the §27 row
> keeps the old value and the reason.
>
> **Revision 5** (the known-issues pass, 2026-09-28): the fixes of the open combat rows of
> KNOWN_ISSUES — enemy paths and zones, numeric tags, test hooks, `Sprite3D.bodyOpacity`, the chunk
> split, the sliced marker bake, the boss-death bursts and magma crust, the labels' HUD keep-out,
> the primed death screen, art, the crag ridge and moved buildings, the editor's enemy batch, the
> audio QA, the fixed-step play-through bot, balance numbers and the shop — are recorded in
> **§27.13–§27.20** and amended in place above, marked *(rev. 5, §27.x Nn)*.
>
> **Revision 6** (the type-check pass, 2026-09-30): the §9 and §20 interfaces now have a
> type-checked copy, [`src/game/combat/types.d.ts`](../../src/game/combat/types.d.ts) (and the
> enemy data types in [`defs.js`](../../src/game/combat/defs.js)), written from the code;
> where it differs from the text below is recorded in **§27.21** and marked *(rev. 6, §27.21 Jn)*.
>
> **Revision 9** (the party, 2026-10-08, [PARTY.md](../specs/PARTY.md)): companions — party
> members who fight beside the player — are part of the combat: `addAlly` / `removeAlly` /
> `healAllies`, a per-enemy target (`ctx.player` is the target's view), their hits and the enemies'
> hits on them, separation, the boss arena, hooks and state. Recorded in **§28**; with no
> companion every rule above is unchanged (the fixed-step bot's digest stays `1d81f069`).
>
> **Revision 12** (a party of four, 2026-10-11,
> [Party balance](../specs/PARTY.md#9-the-demo-the-companions-of-cinderwatch-pass)):
> Cinderwatch Pass gains two companions who join at the Waystone Camp — Sister Ilse (a mystic, the
> healer) and Rook (a ranger) — beside Sela (a warden) at the Crossroads Waystone, and its enemy
> groups and Cinderheart's HP are balanced for the player with that full party. Nothing scales
> with the party's size; alone the pass is hard by design. No rule of the combat code changes
> (only the golem's `hp`, data). Recorded in **§27.24** and amended in place in §7.1, §8.3, §9.4,
> §15, §21, §23 and §28, marked *(rev. 12, …)*. The fixed-step bot now recruits the party: its
> digest is `cf165213` (`combat.play.human.json`: `8c4ef71b`).
>
> **Relation to the other contracts.** [`ARCHITECTURE.md`](../../ARCHITECTURE.md) (engine
> conventions, §4 module contracts) and [`LEVEL_EDITOR.md`](LEVEL_EDITOR.md) (level format,
> catalog, editor) stay binding; this document only adds to them. Known traps referenced below by
> id (SPR-01, LVL-02, REN-11 …) are in [KNOWN_ISSUES.md](../ai/KNOWN_ISSUES.md); recipes and
> fingerprints (§16) are in [TASK_PLAYBOOKS.md](../ai/TASK_PLAYBOOKS.md).

**Conventions used in this document**

| Unit | Meaning |
| --- | --- |
| `f` | one frame at 60 Hz = 1/60 s. "f5–7" means frames 5, 6 and 7 of an action (the first frame of an action is f0). Implementations store seconds (`f / 60`) and compare with `EPS = 1e-6`. |
| `u` | world units (1 tile = 1 u, 16 texels per u, one height level = 0.5 u). |
| `mv` | motion value — the damage multiplier of a hit. |
| `kb` | knockback distance in u (before the victim's mass). |
| angles | degrees unless the name says `rad`. Directions in XZ are unit vectors `(dirX, dirZ)`; yaw 0 camera looks −Z, so "north" = −Z = up-screen, "south" = +Z. |
| colours | linear HDR multipliers `(r, g, b)`; a max channel above ~1.4 blooms (bloom threshold 1.05, Game `_tunePost`). |

---

## 1. Summary and decisions

Real-time action combat (Secret of Mana / Ys lineage, in the 2.5D pixel-art look) that exists **only on
levels that enable it**. The player gets a 3-hit sword combo, a dodge roll with invulnerability,
three MP skills with cooldowns, stamina, a healing draught, soft targeting and lock-on. Six
hostile kinds (slime, goblin, archer, shaman, bat, boar) plus a training dummy and a three-phase
boss use telegraphed attacks (wind-up flash, terrain-draped ground markers), attack tokens and
leashes. Hits have hit-stop, knockback, stagger, crits, damage numbers, sparks and shake. Enemies
drop coins, hearts, mana motes and draughts; the player gains XP and levels; death returns the
player to the last attuned Waystone. The new demo level **Cinderwatch Pass** (`cinderwatch-pass`,
96 × 120) showcases all of it. Every shipped level — Starfall Vale included — stays peaceful and
byte-identical; Starfall's coverage check skips the combat-only types, which Cinderwatch covers.

| # | Decision | Chosen | Rejected (why) |
| --- | --- | --- | --- |
| D1 | Per-level enabling | `levelHasCombat(level)`: `environment.combat === true`, or the key is not `false` and the level has an `enemy` object. Peaceful levels create **nothing** combat-related (`game.combat === null`). | Always-on combat (changes every level's programs, sheets, bindings). |
| D2 | Layering | Generic rendering / input / audio / UI pieces in `src/engine/` (opt-in, additive), game rules in `src/game/combat/`. | Everything in `src/game` (no sandbox-testable parts, ARCHITECTURE §6). |
| D3 | Clock | Variable `dt`, **sub-stepped** into `n = ceil(dt·60 − EPS)` equal steps `h = dt/n` (≤ 1/60 s). All windows are specified in frames and stored in seconds. Bit-exact when driven by `engine.step(1/60)`. | A fixed 60 Hz accumulator (visible judder on 120/144 Hz displays because `Player.position === sprite.position` cannot be render-interpolated). |
| D4 | Hit-stop / slow motion | **Combat-local**: a global combat freeze timer plus per-side time scales. `engine.time.timeScale` is never touched. | `timeScale` (freezes shake decay, `uTime`, particles, clock, typewriter — measured). |
| D5 | Enemy collision | Enemies have **no TileMap colliders**; they move with `tileMap.move` against the static world and combat separates actors itself. | Dynamic colliders (block the dodge roll, every query tests them, count changes re-sign the water shore). |
| D6 | Combat poses | Frames driven by the combat state machine with `sprite.setFrame(col, row)` (frame = hitbox frame). Locomotion keeps `play('idle')` / `play('walk')` / `play('run')`. | fps-driven `play()` (hitbox/frame desync, approximate hit-stop). |
| D7 | Hit flash & selective glow | One opt-in Sprite3D program variant `luminati-sprite3d-lit-fx-v1` with per-sprite `uFlash` and `uGlow` uniforms, used only on combat levels. | Per-enemy materials / emissive writes (rewritten by `LightingSystem` every frame). |
| D8 | VFX | One instanced atlas-quad batch (`FxQuads`) + one instanced, terrain-draped ground-marker batch (`GroundMarkers`) + 6 new override-free burst presets that add **one** burst pool (§11.3). **No new point lights.** | A Sprite3D per effect (1–4 draws each); runtime lights (count frozen after the first frame); flat markers (float / sink on steps). |
| D9 | World-anchored UI | DOM pools under `#luminati-ui` (0 draw calls, crisp, not DOF-blurred). Not depth-occluded — accepted. | WebGL bars (draw calls, blurred, tone-mapped). |
| D10 | Space / pad A | Stay **confirm only** (talk / read / rest / open). Dodge has its own keys. | Context-sensitive Space dodge (rolls when trying to talk; fights `DialogBox` over the key). |
| D11 | Stamina | Dodge costs 25 SP (needs ≥ 12). Attacks cost a little SP but are never refused: at 0 SP the player is *winded* (slower recovery). Sprinting stays free. | Attacks refused at 0 SP (least fun failure). |
| D12 | Catalog | Three new types, all flagged `combat: true`, category `Combat`: `enemy` (actor spawn group), `chest` (prop), `waystone` (prop, checkpoint). No gate type — the boss object carries relative `arena` and `gate` fields. | A gate / trigger type (one more type to cover everywhere for one use). |
| D13 | Starfall coupling | Starfall's `coverage()` line "every OBJECT_TYPES type" checks only the types **without** `combat: true`; `starfall-vale.json` stays **byte-identical** and Starfall stays peaceful. Cinderwatch's `coverage()` requires every `combat: true` type, every `ENEMY_KINDS` kind and every `CHEST_UPGRADES` value (§15.6). | A camp appended to Starfall (revision 1): auto-enable would turn the festival village into a combat level for 5 enemies — sword sheet, combat HUD, pad X/Y no longer zoom, RS no longer photographs — and Bramble Hollow (a stargazing picnic corner ~35–45 u from the spawn) does not fit hostile goblins. A later opt-in is sketched in §16.2. |
| D14 | Demo level | `cinderwatch-pass`, 96 × 120 (> 64 → big-level batching path), generated by `tools/make-cinderwatch-pass.mjs` with its own `validate()` / `coverage()`, 12 static light descriptors, clock stopped at golden hour, reachable from `?level=` and a new title-screen destination row. | Hand-built level (no validation, no byte-stable reproduction). |

---

## 2. Must not change

Every package is responsible for keeping these true for the files it owns; the lead verifies them
at integration (§23).

1. **Shipped files.** `public/levels/emberfall.json`, `sample-hamlet.json`,
   `brightwater-crossing.json` and `starfall-vale.json` stay byte-identical.
   `node tools/make-sample-hamlet.mjs --check` passes; `node tools/make-starfall-vale.mjs
   --out=<scratch>.json` writes a file identical to the committed one (`cmp`). Opening any shipped
   level in the editor and saving it unchanged still leaves `git diff` empty.
2. **Format defaults.** `DEFAULT_ENVIRONMENT`, `DEFAULT_WATER`, `TILE_TYPES`, the default legend
   and the `defaults` of every existing `OBJECT_TYPES` entry are unchanged. `environment.combat`
   is optional and never written by default.
3. **Peaceful-level fingerprints** (TASK_PLAYBOOKS §16, autostart, photo mode, frozen clock):
   Emberfall 229–231 scene draw calls / 12 lights / **57 programs**, Willowmere (sample-hamlet)
   ≈ 165 / 6 / **54**, Brightwater ≈ 210 / 10 / **57**, Starfall Vale (spawn) ≈ 176 / 12 /
   **59**; screenshots pixel-identical. On these
   levels no combat module, sheet, material, pool, burst, DOM node, binding or legend row is
   created, and the player sheet is the 6-column `character:traveler` sheet.
4. **Existing bindings keep their meaning everywhere**: WASD / arrows move, Shift run,
   Space / Enter / F confirm (talk / knock / read), Esc / Backspace cancel, Q / E camera,
   Z / X / = / − and the wheel zoom, T time, R weather, P photo, H help, M music, N / Tab map,
   `` ` `` / F1 debug; pad A confirm, B cancel, LB / RB camera, RT run, d-pad move, Start help,
   Back map. The only binding changes are on **combat levels only** and are listed in §5.2.
   On peaceful levels J, K, L, U, I, O, C, digits and mouse clicks do nothing and are not
   `preventDefault`ed.
5. **Engine APIs.** No existing export, option, method, event or program key is renamed or given
   a new meaning. New options default to the old behaviour. `luminati-sprite3d-lit-v1`,
   `-unlit-v1`, `-depth-v1` shader sources are untouched.
6. **Determinism.** No `Math.random()` in any new code (including visual jitter). The existing
   song's scheduled note list and the Particles burst RNG sequence on peaceful levels are
   unchanged. `randomizeSpec` pick lists, `EYE_COLORS`, `RANDOM_CLOTH`, `RANDOM_HAIR` and the RNG
   call order in `resolveSpec` / `buildRamps` are untouched (seeded villagers stay identical).
   Every existing sprite sheet (all `CHARACTER_PRESETS`, randomised villagers, every
   `createCreatureSheet` kind, prop sprites) stays **pixel-identical** — checked by canvas hashes
   against a baseline recorded before the first edit (§10, `sandbox/sprite_art.hashes.json`).
   `SFX_NAMES` is unchanged (combat sounds are listed in a separate `COMBAT_SFX_NAMES`, §12.1).
7. **`window.__game` / `state()`** stay backward compatible: new members only; `state()` gains a
   `combat` key **only on combat levels** (absent otherwise).
8. **Engine invariants ([ARCHITECTURE.md](../../ARCHITECTURE.md))**: ≤ 12 point lights fixed after the first frame, no runtime
   lights; shader warm-up against `postfx.sceneTarget`; tone mapping only in PostFX's OutputPass;
   Weather keeps rewriting grade temperature / saturation (combat applies offsets after it).

---

## 3. Enabling combat per level

```js
// src/engine/level/ObjectCatalog.js (node-safe)
export function isCombatType(type)      // → !!OBJECT_TYPES[type]?.combat
export function levelHasCombat(level)   // → env.combat === true
                                        //   || (env.combat !== false && level.objects.some(o => o.type === 'enemy'))
```

- `environment.combat`: optional boolean. Absent = **auto** (on iff the level has an `enemy`
  object). `false` forces peaceful (enemies, chests and waystones then behave as props / nothing:
  enemies are not spawned, chests and waystones show their examine text under the prompt label
  **Examine**). `true` forces combat on a level without enemies (chests, waystones and the player
  kit still work).
- `Game` evaluates it once in the constructor: `this.combatEnabled = levelHasCombat(level)`.
- Chests and waystones on a peaceful level are ordinary props with examine text (§9.8, §14.3).
- **What the combat inputs do on a peaceful level:** nothing. The combat bindings are never
  registered, so J, K, L, U, I, O, C, 1–4 and mouse buttons are unbound (not `preventDefault`ed)
  and pad X / Y keep zooming, RS keeps taking photos.
- Older builds that do not know the new types drop them with a `normalizeLevel` warning — accepted
  and documented.

---

## 4. Architecture

### 4.1 Files

| Layer | File (new unless marked *edit*) | Role | Package |
| --- | --- | --- | --- |
| level | `src/engine/level/ObjectCatalog.js` *edit* | enums, `ENEMY_INFO`, 3 types, `enemyStartPoints`, `isCombatType`, `levelHasCombat` (§14) | foundation |
| engine | `src/engine/index.js` *edit* | exports of the new engine modules | foundation |
| pixel | `src/engine/pixel/CharacterSprites.js` *edit* | opt-in combat poses, `ears`, `_painterKit` export (§10.2) | sprites |
| pixel | `src/engine/pixel/MonsterSprites.js` | `createEnemySheet(kind)` (§10.3) | sprites |
| pixel | `src/engine/pixel/FxSprites.js` | `createFxAtlas()` (§10.4) | sprites |
| sprite | `src/engine/sprite/Sprite3D.js` *edit* | option `combatFx`, `setFlash`, `setGlow` (§10.1) | sprites |
| fx | `src/engine/fx/FxQuads.js` | instanced atlas quads (§11.1) | fx-audio-input |
| fx | `src/engine/fx/GroundMarkers.js` | instanced telegraph decals (§11.2) | fx-audio-input |
| fx | `src/engine/fx/Particles.js` *edit* | new presets (§11.3) | fx-audio-input |
| audio | `src/engine/audio/AudioSystem.js` *edit* | combat SFX, music tracks, stingers (§12) | fx-audio-input |
| core | `src/engine/core/Input.js` *edit* | `addBindings`, mouse-button edges, `lastDevice` (§5.3) | fx-audio-input |
| core | `src/engine/core/CameraRig.js` *edit* | `stickZoom` (§5.3) | fx-audio-input |
| ui | `src/engine/ui/{CombatHUD,BossBar,WorldLabels,Announcer,DeathScreen}.js` | combat UI components (§13) | ui |
| ui | `src/engine/ui/{UI,HUD,Minimap,TitleScreen}.js`, `ui.css` *edit* | `enableCombat`, key labels, enemy dots, destinations (§13) | ui |
| world | `src/engine/world/props/CombatProps.js`, `Props.js` *edit* | chest and waystone props (§14.3) | level |
| level | `src/engine/level/ObjectBuilder.js`, `LevelMap.js` *edit* | build cases, map marks | level |
| game | `src/game/World.js` *edit* | chest / waystone interactables (§9.8) | level |
| game | `src/game/combat/CombatSystem.js` … (§9.1, full list in §22) | orchestration, player kit, hits, loot, feel, music, hooks | combat-core |
| game | `src/game/combat/{Enemy,defs}.js`, `src/game/combat/ai/*.js` | enemy actor, stats, 8 brains (§7–§9) | enemies |
| game | `src/game/{Game,Player,dialogue,levels}.js`, `src/main.js` *edit* | integration (§4.2–§4.5) | combat-core |
| game | `src/game/AudioDirector.js` *edit* | `combatIntensity` bird duck | fx-audio-input |
| tools | `tools/lib/levelgen.mjs`, `tools/make-cinderwatch-pass.mjs`, `tools/make-starfall-vale.mjs` *edit* (coverage line only) | generators (§15, §16) | level |
| sandbox | `sandbox/combat_fixture.js` | small flat test level (built in-page, played through `__luminati.playLocal`) so combat-core can verify before Cinderwatch lands (§21) | combat-core |
| game | `src/game/combat/Nav.js` *(rev. 5, §27.13 R1)* | the enemies' walk grid and bounded path search | known-issues pass |
| ui | `src/engine/ui/combat.css` *(rev. 5, §27.14 X8)* | the combat UI's rules, split out of `ui.css` (loaded only with the combat chunk) | known-issues pass |
| editor | `src/editor/viewport3d/SpriteBatch.js` *(rev. 5, §27.16 D7)* | the instanced batch of the editor's enemy previews | known-issues pass |
| sandbox | `sandbox/combat_audio.{html,js,actions.json}`, `sandbox/combat.play.{fast,human,realtime}.json` *(rev. 5, §27.17 M3, §27.18 T3)* | the combat audio QA page; the play-through bot's variants | known-issues pass |
| editor | `src/editor/…` *edit* | enemy preview, 2D glyphs, inspector stats, settings (§17) | editor |

### 4.2 Frame order (Game.update, `src/game/Game.js`)

Existing order is kept; new lines are marked. Line numbers refer to the file before the change.

```js
// 1. shortcuts (828-847) — unchanged, plus: togglePhotoMode refused while combat?.engaged (§6.12);
//    on combat levels the pad photo toggle is `photoPad` (LS) and ignored while the move stick is deflected (§5.2)
const active = playing && !talking && !this.mapOpen && !this.photoMode;          // NEW
player.frozen = !playing || talking || this.mapOpen
  || (!!this.combat && (this.photoMode || this.combat.locksPlayer));              // CHANGED (850, additive:
                                                                                   // identical on peaceful levels)
this.combat?.update(dt, active);        // NEW: input → player action, enemies, projectiles, hits (sub-stepped)
player.update(dt, input);               // (851) locomotion only while player.action === null
this.combat?.afterPlayer(dt, active);   // NEW: separation, arena clamp, pickups, waystone attune,
                                        //      lock-on focus, engaged state, HUD values, minimap list
// 2. interaction prompt / confirm (855-865) — unchanged; _findInteractable skips `it.disabled`
// 3. NPCs, critters (868-887) — unchanged
// 4. camera: rig.update (893) → spriteManager.update (894) → blobs.update (895)
//    (shake requests and the lock-on focus vector were issued above)
this.weather.update(dt);                // (902)
this.combat?.applyLook(dt);             // NEW: grade / DOF offsets from a stored baseline (§11.4)
// warm frames (903-908): when _warmFrames reaches 0 → this.combat?.endWarmup() before _resolveWarm()
// 5. world, godRays, waterfall fx, particles.update (913), resolution, HUD, maps, audioDirector — unchanged
```

`engine.events 'lateUpdate'` → `ui.update(dt, {camera, input})` — `UI.update` additionally calls
`this.combat?.labels.update(dt, camera)` after `prompt.update` (§13). Combat writes no DOM from its
own update except through the component APIs.

On the title screen `playing` is false, so combat is inactive: enemies stand in idle animation,
nothing attacks.

### 4.3 Combat clock, hit-stop and time scales

- `CombatSystem.update(dt, active)`: if `!active` nothing advances (timers, AI, projectiles,
  markers, cooldowns, regen all freeze; UI keeps animating). Otherwise
  `n = max(1, ceil(dt·60 − EPS))`, `h = dt / n`, and `n` sub-steps run (≤ 3 per frame because
  `Engine` clamps `dt` to 1/20 s).
- **Hit-stop** is one combat-wide timer `stop` (seconds). While `stop > 0` a sub-step advances
  `stop` by `h` and nothing else (player action, enemies, projectiles, markers, pickups, cooldowns
  all hold). A new hit-stop sets `stop = max(stop, new)`. During hit-stop the victim's
  `mesh.position.x` jitters ±1/16 u on alternate frames (Sprite3D never writes `mesh.position`).
  Camera shake, particles, water, the clock and the UI keep running (by design).
- **Time scales** (combat-local, multiply `h`): `playerScale` and `enemyScale` (enemies,
  projectiles, enemy markers). Defaults 1.

  | Effect | playerScale | enemyScale | Duration (combat real time) |
  | --- | --- | --- | --- |
  | Perfect dodge | 1 | 0.35 | 0.6 s |
  | Player death | 0.3 | 0.3 | 1.0 s |
  | Boss death | 0.4 | 0.4 | 1.5 s |

- Player **locomotion** is not sub-stepped: `Player.update` moves with the frame `dt` exactly as
  today while `player.action === null`.
- Durations of effect timers (slow motion, flash decay, look pulses) are counted in real combat
  seconds (sum of `h` before scaling); gameplay windows are counted in scaled time.
- **Sprite animation clock.** `SpriteManager.update(dt)` advances `play()` animations with the
  engine `dt`, so combat writes `sprite.speed` of every enemy, boss and add sprite once per frame
  in `afterPlayer` (after the enemies' updates, before `spriteManager.update`):
  `speed = !playing ? 1 : (!active || stop > 0 ? 0 : enemyScale)`. Enemies therefore freeze their
  walk cycles during hit-stop, map / dialog / photo / death-screen pauses and slow down in slow
  motion, while the title screen keeps idling. (`play()` resets `speed` to 1 when it starts a new
  animation; the per-frame write comes after it.) The player sprite is unaffected: its actions
  use `setFrame`, and locomotion runs on the frame `dt` as today.

### 4.4 Gating and input guards

- `active = playing && !talking && !mapOpen && !photoMode` (`talking` = `busy || dialog.isOpen`).
  The world map therefore **pauses** combat (allowed while engaged). Photo mode is **refused**
  while `engaged` (toast "Not while foes are near") and pauses combat otherwise.
- **Photo mode freezes the player on combat levels** (the freeze line in §4.2). Otherwise the
  player could open photo mode, walk through frozen packs and the boss-intro trigger, and close it
  behind them. On peaceful levels the player keeps walking in photo mode exactly as today.
- **Resume guard (symmetric, no dead time):** when `active` turns from false to true, combat
  (a) drops every combat action edge that arrives in the resume frame, and (b) ignores an action
  whose binding was **held** at the resume frame until that binding is released (the B press that
  closed the map must not also dodge; a held J does not auto-attack). Both sides resume at once —
  no enemy advantage.
- **Respawn guard:** after a respawn, combat ignores player action edges for **0.25 s** (the key
  that dismissed the death screen must not attack); the player has 2.0 s of i-frames anyway.
- Virtual `press()` edges from the test hooks obey both guards like real input; `reset()` clears
  them (§20.1).
- `locksPlayer` is true while the player is dead / respawning and during the boss intro (1.8 s).

### 4.5 Construction and disposal (`Game.init`)

```js
// constructor
this.combatEnabled = levelHasCombat(level);
this.combat = null;
// init — Player (≈295)
this.player = new Player({ tileMap, rig, particles, audio, spawn, combat: this.combatEnabled });
// init — after `new Critters(...)` (316-319), BEFORE the sprite loop (329-337)
if (this.combatEnabled) {
  onProgress?.('Sharpening blades');
  this.combat = new CombatSystem({ game: this });
  await this.combat.load();            // sheets, enemies (added to scene + spriteManager), FxQuads,
                                       // GroundMarkers, pools, ui.enableCombat(), bindings, rig.stickZoom
}
// sprite loop (329-337): same body, two changes
this.blobs = (this.world.batching || this.combat) ? new BlobBatch() : null;
//   iterate also this.combat?.actorSprites; the makeShadowOnly condition becomes (world.batching || combat)
// after ui.hud.setControls(CONTROLS) (347)
this.combat?.setupUI();               // setControls(COMBAT_CONTROLS or COMBAT_PAD_CONTROLS), vitals, skill slots
// _setupMaps() (359 → 422-441), which creates this._map, gains at its end:
if (this.combat) this.combat.attachMaps(this._map);
//   sets map.enemies = combat.minimapEnemies; removes the `chest` interactable markers (a chest's
//   marker is pushed into map.markers when discovered, §13.3); pushes { x, z, kind: 'boss' } at the
//   arena centre of each undefeated golem group (spliced out on defeat). Peaceful: untouched.
// warm-up, next to the burst priming (387-395), BEFORE `await this._compileScene()` (397)
this.combat?.warmup(far);             // far = new THREE.Vector3(0, -1000, 0)
// dispose (1106): this.combat?.dispose() BEFORE player, world, spriteManager and particles disposal
```

`Game.init` imports `CombatSystem.js` **dynamically** (`await import('./combat/CombatSystem.js')`,
its own chunk), so a peaceful level never fetches the combat rules; `combat/bindings.js` stays a
static import *(rev. 4, §27.9 G14)*. `CombatSystem` imports the engine's combat modules (FX
batches, sheet painters, combat UI) from their own files, never through the barrel, and
`load()` registers the combat UI with `UI.useCombatUI(…)` before `ui.enableCombat()`; it also
builds the walk grid (`Nav`, then `nav.warm()`) and the zones *(rev. 5, §27.13 R1 / R5 / R10,
§27.14 X8)*.

Everything combat needs is created in `load()`; **nothing is created or disposed mid-game**
(pools, hidden objects, parked handles). Sprites are hidden with `opacity = 0`, never disposed
while the game runs (BlobBatch shares the blob texture refcount).

---

## 5. Controls

### 5.1 Combat actions (combat levels only)

| Action name | Keyboard | Mouse (on the canvas) | Gamepad |
| --- | --- | --- | --- |
| `attack` (combo) | J | LMB (`Mouse0`) | X |
| `dodge` | K | RMB (`Mouse2`) | B |
| `skill1` / `skill2` / `skill3` | U / I / O and 1 / 2 / 3 | — | hold LT (`skillMod`) + X / Y / B |
| `draught` | C and 4 | — | Y |
| `lock` (tap: lock / next, hold 0.35 s: release) | L | MMB (`Mouse1`) | RS click |
| confirm (talk / read / rest / open) | Space / Enter / F (unchanged) | — | A (unchanged) |
| run | Shift (unchanged) | — | RT (unchanged) |
| photo | P (unchanged) | — | LS click (`photoPad`; ignored while the move vector is > 0.35 and for 0.3 s after) |
| zoom | Z / X / wheel (unchanged) | wheel | right stick Y |

- While `skillMod` (LT) is held, pad X / Y / B produce `skill1` / `skill2` / `skill3` and **not**
  `attack` / `draught` / `dodge`. Keyboard and mouse are unaffected by LT.
- Action priority when several edges arrive in one sub-step: `dodge` > `skill*` > `attack` >
  `draught`. `lock` is independent.
- Input buffer: a pressed action is remembered for **10 f** and fires as soon as the current
  action's cancel window for it opens (§6.4).

### 5.2 Rebinding on combat levels (and only there)

| Binding | Peaceful levels (unchanged) | Combat levels | Why |
| --- | --- | --- | --- |
| pad X / Y | zoomOut / zoomIn | attack / draught | Face buttons are the only fast inputs (genre convention). |
| pad zoom | X / Y | **right stick Y** (`rig.stickZoom = 14`) | The right stick's Y axis is unused today. |
| pad RS click | photo | **lock** | Souls-style lock-on convention. |
| pad LS click | — | **photo** (`photoPad`), ignored while the left stick / move vector is deflected > 0.35 and for 0.3 s after | Keeps photo mode on the pad without firing when a runner clicks the stick by accident. |
| pad B | cancel | cancel **and** dodge | `cancel` is only consumed while the map, photo mode or a dialog is up, where combat is inactive; the resume guard (§4.4) covers the closing frame. |

Keyboard bindings are only **added** (J K L U I O C 1–4 were unbound); nothing is moved.
Combat registers them at runtime with `input.addBindings(COMBAT_BINDINGS, COMBAT_PAD_BINDINGS)`:

```js
// src/game/combat/bindings.js
export const COMBAT_BINDINGS = {
  attack: ['KeyJ', 'Mouse0'], dodge: ['KeyK', 'Mouse2'],
  skill1: ['KeyU', 'Digit1'], skill2: ['KeyI', 'Digit2'], skill3: ['KeyO', 'Digit3'],
  draught: ['KeyC', 'Digit4'], lock: ['KeyL', 'Mouse1'],
};
export const COMBAT_PAD_BINDINGS = {
  attack: ['GamepadX'], dodge: ['GamepadB'], draught: ['GamepadY'], lock: ['GamepadRS'],
  skillMod: ['GamepadLT'], zoomIn: [], zoomOut: [], photo: [], photoPad: ['GamepadLS'],
};
//   Game's photo shortcut (combat-core owns Game.js) becomes, on combat levels only:
//   input.actionPressed('photo') || (input.actionPressed('photoPad') && |input.getMoveVector()| <= 0.35
//                                    && no deflection > 0.35 in the last 0.3 s)
export const COMBAT_CONTROLS = [            // HUD legend (ui.hud.setControls), 12 rows
  { keys: 'WASD', label: 'Move' },
  { keys: 'Shift', label: 'Run' },
  { keys: 'J/Mouse0', label: 'Attack (combo)' },
  { keys: 'K/Mouse2', label: 'Dodge roll' },
  { keys: 'U/I/O', label: 'Skills (or 1-3)' },
  { keys: 'C', label: 'Healing Draught' },
  { keys: 'L/Mouse1', label: 'Lock on / next' },
  { keys: 'Space', label: 'Talk / Rest / Open' },
  { keys: 'Q/E', label: 'Rotate camera' },
  { keys: 'Z/X', label: 'Zoom (or wheel)' },
  { keys: 'N/Tab', label: 'World map' },
  { keys: 'T/R/P/M', label: 'Time / Weather / Photo / Music' },
];
export const COMBAT_PAD_CONTROLS = [        // legend while input.lastDevice === 'gamepad', 12 rows
  { keys: 'LS', label: 'Move' },
  { keys: 'RT', label: 'Run' },
  { keys: 'X', label: 'Attack (combo)' },
  { keys: 'B', label: 'Dodge roll' },
  { keys: 'LT+X/Y/B', label: 'Skills' },
  { keys: 'Y', label: 'Healing Draught' },
  { keys: 'RS', label: 'Lock on / next' },
  { keys: 'A', label: 'Talk / Rest / Open' },
  { keys: 'LB/RB', label: 'Rotate camera' },
  { keys: 'R-Stick', label: 'Zoom' },
  { keys: 'Back', label: 'World map' },
  { keys: 'LS-Click', label: 'Photo' },
];
export const PAD_HINT = 'Pad: X attack · B roll · LT+X/Y/B skills · Y draught · RS lock · right stick zoom · LS click photo';
```

`HUD` `KEY_LABELS` gains `Mouse0 → 'LMB'`, `Mouse1 → 'MMB'`, `Mouse2 → 'RMB'`.

**Device-aware legend (combat levels only).** Combat watches `input.lastDevice` in `afterPlayer`;
when it changes between `'gamepad'` and keyboard / mouse it calls
`ui.hud.setControls(COMBAT_PAD_CONTROLS | COMBAT_CONTROLS)` and
`ui.combat.hud.setDevice('gamepad' | 'keyboard')` (skill-slot keycaps swap, §13.2). On the first
gamepad edge of the session on a combat level it shows `ui.hud.toast(PAD_HINT, 6)` once. Peaceful
levels keep today's single legend. *(revision 11, §27.23 P2: the toast shows `t('combat.padHint')`,
the page's language; `PAD_HINT` stays exported as its English source. The legend rows carry an `id`
and translated labels.)*

### 5.3 Engine input / camera additions (`fx-audio-input` package)

```js
// src/engine/core/Input.js — all additive, defaults reproduce today's behaviour
input.addBindings(keyboard = {}, pad = {})
//   For every action key: bindings[action] = [...codes] / padBindings[action] = [...codes]
//   (replaces that action's array; other actions untouched; new action names such as `skillMod`
//   and `photoPad` are allowed). Invalidates the `_isBound` / preventDefault cache so the new keys
//   are preventDefault'ed (unless Ctrl/Alt/Meta).
input.enableMouseButtons(target)
//   target: the renderer canvas. pointerdown whose e.target === target adds 'Mouse' + e.button
//   to _down and _pressed; pointerup anywhere (and blur / visibility reset) removes it from
//   _down and adds it to _released. contextmenu on target is preventDefault'ed.
//   Clicks on UI panels (dialog, choices, title, lil-gui, death screen) never reach the codes
//   because their target is not the canvas. Not called on peaceful levels.
input.lastDevice  // 'keyboard' | 'mouse' | 'gamepad' — updated on every pressed edge (default 'keyboard')

// src/engine/core/CameraRig.js
rig.stickZoom = 0 // u of zoom per second at full right-stick Y deflection; 0 = off (default).
                  // When non-zero, update() applies zoom from input.getLookVector().y (stick up = zoom in),
                  // with the same deadzone as the X axis.
```

Mouse aim: when an attack, skill or dodge was triggered by a `Mouse*` code, the aim point is the
intersection of the camera ray through `input.pointer` with the plane `y = player.y + 0.8`
(computed by combat with the engine camera).

---

## 6. Player rules

All numbers live in `src/game/combat/rules.js` (combat-core). Constants named here are exported
under these names.

### 6.1 Stats and progression

| Stat | Formula (level `L`, cap 10) | Lv 1 | Lv 5 |
| --- | --- | --- | --- |
| HP max | `100 + 12(L−1) + upgrades` | 100 | 148 |
| MP max | `40 + 5(L−1) + upgrades` | 40 | 60 |
| SP max | 100 | 100 | 100 |
| ATK | `12 + 3(L−1) + upgrades` | 12 | 24 |
| DEF | `4 + (L−1) + upgrades` *(rev. 5, §27.19 W2)* | 4 | 8 |

XP to the next level: `xpToNext(L) = round(30 · L^1.6)`.

| L → L+1 | 1→2 | 2→3 | 3→4 | 4→5 | 5→6 | 6→7 | 7→8 | 8→9 | 9→10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| XP needed | 30 | 91 | 174 | 276 | 394 | 527 | 675 | 836 | 1009 |
| cumulative | 30 | 121 | 295 | 571 | 965 | 1492 | 2167 | 3003 | 4012 |

Upgrades (chests, boss): `maxHp` +20, `maxMp` +10, `attack` +3, Cinderheart Core +20 max HP.
*(rev. 5, §27.19 W2 / W3: `upgrades` also holds `def`; the shop's one-time wares add ATK +2, max HP
+15 and DEF +3.)*
Skills unlock at Lv 1 (Whirl Slash), Lv 2 (Ember Bolt), Lv 4 (Radiant Nova).

### 6.2 Resources

| Resource | Regeneration | Gains | Costs |
| --- | --- | --- | --- |
| SP | 45/s after 0.5 s without spending; after reaching 0 the delay is 1.2 s | perfect dodge +15 | A1 5, A2 5, A3 8, roll 25 (needs SP ≥ 12), backstep 15 (needs ≥ 12) |
| MP | 0.8/s | +2 per melee hit landed (max +4 per swing, dummies count), mana mote +8, perfect dodge +5 | skills (§6.6) |
| HP | none | heart +12 % max, draught 40 % max, level-up / rest full | — |

**Winded:** when SP hits 0 the player is winded until SP ≥ 30: attack recovery frames (after the
active frames) last ×1.35 and the SP bar flashes. Attacks are never refused for SP.

### 6.3 Damage

```
roll   = 0.92 + 0.16 · rng()                       // combat RNG, draw #1
mit    = 40 / (40 + 2 · DEF_target)
crit   = rng() < critChance                        // draw #2 (player hits only; always drawn)
critChance = 0.08 + 0.12·rear + 0.30·exposed + 0.10·finisher
             rear:     1 if dot(hitDir, target.facing) > 0.3 (hit from behind), else 0
             exposed:  1 if the target is staggered, stunned or Broken (boss), else 0
             finisher: 1 for A3
damage = max(1, round(ATK · mv · roll · mit · (crit ? 1.75 : 1) · vuln))
vuln   = 1.5 while stunned (boar, boss after a wall charge); 1.3 while Broken (boss); else 1
```

- The boss "exposed core" kneel (§8.3) forces `crit = true` (draw #2 still consumed).
- Enemy → player uses the same formula without crit (`crit` not drawn): `damage = max(1,
  round(ATK_e · mv · roll · 40/(40 + 2·DEF_p)))`. `god(true)` makes it 0.
- **Flat damage** (`HitSpec.flat`, the magma pool): `damage = flat` — no RNG draw, no DEF, no
  crit, no knockback, no hitstun, no hit-stop, grants no i-frames; respects existing i-frames and
  `god`; shows a red `hurt` number and the player-hurt flash only.
- **RNG discipline:** one combat RNG (`new RNG(seed)`, `seed` default `hashString(level.name)`,
  reseeded by the `seed(n)` hook) is used only for damage, in resolution order (§9.1); AI uses
  per-enemy RNGs; loot uses per-death RNGs (§7.8).

### 6.4 Melee combo

Chain A1 → A2 → A3 → A1. A buffered `attack` fires at the "next attack from" frame; if no attack
arrives by the action's last frame the combo resets to A1.

| Step | Total | Poses (column names, §10.2) | Active | Next attack from | Dodge from | Lunge | Hit | SP | Poise dmg | Extras |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A1 slash | 22 f | wind f0–4, slash f5–9, follow f10–21 | f5–7 | f14 | f8 | 0.4 u over f3–7 | sector r 1.6, ±60°, mv 1.0, kb 0.5 | 5 | 10 | FX `slash`, SFX `swing` at f5 |
| A2 backhand | 24 f | follow f0–4, backhand f5–9, wind f10–23 | f5–7 | f15 | f8 | 0.4 u | sector r 1.6, ±60°, mv 1.1, kb 0.6 | 5 | 12 | FX `slash` mirrored |
| A3 thrust | 39 f | wind f0–9, thrust f10–16, follow f17–38 | f10–14 | f32 (→ A1) | f15 | 0.8 u over f8–12 | lane len 2.2 × width 1.0 **or** sector r 2.0 ±35° (union), mv 1.8, kb 2.0 | 8 | 30 | finisher: crit +0.10, shake 0.08/0.15, FX `thrust` + `slashBig`, SFX `swingHeavy` |

- **Magnet:** at f0 (re-evaluated at f1 and f2) the soft target (§6.9) is chosen; if it is within
  3.0 u the facing snaps toward it (max 60° change) and the lunge becomes
  `clamp(dist − (target.radius + 0.6), 0, lunge + 0.5)`.
- Facing can be corrected by move input during f0–2.
- One hit per enemy per swing (per-swing tag registry). **Height rule for melee** (both sides):
  the attacker's ground and the target's ground differ by ≤ 0.6 u (`HitSpec.dy`, one height step
  plus slack; fliers are tested at the ground point below them). A target on a ledge two levels
  up (1.0 u) cannot be hit across the cliff — use the stairs or Ember Bolt.
- Lunge and every other player displacement go through `player.moveBy(dx, dz)` (`tm.move`,
  radius 0.3, max step 0.55).

### 6.5 Dodge roll, backstep, perfect dodge

| Move | Total | Poses | I-frames | Motion | Cancels |
| --- | --- | --- | --- | --- | --- |
| Roll (move input held) | 22 f | tuck f0–2, roll f3–12, tuck f13–17, wind f18–21 | f1–13 | 3.2 u along the input direction, ease-out over f0–15 | attack from f16 → A1 with +0.3 u lunge ("roll slash"); dodge from f18 |
| Backstep (no input) | 16 f | tuck f0–15 | f1–8 | 1.8 u opposite the facing | attack from f10; dodge from f12 |

- Mouse-triggered dodge without move input rolls toward the cursor aim point.
- During a roll the player–enemy separation is skipped (roll through enemies); terrain and props
  still block.
- **Perfect dodge:** an enemy hitbox or enemy projectile overlaps the player during f1–8 of a roll
  or backstep → once per 3.0 s: enemy time scale 0.35 for 0.6 s, SP +15, MP +5, label
  `Perfect!`, SFX `perfect`, look pulse (§11.4). The hit is ignored (i-frames).
- Dust: `footstep` burst (count 6) at f0.

### 6.6 Skills

| Skill | Slot / keys | Unlock | MP | Cooldown | Total | Timeline | Hit | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Whirl Slash | skill1 — U / 1 / LT+X | Lv 1 | 10 | 4.0 s | 32 f | pose `spin` f0–31; hits f6–8 and f14–16 (two tags) | circle r 2.2 around the player, mv 1.2 each, kb 1.4 radial, poise 15 each | super armour f0–24 (damage taken, no hitstun); dodge from f24; FX `spin`, SFX `whirl` |
| Ember Bolt | skill2 — I / 2 / LT+Y | Lv 2 | 8 | 1.5 s | 20 f | pose `cast` f0–19; projectile at f8 released at player ground + 0.9, aimed (with `vy`, §7.6) at the target's body middle, else level | projectile `emberBolt`: 14 u/s, range 12, radius 0.35, mv 2.0, kb 0.8, poise 20; splash r 1.0 at mv 0.6 (not on the primary target) | auto-aim cone ±45° up to 12 u; dodge from f12, attack from f14; SFX `bolt` / `boltHit` |
| Radiant Nova | skill3 — O / 3 / LT+B | Lv 4 | 18 | 12.0 s | 40 f | pose `cast` f0–19, `spin` f20–27, `follow` f28–39; player gold marker ring grows r 0 → 3.2 over f0–20 | at f20: circle r 3.2, mv 2.6, kb 2.2 radial, poise 60, knockdown (non-boss) | i-frames f4–20; dodge from f30; `magicBurst` 24, shake 0.2/0.3, SFX `nova` |

A skill press is refused (slot shakes, SFX `cancel`) when locked, on cooldown or MP too low.

### 6.7 Healing Draught

`draught` (C / 4 / pad Y): 30 f, pose `aim` (raising the flask), no movement; heals 40 % max HP
at f18 (green number, `healGlow` 12, SFX `drink`). The draught is consumed at f18 — a hit before
f18 interrupts it without consuming. 1.0 s cooldown after it ends. Carry max 5, start with 3.
Refused at full HP (toast "Already at full health").

### 6.8 Getting hit

| Reaction | Trigger | Duration | Movement | Afterwards |
| --- | --- | --- | --- | --- |
| Hitstun | any damaging hit without knockdown | 18 f, pose `hurt` | slide `kb` u over 10 f, ease-out | 48 f i-frames (mesh blinks at 15 Hz via `mesh.visible`; the shadow stays) |
| Knockdown | `hit.knockdown` or `kb ≥ 2.5` | 36 f `down` + 18 f get-up (`tuck`) | slide `kb` u over 14 f | i-frames for the whole state + 30 f; a `dodge` from f24 rolls out ("tech roll") |
| Super armour | Whirl Slash f0–24 | — | none | damage and flash only |

Player hurt: hit-stop 6 f, shake 0.15/0.25 (knockdown 0.25/0.35), flash red, vignette pulse, SFX
`hurt`, red damage number.

### 6.9 Targeting and lock-on (`Targeting.js`)

- **Aim direction** at action start, first match wins: (1) the lock target; (2) the mouse aim
  point if the action was mouse-triggered and the point is > 0.8 u away; (3) the move input if
  |move| > 0.2; (4) the facing.
- **Soft target:** alive, targetable (not returning, not dormant) enemies within 5 u (Ember Bolt:
  12 u) and within ±75° (bolt ±45°) of the aim direction; score `dist + 2.5·(1 − dot)`; lowest wins.
- **Lock-on** (`lock`): candidates are targetable enemies within 14 u **inside the view frustum**
  (NDC |x| ≤ 1 and |y| ≤ 1 at the body middle); a tap when unlocked locks the candidate
  minimising `dist + 6·|ndcX|` (when no candidate is on screen: the nearest within 14 u); a tap
  when locked moves to the next on-screen candidate in increasing screen-x order (wrapping to
  "none" after the last); holding ≥ 0.35 s releases. On the target's death the lock moves to the
  nearest on-screen target within 8 u, else releases; beyond 16 u it releases.
- While locked: the player faces the target (`player.faceOverride`), strafes with the walk
  animation, attacks aim at it; its HP bar is forced visible; a DOM reticle and a `lock`-style
  ground ring (GroundMarkers) mark it.
- **Camera:** on lock, `rig.setTarget(lockFocus)` with `lockFocus` (a Vector3 owned by combat)
  updated in `afterPlayer`: `player.position + 0.3·clampLen(target − player, 4)`, damped with
  λ = 6/s. On release `rig.setTarget(player.sprite)`. Yaw is never rotated automatically. The
  per-frame jump is < 1 u (well below `autoSnapDistance` 8). Teleport, death and map-open
  release the lock.
- **Boss framing** (overrides the lock focus while the boss fight is active, from the intro roar
  to defeat / reset): `bossFocus = player + 0.45·clampLen(boss − player, 6)`, damped λ = 4/s,
  through the same `rig.setTarget(vector)`; `rig.minDistance` is raised to `max(saved, 30)` and
  `rig.distanceTarget` to at least 30 for the fight, both restored afterwards. Player and boss
  then stay framed for every move including Rock Toss at range.

### 6.10 Level-up

Full HP / MP / SP, 60 f invulnerable, Announcer `Level N` with the gains line
(e.g. `Max HP +12 · ATK +3 · Radiant Nova learned`), FX `pillar` for 60 f, `sparkle` 24,
SFX `levelup`. Excess XP carries over; several levels in one kill announce the final level only.
*(rev. 5, §27.13 R9, §27.14 X5: the pillar is gold (1.05, 0.82, 0.32), the sparkles are 14
`levelSparkle` at y + 1.9, and a level-up granted by the boss's kill plays with the results card.)*

### 6.11 Death and respawn (the `restUntilMorning` pattern, `Game.js:686-699`)

1. HP 0 → action `dead` (pose `down`), death slow motion (§4.3), look saturation → −1 over 1 s,
   SFX `playerDown`, enemies release tokens and switch to `return`, music fades out (1.5 s).
2. 1.2 s later (real time, counted by combat): `game.busy = true`;
   `ui.combat.death.show({ title: 'You Have Fallen', subtitle: '', prompt: 'Press any key to rise at the <checkpoint name>' })`
   (armDelay 1.0 s) → await. *(revision 11: `t('combat.death.title')` and
   `t('combat.death.prompt', { place: placeName(checkpoint) })`, translated, §27.23.)*
3. `await ui.fader.fadeOut(0.8)`, `death.hide()`, `combat.resetEncounter()`:
   - alive non-boss enemies return to home at full HP (**killed enemies stay dead**);
   - an undefeated boss resets (full HP, phase 1, dormant kneel, adds hidden, arena open);
   - projectiles, markers, pickups, burst-free FX are cleared; lock released; tokens reset;
   - player: gold −10 % (floor), HP / MP / SP full, draughts ≥ 2, cooldowns 0, action null.
4. `game.teleport(checkpoint.x, checkpoint.z)` (snaps rig, light pool, DOF), 2.0 s i-frames,
   respawn guard 0.25 s (§4.4), `await ui.fader.fadeIn(1.0)`, `busy = false`, toast
   `You rise at <name>`.

The initial checkpoint is the level spawn (`{ id: 'spawn', name: 'the camp' }` — generic name
`'the start'` when the level has no waystone near the spawn).

### 6.12 Waystones, chests, shop, engagement

- **Engaged** = an aggroed non-dummy enemy within 16 u of the player, or the boss fight is active;
  it ends 3.0 s after the last such condition. Effects: battle music (§12.2), combat look (§11.4),
  vitals un-dim, photo mode refused, waystone rest refused.
- **Waystone:** walking within 2.0 u **attunes** it (checkpoint = the stand point 1.2 u south of the
  stone; toast `<name> attuned`, SFX `waystone`, crystal brightens via `prop.setAttuned(true)`;
  the previous one dims). Confirm → prompt label **Rest**: refused while engaged (toast
  "The stone is silent while foes are near"); otherwise `busy`, fadeOut 0.6, full HP / MP / SP,
  draughts ≥ 3, **all** non-boss enemy groups respawn at home (killed ones too), fadeIn 0.8,
  toast `Rested at <name>`.
- **Chest:** confirm → prompt **Open**: `prop.open()` (0.4 s lid animation), SFX `chestOpen`,
  contents pop out as pickups (gold as coins, `potions` as draught pickups, `upgrade` as one
  `upgrade` pickup). The chest's interactable becomes `disabled`. Opened state is session-only
  (not reset by death or rest; reset by reload).
- **Shop:** an NPC with `action: 'shop'` and `item: 'Healing Draught'` on a combat level sells it
  for **25 gold**: the prompt reads `Would you like the Healing Draught? (25 gold)`; "Yes" calls
  `game.combat.buy('Healing Draught')` → `{ ok, reason }` (toast `Obtained: Healing Draught` or
  `Not enough gold` / `You cannot carry more`). Other items and peaceful levels keep today's
  inventory behaviour. *(rev. 5, §27.19 W3: the gold sink — the NPC script `shopkeeper` (Bram, Odo)
  offers a menu of `SHOP_WARES` in `rules.js`: the Healing Draught (25) and the one-time Whetstone
  ATK +2 (120), Ironbark Tonic max HP +15 (90) and Warding Charm DEF +3 (150); *Nothing more* first,
  refused while engaged, bought wares kept through death and rest. `buy(item)` also returns
  `reason: 'sold'`; `priceOf` covers the wares; new `shopOffers()`, event `purchase`,
  `state().combat.shop`.)*
- **Waystone / chest prompt labels:** `World` creates both interactables with the label
  **Examine** (§9.8); combat overwrites `it.label` at load — `Rest` for waystones, `Open` for
  chests (an opened chest's item is `disabled`).
- **Drillmaster** (`script: 'drillmaster'`, `dialogue.js`): first visit explains the controls,
  printing keyboard or pad keys by `input.lastDevice`, and asks for a full 3-hit combo on a dummy
  and one dodge; `combat.tutorial = { combo, dodge }` tracks them. When both are done the next
  visit rewards 2 draughts once (toast). After the boss is defeated (`combat.bossDefeated`) the
  script plays 2 post-victory pages instead. On a peaceful level the script falls back to the
  NPC's `dialogue` pages.
- **Victory results card:** 1.5 s after the victory stinger, `ui.combat.announcer.announce(
  '<level name> — Cleared', '<m:ss> · <kills> foes · <deaths> falls · <perfectDodges> perfect dodges · Lv <L>',
  { duration: 7, kind: 'results' })` — time is the combat clock since load (real combat seconds
  while `active`).

---

## 7. Enemies

### 7.1 Roster (base stats at enemy level 1; `src/game/combat/defs.js` → `ENEMY_DEFS`)

| kind | Display name | Role | HP | ATK | DEF | Poise | Mass | Speed | Aggro | Leash | Hurt r | Move r | XP | Gold | Token | Sheet |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `slime` | Moss Slime | swarm chaser | 26 | 8 | 0 | 0 | 0.8 | 2.2 (hops) | 6 | 8 | 0.40 | 0.30 | 6 | 1–3 | melee 1 | monster 20×16 |
| `goblin` | Bramble Goblin | melee flanker | 48 | 11 | 2 | 15 | 1.0 | 3.0 / strafe 2.5 | 8 | 12 | 0.35 | 0.30 | 12 | 3–8 | melee 1 | humanoid 32×32 |
| `archer` | Thorn Archer | ranged kiter | 34 | 10 | 1 | 10 | 1.0 | 3.0 | 11 | 14 | 0.35 | 0.30 | 12 | 3–8 | ranged 1 | humanoid 32×32 |
| `shaman` | Hex Shaman | caster / support | 40 | 14 | 2 | 10 | 1.0 | 2.6 | 10 | 14 | 0.35 | 0.30 | 18 | 5–12 | ranged 1 | humanoid 32×32 |
| `bat` | Cinder Bat | flier swarm | 18 | 7 | 0 | 0 | 0.6 | 4.5 (flying) | 9 | 12 | 0.35 | 0.30 (flier separation only) | 8 | 1–4 | melee 1 | monster 20×20, hover 1.3 |
| `boar` | Ironhide Boar | heavy charger | 120 | 20 | 6 | 60 | 3.0 | 2.4 / charge 10 | 9 | 12 | 0.60 | 0.45 | 30 | 10–20 | melee 2 | monster 32×24 |
| `dummy` | Straw Dummy | tutorial target | 9999 | 0 | 0 | ∞ | ∞ | 0 | — | — | 0.40 | 0.35 | 0 | 0 | none | monster 16×24 |
| `golem` | Cinderheart | boss (§8) | 1800 | 24 | 8 | 250 / phase | ∞ | 1.6 → 2.0 → 2.4 | arena | arena | 1.20 | 0.60 | 400 | 150 | own | monster 64×64 |

*(rev. 5, §27.19 W1: `bat` HP 24, ATK 8; `golem` ATK 22.)*
*(rev. 12, §27.24 Q2: `golem` HP 5200 — Cinderwatch Pass, the golem's one level, is balanced for a
party of four; phases at 70 % / 35 % = 3640 / 1820 HP.)*

- **Radii:** the *hurt* radius is used by every hit test (hitboxes, projectiles); the *move*
  radius by `moveGround`, separation and the stuck test. The player's hurt and move radius is 0.3.
- **Body bands** (`def.body = [y0, y1]`, u above the group origin at the feet; used by the
  projectile height test and as the aim point `(y0 + y1) / 2`): slime [0, 0.9] · goblin, archer,
  shaman [0, 1.7] · bat [hover − 0.45, hover + 0.45] (live hover) · boar [0, 1.3] · dummy
  [0, 1.5] · golem [0, 3.6] · player [0, 1.8] (`PLAYER_BODY` in `rules.js`).

The dummy refills to full HP 120 f after the last hit, never aggroes, never attacks, is excluded
from `engaged` and battle music, gives no XP or loot, and wobbles (`hurt` / `hurt2` poses) when hit.

### 7.2 Level scaling and elites

- The object's `level` L (1–10) scales **non-boss** enemies: HP ×(1 + 0.2(L−1)),
  ATK ×(1 + 0.12(L−1)), XP ×(1 + 0.25(L−1)), gold ×(1 + 0.2(L−1)); DEF, poise, speeds unscaled.
  The boss's `level` is display-only.
- `elite: true`: HP ×1.8, ATK ×1.25, poise ×1.5, XP ×2.5, gold ×3, a guaranteed heart; its HP bar
  is always visible (gold frame, name plate from the group's `name` or `Elite <display name>`);
  a slow gold rim pulse (`uFlash` (1.6, 1.3, 0.5), alpha 0.08 ↔ 0.16 at 1 Hz) when not flashing.
  *(rev. 4, §27.10 P2: the shimmer is a Sprite3D **highlight** (1.6, 1.3, 0.5), strength
  0.12 ↔ 0.24 at 1 Hz, not a `uFlash` mix.)*
- Round scaled integers with `Math.round`; `scaledDef(kind, level, elite)` in `defs.js` is the
  single implementation.

### 7.3 Telegraph grammar (binding for every enemy attack)

- Every enemy attack — including a follow-up in a string — has a wind-up of **≥ 18 f** with the
  wind-up flash: `uFlash` (1.6, 0.7, 0.3), alpha oscillating 0.35 ↔ 0.6 at 8 Hz (restarted from
  0.35 for each wind-up, so a follow-up re-pulses), plus SFX `windup` (heavy attacks) or the
  kind's own cue. *(rev. 4, §27.10 P2: the pulse is a Sprite3D **highlight** (1.6, 0.7, 0.3),
  strength 0.45 ↔ 0.9 at 8 Hz, restarted per wind-up — it brightens and tints the sprite's own
  shading, so the wind-up pose keeps its detail; the golem's cracks also flare, §27.9 G17.)*
- Every attack covering an area of radius ≥ 1.5 u, and every ranged attack, also shows a
  **ground marker** (`style: 'enemy'`) during its **telegraph period**, whose fill `progress`
  goes 0 → 1 over that period and reaches 1 at the moment the attack resolves (rim white for
  5 f):
  - melee / area attacks: the telegraph period is the wind-up; the hit lands at progress 1;
  - projectiles (arrows): the lane tracks, then **locks** for the last 12–15 f of the wind-up;
    the projectile is **released** at progress 1 and the lane fades over the flight time;
  - delayed circles (Hex Flame, Rock Toss, Ember Rain): the caster's wind-up comes first; the
    telegraph period is the circle's own fill, and the circle resolves at progress 1.
- Lanes (charges, arrows) track their target for the first part of the telegraph and **lock**
  (rim flashes white, stops following) for the last 12–15 f: the player's cue to move or roll.
- **On-screen rule (non-boss enemies):** a wind-up may start only while `ctx.onScreen` holds for
  the enemy's body middle (NDC |x| ≤ 0.92 and |y| ≤ 0.92 with the current camera). An aggroed
  enemy that wants to attack while off-screen moves toward the player with its approach movement
  (archers and shamans ignore their kite ring's outer bound meanwhile) until it is on screen.
  Aggroed off-screen enemies get a DOM edge arrow (§13.2). The boss is exempt (boss framing,
  §6.9).
- Colour language: red-orange = enemy damage; gold = player attacks / lock-on / loot; green =
  healing; blue = MP.

### 7.4 Shared state machine (`Enemy.js`)

```
dormant ─(within 32 u or woken)→ idle ─(sees player)→ notice ─→ engage ⇄ windup → active → recover
   ↑                                  │                                  ↘ (interrupt) hitstun / stagger / stun
   └──────────── (> 32 u, not aggro) ─┘   engage ─(leash broken)→ return ─(home)→ idle        any → dead
```

| State | Behaviour |
| --- | --- |
| `dormant` | No update (core skips it); sprite plays `idle`. Entered when not aggro and > 32 u from the player (checked every 0.25 s). |
| `idle` | Wanders (seeded) inside the home radius; bats flap-hover; the dummy stands. |
| `notice` | 21 f: faces the player, DOM `!` above it, SFX `enemyAlert`; wakes its group and any enemy within 6 u with LOS. |
| `engage` | Archetype movement (§7.7) while waiting for a token and a trigger. |
| `windup` / `active` / `recover` | Archetype attack; token held from windup start to recover end. |
| `hitstun` | Kinds with poise 0: every hit → 13 f, cancels windup / active, releases the token. |
| `stagger` | Poise ≤ 0: 36 f (boar 60 f), cancels the attack, releases the token, poise refills at its end. |
| `stun` | Boar / boss wall stun (§7.7, §8). |
| `return` | Leash broken: walks home at 1.5 × speed, **guarded** (hits show `Guard`, no damage), regenerates 20 % max HP/s; at home → `idle`, full HP. |
| `dead` | Pose `dead`, 30 f dither fade (`opacity` 1 → 0), then hidden; core drops loot and grants XP at the moment of death. |

- **Aggro trigger:** distance < `aggro` with LOS and |dy| < 1.5, or distance < 3 u, or damage
  taken, or a group-mate / nearby enemy noticed.
- **Poise:** each player hit subtracts its poise damage (unless armoured); at ≤ 0 → `stagger`.
  Poise regenerates to full 120 f after the last hit. Hits on poise > 0 still deal damage,
  flash and knock back (unless armoured) but do not interrupt.
- **Knockback:** `kb / mass`, capped at 3 u, applied over 11 f with ease-out through
  `ctx.moveGround` (walls stop it). Armoured states ignore knockback and poise damage.
- **Leash:** return when |position − home| > `leash + radius`, or the player has been farther than
  `leash + radius + 6` from home for 3 s. The boss never returns; boss adds never return.
- *(rev. 5, §27.13 R2 / R4 / R5)* **Paths and zones.** `engage` chases along a path on the walk
  grid when the straight way is not clear; no path within reach (`unreachable`) gives up at once
  (home, calm 6 s); `return` walks home along a path (the snap of G7 is a last resort). Each group
  has a **zone** (the first `region` containing its centre, grown to hold its home disc): the
  notice wakes other enemies within 6 u only in the same zone, sight aggro ignores a player outside
  the zone + 3 u, and the leash also breaks when the enemy leaves the zone + 3 u, or 1 s after the
  player did. Levels without regions have no zone rules.

### 7.5 Attack tokens, activation, engagement

- Budgets: **melee 3**, **ranged 2** (costs in §7.1). `ctx.requestToken(e)` succeeds if the budget
  allows; enemies without a token keep their engage movement (circle, orbit, kite) — nobody stands
  still waiting. A failed request retries after 18 f. The boss and the dummy do not use tokens.
- Dormancy is recomputed every 0.25 s; aggroed enemies are never dormant and never throttled
  (the big-level far-actor throttle does not apply to enemies).

### 7.6 Movement, separation, line of sight, projectiles

- Ground enemies move with `ctx.moveGround(e, dx, dz)` = `tileMap.move(e.position, dx, dz,
  def.moveRadius, 0.55)`; returns the fraction of the requested distance achieved (0..1) and sets
  `e.blockedBy` to `null | 'terrain' | 'collider' | 'arena'` (what stopped the move). The group Y
  follows `getHeight` with the NPC damping (λ 18).
- **Arena exclusion:** for every enemy that is neither the boss nor one of its adds, `moveGround`
  and `moveFly` also refuse positions inside any boss arena rect grown by 0.5 u (`blockedBy =
  'arena'`), at all times — nothing follows the player into the arena. Free-run lanes (boar
  charge) end at that boundary like at a wall, but hitting it is a skid, never a stun.
- **Stuck:** moved < 25 % of the intended distance for 30 f → try the best of 5 probe directions
  (±45°, ±90°, back; `ctx.walkable`); still stuck after 90 f → `return`. *(rev. 5, §27.13 R1–R4:
  chase and return follow paths on the walk grid `ctx.nav` — stairs, ledges, around obstacles —
  replacing E2's footstep trail; ≤ 2 path searches per combat sub-step; melee kinds wind up only
  when `canMelee` holds.)*
- Fliers (`bat`) ignore terrain and colliders: `ctx.moveFly(e, dx, dz)` clamps to the rect
  `home ± (radius + 8)` and to the map; group Y = ground height (damped), `mesh.position.y` and
  `shadowProxy.position.y` = hover + bob (the blob stays on the ground as the depth cue). Bats are
  created with `castShadow: false`.
- **Separation** (core, in `afterPlayer`, skipped for dormant and dead enemies): pairs closer
  than the sum of their **move radii** are pushed apart by the overlap, split in inverse
  proportion to mass: `share_i = (1/m_i) / (1/m_i + 1/m_j)`, with `1/∞ = 0` (the dummy and the
  boss never move; the other side takes 100 %). The player counts with `PLAYER_SEP_MASS = 4`
  (goblin vs player: 80 / 20; boar: 57 / 43; slime: 83 / 17), is moved by `player.moveBy`, and is
  skipped while rolling or backstepping. Enemies move through `ctx.moveGround`. Fliers separate
  among themselves only. *(§27.1 I6: an `armored` enemy counts as infinite mass against the
  player. Rev. 4, §27.9 G3: the player–boss pair separates by the boss's **hurt** radius, 1.2 u,
  and the boss sprite dithers to opacity 0.45 while the player stands behind it on screen.)*
- **Height model** (one model for LOS, projectiles and validation rule 8): a straight shot runs
  from the shooter's release height `ground + 0.9` to the aim height (the target's body middle —
  the player's `ground + 0.9`); the path is blocked where `getHeight(x, z) > y − 0.1` at a sample
  (every 0.25 u) or where a sample lies inside a static collider (`queryColliders` on the path's
  bounds, point tests).
- **Line of sight** `ctx.los(ax, az, bx, bz)`: true when that straight path from
  `groundAt(a) + 0.9` to `groundAt(b) + 0.9` is not blocked. (A ledge archer 1 u above the
  courtyard sees down into it; an actor at the foot of a two-level cliff does not see over it.)
- **Projectiles** (core, pool 64): swept circles sub-stepped ≤ 0.25 u horizontally. Straight
  projectiles carry a vertical speed `vy` (`ProjectileSpec`, §9.5) computed by the spawner:
  `vy = clamp((aimY − y) · speed / max(0.5, horizontalDist), −0.6·speed, 0.6·speed)` and keep
  that slope past the aim point until `range`. Blocked by the height model at the moving `y`.
  A projectile hits a target when the horizontal distance < `radius + hurtRadius` **and** its
  vertical span `[y − radius, y + radius]` overlaps the target's body band `[base + y0, base + y1]`
  (§7.1; `base` = the target's ground, fliers use the band around their live hover). Arc
  projectiles (`boulder`) do not collide in flight; they land on their target point
  (`groundAt(tx, tz)`) after `time` and resolve a circle hit there (melee height rule).

### 7.7 Archetypes

Timings are in frames; all wind-ups follow §7.3. "Hit" gives shape, mv, kb.

**Slime (swarm chaser).**
- Moves in hops: every 42 f, airborne 27 f (arc 0.25 u on `mesh.position.y`, pose `move1`/`move2`),
  landing squash 6 f (pose `land`). Average chase speed 2.2 u/s. *(rev. 4, §27.9 G5: the
  airborne speed is fixed when a hop is aimed — hop length / 27 f — and a seek detour ends with
  its hop.)*
- Attack at d ≤ 2.2 with a token: windup 30 f (pose `windup`, squash), leap 2.4 u over 12 f
  (active: circle r 0.6 around itself each sub-step, mv 1.0, kb 0.8), recover 42 f (pose `land`),
  cooldown 84 f. No marker (radius < 1.5).
- Poise 0 → every hit interrupts. Death: `gooPoof` 12.

**Goblin (melee flanker).**
- Approaches to 3.0 u at 3.0 u/s, then circle-strafes at radius 2.5–3.5 u at 2.5 u/s; strafe
  direction flips on a seeded coin every 90–180 f.
- Attack at d ≤ 3.2 with a token: windup 27 f (pose `windup`), lunge 0.8 u over 6 f with a slash
  (active f0–5 of the lunge: sector r 1.3 ±60°, mv 1.0, kb 0.6); 30 % (seeded) a follow-up: its
  own **18 f wind-up** (pose `windup`, flash re-pulse, §7.3) then a second slash (pose `attack2`,
  same hit, token kept); recover 36 f; cooldown 60 f.
- When the player starts a melee attack within 2.0 u and the goblin is not attacking: 20 %
  (seeded) back-hop 1.2 u over 10 f (cooldown 90 f). *(A melee attack: a combo step or the roll
  slash — action `attack` — or Whirl Slash, `skill1`; §27.21 J10.)*

**Archer (ranged kiter).**
- Keeps 5–9 u: d < 4.5 → retreats along the best of 8 directions (distance gained, walkable
  probes) at 3.0 u/s; d > 10 → approaches; otherwise strafes 60–120 f.
- Shot (ranged token, LOS, on screen, 4.5 ≤ d ≤ 11): windup 48 f (pose `windup` = bow drawn)
  with a lane marker (width 0.5, length `min(d + 2, 14)`, draped over the terrain) tracking the
  predicted point `P = player + velocity · 0.25 s` for 33 f, then locked for 15 f; release at
  progress 1: `arrow` from the archer's ground + 0.9 toward `P` with
  `aimY = groundAt(P) + 0.9` (§7.6), 14 u/s, range 14, radius 0.2, mv 1.0, kb 0.4; recover 18 f
  (pose `attack`); cooldown 108–144 f (seeded). Every 3rd shot is a volley of 3 arrows at −12°,
  0°, +12° (three lanes, same `vy`).
- Shove when the player stays within 1.6 u for 60 f: windup 18 f, sector r 1.2 ±50°, mv 0.6,
  kb 1.5, then retreat.

**Shaman (caster / support).**
- Keeps 5–8 u (like the archer, speed 2.6).
- **Hex Flame** (ranged token, LOS, d ≤ 10): windup 24 f (pose `windup` = staff raised), then a
  circle marker r 1.6 at the player's position predicted 0.3 s ahead, filling over 66 f; eruption:
  circle r 1.6, mv 1.3, kb 1.0, `emberBurst` 10, SFX `hexBurst`; cooldown 150 f.
- **Mend:** every 480 f, if an ally within 6 u is below 60 % HP: 30 f cast (pose `attack`), then
  `ctx.heal(ally, round(0.3 · ally.hpMax))` (core applies HP, the green number and `healGlow` 8).
- **Blink:** player within 2.5 u for 60 f → pose `tuck` 12 f, `deathPoof` 8, reappears 4 u away
  (best walkable of 8 directions away from the player), cooldown 300 f.
- Staff gem glows (`uGlow` (0.5, 1.0, 0.6) × 2.0).

**Bat (flier swarm).**
- Orbits the player at radius 3–4 u, 1.4 rad/s ± seeded noise, seeded direction; hover 1.3 + 0.15
  sin(4t); eyes glow (`uGlow` (1.0, 0.3, 0.1) × 2.5).
- **Swoop** (token, on screen, every 90–180 f): windup 18 f (pose `windup`, SFX `batScreech`,
  circle marker r 0.6 at the dive point = the player's position at windup start), dive at 9 u/s
  straight through the dive point for `ceil((dist + 1.5) / 9 · 60)` f, where `dist` is the
  horizontal distance from the bat to the dive point at dive start (hover drops to 0.6; active:
  circle r 0.5 around the bat's ground point, mv 1.0, kb 0.4), climb back over 36 f.
- Poise 0; knockback ×1.5. Death: pose `dead`, falls to the ground over 12 f, fades.

**Boar (heavy charger).**
- Walks toward the player at 2.4 u/s, turn rate 90°/s.
- **Charge** (melee token cost 2, LOS, on screen, 4 ≤ d ≤ 10): paw windup 60 f (pose `windup`,
  `footstep` dust 4 every 12 f, SFX `boarSnort`); a lane marker width 1.4 whose length is the
  **free run** (≤ 12 u: sampled every 0.25 u with the boar's move radius, stops at the first
  unwalkable sample, a height step > 0.55, a static collider or the grown arena rect of §7.6)
  tracks the player for 45 f and locks for 15 f. Charge at 10 u/s along the locked lane up to its
  length (poses `charge0`/`charge1` every 4 f), **armoured** (no poise damage, no knockback);
  hit: circle r 0.8 ahead each sub-step, mv 1.4, kb 3.0, knockdown.
  - **Wall** (a sub-step's `moveGround` fraction < 0.4 with `blockedBy` `'terrain'` or
    `'collider'`): **stunned** 120 f (pose `stun`, FX `stun` stars, vuln 1.5, exposed crits),
    shake 0.3/0.4, SFX `stun`.
  - Otherwise (open ground, lane end, or `blockedBy === 'arena'`): skid 30 f, recover 72 f
    (open). An elite boar follows a non-wall charge with a second charge (windup 30 f).
- **Gore** at d ≤ 2.0: windup 27 f with a **sector marker** (r 1.6, ±45°, fills over the
  wind-up), lunge 0.9 u, sector r 1.6 ±45°, mv 1.0, kb 1.5; recover 45 f.

**Dummy.** See §7.1. Wobble: pose `hurt` 8 f then `hurt2` 8 f per hit.

### 7.8 Loot

Rolled at death with `new RNG((hashString(uid) ^ Math.imul(deathCount + 1, 0x9E3779B1) ^ seed) >>> 0)`,
draws in the order gold, heart, mana, draught.

| kind | Gold | Heart | Mana mote | Draught |
| --- | --- | --- | --- | --- |
| slime | 1–3 | 10 % | 8 % | 0 |
| goblin | 3–8 | 12 % | 6 % | 2 % |
| archer | 3–8 | 10 % | 10 % | 2 % |
| shaman | 5–12 | 8 % | 30 % | 3 % |
| bat | 1–4 | 6 % | 8 % | 0 |
| boar | 10–20 | 30 % | 10 % | 5 % |
| golem | 150 + `core` pickup | — | — | — |
| dummy, boss adds | — | — | — | — |

- Scaled gold (§7.2) is split into coin pickups of 25 / 5 / 1 (at most 6 pickups per death; the
  remainder goes into the last coin). Heart chance ×2 while the player is below 30 % HP.
- **Pickups** (core pool 64; kinds `coin1`, `coin5`, `coin25`, `heart`, `mana`, `draught`,
  `upgrade`, `core`): pop out on a ballistic arc (0.4 s, 0.6–1.4 u, seeded); after 0.3 s they are
  magnetised within 2.2 u (coins 3.0 u), accelerating to 8 u/s; collected within 0.5 u; lifetime
  40 s, blinking for the last 6 s. A full pool recycles the oldest coin. A draught pickup at the
  carry cap stays on the ground. Loot feed row per pickup; SFX `coin` / `pickup`. *(rev. 4,
  §27.9 G10: a heart at full HP and a mana mote at full MP stay on the ground too
  (`CombatSystem.wantsPickup`); a magnetised pickup that becomes useless rests where it is.)*
- **Reachable landing:** every landing point must be standable (`ctx.walkable` and not water).
  When the seeded point is not, step from the death point toward the player in 0.25 u increments
  and land on the first standable sample (fallback: the player's position). When the death point
  itself is not standable (a bat over a pond, anything over the plunge pool), the pickups are
  magnetised from the moment they spawn (no 0.3 s delay) with the magnet radius doubled.
- `deathCount` (per enemy, input of the loot seed) counts that enemy's deaths this session; it is
  reset by the `reset()` hook only (§20.1).

---

## 8. Boss: Cinderheart (`ai/golem.js`, arena from `BossArena.js`)

### 8.1 Arena and intro

- The golem group's relative `arena` rect and `gate` segment (§14.1) define the arena. Core
  creates one `BossArena` per golem group and passes it to the brain as `init.arena` (read by the
  brain as `e.arena`: `{ rect, gate, y, contains(x, z), active }`; `close()` / `open()` are
  core-only). The boss kneels dormant (pose `kneel`, `uGlow` (1.0, 0.45, 0.15) × 0.4) until the
  player is inside `e.arena.rect` with |y − `e.arena.y`| < 1.0.
- **Division of work (binding).** The brain owns the boss's own behaviour: state, poses, glow,
  markers, hitboxes, projectiles, adds (`ctx.spawnAdd`), its move shakes / SFX / FX, `guarded`,
  `armored`, `exposed`, `vuln`. It **signals** global moments with `ctx.emit(event, e, …)`:
  `'bossIntro'` (f0 of the intro), `'bossAwake'` (f60), `'bossPhase'` (at the start of each
  transition, with the new phase). Core applies every global consequence of those signals and
  of the boss's death: arena close / open, `locksPlayer`, sending other enemies home, banner,
  boss bar (show / set / gems / hide), music track and section, the caldera ember emitter,
  hit-stop, slow motion, look pulses, stinger, results card, loot, the `bossDefeated` event.
- **Intro, 108 f**, `locksPlayer`, boss invulnerable:
  f0 brain → `ctx.emit('bossIntro', e)`; core: `arena.close()` — ember wall (FxQuads `wallFlame`
  every 0.6 u along the gate, HDR (2.6, 1.2, 0.4)), `barrier` rect-outline marker around the
  arena, SFX `gateClose`; the player is clamped inside the arena rect (inset 0.35) until
  `open()`; **every other enemy** that is not one of this boss's adds and is aggroed or inside the
  arena rect switches to `return` (tokens released, its markers freed, its projectiles removed);
  any of them inside the rect is placed at its home at once *(rev. 4, §27.9 G2 / G4: the ember
  wall is HDR (1.5, 0.75, 0.25) with a per-flame variation, the barrier rim (1.3, 0.45, 0.15) ×
  pulse; while any arena is closed `PlayerView.sealed` is true and no outsider may aggro or take
  an attack token)*;
  f0–60 the boss rises (`kneel` → `idle`); f60 roar (pose `roar`, SFX `bossRoar`, shake
  0.25/0.6) and brain → `ctx.emit('bossAwake', e)`; core: `ui.banner.show('Cinderheart',
  'The Last Fire of the Pass', {duration: 3})`, boss bar shown (3 phase gems), music → `boss`,
  boss framing on (§6.9).
- Move selection when idle: seeded, weighted by distance and per-move cooldowns, never the same
  move 3 times in a row; 54–84 f between attacks (phase 3: 36–60 f). Wind-ups in phase 3 × 0.75,
  rounded up (every one stays ≥ 18 f). *(rev. 4, §27.9 G1: when no move is legal the boss walks
  in to 2.2 u, and after 90 f without a legal move the no-three-in-a-row rule is waived for the
  next pick — it never idles in place.)*

### 8.2 Moves

| Move | Phases | Condition | Wind-up / telegraph | Hit | Punish window |
| --- | --- | --- | --- | --- | --- |
| Hammer Slam | 1–3 | d ≤ 4.5 (approaches to ≤ 3.0) | 60 f, pose `slamWind`; circle r 2.6 centred 1.6 u ahead | active 6 f: circle r 2.6, mv 1.5, kb 2.5, knockdown; shake 0.45/0.5; `dust` FX | 60 f (pose `slam`) |
| Sweep | 1–3 | player > 70° off the facing within 3.2 u for 60 f cumulative, or 20 % when d ≤ 3 | 48 f, pose `sweepWind`; circle r 2.6 around the boss | active 6 f: circle r 2.6, mv 1.0, kb 3.0 | 36 f |
| Rock Toss | 1–3 | d > 7 | 36 f, pose `throw`; 3 landing circles r 1.4 (player predicted 0.5 s, ±2.5 u lateral) filling 72 f | 3 `boulder` arc projectiles, landing circle r 1.4, mv 1.1, kb 1.5 | 48 f |
| Magma pool | 2–3 | after every Hammer Slam | marker `magma` r 2.0 for 240 f | `HitSpec.flat` 6 every 30 f while inside (tag per tick; §6.3) | — |
| Ember Rain | 2–3 | any distance | 30 f, pose `roar`; 6 circles (phase 3: 10) r 1.2, the first on the player, the others seeded within 4 u of the player (inside the arena), staggered 15 f, each filling 66 f | each: circle r 1.2, mv 1.2, kb 1.0, `emberBurst` 10 | 90 f (channel, hittable) |
| Charge | 2–3 | d ≥ 5 | 54 f, pose `slamWind`; lane width 1.8 whose length is the boss's **free run** (the boar model of §7.7 with the boss's move radius: stops at static colliders — the four braziers — or the arena rect inset 1), tracking 42 f, locked 12 f | 12 u/s along the lane, circle r 1.4 ahead, mv 1.5, kb 3.0, knockdown | ends against a **brazier** (`blockedBy === 'collider'`) → **stunned** 120 f (pose `kneel`, vuln 1.5, exposed), shake 0.35/0.45; ends at the arena edge → skid 45 f (open, no vuln) |
| Shockwave Slam | 3 | replaces Hammer Slam | as Hammer Slam | slam, then 3 rings spawned 18 f apart, expanding at 6 u/s to r 10, ring width 0.6 (`ring` marker + a `ring` hit with `thin: true`: tested against the player's **centre**, so a ring overlaps a standing player for 6 f and a roll's 13 i-frames leave an 8 f window; rolling inward through the ring is the intended answer), mv 1.2, kb 1.5 each | 60 f |

### 8.3 Phases

| Phase | HP range | Speed | Glow `uGlow` (1.0, 0.45, 0.15) × a | Moves |
| --- | --- | --- | --- | --- |
| 1 Stone | 100 – 70 % | 1.6 | a = 0.6 | Slam, Sweep, Rock Toss |
| 2 Molten | 70 – 35 % | 2.0 | a = 2.0, tint (1.0, 0.9, 0.85) | + Magma pool, Ember Rain, Charge |
| 3 Heartfire | 35 – 0 % | 2.4 | a = 2.4 ↔ 3.4 pulsing at 2 Hz | Shockwave Slam, Sweep, Rock Toss, Ember Rain (10), Charge |

- **Threshold clamp:** when damage would take the boss's HP below the next phase threshold, HP is
  clamped **at** the threshold (overkill is lost) and the transition starts; while a transition
  is pending or running, HP cannot drop below that threshold. Every phase therefore costs its
  full HP share (540 / 630 / 630). *(rev. 12, §27.24 Q2: at 5200 HP the thresholds are 3640 and
  1820 HP, the shares 1560 / 1820 / 1820.)*
- **→ Phase 2 (at 70 %)**, once: interrupts the current move; brain → `ctx.emit('bossPhase', e, 2)`;
  roar 120 f, **guarded** (hits show `Guard`, SFX `guard`), shake 0.45/1.2; at f60 a shockwave
  ring r 0.5 → 5 (kb 3.0, mv 0 — no damage); glow ramps over 60 f; `ctx.spawnAdd` 3 bats at arena
  corners. Core on `bossPhase`: hit-stop 12 f, chromatic-aberration pulse (§11.4), phase gem 2,
  the combat-owned caldera ember emitter (created disabled at load) enabled,
  `audio.setMusicSection('B')`. At ≤ 52 % HP, if fewer than 2 adds are alive, 3 more adds (once).
- **→ Phase 3 (at 35 %)**, once: brain → `ctx.emit('bossPhase', e, 3)` (core: hit-stop 12 f,
  look pulse, gem 3); collapse kneel **90 f** — the core is **exposed** (every hit is a forced
  crit, no attacks, not guarded), but the damage taken during the kneel is **capped at 8 % of max
  HP** (144; further hits show numbers of 0 as `Guard`; *rev. 12:* 416 of 5200); then a guarded
  roar 60 f.
- **Poise 250 per phase** (accumulated player poise damage; resets at each phase change): at 0 →
  **Broken** 180 f (pose `kneel`, vuln 1.3, exposed crits), then poise refills.
- Every boss hit landed by the player: hit-stop 5 f.
- **Adds pool:** 6 bats (level 5, no XP, no loot, never return) created at load per golem group,
  uid `<bossUid>:add#<i>`, hidden and dormant until `spawnAdd`.
- **Death** (core, on the boss's kill): hit-stop 12 f, boss-death slow motion (§4.3), white flash
  (`uFlash` (1, 1, 1) a 1.0 for 6 f — written by the brain in `die()`), `emberBurst` 24 ×3 +
  `sparkle` 24, shake 0.5/0.8, pose `dead`, 90 f dither fade; 150 gold + `core` pickup
  *(rev. 5, §27.14 X4: the flash is a warm ember tint (1, 0.5, 0.2) at 0.55; the bursts are
  `BossArena.deathBursts` — 3 × 12 `victoryEmbers` + 12 `victorySparkle` beyond the boss; the loot
  drops 1.2 u beyond the boss from the player)*;
  `audio.playStinger('victory')` then the level track; banner `The fires of the pass are quiet`;
  `arena.open()`; `combat.bossDefeated = true`, event `bossDefeated`; results card (§6.12);
  remaining adds die without loot; defeated for the session.
- **Player death during the fight:** boss reset (§6.11); arena opens; boss framing off.
- **Intended counters** (Odo's pages and Cinderwatch's signpost say so): bait the Charge into a
  brazier for the long stun; roll *inward* through Shockwave rings; step out of the magma.
- **Length check:** at Lv 5 (ATK 24–27) a "greedy" scripted player (god mode, always moving into
  range and attacking, skills on cooldown) defines the lower bound of the fight. `combat.boss.json`
  asserts greedy combat time ≥ 30 s for the whole fight and ≥ 7 s for phase 3 (a real player at
  ~30–35 % uptime then needs ≈ 90–120 s and ≈ 25 s). If the greedy run is shorter, raise the
  golem's HP in `defs.js` (pure data) — the thresholds are fractions. *(rev. 5, §27.19 W5: greedy
  39.9 s / phase 3 14.0 s at Lv 5, 34.7 / 11.4 s with every chest and shop ware; measured with the
  fixed-step bot's seeded human model at 30–35 % uptime: 83–114 s, mean 95.5 s.)*
  *(rev. 12, §27.24 Q2 / Q5: the golem has 5200 HP, for the player with three companions, who add
  their damage — the boss never targets them (§28 A3). Greedy runs, alone at Lv 5: the fixture's
  golem 99.8 s (phases 29.4 / 37.1 / 33.4 s), Cinderwatch's 96.6 s (29.5 / 33.3 / 33.8 s), with
  every chest and shop ware 83.5 s (24.8 / 30.1 / 28.6 s) — the floor holds (was 38.9 / 39.9 /
  34.7 s). The human model beside the party: 85–153 s; alone it wins, barely, in 164.5 s with 5
  draughts. A greedy run now steps ≈ 5 900 frames in one evaluate: run `combat.boss.json` and
  `combat.boss.cw.json` alone — under a loaded GPU one can pass the harness's 180 s protocol
  timeout.)*

---

## 9. Runtime interfaces (code contracts)

*(rev. 6, §27.21)* The types of this section — `CombatContext`, `PlayerView`, `EnemyInit`,
`Brain`, `HitSpec`, `ProjectileSpec`, `MarkerSpec`, `HitInfo` and the rest — are declared as the
code implements them in [`src/game/combat/types.d.ts`](../../src/game/combat/types.d.ts);
`EnemyKind`, `EnemyDef` and `ScaledEnemyDef` in [`defs.js`](../../src/game/combat/defs.js) (JSDoc,
so the Node generator that imports it stays free of the combat code). `npm run typecheck` checks
the core, every brain (`/** @satisfies {Brain} */`), the enemies sandbox's mock context and the
hooks against them, so they are the checked copy of this section: a renamed member fails at every
use. Where the text below and the code differ, the member's comment says so and §27.21 lists it.

### 9.1 `CombatSystem` (`src/game/combat/CombatSystem.js`, combat-core)

```js
export class CombatSystem {
  constructor({ game })                 // reads game.engine, scene, tileMap, level, world, player, rig,
                                        // ui, audio, particles, lighting, spriteManager
  async load()                          // everything of §4.5; no DOM before ui.enableCombat()
  setupUI()                             // legend (keyboard or pad by input.lastDevice), vitals, skill slots
  attachMaps(map)                       // called at the end of Game._setupMaps (§4.5): enemies list,
                                        // chest markers on discovery, boss marker
  warmup(far)                           // §19; keeps warm instances until endWarmup()
  endWarmup()                           // frees warm instances, records programsAtLoad
  update(dt, active)                    // §4.2/§4.3 sub-steps
  afterPlayer(dt, active)
  applyLook(dt)
  resetEncounter({ full = false })      // death reset; full=true: rest / hook reset
  buy(item) → { ok: boolean, reason?: 'gold'|'full'|'item'|'sold' }   // 'sold': rev. 5, §27.19 W3
  priceOf(item) → number | null         // 25 for 'Healing Draught'; rev. 5: the wares of SHOP_WARES too
  shopOffers() → [{ id, name, price, gain, once, upgrade, sold, available, reason }]   // rev. 5, W3
  zoneAt(x, z, y?) → number             // rev. 5, §27.13 R5: the index of the first region holding (x, z), −1
  state() → CombatState                 // §20.2
  hooks                                 // object exposed as window.__game.combat (§20.1)
  dispose()

  // read-only for Game / dialogue / tests
  actorSprites: Sprite3D[]              // all enemy + boss + add sprites (for the Game sprite loop)
  enemies: Enemy[]                      // stable order: level object order, then index; adds last
  engaged: boolean
  locksPlayer: boolean
  bossDefeated: boolean                 // any golem defeated this session (dialogue, results card)
  musicTrack: 'emberfall'|'battle'|'boss'
  minimapEnemies: {x:number, z:number}[]  // aggroed enemies' live positions, refilled in place
  tutorial: { combo: boolean, dodge: boolean, rewarded: boolean }
  events: EventEmitter                  // §9.6
  // rev. 5: nav (the walk grid, §27.13 R1), zones (the region objects, R5), purchased (Set of ware ids, W3)
  // rev. 7 (§27.22): exportProgress / importProgress, openedChests / markChestsOpened (K2),
  // rebuildNav(rect?) (K4); rev. 8: applyPresence(present) (K6), defeatedGroups() /
  // markGroupsCleared(ids) (K5)
}
```

Sub-step order inside `update` (per step `h`):

1. `CombatInput` collects edges (real input + virtual queue) into the 10 f buffer.
2. `PlayerCombat.step(h · playerScale)` — starts / advances the action, registers player hitboxes
   and projectiles for this step.
3. For each non-dormant enemy in `enemies` order: `e.update(h · enemyScale, ctx)`.
4. `Projectiles.step(h · enemyScale)` (player projectiles use `playerScale`); `GroundMarkers`
   progress of enemy telegraphs is advanced by the owning enemy.
5. Resolve hits in this order: player hitboxes vs enemies (enemy order), player projectiles vs
   enemies, enemy hitboxes vs player, enemy projectiles vs player. Damage draws the combat RNG
   (§6.3). Apply HP, reactions (`e.receiveHit` / player hurt), hit-stop, shake, FX, numbers,
   XP / loot on kills, events.
6. Timers: cooldowns, regen, perfect-dodge cooldown, dummies' refill.

`afterPlayer`: separation (§7.6), arena clamp, pickups (magnet / collect), waystone attune checks
(every 0.25 s), chest discovery (every 0.25 s), dormancy (every 0.25 s), lock-on / boss focus,
`engaged`, music (via `CombatMusic`), enemy sprite animation speeds (§4.3), device-aware legend
(§5.2), HUD values (`ui.combat.hud.setVitals` …), enemy bars / pips / edge arrows (§13.2),
`minimapEnemies`.

At the start of each `update` the camera's view-projection matrix is cached for `ctx.onScreen`
(one multiply per frame; the matrix is the one rendered last frame, identical in stepped mode).

### 9.2 `CombatContext` (core → enemies; created by `CombatSystem`)

One context object is shared by all enemies; every member is always present on combat levels.

```js
/** @typedef {object} CombatContext
 * @property {number} time                 combat time (s, scaled for enemies)
 * @property {number} frame                combat sub-step counter (hash input for visual jitter)
 * @property {PlayerView} player           { position: Vector3 (live; y = ground), radius: 0.3,
 *                                           body: [0, 1.8], facing: {x,z}, velocity: {x,z},
 *                                           alive, invulnerable, dodging, action,
 *                                           swing /* swings started, §27.1 I7 */,
 *                                           sealed /* a boss arena is closed, rev. 4 §27.9 G4 */ }
 * @property {TileMap} tileMap
 * @property {(e, dx, dz) => number} moveGround      fraction moved (0..1); sets e.blockedBy (§7.6)
 * @property {(e, dx, dz) => void} moveFly           map / leash rect / arena exclusion clamp
 * @property {(x, z) => number} groundAt
 * @property {(x, z) => boolean} walkable            standable: walkable and not water
 * @property {(ax, az, bx, bz) => boolean} los       height model of §7.6
 * @property {(x, y, z) => boolean} onScreen         NDC |x|, |y| ≤ 0.92 with the cached camera (§7.3)
 * @property {(e) => boolean} requestToken           uses ENEMY_DEFS[kind].token
 * @property {(e) => void} releaseToken
 * @property {(e, spec: HitSpec) => void} hitbox     active for this sub-step only
 * @property {(e, spec: ProjectileSpec) => number} projectile   handle or -1
 * @property {(spec: MarkerSpec) => number} marker   handle or -1 (draped, §11.2)
 * @property {(h, spec: Partial<MarkerSpec>) => void} setMarker
 * @property {(h) => void} freeMarker
 * @property {(name, x, y, z, opts?) => void} fx     named effects, §11.5
 * @property {(preset, x, y, z, count) => void} burst
 * @property {(name, x, z, opts?) => void} sfx      panned / attenuated
 * @property {(amp, dur) => void} shake
 * @property {(target: Enemy, amount: number) => void} heal   HP (capped), green number, healGlow 8, bar refresh
 * @property {(e) => void} alert                     DOM '!' above e
 * @property {(e) => void} wakeGroup                 aggro e's group + enemies within 6 u with LOS
 * @property {(x, z, r, out: Enemy[]) => Enemy[]} enemiesNear   alive, non-dormant
 * @property {(kind, x, z, level) => Enemy|null} spawnAdd       boss adds pool (golem only)
 * @property {(event: 'bossIntro'|'bossAwake'|'bossPhase', e: Enemy, ...args) => void} emit
 *           brain → core signals; core applies the global consequences (§8.1, §8.3)
 * @property {Nav} nav                     rev. 5 (§27.13 R1): the walk grid — findPath, lineClear,
 *                                           beginStep / spend; a context without it (an old mock):
 *                                           straight chase and return
 */
```

Not on the context, by design (single owner): hit-stop, slow motion, look pulses, music, banner,
boss bar, emitters, stinger and the arena's `close()` / `open()` — core applies them from damage
resolution and from the `emit` signals. The boss arena reaches the golem through `EnemyInit.arena`
(§9.3). A mock context (the enemies sandbox) implements exactly this list. *(rev. 6, §27.21 J1–J3:
`spawnAdd` ignores its `level` — adds are pooled at level 5 —, `emit` forwards only one extra
argument — the `bossPhase` phase —, `marker` takes a partial spec, and a mock may leave out
`PlayerView.swing` / `sealed`.)*

### 9.3 `Enemy` (`src/game/combat/Enemy.js`, enemies)

```js
export function createEnemy(init: EnemyInit) → Enemy   // picks the brain from ai/index.js
/** EnemyInit = { uid, group /* level object */, index, kind, level, elite, name,
 *                home: {x, z}, def /* scaledDef result */, sheet /* EnemySheet */,
 *                sprite /* Sprite3D, combatFx */, rng /* RNG */, isAdd: boolean,
 *                arena /* golem: { rect: {minX,maxX,minZ,maxZ} (world), gate: [x0,z0,x1,z1] (world),
 *                          y, active, contains(x, z) }; null for every other kind */ } */
export class Enemy {
  // identity / data (read by core)
  uid; groupId; index; kind; level; elite; name; def; sheet; sprite; rng;
  boss; flier; passive; isAdd; arena;
  blockedBy;           // set by ctx.moveGround / moveFly: null | 'terrain' | 'collider' | 'arena'
  deathCount;          // core-owned (loot seed, §7.8)
  // live state (read by core; written by Enemy except where noted)
  position;            // === sprite.position (group origin at the feet)
  home; facing;        // {x,z} unit
  hp; hpMax;           // hp written by core (damage) and Enemy (regen, reset)
  poise; poiseMax;
  alive; state; aggro; dormant;
  guarded;             // hits → 'Guard', no damage (return, boss roar / intro)
  armored;             // no poise damage, no knockback (charge, super armour)
  exposed;             // crits +0.30 or forced (boss core)
  vuln;                // damage multiplier (1, 1.3, 1.5)
  hitFlash;            // seconds; set by core on damage; Enemy composes uFlash each update
  token;               // set by ctx.requestToken
  barSlot = -1;        // core-owned
  radius; mass; hover;
  phase;               // boss only: 1..3
  update(h, ctx)             // one sub-step (h already scaled; 0 never passed)
  receiveHit(info: HitInfo, ctx)   // after core reduced hp (> 0): reactions only
  die(ctx)                   // hp ≤ 0: state 'dead', fade; core already granted XP / loot
  reset(ctx)                 // home, full hp, poise, idle, visible, flash 0
  wake(ctx)                  // force aggro (notice)
  sleep()                    // → dormant, play('idle')
  get targetable()           // alive && !dormant && state !== 'return' && opacity visible
  pose(name)                 // sprite.setFrame(sheet.poses[name], DIRECTIONS row of the facing)
  anim(name)                 // sprite.play(name) for idle / walk / run
  face(x, z)                 // facing + direction row with Sprite3D.directionFromVector hysteresis
  // additive (§27.5 E7, rev. 4 §27.9 G6): sendHome, setPhase, hpFloor, broken, homeRadius, lift,
  // t / fr / after(f) / entered / serial, lockFlash, the marker / hazard helpers,
  // resetSeek(), endDetour(), decayFlash(h)
  // additive (rev. 5, §27.13 R2 / R3 / R5 / R6 / R7): unreachable, zone / zoneRect (core-assigned),
  // canMelee(ctx), hazardList(type), newTag() → number (EnemyInit.tagSlot)
}
```

The Enemy writes `uFlash` every update in this priority: `hitFlash > 0` → hit flash (§11.4);
else wind-up pulse; else elite rim; else (0, 0, 0, 0). It writes `uGlow` for its kind (§7.7, §8).
Core never calls `sprite.setFlash` on enemies. *(rev. 4, §27.10 P2: the wind-up pulse, the elite
shimmer and the boss's hit flash are written with `setHighlight`, §10.1; `uFlash` carries the
non-boss hit flash and the boss's death flash. With `freezeAI` core calls `decayFlash(h)` so a
frozen enemy's hit flash still fades.)*

*(rev. 6, §27.21 J4: `EnemyInit` also takes `tagSlot`; `group` may be null for the boss's adds; `arena`
is the `BossArena`, typed `EnemyArena` with the members core reaches through it. §27.21 J9: the
`Brain` members are all optional in the type, but `Enemy` calls `engage` and `attack` unguarded for
every kind but the boss, and `update` for the boss.)*

### 9.4 `ENEMY_DEFS` (`src/game/combat/defs.js`, enemies; stub written by foundation)

```js
export const ENEMY_DEFS = {
  slime: { name: 'Moss Slime', hp: 26, atk: 8, def: 0, poise: 0, mass: 0.8, speed: 2.2,
           aggro: 6, leash: 8, radius: 0.40, moveRadius: 0.30, body: [0, 0.9], xp: 6, gold: [1, 3],
           drops: { heart: 0.10, mana: 0.08, draught: 0 }, token: { type: 'melee', cost: 1 },
           flier: false, hover: 0, passive: false, boss: false, labelY: 1.3 },
  // goblin, archer, shaman, bat, boar, dummy, golem — every number from §7.1 / §7.8 (golem hp 1800,
  // phases: [0.70, 0.35]), body bands of §7.1 (bat: body relative to its hover, [-0.45, 0.45]),
  // labelY: goblin/archer/shaman 2.3, bat 2.5 (above the hover), boar 1.9, dummy 1.9, golem 4.4
};
// mass: Infinity for dummy and golem (JSON-free module, so Infinity is fine)
export function scaledDef(kind, level = 1, elite = false)   // §7.2; returns a new frozen object
```

*(rev. 6, §27.21 J5: the data also has goblin `strafeSpeed`, boar `chargeSpeed` (both unused by
the brains), golem `epithet` and `phaseSpeeds`; `scaledDef` adds `kind`, `level`, `elite` and
`guaranteedHeart` — typedefs `EnemyDef` / `ScaledEnemyDef` in `defs.js`.)*
*(rev. 12, §27.24 Q2: golem `hp` 5200.)*

### 9.5 Shapes

```js
/** HitSpec (enemy and player hitboxes; Hitboxes.js implements the tests)
 * { shape: 'circle'|'sector'|'lane'|'ring', x, y /* attacker ground */, z, r = 1, rInner = 0,
 *   dirX = 0, dirZ = 1, halfAngle = 60 (deg), len = 1, width = 1, dy = 0.6, mv, kb, poise = 0,
 *   knockdown = false, flat = 0 /* > 0: flat damage, §6.3 */, thin = false /* target radius
 *   treated as 0 (ring waves) */, tag: string /* one hit per target per tag; rev. 5 (§27.13 R6): a
 *   number, 0 = untagged */,
 *   fromX?, fromZ? /* knockback origin, default x,z */ }
 * Overlap vs a target circle (tx, tz, tr = thin ? 0 : hurt radius): circle d < r + tr; sector
 * d < r + tr and the angle to the target within halfAngle + asin(min(1, tr / d)); lane
 * 0 ≤ t ≤ len and |perp| < width/2 + tr (t, perp along dir from x,z); ring rInner − tr < d < r + tr;
 * plus |ty − y| ≤ dy where ty is the target's ground (fliers: the ground below them).
 *
 * ProjectileSpec
 * { kind: 'arrow'|'emberBolt'|'boulder', x, y /* release height, absolute */, z, dirX, dirZ,
 *   vy = 0 /* u/s, from the aim formula of §7.6 */, speed, range, radius, mv, kb,
 *   poise = 0, pierce = false, splash = null | { r, mv },
 *   arc = null | { tx, tz, time /* s */, apex /* u */ } }      // arc: lands at (tx, groundAt, tz)
 *
 * MarkerSpec (GroundMarkers.set, §11.2)
 * { shape: 'circle'|'ring'|'sector'|'lane'|'rect', x, y = 0.03 /* lift above the draped ground */,
 *   z, r, rInner, dirX, dirZ, halfAngle, len, width, w, d, progress: 0..1,
 *   style: 'enemy'|'player'|'lock'|'barrier'|'magma', alpha = 1 }
 *
 * HitInfo (core → Enemy.receiveHit / player hurt)
 * { damage, crit, mv, kb, kbDirX, kbDirZ, poise, knockdown, source: 'melee'|'skill'|'projectile'|'enemy',
 *   tag, guarded /* true: no damage was dealt */ }
 */
```

*(rev. 6, §27.21 J6–J7: `HitSpec.tag` is a number, 0 = untagged (rev. 5, §27.13 R6);
`ProjectileSpec.arc.apex` is optional (2) and `speed` / `range` / `radius` default to 10 / 12 / 0.2 in
`Projectiles.spawn` — the type keeps them required, as above; no hit carries `source: 'enemy'` — the
player is hurt through `PlayerCombat.hurt` with its own record.)*

### 9.6 Events (`combat.events`, an engine `EventEmitter`)

| Event | Payload (≤ 4 args) |
| --- | --- |
| `hit` | `(target /* Enemy or 'player' */, damage, crit, source)` — for the player *(rev. 4, §27.9 G11)* `('player', damage, false, 'melee' \| 'projectile' \| 'hazard')`, before `playerHurt` |
| `kill` | `(enemy)` |
| `levelup` | `(level)` |
| `playerHurt` | `(damage)` |
| `playerDeath` | `()` |
| `respawn` | `(checkpointId)` |
| `engaged` | `(on)` — `engaged(false)` also fires when a death reset, a rest or the `reset()` hook ends an engagement *(rev. 4, §27.9 G11)* |
| `pickup` | `(kind, amount)` |
| `bossPhase` | `(phase)` (re-emitted by core after it applied the consequences of the brain's signal) |
| `bossDefeated` | `(enemy)` |
| `attuned` | `(waystoneId)` |
| `chestFound` | `(chestId)` (discovered: minimap marker added) |
| `purchase` | `(item, price)` — a shop purchase *(rev. 5, §27.19 W3)* |

### 9.7 `Player.js` additions (combat-core)

```js
new Player({ ..., combat = false })
//  combat: sheet = createCharacterSheet({ ...CHARACTER_PRESETS.traveler, preset: 'traveler', weapon: 'sword' },
//          { combat: true }); sprite option combatFx: true. false: exactly today's sheet and sprite.
player.action = null        // string while combat owns the sprite (§6); update() then only follows the
                            // ground height and returns BEFORE any play()/faceVector()/speed write,
                            // including the frozen 'idle' branch
player.faceOverride = null  // {x,z} unit: sprite faces it while walking (lock-on strafe)
player.moveOverride = null  // {x,z} world-space move vector (tests); replaces input.getMoveVector()
player.speedMul = 1         // multiplies walk/run speed (1 exactly on peaceful levels)
player.moveBy(dx, dz) → number   // tm.move(position, dx, dz, RADIUS, 0.55); fraction moved
```

The footstep `onFrameChange` stays keyed to `walk*` / `run*` frames; `setFrame` does not trigger it.

### 9.8 World interactables (level package) and `Game._interact` (combat-core)

`World._buildProps` adds, for `chest` and `waystone` objects:

```js
this._interact(obj.id, built.interact.position, {
  kind: obj.type,                                  // 'chest' | 'waystone'
  label: 'Examine',                                // combat overwrites: 'Open' / 'Rest' (§6.12)
  radius: obj.type === 'chest' ? 1.2 : 1.5,
  prompt: <anchor: chest y + 1.2, waystone y + 2.4>,
  text: obj.type === 'chest' ? { speaker: '', lines: ['The chest is locked tight.'], linesDefault: 'chest' }
                             : { ...(obj.name ? { speaker: String(obj.name) } : { speaker: 'Waystone', speakerDefault: 'waystone' }),
                                 lines: ['An old waystone hums quietly.'], linesDefault: 'waystoneText' },
});
// the pushed item additionally carries: object: obj (the level object), prop: built.propResult.controls
```

The text stays English in the interactable (§27.23 P12): `linesDefault` and `speakerDefault` name
the UI strings the game shows for these code defaults (`t('game.default.<id>')`), and a named
waystone's speaker is shown as a term ([I18N.md §4.8](../specs/I18N.md#48-call-sites)).

`World._interact` accepts the two extra optional fields (`object`, `prop`) and copies them onto the
item. Combat sets `it.onInteract = async (game, it) => …` and `it.label` at load. `Game._interact`
gains, before the text branch: `else if (it.onInteract) await it.onInteract(this, it);`.
`Game._findInteractable` skips items with `it.disabled`. `Game._setupMaps` already turns every
interactable into a marker of its `kind` (`waystone`, `chest`); on combat levels
`combat.attachMaps` removes the chest markers again and re-adds each one on discovery (§13.3).

---

## 10. Sprites

**Protecting existing sheets.** Before its first edit the sprites package adds a
`sprite_art.html?mode=hashes` view that paints every `CHARACTER_PRESETS` sheet, the randomised
villagers for seeds 1–8, every `createCreatureSheet` kind and every prop sprite sheet, and prints
an FNV-1a hash of each canvas's pixels; that output, taken on the **unmodified** code, is committed
as `sandbox/sprite_art.hashes.json`. `sprite_art.combat.json` recomputes the hashes after the edits
and fails on any difference (shared draw paths — `armSwingFront`, the `drawSide` arm block,
`lagOf`, the hurt face, `p.ox` / `p.oy` — are the risk).

### 10.1 `Sprite3D` option `combatFx` (sprites)

```js
new Sprite3D(sheet, { ..., combatFx: false })
sprite.setFlash(r, g, b, a)   // mix toward (r,g,b) by a after opaque_fragment; no-op without combatFx
sprite.setGlow(r, g, b, a)    // additive emissive on glow texels; no-op without combatFx
sprite.setHighlight(r, g, b, a) // rev. 4 (§27.10 P1): brightens and tints the sprite's own shading;
                                // no-op without combatFx; getter `highlight` ([r, g, b, a]); clone() copies it
sprite.bodyOpacity = 0.45       // rev. 5 (§27.13 R8): any sprite, 0..1 (default 1) — dithers the visible quad
                                // only; the shadow and blob follow `opacity` (uniform uShadowDither, same program)
```

- With `combatFx: true` the lit material uses `customProgramCacheKey`
  **`luminati-sprite3d-lit-fx-v1`** and adds `uFlash` and `uGlow` (both `THREE.Vector4`, default 0)
  to `this._uniforms` **before** `_createLitMaterial` runs. Fragment additions (on top of the
  existing lit patch, unchanged):
  - after the existing emissive patch: `if (diffuseColor.a < 0.98) totalEmissiveRadiance += uGlow.rgb * uGlow.a * diffuseColor.rgb;`
  - after `#include <opaque_fragment>`: `gl_FragColor.rgb = mix(gl_FragColor.rgb, uFlash.rgb, uFlash.a);`
  - *(rev. 4, §27.10 P1)* a third uniform `uHighlight` (Vector4, default 0) in the **same** program
    key, applied after `opaque_fragment` and **before** the `uFlash` mix:
    `c += (c · uHighlight.rgb · (1 − smoothstep(0.45, 1.2, lum(c))) + uHighlight.rgb · 0.035) · uHighlight.a`
    (the `smoothstep` keeps glow texels from blooming). The program count is unchanged.
- **Glow texels** are painted with alpha exactly **204** (0.8) — they pass the 0.5 alpha test and
  mark "emissive" pixels (eyes, golem cracks, staff gem). Everything else stays alpha 255 or 0.
  The depth / shadow material and its key are unchanged.
- Without the option the source, key and uniforms are byte-for-byte today's.

### 10.2 Character combat sheet (`CharacterSprites.js`, sprites)

```js
createCharacterSheet(spec = {}, opts = {})       // opts.combat: boolean (default false)
export const COMBAT_POSE_NAMES = ['wind', 'slash', 'follow', 'backhand', 'thrust', 'spin',
                                  'cast', 'aim', 'hurt', 'tuck', 'roll', 'down'];   // columns 6–17
export const _painterKit = { Painter, resolvePainter, T, M, CRE_L, blob, quadGait, quadLeg,
                             tailChain, rampForKind, finishTexture, buildAnimations, POSES, lagOf };
```

- With `combat: true`: columns = `POSES` (0–5, **pixel-identical** to the plain sheet) +
  `COMBAT_POSES` (6–17) → 18 × 32 = **576 × 128**. Texture name `character:<preset>:combat`. The
  result gains `poses: { idle0: 0, idle1: 1, walk0: 2, walk1: 3, walk2: 4, walk3: 5, wind: 6, …, down: 17 }`.
  Without the option nothing changes (6 columns, same texture name, no `poses`).
- Combat poses carry `{ key, bob, br, walk: -1, act, phase, lag? }`; **new drawing branches key
  only on `pose.act`** (existing poses have none): `armSwingFront`, the `armSwing` block of
  `drawSide`, a new `drawWeaponDrawn` (called where the sheathed weapon is drawn; uses the pole's
  far / near hand swap so the mirrored `right` row holds the weapon in the correct hand), `lagOf`
  (`if (pose.lag) return pose.lag`), the hurt face, `p.ox` / `p.oy` lean (reset after the frame).
- Pose intent: `wind` weapon back; `slash` forward swing; `follow` follow-through; `backhand`
  reverse swing; `thrust` lunge stance, weapon forward; `spin` arms out, weapon horizontal;
  `cast` both arms up (bow: aim drawn up, staff: raised); `aim` arm forward (bow drawn, staff
  pointed, flask raised); `hurt` recoil, eyes shut; `tuck` crouched ball; `roll` ball mid-roll;
  `down` lying. *(rev. 5, §27.15 K1: `roll` is a curled figure — head leading, cloaked back arched,
  boots underneath — in every view; the child build draws its bow at chest height.)*
- Drawn weapons ≤ 8 px, 1 px transparent margin in every combat column (SPR-04). Big arcs are FX.
- Animations added per direction (loop false, 12 fps; for sandboxes — the game uses `setFrame`):
  `attack1 [6,7,8]`, `attack2 [9,8]`, `attack3 [6,10]`, `spin [11]`, `cast [12]`, `aim [13]`,
  `hurt [14]`, `dodge [15,16,15]`, `down [17]`.
- Optional spec field `ears: 'pointed'` (goblins): absent = unchanged drawing for every existing
  spec.

### 10.3 Enemy sheets (`MonsterSprites.js`, sprites)

```js
export const ENEMY_SHEET_KINDS = ['slime', 'goblin', 'archer', 'shaman', 'bat', 'boar', 'dummy', 'golem'];
export function createEnemySheet(kind) → EnemySheet     // throws on an unknown kind; callers cache
/** EnemySheet = the SpriteSheet shape (texture, canvas, frameWidth, frameHeight, columns, rows: 4,
 *  pixelsPerUnit: 16, anchor: [0.5, 0], animations, name, dispose()) plus
 *  { kind, poses: Record<string, number>, spriteOptions: object } */
```

- Rows are `DIRECTIONS` (down, left, right, up) with a real `right` row (mirror painted by
  `resolvePainter`), so `setFrame(col, row)` never needs a flip.
- Every sheet has animations `idle_<d>` (2.5 fps loop), `walk_<d>` (8 fps loop), `run_<d>`
  (13 fps loop) and `poses` with **at least**: `idle0, idle1, move0, move1, move2, move3, windup,
  attack, hurt, dead`.
- `spriteOptions` is spread into the Sprite3D options by core
  (`{ ...CHARACTER_SPRITE_OPTS, ...sheet.spriteOptions, combatFx: true }`); it contains only
  Sprite3D option keys (`blobSize`, `castShadow`, `normalUp`, `wrap`, `roundness`).

| kind | Frame | Columns (poses) | spriteOptions | Look |
| --- | --- | --- | --- | --- |
| slime | 20×16 | 0 idle0, 1 idle1, 2–5 move0–3 (hop squash / stretch), 6 windup (squash), 7 attack (stretched leap), 8 hurt, 9 dead (splat), 10 land | `blobSize [0.9, 0.45]` | translucent-looking **teal** gel (GEL ramp, mid-tone ≈ `#3fb6a8`, bright rim highlight), dark eyes, a moss tuft and leaf on top — must read against grass (value-contrast check below) |
| goblin | 32×32 | character combat sheet; aliases `move0–3 = walk0–3`, `windup = wind`, `attack = slash`, `attack2 = backhand`, `dead = down` | character defaults | `build: 'child'`, skin `#7aa84a`, `ears: 'pointed'`, bald, dark leather tunic, `weapon: 'sword'` |
| archer | 32×32 | aliases `windup = aim`, `attack = follow`, `shove = thrust`, `dead = down` | character defaults | `build: 'child'`, green skin, hood (`hat: 'hood'`), `weapon: 'bow'`, quiver |
| shaman | 32×32 | aliases `windup = cast`, `attack = aim`, `blink = tuck`, `dead = down`; staff gem painted as glow texels | character defaults | `build: 'child'`, green skin, feathered hood, bone beads, `weapon: 'staff'` |
| bat | 20×20 | 0–1 idle (= flap), 2–5 move0–3 (4 wing positions), 6 windup (wings up, eyes wide), 7 attack (wings swept back), 8 hurt, 9 dead | `castShadow: false`, `blobSize [0.7, 0.35]` | charcoal wings with ember-orange membranes, glowing eyes (glow texels); `idle_<d>` uses move0–3 at 10 fps |
| boar | 32×24 | 0–9 common, 10 charge0, 11 charge1, 12 stun | `blobSize [1.6, 0.7]` | bristled iron-grey hide, bone tusks, plated forehead; `quadGait` legs |
| dummy | 16×24 | common (move = idle), 8 hurt (tilt left), 10 hurt2 (tilt right), 9 dead (= hurt) | `blobSize [0.7, 0.35]` | straw dummy on a post with a painted target |
| golem | 64×64 | 0 idle0, 1 idle1, 2–5 move0–3, 6 windup (= slamWind), 7 attack (= slam), 8 hurt, 9 dead, 10 slamWind, 11 slam, 12 sweepWind, 13 sweep, 14 throw, 15 roar, 16 kneel | `blobSize [2.6, 1.2]` | basalt golem, magma cracks and core as glow texels, cinder crown; 1088 × 256 sheet (17 columns) |

- New material ids 35–39 (free): `GEL`, `BONE`, `GLOW`, `STONE`, `WING`, each with a 5-tone ramp.
  `CREATURE_DEFS`, `CRITTER_KINDS` and the critter code are untouched.
- **Value contrast:** `sprite_art.html?mode=combat` reports, for slime, goblin and bat, the
  contrast ratio `(L1 + 0.05) / (L2 + 0.05)` (sRGB relative luminance) between the sheet's opaque
  mid-tone average and the average of the `g` and `G` grass top textures; each must be ≥ 1.6
  (the combat script asserts it).
- Painting is RNG-free per frame (or seeded with `hashString('enemy:' + kind)`), done once at load
  (budget: all 8 sheets + player ≤ 120 ms CPU).

### 10.4 FX atlas (`FxSprites.js`, sprites)

```js
export const FX_FRAMES = { /* name → { w, h, n, fps } */ };
export function createFxAtlas() → { texture, canvas, frames: Record<name, { w, h, n, fps, rects: [u0,v0,u1,v1][] }> }
```

Atlas ≤ 512 × 512, NEAREST, sRGB, ClampToEdge, 1 px transparent gutter around every frame. White /
near-white cores so instance colours tint them; alpha is binary (0 / 255).

| Frame | Size × n | fps | Use |
| --- | --- | --- | --- |
| `slash` | 48×24 × 4 | 30 | A1 / A2 arc (flat, hip height) |
| `slashBig` | 64×32 × 4 | 30 | A3 sweep |
| `spin` | 64×64 × 4 | 30 | Whirl Slash ring |
| `thrust` | 48×12 × 3 | 30 | A3 streak |
| `impact` | 16×16 × 4 | 30 | hit star |
| `crit` | 24×24 × 4 | 30 | crit star |
| `dust` | 16×16 × 3 | 20 | slam / landing puff |
| `arrow` | 16×4 × 1 | — | arrow |
| `emberBolt` | 16×16 × 2 | 12 | player bolt |
| `boulder` | 16×16 × 2 | 8 | boss rock |
| `coin` | 8×8 × 4 | 12 | coins (tinted copper / silver / gold) |
| `heart`, `mana` | 10×10 × 2 | 4 | pickups |
| `draught` | 10×12 × 1 | — | pickup |
| `upgrade`, `core` | 12×12 × 2, 14×14 × 2 | 4 | pickups |
| `stun` | 16×8 × 4 | 10 | dizzy stars |
| `pillar` | 24×64 × 4 | 12 | level-up column |
| `wallFlame` | 16×24 × 4 | 10 | boss ember wall |

---

## 11. VFX rendering and feedback

### 11.1 `FxQuads` (`src/engine/fx/FxQuads.js`, fx-audio-input)

```js
export class FxQuads {
  constructor({ atlas, capacity = 256, name = 'fx:quads' })
  object            // THREE.InstancedMesh — add to the scene; frustumCulled = false, castShadow = false
  alloc() → number  // handle, or -1 when full
  set(h, p)         // p = { x, y, z, frame: string, index = 0, scale = 1, rot = 0 (rad, in-plane),
                    //       mode: 'billboard'|'flat'|'screen', dirX = 0, dirZ = 1 (flat mode orientation),
                    //       r = 1, g = 1, b = 1, a = 1 }  — caller reuses p (no allocation)
  free(h); clear(); update()   // update(): once per frame, uploads dirty ranges, sets count and visible
  get count
  dispose()
}
```

- World size of a quad = frame pixels / 16 × `scale`, centred on `(x, y, z)`. `billboard` = upright,
  facing the camera yaw (`globalUniforms.uCameraYaw`); `flat` = horizontal at `y`, its +V axis
  along `(dirX, dirZ)`; `screen` = faces the camera fully.
- Unlit: colour = texel × `(r, g, b)` (HDR, may exceed 1); alpha test 0.5, `a < 1` is a 4×4 Bayer
  dither fade (depth-writing, sharp in the DOF); fog applied. One draw call, `visible = count > 0`.
  `customProgramCacheKey` **`luminati-fxquads-v1`**. Renders into the HDR scene target like every
  material (no tone mapping in the shader).

### 11.2 `GroundMarkers` (`src/engine/fx/GroundMarkers.js`, fx-audio-input)

```js
export class GroundMarkers {
  constructor({ capacity = 48, name = 'fx:markers',
                heightField = null /* { sample: (x, z) => number, minX, minZ, maxX, maxZ, res = 4 } */ })
  object            // InstancedMesh: renderOrder RENDER_ORDER.DECALS + 1, polygonOffset (-2, -4),
                    // depthWrite false, transparent, fog, castShadow false, frustumCulled false
  alloc() → number; set(h, p /* MarkerSpec, §9.5 */); free(h); clear(); update(); get count; dispose()
}
```

- **Draped on the terrain (binding).** Each instance is one shared **24 × 24-segment grid**
  (1 152 triangles; 48 instances ≈ 55 k triangles, still one draw call) spanning the shape's
  bounding rectangle. The vertex shader samples a height texture at every vertex:
  `y = height(x, z) + spec.y`. With `heightField`, the constructor samples
  `heightField.sample` on a grid of `res` texels per u over the bounds once (Cinderwatch:
  384 × 480 samples, budget ≤ 40 ms; fall back to `res = 2` above that — *rev. 5, §27.14 X1:
  always `res` 4, baked in ≤ 6 ms row slices with one upload, no fallback*) into an R16F
  `DataTexture` (HalfFloat, linear filtering, clamp); without it a 1 × 1 zero texture is bound, so
  `spec.y` is the absolute height (sandboxes). Same program either way. Markers therefore follow
  steps, stairs, ledges and cliffs (a cliff becomes a steep sliver of ≤ one grid cell) — a
  boar lane across a one-level step, a ledge archer's lane down into the courtyard and a Hex Flame
  circle on stairs all stay on the visible ground. Combat always passes
  `{ sample: (x, z) => tileMap.getHeight(x, z), …level bounds }` and `y = 0.03`.

- Shapes: `circle` (fill disc r), `ring` (annulus rInner–r), `sector` (apex x,z, radius r,
  halfAngle deg, axis dir), `lane` (from x,z along dir, `len` × `width`), `rect` (centre x,z,
  `w` × `d`, outline only, axis-aligned to dir). The fill grows from the centre / origin with
  `progress`; the rim pulses on `uTime`; the pattern is quantised to 16 px per u.
- Styles (linear HDR): `enemy` rim (2.4, 0.55, 0.18), fill (0.9, 0.2, 0.08) alpha 0.18 → 0.42 with
  progress, rim white (3, 3, 3) for the last 5 f at progress 1; `player` rim (2.2, 1.6, 0.6);
  `lock` thin rotating gold dashes (1.8, 1.4, 0.5); `barrier` (2.6, 0.9, 0.3) pulsing outline;
  `magma` fill (1.6, 0.5, 0.1) alpha 0.5 with animated noise.
  *Shipped values (§27.3 F1, rev. 4 §27.9 G8):* `enemy` rim (2.6, 0.34, 0.12) × (0.85 + 0.25 ·
  progress + 0.1 · pulse), fill (1.3, 0.13, 0.05) alpha 0.22 → 0.5; resolve white
  (0.95, 0.88, 0.78), with progress ≥ 0.9995 counted as 1; `barrier` rim (1.3, 0.45, 0.15) ×
  pulse with a 3-texel inner band at alpha 0.1; `magma` fill (1.0, 0.27, 0.05) × 0.55–0.9, rim
  (1.5, 0.36, 0.07) × (0.8 + 0.3 · pulse). A fragment whose draped height differs by more than
  0.12 u from the height texel under it is dropped (no spikes where a grid cell spans a cliff).
  *(rev. 5, §27.14 X2: `magma` is a cellular crust — dark basalt plates split by glowing cracks,
  one plate in six molten — every colour under luminance 1.05.)*
- Key **`luminati-groundmarkers-v1`**. `combat_fx.html` includes a stepped-terrain case (a lane
  across a one-level step and down a two-level ledge, a circle on a stair) built with a sampled
  height function.

### 11.3 Particle presets (`Particles.js` `PARTICLE_PRESETS`, fx-audio-input)

Added to `PARTICLE_PRESETS` only (**not** to the catalog's `EMITTER_PRESETS`). All
`mode: 'burst'`, `motion: 'emit'`, `variants: 1`, `tumble: 0`, `twinkle: 0`, `blink: 0`,
`nightVisibility: 0`. The **pool-key fields** (`Particles._pool`: texture, variants, blending,
lit, pulse, tumble, aspect, streak, fade, twinkle, blink, nightVisibility) are fixed so that the
six presets add exactly **one** new pool:

| Preset | Pool-key fields (texture · blending · lit · pulse · aspect · streak · fade) | Shares the pool of | Look (per-particle fields) |
| --- | --- | --- | --- |
| `hitSpark` | `streak` · additive · 0 · 0 · 4 · 0.04 · [0, 0.3] | — (**the one new pool**) | colour `#fff2c0` → `#ff9a3c`, hdr 4, life 0.12–0.25 s, size 0.05–0.08, burstSpeed 3–7, burstUp 0.5–2, gravity −8, drag 4 |
| `emberBurst` | `streak` · additive · 0 · 0 · 4 · 0.04 · [0, 0.3] | `hitSpark` | colours `#ff8a2a` / `#ff3a12` / `#ffd27a`, hdr 3, life 0.4–0.9 s, size 0.05–0.09, burstSpeed 1–3, burstUp 1–3, gravity +1.5, drag 1 |
| `deathPoof` | `smoke` · normal · 1 · 0 · 1 · 0 · [0.05, 0.6] | `footstep` | `#d8d0c0`, alpha 0.7, life 0.4–0.8 s, size 0.5 → ×2.2, burstSpeed 0.6–1.4, burstUp 0.3–0.8, drag 4 |
| `gooPoof` | `smoke` · normal · 1 · 0 · 1 · 0 · [0.05, 0.6] | `footstep` | `#5fc7b0` (the slime's teal), otherwise as `deathPoof` |
| `healGlow` | `star` · additive · 0 · 1 · 1 · 0 · [0.05, 0.3] | `sparkle` | `#bfe58f`, hdr 3, life 0.5–1.0 s, size 0.2–0.35, velocity (0, 1.2, 0), burstSpeed 0.2–0.6 |
| `magicBurst` | `star` · additive · 0 · 1 · 1 · 0 · [0.05, 0.3] | `sparkle` | colours `#8fd0ff` / `#f3cf7a`, hdr 3.5, life 0.4–0.8 s, size 0.25–0.45, burstSpeed 2–5 radial |

*(rev. 5, §27.14 X3: three more presets in the existing pools — `victoryEmbers` (streak),
`victorySparkle` and `levelSparkle` (sparkle) — for the boss's death and the level-up, at the bloom
threshold.)*

Active burst pools on a combat level: `footstep`, `splash`, `sparkle` (existing) + the streak pool
= **4**. `combat_fx.html` prints `particles._poolList.length` after firing every preset and
asserts the growth is exactly 1. Rules: always call `burst(preset, pos, count)` with an explicit
count and **no overrides** on hot paths; ≤ 12 particles per hit, ≤ 24 per death / level-up; reuse
`footstep`, `sparkle`, `splash`.

### 11.4 Feedback tables (`Feel.js`, combat-core)

**Hit-stop** (combat freeze, §4.3):

| Event | Frames |
| --- | --- |
| player melee hit landed | 4 (A3: 7) |
| crit | +2 |
| kill | +4 |
| Whirl Slash hit / Ember Bolt hit | 3 (+ crit / kill bonuses) |
| player hurt | 6 |
| boss hit landed | 5 (+ crit bonus; no kill bonus) |
| boss phase change / boss death | 12 (applied by core, §8) |

A player hit's hit-stop is `min(10, base + crit + kill)` frames (A3 crit kill: 7 + 2 + 4 → 10).
Several hits in one sub-step take the maximum, not the sum. Flat damage causes none.

**Camera shake** `rig.shake(amp, dur)`: hit 0.05/0.12 · crit 0.12/0.2 · finisher 0.08/0.15 ·
player hurt 0.15/0.25 · knockdown 0.25/0.35 · Radiant Nova 0.2/0.3 · boar wall stun 0.3/0.4 · boss
slam 0.45/0.5 · boss roar 0.45/1.2 · boss intro roar 0.25/0.6 · boss death 0.5/0.8. Dodge: none.

**Flash** (`uFlash`): enemy hit (2.2, 2.2, 2.2) a 0.85 for 2 f then a 0.4 for 2 f; wind-up and elite
rim per §7.3 / §7.2; player hurt (2.0, 0.35, 0.3) a 0.7 for 3 f. Player i-frames: `mesh.visible`
blink at 15 Hz. *(rev. 4, §27.10 P2: the boss's hit flash is a white highlight (2.2) of strength
0.6 then 0.3, not a mix — the mix whited the 4 u sprite out; other enemies keep the mix.)*

**Look** — `applyLook(dt)` runs after `weather.update`. At `load()` it stores a baseline copy of
the `postfx.settings` values it touches (`dof.focusRange`, `dof.tiltShift`, `dof.tiltWidth`,
`grade.vignette`, `grade.vignetteColor`, `grade.chromaticAberration`, `grade.exposure`) and each
frame writes `baseline + offsets` (never accumulating). `grade.saturation` is rewritten by
Weather every frame, so its offset is added after `weather.update`.

| State | Offsets |
| --- | --- |
| engaged (eased over 0.8 s) | `dof.focusRange` 6 → 8.5, `dof.tiltShift` 0.42 → 0.30, `dof.tiltWidth` 0.30 → 0.40 |
| player hurt (0.35 s pulse) | `grade.vignette` → 0.85, `vignetteColor` toward red `#ff3020` |
| HP < 25 % | saturation −0.25, vignette 0.7 pulsing at 1 Hz, SFX `heartbeat` every 0.9 s |
| perfect dodge (0.6 s) | saturation −0.35, `chromaticAberration` 0.004 |
| boss phase change (1 s) | `chromaticAberration` 0.004 pulse |
| player death | saturation → −1 over 1 s (reset on respawn) |

`renderer.toneMappingExposure` and `lighting.settings.*Mul` are never written by combat.

### 11.5 Named effects (`CombatFx.js`, combat-core; `ctx.fx(name, x, y, z, opts)`)

| Name | Frames / mode | Colour (HDR) | Lifetime |
| --- | --- | --- | --- |
| `slash` | `slash`, flat at y + 0.8 along the facing (`opts.flip` mirrors) | (3.0, 3.0, 2.6) | 4 frames @ 30 fps |
| `slashBig` | `slashBig`, flat | (3.2, 2.8, 2.0) | 4 @ 30 |
| `thrust` | `thrust`, flat | (3.0, 3.0, 2.8) | 3 @ 30 |
| `spin` | `spin`, flat centred on the player | (2.8, 2.6, 2.0) | 4 @ 30, twice |
| `impact` / `crit` | billboard at the hit point (y + 1.0) | (3.5, 3.2, 2.4) / (4.0, 3.2, 1.2) | 4 @ 30 |
| `dust` | billboard at the ground | (1.0, 0.95, 0.85) | 3 @ 20 |
| `stun` | billboard above the head, looping | (3.0, 2.6, 0.8) | while stunned |
| `pillar` | billboard on the player, looping | (2.4, 2.0, 0.9) | 60 f |

Pickups, projectiles and the ember wall use FxQuads handles owned by their modules. The DOM `!`
alert is WorldLabels, not FxQuads.

*Shipped values (§27.1 I1, rev. 4 §27.9 G9):* the arcs and stars are ~40 % dimmer (I1); the
`pillar` is (1.2, 1.05, 0.5) at scale 0.85 with the new option `back: 0.5` (pushed 0.5 u away from
the camera, so it stands behind the player instead of hiding them); level-up sparkles 14; an
`impact` / `crit` star on a target that stands behind the player on screen moves to the target's
head top + 0.4 u, 0.6 u aside, at scale 0.8. *(rev. 5, §27.14 X5: the pillar is (1.05, 0.82,
0.32); the level-up sparkles are `levelSparkle` at y + 1.9.)*

---

## 12. Audio (`AudioSystem.js`, `AudioDirector.js` — fx-audio-input; `CombatMusic.js` — combat-core)

### 12.1 SFX

Listed in a **new** export `COMBAT_SFX_NAMES` (frozen array; `SFX_NAMES` stays exactly today's 8
names, so `sandbox/core.js` and its audio scripts are unaffected), added to `SFX_MIN_INTERVAL`
(30–60 ms each; `hit`, `coin` 30 ms) and the `playSfx` switch, each a seeded synth of ≤ 6 nodes:

`swing, swingHeavy, hit, crit, hurt, dodge, perfect, whirl, bolt, boltHit, nova, drink, guard,
enemyAlert, windup, arrow, arrowHit, hexBurst, slimeHop, batScreech, boarSnort, boarCharge, stun,
enemyDie, bossRoar, slam, rockToss, gateClose, pickup, coin, chestOpen, waystone, levelup,
playerDown, heartbeat`.

Combat plays them through `ctx.sfx(name, x, z, opts)`: pan = clamp(NDC x of the event, −0.8, 0.8),
volume = 1 at ≤ 6 u from the player → 0 at 30 u; pitch jitter ±4 % from `hash2` of the event position and the combat frame counter (not the combat RNG,
never `Math.random`).

### 12.2 Music

```js
export const MUSIC_TRACKS = ['emberfall', 'battle', 'boss'];
audio.startMusic({ fade, track = 'emberfall' })   // additive option; the default reproduces today exactly
audio.musicTrack → string | null
audio.setMusicSection(name)                        // 'A' | 'B'; switches at the next bar; ignored by tracks without it
audio.playStinger(name)                            // 'victory' (4 bars) | 'levelup' (short arpeggio)
audio.playStinger(name, { volume, duck = 0.3 })    // rev. 5 (§27.17 M2): duck 0 ends the playing track
```

- `emberfall` is the existing song; its construction and scheduled event list are unchanged
  (verify by comparing the scheduled notes before / after).
- `battle` "Ashes on the Wind": 132 bpm, D minor, noise taiko in 8ths, staccato low saw bass
  ostinato, harp arpeggio; sections A (8 bars) + B (8 bars) looped.
- `boss` "Heart of Cinders": 140 bpm, C phrygian, sections A (phase 1) and B (phases 2–3).
- New tracks are built lazily on first use, each with its own seeded RNG, after the default song —
  the default song's RNG sequence is untouched.
- **Per-track tempo:** the music instance (`this._music`) carries its own `bpm`; `_scheduleMusic`
  reads `m.bpm` instead of `this.bpm`. The `emberfall` instance gets `m.bpm = this.bpm` (72 by
  default), so its schedule is unchanged; `battle` 132, `boss` 140.
- **Track switch:** `startMusic({ track })` while a *different* track plays no longer returns
  early: it calls the stop path on the current instance (fade = the requested fade) and starts
  the new instance with the same fade-in, so the two overlap (crossfade). Requesting the track
  that already plays is a no-op (today's behaviour). The last requested track is remembered
  (`_musicTrackWanted`) so the unlock / visibility resume (`startMusic()` without arguments) and
  `toggleMusic()` restart that track, not `emberfall`.
- `CombatMusic` rules: engaged ≥ 0.8 s → `battle` (fade 1.2 s); calm for 4 s → `emberfall`
  (fade 2.0 s); boss intro → `boss`; boss phase ≥ 2 → section B; victory → stinger then
  `emberfall` *(rev. 5, §27.17 M2: the stinger with `duck: 0` — the boss track fades out under it —
  and the level track after its last chord, 10 s)*. Nothing starts when the player turned music off (M) or `env.music === false`.
  `Game.setMusic(on)` restarts `this.combat?.musicTrack ?? 'emberfall'`.
- `AudioDirector.combatIntensity` (0..1, default 0 → unchanged): birds × (1 − 0.8·i). Combat sets
  1 while engaged, easing back over 3 s.

---

## 13. UI (`src/engine/ui/`, ui package)

### 13.1 Enabling and layering

```js
ui.enableCombat() → ui.combat   // idempotent; creates the components below; adds root class lu-root--combat
ui.combat = { hud: CombatHUD, boss: BossBar, labels: WorldLabels, announcer: Announcer, death: DeathScreen } | null
UI.useCombatUI({ CombatHUD, BossBar, WorldLabels, Announcer, DeathScreen })   // rev. 5 (§27.14 X8): register the
                                // classes once (UI.js no longer imports them); enableCombat(classes?) also takes them
```

`UI.update` calls `this.combat?.labels.update(dt, camera)` after `prompt.update(camera)`;
`UI.dispose` disposes the combat components. Nothing is created on peaceful levels.

| Component | DOM parent / z | Placement (1600 × 900) | Hidden by |
| --- | --- | --- | --- |
| `CombatHUD` vitals `.lu-vitals` | inside `.lu-hud` (z 2) | top-left under the location plate at a **fixed** place — *(rev. 11)* a `tl` group at (10, 36) art px (42–43 in CJK) under the pixel UI's place plate, whose box always has the two-line height — never moved by region name / subtitle changes or the plate's `is-empty` state, never animated | title, photo; dimmed 55 % under `lu-root--dialog`; dims to 35 % after 5 s calm at full HP / MP |
| `CombatHUD` skill bar `.lu-skills` | `.lu-hud` | bottom-right: 3 skill slots + draught slot, gold counter above (*rev. 11:* a `br` group, [PIXEL_UI.md §5](../specs/PIXEL_UI.md#5-component-recipes)) | title, photo; *(rev. 11)* dimmed to 0.55 in a dialog, hidden (`is-tight`) where the dialogue window would overlap it |
| `CombatHUD` loot feed `.lu-loot` | `.lu-hud` | right edge above the skill bar, pooled rows (8) | title, photo |
| `BossBar` `.lu-bossbar` | `.lu-hud` | bottom-centre; *(rev. 11)* a `bc` group, the bar 334 × 11 art px (narrower on a small screen), the name on a ruby-cornered cartouche, the epithet on its baseline, ember phase gems, a pale chip; while it shows the root has `lu-root--boss` (the legend steps aside) | title, photo, dialog |
| `WorldLabels` `.lu-worldfx` | root child, z 1, inserted **before** the prompt | world-anchored | title, photo, dialog |
| `Announcer` `.lu-announce` | root child, z 3 | *(rev. 11)* a `tc` group: the level card from y 48 (compact) or 78 art px, under a showing area banner (`announce(…, { y })`); own element (never replaces the Banner) | photo |
| `DeathScreen` `.lu-death` | root child, z 7 (shares the world map's slot; the map is force-closed on death) | full screen | — |

### 13.2 APIs

```js
class CombatHUD {
  constructor(hudElement, { anchor /* .lu-loc element */ })
  setVitals({ hp, hpMax, mp, mpMax, sp, spMax, level, xp, xpNext, winded })  // every frame; writes on change
  configureSkills([{ id, label, keys /* createKeycaps input */, padKeys /* e.g. 'LT+X' */,
                     icon: 'whirl'|'bolt'|'nova'|'draught' }])
  setDevice(device /* 'keyboard'|'gamepad' */)   // swaps every slot's keycaps (keys ↔ padKeys)
  setSkill(i, { cooldown /* 0..1 remaining */, seconds /* int */, locked, affordable })
  setPotions(n, max); setGold(n); setCalm(on)
  loot(text, kind /* 'gold'|'heart'|'mana'|'draught'|'upgrade'|'core' */)
  dispose()
}
class BossBar { show({ name, epithet, phases }); set(hpFrac, phase); hide(); dispose() }
class WorldLabels {
  constructor(root)
  number(x, y, z, text, kind /* 'dmg'|'crit'|'hurt'|'heal'|'mp'|'guard'|'perfect' */)
  bar(slot /* 0..31 */) → { anchor(vec3, offsetY), set(frac, { elite, level, name, pip }), show(), hide() }
                          // pip: true draws only a 4×4 px red diamond (aggroed, undamaged)
  edge(slot /* 0..7 */) → { anchor(vec3, offsetY), set({ windup }), show(), hide() }
                          // off-screen arrow clamped to the viewport border (inset 24 px), pointing at
                          // the anchor; telegraph colour, pulsing while windup is true
  alert(vec3, offsetY)          // '!' for 0.8 s following the anchor (pool 8)
  reticle(vec3 | null, offsetY)
  update(dt, camera)            // one camera.updateMatrixWorld(); cached viewport (ResizeObserver)
  clear(); dispose()
}
class Announcer { announce(title, sub = '', { duration = 2.4, kind = 'level' /* | 'results' */ } = {}) → Promise }  // queued
                // 'results': the M-window results card (rev. 11), stays for `duration`
class DeathScreen {
  show({ title, subtitle = '', prompt, armDelay = 1.0 }) → Promise<'key'|'pointer'|'gamepad'>
  hide(); get visible
}
// additive: CombatHUD.refuse(i), Announcer.clear() (§27.1 I8); rev. 4 (§27.9 G13):
// CombatHUD.onSlotPress = (i) => …   // skill slots catch the pointer; combat presses the slot's action
// Announcer.announce(title, sub, { …, compact: true })   // the card higher on the screen (a level-up mid-fight)
// WorldLabels.number(…) stacks numbers spawned at the same anchor within 0.52 s
//   (one line up, alternating 18 px left / right)
// rev. 5 (§27.14 X6 / X7): WorldLabels.setPanels(list) — the HUD panels labels keep out of;
// DeathScreen.prime({ title, subtitle, prompt }) + getter primed; HUD.locationElement / helpElement,
// CombatHUD.skillsElement
// rev. 11 (§27.23, the pixel UI and languages; all additive):
// CombatHUD.configureSkills([{ …, unlock }])   // the level a locked slot opens at ("Lv N" plate)
// CombatHUD.setSkill(i, { …, left })           // exact seconds left: one decimal under a second
// anchorGroup(el, at, x, y, w, h, sc)          // CombatHUD.js export: anchor a kept element as a pixel-UI group, then fit it
// Announcer.announce(title, sub, { …, y })     // the card's top in art px, a number or a function read when it shows
// WorldLabels.setPanels([{ el, shown, box }])  // PanelSpec.box: a keep-out box of its own (the area banner's card)
// BossBar: the root class lu-root--boss from show() until 600 ms after hide()
// WorldLabels.setPanels([{ el, shown, merge: false }])  // PanelSpec.merge false: a keep-out zone never merged (the boss bar)
// Announcer: the root class lu-root--results while a 'results' card shows (the legend stays aside)
// CombatSystem: shopOffers() rows gain label, gainLabel (the shown words; name / gain stay English);
//   wareLabel(item), displayName(enemy), upgradeText(what) — the shown name / sentence in the page's language
//   (a ware of SHOP_WARES by its id; any other ware and a named group's name as a term: term(name))
// Waystones.js: Checkpoint.place ('camp' | 'start' for the spawn point), Checkpoint.unnamed (a waystone with
//   no name), placeName(cp) — the shown place name: term(name), t('game.default.waystone') when unnamed
// the combat legend rows ({ keys, label, id }) carry a stable id; their labels arrive translated
```

- **Performance rules:** pooled elements only (numbers 40, bars 32, alerts 8, loot rows 8); write
  `translate3d` only when the rounded pixel changes; bars fill with `transform: scaleX(...)` and a
  lagging second fill; no layout reads in the frame loop; no `void offsetWidth` per hit; CSS
  animations restarted by toggling between two identical keyframe names; `will-change` set up
  front; no `filter` / `backdrop-filter` on animated layers.
*(Revision 11, §27.23: the look of the bullets below is superseded by the pixel UI after mockup G —
the sizes, faces and recipes are in [PIXEL_UI.md §5](../specs/PIXEL_UI.md#5-component-recipes), the
components in [ui.md §10](../architecture/modules/ui.md#10-combat-ui-combat-levels-only). Numbers
are set in the type roles (`big`, a crit in Jersey 10 at twice the half-size font pixel, the words
Guard / Perfect! translated in `name`) with G's eight-way outline and move in whole art pixels;
the bars, pips, alert, reticle and edge arrows are pixel art at the UI root's `--px`; the vitals,
slots, boss bar and death screen are G's. The performance rules, the behaviour and the data stay as
written.)*

- **Damage numbers:** Pixelify Sans 400 (no new font weight), 4-way 1 px dark text-shadow outline,
  rise ~24 px and fade over 0.8 s (CSS, wall clock); seeded ±12 px scatter (own `RNG(0x6d6e)`).
  Colours: `dmg` cream `#f3ead7`; `crit` gold `#f3cf7a`, ×1.5 size with a pop; `hurt` `#f08a6a`;
  `heal` `#bfe58f`; `mp` `#8fd0ff`; `guard` `#b8b2a6` (text `Guard`); `perfect` gold (text `Perfect!`).
  *(rev. 4, §27.9 G13: a 2 px 8-way outline plus a drop shadow; combat spawns enemy numbers at
  `labelY` + 0.4 u, elites + 0.3, above the bar.)*
- **Enemy bars:** pixel-art 34 × 4 px scaled by `--lu-px`; shown when damaged (4 s after the last
  hit, then fade), locked, or elite (within 20 u); gold frame + name for elites.
- **Aggro pips (occlusion cue):** every aggroed enemy within 16 u that is not showing a bar shows
  its bar slot in `pip` mode. DOM labels are not depth-occluded, so enemies behind roofs, crowns
  or the ridge stay locatable. Bars and pips share the 32-slot pool, nearest first.
- **Edge arrows:** core assigns the 8 `edge` slots to the nearest aggroed enemies within 20 u that
  are off-screen (`ctx.onScreen` false), `windup: true` while that enemy telegraphs.
- **Vitals:** `Lv N` in Cinzel; HP bar `#f08a6a` → crimson, MP `#8fd0ff` → `#4f7fd8`, thin SP bar
  `--lu-gold-hi` (flashes when winded), thin gold XP track; numbers in Pixelify.
- **Skill slots:** `.lu-panel--simple`, keycaps from `createKeycaps`, cooldown veil with `scaleY`,
  integer seconds via `nodeValue` only when the integer changes; greyed when locked / unaffordable.
- **Reticle:** pixel-art SVG (char-map like the prompt bubble), gold diamond corners,
  `shape-rendering: crispEdges`.
- **DeathScreen:** TitleScreen-like (vignette gradient, Cinzel gold title, divider, blinking
  prompt); input via a window capture-phase keydown with `stopPropagation`, pointer, and rAF
  gamepad polling; `armDelay` before accepting.

### 13.3 Other UI additions

- `HUD` `KEY_LABELS`: `Mouse0 → 'LMB'`, `Mouse1 → 'MMB'`, `Mouse2 → 'RMB'`.
- `Minimap` / `WorldMap` state: optional `enemies: {x, z}[]` drawn as red `#e0674f` dots (no
  allocation per frame); `MARKER_COLORS` gains `waystone` `#7fe3ff`, `chest` `#e8cf8a`, `boss`
  `#e0674f`. `WorldMap.setMap(map, { ..., combat: true })` shows extra legend rows (Enemy,
  Waystone, Chest) — without the flag the legend is today's. Markers are read from
  `state.markers` every draw, so combat may push into that array at runtime.
- **Chest discovery (combat-core):** a chest's minimap marker appears only once it is discovered
  — the player within 8 u, or within 12 u with `los` — or opened (checked every 0.25 s; event
  `chestFound`). Waystone and boss markers are always shown. Secret and branch-reward chests are
  not spoiled by the map.
- `TitleScreen.show({ ..., destinations, current })`: optional `destinations: [{ value, label }]`
  draws a `◂ label ▸` row under the prompt (*rev. 11:* the pixel title's chooser — a plate with ◀ ▶
  and the key hint; [ui.md §5](../architecture/modules/ui.md#5-titlescreen)).
  - **Cycling:** only ArrowLeft / ArrowRight, d-pad left / right, and clicks on the `◂` / `▸`
    glyphs (which stop propagation) change the selection. **A / D do not cycle** (they are the
    first keys many players press).
  - While the selection differs from `current`, the prompt reads `Enter / A — Travel to <label>`
    (*rev. 11:* the Enter / A keycaps and `t('title.travelTo', { label })`).
    Only confirm (Enter, Space, pad A, or a click on the label) resolves with the new destination.
    Any other key or button first resets the selection to `current` and dismisses as today.
  - Getter `title.destination` → the selected `value` at resolve time. Without `destinations`
    the title is unchanged (no row, no new key handling).

### 13.4 Level selection wiring (combat-core)

- `src/game/levels.js`: `export const SHIPPED_LEVELS = [{ value: 'emberfall', label: 'Emberfall' },
  { value: 'cinderwatch-pass', label: 'Cinderwatch Pass' }, { value: 'starfall-vale', label: 'Starfall Vale' },
  { value: 'gildhaven', label: 'Gildhaven' }, { value: 'brightwater-crossing', label: 'Brightwater Crossing' },
  { value: 'sample-hamlet', label: 'Willowmere' }]` (Gildhaven added 2026-10-02).
- `Game.showTitle` passes `destinations: SHIPPED_LEVELS, current: <slug>` only when `source`
  is `levels/<slug>.json` and the slug is in the list (not for `local:` levels). When the title
  resolves with `destination !== current` (which only a confirm on a changed selection can
  produce, §13.3), the page navigates to `?level=<destination>` (keeping other query parameters
  except `autostart`).
- `src/main.js` error screen: a third link "Play Cinderwatch Pass".

---

## 14. Level data

### 14.1 Catalog (`src/engine/level/ObjectCatalog.js`, foundation)

```js
export const ENEMY_KINDS = ['slime', 'goblin', 'archer', 'shaman', 'bat', 'boar', 'dummy', 'golem'];
export const ENEMY_INFO = Object.freeze({   // node-safe traits for editor + generators
  slime:  { label: 'Moss Slime',     flier: false, boss: false, passive: false, humanoid: false },
  goblin: { label: 'Bramble Goblin', flier: false, boss: false, passive: false, humanoid: true },
  archer: { label: 'Thorn Archer',   flier: false, boss: false, passive: false, humanoid: true },
  shaman: { label: 'Hex Shaman',     flier: false, boss: false, passive: false, humanoid: true },
  bat:    { label: 'Cinder Bat',     flier: true,  boss: false, passive: false, humanoid: false },
  boar:   { label: 'Ironhide Boar',  flier: false, boss: false, passive: false, humanoid: false },
  dummy:  { label: 'Straw Dummy',    flier: false, boss: false, passive: true,  humanoid: false },
  golem:  { label: 'Cinderheart (boss)', flier: false, boss: true, passive: false, humanoid: false },
});
export const CHEST_UPGRADES = ['none', 'maxHp', 'maxMp', 'attack'];
// OBJECT_CATEGORIES gains 'Combat' (appended last)
// NPC_SCRIPTS gains 'drillmaster' (appended)
```

Appended at the **end** of `OBJECT_TYPES` (after `region`), in this order:

```js
enemy: {
  label: 'Enemy group', category: 'Combat', placement: 'point', kind: 'actor', combat: true,
  glyph: '⚔', color: '#e0674f', radius: 0.45,
  help: 'A group of hostile creatures that turns combat on for the level. The boss (Cinderheart) needs an arena and a gate.',
  defaults: { kind: 'slime', count: 3, radius: 3, level: 1, elite: false, name: '' },
  fields: [
    { key: 'kind', label: 'Kind', type: 'select', options: ENEMY_KINDS.map((k) => ({ value: k, label: ENEMY_INFO[k].label })) },
    { key: 'count', label: 'Count', type: 'int', min: 1, max: 8 },
    { key: 'radius', label: 'Home radius', type: 'number', min: 0.5, max: 12, step: 0.1 },
    { key: 'level', label: 'Level', type: 'int', min: 1, max: 10 },
    { key: 'elite', label: 'Elite', type: 'bool' },
    { key: 'name', label: 'Name plate (optional)', type: 'text' },
  ],
},
chest: {
  label: 'Treasure chest', category: 'Combat', placement: 'point', kind: 'prop', combat: true,
  glyph: '▣', color: '#e8cf8a', radius: 0.5, rotatable: true,
  help: 'Opened with Space on a combat level; its contents pop out as pickups. On a peaceful level it is only examined.',
  defaults: { rotation: 0, gold: 20, potions: 0, upgrade: 'none' },
  fields: [ROT,
    { key: 'gold', label: 'Gold', type: 'int', min: 0, max: 500 },
    { key: 'potions', label: 'Healing Draughts', type: 'int', min: 0, max: 5 },
    { key: 'upgrade', label: 'Upgrade', type: 'select', options: CHEST_UPGRADES }],
    // rev. 4 (§27.10 P3): options are { value, label } — None / Max HP +20 / Max MP +10 / Attack +3;
    // the stored values stay the CHEST_UPGRADES strings
},
waystone: {
  label: 'Waystone (checkpoint)', category: 'Combat', placement: 'point', kind: 'prop', combat: true,
  glyph: '◆', color: '#7fe3ff', radius: 0.6,
  help: 'Walk close to attune (respawn point); Space to rest (heal, enemies return).',
  defaults: { name: 'Waystone' },
  fields: [{ key: 'name', label: 'Name', type: 'text' }],
},
```

**Optional `enemy` fields** — never in `defaults`, never written unless set, all **relative** to
the object's `x, z` (so `shiftLevelContent` and editor moves need no change):

| Field | Shape | Meaning |
| --- | --- | --- |
| `spotOffsets` | `[[dx, dz], …]` | exact start spots (first ones), like critters |
| `area` | `{ minX, maxX, minZ, maxZ }` | scatter rect instead of the radius square |
| `seed` | int | scatter seed (default `hashString('enemy:' + id)`) |
| `arena` | `{ minX, maxX, minZ, maxZ }` | boss arena rect (required for `golem`) |
| `gate` | `[dx0, dz0, dx1, dz1]` | boss gate segment on the arena boundary (required for `golem`) |

**Helpers:**

```js
export function enemyStartPoints(g, isWalkable = null) → [number, number][]
//   The critterStartPoints algorithm, copied (not refactored): count clamped 0–8 (golem: 1),
//   spotOffsets first, then a seeded scatter over area or the radius square with 6 tries onto
//   isWalkable; RNG = new RNG((Number.isFinite(g.seed) ? g.seed : hashString('enemy:' + (g.id ?? g.kind))) >>> 0).
//   Used by the game, the editor's 2D / 3D previews and both generators (fliers: callers pass an
//   isWalkable that also accepts water).
export function isCombatType(type); export function levelHasCombat(level);   // §3
// objectBounds: case 'enemy' → half extents = radius (like critters)
```

Byte stability: no existing default changes; new objects follow `createObject`'s key order (id,
type, x, z, defaults, overrides); generators pin it with `canonicalObject`.

### 14.2 Why exactly these three types

- `enemy` — without it there is no content; one object is a whole pack (count, radius, level).
- `waystone` — the checkpoint must be a visible, placed, interactable landmark with a collider.
- `chest` — authored rewards (gold, draughts, upgrades) drive exploration and progression.
- No gate / trigger / spawner types: the boss's `arena` + `gate` fields cover the only use.

### 14.3 Props (`CombatProps.js`, `Props.js`, `ObjectBuilder.js`, `LevelMap.js` — level)

| Prop | `PropFactory` method | Look | Collider | Interact | Dynamic parts / controls |
| --- | --- | --- | --- | --- | --- |
| chest | `f.chest(x, y, z, { rotation, id })` | ~0.9 × 0.6 × 0.6 u iron-banded wooden chest; rotation 0 = front facing +Z | circle r 0.45 | `{ position: front 0.8 u, radius 1.2, id }` | lid (`userData.dynamic`), `controls = { open(), opened }` (0.4 s lid animation in `update`) |
| waystone | `f.waystone(x, y, z, { id })` | ~2.2 u rune pillar on a stepped base; floating crystal above | circle r 0.5 | `{ position: stone, radius 1.5, id }` | crystal bobs and turns (`userData.dynamic`, `update`); emissive cyan crystal with a **per-instance** material (never shared, so attuning one stone does not light the others), registered through `emissives` as `{ material, day: 0.9, night: 1.6 }` — `World._registerEmissive` defaults `day` to 0, which would make the crystal dark at Cinderwatch's 16.8 h; additive glow card (`createGlowMaterial`) that reads in daylight; `controls = { setAttuned(on) }` (changes that material's `emissive` colour `#3a8fb0` → `#7fe3ff`, not `emissiveIntensity`) |

- **No light descriptors** (bloom only). Both use existing texture / material programs where
  possible (Lambert props, the flame glow card). The tour script screenshots an attuned and an
  unattuned waystone at 16.8 h to confirm the difference is visible by day.
- `ObjectBuilder.build` gains `case 'chest'` and `case 'waystone'` returning the usual
  `BuiltObject` with `interact` and `propResult` (holding `controls`), and an explicit
  `case 'enemy'` that builds nothing (enemies are spawned by combat; the case documents it).
- `LevelMap` draws a gold square for chests and a cyan diamond for waystones.
- Emberfall / Hamlet / Brightwater contain neither, so their builds are unchanged.

---

## 15. Demo level: Cinderwatch Pass

### 15.1 Identity

| Field | Value |
| --- | --- |
| file / slug | `public/levels/cinderwatch-pass.json`, `cinderwatch-pass` |
| `name` (frozen — seeds the terrain noise) | `Cinderwatch Pass` |
| `subtitle` | `Where the Old Fires Wake` |
| size | 96 × 120 (x 0–96, z 0–120; z = 0 is north / up-screen) |
| spawn | `{ x: 48.5, z: 113.5, facing: 'up' }` |
| generator | `tools/make-cinderwatch-pass.mjs` (+ `tools/lib/levelgen.mjs`) |
| environment | `timeOfDay 16.8`, **`clock: false`** (a 20-minute run would otherwise reach night after ~5.5 min; T still cycles the hour by hand), weather clear, border forest, outerScenery, godRays, dust, music; `camera { distance: 28, pitch: 34 }`; `highGround { minY: 3.4, pitch: 38 }`; `title { title: 'CINDERWATCH PASS', subtitle: 'Where the Old Fires Wake', prompt: 'Press any key', credit: 'A Luminati 2.5D action demo · three.js' }`; `titleCamera { x: 48, z: 64, y: 0.6, driftX: 4, driftZ: 3, distance: 44 }` *(rev. 4, §27.10
P4: `{ x: 78, z: 52, y: 1, driftX: 4, driftZ: 2, distance: 34 }`, over the Hollow Mire; §27.7 L4
adds `fogScale: 0.7` and `scenery.southGap: 8`)*; `godRayAreas` (glade, caldera); `foliage` flower areas (camp, glade) and shrub areas (ruins, mire edges); `forest.areas` (pine north of z 44, oak / birch south); `scenery.southGap`; **no `combat` key** (auto) |

Progress runs south → north (up-screen), so the camera always looks ahead of the player.

### 15.2 Zones

| Zone | Rect (x; z) | Ground level | Terrain and features |
| --- | --- | --- | --- |
| Waystone Camp (safe) | 30–66; 99–117 | 2 | grass `g`, dirt paths `.`, cobble square `c` around the campfire; lodge (house) at (47.5, 102.5); market stall (58.5, 104.5); 3 training dummies; palisade fence along z 98.5 from x 31 to 45 and 52 to 65 (gate x 45–52); hedge / fence corner hiding the secret chest (NE) |
| Mossy Glade | 8–88; 82–98 | 2–3 | `f` / `g` / `G` meadow; a brook (`w` / `~`, z 93–94, x 10–86) crossed by 2 bridges (x ≈ 28.5 and 48.5); flowers, petals, birds, god rays |
| The Crossroads | 38–58; 72–82 | 3 | `.` / `c` junction; waystone, signpost, lamppost, Pip |
| Bramble Ruins (west branch) | 4–42; 44–72 | base 4; archer ledges 6 (x 8–24, z 44–58) | `m` / `d` / `k` ruin floors; ruined keep (stone house) at (30.5, 50.5); goblin campfire; stairs (2 levels) from the base to the ledges; leaves |
| Cinder Ridge | 42–54; 44–72 | 9–10 (blocked `x` / `T` top) | impassable spine separating the branches; a pocket at level 6 on its west flank (x 40–44, z 57–63) reached by a stair flight from the Ruins, holding `chest_ridge` |
| Hollow Mire (east branch) | 54–92; 44–72 | 1–2 | `G` / `m` banks, still ponds `o`, ≥ 3 bridges as boardwalks, an islet (x 74–81, z 55–62) reachable only by a bridge; waterfall from the quarry lip at (79.5, 44.5) into a plunge pool `p` (the east Mire is an optional loop off the main route); mist, fireflies, teal light |
| Cinder Quarry | 4–92; 26–44 | lip 5 (z 37–44), upper terrace 6 (z 26–37) | `m` / `d` / `s` quarry floor, flat E–W runs ≥ 12 u, rock pillars (`rock` objects) as boar stun targets; the Ruins open onto the lip (1-level step); a 3-level stair flight (level 2 → 5, facing north) from the Mire at **x 56–59, z 44–47**, at the foot of Cinder Ridge's east flank; waystone, Odo, campfire; dust |
| The Caldera (boss) | 30–66; 4–26 | arena 8 (flat, x 36.5–60.5, z 8–23); rim 11 (N / E / W, blocked) | `k` / `c` stone floor with dark `m` patches; a 2-level stair flight from the upper terrace (6) to the arena at the gate (x 46–51, z 23–25); 4 brazier campfires; embers, smoke, god rays; **nothing tall south of the arena** |
| Border | outside the zones | — | `T` ring with deep-forest blobs (like Starfall), open meadow south of the camp (`scenery.southGap`) |

*Shipped zones (§27.7 L2, rev. 4 §27.10 P5):* the glade brook uses the custom char `e` and
meanders ±1.5 u (straight on rows 93–94 only under its two bridges) between sand and reed banks;
the Ruins gain a **north rampart** (row z 44, x 3–31, blocked, level 8–9), so the archer ledge is
z 45–57 and the ledge archers and the quarry's west pack cannot see each other; Cinder Ridge is
blocked rock 4–11 — one wandering shelf per flank (Ruins side 6, Mire side 4, lip end 7,
crossroads end 5) under a broken crest of 9–11, no pines north of z 51; the Mire → quarry stair is
x 56–58 on rows z 44–46; the quarry has the dressed-stone char `q` (cut faces at x 4–21 and 74–91
on rows 26–28, stacked blocks on the lip), a spoil heap one level up and no scatter under the
caldera's south cliff; the caldera keeps embers only (the brazier campfires make their own smoke).

### 15.3 Combat objects (explicit ids)

**Enemy groups** (54 hostile + boss + 3 dummies; *rev. 12, §27.24 Q2:* counts and levels for the
player with three companions, [Party balance](../specs/PARTY.md#9-the-demo-the-companions-of-cinderwatch-pass)):

| id | kind | count | level | x, z | radius | extra |
| --- | --- | --- | --- | --- | --- | --- |
| `dummies` | dummy | 3 | 1 | 40.5, 106.5 | 2 | `spotOffsets [[-2.5,0],[0,0],[2.5,0]]` |
| `glade_slimes_w` | slime | 4 | 2 | 26.5, 90.5 | 3 | |
| `glade_slimes_n` | slime | 5 | 2 | 40.5, 87.5 | 3.5 | |
| `glade_slimes_e` | slime | 4 | 2 | 70.5, 90.5 | 3 | |
| `glade_goblins` | goblin | 3 | 2 | 60.5, 86.5 | 2.5 | |
| `ruins_gate_goblins` | goblin | 3 | 7 | 30.5, 69.5 | 2.5 | |
| `ruins_slimes` | slime | 2 | 7 | 36.5, 62.5 | 2 | |
| `ruins_court` | goblin | 3 | 8 | 25.5, 58.5 | 2.5 | |
| `ruins_shaman` | shaman | 1 | 8 | 21.5, 60.5 | 1.5 | |
| `ruins_archers_w` | archer | 2 | 7 | 12.5, 54.5 | 2 | on the level-6 ledge |
| `ruins_archers_n` | archer | 2 | 8 | 19.5, 47.5 | 2 | on the level-6 ledge |
| `mire_bats_s` | bat | 3 | 6 | 66.5, 69.5 | 3 | |
| `mire_slimes` | slime | 3 | 6 | 61.5, 61.5 | 2.5 | |
| `mire_bats_islet` | bat | 3 | 7 | 77.5, 58.5 | 3 | |
| `mire_bats_n` | bat | 3 | 7 | 69.5, 50.5 | 3 | |
| `mire_shaman` | shaman | 1 | 7 | 84.5, 65.5 | 1.5 | |
| `mire_goblins` | goblin | 2 | 7 | 60.5, 53.5 | 2.5 | guards the foot of the Mire → quarry stair |
| `quarry_boar_w` | boar | 1 | 8 | 20.5, 40.5 | 1.5 | |
| `quarry_boar_e` | boar | 1 | 8 | 76.5, 40.5 | 1.5 | |
| `quarry_boar_elite` | boar | 1 | 8 | 55.5, 32.5 | 1.5 | `elite: true`, `name: 'Old Ironhide'`; on the terrace east of the arena stair, ≥ 6 u clear of the arena (rule 17) |
| `quarry_goblins` | goblin | 3 | 8 | 28.5, 31.5 | 2.5 | |
| `quarry_archers` | archer | 2 | 8 | 68.5, 30.5 | 2 | on the terrace (level 6) above the lip (level 5) |
| `quarry_bats` | bat | 2 | 8 | 34.5, 34.5 | 2.5 | |
| `cinderheart` | golem | 1 | 6 | 48.5, 14.5 | 1 | `name: 'Cinderheart'`, `arena { minX: -12, maxX: 12, minZ: -6.5, maxZ: 8.5 }`, `gate [-2.5, 8.5, 2.5, 8.5]` |

*(rev. 12, §27.24 Q2: the solo table before it had 49 hostile foes — the glade's slimes 3 / 4 / 3
and goblins 2 at Lv 1, the Ruins at Lv 2–3 with two court goblins, the Mire at Lv 2–3, the quarry
at Lv 4. The glade is fought by three (Rook and Ilse join at the camp), the rest by four (Sela at
the Crossroads); the Ruins stay the harder branch (Lv 7–8), the Mire the gentler (Lv 6–7). Ids,
kinds, positions and radii are unchanged; Cinderheart's level stays 6 (display only), its HP is
5200, §7.1.)*

**Waystones:** `waystone_camp` (53.5, 107.5) `Camp Waystone`; `waystone_crossroads` (48.5, 77.5)
`Crossroads Waystone`; `waystone_quarry` (48.5, 42.5) `Quarry Waystone`.

**Chests:** `chest_camp_secret` (63.5, 101.5) gold 40 · `chest_glade` (15.5, 86.5) gold 20,
potions 1 · `chest_ruins_ledge` (10.5, 50.5) upgrade `attack` · `chest_ridge` (42.5, 60.5)
gold 30, potions 1 · `chest_mire_islet` (78.5, 60.5) upgrade `maxHp` · `chest_quarry` (84.5, 30.5)
gold 30, potions 1, upgrade `maxMp`.

Branch balance: the Ruins give ATK +3 (ledge chest) + the ridge pocket's gold and draught, ≈ 189
XP; the Mire gives max HP +20 (islet chest), ≈ 189 XP (with `mire_goblins`); both reach the
quarry chest's max MP +10. *(rev. 12, §27.24 Q2: the Ruins give 395 XP, the Mire 321 — the
Ruins are the harder branch.)*

**NPCs:** `maren` "Captain Maren" (swordsman, post, `script: 'drillmaster'`, (43.5, 109.5), 2
fallback pages; post-victory pages from the script, §6.12) · `bram` "Bram" (merchant, post,
`action: 'shop'`, `item: 'Healing Draught'`, at the stall) · `ilse` "Sister Ilse" (cleric,
wander, (50.5, 111.5), 3 pages on waystones) · `pip` "Pip" (hunter, post, (51.5, 75.5), 3 pages
naming what each branch offers: "west, the ruins — archers on the walls, and a blade-smith's
cache on the ledge; east, the mire — bats over the water, and something that hardens the heart
on the islet") · `odo` "Odo" (guard, post, (44.5, 42.5), 3 pages: bait the charge into a
brazier; roll *through* the rings, toward it; the magma burns while you stand in it).
*(additive, 2026-10-08 — the party demo, [PARTY.md §9](../specs/PARTY.md#9-the-demo-the-companions-of-cinderwatch-pass):)*
`sela` "Sela" (guard with `spec` overrides — bare-headed, the spear —, post, (50.8, 78.1) by the
Crossroads Waystone, a `talk` script: she joins the party, `party join sela as warden balanced`)
and two background story events, `ev_sela_lip` (the quarry lip, x 3–93, z 37–44: *Guard Me*) and
`ev_sela_caldera` (the caldera stair, x 45.5–51.5, z 23.2–27: *Support*), both `if: party:sela`,
`once`. The level thereby has a story (`levelHasStory`: the story runtime, the journal key B);
the fixed-step bot's digest is unchanged.
*(rev. 12, §27.24 Q1 — three companions, the party the enemies are balanced for:)* `ilse` "Sister
Ilse" is now `post`, facing down, `title: 'Keeper of the Waystones'`, with a `talk` script: her
three pages on waystones, then an offer, `party join ilse as mystic support` (the party's healer:
the cleric's staff makes her a mystic); her 3 `dialogue` pages stay as the plain fallback. `rook`
"Rook" is new (hunter with `spec` overrides — an ember-red hood with a gold feather tuft, a
leather tunic, Sela's short charcoal cape —, post, facing right, (40.5, 112.5) south of the
sparring yard, `title: 'Scout of the Cinderwatch'`, 2 fallback pages, a `talk` script:
`party join rook as ranger balanced` — his bow makes him a ranger). Both talk scripts follow
Sela's: as a member *Tactics…* (`party menu`), *Part ways* (asked twice: `party leave`, `home`)
and *Lead on*; a full party (`if party >= 3`) hears no offer — Sela's included. Sela's join line
has two forms (`if party = 1`: "Then it's the two of us…", else "Then the watch marches with
you…"). Two more background events: `ev_rook_ruins` (the Bramble Ruins inside their outer wall,
x 4–41, z 44–71.5, `if: party:rook`: a bark and `party rule rook hunter`, *Hunt Casters*) and
`ev_ilse_caldera` (the caldera stair, `if: party:ilse`: a bark); `ev_sela_caldera` now runs
`if: party:sela and not party:ilse` (Sela turns to *Support* only when Ilse is not there to heal).
The level has 7 villagers, 4 events and 283 objects; Ilse, Rook and Sela fill the party (at most 3
companions, PARTY.md).

**Light descriptors — exactly 12 (static mode):** `campfire_camp` (47.5, 109.5),
`lamppost_camp_w` (43.5, 103.5), `lamppost_camp_e` (55.5, 112.5), `lamppost_crossroads`
(45.5, 75.5), `campfire_ruins` (28.5, 63.5), `torch_keep` (wallTorch on the keep's south wall),
`light_mire` (71.5, 63.5, colour `#6fe0d0`, nightOnly false), `campfire_quarry` (52.5, 41.5),
`brazier_nw` (38.5, 9.5), `brazier_ne` (58.5, 9.5), `brazier_sw` (38.5, 21.5), `brazier_se`
(58.5, 21.5) (campfires).

**Other:** emitters — petals and leaves (glade), fireflies (camp), leaves (ruins), mist + fireflies
(mire), dust (quarry), embers + smoke (caldera); critters — chickens ×4 and a cat in the camp,
birds ×3 in the glade; signposts at the camp gate, the crossroads and the quarry stair; the
waterfall `fall_mire`; bridges (2 brook, ≥ 3 mire).

**Regions** (explicit ids, smallest first — first match wins): `region_caldera` "The Caldera"
(x 30–66, z 4–27, no banner) · `region_camp` "Waystone Camp" · `region_crossroads` "The
Crossroads" · `region_ridge` "Cinder Ridge" · `region_glade` "Mossy Glade" · `region_ruins`
"Bramble Ruins" · `region_mire` "Hollow Mire" · `region_quarry` "Cinder Quarry" · `region_pass`
"Cinderwatch Pass" (whole map). Banners on camp, glade, ruins, mire and quarry, each naming the
danger (e.g. `Slimes and goblins · Lv 1`). *(rev. 12, §27.24 Q2 / Q3: `Slimes and goblins · Lv 2`,
`Goblins, archers and a shaman · Lv 7–8`, `Bats, slimes and a shaman · Lv 6–7`,
`Ironhide boars and archers · Lv 8`; the camp's `Straw dummies and a warm fire · Safe` is
unchanged. Rule 16 checks each level range against the packs.)*

XP pacing (§6.1, per-enemy XP rounded): the glade gives 84 XP (→ Lv 2), either branch 189
(273 cumulative → Lv 3), the quarry 370 (643 → Lv 5, Radiant Nova learned on the way at 295);
doing both branches gives 832, still Lv 5. The player meets Cinderheart at Lv 5 either way. The
fight's length is checked by the greedy run of §8.3 (target ≈ 90–120 s for a real player).
*(rev. 12, §27.24 Q2: the whole glade gives 149 XP (→ Lv 3), the Ruins 395 (544 → Lv 4) or the
Mire 321 (470 → Lv 4), the quarry 581 (1125 / 1051 → Lv 6); both branches 1446, still Lv 6;
Cinderheart 400. The player meets Cinderheart at Lv 6 either way. The play-through bot on the
Ruins route — the glade's north and west packs only — is Lv 2 after the glade, Lv 4 after the
branch, Lv 6 after the quarry, and ends at Lv 6 with 483 XP into it.)*

**Positions** are the design; the generator may move a combat object, NPC or chest by **≤ 3 u**
only when a validation rule requires it (and prints the move). Anything larger goes back to the
lead.

*Shipped moves (§27.7 L1, rev. 4 §27.10 P6):* `glade_slimes_n` (38.5, 88.5) and
`quarry_boar_elite` (56.5, 32.5), radius 1, `spotOffsets [[0, 0]]` (rule 5, the waystone-rest
test); `ruins_archers_n` (19.5, 48.5) (rule 14); the braziers z 10.5 / 20.5 (rule 9); `fall_mire`
(79.5, 44) (rule 13). `light_mire` stands at (72.3, 63.6), colour `#4fc4dc`, intensity 4.5, range
9, 2.4 u up, flicker 0.35, `nightOnly: false`, over a mossy standing stone with a small teal
`fireflies` wisp emitter shown day and night; the caldera's emitters are embers only.
*(rev. 5, §27.15 K4 / K6, §27.19 W4: `ruins_archers_n` (19.5, 49.5) (rule 20); the lodge (46.5,
104.75), 4 × 3 without a chimney, `lamppost_camp_w` (43, 105.5), `campfire_camp` (47.5, 110), the
keep (30.5, 53) 5 × 3.5 with `torch_keep` (29, 54.87) (rule 13); two more teal `fireflies` emitters
on the marsh light; Bram and Odo run the `shopkeeper` script.)*

### 15.4 Generator structure (`tools/make-cinderwatch-pass.mjs`)

- Arguments: `--out=<file>`, `--check` (write nothing; exit 1 unless the output matches the file
  byte for byte), `--force` (write even if validation fails, still exit 1), `--ascii`, `--quiet`.
- `tools/lib/levelgen.mjs` holds **copies** of Starfall's helpers, parametrised by a grid object:
  grid arrays (tiles, levels, zone, locked, pathMask), `set / rect / blob / polyline / smoothSteps /
  wob`, `path_`, `flight`, `pad`, `border`, `add / reserve / collidersOf / blockedAt / keepClear`,
  the quarter-unit walk BFS and route Dijkstra, the crown / roof occlusion model,
  `normalizedChanges`, `canonicalObject`. `collidersOf` has `chest` (circle r 0.45) and
  `waystone` (circle r 0.5) cases. **Starfall is not refactored onto it** in this change.
- Passes: relief → water → paths → stairs → ground → border → zones (camp, glade, crossroads,
  ruins, ridge, mire, quarry, caldera) → people → combat objects → sightlines →
  `scatterTrees` / `scatterRocks` with `RNG('cinderwatch:trees')` / `RNG('cinderwatch:rocks')` →
  `clearCrowns` → regions → environment → normalise → validate → coverage → round trip → write.
  *(rev. 5, §27.15 K3: `ridgeRock()` between `clearCrowns` and regions puts the crag legend char
  `r` on the ridge's rock tiles.)*
- Only `RNG` / `hash2` / `fbm2` / `hashString`; no `Math.random`, no Date.

### 15.5 `validate()` (all must pass; failures list the offending ids)

1. `normalizeLevel` zero warnings; `validateLevel` no errors; `normalizedChanges` empty;
   `serializeLevel(normalizeLevel(parse(out)))` byte-identical to `out`.
2. Walk BFS from the spawn with the game's rules (Starfall's model): no unreachable walkable
   pocket (the ridge top is blocked tiles).
3. Routes (≤ 1.5 × straight line + 3 each): spawn → `waystone_crossroads`; crossroads →
   `waystone_quarry` with the Mire region forbidden (via the Ruins) **and** with the Ruins region
   forbidden (via the Mire); `waystone_quarry` → the arena centre through the gate. (Crossroads →
   quarry is 35 u straight, limit 55.5 u; design estimates: via the Ruins ≈ 47 u, via the Mire
   ≈ 48 u using the ridge-flank stair at x 56–59 — which is why the stair sits there and not in
   the east Mire.)
4. Every `enemyStartPoints` spot of a ground kind is standable and reachable; flier spots lie in
   the map on walkable or water tiles, each within 8 u of reachable ground.
5. Every non-dummy enemy home is ≥ 20 u from the spawn, ≥ 12 u from every waystone and ≥ 12 u
   from every NPC.
6. Each ground group's home disc (radius + 2) is ≥ 70 % walkable.
7. Each boar home has ≥ 2 of 8 directions with ≥ 8 u of straight, walkable, same-level ground.
8. Each archer home has LOS by the **projectile height model of §7.6** (release at its ground +
   0.9, aim at the target ground + 0.9, blocked where the ground exceeds the path − 0.1) to
   reachable ground 5–9 u away in ≥ 3 of 8 directions; for ledge archers at least one of those
   targets lies on the floor below the ledge.
9. Arena: one height level over the arena rect, ≥ 95 % walkable; every walkable boundary tile
   either lies within 1 u of the gate segment or differs by ≥ 2 levels from its outside
   neighbour; no other enemy group inside it; the boss home lies inside it. **Visibility:** at
   camera yaws −60°, 0° and +60° (the level's camera pitch), every point of the arena rect inset
   1 u on a 1 u grid is visible — a 2-u figure there is covered ≤ 25 % by tree crowns, roofs or
   terrain (the rim) along the view ray. In practice: nothing tall inside the ±60° wedge south of
   the arena, and the E / W rims step up through a 1-tile level-9 ledge before the level-11 rim.
   The four braziers stand ≥ 2 u inside the arena edges (charge-stun targets, §8.2).
10. Chests: the point 0.8 u in front (by rotation) is standable and reachable; chest and waystone
    tiles flat and dry.
11. ≥ 3 waystones, all reachable; `waystone_camp` within 10 u of the spawn.
12. Light descriptors (the Inspector's `countLights` rule) ≤ 12.
13. Starfall's prop rules: props on flat dry ground, no collider overlaps, doors clear, stairs
    directions, waterfall drop, bridges bank to bank. *(rev. 5, §27.15 K5: also no walker behind a
    roof above the knee on a path tile, and no wall or cliff hiding one to the waist at a path
    tile's centre — an error, not a printed share.)*
14. **Occlusion at every camera yaw:** for every non-dummy group, sample its home disc
    (radius + 3) on a 1 u grid; at yaws −60°, 0° and +60° a 2-u figure at a sample may be covered
    > 25 % by crowns, roofs or terrain (the `clearCrowns` crown / roof model plus the height grid)
    at no more than 15 % of the samples. (The DOM aggro pips of §13.2 cover the rest of the leash
    area.)
15. Density: ≤ 30 non-dummy enemy start points inside any disc of radius 28 u (centres on a
    2 u grid). *(rev. 12, §27.24 Q2: the peak is now exactly 30, at (56, 70) by the Crossroads —
    why the party-of-four table adds foes only to the glade and the Ruins court and carries the
    rest in levels.)*
16. Regions: all 9 exist with their ids; banners as listed. *(rev. 12, §27.24 Q3: a banner's
    `· Lv a–b` (or `· Lv a`) must be the level range of the hostile groups — not the dummies or
    the boss — at home in its zone, the first region holding the home, as in the game.)*
17. **Arena buffer:** every non-boss group's home disc (radius + 2) is ≥ 6 u from every boss arena
    rect, and every flier group's clamp rect (home ± (radius + 8)) does not intersect it. (The
    runtime exclusion of §7.6 keeps chasers out; this rule keeps them from pressing against it.)
18. **Readability of slimes:** no `foliage.flowerAreas` rect overlaps a slime group's home disc
    (radius + 1).
19. *(rev. 4, §27.10 P7)* **Zone separation:** for two hostile groups whose homes lie in different
    regions (first match, `region_pass` excluded), a player standing on reachable ground within
    1.5 u of one group's start spots (3 u for fliers) must not wake the other group — its spots
    and 8 points at 0.7 × its radius round each — by the rule-5 sight test (within 3 u, or within
    the aggro range with line of sight by the projectile model, at a height difference < 1.5).
    The generator imports `ENEMY_DEFS` from `src/game/combat/defs.js` (pure data) for it.
20. *(rev. 5, §27.15 K5)* **Chase and group-wake margins:** (a) no roaming member of a pack of
    another region within 6 u in line of sight of a roaming member (the group wake); (b) the
    fight ring of rule 19 plus a walked 3 u drift (walls and cliffs stop it) stays out of another
    region pack's sight aggro. Accepted conflicts (`RULE20_ACCEPTED`) are printed as warnings.

*Rev. 4 amendments (§27.7 L3, §27.10 P7):* rule 2 flags unreachable pockets from **1 u²** (16
quarter-unit nodes); rule 4 also requires each group's spots to be identical under a plain tile
test and the standable test; rule 5 also requires that a player **resting at a waystone**
(reachable ground within 2.5 u of it) wakes no pack — no member at its spot or anywhere in its
home radius is within 3 u, or within its aggro range with line of sight, at a height difference
< 1.5; rules 9 and 14 use the pitch the game uses at the spot and model the border forest; rule
13 and `clearCrowns` test chests and waystones at yaw −60 / 0 / +60 (roofs and crowns) and keep a
walker on the two roads along the ridge ≤ 50 % covered at yaw ±60.

### 15.6 `coverage()`

Every `OBJECT_TYPES` type with `combat: true` placed at least once; every `ENEMY_KINDS` kind in
≥ 1 group; exactly one `golem` group with `arena` and `gate`; ≥ 1 elite; every `CHEST_UPGRADES`
value except `none` on some chest plus ≥ 1 gold-only chest; ≥ 3 waystones; an NPC with
`script: 'drillmaster'` and one with `action: 'shop'`, `item: 'Healing Draught'` *(rev. 5: and a
`shopkeeper` NPC at the camp and at the Quarry Waystone)*; emitters
include mist, fireflies, embers, smoke, dust, leaves, petals; ≥ 1 waterfall, ≥ 3 bridges; the
environment keys of §15.1 present, `environment.clock === false` and `environment.combat` absent.
*(additive, 2026-10-08:)* a villager whose talk script holds `party join` and `party menu`, and a
background event with `party rule` (the party demo, PARTY.md §9); the story's checks
(`StoryChecks.storyIssues`) pass before the level is written. *(rev. 12, §27.24 Q3:)* the full
party of four the enemies are balanced for — a villager who joins as a warden, one as a ranger
and one as a mystic (`party join … as <class>` in its talk script; Sela, Rook, Ilse).

**Coupling rule (see [AGENTS.md](../../AGENTS.md) and TASK_PLAYBOOKS §0):** a new `OBJECT_TYPES` type with
`combat: true`, a new `ENEMY_KINDS` value or a new `CHEST_UPGRADES` value makes
`make-cinderwatch-pass.mjs` fail its `coverage()` until placed there; every other new
`OBJECT_TYPES` type must still be placed in Starfall as today.

### 15.7 Reachability

`game.html?level=cinderwatch-pass`, the title-screen destination row (§13.4), the error-screen
link, `editor.html?open=cinderwatch-pass`, the launcher's Play and Edit links (`index.html`).

---

## 16. Starfall Vale coverage change

### 16.1 What the generator does

- `tools/make-starfall-vale.mjs` changes **one line** of `coverage()`: the check
  `'every OBJECT_TYPES type'` becomes `'every non-combat OBJECT_TYPES type'` and tests
  `Object.keys(OBJECT_TYPES).filter((t) => !OBJECT_TYPES[t].combat)` (the KNOWN_ISSUES LVL-01
  remedy). Nothing else in the generator changes; `NPC_SCRIPTS` is not checked by Starfall, so the
  new `'drillmaster'` script needs nothing.
- Cinderwatch's `coverage()` owns the combat types (§15.6).

### 16.2 Effect

- `public/levels/starfall-vale.json` is **byte-identical** (verify:
  `node tools/make-starfall-vale.mjs --out=<scratch>.json` and `cmp` against the committed file;
  `git diff public/levels` empty). Starfall stays peaceful: no combat HUD, traveler sheet
  unchanged, pad X / Y still zoom, RS still takes photos, 59 programs.
- Docs: `docs/design/levels/starfall-vale.md` ("keep coverage green" now says "every non-combat
  object type") and TASK_PLAYBOOKS §0 / §1 (the coupling rule of §15.6).
- **Not planned — a later opt-in** (the lead's call, a separate change): if Starfall should one day
  carry a camp, it must sit ≥ 60 u from the spawn (70.5, 121.5) and outside every `view()`
  sightline (e.g. deep Emberwood or the Old Quarry — not Bramble Hollow, which is only ~35–45 u
  away and a stargazing picnic spot), every spot must have crown cover < 0.25, it needs a guard
  NPC with the `drillmaster` script (Starfall has no tutorial), and it re-baselines Starfall's
  fingerprint (≈ +4 programs; the traveler gains a sword; pad X / Y become attack / draught).

---

## 17. Editor support (editor package)

Free from the catalog: palette section `Combat`, inspector fields, undo, copy / paste, outliner,
serialisation, prop 3D preview and ghost for `chest` / `waystone`, 2D default boxes.

| File | Change |
| --- | --- |
| `viewport3d/ActorPreview.js` | `_create` case `enemy` → `_createEnemy`: one Sprite3D per `enemyStartPoints` spot (sheet from `createEnemySheet(kind)` cached via `_sheet('enemy:' + kind, …)`, `_makeSprite` path: shadow-only + `registerEmissive`), bats hovered (`mesh.position.y`), a red home ring (`drapedCircle`, radius), the boss `arena` as a dashed `drapedRect` and the gate as a line; `_place` case; `enemy` treated like `npc` / `critters` in `_shown`, `_applyVisibility` and `update` (idle animation). Sprites use the plain lit program (no `combatFx` in the editor). |
| `viewport3d/Ghost.js` | `case 'enemy'`: translucent enemy sprite; sheet via a new `enemySheet(kind)` callback |
| `viewport3d/Viewport3D.js` | pass `enemySheet` to Ghost / ActorPreview |
| `viewport3d/Overlays.js` | selected enemy: home ring + name / kind label; boss arena + gate outline |
| `map2d/Map2DView.js` | `LAYER.enemy = 7`; `enemy` in `AREA_TYPES` and `_visible` (markers toggle); `_drawObject` case: red ring (radius), `⚔` glyph, label `slime ×3 · Lv1` (elite gold, boss arena rect + gate line); `_outline` branch |
| `tools/SelectTool.js` | `enemy` in the `idsInBox` area list |
| `tools/common.js` | nothing (enemies have no facing) — listed so nobody else edits it. *(rev. 4, §27.11 D6: `shownOnMap`; `rotateSelection` turns an enemy group's relative `arena`, `gate`, `area` and `spotOffsets` in exact quarter turns.)* |
| `ui/Inspector.js` | level stats: `Enemies n (groups g) · Waystones n · Chests n` when any exist |
| `ui/dialogs.js` | level settings: `Combat: Auto / On / Off`; writes `environment.combat` only when not Auto and removes it when set back to Auto (the minimap pattern) |
| `EditorApp.js` | `_softWarnings`: combat level without a waystone; enemy start spot not walkable; non-dummy enemy home within 12 u of the spawn; `golem` without `arena` / `gate`; more than one `golem`; a non-boss enemy home disc (radius + 2) within 6 u of a boss arena; `combat: false` with enemies placed. The existing "no villagers" warning is unchanged. |

*Rev. 4 (§27.11 D5 / D6):* the shared enemy-group helpers live in a new module
`src/editor/enemyGroups.js`; start spots in the 3D preview and — while the 3D view is shown — the
2D dots use the game's exact start test (bridge decks over water, prop and villager colliders);
only the boss kind's `arena` / `gate` are drawn and handled; two more soft warnings (a gate end
more than 0.5 u off the arena boundary, an arena left on a non-boss group).

Play-test needs no change (it runs the real game path; the `__playtest__` level auto-enables
combat). Editor draw cost: enemy previews ≈ 2–3 calls each (accepted; the Objects visibility
toggle hides them). *(rev. 5, §27.16 D7–D10: ≈ 0.3 calls per sprite through an instanced batch; a
boss group's Count capped at 1 in the Inspector; exact start dots in every layout; graded 2D hits.)* The user-facing text for the `Combat: Auto / On / Off` setting in
`docs/contracts/LEVEL_EDITOR.md` is written by the level package from this section (it owns that
file); the editor package documents the dialog in `EDITOR.md` and `LEVEL_EDITOR_GUIDE.md`.

---

## 18. Performance budgets

**Draw calls** (scene incl. shadow pass, 1600 × 900, busiest Cinderwatch view, zoom 42, yaw ±60°):

| Item | Calls | Cap / rule |
| --- | --- | --- |
| level baseline at a combat spot (enemies hidden) | ≤ 200 | verified per zone by the tour script |
| visible enemies (shadow-only proxy + mesh; bats 1) | ≤ 60 | ≤ 30 visible |
| boss | 2 | caldera only |
| player (mesh, shadow, silhouette) | 3 | — |
| BlobBatch (all blobs) | 1 | capacity 256 |
| FxQuads | 1 | 256 instances; invisible at 0 |
| GroundMarkers | 1 | 48 instances × 1 152 triangles (draped grid); invisible at 0 |
| active burst pools | ≤ 4 | `footstep`, `splash`, `sparkle` + the one streak pool (§11.3); ≤ 200 live particles per pool |
| DOM (numbers, bars, pips, edge arrows, HUD) | 0 | pools of §13.2 |
| **worst case** | **≈ 272** | **≤ 300** |

- **Programs:** combat levels add ≈ 3–5 (`lit-fx-v1`, `fxquads-v1`, `groundmarkers-v1`, the
  additive-streak burst pool if its program is new). The count after `endWarmup()` must
  equal the count after a full scripted fight (every attack, skill, enemy, projectile, marker,
  pickup, boss phase, death and respawn, level-up).
- **CPU:** `combat.update + afterPlayer` ≤ 1.0 ms p95 with 30 active enemies (30 `tm.move` ≈
  0.15 ms measured); DOM writes ≤ 0.3 ms; no per-frame allocation in steady state (reused
  vectors, preallocated hit queues, pooled DOM, override-free bursts).
- **Lights:** no runtime lights; Cinderwatch has 12 static descriptors; Starfall is unchanged.
- **Colliders:** none added or removed at runtime (enemies have none; chests / waystones are
  static props built at load).
- **Load:** sheets + atlas ≤ 150 ms; marker height texture ≤ 40 ms; Cinderwatch total load ≤ 6 s
  under the historical desktop benchmark conditions in
  [PERFORMANCE.md](../architecture/PERFORMANCE.md#2-measurements). Re-measure for the target
  browser and hardware. *(rev. 5, §27.14 X1: the height texture bakes in ≤ 6 ms slices, never
  a long task; §27.13 R1: the walk grid ≈ 20 ms at load.)*
- *(rev. 5, §27.13 R1)* **Path searches:** ≤ 2 per combat sub-step (`NAV_SEARCHES`), each ≤ 6000
  expanded cells (≈ 1.5 ms warm for the longest), allocation-free; ≤ 3 sub-steps after a hitch give
  a theoretical worst case of ≈ 9 ms in that frame. Measured on Cinderwatch: 0.01–0.4 ms per search.
- *(rev. 5, §27.13 R10)* **Download:** peaceful levels fetch no combat chunk (the combat UI, FX
  batches and sheet painters load with `CombatSystem`).

---

## 19. Warm-up list (`combat.warmup(far)` before `await this._compileScene()`)

1. `load()` already painted every enemy sheet, the player combat sheet and the FX atlas and built
   the markers' height texture; call `renderer.initTexture(texture)` for each.
2. Every enemy, boss and add sprite is in the scene (adds hidden with `opacity = 0`; three r186
   `compile` traverses hidden meshes; the sprite depth key is the existing one).
3. `FxQuads` and `GroundMarkers`: one instance each at `far` (y −1000), objects in the scene,
   `frustumCulled = false`, kept through the 5 `WARM_FRAMES`, freed in `endWarmup()`.
4. `particles.burst(p, far, 1)` once for each of `hitSpark, emberBurst, deathPoof, gooPoof,
   healGlow, magicBurst, sparkle, splash, footstep` (prime even where the level has no waterfall)
   *(rev. 5, §27.14 X3: and `victoryEmbers, victorySparkle, levelSparkle`)*.
5. `ui.enableCombat()` done in `load()` (DOM pools exist before the first hit).
6. `endWarmup()` records `programsAtLoad = renderer.info.programs.length`; in dev builds
   (`import.meta.env.DEV`) a growth during play logs one `console.warn('[combat] program compiled
   mid-game: …')`.

---

## 20. Automation

### 20.1 `window.__game.combat` (combat levels only; `hooks` of §9.1)

| Hook | Effect |
| --- | --- |
| `state()` | `CombatState` (§20.2) |
| `seed(n)` | combat RNG = `new RNG(n >>> 0)`; every enemy's `e.rng = new RNG((hashString(uid) ^ n) >>> 0)`; the loot seed input (§7.8) becomes `n`; the WorldLabels scatter RNG is untouched (visual only) |
| `reset()` | full reset to a reproducible state: player Lv 1 defaults at full HP / MP / SP, gold 0, draughts 3, action null, combo 0, cooldowns 0, lock released; all enemies home / full HP / full poise / alive / idle / not aggro, `deathCount` 0, tokens returned (budgets full), boss reset (phase 1, dormant, adds hidden, arena open, not defeated); projectiles, markers, pickups, FX handles and edge arrows cleared; hit-stop, time scales, slow motion, look offsets, perfect-dodge cooldown, winded state, input buffer, virtual queue, resume and respawn guards cleared; counters `kills`, `deaths`, `perfectDodges` 0; tutorial flags false; combat time and frame 0; `engaged` false, music back to the level track; every RNG re-created from the current seed (the last `seed(n)`, default `hashString(level.name)`), so `seed(n); reset()` and `reset(); seed(n)` give the same state. Chests stay as they are. |
| `step(n = 1, dt = 1/60)` | `engine.stop()`, `n × engine.step(dt)`, restart the loop if it was running; returns `state()` |
| `stepUntil(pred, maxFrames = 600, dt = 1/60)` *(rev. 5, §27.13 R7)* | steps until `pred(hooks)` holds; returns the frames stepped, −1 if it never did |
| `press(action, frames = 1)` / `hold(action, frames)` | virtual edge / held action in `CombatInput` (`attack, dodge, skill1–3, draught, lock`); obeys the resume / respawn guards like real input |
| `move(x, z)` / `move(null)` | `player.moveOverride` (world-space vector) |
| `aim(x, z)` / `aim(null)` | aim-point override (like the mouse) |
| `place(uid, x, z)`, `wake(uid \| 'all')`, `kill(uid \| 'all')`, `damage(uid, n)` | test control of enemies |
| `damagePlayer(n)`, `setPlayer({ hp, mp, sp, level, xp, gold, potions })`, `god(on)`, `freezeAI(on)` | test control of the player / AI *(rev. 5, §27.19 W2: `setPlayer({ upgrades })`)* |
| `bossPhase(n)`, `setBossHp(frac)` | jump the boss |
| `boss.force(move \| null)`, `boss.info()`, `boss.hazards(type?)` *(rev. 5, §27.13 R7)* | force the boss's next move; its state; its live delayed hazards |
| `path(x0, z0, x1, z1, maxU = 80)` *(rev. 5, §27.13 R7)* | a path on the walk grid (`[[x, z], …]` or `null`) |
| `checkpoint(id)`, `rest(id?)`, `respawn()` | attune / rest / run the death reset instantly (no screen) |
| `showcase()` | fire every named effect, marker shape / style, projectile kind, pickup kind, burst preset and combat SFX once near the player |
| `enemies()` | `[{ uid, kind, hp, hpMax, state, x, z, aggro, dormant }]` *(rev. 5: `zone`)* |
| `stats()` | `{ programs, programsAtLoad, drawCalls, tickMsP50, tickMsP95, pools: { fx, markers, projectiles, pickups } }` *(rev. 5: `nav` — the walk grid's search counters and build time)* |

### 20.2 `state().combat` (added to `Game.state()` only when combat is on)

```js
{
  player: { hp, hpMax, mp, mpMax, sp, spMax, level, xp, xpNext, gold, potions, atk, def,
            action, actionFrame, invulnerable, combo, winded, lock /* uid|null */,
            checkpoint /* id */, cooldowns: [s1, s2, s3], deaths, perfectDodges },
  engaged, time, frame, seed, kills, bossDefeated, device /* input.lastDevice */,
  enemies: { total, alive, active, aggro, absent },   // rev. 8 (§27.22 K6): absent = foes of groups the story has away (not in the others)
  boss: { uid, hp, hpMax, phase, state, broken, defeated, fightTime, phaseTimes: [t1, t2, t3] } /* or null */,
  projectiles, markers, pickups, fx, edgeArrows,
  tokens: { melee, ranged },
  guards: { resume, respawn },   // booleans: a guard is active
  tutorial: { combo, dodge, rewarded },
  shop: { purchased },           // rev. 5 (§27.19 W3): ids of the one-time wares bought
}
```

Documented in `docs/specs/AUTOMATION_API.md` §3 by combat-core.

---

## 21. Test recipes and scripts

All assertions throw asynchronously (`setTimeout(() => { throw … })`) so the harness exits 1
(TOOL-01). Every game script first polls `window.__luminati.loadMs`, then locks the resolution
governor (`__game.game.resolution.enabled = false; __game.engine.renderScale = 1`).

**Combat fixture (combat-core, `sandbox/combat_fixture.js`).** Combat-core must be able to verify
from day one, before Cinderwatch exists. The module exports `makeCombatFixture()` → a level object
built with `createEmptyLevel` / `addObject` (48 × 40, name `Combat Fixture`, flat grass at
level 2) and `FIXTURE` (named coordinates for scripts). It contains: 3 dummies; a slime, a goblin,
a bat, a boar and a shaman group on open ground; a 2-level ledge (level 4, with a stair) holding a
2-archer group; a chest and two waystones; a golem group whose arena (≥ 22 × 14 u, rim 2 levels
up, gate with stairs) holds two campfires as braziers. Scripts load it with
`__luminati.playLocal(makeCombatFixture(), 'combat-fixture')` (then wait for the new page's
`loadMs`); nothing is written to `public/levels/`. Until the level package lands, chests and
waystones build nothing (no `ObjectBuilder` case yet) — use the `checkpoint` / `rest` hooks.

**Deterministic stepped recipe (combo on a dummy, fixture):**

```js
const g = __game, c = g.combat, F = FIXTURE;
c.seed(1); c.reset(); c.freezeAI(true);
g.teleport(F.dummyFront.x, F.dummyFront.z);   // 1.7 u south of the middle dummy
c.aim(F.dummyMid.x, F.dummyMid.z);
c.press('attack'); c.step(14);
c.press('attack'); c.step(15);
c.press('attack'); const s = c.step(60);   // 60, not 45: hit-stop freezes whole sub-steps (§27.1 I12)
// assert: 3 hits on the middle dummy; totals equal the golden values recorded by the first run
// and each hit within [ATK·mv·0.92·mit, ATK·mv·1.08·mit·1.75]; s.player.combo === 0 afterwards
```

Run twice in the same page (`seed(1); reset()` again) and compare the two `state()` JSON strings —
they must be identical.

| Script (all under `sandbox/`) | Owner | Page | Checks |
| --- | --- | --- | --- |
| `sprite_art.combat.json` | sprites | `sprite_art.html?mode=combat` | every enemy sheet × every pose and direction, player combat sheet, FX atlas; flash / glow sprites; **existing-sheet hashes equal `sprite_art.hashes.json`**; value-contrast ratios ≥ 1.6 (§10.3) |
| `combat_fx.actions.json` | fx-audio-input | `combat_fx.html` | FxQuads modes; every marker shape / style with progress on flat **and stepped** ground (draped); every new burst and `_poolList` growth exactly 1; `COMBAT_SFX_NAMES` (no warnings) and `SFX_NAMES` unchanged; `battle` / `boss` tracks at their tempo and a crossfade; mouse edges on / off the canvas; `stickZoom` |
| `ui.combat.actions.json` | ui | `ui.html?combat=1` | vitals (fixed position while the plate text changes), skills incl. `setDevice` keycap swap, loot feed, boss bar, 40 numbers, 30 bars incl. pips, 8 edge arrows, reticle, announcer queue incl. a `results` card, death screen, title destinations: **D then W leaves the destination unchanged**, ArrowRight + Enter selects the next level, ArrowRight + W resets and dismisses |
| `enemy_ai.actions.json` | enemies | `enemy_ai.html` | each brain against a scripted fake player with a mock `CombatContext` (§9.2); telegraph shots; a **ledge case** (an archer on a 1 u ledge hits a fake player on the floor below); off-screen rule (mock `onScreen` false → no wind-up); a state-dump determinism check (run twice) *(rev. 5: 141 checks with the real walk grid — the chase up the stair, the walled-off give-up and its calm, the path home, zones)* |
| `combat.fight.json` | combat-core | fixture | stepped combo (above); SP / MP costs; cooldown refusal; level-up (`setPlayer({ xp: xpNext − 1 })` + `damage(uid, 9999)` → level +1 and `.lu-announce` visible); **ledge shots** (ledge archer hits the player on the floor; the player's Ember Bolt from the floor hits the ledge archer; melee from below does not); photo mode on a combat level freezes the player (P, `move(1, 0)`, step 30 → position unchanged); resume guard (open map, close with a held B → no dodge until released); `input.lastDevice = 'gamepad'` → pad legend, swapped keycaps, one toast *(rev. 5: also `tests.zones()`, `tests.shop()` and a shop-menu shot; the combo and costs tests wait with `stepUntil`)* |
| `combat.iframes.json` | combat-core | fixture | slime lunge: dodge pressed when its windup has ≤ 4 f left → HP unchanged and `perfectDodges` +1; control run without dodge → HP lower |
| `combat.death.json` | combat-core | fixture | `damagePlayer(9999)` → wait 2.5 s → `press` a key → wait 3 s → player within 1.5 u of the checkpoint, HP full, gold −10 %, killed enemies still dead |
| `combat.boss.json` | combat-core | fixture (then Cinderwatch at integration) | `setPlayer({ level: 6 })`, teleport into the arena → intro, barrier, a goblin woken beforehand is sent home and never enters the arena; `setBossHp(0.69)` → phase 2 adds; `setBossHp(0.34)` → phase 3 kneel damage cap; charge into a brazier → stun, into the rim → 45 f skid; Shockwave ring: standing still → hit, roll inward timed in the 8 f window → no damage (stepped); kill → arena open, victory, results card; **greedy run** (Lv 5, `god(true)`, move toward the boss + attack + skills every step): greedy fight time ≥ 30 s and phase 3 ≥ 7 s (§8.3), times logged *(rev. 12, §27.24 Q5: at 5200 HP the greedy run steps ≈ 5 900 frames in one evaluate — run it, and `combat.boss.cw.json`, alone)* |
| `combat.programs.json` | combat-core | Cinderwatch | `stats().programs` after load == after `showcase()` + a scripted tour of every zone + boss fight + death + respawn; rAF gap recorder: no frame > 45 ms after warm-up |
| `combat.perf.json` | combat-core | Cinderwatch | `wake('all')` in the busiest zones; `drawCalls` at zoom 30 / 42, yaw ±60°; `postfx.enableTimings(true)`; `stats().tickMsP95` ≤ 1.0 |
| `combat.peaceful.json` | combat-core | `game.html?autostart=1` (Emberfall), then `?level=starfall-vale&autostart=1` | `state().combat === undefined`, `__game.combat === undefined`; J / K / L / 1 / C and a canvas click change nothing; programs 57 (Starfall 59) |
| `cinderwatch.tour.json` | level | `game.html?level=cinderwatch-pass&autostart=1` | teleport to each zone (yaw 0 and ±60°, zoom 42), screenshots, baseline `drawCalls` with enemies hidden ≤ 200; yaw ±60° shots of the Ruins' east edge and the arena edges; a boar charge lane across the z 37 step and a ledge-archer lane (draped markers) screenshotted; an attuned and an unattuned waystone by day; **night readability** shots after `setTime(21.5)` in the camp, the Ruins and the arena (T lets players choose night) |
| `editor_shell.combat.json` | editor | `editor.html?open=cinderwatch-pass` | 2D glyphs, 3D enemy previews, inspector stats, settings dialog, place / move / delete an enemy group, save under a temporary name and delete it *(rev. 5, §27.16: the enemy batch's draw cost and look, the boss Count cap, the 2D-only dots, the graded 2D hits)* |
| `combat.play.json` (§27.1) | lead | `game.html?level=cinderwatch-pass&autostart=1` | a bot (`sandbox/combat_play.js`) plays the whole level in real time with real key events: the drill and its reward, 5 chests, a rest, the Ruins branch, the quarry, a death and the respawn, Cinderheart, the results card; `verify()` fails the run on a missed goal *(rev. 5, §27.18: in **fixed step** — its first step loads `…&fixedstep=1` — deterministic, compared by its `summary` / `digest`; also `combat.play.fast.json`, `combat.play.human.json`, `combat.play.realtime.json`)* *(rev. 12, §27.24 Q4: it recruits the party — Rook and Sister Ilse at the camp after the drill reward, Sela at the Crossroads after the rest — and `verify()` wants the party of three at the end; `start({ party: false })` plays alone; digests `cf165213` (= `.fast`), human `8c4ef71b`)* |
| `combat_audio.actions.json` *(rev. 5, §27.17 M3)* | known-issues pass | `combat_audio.html` | the combat audio QA: 12 checks over offline renders of every combat SFX, the stingers, the music sections, dense scenes and the victory sequence; `identity()` of the peaceful audio |

`combat.fight.cw.json` and `combat.boss.cw.json` repeat the fixture steps against
`game.html?level=cinderwatch-pass&autostart=1` with Cinderwatch coordinates (the camp dummies,
the Ruins ledge archers, Cinderheart). Run them when changing either the combat rules or the level.

---

## 22. Work breakdown

### 22.1 Foundation

Combat is opt-in. The level catalog detects combat levels; the game loads the combat runtime,
sprites, effects, audio and UI only when needed. Keep the module interfaces in §9 and the typed
copies in `src/game/combat/types.d.ts` consistent when changing these dependencies. Peaceful
levels must retain their existing render and loading behavior (§2).

### 22.2 Implementation map

| Area | Implementation | Reference |
| --- | --- | --- |
| Core rules and player | `src/game/combat/` | §4–§6, §9 |
| Enemies and boss | `Enemy.js`, `ai/`, `defs.js`, `BossArena.js` | §7–§9 |
| Sprites | `src/engine/pixel/`, `src/engine/sprite/Sprite3D.js` | §10 |
| Effects and audio | `src/engine/fx/`, `src/engine/audio/AudioSystem.js` | §11–§12 |
| UI | `src/engine/ui/`, `src/game/combat/strings.js` | §13 |
| Level and editor | `tools/make-cinderwatch-pass.mjs`, `src/engine/level/`, `src/editor/` | §14–§17 |
| Companions | `src/game/party/MemberCombat.js` | §28, [PARTY.md](../specs/PARTY.md) |

Update a shared interface and its callers together. The executable fixtures and scripts in §21
exercise these boundaries; no placeholder implementation is required.

---

## 23. Integration and verification sequence

1. Check the affected module interfaces and typed copies (§9, §22.1).
2. Run `npm run typecheck` and `npm run build`, then compare the peaceful-level fingerprints
   against the documented baselines (TASK_PLAYBOOKS §16).
3. Regenerate: `node tools/make-cinderwatch-pass.mjs`, then `--check` for Cinderwatch and
   sample-hamlet; `node tools/make-starfall-vale.mjs --out=<scratch>.json` and `cmp` with the
   committed Starfall file (identical).
4. Run every script of §21 (including the `*.cw.json` variants) and read the PNGs; zero page
   errors, console errors, warnings and failed requests. *(rev. 12, §27.24 Q4: the play-through
   bot (`sandbox/combat_play.js`) recruits the party by talking — a `join` task each for Rook
   and Ilse at the camp and Sela at the Crossroads — and plays beside it; compare its digests:
   `combat.play.json` = `combat.play.fast.json` `cf165213`, `combat.play.human.json` `8c4ef71b`.
   A chunk the game loads mid-run (the party's, at the first join) is awaited between two frames
   (`chunkLoads`), so the two expert scripts agree. In the planned fall beside Old Ironhide the
   members hold back; with no Old Ironhide left the fall is skipped.)*
5. Fingerprints (TASK_PLAYBOOKS §16): Emberfall / Willowmere / Brightwater / Starfall unchanged;
   record Cinderwatch's values. Editor open / save round trip of every shipped level leaves
   `git diff` empty.
6. Docs (§24), `npm run build`, `npm run docs:check`; check `git status public/levels` (no stray
   test levels).

---

## 24. Docs to update

| Doc | Area | Change |
| --- | --- | --- |
| `docs/architecture/modules/{pixel,sprite,fx,audio,core,ui,world,level}.md` | engine modules | new APIs, options, presets, program keys |
| `docs/specs/{INPUT_AND_CONTROLS,AUTOMATION_API,OBJECT_CATALOG,LEVEL_FORMAT}.md` | input / combat / level | bindings (incl. the pad legend), hooks, types, optional fields |
| `docs/contracts/LEVEL_EDITOR.md` §1–§2, §5 | level | `environment.combat`, the 3 types and their optional fields, the editor's `Combat: Auto / On / Off` setting (text from §17) |
| `docs/architecture/{GAME,EDITOR}.md` | combat-core / editor | frame order, combat wiring; editor enemy preview |
| `docs/design/levels/{cinderwatch-pass,starfall-vale}.md` | level | new level page; Starfall's coverage now "every non-combat object type" |
| `docs/user/LEVEL_EDITOR_GUIDE.md` | editor | placing enemies, chests, waystones; Combat setting |
| `ARCHITECTURE.md` §4.1 / §4.3 / §4.8, `README.md`, `AGENTS.md` (coupling rule, levels on disk), `docs/README.md`, `docs/index.html`, `docs/contracts/README.md` (this contract), `docs/ai/{AGENT_ONBOARDING,TASK_PLAYBOOKS,KNOWN_ISSUES}.md` (level table, §0 / §1 / §16 fingerprints, COMBAT-xx traps), `docs/architecture/PERFORMANCE.md`, `docs/features/FEATURES.md`, `docs/user/{PLAYING_THE_GAME.md,shortcuts.html}`, `sandbox/index.html` | shared documentation | integration notes |

---

## 25. Risks and open points

| Risk | Mitigation |
| --- | --- |
| `Player.update` stomps combat poses | `player.action` returns early before any `play` / `faceVector` / `speed` write (including the frozen idle branch); combat sets the next action in the same sub-step. |
| Program-key collision | The fx variant only under `luminati-sprite3d-lit-fx-v1`; the peaceful fingerprint (exact program count) catches a leak. |
| Glow texels (alpha 204) not surviving upload | Verified in the sprite sandbox; fallback: a second glow-mask texture under a new key `luminati-sprite3d-lit-fx-v2` (lead decision). |
| Mid-fight shader compiles | Warm-up list (§19), `combat.programs.json`, dev warning. |
| Readability (DOF tilt-shift, occlusion, off-screen attackers) | Engaged DOF offsets; validation rules 9 and 14 at yaws −60 / 0 / +60; DOM aggro pips and edge arrows (not depth-occluded, by design); the on-screen rule for wind-ups; boss framing. |
| Markers on stepped terrain | Markers are draped over a height texture (§11.2); the tour screenshots a lane across a step and down a ledge. |
| Projectiles across height differences | One height model for LOS, projectiles and validation (§7.6); ledge cases in `enemy_ai` and `combat.fight`. |
| Real-time non-determinism | All assertions in stepped mode; real-time scripts only check coarse outcomes. *(rev. 5, §27.18: the play-through bot runs in fixed step — deterministic, with a digest.)* |
| Title destination row on every shipped level | The only visible change on peaceful levels (title screen only; fingerprints use `autostart`); A / D never cycle, only a confirm travels. |
| Two copies of generator helpers | `tools/lib/levelgen.mjs` vs Starfall's inline helpers until a later, byte-verified migration. |
| Pad rebinding on combat levels | Device-aware legend and skill keycaps, a one-time pad hint toast, the drillmaster's pad text; every moved function keeps a pad button (zoom on the right stick, photo on LS with a deflection guard). |
| Balance | First-pass numbers; `defs.js` and `rules.js` are pure data; the boss length has a measurable greedy-run floor (§8.3). *(rev. 5, §27.19: tuned against the bot's expert and human settings; a human play-test remains.)* |


---

## 26. Review decisions (revision 2)

Two reviews checked revision 1: **A** (feasibility, checked against the code) and **B** (player
experience). Every finding is listed with its resolution. "Accepted" means the fix is now binding
in the section named; the **Decisions** column explains every rejection or change of approach.

| # | Finding | Resolution | Decision / reason |
| --- | --- | --- | --- |
| A1 | Rule 3 fails: the Mire route via the east stair (x 84–86) is ≈ 87 u against a 55.5 u limit | Accepted — the Mire → lip stair moves to the ridge's east flank, x 56–59, z 44–47 (§15.2); rule 3 lists the route estimates (§15.5) | The east Mire (islet, waterfall) becomes an optional loop, which suits a reward (the max HP chest). |
| A2 | `CombatContext` cannot express magma flat damage, Mend, boss phase side effects; `arena` / `bossUI` "golem only" on a shared object | Accepted in part — `HitSpec.flat`, `ctx.heal`, `ctx.emit` (brain → core signals), `ctx.onScreen`, `EnemyInit.arena` (§9.2, §9.3, §9.5); the brain / core split is written down in §8.1 | **Rejected:** `hitStop`, `look`, `emitter`, `stinger`, `banner`, `music` on the context. Each global effect gets one owner: core applies them on the `bossIntro` / `bossAwake` / `bossPhase` signals and on the boss's death, so a brain and core can never both apply a phase-change hit-stop. |
| A3 / B1 | Projectiles fly flat; ledge archers can never hit; the player's bolt is blocked by the ledge; melee reaches across a cliff | Accepted — one height model for LOS, projectiles and rule 8 (§7.6); `ProjectileSpec.vy`, release at ground + 0.9, aim at the body middle, body bands (§7.1, §9.5); melee needs grounds within 0.6 u (§6.4, `HitSpec.dy`); ledge cases in `enemy_ai`, `combat.fight` (§21) | — |
| A4 / B3 | Markers at one sampled height float or sink on steps; "flat by validation" was not enforced | Accepted, option (a) — markers are draped over a height texture in the vertex shader, one draw call (§11.2); §25 corrected; stepped cases in `combat_fx` and the tour | Draping also covers editor-authored levels, which no generator rule could keep flat. |
| A5 | Photo mode freezes AI but not the player, so encounters and the boss trigger can be skipped | Accepted — on combat levels photo mode freezes the player (§4.2, §4.4); tested in `combat.fight` | Keeping combat live in photo mode was the alternative; freezing is simpler and keeps photo mode a pure pause. |
| A6 | Stubs too inert for dependants; combat-core cannot verify until Cinderwatch exists | Accepted — shape-complete placeholders (§22.1) and the in-page fixture level via `__luminati.playLocal` (§21) | **Rejected:** splitting combat-core into "integration" and "player kit". PlayerCombat, Hitboxes, Projectiles and CombatSystem share the sub-step order, hit resolution, i-frames and hit-stop; a split needs a second internal contract and leaves both halves unverifiable until they merge. The placeholders and the fixture remove the blocking instead. |
| A7 | Separation: fixed 80 / 20 lets the player shove dummies; hurt vs move radius unspecified | Accepted — inverse-mass split for every pair, `PLAYER_SEP_MASS = 4`, ∞ never moves; move radius for movement / separation, hurt radius for hits (§7.1, §7.6) | — |
| A8 | `reset()` / `seed()` leave state that breaks "run twice, identical" | Accepted — full `reset()` list, RNG re-creation rule, hook presses obey the guards (§20.1, §4.4, §7.8) | — |
| A9 | `play()` animations keep running during hit-stop and pauses | Accepted — combat writes `sprite.speed` per frame (§4.3) | — |
| A10 | `setupUI()` runs before `_setupMaps()` creates the map state; boss marker unowned | Accepted — `combat.attachMaps(map)` at the end of `_setupMaps` owns enemies, chest and boss markers (§4.5, §9.1) | — |
| A11 | Starfall camp: wrong distance, crowns ignored, pad / look changes unmentioned | Moot — the camp is dropped (D13, §16); the corrected distance, the crown-cover rule and the pad / look consequences are recorded in the opt-in note of §16.2 | — |
| A12 | New burst presets create extra pools; preset count inconsistent | Accepted — full pool-key fields; six presets add exactly one pool (§11.3, D8) | — |
| A13 | Waystone crystal dark by day (`day ?? 0`), shared material; World's hard-coded labels | Accepted — per-instance crystal material with `day: 0.9` (§14.3); World uses `Examine`, combat overwrites the label (§9.8, §6.12) | — |
| A14 | `startMusic` returns early and uses one global bpm; appending to `SFX_NAMES` changes `sandbox/core.js` | Accepted — per-instance `m.bpm`, a real switch path, remembered track (§12.2); `COMBAT_SFX_NAMES` export, `SFX_NAMES` unchanged (§12.1, §2.6) | — |
| A15 | Shared draw-path edits could change NPC / creature sheets unseen by the fingerprint | Accepted — committed canvas-hash baseline checked by `sprite_art.combat.json` (§10, §2.6) | — |
| A16 | Counts and wording inconsistent; orphan files | Accepted — six hostile kinds (§1), six presets (D8), "telegraph period" (§7.3), hit-stop cap 10 (§11.4); `sandbox/index.html` and `docs/index.html` are lead-owned, the Combat-setting text in `LEVEL_EDITOR.md` is written by the level package (§17, §22.2) | — |
| B2 | Non-boss enemies can follow the player into the arena and hit a locked player during the intro | Accepted — runtime arena exclusion for every non-boss, non-add enemy (§7.6); the intro sends every other aggroed / inside enemy home and clears its markers and projectiles (§8.1); rule 17; `quarry_boar_elite`, `quarry_goblins`, `quarry_archers` moved (§15.3) | **Changed:** rule 17 checks the home disc (radius + 2) ≥ 6 u from the arena instead of the full leash disc (radius + leash + 2 = 15.5 u for a boar would push every quarry group onto the lip); the runtime exclusion is what guarantees correctness. "Freeze every other enemy during the intro" is replaced by "send them home", which has the same effect without a second pause mechanism. |
| B4 | Attacks from off-screen; lock-on picks unseen targets | Accepted — on-screen rule for wind-ups (§7.3), frustum-only lock-on (§6.9), 8 DOM edge arrows (§13.2), boss framing with the proposed focus and a 30 u minimum distance (§6.9) | The alternative "or the marker is fully on screen" is not used: testing the enemy's own position is simpler and equally deterministic. |
| B5 | Hidden enemies have no cue; rules 9 / 14 only consider yaw 0 | Accepted — DOM aggro pips (§13.2); rule 14 at yaws −60 / 0 / +60 with crowns, roofs and terrain; rule 9 arena visibility at three yaws; tour shots (§15.5, §21) | **Rejected:** GreaterDepth x-ray silhouettes for aggroed enemies — up to 30 extra draw calls and a material per sprite against a ≈ 272 / 300 worst case; the pip gives the location for 0 calls. |
| B6 | With the clock on, most of a 20-minute run happens at night | Accepted — `clock: false` (§15.1), required by coverage (§15.6); night readability shots in the tour because T still sets night | — |
| B7 | Boss phase 3 too short; every charge gives a free stun | Accepted — HP 1800, thresholds 70 / 35 %, threshold clamp, 90 f kneel with an 8 % damage cap, stun only on a brazier (rim: 45 f skid), counters in Odo's pages (§7.1, §8.2, §8.3, §15.3) | **Changed:** the "optimal player ≥ 25 s / ≥ 90 s" assertion becomes a greedy-player floor (god mode, always attacking: fight ≥ 30 s, phase 3 ≥ 7 s). An optimal human cannot be scripted; the greedy run is reproducible and a strict lower bound. |
| B8 | The Starfall camp turns a peaceful flagship level into a combat level | Accepted — Starfall stays byte-identical and peaceful (D13, §16) | — |
| B9 | A / D on the title cycle the level; D then W travels to another level | Accepted — only arrows / d-pad / glyph clicks cycle, only a confirm travels, any other key resets and dismisses (§13.3); tested in `ui.combat.actions.json` | Stick flicks are not used for cycling either (a resting thumb would change the selection). |
| B10 | Pad layout undiscoverable; LS click fires while running | Accepted — `COMBAT_PAD_CONTROLS`, `CombatHUD.setDevice`, a one-time pad hint (§5.2, §13.2); LS photo ignored while the stick is deflected (§5.1, §5.2) | **Rejected:** photo on a Back hold — Back opens the map on its press edge, so a hold would need the map to wait for the release, a behaviour change on the pad for every level. |
| B11 | Shockwave rings leave a 2 f dodge window | Accepted — `HitSpec.thin`: rings test the player's centre, an 8 f window; roll inward is the stated answer (§8.2, §9.5, Odo) | — |
| B12 | Input guard is one-sided | Accepted — symmetric resume guard with no dead time; the 0.25 s guard stays only after respawn (§4.4) | — |
| B13 | Loot can land in water | Accepted — standable landing search and instant magnet over water (§7.8) | — |
| B14 | Telegraph grammar gaps (goblin follow-up, Gore, boss lane, bat dive) | Accepted (§7.3, §7.7, §8.2) | — |
| B15 | Chest markers spoil secrets | Accepted — markers appear on discovery (§13.3) | — |
| B16 | Branch rewards uneven | Accepted — Mire islet gets max HP, ridge pocket gold + draught, quarry chest max MP; `mire_goblins` added so both branches give 189 XP (§15.3) | — |
| B17 | Vitals jump when the location plate changes height | Accepted — fixed offset, measured once (§13.1) | — |
| B18 | Green slimes on green grass | Accepted — teal gel, contrast ratio ≥ 1.6 check, no flower areas over slime homes (§10.3, rule 18) | — |
| B19 | Beating the boss has no closure | Accepted in part — `bossDefeated` state, Maren's post-victory pages, a results card (§6.12, §8.3, §20.2) | **Rejected:** post-victory pages for Odo — he is a plain dialogue NPC; branching his pages needs a second `NPC_SCRIPTS` id (one more catalog value to cover) for two pages of flavour. |

---

## 27. Deviations (integration)

Recorded by the integrator on 2026-09-28 after merging the seven packages, running every script of
§21 and playing Cinderwatch Pass end to end with real key events (§27.1, `combat.play.json`). Every
row is additive to the sections above; where a row and the text above disagree, the row describes
the code. The package rows condense the builders' reports. §27.9–§27.12 (revision 4) record the
three fix passes after the code and play review and the final regression pass; §27.13–§27.20
(revision 5) the known-issues pass; §27.21 (revision 6) what the typed copy of §9 records where the
text and the code differ; §27.22 the campaigns (revisions 7 and 8); §27.23 (revision 11) the pixel UI
and the languages; §27.24 (revision 12) Cinderwatch Pass balanced for a party of four.

### 27.1 Integration pass (lead)

| # | Section | Change | Why |
| --- | --- | --- | --- |
| I1 | §11.5 | Named-effect colours lowered by ~40 %: `slash` (1.8, 1.8, 1.55), `slashBig` (1.95, 1.7, 1.2), `thrust` (1.8, 1.8, 1.7), `spin` (1.7, 1.6, 1.2), `impact` (2.2, 2.0, 1.5), `crit` (2.6, 2.1, 0.8). | With the real atlas the contract values bloomed the arcs and stars into a white glare that hid the target (close-up shots of A1–A3 on a dummy). |
| I2 | §11.5, §10.4 | `opts.flip` mirrors the frame along U (FxQuads `flipX`) instead of playing the frames in reverse; `thrust` (CombatFx) and the `arrow` projectile (Projectiles) pass `rot = π/2`. | The atlas draws `arrow` / `thrust` along +U and a flat quad's +V runs along its direction, so both were drawn sideways; a mirrored back-hand arc must also mirror its shape. |
| I3 | §7.3, §7.2, §11.4 | `uFlash` alphas: wind-up pulse 0.18 ↔ 0.36 (was 0.35 ↔ 0.6), elite rim 0.04 ↔ 0.08 (was 0.08 ↔ 0.16), the **boss's** hit flash 0.55 / 0.25 (others keep 0.85 / 0.4). Colours unchanged. | The mix happens in linear HDR where sprite colours are 0.05–0.3: the contract alphas turned wind-ups into a flat peach silhouette and the 4 u boss into a white bloom blob on every hit (KNOWN_ISSUES COMBAT-03). *Superseded for the wind-up, the elite rim and the boss hit flash by §27.10 P2 (highlight).* |
| I4 | §7.3, §9.5, §11.2 | Lane lock flash implemented: `MarkerSpec.flash` is 1 for the first 5 f after a lane locks, then 0.35 until it resolves — archer lanes, the boar charge and the boss charge (`Enemy.lockFlash(sinceLock)`); core's `MARKER_DEFAULTS` carries `flash: 0`. | §7.3 asks the rim to flash white at the lock; the enemies package had no way to express it before `flash` existed. |
| I5 | §8.3 | A hit with `mv ≤ 0` and no `flat` (the phase-2 push ring) applies only the knockback: `PlayerCombat.shove(kb, dirX, dirZ)` — the hit-stun slide, no HP, no flash, no number, no hit-stop, a light shake. | The contract says "kb 3.0, mv 0 — no damage"; `max(1, …)` dealt 1 damage and a full hurt reaction. |
| I6 | §7.6 | Separation treats an `armored` enemy (a charging boar, the boss's charge) as infinite mass against the player. | A charge plows through instead of being slowed by the player. |
| I7 | §9.2 | `PlayerView.swing` (additive): the number of swings started (every combo step); the goblin's back-hop cue reacts to a new swing as well as to a new action name. | Core uses one action name `attack` for A1–A3, so only the first swing of a combo was a cue. |
| I8 | §13.2 | `CombatHUD.refuse(i)` (a refused press shakes the slot with a red rim; core already called it) and `Announcer.clear()` (drops queued cards; the `reset()` hook calls it). | Requested by combat-core. |
| I9 | §6.12 | The results card pluralises: `1 foe`, `1 fall`, `1 perfect dodge`. `foes` counts every enemy the player killed, boss adds included; the time is the combat clock since load. | Played: "1 falls". |
| I10 | §4.1 | The engine barrel also exports `MUSIC_STINGERS` and `MARKER_GRID`. | fx-audio-input request. |
| I11 | §21 | New `combat.play.json` + `sandbox/combat_play.js`: a real-time bot that plays the level with real `KeyboardEvent`s (an engine system at order −100 dispatches them before the Game reads its input; A* on a 0.5 u grid probed with the player's own `tileMap.move`; it reads the telegraphs to roll). The bot uses a 0.4 u clearance on its grid (8-way key chords cannot thread a 0.6 u gap between a prop and a cliff). Measured (final run, alone on the GPU): drill + reward, 5 chests, a rest at the Crossroads, the Ruins (an unplanned death to the ledge archers at Lv 3, respawn at the Crossroads Waystone), the quarry, the planned death beside Old Ironhide (respawn at the Quarry Waystone within 0.25 u, full HP, gold 223 → 200, killed enemies stay dead), Cinderheart at Lv 5 in 70.8 s (phases 11.7 / 35.6 / 23.4 s), 36 kills, 5 level-ups, 700 key taps, results card `5:26 · 36 foes · 2 falls · 5 perfect dodges · Lv 6`; 0 page / console errors, warnings, failed requests. An earlier run: boss in ≈ 50 s, `4:53 · 36 foes · 1 fall · 2 perfect dodges · Lv 6`. | §23 step 3 asks for a played run; the stepped scripts never press real keys. |
| I12 | §21 | The stepped combo recipe steps `step(14) / step(15) / step(60)` (hit-stop freezes whole sub-steps; `step(45)` ends inside A3). Golden values at `seed(1)`: 21 (crit) · 13 · 23 = 57, on the fixture and on Cinderwatch. | combat-core deviation 1. |
| I13 | §8.3 | Greedy boss runs measured at integration: fixture 38.9 s (phases 12.4 / 13.6 / 12.9 s), Cinderwatch 39.1 s (12.5 / 13.0 / 13.6 s) — both above the 30 s / 7 s floors, so the golem keeps 1800 HP. | §23 asks to adjust HP only when too short. |

### 27.2 sprites

| # | Section | Change |
| --- | --- | --- |
| S1 | §10.3 | Value contrast = the mean colour of the 40th–60th luminance percentile of the sheet's opaque, non-outline texels against the mean of the `grass` + `grass_dark` textures (L 0.142). Measured: slime 2.11, goblin 1.71, bat 2.71. |
| S2 | §10.3 | The goblin wears an open dark-leather vest over a bare green chest and arms, a skin-coloured scalp, bare feet and a tan loincloth (skin stays `#7aa84a`): a dark tunic measured 1.24 < 1.6. |
| S3 | §10.2 | Optional spec fields, absent on every existing spec (hashes unchanged): `face: 'fierce'`, `gear.beads`, `gear.gemGlow` (the shaman's glowing gem), and `feather` with `hat: 'hood'` draws a tuft. |
| S4 | §10.2 | `_painterKit` also exports `glowTexel`, `GLOW_ALPHA` (204), `OUTLINE`, `ERASE`; material ids 35–39 `GEL`, `BONE`, `GLOW`, `STONE`, `WING`. |
| S5 | §10.1 | `Sprite3D` read-only getters `flash` / `glow` (`[r, g, b, a]`); `combatFx` is ignored with `lit: false`; `clone()` copies flash and glow. |
| S6 | §10.2 | Pose `phase`: 0 wind-up, 1 strike, 2 follow-through, −1 otherwise. `roll` is a hand-built ball; `down` is the standing layout rotated 90° clockwise. |
| S7 | §10.2 | Weapons: sword ≤ 8 px pommel to tip (5 px blade, 4 on the child build), staff 8 px; the bow is ≈ 11 px (child) / 13 px (adult) — the one exception to "≤ 8 px" (a smaller bow does not read). |
| S8 | §10.3 | Humanoid enemy sheets are combat character sheets renamed `enemy:<kind>` (no `plain` reference); monster sheets keep a 1 px transparent margin in every frame. |
| S9 | §10.4 | Orientation: `arrow` and `thrust` point along +U; `slash` / `slashBig` bulge toward +V and sweep from texture-right to texture-left over their frames. |
| S10 | §21 | The paint-budget assertion passes when the better of a cold and a warm paint is ≤ 120 ms (shared machine); cold 64–86 ms, warm 47–59 ms. `sprite_art.hashes.json` is `{ comment, hashes }` with 86 sheets (the gallery's spec overrides and every prop sprite at seed 7 included). |

### 27.3 fx-audio-input

| # | Section | Change |
| --- | --- | --- |
| F1 | §11.2 | Colours tuned for golden hour through ACES: enemy rim (2.6, 0.34, 0.12), fill (1.3, 0.13, 0.05) alpha 0.22 → 0.5 (0.12 ahead of the front); player fill (1.25, 0.95, 0.35) alpha 0.14 → 0.34; magma fill (1.6, 0.42, 0.08), brightness 0.55–1.25. |
| F2 | §11.2 | The vertex shader reads the centre of the height texel that contains the vertex (nearest): at res 4 a texel is one stair step, so treads are exact (a linear blend sank markers under a quarter of every tread). |
| F3 | §11.2 | Bake budget: projected after ~25 % of the rows (time so far + remaining rows at the fastest of 5 row groups); above 40 ms it restarts at res 2. New members `heightTexture`, `heightRes`, `bakeMs`; export `MARKER_GRID` (24). |
| F4 | §9.5, §11.1 | Additive: MarkerSpec `flash` (0..1, whitens the rim; used by I4); FxQuads `flipX`; FxQuads `rot` is counter-clockwise in the quad's plane — `rot = π/2` lays a +U frame along the direction. |
| F5 | §11.3 | `healGlow` hdr 2.4 (was 3), keeping `#bfe58f` green through ACES; pool-key fields unchanged. |
| F6 | §12.1 | `playSfx` returns `true` for combat names; combat voices end in a shared 9-position panner bank (dry + wet, reverb send 0.35) created on the first combat sound. |
| F7 | §12.2 | `startMusic()` without `track` plays the remembered track (initially `emberfall`); the emberfall instance's `m.bpm` is a getter on `this.bpm`; `setMusicSection` is remembered per track (survives a restart of that track, cleared by another); `playStinger(name, { volume })` returns a boolean, ducks the playing track to 30 % and swells it back, silent while music is off or before unlock; getter `musicSection`, export `MUSIC_STINGERS`; an unknown track or stinger warns once. |
| F8 | §5.3 | Mouse buttons are read by window capture-phase pointer listeners (a press counts only when `e.target === canvas`); chorded presses (`pointermove` with `button ≥ 0`) are handled; middle-click autoscroll is suppressed on the canvas. |

### 27.4 ui

| # | Section | Change |
| --- | --- | --- |
| U1 | §13.2 | `offsetY` of `bar().anchor`, `edge().anchor`, `alert` and `reticle` is in **world units** (like `InteractPrompt`); anchors are read live. |
| U2 | §13.2 | Pixel-art scale `--lu-px = max(1, round(viewport height / 450))` (2 at 900 px, 3 at 1440 px). |
| U3 | §13.2 | `bar()` / `edge()` handles persist per slot and chain; an out-of-range slot returns a no-op handle; an edge arrow hides itself while its anchor is inside the 24 px inset rectangle; a re-anchored or re-shown bar snaps its lag fill. |
| U4 | §13.2 | `guard` numbers always read `Guard`, `perfect` always `Perfect!` (with the crit pop); getter `liveNumbers`. |
| U5 | §13.2 | Announcer `duration` is the whole time on screen, fades included (in 0.45 s, out 0.55 s, minimum 1.2 s); getter `visible`; `clear()` (I8). |
| U6 | §13.2 | DeathScreen: a new `show()` or `hide()` resolves a pending promise with `undefined`; keys before `armDelay` are not captured; the title's ignored keys are ignored; while shown the root gets `.lu-root--death` (world labels, prompt, announcer and banner step aside); photo mode does not hide it. |
| U7 | §13.2 | BossBar draws gems only when `phases > 1` (lit up to `phase`, the current one breathes); getter `visible`. |
| U8 | §13.2 | CombatHUD: `padKeys` defaults to `keys`; `setDevice('mouse')` counts as keyboard; getters `device`, `vitalsElement`; an HP ≤ 25 % pulse, a gold flash when a skill is ready again, a coin pop when gold rises; loot rows live 3.4 s; `refuse(i)` (I8). The two-line plate height is measured with a hidden copy of the plate. |
| U9 | §13.3 | TitleScreen: Space and NumpadEnter also confirm; key repeats never cycle; a "← → Choose a level" hint under the row; a `current` not in the list stays the result unless the player picks an entry; `SVG_DIVIDER` exported. |
| U10 | §13.3 | WorldMap: the combat legend rows go after "Campfire"; the boss marker is a larger diamond. Helper exports `pixelSvg`, `svgUrl` in `WorldLabels.js` (not in the barrel). |

### 27.5 enemies

| # | Section | Change |
| --- | --- | --- |
| E1 | §7.4 | Aggro at < 3 u also requires `abs(dy) < 1.5` (nothing aggroes through a cliff of 3+ levels). |
| E2 | §7.6 | Stuck handling beyond the probes: a watchdog (< 1 u net movement in 4 s while > 1.5 u from the target); `chase` follows the player's recorded footsteps when the player is on another level (how enemies take stairs); after giving up, sight aggro is suppressed for 6 s; a return blocked for 150 f snaps home. |
| E3 | §7.7 | Goblin: during its first wind-up it steps in to ≈ 1.5 u (facing locked for the last 6 f; a 3.2 u trigger with a 0.8 u lunge could not connect); its strafe holds 3.0 u. The back-hop cue is a new melee action or a new swing (I7). |
| E4 | §7.7 | Shaman holds its token through the 66 f Hex Flame fill (a hittable channel in `active`); the placed circle survives interrupts and is freed on death / return. The archer's shove requests the ranged token like any attack. |
| E5 | §7.7 | Boar: a lane that ends at an obstacle is run 1 u further so the boar meets the wall (otherwise it always skidded); the free run does not see arena rects for non-bosses — `moveGround`'s `'arena'` block makes a skid. Values chosen: gore active 6 f, cooldowns charge 90 f / gore 60 f, skid ≈ 1 u. |
| E6 | §8 | Boss states `intro`, `phase` (transition roar), `kneel`; Broken is state `stagger` with a `broken` getter; the pre-fight kneel is state `dormant`, guarded (the `dormant` flag stays core's); `hpFloor` states the threshold and kneel floors (core reads it); the phase-3 Shockwave Slam also leaves a magma pool; the second add wave never spawns during a roar, the kneel, Broken or a stun. Values chosen: cooldowns sweep 120 / toss 180 / rain 420 / charge 300 f, weights slam 3–4 / toss 3 / rain 1.5 / charge 2.5, turn rates 150 / 170 / 190 °/s, push ring 9 u/s × 0.8 u. |
| E7 | §9.3 | Additive `Enemy` members: `sendHome(ctx)`, `setPhase(n, ctx)`, `hpFloor`, `broken`, `homeRadius`, `lift`, `t` / `fr` / `after(f)` / `entered` / `serial`, `lockFlash(sinceLock)` (I4) and the marker / hazard helpers (`mark`, `markProgress`, `unmark`, `markToFade`, `markerSpec`, `hazardCircle`, `hazardRing`, `hazardMagma` …). The golem brain has `jumpPhase(e, n, ctx)` (the `bossPhase(n)` hook). |
| E8 | §7.4, §8.3 | `die()` fires the death bursts (slime `gooPoof` 12 at once; others `deathPoof` 8 when the fade ends; the boss none); `reset(ctx)` frees its own markers; a hitstun or stagger entered during hit resolution runs its frames 0..n−1 on the next n sub-steps; stun stars use `ctx.fx('stun', …, { duration, follow })` (boss at ground + 2.6). |

### 27.6 combat-core

| # | Section | Change |
| --- | --- | --- |
| C1 | §5.1 | The input buffer counts down after the player's decision, so a press lives 10 full frames. |
| C2 | §6.5 | A perfect dodge keeps the player invulnerable while the enemy slow motion lasts (0.6 s); the slowed attack otherwise caught the player after the roll's own i-frames. Magma ticks (flat damage) never count as a perfect dodge. |
| C3 | §20.1 | `god(true)` ignores enemy hits entirely (the greedy run is a strict lower bound); `bossPhase(n)` calls the golem brain's `jumpPhase` and lowers HP to that phase's threshold (`setBossHp` still runs the real transition); `hold` defaults to 30 frames; `place` also moves the enemy's home; `reset()` also returns the checkpoint to the spawn and clears the tag registry (god, freezeAI, move and aim stay as set); `rest(id)` skips the "not while engaged" refusal; `damagePlayer` ignores i-frames and god; extra member `system` (the CombatSystem). |
| C4 | §6.12, §8.3 | Victory: at +0.4 s the banner shows "Victory" with "The fires of the pass are quiet" as its subtitle (as a title it overlapped the vitals); the results card at +1.5 s after the stinger starts; the boss bar hides at +2 s. |
| C5 | §8.3 | Core uses the Enemy's `hpFloor` when present (else its own threshold and 90 f kneel window); forced crits key on `state === 'kneel'`. |
| C6 | §4.4, §7.5 | Enemies walking home are not put to sleep by dormancy; faded corpses get `sprite.visible = false`; photo mode and the map are also refused while dead or during the boss intro (the prompt hides then too); a lock press when nothing is locked locks at once and its release does not also cycle; with `freezeAI` enemies still let their hit flash decay. |
| C7 | §21 | The fixture scripts start on `sandbox/index.html`, call `saveCombatFixture()` and `goto` the game (as `playLocal` without loading Emberfall first); the fixture also holds Maren and Bram. `combat.programs.json` does not time the death-screen / faded-respawn transition. |
| C8 | §9.1 | `CombatSystem.rewardTutorial()`; `conversationFor` passes the NPC object to scripts as `(ctx, obj)`; refused skills call `ui.combat.hud.refuse(i)`; chest contents use `RNG(hashString('chest:' + id) ^ seed)`. |

### 27.7 level

| # | Section | Change |
| --- | --- | --- |
| L1 | §15.3 | The four braziers moved 1 u toward the arena centre (z 10.5 / 20.5) so they stand ≥ 2 u inside it (rule 9); `fall_mire` at (79.5, 44), the tile edge between the spring pool and the plunge pool (rule 13). |
| L2 | §15.2 | The glade brook uses the custom legend char `e` (flowing east); the Mire → quarry stair is 3 tiles (x 56–58) on rows z 44–46; the E / W level-9 caldera ledge is blocked rock. |
| L3 | §15.5 | Rule 9: an arena boundary tile whose outside neighbour is not walkable counts as sealed. Rule 4 also requires each group's spots to be identical under a plain tile test and the standable test (two optional relative `area` fields: `glade_slimes_w`, `mire_slimes`). Rules 9 and 14 use the pitch the game uses at the spot (high ground 38° above y 3.4, else 34°) and model the border-forest trees; rule 13 also keeps chests and waystones clear of roofs. |
| L4 | §15.1 | `environment.fogScale: 0.7`, `scenery.southGap: 8`; the waystone's examine speaker falls back to `'Waystone'` when `name` is blank. |
| L5 | §14.3 | `PropFactory.result(group, { materials })` owns per-instance materials (freed by the prop's `dispose()`); the chest lid is one material with vertex tints (never merged, one draw call); `controls.open(instant = false)` returns false when already open; the waystone's crystal and runes cast no shadow and clone the library `plaster` material (same program); `WAYSTONE_COLORS` is exported from `CombatProps.js`, not the barrel. |

### 27.8 editor

| # | Section | Change |
| --- | --- | --- |
| D1 | §17 | Additive, so a boss can be authored at all: an Inspector "Boss arena" section (Add arena and gate: `arena { minX: −9, maxX: 9, minZ: −9, maxZ: 9 }`, `gate [−1.5, 9, 1.5, 9]`; Remove), SelectTool drag handles for the arena corners and gate ends (snap 0.5), `focusIds` framing the arena. A boss with an arena draws the arena and gate instead of its home ring (2D and 3D). |
| D2 | §17 | The level card shows `Enemies n (groups g) · Waystones n · Chests n` as a status line (also when combat is forced On with no combat objects). Chests and waystones have their own 2D drawings. Returning the Combat setting to Auto removes `environment.combat` (never written for Auto). |
| D3 | §17 | The editor imports `ENEMY_DEFS` (for the fliers' `hover`); bats' origin is at `groundAt` like the game's; previews idle facing a seeded direction (bosses and dummies +Z); exports `ENEMY_COLORS`, `enemyKind`, `enemyHover`, `enemyArena`, `enemyGate` from `ActorPreview.js`. |
| D4 | §21 | `editor_shell.combat.json` saves to the browser slot `tmp-editor-combat` (deleted in the same run), not to `public/levels/__tmp_*` — the level API accepts only `[a-z0-9-]` names. The project save's byte identity is checked in the page (`serializeLevel` of the opened level equals the fetched file). |

### 27.9 Review fix pass: game (revision 4)

A code and play review after integration reported 28 findings in the game code (6 major); all were
fixed. Rows that change contract text:

| # | Section | Change | Why |
| --- | --- | --- | --- |
| G1 | §8.1 | Move selection: when no move is legal the boss walks in to 2.2 u (`STALL_NEAR`, within reach of Sweep); after 90 f without a legal move (`STALL_F`) the no-three-in-a-row rule is waived for the next pick. | With the rule strict, the boss idled forever 3–7 u from the player after two slams. |
| G2 | §8.1 | Ember wall HDR (2.6, 1.2, 0.4) → (1.5, 0.75, 0.25), each flame × (0.88–1.12 red, 0.8–1.14 green); barrier rim (2.6, 0.9, 0.3) × pulse → (1.3, 0.45, 0.15) × pulse, plus a 3-texel inner band at alpha 0.1. | The closed arena sat in an orange bloom haze (mean frame luminance +50 %; now +9 %). |
| G3 | §7.6, §8.1 | The player–boss pair separates by the boss's hurt radius (1.2 u) instead of its move radius; `CombatSystem._seeThrough` dithers the boss sprite to opacity 0.45 while the player is behind it within its screen footprint; the boss's death fade starts from its current opacity. | The player disappeared inside / behind the 4 u sprite. |
| G4 | §9.2, §7.5, §8.1 | Additive `PlayerView.sealed`: true while any boss arena is closed. While sealed `_shouldAggro` refuses for non-adds, `_requestToken` refuses for non-boss non-adds, and an engaged outsider walks home and stays calm for 6 s. | Quarry archers aggroed on and shot into the closed arena (4 of 10 hits in the review probe). A first "player inside the rect" test leaked while knockback slid the player across the edge for a sub-step. |
| G5 | §7.7 | Slime: the airborne speed is fixed when the hop is aimed (hop length / 27 f); a seek detour ends with its hop. | The speed was "distance left ÷ time left" and grew without bound during a detour: slimes were flung up to ~11 u in one frame. |
| G6 | §9.3 | Additive `Enemy` members `resetSeek()` (the idle pause, instead of `seek(p, 0)`), `endDetour()`, `decayFlash(h)` (core calls it under `freezeAI`; core never writes an enemy's flash itself). | G5; the frozen-AI flash went through `sprite.setFlash` from core. |
| G7 | §7.6 / E2 | A blocked return's snap home fades the sprite out over 18 f, snaps and fades it in, while the enemy or its home is on screen; off screen it still snaps at once. | A visible teleport. (It still walks home in a straight line — KNOWN_ISSUES COMBAT-18.) |
| G8 | §11.2 / F1 | Marker resolve white (3, 3, 3) → (0.95, 0.88, 0.78); progress ≥ 0.9995 counts as 1; enemy rim × (0.85 + 0.25 · p + 0.1 · pulse) (was 0.3 / 0.15); magma fill (1.0, 0.27, 0.05) × 0.55–0.9, rim (1.5, 0.36, 0.07) × (0.8 + 0.3 · pulse); a fragment whose draped height is more than 0.12 u off the height texel under it is dropped. Program key unchanged. | Phase-3 rings bloomed into a red smear over the player: an instance progress of exactly 1 interpolates to 0.99999994, so `step(1.0, p)` dropped the white on parts of a rim. Spikes where a grid cell spans a cliff. |
| G9 | §11.5 / I1 | `pillar` (1.2, 1.05, 0.5), scale 0.85, new effect option `back: 0.5` (pushed away from the camera; `CombatFx` gets the camera's forward every frame); level-up sparkles 24 → 14; an `impact` / `crit` star on a target behind the player on screen goes to the target's head top + 0.4 u, 0.6 u aside, scale 0.8; the Nova marker fades as it grows and becomes a ring (inner r − 0.45) at the burst. | The pillar and stars covered the player. |
| G10 | §7.8 | A heart at full HP and a mana mote at full MP stay on the ground like a draught at the cap (`CombatSystem.wantsPickup`); a magnetised pickup that becomes useless rests where it is; `collectPickup` returns a boolean. | A draught was lost at the cap; "+0 HP" feed rows. |
| G11 | §9.6 | `hit` fires for the player as the target — `('player', damage, false, 'melee' \| 'projectile' \| 'hazard')` — before `playerHurt`; `engaged(false)` fires on every reset (`setEngaged()`). | Listeners never saw player hits or the end of an engagement by a reset. |
| G12 | §6.9 | While locked on, Shift is ignored: the strafe walks (3.2 u/s with the walk animation). | A running strafe slid sideways in the walk cycle. |
| G13 | §13.2, §6.12 | `CombatHUD.onSlotPress` (skill slots catch the pointer and cast their skill; a click on a slot no longer swings); `Announcer.announce(…, { compact })` (a smaller card at 21vh, used for a level-up while engaged); a level-up granted by the boss kill is announced after the results card; `WorldLabels.number` stacks numbers spawned at the same anchor within 0.52 s; enemy numbers spawn at `labelY` + 0.4 u (elites + 0.3); numbers get a 2 px 8-way outline plus a drop shadow; the elite name plate uses `--lu-fs-sm`; skill labels wrap to two lines; keycap letters in skill slots use the serif face (C no longer reads as O); HP-bar slots are stable (a pack's bars no longer swap slots). | Readability findings. |
| G14 | §4.5 | `Game.init` imports `CombatSystem.js` dynamically: its own ≈ 151 kB chunk, never fetched on a peaceful level (the game entry chunk 236 → 90 kB). `bindings.js` stays static. | Peaceful levels downloaded the combat rules. The engine barrel still exports the combat UI, FX and sheet painters (+≈ 44 kB gzip in the shared chunk, KNOWN_ISSUES COMBAT-17). |
| G15 | §11.4 | `CombatLook` adopts a value someone else changed (the debug sliders) as its new baseline. | Debug edits were overwritten every frame. |
| G16 | §20.1, §21 | The `respawn()` hook during the death screen stops that screen (`_deathGen`), so gold is cut once; `combat.perf.json` resets GPU timings per zone and records `{ min, max }` per zone. | Hook / script accuracy. |
| G17 | §7.3, §8 | The golem's cracks flare during every wind-up (`uGlow` alpha + 0.5–1.0 at 8 Hz). (The pass's per-kind `WINDUP_FLASH` scale was replaced by §27.10 P2.) | The wind-up tint alone was faint on the dark stone sheet. |

### 27.10 Review fix pass: art and level (revision 4)

| # | Section | Change | Why |
| --- | --- | --- | --- |
| P1 | §10.1 | `Sprite3D.setHighlight(r, g, b, a)`, getter `highlight`, uniform `uHighlight` (Vector4) in the **same** program `luminati-sprite3d-lit-fx-v1` (63 programs, unchanged): after `opaque_fragment`, before the `uFlash` mix, `c += (c · rgb · (1 − smoothstep(0.45, 1.2, lum(c))) + rgb · 0.035) · a`; `clone()` copies it. | A mix toward an HDR colour flattens a sprite into a silhouette (COMBAT-03); a highlight keeps the pose — the tell — readable. |
| P2 | §7.2, §7.3, §11.4, I3 | The wind-up pulse is a highlight (1.6, 0.7, 0.3), strength 0.45 ↔ 0.9 at 8 Hz, restarted per wind-up; the elite shimmer (1.6, 1.3, 0.5), 0.12 ↔ 0.24 at 1 Hz; the **boss's** hit flash a white highlight (2.2), 0.6 then 0.3. Other enemies keep the hit-flash mix (0.85 / 0.4, 2 + 2 f); the boss's death flash and the player's hurt flash stay `uFlash`. | Wind-up poses kept outlines, tusks, bows and eyes on every sheet; the boss hit reads as a blanched stone golem instead of a bloom blob. |
| P3 | §14.1 | The chest's `upgrade` field options are `{ value, label }`: None / Max HP +20 / Max MP +10 / Attack +3. Stored values are unchanged. | The editor showed raw ids. |
| P4 | §15.1 | `titleCamera { x: 78, z: 52, y: 1, driftX: 4, driftZ: 2, distance: 34 }` — over the Hollow Mire's falls, ponds, boardwalks and reeds. | Caldera framings were dark, flat stone. |
| P5 | §15.2 | Ruins north rampart (row z 44, x 3–31, blocked, level 8–9; the ledge is z 45–57); Cinder Ridge rebuilt (`ridgeLevel`: one noise-wandering shelf per flank — Ruins 6, Mire 4, lip end 7, crossroads end 5 — then a crest of 9–11 in clumps, up to 30 boulders, no pines north of z 51); the brook meanders (`BROOK`, ±1.5 u, straight only under the bridges, sand and reed banks, stones at the bends); quarry: legend char `q` (dressed stone), cut faces `QUARRY_FACES` (x 4–21 and 74–91, rows 26–28), stacked blocks on the lip, a spoil heap one level up at ≈ (40.4, 29.6), no scatter on the terrace strip x 29–67, z < 27.5; the caldera's sourceless smoke area is removed (the brazier campfires smoke). | Zone bleed (the ledge archers and the quarry's west pack woke each other); the ridge read as stacked planks; a straight brook; a bare quarry; a 3 u² nook sealed by a scattered rock. |
| P6 | §15.3 | Moves ≤ 3 u (printed by the generator's `MOVES`): `glade_slimes_n` (40.5, 87.5) → (38.5, 88.5) and `quarry_boar_elite` (55.5, 32.5) r 1.5 → (56.5, 32.5) r 1 with `spotOffsets [[0, 0]]` (rule 5); `ruins_archers_n` (19.5, 47.5) → (19.5, 48.5) (rule 14). `light_mire` → (72.3, 63.6), `#4fc4dc`, intensity 4.5, range 9, dy 2.4, flicker 0.35, `nightOnly: false`, over a mossy standing stone (a `rock` of size 1.25) with a teal `fireflies` wisp emitter (8 particles, `nightVisibility 0`); four stones on the brook banks. | A light with no visible source that blew out by day; rule findings. |
| P7 | §15.5 | Rule 2 flags pockets from 1 u²; rule 5 adds the waystone-rest test; new rule 19 (zone separation); rule 13 and `clearCrowns` test chests and waystones at yaw −60 / 0 / +60 and keep a walker on 'Ruins east lane' and 'Ridge-foot road' ≤ 50 % covered at yaw ±60. | The review's aggro probes: a player resting at the Crossroads / Quarry Waystone woke a pack, and a pine hid the ridge-pocket chest at yaw +60. |

Not followed as the review suggested (with the reason): the caldera smoke was removed rather than
moved onto the braziers (campfires already smoke); `quarry_boar_w` kept its position (the rampart
separates the zones without the 10 u move the review's numbers needed); no crane or scaffold in the
quarry (the catalog has no fitting prop); the non-boss hit-flash mix keeps 0.85 (it lasts 2 frames).

### 27.11 Review fix pass: editor (revision 4)

| # | Section | Change |
| --- | --- | --- |
| D5 | §17 | **Start spots are exact.** The 3D preview places enemies with the combat spawn's test: `ActorPreview.enemyTest` plus `Viewport3D._isStandable` (= `CombatSystem.standable`: bridge decks over water count, open water does not), prop colliders and villager colliders (r 0.34, as `Npc` adds them before enemies spawn). While the 3D view is shown, the 2D dots and *Check for problems* use that test through `view2d.startTestSource` / `view3d.onPlacementChange`; otherwise the data-only `levelStartTest` of `src/editor/enemyGroups.js` (tiles, decks, water, villager / chest / waystone circles). Enemy and critter groups re-scatter when the ground, a prop with colliders or a villager changes inside their scatter area (`ObjectPreview.takePlacementChanges`, `ActorPreview.rescatter`); the critter preview avoids villager colliders too. `Viewport3D._isWalkable` reads a 4 u grid of the built colliders. |
| D6 | §17 | Only the **boss kind's** `arena` / `gate` are drawn, handled and framed. Dragging an arena corner carries the gate ends lying on the dragged edges; `rotateSelection` turns an enemy group's relative `arena`, `gate`, `area` and `spotOffsets` in exact quarter turns (any other angle keeps them and shows a notice); box select counts only what the 2D map shows (`common.shownOnMap`); two more soft warnings — a gate end more than 0.5 u off the arena boundary (`gateEdgeGap`), an arena left on a non-boss group. New module `src/editor/enemyGroups.js` (`enemyKind`, `isBossGroup`, `arenaOf` / `gateOf`, `enemyArena` / `enemyGate`, `bossArena` / `bossGate`, `strayArena`, `gateEdgeGap`, `dataColliders`, `levelStartTest`); `ActorPreview.js` re-exports the old names. |

Rejected: counting `enemyStartPoints(o)` with a predicate in the Inspector (the count never depends
on it) and sharing one predicate object with `CombatSystem` (the game tests its own TileMap, which
holds every collider; the editor keeps prop colliders outside its TileMap, so it mirrors the rule —
listed in EDITOR.md §10 as duplicated logic and checked on all 24 Cinderwatch groups).

### 27.12 Final verification (revision 4)

| # | Section | Change / result |
| --- | --- | --- |
| V1 | §18 | `vite.config.js` sets `server.watch.ignored: ['**/.check/**', '**/dist/**']`: Vite's watcher walked a large `.check/` directory of generated harness output at every dev-server start and served the first module ≈ 3.8 s late (KNOWN_ISSUES TOOL-16). Measured load to the first gameplay frame: production build Emberfall 2.7–2.8 s (as before combat), Cinderwatch 3.6–3.7 s; cold dev server 3.4 s / 4.5 s — inside the 6 s budget. |
| V2 | §21 | `greedy()` in `sandbox/combat_fixture.js` clears the announcer after its setup kills (their "Level 2" card showed over the victory shot). Greedy runs unchanged: fixture 38.933 s, Cinderwatch 39.083 s (12.5 / 12.983 / 13.6 s). |
| V3 | §2, §23 | Regression results: the 4 shipped levels byte-identical to the baseline hashes; `make-cinderwatch-pass --check` and `make-sample-hamlet --check` byte-identical, Starfall `--out` `cmp`-identical; round trip byte-stable for all 5 levels; Willowmere, Brightwater and Starfall fingerprints identical, Emberfall 230 calls (inside 229–231), 57 programs, 12 lights; every §21 script clean (combo goldens 21 · 13 · 23 = 57; 63 programs at load and after the full tour, max frame gap 16.9 ms; worst 230 draw calls, tick p95 0.4 ms); Cinderwatch fingerprint 165–166 calls, ≈ 617 600 triangles, 12 lights for 12 descriptors, 63 programs, 278 objects; the play-through bot beat Cinderheart in 64.3 s, results card `5:54 · 36 foes · 1 fall · 3 perfect dodges · Lv 6`. |

### 27.13 Runtime (revision 5)

Revision 5 records the known-issues pass of 2026-09-28 (KNOWN_ISSUES, the COMBAT rows and ED-25):
seven builders on disjoint files — runtime, FX and UI, art and level, editor, audio, tooling,
balance — then a code / play / visual / regression review, three fix passes (game, art-level,
editor) and a final verification (§27.20). The rows give the **final** state after the fix
passes; where a fix pass changed a builder's first version, the *Why* column says so. Values the
pass changed are also amended in place above, marked *(rev. 5, §27.x Nn)*.

| # | Section | Change | Why |
| --- | --- | --- | --- |
| R1 | §7.6, §9.2 | **Walk grid** `Nav` ([`src/game/combat/Nav.js`](../../src/game/combat/Nav.js)), built once by `CombatSystem.load()` and on the context as `ctx.nav`: 0.5 u cells (`CELL`, two per tile) holding the ground height at the cell centre; a cell is **open** when it is a walkable tile or walk surface, not open water, ≥ 0.2 u (`CLEAR`) from every static collider (villagers are dynamic and ignored), ≥ 0.3 u (`EDGE`) from the map edge and outside every boss arena grown by 0.5 u. Neighbours connect when their heights differ by ≤ 0.55 (`STEP`, `tileMap.move`'s step: one level or a stair, never a cliff); a diagonal needs both orthogonal cells open; a **tight** cell (an enemy body of r 0.3 does not fit on its centre) is passable but costs +20 and is never cut through. `findPath` is a bounded A* (costs 10 / 14, +6 next to a wall or cliff, ≤ 6000 cells expanded, a path longer than the caller's `maxCostU` counts as unreachable) string-pulled with a body-width line test (`LOOK` 32 cells) into ≤ 24 waypoints; a start or goal in a closed cell snaps to an open one within 1.5 u. Every array is allocated at build time (a search allocates nothing); integer costs and a fixed heap order make it deterministic. `beginStep(n)` / `spend()` ration the searches: `NAV_SEARCHES` = 2 per combat sub-step (a refused enemy keeps its old path or walks straight and asks again); `warm()` runs one throw-away search at load. Cinderwatch: 192 × 240 = 46 080 cells, ≈ 24 250 open, built in ≈ 20 ms (16–48 ms on a shared machine); searches 0.01–0.4 ms, ≤ 868 cells. A context without `nav` (an old mock) chases and returns in straight lines. When the story brings or takes away colliders or walk surfaces, only the cells that change can reach are rebuilt (`buildRect`, [§27.22 K4](#2722-campaigns-revision-7)). | Chasers followed the player's recorded footsteps across level changes (§27.5 E2) and gave up on a player already standing on a ledge (KNOWN_ISSUES COMBAT-06). |
| R2 | §7.4, §7.6 (E2) | **Chase:** straight at the player while \|dy\| ≤ 0.3 and the grid line is clear (checked every 6 f, `NAV_EVERY`), otherwise along a path; the path is renewed after 60 f (`REPLAN_F`), when the player moved 1.5 u from its goal (`REPLAN_D`) or when the walk is stuck, never within 20 f of the last search (`REPLAN_MIN_F`). A waypoint counts as passed within 0.4 u (`WP_REACH`) only when the next waypoint is in a clear straight line for the body, or the enemy stands in the waypoint's own cell; a walk blocked 6 f (`CUT_BACK_F`) right after such a pass goes back and passes that waypoint exactly; every 6 f a way to the current waypoint that is no longer clear forces a new search (`_pathBad`, chase and return alike). The seek anchor restarts when the quarry moves 1.5 u (`ANCHOR_GOAL`), so kiting on a stair does not make enemies give up; a cornered archer strafes 60 f instead of pushing into a wall. **Unreachable:** no path within max(24, 2.5 × (leash + home radius)) u (`CHASE_COST`) sets `Enemy.unreachable`; the engage state gives up at once (home, calm 6 s), and touch aggro (< 3 u) respects that calm until the player is back within melee height. The footstep trail is removed. | COMBAT-06. The fix pass added the waypoint rules and `_pathBad` after the review saw a Ruins ledge archer stuck at the stair foot (its path cut a corner along the cliff), and the touch-aggro rule after a notice → give-up → return loop. |
| R3 | §7.7 | `Enemy.canMelee(ctx)`: the player within `MELEE_DY` (0.6 u) of the enemy's ground and a clear straight way on the grid (re-tested every 6 f). Goblin, slime and boar wind up or strafe only while it holds, and otherwise chase along a path. | The review saw melee enemies wind up below a ledge edge they could not reach. |
| R4 | §7.4, §7.6 (E2, G7) | **Return:** along a path home within max(40, 4 × (leash + home radius)) u (`HOME_COST`), searched again when stuck (60 f) or at the end of a truncated path. The fade-and-snap of §27.9 G7 stays only as a last resort: no path home, or `stuck` (90 f blocked / the 4 s watchdog) after 150 f, or 30 s. | Enemies walked home in a straight line; an archer stuck under a ledge visibly faded away (COMBAT-18). Probes: `ruins_archers_n#0` walks home from four spots at the Ruins stair foot in 129–162 f with no snap and opacity 1 (`tests.nav()`). |
| R5 | §7.4, §7.5 | **Zones.** `CombatSystem.zones` = the level's `region` objects with finite rects, in level order; `zoneAt(x, z, y)` = the first containing the point (a region's `minY` applies, as on the location plate). A group's zone is `zoneAt` of its centre at its ground height, the rect grown to hold its home disc (`Enemy.zone`: index or −1, `Enemy.zoneRect`; core-assigned). (1) `_wakeGroup` still wakes the whole group, but other enemies within 6 u with line of sight only when they share the zone; (2) no **sight** aggro on a player outside `zoneRect` + 3 u (`ZONE_MARGIN`; touch < 3 u and damage still aggro); (3) the leash breaks at once when the enemy is outside `zoneRect` + 3 u, and after 1 s (`ZONE_LEAVE_S`) with the player outside it — besides the 3 s far rule of §7.4. A level without regions has no zone rules; a group centred only in a map-wide region (Cinderwatch's `region_pass`) has none either. | Pack separation was proven for sight only; a chase, a fleeing player or the group wake joined two zones' packs (COMBAT-19). Flee probes (Ruins → quarry lip): two zones engaged 121 / 115 f instead of 198 / 691; chasers never passed their zone + 3 u; the three waystones stay calm (900 stepped frames each). The fix pass added the `minY` rule. |
| R6 | §9.5, §9.3 | **Numeric tags** (a deviation: §9.5 says `tag: string`). Enemy k (its creation slot, `EnemyInit.tagSlot` = index + 1) draws `newTag()` from k · 4096 + 0…4095 (cycling); player attacks and projectiles draw from `TagRegistry.next()` in [2²⁸, 2²⁹), reset by `reset()`; magma ticks use `newTag()`; splash tags are numbers; the player swing's MP record alternates between two reused objects; boulder `arc` objects are pooled. `HitSpec.tag` 0 = untagged. | One string per attack and one per magma tick (COMBAT-21). Tags never leave combat; the stepped goldens did not change. |
| R7 | §20.1, §9.3 | Hooks `stepUntil(pred, maxFrames = 600, dt = 1/60)` (frames stepped, −1 if the predicate never held), `boss.force(move \| null)`, `boss.info()`, `boss.hazards(type?)`, `path(x0, z0, x1, z1, maxU = 80)`; `enemies()` rows gain `zone`, `stats()` gains `nav`. Additive `Enemy` members `unreachable`, `zone`, `zoneRect`, `canMelee(ctx)`, `hazardList(type)`; golem brain members `force(e, move)` / `info(e)`. The fixture's combo, costs and boss tests wait for states; the boss results-card check steps 100 frames of game time; the play bot reads the boss's move through `boss.info()`. | Scripts counted frames through hit-stop and read the golem brain's internals (COMBAT-04, COMBAT-05); the 2.2 s real-time wait for the card timed out on a busy GPU. |
| R8 | §10.1, §7.6 (G3) | `Sprite3D.bodyOpacity` (0..1, default 1): an extra dither fade of the visible quad only; the shadow (proxy or billboard caster) and the blob follow `opacity`. The depth material reads its own uniform `uShadowDither` (= `opacity`): same GLSL and program key, uniform writes only. `CombatSystem._seeThrough` dithers the boss's body to 0.45 through it. | The boss's shadow and blob dithered away with its sprite (COMBAT-16). Programs unchanged (63). |
| R9 | §6.10, §8.3 (G13) | A level-up granted by the boss kill keeps its card, pillar, sparkles and chime for the results card (`_levelUpFlare`, ≈ 1.5 s after the kill). | Part of the white glare over the player at the kill (COMBAT-16). |
| R10 | §4.5, §22.1 | `CombatSystem` imports `FxQuads`, `GroundMarkers`, `FxSprites`, `MonsterSprites` and the combat UI from their own files; `vite.config.js` marks those 9 modules side-effect free (`build.rollupOptions.treeshake.moduleSideEffects`), so the engine barrel's re-exports (all kept, §22.1) put nothing into a chunk that does not use them. See X8. | Peaceful levels downloaded ≈ 44 kB gzip of combat code through the barrel (COMBAT-17). |

### 27.14 FX and UI (revision 5)

| # | Section | Change | Why |
| --- | --- | --- | --- |
| X1 | §11.2, §18 (F3) | The marker height texture always bakes at `res` 4, in row slices of ≤ 6 ms (the constructor, then a `setTimeout(0)` pump, plus ≤ 2 ms per `update()`, at least one row per slice), uploaded once at the end; `object.onBeforeRender` finishes the bake if the batch is drawn earlier. New read-only members `heightReady`, `bakeSlices`, `bakeLongestMs`; `bakeMs` is now the CPU time summed over the slices. The 40 ms budget and the `res = 2` fallback are gone. Cinderwatch: 384 × 480 texels, ≈ 18 ms in 4 slices, the longest ≈ 6 ms. | A slow bake fell back to half resolution and stairs lost their tread accuracy (COMBAT-09). |
| X2 | §11.2 (G8) | Magma is a cellular crust (F2 − F1 of a jittered grid of 1.75 cells per unit, in world texels): basalt plates (0.105, 0.034, 0.018) × (0.8 + 0.6 · cellH) alpha 0.95, a cooling band (0.5, 0.085, 0.02) × 0.7–1.1 alpha 0.86 where F2 − F1 < 0.17, cracks (1.3, 0.5, 0.09) × 0.45–1.05 alpha 0.92 where < 0.08, one plate in six molten (0.9, 0.2, 0.035) × 0.55–0.95 alpha 0.85; a slowly flowing noise on cracks and molten plates; the rim (1.5, 0.36, 0.07) × (0.8 + 0.3 · pulse) at alpha 0.8. Every colour under luminance 1.05. Program key unchanged. | The noise fill read as a smooth orange disc at game zoom (COMBAT-16); the fix pass warmed the plates and raised their alpha from 0.88 (they read purple-grey at night). |
| X3 | §11.3, §19 | Three more override-free burst presets in the existing pools: `victoryEmbers` (streak pool; the `emberBurst` colours at hdr 1.5, peak luminance ≈ 1.03; slow and rising), `victorySparkle` and `levelSparkle` (sparkle pool; `#fff0c8` at hdr 1.15, ≈ 1.01). The active burst pools stay 4. They are primed in `warmup()` and fired by `showcase()`. | At the boss's kill, 3 × 24 `emberBurst` + 24 hdr-6 `sparkle` + the 14 level-up sparkles whited the player out (COMBAT-16). The fix pass lowered the two star presets from hdr 1.3 (they still bloomed at head height). |
| X4 | §8.1, §8.3 | `BossArena.deathBursts(boss)` — 3 × 12 `victoryEmbers` across the screen at the boss's top − 1.4 (the middle one + 0.5) and 12 `victorySparkle` at top + 0.2, centred 1 u beyond the boss from the player and 0.5 u away from the camera — replaces the 3 × 24 `emberBurst` + 24 `sparkle` of §8.3 (`_bossDefeated` calls it; the old bursts remain as a fallback for an arena without it). The boss's death flash is a warm ember tint (1, 0.5, 0.2) at 0.55 for 6 f (`BOSS_DEATH_FLASH`, was white at 1.0); its 150 gold and core drop 1.2 u beyond it from the player. | COMBAT-16. Kill-frame probe: 1 200–1 300 near-white pixels round the player's head in the flash frames (mostly the player's own slash arc), 2 100–4 950 before; the collapsing boss reads briefly as a flat warm silhouette behind the player (the short `uFlash` of KNOWN_ISSUES COMBAT-03). |
| X5 | §11.5 (G9), §6.10 | The `pillar` is gold (1.05, 0.82, 0.32) (was (1.2, 1.05, 0.5), whose base read as white wings at the player's shoulders); the level-up plays 14 `levelSparkle` at y + 1.9 (was `sparkle` at y + 1); core and upgrade pickups play 12 `levelSparkle` at y + 1.9 (was 16 hdr-6 `sparkle` on the chest). | COMBAT-16. |
| X6 | §13.2, D9 | `WorldLabels.setPanels(list)` (each an `HTMLElement` or `{ el, shown() }`), called by `UI.enableCombat()` with the location plate, clock, minimap, controls legend (while shown), vitals, skill bar and boss bar (while visible): numbers, bars, pips, alerts and the reticle move to the nearest spot on screen clear of every shown panel (6 px gap); edge arrows slide inward along their ray and keep pointing at their enemy. Panels < 48 px apart merge into one zone only when their union is ≤ 1.5 × their summed areas (`ZONE_MERGE_AREA`) and neither is given `merge: false` (rev. 11, P10: the boss bar). Panel rects are read only in a `ResizeObserver` callback (re-armed by class / style changes, transition / animation ends, resizes) — never in the frame loop. New getters `HUD.locationElement`, `HUD.helpElement`, `CombatHUD.skillsElement`. `WorldLabels.update` 0.14 ms mean in the sandbox (was 0.04–0.06). Depth occlusion stays declined (D9). | Labels sat under the HUD panels (COMBAT-07). The fix pass added the area rule: merging every near pair made one legend + boss-bar box that pushed numbers in the open lower middle next to the player during the boss fight. |
| X7 | §13.2 | `DeathScreen.prime({ title, subtitle, prompt })` (getter `primed`): draws the hidden screen for 3 frames at opacity 0.004 (`.lu-death.is-prime`), then back to `display: none`; a `show()` during priming takes over. `UI.enableCombat()` calls it with `'You Have Fallen'` / `'Press any key to rise at the camp'`. | The first show cost one long frame (≈ 36 ms alone, 54–90 ms in the death sequence; COMBAT-02). Primed, every frame of it stays at 16–18.7 ms. |
| X8 | §13.1 | Additive **`UI.useCombatUI({ CombatHUD, BossBar, WorldLabels, Announcer, DeathScreen })`** (a static registry); `enableCombat(classes = registered)` builds the components from it (or from `classes`; it throws when neither holds them). `UI.js` no longer imports the combat UI; it and the barrel re-export the five classes from their own files. The combat UI's CSS moved from `ui.css` to `src/engine/ui/combat.css`, imported by those five modules. `CombatSystem.load()` calls `UI.useCombatUI(COMBAT_UI)`, then `ui.enableCombat()`. | COMBAT-17: with R10 the combat UI, its CSS and the FX modules load only with the `CombatSystem` chunk. A first version required `enableCombat(classes)` (a contract change); the review restored the argument-free call through the registry. |

### 27.15 Art and level (revision 5)

| # | Section | Change | Why |
| --- | --- | --- | --- |
| K1 | §10.2 (S6) | The `roll` pose is redrawn (`drawRoll`): side view — the big head leading with the face down, the cloaked back arched, shins and boots underneath with the hands on the shins, the hem flaring with its lining, the weapon along the back; front — the ducked crown with the boots over the top; back — the hair cap drawn after the cloak, outlined and one shade darker, with ears when bare-headed. The child build's bow is drawn at chest height (`BOW_ACTS.aim` `hc` / `b`). Humanoid combat sheets only (traveller, goblin, archer, shaman); the 86 plain-sheet hashes are unchanged. | The roll was a plain ball; the archer's string crossed its face (COMBAT-08). The fix pass redrew the back view (a brown ball in review). |
| K2 | §10.3 | The bat's side view: both wings behind a bigger, whole body (the far wing darker), a tall ear, an outlined head and a 2-px glowing eye. Contrast 2.69 (≥ 1.6). | Small and busy (COMBAT-08). |
| K3 | §15.2 | An on-demand texture `crag` (`Textures.js`, 32 × 32 px = 2 × 2 u, `normalScale` 0.7: upright Voronoi rock pieces, fissures on half the near-vertical borders, soft horizontal ledges, blue-grey stone), outside `TEXTURE_NAMES` and `preload()` (the 46 listed textures byte-identical); the generator's custom legend char **`r`** = `{ top: 'moss_stone', side: 'crag', walkable: false }` on the ridge's 324 rock tiles, set by a last pass `ridgeRock()` after all seeded scattering. No new `TILE_TYPES` char. | Cinder Ridge's `cliff` strata read as a zigzag of layered rock (COMBAT-20). |
| K4 | §15.3 | Moves (printed by the generator): the lodge (47.5, 102.5) → (46.5, 104.75), 4 × 3 without a chimney, with `lamppost_camp_w` → (43, 105.5), the lodge's flower box → (44.7, 106.6) and the camp cat → (45.1, 108.2); `campfire_camp` (47.5, 109.5) → (47.5, 110); the keep (30.5, 50.5) → (30.5, 53), 3.5 u deep, with `torch_keep` → (29, 54.87); `ruins_archers_n` (19.5, 48.5) → (19.5, 49.5) (rule 20). A tree-only avoid (`treeAvoid`) for the keep's back yard keeps the seeded scatter identical. | Roof-hidden path tiles (COMBAT-13): the keep over the lip road, the lodge over the brook walk. The fix pass moved both again against a stricter roof model (knee height, the chimney's every possible spot) and moved the campfire to keep the square open. |
| K5 | §15.5 | **Rule 13** fails (an error, no longer a printed share) when a walker's knee (0.25 u) is behind a roof at yaw 0 at any of six points of a path tile (the centre, the south edge, near both sides; points where a walker cannot stand skipped); the roof model has a 45° pitch, a 0.35 u slab pad, a 0.5 u ridge cap, 0.45 u eaves and barge boards and a chimney box at every spot the house RNG can put it. Its terrain part fails a wall or cliff ≥ 1 u above the feet that hides a walker to the waist at a tile centre, and lists where one hides only the legs (today 10 tiles of the lip road behind the rampart's merlons, KNOWN_ISSUES COMBAT-22). **New rule 20** (chase and group-wake margins): (a) no roaming member of a pack of another region within 6 u in line of sight of a roaming member; (b) the rule-19 fight ring plus a *walked* 3 u drift (`walkBall()` in `levelgen.mjs`, stopped by walls and cliffs) stays out of another region pack's sight aggro. `RULE20_ACCEPTED` (conflicts too large for a ≤ 3 u move, printed as warnings; a stale entry fails) is empty. | COMBAT-13; COMBAT-19 (the generator's part: 97 cross-region pairs checked, one conflict fixed by K4). |
| K6 | §15.3 (P6) | The marsh light gains two `fireflies` emitters over its standing stone: a steady teal core (2 particles at dy 2.2, size 0.75–0.95, hdr 3, `blink: 0`) and 6 rising motes (dy 1.3), `#8af2ff` → `#3cc6ea`, `nightVisibility: 0`. One more particle pool, no new program. | The wisps were subtle by day (COMBAT-16). |
| K7 | §15.1, §15.3 | The level now has 277 objects (57 trees: 6 hand-placed + 51 scattered, was 60; 14 emitters, was 12; 95 rocks); pass order `… ridgeWoods → clearCrowns → ridgeRock → regions`. Bram and Odo carry `script: 'shopkeeper'` (W4). | — |

### 27.16 Editor (revision 5)

| # | Section | Change | Why |
| --- | --- | --- | --- |
| D7 | §17 | Enemy previews go through an editor-only instanced batch, [`SpriteBatch.js`](../../src/editor/viewport3d/SpriteBatch.js) (`ActorPreview.enemyBatch`): per sheet and look one colour draw and one shadow-pass draw (none for bats), one engine `BlobBatch` draw (capacity 512) for all blobs; the instance buffers are filled per render pass from `intersectsFrustum` with the sprites in that pass's frustum, so a kind with nothing in view draws nothing. The sprites stay Sprite3D objects (animation, billboarding, picking, visibility, the selection outline). New groups compile in the background (the view's `compile` hook) and draw themselves until ready; `ActorPreview.primeEnemies()` spends the driver's one-time 40–110 ms first draw when the *Enemy group* tool is picked. The batch mirrors Sprite3D's lit material (keys `luminati-editor-sprite-batch-v1` / `-depth-v1`) and skips sprites with `opacity` or `bodyOpacity` < 1, `combatFx` or `lit: false`. Cinderwatch: 53 enemy sprites 145 → 15 calls, the level 580 → 455, programs 62 → 66; peaceful levels create no batch until an enemy is placed or the tool is picked. | "Enemy previews ≈ 2–3 calls each" (COMBAT-10). The fix pass added the per-pass culling (the first batch was never frustum-culled) and `editor_shell.combat.json` step 5 (look and far-view cost). |
| D8 | §17, §14.1 | A boss group's *Count* stops at 1 in the Inspector (a number field without a slider, a hint); Kind → golem or a Count edit clamps it to 1 in the same undo step (`clampBossCount`); a count above 1 from a file shows a warning and a *Check for problems* line (`bossExtraCount`). The catalog's Count (1–8), `normalizeLevel` and the files are unchanged. | COMBAT-10. |
| D9 | §17 (D5) | `Viewport3D.enemyStartTest(flier, { lazy })` answers in every layout: the built test while the 3D view is shown; while it is hidden (or before a new document's first build) `levelStartTest` — now with box colliders — plus the real TileMap colliders of the props within 4 u of each group's scatter rect (from the view's builds, or a colliders-only build, cached). With `lazy` (the 2D map's source) it returns `null` while a build of the document is due, and the dots are placed again when it is done. The D5 rule "otherwise the data-only `levelStartTest`" now applies only without a 3D view (no WebGL). | 2D-only dots could sit in a rock (COMBAT-10). The fix pass added `lazy`: the first version built ≈ 60 props for their colliders at every open, the default split layout included. |
| D10 | §17 | `Map2DView.hitTest` grades enemy hits: a click only near a group (its ring, arena edge, the 6 px round a start dot, its centre below zoom 7) yields to a **point** prop right under the click or to another group's drawn dot / badge; never to a canopy, an area marker or a bridge / boardwalk / fence the ring crosses. | Zoomed-out clicks preferred enemy groups over props (KNOWN_ISSUES ED-25). The fix pass limited the yield to point props (a ring over a bridge selected the bridge). |

### 27.17 Audio (revision 5)

| # | Section | Change | Why |
| --- | --- | --- | --- |
| M1 | §12.1 | Combat SFX envelopes start at gain 0 (`env()` left a delayed envelope's gain at the default 1.0: `swingHeavy` played a 20 ms full-gain blip, `arrow` 20 ms of raw noise); a `bump()` re-trigger first releases a still-ringing bump over ≈ 6 ms (τ 1.2 ms); stop times lengthened so every voice is ≥ 60 dB down first (decays: `stun` 0.25 → 0.18, `bossRoar` 0.35 → 0.3, `waystone` 0.6 → 0.45, its shimmer 0.5 → 0.4; `gateClose`'s thud ends at 45 Hz, was 36). Levels: `perfect` 0.16 → 0.113; `nova` boom 0.55 → 0.28, air 0.35 → 0.18; `bossRoar` 0.5 → 0.26; `slam` 0.7 → 0.49, noise 0.5 → 0.35; `gateClose` 0.5 → 0.44; `levelup` bumps 0.12 / 0.16 → 0.085 / 0.113, sparkle 0.08 → 0.056; `playerDown` 0.2 / 0.4 → 0.17 / 0.34; `stun` 0.12 → 0.1; `enemyDie` 0.3 / 0.14 → 0.4 / 0.19. `boarCharge`, `bossRoar` and `gateClose` rumble on `_combatBrown()` (a 2 s seeded brown-noise buffer high-passed at ≈ 35 Hz, built on first use). `SFX_NAMES`, `_brown`, the ambience, the song, the buses, compressor and reverb are unchanged; no combat-bus limiter (the worst stress scene peaks at −3.7 dBTP). | The objective QA of `sandbox/combat_audio.html` (COMBAT-11): leaks, −13 … −31 dB gain steps, 16 tails cut 32–50 dB under their peak, big moments 1–4 LU too loud, a harsh `perfect` / `levelup` (their 2–6 kHz band 5 dB above the brightest peaceful sound), 30.5 % of `boarCharge` below 40 Hz and DC flags. Six of its twelve checks failed on the combat commit; all pass now. |
| M2 | §12.2 | `playStinger(name, { volume = 1, duck = 0.3 })`: the additive `duck` option (the default is the old behaviour); `duck: 0` fades the playing track out over 0.35 s and ends it while the music stays on (`musicPlaying` / `musicTrack` unchanged; nothing plays until the next `startMusic({ track })`). `CombatMusic.victory()` passes `duck: 0`; `VICTORY_STINGER` is 18 beats at 108 bpm = 10 s (was 4 bars at 140 bpm = 6.86 s), so the level track starts after the stinger's last chord. | The C-phrygian boss track sounded at −10.5 dB under the D-major fanfare (minor-second clashes throughout), and the level track came in before the stinger ended. |
| M3 | §21 | New QA and listening page [`sandbox/combat_audio.html`](../../sandbox/combat_audio.html) (`combat_audio.actions.json`, `window.__caudio`): every combat SFX at its in-game volume, both stingers, the five music sections, four dense scenes and the victory sequence through the real `CombatMusic`, rendered offline and measured (true peak, BS.1770 loudness, crest, DC, attack, truncation, gain steps, leaks, 2–6 kHz, < 40 Hz, the compressor's gain reduction), with waveform, spectrogram and live playback per row; 12 checks; `identity()` pins the peaceful audio (`PEACEFUL_GOLDEN`), `compare(url)` A/Bs another module. | COMBAT-11 asked for a listening pass; this is the objective half. A human listening pass is still open. |

### 27.18 Fixed-step bot (revision 5)

| # | Section | Change | Why |
| --- | --- | --- | --- |
| T1 | §21 (I11) | Engine additions, opt-in: `Engine#manualStep` (getter / setter; `opts.manualStep`; the URL flag `?fixedstep` — any value but `0` — honoured only with `?autostart` or `?debug`): no animation loop is installed, `start()` / `stop()` only mark the state, frames advance only through `step()`; `step(realDt, { render = true })` (`render: false` runs a frame without drawing it) and `redraw()` (the render step alone, dt 0). Without the flag the engine behaves exactly as before. | The real-time bot's path and fights changed with frame pacing; it had to run alone (COMBAT-14). The fix pass restricted the URL flag (a stray `?fixedstep` froze any page). |
| T2 | §21 (I11) | The bot (`sandbox/combat_play.js`) runs in **fixed step** when the page has the flag: it steps the engine at dt = 1/60 from the level's first frame, 30 frames per real task, with a virtual page clock (`FixedClock`: `setTimeout`, `setInterval`, `requestAnimationFrame` and `performance.now()` from a fixed origin of 1e6 ms follow the stepped frames; 16 microtask turns per frame let promises settle), so the death screen's arm delay, the fades, the dialog close and the results card land on the same frame every run. The game stays on the frame that asked for a screenshot. `verify()` returns `{ summary, verdict, result, … }`: one line of exact numbers with a `digest` (the float bits of the player's and every enemy's state, every frame), `trace` (the digest every 10 s of game time) and `pace` (real ms per 10 s). `until()` stops a loop left over from an eval the harness gave up on; budgets 120 s (`until`) / 150 s (`verify`). | The same tree now gives the same digest on any GPU load (proved on frozen copies of the tree, with and without a concurrent run). |
| T3 | §21 | Scripts: `combat.play.json` starts with a `goto` to `game.html?level=cinderwatch-pass&autostart=1&fixedstep=1` (any `--page` / `--query` works); `combat.play.fast.json` = `start({ renderEvery: 4 })` (the same digest, about twice as fast; keep the program check on the full script); `combat.play.human.json` (W6); `combat.play.realtime.json` = `start({ fixed: false })`, the old real-time run for feel checks (run it alone). | — |
| T4 | §21 | Caveats: in fixed step the combat tick timings read 0 and `__luminati.loadMs` is meaningless (eval steps measure real time with `Date.now()`); CSS transitions still run on the wall clock; a fixed-step run is not the same run as a real-time one. | KNOWN_ISSUES TOOL-17. |

### 27.19 Balance and shop (revision 5)

| # | Section | Change | Why |
| --- | --- | --- | --- |
| W1 | §7.1 | Cinder Bat HP 18 → 24, ATK 7 → 8 (boss adds at Lv 5: 32 → 43 HP); Cinderheart ATK 24 → 22. The golem's HP (1800), phases, moves and brain constants are unchanged. | The Hollow Mire was barely a step up from the glade, and the boss's bat adds were trivial; a human-like player at ≈ 30 % uptime fell in phase 3 in most runs (COMBAT-12). |
| W2 | §6.1 | `upgrades` = `{ maxHp, maxMp, attack, def }`; DEF = `4 + (L − 1) + upgrades.def` (`defFor(L, up = 0)`); `PlayerCombat.upgrade(kind, amount = null)` gains the optional amount (default the chest's `UPGRADES`) and the kind `def`. `setPlayer({ upgrades })` replaces those totals and refills HP / MP. | The shop's wares (W3). |
| W3 | §6.12, §9.1, §9.6, §20.2 | **The gold sink.** `SHOP_WARES` in `rules.js`: the Healing Draught (25, repeatable, up to the carry cap), Whetstone (ATK +2, 120), Ironbark Tonic (max HP +15, 90), Warding Charm (DEF +3, 150) — the last three once per session. The NPC script **`shopkeeper`** (`dialogue.js`; `NPC_SCRIPTS` gains `'shopkeeper'`): the NPC's `dialogue` pages (all on the first visit; later the last page, with *Tell me again* last in the menu to replay the others), then a dialogue-choice menu — *Nothing more* first (mashing confirm never buys), then every ware not sold out with its gain and price, marked *(not enough)* when the gold does not reach — repeated after each purchase; the menu line shows the gold, ATK and DEF; a bought upgrade's toast shows the change (`Obtained: Whetstone — ATK 20 → 22`); refused while engaged (like resting). On a peaceful level it plays the NPC's own dialogue and action. `buy(item)` → `{ ok, reason: 'gold' \| 'full' \| 'item' \| 'sold' }`; `priceOf(item)` covers the wares; new `shopOffers()` → `[{ id, name, price, gain, once, upgrade, sold, available, reason }]`; event `purchase(item, price)`; `state().combat.shop = { purchased: [ids] }`. Bought wares stay bought through death and rest (like opened chests); `reset()` restocks them. A plain `action: 'shop'` NPC still asks for its one item, and on a combat level may now sell a ware by name. | Gold piled up (454–634 by the end) with only draughts to buy (COMBAT-12). The fix pass added *Tell me again* (Odo's boss hints were unreachable after the first visit), the stat line, *(not enough)*, the engaged refusal, and raised the Warding Charm to DEF +3 (+2 took ≈ 6.7 % off the damage at Lv 5 for 150 gold; +3 ≈ 9.7 %). |
| W4 | §15.3, §15.6 | Bram and Odo run `script: 'shopkeeper'` (Odo also `action: 'shop'`, `item: 'Healing Draught'`); Bram's second page and Odo's fourth introduce the wares. Coverage requires a `shopkeeper` NPC at the camp and at the Quarry Waystone. | — |
| W5 | §8.3 | Measured (fixed-step bot: expert and a seeded human model, full routes and boss-only probes; the stepped greedy runs): greedy 39.9 s whole / 14.0 s phase 3 at Lv 5 (34.7 / 11.4 s with every chest and ware — Lv 5, ATK +5, max HP +35, max MP +10, DEF +3); the human model at 30–35 % uptime 83–114 s (mean 95.5 s), all 18 human probes 72–114 s; an expert 45–87 s without a fall in 8 runs. The human model still falls in phase 3 in 7 of 18 probes (0.72 falls per run, was 1.28); zones: glade 0 damage, the Ruins 94–110 s / 0.24–0.74 of max HP, the Mire 50–70 s / 0–0.29, the quarry 74–181 s / 0.14–0.96 (the hardest normal zone in 6 of 8 runs); gold left at the end 158–286. Levels unchanged (Lv 2 after the glade, 3 after a branch, 5 at the boss). | A human play-test of phase 3 remains (KNOWN_ISSUES COMBAT-12); the next data levers are Cinderheart ATK 21 or phases [0.70, 0.30]. |
| W6 | §21 | The bot's balance settings: `start({ route: 'ruins' \| 'mire' \| 'full' \| 'boss', skill: 'expert' \| 'human' \| { reaction, miss, burst, pause, healAt, skillDelay, drinkBusy, seed }, shop, at, kill, player, delay })` — the human preset reacts 0.25 s late, misses 20 % of telegraphs, attacks in bursts at ≈ 30 % uptime, uses skills 2 s late and drinks below 30 % HP even mid-combo; `report()` adds `zones`, `bossAttempts`, `damageBy`, `bought`, `goldSpent`, `draughtsDrunk`, `bossUptime`, `segments`; after a fall at the boss the bot restocks draughts from Odo; `verify()` also requires the Whetstone bought at Odo's. New `combat.play.human.json`. The fixture gains `tests.shop()` (and a menu screenshot) and `tests.zones()`; `combat.boss.cw.json` the equipped greedy run (`greedy({ level, upgrades })`). | — |

### 27.20 Final verification (revision 5)

| # | Section | Change / result |
| --- | --- | --- |
| V4 | §2, §23 | The four peaceful level files byte-identical; `make-cinderwatch-pass --check` and `make-sample-hamlet --check` byte-identical, Starfall `--out` `cmp`-identical; the round trip (and an editor save round trip after *Level settings › Apply*) byte-stable for all 5 levels. §16 fingerprints: Emberfall 231 calls / 57 programs / 12 lights, Willowmere, Brightwater and Starfall identical to the baseline (triangle counts wobble by ≤ 30 between runs); editor stats of Emberfall (576 / 60) and Starfall (915 / 62) unchanged; `combat.peaceful.json` 57 / 59 programs; the 86 sheet hashes unchanged; `identity()` of the peaceful audio true. |
| V5 | §21 | `enemy_ai` 141 / 141 (0.054 ms per sub-step); combo goldens 21 · 13 · 23 = 57; the fixture's greedy run 38.933 s; `combat.boss.cw.json` greedy 39.883 s, equipped greedy 34.733 s, boss labels within 0.6 px of their anchors; `tests.nav()`: home in 129 / 141 / 147 / 161 f, climbs 148 / 127 f, no give-up while kiting; every other §21 script clean. Stepped goldens against the combat commit moved only for intended reasons: the standing ring hit 20 → 18 (golem ATK 22), the greedy run 39.083 → 39.883 s (the bat adds' 43 HP), the stairs test's engage frame 143 → 146 (paths), bat HP 18 → 24 / adds 32 → 43, and unasserted pool counts (fx 35 → 33, pickups 35 → 32 in `combat.boss.json`: the deferred level-up flare and the new death bursts). |
| V6 | §18 | Cinderwatch: ≈ 163–164 calls / ≈ 611 900 triangles / 12 lights / 63 programs at the spawn, 277 objects; ≤ 188 calls per zone with the enemies hidden; worst 229–231 of 300 with woken enemies; tick p50 / p95 0.2 / 0.3 ms; `combat.programs.json` 63 = 63 with a max frame gap of 18.5 ms — run alone (on a shared GPU its gap assertion fails even on the combat commit's code, KNOWN_ISSUES TOOL-18). Editor on Cinderwatch 455 calls / 66 programs. |
| V7 | §21 | Bots: `combat.play.json` and `combat.play.fast.json` identical — `ok \| fixed done \| f 18261 (304.350 s) \| Lv 6 xp 37 gold 163 potions 4 hp 195 \| kills 36 deaths 1 chests 5 pickups 104 \| boss down 44.483 s [11.133 19.567 13.783] \| … \| digest 54c13fa2` (all three wares bought); `combat.play.human.json` digest `171d83e6` (390.7 s, the boss won first try in 75.0 s with 2 draughts); `combat.play.realtime.json` ok (316.7 s, the boss in 57.1 s, one planned fall; it bought two wares). Every run: 0 page errors, console errors, warnings and failed requests. |
| V8 | §18 | Production build: a peaceful level fetches `main` (72.6 kB gzip), `LevelStorage` (99.0) and the shared `WeatherLook` chunk (225.8) — never `CombatSystem` (77.9, with the combat UI), `defs` (11.5) or `CombatSystem.css` (5.8); `main.css` 13.9 kB gzip (was 18.8); the editor links only `editor.css`. Peaceful JS gzip 372.9 kB before combat → 422.5 on the combat commit → ≈ 397 now (the rest: KNOWN_ISSUES COMBAT-23). |

### 27.21 Type-check pass (revision 6)

The type-check pass (2026-09-30, [JSDoc type checking](../development/CONVENTIONS.md))
wrote the §9 and §20 interfaces as types from the code — [`src/game/combat/types.d.ts`](../../src/game/combat/types.d.ts)
and the typedefs of [`defs.js`](../../src/game/combat/defs.js) — and checked the core, the brains,
the hooks and the enemies sandbox's mock against them. It changed no runtime code; these rows
record where the text above and the code differ (each is also noted on the member in
`types.d.ts`).

| # | Section | Change | Why |
| --- | --- | --- | --- |
| J1 | §9.2 | `ctx.spawnAdd(kind, x, z, level)` drops `level`: core's `_spawnAdd(boss, kind, x, z)` has no level parameter, and adds are pooled at `ADD_LEVEL` 5 — the value `golem.js` passes — so nothing changes at run time. The type keeps `level`. | Found when typing `CombatSystem._makeContext` (a parenthesised cast forwards the argument there now). |
| J2 | §9.2 | `ctx.emit(event, e, …args)` forwards one extra argument: core's `_onSignal(event, e, a)` reads only the `bossPhase` phase; no brain passes more. Typed `emit(event: BossSignal, e, phase?, b?)`. | As J1. |
| J3 | §9.2 | "Every member is always present" and "a mock implements exactly this list": the enemies sandbox's mock `PlayerView` has no `swing` (§27.1 I7) or `sealed` (§27.9 G4), and its `action` is `'a1'` where core uses `'attack'`; the brains tolerate both (`P.swing ?? 0`, a truthiness test on `sealed`), so the type marks `swing` and `sealed` optional. `marker(spec)` accepts a partial spec, like `setMarker` (core fills in `MARKER_DEFAULTS`); `fx()` returns core's boolean (false when the pool is full), typed `void`; `enemiesNear`'s `out` stays required although core defaults it. | The mock is checked against `CombatContext` too. |
| J4 | §9.3 | `EnemyInit` also takes `tagSlot` (§27.13 R6); `group` may be null or undefined (the boss's adds; the Enemy reads it with `?.`); `arena` is the `BossArena`, through which core also reaches `center`, `close?.()`, `open?.()` and `deathBursts` (and the fixture `containsGrown`) — typed `EnemyArena` with those optional members. | The old `EnemyInit` typedef in `Enemy.js` typed `group`, `def`, `sheet` and `arena` as `object` and lacked `tagSlot`. |
| J5 | §9.4 | `ENEMY_DEFS` has fields §9.4 does not list: goblin `strafeSpeed` and boar `chargeSpeed` (data only — the brains use their own constants), golem `epithet` and `phaseSpeeds`. `scaledDef` adds `kind`, `level`, `elite` and `guaranteedHeart`. Typed as `EnemyDef` / `ScaledEnemyDef` (JSDoc in `defs.js`, re-exported by `types.d.ts`). | — |
| J6 | §9.5 | `HitSpec.tag` is a number, 0 = untagged (rev. 5, §27.13 R6; the `tag: string` of the text is the older form). `ProjectileSpec`: `arc.apex` is optional (default 2) and `speed` / `range` / `radius` default to 10 / 12 / 0.2 in `Projectiles.spawn`; `vy`, `poise`, `pierce`, `splash`, `arc` are optional. The type keeps `HitSpec` `mv` / `kb` / `tag` and `ProjectileSpec` `dirX` / `dirZ` / `speed` / `range` / `radius` required, as the contract does (KNOWN_ISSUES TC-04). | — |
| J7 | §9.5 | `HitInfo.source` lists `'enemy'`, but no hit produces it: sources are `'melee'`, `'skill'`, `'projectile'` (`PLAYER_HIT_META`), and the player is hurt through `PlayerCombat.hurt` with its own record `{ damage, kb, kbDirX, kbDirZ, knockdown }`. `'enemy'` stays in the union (additive). | — |
| J8 | §20.1 | `boss.info()` also returns `alive` (AUTOMATION_API.md §3.4 lists it; the `hooks.js` comment did not); `press()` / `hold()` accept any string and return false for a name that is not a `CombatAction`. `window.__game.combat` is checked against `CombatHooks`. | — |
| J9 | §7.4, §9.3 | The `Brain` type has every member optional (the golem has no `engage` / `attack`, the other kinds no `update`), but `Enemy` calls `engage` and `attack` unguarded for every kind except the boss, and `update` for the boss: a new non-boss brain must have `engage` and `attack`. Each brain is `/** @satisfies {Brain} */`, its methods typed `@type {Brain['…']}`. | — |
| J10 | §7.7 | Not a type error, found by the contract review and confirmed: the goblin's back-hop pattern `MELEE_ACTION` never matches Whirl Slash (action `skill1`), and there is no `rollslash` action (the roll slash runs as `attack`). So goblins do not back-hop from Whirl Slash. Not fixed by the pass (it changed no runtime code) — KNOWN_ISSUES COMBAT-24. **Fixed 2026-10-01:** `MELEE_ACTION` is `/^(attack\|skill1\|a[123])$/` (combo steps and the roll slash, Whirl Slash, the sandbox mock's swings). | — |

### 27.22 Campaigns (revision 7)

Additive (2026-10-07, [CAMPAIGN_FORMAT.md](../specs/CAMPAIGN_FORMAT.md),
[Campaign lifecycle](../specs/CAMPAIGN_FORMAT.md)): a
campaign switches between combat and peaceful levels inside one page, so the combat system can now
be created and disposed more than once per page.

| # | Section | Change | Why |
| --- | --- | --- | --- |
| K1 | §4.5, §9.1 | `CombatSystem.dispose()` undoes what `load()` installed on the shared objects: the key and pad bindings it replaced (`input.saveBindings()` before `addBindings`, `restoreBindings` on dispose), the mouse buttons (`input.disableMouseButtons()`), `rig.stickZoom` (0) and the combat UI (`ui.disableCombat()`). `Game.swapLevel` disposes combat before the next level is built, so a next combat level installs its own. | A peaceful level after a combat level must not notice combat: no combat HUD, bindings or `window.__game.combat` (the campaign tour checks it). |
| K2 | §6.1 | `exportProgress()` → `{ level, xp, gold, potions, upgrades, wares }` and `importProgress(p)` (clamped; full HP / MP / SP): the campaign carries the player's progress from one combat level to the next. `openedChests()` / `markChestsOpened(ids)`: chests opened on an earlier visit stay open and empty. Enemies are back on every visit *(revision 8, K5: a defeated group stays defeated until a waystone rest)*. | — |
| K3 | §19 | A combat level reached by travel gets the warm-up `init` gives the first level (`combat.warmup`, both compiles, five frames, `endWarmup`), behind the fader: the quarry of the demo campaign keeps 63 programs through `showcase()`. | No program may compile during play. |
| K4 | §7.6 | **Partial walk-grid rebuild** (2026-10-07, KNOWN_ISSUES STORY-04). `Nav.build(blocked)` remembers `blocked` (`nav.blocked`); `Nav.buildRect(minX, maxX, minZ, maxZ)` (world units; returns the cells whose flags it recomputed) recomputes the heights and open bits of the cells whose centre lies within `CLEAR` (0.2 u) of the rect, plus one cell, and the wall / tight bits one cell further (the wall test reads the 8 neighbours, the tight test the ground 0.3 u from the centre) — 2 cells (1 u) beyond the rect grown by 0.2 u — and keeps `stats.open` / `stats.tight` by difference: `h`, `flags` and the counts end byte-identical to a full `build` of the TileMap as it is (a rect that is not one — NaN, min > max — rebuilds everything). The search state needs nothing (each search starts a new generation of `_seen` / `_closed`). `CombatSystem.rebuildNav(rect = null)`: with `{ minX, maxX, minZ, maxZ }` — the union of the changed colliders and walk surfaces, as `World.applyStory` returns it — `buildRect` on it; without, the full build as before. Measured (`sandbox/combat.navrect.json`): 0 mismatches against a fresh full build in 300 random changes on Cinderwatch and 150 each on Gildhaven and Starfall Vale (colliders and walk surfaces added and removed, bridges with posts, at cliffs, stairs, water, the boss arena and the map edge); a 10 × 3 u bridge with four posts (275 cells) 0.05–0.1 ms against a full build of 5 ms on Cinderwatch (warm; ≈ 20 ms cold at load) and 14–20 ms on the 128 × 128 levels. The fixed-step bot's digest is unchanged (no story there). | A presence change on a combat level rebuilt the whole grid at once: 14–42 ms on a big level, one hitch per change. |
| K5 | §6.12, §9.1 | **Defeated groups stay defeated** (revision 8, 2026-10-07, KNOWN_ISSUES CMP-03). `defeatedGroups()` → the ids of the level's enemy groups whose every foe has fallen (a boss's adds do not count; present or not); `markGroupsCleared(ids)` → those foes are simply not there: `Enemy.vanish()` (hp 0, state `dead`, not drawn — no brain call, burst or fade), no XP, loot, `kill` event (so no story `cleared` event) or kill count; a boss among them sets `bossDefeated`, leaves the map and its arena stays open. The campaign saves the list per base level (`CampaignState.cleared`, [CAMPAIGN_FORMAT.md §7](../specs/CAMPAIGN_FORMAT.md#7-saved-games)) whenever it saves in the level or leaves it, and gives it back as the level is entered (`CampaignRuntime._restoreCombat`, after the chests). A waystone rest (`resetEncounter({ full: true })`) brings the fallen back in place as before, so their groups leave the list; a defeated boss stays on it. Checked by [`sandbox/campaign.cleared.json`](../../sandbox/campaign.cleared.json): the quarry's floor pack killed, gone after a travel out and back (no kill, drop, XP or story run), back after a rest, gone again after a reload and Continue. | A place started over on every visit (KNOWN_ISSUES CMP-03). |
| K6 | §4.5, §7.6, §9.1, §20.2 | **Live enemy groups, chests and waystones** (revision 8, KNOWN_ISSUES CMP-04). `enemy`, `chest` and `waystone` are `LIVE_STORY_TYPES` (`Travel.js`): a campaign keeps every one in the level it builds, so `load()` creates every group (all kinds' sheets, every sprite, warmed by §19) and the World builds conditioned chests and waystones as story groups. `applyPresence(present)` (StoryRunner.applyPresence, after `World.applyStory`; only objects with a `when` / `unless` are read: 0.1 ms median, ≤ 1 ms in the check) keeps the absent ones out of play: an absent group's foes are hidden and dormant (`_absent`, in `_hidden` like the unspawned adds: no AI, hits, minimap dot, `state().combat.enemies` count — `absent` counts them —, `enemies()` / `wake` / `kill` / `damage` hooks skip them); one taken mid-fight drops the lock-on, aggro, tokens, markers and projectiles, the living are put back home at full HP, and its boss's fight ends (`_resetBoss`: gate open, adds hidden, bar off); a boss's arena of an absent group closes nothing (`BossArena.present`: no exclusion in `_moveGround` / `_moveFly`, the walk grid's `blocked` test opens it — `nav.buildRect` on its rect —, its map marker `hidden`). A group that comes back spawns at home (`reset`, no reward); its fallen stay fallen. `resetEncounter` and the `reset` hook keep absent groups hidden. Chests: `absent` (not discovered, opened or on the maps — the marker's `hidden` getter —; an opened chest that comes back stays `disabled`, which `World.applyStory` would otherwise clear); waystones: `Waystones.setAbsent` (not attuned or rested at; the checkpoint it held falls back to the spawn). Checked by `sandbox/combat.presence.json` (removed) on the combat fixture with conditions (54 programs at load = after every change). | Enemy groups, chests and waystones followed their conditions only on entering. |
| K7 | §4.5, §19 | **Combat's burst pools released** (revision 8, KNOWN_ISSUES CMP-05). `warmup(far)` records the burst pools its bursts created (`Particles.burstPools()` before and after: the `hitSpark` streak pool and the `healGlow` star pool, plus `splash` / `sparkle` on a level without waterfalls) and `dispose()` releases them (`Particles.releaseBurstPools`: meshes out of the scene, geometry and material disposed, the cached configs forgotten), so their programs go: the demo's Mill Road keeps 58 programs after the quarry (60 before the fix). A combat level reached again re-creates them in its travel warm-up (`showcase()` compiles nothing). The fixed-step bot's digest is unchanged (`1d81f069`). | Leaving a combat level for a peaceful one kept the combat bursts' pools. |

### 27.23 The pixel UI and languages (revision 11)

Additive (2026-10-09 / 10, [PIXEL_UI.md](../specs/PIXEL_UI.md), [I18N.md](../specs/I18N.md)): the
combat UI redrawn after mockup G · Gilded Today in English, Japanese and Simplified Chinese, then
re-fitted after the review. Every class name, getter, test hook and pool of §13 is kept; the
look described in §13.2's bullets is superseded by PIXEL_UI.md §5 and
[ui.md §10](../architecture/modules/ui.md#10-combat-ui-combat-levels-only). The fixed-step bot's
digest is unchanged (`1d81f069`) and the program count after warm-up equals the count after a full
fight (63 = 63).

| # | Section | Change | Why |
| --- | --- | --- | --- |
| P1 | §13.1, §13.2, U2 | The five components are pixel art at the UI root's scale (`--px`, `--fpx` = ⌈px / 2⌉; U2's private `--lu-px` is gone), placed as groups in art px of G's 640 × 360 frame: the vitals a `tl` group under the place plate (36 art px down, 42–43 in CJK), the skill bar a `br` group, the boss bar a `bc` group, the cards `tc`, the death screen `mc`. `CombatHUD.js` exports `anchorGroup(el, at, x, y, w, h, sc)` for elements the components keep. | The mockup. |
| P2 | §5.2, §13.2 | Every combat string is in `src/game/combat/strings.js` (the `combat` namespace, registered by the `CombatSystem` constructor before `ui.enableCombat()`): the legend rows (`{ keys, label, id }`), the pad hint (`t('combat.padHint')`; `PAD_HINT` stays as its English source), toasts, the death screen, cards, the shop's menu. Enemy, ware and place names are translated by id; identities stay English (`buy(name)`, `state().combat`). Additive: `shopOffers()` rows gain `label` and `gainLabel`; `wareLabel(item)`, `displayName(e)` (an elite's bar), `upgradeText(what)` (`upgraded.*` sentences per language), `Checkpoint.place` and `placeName(cp)`. Chinese loot gold reads `+{n} G`. `pixelSvg` / `svgUrl` (U10) stay exported, unused. | Three languages. |
| P3 | §6.11, X7 | `UI.enableCombat()` primes the death screen once `fontsReady` has resolved, with the translated title and prompt; the stepped vignette costs ≈ 18 ms per screen size (KNOWN_ISSUES COMBAT-02). | The prime must render the texts and faces the screen will show. |
| P4 | §13.1 | `BossBar` sets the root class `lu-root--boss` from `show()` until 600 ms after `hide()` (at once on `dispose()`); the controls legend steps aside under it and under the death screen; `WorldLabels` stops counting a panel CSS hides. | G's combat screen has no legend; it ran under the boss's cartouche and bar. |
| P5 | §13.2 | `Announcer.announce(…, { y })`: the card's top in art px (a number, or a function read when the card shows). Combat puts a level card at 108 while the area banner shows and the results card at 104 (`CombatSystem._announceAt`). | Cards covered the area banner. |
| P6 | §13.1 | The skill bar and the purse dim to 0.55 in a dialogue (no clicks); `is-tight` hides them only where the dialogue window would overlap (below 632 art px wide: 1024 × 768). The dialogue window narrows clear of a shown skill bar (`DIALOG_RIGHT` follows it). | The dialogue and the skill bar shared a corner on small screens. |
| P7 | §13.2 | At an odd px (1920 × 1080) the English slot names and keycap digits take G's 5-art-px cap in Jersey 15 at one device px a font pixel (`slotNameFace`, `keyDigitFace`); the slots stay 30 art px apart unless their names need more. A crit is Jersey 10 at twice the half-size font pixel, a 4 : 3 step over a hit. A Japanese or Chinese gains line has the numbers' `ol8` outline. | At px 3 names ran into each other, a digit outgrew its keycap and a crit was the size of a hit. |
| P8 | §13.1 | The boss bar is max(220, min(334, artW − 260)) art px wide; a long boss name is cut to keep room for the epithet and the gems. | It ran under the skill bar at 1024 × 768. |
| P9 | §13.2, X6 | Edge arrows stay at least 19 art px apart along the border; the area banner's card is a keep-out zone while it shows (`PanelSpec.box`); the labels' boxes are their drawn art and line boxes at every step of the motion, so `panelOverlaps()` passes at px 2 and 3. | Two arrows read as one; labels ran over 'MOSSY GLADE'. |
| P10 | §13.2, X6 | `PanelSpec.merge` (additive): `false` keeps a panel's keep-out zone apart from every near panel's; `UI` passes it for the boss bar. | The skill bar + boss bar union measured 1.39–1.50 × their areas (1024 × 768 in every language: the boxes overlap by 20 px; Chinese at 1280 × 720: the CJK cartouche is 12 px taller), under the 1.5 rule, and the merged zone covered the open lower middle in boss fights (numbers, bars and the reticle there pushed 16–49 px off their anchors: COMBAT-07 again). Kept apart: drift ≤ 0.42 px at 1024 × 768, 1280 × 720 (zh), 1600 × 900 and 1920 × 1080. |
| P11 | §13.1, P4 | `Announcer` sets the root class `lu-root--results` while a results card shows; the controls legend steps aside under it as under `lu-root--boss`. | The boss bar hides 2 s after the kill but the results card stays 7 s: the legend came back in the middle of the results, and at 1024 × 768 the card's lower left corner covered its top right. |
| P12 | §9.8, §13.2, P2 | **Names by identity** (content text keys, [I18N.md §4](../specs/I18N.md#4-content-text)). `displayName(e)` shows a named group's name as a term (`term`; a group named as its kind, Cinderwatch's *Cinderheart*, reads as the kind's name where no table has the term), else the kind's name; `wareLabel(item)` a ware of `SHOP_WARES` by its id, any other item as a term; the results card's level name is a term. `Checkpoint.unnamed` (additive): a waystone whose object has no name (`name` keeps the English `Waystone`); `placeName(cp)` shows it as `t('game.default.waystone')`, a named one as a term. The chest's and an unnamed waystone's examine texts are the UI strings `game.default.chest` / `waystoneText` (`InteractText.linesDefault`, `speakerDefault`). Identities stay English (`state().combat`, `buy(name)`, the save). The fixed-step bot's digest is unchanged (`1d81f069`). | Names are identities: translated by the name, not by where it is written; code defaults are UI vocabulary. |

Checked by `sandbox/combat.hud.tour.json` (in the game, en / ja / zh at 1024 × 768, 1280 × 720 and
1920 × 1080: the legend beside the boss bar, the results card and under the death screen, cards vs the banner, the
banner keep-out, skill-name gaps, edge spacing) and `ui.combat.actions.json` (the open-lower-middle
probe expects 6 panels: the legend steps aside under the boss bar).

### 27.24 A party of four (revision 12)

Additive (2026-10-11,
[Party balance](../specs/PARTY.md#9-the-demo-the-companions-of-cinderwatch-pass)):
Cinderwatch Pass gains two companions, and its data is balanced for the player with all three —
a static table, no scaling by the party's size; alone the pass is hard by design. No rule of the
combat code changes: the level's enemy groups and banners (`tools/make-cinderwatch-pass.mjs`)
and the golem's HP (`defs.js`) are data. The companions' side of the fight is §28.

| # | Section | Change | Why |
| --- | --- | --- | --- |
| Q1 | §15.3 | **Two more companions** ([PARTY.md §9](../specs/PARTY.md#9-the-demo-the-companions-of-cinderwatch-pass), [cinderwatch-pass.md](../design/levels/cinderwatch-pass.md#the-companions-and-the-story)). Sister Ilse (`ilse`, cleric preset — her staff makes her a mystic) stays at (50.5, 111.5) as a `post` villager facing down (her wander 1.0 and speed 0.7 kept: her keep-clear disc, so the scatter, is unchanged), `title: 'Keeper of the Waystones'`, with a talk script (`ILSE_TALK`): her three pages on waystones and an offer, `party join ilse as mystic support` (the party's healer). Rook (`rook`, new; `hunter` preset with the `spec` `ROOK_LOOK` — his bow makes him a ranger) stands at (40.5, 112.5), south of the sparring yard, `post`, facing right, name plate `#a58ad8`, `title: 'Scout of the Cinderwatch'`, two fallback pages and `ROOK_TALK`: `party join rook as ranger balanced`. Both scripts have Sela's shape: as a member *Tactics…* (`party menu`), *Part ways* (asked twice: `party leave`, `home`), *Lead on*; a full party (`if party >= 3`) hears no offer. Sela's offer gains that full-party line, and her join line an `if party = 1` / `else` pair ("Then the watch marches with you…" when Ilse and Rook joined first). Story events: `ev_rook_ruins` (the Bramble Ruins inside their outer wall, x 4–41, z 44–71.5, `if: party:rook`: `emote rook !`, a bark, `party rule rook hunter` — *Hunt Casters*), `ev_ilse_caldera` (the caldera stair, `if: party:ilse`: a bark); `ev_sela_caldera` runs `if: party:sela and not party:ilse` (Sela turns to *Support* only when Ilse is not there to heal). 283 objects (was 280: Rook and the two events); nothing of the scatter moved. | The camp's sister should join, with an archer beside her; with Sela the party is full (at most 3 companions) and holds one member of each class. |
| Q2 | §7.1, §8.3, §15.3, §15.5 | **Balanced for a party of four.** The glade is fought by three (Rook and Ilse join at the camp), the rest by four (Sela at the Crossroads). Groups (count × level), before → after: the glade's slimes 3 / 4 / 3 → 4 / 5 / 4 and goblins 2 → 3, Lv 1 → 2; the Ruins' gate goblins and slimes Lv 2 → 7, the court 2 goblins Lv 3 → 3 goblins Lv 8, the shaman Lv 3 → 8, the archers Lv 2 → 7 (west) and 3 → 8 (north); the Mire's south bats and slimes Lv 2 → 6, the islet and north bats, the shaman and the goblins Lv 3 → 7; the quarry Lv 4 → 8 (Old Ironhide too); Cinderheart Lv 6 (display only), **HP 1800 → 5200** (`ENEMY_DEFS.golem.hp` — Cinderwatch is the golem's only level). Hostile foes 50 → 55 with the boss; more would break rule 15 (its peak is now exactly 30, at (56, 70)), so the levels carry the rest (`scaledDef` unchanged: HP +20 %, ATK +12 %, XP +25 % a level). The Ruins stay the harder branch (Lv 7–8), the Mire the gentler (Lv 6–7). XP: the whole glade 149 (was 84), the Ruins 395 (189), the Mire 321 (189), the quarry 581 (370), Cinderheart 400; the player meets Cinderheart at Lv 6 (was 5). **Nothing scales with the party:** `ENEMY_DEFS` (but the golem's HP), `scaledDef`, the token budgets (melee 3 / ranged 2) and the companions' numbers (`ALLY` — its `partyAtk` included —, `CLASS_STATS`) are unchanged. Ferryman's Lantern's two slimes are unaffected (the slime's data is unchanged). | The solo table was too easy for the full party. Measured beside it (the bot's human model, §27.19 W6): the Ruins 59.6 s / 0.27 of max HP (the companions took 11 of 12 kills), the Mire 52.3 s / 0.20, the quarry no damage taken on either route, Cinderheart 42–45 s — about half the solo targets of KNOWN_ISSUES COMBAT-12 — and the companions killed Old Ironhide before the bot's planned fall. Balanced for four, not scaled by the party's size: solo play is meant to be hard. |
| Q3 | §15.5, §15.6 | `validate()` rule 16 also checks each banner's `· Lv a–b` against the level range of the hostile packs at home in its zone (the first region holding the home). The four banners: `Slimes and goblins · Lv 2`, `Goblins, archers and a shaman · Lv 7–8`, `Bats, slimes and a shaman · Lv 6–7`, `Ironhide boars and archers · Lv 8` (translated anew in ja / zh). `coverage()` gains three rows: a villager who joins as a warden, a ranger and a mystic (`party join … as <class>`) — Sela, Rook, Ilse. The level's `description` says it is balanced for a party of four. | The banners name the danger and can no longer drift from the table; the coverage rows keep the party the balance assumes. |
| Q4 | §21, §23 | **The play-through bot plays beside the party** (`sandbox/combat_play.js`). New task `join`: talk to the villager (every page, its offer's *Walk with me*); it fails unless the villager is a member then. The plan recruits Rook and Ilse at the camp after the drill reward and Sela at the Crossroads after the rest (tasks marked `party: true`). Start option `party` (default true; `false`: alone, no `join` task, `/solo` in the summary). `verify()` wants the party of three at the end (with `party`). `summary().line` adds `\| party 3 kills <n> downs <n>`; `report()` gains `party` (`members`, `kills`, `dmg`, `hurt`, `downs`, `healed`, `playerDmg`, `playerKills`) and per zone `allyKills` / `allyDowns`. The planned fall beside Old Ironhide: with a party its members hold back (`__game.party.rule(id, 'passive')`, the test hook — a player would pick *Hold Back*) while the player falls, and the respawn task gives them their rules back; with no Old Ironhide left (a fight woke and killed him first — the expert alone does) the fall and its respawn check are skipped, a note, not a failure (`verify()` still wants a death and a respawn on the Ruins route). Fixed step: a chunk the game loads mid-run (the party's, at the first join: `Game.ensureParty` → `_partyLoad`) arrives in real time; `runFixed` now waits for it between two frames (`chunkLoads`), so the run no longer depends on how fast frames go. | The level is balanced for the party, so its play-through recruits it. Before `chunkLoads`, `combat.play.json` and `combat.play.fast.json` gave different digests (`f0646668` vs `60e442e4`). |
| Q5 | §8.3, §18, §21 | **Measured** (fixed step). The human model beside the party, three runs (seed 1 and 2 on the Ruins route, seed 1 on the Mire; per zone time / damage taken in shares of max HP): the glade 28–35 s / 0–0.06, the Ruins 65 s / 0.46 and 99 s / 0.32, the Mire 61 s / 0.18, the quarry 77–98 s / 0.19–0.32, Cinderheart 87 s (1 draught), 95 s and 153 s (5 draughts; all three companions down in phase 3; won); companions down 0–3 per run in the boss fight, never elsewhere; the player's own kills 46–51 % (18–20 of 39–41). `combat.play.human.json`: 477.1 s, Lv 6, 39 kills, Cinderheart in 85.1 s, no companion down, digest `8c4ef71b` (was `920a4269`). `combat.play.json` = `combat.play.fast.json`: `ok`, f 21924 (365.400 s), Lv 6 xp 483, kills 39 (companions 9), deaths 1 (the planned fall), chests 5, pickups 133, Cinderheart down in 57.917 s [16.083 22.000 19.833], digest `cf165213` (was `1d81f069`, alone). Alone (`start({ party: false })`, report only): the human model on the Ruins route drinks 4 draughts in the Ruins (219 s, 3.0 max HP of damage) and 5 for Cinderheart (164.5 s, 2.82) and wins, barely; the expert drinks 2 in the Ruins (1.89) and falls once to Cinderheart (phase 2) before winning (153.8 s). Greedy runs (§8.3, alone at Lv 5): the fixture 99.8 s (29.4 / 37.1 / 33.4 s), Cinderwatch 96.6 s (29.5 / 33.3 / 33.8 s), with every chest and shop ware 83.5 s (24.8 / 30.1 / 28.6 s); was 38.9 / 39.9 / 34.7 s. A greedy run steps ≈ 5 900 frames in one evaluate: run `combat.boss.json` / `combat.boss.cw.json` alone (under a loaded GPU it can pass the harness's 180 s protocol timeout). At the spawn (`sandbox/fingerprint.json`): 175 draw calls (was 166: Rook and the glade's extra foes in view), 611 932 triangles, 12 lights, 63 programs, 283 objects, 373 colliders, story on; `combat.perf.json` worst 240 draw calls (≤ 300), tick p95 0.4 ms, 63 programs; `combat.programs.json` 63 = 63. `combat.fight.cw`, `combat.navrect`, `cinderwatch.tour`, `editor_shell.combat` (the round trip) and the other Cinderwatch suites pass unchanged. | Solo is hard by design; a human play-test remains (KNOWN_ISSUES COMBAT-12). |

## 28. Party allies

Revision 9 (2026-10-08); revision 10 (2026-10-08) after the play-test review: heal reservation,
the warden's approach off the player's screen spot, holding still, the shooters' leash and lead, the
party level on arrival, sleeping elites, ledges, the player in the way, more threat and lower
companion stats (PARTY.md §11 PC15–PC26). The party's members (the villagers who joined the player,
[PARTY.md](../specs/PARTY.md)) fight beside the player on a combat level: the binding text is
PARTY.md §5 (with its as-built §5.5 and the deviation rows PC1–PC26 of its §11); this section is the
combat's side of it. Code: `src/game/party/MemberCombat.js` (removed)
(one member's fight), `src/game/party/rules.js` (removed) (`ALLY`, `KIT`,
`CLASS_STATS`, `DISTANCE`, `HEAL_AT`, `RETREAT_AT`), `CombatSystem.js`, `Enemy.js`,
`Projectiles.js`, `Hitboxes.js`, `hooks.js`; types `AllyState`, `AllyAction` and the widened
records in [`types.d.ts`](../../src/game/combat/types.d.ts).

**Nothing changes without a companion.** Every addition below is a loop over `allies` (empty), a
field that is never read without one (`Enemy.target` stays null, `allyHits` stays empty,
`LiveProjectile.ally` / `ProjectileContact.ally` stay null) or an early return. The fixed-step bot
(`combat.play.fast.json`) keeps its digest `1d81f069`; Cinderwatch keeps 165 draw calls, 12 lights,
63 programs; `combat.programs.json` is unchanged. MemberCombat is imported by CombatSystem (the
combat chunk; a peaceful level loads neither). *(rev. 12, §27.24: the rule still holds, but those
numbers were measured at revision 9 — since then Cinderwatch's data changed and the bot recruits
the party: its digest is `cf165213`, the spawn shows 175 draw calls with Rook in view.)*

**Cinderwatch Pass is tuned for a full party** *(rev. 12, §27.24 Q2,
[Party balance](../specs/PARTY.md#9-the-demo-the-companions-of-cinderwatch-pass))*: its
enemy groups' counts and levels and Cinderheart's HP (5200) assume the player with three
companions — Rook and Sister Ilse from the camp, Sela from the Crossroads
([PARTY.md §9](../specs/PARTY.md#9-the-demo-the-companions-of-cinderwatch-pass)). Nothing scales
with the party's size: no enemy number reads how many companions there are, and the rules below,
`ALLY` and `CLASS_STATS` are unchanged — with fewer companions the same foes stand, and alone the
pass is hard by design.

| # | Section | Addition |
| --- | --- | --- |
| A1 | §9.1 | **Allies.** `addAlly(member)` → a `MemberCombat` (also `member.combat`; null before `load`; the same one again for the same member; its sheet texture uploaded at once), kept in `allies` (join order); `removeAlly(member)` → the foes after it turn to the player, its shots in flight go, its sprite's flash / blink / speed are plain again; **`healAllies()`** → every companion full HP / MP and up again (the story's `heal`, PARTY.md §7.3), returns how many; `dispose()` releases every companion (`member.combat = null`). Also `sealedArena()` (the closed arena or null), `bossFight` (the running boss fight), `isTargeted(a)`, `targetedBy(a)`, `hurtAlly(a, n)`, `addAllyHit(a, spec, source)`, `spawnAllyProjectile(a, spec)`, `allyNumber(x, y, z, text)`, `onAllyDown(a)`; `refreshLegend()` builds the combat legend again at once (after the game changed `legendExtra`, e.g. the party's *G — Party* line; it replaces setting the private `_device = null`). `legendExtra` lines are `{ keys, label, pad? }`: with the gamepad the legend leaves out those with `pad: false` (no pad button). |
| A2 | §4.2 | **Frame order.** In `_substep`, after the player's kit (`pc.step`, `cin.tick`, the player's view): `allies[i].step(hp)` (player-scaled; one walk-grid search per sub-step for all of them, `allySearches`), then the enemies, projectiles, `_resolve`. Hit-stop and inactive frames stop the companions with everything else. `afterPlayer`: `_allySeparation()` after `_separation()`, the closed arena clamps the companions inside it (`_arenaClamp`), then `allies[i].afterFrame(dt, active, playing, realAdvanced)` (velocity for its view, the pose row after camera turns, hurt flash, i-frame blink, sprite speed). |
| A3 | §9.2 | **Targets.** `Enemy.target` (null: the player; else a companion), `targetHold`, `targetCheck`, `playerHitAt` — core-owned, cleared by `reset`, `sendHome`, `die`, `vanish`. Before an enemy's update core sets `ctx.player = target.view` (the companion's `PlayerView`: live position, radius 0.3, body [0, 1.8], facing, velocity, alive = not down, invulnerable, dodging, action in the player's names, swing, sealed = the player's) and back to `_pv` after it — in a `finally`, so a throwing brain cannot leave the next enemies seeing the companion; brains are unchanged. A companion's hit switches a foe to it when the companion is nearer to it than `ALLY.threat` (1.25) × the player's distance — an archer or a shaman (token `ranged`) also when the companion's shot came from within `ALLY.rangedAggro` (10 u) — (held 2.5 s, renewed by its hits; not a foe held on another companion); `_retarget` turns it back to the player at once when the companion is down or gone, the player fell or the foe walks home, else every 0.5 s once the hold is over when the player is nearer than 0.6 × the companion's distance — and a companion falling back behind the player (`mode` 'retreat') is let go at that check as soon as the player is the nearer, hold or not. The boss and its adds never switch. `engaged` stays the player's (§6.12). Events `allyTargeted` (enemy, id), `allyDown` (id). |
| A4 | §6.3, §9.1 | **Their hits.** `allyHits` (a HitQueue, owner the MemberCombat) resolved after the player's hitboxes (`_resolve` step 1b); a companion's shots are player shots owned by it (`Projectiles.spawn('player', spec, ally)`: `LiveProjectile.owner` / `.ally`, `ProjectileContact.ally`) resolved in the player-shot loop (step 2) — both through `_allyHitEnemy`: the player's formula with the companion's ATK, the roll and crit (base, rear, exposed) from its own RNG, the boss's floors (`_bossClamp`), the kill through `_kill` (XP and loot for the player, the kill counted; event `allyKill`), `receiveHit` and the switch of A3; the number in `ALLY_NUMBER` (`'ally'`: WorldLabels' teal kind, `.lu-num--ally`), a star at scale 0.55, quieter sounds, **no hit-stop and no shake**; event `allyHit` (id, enemy, damage, crit). Splashes: `_allySplash`. No friendly fire (they test enemies only). A companion's attacks show no ground marker. `_hitEnemy` records `e.playerHitAt` (the `assist` rule). |
| A5 | §6.3 | **Hits on them.** `_resolveAllies` after the player's steps 3 and 4: every enemy hitbox against each companion that is up and attached (`present`), one hit per tag per companion (`TagRegistry` targets may be a MemberCombat), passed while it is invulnerable (down, i-frames, rolling f1–13, knocked down, the player fallen, `allyGod`); enemy shots test the companions after the player (`Projectiles._contactAllies`: a shot passes through one with i-frames, marked for it). `_hitAlly`: flat damage → `hurtFlat` (HP only); mv 0 → a shove; else `atk · mv · roll · mitigation(def)` (its own RNG) → `takeHit` (hit stun, knockdown at kb ≥ 2.5 or `knockdown`, down at 0 HP); a number in `hurt`, sparks, a sound — no hit-stop, shake or vignette. Event `allyHurt` (id, damage). |
| A6 | §7.6 | **Separation** (`_allySeparation`): companions the combat drives, up and not rolling — against ground enemies by inverse mass (`ALLY.mass` 3; armoured enemies infinite), against each other evenly; they yield to the player entirely (a companion never pushes the player). |
| A7 | §8.1 | **The boss arena.** On `bossIntro` (`_alliesIntoArena`) every companion within 12 u of the player is placed inside, behind the player; while the arena is closed those are clamped inside (also by their own moves) and fight the boss (a candidate only during its fight) and its adds; the others wait at the gate and never enter (`MemberCombat._move`, `_enterable`). Tokens and the sealed rule (§27.9 G4) are unchanged. |
| A8 | §6.11, §6.12 | **Death, respawn, rest.** `onPlayerDeath`: every foe's target back to the player, every companion stops (idle, invulnerable). `resetEncounter` (respawn and rest): targets cleared, `healAllies()`; the respawn's `game.teleport` moves them (`party.onTeleport` → `member.combat.onTeleport()`). The player's level-up fills their HP and MP. Any change of the player's level — a level-up, `importProgress` on a campaign's arrival (the companions were added at the fresh combat's level 1), the `setPlayer` hook — scales their HP and MP to the new maxima keeping the fractions (`MemberCombat.syncLevel`, also run each sub-step and by `info()`). |
| A9 | §20.1, §20.2 | **Hooks and state.** `allies()`, `allyHurt(id, n)`, `allyTarget(uid, who?)`, `allySet(id, { hp, mp })`, `allyGod(on)`, `healAllies()`; `seed(n)` reseeds the companions' RNGs, `reset()` resets them (`MemberCombat.reset`: full, counters, cooldowns, plans, facing +z, RNG). `state().combat.allies` (`AllyState[]`, only once a companion was added). [AUTOMATION_API.md §3.4](../specs/AUTOMATION_API.md#34-window__gamecombat-combat-levels-only). |
| A10 | §18, §19 | **Budgets.** Per companion and sub-step: a 48-slot marker scan (evade), one walk-grid line test per move, a target pick every 0.25 s (each at its own phase; between those beats only when the target it has stops being valid — none while it has none), the 8 spots of a shooter's or a warden's approach on the same beat (a stand test, a line test, a projection each), at most one path search per sub-step for all of them (≤ 36 u). Its sprite is the member's (the player's lit `combatFx` material: no new program — 63 before a join = after every fight of `party.combat.json`), its effects the combat's warmed FX, bursts and projectiles; no light, no marker. `warmup()` uploads the sheets of the companions already there. |
| A11 | §21 | **Tests.** `sandbox/party.combat.json` (removed) (helpers `sandbox/party_combat.js` (removed)) on Cinderwatch, manual stepping: each class fights a glade pack alone (the player in god mode never attacks: every kill is the companion's, XP and kill count credited; the warden's foes turn on it and hit back), presets `passive` (no attack in 10 s) and `guardian` (≤ leash + reach from the player), heals by threshold (the player at 25 %, then itself), evade (a filling circle and lane under it; no roll with `evade: off`), the shaman's hex forced onto it (it rolls; less damage than with evade off), down → foes back to the player → up with 30 % → full, rest / `healAllies` / the player's death and respawn, the boss arena inside and at the gate, determinism (one fight twice: one digest), programs; and the review fixes (PARTY.md §11 PC15–PC26): one Mend at a time from three Support healers, Hold Back members holding still, Guard Me shooters within the leash while the player walks off, the lead on a crossing foe, the party level kept through `setPlayer` / `importProgress`, a sleeping elite never targeted, a ledge given up and the player gone round. The balance probe `sandbox/party.combat.balance.json` (removed) (report only) has the fixed-step bot of `combat_play.js` play as a careful human beside one companion of each class and preset, and the full party, in the Ruins and the quarry: kills, damage dealt and taken, downs, foes turned, HP healed, screen cover. |
