import { RNG } from '../../engine/utils/math.js';
import { Sheet, BUILDS } from './Sheet.js';
import { ANCESTRIES } from './talents.js';
import { FX_NAMES } from '../combat/CombatFx.js';
import { PICKUP_KINDS } from '../combat/Pickups.js';

/**
 * The turn-based combat's test hooks (`window.__game.combat`, docs/specs/GLAIVE.md §10): read the
 * state, pick a build without the menus, start a fight, let the AI play the player's turns, speed
 * the stage up, and a few cheats for scripted checks.
 */

/** @import { GlaiveCombat } from './GlaiveCombat.js' */

/**
 * @typedef {object} GlaiveHooks
 * @property {() => any} state                 `GlaiveCombat.state()`
 * @property {(build?: string, ancestry?: string) => any} choose  make the player's character (no menus)
 * @property {(who: string, ambush?: 'party'|'foes'|null) => boolean} fight  start a fight with a foe uid or a group id
 * @property {(on?: boolean) => boolean} auto  the companions' AI plays the player's turns (this fight and later)
 * @property {(k?: number) => number} pace     the stage's speed-up (1: normal)
 * @property {(on?: boolean) => boolean} god   no damage to the party (HP never drops below 1)
 * @property {(n: number) => number} xp        add XP → levels owed
 * @property {(talent?: string|null, ability?: string|null) => boolean} levelUp  take an owed level without the menus
 * @property {(id?: string) => boolean} rest  attune a waystone (default: the checkpoint) and rest there
 * @property {() => void} reset                every foe back home and whole, the boss too, pickups gone, no fight
 * @property {() => { fx: number, markers: number, pickups: number }} showcase  every effect, marker style and pickup once (program checks)
 * @property {() => any[]} foes                the level's foes: uid, kind, group, alive, position
 * @property {() => string[]} log              the last log lines
 * @property {(on?: boolean) => boolean} freezeAI  foes never notice the player (tours)
 * @property {(uid: string) => boolean} kill   a foe falls at once: its XP, no loot, its `kill` event fires
 * @property {() => any[]} enemies             the same list as `foes` (the old hook's name)
 * @property {GlaiveCombat} system             the GlaiveCombat itself (scripted checks)
 * @property {() => { expedition: number, dataset: any, truth: any, studied: any[] }|null} research
 *   the research overlay (designer view: the player's dataset, the truth, the studied foes' stat
 *   blocks) — null without `?research=`
 * @property {(open?: boolean, tab?: string) => boolean} ledger  open / close the field ledger (research mode); its open state
 */

/**
 * @param {GlaiveCombat} sys
 * @returns {GlaiveHooks}
 */
