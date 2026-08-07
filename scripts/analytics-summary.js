/**
 * Analytics summary — weekly (or period) report for DUCK-WOD founder.
 * Mobile humans only. Coach-registered (tier 2) ≠ mere first-seen uid.
 */

const fs = require("fs");
const path = require("path");

const BOT_UA_PATTERNS = [
  "headless", "phantom", "selenium", "puppeteer", "playwright",
  "bot", "crawler", "spider", "scraper", "curl", "wget", "python-", "node ",
  "googlebot", "bingbot", "yandexbot", "baiduspider", "facebookexternalhit",
  "bytespider", "petalbot", "ahrefsbot", "semrushbot", "dotbot"
];
const MOBILE_UA_PATTERNS = ["iphone", "ipad", "ipod", "android", "mobile"];

const DAY_CHANGE_AREAS = new Set(["day_session", "day_pre", "day_debrief"]);
const DAY_CHANGE_TYPES = new Set(["day_revision", "day", "revise_day"]);

function isLikelyBot(ua) {
  if (!ua || typeof ua !== "string") return false;
  const lower = ua.toLowerCase();
  return BOT_UA_PATTERNS.some((p) => lower.includes(p));
}

function isMobileUa(ua) {
  if (!ua || typeof ua !== "string") return false;
  const lower = ua.toLowerCase();
  return MOBILE_UA_PATTERNS.some((p) => lower.includes(p));
}

function getUserKey(e) {
  if (e && typeof e.uid === "string" && e.uid) return e.uid;
  if (e && typeof e.sid === "string" && e.sid) return e.sid;
  if (e && typeof e.ua === "string" && e.ua) return "ua::" + e.ua.toLowerCase();
  return null;
}

function formatDDMMYY(ts) {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return dd + "/" + mm + "/" + yy;
}

function readJsonlEvents(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, "utf8").trim().split("\n").filter(Boolean);
  const events = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch (e) {}
  }
  return events;
}

function loadCoachMemberSeed(seedPath) {
  const p =
    seedPath ||
    path.join(__dirname, "..", "data", "analytics-coach-members.json");
  try {
    if (!fs.existsSync(p)) return {};
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch (e) {
    return {};
  }
}

const MS_DAY = 24 * 60 * 60 * 1000;
const MS_WEEK = 7 * MS_DAY;

function getWindowBounds(nowTs, period) {
  const now = typeof nowTs === "number" ? nowTs : Date.now();
  if (period === "last_day") {
    return { now, windowStart: now - MS_DAY, period };
  }
  if (period === "yesterday_today") {
    const d = new Date(now);
    const startOfTodayUTC = Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate()
    );
    return { now, windowStart: startOfTodayUTC - MS_DAY, period };
  }
  return { now, windowStart: now - MS_WEEK, period: "last_week" };
}

function isDayChangeEvent(e) {
  if (!e || typeof e.event !== "string") return false;
  if (
    e.event !== "personal_coach_workout_change_request" &&
    e.event !== "personal_coach_workout_changed" &&
    e.event !== "personal_coach_day_session" &&
    e.event !== "personal_coach_day_pre" &&
    e.event !== "personal_coach_day_debrief"
  ) {
    return false;
  }
  if (e.dayKey) return true;
  if (e.coachArea && DAY_CHANGE_AREAS.has(String(e.coachArea))) return true;
  if (e.changeType && DAY_CHANGE_TYPES.has(String(e.changeType))) return true;
  return (
    e.event === "personal_coach_day_session" ||
    e.event === "personal_coach_day_pre" ||
    e.event === "personal_coach_day_debrief"
  );
}

function isGeneralCoachChangeEvent(e) {
  if (!e || typeof e.event !== "string") return false;
  if (isDayChangeEvent(e)) return false;
  if (e.event === "personal_coach_block" && e.coachArea === "block_build") {
    return false; // initial plan build at registration, not active שיח/שינוי
  }
  return (
    e.event === "personal_coach_message" ||
    e.event === "personal_coach_week_pre" ||
    e.event === "personal_coach_workout_change_request" ||
    e.event === "personal_coach_workout_changed" ||
    e.event === "personal_coach_block"
  );
}

