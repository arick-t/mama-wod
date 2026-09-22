/**
 * Block normalization — blockStart, and as many weeks as it was given.
 *
 * It used to pad every block to five and label the fifth a deload, for an athlete who may
 * have asked for no deload at all — and it dropped a sixth week without a word. A brick is
 * four weeks of training and a deload is a cadence the intake chooses (POL-032).
 * Run: node scripts/normalize-pprog-block.test.js
 */
const assert = require("assert");
const N = require("../lib/normalize-pprog-block");

const raw = {
  summaryLine: "Engine block",
  weeks: [
    {
      weekIndex: 1,
      theme: "Base",
      summaryLine: "Week 1",
      days: {
        sun: { parts: [{ title: "Strength", lines: ["Back squat 5x5"] }] },
        mon: { parts: [{ title: "Engine", lines: ["AMRAP 12"] }] },
      },
    },
  ],
};

const out = N.normalize(raw, null);
assert.ok(out.blockStart && /^\d{4}-\d{2}-\d{2}$/.test(out.blockStart), "blockStart ISO");
assert.strictEqual(out.weeks.length, 1, "one week in, one week out — nothing is padded");
assert.ok(
  !out.weeks.some(function (w) { return w.phase === "deload"; }),
  "no week is called a deload unless the coach wrote it as one"
);

/* Four in, four out — and a block already saved with five keeps its five: the rule is
   "do not add one", never "cut to four". */
function weekAt(i) {
  return {
    weekIndex: i,
    days: { sun: { parts: [{ title: "Strength", lines: ["Back squat 5x5"] }] } },
  };
}
const four = N.normalize({ weeks: [weekAt(1), weekAt(2), weekAt(3), weekAt(4)] }, null);
assert.strictEqual(four.weeks.length, 4, "a four-week block stays four");
assert.ok(!four.weeks.some(function (w) { return w.phase === "deload"; }), "and gains no deload");

const five = N.normalize({ weeks: [weekAt(1), weekAt(2), weekAt(3), weekAt(4), weekAt(5)] }, null);
assert.strictEqual(five.weeks.length, 5, "a block saved with five weeks keeps them");

const six = N.normalize({ weeks: [weekAt(1), weekAt(2), weekAt(3), weekAt(4), weekAt(5), weekAt(6)] }, null);
assert.strictEqual(six.weeks.length, 6, "and a sixth week is no longer dropped in silence");

/* A deload the coach DID write keeps its label, wherever it sits. */
const marked = N.normalize(
  { weeks: [weekAt(1), weekAt(2), Object.assign(weekAt(3), { phase: "deload" }), weekAt(4)] },
  null
);
assert.strictEqual(marked.weeks[2].phase, "deload", "a written deload survives");
assert.strictEqual(marked.weeks[3].phase, "build", "and does not spread to the last week");
assert.ok(out.weeks[0].weekStart, "week 1 has weekStart");
assert.ok(out.weeks[0].days.sun && out.weeks[0].days.sun.parts.length, "sun parts preserved");

const again = N.normalize(out, out);
assert.strictEqual(again.blockStart, out.blockStart, "stable re-normalize");

console.log("normalize-pprog-block.test.js: ok");
