# The pixel UI

The game's DOM UI uses the **Gilded Today** style: navy glass, warm gold, pixel-art frames,
gem studs, scroll corners, cartouches, crowns, bars, keycaps, reticles and the logo. Text uses
Jersey 15, Jersey 10 and Tiny5, with DotGothic16 and Noto Sans JP in Japanese and Noto Sans SC
in Chinese. Languages, strings and fonts are specified in [I18N.md](I18N.md).

This document and [`src/engine/ui/`](../../src/engine/ui/UI.js) are the complete reference;
the component recipes, palette, typography and executable sandboxes do not require a separate
mockup. References to **G** below mean this style and its 640 × 360 art-pixel design frame.

This is the UI's **contract**. The code is the truth where they differ; §9 records the relevant
design adjustments. It supersedes the look described in `ARCHITECTURE.md` §4.8
(KNOWN_ISSUES DOC-16); the current module reference is [ui.md](../architecture/modules/ui.md).

## 1. Decisions

1. **Layout.**
   - Today's layout, at G's sizes. Every component keeps its class names, its public API and its
     test hooks; additions are additive.
   - G's own departures are taken over:
     - the dialogue window anchored bottom-left and widened to the left, clear of the skill bar;
     - Sela's party strip without a portrait;
     - the tactics panel with a member portrait beside presets and rules;
     - a portrait in the dialogue window.
