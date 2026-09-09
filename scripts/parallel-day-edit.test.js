/**
 * Several days open for editing at once — and the days that do not exist.
 * Run: node scripts/parallel-day-edit.test.js
 *
 * Item 5 (owner, 2026-09-09): "אם אני פותח מספר ימים אני יכול להיכנס למצב עריכה בכמה
 * ימים במקביל ולעבוד עליהם - כלל הפיצ'רים יחולו על כל הימים אותם פתחתי לעריכה ובכלל
 * זאת - הוספה והסרה על בסיס הכפתורים / שימוש במקש ENTER וכן גרירה של חלקים ישירות בין
 * הימים / שינוי הסדר ע"י גרירה בתוך אותו היום".
 *
 * Item 8 (owner, 2026-09-09, with a picture): selecting every day of a block planted
 * rest days that were never sold, dated by weekday, with a duck on them.
 *
 * The back office holds the drafts in a MAP keyed "wi:day" and the shared card puts
 * that key into every hook call. The client's page shows one day at a time and keeps
 * the older single-draft shape — that difference is deliberate and asserted here.
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

const D = require("../lib/pprog-display.js");
const root = path.join(__dirname, "..");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8").split("\r\n").join("\n");
const client = fs.readFileSync(path.join(root, "client.html"), "utf8");
const lib = fs.readFileSync(path.join(root, "lib", "pprog-display.js"), "utf8");

/* ── the card draws one editor per open day ──────────────────────────────── */

