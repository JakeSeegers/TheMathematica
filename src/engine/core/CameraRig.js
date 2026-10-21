import * as THREE from 'three';
import { globalUniforms } from '../render/GlobalUniforms.js';
import { clamp, damp, DEG2RAD, valueNoise2 } from '../utils/math.js';

/** @import { Input } from './Input.js' */

const _tp = new THREE.Vector3();
const _raw = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();

/**
 * What `CameraRig#update` reads from its input: an Input, or a test double with these members
 * (`getLookVector` is optional — the rig checks for it).
 * @typedef CameraInput
 * @type {Pick<Input, 'enabled' | 'action' | 'wheelDelta'>
 *   & { getLookVector?: () => { x: number, y: number } }}
 */

/**
 * CameraRig — the 2.5D "diorama" camera: narrow FOV, high pitch, far away, smoothly
 * following a target with look-ahead, orbiting on Q/E within a limited arc and zooming
 * with the wheel.
 *
 * Camera position = focusPoint + (sin(yaw)·cos(pitch), sin(pitch), cos(yaw)·cos(pitch)) · distance
 * (yaw 0 = camera on the +Z side looking toward −Z).
 *
 * All smoothing uses frame-rate independent exponential damping. `update()` also writes
 * `globalUniforms.uCameraYaw` and `globalUniforms.uCameraPosition`.
 *
 * Typical wiring (camera after gameplay so it follows this frame's player position):
 *   engine.addSystem({ name: 'camera', lateUpdate: (dt) => rig.update(dt, engine.input) }, 100);
 */
