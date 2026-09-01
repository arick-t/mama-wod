/**
 * Cross-cutting intake for a coach / studio (checklist 2.b / 2.c).
 * Run: node scripts/client-intake.test.js
 *
 * The point of 2.c: a brick delivered to a room cannot be built from one person's
 * numbers, so this questionnaire must NOT carry individual capability at all. That is
 * asserted here by name — age, bodyweight, 1RMs, named skills, personal injuries.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const I = require("../lib/client-intake.js");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

const root = path.join(__dirname, "..");

/* --- tabs, in English on the owner's instruction ----------------------- */

/* Five, not six: the deload was a whole step for one checkbox and it belongs to the
   schedule anyway (owner, 2026-09-01). */
ok("there are five tabs", I.TABS.length === 5);
ok("deload is no longer a tab of its own", I.TABS.every(function (t) { return t.id !== "deload"; }));
ok(
  "the tabs are in the owner's order",
  JSON.stringify(I.TABS.map(function (t) { return t.id; })) ===
    JSON.stringify(["profile", "equipment", "schedule", "population", "goals"])
);
ok(
  "every tab label is English, not Hebrew",
  I.TABS.every(function (t) {
    return !/[֐-׿]/.test(t.label);
  })
);
ok(
  "the labels read like the owner's spec",
  I.TABS.map(function (t) { return t.label; }).join("|") ===
    "Client & payment|Equipment|Schedule|Population & limits|Goals"
);

/* No Hebrew anywhere in the shipped strings (comments excluded). */
const intakeSrc = fs.readFileSync(path.join(root, "lib", "client-intake.js"), "utf8");
const codeOnly = intakeSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
ok("no Hebrew in the intake strings", !/[֐-׿]/.test(codeOnly));

/* --- 2.c: cross-cutting only ------------------------------------------ */

const shape = Object.keys(I.emptyIntake()).sort();
const FORBIDDEN = [
  "age", "bodyweight", "experience", "gender", "lifts", "skills",
  "injuries", "trainingDays", "activeRecoveryPref", "sessionLimits", "displayName",
];
FORBIDDEN.forEach(function (f) {
  ok('no individual field "' + f + '"', shape.indexOf(f) < 0);
});
ok(
  "the shape is exactly the owner's six tabs' worth of fields",
  JSON.stringify(shape) ===
    JSON.stringify([
      "clientName", "dayEmphasis", "dayEmphasisEnabled", "deloadWeek", "equipment",
      "equipmentOther", "goals", "includeRestDays", "monthlyAmount", "paymentMethod",
      "population", "scheduleMode", "sessionTypes", "sessionsDiffer", "sessionsPerWeek",
    ])
);
/* The old focus-per-weekday field is gone: weekly mode now asks about rest days and
   standing emphases instead, which is what the owner actually wanted from it. */
ok("the old weeklySchedule field is gone", shape.indexOf("weeklySchedule") < 0);

/* --- tab 1: client & payment ----------------------------------------- */

const paid = I.normalizeIntake({ clientName: "Coach A", monthlyAmount: "900", paymentMethod: "Bit, 1st" });
ok("the name is kept", paid.clientName === "Coach A");
ok("the amount is a number so it can be totalled", paid.monthlyAmount === 900);
ok("the method is free text", paid.paymentMethod === "Bit, 1st");
ok("a nonsense amount becomes zero", I.normalizeIntake({ monthlyAmount: "abc" }).monthlyAmount === 0);
ok("a negative amount becomes zero", I.normalizeIntake({ monthlyAmount: -50 }).monthlyAmount === 0);

/* --- tab 2: equipment — exactly two options ------------------------- */

ok("there are exactly two equipment options", I.EQUIPMENT_OPTIONS.length === 2);
ok("option one is the well-equipped gym", I.EQUIPMENT_OPTIONS[0].label === "Well-equipped functional training gym");
ok("option two is OTHER", I.EQUIPMENT_OPTIONS[1].label === "OTHER");
ok("only OTHER asks for detail", I.EQUIPMENT_OPTIONS[1].needsDetail === true && I.EQUIPMENT_OPTIONS[0].needsDetail === false);
ok("the default is the well-equipped gym", I.emptyIntake().equipment === "functional_gym");
ok(
  "detail is dropped when equipment is not OTHER",
  I.normalizeIntake({ equipment: "functional_gym", equipmentOther: "leftover" }).equipmentOther === ""
);
ok(
  "OTHER without a description is refused",
  I.validateIntake({ clientName: "A", equipment: "other", population: "p", goals: "g" }).some(function (p) {
    return /OTHER/.test(p);
  })
);
ok("an unknown equipment value falls back safely", I.normalizeIntake({ equipment: "hacked" }).equipment === "functional_gym");

