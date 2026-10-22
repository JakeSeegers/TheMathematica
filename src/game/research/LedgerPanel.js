import './ledger.css';
import { mean, median, sd, percentile, fiveNumber, frequencyTable } from './stats.js';
import { evidenceFor } from './report.js';
import { round } from './missions.js';
import { newRunSeed } from './ResearchMode.js';

/**
 * The field ledger (docs/design/RESEARCH_STATISTICS_RPG.md §6, step 4): the research overlay's one
 * page, opened with L on a research level. Tabs:
 * - Missions: the Steward's questions and the tasks embedded in them, checked against the data;
 * - Data: what was observed, by unit (expeditions, fights, goblins, attacks), habitat and missing
 *   reason, and the latest attack rows;
 * - Charts: the strike totals and the damage of hits, and (once mission 3 unlocks them) the
 *   summaries, and (once mission 4 unlocks it) the interval;
 * - Report: the estimate, the interval and — separately — the purchase;
 * - Debrief: research quality, decision quality and the outcome, kept apart, then the truth.
 *
 * It reads the player's dataset only; the truth appears in the debrief after the report is sent.
 * English only for now (decision D9). Plain DOM in the game's UI font.
 */

/** @import { ResearchMode } from './ResearchMode.js' */

/** @typedef {'missions'|'data'|'charts'|'report'|'debrief'} Tab */

const TABS = /** @type {const} */ ([['missions', 'Missions'], ['data', 'Data'], ['charts', 'Charts'], ['report', 'Report'], ['debrief', 'Debrief']]);

/** Plain-English sentences for the debrief's flags. */
const FLAG_TEXT = {
  'coverage-gap': 'Your sample did not match the make-up of the population: some places were over- or under-represented.',
  'small-sample': 'Your sample was small, so chance alone could move the estimate a lot.',
  'estimate-mismatch': 'Your estimate does not match what your own data shows.',
  'interval-mismatch': 'Your interval does not match the one your data gives.',
  'no-uncertainty': 'You gave no statement of uncertainty.',
  'condition-not-met': 'The interval\'s condition (at least 5 yes and 5 no) was not met, so it is unreliable.',
  'not-defensible': 'For the evidence you had, other purchases looked clearly better.',
  'no-evidence': 'There was no evidence to judge the purchase against.',
};

/** @param {string} tag @param {Record<string, any>} [attrs] @param {(Node|string)[]} [kids] */
function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids) n.append(c);
  return n;
}

/** @param {number|null|undefined} x @param {number} [d] */
const fmt = (x, d = 3) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : String(round(x, d)));

export class LedgerPanel {
  /**
   * @param {HTMLElement} parent
   * @param {ResearchMode} research
   * @param {{ onClose?: () => void }} [o]
   */
  constructor(parent, research, { onClose } = {}) {
    this.research = research;
    this.onClose = onClose ?? (() => {});
    /** @type {Tab} */
    this.tab = 'missions';
    /** @type {Record<string, { ok: boolean, text: string }>} the last feedback per task */
    this.feedback = {};
    /** @type {string[]} the report's problems after a refused send */
    this.problems = [];
    /** The New run button was pressed once (it asks again before it throws the run away). */
    this._confirmNew = false;
    this.element = el('div', { class: 'lu-ledger', tabindex: '-1', role: 'dialog', 'aria-label': 'Field ledger' });
    this.element.addEventListener('keydown', (e) => {
      // the panel keeps its keys from the game
      e.stopPropagation();
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      if (e.code === 'Escape' || (e.code === 'KeyL' && !typing)) { e.preventDefault(); this.close(); }
    });
    this.element.addEventListener('keyup', (e) => e.stopPropagation());
    parent.append(this.element);
    this._open = false;
  }

  get isOpen() { return this._open; }

  /** @param {Tab} [tab] */
  open(tab) {
    if (tab) this.tab = tab;
    this._open = true;
    this.element.classList.add('is-on');
    this.render();
    this.element.focus({ preventScroll: true });
  }

  close() {
    if (!this._open) return;
    this._open = false;
    this.element.classList.remove('is-on');
    this.element.blur();
    this.onClose();
  }

  dispose() {
    this.element.remove();
  }

  // ---------------------------------------------------------------------------------------------

