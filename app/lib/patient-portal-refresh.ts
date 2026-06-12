/** Dispatched after patient plan data is refetched (e.g. post session-complete). */
export const PATIENT_PORTAL_REFRESH_EVENT = "rasq-patient-portal-refresh";

export function dispatchPatientPortalRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PATIENT_PORTAL_REFRESH_EVENT));
}
