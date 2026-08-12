/**
 * Stage A ownership unit tests — no network.
 */
const {
  hashWriteKey,
  assertSnapshotWriteAllowed,
  makeWriteKey,
  normalizeWriteKey,
} = require("./admin-ownership");

function assert(cond, label) {
  if (!cond) throw new Error("FAIL " + label);
}

function run() {
  const k = makeWriteKey();
  assert(normalizeWriteKey(k).length >= 16, "makeWriteKey");
  const h = hashWriteKey(k);
  assert(h.length === 64, "hash length");

  const denyNoKey = assertSnapshotWriteAllowed({}, "", false);
  assert(denyNoKey.ok === false && denyNoKey.status === 401, "no key denied");

  const create = assertSnapshotWriteAllowed({}, k, false);
  assert(create.ok === true && create.bindHash === h, "create binds");

  const seeded = { athleteId: "u_x", createdAt: "t", seeded: true };
  const lockSeed = assertSnapshotWriteAllowed(seeded, k, false);
  assert(lockSeed.ok === false && lockSeed.error === "snapshot_locked", "seed locked");

  const reclaimSeed = assertSnapshotWriteAllowed(seeded, k, false, { allowUnboundBind: true });
  assert(
    reclaimSeed.ok === true && reclaimSeed.bindHash === h && reclaimSeed.reclaimed === true,
    "seed reclaim bind"
  );

  const bound = { athleteId: "u_x", createdAt: "t", writeKeyHash: h };
  const ok = assertSnapshotWriteAllowed(bound, k, false);
  assert(ok.ok === true, "owner update ok");

  const bad = assertSnapshotWriteAllowed(bound, makeWriteKey(), false);
  assert(bad.ok === false && bad.error === "write_key_mismatch", "mismatch denied");

  const mismatchReclaim = assertSnapshotWriteAllowed(bound, makeWriteKey(), false, {
    allowUnboundBind: true,
  });
  assert(
    mismatchReclaim.ok === false && mismatchReclaim.error === "write_key_mismatch",
    "reclaim does not steal bound key"
  );

  const admin = assertSnapshotWriteAllowed(bound, "", true);
  assert(admin.ok === true, "admin bypass");

  console.log("admin-ownership test passed");
}

run();
