/**
 * POL-027 — floor/BW baseline + additive equipment.
 * Run: node scripts/pol027-equipment-baseline.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const policy = require("../api/coach-policy.js");
const foundation = require("../api/coach-foundation-brief.js");
const pc = fs.readFileSync(path.join(root, "api/personal-coach.js"), "utf8");
const rules = fs.readFileSync(
  path.join(root, "experiments/personal-coach/coach-policy-rules.md"),
  "utf8"
);
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

ok("POL-027 in rules md", /POL-027/.test(rules));
ok("POL-027 in synced policy js", /POL-027/.test(policy));
ok("enhancement / additive language", /ENHANCEMENT|ADDITIVE|additive/i.test(policy));
ok("baseline burpee/lunge in policy", /burpee/i.test(policy) && /lunge/i.test(policy));
ok("full pool markers", /Cossack|Hollow|Mountain climber|Jumping jack/i.test(policy));
ok("combine free weights in policy", /DB\/KB squat|COMBINE/i.test(policy));
ok("POL-027 in foundation brief", /POL-027/.test(foundation));
ok("POL-027 in programming core", /EQUIPMENT-INDEPENDENT MOVEMENTS|Equipment inventory is ADDITIVE/.test(pc));
ok("coach version 2.3.2", /COACH_VERSION = "2\.3\.2"/.test(pc) && /COACH_VERSION = "2\.3\.2"/.test(index));

console.log("All POL-027 equipment-baseline checks passed.");
