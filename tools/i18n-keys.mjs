#!/usr/bin/env node
/**
 * i18n-keys.mjs — the content-text keys of level, campaign and story files (docs/specs/I18N.md §4.2,
 * §4.10): every translatable text carries a GUID in the data, made when the text is made and kept
 * through every edit. This tool checks them, gives the texts without one a key and splits a key two
 * copies of a text hold with two different Englishes.
 *
 * One key, one English holds within one table's sources (§4.1): a shipped level's file
 * (`levels/<name>`), or a campaign's files — campaign.json, every level file (chapter variants too)
 * and its story files (`campaigns/<name>`). A campaign's copy of a shipped level may hold the
 * shipped key with other English: its own table translates it (`extends`); that is no conflict.
 *
 * Usage:
 *   npm run i18n:keys -- [<file|campaign> …] [--shipped] [--check | --assign | --fix] [--force] [--quiet]
 *     <file|campaign>  a level file (`public/levels/x.json`, any path), a campaign folder (or its
 *                 campaign.json), or a name: public/levels/<name>.json, else public/campaigns/<name>
 *     --shipped   the tracked shipped tree: every level of public/levels and every campaign of
 *                 public/campaigns that the repository tracks (a user's untracked file is never read
 *                 or written by it). Nothing named and no --shipped: --check reads the shipped tree.
 *     --check     (the default) list each file's problems — a text with no key (`missing`: it stays
 *                 English in every language), a key or `#line:` tag on no text (`stray`), one key on
 *                 two texts of a file (`repeated`) — and every key one table's sources hold with two
 *                 different Englishes (a copy of a line edited apart). Writes nothing.
 *     --assign    give every text without a key its key — seeded by the file and the text, so a run
 *                 is reproducible — and drop stray keys; a key repeated with the same English stays on
 *                 its first text and the others get new ones; a chapter variant's keyless text shares
 *                 its base's key where the English there is the same, and a campaign's copy of a
 *                 shipped level (the same file name) shares the shipped level's key where the English
 *                 is the same. It never replaces a text's own valid key: while any key has two
 *                 Englishes in one table's sources (a copy edited apart, a key repeated on two
 *                 different texts, keys swapped by hand), it writes none of that table's files and
 *                 says to run --fix first (which reads the tables). Writes the files that changed.
 *     --fix       resolve each key with two Englishes in one table's sources. First it realigns:
 *                 when a copy's English is what the tables record under another key held by a text of
 *                 the same field of the same file (that text itself not reading so), the two keys are
 *                 swapped back — keys shifted or swapped by a hand edit keep both translations; a
 *                 keyless text of that field reading what the tables record under the copy's key takes
 *                 it (the copy is split off). Then it splits what is left. Which copies keep the key:
 *                 those in the files that rank highest — a generated file, then a tracked (shipped)
 *                 one, then a user's —; among those, the copies with the English the tables translate,
 *                 else the base level's (not a chapter variant's), else those of the first file in
 *                 POSIX path order. Every other copy gets a new key (copies with the same English share
 *                 one), and every language's table unit of that English moves to the new key with it.
 *                 Writes the files that changed (and those tables).
 *     --force     write a file whose unchanged round trip (parse → serialise) is not byte-identical
 *                 (a hand-edited file: it is written in the format's own layout)
 *     --quiet     print only the problems and the summary
 *     --root=<dir>  the tree to work on (default: this repository; the self-test uses a temp tree)
 *
 * What it writes: only the files named on the command line, or with --shipped the tracked shipped
 * tree, and the tables (public/i18n/<lang>/…) of a key it re-keys; each file keeps its own line
 * ending (a CRLF file is written CRLF). Generated files change only
 * through their generators (CLAUDE.md): --assign and --fix refuse them and name the generator to run
 * (public/levels/starfall-vale, sample-hamlet, cinderwatch-pass, gildhaven and the campaigns
 * ferrymans-lantern and emberfall-interiors). New keys are seeded by the file's repository-relative
 * POSIX path (a file outside the tree: by its file name), so every machine makes the same.
 *
 * Exit code: 0 when nothing is left to report (or everything was written); 1 when a problem remains
 * or a write was refused; 2 on a usage error or a file that cannot be read.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseLevel, serializeLevel } from '../src/engine/level/LevelFormat.js';
import { normalizeCampaign, serializeCampaign, levelFile, levelVariants } from '../src/game/campaign/CampaignFormat.js';
import { serializeStory, storyFile } from '../src/game/campaign/StoryFormat.js';
import {
  assignTextKeys, carryCampaignText, carryStoryFile, retagStoryText, seededMint, textKeyIssues, fileKeyIssues,
  levelTexts, campaignTexts, storyFileTexts, storyTextTexts,
} from '../src/engine/i18n/TextKeys.js';
import { keyCompare } from './lib/i18n.mjs';

/** @import { KeyedText } from '../src/engine/i18n/TextKeys.js' */

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The generated files (relative to the root) and the generator that writes each. */
export const GENERATED = Object.freeze({
  'public/levels/starfall-vale.json': 'node tools/make-starfall-vale.mjs',
  'public/levels/sample-hamlet.json': 'node tools/make-sample-hamlet.mjs',
  'public/levels/cinderwatch-pass.json': 'node tools/make-cinderwatch-pass.mjs',
  'public/levels/gildhaven.json': 'node tools/make-gildhaven.mjs',
  'public/campaigns/ferrymans-lantern': 'node tools/make-ferrymans-lantern.mjs',
  'public/campaigns/emberfall-interiors': 'node tools/make-emberfall-interiors.mjs',
});

