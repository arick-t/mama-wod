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

**לאן המייל מגיע:** `arieltahan@hotmail.com` (קבוע ב-workflow, לא צריך Secret).

---

## 3. סיכום

- **RESEND_API_KEY** – חובה (מפתח מ-Resend).
- **RESEND_FROM** – אופציונלי (ברירת מחדל: `onboarding@resend.dev`).

אחרי ההזנה הרץ את ה-workflow (Run workflow) – המייל אמור להישלח בלי בעיות SMTP.
