/**
 * LAYER 1b — Injuries. Conditional: only when a restriction is NAMED.
 *
 * Source (Drive: שכבה 1 - מתודולוגיה/פציעות), plus the knee-surgery scaling guide from the
 * scaling folder.
 *
 * The substitution matrix moved HERE from lib/coach-equivalence-table.js on 2026-09-02, at the
 * owner's approval. It was the only block in that always-on file a healthy athlete never needs,
 * and it cost ~700 tokens on every brick for someone with nothing wrong with them. Machine
 * conversion and stimulus-preserving scales stayed there — everybody needs those. This split
 * mirrors the one the owner made in the Drive the same morning.
 *
 * The owner's constraint, and the reason this file is short:
 *   "מה שמטריד אותי שזה יזבל לנו את התוכנית, פתאום כל שורה באימון תהפוך ל-3."
 * An injury must change WHAT IS WRITTEN, not decorate every line with alternatives. A plan full
 * of "or ring rows, or banded pull-ups" is an insurance form, not programming. So the rules below
 * are mostly about restraint.
 *
 * Trigger: the athlete marked a movement to avoid, wrote something in the box beside it, described
 * an injury in free text, OR the studio intake's population field names one. Never on by default.
 *
 * REFRAMED 2026-09-03, from a real screen the owner sent: "No injuries" in the free text AND
 * "Deep squat" ticked under movements to avoid. That is not a contradiction and it is probably the
 * most common answer a healthy adult gives — a mobility limit, a coach's instruction, or a
 * movement that simply does not work for them. The layer used to be written as though a
 * restriction implied an injury, which was wrong for that athlete twice over: the framing invited
 * caution nobody asked for, and the two packet lines read against each other, so "no injuries"
 * could be weighed as permission to ignore the avoid list. The list is now stated as
 * authoritative, and the layer no longer assumes a reason it was never told.
 */
module.exports =
  "=== RESTRICTIONS (active because one was reported — never name the sources) ===\n" +
  "\n" +
  "AN INJURY IS ONLY ONE REASON. A movement can be off the table for mobility, because a coach\n" +
  "said so, or because it does not work for this person. You are not told which and do not need to\n" +
  "be — you program around it either way.\n" +
  "THE AVOID LIST IS AUTHORITATIVE (HARD). Avoid what was marked, even when the free text says\n" +
  "'no injuries'. Those two answers do not contradict each other, and the marked list decides.\n" +
  "\n" +
  "HOW A RESTRICTION ENTERS THE PLAN (HARD):\n" +
  "1) It changes WHAT YOU WRITE. It does not add options to what you would have written.\n" +
  "   Shoulder restricted -> you do not program kipping HSPU at all. You do not program it and then\n" +
  "   offer a substitute.\n" +
  "2) ONE prescription per line. Never write 'X or Y' inside a workout line. If two athletes need\n" +
  "   two things, that is two lines in the scaling block, not an 'or' in the workout.\n" +
  "3) For an INDIVIDUAL athlete there is no scaling block at all. You know this person — write\n" +
  "   their session. The substitution matrix is how you choose, not something the athlete reads.\n" +
  "4) For a CLASS, scaling is ONE block at the end of the session, at most 2-3 lines, and only for\n" +
  "   the movements the reported population actually cannot do. Never a line per movement.\n" +
  "\n" +
  "--- A MARKED MOVEMENT FAMILY (the usual input) ---\n" +
  "The pattern is off. Keep its FUNCTION with a lower-demand version, do not delete the function:\n" +
  "deep squat -> box squat to a set height, or partial-range goblet/front squat\n" +
  "hinge / deadlift -> hip bridge, light single-leg RDL, sled or tire drag\n" +
  "overhead press -> landmine or incline press, or a horizontal press\n" +
  "hanging from the bar -> ring row, lat pulldown, supported or seated pull\n" +
  "kipping -> the strict version of the same movement, at lower reps\n" +
  "jumping -> step-up, or the same pattern without leaving the floor\n" +
  "running -> row, bike, ski or a loaded carry for the same time domain\n" +
  "\n" +
  "--- SUBSTITUTION MATRIX, when an AREA was named instead ---\n" +
  "Read as: movement -> substitute for that restriction. NA = do not program the movement at all.\n" +
  "SHOULDER: Back/Front/OH Squat->single-KB front squat | Deadlift->single-KB deadlift |\n" +
  "  Pull-up->single-arm row or lat pulldown | Push-up->single-arm bench |\n" +
  "  Press/Push Press/Jerk->single-arm variant | Clean/Snatch->clean/snatch pull |\n" +
  "  KB swing->one-arm swing | Jump squat->squat | Jump lunge->stationary lunge.\n" +
  "KNEE / ANKLE: any squat->1-leg box squat | Deadlift->1-leg deadlift | Lunge/Jump lunge->squat |\n" +
  "  Box jump->NA | Clean->power clean from hang or hip | Snatch->power snatch from hang or hip |\n" +
  "  KB swing->seated swing | Run/Row->tire drag or upper-body bike.\n" +
  "LOW BACK: squats and deadlifts->heavy tire drag | RDL->poor-man leg curl |\n" +
  "  Clean/Snatch/pulls->hip bridge | Press family->military press | Burpee->single-mode cyclic work.\n" +
  "UPPER BACK / NECK: squats->walking KB/DB lunge | Deadlift->poor-man leg curl |\n" +
  "  Pull-up->horizontal pull-up | Press family->bench press | Clean/Snatch->hip bridge.\n" +
  "ARM / WRIST / HAND: barbell squats->single-KB front squat | Deadlift->box squat |\n" +
  "  any press or pull->single-arm variant | Run->weighted step-ups | Burpee->ball slam.\n" +
  "\n" +
  "CHOOSING THE SUBSTITUTE:\n" +
  "- Prefer the ROOT PATTERN of the movement over a different movement: swing -> deadlift pattern;\n" +
  "  jerk -> strict press; snatch -> single-leg deadlift. Dynamic and momentum-driven versions are\n" +
  "  what hurt, not the pattern.\n" +
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
  "A substitution that felt fine in the session but the athlete reported badly on afterwards was\n" +
  "the wrong choice. Retire it for this athlete and pick a lower-demand one from the matrix — do\n" +
  "not repeat it to 'test' it again.\n" +
  "\n" +
  "WHEN THE RESTRICTION IS UNCLEAR:\n" +
  "Program the safest reading of it and keep the session complete. Do not interrogate the athlete\n" +
  "about why, and do not leave a day empty because you are unsure.\n";
