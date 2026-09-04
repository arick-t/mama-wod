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

/* Confirmed again 2026-09-04: EVERY entry to the module lands here, whatever else
   has loaded. */
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
/* The bar is RENDERED now, so what it offers is asserted by running it — the page
   only holds the box it is drawn into (owner, 2026-09-04). */
ok("the record has a bar of its own", /id="ledFilters"/.test(page));
const bar = V.filtersHtml({ range: "month", names: ["מ1", "מ2"], services: ["אימון אישי"] });
ok("the ranges are there", /data-led-range="week"/.test(bar) && /data-led-range="month"/.test(bar) && /data-led-range="year"/.test(bar));
ok("the month is the one it opens on", /data-led-range="month" class|led-chip on" data-led-range="month"/.test(bar) || bar.indexOf('class="led-chip on" data-led-range="month"') >= 0);
ok("a date range hides behind its own button", /data-led-range="custom"/.test(bar) && /class="led-dates" hidden/.test(bar));
ok("the place filter is a list of the places in range", (bar.match(/<option value="מ/g) || []).length === 2);
ok("so is the service filter", bar.indexOf('id="ledFService"') >= 0 && bar.indexOf("אימון אישי") >= 0);
ok("the price boxes are gone", bar.indexOf("ledFMin") < 0 && bar.indexOf("ledFMax") < 0);
ok("and so is the filter button — choosing IS filtering", bar.indexOf('data-led-filter="1"') < 0);
ok("clearing is still one press", /data-led-clear="1"/.test(bar));
/* "This year" follows the month on screen, so browsing back to 2025 and pressing it
   answers about 2025 (owner, 2026-09-03). */
ok("a year is answered about the month being browsed", /if \(LS\.range === "year"\) return L\.yearRange\(LS\.month \+ "-15"\);/.test(page));
ok("choosing a place filters at once", /data-led-filter"\)\) \{|hasAttribute\("data-led-filter"\)/.test(page));
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
  dealsByDay: {
    "2026-09-03": [
      { name: "רימון", service: "אימון קבוצתי" },
      { name: "אולם העירייה", service: "אימון אישי" },
      { name: "חוף הים", service: "אימון אישי" },
    ],
  },
  colours: { "רימון": "#4CAF70" },
  today: "2026-09-04",
  selected: "2026-09-03",
});
ok("every day of the month is a square", (cal.match(/data-led-day="/g) || []).length === 30);
ok("the first lands on its weekday", (cal.match(/led-blank/g) || []).length === L.weekdayOf("2026-09-01"));
ok("today is marked", cal.indexOf("is-today") >= 0);
ok("the open day is marked", cal.indexOf("is-open") >= 0);

/* Changed 2026-09-04: a closed square says WHO he trained, not what he earned. The
   money is in the header and in the table; the square is for reading the month. */
ok("a square carries no money", cal.indexOf("led-sum") < 0 && cal.indexOf("₪430") < 0);
ok("it lists the places instead", cal.indexOf("רימון") >= 0 && cal.indexOf("אולם העירייה") >= 0);
ok("in the order they were entered", cal.indexOf("רימון") < cal.indexOf("אולם העירייה"));
ok("and says there is more rather than growing", cal.indexOf("חוף הים") < 0 && cal.indexOf("led-more") >= 0);
ok("a place with a colour paints the WHOLE line", cal.indexOf('style="color:#4CAF70"') >= 0);
ok("and the line says place - service", cal.indexOf("רימון - אימון קבוצתי") >= 0);
ok("a quiet day says nothing at all", (cal.match(/led-line/g) || []).length === 2);

/* --- the day box --------------------------------------------------------- */

const deals = [
  { id: "d1", day: "2026-09-03", name: "רימון", service: "אימון קבוצתי", price: 250, createdAt: "2026-09-03T06:00:00Z" },
  { id: "d2", day: "2026-09-03", name: "אולם העירייה", service: "", price: 180, createdAt: "2026-09-03T09:00:00Z" },
];
const panel = V.dayPanelHtml({ day: "2026-09-03", deals: deals });
ok("the day opens as a panel with its date", panel.indexOf("03/09/26") >= 0);
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

const table = V.tableHtml(deals, 430, {}, { by: "day", dir: 1 });
ok("the table names its columns", table.indexOf("שם") >= 0 && table.indexOf("מחיר") >= 0 && table.indexOf("תאריך") >= 0);
ok("a row per deal", (table.match(/data-led-deal="/g) || []).length === 2);
ok("the date is written the way he writes it", table.indexOf("03/09/26") >= 0);
ok("and the sum of what is shown", table.indexOf("₪430") >= 0);
ok("an empty range says so", V.tableHtml([], 0, {}, null).indexOf("אין עסקאות בטווח") >= 0);

/* --- the record: sorted by its headers, and his own invoice tick ----------- */

ok("every column is a button", (table.match(/data-led-sort=/g) || []).length === 5);
ok("including the invoice column he fills himself", table.indexOf('data-led-sort="invoiced"') >= 0);
ok("each row carries its tick", (table.match(/data-led-invoiced=/g) || []).length === 2);
const tickedTable = V.tableHtml([{ id: "x", day: "2026-09-03", name: "a", price: 1, invoiced: true }], 1, {}, null);
ok("a session already invoiced shows as ticked", /data-led-invoiced="x"[^>]*checked/.test(tickedTable));
ok("the sorted column is marked", V.tableHtml(deals, 430, {}, { by: "price", dir: -1 }).indexOf("led-arrow") >= 0);
ok("and the arrow follows the direction", V.tableHtml(deals, 430, {}, { by: "price", dir: -1 }).indexOf("▴") >= 0);
ok("a header click sorts, and again turns it round", /if \(LS\.sortBy === key\) LS\.sortDir = LS\.sortDir === 1 \? -1 : 1;/.test(page));
ok("the tick is written the moment it is ticked", /action: "update_deal"[\s\S]{0,200}invoiced: wasChecked/.test(page));
ok("and put back if the server refuses", /t\.checked = !wasChecked;/.test(page));

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
ok("the squares still fit a month on one screen", /\.led-day\{[\s\S]{0,200}min-height:66px/.test(page));
/* Corrected 2026-09-04: today is a dot, not a colour — an orange number read as
   "this day is chosen" two days running. */
ok("today is marked by a dot, not by paint", /\.led-day\.is-today \.led-num::after\{content:""/.test(page) && !/is-today \.led-num\{color:var\(--brand\)/.test(page));
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
/* Replaced 2026-09-04: leaving the day no longer throws the line away — it SAVES
   it. The Save button stays; this is the autosave he asked for everywhere. */
ok("leaving the day saves what is in the line", /function autosaveLine\(\)/.test(page));
ok("and moving to another day saves on the way out", /if \(iso !== LS\.day && autosaveLine\(\)\) return;/.test(page));
ok("a line with nothing in it is dropped, not shouted about", /if \(!form\.name \|\| !\(Number\(form\.price\) > 0\)\)/.test(page));


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


/* --- duplicating a session (owner, 2026-09-04) ---------------------------- */

ok("every row can be copied", V.dayDealsHtml([{ id: "d1", name: "רימון", price: 250 }]).indexOf('data-led-copy="d1"') >= 0);
const copyLine = V.editorHtml({ name: "רימון", service: "אימון קבוצתי", price: 250, date: "2026-09-04" });
ok("a copy opens on the values it came from", copyLine.indexOf('value="רימון"') >= 0 && copyLine.indexOf('value="250"') >= 0);
ok("with the day it came from as the default", copyLine.indexOf('id="ledDate"') >= 0 && copyLine.indexOf('value="2026-09-04"') >= 0);
ok("and says what it is about to do", copyLine.indexOf("הכפל") >= 0);
ok("a plain new line has no date field — it belongs to the open day", V.editorHtml({}).indexOf('id="ledDate"') < 0);
ok("the copy carries the row's values into the state", /LS\.copying = \{ name: src\.name, service: src\.service, price: src\.price, date: src\.day \}/.test(page));
ok("and is saved to the day in the field", /var onDay = \(el\("ledDate"\) && V\.parseHeDate\(el\("ledDate"\)\.value\)\) \|\| LS\.day;/.test(page));
ok("even when that day is in another month", /var landed = L\.monthKey\(onDay\)[\s\S]{0,300}loadMonth\(landed\)/.test(page));

/* A place used for the first time must reach the favourites box too. */
ok("the place list is dropped after a write", /function forgetPlaces\(\)/.test(page));
ok("and re-read at once if the box is open", /if \(LS\.favOpen\) loadPlaces\(\);/.test(page));
ok("a session added from the box drops it too", /LS\.manual = null;\s*\n\s*forgetPlaces\(\);/.test(page));

/* The close button was sitting on top of the date. */
ok("the day's header leaves room for the close button", /\.led-daybox-head\{[^}]*padding-inline-start:24px/.test(page));


/* --- dates are written the way they are written here (owner, 2026-09-04) ---
 * The browser's own date field renders in the BROWSER's locale, and his showed
 * 09/04/2026 for the fourth of September. The ledger writes and reads its own dates
 * now; the native picker is kept behind a button.
 * ------------------------------------------------------------------------- */

ok("a date reads day, month, two-digit year", V.hebDate("2026-09-04") === "04/09/26");
ok("the table uses it", V.tableHtml([{ id: "a", day: "2026-09-04", name: "x", price: 1 }], 1, {}, null).indexOf("04/09/26") >= 0);
ok("and so does the open day", V.dayPanelHtml({ day: "2026-09-04", deals: [] }).indexOf("04/09/26") >= 0);

ok("he can type it short", V.parseHeDate("4/9/26") === "2026-09-04");
ok("or padded", V.parseHeDate("04/09/26") === "2026-09-04");
ok("or as six digits", V.parseHeDate("040926") === "2026-09-04");
ok("or with a full year", V.parseHeDate("04/09/2026") === "2026-09-04");
ok("an ISO date is still understood", V.parseHeDate("2026-09-04") === "2026-09-04");
ok("a day that does not exist is refused", V.parseHeDate("31/09/26") === "");
ok("and so is anything else", V.parseHeDate("hello") === "" && V.parseHeDate("") === "");
ok("two digits mean this century", V.parseHeDate("01/01/99") === "2099-01-01");

const dateField = V.dateFieldHtml("ledMDate", "2026-09-04", "תאריך");
ok("the field he types into is ours", /id="ledMDate"[^>]*data-led-datefield/.test(dateField));
ok("and shows his format", dateField.indexOf('value="04/09/26"') >= 0);
ok("the browser's picker is behind a button", dateField.indexOf('data-led-dateopen="ledMDate"') >= 0);
ok("which opens the native field", /id="ledMDateNative"[^>]*type="date"|type="date"[^>]*id="ledMDateNative"/.test(dateField));
ok("every date on the page goes through the same field", (V.filtersHtml({ range: "custom" }).match(/data-led-datefield/g) || []).length === 2);
ok("what he types is parsed before it is sent", /V\.parseHeDate\(el\("ledMDate"\)\.value\)|V\.parseHeDate\(d\.value\)/.test(page));
ok("a date that cannot be read is marked rather than silently dropped", /t\.classList\.add\("bad"\)/.test(page));
ok("and the picker writes back in his format", /target\.value = V\.hebDate\(t\.value\)/.test(page));


/* --- the table opens grouped (owner, 2026-09-04) -------------------------- */

const gRows = [
  { name: "רימון", count: 3, total: 750, service: "", mixed: true, invoiced: false },
  { name: "אולם", count: 1, total: 180, service: "אימון אישי", mixed: false, invoiced: true },
];
const grouped = V.tableHtml(gRows, 930, { "רימון": "#F5C518" }, { by: "price", dir: 1 }, {
  grouped: true,
  rangeLabel: "החודש",
});
ok("a line per place", (grouped.match(/data-led-group=/g) || []).length === 2);
ok("the count sits beside the name", grouped.indexOf("(3)") >= 0);
ok("the money is the sum for that place", grouped.indexOf("₪750") >= 0);
ok("one service is named", grouped.indexOf("אימון אישי") >= 0);
ok("several are called mixed", grouped.indexOf("מגוון") >= 0);
ok("and mixed is marked so it can be coloured", grouped.indexOf("is-mixed") >= 0);
ok("the date column says which range he chose", grouped.indexOf("החודש") >= 0);
ok("one tick covers the whole place", (grouped.match(/data-led-invoice-place=/g) || []).length === 2);
ok("a place with everything billed shows ticked", /data-led-invoice-place="אולם" checked/.test(grouped));
ok("and one with a session left over does not", !/data-led-invoice-place="רימון" checked/.test(grouped));

/* Full detail is what it was: one line per session, with its own date. */
const detail = V.tableHtml(
  [{ id: "x", day: "2026-09-04", name: "רימון", service: "אימון אישי", price: 250 }],
  250, {}, null, { grouped: false }
);
ok("full detail is a line per session", detail.indexOf('data-led-deal="x"') >= 0);
ok("with the day it happened on", detail.indexOf("04/09/26") >= 0);
ok("and its own tick", detail.indexOf('data-led-invoiced="x"') >= 0);

ok("the button is beside clear", /data-led-detail="1"[\s\S]{0,200}data-led-clear="1"/.test(V.filtersHtml({})));
ok("and it is marked when it is on", V.filtersHtml({ detail: true }).indexOf('led-chip on" data-led-detail') >= 0);
ok("the page opens grouped", /detail: false,/.test(page));
ok("pressing it switches the view without losing the filter", /LS\.detail = !LS\.detail;[\s\S]{0,80}renderFilters\(\);[\s\S]{0,40}loadTable\(\);/.test(page));
ok("the grouped date column is told which range is on", /function rangeLabel\(\)/.test(page));
ok("a chosen date range reads as two dates", /V\.hebDate\(r\.from\) \+ " - " \+ V\.hebDate\(r\.to\)/.test(page));
ok("ticking a place writes every session in it", /action: "invoice_place"/.test(page));
ok("and unticking one session redraws the grouped answer", /if \(!LS\.detail\) loadTable\(\);/.test(page));


/* --- the landing survives a refresh (owner, 2026-09-04) ------------------- */

ok(
  "the landing is decided when the module opens, not by a race",
  /function openAdminApp\(snapshots\)[\s\S]{0,900}openFirstPersonIfNeeded\(\)/.test(page)
);
ok(
  "and a link that names a client still wins",
  /if \(!deepLink\.get\("program"\) && !deepLink\.get\("athlete"\)\) openFirstPersonIfNeeded\(\);/.test(page)
);
ok(
  "so athletes answering first cannot take the screen",
  page.indexOf("the athlete list won the race") >= 0
);

/* --- what the tab is called, and what it is not --------------------------- */

const stripSrc2 = fs.readFileSync(path.join(root, "lib", "admin-people-strip.js"), "utf8");
const ledgerRow = Strip.rows({})[0];
ok("the tab is general management", ledgerRow.name === "ניהול כללי");
ok("not a summary of anything", ledgerRow.name.indexOf("סיכום") < 0);
const ledgerHtml = Strip.html(Strip.rows({}), "ledger");
/* A dumbbell, drawn rather than an emoji so it takes the chip's colour (owner,
   2026-09-04). */
ok("its mark is a dumbbell", ledgerHtml.indexOf('<svg class="tab-mark"') >= 0);
ok("not a sigma and not an emoji", ledgerHtml.indexOf("∑") < 0 && ledgerHtml.indexOf("▦") < 0 && ledgerHtml.indexOf("🏋") < 0);
ok("and it takes the colour of the chip it sits on", ledgerHtml.indexOf('fill="currentColor"') >= 0);
ok("and the reason is written down", stripSrc2.indexOf("not a sum of the clients") >= 0);


/* --- one place, opened under its own line (owner, 2026-09-04) ------------- */

const gOne = [{ name: "רימון", count: 2, total: 550, service: "", mixed: true, invoiced: false }];
const gDeals = [
  { id: "s1", day: "2026-09-01", name: "רימון", service: "אימון קבוצתי", price: 250 },
  { id: "s2", day: "2026-09-08", name: "רימון", service: "אימון אישי", price: 300 },
  { id: "s3", day: "2026-09-09", name: "אולם", service: "אימון אישי", price: 180 },
];
const closedRow = V.tableHtml(gOne, 550, {}, null, { grouped: true, rangeLabel: "החודש" });
ok("every place has a chevron beside its name", closedRow.indexOf('data-led-expand="רימון"') >= 0);
ok("and closed, it shows no sessions", closedRow.indexOf("data-led-deal=") < 0);

const openRow = V.tableHtml(gOne, 550, {}, null, {
  grouped: true,
  rangeLabel: "החודש",
  expanded: "רימון",
  expandedRows: gDeals,
});
ok("opened, that place's sessions appear under it", (openRow.match(/data-led-deal=/g) || []).length === 2);
ok("and only that place's", openRow.indexOf('data-led-deal="s3"') < 0);
ok("each with its own date", openRow.indexOf("01/09/26") >= 0);
/* Changed 2026-09-04: the place's own line above already carries the sum, so the one
   under the sessions was saying it twice. */
ok("with no sum repeated under them", openRow.indexOf("led-sub-total") < 0);
ok("because the line above already says it", openRow.indexOf("₪550") >= 0);
ok("the chevron says it is open", openRow.indexOf('aria-expanded="true"') >= 0);
ok("opening one costs no request — the rows are already here", /expandedRows: LS\.tableDeals/.test(page));
ok("and only one place opens at a time", /LS\.expanded = LS\.expanded === who \? "" : who;/.test(page));
ok("leaving the grouped view closes it", /LS\.detail = !LS\.detail;\s*\n\s*LS\.expanded = "";/.test(page));


/* --- the bug he found: an invoice tick that was never heard --------------- */

ok(
  "the change listener does not require an id",
  /var t = ev\.target;[\s\S]{0,400}if \(!t \|\| !t\.hasAttribute\) return;/.test(page)
);
ok(
  "and the reason is written where the guard is",
  page.indexOf("this guard was silently swallowing every one of their changes") >= 0
);
ok("the invoice boxes are identified by data, not id", /data-led-invoiced="/.test(V.tableHtml([{ id: "z", day: "2026-09-01", name: "a", price: 1 }], 1, {}, null, {})));

/* Two shades of green: a row, and the answer. */
/* Three ranks, one hue: a session, a place, the whole answer. */
ok("a session's price is the quiet green", /\.led-price\{font-weight:700;color:#357850/.test(page));
ok("a place's own line is brighter and bigger", /\.led-row\.is-group \.led-price\{color:#6FE39B;font-weight:900/.test(page));
ok("and the grand total is the loudest", /\.led-table-total strong\{color:#A8F5C8/.test(page));


/* --- a service has a colour, and it is the same colour everywhere ---------
 * Personal is pale blue, group is blue, anything he typed himself is orange, and
 * "mixed" is white like "all services" — it is the absence of one service, not a
 * third kind of one (owner, 2026-09-04).
 * ------------------------------------------------------------------------- */

ok("personal training is pale blue", V.serviceColour("אימון אישי") === "#7DD3F0");
ok("group training is purple", V.serviceColour("אימון קבוצתי") === "#B57BE8");
ok("anything he typed himself is orange", V.serviceColour("הרצאה") === "#F0913E");
ok("and nothing at all is the neutral", V.serviceColour("") === V.SERVICE_COLOURS.neutral);

const svcTable = V.tableHtml(
  [
    { id: "a", day: "2026-09-01", name: "x", service: "אימון אישי", price: 1 },
    { id: "b", day: "2026-09-02", name: "x", service: "הרצאה", price: 1 },
  ],
  2, {}, null, {}
);
ok("the table paints each session's service", svcTable.indexOf("color:#7DD3F0") >= 0 && svcTable.indexOf("color:#F0913E") >= 0);

const mixedRow = V.tableHtml(
  [{ name: "x", count: 2, total: 2, service: "", mixed: true, invoiced: false }],
  2, {}, null, { grouped: true, rangeLabel: "החודש" }
);
ok("a place with several services says מגוון in white", mixedRow.indexOf("מגוון") >= 0 && mixedRow.indexOf("color:#E8E4D8") >= 0);
ok("and it is no longer orange", mixedRow.indexOf("color:var(--brand)") < 0);

const svcFilter = V.filtersHtml({ services: ["אימון אישי", "אימון קבוצתי", "הרצאה"], service: "אימון קבוצתי" });
ok("every option in the filter carries its colour", (svcFilter.match(/<option value="[^"]+"[^>]*style="color:#/g) || []).length === 3);
ok('"all services" is the neutral one', svcFilter.indexOf('<option value="" style="color:' + V.SERVICE_COLOURS.neutral) >= 0);
ok("and the closed field wears whatever is chosen", svcFilter.indexOf('id="ledFService" data-led-filter="service" style="color:#B57BE8"') >= 0);

console.log("\nAll admin ledger page checks passed (" + passed + " assertions).");
