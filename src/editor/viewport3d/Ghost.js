import * as THREE from 'three';
import { OBJECT_TYPES } from '../../engine/level/ObjectCatalog.js';
import { Sprite3D } from '../../engine/sprite/Sprite3D.js';
import { COLORS, EMITTER_COLORS, fatSegments, pointsObject, boxEdges, disposeGeometry } from './Gizmos.js';
import { drapedCircle, pathToSegments } from './Drape.js';
import { ENEMY_COLORS, enemyKind, enemyHover } from './ActorPreview.js';
import { addGroundSnowCover } from '../../game/SnowCover.js';
import { ownValue } from '../../engine/utils/own.js';

/**
 * @import { SpriteSheet } from '../../engine/sprite/Sprite3D.js'
 * @import { LevelObjectBuilder } from '../../engine/level/ObjectBuilder.js'
 * @import { LevelSurface } from './Picking.js'
 * @import { GizmoKit } from './Gizmos.js'
 * @import { LevelObject } from '../../engine/level/types.js'
 * @import { TileMap } from '../../engine/world/TileMap.js'
 */

const GHOST_TINT = new THREE.Color(0.82, 0.95, 1.12);
const GHOST_EMISSIVE = new THREE.Color('#1c3f5e');
const _m = new THREE.Matrix4();
/** World direction of the spawn's `facing` (read-only: the ghost keeps the array). */
const SPAWN_FACING = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

/**
 * GhostPreview — the translucent preview of the object a tool is about to place.
 *
 * Prop ghosts are real builds (LevelObjectBuilder) with ghost-tinted, translucent material
 * clones. A point object is built once per (type, options) signature and then only moved /
 * rotated through a pivot as the cursor moves — and rebuilt where it stands once the pointer
 * rests (props vary with their position and seed: the ghost then shows exactly what a click
 * places); line objects (fences, bridges) rebuild as their endpoints change (both are cheap). Actors / markers get lightweight stand-ins (a translucent
 * character, creature or enemy sprite with its home ring, a particle-area box, a glowing bulb).
 */
export class GhostPreview {
  /**
   * @param {{ scene: THREE.Object3D, overlay: THREE.Object3D, builder: LevelObjectBuilder,
   *           surface: LevelSurface, kit: GizmoKit,
   *           characterSheet: (preset:string, spec?:object) => SpriteSheet,
   *           creatureSheet: (kind:string) => SpriteSheet,
   *           enemySheet?: ((kind:string) => SpriteSheet
   *             & { spriteOptions?: ConstructorParameters<typeof Sprite3D>[1] })|null,
   *           compile?: (obj: THREE.Object3D) => Promise<void>, isCompiled?: (m: THREE.Material) => boolean,
   *           compileShadow?: (obj: THREE.Object3D) => Promise<void>|null,
   *           compileMask?: (obj: THREE.Object3D) => Promise<void>|null }} ctx
   *   compile / isCompiled: background shader compilation (renderer.compileAsync) — a ghost whose
   *   programs are not compiled yet stays hidden until they are, so the first preview of an
   *   object type never freezes the page
   */
  constructor({ scene, overlay, builder, surface, kit, characterSheet, creatureSheet, enemySheet = null, compile = null, isCompiled = null, compileShadow = null, compileMask = null }) {
    this.builder = builder;
    this.compile = compile;
    this.isCompiled = isCompiled;
    /** (obj) => Promise|null: the shadow-pass programs the placed object will need (background) */
    this.compileShadow = compileShadow;
    /** (obj) => Promise|null: its selection-outline mask programs (background, not awaited) */
    this.compileMask = compileMask;
    this.surface = surface;
    this.kit = kit;
    this.characterSheet = characterSheet;
    this.creatureSheet = creatureSheet;
    /** (kind) => EnemySheet (the 3D view's cached sheets; COMBAT.md §17). */
    this.enemySheet = enemySheet;
    this.pivot = new THREE.Group();
    this.pivot.name = 'Editor:ghost';
    scene.add(this.pivot);
    this.overlay = new THREE.Group();
    this.overlay.name = 'Editor:ghostOverlay';
    overlay.add(this.overlay);
    this._materials = new Map(); // source material → ghost clone
    this._sig = null;
    this._built = null;
    this._sprite = null;
    this._base = null; // { x, y, z, rotation } the current build was made at
    this._dotMat = kit.glowMaterial({ color: '#ffe08a', size: 0.8, opacity: 1 });
    this.visible = false;
    this._time = 0;
  }

