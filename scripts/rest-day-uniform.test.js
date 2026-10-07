/**
 * EVERY REST DAY IN A MONTH LOOKS THE SAME.
 *
 * Both brains are offered a choice by their contract — a rest day is `parts: []` OR a
 * `{title:"REST DAY", lines:["Rest"]}` card — and both took both, sometimes inside one month.
 * On a real four-week brick weeks 1 and 4 carried the card and weeks 2 and 3 were blank
 * squares. The calendar survived that one only because the weekly overview row happened to
 * say "Rest"; where that row is missing too, the day draws as nothing at all.
 *
 * The contract still accepts either answer — arguing with a model about punctuation wastes a
 * paid call. The SOFTWARE makes the two answers one. Owner, 2026-10-06: "צריכה להיות אחידות
 * - בימים שבהם אין אימונים כאשר מדובר בתוכנית חודשית אשר מופיעה ע"ג לוח השנה = יש לשבץ REST
 * DAY".
 *
 * Most of what is guarded here is what this must NEVER do: it must not fill a training day
 * (that is a hole, and a hole stays visible), must not touch a blank client (every square is
 * his), and must not overwrite anything anybody wrote.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const Store = require("../lib/client-program-store.js");
const Intake = require("../lib/client-intake.js");
const Normalize = require("../lib/normalize-pprog-block.js");
const Check = require("../lib/coach-brick-check.js");
const GymCheck = require("../lib/gym-brick-check.js");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/* Trains Sun/Mon/Wed/Thu/Fri — rests Tue and Sat. Shira's week, 2026-10-05. */
const TRAINS = { sun: true, mon: true, wed: true, thu: true, fri: true };
const INTAKE = Intake.normalizeIntake({
  clientName: "x",
  scheduleMode: "weekly_schedule",
  includeRestDays: true,
  restDays: DAYS.reduce(function (acc, d) {
    acc[d] = TRAINS[d] !== true;
    return acc;
  }, {}),
  sessionsPerWeek: 5,
  population: "Individual athlete",
});

function weekOf(daysSpec) {
  const days = {};
  DAYS.forEach(function (d) {
    days[d] = { parts: JSON.parse(JSON.stringify(daysSpec[d] || [])) };
  });
  return {
    weekIndex: 1,
    phase: "build",
    overview: DAYS.map(function (d) {
      return { day: d, focus: "" };
    }),
    days: days,
  };
}

const SESSION = [{ id: "a", title: "Part A - Back Squat", lines: ["4 x 6 Back Squat @ 8/10"] }];
const CARD = [{ id: "r", title: "REST DAY", lines: ["Rest"] }];

/* ── the shape a rest day ends up in ──────────────────────────────────────── */

const mixed = [
  /* week 1: the brain wrote the card itself */
  weekOf({ sun: SESSION, tue: CARD }),
  /* week 2: the brain left it blank — same month, the other answer */
  weekOf({ sun: SESSION }),
];
Store.markRestDays(mixed, INTAKE);

ok("a rest day the brain left blank gets the card",
  mixed[1].days.tue.parts.length === 1 && /REST DAY/i.test(mixed[1].days.tue.parts[0].title));
ok("and so does the other rest day of that week",
  /REST DAY/i.test(mixed[1].days.sat.parts[0].title));
ok("a card the brain wrote itself still says the same thing",
  /REST DAY/i.test(mixed[0].days.tue.parts[0].title));
ok("THE POINT: the two weeks are now identical on their rest days",
  JSON.stringify(mixed[0].days.tue.parts) === JSON.stringify(mixed[1].days.tue.parts));
ok("the overview row agrees with the card",
  Normalize.overviewFocus(mixed[1], "tue") === "Rest" && Normalize.overviewFocus(mixed[1], "sat") === "Rest");

