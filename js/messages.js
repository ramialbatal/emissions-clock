// @ts-check
/**
 * Emissions Clock: the plain-language messages shown to visitors. Pure functions, unit tested.
 * Every message has a tone ("ok", "warn" or "bad": green, amber or red), a short title and, where useful, one
 * sentence. Keep them short, concrete and free of jargon; numbers and method details belong behind "More".
 */
import { shown, shownSign, fmt, pct, message, t, addStrings } from "clock-core";
import en from "./i18n/en.js";

addStrings("en", en);   // the English words; app.js adds the visitor's language on top

/** @typedef {import("clock-core").Tone} Tone */
/** @typedef {import("clock-core").Message} Message */
/** @typedef {import("clock-core").Verdict["key"]} PaceKey  "onTrack", "close", "offTrack" or "backwards" */

/**
 * The one-line answer at the top of the CO₂ view, from the Paris pace verdict.
 * @param {PaceKey} pace  verdict key from the model
 * @returns {Message}
 */
export function co2Headline(pace) {
  const k = pace === "onTrack" || pace === "close" || pace === "offTrack" ? pace : "backwards";
  const tone = k === "onTrack" ? "ok" : k === "backwards" ? "bad" : "warn";
  return message(tone, t(`msg.co2.${k}.t`), t(`msg.co2.${k}.x`));
}

/**
 * The one-line answer at the top of the methane view, from the world's yearly trend.
 * @param {number} growth  yearly change (0.01 = +1%)
 * @returns {Message}
 */
export function methaneHeadline(growth) {
  const s = shownSign(growth * 100, 1);
  const [tone, k] = s < 0 ? ["ok", "down"] : s === 0 ? ["warn", "flat"] : ["bad", "up"];
  return message(/** @type {Tone} */ (tone), t(`msg.ch4.${k}.t`), t(`msg.ch4.${k}.x`));
}

/**
 * Status of a carbon budget (how much CO₂ is left before a warming limit), from the years left at today's pace.
 * @param {number} years  years left, as from the model
 * @returns {Message}
 */
export function budgetStatus(years) {
  const y = shown(years, 1);
  const left = y <= 0 ? t("msg.budget.none") : t("msg.budget.left", { years: fmt[1].format(y) });
  if (y <= 0) return message("bad", t("msg.budget.usedUp"), left);
  if (y < 5) return message("bad", t("msg.budget.almost"), left);
  if (y < 15) return message("warn", t("msg.budget.running"), left);
  return message("warn", t("msg.budget.room"), left);
}

/**
 * "Are emissions falling fast enough?", from the Paris pace check.
 * @param {PaceKey} pace      verdict key from the model
 * @param {number} actualCh   change since the base year, % as displayed (2.8 = 2.8% higher)
 * @param {number} neededCh   where it should be by now, % as displayed (-31 = 31% lower)
 * @param {number} baseYear
 * @returns {Message}
 */
export function paceStatus(pace, actualCh, neededCh, baseYear) {
  const should = t("msg.pace.should", { pct: pct(Math.abs(neededCh), 0), year: baseYear });
  const actual = actualCh > 0 ? t("msg.pace.higher", { pct: pct(actualCh, 1) })
    : actualCh < 0 ? t("msg.pace.lower", { pct: pct(-actualCh, 1) }) : t("msg.pace.same");
  const text = `${should} ${actual}`;
  const k = pace === "onTrack" || pace === "close" || pace === "offTrack" ? pace : "backwards";
  const tone = k === "onTrack" ? "ok" : k === "backwards" ? "bad" : "warn";
  return message(tone, t(`msg.pace.${k}`), text);
}

/**
 * A country's direction, for the badge on its card: rising emissions are bad, falling are good.
 * @param {number | null} growth  yearly change (0.01 = +1%), or null when unknown
 * @returns {{ tone: Tone | "", label: string }}
 */
export function trendBadge(growth) {
  if (growth == null) return { tone: "", label: "" };
  const s = shownSign(growth * 100, 1);
  return s > 0 ? { tone: "bad", label: t("msg.badge.up") } : s < 0 ? { tone: "ok", label: t("msg.badge.down") } : { tone: "warn", label: t("msg.badge.flat") };
}
