/**
 * One clipboard: a part, a day, a week, a block — and between two clients.
 * Run: node scripts/pprog-clipboard.test.js
 *
 * The owner asked for every size of copy to cross from one client to another
 * (owner, 2026-09-05). That is only possible if the clipboard holds the CONTENT rather
 * than a pointer into the client it came from, so that is what is checked here: what
 * travels, what is refused, and what is never overwritten on arrival.
 */
const assert = require("assert");

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  passed += 1;
  console.log("ok —", name);
}

const C = require("../lib/pprog-clipboard.js");

/* A part as the owner actually writes one. */
const PART = {
  id: "p1",
  title: "Part A",
  lines: ["כל סבב במלוא הכוח", "E2MOM 10", "5 back squat"],
  noteLines: 1,
  formatLine: 1,
  numbered: true,
  lineColors: { 0: "red" },
  lineNums: { 0: 3 },
  modified: true,
};

/* --- what a copy of a part is -------------------------------------------- */

const copy = C.copyPart(PART, "new-id");
ok("the lines travel", copy.lines.join("|") === PART.lines.join("|"));
ok("the notes travel", copy.noteLines === 1);
/* And the shape with them, or the copy is read differently from its original
   (owner, 2026-09-05). */
ok("the shape travels", copy.formatLine === 1);
ok("the colours travel", copy.lineColors["0"] === "red");
ok("the numbering travels", copy.numbered === true && copy.lineNums["0"] === 3);
ok("it gets the id it was given", copy.id === "new-id");
/* A fresh copy has not been changed by anyone yet — that flag is about a person. */
ok("but not the flag saying somebody changed it", copy.modified === undefined);
ok("and the original is untouched", PART.lineColors["0"] === "red" && PART.id === "p1");
copy.lineColors["0"] = "blue";
ok("the copy's colours are its own", PART.lineColors["0"] === "red");

/* --- a day ---------------------------------------------------------------- */

const WEEK = {
  weekIndex: 1,
  theme: "Base",
  summaryLine: "week one",
  days: {
    sun: { title: "אימון תחנות", parts: [PART], modified: true },
    mon: { parts: [] },
    tue: { parts: [] },
    wed: { parts: [] },
    thu: { parts: [] },
    fri: { parts: [] },
    sat: { parts: [] },
  },
  overview: [{ day: "sun", focus: "Engine" }, { day: "fri", focus: "Rest" }],
};

const dayCopy = C.dayPayload(WEEK, "sun");
ok("a day carries its name", dayCopy.title === "אימון תחנות");
ok("its parts", dayCopy.parts.length === 1 && dayCopy.parts[0].noteLines === 1);
ok("and its focus line, which is where Rest is written", dayCopy.focus === "Engine");
ok("a rest day carries the word", C.dayPayload(WEEK, "fri").focus === "Rest");
ok("nothing about who changed it", dayCopy.modified === undefined);

/* --- putting it back ------------------------------------------------------ */

function freshWeeks(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ weekIndex: i + 1, days: { sun: { parts: [] }, mon: { parts: [] }, tue: { parts: [] }, wed: { parts: [] }, thu: { parts: [] }, fri: { parts: [] }, sat: { parts: [] } }, overview: [] });
  }
  return out;
}

let weeks = freshWeeks(4);
let res = C.pasteDay(weeks, 2, "tue", dayCopy);
ok("a day can be pasted", res.ok);
ok("with everything on it", weeks[2].days.tue.parts[0].lineColors["0"] === "red");
ok("its name", weeks[2].days.tue.title === "אימון תחנות");
ok("and its focus", C.focusOf(weeks[2], "tue") === "Engine");
ok("under an id of its own", weeks[2].days.tue.parts[0].id === "w3tue0");

/* A week the client does not have. His rule: stop, do not extend the block. */
const missing = C.pasteDay(freshWeeks(2), 9, "tue", dayCopy);
ok("a week the client does not have is refused", missing.ok === false);
ok("and says so in his words", /לא קיים/.test(missing.error));

