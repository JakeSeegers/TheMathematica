import * as THREE from 'three';
import { Sprite3D, createCharacterSheet, CHARACTER_PRESETS, RNG, damp, hashString } from '../engine/index.js';
import { NPC_BEHAVIOURS } from '../engine/level/ObjectCatalog.js';
import { CHARACTER_SPRITE_OPTS, IDLE_SPEED } from './config.js';

/**
 * @import { TileMap } from '../engine/world/TileMap.js'
 * @import { Rect } from '../engine/level/types.js'
 */

const RADIUS = 0.3;

/**
 * A villager definition in world coordinates (Game.js `npcDef` builds it from a level `npc`
 * object, resolving its object-relative `talkOffset` / `area`).
 * @typedef {object} NpcDef
 * @property {string} id
 * @property {string} name            its identity (scripts match villagers by it): the level's name, or
 *   'Villager' for none
 * @property {boolean} [unnamed]      the level gave it no name: shown as the UI's default
 *   (`t('game.default.villager')`; Game.js `villagerName`), not as the term 'Villager'
 * @property {string} preset          a CHARACTER_PRESETS name
 * @property {object} [spec]          createCharacterSheet spec overrides merged over the preset
 * @property {[number, number]} home  [x, z]
 * @property {number} [wander]        wander radius (1.2)
 * @property {number} [speed]         walk speed (1, the catalog default)
 * @property {string} [facing]        'down' | 'up' | 'left' | 'right' (default 'down')
 * @property {string} [behaviour]     an NPC_BEHAVIOURS name (default 'wander')
 * @property {number} [talkRadius]    (1.6)
 * @property {[number, number]} [talkPoint]   [x, z] where the player talks to the villager
 * @property {string} [portraitColor] dialog name-plate colour
 * @property {string} [title]         the small title beside the name plate (the level's npc `title`; Game.js `speakerTitle`, by its key)
 * @property {string} [titleKey]      the text key the npc object holds for its `title` (`textKeyOf(obj, 'title')`,
 *   docs/specs/I18N.md §4.2); absent: none (the title shows its English)
 * @property {Rect} [bounds]
 *   where a 'chase' villager may run; default the square of `wander` around home
 */

/**
 * A villager: idles, wanders within a small radius of home (TileMap.move collisions), turns to face
 * the player when talked to and resumes afterwards. Optional behaviours: 'chase' (the child
 * running after chickens), 'perform' (the bard at the campfire), 'post' (stands at a post and
 * looks around).
 */
