/**
 * Admin Snapshot API
 * POST /api/admin-snapshot — athlete saves intake+block snapshot (called from index.html)
 * GET  /api/admin-snapshot — admin reads all snapshots (requires ADMIN_PASSWORD)
 * DELETE /api/admin-snapshot?id=athleteId — admin deletes a snapshot
 *
 * Storage: private Vercel Blob (admin-snapshots/*.json) with FS fallback for local/dev.
 */

const path = require("path");
const fs = require("fs");
const { checkRateLimit, sendRateLimit } = require("../../../lib/rate-limit");
const {
  resolveAdminPassword,
  checkAdminAuth: sharedCheckAdminAuth,
  adminAuthDenied,
} = require("./admin-auth");
const { putJson, getJson, listJson, deleteJson, storageInfo } = require("./admin-json-store");
const { applyCors } = require("../../../lib/cors-allowlist");

const MAX_SNAPSHOT_BYTES = 64 * 1024; // 64 KB per athlete
const ADMIN_PASSWORD = resolveAdminPassword();
const SNAP_PREFIX = "admin-snapshots/";

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

async function listSnapshots() {
  try {
    await ensureSeedAthletes();
    const rows = await listJson(SNAP_PREFIX);
    return rows
      .map((r) => r.data)
      .filter(Boolean)
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  } catch (e) {
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
      updatedAt: now,
      createdAt: now,
    });
  }
}

function checkAdminAuth(req) {
  return sharedCheckAdminAuth(req, ADMIN_PASSWORD);
}

module.exports = async function handler(req, res) {
  applyCors(req, res, {
    methods: "GET,POST,DELETE,OPTIONS",
    headers: "Content-Type, X-Admin-Password, X-Admin-Token, X-Athlete-Id",
  });
  if (req.method === "OPTIONS") return res.status(204).end();

  // ── POST: athlete pushes snapshot ──────────────────────────────────────────
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

    const athleteId = safeAthleteId(body.athleteId || body.userId);
    if (!athleteId && !(body.action === "admin_list" || body.list === true)) {
      return res.status(400).json({ error: "athleteId required" });
    }

    const existing = athleteId ? (await readSnapshot(athleteId)) || {} : {};
    const isAdmin = checkAdminAuth(req);

    // Admin-only: list athletes via POST (avoids proxies that strip custom GET headers)
    if (body.action === "admin_list" || body.list === true) {
      if (!isAdmin) return adminAuthDenied(res);
      const rlList = checkRateLimit(req, { name: "admin-snap-get", limit: 60, windowMs: 60_000 });
      if (!rlList.ok) return sendRateLimit(res, rlList);
      const snapshots = await listSnapshots();
      return res.status(200).json({ ok: true, snapshots, storage: storageInfo() });
    }

    // Admin-only: update coach directives (and optionally leave other fields intact)
    if (
      body.coachDirectives !== undefined &&
      Object.keys(body).filter(function (k) {
        return (
          body[k] !== undefined &&
          k !== "athleteId" &&
          k !== "userId" &&
          k !== "coachDirectives" &&
          k !== "adminPassword" &&
          k !== "password"
        );
      }).length === 0
    ) {
      if (!isAdmin) return adminAuthDenied(res);
      if (!existing.athleteId && !existing.createdAt) {
        return res.status(404).json({ error: "Athlete not found — wait for first snapshot" });
      }
      existing.coachDirectives = String(body.coachDirectives || "").slice(0, 1000);
      existing.updatedAt = new Date().toISOString();
      try {
        await writeSnapshot(athleteId, existing);
      } catch (e) {
        return res.status(500).json({
          error: "לא הצלחנו לשמור את ההנחיות",
          detail: String(e.message),
        });
      }
      return res.status(200).json({ ok: true, storage: storageInfo() });
    }

    // Athlete snapshot push — never accept coachDirectives from the client
    const snapshot = {
      athleteId,
      displayName: String(body.displayName || existing.displayName || "").slice(0, 80),
      email: String(body.email || existing.email || "").slice(0, 120),
      gender: String(body.gender || existing.gender || "").slice(0, 20),
      preferredLanguage: String(body.preferredLanguage || existing.preferredLanguage || "").slice(
        0,
        10
      ),
      skillsSummary: String(body.skillsSummary || existing.skillsSummary || "").slice(0, 400),
      intakeSummary: String(body.intakeSummary || existing.intakeSummary || "").slice(0, 800),
      coachDirectives: String(existing.coachDirectives || "").slice(0, 1000),
      joinedAt: String(
        body.joinedAt || existing.joinedAt || existing.createdAt || new Date().toISOString()
      ).slice(0, 40),
      workoutAdjustmentsCount: safeCount(
        body.workoutAdjustmentsCount,
        safeCount(existing.workoutAdjustmentsCount, 0)
      ),
      coachDebriefsCount: safeCount(
        body.coachDebriefsCount,
        safeCount(existing.coachDebriefsCount, 0)
      ),
      currentBlock: body.currentBlock || existing.currentBlock || null,
      pastBlocks: body.pastBlocks || existing.pastBlocks || [],
      coachTier: existing.coachTier || body.coachTier || 2,
      updatedAt: new Date().toISOString(),
      createdAt: existing.createdAt || new Date().toISOString(),
    };

    try {
      await writeSnapshot(athleteId, snapshot);
    } catch (e) {
      return res.status(500).json({
        error: "לא הצלחנו לשמור את המתאמן",
        detail: String(e.message),
      });
    }
    return res.status(200).json({ ok: true, storage: storageInfo() });
  }

  // ── GET: admin reads all snapshots ─────────────────────────────────────────
  if (req.method === "GET") {
    if (!checkAdminAuth(req)) {
      return adminAuthDenied(res);
    }
    const rl = checkRateLimit(req, { name: "admin-snap-get", limit: 60, windowMs: 60_000 });
    if (!rl.ok) return sendRateLimit(res, rl);

    const snapshots = await listSnapshots();
    return res.status(200).json({ ok: true, snapshots, storage: storageInfo() });
  }

  // ── DELETE: admin removes a snapshot ───────────────────────────────────────
  if (req.method === "DELETE") {
    if (!checkAdminAuth(req)) {
      return adminAuthDenied(res);
    }
    const athleteId = safeAthleteId(req.query && req.query.id);
    if (!athleteId) return res.status(400).json({ error: "id required" });
    await deleteJson(snapKey(athleteId));
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
