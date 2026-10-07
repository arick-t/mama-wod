/**
 * A brick, as a spreadsheet.
 * Run: node scripts/brick-export.test.js
 *
 * Two promises are asserted harder than the rest, because both are about what the
 * owner would send to somebody:
 *   - the sheet holds what the CLIENT sees and nothing else;
 *   - a session with eight lines lands in ONE cell, not eight rows.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const E = require("../lib/brick-export.js");

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  passed += 1;
  console.log("ok —", name);
}

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "admin.html"), "utf8");

const WEEKLY = {
  clientName: "עודד מכינה",
  blockStart: "2026-09-27",
  intake: { scheduleMode: "weekly_schedule" },
  blocks: [{ blockIndex: 1, startWeek: 1, weekCount: 2, name: "" }],
  weeks: [
    {
      weekIndex: 1,
      summaryLine: "שבוע 1 — בנייה",
      days: {
        sun: {
          parts: [
            { id: "a", title: "חימום", lines: ["10 דקות חתירה", "מתיחות"] },
            { id: "b", title: "כוח", lines: ["Back Squat — 5x5 @ 70%"] },
          ],
        },
        tue: { parts: [{ id: "c", title: "מטקון", lines: ["AMRAP 12", "10 Wall Balls"] }] },
      },
    },
    { weekIndex: 2, summaryLine: "", days: { sun: { parts: [{ id: "d", title: "כוח", lines: ["Deadlift 4x6"] }] } } },
  ],
};

/* --- the shape he reads ---------------------------------------------------- */

const g = E.grid(WEEKLY, 1);
const kinds = g.rows.map(function (r) { return r.kind; });
ok("it opens with who it is", g.rows[0].kind === "title" && g.rows[0].cells[0].indexOf("עודד מכינה") >= 0);
ok("a week is a line of its own", kinds.indexOf("week") === 1);
ok("then the dates", kinds[2] === "head");
ok("then the sessions", kinds[3] === "body");
ok("and a blank line between weeks", kinds[4] === "gap");
ok("week above week", kinds.filter(function (k) { return k === "week"; }).length === 2);
ok("a week with no line of its own is still named", g.rows[5].cells[0] === "שבוע 2");

/* --- the date in the cell, the session beneath it -------------------------- */

const head = g.rows[2].cells;
ok("the week opens on the block's first day", head[0].indexOf("27/09/26") === 0);
ok("seven days across", head.length === 7 && g.width === 7);
ok("the last of them is six days later", head[6].indexOf("03/10/26") === 0);
ok("the second week starts a week later", g.rows[6].cells[0].indexOf("04/10/26") === 0);
ok("a date carries its day name", head[0].indexOf("ראשון") > 0);

const body = g.rows[3].cells;
ok("the whole session is in ONE cell", body[0].indexOf("חימום") >= 0 && body[0].indexOf("Back Squat") >= 0);
ok("its parts are separated, not run together", body[0].indexOf("\n\nכוח") > 0);
ok("a part's lines follow its title", body[0].indexOf("חימום\n10 דקות חתירה") === 0);
ok("a day with nothing in it is empty, not a dash", body[1] === "");
ok("and it sits under its own date", body[2].indexOf("מטקון") >= 0);

/* --- what must NOT be in it ------------------------------------------------ */

const asCsv = E.csv(g);
ok("no part ids reach the sheet", asCsv.indexOf('"a"') < 0 && asCsv.indexOf("id") < 0);
ok("nothing of the owner's own business", asCsv.indexOf("monthlyAmount") < 0 && asCsv.indexOf("₪") < 0);
const withHidden = E.dayText({
  parts: [{ title: "כוח", lines: ["Back Squat"], enLines: ["Back Squat, hidden"], coachNote: "לא להראות" }],
});
ok("a part's hidden English is not exported", withHidden.indexOf("hidden") < 0);
ok("nor a note meant for the coach", withHidden.indexOf("לא להראות") < 0);
ok("only what the client would read", withHidden === "כוח\nBack Squat");

/* --- so many sessions a week ----------------------------------------------- */

const BY_COUNT = Object.assign({}, WEEKLY, {
  intake: { scheduleMode: "session_count", sessionsPerWeek: 3 },
});
const g2 = E.grid(BY_COUNT, 1);
ok("a client counted in sessions gets sessions, not days", g2.width === 3);
ok("and they are named as he names them", g2.rows[2].cells[0] === "אימון 1 · שבוע 1");
ok("no dates, because days mean nothing to him", g2.rows[2].cells.join(" ").indexOf("/") < 0);
ok("the second week says so", g2.rows[6].cells[0] === "אימון 1 · שבוע 2");

/* --- one brick, not the lot ------------------------------------------------ */

