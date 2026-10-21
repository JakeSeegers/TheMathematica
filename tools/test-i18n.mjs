#!/usr/bin/env node
/**
 * test-i18n.mjs — the Node self-test of the content text (`npm run i18n:test`, docs/specs/I18N.md
 * §4): the lookup (src/engine/i18n/ContentText.js — `loc` by the text key the data holds with its
 * recorded English, nothing found on a guess at another key, `term`, hostile keys and names, the
 * loader reading only what index.json lists, English reading nothing), the key readers
 * (ContentKeys.js), the extraction (src/engine/i18n/ContentStrings.js — every unit with the key its
 * data holds, '' for a text without one: catalog fields with raw indices, choices, script lines by
 * their `#line:` tags, story files and campaigns, built-in conversations that play a villager's
 * pages, the item and quest names a script shows, exits only in campaigns, `loc('<code key>', …)`
 * in code), the markup rules, the checker on fixture tables (tools/lib/i18n.mjs
 * `checkLanguage`: untranslated per reader chain; changed — the same key, another source —, also for
 * a reader of a shipped level a campaign extends; keys out of step; orphans; "source unreadable";
 * unit texts with no key; one key with two Englishes in a table's own sources, divergence along
 * `extends` legal; a table that is not version 3, not read; terms, gold spans; the CLI with --root,
 * --complete, usage errors), the worklist
 * (tools/i18n-worklist.mjs: JSON and PO, merge — an old line kept for the reader that still shows
 * it, the refusals and `--force=<kind>` —, --prune, --init; tools/lib/po.mjs), an inserted page,
 * reordered pages and repeated English (nothing moves), the UI glossary, Node safety, and the real
 * data: the shipped tables have no errors, no warnings and nothing untranslated, every unit the
 * extractor lists holds a text key in the data, and every unit and term comes back translated
 * through `loc` / `term` in Japanese and Chinese with no miss.
 *
 *   node tools/test-i18n.mjs [--verbose]
 *
 * Writes only into a temporary folder (removed at the end). Exit code 1 when an assertion fails.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import {
  loc, term, contentFormat, setContentTables, installContentTables, clearContentTables, contentInfo, contentMisses, clearContentMisses,
  parseContentTable, parseContentIndex, contentTableIds, loadContentTables, isTableId, CONTENT_KINDS, CONTENT_VERSION,
  CONTENT_FORMAT, CONTENT_INDEX_FORMAT,
} from '../src/engine/i18n/ContentText.js';
import {
  guidOf, isGuid, isTextKey, isCodeKey, subtitleKey, splitLineTag, textKeyOf, pageKeyOf, dialogueKeyOf, choiceKeyOf, questKeyOf, textPages,
  dialogueUnits, builtinLabel,
} from '../src/engine/i18n/ContentKeys.js';
import { assignTextKeys, seededMint } from '../src/engine/i18n/TextKeys.js';
import {
  levelStrings, storyStrings, campaignStrings, scriptStrings, scanLocCalls, lexJs, speakerResolver, keyConflicts, commonTerms, COMMON_TERMS,
} from '../src/engine/i18n/ContentStrings.js';
import {
  ROOT, markupOf, markupIssues, goldSpans, sameEnglish, lf, nodeReader, loadWorkspace, checkLanguage, extendsClosure, entryHomes, serializeTable, tableFilesOf,
  serializeIndex, uiGlossary, tableSources, sourceWarnings, keylessUnits, keyCompare, lookupUnit, lookupTerm, readersOf, rewriteRefusal, parseIssueIsError,
  translationMemory, suggestionsFor, CODE_READER, WORKLIST_VERSION, WORKLIST_FORMAT,
} from './lib/i18n.mjs';
import { serializePo, parsePo, poEscape } from './lib/po.mjs';
import { createEmptyLevel, addObject, serializeLevel, parseLevel } from '../src/engine/level/LevelFormat.js';
import { buildStory } from '../src/game/campaign/StoryFormat.js';
import { normalizeCampaign } from '../src/game/campaign/CampaignFormat.js';
import { OBJECT_TYPES } from '../src/engine/level/ObjectCatalog.js';

const verbose = process.argv.includes('--verbose');
const t0 = performance.now();
let passed = 0;
/** @type {string[]} */
const failures = [];
let section = '';
/** @type {[string, number][]} */
const sections = [];
const show = (v) => {
  try {
    return JSON.stringify(v, (_, x) => (x instanceof Set ? [...x] : x instanceof Map ? Object.fromEntries(x) : x));
  } catch {
    return String(v);
  }
};
const begin = (name) => { section = name; sections.push([name, 0]); };
/** @param {string} what @param {unknown} cond @param {unknown} [got] */
function ok(what, cond, got) {
  sections[sections.length - 1][1]++;
  if (cond) passed++;
  else failures.push(`${section}: ${what}${got !== undefined ? ` — got ${show(got).slice(0, 600)}` : ''}`);
}
const eq = (what, got, want) => ok(what, isDeepStrictEqual(got, want), got);
const hasMsg = (list, ...parts) => list.some((m) => parts.every((p) => m.includes(p)));
/** A text key for a test text: a GUID derived from its name (the same name, the same key). */
const G = (/** @type {string} */ name) => guidOf(`i18n-test|${name}`);
/** A table file's JSON (version 3 unless said). */
const v3 = (id, lang, { terms = {}, units = {}, ext = [], version = 3 } = {}) => ({ format: 'luminati-i18n', version, lang, source: id, extends: ext, terms, units });
/** A parsed table. */
const T3 = (id, o = {}, lang = 'ja') => parseContentTable(v3(id, lang, o), { id, lang }).table;
const U = (source, target) => ({ source, target });
/** Keys sorted as the tools write them. */
const sorted = (/** @type {string[]} */ l) => [...l].sort(keyCompare);

// =================================================================================================
begin('Node safety');
{
  ok('no document, no window in Node', typeof globalThis.document === 'undefined' && typeof globalThis.window === 'undefined');
  ok('the modules imported without a browser (and installed nothing)', contentInfo().lang === 'en' && contentInfo().tables.length === 0, contentInfo());
  eq('the kinds', [...CONTENT_KINDS], ['line', 'choice', 'speaker', 'name', 'label', 'title']);
  eq('the table version: 3 (units keyed by the text keys the data holds)', CONTENT_VERSION, 3);
}

// =================================================================================================
begin('loc / term: English and pass-through');
{
  clearContentTables();
  eq('no tables: loc gives the English', loc(G('a'), 'Hello, traveler!'), 'Hello, traveler!');
  eq('… term the name', term('Pip'), 'Pip');
  eq('a non-string comes back as it is', [loc('k', /** @type {any} */ (undefined)), term(/** @type {any} */ (null))], [undefined, null]);
  eq('empty stays empty', [loc('k', ''), term('')], ['', '']);
  eq('English records no miss', contentMisses(), []);
  setContentTables({ terms: { Pip: 'ピップ' }, units: { [G('a')]: U('Hello', 'やあ') } });
  eq('setContentTables: a table\'s parts', [term('Pip'), loc(G('a'), 'Hello'), contentInfo().units, contentInfo().terms], ['ピップ', 'やあ', 1, 1]);
  eq('… an unknown name or key: the English', [term('Wren'), loc(G('b'), 'Bye')], ['Wren', 'Bye']);
  setContentTables(null);
  eq('setContentTables(null): English again', [term('Pip'), contentInfo().lang], ['Pip', 'en']);
  eq('contentFormat fills ${name} slots', contentFormat('Strike with {${attack}} — again ${attack}', { attack: 'J' }), 'Strike with {J} — again J');
  eq('contentFormat: an unknown slot and gold braces stay', contentFormat('{gold} ${nope} ${toString}', {}), '{gold} ${nope} ${toString}');
  eq('contentFormat without params (null, a string): every slot stays, no throw', [contentFormat('a ${x}', /** @type {any} */ (null)), contentFormat('a ${length}', /** @type {any} */ ('str'))], ['a ${x}', 'a ${length}']);
}

// =================================================================================================
begin('hostile keys and names (KNOWN_ISSUES LVL-17)');
{
  const raw = JSON.parse('{"format":"luminati-i18n","version":3,"lang":"ja","source":"common","terms":{"__proto__":"プロト","constructor":"コンストラクタ","toString":{"toString":1},"empty":"  ","num":7},'
    + '"units":{"__proto__":{"source":"Proto line","target":"プロトの行"},"constructor":{"source":"Ctor","target":"コンス"},"hasOwnProperty":"not an object","bad.src":{"source":5,"target":"x"},'
    + '"bad.tgt":{"source":"a","target":""},"bad.tgt2":{"source":"b","target":{"toString":1}}," spaced ":{"source":"c","target":"d"}}}');
  const { table, warnings } = parseContentTable(raw, { id: 'common', lang: 'ja' });
  eq('__proto__ / constructor are plain names and keys', [table.terms.get('__proto__'), table.terms.get('constructor'), table.units.get('__proto__')?.target, table.units.get('constructor')?.target], ['プロト', 'コンストラクタ', 'プロトの行', 'コンス']);
  ok('a term that is no string, empty, or a number: dropped with a warning (no throw on {"toString": 1})', !table.terms.has('toString') && !table.terms.has('empty') && !table.terms.has('num') && hasMsg(warnings, '"toString"', 'not a string') && hasMsg(warnings, '"empty"', 'empty translation'), warnings);
  ok('a unit that is no object, whose English or translation is no string or empty: dropped with a warning', ['hasOwnProperty', 'bad.src', 'bad.tgt', 'bad.tgt2'].every((k) => !table.units.has(k)) && hasMsg(warnings, '"hasOwnProperty"', 'not a { source, target } object') && hasMsg(warnings, '"bad.src"', 'English is not a string') && hasMsg(warnings, '"bad.tgt"', 'empty translation') && hasMsg(warnings, '"bad.tgt2"', 'not a string'), warnings);
  ok('… a key with spaces around it is no key', !table.units.has(' spaced ') && !table.units.has('spaced') && hasMsg(warnings, 'not a key'), warnings);
  ok('… and the checker counts every one of those as an error', warnings.every(parseIssueIsError), warnings);
  installContentTables('ja', [table]);
  eq('loc("__proto__"), term("constructor")', [loc('__proto__', 'Proto line'), term('constructor'), term('__proto__')], ['プロトの行', 'コンストラクタ', 'プロト']);
  eq('term("valueOf"), loc("toString"): the English', [term('valueOf'), loc('toString', 'x')], ['valueOf', 'x']);
  ok('Object.prototype untouched', !Object.hasOwn(Object.prototype, 'プロト') && ({}).toString === Object.prototype.toString);
  eq('the misses keep hostile names apart from keys', contentMisses().map((m) => [m.key ?? null, m.name ?? null, m.why]), [[null, 'valueOf', 'term'], ['toString', null, 'missing']]);
  clearContentTables();
  const idx = parseContentIndex(JSON.parse('{"format":"luminati-i18n-index","version":1,"languages":{"__proto__":{"tables":["common"]},"en":{"tables":["common"]},"ja":{"tables":["common","levels/../x","levels/a","__proto__",{"toString":1}]}}}'));
  eq('index: only "ja" (no __proto__, no en)', [...idx.languages.keys()], ['ja']);
  eq('index: bad table ids dropped', [...idx.languages.get('ja')], ['common', 'levels/a']);
  ok('… with warnings', hasMsg(idx.warnings, 'levels/../x') && hasMsg(idx.warnings, '"en"'), idx.warnings);
  eq('isTableId', ['common', 'levels/a-b', 'campaigns/x', 'levels/A', 'levels/../a', 'other/x', 'levels/', ''].map(isTableId), [true, true, true, false, false, false, false, false]);
  const nope = parseContentTable(/** @type {any} */ ('nope'));
  eq('parseContentTable on a non-object: no table, a warning, no throw', [nope.table, nope.warnings.length], [null, 1]);
}

// =================================================================================================
begin('lookup: the key the data holds, recorded English, no guess at another key, the chain');
{
  const camp = T3('campaigns/c', { ext: ['levels/l'], terms: { Kit: 'キット（キャンプ）' }, units: { [G('room.kit0')]: U('Room line.', '部屋の行。') } });
  const lvl = T3('levels/l', {
    terms: { Pip: 'ピップ', Kit: 'キット' },
    units: {
      [G('pip.d0')]: U('Hello.', 'こんにちは。'),
      [G('pip.d1')]: U('Bye.', 'さようなら。'),
      [G('pip.t3')]: U('Thank you.', 'ありがと！'),
      [G('pip.t7')]: U('Thank you.', 'かたじけない。'),
      [`${G('pip.banner')}.2`]: U('A subtitle.', '副題。'),
    },
  });
  const common = T3('common', { terms: { 'Alpha Town': 'アルファ' }, units: { 'dlg.test.hello': U('Hello, traveler!', 'こんにちは、旅の方！') } });
  installContentTables('ja', [camp, lvl, common]);
  eq('a unit by its key with its recorded English', loc(G('pip.d0'), 'Hello.'), 'こんにちは。');
  eq('… text with spaces around it keeps them', loc(G('pip.d0'), '  Hello. \n'), '  こんにちは。 \n');
  eq('… a banner subtitle\'s <GUID>.2, a code key from common', [loc(subtitleKey(G('pip.banner')), 'A subtitle.'), loc('dlg.test.hello', 'Hello, traveler!')], ['副題。', 'こんにちは、旅の方！']);
  eq('the campaign table first, then what it extends, then common', [loc(G('room.kit0'), 'Room line.'), term('Kit'), term('Pip'), term('Alpha Town')], ['部屋の行。', 'キット（キャンプ）', 'ピップ', 'アルファ']);
  eq('the same English at two keys, translated differently (two speakers\' "Thank you."): each its own', [loc(G('pip.t3'), 'Thank you.'), loc(G('pip.t7'), 'Thank you.')], ['ありがと！', 'かたじけない。']);
  clearContentMisses();
  eq('an edited English: the English, a stale miss (the line needs review)', loc(G('pip.d1'), 'Goodbye.'), 'Goodbye.');
  eq('a key no table has at all: the English, even when a unit translates the same English (nothing is found by the English)', loc(G('pip.new'), 'Bye.'), 'Bye.');
  eq('… nor a key whose unit records other English (stale)', loc(G('pip.d1'), 'Hello.'), 'Hello.');
  eq('… nor a key no table has whose English two units translate differently', loc(G('pip.new2'), 'Thank you.'), 'Thank you.');
  eq('a name nobody has: a term miss', term('Nobody'), 'Nobody');
  eq('the misses: stale, missing, missing, term (there is no "moved")', contentMisses().map((m) => `${m.key ?? m.name}:${m.why}`), [`${G('pip.d1')}:stale`, `${G('pip.new')}:missing`, `${G('pip.new2')}:missing`, 'Nobody:term']);
  loc(G('pip.new'), 'Bye.');
  eq('… each key once', contentMisses().length, 4);
  eq('an empty key (a text with no key in the data): the English, a nokey miss — one per English', [loc('', 'Hello.'), loc('', ' Hello. '), contentMisses().slice(4)], ['Hello.', ' Hello. ', [{ source: 'Hello.', why: 'nokey' }]]);
  eq('contentInfo', contentInfo(), { lang: 'ja', tables: ['campaigns/c', 'levels/l', 'common'], strings: 11, units: 7, terms: 4, missCount: 5, missDropped: 0 });
  // the tools' table-by-table lookup agrees with the runtime
  const chain = [camp, lvl, common];
  eq('lookupUnit: exact, stale, missing', [
    lookupUnit(chain, G('pip.d0'), 'Hello.').how, lookupUnit(chain, G('pip.d1'), 'Goodbye.'), lookupUnit(chain, G('pip.new'), 'Bye.'), lookupUnit(chain, G('zzz'), 'Z'),
    lookupUnit(chain, G('pip.new2'), 'Thank you.'), lookupUnit(chain, G('pip.d1'), 'Hello.'),
  ], ['exact', { how: 'stale', table: 'levels/l' }, { how: 'missing' }, { how: 'missing' }, { how: 'missing' }, { how: 'stale', table: 'levels/l' }]);
  eq('lookupTerm: the first table of the chain', [lookupTerm(chain, 'Kit'), lookupTerm(chain, 'Nobody').how], [{ how: 'term', table: 'campaigns/c', target: 'キット（キャンプ）' }, 'missing']);
  installContentTables('ja', [T3('levels/e'), common]);
  eq('an empty table stays in the chain (contentInfo shows what loaded)', [contentInfo().tables, term('Alpha Town')], [['levels/e', 'common'], 'アルファ']);
  clearContentTables();
  eq('clear: English', [loc(G('pip.d0'), 'Hello.'), contentInfo().lang], ['Hello.', 'en']);
  eq('extends: itself and common are ignored', T3('levels/l', { ext: ['levels/l', 'common', 'campaigns/c'] }).extends, ['campaigns/c']);
  const t = parseContentTable(v3('levels/q', 'zh'), { id: 'levels/p', lang: 'ja' });
  ok('a file naming another language / source: warnings (errors for the checker)', hasMsg(t.warnings, '"lang"') && hasMsg(t.warnings, '"source"') && t.warnings.every(parseIssueIsError), t.warnings);
  const newer = parseContentTable(v3('common', 'ja', { version: 4 }), { id: 'common', lang: 'ja' });
  ok('a newer version: a warning, not an error', hasMsg(newer.warnings, 'newer') && !newer.warnings.some(parseIssueIsError), newer.warnings);
}

