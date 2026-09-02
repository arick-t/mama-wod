#!/usr/bin/env node
/**
 * The two 21.7 pages are hand-written monoliths whose whole behaviour lives in one
 * inline <script>. A single stray brace there is a blank page for a paying client, and
 * nothing else in the suite would catch it — the other tests read the file as TEXT.
 *
 * So: pull every inline script out and hand it to the JS parser.
 *
 * It also catches the mistake that actually bit us: a `var` declared inside one
 * function and used from another reads fine as text and throws a ReferenceError at
 * runtime. Parsing does not catch that either, so the identifier checks below name the
 * specific globals the brick view's hooks must expose, since lib/pprog-display.js
 * renders those names straight into onclick attributes — a typo there is a dead button.
 *
 * 0 LLM. No network.
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
let passed = 0;

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok — " + name);
  passed++;
}

function inlineScripts(html) {
  /* Only inline blocks: a <script src=...> has no body to check. */
  const out = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

/** The hook names lib/pprog-display.js will emit into onclick attributes. */
const BRICK_HOOKS = [
  "cvCalShift",
  "cvToggleCalMode",
  "cvJumpToday",
  "cvSetDay",
  "cvSelectWeek",
  "cvSelectDow",
  "cvClearSelection",
  "cvStartEdit",
  "cvEditSet",
  "cvEditAddNote",
  "cvEditAddWork",
  "cvEditAddPart",
  "cvEditRemoveWork",
  "cvEditCancel",
  "cvEditSave",
  "cvMakeRest",
];

/* The client screen moved into admin.html (owner, 2026-09-02: one management page), so
   that is where these checks look for it. client.html is the client's own surface and
   is unchanged. */
["admin.html", "client.html"].forEach(function (file) {
  const html = fs.readFileSync(path.join(ROOT, file), "utf8");
  const blocks = inlineScripts(html);
  ok(file + " has an inline script", blocks.length >= 1);

  blocks.forEach(function (src, i) {
    let threw = null;
    try {
      /* Parse only — never run. Running would need a DOM and would prove nothing
         about the syntax, which is the whole point here. */
      new vm.Script(src, { filename: file + " inline#" + i });
    } catch (e) {
      threw = e;
    }
    ok(file + " inline script #" + i + " parses", !threw, threw && threw.message);
  });

  const all = blocks.join("\n");

  /* Every hook the renderer will name must be assigned on window, or the button it
     is wired to does nothing and the page looks broken with no error. */
  BRICK_HOOKS.forEach(function (h) {
    ok(
      file + " defines window." + h,
      all.indexOf("window." + h + " =") >= 0
    );
  });

  /* The bug this file exists for: RT was declared inside renderAdminDays and used
     inside saveDay, so every save threw before it reached the network. */
  const rtDecls = all.match(/\bvar RT\b/g) || [];
  ok(file + " declares RT exactly once", rtDecls.length === 1);
  ok(
    file + " declares RT at module scope, not inside a function",
    /\n {2}var RT = window\.DayRestToggle/.test(all)
  );

  /* The old textarea editor is gone in both directions — leaving half of it behind
     is how a dead "Save" button survives a refactor. */
  ok(file + " no longer builds parts from free text", all.indexOf("function textToParts") < 0);
  ok(file + " no longer flattens parts to text", all.indexOf("function partsToText") < 0);
  ok(file + " has no stale week-bar renderer", all.indexOf("function renderWeekBar") < 0);
  ok(file + " keeps no stale S.week / state.week", !/\b(S|state)\.week\b/.test(all));
  ok(file + " keeps no stale .editing flag", !/\b(S|state)\.editing\b/.test(all));

  /* The brick is rendered by the shared library, not re-implemented. */
  ok(file + " renders the shared brick view", all.indexOf("renderBrickView(") >= 0);
  ok(file + " asks for no footer — this page is not an AI surface", /showFooter:\s*false/.test(all));
  /* admin.html IS the source that stylesheet is cut from, so it carries the rules
     inline; client.html links the generated copy. Either way the brick is styled. */
  ok(
    file + " has the brick view styled",
    html.indexOf("styles/pprog-display.css") >= 0 || html.indexOf(".pprog-day-card") >= 0
  );

  /* Both directions of the rest toggle, which is what the owner asked for. */
  ok(file + " can turn a written day back into rest", all.indexOf("data-makerest") >= 0);
  ok(file + " routes a rest change through the shared toggle", /RT\.makeRest|cvMakeRest/.test(all));
  ok(
    file + " opens a rest day with an empty draft rather than refusing",
    /rest \? \[\] :/.test(all)
  );
  /* A block that starts mid-week still needs its first days written, and the owner
     decided a client edits without limit — so the date lock must be lifted here. */
  ok(file + " lifts the past-date lock", /allowPastEdit:\s*true/.test(all));
  /* A 4-week program (no deload) must not show a W5 rail that leads nowhere. */
  ok(file + " shows the program's real length", /weekRows: weekCount\(\)/.test(all));
  /* There is no AI on either page. The athlete app's "still being generated" would tell
     a paying client to wait for something that is never coming. */
  ok(file + " words an empty day truthfully", /emptyDayHtml:/.test(all));
  ok(file + " never claims a session is being generated", !/still being generated/.test(all));
});