  render() {
    const r = this.research;
    const cur = r.missions.current;
    const head = el('div', { class: 'lu-ledger__head' }, [
      el('div', { class: 'lu-ledger__title', text: 'Field Ledger' }),
      el('div', { class: 'lu-ledger__sub', text: `Run ${r.run.seed}${r.run.permadeath ? ' (permadeath)' : ''} · Expedition ${r.expedition}${cur ? ` · ${cur.title}` : ' · all missions done'}` }),
      el('button', { class: 'lu-ledger__btn', text: this._confirmNew ? 'Sure? Start a new run' : 'New run', title: 'A new seed: new goblins, a new hero, an empty ledger', onclick: () => this._newRun() }),
      el('button', { class: 'lu-ledger__close', text: '✕', title: 'Close (Esc or L)', onclick: () => this.close() }),
    ]);
    const tabs = el('div', { class: 'lu-ledger__tabs' }, TABS.map(([id, label]) => el('button', {
      class: `lu-ledger__tab${this.tab === id ? ' is-cur' : ''}`,
      text: label,
      disabled: (id === 'report' && !this._reportOpen()) || (id === 'debrief' && !r.result),
      onclick: () => { this.tab = id; this.render(); },
    })));
    const body = el('div', { class: 'lu-ledger__body' });
    if (r.run.ended) body.append(el('div', { class: 'lu-ledger__ended' }, [
      el('p', { text: 'Your hero fell. With permadeath this run is over. Your ledger is kept below; start a new run for a new world.' }),
      el('button', { class: 'lu-ledger__btn lu-ledger__btn--main', text: 'Start a new run', onclick: () => { this._confirmNew = true; this._newRun(); } }),
    ]));
    const view = { missions: () => this._missions(), data: () => this._data(), charts: () => this._charts(), report: () => this._report(), debrief: () => this._debrief() }[this.tab];
    body.append(...view());
    this.element.replaceChildren(head, tabs, body);
  }

  /**
   * A new run: a new seed in the address (asked twice unless the run is over). The page reloads;
   * a seed other than the saved run's starts a new run (ResearchMode.fromPage).
   */
  _newRun() {
    if (!this._confirmNew) { this._confirmNew = true; this.render(); return; }
    const q = new URLSearchParams(globalThis.location.search);
    q.set('seed', String(newRunSeed()));
    q.delete('fresh');
    globalThis.location.search = q.toString();
  }

  /** The report page opens with the last mission (or after a report). */
  _reportOpen() {
    const r = this.research;
    return !!r.result || r.missions.current?.tasks.some((t) => t.type === 'report') === true;
  }

  // ---- missions ----

  _missions() {
    const r = this.research;
    const ds = r.dataset;
    const out = [];
    const cur = r.missions.current;
    for (const m of r.missions.missions) {
      const done = r.missions.missionDone(m);
      const isCur = m === cur;
      const box = el('div', { class: `lu-ledger__mission${done ? ' is-done' : ''}${isCur ? ' is-cur' : ''}` }, [
        el('div', { class: 'lu-ledger__mtitle', text: `${done ? '✓ ' : isCur ? '▶ ' : '· '}${m.title}` }),
      ]);
      if (isCur) {
        box.append(el('p', { class: 'lu-ledger__brief', text: r.missions.brief(m, ds) }));
        for (const t of m.tasks) box.append(this._task(m, t));
      }
      out.push(box);
    }
    if (!cur) out.push(el('p', { class: 'lu-ledger__note', text: 'Every mission of this investigation is done. Read the debrief.' }));
    return out;
  }

