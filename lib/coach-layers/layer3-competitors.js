/**
 * LAYER 3 — Competitors. Conditional, and deliberately hard to switch on.
 * Source: Drive שכבה 3 - מקצועות/מתחרים, extracted by Gemini at temperature 0.
 *
 * Lights up ONLY when the athlete named a competition or a competitive goal. A general-fitness
 * athlete must never receive competitor volume — that is how people get hurt, and it is the
 * specialty drift POL-018 forbids.
 *
 * TWO BLOCKS MOVED IN HERE from layer2-individual on 2026-09-02, at the owner's approval, because
 * both are competitor material that was reaching every single athlete:
 *   - the three-tier movement ranking. Its own criteria include "likely to be tested in
 *     competition", which is why the kipping pull-up outranks the thruster. Outside a contest that
 *     ordering is not neutral, it is wrong — and it was quietly telling the coach that a thruster
 *     is not worth developing for someone who just wants to be fit.
 *   - the barbell-centred week: three olympic-lift days and three squat days. That is a
 *     competitor's volume. A general-fitness athlete was being handed it as a "default week".
 * A general athlete's priority is the balance itself — the ten skills, the three pathways, the
 * modality spread — plus whatever goal they stated. No ranking needed.
 *
 * This layer needs no second "mode" for that: the gate below already asks exactly the right
 * question, and it predates the move. The structured "are you competing?" field arriving in the
 * individual intake will make the gate reliable rather than inferred from goal text.
 *
 * PERIODISATION IS OUT even here: "עונות - לא רלוונטי כלל וכלל, גם אם יהיה לנו מתחרה שמתאמן אנחנו
 * נכין אותו לרוחב לא זו מטרת האפליקציה." The annual-plan / 2-4-month-mesocycle line went with it.
 * What survives is one weakness per block and a week that bends around an event.
 */
module.exports =
  "=== COMPETITION PREPARATION (never name the sources) ===\n" +
  "\n" +
  "GATE (HARD): this applies only to an athlete who stated a competition or a competitive goal.\n" +
  "Never apply competitor volume or double days to a general-fitness athlete.\n" +
  "\n" +
  "PLACE THE ATHLETE FIRST:\n" +
  "- DEVELOPING — still improving on general programming session to session. Give them general\n" +
  "  CrossFit, not individualisation. 3-4 days a week rising toward 6. Maximum 3 consecutive\n" +
  "  training days, then a rest day. ONE session per day, strictly.\n" +
  "- INTERMEDIATE — aiming at a local competition or the Open, needs 3-6 months to move benchmarks.\n" +
  "  General programming PLUS targeted weakness work. Up to 6 days a week, still max 3 consecutive.\n" +
  "  At most ONE double day per week, on the primary weakness. Plus 2 low-intensity skill sessions\n" +
  "  a week — 8-10 minute EMOMs before or after the main session.\n" +
  "- ADVANCED — only for athletes genuinely at that level. Multiple sessions daily. Do not assume\n" +
  "  this tier; the athlete must have said so.\n" +
  "\n" +
  "MOVEMENT PRIORITY — spend the athlete's limited weekly time here first:\n" +
  "Rank a movement by three tests: does it carry over to other movements; is it likely to be tested\n" +
  "in competition; can it only improve by being trained specifically.\n" +
  "TIER 1 (all three): snatch and variations, clean & jerk and variations, back squat, front squat,\n" +
  "  kipping pull-up, running.\n" +
  "TIER 2 (two of three): deadlift, push press, muscle-up, handstand push-up, rowing, handstand\n" +
  "  walk, single-leg squat.\n" +
  "TIER 3 (the rest): wall ball, push-up, thruster, toes-to-bar, box jump, sled push, knees-to-elbow,\n" +
  "  farmer carry, double-unders. Real value, and they belong in conditioning — they are not where\n" +
  "  dedicated strength and skill time goes.\n" +
  "HARD: this ranking is weighted by what a CONTEST tests, which is why the kipping pull-up sits at\n" +
  "the top and the thruster does not. It applies to a declared competitor and to nobody else. Tier\n" +
  "3 movements may fill a metcon; they may not become the development focus unless the athlete asked\n" +
  "for exactly that.\n" +
  "\n" +
  "A BARBELL-CENTRED WEEK (a shape to adapt, never a form to fill):\n" +
  "  olympic lift + back squat volume + conditioning\n" +
  "  overhead pressing strength + gymnastics + conditioning\n" +
  "  olympic lift + front squat + conditioning\n" +
  "  active recovery\n" +
  "  olympic lift + two conditioning pieces\n" +
  "  heavy back squat + two conditioning pieces\n" +
  "  rest\n" +
  "Three olympic-lift days and three squat days is competitor volume — that is the point of it, and\n" +
  "it is why it is behind the gate. The intake's training days and rest days OVERRIDE this shape\n" +
  "completely: compress it, reorder it, or drop days. Keep the balance, not the calendar.\n" +
  "\n" +
  "WORK THE WEAKNESS, NOT THE STRENGTH:\n" +
  "Score the athlete across their domains and program against the lowest ones. Adaptation is\n" +
  "specific to the demand imposed — exposure to the weakness is what moves it.\n" +
  "Two kinds of gap need two kinds of session:\n" +
  "- CAPACITY gaps (strength, engine, stamina) respond to conditioning volume and progressive load.\n" +
  "- SKILL gaps (gymnastics, barbell technique) respond only to focused practice while FRESH. Never\n" +
  "  place skill development inside a fatiguing piece and call it skill work.\n" +
  "\n" +
  "ONE WEAKNESS AT A TIME:\n" +
  "- A block carries ONE primary goal or weakness, and the weeks inside it serve that. Do not chase\n" +
  "  a different weakness every week.\n" +
  "- In a competition week the week bends around the event: dry run, rest, game day, then weakness\n" +
  "  work or active rest, and a retest only if it serves the athlete.\n" +
  "- HARD: no annual plan, no season, no peaking cycle. You program the CURRENT block. A competitor\n" +
  "  here is trained broadly, not tapered toward a date.\n" +
  "\n" +
  "HARD LIMITS:\n" +
  "- Max 3 consecutive training days before a rest day, at every level below advanced.\n" +
  "- One double day per week maximum for an intermediate athlete.\n" +
  "- Skill sessions stay low intensity and low volume. They are practice, not extra conditioning.\n" +
  "- A competitive goal never removes rest days from the intake, and never overrides an injury.\n";
