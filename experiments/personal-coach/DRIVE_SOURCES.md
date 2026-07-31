# מקורות בסיס למאמן (Google Drive) + סנכרון מוח

## תיקיית Drive (מקור האמת שלך)
https://drive.google.com/drive/u/0/folders/1WLMbabNpXZ80qJPwgrxAY2I77CdTboAo

Folder ID: `1WLMbabNpXZ80qJPwgrxAY2I77CdTboAo`

**חשוב:** קישור HTTPS ל־Drive **לא** נקרא ישירות ע״י Gemini File Search.
צריך תיקייה מקומית (Drive Desktop או העתקה ל־inbox) ואז `npm run coach:sync-brain`.

## מראה מקומי (Google Drive for Desktop)
במחשב הזה זוהתה תיקייה מסונכרנת:

```
G:\My Drive\Duck WOD
```

ב־`.env.local`:

```
COACH_KNOWLEDGE_DIR=G:\My Drive\Duck WOD
```

(אם התיקייה לא מופיעה אצלך — הפעל סנכרון לתיקייה ב־Drive Desktop, או העתק קבצים ל־`knowledge-inbox/`.)

## איך המוח מחובר באפליקציה
- `/api/personal-coach` קורא ל־Gemini עם **File Search Store**
- מזהה ה־Store ב־`.env.local`: `GEMINI_FILE_SEARCH_STORE=fileSearchStores/...`
- **אין סנכרון יומי/cron** — רק דחיפה ידנית כשאתה מחליט

## זרימת עבודה (סנכרון מוח)

1. ודא שהמקורות בתיקיית ה־Drive (הקישור למעלה)
2. מקור הקבצים לסנכרון — אחת מהאפשרויות:
   - **מומלץ:** Drive Desktop מצביע על התיקייה (`COACH_KNOWLEDGE_DIR`)
   - **חלופה:** העתק/גרור ל־`experiments/personal-coach/knowledge-inbox/`
3. הרץ:
   ```
   npm run coach:sync-brain
   ```
4. הסקריפט מעלה **רק קבצים חדשים/שהשתנו** ל־File Search Store
5. הפעל מחדש `npm run dev:local` אם השרת כבר רץ
6. Personal Coach → המאמן משתמש בידע המעודכן

## פקודה
```
npm run coach:sync-brain
```

## מה עדיין לא אוטומטי
Gemini API **לא** קורא ישירות מ־Drive URL בלי העלאה ל־File Search.
לכן: Drive (אצלך) → תיקייה מקומית / Drive Desktop → `coach:sync-brain` → מוח המאמן.

## Store נוכחי
נוצר עבור הפרויקט כ־`duck-wod-hamamen-drive-sources` (המזהה המלא ב־`.env.local`).

### מצב סנכרון (עדכני)
| status | קבצים |
|---------|-------|
| synced (2026-07-28 endurance) | Zone 2 for CF athletes, Build better engine (WodPrep), איך לפתח מנוע לפי מאמנים, תוכנית מנוע לדוגמה, גישת ה־VO2 MAX |
| synced (2026-07-28 evening) | WeightLiftingCourse_SeminarGuide_V3, Olympic weightlifting training program, Corpus Publishers, מאמר קרוספיט והנפות אולימפיות |
| synced (2026-07-28) | GymnasticsCourse_SeminarGuide, Gymnastics for CrossFit Coaches — Comprehensive Training Guide, Mayhem-Athlete-Scaling-Doc |
| synced (2026-07-27) | Knee Injuries — Practical Guide for Scaling (CF-L3), Injury Substitutions Chart 2016, Assessment & Treatment CF Shoulder, Scaling — CFJ 2015 |
| synced (קודם) | 06_03_CF_Template, CF_Manual_v4, דוחות תכנות (beginner/intermediate/strategies), CFD L1 Handbook, NSCA Load Chart, Competitors Training Guide, CFJ Competitor Tincher, L2 Training Guide, crossfit-9, CFJ Seminars Training Guide |

**סה"כ במאגר: 29 מקורות** (+ staged learning-leap docs in `knowledge-inbox/` until approved sync)

**דוקטרינה (POL-018 + POL-021):** בסיס פירמידה = **L1 + L2**. מעליהם: תחקור מתאמן + מאגר (שיטות / מניעת פציעות / סקיילים / מנוע־סיבולת / דיג׳סטים חיים). בקשת שיפור בסקיל/1RM/מנוע = תרחיש רגיל. דיג׳סטים = עקרונות, לא העתקת אימונים.

**מסמכים חיים (קוד / inbox — סנכרון מוח רק אחרי אישור):**
- `living-knowledge/coach-patterns-myleo-restoration.md` — רענון שבועי (יום ראשון)
- `living-knowledge/coach-formats-warehouse.md` — מחסן Hero/Open/Benchmark
- `knowledge-inbox/pro-coach-articles/` — מאמרי מקצוע נוספים (אותו משקל כמו שאר המאגר)

פירוט בטיחות: `LEARNING_LEAP.md`.
