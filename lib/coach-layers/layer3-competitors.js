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
 *
 * REVIEWED 2026-09-02. Four more things settled:
 *   - THE REST-DAY CLASH. This layer said "max 3 consecutive days, then a rest day" while the
 *     general layer now programmes a studio seven days a week. Not a contradiction once stated
 *     properly: seven days is a default for a ROOM, because different people come on different
 *     days. An individual's own intake days are the weekly structure and they win, and the
 *     3-consecutive limit is a limit on a BODY that holds in every case — including when the
 *     athlete marked all seven days, where the fourth day becomes active recovery rather than a
 *     full session. That is also what reproduces the source's own week.
 *   - THE ADVANCED TIER IS GONE. The source has it at 3-6 hours a day across multiple sessions.
 *     That is not a population this app serves, and a number like that in a prompt invites absurd
 *     volume. It also cannot coexist with "we train a competitor broadly".
 *   - DOMAIN SCORING IS GONE. The source asks the coach to score the athlete 1-10 across eight
 *     domains. We have no such data anywhere — not in the intake, not in the code — so the
 *     instruction could only produce invented numbers. Same failure mode as POL-016 pointing at
 *     conversion tables that did not exist. It now reads the weakness off what we actually hold:
 *     unmarked skills, the lowest lifts, and whatever the athlete named themselves.
 *   - THE SKILL/CAPACITY DISTINCTION MOVED OUT, to layer2-general. "Skill develops fresh, capacity
 *     develops tired" is not a competitor's rule, it is a rule; every athlete was being denied it
 *     because it happened to be written in a competitor's article.
 *
 * STILL OPEN: double days (a second session in one day). Removed for now — the owner asked what
 * the term meant, and leaving competitor volume in a prompt he has not agreed to is the wrong
 * default. One line restores it.
 */
module.exports =
  "=== COMPETITION PREPARATION (never name the sources) ===\n" +
  "\n" +
  "GATE (HARD): this applies only to an athlete who stated a competition or a competitive goal.\n" +
  "Never apply competitor volume to a general-fitness athlete.\n" +
  "\n" +
  "THIS IS ONE PERSON, NOT A ROOM (HARD):\n" +
  "Everything here is a limit on a BODY. The seven-day studio default does not apply to an\n" +
  "individual at all — an individual's own training days from the intake ARE the weekly structure,\n" +
  "and they win.\n" +
  "NO MORE THAN 3 CONSECUTIVE TRAINING DAYS. This holds in every case, including when the athlete\n" +
  "marked all seven days. After the third consecutive day the next one is not a full session: make\n" +
  "it active recovery if they asked to train that day, or a rest day if the intake left it free.\n" +
  "That is what produces a competitor-faithful week — three on, a lighter day, then on again.\n" +
  "\n" +
  "PLACE THE ATHLETE FIRST:\n" +
  "- DEVELOPING — still improving on general programming session to session. Give them general\n" +
  "  CrossFit, not individualisation. 3-4 days a week rising toward 6. ONE session per day, strictly.\n" +
  "- INTERMEDIATE — aiming at a local competition or the Open, needs 3-6 months to move benchmarks.\n" +
  "  General programming PLUS targeted weakness work. Up to 6 days a week. Plus 2 low-intensity\n" +
  "  skill sessions a week — 8-10 minute EMOMs before or after the main session.\n" +
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
  "Read the weakness off what you actually have: the unmarked skills and the lowest lifts in the\n" +
  "intake, and anything the athlete named as a weakness themselves. Do not invent a score for them\n" +
  "across domains you have no data on — program against what is visibly missing.\n" +
  "Adaptation is specific to the demand imposed: exposure to the weakness is what moves it.\n" +
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
  "- Never more than 3 consecutive training days, at any level.\n" +
  "- One session per day. Do not add a second session to a day.\n" +
  "- Skill sessions stay low intensity and low volume. They are practice, not extra conditioning.\n" +
  "- A competitive goal never removes rest days from the intake, and never overrides an injury.\n";
