# Generate Workout (Gemini) — הגדרת Vercel

הלשונית **Generate Workout** קוראת ל־`POST /api/generate-workout` על אותו פרויקט Vercel כמו `ANALYTICS_ENDPOINT` (ללא `/api/event`).

## 1. משתני סביבה ב־Vercel

| Variable | חובה | תיאור |
|----------|------|--------|
| **GEMINI_API_KEY** | כן | מפתח מ־[Google AI Studio](https://aistudio.google.com/apikey) |
| **GEMINI_MODEL** | לא | ברירת מחדל: `gemini-2.0-flash` (ניתן להחליף ל־`gemini-1.5-flash` וכו') |

אחרי הוספה: **Redeploy** את הפרויקט.

## 2. אבטחה

המפתח נשמר **רק בשרת Vercel** — לא ב־`index.html` ולא בדפדפן.

## 3. בדיקה

1. פתח את האתר אחרי deploy.  
2. לשונית **Generate Workout** → בחר ציוד + זמן → **Generate Workout**.  
3. אם מופיעה שגיאה על `GEMINI_API_KEY` — חזור לסעיף 1.
