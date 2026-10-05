/**
 * ONE WEEK IN, SIX WEEKS OUT.
 *
 * The frozen week is enforced HERE rather than instructed, and that is the point of the file.
 * The first contract asked the brain for six identical weeks — which paid output tokens six
 * times over and left room for the six to drift from each other, the exact failure the rule
 * exists to prevent. A model cannot disobey a rule it is never asked to follow.
 *
 * Run: node scripts/gym-block-build.test.js
 */
const assert = require("assert");
const B = require("../lib/gym-block-build.js");
const Brief = require("../lib/gym-brief.js");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

const WEEK = {
  summaryLine: "Full body, learning the lifts",
  theme: "Base",
  days: {
    sun: { parts: [{ title: "Full Body A", lines: ["4 x 10 Leg Press @ 7/10", "3 x 12 Lat Pulldown @ 7/10"] }] },
    tue: { parts: [{ title: "Full Body B", lines: ["4 x 10 Goblet Squat @ 7/10"] }] },
    thu: { parts: [{ title: "Full Body C", lines: ["4 x 12 Romanian Deadlift @ 6/10"] }] },
  },
};
const TEXT = "Here you go.\n<<<WEEK_JSON\n" + JSON.stringify(WEEK) + "\nWEEK_JSON>>>\nTell me if you want changes.";

/* ── the contract asks for one week, and only one ──────────────────────────── */

const system = Brief.buildGymSystem({});
ok("the brain is asked for ONE week", /ONE WEEK/.test(system));
ok("in a WEEK_JSON marker", /<<<WEEK_JSON/.test(system));
ok("and is never asked for a block", system.indexOf("BLOCK_JSON") < 0);
ok("it is told the software repeats it", /The software repeats it/.test(system));

/* ── reading it back ───────────────────────────────────────────────────────── */

ok("the week is found inside the markers", B.weekFromText(TEXT) !== null);
ok("and inside prose without a closing marker", B.weekFromText("blah <<<WEEK_JSON " + JSON.stringify(WEEK)) !== null);
ok("and as bare JSON, because a dropped marker is not lost work", B.weekFromText(JSON.stringify(WEEK)) !== null);
ok("nothing usable gives nothing", B.weekFromText("I cannot do that") === null);
ok("and so does an empty answer", B.weekFromText("") === null);

/* ── six weeks out ─────────────────────────────────────────────────────────── */

const built = B.blockFromText(TEXT, { answers: { noLimits: true }, startWeek: 1 });
ok("a block is built", built.ok === true);
ok("it is six weeks", built.block.weeks.length === 6);
ok("every week is a training week", built.block.weeks.every((w) => Object.keys(w.days).some((k) => w.days[k].parts.length)));
ok("and every week holds the same sessions", new Set(built.block.weeks.map((w) => JSON.stringify(w.days))).size === 1);
ok("it is marked as a gym block", built.block.gymBlock === true);

/* The copy has to be deep. One shared object means editing week 1 rewrites all six —
   which is how a frozen week becomes an unfixable one. */
built.block.weeks[0].days.sun.parts[0].lines[0] = "changed";
ok("editing one week does not rewrite the others", built.block.weeks[1].days.sun.parts[0].lines[0] !== "changed");

/* ── rest days, and the focus line the client sees ─────────────────────────── */

const w1 = B.blockFromText(TEXT, { answers: {} }).block.weeks[0];
ok("a day with nothing in it is Rest", w1.overview.filter((o) => o.focus === "Rest").length === 4);
ok("and a day with work carries its name", w1.overview.find((o) => o.day === "sun").focus === "Full Body A");
ok("three training days, as written", w1.overview.filter((o) => o.focus !== "Rest").length === 3);

/* ── the deload, when one was asked for ────────────────────────────────────── */

const noDeload = B.blockFromText(TEXT, { answers: { noLimits: true }, startWeek: 1 });
ok("no deload asked for, none appears", noDeload.block.weeks.every((w) => w.phase === "build"));

const every6 = B.blockFromText(TEXT, { answers: { deloadWeek: true, deloadEveryWeeks: 6 }, startWeek: 1 });
ok("a cadence of six lands on week 6", every6.block.weeks[5].phase === "deload");
ok("and on nothing else", every6.block.weeks.filter((w) => w.phase === "deload").length === 1);
ok("the deload week says what to do with it", /the same sessions, lighter/i.test(every6.block.weeks[5].summaryLine));
/* THE SAME SESSIONS, with the note on top of them. The check used to compare the two weeks
   whole, which was right until the deload week started carrying an instruction — and then a
   correct week would have read as a broken one. What matters has not changed: the TRAINING is
   identical, because a deload is the same work done lighter and not different work. */
