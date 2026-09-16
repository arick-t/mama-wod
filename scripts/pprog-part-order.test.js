/**
 * Parts: their names, their numbers, their order — and the two bugs beside them.
 * Run: node scripts/pprog-part-order.test.js
 *
 * The owner numbered this round himself (owner, 2026-09-09):
 *
 *   1.א  renaming a part must be a FULL rename — "PART A" could not be got rid of,
 *        however he renamed the part, because the heading was built as
 *        "Part " + letter + " — " + his text.
 *   1.ב  parts are numbered automatically, and moving one renumbers the rest:
 *        "1 מיד למעלה וכן הלאה".
 *   1.ג  hold a part with the mouse and drag it up or down inside the day.
 *   2    Enter inside a NOTE opens another note below it, as it already does in a
 *        work line.
 *   3    a phone tap on "Add numbering" left the last day of a real client's block
 *        showing a rest day that could not be unticked, deleted or replaced.
 *   4    comparing one session across four weeks labelled every card with the day
 *        selected last — four cards all reading "אימון 1 · שבוע 4".
 *
 * All of it on BOTH sides: his back office and the page his clients open by link.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  passed += 1;
  console.log("ok —", name);
}

const D = require("../lib/pprog-display.js");
const N = require("../lib/normalize-pprog-block.js");
const root = path.join(__dirname, "..");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const client = fs.readFileSync(path.join(root, "client.html"), "utf8");
const lib = fs.readFileSync(path.join(root, "lib", "pprog-display.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles", "pprog-display.css"), "utf8");

/* ── 1.א  a rename is the whole name ─────────────────────────────────────── */

ok("the generated name leaves nothing behind", D.cleanPartTitle("Part A") === "");
ok("a coach-brain title loses its prefix", D.cleanPartTitle("Part B - bench press Progression") === "bench press Progression");
ok("with an em dash too", D.cleanPartTitle("Part C — Interval Rounds") === "Interval Rounds");
ok("and with a colon", D.cleanPartTitle("PART D: Accessory") === "Accessory");
/* His own Hebrew name comes through untouched — that is the point of the round. */
ok("a name he typed is left alone", D.cleanPartTitle("אימון תחנות") === "אימון תחנות");
ok("a name that merely starts with the word part survives", D.cleanPartTitle("Partner WOD") === "Partner WOD");
ok("his own numbering is not doubled", D.cleanPartTitle("1. חימום") === "חימום");
/* THE BUG: the words PART A are gone from the heading, whatever he calls the part. */
ok("the heading is his name, numbered", D.formatPartHeading(0, "Part A — Strength") === "1 — Strength");
ok("nothing says Part any more", D.formatPartHeading(1, "Part B - Metcon").indexOf("Part") < 0);
ok("an unnamed part is just its number", D.formatPartHeading(2, "") === "3");
/* And the field he types into holds the NAME ONLY, so clearing it clears everything. */
const draft = D.draftFromDayData({ parts: [{ title: "Part A - Warm-Up", lines: ["3 rounds"] }] }, false);
ok("the edit field holds the name without the prefix", draft[0].title === "Warm-Up");
ok("the field is empty rather than pre-filled", /placeholder="שם החלק"/.test(lib) && lib.indexOf('esc(part.title || "Part " + nextPartLetter(pi))') < 0);
for (const [label, src] of [["the back office", admin], ["the client's page", client]]) {
  ok(label + " opens a new part with no name in it", /parts\.push\(\{ title: "", notes: \[""\], format: "", work: \[""\] \}\)/.test(src));
  ok(label + " leaves an empty part with no name either", /\[\{ title: "", notes: \[""\], format: "", work: \[""\] \}\]/.test(src));
}

/* ── 1.ב  the number is where the part sits ──────────────────────────────── */

