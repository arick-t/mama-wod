/**
 * The gym questionnaire's SCREEN — the design spec, held to.
 *
 * The unified design spec (admin 5.9) fixed one canonical shape for an intake card, and this
 * asserts the gym card obeys it. It also asserts the one thing that is easy to get wrong and
 * expensive to discover: the card must live inside #clientScreen, because .fld, .chk-row,
 * .pick-row, .sub-branch, .inline-num and .grid2 are all scoped there. A card built outside it
 * looks unstyled and nobody can tell why.
 *
 * Run: node scripts/gym-intake-screen.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const js = fs.readFileSync(path.join(root, "admin-gym-intake.js"), "utf8");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

/* ── it floats, and it brings its own styles ───────────────────────────────── */

const cardAt = admin.indexOf('id="gymIntakeModal"');
ok("the gym questionnaire exists", cardAt > 0);
ok("it is a floating card like every other questionnaire", /class="modal-backdrop" id="gymIntakeModal"/.test(admin));
ok("not a panel wedged into the client screen", admin.indexOf('id="gymIntakeCard"') < 0);

/* The rules it needs are scoped to #clientScreen, so a floating card must carry its own copy.
   Widening the originals is not an option: they serve the studio card. */
["label.fld", ".chk-row", ".sub-branch", ".pick-row", ".grid2", ".itabs"].forEach(function (sel) {
  ok("the modal carries its own " + sel, admin.indexOf("#gymIntakeModal " + sel) >= 0);
});
ok("and the originals were left alone", /#clientScreen \.chk-row\{/.test(admin) && /#clientScreen \.sub-branch\{/.test(admin));

/* ── the canonical card shape ──────────────────────────────────────────────── */

/* Bound the slice to THIS card. Reading past it into the next one is how a test starts
   asserting about somebody else's markup. */
const card = admin.slice(cardAt, admin.indexOf('id="intake-modal"'));
ok("the card is left-to-right, like every intake card", /dir="ltr"/.test(card));
ok("its header bar is the shared one", /class="intake-ws-header" dir="rtl"/.test(card));
ok("the title is English", /<h2>New gym client<\/h2>/.test(card));
ok("only the way out is Hebrew, and it is there", /btn-secondary[^>]*>סגור/.test(card));
ok("the step counter sits in the header and nowhere else", /id="gymIntakeStep"/.test(card));
ok("there is a tab strip", /class="itabs" id="gymIntakeTabs" role="tablist"/.test(card));
ok("Back comes before Next", card.indexOf('id="gxPrev"') < card.indexOf('id="gxNext"'));
ok("the last step swaps Next for the real action", /id="gxCreate"[^>]*hidden>Build the block/.test(card));
ok("Back is hidden on the first step", /id="gxPrev"[^>]*hidden/.test(card));
ok("the error row is always in the DOM", /id="gymIntakeErr"/.test(card) && /min-height/.test(card));

/* ── what the spec forbids ─────────────────────────────────────────────────── */

ok("no step number inside the panel", !/Step \d+ \/ \d+/.test(card));
ok("no !important on a colour here", !/!important/.test(card.replace(/min-height:[^;"]*/g, "")));
/* The slice starts at the id, so the card's own class= sits just before it. Anything
   matching inside the slice would therefore be a card WITHIN the card. */
ok("the panel carries no card of its own", (card.match(/class="card"/g) || []).length === 0);
/* The comment that FORBIDS style.display is allowed to name it; the code is not. */
const jsCode = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
ok("nothing is opened with style.display", jsCode.indexOf("style.display") < 0);
ok("panels open and close with the hidden attribute", /\.hidden = /.test(js));
ok("and the modal itself with the shared .open class", /classList\.add\("open"\)/.test(js));
ok("and there is no chat-style intake here", !/chat/i.test(jsCode));

/* ── the three rules of a tick that opens a question ───────────────────────── */

ok("a sub-branch is a sibling, not a child", /class="sub-branch"/.test(js) && !/chk-row[^"]*"[^>]*>[^<]*<div class="sub-branch"/.test(js));
ok("closing the equipment branch erases what was ticked", /state\.equipment = \{\}/.test(js));
ok("closing the extras branch erases them too", /state\.extras = \{\}/.test(js));
ok("closing the deload branch erases the cadence", /state\.deloadEveryWeeks = ""/.test(js));
ok("and changing the sessions erases a split that no longer exists", /still\.indexOf\(state\.split\) < 0\) state\.split = ""/.test(js));

/* ── the wall, at the screen layer too ─────────────────────────────────────── */

ok("the screen reads the gym contract", /window\.GymIntake/.test(js));
ok("it never touches the functional intake state", jsCode.indexOf("intakeState") < 0);
ok("nor builds a functional packet", jsCode.indexOf("fixedIntakePacket") < 0);
ok("nor calls the functional profile builder", jsCode.indexOf("athleteProfileForGenerateBlock") < 0);
/* The SCRIPT TAGS, not the first mention of the filename — a comment naming the screen
   sits far above them and would make this compare the wrong two positions. */
ok("the page loads the gym contract before the screen",
  admin.indexOf('<script src="lib/gym-intake.js">') <
    admin.indexOf('<script src="admin-gym-intake.js">'));

/* ── it uses the classes the spec fixed, and not invented ones ─────────────── */

["fld", "chk-row", "pick-row", "sub-branch", "inline-num", "grid2", "pprog-fixed-title", "pprog-fixed-note", "pprog-skills-all"].forEach(
  function (c) {
    ok("the screen uses ." + c, js.indexOf(c) >= 0);
  }
);

/* --- three defects the browser found that no source read would have ------------ */

/* The card stops a click from climbing out of it, like every modal here. A listener on the
   document - or even on the backdrop - therefore never hears a button inside it. */
ok("the listeners are bound to the card, not the document", js.indexOf('querySelector(".intake-workspace")') >= 0);
ok("and not to the document", jsCode.indexOf('document.addEventListener("click"') < 0);

/* The nav buttons get the brand look. Scoping that to "every button in the body" swallowed the
   tab strip and outranked the ghost rule, so all five tabs and Back came out orange. */
ok("the brand button rule is scoped to the nav row", admin.indexOf("#gymIntakeModal .intake-ws-body > .row button{") >= 0);
ok("and Back keeps its ghost look at the same specificity", admin.indexOf("#gymIntakeModal .intake-ws-body > .row button.ghost{") >= 0);
ok("the tabs keep their own look", admin.indexOf("#gymIntakeModal .itabs button.on{") >= 0);

/* -- 23.1: one face for four questionnaires -----------------------------------
   The release that shipped on 2026-09-30 made the studio card the reference face for every
   questionnaire in this module, and the gym one is the fourth. The point of these checks is
   that the look is SHARED rather than copied: one declaration naming both ids, so a change to
   the studio face reaches the gym face without anyone remembering to carry it across. */

ok(
  "the boxed answer is one rule serving the studio card and the gym one",
  /#intakeCard \.chk-row,#gymIntakeModal \.chk-row\{padding:10px 12px/.test(admin)
);
ok("and so is the dark field", /#gymIntakeModal \.gym-pane input\[type="number"\]\{/.test(admin));
ok("and so is the step bar", /#clientScreen #intakeCard \.itabs,#gymIntakeModal \.itabs\{/.test(admin));

/* THE GYM PANE IS NOT AN .ipane. The studio card's tab switcher hides every .ipane it can
   find, so a gym pane wearing that class drew itself and then vanished — no error, nothing in
   the console. Both ends of that are held here: the gym uses its own class, and the switcher
   is scoped to the card whose panes they are. */
ok("the gym pane has a class of its own", /class="gym-pane" data-pane=/.test(jsCode));
ok("and is not one of the studio's panes", jsCode.indexOf('<div class="ipane" data-pane=') < 0);
ok("the studio switcher reaches only its own card", /querySelectorAll\("#intakeCard \.ipane"\)/.test(admin));
ok("including the one it then shows", /querySelector\('#intakeCard \.ipane\[data-pane=/.test(admin));

/* A step you have reached is clickable; one you have not is drawn and dead. */
ok("the strip remembers how far he has got", /var reached = 0;/.test(jsCode));
ok("a step beyond it is dead", jsCode.indexOf('(i > reached ? " disabled" : "")') >= 0);
ok("a step behind it is ticked", jsCode.indexOf('i < reached ? "done"') >= 0);
ok("and a dead step is drawn as dead", /#gymIntakeModal \.itabs button\[disabled\]/.test(admin));
ok("a new client starts at the first step again", /function reset\(\) \{\s*\n\s*reached = 0;/.test(jsCode));

/* -- the finished month goes to the client's TAB, not a box -------------------
   It used to open in a read-only preview with the client-tab furniture drawn around it. The
   owner's answer on seeing one (2026-10-03): "זה אמור להיות בלשונית הלקוח - לא ככה אנחנו
   עושים את זה" — and a read-only month is also a month whose days nobody can open, which is
   why the exercises were not clickable. The preview is gone. Every other kind of client ends
   its questionnaire the same way, and so does this one now. */

ok("there is no preview box left in the page", admin.indexOf("gymBlockModal") < 0);
ok("and nothing in the screen still opens one", jsCode.indexOf("showGymBlock") < 0);
ok("the finished month creates the client", /ClientScreen\.createGym\(/.test(jsCode));
ok("and the client's own tab is what opens", /function openGymCreated\(/.test(admin));
ok("what the check found travels with it", /blocking: x\.j\.blocking/.test(jsCode) && /flags: x\.j\.flags/.test(jsCode));
ok("and is drawn over the programme it is about", /html \+= gymFindingsHtml\(\);/.test(admin));
ok("a report can be dismissed", /data-gym-findings-close/.test(admin));
ok("and does not follow him to the next client", /S\.gymFindings = null;/.test(admin));

/* -- the duck, while the brain writes ----------------------------------------
   The card showed a button reading "Building…" and then forty seconds of a form sitting still. */

ok("the gym card has the same overlay the other questionnaire uses", /id="gymBuildOverlay" class="admin-intake-build-overlay"/.test(admin));
ok("with the same thinking video", /id="gymBuildVideo"[\s\S]{0,400}assets\/coach-thinking\.mp4/.test(admin));
ok("and a still duck when it will not play", /id="gymBuildFallback"/.test(admin));
ok("it goes up before the call and down after it", /buildOverlay\(true\);/.test(jsCode) && /buildOverlay\(false\);/.test(jsCode));

/* -- and the card has to fit a window ----------------------------------------
   Without a ceiling it grew past the bottom of the screen with no scrollbar and no way down:
   the owner had to zoom the whole browser out to reach the Next button (2026-10-03). */

ok("the card is capped to the window", /#gymIntakeModal > \.intake-workspace\{max-height:92vh\}/.test(admin));
/* And the BODY is what scrolls. Capping the card alone clipped the Next button instead of
   letting anyone reach it, because .intake-ws-body is overflow:hidden by design. */
ok("and its body is what scrolls", /#gymIntakeModal \.intake-ws-body\{overflow-y:auto\}/.test(admin));

console.log("\nמסך תחקור חדר הכושר — לפי המפרט, ובתוך הסקופ הנכון.");
