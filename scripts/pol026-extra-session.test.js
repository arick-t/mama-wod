/**
 * POL-026 + brick schedule-revise brief-reply gates.
 * Run: node scripts/pol026-extra-session.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  isExplicitPol026Confirm,
  isScheduleApplyIntent,
  textLooksLikePol026ExtraSession,
  textLooksLikeScheduleRestShift,
  messagesLookLikePol026ExtraSession,
  messagesLookLikeBrickScheduleRevise,
  enforcePol026BrickChatResponse,
  enforceBrickScheduleChatResponse,
  parseBrickScheduleIntent,
  buildBrickScheduleConfirmMessage,
  buildLoggedSessionPartsFromNote,
  extractLoggedWorkoutSegments,
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
ok("parse intent wired server", /parseBrickScheduleIntent/.test(pc));
ok("brick schedule revise detection wired", /messagesLookLikeBrickScheduleRevise/.test(pc));
ok("forbidden AI intro in brick prompt", /I am an AI engine/.test(pc));
ok("post-apply Hebrew in prompt", /BRICK_SCHEDULE_POST_APPLY_MSG/.test(pc));
ok("extract JSON before Done display", /Extract plan JSON from raw model text BEFORE/.test(pc));
ok("client extraSessions store", /store\.extraSessions/.test(index));
ok("client early remember", /function pprogRememberExtraSession/.test(index));
ok("client calendar truth", /function pprogApplyPol026CalendarTruth/.test(index));
ok("client schedule intent parser", /function pprogParseBrickScheduleIntent/.test(index));
ok("client dynamic pre-confirm", /function pprogBrickSchedulePreConfirmMsg/.test(index));
ok("client logged session builder", /function pprogBuildLoggedSessionParts/.test(index));
ok("loggedExtra survives normalize", /loggedExtraSession/.test(index) && /POL-026: logged extra session must survive/.test(index));
ok("loggedExtra not Rest", /pprogDayIsLoggedExtraSession/.test(index) && /athlete-logged session wins/.test(index));
ok("week_detail preserves logged day", /week_detail must never wipe an athlete-logged/.test(index));
ok("calendar logged-extra class", /logged-extra/.test(index) && /pprog-logged-extra-flag/.test(index));
ok("coach version 2.3.10", /COACH_VERSION = "2\.3\.10"/.test(index) && /COACH_VERSION = "2\.3\.10"/.test(pc));
ok("client workout extract", /pprogExtractLoggedWorkoutSegments/.test(index));
ok("client preserve days", /pprogCaptureSchedulePreserveDays/.test(index));
ok("client Hebrew post-apply", /PPROG_BRICK_SCHEDULE_POST_APPLY_MSG/.test(index));
ok("client schedule rest-shift detect", /pprogNoteIsScheduleRestShift/.test(index));
ok("client brickSchedulePending store", /brickSchedulePending/.test(index));
ok("client local schedule apply", /pprogApplyBrickScheduleLocal/.test(index));
ok("client תממש apply intent", /pprogIsScheduleApplyIntent/.test(index));
ok("client pending rehydrate", /pprogRehydrateBrickSchedulePending/.test(index));
ok("server brickSchedulePending flag", /brickSchedulePending/.test(pc));
ok("server scheduleNote gate opts", /scheduleNote/.test(pc));
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
ok("תממש את השינויים is apply intent", isScheduleApplyIntent("תממש את השינויים שביקשתי"));
ok("לא is not apply intent", !isScheduleApplyIntent("לא"));
ok(
  "thread detects pol026",
  messagesLookLikePol026ExtraSession([
    { role: "user", text: noteHe },
    { role: "model", text: "Confirm?" },
  ])
);

const userScenarioLong =
  "בסוף יצא שהיום כן התאמנתי / אני צריך יום מנוחה ביום שישי ולהשאיר את האימון של מחר כרגיל / לאחר מכן יום המנוחה הבא יהיה יום שלישי בשבוע הבא";
const userScenarioShort =
  "היום היה אימון / מחר אימון לפי לו״ז רגיל / מחרתיים יום שישי יום מנוחה / יום מנוחה שלאחריו יהיה בשלישי הבא";
const todayIso = "2026-08-12";

const intentLong = parseBrickScheduleIntent(userScenarioLong, { todayIso: todayIso });
ok("long scenario keeps tomorrow", intentLong.tomorrowAction === "keep");
ok("long scenario rest includes Friday", intentLong.restDays.indexOf("2026-08-14") >= 0);
ok("long scenario rest includes next Tuesday", intentLong.restDays.indexOf("2026-08-18") >= 0);
ok("long scenario does not rest tomorrow", intentLong.restDays.indexOf("2026-08-13") < 0);

const intentShort = parseBrickScheduleIntent(userScenarioShort, { todayIso: todayIso });
ok("short scenario keeps tomorrow", intentShort.tomorrowAction === "keep");
ok("short scenario rest Friday", intentShort.restDays.indexOf("2026-08-14") >= 0);
ok("short scenario rest next Tuesday", intentShort.restDays.indexOf("2026-08-18") >= 0);
ok("short scenario detects schedule thread", textLooksLikeScheduleRestShift(userScenarioShort));

const preHe = buildBrickScheduleConfirmMessage(intentShort, {
  note: userScenarioShort,
  todayIso: todayIso,
});
ok("Hebrew pre-confirm for short scenario", /לוז:/.test(preHe));
ok("Hebrew pre-confirm mentions keep tomorrow", /מחר אימון לפי לוח רגיל/.test(preHe));
ok("Hebrew pre-confirm mentions Friday rest", /שישי/.test(preHe));
ok("Hebrew pre-confirm asks לאשר", /לאשר\?/.test(preHe));
ok("Hebrew pre-confirm does not say rest tomorrow", !/מחר מנוחה/.test(preHe));

const essay =
  "I am an AI engine and I will assist you with your workout schedule. " +
  "Your schedule has been updated accordingly. You will have a rest day on Friday.";
const pre = enforcePol026BrickChatResponse(essay + "\n<<<WEEK_JSON\n{}\nWEEK_JSON>>>", {
  confirmed: false,
  scheduleNote: userScenarioShort,
  todayIso: todayIso,
});
ok("pre-confirm ignores essays", pre === preHe);
ok("pre-confirm has confirm question", /לאשר\?|confirm\?/i.test(pre));

const post = enforceBrickScheduleChatResponse(
  essay + "\n<<<WEEK_JSON\n{\"days\":{}}\nWEEK_JSON>>>",
  { confirmed: true }
);
ok("post-confirm is verify-in-block Hebrew", post === BRICK_SCHEDULE_POST_APPLY_MSG);
ok("default confirm constant set", !!POL026_DEFAULT_CONFIRM);

const userWorkoutNote =
  "בסוף יצא שהיום כן התאמנתי / האימון / 15 דקות ריצת פארטלג 6 סטים של דקה מהר דקה קל / אח״כ קומפלקס כבד של / Power clean / front squat / power jerk / jerk / עשיתי מזה 6 סיבובים / אני צריך אם ככה יום מנוחה ביום שישי ולהשאיר את האימון של מחר כרגיל / לאחר מכן יום המנוחה הבא יהיה יום שלישי בשבוע הבא / נא סדר את זה בהתאם";
const workoutSegs = extractLoggedWorkoutSegments(userWorkoutNote);
ok("workout extract strips schedule tail", workoutSegs.indexOf("נא סדר את זה בהתאם") < 0);
ok("workout extract keeps fartlek", workoutSegs.some(function (s) { return /פארטלג/.test(s); }));
const builtLogged = buildLoggedSessionPartsFromNote("wed", userWorkoutNote);
ok("logged parts split engine + complex", builtLogged.parts.length >= 2);
ok("logged complex joins movements", /Power clean \+ front squat/.test(builtLogged.parts[1].lines[0]));
ok("logged complex has rounds", /6\s*סיבובים/.test(builtLogged.parts[1].lines.join(" ")));

console.log("All POL-026 / brick schedule brief-reply checks passed.");