/* What all of it is for: the calendar draws a rest day on every one of them. */
DAYS.filter(function (d) {
  return !TRAINS[d];
}).forEach(function (d) {
  mixed.forEach(function (w, i) {
    ok("W" + (i + 1) + " " + d + " reads as a rest day to the calendar",
      Normalize.isRestDay(d, w.days[d], w) === true);
  });
});

/* Running it twice must not stack cards on top of each other. */
Store.markRestDays(mixed, INTAKE);
ok("marking an already-marked month changes nothing", mixed[1].days.tue.parts.length === 1);

/* ── 1. a training day is NEVER filled ────────────────────────────────────── */

const hole = [weekOf({ sun: SESSION })];
Store.markRestDays(hole, INTAKE);
ok("a TRAINING day the brain left empty stays empty", hole[0].days.wed.parts.length === 0);
ok("and is not relabelled as rest in the overview", Normalize.overviewFocus(hole[0], "wed") === "");

/* Because a hole dressed as a planned rest hides the failure — and would make our own
   checker report a violation we invented ourselves. */
const holeFound = Check.checkBrick({ weeks: hole }, { trainingDays: ["sun", "mon", "wed", "thu", "fri"] });
ok("and the brick checker is not made to cry wolf by any of this",
  !(holeFound.blocking || []).some(function (b) {
    return /rest day/i.test(b);
  }));

/* The rule it must not collide with: a rest day written on a day he said he trains. That is
   still caught — when the BRAIN writes it, which is the only way it can now happen. */
const wrongRest = [weekOf({ sun: SESSION, wed: CARD })];
const wrongFound = Check.checkBrick({ weeks: wrongRest }, { trainingDays: ["sun", "mon", "wed", "thu", "fri"] });
ok("a rest day the brain wrote on a training day is still caught",
  (wrongFound.blocking || []).some(function (b) {
    return /rest/i.test(b);
  }));

/* ── 2. a blank client keeps every square ─────────────────────────────────── */

const blankIntake = Intake.normalizeIntake({
  clientName: "x",
  scheduleMode: "weekly_schedule",
  includeRestDays: false,
  restDays: {},
  population: "לקוח ריק",
});
const blank = [weekOf({})];
Store.markRestDays(blank, blankIntake);
ok("a blank client's month gets no rest cards at all",
  DAYS.every(function (d) {
    return blank[0].days[d].parts.length === 0;
  }));

const bySessions = Intake.normalizeIntake({
  clientName: "x",
  scheduleMode: "session_count",
  sessionsPerWeek: 3,
  population: "Studio",
});
const sess = [weekOf({})];
Store.markRestDays(sess, bySessions);
ok("and neither does a month sold as sessions rather than weekdays",
  DAYS.every(function (d) {
    return sess[0].days[d].parts.length === 0;
  }));

ok("no intake at all changes nothing",
  Store.markRestDays([weekOf({})], null)[0].days.tue.parts.length === 0);

/* ── 3. nothing written is ever overwritten ───────────────────────────────── */

const written = [weekOf({ tue: SESSION })];
Store.markRestDays(written, INTAKE);
ok("a session the coach wrote ON a rest day SURVIVES",
  written[0].days.tue.parts.length === 1 && /Back Squat/.test(written[0].days.tue.parts[0].lines[0]));
ok("and the overview is not overwritten to say Rest", Normalize.overviewFocus(written[0], "tue") === "");

const named = [weekOf({ sat: [{ id: "x", title: "Open gym", lines: [] }] })];
Store.markRestDays(named, INTAKE);
ok("a part somebody merely NAMED is content too", named[0].days.sat.parts[0].title === "Open gym");

/* ── a fresh skeleton is born the same way ────────────────────────────────── */

const fresh = Store.emptyProgram({ weekCount: 4, intake: INTAKE, clientKind: "athlete" });
ok("a brand new month has a card on every rest day of every week",
  fresh.weeks.every(function (w) {
    return /REST DAY/i.test((w.days.tue.parts[0] || {}).title || "") &&
      /REST DAY/i.test((w.days.sat.parts[0] || {}).title || "");
  }));
