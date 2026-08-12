/**
 * Block normalization — blockStart + 5 weeks when generate_block omits blockStart.
 * Run: node scripts/normalize-pprog-block.test.js
 */
const assert = require("assert");
const N = require("../lib/normalize-pprog-block");

const raw = {
  summaryLine: "5-week engine block",
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
assert.strictEqual(out.weeks.length, 5, "always 5 weeks");
assert.ok(out.weeks[0].weekStart, "week 1 has weekStart");
assert.ok(out.weeks[0].days.sun && out.weeks[0].days.sun.parts.length, "sun parts preserved");

const again = N.normalize(out, out);
assert.strictEqual(again.blockStart, out.blockStart, "stable re-normalize");

console.log("normalize-pprog-block.test.js: ok");
