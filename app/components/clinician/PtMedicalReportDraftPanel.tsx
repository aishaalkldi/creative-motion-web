"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApprovedPatientReportFacts } from "@/app/lib/reports/approved-patient-facts";
import {
  PT_MEDICAL_REPORT_APPROVED_LABEL,
  PT_MEDICAL_REPORT_DRAFT_LABEL,
  PT_MEDICAL_REPORT_SECTION_KEYS,
  PT_MEDICAL_REPORT_SECTION_LABELS,
  readPtMedicalReportApproved,
  readPtMedicalReportDraft,
  type PtMedicalReportApproved,
  type PtMedicalReportDraft,
  type PtMedicalReportDraftSections,
  type PtMedicalReportSectionKey,
} from "@/app/lib/ai/generate-pt-medical-report";
import {
  resolvePtMedicalReportExportEligibility,
  shouldInvokeApprovedPtMedicalReportPrint,
} from "@/app/components/reports/PtMedicalReportPrintView";

export type PtMedicalReportPanelState =
  | "gate1_required"
  | "ready_to_generate"
  | "draft_ready"
  | "approved";

export type PtMedicalReportPanelViewModel = {
  state: PtMedicalReportPanelState;
  statusLabel: string | null;
  editableSectionKeys: PtMedicalReportSectionKey[];
  draft: PtMedicalReportDraft | null;
  approved: PtMedicalReportApproved | null;
  generateButtonLabel: string;
  showRegenerate: boolean;
  showSaveDraft: boolean;
  showApprove: boolean;
  showExport: boolean;
  exportBlockedMessage: string | null;
};

export function derivePtMedicalReportPanelState(
  approvedFacts: ApprovedPatientReportFacts | null,
  draft: PtMedicalReportDraft | null,
  approved: PtMedicalReportApproved | null,
): PtMedicalReportPanelState {
  if (!approvedFacts) return "gate1_required";
  if (!draft) return "ready_to_generate";
  if (approved) return "approved";
  return "draft_ready";
}

export function buildPtMedicalReportPanelViewModel(
  approvedFacts: ApprovedPatientReportFacts | null,
  draft: PtMedicalReportDraft | null,
  approved: PtMedicalReportApproved | null,
  editedSections: PtMedicalReportDraftSections | null = null,
  gate2ApprovedAt: string | null = null,
): PtMedicalReportPanelViewModel {
  const state = derivePtMedicalReportPanelState(approvedFacts, draft, approved);
  const sectionSource = editedSections ?? draft?.sections ?? {};
  const editableSectionKeys = PT_MEDICAL_REPORT_SECTION_KEYS.filter((key) =>
    Boolean(sectionSource[key]?.trim()),
  );
  const exportEligibility = resolvePtMedicalReportExportEligibility({
    approvedFacts,
    draft,
    approved,
    gate2ApprovedAt,
  });

  return {
    state,
    statusLabel:
      exportEligibility.exportable
        ? PT_MEDICAL_REPORT_APPROVED_LABEL
        : state === "draft_ready"
          ? PT_MEDICAL_REPORT_DRAFT_LABEL
          : state === "approved" && exportEligibility.blockReason === "stale_approval"
            ? PT_MEDICAL_REPORT_DRAFT_LABEL
            : state === "approved"
              ? PT_MEDICAL_REPORT_APPROVED_LABEL
              : null,
    editableSectionKeys,
    draft,
    approved,
    generateButtonLabel: "Generate English PT Medical Report",
    showRegenerate: Boolean(draft),
    showSaveDraft: Boolean(draft),
    showApprove: Boolean(draft) && !exportEligibility.exportable,
    showExport: exportEligibility.exportable,
    exportBlockedMessage: exportEligibility.exportable ? null : exportEligibility.message,
  };
}

export function parseGeneratePtReportApiResponse(payload: unknown): {
  ok: boolean;
  draft: PtMedicalReportDraft | null;
  approved: PtMedicalReportApproved | null;
  error: string | null;
} {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, draft: null, approved: null, error: "Could not generate PT medical report." };
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) {
    return { ok: false, draft: null, approved: null, error: record.error.trim() };
  }
  const draft = readPtMedicalReportDraft({ ptMedicalReportDraft: record.ptMedicalReportDraft });
  if (!record.generated || !draft) {
    return { ok: false, draft: null, approved: null, error: "Could not generate PT medical report." };
  }
  return { ok: true, draft, approved: null, error: null };
}

