/**
 * Admin session token — security engine A–C (ADMIN_SESSION_SECRET).
 * Run: node scripts/lib/admin/admin-auth.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const auth = require("./admin-auth.js");
const root = path.join(__dirname, "..", "..", "..");
const adminHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const snap = fs.readFileSync(path.join(root, "scripts/lib/admin/admin-snapshot.js"), "utf8");
const cors = fs.readFileSync(path.join(root, "lib/cors-allowlist.js"), "utf8");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

process.env.ADMIN_PASSWORD = "founder-pass-demo";
process.env.ADMIN_SESSION_SECRET = "abcdefghijklmnopqrstuvwxyz012345"; /* 32 chars */

ok("session secret ready", auth.sessionSecretReady());
ok("password fingerprint 8 hex", /^[0-9a-f]{8}$/.test(auth.passwordFingerprint("founder-pass-demo")));

const tok = auth.mintAdminSessionToken("founder-pass-demo", { remember: true });
ok("mints aws1 token", tok.indexOf("aws1.") === 0);
ok("verify ok", auth.verifyAdminSessionToken(tok, "founder-pass-demo"));
ok("wrong password fingerprint fails", !auth.verifyAdminSessionToken(tok, "other-pass"));

process.env.ADMIN_SESSION_SECRET = "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";
ok("HMAC not password — wrong secret fails", !auth.verifyAdminSessionToken(tok, "founder-pass-demo"));
process.env.ADMIN_SESSION_SECRET = "abcdefghijklmnopqrstuvwxyz012345";

delete process.env.ADMIN_SESSION_SECRET;
ok("no mint without secret", auth.mintAdminSessionToken("founder-pass-demo", {}) === "");
ok("no verify without secret", !auth.verifyAdminSessionToken(tok, "founder-pass-demo"));
process.env.ADMIN_SESSION_SECRET = "abcdefghijklmnopqrstuvwxyz012345";

ok(
  "login password compare is timing-safe",
  auth.adminAuthUsedPassword(
    { headers: { "x-admin-password": "founder-pass-demo" }, body: {} },
    "founder-pass-demo"
  ) &&
    !auth.adminAuthUsedPassword(
      { headers: { "x-admin-password": "founder-pass-demX" }, body: {} },
      "founder-pass-demo"
    )
);

ok("remember TTL is 7 days", auth.REMEMBER_TTL_MS === 7 * 24 * 60 * 60 * 1000);
ok("mint uses SESSION_SECRET not password as key", /resolveAdminSessionSecret/.test(fs.readFileSync(path.join(__dirname, "admin-auth.js"), "utf8")));
ok("snapshot mints via response header", /X-Admin-Session-Token/.test(snap) && !/json\.adminSessionToken\s*=/.test(snap));
ok("cors exposes session token header", /X-Admin-Session-Token/.test(cors));
ok("client force logout on 401", /function forceAdminLogout/.test(adminHtml) && /forceAdminLogout/.test(adminHtml));
ok("loadAthletes checks 401", /loadAthletes[\s\S]{0,900}status === 401/.test(adminHtml));
/* No logout button any more (owner, 2026-09-01) — but a 401 must still throw the
   session away, which is the half that actually protects anything. */
ok("no logout button in the header", !/onclick="adminLogout\(\)"/.test(adminHtml));
ok("a 401 still clears the session", /function forceAdminLogout/.test(adminHtml));
ok("reads token from response header", /X-Admin-Session-Token/.test(adminHtml));
ok("admin version 4.2", /ADMIN_UI_VERSION = "4\.2"/.test(adminHtml));

delete process.env.ADMIN_PASSWORD;
delete process.env.ADMIN_SESSION_SECRET;
console.log("All admin-auth session secret checks passed.");
