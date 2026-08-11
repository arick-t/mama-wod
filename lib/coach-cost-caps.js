/**
 * POL-COST hard gate — code-level stop for generate_* / revise_* after caps.
 * Full policy text lives in coach-policy (POL-COST-001..010).
 */
const DAILY_CAP = 2;
const MONTHLY_CAP = 40;
const LARGE_REBUILD_WINDOW_DAYS = 7;

const PROGRAMMING_ACTIONS = {
  generate_block: true,
  generate_week: true,
  generate_week_detail: true,
  revise_day: true,
  revise_week: true,
  revise_part: true,
  /* Done-threshold surgical bias — not a daily programmed-edit; still Gemini quality. */
  finish_micro_bias: true,
};

function israelDaysBetween(a, b) {
  try {
    const pa = String(a || "").slice(0, 10).split("-");
    const pb = String(b || "").slice(0, 10).split("-");
    const da = Date.UTC(parseInt(pa[0], 10), parseInt(pa[1], 10) - 1, parseInt(pa[2], 10));
    const db = Date.UTC(parseInt(pb[0], 10), parseInt(pb[1], 10) - 1, parseInt(pb[2], 10));
    return Math.round((db - da) / 86400000);
  } catch (e) {
    return 999;
  }
}

function mergeCostState(profile, body) {
  const fromProfile =
    profile && profile.costCaps && typeof profile.costCaps === "object" ? profile.costCaps : {};
  const fromBody = body && body.costCaps && typeof body.costCaps === "object" ? body.costCaps : {};
  return Object.assign({}, fromProfile, fromBody);
}

function dailyCountForSession(state, sessionDate) {
  const sd = String(sessionDate || "").slice(0, 10);
  const map = state.dailyEdits && typeof state.dailyEdits === "object" ? state.dailyEdits : null;
  if (sd && map && map[sd] != null) return map[sd] | 0;
  if (sd && typeof state.dailyEditsForSession === "number" && String(state.sessionDate || "").slice(0, 10) === sd) {
    return state.dailyEditsForSession | 0;
  }
  if (sd && String(state.israelToday || "").slice(0, 10) === sd && typeof state.dailyEditsToday === "number") {
    return state.dailyEditsToday | 0;
  }
  if (state.dailyLocked === true && (!sd || sd === String(state.sessionDate || "").slice(0, 10))) {
    return DAILY_CAP;
  }
  return 0;
}

function isLargeRebuildLocked(state, todayIso) {
  if (state.largeRebuildLocked === true) return true;
  const last = state.lastLargeRebuildAt ? String(state.lastLargeRebuildAt).slice(0, 10) : "";
  if (!last) return false;
  const today = String(todayIso || state.israelToday || "").slice(0, 10);
  if (!today) return false;
  const days = israelDaysBetween(last, today);
  return days >= 0 && days < LARGE_REBUILD_WINDOW_DAYS;
}

/**
 * @returns {null | { code: string, error: string, hint: string, [key: string]: any }}
 */
