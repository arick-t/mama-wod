/**
 * Client access — codes, devices, signature.
 * Run: node scripts/client-access.test.js
 *
 * The owner chose to hold no client email or phone, so there is no OTP service:
 * he generates a code and passes it over WhatsApp. These tests pin the properties
 * that makes that safe — single use, expiry, hashed at rest, a device cap that
 * stops one subscription serving several coaches, and a signature recorded against
 * the ACCOUNT so a coach with a phone and a laptop signs once, not twice.
 */
const assert = require("assert");
const A = require("../lib/client-access.js");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

const SALT = "test-salt-must-be-long-enough-to-be-meaningful";
const PID = "p_test123";
let clockMs = 1_700_000_000_000;
const now = function () {
  return clockMs;
};
const OPTS = { programId: PID, salt: SALT, now: now };

/* --- code shape ---------------------------------------------------------- */

const samples = Array.from({ length: 200 }, function () {
  return A.generateCode();
});
ok("codes are six digits", samples.every(function (c) { return /^\d{6}$/.test(c); }));
ok("codes never start with zero", samples.every(function (c) { return c[0] !== "0"; }));
ok("codes are not all identical", new Set(samples).size > 150);

/* --- issue --------------------------------------------------------------- */

let access = A.emptyAccess(PID, now);
const issued = A.issueCode(access, Object.assign({}, OPTS, { label: "phone" }));
ok("a code is issued", issued.ok === true);
ok("the plaintext comes back exactly once", /^\d{6}$/.test(issued.code));
access = issued.access;

const stored = JSON.stringify(access);
ok("the plaintext code is NOT stored", stored.indexOf(issued.code) < 0);
ok("only a hash is stored", access.codes[0].hash && access.codes[0].hash.length > 20);
ok("the code has an expiry", Number(access.codes[0].expiresAt) > clockMs);

/* Hashing is salted — otherwise six digits is 10^6 and trivially brute-forced. */
const sameCodeOtherSalt = A.hashValue(issued.code, "a-different-salt");
ok("the same code hashes differently under another salt", sameCodeOtherSalt !== access.codes[0].hash);

/* --- redeem -------------------------------------------------------------- */

const wrong = A.redeemCode(access, "000000", OPTS);
ok("a wrong code is refused", wrong.ok === false && wrong.code === "CODE_NOT_FOUND");

const malformed = A.redeemCode(access, "12ab", OPTS);
ok("a malformed code is refused", malformed.ok === false && malformed.code === "BAD_CODE");

const redeemed = A.redeemCode(access, issued.code, Object.assign({}, OPTS, { deviceLabel: "iPhone" }));
ok("the right code is redeemed", redeemed.ok === true);
ok("a device token comes back", typeof redeemed.token === "string" && redeemed.token.length > 30);
ok("the device is recorded", redeemed.device && redeemed.device.id);
access = redeemed.access;
ok("the device token is NOT stored raw", JSON.stringify(access).indexOf(redeemed.token) < 0);

/* Single use is the whole point — the forwarded link must be worthless. */
const reuse = A.redeemCode(access, issued.code, OPTS);
ok("the same code cannot be redeemed twice", reuse.ok === false && reuse.code === "CODE_NOT_FOUND");

/* --- expiry -------------------------------------------------------------- */

const later = A.issueCode(access, OPTS);
access = later.access;
clockMs += A.CODE_TTL_MS + 1000;
const stale = A.redeemCode(access, later.code, OPTS);
ok("an expired code is refused with its own reason", stale.ok === false && stale.code === "CODE_EXPIRED");

/* --- the device token is the credential ---------------------------------- */

const verified = A.verifyDeviceToken(access, redeemed.token, OPTS);
ok("a known device verifies", verified.ok === true);
ok("verifying records last seen", verified.device.lastSeenAt !== undefined);
ok("an unsigned account reports unsigned", verified.signed === false);
access = verified.access;

ok("an empty token is refused", A.verifyDeviceToken(access, "", OPTS).code === "NO_TOKEN");
ok("a made-up token is refused", A.verifyDeviceToken(access, "not-a-real-token", OPTS).code === "UNKNOWN_DEVICE");
/* A token is only valid against the account it was minted for. */
ok(
  "a token from another account does not work here",
  A.verifyDeviceToken(A.emptyAccess("p_other", now), redeemed.token, OPTS).ok === false
);

/* --- phone AND computer, one signature ---------------------------------- */

const second = A.issueCode(access, Object.assign({}, OPTS, { label: "laptop" }));
const secondRedeem = A.redeemCode(second.access, second.code, Object.assign({}, OPTS, { deviceLabel: "MacBook" }));
ok("a second device is added", secondRedeem.ok === true);
access = secondRedeem.access;
ok("both devices are live", access.devices.length === 2);
ok("the first device still works", A.verifyDeviceToken(access, redeemed.token, OPTS).ok === true);
ok("the second device works too", A.verifyDeviceToken(access, secondRedeem.token, OPTS).ok === true);
ok("the two devices have different tokens", redeemed.token !== secondRedeem.token);

/* --- signature belongs to the account ----------------------------------- */

ok("nothing is signed yet", A.isSignedForCurrentTerms(access) === false);

