import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 * Call inside Client Components — safe to call multiple times (SSR dedupes).
 *
 * Usage:
 *   const supabase = createClient()
 *   const { data, error } = await supabase.from('table').select()
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
