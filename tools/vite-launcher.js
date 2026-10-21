/**
 * Vite plugin: the launcher page (index.html) — the list of the project's campaigns and levels,
 * with links into the game (game.html) and the level editor (editor.html).
 *
 * The page is plain HTML (no script): the plugin replaces its `<!-- luminati:launcher -->`
 * placeholder with the list, read from `public/campaigns/<name>/campaign.json` (and the level
 * files in each campaign's `levels/`) and `public/levels/*.json`:
 *  - on the dev server on every request of the page — a level saved in the editor is listed on
 *    the next reload;
 *  - in a build once — the list is baked into dist/index.html (what public/ holds then).
 * Only files in the current formats are listed (`luminati-campaign`, `luminati-level`); a file that
 * is not readable JSON or not in that format is named in a note under the list. Every text read
 * from a file is escaped; every link is relative (the site may live under a sub-path).
 *
 * The dev server adds links to the module sandboxes and the documentation (neither is part of a
 * build).
 */
import fs from 'node:fs/promises';
import path from 'node:path';

/** @import { Plugin } from 'vite' */

/** Where the list goes in index.html. */
const PLACEHOLDER = '<!-- luminati:launcher -->';
const LEVEL_FORMAT = 'luminati-level';
const CAMPAIGN_FORMAT = 'luminati-campaign';

/**
 * A level as the launcher lists it.
 * @typedef {object} LauncherLevel
 * @property {string} file      the file's name without `.json` (`?level=` / `?open=`)
 * @property {string} name      its display name (`name`, else the file name)
 * @property {string} subtitle
 * @property {string} description
 * @property {number} width     tiles
 * @property {number} depth     tiles
 * @property {boolean} combat   it has enemies (real-time combat)
 */

/**
 * A campaign as the launcher lists it.
 * @typedef {object} LauncherCampaign
 * @property {string} folder    its folder under public/campaigns (`?campaign=`)
 * @property {string} name      its display name
 * @property {string} subtitle  the title screen's subtitle, else the file's `subtitle`
 * @property {number} levels    the levels it joins (`levels`)
 * @property {number} chapters
 * @property {{ file: string, name: string }[]} files  the level files in its `levels/` folder
 */

/**
 * @typedef {object} LauncherList
 * @property {LauncherCampaign[]} campaigns  by name
 * @property {LauncherLevel[]} levels         by name
 * @property {{ file: string, why: string }[]} skipped  files that could not be listed
 */

/**
 * A JSON file, or why it cannot be listed.
 * @param {string} file
 * @returns {Promise<{ data: any } | { why: string }>}
 */
async function readJson(file) {
  let text;
  try { text = await fs.readFile(file, 'utf8'); } catch (e) { return { why: `cannot be read (${e?.code ?? e})` }; }
  try { return { data: JSON.parse(text.replace(/^﻿/, '')) }; } catch { return { why: 'is not valid JSON' }; }
}

/** @param {unknown} v @returns {string} */
const str = (v) => (typeof v === 'string' ? v.trim() : '');

