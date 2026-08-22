# QA scripts

Operator utilities for **Staging / local** validation. Not imported by the application.

## Volunteer Research 8B.1 — Staging smoke

**Script:** `scripts/qa/volunteer-8b1-staging-smoke.mjs`

Exercises the three volunteer research API routes against a running local Next.js app
configured for **Staging Supabase** (via `.env.local`). Performs safe read-only DB
assertions and deletes the QA session rows it creates when cleanup succeeds.

### Prerequisites

1. Migration `021_ml_research_volunteer_sessions.sql` applied on **Staging** (not Production).
2. Local dev server running, e.g. `npm run dev` (default `http://localhost:3000`).
3. `.env.local` includes Staging Supabase URL/keys, `ML_VOLUNTEER_COLLECTION_ENABLED=true`,
   and `VOLUNTEER_CAMPAIGN_CODE_HASH` (hash only — never commit the raw campaign code).
4. Shared pilot campaign code available to the operator **in the current shell only**.

### Run

PowerShell (set campaign code in-process; do not commit or paste into tracked files):

```powershell
$env:VOLUNTEER_QA_CONFIRM_STAGING = "true"
$env:VOLUNTEER_QA_CAMPAIGN_CODE = "<pilot-campaign-code>"
npx tsx scripts/qa/volunteer-8b1-staging-smoke.mjs
```

Optional:

| Variable | Default | Purpose |
|----------|---------|---------|
| `VOLUNTEER_QA_BASE_URL` | `http://localhost:3000` | App under test |
| `VOLUNTEER_QA_SKIP_CLEANUP` | unset | Set `true` to retain QA rows for debugging |

### Safety

- **Production:** Script exits unless `VOLUNTEER_QA_CONFIRM_STAGING=true` and `VERCEL_ENV` is not `production`.
- **Secrets:** Never logs campaign code, session tokens, deletion codes, hashes, or service-role keys.
- **Campaign code:** High-entropy shared secret — provide only via `VOLUNTEER_QA_CAMPAIGN_CODE` in the operator process. Rotate if exposed.

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | All required checks passed (skips allowed) |
| `1` | One or more checks failed |
| `2` | Missing configuration or unsafe target environment |
