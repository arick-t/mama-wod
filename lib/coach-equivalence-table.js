/**
 * The coach's dictionary: machine equivalence, %1RM, stimulus-preserving scales, scaling order.
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
 *   machine equivalence — the WODWELL cardio-equivalence chart (the icon table, page 2 of the
 *                         aerobic conversion sheet). Chosen by the owner on 2026-09-02 over the
 *                         alternative chart on page 3, which split every row by sex: "מרחק הוא
 *                         מרחק". One number for the room also matches the product line — we aim
 *                         at the capable middle and let the rest scale themselves.
 *                         The rejected chart disagreed on bike-erg by 25% (1600 m vs 2000 m for
 *                         an 800 m run), which is why the choice had to be made rather than
 *                         averaged. Page 1 of that sheet is a third source (branded Daybreak
 *                         CrossFit) and is not used for the main table.
 *   %1RM chart          — the training-load chart.
 *   scales / order      — the scaling chart and the Level 1 training guide.
 *
 * LIFT-TO-LIFT RATIOS ARE DELIBERATELY ABSENT. There is no source for them in the knowledge base
 * and the owner's instruction was explicit: do not guess, leave it until a source exists. The
 * table says "no reliable conversion" instead — a coach that invents a clean max from a back
 * squat puts a load nobody tested on a real bar.
 *
 * THE INJURY SUBSTITUTION MATRIX LIVES IN layer1-injuries.js, not here. It was moved on
 * 2026-09-02: it is the only block in this file that a healthy athlete never needs, and it was
 * costing ~700 tokens on every brick for someone with nothing wrong with them.
 */
module.exports =
  "=== EQUIVALENCE TABLE (arithmetic — use it, never re-derive it; never name it to the athlete) ===\n" +
  "\n" +
  "--- MACHINE EQUIVALENCE, BY DISTANCE ---\n" +
  "Read across the row: equal-work swaps for the same conditioning piece. One number for everyone.\n" +
  "ROW m | RUN m | SKI m | BIKE-ERG m | AIR BIKE cal\n" +
  "  250 |   200 |   250 |        500 |          15\n" +
  "  500 |   400 |   500 |       1000 |          30\n" +
  " 1000 |   800 |  1000 |       2000 |          60\n" +
  " 1500 |  1200 |  1500 |       3000 |          90\n" +
  " 2000 |  1600 |  2000 |       4000 |         120\n" +
  " 5000 |  4000 |  5000 |      10000 |         300\n" +
  "10000 |  8000 | 10000 |      20000 |         600\n" +
  "\n" +
  "--- MACHINE EQUIVALENCE, BY CALORIES ---\n" +
  "ROW cal | RUN m | SKI cal | BIKE-ERG cal | AIR BIKE cal\n" +
  "     20 |   200 |      20 |           20 |           15\n" +
  "     40 |   400 |      40 |           40 |           30\n" +
  "     80 |   800 |      80 |           80 |           60\n" +
  "    120 |  1200 |     120 |          120 |           90\n" +
  "    160 |  1600 |     160 |          160 |          120\n" +
  "    400 |  4000 |     400 |          400 |          300\n" +
  "    800 |  8000 |     800 |          800 |          600\n" +
  "\n" +
  "THE RATIOS, so you can convert a distance the table does not list:\n" +
  "ski = row · bike-erg = 2x row · run = 0.8x row · air-bike calories = 0.75x row calories ·\n" +
  "1 row calorie = 10 m run. Round to something a coach would actually write on a board.\n" +
  "\n" +
  "TIME DOMAIN — check every distance against the clock before you commit to it:\n" +
  "100 m run ~0:30 | 400 m ~2:00 | 800 m ~4:00 | 1000 m ~5:00 | 1600 m ~8:00.\n" +
  "If the piece you just wrote implies a wildly different time — an 800 m run inside a 12-minute\n" +
  "AMRAP gives two slow rounds, not an AMRAP — the DISTANCE is wrong, not the table.\n" +
  "\n" +
  "HOW TO USE IT (HARD):\n" +
  "- These are approximations. Swap a modality for EQUIPMENT or INJURY reasons, and keep the\n" +
  "  intended TIME DOMAIN — not the intended distance.\n" +
  "- Prefer meters over calories when the equipment allows: calories vary more by machine and by\n" +
  "  athlete than distance does.\n" +
  "- Never silently change machine mid-brick to hit a number.\n" +
  "- A studio with no ergs: 10 m shuttle runs and flights of stairs substitute for cyclic work\n" +
  "  (roughly 1 shuttle per row calorie; ~2 flights per 100 m run). These are rougher than the\n" +
  "  table above — prescribe by TIME on those, not by count.\n" +
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
  "If a lift has no reported 1RM: prescribe by RPE or by a rep target — 'work up to a heavy set of\n" +
  "N' — never by a percentage of a number you inferred. Never state a number the athlete has not\n" +
  "tested as if it were their max.\n" +
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
