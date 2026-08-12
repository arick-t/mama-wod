# פרומפט למח המאמן — ניסוי Admin 1.5.9 · מתאמן «אריק מחשב 2»

**העתק את הבLOCK למטה למח המאמן.**  
Branch לטיפולים: `cursor/admin-block-handoff-display-f8bf`

---

## פרומפט (להדבקה)

```
אתה מח המאמן של DUCK-WOD (Personal Coach + Founder Admin).

### הקשר
שוחרר Admin 1.5.9 — חיבור GitHub Pages → Vercel API (`adminApiUrl`), תחקור 9 שלבים זהה לאפליקציה, Build plan → `generate_block` (Coach חי 2.3.8), שמירה + handoff.

### מה עשיתי בניסוי (2026-08-12)
1. פתחתי Admin 1.5.9 · Coach 2.3.8 מ-a-wod.vercel.app (או GitHub Pages).
2. +מתאמן → תחקור 9 שלבים — **נראה זהה לאפליקציה** ✓
3. Build plan — **לקח המון זמן** (דקות רבות; המתנתי).
4. בסוף: **popup עם לינק handoff להעתקה** — מעולה ✓
5. נפתחה לשונית מתאמן **«אריק מחשב 2»** במודול מאמן.

### מה קיבלתי (בעיות)
1. **לינק handoff** — קיים רק ב-popup אחרי יצירה. **חסר** בלשונית המתאמן כפתור «העתק לינק» / תצוגת הלינק שנוצר (יש UI ל-handoff בכרטיס אבל לא מולא אוטומטית אחרי create).
2. **בלוק אימון ריק** — בלוח «בלוק אימון» כל הימים מציגים **«ללא תכנון»** (אוגוסט 2026), למרות ש-Build plan הסתיים + popup handoff.
3. **עיצוב בלוק** — לא נראה כמו בלוח האימון באפליקציית המתאמן (pprog day cards, parts, overview strip). Admin משתמש ב-render נפרד.
4. **מייל פתיחת משתמש חדש** — **לא קיבלתי** מייל על פתיחת/הצטרפות משתמש חדש (join email / notify founder). ציפיתי לקבל אחרי יצירת «אריק מחשב 2» מהאדמין.

### שאלות אליך (מח)
1. **האם קיבלת אינדיקציה** על מתאמן חדש **«אריק מחשב 2»** (create_athlete / admin-handoff / snapshot)?
2. **האם generate_block** החזיר BLOCK_JSON עם `weeks[]` מלא + `blockStart`? אם חסר `blockStart` — האם זה מסביר לוח ריק באדמין?
3. **למה Build plan** כל כך ארוך — timeout/retries/Gemini — מה מומלץ (בלי לפגוע באיכות)?
4. **מייל join** — למה לא נשלח? האם `create_athlete` מהאדמין אמור לשלוח `sendJoinMailAndAnalytics` / notify (כמו intake_complete מהטלפון)? איזה endpoint/trigger חסר?

### בקשת מוצר (HARD — כמו תחקור)
**הצגת בלוק אימון באדמין = אותו צינור/עיצוב כמו באפליקציה.**

כמו שעשינו לתחקור (9 שלבים 1:1, `CoachIntakeSync`, `FIXED INTAKE COMPLETE` → generate_block):
- Admin לא יבנה UI/לוח נפרד — **ישתמש באותם רenders / CSS / לוגיקת pprog** כמו `index.html` (calendar strip, day card, parts bullets, Rest/LOGGED).
- אותו `currentBlock` shape אחרי normalize (`blockStart`, `weeks[].days`, `overview`).
- Handoff: אחרי create — **לינק זמין מיד בכרטיס מתאמן** (העתק לינק), לא רק popup.

### אילוצים
- איכות תכנות לבנה — non-negotiable (Coach 2.3.x, generate_block אמיתי).
- Admin = צד 3; המתאמן מקבל handoff למכשיר + Terms על המכשיר.

### מה אני צריך ממך
1. אבחון: למה הלוח ריק + האם אתה רואה את אריק מחשב 2.
2. תוכנית: איך לחבר תצוגת בלוק admin ל-pprog UI (קבצים / shared module / normalize block on save).
3. handoff UX: persist + show link בכרטיס אחרי autoCreateLink.
4. **join email:** trigger מ-`create_athlete` (admin) — parity עם `sendJoinMailAndAnalytics` מהאפליקציה.
5. (אופציונלי) build time — המלצות בלי stub.

ענה בעברית, ממוקד, עם רשימת קבצים לשנות.
```

---

## נספח טכני (למח / למפתח)

| נקודה | קוד נוכחי |
|--------|-----------|
| שמירת מתאמן + block | `admin-fixed-intake.js` → `finalizeNewAthlete` → `POST admin-handoff create_athlete` |
| popup לינק | `window.prompt(...)` — לא מעדכן `lastHandoffUrl` / כרטיס |
| לוח admin | `admin.html` → `buildBlockWorkoutMap` — **דורש `blockStart` תקין** אחרת map ריק |
| handoff בכרטיס | `renderHandoffSectionBody` + `createHandoffLink` — קיים, לא נקרא אחרי intake |
| join email | `index.html` → `sendJoinMailAndAnalytics` — רץ מ-intake_complete **בטלפון**; **לא** מ-`create_athlete` באדמין |
| אפליקציה | `index.html` → `renderPprogWeek`, `pprog-day-card`, `normalizePprogWeek` |

## Open fixes (branch)

1. Persist handoff URL on snapshot + show copy button in athlete tab after create.
2. Normalize `blockStart` + weeks on save (parity with `applyPprogBlock`).
3. Shared block calendar/day render from app (or embed pprog read-only view).
4. **Join email on admin create_athlete** — notify founder when new athlete created from admin (email entered in intake).
