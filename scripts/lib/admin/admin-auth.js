/**
 * Shared admin auth for founder dashboard APIs.
 * Password lives only in server env (ADMIN_PASSWORD on Vercel).
 * Session tokens are HMAC-signed with ADMIN_SESSION_SECRET — never the raw password.
 * No hardcoded bootstrap. No password via URL query.
 */
const crypto = require("crypto");

const SESSION_PREFIX = "aws1";
const SESSION_MAC_PREFIX = "admin-session.v2.";
const MIN_SESSION_SECRET_LEN = 32;
const REMEMBER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TAB_TTL_MS = 12 * 60 * 60 * 1000;

function resolveAdminPassword() {
  return String(process.env.ADMIN_PASSWORD || "").trim();
}

function resolveAdminSessionSecret() {
  return String(process.env.ADMIN_SESSION_SECRET || "").trim();
}

function timingSafeEqualStr(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function passwordFingerprint(adminPassword) {
  return crypto
    .createHash("sha256")
    .update(String(adminPassword || ""), "utf8")
    .digest("hex")
    .slice(0, 8);
}

function sessionSecretReady(secret) {
  const s = String(secret || resolveAdminSessionSecret() || "");
  return s.length >= MIN_SESSION_SECRET_LEN;
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

/**
 * Mint signed session token. HMAC key = ADMIN_SESSION_SECRET (not the password).
 * Payload includes password fingerprint so rotating ADMIN_PASSWORD invalidates tokens.
 * Returns "" if SESSION_SECRET is missing/short.
 */
function mintAdminSessionToken(adminPassword, opts) {
  const hmacKey = resolveAdminSessionSecret();
  if (!sessionSecretReady(hmacKey)) return "";
  const pw = String(adminPassword || resolveAdminPassword() || "");
  if (!pw) return "";
  const remember = !!(opts && opts.remember);
  const ttlMs = remember ? REMEMBER_TTL_MS : TAB_TTL_MS;
  const payload = Buffer.from(
    JSON.stringify({
      v: 2,
      exp: Date.now() + ttlMs,
      r: remember ? 1 : 0,
      pfp: passwordFingerprint(pw),
    }),
    "utf8"
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", hmacKey)
    .update(SESSION_MAC_PREFIX + payload)
    .digest("base64url");
  return SESSION_PREFIX + "." + payload + "." + sig;
}

function verifyAdminSessionToken(token, adminPassword) {
  const raw = String(token || "");
  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== SESSION_PREFIX) return false;
  const hmacKey = resolveAdminSessionSecret();
  if (!sessionSecretReady(hmacKey)) return false;
  const pw = String(adminPassword || resolveAdminPassword() || "");
  if (!pw) return false;
  const payload = parts[1];
  const sig = parts[2];
  const expected = crypto
    .createHmac("sha256", hmacKey)
    .update(SESSION_MAC_PREFIX + payload)
    .digest("base64url");
  if (!timingSafeEqualStr(sig, expected)) return false;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch (e) {
    return false;
  }
  if (!data || data.v !== 2 || !data.exp) return false;
  if (Date.now() > Number(data.exp)) return false;
  if (!timingSafeEqualStr(String(data.pfp || ""), passwordFingerprint(pw))) return false;
  return true;
}

function adminAuthUsedPassword(req, adminPassword) {
  const expected = adminPassword || resolveAdminPassword();
  if (!expected) return false;
  const pw = extractAdminPasswordCandidate(req);
  return !!pw && timingSafeEqualStr(pw, expected);
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
  resolveAdminSessionSecret,
  sessionSecretReady,
  passwordFingerprint,
  checkAdminAuth,
  adminAuthDenied,
  extractAdminAuthSecret,
  extractAdminPasswordCandidate,
  extractAdminSessionToken,
  mintAdminSessionToken,
  verifyAdminSessionToken,
  adminAuthUsedPassword,
  timingSafeEqualStr,
  REMEMBER_TTL_MS,
  TAB_TTL_MS,
  MIN_SESSION_SECRET_LEN,
};
