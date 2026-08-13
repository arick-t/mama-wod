# פרומפט למנוע תקציב — Admin intake ↔ Coach · בדיקת זליגות עלות

**מטרה:** להעביר למנוע התקציב / מח עלות (POL-COST) ולוודא שאין זליגות בטעות אחרי חיבור Admin לתחקור + השינויים האחרונים.

**Branch נוכחי:** `cursor/admin-retest-round2-f8bf`  
**Live (עד merge):** Admin 1.5.10 על Pages; branch מקומי כבר 1.5.11 (UI בלבד).

---

## פרומפט (העתק והדבק)

```
אתה מנוע התקציב / שומר עלות של DUCK-WOD (POL-COST-001..010 + שערים ב-lib/coach-cost-caps.js + api/personal-coach.js).

תפקידך: לבדוק האם חיבור Founder Admin לתחקור המאמן + השינויים האחרונים יוצרים **זליגות עלות** (קריאות AI מיותרות, כפילות יחידות, עקיפת caps, חיוב כפול, או שינוי שמגדיל חשבון בטעות).

ענה בעברית, ממוקד, עם רשימת סיכונים + קבצים. אל תציע stub / תבניות במקום generate_block אמיתי.

════════════════════════════════════
1) איך Admin מחובר לתחקור המאמן (צינור יחיד)
════════════════════════════════════

Admin «+ מתאמן» אינו תחקור נפרד. הוא אותו צינור כמו באפליקציית המתאמן:

1. UI תחקור קבוע 9 שלבים (profile → setup → schedule → recovery → lifts → skills → limits → injuries → goals)
   · חוזה משותף: lib/coach-intake-sync-contract.js (CoachIntakeSync)
   · Admin UI: admin-fixed-intake.js + admin.html
   · אפליקציה: index.html (אותו packet)

2. בסיום: buildFixedIntakePrompt → מחרוזת "FIXED INTAKE COMPLETE …"

3. Build plan → POST /api/personal-coach
   · action: "generate_block"
   · messages: [{ role: "user", text: fixedIntakePacket }]
   · athleteProfile: CoachIntakeSync.athleteProfileForGenerateBlock(...)
   · intakeComplete: true
   · forceJson: true
   · adminProgramming: true (+ סיסמת אדמין ב-body/headers)
   · timeout 180s + עד 2 retries על כשל רשת/timeout
   · קובץ: admin-fixed-intake.js → generateIntakeBlockFromFixedPacket()

4. אחרי BLOCK_JSON תקין:
   · NormalizePprogBlock.normalize(block, null)  ← lib/normalize-pprog-block.js
   · POST /api/admin-handoff action=create_athlete
     · currentBlock (מנורמל), intakeProfile, fixedIntakePacket, autoCreateLink: true
   · שרת גם מנרמל שוב + שומר snapshot + יוצר לינק claim
   · שולח מייל intake_complete למייסד (lib/admin-intake-complete-mail.js) — **לא** קריאת Coach/Gemini

אילוץ מוצר HARD: generate_block אמיתי בלבד (Gemini/איכות מלאה). אין stub / offline template כתחליף.

════════════════════════════════════
2) מה השתנה לאחרונה (רלוונטי לעלות)
════════════════════════════════════

A. Admin 1.5.9 (כבר ב-main / live Pages)
   · GitHub Pages → mama-wod.vercel.app דרך adminApiUrl (לפני כן /api יחסי → 404)
   · תחקור 1:1 + Build plan → generate_block אמיתי
   · זה **כן** קריאת תכנות יקרה (לבנה 5 שבועות) — מכוון, לא זליגה

B. Admin 1.5.10 (merged #82)
   · normalize block לפני שמירה (client + server) — לוגיקה מקומית, **0 AI**
   · lastHandoffPath על snapshot + הצגת לינק בכרטיס — **0 AI**
   · join mail מ-create_athlete — Brevo/mail בלבד, **0 AI / 0 יחידות POL-COST**
   · index.html טוען normalize-pprog-block.js ומפנה normalizePprogBlock אליו — אותה לוגיקה, לא קריאה כפולה ל-API

C. Admin 1.5.11 (branch retest — UI בלבד, עדיין לא live)
   · כפתור handoff קומפקטי תחת «פעיל»; הסרת chip «חבר מאמן»
   · **0 AI / 0 שינוי צינור תכנות**

D. Coach חי (main): ~2.3.12 — לא שינינו איכות תכנות בגלל Admin UI.

════════════════════════════════════
3) איך עלות אמורה להיספר (לפי הקוד)
════════════════════════════════════

· שער קשה: evaluateCostCapGate ב-lib/coach-cost-caps.js לפני ספק ה-AI
· generate_block עם intakeComplete=true (וגם autoNextBlock) נחשב allowFill —
  לא נחסם ע"י daily programmed-edit / large-rebuild window; **monthly envelope עדיין חל**
· adminProgramming=true ב-personal-coach עוקף רק שער Terms על המכשיר —
  **לא** אמור לעקוף POL-COST monthly
· create_athlete / create_link / normalize / join mail — מחוץ ל-personal-coach programming

יחידות מוכרות (צד לקוח / פוליסי): brick_fill ≈ 8 ליחידה על לבנה ראשונה; monthly cap ≈ 40; daily programmed edits = 2.

════════════════════════════════════
4) שאלות HARD למנוע תקציב (חפש זליגות)
════════════════════════════════════

1. **Admin Build plan:** האם generate_block מהאדמין עם intakeComplete=true נספר נכון כ-brick_fill / יחידות חודשיות של **אותו athleteId**, או שהוא «נופל» לחשבון גלובלי / בלי athleteId / בלי costCaps?

2. **כפילות:** האם יש סיכון שאותו Build plan יחויב פעמיים בגלל:
   · 180s timeout + retry (עד 2) — retry אחרי abort באמצע תשובה?
   · normalize ב-client ואז שוב ב-server?
   · create_athlete שולח mail + analytics בנפרד?

3. **adminProgramming:** האם דגל זה (או סיסמת אדמין) פותח בטעות נתיב שמדלג על COST_CAP_MONTHLY / daily / large? אם כן — איפה ב-personal-coach.js?

4. **פרופיל ריק:** athleteProfile מהאדמין בזמן generate_block — האם costCaps ריקים גורמים ל-gate תמיד לעבור (monthlyUsed=0) גם כשלאתלט יש כבר לבנה/שימוש בחודש? (מתאמן חדש vs reclaim)

5. **Handoff / claim:** טעינת תוכנית במכשיר דרך claim.html — האם מפעילה generate_* נוסף, או רק מורידה package שמור?

6. **Push upgrade / Soft / remaining_rebuild:** האם השינויים האחרונים ב-Admin UI שינו משהו בנתיבי עלות האלה? (צריך: לא)

7. **Mail intake_complete:** האם יש side-effect שמריץ personal-coach או event יקר? (צפוי: לא)

8. **זליגת תצוגה:** render לוח / normalize / העתקת לינק — וידוא שאין fetch ל-personal-coach מאחורי הקלעים.

9. **ניסוי חוזר:** Founder עושה כמה «+ מתאמן» + Build plan באותו יום ממחשב — מה המעטפת החודשית הצפויה (N × brick_fill), ומה נחשב זליגה מול שימוש לגיטימי?

════════════════════════════════════
5) מה אני צריך ממך בחזרה
════════════════════════════════════

1. פסק דין: **אין זליגה / יש זליגה** (+ חומרה).
2. טבלת נתיבים: פעולה → קריאת AI? → יחידות? → athlete scope? → cap שחל.
3. אם יש זליגה: קובץ + תיקון מוצע (בלי להחליש איכות generate_block).
4. רשימת regression: 3 בדיקות ידניות קצרות לוודא אחרי תיקון.

אל תיגע באיכות תכנות הלבנה. תקציב ≠ קיצור איכות.
```

---

## נספח מהיר (למייסד)

| פעולה | AI? | עלות POL-COST? |
|--------|-----|----------------|
| תחקור 9 שלבים (UI) | לא | לא |
| Build plan → generate_block | **כן** | **כן** (לבנה / brick_fill; monthly חל) |
| normalize block | לא | לא |
| create_athlete + claim link | לא | לא |
| join email | לא (מייל) | לא |
| כפתור handoff / העתקה | לא | לא |
| טעינת claim במכשיר | לא (הורדת package) | לא — אלא אם המתאמן מבקש תכנות חדש אחר כך |