// =================================================================================================
begin('loadContentTables: only what index.json lists');
{
  const files = {
    'index.json': { format: 'luminati-i18n-index', version: 1, languages: { ja: { tables: ['common', 'levels/x', 'campaigns/c', 'levels/cyc'] }, zh: { tables: ['common'] } } },
    'ja/common.json': v3('common', 'ja', { terms: { Signpost: '立て札' } }),
    'ja/levels/x.json': v3('levels/x', 'ja', { ext: ['levels/unlisted'], terms: { Emberfall: 'エンバーフォール' }, units: { [G('x.sign0')]: U('Hi.', 'やあ。') } }),
    'ja/campaigns/c.json': v3('campaigns/c', 'ja', { ext: ['levels/x'], units: { [G('c.subtitle')]: U('A tale', '物語') } }),
    'ja/levels/cyc.json': v3('levels/cyc', 'ja', { ext: ['levels/cyc2', 'levels/x', 'campaigns/c'], terms: { k: 'K' } }),
    'zh/common.json': v3('common', 'zh', { terms: { Signpost: '路牌' } }),
  };
  /** @type {string[]} */
  let reads = [];
  const read = (p) => { reads.push(p); return Object.hasOwn(files, p) ? JSON.parse(JSON.stringify(files[p])) : null; };
  const fresh = () => { const r = (p) => read(p); reads = []; return r; };
  let r = await loadContentTables('en', { level: 'x', read: fresh() });
  ok('English reads nothing', reads.length === 0 && r.tables.length === 0 && contentInfo().lang === 'en', reads);
  r = await loadContentTables('ja', { campaign: 'c', read: fresh() });
  eq('a campaign: its table, the table it extends, common', r.tables, ['campaigns/c', 'levels/x', 'common']);
  ok('… reads index + those three, never the unlisted extends', reads.length === 4 && !reads.some((p) => p.includes('unlisted')), reads);
  ok('… and warns about it', hasMsg(r.warnings, 'levels/unlisted', 'does not list'), r.warnings);
  eq('… installed', [loc(G('c.subtitle'), 'A tale'), loc(G('x.sign0'), 'Hi.'), term('Emberfall'), term('Signpost'), contentInfo().lang], ['物語', 'やあ。', 'エンバーフォール', '立て札', 'ja']);
  r = await loadContentTables('ja', { level: 'nope', read: fresh() });
  ok('a level the index does not list: common only, nothing else read', isDeepStrictEqual(r.tables, ['common']) && isDeepStrictEqual(reads.sort(), ['index.json', 'ja/common.json']) && hasMsg(r.warnings, 'levels/nope', 'not in the index'), [r.tables, reads]);
  r = await loadContentTables('ja', { level: 'local:__playtest__', read: fresh() });
  eq('a browser-storage level: common', r.tables, ['common']);
  r = await loadContentTables('ja', { level: 'local:__playtest__', tables: ['levels/x'], read: fresh() });
  eq('… with a play-test\'s table (its keys are the data\'s, so a level saved under another name keeps its translations)', [r.tables, loc(G('x.sign0'), 'Hi.')], [['levels/x', 'common'], 'やあ。']);
  r = await loadContentTables('ja', { level: 'cyc', read: fresh() });
  ok('extends cycles end (each table once)', isDeepStrictEqual(r.tables, ['levels/cyc', 'levels/x', 'campaigns/c', 'common']), r.tables);
  r = await loadContentTables('zh', { level: 'x', read: fresh() });
  eq('another language: its own index entry', [r.tables, term('Signpost')], [['common'], '路牌']);
  r = await loadContentTables('fr', { level: 'x', read: fresh() });
  ok('a language the index lacks: English, index read only', r.tables.length === 0 && isDeepStrictEqual(reads, ['index.json']) && term('Signpost') === 'Signpost', reads);
  r = await loadContentTables('ja', { level: 'x', read: () => { throw new Error('disk on fire'); } });
  ok('a reader that throws: English and a warning, no throw', r.tables.length === 0 && hasMsg(r.warnings, 'disk on fire'), r);
  // the browser path: fetch with the base URL; a 404 is a warning
  /** @type {string[]} */
  const urls = [];
  const fetchStub = async (url) => {
    urls.push(url);
    const p = url.slice('/base/i18n/'.length);
    return Object.hasOwn(files, p) ? { ok: true, json: async () => JSON.parse(JSON.stringify(files[p])) } : { ok: false, json: async () => null };
  };
  r = await loadContentTables('ja', { level: 'x', fetch: fetchStub, base: '/base/i18n/' });
  eq('fetch: URLs under the base', urls.sort(), ['/base/i18n/index.json', '/base/i18n/ja/common.json', '/base/i18n/ja/levels/x.json']);
  r = await loadContentTables('ja', { level: 'x', fetch: fetchStub, base: '/base/i18n/', install: false });
  ok('install: false leaves the chain alone', contentInfo().tables.join() === 'levels/x,common' && r.chain.length === 2);
  eq('contentTableIds', [contentTableIds({ level: 'emberfall' }), contentTableIds({ campaign: 'c', level: 'x' }), contentTableIds({ level: 'local:a' }), contentTableIds({ tables: ['levels/a', 'nope', 'common'] })],
    [['levels/emberfall'], ['campaigns/c'], [], ['levels/a']]);
  eq('contentTableIds: a ?level= value slugified as LevelStorage does; the loaded source; a campaign ignores level and source',
    [contentTableIds({ level: 'Emberfall' }), contentTableIds({ level: 'Starfall Vale.json' }), contentTableIds({ level: 'con' }), contentTableIds({ source: 'levels/gildhaven.json', level: 'ignored' }), contentTableIds({ source: 'local:__playtest__' }), contentTableIds({ campaign: 'Ferrymans-Lantern', source: 'levels/x.json', tables: ['levels/x'] })],
    [['levels/emberfall'], ['levels/starfall-vale'], ['levels/con-level'], ['levels/gildhaven'], [], ['campaigns/ferrymans-lantern', 'levels/x']]);
  r = await loadContentTables('ja', { level: '村の広場', tables: ['levels/../x'], read: fresh() });
  ok('what names no table: a warning each, common only', isDeepStrictEqual(r.tables, ['common']) && hasMsg(r.warnings, 'level "村の広場"', 'names no table') && hasMsg(r.warnings, 'table "levels/../x"', 'names no table'), r.warnings);
  r = await loadContentTables('ja', { level: 'X', read: fresh() });
  eq('?level=X loads levels/x', r.tables, ['levels/x', 'common']);
  clearContentTables();
}

// =================================================================================================
begin('the format ids (ADR-053): tables, the index and worklists');
{
  eq('the ids', [CONTENT_FORMAT, CONTENT_INDEX_FORMAT, WORKLIST_FORMAT], ['luminati-i18n', 'luminati-i18n-index', 'luminati-i18n-worklist']);
  ok('serializeTable / serializeIndex write the ids', serializeTable({ lang: 'ja', id: 'levels/x' }).startsWith('{\n  "format": "luminati-i18n",') && serializeIndex({ ja: ['common'] }).startsWith('{\n  "format": "luminati-i18n-index",'));
}

// =================================================================================================
begin('keys (ContentKeys.js): the readers the extractor and the runtime share');
{
  const npc = {
    type: 'npc', id: 'pip', title: 'Keeper', dialogue: ['Hi', '', { text: 'Q?', choices: ['No', '', 'Yes'] }],
    textKeys: { title: G('t'), dialogue: [G('d0'), null, { key: G('d2'), choices: [G('c0'), null, G('c2')] }] },
  };
  eq('textKeyOf, dialogueKeyOf, choiceKeyOf: by raw index', [textKeyOf(npc, 'title'), dialogueKeyOf(npc, 0), dialogueKeyOf(npc, 1), dialogueKeyOf(npc, 2), choiceKeyOf(npc, 2, 0), choiceKeyOf(npc, 2, 1), choiceKeyOf(npc, 2, 2)],
    [G('t'), G('d0'), '', G('d2'), G('c0'), '', G('c2')]);
  const sign = { type: 'signpost', text: ['A', '  ', 'C'], textKeys: { text: [G('s0'), null, G('s2')] } };
  eq('pageKeyOf: the raw index (textPages keeps it)', [textPages(sign.text).map((p) => [p.i, pageKeyOf(sign, 'text', p.i)])], [[[0, G('s0')], [2, G('s2')]]]);
  const hostile = JSON.parse(`{"textKeys":{"title":"${G('t').toLowerCase()}","text":{"0":"${G('x')}"},"dialogue":[{"key":5,"choices":"${G('c')}"}],"__proto__":{"sub":"${G('p')}"}}}`);
  eq('hostile keys: lower case, wrong shapes, inherited — no key', [textKeyOf(hostile, 'title'), pageKeyOf(hostile, 'text', 0), dialogueKeyOf(hostile, 0), choiceKeyOf(hostile, 0, 0), textKeyOf(hostile, 'sub'), textKeyOf(Object.create({ textKeys: { title: G('t') } }), 'title')], ['', '', '', '', '', '']);
  const quest = { textKeys: { text: G('q'), stages: { asked: G('q.a') }, goals: [G('q.g0')] } };
  eq('questKeyOf: text, a stage by id, a goal by raw index', [questKeyOf(quest, 'text'), questKeyOf(quest, 'stage', 'asked'), questKeyOf(quest, 'goal', 0), questKeyOf(quest, 'stage', 'nope')], [G('q'), G('q.a'), G('q.g0'), '']);
  eq('isGuid / isTextKey / isCodeKey', [isGuid(G('a')), isGuid(G('a').toLowerCase()), isTextKey(`${G('a')}.2`), isTextKey(`${G('a')}.3`), isTextKey('dlg.elder.welcome'), isTextKey('emberfall:elder.dialogue[0]'), isCodeKey('dlg.elder.welcome'), isCodeKey('Dlg.x')],
    [true, false, true, false, true, false, true, false]);
  eq('a script line\'s tag', [splitLineTag(`- Ah, a traveller. #line:${G('l')}`), splitLineTag('Room #4 is free.')], [{ text: '- Ah, a traveller.', tag: G('l') }, { text: 'Room #4 is free.', tag: '' }]);
  eq('textPages: raw indices, blanks and non-strings skipped, numbers shown', textPages(['a', '', '  ', 5, null, { toString: 1 }, 'b']), [{ i: 0, text: 'a' }, { i: 3, text: '5' }, { i: 6, text: 'b' }]);
  eq('dialogueUnits: pages and choices with raw indices; hostile values skipped, no throw', dialogueUnits(['p0', '', { text: 'q?', choices: ['No', '', 3, { toString: 1 }, 'Yes'] }, { text: { toString: 1 } }, { text: 'plain', choices: [''] }]),
    [{ i: 0, text: 'p0', choices: null }, { i: 2, text: 'q?', choices: [{ j: 0, text: 'No' }, { j: 2, text: '3' }, { j: 4, text: 'Yes' }] }, { i: 4, text: 'plain', choices: null }]);
  eq('built-in verbs', ['Enter', ' Look ', 'Read', 'Climb down', 'enter', '__proto__', 5].map(builtinLabel), ['enter', 'look', 'read', '', '', '', '']);
}

// =================================================================================================
begin('ContentStrings: a level — every unit with the key its data holds');
{
  const L = createEmptyLevel({ name: 'Testholm', width: 24, depth: 24 });
  L.subtitle = 'A Test Hamlet';
  L.description = 'Editor-only notes';
  L.environment.title = { title: 'TESTHOLM', subtitle: '', prompt: 'Press any key', credit: '' };
  const set = (o, id, fields) => { o.id = id; Object.assign(o, fields); return o; };
  set(addObject(L, 'house', 4, 4), 'h1', { name: 'The Leaky Roof', text: ['A {kettle} sings inside.', '  ', 'Third page.'] });
  set(addObject(L, 'signpost', 6, 4), 's1', { speaker: '', text: ['↑ {Hill}\n↓ {Pond}'] });
  set(addObject(L, 'npc', 8, 8), 'npc_pip', { name: 'Pip', title: 'Keeper of Tarts', dialogue: ['Hi!', { text: 'Want one?', choices: ['No', '', 'Yes'] }], action: 'shop', item: 'Jam Tart' });
  set(addObject(L, 'npc', 9, 8), 'npc_elder', { name: 'Elder Rook', script: 'elder', dialogue: ['Shadowed page'] });
  set(addObject(L, 'npc', 10, 8), 'npc_shop', { name: 'Odo', script: 'shopkeeper', dialogue: ['Odo page'], item: 'Ignored Item' });
  set(addObject(L, 'npc', 11, 8), 'npc_talk', {
    name: 'Wren', dialogue: ['Talk shadows me'], flag: 'met-wren', actor: '',
    talk: [
      'Wren: Hello from {Wren}.',
      '- Again, me.',
      'npc_pip: I am Pip, by id.',
      'Stranger: Who am I?',
      ': The wind howls.',
      'choice Help Wren?',
      '  > Not yet',
      '  > [once if met-wren] Gladly',
      '    bark npc_pip Yay!',
      '    toast Wren is pleased.',
      '    banner The Big Day | A subtitle',
      '    quest q1 start The First Quest',
      '    quest q1 stage s2 Half done.',
      '    ending good The Good End',
      '    set some-flag',
      '    give some-item 2',
      '    walk npc_pip marker_1',
    ],
  });
  set(addObject(L, 'region', 12, 12), 'r1', { name: 'Old Square', sub: 'Testholm', banner: 'Where it begins' });
  set(addObject(L, 'exit', 0, 0), 'x1', { to: 'other-level', entrance: 'gate', mode: 'walk', label: 'Go in', requires: '', locked: ['Never shown'] });
  set(addObject(L, 'exit', 1, 0), 'x2', { to: 'cellar', entrance: 'stairs', mode: 'use', label: 'Climb down', requires: 'has-key', locked: ['Locked tight.'] });
  set(addObject(L, 'exit', 1, 1), 'x3', { to: 'cellar', entrance: 'stairs', mode: 'use', label: 'Enter', requires: '' });
  set(addObject(L, 'entrance', 2, 2), 'e1', { name: 'gate-name' });
  set(addObject(L, 'marker', 3, 3), 'm1', { name: 'marker-name' });
  set(addObject(L, 'event', 5, 5), 'ev1', { on: 'enter', label: 'Not a prompt', run: [': Narrator line here.'] });
  set(addObject(L, 'event', 6, 6), 'ev2', { on: 'use', label: 'Search', run: [': Found nothing.'] });
  set(addObject(L, 'event', 6, 7), 'ev3', { on: 'use', label: 'Read', run: [] });
  set(addObject(L, 'enemy', 7, 7), 'en1', { name: 'Big Slime' });
  set(addObject(L, 'waystone', 7, 9), 'w1', { name: 'Hill Stone' });
  set(addObject(L, 'well', 9, 9), 'well1', {});
  set(addObject(L, 'house', 9, 10), 'a.b:c', { text: ['Escaped id.'] });
  const bare = parseLevel(JSON.parse(serializeLevel(L))).level;
  // a level from before keys: every unit listed, with no key
  const S0 = levelStrings(bare, { file: 'levels/testholm.json' });
  // keyed as a generator keys it (TextKeys.assignTextKeys), then saved and read back
  const keyed = parseLevel(JSON.parse(serializeLevel(bare))).level;
  assignTextKeys(keyed, { mint: seededMint('levels/testholm.json') });
  const level = parseLevel(JSON.parse(serializeLevel(keyed))).level;
  const S = levelStrings(level, { file: 'levels/testholm.json' });
  const units = S.filter((e) => !e.term);
  const terms = [...new Set(S.filter((e) => e.term).map((e) => e.text))].sort();
  const at = (where) => units.find((e) => e.where === `levels/testholm.json › ${where}`);
  eq('the units in file order: level fields, raw page indices, choices, script lines, labels, region texts', units.map((e) => [e.where.replace('levels/testholm.json › ', ''), e.text]), [
    ['subtitle', 'A Test Hamlet'],
    ['environment.title.title', 'TESTHOLM'],
    ['environment.title.prompt', 'Press any key'],
    ['h1 (house) › text[0]', 'A {kettle} sings inside.'],
    ['h1 (house) › text[2]', 'Third page.'],
    ['s1 (signpost) › text[0]', '↑ {Hill}\n↓ {Pond}'],
    ['npc_pip (npc) › title', 'Keeper of Tarts'],
    ['npc_pip (npc) › dialogue[0]', 'Hi!'],
    ['npc_pip (npc) › dialogue[1]', 'Want one?'],
    ['npc_pip (npc) › dialogue[1].choices[0]', 'No'],
    ['npc_pip (npc) › dialogue[1].choices[2]', 'Yes'],
    ['npc_shop (npc) › dialogue[0]', 'Odo page'],
    ['npc_talk (npc) › talk:1', 'Hello from {Wren}.'],
    ['npc_talk (npc) › talk:2', 'Again, me.'],
    ['npc_talk (npc) › talk:3', 'I am Pip, by id.'],
    ['npc_talk (npc) › talk:4', 'Who am I?'],
    ['npc_talk (npc) › talk:5', 'The wind howls.'],
    ['npc_talk (npc) › talk:6', 'Help Wren?'],
    ['npc_talk (npc) › talk:7', 'Not yet'],
    ['npc_talk (npc) › talk:8', 'Gladly'],
    ['npc_talk (npc) › talk:9', 'Yay!'],
    ['npc_talk (npc) › talk:10', 'Wren is pleased.'],
    ['npc_talk (npc) › talk:11', 'The Big Day'],
    ['npc_talk (npc) › talk:11', 'A subtitle'],
    ['npc_talk (npc) › talk:13', 'Half done.'],
    ['npc_talk (npc) › talk:14', 'The Good End'],
    ['r1 (region) › sub', 'Testholm'],
    ['r1 (region) › banner', 'Where it begins'],
    ['ev1 (event) › run:1', 'Narrator line here.'],
    ['ev2 (event) › label', 'Search'],
    ['ev2 (event) › run:1', 'Found nothing.'],
    ['well1 (well) › text[0]', 'The well is deep and cold. You make a small wish.'],
    ['a.b:c (house) › text[0]', 'Escaped id.'],
  ]);
  ok('every unit holds a key: a GUID (a banner subtitle <GUID>.2), each once', units.every((e) => isTextKey(e.key) && !isCodeKey(e.key)) && new Set(units.map((e) => e.key)).size === units.length, units.filter((e) => !isTextKey(e.key)));
  const obj = (id) => level.objects.find((o) => o.id === id);
  const talk = obj('npc_talk').talk;
  eq('… the keys the data holds: textKeys by raw index, a script line\'s #line: tag, the banner\'s tag + .2, the level\'s own', [
    at('npc_pip (npc) › dialogue[1].choices[2]').key, at('h1 (house) › text[2]').key, at('npc_pip (npc) › title').key, at('ev2 (event) › label').key, at('subtitle').key,
    at('npc_talk (npc) › talk:8').key, units.filter((e) => e.where.endsWith('talk:11')).map((e) => e.key),
  ], [
    choiceKeyOf(obj('npc_pip'), 1, 2), pageKeyOf(obj('h1'), 'text', 2), textKeyOf(obj('npc_pip'), 'title'), textKeyOf(obj('ev2'), 'label'), textKeyOf(level, 'subtitle'),
    splitLineTag(talk[7]).tag, [splitLineTag(talk[10]).tag, subtitleKey(splitLineTag(talk[10]).tag)],
  ]);
  eq('a level from before keys: the same units, each with key \'\' (it stays English; the checker says "no key")', [S0.filter((e) => !e.term).map((e) => [e.where, e.text]), S0.filter((e) => !e.term).every((e) => e.key === '')], [units.map((e) => [e.where, e.text]), true]);
  eq('… a level saved under another name (or a local: one) lists the same keys: they are the data\'s, not the file\'s', levelStrings(level, { file: 'local:x' }).filter((e) => !e.term).map((e) => e.key), units.map((e) => e.key));
  eq('the terms: names (a shadowed villager\'s too), speakers as resolved, shop items, a quest title, an item a script gives (titleCase of its id), foes, waystones (not a bark\'s speaker)', terms, ['Big Slime', 'Elder Rook', 'Hill Stone', 'Jam Tart', 'Odo', 'Old Square', 'Pip', 'Some Item', 'Stranger', 'Testholm', 'The First Quest', 'Wren']);
  eq('… kinds', [at('npc_pip (npc) › dialogue[1].choices[2]').kind, at('npc_pip (npc) › title').kind, at('ev2 (event) › label').kind, at('r1 (region) › sub').kind, at('npc_talk (npc) › talk:7').kind, at('npc_talk (npc) › talk:11').kind], ['choice', 'title', 'label', 'title', 'choice', 'title']);
  // exits: the game reads them only in a campaign — a campaign's level file lists them, a single level does not (COULD 16)
  const asCampaign = levelStrings(level, { file: 'campaigns/c/levels/testholm.json', campaign: true });
  eq('a campaign\'s level file: the exit prompt (mode use, not a built-in verb) and its locked text (with requires); no title screen', [
    asCampaign.filter((e) => !e.term && /› x\d \(exit\)/.test(e.where)).map((e) => [e.where.split(' › ').slice(1).join(' › '), e.text, e.kind, e.key]), asCampaign.some((e) => e.where.includes('environment.title.')),
  ], [[['x2 (exit) › label', 'Climb down', 'label', textKeyOf(obj('x2'), 'label')], ['x2 (exit) › locked[0]', 'Locked tight.', 'line', pageKeyOf(obj('x2'), 'locked', 0)]], false]);
  ok('… a single level: no exit text at all', !S.some((e) => /› x\d \(exit\)/.test(e.where)), S.filter((e) => /exit/.test(e.where)).map((e) => e.where));
  eq('… notes: the speaker, the page before and after, the type', [at('npc_pip (npc) › dialogue[1]').note, at('npc_pip (npc) › dialogue[0]').note.next], [{ type: 'npc', speaker: 'Pip', prev: 'Hi!' }, 'Want one?']);
  eq('… a bark\'s speaker in its note (it is no term)', [at('npc_talk (npc) › talk:9').note.speaker, S.filter((e) => e.term && e.field.endsWith('.speaker')).map((e) => e.text).sort()], ['Pip', ['Pip', 'Stranger', 'Wren', 'Wren']]);
  const texts = S.map((e) => e.text);
  ok('left out: description, house name, shadowed pages, walk exit prompt, locked text without requires, a non-Space event\'s prompt, built-in verbs, identities, tags',
    !['Editor-only notes', 'The Leaky Roof', 'Shadowed page', 'Talk shadows me', 'Go in', 'Never shown', 'Not a prompt', 'Enter', 'Read', 'Ignored Item', 'Climb down', 'Locked tight.', 'met-wren', 'some-flag', 'some-item', 'marker_1', 'gate-name', 'marker-name', 'other-level', 'cellar', 'gate', 'stairs', 'has-key', 'q1', 's2', 'good', 'npc_talk'].some((t) => texts.includes(t))
    && !texts.some((t) => t.includes('#line:')), texts);
  // script lines: keyed by their tags; a blank banner subtitle is no unit; a line the parser rejects has none
  const blank = scriptStrings([`banner Title Only | #line:${G('b')}`, `toast After. #line:${G('t')}`, `- #line:${G('e')}`], { where: 'w' });
  eq('a blank banner subtitle is no unit; each line by its own tag', blank.strings.filter((e) => !e.term).map((e) => [e.key, e.text]), [[G('b'), 'Title Only'], [G('t'), 'After.']]);
  const bad = scriptStrings([`Wren: fine #line:${G('f1')}`, 'notacommand here', `Wren: also fine #line:${G('f2')}`], { where: 'x' });
  eq('a script that does not parse: its good lines keep their keys', [bad.strings.filter((e) => !e.term).map((e) => e.key), bad.errors.length], [[G('f1'), G('f2')], 1]);
  eq('untagged lines: units with no key (they stay English until tagged)', scriptStrings(['Wren: hi', 'bark npc_pip Yay!'], { where: 'x' }).strings.map((e) => [e.term ?? false, e.key ?? null, e.text]), [[true, null, 'Wren'], [false, '', 'hi'], [false, '', 'Yay!']]);
  // the catalog flags drive it: every flagged field is a text-like field, no identity is flagged
  const flagged = Object.entries(OBJECT_TYPES).flatMap(([type, d]) => /** @type {any[]} */ (d.fields).filter((f) => f.i18n).map((f) => `${type}.${f.key}`));
  eq('the flagged catalog fields', flagged.sort(), ['enemy.name', 'event.label', 'event.run', 'exit.label', 'exit.locked', 'house.text', 'npc.dialogue', 'npc.item', 'npc.name', 'npc.talk', 'npc.title', 'region.banner', 'region.name', 'region.sub', 'signpost.speaker', 'signpost.text', 'waystone.name', 'well.text']);
  const hostile = JSON.parse('{"name":{"toString":1},"objects":[{"type":"__proto__","id":"a"},{"type":"npc","id":"b","name":{"toString":1},"dialogue":[{"text":{"toString":1},"choices":["Lost"]}]},{"type":"npc","id":"c","name":"C","talk":"Wren: hi"},'
    + `{"type":"npc","id":"d","name":"D","dialogue":[{"text":"Q?","choices":[1,null,"Ok",{"toString":1}]}],"textKeys":{"dialogue":[{"key":"${G('q').toLowerCase()}","choices":["${G('q1')}",null,5]}],"__proto__":{"title":"${G('p')}"}}},{"type":"constructor"},null,5]}`);
  eq('hostile level data: no throw, only strings extracted, only well-formed own keys read', levelStrings(hostile, { file: 'levels/hostile.json' }).map((e) => [e.term ? 'term' : e.key, e.text]),
    [['term', 'C'], ['term', 'Wren'], ['', 'hi'], ['term', 'D'], ['', 'Q?'], [G('q1'), '1'], ['', 'Ok']]);
  eq('keyConflicts: one key with two Englishes', keyConflicts([{ key: G('a'), text: 'x', kind: 'line', where: 'w1', field: 'f' }, { key: G('a'), text: 'y', kind: 'line', where: 'w2', field: 'f' }, { key: G('b'), text: 'z', kind: 'line', where: 'w3', field: 'f' }, { key: G('b'), text: 'z', kind: 'line', where: 'w4', field: 'f' }, { key: '', text: 'k1', kind: 'line', where: 'w5', field: 'f' }, { key: '', text: 'k2', kind: 'line', where: 'w6', field: 'f' }]),
    [{ key: G('a'), texts: ['x', 'y'], where: ['w1', 'w2'] }]);
}