2. **One art pixel per UI.**
   - The UI root carries `--px`, one art pixel in CSS px, and `--fpx`, one half-size font pixel.
   - Both are whole **device** pixels: `px = max(2, floor(min(W·dpr/640, H·dpr/360)))` and
     `fpx = ceil(px/2)` (`fpxFor`). This gives px 2 up to 1919 px wide, 3 at 1920×1080 and 4 at
     2560×1440; fpx is 1 at px 2, 2 at px 3 and 4, 3 at px 5 and 6.
     - *Why ⌈px/2⌉:* G's half-size roles are half an art pixel per font pixel. At an odd
       px no whole number of device pixels is half of it; ⌈px/2⌉ is always the nearer one in
       proportion (px 3: ⅔ of an art px, 1.33× G, against ⌊px/2⌋'s ⅓, 0.67×), and it keeps the
       hierarchy the floor inverted ('HP' over a shorter '100/100', a keycap taller than its label,
       Latin in a CJK line at half the kanji's height). The text of
       [`UiScale.js`](../../src/engine/ui/UiScale.js)'s header is the source.
   - **Small screens keep px 2: never a fractional art pixel.**
     - The corner groups (anchors `tl tr bl br`: the HUD, the skill bar) hang unscaled from their
       corners while the screen holds G's corner footprint, 512 × 300 art px (1024 × 600 device
       px): `cornerShrink` is 1 there. Below it they shrink about their corners by
       `min(artW / 512, artH / 300)` (the root's `data-lu-scale="shrunk"`) — the one fractional
       scale left, for windows too small for the HUD at px 2.
     - A centred group (`tc bc mc ml mr`: the banner, the boss bar, the L windows, the title) is
       scaled only when it does not fit the screen (`fitScale`, layout.js `setGroupFit`); a
       component may reflow to `artW` / `artH` instead, and the title, journal, tactics panel, end
       card and world map do (the dialogue window, a corner group that never shrinks, narrows).
     - `shrink` is `cornerShrink` (the same value; what a component placed beside a corner group
       compensates for). 1024 × 768 is crisp; 800 × 600 still shrinks the corners.
   - Every component sizes itself in `calc(var(--px) * n)`. There are no `vw`/`clamp()` sizes left.
   - World-anchored layers (prompt, labels, emotes) read the root's scale; today's three private
     `--lu-px` formulas are gone.
3. **Art.**
   - Painted on canvases at one canvas pixel per art pixel and shown at `--px` with
     `image-rendering: pixelated`.
   - Frames are repainted per size and cached. They are not nine-slices; G's bands and ornaments
     don't slice.
   - Colours come from one JS palette (G's tokens), mirrored as CSS custom properties.
   - No image files: everything is procedural, as the rest of the game.
4. **Text.**
   - DOM text in the type roles of §4, measured with canvas `measureText`, placed on whole pixels.
     CJK text with paired full-width punctuation is measured in the DOM instead (Chrome's
     `halt` and spacing trim differ by face, and canvas `measureText` ignores both).
   - Pixel Latin faces get the alpha-threshold edge filter.
   - CJK faces get the soft filter (20 CSS px and up) or plain grey anti-aliasing (smaller).
   - No filter ever covers the glass. The filters are off inside a scaled (shrunk or fitted)
     group.
5. **Portraits.** Portraits come from the real character sheets: frame (0,0) of
   `createCharacterSheet(...).canvas`, cropped and framed (G's crops).
6. **Chunks stay split.**
   - Combat, party and story UI, their CSS, their art and their string tables load only with their
     chunks.
   - `COMBAT_PURE` / `STORY_PURE` / `PARTY_PURE` grow with the new combat-, story- and party-only
     art modules.
   - The invariants in [AGENTS.md](../../AGENTS.md) still hold: peaceful, story-less and party-less levels must not
     notice the feature.
7. **Tests stay English.** English is the default language, so every existing suite runs
   unchanged. When a restyle changes an assertion (a class list or keyboard path), update the
   test in the same change and explain why it matches the intended behavior.

## 2. Module map

```
src/engine/i18n/I18n.js              language, t(), registerStrings
src/engine/i18n/ContentText.js       data text: loc(key, english) by its text key, term(name) for names (I18N.md §4)
src/engine/i18n/ContentKeys.js       the text keys the data holds (readers, #line: tags, minting), built-in prompt verbs
src/engine/i18n/strings/<ns>.js      core string tables, one per namespace (components in §8)
src/engine/ui/FontLoader.js          Google first, dist/ second; aliases; ensure(text); fontsIn(text, font)
src/engine/ui/GlyphFont.js           the pixel glyphs ← ↑ → ↓ ↔ ↕ ↖ ↗ ↘ ↙ ♪ as TrueType fonts built at run time
src/engine/ui/UiScale.js             artScale({w, h, dpr}) → { px, fpx, shrink, cornerShrink, artW, artH }; onScale; fitScale
src/engine/ui/art/                   the painters, ported from mockup G's
  painter.js   the 2D-context painter (the mockup kit's pixelCanvas: px rect box hline vline line circle dither rows)
  palette.js   PALETTE (G's tokens) + applyPalette(root) → --g-<token>
  gilt.js      gem, stamp, gild, scale2x/3x, rowsToBits
  frames.js    frame, ornaments, crown, SCROLL; frameCanvas(style, w, h) with a cache
  pieces.js    bar, glyphs (GLYPHS, glyph, dimGlyph, gemGlyph), keycapArt, fade, rampRows, rgbOf, ramp,
               hairline, selBand, bubble, star, halo, dayBar, coin, divider, veilCanvas
  logo.js      logo (full A–Z, 0–9, punctuation; scale 3 → 2 → two lines), textLogo / textLogoFit (ja / zh)
  portrait.js  portraitCanvas(sheetCanvas, { crop, k, glow })
  icons/core.js icons/combat.js icons/party.js   the mockup kit's icons split by chunk (+ dawn and dusk icons)
  minimap.js   renderPixelMap(level, ppt, { objects }), resampleMap, markers, arrow, wedge, vignette, legendKey
  combat.js    bossBar, bracket (COMBAT_PURE)
  party.js     pips (PARTY_PURE)
src/engine/ui/layout/                the type roles and placement helpers, ported from G's
  type.js      ROLES per language, rolesAt / roles(), FONT, capMid, inkH, grow, measure, fit, shadow, txt, txc,
               lineCount, fontTokens, cjkCharClass, the glyph aliases
  layout.js    U, put, win, group, anchorEl, box, setGroupFit, capW, key, keyHints; the measure host
  base.css     the layer z-order, the .tx / .cjk / .wrap rules, the filters' classes, the stepped keyframes
```

The palette tokens and the type table are those of G, verbatim; `art/palette.js` and
`layout/type.js` hold them.

### 2.1 The API

Same names and parameters as G wherever G had the function, so the components followed G's
recipes literally. `sandbox/ui_art.html` draws every painter and hashes it against
`sandbox/ui_art.hashes.json`, a baseline recorded while the painters still matched G's own code
canvas for canvas (the few cases G never had are the engine's own art; `__uiArt.checks()`; after an
intentional art change, re-record it from `__uiArt.hashes()` run in en, ja and zh and merged, as the
file's `comment` says).
Coordinates are art px in G's 640 × 360 frame; a canvas is one canvas pixel per art pixel.
`art/index.js` re-exports every core module below (not combat.js, party.js, icons/combat.js,
icons/party.js: their chunks import them from their files).

**art/painter.js**
- `pixelCanvas(w, h, draw, scale = 1)` → canvas; `draw(p)` gets the painter `p`: `px(x, y, col)`, `rect(x, y, w, h, col)`, `box`, `hline(x, y, len, col)`, `vline`, `line(x0, y0, x1, y1, col)`, `circle(cx, cy, r, col, fill)`, `dither(x, y, w, h, a, b, pattern)`, `rows(x, y, rows, palette)`, `ctx`, `w`, `h`.
- `art(w, h, draw)` → canvas (G's `art`). `rowsToCanvas(rows, palette, scale)` → canvas. `copyCanvas(canvas)` → a copy.

**art/palette.js**
- `PALETTE` (frozen; G's 123 tokens verbatim), `pal()` → `PALETTE`, `cssVar(token)` → `'--g-<token>'`, `cssColor(token)` → `'var(--g-<token>)'`.
- `applyPalette(root)`: writes `--g-<token>` on an element (UI.js does it on the root; `layout/base.css` declares the same tokens on `.lu-root`).
- `GEMS.gold() | sapphire() | amber() | ruby() | ember() | dusk() | way()` → [dark, mid, light]; `gemRamp(hex)` → a ramp from any colour (a villager's `portraitColor`; amber for anything else).

**art/gilt.js**
- `gem(p, cx, cy, r, ramp, { outline, open, setting })`, `stamp(p, pts, outline, ink)`, `gild(bits, w, h, ox, oy, sx, sy)` → pts, `scale2x(bits, w, h)`, `scale3x(bits, w, h)`, `rowsToBits(rows)` → `{ b, w, h }`.

**art/frames.js**
- `frame(p, x, y, w, h, style)`, `ornaments(p, x, y, w, h, style)`, `crown(p, cx, by, ramp)`, `SCROLL`, `GLASS()`, `GLASS_STOPS`; `FrameStyle` (typedef) is G's `win()` options: `size` L/M/S/XS, `fill`, `bands`, `stops`, `tone: 'dim'`, `sel`, `socket`, `lattice`, `beads`, `sheen`, `notch`, `corners`, `cornerR`, `scrolls`, `trio`, `trioTop`, `trioR`, `trioGem`, `sides`, `sideR`, `crown`, `crownGem`, `pendant`, `ends`, `endR`, `endGem`, `orn`.
- `frameCanvas(style, w, h)` → `{ base, orn }`: (w + 36) × (h + 36) canvases, the box at (`FRAME_MARGIN` = 18, 18); painted once per style and size (an LRU of at most 256 entries and 6 M canvas pixels, ≈ 24 MB) and copied per call. `clearFrameCache()`.

**art/pieces.js**
- `bar(p, w, h, v, ramp, { ring, outline, chip, notch, trough })`, `rampRows(ramp, ih)`.
- `GLYPHS` (cursor, cursorGem, advance, left, right, kUp, kDown, kLeft, kRight, check, lock), `glyph(name, over)`, `dimGlyph(name)`, `gemGlyph(r, ramp, o)`, `keycapArt(w, h = 11, arrow, dim)`.
- `fade(w, h, rgb, alpha(u, v), levels, seam)`, `rgbOf(hex)`, `ramp(stops)`, `BAND_STEPS`, `band(w, h, a0, a1, at)` and `plate(w, h)` (from G's screens), `hairline(w, ends, col)`, `selBand(w, h, { lines, wash })`.
- `bubble()`, `star(s, heart)`, `halo(d)`, `dayBar(w, frac)`, `coin()`, `divider(w, ramp)`.

**art/logo.js**
- `logo(text, scale = 3 | 2 | 1 | { scale, maxW, lines })` → canvas: the Roman capitals gilded (scale 3: Scale3x, outline 2, drop 3 — G's; 2: Scale2x, 2, 2; 1: the wordmark, 1, 1). With `maxW` it is `logoFit(…).canvas`.
- `logoFit(text, { maxW, lines = 2 })` → `{ canvas, scale, lines: string[], roman }`: the contract's fit — one line at 3, else one line at 2, else two lines at 2 (at the space that leaves the narrower longer line; never a break before punctuation), else one line at 1, else two lines at 1; when nothing fits, the narrowest. Two lines are centred on one canvas. The title takes `logoFit(UP(name), { maxW: 560 })`; every shipped title fits on one line (Brightwater Crossing, The Ferryman's Lantern and Emberfall — Open Doors at scale 2: `sandbox/ui_art.html?page=titles`).
- `LETTERS`: the shared capitals completed in the same hand — A–Z, 0–9 and `' " - – — . , : ; ! ? & · … ( ) / +` (Q's tail and the comma hang below the baseline). Lower case is drawn in capitals; typographic variants (’ “ ” ‐ − …) as their plain glyph; an accented capital as its base with the mark drawn in bits (grave, acute, circumflex, tilde, macron, breve, dot, diaeresis, ring, double acute and caron over it; the cedilla under it). The gilding's bands follow the capitals' rows (`gildLogo(…, bandTop, bandH)`), so marks and tails do not move them.
- `canLogo(text)`: every character is in `LETTERS` (with its marks). A text with any other character (a user level's title in CJK, №, an Ø …) is drawn whole from `LOGO_FALLBACK_FONT` (Jersey 10 at its own pixel size — capitals 10 bits, the Roman capitals' 11 within one — then the CJK faces and the system's), scaled and gilded at the same scale; `logoFit(…).roman` is false then.
- `textLogo(text, font, scale, gap, plain, marks)` (G's, for the translated names), `gildLogo(bits, w, h, ol, sh, plain, bandTop, bandH)`, `LOGO_FONT` (ja / zh: [font, scale, gap, plain, marks]).

**art/portrait.js** — `portraitCanvas(sheetCanvas, { size, crop, k, glow })` → (size + 2)² canvas from frame (0, 0) of a `createCharacterSheet(...).canvas`, cached per sheet and options (a copy per call); `glow` 'amber' | 'sapphire' | a colour. `PORTRAIT_CROPS.dialogue` (40, [8, 2, 17, 17], ×2), `.tactics` (68, [1, 0, 31, 31], ×2), `.slot` ([8, 1, 16, 16]); `spriteCrop(sheetCanvas, crop)` → the plain crop.

**art/icons/core.js** — `icon(name, { palette, scale, mono, outline })`, `iconCanvas(def, o)`, `CORE_ICONS` (sun, moon, heart, cross, star, coin, key, scroll, chest, gem, compass, crown, flag, cursor, arrow, check, lock, and new: dawn, dusk, golden = the sun in the fire ramp), `PHASE_ICONS` (the clock's phase → icon), `GOLD_ICON()`, `DUSK_ICON()` (G's idle tones), `ICON_RAMPS`.
**art/icons/combat.js** (COMBAT_PURE) — `icon()` (its own, then core), `COMBAT_ICONS` (whirl, bolt, nova, draught, mana, stamina, skull, sword), `SKILL_ICONS`, `LOOT_ICONS`.
**art/icons/party.js** (PARTY_PURE) — `icon()` (its own, then core), `PARTY_ICONS`, `FIELD_ICONS`, `PRESET_ICONS`, `CLASS_ICONS`.

**art/combat.js** (COMBAT_PURE) — `bossBar(p, w, v, chip, phases)`, `bracket(sx, sy, L = 11)`.
**art/party.js** (PARTY_PURE) — `pips(n, i, focus)`.

**art/minimap.js** (map art) — `renderPixelMap(level, ppt = 3)`, `levelMapCells(level)` (a level's tiles in G's classes through its legend), `mapCanvas(cells, colors, { ppt, cliff, light })`, `mapColors()`, `miniMap(base, { player, markers, V, ppt, view })`, `marker(p, kind, x, y)`, `playerArrow(p, cx, cy, facing)`, `ARROW`, `viewWedge(p, V, px, py, angle)`, `vignette(p, V)`, `MARKER_REACH`, `MARKER_ORDER`.

**layout/type.js**
- `TYPE` / `ROLES_BY_LANG` (the roles per language), `FONT` (the current roles in art px: `size`, `L`, `unit`, `cjk` …), `HALF`, `setPx(px)` (UI.js), `typePx()`, `lang()`, `cjk()`, `UP(s)`, `NAME`.
- `capMid(role)`, `inkH(role)`, `grow(role)`, `measure(str, role, track)`, `fit(str, role, maxW, track)`, `fontAt(role, px)`, `roleFonts()`, `shadow(o, role)`.
- `txt(parent, text, x, y, { font, color, kw, ol, ol8, olx, drop, track, align, maxW, lineH, cls })` → the element with `.tw`, `.lines`, `.lh` (`.lines` is counted on a copy in the measure host when the element is not rendered: in a component hidden with display:none); `txc(parent, text, x, cy, o)`; `lineCount(sc, text, role, maxW, o)` (always laid out in the measure host — `sc` only before a UI root exists); `lines(text, role, maxW)`, `nameParts(name)`.
- For an element a component keeps and refills (pooled world labels, damage numbers, the dialogue's typewriter): `textHtml(text, role)` → the escaped HTML with the `{kw}` spans and the CJK `.halt` pairs; `styleText(el, role, o, text?)` → width: the classes and the inline font, size, line height, shadow, colour, keyword colour, tracking and width of `txt`, each written or cleared (a role or option change leaves nothing behind; the element's other classes stay). `txt` is these two plus the position.
- `ALIAS`, `ALIAS_RANGE`, `aliasSpecs(lang, px)` (FontLoader's aliases); `setMeasureHost(el)`, `measureHost()`, `originOf(el)`, `setOrigin(el, [x, y])`.

**layout/layout.js** (imports base.css)
- `U(n)`, `place(el, x, y, w, h)`, `group(sc, anchor, x, y, w, h, cls)` (anchors `tl tc tr ml mc mr bl bc br` measured from those edges of `sc`, or `stage`; a centre anchor rounded down to a whole device pixel), `put(parent, canvas, x, y, k, cls)`, `win(parent, style, x, y, w, h)` → `{ base, orn }`.
- `group(sc, …)` needs `sc` to cover the whole root: the root itself, or a component's element positioned absolute with inset 0 (class `lu-stage`, base.css; `.lu-hud` is one). The anchors and the shrink's origin are measured from its box.
- `capW(key)`, `key(parent, name, x, y, { dim, cls })` → width, `keyHints(parent, hints, x, y, { font, gap, align, color, ol, drop, cls })` → width, `section(g, label, x0, x1, cy, right, rf)`, `numPair(g, [a, b], x, y, { low, color })` → width.

**layout/base.css** — on `.lu-root`: the `--g-<token>` palette, the default `--px` 2px / `--fpx` 1px / `--shrink` / `--lu-dpx`; the layers (`.g` absolute z 1, `.g.grp` 2, `canvas.g.frame` 0, `.orn` 3, `.key` 4, `.tx.keylab` 5, `.veil` 4, `.over` 5, `.under` 1); `.tx` (nowrap, no kerning / synthesis / ligatures, nothing inherited), `.kw`, `.pre`, `.cjk`, `.wrap`, `:lang(ja)` auto-phrase, `.halt`; the filters on text only (`.fx-crisp` / `.fx-soft` / `.fx-aa` while `data-lu-scale="crisp"`); the shrink of corner groups (`data-lu-scale="shrunk"`) as the CSS `scale` property — it composes with a group's own `transform` / `translate` (a slide-in) instead of replacing it; `.lu-stage` (absolute, inset 0, no pointer: a component's element that holds groups); `.lu-measure`; the stepped motion `.g.bob` (0.9 s), `.nudge` (0.8 s), `.blink`, `.breathe` (1.2 s), `.step` (0.7 s, `--sx` / `--sy`), keyframes `lu-g-*`.

**UiScale.js** — `artScale({ w, h, dpr })` → `ArtScale`; `SHRINK_SNAP` (0.97: a shrink from it up is 1 — 1280 × 719 stays crisp). The roots' scale for components, by element (no reference to the UI needed): `onScale(el, fn)` → unsubscribe (the 'scale' events of the root `el` is in; call it in `dispose()`), `currentScale(el)` → `ArtScale | null`, `scaleRootOf(el)` (the root's UI, else the page's newest); `bindScaleRoot` / `unbindScaleRoot` (UI.js).

**Core string tables** — `src/engine/i18n/strings/{hud,dialog,map,title,game}.js` (one `{ en, ja, zh }` table per namespace) and `strings/index.js` `registerCoreStrings()`, which `src/main.js` calls at the top of boot (the loading screen's texts are in `game`) and the UI root again (idempotent). A feature's own namespaces (`worldfx`, `story-ui`, combat, party …) are not in it: the feature registers them ([I18N.md §2](I18N.md#2-ui-strings)).

**Additional public helpers** (all additive):
- **UiScale.js:** `fpxFor(px)` → ⌈px / 2⌉ (§1.2); `ArtScale.cornerShrink` (`shrink` has the same value); `CORNER_W` / `CORNER_H` (512 × 300, G's corner footprint); `fitScale(anchor, x, y, w, h, artW, artH)` → the scale a centred group needs to fit, 1 where it fits (from `SHRINK_SNAP` up), 1 for corner anchors.
- **The root:** `--shrink-corner` and `ui.cornerShrink`; the font tokens `--lu-font[-name|-line|-num|-tiny][-w]` (the roles' stacks of the page's language) and `--lu-font-j15` / `--lu-font-j10` / `--lu-font-t5` (the plain faces with their pixel glyphs), written on every scale change from `type.js fontTokens()`, for CSS that sets text outside `txt()` (the debug panel, the loading screen).
- **layout/type.js:** `rolesAt(lang, px)` → the roles in use at a scale (Japanese names and dialogue on DotGothic16's 16-dot grid where a size near G's exists, else Noto Sans JP; §4), `roles()` (the current ones; read these, not `ROLES_BY_LANG`, for anything drawn); `trackArt(role, track)` / `trackCss(role, track)` (tracking in the role's own unit, so a half-size role's letters stay on whole pixels); `fontTokens()`; `cjkCharClass(text, i, role)` → `'halt'` (the first of a full-width pair), `'cjkdot'` (a Chinese middle dot between two characters) or `''`, for a component that builds per-character spans (DialogBox); `GLYPH_FACE`, `GLYPH_ALIAS`, `PIXEL_GLYPHS` (below); `aliasSpecs(lang, px)` entries gain `glyphs`, `k` and `size`.
- **GlyphFont.js:** the arrows ← ↑ → ↓ ↔ ↕ ↖ ↗ ↘ ↙ and ♪ (which no Jersey face has) drawn on the grids of Jersey 15, Jersey 10 and Tiny5 and built at run time as tiny TrueType fonts, "Lu Glyph 15" / "Lu Glyph 10" / "Lu Glyph 5" (`GLYPH_FAMILY`; nothing is downloaded); every role's stack carries the one on its face's grid, and the CJK stacks a size-adjusted alias of it ("Lu G Body" …), so an arrow or a note is pixel art in every role and language — in DOM text, in DialogBox's per-character spans and in `measure`.
- **layout/layout.js:** `anchorEl(el, anchor, x, y, w, h, sc)` → anchors an element a component keeps (as `group()` anchors a new one: origin, `data-anchor`, the box from its edges, the shrink's origin, the fit); `box(parent, x, y, w, h, cls, tag)` → a plain box placed in frame coordinates (a window's section, a row, a card); `setGroupFit(g, anchor, x, y, w, h, sc)` → scales a centred group only when it does not fit (`data-fit="shrunk"`, `--lu-fit`); `group()` calls it, and a component that re-anchors a group of its own calls it after each re-anchor.
- **art/pieces.js:** `veilCanvas(w, h)` → the dim stepped veil behind a full-screen window (the tactics panel's, the journal's, the world map's), painted once per size and copied.
- **art/logo.js:** `textLogoFit(text, lang, { maxW, lines })` → the translated title drawn from the language's face (DotGothic16 for ja, Noto Sans SC 900 for zh), fitted like `logoFit`.
- **art/minimap.js:** `renderPixelMap(level, ppt, { objects })` (`objects: true` also draws houses, bridges, trees, wells and the windmill flat on the tiles), `resampleMap(map, ppt)` (a painted map turned into art pixels), `legendKey(kind)` (an 11 × 11 legend chip), the marker / arrow / wedge / vignette sprites, `FACINGS`, `facingOf`.
- **FontLoader.js:** `fontsIn(text, font)` (whether the glyphs of `text` in `font` are in, per character, from the face statuses — never `document.fonts.check`), `report.glyphs`; `ensure(text)` loads each non-ASCII character once per role font ([I18N.md §5](I18N.md#5-fonts)).
- **Components** (§5, ui.md): `HUD` `defaultControls()`, `phaseName(id)`, `keycapsWidth(keys)`, `hud.relayout()`; `Banner.box` and the bubbling `lu-banner` event; `TitleScreen` `TITLE_LANGUAGES` and `title.language`; `DialogLine.sheet` / `title` / `ask` and `DialogBox.cjkPace`; `Announcer.announce(…, { y })`; `CombatHUD` `anchorGroup(el, at, x, y, w, h, sc)`; `WorldLabels` `PanelSpec.box`; the root class `lu-root--boss` (§8.1).

## 3. The root (UI.js)

- `new UI(container, { lang, fonts })`.
  - Applies the palette and the scale (`--px`, `--fpx`, `--shrink`, `ui.px`, `ui.fpx`,
    `ui.artW`, `ui.artH`).
  - Recomputes on `resize`, on a device-pixel-ratio change and on a contained root's
    ResizeObserver.
  - Emits `ui.on('scale', …)`.
- It injects the three SVG filters once (`#lu-crisp`, `#lu-soft`, `#lu-aa`) and the measure host.
- `ui.fontsReady` resolves when the language's fonts are in. Game awaits it before the first
  layout of the HUD and the title.

**Implementation:**
- `new UI(container = document.body, { lang, fonts } = {})`. `lang` is set with `setLang` (without
  it the root resolves the page's: `?lang=`, the saved choice, English); `fonts` is the page's
  `FontLoader` (default `currentFonts()`, else a new `startFonts({ lang })`). The root registers
  the core string tables (`registerCoreStrings()`).
- Members: `lang`, `fonts`, `measureHost`, `scale` (the whole `ArtScale`), `px`, `fpx`, `shrink`,
  `artW`, `artH`; `on('scale', fn)` → unsubscribe, `off('scale', fn)`; static `UI.of(el)` → the UI
  whose root `el` is in (else the page's newest).
- **A component reaches the scale from its parent element.** Components are made as `new X(root)`,
  so the root registers itself with UiScale.js (`bindScaleRoot`) and a component calls
  `onScale(parent, fn)` / `currentScale(parent)` (or `UI.of(parent)`): no edit of UI.js, no
  back-reference.
- The scale is `UiScale.js` `artScale({ w, h, dpr })` → `{ px, fpx, shrink, artW, artH, dpr, W, H,
  cssPx, cssFpx }` of the window (a `body` root) or of the container (a contained root, through a
  ResizeObserver), recomputed on `resize` and on a `(resolution: …dppx)` change. On a change the
  root gets `--px` (cssPx), `--fpx` (cssFpx), `--shrink`, `--lu-dpx` (one device pixel in CSS px:
  `txt()` rounds positions to it) and `data-lu-scale` = `crisp` (shrink 1: the text filters on) or
  `shrunk`; `layout/type.js setPx(px)` and `fonts.setScale(px)` follow, and 'scale' is emitted
  **once the fonts follow** (`setScale`'s promise: a Japanese or Chinese page's Jersey aliases
  rebuilt for the new px, so `measure()` is right inside the listener; before the fonts are in, it
  waits for them). One event per change; a newer change in the meantime emits instead. A
  zero-sized screen (a contained root not laid out yet, or collapsed) keeps the last scale (the
  window's before the first).
  State lives in an attribute, not a class: the root's class list is the UI's state, which tests
  compare.
- Measured (harness, DPR 1; current scale rules):

  | Screen | px | fpx | Corner shrink | English body / line | ja names, dialogue | CJK Jersey alias (names, dialogue · lines) |
  |---|---|---|---|---|---|---|
  | 1024 × 768 | 2 | 1 | 1 (art 512 × 384) | 27 / 18⅔ px | Noto Sans JP 24 px | Jersey 15 ×1 · Jersey 10 ×1 |
  | 1280 × 720 | 2 | 1 | 1 (640 × 360) | 27 / 18⅔ | Noto 24 | J15 ×1 · J10 ×1 |
  | 1600 × 900 | 2 | 1 | 1 (800 × 450) | 27 / 18⅔ | Noto 24 | J15 ×1 · J10 ×1 |
  | 1920 × 1080 | 3 | 2 | 1 (640 × 360) | 54 / 37⅓ | DotGothic16 32 px | J10 ×2 · J15 ×1 |
  | 2560 × 1440 | 4 | 2 | 1 (640 × 360) | 54 / 37⅓ | DotGothic16 48 px | J15 ×2 · J10 ×2 |

  800 × 600 keeps px 2 with the corners shrunk (0.78). DPR 1.25 at 1536 × 864 gives px 3 = 2.4 CSS
  px; 4K at DPR 2 gives px 6 = 3 CSS px.
- `cornerShrink` (§1.2) is written as `--shrink-corner` (and `--shrink`, the same value);
  `data-lu-scale` is `crisp` while it is 1, else `shrunk`. A centred group's own fit is
  `data-fit="shrunk"` with `--lu-fit` (layout.js `setGroupFit`).
- On every scale change the root also writes the font tokens (§2.1, `fontTokens()`): `--lu-font`
  / `--lu-font-w` (the body role of the page's language: the root's own font), the other roles'
  stacks, and `--lu-font-j15|j10|t5`.
- `fontsReady` resolves when the language's pixel UI fonts are in — `fonts.ready`: the Latin set,
  the language's CJK set, the Jersey aliases and the pixel glyphs (I18N.md §5) — or failed; it
  never rejects. Cinzel, Crimson Pro and Pixelify Sans are gone from the game UI and from
  `fontsReady` (the game's CSS went from about 170 kB to 27 kB). `Game` starts the wait
  at `init` and awaits it in `_buildLevel` once the world and the villagers are built, so the
  fonts load while the world builds (`loadStats.fontsWait`: what the build still waited); the
  glyphs of what the level shows first (`fonts.ensure`) load meanwhile too (`glyphsWait`).
- The world-anchored layers (InteractPrompt, Emotes, WorldLabels) read the root's `--px` /
  `--fpx` (`onScale`); no private `--lu-px` is left.
- Today's design tokens (the creams and the panel gradient, the `clamp()` sizes `--lu-fs-*`, the
  SVG ornaments) are gone and no component reads the old ones any more. `layout/base.css` keeps
  the motion curves `--lu-ease` / `--lu-ease-out` and, for a stylesheet outside the game UI,
  aliases of the rest: `--lu-serif` / `--lu-display` → Jersey 15, `--lu-pixel` → Tiny5,
  `--lu-gold-hi`, `--lu-gold-line`, `--lu-gap`. Custom properties still named `--lu-…` are
  otherwise a component's own (`--lu-fs` / `--lu-lh` of a world label, `--lu-wf-*` its art,
  `--lu-dpx`, `--lu-fit`).

## 4. Type roles

The roles are G's `ui.js`: `head`, `name`, `body`, `line`, `small` and `val` change with the
language; `num`, `big`, `numL` and `tiny` never do. Sizes are in the role's unit (`px` = art px,
`fpx` = half-size font px).

| Role | Use |
|---|---|
| head | the one big heading: level-up, area banner, the member on the tactics panel, death / end titles |
| name | today's small capitals: names, headings, the menu |
| body | dialogue, choices, blurbs |
| line | today's small italic lines: region, phase, speaker title, hints, help, footers, tagline |
| small | tracked labels |
| val | a rule's value |
| num | small numbers, Jersey 10 at half size |
| big | the clock, hit numbers, cooldown seconds |
| numL | the level numeral, crits |
| tiny | Lv, HP, MP, SP, G, N, keycaps |

**Rules:**
- No digit is ever set in Tiny5.
- Pixelify Sans, Cinzel and Crimson Pro have left the game UI (no `@fontsource` import
  in `UI.js`). The editor keeps Cinzel 600 (`src/editor/main.js`).

**Implementation:** `layout/type.js` holds G's table verbatim (`TYPE.en | ja | zh`);
`FONT[role]` gives a role in art px for the page's language and the root's px (`size`, `L`,
`unit` = 1 or HALF = fpx / px). The CJK stacks start with the role-named Jersey aliases (`ALIAS`:
"Lu J Head" … "Lu J Val", built by FontLoader, I18N.md §5.1) where G has "G Big 32" … "G Num 16".
Layouts are written in the English px-2 layout's art px; `txt()` lands another language's ink
centre on the English one and keeps a half-size role's centre at px 3. Text is measured with
canvas `measureText` (at 8×, kerning off), so it measures while a component is hidden; wrapped
text's line count (`lineCount`) uses the root's always-laid-out measure host.

**Implementation:**
- **The roles follow the scale** (`rolesAt(lang, px)`, read through `roles()`): G's table is the
  px-2 table. Japanese names and dialogue are DotGothic16 only at a size on its 16-dot grid within
  12.5 % of G's — 32 px at px 3, 48 at px 4 —, else Noto Sans JP at G's size, 700 for names and
  500 for text (px 2: DotGothic16 at 24 px, 1.5 device px a dot, closes the dakuten up — バ read
  パ). The heading's bitmap bold is half a dot (`--fpx`) and the names have none, so ゛ stays
  open. Chinese is Noto Sans SC throughout, its weight carrying the hierarchy.
- **The CJK lines' Jersey aliases** take the whole-pixel Jersey face and size whose cap height is
  nearest G's ratio of cap to kanji ink at that scale; a tie goes to G's face, so px 2 and 4 are
  G's (I18N.md §5.1).
- **A half-size role at an odd px** is ⅔ of an art px a font pixel (1.33× G). Where art has no
  room for that, a component sets G's 5-art-px cap in a Jersey face at whole device pixels
  instead (the skill bar's names and keycap digits at px 3) — §9.
- **Tracking** is measured in the role's own unit (`trackArt`, `trackCss`): a half-size role's
  letters stay on whole pixels at every px.
- **Pixel glyphs:** every stack carries the run-time glyph fonts (§2.1 GlyphFont.js), so arrows
  and ♪ in signposts, toasts and the music line are pixel art in every role and language.
- **Paired CJK punctuation** (`」。`, `、「` …) is measured in the DOM (the measure host), because
  Chrome's `halt` and spacing trim differ by face and canvas `measureText` sees neither; widths
  land within 1 art px of what is drawn. A Chinese middle dot between two characters is set in the
  CJK face (`.cjkdot`).
- **Line breaking:** CJK text wraps by the strict rules (no line starts with a closing mark or
  ends with an opening one). Journal.js `wrapLines` (the journal, the end card, the barks) also
  keeps Latin runs and Japanese words (`Intl.Segmenter`) whole and trims spaces at line ends.

## 5. Component recipes

Each component was built from its recipe in mockup G's screens. States G does not show are
drawn in the same family, per the component recipes below:
- the area banner as the level-up card;
- toasts as the title's plate band;
- the controls legend as an XS window;
- the world map, journal and results card as L windows like the tactics panel;
- the death and end screens on a stepped vignette with the shared divider;
- edge arrows as 8 pre-drawn octants;
- motion in whole art pixels with `steps()`.

The paragraphs below, together with the code, define each
component's reference. Sizes and coordinates are art px of G's 640 × 360 frame; "growth" is a CJK
role's ink beyond the English role's (`grow()`).
Shared helpers a component may use: `group` / `anchorEl` / `setGroupFit` (layout.js), `box`
(a section, a row, a card), `veilCanvas` (the full-screen windows' veil), `cjkCharClass` (a
component's own per-character spans).

**HUD** (`HUD.js`, `Banner.js`, `DebugPanel.js`, `hud.css`)
- **Place plate** `.lu-loc`: a `tl` group at (10, 10), G's `placePlate`, width
  max(123, (23 + text) / 0.72). The box always has the two-line height (22 art px in English, 28 in
  Japanese, 29 in Chinese), so the vitals and the party frames under it never move; with no region
  the name is centred.
- **Clock** `.lu-clock[data-phase]`: an XS window anchored `tr`, its right edge at 630, 31 tall
  (+ the line's growth), as wide as the language's longest phase name (it never jumps). The icon
  is `PHASE_ICONS`'; the text `t('hud.clock', { time, phase })`, the phase in its colour.
- **Legend** `.lu-help`: an XS window anchored `bl`, its bottom at 350, rows 13 apart. It switches
  to two columns when one column would come within 160 of the top; in CJK the space kept at the
  top grows by twice the plate's height increase (no touch with three party frames at 1024 × 768).
  It steps aside under the boss bar (`lu-root--boss`), the boss's results card
  (`lu-root--results`) and the death screen.
- **Toasts** `.lu-toasts`: the stack starts at y 10, toasts 2 apart, 8 clear of the corner panels
  (plate, vitals, party frames, clock, minimap), on the screen's centre line (the banner's axis)
  where it fits, else moved only as far as needed. Each toast is the title's plate band with
  16-art-px fading ends: 16 tall plain, 20 with a kind's icon (a scroll for a quest, a chest for an
  item, a flag for an error); the text wraps to the free span minus 16 and the end pieces (at most
  400; an error 460, in ruby). A toast that would reach the banner's card goes under it; beside a
  long place plate, where the text would have under 140, the stack starts under the plate. Moves
  step in 3. `{Key}` (`{G}`, `{Esc}`, `{P}` …) draws G's keycap on a one-line toast; on a wrapped
  or an error toast the braces fall back to gold keyword text.
- **Banner** `.lu-banner`: a stage over the root holding G's level-up card as a `tc` group from
  y 48 (title and subtitle at most 520, then an ellipsis); the rules open in `steps()`; the timings
  are today's. Rebuilt on a scale change. `box` (the card's keep-out while shown) and the bubbling
  `lu-banner` event tell the HUD where the card is.
- **Keycaps** (`createKeycaps`): the shared 11-art-px cap drawn in CSS at `--px`; the arrows are an SVG
  path with an `aria-label` ("Left arrow"), no text.
- **Debug panel** (English only): a column 146 wide, 7 under the clock. The stats box is an XS
  frame with gold corner gems, 76 tall, Jersey numbers and Tiny5 labels; lil-gui's rows, numbers,
  colour codes and buttons are Jersey 10 at the line role's size, its title Jersey 15 capitals
  (the name role), its folders G's Tiny5 section headings, monospace Tiny5.
- While a dialogue is open the plate and the clock dim to 0.55.

**Dialogue** (`DialogBox.js`, `dialog.css`)
- G's L window (lattice, beads 6, trio, side studs) in a group anchored bottom-left: x0 10, bottom
  344, w = min(496, artW − 16, the shown skill bar's left − 22) and at least 240 (496 at 1024 × 768
  on a peaceful level, 368 on a combat level); h = max(62, 12 + lines · L + 10 (8 in CJK)),
  growing so the ▼ clears a long last line. **No corner shrink**: on a small screen the window keeps
  its art pixels and narrows (`_width`), its text reflowing, with the text filters on.
- Portrait from `sheet` at x0 + 23 (`portraitCanvas`, `PORTRAIT_CROPS.dialogue`, glow the speaker
  colour's dark tone); text at x0 + 72 (x0 + 24 without a sheet), wrapping at x0 + w − 24.
- Name plate (S, notch 3, ends, plate bands) at x0 + 30, centred on the top rim, 16 tall + growth,
  at most w − 60 with the title cut first; it hides the top trio when it reaches it. At an odd px
  the plate and the choice rows grow with the half-size ink (+4 at px 3) and the speaker's title
  sits on the name's real baseline.
- Advance mark at (x0 + w − 37, y0 + h − 15) with a stepped bob; on the last line a breathing gold
  gem; hidden while the choices are open.
- **Question** (`DialogLine.ask`): 5 under the speech (3 in CJK), a gold gem at the text's x, the
  question at x + 8 in the selection colour, wrapping 8 sooner; h = max(62, 12 + n1 · L + gap +
  n2 · L + foot). It types after the speech, at least 0.3 s later. A held window opened again with
  the same speaker and text plus an `ask` or `choices` shows the speech at once and types only the
  question (66 tall with G's content, as G).
- **Choices**: an XS window with gold corners, width max(100, longest + 38) up to w − 20, rows 16
  + growth, its right edge at x0 + w − 10, 10 above the window (lifted clear of a long plate); the
  selection band and the nudging gem cursor; long labels wrap.
- Japanese and Chinese type one character at a time at 0.7 × the speed (`cjkPace`), pause on
  full-width punctuation with or without a space after it, and wrap by the strict rules.

**Prompt** (`InteractPrompt.js`): z 4 (over the banner, as the dialogue). The plate's bottom sits
2 above the projected point: 15 + growth tall — 5, the keycap, 3, the label (line role), 5.
`bubble()` 2 above it, its dots blinking in turn; it pops up 3 art px in steps, placed on whole
device pixels. The default label is `t('dialog.prompt.talk')`.

**Maps** (`Minimap.js`, `map.css`, `art/minimap.js`)
- **Minimap**: a `tr` group at (554, 50), 76 × 76: G's M window, 'N' in `tiny` (g5, outlined), a
  70 × 70 map at 2 art px per world unit (about 34 world units across). It moves down only when the
  clock's bottom comes within 7 of it. The map is G's flat tiles with the level's buildings,
  bridges, trees, wells and windmill when the game passes the level (`renderPixelMap(…, {
  objects: true })`), else the painted map in art pixels (`resampleMap`). Each frame: the wash, the
  wedge (64 steps), the vignette, the markers in G's order (pushed aside from the arrow; foes
  outside as edge pips) and an 8-facing 9 × 9 arrow.
- **World map**: an `mc` L window (lattice, beads 6, trio, sides) on the tactics veil, sized to
  its content and to the screen so `fitScale` stays 1 (narrower at 1024 × 768, never scaled).
  Header at +17: WORLD MAP (small) ◆ the title (head) and the subtitle (line, on the title's
  baseline); a dm1 rule at +29. The map sits in a dim XS socket at a whole art scale of 1 to 8.
  The markers are drawn on a canvas **over** the region names; each name tries its centre, then
  just below, then just above, keeping clear of the markers (the player, waystones and the boss
  first), else its compact form (two lines in the small role; in English at an even `--px` the
  line role, whose font-pixel outline leaves Tiny5's C open — 'GINDERWATGH' under a one-art-px
  outline), else the centre. Ink, line pitch and the legend's width follow `fpx`. Laid out on `open()` only (a load stores the map; the first open costs ≈ 200 ms).
- **Legend**: a column of 92 to 150, rows 13 apart with 11 × 11 chips, then YOU ARE IN with the
  region (name role, up to 3 lines), the key hints at the foot. The window opens with a stepped
  fade and rises 2 px.

**Title and loading screen** (`TitleScreen.js`, `title.css`, `art/logo.js`, `game.html`)
- G's group `mc` (40, 50, 560 × 300). `star(25)` 2 over the logo.
- English: `logoFit(UP(title), { maxW })` with its foot at y 140 (maxW 560, or `artW − 32` on a
  narrower screen); `divider(219)` at 150; the tagline in the line role, tracked 2, at divider + 18.
- Japanese and Chinese: `textLogoFit` at y 86, rising only above 90 tall, the English wordmark
  `logo(source, 1)` under it.
- The menu from y 222 (lower under a taller head):
  - plain: "Press any key" in the name role, blinking in hard steps between 7 × 7 gold gems,
    centred on y 244;
  - chooser (`destinations`): the prompt at 230, a plate (max(110, longest + 50) × 16 + growth)
    with ◀ ▶, then the key hint;
  - `menu: true`: G's recipe — the selected entry on a plate fading at both ends with the nudging
    gem cursor, each entry's `detail` under it, the key hints ↑ ↓ Choose · Space Start.
- Footer: group `bc` at 338, capitals, tracked 1.
- Language row: group `br` on the footer line (y 342.5) — an L keycap, then the labels as 12-dot
  bitmaps (the same on every page, whatever CJK face it loaded) on 13-tall plates with gold pips
  between them; the dots are `fpxFor(px) / px` art px (1 device px at 1280, 2 at 1920).
- Entrance: stepped opacity per layer; the divider opens in 8 steps; the embers rise 1 art px a
  step. The centred groups are scaled only when the art's own extents do not fit (`_fitGroups`):
  1024 × 768 and 1280 × 600 are reflowed, not scaled.
- **Loading screen**: a pixel ember gem (11), the name, a gilt bar 140 × 4, the label; `--px`
  approximated in CSS and `--fpx` = ⌈px / 2⌉. Each text moves to the UI fonts only once its
  characters' faces are loaded (the face status, never `check()`); before that Japanese and
  Chinese use system CJK faces (Yu Gothic or Meiryo, Microsoft YaHei). On ja / zh pages the static
  English texts are hidden (`#loading .is-pending`) until `src/main.js` writes them, at most 2.5 s.
  A Japanese title follows `rolesAt` (Noto Sans JP 700 at 24 px at px 2; DotGothic16 at 32 / 48 px
  with the name role's outline at px 3 / 4). The error page hides the bar; its ja / zh message is
  set in Noto.

**Combat** (`CombatHUD.js`, `BossBar.js`, `Announcer.js`, `DeathScreen.js`, `combat.css`)
- **Vitals**: a `tl` group at (10, 36) in English, 42–43 in CJK — under the place plate, the same
  in every state. A band at least 155 × 32; "Lv" in `tiny` over `numL`; HP / MP / SP bars 71 × 7 /
  7 / 6 with `scaleX` fills and a lag; the numbers in `num`; the XP bar (w − 22) × 2.
- **Skills**: a `br` group (500, 284, 140, 76): XS sockets 22 × 22 every 30 from x 518, y 306;
  keycaps at y + 17; the name in `line`; the veil 16 × 16 with a gold-dotted top edge; seconds in
  `big` ("0.8" under one second); the lock glyph and a "Lv N" plate at y − 5; the count ×N in
  `num`. At an odd px the English names and the keycaps' digits take G's 5-art-px cap in Jersey 15
  at one device px a font pixel (`slotNameFace`, `keyDigitFace`); the slots stay 30 apart unless
  their names need more (2 art px clear beyond the outlines). The bar and the purse dim to 0.55 in
  a dialogue; `is-tight` hides them where the dialogue window would overlap (below 632 art px:
  hidden at 1024 × 768, dimmed at 1280 and 1920).
- **Purse** at (x1 630, 290). **Loot feed**: 8 rows, each an 11-tall band with a 9 × 9 icon, every
  13 above the purse.
- **Boss bar**: a `bc` group, the bar at y 340, max(220, min(334, artW − 2 · 130)) × 11 centred
  (334 from 594 art px wide up: clear of the skill bar on a small screen), the cartouche 16 +
  growth tall, phase gems every 9; a long name is cut to keep room for the epithet and the gems.
  While it shows (and 600 ms after `hide()`) the root carries `lu-root--boss`: the legend steps
  aside.
- **Level-up card**: `tc`, its top at 48 when compact, 78 otherwise, 108 while the area banner
  shows (`announce(…, { y })`). **Results card**: an M window at y 96 (104 under a banner), the
  title in `head`, the line in `body`. A Japanese or Chinese gains line has the numbers' `ol8`
  outline (English keeps G's).
- **Death screen**: `mc`, fitted (`setGroupFit`); the vignette drawn at 2 art px a pixel; the
  title in `head` at twice its size, its ink centre at y 136; the divider at least 219 wide; the
  prompt at 228. The legend steps aside under it.

**World labels** (`WorldLabels.js`, `worldfx.css`: `.lu-worldfx`, world-anchored, no corner
shrink; the roles are `roles()`)
- **Numbers**: the ink centred on the anchor. `big` for a hit, a companion's hit, a heal, MP and
  the player's hurt; a crit Jersey 10 at twice the half-size font pixel (`numL`'s size at an even
  px, a 4 : 3 step over a hit at an odd one); `name` for the translated words Guard / Perfect!.
  G's `ol8` outline. Motion over 0.8 s: start 2 low, hop 1 up, then a 10-art-px stepped rise and a
  3-step fade. A crit and Perfect! pop for two frames at twice the size (the font size, not a
  scale).
- **Enemy bar**: 34 × 4, its bottom on the anchor, the fill quantised to the 32 inner art px.
- **Elite**: a gilt ring 38 × 8; above it "Lv" (`tiny`) + 2 + the level (`num`) + 4 + the NAME
  (tracked `small`; `line` with an art-px outline in CJK), the ink 3 above the ring, centred.
- **Pip**: a 7 × 7 ruby. **'!'**: 7 × 12 in ember.
- **Reticle**: G's four 14 × 14 brackets, corners 15 from a 7 × 7 ruby heart, stepping 1 art px
  every 0.7 s.
- **Edge arrows**: 17 × 17 octant cells 12 inside the border, at least 19 apart along it, with a
  nudge and a hot frame during a wind-up.
- **Keep-out**: the boxes are the drawn art and the role's line box at every step of the motion;
  a panel CSS hides (the legend under the boss bar or the death screen) does not count; the area
  banner's card counts while it shows (`PanelSpec.box`).

**Party** (`PartyFrames.js`, `PartyPanel.js`, `party.css`)
- **Party frames** (`.lu-pframes`, a `tl` group with `cornerShrink`): one strip per member, G's
  `partyFrame` — a band with a hairline, the member-colour gem, the NAME in small capitals (cut
  with an ellipsis when long), Lv and level, `sep()` class · tactic; HP 48 × 4 over MP 48 × 3 at
  (13, 12), the numbers from x 64. 22 tall (24 in CJK); 13 without bars (a peaceful level, a strip
  G does not draw, in the same family); compact 16 (18) with HP only. Placed at the left edge of
  `.lu-vitals` (combat) or `.lu-loc`, 4 under its bottom; the rows follow the text's real ink
  height at px 3. Down shows DOWN in red; low HP blinks the empty bar red; fighting blinks a bright
  gem; lost HP shows a pale chip for 0.35 s.
- **Tactics panel**: a centred L window (608 × 328 at (16, 20), up to 342 tall if the content
  needs it) on G's stepped veil; the HUD and the minimap hide under it. Left column (140 wide): the
  68-px portrait, the name (head, or two lines in the name role), the class icon, role · weapon,
  the help, PARTY n/3 with three 40-px slots, the note box. Right column from x 194: the 2 × 3
  preset cards and seven 19-px rule rows. The cards use the scale's line pitch (uniform, as G's,
  where they fit; else each row its own height). It reflows to `artW` / `artH` instead of being
  scaled: 480 wide at 1024 × 768 (no hint column: the note box shows the hint), the body
  scrolling on a short window. A rule hint cut in its row shows whole in the note box.

**Story UI** (`Journal.js`, `Emotes.js`, `EndCard.js`, `story.css`; letterbox and skip hint in
`UI.js`)
- **Journal**: the shared large window at the tactics panel's place (608 × 328 at (16, 20), anchored
  centre; 480 wide at 1024 × 768, shorter on a short screen) with crown, lattice and beads, over
  the tactics veil. The header line at y 37: JOURNAL in `head`, a gem, the tabs as small tracked
  capitals between Q and E keycaps (the chosen tab lit with an underline and a gem, a count plate
  on the quest tab), the gold (coin, `num`, G) on the Items tab, the key hints at the right; a dim
  rule at y 49. The list box x 30–246: section headings with counts, rows 16 tall (+ growth) on the
  selection band with the nudging cursor, marks gem / check / cross / key, failed quests struck
  through. The detail box x 266–600: the name in name capitals, the state in `small`, the text in
  `body`, pixel checkboxes, the log in `body`. Both boxes scroll with 2-px pixel scroll marks. An
  empty tab shows no columns: the tab's icon (a scroll, a chest) in engraved gold, its line in the
  name role and a hint in the line role, centred under the header.
- **Barks**: G's speech bubble painted to the text: the body role, at most 136 / 144 / 132 wide
  (en / ja / zh), lines starting on whole pixels and balanced; the bubble 4 inside the screen, its
  tail following the speaker; stepped motion. It keeps clear of a shown interaction prompt: lifted
  2 above it, or flipped under the speaker's feet (tail on top, `is-flipped`) when there is no room.
  A bark from before a conversation steps aside during it; one the conversation's script says
  (`is-indialog`) stays. **Emotes**: the existing 16 × 14 art at the root's `--px`, recoloured to
  G's cream.
- **End card**: a navy vignette in four hard steps; the title in `head` at 2× (1× and wrapped when
  wider than 560); the divider 219; the subtitle in gold name capitals; the text lines broken
  explicitly (strict CJK rules), centred, at most 400; "PRESS [Space] TO CONTINUE" between gems,
  blinking. On a screen under 640 art px wide it reflows (16 each side) rather than scaling.
- **Letterbox**: solid ink bars, 8 · round(artH · 0.11 / 8) tall, sliding in 8-px steps, with a
  1-art-px hairline on the inner edges.
- **Skip hint**: anchored bottom right, centred on the bottom bar: a 15 × 15 ring of 12 segments,
  then "Hold {key} to skip" with a keycap.

**The game layer** (Story integration, Game integration: `StoryRunner.js`, `dialogue.js`, `CampaignRuntime.js`,
`Game.js`, `src/main.js`) draws nothing; it hands the components translated text (§8.1):
- `Game.js` exports the helpers (I18N.md §4.8): `villagerName(npc)`, a villager's name plate (a
  term; `t('game.default.villager')` for a villager the level left without a name);
  `promptLabel(it)`, a built-in verb through `t('game.prompt.<id>')` first, else an exit's or
  event's own label by the key its object holds (`loc`); `speakerTitle(npc)`, a villager's data
  `title` by its key (`npc.def.titleKey`). Blank data falls back to the UI's `t('game.default.*')` strings. Legend rows are
  `{ keys, label, id }`.
- Script, conversation and shop lines carry `speaker` (a term: `villagerName(npc)`,
  `term(name)`), `sheet` (the villager's `npc.sheet.canvas`, a member's `sprite.sheet.canvas`, or
  an absent story actor's preset sheet, made once per preset and never uploaded) and `title` — a
  villager's data `title` by its key, `speakerTitle(npc)` (the preset-based titles
  from character presets are not used). A `choice` after a held line of the same speaker becomes that line's `ask`
  (STORY_SCRIPT.md).
- Toasts are whole sentences. Chapter, arrival and script banners, the end card and the title get
  translated titles and subtitles. A campaign's title gets `menu: true`: Continue (`detail` =
  `{place} · Lv {n} · h:mm:ss` — the region at the saved spot, else the level; Lv only once combat
  progress exists; the place alone without a play time), then New journey.
- The title screen gets `languages` (EN · 日本語 · 中文), `lang` and `onLanguage`. Identities
  (level, region and villager names, labels) stay English in data and state.

## 6. Maintenance workflow

1. Update the shared scale, palette, art or type helpers when a change applies across components.
2. Update the affected component and its string namespace; add translations for all three languages.
3. Check the component at small and large viewport sizes, including Japanese and Chinese text.
4. Run the relevant checks in §7 and update this contract and the module reference together.

## 7. Verification

- `npm run typecheck` stays at 0 errors.
- Every suite in docs/development/TESTING_AND_VERIFICATION.md passes in English.
- New suites, each with its own `--out`, cover:
  - `?lang=ja` and `?lang=zh` on the four screens G drew (explore, combat, tactics and title, on
    Cinderwatch Pass);
  - Emberfall dialogue;
  - the Ferryman's Lantern journal;
  - the fallback font path (`--fonts=local`, and a forced Google failure).
- `sandbox/ui_art.json`: every painter's hash matches the baseline `sandbox/ui_art.hashes.json`.
- The fingerprints (draw calls, programs) do not move: the UI is DOM.
- `npm run build`, `npm run docs:check`, and `npm run i18n:check` with no errors.

## 8. Component map

| Component | Files |
|---|---|
| HUD | `HUD.js`, `Banner.js`, `Fader.js`, `DebugPanel.js`, `hud.css`, `strings/hud.js` |
| Dialogue | `DialogBox.js`, `InteractPrompt.js`, `dialog.css`, `strings/dialog.js` |
| Maps | `Minimap.js`, `map.css`, `strings/map.js` |
| Title | `TitleScreen.js`, `title.css`, `game.html` (loading screen), `strings/title.js` |
| Combat UI | `CombatHUD.js`, `BossBar.js`, `Announcer.js`, `DeathScreen.js`, `combat.css`; the combat strings in `CombatSystem.js`, `PlayerCombat.js`, `Waystones.js`, `Chests.js`, `bindings.js`; `src/game/combat/strings.js` |
| World labels | `WorldLabels.js`, `worldfx.css`, `strings/worldfx.js` |
| Party UI | `PartyFrames.js`, `PartyPanel.js`, `party.css`, `src/game/party/Party.js` (strings, localised rules, portraits), `party/types.d.ts`, `src/game/party/strings.js`, `sandbox/party_ui.*` |
| Story UI | `Journal.js`, `Emotes.js`, `EndCard.js`, `story.css`, `UI.js` (letterbox, skip hint, the death prime's strings), `strings/story-ui.js` |
| Story integration | `StoryRunner.js`, `dialogue.js`, `CampaignRuntime.js`, `CampaignStart.js`; `src/game/story/strings.js`, `src/game/campaign/strings.js`; the content-text display sites there |
| Game integration | `Game.js`, `src/main.js`, `World.js`, `Weather.js`, `levels.js`, `Npc.js`; `strings/game.js`; the title's language switch (save + reload), `fontsReady` await, dialogue portraits, the content-text display sites there, `state()` / `__luminati` additions |
| Translators | `public/i18n/**` only |

Keep the component, its tests and its reference documentation in the same change. When a
shared helper changes, check each affected component and update its callers together.

## 8.1 Component interfaces

All additions are additive. Components and their callers share the following interfaces.

**Dialogue: DialogBox is called by the game, story and party systems.**
- `DialogLine` gains `sheet?: HTMLCanvasElement | null` and `title?: string`. `open()` takes them
  too, as defaults for every line.
  - `sheet` is the speaker's character-sheet canvas (`npc.sheet.canvas`, an actor's or member's
    sheet). DialogBox makes the portrait itself with `portraitCanvas`: G's crop, cached.
  - `title` is the speaker's small title next to the name plate. **Titles come only from data**:
    a villager's optional `title` field (an `npc` object's, [OBJECT_CATALOG.md](OBJECT_CATALOG.md);
    kind `title` for the translators), shown by the key its object holds (`speakerTitle(npc)`:
    `loc(npc.def.titleKey, title)`, I18N.md §4.8) — Sela's "Warden of the Cinderwatch". A villager without one has no title (the original titles from the character preset
    are gone).
  - `ask?: string` (produced by `StoryRunner`): the question under the speech
    (§5 Dialogue), typed after it. When `open()` continues a held window with the same speaker and
    text plus an `ask` or `choices`, the speech shows at once and only the question types.
    `StoryRunner` turns a `choice` that follows a held line of the same speaker into
    `{ ...heldLine, ask, choices }` (one window, not a new page).
  - With no `sheet` there is no portrait and the text starts at the left. With no speaker there is
    no plate either.
- Callers pass **translated** text: data by its key (`loc(key, text)`) or as a term (`term(name)`),
  code strings through `t()` (I18N.md §4.8).

**Title screen: the game and campaign runtime provide its content.**
- `show()` gains:
  - `languages?: { code, label }[]`, `lang?: string` and `onLanguage?: (code) => void`. The title
    draws a language row (EN · 日本語 · 中文) and calls `onLanguage` when the player picks
    another; the game saves the choice and reloads.
  - `menu?: boolean`, a vertical menu: ↑↓ cycle, confirm starts. Destination entries gain
    `detail?: string`, a second line such as the save line.
- `.lu-title__dest-label` stays on the selected entry's label.
- Callers pass translated `title`, `subtitle`, `prompt`, `credit` and labels. TitleScreen's own
  defaults come from `t('title.*')`.

**Campaign title options: CampaignRuntime provides them.**
- `CampaignRuntime.titleOptions()` passes `menu: true`.
- The Continue entry gets `detail`: the place, `Lv n` and the play time.
  - Play time is an additive field in the campaign save, counted while playing.
  - Without it, the detail is the place alone.

**Controls legend.**
- `HUD.setControls(rows)` rows are `{ keys, label, pad?, id? }`. Callers pass translated labels.
- The `id` is new and stable: tests find rows by `id` or by the English label in English.

**Prompt labels.** Callers translate before `ui.prompt.show(pos, label)`:
- built-in verbs through `t('game.prompt.<id>')`;
- an exit's or event's own label by the key its object holds,
  `loc(textKeyOf(it.object, 'label'), label)`. `promptLabel(it)` (Game.js) asks for a built-in verb
  first: a data label that is one (the catalog's `Enter`) is shown as the UI string.

**World map and HUD names.** The game translates names at display, before calling
`setLocation`, `banner.show`, `worldMap.setMap`, `setRegion` and the title. The components render
what they get.

**Death screen.**
- `CombatSystem` registers the `combat` namespace in its constructor, before it calls
  `ui.enableCombat()`.
- In `UI.js`, `enableCombat()` primes the death screen with
  `t('combat.death.title')` and `t('combat.death.prompt', …)`.

**Boss bar and the legend (combat UI).** `BossBar` sets the root class `lu-root--boss`
from `show()` until 600 ms after `hide()` (at once on `dispose()`); `combat.css` hides the controls
legend under it and under `lu-root--death`, and `WorldLabels` stops counting a panel CSS hides.
The legend also stays aside while the boss's results card shows (`Announcer` sets
`lu-root--results`; the card outlasts the bar by 5 s), and the boss bar's keep-out zone never
merges with the skill bar's (`PanelSpec.merge: false`, KNOWN_ISSUES UI-25).

**Feature string tables.**
- `src/game/combat/strings.js`: registered by `CombatSystem`.
- `src/game/party/strings.js`: registered by the `Party` constructor and by `partyUIClasses()`
  (`src/game/party/partyUI.js`).
- `src/game/story/strings.js`: registered by `StoryRunner`.
- `src/game/campaign/strings.js`: registered by `CampaignRuntime`.
- `src/engine/i18n/strings/worldfx.js`: registered by `WorldLabels`.
- `src/engine/i18n/strings/story-ui.js`: registered by the story UI's constructors (`Journal`,
  `EndCard`, made by `UI.useStoryUI`).
- `src/engine/i18n/strings/dialog.js`: a core table, also registered by `DialogBox` and
  `InteractPrompt` when a page made them without a root.

**Content tables.**
- The game calls `loadContentTables(lang, campaign ? { campaign, tables } : { source, level, tables })`
  in `boot()` (`src/main.js`; `tables`: a play-test's `&i18n=`), before `new Game`, and awaits
  it. English fetches nothing.
- `dialogue.js` translates its lines with `loc('dlg.<conversation>.<name>', 'English')`, units
  of `common` (I18N.md §4.8).

**Shared sandbox files** (`sandbox/ui.js`, `ui.actions.json`, `ui.combat.actions.json`)
exercise several components together. Update their affected assertions alongside a UI change.

## 9. Deviations

These notes explain implementation choices that refine the original UI design. The component
recipes above and the code define current behavior.

| # | Where | Deviation | Why |
|---|---|---|---|
| D1 | Scale (§1.2) | `fpx = ⌈px / 2⌉`, not ⌊px / 2⌋: at px 3 the half-size text is ⅔ of an art px a font pixel, 1.33× G. | The nearer whole size; the floor (0.67× G) inverted the type hierarchy. |
| D2 | Scale (§1.2) | Below 1280 × 720 nothing shrinks while it fits: the corners only below 512 × 300 art px, a centred group only when it does not fit; the dialogue, title, journal, tactics panel, end card and world map reflow instead. | 1024 × 768 stays crisp ('Lv' read wrongly at shrink 0.8). |
| D3 | Type (§4) | Japanese names and dialogue are Noto Sans JP (700 / 500) at px 2, DotGothic16 only on its 16-dot grid (32 px at px 3, 48 at px 4). G's own ja screens rebuilt on the kit therefore differed from G's page at px 2. | DotGothic16 at 24 px closes the dakuten up (バ read パ). |
| D4 | Type (§4) | The Japanese heading's bitmap bold is half a dot (`--fpx`); the names have none. | A whole-dot copy fills the gap of ゛. |
| D5 | Type (§4) | CJK text with paired full-width punctuation is measured in the DOM, not with canvas `measureText`. | Chrome's `halt` and spacing trim differ by face; canvas sees neither (KNOWN_ISSUES I18N-07). |
| D6 | Debug panel | Rows, numbers, colour codes and buttons are Jersey 10 at the line role's size (not Jersey 15); folder titles are G's Tiny5 section headings. | Jersey 15 is sharp only at 27 px (15-px caps), too big for a 20-px row and a 64-art-px name column. |
| D7 | Toasts | The stack stays on the screen's centre line (the banner's axis) and moves only as far as it must, rather than centring in the span the corner panels leave. | Centring in the free span put it about 20 art px off the banner's axis. |
| D8 | Dialogue | The ▼ mark is hidden while choices are open (G draws it). | It reads as "press to continue". |
| D9 | Dialogue | On a narrow screen the window narrows (at least 240 wide) instead of shrinking with the corner groups. | Its text keeps its art pixels and filters. |
| D10 | Dialogue | Speaker titles come only from data (an `npc`'s `title`, §8.1); the original titles named from the character preset (Innkeeper …) are gone. | A preset is a look, not a job: Odo the quartermaster read 'Guard', Mayor Aldous 'Elder'; talks run by the story had no title at all. |
| D11 | World map | Region names in Japanese and Chinese are set in the `small` role, not `name`. | The CJK `name` role is 1.5× the English capitals and covered the map. |
| D12 | World map | The image is the painted map resampled to art pixels, not G's flat tile map; G has no world-map screen, so it follows the tactics panel's family. The markers are drawn over the names. | A campaign's overview is a composite canvas: the painted map is the one source every map has. |
| D13 | Minimap | The view stays about 34 world units (2 art px a unit in the 70-px window); the level's buildings, bridges, trees, wells and windmill are drawn flat on G's tiles. | With tiles alone Emberfall's houses vanished and Cinderwatch's bridge was missing. |
| D14 | Title | The language row has its own key (L, pad LB / RB) and a pointer click, not a menu entry; the language names are 12-dot bitmaps on every page. | No menu on a plain title; an English page loads no CJK face. |
| D15 | Loading screen | Before the fonts are in, Japanese and Chinese texts use system CJK faces (Yu Gothic or Meiryo, Microsoft YaHei), never "Noto Sans JP / SC" (the page declares those names: a text would wait invisible). Latin in a Japanese loading title is set in Noto or DotGothic16, not Jersey. | Nothing blank while the fonts load. |
| D16 | Combat | At an odd px the English skill names and keycap digits take G's 5-art-px cap (Jersey 15 at one device px a font pixel); a crit is Jersey 10 at 2 · fpx (a 4 : 3 step over a hit). | At px 3 'Radiant' ran into 'Healing', a digit outgrew its keycap, and a crit was the size of a hit. |
| D17 | Combat | The boss bar narrows on small screens (max(220, min(334, artW − 260))). | It ran under the skill bar at 1024 × 768. |
| D18 | Combat | A Japanese or Chinese gains line (level-up card) has the `ol8` outline of one art px; English keeps G's. | G's `ol` is one device px for anti-aliased CJK text, unreadable over a pale bubble or the sky. |
| D19 | Combat | The controls legend steps aside under the boss bar (`lu-root--boss`), the results card (`lu-root--results`) and the death screen. | G's combat screen has no legend; it ran under the cartouche and the bar. |
| D20 | Combat | The results card has no stats chips. | Optional in G. |
| D21 | Party | The tactics panel's note box shows the focused row's help (and, on a narrow window or for a cut row, the rule's hint), not G's presets note. | The tests and the keyboard path rely on it; the hint must be readable whole. |
| D22 | Party | A peaceful level's party frame (no bars: gem, name, class · tactic) is designed in G's family; G draws none. | — |
| D23 | Story UI | The journal is named 日誌 (ja) / 日志 (zh), not ジャーナル. | The settled glossary term (I18N_GLOSSARY.md). |
| D24 | Story UI | Emotes are drawn at the root's `--px` (2 up to 1919 px wide): smaller than the old private scale of 3–4. | One scale for every world-anchored layer. |
| D25 | Game layer | The code defaults standing in for blank data are UI strings: 'The End' (`story.ending.default`), 'The way is closed.' (`campaign.exit.closed`), 'Press any key' and the credit line (`game.default.prompt`, `game.default.credit`). 'Untitled campaign', the name boot writes into a campaign without one, is a common term (`term`). | Content text is keyed by the key the data holds beside it (I18N.md §4.2); a default has no place in the data, so translators get it once, as UI vocabulary. The original implementation sent these through `tc()` as content. |
| D26 | World labels | The text's edge filter is painted inside the moving layer (an inner `.lu-num__x`), against ui.md's old "no filter on moving layers". | Crisp pixel numbers at every step of the motion. |
| D27 | Game layer | The game layer's helpers of §5's first text, `shown(text, kind)` and `promptLabel(label)`, are gone. `Game.js` exports `villagerName(npc)`, `promptLabel(it)` (a built-in verb first) and `speakerTitle(npc)`, which look data up by the key its object holds, or as a term. (Until the text keys moved into the data, the last two also took the scope of the file the object came from.) | Content text keyed in the data (I18N.md §4.2): a lookup needs the object and its field, not only the English. |
