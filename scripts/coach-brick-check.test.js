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

/* --- the server side: one repair pass, and only with time to spare ---------------------- */

const fs = require("fs");
const path = require("path");
const pc = fs.readFileSync(path.join(__dirname, "..", "api", "personal-coach.js"), "utf8");

ok("the handler runs the check", pc.indexOf('require("../lib/coach-brick-check.js")') >= 0);
ok("the violations reach the response", /out\.brickBlocking = r\.blocking/.test(pc));
ok("the checker is fed the ticked inventory", /equipmentList: intake\.equipmentList/.test(pc));
ok("and the session count that was asked for", /sessionsPerWeek: intake\.sessionsPerWeek/.test(pc));
/* A failure in a check may never cost the owner his brick. */
ok("the check can never break the answer", /catch \(eCheck\) \{\}/.test(pc));

ok("a blocking list sends the brick back to the coach", /async function sendBackForRepair/.test(pc));
ok("it is wired into the programming answer", /sendBackForRepair\(await retryIfIntakeLike\(result\), tGenerate\)/.test(pc));
ok("exactly one pass — a repair never repairs itself", /if \(packed\.repairAttempted\) return packed;/.test(pc));
ok("it keeps the good work instead of rebuilding", /Fix ONLY those lines/.test(pc));
ok("and is told not to leave the session short", /do \" \+\s*\"not simply delete the movement and leave the session short/.test(pc));
/* The time guard: measured, not estimated. */
ok("the request budget is the function's real ceiling", /FUNCTION_BUDGET_MS = 300 \* 1000/.test(pc));
ok("the first call's real duration is measured", /const callMs = Math\.max\(0, Date\.now\(\) - tCallStart\)/.test(pc));
ok("a repair only starts when that much time is left", /if \(leftMs < callMs \+ REPAIR_MARGIN_MS\)/.test(pc));
ok("and when it is not, the owner is told rather than kept waiting", /repairSkipped/.test(pc));
ok("the duration is recorded either way", /packed\.buildMs = callMs/.test(pc));
/* A repair that makes things worse is not an improvement. */
ok("a worse repair is rejected", /if \(now > before\)/.test(pc));
ok("a repair that returns no brick is rejected", /the repair returned no brick/.test(pc));

/* --- two places, and a day belongs to exactly one of them -----------------
 * A box on weekdays and a garage on Saturday is one athlete with two inventories. Judged
 * against a single list, the garage's Saturday passes on the box's rower — the same
 * failure as עודד's, one level down (owner, 2026-09-15).
 * ------------------------------------------------------------------------- */
const BOX = { DUMBBELL: { have: true, cap: 30 }, ROW: { have: true }, "PULLUP BAR": { have: true } };
const GARAGE = { DUMBBELL: { have: true, cap: 15 } };
const TWO_PLACES = {
  weeks: [
    {
      weekIndex: 1,
      days: {
        mon: { parts: [{ title: "A", lines: ["Row 500m", "DB Snatch 25 kg", "Air Squat 20"] }] },
        sat: { parts: [{ title: "B", lines: ["Row 500m", "DB Snatch 25 kg", "Push-up 20"] }] },
      },
    },
  ],
};
const split = C.checkBrick(TWO_PLACES, {
  equipmentList: BOX,
  secondary: { days: ["sat"], equipmentList: GARAGE },
});
const splitText = split.blocking.join(" | ");
ok("Monday is judged by the box, and passes", !/W1 mon/.test(splitText));
ok("SATURDAY'S ROWER IS CAUGHT", /ROW is NOT available at the second place/.test(splitText) && /W1 sat/.test(splitText));
ok("and Saturday's ceiling is the garage's, not the box's", /DUMBBELL tops out at 15 kg at the second place/.test(splitText));
/* The same brick, one place: nothing is caught. That is the hole this closes. */
const unsplit = C.checkBrick(TWO_PLACES, { equipmentList: BOX });
ok("without a second place the same brick passes clean", unsplit.blocking.length === 0);
/* A second place named with no list ticked is not a second place. */
const halfAnswered = C.checkBrick(TWO_PLACES, {
  equipmentList: BOX,
  secondary: { days: ["sat"], equipmentList: {} },
});
ok("days without a list do not split the week", halfAnswered.blocking.length === 0);
/* And with one place only, nothing says "at the first place" — it is just here. */
const single = C.checkBrick(TWO_PLACES, { equipmentList: GARAGE });
ok("one place still reads as one place", /NOT available here/.test(single.blocking.join(" ")));

console.log("\nbrick check: all good");
