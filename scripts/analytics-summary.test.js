const path = require("path");
const {
  readJsonlEvents,
  computeSummary,
  buildReportLines
} = require("./analytics-summary.js");

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(label + " expected=" + expected + " actual=" + actual);
  }
}

function run() {
  // Fixed "now" for deterministic test:
  // 21/03/26 12:00:00 UTC => 7-day window starts 14/03/26 12:00:00 UTC
  const now = 1774094400000;
  const fixturePath = path.join(__dirname, "fixtures", "analytics-summary.fixture.jsonl");
  const events = readJsonlEvents(fixturePath);
  const summary = computeSummary(events, now);

  assertEqual(summary.totalUsers, 2, "totalUsers");
  assertEqual(summary.returning, 1, "returning");
  assertEqual(summary.newUsers, 1, "newUsers");
  assertEqual(summary.timerUse, 1, "timerUse");
  assertEqual(summary.findWorkout, 1, "findWorkout");

  const lines = buildReportLines(summary);
  assertEqual(lines[0], "דו\"ח ניתור משתמשים בין התאריכים 14/03/26 ועד ל 21/03/26", "title");
  assertEqual(lines[2], "סה\"כ משתמשים - 2", "line total users");
  assertEqual(lines[3], "מתוכם ותיקים - 1", "line returning");
  assertEqual(lines[4], "מתוכם חדשים מהשבוע האחרון - 1", "line new users");
  assertEqual(lines[5], "סה\"כ שימושים בלשונית שעון - 1", "line timer use");
  assertEqual(lines[6], "סה\"כ שימושים בלשונית איתור אימון - 1", "line find workout");

  console.log("analytics-summary test passed");
}

run();
