/**
 * Personal Coach part display — chipper arrows + coach cues as notes.
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
ok("coach note helper", /function isPprogPartCoachNoteLine/.test(index));
ok("classify peels trailing coach notes", /isPprogPartCoachNoteLine\(work\[work\.length - 1\]\)/.test(index));
ok("classify expands work arrows", /work = expandPprogWorkLines\(work\)/.test(index));
ok("admin has same helpers", /expandPprogChipperArrowLine/.test(admin) && /isPprogPartCoachNoteLine/.test(admin));
ok("admin trailing notes render", /trailingNotes/.test(admin));
ok("POL-012 one movement per line", /one movement \/ station per line|one movement per line/i.test(rules));
ok("POL-012 no arrow chipper", /Do \*\*not\*\* join a chipper|no -> chipper/i.test(rules + pc));
ok("flat back cue pattern", /flat back/i.test(index));
ok("rest between sets pattern", /between\|sets/i.test(index) || /between\|sets\?/.test(index));

/* Execute helpers by eval'ing extracted functions from index (minimal). */
function extractFn(src, name) {
  const re = new RegExp("function " + name + "\\([\\s\\S]*?\\n\\}\\n");
  const m = src.match(re);
  assert.ok(m, "extract " + name);
  return m[0];
}
const bundle =
  extractFn(index, "isPprogPartIntentNoteLine") +
  extractFn(index, "isPprogPartCoachNoteLine") +
  extractFn(index, "expandPprogChipperArrowLine") +
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

console.log("All pprog-part-display checks passed.");
