# Changelog

## [21.5.4] - 2026-08-08

### Admin security Stage A (Budget-approved · 0 ₪)
- Device `writeKey` ownership on snapshot writes (IDOR overwrite blocked).
- Production fail-closed without Blob (no silent `/tmp`).
- Atomic handoff redeem lock (`.took.json`, no double-spend).
- Allowlist client fields + light admin audit log on Blob.
- Handoff / claim installs `dw_write_key` on the athlete device.
- עלות AI: 0 · Blob: בתוך Hobby

---

## [21.5.3] - 2026-08-08

### Personal Coach / app: Part A/B/C labels + note color (display)
- **Display version: v21.5.3** (Coach stays **v2.1**; package/`VERSION` on **21.5.4** after Stage A).
- Day parts always show **Part A / B / C — {title}** (no double prefix if title already starts with Part X).
- Target/Intent coach notes use soft cyan (`--note`) so they read as notes, not prescription lines.
- Clearer visual separation between consecutive parts; `Target:` lines classified as intent notes.

---

## [21.5.2] - 2026-08-08

### Personal Coach / app: design clarity + Done locked UX (display)
- **Display version: v21.5.2** (Coach stays **v2.1**).
- Typography: **Heebo** for UI/body; **Oswald** kept for brand hero (`DUCK-WOD`) + REST DAY display.
- Color hierarchy via CSS variables — calmer part titles, readable body; Coach purple + semantic training colors preserved. Workout note / part title / format / work-line hierarchy preserved.
- Bottom tabs: uniform bar, no dashed borders; active underline; Coach active uses purple accent; typo **Workouts**.
- FABs: content clearance; **Scroll-up on left**, Coach FAB on right; softer Coach FAB (caption kept).
- Share: quiet circle with recognizable WhatsApp green glyph.
- **Done locked + hide future:** `Done` (today/past, not Rest) → after save static **Reported ✓** (no reopen/edit); future Israel days hide Done; Rest unchanged. Keeps existing finish-learning wiring from v21.5 (static reply / part pick / micro-bias) without changing POL-020 programming quality.
- Preview: `preview-design-clarity.html`.

---

## [21.5.1] - 2026-08-07

### Admin dashboard — durable storage (Stage 1)
- Private Vercel Blob store `duck-wod-admin` for athlete snapshots + handoff claims (survives redeploy/cold start).
- Filesystem fallback remains for local/dev without Blob credentials.
- Seeds tier-2 veterans (אריק / עדי) into admin list when missing.
- Coach directives lookup is async-safe for Personal Coach.

---

## [21.5] - 2026-08-07

### Personal Coach — Done debrief learning (wired)
- **Display version: v21.5** (Coach stays **v2.1**).
- Done check-in now feeds finish-learning (Budget-approved v1):
  - 0 LLM on click; static reply to athlete
  - Too hard / Too easy → pick training part (warmup excluded) when 2+ parts
  - Other ≤160 chars; keyword safety flag
  - Threshold **3** same `part_role` / ~14d → surgical `finish_micro_bias` (max 1 paid / Israel month)
  - Otherwise accumulate + piggyback compact signal cards on natural generate
- Engine: `lib/coach-finish-signals.js` + POL-025; does not consume daily POL-COST edit slots.

---

## [21.4.1] - 2026-08-07

### Personal Coach: small UI tweaks (display)
- **Display version: v21.4.1** (Coach stays **v2.1**).
- **Done** button beside the day title (`Fri · 7 August`) — opens floating check-in (Just right / Too hard / Too easy / Other). Saves locally on the day + analytics; coach-brain learning still deferred at that ship.
- **Share** moved to the same date-actions row as Done: quiet circular icon (secondary); removed from Warm-up section title so it no longer competes with Done.
- Removed athlete-facing **Next block unlocks…** dashed subtitle under Personal Coach / week shell (auto next-block build unchanged).
- Preview: `preview-finished-workout.html`.

---

## [21.4] - 2026-08-07

