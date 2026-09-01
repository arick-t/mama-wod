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

function main() {
  console.log("\n=== Coach policy injection (POL-020 guard) ===\n");
  testWholePolicyArrives();
  testNoSilentCap();
  testEmergencyValve();
  testBothPathsStillInject();
  console.log("\nPassed:", passed);
  if (process.exitCode) {
    console.error("\nPOLICY INJECTION CHECKS FAILED");
    process.exit(1);
  }
  console.log("\nPOLICY INJECTION CHECKS PASSED");
}

main();
