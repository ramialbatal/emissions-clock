(function () {
  "use strict";

  const CFG = window.CO2_CONFIG;
  const $ = (id) => document.getElementById(id);
  const MS_PER_YEAR = (y) => Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1);
  const YEAR = new Date().getUTCFullYear();

  const fmt0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const fmt1 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmt2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ---- Fetching ------------------------------------------------------------
  function chartUrl(slug, codes) {
    const q = new URLSearchParams({
      v: "1", csvType: "filtered", useColumnShortNames: "true", tab: "chart",
      time: `${CFG.historyFrom}..latest`
    });
    // OWID expects "~CODE1~CODE2"; build manually so "~" isn't percent-encoded.
    return `${CFG.apiBase}${slug}.csv?${q}&country=~${codes.join("~")}`;
  }

  // Minimal CSV parser (OWID quotes entity names that contain commas).
  function parseCsv(text) {
    const rows = [];
    for (const line of text.trim().split(/\r?\n/)) {
      const cells = [];
      let cur = "", q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (q) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') q = false;
          else cur += ch;
        } else if (ch === '"') q = true;
        else if (ch === ",") { cells.push(cur); cur = ""; }
        else cur += ch;
      }
      cells.push(cur);
      rows.push(cells);
    }
    const [head, ...body] = rows;
    return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
  }

  // -> { CODE: { name, series: { year: value } } }
  function indexByCode(rows, valueCol) {
    const out = {};
    for (const r of rows) {
      const v = parseFloat(r[valueCol]);
      if (!r.code || !isFinite(v)) continue;
      (out[r.code] ||= { name: r.entity, series: {} }).series[+r.year] = v;
    }
    return out;
  }

  async function fetchCsv(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return parseCsv(await res.text());
  }

  const cache = {};
  async function loadData(gasKey) {
    if (cache[gasKey]) return cache[gasKey];
    const gas = CFG.gases[gasKey];
    const codes = [CFG.world, ...CFG.countries.map((c) => c.code)];
    const [totalRows, pcRows] = await Promise.all([
      fetchCsv(chartUrl(gas.total.chart, codes)),
      fetchCsv(chartUrl(gas.perCapita.chart, codes))
    ]);
    const total = indexByCode(totalRows, gas.total.column);
    const perCap = indexByCode(pcRows, gas.perCapita.column);
    if (!total[CFG.world]) throw new Error("World total missing from response");
    return (cache[gasKey] = { total, perCap, fetchedAt: new Date() });
  }

  // ---- Model ---------------------------------------------------------------
  // Latest official year L with value E(L); trend g = average annual change over
  // the last N years. Projection for this year: E(Y) = E(L) * (1 + g)^(Y - L).
  // That annual figure is spread evenly over the year (no seasonal cycle).
  function buildEntry(series, n) {
    const years = Object.keys(series).map(Number).sort((a, b) => a - b);
    const last = years[years.length - 1];
    const first = years.includes(last - n) ? last - n : years[0];
    const g = last > first ? Math.pow(series[last] / series[first], 1 / (last - first)) - 1 : 0;
    const annual = series[last] * Math.pow(1 + g, YEAR - last);
    return { lastYear: last, lastValue: series[last], trendFrom: first, growth: g, annual, series, years };
  }
  const perSecond = (annual) => annual / (MS_PER_YEAR(YEAR) / 1000);
  const yearFraction = (now) => (now - Date.UTC(YEAR, 0, 1)) / MS_PER_YEAR(YEAR);

  // ---- Rendering -----------------------------------------------------------
  // 12.42 Gt / 573 Mt / 48.2 Mt — keeps small methane figures readable
  function mass(t) {
    if (Math.abs(t) >= 1e9) return fmt2.format(t / 1e9) + " Gt";
    return (Math.abs(t) >= 1e8 ? fmt0 : fmt1).format(t / 1e6) + " Mt";
  }
  const digits = (s) => s.replace(/[0-9]/g, (d) => `<span class="d">${d}</span>`);

  function sparkline(e) {
    const ys = e.years, vals = ys.map((y) => e.series[y]);
    const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
    const W = 120, H = 28;
    const xy = vals.map((v, i) => [(i / (vals.length - 1)) * W, H - 3 - ((v - min) / span) * (H - 6)]);
    const pts = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const [lx, ly] = xy[xy.length - 1];
    const first = ys[0], last = ys[ys.length - 1];
    const change = (vals[vals.length - 1] / vals[0] - 1) * 100;
    return `<figure class="spark-wrap" title="Show yearly values">
      <svg class="spark" viewBox="-2 0 ${W + 4} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${pts}"/><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.2"/>
      </svg>
      <figcaption>${first}–${last} <b class="${change > 0 ? "up" : change < 0 ? "down" : ""}">${
        change > 0 ? "+" : ""}${fmt0.format(change)}%</b></figcaption>
      <span class="sr-only">Annual emissions ${first} to ${last}</span>
    </figure>`;
  }

  function historyTable(e) {
    const rows = e.years.slice().reverse().map((y, i, arr) => {
      const prev = e.series[y - 1];
      const ch = prev ? (e.series[y] / prev - 1) * 100 : null;
      return `<tr><th>${y}</th><td>${mass(e.series[y])}</td><td class="${
        ch > 0 ? "up" : ch < 0 ? "down" : ""}">${ch == null ? "" : (ch > 0 ? "+" : "") + fmt1.format(ch) + "%"}</td></tr>`;
    }).join("");
    return `<div class="history" hidden><table><caption>Official annual emissions</caption>${rows}</table></div>`;
  }

  const T0 = Date.now();   // page-open time, shared by both gases
  let loopId = 0;          // bumps on every render so the old clock loop stops

  function render(data, gas) {
    const myLoop = ++loopId;
    const world = buildEntry(data.total[CFG.world].series, CFG.trendYears);
    const wRate = perSecond(world.annual);

    const entries = CFG.countries
      .filter((c) => data.total[c.code])
      .map((c) => {
        const e = buildEntry(data.total[c.code].series, CFG.trendYears);
        const pcs = data.perCap[c.code]?.series;
        return {
          ...c, ...e,
          name: c.name || data.total[c.code].name,
          perCap: pcs ? pcs[e.lastYear] : null
        };
      });

    const missing = CFG.countries.filter((c) => !data.total[c.code]).map((c) => c.code);
    if (missing.length) console.warn("No data returned for:", missing.join(", "));

    const listedAnnual = entries.filter((e) => !e.partOf).reduce((s, e) => s + e.annual, 0);
    const restLast = world.lastValue - entries.filter((e) => !e.partOf)
      .reduce((s, e) => s + (e.series[world.lastYear] || 0), 0);
    entries.push({
      code: "ROW", flag: "🌐", name: "Rest of world", rest: true,
      annual: world.annual - listedAnnual, lastValue: restLast, lastYear: world.lastYear,
      growth: null, perCap: null
    });

    // Header / methodology fill-ins
    document.querySelectorAll("[data-latest]").forEach((el) => (el.textContent = world.lastYear));
    document.querySelectorAll("[data-first]").forEach((el) => (el.textContent = world.years[0]));
    document.querySelectorAll("[data-trend-from]").forEach((el) => (el.textContent = world.trendFrom));
    $("world-rate").textContent = fmt0.format(wRate);
    $("world-annual").textContent = fmt2.format(world.annual / 1e9);
    $("world-official").textContent = fmt2.format(world.lastValue / 1e9);
    $("world-growth").textContent = (world.growth >= 0 ? "+" : "") + fmt1.format(world.growth * 100) + "%";

    const grid = $("grid");
    grid.innerHTML = "";
    const cards = entries.map((e) => {
      const share = (e.annual / world.annual) * 100;
      const g = e.growth;
      const el = document.createElement("article");
      el.className = "card" + (e.rest ? " rest" : "");
      el.innerHTML = `
        <header>
          <span class="flag" aria-hidden="true">${e.flag}</span>
          <h3>${e.name}</h3>
          ${e.partOf ? `<span class="tag">part of ${e.partOf}</span>` : ""}
          ${e.series ? sparkline(e) : ""}
        </header>
        <div class="ytd"><span class="num">0</span> <small>${gas.unit} in ${YEAR}</small></div>
        <div class="bar" title="${fmt1.format(share)}% of world"><i style="width:${Math.min(share * 2.5, 100)}%"></i></div>
        <dl>
          <div><dt>Share of world</dt><dd>${fmt1.format(share)}%</dd></div>
          <div><dt>Per second</dt><dd>${(perSecond(e.annual) < 10 ? fmt1 : fmt0).format(perSecond(e.annual))} t</dd></div>
          <div><dt>${e.lastYear} official</dt><dd>${mass(e.lastValue)}</dd></div>
          <div><dt>${YEAR} projected</dt><dd>${mass(e.annual)}</dd></div>
          <div><dt>Per person / yr</dt><dd>${e.perCap != null ? fmt1.format(e.perCap) + " t" : "—"}</dd></div>
          <div><dt>Trend / yr</dt><dd class="${g > 0 ? "up" : g < 0 ? "down" : ""}">${
            g == null ? "—" : (g > 0 ? "▲ +" : g < 0 ? "▼ " : "") + fmt1.format(g * 100) + "%"}</dd></div>
          <div class="wide"><dt>Since you opened this page</dt><dd class="since">0 t</dd></div>
        </dl>
        ${e.series ? `<button type="button" class="more" aria-expanded="false">Yearly data <span aria-hidden="true">▾</span></button>${historyTable(e)}` : ""}`;
      const sw = el.querySelector(".spark-wrap");
      const btn = el.querySelector(".more");
      if (btn) {
        const h = el.querySelector(".history");
        const toggle = () => {
          h.hidden = !h.hidden;
          btn.setAttribute("aria-expanded", String(!h.hidden));
          btn.firstChild.textContent = h.hidden ? "Yearly data " : "Hide yearly data ";
          btn.classList.toggle("open", !h.hidden);
        };
        btn.addEventListener("click", toggle);
        sw.addEventListener("click", toggle);
      }
      grid.appendChild(el);
      return { e, el, num: el.querySelector(".num"), since: el.querySelector(".since"), rate: perSecond(e.annual) };
    });

    // Sorting
    const sortSel = $("sort");
    const keys = {
      total: (c) => c.e.annual,
      percap: (c) => c.e.perCap ?? -1,
      growth: (c) => c.e.growth ?? -99,
      name: (c) => c.e.name
    };
    function sortCards() {
      const k = keys[sortSel.value];
      cards.slice()
        .sort((a, b) => (!!a.e.rest - !!b.e.rest) ||
          (typeof k(a) === "string" ? k(a).localeCompare(k(b)) : k(b) - k(a)))
        .forEach((c) => grid.appendChild(c.el));
    }
    sortSel.onchange = sortCards;
    sortCards();

    // Clock loop
    let lastWorld = "";
    (function tick() {
      if (myLoop !== loopId) return;
      const now = Date.now();
      const frac = yearFraction(now);
      const elapsed = (now - T0) / 1000;
      const ws = fmt0.format(world.annual * frac);
      if (ws !== lastWorld) { $("world-num").innerHTML = digits(ws); lastWorld = ws; }
      $("world-since").textContent = fmt0.format(wRate * elapsed);
      $("world-pct").textContent = fmt2.format(frac * 100);
      $("world-bar").style.width = frac * 100 + "%";
      for (const c of cards) {
        c.num.textContent = fmt0.format(c.e.annual * frac);
        c.since.textContent = fmt0.format(c.rate * elapsed) + " t";
      }
      requestAnimationFrame(tick);
    })();
  }

  // ---- Boot / gas switching ---------------------------------------------
  function setState(state, msg) {
    document.body.dataset.state = state;
    if (msg) $("error-msg").textContent = msg;
  }

  function applyGasLabels(key) {
    const gas = CFG.gases[key];
    document.body.dataset.gas = key;
    document.title = `${gas.label} Emissions Clock`;
    document.querySelectorAll("[data-gas-label]").forEach((el) => (el.textContent = gas.label));
    document.querySelectorAll("[data-gas-long]").forEach((el) => (el.textContent = gas.long));
    document.querySelectorAll("[data-gas-unit]").forEach((el) => (el.textContent = gas.unitLong));
    document.querySelectorAll("[data-gas-note]").forEach((el) => (el.textContent = gas.note || ""));
    document.querySelectorAll("[data-gas-source]").forEach((el) => (el.textContent = gas.source));
    document.querySelectorAll("[data-gas-source-url]").forEach((el) => (el.href = gas.sourceUrl));
    document.querySelectorAll(".gas-switch button").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.gas === key)));
  }

  let current = null;
  async function show(key) {
    if (!CFG.gases[key]) key = CFG.defaultGas;
    current = key;
    applyGasLabels(key);
    if (!cache[key]) { loopId++; setState("loading"); }
    try {
      const data = await loadData(key);
      if (current !== key) return;  // user switched again while loading
      render(data, CFG.gases[key]);
      $("fetched-at").textContent = data.fetchedAt.toLocaleString();
      setState("ready");
    } catch (err) {
      if (current !== key) return;
      console.error(err);
      setState("error", err.message || String(err));
    }
  }

  const fromHash = () => (location.hash === "#methane" ? "ch4" : "co2");
  document.querySelectorAll(".gas-switch button").forEach((b) =>
    b.addEventListener("click", () => {
      const hash = b.dataset.gas === "ch4" ? "#methane" : "";
      history.replaceState(null, "", location.pathname + location.search + hash);
      show(b.dataset.gas);
    }));
  window.addEventListener("hashchange", () => show(fromHash()));
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = YEAR));
  $("retry").addEventListener("click", () => show(current));
  show(fromHash());
})();
