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
  /\b(instead\s*of\s*(a\s*)?rest|skipped\s*rest|unplanned|spontaneous|worked\s*out|trained\s*(today|on)|i\s*(already\s*)?(did|trained|performed|worked)|already\s*(worked|trained)|on\s*a\s*rest\s*day)\b|במקום\s*יום\s*מנוחה|דילג(תי)?\s*על\s*(יום\s*)?מנוחה|ביצעתי\s*אימון|האימון\s*שביצעתי|התאמנתי|אימון\s*היום|היום\s*(כן\s*)?(היה\s*)?(אימון|התאמנתי|ביצעתי)|בסוף\s*יצא\s*שהיום/i;

const LOAD_OR_SCHEDULE_SHIFT_RE =
  /\b(squat|deadlift|amrap|emom|pull-?up|run|row|bike|press|clean|snatch|\d+\s*x\s*\d+|\d+\s*kg|rest\s*day|rest\s*tomorrow|adjust|shift|schedule|tomorrow|today)\b|סקוואט|דדליפט|משיכות|ריצה|ק\"?ג|קילו|יום\s*מנוחה|מחר\s*.{0,24}מנוחה|היום|לו"ז|לוח\s*אימונים|מחר\s*.{0,40}(כרגיל|רגיל|לפי)|יום\s*שישי|שלישי|מחרתיים/i;

const SCHEDULE_REST_SHIFT_RE =
  /\b(rest\s*days?|training\s*days?|schedule|active\s*recovery|instead\s*of\s*(a\s*)?rest|skipped\s*rest|unplanned|spontaneous|worked\s*out|trained\s*today|adjust|shift)\b|ימי\s*מנוחה|יום\s*מנוחה|ימי\s*אימון|לוח\s*אימונים|מנוחה\s*ב|תוסיף\s*מנוחה|תוריד\s*מנוחה|שנה\s*את\s*(ה)?ימי|מחר\s*.{0,24}מנוחה|במקום\s*יום\s*מנוחה|דילג(תי)?\s*על\s*(יום\s*)?מנוחה|ביצעתי\s*אימון|התאמנתי|מחר\s*.{0,40}(כרגיל|רגיל|לפי)|יום\s*שישי|שלישי|מחרתיים/i;

const HEB_DAY_INDEX = {
  ראשון: 0,
  שני: 1,
  שלישי: 2,
  רביעי: 3,
  חמישי: 4,
  שישי: 5,
  שבת: 6,
};

