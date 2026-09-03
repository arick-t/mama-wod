/**
 * LAYER 2 — Continuation. Fires only when this is NOT the first brick.
 *
 * Why it exists (2026-09-03): POL-009 is a HARD rule requiring the next brick to be built from a
 * compact handoff of the previous one — themes, strength progression by weekday, formats used,
 * deload intent, athlete modifications — rather than from the full prior BLOCK_JSON. The plumbing
 * already worked end to end: index.html builds the handoff (buildPprogBlockHandoff) and sends it as
 * blockHandoff, and api/personal-coach.js injects it as "PRIOR BRICK HANDOFF". What was missing was
 * any instruction about what to DO with one. Nothing in thirteen layers mentioned a previous block,
 * and the router could not tell brick 2 from brick 1, so brick 2 received brick 1's instructions
 * exactly.
 *
 * THE OWNER RESET ITS PRIORITY, and the layer is written around his sentence rather than around the
 * handoff mechanics: "חשוב מאוד שלא יהיו 2 לבנות זהות אחרת אין התקדמות לעולם, כל הרעיון הוא שהמעבר
 * בין לבנה ללבנה הוא גם התקדמות של המתאמן." The brick-to-brick transition IS the progression the
 * athlete is paying for. So "do not repeat the previous month" is not one bullet among four here —
 * it is the headline, and everything else supports it.
 *
 * AND IT APPLIES HARDER TO A STUDIO, not more softly — the owner, same conversation: "התקדמות בין
 * לבנות רלוונטי לכל תוכנית באשר היא, גם לסטודיואים צריכה להיות התקדמות... דמיין מישהו שמגיע כל
 * חודש לאותו אימון בסטודיו - זה משעמם ולא אפקטיבי!!" A room has no 1RM to move, so its
 * progression axis is the FORMAT and the STRUCTURE rather than the load. And a person in a class
 * cannot ask for a revision the way a single athlete can, so nobody will report the repetition.
 *
 * The failure this guards is invisible on inspection: same packet, same layers, same knowledge, and
 * an athlete who changed nothing in their intake. A repeated month looks like a perfectly good
 * brick. Nobody reading the output can tell it is the second copy — which is exactly why the rule
 * has to be stated to the model rather than caught in review.
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
  "TWO IDENTICAL BRICKS ARE A PRODUCT FAILURE. The move from one brick to the next IS the athlete's\n" +
  "progression — it is the thing they are paying for. A month that repeats the last one means they\n" +
  "stood still, and it will look like a perfectly good brick to everyone who reads it.\n" +
  "\n" +
  "AN UNCHANGED INTAKE IS NOT PERMISSION TO REPEAT. If the athlete changed nothing, that means the\n" +
  "same constraints — the same days, the same equipment, the same limits. It does not mean the same\n" +
  "sessions. Constraints repeat; work does not.\n" +
  "\n" +
  "SAY WHAT MOVED. The brick's theme and summary must name what advanced since the last one, in the\n" +
  "reader's own terms: heavier, denser, longer, a harder version of a movement, or a shape they have\n" +
  "  not trained before. If you cannot\n" +
  "name what progressed, you have not written a continuation.\n" +
  "\n" +
  "PROGRESS ON ONE AXIS AT A TIME, never all of them at once:\n" +
  "- LOAD — the next rung of the same scheme, from where the handoff leaves it. Not a fresh start at\n" +
  "  the bottom, and not a jump you have no evidence for.\n" +
  "- DENSITY — the same work in less time, or more work in the same time.\n" +
  "- VOLUME — more total work at the same intensity.\n" +
  "- COMPLEXITY — the next step of a progression: strict to kipping, power to full catch, assisted\n" +
  "  to unassisted, a shorter lever to a longer one.\n" +
  "- FORMAT AND STRUCTURE — the same qualities met through a different shape: intervals where it\n" +
  "  was an AMRAP, a chipper where it was a couplet, a partner structure where it was solo.\n" +
  "Choose the axis the stated goal points at. Raising two at once is how a brick becomes too hard\n" +
  "to complete.\n" +
  "\n" +
  "FOR A STUDIO THIS MATTERS MORE, NOT LESS (HARD):\n" +
  "A room has no 1RM to move, so FORMAT AND STRUCTURE are its progression — the same fitness\n" +
  "qualities reached through shapes the room has not met yet. Someone who walks into the same\n" +
  "session every month is bored and is not improving, and unlike a single athlete they have no way\n" +
  "to ask you to change it. Nobody will report this failure. Do not produce it.\n" +
  "Progress the room by rotating formats, by the structures in the room layer, and by raising the\n" +
  "standard of what a session asks for — never by quietly reprinting last month with new numbers.\n" +
  "\n" +
  "WHAT STAYS THE SAME:\n" +
  "- The weekday keeps its modality. Predictability is the point of that; the WORK is what changes.\n" +
  "- A change they asked for in the last block is STILL IN FORCE. It does not expire with the block,\n" +
  "  and they should not have to ask twice.\n" +
  "- DO NOT REPEAT A NAMED FORMAT the handoff says was already used, unless it is a benchmark being\n" +
  "  retested on purpose — and then say in the session that this is a retest.\n" +
  "\n" +
  "IF NO HANDOFF IS GIVEN, DO NOT INVENT ONE. Do not guess what they trained last month and do not\n" +
  "claim a continuity you cannot see. Build from the intake, progress the axis their goal names, and\n" +
  "pitch the loaded work at a level they can confirm rather than at a number you assumed.\n" +
  "\n" +
  "NEVER RESTART INTAKE. Their age, their equipment and their goals are already answered. Do not\n" +
  "re-ask them, and do not open with a recap of who they are.\n";