function buildTier2Registry(humanMobileEvents, seed) {
  const tier2 = {};
  Object.keys(seed || {}).forEach((uid) => {
    const row = seed[uid] || {};
    tier2[uid] = {
      since: 0,
      displayName: row.displayName || "",
      via: "seed",
      seeded: true,
    };
  });

  humanMobileEvents.forEach((e) => {
    const uid = typeof e.uid === "string" ? e.uid : "";
    if (!uid) return;
    const name = typeof e.name === "string" ? e.name.trim() : "";

    if (Number(e.coachTier) >= 2) {
      if (!tier2[uid]) {
        tier2[uid] = { since: e.t, displayName: name, via: "event_tier", seeded: false };
      } else {
        if (!tier2[uid].seeded && e.t < (tier2[uid].since || Infinity)) tier2[uid].since = e.t;
        if (name && !tier2[uid].displayName) tier2[uid].displayName = name;
      }
    }

    if (e.event === "personal_coach_intake_complete") {
      if (!tier2[uid]) {
        tier2[uid] = { since: e.t, displayName: name, via: "intake_complete", seeded: false };
      } else if (!tier2[uid].seeded) {
        if (!tier2[uid].since || e.t < tier2[uid].since) tier2[uid].since = e.t;
        if (name) tier2[uid].displayName = name;
        tier2[uid].via = "intake_complete";
      } else if (name) {
        tier2[uid].displayName = tier2[uid].displayName || name;
      }
    }
  });

  const legalAt = {};
  const blockAt = {};
  humanMobileEvents.forEach((e) => {
    const uid = typeof e.uid === "string" ? e.uid : "";
    if (!uid) return;
    if (e.event === "personal_coach_legal_agree") {
      if (legalAt[uid] === undefined || e.t < legalAt[uid]) legalAt[uid] = e.t;
    }
    if (e.event === "personal_coach_block") {
      if (blockAt[uid] === undefined || e.t < blockAt[uid]) blockAt[uid] = e.t;
    }
  });
  Object.keys(blockAt).forEach((uid) => {
    if (tier2[uid]) {
      if (tier2[uid].seeded && !tier2[uid].displayName) {
        const nameEv = humanMobileEvents.find((e) => e.uid === uid && e.name);
        if (nameEv) tier2[uid].displayName = nameEv.name;
      }
      return;
    }
    if (legalAt[uid] === undefined) return;
    const since = Math.max(legalAt[uid], blockAt[uid]);
    const nameEv = humanMobileEvents.find((e) => e.uid === uid && e.name);
    tier2[uid] = {
      since,
      displayName: (nameEv && nameEv.name) || "",
      via: "legal_and_block",
      seeded: false,
    };
  });

  return tier2;
}

function latestName(eventsForUid, fallback) {
  let best = fallback || "";
  let bestT = -1;
  (eventsForUid || []).forEach((e) => {
    if (e.name && e.t >= bestT) {
      best = String(e.name).trim();
      bestT = e.t;
    }
  });
  return best;
}

