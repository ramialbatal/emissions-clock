// @ts-check
/**
 * Emissions Clock: pure model functions (no DOM, no network). Unit tested in test/model.test.js.
 * Parsing uses clock-core's seriesByCode / namesByCode; this file holds only what is specific to emissions.
 */
import { project, verdict, shown, YEAR } from "clock-core";

/** @typedef {Record<number, number>} Series  Tonnes by year. */
/** @typedef {import("./config.js").Budget} Budget */

/**
 * "Rest of world": world minus the listed top-level countries (those not part of another listed entry).
 * A country whose data ends before the world's latest year counts with its projected value for that year,
 * so it isn't silently attributed to the rest of the world.
 * @param {{ annual: number, lastValue: number, lastYear: number }} world
 * @param {{ annual: number, at: (year: number) => number, partOf?: string }[]} entries
 */
export function restOfWorld(world, entries) {
  const top = entries.filter((e) => !e.partOf);
  return {
    annual: world.annual - top.reduce((s, e) => s + e.annual, 0),
    lastValue: world.lastValue - top.reduce((s, e) => s + e.at(world.lastYear), 0),
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
 *  - Pace check: a straight line from the base year to a `cut` reduction in the target year; compares this
 *    year's change since the base year (as displayed, 1 decimal) with where that line is now (as displayed, 0 decimals).
 * @param {Series} totalCo2   World total CO2 including land use, tonnes per year.
 * @param {Budget} B
 * @param {number} trendYears
 * @param {number} [maxGrowth]
 * @param {number} [year]
 */
export function budgetModel(totalCo2, B, trendYears, maxGrowth = Infinity, year = YEAR) {
  const p = project(totalCo2, trendYears, maxGrowth, year);
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
      /** @param {number} t fractional year */
      at(t) {
        const used = cum(B.since, t);
        const left = Math.max(total - used, 0);
        const years = left / rate;
        return {
          used, left, years, pct: Math.min(used / total, 1) * 100, outYear: Math.floor(t + years),
          danger: shown(years, 1) < 10     // compared as displayed ("about 10.0 years" is not red)
        };
      }
    };
  });

  const P = B.paris, base = p.at(P.base);
  const neededCh = shown(-P.cut * 100 * (year - P.base) / (P.target - P.base), 0);
  const actualCh = shown((rate / base - 1) * 100, 1);
  return {
    cum, rate, bars,
    pace: { base, needed: base * (1 + neededCh / 100), actualCh, neededCh, verdict: verdict(actualCh, neededCh) }
  };
}
