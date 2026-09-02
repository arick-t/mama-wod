/**
 * The poll must cost the same whether the owner has three clients or thirty.
 *
 * On 2026-09-02 Vercel suspended the Blob store mid-testing. The cause was not a bug in
 * any feature: the admin page refreshed itself every twenty seconds, and building that
 * list means READING EVERY ATHLETE IN FULL — training blocks and all. A dozen clients,
 * one open tab, is roughly 2,300 object reads an hour. Two tabs across a working day is
 * the month's quota.
 *
 * The parity test pins the source text. This one runs the thing: it counts real reads
 * against a real store and fails if a poll ever grows with the number of athletes.
 *
 * Run: node scripts/admin-poll-cost.test.js
 */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

/* A store of our own, so the test never touches the repo's data/ or the real Blob. */
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "dw-poll-cost-"));
process.env.ADMIN_DATA_ROOT = ROOT;
process.env.ADMIN_PASSWORD = "test-pw-poll-cost";
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.VERCEL_OIDC_TOKEN;
delete process.env.BLOB_STORE_ID;
delete process.env.VERCEL;
delete process.env.AWS_LAMBDA_FUNCTION_NAME;
/* Seeded coach members would add reads that have nothing to do with what is measured. */
process.env.COACH_MEMBER_SEED = "";

/* Count the store's work BEFORE the handler binds to it — admin-snapshot destructures
   these at require time, so patching after would measure nothing. */
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
  /* listJson does not just enumerate — it downloads each object. This is the number
     that used to run away. */
  count.objectsListed += (rows || []).length;
  return rows;
};

const handler = require("./lib/admin/admin-snapshot");

function res() {
  const r = { statusCode: 0, payload: null, headers: {} };
  r.status = function (c) { r.statusCode = c; return r; };
  r.json = function (j) { r.payload = j; return r; };
  r.end = function () { return r; };
  r.setHeader = function (k, v) { r.headers[k] = v; };
  r.getHeader = function (k) { return r.headers[k]; };
  return r;
}

async function post(body) {
  const r = res();
  await handler(
    {
      method: "POST",
      headers: { "x-admin-password": process.env.ADMIN_PASSWORD, "x-forwarded-for": "10.0.0.7" },
      body: body,
      socket: { remoteAddress: "10.0.0.7" },
      url: "/api/admin-snapshot",
    },
    r
  );
  return r;
}

/** A snapshot the size the real ones are: the training block is most of the weight. */
function athlete(n) {
  return {
    athleteId: "a_" + String(n).padStart(12, "0"),
    displayName: "Athlete " + n,
    intakeSummary: "x".repeat(400),
    currentBlock: {
      blockStart: "2026-09-06",
      weeks: Array.from({ length: 4 }, (_, w) => ({
        theme: "W" + (w + 1),
        days: Array.from({ length: 7 }, (_, d) => ({ date: "2026-09-0" + (d + 1), title: "S", body: "y".repeat(300) })),
      })),
    },
    pastBlocks: [],
  };
}

