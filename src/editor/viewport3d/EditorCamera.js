import * as THREE from 'three';
import { globalUniforms } from '../../engine/render/GlobalUniforms.js';
import { clamp, damp, DEG2RAD } from '../../engine/utils/math.js';

/** Free orbit camera used while editing. Angles in degrees. */
export const EDIT_VIEW = Object.freeze({ fov: 30, pitch: 50, minPitch: 6, maxPitch: 88, minDistance: 2.5, maxDistance: 320 });

/**
 * diorama gameplay framing (matches src/game/config.js CAMERA): narrow lens, 32° pitch, ~30 units
 * away, Q/E yaw only.
 */
export const GAME_VIEW = Object.freeze({ fov: 28, pitch: 32, distance: 30, minDistance: 18, maxDistance: 42 });

/**
 * A gameplay framing like GAME_VIEW (fov / pitch in degrees; Viewport3D rewrites distance / pitch
 * from the level's environment.camera).
 * @typedef {object} GameView
 * @property {number} fov
 * @property {number} pitch
 * @property {number} distance
 * @property {number} minDistance
 * @property {number} maxDistance
 */

const TAU = Math.PI * 2;
const _right = new THREE.Vector3();
const _fwd = new THREE.Vector3();

/**
 * EditorCamera — smooth orbit camera for the level editor's 3D viewport.
 *
 *  - 'edit' mode: free orbit around a focus point (yaw / pitch / distance), damped; pitch limits.
 *  - 'game' mode: the diorama gameplay framing (fov 28, pitch 32°, distance ~30) looking at the
 *    current focus; only yaw (Q/E, right-drag) and a limited zoom.
 *
 * Camera position = focus + (sin(yaw)·cos(pitch), sin(pitch), cos(yaw)·cos(pitch)) · distance —
 * the same convention as the engine's CameraRig (yaw 0 = camera on the +Z side looking toward -Z).
 * `update()` writes globalUniforms.uCameraYaw / uCameraPosition (sprites, foliage and flames
 * billboard toward them).
 */
export class EditorCamera {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {{ game?: Partial<GameView> }} [opts] game: overrides of GAME_VIEW (e.g. from the game
   *   config)
   */
  constructor(camera, { game = {} } = {}) {
    this.camera = camera;
    /** @type {GameView} */
    this.game = { ...GAME_VIEW, ...game };
    /** @type {'edit'|'game'} */
    this.mode = 'edit';
    /** Smoothed point the camera orbits / looks at. */
    this.focus = new THREE.Vector3(16, 1, 12);
    this.focusTarget = this.focus.clone();
    this.yaw = 0;
    this.pitch = EDIT_VIEW.pitch * DEG2RAD;
    this.distance = 40;
    /** @type {number} degrees */
    this.fov = EDIT_VIEW.fov;
    this.yawTarget = this.yaw;
    this.pitchTarget = this.pitch;
    this.distanceTarget = this.distance;
    /** @type {number} */
    this.fovTarget = this.fov;
    /** Damping rates (1/s). */
    this.lambda = { focus: 11, angle: 14, distance: 11, fov: 6 };
    /** @type {number} largest distance the edit camera may zoom out to (set from the level size) */
    this.maxDistance = EDIT_VIEW.maxDistance;
    /** Edit-mode pitch / distance saved while in game mode. */
    this._editSaved = { pitch: this.pitch, distance: this.distance };
    this._moving = true;
    this.apply();
  }

  /** Switch between 'edit' (free orbit) and 'game' (gameplay framing). */
  setMode(mode) {
    mode = mode === 'game' ? 'game' : 'edit';
    if (mode === this.mode) return;
    if (mode === 'game') {
      this._editSaved = { pitch: this.pitchTarget, distance: this.distanceTarget };
      this.pitchTarget = this.game.pitch * DEG2RAD;
      this.distanceTarget = this.game.distance;
      this.fovTarget = this.game.fov;
    } else {
      this.pitchTarget = this._editSaved.pitch;
      this.distanceTarget = this._editSaved.distance;
      this.fovTarget = EDIT_VIEW.fov;
    }
    this.mode = mode;
  }

  /** Orbit by a pointer delta in CSS pixels (yaw only in game mode). */
  orbit(dx, dy) {
    this.yawTarget -= dx * 0.0062;
    if (this.mode === 'edit') this.pitchTarget = this._clampPitch(this.pitchTarget + dy * 0.0048);
  }

  /** Rotate the yaw target by radians. */
  rotate(radians) {
    this.yawTarget += radians;
  }

  /** Move the focus by a world-space XZ delta (immediately: panning must track the pointer). */
  pan(dx, dz) {
    this.focusTarget.x += dx;
    this.focusTarget.z += dz;
    this.focus.x += dx;
    this.focus.z += dz;
    this._moving = true;
  }

