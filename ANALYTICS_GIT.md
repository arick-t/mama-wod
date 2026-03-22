# ניתור משתמשים מבוסס Git – בלי ספק חיצוני בתשלום

## עקרון

- **אחסון:** כל האירועים נשמרים **בקובץ בתוך ה־repo** (`data/analytics.jsonl`). אין מסד נתונים חיצוני, אין מנוי.
- **איסוף:** דפדפן שולח אירוע ל־**פונקציה אחת** (serverless) שמריצה **GitHub API** ומוסיפה שורה לקובץ ב־repo ועושה commit. הפונקציה רצה ב־**Vercel** (חינם, ללא כרטיס אשראי).
- **צפייה:** רק אתה – מריץ סקריפט מקומי על ה־repo (למשל `node scripts/analytics-summary.js`) ומקבל סיכום: כניסות, שימוש באיתור אימון, לפי יום.

**אין תשלום חודשי:** GitHub חינם, Vercel Free Tier חינם. הנתונים אצלך ב־Git.

---

## איך זה עובד

1. משתמש נכנס לאתר → הדף שולח אירוע `page_view` (פעם אחת לסשן).
2. משתמש לוחץ "Find Best Match" → נשלח אירוע `find_workout`.
3. הפונקציה ב־Vercel מקבלת את האירוע, קוראת את `data/analytics.jsonl` מ־Git (דרך GitHub API), מוסיפה שורת JSON אחת, ומבצעת commit ל־repo.
4. אתה מושך את ה־repo (או ה־workflow מעדכן), ומריץ `node scripts/analytics-summary.js` – ומקבל דוח.

---

## למה הדוח תמיד 0? מה זה "לפרוס את ה־API"?

### בתנאים הנוכחיים – אין ניתור אמיתי

הדוח (מקומי או באימייל) קורא את הקובץ **`data/analytics.jsonl`** בתוך ה־repo.  
הקובץ הזה **מתמלא רק כשמישהו קורא ל־API** – כלומר כשהאפליקציה שולחת אירוע לכתובת ה־API, וה־API כותב שורה לקובץ ב־Git.

כרגע:

1. **ב־`index.html`** מוגדר `ANALYTICS_ENDPOINT = ""` (ריק).  
   → האפליקציה **לא שולחת** שום אירוע לאף כתובת. גם אם מישהו נכנס לאתר ולוחץ "Find Best Match", הקוד בודק `if (!ANALYTICS_ENDPOINT) return;` ולכן לא קורה כלום.

2. **הקובץ `data/analytics.jsonl`** – או שלא קיים ב־repo, או ריק.  
   → הוא מתעדכן **רק** כשפונקציית ה־API רצה ומבצעת commit (קריאה ל־GitHub API). בלי קריאות ל־API, הקובץ לא משתנה.

3. **ה־workflow** מריץ את `analytics-summary.js` על ה־repo.  
   → הסקריפט קורא את `data/analytics.jsonl`. אם הקובץ חסר או ריק – תקבל "עדיין אין נתונים" / 0.

**מסקנה:** בתנאים הנוכחיים אי אפשר לקבל ניתור משתמשים אמיתי, כי אף אירוע לא נשלח ואף שורה לא נכתבת לקובץ.

---

### מה הכוונה "לפרוס את ה־API"?

ה־**API** = הקוד בתיקייה **`api/`** (במיוחד `api/event.js`). זה **לא** דף שאנשים נכנסים אליו בדפדפן, אלא **פונקציה שרצה בשרת**: כשמישהו שולח אליה בקשת POST (עם אירוע – כניסה או Find Workout), היא:

- קוראת את `data/analytics.jsonl` מ־Git (דרך GitHub API),
- מוסיפה שורת JSON אחת,
- עושה commit ל־repo.

**"לפרוס" (Deploy)** = להריץ את הפונקציה הזו על שרת חיצוני זמין באינטרנט, כך שיהיה לה **כתובת URL** (למשל `https://mama-wod-xxx.vercel.app/api/event`).  
זה נעשה ב־**Vercel**: מחברים את ה־repo ל־Vercel, מגדירים משתני סביבה (טוקן GitHub + שם ה־repo), ולוחצים Deploy. מאותו רגע, כל שליחה ל־`https://הפרויקט-שלך.vercel.app/api/event` מפעילה את הקוד וכותבת ל־`data/analytics.jsonl` ב־repo.

