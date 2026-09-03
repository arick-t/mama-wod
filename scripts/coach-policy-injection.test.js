/**
 * The coach must receive the WHOLE rule book — POL-020 guard.
 *
 * Why this file exists: from 2026-07-29 to 2026-09-01, `coachPolicyBlock()` ended in
 * `raw.slice(0, 12000)` — a character budget copied from the old Groq free-tier
 * tokens-per-minute estimate. The policy grew 18KB -> 45KB behind it, so 24 of 38
 * rules (POL-016, POL-020, POL-027, POL-022/023/024, all POL-COST) never reached
 * either the programming system or chat. Nothing in the suite noticed, because every
 * other coach test asserts that a rule exists in coach-policy.js — not that it
 * survives the trip into the prompt.
 *
 * So this test does not read the policy file. It executes the real injection function
 * against the real policy and checks what comes out the other side.
 *
 * Run: node scripts/coach-policy-injection.test.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const PC_PATH = path.join(root, "api", "personal-coach.js");
const COACH_POLICY = require("../api/coach-policy.js");

let passed = 0;
function ok(name, cond, detail) {
  if (!cond) {
    console.error("FAIL:", name, detail || "");
    process.exitCode = 1;
    throw new Error(name);
  }
  passed++;
  console.log("ok —", name);
}

const src = fs.readFileSync(PC_PATH, "utf8");

/** Pull the live coachPolicyBlock out of the handler and run it with a chosen env. */
function runPolicyBlock(env) {
  const m = src.match(/\nfunction coachPolicyBlock\(\)\s*\{[\s\S]*?\n\}\n/);
  if (!m) throw new Error("coachPolicyBlock() not found in api/personal-coach.js");
  /* eslint-disable no-new-func */
  const fn = new Function(
    "COACH_POLICY",
    "process",
    m[0] + "\nreturn coachPolicyBlock();"
  );
  return fn(COACH_POLICY, { env: env || {} });
}

function uniquePolIds(text) {
  const found = String(text || "").match(/POL-[A-Z0-9]+(?:-[0-9]+)?/g) || [];
  return Array.from(new Set(found)).sort();
}

function testWholePolicyArrives() {
  const block = runPolicyBlock({});
  const policy = String(COACH_POLICY).trim();

  ok(
    "policy is a non-trivial string",
    typeof COACH_POLICY === "string" && policy.length > 20000,
    "length=" + policy.length
  );
  ok(
    "the whole policy reaches the prompt",
    block.indexOf(policy) >= 0,
    "block=" + block.length + " policy=" + policy.length
  );

  const all = uniquePolIds(policy);
  const arrived = uniquePolIds(block);
  const missing = all.filter(function (id) {
    return arrived.indexOf(id) < 0;
  });
  ok(
    "every POL rule id survives injection (" + all.length + " rules)",
    missing.length === 0,
    "missing: " + missing.join(", ")
  );

  /* The rules the 12000-char cut used to eat. Named so a future regression is legible. */
  [
    "POL-016",
    "POL-019",
    "POL-020",
    "POL-022",
    "POL-023",
    "POL-024",
    "POL-026",
    "POL-027",
    "POL-COST-010",
  ].forEach(function (id) {
    ok(
      "rule reaches the coach: " + id,
      all.indexOf(id) < 0 || block.indexOf(id) >= 0,
      id + " is in the policy but not in the injected block"
    );
  });
}

function testNoSilentCap() {
  const m = src.match(/\nfunction coachPolicyBlock\(\)\s*\{[\s\S]*?\n\}\n/);
  const body = m ? m[0] : "";
  ok(
    "coachPolicyBlock holds no hard-coded character cap",
    !/\.slice\(\s*0\s*,\s*\d+\s*\)/.test(body),
    "a numeric slice is back in coachPolicyBlock — that is the 2026-08 defect"
  );
}

function testEmergencyValve() {
  const capped = runPolicyBlock({ COACH_POLICY_MAX_CHARS: "500" });
  ok(
    "COACH_POLICY_MAX_CHARS still trims when deliberately set",
    capped.length < 700 && capped.length > 400,
    "length=" + capped.length
  );
  const ignored = runPolicyBlock({ COACH_POLICY_MAX_CHARS: "0" });
  ok(
    "a zero/blank override is ignored, not treated as an empty policy",
    ignored.indexOf(String(COACH_POLICY).trim()) >= 0
  );
}

