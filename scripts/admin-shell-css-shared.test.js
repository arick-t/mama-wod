#!/usr/bin/env node
/**
 * styles/admin-shell.css is GENERATED from admin.html by
 * scripts/extract-admin-shell-css.js.
 *
 * This is the guard rail that makes that claim true. The owner's instruction on
 * 2026-09-01 was that admin-clients.html is a second page of the SAME back office and
 * must not be a redesign of it — so the frame is admin.html's own rules, extracted.
 * Without this test the extracted sheet is just another copy that rots the moment
 * someone restyles the header in admin.html, and the two pages start looking like two
 * products again.
 *
 * If this fails, do NOT edit styles/admin-shell.css. Run:
 *     node scripts/extract-admin-shell-css.js
 *
 * 0 LLM. No network.
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const { build } = require("./extract-admin-shell-css.js");

let passed = 0;
function ok(name, cond, extra) {
  assert.ok(cond, name + (extra ? " — " + extra : ""));
  console.log("ok — " + name);
  passed++;
}

const onDisk = fs.readFileSync(path.join(ROOT, "styles", "admin-shell.css"), "utf8");
const fresh = build();

/* Normalise line endings only: this clone is pinned to LF, but a checkout on another
   machine may not be, and CRLF is not drift. */
const norm = (s) => s.replace(/\r\n/g, "\n");

ok(
  "the shell stylesheet matches admin.html — regenerate with node scripts/extract-admin-shell-css.js",
  norm(onDisk) === norm(fresh.css)
);
ok("it carries a real number of rules", fresh.count >= 30, "got " + fresh.count);

/* Name the parts the second page actually stands on. Extraction would still "succeed"
   while producing a sheet with no frame in it. */
ok("the app frame survives extraction", fresh.css.indexOf("#app{") >= 0);
ok("and knows how to open", fresh.css.indexOf("#app.is-open{") >= 0);
ok("the header bar survives extraction", fresh.css.indexOf("header{") >= 0);
ok("the header buttons survive extraction", fresh.css.indexOf(".hdr-btn{") >= 0);
ok("the tab strip survives extraction", fresh.css.indexOf(".tabs-bar{") >= 0);
ok("the tabs themselves survive extraction", fresh.css.indexOf(".athlete-tab{") >= 0);
ok("the scrolling content area survives extraction", fresh.css.indexOf(".content{") >= 0);
ok("its small-screen rules survive extraction", /@media[^{]*\{[\s\S]*header/.test(fresh.css));

/* Nothing that belongs to admin.html alone should ride along. The brick view has its
   own sheet, and the athlete overlay means nothing on a page with no overlay. */
ok("it drags in no brick-view rules", fresh.css.indexOf(".pprog-day-card") < 0);
ok("it drags in no athlete intake overlay", fresh.css.indexOf("#intake-fixed") < 0);

/* The page must actually link it, and must not have grown its own frame beside it. */
const page = fs.readFileSync(path.join(ROOT, "admin-clients.html"), "utf8");
ok("admin-clients.html links the shell", /<link[^>]+styles\/admin-shell\.css/.test(page));
const style = (page.match(/<style>([\s\S]*?)<\/style>/) || ["", ""])[1];
ok("it does not re-declare the header bar", !/(^|\n)header\{/.test(style));
ok("it does not re-declare the tab strip", style.indexOf(".tabs-bar{") < 0);
ok("it does not re-declare the tabs", style.indexOf(".athlete-tab{") < 0);
ok("and keeps no narrow wrapper of its own", style.indexOf(".wrap{max-width") < 0);

/* admin.html stays the source. */
const adminHtml = fs.readFileSync(path.join(ROOT, "admin.html"), "utf8");
ok("admin.html still holds the source rules", adminHtml.indexOf(".tabs-bar{") >= 0);

console.log("All admin shell CSS checks passed (" + passed + " assertions).");
