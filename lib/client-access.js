/**
 * Client access — how a coach gets into their program, and nothing more.
 *
 * The owner deliberately chose NOT to hold client email or phone numbers. So there
 * is no OTP service and no third party in the loop: the owner generates a 6-digit
 * code in admin and passes it over WhatsApp, the coach types it once, and that
 * device is bound to the account.
 *
 * That is stronger than it looks. Forwarding the link is useless — the link is not
 * a credential, the device token is, and a token is only minted by redeeming a
 * single-use code the owner handed over personally. To get in, someone needs the
 * owner on the phone.
 *
 * Identity, not device: a coach with a phone and a computer redeems a second code
 * and both work. Which is also why the legal signature is recorded against the
 * ACCOUNT — he signs once, and the second device walks straight in (checklist b.3).
 *
 * Nothing here is reversible on the server: codes and tokens are stored as hashes.
 * 0 LLM.
 */

"use strict";

const crypto = require("crypto");

const ACCESS_PREFIX = "client-access/";
const CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CODE_LENGTH = 6;
const MAX_OPEN_CODES = 5;
const MAX_DEVICES = 3;
const TOKEN_BYTES = 32;

/** Bump ONLY when the terms text changes — a bump makes every client re-sign once. */
const CLIENT_TERMS_VERSION = "v3.4-legal";

function accessKey(programId) {
  const id = String(programId || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 60);
  return ACCESS_PREFIX + id + ".json";
}

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function nowMs(clock) {
  return typeof clock === "function" ? clock() : Date.now();
}

/**
 * Hashes are salted with the deployment secret so a leaked Blob cannot be
 * brute-forced offline — six digits is 10^6, trivial without a secret.
 */
function resolveSalt() {
  const s =
    String(process.env.CLIENT_ACCESS_SECRET || "").trim() ||
    String(process.env.ADMIN_SESSION_SECRET || "").trim() ||
    String(process.env.ADMIN_PASSWORD || "").trim();
  return s;
}

/**
 * WHICH secret is salting the codes, never the secret itself.
 *
 * "client_secret" is the one to want: the codes are salted with a key of their own.
 * "session_secret" and "admin_password" both work, but they tie every client's code and
 * every linked device to a value that exists for another purpose — change the admin
 * password and every client is locked out with no warning and no way back. Reported on
 * the public status GET so the answer is a fact anyone can check, not a memory
 * (owner, 2026-09-03).
 *
 * @returns {"client_secret"|"session_secret"|"admin_password"|"none"}
 */
function saltSource() {
  if (String(process.env.CLIENT_ACCESS_SECRET || "").trim()) return "client_secret";
  if (String(process.env.ADMIN_SESSION_SECRET || "").trim()) return "session_secret";
  if (String(process.env.ADMIN_PASSWORD || "").trim()) return "admin_password";
  return "none";
}

