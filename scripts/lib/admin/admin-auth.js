/**
 * Shared admin auth for founder dashboard APIs.
 * Password lives only in server env (ADMIN_PASSWORD on Vercel).
 * No hardcoded bootstrap. No password via URL query.
 * Remember-me uses a signed session token — never persist the raw password on the client.
 */
const crypto = require("crypto");

function resolveAdminPassword() {
  return String(process.env.ADMIN_PASSWORD || "").trim();
}

function timingSafeEqualStr(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function extractAdminPasswordCandidate(req) {
  const headers = (req && req.headers) || {};
  const body = (req && req.body) || {};
  return String(headers["x-admin-password"] || body.adminPassword || body.password || "");
}

function extractAdminSessionToken(req) {
  const headers = (req && req.headers) || {};
  const body = (req && req.body) || {};
  return String(headers["x-admin-token"] || body.adminToken || body.adminSessionToken || "");
}

/** @deprecated use extractAdminPasswordCandidate / extractAdminSessionToken */
function extractAdminAuthSecret(req) {
  return extractAdminPasswordCandidate(req) || extractAdminSessionToken(req);
}

function mintAdminSessionToken(adminPassword, opts) {
  const secret = String(adminPassword || resolveAdminPassword() || "");
  if (!secret) return "";
  const remember = !!(opts && opts.remember);
  const ttlMs = remember ? 14 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
  const payload = Buffer.from(
    JSON.stringify({ v: 1, exp: Date.now() + ttlMs, r: remember ? 1 : 0 }),
    "utf8"
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret)
    .update("admin-session.v1." + payload)
    .digest("base64url");
  return "aws1." + payload + "." + sig;
}

function verifyAdminSessionToken(token, adminPassword) {
  const raw = String(token || "");
  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== "aws1") return false;
  const secret = String(adminPassword || resolveAdminPassword() || "");
  if (!secret) return false;
  const payload = parts[1];
  const sig = parts[2];
  const expected = crypto
    .createHmac("sha256", secret)
    .update("admin-session.v1." + payload)
    .digest("base64url");
  if (!timingSafeEqualStr(sig, expected)) return false;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch (e) {
    return false;
  }
  if (!data || data.v !== 1 || !data.exp) return false;
  if (Date.now() > Number(data.exp)) return false;
  return true;
}

function adminAuthUsedPassword(req, adminPassword) {
  const expected = adminPassword || resolveAdminPassword();
  if (!expected) return false;
  const pw = extractAdminPasswordCandidate(req);
  return !!pw && pw === expected;
}

function checkAdminAuth(req, adminPassword) {
  const expected = adminPassword || resolveAdminPassword();
  if (!expected) return false;
  if (adminAuthUsedPassword(req, expected)) return true;
  const token = extractAdminSessionToken(req);
  return !!token && verifyAdminSessionToken(token, expected);
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
  extractAdminPasswordCandidate,
  extractAdminSessionToken,
  mintAdminSessionToken,
  verifyAdminSessionToken,
  adminAuthUsedPassword,
};
