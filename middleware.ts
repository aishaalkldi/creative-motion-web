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
  // Middleware must not intercept these or it returns HTML instead of JSON.
  "/api/v1/",
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // cm_token holds the real JWT (set by auth.ts after a successful login).
  // The old cm_auth=logged_in flag cookie is intentionally ignored here so
  // stale sessions from the previous demo login cannot bypass the guard.
  const token = request.cookies.get("cm_token")?.value;
  const authed = Boolean(token && token.length > 10);

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
