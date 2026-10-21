import { clamp, smoothstep } from '../engine/index.js';

/**
 * @import { AudioSystem } from '../engine/audio/AudioSystem.js'
 * @import { LightingSystem } from '../engine/lighting/LightingSystem.js'
 * @import { TileMap } from '../engine/world/TileMap.js'
 * @import { Weather } from './Weather.js'
 */

/**
 * Drives the procedural ambience from the world state a few times per second:
 * wind + birds by day, crickets at night, the crackle of the nearest campfire by distance, the
 * river and the waterfalls by distance to the nearest water, all scaled by the weather; on combat
 * levels `combatIntensity` hushes the birds during a fight.
 */
export class AudioDirector {
  /**
   * @param {{ audio: AudioSystem, lighting: LightingSystem, weather: Weather, tileMap: TileMap,
   *           fires?: {x:number, z:number}[], falls?: {x:number, z:number}[] }} ctx
   *   fires: campfire positions; falls: foot of every roaring waterfall (both may be empty)
   */
  constructor({ audio, lighting, weather, tileMap, fires = [], falls = [] }) {
    this.audio = audio;
    this.lighting = lighting;
    this.weather = weather;
    this.fires = fires;
    this.falls = falls;
    this.enabled = false;
    this._timer = 0;
    // water sample points: the centre of every water tile (river, pool, pond, stream), packed
    // x0, z0, x1, z1 … (compute() runs a few times a second over up to thousands of them: no garbage)
    const pts = [];
    tileMap.forEachTile((i, j, t) => { if (t.water) pts.push(i + 0.5, j + 0.5); });
    this.waterXZ = Float32Array.from(pts);
    this.levels = { wind: 0, birds: 0, crickets: 0, fire: 0, water: 0 };
    /**
     * 0..1: how much a fight is going on (COMBAT.md §12.2). Birds are scaled by (1 − 0.8·i) so
     * they fall silent while the player is engaged; combat sets 1 while engaged and eases it back
     * over 3 s. The default 0 leaves the mix unchanged (peaceful levels never touch it).
     */
    this.combatIntensity = 0;
  }

  /** Distance from the listener to the nearest point (Infinity when there is none). */
  static nearest(points, listener) {
    let best = Infinity;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const d = (p.x - listener.x) ** 2 + (p.z - listener.z) ** 2;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  /** Current mix, recomputed immediately (also used by state()). */
  compute(listener) {
    const night = this.lighting.nightFactor;
    const rain = this.weather.factor('rain');
    const snow = this.weather.factor('snow');
    const storm = clamp(rain + snow);
    const dFire = AudioDirector.nearest(this.fires, listener);
    let dWater = Infinity;
    const w = this.waterXZ;
    const lx = listener.x;
    const lz = listener.z;
    for (let k = 0; k < w.length; k += 2) {
      const dx = w[k] - lx;
      const dz = w[k + 1] - lz;
      const d = dx * dx + dz * dz;
      if (d < dWater) dWater = d;
    }
    dWater = Math.sqrt(dWater);
    const dFall = AudioDirector.nearest(this.falls, listener);
    const L = this.levels;
    L.wind = clamp(0.28 + 0.12 * (listener.y > 3 ? 1 : 0) + storm * 0.55);
    L.birds = clamp((1 - night) * (1 - storm * 0.85) * 0.75);
    if (this.combatIntensity > 0) L.birds *= 1 - 0.8 * clamp(this.combatIntensity);
    L.crickets = clamp(smoothstep(0.35, 0.9, night) * (1 - storm) * 0.8);
    L.fire = clamp((1 - smoothstep(2, 15, dFire)) ** 1.5 * 0.9);
    L.water = clamp(Math.max((1 - smoothstep(1, 11, dWater)) * 0.55, (1 - smoothstep(3, 20, dFall)) * 0.95));
    return L;
  }

  update(dt, listener) {
    if (!this.enabled) return;
    this._timer -= dt;
    if (this._timer > 0) return;
    this._timer = 0.25;
    this.audio.setAmbience(this.compute(listener), { fade: 0.6 });
  }
}
