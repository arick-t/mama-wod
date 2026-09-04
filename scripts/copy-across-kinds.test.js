/**
 * Copy a week, copy a day — for every kind of client, and all the way to their phone.
 * Run: node scripts/copy-across-kinds.test.js
 *
 * The owner's question before this ships: does the gesture apply to a studio, an
 * individual and a blank client alike, on his side AND in what the client receives
 * through their link (owner, 2026-09-04).
 *
 * So each kind is created the way the product creates it, written on, copied from and
 * pasted onto — and then read back through the client payload, which is the only thing
 * that ever crosses to a phone.
 */
const assert = require("assert");
const path = require("path");

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  passed += 1;
  console.log("ok —", name);
}

const Store = require("../lib/client-program-store.js");
const Payload = require("../lib/client-view-payload.js");
const Intake = require("../lib/client-intake.js");

function fakeStorage() {
  const data = new Map();
  return {
    async getJson(k) {
      const hit = data.get(k);
      return hit === undefined ? null : JSON.parse(JSON.stringify(hit));
    },
    async putJson(k, v) {
      data.set(k, JSON.parse(JSON.stringify(v)));
      return { pathname: k };
    },
    async putJsonExclusive(k, v) {
      if (data.has(k)) {
        const e = new Error("already_exists");
        e.code = "already_exists";
        throw e;
      }
      data.set(k, JSON.parse(JSON.stringify(v)));
      return { pathname: k };
    },
    async deleteJson(k) {
      data.delete(k);
      return { pathname: k };
    },
    async listJson() {
      return [];
    },
    storageInfo() {
      return { backend: "memory", durable: true };
    },
  };
}

/* The three shapes of intake the product actually builds. */
const KINDS = [
  {
    label: "a studio, weekly",
    clientKind: "coach",
    intake: {
      clientName: "סטודיו",
      population: "adults",
      goals: "general",
      equipment: "functional_gym",
      scheduleMode: "weekly_schedule",
      includeRestDays: true,
      restDays: { fri: true, sat: true },
      sessionsPerWeek: 5,
      monthlyAmount: 900,
      paymentMethod: "bit",
    },
  },
  {
    label: "a studio sold as sessions",
    clientKind: "coach",
    intake: {
      clientName: "שלושה בשבוע",
      population: "adults",
      goals: "general",
      equipment: "functional_gym",
      scheduleMode: "session_count",
      sessionsPerWeek: 3,
      monthlyAmount: 700,
      paymentMethod: "bit",
    },
  },
  {
    label: "an individual",
    clientKind: "athlete",
    intake: {
      clientName: "אינדיבידואל",
      scheduleMode: "weekly_schedule",
      includeRestDays: true,
      restDays: { mon: true, wed: true, fri: true, sat: true },
      sessionsPerWeek: 3,
      population: "Individual athlete",
    },
  },
  {
    label: "a blank client, weekly",
    clientKind: "blank",
    intake: {
      clientName: "ריק",
      scheduleMode: "weekly_schedule",
      includeRestDays: false,
      restDays: {},
      population: "לקוח ריק",
    },
  },
  {
    label: "a blank client sold as four sessions",
    clientKind: "blank",
    intake: {
      clientName: "ריק בארבעה",
      scheduleMode: "session_count",
      sessionsPerWeek: 4,
      includeRestDays: false,
      restDays: {},
      population: "לקוח ריק",
    },
  },
];

async function main() {
  for (const kind of KINDS) {
    const store = Store.createProgramStore(fakeStorage());
    const made = await store.createProgram({
      clientName: kind.intake.clientName,
      clientKind: kind.clientKind,
      weekCount: 4,
      intake: Intake.normalizeIntake(kind.intake),
      blockStart: "2026-09-06",
    });
    ok(kind.label + ": is created", made.ok && made.program.weeks.length >= 4);

    /* Something written by hand on week 1, Sunday — a day every kind has. */
    const wrote = await store.updateProgram(
      made.program.programId,
      made.program.version,
      function (draft) {
        draft.weeks[0].days.sun.parts = [
          { id: "p1", title: "Part A", lines: ["12 min EMOM", "8 thrusters"] },
        ];
        draft.weeks[0].overview = [{ day: "sun", focus: "Engine" }];
        return draft;
      },
      { actor: "owner" }
    );
    ok(kind.label + ": a day can be written", wrote.ok);

    /* --- the day gesture ---------------------------------------------- */

    const dayCopy = await store.copyDay(
      made.program.programId,
      wrote.program.version,
      { week: 1, day: "sun" },
      { week: 2, day: "tue" }
    );
    ok(kind.label + ": a day copies", dayCopy.ok && dayCopy.copiedParts === 1);
    ok(
      kind.label + ": the sessions arrive",
      dayCopy.program.weeks[1].days.tue.parts[0].lines[0] === "12 min EMOM"
    );
    ok(
      kind.label + ": and the focus with them",
      (dayCopy.program.weeks[1].overview || []).filter(function (o) { return o.day === "tue"; })[0].focus === "Engine"
    );

    /* --- the week gesture --------------------------------------------- */

    const weekCopy = await store.copyWeek(
      made.program.programId,
      dayCopy.program.version,
      1,
      3
    );
    ok(kind.label + ": a week copies", weekCopy.ok && weekCopy.copiedDays === 1);
    ok(
      kind.label + ": onto the week asked for",
      weekCopy.program.weeks[2].days.sun.parts[0].lines[1] === "8 thrusters"
    );
    ok(
      kind.label + ": the week it came from is untouched",
      weekCopy.program.weeks[0].days.sun.parts.length === 1
    );

    /* --- and what the client receives --------------------------------- */

    const sent = await store.approveBlock(
      made.program.programId,
      weekCopy.program.version,
      1
    );
    ok(kind.label + ": the block can be sent", sent.ok);
    const view = Payload.programForClient(sent.program);
    ok(
      kind.label + ": the pasted day is on the client's copy",
      view.weeks[1].days.tue.parts[0].lines[0] === "12 min EMOM"
    );
    ok(
      kind.label + ": so is the pasted week",
      view.weeks[2].days.sun.parts[0].lines[1] === "8 thrusters"
    );
    ok(
      kind.label + ": and it is flagged as something new to read",
      Object.keys(sent.program.clientUnreadDays || {}).length > 0
    );
    ok(
      kind.label + ": with nothing of the owner's crossing over",
      view.intake === undefined && view.monthlyAmount === undefined && view.unreadDays === undefined
    );
    /* A programme sold as sessions tells the phone how many columns to draw. */
    if (kind.intake.scheduleMode === "session_count") {
      ok(
        kind.label + ": the phone is told to draw " + kind.intake.sessionsPerWeek + " columns",
        view.sessionColumns === kind.intake.sessionsPerWeek
      );
    } else {
      ok(kind.label + ": a weekly programme draws seven", view.sessionColumns === 0);
    }
  }

  console.log("\nAll copy-across-kinds checks passed (" + passed + " assertions).");
}

main().catch(function (e) {
  console.error("FAIL:", (e && e.stack) || e);
  process.exit(1);
});
