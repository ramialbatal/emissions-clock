/*
 * CO2 emissions dataset
 * ---------------------------------------------------------------
 * Fossil CO2 emissions (fossil fuels + cement), million tonnes CO2 (MtCO2)
 * for the BASE_YEAR, plus an assumed annual growth rate used to project
 * forward to the current year.
 *
 * Primary source: Global Carbon Project – Global Carbon Budget
 *   https://globalcarbonbudget.org/  (country data: https://globalcarbonbudgetdata.org/)
 * Cross-check: EDGAR (EU JRC) https://edgar.jrc.ec.europa.eu/  and Our World in Data
 *   https://ourworldindata.org/co2-emissions
 *
 * Values are rounded and approximate. To update, replace `mt` (and
 * optionally `growth`) with the latest official figures and bump BASE_YEAR.
 * Population (millions) is used only for the per-capita figure (UN WPP).
 */
window.CO2_DATA = {
  BASE_YEAR: 2024,
  source: "Global Carbon Project – Global Carbon Budget (fossil CO₂ incl. cement), rounded",
  world: { name: "World", mt: 37700, growth: 1.1, pop: 8160 },
  countries: [
    { code: "CN", flag: "🇨🇳", name: "China",          mt: 11900, growth:  0.4, pop: 1409 },
    { code: "US", flag: "🇺🇸", name: "United States",  mt:  4900, growth:  0.5, pop:  340 },
    { code: "IN", flag: "🇮🇳", name: "India",          mt:  3190, growth:  3.0, pop: 1451 },
    { code: "EU", flag: "🇪🇺", name: "European Union", mt:  2400, growth: -1.5, pop:  449 },
    { code: "RU", flag: "🇷🇺", name: "Russia",         mt:  1780, growth:  0.5, pop:  144 },
    { code: "JP", flag: "🇯🇵", name: "Japan",          mt:   960, growth: -2.5, pop:  124 },
    { code: "IR", flag: "🇮🇷", name: "Iran",           mt:   840, growth:  2.0, pop:   91 },
    { code: "ID", flag: "🇮🇩", name: "Indonesia",      mt:   810, growth:  4.0, pop:  283 },
    { code: "SA", flag: "🇸🇦", name: "Saudi Arabia",   mt:   760, growth:  1.0, pop:   34 },
    { code: "KR", flag: "🇰🇷", name: "South Korea",    mt:   580, growth: -1.0, pop:   52 },
    { code: "DE", flag: "🇩🇪", name: "Germany",        mt:   570, growth: -3.0, pop:   84 },
    { code: "CA", flag: "🇨🇦", name: "Canada",         mt:   550, growth: -0.5, pop:   41 },
    { code: "MX", flag: "🇲🇽", name: "Mexico",         mt:   490, growth:  1.0, pop:  131 },
    { code: "BR", flag: "🇧🇷", name: "Brazil",         mt:   490, growth:  1.0, pop:  212 },
    { code: "TR", flag: "🇹🇷", name: "Türkiye",        mt:   450, growth:  2.0, pop:   87 },
    { code: "ZA", flag: "🇿🇦", name: "South Africa",   mt:   390, growth: -1.0, pop:   64 },
    { code: "AU", flag: "🇦🇺", name: "Australia",      mt:   370, growth: -1.0, pop:   27 },
    { code: "GB", flag: "🇬🇧", name: "United Kingdom", mt:   290, growth: -3.5, pop:   69 }
  ],
  // Countries that are also part of an aggregate above (excluded from "sum of listed")
  partOf: { DE: "EU" }
};
