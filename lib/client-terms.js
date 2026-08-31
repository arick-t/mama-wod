/**
 * B2B coaching terms — the owner's final text, v3.4-legal.
 *
 * ⚠️ DO NOT EDIT THE WORDING. This is legal text supplied by the owner and it is
 * reproduced verbatim. Reflowing a sentence, "improving" a phrase, or translating
 * anything is out of bounds. The English is the binding version; the Hebrew is a
 * translation and says so.
 *
 * Changing the text at all means bumping CLIENT_TERMS_VERSION in lib/client-access.js,
 * which makes every existing client re-sign once. That is correct behaviour, not a
 * bug — but it is a decision, so it never happens as a side effect of a tidy-up.
 *
 * scripts/client-terms.test.js pins these strings so a silent edit fails the suite.
 *
 * Note on branding: the document header is the owner's own ("BAR-VAZ / MAMA WOD").
 * The page chrome around it is DUCK-WOD. Both are intended.
 */

"use strict";

const TERMS_VERSION = "v3.4-legal";

const TITLE_EN = "BAR-VAZ / MAMA WOD — B2B COACHING & PROGRAMMING TERMS";
const SUBTITLE_EN = "English Version (Official Legal Binding Text) · v3.4-legal";

const SECTIONS_EN = [
  {
    heading: "1. SCOPE OF SERVICES & INDEPENDENT PROFESSIONAL RESPONSIBILITY",
    body:
      "The services provided by the developer/provider consist solely of workout program design, consulting recommendations, and training blueprints. The Provider is not a party to the physical training conducted in the field. The sole and absolute responsibility for reviewing the program, adapting it, supervising physical training in the field, instructing proper technique, supervising trainees, and ensuring compliance with all applicable legal requirements—including valid medical clearances—rests entirely with you (the Coach, Academy, Studio, Gym, or any other entity utilizing the workout program) as the active operator. The Provider assumes no liability whatsoever for any injury, physical harm, or damages arising during the execution of the program.",
  },
  {
    heading: "2. AI TECHNOLOGY TRANSPARENCY & SOLE OPERATOR OVERSIGHT",
    body:
      "You acknowledge and agree that parts of the workout programs, routines, and content provided are generated using automated technology and artificial intelligence (AI) tools. The complete, sole, and exclusive responsibility, review, supervision, editing, approval, and adaptation of any workout program prior to its implementation, display, or execution with end-trainees rests entirely and exclusively upon you (the Coach, Academy, Studio, or Gym). The Provider is not responsible for supervising or reviewing programs in the field, and the programs must not be relied upon without your independent human professional oversight and full discretion.",
  },
  {
    heading: "3. ABSOLUTE WAIVER OF CLAIMS, RELEASE OF LIABILITY & FULL INDEMNIFICATION",
    body:
      "You hereby explicitly waive, release, and discharge the developer, owner, operators, and affiliates from any and all claims, demands, or liabilities whatsoever. You agree that the Provider shall bear no responsibility for any injury, physical harm, or damages arising out of or connected to the programs or workouts. In the event that any claim, demand, or legal action is brought by any third party (including end-trainees) against the Provider, you expressly agree to assume full legal and financial responsibility, and you shall immediately indemnify, defend, and hold harmless the Provider from any costs, damages, expenses, or attorney fees incurred.",
  },
  {
    heading: "4. MEDICAL CLEARANCES & HEALTH DECLARATIONS OF END-TRAINEES",
    body:
      "You explicitly warrant and agree that you are solely responsible for ensuring that every end-trainee under your supervision possesses a valid medical clearance and a signed health declaration as required by law. The Provider does not review, store, or have access to the medical records of end-trainees.",
  },
  {
    heading: "5. ACCEPTANCE OF TERMS",
    body:
      "Commencement of work with the program, utilization of the provided blueprints, or confirmation via text message/written notice constitutes your full, binding agreement and acceptance of these terms.",
  },
];

const TITLE_HE = "תרגום לעברית — תנאי התקשרות לשירותי תכנות ואימון B2B";
const SUBTITLE_HE = "(הטקסט המחייב הוא באנגלית למעלה)";