(async function main() {
  for (let i = 1; i <= 3; i++) await handler.writeSnapshot("a_" + String(i).padStart(12, "0"), athlete(i));

  /* --- what a quiet poll costs ------------------------------------------------ */
  const before = { get: count.get, list: count.list, objects: count.objectsListed };
  const s1 = await post({ action: "admin_list_stamp" });
  const pollGets = count.get - before.get;

  ok("the poll answers", s1.statusCode === 200 && s1.payload && s1.payload.ok === true);
  ok("the poll reports a stamp", typeof s1.payload.stamp === "string" && s1.payload.stamp.length > 0);
  ok("the poll knows how many people there are", s1.payload.count === 3);
  ok("A QUIET POLL READS NOBODY", count.objectsListed === before.objects);
  ok("a quiet poll never lists the store", count.list === before.list);
  ok("a quiet poll is one small read", pollGets === 1);

  /* --- and it stays that cost as the business grows ---------------------------- */
  for (let i = 4; i <= 23; i++) await handler.writeSnapshot("a_" + String(i).padStart(12, "0"), athlete(i));
  const mid = { get: count.get, objects: count.objectsListed };
  const s2 = await post({ action: "admin_list_stamp" });
  ok("twenty more athletes are counted", s2.payload.count === 23);
  ok("THE POLL DOES NOT GROW WITH THE BUSINESS", count.get - mid.get === 1);
  ok("still reads nobody at 23 athletes", count.objectsListed === mid.objects);

  /* --- the stamp has to actually notice a change, or the page goes blind ------- */
  ok("a quiet minute looks quiet", s2.payload.stamp === (await post({ action: "admin_list_stamp" })).payload.stamp);
  const quiet = s2.payload.stamp;
  await handler.writeSnapshot("a_000000000002", Object.assign(athlete(2), { displayName: "Renamed" }));
  const s3 = await post({ action: "admin_list_stamp" });
  ok("A REAL CHANGE MOVES THE STAMP", s3.payload.stamp !== quiet);

  /* --- the expensive path is still there, and still honest --------------------- */
  const beforeList = count.objectsListed;
  const listRes = await post({ action: "admin_list" });
  /* Seeded coach members can appear here too — the list is the only path that seeds. */
  ok("the full list still works", listRes.statusCode === 200 && listRes.payload.snapshots.length >= 23);
  ok("the full list is the expensive one — that is why the poll avoids it", count.objectsListed >= beforeList + 23);
  ok(
    "the list hands back the same stamp the poll compares against",
    listRes.payload.stamp === (await post({ action: "admin_list_stamp" })).payload.stamp
  );

  /* --- a new athlete must be seen, not just a changed one ---------------------- */
  await handler.writeSnapshot("a_000000000099", athlete(99));
  const s4 = await post({ action: "admin_list_stamp" });
  ok("a new athlete moves the stamp", s4.payload.stamp !== listRes.payload.stamp && s4.payload.count === listRes.payload.snapshots.length + 1);

  /* --- and a deletion must be seen too, or the strip keeps a client who is gone --- */
  const beforeDelete = count.objectsListed;
  const rDel = res();
  await handler(
    {
      method: "DELETE",
      headers: { "x-admin-password": process.env.ADMIN_PASSWORD, "x-forwarded-for": "10.0.0.7" },
      query: { id: "a_000000000099" },
      socket: { remoteAddress: "10.0.0.7" },
      url: "/api/admin-snapshot",
    },
    rDel
  );
  ok("delete answers", rDel.statusCode === 200);
  const s5 = await post({ action: "admin_list_stamp" });
  ok("A DELETION MOVES THE STAMP", s5.payload.stamp !== s4.payload.stamp);
  ok("the deleted athlete leaves the count", s5.payload.count === s4.payload.count - 1);
  ok("deleting reads the one athlete, not all of them", count.objectsListed === beforeDelete);

  /* --- the clean slate, proven ------------------------------------------------
   * His first purge left every athlete standing and the only trace was a toast that
   * had already been replaced. One call, and it has to actually empty the list. */
  const beforePurge = await post({ action: "admin_list" });
  ok("there are people to remove", beforePurge.payload.snapshots.length > 0);
  const purged = await post({ action: "admin_purge_all" });
  ok("the purge answers", purged.statusCode === 200 && purged.payload.ok === true);
  ok("it names who it removed", (purged.payload.removed || []).length === beforePurge.payload.snapshots.length);
  ok("and nothing failed silently", (purged.payload.failed || []).length === 0);
  const afterPurge = await post({ action: "admin_list" });
  ok("THE LIST IS EMPTY", afterPurge.payload.snapshots.length === 0);
  const stampAfter = await post({ action: "admin_list_stamp" });
  ok("the poll agrees it is empty", stampAfter.payload.count === 0);
  /* Seeded members must not walk back in — that is why deletion is a tombstone. */
  const secondList = await post({ action: "admin_list" });
  ok("and they stay gone on the next list", secondList.payload.snapshots.length === 0);

  console.log("admin-poll-cost.test.js passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
