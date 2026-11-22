(function () {
  "use strict";

  const CFG = window.CO2_CONFIG;
  const $ = (id) => document.getElementById(id);
  const MS_PER_YEAR = (y) => Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1);
  const YEAR = new Date().getUTCFullYear();

  const fmt0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const fmt1 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmt3 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
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

  // Redraw about 10 times a second (not every frame), write only text that changed,
  // and reload when the year rolls over so a tab left open on 31 December restarts cleanly.
  const lastText = new WeakMap();
  function setText(el, str, html = false) {
    if (lastText.get(el) === str) return;
    lastText.set(el, str);
    if (html) el.innerHTML = str; else el.textContent = str;
  }
  function every(fn, alive = () => true, ms = 100) {
    let last = 0;
    (function loop(ts) {
      if (!alive()) return;
      if (!last || ts - last >= ms) {
        last = ts || 1;
        if (new Date().getUTCFullYear() !== YEAR) { location.reload(); return; }
        fn(Date.now());
      }
      requestAnimationFrame(loop);
    })(0);
  }

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
    every((now) => {
      const frac = yearFraction(now);
      const elapsed = (now - T0) / 1000;
      setText($("world-num"), digits(fmt0.format(world.annual * frac)), true);
      setText($("world-since"), fmt0.format(wRate * elapsed));
      setText($("world-pct"), fmt2.format(frac * 100));
      $("world-bar").style.width = frac * 100 + "%";
      for (const c of cards) {
        setText(c.num, fmt0.format(c.e.annual * frac));
        setText(c.since, fmt0.format(c.rate * elapsed) + " t");
      }
    }, () => myLoop === loopId);
  }

  // ---- Carbon budget bars ---------------------------------------------------
  // Total CO2 (fossil + land use) per year, projected like the counters for years
  // without data. used(t) = emissions since 1 Jan of `since`; remaining(t) =
  // budget (counted from 1 Jan of `from`) + emissions still to come before `from`.
  async function loadBudget() {
    const B = CFG.budget;
    const rows = await fetchCsv(`${CFG.apiBase}${B.chart}.csv?` + new URLSearchParams({
      v: "1", csvType: "filtered", useColumnShortNames: "true", tab: "chart", time: `${B.since - 3}..latest`
    }) + `&country=~${CFG.world}`);
    const series = indexByCode(rows, B.column)[CFG.world]?.series;
    if (!series) throw new Error("No total CO2 series");
    return series;
  }

  function renderBudget(series) {
    const B = CFG.budget;
    const e = buildEntry(series, CFG.trendYears);
    const yearly = (y) => series[y] ?? e.lastValue * Math.pow(1 + e.growth, y - e.lastYear);
    const tYears = (ms) => YEAR + (ms - Date.UTC(YEAR, 0, 1)) / MS_PER_YEAR(YEAR);
    // tonnes emitted between 1 Jan of year a and fractional year t (negative if t < a)
    function cum(a, t) {
      if (t < a) return -cum(t, a);
      let s = 0;
      for (let y = a; y + 1 <= t; y++) s += yearly(y);
      const y = Math.floor(t);
      if (t > y && y >= a) s += yearly(y) * (t - y);
      return s;
    }
    const rate = yearly(YEAR);   // t per year now
    const host = $("budget-bars");
    host.innerHTML = B.thresholds.map((th, i) => `
      <div class="bud" data-i="${i}">
        <div class="bud-head"><b>${th.label}</b><span class="bud-pct">0%</span> <span class="bud-txt">used</span>
          <span class="bud-left"></span></div>
        <div class="bud-bar"><i></i></div>
        <p class="bud-out"></p>
      </div>`).join("");
    const rows = [...host.querySelectorAll(".bud")].map((el) => ({
      pct: el.querySelector(".bud-pct"), bar: el.querySelector("i"), left: el.querySelector(".bud-left"),
      out: el.querySelector(".bud-out"), el
    }));
    const totals = B.thresholds.map((th) => th.gt * 1e9 + cum(B.since, B.from));

    // Paris pace check: where emissions should be now on a straight line to the 2030 cut
    const P = B.paris, base = yearly(P.base);
    const needed = base * (1 - P.cut * (YEAR - P.base) / (P.target - P.base));
    const actualCh = (rate / base - 1) * 100, neededCh = (needed / base - 1) * 100;
    $("pace-actual").textContent = (actualCh >= 0 ? "+" : "") + fmt1.format(actualCh) + "%";
    $("pace-needed").textContent = fmt0.format(Math.abs(neededCh)) + "%";
    $("pace-target").textContent = fmt0.format(P.cut * 100) + "%";
    $("pace-verdict").textContent = rate <= needed ? "On track" : actualCh < 0 ? "Off track" : "Going the wrong way";
    $("pace-verdict").className = "verdict " + (rate <= needed ? "ok" : "bad");
    const span = Math.max(base * 1.15, rate) ;
    $("pace-bar-actual").style.width = (rate / span) * 100 + "%";
    $("pace-bar-needed").style.left = (needed / span) * 100 + "%";
    document.querySelectorAll("[data-bud-since]").forEach((el) => (el.textContent = B.since));
    document.querySelectorAll("[data-bud-source]").forEach((el) => (el.textContent = B.source));

    every((now) => {
      const t = tYears(now);
      const used = cum(B.since, t);
      rows.forEach((r, i) => {
        const left = Math.max(totals[i] - used, 0);
        const p = Math.min(used / totals[i], 1) * 100;
        setText(r.pct, fmt3.format(p) + "%");
        r.bar.style.width = p + "%";
        setText(r.left, fmt0.format(left) + " t left");   // tonnes, so it visibly ticks down
        const years = left / rate;
        const outYear = Math.floor(t + years);
        setText(r.out, left <= 0 ? "Used up."
          : `Runs out in about ${fmt1.format(years)} years (${outYear}) at today's rate.`);
        r.el.classList.toggle("danger", years < 10);
      });
    });
  }

  if (CFG.budget) {
    loadBudget().then(renderBudget).catch((err) => {
      console.error(err);
      const sec = $("budget");
      if (sec) sec.hidden = true;
    });
  }

  // ---- Boot / gas switching ---------------------------------------------
  function setState(state, msg) {
    document.body.dataset.state = state;
    if (msg) $("error-msg").textContent = msg;
  }

  function applyGasLabels(key) {
    const gas = CFG.gases[key];
    document.body.dataset.gas = key;
    document.title = `Live ${gas.label} Emissions Clock – World and Countries in Real Time`;
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
  // Help pop-up
  const help = $("help");
  document.querySelectorAll("[data-open-help]").forEach((b) => b.addEventListener("click", () => {
    if (help.showModal) help.showModal(); else help.setAttribute("open", "");
    help.querySelector(".sheet").scrollTop = 0;
    help.querySelector(".close").focus({ preventScroll: true });
  }));
  const closeHelp = () => (help.close ? help.close() : help.removeAttribute("open"));
  document.querySelectorAll("[data-close-help]").forEach((b) => b.addEventListener("click", closeHelp));
  help.addEventListener("click", (e) => { if (e.target === help) closeHelp(); });  // tap outside

  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = YEAR));
  $("retry").addEventListener("click", () => show(current));
  show(fromHash());
})();
