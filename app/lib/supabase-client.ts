import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/**
 * Shared Supabase browser client. Wire this up when you replace localStorage.
 * Requires NEXT_PUBLIC_* env vars (see `.env.local.example`).
 */
export const supabase = createClient(url, publishableKey);
