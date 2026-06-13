# Supabase (minimal)

1. Copy `.env.local.example` to `.env.local`.
2. Paste your project URL and anon **publishable** key from the Supabase dashboard (API settings).
3. Install deps if needed: `npm install`
4. This app still uses localStorage until you intentionally import `supabase` from `app/lib/supabase-client.ts`.

## Password reset redirect URLs

In **Supabase → Authentication → URL Configuration**, add these to the **Redirect URLs** allow list:

- `https://creative-motion-web.vercel.app/update-password`
- `http://localhost:3000/update-password`

Password reset emails redirect to `/update-password` after the user clicks the link.

## Vercel environment variable (pilot)

Add to **Vercel → Project → Settings → Environment Variables**:

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPPORT_CONTACT` | Yes (pilot) | Shown on the remote assessment consent panel (`/assessment/[token]`). Example: `contact@yourdomain.com` or a WhatsApp number. If unset, patients see **contact your clinic**. |
| `OPENAI_API_KEY` | Yes (Arabic translation) | Required for clinician AI-assisted English translation on Arabic assessment reports. Add to `.env.local` for local testing and to Vercel Production. If unset, the report shows **Translation is not configured yet**. Never commit the key. |

Do not commit real contact values or API keys to the repo.

## Health / migration readiness

After setting env vars and applying migrations `001`–`010`, verify the pilot schema:

```bash
curl -s https://your-deployment.vercel.app/api/health/supabase | jq
```

Response fields:

- `status`: `ok` (all checks pass), `degraded` (connected but a table failed), `error` (env or connection failure)
- `env`: booleans only — never secret values
- `tables`: per-table `ok` / `error` (with safe `code` such as `missing_table`)
- `checkedAt`: ISO timestamp

HTTP `503` when `status` is `error`; `200` for `ok` or `degraded`.

Migration `010_patients_file_number.sql` adds nullable `patients.file_number` — a clinic-visible patient file reference per provider (not a clinical diagnosis identifier). New patients receive a server-assigned value on create; existing rows are not backfilled in this release.
