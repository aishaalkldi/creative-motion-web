import { clinicianAdherenceSummaryUi } from "@/app/lib/patient-portal-ui";
import { formatPortalDate } from "@/app/lib/patient-portal-ui";

type PatientAdherenceSummaryProps = {
  sessionsCompleted: number;
  totalSessions: number;
  lastActivityAt: string | null;
};

export function PatientAdherenceSummary({
  sessionsCompleted,
  totalSessions,
  lastActivityAt,
}: PatientAdherenceSummaryProps) {
  const ui = clinicianAdherenceSummaryUi("en");
  const notCompleted = Math.max(0, totalSessions - sessionsCompleted);

  if (totalSessions === 0) return null;

  return (
    <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280]">
        {ui.title}
      </p>
      <p className="mt-1 text-[11px] font-medium text-[#9CA3AF]">{ui.forClinicianReview}</p>
      <p className="mt-2 text-[10px] italic text-[#6B7280]">{ui.derivedFromSessionsOnly}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-[#6B7280]">{ui.completedSessions}</p>
          <p
            className="mt-1 text-[18px] font-bold text-[#1D9E75]"
            style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
          >
            {sessionsCompleted}
          </p>
        </div>
        <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-[#6B7280]">
            {ui.notCompletedSessions}
          </p>
          <p
            className="mt-1 text-[18px] font-bold text-[#9CA3AF]"
            style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
          >
            {notCompleted}
          </p>
        </div>
        <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-[#6B7280]">
            {ui.lastPatientActivity}
          </p>
          <p className="mt-1 text-[12px] text-[#F9FAFB]">
            {lastActivityAt
              ? formatPortalDate(lastActivityAt, "en")
              : ui.noActivityYet}
          </p>
        </div>
      </div>
    </section>
  );
}
