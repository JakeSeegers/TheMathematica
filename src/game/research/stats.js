/**
 * The statistics the field ledger shows and the report checks
 * (docs/design/RESEARCH_STATISTICS_RPG.md §9). Every number on screen comes from here, so the
 * displays always match the dataset. Definitions follow OpenStax *Introductory Statistics*:
 * - percentile position i = k/100 · (n + 1) on the sorted data; a whole i takes that value, else
 *   the mean of the values at ⌊i⌋ and ⌈i⌉ (clamped to the first / last value);
 * - quartiles: the medians of the lower and upper halves (the median left out when n is odd);
 * - sample standard deviation with n − 1;
 * - the interval for a proportion p′ ± z·√(p′q′/n) (its condition: n·p′ and n·q′ above 5), the
 *   "plus four" variant, and a Wilson interval for designer checks only;
 * - the interval for a mean x̄ ± t·s/√n with n − 1 degrees of freedom;
 * - the sample size for a proportion n = z²·p′q′/E², rounded up.
 *
 * Pure functions on number / boolean arrays; nothing assumes a distribution unless its name says
 * so. Import-free and Node-safe.
 */

/** @param {number[]} xs */
function sorted(xs) {
  return [...xs].sort((a, b) => a - b);
}

/** @param {readonly unknown[]} xs */
function need(xs, min = 1) {
  if (xs.length < min) throw new Error(`needs at least ${min} value${min === 1 ? '' : 's'}`);
}

