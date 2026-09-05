/**
 * How many sessions a week — and changing it from a point in time onwards.
 * Run: node scripts/week-sessions.test.js
 *
 * The owner's case (2026-09-05): a client trained four times a week and now trains
 * five. The weeks already written must keep the four they were written with, and the
 * new number starts at the week he is standing in.
 *
 * Two rules are worth guarding hardest, because breaking either would be quiet:
 * nothing is ever deleted by this — a session that stops being SHOWN is still on file —
 * and it applies to blank clients only, because a studio's and an individual's
 * programmes come from the coach's brain.
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
const Store = require("../lib/client-program-store.js");
const Payload = require("../lib/client-view-payload.js");
const root = path.join(__dirname, "..");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const api = fs.readFileSync(path.join(root, "api", "client-program.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles", "pprog-display.css"), "utf8");

function emptyWeek(n, sessions) {
  const w = {
    weekIndex: n,
    days: { sun: { parts: [] }, mon: { parts: [] }, tue: { parts: [] }, wed: { parts: [] }, thu: { parts: [] }, fri: { parts: [] }, sat: { parts: [] } },
    overview: [],
  };
  if (sessions) w.sessions = sessions;
  return w;
}

/* --- what the calendar draws --------------------------------------------- */

const mixed = {
  blockStart: "2026-09-06",
  /* A block of exactly these four weeks, so the calendar draws four rows and not
     the five a block holds by default. */
  blocks: [{ blockIndex: 1, startWeek: 1, weekCount: 4, approvedAt: "2026-09-01T00:00:00Z" }],
  weeks: [emptyWeek(1), emptyWeek(2), emptyWeek(3, 5), emptyWeek(4, 5)],
};
const drawn = D.renderBrickView({
  block: mixed, activeWi: 0, activeDay: "sun", calMode: "month", sessionColumns: 4, showFooter: false,
});
ok("the grid is as wide as the widest week", /--cal-cols:5/.test(drawn));
/* Two weeks of four, in a grid of five: one empty place each, and none in the weeks
   that hold five. (The calendar draws a block's full five rows whatever is in it, so
   the rows are counted one by one rather than in a lump.) */
const calRows = drawn.split("pprog-cal-row").slice(1).map(function (r) {
  return (r.match(/pprog-cal-cell is-off/g) || []).length;
});
ok("a narrower week keeps its place in the grid", calRows[0] === 1 && calRows[1] === 1);
ok("and a week that holds five fills the row", calRows[2] === 0 && calRows[3] === 0);
ok("and that place is invisible rather than clickable", /\.pprog-cal-cell\.is-off\{visibility:hidden;pointer-events:none\}/.test(css));

const plain = D.renderBrickView({
  block: { blockStart: "2026-09-06", weeks: [emptyWeek(1), emptyWeek(2)] },
  activeWi: 0, activeDay: "sun", calMode: "month", showFooter: false,
});
ok("a programme nobody has changed draws exactly as it did", plain.indexOf("is-off") < 0 && plain.indexOf("--cal-cols") < 0);

const weekView = D.renderBrickView({
  block: mixed, activeWi: 0, activeDay: "sun", calMode: "week", sessionColumns: 4, showFooter: false,
});
ok("one week on its own is drawn the same way", (weekView.match(/pprog-cal-cell is-off/g) || []).length === 1);

/* --- the number travels to the client ------------------------------------ */

ok("a week may carry its own number", Payload.WEEK_OUT.indexOf("sessions") >= 0);
const sent = Payload.programForClient({
  weeks: [emptyWeek(1), emptyWeek(2, 5)],
  approvedThroughWeek: 2,
});
ok("and it arrives on the client's copy", sent.weeks[1].sessions === 5);
ok("while a week that says nothing still says nothing", sent.weeks[0].sessions === undefined);

/* --- the change itself ---------------------------------------------------- */

