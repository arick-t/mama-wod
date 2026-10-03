/**
 * What the book COSTS, counted against a real store.
 *
 * On 2026-09-02 the Blob store was suspended mid-testing. The cause was never a
 * feature: the admin page refreshed every twenty seconds and building that list read
 * every athlete in full. The owner bought a month of Pro to keep working, and on
 * 2026-09-30 the same store was suspended again on the way back down to the free plan.
 *
 * He asked, before this release ships, to be sure it cannot happen again — and that
 * what he has fits inside the free plan (owner, 2026-09-30). So this file does not
 * read the source hopefully. It RUNS the endpoint against a counting store and fails
 * if a screen ever costs more because he has more clients.
 *
 * The rule being defended, in one line:
 *   NOTHING HERE IS ON A TIMER, AND NOTHING HERE GROWS WITH THE BUSINESS.
 *
 * Run: node scripts/admin-ledger-cost.test.js
 */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

let passed = 0;
function ok(name, cond, extra) {
  assert.ok(cond, name + (extra === undefined ? "" : " — " + JSON.stringify(extra)));
  passed += 1;
  console.log("ok —", name);
}

/* A store of our own. Never the repo's data/, never the real Blob. */
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "dw-ledger-cost-"));
process.env.ADMIN_DATA_ROOT = ROOT;
process.env.ADMIN_PASSWORD = "test-pw-ledger-cost";
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.VERCEL_OIDC_TOKEN;
delete process.env.BLOB_STORE_ID;
delete process.env.VERCEL;
delete process.env.AWS_LAMBDA_FUNCTION_NAME;

const store = require("./lib/admin/admin-json-store");
const count = { get: 0, put: 0, list: 0, objectsListed: 0 };
const realGet = store.getJson;
const realPut = store.putJson;
const realList = store.listJson;
store.getJson = async function (k) { count.get += 1; return realGet(k); };
store.putJson = async function (k, d, o) { count.put += 1; return realPut(k, d, o); };
store.listJson = async function (p) {
  count.list += 1;
  const rows = await realList(p);
  count.objectsListed += (rows || []).length;
  return rows;
};

const handler = require("./lib/admin/admin-ledger");

function res() {
  const r = { statusCode: 0, payload: null, headers: {} };
  r.status = function (c) { r.statusCode = c; return r; };
  r.json = function (j) { r.payload = j; return r; };
  r.end = function () { return r; };
  r.setHeader = function () {};
  r.getHeader = function () { return undefined; };
  return r;
}

let seq = 0;
async function post(body) {
  const r = res();
  seq += 1;
  await handler(
    {
      method: "POST",
      headers: {
        "x-admin-password": process.env.ADMIN_PASSWORD,
        "x-forwarded-for": "10.9." + ((seq >> 8) & 255) + "." + (seq & 255),
      },
      body: body,
      socket: { remoteAddress: "10.9.0.1" },
      url: "/api/admin-ledger",
    },
    r
  );
  return r;
}

const TODAY = "2026-09-30";
const MONTH = "2026-09";

function spent(fn) {
  return async function () {
    const before = { get: count.get, put: count.put, list: count.list, objects: count.objectsListed };
    const out = await fn();
    return {
      out: out,
      get: count.get - before.get,
      put: count.put - before.put,
      list: count.list - before.list,
      objects: count.objectsListed - before.objects,
    };
  };
}

async function addClients(from, to) {
  for (let i = from; i <= to; i += 1) {
    await post({
      action: "save_subscription",
      clientId: "p_cost_" + i,
      name: "לקוח " + i,
      price: 500 + i,
      startDay: "2026-09-05",
      today: TODAY,
    });
  }
}

