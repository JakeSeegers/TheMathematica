/**
 * Vite dev-server plugin: a tiny REST API so the level editor can save levels straight into the
 * project (`public/levels/<name>.json`). Files in public/ are served as-is in dev and copied into
 * dist/ by `npm run build`, so saved levels are playable at `?level=<name>` everywhere.
 *
 *   GET    /api/levels          → { levels: [{ name, file, title, size, modified }] }
 *   GET    /api/levels/:name    → the file's bytes as they are on disk (checked to be JSON first:
 *                                 422 when the file exists but is not valid JSON, 404 when there
 *                                 is no file)
 *   PUT    /api/levels/:name    → write (content-type: application/json, body = level JSON,
 *                                 validated), → { ok, file }
 *   DELETE /api/levels/:name    → delete, → { ok }
 *
 * A name (level or campaign) whose percent-escapes do not decode (`%E0%A4%A`) → 400, like any
 * other invalid name.
 *
 * Campaigns (docs/specs/CAMPAIGN_FORMAT.md) — the same calls on a campaign's own levels:
 *
 *   GET    /api/campaigns          → { campaigns: [{ name, title, file, levels: [{ name, file,
 *                                    title, size, modified }] }] }
 *   GET|PUT|DELETE /api/campaigns/:c/levels[/:name]   → as /api/levels, on
 *                                    `public/campaigns/<c>/levels/<name>.json`
 *
 * Only folders that already hold a `campaign.json` are campaigns: the API never creates one (404).
 *
 * The routes live under the dev server's base, like every file of the site: `/api/levels` on the
 * default server, `/project/api/levels` with `--base=/project/` (LevelStorage's `levelsApi` asks
 * there; nothing answers at the site root then).
 *
 * Any other method → 405 (writes go only through PUT; POST is refused; OPTIONS: see below). A PUT
 * whose content type is not `application/json` → 415, so no browser can send a write as a CORS
 * "simple" request.
 *
 * Same origin only. Every request (reads too) is refused with 403 before anything is read or
 * written when it comes from a page of another origin: its `Origin` header — or, without one,
 * its `Sec-Fetch-Site` (only `same-origin`, and `none` for a GET typed into the address bar, pass)
 * or `Referer` — must be this dev server, i.e. `http://<request Host>` (https: on TLS), plus
 * `127.0.0.1`, `localhost` and `[::1]` on the same port when the Host is one of those. Pages on
 * other ports are other origins. A request with none of these headers is a command-line client
 * (curl, a node script) and is served: browsers always send `Origin` with PUT and DELETE.
 * No CORS is granted: this plugin answers preflights (OPTIONS) for its routes itself — 403 for
 * other origins, else 204 with `Allow` and no CORS headers — ahead of Vite's CORS middleware
 * (which would allow every localhost port), and strips Access-Control-* headers from its answers.
 * DNS rebinding (a foreign name resolving to 127.0.0.1, so Origin matches Host) is refused by
 * Vite's Host check (`server.allowedHosts`), which runs before the handler.
 *
 * Only active in `vite` (serve), never in production.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * @import { IncomingMessage, ServerResponse } from 'node:http'
 * @import { Plugin } from 'vite'
 */

const NAME = /^[a-z0-9][a-z0-9-]{0,59}$/;
/** Windows device names: `con.json` & co. cannot be real files there (LevelStorage.slugify avoids them). */
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/;
const MAX_BYTES = 4 * 1024 * 1024;
/**
 * The `format` a PUT body must have: `LEVEL_FORMAT` of src/engine/level/LevelFormat.js (kept here:
 * the dev server's config loads this file without the engine).
 */
const LEVEL_FORMAT = 'luminati-level';
/** Loopback host names that reach the same server on the same port (Host header spelling). */
const LOOPBACK = ['127.0.0.1', 'localhost', '[::1]'];

/**
 * JSON answer; never carries CORS headers (Vite's CORS middleware may have added some).
 * @param {ServerResponse} res
 * @param {number} status
 * @param {unknown} body sent as JSON
 * @param {Record<string, string>} [headers] extra response headers
 */
function send(res, status, body, headers = {}) {
  sendText(res, status, JSON.stringify(body), headers);
}

/**
 * A JSON text answer, sent as it is (the GET of a level: the file's own bytes).
 * @param {ServerResponse} res
 * @param {number} status
 * @param {string|Buffer} text JSON text
 * @param {Record<string, string>} [headers] extra response headers
 */
function sendText(res, status, text, headers = {}) {
  for (const h of res.getHeaderNames()) if (h.startsWith('access-control-')) res.removeHeader(h);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(text);
}

/**
 * `decodeURIComponent`, or null for a malformed escape (`%E0%A4%A`), which the caller answers
 * with 400 like any other invalid name.
 * @param {string} s
 * @returns {string|null}
 */
function decodeName(s) {
  try { return decodeURIComponent(s); } catch { return null; }
}

