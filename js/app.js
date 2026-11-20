(function () {
  "use strict";

  const D = window.CO2_DATA;
  const MS_PER_YEAR = (y) => Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1);

  // ---- Model -------------------------------------------------------------
  // Annual emissions for a given year, projected from the base year with a
  // constant growth rate:  E(y) = E(base) * (1 + g)^(y - base)
  function annualTonnes(entry, year) {
    return entry.mt * 1e6 * Math.pow(1 + entry.growth / 100, year - D.BASE_YEAR);
  }
  // Emissions are spread evenly over the year (no seasonal/daily cycle).
  function tonnesPerSecond(entry, year) {
    return annualTonnes(entry, year) / (MS_PER_YEAR(year) / 1000);
  }
  function yearToDate(entry, now) {
    const y = now.getUTCFullYear();
    const start = Date.UTC(y, 0, 1);
    const frac = (now.getTime() - start) / MS_PER_YEAR(y);
    return annualTonnes(entry, y) * frac;
  }

  // ---- Formatting --------------------------------------------------------
  const fmt0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const fmt1 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmt2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Wrap digits so they render with a fixed-width "odometer" look.
  function digits(str) {
    return str.replace(/[0-9]/g, (d) => `<span class="d">${d}</span>`);
  }

  // ---- Build UI ----------------------------------------------------------
  const year = new Date().getUTCFullYear();
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = year));
  document.getElementById("base-year").textContent = D.BASE_YEAR;
  document.getElementById("source").textContent = D.source;

  const listed = D.countries.filter((c) => !D.partOf[c.code]);
  const worldAnnual = annualTonnes(D.world, year);
  const listedAnnual = listed.reduce((s, c) => s + annualTonnes(c, year), 0);
  const rest = {
    code: "ROW", flag: "🌐", name: "Rest of world",
    mt: (worldAnnual - listedAnnual) / 1e6, growth: 0, pop: null, base: year
  };

  const grid = document.getElementById("grid");
  const cards = D.countries.map((c) => makeCard(c, false));
  cards.push(makeCard(rest, true));

  function makeCard(c, isRest) {
    const el = document.createElement("article");
    el.className = "card" + (isRest ? " rest" : "");
    const annual = isRest ? c.mt * 1e6 : annualTonnes(c, year);
    const share = (annual / worldAnnual) * 100;
    const perCap = c.pop ? annual / (c.pop * 1e6) : null;
    const note = D.partOf[c.code] ? `<span class="tag">part of ${D.partOf[c.code]}</span>` : "";
    el.innerHTML = `
      <header>
        <span class="flag" aria-hidden="true">${c.flag}</span>
        <h3>${c.name}</h3>${note}
      </header>
      <div class="ytd" aria-live="off"><span class="num"></span> <small>t CO₂</small></div>
      <div class="bar" title="${fmt1.format(share)}% of world"><i style="width:${Math.min(share * 2.5, 100)}%"></i></div>
      <dl>
        <div><dt>Share of world</dt><dd>${fmt1.format(share)}%</dd></div>
        <div><dt>Per second</dt><dd>${fmt0.format(annual / (MS_PER_YEAR(year) / 1000))} t</dd></div>
        <div><dt>${year} projected</dt><dd>${fmt2.format(annual / 1e9)} Gt</dd></div>
        <div><dt>Per person / yr</dt><dd>${perCap ? fmt1.format(perCap) + " t" : "—"}</dd></div>
        <div><dt>Since you arrived</dt><dd class="since">0 t</dd></div>
        <div><dt>Trend / yr</dt><dd class="${c.growth > 0 ? "up" : c.growth < 0 ? "down" : ""}">${isRest ? "—" : (c.growth > 0 ? "▲ +" : c.growth < 0 ? "▼ " : "") + fmt1.format(c.growth) + "%"}</dd></div>
      </dl>`;
    grid.appendChild(el);
    return {
      el, annual, share, perCap, growth: isRest ? null : c.growth, name: c.name,
      num: el.querySelector(".num"),
      since: el.querySelector(".since"),
      ytd: isRest
        ? (now) => (annual * (now - Date.UTC(year, 0, 1))) / MS_PER_YEAR(year)
        : (now) => yearToDate(c, new Date(now)),
      rate: annual / (MS_PER_YEAR(year) / 1000)
    };
  }

  // ---- Sorting -----------------------------------------------------------
  const sortSel = document.getElementById("sort");
  function sortCards() {
    const key = sortSel.value;
    const val = {
      total: (c) => c.annual,
      name: (c) => c.name,
      percap: (c) => (c.perCap == null ? -1 : c.perCap),
      growth: (c) => (c.growth == null ? -99 : c.growth)
    }[key];
    const sorted = cards.slice().sort((a, b) => {
      const va = val(a), vb = val(b);
      if (typeof va === "string") return va.localeCompare(vb);
      return vb - va;
    });
    // keep "rest of world" last
    sorted.sort((a, b) => a.el.classList.contains("rest") - b.el.classList.contains("rest"));
    sorted.forEach((c) => grid.appendChild(c.el));
  }
  sortSel.addEventListener("change", sortCards);
  sortCards();

  // ---- Clock loop --------------------------------------------------------
  const worldNum = document.getElementById("world-num");
  const worldRate = document.getElementById("world-rate");
  const worldSince = document.getElementById("world-since");
  const worldPct = document.getElementById("world-pct");
  const worldBar = document.getElementById("world-bar");
  const wRate = tonnesPerSecond(D.world, year);
  worldRate.textContent = fmt0.format(wRate);
  document.getElementById("world-annual").textContent = fmt2.format(worldAnnual / 1e9);

  const t0 = Date.now();
  let lastWorld = "";

  function tick() {
    const now = Date.now();
    const w = yearToDate(D.world, new Date(now));
    const ws = fmt0.format(w);
    if (ws !== lastWorld) { worldNum.innerHTML = digits(ws); lastWorld = ws; }
    const elapsed = (now - t0) / 1000;
    worldSince.textContent = fmt0.format(wRate * elapsed);
    const pct = (w / worldAnnual) * 100;
    worldPct.textContent = fmt2.format(pct);
    worldBar.style.width = pct + "%";

    for (const c of cards) {
      c.num.textContent = fmt0.format(c.ytd(now));
      c.since.textContent = fmt0.format(c.rate * elapsed) + " t";
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
