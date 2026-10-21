#!/usr/bin/env node
/**
 * check-i18n.mjs — the content tables' checker (docs/specs/I18N.md §4.7). Read-only.
 *
 *   node tools/check-i18n.mjs [--lang=ja[,zh]] [--table=<id>[,…]] [--strict] [--complete] [--json] [--verbose] [--quiet]
 *   npm run i18n:check -- …
 *     --lang     the languages to check (default: every language of public/i18n/index.json)
 *     --table    the tables to report (`common`, `levels/emberfall`, `campaigns/ferrymans-lantern` …)
 *     --strict   warnings fail the run too
 *     --complete anything untranslated fails the run too (the shipped languages are complete: I18N.md §4.1)
 *     --json     the whole report as JSON (nothing else on stdout)
 *     --verbose  every untranslated entry with where it is used (default: the first three per table),
 *                and the info lines
 *     --quiet    the problems and the summary only
 *     --root     another repository-shaped folder to check (tools/test-i18n.mjs's fixtures)
 *
 * Every table the index lists, against the units and terms its readers show
 * (src/engine/i18n/ContentStrings.js on the level, campaign and story files; `loc('<code key>', …)`
 * calls and the common terms for `common` — tools/lib/i18n.mjs `checkLanguage`). A unit's key is
 * the text key the data holds beside its text (a GUID, docs/specs/I18N.md §4.2), kept through every
 * edit — nothing moves when a page is inserted:
 *  - volume: the English to translate per table (units and terms, characters, words, estimated
 *    Japanese and Chinese characters);
 *  - untranslated: units (key, English, where) and terms a reader's lookup chain does not translate,
 *    given to the table they live in (a new line, a new page: untranslated; the others stay
 *    translated);
 *  - warnings: changed units (the same key, another source: the English was edited — the game
 *    shows the English until it is reviewed; old and new, and a hint when the old English now sits
 *    at the key beside it: keys out of step after a hand edit), orphan units and terms (no source
 *    holds the key, or no reader shows the name: `i18n-worklist --prune` — or "source unreadable"
 *    when a source of the table or of a reader had errors: then nothing is pruned), unit texts the
 *    data holds no key for ("no key": they stay English — `npm run i18n:keys -- --assign`; one line
 *    per table), gold spans / line breaks / key hints / arrows that differ, a target identical to
 *    the English (info for terms), a gold `{Term}` span whose translation is not the term's, a term
 *    translated differently in two tables or by the UI (the UI glossary, `uiGlossary`), a table
 *    file the index does not list, and a script's quest text with `${…}` values (saved filled in);
 *  - errors: markup (`${…}` values that differ, unbalanced braces), empty or non-string entries and
 *    what else the loader drops (a table file that is not version 3: not read at all), one key with
 *    two Englishes among one table's own sources (a copy of a line edited apart: `npm run i18n:keys
 *    -- --fix`; a campaign's copy of a shipped level may differ from it along `extends`), a listed
 *    table file missing or naming another language or source, an `extends` the index does not list,
 *    `loc()` call errors in the code;
 *  - a file that is not JSON (the index or a table) is an error line, never a crash.
 *
 * Exit code: 1 on errors (with --strict: on warnings too; with --complete: on anything
 * untranslated too), 2 on usage errors (an unknown option, a --table the index does not list), else 0.
 */
import path from 'node:path';
import { parseArgs } from './lib/levelgen.mjs';
import {
  loadWorkspace, checkLanguage, entryVolume, uiGlossary, tableFilesOf, sourceWarnings, keylessUnits, keylessWarnings, tableOrder, clip, RATIOS,
  UI_TABLE_DIRS, UI_FEATURE_ROOT,
} from './lib/i18n.mjs';
import { isTableId } from '../src/engine/i18n/ContentText.js';

