# Security Assessment — External Attacker vs Internal Coach Manipulation

Saved for follow-up discussion (founder review). Source: cloud-agent assessment, 2026-08-04.

## תמונת מצב קצרה (Overall)

- **מול תוקף חיצוני:** רמת אבטחה כרגע **בינונית-נמוכה** (יש פערים קריטיים בתשתית API).
- **מול משתמש פנימי שמנסה לעשות מניפולציה ל‑AI:** רמת אבטחה **בינונית** (חוקים טובים מאוד, אבל חסרה שכבת Enforcement קשיחה בצד שרת).

---

## 1) תוקף חיצוני — גניבת מידע / חשיפת מקורות (“המוח”)

### מה טוב כבר עכשיו
- יש חוקים מפורשים לא לחשוף מקורות/Drive/system prompt:
  - `POL-007` + `POL-019` בקובץ `experiments/personal-coach/coach-policy-rules.md`.
- מפתחות API נשמרים בשרת (`process.env`) ולא בלקוח.
- יש Rate-limit בסיסי בכמה endpoints.

### פערים מהותיים (עם ראיות)
1. **CORS פתוח לכולם (`*`)** ברוב ה‑APIים  
   קיים ב־`api/personal-coach.js`, `api/generate-workout.js`, `api/event.js`, `api/legal-agree.js`, `api/coach-feedback.js`, `api/security-coach.js`.  
   זה לא “פריצה” לבד, אבל מגדיל משמעותית משטח תקיפה.

2. **Auth אדמין חלש מאוד + ברירת מחדל קשיחה בקוד**  
   ב־`scripts/lib/admin/admin-auth.js` יש:
   - סיסמת Bootstrap קבועה בקוד (`FOUNDER_BOOTSTRAP_PASSWORD = "0523701404"`).
   - אפשר להעביר admin password גם ב‑query (`?pw=` / `?adminPassword=`), שזה מסוכן ללוגים/הדלפה.
   זה כיום הסיכון הכי קריטי מבחוץ.

3. **Rate-limit הוא In-memory בלבד**  
   `api/rate-limit.js` מציין במפורש שזה per-instance ולא distributed.  
   בתשתית serverless זה נעקף יחסית בקלות תחת עומס/ריבוי instances.

4. **Endpoint סטטוס חושפים פרטי קונפיגורציה פנימיים**  
   לדוגמה ב־`api/generate-workout.js` (GET) מוחזר debug שכולל env-presence/model config.  
   לא סוד ישיר, אבל מודיעין טוב לתוקף.

---

## 2) משתמש פנימי שמנסה “לשבור” את המאמן (Prompt Injection / Manipulation)

### מה טוב כבר עכשיו
- יש לכם Policy חזק ומפורש נגד prompt injection והדלפת system internals (`POL-019`).
- יש כללי “secret sources” (`POL-007`) ברמה פרודקטית נכונה.
- יש גם מנגנוני הגבלה/קצב/עלות שמצמצמים abuse עסקי.

### הפער הקריטי
ההגנה כרגע היא **בעיקר ברמת הנחיות למודל** (prompt/policy), ופחות ברמת **אכיפה דטרמיניסטית בצד שרת**.  
כלומר: אם מודל נכשל נקודתית, אין מספיק post-guard חוסם תמיד.

---

## המלצות חיזוק (עדיפות גבוהה → נמוכה)

## A. קריטי ומיידי (חייבים קודם)

1. **להסיר מיד סיסמת אדמין קשיחה מהקוד**  
   - לבטל Bootstrap קבוע.
   - אם `ADMIN_PASSWORD` לא קיים → endpoint צריך להחזיר `503` בלבד (לא fallback).
   - לא לקבל סיסמה דרך query/body; רק header + חתימה.

2. **להקשיח Admin Auth למנגנון חתום וקצוב זמן**
   - HMAC/JWT קצר-חיים עם nonce/timestamp.
   - הגבלת IP/Origin לפאנל אדמין.
   - לאפשר פעולות רגישות רק עם role מתאים.

3. **CORS allowlist אמיתי**
   - רק דומיינים רשמיים שלכם (prod/staging).
   - ללא `*` ב‑origin, במיוחד ב־admin ו‑coach endpoints.

4. **Rate limiting מבוזר**
   - KV/Redis/Upstash (לא in-memory).
   - לפי IP + userId + endpoint + burst control.
   - הגנה ייעודית ל־`personal-coach` ו־`admin-*`.

---

## B. קריטי לנושא “משתמש שמניפולטיבי ל-AI”

5. **להוסיף Server-side Prompt Injection Firewall לפני הקריאה למודל**
   - זיהוי patternים כמו: “ignore previous instructions”, “reveal system prompt”, “show sources”.
   - סיווג בקשה כ‑benign/suspicious/malicious.
   - חסימה/הקשחת מצב בעת חשד.

6. **להוסיף Output Guardrail דטרמיניסטי אחרי תשובת המודל**
   - סריקה אוטומטית לטקסט אסור (Drive/File Search/source names/prompt leakage/policy IDs לפי החלטה).
   - במקרה חריגה: להחליף בתשובת refusal בטוחה במקום להחזיר raw model output.

7. **Policy-as-code ולא רק prompt**
   - ליישם את `POL-007/019` גם בקוד כאילוצים טכניים (לא רק “המודל קרא כלל”).
   - “deny by default” למסלולים רגישים.

8. **לוג אבטחתי לאירועי injection**
   - לתעד ניסיונות חריגים (בלי לשמור תוכן רגיש מלא).
   - דשבורד התראות על משתמשים/סשנים חוזרים.

---

## C. חיזוק “מקורות חסויים” ספציפית

9. **Source-separation קשיח**
   - לא להחזיר למודל מזהי מקור פנימיים גולמיים אם לא חייב.
   - להשתמש ב־abstraction של ידע בלי שמות ספק/מאגר.

10. **תגובה אחידה לשאלות על מקורות**
   - refusal template אחיד וקצר (כבר מוגדר מדיניותית; צריך לאכוף גם בקוד).

11. **להקטין “דליפת מטא-מידע” ב‑GET status endpoints**
   - להסיר שדות debug מ-public health endpoints.

---

## מידת הביטחון הנוכחית (פרקטית)

- **סודיות המקורות (“המוח”)**:  
  מדיניות טובה, אבל בלי enforcement קשיח = **בינוני**.
- **עמידות לתוקף חיצוני**:  
  בגלל admin bootstrap + CORS פתוח + RL חלש = **בינוני-נמוך**.
- **עמידות למניפולציית משתמש על המאמן**:  
  חוקים חזקים, אכיפה חלקית = **בינוני**.