export function makeHooks(sys) {
  return {
    state: () => sys.state(),
    system: sys,
    choose(build = 'sellsword', ancestry = 'human') {
      const b = Object.hasOwn(BUILDS, build) ? build : 'sellsword';
      const a = Object.hasOwn(ANCESTRIES, ancestry) ? ancestry : 'human';
      const keep = sys.sheet;
      const s = Sheet.create(b, a, '');
      s.silver = keep.silver;
      s.potions = keep.potions;
      s.upgrades = { ...keep.upgrades };
      sys.sheet = s;
      sys.chosen = true;
      for (const al of sys.allies) al.syncLevel();
      // the picker, if it is open, goes
      if (sys.ui.dialog.isOpen && !sys.encounter) sys.ui.dialog.close();
      return s.toJSON();
    },
    fight(who, ambush = null) {
      const e = sys.enemies.find((f) => f.uid === who) ?? sys.enemies.find((f) => f.groupId === who && !f.gone);
      if (!e) return false;
      if (e.boss) { /** @type {any} */ (sys)._startBoss(e); return !!sys.encounter; }
      return sys.startFight(e, ambush);
    },
    auto(on = true) {
      sys.autoPlayer = !!on;
      const me = sys.encounter?.get('player');
      if (me) me.controller = on ? 'ai' : 'player';
      // a menu open for the player's turn closes (the AI takes the turn)
      if (on && sys.ui.dialog.isOpen && sys.encounter) sys.ui.dialog.close();
      return sys.autoPlayer;
    },
    pace(k = 1) {
      sys.stage.pace = Math.max(0.1, Math.min(20, Number(k) || 1));
      return sys.stage.pace;
    },
    god(on = true) {
      sys.god = !!on;
      if (on) for (const c of [sys.sheet, ...sys.allies.map((a) => a.sheet)]) c.upgrades.maxHp = Math.max(c.upgrades.maxHp ?? 0, 900);
      else for (const c of [sys.sheet, ...sys.allies.map((a) => a.sheet)]) if ((c.upgrades.maxHp ?? 0) >= 900) c.upgrades.maxHp = 0;
      for (const c of [sys.sheet, ...sys.allies.map((a) => a.sheet)]) c.hp = c.hpMax;
      return sys.god;
    },
    xp(n) { return sys.sheet.gainXp(Number(n) || 0); },
    levelUp(talent = null, ability = null) {
      const s = sys.sheet;
      const ok = s.levelUp(talent, /** @type {any} */ (ability) ?? s.raisable()[0] ?? null);
      if (ok) for (const a of sys.allies) a.syncLevel();
      return ok;
    },
    rest(id) {
      const ws = sys.waystones;
      const w = id ? ws.byId(id) : ws.checkpoint;
      if (!w || w.absent) return false;
      if (w.obj) ws.attune(w, { silent: true });
      sys.restAll();
      return true;
    },
    reset() {
      sys.resetEncounter({ full: true });
      if (sys.bossDefeated) {
        sys.bossDefeated = false;
        for (const e of sys.enemies) if (e.boss && !e.hidden) e.reset((x, z) => sys.groundAt(x, z));
        const map = /** @type {any} */ (sys)._map;
        if (map) for (const m of /** @type {any} */ (sys)._bossMarkers) if (!map.markers.includes(m)) map.markers.push(m);
      }
      sys.pickups.clear();
      sys.pc.refill();
      sys.kills = 0;
    },
    showcase() {
      const p = sys.player.position;
      const f = sys.player.facing;
      const x = p.x + f.x * 2.5, z = p.z + f.z * 2.5;
      const y = sys.groundAt(x, z);
      FX_NAMES.forEach((name, i) => sys.fx.play(name, x + (i % 3) - 1, y, z + Math.floor(i / 3) - 1, { dirX: f.x, dirZ: f.z, duration: 1 }));
      const shapes = [['circle', 'enemy'], ['ring', 'player'], ['sector', 'lock'], ['lane', 'enemy'], ['rect', 'barrier'], ['circle', 'magma']];
      const ids = shapes.map(([shape, style], i) => {
        const id = sys.markerAllocCore();
        sys.markerSetCore(id, { shape, style, x: x + (i % 3) * 2 - 2, z: z + Math.floor(i / 3) * 2 - 1, r: 1.2, rInner: 0.8, len: 3, width: 0.8, w: 2, d: 1.5, dirX: f.x, dirZ: f.z, halfAngle: 45, progress: 0.6, alpha: 1 });
        return id;
      });
      sys.later(2, () => ids.forEach((id) => sys.markerFreeCore(id)));
      sys.shot(p, { x, y, z }, 0.5);
      const rng = new RNG(0x5ca1e);
      for (const kind of PICKUP_KINDS) sys.pickups.drop(kind, kind === 'coin25' ? 25 : kind === 'coin5' ? 5 : 1, x, y, z, rng, 'none');
      for (const b of ['hitSpark', 'emberBurst', 'deathPoof', 'gooPoof', 'healGlow', 'magicBurst', 'sparkle', 'splash', 'footstep', 'victoryEmbers', 'victorySparkle', 'levelSparkle']) sys.burst(b, x, y + 0.8, z, 8);
      return { fx: FX_NAMES.length, markers: ids.length, pickups: PICKUP_KINDS.length };
    },
    foes: () => sys.enemies.map((e) => ({ uid: e.uid, kind: e.kind, group: e.groupId, alive: e.alive, hidden: e.hidden, boss: e.boss, x: +e.position.x.toFixed(2), z: +e.position.z.toFixed(2) })),
    log: () => [...sys.log.history],
    research() {
      const r = sys.research;
      if (!r) return null;
      return {
        expedition: r.expedition,
        dataset: r.dataset.toJSON(),
        truth: r.truth(),
        studied: sys.enemies.filter((e) => e.studied).map((e) => ({ uid: e.uid, habitat: e.studied?.habitat, weapon: e.studied?.weapon, atk: e.stats.atk, alive: e.alive })),
      };
    },
    ledger(open = true, tab) {
      const l = sys.ledger;
      if (!l) return false;
      if (open) sys.openLedger(/** @type {any} */ (tab));
      else l.close();
      return l.isOpen;
    },
    enemies: () => sys.enemies.map((e) => ({ uid: e.uid, kind: e.kind, group: e.groupId, alive: e.alive, hidden: e.hidden, boss: e.boss, x: +e.position.x.toFixed(2), z: +e.position.z.toFixed(2) })),
    freezeAI(on = true) {
      sys.freezeAI = !!on;
      return sys.freezeAI;
    },
    kill(uid) {
      const e = sys.enemies.find((f) => f.uid === uid);
      if (!e || e.gone) return false;
      e.die();
      sys.kills++;
      // its XP as a won fight would give it (no loot)
      if (!e.isAdd) sys.sheet.gainXp(e.stats.xp);
      sys.events.emit('kill', { uid: e.uid, groupId: e.groupId, kind: e.kind, isAdd: e.isAdd });
      return true;
    },
  };
}