/**
 * One file the tool reads.
 * @typedef {object} KeyFile
 * @property {string} abs        its path
 * @property {string} rel        its path relative to the root, forward slashes (the absolute path
 *   when it lies outside)
 * @property {string} seed       what new keys are seeded by: `rel` inside the root, else the file name
 * @property {'level'|'campaign'|'story'|'storyText'} kind
 * @property {string} text       the file as read (CRLF as LF)
 * @property {'\n'|'\r\n'} eol    its line ending (CRLF when the file as read has one): kept on write
 * @property {any} data         the level (normalized), the campaign's or story file's JSON, or the lines of a .story file
 * @property {string} table      the table whose sources it is: `campaigns/<name>`, `levels/<name>` (a
 *   level of public/levels), else its own path (no table)
 * @property {string} [campaign] the campaign folder it belongs to (relative)
 * @property {string} [base]     a chapter variant's base level id
 * @property {string} [id]       a campaign level file's id
 * @property {boolean} writable  named, or tracked and shipped (never a generated file)
 * @property {boolean} tracked   the repository tracks it (a shipped file)
 * @property {string} generator  the generator that writes it ('' for none)
 * @property {boolean} changed   written by --assign / --fix
 */

/**
 * The generator of a file (relative path), or ''.
 * @param {string} rel
 */
function generatorOf(rel) {
  for (const [p, g] of Object.entries(GENERATED)) if (rel === p || rel.startsWith(`${p}/`)) return g;
  return '';
}

/** A path relative to `root` with forward slashes (the absolute path when it lies outside). */
const relTo = (root, abs) => {
  const r = path.relative(root, abs);
  return r.startsWith('..') || path.isAbsolute(r) ? abs.split(path.sep).join('/') : r.split(path.sep).join('/');
};

/** Is `rel` (from `relTo`) inside the root? */
const inside = (root, abs) => { const r = path.relative(root, abs); return !!r && !r.startsWith('..') && !path.isAbsolute(r); };

/**
 * The table a file's texts belong to (I18N.md §4.1): a campaign's files `campaigns/<name>`, a level
 * of public/levels `levels/<name>`; any other file its own path (no table).
 * @param {string} rel @param {string} [campaign]
 */
function tableOf(rel, campaign) {
  if (campaign) return `campaigns/${campaign.split('/').pop()}`;
  const m = /^public\/levels\/([^/]+)\.json$/.exec(rel);
  return m ? `levels/${m[1]}` : rel;
}

/**
 * The tracked files of public/levels and public/campaigns (`git ls-files`), relative; null when git
 * cannot list them.
 * @param {string} root
 * @returns {Set<string>|null}
 */
function trackedFiles(root) {
  const r = spawnSync('git', ['ls-files', '-z', '--', 'public/levels', 'public/campaigns'], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) return null;
  return new Set(r.stdout.split('\0').filter(Boolean));
}

/**
 * The tracked level files and campaign folders of the shipped tree.
 * @param {string} root
 * @param {Set<string>|null} tracked
 * @returns {{ levels: string[], campaigns: string[] }|null} absolute paths; null when git cannot list them
 */