function testBothPathsStillInject() {
  const calls = src.match(/coachPolicyBlock\(\)/g) || [];
  ok(
    "coachPolicyBlock is injected on both the programming and chat systems",
    calls.length >= 2,
    "call sites: " + calls.length
  );
  const programming = src.indexOf("PROGRAMMING_SYSTEM_CORE +\n      LEGAL_SAFETY_DIRECTIVE +\n      coachPolicyBlock()");
  ok(
    "the programming system still opens with core + safety + policy",
    programming >= 0,
    "programming system assembly changed — re-check that policy is still injected there"
  );
}

/* A block became four weeks on 2026-09-02, but six lines of the policy the coach reads verbatim
   still said five — POL-008, POL-009, POL-016, POL-023 (twice) and POL-COST. Four of them sit in
   rules that the 12,000-character slice used to cut off, so fixing the truncation is what delivered
   the stale number to the model: the layers said four weeks and the policy said five, inside the
   same prompt. Guard the source of truth, not the generated file. */
function testBlockLengthIsFourWeeks() {
  const md = fs.readFileSync(
    path.join(__dirname, "..", "experiments", "personal-coach", "coach-policy-rules.md"),
    "utf8"
  );
  ok(
    "the policy rules never call a brick five weeks",
    !/5[- ]week|five[- ]week|next 5 weeks/i.test(md),
    "a five-week reference is back in the policy the coach reads"
  );
  ok(
    "the synced policy module carries no five-week language either",
    !/5[- ]week|five[- ]week|next 5 weeks/i.test(String(COACH_POLICY)),
    "coach-policy.js is out of sync with the rules, or a new rule says five weeks"
  );
  /* The one live request string that names a week count: the retry sent when a block generation
     came back without valid JSON. It reaches the model on the continuation path, which is exactly
     where a wrong week count does damage. The athlete-side intake builder in the same file still
     says five and is KNOWN debt for the migration branch — it sits behind
     ATHLETE_AI_BUILD_ENABLED, which is off. */
  const app = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  /* The coach's OWN instructions said five weeks in fifteen places while the intake packet asked
     for four — two contradictory orders inside one request, which is exactly how a five-week brick
     gets built. Found 2026-09-03 while writing the output contract for the admin module. */
  const pcSrc = fs.readFileSync(PC_PATH, "utf8");
  ok(
    "the coach never asks the model for a five-week brick",
    !/5[- ]week|five[- ]week|next 5 weeks|exactly 5 weeks/i.test(pcSrc),
    "a five-week instruction is back in personal-coach.js"
  );
  ok(
    "the deload week is taken from the request, not assumed",
    /NAMED IN THE REQUEST/.test(pcSrc) && /NEVER add a fifth/.test(pcSrc)
  );
  ok(
    "the block retry asks the coach for four weeks",
    /Return only a full BLOCK_JSON with exactly 4 weeks now/.test(app),
    "the retry instruction is asking for a week count the brick no longer has"
  );
}

/* POL-029, added 2026-09-03 as a product foundation rather than a programming preference. It is
   the rule that makes a repeated block a violation in its own right, so it has to survive
   injection like every other id — and the maintainers' note has to tie it to POL-009. */
function testClientImprovesRule() {
  const md = fs.readFileSync(
    path.join(__dirname, "..", "experiments", "personal-coach", "coach-policy-rules.md"),
    "utf8"
  );
  const pol = String(COACH_POLICY);
  ok("POL-029 exists at the source of truth", /### POL-029/.test(md));
  ok("POL-029 is HARD and global", /### POL-029[\s\S]{0,200}\*\*Type:\*\* HARD/.test(md));
  ok("POL-029 survives injection into the prompt", /POL-029/.test(pol));
  ok("two identical blocks are a failure in the policy itself",
    /Two identical blocks are a failure even when both are good blocks/i.test(
      pol.replace(/\s+/g, " ")
    ));
  ok("the studio case is stronger, not weaker, in the policy",
    /the requirement is stronger rather than weaker/i.test(pol.replace(/\s+/g, " ")));
  ok("an unchanged intake is not a licence to repeat, in the policy",
    /the constraints repeat, the work does not/i.test(pol.replace(/\s+/g, " ")));
  ok("the maintainers note ties POL-029 to POL-009",
    /\*\*POL-029\*\* is a product foundation[\s\S]{0,200}POL-009/.test(md));
}

function main() {
  console.log("\n=== Coach policy injection (POL-020 guard) ===\n");
  testWholePolicyArrives();
  testNoSilentCap();
  testEmergencyValve();
  testBothPathsStillInject();
  testBlockLengthIsFourWeeks();
  testClientImprovesRule();
  console.log("\nPassed:", passed);
  if (process.exitCode) {
    console.error("\nPOLICY INJECTION CHECKS FAILED");
    process.exit(1);
  }
  console.log("\nPOLICY INJECTION CHECKS PASSED");
}

main();
