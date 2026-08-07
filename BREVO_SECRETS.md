# שליחת מיילים תפעוליים דרך Brevo

כל המיילים שהאפליקציה שולחת (דוח ניתור, coach feedback, digests) מיועדים לתיבת האפליקציה:

**`contact.duckwod@gmail.com`**

מקור אמת בקוד: `lib/app-mail.js` (`APP_MAIL_TO`) · שליחה: `lib/send-app-mail.js`.

אותה כתובת משמשת גם ל־`mailto` למשתמשי UI (ראה `docs/CONTACT_EMAIL.md`).

---

## 0. Brevo

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

## 1. Secrets / Env — נמענים

| שם | תוכן מומלץ |
|----|------------|
| **APP_MAIL_TO** | `contact.duckwod@gmail.com` |
| **ANALYTICS_REPORT_TO** | `contact.duckwod@gmail.com` (דוחות ניתור + fallback כללי) |
| **COACH_FEEDBACK_TO** | `contact.duckwod@gmail.com` (או השאר ריק → נופל ל־APP_MAIL_TO) |
| **COACH_DIGEST_EMAIL_TO** | (אופציונלי) אותו נמען ל־patterns digest |

אם Secret עדיין מצביע על מייל אישי ישן — **עדכן אותו**, כי env עוקף את ברירת המחדל בקוד.

---

## 2. Checklist פלטפורמות

### A. GitHub Actions
1. **Settings → Secrets → Actions**
2. ודא שיש: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `ANALYTICS_REPORT_TO`
3. **מחק** אם עדיין קיימים: `RESEND_API_KEY`, `RESEND_API_KEY_CONMAIL`, `RESEND_FROM`
4. **Actions → 📊 Weekly Analytics Report → Run workflow** — ודא שהמייל מגיע ל־contact

### B. Vercel (API: coach-feedback וכו׳)
1. Project → **Settings → Environment Variables**
2. `BREVO_*` + נמענים (Production + Preview)
3. **מחק** משתני `RESEND_*` אם נשארו
4. **Redeploy** אחרי שינוי env

### C. מקומי (`.env.local`)
```
BREVO_API_KEY=...
BREVO_SENDER_EMAIL=contact.duckwod@gmail.com
BREVO_SENDER_NAME=DUCK-WOD
APP_MAIL_TO=contact.duckwod@gmail.com
ANALYTICS_REPORT_TO=contact.duckwod@gmail.com
COACH_FEEDBACK_TO=contact.duckwod@gmail.com
```

---

## 3. הרצת דוחות

- **Actions** → **📊 Weekly Analytics Report** → **Run workflow**
- **Cron:** לפי workflow
- Coach patterns digest: `.github/workflows/weekly-coach-patterns-digest.yml`
