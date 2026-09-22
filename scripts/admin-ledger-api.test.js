/**
 * /api/admin-ledger — the coach's book, over the wire.
 * Run: node scripts/admin-ledger-api.test.js
 *
 * Drives the real handler against an in-memory stand-in for Blob, because the two
 * things that matter here cannot be seen in the source: that a stranger never gets in,
 * and that opening a month READS ONE OBJECT. The second is not a style preference —
 * a poll that read every object had the Blob store suspended on 2026-09-02.
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
const modPath = require.resolve("../scripts/lib/admin/admin-ledger.js");
const storePath = require.resolve("../scripts/lib/admin/admin-json-store.js");
const authPath = require.resolve("../scripts/lib/admin/admin-auth.js");

const data = new Map();
const reads = [];
const writes = [];

delete require.cache[modPath];
require.cache[storePath] = {
  id: storePath,
  filename: storePath,
  loaded: true,
  exports: {
    async getJson(k) {
      reads.push(k);
      const hit = data.get(k);
      return hit === undefined ? null : JSON.parse(JSON.stringify(hit));
    },
    async putJson(k, v) {
      writes.push(k);
      data.set(k, JSON.parse(JSON.stringify(v)));
      return { ok: true };
    },
    async deleteJson(k) {
      data.delete(k);
      return { ok: true };
    },
    storageInfo() {
      return { backend: "memory", durable: true };
    },
  },
};
require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: {
    checkAdminAuth(req) {
      return String(((req && req.headers) || {})["x-admin-password"] || "") === "owner-pw";
    },
    adminAuthDenied(res) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    },
  },
};

const handler = require("../scripts/lib/admin/admin-ledger.js");

let seq = 0;
function call(body, opts) {
  const o = opts || {};
  return new Promise(function (resolve) {
    let code = 200;
    const res = {
      headersSent: false,
      setHeader() {},
      status(c) { code = c; return res; },
      json(payload) { resolve({ status: code, body: payload }); return res; },
      end() { resolve({ status: code, body: null }); return res; },
    };
    seq += 1;
    const headers = { "x-forwarded-for": "10.4." + ((seq >> 8) & 255) + "." + (seq & 255) };
    if (o.auth !== false) headers["x-admin-password"] = "owner-pw";
    handler({ method: o.method || "POST", headers: headers, body: body || {}, socket: {} }, res);
  });
}

async function main() {
  /* --- the door ---------------------------------------------------------- */

  const stranger = await call({ action: "month", month: "2026-09" }, { auth: false });
  ok("a stranger is refused", stranger.status === 401);
  ok("and nothing was read on their behalf", reads.length === 0);

  const status = await call({}, { method: "GET", auth: false });
  ok("the status GET answers without a credential", status.status === 200 && status.body.ok === true);
  ok("and declares no AI surface", status.body.aiSurface === "none");

  /* --- an empty month ---------------------------------------------------- */

  reads.length = 0;
  const empty = await call({ action: "month", month: "2026-09" });
  ok("an empty month opens", empty.status === 200 && empty.body.ok === true);
  ok("with nothing in it", empty.body.deals.length === 0 && empty.body.total === 0);
  ok("and no favourites yet", empty.body.favourites.length === 0);
  /* Three fixed objects, and the third is the whole arrangement book: every client
     who pays monthly, in one read. The count is the point — a screen that reads once
     per client is the shape that had the store suspended on 2026-09-02. */
  ok(
    "opening a month reads the subscriptions, the month and the places — nothing else",
    reads.length === 3 &&
      reads.indexOf("coach-ledger/subscriptions.json") >= 0 &&
      reads.indexOf("coach-ledger/2026-09.json") >= 0 &&
      reads.indexOf("coach-ledger/places.json") >= 0
  );
  ok(
    "and the count does not grow with the number of monthly clients",
    reads.filter(function (k) { return k.indexOf("subscriptions") >= 0; }).length === 1
  );
  ok("and it never lists the store", reads.every(function (k) { return k.endsWith(".json"); }));

  /* --- a deal ------------------------------------------------------------ */

  const added = await call({ action: "add_deal", day: "2026-09-03", name: "רימון", service: "אימון קבוצתי", price: 250 });
  ok("a deal is saved", added.status === 200 && added.body.deals.length === 1);
  ok("the month answers with its new total", added.body.total === 250);
  ok("the day carries it", added.body.totalsByDay["2026-09-03"] === 250);
  ok("the place was remembered without being asked", added.body.favourites.length === 1);
  ok("with its service and price", added.body.favourites[0].service === "אימון קבוצתי" && added.body.favourites[0].price === 250);

  const noName = await call({ action: "add_deal", day: "2026-09-03", price: 100 });
  ok("a deal with no place is refused", noName.status === 400 && noName.body.code === "NO_NAME");
  const noPrice = await call({ action: "add_deal", day: "2026-09-03", name: "רימון" });
  ok("a deal with no price is refused", noPrice.status === 400 && noPrice.body.code === "NO_PRICE");
  ok(
    "and a refused deal never reaches the warehouse",
    JSON.parse(JSON.stringify(data.get("coach-ledger/places.json"))).places.length === 1
  );

  /* --- a raise, and the history it must not touch ------------------------ */

  const second = await call({ action: "add_deal", day: "2026-09-20", name: "רימון", service: "אימון קבוצתי", price: 300 });
  ok("the same place is used again at a new price", second.body.total === 550);
  ok("the warehouse offers the NEW price next time", second.body.favourites[0].price === 300);
  const septemberDeals = second.body.deals.slice().sort(function (a, b) { return a.day < b.day ? -1 : 1; });
  ok("and the first deal is still the price it was done at", septemberDeals[0].price === 250);

  /* --- fixing a typo ----------------------------------------------------- */

  const target = septemberDeals[0];
  const fixed = await call({ action: "update_deal", id: target.id, month: "2026-09", day: target.day, name: target.name, service: target.service, price: 260 });
  ok("a mistyped price can be corrected", fixed.status === 200 && fixed.body.total === 560);
  const gone = await call({ action: "delete_deal", id: target.id, month: "2026-09" });
  ok("a deal can be deleted", gone.status === 200 && gone.body.deals.length === 1);
  const ghost = await call({ action: "delete_deal", id: "nope", month: "2026-09" });
  ok("deleting what is not there is a 404, not a silent success", ghost.status === 404);

  /* --- the table, and what a range costs --------------------------------- */

  await call({ action: "add_deal", day: "2026-10-02", name: "אולם העירייה", service: "אישי", price: 180 });
  reads.length = 0;
  const range = await call({ action: "range", from: "2026-09-28", to: "2026-10-04" });
  ok("a week across a month boundary answers", range.status === 200 && range.body.ok === true);
  ok("it sees both sides of the boundary", range.body.months.length === 2);
  /* Two months, plus the one arrangement book that says which bills are still ahead —
     and that one is read once however many monthly clients there are. */
  ok("and reads exactly the two months it touches, plus the arrangements", reads.length === 3);
  ok(
    "the arrangements are read once, not once per client",
    reads.filter(function (k) { return k.indexOf("subscriptions") >= 0; }).length === 1
  );
  ok("the rows are newest first", range.body.deals[0].day === "2026-10-02");
  ok("with the sum of what is shown", range.body.total === range.body.deals.reduce(function (s, d) { return s + d.price; }, 0));

  const byName = await call({ action: "range", from: "2026-09-01", to: "2026-10-31", name: "רימון" });
  ok("filtering by place works over the wire", byName.body.deals.every(function (d) { return d.name === "רימון"; }));
  const byPrice = await call({ action: "range", from: "2026-09-01", to: "2026-10-31", minPrice: 200 });
  ok("so does a floor price", byPrice.body.deals.every(function (d) { return d.price >= 200; }));

  /* A year is twelve small objects, and he asked for the button (2026-09-03). Two years
     is still twelve: the cap is what stops a range from becoming a scan. */
  reads.length = 0;
  const year = await call({ action: "range", from: "2026-01-01", to: "2026-12-31" });
  ok("a year answers", year.status === 200 && year.body.ok === true);
  ok("and reads twelve months at most, plus the arrangements", reads.length <= 13);
  reads.length = 0;
  await call({ action: "range", from: "2020-01-01", to: "2026-12-31" });
  ok("seven years is still capped at twelve", reads.length <= 13);

  /* --- last month is still last month ------------------------------------ */

  const september = await call({ action: "month", month: "2026-09" });
  ok("browsing back shows that month's own sum", september.body.total === 300);
  const october = await call({ action: "month", month: "2026-10" });
  ok("and the next month starts from its own deals", october.body.total === 180);

  const bad = await call({ action: "nonsense" });
  ok("an unknown action is refused", bad.status === 400 && bad.body.code === "BAD_ACTION");


  /* --- the favourites box, and the pencil in it ------------------------- */

  const stranger2 = await call({ action: "places" }, { auth: false });
  ok("the list of places is his alone", stranger2.status === 401);

  await call({ action: "add_deal", day: "2026-10-03", name: "רימון", service: "קבוצתי", price: 300 });
  const list = await call({ action: "places" });
  ok("the box lists everyone he has worked for", list.status === 200 && list.body.places.length >= 2);
  ok("busiest first", list.body.places[0].uses >= list.body.places[1].uses);

  const coloured = await call({ action: "update_place", name: "רימון", colour: "#4CAF70" });
  ok("a place can be given a colour", coloured.status === 200 && coloured.body.colours["רימון"] === "#4CAF70");
  const month2 = await call({ action: "month", month: "2026-10" });
  ok("and the colour travels with the month, so rows can be painted", month2.body.colours["רימון"] === "#4CAF70");

  const renamedApi = await call({ action: "update_place", name: "רימון", newName: "רימון פיטנס" });
  ok("a place can be renamed", renamedApi.status === 200);
  ok("the rows that carried the old name moved with it", renamedApi.body.renamedRows >= 1);
  const after = await call({ action: "month", month: "2026-10" });
  ok("so the calendar shows the corrected name", after.body.deals.every(function (d) { return d.name !== "רימון"; }));
  ok("and the colour survived the rename", after.body.colours["רימון פיטנס"] === "#4CAF70");
  ok("the month total did not move with the name", after.body.total === month2.body.total);

  const taken = await call({ action: "update_place", name: "אולם העירייה", newName: "רימון פיטנס" });
  ok("two places cannot be merged by a typo", taken.status === 400 && taken.body.code === "NAME_TAKEN");

  /* A rename is deliberate, but it still may not become a scan of the whole store. */
  reads.length = 0;
  await call({ action: "update_place", name: "רימון פיטנס", newName: "רימון" });
  ok("and it is bounded — two years back, three months forward", reads.length <= 32);


  /* --- grouped, and invoiced a place at a time (owner, 2026-09-04) -------- */

  const gp = await call({ action: "range", from: "2026-09-01", to: "2026-10-31" });
  ok("the range answers grouped as well as itemised", Array.isArray(gp.body.groups));
  ok("a place appears once", gp.body.groups.filter(function (g) { return g.name === "רימון פיטנס"; }).length <= 1);
  ok("with its own count and sum", gp.body.groups.every(function (g) { return g.count >= 1 && g.total >= 0; }));

  const target2 = gp.body.groups[0];
  const billed = await call({
    action: "invoice_place",
    name: target2.name,
    from: "2026-09-01",
    to: "2026-10-31",
    invoiced: true,
  });
  ok("a whole place can be invoiced at once", billed.status === 200 && billed.body.changed >= 1);
  const after2 = await call({ action: "range", from: "2026-09-01", to: "2026-10-31" });
  const nowGroup = after2.body.groups.filter(function (g) { return g.name === target2.name; })[0];
  ok("and the place reads as invoiced", nowGroup.invoiced === true);
  ok("every session under it too", after2.body.deals.filter(function (d) { return d.name === target2.name; }).every(function (d) { return d.invoiced === true; }));

  /* Untick ONE session and the place is no longer invoiced — that is the truth. */
  const oneOfThem = after2.body.deals.filter(function (d) { return d.name === target2.name; })[0];
  await call({
    action: "update_deal",
    id: oneOfThem.id,
    month: String(oneOfThem.day).slice(0, 7),
    invoiced: false,
  });
  const after3 = await call({ action: "range", from: "2026-09-01", to: "2026-10-31" });
  const brokenGroup = after3.body.groups.filter(function (g) { return g.name === target2.name; })[0];
  ok("one session unbilled makes the place unbilled", brokenGroup.invoiced === false);
  ok("and the other sessions keep their tick", after3.body.deals.filter(function (d) {
    return d.name === target2.name && d.id !== oneOfThem.id;
  }).every(function (d) { return d.invoiced === true; }));

  const noName2 = await call({ action: "invoice_place", from: "2026-09-01", to: "2026-09-30", invoiced: true });
  ok("invoicing nobody is refused", noName2.status === 400 && noName2.body.code === "NO_NAME");

  reads.length = 0;
  await call({ action: "invoice_place", name: "לא קיים", from: "2020-01-01", to: "2026-12-31", invoiced: true });
  ok("and a huge range is still capped at twelve months", reads.length <= 12);

  /* --- properties of the code itself ------------------------------------- */

  const src = fs.readFileSync(path.join(root, "scripts", "lib", "admin", "admin-ledger.js"), "utf8");
  ok("the endpoint never lists the store", !/listJson/.test(src));
  ok("it holds no route to a provider", !/gemini|groq|generativelanguage/i.test(src));
  ok("and it checks the owner before it touches storage", src.indexOf("checkAdminAuth") < src.indexOf("readMonth(month)"));

  /* --- the monthly client ------------------------------------------------ */

  /* Oded was handed his programme on the 5th of September. From that day the studio
     pays every month, and the book has to know it without being told again. */
  /* Everything above has already written deals into September, so what is asserted
     here is the DIFFERENCE the monthly client makes — a fixed number would only be
     asserting how many tests ran before this one. */
  const beforeMonth = (await call({ action: "month", month: "2026-09" })).body.total;
  const beforeOwed = (await call({ action: "uninvoiced", today: "2026-09-22" })).body.total;

  const born = await call({
    action: "save_subscription",
    clientId: "p_oded",
    name: "עודד מכינה",
    service: "תוכנית אימון מכינה",
    price: 900,
    method: "ביט",
    colour: "#4CAF70",
    startDay: "2026-09-05",
    today: "2026-09-22",
  });
  ok("a client handed a programme becomes a monthly client", born.status === 200 && born.body.subscriptions.length === 1);
  ok("the handover day becomes the billing day", born.body.subscription.billingDay === 5);

  /* The bill for September fell due on the 5th, and today is the 22nd: it is written. */
  const sept = await call({ action: "month", month: "2026-09", today: "2026-09-22" });
  const odedRow = sept.body.deals.filter(function (d) { return d.clientId === "p_oded"; })[0];
  ok("the bill was written into the month it belongs to", !!odedRow && odedRow.day === "2026-09-05");
  ok("it is a row like any other, not a promise", odedRow.projected !== true);
  ok("and it says what it is", odedRow.nature === "recurring");
  ok("the month is worth nine hundred more than it was", sept.body.total === beforeMonth + 900);

  /* Opening the book again must not bill him twice — the thing that would cost real
     money if it ever broke. */
  const again = await call({ action: "month", month: "2026-09", today: "2026-09-22" });
  ok(
    "opening the book twice does not bill him twice",
    again.body.deals.filter(function (d) { return d.clientId === "p_oded"; }).length === 1
  );

  /* A month ahead is drawn, never written. */
  writes.length = 0;
  const oct = await call({ action: "month", month: "2026-10", today: "2026-09-22" });
  const octRow = oct.body.deals.filter(function (d) { return d.clientId === "p_oded"; })[0];
  ok("next month's bill is on the calendar", !!octRow && octRow.day === "2026-10-05");
  ok("and it is marked as a promise, not a record", octRow.projected === true);
  ok("looking at a month ahead writes nothing at all", writes.length === 0);

  /* His colour is chosen on his tab and has to be the same everywhere. */
  ok("the colour chosen on his tab reaches the book", oct.body.colours["עודד מכינה"] === "#4CAF70");

  /* What is owed includes him. */
  const due = await call({ action: "uninvoiced", today: "2026-09-22" });
  ok("an unbilled monthly client is part of what is owed", due.body.total === beforeOwed + 900);

  /* --- a price that changes --------------------------------------------- */

  const later = await call({
    action: "set_subscription_price",
    clientId: "p_oded",
    price: 1000,
    mode: "next",
    today: "2026-09-22",
  });
  ok("a price agreed today starts at the next bill", later.body.from === "2026-10-05");
  ok("and the standing price is still the old one", later.body.subscription.price === 900);
  const octAfter = await call({ action: "month", month: "2026-10", today: "2026-09-22" });
  ok(
    "so next month is drawn at the new price",
    octAfter.body.deals.filter(function (d) { return d.clientId === "p_oded"; })[0].price === 1000
  );
  const septAfter = await call({ action: "month", month: "2026-09", today: "2026-09-22" });
  ok(
    "and the month already billed is untouched",
    septAfter.body.deals.filter(function (d) { return d.clientId === "p_oded"; })[0].price === 900
  );

  /* --- frozen, and gone -------------------------------------------------- */

  await call({ action: "save_subscription", clientId: "p_oded", active: false, today: "2026-09-22" });
  const octFrozen = await call({ action: "month", month: "2026-10", today: "2026-09-22" });
  ok(
    "a frozen client is not billed again",
    octFrozen.body.deals.filter(function (d) { return d.clientId === "p_oded"; }).length === 0
  );
  ok("but he is still in the book", octFrozen.body.subscriptions.length === 1);
  ok("freezing forgets nothing about him", octFrozen.body.subscriptions[0].price === 900);

  const removed = await call({ action: "delete_subscription", clientId: "p_oded" });
  ok("deleting the client empties the arrangement", removed.status === 200 && removed.body.subscriptions.length === 0);
  const septKept = await call({ action: "month", month: "2026-09", today: "2026-09-22" });
  ok(
    "what he already paid stays written",
    septKept.body.deals.filter(function (d) { return d.clientId === "p_oded"; }).length === 1
  );
  ok("a subscription that is not there says so", (await call({ action: "delete_subscription", clientId: "nobody" })).status === 404);
  ok("a subscription needs a client", (await call({ action: "save_subscription", name: "אף אחד" })).body.code === "NO_CLIENT");

  /* Every client in the module sends its name and colour here when either changes.
     Only the ones who actually pay monthly belong in this book. */
  const renamedOnly = await call({ action: "save_subscription", clientId: "p_someone", name: "מישהו", colour: "#E8451A" });
  ok("renaming a client who pays nothing invents no arrangement",
    renamedOnly.status === 200 && renamedOnly.body.subscriptions.length === 0);
  ok("a billing day of 45 is refused", (await call({ action: "set_billing_day", clientId: "p_oded", day: 45 })).status === 404);


  /* --- what the bill is called ------------------------------------------- */

  /* The first intake has no "what is this for" field at all, so a new arrangement is
     born with the plain answer and he corrects it from the row (owner, 2026-09-22). */
  const noService = await call({
    action: "save_subscription",
    clientId: "p_studio",
    name: "סטודיו ב",
    price: 500,
    startDay: "2026-09-02",
    today: "2026-09-22",
  });
  ok("a new arrangement is called something", noService.body.subscription.service === "תוכנית אימון");

  const renamedService = await call({
    action: "set_subscription_service",
    clientId: "p_studio",
    service: "תוכנית אימון מכינה",
    month: "2026-09",
    today: "2026-09-22",
  });
  ok("and he can say what it really is", renamedService.body.subscription.service === "תוכנית אימון מכינה");
  const studioMonth = await call({ action: "month", month: "2026-09", today: "2026-09-22" });
  const studioRow = studioMonth.body.deals.filter(function (d) { return d.clientId === "p_studio"; })[0];
  ok("the bill on screen takes the new words", studioRow.service === "תוכנית אימון מכינה");

  /* A bill he has already invoiced is what it was billed as. */
  await call({ action: "update_deal", id: studioRow.id, month: "2026-09", invoiced: true });
  await call({ action: "set_subscription_service", clientId: "p_studio", service: "משהו אחר", month: "2026-09" });
  const afterInvoice = await call({ action: "month", month: "2026-09", today: "2026-09-22" });
  ok(
    "but one already invoiced keeps the words it was invoiced with",
    afterInvoice.body.deals.filter(function (d) { return d.clientId === "p_studio"; })[0].service === "תוכנית אימון מכינה"
  );
  ok(
    "while the next bill carries the new ones",
    afterInvoice.body.subscriptions.filter(function (x) { return x.clientId === "p_studio"; })[0].service === "משהו אחר"
  );
  ok("a service cannot be blanked into nothing",
    (await call({ action: "set_subscription_service", clientId: "p_studio", service: "   " })).body.subscription.service === "תוכנית אימון");
  ok("and a client with no arrangement has no service to change",
    (await call({ action: "set_subscription_service", clientId: "nobody", service: "x" })).status === 404);

  console.log("\nAll admin ledger API checks passed (" + passed + " assertions).");
}

main().catch(function (e) {
  console.error("FAIL:", (e && e.stack) || e);
  process.exit(1);
});
