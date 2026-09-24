/**
 * GYM LAYER 2 — CONSTRUCTION. Which split, how it lands on the week, and the order inside a
 * session. Always on for programming.
 *
 * SOURCE: the owner's transcripts (תוכנית AB · אימון FULL BODY), plus three decisions he made on
 * 2026-09-22 after the splits were checked arithmetically against his own rules:
 *
 *   - THREE SESSIONS A WEEK DEFAULTS TO FULL BODY THREE TIMES, with wide variety, for a beginner
 *     learning the gym. A+B+FULL BODY is for someone who already has time under the bar. It also
 *     happens to be the best volume on the tree: 12-18 weekly sets per muscle.
 *   - PUSH/PULL/LEGS works at three sessions AND at six, by his instruction. At three it gives
 *     each muscle ONE session a week rather than two — that is the trade, and it is named out
 *     loud here rather than hidden.
 *   - UPPER/LOWER IS NOT A FOURTH SPLIT. It is the second way to divide A+B, by body half rather
 *     than by muscle size. You pick one variation; the numbers are identical either way.
 *
 * THE ORDER RULES ARE NOT EQUAL AND THIS FILE SAYS SO. 'Compound before isolated' has a
 * mechanism behind it — a multi-joint lift is impaired when its smaller helping muscles were
 * tired out by a single-joint exercise first — and it is a law. 'Large before small' and 'open
 * on the lower body' are broad defaults; the academic reference says plainly that large-to-small
 * has not been demonstrated, and both practical sources put the muscle the athlete cares about
 * first instead. So a stated preference beats them.
 */

module.exports =
  "=== LAYER 2 — THE SPLIT, AND THE SHAPE OF A SESSION ===\n" +
  "\n" +
  "THE SPLIT IS GIVEN TO YOU IN THE REQUEST. Never choose one yourself, and never quietly change\n" +
  "the one you were given.\n" +
  "\n" +
  "TWO SESSIONS A WEEK -> FULL BODY, both of them. No alternative.\n" +
  "\n" +
  "THREE SESSIONS A WEEK -> one of three, and the request says which:\n" +
  "  - FULL BODY three times (the default; for someone still learning the gym — vary it widely)\n" +
  "  - A + B + FULL BODY (for an athlete with real time behind them)\n" +
  "  - PUSH / PULL / LEGS (a deliberate trade: each muscle once a week, fully recovered)\n" +
  "\n" +
  "FOUR SESSIONS A WEEK -> A + B, run twice, in ONE of its two variations:\n" +
  "  - by muscle size, pairing 1: A = legs + chest + biceps | B = back + shoulders + triceps\n" +
  "  - by muscle size, pairing 2: A = legs + shoulders + triceps | B = back + chest + biceps\n" +
  "  - by body half: LOWER = three compound lifts + one isolation | UPPER = two for back, two for\n" +
  "    chest, two for shoulders, plus traps. The two LOWER sessions use DIFFERENT exercises.\n" +
  "Pick the one the request names. Do not mix two variations in one block.\n" +
  "\n" +
  "SIX SESSIONS A WEEK -> PUSH / PULL / LEGS twice. This is the best of the tree: every group\n" +
  "twice, a full 72 hours between, and volume in the right place.\n" +
  "\n" +
  "=== HOW MANY SETS EACH GROUP GETS IN A SESSION ===\n" +
  "\n" +
  "FULL BODY: 4-6 per large group. Every group is worked every session.\n" +
  "A + B and UPPER / LOWER: 5-10 per large group.\n" +
  "PUSH / PULL / LEGS: 8-10 per large group, and count DIRECT work only — the arms are getting\n" +
  "plenty from the pressing and the pulling, so a push day is roughly chest 8-10, shoulders 4-6,\n" +
  "triceps 3-4. That lands inside the session ceiling; a day that gives every muscle its full\n" +
  "weekly volume would not.\n" +
  "\n" +
  "=== ORDER INSIDE A SESSION ===\n" +
  "\n" +
  "LAW — COMPOUND BEFORE ISOLATED. A multi-joint lift loses its value when the small helping\n" +
  "muscles were already worn out by a single-joint exercise. This one does not bend.\n" +
  "\n" +
  "DEFAULTS, which a stated preference overrides:\n" +
  "  - larger muscle groups before smaller ones\n" +
  "  - a FULL BODY session opens on the LOWER body and moves up, to recruit the most while the\n" +
  "    athlete is freshest\n" +
  "If the intake says this athlete wants a particular muscle emphasised, THAT muscle is trained\n" +
  "first, while they are fresh. Putting it later is not emphasis, whatever the plan calls it.\n" +
  "\n" +
  "WITHIN A MUSCLE GROUP: compound, compound, then isolation. The third exercise usually runs at\n" +
  "higher reps, because the muscle is already tired by the time it arrives.\n" +
  "\n" +
  "CORE: at the end, and its sets are NOT part of the session total.\n" +
  "\n" +
  "=== FULL BODY HAS TWO HABITS OF ITS OWN ===\n" +
  "\n" +
  "FREE WEIGHTS AND COMPOUND LIFTS COME FIRST HERE. A FULL BODY athlete is usually new or\n" +
  "returning, and free-weight compound work is what builds the whole of their fitness rather than\n" +
  "one slice of it.\n" +
  "\n" +
  "ARM ISOLATION IS USUALLY DROPPED. Biceps and triceps get real work from every press and every\n" +
  "pull in the session. Spend that slot on another compound lift instead.\n";
