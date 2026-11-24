// @ts-check
/**
 * "What can I do?": three actions behind a button under the answer (clock-core wireActions). One for everyday life,
 * one close to home, one to ask of leaders. Each has a source; its words are the act.<key>.t / act.<key>.x keys in
 * js/i18n/*.js (every language). Keep claims to what the source says.
 */
/** @type {import("clock-core").Action[]} */
export default [
  { icon: "🚲", key: "travel", source: "IPCC, Sixth Assessment Report (2022)", url: "https://www.ipcc.ch/report/ar6/wg3/" },
  { icon: "🥕", key: "food", source: "UNEP, Food Waste Index Report 2024", url: "https://www.unep.org/resources/publication/food-waste-index-report-2024" },
  { icon: "🗳️", key: "leaders", source: "IEA, Global Methane Tracker 2024", url: "https://www.iea.org/reports/global-methane-tracker-2024" },
];
