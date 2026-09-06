"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { PatientAssessmentDraft } from "@/app/lib/api/remote-assessments";
import { getAssessmentLanguage } from "@/app/lib/assessment-payload";
import { PatientSubmittedAnswersReview } from "@/app/components/PatientSubmittedAnswersReview";
import { ClinicalEnglishReviewFields } from "@/app/components/clinician/ClinicalEnglishReviewFields";
import { PtClinicalReportEditor } from "@/app/components/clinician/PtClinicalReportEditor";
import {
  clinicalEnglishLabel,
  isClinicalTranslationApproved,
  ptClinicalReportLabel,
  readClinicalTranslationStatus,
  readEnrichedPtClinicalReportForDisplay,
  readPtClinicalReportStatus,
  resolveRemoteQuestionnaireWorkflowStep,
  type RemoteQuestionnaireWorkflowStep,
} from "@/app/lib/reports/remote-questionnaire-workflow";
import { inferIncludedSections } from "@/app/lib/remote-questionnaire-summary";
import { isPatientAssessmentDraft } from "@/app/lib/remote-questionnaire-summary";

type Props = {
  assessmentId: string;
  structuredData: Record<string, unknown>;
  patientDraft: PatientAssessmentDraft;
  patientId?: string;
  onStructuredDataUpdated: (next: Record<string, unknown>) => void;
};

const WORKFLOW_STEPS: { id: RemoteQuestionnaireWorkflowStep; label: string }[] = [
  { id: "submitted", label: "Submitted" },
  { id: "clinical_english_pending", label: "Clinical English" },
  { id: "translation_review", label: "Translation Approved" },
  { id: "translation_approved", label: "PT Report" },
  { id: "report_draft", label: "Finalized" },
  { id: "report_finalized", label: "Finalized" },
];

