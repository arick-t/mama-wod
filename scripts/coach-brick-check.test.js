/**
 * The mechanical check on a returned brick.
 * Run: node scripts/coach-brick-check.test.js
 *
 * The fixture is not invented. It is עודד מכינה's room as he owns it, and the brick the coach
 * actually wrote for it on 2026-09-09 — ring rows and single-unders and a 200m row in a place with
 * no rings, no ropes and no rower; a 50cm box where there are no boxes; 22.5 kg dumbbells against
 * a 15 kg ceiling; four sessions where three were asked for; and not one bodyweight movement in
 * the whole week. Every one of those must be caught.
 *
 * The second half matters just as much: a CORRECT brick for the same room must come back clean.
 * A checker that blocks good programming is worse than the bug it fixes.
 */
const assert = require("assert");
const C = require("../lib/coach-brick-check.js");
const Catalog = require("../lib/equipment-catalog.js");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

/* The room, as the owner would tick it. */
const ODED = {
  RUN: { have: true, cap: 3000 },
  "PULLUP BAR": { have: true, qty: 2 },
  BIKE: { have: true, qty: 1 },
  DUMBBELL: { have: true, cap: 15 },
  "D-BALL": { have: true, cap: 15 },
  "TRAP BAR": { have: true, qty: 5 },
  BARBELL: { have: true, qty: 2 },
  "RIG RACK": { have: true, qty: 1 },
  "ROPE CLIMB": { have: true, qty: 1 },
  BENCH: { have: true, qty: 2 },
  "DIP BARS": { have: true, qty: 2 },
  RINGS: { have: false },
  "SKIPPING ROPE": { have: false },
  BOX: { have: false },
  ROW: { have: false },
  SKI: { have: false },
  SLED: { have: false },
  KETTLEBELL: { have: false },
  "WALL BALL": { have: false },
  BANDS: { have: false },
};

const BAD = {
  weeks: [
    {
      weekIndex: 1,
      days: {
        mon: {
          parts: [
            { title: "Part A - Strength", lines: ["Back Squat 5x5 @ 75% 1RM"] },
            { title: "Part B", lines: ["3 rounds: 10 Ring Rows, 20 Single-Unders, 200m Row"] },
          ],
        },
        tue: { parts: [{ title: "Part A", lines: ["DB Snatch 22.5 kg x10", "Box Jump 50cm x15"] }] },
        wed: { parts: [{ title: "Part A", lines: ["5 Trap Bar Deadlifts", "400m Run"] }] },
        thu: { parts: [{ title: "Part A", lines: ["Bike Erg 15 cal"] }] },
      },
    },
  ],
};

const bad = C.checkBrick(BAD, { equipmentList: ODED, sessionsPerWeek: 3, sessionTypes: ["a", "b", "c"] });
const said = bad.blocking.join(" | ");

ok("the rings he does not own are caught", /RINGS is NOT available/.test(said));
ok("the jump rope he does not own is caught", /SKIPPING ROPE is NOT available/.test(said));
ok("the boxes he does not own are caught", /BOX is NOT available/.test(said));
/* Two "row"s in one line: one inside "ring rows", one the rowing machine. Matching a keyword
   once per line missed the second, and a room with no rower was told to row 200m. */
ok("the rower is caught even beside a ring row", /ROW is NOT available/.test(said));
ok("the load ceiling is enforced", /DUMBBELL tops out at 15 kg here, and 22.5 kg was prescribed/.test(said));
ok("a week with no bodyweight work at all is a violation", /no bodyweight or floor movement at all/.test(said));
ok("four sessions when three were asked for is a violation", /has 4 sessions, and 3 were asked for/.test(said));
ok("seven violations, and each one only once", bad.violations.length === 7);
/* Judgement never blocks. */
ok("matching the described shapes is a flag, not a block", bad.flags.length === 1 && /the server cannot verify/.test(bad.flags[0]));

