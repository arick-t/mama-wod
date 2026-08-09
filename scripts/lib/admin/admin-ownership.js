/**
 * Device write ownership for admin snapshots (Stage A).
 * Client sends writeKey; server stores only sha256 hex hash.
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
 * @returns {{ ok: true, bindHash?: string } | { ok: false, status: number, error: string, message: string }}
 */
function assertSnapshotWriteAllowed(existing, writeKey, isAdmin) {
  if (isAdmin) return { ok: true };

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
    // One-time admin-authorized claim for seeded stubs (e.g. Blob migration).
    // UIDs may be public — never allow bind unless founder opened seedClaimOpen.
    if (existing && existing.seeded && existing.seedClaimOpen) {
      return { ok: true, bindHash: hash };
    }
    // Seeded / admin-created without device bind — clients cannot overwrite.
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
