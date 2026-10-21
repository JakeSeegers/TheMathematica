import { Sheet, BUILDS } from './Sheet.js';
import { ANCESTRIES } from './talents.js';

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
 * @property {() => void} rest                 a waystone rest
 * @property {() => any[]} foes                the level's foes: uid, kind, group, alive, position
 * @property {() => string[]} log              the last log lines
 * @property {(on?: boolean) => boolean} freezeAI  foes never notice the player (tours)
 * @property {(uid: string) => boolean} kill   a foe falls at once (no fight, no loot; its `kill` event fires)
 * @property {() => GlaiveCombat} system       the GlaiveCombat itself (scripted checks)
 */

/**
 * @param {GlaiveCombat} sys
 * @returns {GlaiveHooks}
 */
export function makeHooks(sys) {
  return {
    state: () => sys.state(),
    system: () => sys,
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
    rest() { sys.restAll(); },
    foes: () => sys.enemies.map((e) => ({ uid: e.uid, kind: e.kind, group: e.groupId, alive: e.alive, hidden: e.hidden, boss: e.boss, x: +e.position.x.toFixed(2), z: +e.position.z.toFixed(2) })),
    log: () => [...sys.log.history],
    freezeAI(on = true) {
      sys.freezeAI = !!on;
      return sys.freezeAI;
    },
    kill(uid) {
      const e = sys.enemies.find((f) => f.uid === uid);
      if (!e || e.gone) return false;
      e.die();
      sys.events.emit('kill', { uid: e.uid, groupId: e.groupId, kind: e.kind, isAdd: e.isAdd });
      return true;
    },
  };
}
