/**
 * THE GYM CHECK — and the proof that it had to be a different one.
 *
 * The first assertion here is the one that settled the argument: the SAME sound gym week that
 * draws eight blocking violations from the functional check draws none from this one. That is
 * not a tuning difference. The functional catalogue is rings, erg and wall ball; it reads
 * "Seated Cable Row" as a rowing machine that is not in the room.
 *
 * Run: node scripts/gym-brick-check.test.js
 */
const assert = require("assert");
const Check = require("../lib/gym-brick-check.js");
const Functional = require("../lib/coach-brick-check.js");
const Build = require("../lib/gym-block-build.js");
const Intake = require("../lib/gym-intake.js");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

/** A week a competent coach would write for a commercial gym. */
function soundWeek() {
  return {
    summaryLine: "Full body",
    days: {
      sun: { parts: [{ title: "Full Body A", lines: [
        "4 x 10 Leg Press @ 7/10",
        "4 x 12 Romanian Deadlift @ 7/10",
        "4 x 10 Lat Pulldown @ 7/10",
        "4 x 12 Chest Press Machine @ 7/10",
        "3 x 12 Seated Dumbbell Shoulder Press @ 7/10",
        "3 x 15 Plank",
      ] }] },
      tue: { parts: [{ title: "Full Body B", lines: [
        "4 x 10 Goblet Squat @ 7/10",
        "4 x 12 Leg Curl @ 7/10",
        "4 x 10 Seated Cable Row @ 7/10",
        "4 x 12 Incline Dumbbell Press @ 7/10",
        "3 x 15 Dumbbell Lateral Raise @ 7/10",
        "3 x 20 Cable Crunch",
      ] }] },
    },
  };
}
const FULL_GYM = { equipment: Intake.gearList({ fullyEquipped: true }), answers: { noLimits: true } };
const sound = Build.buildBlock(soundWeek(), { answers: {}, startWeek: 1 }).block;

/* ── the argument, settled ─────────────────────────────────────────────────── */

const mine = Check.checkGymBlock(sound, FULL_GYM);
ok("a sound gym week passes the GYM check with no blocking", mine.blocking.length === 0);

const theirs = Functional.checkBrick(sound, {
  equipmentList: { BARBELL: { have: true }, DUMBBELL: { have: true } },
  trainingDays: ["sun", "tue"],
  percentagesAllowed: false,
});
ok("and the SAME week is blocked by the functional check", theirs.blocking.length > 0);
ok("which is why they are two checks and not one", theirs.blocking.length > mine.blocking.length);

/* ── the block is the week ─────────────────────────────────────────────────── */

ok("six identical weeks are read once, not six times", Check.walkLines(sound).every((l) => l.week === 1));
ok("unless asked otherwise", Check.walkLines(sound, true).some((l) => l.week > 1));

/* ── blocking: what the athlete cannot do, or was told not to be given ─────── */

const noMachines = Check.checkGymBlock(sound, { equipment: ["Dumbbells"], answers: { noLimits: true } });
ok("equipment the room does not own blocks", noMachines.blocking.length > 0);
ok("and names what is missing", /Leg Press|Lat Pulldown/.test(noMachines.blocking.join(" ")));
ok("a room we know nothing about is not judged", Check.checkGymBlock(sound, { answers: { noLimits: true } }).blocking.length === 0);

const avoided = Check.checkGymBlock(sound, Object.assign({}, FULL_GYM, { answers: { avoid: { deep_squat: true } } }));
ok("a family they asked to avoid blocks", avoided.blocking.some((b) => /asked to avoid/.test(b)));

const lowReps = Build.buildBlock({ days: { sun: { parts: [{ title: "A", lines: [
  "5 x 3 Back Squat @ 9/10", "4 x 10 Lat Pulldown @ 7/10", "4 x 10 Chest Press Machine @ 7/10",
  "4 x 10 Seated Dumbbell Shoulder Press @ 7/10",
] }] } } }, {}).block;
ok("reps below eight block", Check.checkGymBlock(lowReps, FULL_GYM).blocking.some((b) => /outside 8-30/.test(b)));