### Personal Coach: light UX pack (display)
- **Display version: v21.4** (Coach stays **v2.1**; package/`VERSION` stay on the 21.3.x line — no downgrade).
- Floating circular prev/next day arrows + swipe between workouts (daily or monthly day card).
- Coach FAB: tiny **talk to / the coach** caption above the duck, inside one shared purple pill shell with the avatar.
- App landing tab: open on **Personal Coach** (not Workout's) when the coach tab is enabled.
- Pre-START gate (first screen only): hide the free-text Message/Send box; keep **START**. Intake questionnaire after START is unchanged.
- Previews: `preview-day-nav.html`, `preview-coach-fab-caption.html`, `preview-coach-prestart.html`.
- Done / debrief learning stayed on a separate track at that ship.

---

## [21.3.8] - 2026-08-07

### Analytics weekly report clarity
- RTL Hebrew layout by sections; **bold** section headings; plain whole-number metrics (no `1.א` / `2.1` labels that break in mail clients).
- Duck icon in title/subject; HTML email body via Brevo (`htmlContent` + text fallback).
- Sample weekly fixture updated for the new report shape; sample dispatches get subject prefix «דוגמה».

---

## [21.3.7] - 2026-08-07

### Analytics weekly report
- New report sections: traffic («כניסות לא-מוכרים»), Personal Coach (new / incomplete / board / day+general changes), daily workouts (non-coach priority).
- Coach members counted by tier-2 registry (seed + intake_complete + legal+block + `coachTier` on events) — not by first-seen `dw_uid`.
- Seeded veterans: **אריק** (`u_hg7zrwwvyf7`), **עדי** (`u_twhgewb1se`).
- Client emits `coachTier: 2` when `dw_coach_tier` is set; `/api/event` persists it.
- Mobile humans only; display stays **DAILY WORKOUTS · v21.3**.

---

## [21.3.6] - 2026-08-07

### Ops email
- **Brevo only** for operational mail (analytics, coach feedback, digests) → `contact.duckwod@gmail.com`.
- Removed Resend sender/fallback from app code, workflows, and docs (`BREVO_SECRETS.md`).

### Personal Coach — intake sitting (legal)
- Terms + full fixed intake must be completed **in one sitting**.
- Abandon / new browser session / sitting > 3h → unfinished draft wiped; **`dw_uid` kept**.
- Admin `?pprog_reset=1` clears plan/draft but **keeps** `dw_uid` + coach tier (no double “new registrant”).
- On successful intake: coach tier upgraded to **2** (`dw_coach_tier`).

### Analytics hygiene
- Local cleanup of duplicate test “אריק” identities; keep latest founder id only (data files).

### Display
- App header/title stays **DAILY WORKOUTS · v21.3** (Coach brain remains **v2.1**). Internal semver **21.3.6**.

---

## [21.3.5] - 2026-08-06

### Security (0 ₪ extra AI)

- **Admin:** `ADMIN_PASSWORD` from Vercel env only — no hardcoded bootstrap; no password in URL.
- **Personal Coach:** deterministic input/output guards (POL-007/019) — malicious chat blocked with `local-guard`, no extra model calls; programming path unchanged for quality.
- **CORS:** allowlist for official origins; share links preserved.
- **Public API:** trimmed debug fields on status endpoints.

### Display

- App header/title: **DAILY WORKOUTS · v21.3** (Coach brain remains **v2.1**).

---

## [21.3.4] - 2026-08-03

### Coach 2.1 — Cost Guardrails v1 (live)
- **Coach subtitle only:** `COACH · v2.1` (app stays `DAILY WORKOUTS · v21.2.3` — not bumped).
- **sessionDate accounting:** daily programmed-edit cap (2) keys off Israel calendar date of the **training day** in the brick.
- **Server hard-block:** `lib/coach-cost-caps.js` returns 403 (`COST_CAP_DAILY` / `LARGE` / `SOFT` / `MONTHLY`) for `generate_*` / `revise_*` after caps — not prompt-only. Chat/safety stays open. Initial brick + lazy `generate_week_detail` still allowed under daily/large/soft.
- **Gate order:** Terms → cost hard-block → API key (capped requests fail closed without needing a provider).
- **Single chat compact:** removed duplicate POL-COST one-liner from language rule; `COST_GUARDRAILS_COMPACT` is the only chat reminder (full POL-COST remains in policy).
- **POL-COST-010:** monthly ≈ ₪5 unit envelope (ceiling 40); at 100% plan visible + safety chat only.
- Complements (does not replace) POL-020/022/023/024/008/009 + v21.2.2 cost infra.
- Pre-live tests: `scripts/coach-cost-caps.test.js` (wired into `npm test`).
- No auto-rebuild on coach version bump (**POL-COST-006**).

---

## [21.3.3] - 2026-08-03

### Cost guardrails (POL-COST) for plan updates
- Add **POL-COST-001..009**: surgical default, programmed-edit definition, daily edit cap (2/Israel-day), large rebuild gate (A/B + 1/7d), Soft Upgrade (≤3 patches, once/brick), no auto-rebuild on coach version bump, after-caps behavior, cost priority, non-regressions.
- Compact cost reminder in programming + chat systems; runtime `costCaps` state from client.
- Client counters in Personal Coach store (`costCaps`) for daily edits / large rebuild / soft upgrade; sent with `athleteProfile`.

---

## [21.3.2] - 2026-08-03

### Coach 2.0 brain — Layer 1 retune + Layer 2 ops
- **Live fix:** move Layer 2 brief to `lib/` (string module under `/api` broke Vercel Production).
- **Coach version: v2.0** (display app stays on current Pages line unless separately bumped).
- Retuned **Layer 1** (L1+L2 Foundation) via NotebookLM distill + product-flex edits (intake/Rest/AR, 5-week brick, conflict order).
- Ships **Layer 2 ops** on programming path only (`generate_*` / `revise_*`) — not daily chat.
- Rollback checkpoint: `experiments/personal-coach/checkpoints/2026-08-03-before-coach-2.0/`.

---

## [21.2.3] - 2026-08-03

### Personal Coach calendar + floating whole-brick chat
- **Display version: v21.2.3** (Coach was **v1.1** at ship; package/`VERSION` on the 21.3.0 Admin line — no downgrade).
- Active recovery / daily-deload days use the same ringed calendar-cell style as deload weeks, in warm amber (not steel-blue).
- Detection: overview focus (`Active recovery`, `Daily deload`, …), session text, or intake preferred AR weekday.
- Deload calendar label follows the week the coach programmed from intake (any week, including W4). Ignore “before/into deload” copy and stale `phase: deload` when content is still full training. Preset fallback: week 5, unless another week is already the programmed deload. No separate AR tint on deload weeks.
- Whole-brick coach chat moves to a floating FAB (coach avatar, above scroll-up). Per-day notes stay under each workout. First-time tip + clear labels: FAB = whole brick, green day box = this workout only.

---

## [21.3.0] - 2026-08-03

### Founder Admin dashboard 1.0 beta (safe add-on over live 21.2.2)
- Founder admin dashboard (`/admin.html`) **1.0 beta**: athlete management, one-time handoff links, coach learning notes toggle, production-style intake for new athletes.
- Admin **management landing** (דף ניהול): credit balance field + **סנכרן** Drive→File Search sync (same as `npm run coach:sync-brain`).
- Does not change Personal Coach core or live tab visibility (`index.html` only adds claim deep-link helper).

---

## [21.2.2] - 2026-08-02

### Personal Coach: cut Google credit burn (quality preserved)
- **Display version: v21.2.2**
- Lazy week fill: prefetch only active + next week (far weeks fill on navigate).
- Disable day-by-day Gemini cascade after week-fill failure (POL-020 fail/retry; opt-in `PERSONAL_COACH_DAY_BY_DAY=1`).
- Chat/intake uses `gemini-2.5-flash-lite`; programming (`generate_*` / `revise_*`) stays on `gemini-2.5-flash`.
- No Interactions→generateContent double bill; brick chat skips File Search.
- Trim chat history to last 12×4k (intake remains offline packet → no regression to stuck intake).
- Dedupe fixed-intake in programming memory; slim brick chat snapshots.
- Frontend: harden against duplicate week-fill requests; clearer lazy-fill status.
- Log Gemini `usageMetadata` as `[personal-coach:usage]`.

### Terms audit: mirror Agree via analytics (iOS)
- When `personal_coach_legal_agree` lands in analytics, also append `data/legal-agreements.jsonl` (`source: analytics_mirror`).
- Fixes iPhone cases where `/api/legal-agree` dropped even after fetch+JSON, while analytics beacon still arrived.
- Skips duplicate legal rows for the same userId + termsVersion.

---

## [21.2.1] - 2026-08-01

### Hide Generate Workout + Terms audit fix + display rename
- **Display version: v21.2.1** (product name for this patch; interim tags 21.3 / 21.3.1 referred to the same line of work)
- Hide **Generate Workout** tab from first paint (CSS + `hidden` + `syncGenerateWorkoutTabVisibility`); code/API kept for restore.
- Fix Terms audit on iPhone: prefer `fetch`+JSON so Agree rows land in `data/legal-agreements.jsonl`.
- Includes Terms v2.0-legal harden from the same release line (waiver text, checkboxes, server agreement list, API soft-gate, AI safety directive).

---

## [21.2.0] - 2026-08-01

### Personal Coach foundation + morning comfort
- **Display version: v21.2**
- Ships the learning-leap coach on production: L1+L2 Foundation Brief + מסמך דפוסי מקורות in every brick fill (Coach 1.1).
- Returning athletes with a brick land on **Today’s session** (same as the Today button).
- **POL-023:** mid-brick whole-program notes adapt remaining days only; surgical edits preserve formats.
- **POL-024:** whole-brick notes map to the matching intake section (equipment / injuries / schedule / …); other intake sections stay frozen.
- Keeps v21.1 UX/intake polish (locations, session chat, deload styling).
- Programming remains Gemini-quality path (no silent Groq plan fills).

---

## [21.1.0] - 2026-07-31

### Personal Coach UX + learning leap
- **Display version: v21.1**
- Learning leap: knowledge pyramid (POL-021), living pattern brief, Gemini-only programming fills (no Groq fallback for plan quality).
- Session chat: one box for this workout (before/after notes); debrief emails removed.
- Whole-program notes collapsed (gold); deload week marked in steel-blue on the month calendar.
- Intake: multi-select training locations (no trademarked gym brands); Other opens a detail box only.
- POL-022: ultra-brief Confirm? on broad plan changes.

---

## [21.0.0] - 2026-07-31

### First Personal Coach release
- **Display version: v21.0** (no BETA) — first production release with Personal Coach.
- Fixed intake questionnaire, brick calendar, WhatsApp share, Gemini programming path.

---

## [21.0.0-beta.1] - 2026-07-29

### Production pause — Personal Coach tab
- **Hide Personal Coach tab** from the UI (`PPROG_TAB_ENABLED = false`) so users cannot open the unstable beta surface.
- All Personal Coach code / API routes remain in the repo for tomorrow’s fix.
- Display version back to **v21.0 BETA**.

---

## [21.0.3-beta.1] - 2026-07-29

### Quality harden — Personal Coach on Groq fallback
- Enriched Groq compact system with full intake order, LIFTS/SKILLS pickers, **POL-016 תחקור**, brick/revise HARD rules.
- Explicit identity: Personal Coach engine only — never Generate Workout one-shot mode.
- Status endpoint clarifies `engine: personal-coach` and that מאגר/File Search needs a valid Gemini key.
- Display **v21.0.3 BETA**.

---

## [21.0.2-beta.1] - 2026-07-29

### Hotfix — Groq token budget
- Personal Coach Groq fallback was failing with **TPM Request too large** (full Hamamen + Policy ~16k tokens vs Groq 12k limit).
- Use a **compact system prompt** on the Groq path; keep full Gemini prompts when Gemini works.
- Clearer rate-limit error message; display **v21.0.2 BETA**.

---

## [21.0.1-beta.1] - 2026-07-29

### Hotfix — Personal Coach API
- **Personal Coach:** when Gemini returns `API_KEY_INVALID`, fall back to **Groq** (`GROQ_API_KEY`) so chat/intake keeps working on Vercel.
- Remap unavailable coach model IDs (`gemini-3.6-flash` → `gemini-2.0-flash`); strip quoted secrets from env.
- Friendlier coach error messages in the UI (no raw Google JSON dump).
- Display version **v21.0.1 BETA**.

---

## [20.3.1] - 2026-04-04

### CONVERTOR & patch
- **CONVERTOR:** תיקון הזנת **מספר עשרוני** — אין סנכרון בזמן הקלדה כשמסתיים ב־`.` או `,` (למשל אינץ׳); תאורה שומרת עד ספרה עשרונית באירובי; פסיק כעשרוני בפרסור אירובי.
- **גרסה:** תצוגת אתר **v20.3.1**; semver `20.3.1`; Android `versionCode` 25 / `versionName`; iOS `CURRENT_PROJECT_VERSION` 25 / `MARKETING_VERSION`.

---

## [20.3.0] - 2026-03-31

### Workout Tools & CONVERTOR
- **Workout Tools tab:** dashed gold styling (parallel to Generate Workout green tab).
- **CONVERTOR:** distance & weight tables (any-cell sync); inches; aerobic calculator with **ROW / RUN / BIKE / A.BIKE / SKI**; RUN = meters only, A.BIKE = calories only; conversions aligned to reference meter + calorie equivalence tables (shared row-cal baseline).
- **UX:** numeric-friendly inputs, default 1 m / 1 kg, disclaimer **i** next to Aerobic calculator; brand colors; layout fixes for mobile.

### Versioning
- Site **v20.3**; semver `20.3.0`; Android `versionCode` 24 / `versionName`; iOS `CURRENT_PROJECT_VERSION` 24 / `MARKETING_VERSION`.

---

## [20.2.0] - 2026-03-29

### Release (stable)
- **Versioning:** Site display **v20.2** (no BETA tab styling). Semver / stores: `20.2.0`; Android `versionCode` 23 / `versionName`; iOS `CURRENT_PROJECT_VERSION` 23 / `MARKETING_VERSION`.
- **Generate Workout:** Gym presets — dedicated preset-linked prompt panel, dock chips in coach row, toolbar-only edit/delete, preset prompt preview via **i** on bank/dock chips.
- **Coach (API):** Cardio/engine substitution rule + WODwell conversion charts reference; credits in About & Sources.

---

## [20.1.0-beta.2] - 2026-03-29

### AI Builder (BETA)
- **D-BALL:** משקל בק״ג בלבד בשדה קומפקטי ליד הסימון; שמירה בפריסט וטעינה מחדש; שרת מקבל `dballWeight` + הנחיות מאמן.
- **זמן:** שורת זמן קומפקטית (±5, דקות, **Unlimited Time**) ממורכזת; חסימת שדה הדקות כש-Unlimited; פרומפט מאמן: ב-Unlimited חובה לקבוע זמנים/כובעים מפורשים באימון.
- **ציוד:** הרשימה = בריכת אפשרויות (לא חובה להשתמש בהכול); מ־4 מודאליטים (אחרי מיזוג BARBELL+RIG כאחד) אפשר להשמיט ציוד אלא אם צוין במלל חופשי; עדכון ℹ️ Equipment.
- **וידאו טעינה:** `assets/coach-loading.mp4` (מותג) + גיבוי; הוסר כפתור Preview לפרודקשן; `build-capacitor-web` מעתיק `assets/`.

### Versioning
- `20.1.0-beta.2` — `VERSION`, `package.json`, `package-lock.json`, Android `versionCode` 22 / `versionName`, iOS `CURRENT_PROJECT_VERSION` 22 / `MARKETING_VERSION`. תצוגת אתר: **v20.1 BETA** (ללא שינוי כותרת משנה).

---

## [20.1.0-beta.1] - 2026-03-28

### AI Builder (BETA) — קוסמטיקה ו־UX
- תצוגת אימון שנוצר: כרטיס כמו Browse עם מסגרת זהב (`ai-generated`), שמירת מבנה כותרות/תתי־כותרות, כפתור **Share** ל־WhatsApp כמו בשאר האימונים.
- תגיות: **Show exercise demos**, **Add Warm-up**; הוסרה שליטת משתמש ב־Default coach (תמיד פעיל בשרת); ניקוי תגיות יתומות מ־DOM (בנייה ישנה).
- **Reset all** בלבד: מסיר כל התגיות מעל תיבת ההערות + מאפס ציוד וטופס; הוסר כפתור "Reset options to defaults" המיותר.
- מספר גרסה מוצג באתר: **v20.1 BETA**; semver / חנויות: `20.1.0-beta.1` (`versionCode` / `CURRENT_PROJECT_VERSION` → 21).

### Versioning
- סנכרון `index.html`, `package.json`, `VERSION`, `package-lock.json`, `web/`, Android, iOS.

### CI / GitHub Actions
- צמצום שורות ב־workflows: דוח שבועי — לוגיקה ב־`scripts/ci-weekly-analytics-report.sh`; איחוד צעדי `analytics-tests`; דחיסת `daily-fetch`; איחוד **Android Device Build** לתוך **Android Capacitor Build Check** (אופציית `upload_apk`); ייעול `ios-capacitor-build`.

---

## [20.0.0-beta.1] - 2026-03-28

### AI Builder (BETA)
- לשונית **AI Builder BETA** נפרדת מ־Find Workout: בנק תגיות (Default coach, Demos, Extended athlete profile, Warm-up, Strength, Weightlifting), פרופיל מורחב (רמה, שנים, משקל גוף, מין, גיל, בריאות, מספר ספורטאים), מבנה סשן (חימום / כוח / הרמת משקולות) ושליחה ל־`/api/generate-workout` עם ניסיונות חוזרים וטיימאאוט.
- שרת: פרומפט מאמן ברירת מחדל (מושגי L1, קישור PDF רשמי בלבד, כללי Open/Hero, הטיית תחרות ל־competitor), תמצית מחסן (שמות Open/Hero מ־`specialData` / `special_cache.json`) כשזמין.

### Versioning
- שחרור בטא **v20.0.0-beta.1** — סנכרון `index.html`, `package.json`, `VERSION`, `package-lock.json`, תיקיית `web/` (Capacitor), `android/app/build.gradle` (`versionCode` / `versionName`), `ios` (`MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`).

---

## [19.8.3] - 2026-03-23

### Ops / email
- דוח ניתור משתמשים (Resend): ברירת מחדל חזרה ל־**ariel.tahan@gmail.com** (תואם חשבון Resend / Vercel; בלי דומיין מאומת אין משלוח אמין לתיבת ניהול נפרדת).
- הוסר workflow **Resend email test** – אין מייל בדיקה אוטומטי נפרד; בדיקה = הרצה ידנית של **Weekly Analytics Report**.

### Product (ללא שינוי מהותי מ־19.8.2)
- About + קרדיטים + דיסקלימר; קרדיטים ב־Sources ובפוטר; מייל קונטקט ציבורי **`contact.duckwod@gmail.com`** ב־`mailto` בלבד.

---

## [19.8.2] - 2026-03-23

### About & attribution
- לשונית **About** עם משפט מוצר, רשימת קרדיטים וקישורים למקורות.
- בלוק **Sources & attribution** בלשונית Sources + **פוטר** עם קישור ל־About.

### Sources
- **הוסר** מקור Linchpin מהאפליקציה ומ־fetch; רשומות ישנות מוסרות ב־`save()` (מקור מושבת).

---

## [19.8.1] - 2026-03-22

### Browse / UX
- **סוויפ בין ימים**: מעבר יום רק כשהתנועה האופקית בולטת על פני גלילה אנכית — מתקן קפיצה לא מכוונת ליום הקודם בזמן גלילת אימונים.

### Ops
- **Daily fetch**: ריצה נוספת ב־~05:00 ישראל (03:00 UTC) לצד 05:30 ו־08:00.

---

## [19.8] - 2026-03-21

### Product version sync
- **מספר גרסה אחיד**: `v19.8` ב־UI (`index.html`), `19.8.0` ב־`package.json`, קובץ `VERSION` בשורש הפרויקט.
- **CI**: `run-name` ל־workflows, סינון `paths` (בניית Capacitor לא רצה על קומיטי analytics בלבד).

### Timer & mobile (ממשיכים מ־19.7)
- שעון: מסך מלא, מצב 1/2, סטופוואץ׳/אינטרוולים, שדרוגי WebAudio + פלאגין AudioPriority (iOS/Android) לצלילים.

---

## [19.6] - 2026-02-27

### Timer
- Wider input fields for minutes/seconds (Work, Rest, Rest Between Sets, Time) so 4 digits display clearly (7ch).

---

## [19.5] - 2026-02-27

### Find Workout
- Always show top 3 from box sources (14-day workouts); up to 3 from Hero/Benchmark/Open when checkboxes selected. Display order: boxes first, then warehouses.
- Scoring: WOD-only text for equipment/time; two-phase by equipment "extra" (prefer extra ≤1); labels: התאמה מלאה, זמן שונה, התאמה חלקית.
- Unlimited time: no longer zeros score; full time points when "Unlimited time" is checked.
- Guards: getWodOnlyText/scoreWod handle missing sections or bad data; try/catch in find loop; message when no workout data loaded yet.

### Benchmarks
- No duplicate benchmark names in 14-day view (e.g. Grace, Barbara once). `fetch_benchmarks_for_days(dates)` returns one unique benchmark per day.
- Scraper: dedupe by normalized name; parse `<ul>`/`<ol>`/`<li>` and `<h1>`–`<h4>` so full workout content is captured (e.g. Nicole). `fetch_all` uses batch benchmark assignment.

---

## [19.4] - 2026-02-27

### Timer fullscreen (intervals + stopwatch)
- **Sounds**: Single AudioContext created on Start (user gesture); beep/whistle/bell at every work↔rest and rest-between-sets transition (reliable on mobile).
- **UI**: "Remaining" → "Overall Time" (top); phase name larger; Round left, Set right; Pause between LAST/NEXT; ▶/⏸/Close.
- **Stopwatch (For Time)**: Count-up with filling ring; bell at work start, whistle at rest; config tightened; removed Next/5:00 preview.
### Weights
- **lb → kg**: All "X lb" shown as "X lb (Y kg)" in cards and Open (formatLbToKg).
### Official site scraper
- Scraper returns no WOD on Sundays; day bar shows 14 non-Sunday days only.
### Dev
- DEV.md, serve-mobile.ps1, serve-mobile.cmd for local phone testing.

---

## [19.3] - 2026-02-27

### Timer (Workout Timers tab)
- Set & round display: interval shows "Set X/Y · Round R/Z" and "Rest Between Sets — Set 2→3"; toggles for "Merge adjacent rests" and "3 beeps" (ON/OFF); note about sounds over device audio.
### Dev
- Mobile testing: Live Server useLocalIp, DEV.md, serve-mobile.ps1.

---

## [19.2] - 2026-02-15 (Evening, Second Fix)

### 🔧 Fixed
- **Ton Bridge**: 
  - Separator line ("By NAME|DATE") now excluded completely
  - Section titles normalized: "Met Con" → "METCON"
  - Skip lines with "by" or "posted"
  
- **Benchmarks**:
  - Restored v19 working code (v19.1 broke it)
  - Added gender weights as notes: *♀ 55 lb ♂ 75 lb*
  
- **Open WODs**:
  - Complete rewrite of scraping logic
  - Now finds 15+ workouts (was 0 in v19.1)
  - Better HTML parsing (h1-h4 headers)
  - Gender weights as notes

- **Workflow**:
  - Auto-triggers on push to main/master
  - Watches backend/** and workflow file changes

### 📊 Result
- All 10/10 sources working
- ~140 WODs total
- No regressions from v19

---

## [19.1] - 2026-02-15 (Afternoon) - BROKEN

### ❌ Regression
- Benchmarks stopped working (0 workouts)
- Open stopped working (0 workouts)
- Lost functionality from v19

---

## [19] - 2026-02-15 (Morning)

### 🔧 Fixed
- Heroes: Full workouts
- Benchmarks: Correct titles
- Ton Bridge: New URL
- Open: Re-enabled

---

## [18] - 2026-02-10

### 🎉 Initial Release
