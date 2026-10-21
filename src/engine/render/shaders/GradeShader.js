import * as THREE from 'three';
import { FULLSCREEN_VERTEX, POST_COMMON_GLSL } from './PostCommon.js';

/**
 * Display-space colour grade (runs after OutputPass, i.e. on tone-mapped sRGB values).
 *
 * Order: radial chromatic aberration + unsharp-mask sharpen (sampling) → exposure → white balance
 * (temperature / tint) → contrast around mid-grey → saturation → split toning (shadows /
 * highlights tint by luminance) → aspect-aware elliptical vignette → animated luminance-weighted
 * film grain → ordered dither (removes banding in the dark vignette gradient).
 */
export const GradeShader = {
  name: 'LuminatiGrade',
  uniforms: {
    tDiffuse: { value: null },
    uTexel: { value: new THREE.Vector2(1, 1) },
    uAspect: { value: 16 / 9 },
    uExposure: { value: 1.0 },
    uContrast: { value: 1.08 },
    uSaturation: { value: 1.12 },
    uTemperature: { value: 0.08 },
    uTint: { value: 0.0 },
    uShadowsTint: { value: new THREE.Vector3(0.02, 0.04, 0.08) },
    uHighlightsTint: { value: new THREE.Vector3(0.06, 0.03, -0.02) },
    uVignette: { value: 0.5 },
    uVignetteSoftness: { value: 0.55 },
    uVignetteRoundness: { value: 0.65 },
    uVignetteColor: { value: new THREE.Vector3(0.05, 0.025, 0.04) },
    uGrain: { value: 0.035 },
    uGrainSize: { value: 1.0 },
    uGrainSeed: { value: 0.0 },
    uCA: { value: 0.0015 },
    uSharpen: { value: 0.15 },
    uDither: { value: 1.0 },
  },
  vertexShader: FULLSCREEN_VERTEX,
  fragmentShader: /* glsl */ `
    ${POST_COMMON_GLSL}
    uniform sampler2D tDiffuse;
    uniform vec2 uTexel;
    uniform float uAspect;
    uniform float uExposure;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uTemperature;
    uniform float uTint;
    uniform vec3 uShadowsTint;
    uniform vec3 uHighlightsTint;
    uniform float uVignette;
    uniform float uVignetteSoftness;
    uniform float uVignetteRoundness;
    uniform vec3 uVignetteColor;
    uniform float uGrain;
    uniform float uGrainSize;
    uniform float uGrainSeed;
    uniform float uCA;
    uniform float uSharpen;
    uniform float uDither;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      // position relative to centre, x scaled toward the true aspect by 'roundness'
      vec2 d = uv - 0.5;
      vec2 dv = d * vec2(mix(1.0, uAspect, uVignetteRoundness), 1.0);
      float cornerLen = length(vec2(0.5 * mix(1.0, uAspect, uVignetteRoundness), 0.5));
      float r = length(dv) / cornerLen;            // 0 centre … 1 corners

      // --- sampling: sharpen + chromatic aberration
      vec3 c = texture2D(tDiffuse, uv).rgb;
      vec3 nb = texture2D(tDiffuse, uv + vec2(uTexel.x, 0.0)).rgb
              + texture2D(tDiffuse, uv - vec2(uTexel.x, 0.0)).rgb
              + texture2D(tDiffuse, uv + vec2(0.0, uTexel.y)).rgb
              + texture2D(tDiffuse, uv - vec2(0.0, uTexel.y)).rgb;
      vec3 detail = clamp((c - nb * 0.25) * uSharpen, vec3(-0.08), vec3(0.08));
      vec3 col = c;
      if (uCA > 0.0) {
        vec2 off = d * (uCA * 2.0 * r * r);       // radial, grows toward the edges
        col.r = texture2D(tDiffuse, uv - off).r;
        col.b = texture2D(tDiffuse, uv + off).b;
      }
      col += detail;
      col = max(col, vec3(0.0));

      // --- exposure (post tone-map multiply)
      col *= uExposure;

      // --- white balance: warm/cool along blue↔amber, tint along green↔magenta, luma preserving
      vec3 wb = vec3(1.0 + 0.30 * uTemperature + 0.10 * uTint,
                     1.0 + 0.02 * uTemperature - 0.25 * uTint,
                     1.0 - 0.34 * uTemperature + 0.10 * uTint);
      wb /= pfxLuma(wb);
      col *= wb;

      // --- contrast around display mid-grey
      col = (col - 0.5) * uContrast + 0.5;
      col = max(col, vec3(0.0));

      // --- saturation
      float l = pfxLuma(col);
      col = max(mix(vec3(l), col, uSaturation), vec3(0.0));

      // --- split toning
      l = clamp(pfxLuma(col), 0.0, 1.0);
      float ws = (1.0 - l) * (1.0 - l);
      float wh = l * l;
      col += uShadowsTint * ws + uHighlightsTint * wh;

      // --- vignette (smooth, elliptical; darkens toward a deep warm brown instead of grey)
      float inner = mix(0.95, 0.05, clamp(uVignetteSoftness, 0.0, 1.0));
      float v = smoothstep(inner, 1.25, r);
      v = v * v * (3.0 - 2.0 * v);
      col = mix(col, uVignetteColor * col, clamp(uVignette * v * 1.35, 0.0, 1.0));

      // --- film grain: animated, strongest in the mid-tones
      vec2 gp = floor(gl_FragCoord.xy / uGrainSize);
      float g = pfxHash12(gp + uGrainSeed * vec2(113.7, 71.3)) + pfxHash12(gp * 1.37 + uGrainSeed * vec2(37.1, 91.9)) - 1.0;
      float lg = clamp(pfxLuma(col), 0.0, 1.0);
      float gw = 0.35 + 2.6 * lg * (1.0 - lg);
      col += g * uGrain * gw;

      // --- ordered dither (±0.5 LSB of 8-bit) against banding
      col += (pfxBayer8(gl_FragCoord.xy) - 0.5) * (uDither / 255.0);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};
