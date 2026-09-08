/**
 * The handoff to the coach's brain: last month, in one paragraph.
 * Run: node scripts/coach-block-handoff.test.js
 *
 * The brain asked for this shape and named the two traps it had fallen into building
 * it (coach agent, 2026-09-08). Both traps are what most of this file guards, because
 * both produce a handoff that READS fine and is wrong:
 *
 *  1. A block can start mid-week, so week 1 does not carry every day. Comparing week 1
 *     with the last week reports whole days as "did not progress" when the truth is
 *     that they did not exist yet.
 *  2. A progression must not end at the DELOAD week: it shows the block getting
 *     easier, which is the opposite of what it did.
 */
const assert = require("assert");

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  passed += 1;
  console.log("ok —", name);
}

const H = require("../lib/coach-block-handoff.js");

function day(title, lines) {
  return { parts: [{ title: title, lines: lines || [] }] };
}
function week(o) {
  const days = { sun: { parts: [] }, mon: { parts: [] }, tue: { parts: [] }, wed: { parts: [] }, thu: { parts: [] }, fri: { parts: [] }, sat: { parts: [] } };
  for (const k of Object.keys(o.days || {})) days[k] = o.days[k];
  return { phase: o.phase || "build", theme: o.theme || "", summaryLine: o.summary || "", days: days, overview: o.overview || [] };
}

/* A block as the brain actually writes one: four weeks, the fourth a deload, a day
   that only starts in week 2 because the block began mid-week. */
const BLOCK = {
  weeks: [
    week({
      phase: "build", theme: "Base engine", summary: "Groove the squat pattern",
      days: { sun: day("Back Squat Heavy Sets", ["5x5 @ RPE7"]), tue: day("Push Press", ["3x8"]), thu: day("Engine", ["AMRAP 12"]) },
    }),
    week({
      phase: "build", theme: "Base engine", summary: "More volume on the pull",
      days: { sun: day("Back Squat Heavy Sets", ["5x5"]), mon: day("Warm-up + core", ["mobility 8 min"]), tue: day("Push Press", ["3x8"]), thu: day("Engine", ["for time 2k row"]) },
    }),
    week({
      phase: "intensify", theme: "Heavier triples", summary: "Move to triples",
      days: { sun: day("Front Squat Heavy Triples", ["5x3"]), tue: day("Push Press Clusters", ["EMOM 10"]), thu: day("Engine", ["chipper"]) },
    }),
    week({
      phase: "deload", theme: "Back off", summary: "Half the volume",
      days: { sun: day("Squat quality", ["3x3 light quality"]), tue: day("Press light", ["2x8"]) },
    }),
  ],
};

const text = H.buildHandoffText({ block: BLOCK, blockIndex: 1, startWeek: 1, deloadWeekIndex: 4, profile: { lifts: {} } });
const lines = text.split("\n");

/* --- the shape they asked for -------------------------------------------- */

ok("the title row names the block and where it sat", lines[0] === "PRIOR BLOCK 1 (absolute weeks 1-4) · deload was week 4 of that block");
ok("one line per week, phase beside the number", /^W1 build · Base engine · Groove the squat pattern$/.test(lines[1]));
ok("the deload week says deload", /^W4 deload · /.test(lines[4]));
ok("the progressions have their own line", /^PROGRESSED: /.test(lines[5]));
ok("so do the formats", /^FORMATS USED: /.test(lines[6]));
ok("and the standing requests", /^STANDING REQUESTS: /.test(lines[7]));
ok("nothing else is said", lines.length === 8);

/* --- trap 1: a day that only starts in week 2 ---------------------------- */

/* Monday is written from week 2 onwards. It must not be reported at all — it did not
   fail to progress, it simply did not exist in week 1. */
ok("a day that started late is not reported as standing still", text.indexOf("mon ") < 0);

/* --- trap 2: the progression ends at the last BUILD week ----------------- */

ok("Sunday's progression ends at the build week", text.indexOf("sun Back Squat Heavy Sets -> Front Squat Heavy Triples") >= 0);
ok("and not at the deload week", text.indexOf("-> Squat quality") < 0);
ok("Tuesday's too", text.indexOf("tue Push Press -> Push Press Clusters") >= 0);
ok("and the deload is reported once, in the title row", (text.match(/deload/g) || []).length === 2);

/* --- what it read off the block ------------------------------------------ */

ok("every format used is named", /FORMATS USED: AMRAP, for time, EMOM, chipper, quality sets/.test(text));
ok("in the order it first appeared", text.indexOf("AMRAP") < text.indexOf("EMOM"));
ok("no numbers on file means load by feel", text.indexOf("no 1RM figures reported, load by RPE") >= 0);
/* This block DID write a warm-up, so that line must not appear. */
ok("a block with a warm-up does not claim otherwise", text.indexOf("no warm-up written") < 0);
ok("and the warm-up is found wherever it was written", H.hasWarmup(BLOCK.weeks) === true);

const noWarmup = { weeks: [week({ days: { sun: day("Back Squat", ["5x5"]) } })] };
const noWarmupText = H.buildHandoffText({ block: noWarmup, blockIndex: 1, startWeek: 1, profile: { lifts: { backSquat: 120 } } });
ok("a block with no warm-up says so", noWarmupText.indexOf("no warm-up written") >= 0);
ok("and numbers on file are not asked for again", noWarmupText.indexOf("load by RPE") < 0);

