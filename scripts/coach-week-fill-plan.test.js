/**
 * Four calls, in order — the plan, and how it recovers.
 * Run: node scripts/coach-week-fill-plan.test.js
 *
 * One `generate_block` returns week 1 and three HEADERS. Nobody was making the three
 * `generate_week_detail` calls, so every athlete had one week of training and three
 * empty ones (coach agent, 2026-09-08).
 *
 * The four rules the brain named are correctness rules, not preferences, and each one
 * has its own failure mode if it slips:
 *
 *  1. serial — three parallel calls all see only week 1 and reach the same conclusions,
 *     so the month repeats itself;
 *  2. priorWeeks carries the FULL weeks — the server compacts them itself, and
 *     shortening them here takes the variety away;
 *  3. save and show each week as it lands, not four at the end;
 *  4. resume runs only what is missing — a rebuild costs money and rewrites weeks the
 *     owner has already approved.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  passed += 1;
  console.log("ok —", name);
}

const P = require("../lib/coach-week-fill-plan.js");
const root = path.join(__dirname, "..");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const snapshot = fs.readFileSync(path.join(root, "scripts", "lib", "admin", "admin-snapshot.js"), "utf8");

/* A header, exactly as generate_block returns weeks 2–4: theme, phase, summaryLine and
   a seven-day overview — rest lines included — with days empty. */
function header(i) {
  return {
    weekIndex: i,
    phase: i === 4 ? "deload" : "build",
    theme: "Theme " + i,
    summaryLine: "Summary " + i,
    overview: [
      { day: "sun", label: "Sun", focus: "Squat" },
      { day: "mon", label: "Mon", focus: "Rest" },
      { day: "tue", label: "Tue", focus: "Engine" },
      { day: "wed", label: "Wed", focus: "Rest" },
      { day: "thu", label: "Thu", focus: "Pull" },
      { day: "fri", label: "Fri", focus: "Rest" },
      { day: "sat", label: "Sat", focus: "Rest" },
    ],
    days: {},
  };
}
function filled(i, title) {
  const w = header(i);
  w.days = {
    sun: { parts: [{ title: title || "Back Squat", lines: ["5x5"] }] },
    mon: { parts: [] },
    tue: { parts: [] },
    wed: { parts: [] },
    thu: { parts: [] },
    fri: { parts: [] },
    sat: { parts: [] },
  };
  return w;
}

/* --- what came back is one week and three headers ------------------------ */

const asReturned = { blockStart: "2026-09-06", weeks: [filled(1), header(2), header(3), header(4)] };
const plan0 = P.planFor(asReturned);
ok("the block has four weeks", plan0.total === 4);
ok("only one of them is written", plan0.written === 1);
ok("and the other three are what is missing", plan0.missing.join(",") === "2,3,4");
ok("week 2 is next, always", plan0.next === 2);
ok("so the block is not done", plan0.done === false);

/* THE trap in reading "written": a header carries a full overview with rest lines in
   it. Reading those as written made every empty week look finished. */
ok("a header is not a written week", P.weekIsWritten(header(2)) === false);
ok("even though it has a seven-day overview with rests in it", header(2).overview.length === 7);
ok("a week with one training day and six rests IS written", P.weekIsWritten(filled(2)) === true);

/* --- the body of one fill ------------------------------------------------- */

const body = P.weekFillBody({
  block: asReturned,
  weekIndex: 2,
  athleteProfile: { displayName: "A", deloadWeekIndex: 4 },
  studioIntake: { room: "box" },
  blockStartWeek: 5,
  athleteId: "ath_1",
});
ok("it asks for a week to be detailed", body.action === "generate_week_detail");
ok("for the week that is missing", body.weekIndex === 2);
ok("carrying the SAME profile the block was built from", body.athleteProfile.deloadWeekIndex === 4);
ok("and the header the block itself came back with", body.theme === "Theme 2" && body.phase === "build" && body.summaryLine === "Summary 2");
ok("the overview travels as the day map", body.overview.length === 7);
ok("where this block sits in the plan", body.blockStartWeek === 5);
ok("and it insists on JSON", body.forceJson === true);
/* Rule 2: full weeks, unshortened. The server compacts them itself. */
ok("priorWeeks carries the week already written", body.priorWeeks.length === 1);
ok("as a FULL object, days and all", !!body.priorWeeks[0].days && !!body.priorWeeks[0].days.sun.parts.length);
ok("a studio is decided by the presence of the room", body.studioIntake.room === "box");
const noStudio = P.weekFillBody({ block: asReturned, weekIndex: 2, athleteProfile: {} });
ok("and it is never sent empty", Object.prototype.hasOwnProperty.call(noStudio, "studioIntake") === false);
ok("nothing to ask for is nothing", P.weekFillBody({ block: asReturned, weekIndex: 9 }) === null);

