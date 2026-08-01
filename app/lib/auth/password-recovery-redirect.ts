/**
 * Supabase password-recovery email links must hit the server callback so
 * exchangeCodeForSession can set SSR auth cookies before /update-password.
 */
export function buildPasswordRecoveryRedirectTo(origin: string): string {
  return `${origin}/api/auth/callback?next=/update-password`;
}
