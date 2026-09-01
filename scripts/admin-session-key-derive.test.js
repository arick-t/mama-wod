#!/usr/bin/env node
/**
 * The signing key for admin session tokens.
 *
 * THE PROBLEM THIS SOLVES
 * With no usable key, no session token is minted, and the symptom the owner actually
 * sees is that every admin page asks for the password again — admin.html, then
 * admin-clients.html, then back. He reported it three times, and twice I sent him to
 * change a Vercel env var instead of fixing it.
 *
 * The tempting "fix" — accepting his short, memorable ADMIN_SESSION_SECRET — is worse
 * than the annoyance: a guessable signing key lets anyone MINT a valid admin token
 * without ever knowing the password. So these tests pin both halves:
 *   · a short secret is still refused as key material, and
 *   · a strong key is nevertheless available, derived from a secret already present.
 *
 * 0 LLM. No network.
 */

"use strict";

const assert = require("assert");
const crypto = require("crypto");
const path = require("path");

const AUTH_PATH = path.join(__dirname, "lib", "admin", "admin-auth.js");

let passed = 0;
function ok(name, cond, extra) {
  assert.ok(cond, name + (extra ? " — " + extra : ""));
  console.log("ok — " + name);
  passed++;
}

/** Load the module against a specific env, with nothing left over from the last case. */
function withEnv(env) {
  const KEYS = [
    "ADMIN_SESSION_SECRET",
    "BLOB_READ_WRITE_TOKEN",
    "GEMINI_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "GOOGLE_AI_API_KEY",
    "ADMIN_PASSWORD",
  ];
  const saved = {};
  KEYS.forEach(function (k) {
    saved[k] = process.env[k];
    delete process.env[k];
  });
  Object.keys(env).forEach(function (k) {
    process.env[k] = env[k];
  });
  delete require.cache[require.resolve(AUTH_PATH)];
  const mod = require(AUTH_PATH);
  const restore = function () {
    KEYS.forEach(function (k) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
    delete require.cache[require.resolve(AUTH_PATH)];
  };
  return { mod, restore };
}

const STRONG = "vercel_blob_rw_" + crypto.randomBytes(24).toString("hex");
const OTHER_STRONG = "vercel_blob_rw_" + crypto.randomBytes(24).toString("hex");
const PROPER_SECRET = crypto.randomBytes(32).toString("hex"); // 64 chars
const SHORT_SECRET = "0523701404!"; // the owner's actual value: 11 chars

/* --- 1 · a properly configured secret is used verbatim ------------------- */
{
  const { mod, restore } = withEnv({ ADMIN_SESSION_SECRET: PROPER_SECRET, BLOB_READ_WRITE_TOKEN: STRONG });
  ok("a proper secret is used as-is", mod.resolveAdminSessionSecret() === PROPER_SECRET);
  ok("and is reported as configured", mod.sessionSecretSource() === "configured");
  ok("the configured secret wins over any donor", mod.resolveAdminSessionSecret() !== STRONG);
  restore();
}

/* --- 2 · a short secret never becomes the key --------------------------- */
{
  const { mod, restore } = withEnv({ ADMIN_SESSION_SECRET: SHORT_SECRET, BLOB_READ_WRITE_TOKEN: STRONG });
  const key = mod.resolveAdminSessionSecret();
  ok("a short secret is not used as the key", key !== SHORT_SECRET);
  ok("a key is still available", key.length >= mod.MIN_SESSION_SECRET_LEN, "len " + key.length);
  ok("and it is reported as derived", mod.sessionSecretSource() === "derived");
  /* The donor must not leak through as the key itself. */
  ok("the donor secret is not the key", key !== STRONG);
  ok("the key does not contain the donor", key.indexOf(STRONG) < 0);
  ok("the key does not contain the short secret", key.indexOf(SHORT_SECRET) < 0);
  restore();
}

/* --- 3 · no secret at all, but a strong donor exists -------------------- */
{
  const { mod, restore } = withEnv({ BLOB_READ_WRITE_TOKEN: STRONG });
  ok("a key is derived with no secret configured", mod.sessionSecretReady());
  ok("reported as derived", mod.sessionSecretSource() === "derived");
  restore();
}

/* --- 4 · determinism: every serverless instance must derive the SAME key -
   A token minted by one instance has to verify on another, so this is not a nicety. */
{
  const a = withEnv({ ADMIN_SESSION_SECRET: SHORT_SECRET, BLOB_READ_WRITE_TOKEN: STRONG });
  const k1 = a.mod.resolveAdminSessionSecret();
  a.restore();
  const b = withEnv({ ADMIN_SESSION_SECRET: SHORT_SECRET, BLOB_READ_WRITE_TOKEN: STRONG });
  const k2 = b.mod.resolveAdminSessionSecret();
  b.restore();
  ok("the same env derives the same key", k1 === k2 && k1.length > 0);
}

/* --- 5 · the derivation actually depends on its inputs ------------------ */
{
  const a = withEnv({ BLOB_READ_WRITE_TOKEN: STRONG });
  const k1 = a.mod.resolveAdminSessionSecret();
  a.restore();
  const b = withEnv({ BLOB_READ_WRITE_TOKEN: OTHER_STRONG });
  const k2 = b.mod.resolveAdminSessionSecret();
  b.restore();
  ok("a different donor gives a different key", k1 !== k2);

  const c = withEnv({ BLOB_READ_WRITE_TOKEN: STRONG, ADMIN_SESSION_SECRET: SHORT_SECRET });
  const k3 = c.mod.resolveAdminSessionSecret();
  c.restore();
  ok("a short secret still changes the key — it is not ignored", k3 !== k1);
}

/* --- 6 · nothing strong anywhere → refuse, exactly as before ------------ */
{
  const { mod, restore } = withEnv({ ADMIN_SESSION_SECRET: SHORT_SECRET });
  ok("no donor means no key", mod.resolveAdminSessionSecret() === "");
  ok("and the server says so", mod.sessionSecretSource() === "none");
  ok("sessions are not ready", !mod.sessionSecretReady());
  restore();
}
{
  const { mod, restore } = withEnv({ BLOB_READ_WRITE_TOKEN: "too-short" });
  ok("a weak donor is refused too", mod.resolveAdminSessionSecret() === "");
  restore();
}

/* --- 7 · the whole point: a minted token verifies ----------------------- */
{
  const { mod, restore } = withEnv({
    ADMIN_SESSION_SECRET: SHORT_SECRET,
    BLOB_READ_WRITE_TOKEN: STRONG,
    ADMIN_PASSWORD: "pw-for-test",
  });
  /* Positional: (adminPassword, opts) — not an options bag. */
  const token = mod.mintAdminSessionToken("pw-for-test", { remember: false });
  ok("a token is minted where none was before", typeof token === "string" && token.length > 20);
  ok("and it verifies", mod.verifyAdminSessionToken(token, "pw-for-test") === true);
  ok("a tampered token does not", mod.verifyAdminSessionToken(token + "x", "pw-for-test") === false);
  /* Changing the password must invalidate old tokens — the fingerprint is inside. */
  ok(
    "a token does not survive a password change",
    mod.verifyAdminSessionToken(token, "different-pw") === false
  );
  restore();
}

console.log("All admin session key derivation checks passed (" + passed + " assertions).");
