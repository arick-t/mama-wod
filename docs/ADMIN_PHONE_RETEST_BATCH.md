# Admin phone-browser retest — accumulate only (DO NOT auto-ship)

Branch: `cursor/admin-phone-retest-batch-f8bf`  
Base: `main` (post Admin 1.5.7 + Coach 2.3.4)  
Surface: **founder testing admin dashboard from phone browser**  
Rule: free-form notes → confirm understanding → append here → **one batch** when founder says start. Do not merge until asked.

## Production baseline (already live)
- Admin **1.5.7** · Coach **2.3.4** (badge shows both)
- Delete tombstone / revoke, phone→admin mirror, Build plan Terms bypass, recovery UX nest

## Batch order (founder confirmed 2026-08-12)
1. **Intake identical 1:1** — reuse athlete-app questionnaire (no parallel rebuild).
2. **Coach connectivity at end** — Build plan must return a real brick (fix phone `Load failed`).
3. **Hide floating coach FAB** during +מתאמן.
4. Founder retests intake → brick.
5. Then **handoff link** / send brick to third-party athlete.

## Parallel founder test (same session)
- Self-serve phone intake as new user → expect athlete in admin dashboard (yesterday failed; re-verify 1.5.7 mirror).

## Product framing (HARD, avoid double work)
- Athlete-app intake = source of truth (already good UX).
- Admin reuses it 1:1 — do not rebuild.
- Founder notes focus: coach connectivity → handoff link → short laptop cosmetics only.

## Open findings (phone browser retest)
1. Hide floating coach FAB during +מתאמן (not optional).
2. Lifts numeric keyboard — comes with intake 1:1 reuse.
3. Intake parity HARD — admin = athlete app.
4. First attempt Build plan: `Load failed` / network error on phone Safari (coach connectivity).
5. Handoff link — not reached yet.
6. Phone self-serve → admin list — re-test in parallel.

## Hard constraints
- Prefer phone athlete intake UX over desktop admin if conflict.
- Do not auto-push coach upgrades to all athletes.
- Workout programming quality non-negotiable.
- Prefer correct programming over speed when building bricks.
