/**
 * Done-button finish feedback learning (v1) — deterministic, 0 LLM on click.
 * Budget-approved 2026-08-07: accumulate → threshold 3 → micro_bias_next;
 * max 1 paid surgical adaptation / Israel month; then piggyback only.
 */
"use strict";

const OTHER_MAX_CHARS = 160;
const THRESHOLD_SAME_DIRECTION = 3;
const WINDOW_DAYS = 14;
const BIAS_AFTER_THRESHOLD = { minPct: 3, maxPct: 5 };
const BIAS_STRONG = { minPct: 6, maxPct: 10 };
const STRONG_COUNT = 4;
const INJECT_MAX_CHARS = 500;
const INJECT_MAX_SIGNALS = 3;
const PAID_ADAPTATIONS_PER_MONTH = 1;

const SAFETY_RE =
  /\b(pain|injury|injured|chest|dizzy|dizziness|numb|numbness|faint|fainted|breath|breathing|emergency|hurt)\b|כאב|פציעה|נפצע|חזה|סחרחור|עילפון|נשימה|מפרק|שבר/i;

const STATIC_REPLIES = {
  just_right: {
    en: "Got it — locked in for next time.",
    he: "קיבלתי — נשמר להמשך.",
  },
  too_hard: {
    en: "Noted — I’ll ease that part going forward when the pattern holds.",
    he: "רשמתי — אקל על החלק הזה בהמשך כשהדפוס יתבהר.",
  },
  too_easy: {
    en: "Noted — I’ll push that part a bit when the pattern holds.",
    he: "רשמתי — אדחוף את החלק הזה קצת בהמשך כשהדפוס יתבהר.",
  },
  other: {
    en: "Thanks — I saved that for later training decisions.",
    he: "תודה — שמרתי את זה להחלטות אימון בהמשך.",
  },
  safety: {
    en: "Thanks for flagging that. Ease off anything that hurts and seek appropriate care if needed — I’m not a medical provider.",
    he: "תודה שציינת. הורד עומס מכל מה שכואב ופנה לטיפול מתאים אם צריך — אני לא גורם רפואי.",
  },
};

const FINISH_SIGNAL_COACH_RULE =
  "[FINISH_SIGNAL_COACH_RULE]\n" +
  "This is a finish-feedback signal, not a chat request.\n" +
  "If action_allowed=accumulate_only → remember only; do not rewrite now.\n" +
  "If action_allowed=micro_bias_next → apply immediate forward micro-bias\n" +
  "to upcoming NOT-Done days only, SAME part_role, small bias.\n" +
  "Do NOT rewrite the completed Done day.\n" +
  "Do NOT rebuild the brick. Do NOT open long chat.\n" +
  "Do NOT trigger Soft Upgrade / large rebuild from this signal.\n" +
  "Respect monthly Done paid-adaptation cap (max 1/month); if exhausted,\n" +
  "piggyback only on next natural generate_week/week_detail.\n" +
  "[/FINISH_SIGNAL_COACH_RULE]";

/** Compact rule for runtime inject (keeps cards under ≈500 char budget). */
const FINISH_SIGNAL_COACH_RULE_COMPACT =
  "[FINISH_SIGNAL_COACH_RULE] finish-signal≠chat. accumulate_only→remember only. " +
  "micro_bias_next→bias upcoming NOT-Done SAME part_role only; never rewrite Done day; " +
  "no brick rebuild/Soft Upgrade; if monthly paid cap exhausted→piggyback natural generate only. " +
  "[/FINISH_SIGNAL_COACH_RULE]";

const SAFETY_FINISH_RULE =
  "[SAFETY_FINISH_RULE]\n" +
  "If safety_flag=true: do not auto-harden/ease loads from this event.\n" +
  "Route to safety/caution handling. Static user reply only.\n" +
  "No live coach chat billing loop.\n" +
  "[/SAFETY_FINISH_RULE]";

const SAFETY_FINISH_RULE_COMPACT =
  "[SAFETY_FINISH_RULE] safety_flag=true→no auto ease/harden; caution only; static reply; no live chat bill. [/SAFETY_FINISH_RULE]";

