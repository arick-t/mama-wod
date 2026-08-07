# מייל האפליקציה

כתובת ייעודית לכל התקשורת והמיילים התפעוליים של DUCK-WOD:

**contact.duckwod@gmail.com**

| שימוש | איך |
|-------|-----|
| יצירת קשר למשתמשי UI / בעלי תוכן | `mailto` ב־`index.html` (דיסקליימר) |
| דוחות ניתור, coach feedback, digests | Brevo → אותה כתובת (`lib/app-mail.js`) |

---

## בדיקת לינק (CI)

`scripts/contact-link.test.js` בודק שיש שני קישורי `mailto` נכונים. **אין שליחת מייל.**

---

## מיילים אוטומטיים (Brevo)

ברירת מחדל בקוד = **`contact.duckwod@gmail.com`**.  
עדכון Secrets ב־GitHub / Vercel / Brevo — ראו **`BREVO_SECRETS.md`**.
