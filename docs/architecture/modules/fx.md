# FX module: Particles, GodRays, FxQuads and GroundMarkers

> **Purpose.** This is the reference for Luminati's atmosphere effects. `Particles` is a GPU
> particle system: every continuous emitter is one instanced draw call whose particles are
> computed statelessly in the vertex shader from the instance id, a seed and time, and one-shot
> bursts use small GPU-animated ring buffers. It ships 12 presets (dust motes, fireflies, embers,
> smoke, leaves, petals, rain, snow, mist, footstep dust, splash, sparkle). `GodRays` draws soft,
> additive, slowly animated light shafts that follow the sun and fade with night, noon and
> distance. The page covers every parameter, the motion models, blending, fog and culling.
> Combat levels add two opt-in batches ([COMBAT.md §11](../../contracts/COMBAT.md)): `FxQuads`,
> one instanced draw call of atlas quads (slashes, hit stars, projectiles, pickups), and
> `GroundMarkers`, one instanced draw call of terrain-draped telegraph decals, plus nine combat
> burst presets that add a single burst pool (§9).
>
> **Audience:** gameplay and VFX programmers, level designers placing particle areas, and AI agents.
>
> **Source of truth:** [`src/engine/fx/Particles.js`](../../../src/engine/fx/Particles.js),
> [`src/engine/fx/GodRays.js`](../../../src/engine/fx/GodRays.js),
> [`src/engine/fx/FxQuads.js`](../../../src/engine/fx/FxQuads.js),
> [`src/engine/fx/GroundMarkers.js`](../../../src/engine/fx/GroundMarkers.js).
> Contract: [ARCHITECTURE.md §4.5](../../../ARCHITECTURE.md).
>
> **Related:** [render.md](render.md) (`globalUniforms`, bloom threshold, DOF and depth) ·
> [lighting.md](lighting.md) (writes `uNight`, `uSunDirection`, `uSunColor`) ·
> [LEVEL_FORMAT.md](../../specs/LEVEL_FORMAT.md) / [OBJECT_CATALOG.md](../../specs/OBJECT_CATALOG.md)
> (`emitter` objects, `environment.godRayAreas`) · [GAME.md](../GAME.md) (Weather, World wiring) ·
> [MODULE_NOTES.md](../../contracts/MODULE_NOTES.md#sprite_runtime)

---

## 1. At a glance

```js
import * as THREE from 'three';
import { Particles, GodRays } from './engine/index.js';

const particles = new Particles(engine.scene);          // adds particles.object (a Group)
const embers = particles.createEmitter({ preset: 'embers', position: new THREE.Vector3(20, 1.5, 18) });
const rain = particles.createEmitter({ preset: 'rain', intensity: 0 });   // follows the camera
particles.burst('footstep', player.position, 4);         // pass a small count yourself

const godRays = new GodRays({ gain: 0.2 });
engine.scene.add(godRays.object);
godRays.populate({ minX: 0, maxX: 40, minZ: 0, maxZ: 30, y: 0 }, 5);

// per frame (after the camera moved):
particles.update(dt, engine.camera);
godRays.update(dt);
rain.intensity = 0.8;                                    // fade weather in and out
```

**Sandboxes:**

- [`sandbox/sprite_runtime.html`](../../../sandbox/sprite_runtime.html): every particle preset
  in a meadow. `window.__sb.particles`, `emitters`, `weather(…)`, `setNight(n)`,
  `testEmitterToggles()`.
- [`sandbox/lighting.html`](../../../sandbox/lighting.html) (`?t=hours`, `?speed=`, `?view=`):
  god rays across the 24 h cycle, `window.__lighting.godRays` / `.shafts`.
- [`sandbox/lighting_engine.html`](../../../sandbox/lighting_engine.html): god rays through the
  real PostFX pipeline.

- [`sandbox/combat_fx.html`](../../../sandbox/combat_fx.html) (`?view=overview|gallery|galleryNear|stepped|steppedYaw|steppedYawL|quads|probe|probeYaw|bursts`, `&t=<hour>`):
  the combat batches on the real pipeline (TileMap, LightingSystem at golden hour, PostFX with the
  game's tuning). Every FxQuads mode (plus an orientation probe atlas), every marker shape × style
  through progress on five ground types and draped on stepped terrain, a deliberately slow height
  bake (sliced, still res 4), the nine combat bursts (a second row shows the boss-death bursts
  before / after), the combat audio and input checks. `window.__cfx`: `setView`, `setTime`, `setProgress(p | null)`,
  `fireBursts()`, `step(n)` / `play()` (deterministic frames), `runChecks()`, `renderTrack()`.

```bash
npm run check -- --page=sandbox/sprite_runtime.html --query= --out=sprite_runtime --script=sandbox/sprite_runtime.actions.json
npm run check -- --page=sandbox/lighting.html --query= --out=lighting --script=sandbox/lighting.actions.json
npm run check -- --page=sandbox/combat_fx.html --query= --out=cfx --fps=0 --script=sandbox/combat_fx.actions.json
```

---

## 2. Particles API

### 2.1 `Particles`

| Member | Description |
| --- | --- |
| `new Particles(scene)` | Creates `object` (a `Group` named `Particles`) and adds it to `scene` if given. **The group must keep an identity transform**, because world positions are computed in the shader. |
| `createEmitter(config)` → `Emitter` | A continuous emitter (one draw call). See §2.2. |
| `burst(preset, position, count = 12, overrides = {})` | One-shot particles from any preset. `count` is clamped to the pool capacity of 512. It keeps the contract default of 12 rather than the preset's own `count`, so pass small counts yourself (the demo uses 4 for running dust). |
| `update(dt, camera?)` | Per frame: moves `followCamera` emitters, refreshes culling spheres, and hides burst pools whose particles are all dead. Call it after the camera moved. |
| `burstPools()` → `BurstPool[]` | The burst pools created so far, in creation order (a copy; opaque handles for `releaseBurstPools`). |
| `releaseBurstPools(pools)` | Disposes those pools: meshes out of the group, geometry and material freed (a program no other material uses goes with them), the cached configs that pointed at them forgotten — the next burst of such a preset creates its pool anew. The combat system releases the pools its warm-up made when it is disposed (a campaign's next, peaceful level keeps its own program count: KNOWN_ISSUES CMP-05). |
| `emitters` | Live array of emitters. |
| `dispose()` | Disposes every emitter, pool and internal texture, and removes the group. |

### 2.2 `createEmitter(config)`

| Config key | Meaning |
| --- | --- |
| `preset` | **Required.** One of the own keys of `PARTICLE_PRESETS` (anything else, an `Object.prototype` name such as `"constructor"` included, throws `Particles: unknown preset "…"`; the game catches it per particle area and warns). |
| `position` | `Vector3`, `[x, y, z]` or `{x, y, z}`. For **point** emitters it is the spawn centre. For an **area** preset given only a `position` (and not `precip`), the box sits on the point: its bottom is at `position.y`. |
| `bounds` | `{ center, size }` (Vectors or arrays) for an explicit area box. It may also be a size array `[x, y, z]` (the preset parameter), which is how the demo's weather sizes rain (`bounds: [44, 16, 44]`). Giving `bounds` makes the emitter an area emitter. |
| `count` | Particle count (instances). |
| `rate` | Particles per second instead of `count`: `count = ceil(rate × mean life)`. Not used for `precip`. |
| `color` | A single colour (clears the preset's `colorEnd` and palette), or a `[start, end]` pair. |
| `size` | Number or `[min, max]` in world units. |
| `followCamera` | Re-centre the box every frame (in `particles.update`) on the point where the camera's view ray meets the box's base height, with the distance clamped to 2–120. When the camera does not look down (view-ray y ≥ −0.05) it uses `followDistance` (20) instead. Rain and snow default to `true`. |
| `intensity`, `enabled` | Initial values (see §2.3). |
| `seed` | Per-emitter seed. The default is deterministic in creation order: `(hashString(preset) + n·7919) % 1000003`, where `n` counts the emitters this `Particles` has created. |
| `map`, `variants` | Custom texture with `variants` frames laid out horizontally, replacing the built-in one. |
| any preset key | Overrides (§3.2). |

For the type check, `preset` is `keyof typeof PARTICLE_PRESETS` and the overrides are the keys of
the module's `DEFAULTS` table: a misspelt preset or parameter, or a wrongly typed value, fails
`npm run typecheck` at a direct call. A config built elsewhere and passed in widens to plain strings —
type it where it is built. `burst(preset, …)` takes a plain string (unchecked).

### 2.3 `Emitter` (the returned handle; also exported)

| Member | Description |
| --- | --- |
| `object` | `THREE.Mesh` with an `InstancedBufferGeometry` (one draw). `renderOrder = RENDER_ORDER.PARTICLES` (+2 for additive). |
| `position` | `Vector3`, the origin or area centre. **Mutating it moves the emitter live.** The demo keeps the dust area centred on the camera focus this way. |
| `enabled` | Visibility toggle; the object stays in the scene. |
| `intensity` | 0..1 multiplier. It scales the live count (`instanceCount = ceil(count × min(1, intensity))`, plus a per-particle gate) and fades alpha in over the lowest third. Values above 1 behave like 1. Weather fades rain and snow with it. |
| `config`, `preset`, `count`, `mode` (`'area' \| 'point'`), `boxSize`, `followCamera`, `followDistance`, `followBaseY`, `uniforms` | Resolved state. |
| `dispose()` | Removes and frees the emitter and unregisters it from `particles.emitters`. |

---

## 3. Presets and parameters

### 3.1 `PARTICLE_PRESETS`

| Preset | Mode · motion | Texture · blending | Count | Life (s) | Size (u) | Look |
| --- | --- | --- | --- | --- | --- | --- |
| `dust` | area · drift | glow · additive | 90 | 5–10 | 0.06–0.12 | Warm motes `#ffe0a0` ×2.4 HDR that twinkle and glint in the sun. Dimmed 85 % at night. Box 14×4×14. |
| `fireflies` | area · drift | glow · additive | 36 | 8–14 | 0.2–0.3 | Green → gold (`#b6ff3c` → `#ffd23c`) ×2.4 that blink. **Night only.** Box 10×2.2×10. |
| `embers` | point · emit | square · additive | 34 | 0.9–2.2 | 0.07–0.11 → ×0.35 | Buoyant sparks (rise 1.5 u/s, gravity +0.5, drag 0.7) `#ff8a2a` → `#ff3a12` ×2.4. |
| `smoke` | point · emit | smoke · normal | 22 | 3.5–6 | 0.45–0.7 → ×4.2 | Soft grey puffs rising 0.8 u/s, spinning, lit, alpha 0.5. |
| `leaves` | area · fall | leaf · cutout | 24 | box / fall speed | 0.46–0.54 | Four-colour autumn palette, tumbling, lit, wind 0.45. Box 10×6×10. |
| `petals` | area · fall | petal · cutout | 40 | box / fall speed | 0.3–0.36 | Pink palette, tumbling, wind 0.8. Box 10×5×10. |
| `rain` | area · precip | streak · normal | 1600 | — | 0.035–0.05, aspect 12 | Follows the camera. Falls 15 u/s as velocity-aligned streaks, wind 0.9, lit 0.6. Box 36×16×36. |
| `snow` | area · precip | snow · normal | 1100 | — | 0.08–0.13 | Follows the camera. Falls 1 u/s with turbulence and spin, lit 0.75. Box 34×14×34. |
| `mist` | point · emit | smoke · normal | 34 | 1.6–3.0 | 0.6–0.9 → ×3.2 | Waterfall spray (spawn box 2×0.3×0.4), alpha 0.28. |
| `footstep` | burst · emit | smoke · normal | 8 | 0.35–0.65 | 0.14–0.22 → ×2.2 | Dust puff, drag 5, outward 0.5–1.1 u/s. |
| `splash` | burst · emit | square · normal | 16 | 0.45–0.8 | 0.07–0.12 | Ballistic droplets (gravity −9.8, up 2.2–4.2 u/s). Life ends back at spawn height. |
| `sparkle` | burst · emit | star · additive | 10 | 0.45–1.0 | 0.28–0.5 | `#fff6d0` ×6 HDR glints that pulse in size. Box 4×1×4. |
| `hitSpark`, `emberBurst`, `deathPoof`, `gooPoof`, `healGlow`, `magicBurst`, `victoryEmbers`, `victorySparkle`, `levelSparkle` | burst · emit | see §9.3 | — | — | — | Combat bursts (combat levels only; not in `EMITTER_PRESETS`). |

Levels can place `emitter` objects with the presets in `EMITTER_PRESETS`
(`fireflies, leaves, petals, dust, embers, smoke, mist, sparkle, snow, rain`) from
[`src/engine/level/ObjectCatalog.js`](../../../src/engine/level/ObjectCatalog.js). Props return
`emitters` (chimney smoke, campfire embers and smoke) that the game passes to `createEmitter`.
`World._createEmitter` applies a lighter `SMOKE` override (alpha 0.2, smaller puffs) to every
`smoke` emitter.

### 3.2 Parameter reference (overridable per emitter or burst)

Defaults (`DEFAULTS`) apply wherever a preset doesn't set a key.

| Key | Default | Meaning |
| --- | --- | --- |
| `mode` | `'point'` | `'area' \| 'point' \| 'burst'`, the default spawn shape. |
| `motion` | `'emit'` | `'drift' \| 'emit' \| 'fall' \| 'precip'`. Bursts always use `emit`. |
| `texture` | `'glow'` | `'glow' \| 'square' \| 'leaf' \| 'petal' \| 'smoke' \| 'star' \| 'snow' \| 'streak'`. `streak` is procedural in the shader. |
| `blending` | `'additive'` | `'additive' \| 'normal' \| 'cutout'` (§4.2). |
| `count` | `32` | |
| `life` | `[1, 2]` | Seconds, `[min, max]`. |
| `size`, `sizeEnd` | `[0.1, 0.1]`, `1` | World units, and the multiplier at the end of life. |
| `aspect`, `streak` | `1`, `0` | Height/width, and motion-blur seconds for streaks. |
| `velocity`, `velocityVariance` | `[0,0,0]`, `[0,0,0]` | Initial velocity ± variance. |
| `radial` | `0` | Outward XZ speed for emit. |
| `gravity` | `0` | **+ = up** (buoyancy). |
| `drag` | `0` | 1/s (closed-form exponential). |
| `windInfluence` | `0` | Multiplies `uWind × uWindStrength`. |
| `turbulence` | `[0, 1]` | `[amplitude, frequency]`. |
| `spin`, `tumble` | `[0, 0]`, `0` | rad/s, and 0..1 card flip. |
| `color`, `colorEnd`, `colors` | `'#ffffff'`, `null`, `null` | Start and end colour, or a palette of up to 4. Any `THREE.Color` input; a name three.js would resolve through `Object.prototype` (`"constructor"`, `"__proto__"`, which gave black) acts like any unknown name — white — with a warning (`ownColor`, KNOWN_ISSUES LVL-19). |
| `hdr` | `1` | Colour multiplier (> 1 blooms). |
| `alpha`, `fade` | `1`, `[0.1, 0.3]` | Fade-in and fade-out as fractions of life. |
| `twinkle`, `blink`, `pulse` | `0` | Sparkle peaks, firefly on/off, and size `sin(πt)`. |
| `nightVisibility` | `0` | `1` = visible only at night (`uNight` 0.3 → 0.85). `−k` = dims by k at night. |
| `lit` | `0` | 0..1. Tints by `uSunColor × 0.75 +` an ambient that darkens at night. |
| `bounds`, `spawnSize` | `[6, 3, 6]`, `[0.2, 0.2, 0.2]` | Area box, and the spawn box for point and burst. |
| `followCamera`, `followDistance` | `false`, `20` | |
| `burstSpeed`, `burstUp` | `[0.5, 1.5]`, `[0.5, 1.5]` | Burst outward (XZ) and upward speed ranges. |
| `ballistic` | `false` | Burst life is capped at the time to fall back to spawn height. |
| `map`, `variants` | `null`, `1` | Custom texture. |

---

## 4. Internals

### 4.1 Motion models (vertex shader, closed form)

Continuous particle `id` gets hash values `s = hash(id, seed)`. Its life cycle is phase-shifted
by `s.z × life`. Each cycle index re-hashes the spawn point, so particles respawn in new places
with no CPU state.

| Motion | Position |
| --- | --- |
| `drift` | `spawn + (velocity ± variance + wind·windInfluence)·age + wobble`. The wobble is three sine terms of `turbulence`. |
| `emit` | `spawn + v0·E + g/k·(age − E)` with `E = (1 − e^(−k·age))/k`, `k = drag`, `g = (0, gravity, 0) + wind·windInfluence`. `v0` includes the radial term. Turbulence grows with t. |
| `fall` | Spawns at the top of the box and falls at `\|velocity.y\| ± variance`. Life = box height / fall speed. Wind drift plus a sinusoidal sway. `tumble` flips the card, and the back side is darkened ×0.78. |
| `precip` | A position `mod` the box (a wrapped volume) moving with velocity plus wind. Soft fades near the box faces. Rain streaks align with the view-space velocity (length = `size·aspect + \|v\|·streak`). |

Bursts write `{origin + birth time, velocity + life, size/end/rotation/spin, colour + alpha,
gravity/drag/wind/seed}` records into a 512-slot ring buffer per **material state** (a
`BurstPool`, one draw call, `renderOrder = PARTICLES + 1`, or `+ 3` when additive). Only the changed range is uploaded, and the GPU animates the records
with the `emit` closed form. The pool key includes the texture or map, variants, blending, lit,
pulse, tumble, aspect, streak, fade, twinkle, blink and nightVisibility. Override-free bursts
reuse a cached resolved config, so footsteps allocate nothing.

### 4.2 Blending, depth and fog

| Blending | GL state | Fog | Used by |
| --- | --- | --- | --- |
| `additive` | `AdditiveBlending`, no depth write, HDR colours | colour × (1 − fog) (fades out) | dust, fireflies, embers, sparkle |
| `normal` | `NormalBlending`, no depth write | mixes toward the fog colour | smoke, mist, rain, snow, footstep, splash |
| `cutout` | alpha test 0.5, **depth write**, dithered (4×4 Bayer) fades | mixes toward the fog colour | leaves, petals: they sort correctly and give DOF real depth. Pass `blending: 'normal'` to override. |

- Fog depth comes from three's standard `#include <fog_vertex>`, so a game that patches that
  chunk fogs particles the same way as every other material. The demo's
  `installFogStart` ([`src/game/AtmosphereFog.js`](../../../src/game/AtmosphereFog.js)) starts
  the fog a few units in front of the camera, at `globalUniforms.uFogStart`, which the particle
  uniforms reference (as do GodRays, FxQuads and GroundMarkers).
- Glow HDR values are tuned so the colour survives ACES and still crosses the demo's bloom
  threshold.
- Dead or hidden particles are culled in the vertex shader (moved outside the clip volume).

### 4.3 Culling

Each emitter's bounding sphere is its box plus an estimate of travel (velocity, gravity and wind
over a lifetime) plus the maximum size. It is recomputed when the global wind strength changes by
more than 2 %, because rain and snow blow 2–5× harder in storms. `followCamera` emitters are
never frustum-culled. Burst pools aren't culled; they are hidden once their last particle has
died.

### 4.4 Built-in textures

Built lazily per kind and shared by all emitters:

- `glow`: a 32² soft Gaussian halo plus a hot core, linear mag, mipmapped.
- `square` and `snow`: 2 variants of 4 px each.
- `star`: 2 variants of 9 px.
- `leaf` and `petal`: 4 variants in 8 px cells.
- `smoke`: 4 variants of 32², with alpha quantised into 5 dithered steps (painterly pixel puffs).

---

## 5. GodRays

### 5.1 API

```js
new GodRays({ steepness = 0.45, color = 0xfff1d8, nightStrength = 0, nearFade = [5, 13],
              fadeHeight = 2.2, gain = 0.28, horizonFade = [0.19, 0.27] } = {})
```

| Option | Meaning |
| --- | --- |
| `steepness` | 0 = beams follow the true light elevation, 1 = vertical. It keeps the slanted diagonal of Square Enix's HD-2D games when the sun is low. |
| `color` | Tint multiplied with `uSunColor`. |
| `nightStrength` | Fraction kept at full night (0 = no moonbeams). |
| `nearFade` | Camera distance range over which shafts fade in, so they vanish when the camera is close. |
| `fadeHeight` | Height above the shaft base over which it fades toward the ground. |
| `gain` | Overall brightness. The demo and editor use **0.2**. |
| `horizonFade` | sin(light elevation) range over which beams fade out at sunset and sunrise. LightingSystem soft-clamps the light at about 10°. |

| Member | Description |
| --- | --- |
| `object` | `Group`. Add it to the scene. |
| `addShaft({ position, direction?, length = 14, width = 3, intensity = 1, color?, topWidth = 0.7, seed? })` → `{ mesh, intensity (get/set), dispose() }` | `position` is where the shaft meets the ground. Without a `direction` the shaft follows the live `uSunDirection` (exact azimuth, elevation steepened). With one, it uses that fixed sky-to-ground direction. |
| `populate(bounds, count, seed = 7)` → handles | Deterministic jittered grid over `{ minX, maxX, minZ, maxZ, y? }`. Each shaft gets length 11–17, width 1.4–3.4, intensity 0.55–1.0 and topWidth 0.55–0.85. |
| `shafts` | Live array of handles. |
| `intensity` | get/set global multiplier. The demo's Weather drives it from weather and time of day. |
| `steepness` | get/set. |
| `update(dt)` | Advances the shafts' **own** clock (not `globalUniforms.uTime`). Without it the streaks freeze. Engine-system compatible. |
| `dispose()` | Disposes all shafts and removes the group. |

### 5.2 How a shaft is drawn

- **Geometry:** one shared (ref-counted) `PlaneGeometry(1, 1, 1, 6)`. The vertex shader places
  it along the light direction from the mesh's world position and turns its broad side to the
  camera (`side = cross(toLight, view)`), with the width tapering by `topWidth`. It is never seen
  edge-on as a hard plane.
- **Fragment:** the brightness is a product of these factors:
  - a Gaussian-like profile across the width;
  - a fade at the top, and a fade toward the ground by world height;
  - slowly scrolling noise streaks along the beam, and a gentle "breathing";
  - fades when looking straight down the axis and near the camera;
  - a low-sun factor: full below sin(el) 0.3 and 40 % above 0.8, times the horizon fade;
  - `mix(nightStrength, 1, 1 − uNight)`, then fog.

  The colour is a 72 %-saturated `uSunColor` × tint × gain.
- **Blending:** truly additive into PostFX's linear HDR target. When drawing straight to the
  canvas (PostFX disabled) it switches in `onBeforeRender` to screen blending (`One,
  OneMinusSrcColor`), otherwise shafts would be 3–10× too bright. Blending isn't part of the
  program key, so switching never recompiles.
- **Culling:** a custom `mesh.intersectsFrustum` tests a sphere around the base with radius
  `length + width/2 + 0.1`, valid for any sun direction. A shaft out of view costs no draw call
  (Starfall Vale's 22 shafts: −10 to −15 draws per view).
- `depthWrite: false`, `fog: true`, `renderOrder = RENDER_ORDER.GODRAYS`. Being additive with no
  depth, shafts take the DOF blur of what is behind them.

The demo's World populates shafts over `environment.godRayAreas` (count clamped to 12 per area),
or over an automatic area covering the walkable ground; `environment.godRays: false` disables
them. See [LEVEL_FORMAT.md](../../specs/LEVEL_FORMAT.md).

---

## 6. Extension points

- **A new preset:** add an entry to `PARTICLE_PRESETS` (additive; its name is typed from the
  table). To place it in levels, add it to `EMITTER_PRESETS` in `ObjectCatalog.js`, which drives the
  editor's preset dropdown. A new **parameter** also needs a default in `DEFAULTS` (the type of the
  overrides).
- **A custom look:** `createEmitter({ preset: 'dust', map: myTexture, variants: 4, color: '#9fd8ff' })`.
- **A new motion or texture kind** needs shader work in `PARTICLE_VERTEX` (a `MOTION_*` define)
  or in `buildParticleTexture`.

## 7. Gotchas

- **Warm the burst pools at load.** Each new pool (material state) compiles a program the first
  time it is used, which is a 100–300 ms hitch on big levels. The demo primes `splash`, `sparkle`
  and `footstep` with one particle far below the world before its load-time compile, and creates
  rain and snow at `intensity: 0` from the start.
- **Keep `particles.object` untransformed** and call `particles.update(dt, camera)` every frame.
- **No depth sorting** within one normal-blended emitter, no soft-particle fade (smoke meets the
  ground with a hard edge) and no terrain collision (rain and leaves pass through the ground and
  fade out).
- **`lit` means sun and ambient only.** Point lights don't light leaves or smoke, so leaves near
  lanterns stay dark at night.
- **float32 time:** motion multiplies velocity by `uTime`. After many hours of uptime rain and
  dust positions start to quantise visibly (cosmetic only).
- **Big levels** switch off the level's `emitter` areas and every prop emitter (chimney and
  campfire smoke, embers, waterfall mist) whose box is more than 34 units from the camera focus,
  through `Emitter.enabled` (`World._cullParticles`, `BIG_LEVEL_BATCHING.particleCull` in
  [`src/game/World.js`](../../../src/game/World.js)). The ambient dust area (which the game moves
  with the camera focus) and the rain and snow emitters are never culled.
- **GodRays run on their own clock.** Pausing the Engine's `timeScale` doesn't pause them unless
  you scale the `dt` you pass to `update`.

## 8. Design notes

- **Particle and god-ray robustness:**
  - *Particle audit fixes:*
    - The twinkle `pow()` is guarded against negative bases. A GPU `sin()` overshoot produced
      NaN, which spread through bloom as black and white blocks.
    - Zero-size precip boxes are guarded.
    - The burst-pool key now covers every uniform the burst shader reads.
    - Array positions and centres are accepted.
    - `embers` changed from `#ffb347`×3 to `#ff8a2a`×2.4. The old value tone-mapped to
      near-white under ACES at night exposure.
  - *GodRays audit fix:* screen blending when drawing straight to the canvas (shafts were
    3–10× too bright with PostFX disabled).
- **Emberfall review:** particles wrote `vFogDepth` themselves and bypassed the demo's
  fog-start patch, so leaves 25–30 units away were ~60 % fogged and looked like pale flakes.
  They now use three's `fog_vertex` chunk.
- **Starfall Vale:**
  - Emitter culling radii follow the wind.
  - GodRays got sphere frustum culling (−10 to −15 draw calls per view on Starfall Vale).
  - The game culls distant particle areas and smoke (34 units) and primes the burst pools
    before the load-time compile, removing a 100–300 ms first-waterfall hitch.
- **Combat ( COMBAT.md §11):** `FxQuads`, `GroundMarkers` (draped over a
  baked height texture) and the six combat burst presets (one new pool). All opt-in; peaceful
  levels keep their programs, pools and burst RNG sequence.
- **Combat known-issues pass (2026-09-28):** the height bake runs in ≤ 6 ms slices and never drops
  to half resolution (COMBAT-09); three dim burst presets for the boss's death and the level-up
  share the existing pools (COMBAT-16); the magma fill became a cellular crust that reads at game
  zoom, by day and by night (COMBAT-16).

---

## 9. Combat batches and presets (combat levels only)

Built by combat-core at load on combat levels ([COMBAT.md §11](../../contracts/COMBAT.md), §19
warm-up); peaceful levels never create them, so their programs and draw calls are unchanged. Both
are one `THREE.InstancedMesh` with dense handle packing: `alloc()` hands out a handle (−1 when
full), `set(h, p)` rewrites that instance (the caller reuses `p`, nothing is allocated), `free(h)`
moves the last live instance into the hole, `clear()` frees all, and `update()` once per frame
uploads the dirty slot range and sets `object.count` and `object.visible = count > 0`. The upload
range is one reusable `{ start, count }` object per attribute pushed into `attribute.updateRanges`
and widened while it waits for the next draw (`addUpdateRange` would allocate one per call);
`GroundMarkers` does the same. The objects keep an identity transform (instance data is in world
space), are not frustum-culled and cast no shadows. The parameter records are typed — `FxQuadParams`
(`FxQuads.js`) and `GroundMarkerSpec` (`GroundMarkers.js`: COMBAT.md's `MarkerSpec` plus `flash`,
everything but `shape` defaulted) — with `mode`, `shape` and `style` as plain strings, because an
unknown value is handled at run time (a billboard; a hidden marker with a warning) and the engine
must not import the combat types.

### 9.1 `FxQuads` ([`FxQuads.js`](../../../src/engine/fx/FxQuads.js))

```js
const quads = new FxQuads({ atlas: createFxAtlas(), capacity: 256, name: 'fx:quads' });
scene.add(quads.object);
const h = quads.alloc();
quads.set(h, { x, y, z, frame: 'slash', index: 2, scale: 1, rot: 0, mode: 'flat', dirX: 0, dirZ: -1,
               r: 3.0, g: 3.0, b: 2.6, a: 1, flipX: false });
quads.update();   // once per frame
```

| Field | Meaning |
| --- | --- |
| `frame`, `index` | Atlas frame name and animation frame (wraps modulo the frame count). An unknown frame hides the quad and warns once per name. |
| `scale` | World size = frame pixels / 16 × `scale` (1 texel = 1/16 u, like every sprite). |
| `mode` | `'billboard'`: upright, turned to the camera yaw (`globalUniforms.uCameraYaw`, like the cylindrical Sprite3D). `'flat'`: horizontal at `y`, **+V (texture up) along (`dirX`, `dirZ`)** and +U (texture right) along (−`dirZ`, `dirX`), so seen from above the frame is never mirrored. `'screen'`: faces the camera fully. |
| `rot` | In-plane rotation (rad, counter-clockwise seen from the front / from above). A frame drawn pointing right (+U), such as the arrow, flies along (`dirX`, `dirZ`) with `rot = π/2`. |
| `flipX` | Mirrors the texture along U (a back-hand slash). Additive to COMBAT.md §11.1. |
| `r, g, b` | Linear HDR tint: colour = texel × (r, g, b); a max channel above ~1.4 blooms (threshold 1.05). |
| `a` | < 1 dissolves the quad with a 4 × 4 Bayer threshold **in atlas-texel space** (art-sized pixels). |

Rendering: unlit `ShaderMaterial` (`customProgramCacheKey` **`luminati-fxquads-v1`**), alpha test
0.5, opaque and **depth-writing** (sharp in the DOF, sorted by depth), fog like every material,
standard tone-mapping / colour-space chunks (no-ops into PostFX's HDR target). Two batches with
different atlases share the one program.

### 9.2 `GroundMarkers` ([`GroundMarkers.js`](../../../src/engine/fx/GroundMarkers.js))

```js
const markers = new GroundMarkers({ capacity: 48,
  heightField: { sample: (x, z) => tileMap.getHeight(x, z), minX: 0, minZ: 0, maxX: W, maxZ: D, res: 4 } });
const h = markers.alloc();
markers.set(h, { shape: 'lane', style: 'enemy', x, z, dirX, dirZ, len: 9, width: 1.4, y: 0.03, progress: 0.6, alpha: 1, flash: 0 });
```

- **Draped.** Each instance is one shared 24 × 24-segment grid (1 152 triangles) over the shape's
  bounding rectangle in its (across, along) frame. The vertex shader looks up the height texture
  at every vertex: `y = height(x, z) + spec.y`. The texture is an R16F (HalfFloat) `DataTexture`
  baked from `heightField.sample` at texel centres, always at `res` texels per unit (4; clamp-to-
  edge). The bake runs **in row slices** (KNOWN_ISSUES COMBAT-09, resolved 2026-09-28): up to 6 ms
  in the constructor, then one ≤ 6 ms slice per `setTimeout(0)` task (the pump) plus up to 2 ms per
  `update()`, at least one row per slice; the texture is uploaded once when the last row is done,
  and `object.onBeforeRender` finishes the bake first should the batch be drawn earlier (the game
  never does: the pump ends long before its loading). Read-only members: `heightReady` (the bake is
  done), `heightRes`, `bakeMs` (CPU ms summed over the slices, 0 until done), `bakeSlices`,
  `bakeLongestMs`. Cinderwatch (96 × 120): 384 × 480 texels, ≈ 18 ms in 4 slices, the longest
  ≈ 6 ms; the sandbox's slow 128 × 128 check: 214.6 ms in 36 slices, the longest 6.6 ms, still res 4.
  (Until 2026-09-28 the bake ran in one piece and restarted at `res = 2` when it projected more
  than 40 ms — stairs then lost their tread accuracy.) Without a `heightField` a 1 × 1 zero texture
  is bound (same program) and `spec.y` is the absolute height. Call
  `renderer.initTexture(markers.heightTexture)` in the load-time warm-up (COMBAT.md §19).
- **Texel-centre lookup.** The vertex reads the texel that contains it (not a blend of four): at
  res 4 a texel is exactly one of the four steps of a stair tile, so stair treads, terraces and
  plateaus are exact. A cliff or a riser between two grid vertices would become a steep sliver of
  ≤ one grid cell (a row of sawtooth spikes where a lane crosses a ledge), so the **fragment**
  shader reads the texel under the fragment too and discards the fragment when the interpolated
  height differs from it by more than 0.12 u: a marker shows only where it lies on the ground, and
  a lane across a ledge is a clean step with a gap at the face.
- **Shapes** (`shape`): `circle` (disc `r`), `ring` (annulus `rInner`..`r`), `sector` (apex
  `x, z`, radius `r`, ±`halfAngle` degrees around `dirX, dirZ`), `lane` (from `x, z` along
  the direction, `len` × `width`), `rect` (centre `x, z`, `w` across × `d` along the
  direction, **outline only**).
- **Progress** (0..1) grows the fill from the centre / apex / lane start (a ring from `rInner`
  outward) with a bright 1-texel leading edge; the unfilled rest of the shape shows faintly. At
  `progress` 1 (≥ 0.9995: an instance value of exactly 1 can interpolate to 0.99999994 across a
  triangle) an `enemy` rim turns white (0.95, 0.88, 0.78): the caller keeps it 5 frames, then
  frees it. The white stays below the bloom threshold (luminance 1.05): the first (3, 3, 3) — and,
  on the pixels where the interpolated progress missed 1, the brighter red rim — bloomed the
  phase-3 Shockwave rings (white for their whole life) into a haze over the player.
  **`flash`** (0..1, optional, additive to COMBAT.md §9.5) whitens the rim the same way, for a lane
  or circle that locks before it resolves.
- **Pixel look.** Rims (2 texels; `lock` 1), fills and noise are evaluated at the centre of the
  world-space 1/16 u texel, so every edge is pixel-art-stepped and aligned with the terrain's
  texels at any rotation. Rims pulse on `uTime`.
- **Styles** (linear HDR, normal blending):

  | Style | Look |
  | --- | --- |
  | `enemy` | red-orange rim (2.6, 0.34, 0.12) × (0.85 + 0.25·progress + 0.1·pulse), fill (1.3, 0.13, 0.05) alpha 0.22 → 0.5 with progress (0.12 ahead of the front), white rim at progress 1 |
  | `player` | gold rim (2.2, 1.6, 0.6), fill (1.25, 0.95, 0.35) alpha 0.14 → 0.34 |
  | `lock` | thin gold dashes (1.8, 1.4, 0.5) rotating around the shape, no fill |
  | `barrier` | pulsing outline (1.3, 0.45, 0.15) × 0.7–1.3 with a faint 3-texel inner band (alpha 0.1) |
  | `magma` | a cellular crust (F2 − F1 of a jittered grid of 1.75 cells per unit, in world texels): dark basalt plates ≈ 0.6 u across (0.105, 0.034, 0.018) × 0.8–1.4 alpha 0.95, a dark-red cooling band (0.5, 0.085, 0.02) along glowing cracks (1.3, 0.5, 0.09) × 0.45–1.05 alpha 0.92, one plate in six molten (0.9, 0.2, 0.035) × 0.55–0.95 alpha 0.85; the crack and molten glow follow a slowly flowing noise, the plates stay put; glowing edge (1.5, 0.36, 0.07) × (0.8 + 0.3 · pulse) alpha 0.8 — every colour below luminance 1.05 |

  COMBAT.md §11.2 specified the enemy rim (2.4, 0.55, 0.18) and fill (0.9, 0.2, 0.08) at 0.18 →
  0.42. Under Cinderwatch's golden-hour light those tone-mapped to the same orange-gold as the
  player style and the fill vanished on lit ground, so green / blue were lowered and the fill
  strengthened (and magma likewise); at night all styles glow clearly. The barrier and magma were
  first (2.6, 0.9, 0.3) and (1.6, 0.42, 0.08) × 1.25: above the bloom threshold, the closed arena's
  outline lifted the whole frame's luminance by ~30 % and a pool under the player washed it out.
  The magma's smooth noise fill ((1.0, 0.27, 0.05) × 0.55–0.9 alpha 0.5 with a rare dark crust) then
  read as a flat orange disc at game zoom; since 2026-09-28 (COMBAT-16) it is the crust above, whose
  warm plate floor and 0.95 alpha keep it from reading as cold purple-grey stone at night.
- **Rendering:** `customProgramCacheKey` **`luminati-groundmarkers-v1`**, `renderOrder`
  `RENDER_ORDER.DECALS + 1`, `polygonOffset` (−2, −4), transparent, no depth write (a marker
  takes the DOF blur of the ground under it), fog, double-sided. 48 instances ≈ 55 k triangles in
  one draw call.

### 9.3 Combat burst presets (`PARTICLE_PRESETS`)

Added to `PARTICLE_PRESETS` only (**not** to the catalog's `EMITTER_PRESETS`). A burst pool keeps
the uniforms of the preset that created it, so the pool-key fields (texture, variants, blending,
lit, pulse, tumble, aspect, streak, fade, twinkle, blink, nightVisibility) are fixed; together the
nine add **exactly one** pool — the additive streak pool — to the `footstep`, `splash` and
`sparkle` pools the game already primes (`sandbox/combat_fx.html` asserts it).

| Preset | Pool (texture · blending) | Look |
| --- | --- | --- |
| `hitSpark` | new streak pool (streak · additive, aspect 4, streak 0.04) | `#fff2c0` → `#ff9a3c` ×4, life 0.12–0.25 s, fast radial sparks (3–7 u/s), gravity −8, drag 4 |
| `emberBurst` | the streak pool | `#ff8a2a` / `#ff3a12` / `#ffd27a` ×3, life 0.4–0.9 s, rising embers (gravity +1.5) |
| `deathPoof` | `footstep` (smoke · normal, lit) | `#d8d0c0` puff 0.5 → ×2.2, life 0.4–0.8 s |
| `gooPoof` | `footstep` | as `deathPoof` in the slime's teal `#5fc7b0` |
| `healGlow` | `sparkle` (star · additive, pulse) | `#bfe58f` ×2.4 (3 in COMBAT.md; 2.4 keeps the green through ACES), rising 1.2 u/s |
| `magicBurst` | `sparkle` | `#8fd0ff` / `#f3cf7a` ×3.5, radial 2–5 u/s |
| `victoryEmbers` | the streak pool | the `emberBurst` colours at ×1.5 (peak luminance ≈ 1.03), life 0.7–1.3 s, spawn box 1.0 × 0.8 × 0.6, slow (0.3–1.1 u/s) and rising (1.6–3.2 u/s, gravity +1.2); the boss's death (`BossArena.deathBursts`, 3 × 12) |
| `victorySparkle` | `sparkle` | `#fff0c8` ×1.15 (luminance ≈ 1.01, just under the bloom threshold), life 0.6–1.1 s, size 0.16–0.3, drifting up 0.5 u/s; the boss's death (12) |
| `levelSparkle` | `sparkle` | as `victorySparkle`, size 0.14–0.26, rising 0.9 u/s from a flat 1.3 × 0.5 × 1.3 box; the level-up and the core / upgrade pickups (12–14 at head height, y + 1.9) |

Call them override-free with an explicit count (≤ 12 per hit, ≤ 24 per death / level-up), and
prime all of them plus `sparkle`, `splash` and `footstep` once at load (COMBAT.md §19).

The last three were added on 2026-09-28 (KNOWN_ISSUES COMBAT-16): at the boss's kill 3 × 24
`emberBurst`, 24 hdr-6 `sparkle` and the 14 level-up sparkles made a ≈ 0.4 s white glare over the
player. They share the existing pools (no new pool or program) and sit at the bloom threshold
instead of 2–5 × over it (KNOWN_ISSUES COMBAT-15).
