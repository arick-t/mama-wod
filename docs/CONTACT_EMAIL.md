# מייל האפליקציה

כתובת ייעודית לכל התקשורת והמיילים התפעוליים של DUCK-WOD:

**contact.duckwod@gmail.com**

| שימוש | איך |
|-------|-----|
| יצירת קשר למשתמשי UI / בעלי תוכן | `mailto` ב־`index.html` (דיסקליימר) |
| דוחות ניתור, coach feedback, digests | Resend → אותה כתובת (`lib/app-mail.js`) |

---

## בדיקת לינק (CI)

`scripts/contact-link.test.js` בודק שיש שני קישורי `mailto` נכונים. **אין שליחת מייל.**

---

## מיילים אוטומטיים (Resend)

ברירת מחדל בקוד = **`contact.duckwod@gmail.com`**.  
עדכון Secrets ב־GitHub / Vercel / Resend — ראו **`RESEND_SECRETS.md`**.
