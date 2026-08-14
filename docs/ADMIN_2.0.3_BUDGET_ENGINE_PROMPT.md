# פרומפט למנוע תקציב — Admin 3.0 (בראנץ' `cursor/admin-small-tweaks-f8bf`)

**מטרה:** להעביר למנוע התקציב / שומר עלות (POL-COST) ולוודא שאין זליגות אחרי יישום שני פיצ'רי האדמין + סנכרון שמירה אוטומטי.

**Branch:** `cursor/admin-small-tweaks-f8bf` (base `main`) · PR https://github.com/arick-t/mama-wod/pull/90  
**Admin UI:** **3.0** (כותרת עלייה) · **Coach:** 2.3.13 (לא נגענו)  
**שים לב:** `main` כבר עלה ל־Admin **2.0.2** מפריטי מנוע התקציב (PR #91: חיוב UID + כדור קרדיט). הבראנץ' הזה ממזג את 2.0.2 ועולה ל־3.0 בשביל שני הפיצ'רים. אל תבלבל בין 2.0.2 של התקציב לבין מספרי עבודה פנימיים ישנים (2.0.2/2.0.3) בבראנץ'.

---

## פרומפט (העתק והדבק)

```
אתה מנוע התקציב / שומר עלות של DUCK-WOD (POL-COST-001..010 + שערים ב-lib/coach-cost-caps.js + api/personal-coach.js).

תפקידך: לבדוק האם השינויים בבראנץ' cursor/admin-small-tweaks-f8bf (Admin 3.0 מול main שכבר כולל Admin 2.0.2 תקציב / PR #91) יוצרים **זליגות עלות** — קריאות AI מיותרות, כפילות יחידות, עקיפת caps, חיוב כפול, remaining_rebuild בטעות, או שינוי שמגדיל חשבון בלי כוונה.

ענה בעברית, ממוקד, עם רשימת סיכונים + קבצים. אל תציע stub / תבניות במקום generate_block אמיתי. תקציב ≠ קיצור איכות תכנות.

════════════════════════════════════
0) גבול הסקופ — מה כן / לא בבראנץ'
════════════════════════════════════

git diff origin/main...HEAD — פיצ'רי Admin 3.0 בלבד (אחרי מיזוג PR #91):

כן (Admin + תצוגה משותפת + טסטים):
  admin.html
  lib/admin-day-edit.js
  lib/admin-done-debrief.js          ← חדש, 0 LLM, תבנית עברית מקומית
  lib/pprog-display.js               ← וו עיגול כבוי כברירת מחדל
  scripts/lib/admin/admin-snapshot.js
  + טסטים ב-scripts/*

כבר ב-main מ-PR #91 (מנוע תקציב, Admin 2.0.2) — לא לגעת שוב / לא להחליש:
  api/personal-coach.js · lib/coach-cost-caps.js · admin-fixed-intake.js
  scripts/lib/admin/admin-credit-estimate.js · חיוב UID + flush קרדיט

פיצ'רי 3.0 לא מוסיפים diff על:
  index.html                         ← כפתור Done / picker חלקים / מוח במכשיר
  lib/coach-push-upgrade.js
  מדיניות מאמן / פרומפטי generate_block / generate_week_detail / revise_*

Coach נשאר 2.3.13. אין Gemini / מודל לכתיבת הודעת תחקיר או לעריכת חלקים.
כותרת המוצר לעלייה: Admin 3.0 (לא 2.0.2/2.0.3).

════════════════════════════════════
1) מה יושם בבראנץ' (שלושה אשכולות)
════════════════════════════════════

A) Admin 2.0.2 — שמירת יום = סנכרון אוטומטי, בלי כפתור דחיפה, בלי MODIFIED
   · כל Save של עריכת חלקים קורא admin_save_day (כבר היה T4, 0 LLM).
   · כותב pendingAdminDayEdit; המכשיר מושך בצינור הקיים athlete_pull_push_offer (~20 שנ').
   · אחרי apply: מחליף את parts[] המלא של אותו יום במכשיר. modifiedPartKinds = {}.
   · הוסר מ-admin.html: כפתור «עדכון בדחיפה», chooser soft/remaining_rebuild, שליחת admin_push_upgrade_offer מה-UI.
   · API admin_push_upgrade_offer עדיין בשרת (לא נמחק) — פשוט אין כפתור ששולח אותו.
   · תווית ירוקה «סונכרן» במקום «ממתין לסנכרון» / «צריך עדכון מח».
   · טוסט: «נשמר וסונכרן».

B) Admin 2.0.3 חלק א — תחקיר Done בלוח האדמין (0 LLM)
   · מקור: currentBlock.weeks[wi].days[dayKey].finishFeedback שכבר מגיע בצילום אחרי Done (pushAdminSnapshot / finish_done). אין צינור חדש.
   · עיגול בלוח רק אם finishFeedback.rating קיים. חזק=לא נקרא, אחרי לחיצה=חלש.
   · לחיצה על יום עם תחקיר → פותחת «היסטוריית שיח מול המאמן» ומציגה תבנית עברית מקומית (AdminDoneDebrief.formatMessage). לא JSON, לא תשובת מוח.
   · אין כתיבה ל-adminChatLog בכל לחיצה. אין auto-reply למתאמן.
   · נקרא/לא-נקרא: doneDebriefRead על רשומת האדמין + action חדש admin_mark_done_read (כתיבת blob בלבד).
   · וו ב-PprogDisplay.renderCalHtml: showDoneDots כבוי כברירת מחדל. אדמין מדליק true. לוח המתאמן בלי עיגולים.
   · דגל אדום רק בהודעה אם safety_flag===true. לא משנה צבע עיגול.

C) Admin 2.0.3 חלק ב + הצגת רוחב
   · עריכת חלקים חייבת לכתוב parts[] מלא (כבר T4). נעילה: rest / past / finishFeedback / LOGGED. דחיית שמירה בלי title+work/format.
   · הצגת רוחב: בחירת ≥2 ימים → כרטיסים קיימים ברצועה. תצוגה מקומית בלבד, בלי generate_*, בלי bulk-save.

════════════════════════════════════
2) נתיבי רשת אחרי השינוי (ציפייה)
════════════════════════════════════

חדש בבראנץ':
  POST /api/admin-snapshot  action=admin_mark_done_read
    → כתיבת doneDebriefRead ב-blob. 0 AI. 0 יחידות POL-COST.

לא חדש, התנהגות UI השתנתה:
  POST /api/admin-snapshot  action=admin_save_day
    → כל Save (במקום «שמור ואז כפתור דחיפה»). עדיין 0 AI. תור pendingAdminDayEdit.
  athlete_pull_push_offer (מכשיר, קיים)
    → מושך גם pendingAdminDayEdit. ללא קריאת personal-coach לתכנות.
  GET /api/personal-coach
    → רק גרסת מח (refreshLiveCoachVersion, throttle 60s). לא generate_*.
  POST /api/admin-snapshot  action=admin_list
    → poll כל 20s (ADMIN_POLL_MS=20000, לא שונה). 0 AI.

הוסר מה-UI (צפוי להקטין עלות, לא להגדיל):
  admin_push_upgrade_offer → remaining_rebuild / soft
    ← זה הנתיב היקר (revise_* על ימים שנותרו). הכפתור נמחק. ה-API נשאר בשרת.

לא אמור להיקרא מהפיצ'רים החדשים:
  generate_block / generate_week / generate_week_detail / revise_day / revise_week
  start_intake / chat (תחקור «+ מתאמן» — קיים, לא חלק מהפיצ'רים האלה)
  admin-coach-sandbox coach_note / decide (FAB הערה — קיים, לא נגענו בלוגיקה)

════════════════════════════════════
3) שאלות HARD למנוע תקציב (חפש זליגות)
════════════════════════════════════

1. **admin_save_day אחרי כל Save:** האם apply במכשיר (pprogApplyPendingAdminDayEdit / athlete_pull_push_offer) מפעיל בטעות generate_* / revise_* / remaining_rebuild, או רק מחליף parts[] מקומית?

2. **הסרת כפתור דחיפה:** האם נשאר ב-admin.html נתיב סמוי ששולח admin_push_upgrade_offer? אם ה-API חי בשרת — האם משהו אחר (poll, version GET, fingerprint) יכול לירות אותו?

3. **לחיצה על יום עם Done:** admin_mark_done_read + פתיחת חלונית — האם יש fetch ל-personal-coach / sandbox / chat? האם התבנית העברית נבנית מקומית מ-finishFeedback בלבד?

4. **עיגול בלוח (pprog-display.js):** showDoneDots כבוי כברירת מחדל. האם index.html מדליק אותו או קורא ל-API בגלל הרינדור החדש? (צפוי: לא. 0 diff ב-index.html)

5. **הצגת רוחב (2+ ימים):** האם רינדור כמה כרטיסים גורם ל-retryFill / onNeedFill / generate_week_detail? ב-admin readOnly=true, showFooter=false.

6. **poll 20s + ingestAdminSnapshots:** האם fingerprint/normalize על כל poll יוצר קריאת AI או רק NormalizePprogBlock מקומי? האם doneDebriefRead מגדיל משהו מעבר לכתיבת blob?

7. **GET /api/personal-coach לגרסה:** האם השינויים ב-2.0.2 (הסרת השוואת מח לכפתור דחיפה) הגדילו או הקטינו את תדירות ה-GET? האם GET הזה רץ כ-generate?

8. **MODIFIED הוסר מעריכת אדם:** האם ניקוי modifiedPartKinds גורם למכשיר לחשוב שהיום «לא מעודכן» ולהפעיל revise? (ציפייה: לא — זה תג UI בלבד)

9. **יום עם finishFeedback נעול לעריכה:** וידוא שאין retry תכנות / Done שני / מחיקת תחקיר שגוררת generate.

10. **רגרסיה מכוונת לטובה:** בלי כפתור remaining_rebuild באדמין, המייסד לא יכול בטעות לשרוף לבנה. אשר שזה לא הוחלף בנתיב יקר אחר («סונכרן» ≠ rebuild).

════════════════════════════════════
4) מה אני צריך ממך בחזרה
════════════════════════════════════

1. פסק דין: **אין זליגה / יש זליגה** (+ חומרה).
2. טבלת נתיבים לבראנץ' הזה בלבד:
   פעולה (Save יום / לחיצה Done-dot / רוחב / poll / GET גרסה / כפתור דחיפה שהוסר)
   → קריאת AI? → יחידות POL-COST? → athlete scope? → cap שחל.
3. אם יש זליגה: קובץ + תיקון מוצע (בלי להחליש generate_block / בלי stub).
4. 3 בדיקות ידניות קצרות אחרי הפסק דין.

אל תיגע באיכות תכנות הלבנה. Admin-only. מוח המאמן ו-Done במכשיר מחוץ לסקופ.
```

---

## נספח מהיר (למייסד)

| פעולה בבראנץ' | AI? | POL-COST? |
|---------------|-----|-----------|
| לחיצה על יום עם Done → עיגול/חלונית/תבנית עברית | לא | לא |
| `admin_mark_done_read` | לא (blob) | לא |
| הצגת רוחב (בחירת ימים) | לא | לא |
| Save חלקים → `admin_save_day` + pending pull | לא | לא |
| כפתור «עדכון בדחיפה» / remaining_rebuild | **הוסר מה-UI** | היה כן — עכשיו אין דרך מהאדמין |
| poll `admin_list` כל 20 שנ' | לא | לא |
| GET `/api/personal-coach` (גרסה, 60s throttle) | לא (מטא) | לא |
| `generate_block` מ-«+ מתאמן» | כן (קיים, לא בפיצ'רים האלה) | כן |
| כפתור Done במכשיר | לא נגענו | לא נגענו |
