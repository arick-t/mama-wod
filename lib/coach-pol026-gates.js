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
  /\b(instead\s*of\s*(a\s*)?rest|skipped\s*rest|unplanned|spontaneous|worked\s*out|trained\s*(today|yesterday|on)|i\s*(already\s*)?(did|trained|performed|worked)|already\s*(worked|trained)|on\s*a\s*rest\s*day)\b|במקום\s*יום\s*מנוחה|דילג(תי)?\s*על\s*(יום\s*)?מנוחה|ביצעתי\s*אימון|האימון\s*שביצעתי|התאמנתי|אימון\s*היום|היום\s*(כן\s*)?(היה\s*)?(אימון|התאמנתי|ביצעתי)|בסוף\s*יצא\s*ש(?:היום|אתמול)|אתמול\s*(כן\s*)?(התאמנתי|היה\s*אימון|ביצעתי)/i;

const LOAD_OR_SCHEDULE_SHIFT_RE =
  /\b(squat|deadlift|amrap|emom|pull-?up|run|row|bike|press|clean|snatch|\d+\s*x\s*\d+|\d+\s*kg|rest\s*day|rest\s*tomorrow|adjust|shift|schedule|tomorrow|today|yesterday)\b|סקוואט|דדליפט|משיכות|ריצה|ק\"?ג|קילו|יום\s*מנוחה|מחר\s*.{0,24}מנוחה|יום\s*מנוחה\s*מחר|היום|אתמול|לו"ז|לוח\s*אימונים|מחר\s*.{0,40}(כרגיל|רגיל|לפי)|אימון\s*להיום|יום\s*שישי|שלישי|מחרתיים/i;

const SCHEDULE_REST_SHIFT_RE =
  /\b(rest\s*days?|training\s*days?|schedule|active\s*recovery|instead\s*of\s*(a\s*)?rest|skipped\s*rest|unplanned|spontaneous|worked\s*out|trained\s*today|adjust|shift)\b|ימי\s*מנוחה|יום\s*מנוחה|ימי\s*אימון|לוח\s*אימונים|מנוחה\s*ב|תוסיף\s*מנוחה|תוריד\s*מנוחה|שנה\s*את\s*(ה)?ימי|מחר\s*.{0,24}מנוחה|יום\s*מנוחה\s*מחר|במקום\s*יום\s*מנוחה|דילג(תי)?\s*על\s*(יום\s*)?מנוחה|ביצעתי\s*אימון|התאמנתי|אתמול|מחר\s*.{0,40}(כרגיל|רגיל|לפי)|אימון\s*להיום|יום\s*שישי|שלישי|מחרתיים|המנוחה\s*הבאה/i;

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
 * @returns {{
 *   logToday: boolean,
 *   logIso: string|null,
 *   todayAction: 'log'|'need_workout'|'keep'|'unset',
 *   tomorrowAction: 'keep'|'rest'|'unset',
 *   restDays: string[],
 *   replaceNextRest: boolean,
 *   easeForward: boolean
 * }}
 */