function computeSummary(events, nowTs, options) {
  const rawPeriod =
    (options && options.period) ||
    process.env.REPORT_PERIOD ||
    "last_week";
  const period =
    rawPeriod === "last_day" || rawPeriod === "yesterday_today"
      ? rawPeriod
      : "last_week";
  const { now, windowStart } = getWindowBounds(nowTs, period);
  const seed =
    (options && options.coachMembers) ||
    loadCoachMemberSeed(options && options.coachMembersPath);

  const validEvents = (events || []).filter((e) => e && typeof e.t === "number");
  const humanMobileEvents = validEvents.filter(
    (e) => !isLikelyBot(e.ua) && isMobileUa(e.ua)
  );
  const windowEvents = humanMobileEvents.filter(
    (e) => e.t >= windowStart && e.t <= now
  );

  const firstSeen = {};
  const byUidAll = {};
  humanMobileEvents.forEach((e) => {
    const key = getUserKey(e);
    if (!key) return;
    if (firstSeen[key] === undefined || e.t < firstSeen[key]) firstSeen[key] = e.t;
    if (!byUidAll[key]) byUidAll[key] = [];
    byUidAll[key].push(e);
  });

  const windowUids = new Set();
  const byUidWindow = {};
  windowEvents.forEach((e) => {
    const key = getUserKey(e);
    if (!key) return;
    windowUids.add(key);
    if (!byUidWindow[key]) byUidWindow[key] = [];
    byUidWindow[key].push(e);
  });

  const tier2 = buildTier2Registry(humanMobileEvents, seed);

  const unknownEntrants = [];
  windowUids.forEach((uid) => {
    if (tier2[uid]) return; // coach members are never "unknown traffic"
    const first = firstSeen[uid];
    if (first === undefined || first < windowStart) return;
    unknownEntrants.push({
      uid,
      name: latestName(byUidWindow[uid], ""),
    });
  });

  const newCoachRegistrants = [];
  windowUids.forEach((uid) => {
    const member = tier2[uid];
    if (!member || member.seeded) return;
    const since = Number(member.since) || 0;
    if (since < windowStart || since > now) return;
    newCoachRegistrants.push({
      uid,
      name: latestName(byUidWindow[uid], member.displayName || ""),
    });
  });
  const newSet = new Set(newCoachRegistrants.map((x) => x.uid));

  const startedIncomplete = [];
  windowUids.forEach((uid) => {
    if (tier2[uid] || newSet.has(uid)) return;
    const wevs = byUidWindow[uid] || [];
    if (!wevs.some((e) => e.event === "personal_coach_legal_agree")) return;
    if (
      wevs.some(
        (e) =>
          e.event === "personal_coach_intake_complete" ||
          e.event === "personal_coach_block"
      )
    ) {
      return;
    }
    startedIncomplete.push({
      uid,
      name: latestName(wevs, ""),
    });
  });

  const veteranBoardOnly = [];
  const veteranDayChange = [];
  const veteranGeneralChange = [];
  windowUids.forEach((uid) => {
    if (newSet.has(uid)) return;
    const member = tier2[uid];
    if (!member) return;
    const wevs = byUidWindow[uid] || [];
    const name = latestName(wevs, member.displayName || "");
    const hasDay = wevs.some(isDayChangeEvent);
    const hasGeneral = wevs.some(isGeneralCoachChangeEvent);
    if (hasDay || hasGeneral) {
      if (hasDay) veteranDayChange.push({ uid, name });
      if (hasGeneral) veteranGeneralChange.push({ uid, name });
      return;
    }
    veteranBoardOnly.push({ uid, name });
  });

  const coachPriority = new Set([
    ...newSet,
    ...startedIncomplete.map((x) => x.uid),
    ...veteranBoardOnly.map((x) => x.uid),
    ...veteranDayChange.map((x) => x.uid),
    ...veteranGeneralChange.map((x) => x.uid),
  ]);

  const dailyNew = [];
  const dailyVeteran = [];
  windowUids.forEach((uid) => {
    if (coachPriority.has(uid)) return;
    const wevs = byUidWindow[uid] || [];
    if (!wevs.some((e) => e.event === "find_workout")) return;
    const name = latestName(wevs, "");
    const first = firstSeen[uid];
    if (first !== undefined && first >= windowStart) dailyNew.push({ uid, name });
    else dailyVeteran.push({ uid, name });
  });

  return {
    now,
    windowStart,
    period,
    totalUsers: windowUids.size,
    returning: [...windowUids].filter((u) => firstSeen[u] < windowStart).length,
    newUsers: unknownEntrants.length,
    timerUse: windowEvents.filter((e) => e.event === "timer_use").length,
    findWorkout: windowEvents.filter((e) => e.event === "find_workout").length,
    unknownEntrants,
    newCoachRegistrants,
    startedIncomplete,
    veteranBoardOnly,
    veteranDayChange,
    veteranGeneralChange,
    dailyNew,
    dailyVeteran,
    tier2Count: Object.keys(tier2).length,
  };
}

