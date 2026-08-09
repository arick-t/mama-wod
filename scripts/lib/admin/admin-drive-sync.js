/**
 * Admin Drive / coach-brain sync (L3 File Search only)
 * POST /api/admin-drive-sync
 *   { adminPassword } — pulls Drive (when configured) → Gemini File Search
 *
 * Same effect as: npm run coach:sync-brain
 * Requires GEMINI_API_KEY + GEMINI_FILE_SEARCH_STORE
 * Prefer: GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON (or OAuth refresh) + shared Drive folder
 * Fallback: COACH_KNOWLEDGE_DIR / knowledge-inbox (L1/L2 filtered out)
 */

const { checkRateLimit, sendRateLimit } = require("../../../lib/rate-limit");
const { runCoachBrainSync, readLastSync } = require("../coach-brain-sync");
const {
  resolveAdminPassword,
  checkAdminAuth: sharedCheckAdminAuth,
  adminAuthDenied,
} = require("./admin-auth");
const { applyCors } = require("../../../lib/cors-allowlist");

const ADMIN_PASSWORD = resolveAdminPassword();

function checkAdminAuth(req) {
  return sharedCheckAdminAuth(req, ADMIN_PASSWORD);
}

module.exports = async function handler(req, res) {
  applyCors(req, res, {
    methods: "GET,POST,OPTIONS",
    headers: "Content-Type, X-Admin-Password, X-Admin-Token",
  });
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    if (!checkAdminAuth(req)) return adminAuthDenied(res);
    const lastSync = await readLastSync();
    return res.status(200).json({ ok: true, lastSync: lastSync });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rl = checkRateLimit(req, { name: "admin-drive-sync", limit: 4, windowMs: 60_000 });
  if (!rl.ok) return sendRateLimit(res, rl);

  if (!checkAdminAuth(req)) return adminAuthDenied(res);

  try {
    const result = await runCoachBrainSync({});
    const lastSync = await readLastSync();
    return res.status(200).json({
      ok: !!result.ok,
      result: result,
      lastSync: lastSync,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "sync_failed",
      message: String(e.message || e),
    });
  }
};
