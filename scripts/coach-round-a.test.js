/**
 * Round A — foundation fixes in the coach's brain.
 *
 * Four of the seven, each pinned to the thing that was actually wrong:
 *   6  the second place's kit reaches the check
 *   7  no lift is estimated from another lift
 *   8  the template week generator is gone
 *   9  the profile notes no longer promise a fifth week
 *
 * Run: node scripts/coach-round-a.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Contract = require("../lib/coach-intake-sync-contract.js");
const Check = require("../lib/coach-brick-check.js");

const root = path.join(__dirname, "..");
const coach = fs.readFileSync(path.join(root, "api/personal-coach.js"), "utf8");
const policy = fs.readFileSync(path.join(root, "api/coach-policy.js"), "utf8");
const policySrc = fs.readFileSync(path.join(root, "experiments/personal-coach/coach-policy-rules.md"), "utf8");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

/* ════ 6 — THE SECOND PLACE ════════════════════════════════════════════════
   A fitted gym Sunday to Thursday, a garage with two dumbbells on Saturday. */

const twoPlaces = {
  trainsMultipleLocations: true,
  secondaryLocationDays: ["sat"],
  equipmentList: { BARBELL: { have: true }, "PULLUP BAR": { have: true }, RUN: { have: true } },
  secondaryEquipmentList: { DUMBBELL: { have: true } },
  trainingDays: ["sun", "tue", "sat"],
};
const profile = Contract.athleteProfileForGenerateBlock(twoPlaces, {});

ok("the profile carries the first place's kit", !!profile.equipmentList.BARBELL);
ok("the profile now carries the SECOND place's kit too", !!profile.secondaryEquipmentList.DUMBBELL);
ok("and the days that belong to it", profile.secondaryLocationDays.join() === "sat");
ok("the server builds its check context from that field", /p\.secondaryEquipmentList/.test(coach));

/* The check, given the split the field makes possible. */
function weekWith(days) {
  const out = {};
  for (const k of Object.keys(days)) out[k] = { parts: [{ title: "Metcon", lines: days[k] }] };
  return { weeks: [{ weekIndex: 1, days: out }] };
}
const block = weekWith({
  sun: ["20 Barbell thrusters"],
  sat: ["20 Dumbbell thrusters"],
});
const ctx = {
  equipmentList: twoPlaces.equipmentList,
  trainingDays: twoPlaces.trainingDays,
  percentagesAllowed: false,
  secondary: { days: ["sat"], equipmentList: twoPlaces.secondaryEquipmentList },
};
const split = Check.checkBrick(block, ctx);
ok("a dumbbell session in the garage is not a violation", !split.blocking.join(" ").includes("Dumbbell"));

/* And without the split — which is what happened before the fix — the same Saturday
   is judged against the gym, where there are no dumbbells. */
const blind = Check.checkBrick(block, {
  equipmentList: twoPlaces.equipmentList,
  trainingDays: twoPlaces.trainingDays,
  percentagesAllowed: false,
});
ok("the same session IS a violation when the second list is missing", blind.blocking.length > split.blocking.length);

/* ════ 7 — NO LIFT IS ESTIMATED FROM ANOTHER LIFT ═════════════════════════ */

ok("the policy no longer promises to estimate missing lifts", !/estimate (missing lifts|from the four known lifts)/i.test(policy));
ok("nor to use ratio tables for it", !/ratio tables (to estimate|after intake)/i.test(policy));
ok("POL-014 still says not to ask them as chat questions", /Do \*\*not\*\* ask Front Squat, Press, or Power Clean/.test(policySrc));
ok("POL-016 keeps the aerobic conversion tables", /aerobic conversion \/ equivalency tables/i.test(policy));
ok("and says what to do instead of a percentage", /effort or by a rep target/i.test(policy));
ok("the generated file agrees with its source", policy.includes("There is no conversion between lifts"));

/* ════ 8 — NO TEMPLATE WEEK GENERATOR ════════════════════════════════════ */

ok("buildTemplateWeekFromMeta is gone", !coach.includes("buildTemplateWeekFromMeta"));
ok("and nothing is marked as a template fallback", !coach.includes('_fallback: "template"'));
ok("the reason it went is written where it stood", /THE TEMPLATE WEEK GENERATOR IS GONE/.test(coach));
ok("POL-020 still forbids what it used to do", /never.{0,40}template|template.{0,40}never/is.test(policy));

/* ════ 9 — THE PROFILE NOTES TELL THE TRUTH ══════════════════════════════ */

const notesNone = String(Contract.buildProfileNotes({}));
const notesEvery4 = String(Contract.buildProfileNotes({ deloadEveryWeeks: 4 }));

ok("no fifth week is promised any more", !/5-week brick|week 5 of each/i.test(notesNone));
ok("no deload asked for is stated as such", /none requested/.test(notesNone));
ok("and a chosen cadence is stated as chosen", /every 4 weeks/.test(notesEvery4));

console.log("\nסבב A — ארבעת התיקונים המאושרים נעולים.");
