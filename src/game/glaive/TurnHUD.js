import '../../engine/ui/ui.css';
import './glaive.css';
import { pal } from '../../engine/ui/art/palette.js';
import { anchorEl } from '../../engine/ui/layout/layout.js';
import { txt, measure, fit } from '../../engine/ui/layout/type.js';
import { onScale } from '../../engine/ui/UiScale.js';
import { currentFonts } from '../../engine/ui/FontLoader.js';
import { t } from '../../engine/i18n/I18n.js';

/**
 * TurnHUD — the turn-based fight's own HUD (docs/specs/GLAIVE.md §8.4), drawn with the pixel UI kit
 * (docs/specs/PIXEL_UI.md): the turn order across the top centre (the one whose turn it is lit) and
 * a log of the last rolls on the right ("Rook hits the Bramble Goblin: 14 + 3 = 17 vs AC 13").
 * Shown only while a fight runs; hidden with the HUD. The menus themselves are the dialog box's
 * choices (GlaiveCombat). Every text arrives translated.
 */

/** Lines the log keeps. */
const LOG_LINES = 7;
/**
 * The log's box (art px of the 640 × 360 frame, anchored middle left: below the vitals and the
 * party frames, above the dialog window — the menus' choices open on the right).
 */
const LOG = Object.freeze({ x: 10, y: 140, w: 230, h: 96 });
/** The order strip (anchored top centre, under the toasts, between the vitals and the clock). */
const ORDER = Object.freeze({ y: 34, h: 12, maxW: 196 });

export class TurnHUD {
  /** @param {HTMLElement} hudElement the HUD root (`.lu-hud`) */
  constructor(hudElement) {
    const el = document.createElement('div');
    el.className = 'lu-stage lu-glaive';
    el.setAttribute('aria-hidden', 'true');
    hudElement.appendChild(el);
    this.element = el;
    this._order = document.createElement('div');
    this._order.className = 'lu-glaive__order';
    this._log = document.createElement('div');
    this._log.className = 'lu-glaive__log';
    el.append(this._order, this._log);
    /** @type {{ id: string, name: string, foe: boolean, down: boolean }[]} */
    this._entries = [];
    this._current = null;
    /** @type {{ text: string, kind: string }[]} */
    this._lines = [];
    this._visible = false;
    this._disposed = false;
    this._offScale = onScale(hudElement, () => this._rebuild());
    currentFonts()?.ready.then(() => this._rebuild());
  }

  /** Show / hide (a fight starts / ends). @param {boolean} on */
  show(on) {
    this._visible = !!on;
    this.element.classList.toggle('is-on', this._visible);
    if (!on) { this._lines = []; this._entries = []; this._rebuild(); }
  }

  /**
   * The order of the round and whose turn it is (either may be null: unchanged).
   * @param {{ id: string, name: string, foe: boolean, down: boolean }[]|null} entries
   * @param {string|null} current
   */
  set(entries, current) {
    if (entries) this._entries = entries;
    if (current !== null) this._current = current;
    this._buildOrder();
  }

  /** A log line. @param {string} text @param {'hit'|'miss'|'party'|'foe'|'note'|'good'|'bad'} [kind] */
  line(text, kind = 'note') {
    if (!text) return;
    this._lines.push({ text, kind });
    if (this._lines.length > LOG_LINES) this._lines.shift();
    currentFonts()?.ensure([text]).then(() => { if (!this._disposed) this._buildLog(); });
    this._buildLog();
  }

  dispose() {
    this._disposed = true;
    this._offScale?.();
    this.element.remove();
  }

  _rebuild() {
    if (this._disposed) return;
    this._buildOrder();
    this._buildLog();
  }