function israelToday(d) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d || new Date());
}

function israelMonthKey(isoDay) {
  return String(isoDay || israelToday()).slice(0, 7);
}

function israelDaysBetween(a, b) {
  try {
    const pa = String(a || "").slice(0, 10).split("-");
    const pb = String(b || "").slice(0, 10).split("-");
    const da = Date.UTC(+pa[0], +pa[1] - 1, +pa[2]);
    const db = Date.UTC(+pb[0], +pb[1] - 1, +pb[2]);
    return Math.round((db - da) / 86400000);
  } catch (e) {
    return 999;
  }
}

function emptyFinishLearning() {
  return {
    events: [],
    paidAdaptationsByMonth: {},
    safetyLog: [],
  };
}

function ensureFinishLearning(storeLike) {
  const fl =
    storeLike && storeLike.finishLearning && typeof storeLike.finishLearning === "object"
      ? storeLike.finishLearning
      : emptyFinishLearning();
  if (!Array.isArray(fl.events)) fl.events = [];
  if (!fl.paidAdaptationsByMonth || typeof fl.paidAdaptationsByMonth !== "object") {
    fl.paidAdaptationsByMonth = {};
  }
  if (!Array.isArray(fl.safetyLog)) fl.safetyLog = [];
  return fl;
}

function normalizeRating(raw) {
  const r = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (r === "just_right" || r === "too_hard" || r === "too_easy" || r === "other") return r;
  return "";
}

function normalizePartRole(raw) {
  const r = String(raw || "")
    .trim()
    .toLowerCase();
  if (r === "strength" || r === "metcon" || r === "skill" || r === "accessory") return r;
  if (r === "warmup" || r === "warm-up" || r === "warm_up" || r === "mobility") return "warmup";
  return "unknown";
}

/** Training parts only — warmup never counts for part pick / bias. */
function isCountablePartRole(role) {
  const r = normalizePartRole(role);
  return r === "strength" || r === "metcon" || r === "skill" || r === "accessory";
}

function inferPartRoleFromTitle(title) {
  const t = String(title || "").toLowerCase();
  if (/(warm[\s-]?up|mobility|activation)/.test(t)) return "warmup";
  if (/(strength|lift|squat|deadlift|press|snatch|clean|jerk|1rm|%1rm)/.test(t)) return "strength";
  if (/(skill|gymnastics|handstand|muscle[\s-]?up|pull[\s-]?up practice)/.test(t)) return "skill";
  if (/(accessory|extra|cooldown|cool[\s-]?down)/.test(t)) return "accessory";
  if (/(amrap|emom|for time|metcon|conditioning|chipper|partner)/.test(t)) return "metcon";
  return "unknown";
}

/**
 * @param {Array<{title?: string, role?: string, kind?: string}>} parts
 * @returns {Array<{index:number, title:string, part_role:string}>}
 */
function countableTrainingParts(parts) {
  const list = Array.isArray(parts) ? parts : [];
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i] || {};
    const title = String(p.title || p.name || "").trim() || "Part " + (i + 1);
    let role = normalizePartRole(p.part_role || p.role || p.kind || "");
    if (!role || role === "unknown") role = inferPartRoleFromTitle(title);
    if (role === "warmup") continue;
    if (!isCountablePartRole(role)) {
      /* Default leftover conditioning-shaped blocks to metcon for pick UX */
      if (/warm|mobil/i.test(title)) continue;
      role = "metcon";
    }
    out.push({ index: i, title: title.slice(0, 80), part_role: role });
  }
  return out;
}

function truncateNote(note) {
  const t = String(note || "").trim().replace(/\s+/g, " ");
  if (t.length <= OTHER_MAX_CHARS) return t;
  return t.slice(0, OTHER_MAX_CHARS);
}

function detectSafety(note) {
  return SAFETY_RE.test(String(note || ""));
}

