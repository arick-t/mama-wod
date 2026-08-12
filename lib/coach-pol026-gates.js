/**
 * POL-026 + brick schedule-revise brief-reply gates — pure helpers.
 * Whole-brick rest-shift / extra-session chat must never return model essays.
 */
const POL026_DEFAULT_CONFIRM =
  "Schedule: keep today's session logged, rest tomorrow, ease squat/hinge/engine later this week. Confirm?";

/** Athlete-facing line after Confirm + apply — verify in calendar, not a change recap. */
const BRICK_SCHEDULE_POST_APPLY_MSG = "בוצעו השינויים נא לוודא בבלוק האימון";

const POL026_EXPLICIT_CONFIRM_RE =
  /^(yes|yep|yeah|ok|okay|sure|confirm|do it|go ahead|כן|בטח|אשר|תבצע|יאללה)[.!\s]*$/i;

const SCHEDULE_APPLY_INTENT_RE =
  /^(תממש|ממש|יישם|יישום|בצע|ביצוע|קדימה|עשה\s*זאת)(\s|$|[.!])|תממש\s*(את\s*)?(ה)?שינויים|בצע\s*(את\s*)?(ה)?שינויים|ממש\s*(את\s*)?(ה)?שינויים|implement\s*(the\s*)?changes|apply\s*(the\s*)?changes|execute\s*(the\s*)?changes|make\s*(the\s*)?changes/i;

const TRAINED_ON_REST_RE =
  /\b(instead\s*of\s*(a\s*)?rest|skipped\s*rest|unplanned|spontaneous|worked\s*out|trained\s*(today|on)|i\s*(already\s*)?(did|trained|performed|worked)|already\s*(worked|trained)|on\s*a\s*rest\s*day)\b|במקום\s*יום\s*מנוחה|דילג(תי)?\s*על\s*(יום\s*)?מנוחה|ביצעתי\s*אימון|האימון\s*שביצעתי|התאמנתי|אימון\s*היום/i;

const LOAD_OR_SCHEDULE_SHIFT_RE =
  /\b(squat|deadlift|amrap|emom|pull-?up|run|row|bike|press|clean|snatch|\d+\s*x\s*\d+|\d+\s*kg|rest\s*day|rest\s*tomorrow|adjust|shift|schedule|tomorrow|today)\b|סקוואט|דדליפט|משיכות|ריצה|ק\"?ג|קילו|יום\s*מנוחה|מחר\s*.{0,24}מנוחה|היום|לו"ז|לוח\s*אימונים/i;

const SCHEDULE_REST_SHIFT_RE =
  /\b(rest\s*days?|training\s*days?|schedule|active\s*recovery|instead\s*of\s*(a\s*)?rest|skipped\s*rest|unplanned|spontaneous|worked\s*out|trained\s*today|adjust|shift)\b|ימי\s*מנוחה|יום\s*מנוחה|ימי\s*אימון|לוח\s*אימונים|מנוחה\s*ב|תוסיף\s*מנוחה|תוריד\s*מנוחה|שנה\s*את\s*(ה)?ימי|מחר\s*.{0,24}מנוחה|במקום\s*יום\s*מנוחה|דילג(תי)?\s*על\s*(יום\s*)?מנוחה|ביצעתי\s*אימון|התאמנתי/i;

function isExplicitPol026Confirm(text) {
  return POL026_EXPLICIT_CONFIRM_RE.test(String(text || "").trim());
}

/** Confirm (כן) or implement (תממש את השינויים…) — apply calendar, never re-ask. */
function isScheduleApplyIntent(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  if (isExplicitPol026Confirm(t)) return true;
  return SCHEDULE_APPLY_INTENT_RE.test(t);
}

function textLooksLikePol026ExtraSession(text) {
  const t = String(text || "");
  if (!TRAINED_ON_REST_RE.test(t)) return false;
  return LOAD_OR_SCHEDULE_SHIFT_RE.test(t);
}

function textLooksLikeScheduleRestShift(text) {
  const t = String(text || "");
  if (!SCHEDULE_REST_SHIFT_RE.test(t)) return false;
  return (
    TRAINED_ON_REST_RE.test(t) ||
    /\b(rest\s*tomorrow|tomorrow\s*.{0,20}rest|shift|adjust|מחר\s*.{0,24}מנוחה|היום\s*.{0,24}מנוחה)\b/i.test(t)
  );
}

function messagesLookLikePol026ExtraSession(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0 && i >= list.length - 24; i--) {
    const m = list[i];
    if (!m || m.role !== "user") continue;
    const t = String(m.text || "").trim();
    if (!t || isScheduleApplyIntent(t)) continue;
    if (textLooksLikePol026ExtraSession(t)) return true;
  }
  return false;
}

/** Broader brick schedule-revise thread — POL-026 extra session OR rest-day shift without exercise list. */
function messagesLookLikeBrickScheduleRevise(messages) {
  if (messagesLookLikePol026ExtraSession(messages)) return true;
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0 && i >= list.length - 24; i--) {
    const m = list[i];
    if (!m || m.role !== "user") continue;
    const t = String(m.text || "").trim();
    if (!t || isScheduleApplyIntent(t)) continue;
    if (textLooksLikeScheduleRestShift(t)) return true;
  }
  return false;
}

function stripAllProgrammingJsonMarkers(text) {
  return String(text || "")
    .replace(/<<<\s*BLOCK_JSON[\s\S]*?(?:BLOCK_JSON>>>|$)/gi, "")
    .replace(/<<<\s*WEEK_JSON[\s\S]*?(?:WEEK_JSON>>>|$)/gi, "")
    .replace(/<<<\s*DAY_JSON[\s\S]*?(?:DAY_JSON>>>|$)/gi, "")
    .replace(/<<<\s*PART_JSON[\s\S]*?(?:PART_JSON>>>|$)/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripBlockJsonMarkers(text) {
  return String(text || "")
    .replace(/<<<\s*BLOCK_JSON[\s\S]*?(?:BLOCK_JSON>>>|$)/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Budget-approved brief gates — athlete-facing text only.
 * - pre-confirm: ALWAYS the short Confirm? line (no model essays / AI intros)
 * - post-confirm: ALWAYS verify-in-block line (no change recap)
 */
function enforcePol026BrickChatResponse(text, opts) {
  const confirmed = !!(opts && opts.confirmed);
  if (!confirmed) return POL026_DEFAULT_CONFIRM;
  return BRICK_SCHEDULE_POST_APPLY_MSG;
}

/** Alias — same gate for all brick schedule-revise threads. */
function enforceBrickScheduleChatResponse(text, opts) {
  return enforcePol026BrickChatResponse(text, opts);
}

module.exports = {
  POL026_DEFAULT_CONFIRM,
  BRICK_SCHEDULE_POST_APPLY_MSG,
  isExplicitPol026Confirm,
  isScheduleApplyIntent,
  textLooksLikePol026ExtraSession,
  textLooksLikeScheduleRestShift,
  messagesLookLikePol026ExtraSession,
  messagesLookLikeBrickScheduleRevise,
  stripAllProgrammingJsonMarkers,
  stripBlockJsonMarkers,
  enforcePol026BrickChatResponse,
  enforceBrickScheduleChatResponse,
};
