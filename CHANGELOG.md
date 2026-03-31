# Changelog

## [20.3.0] - 2026-03-31

### Workout Tools & CONVERTOR
- **Workout Tools tab:** dashed gold styling (parallel to Generate Workout green tab).
- **CONVERTOR:** distance & weight tables (any-cell sync); inches; aerobic calculator with **ROW / RUN / BIKE / A.BIKE / SKI**; RUN = meters only, A.BIKE = calories only; conversions aligned to reference meter + calorie equivalence tables (shared row-cal baseline).
- **UX:** numeric-friendly inputs, default 1 m / 1 kg, disclaimer **i** next to Aerobic calculator; brand colors; layout fixes for mobile.

### Versioning
- Site **v20.3**; semver `20.3.0`; Android `versionCode` 24 / `versionName`; iOS `CURRENT_PROJECT_VERSION` 24 / `MARKETING_VERSION`.

---

## [20.2.0] - 2026-03-29

### Release (stable)
- **Versioning:** Site display **v20.2** (no BETA tab styling). Semver / stores: `20.2.0`; Android `versionCode` 23 / `versionName`; iOS `CURRENT_PROJECT_VERSION` 23 / `MARKETING_VERSION`.
- **Generate Workout:** Gym presets — dedicated preset-linked prompt panel, dock chips in coach row, toolbar-only edit/delete, preset prompt preview via **i** on bank/dock chips.
- **Coach (API):** Cardio/engine substitution rule + WODwell conversion charts reference; credits in About & Sources.

---

## [20.1.0-beta.2] - 2026-03-29

### AI Builder (BETA)
- **D-BALL:** משקל בק״ג בלבד בשדה קומפקטי ליד הסימון; שמירה בפריסט וטעינה מחדש; שרת מקבל `dballWeight` + הנחיות מאמן.
- **זמן:** שורת זמן קומפקטית (±5, דקות, **Unlimited Time**) ממורכזת; חסימת שדה הדקות כש-Unlimited; פרומפט מאמן: ב-Unlimited חובה לקבוע זמנים/כובעים מפורשים באימון.
- **ציוד:** הרשימה = בריכת אפשרויות (לא חובה להשתמש בהכול); מ־4 מודאליטים (אחרי מיזוג BARBELL+RIG כאחד) אפשר להשמיט ציוד אלא אם צוין במלל חופשי; עדכון ℹ️ Equipment.
- **וידאו טעינה:** `assets/coach-loading.mp4` (מותג) + גיבוי; הוסר כפתור Preview לפרודקשן; `build-capacitor-web` מעתיק `assets/`.

### Versioning
- `20.1.0-beta.2` — `VERSION`, `package.json`, `package-lock.json`, Android `versionCode` 22 / `versionName`, iOS `CURRENT_PROJECT_VERSION` 22 / `MARKETING_VERSION`. תצוגת אתר: **v20.1 BETA** (ללא שינוי כותרת משנה).

---

## [20.1.0-beta.1] - 2026-03-28

### AI Builder (BETA) — קוסמטיקה ו־UX
- תצוגת אימון שנוצר: כרטיס כמו Browse עם מסגרת זהב (`ai-generated`), שמירת מבנה כותרות/תתי־כותרות, כפתור **Share** ל־WhatsApp כמו בשאר האימונים.
- תגיות: **Show exercise demos**, **Add Warm-up**; הוסרה שליטת משתמש ב־Default coach (תמיד פעיל בשרת); ניקוי תגיות יתומות מ־DOM (בנייה ישנה).
- **Reset all** בלבד: מסיר כל התגיות מעל תיבת ההערות + מאפס ציוד וטופס; הוסר כפתור "Reset options to defaults" המיותר.
- מספר גרסה מוצג באתר: **v20.1 BETA**; semver / חנויות: `20.1.0-beta.1` (`versionCode` / `CURRENT_PROJECT_VERSION` → 21).

