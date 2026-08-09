/**
 * Admin Snapshot API
 * POST /api/admin-snapshot — athlete saves intake+block snapshot (called from index.html)
 * GET  /api/admin-snapshot — admin reads all snapshots (requires ADMIN_PASSWORD)
 * DELETE /api/admin-snapshot?id=athleteId — admin deletes a snapshot
 *
 * Storage: private Vercel Blob (admin-snapshots/*.json) with FS fallback for local/dev.
 * Stage A: device writeKey ownership; fail-closed without Blob on Vercel.
 */

const path = require("path");
const fs = require("fs");
const { checkRateLimit, sendRateLimit } = require("../../../lib/rate-limit");
const {
  resolveAdminPassword,
  checkAdminAuth: sharedCheckAdminAuth,
  adminAuthDenied,
} = require("./admin-auth");
const {
  putJson,
  getJson,
  listJson,
  deleteJson,
  storageInfo,
  assertDurableStorage,
} = require("./admin-json-store");
const { assertSnapshotWriteAllowed, hashWriteKey } = require("./admin-ownership");
const { appendAdminAudit } = require("./admin-audit");
const { applyCors } = require("../../../lib/cors-allowlist");

const MAX_SNAPSHOT_BYTES = 64 * 1024;
const ADMIN_PASSWORD = resolveAdminPassword();
const SNAP_PREFIX = "admin-snapshots/";

const CLIENT_ALLOWED_KEYS = new Set([
  "athleteId",
  "userId",
  "writeKey",
  "displayName",
  "gender",
  "preferredLanguage",
  "skillsSummary",
  "intakeSummary",
  "joinedAt",
  "workoutAdjustmentsCount",
  "coachDebriefsCount",
  "currentBlock",
  "pastBlocks",
  "coachTier",
]);

function safeAthleteId(raw) {
  return String(raw || "")
    .replace(/[^a-zA-Z0-9_\-]/g, "")
    .slice(0, 80);
}

function snapKey(athleteId) {
  return SNAP_PREFIX + athleteId + ".json";
}

