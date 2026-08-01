"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ARABIC_READABILITY_NOTICE,
  isArabicAssessmentContent,
  valueTextDirection,
} from "@/app/lib/arabic-readability";
import {
  buildPostStrokeIntakeClinicianReviewEntries,
  formatPostStrokeInputModeIndicator,
} from "@/app/lib/post-stroke-intake/clinician-summary";
import type { AssessmentLanguage } from "@/app/lib/assessment-payload";
import { patientReportedLabel } from "@/app/lib/reports/clinical-report-copy";
import {
  readApprovedPatientReportFacts,
  type ApprovedPatientReportFacts,
} from "@/app/lib/reports/approved-patient-facts";

type Props = {
  submissionMeta: Record<string, unknown>;
  assessmentLanguage?: AssessmentLanguage | null;
  assessmentId?: string;
  compact?: boolean;
  onApprovedFactsChange?: (facts: ApprovedPatientReportFacts) => void;
};

export function PostStrokeSubmittedAnswersReview({
  submissionMeta,
  assessmentLanguage = null,
  assessmentId,
  compact = false,
  onApprovedFactsChange,
}: Props) {
  const entries = useMemo(
    () => buildPostStrokeIntakeClinicianReviewEntries(submissionMeta),
    [submissionMeta],
  );
  const initialApprovedFacts = useMemo(
    () => readApprovedPatientReportFacts(submissionMeta),
    [submissionMeta],
  );
  const [approvedFacts, setApprovedFacts] = useState<ApprovedPatientReportFacts | null>(
    initialApprovedFacts,
  );
  const [approveSaving, setApproveSaving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  useEffect(() => {
    setApprovedFacts(initialApprovedFacts);
  }, [initialApprovedFacts]);

  async function handleApprovePatientReportFacts() {
    if (!assessmentId || approveSaving) return;
    setApproveSaving(true);
    setApproveError(null);
    try {
      const res = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvePatientReportFacts: true }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        approved?: boolean;
        approvedPatientReportFacts?: ApprovedPatientReportFacts;
        error?: string;
      };
      if (!res.ok || !payload.approved || !payload.approvedPatientReportFacts) {
        setApproveError(payload.error ?? "Could not approve patient-reported information.");
        return;
      }
      setApprovedFacts(payload.approvedPatientReportFacts);
      onApprovedFactsChange?.(payload.approvedPatientReportFacts);
    } finally {
      setApproveSaving(false);
    }
  }

  if (entries.length === 0) {
    return (
      <p className="text-xs italic text-white/35">
        No patient answers recorded for this submission.
      </p>
    );
  }

  const narrativeValues = entries
    .filter((entry) => entry.fieldKey !== "respondent" && entry.fieldKey !== "assessmentLanguage")
    .map((entry) => entry.value);
  const showArabicNotice = isArabicAssessmentContent(assessmentLanguage, narrativeValues);

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {!compact ? (
        <p className="text-sm font-bold text-white">Patient-Reported Summary</p>
      ) : null}

      {showArabicNotice ? (
        <div className="rounded-[7px] border border-amber-300/25 bg-amber-400/10 px-3 py-2.5">
          <p className="text-xs leading-relaxed text-amber-100/90">{ARABIC_READABILITY_NOTICE}</p>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[7px] border border-[#1E2D42] bg-[#0B1220]">
        <dl className="divide-y divide-[#1E2D42]">
          {entries.map((entry) => (
            <div key={entry.fieldKey} className="px-3 py-2.5">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                {patientReportedLabel(entry.label)}
                {entry.optional ? (
                  <span className="ml-1 normal-case tracking-normal text-white/30">(optional)</span>
                ) : null}
              </dt>
              <dd className="mt-0.5">
                <p
                  dir={valueTextDirection(entry.value)}
                  className="text-sm leading-relaxed text-white/80 whitespace-pre-wrap"
                >
                  {entry.value}
                </p>
                {entry.inputMode ? (
                  <p className="mt-1 text-[10px] italic text-[#6B7280]">
                    {formatPostStrokeInputModeIndicator(entry.inputMode)}
                  </p>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {assessmentId && !compact ? (
        <div className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-4 py-3.5">
          {approvedFacts ? (
            <>
              <p className="text-sm text-[#5DCAA5]">
                Patient-reported information approved for PT report generation.
              </p>
              <button
                type="button"
                disabled={approveSaving}
                onClick={() => void handleApprovePatientReportFacts()}
                className="mt-3 rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3.5 py-[6px] text-[11px] font-medium text-white transition hover:border-[#1D9E75]/40 hover:text-[#5DCAA5] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {approveSaving
                  ? "Re-approving updated information…"
                  : "Re-approve updated information"}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-[#9CA3AF]">
                Review all confirmed patient-reported information before approving it for report
                generation.
              </p>
              <button
                type="button"
                disabled={approveSaving}
                onClick={() => void handleApprovePatientReportFacts()}
                className="mt-3 rounded-[6px] bg-[#1D9E75] px-3.5 py-[6px] text-[11px] font-medium text-white transition hover:bg-[#179165] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {approveSaving
                  ? "Approving patient-reported information…"
                  : "Approve patient-reported information for report generation"}
              </button>
            </>
          )}
          {approveError ? (
            <p className="mt-2 text-xs text-rose-300/90">{approveError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
