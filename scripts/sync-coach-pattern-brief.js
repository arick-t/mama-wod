#!/usr/bin/env node
/**
 * Sync living-knowledge markdown → api/coach-pattern-brief.js (compact runtime brief).
 * Keeps programming path able to use pattern craft without File Search.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(
  ROOT,
  "experiments",
  "personal-coach",
  "living-knowledge",
  "coach-patterns-myleo-restoration.md"
);
const WH = path.join(
  ROOT,
  "experiments",
  "personal-coach",
  "living-knowledge",
  "coach-formats-warehouse.md"
);
const OUT = path.join(ROOT, "api", "coach-pattern-brief.js");

/** Prefer hand-maintained compact brief; only rewrite if FORCE_PATTERN_BRIEF_REGEN=1 */
function main() {
  if (process.env.FORCE_PATTERN_BRIEF_REGEN !== "1") {
    if (fs.existsSync(OUT)) {
      console.log("kept existing api/coach-pattern-brief.js (set FORCE_PATTERN_BRIEF_REGEN=1 to rebuild from md)");
      return;
    }
  }
  const patterns = fs.existsSync(SRC) ? fs.readFileSync(SRC, "utf8") : "";
  const warehouse = fs.existsSync(WH) ? fs.readFileSync(WH, "utf8") : "";
  const compact =
    "LIVING PATTERN BRIEF (craft only — never copy sessions; never name sources):\n" +
    "See POL-021. Patterns MD chars=" +
    patterns.length +
    " warehouse MD chars=" +
    warehouse.length +
    ".\n" +
    "Use day architecture, format habits, pairings, loading language from living digests; warehouses = rare format seasoning.\n";
  const body =
    "/**\n * Auto note — prefer curated brief in repo; FORCE_PATTERN_BRIEF_REGEN rebuilds a stub.\n */\n" +
    "module.exports = " +
    JSON.stringify(compact) +
    ";\n";
  fs.writeFileSync(OUT, body, "utf8");
  console.log("wrote", OUT, compact.length, "chars");
}

main();
