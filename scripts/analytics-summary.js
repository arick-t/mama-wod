/**
 * Analytics summary (7-day rolling window).
 * Exports pure functions to allow deterministic tests with fixture data.
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

const MS_DAY = 24 * 60 * 60 * 1000;
const MS_WEEK = 7 * MS_DAY;

/** @typedef {'last_week'|'last_day'|'yesterday_today'} ReportPeriod */

/**
 * @param {number} nowTs
 * @param {ReportPeriod} period
 */
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
    const windowStart = startOfTodayUTC - MS_DAY;
    return { now, windowStart, period };
  }
  return { now, windowStart: now - MS_WEEK, period: "last_week" };
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
  const validEvents = (events || []).filter((e) => e && typeof e.t === "number");
  const humanMobileEvents = validEvents.filter((e) => !isLikelyBot(e.ua) && isMobileUa(e.ua));
  const windowEvents = humanMobileEvents.filter(
    (e) => e.t >= windowStart && e.t <= now
  );

  // First-seen per user key (uid > sid > ua fallback) over full history
  const firstSeen = {};
  humanMobileEvents.forEach((e) => {
    const key = getUserKey(e);
    if (!key) return;
    if (firstSeen[key] === undefined || e.t < firstSeen[key]) firstSeen[key] = e.t;
  });

  const uniqueUsers = new Set();
  windowEvents.forEach((e) => {
    const key = getUserKey(e);
    if (key) uniqueUsers.add(key);
  });

  let returning = 0;
  let newUsers = 0;
  uniqueUsers.forEach((key) => {
    const first = firstSeen[key];
    if (first === undefined) return;
    if (first < windowStart) returning++;
    else newUsers++;
  });

  const timerUse = windowEvents.filter((e) => e.event === "timer_use").length;
  const findWorkout = windowEvents.filter((e) => e.event === "find_workout").length;

  return {
    now,
    windowStart,
    period,
    totalUsers: uniqueUsers.size,
    returning,
    newUsers,
    timerUse,
    findWorkout
  };
}

function buildReportLines(summary) {
  const newUsersLabel =
    summary.period === "last_week"
      ? "מתוכם חדשים מהשבוע האחרון"
      : "מתוכם חדשים בתקופה";
  return [
    "דו\"ח ניתור משתמשים בין התאריכים " + formatDDMMYY(summary.windowStart) + " ועד ל " + formatDDMMYY(summary.now),
    "",
    "סה\"כ משתמשים - " + summary.totalUsers,
    "מתוכם ותיקים - " + summary.returning,
    newUsersLabel + " - " + summary.newUsers,
    "סה\"כ שימושים בלשונית שעון - " + summary.timerUse,
    "סה\"כ שימושים בלשונית איתור אימון - " + summary.findWorkout
  ];
}

function runCli() {
  const now = process.env.ANALYTICS_NOW_TS ? parseInt(process.env.ANALYTICS_NOW_TS, 10) : Date.now();
  const file = process.env.ANALYTICS_FILE || path.join(__dirname, "..", "data", "analytics.jsonl");
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
  getWindowBounds
};
