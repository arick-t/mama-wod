/**
 * Reads data/analytics.jsonl and prints:
 * - סיכומי: משתמשים שונים, צפיות באימונים, איתור אימון, שעונים
 * - מפורט: לכל יום – יום DD/MM/YY, משתמשים, צפיות, איתור, שעונים
 * Run from repo root: node scripts/analytics-summary.js
 * Events: page_view, find_workout, timer_use. Optional field: sid (session id).
 */

const fs = require("fs");
const path = require("path");

const DAY_NAMES_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const file = path.join(__dirname, "..", "data", "analytics.jsonl");
if (!fs.existsSync(file)) {
  console.log("No data/analytics.jsonl yet. Deploy the app with ANALYTICS_ENDPOINT set and generate some events.");
  process.exit(0);
}

const lines = fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean);
const events = [];
for (const line of lines) {
  try {
    events.push(JSON.parse(line));
  } catch (e) {}
}

// Last 7 days (by calendar day, Israel-friendly: use date string)
const now = Date.now();
const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
const weekEvents = events.filter((e) => e.t >= sevenDaysAgo);

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

// Unique users (by sid); fallback: without sid count as 1 per event for old data
const uniqueSids = new Set();
weekEvents.forEach((e) => {
  if (e.sid) uniqueSids.add(e.sid);
});
const totalUsers = uniqueSids.size || weekEvents.length; // אם אין sid – נשתמש במספר אירועים כהערכה

const pageView = weekEvents.filter((e) => e.event === "page_view").length;
const findWorkout = weekEvents.filter((e) => e.event === "find_workout").length;
const timerUse = weekEvents.filter((e) => e.event === "timer_use").length;

// By day
const byDay = {};
weekEvents.forEach((e) => {
  const key = toDateKey(e.t);
  if (!byDay[key]) byDay[key] = { users: new Set(), page_view: 0, find_workout: 0, timer_use: 0, firstT: e.t };
  if (e.sid) byDay[key].users.add(e.sid);
  if (e.event === "page_view") byDay[key].page_view++;
  if (e.event === "find_workout") byDay[key].find_workout++;
  if (e.event === "timer_use") byDay[key].timer_use++;
});

const days = Object.keys(byDay).sort();

// ----- סיכומי -----
console.log("דוח ניתור משתמשים – השבוע האחרון");
console.log("");
console.log("--- סיכומי ---");
console.log("סה\"כ משתמשים (שונים) אשר השתמשו באפליקציה השבוע - " + totalUsers);
console.log("סה\"כ אימונים שצפו בהם השבוע (צפיות) - " + pageView);
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