// =================================================================================================
begin('ContentStrings: combat levels');
{
  const build = (enemy) => {
    const L = createEmptyLevel({ name: 'Camp', width: 24, depth: 24 });
    Object.assign(addObject(L, 'npc', 4, 4), { id: 'maren', name: 'Captain', script: 'drillmaster', dialogue: ['Drill page.'] });
    Object.assign(addObject(L, 'npc', 5, 4), { id: 'bram', name: 'Bram', script: 'shopkeeper', action: 'shop', item: 'Ware Name', dialogue: ['Shop page.'] });
    Object.assign(addObject(L, 'npc', 6, 4), { id: 'pip', name: 'Pip', action: 'shop', item: 'Plain Ware' });
    if (enemy) Object.assign(addObject(L, 'enemy', 9, 9), { id: 'e1' });
    return levelStrings(parseLevel(JSON.parse(serializeLevel(L))).level, { file: 'levels/camp.json' }).map((e) => (e.term ? e.text : e.where.replace('levels/camp.json › ', '')));
  };
  const peaceful = build(false);
  const combat = build(true);
  ok('a peaceful level: the drillmaster\'s and the shopkeeper\'s pages and items play', ['maren (npc) › dialogue[0]', 'bram (npc) › dialogue[0]', 'Ware Name', 'Plain Ware'].every((t) => peaceful.includes(t)), peaceful);
  ok('a combat level: no drillmaster pages, no shopkeeper item (the combat wares); the shopkeeper\'s pages and a plain shop item stay', !combat.includes('maren (npc) › dialogue[0]') && !combat.includes('Ware Name') && combat.includes('bram (npc) › dialogue[0]') && combat.includes('Plain Ware'), combat);
  eq('the common terms: the catalog defaults written into data as names, and the shipped levels\' names', commonTerms([{ value: 'a', label: ' Alpha ' }]).map((e) => e.text), ['Alpha', 'Signpost', 'Villager', 'Waystone', 'Untitled', 'Untitled campaign']);
  ok('… all terms', COMMON_TERMS.every((e) => e.term === true));
}

// =================================================================================================
begin('ContentStrings: built-in conversations, the names a script shows, the blank shop item');
{
  // a villager whose talk runs `builtin shopkeeper` / `builtin drillmaster` plays its own pages (SHOULD 1)
  const build = (combat, npcs) => {
    const L = createEmptyLevel({ name: 'Camp', width: 24, depth: 24 });
    npcs.forEach((n, k) => Object.assign(addObject(L, 'npc', 4 + k, 4), n));
    if (combat) Object.assign(addObject(L, 'enemy', 9, 9), { id: 'e1' });
    return levelStrings(parseLevel(JSON.parse(serializeLevel(L))).level, { file: 'levels/camp.json' });
  };
  const pagesQ = [{ text: 'Ask?', choices: ['Yes', 'No'] }];
  const npcs = [
    { id: 'drill', name: 'Drill', talk: ['builtin drillmaster'], dialogue: ['Drill page.', ...pagesQ] },
    { id: 'shop', name: 'Shopper', talk: ['if x', '  builtin shopkeeper'], dialogue: ['Shop page.', ...pagesQ], action: 'shop', item: 'Shop Ware' },
    { id: 'plain', name: 'Plain', talk: ['- Hello.'], dialogue: ['Never shown.'], action: 'shop', item: 'Unshown Ware' },
    { id: 'elder', name: 'Elder', talk: ['builtin elder'], dialogue: ['Elder page.'] },
  ];
  const pages = (S) => S.filter((e) => !e.term && e.field.startsWith('npc.dialogue')).map((e) => e.where.replace('levels/camp.json › ', ''));
  const peace = build(false, npcs);
  const fight = build(true, npcs);
  eq('a peaceful level: the builtin shopkeeper\'s and drillmaster\'s pages (with choices) and the shop item; no pages for a plain talk or another builtin', [
    pages(peace), peace.filter((e) => e.term && e.field === 'npc.item').map((e) => e.text),
  ], [['drill (npc) › dialogue[0]', 'drill (npc) › dialogue[1]', 'drill (npc) › dialogue[1].choices[0]', 'drill (npc) › dialogue[1].choices[1]', 'shop (npc) › dialogue[0]', 'shop (npc) › dialogue[1]', 'shop (npc) › dialogue[1].choices[0]', 'shop (npc) › dialogue[1].choices[1]'], ['Shop Ware']]);
  eq('a combat level: the shopkeeper\'s plain pages only (the combat shop), no drillmaster pages, no item', [pages(fight), fight.filter((e) => e.term && e.field === 'npc.item').length], [['shop (npc) › dialogue[0]'], 0]);
  // S6: the item a give / take hands over, the quest a quest command names (as StoryRunner shows them)
  const sc = scriptStrings(['give honey-jar', 'take old_boot 2', 'give gold 5', 'quest bees start', 'quest wasps stage asked Find the wasps.', 'quest named start The Named Quest', 'quest named stage two Two.'], { where: 'w' });
  eq('S6: give / take: the item as titleCase(id) (not gold); a quest without a title: titleCase(id); one a start line titles: that title', sc.strings.filter((e) => e.term).map((e) => [e.text, e.field]),
    [['Honey Jar', 'script.item'], ['Old Boot', 'script.item'], ['Bees', 'script.quest'], ['Wasps', 'script.quest'], ['The Named Quest', 'script.quest-start']]);
  const { story } = buildStory([{ name: 'main.json', text: JSON.stringify({ format: 'luminati-story', version: 1, items: { jar: { name: 'Clay Jar' } }, quests: { q: { title: 'The Q' } }, scripts: { s: ['give jar', 'quest q start Ignored Title', 'quest started stage a A.'] } }) }]);
  const room = createEmptyLevel({ name: 'Room' });
  Object.assign(addObject(room, 'npc', 4, 4), { id: 'v', name: 'V', talk: ['quest started start Begun Here', 'give unknown-thing'] });
  const C = campaignStrings({ name: 'Tale', levels: [{ id: 'room' }] }, [{ id: 'room', file: 'campaigns/t/levels/room.json', level: room }], story, { file: 'campaigns/t' });
  const names = [...new Set(C.filter((e) => e.term && /\.(item|quest|quest-start)$/.test(e.field)).map((e) => e.text))].sort();
  eq('… with a story: the story\'s item name and quest title win; a quest a level\'s talk titles keeps that title in the story\'s scripts too', names, ['Begun Here', 'Clay Jar', 'The Q', 'Unknown Thing']);
  // a shop villager without an item: the offer shows the UI's default, the journal of a story the identity 'Crisp Apple' (COULD 13)
  const blank = createEmptyLevel({ name: 'Shop' });
  Object.assign(addObject(blank, 'npc', 4, 4), { id: 's', name: 'S', action: 'shop', item: '' });
  const noStory = levelStrings(parseLevel(JSON.parse(serializeLevel(blank))).level, { file: 'levels/shop.json' });
  Object.assign(addObject(blank, 'event', 6, 6), { id: 'ev', on: 'enter', run: [': Hi.'] });
  const withStory = levelStrings(parseLevel(JSON.parse(serializeLevel(blank))).level, { file: 'levels/shop.json' });
  eq('a blank shop item: no term on a level without a story; "Crisp Apple" where a story keeps it (its journal)', [noStory.some((e) => e.text === 'Crisp Apple'), withStory.filter((e) => e.text === 'Crisp Apple').map((e) => e.term)], [false, [true]]);
  const mod = await import('../src/engine/i18n/ContentStrings.js');
  ok('CONTENT_DEFAULTS left ContentStrings.js; COMMON_TERMS has no Crisp Apple', !('CONTENT_DEFAULTS' in mod) && !COMMON_TERMS.some((e) => e.text === 'Crisp Apple'));
}

// =================================================================================================
begin('ContentStrings: story files and a campaign');
{
  const { story } = buildStory([
    {
      name: 'main.json',
      text: JSON.stringify({
        format: 'luminati-story', version: 1,
        items: { plank: { name: 'Oak Plank', text: 'A sound plank.', textKeys: { text: G('plank') } }, 'old-key': {}, rope: { text: 'Untagged rope.' } },
        quests: {
          find: {
            title: 'The Search', text: 'Find her.', stages: [{ id: 'a', text: 'Asked.' }], goals: [{ text: 'Planks (${item:plank} of 3)', done: 'item:plank >= 3' }],
            textKeys: { text: G('find'), stages: { a: G('find.a') }, goals: [G('find.g0')] },
          },
        },
        actors: { wren: { name: 'Elder Wren', talk: [`Elder Wren: Welcome. #line:${G('w0')}`, 'wren: By actor id.'] } },
        events: [{ id: 'ev', on: 'change', if: 'x', run: [`toast The way opens. #line:${G('ev0')}`] }],
      }),
    },
    { name: 'dialogue.story', text: `== intro\nwren: Hello again. #line:${G('i0')}\nchoice Ready? #line:${G('i1')}\n  > Yes #line:${G('i2')}\n  > No #line:${G('i3')}\n` },
  ]);
  const S = storyStrings(story, { file: 'campaigns/c/story' });
  eq('story units with their keys: items, quests (stages, goals: the built textKey), inline actor talks and event runs, .story scripts (#line: tags); an untagged line has none', S.filter((e) => !e.term).map((e) => [e.key, e.text]), [
    [G('plank'), 'A sound plank.'],
    ['', 'Untagged rope.'],
    [G('find'), 'Find her.'],
    [G('find.a'), 'Asked.'],
    [G('find.g0'), 'Planks (${item:plank} of 3)'],
    [G('w0'), 'Welcome.'],
    ['', 'By actor id.'],
    [G('ev0'), 'The way opens.'],
    [G('i0'), 'Hello again.'],
    [G('i1'), 'Ready?'],
    [G('i2'), 'Yes'],
    [G('i3'), 'No'],
  ]);
  eq('story terms: item names (from the id when blank), quest titles, actors, speakers by actor id', [...new Set(S.filter((e) => e.term).map((e) => e.text))].sort(), ['Elder Wren', 'Oak Plank', 'Old Key', 'Rope', 'The Search']);
  eq('where in a .story file: its line', S.find((e) => e.key === G('i1')).where, 'campaigns/c/story/dialogue.story:3 (intro)');
  const room = createEmptyLevel({ name: 'Room' });
  Object.assign(addObject(room, 'npc', 4, 4), { id: 'v', name: 'Villager Wren', actor: 'wren', dialogue: ['Actor talk shadows me'] });
  Object.assign(addObject(room, 'house', 6, 4), { id: 'h', text: ['Room house.'], textKeys: { text: [G('room.h0')] } });
  room.environment.title = { title: 'ROOM TITLE', subtitle: '', prompt: '', credit: '' };
  const dusk = createEmptyLevel({ name: 'Room' });
  Object.assign(addObject(dusk, 'house', 6, 4), { id: 'h', text: ['Room house at dusk.'], textKeys: { text: [G('dusk.h0')] } });
  const { campaign } = normalizeCampaign({
    format: 'luminati-campaign', version: 1, name: 'Tale', subtitle: 'A tale', title: { title: 'TALE' }, levels: [{ id: 'room' }],
    chapters: [{ id: 'one', title: 'Chapter One', subtitle: 'Begins', textKeys: { title: G('ch1'), subtitle: G('ch1s') } }, { id: 'two', title: 'Chapter Two', when: 'x', levels: { room: 'room-dusk' }, textKeys: { title: G('ch2') } }],
    textKeys: { subtitle: G('c.sub'), 'title.title': G('c.title') },
  });
  const C = campaignStrings(campaign, [{ id: 'room', file: 'campaigns/c/levels/room.json', level: room }, { id: 'room-dusk', file: 'campaigns/c/levels/room-dusk.json', level: dusk }], story, { file: 'campaigns/c' });
  eq('campaign units with their keys: subtitle, title, chapters (campaign.json\'s textKeys), each level file (a chapter variant too); no title screen of a campaign\'s level file',
    C.filter((e) => !e.term && !e.where.startsWith('campaigns/c/story')).map((e) => [e.key, e.text]), [
      [G('c.sub'), 'A tale'], [G('c.title'), 'TALE'], [G('ch1'), 'Chapter One'], [G('ch1s'), 'Begins'], [G('ch2'), 'Chapter Two'], [G('room.h0'), 'Room house.'], [G('dusk.h0'), 'Room house at dusk.'],
    ]);
  ok('a villager whose actor has a talk script says no pages; the campaign\'s name is a term', !C.some((e) => e.text === 'Actor talk shadows me') && C.some((e) => e.term && e.text === 'Villager Wren') && C.some((e) => e.term && e.text === 'Tale'), C.map((e) => e.text));
  eq('speakerResolver: id, actor, name, case-insensitive; null when unknown', ['v', 'WREN', 'villager wren', 'Elder Wren', 'nobody'].map(speakerResolver([room], story)), ['Villager Wren', 'Villager Wren', 'Villager Wren', 'Elder Wren', null]);
}

