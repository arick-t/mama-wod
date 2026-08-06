/**
 * Shared CORS allowlist — official app origins only.
 * Missing Origin (curl / same-host non-CORS) → permissive "*".
 * Unknown browser Origin → omit Allow-Origin (browser blocks).
 * Never blocks athletes opening the official share link.
 */
function defaultAllowlist() {
  return [
    "https://mama-wod.vercel.app",
    "https://arick-t.github.io",
  ];
}

function envAllowlist() {
  const raw = String(process.env.CORS_ALLOWED_ORIGINS || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map(function (s) {
      return String(s || "").trim();
    })
    .filter(Boolean);
}

function isLocalDevOrigin(origin) {
  return (
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
    /^capacitor:\/\/localhost$/i.test(origin) ||
    /^ionic:\/\/localhost$/i.test(origin)
  );
}

function resolveAllowedOrigin(originRaw) {
  const origin = String(originRaw || "").trim();
  if (!origin) return "*";
  const list = defaultAllowlist().concat(envAllowlist());
  for (let i = 0; i < list.length; i++) {
    if (list[i] === origin) return origin;
  }
  if (isLocalDevOrigin(origin)) return origin;
  return null;
}

/**
 * @param {object} req
 * @param {object} res
 * @param {{ methods?: string, headers?: string }} [opts]
 */
function applyCors(req, res, opts) {
  const o = opts || {};
  res.setHeader("Access-Control-Allow-Methods", o.methods || "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    o.headers || "Content-Type, X-Admin-Password, X-Admin-Token, X-Athlete-Id"
  );
  const headers = (req && req.headers) || {};
  const origin = headers.origin || headers.Origin || "";
  const allowed = resolveAllowedOrigin(origin);
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", allowed);
    if (allowed !== "*") {
      try {
        res.setHeader("Vary", "Origin");
      } catch (e) {}
    }
  }
}

module.exports = {
  applyCors,
  resolveAllowedOrigin,
  defaultAllowlist,
};
