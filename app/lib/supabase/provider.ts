"use client";

import { createClient } from "./browser";

export type ProviderProfile = {
  id: string;
  name: string;
  clinic_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
  updated_at: string;
};

export type ProviderSession = {
  user: { id: string; email: string | undefined };
  profile: ProviderProfile | null;
};

/**
 * Returns the current Supabase auth user and their provider profile.
 *
 * Safe to call when:
 * - Supabase env vars are configured
 * - The providers table may or may not exist yet (returns profile: null gracefully)
 * - No session is active (returns null)
 *
 * Use in Client Components only (imports browser client).
 */
export async function getProviderSession(): Promise<ProviderSession | null> {
  const supabase = createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  // Load provider profile — gracefully handles missing table (Phase 0B)
  try {
    const { data: profile, error: profileError } = await supabase
      .from("providers")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError && profileError.code !== "PGRST116") {
      // PGRST116 = "no rows found" — acceptable, profile just doesn't exist yet
      // Other errors (table missing etc.) are swallowed so the app keeps working
    }

    return {
      user: { id: user.id, email: user.email },
      profile: profile as ProviderProfile | null,
    };
  } catch {
    // providers table not yet migrated — return user without profile
    return {
      user: { id: user.id, email: user.email },
      profile: null,
    };
  }
}

/**
 * Signs out from Supabase. Safe to call even if no session is active.
 */
export async function supabaseSignOut(): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch {
    // Ignore — session may already be expired
  }
}
