// @ts-check
/**
 * Emissions Clock: loads the data, renders the page and runs the live counters.
 * Calculations live in model.js (pure, tested); settings in config.js.
 */
import * as C from "clock-core";
import CFG from "./config.js";
import { indexEntities, restOfWorld, budgetModel } from "./model.js";

const { YEAR, fmt, setText, escapeHtml } = C;
/** @param {string} id */
const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
/** @typedef {keyof typeof CFG.gases} GasKey */
/** @typedef {import("./config.js").Gas} Gas */

const codes = [CFG.world, ...CFG.countries.map((c) => c.code)];

// ---- Data ------------------------------------------------------------------------
/**
 * OWID chart URL for the configured countries. These single-column charts are safe to filter in the URL
 * (see lessons learned in clock-core about multi-column charts); rows are still filtered by code.
 * @param {string} slug @param {string[]} codeList @param {number} from
 */
function chartUrl(slug, codeList, from) {
  const q = new URLSearchParams({ v: "1", csvType: "filtered", useColumnShortNames: "true", tab: "chart", time: `${from}..latest` });
  return `${CFG.apiBase}${slug}.csv?${q}&country=~${codeList.join("~")}`;   // "~" must not be percent-encoded
}

/** @type {Partial<Record<GasKey, () => Promise<{ total: ReturnType<typeof indexEntities>, perCap: ReturnType<typeof indexEntities>, fetchedAt: Date }>>>} */
const loaders = {};
/** @param {GasKey} key */
function loadGas(key) {
  return (loaders[key] ||= C.once(async () => {
    const gas = CFG.gases[key];
    const [totalRows, pcRows] = await Promise.all([
      C.fetchCsv(chartUrl(gas.total.chart, codes, CFG.historyFrom)),
      C.fetchCsv(chartUrl(gas.perCapita.chart, codes, CFG.historyFrom))
    ]);
    const total = indexEntities(totalRows, gas.total.column, codes);
    if (!total[CFG.world]) throw new Error("World total missing from response");
    const missing = CFG.countries.filter((c) => !total[c.code]).map((c) => c.code);
    if (missing.length) console.warn("No data returned for:", missing.join(", "));
    return { total, perCap: indexEntities(pcRows, gas.perCapita.column, codes), fetchedAt: new Date() };
  }))();
}

// Total CO2 including land use, for the carbon budget bars. Optional: if it fails, the section stays hidden.
const loadBudget = C.once(async () => {
  const B = CFG.budget;
  const rows = await C.fetchCsv(chartUrl(B.chart, [CFG.world], B.since - 3));
  const series = indexEntities(rows, B.column, [CFG.world])[CFG.world]?.series;
  if (!series) throw new Error("No total CO2 series");
  return series;
});

// ---- Rendering helpers ---------------------------------------------------------------
/** @param {number} annual tonnes per year */
const perSecond = (annual) => annual / C.SEC_PER_YEAR;

/** 12.42 Gt / 573 Mt / 48.2 Mt: keeps small methane figures readable. @param {number} t tonnes */
function mass(t) {
  if (Math.abs(t) >= 1e9) return fmt[2].format(t / 1e9) + " Gt";
  return (Math.abs(t) >= 1e8 ? fmt[0] : fmt[1]).format(t / 1e6) + " Mt";
}

/** @param {C.Projection} e */
function sparkFor(e) {
  const vals = e.years.map((y) => e.series[y]);
  const first = e.years[0], last = e.years[e.years.length - 1];
  const change = (vals[vals.length - 1] / vals[0] - 1) * 100;
  return C.sparkline(e.years, vals, {
    caption: `${first}-${String(last).slice(2)}`, change, changeText: C.signed(change) + "%", good: "down"
  });
}

/** @param {C.Projection} e */
function historyTable(e) {
  const rows = e.years.slice().reverse().map((y) => {
    const prev = e.series[y - 1];
    const ch = prev ? (e.series[y] / prev - 1) * 100 : null;
    return `<tr><th>${y}</th><td>${mass(e.series[y])}</td><td class="${
      ch == null ? "" : ch > 0 ? "bad" : ch < 0 ? "good" : ""}">${ch == null ? "" : C.signed(ch, fmt[1]) + "%"}</td></tr>`;
  }).join("");
  return `<div class="history" hidden><table><caption>Official annual emissions</caption>${rows}</table></div>`;
}

// ---- Page ------------------------------------------------------------------------------
const T0 = Date.now();   // page-open time, shared by both gases

/**
 * @param {Awaited<ReturnType<typeof loadGas>>} data
 * @param {Gas} gas
 */