### Versioning
- סנכרון `index.html`, `package.json`, `VERSION`, `package-lock.json`, `web/`, Android, iOS.

### CI / GitHub Actions
- צמצום שורות ב־workflows: דוח שבועי — לוגיקה ב־`scripts/ci-weekly-analytics-report.sh`; איחוד צעדי `analytics-tests`; דחיסת `daily-fetch`; איחוד **Android Device Build** לתוך **Android Capacitor Build Check** (אופציית `upload_apk`); ייעול `ios-capacitor-build`.

---

## [20.0.0-beta.1] - 2026-03-28

### AI Builder (BETA)
- לשונית **AI Builder BETA** נפרדת מ־Find Workout: בנק תגיות (Default coach, Demos, Extended athlete profile, Warm-up, Strength, Weightlifting), פרופיל מורחב (רמה, שנים, משקל גוף, מין, גיל, בריאות, מספר ספורטאים), מבנה סשן (חימום / כוח / הרמת משקולות) ושליחה ל־`/api/generate-workout` עם ניסיונות חוזרים וטיימאאוט.
- שרת: פרומפט מאמן ברירת מחדל (מושגי L1, קישור PDF רשמי בלבד, כללי Open/Hero, הטיית תחרות ל־competitor), תמצית מחסן (שמות Open/Hero מ־`specialData` / `special_cache.json`) כשזמין.

### Versioning
- שחרור בטא **v20.0.0-beta.1** — סנכרון `index.html`, `package.json`, `VERSION`, `package-lock.json`, תיקיית `web/` (Capacitor), `android/app/build.gradle` (`versionCode` / `versionName`), `ios` (`MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`).

---

## [19.8.3] - 2026-03-23

### Ops / email
- דוח ניתור משתמשים (Resend): ברירת מחדל חזרה ל־**ariel.tahan@gmail.com** (תואם חשבון Resend / Vercel; בלי דומיין מאומת אין משלוח אמין לתיבת ניהול נפרדת).
- הוסר workflow **Resend email test** – אין מייל בדיקה אוטומטי נפרד; בדיקה = הרצה ידנית של **Weekly Analytics Report**.

### Product (ללא שינוי מהותי מ־19.8.2)
- About + קרדיטים + דיסקלימר; קרדיטים ב־Sources ובפוטר; מייל קונטקט ציבורי **`contact.duckwod@gmail.com`** ב־`mailto` בלבד.

---

## [19.8.2] - 2026-03-23

### About & attribution
- לשונית **About** עם משפט מוצר, רשימת קרדיטים וקישורים למקורות.
- בלוק **Sources & attribution** בלשונית Sources + **פוטר** עם קישור ל־About.

### Sources
- **הוסר** מקור Linchpin מהאפליקציה ומ־fetch; רשומות ישנות מוסרות ב־`save()` (מקור מושבת).

---

## [19.8.1] - 2026-03-22

### Browse / UX
- **סוויפ בין ימים**: מעבר יום רק כשהתנועה האופקית בולטת על פני גלילה אנכית — מתקן קפיצה לא מכוונת ליום הקודם בזמן גלילת אימונים.

### Ops
- **Daily fetch**: ריצה נוספת ב־~05:00 ישראל (03:00 UTC) לצד 05:30 ו־08:00.

---

## [19.8] - 2026-03-21

### Product version sync
- **מספר גרסה אחיד**: `v19.8` ב־UI (`index.html`), `19.8.0` ב־`package.json`, קובץ `VERSION` בשורש הפרויקט.
- **CI**: `run-name` ל־workflows, סינון `paths` (בניית Capacitor לא רצה על קומיטי analytics בלבד).

### Timer & mobile (ממשיכים מ־19.7)
- שעון: מסך מלא, מצב 1/2, סטופוואץ׳/אינטרוולים, שדרוגי WebAudio + פלאגין AudioPriority (iOS/Android) לצלילים.