/* --- tab 3: schedule — two modes, each with its own follow-ups -------- */

ok("there are two schedule modes", I.SCHEDULE_MODES.length === 2);
/* No default mode (owner, 2026-09-01): the Schedule tab opens with nothing ticked, so
   the tab presents a decision instead of an answer already filled in. Defaulting here
   is how a studio that asked for a session count gets a weekday plan. */
ok("no schedule mode is assumed", I.emptyIntake().scheduleMode === "");
ok("an unknown mode stays unanswered", I.normalizeIntake({ scheduleMode: "whatever" }).scheduleMode === "");
ok("a real mode survives", I.normalizeIntake({ scheduleMode: "weekly_schedule" }).scheduleMode === "weekly_schedule");
ok(
  "an unchosen mode blocks the build",
  I.validateIntake({ clientName: "A", population: "p", goals: "g", sessionsPerWeek: 3 }).some(
    function (m) { return /pick how the place trains/i.test(m); }
  )
);
ok(
  "choosing one clears that complaint",
  !I.validateIntake({
    clientName: "A", population: "p", goals: "g",
    scheduleMode: "weekly_schedule",
  }).some(function (m) { return /pick how the place trains/i.test(m); })
);
/* With no mode chosen, NEITHER branch may keep answers — a half-filled mode that was
   then abandoned must not reach the brief. */
const noMode = I.normalizeIntake({
  sessionsPerWeek: 5, sessionsDiffer: true, sessionTypes: ["a", "b"],
  includeRestDays: true, dayEmphasisEnabled: true,
});
ok("no mode keeps no session answers", noMode.sessionsPerWeek === 0 && noMode.sessionsDiffer === false);
ok("no mode keeps no weekly answers", noMode.includeRestDays === false && noMode.dayEmphasisEnabled === false);
ok("the brief says the schedule is unanswered", /SCHEDULE: not answered yet/.test(
  I.briefFor({ clientName: "A", population: "p", goals: "g" })
));
/* Weekly mode has no session count at all — carrying one over reads as a contradiction. */
ok(
  "weekly mode drops any session count",
  I.normalizeIntake({ scheduleMode: "weekly_schedule", sessionsPerWeek: 4 }).sessionsPerWeek === 0
);
/* 0 = unanswered. The box starts empty on the owner's instruction, and inventing a
   "3" for a paying client's program is the quiet default that ships a wrong plan —
   validateIntake blocks instead. */
ok("there is no default session count", I.emptyIntake().sessionsPerWeek === 0);
ok("an out-of-range count is not answered", I.normalizeIntake({ scheduleMode: "session_count", sessionsPerWeek: 99 }).sessionsPerWeek === 0);
ok("zero stays unanswered", I.normalizeIntake({ scheduleMode: "session_count", sessionsPerWeek: 0 }).sessionsPerWeek === 0);
ok("a real count survives", I.normalizeIntake({ scheduleMode: "session_count", sessionsPerWeek: 6 }).sessionsPerWeek === 6);
ok(
  "an empty count blocks the build",
  I.validateIntake({
    clientName: "A", population: "p", goals: "g", scheduleMode: "session_count",
  }).some(function (m) {
    return /how many sessions per week/i.test(m);
  })
);
ok(
  "a filled count clears that complaint",
  !I.validateIntake({
    clientName: "A", population: "p", goals: "g",
    scheduleMode: "session_count", sessionsPerWeek: 3,
  }).some(function (m) { return /how many sessions per week/i.test(m); })
);
ok(
  "weekly mode never asks for a session count",
  !I.validateIntake({
    clientName: "A", population: "p", goals: "g", scheduleMode: "weekly_schedule",
  }).some(function (m) { return /how many sessions per week/i.test(m); })
);

/* session_count → do the sessions differ? */
ok("sessions are interchangeable by default", I.emptyIntake().sessionsDiffer === false);
const differ = I.normalizeIntake({
  scheduleMode: "session_count", sessionsPerWeek: 3, sessionsDiffer: true,
  sessionTypes: ["strength + metcon", "engine", "gymnastics"],
});
ok("differing sessions are kept", differ.sessionsDiffer === true);
ok("one description per session", differ.sessionTypes.length === 3);
ok("the first description is kept", differ.sessionTypes[0] === "strength + metcon");