function trainingOnly(week) {
  const copy = JSON.parse(JSON.stringify(week.days));
  Object.keys(copy).forEach(function (k) {
    copy[k].parts = (copy[k].parts || []).filter(function (p) {
      return p.id !== B.DELOAD_NOTE_ID;
    });
  });
  return JSON.stringify(copy);
}
ok("and it holds the same sessions as the rest", trainingOnly(every6.block.weeks[5]) === trainingOnly(every6.block.weeks[0]));

/* Counted on the ABSOLUTE week of the plan — a cadence that restarted each block would drift. */
const second = B.blockFromText(TEXT, { answers: { deloadWeek: true, deloadEveryWeeks: 6 }, startWeek: 7 });
ok("the second block carries the count on", second.block.weeks[5].phase === "deload");
const sixth = B.blockFromText(TEXT, { answers: { deloadWeek: true, deloadEveryWeeks: 8 }, startWeek: 1 });
ok("a cadence longer than the block puts none in it", sixth.block.weeks.every((w) => w.phase === "build"));

/* ── it refuses rather than inventing ──────────────────────────────────────── */

ok("a week with no training day is refused", B.buildBlock({ days: {} }).ok === false);
ok("and says why", /no training day/.test(B.buildBlock({ days: {} }).why));
ok("nothing at all is refused", B.buildBlock(null).ok === false);
ok("and unreadable text too", B.blockFromText("nope").ok === false);

/* --- the shape a model actually drifted to on the first real generation ----
   It returned days as an ARRAY of {day_name, parts:[{group, exercises}]}. The work was right -
   the right exercises, the right loads, designed around the athlete's shoulder - and a stricter
   reader would have thrown all of it away and charged for a retry. */

