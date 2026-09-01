/**
 * Client program store — versioning, locking, index, cache.
 * Run: node scripts/client-program-store.test.js
 *
 * The reason this file exists: Vercel Blob has no conditional write. putJson is a
 * blind overwrite, so "the owner and the coach both save Tuesday" silently loses
 * one of them. These tests drive two concurrent editors and assert the later save
 * is REFUSED, not applied.
 */
const assert = require("assert");
const Store = require("../lib/client-program-store.js");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

/* ---------------------------------------------------------------------------
 * In-memory storage that behaves like the Blob helpers, including the one
 * property everything hinges on: putJsonExclusive is atomic create-only.
 * ------------------------------------------------------------------------- */
function fakeStorage(opts) {
  const o = opts || {};
  const data = new Map();
  const counts = { get: 0, put: 0, putExclusive: 0, del: 0, list: 0 };
  let failReads = false;
  return {
    counts: counts,
    raw: data,
    setFailReads(v) {
      failReads = !!v;
    },
    async getJson(key) {
      counts.get++;
      if (failReads) throw new Error("network down");
      const hit = data.get(key);
      return hit === undefined ? null : JSON.parse(JSON.stringify(hit));
    },
    async putJson(key, value) {
      counts.put++;
      data.set(key, JSON.parse(JSON.stringify(value)));
      return { pathname: key };
    },
    async putJsonExclusive(key, value) {
      counts.putExclusive++;
      if (data.has(key)) {
        const err = new Error("already_exists");
        err.code = "already_exists";
        throw err;
      }
      data.set(key, JSON.parse(JSON.stringify(value)));
      return { pathname: key };
    },
    async deleteJson(key) {
      counts.del++;
      data.delete(key);
      return { pathname: key };
    },
    async listJson(prefix) {
      counts.list++;
      const out = [];
      for (const [pathname, value] of data) {
        if (pathname.indexOf(prefix) !== 0) continue;
        out.push({ pathname, data: JSON.parse(JSON.stringify(value)) });
      }
      return out;
    },
    ...(o.extra || {}),
  };
}

