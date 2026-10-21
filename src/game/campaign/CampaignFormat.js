/**
 * The campaign file (docs/specs/CAMPAIGN_FORMAT.md): `public/campaigns/<name>/campaign.json`, the
 * story game that ties several levels together — which levels it has (their files are
 * `levels/<id>.json` in the same folder) and where they sit on a shared plane (`at`, for seams and
 * the campaign map), where the game starts, and the chapters that swap a level for a variant file.
 *
 * Node-safe (no DOM, no three.js): `tools/check-level.mjs --campaign` and the campaign generators
 * import it. Like a level, a campaign file is untrusted data: every name is looked up as an own
 * key, and level ids are file-safe slugs, so every path stays inside the campaign's folder.
 */
import { isOwnKey, showValue } from '../../engine/utils/own.js';
import { storyFileList } from './StoryFormat.js';
import { cleanTextKeysOf } from '../../engine/i18n/ContentKeys.js';

/** Any value for a message, never throwing (`{"toString": 1}`), at most 80 characters. @param {unknown} v */
const show = (v) => {
  const s = showValue(v);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
};

export const CAMPAIGN_FORMAT = 'luminati-campaign';
export const CAMPAIGN_VERSION = 1;

/** A level id / campaign name: the file-name rule of the level API (a–z, 0–9, '-'; ≤ 60). */
const SLUG = /^[a-z0-9][a-z0-9-]{0,59}$/;
/** Windows device names cannot be files there (LevelStorage.slugify avoids them too). */
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/;

/**
 * One level of a campaign.
 * @typedef {object} CampaignLevel
 * @property {string} id   file `levels/<id>.json`; what exits call the level
 * @property {[number, number]|null} at   where the level's corner (x 0, z 0) sits on the campaign
 *   plane, in world units — two placed levels that touch or overlap join seamlessly: an exit with
 *   no entrance arrives across the seam (null: not placed)
 */

/**
 * A stage of the story. The active chapter is the last one whose `when` holds (a chapter without
 * `when` is always reached); its `levels` swap a level for a variant file.
 * @typedef {object} CampaignChapter
 * @property {string} id
 * @property {string} title      shown in a banner when the chapter begins ('' = none)
 * @property {string} subtitle
 * @property {string} when       story condition that begins it — a flag name, or e.g.
 *   `quest:lantern = done` (docs/specs/STORY_SCRIPT.md §2; '' = from the start)
 * @property {Record<string, string>} levels   level id → variant level id (prototype-less)
 * @property {{ title?: string, subtitle?: string }} [textKeys]   the content-text keys of its title and
 *   subtitle (GUIDs, docs/specs/I18N.md §4.2; absent: none)
 */

/**
 * @typedef {object} Campaign
 * @property {'luminati-campaign'} format
 * @property {number} version
 * @property {string} name       the title screen's title and the save's label
 * @property {string} subtitle
 * @property {{ title?: string, subtitle?: string, prompt?: string, credit?: string }} title
 *   title-screen overrides (as a level's `environment.title`)
 * @property {{ level: string, entrance: string }} start   where a new game begins ('' entrance:
 *   the level's player start)
 * @property {CampaignLevel[]} levels
 * @property {CampaignChapter[]} chapters
 * @property {string[]} flags    story flags set when a new game begins
 * @property {string[]} story    the story files, in the campaign's `story/` folder (StoryFormat.js;
 *   [] = none)
 * @property {Record<string, string>} [textKeys]   the content-text keys of its own texts (`subtitle`,
 *   `title.title` …; GUIDs, docs/specs/I18N.md §4.2; absent: none)
 * @property {Record<string, any>} extra   top-level keys this engine does not know, kept as they are
 *   so a rewrite (serializeCampaign) does not drop what a newer engine wrote
 */

/** The top-level keys of a campaign file this engine reads (the rest go to `extra`). */
const KNOWN_KEYS = new Set(['format', 'version', 'name', 'subtitle', 'title', 'start', 'levels', 'chapters', 'flags', 'story', 'textKeys']);
/** Keys never copied into `extra` (they would change its prototype, not add a field). */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Is `s` a usable level id (a file-safe slug that is no Windows device name)?
 * @param {unknown} s
 * @returns {s is string}
 */
export function isLevelId(s) {
  return typeof s === 'string' && SLUG.test(s) && !RESERVED.test(s);
}

/** The level's file inside the campaign folder. @param {string} id a level id (isLevelId) */
export const levelFile = (id) => `levels/${id}.json`;

const text = (v) => (typeof v === 'string' ? v : '');
const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isXZ = (p) => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number' && Number.isFinite(v));

/**
 * Fill defaults and drop what cannot be used, with a warning for each thing dropped; `errors`
 * lists what makes the campaign unplayable (no levels, an unknown start level …).
 * @param {unknown} raw parsed JSON
 * @returns {{ campaign: Campaign, warnings: string[], errors: string[] }}
 */