const SECTIONS_HE = [
  {
    heading: "1. היקף השירותים ואחריות מקצועית עצמאית",
    body:
      "השירותים הניתנים כוללים כתיבת תוכנית אימונים וייעוץ מקצועי בלבד. נותן השירות אינו צד לאימונים המתבצעים בשטח. האחריות הבלעדית על בחינת התוכנית, התאמתה, העברת האימונים בשטח, הדרכת טכניקה נכונה, השגחה על החניכים ווידוא קיומם של כלל האישורים הנדרשים שבדין, לרבות אישורים רפואיים בתוקף, חלה עליך (המאמן, המכינה, הסטודיו, חדר הכושר, או כל גורם אחר המשתמש בתוכנית האימון) כמפעיל בפועל. נותן השירות אינו נושא באחריות לכל פציעה או נזק שייגרמו במהלך ביצוע התוכנית.",
  },
  {
    heading: "2. שקיפות טכנולוגית (שימוש ב-AI) ובקרה בלעדית של המפעיל",
    body:
      "אתה מאשר ומסכים כי חלק מהתכנים ותוכניות האימון מופקים באמצעות כלי עזר טכנולוגיים ובינה מלאכותית (AI). הבקרה, הפיקוח והאחריות המלאה והבלעדית לבחינת התוכנית, עריכתה, אישורה והתאמתה טרם יישומה, הצגתה או הפעלתה בפועל מול מתאמני הקצה חלות אך ורק עליך (כמאמן, מכינה, סטודיו או חדר כושר). נותן השירות אינו אחראי על פיקוח או בדיקת התוכניות בשטח, ואין להסתמך עליהן ללא שיקול דעת ובקרה אנושית מלאה שלך.",
  },
  {
    heading: "3. ויתור מוחלט על טענות, פטור מאחריות ושיפוי מלא",
    body:
      "אתה מוותר בזאת באופן סופי, מוחלט ובלתי חוזר על כל טענה, דרישה או תביעה כלפי נותן השירות, ומאשר כי נותן השירות לא ישא בכל אחריות שהיא לכל נזק, פציעה או תביעה (לרבות מצד מתאמני קצה או צדדים שלישיים כלשהם). במקרה שבו תוגש תביעה או דרישה כלשהי כנגד נותן השירות הקשורה במישרין או בעקיפין לפעילותך, לתוכניות או לאימונים שהעברת, אתה מתחייב לקחת על עצמך את מלוא הטיפול המשפטי והפיננסי, לשפות, להגן ולפצות את נותן השירות באופן מידי בגין כל סכום, הוצאה, נזק או שכר טרחת עורכי דין שייגרמו לו.",
  },
  {
    heading: "4. אישורים רפואיים והצהרות בריאות",
    body:
      "אתה מתחייב לוודא באופן בלעדי כי לכל מתאמן קצה העובר תחת פיקוחך והמסגרת שלך יש אישור רפואי בתוקף והצהרת בריאות חתומה כדין. נותן השירות אינו בודק את התיקים הרפואיים של מתאמני הקצה ואינו חשוף אליהם.",
  },
  {
    heading: "5. תוקף והסכמה",
    body:
      "תחילת העבודה עם התוכנית, השימוש בתכנים במסגרת המכינה, הסטודיו או חדר הכושר, או אישור התנאים בהודעה (בוואטסאפ, במייל או בכתב) מהווים את אישורך והסכמתך המלאה והמחייבת לתנאים אלו.",
  },
];

const CONFIRM_LABEL =
  "I confirm that I have read, understood, and agreed to the B2B Coaching Terms of Service and Liability Waiver.";

const AGREE_BUTTON = "Agree & continue";

module.exports = {
  TERMS_VERSION,
  TITLE_EN,
  SUBTITLE_EN,
  SECTIONS_EN,
  TITLE_HE,
  SUBTITLE_HE,
  SECTIONS_HE,
  CONFIRM_LABEL,
  AGREE_BUTTON,
};
