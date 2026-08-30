/**
 * POL-028 — athlete span of control.
 * Run: node scripts/coach-athlete-scope.test.js
 *
 * The athlete owns today's session. The brick belongs to the human coach in admin.
 * The point of this file is as much what must KEEP working (intake, plan fills, the
 * day box) as what must stop: a gate that also blocks intake would leave a new
 * athlete with no plan at all.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Scope = require("../lib/coach-athlete-scope.js");

const root = path.join(__dirname, "..");
const pc = fs.readFileSync(path.join(root, "api", "personal-coach.js"), "utf8");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

const DONE = { intakeComplete: true };
const athlete = { isAdmin: false };
const admin = { isAdmin: true };

function gate(action, body, profile, opts) {
  return Scope.evaluateAthleteScopeGate(action, body || {}, profile || DONE, opts || athlete);
}

/* --- Blocked for the athlete ------------------------------------------- */

ok("whole-brick chat is blocked", gate("chat", { brickChat: true }) !== null);
ok("whole-program chat is blocked", gate("chat", { wholeProgramChat: true }) !== null);
ok("week rewrite is blocked", gate("revise_week", {}) !== null);
ok("soft upgrade is blocked", gate("revise_day", { softUpgrade: true }) !== null);
ok("large rebuild is blocked", gate("revise_day", { largeRebuild: true }) !== null);

ok("brick chat reason is named", gate("chat", { brickChat: true }).reason === "brick_chat");
ok("week rewrite reason is named", gate("revise_week", {}).reason === "week_rewrite");
ok("gate carries a stable code", gate("revise_week", {}).code === "ATHLETE_SCOPE_BLOCKED");

/* Brick chat renders in the chat log; programmatic callers get a 403 instead. */
ok("brick chat is chat-shaped", gate("chat", { brickChat: true }).chatShaped === true);
ok("week rewrite is not chat-shaped", gate("revise_week", {}).chatShaped === false);

/* The athlete-facing line points at the day box, and never leaks policy names. */
const msg = gate("chat", { brickChat: true }).text;
ok("message points at the day box", /box under the workout/i.test(msg));
ok("message names the coach as the owner", /your coach/i.test(msg));
ok("message leaks no rule ids", !/POL-|revise_week|brickChat/.test(msg));

/* --- Must KEEP working for the athlete ---------------------------------- */

ok("the day box still works", gate("revise_day", {}) === null);
ok("a single part still works", gate("revise_part", {}) === null);
ok("finish debrief bias still works", gate("finish_micro_bias", {}) === null);

/* Plan fills are machine steps on an approved brick, not conversational reshaping. */
ok("first brick build still works", gate("generate_block", {}) === null);
ok("week generate still works", gate("generate_week", {}) === null);
ok("week detail fill still works", gate("generate_week_detail", {}) === null);

/* Intake is how an athlete gets a plan — never blocked, even brick-shaped. */
ok(
  "intake chat is never blocked (body flag)",
  gate("chat", { brickChat: true, intakeComplete: false }, {}) === null
);
ok(
  "intake chat is never blocked (empty profile)",
  gate("chat", { brickChat: true }, {}) === null
);
ok("start_intake is never blocked", gate("start_intake", {}, {}) === null);

/* --- Admin keeps full reach --------------------------------------------- */

ok("admin may chat about the brick", gate("chat", { brickChat: true }, DONE, admin) === null);
ok("admin may rewrite a week", gate("revise_week", {}, DONE, admin) === null);
ok("admin may run a soft upgrade", gate("revise_day", { softUpgrade: true }, DONE, admin) === null);
ok("admin may run a large rebuild", gate("revise_day", { largeRebuild: true }, DONE, admin) === null);

/* --- Wired into the endpoint, before any provider call ------------------- */

ok("endpoint requires the gate", /require\("\.\.\/lib\/coach-athlete-scope\.js"\)/.test(pc));
ok("endpoint evaluates the gate", /evaluateAthleteScopeGate\(action, body, rawProfile/.test(pc));
ok("gate is passed the verified admin flag", /isAdmin: adminProgramming/.test(pc));
ok("blocked chat returns local-guard", /athleteScopeBlocked: true/.test(pc));

/* Zero AI cost: the gate must sit above the provider dispatch. */
const gateAt = pc.indexOf("evaluateAthleteScopeGate(action, body, rawProfile");
const callAt = pc.indexOf("result = programming");
ok("gate runs before any provider call", gateAt > 0 && callAt > 0 && gateAt < callAt);

/* And above the model-key check, so it costs nothing even with keys present. */
const keyAt = pc.indexOf('error: "Missing AI API key"');
ok("gate runs before the provider-key branch", keyAt > 0 && gateAt < keyAt);

/* --- Non-regression ------------------------------------------------------ */

ok("terms gate still runs", /code: "TERMS_REQUIRED"/.test(pc));
ok("cost caps still run", /costCapHttpPayload\(costGate\)/.test(pc));
ok("programming stays Gemini-only", pc.includes("geminiOnly: true"));

console.log("All POL-028 athlete-scope checks passed.");
