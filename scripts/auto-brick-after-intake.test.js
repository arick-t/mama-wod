/**
 * A questionnaire builds the month. There is no button.
 * Run: node scripts/auto-brick-after-intake.test.js
 *
 * Item 7 (owner, 2026-09-09): "כפתור השלם את החודש עם המאמן מיותר ואני רוצה להיפטר
 * ממנו. לאחר תחקור שבוצע ממודול אדמין > מעבר ישירות לבניית לבנה מלאה באופן אוטומטי >
 * מעבר בין לבנות עדיין נשמר ע"י הכפתור צור לבנה חדשה."
 *
 * So two moments start the build — a client created from a questionnaire, and "צור לבנה
 * חדשה" — and the rules about WHO may ask do not move: only an action of his, never a
 * timer, never a month that is already written, never a blank client.
 *
 * The two new functions are LIFTED OUT OF THE PAGE and run here, rather than read: the
 * one that decides whether to build, and the one that tells the brain what last month
 * did.
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

const root = path.join(__dirname, "..");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8").split("\r\n").join("\n");
const Brief = require("../lib/coach-client-brief.js");
const Plan = require("../lib/coach-week-fill-plan.js");
const Handoff = require("../lib/coach-block-handoff.js");

/** Lift a function out of the page verbatim — no copy, no paraphrase. */
function lift(from, to) {
  const i = admin.indexOf(from);
  assert.ok(i >= 0, "cannot find in admin.html: " + from);
  const j = admin.indexOf(to, i);
  assert.ok(j > i, "cannot find the end of: " + from);
  return admin.slice(i, j + to.length);
}

/* ── the button is gone, and nothing replaced it with another button ─────── */

ok("no write button anywhere in the page", admin.indexOf("data-brainwrite") < 0);
ok("no send button either", admin.indexOf("data-brainsend") < 0);
ok("and the builder that drew it is gone", admin.indexOf("brainWriteButtonHtml") < 0);
ok("the confirmation screen is gone", admin.indexOf("זה מה שנשלח למאמן — קרא ואשר") < 0);
/* What is left of the panel: progress, a stop, and a way to carry on. */
ok("a build that stopped can be carried on", admin.indexOf('data-brainresume="1"') >= 0);
ok("and its message can be put away", admin.indexOf('data-brainclose="1"') >= 0);
ok("what was sent is still readable while it builds", admin.indexOf("מה נשלח למאמן") >= 0);
ok("the price and the unapproved landing are said in the progress line", /₪0\.35/.test(admin) && /לא מאושר/.test(admin));

/* ── the decision to build, run for real ────────────────────────────────── */

const autoSrc = lift("function brainAutoStart(why)", "return true;\n  }");
function makeAuto(program, running) {
  let started = 0;
  const S = { program: program };
  const cvBrain = { running: !!running, error: "x", why: "" };
  const fn = new Function(
    "S",
    "cvBrain",
    "brainLibs",
    "currentBlockIndex",
    "brainStep",
    autoSrc + "\nreturn brainAutoStart;"
  )(
    S,
    cvBrain,
    function () { return { brief: Brief, plan: Plan }; },
    function () { return 1; },
    function () { started += 1; }
  );
  return { run: fn, started: () => started, cvBrain: cvBrain };
}

const STUDIO_INTAKE = require("../lib/client-intake.js").normalizeIntake({
  clientName: "קבוצת בוקר",
  population: "adults",
  equipment: "functional_gym",
  maxAthletesAtOnce: 12,
  sessionMinutes: 60,
  deloadWeek: true,
  deloadEveryWeeks: 4,
});
function emptyStudio() {
  return {
    programId: "p1",
    clientKind: "coach",
    clientName: "קבוצת בוקר",
    intake: STUDIO_INTAKE,
    blocks: [{ blockIndex: 1, startWeek: 1, weekCount: 4 }],
    weeks: [{ weekIndex: 1, days: {} }, { weekIndex: 2, days: {} }, { weekIndex: 3, days: {} }, { weekIndex: 4, days: {} }],
  };
}
/* A written week, in the shape weekIsWritten recognises. */
function writtenWeek(i) {
  return {
    weekIndex: i,
    theme: "Build",
    days: {
      sun: { parts: [{ title: "1 — Strength", lines: ["5x5 back squat @ 80%"] }] },
      mon: { parts: [{ title: "1 — Engine", lines: ["Row 2k"] }] },
    },
  };
}

