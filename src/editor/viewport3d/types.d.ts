// Type-check only (tsconfig.json, `npm run typecheck`); nothing here reaches a bundle.
// Module augmentation for src/editor/viewport3d: fields created lazily (`this._x ??= …`) or by
// another module, which the class body cannot declare without a runtime change.
// Also: MaterialProperties, three.js's internal material record that Viewport3D._isCompiled reads.
import type * as THREE from 'three';
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import './Ghost.js';

/**
 * three.js's internal record of a material (`renderer.properties.get(material)`, typed `unknown`
 * by @types/three; r186): the members Viewport3D._isCompiled reads to tell whether the material
 * has a program yet.
 */
export interface MaterialProperties {
  /** Programs compiled for the material, by cache key (absent before the first compile). */
  programs?: Map<string, THREE.WebGLProgram>;
  /** The program the material last drew with. */
  currentProgram?: THREE.WebGLProgram;
}

declare module './Ghost.js' {
  interface GhostPreview {
    /** Box lines of the particle-area ghost (made with the first emitter ghost, recoloured). */
    _emitterMat?: LineMaterial;
    /** Home ring of the enemy-group ghost (made with the first enemy ghost; gold for elite). */
    _enemyRingMat?: LineMaterial;
    /** Roam ring of the critter-group ghost (made with the first critter ghost). */
    _ringMat?: LineMaterial;
  }
}
