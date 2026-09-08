/**
 * What the brain noticed, and what it could not finish.
 * Run: node scripts/coach-brick-flags.test.js
 *
 * The brain returns two optional fields with a block, and it was explicit about how
 * they must READ (coach agent, 2026-09-08):
 *
 *   brickFlags — notes to the owner about a block that is valid and SAVED. Not an
 *   error, not red, and no fix button: dosage is the planning, and he approved the
 *   mechanism on exactly that condition.
 *
 *   truncated — the answer was CUT, not refused. There a "try again" is the right
 *   button, because trying again is the fix.
 *
 * Those two sentences are what this file guards. A flag that grows a button, or a cut
 * that loses one, is the failure to catch here.
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

const F = require("../lib/coach-brick-flags.js");
const root = path.join(__dirname, "..");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const fixed = fs.readFileSync(path.join(root, "admin-fixed-intake.js"), "utf8");
const css = fs.readFileSync(path.join(root, "admin.html"), "utf8");

/* The examples they sent from their own runs. */
const REAL = [
  "Three or more working parts on 4 session(s): W1 tue, W1 wed, W1 thu, W1 sat.",
  "Percentage loads written for an athlete who reported no 1RM.",
  "Imperial units in the workout text.",
  "Scaled movement(s) written as the prescription: ring row, single-under. The standard belongs on the line.",
  "Brick has 5 weeks; a brick is four.",
];

/* --- nothing to say, nothing shown -------------------------------------- */

ok("a clean block shows nothing at all", F.flagsBoxHtml({}) === "");
ok("and neither does nothing at all", F.flagsBoxHtml() === "");
ok("an empty list is nothing to say", F.flagsBoxHtml({ brickFlags: [] }) === "");
ok("nor is a list of blanks", F.flagsBoxHtml({ brickFlags: ["", "   "] }) === "");

/* --- the flags ------------------------------------------------------------ */

const box = F.flagsBoxHtml({ brickFlags: REAL });
ok("every flag is shown", REAL.every(function (f) { return box.indexOf(F.esc(f)) >= 0; }));
ok("with the count beside the heading", /class="brick-flags-count">5</.test(box));
/* THE rule: a note, not a failure. */
ok("it is called what it is", box.indexOf("לתשומת לב") >= 0);
ok("never an error", box.indexOf("שגיאה") < 0 && box.indexOf("נכשל") < 0);
ok("it says the block is fine and saved", box.indexOf("הלבנה תקינה ונשמרה") >= 0);
ok("and that it is his call", box.indexOf("אתה מחליט אם לגעת") >= 0);
/* And no button, by design — this is the condition he approved the mechanism on. */
ok("a flag carries no button", box.indexOf("<button") < 0);
ok("not even when one is offered", F.flagsBoxHtml({ brickFlags: REAL }, { retryFn: "x" }).indexOf("<button") < 0);

ok("six is the ceiling they promised", F.MAX_FLAGS === 6);
const seven = F.cleanFlags(["a", "b", "c", "d", "e", "f", "g"]);
ok("a seventh is not shown", seven.length === 6);
ok("a flag is trimmed rather than allowed to run away", F.cleanFlags(["x".repeat(500)])[0].length === F.MAX_FLAG_CHARS);
ok("and nothing in a flag can carry markup", F.flagsBoxHtml({ brickFlags: ['<img src=x onerror="boom">'] }).indexOf("<img") < 0);

/* --- the cut -------------------------------------------------------------- */

const cutOnly = F.flagsBoxHtml({ truncated: true, truncatedMarker: "BLOCK_JSON" }, { retryFn: "retryIt" });
ok("a cut answer says so", cutOnly.indexOf("התשובה נקטעה") >= 0);
ok("and names the marker that never closed", cutOnly.indexOf("BLOCK_JSON") >= 0);
ok("it says a cut is not a refusal", cutOnly.indexOf("זו קטיעה ולא סירוב") >= 0);
/* THE other rule: here a button IS the fix. */
ok("and it does get a try-again", /onclick="retryIt\(\)"/.test(cutOnly) && cutOnly.indexOf("נסה שוב") >= 0);
ok("only their own true counts as cut", F.isTruncated({ truncated: "yes" }) === false && F.isTruncated({ truncated: true }) === true);
ok("a cut with no handler offered shows no dead button", F.flagsBoxHtml({ truncated: true }).indexOf("<button") < 0);

const both = F.flagsBoxHtml({ brickFlags: ["Imperial units in the workout text."], truncated: true }, { retryFn: "r" });
ok("flags and a cut can arrive together", both.indexOf("לתשומת לב") >= 0 && both.indexOf("התשובה נקטעה") >= 0);
ok("and the one button belongs to the cut", (both.match(/<button/g) || []).length === 1);

/* --- on the page ---------------------------------------------------------- */

ok("the page loads the formatter", admin.indexOf('<script src="lib/coach-brick-flags.js"></script>') >= 0);
ok("there is a place for it under the status line", admin.indexOf('<div id="intake-flags"></div>') >= 0);
ok("both senders report what came back", admin.indexOf("showBrickFlags(j);") >= 0 && fixed.indexOf("showBrickFlags(j)") >= 0);
ok("the try-again asks for the same block again", admin.indexOf("function retryIntakeBlockAfterCut()") >= 0);
/* Amber, never red — his own instruction about how this must read. */
ok("the flags are amber", /\.brick-flags-head\{[^}]*color:#F0A44E/.test(css));
ok("and nothing about them is red", /\.brick-flags[\s\S]{0,600}#F2867A/.test(css) === false);

console.log("\nAll brick-flag checks passed (" + passed + " assertions).");
