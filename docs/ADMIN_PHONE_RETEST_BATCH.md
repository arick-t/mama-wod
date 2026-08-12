# Admin phone-browser retest — accumulate only (DO NOT auto-ship)

Branch: `cursor/admin-phone-retest-batch-f8bf`  
Base: `main` (post Admin 1.5.7 + Coach 2.3.4)  
Surface: **founder testing admin dashboard from phone browser**  
Rule: free-form notes → confirm understanding → append here → **one batch** when founder says start. Do not merge until asked.

## Production baseline (already live)
- Admin **1.5.7** · Coach **2.3.4** (badge shows both)
- Delete tombstone / revoke, phone→admin mirror, Build plan Terms bypass, recovery UX nest

## Batch status (in progress on branch)
- Admin **1.5.8** on branch: intake 1:1, Build plan timeout/retry, hide FAB.
- **Also:** same-athleteId reclaim on self-serve join + fresh Terms / declaration date on each new intake sitting.
- After ship: founder retests intake→brick + returning-id admin tab + legal re-sign; then handoff link.

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
7. **2026-08-12 join email, no new admin tab:** Email “אריק חדש 2” used stored uid `u_hg7zrwwvyf7`. Product decision: **keep same athleteId** — reclaim/resurrect that row into the admin list (not mint a new id). Server allows unbound bind + tombstone clear on intake-complete push; client pushes before join email.
8. **Legal on return/reclaim (CRITICAL, 2026-08-12):** Same id OK, but every new intake sitting must re-sign Terms; `legal-agreements.jsonl` gets a new dated row; admin `declarationAcceptedAt` updates to latest Agree. Brand-new users still mint a new uid.

## Hard constraints
- Prefer phone athlete intake UX over desktop admin if conflict.
- Do not auto-push coach upgrades to all athletes.
- Workout programming quality non-negotiable.
- Prefer correct programming over speed when building bricks.
- Returning athlete keeps their stored `userId` and reappears in admin under that id.
- Brand-new athlete always gets a newly minted `userId` as usual.
- **Legal (CRITICAL):** every new intake sitting — including returning / reclaimed same-id members — must **re-sign** Terms; append a new row to `data/legal-agreements.jsonl` with the latest date; admin `declarationAcceptedAt` updates to that date (declaration renewal clock resets).
