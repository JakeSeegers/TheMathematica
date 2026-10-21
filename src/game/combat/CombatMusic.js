/**
 * CombatMusic — which track plays on a combat level (COMBAT.md §12.2): engaged ≥ 0.8 s → `battle`
 * (fade 1.2 s); calm for 4 s → the level track `emberfall` (fade 2.0 s); the boss fight → `boss`
 * (section B from phase 2); victory → the `victory` stinger alone (the boss track, in C phrygian,
 * fades out under the D major fanfare instead of ducking), then `emberfall` once the stinger's
 * last chord has sounded. The player's death fades the music out (1.5 s) and the respawn brings
 * the level track back.
 *
 * Nothing starts while the music is off (M, `environment.music === false`, or not yet unlocked):
 * `musicTrack` still says what combat wants, and `Game.setMusic(true)` starts that track.
 */

/**
 * @import { AudioSystem } from '../../engine/audio/AudioSystem.js'
 * @import { LevelEnvironment } from '../../engine/level/types.js'
 */

const ENGAGE_DELAY = 0.8;
const CALM_DELAY = 4;
const FADE = { battle: 1.2, emberfall: 2.0, boss: 1.5 };
/**
 * The victory stinger's length: 4 bars at its own 108 bpm plus the held last chord — 18 beats,
 * 10 s (AudioSystem `buildStinger('victory')`). The level track starts after it.
 */
export const VICTORY_STINGER = (18 * 60) / 108;

export class CombatMusic {
  /**
   * @param {AudioSystem} audio
   * @param {Partial<LevelEnvironment>} env the level
   *   environment (`music === false`: never start a track)
   */
  constructor(audio, env) {
    this.audio = audio;
    this.enabled = env?.music !== false;
    this.reset();
  }

  /** The track combat wants now ('emberfall' | 'battle' | 'boss'). */
  get musicTrack() { return this.track; }

  reset() {
    /** @type {'emberfall'|'battle'|'boss'} */
    this.track = 'emberfall';
    this._engaged = 0;
    this._calm = CALM_DELAY;
    this._victory = -1;
    /** @type {string|null} the track last asked of the AudioSystem (null: ask again) */
    this._requested = null;
    this._silenced = false;
    this._wasPlaying = false;
    /** @type {'A'|'B'} the boss track's section */
    this._section = 'A';
  }

  /**
   * @param {number} dt real seconds (combat active)
   * @param {boolean} engaged
   * @param {boolean} bossFight the boss fight runs (roar to defeat / reset)
   */
  update(dt, engaged, bossFight) {
    if (this._victory >= 0) {
      this._victory -= dt;
      if (this._victory < 0) this.track = 'emberfall';
    } else if (bossFight) {
      this.track = 'boss';
      this._engaged = ENGAGE_DELAY;
      this._calm = 0;
    } else if (engaged) {
      this._engaged += dt;
      this._calm = 0;
      if (this._engaged >= ENGAGE_DELAY - 1e-6) this.track = 'battle';
    } else {
      this._calm += dt;
      this._engaged = 0;
      if (this._calm >= CALM_DELAY - 1e-6) this.track = 'emberfall';
    }
    this._apply();
  }

  _apply() {
    const audio = this.audio;
    if (!this.enabled || this._silenced || !audio.musicPlaying) {
      this._requested = null;
      return;
    }
    // (a request is made once per change: a track that does not start — still loading — is not
    // asked for again every frame)
    if (this.track === this._requested) return;
    this._requested = this.track;
    if (audio.musicTrack !== this.track) audio.startMusic({ track: this.track, fade: FADE[this.track] ?? 1.5 });
    if (this.track === 'boss' && this._section !== 'A') audio.setMusicSection?.(this._section);
  }

  /**
   * Boss phase ≥ 2 plays section B (switches at the next bar).
   * @param {'A'|'B'} name
   */
  setSection(name) {
    this._section = name;
    if (this.track === 'boss' && this.audio.musicPlaying) this.audio.setMusicSection?.(name);
  }

  /** The boss fell: the stinger (the boss track fades out under it), then the level track. */
  victory() {
    if (this.enabled && this.audio.musicPlaying) this.audio.playStinger?.('victory', { duck: 0 });
    this._victory = VICTORY_STINGER;
    this._section = 'A';
  }

  /** The player fell: fade the music out (1.5 s). */
  death() {
    this._wasPlaying = this.audio.musicPlaying;
    this._silenced = true;
    if (this._wasPlaying) this.audio.stopMusic({ fade: 1.5 });
  }

  /** Respawned: the level track again (if the music was playing). */
  respawn() {
    this._silenced = false;
    this.track = 'emberfall';
    this._engaged = 0;
    this._calm = CALM_DELAY;
    this._section = 'A';
    this._requested = null;
    if (this._wasPlaying && this.enabled) {
      this.audio.startMusic({ track: 'emberfall', fade: 2.0 });
      this._requested = 'emberfall';
    }
    this._wasPlaying = false;
  }
}