function render(data, gas) {
  const world = C.project(data.total[CFG.world].series, CFG.trendYears);
  const wRate = perSecond(world.annual);

  const entries = CFG.countries.filter((c) => data.total[c.code]).map((c) => {
    const e = C.project(data.total[c.code].series, CFG.trendYears);
    const pcs = data.perCap[c.code]?.series;
    return { ...c, ...e, name: c.name || data.total[c.code].name, perCap: pcs ? pcs[e.lastYear] ?? null : null, rest: false, hasSeries: true };
  });
  const row = restOfWorld(world, entries);
  const all = [...entries, { code: "ROW", flag: "🌐", name: "Rest of world", rest: true, partOf: undefined, hasSeries: false,
    ...row, growth: null, perCap: null }];

  C.fill("latest", world.lastYear);
  C.fill("first", world.years[0]);
  C.fill("trend-from", world.trendFrom);
  $("world-rate").textContent = fmt[0].format(wRate);
  $("world-annual").textContent = fmt[2].format(world.annual / 1e9);
  $("world-official").textContent = fmt[2].format(world.lastValue / 1e9);
  $("world-growth").textContent = C.signed(world.growth * 100, fmt[1]) + "%";

  const grid = $("grid");
  grid.innerHTML = "";
  const cards = all.map((e) => {
    const share = (e.annual / world.annual) * 100;
    const g = e.growth;
    const el = document.createElement("article");
    el.className = "card" + (e.rest ? " rest" : "");
    el.innerHTML = `
      <header>
        <span class="flag" aria-hidden="true">${e.flag}</span>
        <h3>${escapeHtml(e.name)}</h3>
        ${e.partOf ? `<span class="tag">part of ${escapeHtml(e.partOf)}</span>` : ""}
        ${e.hasSeries ? sparkFor(/** @type {C.Projection} */ (e)) : ""}
      </header>
      <div class="ytd"><span class="num">0</span> <small>${escapeHtml(gas.unit)} in ${YEAR}</small></div>
      <div class="bar" title="${fmt[1].format(share)}% of world"><i style="width:${Math.min(share * 2.5, 100)}%"></i></div>
      <dl>
        <div><dt>Share of world</dt><dd>${fmt[1].format(share)}%</dd></div>
        <div><dt>Per second</dt><dd>${(perSecond(e.annual) < 10 ? fmt[1] : fmt[0]).format(perSecond(e.annual))} t</dd></div>
        <div><dt>${e.lastYear} official</dt><dd>${mass(e.lastValue)}</dd></div>
        <div><dt>${YEAR} projected</dt><dd>${mass(e.annual)}</dd></div>
        <div><dt>Per person / yr</dt><dd>${e.perCap != null ? fmt[1].format(e.perCap) + " t" : "n/a"}</dd></div>
        <div><dt>Trend / yr</dt><dd class="${g == null ? "" : g > 0 ? "bad" : g < 0 ? "good" : ""}">${
          g == null ? "n/a" : (g > 0 ? "▲ +" : g < 0 ? "▼ " : "") + fmt[1].format(g * 100) + "%"}</dd></div>
        <div class="wide"><dt>Since you opened this page</dt><dd class="since">0 t</dd></div>
      </dl>
      ${e.hasSeries ? `<button type="button" class="more" aria-expanded="false">Yearly data <span aria-hidden="true">▾</span></button>${historyTable(/** @type {C.Projection} */ (e))}` : ""}`;
    C.wireHistory(el);
    grid.appendChild(el);
    return { e, el, num: el.querySelector(".num"), since: el.querySelector(".since"), rate: perSecond(e.annual) };
  });

  const sortSel = /** @type {HTMLSelectElement} */ ($("sort"));
  /** @type {Record<string, (c: typeof cards[number]) => number | string>} */
  const keys = {
    total: (c) => c.e.annual,
    percap: (c) => c.e.perCap ?? -1,
    growth: (c) => c.e.growth ?? -99,
    name: (c) => c.e.name
  };
  const sortCards = () => C.sortInto(grid, cards, keys[sortSel.value]);
  sortSel.onchange = sortCards;
  sortCards();

  C.startTicker((now) => {
    const frac = C.yearFraction(now), elapsed = (now - T0) / 1000;
    setText($("world-num"), C.digits(fmt[0].format(world.annual * frac)), true);
    setText($("world-since"), fmt[0].format(wRate * elapsed));
    setText($("world-pct"), fmt[2].format(frac * 100));
    $("world-bar").style.width = frac * 100 + "%";
    for (const c of cards) {
      setText(c.num, fmt[0].format(c.e.annual * frac));
      setText(c.since, fmt[0].format(c.rate * elapsed) + " t");
    }
    budgetTick?.(C.tYears(now));
  });
}

// ---- Carbon budget section -------------------------------------------------------------
/** @type {((t: number) => void) | null} */
let budgetTick = null;

