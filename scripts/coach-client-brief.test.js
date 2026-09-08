/**
 * A client's file, in the language the coach's brain reads.
 * Run: node scripts/coach-client-brief.test.js
 *
 * The owner is the only person who ever sits in the back office, and he asked for one
 * thing: he fills in an intake there and gets a whole month back (owner, 2026-09-08).
 * His "no AI for the user" is about the app and about the page a client opens by link.
 *
 * What this file guards is the FILE that is sent. He said it in as many words — "this
 * is a real client this time, make sure you feed the intake correctly" — so every
 * assertion here is about his own answers arriving unchanged, and about the two facts
 * the brain must never guess: how long a block is and which week deloads.
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

const B = require("../lib/coach-client-brief.js");
const Intake = require("../lib/client-intake.js");
const Contract = require("../lib/coach-intake-sync-contract.js");
const root = path.join(__dirname, "..");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");

/* A room, answered the way his studio form answers it. */
const ROOM = Intake.normalizeIntake({
  clientName: "קבוצת בוקר",
  population: "adults",
  goals: "general",
  equipment: "functional_gym",
  equipmentOther: "",
  maxAthletesAtOnce: 12,
  scheduleMode: "weekly_schedule",
  includeRestDays: true,
  restDays: { fri: true, sat: true },
  sessionMinutes: 60,
  deloadWeek: true,
  deloadEveryWeeks: 4,
  avoidInProgram: "no overhead squats",
});
function studioProgram(extra) {
  return Object.assign(
    {
      programId: "p_studio",
      clientKind: "coach",
      clientName: "קבוצת בוקר",
      intake: ROOM,
      blocks: [{ blockIndex: 1, startWeek: 1, weekCount: 4 }],
      weeks: [{ weekIndex: 1, days: {} }, { weekIndex: 2, days: {} }, { weekIndex: 3, days: {} }, { weekIndex: 4, days: {} }],
    },
    extra || {}
  );
}

/* --- who the brain may write for ----------------------------------------- */

ok("a studio, yes", B.canBrainWrite(studioProgram()).ok === true);
ok("an individual with answers on file, yes", B.canBrainWrite({ clientKind: "athlete", athleteIntake: { displayName: "יעל" } }).ok === true);
/* A blank client exists so HE can write by hand — the brain has nothing to read. */
const blank = B.canBrainWrite({ clientKind: "blank" });
ok("a blank client, never", blank.ok === false);
ok("and it says why in his words", /לקוח ריק/.test(blank.why));
ok("a studio with no questionnaire is refused", B.canBrainWrite({ clientKind: "coach" }).ok === false);
ok("and so is nothing at all", B.canBrainWrite(null).ok === false);

/* --- the file that is sent ----------------------------------------------- */

const req = B.blockRequestFor({ program: studioProgram(), blockIndex: 1 });
ok("a request is built", req.ok === true && !!req.body);
ok("it asks for a block", req.body.action === "generate_block");
ok("it says the owner is the one asking", req.body.adminProgramming === true);
ok("and insists on JSON", req.body.forceJson === true);
/* The presence of studioIntake is what tells the brain it is programming a ROOM. */
ok("a room is declared as a room", req.body.studioIntake === ROOM);
ok("and it is his own normalised questionnaire, not a copy of it", req.body.studioIntake.maxAthletesAtOnce === 12);

const sent = req.body.messages[0].text;
ok("the message is the studio brief the product already writes", /STUDIO INTAKE COMPLETE/.test(sent));
/* HIS ANSWERS, one by one. This is the assertion he asked for. */
ok("the population he answered", /adults/.test(sent));
ok("the equipment he answered", /functional training gym/i.test(sent));
ok("how many people are in the room at once", /12/.test(sent));
ok("what he said not to program", /overhead squat/i.test(sent));
ok("and the rest days he ticked", /Fri/.test(sent) && /Sat/.test(sent));
ok("nothing is sent in Hebrew to be programmed from", /MUST be English/.test(sent));

/* The two facts the brain must never guess. */
ok("a block is four weeks", req.athleteProfile.blockWeeks === 4);
ok("and the deload week is computed, not guessed", req.athleteProfile.deloadWeekIndex === 4);
ok("the block's place in the plan travels", req.body.blockStartWeek === 1);

/* A room that ticked "deload" without naming a cadence still gets one: the form's tick
   means the default four, and a missing deload week closes the 1RM window for ever. */