function shippedTree(root, tracked) {
  if (!tracked) return null;
  const files = [...tracked];
  const levels = files.filter((f) => /^public\/levels\/[^/]+\.json$/.test(f)).sort().map((f) => path.join(root, f));
  const campaigns = files.filter((f) => /^public\/campaigns\/[^/]+\/campaign\.json$/.test(f)).sort().map((f) => path.join(root, path.dirname(f)));
  return { levels, campaigns };
}

/**
 * What a command-line name is: a level file or a campaign folder.
 * @param {string} root
 * @param {string} name
 * @returns {{ kind: 'level'|'campaign', abs: string }|null}
 */
function resolveName(root, name) {
  // (a path: from the current folder, else from the root)
  let p = path.resolve(process.cwd(), name);
  if (!fs.existsSync(p) && !path.isAbsolute(name)) p = path.resolve(root, name);
  if (fs.existsSync(p)) {
    if (fs.statSync(p).isDirectory()) return fs.existsSync(path.join(p, 'campaign.json')) ? { kind: 'campaign', abs: p } : null;
    if (path.basename(p) === 'campaign.json') return { kind: 'campaign', abs: path.dirname(p) };
    return { kind: 'level', abs: p };
  }
  if (/[\\/]/.test(name) || name.endsWith('.json')) return null;
  const level = path.join(root, 'public', 'levels', `${name}.json`);
  if (fs.existsSync(level)) return { kind: 'level', abs: level };
  const camp = path.join(root, 'public', 'campaigns', name);
  if (fs.existsSync(path.join(camp, 'campaign.json'))) return { kind: 'campaign', abs: camp };
  return null;
}

/** A file's text without a BOM, CRLF as LF; `eol` its line ending. @param {string} abs @returns {{ text: string, eol: '\n'|'\r\n' }} */
const readFile = (abs) => {
  const raw = fs.readFileSync(abs, 'utf8').replace(/^﻿/, '');
  return { text: raw.replace(/\r\n/g, '\n'), eol: raw.includes('\r\n') ? '\r\n' : '\n' };
};
const readText = (abs) => readFile(abs).text;

/**
 * A file's common fields.
 * @param {string} root @param {string} abs @param {Set<string>|null} tracked @param {string} [campaign]
 */
function fileBase(root, abs, tracked, campaign) {
  const rel = relTo(root, abs);
  return { abs, rel, seed: inside(root, abs) ? rel : path.basename(abs), table: tableOf(rel, campaign), tracked: !!tracked?.has(rel), generator: generatorOf(rel) };
}

/**
 * Read a level file.
 * @param {string} root @param {string} abs @param {boolean} writable @param {Set<string>|null} tracked
 * @param {Partial<KeyFile>} [extra]
 * @returns {KeyFile}
 */
function readLevelFile(root, abs, writable, tracked, extra = {}) {
  const { text, eol } = readFile(abs);
  const { level } = parseLevel(text);
  const b = fileBase(root, abs, tracked, extra.campaign);
  return { ...b, kind: 'level', text, eol, data: level, writable: writable && !b.generator, changed: false, ...extra };
}

/**
 * Read a campaign: campaign.json, every level file (bases then their chapter variants) and its story
 * files, in that order.
 * @param {string} root @param {string} dir @param {boolean} writable @param {Set<string>|null} tracked
 * @returns {KeyFile[]}
 */
function readCampaign(root, dir, writable, tracked) {
  const crel = relTo(root, dir);
  const { text: ctext, eol: ceol } = readFile(path.join(dir, 'campaign.json'));
  const raw = JSON.parse(ctext);
  const { campaign } = normalizeCampaign(raw);
  const cb = fileBase(root, path.join(dir, 'campaign.json'), tracked, crel);
  /** @type {KeyFile[]} */
  const out = [{ ...cb, kind: 'campaign', text: ctext, eol: ceol, data: raw, campaign: crel, writable: writable && !cb.generator, changed: false }];
  for (const l of campaign.levels) {
    for (const id of levelVariants(campaign, l.id)) {
      const abs = path.join(dir, levelFile(id));
      if (!fs.existsSync(abs) || out.some((f) => f.abs === abs)) continue;
      out.push(readLevelFile(root, abs, writable, tracked, { campaign: crel, id, ...(id !== l.id ? { base: l.id } : {}) }));
    }
  }
  for (const name of campaign.story) {
    const abs = path.join(dir, storyFile(name));
    if (!fs.existsSync(abs)) continue;
    const { text, eol } = readFile(abs);
    const kind = name.endsWith('.story') ? 'storyText' : 'story';
    const b = fileBase(root, abs, tracked, crel);
    out.push({ ...b, kind, text, eol, data: kind === 'story' ? JSON.parse(text) : text.split('\n'), campaign: crel, writable: writable && !b.generator, changed: false });
  }
  return out;
}