/* The box count must follow the session count, not the array that was sent. */
const trimmed = I.normalizeIntake({
  scheduleMode: "session_count", sessionsPerWeek: 2, sessionsDiffer: true,
  sessionTypes: ["a", "b", "c", "d"],
});
ok("extra descriptions are dropped to match the count", trimmed.sessionTypes.length === 2);
const padded = I.normalizeIntake({
  scheduleMode: "session_count", sessionsPerWeek: 4, sessionsDiffer: true, sessionTypes: ["a"],
});
ok("missing descriptions are padded, not lost", padded.sessionTypes.length === 4);

ok(
  "uniform sessions carry no descriptions",
  I.normalizeIntake({ sessionsDiffer: false, sessionTypes: ["leftover"] }).sessionTypes.length === 0
);
ok(
  "differing sessions with a blank description are refused",
  I.validateIntake({
    clientName: "A", population: "p", goals: "g",
    scheduleMode: "session_count", sessionsPerWeek: 3, sessionsDiffer: true,
    sessionTypes: ["a", "", "c"],
  }).some(function (x) { return /describe each one/.test(x); })
);

/* weekly_schedule → rest days, then standing emphases */
const weekly = I.normalizeIntake({
  scheduleMode: "weekly_schedule", includeRestDays: true, dayEmphasisEnabled: true,
  dayEmphasis: { fri: "partner workouts" },
});
ok("weekly mode is kept", weekly.scheduleMode === "weekly_schedule");
ok("rest days default to NO", I.emptyIntake().includeRestDays === false);
ok("rest days can be turned on", weekly.includeRestDays === true);
ok("emphases default to off", I.emptyIntake().dayEmphasisEnabled === false);
ok("a standing note is kept", weekly.dayEmphasis.fri === "partner workouts");
ok("all seven days exist, Sun–Sat", JSON.stringify(Object.keys(weekly.dayEmphasis)) === JSON.stringify(I.DAY_KEYS));
ok("an unticked day carries no note", weekly.dayEmphasis.mon === "");
ok(
  "emphases on with nothing written is refused",
  I.validateIntake({
    clientName: "A", population: "p", goals: "g",
    scheduleMode: "weekly_schedule", dayEmphasisEnabled: true,
  }).some(function (x) { return /at least one day/.test(x); })
);

/* Switching mode must not leave the other mode's answers behind. */
const switched = I.normalizeIntake({
  scheduleMode: "weekly_schedule", sessionsDiffer: true, sessionTypes: ["x"],
});
ok("weekly mode drops session descriptions", switched.sessionsDiffer === false && switched.sessionTypes.length === 0);
const switchedBack = I.normalizeIntake({
  scheduleMode: "session_count", includeRestDays: true, dayEmphasisEnabled: true,
});
ok("session mode drops rest-day and emphasis answers", switchedBack.includeRestDays === false && switchedBack.dayEmphasisEnabled === false);

ok(
  "session-count mode does not demand weekdays",
  I.validateIntake({
    clientName: "A", scheduleMode: "session_count", sessionsPerWeek: 3,
    population: "p", goals: "g",
  }).length === 0
);

/* --- deload (now inside the schedule tab) decides the block length --- */

ok("no deload is the default", I.emptyIntake().deloadWeek === false);
ok("no deload means a 4-week block", I.weekCountFor({ deloadWeek: false }) === 4);
ok("a deload means a 5-week block", I.weekCountFor({ deloadWeek: true }) === 5);
ok("the default block is 4 weeks", I.weekCountFor({}) === 4);
ok("only a real true enables it", I.normalizeIntake({ deloadWeek: "yes" }).deloadWeek === false);

/* --- tabs 5 & 6: free text, and required --------------------------- */

ok(
  "population is required",
  I.validateIntake({ clientName: "A", goals: "g" }).some(function (p) {
    return /who trains there/.test(p);
  })
);
ok(
  "goals are required",
  I.validateIntake({ clientName: "A", population: "p" }).some(function (p) {
    return /Goals/.test(p);
  })
);
ok("a name is required", I.validateIntake({ population: "p", goals: "g" }).length > 0);
ok("long text is clamped, not rejected", I.normalizeIntake({ population: "x".repeat(9000) }).population.length === 2000);

/* A complete intake passes cleanly. */
const complete = {
  clientName: "Army prep academy",
  monthlyAmount: 900,
  paymentMethod: "Bit, 1st of the month",
  equipment: "other",
  equipmentOther: "Rig, 4 barbells, KB 8-32, 2 rowers, no rings",
  scheduleMode: "session_count",
  sessionsPerWeek: 3,
  deloadWeek: false,
  population: "Pre-army group, 17-19, mixed ability, 60-minute sessions",
  goals: "Army selection: 2000m run, pull-ups, load carry",
};
ok("a complete intake has no problems", I.validateIntake(complete).length === 0);

