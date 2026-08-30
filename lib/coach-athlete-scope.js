/**
 * Athlete span of control (POL-028).
 *
 * The athlete owns TODAY'S SESSION — alternatives, reps, sets, loads, a swapped
 * movement — through the box under the workout (`revise_day` / `revise_part`).
 *
 * The BRICK belongs to the human coach in the admin module. An athlete request may
 * not reshape the whole program by conversation: no whole-brick chat, no week
 * rewrite, no Soft Upgrade, no large rebuild.
 *
 * Two things stay open on purpose:
 *   - Intake. The opening conversation and the first brick it produces are how an
 *     athlete gets a plan at all.
 *   - Plan fills. generate_block / generate_week / generate_week_detail are machine
 *     steps that build or complete an already-approved brick — they are not the
 *     athlete talking the plan into a different shape. Their own guards still apply
 *     (POL-008 early-next-block, POL-COST caps).
 *
 * Enforced in the server, not the UI: hiding a button is not turning a thing off.
 */

/** Actions that rewrite more than one session. */
const BRICK_SCOPED_ACTIONS = {
  revise_week: true,
};

const ATHLETE_SCOPE_MSG =
  "Changes to your whole program are handled by your coach. " +
  "For today's session — reps, sets, loads, or a different movement — " +
  "use the box under the workout and I'll adjust it with you.";

/**
 * @param {string} action
 * @param {object} body
 * @returns {null | "week_rewrite" | "brick_chat" | "soft_upgrade" | "large_rebuild"}
 */
function brickScopeReason(action, body) {
  const a = String(action || "").toLowerCase();
  const b = body && typeof body === "object" ? body : {};
  if (BRICK_SCOPED_ACTIONS[a]) return "week_rewrite";
  if (b.brickChat === true || b.wholeProgramChat === true) return "brick_chat";
  if (b.softUpgrade === true) return "soft_upgrade";
  if (b.largeRebuild === true) return "large_rebuild";
  return null;
}

/** Intake is never blocked — it is how an athlete gets a plan in the first place. */
function isIntakePhase(body, profile) {
  const b = body && typeof body === "object" ? body : {};
  const p = profile && typeof profile === "object" ? profile : null;
  if (b.intakeComplete === true) return false;
  if (p && p.intakeComplete === true) return false;
  return true;
}

/**
 * @param {string} action
 * @param {object} body
 * @param {object|null} profile
 * @param {{ isAdmin?: boolean }} [opts]
 * @returns {null | { code: string, reason: string, error: string, text: string, chatShaped: boolean }}
 */
function evaluateAthleteScopeGate(action, body, profile, opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  /* The human coach in admin keeps full reach over the brick. */
  if (o.isAdmin === true) return null;
  const reason = brickScopeReason(action, body);
  if (!reason) return null;
  if (isIntakePhase(body, profile)) return null;
  return {
    code: "ATHLETE_SCOPE_BLOCKED",
    reason: reason,
    error: "Whole-program changes are coach-managed",
    text: ATHLETE_SCOPE_MSG,
    /* brick chat renders in the chat log; the rest are programmatic callers */
    chatShaped: reason === "brick_chat",
  };
}

module.exports = {
  evaluateAthleteScopeGate,
  brickScopeReason,
  isIntakePhase,
  ATHLETE_SCOPE_MSG,
  BRICK_SCOPED_ACTIONS,
};