export class Npc {
  /**
   * @param {{ def: NpcDef, tileMap: TileMap,
   *           sheetCache?: Map<string, ReturnType<typeof createCharacterSheet>> }} ctx
   */
  constructor({ def, tileMap, sheetCache }) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.tileMap = tileMap;
    const specKey = JSON.stringify({ preset: def.preset, ...(def.spec || {}) });
    let sheet = sheetCache?.get(specKey);
    if (!sheet) {
      sheet = createCharacterSheet({ ...CHARACTER_PRESETS[def.preset], preset: def.preset, ...(def.spec || {}) });
      sheetCache?.set(specKey, sheet);
    }
    this.sheet = sheet;
    this.sprite = new Sprite3D(sheet, { ...CHARACTER_SPRITE_OPTS, direction: def.facing ?? 'down' });
    this.sprite.name = `NPC:${def.id}`;
    this.home = new THREE.Vector3(def.home[0], 0, def.home[1]);
    this.position = this.sprite.position;
    this.position.set(def.home[0], tileMap.getHeight(def.home[0], def.home[1]), def.home[1]);
    this.wander = def.wander ?? 1.2;
    this.speed = def.speed ?? 1;
    this.behaviour = NPC_BEHAVIOURS.includes(def.behaviour) ? def.behaviour : 'wander';
    const w = Math.max(0.5, this.wander);
    this.chaseBounds = def.bounds ?? { minX: def.home[0] - w, maxX: def.home[0] + w, minZ: def.home[1] - w, maxZ: def.home[1] + w };
    this.homeFacing = def.facing ?? 'down';
    this.talkRadius = def.talkRadius ?? 1.6;
    this.talkPoint = def.talkPoint ? new THREE.Vector3(def.talkPoint[0], 0, def.talkPoint[1]) : null;
    this.rng = new RNG(hashString(def.id));
    // dynamic: it moves in place every frame (TileMap tests it on every query instead of gridding it)
    this.collider = tileMap.addCollider({ type: 'circle', x: this.position.x, z: this.position.z, r: 0.34, dynamic: true });
    this.state = 'idle';
    this.timer = this.rng.range(0.5, 3);
    this.target = new THREE.Vector3();
    this.talking = false;
    /** There as the story stands (`setPresent`; always true without a story). */
    this.present = true;
    /** Moved by a story script (`direct` … `release`): its own behaviour waits. */
    this.directed = false;
    /**
     * The level object it was built from (the story reads its `talk`, `actor`, `when` / `unless`;
     * its texts' keys are the ones this object holds: docs/specs/I18N.md §4.2). @type {any}
     */
    this.storyObj = null;
    /** Its parsed talk script (StoryRunner.attachLevel), or null: its plain conversation. @type {any[]|null} */
    this.storyTalk = null;
    this._out = { x: 0, z: 0 };
    this._stuck = 0;
    this._lookTimer = 0;
    // idle "breathing": slower than the sheet's default and slightly different per villager, so
    // the village doesn't breathe in lockstep
    this.idleSpeed = this.rng.range(IDLE_SPEED[0], IDLE_SPEED[1]);
    this._idle();
  }

  _idle() {
    this.sprite.play('idle', { speed: this.idleSpeed });
  }

  /** World point the player talks to (NPC position, or e.g. the front of a market counter). */
  get interactPoint() {
    if (this.talkPoint) {
      this.talkPoint.y = this.position.y;
      return this.talkPoint;
    }
    return this.position;
  }

  beginTalk(px, pz) {
    this.talking = true;
    this.state = 'talk';
    this._idle();
    this.sprite.faceVector(px - this.position.x, pz - this.position.z);
  }

  endTalk() {
    this.talking = false;
    this.state = 'idle';
    this.timer = this.rng.range(1.2, 2.5);
  }

  /**
   * Run `fn` with this NPC's own collider parked out of the world, so collision queries made on
   * its behalf (move, isWalkable) never push it away from — or reject targets near — itself.
   * TileMap._pushOut uses `c.r + moverRadius`, so shrinking the radius alone is not enough.
   */
  _withoutSelf(fn) {
    const c = this.collider;
    const cx = c.x;
    c.x = Infinity;
    try {
      return fn();
    } finally {
      c.x = cx;
    }
  }

  _pickTarget() {
    return this._withoutSelf(() => {
      for (let k = 0; k < 6; k++) {
        const a = this.rng.range(0, Math.PI * 2);
        const r = this.rng.range(0.4, this.wander);
        const x = this.home.x + Math.cos(a) * r;
        const z = this.home.z + Math.sin(a) * r;
        if (this.tileMap.isWalkable(x, z)) return this.target.set(x, 0, z);
      }
      return this.target.copy(this.home);
    });
  }

  _walkTowards(dt, tx, tz, speed, player) {
    const p = this.position;
    const dx = tx - p.x;
    const dz = tz - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.08) return true;
    // yield to the player: don't walk into them
    if (player) {
      const pdx = player.x - p.x;
      const pdz = player.z - p.z;
      const pd = Math.hypot(pdx, pdz);
      if (pd < 1.0 && (pdx * dx + pdz * dz) > 0) {
        this._idle();
        return false;
      }
    }
    const step = Math.min(dist, speed * dt);
    const c = this.collider;
    const cx = c.x;
    c.x = Infinity; // park our own collider: it must not push us (see _withoutSelf)
    const out = this.tileMap.move(p, (dx / dist) * step, (dz / dist) * step, RADIUS, 0.55, this._out);
    c.x = cx;
    const moved = Math.hypot(out.x - p.x, out.z - p.z);
    p.x = out.x;
    p.z = out.z;
    this.sprite.faceVector(dx, dz);
    this.sprite.play(speed > 2.2 ? 'run' : 'walk');
    this.sprite.speed = speed > 2.2 ? 0.8 : Math.max(0.45, speed / 2.8);
    this._stuck = moved < step * 0.25 ? this._stuck + dt : 0;
    return this._stuck > 0.4;
  }

  /**
   * Show or hide the villager as the story has it: hidden, it neither moves, talks nor blocks the
   * way (its collider is parked far away).
   * @param {boolean} on
   */
  setPresent(on) {
    this.present = on;
    this.sprite.visible = on;
    if (on) {
      this.collider.x = this.position.x;
      this.collider.z = this.position.z;
    } else this.collider.x = Infinity;
  }

  /** A story script takes over (its walk, its facing); `release` gives the villager back its behaviour. */
  direct() {
    this.directed = true;
  }

  release() {
    this.directed = false;
    this.state = 'idle';
    this.timer = this.rng.range(1.2, 2.5);
    this._idle();
  }

  /** One frame of a story walk toward (tx, tz) (the player is not yielded to: the script decides). */
  walkStep(dt, tx, tz, running) {
    this.directed = true;
    this._walkTowards(dt, tx, tz, running ? Math.max(2.6, this.speed * 2) : Math.max(1.1, this.speed), null);
  }

  /** A story walk ended. */
  stopWalk() {
    this._idle();
  }

  /** Put the villager at (x, z) at once (a story `teleport`). */
  placeAt(x, z) {
    this.position.set(x, this.tileMap.getHeight(x, z), z);
    if (this.present) {
      this.collider.x = x;
      this.collider.z = z;
    }
  }

  /**
   * Where the villager lives from now on (a story `home`): wandering, posts and chases are centred
   * there. `move`: also put it there at once.
   */
  setHome(x, z, { move = false } = {}) {
    const dx = x - this.home.x;
    const dz = z - this.home.z;
    this.home.set(x, 0, z);
    const b = this.chaseBounds;
    this.chaseBounds = { minX: b.minX + dx, maxX: b.maxX + dx, minZ: b.minZ + dz, maxZ: b.maxZ + dz };
    if (this.talkPoint) this.talkPoint.set(this.talkPoint.x + dx, 0, this.talkPoint.z + dz);
    if (move) this.placeAt(x, z);
  }

  /** Back home at once (the ground under it went away). */
  teleportHome() {
    this.placeAt(this.home.x, this.home.z);
  }

  /**
   * @param {number} dt
   * @param {{ player: THREE.Vector3, chickens?: { position: THREE.Vector3, absent?: boolean }[] }} ctx
   */
  update(dt, ctx) {
    const player = ctx.player;
    const p = this.position;
    // (absent as the story stands: nothing to do; its collider stays parked)
    if (!this.present) return;
    if (!this.talking && !this.directed) {
      switch (this.behaviour) {
        case 'perform':
        case 'post':
          this._updatePost(dt, player);
          break;
        case 'chase':
          this._updateChase(dt, ctx);
          break;
        default:
          this._updateWander(dt, player);
      }
    }
    // terrain height + collider follow
    const gy = this.tileMap.getHeight(p.x, p.z);
    p.y += (gy - p.y) * damp(18, dt);
    this.collider.x = p.x;
    this.collider.z = p.z;
  }

  _updateWander(dt, player) {
    if (this.state === 'idle') {
      this._idle();
      this.timer -= dt;
      // glance at the player when they come close
      const d = Math.hypot(player.x - this.position.x, player.z - this.position.z);
      if (d < 2.4) {
        this._lookTimer -= dt;
        if (this._lookTimer <= 0) {
          this.sprite.faceVector(player.x - this.position.x, player.z - this.position.z);
          this._lookTimer = 0.4;
        }
        this.timer = Math.max(this.timer, 0.8);
      }
      if (this.timer <= 0 && this.wander > 0.2) {
        this._pickTarget();
        this.state = 'walk';
        this.timer = 6;
      }
    } else if (this.state === 'walk') {
      this.timer -= dt;
      const stuck = this._walkTowards(dt, this.target.x, this.target.z, this.speed, player);
      const arrived = Math.hypot(this.target.x - this.position.x, this.target.z - this.position.z) < 0.1;
      if (arrived || stuck || this.timer <= 0) {
        this.state = 'idle';
        this.timer = this.rng.range(2.5, 6.5);
        this._idle();
      }
    }
  }

  _updatePost(dt, player) {
    // stand at home; drift back if pushed; look around now and then
    const p = this.position;
    const off = Math.hypot(this.home.x - p.x, this.home.z - p.z);
    if (off > 0.15) {
      this._walkTowards(dt, this.home.x, this.home.z, this.speed, null);
      return;
    }
    this._idle();
    this.timer -= dt;
    const d = Math.hypot(player.x - p.x, player.z - p.z);
    if (d < 2.2) {
      this.sprite.faceVector(player.x - p.x, player.z - p.z);
      this.timer = 1;
    } else if (this.timer <= 0) {
      const dirs = this.behaviour === 'perform' ? ['down', 'down', 'left', 'right'] : ['down', 'left', 'right', this.homeFacing, this.homeFacing];
      this.sprite.setDirection(this.rng.pick(dirs));
      this.timer = this.rng.range(2.5, 5);
    }
  }

  _updateChase(dt, ctx) {
    const chickens = ctx.chickens ?? [];
    const b = this.chaseBounds;
    // (a chicken whose story group went away is no prey: look for another)
    if (this._prey?.absent) {
      this._prey = null;
      this.state = 'idle';
    }
    if (this.state === 'idle' || !this._prey) {
      this._idle();
      this.timer -= dt;
      if (this.timer <= 0 && chickens.length) {
        // only chickens in (or right beside) this villager's own patch — not every chicken on the map
        const near = this._near ??= [];
        near.length = 0;
        for (let i = 0; i < chickens.length; i++) {
          const c = chickens[i].position;
          if (c.x > b.minX - 2 && c.x < b.maxX + 2 && c.z > b.minZ - 2 && c.z < b.maxZ + 2) near.push(chickens[i]);
        }
        if (!near.length) { this.timer = 1; return; }
        this._prey = this.rng.pick(near);
        this.state = 'walk';
        this.timer = this.rng.range(2.5, 4.5);
      }
      return;
    }
    const tx = Math.min(b.maxX, Math.max(b.minX, this._prey.position.x));
    const tz = Math.min(b.maxZ, Math.max(b.minZ, this._prey.position.z));
    this.timer -= dt;
    const stuck = this._walkTowards(dt, tx, tz, 2.6, ctx.player);
    const d = Math.hypot(tx - this.position.x, tz - this.position.z);
    if (d < 0.55 || stuck || this.timer <= 0) {
      this.state = 'idle';
      this._prey = null;
      this.timer = this.rng.range(0.8, 2.2);
    }
  }

  dispose() {
    this.tileMap.removeCollider(this.collider);
    this.sprite.dispose();
  }
}
