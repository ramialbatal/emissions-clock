// @ts-check
/**
 * Emissions Clock: loads the data, renders the page and runs the live counters.
 * Calculations live in model.js (pure, tested); settings in config.js.
 *
 * The picture behind the header is in scene.js.
 *
 * Sections: Data · Rendering helpers · Page (render) · Carbon budget · Boot and gas switching.
 */
import * as C from "clock-core";
import CFG from "./config.js";
import actions from "./actions.js";
import { budgetModel } from "./model.js";
import { co2Headline, methaneHeadline, budgetStatus, paceStatus, trendBadge } from "./messages.js";
import { emissionsScene } from "./scene.js";

const { YEAR, fmt, setText, escapeHtml, t } = C;
/** @param {string} id */
const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
/** @typedef {keyof typeof CFG.gases} GasKey */
/** @typedef {import("./config.js").Gas} Gas */

const codes = [CFG.world, ...CFG.countries.map((c) => c.code)];

// ---- Data ------------------------------------------------------------------------
/**
 * OWID chart URL for some countries. These single-column charts are safe to filter in the URL
 * (see clock-core's lessons learned about multi-column charts); rows are still filtered by code.
 * @param {string} slug @param {string[]} codeList @param {number} from
 */
function chartUrl(slug, codeList, from) {
  const q = new URLSearchParams({ v: "1", csvType: "filtered", useColumnShortNames: "true", tab: "chart", time: `${from}..latest` });
  return `${CFG.apiBase}${slug}.csv?${q}&country=~${codeList.join("~")}`;   // "~" must not be percent-encoded
}

/**
 * @typedef {{ total: Record<string, C.Series>, perCap: Record<string, C.Series>, names: Record<string, string>, fetchedAt: Date }} GasData
 */
/** @type {Partial<Record<GasKey, () => Promise<GasData>>>} */
const loaders = {};
/** Gases whose data has loaded successfully (their views can switch without a spinner). */
const loaded = new Set();

/** @param {GasKey} key */
function loadGas(key) {
  return (loaders[key] ||= C.once(async () => {
    const gas = CFG.gases[key];
    const [totalRows, pcRows] = await Promise.all([
      C.fetchCsv(chartUrl(gas.total.chart, codes, CFG.historyFrom)),
      C.fetchCsv(chartUrl(gas.perCapita.chart, codes, CFG.historyFrom))
    ]);
    const cols = { code: "code", year: "year", wanted: codes };
    const total = C.seriesByCode(totalRows, { ...cols, value: gas.total.column });
    if (!total[CFG.world]) throw new Error("World total missing from response");
    const missing = CFG.countries.filter((c) => !total[c.code]).map((c) => c.code);
    if (missing.length) console.warn("No emissions data for:", missing.join(", "));
    return {
      total,
      perCap: C.seriesByCode(pcRows, { ...cols, value: gas.perCapita.column }),
      names: C.namesByCode(totalRows, { code: "code", name: "entity", wanted: codes }),
      fetchedAt: new Date()
    };
  }))();
}

