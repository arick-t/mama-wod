/**
 * THE DELOAD DOCTRINE — one rule, everywhere (POL-032).
 *
 * A brick is FOUR weeks of training. There is no fifth week. A deload is not a default
 * and never the coach's choice: it exists only when the intake asked for one, it runs on
 * a cadence counted continuously across months, and the request names which week of this
 * brick it falls on — or says that none does.
 *
 * This existed in four places at once and disagreed with itself in two of them: the
 * foundation brief and the system prompt told the coach "brick = 5 weeks, week 5 deload"
 * in the very same request where the layers and the packet said the opposite. The display
 * then padded every block to five and painted the fifth "Deload" for an athlete who had
 * asked for none (owner, 2026-09-22).
 *
 * Run: node scripts/deload-doctrine.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const N = require("../lib/normalize-pprog-block.js");
const D = require("../lib/pprog-display.js");
const Contract = require("../lib/coach-intake-sync-contract.js");
const Brief = require("../lib/coach-client-brief.js");
const Store = require("../lib/client-program-store.js");

const POLICY = require("../api/coach-policy.js");
const PROMPT = require("../api/hamamen-prompt.js");
const FOUNDATION = require("../api/coach-foundation-brief.js");
const LAYER2 = require("../lib/coach-layers/layer2-general.js");
const INTAKE_JS = fs.readFileSync(path.join(root, "admin-fixed-intake.js"), "utf8");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

/* ── 1. every voice in one request says the same thing ───────────────────────
   These four texts reach the coach TOGETHER. Any one of them saying five weeks
   puts the model back where it started. */

const voices = { "the policy": POLICY, "the system prompt": PROMPT, "the foundation brief": FOUNDATION, "layer 2": LAYER2 };
for (const [who, text] of Object.entries(voices)) {
  ok(who + " does not call a brick five weeks", !/5[- ]week|five[- ]week|weekIndex 1…5|שבוע 5 = deload|5 שבועות/i.test(String(text)));
}
ok("the prompt's JSON skeleton has no fifth week", !/"weekIndex":\s*5/.test(String(PROMPT)));
/* The brief names the phrase once, to forbid it. Anywhere else it would be the confusion
   itself: "active recovery / daily deload" was how one name came to mean two things. */
ok("the brief forbids the phrase rather than using it", /Never call an active recovery day a daily deload/.test(String(FOUNDATION)));
ok("and never uses it as a label of its own", !/active recovery \/ daily deload/i.test(String(FOUNDATION)));
ok("the policy states the doctrine once, as POL-032", /POL-032/.test(String(POLICY)));
ok("and names the three things apart", /REST DAY[\s\S]{0,400}ACTIVE RECOVERY DAY[\s\S]{0,400}DELOAD WEEK/.test(String(POLICY)));

/* The two OTHER briefs that travel on the programming path. The first sweep missed both,
   which is exactly how a doctrine ends up saying two things: coach-layer2-ops-brief is
   injected beside the foundation brief on every generate_*, and the upgrade push rides
   along when a block is re-issued. */
const OPS = require("../lib/coach-layer2-ops-brief.js");
const PUSH = fs.readFileSync(path.join(root, "lib/coach-push-upgrade.js"), "utf8");
ok("the layer-2 ops brief does not call a brick five weeks", !/5[- ]week|week 5 deload/i.test(String(OPS)));
ok("nor does the upgrade push", !/5[- ]week|five[- ]week/i.test(PUSH));

/* And the phrase itself, in the live coach instructions rather than the briefs. */
const PC = fs.readFileSync(path.join(root, "api/personal-coach.js"), "utf8");
ok("the coach is never told about a 'daily deload'", !/daily.?deload/i.test(PC));
ok("and active recovery is named as a DAY, against the week", /a deload is a whole week/i.test(PC));

/* ── 2. the display invents nothing ─────────────────────────────────────────── */

function wk(i, phase) {
  const w = { weekIndex: i, days: { sun: { parts: [{ title: "S", lines: ["5x5 Back Squat"] }] } } };
  if (phase) w.phase = phase;
  return w;
}
const four = N.normalize({ weeks: [wk(1), wk(2), wk(3), wk(4)] }, null);
ok("four weeks in, four weeks out", four.weeks.length === 4);
ok("and not one of them is called a deload", four.weeks.every((w) => w.phase !== "deload"));
ok("the heading does not promise a deload", !/deload/i.test(four.summaryLine));

const marked = N.normalize({ weeks: [wk(1), wk(2), wk(3, "deload"), wk(4)] }, null);
ok("a deload the coach wrote keeps its place", marked.weeks[2].phase === "deload");
ok("and does not spread to the last week", marked.weeks[3].phase === "build");

