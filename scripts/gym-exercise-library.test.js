/**
 * The gym exercise library — the tags every ordering rule depends on.
 *
 * "Compound before isolated", "large before small" and "a FULL BODY session opens on the lower
 * body" are all unenforceable unless each exercise knows its muscle, its kind and its equipment.
 * This pins that, and pins the one rule that keeps a programme working in a real gym: nothing at
 * tier 2 may exist without a tier-1 stand-in beside it.
 *
 * Run: node scripts/gym-exercise-library.test.js
 */
const assert = require("assert");
const L = require("../lib/gym-exercise-library.js");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

/* ── every row is fully tagged ─────────────────────────────────────────────── */

const KINDS = ["compound", "isolation"];
const HALVES = ["upper", "lower", "core"];
const MUSCLES = L.LARGE.concat(L.SMALL);

ok("the library is not empty", L.ALL.length >= 60);
ok("every exercise names a muscle we count", L.ALL.every((e) => MUSCLES.indexOf(e.muscle) >= 0));
ok("every exercise is compound or isolated", L.ALL.every((e) => KINDS.indexOf(e.kind) >= 0));
ok("every exercise belongs to a half of the body", L.ALL.every((e) => HALVES.indexOf(e.half) >= 0));
ok("every exercise names its equipment", L.ALL.every((e) => Array.isArray(e.gear) && e.gear.length));
ok("every exercise carries an availability tier", L.ALL.every((e) => e.tier === 1 || e.tier === 2));
ok("every exercise is written in both languages", L.ALL.every((e) => e.en && e.he));
ok("no exercise is listed twice", new Set(L.ALL.map((e) => e.en)).size === L.ALL.length);

/* ── the rule that keeps a programme working in a real gym ─────────────────── */

const tier2 = L.ALL.filter((e) => e.tier === 2);
ok("there are tier-2 exercises to worry about", tier2.length > 0);
ok("and not one of them lacks a tier-1 stand-in", tier2.every((e) => {
  const f = L.fallbackFor(e.en);
  return f && f.tier === 1;
}));
ok("a stand-in trains the same muscle", tier2.every((e) => L.fallbackFor(e.en).muscle === e.muscle));
ok("assumable() returns tier 1 only", L.assumable().every((e) => e.tier === 1));

/* ── enough to actually build a month out of tier 1 alone ──────────────────── */

L.LARGE.forEach((m) => {
  const t1 = L.byMuscle(m).filter((e) => e.tier === 1);
  ok("a generic gym can train " + L.HE[m] + " without confirming anything", t1.length >= 6);
  ok("and " + L.HE[m] + " has compound work in it", t1.filter((e) => e.isCompound).length >= 2);
});

/* ── the doctrine's own shape ──────────────────────────────────────────────── */

ok("legs, back, chest and shoulders are the large groups", L.LARGE.join() === "legs,back,chest,shoulders");
ok("core work is core work, never counted as a large group", L.byMuscle("core").every((e) => !e.isLarge));
ok("the lower body has compound work to open a FULL BODY session with",
  L.ALL.filter((e) => e.half === "lower" && e.isCompound && e.tier === 1).length >= 5);

/* ── reading a written line, in either language ────────────────────────────── */

const en = L.find("4 sets x 10 Incline Dumbbell Press @ 8/10");
ok("an English line finds its exercise", en && en.en === "Incline Dumbbell Press");
ok("and with it the muscle and the kind", en.muscle === "chest" && en.isCompound);

const he = L.find("3 סטים של 12 חתירה בישיבה בכבל");
ok("a Hebrew line finds it too", he && he.en === "Seated Cable Row");

/* Longest match wins — the same trap the equipment catalogue was built around. */
const long = L.find("Incline Dumbbell Press");
ok("the longer name wins over the shorter one", long.en === "Incline Dumbbell Press");
ok("an unknown line finds nothing rather than guessing", L.find("12 kipping muscle-ups") === null);

console.log("\nספריית התרגילים — " + L.ALL.length + " תרגילים, כולם מתויגים.");
