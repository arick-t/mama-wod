# Admin phone-browser retest — accumulate only (DO NOT auto-ship)

Branch: `cursor/admin-phone-retest-batch-f8bf`  
Base: `main` (post Admin 1.5.7 + Coach 2.3.4)  
Surface: **founder testing admin dashboard from phone browser**  
Rule: free-form notes → confirm understanding → append here → **one batch** when founder says start. Do not merge until asked.

## Production baseline (already live)
- Admin **1.5.7** · Coach **2.3.4** (badge shows both)
- Delete tombstone / revoke, phone→admin mirror, Build plan Terms bypass, recovery UX nest

## Open findings (phone browser retest)
1. **Hide floating coach chat FAB during +מתאמן intake:** While adding a new athlete (intake modal open), the floating duck chat icon (e.g. labeled "עדי") must not appear. Not optional — hide it for the whole new-athlete flow. (Screenshot 1 — overlaps footer on Lifts step.)
2. **Lifts & run — numeric keyboard:** Step 5/9 lift/run fields open a general/Hebrew symbols keyboard on phone. Must open a **numeric** keypad (`inputmode="decimal"` / `type="number"` or equivalent) for kg and run minutes. (Screenshot 2 — Back Squat focused.)
3. **Intake parity expectation (HARD product intent):** Founder expected the admin “new athlete” questionnaire on phone to be **exactly the same** as the athlete-app intake — not a parallel/admin-only variant. Treat phone-admin fixed intake as 1:1 with athlete app UX (layout, fields, keyboards, chips). Desktop may differ only where necessary; phone browser admin should match the app.

## Hard constraints
- Prefer phone athlete intake UX over desktop admin if conflict.
- Do not auto-push coach upgrades to all athletes.
- Workout programming quality non-negotiable.
- Prefer correct programming over speed when building bricks.
