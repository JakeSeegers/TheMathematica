/**
 * Enemy brains by kind (COMBAT.md §7.7, §8). `Enemy` (../Enemy.js) runs the shared state machine
 * of §7.4 and calls into the brain of its kind; the brains only use the CombatContext of §9.2,
 * the Enemy helpers, `e.rng` (never Math.random) and pure helpers (`aimVy` of ../Projectiles.js),
 * so a seeded run is reproducible.
 *
 * A brain is a plain object (no imports of Enemy.js — the module graph stays acyclic):
 *
 * | Member | Called | Job |
 * | --- | --- | --- |
 * | `init(e)` | construction and `reset` | returns the per-enemy brain state (`e.ai`) |
 * | `idle(e, h, ctx)` | state `idle` (optional) | idle behaviour instead of the default wander |
 * | `engage(e, h, ctx)` | state `engage` | archetype movement; starts attacks (`e.setState('windup')`) |
 * | `attack(e, h, ctx)` | states `windup` / `active` / `recover` | the current attack's timeline |
 * | `stun(e, h, ctx)` | state `stun` (optional) | wall stun (boar) |
 * | `cancel(e, ctx)` | every interrupt, return, death (optional) | drop attack-local state |
 * | `onHit(e, info, ctx)` | `receiveHit` (optional) | kind reactions (dummy wobble, boss poise) |
 * | `die(e, ctx)` | `die` (optional) | kind death look |
 * | `glow(e, out)` | every sub-step (optional) | writes `uGlow` [r, g, b, a] into `out` |
 * | `update(e, h, ctx)` | boss only | drives every state itself |
 *
 * Telegraph grammar (§7.3), binding for every brain: each attack — follow-ups included — enters
 * `windup` for ≥ 18 f (the Enemy composes the wind-up flash from the state), a non-boss enemy
 * starts a wind-up only while `e.canWindup(ctx)` (on screen), areas of r ≥ 1.5 and ranged attacks
 * show a ground marker (y 0.03, draped) whose progress reaches 1 when the attack resolves.
 */
import { slime } from './slime.js';
import { goblin } from './goblin.js';
import { archer } from './archer.js';
import { shaman } from './shaman.js';
import { bat } from './bat.js';
import { boar } from './boar.js';
import { dummy } from './dummy.js';
import { golem } from './golem.js';

/** @import { EnemyKind, Brain } from '../types.js' */

/**
 * kind → brain (ObjectCatalog.ENEMY_KINDS; the Brain interface: ../types.d.ts).
 * @type {Readonly<Record<EnemyKind, Brain>>}
 */
export const BRAINS = Object.freeze({ slime, goblin, archer, shaman, bat, boar, dummy, golem });
