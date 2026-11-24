// Unit tests for the Emissions Clock model. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "clock-core";
import { indexEntities, restOfWorld, budgetModel } from "../js/model.js";
import CFG from "../js/config.js";

const close = (a, b, eps = 1) => assert.ok(Math.abs(a - b) < eps, `${a} is not close to ${b}`);

test("indexEntities keeps wanted codes, names and finite values", () => {
  const rows = parseCsv('entity,code,year,v\nWorld,OWID_WRL,2024,10\n"Korea, South",KOR,2024,\nAtlantis,ATL,2024,5\n');
  assert.deepEqual(indexEntities(rows, "v", ["OWID_WRL", "KOR"]), { OWID_WRL: { name: "World", series: { 2024: 10 } } });
});

test("restOfWorld ignores entries that are part of another (Germany in the EU)", () => {
  const r = restOfWorld({ annual: 100, lastValue: 90, lastYear: 2025 }, [
    { annual: 30, series: { 2025: 25 } }, { annual: 20, series: { 2025: 15 }, partOf: "EU" }
  ]);
  assert.deepEqual(r, { annual: 70, lastValue: 65, lastYear: 2025 });
});

// Flat emissions of 40 Gt a year make the arithmetic easy to check by hand.
const flat = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [2014 + i, 40e9]));
const B = { ...CFG.budget, since: 2016, from: 2027, thresholds: [{ label: "1.5°C", gt: 150 }, { label: "2°C", gt: 1035 }],
  paris: { base: 2019, target: 2030, cut: 0.48 } };

test("budgetModel: cumulative emissions", () => {
  const m = budgetModel(flat, B, 1, 2026);
  close(m.cum(2016, 2026), 10 * 40e9);
  close(m.cum(2016, 2026.5), 10.5 * 40e9);
  close(m.cum(2027, 2026.5), -0.5 * 40e9);      // negative when t is before the start
  assert.equal(m.rate, 40e9);
});

test("budgetModel: bars count the budget from 1 January of `from`", () => {
  const m = budgetModel(flat, B, 1, 2026);
  const b15 = m.bars[0];
  close(b15.total, 150e9 + 11 * 40e9);           // used 2016..2026 plus the published budget
  const mid = b15.at(2026.5);
  close(mid.left, 150e9 + 0.5 * 40e9);           // half of 2026 still to come before 1 January 2027
  close(mid.years, (150e9 + 20e9) / 40e9, 1e-9);
  assert.equal(mid.outYear, Math.floor(2026.5 + mid.years));
  assert.ok(mid.pct > 70 && mid.pct < 80);
  assert.equal(b15.at(2040).left, 0);            // never negative
});

test("budgetModel: Paris pace check", () => {
  const m = budgetModel(flat, B, 1, 2026);
  close(m.pace.neededCh, -48 * 7 / 11, 1e-9);    // straight line from 2019 to -48% in 2030
  close(m.pace.actualCh, 0, 1e-9);
  assert.equal(m.pace.verdict.text, "Going the wrong way");
  const falling = Object.fromEntries(Object.entries(flat).map(([y, v]) => [y, Number(y) >= 2020 ? v * (1 - 0.06 * (Number(y) - 2019)) : v]));
  assert.equal(budgetModel(falling, B, 1, 2025).pace.verdict.text, "On track");
});
