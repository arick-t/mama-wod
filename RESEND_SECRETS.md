# שליחת מיילים תפעוליים (Brevo מועדף · Resend כגיבוי)

כל המיילים שהאפליקציה שולחת (דוח ניתור, coach feedback, digests) מיועדים לתיבת האפליקציה:

**`contact.duckwod@gmail.com`**

מקור אמת בקוד: `lib/app-mail.js` (`APP_MAIL_TO`) · שליחה: `lib/send-app-mail.js`.

אותה כתובת משמשת גם ל־`mailto` למשתמשי UI (ראה `docs/CONTACT_EMAIL.md`).

---

## 0. Brevo (מועדף — בלי דומיין)

| איפה | מה לעשות |
|------|-----------|
| [Brevo](https://app.brevo.com) → Senders | אימות `Duckfitness <contact.duckwod@gmail.com>` |
| Brevo → SMTP & API → API keys | מפתח API (לא MCP) |
| GitHub → Secrets → Actions | **`BREVO_API_KEY`**, אופציונלי `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` |
| Vercel → Environment Variables | אותם `BREVO_*` (Production + Preview) + Redeploy |

| שם | תוכן מומלץ |
|----|------------|
| **BREVO_API_KEY** | מפתח Brevo |
| **BREVO_SENDER_EMAIL** | `contact.duckwod@gmail.com` |
| **BREVO_SENDER_NAME** | `DUCK-WOD` |
| **ANALYTICS_REPORT_TO** / **COACH_FEEDBACK_TO** / **APP_MAIL_TO** | `contact.duckwod@gmail.com` |

---

## 0b. Resend (גיבוי בלבד)

| איפה | מה לעשות |
|------|-----------|
| [Resend → API Keys](https://resend.com/api-keys) | מפתח (`re_…`) — רק אם אין Brevo |
| GitHub / Vercel | **`RESEND_API_KEY`** (או **`RESEND_API_KEY_conmail`**) |

---

## 1. Secrets / Env — נמענים

| שם | תוכן מומלץ |
|----|------------|
| **RESEND_API_KEY** | (גיבוי) מפתח Resend |
| **RESEND_FROM** | (גיבוי) שולח Resend |
| **APP_MAIL_TO** | `contact.duckwod@gmail.com` |
| **ANALYTICS_REPORT_TO** | `contact.duckwod@gmail.com` (דוחות ניתור + fallback כללי) |
| **COACH_FEEDBACK_TO** | `contact.duckwod@gmail.com` (או השאר ריק → נופל ל־APP_MAIL_TO) |
| **COACH_DIGEST_EMAIL_TO** | (אופציונלי) אותו נמען ל־patterns digest |

אם Secret עדיין מצביע על מייל אישי ישן — **עדכן אותו**, כי env עוקף את ברירת המחדל בקוד.

---

## 2. Checklist פלטפורמות (חובה אחרי המיזוג)

### A. Resend
1. היכנס ל־[Resend](https://resend.com) עם החשבון שמחובר למפתח.
2. ודא שהמיילים יכולים להישלח **אל** `contact.duckwod@gmail.com`:
   - במצב **testing** של Resend לעיתים מותר רק לכתובת בעל החשבון.
   - אם `contact.duckwod@gmail.com` לא מקבל: הוסף את הכתובת כ־allowlist / העבר לחשבון Resend שמקושר אליה, **או** אמת [דומיין](https://resend.com/domains) והגדר `RESEND_FROM` מאותו דומיין.
3. שלח מייל בדיקה מ־Resend Dashboard או הרץ ידנית את Weekly Analytics Report.

### B. GitHub Actions
1. **Settings → Secrets → Actions**
2. עדכן / הוסף:
   - `ANALYTICS_REPORT_TO` = `contact.duckwod@gmail.com`
   - `COACH_DIGEST_EMAIL_TO` = `contact.duckwod@gmail.com` (אם בשימוש)
   - `APP_MAIL_TO` = `contact.duckwod@gmail.com` (אופציונלי אבל מומלץ)
3. **Actions → 📊 Weekly Analytics Report → Run workflow** — ודא שהמייל מגיע ל־contact.

### C. Vercel (API: coach-feedback וכו׳)
1. Project → **Settings → Environment Variables**
2. לכל Environment (Production + Preview):
   - `ANALYTICS_REPORT_TO` / `COACH_FEEDBACK_TO` / `APP_MAIL_TO` → `contact.duckwod@gmail.com`
3. **Redeploy** אחרי שינוי env (חובה כדי שה־Serverless יטען ערכים חדשים).

### D. מקומי (`.env.local`)
```
APP_MAIL_TO=contact.duckwod@gmail.com
ANALYTICS_REPORT_TO=contact.duckwod@gmail.com
COACH_FEEDBACK_TO=contact.duckwod@gmail.com
```
אל תשאיר שם מייל אישי ישן.

---

## 3. הרצת דוחות

- **Actions** → **📊 Weekly Analytics Report** → **Run workflow**
- **Cron:** לפי workflow
- Coach patterns digest: `.github/workflows/weekly-coach-patterns-digest.yml`

---

## 4. אם יש 403 / המייל לא מגיע

סיבה נפוצה: Resend testing מאפשר רק שליחה לבעל החשבון.  
פתרונות: לאפשר `contact.duckwod@gmail.com` בחשבון / לאמת דומיין + `RESEND_FROM` תואם / לשנות את חשבון ה־API Key לזה שמקושר לתיבת contact.
