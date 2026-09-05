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
assert.ok(/DUCK-WOD Admin · 4\.3/.test(admin), "admin UI version 4.3");
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
/* There is ONE admin module — the owner has said so several times, most plainly on
   2026-09-01: "אין מודול לקוחות, אין חיה כזאת". A header button announcing another
   module was the last place that claim survived. The STRIP is the navigation now: it
   carries every client he manages, and clicking one opens them wherever he is. */
assert.ok(!/id="btn-client-programs"/.test(admin), "no link to a second 'module'");
assert.ok(/lib\/admin-people-strip\.js/.test(admin), "the strip is built by the shared builder");
assert.ok(/function renderPeopleStrip/.test(admin), "admin draws the unified strip");
/* The programmes are loaded by the client screen itself, which lives in this file now
   and hands its rows back through adminOnClientRows. One fetch, one owner. */
assert.ok(/window\.adminOnClientRows/.test(admin), "the screen hands its rows to the strip");
assert.ok(/window\.ClientScreen\.open\(id\)/.test(admin), "a programme chip opens in place");
assert.ok(!/location\.href = pagesAbsoluteUrl\("\/admin-clients/.test(admin), "and never travels to another page");

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

/* ------------------------------------------------------------------------
 * THE APPROVED LOOK IS NOT NEGOTIABLE, AND A SELECTOR CAN BREAK IT SILENTLY.
 *
 * The client screen arrived from a page that styled bare elements — button, input,
 * textarea, select, h2, p. Harmless while it had a page of its own. Scoped under
 * #clientScreen those became stronger than every class in the page (an id plus an
 * element outranks a class), so they painted the brick view's calendar cells, the
 * pencil, the delete link and the weekday rail solid brand orange. Nothing had been
 * redesigned; one selector had.
 *
 * The owner's rule, 2026-09-02: "יש לנו קו עיצובי שהוא גם פונקציונאלי והוא אושר — אתה
 * צריך לשמור עליו". This is that rule, mechanically: no bare-element selector may live
 * under #clientScreen, ever.
 * --------------------------------------------------------------------- */
const bareUnderScreen = (admin.match(/#clientScreen (?:button|input|textarea|select|h2|p|a|div|span|label)[\s{,:]/g) || [])
  .filter(function (hit) {
    /* A descendant selector is fine — "#clientScreen .card button" is scoped by the
       class in front of it. What is not fine is the element sitting directly under the
       id with nothing to narrow it. */
    return /#clientScreen (?:button|input|textarea|select|h2|p|a|div|span|label)[{,]/.test(hit);
  });
assert.ok(
  bareUnderScreen.length === 0,
  "no bare-element rule under #clientScreen — it would outrank the approved classes: " + bareUnderScreen.join(" ")
);

/* The screen's own plain controls still have to look like something, so the rule that
   used to be bare is now explicit about what it reaches. */
assert.ok(
  /#clientScreen button:not\(\[class\]\),/.test(admin),
  "the screen's plain buttons are styled by an opt-in selector"
);

/* And the parts of the approved look that were destroyed must still be reachable:
   the calendar cell, the day card, the athlete card and its controls. */
["\\.pprog-cal-cell\\{", "\\.pprog-day-card", "\\.ath-card\\{", "\\.ath-stats-btn\\{", "\\.btn-delete-link\\{"].forEach(
  function (needle) {
    assert.ok(new RegExp(needle).test(admin), "the approved look still defines " + needle);
  }
);

console.log("admin-design-clarity.test.js: ok");