export function parseSavePtReportDraftApiResponse(payload: unknown): {
  ok: boolean;
  draft: PtMedicalReportDraft | null;
  gate2Invalidated: boolean;
  error: string | null;
} {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, draft: null, gate2Invalidated: false, error: "Could not save report draft." };
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) {
    return { ok: false, draft: null, gate2Invalidated: false, error: record.error.trim() };
  }
  const draft = readPtMedicalReportDraft({ ptMedicalReportDraft: record.ptMedicalReportDraft });
  if (!record.saved || !draft) {
    return { ok: false, draft: null, gate2Invalidated: false, error: "Could not save report draft." };
  }
  return {
    ok: true,
    draft,
    gate2Invalidated: record.gate2Invalidated === true,
    error: null,
  };
}

export function parseApprovePtReportApiResponse(payload: unknown): {
  ok: boolean;
  approved: PtMedicalReportApproved | null;
  error: string | null;
} {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, approved: null, error: "Could not approve PT medical report." };
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) {
    return { ok: false, approved: null, error: record.error.trim() };
  }
  const approved = readPtMedicalReportApproved({
    ptMedicalReportApproved: record.ptMedicalReportApproved,
  });
  if (!record.approved || !approved) {
    return { ok: false, approved: null, error: "Could not approve PT medical report." };
  }
  return { ok: true, approved, error: null };
}

type Props = {
  assessmentId?: string;
  approvedFacts: ApprovedPatientReportFacts | null;
  initialDraft?: PtMedicalReportDraft | null;
  initialApproved?: PtMedicalReportApproved | null;
  gate2ApprovedAt?: string | null;
  onDraftChange?: (draft: PtMedicalReportDraft | null) => void;
  onApprovedChange?: (approved: PtMedicalReportApproved | null) => void;
  onGate2ApprovedAtChange?: (approvedAt: string | null) => void;
  onPrintApprovedReport?: () => void;
};

