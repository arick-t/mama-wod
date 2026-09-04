/**
 * A blank client, as their phone sees them.
 * Run: node scripts/client-view-blank.test.js
 *
 * The owner asked for one last check before this ships: that a client created with
 * four questions and an empty month opens correctly on a phone (owner, 2026-09-04).
 *
 * What a test can prove is asserted here by BUILDING a blank programme, sending it
 * through the payload the client actually receives, and rendering it with the same
 * library client.html uses: every day present, not one of them a rest day, an empty
 * day that says it is empty rather than breaking, a written day that shows what was
 * written, and a six-week block that arrives as six. Plus the page's own mobile
 * furniture — the viewport, and a calendar that scrolls instead of overflowing.
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

const root = path.join(__dirname, "..");
const Store = require("../lib/client-program-store.js");
const Payload = require("../lib/client-view-payload.js");
const Display = require("../lib/pprog-display.js");
const Intake = require("../lib/client-intake.js");

/* The intake the server builds for this kind: no rest days, no deload. */
function blankIntake(name) {
  return Intake.normalizeIntake({
    clientName: name,
    scheduleMode: "weekly_schedule",
    includeRestDays: false,
    restDays: {},
    deloadWeek: false,
    deloadEveryWeeks: 0,
    population: "לקוח ריק",
  });
}

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

async function main() {
  const store = Store.createProgramStore(fakeStorage());
  const made = await store.createProgram({
    clientName: "דני",
    clientKind: "blank",
    weekCount: 6,
    intake: blankIntake("דני"),
    blockStart: "2026-09-06",
  });
  ok("a blank client is built", made.ok && made.program.weeks.length === 6);

  /* One day written by hand, the way he will actually use it. */
  const wrote = await store.updateProgram(
    made.program.programId,
    made.program.version,
    function (draft) {
      draft.weeks[0].days.mon.parts = [
        { id: "p1", title: "Part A", lines: ["5 rounds", "10 push-ups", "200m run"] },
      ];
      return draft;
    },
    { actor: "owner" }
  );
  ok("a day can be written", wrote.ok);

  const sent = await store.approveBlock(made.program.programId, wrote.program.version, 1);
  ok("and the block sent", sent.ok);

  /* --- what actually crosses to the phone -------------------------------- */

  const view = Payload.programForClient(sent.program);
  ok("the client receives all six weeks", view.weeks.length === 6);
  ok("as one block of six", (view.blockGroups || []).length === 1 && view.blockGroups[0].weekCount === 6);
  ok("with no payment terms", view.monthlyAmount === undefined && view.paymentMethod === undefined);
  ok("no gender", view.clientGender === undefined);
  ok("and no intake", view.intake === undefined && view.athleteIntake === undefined);
  ok("every week carries its seven days", view.weeks.every(function (w) { return Object.keys(w.days).length === 7; }));

  /* --- rendered the way client.html renders it --------------------------- */

  const block = { weeks: view.weeks, blockStart: view.blockStart };
  const html = Display.renderBrickView({
    block: block,
    store: view,
    activeWi: 0,
    activeDay: "mon",
    calMode: "month",
    showFooter: false,
    blockGroups: view.blockGroups,
  });
  ok("the month renders", typeof html === "string" && html.length > 500);
  ok("every day of the month is a cell", (html.match(/data-day="/g) || []).length >= 42);
  ok("what was written is on the day", html.indexOf("10 push-ups") >= 0);
  ok(
    "an empty day is empty, not broken",
    html.indexOf("undefined") < 0 && html.indexOf("[object Object]") < 0
  );
  /* The point of the kind: nothing is pre-marked as a rest day. */
  ok("no day is presented as a rest day", (html.match(/pprog-rest|REST DAY/gi) || []).length === 0);
  ok("and no week is a deload", (html.match(/deload-week/g) || []).length === 0);

  const sixCols = Display.renderBrickView({
    block: block,
    store: view,
    activeWi: 0,
    activeDay: "general",
    calMode: "month",
    showFooter: false,
    blockGroups: view.blockGroups,
  });
  ok("all six weeks are reachable in the rail", (sixCols.match(/data-week="/g) || []).length === 6);

  /* --- the phone itself --------------------------------------------------- */

  const page = fs.readFileSync(path.join(root, "client.html"), "utf8");
  ok("the page scales to the device", /<meta name="viewport"[^>]*width=device-width/.test(page));
  ok("and allows a pinch, rather than locking zoom", !/user-scalable=no/.test(page));
  ok("it carries the safe-area inset for a notched phone", /safe-area-inset/.test(page));
  const css = fs.readFileSync(path.join(root, "styles", "pprog-display.css"), "utf8");
  ok("a wide calendar scrolls instead of overflowing", /overflow-x:\s*auto/.test(css));
  ok("and the layout has a phone breakpoint", /@media\s*\(max-width:\s*(719|640)px\)/.test(css));
  ok("the client page is the styled copy, not a bare one", /pprog-display\.css/.test(page));

  /* A phone is where a client reads a plan and where the owner is not standing. */
  ok("the page still holds no route to a provider", !/gemini|groq|generativelanguage/i.test(page));

  console.log("\nAll blank-client client-view checks passed (" + passed + " assertions).");
}

main().catch(function (e) {
  console.error("FAIL:", (e && e.stack) || e);
  process.exit(1);
});
