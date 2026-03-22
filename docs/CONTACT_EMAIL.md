# יצירת קשר לבעלי תוכן

כתובת יצירת קשר ציבורית לפרויקט (תיבת Gmail ייעודית):

**contact.duckwod@gmail.com**

מוגדר ב־`index.html` בשני מקטעי `.app-disclaimer` (חיפוש: `contact.duckwod@gmail.com`).

בנוסף מוצג קישור ל־[פתיחת Issue ב־GitHub](https://github.com/arick-t/mama-wod/issues/new).

## בדיקת לינק (CI)

ב־`scripts/contact-link.test.js`: נבדק תמיד ה־`index.html` המקומי; ב־GitHub Actions מוגדר גם `CONTACT_LINK_TEST_URL` (האתר ב־[Vercel](https://vercel.com/), למשל `https://mama-wod.vercel.app`) כדי לוודא שבפריסה החיה מופיעים שני קישורי `mailto` – **בלי** קשר ל־Resend או לשליחת מייל.

## דוח ניתור שבועי (Resend)

ברירת המחדל לשליחת **דוח ניתור משתמשים** מה־workflow `weekly-analytics-report.yml` היא אותה כתובת (**contact.duckwod@gmail.com**), אלא אם הוגדר Secret `ANALYTICS_REPORT_TO`. בדיקת שליחה: workflow **Resend email test** – ראו `RESEND_SECRETS.md`.
