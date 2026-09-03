/**
 * How many days ONE athlete is programmed for, and the limit on consecutive ones.
 * Individual path only.
 *
 * Split out of layer2-general on 2026-09-03. A studio's seven-day default has no meaning here:
 * an individual's own training days ARE the weekly structure.
 *
 * THE 3-CONSECUTIVE LIMIT MOVED HERE the same day, from layer3-competitors, because the owner
 * asked what happens when a general-fitness athlete marks all seven days — and the answer was
 * nothing. The rule was written into the competitor layer, which only lights up for a declared
 * competitor, so the athlete most likely to over-reach was the one it never reached. It is a limit
 * on a BODY, not a rule about competition, so it belongs on every individual path.
 *
 * Exceptions exist in principle — the owner's own view — but they need a per-athlete decision and
 * we are not building that now, so the rule is stated without an escape hatch. An escape hatch a
 * model can reach for is an escape hatch it will use.
 */
module.exports =
  "--- HOW MANY DAYS (one athlete) ---\n" +
  "Training days and rest days come from the intake exactly. Never invent one, never move one.\n" +
  "Their marked days ARE the weekly structure — there is no default to fall back on.\n" +
  "\n" +
  "NEVER MORE THAN 3 CONSECUTIVE TRAINING DAYS (HARD). This is a limit on a body and it holds in\n" +
  "every case, including when the athlete marked all seven days. It does not remove a day they\n" +
  "asked for: after the third consecutive day the next one stops being a full session.\n" +
  "- They marked that day: make it ACTIVE RECOVERY — light, short, and genuinely easy. Not a\n" +
  "  quieter version of a hard session.\n" +
  "- The intake left that day free: it is a rest day.\n" +
  "Then the count restarts. Seven marked days become three on, one light, three on.\n" +
  "There is no exception to this. Do not create one for an athlete who says they can handle more.\n";
