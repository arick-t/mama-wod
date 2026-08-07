const path = require("path");
const {
  readJsonlEvents,
  computeSummary,
  buildReportLines,
  buildReportHtml,
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
  const fixturePath = path.join(
    __dirname,
    "fixtures",
    "analytics-summary.fixture.jsonl"
  );
  const events = readJsonlEvents(fixturePath);
  const summary = computeSummary(events, now, {
    coachMembers: {
      uCoach2: { displayName: "אריק", tier: 2 },
    },
  });

  assertEqual(summary.unknownEntrants.length >= 1, true, "has unknown entrants");
  assertEqual(summary.newCoachRegistrants.length, 1, "newCoachRegistrants");
  assertEqual(summary.newCoachRegistrants[0].name, "חדש", "new registrant name");
  assertEqual(summary.startedIncomplete.length, 1, "startedIncomplete");
  assertEqual(summary.veteranBoardOnly.some((x) => x.name === "עדי"), true, "עדי board");
  assertEqual(summary.veteranDayChange.some((x) => x.uid === "uCoach2"), true, "אריק day change");
  assertEqual(summary.dailyNew.length, 1, "dailyNew");
  assertEqual(summary.dailyVeteran.length, 1, "dailyVeteran");

  const lines = buildReportLines(summary);
  assertEqual(lines[0].indexOf("🦆") === 0, true, "duck title");
  assertEqual(lines.some((l) => l === "תנועה"), true, "section traffic");
  assertEqual(lines.some((l) => l.indexOf("נרשמים חדשים") === 0), true, "coach new line");
  assertEqual(lines.some((l) => l.indexOf("ותיקים — רק צפייה בלוח") === 0), true, "coach board line");
  assertEqual(lines.some((l) => /\d\.\d/.test(l)), false, "no decimal-looking labels");

  const html = buildReportHtml(summary);
  assertEqual(html.indexOf('dir="rtl"') > -1, true, "html rtl");
  assertEqual(html.indexOf("font-weight:700") > -1, true, "html bold sections");
  assertEqual(html.indexOf("🦆") > -1, true, "html duck");

  console.log("analytics-summary test passed");
  console.log(lines.join("\n"));
}

run();
