# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working agreement with the owner

The owner is **not a programmer** and does not read code. All development happens through
conversation, in **Hebrew**. Two rules follow from this and override convenience:

1. **Ask before any modifying action** *outside the working branch*. Deleting, switching
   branches, triggering a workflow, touching anything shared — describe in plain Hebrew what it
   does and what could break, then wait for an explicit yes. Reading, searching and explaining
   need no approval.

   **Amended 2026-09-01 by the owner:** editing, committing and **pushing the working branch**
   need NO approval, and neither does letting Vercel rebuild the preview. He reviews in the
   browser, so work that is not on the preview URL cannot be reviewed at all: finish the whole
   list of items, push, then report with the link live. A preview changing while he is mid-test
   is fine — he said so explicitly. Production is untouched by this: see rule 2.
2. **Never risk the live app.** DUCK-WOD is in production with real athletes. `main` is the
   deploy branch: **a push to `main` deploys to Vercel production.** Never push without explicit
   approval for that specific push.

Explain changes in product terms first ("what the athlete will see"), mechanism second.

### The standard change workflow — always, no exceptions

Every piece of work, however small, goes through these five steps in order. The owner set this
as permanent policy. **Claude executes every step; the owner approves each one.** Never hand the
owner a command to run themselves, and never collapse two steps into one turn.

1. **Open a branch with a stated topic and goals.** Never work directly on `main`. Before writing
   any code, state in Hebrew what the branch is for and what "done" looks like, and get a yes.
2. **Build it together.** Work in visible steps and report what changed in product terms as you go,
   rather than disappearing and returning with a finished pile.
3. **Prove nothing is broken.** `npm test` must be 22/22 green, plus whatever targeted check the
   change deserves. Show the owner the evidence — never assert "it works" without output.
4. **Get explicit approval to ship**, naming what is about to go live.
5. **Ship to production**, then confirm the deploy actually landed (the header version is the
   proof — see *Version bumps must be synchronized*).

Rolling back is part of the job, not a failure: if a ship misbehaves, say so immediately and
offer the revert before the owner has to ask.

## What this is

`mama-wod` / **DUCK-WOD** — two products in one repo:

1. **WOD aggregator.** Python scrapers in `backend/scrapers/` pull daily CrossFit workouts from
   ~10 sites. `.github/workflows/daily-fetch.yml` (5 crons/day, Israel-timezone aware) runs
   `backend/fetch_all.py` and **commits results into `data/workouts.json` + `data/special_cache.json`**.
2. **Personal Coach ("המאמן").** `api/personal-coach.js` — intake, multi-week "brick" generation,
   per-day fills, revisions, post-workout debrief. Plus `api/generate-workout.js` (one-off AI
   workout builder) and `admin.html` (owner back office).

**There is no database.** State lives in three places: JSON/JSONL files committed to this repo
(workouts, `data/analytics.jsonl`, `data/legal-agreements.jsonl`, written at runtime via the
GitHub API), private Vercel Blob (athlete snapshots, credit ledger — see
`scripts/lib/admin/admin-json-store.js`), and the athlete's device.

**Hosting is split.** Static site on GitHub Pages, but **all `/api/*` calls go to Vercel**
(`mama-wod.vercel.app`) because Pages has no server. Front-end code must never call a relative
`/api/...` path without the Vercel base — `scripts/admin-api-base.test.js` guards this.

Front end is two hand-written monoliths: `index.html` (~677KB; tabs `workout`, `browse`,
`pprog` = coach, `aibeta`, `sources`, `about`) and `admin.html` (~201KB). Mobile ships via
Capacitor (`com.mamawod.app`) to TestFlight / Android.

## Commands

```bash
npm test                      # all 22 test files, sequential && chain — stops at first failure
node scripts/<name>.test.js   # run one test file (this is how you isolate a failure)
npm run dev:local             # local server on :3000 serving the site + the API handlers
                              # reads secrets from .env.local (see .env.example)
.\serve-mobile.ps1            # serve on 0.0.0.0 for testing on a real phone (see DEV.md)
npm run build:cap:web && npx cap sync   # after ANY change to root index.html
```

Tests are plain `node` scripts with a hand-rolled `ok()` helper — no test framework. Many of
them assert on **literal source text** of `api/personal-coach.js` (e.g. `pc.includes("geminiOnly: true")`),
so innocuous reformatting of that file breaks tests by design — that is the guard rail, not a bug.

## Hard rules

### Workout quality is non-negotiable

From `.cursor/rules/workout-quality-never-compromise.mdc` — programming quality **is** the product:

- Prefer a **slower, correct brick** over a fast, generic one. Athlete wait time is acceptable.
- Never ship offline/stub/template workouts as a substitute for real coach programming.
- Never shrink or "compact away" programming prompts, policy, or capability profiling to save
  tokens, latency, or quota.
