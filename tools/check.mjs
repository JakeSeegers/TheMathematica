#!/usr/bin/env node
/**
 * Headless browser check harness.
 *
 * Starts a Vite dev server (--dist: `vite preview` on dist/), opens a page in headless Chrome (real GPU when available),
 * collects console errors / warnings / page errors / failed requests, runs an optional
 * action script, measures FPS and writes screenshots + a JSON report.
 *
 * Usage:
 *   npm run check -- [--page=game.html] [--query=autostart=1] [--out=name]
 *                    [--wait=4000] [--width=1600] [--height=900]
 *                    [--script=path/to/actions.json] [--fps=3000] [--headful] [--keep-cache] [--strict]
 *                    [--fonts=local|google|auto|google-fail|gstatic-fail] [--lang=en|ja|zh]
 *                    [--base=project] [--dist]
 *
 * --base serves the project under a sub-path (Vite's `base`, slashes added: --base=project is
 * /project/, the page opens at http://127.0.0.1:<port>/project/<page>; in Git Bash write it without
 * the slashes, which MSYS would turn into a Windows path) — the check that nothing loads from the
 * site root. `goto`
 * steps resolve under it too; root paths an `eval` step writes itself (`import('/sandbox/…')`,
 * `fetch('/levels/…')`) do not, so the action scripts that use them run without --base.
 * --dist checks the build instead of the sources: dist/ served by `vite preview` (run
 * `npm run build` first; index.html, game.html and editor.html only, no level API). With --base it is the build
 * deployed under a sub-path: the build's URLs are relative (`base: './'` in vite.config.js), so the
 * same dist/ works at any path.
 *
 * Fonts and language (docs/specs/I18N.md §1, §5): --fonts (default local) and --lang (default: none,
 * i.e. English) are written into the page origin's localStorage ('luminati.fonts', 'luminati.lang') before
 * its first script runs, once per run (page.evaluateOnNewDocument with a seeded marker), so `goto`
 * steps and tabs the page opens (the editor's play-test pop-up) inherit them and a page that saves
 * another language keeps it. local: the fonts built into dist/ (screenshots do not depend on the
 * network or on Google's newer CJK builds); google / auto: Google Fonts (auto falls back to dist/);
 * google-fail / gstatic-fail: Google's stylesheet / font files made unreachable, so the fallback
 * runs (a failed request and a console error are expected then).
 *
 * Exit code: 1 on page errors (uncaught exceptions in any watched tab, a step the harness could not
 * run: `HARNESS: …`), 2 when no Chrome / Edge is found (or an option is invalid, or --dist finds no
 * dist/<page>), else 0. Console errors, warnings, failed
 * requests and `eval` steps that throw are printed and kept in report.json but do not fail the run —
 * unless --strict is given: then any of them also exits 1 (the reasons are printed as `Strict:` and
 * kept in report.json `strictFailures`). Console errors about the favicon and plain 404s are not
 * counted as errors (the 404 response itself is a failed request). Before the browser closes every
 * open tab is given a macrotask, a frame and 250 ms, so an assertion the last step throws from a
 * `setTimeout` (TESTING_AND_VERIFICATION.md §5.3) is still a page error.
 *
 * Each run gets its own Vite dependency cache, node_modules/.vite-check/<out>-<pid>, and deletes it
 * when it ends — also after a failure, an uncaught error or Ctrl+C (only a hard-killed process
 * leaves one behind; delete node_modules/.vite-check/ any time no check is running). A warm cache
 * saves under a second per run. --keep-cache keeps the old behaviour: one cache per --out name,
 * node_modules/.vite-check/<out>, kept and reused by the next run with the same --out.
 *
 * Action script: JSON array of steps, executed in order after the initial wait:
 *   { "wait": 1000 }                         sleep ms
 *   { "key": "KeyW", "hold": 800 }           hold a key (KeyboardEvent.code) for ms
 *   { "press": "Space" }                     tap a key
 *   { "eval": "window.__game.setTime(21)" }  run JS in page (result logged)
 *   { "shot": "night" }                      save screenshot .check/<out>/<name>.png
 *   { "fps": 2000, "label": "night" }        measure fps over ms
 *   { "click": [x, y], "button"?, "count"? }  mouse click at viewport coords ('left'|'right'|'middle')
 *   { "dblclick": [x, y] }                   double click
 *   { "move": [x, y], "steps"? }             move the mouse (hover)
 *   { "mouse": "down"|"up", "button"? }      press / release at the current mouse position
 *   { "drag": [[x0,y0], [x1,y1], ...], "button"?, "steps"?, "pause"?, "modifiers"?: ["Shift"] }
 *                                            real mouse drag through the points
 *   { "wheel": [x, y], "deltaY": -240 }      mouse wheel at a point
 *   { "type": "text", "selector"? }          type text (selector: triple-click that field first)
 *   { "combo": ["Control", "KeyZ"] }         key chord (hold all but the last key)
 *   { "goto": "editor.html?open=x" }         navigate (relative to the server's base)
 *   { "tab": "last" | 0, "timeout"?: 10000 } continue in another tab. "last": the newest tab; when
 *                                            that is the current one, the step first waits up to
 *                                            `timeout` ms for a new tab to open (e.g. right after
 *                                            the editor's Play / F5, which opens the named window
 *                                            `luminati-playtest`) and fails (page error) if none
 *                                            does. A number: tab n of the browser's list (0 is the
 *                                            launch's about:blank, 1 the checked page), waited for
 *                                            up to `timeout` ms. A tab opened during the run is
 *                                            then given up to `timeout` ms to finish loading. The
 *                                            switch is logged in `evals` as `tab …` with the URL.
 *                                            (Loading the play-test in the same tab also works:
 *                                            { "goto": "game.html?level=local:__playtest__&autostart=1" }.)
 *
 * The coordinates of click, dblclick, move, wheel and drag may also be a string: a JS expression
 * evaluated in the page whose value (or its JSON text) gives them, so a script can aim at world
 * points instead of fixed pixels, e.g. with sandbox/editor_perf.helpers.js installed:
 *   { "drag": "P.path('2d', [[30, 30], [31.5, 30.5]])", "steps": 3 }
 *
 * Output: .check/<out>/report.json, .check/<out>/*.png (exit codes: see above).
 */
