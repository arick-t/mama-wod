/**
 * Device write ownership for admin snapshots (Stage A).
 * Client sends writeKey; server stores only sha256 hex hash.
 *
 * Reclaim (same athleteId): unbound seed / tombstone may bind when allowUnboundBind
 * (self-serve intake complete with a block) — keep the stored user id on the admin list.
 */
const crypto = require("crypto");

function normalizeWriteKey(raw) {
  const s = String(raw || "").trim();
  if (s.length < 16 || s.length > 128) return "";
  if (!/^[A-Za-z0-9_\-]+$/.test(s)) return "";
  return s;
}

function hashWriteKey(writeKey) {
  const key = normalizeWriteKey(writeKey);
  if (!key) return "";
  return crypto.createHash("sha256").update(key, "utf8").digest("hex");
}

/**
 * @param {object} existing
 * @param {string} writeKey
 * @param {boolean} isAdmin
 * @param {{ allowUnboundBind?: boolean }=} opts
 * @returns {{ ok: true, bindHash?: string, reclaimed?: boolean } | { ok: false, status: number, error: string, message: string }}
 */
function assertSnapshotWriteAllowed(existing, writeKey, isAdmin, opts) {
  if (isAdmin) return { ok: true };
  opts = opts || {};

  const hash = hashWriteKey(writeKey);
  if (!hash) {
    return {
      ok: false,
      status: 401,
      error: "write_key_required",
      message: "חסר מפתח שמירה מהמכשיר. רעננו את האפליקציה ונסה שוב.",
    };
  }

  const hasRow = !!(existing && (existing.athleteId || existing.createdAt));
  const bound = String((existing && existing.writeKeyHash) || "").trim();

  if (!hasRow) {
    return { ok: true, bindHash: hash };
  }

  if (!bound) {
    // Seeded / admin-created without device bind — allow first bind only when reclaiming
    // (intake-complete self-serve / resurrect), so the same athleteId reappears in admin.
    if (opts.allowUnboundBind) {
      return { ok: true, bindHash: hash, reclaimed: true };
    }
    return {
      ok: false,
      status: 403,
      error: "snapshot_locked",
      message: "המתאמן נעול לכתיבה ממכשיר. יש לקשר במכשיר דרך לינק מהאדמין, או לערוך מהאדמין.",
    };
  }

  if (bound !== hash) {
    return {
      ok: false,
      status: 403,
      error: "write_key_mismatch",
      message: "אין הרשאה לעדכן את המתאמן הזה ממכשיר זה.",
    };
  }

  return { ok: true };
}

function makeWriteKey() {
  return crypto.randomBytes(24).toString("base64url");
}

module.exports = {
  normalizeWriteKey,
  hashWriteKey,
  assertSnapshotWriteAllowed,
  makeWriteKey,
};
