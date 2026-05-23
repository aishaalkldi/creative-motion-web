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

Do not commit real contact values to the repo.