async function refreshStructuredData(
  assessmentId: string,
  onStructuredDataUpdated: (next: Record<string, unknown>) => void,
) {
  const detailRes = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}`);
  if (detailRes.ok) {
    const detail = (await detailRes.json()) as { structured_data?: Record<string, unknown> };
    if (detail.structured_data) onStructuredDataUpdated(detail.structured_data);
  }
}

export function RemoteQuestionnaireClinicianPanel({
  assessmentId,
  structuredData,
  patientDraft,
  patientId,
  onStructuredDataUpdated,
}: Props) {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showTranslationReview, setShowTranslationReview] = useState(false);
  const [showReportReview, setShowReportReview] = useState(false);

  const translationStatus = readClinicalTranslationStatus(structuredData);
  const reportStatus = readPtClinicalReportStatus(structuredData);
  const translationApproved = isClinicalTranslationApproved(structuredData);
  const language = getAssessmentLanguage(structuredData);
  const includedSections = useMemo(() => inferIncludedSections(patientDraft), [patientDraft]);
  const reportForDisplay = readEnrichedPtClinicalReportForDisplay(
    structuredData,
    patientDraft,
    includedSections,
  );
  const workflowStep = resolveRemoteQuestionnaireWorkflowStep(structuredData, patientDraft);
  const showTranslateActions = language === "ar";

  const runTranslate = useCallback(
    async (regenerate = false) => {
      setBusyAction(regenerate ? "regenerate-translation" : "translate");
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/translate-questionnaire`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regenerate }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          userMessage?: string;
          error?: string;
        };
        if (!res.ok) {
          setErrorMessage(data.userMessage ?? data.error ?? "Translation could not be generated.");
          return;
        }
        if (data.userMessage) setErrorMessage(data.userMessage);
        await refreshStructuredData(assessmentId, onStructuredDataUpdated);
        setShowTranslationReview(true);
      } catch {
        setErrorMessage("Translation could not be generated. Original patient responses are unchanged.");
      } finally {
        setBusyAction(null);
      }
    },
    [assessmentId, onStructuredDataUpdated],
  );

  const saveTranslationEdits = useCallback(
    async (edits: { fieldKey: string; clinicalEnglish: string }[]) => {
      setBusyAction("save-translation-edits");
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/translate-questionnaire`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saveFieldEdits: edits }),
        });
        if (!res.ok) {
          setErrorMessage("Could not save Clinical English edits.");
          return;
        }
        await refreshStructuredData(assessmentId, onStructuredDataUpdated);
      } finally {
        setBusyAction(null);
      }
    },
    [assessmentId, onStructuredDataUpdated],
  );

  const approveTranslation = useCallback(async () => {
    setBusyAction("approve-translation");
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/translate-questionnaire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve: true }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(data.error ?? "Could not approve Clinical English translation.");
        return;
      }
      await refreshStructuredData(assessmentId, onStructuredDataUpdated);
      setShowTranslationReview(false);
    } finally {
      setBusyAction(null);
    }
  }, [assessmentId, onStructuredDataUpdated]);

  const runPtReport = useCallback(
    async (regenerate = false) => {
      setBusyAction(regenerate ? "regenerate-report" : "generate-report");
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/pt-clinical-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regenerate }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setErrorMessage(data.error ?? "Clinical report could not be generated.");
          return;
        }
        await refreshStructuredData(assessmentId, onStructuredDataUpdated);
        setShowReportReview(true);
      } catch {
        setErrorMessage("Clinical report could not be generated.");
      } finally {
        setBusyAction(null);
      }
    },
    [assessmentId, onStructuredDataUpdated],
  );

  const saveReportDraft = useCallback(
    async (report: Parameters<typeof PtClinicalReportEditor>[0]["report"]) => {
      setBusyAction("save-report");
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/pt-clinical-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saveDraftEdits: report }),
        });
        if (!res.ok) {
          setErrorMessage("Could not save report draft edits.");
          return;
        }
        await refreshStructuredData(assessmentId, onStructuredDataUpdated);
      } finally {
        setBusyAction(null);
      }
    },
    [assessmentId, onStructuredDataUpdated],
  );

  const finalizeReport = useCallback(async () => {
    setBusyAction("finalize-report");
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/pt-clinical-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalize: true }),
      });
      if (!res.ok) {
        setErrorMessage("Could not finalize report.");
        return;
      }
      await refreshStructuredData(assessmentId, onStructuredDataUpdated);
    } finally {
      setBusyAction(null);
    }
  }, [assessmentId, onStructuredDataUpdated]);

  const primaryAction = useMemo(() => {
    if (workflowStep === "clinical_english_pending") {
      return {
        label: busyAction === "translate" ? "Generating…" : "Generate Clinical English",
        onClick: () => void runTranslate(false),
      };
    }
    if (workflowStep === "translation_review") {
      return {
        label: busyAction === "approve-translation" ? "Approving…" : "Approve Clinical Translation",
        onClick: () => void approveTranslation(),
      };
    }
    if (workflowStep === "translation_approved") {
      return {
        label: busyAction === "generate-report" ? "Generating…" : "Generate PT Clinical Report",
        onClick: () => void runPtReport(false),
      };
    }
    if (workflowStep === "report_draft") {
      return {
        label: "Review PT Clinical Report",
        onClick: () => setShowReportReview(true),
      };
    }
    if (workflowStep === "report_finalized" && patientId) {
      return {
        label: "Export / Print PDF",
        onClick: () => undefined,
        href: `/clinician/assessment/report?patientId=${encodeURIComponent(patientId)}&assessmentId=${encodeURIComponent(assessmentId)}`,
      };
    }
    return null;
  }, [
    workflowStep,
    busyAction,
    runTranslate,
    approveTranslation,
    runPtReport,
    patientId,
    assessmentId,
  ]);

  const stepIndex = (() => {
    switch (workflowStep) {
      case "submitted":
      case "clinical_english_pending":
        return 0;
      case "translation_review":
        return 1;
      case "translation_approved":
        return 2;
      case "report_draft":
        return 3;
      case "report_finalized":
        return 4;
      default:
        return 0;
    }
  })();

  const displaySteps = [
    { label: "Submitted", complete: stepIndex >= 0 },
    { label: "Clinical English", complete: stepIndex >= 1 },
    { label: "Translation Approved", complete: stepIndex >= 2 },
    { label: "PT Report", complete: stepIndex >= 3 },
    { label: "Finalized", complete: stepIndex >= 4 },
  ];

  return (
    <div className="mt-4 space-y-4 rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-4 py-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Remote Questionnaire</p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">
          {displaySteps.map((step, index) => (
            <span key={step.label} className="inline-flex items-center gap-2">
              <span className={step.complete ? "text-[#5DCAA5]" : "text-white/35"}>{step.label}</span>
              {index < displaySteps.length - 1 ? <span className="text-white/20">→</span> : null}
            </span>
          ))}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <StatusRow label="Patient submission" value="Submitted" />
          <StatusRow label="Original language" value={language === "ar" ? "Arabic" : "English"} />
          {showTranslateActions ? (
            <StatusRow label="Translation status" value={clinicalEnglishLabel(translationStatus)} />
          ) : null}
          <StatusRow label="PT Clinical Report" value={ptClinicalReportLabel(reportStatus)} />
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-[7px] border border-amber-300/25 bg-amber-400/10 px-3 py-2.5">
          <p className="text-xs leading-relaxed text-amber-100/90">{errorMessage}</p>
        </div>
      ) : null}

      {primaryAction ? (
        <div className="flex flex-wrap gap-2">
          {primaryAction.href ? (
            <Link
              href={primaryAction.href}
              className="rounded-[6px] bg-[#1D9E75] px-3.5 py-[6px] text-[11px] font-medium text-white transition hover:bg-[#179165]"
            >
              {primaryAction.label}
            </Link>
          ) : (
            <ActionButton
              disabled={busyAction !== null}
              onClick={primaryAction.onClick}
              label={primaryAction.label}
            />
          )}
        </div>
      ) : null}

      {(workflowStep === "translation_review" || showTranslationReview) && showTranslateActions ? (
        <div className="border-t border-[#1E2D42] pt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-white">Clinical English Review</p>
            <ActionButton
              disabled={busyAction !== null}
              onClick={() => void runTranslate(true)}
              label={busyAction === "regenerate-translation" ? "Regenerating…" : "Regenerate Clinical English"}
              variant="secondary"
            />
          </div>
          <ClinicalEnglishReviewFields
            patientDraft={patientDraft}
            includedSections={includedSections}
            structuredData={structuredData}
            onSaveEdits={saveTranslationEdits}
            busy={busyAction === "save-translation-edits"}
          />
          {!translationApproved ? (
            <ActionButton
              disabled={busyAction !== null}
              onClick={() => void approveTranslation()}
              label={busyAction === "approve-translation" ? "Approving…" : "Approve Clinical Translation"}
            />
          ) : null}
        </div>
      ) : null}

      <details className="border-t border-[#1E2D42] pt-4">
        <summary className="cursor-pointer text-sm font-bold text-white">
          Original Patient Response (traceability)
        </summary>
        <div className="mt-3">
          <PatientSubmittedAnswersReview
            patientDraft={patientDraft}
            includedSections={includedSections}
            assessmentLanguage={language}
            submissionMeta={structuredData}
            assessmentId={assessmentId}
            compact
          />
        </div>
      </details>

      {(workflowStep === "report_draft" || workflowStep === "report_finalized" || showReportReview) &&
      reportForDisplay ? (
        <div className="border-t border-[#1E2D42] pt-4">
          <PtClinicalReportEditor
            report={reportForDisplay}
            onSave={saveReportDraft}
            onRegenerate={() => runPtReport(true)}
            onFinalize={finalizeReport}
            busyAction={busyAction}
            finalized={reportStatus === "finalized"}
          />
        </div>
      ) : null}
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  variant = "primary",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  const className =
    variant === "primary"
      ? "rounded-[6px] bg-[#1D9E75] px-3.5 py-[6px] text-[11px] font-medium text-white transition hover:bg-[#179165] disabled:cursor-not-allowed disabled:opacity-60"
      : "rounded-[6px] border border-[#1E2D42] bg-[#0F1825] px-3.5 py-[6px] text-[11px] font-medium text-white/80 transition hover:border-[#1D9E75]/25 hover:text-[#5DCAA5] disabled:cursor-not-allowed disabled:opacity-60";
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={className}>
      {label}
    </button>
  );
}

export function isRemoteQuestionnaireStructuredData(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" && data !== null && !Array.isArray(data) && isPatientAssessmentDraft(data);
}