- Never route `generate_block` / `generate_week` / `generate_week_detail` / `revise_*` through a
  weaker backup model. **Programming is Gemini-only (POL-020); Groq is chat fallback only.**
- When a provider fails: fail loudly and retry. Do not fill the calendar with fake sessions.
- If a change would make workouts worse to fix UI, quota, or deploy pressure: reject or isolate it.

### Never hand-edit generated files

| Generated (do not edit) | Source of truth | Regenerate with |
|---|---|---|
| `api/coach-policy.js` | `experiments/personal-coach/coach-policy-rules.md` | `npm run coach:sync-policy` |
| `api/hamamen-prompt.js` | `experiments/personal-coach/hamamen-system-prompt.md` | `npm run coach:sync-prompt` |
| `lib/security-policy.js` | `experiments/security-coach/security-policy-rules.md` | `npm run security:sync-policy` |
| `lib/security-prompt.js` | `experiments/security-coach/security-system-prompt.md` | `npm run security:sync-prompt` |

Coach behavior is governed by numbered policy rules **POL-001 … POL-027** authored as markdown
under `experiments/personal-coach/`. To change how the coach thinks, edit the rule, then sync.

### Version bumps must be synchronized

A release bumps the same number in **`package.json`, `VERSION`, `index.html`** (`<title>` +
`.header-sub`) **and `CHANGELOG.md`** — see `docs/VERSIONING.md`. The header version is how the
owner verifies a deploy actually went live; Admin 3.0.2 shipped purely to prove Vercel had updated
after `vercel.json`'s `ignoreCommand` silently cancelled a build. `README.md` is stale — `VERSION`
and `package.json` are the source of truth.

## Things that will bite you

- **`vercel.json` `ignoreCommand`** (`scripts/vercel-analytics-only-skip.js`) cancels the Vercel
  build when a commit touches only analytics/data files — so the daily-fetch bot doesn't redeploy
  all day. It has already caused a real release to silently not deploy. Merge commits are never skipped.
- **Windows CRLF:** with `core.autocrlf=true` and no `.gitattributes`, `scripts/coach-cost-caps.test.js`
  fails on `"chat return uses HAMAMEN"` because it searches for a literal `\n`. The code is fine.
  This clone is pinned to LF via `.git/info/attributes` (local, uncommitted). Any *other* test
  failure is real.
- **Scrapers have no API** — they parse HTML from myleo.de, crossfit.com, crossfit1013.com,
  crossfitrestoration.com, crossfittonbridge.co.uk, crossfitarch.com, crossfitpanda-ghost.fly.dev,
  crossfitpostal.com, wodconnect.com. They break silently when a site is redesigned. "No workouts
  today" is usually a broken scraper, not app logic.
- **Cost is real money.** Gemini is a prepaid wallet with no balance API; the app *estimates* spend
  in `scripts/lib/admin/admin-credit-estimate.js`. Cost guardrails (POL-COST, `lib/coach-cost-caps.js`)
  hard-block over-generation server-side. Do not loosen a cap to make a test pass.
- **Capacitor copies drift.** `web/`, `ios/App/App/public/`, `android/app/src/main/assets/public/`
  each hold a copy of `index.html`. Change the root one, then `npm run build:cap:web && npx cap sync`.
- **PII** is scrubbed by `api/sanitize-pii.js` before any text reaches Gemini. Keep new LLM paths
  routed through it.

## External services

| Service | Used for | Key |
|---|---|---|
| Google Gemini | Coach brain (`2.5-flash` programming, `flash-lite` chat) + File Search knowledge store | `GEMINI_API_KEY` |
| Groq (Llama) | Chat fallback; preferred for Generate Workout. **Never for programming.** | `GROQ_API_KEY` |
| Vercel | All `/api/*` serverless + Blob storage. Production branch = `main`. | `BLOB_READ_WRITE_TOKEN` |
| GitHub API | Runtime datastore for analytics + legal consent | `GITHUB_TOKEN`, `GITHUB_REPO` |
| Brevo | All outbound email (weekly report, coach feedback, intake alerts) | `BREVO_API_KEY` |
| Google Drive | Manual knowledge inbox synced into the coach's brain | `COACH_KNOWLEDGE_DIR` |
| Apple TestFlight | iOS distribution — `ios-testflight-release.yml`, manual dispatch only | iOS secrets |

Full list of env vars in `.env.example`. Secrets live in `.env.local` (gitignored) and in Vercel.

## Scheduled workflows

`daily-fetch` (5×/day, automatic) · `weekly-analytics-report` (Fri, emails owner) ·
`weekly-coach-patterns-digest` (Sun — brain sync to File Search is **gated off** behind
`COACH_BRAIN_SYNC_ENABLED`; enabling it writes to production knowledge).
`analytics-tests`, both Capacitor builds, and TestFlight are **manual dispatch only**.
