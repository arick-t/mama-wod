# Checkpoint — before coach learning leap (2026-07-31)

Snapshot of Personal Coach prompt + policy **before** the knowledge-pyramid / living-patterns change.

## Restore (rollback)

From repo root, on a clean working tree:

```bash
cp experiments/personal-coach/checkpoints/2026-07-31-before-learning-leap/hamamen-system-prompt.md \
  experiments/personal-coach/hamamen-system-prompt.md
cp experiments/personal-coach/checkpoints/2026-07-31-before-learning-leap/coach-policy-rules.md \
  experiments/personal-coach/coach-policy-rules.md
npm run coach:sync-prompt
npm run coach:sync-policy
```

Or revert the feature branch / PR without merging to `main`.

## Contained files

- `hamamen-system-prompt.md`
- `coach-policy-rules.md`
- `hamamen-prompt.js` (API stub at checkpoint time)
- `coach-policy.js` (API stub at checkpoint time)

## Safety note

Production `main` must stay untouched until the branch is explicitly approved and merged.
File Search / Drive brain sync is **not** part of this checkpoint and must stay gated until approved.
