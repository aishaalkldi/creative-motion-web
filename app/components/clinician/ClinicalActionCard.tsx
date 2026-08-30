import Link from "next/link";
import type { ClinicalActionResult, ClinicalActionSeverity } from "@/app/lib/clinical-action-engine";
import { ClinicalReviewActions } from "@/app/components/clinician/ClinicalReviewActions";

const SEVERITY_STYLES: Record<
  ClinicalActionSeverity,
  { badge: string; border: string; bg: string }
> = {
  high: {
    badge: "border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger)]",
    border: "border-[var(--danger)]/25",
    bg: "bg-[var(--danger-soft)]",
  },
  medium: {
    badge: "border-[var(--warning)]/30 bg-[var(--warning-soft)] text-[var(--warning)]",
    border: "border-[var(--warning)]/25",
    bg: "bg-[var(--warning-soft)]",
  },
  low: {
    badge: "border-[var(--brand)]/30 bg-[var(--brand-soft)] text-[var(--brand)]",
    border: "border-[var(--brand)]/20",
    bg: "bg-[var(--brand-soft)]",
  },
};

type ClinicalActionCardProps = {
  action: ClinicalActionResult;
  patientNote?: string | null;
  planSessionsHref?: string;
  compact?: boolean;
  review?: {
    patientId: string;
    planId: string;
    sessionLogId?: string | null;
    reviewAcknowledged: boolean;
    reviewedAt?: string | null;
    onAcknowledged?: (reviewedAt: string) => void;
  };
};

export function ClinicalActionCard({
  action,
  patientNote,
  planSessionsHref,
  compact = false,
  review,
}: ClinicalActionCardProps) {
  const styles = SEVERITY_STYLES[action.severity];

  return (
    <div className={`rounded-[12px] border ${styles.border} ${styles.bg} ${compact ? "p-3" : "p-4"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
          Clinical action
        </p>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles.badge}`}
        >
          {action.title}
        </span>
      </div>
      <p className={`mt-2 leading-relaxed text-[var(--foreground)] ${compact ? "text-xs" : "text-sm"}`}>
        {action.reason}
      </p>
      <p className={`mt-2 leading-relaxed text-[var(--muted)] ${compact ? "text-xs" : "text-sm"}`}>
        <span className="font-semibold text-[var(--foreground)]">Clinician follow-up note: </span>
        {action.suggestedClinicianAction}
      </p>
      {patientNote?.trim() && (
        <div className="mt-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)]/60 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-soft)]">
            Patient note
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--foreground)] whitespace-pre-wrap">
            {patientNote}
          </p>
        </div>
      )}
      {planSessionsHref && (
        <Link
          href={planSessionsHref}
          className="mt-3 inline-flex rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--brand)]/40"
        >
          View Plan &amp; Sessions
        </Link>
      )}
      {review && (
        <ClinicalReviewActions
          patientId={review.patientId}
          planId={review.planId}
          sessionLogId={review.sessionLogId}
          actionStatus={action.status}
          reviewAcknowledged={review.reviewAcknowledged}
          reviewedAt={review.reviewedAt}
          onAcknowledged={review.onAcknowledged}
          compact={compact}
        />
      )}
    </div>
  );
}