/** The keyed texts of a file. @param {KeyFile} f @returns {KeyedText[]} */
function textsOf(f) {
  if (f.kind === 'level') return levelTexts(f.data);
  if (f.kind === 'campaign') return campaignTexts(f.data);
  if (f.kind === 'story') return storyFileTexts(f.data);
  return storyTextTexts(f.data);
}

/** The key problems of a file (`textKeyIssues` / `fileKeyIssues`). @param {KeyFile} f */
function issuesOf(f) {
  if (f.kind === 'level') return textKeyIssues(f.data);
  return fileKeyIssues(f.kind, f.kind === 'storyText' ? f.data.join('\n') : f.data);
}

/**
 * The file's text as it would be written now, and whether its unchanged round trip is byte for
 * byte (`stable`: else writing it would change more than its keys).
 * @param {KeyFile} f
 * @returns {{ text: string, stable: boolean }}
 */
function serialized(f) {
  if (f.kind === 'level') {
    return { text: serializeLevel(f.data), stable: serializeLevel(parseLevel(f.text).level) === f.text };
  }
  if (f.kind === 'campaign') {
    const again = (raw) => serializeCampaign(normalizeCampaign(raw).campaign);
    if (again(JSON.parse(f.text)) === f.text) return { text: again(f.data), stable: true };
    return { text: `${JSON.stringify(f.data, null, 2)}\n`, stable: `${JSON.stringify(JSON.parse(f.text), null, 2)}\n` === f.text };
  }
  if (f.kind === 'story') {
    if (serializeStory(JSON.parse(f.text)) === f.text) return { text: serializeStory(f.data), stable: true };
    return { text: `${JSON.stringify(f.data, null, 2)}\n`, stable: `${JSON.stringify(JSON.parse(f.text), null, 2)}\n` === f.text };
  }
  return { text: f.data.join('\n'), stable: true };
}

/**
 * --assign on one file: every keyless text gets a key (`seededMint(seed)`), strays dropped, a key
 * repeated with the same English kept by its first text only; a chapter variant's keyless text shares
 * its base's key (`base`) where the English is the same; a campaign's copy of a shipped level shares
 * that level's (`extended`). Run only on a table with no key of two Englishes (`main` refuses one
 * first), so every text keeps its own valid key (`split` then stays empty).
 * @param {KeyFile} f
 * @param {{ base?: any, extended?: any }} [o]
 * @returns {{ key: string, was: string, text: string, where: string }[]} the keys split off a base's
 */
function assignFile(f, { base = null, extended = null } = {}) {
  const mint = seededMint(f.seed);
  const before = JSON.stringify(f.data);
  /** @type {{ key: string, was: string, text: string, where: string }[]} */
  let split = [];
  if (f.kind === 'level') split = assignTextKeys(f.data, { previous: structuredClone(f.data), base, extended, mint }).split;
  else if (f.kind === 'campaign') carryCampaignText(structuredClone(f.data), f.data, mint);
  else if (f.kind === 'story') carryStoryFile(structuredClone(f.data), f.data, mint);
  else {
    const t = f.data.join('\n');
    f.data = retagStoryText(t, t, mint).split('\n');
  }
  if (JSON.stringify(f.data) !== before) f.changed = true;
  return split;
}

/**
 * Every key that one table's sources hold with two or more different Englishes (I18N.md §4.1: a
 * campaign's files, or one shipped level's file — divergence along `extends` is no conflict).
 * @param {KeyFile[]} files
 * @returns {Map<string, { f: KeyFile, t: KeyedText }[]>} by `<table> <key>`
 */
function conflicts(files) {
  /** @type {Map<string, { f: KeyFile, t: KeyedText }[]>} */
  const byKey = new Map();
  for (const f of files) {
    for (const t of textsOf(f)) {
      if (!t.key) continue;
      const k = `${f.table} ${t.key}`;
      let l = byKey.get(k);
      if (!l) byKey.set(k, (l = []));
      l.push({ f, t });
    }
  }
  for (const [k, l] of byKey) if (new Set(l.map((e) => e.t.text)).size < 2) byKey.delete(k);
  return byKey;
}