function safeCount(raw, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function storageUnavailable(res, e) {
  const code = e && e.code === "blob_required" ? 503 : 500;
  return res.status(code).json({
    ok: false,
    error: (e && e.code) || "storage_error",
    message:
      (e && e.message) ||
      "שמירה לא זמינה כרגע. אם זה נמשך — בדקו הגדרת Blob ב־Vercel.",
  });
}

async function readSnapshot(athleteId) {
  const id = safeAthleteId(athleteId);
  if (!id) return null;
  return getJson(snapKey(id));
}

async function writeSnapshot(athleteId, data) {
  const id = safeAthleteId(athleteId);
  if (!id) throw new Error("athleteId required");
  const str = JSON.stringify(data);
  if (str.length > MAX_SNAPSHOT_BYTES) throw new Error("Snapshot too large");
  await putJson(snapKey(id), data);
}

function publicSnapshot(row) {
  if (!row || typeof row !== "object") return row;
  const out = Object.assign({}, row);
  delete out.writeKeyHash;
  delete out.writeKey;
  return out;
}

async function listSnapshots() {
  try {
    await ensureSeedAthletes();
    const rows = await listJson(SNAP_PREFIX);
    return rows
      .map((r) => publicSnapshot(r.data))
      .filter(Boolean)
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  } catch (e) {
    if (e && e.code === "blob_required") throw e;
    return [];
  }
}

function loadCoachMemberSeed() {
  try {
    const p = path.join(__dirname, "..", "..", "..", "data", "analytics-coach-members.json");
    if (!fs.existsSync(p)) return {};
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch (e) {
    return {};
  }
}

async function ensureSeedAthletes() {
  const seed = loadCoachMemberSeed();
  const ids = Object.keys(seed || {});
  for (let i = 0; i < ids.length; i++) {
    const uid = safeAthleteId(ids[i]);
    if (!uid) continue;
    const existing = await readSnapshot(uid);
    if (existing && existing.athleteId) continue;
    const row = seed[ids[i]] || {};
    const now = new Date().toISOString();
    await writeSnapshot(uid, {
      athleteId: uid,
      displayName: String(row.displayName || uid).slice(0, 80),
      email: "",
      gender: "",
      preferredLanguage: "he",
      skillsSummary: "",
      intakeSummary: "Seeded coach member (tier 2)",
      coachDirectives: "",
      joinedAt: now,
      workoutAdjustmentsCount: 0,
      coachDebriefsCount: 0,
      currentBlock: null,
      pastBlocks: [],
      coachTier: 2,
      seeded: true,
      writeKeyHash: null,
      clientWritesLocked: true,
      updatedAt: now,
      createdAt: now,
    });
  }
}

function checkAdminAuth(req) {
  return sharedCheckAdminAuth(req, ADMIN_PASSWORD);
}

function stripUnknownClientFields(body) {
  const out = {};
  Object.keys(body || {}).forEach((k) => {
    if (CLIENT_ALLOWED_KEYS.has(k)) out[k] = body[k];
  });
  return out;
}

module.exports = async function handler(req, res) {
  applyCors(req, res, {
    methods: "GET,POST,DELETE,OPTIONS",
    headers: "Content-Type, X-Admin-Password, X-Admin-Token, X-Athlete-Id, X-Write-Key",
  });
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    assertDurableStorage();
  } catch (e) {
    return storageUnavailable(res, e);
  }

  if (req.method === "POST") {
    const rl = checkRateLimit(req, { name: "admin-snap-post", limit: 20, windowMs: 60_000 });
    if (!rl.ok) return sendRateLimit(res, rl);

    let body;
    try {
      body = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }
    req.body = body;
    const isAdmin = checkAdminAuth(req);

    const athleteId = safeAthleteId(body.athleteId || body.userId);
    if (!athleteId && !(body.action === "admin_list" || body.list === true)) {
      return res.status(400).json({ error: "athleteId required" });
    }

    if (body.action === "admin_list" || body.list === true) {
      if (!isAdmin) return adminAuthDenied(res);
      const rlList = checkRateLimit(req, { name: "admin-snap-get", limit: 60, windowMs: 60_000 });
      if (!rlList.ok) return sendRateLimit(res, rlList);
      try {
        const snapshots = await listSnapshots();
        return res.status(200).json({ ok: true, snapshots, storage: storageInfo() });
      } catch (e) {
        return storageUnavailable(res, e);
      }
    }

    if (body.action === "admin_member_status") {
      if (!isAdmin) return adminAuthDenied(res);
      const existing = (await readSnapshot(athleteId)) || {};
      if (!existing.athleteId && !existing.createdAt) {
        return res.status(404).json({ error: "Athlete not found — wait for first snapshot" });
      }
      if (body.membershipFrozen !== undefined) {
        existing.membershipFrozen = !!body.membershipFrozen;
      }
      if (body.declarationAcceptedAt !== undefined) {
        existing.declarationAcceptedAt = String(body.declarationAcceptedAt || "").slice(0, 40);
      }
      existing.updatedAt = new Date().toISOString();
      try {
        await writeSnapshot(athleteId, existing);
        await appendAdminAudit({
          action: "set_member_status",
          athleteId: athleteId,
          actor: "admin",
          ok: true,
          detail: existing.membershipFrozen ? "frozen" : "active",
        });
      } catch (e) {
        return storageUnavailable(res, e);
      }
      return res.status(200).json({
        ok: true,
        membershipFrozen: !!existing.membershipFrozen,
        declarationAcceptedAt: existing.declarationAcceptedAt || null,
        storage: storageInfo(),
      });
    }

    if (
      body.coachDirectives !== undefined &&
      Object.keys(body).filter(function (k) {
        return (
          body[k] !== undefined &&
          k !== "athleteId" &&
          k !== "userId" &&
          k !== "coachDirectives" &&
          k !== "adminPassword" &&
          k !== "password" &&
          k !== "writeKey"
        );
      }).length === 0
    ) {
      if (!isAdmin) return adminAuthDenied(res);
      const existing = (await readSnapshot(athleteId)) || {};
      if (!existing.athleteId && !existing.createdAt) {
        return res.status(404).json({ error: "Athlete not found — wait for first snapshot" });
      }
      existing.coachDirectives = String(body.coachDirectives || "").slice(0, 1000);
      existing.updatedAt = new Date().toISOString();
      try {
        await writeSnapshot(athleteId, existing);
        await appendAdminAudit({
          action: "set_directives",
          athleteId: athleteId,
          actor: "admin",
          ok: true,
        });
      } catch (e) {
        return storageUnavailable(res, e);
      }
      return res.status(200).json({ ok: true, storage: storageInfo() });
    }

    const existing = (await readSnapshot(athleteId)) || {};
    const writeKey =
      body.writeKey ||
      (req.headers && (req.headers["x-write-key"] || req.headers["X-Write-Key"])) ||
      "";
    const gate = assertSnapshotWriteAllowed(existing, writeKey, isAdmin);
    if (!gate.ok) {
      await appendAdminAudit({
        action: "snapshot_denied",
        athleteId: athleteId,
        actor: isAdmin ? "admin" : "client",
        ok: false,
        detail: gate.error,
      });
      return res.status(gate.status).json({
        ok: false,
        error: gate.error,
        message: gate.message,
      });
    }

    const clean = isAdmin ? body : stripUnknownClientFields(body);

    const snapshot = {
      athleteId,
      displayName: String(clean.displayName || existing.displayName || "").slice(0, 80),
      email: String((isAdmin ? clean.email : existing.email) || existing.email || "").slice(0, 120),
      gender: String(clean.gender || existing.gender || "").slice(0, 20),
      preferredLanguage: String(
        clean.preferredLanguage || existing.preferredLanguage || ""
      ).slice(0, 10),
      skillsSummary: String(clean.skillsSummary || existing.skillsSummary || "").slice(0, 400),
      intakeSummary: String(clean.intakeSummary || existing.intakeSummary || "").slice(0, 800),
      coachDirectives: String(existing.coachDirectives || "").slice(0, 1000),
      joinedAt: String(
        clean.joinedAt || existing.joinedAt || existing.createdAt || new Date().toISOString()
      ).slice(0, 40),
      workoutAdjustmentsCount: safeCount(
        clean.workoutAdjustmentsCount,
        safeCount(existing.workoutAdjustmentsCount, 0)
      ),
      coachDebriefsCount: safeCount(
        clean.coachDebriefsCount,
        safeCount(existing.coachDebriefsCount, 0)
      ),
      currentBlock: clean.currentBlock || existing.currentBlock || null,
      pastBlocks: clean.pastBlocks || existing.pastBlocks || [],
      coachTier: existing.coachTier || clean.coachTier || 2,
      membershipFrozen:
        isAdmin && clean.membershipFrozen !== undefined
          ? !!clean.membershipFrozen
          : !!existing.membershipFrozen,
      declarationAcceptedAt: String(
        (isAdmin && clean.declarationAcceptedAt) ||
          existing.declarationAcceptedAt ||
          existing.joinedAt ||
          existing.createdAt ||
          ""
      ).slice(0, 40),
      writeKeyHash:
        existing.writeKeyHash ||
        gate.bindHash ||
        (isAdmin && clean.writeKey ? hashWriteKey(clean.writeKey) : null) ||
        null,
      seeded: !!existing.seeded && !gate.bindHash,
      clientWritesLocked: false,
      updatedAt: new Date().toISOString(),
      createdAt: existing.createdAt || new Date().toISOString(),
    };
    if (isAdmin && clean.createdByAdmin) snapshot.createdByAdmin = true;

    try {
      await writeSnapshot(athleteId, snapshot);
      await appendAdminAudit({
        action: existing.athleteId ? "snapshot_update" : "snapshot_create",
        athleteId: athleteId,
        actor: isAdmin ? "admin" : "client",
        ok: true,
      });
    } catch (e) {
      return storageUnavailable(res, e);
    }
    return res.status(200).json({ ok: true, storage: storageInfo() });
  }

  if (req.method === "GET") {
    if (!checkAdminAuth(req)) {
      return adminAuthDenied(res);
    }
    const rl = checkRateLimit(req, { name: "admin-snap-get", limit: 60, windowMs: 60_000 });
    if (!rl.ok) return sendRateLimit(res, rl);
    try {
      const snapshots = await listSnapshots();
      return res.status(200).json({ ok: true, snapshots, storage: storageInfo() });
    } catch (e) {
      return storageUnavailable(res, e);
    }
  }

  if (req.method === "DELETE") {
    if (!checkAdminAuth(req)) {
      return adminAuthDenied(res);
    }
    const athleteId = safeAthleteId(req.query && req.query.id);
    if (!athleteId) return res.status(400).json({ error: "id required" });
    await deleteJson(snapKey(athleteId));
    await appendAdminAudit({
      action: "snapshot_delete",
      athleteId: athleteId,
      actor: "admin",
      ok: true,
    });
    return res.status(200).json({ ok: true, storage: storageInfo() });
  }

  return res.status(405).json({ error: "Method not allowed" });
};

async function getCoachDirectives(athleteId) {
  const id = safeAthleteId(athleteId);
  if (!id) return "";
  const snap = await readSnapshot(id);
  if (!snap || !snap.coachDirectives) return "";
  return String(snap.coachDirectives).slice(0, 1000);
}

module.exports.getCoachDirectives = getCoachDirectives;
module.exports.readSnapshot = readSnapshot;
module.exports.writeSnapshot = writeSnapshot;
module.exports.listSnapshots = listSnapshots;
module.exports.safeAthleteId = safeAthleteId;
module.exports.hashWriteKey = hashWriteKey;
