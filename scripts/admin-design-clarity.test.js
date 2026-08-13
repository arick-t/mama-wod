/**
 * Admin design clarity — fonts/tokens/pprog styles aligned with app (cosmetic only).
 */
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const admin = fs.readFileSync(path.join(__dirname, "..", "admin.html"), "utf8");
const claim = fs.readFileSync(path.join(__dirname, "..", "claim.html"), "utf8");
const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

assert.ok(!/Assistant/i.test(admin), "admin must not use Assistant font");
assert.ok(/family=Heebo/.test(admin), "admin must load Heebo");
assert.ok(/family=Oswald/.test(admin) || /Oswald:wght/.test(admin), "admin must load Oswald");
assert.ok(/--font-ui:\s*'Heebo'/.test(admin), "admin --font-ui Heebo");
assert.ok(/--font-display:\s*'Oswald'/.test(admin), "admin --font-display Oswald");
assert.ok(/--bg:\s*#121212/.test(admin), "admin bg token");
assert.ok(/--brand:\s*#E8451A/.test(admin), "admin brand token");
assert.ok(/--part:\s*#6fafa4/.test(admin), "admin part token");
assert.ok(/--note:\s*#7eb8c9/.test(admin), "admin note token");
assert.ok(/--coach:\s*#9b6bb8/.test(admin), "admin coach token");
assert.ok(/color:var\(--part\)/.test(admin), "pprog section titles use --part");
assert.ok(!/\.pprog-day-card \.section-title\{[^}]*text-decoration:underline/.test(admin), "no underline on part titles");
assert.ok(/athlete-tab\.active\{[^}]*rgba\(232,69,26,\.16\)/.test(admin), "calm athlete tab active");
assert.ok(!/learn-toggle\.on\{[^}]*box-shadow:0 0 14px/.test(admin), "no neon glow on learning toggle");
assert.ok(admin.includes('lang="he"') && admin.includes('dir="rtl"'), "admin RTL Hebrew preserved");

// claim cosmetic only — handoff redirect logic intact
assert.ok(/family=Heebo/.test(claim), "claim Heebo");
assert.ok(claim.includes("/?tab=pprog&handoff=1"), "claim handoff redirect preserved");
assert.ok(claim.includes("window.location.replace"), "claim auto-redirect preserved");

assert.ok(/DAILY WORKOUTS · v21\.5\.1\b/.test(index), "app display version intact");
assert.ok(/DUCK-WOD Admin · 2\.0\.1/.test(admin), "admin UI version 2.0.1");
assert.ok(!/1\.0 beta/.test(admin), "admin no longer shows 1.0 beta");

console.log("admin-design-clarity.test.js: ok");