function parseBrickScheduleIntent(noteText, opts) {
  opts = opts || {};
  const todayIso = String(opts.todayIso || formatIsoDate(new Date())).slice(0, 10);
  const yesterdayIso = addDaysIso(todayIso, -1);
  const tomorrowIso = addDaysIso(todayIso, 1);
  const t = String(noteText || "");
  const lower = t.toLowerCase();

  const trainedYesterday =
    /אתמול.{0,48}(התאמנתי|אימון|ביצעתי)|(?:התאמנתי|ביצעתי|אימון).{0,24}אתמול|בסוף\s*יצא\s*שאתמול|\byesterday\b.{0,40}\b(trained|worked|did|workout)\b|\b(trained|worked)\b.{0,20}\byesterday\b/i.test(
      t
    );
  const trainedTodayExplicit =
    /(?:^|[^א-ת])היום.{0,48}(התאמנתי|אימון|ביצעתי)|בסוף\s*יצא\s*שהיום|\b(trained|worked)\s*out\s*today\b|\btrained\s*today\b/i.test(
      t
    );
  const trainedGeneric =
    TRAINED_ON_REST_RE.test(t) ||
    /\b(i\s*(already\s*)?(did|trained|worked)|worked\s*out\s*today|trained\s*today)\b/i.test(t);

  const needWorkoutToday =
    /אימון\s*להיום|צריך.{0,28}אימון\s*(להיום|היום)|להיום\s*.{0,16}אימון|workout\s*(for\s*)?today|need\s*.{0,20}(a\s*)?workout\s*today/i.test(
      t
    );

  let logIso = null;
  if (trainedYesterday) logIso = yesterdayIso;
  else if (trainedTodayExplicit) logIso = todayIso;
  else if (trainedGeneric && !needWorkoutToday) logIso = todayIso;

  let todayAction = "unset";
  if (needWorkoutToday) todayAction = "need_workout";
  else if (logIso === todayIso) todayAction = "log";
  else if (/להשאיר\s*.{0,20}היום|היום\s*.{0,20}כרגיל|keep\s*today/i.test(t)) todayAction = "keep";

  const logToday = logIso === todayIso;

  let tomorrowAction = "unset";
  const keepTomorrowHe =
    /מחר\s*.{0,48}(כרגיל|לפי\s*ל(?:ו"ז|וח)|רגיל|אימון\s*לפי|לא\s*מנוחה)/i.test(t) ||
    /.{0,24}מחר.{0,24}(כרגיל|לפי\s*ל(?:ו"ז|וח)|רגיל)/i.test(t) ||
    /להשאיר\s*(את\s*)?(ה)?אימון.{0,16}מחר/i.test(t) ||
    /מחר\s*אימון/i.test(t);
  const restTomorrowHe =
    /יום\s*מנוחה\s*מחר|מנוחה\s*מחר|מחר\s*(?:אני\s*)?(?:אקח\s*)?(?:יום\s*)?מנוחה/i.test(t) ||
    (/מחר\s*.{0,10}מנוחה/i.test(t) && !/כרגיל|רגיל|לפי\s*ל|אימון/i.test(t));
  const keepTomorrowEn =
    /\btomorrow\b.{0,40}\b(as\s*normal|regular(?:ly)?|scheduled|workout|training)\b/i.test(t) ||
    /\bkeep\s*tomorrow/i.test(t);
  const restTomorrowEn = /\btomorrow\b.{0,20}\brest\b/i.test(t) || /\brest\s*tomorrow\b/i.test(t);

  if (keepTomorrowHe || keepTomorrowEn) {
    tomorrowAction = "keep";
  } else if (restTomorrowHe || restTomorrowEn) {
    tomorrowAction = "rest";
  }

  const replaceNextRest =
    /המנוחה\s*(ה)?באה|יום\s*(ה)?מנוחה\s*(שלאחריו|הבא)|מנוחה\s*שלאחריו|לאחר\s*מכן\s*.{0,24}מנוחה|next\s*rest\s*day|the\s*next\s*rest/i.test(
      t
    );

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

  if (!restDays.length && tomorrowAction === "unset" && logToday && todayAction !== "need_workout") {
    restDays.push(tomorrowIso);
    tomorrowAction = "rest";
  }

  let restUnique = uniqSortedIsos(restDays).filter(function (iso) {
    return iso !== todayIso && iso !== logIso;
  });
  if (tomorrowAction === "keep") {
    restUnique = restUnique.filter(function (iso) {
      return iso !== tomorrowIso;
    });
  }

  return {
    logToday: !!logToday,
    logIso: logIso,
    todayAction: todayAction,
    tomorrowAction: tomorrowAction,
    restDays: restUnique,
    replaceNextRest: !!replaceNextRest,
    easeForward: !!(logIso || trainedGeneric),
  };
}

/**
 * When athlete says "next rest = X", MOVE rest (swap) — do not stack consecutive rests.
 * existingRestIsos = calendar rest days after today (ISO strings).
 * @returns {{ setRest: string[], clearRest: string[], moves: Array<{ from: string, to: string }> }}
 */
function daysBetweenIso(a, b) {
  const ms = parseIsoDate(b).getTime() - parseIsoDate(a).getTime();
  return Math.round(ms / 86400000);
}

/** Pick which existing rest to clear when moving "next rest" to target — prefer same week, non-Sunday, nearest. */
function pickRestDayToReplace(existingRestIsos, anchorIso, targetIso, setRestMap) {
  const existing = uniqSortedIsos(existingRestIsos || []).filter(function (iso) {
    return iso > anchorIso && iso !== targetIso && !setRestMap[iso];
  });
  if (!existing.length) return null;
  const targetWeek = sundayOfWeekIso(targetIso);
  const sameWeek = existing.filter(function (iso) {
    return sundayOfWeekIso(iso) === targetWeek;
  });
  let pool = sameWeek.length ? sameWeek : existing;
  const nonSun = pool.filter(function (iso) {
    return parseIsoDate(iso).getDay() !== 0;
  });
  if (nonSun.length) pool = nonSun;
  pool.sort(function (a, b) {
    return Math.abs(daysBetweenIso(a, targetIso)) - Math.abs(daysBetweenIso(b, targetIso));
  });
  return pool[0] || null;
}

function planRestDaySwap(intent, existingRestIsos) {
  const setRest = uniqSortedIsos((intent && intent.restDays) || []);
  const clearRest = [];
  const moves = [];
  if (!(intent && intent.replaceNextRest) || setRest.length < 2) {
    return { setRest: setRest, clearRest: clearRest, moves: moves };
  }
  const anchor = setRest[0];
  const farTargets = setRest.slice(1);
  const setMap = {};
  for (let i = 0; i < setRest.length; i++) setMap[setRest[i]] = true;
  for (let ti = 0; ti < farTargets.length; ti++) {
    const target = farTargets[ti];
    const oldRest = pickRestDayToReplace(existingRestIsos, anchor, target, setMap);
    if (oldRest) {
      clearRest.push(oldRest);
      moves.push({ from: target, to: oldRest });
    }
  }
  return {
    setRest: setRest,
    clearRest: uniqSortedIsos(clearRest),
    moves: moves,
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

function splitScheduleNoteSegments(note) {
  return String(note || "")
    .split(/\s*\/\s*|\n+/)
    .map(function (s) {
      return String(s || "").trim();
    })
    .filter(Boolean);
}

function segmentLooksLikeScheduleInstruction(seg) {
  const t = String(seg || "");
  if (!t) return false;
  if (
    /\d+\s*(?:kg|kgs|ק"?ג)|\d+\s*x\s*\d+|fartlek|amrap|emom|for time|\brounds?\b|\bclean\b|\bsquat\b|\bjerk\b|\brun\b|ריצ|סקוואט|סיבוב|power/i.test(
      t
    ) &&
    !/מנוחה|מחר|שישי|שלישי|כרגיל|לו"ז|please\s*arrange|נא\s*סדר/i.test(t)
  ) {
    return false;
  }
  return /(?:יום\s*)?מנוחה|מחר(?:תיים)?|להשאיר|כרגיל|לו"ז|לוח\s*אימונים|נא\s*סדר|please\s*arrange|rest\s*day|keep\s*tomorrow|next\s*(?:week|tuesday)|שבוע\s*הבא|שלישי|שישי|לאחר\s*מכן|אני\s*צריך/i.test(
    t
  );
}

function segmentLooksLikeIntro(seg) {
  const t = String(seg || "").trim();
  if (!t) return true;
  if (/^(?:היום|בסוף\s*יצא|האימון|the\s*workout|אימון\s*היום)[\s.:,\-–]*$/i.test(t)) return true;
  if (/^(?:היום|בסוף\s*יצא).{0,48}(?:התאמנתי|אימון|trained)/i.test(t) && !/\d/.test(t)) return true;
  if (/^אח(?:\"|״)?כ/i.test(t) && t.length < 12) return true;
  return false;
}

/** Workout-only segments — strips schedule-instruction tail and intro fluff. */
function extractLoggedWorkoutSegments(note) {
  const segments = splitScheduleNoteSegments(note);
  const workout = [];
  for (let i = 0; i < segments.length; i++) {
    if (segmentLooksLikeScheduleInstruction(segments[i])) break;
    if (segmentLooksLikeIntro(segments[i])) continue;
    workout.push(segments[i]);
  }
  if (workout.length) return workout;
  return segments.filter(function (s) {
    return !segmentLooksLikeScheduleInstruction(s) && !segmentLooksLikeIntro(s);
  });
}

function isMovementNameSegment(seg) {
  const t = String(seg || "").trim();
  if (!t || t.length > 64) return false;
  if (/\d+\s*(?:kg|min|sec|x|×)/i.test(t)) return false;
  if (/^(?:עשיתי|עשית|did|for)\b/i.test(t)) return false;
  return /^(?:power\s*)?(?:clean|snatch|squat|jerk|press|deadlift|front|push|pull|run|row|bike)|^(?:front|back|overhead)\s+(?:squat|press)|סקוואט|דדליפט|ריצ|קלינ|ג'רק|פרס/i.test(
    t
  );
}

function buildLoggedSessionPartsFromNote(dayKey, note) {
  const raw = String(note || "").trim();
  const segments = extractLoggedWorkoutSegments(raw);
  const engineLines = [];
  const complexMovements = [];
  const metaLines = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (/run|fartlek|row|bike|ski|ריצ|אירוב|cardio|interval|דקות?\s*ר/i.test(seg)) {
      engineLines.push(seg);
    } else if (isMovementNameSegment(seg)) {
      complexMovements.push(seg);
    } else if (/^(?:עשיתי|עשית|did|for)\b|סיבוב|rounds?\b/i.test(seg)) {
      metaLines.push(seg);
    } else if (/complex|קומפלקס|כבד/i.test(seg)) {
      /* skip header — movements follow */
    } else {
      metaLines.push(seg);
    }
  }
  const parts = [];
  if (engineLines.length) {
    parts.push({
      id: String(dayKey || "day") + "-logged-engine",
      title: "Engine",
      lines: engineLines.slice(0, 4).map(function (l) {
        return l.slice(0, 140);
      }),
    });
  }
  const complexLines = [];
  if (complexMovements.length >= 2) {
    complexLines.push(complexMovements.join(" + "));
  } else if (complexMovements.length === 1) {
    complexLines.push(complexMovements[0]);
  }
  for (let mi = 0; mi < metaLines.length; mi++) {
    complexLines.push(metaLines[mi].slice(0, 140));
  }
  if (complexLines.length) {
    parts.push({
      id: String(dayKey || "day") + "-logged-complex",
      title: complexMovements.length >= 2 || /complex|קומפלקס/i.test(raw) ? "Complex" : "Logged session",
      lines: complexLines.slice(0, 6),
    });
  }
  if (!parts.length) {
    parts.push({
      id: String(dayKey || "day") + "-logged",
      title: "Logged session",
      lines: segments.slice(0, 6).map(function (l) {
        return l.slice(0, 140);
      }),
    });
  }
  const focusBits = [];
  if (engineLines.length) focusBits.push("Engine");
  if (/squat|סקוואט/i.test(raw)) focusBits.push("Squat");
  if (/deadlift|דדליפט|hinge/i.test(raw)) focusBits.push("Hinge");
  if (/clean|jerk|snatch|complex|קומפלקס/i.test(raw)) focusBits.push("Weightlifting");
  if (/pull-?up|משיכ|muscle-?up/i.test(raw)) focusBits.push("Pull");
  if (/press|bench|push/i.test(raw)) focusBits.push("Push");
  const focus = focusBits.length ? "Logged: " + focusBits.join(" + ") : "Logged session";
  return { focus: focus.slice(0, 80), parts: parts };
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
  const swapPlan = opts.swapPlan || null;

  const todayIso = String((opts && opts.todayIso) || "").slice(0, 10);
  const tomorrowIso = todayIso ? addDaysIso(todayIso, 1) : "";
  const logIso = intentSafe.logIso || (intentSafe.logToday && todayIso ? todayIso : null);

  if (hebrew) {
    const parts = [];
    if (logIso && todayIso && logIso === todayIso) parts.push("לשמור את אימון היום כמבוצע");
    else if (logIso && todayIso && logIso === addDaysIso(todayIso, -1)) {
      parts.push("לשמור את אימון אתמול כמבוצע");
    } else if (logIso) parts.push("לשמור את האימון שדווח כמבוצע");
    if (intentSafe.todayAction === "need_workout") parts.push("אימון להיום לפי לוח");
    if (intentSafe.tomorrowAction === "keep") parts.push("מחר אימון לפי לוח רגיל");
    else if (intentSafe.tomorrowAction === "rest") parts.push("מחר מנוחה");

    if (intentSafe.replaceNextRest) {
      const move = swapPlan && swapPlan.moves && swapPlan.moves[0];
      if (move && move.from && move.to) {
        parts.push(
          "שינית יום מנוחה ליום " +
            isoToHebDayLabel(move.from) +
            " — להזיז את יום המנוחה מיום " +
            isoToHebDayLabel(move.to) +
            " בהתאם"
        );
      } else {
        parts.push("שינית יום מנוחה — להזיז את ימי המנוחה האחרים בהתאם");
      }
    } else if (intentSafe.restDays && intentSafe.restDays.length) {
      const dayLabels = intentSafe.restDays
        .filter(function (iso) {
          return intentSafe.tomorrowAction !== "rest" || iso !== tomorrowIso;
        })
        .map(function (iso) {
          return "יום " + isoToHebDayLabel(iso);
        });
      if (dayLabels.length) parts.push("מנוחה ב" + dayLabels.join(" וב"));
    }
    if (intentSafe.easeForward) parts.push("הקלה קלה בעומס בהמשך");
    return "לוז: " + parts.join(". ") + "? לאשר?";
  }

  const enParts = [];
  if (logIso && todayIso && logIso === todayIso) enParts.push("keep today's session logged");
  else if (logIso && todayIso && logIso === addDaysIso(todayIso, -1)) {
    enParts.push("keep yesterday's session logged");
  } else if (logIso) enParts.push("keep the reported session logged");
  if (intentSafe.todayAction === "need_workout") enParts.push("keep today's workout as scheduled");
  if (intentSafe.tomorrowAction === "keep") enParts.push("keep tomorrow's workout as scheduled");
  else if (intentSafe.tomorrowAction === "rest") enParts.push("rest tomorrow");
  if (intentSafe.replaceNextRest) {
    const move = swapPlan && swapPlan.moves && swapPlan.moves[0];
    if (move && move.from && move.to) {
      enParts.push(
        "you changed a rest day to " +
          isoToEnDayLabel(move.from) +
          " — shift the other rest off " +
          isoToEnDayLabel(move.to) +
          " accordingly"
      );
    } else {
      enParts.push("you changed a rest day — shift the other rest days accordingly");
    }
  } else if (intentSafe.restDays && intentSafe.restDays.length) {
    const labels = intentSafe.restDays.map(function (iso) {
      return isoToEnDayLabel(iso);
    });
    enParts.push("rest on " + labels.join(" and "));
  }
  if (intentSafe.easeForward) enParts.push("ease load later this week");
  return "Schedule: " + enParts.join(". ") + "? Confirm?";
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
  planRestDaySwap,
  pickRestDayToReplace,
  buildBrickScheduleConfirmMessage,
  splitScheduleNoteSegments,
  extractLoggedWorkoutSegments,
  buildLoggedSessionPartsFromNote,
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