export class CameraRig {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {{ pitch?: number, yaw?: number, distance?: number, minDistance?: number, maxDistance?: number,
   *           fov?: number, followLambda?: number, lookAhead?: number, targetOffsetY?: number,
   *           freeYaw?: boolean, yawLimit?: number, rotateSpeed?: number, rotateLambda?: number,
   *           pitchLambda?: number, zoomLambda?: number, zoomKeySpeed?: number, wheelZoomScale?: number,
   *           followLambdaY?: number, lookAheadSpeed?: number, lookAheadLambda?: number,
   *           minPitch?: number, maxPitch?: number, autoSnapDistance?: number }} [opts]
   *   Angles in DEGREES here (pitch 32, yaw 0, yawLimit 60, rotateSpeed 70 °/s, minPitch 8, maxPitch 80);
   *   distance 24 in [14, 36]; fov 28; followLambda 5 (1/s); lookAhead 1.0 (world units at full
   *   `lookAheadSpeed` 4 u/s); targetOffsetY 1.0 (focus above the target's feet).
   */
  constructor(camera, opts = {}) {
    /** @type {THREE.PerspectiveCamera} */
    this.camera = camera;
    this.name = 'CameraRig';

    const o = opts;
    this.minDistance = o.minDistance ?? 14;
    this.maxDistance = o.maxDistance ?? 36;
    this.followLambda = o.followLambda ?? 5;
    this.followLambdaY = o.followLambdaY ?? (o.followLambda ?? 5) * 0.7;
    this.lookAhead = o.lookAhead ?? 1.0;
    this.lookAheadSpeed = o.lookAheadSpeed ?? 4;
    this.lookAheadLambda = o.lookAheadLambda ?? 2.2;
    this.velocityLambda = 8;
    this.targetOffsetY = o.targetOffsetY ?? 1.0;
    this.freeYaw = !!o.freeYaw;
    this.yawLimit = (o.yawLimit ?? 60) * DEG2RAD;
    this.rotateSpeed = (o.rotateSpeed ?? 70) * DEG2RAD;
    this.rotateLambda = o.rotateLambda ?? 7;
    this.pitchLambda = o.pitchLambda ?? 6;
    this.zoomLambda = o.zoomLambda ?? 6;
    this.zoomKeySpeed = o.zoomKeySpeed ?? 14;
    this.wheelZoomScale = o.wheelZoomScale ?? 0.012;
    /**
     * Zoom speed (units / s) at full right-stick Y deflection (stick up = zoom in); 0 = off
     * (default). Combat levels set 14, where pad X / Y no longer zoom (COMBAT.md §5.2 / §5.3).
     * Uses `input.getLookVector().y`, deadzoned like the X axis that rotates the camera.
     */
    this.stickZoom = 0;
    this.minPitch = (o.minPitch ?? 8) * DEG2RAD;
    this.maxPitch = (o.maxPitch ?? 80) * DEG2RAD;
    /** A target jumping farther than this in one frame is treated as a teleport (focus snaps). */
    this.autoSnapDistance = o.autoSnapDistance ?? 8;
    /** When false, update() ignores input (rotation/zoom), e.g. during dialogs or cutscenes. */
    this.inputEnabled = true;

    const yaw = (o.yaw ?? 0) * DEG2RAD;
    const pitch = clamp((o.pitch ?? 32) * DEG2RAD, this.minPitch, this.maxPitch);
    const distance = clamp(o.distance ?? 24, this.minDistance, this.maxDistance);
    /** Centre of the allowed yaw arc (the initial yaw). */
    this.yawCenter = yaw;

    /** Smoothed point the camera looks at. */
    this.focusPoint = new THREE.Vector3();
    /** Current (smoothed) yaw, radians. */
    this.yaw = yaw;
    /** Current (smoothed) pitch, radians. */
    this.pitch = pitch;
    /** Current (smoothed) distance, world units. */
    this.distance = distance;
    this.yawTarget = yaw;
    this.pitchTarget = pitch;
    this.distanceTarget = distance;
    /** @type {null | {minX:number, maxX:number, minZ:number, maxZ:number}} clamps focusPoint */
    this.bounds = null;

    /** @type {THREE.Object3D | THREE.Vector3 | null} */
    this.target = null;
    /** Smoothed target velocity on XZ (world units / s). */
    this.velocity = new THREE.Vector3();
    /** Current smoothed look-ahead offset. */
    this.lookOffset = new THREE.Vector3();
    this._prevTarget = new THREE.Vector3();
    this._hasPrev = false;

    this._shake = { intensity: 0, duration: 0, time: 0, seed: 0 };
    this._shakeClock = 0;
    this.shakeFrequency = 14;
    this._basis = { forward: new THREE.Vector3(0, 0, -1), right: new THREE.Vector3(1, 0, 0) };

    if (o.fov !== undefined || camera.fov !== 28) {
      camera.fov = o.fov ?? 28;
      camera.updateProjectionMatrix();
    }
    this._apply(0);
  }

  // ---------------------------------------------------------------------------
  // Contract API
  // ---------------------------------------------------------------------------

  /**
   * Follow a target (Object3D — uses its world position — or a Vector3 that is read live).
   * Pass null to stop following (focus stays where it is).
   * @param {THREE.Object3D | THREE.Vector3 | null} object3D
   */
  setTarget(object3D) {
    this.target = object3D ?? null;
    this._hasPrev = false;
    this.velocity.set(0, 0, 0);
    return this;
  }

  /** Add to the yaw target (radians); clamped to ±yawLimit around yawCenter unless freeYaw. */
  rotate(deltaRadians) {
    this.yawTarget += deltaRadians;
    this._clampYaw();
    return this;
  }

  /** Add to the distance target (world units), clamped to [minDistance, maxDistance]. */
  zoom(delta) {
    this.distanceTarget = clamp(this.distanceTarget + delta, this.minDistance, this.maxDistance);
    return this;
  }

  /** Zoom in by `amount` world units (convenience). */
  zoomIn(amount = 2) {
    return this.zoom(-amount);
  }

  /** Zoom out by `amount` world units (convenience). */
  zoomOut(amount = 2) {
    return this.zoom(amount);
  }

  /**
   * Start a camera shake. Stronger shakes override weaker ones; amplitude decays to 0 over `duration`.
   * @param {number} intensity world-unit amplitude (0.1 subtle … 0.6 strong)
   * @param {number} [duration=0.4] seconds
   */
  shake(intensity, duration = 0.4) {
    const s = this._shake;
    const remaining = s.duration > 0 ? s.intensity * (1 - Math.min(1, s.time / s.duration)) ** 2 : 0;
    if (intensity >= remaining) {
      s.intensity = intensity;
      s.duration = Math.max(0.01, duration);
      s.time = 0;
      s.seed = (s.seed + 1) % 997;
    }
    return this;
  }

  /** Jump instantly to all targets (yaw, pitch, distance, focus). */
  snap() {
    this.yaw = this.yawTarget;
    this.pitch = this.pitchTarget;
    this.distance = this.distanceTarget;
    this.lookOffset.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    if (this.target && this._targetPosition(_tp)) {
      this._prevTarget.copy(_tp);
      this._hasPrev = true;
      this.focusPoint.set(_tp.x, _tp.y + this.targetOffsetY, _tp.z);
    }
    this._clampToBounds(this.focusPoint);
    this._apply(0);
    return this;
  }

  /**
   * Advance smoothing and position the camera.
   * @param {number} dt seconds
   * @param {CameraInput | number | null} [input] reads camLeft/camRight (hold to orbit),
   *   zoomIn/zoomOut (hold), wheelDelta and the gamepad right stick (X orbits; Y zooms when
   *   `stickZoom` is non-zero). When called as an engine system (`update(dt, t, engine)`) this
   *   is the elapsed time `t` and the engine's input is used.
   * @param {{ input?: CameraInput }} [engine] the Engine, when run as a system
   */
  update(dt, input, engine) {
    if (typeof input !== 'object' || input === null) input = engine?.input ?? null;
    dt = dt > 0 ? dt : 0;

    // --- Input ---------------------------------------------------------------
    if (input && this.inputEnabled && input.enabled !== false) {
      let rot = 0;
      if (input.action('camLeft')) rot -= 1;
      if (input.action('camRight')) rot += 1;
      if (typeof input.getLookVector === 'function') rot += input.getLookVector().x;
      if (rot !== 0) this.rotate(clamp(rot, -1, 1) * this.rotateSpeed * dt);

      let z = 0;
      if (input.action('zoomIn')) z -= 1;
      if (input.action('zoomOut')) z += 1;
      if (z !== 0) this.zoom(z * this.zoomKeySpeed * dt);
      if (this.stickZoom !== 0 && typeof input.getLookVector === 'function') {
        const ly = input.getLookVector().y;
        if (ly !== 0) this.zoom(-clamp(ly, -1, 1) * this.stickZoom * dt);
      }
      if (input.wheelDelta) this.zoom(input.wheelDelta * this.wheelZoomScale);
    }

    // --- Target follow + look-ahead --------------------------------------------
    if (this.target && this._targetPosition(_tp)) {
      if (!this._hasPrev) {
        this._prevTarget.copy(_tp);
        this._hasPrev = true;
      }
      const jump = Math.hypot(_tp.x - this._prevTarget.x, _tp.z - this._prevTarget.z);
      if (jump > this.autoSnapDistance) {
        // Teleport: don't smear the camera across the map.
        this._prevTarget.copy(_tp);
        this.snap();
        return this;
      }
      if (dt > 0) {
        _raw.set((_tp.x - this._prevTarget.x) / dt, 0, (_tp.z - this._prevTarget.z) / dt);
        this.velocity.lerp(_raw, damp(this.velocityLambda, dt));
      }
      this._prevTarget.copy(_tp);

      // Look-ahead: up to `lookAhead` units in the direction of motion, scaled by speed.
      const speed = Math.hypot(this.velocity.x, this.velocity.z);
      let lx = 0;
      let lz = 0;
      if (speed > 0.05 && this.lookAhead > 0) {
        const k = (this.lookAhead * Math.min(1, speed / this.lookAheadSpeed)) / speed;
        lx = this.velocity.x * k;
        lz = this.velocity.z * k;
      }
      const la = damp(this.lookAheadLambda, dt);
      this.lookOffset.x += (lx - this.lookOffset.x) * la;
      this.lookOffset.z += (lz - this.lookOffset.z) * la;

      _desired.set(_tp.x + this.lookOffset.x, _tp.y + this.targetOffsetY, _tp.z + this.lookOffset.z);
      this._clampToBounds(_desired);
      const kf = damp(this.followLambda, dt);
      const ky = damp(this.followLambdaY, dt);
      this.focusPoint.x += (_desired.x - this.focusPoint.x) * kf;
      this.focusPoint.y += (_desired.y - this.focusPoint.y) * ky;
      this.focusPoint.z += (_desired.z - this.focusPoint.z) * kf;
    }
    this._clampToBounds(this.focusPoint);

    // --- Orbit smoothing -----------------------------------------------------------
    this._clampYaw();
    this.pitchTarget = clamp(this.pitchTarget, this.minPitch, this.maxPitch);
    this.distanceTarget = clamp(this.distanceTarget, this.minDistance, this.maxDistance);
    this.yaw += (this.yawTarget - this.yaw) * damp(this.rotateLambda, dt);
    this.pitch += (this.pitchTarget - this.pitch) * damp(this.pitchLambda, dt);
    this.distance += (this.distanceTarget - this.distance) * damp(this.zoomLambda, dt);

    this._apply(dt);
    return this;
  }

  /** Camera → focusPoint distance (for DOF autofocus). */
  get focusDistance() {
    return this.camera.position.distanceTo(this.focusPoint);
  }

  /**
   * Camera-relative movement basis on the XZ plane. `forward` points from the camera toward
   * the focus point (screen up), `right` is screen right. The returned object and vectors are
   * reused between calls — copy them if you need to keep them.
   * @param {{forward: THREE.Vector3, right: THREE.Vector3}} [out]
   * @returns {{forward: THREE.Vector3, right: THREE.Vector3}}
   */
  getMoveBasis(out = this._basis) {
    const s = Math.sin(this.yaw);
    const c = Math.cos(this.yaw);
    out.forward.set(-s, 0, -c);
    out.right.set(c, 0, -s);
    return out;
  }

  // ---------------------------------------------------------------------------
  // Extras
  // ---------------------------------------------------------------------------

  /**
   * Convert a screen-space move vector (x right, y up — e.g. `input.getMoveVector()`) into a
   * world XZ direction relative to the camera.
   * @param {number} x
   * @param {number} y
   * @param {THREE.Vector3} [out]
   */
  toWorldDirection(x, y, out = new THREE.Vector3()) {
    const s = Math.sin(this.yaw);
    const c = Math.cos(this.yaw);
    return out.set(c * x - s * y, 0, -s * x - c * y);
  }

  /** Field of view in degrees. */
  get fov() {
    return this.camera.fov;
  }

  set fov(v) {
    this.camera.fov = v;
    this.camera.updateProjectionMatrix();
  }

  /** Set yaw/pitch targets in degrees (smoothly approached). */
  setAngles(yawDeg, pitchDeg = this.pitchTarget / DEG2RAD) {
    this.yawTarget = yawDeg * DEG2RAD;
    this._clampYaw();
    this.pitchTarget = clamp(pitchDeg * DEG2RAD, this.minPitch, this.maxPitch);
    return this;
  }

  /** Current shake amplitude (world units). */
  get shakeAmount() {
    const s = this._shake;
    if (s.duration <= 0 || s.time >= s.duration) return 0;
    return s.intensity * (1 - s.time / s.duration) ** 2;
  }

  /** Nothing GPU-side to release; present for symmetry. */
  dispose() {
    this.target = null;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * @param {THREE.Vector3} out
   * @returns {boolean} false when there is no target
   */
  _targetPosition(out) {
    // duck-typed below (Object3D, Vector3 or any { x, y?, z? }): read through the widest view
    const t = /** @type {THREE.Object3D & THREE.Vector3} */ (this.target);
    if (!t) return false;
    if (t.isObject3D) t.getWorldPosition(out);
    else if (t.isVector3) out.copy(t);
    else if (typeof t.x === 'number') out.set(t.x, t.y ?? 0, t.z ?? 0);
    else return false;
    return true;
  }

  _clampYaw() {
    if (this.freeYaw) return;
    this.yawTarget = clamp(this.yawTarget, this.yawCenter - this.yawLimit, this.yawCenter + this.yawLimit);
  }

  _clampToBounds(v) {
    const b = this.bounds;
    if (!b) return;
    v.x = clamp(v.x, b.minX, b.maxX);
    v.z = clamp(v.z, b.minZ, b.maxZ);
  }

  _apply(dt) {
    const cam = this.camera;
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const sy = Math.sin(this.yaw);
    const cy = Math.cos(this.yaw);
    const d = this.distance;
    const f = this.focusPoint;
    cam.position.set(f.x + sy * cp * d, f.y + sp * d, f.z + cy * cp * d);
    _look.copy(f);

    // Shake: smooth value noise, quadratic decay, in camera right/up axes + a hint of roll.
    let roll = 0;
    const s = this._shake;
    if (s.duration > 0 && s.time < s.duration) {
      s.time += dt;
      this._shakeClock += dt;
      const p = Math.min(1, s.time / s.duration);
      const amp = s.intensity * (1 - p) * (1 - p);
      const tt = this._shakeClock * this.shakeFrequency;
      const nx = (valueNoise2(tt, 3.1, s.seed) - 0.5) * 2;
      const ny = (valueNoise2(tt, 17.7, s.seed) - 0.5) * 2;
      const nr = (valueNoise2(tt * 0.7, 41.3, s.seed) - 0.5) * 2;
      _right.set(cy, 0, -sy);
      _up.set(-sy * sp, cp, -cy * sp);
      cam.position.addScaledVector(_right, nx * amp).addScaledVector(_up, ny * amp);
      _look.addScaledVector(_right, nx * amp * 0.35).addScaledVector(_up, ny * amp * 0.35);
      roll = nr * amp * 0.02;
      if (p >= 1) s.intensity = 0;
    }

    cam.lookAt(_look);
    if (roll !== 0) cam.rotateZ(roll);
    cam.updateMatrixWorld();

    globalUniforms.uCameraYaw.value = this.yaw;
    globalUniforms.uCameraPosition.value.copy(cam.position);
  }
}
