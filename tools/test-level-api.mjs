#!/usr/bin/env node
/**
 * test-level-api.mjs — the Node self-test of the dev-server level API (tools/vite-level-api.js,
 * docs/specs/LEVEL_STORAGE_API.md §5): `npm run api:test`.
 *
 * Starts a throwaway Vite server in this process with only the level-API plugin, on a temporary
 * folder in the OS temp directory (its own `public/levels/` and a campaign in `public/campaigns/`),
 * sends raw HTTP requests and checks status codes and bodies: the list, a GET returning the file's
 * own bytes, 404 / 422 (a file that is not JSON) / 400 (bad names, malformed %-escapes), PUT (415,
 * the atomic write, the bytes read back), DELETE, POST → 405, the origin check (403) and the
 * campaign routes; then a second server under a sub-path (`base: '/project/'`): the routes there,
 * none at the site root. The project's public/ folder is never touched; the servers and the folder
 * are gone when the run ends.
 *
 *   node tools/test-level-api.mjs [--verbose]
 *
 * Prints a summary; exit code 1 when a check fails (each failure is listed with what it got).
 */
import { createServer } from 'vite';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import levelApi from './vite-level-api.js';

const verbose = process.argv.includes('--verbose');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'luminati-level-api-'));
const levels = path.join(tmp, 'public', 'levels');
const campaigns = path.join(tmp, 'public', 'campaigns');
const camp = path.join(campaigns, 'demo');
fs.mkdirSync(levels, { recursive: true });
fs.mkdirSync(path.join(camp, 'levels'), { recursive: true });

// fixtures: a pretty-printed level (the API must not re-stringify it), a file that is not JSON, a
// file with a UTF-8 BOM, a campaign with one level and one broken level
const LEVEL = { format: 'luminati-level', version: 1, name: 'Pretty', tiles: ['gg'], heights: ['22'] };
const PRETTY = `${JSON.stringify(LEVEL, null, 2)}\n`;
fs.writeFileSync(path.join(levels, 'pretty.json'), PRETTY);
fs.writeFileSync(path.join(levels, 'broken.json'), '{ "format": "luminati-level", ');
fs.writeFileSync(path.join(levels, 'bom.json'), `﻿${PRETTY}`);
fs.writeFileSync(path.join(camp, 'campaign.json'), JSON.stringify({ format: 'luminati-campaign', name: 'Demo' }));
fs.writeFileSync(path.join(camp, 'levels', 'first.json'), PRETTY);
fs.writeFileSync(path.join(camp, 'levels', 'bad.json'), 'not json');

/**
 * A throwaway server on the temporary folder with only the level-API plugin.
 * @param {string} [base] Vite's base (the site's sub-path)
 */
const makeServer = (base = '/') => createServer({
  configFile: false,
  root: tmp,
  base,
  cacheDir: path.join(tmp, '.vite'),
  logLevel: 'error',
  plugins: [levelApi()],
  server: { host: '127.0.0.1', port: 5900 + Math.floor(Math.random() * 500), strictPort: false, hmr: false, cors: false, watch: null },
});
const server = await makeServer();
/** The server under a sub-path (started after the root server's checks). @type {import('vite').ViteDevServer|null} */
let sub = null;

let passed = 0;
/** @type {string[]} */
const failures = [];
/**
 * @param {boolean} ok
 * @param {string} what
 * @param {unknown} [got]
 */
const check = (ok, what, got) => {
  if (ok) {
    passed++;
    if (verbose) console.log(`  ok   ${what}`);
  } else failures.push(`${what}${got !== undefined ? ` — got ${JSON.stringify(got)}` : ''}`);
};