(async function main() {
  /* ── one client ──────────────────────────────────────────────────────── */
  await addClients(1, 1);

  const openOnce = await spent(function () { return post({ action: "month", month: MONTH, today: TODAY }); })();
  ok("opening the book answers", openOnce.out.statusCode === 200 && openOnce.out.payload.ok === true);
  ok("IT NEVER LISTS THE STORE", openOnce.list === 0 && openOnce.objects === 0);
  const openAgain = await spent(function () { return post({ action: "month", month: MONTH, today: TODAY }); })();
  ok("opening it again is three small reads", openAgain.get === 3, { reads: openAgain.get });
  ok("and writes nothing at all", openAgain.put === 0, { writes: openAgain.put });

  /* ── thirty clients, which is more than he has ───────────────────────── */
  await addClients(2, 30);
  const openBig = await spent(function () { return post({ action: "month", month: MONTH, today: TODAY }); })();
  ok(
    "THE BOOK DOES NOT GROW WITH THE BUSINESS",
    openBig.get === openAgain.get,
    { oneClient: openAgain.get, thirtyClients: openBig.get }
  );
  ok("still nothing listed at thirty clients", openBig.list === 0 && openBig.objects === 0);
  ok("and still nothing written", openBig.put === 0);
  ok("the answer carries all thirty in one object", openBig.out.payload.subscriptions.length === 30);

  /* ── a month far ahead: drawn, never written ─────────────────────────── */
  const ahead = await spent(function () { return post({ action: "month", month: "2027-06", today: TODAY }); })();
  ok("a month a year ahead is answered", ahead.out.statusCode === 200);
  ok("LOOKING AHEAD WRITES NOTHING", ahead.put === 0, { writes: ahead.put });
  ok("and costs the same three reads", ahead.get === 3, { reads: ahead.get });
  ok("with every client drawn on it", ahead.out.payload.deals.filter(function (d) {
    return d.projected === true;
  }).length === 30);

  /* Scrolling ten months forward is ten times that and not one write. */
  const scroll = await spent(async function () {
    for (let i = 1; i <= 10; i += 1) {
      await post({ action: "month", month: "2027-" + String(i).padStart(2, "0"), today: TODAY });
    }
  })();
  ok("scrolling ten months ahead writes nothing", scroll.put === 0, { writes: scroll.put });
  ok("and reads three per month, no more", scroll.get === 30, { reads: scroll.get });

  /* ── the outstanding total ───────────────────────────────────────────── */
  const owed = await spent(function () { return post({ action: "uninvoiced", today: TODAY }); })();
  ok("what is owed is answered", owed.out.statusCode === 200 && owed.out.payload.ok === true);
  ok("THE NUMBER IS ONE OBJECT, NOT A SCAN", owed.get <= 2, { reads: owed.get });
  ok("and it lists nothing", owed.list === 0 && owed.objects === 0);

  /* ── the record ──────────────────────────────────────────────────────── */
  const range = await spent(function () {
    return post({ action: "range", from: "2026-09-01", to: "2026-09-30", today: TODAY });
  })();
  ok("a month of the record is two reads", range.get === 2, { reads: range.get });
  const year = await spent(function () {
    return post({ action: "range", from: "2020-01-01", to: "2026-12-31", today: TODAY });
  })();
  ok("SEVEN YEARS IS STILL CAPPED AT TWELVE MONTHS", year.get <= 13, { reads: year.get });
  ok("and never lists the store", year.list === 0);

  /* ── the whole gesture: entering the tab ─────────────────────────────── */
  const enter = await spent(async function () {
    await post({ action: "month", month: MONTH, today: TODAY });
    await post({ action: "range", from: "2026-09-01", to: "2026-09-30", today: TODAY });
    await post({ action: "uninvoiced", today: TODAY });
  })();
  ok(
    "ENTERING THE BOOK COSTS UNDER TEN READS, WHATEVER HE HAS",
    enter.get <= 10,
    { reads: enter.get, clients: 30 }
  );
  ok("and writes nothing", enter.put === 0, { writes: enter.put });

  /* Doing it twenty times — a working session of tab-switching — stays linear and
     tiny. The thing that killed the store was a TIMER; this is a man pressing a chip. */
  const session = await spent(async function () {
    for (let i = 0; i < 20; i += 1) {
      await post({ action: "month", month: MONTH, today: TODAY });
    }
  })();
  ok("twenty entries are sixty reads, not six hundred", session.get === 60, { reads: session.get });
  ok("and still not one write", session.put === 0);

  /* ── the deliberate writes, and their fences ─────────────────────────── */
  const freeze = await spent(function () {
    return post({ action: "save_subscription", clientId: "p_cost_1", active: false, today: TODAY });
  })();
  ok("freezing a client is a bounded pass, not a scan", freeze.get <= 16, { reads: freeze.get });
  ok("and it never lists the store", freeze.list === 0);
  const drop = await spent(function () {
    return post({ action: "delete_subscription", clientId: "p_cost_1", today: TODAY });
  })();
  ok("deleting one is bounded too", drop.get <= 16, { reads: drop.get });
  ok("and lists nothing", drop.list === 0);

  /* ── the promise that matters most ───────────────────────────────────── */
  ok(
    "IN THIS WHOLE FILE THE STORE WAS NEVER LISTED, NOT ONCE",
    count.list === 0 && count.objectsListed === 0,
    { lists: count.list, objects: count.objectsListed }
  );

  /* ── nothing here is on a timer ──────────────────────────────────────── */
  const page = fs.readFileSync(path.join(__dirname, "..", "admin.html"), "utf8");
  const ledgerBlock = page.slice(page.indexOf("THE SUMMARY TAB"));
  ok("the book sets no timer of its own", ledgerBlock.indexOf("setInterval") < 0);
  ok("and nothing polls it", !/setInterval[\s\S]{0,400}(loadMonth|LedgerScreen)/.test(page));
  /* ── AND NOW: NOTHING AT ALL ASKS THE SERVER ON A CLOCK ──────────────────
     The last timer went on 2026-10-02. The free store allows about ten thousand
     operations a month — roughly 333 a day — and a tab left open was spending 240 of
     them on a question nobody had asked. What replaced it costs nothing until it is
     wanted: his own writes redraw the list, coming back to the tab asks once, and a
     button asks whenever he says so (owner, 2026-10-02). */
  ok("the admin page sets no server timer at all", !/adminPollTimer = setInterval/.test(page));
  ok("the poll function is only called by hand or on return", !/setInterval[\s\S]{0,200}pollAdminListStamp/.test(page));
  ok("coming back to the tab still asks once", /visibilitychange[\s\S]{0,160}pollAdminListStamp\(\)/.test(page));
  ok("and there is a button to ask with", /id="btn-admin-refresh"[\s\S]{0,120}adminManualRefresh\(\)/.test(page));
  ok("which asks the cheap question first", /function adminManualRefresh[\s\S]{0,600}pollAdminListStamp\(\)/.test(page));

  /* The client's page keeps one timer, and it is the access check — not the plan. */
  const clientPage = fs.readFileSync(path.join(__dirname, "..", "client.html"), "utf8");
  ok("the client page keeps exactly one timer", (clientPage.match(/setInterval\(/g) || []).length === 1);
  ok("and it ticks every five minutes, not every minute", /\}, 5 \* 60000\);/.test(clientPage));
  ok("it asks only whether he is still allowed in", /action: "ping"[\s\S]{0,200}5 \* 60000/.test(clientPage));
  ok("it stops while the page is out of sight", /document\.hidden\) return;[\s\S]{0,120}action: "ping"/.test(clientPage));
  ok("and the client can ask for the plan himself", /id="cvRefresh"/.test(clientPage) && /function manualRefresh/.test(clientPage));
  /* The arithmetic that decided it, kept because it is the whole argument: at 45
     seconds an open tab cost about 14,000 reads a month, at two minutes about 5,300,
     and at no timer at all it costs nothing. The ceiling it was all measured against —
     ten thousand a month — was read off the owner's own dashboard on 2026-10-02, and
     not knowing it was how 5,300 came to be called "safe". */
  ok("an open tab now costs nothing while it sits there", !/adminPollTimer = setInterval/.test(page));
  ok("his own writes do not wait for a tick", /loadList\(\)/.test(page));

  try { fs.rmSync(ROOT, { recursive: true, force: true }); } catch (e) {}
  console.log("\nAll ledger cost checks passed (" + passed + " assertions).");
})();
