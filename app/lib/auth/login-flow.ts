export const LOGIN_SERVICE_UNAVAILABLE_MESSAGE =
  "Sign-in is temporarily unavailable. Please try again later.";

export const LOGIN_INVALID_CREDENTIALS_MESSAGE =
  "Email or password is incorrect. Check your details, reset your password, or create an account.";

export const LOGIN_GENERIC_ERROR_MESSAGE =
  "Unable to sign in right now. Please try again in a moment.";

export type SupabaseLoginAttemptResult =
  | { ok: true }
  | { ok: false; error: string; showRecoveryLinks: boolean };

/**
 * Maps Supabase auth errors to safe client-facing messages.
 * Never returns raw Supabase error strings.
 */
export function resolveSupabaseLoginError(
  supabaseConfigured: boolean,
  errorMessage: string | null | undefined,
): { message: string; showRecoveryLinks: boolean } {
  if (!supabaseConfigured) {
    return { message: LOGIN_SERVICE_UNAVAILABLE_MESSAGE, showRecoveryLinks: false };
  }

  if (!errorMessage || errorMessage === "Invalid login credentials") {
    return { message: LOGIN_INVALID_CREDENTIALS_MESSAGE, showRecoveryLinks: true };
  }

  return { message: LOGIN_GENERIC_ERROR_MESSAGE, showRecoveryLinks: false };
}

export type SupabaseLoginDeps = {
  supabaseConfigured: boolean;
  email: string;
  password: string;
  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error: { message: string } | null }>;
  ensureProviderProfile: (input: { email: string }) => Promise<void>;
};

/**
 * Supabase-only clinician login attempt. Never calls legacy FastAPI login.
 */
export async function attemptSupabaseLogin(
  deps: SupabaseLoginDeps,
): Promise<SupabaseLoginAttemptResult> {
  if (!deps.supabaseConfigured) {
    return {
      ok: false,
      error: LOGIN_SERVICE_UNAVAILABLE_MESSAGE,
      showRecoveryLinks: false,
    };
  }

  const normalizedEmail = deps.email.trim().toLowerCase();
  const { error } = await deps.signInWithPassword(normalizedEmail, deps.password);

  if (!error) {
    await deps.ensureProviderProfile({ email: normalizedEmail });
    return { ok: true };
  }

  const resolved = resolveSupabaseLoginError(true, error.message);
  return {
    ok: false,
    error: resolved.message,
    showRecoveryLinks: resolved.showRecoveryLinks,
  };
}
