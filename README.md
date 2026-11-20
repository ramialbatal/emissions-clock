# CO₂ Emissions Clock

A static, real-time "debt clock" style page estimating fossil CO₂ emissions for the world and major emitters.

Open `index.html` in a browser (no build step). Data and the projection inputs live in `js/data.js`; the clock logic is in `js/app.js`.

## Method

Annual figures (Global Carbon Project, base year in `data.js`) are projected to the current year with an assumed growth rate and spread evenly across the year, so the counters show year-to-date emissions ticking in real time. This is a model, not a live measurement.

## Updating the data

Edit `mt` (MtCO₂), `growth` (%/yr) and `BASE_YEAR` in `js/data.js` when new official numbers are published (Global Carbon Budget is released each November).
