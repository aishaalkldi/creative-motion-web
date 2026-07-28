import type { ProviderSession } from "../supabase/provider";

export type ClinicianAuthStatus = "loading" | "authenticated" | "unauthenticated";

export type ClinicianDisplay = {
  fullName: string;
  email: string;
  initials: string;
};

const DEFAULT_CLINICIAN_PATH = "/clinician";

const DEV_BYPASS_DISPLAY: ClinicianDisplay = {
  fullName: "Dr. Dev Therapist",
  email: "dev@creative-motion.local",
  initials: "DD",
};

/**
 * Restrict returnTo to same-origin internal paths under /clinician.
 * Preserves a safe query string when present.
 */
export function sanitizeClinicianReturnTo(rawPath: string | null | undefined): string {
  if (!rawPath || typeof rawPath !== "string") return DEFAULT_CLINICIAN_PATH;

  const trimmed = rawPath.trim();
  if (!trimmed) return DEFAULT_CLINICIAN_PATH;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    return DEFAULT_CLINICIAN_PATH;
  }

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return DEFAULT_CLINICIAN_PATH;
  if (trimmed.includes("://") || trimmed.includes("\\")) return DEFAULT_CLINICIAN_PATH;

  const queryIndex = trimmed.indexOf("?");
  const pathname = queryIndex >= 0 ? trimmed.slice(0, queryIndex) : trimmed;
  const search = queryIndex >= 0 ? trimmed.slice(queryIndex) : "";

  if (pathname === "/" || !pathname.startsWith("/clinician")) {
    return DEFAULT_CLINICIAN_PATH;
  }

  return `${pathname}${search}`;
}

export function buildClinicianLoginRedirect(pathWithOptionalQuery: string): string {
  const returnTo = sanitizeClinicianReturnTo(pathWithOptionalQuery);
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export function mapProviderSessionToDisplay(
  session: ProviderSession | null,
): ClinicianDisplay | null {
  if (!session) return null;

  const email = session.profile?.email?.trim() || session.user.email?.trim() || "";
  const fullName = session.profile?.name?.trim() || email || "Clinician";
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return {
    fullName,
    email,
    initials: initials || "?",
  };
}

export function mapDevClinicianToDisplay(input: {
  full_name: string;
  email: string;
}): ClinicianDisplay {
  const fullName = input.full_name.trim() || "Clinician";
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return {
    fullName,
    email: input.email,
    initials: initials || "?",
  };
}

export function getDevBypassDisplay(): ClinicianDisplay {
  return DEV_BYPASS_DISPLAY;
}

/**
 * Resolves whether the clinician workspace may render.
 * Dev bypass is honored only in development.
 */
export function resolveClinicianAuthGate(input: {
  session: ProviderSession | null;
  devBypassActive: boolean;
  nodeEnv: string;
}): Exclude<ClinicianAuthStatus, "loading"> {
  if (input.session) return "authenticated";
  if (input.nodeEnv === "development" && input.devBypassActive) return "authenticated";
  return "unauthenticated";
}

export type ClinicianSessionProbeResult =
  | {
      status: "authenticated";
      display: ClinicianDisplay;
      devBypass: boolean;
    }
  | { status: "unauthenticated" };

/**
 * Probes Supabase provider session for clinician layout bootstrap.
 * Probe failures resolve to unauthenticated without exposing internal errors.
 */
export async function probeClinicianSession(deps: {
  getProviderSession: () => Promise<ProviderSession | null>;
  devBypassActive: boolean;
  nodeEnv: string;
}): Promise<ClinicianSessionProbeResult> {
  let session: ProviderSession | null = null;

  try {
    session = await deps.getProviderSession();
  } catch {
    return { status: "unauthenticated" };
  }

  const gate = resolveClinicianAuthGate({
    session,
    devBypassActive: deps.devBypassActive,
    nodeEnv: deps.nodeEnv,
  });

  if (gate === "unauthenticated") {
    return { status: "unauthenticated" };
  }

  if (session) {
    const display = mapProviderSessionToDisplay(session);
    if (!display) return { status: "unauthenticated" };
    return { status: "authenticated", display, devBypass: false };
  }

  return {
    status: "authenticated",
    display: getDevBypassDisplay(),
    devBypass: deps.devBypassActive,
  };
}

export async function performClinicianLogout(deps: {
  supabaseSignOut: () => void | Promise<void>;
  clearAuthSession: () => void;
  navigateToLogin: () => void;
  refresh: () => void;
}): Promise<void> {
  try {
    await deps.supabaseSignOut();
  } catch {
    /* still clear legacy state and leave the workspace */
  } finally {
    deps.clearAuthSession();
    deps.navigateToLogin();
    deps.refresh();
  }
}
