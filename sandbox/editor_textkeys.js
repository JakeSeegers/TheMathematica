/**
 * Helpers of the editor's text-key suite (sandbox/editor_shell.textkeys.json; docs/specs/I18N.md
 * §4.10): load from an eval step after editor_shell.helpers.js —
 *   import('/sandbox/editor_textkeys.js').then((m) => m.install('tk'))
 * Then `window.K`: the editor, the key modules, assertions (a failed one throws a page error) and
 * readers of an object's keys and script tags.
 */

/** @import { EditorHooks } from '../src/editor/EditorApp.js' */

/**
 * `window.K`, set by `install()`.
 * @typedef {object} TextKeyHelpers
 * @property {EditorHooks} E  `window.__editor`
 * @property {typeof import('../src/engine/level/LevelFormat.js')} F
 * @property {typeof import('../src/engine/i18n/ContentKeys.js')} CK
 * @property {typeof import('../src/engine/i18n/TextKeys.js')} TK
 * @property {typeof import('../src/engine/level/LevelStorage.js')} S
 * @property {string} prefix  the seed of the editor's keys (`__editor.seedTextKeys`)
 * @property {string[]} fails
 * @property {(c: unknown, m: string) => boolean} ok
 * @property {(seed: string) => string} expect  the key the seeded editor gives a text (`guidOf(prefix|seed)`)
 * @property {(id: string) => any} obj
 * @property {(id: string) => string} json  the object as JSON
 * @property {(v: unknown) => string[]} tags  each script line's tag ('' for none)
 * @property {(v: unknown) => string} lines  the script without its tags, as JSON
 * @property {(o: any) => string[]} keys  every key an object holds (textKeys and tags)
 * @property {(ids?: string[]) => ReturnType<typeof import('../src/engine/i18n/TextKeys.js').textKeyIssues>} issues
 *   the level's text-key problems (only those of `ids` when given)
 * @property {() => string} hiddenLeak  '' when no field of the inspector shows a key or tag and
 *   nothing but its read-only key lines (`.le-text-keys`) does, else what shows one
 * @property {(field: string) => { at: string, key: string, missing: boolean }[]} keyLines  the read-only
 *   key lines the inspector shows under a field (`at`: "key", "page 2", "page 2 › 1", "line 3")
 * @property {(field: string) => HTMLButtonElement|null} keyToggle  a field's "Text keys (n)" toggle
 * @property {(fn: () => unknown, ms?: number) => Promise<boolean>} until  waits until `fn()` is truthy
 *   (false after `ms`, 6000 by default)
 * @property {(o: any) => { field: string, key: string, text: string, page?: number, choice?: number, line?: number }[]} rows
 *   an object's keyed texts (src/editor/textKeys.js `textRows`)
 * @property {(name: string) => Promise<string>} disk  a project level's file as it is on disk (the
 *   level API: a file written moments ago may not be served from public/ yet)
 * @property {(label: string, v: string) => Promise<void>} set  type into an inspector field
 * @property {() => Promise<void>} settle
 */

/**
 * Install `window.K`.
 * @param {string} prefix the seed of the editor's keys
 * @returns {Promise<string>}
 */
export async function install(prefix) {
  const E = window.__editor;
  await E.app.ready;
  await E.ready3d;
  const F = await import('../src/engine/level/LevelFormat.js');
  const CK = await import('../src/engine/i18n/ContentKeys.js');
  const TK = await import('../src/engine/i18n/TextKeys.js');
  const S = await import('../src/engine/level/LevelStorage.js');
  const EK = await import('../src/editor/textKeys.js');
  const T = /** @type {any} */ (window).T;
  /** @param {string} field */
  const keyView = (field) => [...document.querySelectorAll('.le-inspector .le-text-keys')].find((x) => /** @type {HTMLElement} */ (x).dataset.field === field) ?? null;
  E.seedTextKeys(prefix);
  /** @type {string[]} */
  const fails = [];
  /** @type {TextKeyHelpers} */
  const K = {
    E, F, CK, TK, S, prefix, fails,
    ok: (c, m) => {
      if (!c) { fails.push(m); setTimeout(() => { throw new Error(`ASSERT ${m}`); }); }
      return !!c;
    },
    expect: (seed) => CK.guidOf(`${prefix}|${seed}`),
    obj: (id) => E.state.getObject(id),
    json: (id) => JSON.stringify(E.state.getObject(id)),
    tags: (v) => scriptLinesOf(v).map((l) => CK.splitLineTag(l).tag),
    lines: (v) => JSON.stringify(TK.stripScriptTags(v)),
    keys: (o) => TK.levelKeys({ objects: [o] }).map((k) => k.key),
    issues: (ids) => TK.textKeyIssues(E.state.level).filter((i) => !ids || ids.some((id) => i.where.startsWith(`${id} `) || i.where.startsWith(`${id}.`))),
    hiddenLeak: () => {
      const root = document.querySelector('.le-inspector');
      if (!root) return '';
      const values = [...root.querySelectorAll('input, textarea')].map((x) => /** @type {HTMLInputElement} */ (x).value);
      // (the read-only key lines show keys: everything else must not)
      const rest = /** @type {HTMLElement} */ (root.cloneNode(true));
      for (const x of rest.querySelectorAll('.le-text-keys')) x.remove();
      const shown = [rest.textContent ?? '', ...values].join('\n');
      const m = /#line:|textKeys|\b[0-9A-F]{32}\b/.exec(shown);
      return m ? shown.slice(Math.max(0, m.index - 30), m.index + 40) : '';
    },
    keyLines: (field) => [...(keyView(field)?.querySelectorAll('.le-text-key') ?? [])].map((l) => ({
      at: l.querySelector('.le-text-key-at')?.textContent ?? '',
      key: /** @type {HTMLElement} */ (l).dataset.key ?? '',
      missing: l.classList.contains('is-missing'),
    })),
    keyToggle: (field) => /** @type {HTMLButtonElement|null} */ (keyView(field)?.querySelector('.le-text-keys-toggle') ?? null),
    until: async (fn, ms = 6000) => {
      const end = performance.now() + ms;
      while (performance.now() < end) { if (fn()) return true; await T.sleep(50); }
      return !!fn();
    },
    rows: (o) => EK.textRows(o),
    disk: (name) => fetch(`${import.meta.env.BASE_URL}api/levels/${encodeURIComponent(name)}`, { cache: 'no-store' }).then((r) => (r.ok ? r.text() : `HTTP ${r.status}`)),
    set: async (label, v) => { T.setInput(T.field(label), v); await T.sleep(150); },
    settle: async () => { await T.sleep(150); while (E.view3d?.busy) await T.sleep(100); await T.sleep(150); },
  };
  /** @type {any} */ (window).K = K;
  return `installed (${prefix})`;
}

/**
 * A script field's lines (StoryScript.scriptLines' rule: an array's strings split at line breaks,
 * a string split, anything else none).
 * @param {unknown} v
 * @returns {string[]}
 */
function scriptLinesOf(v) {
  if (typeof v === 'string') return v.split(/\r?\n/);
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string').flatMap((x) => x.split(/\r?\n/));
}
