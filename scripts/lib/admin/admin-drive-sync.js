/**
 * Admin Drive / coach-brain sync
 * POST /api/admin-drive-sync
 *   { adminPassword } — runs scripts/lib/coach-brain-sync (manual File Search push)
 *
 * Same effect as: npm run coach:sync-brain
 * Requires GEMINI_API_KEY + GEMINI_FILE_SEARCH_STORE and a readable knowledge dir
 * (COACH_KNOWLEDGE_DIR or experiments/personal-coach/knowledge-inbox).
 */

const { checkRateLimit, sendRateLimit } = require("../../../api/rate-limit");
const { runCoachBrainSync, readLastSync } = require("../coach-brain-sync");
const {
  resolveAdminPassword,
  checkAdminAuth: sharedCheckAdminAuth,
} = require("./admin-auth");

const ADMIN_PASSWORD = resolveAdminPassword();

function checkAdminAuth(req) {
  return sharedCheckAdminAuth(req, ADMIN_PASSWORD);
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Admin-Password, X-Admin-Token"
  );
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    if (!checkAdminAuth(req)) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    return res.status(200).json({ ok: true, lastSync: readLastSync() });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rl = checkRateLimit(req, { name: "admin-drive-sync", limit: 4, windowMs: 60_000 });
  if (!rl.ok) return sendRateLimit(res, rl);

  if (!checkAdminAuth(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  try {
    const result = await runCoachBrainSync({});
    return res.status(200).json({
      ok: !!result.ok,
      result: result,
      lastSync: readLastSync(),
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "sync_failed",
      message: String(e.message || e),
    });
  }
};
