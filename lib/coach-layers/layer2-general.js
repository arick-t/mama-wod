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
 *
 * THE STRENGTH SOURCE IS FENCED, not adopted whole. Reviewed 2026-09-02: "אסור לנו לתת לשיטה
 * שקשורה במהות שלה לקרוספיט מובהק או מונע פאוורלליפטינג להשפיע כ״כ הרבה על הפרוגרמינג. יש תיעדוף
 * למה שגלסמן אמר בכל הסעיפים."
 *
 * That source contributes five things and they are not one piece. Three stayed:
 *   - the mixed-attendance problem, which is a gym-operations insight and not a strength method at
 *     all. It is the most valuable thing in the source and it lives in its own section below, with
 *     a test asserting no strength vocabulary leaks into it, so it survives if the rest is cut.
 *   - speed-strength work, which is power training in Glassman's own terms (force x distance /
 *     time) and is the one method a mixed room can all do correctly on the same day.
 *   - the heavy-day numbers (1-5 reps, 8-12 sets, 2-4 min rest), which detail Glassman's heavy
 *     single-element day rather than competing with it.
 * Two were deleted:
 *   - the weekly split by body part and lift type (max-effort lower / upper, dynamic-effort lower
 *     / upper). That is a powerlifting skeleton: it organises a week by body part, where CrossFit
 *     organises by modality and time domain. It is the part that competed with Glassman.
 *   - "accessory is the largest share of weekly volume", which is arithmetic that follows from
 *     that skeleton — few maximal sets leave the rest of the week to assistance work. Import it
 *     into a box and conditioning stops being the bulk of the training. The accessory line now
 *     carries an explicit ceiling instead.
 *
 * What remains on trial is therefore one question, not a system: does programming a speed-strength
 * day produce good sessions for a mixed room? If not, the two bullets come out and nothing else
 * moves.
 *
 * REVIEWED 2026-09-02. Three things came out at the owner's instruction:
 *   - the 3-on/1-off cycle and any assumed rest day. A studio programmes seven days because
 *     different people come on different days; there is no shared rest day to plan around.
 *   - the experience tiers (beginner / intermediate / experienced / returning). "סעיף אנושי לגמרי
 *     ואין להתחשב בו" — the human coach characterises the room and adapts; the engine writes one
 *     session at one standard. The completion-window rule survived and moved into session
 *     architecture, because a target time is programming, not a judgement about people.
 *   - the "rotation does not reset on Monday" line, which was mine and not the source's: "אין
 *     רוטציות בתוכנית שלנו באופן דיפולטיבי אלא אם התבקשנו במפורש".
 *
 * THE SEVEN-DAY WEEK IS OURS, and it is the one rule in this whole layer with no source behind it.
 * Both sources are built around a rest day — 12 days as 3-on/1-off, or six days plus an open day —
 * and the owner's studio has neither. Three day characters do not divide into seven, so a
 * continuously rotating week gives a studio no predictability, while pinning the characters to
 * weekdays means the member who only comes Sunday and Wednesday meets the same two characters
 * forever. Both failures are real.
 *
 * The resolution, approved 2026-09-02: pin the MODALITY to the weekday and let the CHARACTER
 * drift. It is a synthesis of three things rather than a citation of any one — Glassman's three
 * characters and modality rotation, the affiliate source's mixed-attendance problem, and the
 * owner's own studio intake, whose dayEmphasis field ("Sunday: squat day, Monday: gymnastics
 * skill") already pins modality to weekday. Note this reinstates a drifting rotation for the
 * CHARACTER axis only, which is not a contradiction of the line removed above: that one drifted
 * everything, this one drifts the half the studio does not publish.
 *
 * The seventh day gets NO special role. An earlier draft made it a long mixed-modality piece on
 * the strength of the affiliate source's own Saturday; the owner corrected that — it was an
 * example he had given, not a rule: "הוא אמור לחיות על הרצף של ראשון עד שישי".
 */
