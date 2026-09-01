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

/* The header version is how the owner verifies a deploy actually landed, so the
   real invariant is that it tracks VERSION — not that it equals a literal that
   goes stale every release (docs/VERSIONING.md). */
const VERSION = fs.readFileSync(path.join(__dirname, "..", "VERSION"), "utf8").trim();
assert.ok(
  index.includes("DAILY WORKOUTS · v" + VERSION),
  "app header version must match VERSION (" + VERSION + ")"
);
assert.ok(
  index.includes("<title>DUCK-WOD · v" + VERSION + "</title>"),
  "app <title> version must match VERSION (" + VERSION + ")"
);
assert.ok(/DUCK-WOD Admin · 3\.0\.2/.test(admin), "admin UI version 3.0.2");
assert.ok(!/1\.0 beta/.test(admin), "admin no longer shows 1.0 beta");

/* ------------------------------------------------------------------------
 * The header, as the owner specified it on 2026-09-01.
 *
 * He read the live header out loud and named what survives: the logo, the versions,
 * how many athletes, the credit estimate, and "+ לקוח". Everything else was a control
 * he does not use — and the learning ground was a feature he decided will not become
 * useful, so it is switched off at the source rather than left as a switch nobody
 * touches.
 * --------------------------------------------------------------------- */
assert.ok(/class="logo">DUCK-WOD</.test(admin), "the logo stays");
assert.ok(/id="admin-ver-badge"/.test(admin), "the versions stay");
assert.ok(/id="athlete-count"/.test(admin), "the athlete count stays");
assert.ok(/id="btn-credit-estimate"/.test(admin), "the credit estimate stays");
assert.ok(/id="btn-add-athlete"/.test(admin), "adding a client stays");
assert.ok(/id="btn-client-programs"/.test(admin), "the clients page link stays");

assert.ok(!/<span class="tagline">Admin<\/span>/.test(admin), "the word Admin beside the logo is gone");
assert.ok(!/id="btn-sync-drive"/.test(admin), "the drive-sync button is gone");
assert.ok(!/onclick="refreshAdmin\(\)"/.test(admin), "the refresh button is gone");
assert.ok(!/onclick="adminLogout\(\)"/.test(admin), "the logout button is gone");

/* The learning ground: switch, banner, and every function that could turn it on. */
assert.ok(!/id="learn-toggle"/.test(admin), "the learning toggle is gone");
assert.ok(!/id="learn-banner"/.test(admin), "its banner is gone");
assert.ok(!/function toggleLearningMode/.test(admin), "nothing can turn it on any more");
assert.ok(!/dw_admin_learning_mode/.test(admin), "it is not remembered between visits");
assert.ok(!/מגרש לימוד/.test(admin), "the note box has one wording");

/* What was deliberately NOT deleted, so a later reader knows it was a decision:
   the weekly Drive digest (the button went, not the capability) and the sandbox
   endpoint, which belongs to the coach-brain work running separately. */
assert.ok(fs.existsSync(path.join(__dirname, "..", "scripts", "coach-weekly-patterns-digest.js")), "the drive sync capability itself is untouched");

console.log("admin-design-clarity.test.js: ok");
