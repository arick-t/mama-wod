/**
 * POL-026 smoke: policy + prompts + client heuristics for extra completed sessions.
 * Run: node scripts/pol026-extra-session.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const policy = require("../api/coach-policy.js");
const pc = fs.readFileSync(path.join(root, "api/personal-coach.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const rules = fs.readFileSync(
  path.join(root, "experiments/personal-coach/coach-policy-rules.md"),
  "utf8"
);

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

ok("POL-026 in coach-policy.js", /POL-026/.test(policy));
ok("POL-026 in coach-policy-rules.md", /POL-026/.test(rules));
ok("POL-026 in personal-coach brick chat", /POL-026/.test(pc));
ok("ingest + weigh language in API", /WEIGH INTO PLAN|weigh the load/i.test(pc));
ok("legal exception for schedule swaps", /schedule \/ completed-session reports are NOT medical/i.test(pc));
ok("client extraSessions store", /store\.extraSessions/.test(index));
ok("client heuristic helper", /function pprogNoteIsExtraCompletedSession/.test(index));
ok("Hebrew rest-shift in schedule regex", index.indexOf("מחר") >= 0 && index.indexOf("מנוחה") >= 0);
ok("extra sessions block builder", /function buildExtraSessionsBlock/.test(pc));
ok("ATHLETE_EXTRA_SESSIONS card", /ATHLETE_EXTRA_SESSIONS/.test(pc));

console.log("All POL-026 checks passed.");