  _buildOrder() {
    const k = pal();
    const el = this._order;
    el.textContent = '';
    if (!this._entries.length) return;
    const sep = ' · ';
    const font = 'line';
    const sepW = measure(sep, font);
    let w = 0;
    // from the one whose turn it is on (the round wraps): as many as fit
    const at = Math.max(0, this._entries.findIndex((e) => e.id === this._current));
    const ring = [...this._entries.slice(at), ...this._entries.slice(0, at)];
    const parts = ring.map((e) => {
      const name = fit(e.name, font, 70);
      const pw = measure(name, font);
      w += pw;
      return { e, name, pw };
    });
    w += sepW * (parts.length - 1) + 12;
    w = Math.min(ORDER.maxW, w);
    // what does not fit is cut (an ellipsis closes the strip)
    let used = 6, keep = 0;
    for (const p of parts) { if (used + p.pw > w - 10) break; used += p.pw + sepW; keep++; }
    if (keep < parts.length) parts.length = Math.max(1, keep);
    const x0 = 320 - Math.floor(w / 2);
    anchorEl(el, 'tc', x0, ORDER.y, w, ORDER.h, this.element);
    let x = x0 + 6;
    parts.forEach((p, i) => {
      if (x + p.pw > x0 + w) return;
      const cur = p.e.id === this._current;
      const color = cur ? k.sel : p.e.down ? k.tx3 : p.e.foe ? k.hp3 : k.tx1;
      txt(el, p.name, x, ORDER.y + 2, { font, color, ol: true, cls: cur ? 'lu-glaive__cur' : '' });
      x += p.pw;
      if (i < parts.length - 1 || parts.length < ring.length) {
        txt(el, sep, x, ORDER.y + 2, { font, color: k.g3, ol: true });
        x += sepW;
      }
    });
  }

  _buildLog() {
    const k = pal();
    const el = this._log;
    el.textContent = '';
    if (!this._lines.length) return;
    anchorEl(el, 'ml', LOG.x, LOG.y, LOG.w, LOG.h, this.element);
    const color = { hit: k.g4, miss: k.tx3, party: k.mp3, foe: k.hp3, note: k.tx2, good: '#9be27a', bad: k.hp2 };
    const n = this._lines.length;
    this._lines.forEach((l, i) => {
      const y = LOG.y + LOG.h - (n - i) * 13;
      const d = txt(el, fit(l.text, 'line', LOG.w - 4), LOG.x + 2, y, { font: 'line', color: color[l.kind] ?? k.tx2, ol: true });
      d.style.opacity = String(0.45 + 0.55 * ((i + 1) / n));
    });
  }
}

/**
 * Turns beats into log lines (the names through `nameOf`). Kept apart from the HUD so the tests can
 * read the same text (`state().combat.log`).
 */
export class CombatLog {
  /**
   * @param {(id: string) => string} nameOf
   * @param {(text: string, kind: string) => void} out
   * @param {(id: string) => 'party'|'foe'|null} sideOf
   */
  constructor(nameOf, out, sideOf) {
    this.nameOf = nameOf;
    this.out = out;
    this.sideOf = sideOf;
    /** @type {string[]} the last 40 lines (tests) */
    this.history = [];
    /**
     * Whose rolls show their total only (research mode: a studied foe's bonus is not observable;
     * a natural 20 or 1 shows the die instead, as its total would give the bonus away).
     * @type {(id: string) => boolean}
     */
    this.hideRoll = () => false;
  }

  /** @param {string} text @param {string} kind */
  _line(text, kind) {
    this.history.push(text);
    if (this.history.length > 40) this.history.shift();
    this.out(text, kind);
  }

