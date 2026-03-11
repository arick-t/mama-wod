/**
 * Reads data/analytics.jsonl and prints:
 * - סיכומי: משתמשים שונים, צפיות באימונים, איתור אימון, שעונים
 * - מפורט: לכל יום – יום DD/MM/YY, משתמשים, צפיות, איתור, שעונים
 *
 * תקופה (אחד מהבאים):
 *   node scripts/analytics-summary.js              → השבוע האחרון (ברירת מחדל)
 *   node scripts/analytics-summary.js --last-day   → היום האחרון (24 שעות)
 *   node scripts/analytics-summary.js --last-week  → 7 ימים אחרונים
 *   node scripts/analytics-summary.js --from 2026-03-01  → מתאריך זה עד עכשיו
 *
 * או via env: REPORT_PERIOD=last_day|last_week|from_date, REPORT_FROM_DATE=YYYY-MM-DD
 * Events: page_view, find_workout, timer_use. Optional field: sid (session id).
 */

const fs = require("fs");
const path = require("path");

const DAY_NAMES_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function parsePeriod() {
  const envPeriod = process.env.REPORT_PERIOD;
  const envFrom = process.env.REPORT_FROM_DATE;
  const argv = process.argv.slice(2);
  if (envPeriod === "last_day" || argv.includes("--last-day")) return { period: "last_day", title: "היום האחרון" };
  if (envPeriod === "last_week" || argv.includes("--last-week")) return { period: "last_week", title: "השבוע האחרון" };
  if (envPeriod === "from_date" || envFrom) {
    const fromStr = envFrom || (argv.indexOf("--from") >= 0 && argv[argv.indexOf("--from") + 1]) || "";
    const fromDate = fromStr ? new Date(fromStr + "T00:00:00.000Z") : null;
    if (fromDate && !isNaN(fromDate.getTime())) return { period: "from_date", fromTs: fromDate.getTime(), title: "מתאריך " + fromStr };
  }
  return { period: "last_week", title: "השבוע האחרון" };
}

const opts = parsePeriod();
const now = Date.now();
let windowStart;
if (opts.period === "last_day") {
  windowStart = now - 24 * 60 * 60 * 1000;
} else if (opts.period === "last_week") {
  windowStart = now - 7 * 24 * 60 * 60 * 1000;
} else if (opts.period === "from_date" && opts.fromTs) {
  windowStart = opts.fromTs;
} else {
  windowStart = now - 7 * 24 * 60 * 60 * 1000;
}

const file = path.join(__dirname, "..", "data", "analytics.jsonl");
if (!fs.existsSync(file)) {
  console.log("דוח ניתור משתמשים – " + opts.title);
  console.log("");
  console.log("עדיין אין נתונים בקובץ data/analytics.jsonl.");
  console.log("הפעל את הניתור (ANALYTICS_ENDPOINT) וצבור כניסות ואירועי Find Workout – אחר כך תקבל כאן סיכום אמיתי.");
  process.exit(0);
}

const lines = fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean);
const events = [];
for (const line of lines) {
  try {
    events.push(JSON.parse(line));
  } catch (e) {}
}

const windowEvents = events.filter((e) => e.t >= windowStart && e.t <= now);

function toDateKey(t) {
  const d = new Date(t);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function formatDayHebrew(t) {
  const d = new Date(t);
  const dayName = DAY_NAMES_HE[d.getDay()];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return "יום " + dayName + " ה-" + dd + "/" + mm + "/" + yy;
}

const uniqueSids = new Set();
windowEvents.forEach((e) => {
  if (e.sid) uniqueSids.add(e.sid);
});
const totalUsers = uniqueSids.size || windowEvents.length;

const pageView = windowEvents.filter((e) => e.event === "page_view").length;
const findWorkout = windowEvents.filter((e) => e.event === "find_workout").length;
const timerUse = windowEvents.filter((e) => e.event === "timer_use").length;

const byDay = {};
windowEvents.forEach((e) => {
  const key = toDateKey(e.t);
  if (!byDay[key]) byDay[key] = { users: new Set(), page_view: 0, find_workout: 0, timer_use: 0, firstT: e.t };
  if (e.sid) byDay[key].users.add(e.sid);
  if (e.event === "page_view") byDay[key].page_view++;
  if (e.event === "find_workout") byDay[key].find_workout++;
  if (e.event === "timer_use") byDay[key].timer_use++;
});

const days = Object.keys(byDay).sort();

console.log("דוח ניתור משתמשים – " + opts.title);
console.log("");
console.log("--- סיכומי ---");
console.log("סה\"כ משתמשים (שונים) - " + totalUsers);
console.log("סה\"כ צפיות באימונים - " + pageView);
console.log("סה\"כ שימושים ב\"איתור אימון\" - " + findWorkout);
console.log("סה\"כ שימושים ב\"שעונים\" - " + timerUse);
console.log("");
console.log("--- מפורט ---");
for (const key of days) {
  const v = byDay[key];
  const usersDay = (v.users && v.users.size > 0) ? v.users.size : (v.page_view + v.find_workout + v.timer_use > 0 ? 1 : 0);
  const line = formatDayHebrew(v.firstT) + " - משתמשים " + usersDay + " צפיה באימונים " + v.page_view + " שימוש באיתור אימון " + v.find_workout + " שימוש בשעונים " + v.timer_use;
  console.log(line);
}
