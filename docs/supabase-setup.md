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

## Database migrations

All schema changes live in `supabase/migrations/`, applied in **numeric filename
order**. `000_schema_baseline.sql` must execute first — it creates the base
`public.patients` and `public.assessments` tables that every later migration
depends on. Without it, a genuinely empty database fails at
`002_core_tables.sql` with a missing-table error.

Do not skip files, do not apply them out of order, and do not hand-pick a
subset. On an already-linked project, `supabase db push` applies every
migration not yet recorded as applied, in filename order, automatically —
that is the only supported way to bring a database up to date. The
repository-root `schema.sql` is a historical reference only (see the notice
at the top of that file); it is not part of the applied migration chain and
must not be run directly.

### `supabase db reset` is destructive

`supabase db reset --linked` drops and rebuilds the entire linked database
from `supabase/migrations/` (and, if configured, seed data). It permanently
discards all existing rows in that project.

- Only run it against a project you have explicitly verified is a local
  development or Staging project — confirm the linked project ref before
  running it.
- **Never run it against Production.** There is no confirmation step that
  distinguishes environments for you; that verification is entirely on the
  person running the command.

## Health / migration readiness

After setting env vars and applying all migrations in `supabase/migrations/`
(currently `000` through `013`), verify the schema:

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
