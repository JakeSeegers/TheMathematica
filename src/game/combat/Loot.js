import { RNG, hashString } from '../../engine/index.js';

/**
 * Loot (docs/specs/GLAIVE.md §7.3). Every death rolls with its own RNG
 * `new RNG((hashString(uid) ^ Math.imul(deathCount + 1, 0x9E3779B1) ^ seed) >>> 0)` — the silver,
 * then a draught (GlaiveCombat._dropLoot) — so a kill drops the same things however the fight went,
 * and killing the same foe again (after a rest) rolls anew. The same RNG scatters the pickups.
 */

/** @type {[value: number, kind: string][]} coin denominations, largest first (pickup kind) */
const COINS = [[25, 'coin25'], [5, 'coin5'], [1, 'coin1']];
/** At most this many pickups per death (the remainder goes into the last coin). */
export const MAX_COIN_PICKUPS = 6;

/**
 * The RNG of one death.
 * @param {string} uid
 * @param {number} deathCount the enemy's deaths before this one
 * @param {number} seed the combat seed
 * @returns {RNG}
 */
export function lootRng(uid, deathCount, seed) {
  return new RNG((hashString(uid) ^ Math.imul(deathCount + 1, 0x9E3779B1) ^ seed) >>> 0);
}

/**
 * Split gold into coin pickups of 25 / 5 / 1 (at most MAX_COIN_PICKUPS; the remainder goes into
 * the last coin, which keeps the kind of its face value).
 * @param {number} gold
 * @param {{ kind: string, amount: number }[]} out filled from index 0; returns the count
 * @returns {number}
 */
export function splitCoins(gold, out) {
  let n = 0;
  let left = Math.max(0, Math.floor(gold));
  for (const [value, kind] of COINS) {
    while (left >= value && n < MAX_COIN_PICKUPS) {
      out[n].kind = kind;
      out[n].amount = value;
      n++;
      left -= value;
    }
  }
  if (left > 0 && n > 0) out[n - 1].amount += left;
  return n;
}
