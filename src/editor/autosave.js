/**
 * Autosave of the editor's working copy to browser storage, and the recovered copies of other
 * editor sessions.
 *
 *  - The working copy lives in slot `__autosave__` (same key scheme as LevelStorage, so
 *    `loadLocalLevel('__autosave__')` reads it) with a meta record naming the editor session that
 *    wrote it; it is kept out of the browser level list.
 *  - An autosave is never overwritten before it was resolved: when this session is about to
 *    write and the slot holds another session's copy (a previous visit whose restore prompt was
 *    dismissed or skipped by `?open=` / `?new` / `?local=`, or another editor tab), that copy is
 *    first moved to the recovered copies (slots `__recovered_<id>__`, the newest
 *    `MAX_RECOVERED`, one per session). File › Open › This browser lists them.
 *  - `clearAutosave()` only removes this session's own copy (after a save or an explicit
 *    "Don't save"); `discardAutosave()` removes whatever the slot holds (the restore prompt's
 *    "Discard").
 */
import { serializeLevel } from '../engine/level/LevelFormat.js';
import { loadLocalLevel } from '../engine/level/LevelStorage.js';

/**
 * @import { Level } from '../engine/level/types.js'
 * @import { FileRef } from './EditorState.js'
 */

export const AUTOSAVE_SLOT = '__autosave__';
const KEY = `luminati.level.${AUTOSAVE_SLOT}`;
const META = 'luminati.editor.autosave';
const RECOVERED = 'luminati.editor.recovered';
export const MAX_RECOVERED = 3;

/** This editor session (a page load). */
export const SESSION_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const recoveredSlot = (id) => `__recovered_${id}__`;

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Write the working copy. Returns false when storage is unavailable / full.
 * @param {Level} level
 * @param {FileRef} fileRef where the level came from ({ kind, name })
 * @param {{ exported?: boolean }} [extra] exported: the level was just downloaded as a file (the
 *   copy is kept for safety, but not offered at the next start)
 */
export function writeAutosave(level, fileRef, extra = {}) {
  try {
    const meta = readAutosaveMeta();
    if (meta && meta.sid !== SESSION_ID) archiveAutosave();
    localStorage.setItem(KEY, serializeLevel(level));
    localStorage.setItem(META, JSON.stringify({ sid: SESSION_ID, savedAt: Date.now(), name: level.name, width: level.width, depth: level.depth, fileRef, ...extra }));
    return true;
  } catch {
    return false;
  }
}

/**
 * What the autosave slot (and a recovered copy) records about its level.
 * @typedef {object} AutosaveMeta
 * @property {string} [sid]  the session that wrote it
 * @property {number} savedAt  ms since the epoch
 * @property {string} name
 * @property {number} width
 * @property {number} depth
 * @property {FileRef|null} fileRef
 * @property {boolean} [exported]
 */

/** @returns {AutosaveMeta|null} */
export function readAutosaveMeta() {
  try {
    const m = JSON.parse(localStorage.getItem(META) ?? 'null');
    return m && localStorage.getItem(KEY) ? m : null;
  } catch {
    return null;
  }
}

/** Is the autosave slot this session's own copy? */
export const ownsAutosave = () => readAutosaveMeta()?.sid === SESSION_ID;

/** @returns {{ level: Level, warnings: string[] }|null} */
export function loadAutosave() {
  try { return loadLocalLevel(AUTOSAVE_SLOT); } catch { return null; }
}

/** Remove this session's own working copy (after a save / an explicit "Don't save"). */
export function clearAutosave() {
  // older copies of this session that another tab moved aside are resolved too
  for (const e of listRecovered()) if (e.sid === SESSION_ID) deleteRecovered(e.id);
  const m = readAutosaveMeta();
  if (m && m.sid !== SESSION_ID) return; // another session's copy: not ours to drop
  discardAutosave();
}

/** Remove the working copy in the slot, whoever wrote it. */
export function discardAutosave() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(META);
  } catch { /* storage unavailable */ }
}

/**
 * Move the working copy in the slot to the recovered copies (keeps the newest MAX_RECOVERED,
 * one per session). Returns the recovered entry, or null.
 */
export function archiveAutosave() {
  const meta = readAutosaveMeta();
  if (!meta) return null;
  let text = null;
  try { text = localStorage.getItem(KEY); } catch { return null; }
  if (!text) return null;
  const sid = meta.sid ?? 'legacy';
  let list = listRecovered();
  // one entry per session: its newer copy replaces the older one
  for (const e of list.filter((x) => x.sid === sid)) removeRecoveredData(e.id);
  list = list.filter((x) => x.sid !== sid);
  const id = `${(meta.savedAt ?? Date.now()).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const entry = { id, sid, savedAt: meta.savedAt ?? Date.now(), name: meta.name ?? 'Untitled', width: meta.width, depth: meta.depth, fileRef: meta.fileRef ?? null, exported: !!meta.exported };
  try {
    localStorage.setItem(`luminati.level.${recoveredSlot(id)}`, text);
  } catch {
    return null; // full: leave the copy where it is
  }
  list.unshift(entry);
  list.sort((a, b) => b.savedAt - a.savedAt);
  for (const old of list.splice(MAX_RECOVERED)) removeRecoveredData(old.id);
  try { localStorage.setItem(RECOVERED, JSON.stringify(list)); } catch { /* ignore */ }
  discardAutosave();
  return entry;
}

/**
 * Recovered copies of other sessions' unsaved work, newest first.
 * @returns {(AutosaveMeta & { id: string, sid: string })[]}
 */
export function listRecovered() {
  const list = readJSON(RECOVERED, []);
  if (!Array.isArray(list)) return [];
  return list.filter((e) => {
    try { return e && e.id && localStorage.getItem(`luminati.level.${recoveredSlot(e.id)}`); } catch { return false; }
  }).sort((a, b) => b.savedAt - a.savedAt);
}

/** @returns {{ level: Level, warnings: string[] }|null} */
export function loadRecovered(id) {
  try { return loadLocalLevel(recoveredSlot(id)); } catch { return null; }
}

function removeRecoveredData(id) {
  try { localStorage.removeItem(`luminati.level.${recoveredSlot(id)}`); } catch { /* ignore */ }
}

export function deleteRecovered(id) {
  removeRecoveredData(id);
  const list = readJSON(RECOVERED, []);
  try { localStorage.setItem(RECOVERED, JSON.stringify((Array.isArray(list) ? list : []).filter((e) => e?.id !== id))); } catch { /* ignore */ }
}

/** Stored size (characters) of a recovered copy. */
export function recoveredSize(id) {
  try { return localStorage.getItem(`luminati.level.${recoveredSlot(id)}`)?.length ?? 0; } catch { return 0; }
}