  /** @param {import('./Encounter.js').Beat} b */
  beat(b) {
    const n = (id) => (id ? this.nameOf(id) : '');
    const side = this.sideOf(b.who ?? '');
    switch (b.t) {
      case 'round': this._line(t('glaive.log.round', { n: b.n }), 'note'); break;
      case 'initiative': this._line(t('glaive.log.initiative'), 'note'); break;
      case 'surprised': this._line(t('glaive.log.surprised', { who: n(b.who) }), side === 'party' ? 'bad' : 'good'); break;
      case 'attack': {
        const r = b.roll;
        const mod = r.mod >= 0 ? `+${r.mod}` : String(r.mod);
        const dice = r.dice.length > 1 ? `[${r.dice.join(',')}]` : String(r.natural);
        const key = !b.hit ? 'glaive.log.miss' : b.crit ? 'glaive.log.crit' : 'glaive.log.hit';
        const roll = !this.hideRoll(b.who ?? '') ? `${dice}${mod}=${r.total}`
          : r.crit || r.fumble ? t('glaive.log.natural', { n: r.natural })
          : String(r.total);
        this._line(t(key, { who: n(b.who), target: n(b.target), roll, ac: r.target }), b.hit ? (side === 'party' ? 'hit' : 'foe') : 'miss');
        break;
      }
      case 'damage': this._line(t('glaive.log.damage', { who: n(b.who), n: b.amount }), this.sideOf(b.who) === 'party' ? 'bad' : 'hit'); break;
      case 'heal': if (b.amount > 0) this._line(t('glaive.log.heal', { who: n(b.who), n: b.amount }), 'good'); break;
      case 'save': {
        const r = b.roll;
        this._line(t(r.success ? 'glaive.log.saveOk' : 'glaive.log.saveFail', { who: n(b.who), ability: t(`glaive.ability.${b.ability}`), total: r.total, dc: r.target }), r.success ? 'good' : 'bad');
        break;
      }
      case 'cast': this._line(t('glaive.log.cast', { who: n(b.who), spell: t(`glaive.spell.${b.spell}.name`) }), side === 'party' ? 'party' : 'foe'); break;
      case 'monsterSpell': this._line(t(`glaive.log.monster.${b.spell}`, { who: n(b.who), target: n(b.target) }), 'foe'); break;
      case 'condition': if (b.on && !['defending', 'feinting', 'rushing'].includes(b.id)) this._line(t('glaive.log.condition', { who: n(b.who), cond: t(`glaive.cond.${b.id}`) }), 'note'); break;
      case 'down': this._line(t('glaive.log.down', { who: n(b.who) }), 'bad'); break;
      case 'dead': this._line(t(side === 'party' ? 'glaive.log.slain' : 'glaive.log.dies', { who: n(b.who) }), side === 'party' ? 'bad' : 'good'); break;
      case 'up': this._line(t('glaive.log.up', { who: n(b.who) }), 'good'); break;
      case 'morale': if (b.broke) this._line(t('glaive.log.breaks', { who: n(b.who) }), 'good'); break;
      case 'talent': this._line(t('glaive.log.talent', { who: n(b.who), talent: t(`glaive.talent.${b.id}.name`) }), 'party'); break;
      case 'maneuver': this._line(t(`glaive.log.maneuver`, { who: n(b.who), move: t(`glaive.maneuver.${b.name}`) }), 'party'); break;
      case 'draught': this._line(t('glaive.log.draught', { who: n(b.who), target: n(b.target) }), 'good'); break;
      case 'lostTurn': if (b.reason !== 'surprised' && b.reason !== 'passive') this._line(t(`glaive.lost.${b.reason}`) + ` — ${n(b.who)}`, 'note'); break;
      case 'summon': this._line(t('glaive.log.summon', { who: n(b.who) }), 'foe'); break;
      case 'phase': this._line(t('glaive.log.phase', { n: b.phase }), 'foe'); break;
      case 'injury': this._line(t('glaive.log.injury', { who: n(b.who), roll: b.roll + b.bonus, result: t(`glaive.injury.${b.result}`) }), b.result === 'fine' ? 'good' : 'bad'); break;
      case 'end': this._line(t(`glaive.log.end.${b.outcome}`), b.outcome === 'victory' ? 'good' : 'bad'); break;
    }
  }
}
