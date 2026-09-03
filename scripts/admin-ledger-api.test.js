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
  ok(
    "opening a month reads the month and the places — nothing else",
    reads.length === 2 && reads[0] === "coach-ledger/2026-09.json" && reads[1] === "coach-ledger/places.json"
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
  ok("and reads exactly the two months it touches", reads.length === 2);
  ok("the rows are newest first", range.body.deals[0].day === "2026-10-02");
  ok("with the sum of what is shown", range.body.total === range.body.deals.reduce(function (s, d) { return s + d.price; }, 0));

  const byName = await call({ action: "range", from: "2026-09-01", to: "2026-10-31", name: "רימון" });
  ok("filtering by place works over the wire", byName.body.deals.every(function (d) { return d.name === "רימון"; }));
  const byPrice = await call({ action: "range", from: "2026-09-01", to: "2026-10-31", minPrice: 200 });
  ok("so does a floor price", byPrice.body.deals.every(function (d) { return d.price >= 200; }));

  /* A year is not a licence to read a hundred objects. */
  reads.length = 0;
  await call({ action: "range", from: "2026-01-01", to: "2026-12-31" });
  ok("a huge range is capped rather than reading the whole history", reads.length <= 3);

  /* --- last month is still last month ------------------------------------ */

  const september = await call({ action: "month", month: "2026-09" });
  ok("browsing back shows that month's own sum", september.body.total === 300);
  const october = await call({ action: "month", month: "2026-10" });
  ok("and the next month starts from its own deals", october.body.total === 180);

  const bad = await call({ action: "nonsense" });
  ok("an unknown action is refused", bad.status === 400 && bad.body.code === "BAD_ACTION");

  /* --- properties of the code itself ------------------------------------- */

  const src = fs.readFileSync(path.join(root, "scripts", "lib", "admin", "admin-ledger.js"), "utf8");
  ok("the endpoint never lists the store", !/listJson/.test(src));
  ok("it holds no route to a provider", !/gemini|groq|generativelanguage/i.test(src));
  ok("and it checks the owner before it touches storage", src.indexOf("checkAdminAuth") < src.indexOf("readMonth(month)"));

  console.log("\nAll admin ledger API checks passed (" + passed + " assertions).");
}

main().catch(function (e) {
  console.error("FAIL:", (e && e.stack) || e);
  process.exit(1);
});