try {
  await server.listen();
  const base = new URL(server.resolvedUrls.local[0]);
  /**
   * One raw request (the path is sent exactly as written, malformed escapes included).
   * @param {URL} at the server
   * @param {string} method
   * @param {string} p
   * @param {{ body?: string, headers?: Record<string, string> }} [o]
   * @returns {Promise<{ status: number, type: string, text: string, json: any }>}
   */
  const request = (at, method, p, { body, headers = {} } = {}) => new Promise((resolve, reject) => {
    const r = http.request({ host: at.hostname, port: at.port, method, path: p, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text.replace(/^﻿/, '')); } catch { /* not JSON */ }
        resolve({ status: res.statusCode ?? 0, type: String(res.headers['content-type'] ?? ''), text, json });
      });
    });
    r.on('error', reject);
    r.end(body);
  });
  /** A request to the root server. @type {(method: string, p: string, o?: { body?: string, headers?: Record<string, string> }) => ReturnType<typeof request>} */
  const req = (method, p, o) => request(base, method, p, o);
  const JSON_TYPE = { 'content-type': 'application/json' };
  const own = `http://${base.host}`;

  // ---- the list ----
  let r = await req('GET', '/api/levels');
  check(r.status === 200 && Array.isArray(r.json?.levels), 'GET /api/levels → 200 { levels }', r.status);
  check(['bom', 'broken', 'pretty'].every((n) => r.json?.levels?.some((l) => l.name === n)), 'the list names every file', r.json?.levels?.map((l) => l.name));
  check(r.json?.levels?.find((l) => l.name === 'pretty')?.title === 'Pretty', 'the list title is the level name', r.json?.levels);

  // ---- GET: the file's bytes ----
  r = await req('GET', '/api/levels/pretty');
  check(r.status === 200 && r.text === PRETTY, 'GET /api/levels/<name> → 200, the file bytes (not re-stringified)', { status: r.status, text: r.text.slice(0, 60) });
  check(r.type.startsWith('application/json'), 'GET answers application/json', r.type);
  r = await req('GET', '/api/levels/bom');
  check(r.status === 200 && r.text === `﻿${PRETTY}`, 'a file with a BOM → 200, its bytes', r.status);
  r = await req('GET', '/api/levels/missing');
  check(r.status === 404 && r.json?.error === 'not found', 'a missing file → 404 not found', { status: r.status, body: r.json });
  r = await req('GET', '/api/levels/broken');
  check(r.status === 422 && /is not valid JSON/.test(r.json?.error ?? ''), 'a file that is not JSON → 422', { status: r.status, body: r.json });

  // ---- names ----
  for (const p of ['/api/levels/%E0%A4%A', '/api/levels/%', '/api/levels/%zz']) {
    r = await req('GET', p);
    check(r.status === 400 && /invalid level name/.test(r.json?.error ?? ''), `GET ${p} (malformed escape) → 400`, { status: r.status, body: r.json });
  }
  r = await req('PUT', '/api/levels/%E0%A4%A', { body: PRETTY, headers: JSON_TYPE });
  check(r.status === 400, 'PUT to a malformed escape → 400', r.status);
  r = await req('DELETE', '/api/levels/%E0%A4%A');
  check(r.status === 400, 'DELETE of a malformed escape → 400', r.status);
  r = await req('GET', '/api/levels/Bad_Name');
  check(r.status === 400, 'an invalid name → 400', r.status);
  r = await req('GET', '/api/levels/%2e%2e%2fpackage');
  check(r.status === 400, 'an escaped ../ → 400', r.status);
  r = await req('GET', '/api/levels/con');
  check(r.status === 400 && /reserved file name/.test(r.json?.error ?? ''), 'a Windows device name → 400', { status: r.status, body: r.json });

  // ---- PUT / DELETE ----
  r = await req('PUT', '/api/levels/written', { body: PRETTY, headers: { 'content-type': 'text/plain' } });
  check(r.status === 415, 'PUT as text/plain → 415', r.status);
  r = await req('POST', '/api/levels/written', { body: PRETTY, headers: JSON_TYPE });
  check(r.status === 405, 'POST → 405', r.status);
  r = await req('PUT', '/api/levels/written', { body: '{"format":"other"}', headers: JSON_TYPE });
  check(r.status === 400 && /not a luminati-level/.test(r.json?.error ?? ''), 'PUT of a non-level → 400', { status: r.status, body: r.json });
  const compact = JSON.stringify(LEVEL);
  r = await req('PUT', '/api/levels/written', { body: compact, headers: { 'content-type': 'application/json; charset=utf-8' } });
  check(r.status === 200 && r.json?.ok === true && r.json?.file === 'levels/written.json', 'PUT → 200 { ok, file }', { status: r.status, body: r.json });
  check(fs.readFileSync(path.join(levels, 'written.json'), 'utf8') === `${compact}\n`, 'PUT writes the body plus a final newline');
  check(!fs.existsSync(path.join(levels, 'written.json.tmp')), 'no .tmp file is left');
  r = await req('GET', '/api/levels/written');
  check(r.status === 200 && r.text === `${compact}\n`, 'GET after PUT → the written bytes', r.text.slice(0, 60));
  r = await req('DELETE', '/api/levels/written');
  check(r.status === 200 && r.json?.ok === true && !fs.existsSync(path.join(levels, 'written.json')), 'DELETE → 200, file gone', r.status);
  r = await req('DELETE', '/api/levels/written');
  check(r.status === 200, 'DELETE of a missing file → 200', r.status);

  // ---- the origin check ----
  r = await req('GET', '/api/levels/pretty', { headers: { origin: 'http://localhost:1' } });
  check(r.status === 403, 'another origin → 403', r.status);
  r = await req('GET', '/api/levels/pretty', { headers: { origin: own } });
  check(r.status === 200, 'the own origin → 200', r.status);
  r = await req('PUT', '/api/levels/written', { body: compact, headers: { ...JSON_TYPE, 'sec-fetch-site': 'cross-site' } });
  check(r.status === 403 && !fs.existsSync(path.join(levels, 'written.json')), 'Sec-Fetch-Site: cross-site → 403, nothing written', r.status);
  r = await req('OPTIONS', '/api/levels/pretty', { headers: { origin: own } });
  check(r.status === 204 && !r.text, 'OPTIONS from the own origin → 204', r.status);

  // ---- campaigns ----
  r = await req('GET', '/api/campaigns');
  check(r.status === 200 && r.json?.campaigns?.[0]?.name === 'demo' && r.json.campaigns[0].levels.length === 2, 'GET /api/campaigns → the campaign and its levels', r.json);
  r = await req('GET', '/api/campaigns/demo/levels/first');
  check(r.status === 200 && r.text === PRETTY, 'a campaign level → its bytes', r.status);
  r = await req('GET', '/api/campaigns/demo/levels/bad');
  check(r.status === 422, 'a campaign level that is not JSON → 422', r.status);
  r = await req('GET', '/api/campaigns/demo/levels/%E0%A4%A');
  check(r.status === 400, 'a campaign level name with a malformed escape → 400', r.status);
  r = await req('GET', '/api/campaigns/%E0%A4%A/levels');
  check(r.status === 400, 'a campaign name with a malformed escape → 400', r.status);
  r = await req('GET', '/api/campaigns/nothing/levels');
  check(r.status === 404, 'a folder without campaign.json → 404', r.status);

  // ---- under a sub-path: the routes live under the base, like the site's files ----
  sub = await makeServer('/project/');
  await sub.listen();
  const at = new URL(sub.resolvedUrls.local[0]);
  const subOwn = `http://${at.host}`;
  r = await request(at, 'GET', '/project/api/levels');
  check(r.status === 200 && r.json?.levels?.some((l) => l.name === 'pretty'), 'base /project/: GET /project/api/levels → 200 { levels }', r.status);
  r = await request(at, 'GET', '/project/api/levels/pretty');
  check(r.status === 200 && r.text === PRETTY, 'base /project/: GET /project/api/levels/<name> → the file bytes', r.status);
  r = await request(at, 'GET', '/project/api/campaigns/demo/levels/first');
  check(r.status === 200 && r.text === PRETTY, 'base /project/: a campaign level under the base', r.status);
  r = await request(at, 'PUT', '/project/api/levels/written', { body: compact, headers: { ...JSON_TYPE, origin: subOwn } });
  check(r.status === 200 && r.json?.file === 'levels/written.json', 'base /project/: PUT under the base writes', r.json);
  r = await request(at, 'DELETE', '/project/api/levels/written', { headers: { origin: subOwn } });
  check(r.status === 200 && !fs.existsSync(path.join(levels, 'written.json')), 'base /project/: DELETE under the base', r.status);
  r = await request(at, 'GET', '/project/api/levels/pretty', { headers: { origin: 'http://localhost:1' } });
  check(r.status === 403, 'base /project/: another origin → 403 there too', r.status);
  r = await request(at, 'GET', '/api/levels');
  check(!(r.status === 200 && r.json?.levels), 'base /project/: nothing answers /api/levels at the site root', { status: r.status, text: r.text.slice(0, 60) });
} catch (e) {
  failures.push(`the test itself threw: ${e?.stack ?? e}`);
} finally {
  await sub?.close();
  await server.close();
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

console.log(`level API: ${passed} checks passed, ${failures.length} failed`);
for (const f of failures) console.log(`  FAIL ${f}`);
process.exit(failures.length ? 1 : 0);
