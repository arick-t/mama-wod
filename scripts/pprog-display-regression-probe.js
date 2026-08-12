/**
 * Safety probe: already-correct Personal Coach part lines must stay intact.
 * Run: node scripts/pprog-display-regression-probe.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function extractFn(src, name) {
  const start = src.indexOf("function " + name + "(");
  assert.ok(start >= 0, "find " + name);
  let i = src.indexOf("{", start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1) + "\n";
    }
  }
  assert.fail("extract " + name);
}

const names = [
  "isPprogPartIntentNoteLine",
  "isPprogPartCoachNoteLine",
  "isPprogMovementishPart",
  "countPprogMovementishParts",
  "isPprogPartFormatHead",
  "peelPprogEmbeddedFormat",
  "expandPprogChipperArrowLine",
  "expandPprogMinStationLine",
  "expandPprogJoinedMovementLine",
  "expandPprogWorkLines",
  "peelInlineTrailingCoachNote",
  "finalizePprogWorkAndNotes",
  "isPprogPartFormatLine",
  "classifyPprogPartLines",
];
eval(names.map((n) => extractFn(index, n)).join("\n"));

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

function sameWork(c, expected) {
  assert.deepStrictEqual(c.work, expected, "work mismatch: " + JSON.stringify(c.work));
}

/* --- Already-correct templates must not be mangled --- */
const cleanAmrap = classifyPprogPartLines([
  "Intent: Aerobic capacity (Target duration: 12 min).",
  "12 Min AMRAP:",
  "4 Bar Muscle-Ups (or 8 Chest-to-Bar Pull-Ups)",
  "12 Wall Balls (10 kg)",
  "24 Double Unders",
]);
ok("clean AMRAP keeps format", /12 Min AMRAP/i.test(cleanAmrap.format));
sameWork(cleanAmrap, [
  "4 Bar Muscle-Ups (or 8 Chest-to-Bar Pull-Ups)",
  "12 Wall Balls (10 kg)",
  "24 Double Unders",
]);
ok("clean AMRAP no trailing notes", cleanAmrap.trailingNotes.length === 0);

const cleanStrength = classifyPprogPartLines([
  "Intent: Lower body force production (Target duration: 15 min).",
  "5 Sets for Quality:",
  "8 Dual DB Front Squats (2x22.5 kg)",
  "6 Strict Pull-Ups (weighted with 15 kg DB if capable)",
  "Rest 2 min between sets.",
]);
sameWork(cleanStrength, [
  "8 Dual DB Front Squats (2x22.5 kg)",
  "6 Strict Pull-Ups (weighted with 15 kg DB if capable)",
]);
ok(
  "clean strength rest is note only",
  cleanStrength.trailingNotes.some((n) => /Rest 2 min/i.test(n))
);

/* Load / scale text that must NOT be split */
ok(
  "2x22.5 kg stays one line",
  expandPprogJoinedMovementLine("8 Dual DB Front Squats (2x22.5 kg)").length === 1
);
ok(
  "or-scale in parens stays one line",
  expandPprogJoinedMovementLine("4 Bar Muscle-Ups (or 8 Chest-to-Bar Pull-Ups)").length === 1
);
ok(
  "comma inside parens stays one line",
  expandPprogJoinedMovementLine("Wall Balls (20 lb, 10 ft)").length === 1
);
ok(
  "5+ Rounds note not split by plus",
  classifyPprogPartLines([
    "AMRAP 12:",
    "10 Goblet Squats",
    "Target score: 5+ Rounds. Keep unbroken.",
  ]).trailingNotes.some((n) => /5\+/.test(n)) &&
    classifyPprogPartLines([
      "AMRAP 12:",
      "10 Goblet Squats",
      "Target score: 5+ Rounds. Keep unbroken.",
    ]).work.length === 1
);

/* Intent must never become format / work */
const intentOnly = classifyPprogPartLines([
  "Intent: Prep wrists, shoulders, and dynamic heart rate.",
  "10 Scapular Pull-ups",
]);
ok("intent stays note", /Intent:/i.test(intentOnly.notes.join(" ")));
ok("intent not format", !/Intent:/i.test(intentOnly.format));
sameWork(intentOnly, ["10 Scapular Pull-ups"]);

/* Single-station EMOM minute line stays whole */
sameWork(
  classifyPprogPartLines([
    "EMOM 10 min:",
    "Min 1: 6 Alternating DB Snatches (22.5kg)",
    "Min 2: 8 Strict Chest-to-Bar Pull-ups",
  ]),
  [
    "Min 1: 6 Alternating DB Snatches (22.5kg)",
    "Min 2: 8 Strict Chest-to-Bar Pull-ups",
  ]
);

/* Fran-style already vertical — unchanged */
sameWork(
  classifyPprogPartLines([
    "For Time:",
    "21 Thrusters",
    "21 Pull-ups",
    "15 Thrusters",
    "15 Pull-ups",
    "9 Thrusters",
    "9 Pull-ups",
  ]),
  [
    "21 Thrusters",
    "21 Pull-ups",
    "15 Thrusters",
    "15 Pull-ups",
    "9 Thrusters",
    "9 Pull-ups",
  ]
);

/* Do not invent empty parts */
const empty = classifyPprogPartLines([]);
ok("empty input stays empty", !empty.format && empty.work.length === 0);

/* Rest day style lines */
const restDay = classifyPprogPartLines(["Rest day — full recovery."]);
ok(
  "rest-day cue not exploded",
  restDay.work.length + restDay.notes.length + restDay.trailingNotes.length >= 1
);

/* Plus without spaces (5+ rounds already covered); C++ nonsense */
ok(
  "no-space plus not treated as join",
  expandPprogJoinedMovementLine("Target: 5+ rounds unbroken").length === 1
);

/* Pipe inside words / no spaces — should not split */
ok(
  "Band/DB Face Pulls alone unchanged",
  expandPprogJoinedMovementLine("15 Band/DB Face Pulls").length === 1
);

console.log("All pprog display regression probes passed.");
