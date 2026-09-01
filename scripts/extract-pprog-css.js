#!/usr/bin/env node
/**
 * Generates styles/pprog-display.css from admin.html.
 *
 * WHY THIS EXISTS
 * The brick view's markup comes from one place (lib/pprog-display.js) but its CSS was
 * copy-pasted into admin.html, index.html and preview-coach-calendar.html. The two new
 * 21.7 pages (admin-clients.html, client.html) must render the program in the view the
 * owner already knows — so rather than hand-write a fourth copy that silently drifts,
 * they link a stylesheet MECHANICALLY extracted from admin.html.
 *
 * admin.html and index.html keep their inline copies for now: they are live, and
 * rewriting a 201KB production file's CSS mid-test is exactly the kind of risk the
 * working agreement forbids. Folding them onto this file is a separate, deliberate job.
 *
 * DO NOT HAND-EDIT styles/pprog-display.css. Edit admin.html's rules, then:
 *     node scripts/extract-pprog-css.js
 * scripts/pprog-css-shared.test.js fails if the file on disk drifts from the source.
 *
 * 0 LLM. No network.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "admin.html");
const TARGET = path.join(ROOT, "styles", "pprog-display.css");

const HEADER = `/* GENERATED FILE — DO NOT EDIT BY HAND.
   Source: admin.html  ·  Regenerate: node scripts/extract-pprog-css.js

   The personal-coach brick view's look: the calendar, the day card, and the wide
   horizontal strip that appears when several days are selected.

   Extracted verbatim from admin.html so admin-clients.html and client.html render a
   program in the SAME view the owner already knows, instead of a second hand-written
   list that drifts from it. lib/pprog-display.js emits the markup; this file styles it.

   Rules scoped to admin.html's own #intake-fixed modal are deliberately excluded —
   they exist to make the athlete intake fit inside the admin overlay and mean nothing
   on a page that has no such overlay. */

`;

/** Split CSS into top-level rules. Brace-depth only — no selector parsing needed. */
function splitRules(text) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        out.push(text.slice(start, i + 1));
        start = i + 1;
      }
    }
  }
  return out;
}

function selectorOf(rule) {
  return rule.split("{", 1)[0].trim();
}

/** A rule belongs to the shared sheet if it styles pprog markup and is not admin-only. */
function wanted(sel) {
  return sel.indexOf("pprog") >= 0 && sel.indexOf("#intake-fixed") < 0;
}

function build() {
  const src = fs.readFileSync(SOURCE, "utf8");
  const m = src.match(/<style>([\s\S]*?)<\/style>/);
  if (!m) throw new Error("admin.html has no <style> block — cannot extract.");

  const kept = [];
  for (const rule of splitRules(m[1])) {
    const sel = selectorOf(rule);
    if (sel.startsWith("@media")) {
      /* Media queries are kept only for the pprog rules inside them, so the shared
         sheet carries the responsive behaviour without dragging in unrelated rules. */
      const body = rule.slice(rule.indexOf("{") + 1, rule.lastIndexOf("}"));
      const inner = splitRules(body)
        .filter((r) => wanted(selectorOf(r)))
        .map((r) => r.trim());
      if (inner.length) kept.push(sel + "{\n" + inner.join("\n") + "\n}");
    } else if (wanted(sel)) {
      kept.push(rule.trim());
    }
  }
  if (!kept.length) throw new Error("No pprog rules found — refusing to write an empty sheet.");
  return { css: HEADER + kept.join("\n") + "\n", count: kept.length };
}

module.exports = { build };

if (require.main === module) {
  const { css, count } = build();
  fs.mkdirSync(path.dirname(TARGET), { recursive: true });
  fs.writeFileSync(TARGET, css, "utf8");
  console.log("wrote styles/pprog-display.css — " + count + " rules, " + css.length + " bytes");
}
