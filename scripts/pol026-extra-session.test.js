/**
 * POL-026 + Budget gates.
 * Run: node scripts/pol026-extra-session.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  isExplicitPol026Confirm,
  textLooksLikePol026ExtraSession,
  messagesLookLikePol026ExtraSession,
  enforcePol026BrickChatResponse,
  POL026_DEFAULT_CONFIRM,
} = require("../lib/coach-pol026-gates.js");

const root = path.join(__dirname, "..");
const policy = require("../api/coach-policy.js");
const pc = fs.readFileSync(path.join(root, "api/personal-coach.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const rules = fs.readFileSync(
  path.join(root, "experiments/personal-coach/coach-policy-rules.md"),
  "utf8"
);

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

ok("POL-026 in coach-policy.js", /POL-026/.test(policy));
ok("POL-026 in coach-policy-rules.md", /POL-026/.test(rules));
ok("Budget gates in policy", /Budget gates \(HARD\)/.test(rules) || /Budget-approved/.test(policy));
ok("POL-026 in personal-coach brick chat", /POL-026/.test(pc));
ok("enforce helper wired", /enforcePol026BrickChatResponse/.test(pc));
ok("client extraSessions store", /store\.extraSessions/.test(index));
ok("client early remember", /function pprogRememberExtraSession/.test(index));
ok("client local Rest fallback", /function pprogApplyPol026LocalRestTomorrow/.test(index));
ok("ATHLETE_EXTRA_SESSIONS card", /ATHLETE_EXTRA_SESSIONS/.test(pc));

const noteHe =
  "היום ביצעתי אימון במקום יום מנוחה, מחר אני אקח יום מנוחה. Back squat 120kg Deadlift 140kg Amrap pull-up";
ok("detects Hebrew extra session", textLooksLikePol026ExtraSession(noteHe));
ok("כן is confirm", isExplicitPol026Confirm("כן"));
ok("לא is not confirm", !isExplicitPol026Confirm("לא"));
ok(
  "thread detects pol026",
  messagesLookLikePol026ExtraSession([
    { role: "user", text: noteHe },
    { role: "model", text: "Confirm?" },
  ])
);

const pre = enforcePol026BrickChatResponse(
  "I am an AI engine and cannot evaluate physical risks or injuries. Please consult.\n\n<<<WEEK_JSON\n{}\nWEEK_JSON>>>\nLots of equipment questions?",
  { confirmed: false }
);
ok("pre-confirm strips JSON + injury", !/WEEK_JSON/i.test(pre) && !/physical risks/i.test(pre));
ok("pre-confirm has Confirm?", /confirm\?/i.test(pre));
ok("pre-confirm short default when needed", pre.length < 350);

const post = enforcePol026BrickChatResponse(
  "Done.\n<<<BLOCK_JSON\n{\"weeks\":[]}\nBLOCK_JSON>>>\n<<<WEEK_JSON\n{\"days\":{}}\nWEEK_JSON>>>",
  { confirmed: true }
);
ok("post-confirm strips BLOCK", !/BLOCK_JSON/i.test(post));
ok("post-confirm keeps WEEK", /WEEK_JSON/i.test(post));
ok("default confirm constant set", !!POL026_DEFAULT_CONFIRM);

console.log("All POL-026 Budget gate checks passed.");
