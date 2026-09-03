/**
 * LAYER 2 — Continuation. Fires only when this is NOT the first brick.
 *
 * Why it exists (2026-09-03): POL-009 is a HARD rule requiring the next brick to be built from a
 * compact handoff of the previous one — themes, strength progression by weekday, formats used,
 * deload intent, athlete modifications — rather than from the full prior BLOCK_JSON. The plumbing
 * for it already works end to end: index.html builds the handoff (buildPprogBlockHandoff) and
 * sends it as blockHandoff, and api/personal-coach.js injects it as "PRIOR BRICK HANDOFF".
 *
 * What was missing is this file. Not one of the thirteen layers said what to DO with a handoff, and
 * the router did not know a continuation from a first brick — so brick 2 received brick 1's
 * instructions exactly. The two predictable failures are re-serving last month or inventing a
 * progression from nothing, and both are addressed here.
 *
 * The no-handoff branch is not defensive padding: the handoff is only attached on the automatic
 * next-block path, so an admin-triggered rebuild can reach the coach with the block index set and
 * no history behind it.
 *
 * Note the server caps the handoff at 12,000 characters and truncates silently. POL-009 already
 * requires it to be compact, so that cap should never be reached — if a handoff ever arrives
 * truncated mid-structure, the fix is on the sending side, not here.
 */
module.exports =
  "--- THIS IS NOT THE FIRST BRICK (HARD) ---\n" +
  "This athlete or room has already trained a block. A handoff of it may be given: themes, what\n" +
  "progressed on which weekday, the formats already used, the deload, and anything they asked to\n" +
  "change. Read it and PROGRAM FORWARD FROM IT.\n" +
  "- DO NOT RE-SERVE THE PREVIOUS BLOCK. The weekday keeps its modality; the work is new.\n" +
  "- PROGRESS THE LOADED WORK from where the handoff leaves it — the next scheme in the\n" +
  "  progression, not a fresh start at the bottom of it.\n" +
  "- DO NOT REPEAT A NAMED FORMAT the handoff says was already used, unless it is a benchmark being\n" +
  "  retested on purpose — and then say in the session that this is a retest.\n" +
  "- A CHANGE THEY ASKED FOR IN THE LAST BLOCK IS STILL IN FORCE. It does not expire with the\n" +
  "  block, and they should not have to ask twice.\n" +
  "- IF NO HANDOFF IS GIVEN, DO NOT INVENT ONE. Do not guess what they trained last month and do\n" +
  "  not claim a continuity you cannot see. Build from the intake, and pitch the loaded work at a\n" +
  "  level they can confirm rather than at a number you assumed.\n" +
  "- NEVER RESTART INTAKE. Their age, their equipment and their goals are already answered. Do not\n" +
  "  re-ask them, and do not open with a recap of who they are.\n";