/**
 * The origins that are this dev server for `req` (from its Host header).
 * @param {IncomingMessage} req
 * @returns {string[]}
 */
function ownOrigins(req) {
  const host = req.headers.host ?? req.headers[':authority'];
  if (!host) return [];
  // (a tls.TLSSocket, which has `encrypted: true`, when the dev server runs on https)
  const scheme = /** @type {{ encrypted?: boolean }} */ (req.socket)?.encrypted ? 'https:' : 'http:';
  let url;
  try { url = new URL(`${scheme}//${host}`); } catch { return []; }
  if (!LOOPBACK.includes(url.hostname)) return [url.origin];
  const port = url.port ? `:${url.port}` : '';
  return [url.origin, ...LOOPBACK.map((h) => `${scheme}//${h}${port}`)];
}

/**
 * `scheme://host[:port]` of a URL (a Referer), or null.
 * @param {string} href
 * @returns {string|null}
 */
function originOf(href) {
  try { return new URL(href).origin; } catch { return null; }
}

/**
 * Why `req` may not use the API — it comes from a page of another origin — or null when it may.
 * Browsers send `Origin` with every cross-origin request that can change something; same-origin
 * GETs carry only `Sec-Fetch-Site` (on http://127.0.0.1 / localhost) and `Referer`.
 * @param {IncomingMessage} req
 * @returns {string|null}
 */
function refusal(req) {
  const own = ownOrigins(req);
  const only = `only pages served by this dev server (${own[0] ?? 'same origin'}) may use the level API`;
  const origin = req.headers.origin;
  if (origin !== undefined) return own.includes(origin) ? null : `request from ${origin} refused: ${only}`;
  const site = req.headers['sec-fetch-site'];
  if (site !== undefined) {
    const read = req.method === 'GET' || req.method === 'HEAD';
    return site === 'same-origin' || (site === 'none' && read) ? null : `request refused (Sec-Fetch-Site: ${site}): ${only}`;
  }
  const referer = req.headers.referer;
  if (referer !== undefined) {
    const from = originOf(referer);
    return from && own.includes(from) ? null : `request from ${from ?? 'another page'} refused: ${only}`;
  }
  return null;
}

/**
 * Answer one request on a folder of level files (`req.url` is the rest after the route: `/` or
 * `/<name>`). `shown` is the folder as the answers name it ("levels", "campaigns/<c>/levels").
 * @param {IncomingMessage} req
 * @param {ServerResponse} res
 * @param {string} root absolute folder
 * @param {string} shown
 */
async function serveLevels(req, res, root, shown) {
  await fs.mkdir(root, { recursive: true });
  const name = decodeName((req.url ?? '/').split('?')[0].replace(/^\/+|\/+$/g, ''));
  if (name === '') {
    if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' }, { allow: 'GET' });
    return send(res, 200, { levels: await listLevels(root, shown) });
  }
  if (name === null || !NAME.test(name)) return send(res, 400, { error: 'invalid level name (use a-z, 0-9 and -)' });
  if (RESERVED.test(name)) return send(res, 400, { error: `“${name}” is a reserved file name on Windows — choose another name` });
  const file = path.join(root, `${name}.json`);
  if (req.method === 'GET') {
    // the file's own bytes (what `/levels/<name>.json` serves too), once they parse as JSON
    let bytes;
    try {
      bytes = await fs.readFile(file);
    } catch (e) {
      if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(e?.code)) return send(res, 404, { error: 'not found' });
      throw e;
    }
    // (a leading BOM is allowed: fetch's .json() ignores it too)
    try { JSON.parse(bytes.toString('utf8').replace(/^﻿/, '')); } catch (e) {
      return send(res, 422, { error: `public/${shown}/${name}.json is not valid JSON (${e?.message ?? e})` });
    }
    return sendText(res, 200, bytes);
  }
  if (req.method === 'DELETE') {
    await fs.rm(file, { force: true });
    return send(res, 200, { ok: true });
  }
  if (req.method === 'PUT') {
    const type = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    if (type !== 'application/json') return send(res, 415, { error: 'content-type must be application/json' });
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > MAX_BYTES) return send(res, 413, { error: 'level too large' });
      chunks.push(c);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    let data;
    try { data = JSON.parse(text); } catch { return send(res, 400, { error: 'body is not valid JSON' }); }
    if (data?.format !== LEVEL_FORMAT || !Array.isArray(data.tiles) || !Array.isArray(data.heights)) {
      return send(res, 400, { error: 'body is not a luminati-level' });
    }
    const tmp = `${file}.tmp`;
    try {
      await fs.writeFile(tmp, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
      await fs.rename(tmp, file);
    } catch (e) {
      // never leave a .tmp behind (npm run build would copy it into dist/)
      await fs.rm(tmp, { force: true }).catch(() => {});
      const why = ['EPERM', 'EACCES', 'EBUSY'].includes(e?.code)
        ? 'the file is read-only or in use by another program' : (e?.code ?? 'write error');
      return send(res, 500, { error: `Cannot write public/${shown}/${name}.json (${why})` });
    }
    return send(res, 200, { ok: true, file: `${shown}/${name}.json` });
  }
  return send(res, 405, { error: 'method not allowed' }, { allow: 'GET, PUT, DELETE' });
}