/* --- the whole walk, serial ---------------------------------------------- */

let block = asReturned;
const asked = [];
const priorCounts = [];
for (let step = 0; step < 5; step++) {
  const plan = P.planFor(block);
  if (plan.done) break;
  const b = P.weekFillBody({ block: block, weekIndex: plan.next, athleteProfile: {} });
  asked.push(b.weekIndex);
  priorCounts.push(b.priorWeeks.length);
  const applied = P.applyWeek(block, {
    weekIndex: plan.next,
    days: filled(plan.next, "Week " + plan.next + " work").days,
  });
  ok("week " + plan.next + " goes in", applied.ok);
  block = applied.block;
}
ok("the weeks were asked for in order", asked.join(",") === "2,3,4");
/* Rule 1, measured: each call saw one more week than the one before it. Three parallel
   calls would all have seen exactly one. */
ok("and each one saw the weeks before it", priorCounts.join(",") === "1,2,3");
ok("the block ends whole", P.planFor(block).done === true);
ok("with every week written", P.planFor(block).written === 4);

/* --- what a filled week may and may not change --------------------------- */

const hijack = P.applyWeek(asReturned, {
  weekIndex: 3,
  theme: "Something else entirely",
  phase: "peak",
  summaryLine: "Not what was planned",
  days: filled(3).days,
});
ok("a filled week is put in", hijack.ok && P.weekIsWritten(hijack.block.weeks[2]));
/* The brain was asked to fill the week that was PLANNED. If it answers with a different
   theme, the plan is what counts — the block's own header stays. */
ok("but it cannot rewrite the plan's own theme", hijack.block.weeks[2].theme === "Theme 3");
ok("nor its phase", hijack.block.weeks[2].phase === "build");
ok("and the week it came back for is the week it fills", hijack.block.weeks[1].days.sun === undefined);
ok("a week with no days is refused", P.applyWeek(asReturned, { weekIndex: 2 }).ok === false);
ok("so is a week that is not in this block", P.applyWeek(asReturned, { weekIndex: 44, days: {} }).ok === false);
ok("and the block handed in is never mutated", P.weekIsWritten(asReturned.weeks[2]) === false);

/* --- what he reads while it happens -------------------------------------- */

ok("the bar counts", P.progressText({ week: 3, total: 4 }) === "בונה שבוע 3 מתוך 4…");
ok("and says when it is whole", P.progressText({ done: true, total: 4 }) === "הלבנה שלמה · 4 שבועות");
ok("never a spinner with no number", P.progressText({ week: 0, total: 4 }).indexOf("…") > 0);

/* --- and the page that runs it ------------------------------------------- */

ok("the page loads the plan", admin.indexOf('<script src="lib/coach-week-fill-plan.js"></script>') >= 0);
ok("the fill starts the moment week 1 is saved", /coachFillStart\(\{[\s\S]{0,200}athleteId: currentAthleteId/.test(admin));
ok("one step at a time", admin.indexOf("function coachFillStep()") >= 0);
/* Rule 1 in the page: the next step is asked for only after the previous week SAVED. */
ok("the next week is asked for only after this one is saved", /loadAthletes\(\{ silent: true \}\);[\s\S]{0,120}coachFillStep\(\);/.test(admin));
ok("each week is saved on its own", /action: "admin_save_week"/.test(admin));
ok("and shown as it lands", /if \(x\.j\.currentBlock\) coachFill\.block = x\.j\.currentBlock;/.test(admin));
ok("the bar says which week", admin.indexOf("function renderCoachFillBar()") >= 0);
/* Rule 4: continue, never rebuild. */
ok("a failure offers to carry on", admin.indexOf("המשך מהנקודה שנעצרה") >= 0);
ok("and carrying on runs only what is missing", /function coachFillResume\(\)[\s\S]{0,200}coachFillStep\(\);/.test(admin));
ok("a cut answer says so plainly", admin.indexOf("התשובה נקטעה באמצע") >= 0);
ok("and the bar lives outside the card that is redrawn", admin.indexOf('<div id="coachFillBar"') >= 0);

/* --- the server writes a week in one write ------------------------------- */

ok("there is an action for a whole week", snapshot.indexOf('body.action === "admin_save_week"') >= 0);
ok("it is owner-only", /admin_save_week"\) \{\s*\n\s*if \(!isAdmin\) return adminAuthDenied\(res\);/.test(snapshot));
ok("it sanitises the parts like every other saved day", /admin_save_week[\s\S]{0,1800}AdminDayEdit\.sanitizeParts/.test(snapshot));
ok("it hands the block back so the screen can draw it", /admin_save_week[\s\S]{0,3000}currentBlock: block/.test(snapshot));
ok("and it refuses a week that is not a week", /week_required/.test(snapshot));

console.log("\nAll week-fill-plan checks passed (" + passed + " assertions).");