const drifted = {
  summaryLine: "Full body",
  days: [
    { day_number: 1, day_name: "Sunday", parts: [{ group: "Back", exercises: ["3 x 12 Lat Pulldown @ 7/10"] }] },
    { day_number: 3, day_name: "Tuesday", parts: [{ group: "Legs", exercises: ["4 x 10 Leg Press @ 7/10"] }] },
  ],
};
const fromDrift = B.buildBlock(drifted, { answers: {} });
ok("a drifted shape is still read", fromDrift.ok === true);
ok("day names land on the right weekdays", fromDrift.block.weeks[0].days.sun.parts.length === 1 && fromDrift.block.weeks[0].days.tue.parts.length === 1);
ok("'group' is read as the title", fromDrift.block.weeks[0].days.sun.parts[0].title === "Back");
ok("and 'exercises' as the lines", fromDrift.block.weeks[0].days.sun.parts[0].lines[0] === "3 x 12 Lat Pulldown @ 7/10");
ok("the contract still shows the exact keys it should have used", /"days": \{/.test(Brief.GYM_CONTRACT));
ok("including the seven day keys", /sun mon tue wed thu fri sat/.test(Brief.GYM_CONTRACT));

/* -- a deload week has to SAY it is one ---------------------------------------
   The week carried phase:"deload" and an instruction in its summaryLine, and nothing in the
   product displays a week's summaryLine — so the owner opened week 6, saw the same five
   sessions under a tint, and asked whether the deload was broken (2026-09-30). It goes in the
   DAY now, because the day is what anybody opens. */

const dl = B.buildBlock(
  {
    summaryLine: "x",
    days: {
      sun: { parts: [{ title: "A", lines: ["4 x 10 Leg Press @ 7/10"] }] },
      mon: { parts: [] }, tue: { parts: [] }, wed: { parts: [] },
      thu: { parts: [] }, fri: { parts: [] }, sat: { parts: [] },
    },
  },
  { answers: { deloadWeek: true, deloadEveryWeeks: 6 }, startWeek: 1 }
).block;

ok("the sixth week is the deload", dl.weeks[5].phase === "deload");
ok("and it opens with the note", dl.weeks[5].days.sun.parts[0].id === B.DELOAD_NOTE_ID);
ok("which says what to do", /lighter/i.test(dl.weeks[5].days.sun.parts[0].lines[0]));
ok("and it says to drop a set", dl.weeks[5].days.sun.parts.some(function (p) {
  return (p.lines || []).some(function (l) { return /drop one set/i.test(l); });
}));
ok("the training day is still there under it", dl.weeks[5].days.sun.parts[1].title === "A");
ok("a build week carries no note", dl.weeks[0].days.sun.parts[0].id !== B.DELOAD_NOTE_ID);
ok("and a rest day gets none either", (dl.weeks[5].days.tue.parts || []).length === 0);
ok("the note is not readable as work", (function () {
  const Check = require("../lib/gym-brick-check.js");
  return (dl.weeks[5].days.sun.parts[0].lines || []).every(function (l) {
    const r = Check.readLine(l);
    return !r || !r.sets;
  });
})());

/* ONE cadence rule. This used to be `absolute % cadence`, which agrees with the product's own
   rule for a first block and disagrees the moment a previous block already deloaded. */
const cont = B.buildBlock(
  {
    summaryLine: "x",
    days: {
      sun: { parts: [{ title: "A", lines: ["4 x 10 Leg Press @ 7/10"] }] },
      mon: { parts: [] }, tue: { parts: [] }, wed: { parts: [] },
      thu: { parts: [] }, fri: { parts: [] }, sat: { parts: [] },
    },
  },
  { answers: { deloadWeek: true, deloadEveryWeeks: 6 }, startWeek: 7, deloadSinceWeek: 6 }
).block;
ok(
  "a continuation counts from the rest already given, not from week one",
  cont.weeks.map(function (w) { return w.phase; }).join(",") === "build,build,build,build,build,deload"
);
ok("the builder reads the product's own rule", /require\("\.\/client-intake\.js"\)/.test(
  require("fs").readFileSync(require("path").join(__dirname, "..", "lib", "gym-block-build.js"), "utf8")
));

/* -- the coach's voice: one note per session, per week -------------------------
   The sessions are identical every week on purpose — the same movements are what the load
   rises on — so without these lines there is nothing on the athlete's screen saying week 3 is
   not week 1. The owner, asked what should be in them (2026-10-05): "ללא הערות מקצועיות,
   אלא רק הערות על התקדמות ועומסים", and "בשאיפה הערה לכל אימון". */

const PROG = ["W1 find it", "W2 same, cleaner", "W3 easier now — go up", "W4 hold", "W5 top set 8/10", "W6 last push"];
const withProg = B.buildBlock(
  {
    summaryLine: "x",
    days: {
      sun: { parts: [{ title: "Session A", progression: PROG, lines: ["4 x 10 Leg Press @ 7/10"] }] },
      mon: { parts: [] }, tue: { parts: [] }, wed: { parts: [] },
      thu: { parts: [] }, fri: { parts: [] }, sat: { parts: [] },
    },
  },
  { answers: { deloadWeek: false }, startWeek: 1 }
).block;

PROG.forEach(function (text, i) {
  const part = withProg.weeks[i].days.sun.parts[0];
  ok("week " + (i + 1) + " reads its own note", part.lines[0] === text);
});
ok("the note is marked as a note, not as work", withProg.weeks[0].days.sun.parts[0].noteLines === 1);
ok("the training is still under it", withProg.weeks[0].days.sun.parts[0].lines[1] === "4 x 10 Leg Press @ 7/10");
ok("and the six are not left on the part for a reader to see twice",
  withProg.weeks.every(function (w) { return !("progression" in w.days.sun.parts[0]); }));
ok("a rest day gets none", (withProg.weeks[0].days.mon.parts || []).length === 0);

/* Fewer notes than weeks is not an error — those weeks simply carry none. */
const short = B.buildBlock(
  {
    summaryLine: "x",
    days: {
      sun: { parts: [{ title: "A", progression: ["only one"], lines: ["4 x 10 Leg Press @ 7/10"] }] },
      mon: { parts: [] }, tue: { parts: [] }, wed: { parts: [] },
      thu: { parts: [] }, fri: { parts: [] }, sat: { parts: [] },
    },
  },
  { answers: { deloadWeek: false }, startWeek: 1 }
).block;
ok("a short list still lands on week one", short.weeks[0].days.sun.parts[0].lines[0] === "only one");
ok("and the weeks past it are left alone", short.weeks[3].days.sun.parts[0].lines[0] === "4 x 10 Leg Press @ 7/10");
ok("with no note marker where there is no note", !short.weeks[3].days.sun.parts[0].noteLines);

console.log("\nשבוע אחד נכנס, שישה יוצאים — והקיפאון מובנה, לא מבוקש.");