function ruleLabelsFromOther(note) {
  const n = String(note || "").toLowerCase();
  const labels = [];
  if (detectSafety(n)) labels.push("safety");
  if (/(sleep|tired|fatigue|עייף|שינה)/.test(n)) labels.push("recovery");
  if (/(work|shift|travel|משמרת|עבודה|נסיעה)/.test(n)) labels.push("schedule");
  if (/(equipment|gear|אין לי|ציוד)/.test(n)) labels.push("equipment");
  if (/(time|short|ממהר|זמן)/.test(n)) labels.push("time");
  if (!labels.length) labels.push("unspecified");
  return labels.slice(0, 4);
}

function countSameDirection(events, rating, partRole, sessionDate) {
  if (rating !== "too_hard" && rating !== "too_easy") return 0;
  const list = Array.isArray(events) ? events : [];
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e || e.rating !== rating) continue;
    if (normalizePartRole(e.part_role) !== normalizePartRole(partRole)) continue;
    const days = israelDaysBetween(e.session_date, sessionDate);
    if (days < 0 || days > WINDOW_DAYS) continue;
    n++;
  }
  return n;
}

function biasPctForCount(count) {
  if (count >= STRONG_COUNT) return BIAS_STRONG;
  if (count >= THRESHOLD_SAME_DIRECTION) return BIAS_AFTER_THRESHOLD;
  return null;
}

function paidAdaptationsUsed(fl, monthKey) {
  const mk = monthKey || israelMonthKey();
  return (fl.paidAdaptationsByMonth && fl.paidAdaptationsByMonth[mk]) | 0;
}

function paidSlotAvailable(fl, monthKey) {
  return paidAdaptationsUsed(fl, monthKey) < PAID_ADAPTATIONS_PER_MONTH;
}

function markPaidAdaptationUsed(fl, monthKey) {
  const mk = monthKey || israelMonthKey();
  if (!fl.paidAdaptationsByMonth) fl.paidAdaptationsByMonth = {};
  fl.paidAdaptationsByMonth[mk] = (fl.paidAdaptationsByMonth[mk] | 0) + 1;
  return fl;
}

/**
 * Record one Done submission. Pure-ish: mutates finishLearning copy fields.
 * @returns {{ event, action_allowed, staticReply, safety_flag, shouldAttemptPaidMicroBias, biasPct, card }}
 */
function recordFinishFeedback(finishLearning, input) {
  const fl = ensureFinishLearning({ finishLearning: finishLearning });
  const rating = normalizeRating(input && input.rating);
  if (!rating) {
    return {
      ok: false,
      error: "invalid_rating",
      finishLearning: fl,
    };
  }

  const sessionDate = String((input && input.session_date) || israelToday()).slice(0, 10);
  const noteShort = rating === "other" ? truncateNote(input && input.note) : "";
  const safety_flag = rating === "other" ? detectSafety(noteShort) : false;
  const part_role = normalizePartRole((input && input.part_role) || "unknown");
  const part_title = String((input && input.part_title) || "").slice(0, 80);
  const scope =
    (rating === "too_hard" || rating === "too_easy") &&
    (part_title || isCountablePartRole(part_role))
      ? "part"
      : "session";

  const priorCount =
    rating === "too_hard" || rating === "too_easy"
      ? countSameDirection(fl.events, rating, part_role, sessionDate)
      : 0;
  /* This event counts too */
  const count_same_direction_14d =
    rating === "too_hard" || rating === "too_easy" ? priorCount + 1 : 0;

  let action_allowed = "accumulate_only";
  if (safety_flag) action_allowed = "safety_review";
  else if (
    (rating === "too_hard" || rating === "too_easy") &&
    count_same_direction_14d >= THRESHOLD_SAME_DIRECTION &&
    isCountablePartRole(part_role)
  ) {
    action_allowed = "micro_bias_next";
  }

  const event = {
    id: String((input && input.id) || sessionDate + "_" + rating + "_" + Date.now()),
    rating: rating,
    scope: scope,
    part_role: part_role,
    part_title: part_title,
    session_date: sessionDate,
    brick_week: (input && input.brick_week) | 0,
    weekday: String((input && input.weekday) || "").slice(0, 12),
    count_same_direction_14d: count_same_direction_14d,
    action_allowed: action_allowed,
    note_short: noteShort,
    safety_flag: safety_flag,
    labels: rating === "other" ? ruleLabelsFromOther(noteShort) : [],
    at: String((input && input.at) || new Date().toISOString()),
    source: "done_popup",
  };

  fl.events.push(event);
  /* Keep last ~60 events */
  if (fl.events.length > 60) fl.events = fl.events.slice(-60);

  if (safety_flag) {
    fl.safetyLog.push({
      at: event.at,
      session_date: sessionDate,
      note_short: noteShort,
      labels: event.labels,
    });
    if (fl.safetyLog.length > 30) fl.safetyLog = fl.safetyLog.slice(-30);
  }

  const monthKey = israelMonthKey(sessionDate);
  const canPay = paidSlotAvailable(fl, monthKey);
  const shouldAttemptPaidMicroBias =
    action_allowed === "micro_bias_next" && canPay && !safety_flag;

  const biasPct = biasPctForCount(count_same_direction_14d);
  const lang = (input && input.lang) === "he" ? "he" : "en";
  const replyKey = safety_flag ? "safety" : rating;
  const staticReply = (STATIC_REPLIES[replyKey] && STATIC_REPLIES[replyKey][lang]) || STATIC_REPLIES.other.en;

  return {
    ok: true,
    finishLearning: fl,
    event: event,
    action_allowed: action_allowed,
    safety_flag: safety_flag,
    staticReply: staticReply,
    shouldAttemptPaidMicroBias: shouldAttemptPaidMicroBias,
    biasPct: biasPct,
    monthKey: monthKey,
    card: formatSignalCard(event),
  };
}

