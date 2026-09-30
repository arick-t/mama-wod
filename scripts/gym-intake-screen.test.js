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

/* ── the trap: scoped CSS ──────────────────────────────────────────────────── */

const screenStart = admin.indexOf('id="clientScreen"');
const cardAt = admin.indexOf('id="gymIntakeCard"');
const studioAt = admin.indexOf('id="intakeCard"');
ok("the gym card exists", cardAt > 0);
ok("it sits inside #clientScreen, where the classes live", cardAt > screenStart);
ok("beside the studio card it was modelled on", studioAt > screenStart);
ok("and the classes really are scoped there", /#clientScreen \.chk-row/.test(admin) && /#clientScreen \.sub-branch/.test(admin));

/* ── the canonical card shape ──────────────────────────────────────────────── */

/* Bound the slice to THIS card. Reading past it into the next one is how a test starts
   asserting about somebody else's markup. */
const nextCard = admin.indexOf('<div class="card"', cardAt + 10);
const card = admin.slice(cardAt, nextCard > 0 ? nextCard : cardAt + 2200);
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

console.log("\nמסך תחקור חדר הכושר — לפי המפרט, ובתוך הסקופ הנכון.");