import { createServer, preview } from 'vite';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @import { KeyInput, MouseButton, Page } from 'puppeteer-core' */

/**
 * One action-script step (the format in the header). A step does what the first of these keys it
 * has says, in this order: wait, key, press, eval, shot, fps, click, dblclick, move, mouse, drag,
 * wheel, type, combo, goto, tab; the other keys are that action's options.
 * @typedef {object} Step
 * @property {number} [wait] sleep (ms)
 * @property {KeyInput} [key] hold a key (KeyboardEvent.code) for `hold` ms (300)
 * @property {number} [hold]
 * @property {KeyInput} [press] tap a key
 * @property {string} [eval] JS run in the page (result or error logged in the report)
 * @property {string} [shot] screenshot name (.check/<out>/<name>.png)
 * @property {number} [fps] measure fps over this many ms, as `label`
 * @property {string} [label]
 * @property {Point|string} [click] click at viewport coordinates (`button`, `count` presses); a
 *   string: a JS expression giving them in the page (as for every coordinate below)
 * @property {MouseButton} [button] click / mouse / drag button ('left')
 * @property {number} [count]
 * @property {Point|string} [dblclick]
 * @property {Point|string} [move] move the mouse there in `steps` moves (1)
 * @property {number} [steps] drag: moves per segment (8)
 * @property {'down'|'up'} [mouse] press / release at the current mouse position
 * @property {Point[]|string} [drag] drag through the points, `pause` ms after each segment
 * @property {number} [pause]
 * @property {KeyInput[]} [modifiers] drag: keys held during the drag
 * @property {Point|string} [wheel] wheel at a point by `deltaY` (-240)
 * @property {number} [deltaY]
 * @property {string} [type] text to type (`selector`: triple-click that field first; `delay` 10 ms)
 * @property {string} [selector]
 * @property {number} [delay]
 * @property {KeyInput[]} [combo] hold all but the last key, tap the last
 * @property {string} [goto] navigate (relative to the dev server, or an http URL)
 * @property {'last'|number} [tab] continue in the newest tab (waiting for a new one when the
 *   newest is the current tab) or in tab n
 * @property {number} [timeout] tab: ms to wait for the tab and for it to load (10000)
 */