const three = ["חימום", "כוח", "מטקון"];
ok("they are numbered from the top", three.map((t, i) => D.formatPartHeading(i, t)).join(" | ") === "1 — חימום | 2 — כוח | 3 — מטקון");
/* Move the last one to the front: nothing is stored, so everything renumbers. */
const moved = ["מטקון", "חימום", "כוח"];
ok("moving one renumbers the rest", D.formatPartHeading(0, moved[0]) === "1 — מטקון" && D.formatPartHeading(2, moved[2]) === "3 — כוח");
ok("the editor draws the number beside the name", /<span class="pprog-part-n" aria-hidden="true">' \+ \(pi \+ 1\)/.test(lib));
ok("and it is a circle, not text in the field", /\.pprog-part-n\{/.test(css) && /border-radius:50%/.test(css.slice(css.indexOf(".pprog-part-n{"), css.indexOf(".pprog-part-n{") + 300)));
ok("the add-part button counts too", /＋ Add Part ' \+\s*\n?\s*\(parts\.length \+ 1\)/.test(lib));

/* ── 1.א+ב  the number's SIDE ────────────────────────────────────────────── */

/* As one string the number fell wherever the bidi algorithm put it: a Hebrew name threw
   it to the far left of the heading, so a column of parts had its numbers out of line
   (owner, 2026-09-09, with the picture). It is its own element now, first in the
   heading, so it leads in the PAGE's direction — right through his Hebrew back office,
   left on the client's English page. One side per page, not one side per part. */
const headingHtml = D.renderDayCardHtml(
  { blockStart: "2026-08-31", weeks: [{ weekIndex: 1, overview: [], days: { sun: { parts: [{ title: "כעגכעגכעג", lines: ["x"] }, { title: "Back Squat", lines: ["5x5"] }] } } }] },
  { weekIndex: 1, overview: [], days: { sun: { parts: [{ title: "כעגכעגכעג", lines: ["x"] }, { title: "Back Squat", lines: ["5x5"] }] } } },
  0,
  "sun",
  {}
);
ok("the number is an element, not part of the text", /<span class="pprog-part-n" aria-hidden="true">1<\/span>/.test(headingHtml));
ok("and it comes before the name", headingHtml.indexOf('class="pprog-part-n"') < headingHtml.indexOf('class="pprog-part-name"'));
ok("the Hebrew name still decides its own direction", /<span class="pprog-part-name" dir="auto">כעגכעגכעג<\/span>/.test(headingHtml));
ok("and so does the English one", /<span class="pprog-part-name" dir="auto">Back Squat<\/span>/.test(headingHtml));
ok("both headings are built the same way", (headingHtml.match(/class="section-title has-part-n"/g) || []).length === 2);
/* The heading itself forces nothing: the card as a whole sets ltr in places (the date
   row, the note field), but the two heading elements leave it to the page and to the
   name. */
const headingsOnly = (headingHtml.match(/<div class="section-title has-part-n">[\s\S]*?<\/div>/g) || []).join("");
ok("the heading forces no direction of its own", headingsOnly.indexOf('dir="rtl"') < 0 && headingsOnly.indexOf('dir="ltr"') < 0);
ok("the row lays them out rather than the text flow", /\.pprog-day-card \.section-title\.has-part-n\{display:flex/.test(css));

/* ── 1.ג  drag a part up and down inside the day ─────────────────────────── */

ok("the back office can move a part inside a day", admin.indexOf("window.cvMovePart = function (wi, day, from, to)") >= 0);
ok("a drop on the same day reorders instead of doing nothing", /if \(over && over === was\.card\) \{[\s\S]{0,320}window\.cvMovePart\(was\.wi, was\.day, was\.index, to\)/.test(admin));
/* With several days open, the move names its own day and finds that day's draft
   (owner, 2026-09-09). */
ok("it moves the part inside THAT day's draft", /var draft = draftFor\(editKeyOf\(wi, day\)\);[\s\S]{0,60}if \(!draft\) return;/.test(admin));
ok("dragging between two open days still works", admin.indexOf("pastePartHere(toWi + 1, toDay, part)") >= 0);
ok("the client's page can move a part too", client.indexOf("window.cvMovePart = function (from, to)") >= 0);
ok("with a grip binding of its own", /closest\("\[data-part-grip\]"\)/.test(client) && /function bindPartDrag\(\)/.test(client));
ok("and it is bound once, to the document", /\(function bindPartDrag\(\) \{/.test(client));
/* He can see where it will land. */
ok("the row shows where the part will land", /pprog-part-drop-above/.test(admin) && /pprog-part-drop-above/.test(client));
ok("and the line is drawn in CSS both sides use", /\.section-title-row\.pprog-part-drop-above/.test(css));
ok("Escape puts a drag back", /ev\.key === "Escape" && held/.test(admin) && /ev\.key === "Escape" && held/.test(client));

/* The move is ANIMATED, with the slide the client tabs use — he asked for the one we
   agreed on rather than a second kind of movement (owner, 2026-09-09). It cannot go
   through slideThings() as it stands: reordering redraws the card, so the nodes it
   measured are gone before it would animate them. */
for (const [label, src] of [["the back office", admin], ["the client's page", client]]) {
  ok(label + " measures the parts before the redraw", /function partBoxesIn\(wi, day\)/.test(src) && /var boxes = partBoxesIn\(/.test(src));
  ok(label + " knows where each part stood", /function partWasAt\(i, from, to\)/.test(src));
  ok(label + " animates them home afterwards", /function slidePartsFrom\(wi, day, boxes, from, to\)/.test(src));
  ok(label + " uses the agreed slide, to the millisecond", /transform 160ms cubic-bezier\(\.2,\.7,\.3,1\)/.test(src));
  ok(label + " takes the offset in one frame and lets it go in the next", /requestAnimationFrame\(function \(\) \{\s*\n\s*requestAnimationFrame/.test(src));
}
/* The arithmetic itself, which is what makes the slide land in the right place. */
const wasAt = (i, f, t) => (i === t ? f : f < t ? (i >= f && i < t ? i + 1 : i) : i > t && i <= f ? i - 1 : i);
ok("a part dragged down leaves the ones above it in place", [0, 1, 2, 3].map((i) => wasAt(i, 1, 3)).join() === "0,2,3,1");
ok("and dragged up, the ones below it", [0, 1, 2, 3].map((i) => wasAt(i, 3, 1)).join() === "0,3,1,2");
ok("nothing moves when it lands where it started", [0, 1, 2].map((i) => wasAt(i, 1, 1)).join() === "0,1,2");

/* ── 2  Enter in a note opens the next note ──────────────────────────────── */

/* K is the day this editor belongs to — empty for a page with one open day
   (owner, 2026-09-09). */
ok("the note row listens for Enter", /addNoteFn \+ "\(" \+ K \+ pi \+ "," \+ \(ni \+ 1\) \+ '\);\}">'/.test(lib));
ok("and it does not submit anything", /event\.preventDefault\(\);' \+\s*\n\s*addNoteFn/.test(lib));
for (const [label, src, render] of [["the back office", admin, "renderAdminDays"], ["the client's page", client, "renderDays"]]) {
  ok(label + " puts the new note where Enter was pressed", /window\.cvEditAddNote = function \((?:key, )?partIndex, atIndex\)/.test(src));
  ok(label + " does not just append it", new RegExp("part\\.notes\\.splice\\(at, 0, \"\"\\)").test(src));
  ok(label + " puts the caret in it", /function focusNoteRow\((?:key, )?partIndex, noteIndex\)/.test(src));
  ok(label + " keeps the page where it was", new RegExp("keepScroll\\(" + render + "\\)[\\s\\S]{0,80}focusNoteRow").test(src));
}

/* ── 3  a written day is never a rest day ────────────────────────────────── */

const stale = {
  overview: [{ day: "tue", focus: "Rest" }],
  days: { tue: { parts: [{ title: "Part A - Strength", lines: ["5x5 back squat"] }] } },
};
ok("his stuck day reads as a session again", N.isRestDay("tue", stale.days.tue, stale) === false);
ok("a Hebrew Rest row does not outrank a session either", N.isRestDay("tue", { parts: [{ title: "אימון תחנות", lines: ["10 סבבים"] }] }, { overview: [{ day: "tue", focus: "מנוחה" }] }) === false);
/* A rest day the coach actually meant is still a rest day. */
ok("a real rest day is untouched", N.isRestDay("tue", { parts: [{ title: "REST DAY", lines: ["Rest"] }] }, { overview: [{ day: "tue", focus: "Rest" }] }) === true);
ok("an empty day under a Rest row is still rest", N.isRestDay("tue", { parts: [] }, { overview: [{ day: "tue", focus: "Rest" }] }) === true);
ok("a placeholder the brain left is not a session", N.partsHoldSession([{ id: "overview-stub-1", title: "Part A", lines: ["Full session details still loading…"] }]) === false);
ok("a titled part with no lines is", N.partsHoldSession([{ title: "אימון תחנות", lines: [] }]) === true);
/* The tap that caused it must ask first, and an autosave must never wipe typed work. */
/* The tick belongs to a day too: with several cards open it reads the draft its own
   card names, rather than whichever draft was touched last (owner, 2026-09-09). */
ok("the tick asks before marking over typed work", /if \(t\.checked && draftHasTypedContent\(restDraft\)\)/.test(admin));
ok("and it is that card's own draft", /var restDraft = draftFor\(restKey\) \|\| S\.edit;/.test(admin));
ok("the same on the client's page", /if \(t\.checked && draftHasTypedContent\(state\.edit\)\)/.test(client));
for (const [label, src] of [["the back office", admin], ["the client's page", client]]) {
  ok(label + " keeps typed work when the day is left", /if \(draftHasTypedContent\(draft\)\) \{\s*\n\s*draft\.restIntent = false;/.test(src));
  ok(label + " has one place that answers what is typed", /function draftHasTypedContent\(draft\)/.test(src));
}

/* ── 4  every card wears its own label ───────────────────────────────────── */

ok("the card accepts a label function", /typeof opts\.dateLabelOverride === "function"/.test(lib));
ok("and asks it for this week and this day", /opts\.dateLabelOverride\(activeWi, day\)/.test(lib));
ok("a plain string still works for the app", /: opts\.dateLabelOverride;/.test(lib));
ok("the back office passes a function", /dateLabelOverride: sessions[\s\S]{0,60}function \(wi, dayKey\)/.test(admin));
ok("labelled from the card's own week", /"אימון " \+ \(i \+ 1\) \+ " · שבוע " \+ \(\(wi \| 0\) \+ 1\)/.test(admin));
ok("the client's page passes one too", /dateLabelOverride: sessionCardLabel,/.test(client));
ok("and reads the card's week, not the page's", /function sessionCardLabel\(wi, dayKey\)/.test(client));

/* Four cards, four labels — the picture he sent, put right. */
const block = { blockStart: "2026-08-31", weeks: [] };
for (let i = 0; i < 4; i++) block.weeks.push({ weekIndex: i + 1, overview: [], days: { sun: { parts: [{ title: "Part A", lines: ["5x5"] }] } } });
const labels = [];
for (let wi = 0; wi < 4; wi++) {
  const html = D.renderDayCardHtml(block, block.weeks[wi], wi, "sun", {
    sessionColumns: 3,
    dateLabelOverride: function (w, dayKey) {
      return "אימון " + (["sun", "mon", "tue"].indexOf(dayKey) + 1) + " · שבוע " + ((w | 0) + 1);
    },
  });
  const m = html.match(/אימון 1 · שבוע [0-9]/);
  labels.push(m ? m[0] : "");
}
ok("four cards of the same session carry four different weeks", new Set(labels).size === 4);
ok("and each one names its own", labels.join(" | ") === "אימון 1 · שבוע 1 | אימון 1 · שבוע 2 | אימון 1 · שבוע 3 | אימון 1 · שבוע 4");

console.log("\nAll part order / rename / numbering checks passed (" + passed + " assertions).");