function hashValue(raw, saltOverride) {
  const salt = saltOverride === undefined ? resolveSalt() : String(saltOverride || "");
  return crypto
    .createHmac("sha256", "client-access.v1." + salt)
    .update(String(raw || ""), "utf8")
    .digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/** Six digits, uniform, no modulo bias, never starting 0 so it reads cleanly aloud. */
function generateCode() {
  const first = 1 + Math.floor(crypto.randomInt(0, 9));
  let rest = "";
  for (let i = 1; i < CODE_LENGTH; i++) rest += String(crypto.randomInt(0, 10));
  return String(first) + rest;
}

function generateDeviceToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

function generateDeviceId() {
  return "d_" + crypto.randomBytes(8).toString("hex");
}

function emptyAccess(programId, clock) {
  return {
    programId: String(programId || "").slice(0, 60),
    codes: [],
    devices: [],
    signature: null,
    createdAt: new Date(nowMs(clock)).toISOString(),
    updatedAt: new Date(nowMs(clock)).toISOString(),
  };
}

function normalizeAccess(row, programId, clock) {
  if (!isPlainObject(row)) return emptyAccess(programId, clock);
  const out = Object.assign(emptyAccess(programId, clock), row);
  if (!Array.isArray(out.codes)) out.codes = [];
  if (!Array.isArray(out.devices)) out.devices = [];
  if (!isPlainObject(out.signature)) out.signature = null;
  return out;
}

/**
 * Issue a code for the owner to read out. Returns the plaintext ONCE — it is never
 * stored, so it cannot be recovered later. Losing it means issuing another.
 */
function issueCode(access, opts) {
  const o = isPlainObject(opts) ? opts : {};
  const clock = o.now;
  const next = normalizeAccess(access, o.programId, clock);
  const code = String(o.code || generateCode());
  const at = nowMs(clock);
  const ttl = Number.isFinite(Number(o.ttlMs)) ? Number(o.ttlMs) : CODE_TTL_MS;

  /* Drop spent and expired codes rather than letting the list grow. */
  next.codes = next.codes.filter(function (c) {
    return c && !c.usedAt && Number(c.expiresAt) > at;
  });
  if (next.codes.length >= MAX_OPEN_CODES) {
    return { ok: false, code: "TOO_MANY_OPEN_CODES", error: "too many unused codes — revoke some first" };
  }
  next.codes.push({
    hash: hashValue(code, o.salt),
    issuedAt: new Date(at).toISOString(),
    expiresAt: at + ttl,
    label: String(o.label || "").slice(0, 60),
    usedAt: null,
  });
  next.updatedAt = new Date(at).toISOString();
  return { ok: true, access: next, code: code, expiresAt: at + ttl };
}

function revokeOpenCodes(access, opts) {
  const o = isPlainObject(opts) ? opts : {};
  const next = normalizeAccess(access, o.programId, o.now);
  const before = next.codes.length;
  next.codes = next.codes.filter(function (c) {
    return c && c.usedAt;
  });
  next.updatedAt = new Date(nowMs(o.now)).toISOString();
  return { ok: true, access: next, revoked: before - next.codes.length };
}

/**
 * Redeem a code for a device token. Single use: the code is spent whether or not
 * the client later signs.
 */
function redeemCode(access, submittedCode, opts) {
  const o = isPlainObject(opts) ? opts : {};
  const clock = o.now;
  const next = normalizeAccess(access, o.programId, clock);
  const at = nowMs(clock);
  const submitted = String(submittedCode || "").replace(/\D/g, "");
  if (submitted.length !== CODE_LENGTH) {
    return { ok: false, code: "BAD_CODE", error: "code must be " + CODE_LENGTH + " digits" };
  }
  const submittedHash = hashValue(submitted, o.salt);

  let matched = null;
  for (const entry of next.codes) {
    if (!entry || entry.usedAt) continue;
    if (!safeEqual(entry.hash, submittedHash)) continue;
    matched = entry;
    break;
  }
  if (!matched) return { ok: false, code: "CODE_NOT_FOUND", error: "code is wrong or already used" };
  if (Number(matched.expiresAt) <= at) {
    return { ok: false, code: "CODE_EXPIRED", error: "code has expired — ask for a new one" };
  }

  matched.usedAt = new Date(at).toISOString();

  const token = o.token ? String(o.token) : generateDeviceToken();
  const device = {
    id: generateDeviceId(),
    tokenHash: hashValue(token, o.salt),
    addedAt: new Date(at).toISOString(),
    lastSeenAt: new Date(at).toISOString(),
    label: String(o.deviceLabel || "").slice(0, 80),
  };

  /* A cap is what stops one subscription serving five coaches. Oldest out, and the
     owner can see it happened in the device list. */
  next.devices.push(device);
  let evicted = null;
  if (next.devices.length > MAX_DEVICES) {
    next.devices.sort(function (a, b) {
      return String(a.addedAt || "").localeCompare(String(b.addedAt || ""));
    });
    evicted = next.devices.shift();
  }
  next.updatedAt = new Date(at).toISOString();
  return { ok: true, access: next, token: token, device: device, evicted: evicted };
}

/**
 * @returns {{ ok: true, access: object, device: object, signed: boolean }
 *          | { ok: false, code: string, error: string }}
 */
function verifyDeviceToken(access, token, opts) {
  const o = isPlainObject(opts) ? opts : {};
  const next = normalizeAccess(access, o.programId, o.now);
  const raw = String(token || "");
  if (!raw) return { ok: false, code: "NO_TOKEN", error: "missing device token" };
  const hash = hashValue(raw, o.salt);
  for (const d of next.devices) {
    if (!d || !safeEqual(d.tokenHash, hash)) continue;
    d.lastSeenAt = new Date(nowMs(o.now)).toISOString();
    next.updatedAt = d.lastSeenAt;
    return {
      ok: true,
      access: next,
      device: d,
      signed: isSignedForCurrentTerms(next, o.termsVersion),
    };
  }
  return { ok: false, code: "UNKNOWN_DEVICE", error: "this device is not authorised" };
}

function revokeDevice(access, deviceId, opts) {
  const o = isPlainObject(opts) ? opts : {};
  const next = normalizeAccess(access, o.programId, o.now);
  const id = String(deviceId || "");
  const before = next.devices.length;
  next.devices = next.devices.filter(function (d) {
    return !d || d.id !== id;
  });
  next.updatedAt = new Date(nowMs(o.now)).toISOString();
  if (next.devices.length === before) {
    return { ok: false, code: "NO_SUCH_DEVICE", error: "device not found", access: next };
  }
  return { ok: true, access: next, revoked: before - next.devices.length };
}

/** Signature belongs to the ACCOUNT, so a second device never re-signs (b.3/b.4). */
function isSignedForCurrentTerms(access, termsVersion) {
  const want = String(termsVersion || CLIENT_TERMS_VERSION);
  const sig = isPlainObject(access) ? access.signature : null;
  if (!isPlainObject(sig)) return false;
  return String(sig.termsVersion || "") === want;
}

function recordSignature(access, opts) {
  const o = isPlainObject(opts) ? opts : {};
  const next = normalizeAccess(access, o.programId, o.now);
  const at = nowMs(o.now);
  if (o.accepted !== true) {
    return { ok: false, code: "NOT_ACCEPTED", error: "the checkbox must be ticked" };
  }
  next.signature = {
    termsVersion: String(o.termsVersion || CLIENT_TERMS_VERSION).slice(0, 40),
    accepted: true,
    signedAt: new Date(at).toISOString(),
    signedAtClient: String(o.signedAtClient || "").slice(0, 40),
    deviceId: String(o.deviceId || "").slice(0, 40),
    signerName: String(o.signerName || "").slice(0, 120),
    ip: String(o.ip || "").slice(0, 64),
    ua: String(o.ua || "").slice(0, 300),
  };
  next.updatedAt = new Date(at).toISOString();
  return { ok: true, access: next, signature: next.signature };
}

/** Owner-facing view. Never exposes a hash, and never the plaintext code. */
function accessForOwner(access) {
  const a = normalizeAccess(access);
  const at = Date.now();
  return {
    programId: a.programId,
    openCodes: a.codes
      .filter(function (c) {
        return c && !c.usedAt && Number(c.expiresAt) > at;
      })
      .map(function (c) {
        return { issuedAt: c.issuedAt, expiresAt: c.expiresAt, label: c.label || "" };
      }),
    usedCodes: a.codes.filter(function (c) {
      return c && c.usedAt;
    }).length,
    devices: a.devices.map(function (d) {
      return { id: d.id, addedAt: d.addedAt, lastSeenAt: d.lastSeenAt, label: d.label || "" };
    }),
    deviceCap: MAX_DEVICES,
    signature: a.signature
      ? {
          termsVersion: a.signature.termsVersion,
          signedAt: a.signature.signedAt,
          signerName: a.signature.signerName || "",
        }
      : null,
  };
}

module.exports = {
  accessKey,
  emptyAccess,
  normalizeAccess,
  issueCode,
  revokeOpenCodes,
  redeemCode,
  verifyDeviceToken,
  revokeDevice,
  recordSignature,
  isSignedForCurrentTerms,
  accessForOwner,
  generateCode,
  generateDeviceToken,
  hashValue,
  saltSource,
  /* Exported for the athlete handoff, which checks a code of its own against a hash of
     its own — same maths, one implementation. It was called from there before it was
     exported, which is a runtime failure a source test would never have caught. */
  safeEqual,
  CLIENT_TERMS_VERSION,
  CODE_TTL_MS,
  CODE_LENGTH,
  MAX_DEVICES,
  MAX_OPEN_CODES,
  ACCESS_PREFIX,
};
