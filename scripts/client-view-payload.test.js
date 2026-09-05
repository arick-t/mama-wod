/**
 * The client-view security boundary (checklist 0.1).
 * Run: node scripts/client-view-payload.test.js
 *
 * Two promises the owner made that this file is what actually keeps:
 *   1. The person being charged never sees what he is charged.
 *   2. The client edits and "feels nothing" — so the owner's unread queue must not
 *      be visible to him either.
 *
 * Written as an allowlist test: a field is exposed only if it is named on purpose.
 */
const assert = require("assert");
const P = require("../lib/client-view-payload.js");
const Store = require("../lib/client-program-store.js");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

/* A program carrying every kind of private field the real object will hold. */
function loadedProgram() {
  const p = Store.emptyProgram({ clientName: "Coach A", weekCount: 5 });
  p.version = 7;
  p.weeks[0].days.mon.parts = [
    { id: "mon-0", title: "Part A", lines: ["Back squat 5x5"], internalNote: "charge more" },
  ];
  p.weeks[0].theme = "Army prep";
  p.weeks[0].overview[1] = { day: "mon", focus: "Squat", secret: "nope" };
  /* Owner-only, must never travel: */
  p.monthlyAmount = 900;
  p.paymentMethod = "bit, 1st of the month";
  p.paymentNotes = "raise in January";
  p.unreadDays = { "w1:tue": "2026-08-31T00:00:00.000Z" };
  p.isTest = true;
  p.updatedBy = "client";
  p.ownerNotes = "he negotiates hard";
  p.accessCode = "123456";
  p.devices = [{ id: "d1" }];
  p.email = "coach@example.com";
  /* A program the client can actually read is one the owner has SENT. Since 2026-09-01
     nothing crosses this boundary until he approves the block — block one included — so
     a fixture that skips the approval is a fixture of a program nobody can see. */
  p.blocks[0].approvedAt = "2026-08-31T00:00:00.000Z";
  return p;
}

/* --- what leaves ---------------------------------------------------------- */

const out = P.programForClient(loadedProgram());
const json = JSON.stringify(out);

ok("the client gets the program id", out.programId !== undefined);
ok("the client gets their own name", out.clientName === "Coach A");
ok("the client gets the training content", out.weeks[0].days.mon.parts[0].lines[0] === "Back squat 5x5");
ok("the client gets all five weeks", out.weeks.length === 5);
ok("the client gets every day of every week", out.weeks.every(function (w) {
  return P.DAY_KEYS.every(function (d) { return Array.isArray(w.days[d].parts); });
}));

/* version must travel — it is what makes a stale save refusable */
ok("the client gets the version", out.version === 7);

/* --- what must NEVER leave ------------------------------------------------ */

ok("payment amount does not leave", json.indexOf("900") < 0 && out.monthlyAmount === undefined);
ok("payment method does not leave", json.indexOf("bit,") < 0 && out.paymentMethod === undefined);
ok("payment notes do not leave", json.indexOf("raise in January") < 0);
ok("the owner's unread queue does not leave", out.unreadDays === undefined && json.indexOf("unreadDays") < 0);
ok("the owner's private notes do not leave", json.indexOf("he negotiates hard") < 0);
ok("the access code does not leave", json.indexOf("123456") < 0);
ok("the device list does not leave", out.devices === undefined);
ok("an email does not leave", json.indexOf("coach@example.com") < 0);
ok("the test marker does not leave", out.isTest === undefined);
ok("who last edited does not leave", out.updatedBy === undefined);

/* Unknown fields nested inside content are dropped too — allowlist all the way down. */
ok("an unknown field on a part is dropped", json.indexOf("internalNote") < 0);
ok("an unknown field on an overview row is dropped", json.indexOf('"secret"') < 0);

/* Belt and braces: assert every name on the never-list is absent by name. */
for (const forbidden of P.NEVER_TO_CLIENT) {
  ok('"' + forbidden + '" is absent from the client payload', json.indexOf('"' + forbidden + '"') < 0);
}

/* --- a program that is not a program ------------------------------------- */

ok("null program yields null", P.programForClient(null) === null);
ok("a string is not a program", P.programForClient("nope") === null);
ok(
  "a program with no weeks still returns a usable shape",
  JSON.stringify(P.programForClient({ programId: "p_1", version: 1 }).weeks) === "[]"
);

/* --- what the client may send back --------------------------------------- */

