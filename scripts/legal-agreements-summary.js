#!/usr/bin/env node
/**
 * List Personal Coach Terms acceptances from data/legal-agreements.jsonl
 *
 *   node scripts/legal-agreements-summary.js
 *   node scripts/legal-agreements-summary.js --json
 */
const fs = require("fs");
const path = require("path");

const file =
  process.env.LEGAL_AGREEMENTS_FILE ||
  path.join(__dirname, "..", "data", "legal-agreements.jsonl");
const asJson = process.argv.indexOf("--json") >= 0;

if (!fs.existsSync(file)) {
  console.log("No legal agreements file yet:", file);
  process.exit(0);
}

const lines = fs
  .readFileSync(file, "utf8")
  .split(/\r?\n/)
  .map(function (l) {
    return l.trim();
  })
  .filter(Boolean);

const rows = [];
for (let i = 0; i < lines.length; i++) {
  try {
    const o = JSON.parse(lines[i]);
    if (!o || typeof o !== "object") continue;
    rows.push(o);
  } catch (e) {
    /* skip bad lines */
  }
}

if (asJson) {
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

console.log("Legal agreements:", rows.length, "row(s)");
console.log("File:", file);
console.log("---");
if (!rows.length) {
  console.log("(empty — no Agree & Continue logged yet)");
  process.exit(0);
}

const byUser = {};
for (let r = 0; r < rows.length; r++) {
  const row = rows[r];
  const uid = String(row.userId || row.uid || "?");
  if (!byUser[uid]) byUser[uid] = [];
  byUser[uid].push(row);
}

const uids = Object.keys(byUser).sort();
for (let u = 0; u < uids.length; u++) {
  const uid = uids[u];
  const list = byUser[uid];
  const latest = list[list.length - 1];
  const name = latest.displayName ? " (" + latest.displayName + ")" : "";
  console.log(
    uid +
      name +
      "\n  terms: " +
      (latest.termsVersion || "?") +
      "  acceptedAt: " +
      (latest.acceptedAt || "?") +
      "  ip: " +
      (latest.ip || "?") +
      "  agreements logged: " +
      list.length
  );
}
