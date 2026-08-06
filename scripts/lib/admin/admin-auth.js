/**
 * Shared admin auth for founder dashboard APIs.
 * Password lives only in server env (ADMIN_PASSWORD on Vercel).
 * No hardcoded bootstrap. No password via URL query.
 */
function resolveAdminPassword() {
  return String(process.env.ADMIN_PASSWORD || "").trim();
}

function extractAdminAuthSecret(req) {
  const headers = (req && req.headers) || {};
  const body = (req && req.body) || {};
  return String(
    headers["x-admin-password"] ||
      headers["x-admin-token"] ||
      body.adminPassword ||
      body.password ||
      ""
  );
}

function checkAdminAuth(req, adminPassword) {
  const expected = adminPassword || resolveAdminPassword();
  if (!expected) return false;
  const auth = extractAdminAuthSecret(req);
  return String(auth) === expected;
}

function adminAuthDenied(res, adminPassword) {
  const expected = adminPassword || resolveAdminPassword();
  if (!expected) {
    return res.status(503).json({
      ok: false,
      error: "admin_not_configured",
      message: "לא הוגדר בשרת. הגדר ADMIN_PASSWORD ב־Vercel ואז Redeploy.",
      messageEn:
        "ADMIN_PASSWORD is not set on the server. Add it in Vercel → Settings → Environment Variables, then Redeploy.",
    });
  }
  return res.status(401).json({
    ok: false,
    error: "Unauthorized",
    message: "סיסמה שגויה",
  });
}

module.exports = {
  resolveAdminPassword,
  checkAdminAuth,
  adminAuthDenied,
  extractAdminAuthSecret,
};