const fresh = makeAuto(emptyStudio());
ok("an empty month is built", fresh.run("intake") === true && fresh.started() === 1);
ok("and the last error is cleared first", fresh.cvBrain.error === "");
ok("the reason is kept, for the record", fresh.cvBrain.why === "intake");

const blank = makeAuto(Object.assign(emptyStudio(), { clientKind: "blank", intake: undefined }));
ok("a blank client is never built for", blank.run("intake") === false && blank.started() === 0);

const noIntake = makeAuto(Object.assign(emptyStudio(), { intake: undefined }));
ok("nor a client with no questionnaire", noIntake.run("intake") === false && noIntake.started() === 0);

const done = makeAuto(
  Object.assign(emptyStudio(), { weeks: [writtenWeek(1), writtenWeek(2), writtenWeek(3), writtenWeek(4)] })
);
ok("a month already written is left alone", done.run("intake") === false && done.started() === 0);

const half = makeAuto(Object.assign(emptyStudio(), { weeks: [writtenWeek(1), { weekIndex: 2, days: {} }, { weekIndex: 3, days: {} }, { weekIndex: 4, days: {} }] }));
ok("a half-written month is finished", half.run("next-block") === true && half.started() === 1);

const busy = makeAuto(emptyStudio(), true);
ok("and it never runs twice at once", busy.run("intake") === false && busy.started() === 0);

const nothing = makeAuto(null);
ok("with no client open it does nothing", nothing.run("intake") === false && nothing.started() === 0);

/* ── what the next block is told about the last one, run for real ───────── */

const handoffSrc = lift("function clientBlockHandoff(blockIndex)", 'return "";\n    }\n  }');
function makeHandoff(program) {
  return new Function(
    "S",
    "window",
    "brainLibs",
    handoffSrc + "\nreturn clientBlockHandoff;"
  )({ program: program }, { CoachBlockHandoff: Handoff }, function () {
    return { brief: Brief, plan: Plan };
  });
}
const twoBlocks = Object.assign(emptyStudio(), {
  blocks: [
    { blockIndex: 1, startWeek: 1, weekCount: 4 },
    { blockIndex: 2, startWeek: 5, weekCount: 4 },
  ],
  weeks: [
    writtenWeek(1), writtenWeek(2), writtenWeek(3), writtenWeek(4),
    { weekIndex: 5, days: {} }, { weekIndex: 6, days: {} }, { weekIndex: 7, days: {} }, { weekIndex: 8, days: {} },
  ],
});
const handoffFor = makeHandoff(twoBlocks);
const text = handoffFor(2);
ok("block 2 is told about block 1", text.length > 40);
ok("it names the block that came before", /PRIOR BLOCK 1/.test(text));
ok("and the weeks it covered", /absolute weeks 1-4/.test(text));
ok("it stays inside the brain's cap", text.length <= 4000);
ok("block 1 has nothing before it", handoffFor(1) === "");
/* A programme whose first block is still empty has nothing to hand over either. */
const emptyFirst = makeHandoff(Object.assign(emptyStudio(), {
  blocks: [{ blockIndex: 1, startWeek: 1, weekCount: 4 }, { blockIndex: 2, startWeek: 5, weekCount: 4 }],
  weeks: [{}, {}, {}, {}, {}, {}, {}, {}],
}));
ok("and an unwritten one hands over what little it has", typeof emptyFirst(2) === "string");
/* It must never be the thing that stops a month being built. */
const noLib = new Function("S", "window", "brainLibs", handoffSrc + "\nreturn clientBlockHandoff;")(
  { program: twoBlocks },
  {},
  function () { return { brief: Brief, plan: Plan }; }
);
ok("with the library missing it is simply empty", noLib(2) === "");

/* ── and it travels with the request ───────────────────────────────────── */

/* And it builds the block it just made, not whichever the calendar happened to show. */
ok("the new block is stood on before it is built", /if \(madeBlock\) S\.wi = Math\.max\(0, \(parseInt\(madeBlock\.startWeek, 10\) \|\| 1\) - 1\);/.test(admin));
ok("the block request carries it", /handoff: clientBlockHandoff\(blockIndex\)/.test(admin));
ok("the brain reads it as blockHandoff", /body\.blockHandoff = String\(src\.handoff\)/.test(fs.readFileSync(path.join(root, "lib", "coach-client-brief.js"), "utf8")));

console.log("\nAll auto-brick checks passed (" + passed + " assertions).");
