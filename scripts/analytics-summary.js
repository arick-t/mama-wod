/**
 * Reads data/analytics.jsonl and prints a user report for the last 7 days (from run time).
 * - Filters out bot/automated traffic (User-Agent).
 * - Counts total users, returning vs new (first-seen in window = new).
 * - Counts timer_use and find_workout only (no per-day breakdown).
 *
 * When run manually: last 7 days from now.
 * When run on schedule (e.g. every Friday): same – last 7 days from run time (e.g. Sat–Fri).
 *
 * Usage: node scripts/analytics-summary.js
 * Env: REPORT_PERIOD=last_week (default), REPORT_FROM_DATE=YYYY-MM-DD not used for this format.
 */

const fs = require("fs");
const path = require("path");

const BOT_UA_PATTERNS = [
  "headless", "phantom", "selenium", "puppeteer", "playwright",
  "bot", "crawler", "spider", "scraper", "curl", "wget", "python-", "node ",
  "googlebot", "bingbot", "yandexbot", "baiduspider", "facebookexternalhit",
  "bytespider", "petalbot", "ahrefsbot", "semrushbot", "dotbot"
];

function isLikelyBot(ua) {
  if (!ua || typeof ua !== "string") return false;
  const lower = ua.toLowerCase();
  return BOT_UA_PATTERNS.some((p) => lower.includes(p));
}

function formatDDMMYY(ts) {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return dd + "/" + mm + "/" + yy;
}

const now = Date.now();
const windowStart = now - 7 * 24 * 60 * 60 * 1000;

const file = path.join(__dirname, "..", "data", "analytics.jsonl");
if (!fs.existsSync(file)) {
  console.log("דו\"ח ניתור משתמשים בין התאריכים " + formatDDMMYY(windowStart) + " ועד ל " + formatDDMMYY(now));
  console.log("");
  console.log("עדיין אין נתונים בקובץ data/analytics.jsonl.");
  process.exit(0);
}

const lines = fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean);
const events = [];
for (const line of lines) {
  try {
    events.push(JSON.parse(line));
  } catch (e) {}
}

const humanEvents = events.filter((e) => !isLikelyBot(e.ua));
const windowEvents = humanEvents.filter((e) => e.t >= windowStart && e.t <= now);

// First-seen per sid (over full history)
const firstSeen = {};
humanEvents.forEach((e) => {
  if (e.sid) {
    if (firstSeen[e.sid] === undefined || e.t < firstSeen[e.sid]) firstSeen[e.sid] = e.t;
  }
});

const uniqueSids = new Set();
windowEvents.forEach((e) => { if (e.sid) uniqueSids.add(e.sid); });
const totalUsers = uniqueSids.size;

let returning = 0;
let newUsers = 0;
uniqueSids.forEach((sid) => {
  const first = firstSeen[sid];
  if (first === undefined) return;
  if (first < windowStart) returning++;
  else newUsers++;
});

const timerUse = windowEvents.filter((e) => e.event === "timer_use").length;
const findWorkout = windowEvents.filter((e) => e.event === "find_workout").length;

console.log("דו\"ח ניתור משתמשים בין התאריכים " + formatDDMMYY(windowStart) + " ועד ל " + formatDDMMYY(now));
console.log("");
console.log("סה\"כ משתמשים - " + totalUsers);
console.log("מתוכם ותיקים - " + returning);
console.log("מתוכם חדשים מהשבוע האחרון - " + newUsers);
console.log("סה\"כ שימושים בלשונית שעון - " + timerUse);
console.log("סה\"כ שימושים בלשונית איתור אימון - " + findWorkout);
