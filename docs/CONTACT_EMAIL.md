# יצירת קשר לבעלי תוכן

כתובת ציבורית לפרויקט (תיבת Gmail ייעודית):

**contact.duckwod@gmail.com**

מוגדר ב־`index.html` בשני מקטעי `.app-disclaimer` (קישורי `mailto`).

בנוסף: [פתיחת Issue ב־GitHub](https://github.com/arick-t/mama-wod/issues/new).

---

## בדיקת לינק (CI)

`scripts/contact-link.test.js` בודק שיש שני קישורי `mailto` נכונים (מקומי + אתר חי ב־Vercel כשמוגדר `CONTACT_LINK_TEST_URL`). **אין שליחת מייל.**

---

## דוח ניתור (Resend / GitHub Actions)

דוחות ניתור משתמשים נשלחים **למפתח** (ברירת מחדל **`ariel.tahan@gmail.com`**) – ראו **`RESEND_SECRETS.md`**.  
**לא** ל־`contact.duckwod@gmail.com` כברירת מחדל (מגבלות Resend בלי דומיין מאומת). תיבת **contact** מיועדת למשתמשים דרך האפליקציה בלבד.