  /**
   * Zoom by a factor (< 1 = closer). With an `anchor` (world point under the cursor) the focus
   * slides toward it so that point stays roughly under the cursor.
   * @param {number} factor
   * @param {THREE.Vector3|null} [anchor]
   */
  zoom(factor, anchor = null) {
    const [lo, hi] = this.distanceLimits();
    const before = this.distanceTarget;
    const after = clamp(before * factor, lo, hi);
    this.distanceTarget = after;
    if (anchor && this.mode === 'edit') {
      const k = 1 - after / before;
      this.focusTarget.x += (anchor.x - this.focusTarget.x) * k;
      this.focusTarget.z += (anchor.z - this.focusTarget.z) * k;
      this.focusTarget.y += (anchor.y - this.focusTarget.y) * k;
    }
  }

  /** [min, max] distance of the current mode. */
  distanceLimits() {
    return this.mode === 'game' ? [this.game.minDistance, this.game.maxDistance] : [EDIT_VIEW.minDistance, this.maxDistance];
  }

  /**
   * Glide to look at (x, y, z).
   * @param {number} x @param {number} y @param {number} z
   * @param {{ distance?: number, pitch?: number, yaw?: number }} [opts] pitch / yaw in degrees
   */
  lookAt(x, y, z, { distance, pitch, yaw } = {}) {
    this.focusTarget.set(x, y, z);
    if (distance != null) {
      const [lo, hi] = this.distanceLimits();
      this.distanceTarget = clamp(distance, lo, hi);
    }
    if (pitch != null && this.mode === 'edit') this.pitchTarget = this._clampPitch(pitch * DEG2RAD);
    if (yaw != null) this.yawTarget = this.yaw + wrapAngle(yaw * DEG2RAD - this.yaw);
  }

  /** Jump to the targets immediately. */
  snap() {
    this.focus.copy(this.focusTarget);
    this.yaw = this.yawTarget;
    this.pitch = this.pitchTarget;
    this.distance = this.distanceTarget;
    this.fov = this.fovTarget;
    this.apply();
  }

  /** Is the camera still gliding toward its targets? */
  get moving() {
    return this._moving;
  }

  /**
   * Damp toward the targets and place the camera.
   * @param {number} dt seconds
   */
  update(dt) {
    const L = this.lambda;
    const kf = damp(L.focus, dt);
    const ka = damp(L.angle, dt);
    const kd = damp(L.distance, dt);
    const kv = damp(L.fov, dt);
    // keep yaw bounded without jumps
    if (Math.abs(this.yawTarget) > TAU * 4) {
      const off = Math.round(this.yawTarget / TAU) * TAU;
      this.yawTarget -= off;
      this.yaw -= off;
    }
    const f = this.focus;
    const ft = this.focusTarget;
    const d0 = Math.abs(ft.x - f.x) + Math.abs(ft.y - f.y) + Math.abs(ft.z - f.z)
      + Math.abs(this.yawTarget - this.yaw) * 10 + Math.abs(this.pitchTarget - this.pitch) * 10
      + Math.abs(this.distanceTarget - this.distance) + Math.abs(this.fovTarget - this.fov);
    f.x += (ft.x - f.x) * kf;
    f.y += (ft.y - f.y) * kf;
    f.z += (ft.z - f.z) * kf;
    this.yaw += (this.yawTarget - this.yaw) * ka;
    this.pitch += (this.pitchTarget - this.pitch) * ka;
    // zoom in log space: feels uniform at every scale
    this.distance = Math.exp(Math.log(this.distance) + (Math.log(this.distanceTarget) - Math.log(this.distance)) * kd);
    this.fov += (this.fovTarget - this.fov) * kv;
    this._moving = this._moving || d0 > 1e-4;
    this.apply();
    const moving = this._moving;
    this._moving = d0 > 1e-4;
    return moving;
  }

  /** Place the camera from the current (smoothed) values. */
  apply() {
    const cam = this.camera;
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const d = this.distance;
    const f = this.focus;
    cam.position.set(f.x + Math.sin(this.yaw) * cp * d, f.y + sp * d, f.z + Math.cos(this.yaw) * cp * d);
    if (Math.abs(cam.fov - this.fov) > 1e-4 || cam.far < d * 4) {
      cam.fov = this.fov;
      cam.far = Math.max(400, d * 4);
      cam.updateProjectionMatrix();
    }
    cam.lookAt(f);
    cam.updateMatrixWorld();
    globalUniforms.uCameraYaw.value = this.yaw;
    globalUniforms.uCameraPosition.value.copy(cam.position);
  }

  /**
   * Camera-relative movement basis on the XZ plane.
   * @returns {{ forward: THREE.Vector3, right: THREE.Vector3 }} reused vectors
   */
  basis() {
    _fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    return { forward: _fwd, right: _right };
  }

  /** View-space depth of a world point (for depth-of-field focus). */
  viewDepth(p) {
    const e = this.camera.matrixWorldInverse.elements;
    return -(e[2] * p.x + e[6] * p.y + e[10] * p.z + e[14]);
  }

  _clampPitch(p) {
    return clamp(p, EDIT_VIEW.minPitch * DEG2RAD, EDIT_VIEW.maxPitch * DEG2RAD);
  }
}

function wrapAngle(a) {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  if (a < -Math.PI) a += TAU;
  return a;
}