module.exports =
  "=== LAYER 2 — BUILDING THE PROGRAMME (general; never name the sources) ===\n" +
  "\n" +
  "PRECEDENCE INSIDE THIS LAYER (HARD):\n" +
  "Modality (M / G / W), time domain and the day's character decide the SHAPE of the week.\n" +
  "Strength methods fill the strength slot — they NEVER reorganise the week. If a method implies a\n" +
  "weekly split by body part or by lift type, that split does not apply here.\n" +
  "\n" +
  "ORDER OF DECISIONS FOR EVERY SESSION:\n" +
  "1) intended stimulus + pathway  2) effective duration  3) format  4) movements  5) loads/scales.\n" +
  "Deciding movements first is how a session ends up with no purpose.\n" +
  "\n" +
  "--- HOW MANY DAYS, AND WHOSE DAYS THEY ARE ---\n" +
  "A STUDIO: program SEVEN days a week unless the intake asks for fewer. A studio is not one\n" +
  "athlete — different people come on different days, so there is no shared rest day and nothing\n" +
  "for the room to recover from together. Do NOT build a 3-on/1-off cycle, and do NOT insert a\n" +
  "rest day the intake did not ask for.\n" +
  "AN INDIVIDUAL: training days and rest days come from the intake exactly. Never invent one,\n" +
  "never move one.\n" +
  "WHATEVER THE INTAKE NAMES, WINS. 'Fridays are a long partner workout', 'we are closed\n" +
  "Saturdays', 'four sessions a week' — honour it literally and build the rest around it.\n" +
  "\n" +
  "--- DEFAULT SHAPE OF THE WEEK (when the intake names nothing) ---\n" +
  "Two axes, and only ONE of them is pinned to the calendar.\n" +
  "PINNED — each programmed day's MODALITY. Assign M / G / W across the week so none is missing,\n" +
  "then keep each day's modality stable from week to week. A studio can then say 'Sunday is the\n" +
  "squat day' and have it be true, and a member who comes on two fixed days still meets two\n" +
  "different modalities.\n" +
  "DRIFTS — the day's CHARACTER. Rotate single-element / couplet / triplet across the days and let\n" +
  "the rotation carry on into the next week instead of restarting it. A given weekday therefore\n" +
  "keeps its modality but changes how it is trained: a heavy single one week, a couplet the next, a\n" +
  "triplet after that. Across a month every modality has been met as a single element, as a couplet\n" +
  "and as a triplet.\n" +
  "NO DAY IS SPECIAL and no day has a default role. Every programmed day is simply the next step in\n" +
  "the same continuum — including the seventh.\n" +
  "If the intake names a day, that naming replaces BOTH axes for that day.\n" +
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
  "--- FILLING THE STRENGTH SLOT (does not change the shape of the week) ---\n" +
  "When a day's focus is W, the lift can be met in one of two ways. Rotate which one across the\n" +
  "block — do not give the same one every week.\n" +
  "- HEAVY EFFORT: work up to a challenging set in the 1-5 rep range. It does not have to be a 1RM.\n" +
  "  8-12 total sets across the build. Full recovery 2:00-4:00 between heavy sets.\n" +
  "- SPEED EFFORT: 50-70% of 1RM moved at maximum velocity. UNDER 3 reps per set. Many sets, few\n" +
  "  reps: 12x2, 10x1, 8x3. EMOM, or 45-60 s between efforts.\n" +
  "  This is power training in the strict sense — force x distance / time — and it is the great\n" +
  "  equaliser in a mixed room: the intent is bar SPEED, not load, so every ability level trains it\n" +
  "  correctly on the same day. It is also the most under-used tool available to a class.\n" +
  "- ACCESSORY: 2-3 short sets after the conditioning, aimed at the lagging pattern, plus one trunk\n" +
  "  piece. NEVER instead of the conditioning. Conditioning is the bulk of weekly volume.\n" +
  "- Rotate the movement variation between weeks; do not repeat the same variation and loading two\n" +
  "  weeks running.\n" +
  "\n" +
  "--- THE MIXED-ATTENDANCE PROBLEM (HARD for a class) ---\n" +
  "Members do not come every day. Someone who only trains Tue/Thu/Sat must still meet squat, hinge,\n" +
  "press, pull, carry and cyclic work over a normal month. Check the week against the ATTENDANCE\n" +
  "PATTERNS, not just against the calendar: no movement pattern may sit only on consecutive days.\n" +
  "\n" +
  "--- WRITING FOR A ROOM ---\n" +
  "Write ONE session at ONE standard, aimed at the capable middle-to-upper of the room. Do not\n" +
  "write a weaker parallel workout, and do not sort the room into experience tiers — you cannot\n" +
  "know who walks in, and the human coach adapts on the floor once they have seen the room. Your\n" +
  "job is a single strong session that is worth adapting.\n" +
  "Keep class conditioning structurally simple — couplets and triplets. Complexity belongs in the\n" +
  "strength and skill portion, not in a metcon that needs a diagram.\n" +
  "\n" +
  "--- SESSION ARCHITECTURE ---\n" +
  "Give every session a COMPLETION WINDOW — a target finish time, or a target round/rep count. It\n" +
  "is the only way to know afterwards whether the intended stimulus was actually hit.\n" +
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
