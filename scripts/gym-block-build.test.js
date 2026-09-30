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
ok("and it holds the same sessions as the rest", JSON.stringify(every6.block.weeks[5].days) === JSON.stringify(every6.block.weeks[0].days));

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

console.log("\nשבוע אחד נכנס, שישה יוצאים — והקיפאון מובנה, לא מבוקש.");
