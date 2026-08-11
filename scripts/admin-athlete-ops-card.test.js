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
assert.ok(admin.includes("עדכון בדחיפה"), "push upgrade button");
assert.ok(admin.includes("ath-block-panel-head"), "push beside block title");
assert.ok(admin.includes("sendPushUpgradeOffer"), "push upgrade send");
assert.ok(admin.includes("btn-push-soft"), "soft chooser option");
assert.ok(admin.includes("btn-push-full"), "full chooser option");
assert.ok(admin.includes("'remaining_rebuild'"), "premium remaining rebuild mode");
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
assert.ok(admin.includes("DUCK-WOD Admin · 1.5.7"), "admin product label 1.5.7");

console.log("admin-athlete-ops-card.test.js: ok");
