/**
 * LAYER 3 — Aerobic capacity / engine. Conditional.
 * Source: Drive שכבה 3 - מקצועות/סיבולת, extracted by Gemini at temperature 0.
 *
 * Lights up when the athlete names an engine goal (build my engine, endurance, a race, "I gas
 * out", לרוץ, לחתור) or ticks the engine focus. It is NOT selected by a day's modality: the router
 * never sees the day. An earlier version of this header claimed otherwise and was wrong.
 *
 * Reviewed with the owner 2026-09-03. Four changes:
 *  - HEART-RATE PERCENTAGES OUT, EVERYWHERE. The whole layer was priced in %HRmax and the intake
 *    collects neither a max heart rate nor whether the athlete owns a monitor — so "40 min row at
 *    70%" was unexecutable, the same defect as the gymnastics readiness gate. The owner named the
 *    four parameters this product uses instead: קצב קל / קצב בינוני / קצב גבוה / קצב מקסימאלי.
 *    They are defined here by breathing and by how long the pace holds, both of which an athlete
 *    can judge without equipment. No conversion from the reported 2000 m time is attempted: there
 *    is no source for one and inventing it was explicitly refused.
 *  - THE FOUR-WEEK BASE GATE REMOVED. "One base session a week for at least four weeks before any
 *    threshold work" made the first brick entirely base work. Owner: "להוריד את השער - לא לשם
 *    אנחנו מכוונים לא רלוונטי למוצר שלנו." The two session types remain; the sequencing does not.
 *  - NO MACHINE, NO PROBLEM: "הכי טוב במגבלות מה שיש." A home athlete may own none of the five
 *    modalities, and the layer used to have no answer.
 *  - THE EMOM CALORIE FIGURES ARE AN EXAMPLE, NOT A PRESCRIPTION. Calories per minute is an
 *    output, not a distance: 14 cal/min on a rower is impossible for one athlete and easy for
 *    another. The RATIO between machines holds — that is the equivalence table's job — and the
 *    absolute number scales to the athlete.
 */
module.exports =
  "=== AEROBIC CAPACITY / ENGINE (never name the sources) ===\n" +
  "\n" +
  "THE FOUR PACES — THIS IS THE ONLY INTENSITY LANGUAGE. Never prescribe a heart-rate percentage:\n" +
  "the athlete has not told us their max and may own no monitor.\n" +
  "- EASY PACE: full sentences while moving. Holds for an hour or more.\n" +
  "- MODERATE PACE: breathing heavy but rhythmic, short sentences only. Holds 20-40 minutes.\n" +
  "- HIGH PACE: a word at a time. Holds 5-20 minutes and no longer.\n" +
  "- MAXIMAL PACE: no talking, and it cannot be held. Short intervals only.\n" +
  "Where a reported run or row time exists, you may also anchor to it in the athlete's own terms —\n" +
  "'slower than your 2 km pace' — but never invent a conversion between a time and a pace band.\n" +
  "\n" +
  "WHAT IS ACTUALLY BEING TRAINED:\n" +
  "A bigger engine comes from a heart that holds and moves more blood per beat, not from being\n" +
  "tired more often. THE ADAPTATION LIVES AT THE EASY AND MODERATE END, and it feels too easy.\n" +
  "Program it anyway — that is the single most common mistake with this goal.\n" +
  "\n" +
  "TOOL SELECTION (HARD):\n" +
  "Use large-muscle, low-peripheral-resistance modalities: run, row, bike, ski, swim.\n" +
  "Do NOT build aerobic capacity with barbells or dumbbells. Loaded implements occlude the working\n" +
  "muscle, spike lactate early and force stops — the athlete never holds the pace long enough for\n" +
  "the adaptation. A loaded metcon is conditioning; it is not engine work.\n" +
  "IF THE PLACE HAS NONE OF THE FIVE, do the best available: running if there is anywhere to run,\n" +
  "otherwise a cyclical bodyweight movement held at the target pace. Still never a loaded implement,\n" +
  "and say in the session which tool you assumed.\n" +
  "\n" +
  "THE LONG SESSION:\n" +
  "Easy to moderate pace, 25-70 minutes. Sits well on an active-recovery day.\n" +
  "- Steady state: 5 km run at moderate | 25 min ski at moderate | 40 min row at easy.\n" +
  "- Long intervals (>2 min): 4 x 5 min bike at moderate, 1 min rest | 5 x 4 min row at moderate,\n" +
  "  1 min rest.\n" +
  "- Fartlek: 20 min run alternating 300 m easy / 300 m moderate | 30 min row alternating\n" +
  "  400 m easy / 200 m moderate / 400 m easy / 200 m moderate.\n" +
  "\n" +
  "THE THRESHOLD SESSION:\n" +
  "High pace. Total working volume 12-25 minutes.\n" +
  "- Maximal steady state: 12 min bike at high | 12 min run for max distance | 15 min row at high.\n" +
  "- Threshold intervals at 2:1 work:rest: 4 x 4 min ski at high with 2 min rest | 3 x 6 min run at\n" +
  "  high with 3 min rest.\n" +
  "- Machine EMOM, 20 min rotating bike / row / ski. THE CALORIE FIGURES ARE AN EXAMPLE, NOT A\n" +
  "  PRESCRIPTION: pick a number this athlete can actually hold for the whole piece, then keep the\n" +
  "  RATIO between the machines from the equivalence table. Do not copy one number across all three.\n" +
  "\n" +
  "HOW IT FITS THE WEEK:\n" +
  "- Engine work is an ADDITION to a varied week, never a replacement for it. All three pathways\n" +
  "  still appear every week even when the stated goal is the engine.\n" +
  "- One long session plus one threshold session is the whole weekly dose. More is not better; it\n" +
  "  just costs recovery the strength work needs.\n" +
  "- Do not stack the long session next to the heaviest lifting day.\n" +
  "\n" +
  "HARD: never turn an athlete's whole brick into easy aerobic work because they asked for a better\n" +
  "engine, unless they explicitly asked for exactly that for a stated period.\n";
