/**
 * Shared admin auth for founder dashboard APIs.
 * Prefer ADMIN_PASSWORD from Vercel/env; bootstrap keeps live usable
 * until that env var is configured in the Vercel project.
 */
const FOUNDER_BOOTSTRAP_PASSWORD = "0523701404";

function resolveAdminPassword() {
  const fromEnv = String(process.env.ADMIN_PASSWORD || "").trim();
  if (fromEnv) return fromEnv;
  return FOUNDER_BOOTSTRAP_PASSWORD;
}

function checkAdminAuth(req, adminPassword) {
  const expected = adminPassword || resolveAdminPassword();
  if (!expected) return false;
  const headers = req.headers || {};
  const q = req.query || {};
  const body = req.body || {};
  const auth =
    headers["x-admin-password"] ||
    headers["x-admin-token"] ||
    q.adminPassword ||
    q.pw ||
    body.adminPassword ||
    body.password ||
    "";
  return String(auth) === expected;
}

function adminAuthDenied(res, adminPassword) {
  const expected = adminPassword || resolveAdminPassword();
  if (!expected) {
    return res.status(503).json({
      ok: false,
      error: "admin_not_configured",
      message:
        "ADMIN_PASSWORD is not set on the server. Add it in Vercel → Settings → Environment Variables, then Redeploy.",
    });
  }
  return res.status(401).json({ error: "Unauthorized" });
}

module.exports = {
  resolveAdminPassword,
  checkAdminAuth,
  adminAuthDenied,
  FOUNDER_BOOTSTRAP_PASSWORD,
};