export function PtMedicalReportDraftPanel({
  assessmentId,
  approvedFacts,
  initialDraft = null,
  initialApproved = null,
  gate2ApprovedAt = null,
  onDraftChange,
  onApprovedChange,
  onGate2ApprovedAtChange,
  onPrintApprovedReport,
}: Props) {
  const [draft, setDraft] = useState<PtMedicalReportDraft | null>(initialDraft);
  const [approved, setApproved] = useState<PtMedicalReportApproved | null>(initialApproved);
  const [editedSections, setEditedSections] = useState<PtMedicalReportDraftSections>(
    () => initialDraft?.sections ?? {},
  );
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initialDraft);
    setApproved(initialApproved);
    setEditedSections(initialDraft?.sections ?? {});
  }, [initialDraft, initialApproved]);

  const viewModel = useMemo(
    () =>
      buildPtMedicalReportPanelViewModel(
        approvedFacts,
        draft,
        approved,
        editedSections,
        gate2ApprovedAt,
      ),
    [approvedFacts, draft, approved, editedSections, gate2ApprovedAt],
  );

  const exportEligibility = useMemo(
    () =>
      resolvePtMedicalReportExportEligibility({
        approvedFacts,
        draft,
        approved,
        gate2ApprovedAt,
      }),
    [approvedFacts, draft, approved, gate2ApprovedAt],
  );

  function handlePrintExport() {
    if (!shouldInvokeApprovedPtMedicalReportPrint(exportEligibility)) return;
    onPrintApprovedReport?.();
  }

  function syncDraft(nextDraft: PtMedicalReportDraft | null) {
    setDraft(nextDraft);
    setEditedSections(nextDraft?.sections ?? {});
    onDraftChange?.(nextDraft);
  }

  async function handleGenerate() {
    if (!assessmentId || generating) return;
    setGenerating(true);
    setError(null);
    setSuccessMessage(null);
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
      syncDraft(parsed.draft);
      setApproved(null);
      onApprovedChange?.(null);
      onGate2ApprovedAtChange?.(null);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveDraft() {
    if (!assessmentId || saving || !draft) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savePtMedicalReportDraft: { sections: editedSections } }),
      });
      const payload = (await res.json().catch(() => ({}))) as unknown;
      const parsed = parseSavePtReportDraftApiResponse(payload);
      if (!parsed.ok || !parsed.draft) {
        setError(parsed.error ?? "Could not save report draft.");
        return;
      }
      syncDraft(parsed.draft);
      if (parsed.gate2Invalidated) {
        setApproved(null);
        onApprovedChange?.(null);
        onGate2ApprovedAtChange?.(null);
      }
      setSuccessMessage("Report draft saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    if (!assessmentId || approving || !draft) return;
    setApproving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvePtMedicalReport: true }),
      });
      const payload = (await res.json().catch(() => ({}))) as unknown;
      const parsed = parseApprovePtReportApiResponse(payload);
      if (!parsed.ok || !parsed.approved) {
        setError(parsed.error ?? "Could not approve PT medical report.");
        return;
      }
      setApproved(parsed.approved);
      onApprovedChange?.(parsed.approved);
      onGate2ApprovedAtChange?.(parsed.approved.approvedAt);
      setSuccessMessage(PT_MEDICAL_REPORT_APPROVED_LABEL);
    } finally {
      setApproving(false);
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
          {viewModel.statusLabel ? (
            <p
              className={`mt-1 text-xs font-semibold ${
                viewModel.state === "approved" ? "text-[#5DCAA5]" : "text-amber-200"
              }`}
            >
              {viewModel.statusLabel}
            </p>
          ) : (
            <p className="mt-1 text-xs text-[#9CA3AF]">
              Generate a clinician-review draft from approved patient-reported facts only.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!assessmentId || generating}
            onClick={() => void handleGenerate()}
            className="rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3.5 py-[6px] text-[11px] font-medium text-white transition hover:border-[#1D9E75]/40 hover:text-[#5DCAA5] disabled:cursor-not-allowed disabled:opacity-60"
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
      </div>

      {viewModel.state === "ready_to_generate" ? (
        <p className="mt-3 text-xs leading-relaxed text-[#9CA3AF]">
          Generation uses only the Gate 1 approved English snapshot. Original Arabic answers remain
          available in the review section above.
        </p>
      ) : null}

      {viewModel.editableSectionKeys.length > 0 ? (
        <div className="mt-4 space-y-4">
          {viewModel.editableSectionKeys.map((key) => (
            <div key={key} className="rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3.5 py-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#5DCAA5]">
                {PT_MEDICAL_REPORT_SECTION_LABELS[key]}
              </label>
              <textarea
                value={editedSections[key] ?? ""}
                onChange={(event) =>
                  setEditedSections((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
                rows={key === "clinicalReviewNote" ? 4 : 5}
                className="mt-2 w-full resize-y rounded-[6px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2 text-sm leading-relaxed text-white/85 outline-none focus:border-[#1D9E75]/40"
              />
            </div>
          ))}
        </div>
      ) : null}

      {viewModel.showSaveDraft || viewModel.showApprove ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {viewModel.showSaveDraft ? (
            <button
              type="button"
              disabled={!assessmentId || saving}
              onClick={() => void handleSaveDraft()}
              className="rounded-[6px] bg-[#1D9E75] px-3.5 py-[6px] text-[11px] font-medium text-white transition hover:bg-[#179165] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving report draft…" : "Save report draft"}
            </button>
          ) : null}
          {viewModel.showApprove ? (
            <button
              type="button"
              disabled={!assessmentId || approving}
              onClick={() => void handleApprove()}
              className="rounded-[6px] border border-[#1D9E75]/40 bg-[#1D9E75]/10 px-3.5 py-[6px] text-[11px] font-medium text-[#5DCAA5] transition hover:bg-[#1D9E75]/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {approving ? "Approving report…" : "Approve report for print and PDF"}
            </button>
          ) : null}
        </div>
      ) : null}

      {viewModel.exportBlockedMessage && !viewModel.showExport ? (
        <p className="mt-3 text-xs leading-relaxed text-[#9CA3AF]">{viewModel.exportBlockedMessage}</p>
      ) : null}

      {viewModel.showExport ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePrintExport}
            className="rounded-[6px] bg-[#1D9E75] px-3.5 py-[6px] text-[11px] font-medium text-white transition hover:bg-[#179165]"
          >
            Print / Export PDF
          </button>
          <p className="w-full text-[10px] leading-relaxed text-[#9CA3AF]">
            Use your browser&apos;s print dialog and choose Save as PDF when ready.
          </p>
        </div>
      ) : null}

      {successMessage ? <p className="mt-3 text-xs text-[#5DCAA5]">{successMessage}</p> : null}
      {error ? <p className="mt-3 text-xs text-rose-300/90">{error}</p> : null}
    </div>
  );
}