/** @param {Record<number, number>} series */
function renderBudget(series) {
  const B = CFG.budget;
  const m = budgetModel(series, B, CFG.trendYears);
  $("budget-bars").innerHTML = m.bars.map((b) => `
    <div class="goal-row">
      <div class="goal-top"><b>${escapeHtml(b.label)}</b><span class="goal-num">0%</span> <span class="goal-unit">used</span>
        <span class="goal-side"></span></div>
      <div class="goal-bar"><i></i></div>
      <p class="goal-note"></p>
    </div>`).join("");
  const rows = [...$("budget-bars").querySelectorAll(".goal-row")].map((el) => ({
    el, num: el.querySelector(".goal-num"), side: el.querySelector(".goal-side"), note: el.querySelector(".goal-note"),
    bar: /** @type {HTMLElement} */ (el.querySelector(".goal-bar > i"))
  }));

  const P = B.paris, pace = m.pace;
  C.fill("bud-since", B.since);
  C.fill("bud-from", B.from);
  C.fill("bud-source", B.source);
  C.fill("paris-base", P.base);
  C.fill("paris-target", P.target);
  $("pace-target").textContent = fmt[0].format(P.cut * 100) + "%";
  $("pace-needed").textContent = fmt[0].format(Math.abs(pace.neededCh)) + "%";
  $("pace-actual").textContent = C.signed(pace.actualCh, fmt[1]) + "%";
  C.showVerdict($("pace-verdict"), pace.verdict);
  const span = Math.max(pace.base * 1.15, m.rate);
  $("pace-bar-actual").style.width = (m.rate / span) * 100 + "%";
  $("pace-bar-needed").style.left = (pace.needed / span) * 100 + "%";
  $("budget").hidden = false;

  /** @param {number} t */
  return (t) => m.bars.forEach((b, i) => {
    const s = b.at(t), r = rows[i];
    setText(r.num, fmt[3].format(s.pct) + "%");
    r.bar.style.width = s.pct + "%";
    setText(r.side, fmt[0].format(s.left) + " t left");   // tonnes, so it visibly ticks down
    setText(r.note, s.left <= 0 ? "Used up." : `Runs out in about ${fmt[1].format(s.years)} years (${s.outYear}) at today's rate.`);
    r.el.classList.toggle("danger", s.years < 10);
  });
}

loadBudget().then((series) => { budgetTick = renderBudget(series); })
  .catch((err) => console.error("Carbon budget data unavailable:", err));

// ---- Boot and gas switching ---------------------------------------------------------------
/** @param {GasKey} key */
function applyGasLabels(key) {
  const gas = CFG.gases[key];
  document.body.dataset.gas = key;
  document.title = `Live ${gas.label} Emissions Clock: World and Countries in Real Time`;
  C.fill("gas-label", gas.label);
  C.fill("gas-long", gas.long);
  C.fill("gas-unit", gas.unitLong);
  C.fill("gas-note", gas.note || "");
  C.fill("gas-source", gas.source);
  document.querySelectorAll("[data-gas-source-url]").forEach((el) => { /** @type {HTMLAnchorElement} */ (el).href = gas.sourceUrl; });
  document.querySelectorAll(".gas-switch button").forEach((b) =>
    b.setAttribute("aria-pressed", String(/** @type {HTMLElement} */ (b).dataset.gas === key)));
}

/** @type {GasKey | null} */
let current = null;
/** @param {string} key */
async function show(key) {
  const k = /** @type {GasKey} */ (key in CFG.gases ? key : CFG.defaultGas);
  current = k;
  applyGasLabels(k);
  if (document.body.dataset.state !== "ready") C.setState("loading");
  try {
    const data = await loadGas(k);
    if (current !== k) return;   // switched again while loading
    render(data, CFG.gases[k]);
    $("fetched-at").textContent = data.fetchedAt.toLocaleString();
    C.setState("ready");
  } catch (err) {
    if (current !== k) return;
    console.error(err);
    C.stopTicker();
    C.setState("error", err instanceof Error ? err.message : String(err));
  }
}

const fromHash = () => (location.hash === "#methane" ? "ch4" : "co2");
document.querySelectorAll(".gas-switch button").forEach((b) => b.addEventListener("click", () => {
  const gas = /** @type {HTMLElement} */ (b).dataset.gas ?? CFG.defaultGas;
  history.replaceState(null, "", location.pathname + location.search + (gas === "ch4" ? "#methane" : ""));
  show(gas);
}));
window.addEventListener("hashchange", () => show(fromHash()));

C.wireHelp();
C.fill("year", YEAR);
$("retry").addEventListener("click", () => { C.setState("loading"); show(current ?? CFG.defaultGas); });
show(fromHash());
