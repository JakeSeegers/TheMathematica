import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/** @import { SceneNode } from '../../engine/render/types.js' */

/**
 * A FullScreenQuad drawing a ShaderMaterial; `_mesh` is three's internal quad mesh (r186), which
 * Viewport3D._warmOverlays compiles ahead of the first draw.
 * @typedef {FullScreenQuad & { material: THREE.ShaderMaterial, _mesh: THREE.Mesh }} ShaderQuad
 */

/** Render layers used for the selection / highlight masks (0 is the default layer). */
export const OUTLINE_LAYERS = Object.freeze({ select: 29, highlight: 30 });

const COMPOSITE = {
  uniforms: {
    tSel: { value: null },
    tHi: { value: null },
    uTexel: { value: new THREE.Vector2(1, 1) },
    uWidth: { value: 2 },
    uSelColor: { value: new THREE.Color('#ffc94d') },
    uHiColor: { value: new THREE.Color('#ffffff') },
    uHiAlpha: { value: 0.8 },
    uUseSel: { value: 0 },
    uUseHi: { value: 0 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tSel;
    uniform sampler2D tHi;
    uniform vec2 uTexel;
    uniform float uWidth;
    uniform vec3 uSelColor;
    uniform vec3 uHiColor;
    uniform float uHiAlpha;
    uniform float uUseSel;
    uniform float uUseHi;
    uniform float uTime;
    varying vec2 vUv;
    // coverage of a mask around the pixel: x = own, y = max within the outline width, z = soft halo
    vec3 ring( sampler2D t ) {
      float own = step( 0.02, texture2D( t, vUv ).a );
      float near = 0.0;
      float halo = 0.0;
      for ( int k = 0; k < 12; k++ ) {
        float a = float( k ) * 0.5235988;
        vec2 d = vec2( cos( a ), sin( a ) );
        near = max( near, step( 0.02, texture2D( t, vUv + d * uTexel * uWidth ).a ) );
        near = max( near, step( 0.02, texture2D( t, vUv + d * uTexel * uWidth * 0.5 ).a ) );
        halo += step( 0.02, texture2D( t, vUv + d * uTexel * uWidth * 2.6 ).a );
      }
      return vec3( own, near, halo / 12.0 );
    }
    void main() {
      vec4 outc = vec4( 0.0 );
      if ( uUseHi > 0.5 ) {
        vec3 r = ring( tHi );
        float edge = r.y * ( 1.0 - r.x );
        float a = max( edge * uHiAlpha, r.x * 0.07 * uHiAlpha );
        outc = vec4( uHiColor, a );
      }
      if ( uUseSel > 0.5 ) {
        vec3 r = ring( tSel );
        float edge = r.y * ( 1.0 - r.x );
        float halo = r.z * ( 1.0 - r.x ) * ( 1.0 - edge ) * 0.35;
        float fill = r.x * ( 0.07 + 0.03 * sin( uTime * 3.0 ) );
        float a = max( max( edge, halo ), fill );
        if ( a > 0.0 ) outc = vec4( mix( outc.rgb, uSelColor, a / max( a, outc.a + 1e-4 ) ), max( a, outc.a ) );
      }
      if ( outc.a < 0.003 ) discard;
      gl_FragColor = outc;
      #include <colorspace_fragment>
    }`,
};

/**
 * SelectionOutline — crisp silhouette outlines around selected (gold, with a soft halo and a faint
 * pulsing fill) and highlighted (tool-coloured) objects, visible through occluders.
 *
 * The chosen meshes are put on an extra render layer and re-rendered with their own materials
 * into a small mask target (so shader-billboarded canopies, alpha-tested leaves, flames and pixel
 * sprites all produce their exact silhouettes); a full-screen pass then draws the mask edges on
 * top of the final image. Every light also joins the layers so the mask pass uses the very same
 * shader programs (no recompiles), and the shadow map is not re-rendered for it.
 */
export class SelectionOutline {
  /** @param {THREE.WebGLRenderer} renderer */
  constructor(renderer) {
    this.renderer = renderer;
    this._targets = {
      select: new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true }),
      highlight: new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true }),
    };
    for (const t of Object.values(this._targets)) t.texture.name = 'Editor.outlineMask';
    this._meshes = { select: [], highlight: [] };
    this._camera = new THREE.PerspectiveCamera();
    this._quad = /** @type {ShaderQuad} */ (new FullScreenQuad(new THREE.ShaderMaterial({
      ...COMPOSITE,
      uniforms: THREE.UniformsUtils.clone(COMPOSITE.uniforms),
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    })));
    this._size = new THREE.Vector2();
    this._clear = new THREE.Color();
    this._lightsTagged = new WeakSet();
    this.width = 2;
    /**
     * Materials whose render-target programs are known to be compiled. Meshes with other
     * materials are left out of the masks until the viewport compiled them in the background
     * (`takeCold()` → compileAsync with `warmTarget` bound → `markWarm()`), so selecting
     * something never compiles shaders synchronously in a frame.
     */
    this._warm = new WeakSet();
    this._cold = new Set();
  }

  /** A render target of the mask kind (bind it around renderer.compile / compileAsync). */
  get warmTarget() {
    return this._targets.select;
  }

  /**
   * Allocate the mask targets at the drawing-buffer size now (at start-up) rather than on the
   * first selection, which would otherwise pay for it in a frame.
   */
  prepare() {
    const r = this.renderer;
    r.getDrawingBufferSize(this._size);
    const w = Math.max(1, this._size.x);
    const h = Math.max(1, this._size.y);
    const prev = r.getRenderTarget();
    const alpha = r.getClearAlpha();
    r.getClearColor(this._clear);
    r.setClearColor(0x000000, 0);
    for (const t of Object.values(this._targets)) {
      if (t.width !== w || t.height !== h) t.setSize(w, h);
      r.setRenderTarget(t);
      r.clear(true, true, false);
    }
    r.setClearColor(this._clear, alpha);
    r.setRenderTarget(prev);
  }

  /** Mark the materials of every mesh under `root` (or of the given meshes) as compiled. */
  markWarm(root) {
    const add = (o) => {
      if (!o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) this._warm.add(m);
    };
    if (Array.isArray(root)) root.forEach(add);
    else root?.traverse?.(add);
  }

  /** Meshes left out of the masks because their programs may not be compiled yet (clears). */
  takeCold() {
    const list = [...this._cold];
    this._cold.clear();
    return list;
  }

  /**
   * Selection / highlight colours, and the highlight's 0..1 alpha (omitted: unchanged).
   * @param {{ select?: THREE.Color, highlight?: THREE.Color, highlightAlpha?: number }} [colors]
   */
  setColors({ select, highlight, highlightAlpha } = {}) {
    const u = this._quad.material.uniforms;
    if (select) u.uSelColor.value.copy(select);
    if (highlight) u.uHiColor.value.copy(highlight);
    if (highlightAlpha != null) u.uHiAlpha.value = highlightAlpha;
  }

  /**
   * Replace the meshes of one mask.
   * @param {'select'|'highlight'} kind
   * @param {THREE.Object3D[]} roots objects whose (opaque / alpha-tested) meshes are outlined
   */
  set(kind, roots) {
    const layer = OUTLINE_LAYERS[kind];
    for (const m of this._meshes[kind]) m.layers.disable(layer);
    const list = [];
    for (const r of roots) {
      r?.traverse?.((/** @type {SceneNode} */ o) => {
        if (!(o.isMesh || o.isSkinnedMesh) || !o.visible) return;
        const mat = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!mat || mat.colorWrite === false) return;
        if (mat.transparent && !(mat.alphaTest > 0) && !mat.isShaderMaterial) return;
        if (mat.blending === THREE.AdditiveBlending) return;
        if (!this._warm.has(mat)) { this._cold.add(o); return; }
        o.layers.enable(layer);
        list.push(o);
      });
    }
    this._meshes[kind] = list;
  }

  /** Is anything outlined? */
  get active() {
    return this._meshes.select.length > 0 || this._meshes.highlight.length > 0;
  }

  /**
   * Render the masks and composite the outlines onto the current render target (the canvas).
   * @param {THREE.Scene} scene @param {THREE.PerspectiveCamera} camera
   * @param {THREE.Light[]} lights every light of the scene (joins the mask layers)
   * @param {number} time seconds (fill pulse)
   */
  render(scene, camera, lights, time = 0) {
    if (!this.active) return;
    const r = this.renderer;
    r.getDrawingBufferSize(this._size);
    const w = Math.max(1, this._size.x);
    const h = Math.max(1, this._size.y);
    for (const l of lights) {
      if (this._lightsTagged.has(l)) continue;
      l.layers.enable(OUTLINE_LAYERS.select);
      l.layers.enable(OUTLINE_LAYERS.highlight);
      this._lightsTagged.add(l);
    }
    const prevTarget = r.getRenderTarget();
    const prevAuto = r.shadowMap.autoUpdate;
    const prevAlpha = r.getClearAlpha();
    r.getClearColor(this._clear);
    const prevBg = scene.background;
    r.shadowMap.autoUpdate = false;
    r.setClearColor(0x000000, 0);
    scene.background = null;
    const cam = this._camera;
    cam.copy(camera, false);
    cam.matrixWorld.copy(camera.matrixWorld);
    cam.matrixWorldInverse.copy(camera.matrixWorldInverse);
    cam.projectionMatrix.copy(camera.projectionMatrix);
    cam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    cam.matrixAutoUpdate = false;
    const u = this._quad.material.uniforms;
    for (const kind of ['select', 'highlight']) {
      const on = this._meshes[kind].length > 0;
      u[kind === 'select' ? 'uUseSel' : 'uUseHi'].value = on ? 1 : 0;
      if (!on) continue;
      const t = this._targets[kind];
      if (t.width !== w || t.height !== h) t.setSize(w, h);
      cam.layers.set(OUTLINE_LAYERS[kind]);
      r.setRenderTarget(t);
      r.clear(true, true, false);
      r.render(scene, cam);
    }
    scene.background = prevBg;
    r.setClearColor(this._clear, prevAlpha);
    r.shadowMap.autoUpdate = prevAuto;
    r.setRenderTarget(prevTarget);
    u.tSel.value = this._targets.select.texture;
    u.tHi.value = this._targets.highlight.texture;
    u.uTexel.value.set(1 / w, 1 / h);
    u.uWidth.value = this.width * Math.max(1, r.getPixelRatio());
    u.uTime.value = time;
    this._quad.render(r);
  }

  dispose() {
    for (const kind of ['select', 'highlight']) {
      for (const m of this._meshes[kind]) m.layers.disable(OUTLINE_LAYERS[kind]);
      this._targets[kind].dispose();
    }
    this._quad.material.dispose();
    this._quad.dispose();
  }
}
