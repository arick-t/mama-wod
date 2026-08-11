# Admin remote audit — accumulated tasks (DO NOT auto-ship)

Collected from founder remote session (production retest ongoing).
Branch: cursor/admin-remote-audit-batch-f8bf
Rule: accumulate → one batch of work. Do not merge to main until founder asks.

## Already shipped to production (this session — should have waited)
- Admin 1.5.3 All skills beside title + toggle cubes (desktop fixed intake only)
- Admin 1.5.4 No injuries active chip
- Admin 1.5.5 Build plan coach video overlay + fail restore to Goals
- Admin 1.5.6 Handoff Terms gate: no pre-stamp legal; athlete signs on device before plan unlock

## Still open / verify in production retest
1. After deleting an athlete in admin — device must lose access to that block (not leftover localStorage from before admin sync). Verify claim/ownership revoke path.
2. Coach 2.3.3 connected to +athlete / intake — verified earlier; re-confirm after new plan build.
3. Desktop admin fixed intake UX polish (if more found in retest).
4. Build plan end-to-end: GIF/video → real brick → one-time link → athlete opens → Terms → then plan.
5. Legal signature must land in legal-agreements.jsonl on Agree (handoff path).

## Hard constraints
- Prefer phone athlete intake UX over desktop admin if conflict.
- Do not auto-push coach upgrades to all athletes.
- Workout programming quality non-negotiable.
