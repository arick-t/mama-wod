/**
 * Admin athlete ops card — decluttered identity + block update + chat history.
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
assert.ok(admin.includes("btn-freeze-mini"), "mini freeze on register row");
assert.ok(admin.includes("הצהרה הבאה"), "declaration fact");
assert.ok(admin.includes("ath-stats-btn"), "stats chevron by name");
assert.ok(admin.includes("renderAthleteStatsPop"), "stats popover");
assert.ok(!admin.includes("btn-update-block"), "old עדכן handoff button removed");
assert.ok(!admin.includes("pushBlockUpdateToAthlete"), "old update-to-phone handler removed");
assert.ok(!admin.includes("עדכון בדחיפה"), "push upgrade button removed");
assert.ok(!admin.includes("btn-push-upgrade"), "push upgrade button class removed");
assert.ok(!admin.includes("sendPushUpgradeOffer"), "push upgrade send removed from admin UI");
assert.ok(admin.includes("סונכרן"), "green synced label");
assert.ok(admin.includes("adminBlockSyncStatus"), "auto-sync status helper");
assert.ok(admin.includes("ath-block-panel-head"), "block panel head");
assert.ok(admin.includes("היסטוריית שיח מול המאמן"), "chat history section");
assert.ok(admin.includes("admin-chat-fab"), "athlete-scoped chat FAB");
assert.ok(!/ath-fact-label">בלוק:/.test(admin), "block fact removed from card grid");
assert.ok(!admin.includes("ath-id-line"), "internal id line removed from card");
assert.ok(!admin.includes('renderAccItem(\n          "handoff"'), "handoff accordion gone");
assert.ok(!admin.includes('renderAccItem(\n          "intake"'), "intake accordion gone from main");
assert.ok(!admin.includes('renderAccItem(\n          "history"'), "usage accordion gone from main");
assert.ok(admin.includes("openIntakeSheet"), "intake opens from stats popover");
assert.ok(snap.includes('action === "admin_append_chat"'), "chat log API");
assert.ok(snap.includes("adminChatLog"), "persist chat log");
assert.ok(snap.includes('action === "admin_push_upgrade_offer"'), "push upgrade offer API");
assert.ok(/DUCK-WOD Admin . 4\.1\.1/.test(admin), "admin product label 4.1");
/* The brain's version belongs HERE and only here: this is where it is the number that
   matters, and the owner asked for it to stay when it left the app (2026-09-03). */
assert.ok(/Admin 4\.1\.1/.test(admin) && /Coach 2\.3\.14/.test(admin), "admin shows Admin + Coach versions");
/* The visible logout came out on the owner's instruction (2026-09-01): he is the only
   person who opens this and there is no scenario in which he logs out. The FORCED
   logout on a 401 stays — that one is not a control, it is what happens when the
   server says the session is over. */
assert.ok(!/onclick="adminLogout\(\)"/.test(admin), "no logout button in the header");
assert.ok(admin.includes("forceAdminLogout"), "a dead session still ends itself");
assert.ok(!admin.includes("חבר מאמן"), "coach member chip removed");
assert.ok(admin.includes("renderHandoffInline"), "compact handoff in card");
assert.ok(admin.includes("הצהרה לא בתוקף"), "invalid declaration note");
assert.ok(!admin.includes("ath-handoff-panel"), "large handoff panel removed");
assert.ok(/intake-modal\.open/.test(admin), "FAB hidden while intake open");

console.log("admin-athlete-ops-card.test.js: ok");