/* --- the other half: correct programming for the same room must pass ------------------- */

const GOOD = {
  weeks: [
    {
      weekIndex: 1,
      days: {
        mon: {
          parts: [
            { title: "Warm-up", lines: ["5 min easy bike"] },
            { title: "Strength", lines: ["Back Squat, build to 7/10"] },
            { title: "Metcon", lines: ["3 rounds: 10 DB Snatch 15 kg, 15 Burpees, 400m Run"] },
          ],
        },
        wed: {
          parts: [
            { title: "Strength", lines: ["5 Trap Bar Deadlifts @ 8/10"] },
            { title: "Metcon", lines: ["20 Walking Lunges, 10 strict pull-ups 2 RIR"] },
          ],
        },
        fri: { parts: [{ title: "Long metcon", lines: ["25 min: 400m Run, 20 Air Squats, 10 Push-ups"] }] },
      },
    },
  ],
};

const good = C.checkBrick(GOOD, { equipmentList: ODED, sessionsPerWeek: 3 });
ok("a correct brick for the same room is clean", good.blocking.length === 0);
ok("his own trap bars are not blocked", !/TRAP BAR/.test(good.blocking.join(" ")));
ok("a load at the ceiling exactly is fine", !/tops out/.test(good.blocking.join(" ")));

/* --- the floor can never be blocked ---------------------------------------------------- */

const EMPTY_ROOM = { DUMBBELL: { have: true } };
const BODYWEIGHT_ONLY = {
  weeks: [
    {
      weekIndex: 1,
      days: {
        mon: { parts: [{ title: "A", lines: ["50 Burpees, 100 Air Squats, 3 min Plank"] }] },
        wed: { parts: [{ title: "A", lines: ["Walking Lunge 40m, Hollow Rocks, Push-ups"] }] },
      },
    },
  ],
};
const free = C.checkBrick(BODYWEIGHT_ONLY, { equipmentList: EMPTY_ROOM });
ok("a session built only from bodyweight is never blocked", free.blocking.length === 0);
Catalog.BODY_ONLY.slice(0, 10).forEach(function (m) {
  ok('"' + m + '" alone raises nothing', C.checkBrick(
    { weeks: [{ weekIndex: 1, days: { mon: { parts: [{ title: "A", lines: ["20 " + m] }] } } }] },
    { equipmentList: EMPTY_ROOM }
  ).blocking.filter(function (s) {
    return /NOT available|tops out/.test(s);
  }).length === 0);
});

/* --- an unanswered checklist is not a claim ------------------------------------------- */

const noList = C.checkBrick(BAD, { equipmentList: {} });
ok("no checklist means no equipment verdict at all", !/NOT available|tops out/.test(noList.blocking.join(" ")));
ok("but the week still has to contain bodyweight work", /no bodyweight or floor movement/.test(noList.blocking.join(" ")));
const allFalse = {};
Object.keys(ODED).forEach(function (k) {
  allFalse[k] = { have: false };
});
ok(
  "a form nobody opened is treated as unanswered, not as an empty gym",
  !/NOT available/.test(C.checkBrick(BAD, { equipmentList: allFalse }).blocking.join(" "))
);

/* --- rest days are not sessions -------------------------------------------------------- */

const withRest = {
  weeks: [
    {
      weekIndex: 1,
      days: {
        mon: { parts: [{ title: "A", lines: ["20 Burpees"] }] },
        tue: { parts: [{ title: "REST DAY" }] },
        wed: { parts: [{ title: "A", lines: ["20 Air Squats"] }] },
      },
    },
  ],
};
ok(
  "a rest day is not counted as a session",
  !/sessions/.test(C.checkBrick(withRest, { sessionsPerWeek: 2 }).blocking.join(" "))
);

ok("the violation list is capped", C.MAX_VIOLATIONS === 12);

console.log("\nbrick check: all good");
