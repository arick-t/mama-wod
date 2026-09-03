/**
 * The coach's own book — the arithmetic.
 * Run: node scripts/coach-ledger.test.js
 *
 * Two promises are asserted harder than anything else here, because both are about
 * money the owner has already earned:
 *   - a past deal keeps the price it was done at, whatever he charges next time;
 *   - a month's total is that month's deals and nothing else.
 */
const assert = require("assert");
const L = require("../lib/coach-ledger.js");

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  passed += 1;
  console.log("ok —", name);
}

/* A fixed clock, so "last used" ordering is a fact and not a race. */
let t = Date.UTC(2026, 8, 3, 9, 0, 0);
const clock = function () {
  t += 1000;
  return t;
};

/* --- dates, the way a month is read ------------------------------------- */

ok("a month key is the first seven characters", L.monthKey("2026-09-03") === "2026-09");
ok("September has thirty days", L.daysInMonth("2026-09").length === 30);
ok("February 2028 has twenty-nine", L.daysInMonth("2028-02").length === 29);
ok("the first of September 2026 is a Tuesday", L.weekdayOf("2026-09-01") === 2);
ok("a month steps back over a year boundary", L.shiftMonth("2026-01", -1) === "2025-12");
ok("and forward", L.shiftMonth("2026-12", 1) === "2027-01");
ok("garbage does not become a date", L.daysInMonth("nonsense").length === 0);

/* --- money ------------------------------------------------------------- */

ok("a price rounds to agorot", L.money("250.456") === 250.46);
ok("a shekel sign does not break it", L.money("₪180") === 180);
ok("a negative price is refused as zero", L.money(-40) === 0);
ok("an absurd price is capped, not stored", L.money(999999999) === L.MAX_PRICE);
ok("nonsense is zero, never NaN", L.money("abc") === 0);

/* --- writing a deal ---------------------------------------------------- */

let month = L.emptyMonth("2026-09");
const first = L.addDeal(month, { day: "2026-09-03", name: "רימון", service: "אימון קבוצתי", price: 250 }, { clock: clock });
ok("a deal is written", first.ok && first.doc.deals.length === 1);
ok("it carries a hidden timestamp", /^\d{4}-\d{2}-\d{2}T/.test(first.deal.createdAt));
ok("and an id of its own", !!first.deal.id);
month = first.doc;

ok(
  "a deal with no place is refused",
  L.addDeal(month, { day: "2026-09-03", price: 100 }).code === "NO_NAME"
);
ok(
  "a deal with no price is refused",
  L.addDeal(month, { day: "2026-09-03", name: "רימון" }).code === "NO_PRICE"
);
ok(
  "a day from another month is refused",
  L.addDeal(month, { day: "2026-10-01", name: "רימון", price: 100 }).code === "WRONG_MONTH"
);

const second = L.addDeal(month, { day: "2026-09-03", name: "אולם העירייה", service: "אישי", price: 180 }, { clock: clock });
month = second.doc;
const third = L.addDeal(month, { day: "2026-09-20", name: "רימון", service: "אימון קבוצתי", price: 250 }, { clock: clock });
month = third.doc;

ok("the month totals what it holds", L.monthTotal(month) === 680);
ok("a day totals what it holds", L.totalsByDay(month)["2026-09-03"] === 430);
ok("a quiet day carries nothing", L.totalsByDay(month)["2026-09-04"] === undefined);
ok("a day lists its own deals only", L.dealsOfDay(month, "2026-09-20").length === 1);
ok(
  "two deals on one day keep the order they were entered",
  L.dealsOfDay(month, "2026-09-03")[0].name === "רימון"
);

/* --- fixing a mistake -------------------------------------------------- */

const fixed = L.updateDeal(month, second.deal.id, { price: 200 }, { clock: clock });
ok("a price can be corrected", fixed.ok && fixed.deal.price === 200);
ok("and the id does not change", fixed.deal.id === second.deal.id);
ok("the month follows the correction", L.monthTotal(fixed.doc) === 700);
month = fixed.doc;

const moved = L.updateDeal(month, second.deal.id, { day: "2026-09-04" }, { clock: clock });
ok("a deal can move to the right square", moved.ok && L.dealsOfDay(moved.doc, "2026-09-04").length === 1);
ok(
  "but not out of the month",
  L.updateDeal(month, second.deal.id, { day: "2026-10-04" }).code === "WRONG_MONTH"
);
ok("an unknown deal is not found", L.updateDeal(month, "nope", { price: 5 }).code === "NOT_FOUND");
ok("a correction to nothing is refused", L.updateDeal(month, second.deal.id, { price: 0 }).code === "NO_PRICE");

const removed = L.removeDeal(month, second.deal.id);
ok("a deal can be deleted", removed.ok && removed.doc.deals.length === 2);
ok("deleting nothing says so", L.removeDeal(month, "nope").code === "NOT_FOUND");

/* --- the warehouse ------------------------------------------------------ */

