import { clamp, smoothstep, damp } from '../engine/index.js';
import { snowCover } from './SnowCover.js';
import {
  WEATHERS, WEATHER_PARAMS, WEATHER_KEYS, precipitationEmitter, precipitationIntensity, settledSnowCover,
  applyWeatherLighting, applyWeatherWind, applyWeatherGrade, applyOvercast, applyLampDayGlow, applyEmissiveDay,
  glassLevel, areaEmitterIntensity, NIGHT_DESATURATION, godRayHourLevel, nightWaterLevels,
} from './WeatherLook.js';
import { isInterior, shownWeather } from './LevelLook.js';

/**
 * @import { GodRays } from '../engine/fx/GodRays.js'
 * @import { Particles } from '../engine/fx/Particles.js'
 * @import { LightingSystem } from '../engine/lighting/LightingSystem.js'
 * @import { PostFX } from '../engine/render/PostFX.js'
 * @import { World } from './World.js'
 * @import { WeatherState } from './WeatherLook.js'
 */

export { WEATHERS };

/**
 * Time-of-day presets cycled by T (hours): `id` is the phase id of the hour (HUD.js `timePhase`) —
 * the toast shows the clock's name of it (HUD.js `phaseName`: `hud.phase.<id>`, docs/specs/I18N.md
 * §2) — and `name` its English name.
 */
export const TIME_PRESETS = [
  { h: 6.5, id: 'dawn', name: 'Dawn' },
  { h: 12.5, id: 'midday', name: 'Midday' },
  { h: 17.2, id: 'golden', name: 'Golden Hour' },
  { h: 18.9, id: 'dusk', name: 'Dusk' },
  { h: 22.5, id: 'night', name: 'Night' },
];

/**
 * Sky & weather director: smooth time-of-day transitions between presets (T), weather cycling
 * (R: clear → rain → snow → clear) with blended lighting / fog / wind / grade / particles, and the
 * "tuning" base values the debug panel edits (the weather multiplies on top of them, so the two
 * never fight).
 *
 * In a room (`environment.interior`, LevelLook.isInterior) no weather shows: `weather` — what R
 * cycles, `setWeather` sets, a campaign saves and carries to the next level — goes on, but the
 * look blends toward clear skies (`shown`: no rain or snow, no snow cover, no overcast grey), and
 * comes back outdoors.
 */
export class Weather {
  /**
   * @param {{ lighting: LightingSystem, particles: Particles, postfx: PostFX, godRays: GodRays,
   *           world: World }} ctx
   */
  constructor({ lighting, particles, postfx, godRays, world }) {
    this.lighting = lighting;
    this.particles = particles;
    this.postfx = postfx;
    this.godRays = godRays;
    /** Debug-tunable base values. */
    this.tuning = {
      sunMul: 1, ambientMul: 1, fogMul: 2.0, exposureMul: 1, pointLightMul: 1,
      windStrength: 1, godRays: 1, dust: 1, fireflies: 1, leaves: 1, petals: 1, smoke: 1, mist: 1,
      gradeTemperature: postfx.settings.grade.temperature, gradeSaturation: postfx.settings.grade.saturation,
    };
    /**
     * Fog multiplier from the camera zoom (set by the game every frame): the fog start is fixed
     * (AtmosphereFog), so a zoomed-out camera would otherwise put the whole focus band deep in the
     * haze.
     */
    this.zoomFog = 1;
    /** The level is a room (`environment.interior`): the weather is not shown (`shown`). */
    this.indoors = false;
    this.setWorld(world);
    snowCover.value = 0;
    this.weather = 'clear';
    /** @type {WeatherState} the blended state (eased toward the target) */
    this._w = { ...WEATHER_PARAMS.clear };
    this._transition = null;
    // precipitation emitters exist from the start (shaders compile at load), faded by intensity
    // (WeatherLook: boxes sized for the gameplay camera's view volume at distance ~30)
    this.rain = particles.createEmitter(precipitationEmitter('rain', { intensity: 0 }));
    this.snow = particles.createEmitter(precipitationEmitter('snow', { intensity: 0 }));
  }

  /**
   * The world this weather drives: its dust and particle areas, lanterns and windows, water and
   * the level's fog scale. The constructor's, and a campaign's next level after a travel.
   * @param {World} world
   */
  setWorld(world) {
    this.world = world;
    /** @type {Partial<import('../engine/level/types.js').LevelEnvironment>} */
    this._env = world?.level?.environment ?? {};
    this.indoors = isInterior(this._env);
    /**
     * The level's own fog multiplier (`environment.fogScale`, default 1): a big level whose views
     * reach far can thin the haze (dawn and dusk otherwise dissolve its far layers into the horizon
     * colour).
     */
    const fogScale = Number(world?.level?.environment?.fogScale);
    this.levelFog = Number.isFinite(fogScale) && fogScale > 0 ? fogScale : 1;
    const water = world.water;
    // (read once per world: a world set aside and attached again has the scaled values in its
    // uniforms — World.waterBase keeps the ones it was built with)
    this._waterBase = water ? (world.waterBase ??= { brightness: water.uniforms.uBrightness.value, glint: water.uniforms.uGlint.value }) : null;
  }

  /**
   * The weather the level shows: `weather`, or 'clear' in a room (LevelLook.shownWeather — the
   * weather itself goes on outside).
   */
  get shown() {
    return shownWeather(this._env, this.weather);
  }

  get time() { return this.lighting.timeOfDay; }
  /** Settled snow on the ground, 0..1 (builds up while it snows; settable for tests / the panel). */
  get snowCover() { return snowCover.value; }
  set snowCover(v) { snowCover.value = clamp(Number(v) || 0); }
  get transitioning() { return !!this._transition; }