const EN_DAY_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const HEB_DAY_LABEL = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const EN_DAY_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseIsoDate(iso) {
  const parts = String(iso || "").slice(0, 10).split("-");
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function formatIsoDate(dt) {
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return yy + "-" + mm + "-" + dd;
}

function addDaysIso(iso, n) {
  const dt = parseIsoDate(iso);
  dt.setDate(dt.getDate() + Number(n || 0));
  return formatIsoDate(dt);
}

function sundayOfWeekIso(iso) {
  const dt = parseIsoDate(iso);
  dt.setDate(dt.getDate() - dt.getDay());
  return formatIsoDate(dt);
}

function resolveWeekdayIso(fromIso, dayIndex, mode) {
  const fromDay = parseIsoDate(fromIso).getDay();
  if (mode === "next_week") {
    const weekStart = parseIsoDate(sundayOfWeekIso(fromIso));
    weekStart.setDate(weekStart.getDate() + 7 + dayIndex);
    return formatIsoDate(weekStart);
  }
  let delta = dayIndex - fromDay;
  if (delta <= 0) delta += 7;
  return addDaysIso(fromIso, delta);
}

function noteLooksHebrew(text) {
  return /[\u0590-\u05FF]/.test(String(text || ""));
}

function uniqSortedIsos(list) {
  const seen = {};
  const out = [];
  for (const iso of list || []) {
    const k = String(iso || "").slice(0, 10);
    if (!k || seen[k]) continue;
    seen[k] = true;
    out.push(k);
  }
  return out.sort();
}

/**
 * Parse athlete schedule-revise intent from a brick note (Hebrew or English).
 * @returns {{ logToday: boolean, tomorrowAction: 'keep'|'rest'|'unset', restDays: string[], easeForward: boolean }}
 */
function parseBrickScheduleIntent(noteText, opts) {
  opts = opts || {};
  const todayIso = String(opts.todayIso || formatIsoDate(new Date())).slice(0, 10);
  const tomorrowIso = addDaysIso(todayIso, 1);
  const t = String(noteText || "");
  const lower = t.toLowerCase();

  const logToday =
    TRAINED_ON_REST_RE.test(t) ||
    /\b(i\s*(already\s*)?(did|trained|worked)|worked\s*out\s*today|trained\s*today)\b/i.test(t);

  let tomorrowAction = "unset";
  const keepTomorrowHe =
    /מחר\s*.{0,48}(כרגיל|לפי\s*ל(?:ו"ז|וח)|רגיל|אימון\s*לפי|לא\s*מנוחה)/i.test(t) ||
    /.{0,24}מחר.{0,24}(כרגיל|לפי\s*ל(?:ו"ז|וח)|רגיל)/i.test(t) ||
    /להשאיר\s*(את\s*)?(ה)?אימון.{0,16}מחר/i.test(t) ||
    /מחר\s*אימון/i.test(t);
  const restTomorrowHe =
    /מחר\s*(?:אני\s*)?(?:אקח\s*)?(?:יום\s*)?מנוחה/i.test(t) ||
    (/מחר\s*.{0,10}מנוחה/i.test(t) && !/כרגיל|רגיל|לפי\s*ל/i.test(t));
  const keepTomorrowEn =
    /\btomorrow\b.{0,40}\b(as\s*normal|regular(?:ly)?|scheduled|workout|training)\b/i.test(t) ||
    /\bkeep\s*tomorrow/i.test(t);
  const restTomorrowEn = /\btomorrow\b.{0,20}\brest\b/i.test(t) || /\brest\s*tomorrow\b/i.test(t);

  if (keepTomorrowHe || keepTomorrowEn) {
    tomorrowAction = "keep";
  } else if (restTomorrowHe || restTomorrowEn) {
    tomorrowAction = "rest";
  }

  const restDays = [];

  if (/מחרתיים.{0,40}מנוחה/i.test(t) || /day\s*after\s*tomorrow.{0,20}rest/i.test(lower)) {
    restDays.push(addDaysIso(todayIso, 2));
  }

  const mentionsRest = /מנוחה/i.test(t) || /\brest\b/i.test(lower);
  const hebDayPatterns = [
    { re: /יום\s*שישי|(^|[^\u0590-\u05FF])שישי([^\u0590-\u05FF]|$)/, idx: 5 },
    { re: /יום\s*שבת|(^|[^\u0590-\u05FF])שבת([^\u0590-\u05FF]|$)/, idx: 6 },
    { re: /יום\s*ראשון|(^|[^\u0590-\u05FF])ראשון([^\u0590-\u05FF]|$)/, idx: 0 },
    { re: /יום\s*שני|(^|[^\u0590-\u05FF])שני([^\u0590-\u05FF]|$)/, idx: 1 },
    { re: /יום\s*שלישי|(?:^|[^\u0590-\u05FF])(?:ב)?שלישי([^\u0590-\u05FF]|$)/, idx: 2 },
    { re: /יום\s*רביעי|(^|[^\u0590-\u05FF])רביעי([^\u0590-\u05FF]|$)/, idx: 3 },
    { re: /יום\s*חמישי|(^|[^\u0590-\u05FF])חמישי([^\u0590-\u05FF]|$)/, idx: 4 },
  ];

  if (mentionsRest) {
    for (const pat of hebDayPatterns) {
      if (!pat.re.test(t)) continue;
      const nextWeek =
        pat.idx === 2 && /(?:יום\s*)?(?:ב)?שלישי.{0,16}(?:שבוע\s*הבא|הבא)/i.test(t);
      restDays.push(resolveWeekdayIso(todayIso, pat.idx, nextWeek ? "next_week" : "next"));
    }
  }

  for (const [name, idx] of Object.entries(EN_DAY_INDEX)) {
    const re = new RegExp("\\b" + name + "\\b.{0,24}\\brest\\b|\\brest\\b.{0,24}\\b" + name + "\\b", "i");
    if (re.test(lower)) {
      const nextWeek = new RegExp("\\bnext\\s+" + name + "\\b|" + name + "\\s+next\\s+week", "i").test(lower);
      restDays.push(resolveWeekdayIso(todayIso, idx, nextWeek ? "next_week" : "next"));
    }
  }

  if (tomorrowAction === "rest") restDays.push(tomorrowIso);

  if (!restDays.length && tomorrowAction === "unset" && logToday) {
    restDays.push(tomorrowIso);
    tomorrowAction = "rest";
  }

  let restUnique = uniqSortedIsos(restDays).filter(function (iso) {
    return iso !== todayIso;
  });
  if (tomorrowAction === "keep") {
    restUnique = restUnique.filter(function (iso) {
      return iso !== tomorrowIso;
    });
  }

  return {
    logToday: !!logToday,
    tomorrowAction: tomorrowAction,
    restDays: restUnique,
    easeForward: !!logToday,
  };
}

function isoToHebDayLabel(iso) {
  const idx = parseIsoDate(iso).getDay();
  return HEB_DAY_LABEL[idx] || iso;
}

function isoToEnDayLabel(iso) {
  const idx = parseIsoDate(iso).getDay();
  return EN_DAY_LABEL[idx] || iso;
}

function buildBrickScheduleConfirmMessage(intent, opts) {
  opts = opts || {};
  const note = String((opts && opts.note) || "");
  const hebrew = opts.hebrew != null ? !!opts.hebrew : noteLooksHebrew(note);
  const intentSafe = intent || {
    logToday: true,
    tomorrowAction: "rest",
    restDays: [],
    easeForward: true,
  };

  if (hebrew) {
    const parts = [];
    if (intentSafe.logToday) parts.push("לשמור את אימון היום כמבוצע");
    if (intentSafe.tomorrowAction === "keep") parts.push("מחר אימון לפי לוח רגיל");
    else if (intentSafe.tomorrowAction === "rest") parts.push("מחר מנוחה");
    if (intentSafe.restDays && intentSafe.restDays.length) {
      const dayLabels = intentSafe.restDays
        .filter(function (iso) {
          return intentSafe.tomorrowAction !== "rest" || iso !== addDaysIso(String(opts.todayIso || "").slice(0, 10), 1);
        })
        .map(function (iso) {
          return "יום " + isoToHebDayLabel(iso);
        });
      if (dayLabels.length) parts.push("מנוחה ב" + dayLabels.join(" וב"));
    }
    if (intentSafe.easeForward) parts.push("הקלה קלה בסקוואט/ציר/מנוע בשאר השבוע");
    return "לוז: " + parts.join(", ") + ". לאשר?";
  }

  const enParts = [];
  if (intentSafe.logToday) enParts.push("keep today's session logged");
  if (intentSafe.tomorrowAction === "keep") enParts.push("keep tomorrow's workout as scheduled");
  else if (intentSafe.tomorrowAction === "rest") enParts.push("rest tomorrow");
  if (intentSafe.restDays && intentSafe.restDays.length) {
    const labels = intentSafe.restDays.map(function (iso) {
      return isoToEnDayLabel(iso);
    });
    enParts.push("rest on " + labels.join(" and "));
  }
  if (intentSafe.easeForward) enParts.push("ease squat/hinge/engine later this week");
  return "Schedule: " + enParts.join(", ") + ". Confirm?";
}

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
    /\b(rest\s*tomorrow|tomorrow\s*.{0,20}rest|shift|adjust|מחר\s*.{0,24}מנוחה|מחר\s*.{0,40}(כרגיל|רגיל|לפי)|יום\s*שישי|שלישי|מחרתיים|היום\s*.{0,24}מנוחה)\b/i.test(
      t
    )
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
 * - pre-confirm: parsed Confirm? line (no model essays / AI intros)
 * - post-confirm: ALWAYS verify-in-block line (no change recap)
 */
function enforcePol026BrickChatResponse(text, opts) {
  const confirmed = !!(opts && opts.confirmed);
  if (confirmed) return BRICK_SCHEDULE_POST_APPLY_MSG;
  const note = opts && (opts.scheduleNote || opts.note);
  const todayIso = (opts && opts.todayIso) || formatIsoDate(new Date());
  if (note) {
    const intent = parseBrickScheduleIntent(note, { todayIso: todayIso });
    return buildBrickScheduleConfirmMessage(intent, { note: note, todayIso: todayIso });
  }
  return POL026_DEFAULT_CONFIRM;
}

/** Alias — same gate for all brick schedule-revise threads. */
function enforceBrickScheduleChatResponse(text, opts) {
  return enforcePol026BrickChatResponse(text, opts);
}

module.exports = {
  POL026_DEFAULT_CONFIRM,
  BRICK_SCHEDULE_POST_APPLY_MSG,
  parseBrickScheduleIntent,
  buildBrickScheduleConfirmMessage,
  addDaysIso,
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