/* --- the brief the owner writes against --------------------------- */

const brief = I.briefFor(complete);
ok("the brief names the equipment", /Rig, 4 barbells/.test(brief));
ok("the brief states the session count", /3 sessions per week/.test(brief));
ok("the brief says the coach picks the days", /coach decides when to run them/.test(brief));
ok("the brief states the block length", /BLOCK: 4 weeks/.test(brief));
ok("the brief explains what no-deload means", /next 4-week block follows straight after/.test(brief));
ok("the brief carries the population", /Pre-army group/.test(brief));
ok("the brief carries the goals", /Army selection/.test(brief));
/* The brief is for the owner's eyes, so the price must not be in it. */
ok("the brief does NOT carry the price", brief.indexOf("900") < 0);

const weeklyBrief = I.briefFor({
  clientName: "A", scheduleMode: "weekly_schedule",
  includeRestDays: true, dayEmphasisEnabled: true,
  dayEmphasis: { fri: "partner workouts" },
  deloadWeek: true, population: "p", goals: "g",
});
ok("a weekly brief says sessions sit on weekdays", /sessions sit on weekdays/.test(weeklyBrief));
ok("a weekly brief states the rest-day decision", /REST DAYS: part of the plan/.test(weeklyBrief));
ok("a standing emphasis appears with its day", /Fri: partner workouts/.test(weeklyBrief));
ok("emphases are marked as repeating", /repeat every week/.test(weeklyBrief));
ok("a deload brief says 5 weeks", /BLOCK: 5 weeks/.test(weeklyBrief));

/* Rest days OFF must read as the coach's call, not silently vanish. */
const noRest = I.briefFor({ clientName: "A", scheduleMode: "weekly_schedule", population: "p", goals: "g" });
ok("rest days off reads as the coach's call", /not planned — the coach decides/.test(noRest));
ok("no emphasis section when it is off", noRest.indexOf("STANDING EMPHASES") < 0);

/* session_count: uniform vs differing must be stated, because it changes the plan. */
const uniform = I.briefFor({
  clientName: "A", scheduleMode: "session_count", sessionsPerWeek: 3,
  population: "p", goals: "g",
});
ok("uniform sessions are stated as standard CrossFit", /interchangeable — a standard CrossFit week/.test(uniform));
const differing = I.briefFor({
  clientName: "A", scheduleMode: "session_count", sessionsPerWeek: 2, sessionsDiffer: true,
  sessionTypes: ["strength + metcon", "engine"], population: "p", goals: "g",
});
ok("differing sessions are listed one by one", /Session 1: strength \+ metcon/.test(differing) && /Session 2: engine/.test(differing));

/* --- it never reaches the client -------------------------------- */

const Payload = require("../lib/client-view-payload.js");
ok("the whole intake is on the never-to-client list", Payload.NEVER_TO_CLIENT.indexOf("intake") >= 0);
ok("the intake is not on the outbound allowlist", Payload.PROGRAM_OUT.indexOf("intake") < 0);

const Store = require("../lib/client-program-store.js");
const withIntake = Store.emptyProgram({ clientName: "Coach A", intake: complete, weekCount: 4 });
ok("a program can carry its intake", !!withIntake.intake);
const clientCopy = JSON.stringify(Payload.programForClient(withIntake));
ok("the client never sees the intake", clientCopy.indexOf("intake") < 0);
ok("the client never sees the population note", clientCopy.indexOf("Pre-army group") < 0);
ok("the client never sees their own price", clientCopy.indexOf("900") < 0);

/* --- browser and server read the same definition -------------- */

ok("the module is UMD", /root\.CLIENT_INTAKE = factory\(\)/.test(intakeSrc));
const sandbox = { self: {} };
vm.createContext(sandbox);
vm.runInContext(intakeSrc, sandbox);
ok("it loads in a browser-like global", !!sandbox.self.CLIENT_INTAKE);
ok(
  "browser and server agree on the tabs",
  JSON.stringify(sandbox.self.CLIENT_INTAKE.TABS) === JSON.stringify(I.TABS)
);

/* --- no provider, ever --------------------------------------- */

ok("the intake makes no network calls", !/\bfetch\s*\(/.test(intakeSrc));
ok("the intake names no AI provider", !/gemini|groq/i.test(intakeSrc));

console.log("All client intake checks passed.");
