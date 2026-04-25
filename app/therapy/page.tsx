import GaitTherapySession from "./components/GaitTherapySession";

/**
 * Therapy route: full gait gamification session (camera + MediaPipe).
 * Shell matches main app medical-tech theme; session UI lives in components.
 *
 * TODO (production): Accept signed `token` or `sessionId` query params for patient-only access;
 * sync session summaries to backend by patient + assignment id. `?patientId=` from the patient
 * chart is intentionally ignored until server-side assignment exists (avoid false chart linkage).
 */
export default function TherapyPage() {
  return (
    <div className="min-h-screen bg-[#0B1220] text-white">
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col border-x border-white/10">
        <GaitTherapySession />
      </main>
    </div>
  );
}
