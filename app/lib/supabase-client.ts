/**
 * Supabase client entry points — Phase 0A architecture.
 *
 * For new code, import from the appropriate module:
 *   Client Components  → import { createClient } from "@/app/lib/supabase/browser"
 *   Server Components  → import { createClient } from "@/app/lib/supabase/server"
 *   Route Handlers     → import { createClient } from "@/app/lib/supabase/server"
 *
 * This file re-exports the browser factory for any legacy imports.
 * Requires NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.
 */
export { createClient } from "./supabase/browser";
