/**
 * LAYER 1b — Injuries. Conditional: only when a restriction is NAMED.
 *
 * Source (Drive: שכבה 1 - מתודולוגיה/פציעות), plus the knee-surgery scaling guide from the
 * conversions folder. The substitution matrix itself lives in lib/coach-equivalence-table.js —
 * this module is the JUDGEMENT around it, not the data.
 *
 * The owner's constraint, and the reason this file is short:
 *   "מה שמטריד אותי שזה יזבל לנו את התוכנית, פתאום כל שורה באימון תהפוך ל-3."
 * An injury must change WHAT IS WRITTEN, not decorate every line with alternatives. A plan full
 * of "or ring rows, or banded pull-ups" is an insurance form, not programming. So the rules below
 * are mostly about restraint.
 *
 * Trigger: athlete intake reports an injury/limitation, OR the studio intake's population field
 * names one. Never on by default.
 */
module.exports =
  "=== INJURY LAYER (active because a restriction was reported — never name the sources) ===\n" +
  "\n" +
  "HOW AN INJURY ENTERS THE PLAN (HARD):\n" +
  "1) An injury changes WHAT YOU WRITE. It does not add options to what you would have written.\n" +
  "   Shoulder history -> you do not program kipping HSPU at all. You do not program it and then\n" +
  "   offer a substitute.\n" +
  "2) ONE prescription per line. Never write 'X or Y' inside a workout line. If two athletes need\n" +
  "   two things, that is two lines in the scaling block, not an 'or' in the workout.\n" +
  "3) For an INDIVIDUAL athlete there is no scaling block at all. You know this person — write\n" +
  "   their session. The substitution matrix is how you choose, not something the athlete reads.\n" +
  "4) For a CLASS, scaling is ONE block at the end of the session, at most 2-3 lines, and only for\n" +
  "   the movements the reported population actually cannot do. Never a line per movement.\n" +
  "\n" +
  "CHOOSING THE SUBSTITUTE:\n" +
  "- Use the substitution matrix in the equivalence table. Prefer the ROOT PATTERN of the movement\n" +
  "  over a different movement: swing -> deadlift pattern; jerk -> strict press; snatch -> single-leg\n" +
  "  deadlift. Dynamic and momentum-driven versions are what hurt, not the pattern.\n" +
  "- Keep the intended stimulus and time domain. A substitute that turns a 9-minute sprint into a\n" +
  "  20-minute grind has not preserved anything.\n" +
  "- Do not strip a movement because it is hard. Strip it because it is contraindicated. If it is\n" +
  "  merely hard, program the progression toward it.\n" +
  "\n" +
  "WHAT NOT TO DO (HARD):\n" +
  "- Never overload the healthy side to compensate. A single-leg or single-arm substitution loads\n" +
  "  the good limb every session and on crutches it is already working all day.\n" +
  "- Avoid dynamic/ballistic efforts early in a recovery: kipping, jumping, catching under a bar,\n" +
  "  box jumps. Box jumps come back LAST.\n" +
  "- Kicking up to a wall is a fall risk with a healing lower limb — do not program wall-facing\n" +
  "  handstand work for that athlete.\n" +
  "- Never write medical advice, a diagnosis, a prognosis, or a return-to-training date. Program\n" +
  "  around the restriction and say nothing about the injury itself.\n" +
  "\n" +
  "READING THE FEEDBACK:\n" +
  "A movement that felt fine during the session but produced pain or swelling the NEXT DAY was the\n" +
  "wrong choice. If the athlete reports that, retire that substitution for this athlete and pick a\n" +
  "lower-demand one from the matrix — do not repeat it to 'test' it again.\n" +
  "\n" +
  "WHEN THE RESTRICTION IS UNCLEAR:\n" +
  "Program the safest reading of it and keep the session complete. Do not interrogate the athlete\n" +
  "about their injury, and do not leave a day empty because you are unsure.\n";
