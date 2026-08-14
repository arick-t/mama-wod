/**
 * Coach 2.3.14 — every training day in every week must fill; calendar jump must not drop the queue.
 * Run: node scripts/pprog-week-fill-complete.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const PprogDisplay = require("../lib/pprog-display.js");

const root = path.join(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

function trainingDay() {
  return {
    parts: [{ id: "a", title: "Part A — Strength", lines: ["Back squat 5x5 70%"] }],
  };
}

function holeWeek() {
  return {
    weekIndex: 2,
    overview: [
      { day: "sun", focus: "Rest" },
      { day: "mon", focus: "Squat" },
      { day: "tue", focus: "Metcon" },
      { day: "wed", focus: "Rest" },
      { day: "thu", focus: "Strength" },
      { day: "fri", focus: "Engine" },
      { day: "sat", focus: "Rest" },
    ],
    days: {
      sun: { parts: [{ title: "REST DAY", lines: ["Rest"] }] },
      mon: trainingDay(),
      tue: { parts: [] },
      wed: { parts: [{ title: "REST DAY", lines: ["Rest"] }] },
      thu: { parts: [] },
      fri: { parts: [] },
      sat: { parts: [{ title: "REST DAY", lines: ["Rest"] }] },
    },
  };
}

function fullWeek() {
  var w = holeWeek();
  w.days.tue = trainingDay();
  w.days.thu = trainingDay();
  w.days.fri = trainingDay();
  return w;
}

ok("one filled training day is NOT a complete week", PprogDisplay.weekHasDetailedDays(holeWeek()) === false);
ok("all training days filled is complete", PprogDisplay.weekHasDetailedDays(fullWeek()) === true);
ok("index no longer treats 1 day as complete", !/trainingWithParts >= 1/.test(index));
ok("index requires every training day", /filled >= training/.test(index) && /pprogDayHasRealTrainingParts/.test(index));
ok("display lib requires every training day", /filled >= training/.test(fs.readFileSync(path.join(root, "lib/pprog-display.js"), "utf8")));
ok("never drop queued weeks on jump", /Never drop a queued week/.test(index));
ok("no far-future queue splice", !/Drop far-future weeks already queued/.test(index));
ok("keep real days when merging week_detail", /fill holes only/.test(index) && /pprogDayHasRealTrainingParts\(prevDay\)/.test(index));
ok("fill every week comment still present", /Fill every week that still lacks real parts/.test(index));
ok("coach 2.3.14", /COACH_VERSION = "2\.3\.14"/.test(index));

console.log("pprog-week-fill-complete.test.js ok");