const kilos = Build.buildBlock({ days: { sun: { parts: [{ title: "A", lines: [
  "4 x 10 Leg Press 80 kg", "4 x 10 Lat Pulldown @ 7/10", "4 x 10 Chest Press Machine @ 7/10",
  "4 x 10 Seated Dumbbell Shoulder Press @ 7/10",
] }] } } }, {}).block;
ok("a load in kilos blocks", Check.checkGymBlock(kilos, FULL_GYM).blocking.some((b) => /written in kilos/.test(b)));

const noChest = Build.buildBlock({ days: { sun: { parts: [{ title: "A", lines: [
  "4 x 10 Leg Press @ 7/10", "4 x 10 Lat Pulldown @ 7/10", "4 x 10 Dumbbell Lateral Raise @ 7/10",
] }] } } }, {}).block;
ok("a large muscle group with nothing at all blocks", Check.checkGymBlock(noChest, FULL_GYM).blocking.some((b) => /no work at all/.test(b)));

/* ── flags: everything a coach might have meant ────────────────────────────── */

const thin = Build.buildBlock({ days: { sun: { parts: [{ title: "A", lines: [
  "1 x 10 Leg Press @ 7/10", "1 x 10 Lat Pulldown @ 7/10", "1 x 10 Chest Press Machine @ 7/10",
  "1 x 10 Seated Dumbbell Shoulder Press @ 7/10",
] }] } } }, {}).block;
const thinR = Check.checkGymBlock(thin, FULL_GYM);
ok("thin volume flags rather than blocks", thinR.blocking.length === 0 && thinR.flags.length > 0);
ok("and says how many sets it found", /sets a week/.test(thinR.flags.join(" ")));
ok("a short session is flagged too", /working sets/.test(thinR.flags.join(" ")));

/* Pre-exhaustion is a method we teach, so isolation-first is a flag and never a block. */
const preExhaust = Build.buildBlock({ days: { sun: { parts: [{ title: "A", lines: [
  "3 x 12 Pec Deck @ 7/10", "4 x 10 Chest Press Machine @ 7/10",
  "4 x 10 Leg Press @ 7/10", "4 x 10 Lat Pulldown @ 7/10", "3 x 12 Seated Dumbbell Shoulder Press @ 7/10",
] }] } } }, {}).block;
const pre = Check.checkGymBlock(preExhaust, FULL_GYM);
ok("isolation before compound is a flag, never a block", pre.blocking.length === 0);
ok("and it says it might be pre-exhaustion on purpose", /pre-exhaustion on purpose/.test(pre.flags.join(" ")));

/* ── core is not counted in the session total ──────────────────────────────── */

const withCore = Check.checkGymBlock(sound, FULL_GYM);
const sessionFlag = withCore.flags.filter((f) => /working sets/.test(f))[0] || "";
ok("core is excluded from the count", !sessionFlag || /Core is not counted/.test(sessionFlag));

/* ── a line we cannot read is a note, not a violation ──────────────────────── */

ok("a coaching note is not read as a set", Check.readLine("Keep the ribs down and breathe") === null);
ok("an empty line is nothing", Check.readLine("") === null);
ok("but a real line is read in full", (function () {
  const l = Check.readLine("4 x 10 Leg Press @ 7/10");
  return l && l.sets === 4 && l.reps === 10 && l.exercise.en === "Leg Press" && l.effort === true;
})());

/* --- a timed hold is not a rep count --------------------------------------
   The first real generation wrote "3 x 45s Bodyweight Plank". Read as reps that is 45, outside
   8-30, and the check would have blocked a plank. It survived only because a word boundary
   happened to fail against the "s", so the distinction is now made on purpose. */

const plank = Check.readLine("3 x 45s Bodyweight Plank @ 7/10");
ok("a hold keeps its set count", plank.sets === 3);
ok("but carries no rep count", plank.reps === 0);
ok("and says it is a hold", plank.hold === true);
ok("while a real rep count is still read", Check.readLine("4 x 12 Leg Press @ 7/10").reps === 12);
ok("and one outside the range still blocks", Check.checkGymBlock(
  Build.buildBlock({ days: { sun: { parts: [{ title: "A", lines: [
    "3 x 40 Leg Press @ 7/10", "4 x 10 Lat Pulldown @ 7/10", "4 x 10 Chest Press Machine @ 7/10",
    "4 x 10 Seated Dumbbell Shoulder Press @ 7/10",
  ] }] } } }, {}).block, FULL_GYM).blocking.some((b) => /outside 8-30/.test(b)));