async function main() {
  /* --- shape --------------------------------------------------------------- */

  const skeleton = Store.emptyProgram({ clientName: "Coach A", weekCount: 5 });
  ok("skeleton has 5 weeks", skeleton.weeks.length === 5);
  ok("skeleton starts at version 1", skeleton.version === 1);
  ok("last week is a deload", skeleton.weeks[4].phase === "deload");
  ok(
    "every week has all seven days",
    skeleton.weeks.every(function (w) {
      return Store.DAY_KEYS.every(function (d) {
        return Array.isArray(w.days[d] && w.days[d].parts);
      });
    })
  );
  /* a.1.1 — we build the container, the owner writes the training. */
  ok(
    "skeleton ships with NO training content",
    skeleton.weeks.every(function (w) {
      return Store.DAY_KEYS.every(function (d) {
        return w.days[d].parts.length === 0;
      });
    })
  );
  ok("skeleton has no unread days", Object.keys(skeleton.unreadDays).length === 0);

  /* --- integrity ----------------------------------------------------------- */

  ok("valid skeleton passes", Store.validateProgram(skeleton) === null);
  ok("non-object is rejected", typeof Store.validateProgram("nope") === "string");
  ok("missing weeks is rejected", typeof Store.validateProgram({ programId: "p_1", version: 1 }) === "string");

  const missingDay = JSON.parse(JSON.stringify(skeleton));
  delete missingDay.weeks[2].days.wed;
  ok("a week missing a day is rejected", /missing day wed/.test(Store.validateProgram(missingDay)));

  const brokenParts = JSON.parse(JSON.stringify(skeleton));
  brokenParts.weeks[0].days.mon.parts = "not an array";
  ok("parts must stay an array", /no parts array/.test(Store.validateProgram(brokenParts)));

  const zeroVersion = JSON.parse(JSON.stringify(skeleton));
  zeroVersion.version = 0;
  ok("version must be positive", /version/.test(Store.validateProgram(zeroVersion)));

  /* --- index rows carry headlines only ------------------------------------- */

  const row = Store.indexRowFor(skeleton);
  ok("index row has the client name", row.clientName === "Coach A");
  ok("index row carries no weeks", row.weeks === undefined);
  ok("index row carries no days", JSON.stringify(row).indexOf('"parts"') < 0);

  /* --- create / read ------------------------------------------------------- */

  const io = fakeStorage();
  const store = Store.createProgramStore(io);

  const created = await store.createProgram({ clientName: "Coach A", weekCount: 5 });
  ok("program is created", created.ok === true);
  const pid = created.program.programId;
  ok("program id is usable", /^p_[a-z0-9]+$/.test(pid));

  const read1 = await store.readProgram(pid);
  ok("program reads back", read1.ok === true && read1.program.programId === pid);
  ok("read is not from cache when storage answers", read1.fromCache === false);

  const missing = await store.readProgram("p_doesnotexist");
  ok("a missing program is NOT_FOUND", missing.ok === false && missing.code === "NOT_FOUND");

  /* --- the owner writes content ------------------------------------------- */

  const wrote = await store.updateProgram(pid, 1, function (draft) {
    draft.weeks[0].days.mon.parts = [
      { id: "mon-0", title: "Part A", lines: ["Back squat 5x5"] },
    ];
    draft.weeks[0].theme = "Army prep — week 1";
    return draft;
  });
  ok("owner write is accepted", wrote.ok === true);
  ok("version moved 1 -> 2", wrote.program.version === 2);
  ok("content landed", wrote.program.weeks[0].days.mon.parts.length === 1);
  ok("owner write is attributed to owner", wrote.program.updatedBy === "owner");
  ok("owner write raises no unread flag", Object.keys(wrote.program.unreadDays).length === 0);

  /* --- TWO EDITORS AT ONCE (the whole point) ------------------------------ */

  /* Both load version 2. */
  const asOwner = await store.readProgram(pid);
  const asClient = await store.readProgram(pid);
  ok("both editors loaded the same version", asOwner.program.version === asClient.program.version);
  const loadedVersion = asOwner.program.version;

  /* The client saves first and wins. */
  const clientSave = await store.updateProgram(
    pid,
    loadedVersion,
    function (draft) {
      draft.weeks[0].days.mon.parts[0].lines = ["Front squat 5x5 — no barbell today"];
      return draft;
    },
    { actor: "client", touchedDays: ["w1:mon"] }
  );
  ok("first save wins", clientSave.ok === true && clientSave.program.version === loadedVersion + 1);
  ok("client edit is attributed to the client", clientSave.program.updatedBy === "client");
  ok("client edit raises the unread flag", clientSave.program.unreadDays["w1:mon"] !== undefined);

  /* The owner, still holding the stale version, must be REFUSED. */
  const ownerSave = await store.updateProgram(pid, loadedVersion, function (draft) {
    draft.weeks[0].days.mon.parts[0].lines = ["Back squat 5x5 @ 80%"];
    return draft;
  });
  ok("the later save is refused", ownerSave.ok === false);
  ok("refusal names the conflict", ownerSave.code === "VERSION_CONFLICT");
  ok("refusal reports both versions", ownerSave.expectedVersion === loadedVersion && ownerSave.currentVersion === loadedVersion + 1);
  ok("refusal hands back the live copy to merge from", !!ownerSave.program && ownerSave.program.version === loadedVersion + 1);

  /* And the client's work is intact — this is the failure we are preventing. */
  const afterConflict = await store.readProgram(pid);
  ok(
    "the client's edit SURVIVED the refused save",
    afterConflict.program.weeks[0].days.mon.parts[0].lines[0] === "Front squat 5x5 — no barbell today"
  );

  /* Re-reading and saving again succeeds. */
  const retry = await store.updateProgram(pid, afterConflict.program.version, function (draft) {
    draft.weeks[0].days.tue.parts = [{ id: "tue-0", title: "Part A", lines: ["Row 2k"] }];
    return draft;
  });
  ok("saving after a re-read succeeds", retry.ok === true);

  /* --- unread flag is state, not a counter -------------------------------- */

  let flagged = retry.program;
  for (let i = 0; i < 5; i++) {
    const r = await store.updateProgram(
      pid,
      flagged.version,
      function (draft) {
        draft.weeks[0].days.tue.parts[0].lines = ["Row 2k — attempt " + i];
        return draft;
      },
      { actor: "client", touchedDays: ["w1:tue"] }
    );
    ok("client save " + (i + 1) + " of 5 accepted", r.ok === true);
    flagged = r.program;
  }
  ok(
    "five saves to one day leave ONE flag",
    Object.keys(flagged.unreadDays).filter(function (k) {
      return k === "w1:tue";
    }).length === 1
  );
  ok("both touched days are flagged", flagged.unreadDays["w1:mon"] && flagged.unreadDays["w1:tue"]);

  const opened = await store.updateProgram(
    pid,
    flagged.version,
    function (draft) {
      return draft;
    },
    { clearUnread: ["w1:tue"] }
  );
  ok("opening a day clears its flag", opened.program.unreadDays["w1:tue"] === undefined);
  ok("other flags are untouched", opened.program.unreadDays["w1:mon"] !== undefined);

  /* --- a mutate that would corrupt the object is refused ------------------ */

  const corrupt = await store.updateProgram(pid, opened.program.version, function (draft) {
    draft.weeks[1].days.thu = "broken";
    return draft;
  });
  ok("a corrupting edit is refused", corrupt.ok === false && corrupt.code === "INVALID");
  const stillFine = await store.readProgram(pid);
  ok("the stored program is unharmed", Store.validateProgram(stillFine.program) === null);
  ok("a refused edit does not bump the version", stillFine.program.version === opened.program.version);

  /* --- the index ---------------------------------------------------------- */

  const idx = await store.readIndex();
  ok("index has one row", idx.ok === true && idx.index.rows.length === 1);
  ok("index row tracks the live version", idx.index.rows[0].version === stillFine.program.version);
  ok("index row counts unread days", idx.index.rows[0].unreadCount === 1);

  /* Drawing a list must not cost a full read per program. */
  const before = io.counts.get;
  await store.readIndex();
  ok("reading the whole list costs ONE fetch", io.counts.get - before === 1);

  /* Rebuild is the safety valve when the index drifts. */
  io.raw.set(Store.INDEX_KEY, { version: 1, updatedAt: "", rows: [] });
  const drifted = await store.readIndex();
  ok("index can drift empty", drifted.index.rows.length === 0);
  const rebuilt = await store.rebuildIndex();
  ok("rebuild recovers the row", rebuilt.ok === true && rebuilt.count === 1);
  ok("rebuild skips lock files", rebuilt.index.rows.every(function (r) { return !!r.programId; }));

  /* --- A REAL RACE: both saves fired at once, not one after the other ----- */

  const ioR = fakeStorage();
  const storeR = Store.createProgramStore(ioR);
  const cR = await storeR.createProgram({ clientName: "Race" });
  const pidR = cR.program.programId;
  const baseVersion = cR.program.version;

  const [raceA, raceB] = await Promise.all([
    storeR.updateProgram(pidR, baseVersion, function (draft) {
      draft.weeks[0].days.mon.parts = [{ id: "a", title: "OWNER", lines: ["owner wrote this"] }];
      return draft;
    }),
    storeR.updateProgram(
      pidR,
      baseVersion,
      function (draft) {
        draft.weeks[0].days.mon.parts = [{ id: "b", title: "CLIENT", lines: ["client wrote this"] }];
        return draft;
      },
      { actor: "client", touchedDays: ["w1:mon"] }
    ),
  ]);

  const winners = [raceA, raceB].filter(function (r) {
    return r.ok === true;
  });
  const losers = [raceA, raceB].filter(function (r) {
    return r.ok === false;
  });
  ok("in a dead heat exactly ONE save wins", winners.length === 1);
  ok("the other is refused, not silently dropped", losers.length === 1 && losers[0].code === "VERSION_CONFLICT");

  const raced = await storeR.readProgram(pidR);
  ok("version advanced exactly once", raced.program.version === baseVersion + 1);
  /* The decisive assertion: the surviving content belongs to the winner, whole —
     not a torn mix of both writes. */
  const survivingTitle = raced.program.weeks[0].days.mon.parts[0].title;
  ok(
    "the winner's content is stored whole (no torn write)",
    (survivingTitle === "OWNER" || survivingTitle === "CLIENT") &&
      raced.program.weeks[0].days.mon.parts.length === 1
  );
  ok(
    "the stored copy matches the winner exactly",
    JSON.stringify(raced.program.weeks[0].days.mon) ===
      JSON.stringify(winners[0].program.weeks[0].days.mon)
  );
  ok("no lock is left behind after a race", ioR.raw.has(Store.lockKey(pidR)) === false);

  /* Ten at once — the lock must not deadlock or let versions collide. */
  const ioR2 = fakeStorage();
  const storeR2 = Store.createProgramStore(ioR2);
  const cR2 = await storeR2.createProgram({ clientName: "Stampede" });
  const pidR2 = cR2.program.programId;
  const stampede = await Promise.all(
    Array.from({ length: 10 }, function (_, i) {
      return storeR2.updateProgram(pidR2, cR2.program.version, function (draft) {
        draft.weeks[0].theme = "writer " + i;
        return draft;
      });
    })
  );
  const okCount = stampede.filter(function (r) {
    return r.ok;
  }).length;
  ok("ten simultaneous saves on one stale version: exactly one wins", okCount === 1);
  ok(
    "the nine others are all version conflicts",
    stampede.filter(function (r) {
      return !r.ok && r.code === "VERSION_CONFLICT";
    }).length === 9
  );
  const afterStampede = await storeR2.readProgram(pidR2);
  ok("version advanced exactly once, not ten times", afterStampede.program.version === cR2.program.version + 1);
  ok("no lock survives the stampede", ioR2.raw.has(Store.lockKey(pidR2)) === false);

  /* --- a crashed save must not wedge the program forever ------------------ */

  let fakeNow = 1_000_000;
  const io2 = fakeStorage();
  const store2 = Store.createProgramStore(Object.assign({}, io2, { now: function () { return fakeNow; } }));
  const c2 = await store2.createProgram({ clientName: "Coach B" });
  const pid2 = c2.program.programId;
  /* Simulate a lock left behind by a save that died mid-flight. */
  io2.raw.set(Store.lockKey(pid2), { at: fakeNow });
  fakeNow += Store.LOCK_TTL_MS + 1000;
  const afterStale = await store2.updateProgram(pid2, c2.program.version, function (draft) {
    draft.clientName = "Coach B — recovered";
    return draft;
  });
  ok("an abandoned lock is broken after its TTL", afterStale.ok === true);
  ok("the write landed after recovery", afterStale.program.clientName === "Coach B — recovered");
  ok("the lock is released afterwards", io2.raw.has(Store.lockKey(pid2)) === false);

  /* --- no network: last-known copy, and never a fake 404 ----------------- */

  const io3 = fakeStorage();
  const store3 = Store.createProgramStore(io3);
  const c3 = await store3.createProgram({ clientName: "Coach C" });
  const pid3 = c3.program.programId;
  await store3.readProgram(pid3);
  io3.setFailReads(true);
  const offline = await store3.readProgram(pid3);
  ok("a read failure serves the last known copy", offline.ok === true && offline.fromCache === true);
  ok("the cached copy is the real program", offline.program.programId === pid3);
  ok("the read error is still reported", /network down/.test(offline.readError || ""));

  const offlineNoCache = await store3.readProgram(pid3, { allowCache: false });
  ok("cache can be refused explicitly", offlineNoCache.ok === false && offlineNoCache.code === "READ_FAILED");

  /* A save must never trust the cache — it re-reads for real. */
  const saveOffline = await store3.updateProgram(pid3, c3.program.version, function (d) {
    return d;
  });
  ok("a save during a read failure is refused, not guessed", saveOffline.ok === false);

  /* --- delete ------------------------------------------------------------- */

  io3.setFailReads(false);
  const del = await store3.deleteProgram(pid3);
  ok("program deletes", del.ok === true);
  const goneIdx = await store3.readIndex();
  ok("delete removes the index row", goneIdx.index.rows.length === 0);

  /* --- this module never talks to a provider ----------------------------- */

  /* ---------------------------------------------------------------------
   * A month at a time, and the deload cadence survives the month boundary.
   *
   * The product is sold BY THE MONTH and a month is four weeks. A deload set to
   * "week 5" therefore does NOT stretch this month to five weeks — month two OPENS
   * on the deload (owner, 2026-09-01). That only works if the week numbering keeps
   * running across months, which is what these assertions pin.
   * ------------------------------------------------------------------------- */
  const ioM = fakeStorage();
  const storeM = Store.createProgramStore(ioM);
  const intakeM = {
    clientName: "Studio", scheduleMode: "session_count", sessionsPerWeek: 4,
    deloadWeek: true, deloadEveryWeeks: 5, population: "p", goals: "g",
  };
  const m1 = await storeM.createProgram({ clientName: "Studio", weekCount: 4, intake: intakeM });
  ok("a month is created four weeks long", m1.ok && m1.program.weeks.length === 4);
  ok(
    "month one is all build — the deload has not come round yet",
    m1.program.weeks.every(function (w) { return w.phase === "build"; })
  );
  /* This is the bug the cadence replaced: the old rule tagged the LAST week of the
     block as a deload, so a four-week month with no deload asked for still got one. */
  ok("the last week of the month is not a deload by default", m1.program.weeks[3].phase === "build");

  const m2 = await storeM.addMonth(m1.program.programId, m1.program.version);
  ok("another month can be added", m2.ok && m2.added === 4);
  ok("the program is now eight weeks", m2.program.weeks.length === 8);
  ok(
    "the numbering keeps running rather than restarting",
    m2.program.weeks.map(function (w) { return w.weekIndex; }).join(",") === "1,2,3,4,5,6,7,8"
  );
  ok("month two OPENS on the deload", m2.program.weeks[4].phase === "deload");
  ok("and the rest of it builds", m2.program.weeks.slice(5).every(function (w) { return w.phase === "build"; }));
  ok("the new weeks are empty — the owner writes them", m2.program.weeks[4].days.sun.parts.length === 0);
  ok("adding a month bumps the version like any other write", m2.program.version === m1.program.version + 1);

  const stale = await storeM.addMonth(m1.program.programId, m1.program.version);
  ok("a stale add is refused, not applied twice", !stale.ok && stale.code === "VERSION_CONFLICT");

  /* Without an intake — the legacy athlete path — the old rule still stands, so that
     path keeps behaving exactly as it did. */
  const legacy = Store.emptyProgram({ programId: "p_legacy", weekCount: 5 });
  ok("the legacy path still closes its block with a deload", legacy.weeks[4].phase === "deload");

  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "lib", "client-program-store.js"), "utf8");
  ok("store makes no network calls", !/\bfetch\s*\(/.test(src));
  ok("store references no AI provider", !/gemini|groq|generativelanguage/i.test(src.replace(/never calls a provider/gi, "")));

  console.log("All client program store checks passed.");
}

main().catch(function (e) {
  console.error("FAIL:", (e && e.message) || e);
  process.exit(1);
});