/** The sum. @param {number[]} xs */
export function sum(xs) {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

/** The mean x̄. @param {number[]} xs */
export function mean(xs) {
  need(xs);
  return sum(xs) / xs.length;
}

/** The median (the mean of the two middle values when n is even). @param {number[]} xs */
export function median(xs) {
  need(xs);
  const s = sorted(xs);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * The k-th percentile by OpenStax's position rule.
 * @param {number[]} xs
 * @param {number} k 0..100
 */
export function percentile(xs, k) {
  need(xs);
  if (!(k >= 0 && k <= 100)) throw new Error(`percentile ${k}`);
  const s = sorted(xs);
  const n = s.length;
  const i = Math.min(n, Math.max(1, (k / 100) * (n + 1)));
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? s[lo - 1] : (s[lo - 1] + s[hi - 1]) / 2;
}

/**
 * The five-number summary, the IQR and the values beyond 1.5 IQR (OpenStax's outlier rule).
 * @param {number[]} xs
 */
export function fiveNumber(xs) {
  need(xs, 2);
  const s = sorted(xs);
  const n = s.length;
  const half = n >> 1;
  const lower = s.slice(0, half);
  const upper = s.slice(n % 2 ? half + 1 : half);
  const q1 = median(lower), q3 = median(upper);
  const iqr = q3 - q1;
  const outliers = s.filter((x) => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr);
  return { min: s[0], q1, median: median(s), q3, max: s[n - 1], iqr, outliers };
}

/**
 * The standard deviation: the sample one (n − 1) by default, the population one (n) with
 * `population`.
 * @param {number[]} xs
 * @param {{ population?: boolean }} [o]
 */
export function sd(xs, { population = false } = {}) {
  need(xs, population ? 1 : 2);
  const m = mean(xs);
  let ss = 0;
  for (const x of xs) ss += (x - m) ** 2;
  return Math.sqrt(ss / (xs.length - (population ? 0 : 1)));
}

/**
 * A frequency table: each value's count, relative frequency and cumulative relative frequency
 * (values in ascending order; categories in first-seen order).
 * @template {number|string|boolean} T
 * @param {T[]} xs
 * @returns {{ value: T, count: number, relative: number, cumulative: number }[]}
 */
export function frequencyTable(xs) {
  need(xs);
  /** @type {Map<T, number>} */
  const counts = new Map();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  const keys = [...counts.keys()];
  if (keys.every((k) => typeof k === 'number')) keys.sort((a, b) => /** @type {number} */ (a) - /** @type {number} */ (b));
  let cum = 0;
  return keys.map((value) => {
    const count = /** @type {number} */ (counts.get(value));
    const relative = count / xs.length;
    cum += count;
    return { value, count, relative, cumulative: cum / xs.length };
  });
}

/**
 * Histogram bins [lo, hi) of equal width from `start` (OpenStax: start a little below the
 * smallest value; for whole numbers half a unit below). The last bin holds the maximum.
 * @param {number[]} xs
 * @param {{ start?: number, width?: number }} [o]  defaults: whole-number data → start min − 0.5, width 1
 * @returns {{ lo: number, hi: number, count: number, relative: number }[]}
 */
export function histogram(xs, { start, width } = {}) {
  need(xs);
  const s = sorted(xs);
  const whole = s.every(Number.isInteger);
  const w = width ?? (whole ? 1 : (s[s.length - 1] - s[0]) / Math.max(1, Math.ceil(Math.sqrt(s.length))) || 1);
  const st = start ?? (whole ? s[0] - 0.5 : s[0] - w * 0.01);
  if (!(w > 0)) throw new Error(`bin width ${w}`);
  if (st > s[0]) throw new Error('the first bin starts above the smallest value');
  const bins = Math.max(1, Math.floor((s[s.length - 1] - st) / w) + 1);
  const out = Array.from({ length: bins }, (_, i) => ({ lo: st + i * w, hi: st + (i + 1) * w, count: 0, relative: 0 }));
  for (const x of s) out[Math.min(bins - 1, Math.floor((x - st) / w))].count++;
  for (const b of out) b.relative = b.count / s.length;
  return out;
}

/** The sample proportion p′ = x / n of a yes / no sample. @param {boolean[]} outcomes */
export function proportion(outcomes) {
  need(outcomes);
  return outcomes.filter(Boolean).length / outcomes.length;
}

// ---------------------------------------------------------------------------------------------
// Distributions (for intervals)
// ---------------------------------------------------------------------------------------------

/**
 * The standard normal quantile (OpenStax's invNorm(p, 0, 1)); Acklam's approximation refined by
 * one Halley step (error below 1e-12).
 * @param {number} p 0 < p < 1
 */
export function invNorm(p) {
  if (!(p > 0 && p < 1)) throw new Error(`invNorm(${p})`);
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  let x;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p > 1 - lo) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else {
    const q = p - 0.5, r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  // one Halley step on the normal CDF
  const e = normCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

/** The standard normal CDF. @param {number} x */
export function normCdf(x) {
  return 0.5 * erfc(-x / Math.SQRT2);
}

/** erfc(x) = Q(½, x²) for x ≥ 0 (the regularized incomplete gamma), 2 − erfc(−x) below. @param {number} x */
function erfc(x) {
  const q = regGammaQ(0.5, x * x);
  return x >= 0 ? q : 2 - q;
}

/** ln Γ(x) (Lanczos, g = 7). @param {number} x */
function lgamma(x) {
  const g = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = g[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += g[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** The regularized upper incomplete gamma Q(a, x). @param {number} a @param {number} x */
function regGammaQ(a, x) {
  if (x <= 0) return 1;
  if (x < a + 1) {
    // series for P
    let sumv = 1 / a, term = sumv;
    for (let n = 1; n < 500; n++) {
      term *= x / (a + n);
      sumv += term;
      if (Math.abs(term) < Math.abs(sumv) * 1e-16) break;
    }
    return 1 - sumv * Math.exp(-x + a * Math.log(x) - lgamma(a));
  }
  // continued fraction for Q (Lentz)
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}

/** The regularized incomplete beta I_x(a, b) (Numerical Recipes betai / betacf). @param {number} x @param {number} a @param {number} b */
function betaI(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  const cf = (/** @type {number} */ xx, /** @type {number} */ aa, /** @type {number} */ bb) => {
    const qab = aa + bb, qap = aa + 1, qam = aa - 1;
    let c = 1, d = 1 - (qab * xx) / qap;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 300; m++) {
      const m2 = 2 * m;
      let aa2 = (m * (bb - m) * xx) / ((qam + m2) * (aa + m2));
      d = 1 + aa2 * d; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = 1 + aa2 / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; h *= d * c;
      aa2 = (-(aa + m) * (qab + m) * xx) / ((aa + m2) * (qap + m2));
      d = 1 + aa2 * d; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = 1 + aa2 / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-15) break;
    }
    return h;
  };
  return x < (a + 1) / (a + b + 2) ? (bt * cf(x, a, b)) / a : 1 - (bt * cf(1 - x, b, a)) / b;
}

/** Student's t CDF with `df` degrees of freedom. @param {number} t @param {number} df */
export function tCdf(t, df) {
  const x = df / (df + t * t);
  const tail = 0.5 * betaI(x, df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

/**
 * Student's t quantile (OpenStax's invT(p, df)): bisection on the CDF to 1e-12.
 * @param {number} p 0 < p < 1
 * @param {number} df ≥ 1
 */
export function invT(p, df) {
  if (!(p > 0 && p < 1) || !(df >= 1)) throw new Error(`invT(${p}, ${df})`);
  let lo = -1e3, hi = 1e3;
  for (let i = 0; i < 200 && hi - lo > 1e-12; i++) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------------------------
// Intervals and planning
// ---------------------------------------------------------------------------------------------

/**
 * The confidence interval for a proportion.
 * - 'normal' (taught): p′ ± z·√(p′q′/n); `conditionMet` is false when n·p′ or n·q′ is 5 or less;
 * - 'plusFour': the same on (x + 2)/(n + 4) with n + 4;
 * - 'wilson': designer checks only.
 * @param {number} x successes
 * @param {number} n trials
 * @param {{ level?: number, method?: 'normal'|'plusFour'|'wilson' }} [o] level 0..1 (0.95)
 * @returns {{ estimate: number, lo: number, hi: number, margin: number, se: number, z: number, level: number, method: string, conditionMet: boolean }}
 */
export function proportionInterval(x, n, { level = 0.95, method = 'normal' } = {}) {
  if (!(n >= 1) || !(x >= 0 && x <= n)) throw new Error(`proportion interval x=${x} n=${n}`);
  const z = invNorm(1 - (1 - level) / 2);
  const p = x / n;
  const conditionMet = n * p > 5 && n * (1 - p) > 5;
  if (method === 'wilson') {
    const den = 1 + (z * z) / n;
    const centre = (p + (z * z) / (2 * n)) / den;
    const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
    return { estimate: p, lo: centre - margin, hi: centre + margin, margin, se: Math.sqrt((p * (1 - p)) / n), z, level, method, conditionMet };
  }
  const pp = method === 'plusFour' ? (x + 2) / (n + 4) : p;
  const nn = method === 'plusFour' ? n + 4 : n;
  const se = Math.sqrt((pp * (1 - pp)) / nn);
  const margin = z * se;
  return { estimate: pp, lo: pp - margin, hi: pp + margin, margin, se, z, level, method, conditionMet };
}

/**
 * The confidence interval for a mean (Student's t, n − 1 degrees of freedom). It describes the
 * mean, not where individual values fall.
 * @param {number[]} xs
 * @param {{ level?: number }} [o]
 */
export function meanInterval(xs, { level = 0.95 } = {}) {
  need(xs, 2);
  const n = xs.length;
  const m = mean(xs);
  const s = sd(xs);
  const t = invT(1 - (1 - level) / 2, n - 1);
  const se = s / Math.sqrt(n);
  const margin = t * se;
  return { estimate: m, lo: m - margin, hi: m + margin, margin, se, t, df: n - 1, level };
}

/**
 * The sample size for estimating a proportion within margin `margin` (OpenStax: n = z²·p′q′/E²,
 * rounded up; with no guess p′ = 0.5, the largest).
 * @param {number} margin
 * @param {{ level?: number, guess?: number }} [o]
 */
export function sampleSizeForProportion(margin, { level = 0.95, guess = 0.5 } = {}) {
  if (!(margin > 0 && margin < 1)) throw new Error(`margin ${margin}`);
  const z = invNorm(1 - (1 - level) / 2);
  return Math.ceil((z * z * guess * (1 - guess)) / (margin * margin) - 1e-9);
}