const args = parseArgs(process.argv.slice(2));
const list = (v) => (typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : null);
const langs = list(args.lang);
const only = list(args.table);
const USAGE = 'usage: node tools/check-i18n.mjs [--lang=ja] [--table=<id>[,…]] [--strict] [--complete] [--json] [--verbose] [--quiet]';
if (args.help) {
  console.log(USAGE);
  process.exit(0);
}
for (const k of Object.keys(args)) {
  if (k === 'sync') { console.error('--sync is gone: a unit is keyed by the text key the data holds (docs/specs/I18N.md §4.2), so nothing moves'); process.exit(2); }
  if (!['lang', 'table', 'strict', 'complete', 'json', 'verbose', 'quiet', 'root', 'help'].includes(k)) { console.error(`unknown option "${k}"\n${USAGE}`); process.exit(2); }
}
for (const k of ['lang', 'table', 'root']) if (args[k] === true || args[k] === '') { console.error(`--${k} needs a value\n${USAGE}`); process.exit(2); }
if (only) for (const id of only) if (!isTableId(id)) { console.error(`--table: "${id}" is not a table id (common, levels/<name>, campaigns/<name>)`); process.exit(2); }

const t0 = performance.now();
// (--root: another repository-shaped folder — the self-test's fixtures)
const ws = await loadWorkspace({ langs, ...(typeof args.root === 'string' ? { root: path.resolve(process.cwd(), args.root) } : {}) });
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const quiet = !!args.quiet;
const json = !!args.json;
const verbose = !!args.verbose;
/** @type {string[]} */
const globalErrors = [];
/** @type {string[]} */
const globalWarnings = [];
/** @type {string[]} */
const globalInfo = [];

if (ws.index.missing) globalErrors.push('public/i18n/index.json does not exist (node tools/i18n-worklist.mjs --init creates it)');
for (const w of ws.index.warnings) globalErrors.push(`index.json: ${w.replace(/^index: /, '')}`);
if (langs) for (const l of langs) if (!ws.index.languages.has(l)) globalErrors.push(`--lang: index.json lists no language "${l}"`);
// index ↔ files
const allListed = new Set([...ws.index.languages.values()].flatMap((s) => [...s]));
if (only && !ws.index.missing && !ws.index.broken) {
  // (a misspelt --table would report nothing and pass: a usage error)
  const unknown = only.filter((id) => !allListed.has(id));
  if (unknown.length) { console.error(`--table: index.json lists no table ${unknown.join(', ')} (it lists ${[...allListed].sort(tableOrder).join(', ') || 'none'})`); process.exit(2); }
}
for (const lang of ws.langs) {
  const listed = ws.index.languages.get(lang);
  for (const id of tableFilesOf(lang, ws.dir)) if (!listed.has(id)) globalWarnings.push(`${lang}/${id}.json is not listed in index.json: the game never loads it`);
  for (const id of allListed) if (!listed.has(id)) globalInfo.push(`${lang}: no table ${id} (it stays English)`);
}
// the sources: loc() errors in the code, keys with two Englishes among a table's own sources …
const common = ws.sources.get('common');
for (const e of common.errors) globalErrors.push(e);
for (const i of common.info) globalInfo.push(i);
for (const [id, s] of ws.sources) if (id !== 'common') for (const e of s.errors) globalErrors.push(`${id}: ${e}`);
for (const w of sourceWarnings(ws.sources)) globalWarnings.push(w);
// unit texts the data holds no key for: they stay English (one warning per table; --json lists each)
const keyless = keylessUnits(new Map([...ws.sources].filter(([id]) => !only || only.includes(id))));
for (const w of keylessWarnings(keyless, verbose ? 10 : 3)) globalWarnings.push(w);

const ui = await uiGlossary(ws.root);
const vol = entryVolume(ws.held);
const reports = ws.langs.map((lang) => checkLanguage(ws, lang, { ui: ui.names }));

