/**
 * The summary tab, as the owner meets it.
 * Run: node scripts/admin-ledger-page.test.js
 *
 * The rendering is asserted by RUNNING it, not by reading admin.html for hopeful
 * strings: every function here comes out of lib/admin-ledger-view.js and is called
 * with real data. What is asserted against the page source is only what lives there —
 * the wiring: the pinned chip, the landing, and the markup the screen renders into.
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

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const strip = fs.readFileSync(path.join(root, "lib", "admin-people-strip.js"), "utf8");
const V = require("../lib/admin-ledger-view.js");
const L = require("../lib/coach-ledger.js");
const Strip = require("../lib/admin-people-strip.js");

/* --- the tab itself ------------------------------------------------------ */

const rows = Strip.rows({
  athletes: [{ athleteId: "u1", displayName: "אריק" }],
  programs: [{ programId: "p1", clientName: "סטודיו א" }],
});
ok("the summary tab is the first chip", rows[0].kind === "ledger");
ok("it is pinned", rows[0].pinned === true);
ok("it carries no unread dot", rows[0].unread === false);
ok("the people are still behind it", rows.length === 3 && rows[1].kind === "athlete");
const stripHtml = Strip.html(rows, "ledger");
ok("it renders as a chip like any other", stripHtml.indexOf('data-kind="ledger"') >= 0);
ok("and it can be the active one", /data-kind="ledger" data-id="ledger"/.test(stripHtml.replace(/class="[^"]*"\s*/, "")) || stripHtml.indexOf('data-id="ledger"') >= 0);
ok("a screen that wants only people can say so", Strip.rows({ athletes: [], programs: [], ledger: false }).length === 0);

/* It is not a client: no rename, no colour, no delete. */
ok(
  "right-clicking the summary chip opens no rename panel",
  /data-kind"\)\s*===\s*"ledger"\) return;/.test(page.replace(/getAttribute\("/g, "")) ||
    page.indexOf('if (chip.getAttribute("data-kind") === "ledger") return;') >= 0
);

/* --- the landing --------------------------------------------------------- */

ok(
  "the module opens on the summary tab",
  /function openFirstPersonIfNeeded\(\)[\s\S]{0,700}openPersonFromStrip\("ledger", "ledger"\)/.test(page)
);
ok(
  "and it does not wait for either half of the strip to answer",
  !/function openFirstPersonIfNeeded\(\)[\s\S]{0,400}athletesAnswered/.test(page)
);
ok(
  "athletes arriving afterwards do not push it off the screen",
  /must not push the summary tab off the screen[\s\S]{0,220}if \(adminOpenedSomeone && !currentAthleteId\)/.test(page)
);
ok(
  "opening a client closes it, and opening it closes the client",
  /if \(kind === "ledger"\)[\s\S]{0,400}ClientScreen\.close\(\)/.test(page) &&
    /if \(window\.LedgerScreen\) window\.LedgerScreen\.close\(\);\s*\n\s*if \(kind === "program"\)/.test(page)
);

/* --- the screen it renders into ------------------------------------------ */

ok("the screen exists beside the others", /<div class="content" id="ledgerScreen" hidden>/.test(page));
/* The athlete panel used to come back beside it and take half the width for an empty
   message — the client screen handed the page back without asking who else held it. */
