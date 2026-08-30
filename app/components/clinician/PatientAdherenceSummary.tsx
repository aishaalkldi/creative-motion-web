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
    <section className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
        {ui.title}
      </p>
      <p className="mt-1 text-[11px] font-medium text-[var(--muted)]">{ui.forClinicianReview}</p>
      <p className="mt-2 text-[10px] italic text-[var(--muted)]">{ui.derivedFromSessionsOnly}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{ui.completedSessions}</p>
          <p
            className="mt-1 text-[18px] font-bold text-[var(--brand)]"
            style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
          >
            {sessionsCompleted}
          </p>
        </div>
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            {ui.notCompletedSessions}
          </p>
          <p
            className="mt-1 text-[18px] font-bold text-[var(--muted)]"
            style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
          >
            {notCompleted}
          </p>
        </div>
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            {ui.lastPatientActivity}
          </p>
          <p className="mt-1 text-[12px] text-[var(--foreground)]">
            {lastActivityAt
              ? formatPortalDate(lastActivityAt, "en")
              : ui.noActivityYet}
          </p>
        </div>
      </div>
    </section>
  );
}