  /**
   * Show (or hide with null) a ghost level object.
   * @param {LevelObject|null} obj level object (id '')
   * @param {TileMap|null} tileMap
   */
  set(obj, tileMap) {
    const def = obj && OBJECT_TYPES[obj.type];
    if (!def || !tileMap) {
      this._clear();
      this.visible = false;
      return;
    }
    this.visible = true;
    this._tileMap = tileMap;
    const point = def.placement === 'point';
    const sig = ghostSignature(obj, point && def.kind === 'prop');
    if (sig !== this._sig) {
      this._clear();
      this._sig = sig;
      this._build(obj, def, tileMap);
    }
    if (point) this._move(obj, def);
  }

  _build(obj, def, tileMap) {
    const S = this.surface;
    const o = JSON.parse(JSON.stringify(obj));
    o.id = o.id || '__ghost__';
    if (def.kind === 'prop' && o.type !== 'light') {
      let built = null;
      try {
        built = this.builder.build(o, tileMap);
      } catch (err) {
        console.error('[Viewport3D] ghost build failed:', err);
      }
      if (!built) return;
      this._built = built;
      const root = built.object;
      // the roofs' snow patch before anything compiles (the placed prop gets it too: ObjectPreview)
      addGroundSnowCover(root, { roofsOnly: true });
      // programs: the placed object's own (opaque) materials and the ghost's translucent clones
      // are compiled in the background; the ghost shows once they are ready
      const pending = [];
      const cold = (mats) => !!(this.compile && this.isCompiled) && mats.some((m) => m && !this.isCompiled(m));
      const mats = () => {
        const out = new Set();
        root.traverse((m) => { if (m.isMesh) for (const x of [].concat(m.material)) out.add(x); });
        return [...out];
      };
      if (cold(mats())) pending.push(this.compile(root));
      // (and its shadow-pass programs: three.js would compile them in the placement frame)
      const shadow = this.compileShadow?.(root);
      if (shadow) pending.push(shadow);
      // (a click selects the placed object: its outline-mask variants compile meanwhile, so the
      // first selection draw finds them ready — the ghost does not wait for them)
      this.compileMask?.(root);
      root.traverse((m) => {
        if (!m.isMesh) return;
        m.castShadow = false;
        m.material = Array.isArray(m.material) ? m.material.map((x) => this._ghostMaterial(x)) : this._ghostMaterial(m.material);
      });
      if (cold(mats())) pending.push(this.compile(root));
      // (a rebuild while an earlier compile is still running waits for it too: its programs exist
      // but are not linked yet, and the first draw would block on them)
      if (this._compiling) pending.push(this._compiling);
      if (pending.length) {
        root.visible = false;
        const all = Promise.all(pending);
        this._compiling = all;
        all.then(() => {
          if (this._compiling === all) this._compiling = null;
          if (this._built === built) root.visible = true;
        });
      }
      const bx = def.placement === 'point' ? o.x : 0;
      const bz = def.placement === 'point' ? o.z : 0;
      const by = def.placement === 'point' ? S.groundAt(o.x, o.z) : 0;
      this._base = { x: bx, y: by, z: bz, rotation: o.rotation ?? 0 };
      this.pivot.position.set(bx, by, bz);
      this.pivot.rotation.set(0, 0, 0);
      this.pivot.add(root);
      root.position.sub(this.pivot.position);
      return;
    }
    this._base = { x: o.x ?? 0, y: 0, z: o.z ?? 0, rotation: 0 };
    this.pivot.position.set(0, 0, 0);
    this.pivot.rotation.set(0, 0, 0);
    switch (o.type) {
      case 'npc':
      case 'critters': {
        const sheet = o.type === 'npc' ? this.characterSheet(o.preset, o.spec) : this.creatureSheet(o.kind);
        const s = new Sprite3D(sheet, { castShadow: false, blobShadow: true, normalUp: 0.6, wrap: 0.6, emissive: '#bfe8ff', emissiveIntensity: 0.25 });
        s.opacity = 0.6;
        s.play('idle');
        this._sprite = s;
        this.pivot.add(s);
        break;
      }
      case 'enemy': {
        if (!this.enemySheet) break;
        const kind = enemyKind(o);
        const sheet = this.enemySheet(kind);
        const s = new Sprite3D(sheet, {
          castShadow: false, blobShadow: true, normalUp: 0.6, wrap: 0.6, emissive: '#bfe8ff', emissiveIntensity: 0.25,
          ...(sheet.spriteOptions?.blobSize ? { blobSize: sheet.spriteOptions.blobSize } : {}),
        });
        s.opacity = 0.6;
        s.play('idle');
        const hover = enemyHover(kind);
        if (hover) s.mesh.position.y = hover;
        this._sprite = s;
        this.pivot.add(s);
        break;
      }
      case 'emitter': {
        const size = o.size ?? [8, 2.4, 8];
        const box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0, (o.dy ?? 1.2), 0), new THREE.Vector3(size[0], size[1], size[2]));
        const color = ownValue(EMITTER_COLORS, o.preset) ?? COLORS.ghost;
        this._emitterMat ??= this.kit.lineMaterial({ color, width: 1.5, opacity: 0.85 });
        this._emitterMat.color.set(color);
        const l = fatSegments(boxEdges(box, _m.identity()), this._emitterMat);
        this.overlay.add(l);
        this._overlayObj = l;
        break;
      }
      case 'light': {
        const p = pointsObject([0, 0, 0], this._dotMat);
        this.overlay.add(p);
        this._overlayObj = p;
        break;
      }
      default:
    }
  }

  _move(obj, def) {
    const S = this.surface;
    const y = S.groundAt(obj.x, obj.z);
    if (this._built) {
      this.pivot.position.set(obj.x, y, obj.z);
      this.pivot.rotation.y = def.rotatable ? (obj.rotation ?? 0) - this._base.rotation : 0;
      // the prop's variation depends on where it stands: rebuild it there once the pointer rests
      const b = this._base;
      const off = b.x !== obj.x || b.z !== obj.z || (def.rotatable && (obj.rotation ?? 0) !== b.rotation);
      const prev = this._settle?.obj;
      if (!off) this._settle = null;
      else if (!prev || prev.x !== obj.x || prev.z !== obj.z || prev.rotation !== obj.rotation) this._settle = { obj: { ...obj }, def, at: performance.now() };
      return;
    }
    if (this._sprite) {
      this.pivot.position.set(obj.x, y, obj.z);
      const ringKey = `${obj.type},${obj.x},${obj.z},${obj.radius},${!!obj.elite}`;
      if ((obj.type === 'critters' || obj.type === 'enemy') && this._ringFor !== ringKey) {
        this._ringFor = ringKey;
        disposeGeometry(this._overlayObj);
        let mat;
        if (obj.type === 'enemy') {
          this._enemyRingMat ??= this.kit.lineMaterial({ color: ENEMY_COLORS.ring, width: 1.75, opacity: 0.8, dashed: true, dashSize: 0.45, gapSize: 0.22 });
          this._enemyRingMat.color.set(obj.elite ? ENEMY_COLORS.elite : ENEMY_COLORS.ring);
          mat = this._enemyRingMat;
        } else mat = this._ringMat ??= this.kit.lineMaterial({ color: COLORS.critters, width: 1.5, opacity: 0.7, dashed: true, dashSize: 0.3, gapSize: 0.25 });
        const R = obj.type === 'enemy' ? Number(obj.radius) || 3 : obj.radius ?? 2.5;
        this._overlayObj = fatSegments(pathToSegments(drapedCircle(S, obj.x, obj.z, R, { lift: 0.06 })), mat);
        this.overlay.add(this._overlayObj);
      }
      return;
    }
    if (this._overlayObj) {
      const dy = obj.type === 'light' ? (obj.dy ?? 1.5) : 0;
      this._overlayObj.position.set(obj.x, y + dy, obj.z);
    }
  }

  _ghostMaterial(src) {
    if (!src || src.isShaderMaterial || src.isRawShaderMaterial || src.isLineBasicMaterial || src.isPointsMaterial) return src;
    let g = this._materials.get(src);
    if (g) return g;
    // Material.clone() deep-copies userData through JSON (textures would be serialised): stash it
    const ud = src.userData;
    src.userData = {};
    try {
      g = src.clone();
    } finally {
      src.userData = ud;
    }
    g.userData = { ghost: true };
    if (src.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) g.onBeforeCompile = src.onBeforeCompile;
    if (src.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey) g.customProgramCacheKey = src.customProgramCacheKey;
    g.transparent = true;
    g.opacity = Math.min(g.opacity ?? 1, 0.62);
    g.depthWrite = true;
    if (g.color) g.color.multiply(GHOST_TINT);
    if (g.emissive && !g.emissiveMap) {
      g.emissive.copy(GHOST_EMISSIVE);
      g.emissiveIntensity = 1;
    }
    this._materials.set(src, g);
    return g;
  }

  /**
   * Ghost player start (ToolPreview `spawn` extension): a translucent traveler + ring.
   * @param {{ x: number, z: number, facing?: string }|null} sp
   */
  setSpawn(sp) {
    if (!sp) {
      if (this._spawn) this._spawn.group.visible = false;
      return;
    }
    if (!this._spawn) {
      const group = new THREE.Group();
      group.name = 'Editor:spawnGhost';
      const sprite = new Sprite3D(this.characterSheet('traveler'), { castShadow: false, normalUp: 0.6, wrap: 0.6, emissive: '#bfe8ff', emissiveIntensity: 0.3 });
      sprite.opacity = 0.55;
      sprite.play('idle');
      this.pivot.parent.add(sprite);
      this._spawnRingMat = this.kit.lineMaterial({ color: COLORS.spawn, width: 2, opacity: 0.85 });
      this.overlay.add(group);
      this._spawn = { group, sprite, key: '' };
    }
    const g = this._spawn;
    g.group.visible = true;
    g.sprite.visible = true;
    const y = this.surface.groundAt(sp.x, sp.z);
    g.sprite.position.set(sp.x, y, sp.z);
    const F = ownValue(SPAWN_FACING, sp.facing) ?? SPAWN_FACING.down;
    g.facing = F;
    const key = `${sp.x},${sp.z}`;
    if (key !== g.key) {
      g.key = key;
      for (const c of [...g.group.children]) disposeGeometry(c);
      g.group.add(fatSegments(pathToSegments(drapedCircle(this.surface, sp.x, sp.z, 0.56, { lift: 0.06, segments: 36 })), this._spawnRingMat));
    }
  }

  /** Per frame: animate the sprite stand-ins. */
  update(dt, camera) {
    this._time += dt;
    // builds dropped before the previous frame rendered its replacement
    const due = this._graveyardOld ?? [];
    this._graveyardOld = this._graveyard ?? [];
    this._graveyard = [];
    for (const fn of due) fn();
    const st = this._settle;
    if (st && this._built && this.visible && this._tileMap && performance.now() - st.at > 90) {
      this._settle = null;
      const sig = this._sig;
      this._clear();
      this._sig = sig;
      this._build(st.obj, st.def, this._tileMap);
      this._move(st.obj, st.def);
    }
    if (this._sprite && this.visible) this._sprite.update(dt, camera);
    const sp = this._spawn;
    if (sp && sp.group.visible) {
      sp.sprite.faceVector(sp.facing[0], sp.facing[1]);
      sp.sprite.update(dt, camera);
    } else if (sp) sp.sprite.visible = false;
  }

  _clear() {
    if (this._built) {
      const built = this._built;
      built.object.removeFromParent();
      // freed on the next update, after its replacement rendered (flame programs stay compiled)
      (this._graveyard ??= []).push(() => {
        try {
          built.dispose();
        } catch (err) {
          console.error('[Viewport3D] ghost dispose failed:', err);
        }
      });
      this._built = null;
    }
    if (this._sprite) {
      this._sprite.removeFromParent();
      this._sprite.dispose();
      this._sprite = null;
    }
    if (this._overlayObj) {
      disposeGeometry(this._overlayObj);
      this._overlayObj = null;
    }
    this._ringFor = null;
    this._sig = null;
    this._settle = null;
  }

  /** World AABB of the ghost (for framing / tests), or null. */
  get box() {
    if (!this._built) return null;
    return new THREE.Box3().setFromObject(this.pivot);
  }

  dispose() {
    this._clear();
    for (const fn of [...(this._graveyardOld ?? []), ...(this._graveyard ?? [])]) fn();
    this._graveyard = [];
    this._graveyardOld = [];
    if (this._spawn) {
      this._spawn.sprite.removeFromParent();
      this._spawn.sprite.dispose();
      for (const c of [...this._spawn.group.children]) disposeGeometry(c);
      this._spawn.group.removeFromParent();
      this._spawn = null;
    }
    for (const m of this._materials.values()) m.dispose();
    this._materials.clear();
    this.pivot.removeFromParent();
    this.overlay.removeFromParent();
  }
}

/**
 * Rebuild key of a ghost: everything but the position (and rotation for rotatable props, which
 * the pivot handles) for point props; the full object otherwise.
 */
function ghostSignature(obj, movable) {
  if (!movable) {
    const c = { ...obj };
    if (OBJECT_TYPES[obj.type]?.placement === 'point') { delete c.x; delete c.z; }
    return JSON.stringify(c);
  }
  const c = { ...obj };
  delete c.x;
  delete c.z;
  if (OBJECT_TYPES[obj.type]?.rotatable) delete c.rotation;
  return JSON.stringify(c);
}
