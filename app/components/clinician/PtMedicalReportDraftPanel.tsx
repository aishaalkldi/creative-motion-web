"use client";

import { useEffect, useState } from "react";
import type { ApprovedPatientReportFacts } from "@/app/lib/reports/approved-patient-facts";
import {
  PT_MEDICAL_REPORT_DRAFT_LABEL,
  PT_MEDICAL_REPORT_SECTION_KEYS,
  PT_MEDICAL_REPORT_SECTION_LABELS,
  readPtMedicalReportDraft,
  type PtMedicalReportDraft,
  type PtMedicalReportSectionKey,
} from "@/app/lib/ai/generate-pt-medical-report";

export type PtMedicalReportPanelState =
  | "gate1_required"
  | "ready_to_generate"
  | "draft_ready";

export type PtMedicalReportPanelViewModel = {
  state: PtMedicalReportPanelState;
  draftLabel: string | null;
  visibleSectionKeys: PtMedicalReportSectionKey[];
  draft: PtMedicalReportDraft | null;
  generateButtonLabel: string;
  showRegenerate: boolean;
};

export function derivePtMedicalReportPanelState(
  approvedFacts: ApprovedPatientReportFacts | null,
  draft: PtMedicalReportDraft | null,
): PtMedicalReportPanelState {
  if (!approvedFacts) return "gate1_required";
  if (!draft) return "ready_to_generate";
  return "draft_ready";
}

export function buildPtMedicalReportPanelViewModel(
  approvedFacts: ApprovedPatientReportFacts | null,
  draft: PtMedicalReportDraft | null,
): PtMedicalReportPanelViewModel {
  const state = derivePtMedicalReportPanelState(approvedFacts, draft);
  const visibleSectionKeys = draft
    ? PT_MEDICAL_REPORT_SECTION_KEYS.filter((key) => Boolean(draft.sections[key]?.trim()))
    : [];

  return {
    state,
    draftLabel: state === "draft_ready" ? PT_MEDICAL_REPORT_DRAFT_LABEL : null,
    visibleSectionKeys,
    draft,
    generateButtonLabel: "Generate English PT Medical Report",
    showRegenerate: state === "draft_ready",
  };
}

export function parseGeneratePtReportApiResponse(payload: unknown): {
  ok: boolean;
  draft: PtMedicalReportDraft | null;
  error: string | null;
} {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, draft: null, error: "Could not generate PT medical report." };
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) {
    return { ok: false, draft: null, error: record.error.trim() };
  }
  const draft = readPtMedicalReportDraft({ ptMedicalReportDraft: record.ptMedicalReportDraft });
  if (!record.generated || !draft) {
    return { ok: false, draft: null, error: "Could not generate PT medical report." };
  }
  return { ok: true, draft, error: null };
}

type Props = {
  assessmentId?: string;
  approvedFacts: ApprovedPatientReportFacts | null;
  initialDraft?: PtMedicalReportDraft | null;
  onDraftChange?: (draft: PtMedicalReportDraft) => void;
};

export function PtMedicalReportDraftPanel({
  assessmentId,
  approvedFacts,
  initialDraft = null,
  onDraftChange,
}: Props) {
  const [draft, setDraft] = useState<PtMedicalReportDraft | null>(initialDraft);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  const viewModel = buildPtMedicalReportPanelViewModel(approvedFacts, draft);

  async function handleGenerate() {
    if (!assessmentId || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/assessments/${encodeURIComponent(assessmentId)}/generate-pt-report`,
        { method: "POST" },
      );
      const payload = (await res.json().catch(() => ({}))) as unknown;
      const parsed = parseGeneratePtReportApiResponse(payload);
      if (!parsed.ok || !parsed.draft) {
        setError(parsed.error ?? "Could not generate PT medical report.");
        return;
      }
      setDraft(parsed.draft);
      onDraftChange?.(parsed.draft);
    } finally {
      setGenerating(false);
    }
  }

  if (viewModel.state === "gate1_required") {
    return (
      <div className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-4 py-3.5">
        <p className="text-sm leading-relaxed text-[#9CA3AF]">
          Approve patient-reported information before generating the PT report.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">English PT Medical Report</p>
          {viewModel.draftLabel ? (
            <p className="mt-1 text-xs font-semibold text-amber-200">{viewModel.draftLabel}</p>
          ) : (
            <p className="mt-1 text-xs text-[#9CA3AF]">
              Generate a clinician-review draft from approved patient-reported facts only.
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={!assessmentId || generating}
          onClick={() => void handleGenerate()}
          className="rounded-[6px] bg-[#1D9E75] px-3.5 py-[6px] text-[11px] font-medium text-white transition hover:bg-[#179165] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generating
            ? viewModel.showRegenerate
              ? "Regenerating report…"
              : "Generating report…"
            : viewModel.showRegenerate
              ? "Regenerate report"
              : viewModel.generateButtonLabel}
        </button>
      </div>

      {viewModel.state === "ready_to_generate" ? (
        <p className="mt-3 text-xs leading-relaxed text-[#9CA3AF]">
          Generation uses only the Gate 1 approved English snapshot. Original Arabic answers remain
          available in the review section above.
        </p>
      ) : null}

      {viewModel.visibleSectionKeys.length > 0 ? (
        <div className="mt-4 space-y-4">
          {viewModel.visibleSectionKeys.map((key) => (
            <div key={key} className="rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3.5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#5DCAA5]">
                {PT_MEDICAL_REPORT_SECTION_LABELS[key]}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/80 whitespace-pre-wrap">
                {draft?.sections[key]}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-xs text-rose-300/90">{error}</p> : null}
    </div>
  );
}
