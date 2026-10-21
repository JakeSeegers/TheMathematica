#!/usr/bin/env node
/**
 * i18n-worklist.mjs — the translators' side of the content tables (docs/specs/I18N.md §4.7).
 *
 * A unit's key is the text key the data holds beside its text — a GUID (docs/specs/I18N.md §4.2),
 * made when the text is made and kept through every edit —, so nothing moves: an inserted page is a
 * new unit to translate, its neighbours stay translated; an edited line is the same key with another
 * English (changed); a deleted line leaves an orphan (--prune).
 *
 *   node tools/i18n-worklist.mjs [--lang=ja[,zh]] [--table=<id>[,…]] [--out=<dir>] [--format=json|po]
 *       Write a worklist per language and table (default out: .check/i18n-worklist; scratch, never
 *       committed): `<out>/<lang>/<table>.json` (version 3), or `.po` with --format=po (gettext, for
 *       CAT tools and translation platforms: tools/lib/po.mjs). It lists, in the order the game's
 *       files hold them, every unit that lives in the table and that a reader shows in English —
 *       untranslated (no translation on the reader's chain) or changed (its key now shows other
 *       English than the translation was made from; `previous: { source, target }`, in PO a
 *       `#, fuzzy` entry with `#| msgid` the old English, an empty `msgstr` and the old translation in
 *       a `#.` note) — with its key (the GUID; PO: `msgctxt`), its English, where it is used (a
 *       readable place: the file, the object, the field; PO: `#. where:` notes and `#:` references),
 *       the speaker, the lines before and after, the object type and the translation memory's
 *       `suggestions` (the same English translated elsewhere in the language's tables); untranslated
 *       terms apart (`terms`; PO: `msgctxt "term"`). Fill in `target` (PO: `msgstr`), keeping the
 *       markup. Unit texts the data holds no key for cannot be listed (they stay English): the tool
 *       says how many — `npm run i18n:keys -- --assign` gives them keys. Refused for a table the
 *       loader does not read (no JSON, not version 3) or that is filed under another language or
 *       table (exit 1; the other tables are written).
 *
 *   node tools/i18n-worklist.mjs --merge=<file or folder> [--lang] [--table] [--dry-run] [--force[=…]]
 *       Merge filled worklists — JSON or PO — into public/i18n/<lang>/<table>.json. Every unit with
 *       a target, written with the extractor's English as its `source` (never the file's); targets
 *       get LF line ends. A unit another reader still shows with its old English at the key (a line
 *       edited in a shipped level whose campaign copy is not) is kept for that reader, in the table
 *       it lives in for it, before the new one replaces it. Skipped: blank targets, fuzzy PO entries
 *       (a JSON entry `"fuzzy": true`), entries whose English is no longer the English at their key,
 *       and — always — keys that are no text key (a GUID, `<GUID>.2`, a code key), keys or names that
 *       live in another table (a worklist for `common` merges the code's units and the common terms
 *       only) or that no reader shows, and a fuzzy entry whose translation is still the old one.
 *       Refused: a worklist that is not version 3, a markup error (`${…}` values that differ,
 *       unbalanced braces), a table the index does not list, a table the loader does not read (no
 *       JSON, not version 3), filed under another language or table or of a newer version, a table
 *       whose own or readers' sources had errors. What the table file held that the loader drops is
 *       printed and left out. `--dry-run` writes nothing.
 *
 *   node tools/i18n-worklist.mjs --prune [--lang] [--table] [--dry-run] [--force[=…]]
 *       Drop orphan units (no reader shows their key with their English, nor an edit of it: the
 *       text was deleted) and orphan terms (nothing that reads the table shows the name).
 *
 *   node tools/i18n-worklist.mjs --init [--lang=ja,zh]
 *       Create public/i18n/index.json and every missing table of the shipped levels
 *       (src/game/levels.js SHIPPED_LEVELS), the tracked campaigns and `common`, empty (version 3),
 *       for each language (the index's, or --lang). A campaign whose level file has the id and the
 *       name of a shipped level `extends` that level's table. Existing tables are never rewritten.
 *
 * (`--sync`, which moved translations to new keys after an insert, is gone: nothing moves now.)
 *
 * `--force` overrides every refusal below; `--force=<what>[,…]` only those named:
 *   fuzzy    merge fuzzy entries (never one whose translation is still the old one)
 *   english  merge an entry whose English is no longer at its key onto the English now there
 *   markup   merge a translation with a markup error (each is printed)
 *   table    rewrite a table the loader does not read (no JSON, not version 3), filed under another
 *            language or table, or newer
 *   sources  merge or prune a table whose own or readers' sources had errors (a level file that
 *            does not parse, a missing story file, src/game/levels.js that does not import …): what
 *            its readers show cannot be told, so its entries may look orphaned
 *
 * `--root=<folder>`: work on another repository-shaped folder (tools/test-i18n.mjs's fixtures).
 *
 * Exit code 1 when something was refused (or index.json is no JSON), 2 on usage errors.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseArgs } from './lib/levelgen.mjs';
import {
  ROOT, i18nDir, loadWorkspace, readIndex, serializeTable, serializeIndex, tableFile, markupIssues, checkLanguage, readersOf, keylessUnits,
  translationMemory, suggestionsFor, rewriteRefusal, sameEnglish, lf, clip, tableOrder, WORKLIST_FORMAT, WORKLIST_VERSION,
  PO_TABLE_FIELD, PO_VERSION_FIELD,
} from './lib/i18n.mjs';
import { serializePo, parsePo } from './lib/po.mjs';
import { isTableId } from '../src/engine/i18n/ContentText.js';
import { isTextKey } from '../src/engine/i18n/ContentKeys.js';

/**
 * @import { ContentUnit } from '../src/engine/i18n/ContentText.js'
 * @import { UnitClass } from './lib/i18n.mjs'
 */