const TWO_BLOCKS = Object.assign({}, WEEKLY, {
  blocks: [
    { blockIndex: 1, startWeek: 1, weekCount: 1, name: "" },
    { blockIndex: 2, startWeek: 2, weekCount: 1, name: "לבנה שנייה" },
  ],
});
const only2 = E.grid(TWO_BLOCKS, 2);
ok("asking for the second brick gets the second brick", only2.rows[0].cells[0].indexOf("לבנה שנייה") >= 0);
ok("and only its weeks", only2.rows.filter(function (r) { return r.kind === "week"; }).length === 1);
ok("counted from where that brick starts", only2.rows[1].cells[0] === "שבוע 2");
ok("with its own dates", only2.rows[2].cells[0].indexOf("04/10/26") === 0);

/* --- the two things a spreadsheet understands ------------------------------ */

const asHtml = E.html(g);
ok("the clipboard gets a real table", asHtml.indexOf("<table") === 0 && asHtml.indexOf("</table>") > 0);
ok("a multi-line cell keeps its lines", asHtml.indexOf("<br>") > 0);
ok("every row is the full width", (asHtml.match(/<td/g) || []).length >= 7 * 2);
ok("a week's line spans the sheet", asHtml.indexOf('colspan="7"') > 0);
ok("and nothing a page could execute survives", E.html(E.grid(Object.assign({}, WEEKLY, {
  clientName: '<img src=x onerror="alert(1)">',
}), 1)).indexOf("<img") < 0);

ok("the file starts with the mark that stops Excel mangling Hebrew", asCsv.charCodeAt(0) === 0xfeff);
ok("and it can be asked for without it", E.csv(g, { bom: false }).charCodeAt(0) !== 0xfeff);
ok("a cell with several lines is quoted, so it stays one cell", /"חימום\n/.test(asCsv));
ok("a quote inside a line does not break the file",
  E.csv(E.grid(Object.assign({}, WEEKLY, { clientName: 'בית ספר "רימון"' }), 1)).indexOf('""רימון""') > 0);
ok("the file is named after the client and the brick", E.fileName(WEEKLY, 1) === "עודד מכינה · לבנה 1.xlsx");
ok("and a CSV can still be asked for by name", E.fileName(WEEKLY, 1, "csv").indexOf(".csv") > 0);
ok("and a name that cannot be a file is made into one", E.fileName({ clientName: "a/b:c" }, 2).indexOf("/") < 0);

/* --- the file Excel actually opens ----------------------------------------
 * CSV carries no formatting at all, so every session arrived in a cell one line tall
 * and he could not read a word of it (owner, 2026-09-30).
 * ------------------------------------------------------------------------- */
const X = require("../lib/xlsx-lite.js");
const sheetRows = E.sheetRows(g);
ok("the grid becomes spreadsheet rows", sheetRows.length === g.rows.length);
ok("a week's line is bold", sheetRows[1][0].style === X.STYLE_BOLD);
ok("the dates are bold", sheetRows[2][0].style === X.STYLE_BOLD);
ok("and a session is the wrapped kind, so the row can grow", sheetRows[3][0].style === X.STYLE_WRAP);
ok("a gap is an empty row", sheetRows[4].length === 0);

const bytes = X.build(sheetRows, { columns: g.width, colWidth: 34, sheetName: "לבנה" });
ok("what comes out is a zip", bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03);
ok("and it has some size to it", bytes.length > 1500);
const asText = Buffer.from(bytes).toString("latin1");
ok("with the six parts a workbook needs",
  ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels",
   "xl/styles.xml", "xl/worksheets/sheet1.xml"].every(function (n) { return asText.indexOf(n) >= 0; }));

