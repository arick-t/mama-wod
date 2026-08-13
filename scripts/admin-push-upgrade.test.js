/**
 * Admin push-upgrade offer ("עדכון בדחיפה") — remaining brick days only.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const Push = require("../lib/coach-push-upgrade");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

const admin = fs.readFileSync(path.join(__dirname, "..", "admin.html"), "utf8");
const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const snap = fs.readFileSync(
  path.join(__dirname, "..", "scripts/lib/admin/admin-snapshot.js"),
  "utf8"
);
const pc = fs.readFileSync(path.join(__dirname, "..", "api/personal-coach.js"), "utf8");
const caps = fs.readFileSync(path.join(__dirname, "..", "lib/coach-cost-caps.js"), "utf8");

ok("modes soft + remaining_rebuild", Push.normalizeMode("soft") === "soft");
ok(
  "premium maps to remaining_rebuild",
  Push.normalizeMode("premium") === "remaining_rebuild"
);
ok("compare newer", Push.compareCoachVersions("2.3.2", "2.3") > 0);
ok("empty plan is older", Push.isCoachNewerThanPlan("2.3.2", ""));
ok("same plan not newer", !Push.isCoachNewerThanPlan("2.3.2", "2.3.2"));
ok("build soft offer", Push.buildPendingOffer({ mode: "soft", targetCoachVersion: "2.3.2" }));
ok(
  "build full offer",
  Push.buildPendingOffer({ mode: "remaining_rebuild", targetCoachVersion: "2.3.2" }).mode ===
    "remaining_rebuild"
);
ok(
  "prompt remaining-only",
  /remaining days|ONLY remaining/i.test(
    Push.revisePromptForMode("remaining_rebuild", "2.3.2", "2026-08-11")
  )
);
ok(
  "prompt forbids new brick",
  /Do NOT start a new brick/i.test(Push.revisePromptForMode("soft", "2.3.2", "2026-08-11"))
);

ok("admin button label", admin.includes("עדכון בדחיפה"));
ok("admin soft option", admin.includes("עדכון סופט") && admin.includes("זול"));
ok("admin full option", admin.includes("שכתוב מלא") && admin.includes("יקר"));
ok("admin soft mode wiring", admin.includes("'soft'"));
ok("admin full mode wiring", admin.includes("'remaining_rebuild'"));
ok("admin push beside block title", admin.includes("ath-block-panel-head"));
ok("admin push head adjacent layout", /ath-block-panel-head\{[^}]*justify-content:\s*flex-start/.test(admin));
ok("admin version 2.0.1", /DUCK-WOD Admin · 2\.0\.1/.test(admin));
ok("admin shows Coach beside Admin", /Admin 2\.0\.1/.test(admin) && /Coach 2\.3\.13/.test(admin));
ok("old עדכן button removed", !admin.includes("btn-update-block"));
ok("push button bordered affordance", /btn-push-upgrade\{[^}]*border:\s*1px solid/.test(admin));
ok("admin sendPushUpgradeOffer", admin.includes("sendPushUpgradeOffer"));
ok("admin gate helper", admin.includes("getPushUpgradeGate"));
ok("admin action API", snap.includes('action === "admin_push_upgrade_offer"'));
ok("athlete pull API", snap.includes('action === "athlete_pull_push_offer"'));
ok("athlete resolve API", snap.includes('action === "athlete_resolve_push_offer"'));
ok("preserve pending on snapshot write", snap.includes("pendingPushUpgrade: existing.pendingPushUpgrade"));
ok("client pull helper", index.includes("pprogMaybePullPushUpgradeOffer"));
ok("client accept helper", index.includes("pprogAcceptPushUpgradeOffer"));
ok("client card html", index.includes("pprog-push-upgrade-card"));
ok("client sends offer id", index.includes("pushUpgradeOfferId"));
ok("personal-coach verifies offer", pc.includes("adminPushOfferVerified"));
ok("personal-coach push prompt", pc.includes("pushUpgradeMode"));
ok("cost caps respect admin push", caps.includes("adminPushOfferVerified"));
ok("no auto on version bump still in API", pc.includes("Never auto-rebuild because COACH_VERSION"));

console.log("All admin push-upgrade checks passed.");