  /** @param {any} m @param {any} t */
  _task(m, t) {
    const r = this.research;
    const ds = r.dataset;
    const key = r.missions.key(m, t);
    const done = r.missions.done.has(key);
    const box = el('div', { class: `lu-ledger__task${done ? ' is-done' : ''}` });
    if (t.type === 'report') {
      box.append(el('p', { text: r.result ? '✓ Report sent. See the debrief.' : 'Open the Report page to advise the Steward.' }));
      if (!r.result) box.append(el('button', { class: 'lu-ledger__btn', text: 'Go to the report', onclick: () => { this.tab = 'report'; this.render(); } }));
      return box;
    }
    box.append(el('div', { class: 'lu-ledger__q', text: `${done ? '✓ ' : ''}${t.question}` }));
    const need = r.missions.needs(t, ds);
    if (!done && !need.met) {
      box.append(el('p', { class: 'lu-ledger__need', text: `Needs ${need.need} ${need.what}: you have ${need.have}.` }));
      return box;
    }
    const fb = this.feedback[key];
    if (!done) {
      if (t.type === 'choice') {
        t.options.forEach((/** @type {any} */ o, /** @type {number} */ i) => box.append(el('button', {
          class: 'lu-ledger__opt', text: o.text,
          onclick: () => { const a = r.missions.answer(m, t, i, ds); this.feedback[key] = { ok: a.ok, text: a.feedback }; r.save(); this.render(); },
        })));
      } else {
        const input = /** @type {HTMLInputElement} */ (el('input', { class: 'lu-ledger__num', type: 'number', step: 'any', inputmode: 'decimal', 'aria-label': t.question }));
        const check = () => { const a = r.missions.answer(m, t, Number.parseFloat(input.value), ds); this.feedback[key] = { ok: a.ok, text: a.feedback }; r.save(); this.render(); };
        input.addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'NumpadEnter') check(); });
        box.append(el('div', { class: 'lu-ledger__row' }, [input, el('button', { class: 'lu-ledger__btn', text: 'Check', onclick: check })]));
      }
    }
    if (fb) box.append(el('p', { class: `lu-ledger__fb ${fb.ok ? 'is-ok' : 'is-no'}`, text: fb.text }));
    return box;
  }

  // ---- data ----

  _data() {
    const ds = this.research.dataset;
    const c = ds.counts();
    const habitats = this.research.config.habitats;
    const elig = (/** @type {string} */ h) => ds.attacks.filter((a) => a.eligible && ds.enemies.find((e) => e.id === a.enemyId)?.habitat === h).length;
    const byH = ds.byHabitat();
    const missing = Object.entries(ds.missing());
    const rows = ds.attacks.slice(-15).reverse().map((a) => {
      const en = ds.enemies.find((e) => e.id === a.enemyId);
      return el('tr', {}, [a.id, a.enemyId, habitats[en?.habitat ?? '']?.name ?? '', en?.weapon ?? '', a.rollMode, a.strikeTotal ?? (a.critical ? 'nat 20' : 'nat 1'), a.hit ? 'hit' : 'miss', a.damage ?? '—', a.eligible ? '✓' : ''].map((v) => el('td', { text: String(v) })));
    });
    return [
      el('p', { class: 'lu-ledger__note', text: 'Every fight with a studied goblin is recorded here. Only what you could see is written down: the strike total, hit or miss, the damage of hits. One goblin gives one eligible attack: its first normal one.' }),
      el('table', { class: 'lu-ledger__table' }, [
        el('tr', {}, ['Unit', 'Count'].map((h) => el('th', { text: h }))),
        ...[['Expeditions', c.expedition], ['Fights', c.encounter], ['Goblins', c.enemy], ['Attacks', c.attack], ['Goblins with an eligible attack', ds.attacks.filter((a) => a.eligible).length]].map(([k, v]) => el('tr', {}, [el('td', { text: String(k) }), el('td', { text: String(v) })])),
      ]),
      el('table', { class: 'lu-ledger__table' }, [
        el('tr', {}, ['Place', 'Goblins met', 'Eligible'].map((h) => el('th', { text: h }))),
        ...Object.keys(habitats).map((h) => el('tr', {}, [habitats[h].name, byH[h] ?? 0, elig(h)].map((v) => el('td', { text: String(v) })))),
      ]),
      el('table', { class: 'lu-ledger__table' }, [
        el('tr', {}, ['No eligible attack because…', 'Goblins'].map((h) => el('th', { text: h }))),
        ...(missing.length ? missing.map(([k, v]) => el('tr', {}, [el('td', { text: k }), el('td', { text: String(v) })])) : [el('tr', {}, [el('td', { text: '(none)' }), el('td', { text: '0' })])]),
      ]),
      el('div', { class: 'lu-ledger__h', text: 'Latest attacks' }),
      el('table', { class: 'lu-ledger__table lu-ledger__table--rows' }, [
        el('tr', {}, ['Attack', 'Goblin', 'Place', 'Weapon', 'Roll', 'Strike', 'Result', 'Damage', 'Eligible'].map((h) => el('th', { text: h }))),
        ...rows,
      ]),
    ];
  }

  // ---- charts ----

  _charts() {
    const r = this.research;
    const ds = r.dataset;
    const out = [];
    const strikes = ds.attacks.filter((a) => a.eligible).map((a) => (a.critical ? 'nat 20' : a.fumble ? 'nat 1' : /** @type {number} */ (a.strikeTotal)));
    const light = 10 + r.config.citizens.dex + (r.config.citizens.armor.light ?? 0);
    const medium = 10 + r.config.citizens.dex + (r.config.citizens.armor.medium ?? 0);
    out.push(el('div', { class: 'lu-ledger__h', text: `Eligible strike totals (one per goblin, n = ${strikes.length})` }));
    out.push(el('p', { class: 'lu-ledger__note', text: `Bars at ${light} or more beat light armour (AC ${light}); at ${medium} or more, medium (AC ${medium}). A natural 20 always gets through; a natural 1 never does.` }));
    out.push(this._bars(strikes, (v) => (v === 'nat 20' ? 'hot' : v === 'nat 1' ? 'cold' : /** @type {number} */ (v) >= medium ? 'hot' : /** @type {number} */ (v) >= light ? 'warm' : 'cold')));
    const dmg = ds.damageOnHit();
    out.push(el('div', { class: 'lu-ledger__h', text: `Damage of hits (every hit, n = ${dmg.length})` }));
    out.push(el('p', { class: 'lu-ledger__note', text: `A citizen has ${/** @type {any} */ (r.config).kingdom?.citizenHp ?? 10} HP. Misses have no damage, so they are not here.` }));
    out.push(this._bars(dmg, (v) => (/** @type {number} */ (v) >= (/** @type {any} */ (r.config).kingdom?.citizenHp ?? 10) ? 'hot' : 'warm')));
    if (!r.missions.unlocked('summaries')) {
      out.push(el('p', { class: 'lu-ledger__note is-lock', text: 'Finish mission 3 to see automatic summaries.' }));
      return out;
    }
    if (dmg.length >= 2) {
      const f = fiveNumber(dmg);
      out.push(el('table', { class: 'lu-ledger__table' }, [
        el('tr', {}, ['Damage of hits', 'Value'].map((h) => el('th', { text: h }))),
        ...[['n', dmg.length], ['Mean', fmt(mean(dmg), 2)], ['Median', fmt(median(dmg), 2)], ['Standard deviation', fmt(sd(dmg), 2)], ['Q1 – Q3', `${f.q1} – ${f.q3}`], ['90th percentile', fmt(percentile(dmg, 90), 2)], ['Largest', f.max]].map(([k, v]) => el('tr', {}, [el('td', { text: String(k) }), el('td', { text: String(v) })])),
      ]));
    }
    const showCi = r.missions.unlocked('interval');
    const rowsP = [];
    for (const [label, habitat] of [['Whole sample', undefined], ...Object.entries(r.config.habitats).map(([id, h]) => [h.name, id])]) {
      for (const [armor, ac] of [['light', light], ['medium', medium]]) {
        const ev = evidenceFor(ds, /** @type {number} */ (ac), { habitat: /** @type {string|undefined} */ (habitat) });
        rowsP.push(el('tr', {}, [label, armor, ev.n, ev.n ? `${ev.x} / ${ev.n} = ${fmt(ev.estimate)}` : '—', showCi && ev.interval ? `${fmt(ev.interval.lo)} – ${fmt(ev.interval.hi)}${ev.interval.conditionMet ? '' : ' (!)'}` : showCi ? '—' : 'locked'].map((v) => el('td', { text: String(v) }))));
      }
    }
    out.push(el('div', { class: 'lu-ledger__h', text: 'Share of eligible strikes that beat the armour' }));
    out.push(el('table', { class: 'lu-ledger__table' }, [el('tr', {}, ['Sample', 'Armour', 'n', 'Share', '95% interval'].map((h) => el('th', { text: h }))), ...rowsP]));
    if (showCi) out.push(el('p', { class: 'lu-ledger__note', text: 'The interval is about the share, for goblins like the ones you sampled. (!) means fewer than 5 yes or 5 no: the interval is unreliable.' }));
    return out;
  }

  /**
   * A bar chart of a frequency table (whole numbers in order, with empty values shown).
   * @param {(number|string)[]} values
   * @param {(v: number|string) => string} tone
   */
  _bars(values, tone) {
    if (!values.length) return el('p', { class: 'lu-ledger__note', text: '(no data yet)' });
    const table = frequencyTable(values);
    const nums = table.filter((r) => typeof r.value === 'number').map((r) => /** @type {number} */ (r.value));
    /** @type {(number|string)[]} */
    const keys = [];
    if (table.some((r) => r.value === 'nat 1')) keys.push('nat 1');
    if (nums.length) for (let v = Math.min(...nums); v <= Math.max(...nums); v++) keys.push(v);
    if (table.some((r) => r.value === 'nat 20')) keys.push('nat 20');
    const count = new Map(table.map((r) => [r.value, r.count]));
    const max = Math.max(...table.map((r) => r.count));
    return el('div', { class: 'lu-ledger__chart' }, keys.map((k) => {
      const n = count.get(k) ?? 0;
      return el('div', { class: 'lu-ledger__col', title: `${k}: ${n}` }, [
        el('div', { class: 'lu-ledger__n', text: n ? String(n) : '' }),
        el('div', { class: `lu-ledger__bar is-${tone(k)}`, style: `height:${Math.round((n / max) * 100)}%` }),
        el('div', { class: 'lu-ledger__k', text: String(k).replace('nat ', 'n') }),
      ]);
    }));
  }

  // ---- report ----

  _report() {
    const r = this.research;
    if (r.result) return [el('p', { class: 'lu-ledger__note', text: 'Your report was sent. See the debrief.' })];
    const k = /** @type {any} */ (r.config).kingdom;
    const ci = r.missions.unlocked('interval');
    const f = {
      population: /** @type {HTMLSelectElement} */ (el('select', { class: 'lu-ledger__sel' }, [el('option', { value: 'region', text: 'All goblins of the Pass' }), ...Object.entries(r.config.habitats).map(([id, h]) => el('option', { value: id, text: `${h.name} goblins only` }))])),
      estimate: /** @type {HTMLInputElement} */ (el('input', { class: 'lu-ledger__num', type: 'number', step: 'any', min: '0', max: '1' })),
      lo: /** @type {HTMLInputElement} */ (el('input', { class: 'lu-ledger__num', type: 'number', step: 'any', min: '0', max: '1', disabled: !ci })),
      hi: /** @type {HTMLInputElement} */ (el('input', { class: 'lu-ledger__num', type: 'number', step: 'any', min: '0', max: '1', disabled: !ci })),
      armor: /** @type {HTMLSelectElement} */ (el('select', { class: 'lu-ledger__sel' }, [['none', 'Buy nothing'], ['light', `Light armour (${k.prices.light} each)`], ['medium', `Medium armour (${k.prices.medium} each)`]].map(([v, t]) => el('option', { value: v, text: t })))),
      count: /** @type {HTMLInputElement} */ (el('input', { class: 'lu-ledger__num', type: 'number', step: '1', min: '0', max: String(Object.values(k.citizens).reduce((a, b) => a + /** @type {number} */ (b), 0)), value: '0' })),
      rationale: /** @type {HTMLTextAreaElement} */ (el('textarea', { class: 'lu-ledger__text', rows: '2', placeholder: 'Why? One or two sentences, using your evidence.' })),
    };
    const cost = el('span', { class: 'lu-ledger__note' });
    const upd = () => {
      const p = { armor: f.armor.value, count: Math.max(0, Math.floor(Number(f.count.value) || 0)) };
      const c = r.kingdom ? r.kingdom.cost(p) : 0;
      cost.textContent = `Cost: ${c} of ${k.budget} silver (reserve ${k.reserve}).`;
    };
    f.armor.addEventListener('change', upd);
    f.count.addEventListener('input', upd);
    upd();
    const send = () => {
      const res = r.submit({
        armor: 'light', population: f.population.value, unit: 'enemy',
        estimate: Number.parseFloat(f.estimate.value),
        interval: ci && f.lo.value !== '' && f.hi.value !== '' ? { lo: Number.parseFloat(f.lo.value), hi: Number.parseFloat(f.hi.value), level: 0.95 } : null,
        policy: { armor: f.armor.value, count: Math.max(0, Math.floor(Number(f.count.value) || 0)) },
        rationale: f.rationale.value,
      });
      if ('problems' in res) { this.problems = res.problems; this.render(); return; }
      this.problems = [];
      this.tab = 'debrief';
      this.render();
    };
    const out = [
      el('p', { class: 'lu-ledger__note', text: 'Your report has two separate parts: what the evidence says (the claim), and what to buy (the policy).' }),
      el('div', { class: 'lu-ledger__h', text: '1. The claim: the share of goblin attacks that beat light armour (AC 12)' }),
      el('label', { class: 'lu-ledger__field' }, ['About: ', f.population]),
      el('label', { class: 'lu-ledger__field' }, ['Estimate (0 – 1): ', f.estimate]),
      el('label', { class: 'lu-ledger__field' }, [ci ? '95% interval: ' : '95% interval (finish mission 4): ', f.lo, ' to ', f.hi]),
      el('div', { class: 'lu-ledger__h', text: '2. The policy' }),
      el('label', { class: 'lu-ledger__field' }, ['Buy: ', f.armor, ' for ', f.count, ' citizens']),
      cost,
      el('label', { class: 'lu-ledger__field lu-ledger__field--wide' }, ['Rationale: ', f.rationale]),
      el('button', { class: 'lu-ledger__btn lu-ledger__btn--main', text: 'Send to the Steward', onclick: send }),
    ];
    if (this.problems.length) out.push(el('ul', { class: 'lu-ledger__problems' }, this.problems.map((p) => el('li', { text: p }))));
    return out;
  }

  // ---- debrief ----

  _debrief() {
    const res = this.research.result;
    if (!res) return [el('p', { text: 'No report yet.' })];
    const d = res.debrief;
    const names = Object.fromEntries(Object.entries(this.research.config.habitats).map(([id, h]) => [id, h.name]));
    const pol = (/** @type {{ armor: string, count: number }} */ p) => (p.armor === 'none' || !p.count ? 'buy nothing' : `${p.armor} armour for ${p.count}`);
    const flags = (/** @type {string[]} */ fs) => fs.length
      ? el('ul', {}, fs.map((f) => el('li', { text: f.startsWith('habitat-missing:') ? `No goblins from the ${names[f.split(':')[1]] ?? f.split(':')[1]} in your sample.` : FLAG_TEXT[/** @type {keyof typeof FLAG_TEXT} */ (f)] ?? f })))
      : el('p', { text: 'No problems found.' });
    const shares = Object.entries(d.research.target.shares).map(([h, s]) => `${names[h] ?? h}: ${Math.round(/** @type {number} */ (d.research.sample.shares[h] ?? 0) * 100)}% of your sample, ${Math.round(/** @type {number} */ (s) * 100)}% of the population`).join('; ');
    return [
      el('p', { class: 'lu-ledger__note', text: 'Three separate questions. A good decision can meet a bad season, and a lucky season does not make weak research right.' }),
      el('div', { class: 'lu-ledger__h', text: '1. Research quality' }),
      el('p', { text: `Eligible goblins: ${d.research.sample.eligible}. ${shares}.` }),
      flags(d.research.flags),
      el('div', { class: 'lu-ledger__h', text: '2. Decision quality (judged on your evidence, not the truth)' }),
      d.decision.mine ? el('p', { text: `You chose to ${pol(d.decision.mine.policy)}. In the world your data describes, it would cost about ${Math.round(d.decision.mine.meanCost)} silver a season; the best option there (${pol(d.decision.best.policy)}) about ${Math.round(d.decision.best.meanCost)}.` }) : el('p', { text: '' }),
      el('p', { text: d.decision.defensible ? 'Your purchase was defensible for the evidence you had.' : 'Your purchase was not the best use of your own evidence.' }),
      flags(d.decision.flags),
      el('div', { class: 'lu-ledger__h', text: '3. What happened this season' }),
      el('p', { text: `Citizens protected: ${d.outcome.protected}. Injured: ${d.outcome.injured}. Killed: ${d.outcome.dead}. Knocked out but unhurt: ${d.outcome.knockedOut}. Armour failed ${d.outcome.equipmentFailures} times. Spent ${d.outcome.spent}, left ${d.outcome.remaining}. Total cost to the kingdom: ${d.outcome.totalCost} silver.` }),
      el('p', { text: `Over ${d.replay.seasons} replayed seasons your policy cost ${Math.round(d.replay.totalCost.p10)}–${Math.round(d.replay.totalCost.p90)} silver (middle 80%), ${Math.round(d.replay.totalCost.mean)} on average. This season was ${d.replay.percentile < 0.34 ? 'a lucky one' : d.replay.percentile > 0.66 ? 'an unlucky one' : 'about typical'} (cheaper than ${Math.round((1 - d.replay.percentile) * 100)}% of them).` }),
      el('div', { class: 'lu-ledger__h', text: 'The truth (unlocked)' }),
      el('p', { text: `The true share of attacks that beat light armour: ${fmt(d.truth.value)} for the ${res.report.population === 'region' ? 'whole Pass' : names[res.report.population]}. ${Object.entries(d.truth.byHabitat).map(([h, v]) => `${names[h]}: ${fmt(/** @type {number} */ (v))}`).join('; ')}. ${d.truth.intervalCovers === null ? '' : d.truth.intervalCovers ? 'Your interval contained it.' : 'Your interval missed it.'}` }),
      el('p', { text: `Under the truth the best option was to ${pol(d.replay.oracle.policy)} (about ${Math.round(d.replay.oracle.meanCost)} silver a season).` }),
    ];
  }
}
