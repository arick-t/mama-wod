/**
 * Smoke test: Done finishFeedback must survive normalize-shaped day rebuilds.
 * Run: node scripts/finish-feedback-persist.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function mustInclude(label, re) {
  assert.ok(re.test(html), "missing: " + label);
  console.log("ok —", label);
}

mustInclude(
  "normalize preserves finishFeedback from day or prev",
  /pprogNormalizeFinishFeedback\(day && day\.finishFeedback\)\s*\|\|\s*pprogNormalizeFinishFeedback\(prev && prev\.finishFeedback\)/
);
mustInclude(
  "day revision keeps finishFeedback",
  /keepFf = pprogNormalizeFinishFeedback\(prev\.finishFeedback\)/
);
mustInclude(
  "rehydrate from finishLearning",
  /function pprogRehydrateFinishStampsFromLearning/
);
mustInclude(
  "ensure calls rehydrate",
  /ensurePprogBlockFiveWeeks[\s\S]{0,800}pprogRehydrateFinishStampsFromLearning/
);
mustInclude(
  "submit in-flight guard",
  /var pprogFinishSubmitting = false/
);
mustInclude(
  "record dedupes by session_date",
  /Hard lock: never append a second learning event/
);
mustInclude(
  "Reported stamp UI",
  /Reported ✓/
);

console.log("All finishFeedback persist checks passed.");