בלי פריסה – הקוד `api/event.js` קיים רק ב־repo אצלך, ואין שום שרת שמגיב לכתובת ולכן אי אפשר "לשלוח אליו" אירועים.

---

### מה צריך כדי לקבל ניתור אמיתי?

1. **לפרוס את ה־API ב־Vercel** (פעם אחת):
   - Vercel → ייבוא ה־repo → הוספת Environment Variables: `GITHUB_TOKEN`, `GITHUB_REPO` → Deploy.
   - אחרי הפריסה יש לך כתובת כמו `https://mama-wod-xxx.vercel.app/api/event`.

2. **לחבר את האפליקציה ל־API**:
   - אם האתר **רץ על Vercel** (אותו פרויקט) – אפשר להגדיר ב־`index.html`:  
     `var ANALYTICS_ENDPOINT = '/api/event';`
   - אם האתר **רץ על GitHub Pages** (או דומיין אחר) – להגדיר את הכתובת המלאה:  
     `var ANALYTICS_ENDPOINT = 'https://mama-wod-xxx.vercel.app/api/event';`

3. **לעדכן את האתר** (commit + push, או deploy מחדש), כדי שהמשתמשים יטענו גרסה שבה `ANALYTICS_ENDPOINT` מלא.

מאותו רגע, כניסות לאתר ולחיצות על "Find Best Match" ישלחו אירועים ל־API → ה־API יכתוב ל־`data/analytics.jsonl` → הדוח (מקומי או באימייל) יציג מספרים אמיתיים.

---

## מה צריך להגדיר (פעם אחת)

### 1. טוקן ב־GitHub

- GitHub → Settings → Developer settings → Personal access tokens.
- צור Token עם scope **`repo`** (גישה לכתיבת קבצים ב־repo).
- שמור את הטוקן במקום בטוח (תצטרך להזין ב־Vercel).

### 2. פריסת הפונקציה ב־Vercel (חינם)

