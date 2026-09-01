#!/usr/bin/env node
/**
 * Generates styles/admin-shell.css from admin.html.
 *
 * WHY THIS EXISTS
 * admin-clients.html is a second page of the SAME back office, and the owner's
 * instruction on 2026-09-01 was blunt: do not reinvent the admin module — the landing
 * page's design and the data it shows stay as they are, and we build on top. The page
 * had grown its own shell (a narrow centred column with a title row) which read as a
 * different product next to admin.html's full-height app bar and tab strip.
 *
 * So the shell is EXTRACTED from admin.html rather than re-typed: the header, the
 * header buttons, the tab strip, and the content area, verbatim. A copy that is typed
 * is a copy that drifts; a copy that is generated cannot.
 *
 * admin.html keeps its inline copy — it is live and rewriting a 201KB production file's
 * CSS mid-test is exactly the risk the working agreement forbids. This file is the same
 * bytes, served to the second page.
 *
 * DO NOT HAND-EDIT styles/admin-shell.css. Edit admin.html's rules, then:
 *     node scripts/extract-admin-shell-css.js
 * scripts/admin-shell-css-shared.test.js fails if the file on disk drifts.
 *
 * 0 LLM. No network.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "admin.html");
const TARGET = path.join(ROOT, "styles", "admin-shell.css");

const HEADER = `/* GENERATED FILE — DO NOT EDIT BY HAND.
   Source: admin.html  ·  Regenerate: node scripts/extract-admin-shell-css.js

   The admin module's shell: the app frame, the header bar and its buttons, the tab
   strip the owner flips between people with, and the scrolling content area.

   Extracted verbatim from admin.html so admin-clients.html is the same back office
   rather than a lookalike. The owner's rule (2026-09-01): we build on what is already
   approved, we do not redesign it. */

`;

/** The shell, by selector prefix. Everything else stays admin.html's own business. */
const SHELL = [
  "#app",
  "header",
  ".count-wrap",
  ".credit-pill",
  ".hdr-btn",
  ".hdr-toast",
  ".tabs-bar",
  ".athlete-tab",
  ".empty-tabs",
  ".main",
  ".content",
  ".empty-content",
];

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

/** The selector, with any comment that happens to sit above it stripped off. */
function selectorOf(rule) {
  return rule
    .split("{", 1)[0]
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();
}

function wanted(sel) {
  if (!sel || sel.startsWith("@")) return false;
  return sel.split(",").some(function (one) {
    const s = one.trim();
    return SHELL.some(function (prefix) {
      if (s === prefix) return true;
      /* A descendant or a state of the same thing: "header .logo", ".hdr-btn.primary".
         Never a different class that merely starts with the same letters. */
      const next = s.slice(prefix.length, prefix.length + 1);
      return s.startsWith(prefix) && (next === " " || next === "." || next === ":" || next === "#");
    });
  });
}

function build() {
  const src = fs.readFileSync(SOURCE, "utf8");
  const m = src.match(/<style>([\s\S]*?)<\/style>/);
  if (!m) throw new Error("admin.html has no <style> block — cannot extract.");

  const kept = [];
  for (const rule of splitRules(m[1])) {
    const sel = selectorOf(rule);
    if (sel.startsWith("@media")) {
      const body = rule.slice(rule.indexOf("{") + 1, rule.lastIndexOf("}"));
      const inner = splitRules(body)
        .filter(function (r) {
          return wanted(selectorOf(r));
        })
        .map(function (r) {
          return r.trim();
        });
      if (inner.length) kept.push(sel + "{\n" + inner.join("\n") + "\n}");
    } else if (wanted(sel)) {
      /* The rule is kept whole, comment and all — the comment is why it looks the way
         it does, and it belongs with the rule. */
      kept.push(rule.trim());
    }
  }
  if (!kept.length) throw new Error("No shell rules found — refusing to write an empty sheet.");
  return { css: HEADER + kept.join("\n") + "\n", count: kept.length };
}

module.exports = { build };

if (require.main === module) {
  const { css, count } = build();
  fs.mkdirSync(path.dirname(TARGET), { recursive: true });
  fs.writeFileSync(TARGET, css, "utf8");
  console.log("wrote styles/admin-shell.css — " + count + " rules, " + css.length + " bytes");
}
