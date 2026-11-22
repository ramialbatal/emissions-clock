# Notes for AI assistants working in this repository

- This is the Emissions Clock, part of a series with the Renewables and Jobs clocks in `ramialbatal/ramialbatal.github.io`.
- Read the developer notes first: https://github.com/ramialbatal/ramialbatal.github.io/tree/main/docs
  (especially `lessons-learned.md` and `adding-a-clock.md`).
- This repository keeps its own copies of the shared helpers; keep them in step with `shared/clock-core.js` there.
- Every November, update the carbon budget in `js/config.js` (`budget.thresholds`, `budget.from`, `budget.source`)
  from the new Global Carbon Budget edition.
- Writing style: no em dashes or en dashes anywhere (text, comments, images).
- Test in a browser through `python3 -m http.server`, at desktop and 375 px phone width; bump the `?v=` query on changed files.