export function normalizeCampaign(raw) {
  const warnings = [];
  const errors = [];
  const r = isPlain(raw) ? /** @type {Record<string, any>} */ (raw) : {};
  if (!isPlain(raw)) errors.push('the campaign file is not a JSON object');
  else if (r.format !== CAMPAIGN_FORMAT) errors.push(`"format" must be "${CAMPAIGN_FORMAT}"`);
  const version = Number.isInteger(r.version) ? r.version : CAMPAIGN_VERSION;
  if (version > CAMPAIGN_VERSION) warnings.push(`campaign version ${version} is newer than this engine (${CAMPAIGN_VERSION}): unknown fields are ignored`);

  /** @type {CampaignLevel[]} */
  const levels = [];
  const ids = new Set();
  for (const [k, e] of (Array.isArray(r.levels) ? r.levels : []).entries()) {
    const id = isPlain(e) ? e.id : e;
    if (!isLevelId(id)) { warnings.push(`levels[${k}]: "${show(id)}" is not a level id (a–z, 0–9 and -) — dropped`); continue; }
    if (ids.has(id)) { warnings.push(`levels[${k}]: "${id}" is listed twice — the second dropped`); continue; }
    ids.add(id);
    const at = isPlain(e) && e.at != null ? e.at : null;
    if (at != null && !isXZ(at)) warnings.push(`level "${id}": "at" must be [x, z] — ignored`);
    levels.push({ id, at: isXZ(at) ? [at[0], at[1]] : null });
  }
  if (!levels.length) errors.push('the campaign lists no levels');

  const s = isPlain(r.start) ? r.start : {};
  const start = { level: text(s.level), entrance: text(s.entrance) };
  if (!start.level && levels.length) start.level = levels[0].id;
  else if (start.level && !ids.has(start.level)) errors.push(`start level "${start.level}" is not one of the campaign's levels`);

  /** @type {CampaignChapter[]} */
  const chapters = [];
  const chapterIds = new Set();
  /** variant id → the base level it stands for (one base per variant file) */
  const variantOf = new Map();
  for (const [k, c] of (Array.isArray(r.chapters) ? r.chapters : []).entries()) {
    if (!isPlain(c)) { warnings.push(`chapters[${k}] is not an object — dropped`); continue; }
    const id = text(c.id) || `chapter-${k + 1}`;
    if (chapterIds.has(id)) warnings.push(`chapter id "${id}" is used twice`);
    chapterIds.add(id);
    /** @type {Record<string, string>} */
    const swap = Object.create(null);
    for (const [from, to] of Object.entries(isPlain(c.levels) ? c.levels : {})) {
      if (!ids.has(from)) { warnings.push(`chapter "${id}": "${from}" is not one of the campaign's levels — ignored`); continue; }
      if (!isLevelId(to)) { warnings.push(`chapter "${id}": variant "${show(to)}" of "${from}" is not a level id — ignored`); continue; }
      if (to !== from && ids.has(to)) { warnings.push(`chapter "${id}": "${to}" is a level of the campaign itself, not a variant of "${from}" — ignored`); continue; }
      if (variantOf.has(to) && variantOf.get(to) !== from) { warnings.push(`chapter "${id}": variant "${to}" already stands for "${variantOf.get(to)}" — not also for "${from}"`); continue; }
      variantOf.set(to, from);
      swap[from] = to;
    }
    const ck = cleanTextKeysOf('chapter', c.textKeys);
    if (ck.dropped) warnings.push(`chapter "${id}": ${ck.dropped} malformed or unknown text key(s) dropped`);
    chapters.push({ id, title: text(c.title), subtitle: text(c.subtitle), when: text(c.when).trim(), levels: swap, ...(ck.keys ? { textKeys: ck.keys } : {}) });
  }

  const flags = (Array.isArray(r.flags) ? r.flags : []).filter((f) => typeof f === 'string' && f.trim()).map((f) => f.trim());
  const t = isPlain(r.title) ? r.title : {};
  const title = {};
  for (const k of ['title', 'subtitle', 'prompt', 'credit']) if (typeof t[k] === 'string') title[k] = t[k];

  const story = storyFileList(r.story, warnings);
  const rootKeys = cleanTextKeysOf('root', r.textKeys);
  if (rootKeys.dropped) warnings.push(`textKeys: ${rootKeys.dropped} malformed or unknown text key(s) dropped`);
  /** @type {Record<string, any>} */
  const extra = {};
  // (as LevelFormat: `extra.__proto__ = v` would set extra's prototype rather than keep a field)
  for (const [k, v] of Object.entries(r)) if (!KNOWN_KEYS.has(k) && !UNSAFE_KEYS.has(k)) extra[k] = v;

  /** @type {Campaign} */
  const campaign = {
    format: CAMPAIGN_FORMAT,
    version,
    name: text(r.name).trim() || 'Untitled campaign',
    subtitle: text(r.subtitle),
    title,
    start,
    levels,
    chapters,
    flags,
    story,
    ...(rootKeys.keys ? { textKeys: rootKeys.keys } : {}),
    extra,
  };
  return { campaign, warnings, errors };
}

