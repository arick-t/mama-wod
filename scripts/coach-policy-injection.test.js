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

/* The mid-week clamp, found leaking into week 2 on 2026-09-03 while filling a real test brick.
   Monday and Tuesday came back REST in week 2 — correct in week 1, two lost training days a week
   after that. The rule now takes the week index and says the opposite thing for a future week. */
/* POL-029 widened from block-to-block to week-to-week inside a brick, and the data half that makes
   it possible: the week-fill prompt now carries a compact movement inventory of the earlier weeks.
   Both halves asserted, because either alone does nothing. */
/* The computed half of the 1RM gate. The cadence is arithmetic on blockStartWeek, so it needs no
   memory of when a lift was last tested — and an unknown brick number must read as NO, because a
   test we cannot date is a test we do not run. */
function testOneRmGateIsComputed() {
  const src = fs.readFileSync(PC_PATH, "utf8");
  ok("the brick index is derived from the absolute start week",
    /function brickIndexFromStartWeek\(blockStartWeek\)/.test(src));
  ok("the window cadence is in code, not left to the model",
    /function oneRmWindowOpen\(blockStartWeek, competitor\)/.test(src) &&
      /const every = competitor \? 4 : 6;/.test(src) &&
      /if \(bi < 3\) return false;/.test(src));
  ok("an unknown brick number forbids testing",
    /a test we cannot date is a test we do not run/i.test(src.replace(/\s+/g, " ")));
  ok("the gate reaches the programming prompt",
    /oneRmTestGateText\(opts && opts\.blockStartWeek, profile, opts\)/.test(src));
  ok("a closed window stops the coach and bans a testing week theme",
    /YOU DO NOT TEST IN THIS BRICK/.test(src) && /do not name a week/.test(src));
  /* And it stops the COACH only. The owner is why the cadence is safe, and POL-030 puts his manual
     decision above HARD policy — a gate that blocked him would invert the product. */
  ok("the gate says out loud that it does not bind the human coach",
    /THIS BINDS YOU, NOT THE HUMAN COACH/.test(src) &&
      /is HIS call, not yours/.test(src));
  ok("an authorisation from the owner opens the window whatever the cadence says",
    /allowOneRmTest === true\) out\.allowOneRmTest = true/.test(src) &&
      /THE HUMAN COACH HAS AUTHORISED A TEST IN THIS BRICK/.test(src) &&
      /His instruction opens the window /.test(src) &&
      /whatever the cadence says/.test(src));
  ok("an open window is permission and not an instruction",
    /an open window is permission, not an instruction/.test(src));
  ok("an open window still forbids two maximal efforts in one session",
    /ONE MAJOR LIFT PER SESSION, on its own day\. Never two maximal efforts in one session/.test(
      src
    ));
  ok("the test day carries nothing else maximal",
    /carries no heavy volume of a second/.test(src) && /A 100% single earns the whole day/.test(src));
}

function testSameBrickWeekContinuity() {
  const src = fs.readFileSync(PC_PATH, "utf8");
  const pol = String(COACH_POLICY).replace(/\s+/g, " ");
  ok("POL-029 covers weeks inside a brick, not only brick to brick",
    /This holds BETWEEN WEEKS of one brick as well as between bricks/i.test(pol));
  ok("rotating the format while keeping the movements is refused in the policy",
    /rotating the FORMAT while keeping every movement is not rotation/i.test(pol));
  ok("the coach can summarise the earlier weeks of a brick",
    /function priorWeeksSummary\(priorWeeks, weekIndex\)/.test(src) &&
      /function priorWeeksBlock\(body, weekIndex\)/.test(src));
  ok("both week-detail prompts carry it",
    (src.match(/  priorWeeksBlock\(body, weekIndex\) \+/g) || []).length === 2,
    "a week-fill prompt is still blind to the rest of the brick");
  /* The summary carried "24 inch box" out of week 1 and week 2 dutifully wrote "24 in box" — a
     prior-week digest teaches whatever it repeats, mistakes included. Imperial is stripped for
     that reason and not for tidiness. */
  ok("the summary strips imperial units too, so it cannot teach them forward",
    /prior-week summary that carries "24 inch box" forward/i.test(src) &&
      /in\|inch\|inches\|ft\|foot\|feet\|lb\|lbs/.test(src));
  ok("the summary strips loads and keeps movements",
    /movements only, loads stripped/i.test(src));
  /* Match the phrase halves separately: the sentence is split across two JS string literals, so
     whitespace-normalising the SOURCE still leaves a `" + "` between them. */
  ok("a missing summary is stated rather than guessed",
    /NO PRIOR-WEEK DATA WAS SENT/.test(src) &&
      /do not guess what the earlier weeks contained/i.test(src) &&
      /claim continuity you cannot see/i.test(src));
  ok("the app sends the earlier weeks of the brick",
    /priorWeeks: \(\(store\.currentBlock && store\.currentBlock\.weeks\) \|\| \[\]\)\.slice\(0, wi\)/.test(
      fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8")
    ));
}

function testMidWeekClampIsWeekScoped() {
  const src = fs.readFileSync(PC_PATH, "utf8");
  ok(
    "the mid-week rule takes a week index",
    /function midWeekStartRuleText\(weekIndex\)/.test(src),
    "the clamp is week-blind again"
  );
  ok(
    "a future week is told the clamp does not apply",
    /IS ENTIRELY IN THE FUTURE/.test(src) &&
      /do NOT carry it \" \+[\s\S]{0,40}forward into this week/.test(src)
  );
  ok(
    "a future week programs every scheduled training day",
    /Program EVERY scheduled training day here/.test(src)
  );
  ok(
    "both week-detail prompts pass the week index",
    (src.match(/  midWeekStartRuleText\(weekIndex\) \+/g) || []).length === 2,
    "a week-detail prompt is still calling it without the index"
  );
}

function main() {
  console.log("\n=== Coach policy injection (POL-020 guard) ===\n");
  testWholePolicyArrives();
  testNoSilentCap();
  testEmergencyValve();
  testBothPathsStillInject();
  testBlockLengthIsFourWeeks();
  testClientImprovesRule();
  testMidWeekClampIsWeekScoped();
  testSameBrickWeekContinuity();
  testOneRmGateIsComputed();
  console.log("\nPassed:", passed);
  if (process.exitCode) {
    console.error("\nPOLICY INJECTION CHECKS FAILED");
    process.exit(1);
  }
  console.log("\nPOLICY INJECTION CHECKS PASSED");
}

main();