/* --- a part is ADDED, never written over --------------------------------- */

weeks = freshWeeks(2);
weeks[0].days.sun.parts = [{ id: "keep", title: "Part A", lines: ["already here"] }];
res = C.pastePart(weeks, 0, "sun", PART);
ok("a part can be planted", res.ok);
ok("under the last one", weeks[0].days.sun.parts.length === 2);
ok("without touching what was there", weeks[0].days.sun.parts[0].id === "keep");
ok("and it is the part that was copied", weeks[0].days.sun.parts[1].lineColors["0"] === "red");
ok("with an id of its own", weeks[0].days.sun.parts[1].id !== "p1");

/* Planting a session in a rest day stops it being a rest day. */
weeks = freshWeeks(2);
C.setFocus(weeks[0], "fri", "Rest");
C.pastePart(weeks, 0, "fri", PART);
ok("a rest day that is written in is no longer a rest day", C.focusOf(weeks[0], "fri") === "");

/* --- a week --------------------------------------------------------------- */

weeks = freshWeeks(3);
res = C.pasteWeek(weeks, 1, C.weekPayload(WEEK));
ok("a whole week can be pasted", res.ok);
ok("with its days", weeks[1].days.sun.parts[0].numbered === true);
ok("its focus lines", C.focusOf(weeks[1], "fri") === "Rest");
ok("and its theme", weeks[1].theme === "Base");
ok("the week it came from is untouched", WEEK.days.sun.parts[0].id === "p1");

/* --- a block -------------------------------------------------------------- */

const block = C.blockPayload([WEEK, WEEK]);
ok("a block carries every week in it", block.weeks.length === 2 && block.weeks[0].days.sun.parts.length === 1);

/* --- what goes on the clipboard ------------------------------------------ */

const entry = C.entryFor("day", dayCopy, { programId: "p_1", clientName: "סטודיו", label: "ראשון · שבוע 1" });
ok("an entry knows what it is", entry.kind === "day");
ok("and where it came from", entry.from.clientName === "סטודיו");
ok("it describes itself for the paste line", C.describe(entry) === "יום · ראשון · שבוע 1 · סטודיו");
ok("a kind nobody offers is refused", C.entryFor("everything", {}, {}) === null);
ok("so is an entry with no content", C.entryFor("day", null, {}) === null);
ok("an entry is only usable for its own kind", C.isUsable(entry, "day") === true && C.isUsable(entry, "week") === false);

/* --- where the browser keeps it ------------------------------------------ */

function fakeLocalStorage() {
  const m = new Map();
  return {
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { m.set(k, String(v)); },
    removeItem(k) { m.delete(k); },
    _m: m,
  };
}
const ls = fakeLocalStorage();
const store = C.makeStore(ls);
store.write(entry);
ok("it survives being put down", store.read().kind === "day");
/* This is the whole point: a different page, a different client, same clipboard. */
const other = C.makeStore(ls);
ok("and picked up somewhere else entirely", other.read().from.clientName === "סטודיו");
ok("under a versioned key", ls._m.has(C.STORE_KEY));
ls.setItem(C.STORE_KEY, "{not json");
ok("rubbish in the box reads as an empty clipboard", C.makeStore(ls).read() === null);

/* A browser with storage switched off must lose the clipboard, never the page. */
const broken = {
  getItem() { throw new Error("blocked"); },
  setItem() { throw new Error("blocked"); },
  removeItem() { throw new Error("blocked"); },
};
const fallback = C.makeStore(broken);
fallback.write(entry);
ok("with storage blocked it still works for this page", fallback.read().kind === "day");
fallback.clear();
ok("and clearing it does not throw", fallback.read() === null);

console.log("\nAll clipboard checks passed (" + passed + " assertions).");