const goodEdit = P.parseClientEdit({
  expectedVersion: 7,
  edits: [{ weekIndex: 1, dayKey: "mon", parts: [{ id: "mon-0", title: "Part A", lines: ["Front squat 5x5"] }] }],
});
ok("a well-formed edit is accepted", goodEdit.ok === true);
ok("the expected version is carried through", goodEdit.expectedVersion === 7);

ok(
  "an edit without expectedVersion is refused",
  P.parseClientEdit({ edits: [{ weekIndex: 1, dayKey: "mon", parts: [] }] }).ok === false
);
ok("an empty save is refused", P.parseClientEdit({ expectedVersion: 7, edits: [] }).ok === false);
ok(
  "an out-of-range week is refused",
  P.parseClientEdit({ expectedVersion: 7, edits: [{ weekIndex: 99, dayKey: "mon", parts: [] }] }).ok === false
);
ok(
  "an unknown day is refused",
  P.parseClientEdit({ expectedVersion: 7, edits: [{ weekIndex: 1, dayKey: "xxx", parts: [] }] }).ok === false
);
ok(
  "a day without a parts array is refused",
  P.parseClientEdit({ expectedVersion: 7, edits: [{ weekIndex: 1, dayKey: "mon" }] }).ok === false
);

/* The client cannot set the fields the server owns, even by sending them. */
const sneaky = P.parseClientEdit({
  expectedVersion: 7,
  version: 99,
  monthlyAmount: 0,
  paymentMethod: "free",
  unreadDays: {},
  clientName: "Renamed Myself",
  isTest: false,
  edits: [
    {
      weekIndex: 1,
      dayKey: "mon",
      parts: [{ id: "mon-0", title: "T", lines: ["x"], modified: false, ownerNotes: "hi" }],
    },
  ],
});
ok("a sneaky payload still parses (only its edits are kept)", sneaky.ok === true);
const sneakyJson = JSON.stringify(sneaky);
ok("the client cannot set the version", sneakyJson.indexOf("99") < 0);
ok("the client cannot zero out their price", sneakyJson.indexOf("monthlyAmount") < 0);
ok("the client cannot change the payment method", sneakyJson.indexOf("free") < 0);
ok("the client cannot clear the owner's unread queue", sneakyJson.indexOf("unreadDays") < 0);
ok("the client cannot rename themselves", sneakyJson.indexOf("Renamed Myself") < 0);
ok("the client cannot smuggle owner notes into a part", sneakyJson.indexOf("ownerNotes") < 0);

/* --- applying an edit ---------------------------------------------------- */

const draft = Store.emptyProgram({ clientName: "Coach A" });
/* Sent to the client, or nothing of it crosses the boundary at all. */
draft.blocks[0].approvedAt = "2026-08-31T00:00:00.000Z";
const parsed = P.parseClientEdit({
  expectedVersion: 1,
  edits: [
    { weekIndex: 2, dayKey: "wed", parts: [{ id: "wed-0", title: "Part A", lines: ["Row 2k"] }] },
    { weekIndex: 3, dayKey: "fri", parts: [{ id: "fri-0", title: "Part A", lines: ["Bike 10k"] }] },
  ],
});
const touched = P.applyClientEdit(draft, parsed);
ok("the edit lands on the right week and day", draft.weeks[1].days.wed.parts[0].lines[0] === "Row 2k");
ok("the second edit lands too", draft.weeks[2].days.fri.parts[0].lines[0] === "Bike 10k");
ok("edited parts are marked MODIFIED", draft.weeks[1].days.wed.parts[0].modified === true);
ok("the day is marked MODIFIED", draft.weeks[1].days.wed.modified === true);
ok("both touched days are reported", touched.length === 2 && touched.indexOf("w2:wed") >= 0 && touched.indexOf("w3:fri") >= 0);
ok("untouched days stay untouched", draft.weeks[0].days.mon.modified === undefined);
ok("the applied draft is still structurally valid", Store.validateProgram(draft) === null);

/* An edit aimed at a week that does not exist must not create one. */
const overshoot = P.applyClientEdit(draft, {
  edits: [{ weekIndex: 11, dayKey: "mon", parts: [] }],
});
ok("an edit past the last week is ignored, not grown", overshoot.length === 0 && draft.weeks.length === 5);

/* --- the MODIFIED tag round-trips to the client ------------------------- */