/**
 * One content table of the tree (public/i18n/<lang>/<id>.json) as read: `changed` when a unit was
 * re-keyed (then written).
 * @typedef {{ lang: string, id: string, file: string, raw: any, changed: boolean }} TableFile
 */

/**
 * The content tables of the tree, every language.
 * @param {string} root
 * @returns {TableFile[]}
 */
function readTables(root) {
  /** @type {TableFile[]} */
  const out = [];
  const dir = path.join(root, 'public', 'i18n');
  if (!fs.existsSync(dir)) return out;
  for (const lang of fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!e.name.endsWith('.json')) continue;
        let raw;
        try { raw = JSON.parse(readText(p)); } catch { continue; }
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        out.push({ lang, id: path.relative(path.join(dir, lang), p).split(path.sep).join('/').replace(/\.json$/, ''), file: p, raw, changed: false });
      }
    };
    walk(path.join(dir, lang));
  }
  return out;
}

/** The units of a table's JSON (an object), or {}. @param {any} raw */
const unitsOf = (raw) => (raw && typeof raw.units === 'object' && !Array.isArray(raw.units) && raw.units ? raw.units : {});

/** A table's extended tables (its `extends`, then theirs). @param {string} id @param {Map<string, string[]>} ext */
function chainOf(id, ext) {
  const out = [id];
  for (let k = 0; k < out.length; k++) for (const e of ext.get(out[k]) ?? []) if (!out.includes(e)) out.push(e);
  return out;
}

/**
 * The English a table's chain translates under `key` (the table itself, then the tables it extends;
 * any language, the first met), or undefined.
 * @param {ReturnType<typeof readTables>} tables @param {string} table the table id @param {string} key
 */
function translatedEnglish(tables, table, key) {
  const ext = new Map();
  for (const t of tables) if (!ext.has(t.id)) ext.set(t.id, Array.isArray(t.raw.extends) ? t.raw.extends.filter((x) => typeof x === 'string') : []);
  for (const id of chainOf(table, ext)) {
    for (const t of tables) {
      if (t.id !== id) continue;
      const u = unitsOf(t.raw)[key];
      if (Object.prototype.hasOwnProperty.call(unitsOf(t.raw), key) && typeof u?.source === 'string') return u.source.trim();
    }
  }
  return undefined;
}

/**
 * Move the units of `from` to `to` in every language's copy of `table` where the unit's English is
 * `text` (the copies with that English took the new key): a unit of the table itself is renamed;
 * one only a table it extends holds is copied into it (the extended table's sources keep the old
 * key). Tables are written with their units sorted (`keyCompare`).
 * @param {ReturnType<typeof readTables>} tables changed in place
 * @param {string} table the table id @param {string} from @param {string} to @param {string} text
 * @returns {number} the units moved or copied
 */
function rekeyUnits(tables, table, from, to, text) {
  let n = 0;
  const ext = new Map();
  for (const t of tables) if (!ext.has(t.id)) ext.set(t.id, Array.isArray(t.raw.extends) ? t.raw.extends.filter((x) => typeof x === 'string') : []);
  const has = (u, k) => Object.prototype.hasOwnProperty.call(u, k);
  for (const own of tables.filter((t) => t.id === table)) {
    const units = unitsOf(own.raw);
    if (has(units, from) && typeof units[from]?.source === 'string' && units[from].source.trim() === text) {
      if (!has(units, to)) units[to] = units[from];
      delete units[from];
      own.changed = true;
      n++;
      continue;
    }
    if (has(units, from) || has(units, to)) continue;
    for (const id of chainOf(table, ext).slice(1)) {
      const up = tables.find((t) => t.lang === own.lang && t.id === id);
      const u = up && unitsOf(up.raw)[from];
      if (up && has(unitsOf(up.raw), from) && typeof u?.source === 'string' && u.source.trim() === text) {
        units[to] = structuredClone(u);
        own.changed = true;
        n++;
        break;
      }
    }
  }
  return n;
}

/** A table's text with its units sorted as the tools write them (two-space indent, LF). @param {any} raw */
function tableText(raw) {
  const units = unitsOf(raw);
  const sorted = Object.create(null);
  for (const k of Object.keys(units).sort(keyCompare)) sorted[k] = units[k];
  return `${JSON.stringify({ ...raw, units: sorted }, null, 2)}\n`;
}

/** How a file ranks for keeping a key (--fix): a generated file, then a tracked one, then a user's. @param {KeyFile} f */
const rank = (f) => (f.generator ? 2 : f.tracked ? 1 : 0);

