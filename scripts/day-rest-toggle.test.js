/**
 * Rest day ⇄ session, both directions.
 * Run: node scripts/day-rest-toggle.test.js
 *
 * The trap this file exists to catch: isPprogRestDay() decides REST from the WEEK
 * OVERVIEW FOCUS before it looks at the day's parts. So a "fix" that only writes
 * parts produces a day holding a real workout that still renders as a rest day — an
 * edit that appears to save and appears to do nothing.
 *
 * Every assertion below is therefore checked against the REAL renderer's own
 * rest test, not just against the data we wrote.
 */
const assert = require("assert");
const T = require("../lib/day-rest-toggle.js");
const Normalize = require("../lib/normalize-pprog-block.js");
const Display = require("../lib/pprog-display.js");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

/* The authority both the app and admin render against. */
const rendererSaysRest = Normalize.isRestDay;
ok("the renderer's rest test is available to compare against", typeof rendererSaysRest === "function");

function weekWith(overviewFocus, parts) {
  return {
    weekIndex: 1,
    overview: T.DAY_KEYS.map(function (k) {
      return { day: k, focus: k === "wed" ? overviewFocus : "Training" };
    }),
    days: T.DAY_KEYS.reduce(function (acc, k) {
      acc[k] = { parts: k === "wed" ? parts : [{ id: k + "-0", title: "Part A", lines: ["Squat 5x5"] }] };
      return acc;
    }, {}),
  };
}

/* --- the trap itself ---------------------------------------------------- */

/* Parts written into a day whose overview still says Rest: the renderer calls it a
   rest day regardless. This is what a parts-only fix would have produced. */
const trap = weekWith("Rest", [{ id: "wed-0", title: "Part A", lines: ["Back squat 5x5"] }]);
ok(
  "a real session under a Rest overview STILL renders as rest — the trap is real",
  rendererSaysRest("wed", trap.days.wed, trap) === true
);

/* --- rest → session ---------------------------------------------------- */

const w1 = weekWith("Rest", T.restPartsFor("wed"));
ok("starts as a rest day", rendererSaysRest("wed", w1.days.wed, w1) === true);
ok("our own reader agrees", T.dayIsRest(w1, "wed") === true);

T.makeSession(w1, "wed", [{ id: "wed-0", title: "Engine", lines: ["Row 2k", "Rest 3:00", "Row 2k"] }]);
ok("the parts are the new session", w1.days.wed.parts[0].lines[0] === "Row 2k");
ok("the overview no longer says Rest", T.overviewFocus(w1, "wed") !== "Rest");
ok("the overview took the part's own title", T.overviewFocus(w1, "wed") === "Engine");
/* The assertion that matters — the RENDERER must now agree it is a session. */
ok(
  "the renderer now shows a session, not a rest day",
  rendererSaysRest("wed", w1.days.wed, w1) === false
);
ok("our reader agrees too", T.dayIsRest(w1, "wed") === false);

/* --- session → rest ---------------------------------------------------- */

const w2 = weekWith("Squat", [{ id: "wed-0", title: "Part A", lines: ["Back squat 5x5"] }]);
ok("starts as a session", rendererSaysRest("wed", w2.days.wed, w2) === false);

T.makeRest(w2, "wed");
ok("the workout is gone", w2.days.wed.parts.length === 1 && w2.days.wed.parts[0].title === "REST DAY");
ok("the overview says Rest", T.overviewFocus(w2, "wed") === "Rest");
ok(
  "the renderer now shows a rest day",
  rendererSaysRest("wed", w2.days.wed, w2) === true
);

/* --- and back again, twice, without drift ----------------------------- */

let w3 = weekWith("Rest", T.restPartsFor("wed"));
for (let i = 0; i < 3; i++) {
  T.makeSession(w3, "wed", [{ id: "wed-0", title: "Round " + i, lines: ["AMRAP 12"] }]);
  ok("cycle " + i + ": renders as a session", rendererSaysRest("wed", w3.days.wed, w3) === false);
  T.makeRest(w3, "wed");
  ok("cycle " + i + ": renders as rest again", rendererSaysRest("wed", w3.days.wed, w3) === true);
}
ok("no leftover parts after cycling", w3.days.wed.parts.length === 1);

/* --- a session must never be left labelled Rest ---------------------- */

const w4 = weekWith("Rest", T.restPartsFor("wed"));
T.makeSession(w4, "wed", [{ id: "wed-0", title: "Rest", lines: ["Row 2k"] }], "Rest");
ok(
  "an explicit Rest focus is refused for a session",
  T.overviewFocus(w4, "wed") === T.DEFAULT_TRAINING_FOCUS
);
ok("and the renderer sees a session", rendererSaysRest("wed", w4.days.wed, w4) === false);