const args = parseArgs(process.argv.slice(2));
const list = (v) => (typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : null);
const USAGE = 'usage: node tools/i18n-worklist.mjs [--lang=ja] [--table=<id>] [--out=<dir>] [--format=json|po] | --merge=<file|dir> [--dry-run] [--force[=fuzzy,english,markup,table,sources]] | --prune [--dry-run] [--force[=…]] | --init [--lang=ja,zh]';
/** What `--force=<what>` can name (`--force` alone: all of them). */
const FORCE_KINDS = Object.freeze(['fuzzy', 'english', 'markup', 'table', 'sources']);

if (args.help) {
  console.log(USAGE);
  process.exit(0);
}
for (const k of Object.keys(args)) {
  if (k === 'sync') { console.error(`--sync is gone: a unit is keyed by the text key the data holds (docs/specs/I18N.md §4.2), so nothing moves — an inserted page is a new unit, its neighbours stay translated\n${USAGE}`); process.exit(2); }
  if (!['lang', 'table', 'out', 'format', 'merge', 'prune', 'init', 'dry-run', 'force', 'root', 'help'].includes(k)) { console.error(`unknown option "${k}"\n${USAGE}`); process.exit(2); }
}
for (const k of ['lang', 'table', 'out', 'merge', 'root']) if (args[k] === true || args[k] === '') { console.error(`--${k} needs a value\n${USAGE}`); process.exit(2); }
const langs = list(args.lang);
const only = list(args.table);
// (--root: another repository-shaped folder — the self-test's fixtures)
const root = typeof args.root === 'string' ? path.resolve(process.cwd(), args.root) : ROOT;
const dir = i18nDir(root);
const rel = (p) => path.relative(process.cwd(), p).split(path.sep).join('/');
/** @type {Set<string>} the refusals `--force` overrides */
const force = new Set(args.force === true ? FORCE_KINDS : list(args.force) ?? []);
for (const k of force) if (!FORCE_KINDS.includes(k)) { console.error(`--force=${k}: not one of ${FORCE_KINDS.join(', ')}\n${USAGE}`); process.exit(2); }
/** `--force` or `--force=<what>` names it. @param {string} what */
const forced = (what) => force.has(what);
const dryRun = !!args['dry-run'];

if (only) for (const id of only) if (!isTableId(id)) { console.error(`--table: "${id}" is not a table id (common, levels/<name>, campaigns/<name>)`); process.exit(2); }
if (args.format !== undefined && args.format !== 'json' && args.format !== 'po') { console.error(`--format: "${args.format}" — json or po\n${USAGE}`); process.exit(2); }
if ([args.init, args.merge, args.prune].filter(Boolean).length > 1) { console.error(`--init, --merge and --prune go alone\n${USAGE}`); process.exit(2); }
if (args.init) process.exit(await init());
if (args.merge) process.exit(await merge(String(args.merge)));
if (args.prune) process.exit(await prune());
process.exit(await write());

/** index.json that is no JSON: an error line (never a stack trace), and nothing is written. */
function brokenIndex(index) {
  if (!index.broken) return false;
  for (const w of index.warnings) console.error(`public/i18n/${w.replace(/^index: /, 'index.json: ')} — fix it first`);
  return true;
}

