/**
 * Picking several days, run for real.
 *
 * The owner reported three times that ctrl-picking sessions "only works in descending
 * order". Twice I reasoned about the code and shipped a fix that could not work: the
 * first read a value that had already been overwritten one line above. Reading is not
 * enough — this runs admin.html's own cvSetDay and toggleSelected, in order, and asks
 * what ended up selected.
 *
 * Run: node scripts/admin-selection-runs.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

const root = path.join(__dirname, "..");
/* Windows checkouts carry CRLF; every anchor below is written with LF. */
const src = fs
  .readFileSync(path.join(root, "admin.html"), "utf8")
  .split("\r\n")
  .join("\n");
const D = require("../lib/pprog-display.js");

/** Lift a function out of the page verbatim — no copy, no paraphrase. */
function lift(from, to) {
  const i = src.indexOf(from);
  assert.ok(i >= 0, "cannot find in admin.html: " + from);
  const j = src.indexOf(to, i);
  assert.ok(j > i, "cannot find the end of: " + from);
  return src.slice(i, j + to.length);
}

const toggleSrc = lift("function toggleSelected(wi, day)", "S.selected = sortSel(list);\n  }");
const setDaySrc = lift("window.cvSetDay = function", "openDayTag(nextWi, nextDay);\n  };").replace(
  "window.cvSetDay = function",
  "var cvSetDay = function"
);

const S = { wi: 0, day: "sun", selected: [], edit: null };
const cvSetDay = new Function(
  "S",
  "clampWi",
  "selMath",
  "sortSel",
  "renderAdminDays",
  "openDayTag",
  "var cvIgnoreNextClick = false;\n" + toggleSrc + "\n" + setDaySrc + "\nreturn cvSetDay;"
)(
  S,
  function (n) {
    return Math.max(0, Math.min(3, n | 0));
  },
  function () {
    return D;
  },
  function (list) {
    return D.sortSelectedDays(list);
  },
  function () {},
  function () {}
);

function picked() {
  return S.selected.map(function (x) {
    return x.wi + ":" + x.day;
  });
}
function reset() {
  S.selected = [];
  S.wi = 0;
  S.day = "sun";
  S.edit = null;
}
function plain(wi, day) {
  cvSetDay({ type: "click", preventDefault: function () {} }, wi, day);
}
function ctrl(wi, day) {
  cvSetDay({ type: "click", ctrlKey: true, preventDefault: function () {} }, wi, day);
}

/* --- the report: "only in descending order" ----------------------------- */

reset();
plain(0, "sun"); /* session 1 is on screen */
ctrl(0, "mon"); /* ctrl-click session 2 */
ok("ASCENDING: session 1 open, ctrl-click 2 gives BOTH", picked().join(",") === "0:sun,0:mon");

reset();
plain(0, "tue"); /* session 3 is on screen */
ctrl(0, "mon");
ctrl(0, "sun");
ok("DESCENDING: 3 then 2 then 1 gives all three", picked().join(",") === "0:sun,0:mon,0:tue");

reset();
plain(0, "sun");
ctrl(0, "mon");
ctrl(0, "tue");
ok("and 1 then 2 then 3 gives all three too", picked().join(",") === "0:sun,0:mon,0:tue");

/* Whatever the order they were picked in, they are held in date order — reading order
   is not picking order (owner, 2026-09-01). */
reset();
plain(1, "wed");
ctrl(0, "mon");
ctrl(2, "sun");
ok("held in date order however they were picked", picked().join(",") === "0:mon,1:wed,2:sun");

/* --- taking one back out ------------------------------------------------ */

reset();
plain(0, "sun");
ctrl(0, "mon");
ctrl(0, "mon");
ok("ctrl-clicking a picked day removes it", picked().join(",") === "0:sun");

/* --- a plain click is a fresh start ------------------------------------- */

reset();
plain(0, "sun");
ctrl(0, "mon");
plain(0, "tue");
ok("a plain click clears the comparison", picked().length === 0);
ok("and moves to the day clicked", S.day === "tue");

/* --- the same day twice is not two days --------------------------------- */

reset();
plain(0, "sun");
ctrl(0, "sun");
ok("ctrl-clicking the open day does not duplicate it", picked().length <= 1);

console.log("admin-selection-runs.test.js passed");