ok("and its training days are still the owner's to-do list",
  fresh.weeks[0].days.sun.ownerUnreviewed === true && !fresh.weeks[0].days.tue.ownerUnreviewed);
ok("a blank client's new month is still nothing but squares",
  Store.emptyProgram({ weekCount: 4, intake: blankIntake }).weeks.every(function (w) {
    return DAYS.every(function (d) {
      return w.days[d].parts.length === 0;
    });
  }));

/* ── and the server does it on every save, from ITS OWN copy of the intake ── */

const api = fs.readFileSync(path.join(root, "api", "client-program.js"), "utf8");
ok("a save is marked before it is stored",
  /draft\.weeks = store\.markRestDays\(patch\.weeks, draft\.intake\)/.test(api));
/* A page that could declare its own rest days could blank a training day by calling it one. */
ok("and never from an intake the caller sent", !/markRestDays\(patch\.weeks, (body|patch)\./.test(api));

/* ── and the client is NOT told their day off changed ─────────────────────── */

/* The client sees "the coach updated this day" by comparing what the day SAYS. A rest day
   can say it three ways — an empty square under a "Rest" overview row, a REST DAY card, or
   both — and they all mean the same thing to whoever opens it. Without this, the first save
   after rest days started carrying a card sent one client up to SIXTY "your coach changed
   your plan" marks, every one of them on a day off. */
const Api = require("../lib/client-program-store.js");
const restFocus = { weekIndex: 1, overview: DAYS.map(function (d) { return { day: d, focus: TRAINS[d] ? "" : "Rest" }; }), days: {} };
DAYS.forEach(function (d) { restFocus.days[d] = { parts: d === "sun" ? JSON.parse(JSON.stringify(SESSION)) : [] }; });
const was = { weeks: [JSON.parse(JSON.stringify(restFocus))] };
const now = { weeks: [JSON.parse(JSON.stringify(restFocus))] };
Store.markRestDays(now.weeks, INTAKE);
const tags = Api.changedDayTags(was, now);
ok("putting the card on a rest day tells the client NOTHING — it already said rest", tags.length === 0);

/* But a day that stops being a session, or becomes one, is news they do need. */
const becameRest = { weeks: [JSON.parse(JSON.stringify(restFocus))] };
becameRest.weeks[0].days.sun = { parts: [{ id: "r", title: "REST DAY", lines: ["Rest"] }] };
ok("a training day turned into rest IS reported to the client",
  Api.changedDayTags(was, becameRest).indexOf("w1:sun") >= 0);
const becameWork = { weeks: [JSON.parse(JSON.stringify(restFocus))] };
becameWork.weeks[0].days.tue = { parts: JSON.parse(JSON.stringify(SESSION)) };
ok("and so is a rest day that turned into a session",
  Api.changedDayTags(was, becameWork).indexOf("w1:tue") >= 0);

/* ── the gym brain's checks stay blind to the card ────────────────────────── */

/* A "Rest" line carries no sets, so it reaches no muscle total, is not counted as a working
   set, and is not reported as a line the check failed to read. */
const gymWeek = weekOf({ sun: [{ id: "a", title: "A", lines: ["4 x 10 Leg Press @ 7/10"] }] });
Store.markRestDays([gymWeek], INTAKE);
const gymFound = GymCheck.checkGymBlock({ weeks: [gymWeek] }, { equipment: [], answers: {} });
ok("the gym checker does not read the rest card as an exercise it could not parse",
  !(gymFound.flags || []).some(function (f) {
    return /does not know/i.test(f);
  }));
ok("and the rest card adds no sets to any session",
  !(gymFound.flags || []).some(function (f) {
    return /tue|sat/.test(f) && /working sets/.test(f);
  }));

console.log("\nיום מנוחה נראה אותו דבר בכל שבוע — והתוכנה היא שקובעת את זה, לא המוח.");
