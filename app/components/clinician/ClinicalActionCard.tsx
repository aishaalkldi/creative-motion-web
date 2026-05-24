import Link from "next/link";
import type { ClinicalActionResult, ClinicalActionSeverity } from "@/app/lib/clinical-action-engine";
import { ClinicalReviewActions } from "@/app/components/clinician/ClinicalReviewActions";

const SEVERITY_STYLES: Record<
  ClinicalActionSeverity,
  { badge: string; border: string; bg: string }
> = {
  high: {
    badge: "border-rose-400/30 bg-rose-400/10 text-rose-300",
    border: "border-rose-400/25",
    bg: "bg-rose-400/5",
  },
  medium: {
    badge: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    border: "border-amber-400/25",
    bg: "bg-amber-400/5",
  },
  low: {
    badge: "border-[#1D9E75]/30 bg-[#1D9E75]/10 text-[#5DCAA5]",
    border: "border-[#1D9E75]/20",
    bg: "bg-[#1D9E75]/5",
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
    <div className={`rounded-[8px] border ${styles.border} ${styles.bg} ${compact ? "p-3" : "p-4"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">
          Clinical action
        </p>
        <span
          className={`rounded-[5px] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles.badge}`}
        >
          {action.title}
        </span>
      </div>
      <p className={`mt-2 leading-relaxed text-white/75 ${compact ? "text-xs" : "text-sm"}`}>
        {action.reason}
      </p>
      <p className={`mt-2 leading-relaxed text-white/55 ${compact ? "text-xs" : "text-sm"}`}>
        <span className="font-semibold text-white/70">Suggested action: </span>
        {action.suggestedClinicianAction}
      </p>
      {patientNote?.trim() && (
        <div className="mt-3 rounded-[6px] border border-[#1E2D42] bg-[#0B1220]/60 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">
            Patient note
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/70 whitespace-pre-wrap">
            {patientNote}
          </p>
        </div>
      )}
      {planSessionsHref && (
        <Link
          href={planSessionsHref}
          className="mt-3 inline-flex rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2 text-xs font-semibold text-white/70 transition hover:text-white"
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
