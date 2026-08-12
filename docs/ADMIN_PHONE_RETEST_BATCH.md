# Admin phone-browser retest — accumulate only (DO NOT auto-ship)

Branch: `cursor/admin-phone-retest-batch-f8bf`  
Base: `main` (post Admin 1.5.7 + Coach 2.3.4)  
Surface: **founder testing admin dashboard from phone browser**  
Rule: free-form notes → confirm understanding → append here → **one batch** when founder says start. Do not merge until asked.

## Production baseline (already live)
- Admin **1.5.7** · Coach **2.3.4** (badge shows both)
- Delete tombstone / revoke, phone→admin mirror, Build plan Terms bypass, recovery UX nest

## Product framing (founder — HARD, avoid double work)
- **Athlete-app intake is the source of truth.** On phone or browser, the athlete surveys *for themselves* on their device. That flow already works well (UX, keyboards, colors, chips, layout).
- **Admin must reuse that intake 1:1** — not a parallel admin-only questionnaire. Do not rebuild UX that already exists in the app; copy/share the same UI + behavior (including numeric keyboards, colors, etc.).
- **From here, founder notes to agent should focus on:**
  1. **Coach connectivity** to this third-party / admin-driven intake (wiring generate_block, quality, versions).
  2. **Athlete handoff link** to send (not reached yet in this retest).
  3. **Short cosmetic notes only** for laptop-browser admin shell (not redoing intake UX).
- Implication: findings #2–#3 (keyboard, parity) = make admin intake *be* the app intake, not “fix admin forms to feel like app.”

## Open findings (phone browser retest)
1. **Hide floating coach chat FAB during +מתאמן intake:** While adding a new athlete (intake modal open), the floating duck chat icon (e.g. labeled "עדי") must not appear. Not optional — hide it for the whole new-athlete flow. (Screenshot 1 — overlaps footer on Lifts step.)
2. **Lifts & run — numeric keyboard:** Step 5/9 lift/run fields open a general/Hebrew symbols keyboard on phone. Must open a **numeric** keypad — solved by 1:1 reuse of athlete-app intake inputs, not a separate admin fix path if possible.
3. **Intake parity expectation (HARD):** Admin “new athlete” questionnaire = athlete-app intake exactly (see framing above).
4. **First attempt — Build plan network fail (phone browser):** Step 9/9 Goals → Build plan failed with red error: "שגיאת רשת בבניית לבנה: Load failed — לחץ Build plan שוב." Floating coach FAB still visible (reinforces #1). Belongs under **coach connectivity** to third-party intake — investigate phone-Safari fetch to `/api/personal-coach` (CORS, timeout, auth headers, abort).
5. **Handoff link to athlete:** Not reached yet in this retest — keep as upcoming focus area after intake→Build plan works.
