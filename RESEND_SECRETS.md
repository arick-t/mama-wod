# שליחת דוח ניתור דרך Resend (GitHub Actions)

במקום SMTP (Gmail/ProtonMail) – שליחה עם **Resend**: רק API key, בלי Connection timeout.

---

## 0. קישור בין חשבון [Resend](https://resend.com) לבין מיילי האפליקציה

יש לך כבר חשבון ב־Resend (למשל דרך [התחברות / Emails](https://resend.com/emails)). ה־**קישור הטכני** בין מה שאתה רואה שם לבין מה שנשלח מהפרויקט הוא **מפתח ה־API** – אותו מפתח בדיוק חייב לשבת ב־GitHub.

| איפה | מה לעשות |
|------|-----------|
| **Resend** → [API Keys](https://resend.com/api-keys) | צור מפתח (מתחיל ב־`re_`) או השתמש במפתח קיים של **אותו פרויקט** שאתה רוצה לראות ב־[Emails](https://resend.com/emails). |
| **GitHub** → Repo → **Settings** → **Secrets and variables** → **Actions** | הדבק את המפתח ב־**`RESEND_API_KEY`** (או **`RESEND_API_KEY_conmail`** – גם נתמך). |
| **מעקב אחרי שליחות** | כל מייל שנשלח דרך ה־API עם המפתח הזה יופיע ב־Resend תחת **Emails** – שם רואים סטטוס (נשלח / נכשל) ונמען. |

כך **אותו חשבון Resend** = אותו דשבורד **Emails** + אותן הרצות **Actions** ב־GitHub (בתנאי שה־Secret תואם).

**לקבלת המייל בתיבה `contact.duckwod@gmail.com` (ולא רק לראות ב־Resend):**

1. **ללא דומיין מאומת** – Resend לרוב מאפשר בדיקות רק לכתובת **בעל החשבון** ב־Resend. אם נרשמת עם מייל אישי, הבדיקות יגיעו לשם.  
   - **אפשרות:** הוסף/אמת ב־Resend את **`contact.duckwod@gmail.com`** כחלק מהחשבון (אם הממשק מאפשר), או השתמש ב־**אימות דומיין** (סעיף 5).
2. **עם דומיין מאומת** – [Domains](https://resend.com/domains) → הגדר **`RESEND_FROM`** ב־GitHub → אז אפשר לשלוח ל־`contact.duckwod@gmail.com` כמו בכל מייל.

**סיכום:** אין כפתור "קישור מיילים" אחד – יש **מפתח API אחד** שמחבר GitHub ↔ Resend, ו־**דומיין מאומת** (או מדיניות testing) שקובעים **לאיזו תיבה** המייל בפועל מגיע.

### האם "אפשר לגרום מהקוד" שהמייל יגיע ל־contact.duckwod@gmail.com?

**לא בלי Resend.** הפרויקט כבר שולח את בדיקת **Resend email test** (וברירת המחדל של דוח הניתור) **ל־`contact.duckwod@gmail.com`**.  
אם המייל **לא** מגיע לתיבה הזו – הבעיה היא **הגבלות חשבון Resend** (למשל 403), לא שם הנמען ב־GitHub Actions.

**מה כן צריך לקרות אצלך ב־Resend** כדי שהמייל **באמת יגיע** לתיבת הניהול:

1. **[אימות דומיין](https://resend.com/domains)** ב־Resend + ב־GitHub Secret **`RESEND_FROM`** = כתובת על אותו דומיין (למשל `DUCK-WOD <notify@yourdomain.com>`). אחרי זה אפשר לשלוח לכל Gmail כולל `contact.duckwod@gmail.com`.
2. **או** חשבון Resend שבו **כתובת בעל החשבון** היא בדיוק **`contact.duckwod@gmail.com`** – במצב testing לעיתים המיילים מגיעים לשם (תלוי Resend).

בלי אחד מאלה, Resend עלול לשלוח רק לכתובת אחרת (למשל המייל האישי שאיתו נרשמת) – **אי אפשר לתקן את זה רק בשינוי קוד ב־repo**.

---

## 1. חשבון Resend

1. היכנס ל־[resend.com](https://resend.com) וצור חשבון (חינם).
2. ב־Dashboard → **API Keys** → צור מפתח חדש והעתק אותו (מתחיל ב־`re_`).

---

## 2. Secrets ב-GitHub

ב־**Settings → Secrets and variables → Actions** הוסף שני Secrets:

| שם ה-Secret (Name) | מה להזין ב-Value |
|---------------------|-------------------|
| **RESEND_API_KEY** | המפתח שהעתקת מ-Resend (מתחיל ב־`re_`). אם קראת ל־Secret בשם אחר (למשל **`RESEND_API_KEY_conmail`**) – ה־workflow יקבל אותו כ־fallback. מומלץ בשם הסטנדרטי **`RESEND_API_KEY`** לקריאות עתידיות. |
| **RESEND_FROM** | (אופציונלי) כתובת השולח. אם ריק – משתמשים ב־`onboarding@resend.dev`. לפרודקשן: הוסף דומיין ב-Resend והגדר למשל `DUCK-WOD <notifications@yourdomain.com>` |
| **ANALYTICS_REPORT_TO** | (אופציונלי) כתובת לדוח ניתור השבועי. אם ריק – נשלח ל־**contact.duckwod@gmail.com** |

---

## 3. בדיקת שליחה לפני דוח שבועי

1. ב־GitHub: **Actions** → **Resend email test** (**`resend-email-test.yml`**) → **Run workflow**.
2. השאר את שדה היעד ריק (ברירת מחדל: `contact.duckwod@gmail.com`) או הזן כתובת אחרת (במצב testing של Resend – לרוב כתובת בעל החשבון).
3. תוכן המייל נבנה אוטומטית: **«בדיקת תקינה לעדכון גרסה X.Y.Z»** לפי `package.json` (אותו מספר גרסה כמו ב־release).
4. **דוח ניתור ידני:** **Weekly Analytics Report** → אפשר לבחור תקופה (`last_day`, `yesterday_today`, `last_week`…) ושדה אופציונלי **email_to** כדי לשלוח לכתובת בדיקה (עוקף ברירת מחדל / Secret).
5. אם המייל הגיע – Resend מוגדר; דוח שבועי אוטומטי יישלח ל־**contact.duckwod@gmail.com** (או ל־`ANALYTICS_REPORT_TO`).

---

## 4. סיכום

- **RESEND_API_KEY** – חובה (מפתח מ-Resend).
- **RESEND_FROM** – אופציונלי (ברירת מחדל: `onboarding@resend.dev`).
- **ANALYTICS_REPORT_TO** – אופציונלי (ברירת מחדל: `contact.duckwod@gmail.com`).

אחרי הגדרת המפתח הרץ **Resend email test** – ואז אפשר להריץ **Weekly Analytics Report** (או לחכות ל־cron ביום שישי).

---

## 5. אם הבדיקה נכשלת (403 / שגיאה)

- ודאו ב־[Resend → API Keys](https://resend.com/api-keys) שהמפתח ב־GitHub תואם למפתח פעיל (החליפו Secret אם צריך).
- **מצב testing ב־Resend:** אפשר לשלוח **רק לכתובת המייל של בעל החשבון ב־Resend** (כפי שמופיעה בדשבורד). שליחה ל־`contact.duckwod@gmail.com` תיכשל ב־403 עד שמאמתים דומיין.
- **בדיקה מהירה שהצינור עובד:** הרץ **Resend email test** עם שדה יעד **אותה כתובת שמופיעה כבעל חשבון ב־Resend** – אמור להצליח במצב testing.
- **כדי לשלוח ל־contact.duckwod@gmail.com:**  
  1. [הוסף דומיין](https://resend.com/domains) ב־Resend והשלם אימות DNS.  
  2. הגדר Secret **`RESEND_FROM`** ל־`DUCK-WOD <notifications@yourdomain.com>` (כתובת על הדומיין המאומת).  
  3. הרץ שוב את **Resend email test** (יעד ריק או `contact.duckwod@gmail.com`).
- בלוג של ה־run ב־Actions תופיע תשובת JSON מ־Resend (קוד שגיאה והודעה).