function formatFinishSignalCard(event) {
  const e = event || {};
  return (
    "[ATHLETE_FINISH_SIGNAL]\n" +
    "rating: " +
    (e.rating || "just_right") +
    "\n" +
    "scope: " +
    (e.scope || "session") +
    "\n" +
    "part_role: " +
    (e.part_role || "unknown") +
    "\n" +
    'part_title: "' +
    String(e.part_title || "").replace(/"/g, "") +
    '"\n' +
    "session_date: " +
    (e.session_date || "") +
    "\n" +
    "brick_week: " +
    ((e.brick_week | 0) || 0) +
    "\n" +
    "weekday: " +
    (e.weekday || "") +
    "\n" +
    "count_same_direction_14d: " +
    ((e.count_same_direction_14d | 0) || 0) +
    "\n" +
    "action_allowed: " +
    (e.action_allowed || "accumulate_only") +
    "\n" +
    "note: none\n" +
    "[/ATHLETE_FINISH_SIGNAL]"
  );
}

function formatOtherSignalCard(event) {
  const e = event || {};
  const labels = Array.isArray(e.labels) ? e.labels : [];
  return (
    "[ATHLETE_OTHER_SIGNAL]\n" +
    "safety_flag: " +
    (e.safety_flag ? "true" : "false") +
    "\n" +
    "labels: [" +
    labels.join(", ") +
    "]\n" +
    'note_short: "' +
    String(e.note_short || "").replace(/"/g, "") +
    '"\n' +
    "session_date: " +
    (e.session_date || "") +
    "\n" +
    "brick_week: " +
    ((e.brick_week | 0) || 0) +
    "\n" +
    "action_allowed: " +
    (e.action_allowed || "accumulate_only") +
    "\n" +
    "[/ATHLETE_OTHER_SIGNAL]"
  );
}

function formatSignalCard(event) {
  if (!event) return "";
  if (event.rating === "other") return formatOtherSignalCard(event);
  return formatFinishSignalCard(event);
}

/**
 * Compact inject block for generate_* / finish_micro_bias (≤ ~500 chars, 1–3 signals).
 */
function buildFinishSignalsInjectBlock(finishLearning, opts) {
  const fl = ensureFinishLearning({ finishLearning: finishLearning });
  const preferPaid = !!(opts && opts.paidMicroBias);
  const events = fl.events.slice().reverse();
  const picked = [];
  for (let i = 0; i < events.length && picked.length < INJECT_MAX_SIGNALS; i++) {
    const e = events[i];
    if (!e) continue;
    if (preferPaid && e.action_allowed !== "micro_bias_next" && !e.safety_flag) continue;
    if (e.rating === "just_right" && picked.length) continue;
    picked.push(e);
  }
  if (!picked.length && events[0]) picked.push(events[0]);

  let body = FINISH_SIGNAL_COACH_RULE_COMPACT + "\n";
  if (picked.some((e) => e.safety_flag)) body += SAFETY_FINISH_RULE_COMPACT + "\n";

  const cards = [];
  let used = body.length;
  for (let i = 0; i < picked.length; i++) {
    const card = formatSignalCard(picked[i]);
    if (used + card.length + 1 > INJECT_MAX_CHARS && cards.length) break;
    /* Always allow at least one card even if slightly over soft cap */
    if (used + card.length + 1 > INJECT_MAX_CHARS + 120 && cards.length) break;
    cards.push(card);
    used += card.length + 1;
  }

  let biasLine = "";
  const micro = picked.find((e) => e.action_allowed === "micro_bias_next");
  if (micro) {
    const pct = biasPctForCount(micro.count_same_direction_14d | 0);
    if (pct) {
      const dir = micro.rating === "too_hard" ? "ease" : "harden";
      biasLine =
        "\nBIAS_HINT: " +
        dir +
        " upcoming NOT-Done " +
        (micro.part_role || "part") +
        " by ~" +
        pct.minPct +
        "-" +
        pct.maxPct +
        "% only.\n";
    }
  }

  const out = body + cards.join("\n") + biasLine;
  return out.length > INJECT_MAX_CHARS + 160 ? out.slice(0, INJECT_MAX_CHARS + 160) : out;
}

function buildFinishMicroBiasUserMessage(signal, nextDayKeys) {
  const e = signal || {};
  const days = Array.isArray(nextDayKeys) ? nextDayKeys.slice(0, 5) : [];
  const dir = e.rating === "too_hard" ? "slightly EASIER" : "slightly HARDER";
  const pct = biasPctForCount(e.count_same_direction_14d | 0) || BIAS_AFTER_THRESHOLD;
  return (
    "[finish_micro_bias / surgical]\n" +
    "Athlete finish pattern crossed threshold. Apply IMMEDIATE forward micro-bias only.\n" +
    "- Target part_role: " +
    (e.part_role || "metcon") +
    "\n" +
    "- Direction: make that part " +
    dir +
    " (~" +
    pct.minPct +
    "-" +
    pct.maxPct +
    "% density/load/volume).\n" +
    "- Only upcoming NOT-Done days" +
    (days.length ? ": " + days.join(", ") : "") +
    ".\n" +
    "- Do NOT rewrite the completed Done day (" +
    (e.session_date || "") +
    ").\n" +
    "- Do NOT rebuild brick / Soft Upgrade / large rebuild.\n" +
    "- Emit WEEK_JSON or DAY_JSON patches for remaining days only; keep other parts unchanged.\n" +
    formatFinishSignalCard(e)
  );
}

module.exports = {
  OTHER_MAX_CHARS,
  THRESHOLD_SAME_DIRECTION,
  WINDOW_DAYS,
  INJECT_MAX_CHARS,
  PAID_ADAPTATIONS_PER_MONTH,
  STATIC_REPLIES,
  FINISH_SIGNAL_COACH_RULE,
  FINISH_SIGNAL_COACH_RULE_COMPACT,
  SAFETY_FINISH_RULE,
  SAFETY_FINISH_RULE_COMPACT,
  israelToday,
  israelMonthKey,
  emptyFinishLearning,
  ensureFinishLearning,
  normalizeRating,
  normalizePartRole,
  isCountablePartRole,
  inferPartRoleFromTitle,
  countableTrainingParts,
  truncateNote,
  detectSafety,
  ruleLabelsFromOther,
  countSameDirection,
  biasPctForCount,
  paidSlotAvailable,
  paidAdaptationsUsed,
  markPaidAdaptationUsed,
  recordFinishFeedback,
  formatFinishSignalCard,
  formatOtherSignalCard,
  formatSignalCard,
  buildFinishSignalsInjectBlock,
  buildFinishMicroBiasUserMessage,
};
