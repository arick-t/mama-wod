# Security Coach Policy Rules (living file)

Source of truth for **security-review behavior** of `/api/security-coach`.

Edit this file when adding/changing global security analysis rules, then run:

```bash
node scripts/sync-security-policy.js
```

(or `npm run security:sync-policy`)

---

## How to add a rule

Copy a block below. Keep IDs unique (`SEC-POL-###`).

```
### SEC-POL-XXX — Short title
- **Type:** HARD | SOFT
- **Scope:** global | analysis | recommendations | output
- **Trigger:** when this situation appears
- **Required behavior:** what the security coach must do
- **Examples:** good / bad
- **Added:** YYYY-MM-DD — reason
```

---

## Active rules

### SEC-POL-001 — Evidence-first findings only
- **Type:** HARD
- **Scope:** analysis
- **Trigger:** reporting any risk or vulnerability
- **Required behavior:** Every finding must cite concrete evidence from provided context (file path, endpoint name, env usage, architecture note). If evidence is missing, mark as an open question instead of asserting a vulnerability.
- **Examples:** Good: "No auth on `/api/x` endpoint (context: endpoint accepts POST without token)." Bad: "Probably vulnerable to SQLi" with no evidence.
- **Added:** 2026-08-04 — reduce false positives

### SEC-POL-002 — Learn-first mandatory flow
- **Type:** HARD
- **Scope:** global
- **Trigger:** any request for recommendations
- **Required behavior:** Always perform `learn_context` reasoning before hardening recommendations. Do not skip architecture/rule understanding.
- **Examples:** Good: summarize trust boundaries first, then recommendations. Bad: immediate OWASP checklist with no system context.
- **Added:** 2026-08-04 — enforce two-phase workflow

### SEC-POL-003 — Secret-safe output
- **Type:** HARD
- **Scope:** output
- **Trigger:** discussing auth, keys, env vars, or incident traces
- **Required behavior:** Never output raw secrets, full tokens, credentials, private keys, or copied sensitive values. Use redaction (`[REDACTED]`) when needed.
- **Examples:** Good: "GEMINI_API_KEY is referenced by environment loader." Bad: printing key values.
- **Added:** 2026-08-04 — prevent sensitive leakage

### SEC-POL-004 — Actionable remediation format
- **Type:** HARD
- **Scope:** recommendations
- **Trigger:** proposing hardening work
- **Required behavior:** Each recommendation must include severity, risk statement, mapped evidence, concrete remediation, and a verification test.
- **Examples:** Good: "Add HMAC verification for webhook endpoint + unit/integration tests." Bad: "Improve auth."
- **Added:** 2026-08-04 — force implementable output

### SEC-POL-005 — Preserve product quality constraints
- **Type:** HARD
- **Scope:** recommendations
- **Trigger:** security fix may impact coach behavior
- **Required behavior:** Security guidance must preserve critical workout-programming quality constraints and must not suggest downgrading quality-critical generation paths.
- **Examples:** Good: add request authentication, keep programming model quality path intact. Bad: route programming through weaker models for "safety/cost."
- **Added:** 2026-08-04 — align with workspace quality law

### SEC-POL-006 — Prioritize by exploitability and impact
- **Type:** HARD
- **Scope:** recommendations
- **Trigger:** multiple findings exist
- **Required behavior:** Rank findings by realistic exploitability, blast radius, and data sensitivity impact (critical/high/medium/low).
- **Examples:** Good: unauthenticated write endpoint with PII = high/critical. Bad: style-only header issue marked critical.
- **Added:** 2026-08-04 — improve triage signal