  /** Jump (or glide over `duration` seconds, always forward in time) to an hour. */
  setTime(hours, { duration = 0 } = {}) {
    hours = Number(hours);
    if (!Number.isFinite(hours)) return; // never poison the clock (NaN would stick through every glide)
    const to = ((hours % 24) + 24) % 24;
    if (duration <= 0) {
      this._transition = null;
      this.lighting.setTime(to);
      return;
    }
    const from = this.lighting.timeOfDay;
    let delta = to - from;
    if (delta < 0) delta += 24;
    this._transition = { from, delta, t: 0, duration };
  }

  /** Advance to the next time preset with a ~2 s glide. Returns the preset. */
  cycleTime() {
    const now = this._transition ? (this._transition.from + this._transition.delta) % 24 : this.lighting.timeOfDay;
    let next = TIME_PRESETS.find((p) => p.h > now + 0.05);
    if (!next) next = TIME_PRESETS[0];
    this.setTime(next.h, { duration: 2.0 });
    return next;
  }

  /**
   * Change the weather (blends over a few seconds). `instant` jumps straight to it — lighting,
   * particles and the settled snow — e.g. for a level that starts in the rain. In a room the
   * weather changes but shows clear skies (`shown`); `instant` jumps to those.
   */
  setWeather(name, { instant = false } = {}) {
    if (!Object.hasOwn(WEATHER_PARAMS, name)) return this.weather;
    this.weather = name;
    if (instant) {
      const shown = this.shown;
      Object.assign(this._w, WEATHER_PARAMS[shown]);
      snowCover.value = settledSnowCover(shown);
    }
    return name;
  }

  cycleWeather() {
    const i = WEATHERS.indexOf(this.weather);
    return this.setWeather(WEATHERS[(i + 1) % WEATHERS.length]);
  }

  /** Weather-blended value of a parameter (for the audio director etc.). */
  factor(key) { return this._w[key]; }

  update(dt) {
    // time glide
    const tr = this._transition;
    if (tr) {
      tr.t += dt;
      const k = smoothstep(0, 1, clamp(tr.t / tr.duration));
      this.lighting.setTime(tr.from + tr.delta * k);
      if (tr.t >= tr.duration) this._transition = null;
    }

    // weather blend (toward what the level shows: clear skies in a room)
    const shown = this.shown;
    const target = WEATHER_PARAMS[shown];
    const a = damp(1.1, dt);
    const w = this._w;
    for (let i = 0; i < WEATHER_KEYS.length; i++) {
      const key = WEATHER_KEYS[i];
      w[key] += (target[key] - w[key]) * a;
    }

    // the weather look (WeatherLook.js, shared with the editor's 3D preview) on top of the tuning
    const T = this.tuning;
    const L = this.lighting.settings;
    applyWeatherLighting(L, w, T);
    L.fogMul = T.fogMul * w.fog * this.zoomFog * this.levelFog;
    applyWeatherWind(w, T.windStrength);
    const g = this.postfx.settings.grade;
    applyWeatherGrade(g, w, T.gradeTemperature, T.gradeSaturation);
    // nights read blue but not neon: the grade gives back some of the saturation boost after dark
    g.saturation -= NIGHT_DESATURATION * this.lighting.nightFactor;

    // Overcast: LightingSystem recomputes these from its palette every frame (it updates before the
    // game), so greying them here never accumulates. Rain and snow lose the golden cast.
    const oc = w.overcast;
    applyOvercast(this.lighting, oc);

    // god rays: strongest around golden hour (and a touch at dawn)
    this.godRays.intensity = T.godRays * w.rays * godRayHourLevel(this.lighting.timeOfDay);

    const night = this.lighting.nightFactor;
    const world = this.world;
    const E = world.emitters;
    if (E.dust) E.dust.intensity = T.dust * w.dust;
    // the level's particle areas, by effect
    // (leaves thin out as the light fades)
    const areas = world.areaEmitters ?? [];
    for (let i = 0; i < areas.length; i++) {
      const v = areaEmitterIntensity(areas[i].preset, w, T, night);
      if (v !== null) areas[i].emitter.intensity = v;
    }
    const pe = world.propEmitters;
    for (let i = 0; i < pe.length; i++) {
      const e = pe[i];
      const p = e.preset ?? e.config?.preset;
      if (p === 'smoke') e.intensity = T.smoke;
      else if (p === 'mist') e.intensity = T.mist;
    }

    // Lanterns and windows: lit at night — and, under an overcast (rain / snow) sky, glowing a
    // little by day too, the warm accents of a rainy village.
    // (a pooled light moving to another lantern takes this value too)
    applyLampDayGlow(world.lights, world.lightPool ?? null, oc);
    applyEmissiveDay(world.emissiveEntries, oc);
    // lantern glass: its albedo is bright amber, so dim it while the lamps are unlit
    if (world.glassMaterial) world.glassMaterial.color.setScalar(glassLevel(night, oc));

    // Water: calmer at night (blue sky fill on blue albedo + boosted glints read as neon)
    const wb = this._waterBase;
    if (wb) {
      const u = world.water.uniforms;
      const k = nightWaterLevels(night);
      u.uBrightness.value = wb.brightness * k.brightness;
      u.uGlint.value = wb.glint * k.glint;
    }
    this.rain.intensity = precipitationIntensity(w.rain);
    this.snow.intensity = precipitationIntensity(w.snow);
    // snow settles over ~15 s of snowfall and melts a little faster once it stops (or it rains)
    const settle = shown === 'snow' ? 1 : 0;
    const rate = settle > snowCover.value ? 1 / 15 : 1 / 8;
    snowCover.value += clamp(settle - snowCover.value, -rate * dt, rate * dt);
  }

  dispose() {
    this.rain.dispose();
    this.snow.dispose();
  }
}