const shownTables = (r) => r.tables.filter((t) => !only || only.includes(t.id));
// (a term's and the glossary's lines name their tables: with --table, the lines naming one of them)
const shownLines = (list) => list.filter((m) => !only || only.some((id) => m.includes(` ${id} `)));
let nErr = globalErrors.length;
let nWarn = globalWarnings.length;
for (const r of reports) {
  for (const t of shownTables(r)) { nErr += t.errors.length; nWarn += t.warnings.length; }
  nWarn += shownLines(r.terms).length + shownLines(r.glossary).length;
}
const chars = (t) => t.untranslated.units.reduce((n, u) => n + u.chars, 0) + t.untranslated.terms.reduce((n, u) => n + u.chars, 0);
// (untranslated entries are neither errors nor warnings: a new line stays English until translated;
// --complete fails the run on them — the shipped languages are complete)
const nUntr = reports.reduce((n, r) => n + shownTables(r).reduce((k, t) => k + t.untranslated.units.length + t.untranslated.terms.length, 0), 0);
const complete = !!args.complete;
const failed = nErr || (args.strict && nWarn) || (complete && nUntr);
const ms = Math.round(performance.now() - t0);
const volRows = [...vol].filter(([id]) => (id === 'common' || allListed.has(id)) && (!only || only.includes(id))).sort((a, b) => tableOrder(a[0], b[0]));

if (json) {
  const out = {
    languages: Object.fromEntries(reports.map((r) => [r.lang, {
      tables: shownTables(r).map((t) => ({
        id: t.id, exists: t.exists, version: t.version, translated: t.translated,
        untranslated: { count: t.untranslated.units.length + t.untranslated.terms.length, chars: chars(t), units: t.untranslated.units, terms: t.untranslated.terms },
        changed: t.changed, orphans: t.orphans, sourceErrors: t.sourceErrors, errors: t.errors, warnings: t.warnings, info: t.info,
      })),
      terms: shownLines(r.terms),
      glossary: shownLines(r.glossary),
    }])),
    volume: Object.fromEntries(volRows.map(([id, v]) => [id, { ...v, ja: Math.round(v.chars * RATIOS.ja), zh: Math.round(v.chars * RATIOS.zh) }])),
    noKey: Object.fromEntries(keyless.map((x) => [x.id, x.units.map((e) => ({ text: e.text, kind: e.kind, where: e.where }))])),
    ui: { modules: ui.modules, notes: ui.notes, missing: ui.missing },
    errors: globalErrors, warnings: globalWarnings, info: globalInfo,
    summary: { errors: nErr, warnings: nWarn, untranslated: nUntr, ms },
  };
  console.log(JSON.stringify(out, null, 2));
  process.exit(failed ? 1 : 0);
}

const totalUnits = volRows.reduce((n, [, v]) => n + v.units, 0);
const totalTerms = volRows.reduce((n, [, v]) => n + v.terms, 0);
const totalChars = volRows.reduce((n, [, v]) => n + v.chars, 0);
console.log(`content i18n · ${ws.langs.length ? ws.langs.join(', ') : 'no language'} · ${only ? only.length : allListed.size} table(s) · ${fmt(totalUnits)} units + ${fmt(totalTerms)} terms (${fmt(totalChars)} characters of English)${args.strict ? ' · strict' : ''}${complete ? ' · complete' : ''} · ${ms} ms`);

if (!quiet) {
  console.log('');
  console.log('Volume — the English to translate, by the table it lives in');
  const pad = (s, n) => String(s).padEnd(n);
  const num = (s, n) => String(s).padStart(n);
  console.log(`  ${pad('table', 34)}${num('units', 7)}${num('terms', 7)}${num('chars', 9)}${num('words', 8)}${num('~ja', 8)}${num('~zh', 8)}`);
  let tu = 0; let tt = 0; let tc = 0; let tw = 0;
  for (const [id, v] of volRows) {
    tu += v.units; tt += v.terms; tc += v.chars; tw += v.words;
    console.log(`  ${pad(id, 34)}${num(fmt(v.units), 7)}${num(fmt(v.terms), 7)}${num(fmt(v.chars), 9)}${num(fmt(v.words), 8)}${num(fmt(v.chars * RATIOS.ja), 8)}${num(fmt(v.chars * RATIOS.zh), 8)}`);
  }
  console.log(`  ${pad('total', 34)}${num(fmt(tu), 7)}${num(fmt(tt), 7)}${num(fmt(tc), 9)}${num(fmt(tw), 8)}${num(fmt(tc * RATIOS.ja), 8)}${num(fmt(tc * RATIOS.zh), 8)}`);
}

