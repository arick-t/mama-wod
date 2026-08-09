/**
 * Confirm? → one-tap כן chip (client UX).
 * Run: node scripts/confirm-yes-chip.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

ok("detector helper", /function pprogCoachTextAsksConfirm/.test(index));
ok("should-show helper", /function pprogShouldShowConfirmYesChip/.test(index));
ok("chip html helper", /function pprogConfirmYesChipHtml/.test(index));
ok("send כן helper", /function sendPprogConfirmYes/.test(index));
ok("chip wired in daily chat render", /pprogShouldShowConfirmYesChip\(msgs\)/.test(index));
ok("chip CSS", /\.pprog-confirm-yes-btn/.test(index));
ok("sends Hebrew כן", /inp\.value = "כן"/.test(index));
ok("detects Confirm?", /\\\\bconfirm\\s\*\\\?/i.test(index) || /\\bconfirm\\s\*\\?/i.test(index));

console.log("All Confirm? כן-chip checks passed.");