/**
 * The level files of a folder, newest first.
 * @param {string} root absolute folder
 * @param {string} shown the folder as the answer names it
 */
async function listLevels(root, shown) {
  let files = [];
  try { files = (await fs.readdir(root)).filter((f) => f.endsWith('.json')); } catch { return []; }
  const levels = [];
  for (const f of files) {
    const st = await fs.stat(path.join(root, f));
    let title = f.replace(/\.json$/, '');
    try { title = JSON.parse(await fs.readFile(path.join(root, f), 'utf8')).name ?? title; } catch { /* keep file name */ }
    levels.push({ name: f.replace(/\.json$/, ''), file: `${shown}/${f}`, title, size: st.size, modified: st.mtimeMs });
  }
  levels.sort((a, b) => b.modified - a.modified);
  return levels;
}

/**
 * The campaigns under `root` (folders with a `campaign.json`), by folder name.
 * @param {string} root absolute `public/campaigns`
 */
async function listCampaigns(root) {
  let dirs = [];
  try { dirs = (await fs.readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory() && NAME.test(d.name)).map((d) => d.name); } catch { return []; }
  const out = [];
  for (const name of dirs.sort()) {
    let title = name;
    try { title = JSON.parse(await fs.readFile(path.join(root, name, 'campaign.json'), 'utf8')).name ?? name; } catch { continue; }
    out.push({ name, title, file: `campaigns/${name}/campaign.json`, levels: await listLevels(path.join(root, name, 'levels'), `campaigns/${name}/levels`) });
  }
  return out;
}

/**
 * The plugin (vite.config.js).
 * @param {{ dir?: string, campaigns?: string }} [options] the level folder and the campaigns
 *   folder, relative to the Vite root
 * @returns {Plugin}
 */
export default function levelApi({ dir = 'public/levels', campaigns = 'public/campaigns' } = {}) {
  let root = '';
  let campaignRoot = '';
  return {
    name: 'luminati-level-api',
    apply: 'serve',
    configResolved(config) {
      root = path.resolve(config.root, dir);
      campaignRoot = path.resolve(config.root, campaigns);
    },
    configureServer(server) {
      // under the base (resolved: '/' or '/<path>/' on the dev server)
      const levelsRoute = `${server.config.base}api/levels`;
      const campaignsRoute = `${server.config.base}api/campaigns`;
      // Run first (moved ahead of Vite's CORS middleware): refuse other origins, answer preflights.
      /** @type {(req: IncomingMessage, res: ServerResponse, next: () => void) => void} */
      const guard = (req, res, next) => {
        const why = refusal(req);
        if (why) return send(res, 403, { error: why });
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('allow', 'GET, PUT, DELETE');
          return res.end();
        }
        return next();
      };
      server.middlewares.use(levelsRoute, guard);
      server.middlewares.use(campaignsRoute, guard);
      const stack = server.middlewares.stack;
      if (Array.isArray(stack)) stack.unshift(...stack.splice(-2));

      server.middlewares.use(levelsRoute, async (req, res) => {
        try {
          const why = refusal(req); // again, in case the guard above could not be moved first
          if (why) return send(res, 403, { error: why });
          return await serveLevels(req, res, root, 'levels');
        } catch (e) {
          return send(res, 500, { error: String(e?.message ?? e) });
        }
      });
      server.middlewares.use(campaignsRoute, async (req, res) => {
        try {
          const why = refusal(req);
          if (why) return send(res, 403, { error: why });
          const rest = (req.url ?? '/').split('?')[0].replace(/^\/+/, '');
          if (!rest.replace(/\/+$/, '')) {
            if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' }, { allow: 'GET' });
            return send(res, 200, { campaigns: await listCampaigns(campaignRoot) });
          }
          const m = /^([^/]+)\/levels(\/.*)?$/.exec(rest);
          const name = m ? decodeName(m[1]) : '';
          if (name === null) return send(res, 400, { error: 'invalid campaign name (use a-z, 0-9 and -)' });
          if (!m || !NAME.test(name)) return send(res, 404, { error: `not found (use ${campaignsRoute}/<campaign>/levels/<level>)` });
          const folder = path.join(campaignRoot, name);
          try { await fs.access(path.join(folder, 'campaign.json')); } catch { return send(res, 404, { error: `no campaign "${name}" (public/campaigns/${name}/campaign.json)` }); }
          req.url = m[2] || '/';
          return await serveLevels(req, res, path.join(folder, 'levels'), `campaigns/${name}/levels`);
        } catch (e) {
          return send(res, 500, { error: String(e?.message ?? e) });
        }
      });
    },
  };
}
