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
ok("extract JSON before Done display", /Extract plan JSON from raw model text BEFORE/.test(pc));
ok("client extraSessions store", /store\.extraSessions/.test(index));
ok("client early remember", /function pprogRememberExtraSession/.test(index));
ok("client calendar truth", /function pprogApplyPol026CalendarTruth/.test(index));
ok("client logged session builder", /function pprogBuildLoggedSessionParts/.test(index));
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

const essay =
  "I'll adjust the schedule accordingly, taking into account the intense workout. " +
  "Let's review Thursday Friday Saturday. Confirm your availability?";
const pre = enforcePol026BrickChatResponse(essay + "\n<<<WEEK_JSON\n{}\nWEEK_JSON>>>", {
  confirmed: false,
});
ok("pre-confirm ignores essays", pre === POL026_DEFAULT_CONFIRM);
ok("pre-confirm has Confirm?", /confirm\?/i.test(pre));

const post = enforcePol026BrickChatResponse(
  "I'll adjust remaining sessions...\n<<<WEEK_JSON\n{\"days\":{}}\nWEEK_JSON>>>\nDone.",
  { confirmed: true }
);
ok("post-confirm is only Done", post === "Done.");
ok("default confirm constant set", !!POL026_DEFAULT_CONFIRM);

console.log("All POL-026 Budget gate checks passed.");