ok("the summary tab is asked before the athlete side returns", /LedgerScreen\.isOpen\(\)[\s\S]{0,120}athleteSide\.hidden = mine \|\| ledgerHolds/.test(page));
ok("and it says when it is holding the screen", /isOpen: function \(\) \{ return LS\.open === true; \}/.test(page));
/* Management above, record below, money last — in that order and in three boxes. */
ok("the deals table is its own box with its own title", /<div class="card led-deals">[\s\S]{0,200}טבלת עסקאות/.test(page));
ok("the money sits at the foot of the page", page.indexOf('id="ledIncome"') > page.indexOf('id="ledTable"'));
ok("with a title of its own", /<div class="card led-money">[\s\S]{0,200}הכנסות החודש/.test(page));
ok("and the entry row waits for the plus", /LS\.adding \|\| editing/.test(page));
ok("with a place for the month header", /id="ledHeader"/.test(page));
ok("the calendar", /id="ledCalendar"/.test(page));
ok("the open day", /id="ledDay"/.test(page));
ok("and the deals table", /id="ledTable"/.test(page));
ok("the automatic buttons are there", /data-led-range="week"/.test(page) && /data-led-range="month"/.test(page) && /data-led-range="year"/.test(page));
/* "This year" follows the month on screen, so browsing back to 2025 and pressing it
   answers about 2025 (owner, 2026-09-03). */
