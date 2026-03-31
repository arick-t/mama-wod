# 🦆 DUCK-WOD — גרסה **20.2.0** (`package.json`: `20.2.0`)

**Workout aggregator** — daily WODs from multiple sources

> הגרסה המוצגת באתר היא **v20.2** (כותרת + פס משני). מקור אמת: `VERSION` + `package.json` — ראו `docs/VERSIONING.md`.

## ✅ v20.2.0 (Mar 2026)

- **Generate Workout:** פריסטי מכון — תיבת פרומפט ייעודית, דוק בשורת המאמן, עריכה/מחיקה מהסרגל העליון, תצוגת פרומפט ב־**i** על הלשונית במחסן/דוק.
- **מאמן (API):** כללי חלופות קרדיו + הפניה ל־WODwell; קרדיט ב־About / Sources.
- **ללא תג BETA** על לשונית Generate.

## ✅ v20.1.0-beta.2 (Mar 2026)

- **AI Builder (בטא):** D-BALL ק״ג + פריסטים; זמן קומפקטי + Unlimited; בריכת ציוד / כלל 4+ מודאליטים; וידאו טעינה מותג.
- **API:** `/api/generate-workout` (דורש `GEMINI_API_KEY` / Groq ב־Vercel).

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
unzip duck-wod-v20.2.0.zip
cd your-repo && rm -rf * 
cp -r ../duck-wod-v20.2.0/* . && cp ../duck-wod-v20.2.0/.gitignore . && cp -r ../duck-wod-v20.2.0/.github .
git add . && git commit -m "🔧 v20.2.0" && git push
```

Workflow runs automatically after push!

## 📋 Sources

**Special**: Hero • Benchmark • Open  
**Boxes**: myleo • Official site • Restoration • 1013 • Panda • Ton Bridge

---

**Version 20.2.0 (v20.2)** • Mar 2026 • Generate Workout + presets — stable ✅
