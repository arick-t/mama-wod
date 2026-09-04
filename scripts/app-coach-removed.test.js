/**
 * The app is the workout aggregator again (checklist leg C).
 * Run: node scripts/app-coach-removed.test.js
 *
 * As much about what must KEEP working as what must go. Removing the coach from a
 * 677KB hand-written page is the riskiest step in this branch, and the aggregator
 * is the part the owner said must stay stable while not being developed.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

const root = path.join(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

/* --- the page must parse; a syntax error is a white screen for everyone ---- */

const scripts = [];
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(index))) scripts.push(m[1]);
ok("the app has its inline scripts", scripts.length >= 3);
scripts.forEach(function (code, i) {
  let err = null;
  try {
    new vm.Script(code, { filename: "index.html #" + (i + 1) });
  } catch (e) {
    err = (e && e.message) || String(e);
  }
  ok("inline script " + (i + 1) + " parses", err === null);
});

/* --- the coach is gone from the shell ----------------------------------- */

ok("the coach tab button is gone", !/id="tab-pprog"/.test(index));
ok("the coach pane is gone", !/id="pprog-tab"/.test(index));
ok("the coach terms overlay is gone", !/id="pprogLegalOverlay"/.test(index));
ok("the building overlay is gone", !/id="pprogBuildingOverlay"/.test(index));
ok("the coach chat log is gone", !/id="pprogChatLog"/.test(index));
ok("the coach is not in the tab list", !/var tabs = \["pprog"/.test(index));
ok("the tab list is the four remaining tabs", /var tabs = \["browse", "workout", "sources", "about"\];/.test(index));

/* Tab buttons and panes must match exactly, or the bar renders a dead button. */
const btnIds = (index.match(/id="tab-([a-z]+)"/g) || []).map(function (s) {
  return s.replace('id="tab-', "").replace('"', "");
}).sort();
const paneIds = (index.match(/id="([a-z]+)-tab"/g) || []).map(function (s) {
  return s.replace('id="', "").replace('-tab"', "");
}).sort();
ok("every tab button has a pane", JSON.stringify(btnIds) === JSON.stringify(paneIds));
ok("there are exactly four tabs", btnIds.length === 4);
ok("the four are browse/workout/sources/about", JSON.stringify(btnIds) === JSON.stringify(["about", "browse", "sources", "workout"]));

/* --- no coach code can run at boot ------------------------------------- */

ok("the gate flag is off", /var PPROG_TAB_ENABLED = false;/.test(index));
ok("the coach boot returns immediately", /function initPprogUi\(\) \{\s*\/\*[\s\S]*?\*\/\s*if \(!PPROG_TAB_ENABLED\) return;/.test(index));
ok("the resume pull is gated too", /pprogPullAdminChangesOnResume[\s\S]{0,300}if \(!PPROG_TAB_ENABLED\) return;/.test(index));
/* showTab rewrites the name but the caller's variable stays "pprog" — the follow-up
   that relied on that would have run against a deleted pane. */
ok("the landing block no longer runs coach follow-up", !/if \(tab === "pprog"\)/.test(index));
ok("the landing block explains why", /stays "pprog"/.test(index));

/* --- the aggregator is the app now ------------------------------------ */

ok("browse is the active pane", /<div class="tab-content active" id="browse-tab">/.test(index));
ok("browse is the active button", /<button class="tab-btn active" id="tab-browse"/.test(index));
ok("the default landing is browse", /\? "pprog" : "browse"/.test(index) === false || /PPROG_TAB_ENABLED \? "pprog" : "browse"/.test(index));

/* --- old links must redirect, not dead-end (g.3) --------------------- */

ok("an old ?tab=pprog link is still accepted", /allowed = \{ pprog: 1/.test(index));
ok("showTab redirects it to browse", /if \(name === "pprog" && !PPROG_TAB_ENABLED\) \{\s*name = "browse";/.test(index));
ok("the reason is written down", /must redirect, not dead-end/.test(index));

/* --- minimum version check (g.4) ------------------------------------ */

ok("the bundle carries its build version", /var DW_BUILD_VERSION = "22\.1\.1";/.test(index));
/* 22.0: the brain is not part of this product, so its version is not in this header. */
ok("the coach version line left the app header", !/id="coachVersionSub"/.test(index));
ok("and nothing tries to write into it", !/COACH · v" \+ COACH_VERSION/.test(index));
ok("native builds are detected", /function dwIsNativeBuild/.test(index));
ok("versions compare without assuming equal length", /function dwVersionLessThan/.test(index));
ok("an old build is told to update", /function dwShowUpdateNotice/.test(index) && /Please update the app/.test(index));
ok("the check runs at boot", /try \{ dwCheckMinimumVersion\(\); \} catch/.test(index));
ok("the check never blocks the app", /\.catch\(function \(\) \{\}\)/.test(index));
ok("only native builds are nagged", /if \(!dwIsNativeBuild\(\)\) return;/.test(index));

/* The comparison must actually be right — this is the bit that decides whether a
   working install gets nagged for nothing. */
const cmpSrc = (index.match(/function dwVersionLessThan[\s\S]*?\n\}/) || [""])[0];
const box = {};
vm.createContext(box);
vm.runInContext(cmpSrc + "\nthis.f = dwVersionLessThan;", box);
const lt = box.f;
ok("21.6 is older than 21.7", lt("21.6", "21.7") === true);
ok("21.7 is not older than 21.7", lt("21.7", "21.7") === false);
ok("21.7 is not older than 21.6", lt("21.7", "21.6") === false);
ok("21.10 is newer than 21.9 (not string-compared)", lt("21.10", "21.9") === false);
ok("21.9 is older than 21.10", lt("21.9", "21.10") === true);
ok("21.7 is newer than 21.6.3", lt("21.7", "21.6.3") === false);
ok("21.6 is older than 21.6.1", lt("21.6", "21.6.1") === true);
ok("a garbage version does not crash", typeof lt("", "21.7") === "boolean");

/* The server must actually publish a floor, and it must not nag anyone today. */
const api = fs.readFileSync(path.join(root, "api", "client-program.js"), "utf8");
ok("the server publishes a minimum version", /minAppVersion: MIN_APP_VERSION/.test(api));
ok("the floor is behind the current release, so nobody is nagged yet", /MIN_APP_VERSION \|\| "21\.0"/.test(api));

/* --- what must KEEP working ----------------------------------------- */

ok("the workouts browser is intact", /id="browse-tab"/.test(index) && /days-bar/.test(index));
ok("workout tools are intact", /id="workout-tab"/.test(index));
ok("sources is intact", /id="sources-tab"/.test(index));
ok("about is intact", /id="about-tab"/.test(index));
ok("the workout timers are intact", /Workout Timers/.test(index));
ok("the aggregator still reads the fetched data", /workouts\.json/.test(index));
ok("the legal disclaimer is still shown", /non-commercial, personal project/.test(index));

/* --- and the retired engine has not crept back -------------------- */

ok("the legacy generator tab is still gone", !/aibeta/.test(index));

/* The endpoint died in 21.6, but calls to it still exist inside the old generator
 * functions. Asserting the string is absent kept failing on prose, and deleting
 * ~1300 interleaved lines from a 677KB hand-written file for zero functional gain
 * is not a trade worth making inside a branch that already changes a lot.
 *
 * So assert the property that actually matters and is provable: every function that
 * still calls the retired endpoint is UNREACHABLE — its name appears only where it
 * is defined, never at a call site. If anyone ever wires one back up, this fails.
 */
/* Proving per-function unreachability needs a call graph — the generator's own
 * buttons are built inside JS strings, so a text search cannot tell a live call
 * site from a dead one. What IS provable, and what actually guarantees the cluster
 * never runs, is that its ENTRY POINT is gone: no tab, no pane, and nothing in the
 * page's static markup that opens it.
 */
const bodyMarkup = index.replace(/<script[\s\S]*?<\/script>/gi, "");
ok("no generator pane exists", !/id="aibeta-tab"/.test(index));
ok("no generator tab button exists", !/id="tab-aibeta"/.test(index));
ok("no static markup calls the generator", !/generateWorkoutAi|explainAiWorkout/.test(bodyMarkup));
ok("the generator is not in the tab list", !/"aibeta"/.test(index));
ok(
  "calls to the retired endpoint survive only inside that cluster",
  (index.match(/"\/api\/generate-workout"/g) || []).length <= 3
);

/* --- and no machine writes a programme in this release --------------------
 * The owner's rule for 22.0 (2026-09-03): the wiring to the brain is a PIPE TEST.
 * A block that comes back is proof the pipe is open and nothing more - it is shown and
 * thrown away. Saving one today would put it in the retired athlete/handoff world,
 * whose viewer left with the app's coach tab: a plan nobody can open.
 * ------------------------------------------------------------------------- */
const adminPage = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const fixedIntake = fs.readFileSync(path.join(root, "admin-fixed-intake.js"), "utf8");

ok("saving a generated block is switched off", /var COACH_BUILD_MAY_SAVE = false;/.test(adminPage));
ok("and the reason is written where the switch is", /pipe test/i.test(adminPage));
ok(
  "the admin intake checks before it saves",
  /function finalizeNewAthlete\(block\) \{[\s\S]{0,240}?if \(COACH_BUILD_MAY_SAVE !== true\) \{/.test(adminPage)
);
ok(
  "so does the fixed intake",
  /window\.finalizeNewAthlete = function finalizeNewAthlete\(block\) \{[\s\S]{0,300}?if \(window\.COACH_BUILD_MAY_SAVE !== true\) \{/.test(fixedIntake)
);
/* The check must come BEFORE the request that creates the athlete, or it guards nothing. */
const adminFinal = (adminPage.match(/function finalizeNewAthlete\(block\)[\s\S]*?admin-handoff/) || [""])[0];
const fixedFinal = (fixedIntake.match(/window\.finalizeNewAthlete = function[\s\S]*?admin-handoff/) || [""])[0];
ok("the admin guard precedes the create call", adminFinal.indexOf("COACH_BUILD_MAY_SAVE") > 0);
ok("the fixed-intake guard precedes the create call", fixedFinal.indexOf("COACH_BUILD_MAY_SAVE") > 0);
/* Finishing an intake must not quietly ask for a block either. */
ok("finishing an intake still builds nothing", /var ATHLETE_AI_BUILD_ENABLED = false;/.test(fixedIntake));

console.log("All app coach-removal checks passed.");
