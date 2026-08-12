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
  extractFn(index, "expandPprogMinStationLine") +
  extractFn(index, "expandPprogJoinedMovementLine") +
  extractFn(index, "expandPprogWorkLines") +
  extractFn(index, "peelInlineTrailingCoachNote") +
  extractFn(index, "finalizePprogWorkAndNotes") +
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

/* Image 4 — AMRAP plus join + glued sets with inline Rest */
const amrapPlus = classifyPprogPartLines([
  "Intent: Muscular stamina and lower-body threshold (18 min effective duration).",
  "AMRAP 18 min:",
  "12 Heavy KB Swings (32kg) + 10 Alternating Pistols + 15 Wall Balls (10kg) + 50 Double Unders.",
  "Target score: 5+ Rounds. Pace unbroken on KB swings and double unders.",
]);
ok("amrap plus expands to 4", amrapPlus.work.length === 4);
ok(
  "amrap target score note",
  amrapPlus.trailingNotes.some(function (n) { return /Target score/i.test(n); })
);
ok("amrap keeps 5+ in note (not split)", amrapPlus.trailingNotes.some(function (n) { return /5\+/.test(n); }));

const setsInlineRest = classifyPprogPartLines([
  "Intent: Trunk stability and posterior chain balance.",
  "3 Sets (Not for time): 15 DB Russian Twists (15kg) + 45 sec Hollow Hold. Rest 60 sec.",
]);
ok("sets format peeled", /^3 Sets \(Not for time\):$/i.test(setsInlineRest.format));
ok("sets plus expands to 2", setsInlineRest.work.length === 2);
ok(
  "inline rest peeled",
  setsInlineRest.trailingNotes.some(function (n) { return /Rest 60 sec/i.test(n); })
);
ok(
  "hollow hold has no rest glued",
  setsInlineRest.work.every(function (w) { return !/\bRest\b/i.test(w); })
);

/* Image 5 — For Time chipper + accessory sets with Face Pulls */
const forTimeChipper = classifyPprogPartLines([
  "Intent: High stamina threshold piece (20 min effective duration target).",
  "For Time (18 min cap):",
  '40 Pull-ups + 40 Burpee Box Jump-Overs (24") + 40 Dual DB Goblet Squats (2x22.5kg) + 400m Run.',
  "Target score: Finish under 15:30. Break pull-ups early into controlled sets of 8-10.",
]);
ok("for-time chipper expands to 4", forTimeChipper.work.length === 4);
ok(
  "for-time target score note",
  forTimeChipper.trailingNotes.some(function (n) { return /Target score/i.test(n); })
);

const accessorySets = classifyPprogPartLines([
  "Intent: Rotator cuff and posterior shoulder endurance.",
  "3 Sets: 12 Single-arm DB Overhead Tricep Extensions/side + 15 Band/DB Face Pulls. Rest 60 sec.",
]);
ok("accessory peels 3 Sets format", /^3 Sets:$/i.test(accessorySets.format));
ok("accessory expands to 2", accessorySets.work.length === 2);
ok(
  "accessory rest note",
  accessorySets.trailingNotes.some(function (n) { return /Rest 60 sec/i.test(n); })
);

/* Image 6 — comma warmup, EMOM Min1; Min2, pipe Min stations */
const friWarmup = classifyPprogPartLines([
  "Intent: Prep shoulder alignment and agility balance.",
  "3 Rounds: 100m Run, 3 Wall Walks, 10 KB Goblet Squats (24kg), 10 Hollow Rocks.",
]);
ok("fri warmup expands to 4", friWarmup.work.length === 4);

const emomMins = classifyPprogPartLines([
  "Intent: Explosive hinge capacity (10 min effective duration).",
  "EMOM 10 min: Min 1: 6 Alternating DB Snatches (22.5kg) - focus maximum speed; Min 2: 8 Strict Chest-to-Bar Pull-ups.",
]);
ok("emom peels format", /^EMOM 10 min:$/i.test(emomMins.format));
ok("emom min stations split to 2", emomMins.work.length === 2);
ok("emom min1 kept", /^Min 1:/i.test(emomMins.work[0]));
ok("emom min2 kept", /^Min 2:/i.test(emomMins.work[1]));

const pipeEmom = classifyPprogPartLines([
  "Intent: Oxidative engine & gymnastics stamina under clock control (24 min duration).",
  "24-Minute EMOM (4 Rounds of 6 stations):",
  "Min 1: 200m Run | Min 2: 10m Handstand Walk (or 3 Wall Walks) | Min 3: 14 Single KB Goblet Walking Lunges (24kg)",
  "Min 4: 12 Toes-to-Bar | Min 5: 12 Lateral Burpees Over DB | Min 6: Rest.",
]);
ok("24-minute EMOM is format", /24-Minute EMOM/i.test(pipeEmom.format));
ok("pipe mins expand to 6", pipeEmom.work.length === 6);
ok("pipe mins no | left", pipeEmom.work.every(function (w) { return !/\|/.test(w); }));
ok("pipe min6 rest station kept", /Min 6:\s*Rest/i.test(pipeEmom.work[5]));

console.log("All pprog-part-display checks passed.");
