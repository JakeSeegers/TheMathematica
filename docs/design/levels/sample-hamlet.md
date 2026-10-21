# Willowmere — A Hamlet by the Pond (`sample-hamlet`)

The design document of **Willowmere**, the small sample level in `public/levels/sample-hamlet.json`:
a green with a well, three cottages, a pond with fireflies and a raised orchard terrace. It is the
minimal complete example of what a level contains — painted tiles and heights, houses, trees, lights,
villagers with plain dialogue (one with the built-in `shop` action), critters, particle areas and
regions — built by a short script from the `LevelFormat` helpers, with every camera and title
setting left to the game's automatic choices.

| | |
| --- | --- |
| **Audience** | Anyone learning the level format or writing a level generator; AI agents that need a small, fast level for tests. |
| **Source of truth** | [`tools/make-sample-hamlet.mjs`](../../../tools/make-sample-hamlet.mjs) (the script), [`public/levels/sample-hamlet.json`](../../../public/levels/sample-hamlet.json) (its output) |
| **Related docs** | [Level format](../../specs/LEVEL_FORMAT.md) · [Object catalog](../../specs/OBJECT_CATALOG.md) · [Level design guide](../LEVEL_DESIGN_GUIDE.md) · other levels: [Emberfall](emberfall.md), [Starfall Vale](starfall-vale.md), [Brightwater Crossing](brightwater-crossing.md) |

Play it: `game.html?level=sample-hamlet`. Edit it: `editor.html?open=sample-hamlet`. The sandbox
case `sandbox/game_levels.html?case=hamlet` loads it through browser storage.

---

## Concept

*"Welcome to Willowmere! We are small, but the pond makes up for it."* — Mira

A quiet hamlet in late afternoon (16:48): a cobbled green round a well, the Willow Inn, two cottages,
a vegetable patch, Mirror Pond sunk below the meadow with fireflies after dark, and an orchard
terrace one step up along the north.

| Fact | Value |
| --- | --- |
| Size | 28 × 22 tiles, 2-tile forest border (`createEmptyLevel({ border: 2 })`) |
| Objects | 38: 10 trees, 3 houses, 3 lampposts, 3 villagers, 3 regions, 2 critter groups, 2 particle areas, 2 flower boxes, 2 rocks, well, campfire, signpost, bench, barrel, crate stack, haystack, fence |
| Walkable / water tiles | 417 / 15 |
| Height levels | 0–4 (green at level 2 = y 1.0, terrace level 3, forest behind it level 4, pond bed level 0 with a level-1 sand shore) |
| Water | `waterLevel` 0.4; default water settings |
| Spawn | (13.9, 16.5) facing up — on the north–south road, south of the green |
| Light sources | 6 (3 lampposts, the campfire, 2 lit cottages) |

---

## Layout

```text
     0         1         2
     0123456789012345678901234567
  0  TTTTTTTTTTTTTTTTTTTTTTTTTTTT
  1  TTTTTTTTTTTTTTTTTTTTTTTTTTTT
  2  TTGGGGGGGGGGGGGGGGGGGGGGGGTT
  3  TTGGGGGGGGGGGGGGGGGGGGGGGGTT
  4  TTGGGGGGGGGGGGGGGGGGGGGGGGTT
  5  TTggggggggggg^^gggggggggggTT
  6  TTgggHHHHgggg..gggHHHHHgggTT
  7  TTgggHHHHgggg..gggHHHHHgggTT
  8  TTgggHHHHgggg..gggHHHHHgggTT
  9  TTggffggggicccccciggggfgggTT
 10  TTggggggggccccOcccgggggfggTT
 11  TT........cccccccc....@...TT
 12  TT..&@....ccccc@cc........TT
 13  TTggggggggcc!cccccggggggggTT
 14  TTggggggggccccccciggggg*ggTT
 15  TTggHHHgggg&g..gggsssssssgTT
 16  TTggHHHggggggS.gggsooooosgTT
 17  TTgfHHHgFFFFg..gggsooooosgTT
 18  TTgfHHHgFFFFg..gffsooooosgTT
 19  TTgffffgFFFFg..gggsssssssgTT
 20  TTTTTTTTTTTTTTTTTTTTTTTTTTTT
 21  TTTTTTTTTTTTTTTTTTTTTTTTTTTT
```

Markers: `H` house, `O` well, `i` lamppost, `*` campfire, `!` signpost, `@` villager, `&` critters,
`S` spawn. Tiles: `T` forest, `G` dark grass (the terrace), `g` / `f` grass / flower grass, `.` dirt
road, `c` cobbles, `F` farmland, `s` sand, `o` still pond, `^` stairs rising north.