function evaluateCostCapGate(action, body, profile, opts) {
  const a = String(action || "").toLowerCase();
  if (!PROGRAMMING_ACTIONS[a]) return null;

  const adminPush = !!(opts && opts.adminPushOfferVerified);
  const state = mergeCostState(profile, body);
  const today =
    String((body && body.israelToday) || state.israelToday || "").slice(0, 10) || "";

  const monthlyUsed =
    typeof state.monthlyUnitsUsed === "number"
      ? state.monthlyUnitsUsed
      : state.monthlyLocked === true
        ? MONTHLY_CAP
        : 0;
  const monthlyCap = typeof state.monthlyCap === "number" ? state.monthlyCap : MONTHLY_CAP;
  if (state.monthlyLocked === true || monthlyUsed >= monthlyCap) {
    return {
      code: "COST_CAP_MONTHLY",
      error: "Monthly programming envelope reached",
      hint:
        "Your plan stays visible. Safety and technique questions via chat only until next month — no new generate/revise.",
      monthlyUnitsUsed: monthlyUsed,
      monthlyCap: monthlyCap,
    };
  }

  /* Lazy week fills + first/next brick builds are allowed under daily/large/soft (monthly still wins). */
  const allowFill =
    a === "generate_week_detail" ||
    a === "generate_week" ||
    a === "finish_micro_bias" ||
    (a === "generate_block" &&
      body &&
      (body.autoNextBlock === true || body.intakeComplete === true) &&
      body.largeRebuild !== true &&
      body.midBrickRebuild !== true);

  if (allowFill) return null;

  if (a === "generate_block" && body && (body.largeRebuild === true || body.midBrickRebuild === true)) {
    if (!adminPush && isLargeRebuildLocked(state, today)) {
      return {
        code: "COST_CAP_LARGE",
        error: "Large rebuild cap reached",
        hint:
          "Large rebuild (B) is limited to once per 7 Israel days. Use surgical day/part edits, or wait until " +
          String(state.largeRebuildUnlockOn || "the window opens") +
          ".",
        largeRebuildUnlockOn: state.largeRebuildUnlockOn || null,
      };
    }
  }

  if (a === "revise_day" || a === "revise_part") {
    if (!adminPush) {
      const sessionDate = String(
        (body && body.sessionDate) || state.sessionDate || today || ""
      ).slice(0, 10);
      const count = dailyCountForSession(state, sessionDate);
      if (count >= DAILY_CAP) {
        return {
          code: "COST_CAP_DAILY",
          error: "Daily programmed-edit cap reached for this session",
          hint:
            "This training day is locked after 2 programmed edits. I can save a preference for later. Safety/technique → coach chat (no plan JSON).",
          sessionDate: sessionDate || null,
          dailyEdits: count,
          dailyCap: DAILY_CAP,
        };
      }
    }
  }

  if (a === "revise_week") {
    if (!adminPush && body && body.softUpgrade === true && state.softUpgradeUsedForBrick === true) {
      return {
        code: "COST_CAP_SOFT",
        error: "Soft Upgrade already used for this brick",
        hint: "One Soft Upgrade per brick. Further changes stay surgical day/part only.",
      };
    }
    if (!adminPush && body && body.largeRebuild === true && isLargeRebuildLocked(state, today)) {
      return {
        code: "COST_CAP_LARGE",
        error: "Large rebuild cap reached",
        hint:
          "Large rebuild (B) is limited to once per 7 Israel days. Prefer surgical edits on remaining days.",
        largeRebuildUnlockOn: state.largeRebuildUnlockOn || null,
      };
    }
    if (!adminPush) {
      const weekSession = String((body && body.israelToday) || today || "").slice(0, 10);
      const weekCount = dailyCountForSession(state, weekSession);
      if (weekSession && weekCount >= DAILY_CAP) {
        return {
          code: "COST_CAP_DAILY",
          error: "Daily programmed-edit cap reached",
          hint:
            "Programmed-edit cap (2) reached for this Israel day. Notes/preferences only — no week rewrite JSON.",
          sessionDate: weekSession,
          dailyEdits: weekCount,
          dailyCap: DAILY_CAP,
        };
      }
    }
  }

  return null;
}

function costCapHttpPayload(gate) {
  if (!gate) return null;
  return {
    ok: false,
    error: gate.error,
    code: gate.code,
    hint: gate.hint,
    sessionDate: gate.sessionDate || undefined,
    dailyEdits: gate.dailyEdits,
    dailyCap: gate.dailyCap,
    monthlyUnitsUsed: gate.monthlyUnitsUsed,
    monthlyCap: gate.monthlyCap,
    largeRebuildUnlockOn: gate.largeRebuildUnlockOn || undefined,
  };
}

module.exports = {
  DAILY_CAP,
  MONTHLY_CAP,
  LARGE_REBUILD_WINDOW_DAYS,
  evaluateCostCapGate,
  costCapHttpPayload,
  mergeCostState,
  dailyCountForSession,
  isLargeRebuildLocked,
};
