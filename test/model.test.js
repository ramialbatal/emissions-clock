// Unit tests for the Emissions Clock model. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { restOfWorld, budgetModel } from "../js/model.js";
import CFG from "../js/config.js";

const close = (a, b, eps = 1) => assert.ok(Math.abs(a - b) < eps, `${a} is not close to ${b}`);
const G = 1e9;

test("restOfWorld: listed countries come off the world; Germany (part of EU) isn't counted twice", () => {
  const r = restOfWorld({ annual: 100, lastValue: 90, lastYear: 2025 }, [
    { annual: 30, at: (y) => ({ 2025: 25 })[y] }, { annual: 20, at: (y) => ({ 2025: 15 })[y], partOf: "EU" }
  ]);
  assert.deepEqual(r, { annual: 70, lastValue: 65, lastYear: 2025 });
});

test("restOfWorld: a country one year behind counts with its projection, not as zero", () => {
  const lagging = { annual: 12, at: (y) => (y === 2025 ? 11 : 10) };   // official 2024, projected 2025 = 11
  assert.equal(restOfWorld({ annual: 100, lastValue: 90, lastYear: 2025 }, [lagging]).lastValue, 79);
});

// Hand-checkable series: 1, 2, 3, ... Gt from 2014, so every year differs.
const rising = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [2014 + i, (i + 1) * G]));  // 2025 = 12 Gt
const B = { ...CFG.budget, since: 2016, from: 2027, thresholds: [{ label: "1.5°C", gt: 150 }, { label: "2°C", gt: 1035 }],
  paris: { base: 2019, target: 2030, cut: 0.48 } };

test("budgetModel: cumulative emissions sum the right years, including the projected one and mid-year starts", () => {
  const m = budgetModel(rising, B, 1, Infinity, 2026);
  // growth 2024 -> 2025 = 12/11, so 2026 is projected at 12 * 12/11 Gt
  const y2026 = 12 * (12 / 11) * G;
  assert.ok(Math.abs(m.rate - y2026) < 1, "rate is this year's projection");
  close(m.cum(2016, 2018), (3 + 4) * G);                          // 2016 and 2017 only
  close(m.cum(2024, 2026.5), (11 + 12) * G + 0.5 * y2026);       // two full years plus half of the projected one
  close(m.cum(2016.5, 2017.5), 0.5 * 3 * G + 0.5 * 4 * G);       // mid-year start and end
  close(m.cum(2027, 2026.5), -0.5 * y2026);                       // negative when t is before the start
});

test("budgetModel: bars count the budget from 1 January of `from`", () => {
  const flat = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [2014 + i, 40 * G]));
  const b15 = budgetModel(flat, B, 1, Infinity, 2026).bars[0];
  close(b15.total, 150 * G + 11 * 40 * G);                        // used 2016..2026 plus the published budget
  const mid = b15.at(2026.5);
  close(mid.left, 150 * G + 0.5 * 40 * G);                        // half of 2026 still to come before 1 January 2027
  close(mid.years, (150 + 20) / 40, 1e-9);
  assert.equal(mid.outYear, Math.floor(2026.5 + mid.years));
  assert.equal(mid.danger, true);
  assert.equal(b15.at(2040).left, 0);                             // never negative
});

test("budgetModel: danger compares years as displayed", () => {
  const flat = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [2014 + i, 40 * G]));
  // pick a budget leaving exactly 9.96 years at 2026.5: shown as "10.0", so not red
  const left = 9.96 * 40;
  const bar = budgetModel(flat, { ...B, thresholds: [{ label: "x", gt: left - 20 }] }, 1, Infinity, 2026).bars[0];
  assert.equal(bar.at(2026.5).danger, false);
});

test("budgetModel: Paris pace check uses the shared verdict words, compared as displayed", () => {
  const flat = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [2014 + i, 40 * G]));
  const m = budgetModel(flat, B, 1, Infinity, 2026);
  assert.equal(m.pace.neededCh, -31);                             // -48 * 7 / 11 = -30.5, shown as -31
  assert.equal(m.pace.actualCh, 0);
  assert.equal(m.pace.verdict.text, "Off track");                 // flat: not cutting, but not rising either
  const up = { ...flat, 2025: 42 * G };
  assert.equal(budgetModel(up, B, 1, Infinity, 2026).pace.verdict.text, "Going backwards");
  const falling = Object.fromEntries(Object.entries(flat).map(([y, v]) => [y, Number(y) >= 2020 ? v * (1 - 0.06 * (Number(y) - 2019)) : v]));
  assert.equal(budgetModel(falling, B, 1, Infinity, 2025).pace.verdict.text, "On track");
});

test("budgetModel: growth cap limits the projected year", () => {
  const jump = { 2024: 10 * G, 2025: 20 * G };
  assert.ok(Math.abs(budgetModel(jump, B, 1, 0.2, 2026).rate - 24 * G) < 1);
});
