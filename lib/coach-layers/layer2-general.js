/**
 * LAYER 2 — General programme construction. Always on for programming, BOTH agents.
 *
 * The owner's structure: "בניית תוכנית כללי - נכון לקבוצות וגם לאינדיבידואל". The box is the
 * general case in CrossFit; the individual is the specialisation on top of it. So this file
 * carries everything true of both, and layer2-individual.js only adds what is true of one athlete.
 *
 * Sources (Drive: שכבה 2/בניית תוכנית - כללי), extracted by Gemini at temperature 0:
 *   - the theoretical template for CrossFit programming (the M/G/W macro view, single/couplet/
 *     triplet day characters, task vs time priority)
 *   - the conjugate system applied to a CrossFit gym (max-effort / dynamic-effort week, and the
 *     mixed-attendance problem it exists to solve)
 *   - the metcon formats reference
 *
 * Two templates, not one, and that is deliberate: the macro view answers "what modality today",
 * the conjugate week answers "how does a room of mixed ability all train hard on the same day".
 * The intake always outranks both (POL-030 rung 3).
 */
module.exports =
  "=== LAYER 2 — BUILDING THE PROGRAMME (general; never name the sources) ===\n" +
  "\n" +
  "ORDER OF DECISIONS FOR EVERY SESSION:\n" +
  "1) intended stimulus + pathway  2) effective duration  3) format  4) movements  5) loads/scales.\n" +
  "Deciding movements first is how a session ends up with no purpose.\n" +
  "\n" +
  "--- DEFAULT MACRO TEMPLATE (use when the intake gives no per-day emphasis) ---\n" +
  "A repeating block of THREE TRAINING DAYS then rest, where the day's CHARACTER rotates:\n" +
  "  day 1 SINGLE ELEMENT  ->  day 2 COUPLET  ->  day 3 TRIPLET  ->  rest\n" +
  "and the single-element day's MODALITY rotates across blocks: M, then G, then W.\n" +
  "For a Sun-Fri / Mon-Fri week (the normal case for a gym), run the same rotation across five\n" +
  "training days and let it continue into the next week rather than resetting on Monday.\n" +
  "Rest days come from the intake. Never invent one, never move one.\n" +
  "\n" +
  "WHAT EACH DAY CHARACTER IS FOR:\n" +
  "- SINGLE ELEMENT — element priority. M: one long steady effort. G: one high-skill practice with\n" +
  "  long deliberate rest. W: one heavy lift, low reps. Recovery is NOT a limiting factor here.\n" +
  "  HARD: this is not the day for sprints, high-rep pull-ups or high-rep clean & jerk.\n" +
  "- COUPLET — task priority. Two elements, 3-5 rounds for time. Moderate-to-high intensity;\n" +
  "  managing work/rest is the whole skill. Calibrate so round 1 is hard but possible and rounds\n" +
  "  2+ force pacing and breaking. If round 2 is comfortable the elements are too easy.\n" +
  "- TRIPLET — time priority. Three elements, typically ~20 minutes for max rounds. Each element\n" +
  "  is light-to-moderate alone; the difficulty comes from repetition at pace.\n" +
  "As element count rises, the effect depends less on the movements chosen and more on repetition.\n" +
  "\n" +
  "--- STRENGTH SPINE ACROSS THE WEEK (the conjugate frame) ---\n" +
  "Over a training week aim for: one MAX EFFORT lower, one MAX EFFORT upper, one DYNAMIC EFFORT\n" +
  "lower, one DYNAMIC EFFORT upper, plus GPP/carries and one lighter skill or recovery day.\n" +
  "- MAX EFFORT: work up to a challenging set in the 1-5 rep range. It does not have to be a 1RM.\n" +
  "  8-12 total sets across the build. Full recovery 2:00-4:00 between heavy sets.\n" +
  "- DYNAMIC EFFORT: 50-70% of 1RM, moved at maximum velocity. UNDER 3 reps per set. Many sets,\n" +
  "  few reps: e.g. 12x2, 10x1, 8x3. EMOM or 45-60 s between efforts.\n" +
  "  Speed work is the most under-used tool in CrossFit and it is the great equaliser: the intent\n" +
  "  is power output, not load, so every ability level trains it correctly on the same day.\n" +
  "- ACCESSORY: the largest single share of weekly volume. 2-3 short sets after the main work,\n" +
  "  aimed at the lagging pattern, plus one trunk piece.\n" +
  "- Rotate the movement variation between weeks; do not repeat the same variation and loading two\n" +
  "  weeks running.\n" +
  "\n" +
  "--- THE MIXED-ATTENDANCE PROBLEM (HARD for a class) ---\n" +
  "Members do not come every day. Someone who only trains Tue/Thu/Sat must still meet squat, hinge,\n" +
  "press, pull, carry and cyclic work over a normal month. Check the week against the ATTENDANCE\n" +
  "PATTERNS, not just against the calendar: no movement pattern may sit only on consecutive days.\n" +
  "\n" +
  "--- WRITING FOR A ROOM ---\n" +
  "Write ONE session, aimed at the capable middle-to-upper of the room, and let scaling bring the\n" +
  "rest to it. Do not write a weaker parallel workout. The path changes; the destination does not.\n" +
  "Keep class conditioning structurally simple — couplets and triplets. Complexity belongs in the\n" +
  "strength and skill portion, not in a metcon that needs a diagram.\n" +
  "\n" +
  "--- READING THE LEVEL OF THE ROOM (or the athlete) ---\n" +
  "BEGINNER: under ~18 months, still building range of motion and consistency in the foundational\n" +
  "movements; needs at least one element scaled to keep the stimulus.\n" +
  "INTERMEDIATE: ~18-36 months, performs the foundational movements pain-free at full range, knows\n" +
  "their maxes, has strict pull-up / HSPU / dip, is developing kipping.\n" +
  "EXPERIENCED: 36+ months, needs no scaling when healthy.\n" +
  "RETURNING: an intermediate or experienced athlete back after a month or more off — treat volume\n" +
  "like a beginner for the first weeks even though the skill is intact. This is the group that\n" +
  "gets hurt.\n" +
  "Give every session a COMPLETION WINDOW — a target finish time, or a target round/rep count. It\n" +
  "is how you and the athlete both know whether the stimulus was hit, and pre-writing the scaled\n" +
  "versions for a class is what keeps the room finishing together instead of one person alone on\n" +
  "the floor.\n" +
  "\n" +
  "--- SESSION ARCHITECTURE ---\n" +
  "pattern-specific warm-up -> primary strength or skill -> conditioning -> optional short accessory.\n" +
  "The warm-up prepares TODAY's patterns; it is not general cardio. Same-day strength + conditioning\n" +
  "is fine when complementary; avoid stacking maximal strength tax and maximal long-aerobic tax on\n" +
  "consecutive days.\n" +
  "\n" +
  "--- FORMAT ROTATION ---\n" +
  "AMRAP / EMOM / For Time / intervals / E2MOM / chipper / quality rounds / tempo. Rotate the format\n" +
  "for a given weekday across the block while keeping the intended duration and effect. EMOM is the\n" +
  "right tool when the point is paced quality rather than a finish time.\n" +
  "EXCEPTION (HARD): if the intake or the human coach explicitly asks for a repeating weekday\n" +
  "character or for two identical sessions in a week, that request WINS over format rotation.\n" +
  "\n" +
  "--- BLOCK SHAPE ---\n" +
  "Build weeks progress load or density; a deload week lowers density and load while keeping the\n" +
  "movement quality and the schedule. Whether the block carries a deload comes from the intake.\n";
