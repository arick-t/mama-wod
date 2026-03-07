# ערכי ה-Secrets לשליחת דוח ניתור (GitHub Actions)

ב־**Settings → Secrets and variables → Actions** יש להגדיר **ארבעה** secrets: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`.  
**התיבות ב-GitHub תמיד נראות ריקות** (מטעמי אבטחה) – אחרי שתזין ערך פעם אחת, לא תוכל לראות אותו שוב, רק לעדכן.

---

## אופציה 1: Gmail (מומלץ – פותר Connection timeout)

כדי שהדוח יישלח **מחשבון Gmail** (ולא ייתקע ב-Connection timeout כמו ProtonMail):

| Secret           | ערך לכתיבה |
|------------------|-------------|
| **SMTP_HOST**    | `smtp.gmail.com` |
| **SMTP_PORT**    | `587` |
| **SMTP_USER**    | כתובת Gmail המלאה, למשל `yourname@gmail.com` |
| **SMTP_PASSWORD**| **App Password** של Gmail (לא סיסמת החשבון הרגילה). |

**איך ליצור App Password ב-Gmail:**
1. כניסה ל־[Google Account](https://myaccount.google.com/) → **Security**.
2. הפעלת **2-Step Verification** אם עדיין לא פעיל.
3. ב־Security → **2-Step Verification** → למטה: **App passwords**.
4. יצירת סיסמה לאפליקציה (בחר "Mail" ו-"Other" וכתוב "GitHub Actions").
5. להעתיק את ה־16 התווים (בלי רווחים) ולהדביק ב־**SMTP_PASSWORD**.

---

## אופציה 2: ProtonMail

ProtonMail **חינמי** בדרך כלל **לא** מאפשר התחברות SMTP משרתים חיצוניים (כולל GitHub Actions), ולכן מקבלים "authentication failed". גם מ-**ProtonMail בתשלום** מ-GitHub Actions מופיעים לא פעם **Connection timeout** – השרתים של ProtonMail מגיבים לאט או חוסמים חיבורים מכתובות IP של עננים (כולל runners של GitHub).

אם בכל זאת מנסים ProtonMail:
- **SMTP_HOST:** `mail.protonmail.ch`
- **SMTP_PORT:** `587`
- **SMTP_USER:** `duck_wood1@protonmail.com`
- **SMTP_PASSWORD:** סיסמת החשבון או "App password" אם ProtonMail מציעים.

אם מתקבל **Connection timeout** או 535 – להחליף ל-**Gmail** (אופציה 1); זה עובד בצורה אמינה מ-GitHub Actions.

---

## סיכום קצר

| Secret            | אופציה 1 (Gmail)      | אופציה 2 (ProtonMail)        |
|-------------------|------------------------|------------------------------|
| **SMTP_HOST**     | `smtp.gmail.com`      | `mail.protonmail.ch`         |
| **SMTP_PORT**     | `587`                 | `587`                        |
| **SMTP_USER**     | `yourname@gmail.com`  | `duck_wood1@protonmail.com`  |
| **SMTP_PASSWORD** | App Password מ-Google | סיסמה / App password         |

לאחר ההזנה – להריץ שוב את ה-workflow (Run workflow) ולבדוק שהמייל נשלח.
