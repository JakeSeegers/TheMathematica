# GLAIVE turn-based combat

> **Status.** The canonical reference for combat on combat levels. It replaces the real-time
> action combat of [COMBAT.md](../contracts/COMBAT.md) §5–§9 (the player kit, the enemy brains,
> hitboxes, projectiles, lock-on and the companions' real-time AI). The engine pieces that
> COMBAT.md also describes (FX quads, ground markers, the combat UI components, sprites, audio,
> the level catalog and the Cinderwatch generator) still apply as written there.
>
> **Audience.** Contributors who change fights, monsters, characters or their UI.

GLAIVE is a rules toolkit for fantasy-adventure tabletop games by Scott Wegener (Lonely Adventurer
Press). This game uses its mechanics: four ability bonuses, d20 saves against a DC, attack rolls
against armour class, advantage and disadvantage, hit dice, morale, talents, spellbooks, the
injury table and levels at level × 500 XP. The code and the UI text are our own words. No rule
text, table text or spell text from the book is copied. The spells are this game's own.

## Contents

1. [Overview](#1-overview)
2. [Dice](#2-dice)
3. [The character sheet](#3-the-character-sheet)
4. [Talents](#4-talents)
5. [The encounter](#5-the-encounter)
6. [Spells](#6-spells)
7. [Monsters](#7-monsters)
8. [The game side](#8-the-game-side)
9. [Video-game choices](#9-video-game-choices)
10. [Test hooks](#10-test-hooks)
11. [Tests](#11-tests)

## 1. Overview

A level with `enemy` objects is a combat level, as before (`levelHasCombat`, COMBAT.md §3). On a
combat level `Game.init` loads `GlaiveCombat` instead of the old `CombatSystem`. Peaceful levels
load nothing combat-related.

Between fights the player walks freely. Foes wander their home discs. A fight starts when:

- a foe sees the player (its kind's sight range, line of sight, its region), or
- the player strikes an unaware foe first with the ambush key (J, the left mouse button or pad X;
  the foes are then surprised), or
- the player walks into the boss's arena.

The foes of that group join. Another group joins when one of its foes is within one zone (6 u) of
the fight and sees it. Party members within 20 u of the player join. Everyone else in the level
waits.

The fight runs turn by turn. The player chooses each of their turns from menus. Companions act
by their tactics rule. Foes act by their kind. When the fight ends the party gets XP, the fallen
roll on the injury table, and coins drop where foes fell. A lost fight shows the death screen and
the player wakes at the last waystone.

| Layer | Files | Role |
| --- | --- | --- |
| rules (pure, Node-safe) | `src/game/glaive/{dice,rules,talents,spells,bestiary,allyRules,Sheet,Encounter}.js` | Every rule and every roll. No sprites, no DOM, no clock. |
| game | `src/game/glaive/{GlaiveCombat,Foe,Stage,TurnHUD,hooks,strings}.js`, `glaive.css` | The level shell, the foe actor, the animation of each step, the fight HUD, test hooks, UI text. |
| shared world pieces | `src/game/combat/{Waystones,Pickups,BossArena,CombatFx,CombatMusic,Feel,Loot,Nav,defs,bindings,strings}.js` | Kept from the real-time combat and reused as they were. |

`GlaiveCombat` keeps the outside surface of the old `CombatSystem`, so the story, campaigns, the
party, the shop and the maps call the same members (`pc`, `enemies`, `events`, `addAlly`,
`applyPresence`, `exportProgress`, `shopOffers`, `restAll`, `state()` …).

## 2. Dice

`Dice` (`dice.js`) draws only from a seeded `RNG`. There is no `Math.random`. Each fight gets
`new Dice(levelSeed ^ fightNumber × 0x9E3779B1)`, so the same choices replay the same fight.

- `d20(mod, target, mode, critFrom)` returns a `RollRecord`: every die thrown, the kept die, the
  total and the result. A natural 20 always succeeds; a natural 1 always fails.
- `mode` is `'normal'`, `'adv'` (roll 2d20, keep the higher) or `'disadv'` (keep the lower).
  `combineMode(adv, disadv)`: sources of advantage and disadvantage cancel and never stack.
- `roll('2d6+1', { mode })` rolls damage. With ADV it rolls twice and keeps the better sum
  (critical hits, Rage).

## 3. The character sheet

`Sheet.js` holds what lasts between fights: abilities, level, XP, HP, weapon, armour, shield,
talents, spellbooks, draughts, silver, fatigue, lasting wounds, uses spent since the last rest,
upgrades and marks.

| Value | Formula |
| --- | --- |
| Abilities | STR, DEX, WIS, WIL. A new character spreads +3, +2, +1, +0. No bonus goes above +5 or above level + 2. |
| Max HP | 10 + STR, +5 per level after the first, + talents' HP per level, + upgrades. |
| AC | 10 + DEX (medium armour allows at most +2, heavy armour none) + armour + shield (+2) + upgrades. |
| Attack bonus | STR for melee, WIS for ranged, + the whetstone, − fatigue. |
| Damage | The weapon's die (+ STR for melee, bows and thrown weapons) + the whetstone. |
| Death | Below −(5 + STR) HP. At 0 or below the character is Out of Action. |
| XP | Level L needs L × 500 XP. XP resets at each level. Foes give their XP; each silver coin picked up gives 1 XP. |
| Level up | +5 HP, one new talent (at most six), +1 to one ability. The player chooses both from menus. |

**Builds.** On the first combat level the player picks a calling and an ancestry (two dialog
menus once the game has been in plain play for 0.8 s, `QUIET_S`: no dialog, cutscene, travel or
story event running or queued — so the level's own story goes first; the level-up menus wait the
same way). The callings: Sellsword, Cutpurse, Hunter, Hedge Wizard,
Holy Warrior (`BUILDS`). The ancestries: Human (two calling talents), Dwarf, Elf, Half-Foot,
Demi-Ogre, Orc, Goblin (an ancestry talent and one calling talent). A campaign carries the sheet
on (`CombatProgress.sheet`, `chosen`).

**Companions.** A party member's class maps to a build (`CLASS_BUILDS`): a warden is a Sellsword,
a ranger a Hunter, a mystic a Holy Warrior with a healing relic and an ember spell. Companions are
always at the player's level and take talents and ability raises in a fixed order.

**Rests.** After every fight the uses marked "per fight" come back and one level of fatigue goes
(the game's reading of GLAIVE's short rest). A waystone rest is a long rest: full HP, every use
back, fatigue and wounds gone, and the foes of the level return.

## 4. Talents

`talents.js` lists the talents this game implements. A talent is an id the rules check
(`sheet.has('cleave')`) plus data: its archetype, HP per level, and for an active talent its uses
per rest. Talents that only make sense at a table (tracking, carousing) are left out.

| Archetype | Talents |
| --- | --- |
| Barbarian | Cleave, Die Hard, Favor of the Gods, Rage, Rush, Savage Strike |
| Holy warrior | Smite, Radiance, Heaven's Crushing Touch, Signs & Portents |
| Hunter | Deadeye, Quick Shot, Inhuman Accuracy, Monster Slayer |
| Magic user | Scholar of the Unseen, Magic Ward, Thrice Divided Intellect |
| Thief | Backstab, Evasion, Skulker |
| Warrior | Girded Loins, Hack & Slash, Professional Killer, Riposte, Shield Master, Veteran, Opportunist |
| Raconteur | Inspire |
| Ancestry | Brick Outhouse, Roots of the Mountain, Alert, Luck of the Small Folk, Tough as Nails, Sneaky Git! |

Each talent's effect is in `Encounter.js` where the rule it changes is applied. The short texts
the menus show are in `strings.js` (`talent.<id>.text`).

## 5. The encounter

`Encounter.js` runs one fight. It is pure logic and the game drives it step by step:

```js
const enc = new Encounter({ dice, world, combatants, ambush, canFlee, leader });
let beats = enc.start();
while (!enc.over) {
  beats = enc.needsInput ? enc.act(actionFromThePlayer) : enc.step(enc.decide());
  // show the beats, then go on
}
enc.result; // { outcome, xp, killed, routed, injuries, rounds }
```

### 5.1 Zones in 3D

GLAIVE uses abstract zones. The game reads them as distances on the ground (`ZONES` in
`rules.js`):

| Rule | Value |
| --- | --- |
| A move action | up to 5 u along the walk grid |
| Melee reach | 1.9 u between centres (more for big bodies: the boar, the golem) |
| "The same zone" | 3 u: a ranged attack at a foe this close has DISADV; area spells hit this radius |
| Range Rn | (n + 0.5) × 5 u |
| Flee | allowed when no foe is within 4 u of any party member |

### 5.2 Turns

- **Surprise.** An ambush by the party: the foes lose their first turn. Foes that catch the party:
  each PC saves WIS against DC 13 or loses the first turn.
- **Initiative.** Each PC rolls d20 + DEX (Alert adds WIS). The foes roll once, + their best DEX,
  and act as one block. Higher goes first; ties go to the party.
- **A turn.** A move and an action, in any order. The action can be a second move (Dash).
- **Start of turn.** Conditions count down; end saves are tried; prone characters spend their move
  standing up.
- **End of turn.** Standing in magma: a DEX save or 2d6 fire.

### 5.3 Actions

| Action | Rule |
| --- | --- |
| Attack | d20 + attack bonus against AC. A hit rolls damage; a natural 20 (18–20 with Hack & Slash) is a critical and rolls damage with ADV. A natural 1 misses and leaves the attacker off balance (attacks against it have ADV until its next turn). With `approach` the attacker first walks into reach with its move. |
| Maneuver | Trip, Disarm, Feint, Shield Bash: an attack roll; a hit deals half damage and adds the effect. Grapple: a STR save against DC 13 (16 for big foes). Fight Defensively: attacks against you have DISADV. |
| Spell | A spellbook (§6). |
| Draught | Heals 2d4 + level, to yourself or a companion in reach. The party's draughts are the player's. |
| Talent | Rage, Radiance and Rush are free actions; Inspire takes the action. |
| Flee | The party slips away on one DEX save (GLAIVE's group save). Not in the boss fight. |
| End turn | |

ADV and DISADV come from conditions, surprise, flanking (an ally on the far side of the target),
the goblins' gang-up, a charge, a feint, Deadeye, Heaven's Crushing Touch, Veteran, and shooting
into the same zone.

### 5.4 Damage, going down, the end

- Damage first passes Rage (half physical), Magic Ward (half magic) and Girded Loins.
- A PC at 0 HP or below is Out of Action; below −(5 + STR) it is dead. Die Hard and Tough as Nails
  keep it up at 1 HP once a rest.
- A foe at 0 HP dies. The training dummy only shows the damage.
- **Morale.** When the first foe falls, when half the group is down, when an elite falls, and when a
  lone foe drops to half HP, each foe rolls 2d6. Above its morale it flees. A rating of 12 never
  breaks. A fled foe counts as beaten (half XP), so story `cleared` events still fire.
- **The end.** No foe left: victory. No PC left: defeat. Every PC who went Out of Action then rolls
  d12 + 1 per 2 HP below zero on the injury table: fine, fatigued, wounded, scarred, maimed or dead.

### 5.5 Companions' choices

A companion follows its tactics rule (`PartyRules.js`; the numbers are in `allyRules.js`): it steps
out of marked danger (`evade`), heals a friend below the `heal` threshold with Mending Light,
falls back to the player below the `retreat` threshold, picks its foe by `target`, stays within
`distance` of the player, uses free talents and spells as `skills` allows, and does not attack
with `attack: never`.

### 5.6 Beats

Every step returns beats: plain records for the game to show and log. `t` names the type; `who`
and `target` are combatant ids.

| Beat | Fields |
| --- | --- |
| `round` | `n`, `order` |
| `turn` | `who`, `round` |
| `initiative` | `list` of `{ who, total }` (`who` `'foes'` for the block) |
| `surprised`, `lostTurn` | `who`, `reason` |
| `move`, `flee` | `who`, `points` (a polyline), `fly` |
| `teleport` | `who`, `x`, `z` |
| `attack` | `who`, `target`, `name`, `ranged`, `roll`, `hit`, `crit`, `maneuver`, `damage`, `dmg` |
| `damage`, `heal` | `who`, `amount`, `hp`, `from`, `kind` |
| `save` | `who`, `ability`, `roll`, `reason` |
| `condition` | `who`, `id`, `on`, `rounds` |
| `cast`, `monsterSpell` | `who`, `spell`, `target`/`targets`, `x`, `z`, `success` |
| `down`, `dead`, `up` | `who` |
| `morale` | `who`, `roll`, `rating`, `broke`, `why` |
| `talent`, `maneuver`, `draught`, `charge`, `immune` | `who` and details |
| `telegraph`, `furnace`, `phase`, `summon` | the boss (§7.2) |
| `hazardMark`, `hazardOn`, `hazardOff` | magma pools: `id`, `x`, `z`, `r` |
| `injury` | `who`, `roll`, `bonus`, `result`, `hp` |
| `end` | `outcome`, `xp` |

## 6. Spells

GLAIVE's casting rules apply: one spell per spellbook, each book once per long rest, spells grow
with the caster ([L] = level, [HL] = half the level, rounded up). A hostile spell needs a WIL save
to cast; on a failed save damage is halved and no condition is laid. The DC comes from the
target's hit dice (`castDc`: HD 1 → 10, 2–3 → 13, 4–7 → 16, 8+ → 19). A chest's "mana" upgrade is
one spare cast for any book.

| Spell | Target | Effect |
| --- | --- | --- |
| Ember Dart | one foe, R2 | [HL]+1 d6 fire |
| Cinder Burst | a zone, R2 | [HL] d6 fire to everyone in it, friends too |
| Frost Grip | one foe, R2 | slowed for [HL]+1 rounds |
| Slumber | a zone, R2 | foes fall asleep, the weakest first, up to [L]+2 HD |
| Dread | a zone, R1 | foes of [L] HD or less check morale |
| Mending Light | an ally, R1 | heals 1d8 + level |
| Warding Glyph | an ally, R1 | +4 AC for [L]+1 rounds |
| Blink | a spot, R2 | teleports the caster |

## 7. Monsters

`bestiary.js` holds a GLAIVE stat block per `enemy` kind: AC, hit dice (5 HP each), attacks,
morale, XP, silver, saves (good at one, poor at another) and special moves. A group's `level`
adds a hit die every 3 levels and +1 AC every 4. An elite has 7 HP per HD, +1 to hit, +2 morale
and twice the XP and silver. Presence data (size, sight range, speed) stays in
`src/game/combat/defs.js`.

### 7.1 Kinds

| Kind | AC | HD | Attack | Morale | Special |
| --- | --- | --- | --- | --- | --- |
| Moss Slime | 10 | 1 | Engulf 1d6 | 12 | its hit slows (STR save DC 10) |
| Bramble Goblin | 13 | 1 | Spear 1d6 | 7 | ADV when another foe is in reach of the target |
| Thorn Archer | 12 | 1 | Shortbow 1d6, R2 | 7 | backs away, then shoots |
| Hex Shaman | 11 | 2 | Hex Bolt 2d4, R2 | 8 | hexes (WIL save DC 12 or frightened), mends friends |
| Cinder Bat | 13 | 1 (4 HP) | Bite 1d4 | 8 | flies; bites and darts away |
| Ironhide Boar | 14 | 3 | Gore 1d10 | 9 | charges up to two zones with ADV; knocks prone |
| Straw Dummy | 10 | — (99 HP) | — | — | never acts |
| Cinderheart | 16 | 10 | Molten Slam 2d8+2 ×2 | 12 | the boss (§7.2) |

### 7.2 The boss

Cinderheart follows GLAIVE's "monster as puzzle" advice:

- **Nested pools.** 60 / 52 / 52 HP. Emptying a pool starts the next phase.
- **Telegraph.** Every third turn it marks a disc (3.6 u) on the largest knot of the party. On its
  next turn the furnace goes off: a DEX save (DC 14) against 4d6 fire, half on a success (none with
  Evasion or Shield Master). Companions with `evade: on` step out of the mark.
- **Summon (phase 2).** Bats from its pool of four, keeping at least two in the fight.
- **Alter (phase 3).** Magma wells up under a party member each turn and burns from the next round.
- **Weak spot (phase 3).** After a furnace it kneels: its core is exposed and attacks against it
  have ADV until its next turn.
- It cannot be tripped, grappled, slowed, stunned, frightened, disarmed or put to sleep.

The arena closes when the player walks in (`BossArena`), and the companions near the player are
placed inside.

### 7.3 Loot

Each death rolls its drops with its own RNG (`lootRng(uid, deathCount, seed)`): silver in the
kind's range, then a draught by its chance. Coins land as pickups; picking up silver gives the same
amount of XP. Cinderheart drops its silver and its core (+5 max HP).

## 8. The game side

### 8.1 Controls

Combat levels add one action, `attack` (J, left mouse button, pad X): the ambush between fights,
and confirm in the pickers. Everything else uses the core actions:

| In a fight | Keys |
| --- | --- |
| Choose in a menu | W / S or arrows, Space / Enter / F, or the mouse |
| Pick a target | A / D or arrows to cycle, Space to confirm, Esc to go back |
| Pick a spot | WASD / stick or the mouse moves a cursor; Space or a click confirms; Esc goes back |

### 8.2 Foes (`Foe.js`)

A foe idles and wanders in its group's home disc, looks for the player every 0.2 s, and in a fight
only does what the stage tells it: walk a path, hold a pose (`windup`, `attack`, `hurt`, `dead`,
the golem's `slamWind`, `slam`, `roar`, `kneel`), flash, die, run away.

### 8.3 The stage (`Stage.js`)

The stage turns beats into short timed steps: actors walk their paths at 5.2 u/s, wind up and
strike, numbers rise (damage, Miss, Saved, condition names), effects play, ground markers show the
current turn, telegraphs and magma. While it is busy the fight waits. `pace` speeds it up (tests).

### 8.4 The fight HUD (`TurnHUD.js`)

The turn order runs across the top centre, starting with the one whose turn it is. A log of the
last seven rolls sits on the left ("Rook hits the Bramble Goblin ([5,5]+5=10 vs AC 16)"). The
menus are the dialog box's choices. The vitals show HP, spell uses (SPL) and vigour (VIG: 4 −
fatigue − wounds).

### 8.5 Party members

`addAlly(member)` gives each party member an `AllyView` (the party's `AllyCombatView`): its sheet,
`active` while a fight drives it, `down` while it lies Out of Action (until a rest). The party's
follow waits while `active` is set.

### 8.6 The drillmaster

On Cinderwatch Pass, Captain Maren explains how a turn-based fight goes and the ambush key, asks
for one swing at a dummy (the ambush key next to a dummy rolls a practice attack), and gives two
draughts once.

## 9. Video-game choices

The tabletop leaves some rules to the GM. The game decides them like this:

- A short rest happens by itself after every fight (per-fight uses come back, one fatigue goes).
- The foes act as one block in the turn order (GLAIVE's monster initiative).
- Monsters do not make saves against the party's surprise: saves stay player-facing.
- A fled foe counts as beaten for the story and the campaign.
- A companion that dies is carried to the next waystone rest; the player's death loses the fight.
- Losing a fight costs 10 % of the silver and returns the party to the last waystone, as before.
- Rations, encumbrance, light and dungeon turns are not tracked.

## 10. Test hooks

`window.__game.combat` on combat levels (`hooks.js`):

| Hook | Does |
| --- | --- |
| `state()` | the snapshot below |
| `system` | the GlaiveCombat itself |
| `choose(build, ancestry)` | makes the player's character without the menus |
| `fight(uidOrGroupId, ambush)` | starts a fight (the boss: its arena fight) |
| `auto(on)` | the companions' AI plays the player's turns |
| `pace(k)` | the stage's speed-up |
| `god(on)` | +900 max HP for the party |
| `xp(n)`, `levelUp(talent, ability)` | progress without the menus |
| `rest(id)`, `reset()` | a waystone rest; the whole level back |
| `kill(uid)`, `freezeAI(on)` | content tours: a foe falls (its XP), foes never notice the player |
| `foes()` / `enemies()`, `log()`, `showcase()` | lists and a program check |

`state().combat` has `rules: 'glaive'`, `player` (HP, AC, level, XP, silver, draughts, build,
abilities, talents, spells, casts, fatigue, wounds, checkpoint, deaths, chosen), `engaged`, `fight`
(round, current, needsInput, order, combatants, options, picking, cursor, busy) or null, `fights`,
`kills`, `bossDefeated`, `enemies`, `boss`, `log`, `markers`, `pickups`, `tutorial`, `shop` and
`allies`.

In a browser check, the engine's manual-step mode (`fixedstep=1`) plays a fight quickly:

```js
// advance n frames without drawing, then draw once (for a screenshot)
const S = (n) => { for (let i = 0; i < n; i++) __engine.step(1 / 30, { render: false }); __engine.redraw(); };
__game.combat.choose('sellsword', 'human');
__game.combat.fight('glade_goblins', 'party');
__game.combat.auto(true);
__game.combat.pace(4);
```

## 11. Tests

- `npm run glaive:test` (`tools/test-glaive.mjs`) plays hundreds of fights on a flat world in Node:
  every fight must end, the same seed must replay the same beats, the rules above must hold, the
  boss must reach phase 3 and be beatable by a level 4 party of four, and every string must exist
  in English, Japanese and Chinese.
- The browser checks of [TESTING_AND_VERIFICATION.md](../development/TESTING_AND_VERIFICATION.md)
  run on the game page; drive fights with the hooks above.