function fakeStorage() {
  const data = new Map();
  return {
    async getJson(k) { const h = data.get(k); return h === undefined ? null : JSON.parse(JSON.stringify(h)); },
    async putJson(k, v) { data.set(k, JSON.parse(JSON.stringify(v))); return { pathname: k }; },
    async putJsonExclusive(k, v) { if (data.has(k)) { const e = new Error("x"); e.code = "already_exists"; throw e; } data.set(k, v); return { pathname: k }; },
    async deleteJson(k) { data.delete(k); return { pathname: k }; },
    async listJson() { return []; },
    storageInfo() { return { backend: "memory", durable: true }; },
  };
}

async function main() {
  const store = Store.createProgramStore(fakeStorage());
  let p = (await store.createProgram({
    clientName: "יעל",
    clientKind: "blank",
    weekCount: 4,
    intake: { clientName: "יעל", scheduleMode: "session_count", sessionsPerWeek: 4 },
    blockStart: "2026-09-06",
  })).program;

  /* Something written in the fifth session of week 1 — the one that is not shown while
     the client is on four a week. */
  p = (await store.updateProgram(p.programId, p.version, function (d) {
    d.weeks[0].days.thu = { parts: [{ id: "x", title: "החמישי", lines: ["10 מתח"] }] };
    return d;
  }, { actor: "owner" })).program;

  const changed = await store.setWeekSessions(p.programId, p.version, 3, 5);
  ok("the number can be changed from a week onwards", changed.ok && changed.sessions === 5);
  ok("the weeks before it are untouched", changed.program.weeks[0].sessions === undefined && changed.program.weeks[1].sessions === undefined);
  ok("and every week from there carries the new one", changed.program.weeks[2].sessions === 5 && changed.program.weeks[3].sessions === 5);
  ok("it says how many weeks it moved", changed.changed === 2);
  /* THE rule: this is a display decision, not a deletion. */
  ok("nothing written anywhere was deleted", changed.program.weeks[0].days.thu.parts[0].title === "החמישי");
  p = changed.program;

  const back = await store.setWeekSessions(p.programId, p.version, 3, 4);
  ok("putting the number back brings the session back", back.ok && back.program.weeks[2].sessions === 4);

  const silly = await store.setWeekSessions(p.programId, back.program.version, 1, 9);
  ok("nine sessions a week is refused", !silly.ok && silly.code === "BAD_SESSIONS");
  const nowhere = await store.setWeekSessions(p.programId, back.program.version, 99, 3);
  ok("so is a week that does not exist", !nowhere.ok);

  /* --- who may do it ----------------------------------------------------- */

  ok("the endpoint asks what kind of client this is", /read\.program\.clientKind !== "blank"/.test(api));
  ok("and says why not, in his words", api.indexOf("קיים כרגע ללקוח ריק בלבד") >= 0);

  /* --- the line and its pencil -------------------------------------------- */

  ok("the heading says what this client gets a week", admin.indexOf("function sessionsLineHtml(p)") >= 0);
  ok("in his words for both shapes", admin.indexOf("7 ימי אימון שבועיים") >= 0 && admin.indexOf('" אימונים שבועיים"') >= 0);
  ok("the pencil is offered to a blank client only", /var canEdit = !!\(p && p\.clientKind === "blank"\);/.test(admin));
  ok("it opens a box with one number in it", admin.indexOf("function openSessionsBox(") >= 0 && admin.indexOf('id="sessCount"') >= 0);
  ok("which says what it is about to do", admin.indexOf("השינוי חל משבוע") >= 0);
  ok("and that nothing is deleted by it", admin.indexOf("לא נמחק") >= 0);
  ok("the change starts at the week he is standing in", /data-sessions-save="' \+ week \+ '"/.test(admin));

  console.log("\nAll week-sessions checks passed (" + passed + " assertions).");
}

main().catch(function (e) {
  console.error("FAIL:", (e && e.stack) || e);
  process.exit(1);
});
