// @ts-check
/**
 * Emissions Clock: pure data and model functions (no DOM, no network). Unit tested in test/model.test.js.
 */
import { project, YEAR } from "clock-core";

/** @typedef {Record<number, number>} Series  Tonnes by year. */
/** @typedef {import("./config.js").Budget} Budget */

/**
 * Index OWID rows into { code: { name, series } } for one value column, keeping wanted codes only.
 * @param {Record<string, string>[]} rows
 * @param {string} column
 * @param {Iterable<string>} wanted
 * @returns {Record<string, { name: string, series: Series }>}
 */
export function indexEntities(rows, column, wanted) {
  const keep = new Set(wanted);
  /** @type {Record<string, { name: string, series: Series }>} */
  const out = {};
  for (const r of rows) {
    const v = parseFloat(r[column]);
    if (!keep.has(r.code) || !Number.isFinite(v)) continue;
    (out[r.code] ||= { name: r.entity, series: {} }).series[Number(r.year)] = v;
  }
  return out;
}

/**
 * "Rest of world": world minus the listed top-level countries (those not part of another listed entry).
 * @param {{ annual: number, lastValue: number, lastYear: number }} world
 * @param {{ annual: number, series: Series, partOf?: string }[]} entries
 */
export function restOfWorld(world, entries) {
  const top = entries.filter((e) => !e.partOf);
  return {
    annual: world.annual - top.reduce((s, e) => s + e.annual, 0),
    lastValue: world.lastValue - top.reduce((s, e) => s + (e.series[world.lastYear] || 0), 0),
    lastYear: world.lastYear
  };
}

/**
 * Carbon budget model.
 *  - used(t)      = total CO2 (fossil + land use) emitted since 1 January of `since` (the Paris Agreement year),
 *                   from official years and the projection for years without data.
 *  - The published remaining budget counts from 1 January of `from`, so
 *    remaining(t) = budget + emissions still to come before `from` (or minus emissions since `from`).
 *  - Bar total     = used up to `from` + budget. "Runs out" = remaining / this year's rate.
 * @param {Series} totalCo2   World total CO2 including land use, tonnes per year.
 * @param {Budget} B
 * @param {number} trendYears
 * @param {number} [year]
 */
export function budgetModel(totalCo2, B, trendYears, year = YEAR) {
  const p = project(totalCo2, trendYears, Infinity, year);
  /**
   * Tonnes emitted from 1 January of `origin` to fractional year x.
   * @param {number} origin @param {number} x
   */
  const runningTotal = (origin, x) => {
    let s = 0;
    for (let y = origin; y < Math.floor(x); y++) s += p.at(y);
    return s + p.at(Math.floor(x)) * (x - Math.floor(x));
  };
  /**
   * Tonnes emitted between fractional years a and t (negative if t is before a).
   * @param {number} a @param {number} t @returns {number}
   */
  const cum = (a, t) => {
    const origin = Math.floor(Math.min(a, t));
    return runningTotal(origin, t) - runningTotal(origin, a);
  };
  const rate = p.at(year);                                   // tonnes per year now
  const bars = B.thresholds.map((th) => {
    const total = th.gt * 1e9 + cum(B.since, B.from);
    return {
      label: th.label, total,
      /** @param {number} t */
      at(t) {
        const used = cum(B.since, t);
        const left = Math.max(total - used, 0);
        const years = left / rate;
        return { used, left, pct: Math.min(used / total, 1) * 100, years, outYear: Math.floor(t + years) };
      }
    };
  });

  // Paris pace check: straight line from the base year to a `cut` reduction in the target year.
  const P = B.paris, base = p.at(P.base);
  const needed = base * (1 - P.cut * (year - P.base) / (P.target - P.base));
  const actualCh = (rate / base - 1) * 100, neededCh = (needed / base - 1) * 100;
  const onTrack = rate <= needed;
  return {
    cum, rate, bars,
    pace: {
      base, needed, actualCh, neededCh,
      verdict: onTrack ? { cls: /** @type {const} */ ("ok"), text: "On track" }
        : actualCh < 0 ? { cls: /** @type {const} */ ("bad"), text: "Off track" }
        : { cls: /** @type {const} */ ("bad"), text: "Going the wrong way" }
    }
  };
}