/** The `*.json` file names of a folder, sorted ([] when it does not exist). @param {string} dir */
async function jsonFiles(dir) {
  try {
    return (await fs.readdir(dir, { withFileTypes: true }))
      .filter((d) => d.isFile() && d.name.endsWith('.json'))
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

/** @param {{ name: string }} a @param {{ name: string }} b */
const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

/**
 * Read what the launcher lists.
 * @param {string} publicDir the project's public/ folder
 * @returns {Promise<LauncherList>}
 */
export async function readLauncherList(publicDir) {
  /** @type {LauncherList} */
  const out = { campaigns: [], levels: [], skipped: [] };

  const levelsDir = path.join(publicDir, 'levels');
  for (const name of await jsonFiles(levelsDir)) {
    const file = name.slice(0, -'.json'.length);
    const r = await readJson(path.join(levelsDir, name));
    if ('why' in r) { out.skipped.push({ file: `levels/${name}`, why: r.why }); continue; }
    const L = r.data;
    if (L?.format !== LEVEL_FORMAT) { out.skipped.push({ file: `levels/${name}`, why: `is not a ${LEVEL_FORMAT} file` }); continue; }
    const rows = Array.isArray(L.tiles) ? L.tiles : [];
    out.levels.push({
      file,
      name: str(L.name) || file,
      subtitle: str(L.subtitle),
      description: str(L.description),
      width: Number.isFinite(L.width) ? L.width : typeof rows[0] === 'string' ? rows[0].length : 0,
      depth: Number.isFinite(L.depth) ? L.depth : rows.length,
      combat: Array.isArray(L.objects) && L.objects.some((o) => o?.type === 'enemy'),
    });
  }

  const campaignsDir = path.join(publicDir, 'campaigns');
  let folders = [];
  try { folders = (await fs.readdir(campaignsDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort(); } catch { /* none */ }
  for (const folder of folders) {
    const where = `campaigns/${folder}/campaign.json`;
    const r = await readJson(path.join(campaignsDir, folder, 'campaign.json'));
    if ('why' in r) {
      // (a folder without campaign.json is no campaign — the editor's level API treats it the same)
      if (!r.why.startsWith('cannot be read (ENOENT')) out.skipped.push({ file: where, why: r.why });
      continue;
    }
    const C = r.data;
    if (C?.format !== CAMPAIGN_FORMAT) { out.skipped.push({ file: where, why: `is not a ${CAMPAIGN_FORMAT} file` }); continue; }
    /** @type {{ file: string, name: string }[]} */
    const files = [];
    for (const name of await jsonFiles(path.join(campaignsDir, folder, 'levels'))) {
      const file = name.slice(0, -'.json'.length);
      const lr = await readJson(path.join(campaignsDir, folder, 'levels', name));
      if ('why' in lr) { out.skipped.push({ file: `campaigns/${folder}/levels/${name}`, why: lr.why }); continue; }
      if (lr.data?.format !== LEVEL_FORMAT) { out.skipped.push({ file: `campaigns/${folder}/levels/${name}`, why: `is not a ${LEVEL_FORMAT} file` }); continue; }
      files.push({ file, name: str(lr.data.name) || file });
    }
    out.campaigns.push({
      folder,
      name: str(C.name) || folder,
      subtitle: str(C.title?.subtitle) || str(C.subtitle),
      levels: Array.isArray(C.levels) ? C.levels.length : 0,
      chapters: Array.isArray(C.chapters) ? C.chapters.length : 0,
      files: files.sort(byName),
    });
  }

  out.campaigns.sort(byName);
  out.levels.sort(byName);
  return out;
}

/** @param {unknown} s @returns {string} text safe in HTML content and in a quoted attribute */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** @param {string} s a query value */
const q = (s) => encodeURIComponent(s);
/** @param {number} n @param {string} one @param {string} [many] */
const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The list as HTML (for the launcher's placeholder).
 * @param {LauncherList} list
 * @param {{ dev?: boolean }} [o] the dev server: also the sandboxes and the documentation
 * @returns {string}
 */
export function launcherHtml(list, { dev = false } = {}) {
  const parts = [];

  parts.push('<section class="lu-section" id="campaigns" aria-labelledby="campaigns-h">',
    `<h2 id="campaigns-h">Campaigns <span class="lu-count">${list.campaigns.length}</span></h2>`,
    '<p class="lu-lead">Levels joined into one story: exits between them, story flags, chapters and a saved game.</p>');
  if (!list.campaigns.length) parts.push('<p class="lu-empty">No campaigns in <code>public/campaigns/</code>.</p>');
  else {
    parts.push('<ul class="lu-grid lu-grid--campaigns">');
    for (const c of list.campaigns) {
      const meta = [count(c.levels, 'level'), c.chapters ? count(c.chapters, 'chapter') : ''].filter(Boolean).join(' · ');
      parts.push('<li class="lu-card lu-card--campaign">',
        `<h3>${esc(c.name)}</h3>`,
        c.subtitle ? `<p class="lu-sub">${esc(c.subtitle)}</p>` : '',
        `<p class="lu-meta">${esc(meta)}</p>`,
        '<div class="lu-actions">',
        `<a class="lu-btn lu-btn--play" href="game.html?campaign=${q(c.folder)}">Play</a>`,
        '</div>');
      if (c.files.length) {
        parts.push('<details class="lu-files"><summary>Edit its levels</summary><ul>');
        for (const f of c.files) parts.push(`<li><a href="editor.html?open=${q(c.folder)}/${q(f.file)}">${esc(f.name)}</a> <code>${esc(f.file)}</code></li>`);
        parts.push('</ul></details>');
      }
      parts.push('</li>');
    }
    parts.push('</ul>');
  }
  parts.push('</section>');

  parts.push('<section class="lu-section" id="levels" aria-labelledby="levels-h">',
    `<h2 id="levels-h">Levels <span class="lu-count">${list.levels.length}</span></h2>`,
    '<p class="lu-lead">Every level in <code>public/levels/</code>, played on its own.</p>');
  if (!list.levels.length) parts.push('<p class="lu-empty">No levels in <code>public/levels/</code>.</p>');
  else {
    parts.push('<ul class="lu-grid">');
    for (const l of list.levels) {
      const meta = [l.width && l.depth ? `${l.width} × ${l.depth} tiles` : '', l.combat ? 'Combat' : ''].filter(Boolean);
      parts.push('<li class="lu-card">',
        `<h3>${esc(l.name)}</h3>`,
        l.subtitle ? `<p class="lu-sub">${esc(l.subtitle)}</p>` : '',
        l.description ? `<p class="lu-desc">${esc(l.description)}</p>` : '',
        `<p class="lu-meta">${meta.map((m) => (m === 'Combat' ? '<span class="lu-tag">Combat</span>' : esc(m))).join(' ')} <code>${esc(l.file)}</code></p>`,
        '<div class="lu-actions">',
        `<a class="lu-btn lu-btn--play" href="game.html?level=${q(l.file)}">Play</a>`,
        `<a class="lu-btn" href="editor.html?open=${q(l.file)}">Edit</a>`,
        '</div></li>');
    }
    parts.push('</ul>');
  }
  parts.push('</section>');

  parts.push('<section class="lu-section" id="editor" aria-labelledby="editor-h">',
    '<h2 id="editor-h">Level editor</h2>',
    '<p class="lu-lead">Paint terrain, place objects, write the story and play-test in a click; save into the project folder (dev server), in the browser or as a file.</p>',
    '<div class="lu-actions">',
    '<a class="lu-btn lu-btn--play" href="editor.html">Open the editor</a>',
    '<a class="lu-btn" href="editor.html?new">New level</a>',
    '<a class="lu-btn" href="editor.html?new=room">New room</a>',
    '</div></section>');

  if (dev) {
    parts.push('<section class="lu-section lu-section--dev" id="dev" aria-labelledby="dev-h">',
      '<h2 id="dev-h">Development</h2>',
      '<p class="lu-lead">Served by the dev server only — not part of a build.</p>',
      '<div class="lu-actions">',
      '<a class="lu-btn" href="sandbox/index.html">Module sandboxes</a>',
      '<a class="lu-btn" href="docs/index.html">Documentation</a>',
      '</div></section>');
  }

  if (list.skipped.length) {
    parts.push('<aside class="lu-skipped"><p>Not listed:</p><ul>');
    for (const s of list.skipped) parts.push(`<li><code>public/${esc(s.file)}</code> ${esc(s.why)}</li>`);
    parts.push('</ul></aside>');
  }
  return parts.join('\n');
}

/**
 * The plugin (vite.config.js).
 * @returns {Plugin}
 */
export default function launcher() {
  let publicDir = '';
  return {
    name: 'luminati-launcher',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    async transformIndexHtml(html, ctx) {
      if (!html.includes(PLACEHOLDER)) return html;
      const list = await readLauncherList(publicDir);
      return html.replace(PLACEHOLDER, () => launcherHtml(list, { dev: !!ctx.server }));
    },
  };
}
