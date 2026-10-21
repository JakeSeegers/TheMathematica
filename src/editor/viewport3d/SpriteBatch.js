import * as THREE from 'three';
import { patchSpriteLighting } from '../../engine/sprite/Sprite3D.js';
import { BlobBatch } from '../../engine/sprite/BlobBatch.js';
import { isShadowFrustum } from '../../engine/world/ShadowCasters.js';

/**
 * @import { Sprite3D } from '../../engine/sprite/Sprite3D.js'
 * @import { LightingSystem } from '../../engine/lighting/LightingSystem.js'
 */

/** GLSL: the instance's frame (sheet cell) — `aUvRect` = texture offset.xy, repeat.xy (a negative x repeat mirrors). */
const UV_RECT_PARS = 'attribute vec4 aUvRect;';
const UV_RECT = `#ifdef USE_MAP
	vMapUv = uv * aUvRect.zw + aUvRect.xy;
#endif`;
/** GLSL: the world position of an instance's origin (a Sprite3D's lookup uses its own quad's, `modelMatrix[ 3 ].xyz`). */
const INSTANCE_CENTER = '( modelMatrix * vec4( instanceMatrix[ 3 ].xyz, 1.0 ) ).xyz';
/** First capacity of a group's instance buffers (doubled when full). */
const FIRST_CAPACITY = 32;
/** Blob contact shadows drawn by the batch (sprites past it draw their own blob). */
const BLOB_CAPACITY = 512;
/** The priming instance (see prime): collapsed to a point far below the map — it covers no pixel. */
const PRIME_MATRIX = new THREE.Matrix4().makeScale(1e-6, 1e-6, 1e-6).setPosition(0, -1000, 0);
const _sphere = new THREE.Sphere();

const sheetIds = new WeakMap();
let nextSheetId = 1;
const sheetId = (sheet) => {
  let id = sheetIds.get(sheet);
  if (!id) sheetIds.set(sheet, (id = nextSheetId++));
  return id;
};

/**
 * The batch's draws for the sprites of one sheet and look (`_createGroup`; meshes by `_build`).
 * @typedef {object} SpriteGroup
 * @property {string} key                        its groupKey
 * @property {THREE.MeshLambertMaterial} material  the colour material (both meshes use it)
 * @property {THREE.MeshDepthMaterial|null} depthMaterial  the proxies' shadow depth (casting groups)
 * @property {ReturnType<LightingSystem['registerEmissive']>|null} fill
 *   the colour material's registered day / night fill (null without `lighting` / `fill`)
 * @property {boolean} casts                     its sprites cast sun-facing shadows
 * @property {THREE.BufferGeometry} quad         the sprites' quad (copied into the instanced meshes)
 * @property {number} renderOrder
 * @property {Sprite3D[]} sprites                every sprite of the group
 * @property {number} capacity                   instances the meshes have room for
 * @property {THREE.InstancedMesh|null} color    colour mesh (null until the first _build)
 * @property {THREE.InstancedMesh|null} shadow   shadow-proxy mesh (casting groups)
 * @property {THREE.InstancedBufferAttribute|null} uv        `aUvRect` of `color`
 * @property {THREE.InstancedBufferAttribute|null} shadowUv  `aUvRect` of `shadow`
 * @property {boolean} ready                     programs warm: the batch draws its sprites
 * @property {Sprite3D[]} shown                  this frame's shown sprites
 * @property {Sprite3D[]} casting                this frame's sprites that cast a shadow
 * @property {boolean} prime                     draws its priming instance this frame (see prime)
 */

