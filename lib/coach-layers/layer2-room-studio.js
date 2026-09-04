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
/* THREE RULES ADDED 2026-09-04, all from the owner reading the first "סטודיו בראשית" brick:
 *   - the format rule, which he framed better than the sources do: "בסופו של דבר יש לנו מאמר שלם
 *     של פורמטים, באימוני סטודיו פורמטים הם מהות הגיוון כי הכל זה תחנות". Two stations sessions in
 *     one week came back with the same skeleton and different numbers.
 *   - two parts as the shape: "אימון בן 3 חלקים - קשה למאמן וגם למתאמן הלא מרוכז".
 *   - the lane: a 200 m shuttle inside a 20 m indoor lane. "לא מתאים לאנשי סטודיו - דברים כמו
 *     הליכת לאנג' או ספרינטים יותר קצרים כן."
 *   - and the same day he settled what a "no barbells" boundary means: "עושים שם הכל פשוט לא עם
 *     מוט - קלינים, תראסטרים וכו'". The boundary is the IMPLEMENT. Worth stating, because the
 *     no-technicality rule above could otherwise be read as a reason to drop the pattern too, and
 *     that turns a house rule into a thinner programme.
 * NOTE FOR LATER: with four sessions a week and a two-week window the room needs EIGHT distinct
 * formats in rotation, and the approved list in layer2-general has exactly eight. That is why the
 * formats article the owner mentions is worth extracting — the rotation is currently tight with
 * nothing spare. */
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
  "--- IN A ROOM, THE FORMAT *IS* THE VARIETY (HARD) ---\n" +
  "Almost everything here is stations, the equipment is whatever the place owns, and the load is\n" +
  "self-selected — so the FORMAT is what makes one session different from another, not the movement\n" +
  "list. It is also the room's progression axis, so it is doing two jobs at once.\n" +
  "\n" +
  "HOW IT WORKS: A ROTATION, NOT A CALENDAR WINDOW.\n" +
  "Each session SLOT walks its own rotation of structures and does not repeat one until that\n" +
  "rotation has been exhausted. This is why it is a rotation and not 'no format twice in two\n" +
  "weeks': a room buying three sessions a week, or five, consumes the rotation at its own rate and\n" +
  "the rule still holds. With M structures and N slots of a type per week, the cycle simply takes\n" +
  "M/N weeks. Never stretch or compress the rotation to land on a calendar.\n" +
  "\n" +
  "THE ROTATIONS ARE SEPARATE PER SESSION TYPE. A stations slot and an ordinary strength-and-\n" +
  "conditioning slot do NOT draw from one list: an AMRAP couplet in session 1 does not spend AMRAP\n" +
  "for the stations slot, because an AMRAP through six stations is not the same session. Track each\n" +
  "slot's rotation on its own.\n" +
  "\n" +
  "STRUCTURE IS THE VARIETY. THE DIALS ARE THE PROGRESSION.\n" +
  "The STRUCTURE is how the stations stand in relation to the clock: a fixed work/rest interval, a\n" +
  "fixed window that rotates the stations (EMOM, E2MOM — one family), an AMRAP across the stations,\n" +
  "a task-priority pass for time or a chipper through them.\n" +
  "The DIALS are the window length, the work-to-rest ratio, the round count and the reps. Moving a\n" +
  "dial is NOT a new structure: 4 rounds of 40s/20s and 3 rounds of 90s/30s are one structure twice.\n" +
  "When a structure comes round again in the rotation, THAT is when the dials move — the same shape\n" +
  "the room already knows, asking more of them.\n" +
  "\n" +
  "Where the earlier weeks of this brick are given to you they name the formats already used. Read\n" +
  "them, and take the next structure in the rotation rather than the one you reached for first.\n" +
  "\n" +
  "STATIONS ARE NOT A FORMAT. They are what this place bought, and they appear as often as the\n" +
  "intake says. What rotates is the structure INSIDE them.\n" +
  "\n" +
  "--- TWO PARTS IS THE SHAPE (HARD) ---\n" +
  "One or two WORKING parts per session. A THREE-WORKING-PART SESSION APPEARS AT MOST ONCE IN TWO\n" +
  "WEEKS: three explanations, three equipment resets and three transitions with a full room is a\n" +
  "session the coach manages instead of coaches, and it loses the athlete whose attention is not on\n" +
  "the clock.\n" +
  "A WARM-UP PART DOES NOT COUNT toward that. Warm-up plus two working parts is the normal shape,\n" +
  "and the warm-up belongs inside the stated session length.\n" +
  "IF THE INTAKE SAYS THE PLACE RUNS ITS OWN WARM-UP, do not write one at all — open with the first\n" +
  "working part and let the floor coach do their job.\n" +
  "\n" +
  "--- A SHORT INDOOR LANE IS NOT A RUNNING TRACK (HARD) ---\n" +
  "A 20 m lane is for CARRIES, LUNGE WALKS and SHORT SPRINTS of one or two lengths. Do NOT\n" +
  "accumulate distance in it: 200 m as ten turns of a 20 m lane is twenty changes of direction,\n" +
  "which is a joint tax with no aerobic return — and with a full room it is bodies crossing. THE\n" +
  "TURNS ARE THE COST, NOT THE METRES.\n" +
  "Where the place has no real running distance, take the same stimulus from carries, lunge walks,\n" +
  "single-length sprints, step-ups and whatever machines it owns.\n" +
  "\n" +
  "--- WHAT THIS PLACE DOES NOT DO (HARD) ---\n" +
  "A place's boundary is a HOUSE RULE, not a mood. It holds in every session, every week — not\n" +
  "just when it is convenient, and not 'mostly'.\n" +
  "DO NOT EVADE IT ON A TECHNICALITY. If they do not do barbell snatches, do not reach for\n" +
  "something that is obviously the same thing under another name. Keep the movement's FUNCTION —\n" +
  "explosive hip extension, load overhead — with a tool that fits the place. Where the wording does\n" +
  "not settle whether the boundary is the IMPLEMENT or the MOVEMENT, do not go looking for the gap.\n" +
  "AND WHERE THE BOUNDARY NAMES AN IMPLEMENT, IT LIMITS THE IMPLEMENT AND NOTHING ELSE. A\n" +
  "no-barbells rule does not remove the clean, the snatch, the thruster or the jerk from this place — it\n" +
  "removes the BAR. Every pattern is still trained, with the dumbbells and kettlebells the room owns.\n" +
  "Read a boundary at its narrowest, then program everything it did not take away: a place that\n" +
  "banned an implement did not ask for a timid programme.\n" +
  "AND A PLACE'S CHARACTER NARROWS THE VOCABULARY, NEVER THE STANDARDS. A home studio that grows no\n" +
  "competitors still gets full range of motion, a stated stimulus and a session worth doing. It\n" +
  "gets a good session from a different vocabulary — not a loose one.\n";
