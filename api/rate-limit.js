/**
 * Best-effort in-memory rate limit for Vercel serverless / local-dev.
 * Per-instance only (not a distributed store) — still blocks casual abuse.
 */
const buckets = new Map();
const MAX_KEYS = 8000;

function clientIp(req) {
  const headers = (req && req.headers) || {};
  const fwd = String(headers["x-forwarded-for"] || headers["X-Forwarded-For"] || "");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 64);
  const real = String(headers["x-real-ip"] || headers["X-Real-Ip"] || "").trim();
  if (real) return real.slice(0, 64);
  return "unknown";
}

function pruneIfNeeded() {
  if (buckets.size <= MAX_KEYS) return;
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (!b || now - b.start > 2 * 60 * 60 * 1000) buckets.delete(k);
  }
  if (buckets.size > MAX_KEYS) {
    const keys = Array.from(buckets.keys()).slice(0, Math.floor(MAX_KEYS / 4));
    keys.forEach((k) => buckets.delete(k));
  }
}

/**
 * @param {object} req
 * @param {{ name: string, limit: number, windowMs: number, uid?: string }} opts
 * @returns {{ ok: true } | { ok: false, retryAfterSec: number }}
 */
function checkRateLimit(req, opts) {
  const name = String((opts && opts.name) || "api");
  const limit = Math.max(1, (opts && opts.limit) | 0);
  const windowMs = Math.max(1000, (opts && opts.windowMs) | 0);
  const uid = String((opts && opts.uid) || "")
    .trim()
    .slice(0, 80);
  const ip = clientIp(req);
  const key = name + "|" + ip + "|" + uid;
  const now = Date.now();
  pruneIfNeeded();
  let b = buckets.get(key);
  if (!b || now - b.start >= windowMs) {
    b = { start: now, count: 0 };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((b.start + windowMs - now) / 1000)),
    };
  }
  return { ok: true };
}

function sendRateLimit(res, result) {
  const sec = (result && result.retryAfterSec) || 60;
  try {
    res.setHeader("Retry-After", String(sec));
  } catch (e) {}
  return res.status(429).json({
    error: "Too many requests",
    detail: "Please wait a moment and try again.",
    retryAfterSec: sec,
  });
}

module.exports = {
  checkRateLimit,
  sendRateLimit,
  clientIp,
};
