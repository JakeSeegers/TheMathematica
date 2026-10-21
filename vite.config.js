import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import levelApi from './tools/vite-level-api.js';
import launcher from './tools/vite-launcher.js';

/**
 * Combat-only engine modules (enemy sheets, the FX atlas, FX batches, combat UI). They have no
 * import side effects, so they are marked pure: a chunk that uses none of their exports leaves them
 * out even though the engine barrel re-exports them — peaceful levels and the editor fetch them
 * only through the combat chunk that imports them from their files (KNOWN_ISSUES COMBAT-17).
 * The pixel UI's combat art (ui/art/combat.js: the boss bar, the reticle's brackets; ui/art/icons/
 * combat.js: the skill and loot icons) is combat-only too (docs/specs/PIXEL_UI.md §1.6).
 */
const COMBAT_PURE = /[\\/]src[\\/]engine[\\/](?:fx[\\/](?:FxQuads|GroundMarkers)|pixel[\\/](?:MonsterSprites|FxSprites)|ui[\\/](?:CombatHUD|BossBar|WorldLabels|Announcer|DeathScreen|art[\\/](?:combat|icons[\\/]combat)))\.js$/;

/**
 * Story-only modules: the UI (the journal, emote bubbles, end card; they import story.css) and the
 * script parser (level/StoryScript.js). Neither the engine barrel nor UI.js imports the UI ones (the
 * caller hands them to `ui.useStoryUI`); marked pure all the same, so a re-export can never pull
 * them or their CSS into a level without a story. StoryScript.js re-exports the small condition
 * module (level/StoryCondition.js): marked pure, a file that imports only those re-exports from it
 * (`cachedCondition`, `isFlagName` …) gets StoryCondition.js alone — the parser stays in the chunk
 * of the story runtime, not in what game.html preloads.
 */
const STORY_PURE = /[\\/]src[\\/]engine[\\/](?:ui[\\/](?:Journal|Emotes|EndCard)|level[\\/]StoryScript)\.js$/;

/**
 * Party-only UI modules (docs/specs/PARTY.md §6): the tactics panel and the HUD frames (they import
 * party.css). Neither the engine barrel nor UI.js imports them (the party chunk hands them to
 * `ui.usePartyUI`); marked pure like the story UI, so a re-export can never pull them or their CSS
 * into a game nobody joins. The pixel UI's party art (ui/art/party.js: the rule pips; ui/art/icons/
 * party.js: the rule, preset and class icons) is party-only too.
 */
const PARTY_PURE = /[\\/]src[\\/]engine[\\/]ui[\\/](?:PartyPanel|PartyFrames|art[\\/](?:party|icons[\\/]party))\.js$/;

/**
 * The @fontsource stylesheets list a woff2 and a woff file per face; every browser that runs
 * three.js r186 reads woff2, so the woff fallbacks are cut from the CSS before Vite resolves its
 * url()s: the build emits woff2 files only (about half the files and bytes). The fonts are loaded by
 * src/engine/ui/FontLoader.js — from Google Fonts first, these built copies only when that fails
 * (docs/specs/I18N.md §5).
 * @returns {import('vite').Plugin}
 */
function fontsourceWoff2Only() {
  return {
    name: 'fontsource-woff2-only',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]@fontsource[\\/].*\.css(?:\?.*)?$/.test(id)) return null;
      let out = code.replace(/,\s*url\([^)]*\.woff\)\s*format\(['"]woff['"]\)/g, '');
      // the pixel UI's faces block like Google's (`display=block`): a CJK slice that arrives late
      // shows nothing for a moment rather than a fallback face that then jumps (the old faces keep swap)
      if (/[\\/]@fontsource[\\/](?:jersey-10|jersey-15|tiny5|dotgothic16|noto-sans-jp|noto-sans-sc)[\\/]/.test(id)) out = out.replace(/font-display:\s*swap/g, 'font-display: block');
      return { code: out, map: null };
    },
  };
}

/**
 * A sub-path given without its trailing slash (`--base=/project`): Vite serves under `/project/`
 * but hands the pages `BASE_URL` `/project`, so `${BASE_URL}levels/…` would ask `/projectlevels/…`
 * and the level API (mounted at `/project/api/…`) would never answer. The base always ends with '/'
 * here, before Vite resolves it (the relative './' stays as it is).
 * @returns {import('vite').Plugin}
 */
function baseWithSlash() {
  return {
    name: 'base-with-slash',
    config(config) {
      const base = config.base;
      return typeof base === 'string' && base.startsWith('/') && !base.endsWith('/') ? { base: `${base}/` } : null;
    },
  };
}

export default defineConfig({
  // base './' — the build's URLs are relative (`./assets/…`; chunks and CSS load from the chunk that
  // imports them; BASE_URL is './', so the pages fetch `./levels/…` from their own folder): the same
  // dist/ works at the site root and under any sub-path (`https://example.com/luminati/`). The dev
  // server serves at '/' (`npm run dev -- --base=/project/` under a sub-path); the check harness's
  // --base and --dist check that nothing loads from the site root.
  base: './',
  plugins: [baseWithSlash(), fontsourceWoff2Only(), levelApi(), launcher()],
  // cors: false — Vite's default grants Access-Control-Allow-Origin to every localhost /
  // 127.0.0.1 / [::1] origin, which lets pages on other local ports read the served files.
  // watch.ignored — the file watcher walks the whole root at startup; the harness output in .check/
  // (gigabytes of screenshots) stalled module serving by seconds, which inflated every cold loadMs.
  server: { host: '127.0.0.1', port: 5173, cors: false, watch: { ignored: ['**/.check/**', '**/dist/**'] } },
  preview: { cors: false },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        // the launcher (the list of campaigns and levels: tools/vite-launcher.js), the game, the editor
        launcher: resolve(import.meta.dirname, 'index.html'),
        game: resolve(import.meta.dirname, 'game.html'),
        editor: resolve(import.meta.dirname, 'editor.html'),
      },
      treeshake: { moduleSideEffects: (id) => !COMBAT_PURE.test(id) && !STORY_PURE.test(id) && !PARTY_PURE.test(id) },
    },
  },
});
