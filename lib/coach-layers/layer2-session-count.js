/**
 * LAYER 2 — Sessions sold by the count, not laid on a week. Conditional.
 *
 * Lights up ONLY when the studio intake's scheduleMode is "session_count". It is a small module
 * rather than a paragraph in layer2-general because it applies to one of the two studio shapes
 * and to no individual: a weekly-plan studio and every individual athlete would otherwise pay for
 * it on every brick.
 *
 * WHY IT EXISTS (owner, 2026-09-02): "יש לנו אופציה בתחקור של לקוח מנהל סטודיו שבה אני מכין לו
 * כמות של אימונים שבועיים ולא פריסה שבועית == אני מוכר לו לדוגמה 3 אימונים בשבוע."
 * In that mode there is no calendar at all — the intake screen says it in as many words: "No
 * weekday attached — the coach delivers them whenever suits their groups." Everything in
 * layer2-general that pins a modality to a weekday is therefore meaningless here, and the layer
 * needs to be told what carries identity instead: the session's INDEX.
 *
 * And the sub-option is the real point. "The sessions differ from one another" opens a free-text
 * box per session, and what the owner writes in it is cross-cutting programming instruction:
 * "long strength + short metcon up to 10 minutes", "a day with only one part, partner metcon",
 * "stations". Those are not hints. They fix the parts, the time cap, the format and sometimes the
 * number of pieces, and the brain has to read them literally and build what they describe.
 * The router feeds them in through intentText (studioIntake.sessionTypes), so a described session
 * also steers which discipline layer lights up.
 */
module.exports =
  "=== SESSIONS SOLD BY THE COUNT (no weekdays; never name the sources) ===\n" +
  "\n" +
  "This studio bought a NUMBER of sessions per week, not a weekly plan. There is no calendar here:\n" +
  "the coach delivers the sessions whenever suits their groups.\n" +
  "- Produce EXACTLY the number of sessions asked for, numbered 1..N. Do NOT attach weekdays, and\n" +
  "  do NOT invent rest days — there is nothing for them to sit between.\n" +
  "- The session INDEX carries the identity a weekday carries elsewhere. Session 1 stays session 1\n" +
  "  from week to week, so a member who always takes the first session of the week gets a coherent\n" +
  "  line of training.\n" +
  "- Everything in the weekly-shape rules that pins a modality to a weekday applies to the session\n" +
  "  NUMBER instead. Spread M / G / W across the N sessions so none is missing, keep each session's\n" +
  "  modality stable between weeks, and let the day CHARACTER drift as usual.\n" +
  "- At most SEVEN sessions a week. If two of them fall on one day, they are two PARTS of that\n" +
  "  day's single session — never two sessions on one day.\n" +
  "\n" +
  "WHEN EACH SESSION IS DESCRIBED (HARD):\n" +
  "The intake may give each session a character in the owner's own words — for example 'long\n" +
  "strength + short metcon under 10 minutes', 'one part only, partner metcon', 'stations'.\n" +
  "Treat every such description as a HARD instruction for that session, EVERY week:\n" +
  "- Descriptions may be written in ANY language. Read the intent; still write the session in\n" +
  "  English.\n" +
  "- It may fix the PARTS (how many, and what each is for), the LENGTH, the FORMAT, and whether the\n" +
  "  session has one piece or several. Honour all of it literally.\n" +
  "- A description that limits the session to a single piece — 'one part only', 'metcon only', or\n" +
  "  the same in any language — means ONE part. Do not add a warm-up part, an accessory part or a\n" +
  "  second piece to it.\n" +
  "- A named length is a CEILING for the room, not a target: the piece must land inside it for the\n" +
  "  people actually in the class, not for the fittest person in it.\n" +
  "- RELATIVE lengths — short, medium, long — are the normal way this gets written and they are\n" +
  "  instructions, not mood. Read them against the session length the intake gave, and keep them\n" +
  "  consistent with each other across the week: if one session says short and another says long,\n" +
  "  the long one must actually be materially longer. A 'stations' session is a format instruction\n" +
  "  in the same way — build it as stations.\n" +
  "- Vary only what the description leaves open — movements, loads, the specific scheme — and keep\n" +
  "  what it fixed identical week to week.\n" +
  "- If a description conflicts with a default in any other layer, THE DESCRIPTION WINS.\n" +
  "If the sessions are NOT described, treat them as interchangeable and spread the modalities and\n" +
  "characters across them as you would across a week.\n";
