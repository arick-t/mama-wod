/**
 * The coach's dictionary: machine equivalence, %1RM, substitutions, scaling order.
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
 * PROVENANCE — every number here comes from a Drive source. Nothing is guessed.
 *   machine equivalence — the aerobic conversion sheet (added by the owner 2026-09-01).
 *   %1RM chart          — the training-load chart.
 *   substitutions       — the injury substitution matrix and the scaling chart.
 *   scaling order       — the Level 1 training guide.
 *
 * LIFT-TO-LIFT RATIOS ARE DELIBERATELY ABSENT. There is no source for them in the knowledge base,
 * and the owner's instruction was explicit: do not guess, leave it alone until a source exists.
 * So the table says "no reliable conversion" instead, which is the honest instruction — a coach
 * that invents a clean 1RM from a back squat will prescribe a load nobody tested.
 *
 * ONE DISAGREEMENT BETWEEN SOURCES, recorded so nobody silently "fixes" it: the sheets differ on
 * air-bike calories (800 m run reads as 48 cal on one page and 60 cal on two others). The two
 * agreeing pages are used below, and the prompt tells the coach to prefer meters over calories
 * when the choice exists.
 */
module.exports =
  "=== EQUIVALENCE TABLE (arithmetic — use it, never re-derive it; never name it to the athlete) ===\n" +
  "\n" +
  "--- MACHINE EQUIVALENCE, BY DISTANCE (M/W where they differ) ---\n" +
  "Read across the row: these are equal-work swaps for the same conditioning piece.\n" +
  "RUN m | ROW m (M/W) | BIKE-ERG m | AIR/ASSAULT BIKE cal (M/W) | SKI m (M/W)\n" +
  "  100 |   125 / 100 |        200 |                    7 / 5   |   125 / 100\n" +
  "  200 |   250 / 200 |        400 |                   15 / 10  |   250 / 200\n" +
  "  400 |   500 / 400 |        800 |                   30 / 21  |   500 / 400\n" +
  "  600 |   750 / 600 |       1200 |                   45 / 30  |   750 / 600\n" +
  "  800 |  1000 / 800 |       1600 |                   60 / 42  |  1000 / 800\n" +
  " 1000 | 1250 / 1000 |       2000 |                   75 / 50  |  1250 / 1000\n" +
  " 1600 | 2000 / 1600 |       3200 |                  120 / 84  |  2000 / 1600\n" +
  " 2000 | 2500 / 2000 |       4000 |                  150 / 100 |  2500 / 2000\n" +
  " 4000 | 5000 / 4000 |       8000 |                  300 / 200 |  5000 / 4000\n" +
  " 5000 | 6250 / 5000 |      10000 |                  375 / 250 |  6250 / 5000\n" +
  "10000 |12500 /10000 |      20000 |                  750 / 500 | 12500 /10000\n" +
  "\n" +
  "--- MACHINE EQUIVALENCE, BY CALORIES ---\n" +
  "ROW cal | RUN m (M/W) | AIR BIKE cal | BIKE-ERG / SKI cal | 10 m SHUTTLES\n" +
  "     10 |   100 / 150 |            7 |                 10 |  10\n" +
  "     15 |   140 / 215 |           11 |                 15 |  15\n" +
  "     20 |   190 / 285 |           14 |                 20 |  20\n" +
  "     30 |   300 / 430 |           21 |                 30 |  30\n" +
  "     40 |   380 / 570 |           28 |                 40 |  40\n" +
  "     50 |   475 / 715 |           35 |                 50 |  50\n" +
  "     60 |   600 / 860 |           42 |                 60 |  60\n" +
  "    100 |  950 / 1425 |           70 |                100 | 100\n" +
  "Also: 100 m run ~ 2 flights of stairs; 400 m run ~ 8 flights.\n" +
  "TIME DOMAIN as a sanity check: 100 m run ~0:30, 400 m ~2:00, 800 m ~4:00, 1000 m ~5:00,\n" +
  "1600 m ~8:00 for a mid-level athlete. If your prescription implies a wildly different time,\n" +
  "the distance is wrong for this athlete, not the table.\n" +
  "\n" +
  "HOW TO USE IT (HARD):\n" +
  "- These are approximations. Swap a modality for EQUIPMENT or INJURY reasons, and keep the\n" +
  "  intended time domain — not the intended distance.\n" +
  "- Prefer METERS over CALORIES when the equipment allows: calories vary far more by machine and\n" +
  "  by athlete size, and the sources themselves disagree on bike calories by roughly 20%.\n" +
  "- When a piece is scored in calories in a mixed group, prescribe DIFFERENT targets for men and\n" +
  "  women rather than one number for the room.\n" +
  "- Never silently change machine mid-brick to hit a number.\n" +
  "\n" +
  "--- %1RM BY REP MAX ---\n" +
  "1RM 100% | 2RM 95% | 3RM 93% | 4RM 90% | 5RM 87% | 6RM 85% | 7RM 83% | 8RM 80% | 9RM 77% | 10RM 75% | 12RM 70%\n" +
  "Prescribe load as a % of the athlete's reported 1RM. If they reported a rep max rather than a\n" +
  "single, convert with this same chart before prescribing.\n" +
  "Heavy single-lift day rep scheme: 5-3-3-2-2-2-1-1-1 climbing to a heavy but clean single.\n" +
  "\n" +
  "--- LIFT TO LIFT: NO CONVERSION ---\n" +
  "There is NO reliable way to derive one lift's max from another for a given athlete. Do not\n" +
  "estimate a clean from a back squat, a snatch from a clean, or a press from a bench.\n" +
  "If a lift has no reported 1RM: prescribe by RPE, by a rep target, or by a percentage of a lift\n" +
  "the athlete DID report and that shares the movement (front squat off back squat is still an\n" +
  "estimate — say 'work up to a heavy set of N' instead). Never state a number the athlete has not\n" +
  "tested as if it were their max.\n" +
  "\n" +
  "--- SUBSTITUTION MATRIX BY RESTRICTED AREA ---\n" +
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
  "--- STIMULUS-PRESERVING SCALES ---\n" +
  "Handstand walk 100ft -> 6 wall walks | 15 HSPU | 40 HS shoulder taps | 1:00 handstand hold | 20 DB strict press.\n" +
  "Rope climb x1 -> 3-4 toes-to-bar | 3 strict pull-ups | 25ft hand-over-hand sled pull | 4-5 strict knees-to-elbows.\n" +
  "Legless rope climb x1 -> 4 strict pull-ups | 25ft sled pull.\n" +
  "Toes-to-bar x10 -> 12 GHD sit-ups | 14 V-ups | 16 alternating V-ups | 20 abmat sit-ups | 10 weighted abmat sit-ups.\n" +
  "GHD sit-ups x10 -> 8 toes-to-bar | 12 V-ups | 16 abmat sit-ups.\n" +
  "Heavy double-unders x50 -> 75 double-unders | 150 singles.\n" +
  "Squat snatch x1 -> 1 power snatch + 1 overhead squat at the same load.\n" +
  "Sled push 100ft -> 50ft front-rack lunge | 100ft front-rack carry | 100ft sandbag carry | 15/12 cal bike.\n" +
  "\n" +
  "--- HOW TO SCALE AT ALL ---\n" +
  "Before scaling, answer three questions for THIS athlete: can they do the Rx load? do they have\n" +
  "the skill? can they finish inside the intended time domain? Any 'no' -> scale.\n" +
  "Scale in this order: 1) LOAD  2) VOLUME (reps, rounds, distance)  3) MOVEMENT (last).\n" +
  "When substituting a movement, preserve its function: push vs pull, upper vs lower drive, range\n" +
  "of motion, plane of movement.\n" +
  "Preserve, in order: the intended stimulus, the time domain, then the movement pattern.\n" +
  "A beginner starts at roughly 50% of the programmed volume and intensity for their first weeks.\n" +
  "FORBIDDEN: progressive scaling — dropping the load again and again mid-workout so a beginner can\n" +
  "keep moving without rest. Prescribe a load they can hold and let them rest instead.\n" +
  "Never scale by removing the time domain — a workout with no target time has no stimulus.\n";
