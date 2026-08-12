/**
 * POL-026 + brick schedule-revise brief-reply gates.
 * Run: node scripts/pol026-extra-session.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  isExplicitPol026Confirm,
  textLooksLikePol026ExtraSession,
  textLooksLikeScheduleRestShift,
  messagesLookLikePol026ExtraSession,
  messagesLookLikeBrickScheduleRevise,
  enforcePol026BrickChatResponse,
  enforceBrickScheduleChatResponse,
  POL026_DEFAULT_CONFIRM,
  BRICK_SCHEDULE_POST_APPLY_MSG,
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
ok("enforce helper wired", /enforceBrickScheduleChatResponse/.test(pc));
ok("brick schedule revise detection wired", /messagesLookLikeBrickScheduleRevise/.test(pc));
ok("forbidden AI intro in brick prompt", /I am an AI engine/.test(pc));
ok("post-apply Hebrew in prompt", /BRICK_SCHEDULE_POST_APPLY_MSG/.test(pc));
ok("extract JSON before Done display", /Extract plan JSON from raw model text BEFORE/.test(pc));
ok("client extraSessions store", /store\.extraSessions/.test(index));
ok("client early remember", /function pprogRememberExtraSession/.test(index));
ok("client calendar truth", /function pprogApplyPol026CalendarTruth/.test(index));
ok("client logged session builder", /function pprogBuildLoggedSessionParts/.test(index));
ok("loggedExtra survives normalize", /loggedExtraSession/.test(index) && /POL-026: logged extra session must survive/.test(index));
ok("loggedExtra not Rest", /pprogDayIsLoggedExtraSession/.test(index) && /athlete-logged session wins/.test(index));
ok("week_detail preserves logged day", /week_detail must never wipe an athlete-logged/.test(index));
ok("calendar logged-extra class", /logged-extra/.test(index) && /pprog-logged-extra-flag/.test(index));
ok("coach version 2.3.7", /COACH_VERSION = "2\.3\.7"/.test(index) && /COACH_VERSION = "2\.3\.7"/.test(pc));
ok("client Hebrew post-apply", /PPROG_BRICK_SCHEDULE_POST_APPLY_MSG/.test(index));
ok("client schedule rest-shift detect", /pprogNoteIsScheduleRestShift/.test(index));
ok("ATHLETE_EXTRA_SESSIONS card", /ATHLETE_EXTRA_SESSIONS/.test(pc));

const noteHe =
  "היום ביצעתי אימון במקום יום מנוחה, מחר אני אקח יום מנוחה. Back squat 120kg Deadlift 140kg Amrap pull-up";
ok("detects Hebrew extra session", textLooksLikePol026ExtraSession(noteHe));

const noteEnNoWod =
  "I already worked out today on a rest day. I need rest tomorrow and adjust the rest of the week.";
ok("detects worked-out rest shift without WOD list", textLooksLikePol026ExtraSession(noteEnNoWod));
ok("schedule rest-shift helper", textLooksLikeScheduleRestShift(noteEnNoWod));
ok(
  "brick schedule thread detects rest shift",
  messagesLookLikeBrickScheduleRevise([{ role: "user", text: noteEnNoWod }])
);

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
  "I am an AI engine and I will assist you with your workout schedule. " +
  "Your schedule has been updated accordingly. You will have a rest day on Friday.";
const pre = enforcePol026BrickChatResponse(essay + "\n<<<WEEK_JSON\n{}\nWEEK_JSON>>>", {
  confirmed: false,
});
ok("pre-confirm ignores essays", pre === POL026_DEFAULT_CONFIRM);
ok("pre-confirm has Confirm?", /confirm\?/i.test(pre));

const post = enforceBrickScheduleChatResponse(
  essay + "\n<<<WEEK_JSON\n{\"days\":{}}\nWEEK_JSON>>>",
  { confirmed: true }
);
ok("post-confirm is verify-in-block Hebrew", post === BRICK_SCHEDULE_POST_APPLY_MSG);
ok("default confirm constant set", !!POL026_DEFAULT_CONFIRM);

console.log("All POL-026 / brick schedule brief-reply checks passed.");