/**
 * SpriteBatch — draws many Sprite3D billboards with a few instanced draw calls (the editor's enemy
 * previews: a Sprite3D alone costs a colour draw, a shadow-pass draw and a blob draw —
 * KNOWN_ISSUES COMBAT-10).
 *
 * The sprites stay ordinary Sprite3D objects in the scene: they keep animating, billboarding and
 * turning their shadow proxy (`Sprite3D.update`), are picked by their owner's boxes, hide with
 * `visible`, and the selection outline still renders a sprite's own quad on its mask layer. An
 * adopted sprite's quad and shadow proxy leave render layer 0 — the camera and the shadow pass no
 * longer draw them — and every frame `update()` lists the shown sprites (their quad and proxy
 * world matrices up to date); per sheet and look one colour draw and one shadow-pass draw then
 * take the sprites in that pass's frustum (see _fill), and the blob contact shadows of every
 * adopted sprite go through one engine `BlobBatch`.
 *
 * Culling: as the sprites' own meshes are, per sprite — each pass (the camera's colour pass, the
 * sun's shadow pass) copies into the instance buffers only the quads / proxies whose bounding
 * sphere meets its frustum (from the mesh's `intersectsFrustum`, which three.js calls just before
 * it uploads the buffers), and a mesh with none in view issues no draw; the blob batch draws when
 * one of its blobs is in view. Off-screen enemies cost no draw call, as without the batch.
 *
 * Same look: the colour material is Sprite3D's lit material (`patchSpriteLighting`: bent normals,
 * wrap diffuse, the self-shadow-free shadow lookup — centred on each instance's origin, as a
 * sprite's own is on its quad —, emissive × texel colour) with the same sheet texture, uniform
 * values, alpha test, colour, emissive and day / night fill; only the frame comes per instance
 * instead of from a per-sprite texture clone. The shadow casters are the sun-facing proxies with
 * the same alpha-tested depth. What the batch does not draw — a dithered fade (`opacity` or
 * `bodyOpacity` < 1) and the combat fx — stays with the sprite: a fading sprite draws itself until
 * it is opaque again, and `combatFx` or unlit sprites are not taken.
 *
 * Warm-up: a new group compiles its programs first (the `compile` callback, in the background);
 * until then its sprites keep drawing themselves (the plain Sprite3D programs are warm), so the
 * first sprite of a kind never compiles a shader inside a frame. Some drivers still build their
 * shader executables at a program's first draw (ANGLE on D3D11: ≈ 40–190 ms for the batch's
 * three programs); `prime()` spends that before the first sprite comes (see there).
 */
export class SpriteBatch {
  /**
   * @param {{ parent: THREE.Object3D, lights?: THREE.Light[], lighting?: LightingSystem,
   *           fill?: { day: number, night: number }|null,
   *           compile?: ((color: THREE.Object3D[], shadow: THREE.Object3D[]) => Promise<any>)|null }} opts
   *   lights: the shadow-casting lights (the proxies draw in their shadow passes only);
   *   lighting / fill: `LightingSystem.registerEmissive(material, fill)` for the colour materials
   *   (the sprites' own day / night fill); compile: warms the programs of new colour meshes and of
   *   new shadow casters, resolving when they are ready (absent: batch at once)
   */
  constructor({ parent, lights = [], lighting = null, fill = null, compile = null }) {
    this.root = new THREE.Group();
    this.root.name = 'Editor:spriteBatch';
    parent.add(this.root);
    this.lights = lights;
    this.lighting = lighting;
    this.fill = fill;
    this._compile = compile;
    /** @type {Map<string, SpriteGroup>} group key → group */
    this._groups = new Map();
    /** @type {Map<Sprite3D, SpriteGroup>} sprite → its group */
    this._of = new Map();
    /** Sprites drawn by the batch now (the others draw themselves). */
    this._adopted = new Set();
    this._blobs = new BlobBatch({ capacity: BLOB_CAPACITY });
    /** The blob batch's program warm-up (null until a sprite with a blob came) and whether it is done. */
    this._blobsWarm = null;
    this._blobsReady = false;
    /** false = every sprite draws itself (look comparisons); see setEnabled. */
    this.enabled = true;
    this._disposed = false;
    /** The group being primed (see prime) and whether the batch's programs have drawn once. */
    this._priming = null;
    this.primed = false;
    /** The group drawing its priming instance this frame, and whether the blob batch does too. */
    this._primeGroup = null;
    this._primeBlob = false;
  }