const sheet = X.sheetXml(sheetRows, { columns: 7, colWidth: 34 });
ok("the columns are given a width", /<col min="1" max="7" width="34" customWidth="1"\/>/.test(sheet));
ok("the sheet reads right to left", /rightToLeft="1"/.test(sheet));
ok("a session's cell wraps and sits at the top", /<alignment vertical="top" wrapText="1"\/>/.test(X.build ? require("fs").readFileSync(path.join(root, "lib", "xlsx-lite.js"), "utf8") : ""));
ok("the text is written into the sheet, not into a lookup table", /t="inlineStr"/.test(sheet));
ok("and its line breaks are preserved", /xml:space="preserve"/.test(sheet));
ok("the page loads the writer", /lib\/xlsx-lite\.js/.test(page));
ok("and the download asks it for a real workbook", /X\.build\(E\.sheetRows\(g\)/.test(page));
ok("with a width wide enough to read a set in", /colWidth: 34/.test(page));
ok("and the file is an xlsx, not a csv", /E\.fileName\(S\.program, currentBlockIndex\(\), "xlsx"\)/.test(page));
ok("a character XML cannot hold is dropped, not written",
  X.sheetXml([[{ v: "ab" }]], { columns: 1 }).indexOf("") < 0);
ok("columns are named the way a spreadsheet names them",
  X.colName(1) === "A" && X.colName(26) === "Z" && X.colName(27) === "AA");
ok("the checksum is the one zip expects", X.crc32(X.utf8("123456789")) === 0xcbf43926);

/* --- empty, and nearly empty ------------------------------------------------ */

ok("a programme with nothing in it still answers", E.grid({}, 1).rows.length >= 1);
ok("a day that is not there is empty", E.dayText(undefined) === "");
ok("a part with neither title nor lines is skipped", E.dayText({ parts: [{ title: "", lines: [] }] }) === "");

/* --- the buttons on the page ------------------------------------------------ */

ok("the page loads the exporter", /lib\/brick-export\.js/.test(page));
ok("there is a button that copies", /data-brick-copy="1"/.test(page));
ok("and a button that downloads", /data-brick-csv="1"/.test(page));
ok("copying writes a table to the clipboard, not plain text",
  /"text\/html": new Blob/.test(page));
/* The modern clipboard API refuses without a fresh gesture and a focused document.
   Selecting a real table and copying it has neither requirement, and carries the same
   rich table — so the button works either way (owner, 2026-09-30). */
ok("and there is a way that works when that one is refused", /var copyBySelection = function/.test(page));
ok("the fallback copies the table, not the flattened text", /holder\.innerHTML = html;/.test(page));
ok("it cleans up after itself", /document\.body\.removeChild\(holder\)/.test(page));
ok("and only says it failed when the other ways did", /if \(copyBySelection\(\)\) \{ done\(\); return; \}/.test(page));
ok("plain text is the last resort, and it says what was lost", /הועתק כטקסט בלבד/.test(page));
ok("and the download is named as the way that always works", /הורד אקסל/.test(page));
ok("the client's own screen has neither", !/data-brick-copy/.test(fs.readFileSync(path.join(root, "client.html"), "utf8")));

console.log("\nAll brick export checks passed (" + passed + " assertions).");

/* ── the sheet speaks the client's language ───────────────────────────────── */

/**
 * The promise at the top of lib/brick-export.js is that the sheet holds exactly what the
 * CLIENT would see, in the language it was written in. It did not: the programme stores
 * English and the Hebrew is made at display time, so עודד read his month in Hebrew on screen
 * and exported it in English, and the coach had to retype a month by hand to send it
 * (owner, 2026-10-07).
 */
const Display = require("../lib/pprog-display.js");
const MovementHe = require("../lib/movement-he.js");

const hePart = {
  id: "p1",
  title: "Back Squat Heavy Volume",
  noteLines: 1,
  formatLine: 1,
  lines: [
    "לבחור משקל שמאפשר עבודה רציפה",
    "5 Sets for Quality (climbing load)",
    "8 Back Squat @ 7/8 effort",
    "10 Pullups",
  ],
};
const heDay = { parts: [hePart] };
const heProgramme = {
  clientName: "עודד",
  outputLanguage: "he",
  blockStart: "2026-09-06",
  blocks: [{ blockIndex: 1, startWeek: 1, weekCount: 1 }],
  weeks: [{ weekIndex: 1, days: { sun: heDay, mon: { parts: [] }, tue: { parts: [] }, wed: { parts: [] }, thu: { parts: [] }, fri: { parts: [] }, sat: { parts: [] } } }],
};

const heText = E.dayText(heDay, true);
ok("a Hebrew client's exercises export in Hebrew", /סקוואט/.test(heText) && /מתח/.test(heText));
ok("the part heading is translated too", !/Back Squat Heavy Volume/.test(heText));
/* Notes are sentences a coach typed. A lookup table cannot write one, and must not try. */
ok("a note the coach typed is carried word for word", heText.indexOf("לבחור משקל שמאפשר עבודה רציפה") >= 0);
ok("and the English is gone from the work lines", !/Pullups/.test(heText));

const enText = E.dayText(heDay, false);
ok("an English client's sheet is untouched by any of it", /Back Squat/.test(enText) && !/סקוואט/.test(enText));
ok("nothing stored was rewritten — the programme still holds English",
  hePart.lines[2] === "8 Back Squat @ 7/8 effort");

/* The language is read off the programme, so the button needs no new argument. */
const heGrid = E.grid(heProgramme, 1);
ok("the grid picks the language up from the programme itself",
  JSON.stringify(heGrid.rows).indexOf("סקוואט") > 0);
const enGrid = E.grid(Object.assign({}, heProgramme, { outputLanguage: "en" }), 1);
ok("and an English programme exports English", JSON.stringify(enGrid.rows).indexOf("Back Squat") > 0);

/* THE WHOLE POINT, stated as the thing that can be measured: every line in the file is a
   line the client can see on their own screen. */
Display.setLanguage("he");
const onScreen = Display.renderDayPartsHtml(heDay.parts, null)
  .replace(/<[^>]+>/g, "\n")
  .split("\n")
  .map(function (s) {
    return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
  })
  .filter(Boolean);
const inFile = heText.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
ok("EVERY line of the file appears verbatim on the client's screen",
  inFile.length > 0 && inFile.every(function (l) {
    return onScreen.indexOf(l) >= 0;
  }));
Display.setLanguage("en");

/* And it degrades to the stored text rather than to nothing. */
ok("the dictionary is the screen's, not a second copy", typeof MovementHe.hebrewOnly === "function");

console.log("\nגיליון בעברית — בדיוק מה שהלקוח רואה, ולא תרגום שני משלנו.");