ok("a year is answered about the month being browsed", /if \(LS\.range === "year"\) return L\.yearRange\(LS\.month \+ "-15"\);/.test(page));
ok("so are the three filters he asked for", /id="ledFName"/.test(page) && /id="ledFMin"/.test(page) && /id="ledFFrom"/.test(page));
ok("the page loads the book and its view", /lib\/coach-ledger\.js/.test(page) && /lib\/admin-ledger-view\.js/.test(page));
ok("the screen talks to its own endpoint", /adminApiUrl\("\/api\/admin-ledger"\)/.test(page));
ok("and carries the owner's credential", /\/api\/admin-ledger"\)[\s\S]{0,200}adminAuthHeaders\(\)/.test(page));
/* Two IIFEs on one page must not both call their state S — the client screen already does. */
ok("the summary tab keeps its own state name", /var LS = \{/.test(page));

/* --- the month header ---------------------------------------------------- */

ok("the header names the month in Hebrew", V.headerHtml("2026-09", 1250).indexOf("ספטמבר 2026") >= 0);
ok("and carries the month's total", V.headerHtml("2026-09", 1250).indexOf("₪1,250") >= 0);
ok("with a way back and forward", /data-led-month="prev"/.test(V.headerHtml("2026-09", 0)) && /data-led-month="next"/.test(V.headerHtml("2026-09", 0)));
ok("a whole shekel is not written with agorot", V.shekel(250) === "₪250");
ok("but agorot are shown when there are any", V.shekel(250.5) === "₪250.50");

/* --- the calendar -------------------------------------------------------- */

const cal = V.calendarHtml({
  month: "2026-09",
  totalsByDay: { "2026-09-03": 430 },
  today: "2026-09-03",
  selected: "2026-09-03",
});
ok("every day of the month is a square", (cal.match(/data-led-day="/g) || []).length === 30);
ok("the first lands on its weekday", (cal.match(/led-blank/g) || []).length === L.weekdayOf("2026-09-01"));
ok("a day that earned says how much", cal.indexOf("₪430") >= 0);
ok("today is marked", cal.indexOf("is-today") >= 0);
ok("the open day is marked", cal.indexOf("is-open") >= 0);
/* Changed 2026-09-03: a square opens the day, and the plus lives inside that panel.
   A plus on every square advertised an entry row he had not asked for. */
ok("a square opens the day rather than an entry row", cal.indexOf("led-plus") < 0);
ok("a quiet day shows no number", (cal.match(/led-sum/g) || []).length === 1);

/* --- the day box --------------------------------------------------------- */

const deals = [
  { id: "d1", day: "2026-09-03", name: "רימון", service: "אימון קבוצתי", price: 250, createdAt: "2026-09-03T06:00:00Z" },
  { id: "d2", day: "2026-09-03", name: "אולם העירייה", service: "", price: 180, createdAt: "2026-09-03T09:00:00Z" },
];
const panel = V.dayPanelHtml({ day: "2026-09-03", deals: deals });
ok("the day opens as a panel with its date", panel.indexOf("03/09/2026") >= 0);
ok("and what that day earned", panel.indexOf("₪430") >= 0);
ok("a new line is offered by one plus, in the corner", (panel.match(/data-led-add/g) || []).length === 1);
ok("and the entry row is NOT standing open", panel.indexOf('id="ledPrice"') < 0);
const panelAdding = V.dayPanelHtml({ day: "2026-09-03", deals: deals, editorHtml: V.editorHtml({}) });
ok("pressing it is what brings the row", panelAdding.indexOf('id="ledPrice"') >= 0);
ok("and the plus steps aside while the row is open", panelAdding.indexOf("data-led-add") < 0);

const dayHtml = V.dayDealsHtml(deals);
ok("a day lists its deals", (dayHtml.match(/data-led-deal="/g) || []).length === 2);
ok("each one can be edited", dayHtml.indexOf('data-led-edit="d1"') >= 0);
ok("and deleted", dayHtml.indexOf('data-led-del="d1"') >= 0);
ok("a missing service does not render blank", dayHtml.indexOf("—") >= 0);
ok("an empty day says so plainly", V.dayDealsHtml([]).indexOf("אין עסקאות") >= 0);

const editor = V.editorHtml({});
ok("the entry line asks for a place", editor.indexOf('id="ledName"') >= 0);
ok("a service", editor.indexOf('id="ledService"') >= 0);
ok("and a price", editor.indexOf('id="ledPrice"') >= 0);
ok("the place field is typed into", editor.indexOf('id="ledName"') >= 0 && editor.indexOf("data-led-pick") < 0);
const editing = V.editorHtml({ deal: deals[0] });
ok("editing an existing deal plants what it was", editing.indexOf("רימון") >= 0 && editing.indexOf('value="250"') >= 0);
ok("and says it is an update", editing.indexOf("עדכן") >= 0);

/* --- typing a place, choosing a service, tapping a price ------------------
 * The name used to be a button that opened a panel with another button in it. He
 * pressed it and could not type: "the place name field is not clickable and you
 * cannot type in it" (owner, 2026-09-04). It is a text field now, with the saved
 * places offered as the browser's own autocomplete.
 * ------------------------------------------------------------------------- */

const entry = V.editorHtml({});
ok("the place is typed, not picked", /<input[^>]*id="ledName"/.test(entry));
ok("with the saved places as autocomplete", entry.indexOf('list="ledPlaceList"') >= 0);
ok("and no panel behind it any more", entry.indexOf("data-led-pick") < 0 && entry.indexOf("led-pickpanel") < 0);
ok("the old picker is gone from the library too", typeof V.favouritesHtml === "undefined");
ok("the list is the names he has worked at", V.placeListHtml(["רימון", "אולם"]).indexOf('<option value="רימון">') >= 0);

ok("the service is a short list", (entry.match(/<option/g) || []).length === 4);
ok("of the two he gives", entry.indexOf(">אימון אישי<") >= 0 && entry.indexOf(">אימון קבוצתי<") >= 0);
ok("plus a way out of it", entry.indexOf(">אחר<") >= 0);
ok("whose free line is closed until it is chosen", /id="ledServiceOther"[^>]*hidden/.test(entry));
const oldService = V.editorHtml({ deal: { id: "d", name: "x", service: "אימון בבריכה", price: 100 } });
ok("an old service that is neither opens as other", /id="ledServiceOther"[^>]*value="אימון בבריכה"/.test(oldService));
ok("and is not quietly rewritten", oldService.indexOf('hidden') < oldService.indexOf('id="ledServiceOther"') || !/id="ledServiceOther"[^>]*hidden/.test(oldService));

ok("the price asks for the number pad", /id="ledPrice"[^>]*inputmode="numeric"/.test(entry));
ok("and so does the one in the box", /id="ledMPrice"[^>]*inputmode="numeric"/.test(V.manualFormHtml({})));

ok("choosing other opens the line", /other\.hidden = t\.value !== V\.SERVICE_OTHER/.test(page));
ok("a known name fills the rest", /function applyPlaceDefaults\(prefix\)/.test(page));
ok("but never overwrites a price he already typed", /if \(priceEl && !priceEl\.value\)/.test(page));
ok("what the field says is what gets saved", /function readService\(prefix\)/.test(page));
ok("the names travel with the month", /placeNames: Ledger\.placesByUse\(places\)/.test(fs.readFileSync(path.join(root, "scripts", "lib", "admin", "admin-ledger.js"), "utf8")));
ok("pressing the plus puts the cursor in the name", /if \(el\("ledName"\)\) el\("ledName"\)\.focus\(\)/.test(page));

/* --- the table ----------------------------------------------------------- */

const table = V.tableHtml(deals, 430);
ok("the table names its columns", table.indexOf("שם") >= 0 && table.indexOf("מחיר") >= 0 && table.indexOf("תאריך") >= 0);
ok("a row per deal", (table.match(/data-led-deal="/g) || []).length === 2);
ok("the date is written the way he writes it", table.indexOf("03/09/2026") >= 0);
ok("and the sum of what is shown", table.indexOf("₪430") >= 0);
ok("an empty range says so", V.tableHtml([], 0).indexOf("אין עסקאות בטווח") >= 0);

/* --- a place named like an attack --------------------------------------- */

const nasty = V.dayDealsHtml([{ id: "x", day: "2026-09-03", name: '<img src=x onerror="alert(1)">', service: "", price: 10 }]);
ok("a place name cannot inject markup", nasty.indexOf("<img src=x") < 0 && nasty.indexOf("&lt;img") >= 0);
const nastyList = V.placeListHtml(['"><script>alert(1)</script>']);
ok("neither can one in the autocomplete list", nastyList.indexOf("<script>alert(1)") < 0);
const nastyFavBox = V.favouritesBoxHtml({ places: [{ name: '"><img src=x onerror="alert(1)">', uses: 1, service: "", price: 1 }], open: true });
ok("nor one in the favourites box", nastyFavBox.indexOf("<img src=x") < 0);

/* --- what this screen is not -------------------------------------------- */

const viewSrc = fs.readFileSync(path.join(root, "lib", "admin-ledger-view.js"), "utf8");
ok("the view makes no network calls", !/\bfetch\s*\(/.test(viewSrc));
ok("and knows no AI provider", !/gemini|groq|generativelanguage/i.test(viewSrc));
ok("the pinned chip is documented where it is created", /not a person and it is not a\s*\n\s*client/.test(strip));


/* --- the open day floats over its own square (owner, 2026-09-03) ---------- */

ok("the month grid is the frame the day is placed in", /id="ledCalWrap"/.test(page) && /#ledCalWrap\{position:relative\}/.test(page));
ok("the day starts hidden rather than empty", /<div id="ledDay" hidden><\/div>/.test(page));
ok("it is placed over the square it belongs to", /function placeDayPopover\(\)/.test(page) && /square\.offsetLeft \+ square\.offsetWidth \/ 2 - w \/ 2/.test(page));
ok("and clamped inside the month so a Saturday does not hang off", /if \(left > max\) left = max > 0 \? max : 0;/.test(page));
ok("the popover can be closed", V.dayPanelHtml({ day: "2026-09-01", deals: [] }).indexOf("data-led-dayclose") >= 0);
ok("it is a little wider than a square, not the page", /\.led-pop\{[^}]*min-width:250px;max-width:330px/.test(page));
ok("the squares are small enough for a whole month", /\.led-day\{[\s\S]{0,200}min-height:52px/.test(page));
ok("today is a hint, not a selection", /\.led-day\.is-today\{border-color:#3a3a3a\}/.test(page));
ok("and the open day is the one with the ring", /\.led-day\.is-open\{outline:2px solid var\(--brand\)/.test(page));

/* --- adding a session from anywhere -------------------------------------- */

const manual = V.manualFormHtml({ date: "2026-09-03" });
ok("the box asks for a place", manual.indexOf('id="ledMName"') >= 0);
ok("a service", manual.indexOf('id="ledMService"') >= 0);
ok("a price", manual.indexOf('id="ledMPrice"') >= 0);
ok("and the day it lands on", manual.indexOf('id="ledMDate"') >= 0 && manual.indexOf('value="2026-09-03"') >= 0);
ok("its place field offers the same autocomplete", manual.indexOf('list="ledPlaceList"') >= 0);
ok("a session added there is written to the date in the field", /function saveManual\(\)[\s\S]{0,700}action: "add_deal", day: day/.test(page));
ok(
  "and if that day is in another month, the calendar follows it there",
  /if \(landed !== LS\.month\)[\s\S]{0,200}loadMonth\(landed\)/.test(page)
);
ok("a click on the month closes the open day", /!t\.closest\("\.led-daybox"\) && !t\.closest\("\[data-led-day\]"\)/.test(page));
ok("but never while a line is being written", /if \(LS\.day && !LS\.adding && !LS\.editing/.test(page));


/* --- the favourites box (owner, 2026-09-03) ------------------------------- */

const favPlaces = [
  { name: "רימון", uses: 7, service: "קבוצתי", price: 250, colour: "#4CAF70" },
  { name: "אולם העירייה", uses: 2, service: "אישי", price: 180, colour: "" },
];
const boxClosed = V.favouritesBoxHtml({ places: favPlaces });
ok("the box is folded away by default", boxClosed.indexOf("led-fav-rows") < 0);
ok("but says how many are in it", boxClosed.indexOf("led-fold-count") >= 0);
const boxOpen = V.favouritesBoxHtml({ places: favPlaces, open: true });
ok("opening it lists everyone", (boxOpen.match(/data-led-fav="/g) || []).length === 2);
ok("busiest first, with the count visible", boxOpen.indexOf("7 פעמים") >= 0);
ok("each name has a pencil", (boxOpen.match(/data-led-fav-edit=/g) || []).length === 2);
ok("a coloured place shows its colour", boxOpen.indexOf("border-inline-start:3px solid #4CAF70") >= 0);
const boxEditing = V.favouritesBoxHtml({ places: favPlaces, open: true, editing: "רימון" });
ok("the pencil opens a name field", boxEditing.indexOf('id="ledFavName"') >= 0);
ok("and a palette", (boxEditing.match(/data-led-fav-colour="#/g) || []).length === V.DEFAULT_COLOURS.length);
ok("including a way back to no colour", boxEditing.indexOf('data-led-fav-colour=""') >= 0);
ok("an empty box invites the first", V.favouritesBoxHtml({ places: [], open: true }).indexOf("עוד לא נתת שירות") >= 0);

/* The colour is the point: it must reach both the day and the table. */
ok(
  "a place's colour paints its rows in the open day",
  V.dayDealsHtml([{ id: "a", name: "רימון", price: 10 }], { "רימון": "#4CAF70" }).indexOf("#4CAF70") >= 0
);
ok(
  "and its rows in the summary table",
  V.tableHtml([{ id: "a", day: "2026-09-03", name: "רימון", price: 10 }], 10, { "רימון": "#4CAF70" }).indexOf("#4CAF70") >= 0
);
ok(
  "a colour that is not a colour never reaches the style attribute",
  V.tableHtml([{ id: "a", day: "2026-09-03", name: "x", price: 10 }], 10, { x: '" onload="alert(1)' }).indexOf("onload") < 0
);

ok("the box is on the page under the table", page.indexOf('id="ledFavourites"') > page.indexOf('id="ledTable"'));
ok("it is read once, when he opens it", /if \(LS\.favOpen && !LS\.places\.length\) loadPlaces\(\);/.test(page));
ok("the pencil saves through the server", /function savePlace\(name, newName, colour\)/.test(page));
ok("and the month is redrawn afterwards, because the rows carry both", /savePlace[\s\S]{0,900}loadMonth\(LS\.month\)/.test(page));

console.log("\nAll admin ledger page checks passed (" + passed + " assertions).");