Heights: rows 0–1 level 4, rows 2–4 level 3 (the terrace), everything else level 2 except the pond
(bed level 0, x 19–23, z 16–18) and its sand shore (level 1, x 18–24, z 15–19).

| Area | Where | What is there |
| --- | --- | --- |
| **Orchard Terrace** | z 2–4, one level up (y 1.5) | dark grass, two oaks, an autumn tree and a birch along the forest, drifting petals; a 2-wide stone stair at x 13–14, z 5 — but the edge is a single level, so it can be climbed anywhere |
| **Willowmere Green** | cobbles x 10–17, z 9–14 | the well (14, 10), three lampposts, the signpost, a bench, Mira |
| **Roads** | west–east z 11–12 across the map; north–south x 13–14 from the terrace stair to the south border | Old Fen and the chickens on the west road |
| **Cottages** | Rosehip Cottage (7, 7.8) and the Willow Inn (20.5, 7.6) north of the green; Mossy Cottage (5.3, 16.6) in the south-west, facing east | the inn's flower boxes, barrel and crate stack; Tilda outside the inn |
| **Vegetable patch** | farmland x 8–11, z 17–19, fenced along its north side | a haystack beside it, the cat |
| **Mirror Pond** | x 18–24, z 15–19 | still water sunk two levels below the green in a sand ring, fireflies, the campfire (23.5, 14.2) with log seats, rocks |

---

## Regions

| # | Region | Rect (x × z) | `minY` | Banner |
| --- | --- | --- | --- | --- |
| 1 | Orchard Terrace | 0–28 × 0–5.5 | 1.3 | "Where the old trees keep watch" |
| 2 | Mirror Pond | 17–28 × 14–22 | — | — |
| 3 | Willowmere Green | 0–28 × 0–22 (the whole map) | — | — |

All three have the subtitle *Willowmere*. `minY 1.3` makes the terrace region apply only on the
terrace (y 1.5), not on the green in front of it.

---

## Landmarks

| Object | Position | Notes |
| --- | --- | --- |
| Rosehip Cottage (`house_1`) | (7, 7.8) | plaster, thatch, woodpile, lit lantern |
| The Willow Inn (`house_2`) | (20.5, 7.6) | 5 × 3.5, 2 storeys, plaster / timber frame, red roof, sign, door hood, lit lantern |
| Mossy Cottage (`house_3`) | (5.3, 16.6), rotation π/2 (faces east) | stone brick, slate |
| Well (`well_1`) | (14, 10) | 2 pages of text |
| Lampposts | (10.4, 9.4), (17.8, 9.4), (17.6, 14.6) | arm style, round the green |
| Campfire (`campfire_1`) | (23.5, 14.2) | log seats, by the pond |
| Signpost (`signpost_1`) | (12.3, 13.6) | "↑ Orchard Terrace · → Mirror Pond / ← Rosehip Cottage" |
| Trees | 10 | oak (4.2, 3.4), autumn (8.8, 3.2), birch (18.2, 3.3), oak (23.6, 3.6), pine (25.3, 6.4), birch (2.9, 10.2), oak (25, 14.4), autumn (7.4, 19.3), pine (21.4, 19.6), birch (25.2, 19.4) |
| Particle areas | fireflies (21.5, 17.5), box 8 × 2 × 6, 26 · petals (13.5, 3.5), box 20 × 3.5 × 4, 24 | |

All three doors, the well and the sign have text, so all five are interactive.

---

## People

| Id | Name | Preset | Position | Behaviour | Action | Dialogue |
| --- | --- | --- | --- | --- | --- | --- |
| `mira` | Mira | villager | (15.6, 12.2) | wander 1.4 | — | 3 pages with a choice in the middle ("Have you seen the fireflies over Mirror Pond?" — *Not yet* / *They are lovely*). Plain dialogue does not branch: both answers lead to "Come back after dark". |
| `fen` | Old Fen | farmer | (5.6, 12.4) | wander 1.8, speed 0.8 | — | 2 pages: late carrots, the chickens. |
| `tilda` | Tilda | merchant | (22.2, 11.2) | wander 0.4, speed 0.8 | **shop**: Honey Cake | 1 page, then the built-in "Would you like the Honey Cake?" — *Just looking* / *Yes, please*. |

The script renames the villagers from `npc_1`…`npc_3` to readable ids so tests can call
`__game.talkTo('tilda')`.

**Critters:** 3 chickens on the west road (4.6, 12, radius 1.4) and a cat by the vegetable patch
(11.5, 15.5, radius 2.5).