function formatNameList(rows) {
  if (!rows || !rows.length) return "(אין)";
  return rows
    .map((r) => (r.name ? r.name : r.uid))
    .filter(Boolean)
    .join(", ");
}

function buildReportLines(summary) {
  const veteranActive = new Set([
    ...summary.veteranBoardOnly.map((x) => x.uid),
    ...summary.veteranDayChange.map((x) => x.uid),
    ...summary.veteranGeneralChange.map((x) => x.uid),
  ]);
  return [
    'דו"ח ניתור משתמשים בין התאריכים ' +
      formatDDMMYY(summary.windowStart) +
      " ועד ל " +
      formatDDMMYY(summary.now),
    "",
    "0) תנועה",
    "כניסות לא-מוכרים לאפליקציה - " + summary.unknownEntrants.length,
    "",
    "1) מאמן אישי",
    "1.א נרשמים חדשים (סיימו תחקור / תוכנית) - " +
      summary.newCoachRegistrants.length,
    "    שמות: " + formatNameList(summary.newCoachRegistrants),
    "1.א־משני התחילו ולא סיימו - " + summary.startedIncomplete.length,
    "1.ב ותיקים — רק צפייה בלוח - " + summary.veteranBoardOnly.length,
    "    שמות: " + formatNameList(summary.veteranBoardOnly),
    "1.ג ותיקים — שיח / שינוי - " +
      new Set([
        ...summary.veteranDayChange.map((x) => x.uid),
        ...summary.veteranGeneralChange.map((x) => x.uid),
      ]).size,
    "    1.ג.1 שינוי יום - " + summary.veteranDayChange.length,
    "        שמות: " + formatNameList(summary.veteranDayChange),
    "    1.ג.2 שינוי כללי - " + summary.veteranGeneralChange.length,
    "        שמות: " + formatNameList(summary.veteranGeneralChange),
    "",
    "2) אימונים יומיים (מי שלא נספר בעדיפות מאמן)",
    "2.1 לא-מוכרים שראו / חיפשו אימון יומי - " + summary.dailyNew.length,
    "2.2 ותיקים שראו / חיפשו אימון יומי - " + summary.dailyVeteran.length,
    "",
    "סיכום קצר: נרשמו למאמן " +
      summary.newCoachRegistrants.length +
      " · ותיקי מאמן פעילים " +
      veteranActive.size +
      " · כניסות לא-מוכרים " +
      summary.unknownEntrants.length,
  ];
}

function runCli() {
  const now = process.env.ANALYTICS_NOW_TS
    ? parseInt(process.env.ANALYTICS_NOW_TS, 10)
    : Date.now();
  const file =
    process.env.ANALYTICS_FILE ||
    path.join(__dirname, "..", "data", "analytics.jsonl");
  const events = readJsonlEvents(file);
  const period = process.env.REPORT_PERIOD || "last_week";
  const summary = computeSummary(events, now, { period });
  const lines = buildReportLines(summary);
  if (!events.length) {
    console.log(lines[0]);
    console.log("");
    console.log("עדיין אין נתונים בקובץ " + file + ".");
    return;
  }
  console.log(lines.join("\n"));
}

if (require.main === module) runCli();

module.exports = {
  readJsonlEvents,
  computeSummary,
  buildReportLines,
  formatDDMMYY,
  getWindowBounds,
  loadCoachMemberSeed,
  buildTier2Registry,
};