ok("a block already saved with five weeks is not cut", N.normalize({ weeks: [wk(1), wk(2), wk(3), wk(4), wk(5)] }, null).weeks.length === 5);
ok("and a sixth week is no longer dropped in silence", N.normalize({ weeks: [wk(1), wk(2), wk(3), wk(4), wk(5), wk(6)] }, null).weeks.length === 6);

const cal = D.renderCalHtml(four, 0, "sun", { calMode: "month", readOnly: true, hooks: {} });
ok("the calendar draws four rows, not five", /W4/.test(cal) && !/W5/.test(cal));
ok("and paints no deload row nobody asked for", !/deload-week/.test(cal));

/* ── 3. the counter runs across months, which is the whole point ─────────────
   Cadence of five: weeks 5, 10, 15 of the PLAN. So block 2 opens on the deload. */

function programAfter(blocks) {
  return {
    programId: "p1",
    clientKind: Brief.INDIVIDUAL,
    clientName: "A",
    weeks: Array.from({ length: blocks * 4 }, (_, i) => ({ weekIndex: i + 1, days: {} })),
    blocks: Array.from({ length: blocks }, (_, i) => ({ blockIndex: i + 1, startWeek: i * 4 + 1, weekCount: 4, approvedAt: "2026-09-01" })),
    athleteIntake: { deloadEveryWeeks: 5, trainingDays: ["sun", "tue", "thu"], intakeComplete: true, displayName: "A" },
  };
}
function deloadWeekOfBlock(n) {
  const r = Brief.blockRequestFor({ program: programAfter(n), blockIndex: n });
  assert.ok(r.ok, "request for block " + n + ": " + (r.why || ""));
  return r.body.athleteProfile.deloadWeekIndex || 0;
}
ok("block 1 has no deload in it", deloadWeekOfBlock(1) === 0);
ok("block 2 OPENS on the deload", deloadWeekOfBlock(2) === 1);
ok("block 3 carries it on week 2", deloadWeekOfBlock(3) === 2);
ok("block 4 on week 3 — the count never restarts", deloadWeekOfBlock(4) === 3);

/* ── 4. what the coach is told, in words ─────────────────────────────────────── */

const noDeload = String(Contract.buildFixedIntakePrompt({ trainingDays: ["sun", "tue"] }));
ok("no deload asked for is said plainly", /no deload week falls inside this block/i.test(noDeload));
ok("and the fifth week is forbidden by name", /do NOT add a fifth week/i.test(noDeload));

const withDeload = String(Contract.buildFixedIntakePrompt({ trainingDays: ["sun", "tue"], deloadEveryWeeks: 5, blockStartWeek: 5 }));
ok("the deload week is NAMED, not left to the coach", /week 1 of this 4-week block is the deload/i.test(withDeload));

const recoveryNamed = String(Contract.buildFixedIntakePrompt({ activeRecoveryPref: "yes", activeRecoveryDay: "sat" }));
ok("an active recovery day lands on the day they named", /ACTIVE RECOVERY DAY on Sat/.test(recoveryNamed));
ok("and is told apart from a deload in the same breath", /NOT a deload: a deload is a whole week/.test(recoveryNamed));

const recoveryUnnamed = String(Contract.buildFixedIntakePrompt({ activeRecoveryPref: "yes" }));
ok("asked for with no weekday, the coach may not pick one", /NO WEEKDAY WAS NAMED/.test(recoveryUnnamed));
ok("Thursday is never filled in silently", !/on Thu\b/.test(recoveryUnnamed));

/* ── 5. the questionnaire asks it the right way round ────────────────────────── */

ok("the deload is a tick, off unless asked for", /id="adm-fx-deload-on"/.test(INTAKE_JS));
ok("the cadence question opens only under it", /admFxDeloadWrap/.test(INTAKE_JS) && /adminFixedDeloadToggled/.test(INTAKE_JS));
ok("nothing falls back to a deload every four weeks", !/: 4;[\s\S]{0,40}deloadEveryWeeks|deloadEveryWeeks:\s*4,/.test(INTAKE_JS));
ok("the five-week preset text is gone from the screen", !/5-week brick/.test(INTAKE_JS));
ok("and the recovery day is no longer called a daily deload", !/active recovery \/ daily deload/.test(INTAKE_JS));

/* ── 6. and nothing gets a deload it did not ask for ─────────────────────────── */

const blank = Store.emptyProgram({ clientName: "A" });
ok("a programme opens as a month of four weeks", blank.weeks.length === 4);
ok("with no deload anywhere in it", blank.weeks.every((w) => w.phase !== "deload"));

console.log("\nדוקטרינת הדילואד אחידה בכל המקומות.");
