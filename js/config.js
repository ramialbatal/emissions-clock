/*
 * Which countries to show, and where the official data comes from.
 *
 * Data is fetched live in the browser from Our World in Data's grapher API,
 * which republishes the Global Carbon Project's "Global Carbon Budget"
 * (fossil CO2 incl. cement, territorial, excl. land-use change).
 * The API sends `Access-Control-Allow-Origin: *`, so no server is needed.
 *
 * To add a country, add its ISO 3166-1 alpha-3 code (OWID uses OWID_* for aggregates).
 */
window.CO2_CONFIG = {
  apiBase: "https://ourworldindata.org/grapher/",
  charts: {
    total: "annual-co2-emissions-per-country",   // tonnes CO2 / year
    perCapita: "co-emissions-per-capita"          // tonnes CO2 / person / year
  },
  sourceUrl: "https://ourworldindata.org/co2-emissions",
  historyFrom: 2015,   // first year fetched
  trendYears: 3,       // growth trend = average annual change over the last N years of data
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
