/**
 * Admin athlete ops card — identity facts + accordion structure (display).
 */
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const admin = fs.readFileSync(path.join(__dirname, "..", "admin.html"), "utf8");
const snap = fs.readFileSync(
  path.join(__dirname, "..", "scripts/lib/admin/admin-snapshot.js"),
  "utf8"
);

assert.ok(admin.includes("ath-card"), "identity card class");
assert.ok(admin.includes("ath-acc-item"), "accordion item");
assert.ok(admin.includes("toggleAthleteAcc"), "accordion toggle");
assert.ok(admin.includes("btn-freeze-mini"), "mini freeze on register row");
assert.ok(admin.includes("הצהרה הבאה"), "declaration fact");
assert.ok(admin.includes("getDeclarationInfo"), "declaration helper");
assert.ok(admin.includes("openHandoffFromCard"), "handoff from card");
assert.ok(admin.includes("renderAccItem"), "accordion renderer");
assert.ok(admin.includes("admin-chat-fab"), "athlete-scoped chat FAB");
assert.ok(admin.includes("syncAthleteChatFab"), "FAB syncs to selected athlete");
assert.ok(!admin.includes("renderStickyNotesSection"), "inline sticky notes removed");
assert.ok(!admin.includes("renderDayNotesBox"), "block day notes box removed");
assert.ok(!admin.includes("תחקור ראשוני (לחץ להרחבה)"), "old flat intake summary gone");
assert.ok(snap.includes('action === "admin_member_status"'), "member status API");
assert.ok(snap.includes("membershipFrozen"), "persist freeze flag");
assert.ok(admin.includes("DUCK-WOD Admin · 1.2.1"), "admin product label 1.2.1");

console.log("admin-athlete-ops-card.test.js: ok");
