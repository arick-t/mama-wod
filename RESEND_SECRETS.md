# שליחת דוח ניתור דרך Resend (GitHub Actions)

במקום SMTP – שליחה עם **Resend** + מפתח API ב־GitHub.

**נמען ברירת מחדל לדוח ניתור:** **`ariel.tahan@gmail.com`** (חשבון Resend / תואם מצב testing).  
**`contact.duckwod@gmail.com`** משמש רק **באפליקציה** (קישור Contact / `mailto`) – לא כברירת מחדל לדוחות אוטומטיים (בלי דומיין מאומת ב־Resend המיילים לא מגיעים לשם).

---

## 0. קישור Resend ↔ GitHub

| איפה | מה לעשות |
|------|-----------|
| [Resend → API Keys](https://resend.com/api-keys) | צור מפתח (`re_…`) |
| GitHub → **Settings** → **Secrets** → **Actions** | **`RESEND_API_KEY`** או **`RESEND_API_KEY_conmail`** (אותו ערך) |
| [Resend → Emails](https://resend.com/emails) | מעקב אחרי שליחות מה־API |

---

## 1. Secrets ב-GitHub

| Secret | תוכן |
|--------|------|
| **RESEND_API_KEY** | מפתח מ־Resend (או השם **`RESEND_API_KEY_conmail`** – נתמך ב־workflow) |
| **RESEND_FROM** | (אופציונלי) כתובת שולח; בלי דומיין מאומת: לרוב `onboarding@resend.dev` |
| **ANALYTICS_REPORT_TO** | (אופציונלי) עוקף נמען. אם ריק – נשלח ל־**ariel.tahan@gmail.com** |

---

## 2. הרצת דוח ניתור (ידני או מתוזמן)

- **Actions** → **📊 Weekly Analytics Report** → **Run workflow** (בחירת תקופה וכו').
- **Cron:** יום שישי (כמוגדר ב־workflow).

---

## 3. אם יש 403 / שגיאה

- ב־Resend במצב testing לעיתים רק **כתובת בעל החשבון** מקבלת מייל – לכן ברירת המחדל בקוד היא **`ariel.tahan@gmail.com`**.
- **שליחה ל־`contact.duckwod@gmail.com`** מ־Actions: דורש [אימות דומיין](https://resend.com/domains) + **`RESEND_FROM`** על הדומיין, או שינוי ידני של **`ANALYTICS_REPORT_TO`** אחרי ש־Resend מאפשר.

---

## 4. מייל בדיקה נפרד

לא מוגדר workflow ייעודי – בדיקת השליחה היא **הרצה ידנית** של **Weekly Analytics Report**.
