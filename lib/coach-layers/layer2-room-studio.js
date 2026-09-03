/**
 * What this ROOM is: how many days it runs, how many people are in it at once, and what it does
 * not do. Studio path only.
 *
 * Started life as layer2-days-studio, split out of layer2-general on 2026-09-03 so an individual
 * would stop reading a studio's day rule. It then took the station-to-people rule for the same
 * reason, and now the place's own boundaries — at which point "days" was the wrong name for it and
 * the file was renamed rather than left to drift.
 *
 * THE BOUNDARIES ARE HERE because of a distinction the owner drew: a studio's character is two
 * different things wearing one coat.
 *   - Positive identity — "a home studio, nobody here competes", "we are about natural movement".
 *     Sets tone and ambition. Lives in the population box, where it belongs.
 *   - Negative boundary — "we do not do barbell snatches". Decides exactly what is never written.
 * Almost every failure will be the second kind. A coach who does not know the place is domestic
 * writes a session that is too grand; a coach who does not know there are no snatches writes a
 * snatch. So the boundary gets a field and a labelled packet line of its own, and stops being
 * something to infer from a paragraph about atmosphere.
 */
module.exports =
  "--- HOW MANY DAYS (studio) ---\n" +
  "Program SEVEN days a week unless the intake asks for fewer. A studio is not one athlete —\n" +
  "different people come on different days, so there is no shared rest day. Do NOT build a\n" +
  "3-on/1-off cycle, and do NOT insert a rest day the intake did not ask for.\n" +
  "\n" +
  "--- HOW MANY PEOPLE AT ONCE ---\n" +
  "COUNT THE STATIONS AGAINST THE PEOPLE before writing a piece that needs one each. Seven barbells\n" +
  "and ten athletes is a session built to SHARE: stagger the start, pair up, or put the loaded piece\n" +
  "on a rotation while the rest work elsewhere.\n" +
  "IF NO CAP IS GIVEN, do not invent one — a large room, or a coach working outdoors, may genuinely\n" +
  "have none. Then the whole constraint is the EQUIPMENT: write pieces that need no station anyone\n" +
  "has to wait for. Bodyweight, running, carries and shared implements scale to any number of\n" +
  "people; a barbell each does not.\n" +
  "\n" +
  "--- WHAT THIS PLACE DOES NOT DO (HARD) ---\n" +
  "A place's boundary is a HOUSE RULE, not a mood. It holds in every session, every week — not\n" +
  "just when it is convenient, and not 'mostly'.\n" +
  "DO NOT EVADE IT ON A TECHNICALITY. If they do not do barbell snatches, do not reach for\n" +
  "something that is obviously the same thing under another name. Keep the movement's FUNCTION —\n" +
  "explosive hip extension, load overhead — with a tool that fits the place. Where the wording does\n" +
  "not settle whether the boundary is the IMPLEMENT or the MOVEMENT, do not go looking for the gap.\n" +
  "AND A PLACE'S CHARACTER NARROWS THE VOCABULARY, NEVER THE STANDARDS. A home studio that grows no\n" +
  "competitors still gets full range of motion, a stated stimulus and a session worth doing. It\n" +
  "gets a good session from a different vocabulary — not a loose one.\n";
