/**
 * Personal Coach — המאמן
 * POST /api/personal-coach
 *   { messages, athleteProfile?, action?: "chat"|"start_intake"|"generate_block"|"generate_week"|"generate_week_detail"|"revise_day"|"revise_week"|"day_debrief"|"revise_part"|"preview_month" }
 * GET  /api/personal-coach — status
 *
 * Coach version vocabulary (product):
 *   1.0 — programming brain before the learning-leap upgrade
 *   1.1 — upgraded brain (Foundation Brief / POL-021 / living-knowledge)
 *
 * Env: GEMINI_API_KEY (optional File Search), GROQ_API_KEY (fallback chat),
 *      PERSONAL_COACH_MODEL (programming), PERSONAL_COACH_CHAT_MODEL (chat/intake),
 *      GEMINI_FILE_SEARCH_STORE, GROQ_MODEL
 *
 * Provider order: Gemini generateContent (optional File Search) → Groq Chat Completions.
 * Interactions is opt-in only (preferInteractions) — dual-path billing is disabled by default.
 * Groq keeps chat alive when the Gemini key is missing/invalid (common GitHub Pages + Vercel setup).
 * Programming stays Gemini-only (POL-020).
 */
const COACH_VERSION = "1.1";
const HAMAMEN_SYSTEM = require("./hamamen-prompt.js");
const COACH_POLICY = require("./coach-policy.js");
const COACH_FOUNDATION_BRIEF = require("./coach-foundation-brief.js");
/* Legacy alias — foundation brief supersedes pattern-only brief */
const COACH_PATTERN_BRIEF = COACH_FOUNDATION_BRIEF;
const { checkRateLimit, sendRateLimit } = require("./rate-limit.js");
const { scrubMessages, scrubProfile, scrubPiiText } = require("./sanitize-pii.js");
/* Admin dashboard — optional coach directives from admin snapshots */
let getCoachDirectives = function () {
  return "";