  /**
   * Draw the batch's programs once before a sprite needs them: makes and warms the group of
   * `template` (a sprite that is not added; kept by the caller while the batch lives), then draws
   * it — and the blob batch — for one frame as a single collapsed instance that covers no pixel.
   * The groups share their programs, so one group primes all. The owner calls it when the user
   * picks the tool that adds such sprites: the first draw's cost (see the class notes) is spent
   * then, not in the frames after the first one is placed. No-op once the batch has drawn.
   * @param {Sprite3D} template
   */
  prime(template) {
    if (this._disposed || this.primed || this._priming || !template?.isSprite3D) return;
    if (!template._opts?.lit || template._fx) return;
    const key = groupKey(template);
    let g = this._groups.get(key);
    if (!g) {
      g = this._createGroup(key, template);
      this._groups.set(key, g);
    }
    this._priming = g;
  }

  /** Sprites handled, drawn by the batch, groups, blobs drawn by the batch. */
  get stats() {
    return { sprites: this._of.size, adopted: this._adopted.size, groups: this._groups.size, blobs: this._blobs.sprites.length };
  }

  /**
   * Draw `sprite` through the batch (a lit Sprite3D without combat fx). Returns false for a
   * sprite the batch does not take (it keeps drawing itself).
   * @param {Sprite3D} sprite
   */
  add(sprite) {
    if (this._disposed || !sprite?.isSprite3D || this._of.has(sprite)) return false;
    if (!sprite._opts?.lit || sprite._fx) return false;
    const key = groupKey(sprite);
    let g = this._groups.get(key);
    if (!g) {
      g = this._createGroup(key, sprite);
      this._groups.set(key, g);
    }
    if (g.sprites.length >= g.capacity) this._build(g, g.capacity * 2);
    g.sprites.push(sprite);
    this._of.set(sprite, g);
    if (g.ready && this.enabled) this._adopt(sprite, g);
    return true;
  }

  /**
   * Stop drawing a sprite (call it before disposing the sprite): it draws itself again.
   * @param {Sprite3D} sprite
   */
  remove(sprite) {
    const g = this._of.get(sprite);
    if (!g) return false;
    this._of.delete(sprite);
    for (const list of [g.sprites, g.shown, g.casting]) {
      const i = list.indexOf(sprite);
      if (i >= 0) list.splice(i, 1);
    }
    this._release(sprite);
    return true;
  }

  /** true: batch (default); false: every sprite draws itself again (look comparisons). */
  setEnabled(on) {
    on = !!on;
    if (on === this.enabled || this._disposed) return;
    this.enabled = on;
    for (const [s, g] of this._of) {
      if (on && g.ready) this._adopt(s, g);
      else this._release(s);
    }
    for (const g of this._groups.values()) {
      g.color.visible = false;
      if (g.shadow) g.shadow.visible = false;
    }
    if (this._blobs.mesh) this._blobs.mesh.visible = on;
  }

  /**
   * Per frame, after the sprites updated (before rendering): list the shown sprites of each group
   * (the passes copy those in their frustum into the instance buffers, see _fill).
   */
  update() {
    if (!this.enabled || this._disposed) return;
    // (last frame's priming instance has drawn)
    if (this._primeGroup) this._primeGroup.prime = false;
    this._primeGroup = null;
    this._primeBlob = false;
    for (const g of this._groups.values()) {
      if (!g.ready) continue;
      const shown = g.shown;
      const casting = g.casting;
      shown.length = 0;
      casting.length = 0;
      for (let i = 0; i < g.sprites.length; i++) {
        const s = g.sprites[i];
        // a fading sprite dithers: it draws itself meanwhile
        const own = fading(s);
        if (own === this._adopted.has(s)) {
          if (own) this._release(s);
          else this._adopt(s, g);
        }
        if (own || !s.mesh.visible || !shownInScene(s)) continue;
        s.mesh.updateWorldMatrix(true, false);
        shown.push(s);
        if (g.shadow && s.shadowProxy.visible) {
          s.shadowProxy.updateWorldMatrix(false, false);
          casting.push(s);
        }
      }
      g.color.count = 0;
      g.color.visible = shown.length > 0;
      if (g.shadow) {
        g.shadow.count = 0;
        g.shadow.visible = casting.length > 0;
      }
    }
    if (this._blobsReady) this._blobs.update();
    const p = this._priming;
    if (p && this.primed) this._priming = null;
    else if (p?.ready && (!this._blobsWarm || this._blobsReady)) {
      // the priming frame: one collapsed instance of the group, its shadow proxy and a blob
      // (drawn whatever the frustum, see _fill)
      p.prime = true;
      p.color.visible = true;
      if (p.shadow) p.shadow.visible = true;
      this._primeGroup = p;
      const bm = this._blobs.mesh;
      if (this._blobsReady && bm && bm.count === 0) {
        bm.setMatrixAt(0, PRIME_MATRIX);
        bm.count = 1;
        bm.instanceMatrix.needsUpdate = true;
        this._primeBlob = true;
      }
      this._priming = null;
    }
  }

