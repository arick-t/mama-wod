/**
 * Personal Coach part display — chipper arrows/+ /commas + coach cues as notes.
 * Run: node scripts/pprog-part-display.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const rules = fs.readFileSync(
  path.join(root, "experiments/personal-coach/coach-policy-rules.md"),
  "utf8"
);
const pc = fs.readFileSync(path.join(root, "api/personal-coach.js"), "utf8");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

ok("expand chipper helper", /function expandPprogChipperArrowLine/.test(index));
ok("joined movement helper", /function expandPprogJoinedMovementLine/.test(index));
ok("peel embedded format", /function peelPprogEmbeddedFormat/.test(index));
ok("coach note helper", /function isPprogPartCoachNoteLine/.test(index));
ok("classify peels trailing coach notes", /isPprogPartCoachNoteLine\(work\[work\.length - 1\]\)/.test(index));
ok("classify expands work arrows", /work = expandPprogWorkLines\(work\)/.test(index));
ok("admin has same helpers", /expandPprogJoinedMovementLine/.test(admin) && /peelPprogEmbeddedFormat/.test(admin));
ok("admin trailing notes render", /trailingNotes/.test(admin));
ok("POL-012 one movement per line", /one movement \/ station per line|one movement per line/i.test(rules));
ok("POL-012 no joined movements", /no -> \/ \+ \/ comma|no -> chipper|Do \*\*not\*\* join/i.test(rules + pc));
ok("flat back cue pattern", /flat back/i.test(index));
ok("rest between sets pattern", /between\|sets/i.test(index) || /between\|sets\?/.test(index));

/* Execute helpers by eval'ing extracted functions from index (minimal). */
function extractFn(src, name) {
  const start = src.indexOf("function " + name + "(");
  assert.ok(start >= 0, "find " + name);
  let i = src.indexOf("{", start);
  assert.ok(i >= 0, "brace " + name);
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return src.slice(start, i + 1) + "\n";
      }
    }
  }
  assert.ok(false, "extract " + name);
}
const bundle =
  extractFn(index, "isPprogPartIntentNoteLine") +
  extractFn(index, "isPprogPartCoachNoteLine") +
  extractFn(index, "isPprogMovementishPart") +
  extractFn(index, "countPprogMovementishParts") +
  extractFn(index, "isPprogPartFormatHead") +
  extractFn(index, "peelPprogEmbeddedFormat") +
  extractFn(index, "expandPprogChipperArrowLine") +
  extractFn(index, "expandPprogJoinedMovementLine") +
  extractFn(index, "expandPprogWorkLines") +
  extractFn(index, "isPprogPartFormatLine") +
  extractFn(index, "classifyPprogPartLines");
eval(bundle);

const chipper = classifyPprogPartLines([
  "Intent: Mixed modal aerobic endurance (Target duration: 25 min).",
  "For Time (25 min cap):",
  "800m Run -> 30 Dual DB Goblet Squats (1x22.5 kg) -> 30 Toes-to-Bar -> 400m Run -> 25 Box Jump Overs (24 in) -> 20 KB Swings (32 kg) -> 400m Run",
]);
ok("chipper expands to many work lines", chipper.work.length >= 6);
ok("chipper keeps format", /For Time/i.test(chipper.format));
ok("no arrows left in work", chipper.work.every(function (w) { return !/->|→/.test(w); }));

const strength = classifyPprogPartLines([
  "Intent: Hinge strength & stamina (Target duration: 12 min).",
  "E2MOM 12 min (6 sets):",
  "10 Dual DB Deadlifts (2x22.5 kg)",
  "8 Heavy Russian KB Swings (32 kg)",
  "Maintain flat back and unbroken sets.",
]);
ok("cue peeled from work", strength.work.length === 2);
ok(
  "cue in trailing notes",
  strength.trailingNotes.some(function (n) { return /flat back/i.test(n); })
);

const restCue = classifyPprogPartLines([
  "5 Sets for Quality:",
  "8 Dual DB Front Squats (2x22.5 kg)",
  "6 Strict Pull-Ups",
  "Rest 2 min between sets.",
]);
ok("rest-between peeled", restCue.work.length === 2);
ok(
  "rest in trailing",
  restCue.trailingNotes.some(function (n) { return /Rest 2 min/i.test(n); })
);

/* Aug 24 — plus joins + glued format + comma warmup */
const plusEmom = classifyPprogPartLines([
  "Intent: Build pressing power under controlled rest (12 min target duration).",
  "E2MOM 10 min (5 sets): 6 Strict Handstand Push-ups (or Heavy Seated DB Press @ 2x22.5kg) + 8 Strict Toes-to-Bar.",
  "Target loading: Maintain unbroken strict technique across all 5 sets.",
]);
ok("plus EMOM peels format", /^E2MOM 10 min \(5 sets\):$/i.test(plusEmom.format));
ok("plus EMOM expands to 2 work lines", plusEmom.work.length === 2);
ok("plus EMOM no + left in work", plusEmom.work.every(function (w) { return !/\s\+\s/.test(w); }));
ok(
  "target loading is note",
  plusEmom.trailingNotes.some(function (n) { return /Target loading/i.test(n); })
);

const plusIntervals = classifyPprogPartLines([
  "Intent: Aerobic-glycolytic power target 16 min.",
  "3 Rounds, each for time (Rest 1:00 between rounds):",
  "400m Shuttle Run + 12 DB Devil Presses (2x15kg or 2x22.5kg) + 15 Toes-to-Bar.",
  "Target score: Under 3:45 per round. Keep run pace aggressive.",
]);
ok("interval plus expands to 3", plusIntervals.work.length === 3);
ok(
  "target score note",
  plusIntervals.trailingNotes.some(function (n) { return /Target score/i.test(n); })
);

const commaWarmup = classifyPprogPartLines([
  "Intent: Prep wrists, shoulders, and dynamic heart rate.",
  "3 Rounds (Quality): 200m Run, 10 Scapular Pull-ups, 8 Pike Push-ups, 30 Single Unders.",
]);
ok("comma warmup peels format", /^3 Rounds \(Quality\):$/i.test(commaWarmup.format));
ok("comma warmup expands to 4", commaWarmup.work.length === 4);
ok("comma warmup no commas in work", commaWarmup.work.every(function (w) { return !/,/.test(w); }));

console.log("All pprog-part-display checks passed.");