/* --- a continuation block ------------------------------------------------- */

const second = H.buildHandoffText({ block: BLOCK, blockIndex: 2, startWeek: 5, deloadWeekIndex: 4 });
ok("a second block counts its weeks absolutely", second.indexOf("PRIOR BLOCK 2 (absolute weeks 5-8)") >= 0);
ok("and still numbers its own weeks from one", /\nW1 build/.test(second));

/* The deload is found from the phase when it is not passed in. */
const found = H.buildHandoffText({ block: BLOCK, blockIndex: 1, startWeek: 1 });
ok("the deload is found from the week itself when nobody says", found.indexOf("deload was week 4 of that block") >= 0);
const noDeload = H.buildHandoffText({ block: { weeks: [week({ days: { sun: day("A", ["x"]) } })] }, blockIndex: 1, startWeek: 1 });
ok("a block without one says that instead", noDeload.indexOf("no deload in that block") >= 0);

/* --- the ceiling ---------------------------------------------------------- */

ok("the ceiling is the one they asked for", H.MAX_CHARS === 4000);
const fat = { weeks: [] };
for (let i = 0; i < 12; i++) {
  const days = {};
  for (const k of H.DAY_KEYS) {
    days[k] = day("Movement " + k + i + " " + "x".repeat(60), ["AMRAP " + i + " " + "y".repeat(300)]);
  }
  fat.weeks.push(week({ phase: i === 11 ? "deload" : "build", theme: "T".repeat(200), summary: "S".repeat(400), days: days }));
}
const fatText = H.buildHandoffText({ block: fat, blockIndex: 3, startWeek: 9 });
ok("a fat block is trimmed under the ceiling", fatText.length <= H.MAX_CHARS);
ok("the title row survives the trimming", fatText.split("\n")[0].indexOf("PRIOR BLOCK 3") === 0);
ok("and it is never cut mid-line", fatText.endsWith("\n") === false && fatText.split("\n").every(function (l) { return l.length > 0; }));

/* --- nothing to hand over ------------------------------------------------- */

ok("an empty block hands nothing over", H.buildHandoffText({ block: { weeks: [] }, blockIndex: 1, startWeek: 1 }) === "");
ok("and neither does nothing at all", H.buildHandoffText() === "");

/* --- it is a paragraph, not a document ----------------------------------- */

ok("a real block fits in well under a thousand characters", text.length < 1000);
ok("it is plain text, not JSON", text.indexOf("{") < 0 && text.indexOf("[") < 0);
ok("no LLM and no network in this file", (function () {
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "lib", "coach-block-handoff.js"), "utf8");
  return !/\bfetch\s*\(/.test(src) && !/gemini|groq|generativelanguage/i.test(src);
})());

/* --- and what the admin actually sends (coach agent, 2026-09-08) --------- */

const fs2 = require("fs");
const path2 = require("path");
const admin = fs2.readFileSync(path2.join(__dirname, "..", "admin.html"), "utf8");
const fixedIntake = fs2.readFileSync(path2.join(__dirname, "..", "admin-fixed-intake.js"), "utf8");
const Contract = require("../lib/coach-intake-sync-contract.js");

/* deloadWeekIndex: the contract computes it, and BOTH senders must go through the
   contract. One hand-building its own profile is how the field went missing. */
const profile = Contract.athleteProfileForGenerateBlock(
  { displayName: "A", deloadEveryWeeks: 4, blockStartWeek: 5 },
  { forceIntakeComplete: true }
);
ok("the contract carries the deload week", profile.deloadWeekIndex === 4);
ok("and how long a block is", profile.blockWeeks === 4);
ok("the admin's own builder goes through the contract", admin.indexOf("C.athleteProfileForGenerateBlock(intakeState, {") >= 0);
ok("passing the block it is building", admin.indexOf("blockStartWeek: intakeState.blockStartWeek") >= 0);
ok("and the cadence it deloads on", admin.indexOf("deloadEveryWeeks: intakeState.deloadEveryWeeks") >= 0);
ok("the fixed-intake sender always did", fixedIntake.indexOf("C().athleteProfileForGenerateBlock(intakeState, {") >= 0);

/* blockHandoff: the field name the server already reads, from both senders. */
const coachApi = fs2.readFileSync(path2.join(__dirname, "..", "api", "personal-coach.js"), "utf8");
ok("the server reads body.blockHandoff", coachApi.indexOf("if (body.blockHandoff) {") >= 0);
ok("the page loads the builder", admin.indexOf('<script src="lib/coach-block-handoff.js"></script>') >= 0);
ok("the admin builds it from the athlete's own snapshot", admin.indexOf("function coachBlockHandoffFor(a)") >= 0);
ok("counting which block it is", admin.indexOf("blockIndex: past + 1") >= 0);
ok("and where that block sits in the plan", admin.indexOf("startWeek: startWeek") >= 0);
ok("the intake sender attaches it", admin.indexOf("blockHandoff: coachBlockHandoffFor(adminCurrentAthlete()) || undefined") >= 0);
ok("so does the fixed-intake sender", fixedIntake.indexOf("payload.blockHandoff = handoff;") >= 0);
/* A first block has no last month, and must not pretend to. */
ok("nothing is sent when there is no previous block", admin.indexOf('if (!a || !window.CoachBlockHandoff || !a.currentBlock) return "";') >= 0);

console.log("\nAll coach block handoff checks passed (" + passed + " assertions).");
