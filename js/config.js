// @ts-check
/**
 * Emissions Clock settings: gases, data sources, countries and the carbon budget.
 * Change things here first; the code reads everything from this object.
 *
 * Data is fetched live in the browser from Our World in Data's grapher API,
 * which sends `Access-Control-Allow-Origin: *`, so no server is needed.
 *  - CO2: Global Carbon Project, "Global Carbon Budget"
 *         (fossil fuels + cement, territorial, excl. land-use change)
 *  - CH4: Jones et al., "National contributions to climate change"
 *         (all sources incl. agriculture & land use, in CO2-equivalents)
 *
 * To add a country, add { code, flag } to `countries` (ISO 3166-1 alpha-3 code; OWID uses OWID_* for aggregates;
 * the name comes from the data, or set `name`), then add it to the country list in llms.txt.
 */

/**
 * @typedef {{ chart: string, column: string }} Chart
 * @typedef {{ label: string, inText: string, long: string, unit: string, unitLong: string, note?: string, hash: string,
 *   total: Chart, perCapita: Chart, source: string, sourceUrl: string }} Gas
 * @typedef {{ code: string, flag: string, name?: string, partOf?: string }} Country
 * @typedef {{ label: string, gt: number }} Threshold
 * @typedef {{ chart: string, column: string, from: number, since: number, thresholds: Threshold[],
 *   source: string, sourceUrl: string, paris: { base: number, target: number, cut: number } }} Budget
 * @typedef {{ apiBase: string, gases: Record<"co2" | "ch4", Gas>, budget: Budget, defaultGas: "co2" | "ch4",
 *   historyFrom: number, trendYears: number, maxGrowth: number, world: string, countries: Country[] }} Config
 */

/** @type {Config} */
export default {
  apiBase: "https://ourworldindata.org/grapher/",
  gases: {
    co2: {
      hash: "",             // URL hash that opens this view ("" = plain URL)
      label: "CO₂",
      inText: "CO₂",         // how the gas is named inside a sentence
      long: "carbon dioxide", unit: "t CO₂", unitLong: "tonnes of CO₂",
      total:     { chart: "annual-co2-emissions-per-country", column: "emissions_total" },
      perCapita: { chart: "co-emissions-per-capita", column: "emissions_total_per_capita" },
      source: "Global Carbon Project, Global Carbon Budget",
      sourceUrl: "https://ourworldindata.org/co2-emissions"
    },
    ch4: {
      hash: "#methane",
      label: "Methane",
      inText: "methane", long: "methane (CH₄)", unit: "t CH₄ (CO₂-eq)", unitLong: "tonnes of methane, as CO₂-equivalent",
      note: "Methane is counted in CO₂-equivalent: the CO₂ that would cause the same warming over 100 years. 1 t of methane ≈ 28 t CO₂-eq.",
      total:     { chart: "methane-emissions", column: "annual_emissions_ch4_total_co2eq" },
      perCapita: { chart: "per-capita-methane-emissions", column: "annual_emissions_ch4_total_co2eq_per_capita" },
      source: "Jones et al., National contributions to climate change",
      sourceUrl: "https://ourworldindata.org/methane-emissions"
    }
  },
  // UPDATE EVERY NOVEMBER: when the Global Carbon Project publishes its new edition, change `thresholds` (gt),
  // `from` (start of the year after the edition), `source`, `sourceUrl` and this comment's figures below,
  // plus the edition named in README.md.
  // Carbon budget bars (CO2 view). Figures from the Global Carbon Budget 2026 key messages:
  // remaining budgets (50% likelihood) of 150, 510 and 1035 GtCO2 for 1.5, 1.7 and 2 degrees,
  // counted from the start of 2027 (the convention of each yearly edition).
  // Used = total CO2 (fossil + land-use change) since the Paris Agreement year.
  budget: {
    chart: "annual-co2-including-land-use", column: "emissions_total_including_land_use_change",
    from: 2027,
    since: 2016,
    thresholds: [
      { label: "1.5°C", gt: 150 },
      { label: "1.7°C", gt: 510 },
      { label: "2°C", gt: 1035 }
    ],
    source: "Global Carbon Budget 2026",
    sourceUrl: "https://globalcarbonbudget.org/fossil-co2-emissions-decrease-in-2026/",
    // IPCC AR6: for 1.5°C, net CO2 must fall about 48% from 2019 to 2030.
    paris: { base: 2019, target: 2030, cut: 0.48 }
  },
  defaultGas: "co2",
  historyFrom: 2015,   // first year fetched
  trendYears: 1,       // growth trend = average annual change over the last N years (1 = latest year-on-year change)
  maxGrowth: 0.2,      // cap on the yearly growth used for projecting (20%): data for some places is two years old
  world: "OWID_WRL",
  countries: [
    { code: "CHN", flag: "🇨🇳" },
    { code: "USA", flag: "🇺🇸" },
    { code: "IND", flag: "🇮🇳" },
    { code: "OWID_EU27", flag: "🇪🇺", name: "European Union" },
    { code: "RUS", flag: "🇷🇺" },
    { code: "JPN", flag: "🇯🇵" },
    { code: "IRN", flag: "🇮🇷" },
    { code: "IDN", flag: "🇮🇩" },
    { code: "SAU", flag: "🇸🇦" },
    { code: "KOR", flag: "🇰🇷" },
    { code: "DEU", flag: "🇩🇪", partOf: "EU" },
    { code: "CAN", flag: "🇨🇦" },
    { code: "MEX", flag: "🇲🇽" },
    { code: "BRA", flag: "🇧🇷" },
    { code: "TUR", flag: "🇹🇷" },
    { code: "ZAF", flag: "🇿🇦" },
    { code: "AUS", flag: "🇦🇺" },
    { code: "GBR", flag: "🇬🇧" }
  ]
};
