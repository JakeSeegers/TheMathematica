#!/usr/bin/env node
/**
 * check-docs-links.mjs — dependency-free link checker for the documentation.
 *
 * Checks every relative link, image and in-page anchor in
 *   docs/**\/*.md, docs/**\/*.html, and all Markdown files at the repository root
 * (plus any extra files or folders given on the command line):
 *
 *  - the target file or folder exists, with the exact letter case (Windows would
 *    forgive a wrong case, GitLab and Linux hosts do not);
 *  - a `#anchor` into a Markdown file matches a heading (GitLab/GitHub-style slugs,
 *    including the -1, -2 … suffixes of repeated headings) or an explicit
 *    `<a id|name="…">` / `id="…"`;
 *  - a `#anchor` into an HTML file matches an `id` or `name` attribute;
 *  - no link leaves the repository, uses a site-absolute path (`/x`, breaks on
 *    file://) or points at a line (`#L12`, docs refer to symbols, not lines).
 *
 * Markdown sources: inline links and images `[t](x)` / `![a](x)`, reference
 * definitions `[r]: x`, and `href` / `src` attributes of inline HTML. Fenced code
 * blocks and inline code spans are skipped. HTML sources: `href`, `src`,
 * `srcset`, `poster` attributes and CSS `url(...)` outside `<script>`.
 * External URLs (http:, https:, mailto:, data:, …) are not fetched.
 *
 * Usage:
 *   node tools/check-docs-links.mjs            # or: npm run docs:check
 *   node tools/check-docs-links.mjs --verbose  # also list every checked file
 *   node tools/check-docs-links.mjs --json     # machine-readable result on stdout
 *   node tools/check-docs-links.mjs ARCHITECTURE.md docs/contracts   # extra inputs
 *
 * Exit code: 0 when every link resolves, 1 when something is broken, 2 on usage errors.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const JSON_OUT = args.includes('--json');
const extra = args.filter((a) => !a.startsWith('--'));
const unknown = args.filter((a) => a.startsWith('--') && !['--verbose', '--json'].includes(a));
if (unknown.length) {
  console.error(`check-docs-links: unknown option(s) ${unknown.join(', ')}`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Input files
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set(['node_modules', '.git', '.check', 'dist']);

/**
 * The .md / .html files under `dir` (recursively, skipping SKIP_DIRS), appended to `out`.
 * @param {string} dir
 * @param {string[]} out
 * @returns {string[]} out
 */
function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(md|html?)$/i.test(ent.name)) out.push(p);
  }
  return out;
}

const inputs = new Set();
for (const f of walk(path.join(ROOT, 'docs'), [])) inputs.add(f);
for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (entry.isFile() && /\.md$/i.test(entry.name)) inputs.add(path.join(ROOT, entry.name));
}
for (const e of extra) {
  const p = path.resolve(ROOT, e);
  if (!fs.existsSync(p)) {
    console.error(`check-docs-links: no such file or folder: ${e}`);
    process.exit(2);
  }
  if (fs.statSync(p).isDirectory()) for (const f of walk(p, [])) inputs.add(f);
  else inputs.add(p);
}
const files = [...inputs].sort();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** @param {string} p */
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
/** @param {string} p */
const isMarkdown = (p) => /\.md$/i.test(p);
/** @param {string} p */
const isHtml = (p) => /\.html?$/i.test(p);

/** @type {Record<string, string>} */
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', middot: '·', times: '×', rarr: '→', larr: '←', hellip: '…' };
/**
 * `s` with the named entities of ENTITIES and numeric character references decoded.
 * @param {string} s
 */
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/**
 * Replaces inline code spans with same-length filler so links inside code are ignored.
 * @param {string} line
 */
function blankCodeSpans(line) {
  return line.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (m) => ' '.repeat(m.length));
}

/**
 * Yields the Markdown lines that are outside fenced code blocks, as
 * { n (1-based line number), text }.
 * @param {string} src
 * @returns {Generator<{ n: number, text: string }>}
 */