/** Viewport coordinates (CSS pixels). @typedef {[number, number]} Point */

/**
 * One fps measurement (`label` added by the caller).
 * @typedef {{ fps: number, p50ms: number, p95ms: number }} FpsSample
 */

/**
 * What .check/<out>/report.json holds.
 * @typedef {object} Report
 * @property {string} page
 * @property {string} query
 * @property {{ type: string, text: string }[]} console every console message
 * @property {string[]} errors console errors (favicon / 404 noise left out)
 * @property {string[]} warnings
 * @property {string[]} pageErrors uncaught page errors, and `HARNESS: …` when a step threw
 * @property {string[]} failedRequests
 * @property {{ code: string, result?: unknown, error?: string }[]} evals eval steps, tab switches
 * @property {({ label: string } & FpsSample)[]} fps
 * @property {string[]} shots screenshot paths relative to the repository
 * @property {string|null} gl the WebGL2 renderer string ('NO WEBGL2' without WebGL2)
 * @property {boolean} strict the run had --strict
 * @property {string[]} strictFailures with --strict: why it exits 1 besides page errors
 *   ("2 console errors", "1 eval step threw" …); empty otherwise
 * @property {string} fonts the --fonts mode seeded into the page ('local' by default)
 * @property {string|null} lang the --lang seeded into the page (null: none, English)
 * @property {string} base the sub-path the project was served under (--base; '/' without one)
 * @property {boolean} dist the build in dist/ was checked (--dist), not the sources
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));

const pagePath = String(args.page ?? 'game.html').replace(/^\//, '');
const query = args.query !== undefined ? String(args.query) : 'autostart=1';
const outName = String(args.out ?? path.basename(pagePath, '.html'));
const outDir = path.join(root, '.check', outName);
const width = Number(args.width ?? 1600);
const height = Number(args.height ?? 900);
const initialWait = Number(args.wait ?? 4000);
const fpsWindow = Number(args.fps ?? 3000);
// --strict (or --strict=1 / true): console errors, warnings, failed requests and throwing evals fail too
const strict = args.strict !== undefined && !/^(0|false|no|off)$/i.test(String(args.strict));
// --fonts / --lang: the font source and the language seeded into the page's localStorage (header)
const FONT_MODES = ['auto', 'google', 'local', 'google-fail', 'gstatic-fail'];
const fontsMode = String(args.fonts ?? 'local').toLowerCase();
if (!FONT_MODES.includes(fontsMode)) { console.error(`--fonts must be one of ${FONT_MODES.join(', ')}`); process.exit(2); }
// --base: the sub-path the server serves the project under (none: the site root); slashes added,
// so `--base=project` is /project/ — the spelling Git Bash leaves alone (it rewrites an argument
// `/project/` into `C:/Program Files/Git/project/`, refused here)
if (args.base === true || /^[a-z]:[\\/]|\\/i.test(String(args.base ?? ''))) {
  console.error(`--base must be a URL path such as /project/ or project, not ${args.base === true ? 'empty' : `"${args.base}"`} (in Git Bash write --base=project or prefix MSYS_NO_PATHCONV=1)`);
  process.exit(2);
}
const baseArg = args.base !== undefined ? `/${String(args.base).split('/').filter(Boolean).join('/')}/`.replace(/^\/\/$/, '/') : null;
// --dist: the build in dist/ through `vite preview` instead of the dev server (header)
const dist = args.dist !== undefined && !/^(0|false|no|off)$/i.test(String(args.dist));
const langArg = args.lang !== undefined ? String(args.lang).toLowerCase() : null;
if (langArg !== null && !['en', 'ja', 'zh'].includes(langArg)) { console.error('--lang must be en, ja or zh'); process.exit(2); }
/** @type {Step[]} */
const script = args.script ? JSON.parse(fs.readFileSync(path.resolve(root, String(args.script)), 'utf8')) : [];

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);
const executablePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!executablePath) { console.error('No Chrome/Edge found; set CHROME_PATH'); process.exit(2); }

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (f.endsWith('.png') || f === 'report.json') fs.rmSync(path.join(outDir, f));

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** @type {Report} */
const report = { page: pagePath, query, console: [], errors: [], warnings: [], pageErrors: [], failedRequests: [], evals: [], fps: [], shots: [], gl: null, strict, strictFailures: [], fonts: fontsMode, lang: langArg, base: baseArg ?? '/', dist };

