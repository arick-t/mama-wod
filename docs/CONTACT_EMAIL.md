# יצירת קשר לבעלי תוכן

כתובת יצירת קשר ציבורית לפרויקט (תיבת Gmail ייעודית):

**contact.duckwod@gmail.com**

מוגדר ב־`index.html` בשני מקטעי `.app-disclaimer` (חיפוש: `contact.duckwod@gmail.com`).

בנוסף מוצג קישור ל־[פתיחת Issue ב־GitHub](https://github.com/arick-t/mama-wod/issues/new).

---

## בדיקת לינק – **אין שליחת מייל**

הסקריפט `scripts/contact-link.test.js` (וב־CI: שלב **בדיקת לינק קונטקט**) רק **בודק** שבדף יש קישורי `mailto:contact.duckwod@gmail.com`.  
**לא נשלח שום מייל** – לא לתיבת האפליקציה ולא לאישי.

---

## איך **כן** לשלוח מייל בדיקה ל־contact.duckwod@gmail.com

מיילים יוצאים רק מ־**GitHub Actions** דרך **Resend**, בעיקר מה־workflow **✉️ Resend email test** (קובץ `resend-email-test.yml`).

### צעדים ב־GitHub

1. פתח את הריפו → **Actions** → **✉️ Resend email test** → **Run workflow**.
2. בשדה **to_address**:
   - **ריק** = ברירת מחדל בקוד: **`contact.duckwod@gmail.com`**
   - או הקלד במפורש: `contact.duckwod@gmail.com`
3. הרץ את ה־workflow ובדוק את תיבת **contact.duckwod@gmail.com** (כולל ספאם).

### למה קיבלת את המייל במייל האישי ולא בתיבה החדשה?

| סיבה אפשרית | מה לעשות |
|-------------|-----------|
| **Resend במצב testing** | בלי דומיין מאומת, Resend מאפשר שליחה **רק לכתובת שמקושרת לחשבון Resend** (למשל המייל שאיתו נרשמת ל־[resend.com](https://resend.com)). אז בחרת או קיבלת יעד = המייל האישי. |
| **מילאת ב־`to_address`** את המייל האישי | להריץ שוב עם שדה ריק או עם `contact.duckwod@gmail.com`. |
| **Secret `ANALYTICS_REPORT_TO`** | משפיע על **דוח ניתור**, לא על Resend email test – בכל זאת כדאי לוודא ב־**Settings → Secrets and variables → Actions** שאין ערך ישן למייל אישי אם אתה רוצה רק את תיבת האפליקציה. |

### איך לגרום ל־Resend **באמת** למסור ל־contact.duckwod@gmail.com

אחת מהאפשרויות (פירוט ב־`RESEND_SECRETS.md`):

1. **אימות דומיין** ב־Resend + הגדרת **`RESEND_FROM`** ב־GitHub (כתובת על הדומיין המאומת) – אז אפשר לשלוח לכל נמען, כולל `contact.duckwod@gmail.com`.
2. **חשבון Resend** רשום עם **אותה כתובת** `contact.duckwod@gmail.com` – במצב testing לעיתים המיילים יגיעו לתיבה הזו (תלוי מדיניות Resend).

עד שאחד מהדברים האלה מתקיים, הרצה עם יעד `contact.duckwod@gmail.com` עלולה להחזיר **403** בלוג של ה־Action – זה צפוי.

**קישור חשבון Resend (דשבורד [Emails](https://resend.com/emails)) ל־GitHub:** ראו סעיף **«0. קישור בין חשבון Resend…»** ב־`RESEND_SECRETS.md` – אותו **API Key** ב־Secrets וב־Resend.

---

## בדיקת לינק (CI) – ללא מייל

ב־`scripts/contact-link.test.js`: נבדק תמיד ה־`index.html` המקומי; ב־GitHub Actions מוגדר גם `CONTACT_LINK_TEST_URL` (האתר ב־[Vercel](https://vercel.com/), למשל `https://mama-wod.vercel.app`) כדי לוודא שבפריסה החיה מופיעים שני קישורי `mailto` – **בלי** שליחת מייל.

---

## דוח ניתור שבועי (Resend)

ברירת המחדל לשליחת **דוח ניתור משתמשים** מה־workflow `weekly-analytics-report.yml` היא אותה כתובת (**contact.duckwod@gmail.com**), אלא אם הוגדר Secret `ANALYTICS_REPORT_TO`.  
בדיקת שליחה (מייל): workflow **Resend email test** – ראו `RESEND_SECRETS.md`.
