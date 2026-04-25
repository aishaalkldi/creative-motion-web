import GaitTherapySession from "./components/GaitTherapySession";

/**
 * Therapy route: full gait gamification session (camera + MediaPipe).
 * Shell matches main app medical-tech theme; session UI lives in components.
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