function* proseLines(src) {
  const lines = src.split(/\r?\n/);
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length && /^ {0,3}[`~]+\s*$/.test(line)) fence = null;
      continue;
    }
    if (m) { fence = m[1]; continue; }
    yield { n: i + 1, text: line };
  }
}

/**
 * GitHub-style heading slug (github-slugger).
 * @param {string} text
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-');
}

/**
 * The plain text GitHub derives from a Markdown heading's inline content.
 * @param {string} raw
 */
function headingText(raw) {
  let s = raw.replace(/\s+#+\s*$/, '').trim();       // closing hashes
  const parts = [];
  // Split into code spans (kept literally) and other text (markup removed).
  const re = /(`+)([\s\S]*?[^`])\1(?!`)/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    parts.push({ code: false, t: s.slice(last, m.index) });
    parts.push({ code: true, t: m[2].trim() === '' ? m[2] : m[2].replace(/^ (.*) $/, '$1') });
    last = m.index + m[0].length;
  }
  parts.push({ code: false, t: s.slice(last) });
  return parts.map(({ code, t }) => {
    if (code) return t;
    return decodeEntities(
      t
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')      // images → alt
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')       // links → text
        .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')      // reference links
        .replace(/<[^>]+>/g, '')                       // inline HTML tags
        .replace(/(^|[^\w])_{1,3}(?=\S)([^_]*?\S)_{1,3}(?=[^\w]|$)/g, '$1$2') // _emphasis_
        .replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/g, '$1') // backslash escapes
    );
  }).join('');
}

/** @type {Map<string, Set<string>>} */
const anchorCache = new Map();

/**
 * Set of anchors a file defines (Markdown headings + explicit ids; HTML ids/names).
 * @param {string} file
 * @returns {Set<string>}
 */
