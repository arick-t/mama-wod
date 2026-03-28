# 🦆 DUCK-WOD — גרסה **20.1.0-beta.1** (`package.json`: `20.1.0-beta.1`)

**Workout aggregator** — daily WODs from multiple sources

> הגרסה המוצגת באתר היא **v20.1 BETA** (בטא; בכותרת ובפס המשני). מקור אמת: `VERSION` + `package.json` — ראו `docs/VERSIONING.md`.

## ✅ v20.1 BETA / 20.1.0-beta.1 (Mar 2026)

- **AI Builder BETA:** שיפורי תצוגה (כרטיס זהב, שיתוף WA), תגיות ואיפוס טופס; מאמן ברירת מחדל תמיד בשרת.
- **API:** `/api/generate-workout` (דורש `GEMINI_API_KEY` ב־Vercel).

## ✅ v20.0.0-beta.1 (Mar 2026) — BETA

- **AI Builder BETA:** לשונית נפרדת, תגיות, פרופיל מורחב, מבנה סשן, Gemini.
- **גרסה:** שחרור בטא ראשון ב־v20.

## ✅ v19.8.3 (Mar 2026)

- **Ops:** דוח ניתור → `ariel.tahan@gmail.com`; הסרת workflow מייל בדיקה.
- **מוצר (כמו 19.8.2):** About, קרדיטים, דיסקלימר, מייל קונטקט `contact.duckwod@gmail.com` ב־UI בלבד.

## ✅ v19.8.2 (Mar 2026)

- **About & credits**: לשונית About, קרדיטים ב־Sources, פוטר גלובלי.
- **מקורות**: מקור Linchpin הוסר מהאפליקציה ומ־fetch.

## ✅ v19.8.1 (Mar 2026)

- גלילת אימונים: תיקון קפיצה ליום קודם (סוויפ ימים רק כשהמחווה אופקית-dominant).
- Fetch יומי: ריצה נוספת ~05:00 ישראל.

## ✅ v19.8 (Mar 2026)

- שעון: מסך מלא / פריסות, שדרוגי צליל (Web + Capacitor), CI workflows.
- סנכרון מספור גרסאות.

## ✅ v19.7 (Feb 2026) — Sources polish & UI cleanup

- ✅ **MYLEO**: Score/stimulus as notes; aerobic power [vo2 max] & muscular endurance as notes; block spacing.
- ✅ **CF 1013**: Article-based parsing (Strength / WOD); sub-subheading for WOD name; pagination (2 weeks history); Saturday single block.
- ✅ **Benchmarks**: No duplicate name line; 15-day unique window.
- ✅ **UI**: Removed debug “last fetch” / “reload data” row.

**Status**: 10/10 sources working • ~140 WODs • 100% clean

## 🚀 Quick Upgrade

```bash
unzip duck-wod-v20.1.0-beta.1.zip
cd your-repo && rm -rf * 
cp -r ../duck-wod-v20.1.0-beta.1/* . && cp ../duck-wod-v20.1.0-beta.1/.gitignore . && cp -r ../duck-wod-v20.1.0-beta.1/.github .
git add . && git commit -m "🔧 v20.1.0-beta.1" && git push
```

Workflow runs automatically after push!

## 📋 Sources

**Special**: Hero • Benchmark • Open  
**Boxes**: myleo • Official site • Restoration • 1013 • Panda • Ton Bridge

---

**Version 20.1.0-beta.1 (v20.1 BETA)** • Mar 2026 • AI Builder BETA — בדיקות מומלצות ✅