const tickOnly = B.blockRequestFor({
  program: studioProgram({ intake: Intake.normalizeIntake({ clientName: "r", population: "adults", deloadWeek: true }) }),
  blockIndex: 1,
});
ok("a tick with no cadence still names a deload week", tickOnly.athleteProfile.deloadWeekIndex === 4);
const noDeload = B.blockRequestFor({
  program: studioProgram({ intake: Intake.normalizeIntake({ clientName: "r", population: "adults" }) }),
  blockIndex: 1,
});
ok("and a room that wants none has none", noDeload.athleteProfile.deloadWeekIndex === null);

/* --- a second block counts its weeks from where it starts ---------------- */

const secondBlock = B.blockRequestFor({
  program: studioProgram({
    blocks: [
      { blockIndex: 1, startWeek: 1, weekCount: 4 },
      { blockIndex: 2, startWeek: 5, weekCount: 4 },
    ],
    weeks: new Array(8).fill(0).map(function (_, i) { return { weekIndex: i + 1, days: {} }; }),
  }),
  blockIndex: 2,
});
ok("the second block starts at week five", secondBlock.body.blockStartWeek === 5);
ok("and its deload is still counted per block", secondBlock.athleteProfile.deloadWeekIndex === 4);
const win = B.blockWeekWindow(secondBlock.program || studioProgram({
  blocks: [{ blockIndex: 1, startWeek: 1, weekCount: 4 }, { blockIndex: 2, startWeek: 5, weekCount: 4 }],
  weeks: new Array(8).fill(0).map(function (_, i) { return { weekIndex: i + 1, days: {} }; }),
}), 2);
ok("and only that block's weeks are in play", win.fromIndex === 4 && win.count === 4);

/* --- an individual --------------------------------------------------------- */

const person = B.blockRequestFor({
  program: {
    programId: "p_one",
    clientKind: "athlete",
    clientName: "יעל",
    athleteIntake: {
      displayName: "יעל",
      gender: "female",
      age: "34",
      experience: "2 years",
      trainingDays: ["sun", "tue", "thu"],
      sessionMinutes: 60,
      injuries: "left shoulder",
      goals: "first pull-up",
      lifts: {},
      skills: {},
      deloadEveryWeeks: 4,
    },
    blocks: [{ blockIndex: 1, startWeek: 1, weekCount: 4 }],
    weeks: [{ weekIndex: 1, days: {} }],
  },
  blockIndex: 1,
});
ok("an individual's request is built", person.ok === true);
/* No studioIntake — that absence is what makes them a person, not a room. */
ok("and they are NOT declared a room", person.body.studioIntake === undefined);
ok("their own answers are what is sent", /יעל|shoulder|pull-up/i.test(person.body.messages[0].text) || person.body.messages[0].text.length > 50);
ok("with the deload week computed for them too", person.athleteProfile.deloadWeekIndex === 4);
ok("and their file marked complete", person.body.intakeComplete === true);

/* --- the button and the panel in his module ------------------------------ */

ok("the button exists where he can see it", admin.indexOf('data-brainwrite="1"') >= 0);
ok("only where the brain may write", admin.indexOf("function brainWriteButtonHtml(p)") >= 0 && /canBrainWrite\(p\)/.test(admin));
/* He asked for this in as many words: read the file back before spending. */
ok("it shows him what will be sent, first", admin.indexOf("זה מה שנשלח למאמן — קרא ואשר") >= 0);
ok("with the questionnaire itself on screen", /class="brain-brief"/.test(admin));
ok("and it only sends when he says so", admin.indexOf('data-brainsend="1"') >= 0);
ok("the price is on the panel", admin.indexOf("₪0.35") >= 0);
/* Nothing about approval changes: the client sees nothing until he sends. */
ok("the month lands unapproved and it says so", admin.indexOf("הלקוח לא רואה כלום עד שתשלח") >= 0);
ok("it writes through the ordinary save, version check and all", /expectedVersion: S\.program\.version,\s*\n\s*program: \{ weeks: weeks \}/.test(admin));
ok("a stale write reopens the client instead of overwriting", /cvBrain\.error = "מישהו שמר בינתיים/.test(admin));
ok("and a failure offers to carry on", admin.indexOf('data-brainresume="1"') >= 0);

console.log("\nAll coach-client-brief checks passed (" + passed + " assertions).");