  /**
   * A pass is about to draw a group's colour (`shadow` false) or shadow-proxy mesh — three.js
   * calls the mesh's `intersectsFrustum` right before it uploads the instance buffers: copy the
   * listed sprites whose quad / proxy bounding sphere meets `frustum` (the test three.js runs on a
   * sprite's own mesh), with their frames, into the buffers. Returns whether any is in view (none:
   * the mesh is not drawn).
   * @param {SpriteGroup} g
   * @param {boolean} shadow
   * @param {THREE.Frustum} frustum
   */
  _fill(g, shadow, frustum) {
    const mesh = shadow ? g.shadow : g.color;
    const attr = shadow ? g.shadowUv : g.uv;
    const uv = attr.array;
    let n = 0;
    if (g.prime) {
      mesh.setMatrixAt(0, PRIME_MATRIX);
      uv.fill(0, 0, 4);
      n = 1;
    }
    const list = shadow ? g.casting : g.shown;
    for (let i = 0; i < list.length && n < g.capacity; i++) {
      const s = list[i];
      const o = shadow ? s.shadowProxy : s.mesh;
      const geo = o.geometry;
      if (!geo.boundingSphere) geo.computeBoundingSphere();
      _sphere.copy(geo.boundingSphere).applyMatrix4(o.matrixWorld);
      if (!frustum.intersectsSphere(_sphere)) continue;
      mesh.setMatrixAt(n, o.matrixWorld);
      const t = s.texture;
      const k = n * 4;
      uv[k] = t.offset.x; uv[k + 1] = t.offset.y; uv[k + 2] = t.repeat.x; uv[k + 3] = t.repeat.y;
      n++;
    }
    mesh.count = n;
    if (!n) return false;
    mesh.instanceMatrix.needsUpdate = true;
    attr.needsUpdate = true;
    if (!shadow) this.primed = true;
    return true;
  }

  /**
   * Is one of the blobs the blob batch draws (or its priming instance) in `frustum`? It draws them
   * all in one call when one is.
   * @param {THREE.Frustum} frustum
   */
  _blobsInView(frustum) {
    if (this._primeBlob) return true;
    const list = this._blobs.sprites;
    for (let i = 0; i < list.length; i++) {
      const b = list[i].blob;
      if (!b || !(b.material.opacity > 0.001) || !shownInScene(b)) continue;
      const geo = b.geometry;
      if (!geo.boundingSphere) geo.computeBoundingSphere();
      _sphere.copy(geo.boundingSphere).applyMatrix4(b.matrixWorld);
      if (frustum.intersectsSphere(_sphere)) return true;
    }
    return false;
  }

  dispose() {
    if (this._disposed) return;
    for (const s of [...this._of.keys()]) this.remove(s);
    for (const g of this._groups.values()) {
      g.fill?.dispose();
      for (const mesh of [g.color, g.shadow]) {
        if (!mesh) continue;
        mesh.removeFromParent();
        mesh.geometry.dispose();
        mesh.dispose?.();
      }
      g.material.dispose();
      g.depthMaterial?.dispose();
    }
    this._groups.clear();
    this._blobs.dispose();
    this.root.removeFromParent();
    this._disposed = true;
  }

  // -------------------------------------------------------------------------------------------