for (const r of reports) {
  const tables = shownTables(r);
  const need = tables.reduce((n, t) => n + t.untranslated.units.length + t.untranslated.terms.length, 0);
  const done = tables.reduce((n, t) => n + t.translated, 0);
  const sum = (f) => tables.reduce((n, t) => n + f(t), 0);
  console.log('');
  console.log(`${r.lang}: ${fmt(done)} translated, ${fmt(need)} untranslated (${fmt(sum(chars))} characters) · ${sum((t) => t.changed.length)} changed · ${sum((t) => t.orphans.units.length + t.orphans.terms.length)} orphan(s)`);
  for (const t of tables) {
    const nu = t.untranslated.units.length + t.untranslated.terms.length;
    const extra = [
      t.changed.length && `${t.changed.length} changed`, (t.orphans.units.length + t.orphans.terms.length) && `${t.orphans.units.length + t.orphans.terms.length} orphan(s)`,
    ].filter(Boolean);
    console.log(`  ${t.id.padEnd(32)} ${String(t.translated).padStart(5)} translated · ${String(nu).padStart(4)} untranslated (${fmt(chars(t))} chars)${extra.length ? ` · ${extra.join(' · ')}` : ''}`);
    if (!quiet) {
      const lines = [
        ...t.untranslated.units.map((u) => `      ${u.key} "${clip(u.text, 70)}" — ${u.where.slice(0, verbose ? 3 : 1).join('; ')}${u.where.length > (verbose ? 3 : 1) ? ` (+${u.where.length - (verbose ? 3 : 1)})` : ''}`),
        ...t.untranslated.terms.map((u) => `      term "${clip(u.name, 50)}" [${u.kind}] — ${u.where.slice(0, verbose ? 3 : 1).join('; ')}${u.where.length > (verbose ? 3 : 1) ? ` (+${u.where.length - (verbose ? 3 : 1)})` : ''}`),
      ];
      for (const l of verbose ? lines : lines.slice(0, 3)) console.log(l);
      if (!verbose && lines.length > 3) console.log(`      … ${lines.length - 3} more (--verbose lists them)`);
    }
    for (const m of t.warnings) console.log(`    ! ${m}`);
    for (const m of t.errors) console.log(`    ✗ ${m}`);
    if (verbose) for (const m of t.info) console.log(`    · ${m}`);
  }
  for (const m of shownLines(r.terms)) console.log(`  ! ${m}`);
  for (const g of shownLines(r.glossary)) console.log(`  ! UI glossary: ${g}`);
}

console.log('');
if (!quiet) {
  if (ui.modules.length) console.log(`UI glossary: ${ui.names.size} English UI strings from ${ui.modules.length} module(s) compared with the content's names (terms)`);
  else console.log(`UI glossary: no UI string tables yet (tools/lib/i18n.mjs uiGlossary reads ${UI_TABLE_DIRS.map((d) => `${d}/`).join(', ')} and every ${UI_FEATURE_ROOT}/**/strings.js)`);
  for (const n of ui.notes) console.log(`  · ${n}`);
  if (ui.missing.length) console.log(`  · not written yet (their names are not compared): ${ui.missing.join(', ')}`);
  for (const m of globalInfo) console.log(`· ${m}`);
}
for (const m of globalWarnings) console.log(`! ${m}`);
for (const m of globalErrors) console.log(`✗ ${m}`);
console.log(`summary: ${nErr} error(s), ${nWarn} warning(s)${nUntr || complete ? `, ${nUntr} untranslated${complete && nUntr ? ' (--complete: not complete)' : ''}` : ''}`);
process.exit(failed ? 1 : 0);
