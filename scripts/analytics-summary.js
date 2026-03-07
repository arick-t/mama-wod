/**
 * Reads data/analytics.jsonl and prints a short summary: total page_view, total find_workout, by day.
 * Run from repo root: node scripts/analytics-summary.js
 */

const fs = require("fs");
const path = require("path");

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

const pageView = events.filter((e) => e.event === "page_view").length;
const findWorkout = events.filter((e) => e.event === "find_workout").length;

const byDay = {};
for (const e of events) {
  const d = new Date(e.t);
  const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  if (!byDay[key]) byDay[key] = { page_view: 0, find_workout: 0 };
  if (e.event === "page_view") byDay[key].page_view++;
  if (e.event === "find_workout") byDay[key].find_workout++;
}

console.log("--- Analytics (Git) ---");
console.log("Total events:", events.length);
console.log("Page views (sessions):", pageView);
console.log("Find Workout uses:", findWorkout);
console.log("");
console.log("By day (page_view | find_workout):");
const days = Object.keys(byDay).sort();
for (const day of days) {
  const v = byDay[day];
  console.log("  " + day + "  " + v.page_view + "  " + v.find_workout);
}