ok("a plank in a sound week blocks nothing", Check.checkGymBlock(sound, FULL_GYM).blocking.length === 0);

/* -- a line it cannot read must be SAID, not swallowed -------------------------
   An unrecognised exercise is invisible to every check: its sets never reach the muscle's
   weekly total, its equipment is never compared against the room, and core counts as work.
   On the owner's own generation six of seventeen lines were unread and the block came back
   with two volume flags that were false. Under-counting in silence is worse than being wrong
   out loud (2026-10-04). */

const unreadable = {
  weeks: [
    {
      weekIndex: 1,
      days: {
        sun: { parts: [{ title: "A", lines: [
          "4 x 10 Leg Press @ 7/10",
          "4 x 10 Zercher Good Morning Thing @ 7/10",
        ] }] },
        mon: { parts: [] }, tue: { parts: [] }, wed: { parts: [] },
        thu: { parts: [] }, fri: { parts: [] }, sat: { parts: [] },
      },
    },
  ],
};
const said = Check.checkGymBlock(unreadable, { answers: {} });
ok(
  "a line it cannot identify is reported",
  said.flags.some(function (f) { return /does not know/i.test(f); })
);
ok(
  "and the report names one of them",
  said.flags.some(function (f) { return /Zercher Good Morning Thing/.test(f); })
);

const allRead = Check.checkGymBlock(
  {
    weeks: [
      {
        weekIndex: 1,
        days: {
          sun: { parts: [{ title: "A", lines: ["4 x 10 Leg Press @ 7/10"] }] },
          mon: { parts: [] }, tue: { parts: [] }, wed: { parts: [] },
          thu: { parts: [] }, fri: { parts: [] }, sat: { parts: [] },
        },
      },
    ],
  },
  { answers: {} }
);
ok(
  "and nothing is said when every line was read",
  !allRead.flags.some(function (f) { return /does not know/i.test(f); })
);

/* -- a note is read by the rules that are about what the athlete is TOLD --------
   The kilos rule ran over readable lines only — lines with sets in them — so a progression
   note saying "add 2.5 kg to the bar" sailed straight through. A note is exactly where a
   model reaches for a number, which is why the rule now reads every line (2026-10-05). */

function withNote(note) {
  return {
    weeks: [
      {
        weekIndex: 1,
        days: {
          sun: { parts: [{ id: "p", title: "A", noteLines: 1, lines: [note, "4 x 10 Leg Press @ 7/10"] }] },
          mon: { parts: [] }, tue: { parts: [] }, wed: { parts: [] },
          thu: { parts: [] }, fri: { parts: [] }, sat: { parts: [] },
        },
      },
    ],
  };
}
const kilosInNote = function (note) {
  return Check.checkGymBlock(withNote(note), { answers: {} }).blocking.some(function (b) {
    return /kilos/i.test(b);
  });
};

ok("kilos in a note are caught", kilosInNote("Week 3: add 2.5 kg to the bar."));
/* A word boundary is an ENGLISH idea — Hebrew letters are not word characters in a JS regex,
   so the Hebrew half of this rule was silently dead until it was written without one. */
ok("and in Hebrew", kilosInNote('שבוע 3: הוסף 2.5 קילו.'));
ok("and written the short way", kilosInNote('שבוע 3: הוסף 2.5 ק"ג.'));
ok("a note about effort is left alone", !kilosInNote("Week 3: if ten reps felt easy, go up."));
ok("and so is the Hebrew one", !kilosInNote('שבוע 3: אם עשר חזרות היו קלות — העלה.'));

ok("every line is reachable, note or not", Check.allLines(withNote("a note")).length === 2);
ok("while the work walk still sees only work", Check.walkLines(withNote("a note")).length === 1);

console.log("\nבודק החד\"כ — אפס חסימות על תוכנית תקינה, ושמונה על אותה תוכנית אצל השני.");
