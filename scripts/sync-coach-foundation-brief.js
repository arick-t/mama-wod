#!/usr/bin/env node
/**
 * Sync living-knowledge foundation markdown → api/coach-foundation-brief.js
 * Default: keep curated brief unless FORCE_FOUNDATION_BRIEF_REGEN=1
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "api", "coach-foundation-brief.js");
const L12 = path.join(
  ROOT,
  "experiments",
  "personal-coach",
  "living-knowledge",
  "l1-l2-programming-foundation.md"
);
const PAT = path.join(
  ROOT,
  "experiments",
  "personal-coach",
  "living-knowledge",
  "source-patterns-digest.md"
);

function main() {
  if (process.env.FORCE_FOUNDATION_BRIEF_REGEN !== "1") {
    if (fs.existsSync(OUT)) {
      console.log(
        "kept existing api/coach-foundation-brief.js (set FORCE_FOUNDATION_BRIEF_REGEN=1 to stub-regen)"
      );
      return;
    }
  }
  const a = fs.existsSync(L12) ? fs.readFileSync(L12, "utf8").length : 0;
  const b = fs.existsSync(PAT) ? fs.readFileSync(PAT, "utf8").length : 0;
  const compact =
    "FOUNDATION BRIEF STUB — regenerate curated brief manually. " +
    "l1-l2 md chars=" +
    a +
    " source-patterns md chars=" +
    b +
    ".\n";
  fs.writeFileSync(
    OUT,
    "module.exports = " + JSON.stringify(compact) + ";\n",
    "utf8"
  );
  console.log("wrote stub", OUT);
}

main();