- היכנס ל־[vercel.com](https://vercel.com) עם חשבון GitHub.
- "Add New" → "Project" → ייבא את ה־repo (mama-wod).
- **Environment Variables** בפרויקט:
  - `GITHUB_TOKEN` = הטוקן שיצרת.
  - `GITHUB_REPO` = `שם-המשתמש/שם-repo` (למשל `yourname/mama-wod`).
- Deploy. אחרי הפריסה תקבל כתובת כמו `https://mama-wod-xxx.vercel.app`.

### 3. חיבור האפליקציה ל־API

**אם האתר רץ ב־Vercel** (פריסה של אותו repo):
- אין צורך בשינוי – ב־`index.html` כבר מוגדר לשלוח ל־`/api/event` (אותו דומיין).

**אם האתר רץ ב־GitHub Pages** (או דומיין אחר):
- ב־`index.html` חפש את `ANALYTICS_ENDPOINT` והגדר לכתובת המלאה של הפונקציה, למשל:
  `var ANALYTICS_ENDPOINT = 'https://mama-wod-xxx.vercel.app/api/event';`

### 4. כיבוי ניתור

- השאר `ANALYTICS_ENDPOINT` ריק (או מחק את השורה ששולחת אירועים) – אז שום דבר לא נשלח.

---

## איפה ואיך לראות את הנתונים

**אין דשבורד באתר חיצוני** – הנתונים אצלך ב־Git, וצפייה רק אצלך במחשב.

### איפה הנתונים

- **קובץ הלוג:** `data/analytics.jsonl` בתוך ה־repo.  
  כל שורה = אירוע אחד (JSON), למשל:  
  `{"event":"page_view","t":1234567890123}` או `{"event":"find_workout","t":1234567890123}`.
- הקובץ נוצר/מתעדכן אוטומטית כשמישהו נכנס לאתר או לוחץ "Find Best Match" (אחרי שהפעלת את הניתור).

### איך לראות סיכום (פלטפורמה)

1. **במחשב שלך** – אחרי ש־`data/analytics.jsonl` קיים (למשל אחרי `git pull`):
   ```bash
   node scripts/analytics-summary.js
   ```
   הסקריפט רץ **מקומית** מתוך תיקיית הפרויקט, קורא את הקובץ ומדפיס:
   - סה"כ כניסות (page_view)
   - סה"כ שימוש באיתור אימון (find_workout)
   - פירוט לפי תאריך (כמה כניסות וכמה Find Workout בכל יום).

2. **ללא פלטפורמה חיצונית** – אין צורך ב־login לאתר או לשירות. אתה פותח טרמינל בפרויקט, מריץ את הפקודה למעלה, ורואה את הפלט.

3. **אם תרצה גרפים/טבלאות** – אפשר להריץ את הסקריפט ולהוסיף לעצמך דף HTML פשוט (או סקריפט אחר) שקורא את `data/analytics.jsonl` ומציג טבלה; כרגע הדרך הרשמית היא הפקודה למעלה.

---

## דוח שבועי באימייל (אוטומטי)

**שליחה לוואטסאפ:** לוואטסאפ אין API חינמי לשליחת הודעות למספר אישי, ולכן אי אפשר לשלוח את הדוח ישירות לוואטסאפ.  
**פתרון:** דוח **באימייל** דרך **Resend** + GitHub Actions – ברירת המחדל לנמען היא **contact.duckwod@gmail.com** (תיבת ניהול האפליקציה). ראו **`RESEND_SECRETS.md`** ו־**`.github/workflows/weekly-analytics-report.yml`**.

### מתי נשלח (אוטומטי)

- **כל יום שישי** בשעה מוקדמת (שעון ישראל) – ראו cron ב־workflow.

### איך מפעילים (פעם אחת)

1. הגדר ב־GitHub Actions את **`RESEND_API_KEY`** (ואופציונלית **`RESEND_FROM`**, **`ANALYTICS_REPORT_TO`**). פירוט: **`RESEND_SECRETS.md`**.
2. **נמען ברירת מחדל:** **contact.duckwod@gmail.com** (אלא אם הוגדר `ANALYTICS_REPORT_TO` או שדה `email_to` בהרצה ידנית).

### בדיקה – הרצה ידנית (לפי תקופה)

1. ב־GitHub: **Actions** → **📊 Weekly Analytics Report** → **Run workflow**.
2. בחר תקופה (`last_week`, `last_day`, `yesterday_today` וכו'), אופציונלית **דוח דוגמה** (`use_sample_data`).
3. אחרי שהריצה מסתיימת, המייל אמור להגיע ל־**contact.duckwod@gmail.com** (או לכתובת שבחרת ב־`email_to` / Secret).

**דוגמת פלט של הדוח (כך ייראה באימייל):**
```
--- Analytics (Git) ---
Total events: 17
Page views (sessions): 12
Find Workout uses: 5

By day (page_view | find_workout):
  2026-02-28  3  1
  2026-03-01  3  1
  2026-03-02  1  1
  ...
```

---

## פרטיות

- לא נשמרים מזהה משתמש, cookies או IP במפורש באירועים (רק `event` ו־`t`).
- הקובץ `data/analytics.jsonl` נמצא ב־repo – רק לך יש גישה אם ה־repo פרטי.

---

## קבצים רלוונטיים

| קובץ | תפקיד |
|------|--------|
| `api/event.js` | פונקציית Vercel שמקבלת אירוע ומוסיפה שורה ל־`data/analytics.jsonl` ב־Git |
| `data/analytics.jsonl` | קובץ לוג (נוצר אוטומטית אחרי אירוע ראשון) – כל שורה = אירוע JSON |
| `scripts/analytics-summary.js` | סקריפט לסיכום – מריץ מקומית ורואה כניסות + Find Workout |
| `index.html` | שולח אירועים ל־`ANALYTICS_ENDPOINT` (או `/api/event`) בלי להציג כלום למשתמש |