const refusedSig = A.recordSignature(access, Object.assign({}, OPTS, { accepted: false }));
ok("an unticked checkbox is not a signature", refusedSig.ok === false && refusedSig.code === "NOT_ACCEPTED");

const signed = A.recordSignature(
  access,
  Object.assign({}, OPTS, {
    accepted: true,
    deviceId: redeemed.device.id,
    signerName: "Coach A",
    ip: "203.0.113.9",
    ua: "Mozilla/5.0 iPhone",
    signedAtClient: "2026-08-31T10:00:00.000Z",
  })
);
ok("a ticked checkbox records a signature", signed.ok === true);
access = signed.access;
ok("the signature names the terms version", access.signature.termsVersion === A.CLIENT_TERMS_VERSION);
ok("the terms version is the owner's text", A.CLIENT_TERMS_VERSION === "v3.4-legal");
ok("the signature has a server timestamp", /^\d{4}-\d{2}-\d{2}T/.test(access.signature.signedAt));
ok("the signature records who", access.signature.signerName === "Coach A");
ok("the signature records the device", access.signature.deviceId === redeemed.device.id);
ok("the signature records ip and browser as evidence", access.signature.ip === "203.0.113.9" && /iPhone/.test(access.signature.ua));

/* The point: the SECOND device walks straight in. */
const secondAfterSig = A.verifyDeviceToken(access, secondRedeem.token, OPTS);
ok("the second device is already signed — no second popup", secondAfterSig.signed === true);

/* A new terms version makes everyone re-sign, exactly once. */
ok(
  "bumping the terms text requires a fresh signature",
  A.isSignedForCurrentTerms(access, "v3.5-legal") === false
);
ok("the old signature still stands for its own version", A.isSignedForCurrentTerms(access, "v3.4-legal") === true);

/* --- device cap stops account sharing ----------------------------------- */

let capped = access;
const tokens = [];
for (let i = 0; i < 3; i++) {
  const c = A.issueCode(capped, OPTS);
  const r = A.redeemCode(c.access, c.code, Object.assign({}, OPTS, { deviceLabel: "extra " + i }));
  capped = r.access;
  tokens.push(r.token);
}
ok("the device list never exceeds the cap", capped.devices.length === A.MAX_DEVICES);
ok("the newest device works", A.verifyDeviceToken(capped, tokens[tokens.length - 1], OPTS).ok === true);
ok("the evicted original device stops working", A.verifyDeviceToken(capped, redeemed.token, OPTS).ok === false);

/* --- revoking a device -------------------------------------------------- */

const liveId = capped.devices[capped.devices.length - 1].id;
const liveToken = tokens[tokens.length - 1];
const revoked = A.revokeDevice(capped, liveId, OPTS);
ok("a device can be revoked", revoked.ok === true);
ok("the revoked device stops working immediately", A.verifyDeviceToken(revoked.access, liveToken, OPTS).ok === false);
ok("revoking an unknown device says so", A.revokeDevice(revoked.access, "d_nope", OPTS).code === "NO_SUCH_DEVICE");

/* --- open codes can be pulled back ------------------------------------- */

const openIssued = A.issueCode(revoked.access, OPTS);
const pulled = A.revokeOpenCodes(openIssued.access, OPTS);
ok("open codes can be revoked in one go", pulled.revoked >= 1);
ok("a revoked code no longer works", A.redeemCode(pulled.access, openIssued.code, OPTS).ok === false);

/* Unused codes cannot pile up forever. */
let flooded = A.emptyAccess(PID, now);
let lastIssue = null;
for (let i = 0; i < A.MAX_OPEN_CODES; i++) {
  lastIssue = A.issueCode(flooded, OPTS);
  flooded = lastIssue.access;
}
ok("open codes are capped", A.issueCode(flooded, OPTS).code === "TOO_MANY_OPEN_CODES");

/* --- the owner's view leaks nothing ------------------------------------ */

const ownerView = A.accessForOwner(access);
const ownerJson = JSON.stringify(ownerView);
ok("the owner sees the device list", Array.isArray(ownerView.devices) && ownerView.devices.length > 0);
ok("the owner sees the signature", ownerView.signature && ownerView.signature.signedAt);
ok("the owner sees how many codes are open", Array.isArray(ownerView.openCodes));
ok("no code hash reaches the owner view", ownerJson.indexOf("hash") < 0);
ok("no token hash reaches the owner view", ownerJson.indexOf("tokenHash") < 0);
ok("no plaintext code reaches the owner view", ownerJson.indexOf(issued.code) < 0);

/* --- storage key ------------------------------------------------------- */

ok("the access object lives outside the program object", A.accessKey(PID).indexOf("client-access/") === 0);
ok("a hostile id cannot escape the prefix", A.accessKey("../../etc/passwd") === "client-access/etcpasswd.json");

/* --- no provider calls ------------------------------------------------- */

const src = require("fs").readFileSync(require("path").join(__dirname, "..", "lib", "client-access.js"), "utf8");
ok("access layer makes no network calls", !/\bfetch\s*\(/.test(src));
ok("access layer uses timing-safe comparison", /timingSafeEqual/.test(src));
ok("access layer stores only hashes", /tokenHash/.test(src) && !/token:\s*token,\s*$/m.test(src.split("module.exports")[0].replace(/return \{[\s\S]*?\};/g, "")));

console.log("All client access checks passed.");
