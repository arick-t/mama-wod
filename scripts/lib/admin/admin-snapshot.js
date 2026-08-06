/**
 * Admin Snapshot API
 * POST /api/admin-snapshot — athlete saves intake+block snapshot (called from index.html)
 * GET  /api/admin-snapshot — admin reads all snapshots (requires ADMIN_PASSWORD)
 * DELETE /api/admin-snapshot?id=athleteId — admin deletes a snapshot
 *
 * Storage: data/admin-snapshots/ (one JSON file per athlete, keyed by userId)
 * On Vercel: use this only for read (files not writable in prod without blob storage).
 * For prod persistence add ADMIN_BLOB_URL or migrate to Vercel KV / Blob later.
 */

const fs = require("fs");
const path = require("path");
const { checkRateLimit, sendRateLimit } = require("../../../api/rate-limit");
const {
  resolveAdminPassword,
  checkAdminAuth: sharedCheckAdminAuth,
  adminAuthDenied,
} = require("./admin-auth");
const { adminSnapshotsDir } = require("./admin-paths");
const { applyCors } = require("../../../lib/cors-allowlist");

const SNAPSHOTS_DIR = adminSnapshotsDir();
const MAX_SNAPSHOT_BYTES = 64 * 1024; // 64 KB per athlete
const ADMIN_PASSWORD = resolveAdminPassword();

function ensureDir() {
  try {
    if (!fs.existsSync(SNAPSHOTS_DIR)) {
      fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
    }
  } catch (e) {
    /* Vercel cold start / read-only edge — list returns empty */
  }
}

function safeAthleteId(raw) {
  return String(raw || "")
    .replace(/[^a-zA-Z0-9_\-]/g, "")
    .slice(0, 80);
}

function safeCount(raw, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function readSnapshot(athleteId) {
  const file = path.join(SNAPSHOTS_DIR, athleteId + ".json");
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeSnapshot(athleteId, data) {
  ensureDir();
  const file = path.join(SNAPSHOTS_DIR, athleteId + ".json");
  const str = JSON.stringify(data);
  if (str.length > MAX_SNAPSHOT_BYTES) throw new Error("Snapshot too large");
  fs.writeFileSync(file, str, "utf8");
}

function listSnapshots() {
  try {
    ensureDir();
    if (!fs.existsSync(SNAPSHOTS_DIR)) return [];
    const files = fs.readdirSync(SNAPSHOTS_DIR).filter((f) => f.endsWith(".json"));
    return files
      .map((f) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(SNAPSHOTS_DIR, f), "utf8"));
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  } catch (e) {
    return [];
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

    const existing = athleteId ? readSnapshot(athleteId) || {} : {};
    const isAdmin = checkAdminAuth(req);

    // Admin-only: list athletes via POST (avoids proxies that strip custom GET headers)
    if (body.action === "admin_list" || body.list === true) {
      if (!isAdmin) return adminAuthDenied(res);
      const rl = checkRateLimit(req, { name: "admin-snap-get", limit: 60, windowMs: 60_000 });
      if (!rl.ok) return sendRateLimit(res, rl);
      return res.status(200).json({ ok: true, snapshots: listSnapshots() });
    }

    // Admin-only: update coach directives (and optionally leave other fields intact)
    if (body.coachDirectives !== undefined && Object.keys(body).filter(function (k) {
      return body[k] !== undefined && k !== "athleteId" && k !== "userId" && k !== "coachDirectives" && k !== "adminPassword" && k !== "password";
    }).length === 0) {
      if (!isAdmin) return adminAuthDenied(res);
      if (!existing.athleteId && !existing.createdAt) {
        return res.status(404).json({ error: "Athlete not found — wait for first snapshot" });
      }
      existing.coachDirectives = String(body.coachDirectives || "").slice(0, 1000);
      existing.updatedAt = new Date().toISOString();
      try {
        writeSnapshot(athleteId, existing);
      } catch (e) {
        return res.status(500).json({ error: "Could not save directives", detail: String(e.message) });
      }
      return res.status(200).json({ ok: true });
    }

    // Athlete snapshot push — never accept coachDirectives from the client
    const snapshot = {
      athleteId,
      displayName: String(body.displayName || existing.displayName || "").slice(0, 80),
      email: String(body.email || existing.email || "").slice(0, 120),
      gender: String(body.gender || existing.gender || "").slice(0, 20),
      preferredLanguage: String(body.preferredLanguage || existing.preferredLanguage || "").slice(0, 10),
      skillsSummary: String(body.skillsSummary || existing.skillsSummary || "").slice(0, 400),
      intakeSummary: String(body.intakeSummary || existing.intakeSummary || "").slice(0, 800),
      coachDirectives: String(existing.coachDirectives || "").slice(0, 1000),
      joinedAt: String(body.joinedAt || existing.joinedAt || existing.createdAt || new Date().toISOString()).slice(0, 40),
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
      updatedAt: new Date().toISOString(),
      createdAt: existing.createdAt || new Date().toISOString(),
    };

    try {
      writeSnapshot(athleteId, snapshot);
    } catch (e) {
      return res.status(500).json({ error: "Could not save snapshot", detail: String(e.message) });
    }
    return res.status(200).json({ ok: true });
  }

  // ── GET: admin reads all snapshots ─────────────────────────────────────────
  if (req.method === "GET") {
    if (!checkAdminAuth(req)) {
      return adminAuthDenied(res);
    }
    const rl = checkRateLimit(req, { name: "admin-snap-get", limit: 60, windowMs: 60_000 });
    if (!rl.ok) return sendRateLimit(res, rl);

    const snapshots = listSnapshots();
    return res.status(200).json({ ok: true, snapshots });
  }

  // ── DELETE: admin removes a snapshot ───────────────────────────────────────
  if (req.method === "DELETE") {
    if (!checkAdminAuth(req)) {
      return adminAuthDenied(res);
    }
    const athleteId = safeAthleteId(req.query && req.query.id);
    if (!athleteId) return res.status(400).json({ error: "id required" });
    const file = path.join(SNAPSHOTS_DIR, athleteId + ".json");
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
};

function getCoachDirectives(athleteId) {
  const id = safeAthleteId(athleteId);
  if (!id) return "";
  const snap = readSnapshot(id);
  if (!snap || !snap.coachDirectives) return "";
  return String(snap.coachDirectives).slice(0, 1000);
}

module.exports.getCoachDirectives = getCoachDirectives;
module.exports.readSnapshot = readSnapshot;
module.exports.safeAthleteId = safeAthleteId;