const withModified = P.programForClient(draft);
ok("the client sees the MODIFIED tag on their own edit", withModified.weeks[1].days.wed.parts[0].modified === true);

/* --- defence in depth for the admin path -------------------------------- */

const stripped = P.stripSensitive({ athleteId: "a1", monthlyAmount: 900, unreadDays: {}, displayName: "Coach A" });
ok("stripSensitive keeps ordinary fields", stripped.displayName === "Coach A");
ok("stripSensitive removes payment", stripped.monthlyAmount === undefined);
ok("stripSensitive removes the unread queue", stripped.unreadDays === undefined);

/* --- no provider calls anywhere in the boundary ------------------------- */

const src = require("fs").readFileSync(require("path").join(__dirname, "..", "lib", "client-view-payload.js"), "utf8");
ok("the boundary makes no network calls", !/\bfetch\s*\(/.test(src));

/* --- a block the owner has not sent does not exist for the client --- */

const unsent = loadedProgram();
unsent.blocks[0].approvedAt = null;
const unsentOut = P.programForClient(unsent);
ok("an unapproved block sends no weeks at all", (unsentOut.weeks || []).length === 0);
ok("not even an empty shell of one", JSON.stringify(unsentOut).indexOf("Back squat") < 0);
ok("and the client is not told one is coming", unsentOut.blocks === undefined);

/* Two blocks, one sent: the client reads the first and knows nothing of the second. */
const halfSent = loadedProgram();
halfSent.weeks = halfSent.weeks.concat(
  [6, 7, 8, 9].map(function (w) {
    return Store.emptyWeek(w, null, false);
  })
);
halfSent.blocks.push({ blockIndex: 2, startWeek: 6, weekCount: 4, approvedAt: null });
const halfOut = P.programForClient(halfSent);
ok("the sent block crosses in full", halfOut.weeks.length === 5);
ok("the planned one does not cross at all", halfOut.weeks.length < halfSent.weeks.length);

/* The owner's own to-do list is his. */
const withReview = loadedProgram();
withReview.weeks[0].days.tue.ownerUnreviewed = true;
ok(
  "\"I have not been over this\" never reaches the client",
  P.programForClient(withReview).weeks[0].days.tue.ownerUnreviewed === undefined
);

/* --- the coach's change flag crosses, the owner's queue does not ---- */

const coachChanged = P.programForClient({
  programId: "p_flag",
  clientName: "Coach",
  version: 4,
  unreadDays: { "w1:mon": "2026-09-01T00:00:00.000Z" },
  clientUnreadDays: { "w1:tue": "2026-09-01T00:00:00.000Z" },
  weeks: [
    {
      weekIndex: 1,
      days: {
        sun: { parts: [] },
        mon: { parts: [{ id: "a", title: "Part A", lines: ["x"] }], modified: true },
        tue: { parts: [{ id: "b", title: "Part A", lines: ["y"] }], coachModified: true },
        wed: { parts: [] },
        thu: { parts: [] },
        fri: { parts: [] },
        sat: { parts: [] },
      },
    },
  ],
});
ok("the coach's change flag reaches the client", coachChanged.weeks[0].days.tue.coachModified === true);
ok("a day the coach did not touch carries no flag", coachChanged.weeks[0].days.sun.coachModified === undefined);
/* Both queues are the OWNER's bookkeeping. The client's own flags ride on the days, so
   there is no second list that could disagree with them. */
ok("the owner's unread queue does not cross", coachChanged.unreadDays === undefined);
ok("nor does the client's queue as a list", coachChanged.clientUnreadDays === undefined);
ok("clientUnreadDays is named as never-to-client", P.NEVER_TO_CLIENT.indexOf("clientUnreadDays") >= 0);


/* --- the client's calendar is told the SHAPE, never the questionnaire ----
 * A client who bought three sessions a week was shown a seven-day week, while the
 * owner's screen showed three (owner, 2026-09-02). The fix is one derived number, not
 * the intake — which carries their price.
 */
const shapeWeeks = [1, 2, 3, 4].map(function (i) {
  return { weekIndex: i, phase: "build", theme: "", overview: [], days: {} };
});
const shapeBase = {
  programId: "p_shape",
  clientName: "Shape",
  version: 1,
  updatedAt: "",
  blockStart: "2026-08-30",
  weeks: shapeWeeks,
  blocks: [{ blockIndex: 1, startWeek: 1, weekCount: 4, approvedAt: "2026-08-30T00:00:00Z" }],
};
const sessionsOut = P.programForClient(
  Object.assign({}, shapeBase, {
    intake: { scheduleMode: "session_count", sessionsPerWeek: 3, monthlyAmount: 900, paymentMethod: "bit" },
  })
);
ok("a session-count client is told how many", sessionsOut.sessionColumns === 3);
ok("but never the questionnaire", sessionsOut.intake === undefined);
ok("nor what they pay", sessionsOut.monthlyAmount === undefined && sessionsOut.paymentMethod === undefined);
const weekdayOut = P.programForClient(
  Object.assign({}, shapeBase, { intake: { scheduleMode: "weekly_schedule", monthlyAmount: 900 } })
);
ok("a weekday client is told nothing extra", weekdayOut.sessionColumns === 0);
const wildOut = P.programForClient(
  Object.assign({}, shapeBase, { intake: { scheduleMode: "session_count", sessionsPerWeek: 99 } })
);
ok("a number the week cannot hold is refused", wildOut.sessionColumns === 0);
/* Where the months divide, from APPROVED blocks only. */
ok("the client is told where the blocks divide", JSON.stringify(sessionsOut.blockGroups) === '[{"startWeek":1,"weekCount":4}]');


/* --- a day can be given a name (owner, 2026-09-05) ------------------------
 * "Week 1 · session 1" is a count, not a name. He wanted to call a day what it is —
 * "אימון תחנות" — and keep the count beside it, small and un-editable.
 * ------------------------------------------------------------------------- */

const named = P.programForClient({
  programId: "p_named",
  version: 3,
  weeks: [
    {
      weekIndex: 1,
      days: {
        sun: { parts: [{ id: "a", title: "Part A", lines: ["x"] }], title: "אימון תחנות" },
        mon: { parts: [] }, tue: { parts: [] }, wed: { parts: [] },
        thu: { parts: [] }, fri: { parts: [] }, sat: { parts: [] },
      },
      overview: [],
    },
  ],
  blocks: [{ blockIndex: 1, startWeek: 1, weekCount: 1, approvedAt: "2026-09-01T00:00:00Z" }],
  monthlyAmount: 500,
});
ok("the name travels to the client with the plan", named.weeks[0].days.sun.title === "אימון תחנות");
ok("and the price still does not", named.monthlyAmount === undefined);

const withTitle = P.parseClientEdit({
  expectedVersion: 3,
  edits: [{ weekIndex: 1, dayKey: "sun", parts: [{ title: "A", lines: ["y"] }], title: "  אימון תחנות  " }],
});
ok("a client may name a day of their own programme", withTitle.ok && withTitle.edits[0].title === "אימון תחנות");
const noTitle = P.parseClientEdit({
  expectedVersion: 3,
  edits: [{ weekIndex: 1, dayKey: "sun", parts: [{ title: "A", lines: ["y"] }] }],
});
ok("saying nothing about it leaves it alone", noTitle.ok && noTitle.edits[0].title === undefined);

const draftDay = {
  weeks: [{ days: { sun: { parts: [], title: "old" } }, overview: [] }],
};
P.applyClientEdit(draftDay, withTitle);
ok("naming one writes it", draftDay.weeks[0].days.sun.title === "אימון תחנות");
P.applyClientEdit(draftDay, noTitle);
ok("and an edit that says nothing keeps it", draftDay.weeks[0].days.sun.title === "אימון תחנות");
const clearTitle = P.parseClientEdit({
  expectedVersion: 3,
  edits: [{ weekIndex: 1, dayKey: "sun", parts: [{ title: "A", lines: ["y"] }], title: "" }],
});
P.applyClientEdit(draftDay, clearTitle);
ok("an empty one takes it off", draftDay.weeks[0].days.sun.title === undefined);

/* A name belongs to the DAY, so it survives the day changing shape. */
const RT = require("../lib/day-rest-toggle.js");
const wk = { days: { sun: { parts: [{ id: "a", title: "A", lines: ["x"] }], title: "אימון תחנות" } }, overview: [] };
RT.makeRest(wk, "sun");
ok("it survives becoming a rest day", wk.days.sun.title === "אימון תחנות");
RT.makeSession(wk, "sun", [{ id: "b", title: "A", lines: ["y"] }]);
ok("and coming back from one", wk.days.sun.title === "אימון תחנות");

console.log("All client-view payload checks passed.");
