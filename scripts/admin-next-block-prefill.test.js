/**
 * An individual's next block opens on THEIR answers.
 *
 * It opened on a studio's: the form was filled from program.intake, which for an
 * individual is the shell the server derives to shape the month. Equipment defaulted to
 * a well-equipped box and the week was rebuilt out of rest days — so a client who had
 * described a garage was shown a full gym, and the schedule did not match either
 * (owner, 2026-09-03).
 *
 * The mapping is lifted out of admin.html and RUN here, because reading it was how the
 * two previous versions of this kind of fix passed review and still did not work.
 *
 * Run: node scripts/admin-next-block-prefill.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

const root = path.join(__dirname, "..");
/* Windows checkouts carry CRLF; the anchors below are written with LF. */
const src = fs
  .readFileSync(path.join(root, "admin.html"), "utf8")
  .split("\r\n")
  .join("\n");

const from = "  function intakeFormFromAthlete(p) {";
const i = src.indexOf(from);
assert.ok(i >= 0, "intakeFormFromAthlete is not in admin.html");
const j = src.indexOf("\n  }\n", i) + 4;
const intakeFormFromAthlete = new Function(
  "DAY_KEYS_LOCAL",
  src.slice(i, j) + "\nreturn intakeFormFromAthlete;"
)(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);

/* --- the room he actually described ------------------------------------- */

const garage = intakeFormFromAthlete({
  clientName: "End athlete 1",
  monthlyAmount: 900,
  paymentMethod: "bit",
  athleteIntake: {
    trainingLocations: { other_home: true },
    trainingLocationOther: "garage, dumbbells only",
    trainingDays: ["sun", "tue", "thu"],
    sessionMinutes: 45,
    goals: "engine",
  },
  intake: { deloadWeek: true, deloadEveryWeeks: 4 },
});
ok("a garage is not a well-equipped box", garage.equipment === "other");
ok("and what he wrote about it comes back", garage.equipmentOther === "garage, dumbbells only");
ok("his name comes back", garage.clientName === "End athlete 1");
ok("what he pays comes back", garage.monthlyAmount === 900 && garage.paymentMethod === "bit");

/* --- the week he actually answered --------------------------------------- */

ok("an individual trains on named days", garage.scheduleMode === "weekly_schedule");
ok(
  "the days he trains are not rest days",
  garage.restDays.sun === false && garage.restDays.tue === false && garage.restDays.thu === false
);
ok(
  "and the days he does not are",
  garage.restDays.mon === true && garage.restDays.fri === true && garage.restDays.sat === true
);
ok("three training days is three sessions", garage.sessionsPerWeek === 3);
ok("his session length comes back", garage.sessionMinutes === 45);
ok("the cadence stays the product's", garage.deloadWeek === true && garage.deloadEveryWeeks === 4);
ok("and a person has no stations", garage.stations === "");

/* --- clients created before the raw answers were carried ----------------- */

const legacy = intakeFormFromAthlete({
  clientName: "Older client",
  athleteIntake: {
    trainingSetup: "Other — home or limited equipment · Other detail: rings only",
    trainingDaysMap: { mon: true, wed: true },
  },
  intake: {},
});
ok("an older client's room is read from the sentence", legacy.equipment === "other");
ok("including the detail inside it", legacy.equipmentOther === "rings only");
ok("and the map form of their week still works", legacy.restDays.mon === false && legacy.restDays.tue === true);

/* --- someone who really is in a box ------------------------------------- */

const box = intakeFormFromAthlete({
  clientName: "Box athlete",
  athleteIntake: {
    trainingLocations: { functional_gym: true },
    trainingDays: ["sun", "mon", "tue", "wed", "thu"],
  },
  intake: {},
});
ok("a box is a box", box.equipment === "functional_gym");
ok("with nothing to describe", box.equipmentOther === "");
ok("five days is five sessions", box.sessionsPerWeek === 5);

/* --- and the page uses it for individuals only -------------------------- */

/* One question, asked in one place, used by the prefill and by the tabs. */
ok(
  "the next block opens on the athlete's answers when there are any",
  /function isIndividualClient\(\)/.test(src) &&
    /return !!\(S\.program && \(S\.program\.clientKind === "athlete" \|\| S\.program\.athleteIntake\)\);/.test(src)
);
ok(
  "a studio still opens on its own questionnaire",
  /fillIntakeForm\(isIndividual \? intakeFormFromAthlete\(S\.program\) : \(S\.program\.intake \|\| \{\}\)\)/.test(src)
);
ok("and the stations question is hidden for a person", /function syncStationsVisibility/.test(src));

console.log("admin-next-block-prefill.test.js passed");
