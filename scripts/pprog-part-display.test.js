/**
 * Part A/B/C headings + Target/Intent note classification (display hierarchy).
 */
const fs = require("fs");
const path = require("path");
const assert = require("assert");

function formatPprogPartHeading(partIndex, rawTitle) {
  var letter = String.fromCharCode(65 + (partIndex | 0));
  var t = String(rawTitle || "").trim();
  if (!t) return "Part " + letter;
  if (/^Part\s+[A-Z]\b/i.test(t)) return t;
  return "Part " + letter + " — " + t;
}

function isPprogPartIntentNoteLine(line) {
  var t = String(line || "").trim();
  if (!t) return false;
  if (/^target\s*:/i.test(t)) return true;
  if (/^(target\s+)?duration\s*:/i.test(t)) return true;
  if (/^movement(\s+intent)?\s*:/i.test(t)) return true;
  if (/duration\s*:/i.test(t) && /movement/i.test(t)) return true;
  if (/\beffective\s+target\b/i.test(t)) return true;
  if (/^\d+\s*-\s*\d+\s*min(ute)?s?\b/i.test(t) && /target|intent|focus|engine|strength|skill/i.test(t)) {
    return true;
  }
  if (/^\d+\s*min(ute)?s?\b/i.test(t) && /target|intent|focus|engine|priority/i.test(t)) {
    return true;
  }
  if (/^(intent|focus|cue|note|goal)\s*[:—-]/i.test(t)) return true;
  if (/^focus on\b/i.test(t)) return true;
  return false;
}

assert.strictEqual(formatPprogPartHeading(0, "Extended Dynamic Warm-up"), "Part A — Extended Dynamic Warm-up");
assert.strictEqual(formatPprogPartHeading(1, "Handstand Walk & Pistol Skill"), "Part B — Handstand Walk & Pistol Skill");
assert.strictEqual(formatPprogPartHeading(2, "Metcon - Weekend Engine Grind"), "Part C — Metcon - Weekend Engine Grind");
assert.strictEqual(formatPprogPartHeading(0, ""), "Part A");
assert.strictEqual(formatPprogPartHeading(1, "Part B — Already labeled"), "Part B — Already labeled");
assert.strictEqual(formatPprogPartHeading(2, "Part C Skill"), "Part C Skill");

assert.ok(
  isPprogPartIntentNoteLine("Target: 10 min | Intent: Dynamic mobility and aerobic priming without running.")
);
assert.ok(isPprogPartIntentNoteLine("Intent: Coordination under low fatigue."));
assert.ok(!isPprogPartIntentNoteLine("10 thrusters"));
assert.ok(!isPprogPartIntentNoteLine("3 Rounds for Quality:"));

const indexHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
assert.ok(indexHtml.includes("function formatPprogPartHeading"), "index.html must define formatPprogPartHeading");
assert.ok(indexHtml.includes("formatPprogPartHeading(pi,"), "render must use formatPprogPartHeading");
assert.ok(/--note\s*:\s*#7eb8c9/.test(indexHtml), "note color token must be soft cyan");
assert.ok(/\.pprog-part-note\{[^}]*color:var\(--note\)/.test(indexHtml), "notes use --note, not muted body text");
assert.ok(indexHtml.includes("DAILY WORKOUTS · v21.5.3"), "display version bump");

console.log("pprog-part-display.test.js: ok");
