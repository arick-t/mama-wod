# שליחת דוח ניתור דרך Resend (GitHub Actions)

במקום SMTP (Gmail/ProtonMail) – שליחה עם **Resend**: רק API key, בלי Connection timeout.

---

## 1. חשבון Resend

1. היכנס ל־[resend.com](https://resend.com) וצור חשבון (חינם).
2. ב־Dashboard → **API Keys** → צור מפתח חדש והעתק אותו (מתחיל ב־`re_`).

---

## 2. Secrets ב-GitHub

ב־**Settings → Secrets and variables → Actions** הוסף שני Secrets:

| שם ה-Secret (Name) | מה להזין ב-Value |
|---------------------|-------------------|
| **RESEND_API_KEY** | המפתח שהעתקת מ-Resend (מתחיל ב־`re_`) |
| **RESEND_FROM** | (אופציונלי) כתובת השולח. אם ריק – משתמשים ב־`onboarding@resend.dev`. לפרודקשן: הוסף דומיין ב-Resend והגדר למשל `DUCK-WOD <notifications@yourdomain.com>` |
| **ANALYTICS_REPORT_TO** | (אופציונלי) כתובת לדוח ניתור השבועי. אם ריק – נשלח ל־**contact.duckwod@gmail.com** |

---

## 3. בדיקת שליחה לפני דוח שבועי

1. ב־GitHub: **Actions** → **Resend email test** (**`resend-email-test.yml`**) → **Run workflow**.
2. השאר את שדה היעד ריק (ברירת מחדל: `contact.duckwod@gmail.com`) או הזן כתובת אחרת.
3. אם המייל הגיע – Resend מוגדר; דוח **Weekly Analytics Report** יישלח לאותה כתובת ברירת מחדל (או ל־`ANALYTICS_REPORT_TO` אם הגדרת).

---

## 4. סיכום

- **RESEND_API_KEY** – חובה (מפתח מ-Resend).
- **RESEND_FROM** – אופציונלי (ברירת מחדל: `onboarding@resend.dev`).
- **ANALYTICS_REPORT_TO** – אופציונלי (ברירת מחדל: `contact.duckwod@gmail.com`).

אחרי הגדרת המפתח הרץ **Resend email test** – ואז אפשר להריץ **Weekly Analytics Report** (או לחכות ל־cron ביום שישי).
