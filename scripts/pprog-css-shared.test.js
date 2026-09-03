#!/usr/bin/env node
/**
 * styles/pprog-display.css is GENERATED from admin.html by scripts/extract-pprog-css.js.
 *
 * This is the guard rail that makes that claim true. Without it, the shared sheet is
 * just a fourth copy of the brick view's CSS that silently rots the moment someone
 * restyles the calendar in admin.html — and the drift shows up as a paying client's
 * program looking subtly wrong, which is the worst place to find out.
 *
 * If this fails, do NOT edit styles/pprog-display.css. Run:
 *     node scripts/extract-pprog-css.js
 *
 * 0 LLM. No network.
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const { build } = require("./extract-pprog-css.js");

let passed = 0;
function ok(name, cond, extra) {
  assert.ok(cond, name + (extra ? " — " + extra : ""));
  console.log("ok — " + name);
  passed++;
}

const onDisk = fs.readFileSync(path.join(ROOT, "styles", "pprog-display.css"), "utf8");
const fresh = build();

/* Normalise line endings only: this clone is pinned to LF, but a checkout on another
   machine may not be, and CRLF is not drift. */
const norm = (s) => s.replace(/\r\n/g, "\n");

ok(
  "the shared stylesheet matches admin.html — regenerate with node scripts/extract-pprog-css.js",
  norm(onDisk) === norm(fresh.css)
);
ok("it carries a real number of rules", fresh.count >= 60, "got " + fresh.count);

/* The two things the new pages actually depend on. If either vanished from admin.html
   the extraction would still "succeed" while producing a sheet that cannot lay out a
   program, so name them. */
ok("the calendar grid survives extraction", fresh.css.indexOf(".pprog-cal-month-grid{") >= 0);
ok("the day card survives extraction", fresh.css.indexOf(".pprog-day-card") >= 0);
ok(
  "the wide horizontal strip survives extraction",
  fresh.css.indexOf(".pprog-width-strip{") >= 0
);
ok("its responsive rules survive extraction", /@media[^{]*\{[\s\S]*pprog/.test(fresh.css));

/* Both new pages must actually link it, or all of the above is decoration. */
/* Only client.html links the generated copy now: the client screen moved into
   admin.html, which is the SOURCE these rules are cut from and carries them inline
   (owner, 2026-09-02 — one management page). */
["client.html"].forEach(function (f) {
  const html = fs.readFileSync(path.join(ROOT, f), "utf8");
  ok(f + " links the shared stylesheet", /<link[^>]+styles\/pprog-display\.css/.test(html));
  /* And must not have grown its own copy of the same rules. */
  const style = (html.match(/<style>([\s\S]*?)<\/style>/) || ["", ""])[1];
  ok(f + " does not re-declare the calendar cell", style.indexOf(".pprog-cal-cell{") < 0);
});

/* admin.html stays the source. If someone deletes its inline block without moving the
   pages onto the shared sheet, extraction goes empty and every client page loses its
   layout — so fail loudly here instead. */
const adminHtml = fs.readFileSync(path.join(ROOT, "admin.html"), "utf8");
ok("admin.html still holds the source rules", adminHtml.indexOf(".pprog-cal-cell{") >= 0);

console.log("All shared pprog CSS checks passed (" + passed + " assertions).");