/** `n thing(s)`. @param {number} n @param {string} one @param {string} [many] */
function count(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Is a table file filed where its `lang` and `source` say (`readTable`)? '' when it is, else why not.
 * @param {{ raw: any, lang: string, id: string }} r
 */
function misfiled(r) {
  if (r.raw?.lang !== r.lang) return `says "lang": ${JSON.stringify(r.raw?.lang) ?? 'nothing'}, but it is filed under ${r.lang}/`;
  if (r.raw?.source !== r.id) return `says "source": ${JSON.stringify(r.raw?.source) ?? 'nothing'}, but it is filed as ${r.id}`;
  return '';
}

// =================================================================================================
// Write
// =================================================================================================

/**
 * Write the worklists.
 * @returns {Promise<number>}
 */
async function write() {
  const ws = await loadWorkspace({ root, langs });
  if (ws.index.missing) { console.error('public/i18n/index.json does not exist: run with --init first'); return 2; }
  if (brokenIndex(ws.index)) return 1;
  const po = args.format === 'po';
  const out = path.resolve(process.cwd(), typeof args.out === 'string' ? args.out : path.join(root, '.check', 'i18n-worklist'));
  // (the order the game's files hold the units: common's sources first, then the tables')
  /** @type {Map<string, number>} */
  const order = new Map();
  for (const s of ws.sources.values()) for (const e of s.strings) if (e.key && !order.has(e.key)) order.set(e.key, order.size);
  const at = (k) => order.get(k) ?? Infinity;
  let files = 0;
  let total = 0;
  let refused = 0;
  for (const lang of ws.langs) {
    const report = checkLanguage(ws, lang);
    const tm = translationMemory(report.model.files);
    for (const t of report.tables) {
      if (only && !only.includes(t.id)) continue;
      if (!t.exists) { console.log(`${lang}/${t.id}.json does not exist — skipped (--init creates it)`); continue; }
      const r = report.model.files.get(t.id);
      // a table the loader does not read would list every entry as untranslated; another language's would mislead
      if (r.broken) { console.error(`${lang}/${t.id}.json cannot be read — no worklist written (${r.warnings[0] ?? 'fix the file first'})`); refused++; continue; }
      const wrong = misfiled(r);
      if (wrong) { console.error(`${lang}/${t.id}.json ${wrong} — no worklist written (move the file where it belongs first)`); refused++; continue; }
      const notes = (n) => ({
        ...(n.speaker ? { speaker: n.speaker } : {}),
        ...(n.prev ? { before: n.prev } : {}),
        ...(n.next ? { after: n.next } : {}),
        ...(n.type ? { type: n.type } : {}),
      });
      const where = (w) => (w.length > 10 ? [...w.slice(0, 10), `… and ${w.length - 10} more`] : w);
      /** @type {any[]} the units, in the order the game's files hold them */
      const units = [
        ...t.untranslated.units.map((u) => ({
          order: at(u.key),
          entry: { key: u.key, source: u.text, target: '', kind: u.kind, where: where(u.where), ...notes(u.note) },
        })),
        ...t.changed.map((c) => ({
          order: at(c.key),
          entry: {
            key: c.key, source: c.now, target: '', kind: c.kind, where: where(c.where), ...notes(c.note),
            previous: { source: c.was, target: c.target },
          },
        })),
      ].sort((a, b) => a.order - b.order || (a.entry.key < b.entry.key ? -1 : 1)).map((x) => {
        const s = suggestionsFor(tm, x.entry.source, `${t.id} ${x.entry.key}`);
        return s.length ? { ...x.entry, suggestions: s } : x.entry;
      });
      const terms = t.untranslated.terms.map((u) => {
        const s = suggestionsFor(tm, u.name);
        return { name: u.name, target: '', kind: u.kind, where: where(u.where), ...(s.length ? { suggestions: s } : {}) };
      });
      const chars = units.reduce((n, u) => n + u.source.length, 0) + terms.reduce((n, u) => n + u.name.length, 0);
      const file = path.join(out, lang, ...`${t.id}.${po ? 'po' : 'json'}`.split('/'));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (po) fs.writeFileSync(file, toPo(lang, t.id, units, terms));
      else fs.writeFileSync(file, `${JSON.stringify({ format: WORKLIST_FORMAT, version: WORKLIST_VERSION, lang, table: t.id, count: units.length + terms.length, chars, units, terms }, null, 2)}\n`);
      files++;
      total += units.length + terms.length;
      const changed = units.filter((u) => u.previous).length;
      console.log(`${rel(file)}: ${count(units.length - changed, 'untranslated unit')}, ${count(changed, 'changed unit')}, ${count(terms.length, 'term')}, ${chars.toLocaleString('en-US')} characters`);
      if (t.orphans.units.length + t.orphans.terms.length) console.log(`  ${count(t.orphans.units.length + t.orphans.terms.length, 'orphan')}: --prune drops them`);
    }
  }
  // unit texts the data holds no key for: no worklist can name them (they stay English)
  for (const { id, units } of keylessUnits(ws.sources)) {
    if (only && !only.includes(id)) continue;
    console.log(`  ! ${id}: ${count(units.length, 'unit text')} with no key in the data (first: ${units[0].where}) — not listed: run npm run i18n:keys -- --assign first`);
  }
  console.log(`${count(files, 'worklist')}, ${total} entr${total === 1 ? 'y' : 'ies'} to translate${refused ? `, ${refused} refused` : ''}`);
  return refused ? 1 : 0;
}

/**
 * Where a text is used, as a PO reference (`#:`): `<file>:<line>` when the place has a line (code,
 * a .story file), else `<file>:<key>` — no white space (gettext tools split references on it). The
 * readable place goes into a `#.` note.
 * @param {string} where
 * @param {string} [key]
 */
function poReference(where, key) {
  const file = where.split(' › ')[0].replace(/\s+\(.*\)$/, '');
  const ref = /:\d+$/.test(file) || !key ? file : `${file}:${key}`;
  return ref.replace(/\s/g, '%20');
}

/** A PO date: `YYYY-MM-DD HH:MM+0000` (UTC). */
function poDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}+0000`;
}

/**
 * A worklist as a PO file (tools/lib/po.mjs).
 * @param {string} lang
 * @param {string} table
 * @param {any[]} units
 * @param {any[]} terms
 */
function toPo(lang, table, units, terms) {
  const notes = (e) => [
    `kind: ${e.kind}`,
    ...(e.speaker ? [`speaker: ${e.speaker}`] : []),
    ...(e.before ? [`before: ${e.before}`] : []),
    ...(e.after ? [`after: ${e.after}`] : []),
    ...(e.type ? [`type: ${e.type}`] : []),
    ...(e.previous ? [
      'changed: the English was edited since it was translated — translate the new English (the old translation is below), then remove "fuzzy"',
      `previous translation: ${e.previous.target}`,
    ] : []),
    ...(e.suggestions ?? []).map((s) => `suggestion: ${s.target} (${s.from})`),
    ...e.where.map((w) => `where: ${w}`),
  ];
  const refs = (e, key) => [...new Set(e.where.filter((w) => !w.startsWith('… and ')).map((w) => poReference(w, key)))];
  return serializePo({
    comments: [`Luminati content text: ${lang}/${table} — merge with node tools/i18n-worklist.mjs --merge=<this file> (docs/specs/I18N.md §4.7)`],
    fields: {
      'PO-Revision-Date': poDate(), 'Last-Translator': 'none yet', 'Language-Team': `Luminati ${lang}`,
      Language: lang, [PO_TABLE_FIELD]: table, [PO_VERSION_FIELD]: String(WORKLIST_VERSION),
    },
    entries: [
      ...units.map((e) => ({
        extracted: notes(e), references: refs(e, e.key), msgctxt: e.key, msgid: e.source, msgstr: '',
        // (a changed unit: fuzzy, with the old English; its msgstr stays empty — the old translation,
        // in a note, is no translation of the new English)
        ...(e.previous ? { flags: ['fuzzy'], previous: { msgid: e.previous.source } } : {}),
      })),
      ...terms.map((e) => ({ extracted: notes(e), references: refs(e), msgctxt: 'term', msgid: e.name, msgstr: '' })),
    ],
  });
}

// =================================================================================================
// Merge
// =================================================================================================

/**
 * A PO file's language as the index names it: `ja_JP`, `ja-JP`, `JA`, `ja_JP.UTF-8` → `ja`.
 * @param {unknown} v
 */
function poLang(v) {
  return typeof v === 'string' ? v.trim().toLowerCase().split(/[-_.@]/)[0] : '';
}

/**
 * One worklist file read: its language and table, and its entries (`term`: a term, `name` its name;
 * else a unit by `key`), or why it cannot be merged.
 * @param {string} f
 * @returns {{ lang: string, table: string, units: { key: unknown, source: unknown, target: unknown, fuzzy: boolean, at: string }[],
 *   terms: { name: unknown, target: unknown, fuzzy: boolean, at: string }[], problems: string[] } | { error: string }}
 */
function readWorklist(f) {
  let text;
  try { text = fs.readFileSync(f, 'utf8'); } catch (e) { return { error: e.message }; }
  if (f.endsWith('.po')) {
    const p = parsePo(text);
    const lang = poLang(p.header.Language);
    const table = p.header[PO_TABLE_FIELD];
    if (!lang || !isTableId(table)) return { error: `not a worklist PO file (its header names no Language and ${PO_TABLE_FIELD})` };
    const v = p.header[PO_VERSION_FIELD];
    if (v !== undefined && Number(v) !== WORKLIST_VERSION) return { error: `not a version-${WORKLIST_VERSION} worklist (its header says ${PO_VERSION_FIELD}: ${v})` };
    const units = [];
    const terms = [];
    const problems = p.errors.map((e) => `line ${e.line}: ${e.msg}`);
    for (const e of p.entries) {
      const fuzzy = e.flags.includes('fuzzy');
      const at = `line ${e.line}`;
      if (e.msgctxt === null) problems.push(`${at}: "${clip(e.msgid, 40)}" has no msgctxt (the key, or "term") — skipped`);
      else if (e.msgctxt === 'term') terms.push({ name: e.msgid, target: e.msgstr, fuzzy, at });
      else units.push({ key: e.msgctxt, source: e.msgid, target: e.msgstr, fuzzy, at });
    }
    return { lang, table, units, terms, problems };
  }
  let w;
  // (a byte-order mark, as Notepad writes one, is no error)
  try { w = JSON.parse(text.replace(/^\uFEFF/, '')); } catch (e) { return { error: e.message }; }
  if (w?.format !== WORKLIST_FORMAT || typeof w.lang !== 'string' || !isTableId(w.table)) return { error: `not a worklist (format "${WORKLIST_FORMAT}" with lang and table)` };
  if (!(w.version === WORKLIST_VERSION) || !Array.isArray(w.units ?? []) || !Array.isArray(w.terms ?? [])) return { error: `not a version-${WORKLIST_VERSION} worklist (units and terms)` };
  const units = (w.units ?? []).map((e, k) => ({ key: e?.key, source: e?.source, target: e?.target, fuzzy: e?.fuzzy === true, at: `units[${k}]` }));
  const terms = (w.terms ?? []).map((e, k) => ({ name: e?.name, target: e?.target, fuzzy: e?.fuzzy === true, at: `terms[${k}]` }));
  return { lang: w.lang, table: w.table, units, terms, problems: [] };
}

/**
 * A table being merged into: its entries, what lives in it and what its readers show.
 * @typedef {object} Target
 * @property {string} lang
 * @property {string} id
 * @property {string[]} ext
 * @property {Map<string, ContentUnit>} units
 * @property {Map<string, string>} terms
 * @property {number} changed                   entries merged (or kept for another reader)
 * @property {number} kept                      units kept for another reader
 * @property {Map<string, string[]>} at         key → the Englishes its readers show there that live in this table
 * @property {Map<string, string>} elsewhere    key → the table the English its readers show there lives in (not this one)
 * @property {string[]} names                   the names that live in this table
 * @property {Map<string, string>} namesElsewhere   a name its readers show that lives in another table → that table
 * @property {Map<string, { was: string, target: string }>} previous   key → the unit a review there replaces (`changed`)
 * @property {Map<string, UnitClass>} cls
 * @property {ReturnType<typeof checkLanguage>['model']} model
 */

/**
 * Merge filled worklists into the tables.
 * @param {string} where a worklist file or a folder of them
 * @returns {Promise<number>}
 */
async function merge(where) {
  const abs = path.resolve(process.cwd(), where);
  if (!fs.existsSync(abs)) { console.error(`${where}: not found`); return 2; }
  /** @type {string[]} */
  const files = [];
  const walk = (p) => {
    if (fs.statSync(p).isDirectory()) for (const e of fs.readdirSync(p).sort()) walk(path.join(p, e));
    else if (p.endsWith('.json') || p.endsWith('.po')) files.push(p);
  };
  walk(abs);
  const ws = await loadWorkspace({ root });
  if (brokenIndex(ws.index)) return 1;
  let refused = 0;
  let merged = 0;
  let skipped = 0;
  let blank = 0;
  /** @type {Map<string, ReturnType<typeof checkLanguage>>} */
  const reports = new Map();
  const reportOf = (/** @type {string} */ lang) => {
    let r = reports.get(lang);
    if (!r) reports.set(lang, (r = checkLanguage(ws, lang)));
    return r;
  };
  /** @type {Map<string, Target|null>} `<lang>/<id>` → the table being merged into (null: refused) */
  const touched = new Map();

  /**
   * Open a table to merge into (once): the refusals, then its entries. Null (the reason printed the
   * first time) when it is refused.
   * @param {string} lang
   * @param {string} id
   * @param {string} who what asks (for the messages)
   * @returns {Target|null}
   */
  const open = (lang, id, who) => {
    const key = `${lang}/${id}`;
    if (touched.has(key)) {
      const t = touched.get(key);
      if (!t) console.error(`${who}: ${key}.json — refused (see above)`);
      return t;
    }
    const report = reportOf(lang);
    const rep = report.tables.find((x) => x.id === id);
    const r = report.model.files.get(id);
    /** @type {Target|null} */
    let t = null;
    const why = r ? rewriteRefusal(r) : '';
    if (!rep) console.error(`${who}: index.json does not list ${id} for ${lang} — run --init`);
    else if (!r) console.error(`${who}: ${key}.json does not exist — run --init`);
    else if (why && !forced('table')) console.error(`${who}: ${key}.json ${why} — refused (--force=table rewrites it)`);
    else if (rep.sourceErrors.length && !forced('sources')) {
      console.error(`${who}: ${key}.json — a source of it or of a table reading it had errors (${clip(rep.sourceErrors[0], 120)}${rep.sourceErrors.length > 1 ? ` and ${rep.sourceErrors.length - 1} more` : ''}): what its readers show cannot be told — refused until the source is fixed (--force=sources merges anyway)`);
    } else {
      if (why) console.log(`  ! ${key}.json ${why} — rewritten (--force)`);
      if (rep.sourceErrors.length) console.log(`  ! ${key}.json: a source had errors (${clip(rep.sourceErrors[0], 80)}) — merged anyway (--force)`);
      // what the file holds that the loader drops: the rewritten file leaves it out
      for (const x of r.warnings) console.log(`  ! ${x} — the rewritten file leaves it out`);
      const m = report.model;
      /** @type {Map<string, string[]>} */
      const at = new Map();
      /** @type {Map<string, string>} */
      const elsewhere = new Map();
      /** @type {Set<string>} */
      const names = new Set();
      /** @type {Map<string, string>} */
      const namesElsewhere = new Map();
      for (const rd of readersOf(id, m.listed, m.closure)) {
        const s = m.shownBy(rd);
        for (const [k, e] of s.units) {
          const h = m.homeOf(rd, { key: k, text: e.text });
          if (h !== id) { if (!elsewhere.has(k)) elsewhere.set(k, h); continue; }
          let l = at.get(k);
          if (!l) at.set(k, (l = []));
          if (!l.includes(e.text)) l.push(e.text);
        }
        for (const n of s.terms.keys()) {
          const h = m.homeOf(rd, { text: n, term: true });
          if (h === id) names.add(n);
          else if (!namesElsewhere.has(n)) namesElsewhere.set(n, h);
        }
      }
      t = {
        lang, id, ext: r.table.extends, units: new Map(r.table.units), terms: new Map(r.table.terms), changed: 0, kept: 0,
        at, elsewhere, names: [...names], namesElsewhere, previous: new Map(rep.changed.map((c) => [c.key, { was: c.was, target: c.target }])),
        cls: report.classes.get(id) ?? new Map(), model: m,
      };
    }
    touched.set(key, t);
    return t;
  };

  /**
   * A unit about to be replaced at `key` that other readers still show there with its old English
   * (a line edited in a shipped level whose campaign copy is not): kept for them, in the table it
   * lives in for each of them (`entryHomes`), before the new one replaces it. False (the reason
   * printed) when that cannot be done.
   * @param {Target} t
   * @param {string} key
   * @param {ContentUnit} had
   * @param {string[]} readers
   * @param {string} label
   */
  const keepFor = (t, key, had, readers, label) => {
    /** @type {[Target, string][]} */
    const plan = [];
    for (const rd of readers) {
      const h = t.model.homeOf(rd, { key, text: had.source });
      const o = h === t.id ? null : open(t.lang, h, label);
      const there = o?.units.get(key);
      let why = '';
      if (h === t.id) why = `its English lives in ${t.id} for ${rd} too`;
      else if (!o) why = `${h} cannot take it`;
      else if (there && there.source !== had.source) why = `${h} holds another unit at this key ("${clip(there.source, 40)}")`;
      if (why) {
        console.error(`  ✗ ${label}: ${rd} still shows the old English here ("${clip(had.source, 40)}"), and ${why} — refused`);
        return false;
      }
      if (!there) plan.push([o, rd]);
    }
    for (const [o, rd] of plan) {
      if (o.units.has(key)) continue;
      o.units.set(key, { ...had });
      o.changed++;
      o.kept++;
      console.log(`  ! ${label}: ${rd} still shows the old English ("${clip(had.source, 40)}") — its translation is kept for it in ${o.id}`);
    }
    return true;
  };

  for (const f of files) {
    const w = readWorklist(f);
    if ('error' in w) { console.error(`${rel(f)}: ${w.error}`); refused++; continue; }
    if (langs && !langs.includes(w.lang)) continue;
    if (only && !only.includes(w.table)) continue;
    for (const p of w.problems) console.log(`  ! ${rel(f)}: ${p}`);
    if (!ws.index.languages.get(w.lang)?.has(w.table)) {
      const known = ws.index.languages.has(w.lang);
      console.error(`${rel(f)}: index.json does not list ${w.table} for ${w.lang}${known ? ' — run --init' : ` (its languages: ${[...ws.index.languages.keys()].join(', ') || 'none'}; --init --lang=${w.lang} adds one)`}`);
      refused++;
      continue;
    }
    const key = `${w.lang}/${w.table}`;
    const t = open(w.lang, w.table, rel(f));
    if (!t) { refused++; continue; }
    for (const e of w.units) {
      if (typeof e.target !== 'string' || !e.target.trim()) { blank++; continue; }
      const label = `${key} ${typeof e.key === 'string' ? e.key : '(no key)'}`;
      if (typeof e.key !== 'string' || typeof e.source !== 'string') { console.error(`  ✗ ${rel(f)} ${e.at}: a unit needs a key and its English — refused`); refused++; continue; }
      if (!isTextKey(e.key)) {
        console.log(`  - ${label}: not a text key (a GUID, <GUID>.2 or a code key: the key the data holds) — skipped`);
        skipped++;
        continue;
      }
      const target = lf(e.target);
      // a fuzzy entry whose translation is still the old one (of the old English): never merged
      const pv = t.previous.get(e.key);
      if (e.fuzzy && pv && target.trim() === pv.target.trim()) {
        console.log(`  - ${label}: fuzzy, and its translation is still the old one (of "${clip(pv.was, 40)}") — skipped: translate the new English, then remove the fuzzy flag`);
        skipped++;
        continue;
      }
      if (e.fuzzy && !forced('fuzzy')) { console.log(`  - ${label}: fuzzy (a changed English to review) — skipped (remove the fuzzy flag once reviewed; --force=fuzzy merges it)`); skipped++; continue; }
      const shown = t.at.get(e.key);
      if (!shown) {
        const h = t.elsewhere.get(e.key);
        console.log(`  - ${label}: ${h ? `its English lives in ${h}, not in ${t.id}` : `no reader of ${t.id} shows this key`} — skipped`);
        skipped++;
        continue;
      }
      const source = e.source;
      let english = shown.find((x) => sameEnglish(x, source));
      if (english === undefined) {
        if (!forced('english')) { console.log(`  - ${label}: the English is now "${clip(shown[0])}", the worklist has "${clip(source)}" — skipped (--force=english merges it)`); skipped++; continue; }
        english = shown[0];
        console.log(`  ! ${label}: merged onto the English now at the key, "${clip(english)}" (--force)`);
      }
      const mi = markupIssues(english, target);
      for (const x of mi.warnings) console.log(`  ! ${label}: ${x}`);
      if (mi.errors.length) {
        if (!forced('markup')) {
          for (const x of mi.errors) console.error(`  ✗ ${label}: ${x} — refused (--force=markup merges it anyway)`);
          refused++;
          continue;
        }
        for (const x of mi.errors) console.log(`  ! ${label}: merged despite a markup error: ${x} (--force)`);
      }
      const had = t.units.get(e.key);
      if (had && had.source === english && had.target === target) continue;
      if (had && had.source !== english) {
        // another reader may still show the old English here: keep its translation for it
        const c = t.cls.get(e.key);
        if (c?.cls === 'used' && !keepFor(t, e.key, had, c.readers ?? [], label)) { refused++; continue; }
      }
      t.units.set(e.key, { source: english, target, ...(had?.note ? { note: had.note } : {}) });
      t.changed++;
      merged++;
    }
    for (const e of w.terms) {
      if (typeof e.target !== 'string' || !e.target.trim()) { blank++; continue; }
      if (typeof e.name !== 'string') { console.error(`  ✗ ${rel(f)} ${e.at}: a term needs its name — refused`); refused++; continue; }
      const label = `${key} term "${clip(e.name, 40)}"`;
      if (e.fuzzy && !forced('fuzzy')) { console.log(`  - ${label}: fuzzy — skipped`); skipped++; continue; }
      const written = e.name;
      const name = t.names.find((n) => sameEnglish(n, written));
      if (name === undefined) {
        const h = [...t.namesElsewhere].find(([n]) => sameEnglish(n, written))?.[1];
        console.log(`  - ${label}: ${h ? `the name lives in ${h}, not in ${t.id}` : `nothing that reads ${t.id} shows this name`} — skipped`);
        skipped++;
        continue;
      }
      const target = lf(e.target);
      const mi = markupIssues(name, target, { name: true });
      for (const x of mi.warnings) console.log(`  ! ${label}: ${x}`);
      if (mi.errors.length) {
        if (!forced('markup')) {
          for (const x of mi.errors) console.error(`  ✗ ${label}: ${x} — refused (--force=markup merges it anyway)`);
          refused++;
          continue;
        }
        for (const x of mi.errors) console.log(`  ! ${label}: merged despite a markup error: ${x} (--force)`);
      }
      if (t.terms.get(name) === target) continue;
      t.terms.set(name, target);
      t.changed++;
      merged++;
    }
  }
  for (const t of touched.values()) {
    if (!t || !t.changed) continue;
    const file = tableFile(t.lang, t.id, dir);
    const what = `${count(t.changed - t.kept, 'entry', 'entries')}${t.kept ? ` (${t.kept} kept for another reader)` : ''}`;
    if (dryRun) console.log(`${rel(file)}: ${what} would change`);
    else {
      fs.writeFileSync(file, serializeTable({ lang: t.lang, id: t.id, extends: t.ext, terms: t.terms, units: t.units }));
      console.log(`${rel(file)}: ${what} merged`);
    }
  }
  console.log(`${merged} translation(s) ${dryRun ? 'to merge' : 'merged'}, ${skipped} skipped, ${blank} blank, ${refused} refused`);
  return refused ? 1 : 0;
}

// =================================================================================================
// Prune
// =================================================================================================

/**
 * `--prune`: drop orphan units (no reader shows their key: the text was deleted) and orphan terms.
 * @returns {Promise<number>}
 */
async function prune() {
  const ws = await loadWorkspace({ root, langs });
  if (ws.index.missing) { console.error('public/i18n/index.json does not exist: run with --init first'); return 2; }
  if (brokenIndex(ws.index)) return 1;
  let refused = 0;
  let done = 0;
  for (const lang of ws.langs) {
    const report = checkLanguage(ws, lang);
    for (const t of report.tables) {
      if (only && !only.includes(t.id)) continue;
      const r = report.model.files.get(t.id);
      if (!r) continue;
      const key = `${lang}/${t.id}`;
      const n = t.orphans.units.length + t.orphans.terms.length;
      if (!n) continue;
      const why = rewriteRefusal(r);
      if (why && !forced('table')) { console.error(`${key}.json ${why} — refused (--force=table rewrites it)`); refused++; continue; }
      if (t.sourceErrors.length && !forced('sources')) {
        console.error(`${key}.json: a source of it or of a table reading it had errors (${clip(t.sourceErrors[0], 120)}${t.sourceErrors.length > 1 ? ` and ${t.sourceErrors.length - 1} more` : ''}): its entries may well be in use — refused until the source is fixed (--force=sources prunes anyway)`);
        refused++;
        continue;
      }
      for (const x of r.warnings) console.log(`  ! ${x} — the rewritten file leaves it out`);
      const units = new Map(r.table.units);
      const terms = new Map(r.table.terms);
      for (const o of t.orphans.units) { units.delete(o.key); console.log(`  ${key} − ${o.key}: "${clip(o.source, 50)}"`); }
      for (const name of t.orphans.terms) { terms.delete(name); console.log(`  ${key} − term "${clip(name, 50)}"`); }
      done += n;
      const file = tableFile(lang, t.id, dir);
      if (dryRun) console.log(`${rel(file)}: ${count(n, 'entry', 'entries')} would change`);
      else {
        fs.writeFileSync(file, serializeTable({ lang, id: t.id, extends: r.table.extends, terms, units }));
        console.log(`${rel(file)}: ${count(n, 'entry dropped', 'entries dropped')}`);
      }
    }
  }
  console.log(`prune: ${done} entr(ies) dropped${dryRun ? ' (dry run: nothing written)' : ''}, ${refused} refused`);
  return refused ? 1 : 0;
}

// =================================================================================================
// Init
// =================================================================================================

/**
 * Create the index and the missing (empty) tables.
 * @returns {Promise<number>}
 */
async function init() {
  const index = readIndex(dir);
  if (brokenIndex(index)) return 1;
  const languages = new Map(index.languages);
  for (const l of langs ?? (languages.size ? [] : ['ja', 'zh'])) {
    if (!/^[a-z]{2,3}$/.test(l) || l === 'en') { console.error(`--lang: "${l}" is not a translated language code`); return 2; }
    if (!languages.has(l)) languages.set(l, new Set());
  }
  const { SHIPPED_LEVELS } = await import(pathToFileURL(path.join(root, 'src', 'game', 'levels.js')).href);
  /** @type {Map<string, string[]>} table → extends */
  const wanted = new Map([['common', []]]);
  for (const l of SHIPPED_LEVELS) wanted.set(`levels/${l.value}`, []);
  for (const name of trackedCampaigns()) {
    const folder = path.join(root, 'public', 'campaigns', name);
    const ext = [];
    for (const f of fs.existsSync(path.join(folder, 'levels')) ? fs.readdirSync(path.join(folder, 'levels')).sort() : []) {
      const id = f.replace(/\.json$/, '');
      const shipped = path.join(root, 'public', 'levels', f);
      if (!wanted.has(`levels/${id}`) || !fs.existsSync(shipped)) continue;
      const a = JSON.parse(fs.readFileSync(path.join(folder, 'levels', f), 'utf8'));
      const b = JSON.parse(fs.readFileSync(shipped, 'utf8'));
      if (a?.name === b?.name) ext.push(`levels/${id}`);
    }
    wanted.set(`campaigns/${name}`, ext);
  }
  let created = 0;
  for (const [lang, set] of languages) {
    for (const [id, ext] of [...wanted].sort((a, b) => tableOrder(a[0], b[0]))) {
      set.add(id);
      const file = tableFile(lang, id, dir);
      if (fs.existsSync(file)) continue;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, serializeTable({ lang, id, extends: ext }));
      created++;
      console.log(`created ${rel(file)}${ext.length ? ` (extends ${ext.join(', ')})` : ''}`);
    }
  }
  const text = serializeIndex(languages);
  const indexFile = path.join(dir, 'index.json');
  if (!fs.existsSync(indexFile) || fs.readFileSync(indexFile, 'utf8') !== text) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(indexFile, text);
    console.log(`wrote ${rel(indexFile)}`);
  }
  console.log(`${created} table(s) created; ${languages.size} language(s): ${[...languages.keys()].join(', ')}`);
  return 0;
}

/** The campaigns in git (a user's untracked campaign gets no table unless asked: --table). */
function trackedCampaigns() {
  const all = fs.existsSync(path.join(root, 'public', 'campaigns')) ? fs.readdirSync(path.join(root, 'public', 'campaigns')).filter((n) => fs.existsSync(path.join(root, 'public', 'campaigns', n, 'campaign.json'))) : [];
  let tracked = null;
  try {
    if (root === ROOT) tracked = new Set(execSync('git ls-files public/campaigns', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\n').map((l) => l.split('/')[2]).filter(Boolean));
  } catch { /* no git: every campaign folder */ }
  const picked = all.filter((n) => !tracked || tracked.has(n) || only?.includes(`campaigns/${n}`));
  return picked.sort();
}
