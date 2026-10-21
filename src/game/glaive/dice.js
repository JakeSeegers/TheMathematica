import { RNG } from '../../engine/utils/math.js';

/**
 * GLAIVE dice (docs/specs/GLAIVE.md §2): every roll of the turn-based combat goes through one
 * `Dice`, which draws only from its seeded `RNG` (no `Math.random`, ARCHITECTURE.md), so a fight
 * replays exactly from the same seed and the same choices. Import-free apart from the RNG and
 * Node-safe (tools/test-glaive.mjs reads it).
 *
 * A roll's record (`RollRecord`) keeps every die it threw, so the combat log and the floating roll
 * cards can show "d20 14 (+3) = 17 vs AC 13".
 */

/**
 * How a d20 is rolled: plainly, with advantage (2d20, keep the higher) or disadvantage (keep the
 * lower). ADV and DISADV on the same roll cancel out (`combineMode`).
 * @typedef {'normal'|'adv'|'disadv'} RollMode
 */

/**
 * A d20 roll against a target number (an attack against AC, a save against a DC).
 * @typedef {object} RollRecord
 * @property {number[]} dice     every d20 thrown (one, or two with ADV / DISADV)
 * @property {number} natural    the d20 kept
 * @property {number} mod        the bonus added (ability bonus, attack bonus, fatigue …)
 * @property {number} total      natural + mod
 * @property {number} target     the AC or DC to reach (equal or above succeeds)
 * @property {RollMode} mode
 * @property {boolean} success
 * @property {boolean} crit      a critical success (natural 20, or within the crit range)
 * @property {boolean} fumble    a natural 1
 */

/**
 * A damage or healing roll.
 * @typedef {object} DamageRecord
 * @property {number[]} dice     every die kept
 * @property {number} mod
 * @property {number} total      at least 0
 * @property {string} expr       the expression rolled ('1d8+2')
 */

/**
 * A parsed dice expression: `count`d`sides` + `mod` ('2d6+1', 'd8', '3').
 * @typedef {{ count: number, sides: number, mod: number }} DiceExpr
 */

/**
 * Parse '2d6+1', 'd8', '1d4-1' or a plain number. Throws on anything else.
 * @param {string|number} expr
 * @returns {DiceExpr}
 */
export function parseDice(expr) {
  if (typeof expr === 'number') return { count: 0, sides: 0, mod: Math.trunc(expr) };
  const m = /^\s*(\d*)d(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i.exec(String(expr));
  if (!m) {
    const n = Number(expr);
    if (Number.isFinite(n)) return { count: 0, sides: 0, mod: Math.trunc(n) };
    throw new Error(`parseDice: "${expr}" is not a dice expression`);
  }
  const count = m[1] === '' ? 1 : Number(m[1]);
  const sides = Number(m[2]);
  const mod = m[3] ? (m[3] === '-' ? -1 : 1) * Number(m[4]) : 0;
  return { count, sides, mod };
}

/**
 * Write a DiceExpr back as text ('2d6+1').
 * @param {DiceExpr} d
 * @returns {string}
 */
export function formatDice(d) {
  const base = d.count > 0 ? `${d.count}d${d.sides}` : '';
  if (!d.mod) return base || '0';
  if (!base) return String(d.mod);
  return `${base}${d.mod > 0 ? '+' : '-'}${Math.abs(d.mod)}`;
}

/**
 * ADV and DISADV from any number of sources: one of each cancels out (GLAIVE: they never stack).
 * @param {number} adv sources of advantage
 * @param {number} disadv sources of disadvantage
 * @returns {RollMode}
 */
export function combineMode(adv, disadv) {
  if (adv > 0 && disadv === 0) return 'adv';
  if (disadv > 0 && adv === 0) return 'disadv';
  return 'normal';
}

/** Seeded dice for one fight (or one level). */
export class Dice {
  /** @param {number|string|RNG} seed a seed, or an RNG to draw from */
  constructor(seed = 1) {
    this.rng = seed instanceof RNG ? seed : new RNG(seed);
  }

  /** One die: 1..sides. @param {number} sides */
  die(sides) {
    return sides > 0 ? this.rng.int(1, sides) : 0;
  }

  /**
   * A d20 against `target`.
   * @param {number} mod
   * @param {number} target
   * @param {RollMode} [mode]
   * @param {number} [critFrom] the lowest natural roll that is a critical success (20; 18 with
   *   Hack & Slash)
   * @returns {RollRecord}
   */
  d20(mod, target, mode = 'normal', critFrom = 20) {
    const a = this.die(20);
    const dice = [a];
    let natural = a;
    if (mode !== 'normal') {
      const b = this.die(20);
      dice.push(b);
      natural = mode === 'adv' ? Math.max(a, b) : Math.min(a, b);
    }
    const total = natural + mod;
    const crit = natural >= critFrom;
    const fumble = natural === 1;
    // a natural 20 always succeeds and a natural 1 always fails (GLAIVE's critical success / failure)
    const success = fumble ? false : crit ? true : total >= target;
    return { dice, natural, mod, total, target, mode, success, crit, fumble };
  }

  /**
   * Roll a dice expression. With `mode` 'adv' the dice are rolled twice and the better sum kept
   * (GLAIVE: ADV on damage, a critical hit), 'disadv' the worse. `explode`: a die at its maximum
   * rolls again and adds (firearms).
   * @param {string|DiceExpr} expr
   * @param {{ mode?: RollMode, explode?: boolean, extraMod?: number }} [opts]
   * @returns {DamageRecord}
   */
  roll(expr, { mode = 'normal', explode = false, extraMod = 0 } = {}) {
    const d = typeof expr === 'string' ? parseDice(expr) : expr;
    const once = () => {
      const out = [];
      for (let i = 0; i < d.count; i++) {
        let v = this.die(d.sides);
        out.push(v);
        // (at most 4 extra dice: an exploding d4 could otherwise run long on a bad seed)
        for (let n = 0; explode && v === d.sides && d.sides > 1 && n < 4; n++) {
          v = this.die(d.sides);
          out.push(v);
        }
      }
      return out;
    };
    let dice = once();
    if (mode !== 'normal' && d.count > 0) {
      const other = once();
      const sa = sum(dice), sb = sum(other);
      if ((mode === 'adv' && sb > sa) || (mode === 'disadv' && sb < sa)) dice = other;
    }
    const mod = d.mod + extraMod;
    return { dice, mod, total: Math.max(0, sum(dice) + mod), expr: formatDice({ ...d, mod }) };
  }

  /** 2d6 (morale, reactions). @returns {number} */
  twoD6() {
    return this.die(6) + this.die(6);
  }

  /** A chance of `n` in `sides` (GLAIVE's "3-in-6"). @param {number} n @param {number} sides */
  inSix(n, sides = 6) {
    return this.die(sides) <= n;
  }
}

/** @param {number[]} a */
function sum(a) {
  let s = 0;
  for (const v of a) s += v;
  return s;
}
