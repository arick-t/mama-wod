# Security Agent Workflow

This repository includes a dedicated security-analysis endpoint:

- API: `api/security-coach.js`
- Prompt source: `experiments/security-coach/security-system-prompt.md`
- Policy source: `experiments/security-coach/security-policy-rules.md`
- Generated prompt module: `api/security-prompt.js`
- Generated policy module: `api/security-policy.js`

## Goal

The security coach always operates in two phases:

1. `learn_context` — learn the app architecture and project rules first.
2. `recommend_hardening` — produce prioritized hardening recommendations with evidence and verification steps.

## Editing flow

1. Edit the source files:
   - `experiments/security-coach/security-system-prompt.md`
   - `experiments/security-coach/security-policy-rules.md`
2. Sync generated runtime files:

```bash
npm run security:sync-prompt
npm run security:sync-policy
```

3. Verify endpoint health:

```bash
curl -s http://localhost:3000/api/security-coach | jq
```

## Request format

`POST /api/security-coach`

```json
{
  "action": "learn_context",
  "messages": [
    { "role": "user", "content": "Analyze this app for security posture." }
  ],
  "appContext": {
    "repoSummary": "..."
  },
  "rulesContext": {
    "workspaceRules": ["..."]
  }
}
```

`action` values:
- `learn_context`
- `recommend_hardening`

## Output contract

The endpoint returns:

- `ok`
- `service`
- `action`
- `provider`
- `model`
- `text` (security analysis response)

The policy requires evidence-backed recommendations and forbids secret leakage in outputs.
