/**
 * Client-side auth session management.
 *
 * The JWT is stored in two places:
 *   1. localStorage  — read by every API call via getAuthHeaders()
 *   2. cm_token cookie — read by Next.js middleware for route protection
 *      (non-httpOnly so we can set it from the browser; same max-age as JWT)
 *
 * The old `cm_auth=logged_in` flag cookie is cleared on every call so
 * stale sessions from the previous demo login are invalidated.
 *
 * Token expiry matches ACCESS_TOKEN_EXPIRE_MINUTES=480 (8 hours).
 */

const TOKEN_KEY = "cm_access_token";
const CLINICIAN_KEY = "cm_clinician";
const COOKIE_MAX_AGE = 8 * 60 * 60; // 8 hours in seconds

export type ClinicianInfo = {
  id: number;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
};

export function setAuthSession(token: string, clinician: ClinicianInfo): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(CLINICIAN_KEY, JSON.stringify(clinician));
  // Store the real JWT in the cookie so middleware can check for it
  document.cookie = `cm_token=${token}; path=/; max-age=${COOKIE_MAX_AGE}`;
  // Clear the old demo-era flag cookie so it never triggers a false redirect
  document.cookie = "cm_auth=; path=/; max-age=0";
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getClinician(): ClinicianInfo | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(CLINICIAN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ClinicianInfo;
  } catch {
    return null;
  }
}

export function clearAuthSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CLINICIAN_KEY);
  document.cookie = "cm_token=; path=/; max-age=0";
  document.cookie = "cm_auth=; path=/; max-age=0";
}

/** Returns the Authorization header object if a token exists, otherwise {}. */
export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
