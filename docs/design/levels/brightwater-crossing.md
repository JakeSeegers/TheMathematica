# Brightwater Crossing — A Riverside Hamlet

The design document of **Brightwater Crossing**, the level that proves the editor: a 36 × 28 hamlet
where the river bends — a windmill on Miller's Hill, a waterfall spilling out of a rocky gorge, a
cobbled square with an inn and a well, a farm, a lily pond and lanterns that glow at dusk. It was
built **entirely through the level editor's UI** (no script, no hand-edited JSON); a later layout fix
moved eight objects of the square ([below](#known-issues)). This page records what is in it, how it
was made, and its known rough edges — useful both as a design reference and as a worked example for
the [level editor guide](../../user/LEVEL_EDITOR_GUIDE.md).

| | |
| --- | --- |
| **Audience** | Designers learning the editor; AI agents editing or testing this level. |
| **Source of truth** | [`public/levels/brightwater-crossing.json`](../../../public/levels/brightwater-crossing.json) |
| **Related docs** | [Level editor guide](../../user/LEVEL_EDITOR_GUIDE.md) · [Level design guide](../LEVEL_DESIGN_GUIDE.md) · [Level format](../../specs/LEVEL_FORMAT.md) · [Editor architecture](../../architecture/EDITOR.md) · other levels: [Emberfall](emberfall.md), [Starfall Vale](starfall-vale.md), [Willowmere](sample-hamlet.md) |

Play it: `game.html?level=brightwater-crossing`. Edit it: `editor.html?open=brightwater-crossing`.

![Brightwater Crossing at 16:53, reading the square's signpost by the campfire](../../assets/screenshots/brightwater-golden-hour.jpg)

---

## Concept

*"Welcome to Brightwater Crossing, traveler! The river has carried folk past our door for a hundred
years. Most of them stay for supper. A few stay for good."* — Elda

A compact, friendly hamlet at golden hour (16:48): everything a small level needs and nothing more —
climb Miller's Hill to watch the falls turn gold, rest at the Brightwater Inn, buy a honey bun, cross
the old bridge to Tamsin's farm, and sit by the campfire at Lily Pond after dark.

| Fact | Value |
| --- | --- |
| Size | 36 × 28 tiles, 2-tile forest border (wider round the gorge in the north-east) |
| Objects | 68: 12 trees, 7 fences, 6 lampposts, 5 houses, 5 regions, 4 rocks, 4 villagers, 3 signposts, 3 critter groups, 3 particle areas, 2 benches, 2 barrels, 2 flower boxes, 2 haystacks, windmill, well, market stall, waterfall, bridge, campfire, crate, crate stack |
| Walkable / water tiles | 640 / 116 |
| Height levels | 0–7 (plain at level 2 = y 1.0; Miller's Hill level 6 = y 3.0) |
| Water | `waterLevel` 0.4, the default `water` settings (flow `[0, 0.45]` south, reflect 0.2, neutral 0.2) |
| Spawn | (15.5, 24.5) facing up — on the south path |
| Author field | "Luminati level editor" |
| Light sources | 10 (6 lampposts, the campfire, 3 lit houses) — each gets a permanent light |

---

## Layout

```text
     0         1         2         3
     012345678901234567890123456789012345
  0  TTTTTTTTTTTTTTTTTTTTTTxwwwxTTTTTTTTT
  1  TTTTTTTTTTTTTTTTTTTTTTxwwwxTTTTTTTTT
  2  TTGGGGGGGgggGGGGGGGTTTxwwwxTTTTTTTTT
  3  TTggggggHHHHGGGGGGGTTTxwwwxTTTTTTTTT
  4  TTggMgggHHHHgggggggggspp|ppsggggggTT
  5  TTggggggHHHHgggggggggspppppsFFFFFgTT
  6  TTgg.......ggggggggggspppppsFFFFFgTT
  7  TTgfffgg!..igggggggggss~~~ssFFFFFgTT
  8  TTggggggg^^ggHHHHHHgggs~~~sgFFFFFgTT
  9  TTggggggg^^ggHHHHHHgggs~~~sggggggGTT
 10  TTGgggggg^^ggHHHHHHgggs~~~sfHHHHHGTT
 11  TTGgHHHHg^^ggHHHHHHgggs~~~sfHHHHHGTT
 12  TTGgHHHHg..gicccc@ciggs~~~sfHHHHHGTT
 13  TTGgHHHHg..gc@ccccccggs~~~sfHHHHHGTT
 14  TTGgggggg..gc$ckkcccgis~~~sgg!.ggGTT
 15  TTGgg.......ccckOccc..s~~~s.....gGTT
 16  TTGgg.......cccccccc.=======....gGTT
 17  TTggfffffggg&c@cccccggs~~~sigg..gGTT
 18  TTssssssssggicccccccggs~~~sggg..gGTT
 19  TTssoooossgggg!..gggggs~~~sggddddGTT
 20  TTsoooooosggggg..&ggggs~~~sggd@ddGTT
 21  TTsoooooosggggg..fHHHHs~~~sggdd&dGTT
 22  TTsoooooosgg*fg..fHHHHs~~~sggddddGTT
 23  TTssoooossgggfg..fHHHHs~~~sggggggGTT
 24  TTssssssssgggfgS.gggggs~~~sggggggGTT
 25  TTGGGGGGGGGGGGg..gGGGGs~~~sGGGGGGGTT
 26  TTTTTTTTTTTTTTTTTTTTTTT~~~TTTTTTTTTT
 27  TTTTTTTTTTTTTTTTTTTTTTT~~~TTTTTTTTTT
```

Tile map with object markers (`H` house, `M` windmill, `O` well, `$` stall, `i` lamppost, `*`
campfire, `!` signpost, `@` villager, `&` critters, `|` waterfall, `=` bridge, `S` spawn; tiles:
`T` forest, `x` rock, `w` fast stream, `p` plunge pool, `~` river, `o` pond, `s` sand, `F` farmland,
`d` dirt, `.` path, `c` cobbles, `k` stone tiles, `^` stairs rising north).

<details>
<summary>Raw height map (world y = level × 0.5)</summary>

```text
  0  777777777777777777766666666666666666
  1  777777777777777777766666666666666666
  2  776666666666222222266666666666666666
  3  776666666666222222266666666666666666
  4  776666666666222222222100000122222222
  5  776666666666222222222100000122222222
  6  776666666666222222222100000122222222
  7  776666666666222222222110001122222222
  8  776666622552222222222210001222222222
  9  772222222442222222222210001222222222
 10  222222222332222222222210001222222222
 11  222222222222222222222210001222222222
 12  222222222222222222222210001222222222
 13  222222222222222222222210001222222222
 14  222222222222222222222210001222222222
 15  222222222222222222222210001222222222
 16  222222222222222222222210001222222222
 17  222222222222222222222210001222222222
 18  221111111122222222222210001222222222
 19  221100001122222222222210001222222222
 20  221000000122222222222210001222222222
 21  221000000122222222222210001222222222
 22  221000000122222222222210001222222222
 23  221100001122222222222210001222222222
 24  221111111122222222222210001222222222
 25  222222222222222222222210001222222222
 26  222222222222222222222210001222222222
 27  222222222222222222222210001222222222
```

</details>

| Area | Where | What is there |
| --- | --- | --- |
| **Miller's Hill** | level 6 (y 3.0), x 2–11, z 2–7 (and x 2–6 at z 8) | the windmill (4.5, 4.5, turned 15°, height 6.4), the thatched Miller's Cottage (9.5, 4), a bench and a signpost at the edge, a fence along the cliff (z 8.5), falling petals, a pine and a birch; a lamppost (11.5, 7.5) at the top of the stair |
| **Hill stair** | x 9–10, z 8–11 | a flight 2 wide and 4 deep rising north (levels 2–5) to the hill |
| **The gorge and falls** | x 22–26, z 0–6 | a fast stream (bed level 6, surface 3.35) between rock walls falls 2.95 units at z 4 into a plunge pool (level 0, surface 0.4), with glints over the pool |
| **The river** | x 23–25 from z 7 to the south edge, sand banks at x 22 and 26 | crossed by the wooden bridge at z 16 |
| **Brightwater Square** | cobbles x 12–19, z 12–18, stone tiles round the well | the two-storey Brightwater Inn (16, 9.5) on its north side, the well (16, 15), the market stall (13.05, 14.2) in front of the inn's west half with Posy behind the counter, a barrel behind it and a crate stack on the grass west of it, flower boxes under the inn windows, three arm lampposts, the cat, Elda and Marigold; a bench (11.6, 19.6) just outside the south-west corner |
| **West lane** | path x 4–11, z 15–16 | Weaver's Cottage (5.5, 12.5) |
| **Lily Pond** | pond x 3–8, z 19–23 (level 0) in a sand ring (level 1) | fireflies, a rock, an autumn tree and an oak; the campfire (12, 22) with log seats east of the pond |
| **South path** | x 15–16 from the square to the south border | the spawn (15.5, 24.5), the square signpost (14, 19.5), three birds, Riverside Cottage (20, 22) east of the path |
| **Tamsin's Farm** | east of the river, x 27–33 | Tamsin's Farmhouse (30.5, 12, log walls, thatch, gable front), a fenced field (farmland x 28–32, z 5–8), the chicken yard (dirt x 29–32, z 19–22) fenced with a gate on its north side (x 30–31.5), two haystacks, five chickens and Tamsin, the farm signpost (29.5, 14.5) |

---

## Regions

| # | Region | Rect (x × z) | `minY` | Banner |
| --- | --- | --- | --- | --- |
| 1 | Miller's Hill | 0–12 × 0–9 | 1.5 | "Where the sails turn even when the wind forgets" |
| 2 | Brightwater Falls | 19–29 × 0–8 | — | — |
| 3 | Lily Pond | 0–11 × 17–28 | — | — |
| 4 | Tamsin's Farm | 27–36 × 4–28 | — | — |
| 5 | Brightwater Square | 0–36 × 0–28 (the whole map) | — | "Where the river bends and the lanterns glow" |

All have the subtitle *Brightwater Crossing*. The last region covers the whole map, so the HUD
always names a place.

---

## Landmarks

| Id | Object | Position | Notes |
| --- | --- | --- | --- |
| `house_1` | The Brightwater Inn | (16, 9.5) | 6 × 4, 2 storeys, plaster / timber frame, red roof, sign, door hood, lit lantern |
| `house_2` | Weaver's Cottage | (5.5, 12.5) | stone brick, slate, woodpile |
| `house_3` | Riverside Cottage | (20, 22) | brick, blue roof, lit lantern |
| `house_4` | Miller's Cottage | (9.5, 4) | plaster, thatch, woodpile — on the hill |
| `house_5` | Tamsin's Farmhouse | (30.5, 12) | 5 × 4, log walls, thatch, gable front, lit lantern |
| `windmill_1` | windmill | (4.5, 4.5), rotation 0.2618 | height 6.4, red roof |
| `well_1` | well | (16, 15) | 2 pages of examine text |
| `marketStall_1` | market stall | (13.05, 14.2) | striped cloth, width 2.5; collider x 11.75–14.35, z 13.35–15.5 |
| `waterfall_1` | waterfall | (24.5, 4), width 3, facing S | stream y 3.35 → pool y 0.4 (default mist, splash on) |
| `bridge_1` | bridge | (21.5, 16) → (27.5, 16) | width 2.4, arch 0.25, `deckY: null` → automatic: the bank height, y 1.0 |
| `campfire_1` | campfire | (12, 22) | with log seats |
| `signpost_1` | signpost (3 boards) | (14, 19.5) | "↑ Brightwater Square · ↖ Miller's Hill / ← Lily Pond · → Old Bridge & Tamsin's Farm" |
| `signpost_2` | signpost | (29.5, 14.5) | "Tamsin's Farm. Fresh eggs daily." + a warning about the chickens |
| `signpost_3` | signpost (1 board) | (8.5, 7.5) | "Miller's Hill. On a clear evening you can watch the falls turn gold from here." |

**Lampposts:** (12.5, 12), (19.5, 12.5) and (12.5, 18.5) round the square (arm style; the south-west
one, `lamppost_3`, turned 180° so its lantern hangs west, beside the bench); (21.5, 14.5) and
(27.5, 17.5) at either end of the bridge (top style); (11.5, 7.5) at the top of the hill stair.

**Small props of the square:** the barrel (14.5, 12.8) behind the stall, east of Posy; the crate
stack (11.55, 11.8, turned 90°) on the grass strip between the hill path and the square; the bench
(11.6, 19.6, facing east); the second barrel (28.5, 14) and a crate (33, 14) belong to the farm.

**Particle areas:** fireflies over Lily Pond (`emitter_1`, (5.5, 21.5), box 7 × 2.4 × 5, 28), petals
on Miller's Hill (`emitter_2`, (6.5, 5), 10 × 3 × 6, 24), sparkle on the plunge pool (`emitter_3`,
(24.5, 5.5), 5 × 0.5 × 2.5, 9).

---

## People

All four use plain `dialogue` and the built-in actions (no scripts); ids are the editor's defaults.

| Id | Name | Preset | Position | Behaviour | Action | Dialogue |
| --- | --- | --- | --- | --- | --- | --- |
| `npc_1` | Elda | elder | (14.5, 17) | wander 1 | — | 3 pages: welcome, the river, "climb the stairs to Miller's Hill at sunset". |
| `npc_2` | Marigold | innkeeper | (17.5, 12.8) just right of the inn door, in front of the east flower box, facing the square | post, wander 0.3 | **rest** | Ends with her own choice page "Will you rest until morning?" — **Not yet** / **Rest until morning**. |
| `npc_3` | Posy | merchant | (13.05, 13.2) behind the stall; `talkOffset [0, 2.35]`, `talkRadius 1.5` — talked to from in front of the counter (talk point (13.05, 15.55)), like Emberfall's Bertram | post, wander 0.2 | **shop**: Honey Bun | 1 page, then the built-in "Would you like the Honey Bun?" — **Just looking** / **Yes, please**. |
| `npc_4` | Tamsin | farmer | (30, 20.5) in the chicken yard | wander 1.6 | — | 2 pages about the hens. |

**Critters:** 5 chickens in the farm yard (31, 21, radius 1.8), a cat at the square's south-west
corner (12.8, 17.4, radius 2.5 — it roams the mouth of the west lane, the cobbles by Elda and the
bench), 3 birds on the south path (17.5, 20.5, radius 1.2).

![Brightwater Crossing at 22:36 — lit windows, lanterns and the campfire](../../assets/screenshots/brightwater-night.jpg)

---

## Environment settings

| Field | Value |
| --- | --- |
| `timeOfDay` | 16.8 |
| `clock`, `weather`, `music` | true, `clear`, true |
| `border`, `outerScenery`, `godRays`, `dust` | `forest`, true, true, true |
| `camera` | `null` — automatic focus bounds from the walkable area |
| `highGround` | `{ minY: 2.5, pitch: 40 }` — the camera tilts down on Miller's Hill (y 3.0) |
| `title`, `titleCamera`, `godRayAreas`, `foliage` | not set — the game's automatic choices (title = the name in capitals; title camera over the middle of the playable area; one god-ray area over the walkable ground, 6 shafts — the automatic maximum) |

---

## How it was made

This level was built **through the editor UI**, with clicks, drags and typing at 1920 × 1080,
to exercise the complete editing workflow: File › New (name, 36 × 28), Rectangle, Paint and Stairs strokes, the Place
tool (a drag for the bridge, the fences and the regions), inspector edits (names, walls and roofs,
dialogue and sign texts, emitter sizes, NPC action / look / behaviour), the Player-start tool, the
Level settings dialog (subtitle, author, description, the high-ground tilt), then File › Save as ›
Project folder and Ctrl+S. It was then play-tested with real keys (signs, a door, all four
villagers, resting, the shop, the bridge, the hill stair, every time preset) and through the
editor's Play button.

Because nothing generates it, every id is the editor's default (`house_1`, `npc_1`, …), the props
that take a seed (houses, the windmill, the stall, trees, rocks, haystacks, the crate stack) carry the
`opts.seed` the Place tool rolled for them, and the file is exactly what the editor writes.

On 2026-09-27 the square's market-stall group was moved out from behind Riverside Cottage (KNOWN_ISSUES
LVL-15): eight objects changed position or rotation — `marketStall_1` (also width 3 → 2.5), `npc_3`,
`crateStack_1`, `barrel_1`, `bench_1`, `lamppost_1`, `lamppost_3` and the cat (`critters_2`). The edit
went through the level format's own parse / serialise functions, so the file is still byte-for-byte
what the editor writes (opening and saving it unchanged leaves `git diff` empty); tiles, heights,
lights, regions and the other 60 objects are unchanged.

![The editor with Brightwater Crossing open: 3D preview, 2D map, inspector and outliner](../../assets/screenshots/editor-split-view.jpg)

## How to modify it safely

- Open it in the editor (`editor.html?open=brightwater-crossing`) and save with Ctrl+S (the dev
  server's project-folder API writes `public/levels/brightwater-crossing.json`). Saving unchanged is
  byte-identical.
- Run **Level › Check for problems** and play-test (F5) after changes.
- It is one of the regression levels for engine changes on small maps: its draw calls, triangles
  and light list must not change unless a change is intended (about 211 draw calls and 0.23 M
  triangles at the spawn view — 211 / 231,148, 10 lights, 57 programs, 89 colliders after the
  2026-09-27 stall move).

## Known issues

These were found while writing this documentation and while fixing it (probed in the game):

- **Fixed — the market stall is no longer hidden by Riverside Cottage** (KNOWN_ISSUES LVL-15,
  2026-09-27). The stall used to stand at (18.5, 17.5), 4.5 units north of the cottage (20, 22),
  whose blue roof (ridge ≈ 5.3 above the ground, eaves 0.35 over the walls) covers the ground up to
  ≈ 6.7 units north of it across x ≈ 17.65–22.35 — the stall, Posy and a customer at the counter
  showed only as the x-ray silhouette. No spot in the east half of the square is clear of that
  roof, and the map has no free spot for the cottage, so the stall group moved to the square's
  north-west, against the inn's west half, facing south: `marketStall_1` (13.05, 14.2), width 2.5
  (from 3, so its awning stays clear of the well roof); Posy (13.05, 13.2); the barrel (14.5, 12.8)
  behind the counter; the crate stack (11.55, 11.8, turned 90°) on the grass west of the stall;
  the bench (11.6, 19.6), because the stall now covers its old spot by the well; `lamppost_1`
  0.5 north to (12.5, 12) so its lantern shows above the awning's back; `lamppost_3` turned 180° so
  its lantern hangs west, not in front of the counter; and the cat's home to (12.8, 17.4) — at
  (13, 13) it was shut in behind the stall. The awning's shadow falls on the inn wall and the strip
  behind the counter only. A player at the counter is fully visible, day and night.
- **Fixed — Posy is served from the customer side.** She stands north of (behind) the stall; the
  stall's collider (front edge z 15.5) keeps the player at z ≥ 15.8. With `talkOffset [0, 2.35]`
  and `talkRadius 1.5` her talk point (13.05, 15.55) sits just in front of the counter, the same
  set-up as Emberfall's Bertram ([level design guide §11](../LEVEL_DESIGN_GUIDE.md#11-villagers)):
  facing the counter, the prompt shows for x ≈ 11.9–14.2 (at z 15.85; x ≈ 11.8–14.3 at z 16.3), and
  never from behind the stall. `talkTo('npc_3')` places the player at (12.2, 16.4), just beside
  `lamppost_3`'s post. (Before the LVL-12 fix she had no `talkOffset` and could only be talked to
  from behind the stall; at the old stall position her talk point was (18.5, 18.85).)
- **Fixed — Marigold no longer stands on the inn's door spot.** The inn's knock point
  (`door:house_1`, (16, 12.5), radius 1.0) was exactly where she posted, so the door's "Text when
  knocking" could not be read. She now posts at (17.5, 12.8), just right of the door in front of the
  east flower box, 1.53 from the door point. Walking straight at her from the square slightly right
  of her centre slides the player round her into the strip in front of the flower box; turning left
  (A) brings her prompt back, and the strip is open to the south.
- **Fixed — the Knock prompt at the wall** (KNOWN_ISSUES GAME-23, an engine-wide quirk of every
  house door). Walking into the inn door until the player touches the wall used to hide *Knock*;
  now the door leaf in front of the player counts too. At Tamsin's Farmhouse (`house_5`),
  `signpost_2` stands on the door step: walking straight into the door shows *Knock*, facing the
  sign shows *Read*.
- **Riverside Cottage still hides the south-east corner** (open, KNOWN_ISSUES LVL-15). A player in
  the square's south-east corner or on the bridge approach (x ≥ 17.65, z ≈ 13.4–20) shows only as
  the x-ray silhouette; nothing interactive is there any more. Moving the cottage out of the way
  would take ≈ 8 units (into the forest edge). Workaround: turn the camera with **Q / E**.
- **Posy stands under her own awning** (KNOWN_ISSUES PROP-13, resolved 2026-10-07). The stall's
  awning slopes from 2.72 at the back to 2.03 at the front, so a keeper standing 1–1.35 behind the
  stall's centre is covered from the gameplay camera (15 of 15 sprite points at the counter, also at
  zoom 18 and yaw +40°, day and night; 14 of 15 at yaw −40°), as is Emberfall's Bertram. While the
  player can talk to her she shows as the x-ray silhouette (the player's own).
- **The well roof hides the inn's door step** (open, KNOWN_ISSUES LVL-16): a player knocking at the
  inn door (16, 12.9) shows mostly as the x-ray silhouette, and so does one at the north end of the
  walkway west of the well (14.8, 14.0).
- The walkway between the stall (collider x ≤ 14.35) and the well (rim x ≥ 15.06) is narrow — the
  player's centre fits in about 0.1 at z 15 — but walking into it slides the player through; from
  the south-west the inn door is also reached round the well's east side. The crate stack closes
  the grass nook between the hill stair and the inn's west wall (nothing is there).
- The stall's decorative side crate and produce crate (no collider, KNOWN_ISSUES PROP-14) stand on
  the grass west of it and reach about 0.1 into the west lane. From the default camera the stall
  covers part of the inn's lower west window and the west flower box, and the crate stack shows
  above the side crates.
- The level-editor report described "5 regions with banners"; the file has banners on 2 of the 5
  regions (the others are blank).