function anchorsOf(file) {
  if (anchorCache.has(file)) return anchorCache.get(file);
  const src = fs.readFileSync(file, 'utf8');
  const set = new Set();
  const addIds = (text) => {
    for (const m of text.matchAll(/\s(?:id|name)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) set.add(decodeEntities(m[1] ?? m[2]));
  };
  if (isMarkdown(file)) {
    const seen = new Map();
    const add = (raw) => {
      const base = slugify(headingText(raw));
      const k = seen.get(base) ?? 0;
      seen.set(base, k + 1);
      set.add(k ? `${base}-${k}` : base);
    };
    let prev = null;
    for (const { text } of proseLines(src)) {
      const atx = /^ {0,3}#{1,6}(?:\s+(.*?))?\s*$/.exec(text);
      if (atx) add(atx[1] ?? '');
      else if (/^ {0,3}(=+|-+)\s*$/.test(text) && prev && prev.trim() &&
        !/^ {0,3}([#>|<*+-]|\d+[.)]\s)/.test(prev) && !/^ {4}/.test(prev)) {
        add(prev.trim());                              // setext heading
      }
      addIds(blankCodeSpans(text));
      prev = text;
    }
  } else {
    addIds(src.replace(/<script[\s\S]*?<\/script>/gi, ''));
  }
  anchorCache.set(file, set);
  return set;
}

/**
 * Folder → the names in it, as they are on disk (for caseMismatch).
 * @type {Map<string, Set<string>>}
 */
const dirCache = new Map();
/**
 * Checks that every path segment exists with exactly this case. Returns the wrong segment or null.
 * @param {string} abs
 * @returns {string|null}
 */
function caseMismatch(abs) {
  const relParts = path.relative(ROOT, abs).split(path.sep).filter(Boolean);
  let cur = ROOT;
  for (const part of relParts) {
    if (part === '..') { cur = path.dirname(cur); continue; }
    let names = dirCache.get(cur);
    if (!names) {
      try { names = new Set(fs.readdirSync(cur)); } catch { return null; }
      dirCache.set(cur, names);
    }
    if (!names.has(part)) return `${rel(cur) || '.'}/${part}`;
    cur = path.join(cur, part);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Link extraction
// ---------------------------------------------------------------------------

/**
 * Returns [{ line, target, kind }] for one file.
 * @param {string} file
 * @returns {{ line: number, target: string, kind: string }[]}
 */
function linksOf(file) {
  const src = fs.readFileSync(file, 'utf8');
  const out = [];
  const attr = /\s(href|src|poster|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  if (isMarkdown(file)) {
    for (const { n, text } of proseLines(src)) {
      const line = blankCodeSpans(text);
      // Inline links / images: find every "](" and read the destination after it.
      const inline = /\]\(\s*(<[^>\n]*>|(?:[^\s()\\]|\\.|\([^\s()]*\))+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
      for (const m of line.matchAll(inline)) {
        const dest = m[1].startsWith('<') ? m[1].slice(1, -1) : m[1];
        const open = line.lastIndexOf('[', m.index);
        const isImg = open > 0 && line[open - 1] === '!';
        out.push({ line: n, target: dest.replace(/\\(.)/g, '$1'), kind: isImg ? 'image' : 'link' });
      }
      const def = /^ {0,3}\[[^\]]+\]:\s*(<[^>]*>|\S+)/.exec(line);
      if (def) out.push({ line: n, target: def[1].replace(/^<|>$/g, ''), kind: 'ref' });
      for (const m of line.matchAll(attr)) {
        const v = decodeEntities(m[2] ?? m[3]);
        if (m[1].toLowerCase() === 'srcset') {
          for (const c of v.split(',')) { const u = c.trim().split(/\s+/)[0]; if (u) out.push({ line: n, target: u, kind: 'srcset' }); }
        } else out.push({ line: n, target: v, kind: m[1].toLowerCase() });
      }
    }
  } else {
    // Keep line numbers: blank out <script> bodies instead of removing them.
    const text = src.replace(/<script[\s\S]*?<\/script>/gi, (m) => m.replace(/[^\n]/g, ' '));
    const lineAt = (i) => text.slice(0, i).split('\n').length;
    for (const m of text.matchAll(attr)) {
      const v = decodeEntities(m[2] ?? m[3]);
      if (m[1].toLowerCase() === 'srcset') {
        for (const c of v.split(',')) { const u = c.trim().split(/\s+/)[0]; if (u) out.push({ line: lineAt(m.index), target: u, kind: 'srcset' }); }
      } else out.push({ line: lineAt(m.index), target: v, kind: m[1].toLowerCase() });
    }
    for (const m of text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]+))\s*\)/gi)) {
      out.push({ line: lineAt(m.index), target: m[1] ?? m[2] ?? m[3], kind: 'css-url' });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check
// ---------------------------------------------------------------------------

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;   // http:, https:, mailto:, data:, javascript:, //host
const problems = [];
let checked = 0, external = 0, anchorsChecked = 0;

for (const file of files) {
  const links = linksOf(file);
  if (VERBOSE && !JSON_OUT) console.log(`${rel(file)}: ${links.length} link(s)`);
  for (const { line, target, kind } of links) {
    const raw = target.trim();
    if (!raw) continue;
    if (EXTERNAL.test(raw)) { external++; continue; }
    checked++;
    const report = (reason) => problems.push({ file: rel(file), line, target: raw, kind, reason });
    if (raw.startsWith('/')) { report('site-absolute path (breaks on file:// and repository hosts); use a relative link'); continue; }

    const hashAt = raw.indexOf('#');
    let pathPart = hashAt >= 0 ? raw.slice(0, hashAt) : raw;
    const anchor = hashAt >= 0 ? raw.slice(hashAt + 1) : '';
    pathPart = pathPart.replace(/\?.*$/, '');
    let decoded;
    try { decoded = decodeURIComponent(pathPart); } catch { report('malformed %-escape'); continue; }

    let abs = file;
    if (decoded) {
      abs = path.resolve(path.dirname(file), decoded);
      const r = path.relative(ROOT, abs);
      if (r.startsWith('..') || path.isAbsolute(r)) { report('points outside the repository'); continue; }
      if (!fs.existsSync(abs)) { report('target does not exist'); continue; }
      const wrong = caseMismatch(abs);
      if (wrong) { report(`letter case differs from the file on disk (${wrong})`); continue; }
    }
    if (!anchor) continue;
    let a;
    try { a = decodeURIComponent(anchor); } catch { a = anchor; }
    if (/^L\d+(-L?\d+)?$/.test(a)) { report('line-number anchor; refer to a symbol instead'); continue; }
    if (fs.statSync(abs).isDirectory()) { report('anchor on a folder link'); continue; }
    if (!isMarkdown(abs) && !isHtml(abs)) { report(`anchor on a non-document file (${path.extname(abs) || 'no extension'})`); continue; }
    anchorsChecked++;
    if (!anchorsOf(abs).has(a)) report(`anchor #${a} not found in ${rel(abs)}`);
  }
}

if (JSON_OUT) {
  console.log(JSON.stringify({ files: files.length, checked, anchors: anchorsChecked, external, problems }, null, 2));
} else {
  for (const p of problems) console.log(`${p.file}:${p.line}  ${p.target}\n    → ${p.reason}`);
  const summary = `${files.length} files, ${checked} relative links (${anchorsChecked} with anchors), ${external} external skipped`;
  console.log(problems.length ? `\n✗ ${problems.length} broken link(s) — ${summary}` : `✓ all links resolve — ${summary}`);
}
process.exit(problems.length ? 1 : 0);
