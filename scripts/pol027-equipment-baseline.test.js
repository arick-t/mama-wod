/**
 * POL-027 — floor/BW baseline + additive equipment + Enhancement Grammar.
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
ok("combine / grammar in policy", /Enhancement Grammar|loaded-variation tree/i.test(policy));
ok("DB case-study tree", /goblet\/front-rack|burpee-over-DB/i.test(policy));
ok("never closed whitelist", /never a closed whitelist/i.test(policy));
ok("do not re-ask equipment", /Do \*\*not\*\* re-ask equipment|do not re-ask equipment/i.test(rules));

const grammarMatch = rules.match(
  /4\. \*\*Enhancement Grammar[\s\S]*?(?=\n  5\. \*\*)/
);
ok("grammar block present", !!grammarMatch);
ok(
  "grammar ≤1500 chars (Budget ceiling)",
  grammarMatch && grammarMatch[0].length <= 1500
);
console.log("    grammar_chars:", grammarMatch ? grammarMatch[0].length : 0);

ok("POL-027 in foundation brief", /POL-027/.test(foundation));
ok(
  "foundation is summary not full table",
  /Enhancement Grammar lives in COACH POLICY/i.test(foundation) &&
    !/burpee-over-DB/i.test(foundation)
);
ok(
  "programming core points to grammar",
  /Enhancement Grammar|loaded-variation tree/i.test(pc)
);
ok(
  "programming core does not duplicate full inventory table",
  !/\*\*Odd object\*\*:|\*\*Med\/Slam\*\*:/.test(pc)
);
ok("coach version 2.3.6", /COACH_VERSION = "2\.3\.6"/.test(pc) && /COACH_VERSION = "2\.3\.6"/.test(index));
ok(
  "lift kg not equipment permission",
  /Lift \/ skill numbers ≠ equipment permission|lift\/skill kg numbers are capability only/i.test(
    rules + policy + pc
  )
);
ok("generic anti pattern-dominance", /single-pattern dominance|pattern coverage \+ anti-spam/i.test(rules + policy) && /repeated identical couplet\/triplet|single-pattern dominance/i.test(rules + policy + pc));
ok("weekly lunge + wall coverage", /lunge-family/i.test(rules) && /wall-sit|wall pattern/i.test(rules));
ok("no movement-specific thruster anti-spam wording", !/do not thruster-spam|avoid thruster-spam|no thruster-spam/i.test(rules + pc));
ok("trainingSetup in programming memory", /trainingSetup: profile\.trainingSetup/.test(pc));
ok("trainingSetup in athlete payload", /trainingSetup: s\.trainingSetup/.test(index));
ok("generate_block no barbell DL steer", !/Deadlift then Front Squat/i.test(pc));

/* Chat path must not get the full grammar table via a dedicated chat inject */
ok(
  "no chat-only full grammar dump marker",
  !/CHAT ENHANCEMENT GRAMMAR TABLE/i.test(pc)
);

console.log("All POL-027 equipment-baseline checks passed.");