// =================================================================================================
begin('loc() in code (scanLocCalls)');
{
  const src = [
    "import { loc, contentFormat } from '../engine/i18n/ContentText.js';",
    "// loc('dlg.a.comment', 'in a comment') is not a call",
    "const a = loc('dlg.test.plain', 'Plain line.');",
    "const b = loc('dlg.test.kind', 'Pick me', 'choice');",
    "const c = contentFormat(loc('dlg.test.tpl', 'Obtained: ${name}'), { name });",
    "const d = loc(pageKeyOf(sign, 'text', i), line);",
    'const e = loc(node.tk, node.text);',
    "const f = obj.loc('x', 'method');",
    "const g = `a ${loc('dlg.test.inner', 'In a template')} b`;",
    "const bad1 = loc('dlg.test.plus', 'Hello ' + name);",
    'const bad2 = loc(\'dlg.test.tpl2\', `Hi ${name}`);',
    "const bad3 = loc('Not A Key', 'x');",
    "const bad4 = loc(key, 'literal English');",
    "const bad5 = loc('dlg.test.plain', 'Another English');",
    "const bad6 = loc('dlg.test.brace', 'Drink {');",
    'const bad7 = loc(`dlg.${x}`, \'y\');',
    "const bad8 = loc('dlg.test.kind2', 'z', 'nokind');",
    "const bad9 = loc('dlg.test.joined', 'a') + more;",
  ].join('\n');
  const r = scanLocCalls(src, 'src/game/x.js');
  eq('code units: key, English, kind (comments and methods skipped; templates scanned)', r.strings.map((e) => [e.key, e.text, e.kind]), [
    ['dlg.test.plain', 'Plain line.', 'line'], ['dlg.test.kind', 'Pick me', 'choice'], ['dlg.test.tpl', 'Obtained: ${name}', 'line'], ['dlg.test.inner', 'In a template', 'line'],
    ['dlg.test.plain', 'Another English', 'line'], ['dlg.test.brace', 'Drink {', 'line'], ['dlg.test.kind2', 'z', 'line'], ['dlg.test.joined', 'a', 'line'],
  ]);
  eq('… where: file, line, the function', r.strings[0].where, 'src/game/x.js:3 (a)');
  eq('data calls counted (shown by the key the data holds)', r.data, 2);
  const msgs = r.errors.map((e) => `${e.line}: ${e.msg}`);
  ok('errors: + joins, a template English, not a code key, a literal English beside a data key, two Englishes, unbalanced braces, a key built in code, an unknown kind, a joined call',
    r.errors.length === 9 && hasMsg(msgs, '10:', 'joined with +') && hasMsg(msgs, '11:', 'built in code') && hasMsg(msgs, '12:', 'not a code key') && hasMsg(msgs, '13:', 'literal code key') && hasMsg(msgs, '14:', 'two different Englishes')
    && hasMsg(msgs, '15:', 'unbalanced') && hasMsg(msgs, '16:', 'key built in code', 'the one the data holds') && hasMsg(msgs, '17:', "'nokind'") && hasMsg(msgs, '18:', 'joined with +'), msgs);
  ok('a call that never closes: an error, no hang', scanLocCalls("loc('dlg.a.b', 'x'", 'f.js').errors.length === 1);
  eq('lexJs: a template\'s expressions are lexed too', lexJs('`a${ {b:1}.b }c`').tokens[0].exprs[0].map((x) => x.v).join(''), '{b:1}.b');
}

// =================================================================================================
begin('markup rules');
{
  eq('markupOf', markupOf('Hi {Pip}, you have ${item:plank} — press {T}.\n↑ {${attack}}'), { values: ['${attack}', '${item:plank}'], keys: ['${attack}', 'T'], gold: 3, balanced: true, newlines: 1, arrows: ['↑'] });
  eq('markupOf: spaces inside ${ } ignored', markupOf('${ gold }').values, ['${gold}']);
  ok('unbalanced', !markupOf('{a').balanced && !markupOf('a}').balanced);
  eq('goldSpans: the words in gold, not key hints or slots', goldSpans('Go to { Emberfall } and {Pip}: press {T}, {${attack}}, ${gold}.'), ['Emberfall', 'Pip']);
  const I = (en, tr, o) => markupIssues(en, tr, o);
  ok('values differ → error', I('You have ${gold}.', '所持金 ${gold2}。').errors.length === 1);
  ok('a value dropped → error', I('You have ${gold}.', '所持金。').errors.length === 1);
  ok('same values in another order → fine', I('${a} and ${b}', '${b}と${a}').errors.length === 0);
  ok('the same set: a value repeated, or said once where the English repeats it → fine', I('${a} met ${b}', '${a}は${b}に会った。${a}は…').errors.length === 0 && I('${a}, ${a}!', '${a}！').errors.length === 0);
  eq('an escaped \\${x} is no value (interpolate shows it as written); \\\\${x} and $${x} are', [markupOf('Cost: \\${price}').values, markupOf('\\\\${a} $${b}').values], [[], ['${a}', '${b}']]);
  ok('… so a translation may keep or drop it', I('Type \\${gold} to see ${gold}', '${gold}').errors.length === 0);
  ok('unbalanced braces → error', hasMsg(I('{Emberfall}', '{エンバーフォール').errors, 'unbalanced'));
  ok('empty → error', hasMsg(I('Hello', '   ').errors, 'empty'));
  ok('not a string → error', hasMsg(I('Hello', 5).errors, 'not a string'));
  ok('gold spans counted → warning', hasMsg(I('{A} and {B}', '{AとB}').warnings, 'gold spans'));
  ok('line breaks → warning', hasMsg(I('a\nb', 'ab').warnings, 'line breaks'));
  ok('key hint missing → warning', hasMsg(I('Press {T} now', '{T2}を押す').warnings, 'key hints missing: {T}'));
  ok('key hint kept → no warning', !I('Press {T} now', '{T}を押す').warnings.length, I('Press {T} now', '{T}を押す'));
  ok('arrows differ → warning', hasMsg(I('↑ {North}', '{北}').warnings, 'arrows'));
  ok('same as English: a warning for a unit', hasMsg(I('Hello there', 'Hello there').warnings, 'same as the English'));
  ok('… info for a term', hasMsg(I('Pip', 'Pip', { name: true }).info, 'same as the English') && !I('Pip', 'Pip', { name: true }).warnings.length);
  eq('sameEnglish: trimmed, LF, NFC', [sameEnglish(' Café\r\n', 'Cafe\u0301\n'), sameEnglish('A', 'B'), lf('a\r\nb\rc')], [true, false, 'a\nb\nc']);
  eq('keyCompare: numbers in keys in numeric order', ['x[10]', 'x[2]', 'x#10', 'x#2', 'npc_10', 'npc_2', 'a'].sort(keyCompare), ['a', 'npc_2', 'npc_10', 'x#2', 'x#10', 'x[2]', 'x[10]']);
  const gs = [G('k1'), G('k2'), G('k3'), `${G('k1')}.2`, 'dlg.a.b'];
  ok('keyCompare: a total order on GUIDs, <GUID>.2 and code keys (sorting twice gives one order)', isDeepStrictEqual([...gs].sort(keyCompare), [...gs].reverse().sort(keyCompare)), [...gs].sort(keyCompare));
}

// =================================================================================================
begin('PO files (tools/lib/po.mjs)');
{
  const entries = [
    { extracted: ['kind: line', 'speaker: Pip'], references: [`levels/a.json:${G('po0')}`], msgctxt: G('po0'), msgid: 'Say "hi"\nto {Pip}\\${x} — ${gold}\t!', msgstr: '' },
    { flags: ['fuzzy'], previous: { msgid: 'Old\nEnglish' }, msgctxt: G('po1'), msgid: 'New English', msgstr: '古い訳' },
    { msgctxt: 'term', msgid: 'Pip', msgstr: 'ピップ' },
  ];
  const text = serializePo({ comments: ['a worklist'], fields: { Language: 'ja', 'X-Luminati-Table': 'levels/a' }, entries });
  const p = parsePo(text);
  eq('round trip: header', [p.header.Language, p.header['X-Luminati-Table'], p.header['Content-Type']], ['ja', 'levels/a', 'text/plain; charset=UTF-8']);
  eq('round trip: entries (escapes, line breaks, fuzzy, previous, contexts)', p.entries.map((e) => [e.msgctxt, e.msgid, e.msgstr, e.flags, e.previous, e.extracted, e.references]), [
    [G('po0'), 'Say "hi"\nto {Pip}\\${x} — ${gold}\t!', '', [], {}, ['kind: line', 'speaker: Pip'], [`levels/a.json:${G('po0')}`]],
    [G('po1'), 'New English', '古い訳', ['fuzzy'], { msgid: 'Old\nEnglish' }, [], []],
    ['term', 'Pip', 'ピップ', [], {}, [], []],
  ]);
  eq('… no errors', p.errors, []);
  ok('a string with line breaks: an empty first line, then one piece per line', text.includes('msgid ""\n"Say \\"hi\\"\\n"\n"to {Pip}\\\\${x} — ${gold}\\t!"'), text);
  eq('poEscape', poEscape('a\\b"c\nd\te\rf'), 'a\\\\b\\"c\\nd\\te\\rf');
  const other = parsePo('# translator\r\nmsgid ""\r\nmsgstr "Language: zh\\n"\r\n\r\n#~ msgid "obsolete"\r\n#~ msgstr "x"\r\n\r\nmsgctxt "k"\r\nmsgid "a\\101\\x42"\r\nmsgstr ""\r\n"line one\\n"\r\n"line two"\r\nmsgid_plural "p"\r\nmsgctxt "pl"\r\nmsgid "one"\r\nmsgid_plural "many"\r\nmsgstr[0] "x"\r\nmsgstr[1] "y"\r\n\r\nmsgctxt "u"\r\nmsgid "unclosed\r\nmsgstr "z"\r\n\r\ngarbage line\r\n');
  eq('the parser: CRLF, octal and hex escapes, continuation lines, obsolete entries skipped', [other.header.Language, other.entries.map((e) => [e.msgctxt, e.msgid, e.msgstr])], ['zh', []]);
  ok('… a plural entry, an unclosed string and a stray line are errors (never a throw)', hasMsg(other.errors.map((e) => e.msg), 'plural') && hasMsg(other.errors.map((e) => e.msg), 'not a quoted string') && hasMsg(other.errors.map((e) => e.msg), 'not a PO line'), other.errors);
  const ok2 = parsePo('msgctxt "k"\nmsgid "a\\101\\x42"\nmsgstr ""\n"line one\\n"\n"line two"\n');
  eq('… escapes and continuation', ok2.entries.map((e) => [e.msgid, e.msgstr]), [['aAB', 'line one\nline two']]);
}