/** A text cut for a message. @param {string} s */
const clip = (s) => { const t = s.replace(/\n/g, ' | '); return t.length > 60 ? `${t.slice(0, 57)}…` : t; };

/**
 * Run the tool.
 * @param {string[]} argv
 * @param {{ log?: (s: string) => void, err?: (s: string) => void }} [io]
 * @returns {number} the exit code
 */
export function main(argv, io = {}) {
  const log = io.log ?? ((s) => console.log(s));
  const err = io.err ?? ((s) => console.error(s));
  const opts = argv.filter((a) => a.startsWith('--'));
  const names = argv.filter((a) => !a.startsWith('--'));
  const KNOWN = new Set(['check', 'assign', 'fix', 'shipped', 'force', 'quiet', 'root', 'help']);
  /** @type {Record<string, string|true>} */
  const args = {};
  for (const o of opts) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(o);
    if (!m || !KNOWN.has(m[1])) { err(`unknown option ${o}`); return 2; }
    args[m[1]] = m[2] ?? true;
  }
  const usage = 'usage: npm run i18n:keys -- [<level file | campaign> …] [--shipped] [--check | --assign | --fix] [--force] [--quiet] [--root=<dir>]';
  if (args.help) { log(usage); return 0; }
  const mode = args.assign ? 'assign' : args.fix ? 'fix' : 'check';
  if ([args.assign, args.fix, args.check].filter(Boolean).length > 1) { err('--check, --assign and --fix are one at a time'); return 2; }
  if (args.root === true) { err('--root needs a folder: --root=<dir>'); return 2; }
  const root = path.resolve(typeof args.root === 'string' ? args.root : HERE);
  const quiet = !!args.quiet;
  if (mode !== 'check' && !names.length && !args.shipped) { err(`--${mode} writes only the files named or, with --shipped, the tracked shipped tree: name them\n${usage}`); return 2; }
  const shipped = !!args.shipped || !names.length;
  const tracked = trackedFiles(root);

  // ---- read ----
  /** @type {KeyFile[]} */
  const files = [];
  const add = (list) => { for (const f of list) if (!files.some((g) => g.abs === f.abs)) files.push(f); };
  try {
    if (shipped) {
      const tree = shippedTree(root, tracked);
      if (!tree) { err(`cannot list the tracked shipped tree (git ls-files in ${root})`); return 2; }
      for (const abs of tree.levels) add([readLevelFile(root, abs, mode !== 'check', tracked)]);
      for (const dir of tree.campaigns) add(readCampaign(root, dir, mode !== 'check', tracked));
    }
    for (const name of names) {
      const r = resolveName(root, name);
      if (!r) { err(`${name}: no level file or campaign folder of that name`); return 2; }
      // (a named file is written even when untracked; a shipped one read above becomes writable)
      for (const f of files) if (f.abs === r.abs || f.campaign && path.join(root, f.campaign) === r.abs) f.writable = !f.generator;
      add(r.kind === 'level' ? [readLevelFile(root, r.abs, true, tracked)] : readCampaign(root, r.abs, true, tracked));
    }
  } catch (e) {
    err(`cannot read: ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }
  let refused = 0;
  /** @type {Set<KeyFile>} files a write was refused for */
  const refusedFiles = new Set();
  const refuse = (f, why) => { if (!refusedFiles.has(f)) { refusedFiles.add(f); refused++; err(`${f.rel}: not written — ${why}`); } };
  /** @type {ReturnType<typeof readTables>|null} read when a key is re-keyed */
  let tables = null;
  const rekey = (table, from, to, text) => {
    tables ??= readTables(root);
    const n = rekeyUnits(tables, table, from, to, text);
    if (n && !quiet) log(`  ${n} table unit(s) of ${table} moved ${from} → ${to}`);
  };

  // ---- assign ----
  if (mode === 'assign') {
    /** @type {Map<string, any>} campaign + base id → its level, assigned */
    const bases = new Map();
    /** a campaign's copy of a shipped level (the same file name): that level, as read (or assigned) */
    const shippedLevel = (f) => {
      if (!f.campaign || f.base) return null;
      const abs = path.join(root, 'public', 'levels', path.basename(f.abs));
      const read = files.find((g) => g.abs === abs);
      if (read) return read.data;
      try { return fs.existsSync(abs) ? parseLevel(readText(abs)).level : null; } catch { return null; }
    };
    // a table whose sources hold a key with two Englishes is not assigned: which copy keeps the key
    // is --fix's call (it reads the tables) — never a text's own valid key replaced here (a key
    // repeated on two different texts, keys swapped by hand, a copy edited apart)
    /** @type {Map<string, { key: string, repeated: boolean }[]>} table → its keys with two Englishes */
    const blocked = new Map();
    for (const [, list] of conflicts(files)) {
      const t = list[0].f.table;
      const repeated = list.some((e, k) => list.some((x, m) => m !== k && x.f === e.f));
      blocked.set(t, [...(blocked.get(t) ?? []), { key: list[0].t.key, repeated }]);
    }
    for (const [t, keys] of blocked) {
      const named = keys.slice(0, 3).map((k) => `${k.key}${k.repeated ? ' (on two texts of one file)' : ''}`).join(', ');
      err(`${t}: not assigned — ${keys.length} text key(s) with two Englishes in its sources (${named}${keys.length > 3 ? ', …' : ''}): run npm run i18n:keys -- --fix first (it keeps each key on the English the tables translate, swaps shifted keys back, gives the other copies new keys), then --assign again`);
      refused++;
    }
    for (const f of files) {
      const issues = issuesOf(f);
      if (f.generator) {
        if (issues.length) refuse(f, `a generated file: run ${f.generator}`);
        continue;
      }
      if (!f.writable || blocked.has(f.table)) continue;
      const split = assignFile(f, { base: f.base ? bases.get(`${f.campaign}|${f.base}`) ?? null : null, extended: f.kind === 'level' ? shippedLevel(f) : null });
      for (const s of split) {
        if (!quiet) log(`${s.was} → ${s.key}: "${clip(s.text)}" (${f.rel} › ${s.where}): its base holds the key with other English`);
        rekey(f.table, s.was, s.key, s.text);
      }
      if (f.kind === 'level' && f.id && !f.base) bases.set(`${f.campaign}|${f.id}`, f.data);
    }
  }

  // ---- fix ----
  if (mode === 'fix') {
    tables ??= readTables(root);
    const tablesRead = tables;
    // 1. realign: a copy whose English the tables record under another key that a text of the same
    //    field of the same file holds (that text not reading so itself) takes that key, and that text
    //    takes this one — keys shifted or swapped by a hand edit get both translations back
    /** @type {Map<string, string|undefined>} `<table> <key>` → the English its chain translates */
    const recorded = new Map();
    const sourceOf = (table, key) => {
      const k = `${table} ${key}`;
      if (!recorded.has(k)) recorded.set(k, translatedEnglish(tablesRead, table, key));
      return recorded.get(k);
    };
    for (let swaps = 0; swaps < 100000;) {
      let swapped = false;
      for (const [, list] of conflicts(files)) {
        const key = list[0].t.key;
        const table = list[0].f.table;
        const tr = sourceOf(table, key);
        if (tr === undefined) continue;
        for (const e of list) {
          if (e.t.text === tr || !e.f.writable) continue;
          const texts = textsOf(e.f);
          const x = texts.find((y) => y.key && y.key !== key && y.field === e.t.field && y.text !== e.t.text && sourceOf(table, y.key) === e.t.text);
          if (x) {
            const other = x.key;
            e.t.set(other);
            x.set(key);
            if (!quiet) log(`${key} ⇄ ${other}: "${clip(e.t.text)}" (${e.f.rel} › ${e.t.where}) takes ${other}, "${clip(x.text)}" (${x.where}) takes ${key}: the keys the tables translate them under`);
          } else {
            // a keyless text of the field reads what the tables record under the key (a page
            // inserted above it shifted the keys): it takes the key — this copy is split off below
            const y = texts.some((z) => z.key === key && z.text === tr) ? null : texts.find((z) => !z.key && z.field === e.t.field && z.text === tr);
            if (!y) continue;
            y.set(key);
            if (!quiet) log(`${key} → "${clip(y.text)}" (${e.f.rel} › ${y.where}): the text the tables translate it as (it had no key); "${clip(e.t.text)}" (${e.t.where}) is split off`);
          }
          e.f.changed = true;
          swapped = true;
          swaps++;
          break;
        }
        if (swapped) break;
      }
      if (!swapped) break;
    }
    // 2. split what is left
    /** @type {Set<string>} every key in use (a new one is never one of them) */
    const used = new Set(files.flatMap((f) => textsOf(f).map((t) => t.key).filter(Boolean)));
    for (const [, list] of conflicts(files)) {
      const key = list[0].t.key;
      const table = list[0].f.table;
      // which copies keep the key: the highest-ranked files' (a generated or shipped file is never
      // re-keyed for a user's), among them the English the tables translate, else the base level's,
      // else the first file's in POSIX path order
      const top = Math.max(...list.map((e) => rank(e.f)));
      const keepers = list.filter((e) => rank(e.f) === top);
      const translated = sourceOf(table, key);
      const byPath = (a, b) => (a.f.base ? 1 : 0) - (b.f.base ? 1 : 0) || (a.f.rel < b.f.rel ? -1 : a.f.rel > b.f.rel ? 1 : 0);
      const keep = translated !== undefined && keepers.some((e) => e.t.text === translated) ? translated : [...keepers].sort(byPath)[0].t.text;
      /** @type {Map<string, { f: KeyFile, t: KeyedText }[]>} the other Englishes → their copies */
      const others = new Map();
      for (const e of list) if (e.t.text !== keep) others.set(e.t.text, [...(others.get(e.t.text) ?? []), e]);
      for (const [text, copies] of others) {
        const blocked = copies.filter((e) => !e.f.writable);
        if (blocked.length) {
          for (const e of blocked) refuse(e.f, e.f.generator ? `a generated file: run ${e.f.generator}` : 'not named (name it, or --shipped for the tracked shipped tree)');
          continue;
        }
        const mint = seededMint([...copies].sort(byPath)[0].f.seed, used);
        const k = mint(`fix|${key}|${text}`);
        for (const e of copies) { e.t.set(k); e.f.changed = true; }
        if (!quiet) log(`${key} → ${k}: "${clip(text)}" (${copies.map((e) => `${e.f.rel} › ${e.t.where}`).join(', ')}); "${clip(keep)}" keeps ${key}`);
        rekey(table, key, k, text);
      }
    }
  }

  // ---- write ----
  let written = 0;
  for (const f of files) {
    if (!f.changed) continue;
    const { text, stable } = serialized(f);
    if (!stable && !args.force) { refuse(f, 'its unchanged round trip is not byte-identical (open and save it in the editor first, or --force)'); continue; }
    if (text !== f.text) { fs.writeFileSync(f.abs, f.eol === '\r\n' ? text.replace(/\r?\n/g, '\r\n') : text); written++; if (!quiet) log(`wrote ${f.rel}`); }
  }
  for (const t of tables ?? []) {
    if (!t.changed) continue;
    fs.writeFileSync(t.file, tableText(t.raw));
    written++;
    if (!quiet) log(`wrote ${relTo(root, t.file)}`);
  }

  // ---- report ----
  let problems = 0;
  let total = 0;
  let keyed = 0;
  for (const f of files) {
    const texts = textsOf(f);
    total += texts.length;
    keyed += texts.filter((t) => t.key).length;
    const issues = issuesOf(f);
    problems += issues.length;
    if (issues.length || !quiet) {
      const counts = ['missing', 'stray', 'repeated'].map((k) => [k, issues.filter((i) => i.kind === k).length]).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`);
      log(`${f.rel}: ${texts.length} text${texts.length === 1 ? '' : 's'}, ${texts.filter((t) => t.key).length} keyed${counts.length ? ` — ${counts.join(', ')}${f.generator ? ` (generated: run ${f.generator})` : ''}` : ''}`);
    }
    for (const i of issues) log(`  ${i.severity === 'error' ? '✗' : '!'} ${i.kind}: ${i.where}: ${i.msg}`);
  }
  const two = conflicts(files);
  for (const [, list] of two) {
    /** @type {Map<string, string[]>} */
    const by = new Map();
    for (const e of list) by.set(e.t.text, [...(by.get(e.t.text) ?? []), `${e.f.rel} › ${e.t.where}`]);
    log(`✗ text key ${list[0].t.key}: one key, ${by.size} Englishes in ${list[0].f.table}'s files — ${[...by].map(([t, w]) => `"${clip(t)}" (${w.join(', ')})`).join(' and ')} (npm run i18n:keys -- --fix)`);
  }
  problems += two.size;
  log(`${files.length} file(s), ${total} texts, ${keyed} keyed · ${problems} problem(s)${two.size ? ` (${two.size} key(s) with two Englishes)` : ''}${mode !== 'check' ? ` · ${written} file(s) written` : ''}${refused ? ` · ${refused} refused` : ''}`);
  return problems || refused ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
