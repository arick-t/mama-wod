/**
 * The gym questionnaire — its own contract, and the wall it holds.
 *
 * The owner's instruction about this file in particular: forget the idea that the gym client
 * uses the same questionnaire or reaches the functional brain — "וזה מסוכן אפילו שאתה חושב
 * את זה כדי שלא בטעות תהיה זליגה". So the look is shared and the plumbing is not, and this
 * pins the second half of that sentence.
 *
 * Run: node scripts/gym-intake.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const I = require("../lib/gym-intake.js");
const Lib = require("../lib/gym-exercise-library.js");

const root = path.join(__dirname, "..");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

/* ── the wall ──────────────────────────────────────────────────────────────── */

const src = fs.readFileSync(path.join(root, "lib/gym-intake.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
ok("it imports nothing from the functional intake", src.indexOf("coach-intake-sync") < 0);
ok("nor from the functional catalogue", src.indexOf("equipment-catalog") < 0);
ok("nor from the functional layers", src.indexOf("coach-layers") < 0);

const packet = I.buildGymPacket({ clientName: "A", sessionsPerWeek: 3, split: "full_body", fullyEquipped: true, goalHealth: true });
ok("the packet is a GYM packet, not a FIXED INTAKE one", /^GYM INTAKE COMPLETE/.test(packet));
ok("and never claims to be the functional one", packet.indexOf("FIXED INTAKE COMPLETE") < 0);
ok("it asks for a six-week block", /6-week gym block/.test(packet));
ok("and says the week repeats", /repeats for the whole block/i.test(packet));

/* ── the split tree, and the three shapes that were removed from it ────────── */

ok("two sessions is FULL BODY and nothing else", I.splitsFor(2).join() === "full_body");
ok("three sessions defaults to FULL BODY", I.splitsFor(3)[0] === "full_body");
ok("three sessions offers all three", I.splitsFor(3).length === 3);
ok("four sessions is A+B in its variations", I.splitsFor(4).every((s) => s.indexOf("ab_") === 0 || s === "upper_lower"));
ok("five sessions is the hybrid", I.splitsFor(5).join() === "ppl_upper_lower");
ok("six sessions is PUSH/PULL/LEGS twice", I.splitsFor(6).join() === "push_pull_legs");

/* The shapes that cannot satisfy the owner's own rules must not be selectable. */
const everySplit = [2, 3, 4, 5, 6].reduce((a, n) => a.concat(I.splitsFor(n)), []);
ok("no split mixes FULL BODY into a four-day plan", everySplit.indexOf("ppl_full_body") < 0);
ok("a split the tree never offers is refused", I.normalize({ sessionsPerWeek: 4, split: "full_body" }).split === "");
ok("and a split the tree does offer is kept", I.normalize({ sessionsPerWeek: 3, split: "push_pull_legs" }).split === "push_pull_legs");

/* ── nothing is invented ───────────────────────────────────────────────────── */

const empty = I.normalize({});
ok("an unanswered session count is zero, not a guess", empty.sessionsPerWeek === 0);
ok("an unanswered split is empty", empty.split === "");
ok("no deload unless asked for", empty.deloadWeek === false && empty.deloadEveryWeeks === 0);
ok("and the packet says so out loud", /DELOAD: none in this programme/.test(I.buildGymPacket({})));
ok("a split that was never chosen is named as missing in the packet", /NOT CHOSEN/.test(I.buildGymPacket({ sessionsPerWeek: 3 })));

const gaps = I.missing({});
ok("an empty questionnaire reports what it needs", gaps.length >= 4);
ok("including the equipment", gaps.some((g) => /equipment/i.test(g)));
ok("a full one reports nothing", I.missing({
  clientName: "A", sessionsPerWeek: 4, split: "upper_lower", fullyEquipped: true, goalHypertrophy: true,
}).length === 0);
ok("ticking a deload without a cadence is refused", I.missing({
  clientName: "A", sessionsPerWeek: 2, split: "full_body", fullyEquipped: true, goalHealth: true,
  deloadWeek: true,
}).some((g) => /how often/i.test(g)));

/* ── the equipment is the library's, not a theoretical list ────────────────── */

const libGear = new Set();
Lib.ALL.forEach((e) => e.gear.forEach((g) => libGear.add(g)));
const asked = new Set();
I.EQUIPMENT.concat(I.EXTRAS).forEach((row) => row.gear.forEach((g) => asked.add(g)));
ok("every piece the questionnaire asks about is used by a real exercise", [...asked].every((g) => libGear.has(g)));
ok("and every piece the library needs is askable", [...libGear].every((g) => asked.has(g)));

ok("a fully equipped gym needs no ticks", I.gearList({ fullyEquipped: true }).length >= 20);
ok("and an empty room yields nothing", I.gearList({}).length === 0);
ok("ticking dumbbells yields dumbbells", I.gearList({ equipment: { dumbbells: true } }).join() === "Dumbbells");

/* ── the functional world is not in here ───────────────────────────────────── */

const allLabels = I.EQUIPMENT.concat(I.EXTRAS).map((r) => r.label).join(" ").toLowerCase();
["climbing rope", "trap bar", "kettlebell", "sandbag", "plyo", "rings", "wall ball"].forEach((w) => {
  ok("the gym questionnaire never asks about '" + w + "'", allLabels.indexOf(w) < 0);
});

/* ── the deload cadence belongs to a six-week block ────────────────────────── */

ok("the block is six weeks", I.BLOCK_WEEKS === 6);
ok("and a deload cadence shorter than the block is refused", I.normalize({ deloadWeek: true, deloadEveryWeeks: 4 }).deloadEveryWeeks === 0);
ok("six weeks is accepted", I.normalize({ deloadWeek: true, deloadEveryWeeks: 6 }).deloadEveryWeeks === 6);

/* ── the questionnaire is English; the PROGRAMME may be Hebrew ─────────────── */

ok("the programme language defaults to English", I.normalize({}).outputLanguage === "en");
ok("and Hebrew is a choice", I.normalize({ outputLanguage: "he" }).outputLanguage === "he");
ok("the steps are labelled in English", I.STEPS.every((s) => /^[A-Za-z ]+$/.test(s.label)));

console.log("\nתחקור חדר כושר — חוזה נפרד, " + I.STEPS.length + " שלבים.");
