/**
 * Vercel ignoreCommand must skip analytics-only commits, never merge ships.
 * Run: node scripts/vercel-analytics-only-skip.test.js
 */
const assert = require("assert");
const skip = require("./vercel-analytics-only-skip");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

ok("single parent is not a merge", skip.isMergeRevListLine("abc parent1") === false);
ok("two parents is a merge", skip.isMergeRevListLine("abc parent1 parent2") === true);
ok("empty rev-list is not a merge", skip.isMergeRevListLine("") === false);

ok(
  "analytics-only skip",
  skip.shouldSkipAnalyticsOnlyBuild(["data/analytics.jsonl"], false) === true
);
ok(
  "admin+analytics does not skip",
  skip.shouldSkipAnalyticsOnlyBuild(["admin.html", "data/analytics.jsonl"], false) === false
);
ok(
  "merge of analytics-only vs first parent does not skip",
  skip.shouldSkipAnalyticsOnlyBuild(["data/analytics.jsonl"], true) === false
);
ok("empty file list does not skip", skip.shouldSkipAnalyticsOnlyBuild([], false) === false);
ok(
  "parse name-only diff",
  skip.parseNameOnlyDiff("data/analytics.jsonl\nadmin.html\n").join(",") ===
    "data/analytics.jsonl,admin.html"
);

console.log("vercel-analytics-only-skip.test.js passed");