  /**
   * A group's materials and meshes for the sprites of one sheet and look (from its first sprite).
   * @param {string} key @param {Sprite3D} s
   * @returns {SpriteGroup}
   */
  _createGroup(key, s) {
    const src = s.material;
    const su = s._uniforms;
    // the sprite's lit-material uniform values (the same options give the same values)
    const u = {
      uNormalUp: { value: su.uNormalUp.value },
      uWrap: { value: su.uWrap.value },
      uRoundness: { value: su.uRoundness.value },
      uShadowSkip: { value: su.uShadowSkip.value },
      uShadowSkipBias: { value: su.uShadowSkipBias.value },
    };
    const material = new THREE.MeshLambertMaterial({ map: s.sheet.texture, alphaTest: src.alphaTest, side: src.side });
    material.color.copy(src.color);
    material.emissive.copy(src.emissive);
    material.emissiveIntensity = src.emissiveIntensity;
    material.name = 'Editor:spriteBatch';
    material.onBeforeCompile = (shader) => {
      patchSpriteLighting(shader, u, { shadowCenter: INSTANCE_CENTER });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${UV_RECT_PARS}`)
        .replace('#include <uv_vertex>', `#include <uv_vertex>\n${UV_RECT}`);
      // (as Sprite3D: the emissive glows with the sprite's own colours)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= diffuseColor.rgb;');
    };
    material.customProgramCacheKey = () => 'luminati-editor-sprite-batch-v1';
    const fill = this.lighting && this.fill ? this.lighting.registerEmissive(material, this.fill) : null;
    // the sun-facing proxies: alpha-tested depth with the instance's frame (the shadow pass copies
    // the side, alpha test and map of the mesh's material onto it)
    const casts = s.castShadow && s.shadowMode === 'sunFacing';
    let depthMaterial = null;
    if (casts) {
      depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: s.sheet.texture, alphaTest: src.alphaTest, side: THREE.DoubleSide });
      depthMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>\n${UV_RECT_PARS}`)
          .replace('#include <uv_vertex>', `#include <uv_vertex>\n${UV_RECT}`);
      };
      depthMaterial.customProgramCacheKey = () => 'luminati-editor-sprite-batch-depth-v1';
    }
    /** @type {SpriteGroup} */
    const g = {
      key, material, depthMaterial, fill, casts, quad: s.mesh.geometry, renderOrder: s.mesh.renderOrder,
      sprites: [], capacity: 0, color: null, shadow: null, uv: null, shadowUv: null, ready: false,
      // this frame's shown sprites, those casting a shadow, and whether it draws its priming instance
      shown: [], casting: [], prime: false,
    };
    this._build(g, FIRST_CAPACITY);
    this._warm(g, s);
    return g;
  }

  /**
   * (Re)build a group's instanced meshes with room for `capacity` sprites (the materials stay: no
   * new program).
   * @param {SpriteGroup} g @param {number} capacity
   */
  _build(g, capacity) {
    const old = [g.color, g.shadow].filter(Boolean);
    const make = () => {
      const geo = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(g.quad.attributes)) geo.setAttribute(name, attr.clone());
      if (g.quad.index) geo.setIndex(g.quad.index.clone());
      const uv = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
      uv.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aUvRect', uv);
      return { geo, uv };
    };
    const c = make();
    const color = new THREE.InstancedMesh(c.geo, g.material, capacity);
    color.name = 'Editor:spriteBatch.color';
    color.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    color.count = 0;
    color.visible = false;
    color.renderOrder = g.renderOrder;
    color.castShadow = false;
    color.receiveShadow = true;
    // (instances are spread over the level: culled one by one, never as one sphere)
    color.frustumCulled = true;
    // (three types the argument Frustum | FrustumArray; the editor has no ArrayCamera)
    color.intersectsFrustum = (/** @type {THREE.Frustum} */ frustum) => this._fill(g, false, frustum);
    color.matrixAutoUpdate = false;
    g.color = color;
    g.uv = c.uv;
    this.root.add(color);
    if (g.casts) {
      const sh = make();
      // the colour material (never drawn: the proxies render in the shadow passes only), so a
      // warm-up of the scene compiles no extra program for them
      const shadow = new THREE.InstancedMesh(sh.geo, g.material, capacity);
      shadow.name = 'Editor:spriteBatch.shadow';
      shadow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      shadow.count = 0;
      shadow.visible = false;
      shadow.castShadow = true;
      shadow.receiveShadow = false;
      shadow.customDepthMaterial = g.depthMaterial;
      shadow.frustumCulled = true;
      const lights = this.lights;
      shadow.intersectsFrustum = (/** @type {THREE.Frustum} */ frustum) => isShadowFrustum(lights, frustum) && this._fill(g, true, frustum);
      shadow.matrixAutoUpdate = false;
      g.shadow = shadow;
      g.shadowUv = sh.uv;
      this.root.add(shadow);
    }
    g.capacity = capacity;
    for (const mesh of old) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      mesh.dispose?.();
    }
  }

  /**
   * Compile a new group's programs (and, with the first sprite that has a blob, the blob batch's)
   * in the background, then let the batch draw its sprites.
   * @param {SpriteGroup} g @param {Sprite3D} s its first sprite
   */
  _warm(g, s) {
    const color = [g.color];
    const shadow = g.shadow ? [g.shadow] : [];
    let blobMesh = null;
    if (!this._blobsWarm && s.blob) {
      // (BlobBatch makes its mesh on the first adopt: adopt and release the blob; the mesh joins
      // the scene once its program is compiled)
      this._blobs.adopt(s);
      this._blobs.release(s);
      blobMesh = this._blobs.mesh;
      if (blobMesh) color.push(blobMesh);
    }
    let p = null;
    if (this._compile) {
      try {
        p = Promise.resolve(this._compile(color, shadow)).catch(() => {});
      } catch (err) {
        console.warn('[SpriteBatch] warm-up failed:', err);
      }
    }
    if (blobMesh) {
      const add = () => {
        if (this._disposed) return;
        this._blobsReady = true;
        blobMesh.visible = this.enabled;
        // (drawn when one of its blobs is in view)
        blobMesh.frustumCulled = true;
        blobMesh.intersectsFrustum = (/** @type {THREE.Frustum} */ frustum) => this._blobsInView(frustum);
        this.root.add(blobMesh);
      };
      if (p) this._blobsWarm = p.then(add);
      else { add(); this._blobsWarm = Promise.resolve(); }
    }
    const done = () => {
      if (this._disposed) return;
      g.ready = true;
      if (this.enabled) for (const x of g.sprites) this._adopt(x, g);
    };
    if (!p && (!this._blobsWarm || this._blobsReady)) { done(); return; }
    Promise.all([p, this._blobsWarm]).then(done);
  }

  /**
   * Let the batch draw a sprite: its own quad, proxy and blob leave render layer 0.
   * @param {Sprite3D} s @param {SpriteGroup} g
   */
  _adopt(s, g) {
    if (fading(s)) return;
    s.mesh.layers.disable(0);
    if (g.shadow) s.shadowProxy.layers.disable(0);
    const bb = this._blobs;
    if (this._blobsReady && s.blob && bb.sprites.length < bb.capacity) bb.adopt(s);
    this._adopted.add(s);
  }

  /** The sprite draws itself again. @param {Sprite3D} s */
  _release(s) {
    s.mesh.layers.enable(0);
    s.shadowProxy.layers.enable(0);
    this._blobs.release(s);
    this._adopted.delete(s);
  }
}

/** Sprites of one group share the sheet, the lit-material look and the shadow flags. */
function groupKey(s) {
  const o = s._opts;
  const m = s.material;
  return [
    sheetId(s.sheet), o.normalUp, o.wrap, o.roundness, m.alphaTest, m.side, m.color.getHexString(), m.emissive.getHexString(),
    s.castShadow && s.shadowMode === 'sunFacing' ? 1 : 0, s.mesh.renderOrder, s.receiveShadow ? 1 : 0,
  ].join('|');
}

/** Does the sprite dither (`opacity` or `bodyOpacity` below 1)? The batch draws opaque sprites only. */
function fading(s) {
  return s.opacity < 0.999 || (s.bodyOpacity ?? 1) < 0.999;
}

/** Is the object in a scene with itself and every ancestor visible? */
function shownInScene(o) {
  for (let x = o; x; x = x.parent) {
    if (!x.visible) return false;
    if (x.isScene) return true;
  }
  return false;
}