// =================================================================================================
// The fixture repository: two shipped levels, a campaign built on one of them (with a chapter
// variant), code with loc() keys, the tables; every text keyed in the data as the editor and the
// generators key it (a GUID per text, kept through edits); the checker, the worklist and the CLI
// =================================================================================================
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'luminati-i18n-'));
try {
  const w = (p, text) => { const f = path.join(tmp, ...p.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof text === 'string' ? text : `${JSON.stringify(text, null, 2)}\n`); };
  const rd = (p) => fs.readFileSync(path.join(tmp, ...p.split('/')), 'utf8');
  const lvl = (name, build) => { const L = createEmptyLevel({ name }); build(L); return serializeLevel(L); };
  const npc = (L, id, fields) => Object.assign(addObject(L, 'npc', 4, 4), { id, ...fields });
  const sign = (L, id, fields) => Object.assign(addObject(L, 'signpost', 6, 6), { id, ...fields });
  const run = (tool, ...a) => spawnSync(process.execPath, [path.join(ROOT, 'tools', tool), `--root=${tmp}`, ...a], { encoding: 'utf8' });
  /**
   * A villager's pages and their keys, as the editor keeps them (`textKeys.dialogue` parallel to the
   * pages): each page `[text, key]` or `[{ text, choices }, key, choiceKeys]` (a key null: none).
   * @param {any[]} pages
   */
  const talkOf = (pages) => ({ dialogue: pages.map((p) => p[0]), textKeys: { dialogue: pages.map((p) => (p[2] ? { key: p[1], choices: p[2] } : p[1])) } });
  const A = {
    hello: G('alpha.hello'), only: G('alpha.only'), tart: G('alpha.tart'), yes: G('alpha.yes'), no: G('alpha.no'), sign: G('alpha.sign'), sub: G('alpha.sub'), camp: G('alpha.camp'), brand: G('alpha.brand'),
  };
  const ALPHA = [['Hello, traveler!', A.hello], ['Alpha only. You have ${gold}.', A.only], [{ text: 'Want a crème tart?', choices: ['Yes', 'No'] }, A.tart, [A.yes, A.no]]];
  const alpha = (pages = ALPHA) => lvl('Alpha Town', (L) => {
    npc(L, 'pip', { name: 'Pip', ...talkOf(pages) });
    sign(L, 'sign', { speaker: 'Pip', text: ['Read me in {Alpha Town}.'], textKeys: { text: [A.sign] } });
    Object.assign(addObject(L, 'region', 10, 10), { id: 'r1', name: 'Old Square', sub: 'Alpha Town', banner: '', textKeys: { sub: A.sub } });
  });
  const B = { one: G('beta.one'), two: G('beta.two'), ask: G('beta.ask'), yes: G('beta.yes'), no: G('beta.no'), sign: G('beta.sign'), gone: G('beta.gone'), new: G('beta.new') };
  const BETA = [['Beta one.', B.one], ['Beta two.', B.two], [{ text: 'Beta ask?', choices: ['Yes', 'No'] }, B.ask, [B.yes, B.no]]];
  const beta = (pages = BETA, signText = 'Beta sign.', more = true, extra = (/** @type {any} */ L) => L) => lvl('Beta Bay', (L) => {
    npc(L, 'pip', { name: 'Pip', ...talkOf(pages) });
    sign(L, 'sign', { speaker: 'Pip', text: [signText], textKeys: { text: [B.sign] } });
    if (more) sign(L, 'gone', { speaker: 'Pip', text: ['A sign that will go.'], textKeys: { text: [B.gone] } });
    extra(L);
  });
  const R = { room: G('room.line'), dusk: G('room.dusk') };
  const CH = { one: G('chapter.one'), two: G('chapter.two') };
  w('src/game/levels.js', "export const SHIPPED_LEVELS = [{ value: 'alpha', label: 'Alpha Town' }, { value: 'beta', label: 'Beta Bay' }];\n");
  w('src/game/dialogue.js', "import { loc } from '../engine/i18n/ContentText.js';\nexport const lines = [loc('dlg.test.welcome', 'Welcome, child.'), loc('dlg.test.hello', 'Hello, traveler!')];\n");
  w('src/engine/thing.js', "const q = loc('dlg.test.joined', 'Joined ' + x);\n");
  w('public/levels/alpha.json', alpha());
  w('public/levels/beta.json', beta());
  const campaignJson = { format: 'luminati-campaign', version: 1, name: 'Camp Tale', levels: [{ id: 'alpha' }, { id: 'room' }], chapters: [{ id: 'one', title: 'Chapter One', textKeys: { title: CH.one } }, { id: 'two', title: 'Chapter Two', when: 'x', levels: { room: 'room-dusk' }, textKeys: { title: CH.two } }] };
  w('public/campaigns/camp/campaign.json', campaignJson);
  // the campaign's copy of the shipped level keeps its keys (and adds a line of its own)
  w('public/campaigns/camp/levels/alpha.json', alpha([...ALPHA, ['Camp-only alpha line.', A.camp]]));
  w('public/campaigns/camp/levels/room.json', lvl('The Room', (L) => { npc(L, 'kit', { name: 'Kit', ...talkOf([['Room line.', R.room]]) }); }));
  // a chapter variant shares its base's key where its English is the same
  w('public/campaigns/camp/levels/room-dusk.json', lvl('The Room', (L) => { npc(L, 'kit', { name: 'Kit', ...talkOf([['Room line.', R.room], ['Dusk line.', R.dusk]]) }); }));
  const tbl = (lang, id, o) => w(`public/i18n/${lang}/${id}.json`, serializeTable({ lang, id, extends: o.ext ?? [], terms: new Map(Object.entries(o.terms ?? {})), units: new Map(Object.entries(o.units ?? {})) }));
  const T = (rep, id) => rep.tables.find((t) => t.id === id);
  const keysOf = (l) => l.map((u) => u.key ?? u.name).sort(keyCompare);

  // ===============================================================================================
  begin('worklist --init');
  {
    const p = run('i18n-worklist.mjs', '--init', '--lang=ja,zh');
    ok('exit 0', p.status === 0, p.stdout + p.stderr);
    const camp = JSON.parse(rd('public/i18n/ja/campaigns/camp.json'));
    eq('… an empty version-3 table that extends the shipped level of the same id and name', [camp.version, camp.terms, camp.units, camp.extends, camp.source, camp.lang], [3, {}, {}, ['levels/alpha'], 'campaigns/camp', 'ja']);
    eq('… the index', JSON.parse(rd('public/i18n/index.json')).languages, { ja: { tables: ['common', 'levels/alpha', 'levels/beta', 'campaigns/camp'] }, zh: { tables: ['common', 'levels/alpha', 'levels/beta', 'campaigns/camp'] } });
    const again = run('i18n-worklist.mjs', '--init');
    ok('… a second run creates nothing and leaves the tables alone', again.status === 0 && /0 table\(s\) created/.test(again.stdout) && rd('public/i18n/ja/campaigns/camp.json') === JSON.stringify(camp, null, 2).concat('\n'), again.stdout);
  }

  // ===============================================================================================
  begin('sources, readers and homes on the fixture');
  {
    const ws = await loadWorkspace({ root: tmp });
    const common = ws.sources.get('common');
    eq('common: the code\'s units and the common terms', [[...common.units.keys()], [...common.terms.keys()]], [['dlg.test.welcome', 'dlg.test.hello'], ['Alpha Town', 'Beta Bay', 'Signpost', 'Villager', 'Waystone', 'Untitled', 'Untitled campaign']]);
    ok('… the loc() error of src/engine/thing.js', hasMsg(common.errors, 'src/engine/thing.js:1', 'joined with +'), common.errors);
    eq('the campaign: the keys its files hold (a key its copy of a shipped level and its chapter variant share is one unit)', sorted([...ws.sources.get('campaigns/camp').units.keys()]),
      sorted([A.hello, A.only, A.tart, A.yes, A.no, A.camp, A.sign, A.sub, CH.one, CH.two, R.room, R.dusk]));
    eq('… every text has a key: none listed without one', keylessUnits(ws.sources), []);
    const held = (id) => [sorted([...ws.held.get(id).units.keys()]), [...ws.held.get(id).terms.keys()].sort()];
    eq('homes: the campaign holds what its base does not (the same key and English live in the base)', held('campaigns/camp'), [
      sorted([A.camp, CH.one, CH.two, R.dusk, R.room]), ['Camp Tale', 'Kit', 'The Room'],
    ]);
    eq('… the base holds its own and the shared terms; common holds the common terms', [held('levels/alpha')[1], held('levels/beta')[1], held('common')[1].length], [['Old Square', 'Pip'], ['Pip'], 7]);
    eq('readers', [readersOf('common', ws.index.languages.get('ja'), ws.closure), readersOf('levels/alpha', ws.index.languages.get('ja'), ws.closure), readersOf('campaigns/camp', ws.index.languages.get('ja'), ws.closure)],
      [[CODE_READER, 'levels/alpha', 'levels/beta', 'campaigns/camp'], ['levels/alpha', 'campaigns/camp'], ['campaigns/camp']]);
    eq('extendsClosure: itself, then its extends; cycles cut', Object.fromEntries(extendsClosure(new Map([['a', ['b']], ['b', ['a', 'c']], ['c', []]]))), { a: ['a', 'b', 'c'], b: ['b', 'a', 'c'], c: ['c'] });
    const X = [G('x0'), G('x1'), G('y0')];
    const tiny = entryHomes(new Map([
      ['common', { strings: [{ term: true, text: 'Sign', kind: 'name', where: '', field: '' }] }],
      ['levels/a', { strings: [{ key: X[0], text: 'Same', kind: 'line', where: '', field: '' }, { term: true, text: 'Sign', kind: 'name', where: '', field: '' }, { term: true, text: 'Pip', kind: 'name', where: '', field: '' }] }],
      ['campaigns/c', { strings: [{ key: X[0], text: 'Same', kind: 'line', where: '', field: '' }, { key: X[1], text: 'Own', kind: 'line', where: '', field: '' }, { key: X[2], text: 'Other English', kind: 'line', where: '', field: '' }, { term: true, text: 'Pip', kind: 'name', where: '', field: '' }, { term: true, text: 'Kit', kind: 'name', where: '', field: '' }] }],
    ]), new Map([['campaigns/c', ['campaigns/c', 'levels/a']]]));
    eq('entryHomes on a tiny set', Object.fromEntries([...tiny].map(([id, h]) => [id, [[...h.units.keys()], [...h.terms.keys()]]])), {
      common: [[], ['Sign']], 'levels/a': [[X[0]], ['Pip']], 'campaigns/c': [[X[1], X[2]], ['Kit']],
    });
    eq('serializeIndex orders the tables', JSON.parse(serializeIndex({ ja: ['campaigns/a', 'levels/b', 'common', 'levels/a'] })).languages.ja.tables, ['common', 'levels/a', 'levels/b', 'campaigns/a']);
  }

  // ===============================================================================================
  begin('the checker on fixture tables');
  {
    tbl('ja', 'common', {
      units: { 'dlg.test.welcome': U('Welcome, child.', 'ようこそ、子よ。'), 'dlg.test.gone': U('Gone line.', '消えた') },
      terms: { 'Alpha Town': 'アルファの町', Waystone: 'ウェイストーン', 'Ghost Name': 'ゴースト' },
    });
    tbl('ja', 'levels/alpha', {
      units: {
        [A.hello]: U('Hello, traveler!', 'こんにちは、旅の方！'),
        [A.only]: U('Alpha only. You have ${gold}.', 'アルファだけ。${gol}'),
        [A.sign]: U('Read me in {Alpha Town}.', '{アルファ}で読んで。'),
        [A.sub]: U('Alpha Town', 'Alpha Town'),
        [A.yes]: U('Yes', 'うん'),
      },
      terms: { Pip: 'ピップ', 'Old Square': '旧広場' },
    });
    tbl('ja', 'levels/beta', { units: { [B.one]: U('Beta one.', '{ベータ}一。') }, terms: { Pip: 'ピプ' } });
    // a stale unit in the campaign at a key whose English lives in the base: an orphan, not changed
    tbl('ja', 'campaigns/camp', { ext: ['levels/alpha'], units: { [A.hello]: U('Old hello.', '古い挨拶。') } });
    // a UI string table naming the same things (the glossary cross-check: core tables and a
    // feature's strings.js; any other module of a feature is no table)
    w('src/engine/i18n/strings/hud.js', "export const HUD = { en: { waystone: 'Waystone', other: 'Unrelated', yes: 'Yes' }, ja: { waystone: '導石', yes: 'はい' } };\nexport const notATable = 5;\n");
    w('src/game/combat/strings.js', "export default { en: { title: 'Signpost', fn: () => 'x' }, ja: { title: '立て札' }, zh: {} };\n");
    w('src/game/combat/other.js', "export default { en: { a: 'Kit' }, ja: { a: 'キット' } };\n");
    w('src/game/story/strings.js', "import { nope } from './missing.js';\nexport const X = { en: { a: nope } };\n");
    w('public/i18n/ja/levels/stray.json', serializeTable({ lang: 'ja', id: 'levels/stray' }));
    const ui = await uiGlossary(tmp);
    ok('uiGlossary: the core tables and the features\' strings.js (default or named exports); a module that cannot load is a note',
      ui.names.get('Waystone')?.get('ja') === '導石' && ui.names.get('Signpost')?.get('ja') === '立て札' && !ui.names.has('Kit')
      && isDeepStrictEqual(ui.modules, ['src/engine/i18n/strings/hud.js', 'src/game/combat/strings.js']) && hasMsg(ui.notes, 'src/game/story/strings.js', 'not importable'), [ui.modules, ui.notes]);
    ok('… the feature namespaces not written yet are listed', ui.missing.includes('src/game/party/strings.js') && !ui.missing.includes('src/game/combat/strings.js') && !ui.missing.includes('src/game/story/strings.js'), ui.missing);
    const ws = await loadWorkspace({ root: tmp });
    const rep = checkLanguage(ws, 'ja', { ui: ui.names });
    eq('untranslated units per reader chain, given to the table they live in', [
      keysOf(T(rep, 'common').untranslated.units), keysOf(T(rep, 'levels/alpha').untranslated.units), keysOf(T(rep, 'levels/beta').untranslated.units), keysOf(T(rep, 'campaigns/camp').untranslated.units),
    ], [
      ['dlg.test.hello'],
      sorted([A.tart, A.no]),
      sorted([B.gone, B.two, B.ask, B.yes, B.no, B.sign]),
      sorted([A.camp, CH.one, CH.two, R.dusk, R.room]),
    ]);
    eq('… and terms', [keysOf(T(rep, 'common').untranslated.terms), keysOf(T(rep, 'levels/alpha').untranslated.terms), keysOf(T(rep, 'campaigns/camp').untranslated.terms)], [
      ['Beta Bay', 'Signpost', 'Untitled', 'Untitled campaign', 'Villager'], [], ['Camp Tale', 'Kit', 'The Room'],
    ]);
    const u = T(rep, 'campaigns/camp').untranslated.units.find((x) => x.key === A.camp);
    eq('… with the English, where and the notes', [u.text, u.where, u.note], ['Camp-only alpha line.', ['campaigns/camp/levels/alpha.json › pip (npc) › dialogue[3]'], { type: 'npc', speaker: 'Pip', prev: 'Want a crème tart?' }]);
    const rm = T(rep, 'campaigns/camp').untranslated.units.find((x) => x.key === R.room);
    eq('… a line a chapter variant shares with its base: one unit, used in both files', rm?.where, ['campaigns/camp/levels/room.json › kit (npc) › dialogue[0]', 'campaigns/camp/levels/room-dusk.json › kit (npc) › dialogue[0]']);
    eq('translated: the units and terms in use', [T(rep, 'common').translated, T(rep, 'levels/alpha').translated, T(rep, 'levels/beta').translated], [3, 7, 2]);
    const co = T(rep, 'common').orphans;
    ok('orphans: a unit no source holds the key of, a term nothing shows', isDeepStrictEqual(co.units.map((x) => [x.key, x.source]), [['dlg.test.gone', 'Gone line.']]) && /no source holds its key/.test(co.units[0].why) && isDeepStrictEqual(co.terms, ['Ghost Name']) && T(rep, 'levels/alpha').orphans.units.length === 0, co);
    const camp = T(rep, 'campaigns/camp');
    ok('… a unit whose key now shows English that lives in the base table: an orphan (the base translates it), not changed', isDeepStrictEqual(camp.orphans.units.map((x) => x.key), [A.hello]) && /its key now shows English that levels\/alpha holds/.test(camp.orphans.units[0].why) && camp.changed.length === 0, camp.orphans);
    const ae = T(rep, 'levels/alpha');
    ok('a changed ${…} value: an error', hasMsg(ae.errors, A.only, 'story values differ'), ae.errors);
    ok('a gold {Term} span that is not the term\'s translation: a warning', hasMsg(ae.warnings, A.sign, '{Alpha Town} is the term "アルファの町"', '{アルファ}'), ae.warnings);
    ok('a unit identical to the English: a warning', hasMsg(ae.warnings, A.sub, 'same as the English'), ae.warnings);
    ok('a lost gold span: a warning', hasMsg(T(rep, 'levels/beta').warnings, 'gold spans: 0 in English, 1 here'), T(rep, 'levels/beta').warnings);
    ok('a term translated differently in two tables: a warning', hasMsg(rep.terms, 'term "Pip"', 'levels/alpha "ピップ"', 'levels/beta "ピプ"'), rep.terms);
    ok('the UI glossary: a name translated otherwise, one the content does not translate yet (a unit whose English is a UI string keeps its own register)', hasMsg(rep.glossary, '"Waystone"', '導石', 'ウェイストーン') && hasMsg(rep.glossary, '"Signpost"', 'no content table') && rep.glossary.length === 2, rep.glossary);
    // the CLI on the fixture: errors exit 1; the stray table, the orphans …
    let p = run('check-i18n.mjs');
    ok('check-i18n --root: exit 1 on the errors', p.status === 1, p.stdout + p.stderr);
    ok('… reports the unlisted table, the loc() error, the orphans, the UI glossary — and no tc() section', /stray\.json is not listed/.test(p.stdout) && /joined with \+/.test(p.stdout) && /orphan dlg\.test\.gone/.test(p.stdout)
      && /orphan term "Ghost Name"/.test(p.stdout) && !/tc\(\)/.test(p.stdout) && /UI glossary: "Waystone"/.test(p.stdout) && /not written yet .*src\/game\/party\/strings\.js/.test(p.stdout), p.stdout);
    ok('… and no "moved" anywhere', !/moved/.test(p.stdout), p.stdout);
    p = run('check-i18n.mjs', '--json');
    let js = null;
    try { js = JSON.parse(p.stdout); } catch { /* reported below */ }
    ok('--json: one JSON document with both languages, the volume, the texts with no key and the summary', js && js.languages.ja.tables.length === 4 && js.languages.zh.tables.length === 4 && js.volume['campaigns/camp'].units === 5 && !('tc' in js) && isDeepStrictEqual(js.noKey, {})
      && js.summary.errors >= 2 && !('tcLeft' in js.summary) && !('moved' in js.languages.ja.tables[0]), p.stdout.slice(0, 400));
    p = run('check-i18n.mjs', '--json', '--table=common');
    js = null;
    try { js = JSON.parse(p.stdout); } catch { /* reported below */ }
    ok('--table: only those tables, and the term and glossary lines that name one of them', js && js.languages.ja.tables.map((t) => t.id).join() === 'common' && js.languages.ja.terms.length === 0 && js.languages.ja.glossary.length === 1 && /"Waystone"/.test(js.languages.ja.glossary[0]), js && js.languages.ja);
    p = run('check-i18n.mjs', '--table=levels/nope/x');
    ok('--table with no table id: exit 2', p.status === 2, p.stdout + p.stderr);
    // a broken file, a listed table missing, a table naming another language, extends not listed, a key with two Englishes
    w('public/i18n/zh/levels/beta.json', '{ "format": ');
    w('public/i18n/zh/campaigns/camp.json', { ...v3('campaigns/camp', 'ja', { units: { [CH.one]: U('Chapter One', '') } }), extends: ['levels/alpha', 'levels/nowhere'] });
    fs.rmSync(path.join(tmp, 'public/i18n/zh/common.json'));
    // a level file named story: only a file name now (the keys are the data's, no scope is built from it)
    w('public/campaigns/camp/levels/story.json', lvl('Story', (L) => { npc(L, 'x', { name: 'X', ...talkOf([['Once a scope.', G('story.x')]]) }); }));
    w('public/campaigns/camp/campaign.json', { ...campaignJson, levels: [...campaignJson.levels, { id: 'story' }] });
    w('src/engine/other.js', "export const x = loc('dlg.test.welcome', 'Another welcome.');\n");
    const ws2 = await loadWorkspace({ root: tmp });
    const z = checkLanguage(ws2, 'zh');
    ok('a table file that is no JSON: an error line', hasMsg(T(z, 'levels/beta').errors, 'not a JSON object'), T(z, 'levels/beta').errors);
    ok('a listed table missing: an error', hasMsg(T(z, 'common').errors, 'does not exist'), T(z, 'common').errors);
    ok('a file naming another language, an empty translation, extends not listed: errors', hasMsg(T(z, 'campaigns/camp').errors, '"lang"') && hasMsg(T(z, 'campaigns/camp').errors, 'empty translation') && hasMsg(T(z, 'campaigns/camp').errors, 'extends levels/nowhere'), T(z, 'campaigns/camp').errors);
    ok('a level file named story: no error, its text keyed as any other', ws2.sources.get('campaigns/camp').errors.length === 0 && ws2.sources.get('campaigns/camp').units.has(G('story.x')), ws2.sources.get('campaigns/camp').errors);
    ok('one code key with two Englishes in two files: an error, no crash', hasMsg(ws2.sources.get('common').errors, 'dlg.test.welcome: one key, 2 different Englishes', 'src/game/dialogue.js:2', 'src/engine/other.js:1'), ws2.sources.get('common').errors);
    p = run('check-i18n.mjs', '--lang=zh', '--quiet');
    ok('… the CLI: exit 1, no stack trace', p.status === 1 && !/\n\s+at /.test(p.stderr) && /2 different Englishes/.test(p.stdout), p.stdout + p.stderr);
    // put the fixture back
    w('public/campaigns/camp/campaign.json', campaignJson);
    fs.rmSync(path.join(tmp, 'public/campaigns/camp/levels/story.json'));
    fs.rmSync(path.join(tmp, 'src/engine/other.js'));
    fs.rmSync(path.join(tmp, 'public/i18n/ja/levels/stray.json'));
    tbl('ja', 'campaigns/camp', { ext: ['levels/alpha'] });
    w('src/engine/thing.js', '// fixed\n');
    for (const id of ['common', 'levels/alpha', 'levels/beta', 'campaigns/camp']) tbl('zh', id, { ext: id === 'campaigns/camp' ? ['levels/alpha'] : [] });
    tbl('ja', 'common', { units: { 'dlg.test.welcome': U('Welcome, child.', 'ようこそ、子よ。') }, terms: { 'Alpha Town': 'アルファの町', Waystone: '導石' } });
    tbl('ja', 'levels/alpha', {
      units: {
        [A.hello]: U('Hello, traveler!', 'こんにちは、旅の方！'),
        [A.only]: U('Alpha only. You have ${gold}.', 'アルファだけ。所持金 ${gold}'),
        [A.sign]: U('Read me in {Alpha Town}.', '{アルファの町}で読んで。'),
        [A.sub]: U('Alpha Town', 'アルファの町'),
      },
      terms: { Pip: 'ピップ', 'Old Square': '旧広場' },
    });
    tbl('ja', 'levels/beta', { units: { [B.one]: U('Beta one.', 'ベータ一。') }, terms: { Pip: 'ピップ' } });
    p = run('check-i18n.mjs', '--quiet');
    ok('… fixed: exit 0 (untranslated entries are no warnings)', p.status === 0, p.stdout + p.stderr);
    p = run('check-i18n.mjs', '--strict', '--quiet');
    ok('--strict: the warnings (here the UI glossary) fail it', p.status === 1 && /UI glossary/.test(p.stdout), p.stdout);
  }

  // ===============================================================================================
  begin('the worklist: write, fill, merge (JSON)');
  {
    const out = path.join(tmp, 'work');
    let p = run('i18n-worklist.mjs', `--out=${out}`, '--lang=ja');
    ok('written', p.status === 0 && fs.existsSync(path.join(out, 'ja/campaigns/camp.json')) && !fs.existsSync(path.join(out, 'zh')), p.stdout + p.stderr);
    const wl = JSON.parse(fs.readFileSync(path.join(out, 'ja/campaigns/camp.json'), 'utf8'));
    eq('… version 3: its units in the order the game\'s files hold them, keyed by the GUIDs the data holds; terms apart', [wl.format, wl.version, wl.units.map((e) => e.key), wl.terms.map((e) => e.name)], [
      'luminati-i18n-worklist', 3, [CH.one, CH.two, A.camp, R.room, R.dusk], ['Camp Tale', 'The Room', 'Kit'],
    ]);
    const e3 = wl.units[2];
    eq('… a unit: key, English, empty target, kind, where (readable), speaker, before, type', [e3.source, e3.target, e3.kind, e3.where, e3.speaker, e3.before, e3.type], ['Camp-only alpha line.', '', 'line', ['campaigns/camp/levels/alpha.json › pip (npc) › dialogue[3]'], 'Pip', 'Want a crème tart?', 'npc']);
    const wa = JSON.parse(fs.readFileSync(path.join(out, 'ja/levels/alpha.json'), 'utf8'));
    eq('… an English no table translates: no suggestion', wa.units.find((e) => e.key === A.no)?.suggestions ?? null, null);
    const wc = JSON.parse(fs.readFileSync(path.join(out, 'ja/common.json'), 'utf8'));
    eq('… a code unit whose English a level table translates: suggested', wc.units.find((e) => e.key === 'dlg.test.hello')?.suggestions, [{ target: 'こんにちは、旅の方！', from: `levels/alpha ${A.hello}` }]);
    eq('… a term no table translates: no suggestion', wc.terms.find((e) => e.name === 'Villager')?.suggestions ?? null, null);
    // fill: the campaign's worklist
    for (const e of wl.units) e.target = `【${e.source}】`;
    wl.units[0].target = '';
    wl.units[3].target = '部屋の行。\r\n二行目';
    wl.units.push({ key: R.room, source: 'Room line.', target: '{broken' });
    wl.units.push({ key: G('nobody'), source: 'Nobody', target: '誰も' });
    wl.units.push({ key: 'room:nobody.text[0]', source: 'Nobody', target: '誰も' });
    wl.units.push({ key: R.dusk, source: 'Dusk line, edited.', target: '夕方の行（古い）' });
    wl.units.push({ key: R.room, source: 'Room line.', target: '部屋の行。', fuzzy: true });
    for (const t of wl.terms) t.target = `「${t.name}」`;
    wl.terms.push({ name: 'Nobody At All', target: '誰' });
    fs.writeFileSync(path.join(out, 'ja/campaigns/camp.json'), JSON.stringify(wl));
    const before = rd('public/i18n/ja/campaigns/camp.json');
    p = run('i18n-worklist.mjs', `--merge=${path.join(out, 'ja/campaigns/camp.json')}`, '--dry-run');
    ok('merge --dry-run: writes nothing', rd('public/i18n/ja/campaigns/camp.json') === before && /would change/.test(p.stdout), p.stdout + p.stderr);
    p = run('i18n-worklist.mjs', `--merge=${path.join(out, 'ja/campaigns/camp.json')}`);
    ok('merge: the broken entry refused (exit 1), the rest merged', p.status === 1 && new RegExp(`✗ ja/campaigns/camp ${R.room}: unbalanced braces`).test(p.stderr), p.stdout + p.stderr);
    ok('… skipped: a key no reader shows, a key that is no text key, an English no longer at its key, a fuzzy entry, a name nothing shows; blanks counted', new RegExp(`${G('nobody')}: no reader`).test(p.stdout)
      && /room:nobody\.text\[0\]: not a text key/.test(p.stdout) && new RegExp(`${R.dusk}: the English is now "Dusk line\\."`).test(p.stdout)
      && /fuzzy/.test(p.stdout) && /term "Nobody At All": nothing that reads/.test(p.stdout) && /5 skipped, 1 blank, 1 refused/.test(p.stdout), p.stdout);
    const mj = JSON.parse(rd('public/i18n/ja/campaigns/camp.json'));
    eq('… the table: version 3, sorted keys, the extractor\'s English as the source, CRLF → LF, the terms', [mj.version, Object.keys(mj.units), mj.units[R.room], Object.keys(mj.terms)], [
      3, sorted([A.camp, CH.two, R.dusk, R.room]), { source: 'Room line.', target: '部屋の行。\n二行目' }, ['Camp Tale', 'Kit', 'The Room'],
    ]);
    eq('… an entry whose English changed did not overwrite the one at its key', mj.units[R.dusk], U('Dusk line.', '【Dusk line.】'));
    const text = rd('public/i18n/ja/campaigns/camp.json');
    ok('… LF, a final newline, two-space indent', !text.includes('\r') && text.endsWith('}\n') && text.includes(`\n  "units": {\n    "${sorted([A.camp, CH.two, R.dusk, R.room])[0]}"`), text.slice(0, 300));
    // --force: an English that changed is merged onto the English now at its key; a fuzzy entry too
    p = run('i18n-worklist.mjs', `--merge=${path.join(out, 'ja/campaigns/camp.json')}`, '--force', '--dry-run');
    ok('--force merges the changed and the fuzzy entries and the markup error (here --dry-run)', p.status === 0 && /merged onto the English now at the key, "Dusk line\."/.test(p.stdout) && /3 translation\(s\) to merge/.test(p.stdout), p.stdout + p.stderr);
    // the game's loader reads it through the extends chain
    const r = await loadContentTables('ja', { campaign: 'camp', read: nodeReader(path.join(tmp, 'public/i18n')) });
    eq('the loader on the merged tables: the variant\'s shared line through its one key', [r.tables, loc(R.room, 'Room line.'), loc(A.hello, 'Hello, traveler!'), term('Kit'), term('Pip'), loc('dlg.test.welcome', 'Welcome, child.')],
      [['campaigns/camp', 'levels/alpha', 'common'], '部屋の行。\n二行目', 'こんにちは、旅の方！', '「Kit」', 'ピップ', 'ようこそ、子よ。']);
    clearContentTables();
    // refusals: a table that is no JSON or of a newer version; a worklist of another version; a table the index does not list
    const campFile = 'public/i18n/ja/campaigns/camp.json';
    const good = rd(campFile);
    const one = (units) => JSON.stringify({ format: 'luminati-i18n-worklist', version: WORKLIST_VERSION, lang: 'ja', table: 'campaigns/camp', units, terms: [] });
    fs.writeFileSync(path.join(out, 'room.json'), one([{ key: R.dusk, source: 'Dusk line.', target: '夕方の行。' }]));
    const bad = JSON.parse(good);
    bad.units[R.room].target = '';
    bad.terms.Kit = 5;
    w(campFile, bad);
    p = run('i18n-worklist.mjs', `--merge=${path.join(out, 'room.json')}`);
    ok('what the loader drops from the rewritten table is printed', p.status === 0 && new RegExp(`${R.room}.*empty translation.*leaves it out`).test(p.stdout) && /"Kit".*not a string.*leaves it out/.test(p.stdout), p.stdout + p.stderr);
    w(campFile, '{ "format": "luminati-i18n", ');
    p = run('i18n-worklist.mjs', `--merge=${path.join(out, 'room.json')}`);
    ok('a table that is no JSON: refused (exit 1), no stack trace, the file left as it was', p.status === 1 && /cannot be read \(.*not a JSON object/.test(p.stderr) && !/\n\s+at /.test(p.stderr) && rd(campFile) === '{ "format": "luminati-i18n", ', p.stdout + p.stderr);
    w(campFile, { ...JSON.parse(good), version: 9 });
    p = run('i18n-worklist.mjs', `--merge=${path.join(out, 'room.json')}`);
    ok('… a newer version: refused', p.status === 1 && /version 9, newer/.test(p.stderr), p.stderr);
    w(campFile, good);
    fs.writeFileSync(path.join(out, 'v2.json'), JSON.stringify({ format: 'luminati-i18n-worklist', version: 2, lang: 'ja', table: 'campaigns/camp', units: [{ key: R.room, source: 'Room line.', target: '部屋' }], terms: [] }));
    p = run('i18n-worklist.mjs', `--merge=${path.join(out, 'v2.json')}`);
    ok('a worklist of another version: refused (not a version-3 worklist), the table left as it was', p.status === 1 && /not a version-3 worklist/.test(p.stderr) && rd(campFile) === good, p.stderr);
    fs.writeFileSync(path.join(out, 'unlisted.json'), JSON.stringify({ format: 'luminati-i18n-worklist', version: WORKLIST_VERSION, lang: 'fr', table: 'common', units: [], terms: [] }));
    p = run('i18n-worklist.mjs', `--merge=${path.join(out, 'unlisted.json')}`);
    ok('a table the index does not list: refused', p.status === 1 && /does not list common for fr/.test(p.stderr), p.stderr);
    for (const f of ['room.json', 'v2.json', 'unlisted.json']) fs.rmSync(path.join(out, f));
  }

  // ===============================================================================================
  begin('the worklist in PO: write, fill, merge');
  {
    const out = path.join(tmp, 'work-po');
    let p = run('i18n-worklist.mjs', `--out=${out}`, '--lang=zh', '--format=po', '--table=levels/alpha');
    ok('written', p.status === 0 && fs.existsSync(path.join(out, 'zh/levels/alpha.po')), p.stdout + p.stderr);
    const po = parsePo(fs.readFileSync(path.join(out, 'zh/levels/alpha.po'), 'utf8'));
    eq('… the header: the language, the table, worklist version 3', [po.header.Language, po.header['X-Luminati-Table'], po.header['X-Luminati-Worklist-Version'], po.errors], ['zh', 'levels/alpha', '3', []]);
    eq('… msgctxt the GUID the data holds (term for a term), msgid the English', po.entries.map((e) => [e.msgctxt, e.msgid]), [
      [A.hello, 'Hello, traveler!'], [A.only, 'Alpha only. You have ${gold}.'], [A.tart, 'Want a crème tart?'], [A.yes, 'Yes'], [A.no, 'No'], [A.sign, 'Read me in {Alpha Town}.'], [A.sub, 'Alpha Town'],
      ['term', 'Pip'], ['term', 'Old Square'],
    ]);
    ok('… notes and where: the readable place in a note, <file>:<key> references', po.entries[2].extracted.includes('speaker: Pip') && po.entries[2].extracted.includes('before: Alpha only. You have ${gold}.') && isDeepStrictEqual(po.entries[2].references, [`levels/alpha.json:${A.tart}`, `campaigns/camp/levels/alpha.json:${A.tart}`])
      && po.entries[2].extracted.includes('where: levels/alpha.json › pip (npc) › dialogue[2]') && po.entries[2].extracted.includes('where: campaigns/camp/levels/alpha.json › pip (npc) › dialogue[2]'), po.entries[2]);
    // fill it as a CAT tool would: CRLF, an NFD English, one markup error
    let text = fs.readFileSync(path.join(out, 'zh/levels/alpha.po'), 'utf8');
    text = text.replace('msgid "Want a crème tart?"', 'msgid "Want a cre\u0300me tart?"');
    ok('… (the PO file now holds the decomposed English)', text.includes('msgid "Want a cre\u0300me tart?"') && !text.includes('msgid "Want a crème tart?"'), text.slice(0, 200));
    const fill = (ctx, value) => { text = text.replace(new RegExp(`(msgctxt "${ctx}"\\nmsgid [^\\n]*\\nmsgstr )""`), `$1"${value}"`); };
    fill(A.hello, '你好，旅人！');
    fill(A.only, '只有阿尔法。你有 ${gold}。');
    fill(A.tart, '要一个馅饼吗？');
    fill(A.yes, '{要');
    text = text.replace('msgctxt "term"\nmsgid "Pip"\nmsgstr ""', 'msgctxt "term"\nmsgid "Pip"\nmsgstr "皮普"');
    fs.writeFileSync(path.join(out, 'zh/levels/alpha.po'), text.replace(/\n/g, '\r\n'));
    p = run('i18n-worklist.mjs', `--merge=${path.join(out, 'zh/levels/alpha.po')}`);
    ok('merge a PO file: the markup error refused (exit 1), the rest merged', p.status === 1 && new RegExp(`${A.yes}: unbalanced braces`).test(p.stderr) && /4 translation\(s\) merged/.test(p.stdout), p.stdout + p.stderr);
    const zt = JSON.parse(rd('public/i18n/zh/levels/alpha.json'));
    eq('… the table', [Object.keys(zt.units), zt.units[A.only], zt.terms], [sorted([A.hello, A.only, A.tart]), { source: 'Alpha only. You have ${gold}.', target: '只有阿尔法。你有 ${gold}。' }, { Pip: '皮普' }]);
    eq('… an English the CAT tool handed back decomposed (NFD): merged, with the extractor\'s English as the source', zt.units[A.tart].source, 'Want a crème tart?');
    const old = text.replace('X-Luminati-Worklist-Version: 3', 'X-Luminati-Worklist-Version: 2');
    fs.writeFileSync(path.join(out, 'old.po'), old);
    p = run('i18n-worklist.mjs', `--merge=${path.join(out, 'old.po')}`);
    ok('… a PO file of another worklist version: refused', p.status === 1 && /not a version-3 worklist \(its header says X-Luminati-Worklist-Version: 2\)/.test(p.stderr), p.stdout + p.stderr);
    fs.rmSync(path.join(out, 'old.po'));
  }

  // ===============================================================================================
  begin('edits: a page inserted, a line edited, a sign deleted — nothing moves; --prune');
  {
    tbl('ja', 'levels/beta', {
      units: {
        [B.one]: U('Beta one.', 'ベータ一。'),
        [B.two]: U('Beta two.', 'ベータ二。'),
        [B.ask]: U('Beta ask?', 'ベータ質問？'),
        [B.yes]: U('Yes', 'はい'),
        [B.no]: U('No', 'いいえ'),
        [B.sign]: U('Beta sign.', 'ベータの看板。'),
        [B.gone]: U('A sign that will go.', '消える看板。'),
      },
      terms: { Pip: 'ピップ' },
    });
    let p = run('check-i18n.mjs', '--lang=ja', '--table=levels/beta', '--quiet');
    ok('Beta fully translated first', p.status === 0 && !/! (orphan|changed)/.test(p.stdout) && /0 untranslated/.test(p.stdout), p.stdout);
    // a page inserted at the front of Beta's villager (a new key, as the editor mints it), Beta's sign rewritten (its key kept), a sign removed
    w('public/levels/beta.json', beta([['A new first page.', B.new], ...BETA], 'Beta sign, rewritten.', false));
    // and a page inserted at the front of the shipped Alpha, under the campaign's copy
    w('public/levels/alpha.json', alpha([['A brand new hello.', A.brand], ...ALPHA]));
    const ws = await loadWorkspace({ root: tmp });
    const rep = checkLanguage(ws, 'ja');
    const b = T(rep, 'levels/beta');
    eq('the inserted page: untranslated; every other page keeps its key and its translation (no "moved": the keys are the data\'s)', [keysOf(b.untranslated.units), b.translated, 'moved' in b], [[B.new], 6, false]);
    eq('changed: the same key, another source — the old and the new English, the old translation', b.changed.map((c) => [c.key, c.was, c.now, c.target]), [[B.sign, 'Beta sign.', 'Beta sign, rewritten.', 'ベータの看板。']]);
    eq('orphans: the deleted sign\'s unit (no source holds its key)', b.orphans.units.map((x) => x.key), [B.gone]);
    ok('… each as a warning', hasMsg(b.warnings, `changed ${B.sign}`, 'was "Beta sign."', 'now "Beta sign, rewritten."') && hasMsg(b.warnings, `orphan ${B.gone}`, 'no source holds its key', '--prune') && b.warnings.length === 2, b.warnings);
    const a = T(rep, 'levels/alpha');
    eq('the shipped level\'s inserted page: untranslated, its neighbours still translated (nothing borrowed, nothing changed)', [keysOf(a.untranslated.units).includes(A.brand), keysOf(a.untranslated.units).includes(A.hello), a.changed], [true, false, []]);
    // the worklist: written for every table (there is nothing to sync)
    const out = path.join(tmp, 'work-edit');
    p = run('i18n-worklist.mjs', `--out=${out}`, '--lang=ja', '--table=levels/beta,levels/alpha');
    ok('worklist: written', p.status === 0 && fs.existsSync(path.join(out, 'ja/levels/beta.json')) && fs.existsSync(path.join(out, 'ja/levels/alpha.json')), p.stdout + p.stderr);
    const wb = JSON.parse(fs.readFileSync(path.join(out, 'ja/levels/beta.json'), 'utf8'));
    eq('… the new page and the changed sign, with previous', wb.units.map((e) => [e.key, e.source, e.previous ?? null]), [[B.new, 'A new first page.', null], [B.sign, 'Beta sign, rewritten.', { source: 'Beta sign.', target: 'ベータの看板。' }]]);
    ok('… the orphans: run --prune', /1 orphan: --prune/.test(p.stdout), p.stdout);
    p = run('i18n-worklist.mjs', `--out=${out}`, '--lang=ja', '--table=levels/beta', '--format=po');
    const poFile = path.join(out, 'ja/levels/beta.po');
    const pb = parsePo(fs.readFileSync(poFile, 'utf8'));
    const fz = pb.entries.find((e) => e.msgctxt === B.sign);
    eq('… in PO: the changed unit fuzzy, #| msgid the old English, msgstr empty and the old translation in a note (S1)', [fz.flags, fz.previous, fz.msgid, fz.msgstr, fz.extracted.includes('previous translation: ベータの看板。')], [['fuzzy'], { msgid: 'Beta sign.' }, 'Beta sign, rewritten.', '', true]);
    p = run('i18n-worklist.mjs', `--merge=${poFile}`, '--force');
    ok('… merged unedited, even with --force: nothing (the changed entry has no translation)', p.status === 0 && /0 translation\(s\) merged/.test(p.stdout) && JSON.parse(rd('public/i18n/ja/levels/beta.json')).units[B.sign].source === 'Beta sign.', p.stdout + p.stderr);
    const poText = fs.readFileSync(poFile, 'utf8');
    fs.writeFileSync(poFile, poText.replace('msgid "Beta sign, rewritten."\nmsgstr ""', 'msgid "Beta sign, rewritten."\nmsgstr "ベータの看板。"'));
    p = run('i18n-worklist.mjs', `--merge=${poFile}`, '--force');
    ok('… a fuzzy entry whose msgstr is the old translation: never merged, even with --force (S1)', p.status === 0 && new RegExp(`${B.sign}: fuzzy, and its translation is still the old one`).test(p.stdout) && /0 translation\(s\) merged/.test(p.stdout), p.stdout + p.stderr);
    fs.writeFileSync(poFile, poText.replace('msgid "Beta sign, rewritten."\nmsgstr ""', 'msgid "Beta sign, rewritten."\nmsgstr "書き直したベータの看板。"'));
    p = run('i18n-worklist.mjs', `--merge=${poFile}`);
    ok('… translated but still fuzzy: skipped without --force (--force=fuzzy merges it)', p.status === 0 && new RegExp(`${B.sign}: fuzzy \\(a changed English to review\\) — skipped`).test(p.stdout) && /--force=fuzzy/.test(p.stdout), p.stdout + p.stderr);
    fs.writeFileSync(poFile, poText.replace('#, fuzzy\n', '').replace('msgid "Beta sign, rewritten."\nmsgstr ""', 'msgid "Beta sign, rewritten."\nmsgstr "書き直したベータの看板。"'));
    p = run('i18n-worklist.mjs', `--merge=${poFile}`);
    ok('… reviewed (fuzzy removed): merged', p.status === 0 && /1 translation\(s\) merged/.test(p.stdout) && JSON.parse(rd('public/i18n/ja/levels/beta.json')).units[B.sign].source === 'Beta sign, rewritten.', p.stdout + p.stderr);
    p = run('i18n-worklist.mjs', '--prune', '--dry-run');
    ok('--prune --dry-run: writes nothing', p.status === 0 && B.gone in JSON.parse(rd('public/i18n/ja/levels/beta.json')).units && /would change/.test(p.stdout), p.stdout + p.stderr);
    p = run('i18n-worklist.mjs', '--prune');
    const pruned = JSON.parse(rd('public/i18n/ja/levels/beta.json'));
    ok('--prune: the orphan dropped, the rest kept', p.status === 0 && !(B.gone in pruned.units) && Object.keys(pruned.units).length === 6, [p.stdout, Object.keys(pruned.units)]);
    const rep2 = checkLanguage(await loadWorkspace({ root: tmp }), 'ja');
    eq('… then: nothing changed, no orphans; the new page untranslated', [T(rep2, 'levels/beta').changed, T(rep2, 'levels/beta').orphans.units, keysOf(T(rep2, 'levels/beta').untranslated.units)], [[], [], [B.new]]);
    // a unit under a key no data can hold (no GUID, <GUID>.2 or code key): an orphan, and --prune drops it
    const withOdd = JSON.parse(rd('public/i18n/ja/levels/beta.json'));
    withOdd.units['beta:pip.dialogue[0]'] = U('Old place.', '古い場所。');
    w('public/i18n/ja/levels/beta.json', withOdd);
    const oddUnit = T(checkLanguage(await loadWorkspace({ root: tmp }), 'ja'), 'levels/beta').orphans.units.find((x) => x.key === 'beta:pip.dialogue[0]');
    ok('a unit under a key that is no text key: an orphan, saying so', /not a text key/.test(oddUnit?.why ?? ''), oddUnit);
    p = run('i18n-worklist.mjs', '--prune');
    ok('… --prune drops it', p.status === 0 && !('beta:pip.dialogue[0]' in JSON.parse(rd('public/i18n/ja/levels/beta.json')).units), p.stdout + p.stderr);
    // a broken index: an error line and exit 1 from every tool, never a stack trace; --init leaves it alone
    const indexFile = path.join(tmp, 'public/i18n/index.json');
    const indexText = fs.readFileSync(indexFile, 'utf8');
    fs.writeFileSync(indexFile, '{ "format": ');
    const runs = [run('check-i18n.mjs', '--quiet'), run('i18n-worklist.mjs', `--out=${path.join(tmp, 'work2')}`), run('i18n-worklist.mjs', `--merge=${path.join(tmp, 'work-po')}`), run('i18n-worklist.mjs', '--init'), run('i18n-worklist.mjs', '--prune')];
    ok('a broken index.json: exit 1 with an error line from the checker, the worklist, merge, --init and --prune', runs.every((x) => x.status === 1 && /not valid JSON/.test(x.stdout + x.stderr) && !/\n\s+at /.test(x.stderr)), runs.map((x) => [x.status, (x.stdout + x.stderr).slice(-200)]));
    ok('… --init did not rewrite it', fs.readFileSync(indexFile, 'utf8') === '{ "format": ');
    fs.writeFileSync(indexFile, indexText);
    eq('usage errors: exit 2 (--sync is gone: nothing moves)', [run('i18n-worklist.mjs', '--format=xliff').status, run('i18n-worklist.mjs', '--merge', '--prune').status, run('i18n-worklist.mjs', '--merge=nowhere').status, run('i18n-worklist.mjs', '--sync').status, run('check-i18n.mjs', '--sync').status], [2, 2, 2, 2, 2]);
    ok('… and --sync says why', /--sync is gone/.test(run('i18n-worklist.mjs', '--sync').stderr));
    ok('rewriteRefusal', rewriteRefusal({ raw: { version: 3 }, broken: false, warnings: [] }) === '' && /newer/.test(rewriteRefusal({ raw: { version: 4 }, broken: false, warnings: [] })));
    const tm = translationMemory(new Map([['levels/a', { table: T3('levels/a', { terms: { Pip: 'ピップ' }, units: { [G('tm0')]: U('Pip', 'ピップ（行）'), [G('tm1')]: U('Hi', 'やあ') } }), warnings: [], raw: null, broken: false, lang: 'ja', id: 'levels/a' }]]));
    eq('translationMemory: terms and units by the English; suggestionsFor skips the entry itself and repeats', [suggestionsFor(tm, 'Pip'), suggestionsFor(tm, 'Hi', `levels/a ${G('tm1')}`)], [[{ target: 'ピップ', from: 'levels/a term' }, { target: 'ピップ（行）', from: `levels/a ${G('tm0')}` }], []]);
    const quests = scriptStrings(['quest q start The ${gold} Hunt', 'quest q stage s Paid ${gold}.', 'quest q stage t Plain.', 'toast Have ${gold}.'], { where: 'w' }).strings;
    ok('sourceWarnings: a script\'s quest text with values (saved filled in)', hasMsg(sourceWarnings(new Map([['x', { strings: quests }]])), 'w:2', '${gold}', 'saves it filled in') && sourceWarnings(new Map([['x', { strings: quests }]])).length === 2);
  }

  // ===============================================================================================
  begin('nothing moves: repeated English, reordered pages, keys out of step, a key with two Englishes');
  {
    const pages = (list, extra) => beta(list, 'Beta sign, rewritten.', false, extra);
    const beta0 = (units) => tbl('ja', 'levels/beta', { units: { ...units, [B.sign]: U('Beta sign, rewritten.', '書き直したベータの看板。') }, terms: { Pip: 'ピップ' } });
    const bt = async () => T(checkLanguage(await loadWorkspace({ root: tmp }), 'ja'), 'levels/beta');
    const W = { welcome: G('w.welcome'), no1: G('w.no1'), no2: G('w.no2'), bye: G('w.bye'), oh: G('w.oh'), no3: G('w.no3') };
    // the same English twice in one villager, translated differently (review item M3)
    w('public/levels/beta.json', pages([['Welcome.', W.welcome], ['No.', W.no1], ['No.', W.no2], ['Bye.', W.bye]]));
    beta0({ [W.welcome]: U('Welcome.', 'ようこそ。'), [W.no1]: U('No.', 'いやじゃ！'), [W.no2]: U('No.', '……いいえ。'), [W.bye]: U('Bye.', 'さらば。') });
    let b = await bt();
    ok('all in use first', b.changed.length + b.orphans.units.length + b.untranslated.units.length === 0 && b.translated === 6, b.warnings);
    w('public/levels/beta.json', pages([['Oh!', W.oh], ['Welcome.', W.welcome], ['No.', W.no1], ['No.', W.no2], ['Bye.', W.bye]]));
    b = await bt();
    eq('a page inserted above two "No."s: only the new page untranslated, nothing changed or orphaned, no warning', [keysOf(b.untranslated.units), b.changed, b.orphans.units, b.warnings], [[W.oh], [], [], []]);
    installContentTables('ja', [parseContentTable(JSON.parse(rd('public/i18n/ja/levels/beta.json')), { id: 'levels/beta', lang: 'ja' }).table]);
    eq('… and the game shows each "No." its own translation', [loc(W.no1, 'No.'), loc(W.no2, 'No.'), contentMisses()], ['いやじゃ！', '……いいえ。', []]);
    clearContentTables();
    w('public/levels/beta.json', pages([['Oh!', W.oh], ['Welcome.', W.welcome], ['No.', W.no1], ['No.', W.no2], ['No.', W.no3], ['Bye.', W.bye]]));
    b = await bt();
    eq('… a third "No." beside them (its own key): untranslated; the two keep theirs', keysOf(b.untranslated.units), sorted([W.oh, W.no3]));
    // reordered pages: each key goes with its text (the editor carries them)
    w('public/levels/beta.json', pages([['Bye.', W.bye], ['No.', W.no2], ['Welcome.', W.welcome], ['No.', W.no1]]));
    b = await bt();
    eq('pages reordered: every page still translated, nothing changed', [b.untranslated.units, b.changed, b.orphans.units], [[], [], []]);
    // keys out of step: a hand edit dropped the first page's key, so each key now sits one page early
    w('public/levels/beta.json', pages([['Welcome.', W.no1], ['No.', W.no2], ['No.', W.bye], ['Bye.', null]]));
    b = await bt();
    const c1 = b.changed.find((c) => c.key === W.no1);
    eq('keys out of step: the shifted keys are changed; one whose old English sits at the key beside it says so', [c1?.now, c1?.outOfStep, b.changed.find((c) => c.key === W.bye)?.now, b.orphans.units.map((x) => x.key)], ['Welcome.', W.no2, 'No.', [W.welcome]]);
    ok('… as a warning that names npm run i18n:keys', hasMsg(b.warnings, `changed ${W.no1}`, `its old English is now shown at ${W.no2}`, 'out of step', 'i18n:keys'), b.warnings);
    // a text with no key: listed apart, never untranslated (no worklist can name it)
    let ws = await loadWorkspace({ root: tmp });
    eq('… the page left with no key: a unit text with no key (it stays English)', keylessUnits(ws.sources).map((x) => [x.id, x.units.map((e) => e.text)]), [['levels/beta', ['Bye.']]]);
    let p = run('check-i18n.mjs', '--lang=ja', '--table=levels/beta', '--json');
    let js = null;
    try { js = JSON.parse(p.stdout); } catch { /* below */ }
    ok('… check-i18n: a "no key" warning naming the tool, the texts in --json', js && hasMsg(js.warnings, 'levels/beta: 1 unit text(s) with no key', 'no key', 'npm run i18n:keys -- --assign') && js.noKey['levels/beta']?.[0]?.text === 'Bye.'
      && !js.languages.ja.tables[0].untranslated.units.some((x) => x.text === 'Bye.'), js && [js.warnings, js.noKey]);
    p = run('i18n-worklist.mjs', `--out=${path.join(tmp, 'work-nokey')}`, '--lang=ja', '--table=levels/beta');
    ok('… the worklist says how many it cannot list', p.status === 0 && /levels\/beta: 1 unit text with no key in the data .*npm run i18n:keys -- --assign/.test(p.stdout), p.stdout + p.stderr);
    p = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'i18n-keys.mjs'), `--root=${tmp}`, '--assign', 'public/levels/beta.json', '--quiet'], { encoding: 'utf8' });
    ws = await loadWorkspace({ root: tmp });
    ok('… npm run i18n:keys -- --assign gives it a key: then it is a unit to translate', p.status === 0 && keylessUnits(ws.sources).length === 0 && T(checkLanguage(ws, 'ja'), 'levels/beta').untranslated.units.some((x) => x.text === 'Bye.' && isGuid(x.key)), p.stdout + p.stderr);
    // one key with two Englishes among one table's own sources: an error (a sign pasted with its key, then edited)
    w('public/levels/beta.json', pages([['Welcome.', W.welcome]], (L) => sign(L, 'copy', { speaker: 'Pip', text: ['A pasted sign, edited.'], textKeys: { text: [B.sign] } })));
    ws = await loadWorkspace({ root: tmp });
    ok('one key with two Englishes in a table\'s own sources: an error with both Englishes, where, and the fix', hasMsg(ws.sources.get('levels/beta').errors, `${B.sign}: one key, 2 different Englishes`, '"Beta sign, rewritten."', '"A pasted sign, edited."', '› copy (signpost) › text[0]', 'i18n:keys -- --fix'), ws.sources.get('levels/beta').errors);
    p = run('check-i18n.mjs', '--lang=ja', '--quiet');
    ok('… the CLI: exit 1', p.status === 1 && /2 different Englishes/.test(p.stdout), p.stdout);
    w('public/levels/beta.json', beta(BETA, 'Beta sign, rewritten.', false));
  }

  // ===============================================================================================
  begin('a line edited in a shipped level that a campaign extends (S3): divergence along extends is legal');
  {
    w('public/levels/alpha.json', alpha());
    tbl('ja', 'levels/alpha', {
      units: {
        [A.hello]: U('Hello, traveler!', 'こんにちは、旅の方！'),
        [A.only]: U('Alpha only. You have ${gold}.', 'アルファだけ。所持金 ${gold}'),
        [A.sign]: U('Read me in {Alpha Town}.', '{アルファの町}で読んで。'),
        [A.sub]: U('Alpha Town', 'アルファの町'),
      },
      terms: { Pip: 'ピップ', 'Old Square': '旧広場' },
    });
    tbl('ja', 'campaigns/camp', { ext: ['levels/alpha'] });
    const campBefore = rd('public/i18n/ja/campaigns/camp.json');
    // the shipped level's first page edited (its key kept); the campaign's copy keeps the old English
    w('public/levels/alpha.json', alpha([['Hello there, traveler!', A.hello], ...ALPHA.slice(1)]));
    const ws = await loadWorkspace({ root: tmp });
    ok('the same key with another English in the shipped level and the campaign\'s copy: no error (two tables\' sources)', ws.sources.get('levels/alpha').errors.length === 0 && ws.sources.get('campaigns/camp').errors.length === 0, [ws.sources.get('levels/alpha').errors, ws.sources.get('campaigns/camp').errors]);
    const rep = checkLanguage(ws, 'ja');
    const a = T(rep, 'levels/alpha');
    eq('the shipped level\'s reader: changed (with the old English and translation), still in use by the campaign — not untranslated',
      [a.changed.map((c) => [c.key, c.was, c.now, c.target, c.shared]), a.untranslated.units.map((x) => x.key).includes(A.hello)],
      [[[A.hello, 'Hello, traveler!', 'Hello there, traveler!', 'こんにちは、旅の方！', ['campaigns/camp']]], false]);
    ok('… a warning that says the merge keeps the old translation for the campaign', hasMsg(a.warnings, `changed ${A.hello}`, 'campaigns/camp still shows the old English'), a.warnings);
    const out = path.join(tmp, 'work-s3');
    let p = run('i18n-worklist.mjs', `--out=${out}`, '--lang=ja', '--table=levels/alpha');
    const wl = JSON.parse(fs.readFileSync(path.join(out, 'ja/levels/alpha.json'), 'utf8'));
    const e0 = wl.units.find((e) => e.key === A.hello);
    eq('… the worklist: the new English with its previous', [e0?.source, e0?.previous], ['Hello there, traveler!', { source: 'Hello, traveler!', target: 'こんにちは、旅の方！' }]);
    e0.target = 'やあ、旅の方！';
    fs.writeFileSync(path.join(out, 'ja/levels/alpha.json'), JSON.stringify(wl));
    p = run('i18n-worklist.mjs', `--merge=${path.join(out, 'ja/levels/alpha.json')}`);
    const camp = JSON.parse(rd('public/i18n/ja/campaigns/camp.json'));
    eq('… merged: the shipped table has the new line, the campaign\'s table keeps the old one for its copy (the same key, its own English)', [p.status, JSON.parse(rd('public/i18n/ja/levels/alpha.json')).units[A.hello], camp.units[A.hello], campBefore !== rd('public/i18n/ja/campaigns/camp.json')],
      [0, U('Hello there, traveler!', 'やあ、旅の方！'), U('Hello, traveler!', 'こんにちは、旅の方！'), true]);
    ok('… said so', /campaigns\/camp still shows the old English .* its translation is kept for it in campaigns\/camp/.test(p.stdout), p.stdout);
    let r = await loadContentTables('ja', { campaign: 'camp', read: nodeReader(path.join(tmp, 'public/i18n')) });
    const viaCampaign = loc(A.hello, 'Hello, traveler!');
    r = await loadContentTables('ja', { source: 'levels/alpha.json', read: nodeReader(path.join(tmp, 'public/i18n')) });
    eq('… the game: the campaign shows its old line translated, the shipped level its new one', [viaCampaign, loc(A.hello, 'Hello there, traveler!'), r.tables], ['こんにちは、旅の方！', 'やあ、旅の方！', ['levels/alpha', 'common']]);
    clearContentTables();
    const rep2 = checkLanguage(await loadWorkspace({ root: tmp }), 'ja');
    ok('… and the checker has nothing left on either table', ['levels/alpha', 'campaigns/camp'].every((id) => T(rep2, id).changed.length + T(rep2, id).orphans.units.length === 0), ['levels/alpha', 'campaigns/camp'].map((id) => T(rep2, id).warnings));
    w('public/levels/alpha.json', alpha());
    tbl('ja', 'campaigns/camp', { ext: ['levels/alpha'] });
  }

  // ===============================================================================================
  begin('a table that is not version 3: not read');
  {
    const zb = 'public/i18n/zh/levels/beta.json';
    const zbBefore = rd(zb);
    w(zb, v3('levels/beta', 'zh', { version: 2, units: { [B.one]: U('Beta one.', '贝塔一。') }, terms: { Pip: '皮普' } }));
    const z = T(checkLanguage(await loadWorkspace({ root: tmp }), 'zh'), 'levels/beta');
    const r = await loadContentTables('zh', { source: 'levels/beta.json', read: nodeReader(path.join(tmp, 'public/i18n')) });
    ok('the checker: an error naming it, its texts untranslated; the loader: one warning, skipped (common only, its unit and term English)',
      hasMsg(z.errors, 'zh/levels/beta: version 2: not read — tables are version 3') && z.version === 0 && keysOf(z.untranslated.units).includes(B.one)
      && r.warnings.filter((x) => x.includes('levels/beta')).length === 1 && hasMsg(r.warnings, 'version 2: not read') && isDeepStrictEqual(r.tables, ['common'])
      && loc(B.one, 'Beta one.') === 'Beta one.' && term('Pip') === 'Pip', [z.errors, z.version, r.warnings, r.tables]);
    clearContentTables();
    w(zb, zbBefore);
  }

  // ===============================================================================================
  begin('refusals: sources with errors, a misfiled table, --force by kind (M2, S2, S1)');
  {
    const betaFile = 'public/i18n/ja/levels/beta.json';
    tbl('ja', 'levels/beta', { units: { [B.one]: U('Beta one.', 'ベータ一。'), [B.gone]: U('Gone.', '消えた。') }, terms: { Pip: 'ピップ' } });
    w('public/levels/beta.json', beta([['Beta one.', B.one]], 'Beta sign.', false));
    const levelText = rd('public/levels/beta.json');
    // M2: a level file that does not parse: its table's entries all look orphaned
    w('public/levels/beta.json', '{ "format": "luminati-level", BROKEN');
    let rep = checkLanguage(await loadWorkspace({ root: tmp }), 'ja');
    const b = T(rep, 'levels/beta');
    ok('M2: the orphans of a table whose source cannot be read: "source unreadable", no --prune advice', b.orphans.units.length === 2 && b.warnings.filter((m) => m.startsWith('orphan')).every((m) => m.includes('source unreadable') && !m.includes('(node tools/i18n-worklist.mjs --prune)')), b.warnings);
    const before = rd(betaFile);
    let p = run('i18n-worklist.mjs', '--prune', '--lang=ja', '--table=levels/beta');
    ok('… --prune: refused (exit 1), nothing dropped', p.status === 1 && /a source of it or of a table reading it had errors/.test(p.stderr) && /--force=sources/.test(p.stderr) && rd(betaFile) === before, p.stdout + p.stderr);
    fs.writeFileSync(path.join(tmp, 'm2.json'), JSON.stringify({ format: 'luminati-i18n-worklist', version: WORKLIST_VERSION, lang: 'ja', table: 'levels/beta', units: [{ key: B.one, source: 'Beta one.', target: 'ベータ1。' }], terms: [] }));
    p = run('i18n-worklist.mjs', `--merge=${path.join(tmp, 'm2.json')}`);
    ok('… a merge into it: refused too', p.status === 1 && /had errors/.test(p.stderr) && rd(betaFile) === before, p.stdout + p.stderr);
    p = run('i18n-worklist.mjs', '--prune', '--lang=ja', '--table=levels/beta', '--force=sources', '--dry-run');
    ok('… --force=sources overrides it', p.status === 0 && /3 entries would change/.test(p.stdout), p.stdout + p.stderr);
    w('public/levels/beta.json', levelText);
    // … src/game/levels.js that does not import: common's sources (the shipped levels' names) cannot be told
    tbl('ja', 'common', { units: { 'dlg.test.welcome': U('Welcome, child.', 'ようこそ、子よ。') }, terms: { 'Alpha Town': 'アルファの町', Waystone: '導石', 'Ghost Name': 'ゴースト' } });
    const levelsJs = rd('src/game/levels.js');
    w('src/game/levels.js', 'export const SHIPPED_LEVELS = [ broken');
    const commonBefore = rd('public/i18n/ja/common.json');
    p = run('i18n-worklist.mjs', '--prune', '--lang=ja', '--table=common');
    ok('… src/game/levels.js failing to import: common is not pruned (exit 1)', p.status === 1 && /ja\/common\.json: a source .* had errors \(src\/game\/levels\.js/.test(p.stderr) && rd('public/i18n/ja/common.json') === commonBefore, p.stdout + p.stderr);
    w('src/game/levels.js', levelsJs);
    p = run('i18n-worklist.mjs', '--prune', '--lang=ja', '--table=common');
    ok('… fixed: pruned', p.status === 0 && !('Ghost Name' in JSON.parse(rd('public/i18n/ja/common.json')).terms), p.stdout + p.stderr);
    // S2: a table filed under the wrong language — refused like a broken one
    tbl('ja', 'levels/beta', { units: { [B.one]: U('Beta one.', 'ベータ一。') }, terms: { Pip: 'ピップ' } });
    const jaBeta = rd(betaFile);
    w(betaFile, { ...JSON.parse(jaBeta), lang: 'zh', units: { [B.one]: U('Beta one.', '贝塔一。') } });
    const zhInJa = rd(betaFile);
    fs.writeFileSync(path.join(tmp, 's2.json'), JSON.stringify({ format: 'luminati-i18n-worklist', version: WORKLIST_VERSION, lang: 'ja', table: 'levels/beta', units: [{ key: B.sign, source: 'Beta sign.', target: 'ベータの看板。' }], terms: [] }));
    p = run('i18n-worklist.mjs', `--merge=${path.join(tmp, 's2.json')}`);
    ok('S2: a merge into a table that says another language: refused (exit 1), the file left as it was', p.status === 1 && /says "lang": "zh", but it is filed under ja\//.test(p.stderr) && rd(betaFile) === zhInJa, p.stdout + p.stderr);
    p = run('i18n-worklist.mjs', `--out=${path.join(tmp, 'work-s2')}`, '--lang=ja', '--table=levels/beta');
    ok('… no worklist for it either', p.status === 1 && /no worklist written/.test(p.stderr) && !fs.existsSync(path.join(tmp, 'work-s2/ja/levels/beta.json')), p.stdout + p.stderr);
    p = run('i18n-worklist.mjs', `--merge=${path.join(tmp, 's2.json')}`, '--force=markup,fuzzy');
    ok('… --force of other kinds does not cover it', p.status === 1 && rd(betaFile) === zhInJa, p.stdout + p.stderr);
    p = run('i18n-worklist.mjs', `--merge=${path.join(tmp, 's2.json')}`, '--force=table');
    ok('… --force=table rewrites it', p.status === 0 && JSON.parse(rd(betaFile)).lang === 'ja', p.stdout + p.stderr);
    ok('rewriteRefusal: a file that names another language or table', /filed under ja/.test(rewriteRefusal({ raw: { version: 3, lang: 'zh', source: 'common' }, broken: false, warnings: [], lang: 'ja', id: 'common' })) && /filed as common/.test(rewriteRefusal({ raw: { version: 3, lang: 'ja', source: 'levels/x' }, broken: false, warnings: [], lang: 'ja', id: 'common' })));
    w(betaFile, jaBeta);
    // --force by kind: markup does not merge a fuzzy entry, fuzzy does not merge a markup error
    fs.writeFileSync(path.join(tmp, 'kinds.json'), JSON.stringify({ format: 'luminati-i18n-worklist', version: WORKLIST_VERSION, lang: 'ja', table: 'levels/beta', units: [{ key: B.sign, source: 'Beta sign.', target: '{ベータの看板。' }, { key: B.gone, source: 'x', target: 'y', fuzzy: true }], terms: [] }));
    p = run('i18n-worklist.mjs', `--merge=${path.join(tmp, 'kinds.json')}`, '--force=fuzzy', '--dry-run');
    ok('--force=fuzzy: the markup error still refused', p.status === 1 && /unbalanced braces .* refused \(--force=markup/.test(p.stderr), p.stdout + p.stderr);
    p = run('i18n-worklist.mjs', `--merge=${path.join(tmp, 'kinds.json')}`, '--force=markup', '--dry-run');
    ok('--force=markup: merged, and said so (C6); the fuzzy entry still skipped', p.status === 0 && /merged despite a markup error: unbalanced braces/.test(p.stdout) && /fuzzy \(a changed English to review\) — skipped/.test(p.stdout), p.stdout + p.stderr);
    eq('usage: an unknown --force kind or option, exit 2', [run('i18n-worklist.mjs', '--force=everything', '--prune').status, run('i18n-worklist.mjs', '--prnue').status, run('i18n-worklist.mjs', '--merge').status], [2, 2, 2]);
  }

  // ===============================================================================================
  begin('worklist files: BOM, PO language codes, U+2028, references and header, a common worklist (C1-C4, C7, C8)');
  {
    // C1: a table that is no JSON: no worklist, an error, the others still written
    const bf = 'public/i18n/ja/levels/beta.json';
    const good = rd(bf);
    w(bf, '{ broken');
    let p = run('i18n-worklist.mjs', `--out=${path.join(tmp, 'work-c1')}`, '--lang=ja');
    ok('C1: a table that is no JSON: an error, exit 1, no worklist for it; the other tables written', p.status === 1 && /levels\/beta\.json cannot be read — no worklist written \(ja\/levels\/beta: not a JSON object/.test(p.stderr) && !fs.existsSync(path.join(tmp, 'work-c1/ja/levels/beta.json')) && fs.existsSync(path.join(tmp, 'work-c1/ja/levels/alpha.json')), p.stdout + p.stderr);
    w(bf, good);
    // C3: a JSON worklist saved with a byte-order mark
    fs.writeFileSync(path.join(tmp, 'bom.json'), `\uFEFF${JSON.stringify({ format: 'luminati-i18n-worklist', version: WORKLIST_VERSION, lang: 'ja', table: 'levels/beta', units: [{ key: B.sign, source: 'Beta sign.', target: 'ベータの看板。' }], terms: [] })}`);
    p = run('i18n-worklist.mjs', `--merge=${path.join(tmp, 'bom.json')}`, '--dry-run');
    ok('C3: a JSON worklist with a BOM merges', p.status === 0 && /1 translation\(s\) to merge/.test(p.stdout), p.stdout + p.stderr);
    // C4, C8: a PO file a CAT tool wrote back with Language: ja_JP; references and header fields
    p = run('i18n-worklist.mjs', `--out=${path.join(tmp, 'work-c4')}`, '--lang=ja', '--table=levels/beta', '--format=po');
    let text = fs.readFileSync(path.join(tmp, 'work-c4/ja/levels/beta.po'), 'utf8');
    const po = parsePo(text);
    const sgn = po.entries.find((e) => e.msgctxt === B.sign);
    ok('C8: references <file>:<key> (no white space), the readable place in a note; the header fields msgfmt --check asks for',
      isDeepStrictEqual(sgn.references, [`levels/beta.json:${B.sign}`]) && sgn.extracted.includes('where: levels/beta.json › sign (signpost) › text[0]') && po.entries.every((e) => e.references.every((r) => !/\s/.test(r)))
      && /^\d{4}-\d\d-\d\d \d\d:\d\d\+0000$/.test(po.header['PO-Revision-Date']) && !!po.header['Last-Translator'] && po.header['Language-Team'] === 'Luminati ja', [sgn, po.header]);
    text = text.replace('Language: ja\\n', 'Language: ja_JP\\n').replace(`msgctxt "${B.sign}"\nmsgid "Beta sign."\nmsgstr ""`, `msgctxt "${B.sign}"\nmsgid "Beta sign."\nmsgstr "ベータの看板。"`);
    fs.writeFileSync(path.join(tmp, 'work-c4/ja/levels/beta.po'), text);
    p = run('i18n-worklist.mjs', `--merge=${path.join(tmp, 'work-c4/ja/levels/beta.po')}`, '--dry-run');
    ok('C4: Language: ja_JP is ja', p.status === 0 && /1 translation\(s\) to merge/.test(p.stdout), p.stdout + p.stderr);
    fs.writeFileSync(path.join(tmp, 'fr.po'), text.replace('Language: ja_JP\\n', 'Language: fr_FR\\n'));
    p = run('i18n-worklist.mjs', `--merge=${path.join(tmp, 'fr.po')}`);
    ok('… a language the index lacks: the message names the index\'s languages', p.status === 1 && /does not list levels\/beta for fr \(its languages: ja, zh;/.test(p.stderr), p.stderr);
    // C2: U+2028 and U+2029 inside a PO string
    const odd = `a\u2028b\u2029c`;
    const rt = parsePo(serializePo({ fields: { Language: 'ja', 'X-Luminati-Table': 'common' }, entries: [{ msgctxt: 'k.x', msgid: odd, msgstr: odd }, { msgctxt: 'k.y', msgid: 'after', msgstr: '' }] }));
    eq('C2: U+2028 / U+2029 in a PO string: kept, the entry not dropped', [rt.entries.map((e) => [e.msgctxt, e.msgid, e.msgstr]), rt.errors], [[['k.x', odd, odd], ['k.y', 'after', '']], []]);
    // C7: a worklist for common merges the code's units and the common terms only
    tbl('ja', 'common', { units: {}, terms: {} });
    fs.writeFileSync(path.join(tmp, 'common.json'), JSON.stringify({ format: 'luminati-i18n-worklist', version: WORKLIST_VERSION, lang: 'ja', table: 'common', units: [{ key: B.one, source: 'Beta one.', target: 'ベータ一。' }, { key: 'dlg.test.welcome', source: 'Welcome, child.', target: 'ようこそ。' }], terms: [{ name: 'Pip', target: 'ピップ' }, { name: 'Villager', target: '村人' }] }));
    p = run('i18n-worklist.mjs', `--merge=${path.join(tmp, 'common.json')}`);
    const c = JSON.parse(rd('public/i18n/ja/common.json'));
    eq('C7: a common worklist: a level\'s unit and name skipped (they live in the level\'s table), the code unit and the common term merged', [p.status, Object.keys(c.units), Object.keys(c.terms)], [0, ['dlg.test.welcome'], ['Villager']]);
    ok('… said where they live', new RegExp(`${B.one}: its English lives in levels/beta, not in common`).test(p.stdout) && /term "Pip": the name lives in levels\/(alpha|beta), not in common/.test(p.stdout), p.stdout);
  }

  // ===============================================================================================
  begin('the checker\'s options: --complete, usage errors, one error per code key (S5, C5, C9)');
  {
    let p = run('check-i18n.mjs', '--lang=ja', '--quiet', '--complete');
    ok('S5: --complete: something untranslated fails the run, the summary counts it', p.status === 1 && /untranslated \(--complete: not complete\)/.test(p.stdout), p.stdout);
    p = run('check-i18n.mjs', '--lang=ja', '--json');
    let js = null;
    try { js = JSON.parse(p.stdout); } catch { /* below */ }
    ok('… --json: summary.untranslated', js && js.summary.untranslated > 0, js?.summary);
    eq('C5: an unknown option or table, a --table without a value: exit 2', [run('check-i18n.mjs', '--stirct').status, run('check-i18n.mjs', '--table=levels/bata').status, run('check-i18n.mjs', '--table').status], [2, 2, 2]);
    p = run('check-i18n.mjs', '--table=levels/beta', '--quiet');
    ok('… the header counts the tables reported', /· 1 table\(s\) ·/.test(p.stdout), p.stdout.split('\n')[0]);
    w('src/game/twice.js', "import { loc } from '../engine/i18n/ContentText.js';\nexport const a = loc('dlg.test.twice', 'One.');\nexport const b = loc('dlg.test.twice', 'Two.');\n");
    const s = await tableSources('common', tmp);
    eq('C9: one code key with two Englishes in one file: one error', s.errors.filter((e) => e.includes('dlg.test.twice')).length, 1);
    fs.rmSync(path.join(tmp, 'src/game/twice.js'));
    const dlg = rd('src/game/dialogue.js');
    w('src/game/dialogue.js', dlg.replace("'Welcome, child.'", "'Greetings, young one.'"));
    const cr = T(checkLanguage(await loadWorkspace({ root: tmp }), 'ja'), 'common');
    eq('a code key whose English was rewritten whole: changed, with the old translation — the same key, another source', cr.changed.map((c) => [c.key, c.was, c.now, c.target]), [['dlg.test.welcome', 'Welcome, child.', 'Greetings, young one.', 'ようこそ。']]);
    w('src/game/dialogue.js', dlg);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// =================================================================================================
begin('the real data');
{
  // the shipped tables: no errors, no warnings; every
  // unit the extractor lists holds a text key in the data; every unit and term comes back translated
  // through the real loader, with no miss, in ja and zh
  const ws = await loadWorkspace();
  const ui = await uiGlossary();
  eq('the index lists every shipped table for ja and zh', ['ja', 'zh'].map((l) => [...(ws.index.languages.get(l) ?? [])].sort()), ['ja', 'zh'].map(() => ['campaigns/emberfall-interiors', 'campaigns/ferrymans-lantern', 'common', 'levels/brightwater-crossing', 'levels/cinderwatch-pass', 'levels/emberfall', 'levels/gildhaven', 'levels/sample-hamlet', 'levels/starfall-vale']));
  ok('emberfall-interiors extends levels/emberfall', ws.closure.get('campaigns/emberfall-interiors')?.includes('levels/emberfall'), ws.closure.get('campaigns/emberfall-interiors'));
  ok('the source errors: none (no key with two Englishes in a table\'s own sources)', [...ws.sources.values()].every((s) => s.errors.length === 0), [...ws.sources].map(([id, s]) => [id, s.errors]));
  ok('the source warnings (quest texts saved filled in): none', sourceWarnings(ws.sources).length === 0, sourceWarnings(ws.sources));
  /** @type {string[]} */
  const unkeyed = [];
  let keyed = 0;
  for (const [id, s] of ws.sources) {
    for (const e of s.strings) {
      if (e.term) continue;
      keyed++;
      const good = id === 'common' ? isCodeKey(e.key) : isTextKey(e.key) && !isCodeKey(e.key);
      if (!good) unkeyed.push(`${id}: ${e.where} "${e.text}" (${e.key || 'no key'})`);
    }
  }
  ok(`every unit the extractor lists holds its text key in the data: a GUID (a banner subtitle <GUID>.2), a code key in common (${keyed} units)`, unkeyed.length === 0 && keyed > 900 && keylessUnits(ws.sources).length === 0, unkeyed.slice(0, 5));
  for (const lang of ['ja', 'zh']) {
    const rep = checkLanguage(ws, lang, { ui: ui.names });
    const n = (f) => rep.tables.reduce((s, t) => s + f(t), 0);
    eq(`${lang}: 0 errors, 0 warnings, nothing untranslated, changed or orphaned`, {
      errors: n((t) => t.errors.length), warnings: n((t) => t.warnings.length), untranslated: n((t) => t.untranslated.units.length + t.untranslated.terms.length),
      changed: n((t) => t.changed.length), orphans: n((t) => t.orphans.units.length + t.orphans.terms.length), versions: [...new Set(rep.tables.map((t) => t.version))],
      terms: rep.terms.length, glossary: rep.glossary.length,
    }, { errors: 0, warnings: 0, untranslated: 0, changed: 0, orphans: 0, versions: [3], terms: 0, glossary: 0 });
    const read = nodeReader();
    let units = 0;
    let names = 0;
    /** @type {string[]} */
    const same = [];
    /** @type {string[]} */
    const misses = [];
    for (const id of [...ws.index.languages.get(lang)]) {
      const o = id === 'common' ? {} : id.startsWith('campaigns/') ? { campaign: id.slice('campaigns/'.length) } : { source: `${id}.json` };
      const r = await loadContentTables(lang, { ...o, read });
      if (r.warnings.length) misses.push(`${id}: loader ${r.warnings.join('; ')}`);
      const s = ws.sources.get(id);
      const shown = id === 'common' ? s.strings : [...s.strings, ...ws.sources.get('common').strings];
      for (const e of shown) {
        const v = e.term ? term(e.text) : loc(e.key, e.text, e.kind);
        if (e.term) names++; else units++;
        if (v === e.text && !e.term) same.push(`${id} ${e.key}`);
      }
      for (const m of contentMisses()) misses.push(`${id} ${m.key ?? m.name}: ${m.why}`);
    }
    clearContentTables();
    ok(`${lang}: every unit (by its GUID) and term the extractor lists resolves through loc / term with no miss (${units} unit and ${names} term reads)`, misses.length === 0 && units > 1500 && names > 300, misses.slice(0, 5));
    ok(`${lang}: … and no unit comes back as its English`, same.length === 0, same.slice(0, 5));
  }
  const src = await tableSources('levels/cinderwatch-pass');
  ok('Cinderwatch Pass (combat): no drillmaster pages (Captain Maren\'s own lines play), no shopkeeper item', !src.strings.some((e) => /› maren \(npc\) › dialogue|› (bram|odo) \(npc\) › item/.test(e.where)) && src.strings.some((e) => /› odo \(npc\) › dialogue/.test(e.where)), src.strings.filter((e) => /maren|bram|odo/.test(e.where)).map((e) => e.where));
  const english = src.strings.filter((e) => (e.term ? term(e.text) : loc(e.key, e.text)) !== e.text);
  ok('no table installed: every one comes back as its English', english.length === 0 && contentInfo().lang === 'en', english.slice(0, 3));
  ok('the code\'s units: every loc() call of dialogue.js is in common', ws.sources.get('common').strings.some((e) => e.key?.startsWith('dlg.') && e.where.startsWith('src/game/dialogue.js')));
  ok('every table file is listed in the index', ['ja', 'zh'].every((l) => tableFilesOf(l).every((id) => ws.index.languages.get(l)?.has(id))), ['ja', 'zh'].map((l) => tableFilesOf(l)));
  // the CLI: no errors, no warnings
  const p = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'check-i18n.mjs'), '--json'], { encoding: 'utf8' });
  let js = null;
  try { js = JSON.parse(p.stdout); } catch { /* reported below */ }
  ok('npm run i18n:check: 0 errors, 0 warnings; no text without a key', js && p.status === 0 && js.summary.errors === 0 && js.summary.warnings === 0 && isDeepStrictEqual(js.noKey, {}), js?.summary ?? p.stderr);
  const full = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'check-i18n.mjs'), '--strict', '--complete', '--quiet'], { encoding: 'utf8' });
  ok('npm run i18n:check -- --strict --complete: the shipped languages are complete (exit 0, nothing untranslated)', full.status === 0 && js?.summary.untranslated === 0, full.stdout.split('\n').slice(-2).join(' '));
}

// =================================================================================================
const ms = Math.round(performance.now() - t0);
if (verbose) for (const [name, n] of sections) console.log(`  ${name}: ${n}`);
for (const f of failures) console.log(`  ✗ ${f}`);
console.log(`i18n self-test: ${passed} passed, ${failures.length} failed (${sections.length} sections, ${ms} ms)`);
process.exit(failures.length ? 1 : 0);
