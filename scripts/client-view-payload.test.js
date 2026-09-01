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

console.log("All client-view payload checks passed.");
