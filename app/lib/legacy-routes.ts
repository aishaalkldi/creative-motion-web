import { isUuidPatientId } from "./api/patient-id-utils";

/** Query flag to access legacy demo patient portal pages (`/patient/*` without token). */
export const LEGACY_DEMO_PARAM = "demo";

/** Query flag to access deprecated legacy clinician/patient surfaces. */
export const LEGACY_ROUTE_PARAM = "legacy";

const LEGACY_DEMO_SESSION_KEY = "rasq_legacy_demo";

export function isLegacyDemoParam(value: string | null | undefined): boolean {
  return value === "1" || value === "true";
}

export function isLegacyRouteParam(value: string | null | undefined): boolean {
  return value === "1" || value === "true";
}

/** Whether a legacy demo patient page should render (not redirect to /patient/invalid). */
/** Minimal search-params shape (URLSearchParams or Next.js read-only). */
type SearchParamsLike = { get(name: string): string | null };

export function isLegacyDemoAllowed(searchParams: SearchParamsLike): boolean {
  if (isLegacyDemoParam(searchParams.get(LEGACY_DEMO_PARAM))) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(LEGACY_DEMO_SESSION_KEY, "1");
    }
    return true;
  }
  if (typeof window !== "undefined") {
    return sessionStorage.getItem(LEGACY_DEMO_SESSION_KEY) === "1";
  }
  return false;
}

/** Resolve redirect target for legacy `/results` — UUID patients go to clinician report. */
export function resolveLegacyResultsRedirect(searchParams: SearchParamsLike): string | null {
  const patientId = searchParams.get("patientId")?.trim();
  if (!patientId || patientId === "—") {
    return "/clinician/results";
  }
  if (isUuidPatientId(patientId)) {
    const qs = new URLSearchParams({ patientId });
    const assessmentId = searchParams.get("assessmentId")?.trim();
    if (assessmentId && assessmentId !== "—") {
      qs.set("assessmentId", assessmentId);
    }
    return `/clinician/assessment/report?${qs.toString()}`;
  }
  return null;
}

/** Modern replacement routes for deprecated legacy surfaces. */
export const LEGACY_ROUTE_TARGETS = {
  therapy: "/sessions",
  gaitVideoUpload: "/clinician/assessments/gait",
  liveResults: "/clinician/results",
  patientInvalid: "/patient/invalid",
} as const;
