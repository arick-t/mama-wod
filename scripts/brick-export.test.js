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
ok("the file is named after the client and the brick", E.fileName(WEEKLY, 1) === "עודד מכינה · לבנה 1.csv");
ok("and a name that cannot be a file is made into one", E.fileName({ clientName: "a/b:c" }, 2).indexOf("/") < 0);

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
