/*
 * Which gases and countries to show, and where the official data comes from.
 *
 * Data is fetched live in the browser from Our World in Data's grapher API,
 * which sends `Access-Control-Allow-Origin: *`, so no server is needed.
 *  - CO2: Global Carbon Project, "Global Carbon Budget"
 *         (fossil fuels + cement, territorial, excl. land-use change)
 *  - CH4: Jones et al., "National contributions to climate change"
 *         (all sources incl. agriculture & land use, in CO2-equivalents)
 *
 * To add a country, add its ISO 3166-1 alpha-3 code (OWID uses OWID_* for aggregates).
 */
window.CO2_CONFIG = {
  apiBase: "https://ourworldindata.org/grapher/",
  gases: {
    co2: {
      label: "CO₂", long: "carbon dioxide", unit: "t CO₂", unitLong: "tonnes of CO₂",
      total:     { chart: "annual-co2-emissions-per-country", column: "emissions_total" },
      perCapita: { chart: "co-emissions-per-capita", column: "emissions_total_per_capita" },
      source: "Global Carbon Project, Global Carbon Budget",
      sourceUrl: "https://ourworldindata.org/co2-emissions"
    },
    ch4: {
      label: "Methane", long: "methane (CH₄)", unit: "t CH₄ (CO₂-eq)", unitLong: "tonnes of methane, as CO₂-equivalent",
      note: "Methane is counted in CO₂-equivalent: the CO₂ that would cause the same warming over 100 years. 1 t of methane ≈ 28 t CO₂-eq.",
      total:     { chart: "methane-emissions", column: "annual_emissions_ch4_total_co2eq" },
      perCapita: { chart: "per-capita-methane-emissions", column: "annual_emissions_ch4_total_co2eq_per_capita" },
      source: "Jones et al., National contributions to climate change",
      sourceUrl: "https://ourworldindata.org/methane-emissions"
    }
  },
  defaultGas: "co2",
  historyFrom: 2015,   // first year fetched
  trendYears: 1,       // growth trend = average annual change over the last N years (1 = latest year-on-year change)
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