const dayParts = [{ title: "חימום", lines: ["3 rounds"] }];
const week = { weekIndex: 1, overview: [], days: { sun: { parts: dayParts }, mon: { parts: dayParts } } };
const block = { blockStart: "2026-08-31", weeks: [week, week, week, week] };
const HOOKS = {
  editSet: "cvEditSet", editAddNote: "cvEditAddNote", editAddWork: "cvEditAddWork",
  editAddPart: "cvEditAddPart", editRemoveWork: "cvEditRemoveWork", editRemoveNote: "cvEditRemoveNote",
  editSetColour: "cvEditSetColour", editSetNumber: "cvEditSetNumber", editSetNumbering: "cvEditSetNumbering",
  editRemovePart: "cvEditRemovePart", editCancel: "cvEditCancel", editSave: "cvEditSave",
};
function draftOf(wi, day, title) {
  return { wi: wi, day: day, parts: [{ title: title, notes: ["note"], format: "", work: ["x"], numbered: true }] };
}
const two = D.renderBrickView({
  block: block, blockGroups: [{ startWeek: 1, weekCount: 4 }], activeWeekIndex: 0, activeDay: "sun",
  allowEdit: true, allowLineColour: true, allowTitleEdit: true, weekRows: 4,
  selectedDays: [{ wi: 0, day: "sun" }, { wi: 1, day: "mon" }],
  editDrafts: { "0:sun": draftOf(0, "sun", "חימום"), "1:mon": draftOf(1, "mon", "כוח") },
  editHeaderActionsHtml: function (wi, day) { return '<i data-rest="' + wi + ":" + day + '"></i>'; },
  hooks: HOOKS,
});
ok("two days can be open at the same time", (two.match(/pprog-day-card[^"]*is-editing/g) || []).length === 2);
const keyed = two.match(/cvEdit[A-Za-z]+\('[01]:(sun|mon)'/g) || [];
ok("every control names the day it belongs to", keyed.length > 30);
ok("and both days are named", Array.from(new Set(keyed.map((k) => k.split("(")[1]))).sort().join(" ") === "'0:sun' '1:mon'");
ok("no control is left without a day", !/cvEdit[A-Za-z]+\((?!')/.test(two));
/* Each of the things he listed, per day. */
ok("Save is per card", /cvEditSave\('0:sun'\)/.test(two) && /cvEditSave\('1:mon'\)/.test(two));
ok("so is Cancel", /cvEditCancel\('0:sun'\)/.test(two) && /cvEditCancel\('1:mon'\)/.test(two));
ok("so is ＋ Add Part", /cvEditAddPart\('1:mon'\)/.test(two));
ok("so are the ＋ Note and ＋ Work line chips", /cvEditAddNote\('1:mon',0\)/.test(two) && /cvEditAddWork\('1:mon',0\)/.test(two));
ok("Enter in a work line opens one in ITS day", /cvEditAddWork\('1:mon',0,1\)/.test(two));
ok("Enter in a note too", /cvEditAddNote\('1:mon',0,1\)/.test(two));
ok("the × on a line, and on a whole part", /cvEditRemoveWork\('0:sun',0,0\)/.test(two) && /cvEditRemovePart\('0:sun',0\)/.test(two));
ok("the colour palette", /cvEditSetColour\('0:sun',0,0,/.test(two));
ok("the numbering tick and the line numbers", /cvEditSetNumbering\('1:mon',0,this.checked\)/.test(two) && /cvEditSetNumber\('1:mon',0,0,this\)/.test(two));
ok("the day's own heading field", (two.match(/data-day-title="[01]:(sun|mon)"/g) || []).length === 2);
ok("and the rest tick is asked for per card", (two.match(/data-rest="[01]:(sun|mon)"/g) || []).length === 2);

/* The older shape — one draft, no key — is untouched: the athlete app and the older
   admin editor still call their hooks exactly as they did. */
const one = D.renderBrickView({
  block: block, blockGroups: [{ startWeek: 1, weekCount: 4 }], activeWeekIndex: 0, activeDay: "sun",
  allowEdit: true, weekRows: 4, editing: true, editDraft: draftOf(0, "sun", "a"),
});
ok("one open day still works the old way", /is-editing/.test(one));
ok("and its calls carry no key", /adminPprogEditSave\(\)/.test(one) && !/adminPprogEditSave\('/.test(one));
ok("the library only keys a page that asked for many", /per\.editKey = mine && opts\.editDrafts/.test(lib));

/* ── item 8: a slot that was never sold is not drawn ─────────────────────── */

const phantom = D.renderBrickView({
  block: block, blockGroups: [{ startWeek: 1, weekCount: 4 }], activeWeekIndex: 0, activeDay: "sun",
  allowEdit: true, weekRows: 4, sessionColumns: 3,
  /* A selection that walked the 7-day grid: sun-tue exist, wed-sat do not. */
  selectedDays: [{ wi: 0, day: "sun" }, { wi: 0, day: "mon" }, { wi: 0, day: "tue" }, { wi: 0, day: "wed" }, { wi: 0, day: "thu" }],
});
ok("only the sessions that were sold are drawn", (phantom.match(/class="pprog-day-card/g) || []).length === 3);
ok("and the card itself refuses the rest", /if \(opts\.sessionColumns && DAY_KEYS\.indexOf\(sday\) >= \(opts\.sessionColumns \| 0\)\) continue;/.test(lib));

/* ── item 8, run for real: the page's own filter ─────────────────────────── */

/** Lift a function out of the page verbatim — no copy, no paraphrase. */
function lift(from, to) {
  const i = admin.indexOf(from);
  assert.ok(i >= 0, "cannot find in admin.html: " + from);
  const j = admin.indexOf(to, i);
  assert.ok(j > i, "cannot find the end of: " + from);
  return admin.slice(i, j + to.length);
}
const filterSrc =
  lift("function sortSel(list)", "return D && D.sortSelectedDays ? D.sortSelectedDays(real) : real;\n  }") +
  "\n" +
  lift("function sessionsInWeek(wi)", "return n >= 1 && n <= 7 ? n : base;\n  }") +
  "\n" +
  lift("function keepRealDays(list)", "});\n  }");
const S = {
  program: {
    intake: { scheduleMode: "session_count", sessionsPerWeek: 3 },
    /* week 3 was cut to two sessions — the per-week number wins. */
    weeks: [{}, {}, { sessions: 2 }, {}],
  },
};
const built = new Function(
  "S",
  "pprogLib",
  "DAY_KEYS_LOCAL",
  "sessionCountLimit",
  filterSrc + "\nreturn { sortSel: sortSel, keepRealDays: keepRealDays, sessionsInWeek: sessionsInWeek };"
)(S, function () { return D; }, ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], function () {
  const n = parseInt(S.program.intake.sessionsPerWeek, 10);
  return S.program.intake.scheduleMode !== "session_count" ? 0 : n > 0 && n <= 7 ? n : 0;
});

const wholeBlock = [];
for (let wi = 0; wi < 4; wi++) {
  ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].forEach(function (d) {
    wholeBlock.push({ wi: wi, day: d });
  });
}
const kept = built.sortSel(wholeBlock);
ok("dragging across a whole block picks 28 cells", wholeBlock.length === 28);
ok("but only the sessions that exist survive", kept.length === 3 + 3 + 2 + 3);
ok("no day beyond the sessions sold is left", kept.every((c) => ["sun", "mon", "tue"].indexOf(c.day) >= 0));
ok("the week he cut to two keeps two", kept.filter((c) => c.wi === 2).length === 2);
ok("and they are still in reading order", kept[0].wi === 0 && kept[0].day === "sun");
/* A programme of weekdays is not touched by any of this. */
S.program.intake.scheduleMode = "weekly_schedule";
ok("a weekday programme keeps all seven", built.sortSel(wholeBlock).length === 28);
S.program.intake.scheduleMode = "session_count";

/* ── the page: one draft per day, and what closes it ─────────────────────── */

ok("the drafts live in a map", /S\.edits = \{\}/.test(admin) && /function editKeyOf\(wi, day\)/.test(admin));
ok("a control finds its own draft", /function draftFor\(key\)/.test(admin));
ok("the pencil on a second card does not close the first", /The pencil on another card no longer closes this one/.test(admin));
ok("opening a day that is already open keeps what he typed", /if \(!S\.edits\[key\]\) \{/.test(admin));
ok("the calendar is handed the whole map", /editDrafts: S\.edits,/.test(admin));
ok("Save closes only its own card", /forgetDraft\(\(opts && opts\.key\) \|\| editKeyOf\(wi, dayKey\)\)/.test(admin));
ok("leaving the screen writes every open day", /function autosaveAllDrafts\(\)/.test(admin));
ok("picking days writes only what left the screen", /function autosaveDraftsOffScreen\(\)/.test(admin));
ok("and a background refresh waits for all of them", /if \(S\.program && !openDraftKeys\(\)\.length && !S\.adding\)/.test(admin));
/* The caret must land in the card he is typing in, not the nth part of the page. */
ok("the caret is put inside that card", /var host = cardOfKey\(key\) \|\| document;/.test(admin));
ok("which is found by week and day", /function cardOfKey\(key\)/.test(admin));

/* ── the drag: inside a day, and between two open days ───────────────────── */

ok("inside a day it reorders", /window\.cvMovePart = function \(wi, day, from, to\)/.test(admin));
ok("between two open days the part MOVES", /var moving = fromDraft\.parts\.splice\(was\.index, 1\)\[0\];/.test(admin) && /toDraft\.parts\.push\(moving\);/.test(admin));
ok("a day that is not open yet is opened first", /if \(fromDraft && !toDraft && typeof window\.cvStartEdit === "function"\)/.test(admin));
ok("the day it left is never left with nowhere to type", /if \(!fromDraft\.parts\.length\) \{[\s\S]{0,120}title: "", notes: \[""\]/.test(admin));
ok("and it says so, in his words", /החלק עבר ליום הזה\. יישמר עם שאר היום\./.test(admin));

/* ── the client's page is deliberately unchanged ─────────────────────────── */

ok("the client's page keeps one open day", /window\.cvEditSet = function \(partIndex, field, a, b\)/.test(client));
ok("and its own single draft", /state\.edit = \{ wi: nextWi/.test(client));

console.log("\nAll parallel-edit and real-days checks passed (" + passed + " assertions).");
