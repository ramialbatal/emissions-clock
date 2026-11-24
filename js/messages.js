// @ts-check
/**
 * Emissions Clock: the plain-language messages shown to visitors. Pure functions, unit tested.
 * Every message has a tone ("ok", "warn" or "bad": green, amber or red), a short title and, where useful, one
 * sentence. Keep them short, concrete and free of jargon; numbers and method details belong behind "More".
 */
import { shown, shownSign, fmt } from "clock-core";

/** @typedef {"ok" | "warn" | "bad"} Tone */
/** @typedef {{ tone: Tone, icon: string, title: string, text?: string }} Message */

/** @type {Record<Tone, string>} */
export const ICON = { ok: "🟢", warn: "🟠", bad: "🔴" };

/**
 * The one-line answer at the top of the CO₂ view, from the Paris pace verdict.
 * @param {string} paceText  verdict text from the model ("On track", "Close", "Off track", "Going backwards")
 * @returns {Message}
 */
export function co2Headline(paceText) {
  switch (paceText) {
    case "On track": return { tone: "ok", icon: ICON.ok, title: "We're on track",
      text: "The world's CO₂ emissions are falling fast enough to keep the Paris goal in reach." };
    case "Close": return { tone: "warn", icon: ICON.warn, title: "Almost on track",
      text: "Emissions are falling, nearly fast enough. A little more effort keeps the Paris goal in reach." };
    case "Off track": return { tone: "warn", icon: ICON.warn, title: "Falling, but far too slowly",
      text: "Emissions are coming down, but not nearly fast enough to keep warming under control." };
    default: return { tone: "bad", icon: ICON.bad, title: "We're heading the wrong way",
      text: "The world still releases more CO₂ than a few years ago. To keep warming under control, it needs to fall fast." };
  }
}

/**
 * The one-line answer at the top of the methane view, from the world's yearly trend.
 * @param {number} growth  yearly change (0.01 = +1%)
 * @returns {Message}
 */
export function methaneHeadline(growth) {
  const s = shownSign(growth * 100, 1);
  if (s < 0) return { tone: "ok", icon: ICON.ok, title: "Methane is falling",
    text: "Good news: cutting methane is the fastest way to slow warming in the next few years." };
  if (s === 0) return { tone: "warn", icon: ICON.warn, title: "Methane isn't falling yet",
    text: "Methane traps a lot of heat. Cutting it is the fastest way to slow warming." };
  return { tone: "bad", icon: ICON.bad, title: "Methane is still rising",
    text: "Methane traps a lot of heat. Cutting it is the fastest way to slow warming, but it keeps going up." };
}

/**
 * Status of a carbon budget (how much CO₂ is left before a warming limit), from the years left at today's pace.
 * @param {number} years  years left, as from the model
 * @returns {Message}
 */
export function budgetStatus(years) {
  const y = shown(years, 1);
  const left = y <= 0 ? "Nothing left at today's pace" : `About ${fmt[1].format(y)} years left at today's pace`;
  if (y <= 0) return { tone: "bad", icon: ICON.bad, title: "Used up", text: left };
  if (y < 5) return { tone: "bad", icon: ICON.bad, title: "Almost used up", text: left };
  if (y < 15) return { tone: "warn", icon: ICON.warn, title: "Running out", text: left };
  return { tone: "warn", icon: ICON.warn, title: "Some room left", text: left };
}

/**
 * "Are emissions falling fast enough?", from the Paris pace check.
 * @param {string} paceText   verdict text from the model
 * @param {number} actualCh   change since the base year, % as displayed (2.8 = 2.8% higher)
 * @param {number} neededCh   where it should be by now, % as displayed (-31 = 31% lower)
 * @param {number} baseYear
 * @returns {Message}
 */
export function paceStatus(paceText, actualCh, neededCh, baseYear) {
  const should = `They should be ${fmt[0].format(Math.abs(neededCh))}% lower than in ${baseYear} by now.`;
  const actual = actualCh > 0 ? `They're ${fmt[1].format(actualCh)}% higher.`
    : actualCh < 0 ? `They're ${fmt[1].format(-actualCh)}% lower.` : "They're about the same.";
  const text = `${should} ${actual}`;
  switch (paceText) {
    case "On track": return { tone: "ok", icon: ICON.ok, title: "Yes, fast enough", text };
    case "Close": return { tone: "warn", icon: ICON.warn, title: "Almost fast enough", text };
    case "Off track": return { tone: "warn", icon: ICON.warn, title: "Falling, too slowly", text };
    default: return { tone: "bad", icon: ICON.bad, title: "No, still rising", text };
  }
}

/**
 * A country's direction, for the badge on its card: rising emissions are bad, falling are good.
 * @param {number | null} growth  yearly change (0.01 = +1%), or null when unknown
 * @returns {{ tone: Tone | "", label: string }}
 */
export function trendBadge(growth) {
  if (growth == null) return { tone: "", label: "" };
  const s = shownSign(growth * 100, 1);
  return s > 0 ? { tone: "bad", label: "▲ Rising" } : s < 0 ? { tone: "ok", label: "▼ Falling" } : { tone: "warn", label: "● Steady" };
}
