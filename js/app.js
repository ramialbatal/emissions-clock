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
      v: "1", csvType: "filtered", useColumnShortNames: "true",
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

  async function loadData() {
    const codes = [CFG.world, ...CFG.countries.map((c) => c.code)];
    const [totalRows, pcRows] = await Promise.all([
      fetchCsv(chartUrl(CFG.charts.total, codes)),
      fetchCsv(chartUrl(CFG.charts.perCapita, codes))
    ]);
    const total = indexByCode(totalRows, "emissions_total");
    const perCap = indexByCode(pcRows, "emissions_total_per_capita");
    if (!total[CFG.world]) throw new Error("World total missing from response");
    return { total, perCap };
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
  const digits = (s) => s.replace(/[0-9]/g, (d) => `<span class="d">${d}</span>`);

  function sparkline(e) {
    const ys = e.years, vals = ys.map((y) => e.series[y]);
    const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
    const W = 120, H = 28;
    const pts = vals.map((v, i) =>
      `${((i / (vals.length - 1)) * W).toFixed(1)},${(H - 2 - ((v - min) / span) * (H - 4)).toFixed(1)}`).join(" ");
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
      aria-label="Emissions ${ys[0]}–${ys[ys.length - 1]}"><polyline points="${pts}"/></svg>`;
  }

  function render(data) {
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
        <div class="ytd"><span class="num">0</span> <small>t CO₂ in ${YEAR}</small></div>
        <div class="bar" title="${fmt1.format(share)}% of world"><i style="width:${Math.min(share * 2.5, 100)}%"></i></div>
        <dl>
          <div><dt>Share of world</dt><dd>${fmt1.format(share)}%</dd></div>
          <div><dt>Per second</dt><dd>${fmt0.format(perSecond(e.annual))} t</dd></div>
          <div><dt>${e.lastYear} official</dt><dd>${fmt2.format(e.lastValue / 1e9)} Gt</dd></div>
          <div><dt>${YEAR} projected</dt><dd>${fmt2.format(e.annual / 1e9)} Gt</dd></div>
          <div><dt>Per person / yr</dt><dd>${e.perCap != null ? fmt1.format(e.perCap) + " t" : "—"}</dd></div>
          <div><dt>Trend / yr</dt><dd class="${g > 0 ? "up" : g < 0 ? "down" : ""}">${
            g == null ? "—" : (g > 0 ? "▲ +" : g < 0 ? "▼ " : "") + fmt1.format(g * 100) + "%"}</dd></div>
          <div class="wide"><dt>Since you opened this page</dt><dd class="since">0 t</dd></div>
        </dl>`;
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
    const t0 = Date.now();
    let lastWorld = "";
    (function tick() {
      const now = Date.now();
      const frac = yearFraction(now);
      const elapsed = (now - t0) / 1000;
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

  // ---- Boot ----------------------------------------------------------------
  function setState(state, msg) {
    document.body.dataset.state = state;
    if (msg) $("error-msg").textContent = msg;
  }

  async function start() {
    setState("loading");
    try {
      const data = await loadData();
      render(data);
      $("fetched-at").textContent = new Date().toLocaleString();
      setState("ready");
    } catch (err) {
      console.error(err);
      setState("error", err.message || String(err));
    }
  }

  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = YEAR));
  $("retry").addEventListener("click", start);
  start();
})();