/**
 * Parse a campaign file's text (throws on invalid JSON).
 * @param {string} json
 */
export function parseCampaign(json) {
  return normalizeCampaign(JSON.parse(json));
}

/**
 * The file text of a campaign: the normalised fields in a fixed order, two-space indent, final
 * newline (generators write it; `--check` compares it byte for byte).
 * @param {Campaign} c
 * @returns {string}
 */
export function serializeCampaign(c) {
  const out = {
    format: CAMPAIGN_FORMAT,
    version: c.version,
    name: c.name,
    subtitle: c.subtitle,
    ...(Object.keys(c.title).length ? { title: c.title } : {}),
    start: c.start,
    levels: c.levels.map((l) => (l.at ? { id: l.id, at: l.at } : { id: l.id })),
    chapters: c.chapters.map((ch) => ({
      id: ch.id,
      ...(ch.title ? { title: ch.title } : {}),
      ...(ch.subtitle ? { subtitle: ch.subtitle } : {}),
      ...(ch.when ? { when: ch.when } : {}),
      ...(Object.keys(ch.levels).length ? { levels: { ...ch.levels } } : {}),
      ...(ch.textKeys ? { textKeys: ch.textKeys } : {}),
    })),
    ...(c.flags.length ? { flags: c.flags } : {}),
    ...(c.story?.length ? { story: c.story } : {}),
    ...(c.textKeys ? { textKeys: c.textKeys } : {}),
    ...(c.extra ?? {}),
  };
  // (an `at` pair on one line)
  return `${JSON.stringify(out, null, 2).replace(/\[\n\s+(-?[\d.e+-]+),\n\s+(-?[\d.e+-]+)\n\s+\]/g, '[$1, $2]')}\n`;
}

/**
 * The campaign's entry for level `id` (a base level; variants are not listed), or null.
 * @param {Campaign} c
 * @param {string} id
 * @returns {CampaignLevel|null}
 */
export function campaignLevel(c, id) {
  return c.levels.find((l) => l.id === id) ?? null;
}

/** The campaigns whose chapter is being decided now → the chapter decided so far. @type {WeakMap<Campaign, { cur: CampaignChapter|null }>} */
const deciding = new WeakMap();

/**
 * The chapter in force: the last one whose `when` holds (or that has none), else null.
 *
 * A chapter's `when` that reads `chapter` (an error of the campaign check) asks this again while it
 * is being decided: that inner question is answered with the chapter decided so far — the last
 * earlier chapter whose condition held, else the first chapter — instead of recursing forever.
 * @param {Campaign} c
 * @param {(when: string) => boolean} holds does a story condition hold now (the flag rule: a bare
 *   flag name is that flag — `StoryState.holds`)
 * @returns {CampaignChapter|null}
 */
export function activeChapter(c, holds) {
  const outer = deciding.get(c);
  if (outer) return outer.cur ?? c.chapters[0] ?? null;
  const state = { cur: /** @type {CampaignChapter|null} */ (null) };
  deciding.set(c, state);
  try {
    for (const ch of c.chapters) if (!ch.when || holds(ch.when)) state.cur = ch;
    return state.cur;
  } finally {
    deciding.delete(c);
  }
}

/**
 * The file id to load for level `id` in the current chapter (its variant, or itself).
 * @param {Campaign} c
 * @param {string} id
 * @param {(when: string) => boolean} holds
 * @returns {string}
 */
export function chapterLevelId(c, id, holds) {
  const ch = activeChapter(c, holds);
  return ch && isOwnKey(ch.levels, id) ? ch.levels[id] : id;
}

/**
 * Every file id that can stand for level `id` (itself and its chapter variants), for checks.
 * @param {Campaign} c
 * @param {string} id
 * @returns {string[]}
 */
export function levelVariants(c, id) {
  const out = [id];
  for (const ch of c.chapters) if (isOwnKey(ch.levels, id) && !out.includes(ch.levels[id])) out.push(ch.levels[id]);
  return out;
}

/**
 * Across a seam: point (x, z) of level `from` in the coordinates of level `to`, when the campaign
 * places both (`at`); null otherwise.
 * @param {Campaign} c
 * @param {string} from
 * @param {string} to
 * @param {number} x
 * @param {number} z
 * @returns {{ x: number, z: number }|null}
 */
export function acrossSeam(c, from, to, x, z) {
  const a = campaignLevel(c, from)?.at;
  const b = campaignLevel(c, to)?.at;
  if (!a || !b) return null;
  return { x: x + a[0] - b[0], z: z + a[1] - b[1] };
}
