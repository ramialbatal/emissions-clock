// Unit tests for the plain-language messages. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { co2Headline, methaneHeadline, budgetStatus, paceStatus, trendBadge } from "../js/messages.js";

test("co2Headline: one clear answer per pace verdict", () => {
  assert.equal(co2Headline("backwards").tone, "bad");
  assert.equal(co2Headline("backwards").title, "We're heading the wrong way");
  assert.equal(co2Headline("offTrack").tone, "warn");
  assert.equal(co2Headline("close").title, "Almost on track");
  assert.equal(co2Headline("onTrack").tone, "ok");
});

test("methaneHeadline follows the trend as displayed", () => {
  assert.equal(methaneHeadline(0.012).tone, "bad");
  assert.equal(methaneHeadline(-0.012).tone, "ok");
  assert.equal(methaneHeadline(0.0004).title, "Methane isn't falling yet");   // +0.04% shows as 0.0%
});

test("budgetStatus: colour and words from the years left", () => {
  assert.deepEqual([budgetStatus(3.5).tone, budgetStatus(3.5).title, budgetStatus(3.5).text],
    ["bad", "Almost used up", "About 3.5 years left at today's pace"]);
  assert.equal(budgetStatus(11.8).title, "Running out");
  assert.equal(budgetStatus(23.7).title, "Some room left");
  assert.equal(budgetStatus(0).title, "Used up");
  assert.equal(budgetStatus(4.96).title, "Running out");                     // shows as 5.0 years, so not "almost"
});

test("paceStatus says what should have happened and what did", () => {
  const m = paceStatus("backwards", 2.8, -31, 2019);
  assert.equal(m.tone, "bad");
  assert.equal(m.title, "No, still rising");
  assert.equal(m.text, "They should be 31% lower than in 2019 by now. They're 2.8% higher.");
  assert.equal(paceStatus("offTrack", -4, -31, 2019).text, "They should be 31% lower than in 2019 by now. They're 4.0% lower.");
  assert.equal(paceStatus("onTrack", -35, -31, 2019).title, "Yes, fast enough");
});

test("trendBadge: rising is bad, falling is good, as displayed", () => {
  assert.deepEqual(trendBadge(0.02), { tone: "bad", label: "▲ Rising" });
  assert.deepEqual(trendBadge(-0.02), { tone: "ok", label: "▼ Falling" });
  assert.deepEqual(trendBadge(0.0004), { tone: "warn", label: "● Steady" });
  assert.deepEqual(trendBadge(null), { tone: "", label: "" });
});