/* One page: the strip carries everyone, and the content area holds exactly one thing at
   a time — an athlete, an open client, or the wizard (owner, 2026-09-02). */
const adminPage = fs.readFileSync(path.join(ROOT, "admin.html"), "utf8");
ok("there is no list card left", !/id="listCard"/.test(adminPage));
ok("the strip carries everyone", /class="tabs-bar" id="athlete-tabs"/.test(adminPage));
ok("one switch decides which view owns the screen", /function renderViewMode/.test(adminPage));
ok("the client screen and the athlete side take turns", /athleteSide\.hidden = mine/.test(adminPage));
ok("the wizard hides when it is not wanted", adminPage.indexOf('show("intakeCard", S.adding)') >= 0);
ok("a list refresh cannot pull the list back over the wizard", (adminPage.match(/renderViewMode\(\)/g) || []).length >= 3);
ok("there is one way into the wizard", /function chooseClientKind/.test(adminPage) && /ClientScreen\.newClient\(\)/.test(adminPage));
ok("and a way out of it", /id="iCancel"/.test(adminPage));
ok("leaving the wizard asks first", /confirm\("לצאת מהתחקור/.test(adminPage));
/* A mailed link names a client and must land on them, not on a list. */
ok("a mailed link opens that client", /new URLSearchParams\(location\.search\)\.get\("program"\)/.test(adminPage));

/* The generated stylesheet must actually carry the two things it exists for. */
const css = fs.readFileSync(path.join(ROOT, "styles", "pprog-display.css"), "utf8");
ok("the shared stylesheet is marked generated", /GENERATED FILE/.test(css));
ok("it styles the calendar cells", css.indexOf(".pprog-cal-cell{") >= 0);
ok("it styles the wide horizontal strip", css.indexOf(".pprog-width-strip{") >= 0);
ok("it styles the day card", css.indexOf(".pprog-day-card") >= 0);
/* Look at the RULES, not the header — the header explains the exclusion and would
   match its own description otherwise. */
const cssRules = css.slice(css.indexOf("*/") + 2);
ok("it drags in no admin-only intake scoping", cssRules.indexOf("#intake-fixed") < 0);

/* ------------------------------------------------------------------------
 * A library handle used in a function that never took one.
 *
 * This is not hypothetical: brickOpts() in client.html read "D.waIconSvg" while D was
 * a local of renderDays(), so building the options threw and the client's page drew
 * NOTHING — a blank panel with a print link on it. A parser cannot see that, and no
 * other test executes these pages, so it is checked statically here: any function body
 * that reaches for one of the library handles must also declare it.
 * --------------------------------------------------------------------- */
const HANDLES = ["D", "RT", "CI"];
for (const page of ["admin.html", "client.html"]) {
  const src = fs.readFileSync(path.join(ROOT, page), "utf8");
  for (const m of src.matchAll(/\n  function ([A-Za-z0-9_]+)\(([^)]*)\)\s*\{/g)) {
    const name = m[1];
    const args = m[2];
    /* Read the body by brace depth, starting at the opening brace. */
    let i = src.indexOf("{", m.index + m[0].length - 1);
    let depth = 0;
    let end = i;
    for (; end < src.length; end++) {
      if (src[end] === "{") depth++;
      else if (src[end] === "}") { depth--; if (!depth) break; }
    }
    const body = src.slice(i, end + 1);
    for (const h of HANDLES) {
      /* A handle declared once at page level (two-space indent, inside the IIFE) is
         in scope everywhere. Only the ones taken per function have to be taken. */
      if (new RegExp("\\n  var " + h + "\\s*=").test(src)) continue;
      const uses = new RegExp("[^A-Za-z0-9_.$]" + h + "\\s*(\\.|&&|\\?|\\|\\|)").test(body);
      if (!uses) continue;
      const declares =
        new RegExp("var\\s+" + h + "\\s*=").test(body) ||
        new RegExp("(^|[^A-Za-z0-9_])" + h + "([^A-Za-z0-9_]|$)").test(args);
      ok(page + " · " + name + "() takes its own " + h, declares);
    }
  }
}

console.log("All client page syntax checks passed (" + passed + " assertions).");
