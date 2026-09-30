/**
 * THE GYM REQUEST — what the second brain is sent, and what it is never sent.
 *
 * This is the file where the two brains could most easily have become one, so most of what is
 * asserted here is absence: the functional prompt, the functional policy book and the functional
 * brief must not appear in a gym request, and this module must not import the file they live in.
 *
 * Run: node scripts/gym-brief.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Brief = require("../lib/gym-brief.js");
const Intake = require("../lib/gym-intake.js");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "lib/gym-brief.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

const answers = {
  clientName: "A", sessionsPerWeek: 3, split: "full_body", trainingDays: ["sun", "tue", "thu"],
  fullyEquipped: true, goalHealth: true, sessionMinutes: 60, noLimits: true,
};
const req = Brief.gymBlockRequestFor({ answers: answers, athleteId: "a1" });
const system = req.system;

/* ── the wall ──────────────────────────────────────────────────────────────── */

ok("it does not import the functional coach", src.indexOf("personal-coach") < 0);
ok("nor the functional layers", src.indexOf("coach-layers") < 0);
ok("nor the functional intake contract", src.indexOf("coach-intake-sync") < 0);
ok("nor the functional catalogue", src.indexOf("equipment-catalog") < 0);

["AMRAP", "EMOM", "metcon", "WOD", "kipping", "wall ball"].forEach(function (w) {
  ok("the gym request never says '" + w + "'", system.toLowerCase().indexOf(w.toLowerCase()) < 0);
});
ok("it does not carry the functional policy book", system.indexOf("COACH POLICY RULES") < 0);
ok("it asks for a gym action, not a functional one", req.body.action === "gym_generate_block");
ok("and marks itself as the gym brain", req.body.gymBrain === true);

/* ── the four things it DOES carry ─────────────────────────────────────────── */

ok("safety, in this product's words", /HUMAN COACH reads/.test(system));
ok("which says the coach carries the responsibility", /carries the responsibility/.test(system));
ok("and refuses rehabilitation outright", /Never write rehabilitation programming/.test(system));
ok("the cost ceiling", /COST \(HARD/.test(system));
ok("saying one call writes the block", /ONE call writes the block/.test(system));
ok("the knowledge layers", /LAYER 1/.test(system) && /LAYER 2/.test(system));
ok("and the JSON contract", /WEEK_JSON/.test(system));

/* ── the one week. The thing a model trained on the other product will get wrong. ── */

ok("it says ONE WEEK in the strongest terms", /ONE WEEK/.test(system));
ok("and says the software makes the six", /The software repeats it/.test(system));
ok("and says why it matters", /an exercise that keeps being swapped/.test(system));
/* The brain writes ONE week; lib/gym-block-build.js makes the six. Asking it for six
   identical weeks paid output tokens six times and let them drift apart. */
ok("the block is six weeks", req.body.blockWeeks === 6);
ok("and the brain is never asked for a block", system.indexOf("BLOCK_JSON") < 0);

/* ── loads are effort, never kilos ─────────────────────────────────────────── */

ok("effort out of ten is the language", /effort out of ten/i.test(system));
ok("and kilos are refused", /A weight in kilos is NOT written/.test(system));
ok("the line format is spelled out", /4 x 10 Leg Press @ 7\/10/.test(system));

/* ── it refuses rather than guesses ────────────────────────────────────────── */

const empty = Brief.gymBlockRequestFor({ answers: {} });
ok("an empty questionnaire is refused", empty.ok === false);
ok("and every gap is named", Array.isArray(empty.missing) && empty.missing.length >= 3);

const noSplit = Brief.gymBlockRequestFor({ answers: Object.assign({}, answers, { split: "" }) });
ok("a missing split is refused", noSplit.ok === false && /split/i.test(noSplit.why));

/* ── what travels with the request ─────────────────────────────────────────── */

ok("the equipment goes as a list the library can read", Array.isArray(req.body.equipment) && req.body.equipment.length >= 20);
ok("the packet goes as the message", /GYM INTAKE COMPLETE/.test(req.body.messages[0].text));
ok("the answers travel too", req.body.gymIntake.split === "full_body");
ok("cost caps travel when given", Brief.gymBlockRequestFor({ answers: answers, costCaps: { a: 1 } }).body.costCaps.a === 1);
ok("and are absent when not", req.body.costCaps === undefined);

/* ── core work, and rest days ──────────────────────────────────────────────── */

ok("core sits at the end and is not counted", /Core work goes at the END/.test(system));
ok("a non-training day is a Rest day", /overview focus exactly "Rest"/.test(system));

console.log("\nבקשת החד\"כ — " + system.length + " תווים, ואף אחד מהם לא של הקרוספיט.");
