/**
 * THE EDITOR MUST NOT MAKE THE CHECK BLIND.
 *
 * A Hebrew programme shows Hebrew and keeps its English out of sight in `linesEn` /
 * `titleEn`, because English is the only language lib/coach-brick-check.js can read.
 * Opening a day in the editor and saving it used to drop that English, so one edit was
 * enough to leave a whole session unchecked — the same failure that reported a week of
 * "22 כפיפות בטן" as having no bodyweight work in it (owner, 2026-09-20).
 *
 * Run: node scripts/editor-keeps-english.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const D = require("../lib/pprog-display.js");
const Clip = require("../lib/pprog-clipboard.js");
const Check = require("../lib/coach-brick-check.js");

const root = path.join(__dirname, "..");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

/** A real part out of the block that went to a real client, in Hebrew. */
function hebrewPart() {
  return {
    id: "sun-0",
    title: "מטקון - METCON",
    lines: ["לבחור משקולת שתאפשר עבודה רציפה", "12 דקות - מקסימום עבודה", "22 כפיפות בטן", "10 מתח"],
    noteLines: 1,
    formatLine: 1,
    titleEn: "Conditioning Couplet",
    linesEn: ["לבחור משקולת שתאפשר עבודה רציפה", "AMRAP in 12 minutes:", "22 Sit-ups", "10 Pullup"],
  };
}

/** Through the editor and back out, exactly as saving a day does it. */
function roundTrip(part, change) {
  const draft = D.draftFromDayData({ parts: [part] }, false);
  if (change) change(draft[0]);
  return D.partsFromDraft({ parts: draft, day: "sun" })[0];
}

/** What the mechanical check actually reads off a part. */
function asRead(part) {
  return Check.walkLines({ weeks: [{ weekIndex: 1, days: { sun: { parts: [part] } } }] }).map(function (l) {
    return l.text;
  });
}

/* ── 1. a day he opened and saved without changing anything ─────────────────── */

const same = roundTrip(hebrewPart());
ok("an untouched part keeps its hidden English", Array.isArray(same.linesEn) && same.linesEn.length === 4);
ok("and keeps its English name", same.titleEn === "Conditioning Couplet");
ok("the check still reads English, not Hebrew", asRead(same).join(" | ").indexOf("22 Sit-ups") !== -1);
ok("what is SHOWN is still Hebrew", same.lines.join(" ").indexOf("22 כפיפות בטן") !== -1);

/* ── 2. carried by text, so the editor may move lines about ─────────────────── */

const moved = roundTrip(hebrewPart(), function (p) {
  p.work.reverse();
});
ok("reordered lines each keep their own English", asRead(moved).join(" | ") === "לבחור משקולת שתאפשר עבודה רציפה | AMRAP in 12 minutes: | 10 Pullup | 22 Sit-ups");

const shortened = roundTrip(hebrewPart(), function (p) {
  p.work[0] = "";
});
ok("a deleted line takes its English with it", shortened.linesEn.length === shortened.lines.length);
ok("and does not shift the English of the line below it", asRead(shortened).join(" | ").indexOf("10 Pullup") !== -1);

/* ── 3. a line he CHANGED must not keep English describing the old movement ─── */

const edited = roundTrip(hebrewPart(), function (p) {
  p.work[1] = "15 מתח";
});
ok("the changed line loses the stale English", edited.linesEn.indexOf("10 Pullup") === -1);
ok("the check is handed the line he actually typed", edited.linesEn.indexOf("15 מתח") !== -1);
ok("the lines he did not touch are untouched", edited.linesEn.indexOf("22 Sit-ups") !== -1);

const added = roundTrip(hebrewPart(), function (p) {
  p.work.push("30 קפיצות על קופסה");
});
ok("a new line keeps the two sides the same length", added.linesEn.length === added.lines.length);
ok("a new line reads to the check as he typed it", added.linesEn[added.linesEn.length - 1] === "30 קפיצות על קופסה");

const renamed = roundTrip(hebrewPart(), function (p) {
  p.title = "מטקון ארוך";
});
ok("renaming the part drops the old English name", renamed.titleEn === undefined);

/* ── 4. a programme written in English gains nothing it did not have ────────── */

const english = roundTrip({ id: "sun-0", title: "Strength", lines: ["5 Back Squats"], noteLines: 0, formatLine: 0 });
ok("an English-only part is not given a copy of itself", english.linesEn === undefined);
ok("nor an English name", english.titleEn === undefined);

/* ── 5. copying a part to another day carries the English too ───────────────── */

const copied = Clip.copyPart(hebrewPart(), "mon-1");
ok("a copied part carries its hidden English", (copied.linesEn || []).join(" ").indexOf("22 Sit-ups") !== -1);
ok("a copied part carries its English name", copied.titleEn === "Conditioning Couplet");
ok("the copy is checked in English where it lands", asRead(copied).join(" | ").indexOf("10 Pullup") !== -1);

/* ── 6. one converter, not two ──────────────────────────────────────────────── */

ok("the athlete screen saves through the shared converter", /function adminDraftToParts[\s\S]{0,900}PprogDisplay\.partsFromDraft/.test(admin));

/* ── 7. the whole reason this exists ────────────────────────────────────────── */

const before = asRead(hebrewPart()).join(" | ");
const after = asRead(roundTrip(hebrewPart())).join(" | ");
ok("an edit changes nothing about what the check sees", before === after);

console.log("\nכל הבדיקות עברו — העורך כבר לא מעוור את הבודק.");
