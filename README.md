# CO₂ Emissions Clock

A static, real-time "debt clock" style page estimating fossil CO₂ emissions for the world and major emitters.

Open `index.html` in a browser, or host the folder on any static host (GitHub Pages, Netlify…). There's no build step and no server.

## Data

On load, the page fetches the latest official annual figures in the browser, straight from
[Our World in Data's grapher API](https://ourworldindata.org/co2-emissions). That API republishes the
Global Carbon Project's **Global Carbon Budget** and allows cross-origin requests. Two small CSVs are requested:
total emissions and per-capita emissions, filtered to the configured countries. While they load, a spinner is shown.
If the request fails, an error with a retry button is shown.

Countries, source URLs and the trend window are set in `js/config.js`.

## Method

The latest reported year is projected to the current year using each country's average annual change over the
last 3 years. That total is spread evenly across the year, so the counters show year-to-date emissions ticking in real time.
This is a model, not a live measurement.