const w5 = weekWith("Rest", T.restPartsFor("wed"));
T.makeSession(w5, "wed", [{ id: "wed-0", title: "", lines: ["Row 2k"] }]);
ok("a part with no title still gets a usable focus", T.overviewFocus(w5, "wed") === "Training");
ok("and it renders as a session", rendererSaysRest("wed", w5.days.wed, w5) === false);

/* --- one entry point for both directions ---------------------------- */

const w6 = weekWith("Squat", [{ id: "wed-0", title: "Part A", lines: ["Squat"] }]);
T.setDayRest(w6, "wed", true);
ok("setDayRest(true) makes rest", rendererSaysRest("wed", w6.days.wed, w6) === true);
T.setDayRest(w6, "wed", false, [{ id: "wed-0", title: "Engine", lines: ["Bike 10k"] }]);
ok("setDayRest(false) makes a session", rendererSaysRest("wed", w6.days.wed, w6) === false);

/* --- it survives a missing overview -------------------------------- */

const bare = { weekIndex: 1, days: { wed: { parts: [] } } };
T.makeSession(bare, "wed", [{ id: "wed-0", title: "Engine", lines: ["Row"] }]);
ok("an overview is created when absent", Array.isArray(bare.overview) && bare.overview.length === 7);
ok("all seven days are present", bare.overview.length === T.DAY_KEYS.length);
ok("the edited day has its focus", T.overviewFocus(bare, "wed") === "Engine");

const bare2 = { weekIndex: 1 };
T.makeRest(bare2, "wed");
ok("a week with no days object is handled", !!bare2.days && !!bare2.days.wed);
ok("and it reads as rest", rendererSaysRest("wed", bare2.days.wed, bare2) === true);

/* --- rubbish input does not throw --------------------------------- */

ok("a non-week is returned untouched", T.makeRest(null, "wed") === null);
ok("an unknown day is ignored", T.makeRest({ days: {} }, "xyz").days.xyz === undefined);
ok("partsAreRest treats empty as rest", T.partsAreRest([]) === true);
ok("partsAreRest treats a real session as not rest", T.partsAreRest([{ title: "A", lines: ["Squat 5x5"] }]) === false);
ok("partsAreRest sees a REST DAY marker", T.partsAreRest(T.restPartsFor("wed")) === true);

/* --- the editor must offer the toggle on BOTH kinds of day ------- */

const displaySrc = require("fs").readFileSync(
  require("path").join(__dirname, "..", "lib", "pprog-display.js"),
  "utf8"
);
/* The old gate blocked the pencil on precisely the day people most want to change. */
ok("a rest day is no longer barred from editing", !/allowEdit &&\s*\n\s*!restDay &&/.test(displaySrc));
ok("the reason is recorded next to it", /A rest day is a PLAN, not[\s\S]{0,14}a fact/.test(displaySrc));
/* The locks that remain are about a day that already happened, not a plan. */
ok("a logged extra session still blocks editing", /!loggedExtra &&/.test(displaySrc));
ok("a filed finish report still blocks editing", /!finishLocked &&/.test(displaySrc));
ok("a written debrief still blocks editing", /!hasDebrief &&/.test(displaySrc));
ok("a past day still blocks editing", /!pastDay/.test(displaySrc));

const editSrc = require("fs").readFileSync(
  require("path").join(__dirname, "..", "lib", "admin-day-edit.js"),
  "utf8"
);
ok("saving a rest day is no longer locked", !/if \(isRestDay\(dayKey, dayData, week\)\) \{\s*\n\s*return \{ code: "rest"/.test(editSrc));
ok("the reason is recorded there too", /A rest day is a PLAN, not[\s\S]{0,14}a fact/.test(editSrc));

/* --- no provider, ever ----------------------------------------- */

const src = require("fs").readFileSync(
  require("path").join(__dirname, "..", "lib", "day-rest-toggle.js"),
  "utf8"
);
ok("the toggle makes no network calls", !/\bfetch\s*\(/.test(src));
ok("the toggle names no AI provider", !/gemini|groq/i.test(src));
ok("the module is UMD for the browser too", /root\.DayRestToggle = factory\(\)/.test(src));

/* Sanity: the display library still loads after the change. */
ok("the display library still loads", typeof Display.renderDayPartsHtml === "function");

console.log("All rest-day toggle checks passed.");
