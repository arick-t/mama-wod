/**
 * The coach's dictionary: %1RM, lift ratios, machine equivalences, substitutions.
 *
 * This is NOT a knowledge layer. A layer is doctrine that is retrieved and interpreted; this is
 * arithmetic that must come out the same every time. Semantic search over numbers is the one
 * place retrieval is actively dangerous — it returns a table that looks right and the model
 * fills the missing cell from imagination. A frozen table cannot.
 *
 * Delivered alongside layer 1 on the PROGRAMMING path only (chat writes no prescriptions).
 * Closes POL-016, which has called for "conversion tables" since 2026-07-28 with nothing behind
 * the words.
 *
 * PROVENANCE — read this before changing a number:
 *   %1RM chart          — extracted verbatim from the owner's Drive training-load chart.
 *   Substitutions       — extracted verbatim from the Drive injury substitution matrix and the
 *                         Drive scaling chart.
 *   Lift ratios         — NOT IN THE DRIVE. Marked [no source] below. These are the commonly
 *                         published coaching ratios; they are ESTIMATES and the prompt says so.
 *   Machine equivalence — NOT IN THE DRIVE. Marked [no source]. Same treatment.
 *
 * The owner has been told which rows have a source and which do not. Do not quietly promote an
 * estimate to a fact, and do not add a row without telling him where it came from.
 */
module.exports =
  "=== EQUIVALENCE TABLE (arithmetic — use it, never re-derive it; never name it to the athlete) ===\n" +
  "\n" +
  "--- %1RM BY REP MAX (sourced) ---\n" +
  "1RM 100% | 2RM 95% | 3RM 93% | 4RM 90% | 5RM 87% | 6RM 85% | 7RM 83% | 8RM 80% | 9RM 77% | 10RM 75% | 12RM 70%\n" +
  "Prescribe load as a % of the athlete's reported 1RM using this chart. If the athlete reported a\n" +
  "rep max rather than a single, convert with the same chart before prescribing.\n" +
  "If no 1RM is reported for a lift: prescribe by RPE or by a rep target, NEVER by a guessed kg.\n" +
  "\n" +
  "--- LIFT-TO-LIFT ESTIMATES (no source in the knowledge base — treat as a starting point, not truth) ---\n" +
  "Typical ratios off Back Squat = 100%: Front Squat ~85% | Deadlift ~110-120% | Clean ~65% |\n" +
  "Clean & Jerk ~62% | Snatch ~50% | Overhead Squat ~48% | Push Press ~40% | Strict Press ~30%.\n" +
  "HARD: these estimate a STARTING load only. An athlete-reported number always wins. Never state\n" +
  "an estimated 1RM to the athlete as if it were tested — program a conservative opening load and\n" +
  "let the session confirm it.\n" +
  "\n" +
  "--- MACHINE EQUIVALENCE (no source in the knowledge base — approximate, for swapping a modality) ---\n" +
  "Rough equal-work swaps for a conditioning piece: Row 1000m ~ Run 800m ~ Ski 1000m ~ Bike(Echo) 1000m\n" +
  "~ 45-55 cal row ~ 30-35 cal echo bike. Calories differ by machine and by athlete size — when a\n" +
  "piece is scored in calories, prescribe DIFFERENT calorie targets for the same effort rather than\n" +
  "copying one number across machines.\n" +
  "HARD: never silently swap a machine mid-brick to hit a number. Swap only for equipment or injury,\n" +
  "and keep the intended time domain, not the intended distance.\n" +
  "\n" +
  "--- SUBSTITUTION MATRIX BY RESTRICTED AREA (sourced) ---\n" +
  "Read as: movement -> substitute for that restriction. NA = do not program this movement at all.\n" +
  "SHOULDER: Back/Front/OH Squat->single-KB front squat | Deadlift->single-KB deadlift | Pull-up->single-arm row or lat pulldown |\n" +
  "  Push-up->single-arm bench | Press/Push Press/Jerk->single-arm variant | Clean/Snatch->clean/snatch pull | KB swing->one-arm swing |\n" +
  "  Jump squat->squat | Jump lunge->stationary lunge.\n" +
  "KNEE / ANKLE: any squat->1-leg box squat | Deadlift->1-leg deadlift | Lunge/Jump lunge->squat | Box jump->NOT programmed |\n" +
  "  Clean->power clean from hang or hip | Snatch->power snatch from hang or hip | KB swing->seated swing | Run/Row->tire drag or upper-body bike.\n" +
  "LOW BACK: squats and deadlifts->heavy tire drag | RDL->poor-man leg curl | Clean/Snatch/pulls->hip bridge |\n" +
  "  Press family->military press | Burpee->single-mode cyclic work.\n" +
  "UPPER BACK / NECK: squats->walking KB/DB lunge | Deadlift->poor-man leg curl | Pull-up->horizontal pull-up |\n" +
  "  Press family->bench press | Clean/Snatch->hip bridge.\n" +
  "ARM / WRIST / HAND: barbell squats->single-KB front squat | Deadlift->box squat | any press or pull->single-arm variant |\n" +
  "  Run->weighted step-ups | Burpee->ball slam.\n" +
  "\n" +
  "--- STIMULUS-PRESERVING SCALES (sourced) ---\n" +
  "Handstand walk 100ft -> 6 wall walks | 15 HSPU | 40 HS shoulder taps | 1:00 handstand hold | 20 DB strict press.\n" +
  "Rope climb x1 -> 3-4 toes-to-bar | 3 strict pull-ups | 25ft hand-over-hand sled pull | 4-5 strict knees-to-elbows.\n" +
  "Legless rope climb x1 -> 4 strict pull-ups | 25ft sled pull.\n" +
  "Toes-to-bar x10 -> 12 GHD sit-ups | 14 V-ups | 16 alternating V-ups | 20 abmat sit-ups | 10 weighted abmat sit-ups.\n" +
  "GHD sit-ups x10 -> 8 toes-to-bar | 12 V-ups | 16 abmat sit-ups.\n" +
  "Heavy double-unders x50 -> 75 double-unders | 150 singles.\n" +
  "Squat snatch x1 -> 1 power snatch + 1 overhead squat at the same load.\n" +
  "Sled push 100ft -> 50ft front-rack lunge | 100ft front-rack carry | 100ft sandbag carry | 15/12 cal bike.\n" +
  "\n" +
  "--- HOW TO SCALE AT ALL (sourced) ---\n" +
  "Before scaling, answer three questions for THIS athlete: can they do the Rx load? do they have the\n" +
  "skill? can they finish inside the intended time domain? Any 'no' -> scale.\n" +
  "Scale in this order: 1) load  2) reps  3) range/progression  4) substitute the movement (last).\n" +
  "Preserve, in order: the intended stimulus, the time domain, then the movement pattern.\n" +
  "Never scale by removing the time domain — a workout with no target time has no stimulus.\n";