const port = 5200 + Math.floor(Math.random() * 700);
// A separate dep-optimizer cache per run lets several checks run concurrently without racing, and
// deleting it at the end keeps node_modules/.vite-check/ from growing by ~5–20 MB per run (it had
// reached 36 GB). --keep-cache: one cache per --out name, kept for the next run with that name.
const keepCache = Boolean(args['keep-cache']);
const cacheName = outName.replace(/[^\w-]/g, '_') + (keepCache ? '' : `-${process.pid}`);
const cacheDir = path.join(root, 'node_modules', '.vite-check', cacheName);
/** Delete this run's cache (synchronous, so it also works from the 'exit' handler); idempotent. */
const removeCache = () => {
  if (keepCache) return;
  try {
    fs.rmSync(cacheDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch (e) {
    console.warn(`Could not delete the Vite cache ${cacheDir}: ${e?.message ?? e}`);
  }
};
// every way out: process.exit / the end of the script, an uncaught error, Ctrl+C (SIGINT and the
// others exit without 'exit' handlers by default, so turn them into a normal exit first)
process.on('exit', removeCache);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) process.once(sig, () => process.exit(130));

/** @type {import('vite').ViteDevServer | import('vite').PreviewServer} */
let server;
if (dist) {
  if (!fs.existsSync(path.join(root, 'dist', pagePath))) { console.error(`--dist: no dist/${pagePath} (run npm run build first)`); process.exit(2); }
  server = await preview({
    root, logLevel: 'error', configFile: path.join(root, 'vite.config.js'),
    ...(baseArg ? { base: baseArg } : {}),
    preview: { port, strictPort: false, host: '127.0.0.1' },
  });
} else {
  const dev = await createServer({
    root, cacheDir, logLevel: 'error', configFile: path.join(root, 'vite.config.js'),
    ...(baseArg ? { base: baseArg } : {}),
    server: { port, strictPort: false, host: '127.0.0.1', hmr: false },
  });
  await dev.listen();
  server = dev;
}
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const url = `${base}/${pagePath}${query ? `?${query}` : ''}`;

const browser = await puppeteer.launch({
  executablePath,
  // @ts-expect-error puppeteer ≥ 22 types drop 'new'; it still runs as true (--headless=new)
  headless: args.headful ? false : 'new',
  args: [
    `--window-size=${width},${height}`,
    '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl', '--use-angle=d3d11',
    '--autoplay-policy=no-user-gesture-required', '--no-first-run', '--no-default-browser-check',
  ],
  defaultViewport: { width, height },
});

let exitCode = 0;
/** @type {Set<Page>} the tabs watched for output and errors (settled before the browser closes) */
const watched = new Set();

/**
 * Let what the script's last step scheduled run before the browser closes: an assertion thrown
 * from a `setTimeout` (TESTING_AND_VERIFICATION §5.3) is reported as a page error only once that
 * timer has fired and its `pageerror` event has reached the harness. In each open watched tab: a
 * macrotask, then a frame (or 100 ms, a tab in the background draws none; 3 s at most for a busy
 * page), then 250 ms for the events to arrive.
 */
const settle = async () => {
  const open = [...watched].filter((p) => !p.isClosed());
  await Promise.all(open.map((p) => Promise.race([
    p.evaluate(() => new Promise((resolve) => {
      setTimeout(() => {
        requestAnimationFrame(() => setTimeout(resolve, 0));
        setTimeout(resolve, 100);
      }, 0);
    })).catch(() => {}),
    sleep(3000),
  ])));
  await sleep(250);
};

try {
  /** @param {Page|null} p a tab to collect console output, errors and failed requests from */
  const watch = (p) => {
    if (!p || watched.has(p)) return;
    watched.add(p);
    p.on('console', (msg) => {
      /** @type {{ type: string, text: string }} (older puppeteer reported 'warning') */
      const entry = { type: msg.type(), text: msg.text() };
      report.console.push(entry);
      if (entry.type === 'error' && !/favicon|status of 404 \(Not Found\)/.test(entry.text)) report.errors.push(entry.text);
      if (entry.type === 'warn' || entry.type === 'warning') report.warnings.push(entry.text);
    });
    // puppeteer types the payload `Error | unknown` (anything thrown); ?. and ?? cover non-Errors
    p.on('pageerror', (err) => report.pageErrors.push(String(/** @type {Error} */ (err)?.stack ?? err)));
    p.on('requestfailed', (req) => report.failedRequests.push(`${req.url()} ${req.failure()?.errorText}`));
    p.on('response', (res) => { if (res.status() >= 400 && !res.url().endsWith('/favicon.ico')) report.failedRequests.push(`${res.url()} HTTP ${res.status()}`); });
  };
  let page = await browser.newPage();
  watch(page);
  // the font source and the language, in the origin's storage before the first script runs — once,
  // so a page that saves another language (the title's switch) keeps it after its reload
  await page.evaluateOnNewDocument((fonts, lang) => {
    try {
      if (localStorage.getItem('luminati.check.seeded')) return;
      localStorage.setItem('luminati.fonts', fonts);
      if (lang) localStorage.setItem('luminati.lang', lang);
      localStorage.setItem('luminati.check.seeded', '1');
    } catch { /* about:blank, storage off */ }
  }, fontsMode, langArg);
  // tabs the page opens (the editor's Play button) are watched from their first request
  browser.on('targetcreated', async (t) => { if (t.type() === 'page') watch(await t.page().catch(() => null)); });
  // the launch's about:blank and the checked page: a `tab` step waits for any other tab to load
  const initialPages = new Set(await browser.pages());

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  report.gl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return 'NO WEBGL2';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  await sleep(initialWait);

  /**
   * Frame rate and frame-time percentiles over `ms`, from requestAnimationFrame in the page.
   * @param {number} ms
   * @returns {Promise<FpsSample>}
   */
  const measureFps = async (ms) => page.evaluate((ms) => new Promise((resolve) => {
    let frames = 0; const t0 = performance.now(); const times = []; let last = t0;
    const tick = (t) => {
      frames++; times.push(t - last); last = t;
      if (t - t0 < ms) { requestAnimationFrame(tick); return; }
      times.sort((a, b) => a - b);
      resolve({ fps: +(frames * 1000 / (t - t0)).toFixed(1), p50ms: +times[Math.floor(times.length * 0.5)].toFixed(2), p95ms: +times[Math.floor(times.length * 0.95)].toFixed(2) });
    };
    requestAnimationFrame(tick);
  }), ms);

  /** @param {string} name screenshot file name (.check/<out>/<name>.png) */
  const shot = async (name) => {
    const file = path.join(outDir, `${name}.png`);
    await page.screenshot({ path: file });
    report.shots.push(path.relative(root, file).replace(/\\/g, '/'));
  };

  /**
   * A step's coordinates: as written, or — a string — the value of that JS expression in the
   * current page (an array, or its JSON text).
   * @template T
   * @param {T|string} v
   * @returns {Promise<T>}
   */
  const coords = async (v) => {
    if (typeof v !== 'string') return v;
    const r = await page.evaluate(v);
    return /** @type {T} */ (typeof r === 'string' ? JSON.parse(r) : r);
  };

  /**
   * Wait (up to `ms`) until a tab opened during the run has navigated away from its first
   * about:blank and finished loading; false if it has not by then (the step goes on).
   * @param {Page} p
   * @param {number} ms
   * @returns {Promise<boolean>}
   */
  const loaded = async (p, ms) => {
    const t0 = Date.now();
    for (;;) {
      try {
        if (p.url() !== 'about:blank' && (await p.evaluate(() => document.readyState)) === 'complete') return true;
      } catch { /* (navigating: the context went away) */ }
      if (Date.now() - t0 >= ms) return false;
      await sleep(100);
    }
  };

  await shot('initial');
  if (fpsWindow > 0) report.fps.push({ label: 'initial', ...(await measureFps(fpsWindow)) });

  for (const step of script) {
    if (step.wait) await sleep(step.wait);
    else if (step.key) { await page.keyboard.down(step.key); await sleep(step.hold ?? 300); await page.keyboard.up(step.key); }
    else if (step.press) await page.keyboard.press(step.press);
    else if (step.eval) {
      try { const r = await page.evaluate(step.eval); report.evals.push({ code: step.eval, result: r ?? null }); }
      catch (e) { report.evals.push({ code: step.eval, error: String(e) }); }
    }
    else if (step.shot) await shot(step.shot);
    else if (step.fps) report.fps.push({ label: step.label ?? `fps${report.fps.length}`, ...(await measureFps(step.fps)) });
    else if (step.click) {
      // (puppeteer ≥ 22: `count` presses the button that many times — clickCount 1, 2, … — so the
      // page gets a real 'dblclick'; a lone `clickCount` option is overridden by it)
      const [x, y] = await coords(step.click);
      await page.mouse.click(x, y, { button: step.button ?? 'left', count: step.count ?? 1 });
    }
    else if (step.dblclick) {
      const [x, y] = await coords(step.dblclick);
      await page.mouse.click(x, y, { count: 2 });
    }
    else if (step.move) {
      const [x, y] = await coords(step.move);
      await page.mouse.move(x, y, { steps: step.steps ?? 1 });
    }
    else if (step.mouse === 'down' || step.mouse === 'up') {
      await page.mouse[step.mouse]({ button: step.button ?? 'left' });
    }
    else if (step.drag) {
      // real mouse drag through the points [[x,y], ...] (steps interpolated moves per segment)
      const pts = await coords(step.drag);
      if (!Array.isArray(pts) || pts.length < 1) throw new Error(`drag: no points (${JSON.stringify(step.drag).slice(0, 200)})`);
      const button = step.button ?? 'left';
      if (step.modifiers) for (const m of step.modifiers) await page.keyboard.down(m);
      await page.mouse.move(pts[0][0], pts[0][1]);
      await page.mouse.down({ button });
      for (let k = 1; k < pts.length; k++) {
        await page.mouse.move(pts[k][0], pts[k][1], { steps: step.steps ?? 8 });
        if (step.pause) await sleep(step.pause);
      }
      await page.mouse.up({ button });
      if (step.modifiers) for (const m of [...step.modifiers].reverse()) await page.keyboard.up(m);
    }
    else if (step.wheel) {
      const [x, y] = await coords(step.wheel);
      await page.mouse.move(x, y);
      await page.mouse.wheel({ deltaY: step.deltaY ?? -240 });
    }
    else if (step.type !== undefined) {
      if (step.selector) await page.click(step.selector, { count: 3 }); // (triple click: select the text)
      await page.keyboard.type(String(step.type), { delay: step.delay ?? 10 });
    }
    else if (step.combo) {
      // e.g. { "combo": ["Control", "KeyZ"] } — hold all but the last key, tap the last
      const keys = step.combo;
      for (const k of keys.slice(0, -1)) await page.keyboard.down(k);
      await page.keyboard.press(keys[keys.length - 1]);
      for (const k of keys.slice(0, -1).reverse()) await page.keyboard.up(k);
    }
    else if (step.goto) {
      const target = step.goto.startsWith('http') ? step.goto : `${base}/${step.goto.replace(/^\//, '')}`;
      await page.goto(target, { waitUntil: 'load', timeout: 60000 });
    }
    else if (step.tab !== undefined) {
      // continue in another tab (e.g. the one the editor's Play button opened): 'last' or an index
      const timeout = Number(step.timeout ?? 10000);
      const t0 = Date.now();
      let pages = await browser.pages();
      /** @type {Page|null} */
      let next = null;
      if (step.tab === 'last') {
        next = pages[pages.length - 1] ?? null;
        if (!next || next === page) {
          // the newest tab is this one: wait for the tab it is opening (a pop-up is often not
          // listed yet right after the click / key that opens it). Tabs opened before the step
          // are skipped by the test above, so the wait never takes an old tab.
          const known = new Set(pages.map((p) => p.target()));
          const t = await browser.waitForTarget((x) => x.type() === 'page' && !known.has(x), { timeout }).catch(() => null);
          next = t ? await t.page() : null;
          if (!next) throw new Error(`tab last: no new tab opened within ${timeout} ms (${pages.length} open, the newest is the current page)`);
        }
      } else {
        const n = Number(step.tab);
        while (!pages[n] && Date.now() - t0 < timeout) { await sleep(100); pages = await browser.pages(); }
        next = pages[n] ?? null;
        if (!next) throw new Error(`no tab ${step.tab} (${pages.length} open after ${timeout} ms)`);
      }
      watch(next);
      page = next;
      await page.setViewport({ width, height });
      await page.bringToFront();
      // a tab opened during the run starts as about:blank: let it load before the next step
      const ready = initialPages.has(page) || (await loaded(page, Math.max(0, timeout - (Date.now() - t0))));
      report.evals.push({ code: `tab ${step.tab}`, result: ready ? page.url() : `${page.url()} (not loaded after ${timeout} ms)` });
    }
  }
} catch (e) {
  report.pageErrors.push(`HARNESS: ${e?.stack ?? e}`);
} finally {
  await settle().catch(() => {});
  await browser.close();
  await server.close();
}

if (report.pageErrors.length) exitCode = 1;
if (strict) {
  const evalErrors = report.evals.filter((e) => e.error !== undefined).length;
  /** @type {[number, string, string][]} count, singular, plural */
  const counts = [
    [report.errors.length, 'console error', 'console errors'],
    [report.warnings.length, 'console warning', 'console warnings'],
    [report.failedRequests.length, 'failed request', 'failed requests'],
    [evalErrors, 'eval step threw', 'eval steps threw'],
  ];
  report.strictFailures = counts.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
  if (report.strictFailures.length) exitCode = 1;
}
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

/** @param {string[]} a */
const uniq = (a) => [...new Set(a)];
console.log(`URL: ${url}`);
console.log(`GPU: ${report.gl}`);
console.log(`FPS: ${report.fps.map((f) => `${f.label}=${f.fps} (p50 ${f.p50ms}ms, p95 ${f.p95ms}ms)`).join(' | ') || 'n/a'}`);
console.log(`Page errors (${report.pageErrors.length}):`);
uniq(report.pageErrors).slice(0, 20).forEach((e) => console.log('  ' + e.split('\n').slice(0, 6).join('\n    ')));
console.log(`Console errors (${report.errors.length}):`);
uniq(report.errors).slice(0, 20).forEach((e) => console.log('  ' + e.slice(0, 500)));
console.log(`Console warnings (${report.warnings.length}):`);
uniq(report.warnings).slice(0, 10).forEach((e) => console.log('  ' + e.slice(0, 300)));
console.log(`Failed requests (${report.failedRequests.length}):`);
uniq(report.failedRequests).slice(0, 10).forEach((e) => console.log('  ' + e));
if (report.evals.length) {
  console.log('Evals:');
  report.evals.forEach((e) => console.log(`  ${e.code} => ${e.error !== undefined ? 'THREW ' : ''}${String(JSON.stringify(e.result ?? e.error ?? null)).slice(0, 400)}`));
}
console.log(`Screenshots: ${report.shots.join(', ')}`);
if (strict) console.log(`Strict: ${report.strictFailures.length ? `FAILED — ${report.strictFailures.join(', ')}` : 'passed (no console errors, warnings, failed requests or throwing evals)'}`);
process.exit(exitCode);
