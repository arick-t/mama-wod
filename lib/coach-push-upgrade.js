/**
 * Admin → athlete "עדכון בדחיפה" (push upgrade offer).
 * Default: no athlete is updated on coach brain bump.
 * Admin may offer soft | remaining_rebuild for remaining brick days only.
 */
"use strict";

const MODES = {
  soft: "soft",
  remaining_rebuild: "remaining_rebuild",
};

function normalizeMode(raw) {
  const m = String(raw || "").trim().toLowerCase();
  if (m === "soft" || m === "soft_upgrade" || m === "level1") return MODES.soft;
  if (
    m === "remaining_rebuild" ||
    m === "full" ||
    m === "premium" ||
    m === "large" ||
    m === "rebuild"
  ) {
    return MODES.remaining_rebuild;
  }
  return null;
}

/** Semver-ish compare: a > b → 1; a < b → -1; equal → 0. */
function compareCoachVersions(a, b) {
  const pa = String(a || "0")
    .replace(/^v/i, "")
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map(function (n) {
      return parseInt(n, 10) || 0;
    });
  const pb = String(b || "0")
    .replace(/^v/i, "")
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map(function (n) {
      return parseInt(n, 10) || 0;
    });
  const len = Math.max(pa.length, pb.length, 1);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

function isCoachNewerThanPlan(liveCoachVersion, planCoachVersion) {
  const live = String(liveCoachVersion || "").trim();
  if (!live) return false;
  const plan = String(planCoachVersion || "").trim();
  if (!plan) return true; /* legacy brick — treat as older than shipped brain */
  return compareCoachVersions(live, plan) > 0;
}

function makeOfferId() {
  return (
    "pu_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8)
  );
}

function athleteMessage(mode, targetCoachVersion) {
  const ver = String(targetCoachVersion || "").replace(/^v/i, "") || "?";
  if (mode === MODES.soft) {
    return {
      he:
        "המאמן שודרג ל־v" +
        ver +
        ". לחץ כאן לעדכון סופט של האימונים שנותרו בלבנה.",
      en:
        "Coach upgraded to v" +
        ver +
        ". Tap to soft-update remaining workouts in this brick.",
    };
  }
  return {
    he:
      "המאמן שודרג ל־v" +
      ver +
      ". לחץ כאן לשכתוב מלא של האימונים שנותרו עד סוף הלבנה.",
    en:
      "Coach upgraded to v" +
      ver +
      ". Tap to fully rebuild remaining workouts through end of this brick.",
  };
}

function buildPendingOffer(opts) {
  opts = opts || {};
  const mode = normalizeMode(opts.mode);
  if (!mode) return null;
  const targetCoachVersion = String(opts.targetCoachVersion || "").trim().slice(0, 20);
  if (!targetCoachVersion) return null;
  const msg = athleteMessage(mode, targetCoachVersion);
  return {
    id: String(opts.id || makeOfferId()).slice(0, 40),
    mode: mode,
    targetCoachVersion: targetCoachVersion,
    status: "pending",
    createdAt: opts.createdAt || new Date().toISOString(),
    createdBy: "admin",
    messageHe: msg.he,
    messageEn: msg.en,
  };
}

function publicOffer(offer) {
  if (!offer || typeof offer !== "object") return null;
  if (String(offer.status || "") !== "pending") return null;
  return {
    id: String(offer.id || "").slice(0, 40),
    mode: normalizeMode(offer.mode),
    targetCoachVersion: String(offer.targetCoachVersion || "").slice(0, 20),
    status: "pending",
    createdAt: String(offer.createdAt || "").slice(0, 40),
    messageHe: String(offer.messageHe || "").slice(0, 280),
    messageEn: String(offer.messageEn || "").slice(0, 280),
  };
}

/** Prompt fragment for revise_week when applying an accepted admin push offer. */
function revisePromptForMode(mode, targetCoachVersion, israelToday) {
  const ver = String(targetCoachVersion || "").slice(0, 20);
  const today = String(israelToday || "").slice(0, 10);
  const base =
    "ADMIN PUSH UPGRADE (athlete accepted). Target coach v" +
    ver +
    ". Israel today=" +
    today +
    ". HARD: adapt ONLY remaining days from today through end of this brick; copy past days unchanged (POL-023). " +
    "Do NOT start a new brick. Do NOT emit full BLOCK_JSON for a fresh 5-week restart. ";
  if (mode === MODES.soft) {
    return (
      base +
      "MODE=soft: Soft Upgrade scan — propose and apply ≤3 surgical patches on remaining days " +
      "(active week ± next) using the latest coach brain (incl. POL-027 floor/BW baseline + additive gear). " +
      "Preserve formats/structure. Prefer small targeted changes."
    );
  }
  return (
    base +
    "MODE=remaining_rebuild: FULL rewrite of remaining training days only with the latest coach brain " +
    "(POL-016/018/027 quality). Keep Rest/schedule map unless unsafe. Past days locked."
  );
}

module.exports = {
  MODES: MODES,
  normalizeMode: normalizeMode,
  compareCoachVersions: compareCoachVersions,
  isCoachNewerThanPlan: isCoachNewerThanPlan,
  makeOfferId: makeOfferId,
  athleteMessage: athleteMessage,
  buildPendingOffer: buildPendingOffer,
  publicOffer: publicOffer,
  revisePromptForMode: revisePromptForMode,
};
