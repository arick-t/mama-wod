/**
 * THE GYM HANDOFF — what one block leaves for the next.
 *
 * The thing being guarded is the opposite of the functional product's rule, and it is easy to
 * get backwards: INSIDE a gym block the exercises are frozen so the load can rise on them;
 * BETWEEN blocks they change. So the next block has to be told what the last one was, or it
 * writes the same six exercises again and the athlete runs one programme for three months.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const H = require("../lib/gym-handoff.js");
const Brief = require("../lib/gym-brief.js");
const Intake = require("../lib/gym-intake.js");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

/* A block shaped the way the builder makes them: six identical weeks. */
function blockOf(lines, phases) {
  const day = { parts: [{ id: "p1", title: "A", lines: lines }] };
  const rest = { parts: [] };
  return {
    weeks: (phases || ["build", "build", "build", "build", "build", "build"]).map(function (p, i) {
      return {
        weekIndex: i + 1,
        phase: p,
        days: {
          sun: JSON.parse(JSON.stringify(day)),
          mon: JSON.parse(JSON.stringify(rest)),
          tue: JSON.parse(JSON.stringify(day)),
          wed: JSON.parse(JSON.stringify(rest)),
          thu: JSON.parse(JSON.stringify(rest)),
          fri: JSON.parse(JSON.stringify(rest)),
          sat: JSON.parse(JSON.stringify(rest)),
        },
      };
    }),
  };
}

const LINES = [
  "4 x 10 Leg Press @ 7/10",
  "4 x 8 Barbell Back Squat @ 8/10",
  "3 x 12 Lat Pulldown @ 7/10",
  "3 x 45 sec Plank @ 8/10",
];

/* ── reading a name off a line ────────────────────────────────────────────── */

ok("the sets come off the front", H.setsOf("4 x 10 Leg Press @ 7/10") === 4);
ok("a line with no sets counts nothing", H.setsOf("Add weight when ten feels easy") === 0);
ok("the name is what is left", H.nameOf("4 x 10 Leg Press @ 7/10") === "Leg Press");
ok("a hold loses its seconds", H.nameOf("3 x 45 sec Plank @ 8/10") === "Plank");
/* The unit is only the unit when it IS the word after the number. Without that boundary the
   "s" ate the S of "Seated" and the handoff named an exercise that does not exist. */
ok("and a name beginning with S keeps it",
  H.nameOf("4 x 10 Seated Dumbbell Overhead Press @ 8/10") === "Seated Dumbbell Overhead Press");
ok("so does Standing", H.nameOf("4 x 12 Standing Cable Lateral Raise @ 8/10") === "Standing Cable Lateral Raise");

/* ── the block, counted ───────────────────────────────────────────────────── */

const made = H.handoffFrom({ block: blockOf(LINES), startWeek: 1, answers: { split: "full_body" } });
ok("a delivered block makes a handoff", made.ok === true);
const h = made.handoff;

/* ONE week is the whole block — counting six would report everything six times. */
ok("each exercise is carried once, not once per week", h.exercises.length === LINES.length * 2);
ok("the next block starts where this one ended", h.nextStartWeek === 7);
ok("the split travels with it", h.split === "full_body");
ok("the volume is counted per muscle", h.weeklySets.legs > 0 && h.weeklySets.back > 0);

const deloaded = H.handoffFrom({
  block: blockOf(LINES, ["build", "build", "build", "build", "build", "deload"]),
  startWeek: 1,
});
ok("the week the deload actually fell on is carried", deloaded.handoff.lastDeloadWeek === 6);
ok("and none is reported when none was given", made.handoff.lastDeloadWeek === 0);

const later = H.handoffFrom({ block: blockOf(LINES, ["build", "build", "build", "build", "build", "deload"]), startWeek: 7 });
ok("counted on the ABSOLUTE week, not the week of its own block", later.handoff.lastDeloadWeek === 12);

ok("an empty block carries nothing forward", H.handoffFrom({ block: { weeks: [] } }).ok === false);
ok("and neither does no block at all", H.handoffFrom({}).ok === false);

/* ── what the brain is told ───────────────────────────────────────────────── */

const text = H.handoffText(h);
ok("it names the exercises to change", /Leg Press/.test(text) && /Lat Pulldown/.test(text));
ok("and says why they change between blocks", /Between blocks they CHANGE/.test(text));
ok("it says which week this block starts on", /weeks 7 onward/.test(text));
ok("it never claims anything about how the athlete felt",
  !/felt|enjoyed|struggled|did well|motivat/i.test(text));
ok("and it cannot become the biggest thing in the request", text.length <= H.MAX_CHARS);

const short = H.handoffText({ weeksDone: 6, nextStartWeek: 7, exercises: [], weeklySets: { biceps: 4, legs: 14 } });
ok("a muscle under ten sets is named", /biceps \(4\)/.test(short));
ok("and one inside the range is not", !/legs \(14\)/.test(short));

const edited = H.handoffText({ weeksDone: 6, nextStartWeek: 7, exercises: [], weeklySets: {}, coachEdited: ["W2 sun"] });
ok("a day the coach rewrote is carried forward", /W2 sun/.test(edited));
ok("and it is called the better guide", /better guide to this athlete/.test(edited));

/* ── and the request actually carries it ──────────────────────────────────── */

const answers = Intake.normalize({
  clientName: "x", sessionsPerWeek: 3, split: "full_body",
  trainingDays: ["sun", "tue", "thu"], sessionMinutes: 60,
  fullyEquipped: true, noLimits: true, goalHypertrophy: true,
});
const first = Brief.gymBlockRequestFor({ answers: answers });
const next = Brief.gymBlockRequestFor({ answers: answers, handoff: h });
ok("a first block is told of no before", !/WHAT CAME BEFORE/.test(first.system));
ok("a continuation is", /WHAT CAME BEFORE/.test(next.system));
ok("and the contract is still the last word on shape",
  next.system.lastIndexOf("WHAT YOU RETURN") > next.system.indexOf("WHAT CAME BEFORE"));
ok("it is carried in the body too, for the server", !!next.body.gymHandoff);
/* It has to stay small: this is the cheap brain and it must stay the cheap brain. */
ok("and it costs a few hundred tokens, not a few thousand",
  next.system.length - first.system.length < 2600);

/* ── the endpoint reads the plan off it ───────────────────────────────────── */

const api = fs.readFileSync(path.join(root, "api", "gym-coach.js"), "utf8");
ok("the start week can come from the handoff", /gymHandoff && body\.gymHandoff\.nextStartWeek/.test(api));
ok("and so can the week the last deload fell on", /gymHandoff && body\.gymHandoff\.lastDeloadWeek/.test(api));

console.log("\nמסירה בין לבנות חד\"כ — נמדדת מהלבנה שנמסרה, לא מסופרת.");