---

## [19.6] - 2026-02-27

### Timer
- Wider input fields for minutes/seconds (Work, Rest, Rest Between Sets, Time) so 4 digits display clearly (7ch).

---

## [19.5] - 2026-02-27

### Find Workout
- Always show top 3 from box sources (14-day workouts); up to 3 from Hero/Benchmark/Open when checkboxes selected. Display order: boxes first, then warehouses.
- Scoring: WOD-only text for equipment/time; two-phase by equipment "extra" (prefer extra ≤1); labels: התאמה מלאה, זמן שונה, התאמה חלקית.
- Unlimited time: no longer zeros score; full time points when "Unlimited time" is checked.
- Guards: getWodOnlyText/scoreWod handle missing sections or bad data; try/catch in find loop; message when no workout data loaded yet.

### Benchmarks
- No duplicate benchmark names in 14-day view (e.g. Grace, Barbara once). `fetch_benchmarks_for_days(dates)` returns one unique benchmark per day.
- Scraper: dedupe by normalized name; parse `<ul>`/`<ol>`/`<li>` and `<h1>`–`<h4>` so full workout content is captured (e.g. Nicole). `fetch_all` uses batch benchmark assignment.

---

## [19.4] - 2026-02-27

### Timer fullscreen (intervals + stopwatch)
- **Sounds**: Single AudioContext created on Start (user gesture); beep/whistle/bell at every work↔rest and rest-between-sets transition (reliable on mobile).
- **UI**: "Remaining" → "Overall Time" (top); phase name larger; Round left, Set right; Pause between LAST/NEXT; ▶/⏸/Close.
- **Stopwatch (For Time)**: Count-up with filling ring; bell at work start, whistle at rest; config tightened; removed Next/5:00 preview.
### Weights
- **lb → kg**: All "X lb" shown as "X lb (Y kg)" in cards and Open (formatLbToKg).
### Official site scraper
- Scraper returns no WOD on Sundays; day bar shows 14 non-Sunday days only.
### Dev
- DEV.md, serve-mobile.ps1, serve-mobile.cmd for local phone testing.

---

## [19.3] - 2026-02-27

### Timer (Workout Timers tab)
- Set & round display: interval shows "Set X/Y · Round R/Z" and "Rest Between Sets — Set 2→3"; toggles for "Merge adjacent rests" and "3 beeps" (ON/OFF); note about sounds over device audio.
### Dev
- Mobile testing: Live Server useLocalIp, DEV.md, serve-mobile.ps1.

---

## [19.2] - 2026-02-15 (Evening, Second Fix)

### 🔧 Fixed
- **Ton Bridge**: 
  - Separator line ("By NAME|DATE") now excluded completely
  - Section titles normalized: "Met Con" → "METCON"
  - Skip lines with "by" or "posted"
  
- **Benchmarks**:
  - Restored v19 working code (v19.1 broke it)
  - Added gender weights as notes: *♀ 55 lb ♂ 75 lb*
  
- **Open WODs**:
  - Complete rewrite of scraping logic
  - Now finds 15+ workouts (was 0 in v19.1)
  - Better HTML parsing (h1-h4 headers)
  - Gender weights as notes

- **Workflow**:
  - Auto-triggers on push to main/master
  - Watches backend/** and workflow file changes

### 📊 Result
- All 10/10 sources working
- ~140 WODs total
- No regressions from v19

---

## [19.1] - 2026-02-15 (Afternoon) - BROKEN

### ❌ Regression
- Benchmarks stopped working (0 workouts)
- Open stopped working (0 workouts)
- Lost functionality from v19

---

## [19] - 2026-02-15 (Morning)

### 🔧 Fixed
- Heroes: Full workouts
- Benchmarks: Correct titles
- Ton Bridge: New URL
- Open: Re-enabled

---

## [18] - 2026-02-10

### 🎉 Initial Release
