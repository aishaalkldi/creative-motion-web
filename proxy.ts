import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Public routes that never require a session.
 * Every other route is protected — unauthenticated visitors are sent to /login.
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  // All FastAPI routes — FastAPI handles its own JWT auth (Bearer token).
  // Proxy must not intercept these or it returns HTML instead of JSON.
  "/api/v1/",
  // Supabase OAuth / Magic Link PKCE callback — must be public.
  "/api/auth/callback",
  // Patient portal APIs — token-validated server-side (service role); no Supabase session.
  "/api/patient/",
  // Remote assessment token APIs — token-validated server-side; no Supabase session.
  "/api/remote-assessments/",
  // Token-gated patient portal pages — access control is the URL token, not a provider session.
  "/patient/",
  // Patient-facing remote assessment link (sent via secure URL)
  "/assessment",
  // Next.js internals and static assets
  "/_next",
  "/favicon.ico",
  "/fonts",
];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // ── Supabase session refresh + auth check ──────────────────────────────────
  // When Supabase is configured, refresh session cookies on every request and
  // capture whether the caller has a valid Supabase session.
  // This is a no-op when env vars are not yet populated.
  let supabaseAuthed = false;

  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    // IMPORTANT: no code between createServerClient and getUser().
    const { data: { user } } = await supabase.auth.getUser();
    supabaseAuthed = Boolean(user);
  }

  // ── FastAPI JWT gate (preserved for transition period) ─────────────────────
  // cm_token holds the FastAPI JWT (set by auth.ts after login).
  // The old cm_auth=logged_in flag cookie is intentionally ignored.
  const token = request.cookies.get("cm_token")?.value;

  // DEV-ONLY: Allow bypass with dev mock token
  const isDevBypass =
    process.env.NODE_ENV === "development" &&
    token?.startsWith("dev_bypass_token_");

  const cmAuthed = Boolean((token && token.length > 10) || isDevBypass);

  // Authenticated if EITHER Supabase session OR legacy cm_token is valid.
  const authed = supabaseAuthed || cmAuthed;

  // Already authenticated — bounce away from auth pages
  if (authed && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/clinician", request.url));
  }

  // Protected route — redirect to /login, preserving the intended destination
  if (!isPublic(pathname) && !authed) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
