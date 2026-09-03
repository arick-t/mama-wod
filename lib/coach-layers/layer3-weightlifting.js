/**
 * LAYER 3 — Olympic weightlifting. Conditional.
 * Source: Drive שכבה 3 - מקצועות/הנפות אולימפיות, extracted by Gemini at temperature 0.
 *
 * Lights up when the athlete names a barbell goal (add kg to a lift, learn the snatch, competition
 * lifting) or ticks the olympic-lifting focus. It is NOT selected by a day's modality: the router
 * never sees the day. An earlier version of this header claimed otherwise and was simply wrong.
 *
 * Reviewed with the owner 2026-09-03. Six changes, each one reversing the source:
 *  - EXPERIENCE TIERS OUT. "Beginners", "developing and intermediate lifters", "a less skilled
 *    athlete" are the family the owner already deleted once — "סעיף אנושי לגמרי ואין להתחשב בו".
 *    Replaced with the data we actually hold: the reported lift numbers and the marked skills. An
 *    athlete who reported a 90 kg snatch is not a beginner, and an empty field is the real signal.
 *  - FREQUENCY CAPPED. 3-5 lifting sessions a week is a weightlifting programme, not one focus
 *    inside a five-day CrossFit week. It now spreads across the days that already exist.
 *  - DAILY-MAX SQUAT TEMPLATES BANNED OUTRIGHT rather than gated behind a list of exceptions. Same
 *    family as the powerlifting source the owner refused to let drive programming, and a list of
 *    exceptions invites the model to look for a way in.
 *  - THE 1 KG RULE MOVED TO THE ATHLETE. A brick is written four weeks ahead, so the coach cannot
 *    know what last session's single was; any number it computes is invented.
 *  - EQUIPMENT. Technical lifting goes on the days the barbell exists — the two-setting athlete is
 *    now a case the intake reports, so this layer has to know about it.
 */
module.exports =
  "=== OLYMPIC WEIGHTLIFTING (never name the sources) ===\n" +
  "\n" +
  "SESSION SHAPE:\n" +
  "10-12 minutes general warm-up, then 5-8 minutes before the bar is touched. Empty-bar work is\n" +
  "decomposed: several sets of each component position before any full lift.\n" +
  "Choose primer loads by feel and position quality, not by percentage.\n" +
  "\n" +
  "HOW MUCH OF THE WEEK THIS TAKES (HARD):\n" +
  "Skill is built by FREQUENCY at moderate daily volume, not by long heavy sessions — so spread the\n" +
  "barbell work across the training days the athlete already has. Do NOT add days, and do NOT turn\n" +
  "the week into a weightlifting programme. This is ONE focus inside a CrossFit brick: the modality\n" +
  "spread and the balance in the layers above still hold.\n" +
  "\n" +
  "READ THE REPORTED NUMBERS, NEVER AN EXPERIENCE LABEL:\n" +
  "- A reported snatch or clean & jerk figure is a tested lift. Program from it, by %1RM.\n" +
  "- No figure reported for a lift, or the skill left unmarked: the PATTERN is the work. Higher\n" +
  "  reps at a load that lets the position hold. Load follows position, never leads it.\n" +
  "- Full catches rather than power variations wherever the squat under the bar is the thing being\n" +
  "  built.\n" +
  "\n" +
  "LOADING:\n" +
  "- Progression is WAVE-LIKE, not linear. Plan the unloading weeks; they are part of the cycle.\n" +
  "- Heavy singles, doubles and triples plus speed work drive neural adaptation — that is what a\n" +
  "  heavy day is for.\n" +
  "- A heavy single is judged on FEEL and never taken to failure. Tell the ATHLETE in the session to\n" +
  "  add a little on their last session if it is there; never write that kg figure yourself. The\n" +
  "  brick is built weeks ahead and you cannot know what they last hit.\n" +
  "\n" +
  "HARD CONSTRAINTS:\n" +
  "- NEVER end a set or a session on a miss. If the last attempt was missed, drop the load and\n" +
  "  complete one good rep.\n" +
  "- Maximum 3 missed attempts on heavy snatch or clean & jerk in a session, then stop that lift.\n" +
  "- Do not repeat a missed load during a build-up unless the miss was a minor technical fault.\n" +
  "- Never program to mechanical failure.\n" +
  "- NO DAILY-MAX SQUAT TEMPLATES. Not for anyone, at any level, under any condition. That is a\n" +
  "  specialist programme from another sport and it is not what this product builds.\n" +
  "\n" +
  "PROGRAMMING THE LIFTS INSIDE A CROSSFIT BRICK:\n" +
  "- Hold one variation for roughly 4 weeks, then rotate: paused, deficit, power, timed sets.\n" +
  "- Timed sets build capacity under fatigue: snatch 15-20 reps on a :60 clock; clean & jerk 10-15\n" +
  "  reps on a :90 clock.\n" +
  "- Heavy technical lifting and a long aerobic grind on consecutive days is a bad pairing;\n" +
  "  separate the two taxes.\n" +
  "- A barbell in a metcon is conditioning, not lifting. Keep the technical work on its own day\n" +
  "  unless the athlete is deliberately training heavy loads under fatigue.\n" +
  "- PUT THE TECHNICAL WORK ON THE DAYS THE BARBELL EXISTS. Where the setup gives them a bar on\n" +
  "  some days only, the lifting goes there; on the other days keep the pattern with the implement\n" +
  "  they have and do not call that technical work.\n" +
  "\n" +
  "MEASURING THE WEEK:\n" +
  "Volume = total reps and total kg. Relative intensity = average weight / 1RM. When you raise\n" +
  "intensity, lower volume in the same week — not both at once.\n";
