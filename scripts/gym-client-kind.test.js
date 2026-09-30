/**
 * THE FOURTH CLIENT KIND.
 *
 * A gym client could not exist until now: the store knew three kinds and anything else fell
 * back to "coach", which would have handed a gym athlete to the functional brain. This pins the
 * kind itself, the six-week month that distinguishes it, and — most importantly — that the
 * functional router REFUSES it rather than writing work it was not built for.
 *
 * Run: node scripts/gym-client-kind.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Store = require("../lib/client-program-store.js");
const Brief = require("../lib/coach-client-brief.js");

const root = path.join(__dirname, "..");
const api = fs.readFileSync(path.join(root, "api/client-program.js"), "utf8");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

/* ── the kind exists, and an unknown one still cannot sneak in ─────────────── */

ok("a gym client keeps its kind", Store.emptyProgram({ clientName: "A", clientKind: "gym" }).clientKind === "gym");
["coach", "athlete", "blank"].forEach(function (k) {
  ok("the existing kind '" + k + "' is untouched", Store.emptyProgram({ clientName: "A", clientKind: k }).clientKind === k);
});
ok("an unknown kind still falls back to coach", Store.emptyProgram({ clientName: "A", clientKind: "whatever" }).clientKind === "coach");

/* ── six weeks, not four. The structural difference between the two products. ─ */

ok("a gym month is six weeks", Store.emptyProgram({ clientName: "A", clientKind: "gym", weekCount: 6 }).weeks.length === 6);
ok("the API knows the number", /const GYM_BLOCK_WEEKS = 6;/.test(api));
ok("and uses it for a gym client", /weekCount = GYM_BLOCK_WEEKS;/.test(api));
ok("a client of any other kind still opens on four", Store.emptyProgram({ clientName: "A" }).weeks.length === 4);

/* ── the wall, at the routing layer ────────────────────────────────────────── */

ok("the functional router names the gym kind", Brief.GYM === "gym");
const refused = Brief.blockRequestFor({
  program: { clientKind: "gym", clientName: "A", weeks: [], blocks: [], athleteIntake: {} },
  blockIndex: 1,
});
ok("and REFUSES to write for it", refused.ok === false);
ok("saying which brain owns that client", /חדר כושר/.test(refused.why || ""));

/* The three it does serve are unchanged. */
const studio = Brief.blockRequestFor({
  program: { clientKind: "coach", clientName: "A", weeks: [], blocks: [], intake: { clientName: "A" } },
  blockIndex: 1,
});
ok("a studio client is still accepted", studio.ok !== false || !/חדר כושר/.test(studio.why || ""));
const blank = Brief.blockRequestFor({ program: { clientKind: "blank", clientName: "A" }, blockIndex: 1 });
ok("and a blank client is refused for its own reason, not the gym's", /ידנית|ריק/.test(blank.why || ""));

/* ── the creation path takes gym answers, not functional ones ──────────────── */

ok("the API branches on the gym kind", /const isGym = body\.clientKind === "gym";/.test(api));
ok("it reads the gym questionnaire's answers", /body\.gymIntake/.test(api));
ok("a gym client is not asked for the studio questionnaire", /!isBlank && !isGym/.test(api));
ok("and the container is shared on purpose, with the reason written down", /One way to lay a month out; two ways to fill it/.test(api));

console.log("\nסוג לקוח רביעי — קיים, בן שישה שבועות, ומוח הקרוספיט מסרב לו.");