let w = L.emptyWarehouse();
w = L.rememberPlace(w, { name: "רימון", service: "אימון קבוצתי", price: 250 }, { clock: clock });
w = L.rememberPlace(w, { name: "אולם העירייה", service: "אישי", price: 180 }, { clock: clock });
ok("a place is remembered the first time it is used", w.places.length === 2);
ok("with what it is known for", L.placeDefaults(w, "רימון").service === "אימון קבוצתי");
ok("and what it last paid", L.placeDefaults(w, "רימון").price === 250);

w = L.rememberPlace(w, { name: "  רימון ", service: "אימון קבוצתי", price: 300 }, { clock: clock });
ok("the same place typed loosely is the same place", w.places.length === 2);
ok("a new price becomes the default for next time", L.placeDefaults(w, "רימון").price === 300);
ok("and it counts the visits", L.placeDefaults(w, "רימון") && w.places.find(function (p) { return p.name === "רימון"; }).uses === 2);

w = L.rememberPlace(w, { name: "רימון", service: "", price: 300 }, { clock: clock });
ok(
  "a blank service does not erase what the place is known for",
  L.placeDefaults(w, "רימון").service === "אימון קבוצתי"
);

/* THE promise: a new price never reaches a deal already done. */
ok("the deal done at 250 is still 250", L.dealsOfDay(month, "2026-09-03")[0].price === 250);
ok("and the month it belongs to has not moved", L.monthTotal(month) === 700);

["גימיני", "סטודיו ב", "מכון הכפר", "בית ספר", "חוף הים"].forEach(function (n) {
  w = L.rememberPlace(w, { name: n, service: "אישי", price: 150 }, { clock: clock });
});
const favs = L.favourites(w);
ok("the name field is offered five places", favs.length === 5);
ok("the most recent is first", favs[0].name === "חוף הים");
ok("and the oldest fell off the list", !favs.some(function (p) { return p.name === "אולם העירייה"; }));
ok("a place nobody used is not invented", L.placeDefaults(w, "מקום שלא היה") === null);

/* --- the table ---------------------------------------------------------- */

const rows = [
  { id: "a", day: "2026-09-01", name: "רימון", service: "קבוצתי", price: 250, createdAt: "2026-09-01T06:00:00Z" },
  { id: "b", day: "2026-09-15", name: "אולם העירייה", service: "אישי", price: 180, createdAt: "2026-09-15T06:00:00Z" },
  { id: "c", day: "2026-10-02", name: "רימון", service: "קבוצתי", price: 300, createdAt: "2026-10-02T06:00:00Z" },
];
ok("newest first", L.filterDeals(rows, {})[0].id === "c");
ok("filtering by place is a contains, not an exact match", L.filterDeals(rows, { name: "רימ" }).length === 2);
ok("filtering by place ignores case", L.filterDeals(rows, { name: "רימון" }).length === 2);
ok("a floor price filters", L.filterDeals(rows, { minPrice: 200 }).length === 2);
ok("a ceiling price filters", L.filterDeals(rows, { maxPrice: 200 }).length === 1);
ok("a date range filters", L.filterDeals(rows, { from: "2026-09-01", to: "2026-09-30" }).length === 2);
ok("filters combine", L.filterDeals(rows, { name: "רימון", from: "2026-10-01", to: "2026-10-31" }).length === 1);
ok("the sum is of what is shown", L.sumOf(L.filterDeals(rows, { name: "רימון" })) === 550);

/* --- the two buttons ---------------------------------------------------- */

const week = L.weekRange("2026-09-03");
ok("a week starts on Sunday", L.weekdayOf(week.from) === 0);
ok("and ends on Saturday", L.weekdayOf(week.to) === 6);
ok("the day asked about is inside it", week.from <= "2026-09-03" && week.to >= "2026-09-03");
const mr = L.monthRange("2026-09-15");
ok("a month range is the whole month", mr.from === "2026-09-01" && mr.to === "2026-09-30");

/* A week that straddles two months must read both boxes — and only both. */
ok("a range names the months it touches", JSON.stringify(L.monthsBetween("2026-09-28", "2026-10-04")) === '["2026-09","2026-10"]');
ok("one month is one read", L.monthsBetween("2026-09-01", "2026-09-30").length === 1);
ok("a reversed range still answers", L.monthsBetween("2026-10-04", "2026-09-28").length === 2);
ok("a runaway range cannot spin forever", L.monthsBetween("1900-01-01", "2200-01-01").length <= 240);

/* --- what must never happen --------------------------------------------- */

const src = require("fs").readFileSync(require("path").join(__dirname, "..", "lib", "coach-ledger.js"), "utf8");
ok("the book makes no network calls", !/\bfetch\s*\(/.test(src));
ok("and knows no AI provider", !/gemini|groq|generativelanguage/i.test(src));

console.log("\nAll coach ledger checks passed (" + passed + " assertions).");
