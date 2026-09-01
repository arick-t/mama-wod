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

/* Existing high-entropy server secrets, in preference order, used to DERIVE a signing
 * key when ADMIN_SESSION_SECRET is absent or too short. Every one of these is already
 * required for the app to function, so if the app runs, a strong donor exists. */
const SESSION_KEY_DONORS = [
  "BLOB_READ_WRITE_TOKEN",
  "GEMINI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GOOGLE_AI_API_KEY",
];

/* Domain separation: this label is what stops a derived key from ever colliding with
 * the donor secret or with any other use of it. Changing it invalidates all sessions. */
const SESSION_KEY_INFO = "duck-wod/admin-session-hmac/v1";

/**
 * The HMAC key for admin session tokens.
 *
 * WHY THERE IS A DERIVATION PATH AT ALL
 * Without a usable key, no session token is ever minted — and the visible symptom is
 * that EVERY admin page asks for the password again, one after another. The owner hit
 * that three times, and the "fix" of setting a short, memorable ADMIN_SESSION_SECRET is
 * strictly worse than the annoyance: a guessable signing key lets anyone forge an admin
 * token WITHOUT the password. So a short value is still refused as a key.
 *
 * Instead, when no proper secret is configured, the key is derived with HKDF-SHA256 from
 * a secret that is already strong and already present. This is the standard way to get a
 * second key from one high-entropy secret, and it holds because:
 *   · every serverless instance reads the same env, so every instance derives the same
 *     key — a token minted on one verifies on another;
 *   · the info label domain-separates it, so it cannot be confused with the donor;
 *   · the donor is never logged, returned, or exposed — only the derived output is used.
 *
 * A too-short ADMIN_SESSION_SECRET is not ignored: it becomes the HKDF salt, so setting
 * one still changes the key. Setting a proper 32+ character value takes over completely.
 *
 * CAVEAT worth knowing: rotating the donor secret invalidates live sessions, and the
 * owner types the password once more. That is the whole cost.
 *
 * @returns {string} a key of at least MIN_SESSION_SECRET_LEN chars, or "" if none is possible
 */
function resolveAdminSessionSecret() {
  const configured = String(process.env.ADMIN_SESSION_SECRET || "").trim();
  if (configured.length >= MIN_SESSION_SECRET_LEN) return configured;

  for (const name of SESSION_KEY_DONORS) {
    const donor = String(process.env[name] || "").trim();
    if (donor.length < MIN_SESSION_SECRET_LEN) continue;
    try {
      /* The short configured value (if any) is the salt — it must not be trusted as key
         material on its own, but it is fine as a salt and keeps the owner's setting
         meaningful. */
      const derived = crypto.hkdfSync("sha256", donor, configured, SESSION_KEY_INFO, 32);
      return Buffer.from(derived).toString("hex");
    } catch (e) {
      /* hkdfSync missing on a very old runtime — fall back to HMAC, same idea. */
      try {
        return crypto
          .createHmac("sha256", donor)
          .update(SESSION_KEY_INFO + "\n" + configured, "utf8")
          .digest("hex");
      } catch (e2) {
        return "";
      }
    }
  }
  return "";
}

/**
 * Where the signing key came from — so a health endpoint can state a fact instead of
 * leaving the owner to guess why a password is being asked for twice.
 * @returns {"configured"|"derived"|"none"}
 */
function sessionSecretSource() {
  const configured = String(process.env.ADMIN_SESSION_SECRET || "").trim();
  if (configured.length >= MIN_SESSION_SECRET_LEN) return "configured";
  return resolveAdminSessionSecret() ? "derived" : "none";
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
  sessionSecretSource,
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