// Total CO2 including land use, for the carbon budget bars. Optional: if it fails, the section stays hidden.
const loadBudget = C.once(async () => {
  const B = CFG.budget;
  const rows = await C.fetchCsv(chartUrl(B.chart, [CFG.world], B.since - 3));
  const series = C.seriesByCode(rows, { code: "code", year: "year", value: B.column, wanted: [CFG.world] })[CFG.world];
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

/** For emissions, down is good. @param {number} x @param {number} d decimals shown */
const goodBadClass = (x, d) => C.changeClass(x, d, "down");

/** @param {C.Projection} e @param {string} name */
function sparkFor(e, name) {
  const vals = e.years.map((y) => e.series[y]);
  const first = e.years[0], last = e.years[e.years.length - 1];
  const change = (vals[vals.length - 1] / vals[0] - 1) * 100;
  return C.sparkline(e.years, vals, {
    caption: `${first}-${String(last).slice(2)}`, change, changeText: C.signedPct(change, 0), good: "down",
    label: t("a.spark", { name, first, last, change: C.signedPct(change, 0) })
  });
}

/** @param {C.Projection} e */
function historyTable(e) {
  const rows = e.years.slice().reverse().map((y) => {
    const prev = e.series[y - 1];
    const ch = prev ? (e.series[y] / prev - 1) * 100 : null;
    return `<tr><th>${y}</th><td>${mass(e.series[y])}</td><td class="${ch == null ? "" : goodBadClass(ch, 1)}">${
      ch == null ? "" : C.signedPct(ch, 1)}</td></tr>`;
  }).join("");
  return `<div class="history" hidden><table><caption>${t("a.history")}</caption>${rows}</table></div>`;
}


// ---- The answer at the top --------------------------------------------------------------
/** Pace verdict from the carbon budget model, once it has loaded (the CO₂ answer depends on it). */
/** @type {import("clock-core").Verdict["key"]} */
let paceKey = "";

const showAnswer = C.showAnswer;

/**
 * The answer for the current view. CO₂: from the Paris pace check (or, until the budget data arrives, from the
 * world's yearly trend). Methane: from the world's yearly trend.
 * @param {GasKey} key @param {number} worldGrowth
 */
function answerFor(key, worldGrowth) {
  if (key === "ch4") return methaneHeadline(worldGrowth);
  if (paceKey) return co2Headline(paceKey);
  return co2Headline(C.shownSign(worldGrowth * 100, 1) > 0 ? "backwards" : "offTrack");
}

// ---- Page ------------------------------------------------------------------------------
const T0 = Date.now();   // page-open time, shared by both gases

/** @param {GasData} data @param {GasKey} gasKey */
function render(data, gasKey) {
  const gas = CFG.gases[gasKey];
  const world = C.project(data.total[CFG.world], CFG.trendYears, CFG.maxGrowth);
  const wRate = perSecond(world.annual);

  const entries = CFG.countries.filter((c) => data.total[c.code]).map((c) => {
    const e = C.project(data.total[c.code], CFG.trendYears, CFG.maxGrowth);
    const pcs = data.perCap[c.code];
    return { ...c, ...e, name: C.regionName(C.flagRegion(c.flag), c.name || data.names[c.code] || c.code), perCap: pcs?.[e.lastYear] ?? null, rest: false, hasSeries: true };
  });
  const row = C.restOfWorld(world, entries);
  const all = [...entries, { code: "ROW", flag: "🌐", name: t("a.rest"), rest: true, partOf: undefined, hasSeries: false,
    ...row, growth: null, perCap: null }];

  C.fill("latest", world.lastYear);
  C.fill("first", world.years[0]);
  C.fill("trend-from", world.trendFrom);
  showAnswer(answerFor(/** @type {GasKey} */ (document.body.dataset.gas ?? CFG.defaultGas), world.growth));
  $("world-rate").textContent = fmt[0].format(wRate);
  $("world-annual").textContent = fmt[2].format(world.annual / 1e9);
  $("world-official").textContent = fmt[2].format(world.lastValue / 1e9);
  $("world-growth").textContent = C.signedPct(world.growth * 100, 1);

  const grid = $("grid");
  grid.innerHTML = "";
  const cards = all.map((e) => {
    const share = (e.annual / world.annual) * 100;
    const el = document.createElement("article");
    el.className = "card" + (e.rest ? " rest" : "");
    const badge = trendBadge(e.growth);
    el.innerHTML = `
      <header>
        <span class="flag" aria-hidden="true">${e.flag}</span>
        <h3>${escapeHtml(e.name)}</h3>
        ${e.partOf ? `<span class="tag">${escapeHtml(t("a.partOf", { name: C.regionName(e.partOf, e.partOf) }))}</span>` : ""}
        ${C.badge(badge.tone, badge.label)}
      </header>
      <div class="ytd"><span class="num">0</span> <small>${t("a.tonnesIn", { year: YEAR })}</small></div>
      <div class="bar" title="${escapeHtml(t("a.shareTitle", { pct: C.pct(share, 1) }))}"><i style="width:${Math.min(Math.max(share, 0), 100)}%"></i></div>
      <p class="share">${escapeHtml(t("a.share", { pct: C.pct(share, 0), gas: C.tOr(`gas.${gasKey}.inText`, gas.inText) }))}</p>
      <details class="more-info">
        <summary>${t("a.more")}</summary>
        ${e.hasSeries ? sparkFor(/** @type {C.Projection} */ (e), e.name) : ""}
        <dl>
          <div><dt>${t("a.perSecond")}</dt><dd>${(perSecond(e.annual) < 10 ? fmt[1] : fmt[0]).format(perSecond(e.annual))} t</dd></div>
          <div><dt>${t("a.perPerson")}</dt><dd>${e.perCap != null ? fmt[1].format(e.perCap) + " t" : t("a.na")}</dd></div>
          <div><dt>${t("a.official", { year: e.lastYear })}</dt><dd>${mass(e.lastValue)}</dd></div>
          <div><dt>${t("a.expected", { year: YEAR })}</dt><dd>${mass(e.annual)}</dd></div>
          <div><dt>${t("a.change")}</dt><dd class="${e.growth == null ? "" : goodBadClass(e.growth * 100, 1)}">${C.trendText(e.growth)}</dd></div>
          <div><dt>${t("a.since")}</dt><dd class="since">0 t</dd></div>
        </dl>
        ${e.hasSeries ? `<button type="button" class="more" aria-expanded="false">${t("core.yearly")} <span aria-hidden="true">▾</span></button>${historyTable(/** @type {C.Projection} */ (e))}` : ""}
      </details>`;
    C.wireHistory(el);
    grid.appendChild(el);
    return { e, el, num: el.querySelector(".num"), since: el.querySelector(".since"), rate: perSecond(e.annual) };
  });

  const sortSel = /** @type {HTMLSelectElement} */ ($("sort"));
  /** @type {Record<string, (c: typeof cards[number]) => number | string>} */
  const keys = {
    total: (c) => c.e.annual,
    percap: (c) => c.e.perCap ?? NaN,
    growth: (c) => c.e.growth ?? NaN,
    name: (c) => c.e.name
  };
  const sortCards = () => C.sortInto(grid, cards, keys[sortSel.value]);
  sortSel.onchange = sortCards;
  sortCards();

  // Show the first few countries; the rest behind one button, so the page stays short.
  C.wireShowAll(grid, $("show-all"), cards.length);

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

/** @param {C.Series} series */
function renderBudget(series) {
  const B = CFG.budget;
  const m = budgetModel(series, B, CFG.trendYears, CFG.maxGrowth);
  $("budget-bars").innerHTML = m.bars.map((b) => `
    <div class="goal-row">
      <div class="goal-top"><b>${escapeHtml(b.label)}</b><span class="goal-num">0</span> <span class="goal-unit">${t("a.tLeft")}</span>
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
  document.querySelectorAll("[data-bud-source]").forEach((el) => { if (el instanceof HTMLAnchorElement) el.href = B.sourceUrl; });
  C.fill("paris-base", P.base);
  C.fill("paris-target", P.target);
  $("pace-target").textContent = C.pct(P.cut * 100, 0);
  $("pace-needed").textContent = C.pct(Math.abs(pace.neededCh), 0);
  $("pace-actual").textContent = C.signedPct(pace.actualCh, 1);
  C.showVerdict($("pace-verdict"), pace.verdict);
  renderStatusCards(m);
  paceKey = pace.verdict.key;
  if (document.body.dataset.gas === "co2") showAnswer(co2Headline(paceKey));
  const span = Math.max(pace.base * 1.15, m.rate);
  $("pace-bar-actual").style.width = (m.rate / span) * 100 + "%";
  $("pace-bar-needed").style.insetInlineStart = (pace.needed / span) * 100 + "%";   // mirrors in right-to-left pages
  $("budget").hidden = false;

  /** @param {number} ty  time in fractional years */
  return (ty) => m.bars.forEach((b, i) => {
    const s = b.at(ty), r = rows[i];
    setText(r.num, fmt[0].format(s.left));                 // tonnes: the number that visibly ticks
    setText(r.side, t("a.used", { pct: C.pct(s.pct, 3) }));
    r.bar.style.width = s.pct + "%";
    setText(r.note, s.left <= 0 ? t("a.usedUp") : t("a.runsOut", { years: fmt[1].format(s.years), year: s.outYear }));
    r.el.classList.toggle("danger", s.danger);
  });
}

/**
 * The traffic-light cards under "Where we stand": the first and last warming limits (e.g. 1.5°C and 2°C) and
 * "are emissions falling fast enough?". Each is one colour, one short title, one sentence; details sit below.
 * @param {ReturnType<typeof budgetModel>} m
 */
function renderStatusCards(m) {
  const now = C.tYears();
  const limits = [m.bars[0], m.bars[m.bars.length - 1]].filter((b, i, a) => a.indexOf(b) === i);
  /** @param {string} label @param {C.Message} msg @param {number | null} pct */
  const card = (label, msg, pct) => C.statusCard({ label, msg, pct, barLabel: pct == null ? "" : t("a.used", { pct: C.pct(pct, 0) }) });
  const pace = m.pace;
  $("status-cards").innerHTML =
    limits.map((b, i) => {
      const s = b.at(now);
      return card(t(i === 0 ? "a.safer" : "a.upper", { limit: b.label }), budgetStatus(s.years), s.pct);
    }).join("") +
    card(t("a.fastEnough"), paceStatus(pace.verdict.key, pace.actualCh, pace.neededCh, CFG.budget.paris.base), null);
}

/** Load the budget section (again, after a failure); does nothing once it is showing. */
function startBudget() {
  if (budgetTick) return;
  loadBudget().then((series) => { budgetTick = renderBudget(series); })
    .catch((err) => console.error("Carbon budget data unavailable:", err));
}

// ---- Boot and gas switching ---------------------------------------------------------------
/** @param {GasKey} key */
function applyGasLabels(key) {
  const gas = CFG.gases[key];
  document.body.dataset.gas = key;
  scene.redraw();
  document.title = t(`meta.title.${key}`);
  C.fill("gas-label", C.tOr(`gas.${key}.label`, gas.label));
  C.fill("gas-text", C.tOr(`gas.${key}.inText`, gas.inText));   // the gas's name inside a sentence (lower case in French)
  C.fill("gas-long", C.tOr(`gas.${key}.long`, gas.long));
  C.fill("gas-note", C.tOr(`gas.${key}.note`, gas.note || ""));
  C.fill("gas-source", gas.source);
  document.querySelectorAll("[data-gas-source-url]").forEach((el) => { /** @type {HTMLAnchorElement} */ (el).href = gas.sourceUrl; });
  document.querySelectorAll(".gas-switch button").forEach((b) =>
    b.setAttribute("aria-pressed", String(/** @type {HTMLElement} */ (b).dataset.gas === key)));
}

/** @type {GasKey | null} */
let current = null;
/** @param {string} key */
async function show(key) {
  const k = /** @type {GasKey} */ (Object.hasOwn(CFG.gases, key) ? key : CFG.defaultGas);
  current = k;
  applyGasLabels(k);
  if (!loaded.has(k)) { C.stopTicker(); C.setState("loading"); }   // never show one gas's numbers under another's labels
  try {
    const data = await loadGas(k);
    loaded.add(k);
    if (current !== k) return;   // switched again while loading
    render(data, k);
    $("fetched-at").textContent = data.fetchedAt.toLocaleString(C.locale());
    C.setState("ready");
  } catch (err) {
    if (current !== k) return;
    console.error(err);
    C.stopTicker();
    C.setState("error", err instanceof Error ? err.message : String(err));
  }
}

/** The gas whose `hash` matches the URL, or the default. */
const fromHash = () => /** @type {GasKey} */ (
  Object.entries(CFG.gases).find(([k, g]) => g.hash && g.hash === location.hash)?.[0] ?? CFG.defaultGas);

document.querySelectorAll(".gas-switch button").forEach((b) => b.addEventListener("click", () => {
  const key = /** @type {HTMLElement} */ (b).dataset.gas ?? CFG.defaultGas;
  const gas = CFG.gases[/** @type {GasKey} */ (key)];
  history.replaceState(null, "", location.pathname + location.search + (key === CFG.defaultGas ? "" : gas?.hash ?? ""));
  show(key);
}));
window.addEventListener("hashchange", () => show(fromHash()));

// Language first (the inline script in index.html chose it), so everything below is drawn in it.
await C.startLanguage((code) => import(`./i18n/${code}.js`), document.querySelector("header.top .wrap"));
C.startStats();
C.wireEmbed(document.querySelector("footer.foot"));
C.wireActions(actions);
const scene = C.startScene(document.querySelector("canvas.scene"), emissionsScene(() => document.body.dataset.gas),
  { groundAt: document.querySelector("header.top") });
C.wireHelp();
C.fill("year", YEAR);
$("retry").addEventListener("click", () => { C.setState("loading"); startBudget(); show(current ?? CFG.defaultGas); });
startBudget();
show(fromHash());