---

## Environment settings

Everything is the default of `createEmptyLevel` / `DEFAULT_ENVIRONMENT`, except `timeOfDay`:

| Field | Value | Effect |
| --- | --- | --- |
| `timeOfDay` | 16.8 | late afternoon, sliding into golden hour |
| `camera` | `null` | automatic focus bounds: the walkable area (x 2–26, z 2–20) shrunk by Emberfall's margins — at the default zoom `{ minX 5.5, maxX 22.5, minZ 2.5, maxZ 18 }` |
| `highGround` | `null` | no tilt (the terrace is only one level up) |
| `title`, `titleCamera` | not set | the title is "WILLOWMERE" with the subtitle; the title camera drifts round the middle of the playable area at distance ≈ 22.4 (`Game._titleCamera`) |
| `godRayAreas`, `foliage` | not set | one god-ray area over the walkable ground (4 shafts: one per ~90 square units); default ground foliage |
| `border`, `outerScenery`, `clock`, `music` | `forest`, true, true, true | |

---

## How it was made

[`tools/make-sample-hamlet.mjs`](../../../tools/make-sample-hamlet.mjs) (≈ 220 lines) is a readable
example of building a level in code. It paints the terrain with a small
`fill(i0, j0, i1, j1, ch, lvl)` helper over `setTile` / `setHeightLevel`, places everything with
`addObject`, renames the villagers, then normalises, validates, puts each object's keys in a
fixed order (`canonicalObject`), checks the byte round trip and writes. A condensed version of
the same steps (run from `tools/`; it writes `my-level.json` in the working directory — tested while
writing this page):

```js
import fs from 'node:fs';
import {
  createEmptyLevel, setTile, setHeightLevel, addObject, normalizeLevel, validateLevel, serializeLevel,
} from '../src/engine/level/LevelFormat.js';

const level = createEmptyLevel({ name: 'Willowmere', width: 28, depth: 22, fill: 'g', level: 2, border: 2 });
for (let j = 0; j < 5; j++) for (let i = 0; i < 28; i++) setHeightLevel(level, i, j, j < 2 ? 4 : 3); // the terrace
setTile(level, 13, 5, '^'); setTile(level, 14, 5, '^');                                             // its stair
addObject(level, 'house', 7, 7.8, { name: 'Rosehip Cottage', light: true, text: ['Lavender hangs by the door.'], opts: { roof: 'roof_thatch' } });
addObject(level, 'npc', 15.6, 12.2, { name: 'Mira', dialogue: ['Welcome to {Willowmere}!'] });
level.spawn = { x: 13.9, z: 16.5, facing: 'up' };

const { level: out, warnings } = normalizeLevel(level);   // must give no warnings
const errors = validateLevel(out);                        // and no errors
if (warnings.length || errors.length) { console.error([...warnings, ...errors].join('\n')); process.exit(1); }
fs.writeFileSync('my-level.json', serializeLevel(out));
```

The script checks only `normalizeLevel` warnings and `validateLevel` errors — no walk or camera
checks (see [Starfall Vale's generator](starfall-vale.md#how-it-was-made) for the full validator).

## How to modify it safely

- Edit the script and run `node tools/make-sample-hamlet.mjs`. It writes
  `public/levels/sample-hamlet.json`; to experiment without touching the shipped file, pass
  `--out=<scratch>.json` (relative to the repository root; a bare `--out` exits 2).
  `node tools/make-sample-hamlet.mjs --check` writes nothing and compares the generated text with
  the file: exit 0 when it matches byte for byte (a working copy that differs only by CRLF line
  endings also counts, with a note, since git stores it with LF), else exit 1 with the number of
  differing lines and whether "the data differs" or only the key order or formatting.
- **Key order:** the generator writes each object's keys in its own fixed order — `id`, `type`, the
  placement's position keys (`x, z` for points), the catalog defaults in catalog order, then any
  other keys in the order the script sets them (catalog defaults inside `opts` first). A change to
  `createObject`'s key order therefore cannot change the file; a change to the catalog defaults
  (a new key or a new order) still does, as intended. The script refuses to write (exit 1) unless
  its output round-trips byte-identically through `parseLevel` → `serializeLevel`. (The file was
  regenerated once to this order: 38 object lines, identical data.)
- Or open it in the editor and save — but then the editor, not the script, owns the file; don't
  re-run the script afterwards.
- Run Level › Check for problems (editor) and walk it once: the checks in the script don't prove
  reachability.
- It is a regression level for engine changes on small maps (about 165 draw calls and 0.17 M
  triangles at the spawn when this page was written).
