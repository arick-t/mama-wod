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

ok("there are six tabs", I.TABS.length === 6);
ok(
  "the tabs are in the owner's order",
  JSON.stringify(I.TABS.map(function (t) { return t.id; })) ===
    JSON.stringify(["profile", "equipment", "schedule", "deload", "population", "goals"])
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
    "Client & payment|Equipment|Schedule|Deload week|Population & limits|Goals"
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
      "clientName", "deloadWeek", "equipment", "equipmentOther", "goals",
      "monthlyAmount", "paymentMethod", "population", "scheduleMode",
      "sessionsPerWeek", "weeklySchedule",
    ])
);

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

/* --- tab 3: schedule — two modes that change the plan's shape -------- */

ok("there are two schedule modes", I.SCHEDULE_MODES.length === 2);
ok("the default is a session count", I.emptyIntake().scheduleMode === "session_count");
ok("the default is three sessions", I.emptyIntake().sessionsPerWeek === 3);
ok("session count is bounded", I.normalizeIntake({ sessionsPerWeek: 99 }).sessionsPerWeek === 3);
ok("session count rejects zero", I.normalizeIntake({ sessionsPerWeek: 0 }).sessionsPerWeek === 3);

const weekly = I.normalizeIntake({
  scheduleMode: "weekly_schedule",
  weeklySchedule: { mon: "Squat", wed: "Engine", fri: "Full body" },
});
ok("weekly mode is kept", weekly.scheduleMode === "weekly_schedule");
ok("all seven days exist, Sun–Sat", JSON.stringify(Object.keys(weekly.weeklySchedule)) === JSON.stringify(I.DAY_KEYS));
ok("a filled day is kept", weekly.weeklySchedule.mon === "Squat");
ok("an unfilled day is blank, meaning rest", weekly.weeklySchedule.tue === "");
ok(
  "weekly mode with no day filled is refused",
  I.validateIntake({ clientName: "A", scheduleMode: "weekly_schedule", population: "p", goals: "g" }).some(function (p) {
    return /Weekly schedule/.test(p);
  })
);
ok(
  "session-count mode does not demand weekdays",
  I.validateIntake({ clientName: "A", scheduleMode: "session_count", population: "p", goals: "g" }).length === 0
);

/* --- tab 4: deload decides the block length ------------------------- */

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
  weeklySchedule: { mon: "Squat", wed: "Engine" },
  deloadWeek: true, population: "p", goals: "g",
});
ok("a weekly brief lists Sun-Sat", /Sun:/.test(weeklyBrief) && /Sat:/.test(weeklyBrief));
ok("an empty day reads as Rest", /Tue: Rest/.test(weeklyBrief));
ok("a deload brief says 5 weeks", /BLOCK: 5 weeks/.test(weeklyBrief));

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
