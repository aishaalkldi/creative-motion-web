"use client";

import Link from "next/link";
import { useEffect, useState, useMemo, useCallback, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { BackendPatient } from "@/app/lib/api";
import type { AssessmentData } from "@/app/lib/assessment-types";
import type { AssessmentDetailResponse } from "@/app/api/assessments/[id]/route";
import {
  extractGeneralDraft,
  extractStructuredData,
  getAssessmentLanguage,
} from "@/app/lib/assessment-payload";
import { loadGeneralAssessmentDraft, saveGeneralAssessmentDraft } from "@/app/lib/general-assessment/storage";
import type {
  CvRowStatus,
  FunctionalKey,
  GeneralAssessmentDraft,
  ObjectiveKey,
  OutcomeKey,
  SpecialTestResult,
} from "@/app/lib/general-assessment/types";
import {
  SPECIAL_TESTS_CATALOG,
  REGION_LABELS,
  REGION_ORDER,
  getTestsByRegion,
  countRegionResults,
  getTestedTests,
  type SpecialTestRegion,
} from "@/app/lib/general-assessment/special-tests-catalog";
import {
  getTreatmentPlan,
  REHAB_PROGRAMS,
  type TreatmentPlan,
  type RehabProgram,
} from "@/app/lib/api/treatment-plans";
import { PatientSubmittedAnswersReview } from "@/app/components/PatientSubmittedAnswersReview";
import type { PatientAssessmentDraft, PatientSectionId } from "@/app/lib/api/remote-assessments";
import {
  detectRedFlag,
  extractRemoteQuestionnaireDraft,
  inferIncludedSections,
  buildRemoteQuestionnaireSummary,
} from "@/app/lib/remote-questionnaire-summary";
import { ReportExportToolbar } from "@/app/components/reports/ReportExportToolbar";
import { RemoteQuestionnairePrintReport } from "@/app/components/reports/RemoteQuestionnairePrintReport";
import { PdfTranslationWarningModal } from "@/app/components/clinician/PdfTranslationWarningModal";

// ── Constants & labels ─────────────────────────────────────────────────────────

const DISCLAIMER =
  "Clinical decision-support draft — this report is generated from patient-submitted data and must be reviewed by a licensed clinician before treatment is assigned.";

const OBJECTIVE_LABELS: Record<ObjectiveKey, string> = {
  posture: "Posture",
  rom: "Range of Motion",
  squat: "Squat Analysis",
  gait: "Gait Analysis",
  balance: "Balance",
  sit_to_stand: "Sit-to-Stand",
};

const FUNCTIONAL_LABELS: Record<FunctionalKey, string> = {
  five_x_sts: "5× Sit-to-Stand",
  tug: "Timed Up and Go (TUG)",
  gait_speed: "Gait Speed",
  single_leg_balance: "Single-Leg Balance",
  squat: "Squat",
  step_down: "Step-Down Test",
};

const OUTCOME_LABELS: Record<OutcomeKey, { abbr: string; full: string }> = {
  nprs:      { abbr: "NPRS",     full: "Numeric Pain Rating Scale" },
  psfs:      { abbr: "PSFS",     full: "Patient-Specific Functional Scale" },
  lefs:      { abbr: "LEFS",     full: "Lower Extremity Functional Scale" },
  quickdash: { abbr: "QuickDASH", full: "QuickDASH" },
  oswestry:  { abbr: "ODI",      full: "Oswestry Disability Index" },
  ndi:       { abbr: "NDI",      full: "Neck Disability Index" },
};

const STATUS_CLS: Record<CvRowStatus, string> = {
  not_started: "border-white/15 bg-white/[0.06] text-white/40",
  in_progress:  "border-amber-300/25 bg-amber-400/10 text-amber-300",
  completed:    "border-lime-300/25 bg-lime-400/12 text-lime-300",
};

const STATUS_LABEL: Record<CvRowStatus, string> = {
  not_started: "Not started",
  in_progress:  "In progress",
  completed:    "Completed",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function hasPatientSubmittedContent(d: GeneralAssessmentDraft): boolean {
  const s = d.subjective;
  return [
    s.chiefComplaint,
    s.painLocation,
    s.nprs,
    s.aggravating,
    s.easing,
    s.functionalLimitations,
    s.goals,
    s.redFlags,
  ].some((v) => v.trim());
}

function hasSoapContent(d: GeneralAssessmentDraft): boolean {
  return [d.soap.subjective, d.soap.objective, d.soap.assessment, d.soap.plan].some((v) => v.trim());
}

function hasClinicalInterpretation(d: GeneralAssessmentDraft): boolean {
  return [
    d.ai.clinicalImpression,
    d.ai.supportingFindings,
    d.ai.missingTests,
    d.ai.confidenceLevel,
    d.ai.safetyNotes,
  ].some((v) => v.trim());
}

function isDraftMeaningful(d: GeneralAssessmentDraft): boolean {
  const s = d.subjective;
  if ([s.chiefComplaint, s.painLocation, s.nprs, s.aggravating, s.easing, s.goals, s.redFlags]
    .some((v) => v.trim())) return true;
  if ([d.soap.subjective, d.soap.objective, d.soap.assessment, d.soap.plan]
    .some((v) => v.trim())) return true;
  if (d.therapist.finalDiagnosis.trim() || d.therapist.treatmentPriorities.trim()) return true;
  if (Object.values(d.objective).some((v) => v.status !== "not_started" || v.result.trim())) return true;
  if (Object.values(d.functional).some((v) => v.status !== "not_started" || v.result.trim())) return true;
  if (Object.values(d.outcomes).some((v) => v.rawNotes.trim() || v.clinicianDocumented.trim())) return true;
  return false;
}

function matchPrograms(d: GeneralAssessmentDraft): RehabProgram[] {
  const text = [
    d.ai.clinicalImpression,
    d.therapist.finalDiagnosis,
    d.therapist.treatmentPriorities,
    d.subjective.chiefComplaint,
  ].join(" ").toLowerCase();

  return REHAB_PROGRAMS.filter((p) => {
    if (p.id === "acl-rehab" &&
        (text.includes("acl") || text.includes("knee") || text.includes("anterior cruciate") || text.includes("ligament")))
      return true;
    if (p.id === "gait-training" &&
        (text.includes("gait") || text.includes("walk") || text.includes("stride") || text.includes("step")))
      return true;
    return false;
  });
}

function hasRiskData(d: GeneralAssessmentDraft) {
  return d.subjective.redFlags.trim() || d.ai.safetyNotes.trim();
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch { return iso; }
}

// ── Atoms ──────────────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: CvRowStatus }) {
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_CLS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function InfoTile({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{label}</p>
      <p className={`mt-1.5 text-sm font-semibold ${accent ?? "text-white"}`}>{value || "—"}</p>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div className="border-b border-white/8 py-3.5 last:border-0">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">{label}</p>
      <p className="text-sm leading-6 text-white/80 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function EmptyFieldNote({ text = "Not recorded" }: { text?: string }) {
  return <span className="text-xs italic text-white/30">{text}</span>;
}

function SoapCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] p-4">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#5DCAA5]/60">{label}</p>
      {value.trim() ? (
        <p className="text-sm leading-6 text-white/80 whitespace-pre-wrap">{value}</p>
      ) : (
        <EmptyFieldNote />
      )}
    </div>
  );
}

function EditableSoapSection({
  draft,
  onChange,
  onSave,
  saving,
  saveMessage,
}: {
  draft: GeneralAssessmentDraft;
  onChange: (soap: GeneralAssessmentDraft["soap"]) => void;
  onSave: () => void;
  saving: boolean;
  saveMessage: string;
}) {
  const fields: { key: keyof GeneralAssessmentDraft["soap"]; label: string }[] = [
    { key: "subjective", label: "S — Subjective" },
    { key: "objective", label: "O — Objective" },
    { key: "assessment", label: "A — Assessment" },
    { key: "plan", label: "P — Plan" },
  ];

  return (
    <div>
      <p className="mb-4 text-xs text-white/45 print:hidden">
        Edit SOAP notes below. Changes are saved to this assessment record.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(({ key, label }) => (
          <div key={key} className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] p-4">
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#5DCAA5]/60">
              {label}
            </label>
            <textarea
              value={draft.soap[key]}
              onChange={(e) => onChange({ ...draft.soap, [key]: e.target.value })}
              rows={key === "assessment" || key === "plan" ? 4 : 5}
              className="w-full resize-y rounded-[6px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2 text-sm leading-6 text-white/85 outline-none focus:border-[#1D9E75]/40 print:border-transparent print:bg-white print:text-black"
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-[7px] bg-[#1D9E75] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#179165] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save SOAP"}
        </button>
        {saveMessage && (
          <span className={`text-xs ${saveMessage.startsWith("Saved") ? "text-[#5DCAA5]" : "text-rose-300"}`}>
            {saveMessage}
          </span>
        )}
      </div>
    </div>
  );
}

const DOC_ICON = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

function StructuredAssessmentReport({ data, notes }: { data: AssessmentData; notes: string | null }) {
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-6 py-8">
      <ReportSection id="summary" title="Structured Assessment Summary" defaultOpen icon={DOC_ICON}>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoTile label="Body region" value={data.bodyRegion} />
          <InfoTile label="Rehab phase" value={data.rehabilitationPhase} />
          <InfoTile label="Pain at rest" value={`${data.painAtRest}/10`} accent="text-rose-300" />
          <InfoTile label="Pain on movement" value={`${data.painOnMovement}/10`} accent="text-rose-300" />
          <InfoTile label="Pain location" value={data.painLocation || "—"} />
          <InfoTile label="Onset" value={data.onset} />
        </div>
        {data.clinicalNotes && <TextBlock label="Clinical notes" value={data.clinicalNotes} />}
        {notes && <TextBlock label="Provider notes" value={notes} />}
      </ReportSection>
      {data.rom?.measurements?.length > 0 && (
        <ReportSection id="objective" title="Range of Motion" defaultOpen icon={DOC_ICON}>
          <div className="space-y-2">
            {data.rom.measurements.map((m) => (
              <div key={m.label} className="flex justify-between border-b border-white/8 py-2 text-sm">
                <span className="text-white/70">{m.label}</span>
                <span className="font-semibold text-[#5DCAA5]">
                  {m.value}{m.unit ?? "°"}
                </span>
              </div>
            ))}
          </div>
        </ReportSection>
      )}
      {data.functionalTests?.length > 0 && (
        <ReportSection id="functional" title="Functional Tests" icon={DOC_ICON}>
          {data.functionalTests.map((t) => (
            <div key={t.testName} className="border-b border-white/8 py-3 last:border-0">
              <p className="text-sm font-semibold text-white">{t.testName}</p>
              <p className="text-xs text-white/50">Result: {t.result}</p>
              {t.notes && <p className="mt-1 text-sm text-white/70">{t.notes}</p>}
            </div>
          ))}
        </ReportSection>
      )}
    </div>
  );
}

// ── Collapsible section wrapper ────────────────────────────────────────────────

function ReportSection({
  id,
  title,
  icon,
  children,
  defaultOpen = true,
  accent,
  screenOnly = false,
  hideWhenEmptyPrint = false,
  hasPrintContent = true,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  accent?: string;
  screenOnly?: boolean;
  hideWhenEmptyPrint?: boolean;
  hasPrintContent?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const emptyPrintClass = hideWhenEmptyPrint && !hasPrintContent ? "print-empty-section" : "";

  return (
    <section
      id={id}
      className={`print-section overflow-hidden rounded-[10px] border border-[#1E2D42] bg-[#0F1825] ${screenOnly ? "screen-only" : ""} ${emptyPrintClass}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="screen-only flex w-full items-center gap-3 px-6 py-4 text-left transition hover:bg-[#0B1220]/50"
      >
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] border ${accent ?? "border-[#1E2D42] bg-[#0B1220] text-white/40"}`}>
          {icon}
        </div>
        <h2 className="flex-1 text-base font-bold text-white">{title}</h2>
        <svg
          className={`h-4 w-4 text-white/30 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <h2 className="print-section-title hidden print:block">{title}</h2>
      <div
        className={`print-section-body border-t border-[#1E2D42] px-6 pb-6 pt-5 print:border-0 print:px-0 print:pb-0 print:pt-3 ${
          open ? "" : "hidden print:!block"
        }`}
      >
        {children}
      </div>
    </section>
  );
}

function RasqPrintHeader({
  patientName,
  patientId,
  displayDate,
  assessmentId,
}: {
  patientName: string;
  patientId: string;
  displayDate: string;
  assessmentId?: string;
}) {
  return (
    <header className="print-only print-report-header">
      <div className="flex items-center gap-3 border-b border-gray-300 pb-3">
        <svg width="28" height="28" viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0">
          <path d="M10 2C5.582 2 2 5.582 2 10s3.582 8 8 8" stroke="#1D9E75" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M10 5.5C7.515 5.5 5.5 7.515 5.5 10S7.515 14.5 10 14.5" stroke="#179165" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="10" cy="10" r="1.5" fill="#1D9E75" />
        </svg>
        <div>
          <p className="text-base font-bold text-black">RASQ</p>
          <p className="text-[11px] text-gray-600">Rehabilitation Assessment System</p>
        </div>
      </div>
      <h1 className="mt-4 text-xl font-bold text-black">Clinical Assessment Report</h1>
      <p className="mt-2 text-sm font-semibold text-black">{patientName}</p>
      <p className="mt-1 text-xs text-gray-600">
        {formatDate(displayDate)} · Patient ID {patientId}
        {assessmentId ? ` · Ref ${assessmentId.slice(0, 8)}` : ""}
      </p>
      <p className="mt-3 rounded border border-gray-300 bg-gray-50 px-3 py-2 text-[11px] leading-relaxed text-gray-700">
        {DISCLAIMER}
      </p>
    </header>
  );
}

function PatientSubmittedPrintSection({ draft }: { draft: GeneralAssessmentDraft }) {
  return (
    <ReportSection
      id="patient-submitted"
      title="Patient-Submitted Assessment"
      defaultOpen
      hideWhenEmptyPrint
      hasPrintContent={hasPatientSubmittedContent(draft)}
      icon={DOC_ICON}
    >
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-1">
        <TextBlock label="Chief complaint" value={draft.subjective.chiefComplaint} />
        <TextBlock label="Pain score (NPRS)" value={draft.subjective.nprs} />
        <TextBlock label="Pain location" value={draft.subjective.painLocation} />
        <TextBlock label="Aggravating factors" value={draft.subjective.aggravating} />
        <TextBlock label="Easing factors" value={draft.subjective.easing} />
        <TextBlock label="Functional limitations" value={draft.subjective.functionalLimitations} />
        <TextBlock label="Patient goals" value={draft.subjective.goals} />
        <TextBlock label="Red flags reported" value={draft.subjective.redFlags} />
      </div>
    </ReportSection>
  );
}

// ── Section 4: Risk Flags (elevated layout, outside wrapper) ───────────────────

function RiskFlagsAlert({ draft }: { draft: GeneralAssessmentDraft }) {
  const hasFlags = hasRiskData(draft);
  if (!hasFlags) return null;

  return (
    <div className="rounded-[10px] border border-rose-400/30 bg-rose-400/[0.07] p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] border border-rose-400/30 bg-rose-400/15 text-rose-300">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-bold text-rose-200">Risk Flags — Therapist Review Required</h2>
          <p className="mt-0.5 text-xs text-rose-300/70">Review all flagged items before proceeding with treatment assignment.</p>
        </div>
      </div>

      <div className="space-y-3">
        {draft.subjective.redFlags.trim() && (
          <div className="rounded-[8px] border border-rose-400/25 bg-rose-400/10 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-rose-300/80">
              Red flags (clinician-documented)
            </p>
            <p className="text-sm leading-6 text-white/85 whitespace-pre-wrap">{draft.subjective.redFlags}</p>
          </div>
        )}
        {draft.ai.safetyNotes.trim() && (
          <div className="rounded-[8px] border border-amber-400/25 bg-amber-400/10 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-300/80">
              AI safety notes (must be therapist-verified)
            </p>
            <p className="text-sm leading-6 text-white/85 whitespace-pre-wrap">{draft.ai.safetyNotes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section 7: Program recommendation ─────────────────────────────────────────

function ProgramRecommendationSection({
  draft,
  patientId,
  existingPlan,
}: {
  draft: GeneralAssessmentDraft;
  patientId: string;
  existingPlan: TreatmentPlan | null;
}) {
  const matched = useMemo(() => matchPrograms(draft), [draft]);
  const allPrograms = matched.length > 0 ? matched : REHAB_PROGRAMS.slice(0, 2);
  const isMatched = matched.length > 0;

  return (
    <ReportSection
      id="programs"
      title="Treatment Recommendations"
      defaultOpen
      accent="border-violet-300/25 bg-violet-400/10 text-violet-300"
      icon={
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" />
        </svg>
      }
    >
      {!isMatched && (
        <p className="mb-4 text-xs text-white/40 italic">
          No specific program matched automatically. Showing all available programs — select based on clinical assessment.
        </p>
      )}
      {isMatched && (
        <p className="mb-4 text-xs text-cyan-300/70">
          Matched from clinical impression and diagnosis text.
        </p>
      )}

      <div className="space-y-4">
        {allPrograms.map((prog) => (
          <div key={prog.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                  {prog.category}
                </span>
                <h3 className="mt-0.5 text-sm font-bold text-white">{prog.name}</h3>
              </div>
              {isMatched && (
                <span className="shrink-0 rounded-full border border-violet-300/25 bg-violet-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-violet-300">
                  Recommended
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {prog.phases.map((ph, i) => (
                <div
                  key={ph.id}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2 ${
                    i === 0
                      ? "border-cyan-300/20 bg-cyan-400/[0.06]"
                      : "border-white/8 bg-white/[0.02]"
                  }`}
                >
                  <span className={`mt-0.5 h-4 w-4 shrink-0 text-center text-[10px] font-bold leading-4 ${i === 0 ? "text-cyan-300" : "text-white/30"}`}>
                    P{i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold ${i === 0 ? "text-cyan-200" : "text-white/50"}`}>{ph.name}</p>
                    <p className="mt-0.5 text-[11px] text-white/40">{ph.durationHint} · {ph.defaultSessions} sessions</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ReportSection>
  );
}

// ── Section 8: Assign Treatment Plan ──────────────────────────────────────────

function AssignPlanSection({
  patientId,
  existingPlan,
}: {
  patientId: string;
  existingPlan: TreatmentPlan | null;
}) {
  const numericId = parseInt(patientId, 10);
  const profileHref = !isNaN(numericId)
    ? `/clinician/patients/${patientId}`
    : "/clinician/patients";

  return (
    <ReportSection
      id="assign"
      title="Assign Treatment Plan"
      defaultOpen
      screenOnly
      accent="border-cyan-300/25 bg-cyan-400/10 text-cyan-300"
      icon={
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
    >
      {existingPlan ? (
        <div className="mb-5 rounded-2xl border border-lime-300/20 bg-lime-400/[0.06] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-lime-300/80">
            Treatment plan already assigned
          </p>
          <p className="mt-1 text-sm font-semibold text-white">{existingPlan.programName}</p>
          <p className="mt-0.5 text-xs text-white/55">{existingPlan.phaseName}</p>
          <p className="mt-1 text-xs text-white/40">
            {existingPlan.totalSessions} sessions · {existingPlan.sessionsPerWeek}× per week · Assigned {formatDate(existingPlan.assignedAt)}
          </p>
        </div>
      ) : (
        <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-white/60">No treatment plan has been assigned to this patient yet.</p>
          <p className="mt-1 text-xs text-white/35">
            Use the patient profile to assign a program with phase, frequency, and clinician notes.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={profileHref}
          className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {existingPlan ? "Update Treatment Plan" : "Assign Treatment Plan"}
        </Link>
        <Link
          href={profileHref}
          className="flex items-center justify-center rounded-2xl border border-white/12 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          View Patient Profile →
        </Link>
      </div>

      <p className="mt-4 text-xs text-white/25">
        Treatment assignment is done from the patient profile. The Assign Plan panel will open automatically.
      </p>
    </ReportSection>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AssessmentReportClient() {
  const searchParams = useSearchParams();
  const patientIdParam = searchParams.get("patientId")?.trim() ?? "";
  const assessmentId = searchParams.get("assessmentId")?.trim() ?? "";

  const [draft, setDraft] = useState<GeneralAssessmentDraft | null>(null);
  const [structuredData, setStructuredData] = useState<AssessmentData | null>(null);
  const [remoteQuestionnaireDraft, setRemoteQuestionnaireDraft] = useState<PatientAssessmentDraft | null>(null);
  const [remoteSubmissionMeta, setRemoteSubmissionMeta] = useState<Record<string, unknown> | null>(null);
  const [remoteIncludedSections, setRemoteIncludedSections] = useState<PatientSectionId[]>([]);
  const [reportKind, setReportKind] = useState<"general_msk" | "structured" | "remote_questionnaire" | null>(null);
  const [serverBacked, setServerBacked] = useState(false);
  const [resolvedPatientId, setResolvedPatientId] = useState(patientIdParam);
  const [serverNotes, setServerNotes] = useState<string | null>(null);
  const [reportDate, setReportDate] = useState("");
  const [loadError, setLoadError] = useState("");

  const [patient, setPatient] = useState<BackendPatient | null>(null);
  const [existingPlan, setExistingPlan] = useState<TreatmentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [soapSaving, setSoapSaving] = useState(false);
  const [soapSaveMessage, setSoapSaveMessage] = useState("");
  const [patientAnsweredInArabic, setPatientAnsweredInArabic] = useState(false);
  const [showPdfWarning, setShowPdfWarning] = useState(false);
  const [translateThenExportLoading, setTranslateThenExportLoading] = useState(false);
  const [translationExport, setTranslationExport] = useState({
    doneCount: 0,
    totalCount: 0,
    allTranslated: true,
    anyLoading: false,
    translateAll: async () => {},
  });

  const handleTranslationProgress = useCallback(
    (progress: {
      doneCount: number;
      totalCount: number;
      allTranslated: boolean;
      anyLoading: boolean;
      translateAll: () => Promise<void>;
    }) => {
      setTranslationExport((prev) => {
        if (
          prev.doneCount === progress.doneCount &&
          prev.totalCount === progress.totalCount &&
          prev.allTranslated === progress.allTranslated &&
          prev.anyLoading === progress.anyLoading &&
          prev.translateAll === progress.translateAll
        ) {
          return prev;
        }
        return progress;
      });
    },
    [],
  );

  const handleRemoteQuestionnaireExport = useCallback(() => {
    const assessmentLanguage = patientAnsweredInArabic ? "ar" : "en";
    const untranslatedCount = translationExport.totalCount - translationExport.doneCount;
    if (untranslatedCount > 0 && assessmentLanguage === "ar") {
      setShowPdfWarning(true);
    } else {
      window.print();
    }
  }, [patientAnsweredInArabic, translationExport.doneCount, translationExport.totalCount]);

  const handleTranslateThenExport = useCallback(async () => {
    setTranslateThenExportLoading(true);
    try {
      await translationExport.translateAll();
      window.print();
      setShowPdfWarning(false);
    } finally {
      setTranslateThenExportLoading(false);
    }
  }, [translationExport.translateAll]);

  const handleExportAnyway = useCallback(() => {
    window.print();
    setShowPdfWarning(false);
  }, []);

  const patientId = resolvedPatientId || patientIdParam;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError("");
      setStructuredData(null);
      setRemoteQuestionnaireDraft(null);
      setRemoteSubmissionMeta(null);
      setRemoteIncludedSections([]);
      setReportKind(null);
      setServerBacked(false);
      setPatientAnsweredInArabic(false);

      if (assessmentId) {
        try {
          const res = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}`);
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(body.error ?? `Failed to load assessment (${res.status})`);
          }
          const detail = (await res.json()) as AssessmentDetailResponse;
          if (cancelled) return;

          setResolvedPatientId(detail.patient_id);
          setServerNotes(detail.notes);
          setReportDate(detail.created_at);
          setPatient({
            full_name: detail.patient.full_name,
            diagnosis: detail.patient.diagnosis,
          } as BackendPatient);
          setServerBacked(true);
          setPatientAnsweredInArabic(getAssessmentLanguage(detail.structured_data) === "ar");

          const general = extractGeneralDraft(detail.structured_data, detail.type);
          if (general) {
            setDraft(general);
            setReportKind("general_msk");
          } else {
            const remoteDraft = extractRemoteQuestionnaireDraft(detail.structured_data, detail.type);
            if (remoteDraft) {
              setRemoteQuestionnaireDraft(remoteDraft);
              setRemoteSubmissionMeta(
                typeof detail.structured_data === "object" && detail.structured_data !== null
                  ? (detail.structured_data as Record<string, unknown>)
                  : null,
              );
              setRemoteIncludedSections(inferIncludedSections(remoteDraft));
              setReportKind("remote_questionnaire");
            } else {
              const structured = extractStructuredData(detail.structured_data);
              if (structured) {
                setStructuredData(structured);
                setReportKind("structured");
              } else {
                setLoadError("Assessment data format is not supported for this report.");
              }
            }
          }
        } catch (err) {
          if (!cancelled) {
            setLoadError(err instanceof Error ? err.message : "Failed to load assessment.");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      if (!patientIdParam) {
        if (!cancelled) setLoading(false);
        return;
      }

      setResolvedPatientId(patientIdParam);
      const d = loadGeneralAssessmentDraft(patientIdParam);
      if (!cancelled) {
        setDraft(isDraftMeaningful(d) ? d : null);
        setReportKind("general_msk");
        setServerBacked(false);
        setReportDate(d.updatedAt);
        setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [assessmentId, patientIdParam]);

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;

    if (patient && patient.full_name) return;

    void fetch(`/api/patients/${encodeURIComponent(patientId)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const p = (await res.json()) as { full_name: string; diagnosis?: string | null };
        if (!cancelled) {
          setPatient({ full_name: p.full_name, diagnosis: p.diagnosis ?? null } as BackendPatient);
        }
      })
      .catch(() => { /* optional */ });

    return () => { cancelled = true; };
  }, [patientId, patient]);

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    void fetch(`/api/plans?patientId=${encodeURIComponent(patientId)}`)
      .then(async (res) => (res.ok ? res.json() : []))
      .then((plans: unknown) => {
        if (cancelled || !Array.isArray(plans) || plans.length === 0) {
          setExistingPlan(null);
          return;
        }
        const p = plans[0] as {
          id: string;
          title: string;
          created_at: string;
          clinician_note?: string | null;
          structured_data?: { programName?: string; phaseName?: string; sessionsPerWeek?: number };
          sessions?: unknown[];
        };
        const sd = p.structured_data;
        setExistingPlan({
          id: p.id,
          patientId: 0,
          programId: "custom",
          programName: sd?.programName ?? p.title,
          phase: "phase-1",
          phaseName: sd?.phaseName ?? "Phase 1",
          phaseGoal: "",
          sessionsPerWeek: sd?.sessionsPerWeek ?? 3,
          totalSessions: p.sessions?.length ?? 0,
          clinicianNotes: p.clinician_note ?? "",
          assignedAt: p.created_at,
          assignedBy: "Clinician",
          status: "active",
          sessions: [],
        });
      })
      .catch(() => {
        const n = parseInt(patientId, 10);
        if (!isNaN(n) && n > 0) {
          getTreatmentPlan(n).then((plan) => { if (!cancelled) setExistingPlan(plan); });
        }
      });
    return () => { cancelled = true; };
  }, [patientId]);

  async function handleSaveSoap() {
    if (!assessmentId || !draft) return;
    setSoapSaving(true);
    setSoapSaveMessage("");
    try {
      const res = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Save failed (${res.status})`);
      }
      const detail = (await res.json()) as AssessmentDetailResponse;
      const updated = extractGeneralDraft(detail.structured_data, detail.type);
      if (updated) setDraft(updated);
      if (patientId) saveGeneralAssessmentDraft(patientId, updated ?? draft);
      setSoapSaveMessage("Saved to server.");
    } catch (err) {
      setSoapSaveMessage(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSoapSaving(false);
    }
  }

  const objectiveKeys = Object.keys(draft?.objective ?? {}) as ObjectiveKey[];
  const functionalKeys = Object.keys(draft?.functional ?? {}) as FunctionalKey[];
  const outcomeKeys = Object.keys(draft?.outcomes ?? {}) as OutcomeKey[];
  const hasFlags = draft ? Boolean(hasRiskData(draft)) : false;

  const therapistDecisionLabel = useMemo(() => {
    if (!draft?.therapist.decision) return null;
    return draft.therapist.decision === "approve"
      ? { label: "Approved", cls: "text-lime-300" }
      : draft.therapist.decision === "edit"
      ? { label: "Needs Edit", cls: "text-amber-300" }
      : { label: "Rejected", cls: "text-rose-300" };
  }, [draft]);

  // ── Loading / empty states ──────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B1220]">
        <p className="text-sm text-white/40">Loading report…</p>
      </main>
    );
  }

  if (!patientId && !assessmentId) {
    return (
      <main className="min-h-screen bg-[#0B1220] text-white">
        <div className="mx-auto max-w-2xl px-6 py-20 text-center">
          <h1 className="text-2xl font-bold text-white">No patient selected</h1>
          <p className="mt-3 text-sm text-white/45">
            Add <code className="rounded-[5px] bg-[#1E2D42] px-1.5 py-0.5 text-xs">?patientId=</code> or{" "}
            <code className="rounded-[5px] bg-[#1E2D42] px-1.5 py-0.5 text-xs">?assessmentId=</code> to the URL.
          </p>
          <Link href="/clinician/patients"
            className="mt-8 inline-flex items-center rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-6 py-2.5 text-sm font-semibold text-white transition hover:text-white/80">
            ← Patients list
          </Link>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-[#0B1220] text-white">
        <div className="mx-auto max-w-2xl px-6 py-20 text-center">
          <h1 className="text-xl font-bold text-white">Could not load report</h1>
          <p className="mt-2 text-sm text-rose-300">{loadError}</p>
          {patientId && (
            <Link href={`/clinician/patients/${patientId}`}
              className="mt-7 inline-flex rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-6 py-2.5 text-sm font-semibold text-white">
              ← Patient profile
            </Link>
          )}
        </div>
      </main>
    );
  }

  if (reportKind === "remote_questionnaire" && remoteQuestionnaireDraft) {
    const hasRedFlag = detectRedFlag(remoteQuestionnaireDraft);
    const printSummary = buildRemoteQuestionnaireSummary(
      remoteQuestionnaireDraft,
      reportDate || new Date().toISOString(),
    );
    const backHref = patientId ? `/clinician/patients/${patientId}` : "/clinician/patients";

    return (
      <main className="assessment-report-root print-report min-h-screen bg-[#0B1220] text-white">
        {printSummary ? (
          <div className="print-only">
            <RemoteQuestionnairePrintReport
              summary={printSummary}
              patientName={patient?.full_name ?? "Patient"}
              patientId={patientId}
              assessmentId={assessmentId || undefined}
              clinicianNotes={serverNotes}
              submissionMeta={remoteSubmissionMeta}
              assessmentLanguage={patientAnsweredInArabic ? "ar" : "en"}
            />
          </div>
        ) : null}

        <ReportExportToolbar backHref={backHref} onExportClick={handleRemoteQuestionnaireExport} />
        {showPdfWarning ? (
          <PdfTranslationWarningModal
            untranslatedCount={translationExport.totalCount - translationExport.doneCount}
            onTranslateThenExport={() => void handleTranslateThenExport()}
            onExportAnyway={handleExportAnyway}
            translating={translationExport.anyLoading || translateThenExportLoading}
            doneCount={translationExport.doneCount}
            totalCount={translationExport.totalCount}
          />
        ) : null}
        <section className="screen-only border-b border-white/10 bg-[#0F1825] px-6 py-8">
          <div className="mx-auto max-w-4xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Remote Questionnaire Assessment
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white">
              {patient?.full_name ?? "Patient"}
            </h1>
            <p className="mt-1 text-sm text-white/50">
              {formatDate(reportDate)} {assessmentId && <>· ID {assessmentId.slice(0, 8)}…</>}
            </p>
          </div>
        </section>
        <div className="screen-only print-report-body mx-auto max-w-4xl px-6 py-8 space-y-6">
          <section className="overflow-hidden rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
            {hasRedFlag && (
              <div className="rounded-[7px] border border-amber-300/25 bg-amber-400/10 px-4 py-3">
                <p className="text-sm font-semibold text-amber-200">
                  Patient reported a possible red flag — review before proceeding.
                </p>
              </div>
            )}
            <div className={hasRedFlag ? "mt-4" : undefined}>
              <PatientSubmittedAnswersReview
                patientDraft={remoteQuestionnaireDraft}
                includedSections={remoteIncludedSections}
                assessmentLanguage={patientAnsweredInArabic ? "ar" : "en"}
                submissionMeta={remoteSubmissionMeta}
                assessmentId={assessmentId || undefined}
                onTranslationProgress={handleTranslationProgress}
              />
            </div>
          </section>
          {serverNotes?.trim() ? (
            <section className="overflow-hidden rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
              <h2 className="text-base font-bold text-white">Clinician notes</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/80 whitespace-pre-wrap">
                {serverNotes.trim()}
              </p>
            </section>
          ) : null}
          <p className="text-xs text-white/30">{DISCLAIMER}</p>
        </div>
      </main>
    );
  }

  if (reportKind === "structured" && structuredData) {
    return (
      <main className="assessment-report-root print-report min-h-screen bg-[#0B1220] text-white">
        <RasqPrintHeader
          patientName={patient?.full_name ?? "Patient"}
          patientId={patientId}
          displayDate={reportDate}
          assessmentId={assessmentId || undefined}
        />
        <header className="screen-only sticky top-0 z-30 border-b border-[#1E2D42] bg-[#0B1220]">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-3">
            <Link href={patientId ? `/clinician/patients/${patientId}` : "/clinician/patients"}
              className="rounded-[6px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2 text-xs font-semibold text-white">
              ← Patient
            </Link>
            <div className="flex flex-col items-end gap-1">
              <button type="button" onClick={() => window.print()}
                className="rounded-[6px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2 text-xs font-semibold text-white/55 hover:text-white">
                Export Clinical Report (PDF)
              </button>
              <p className="max-w-[220px] text-right text-[10px] leading-snug text-white/35">
                To save as PDF, choose &ldquo;Microsoft Print to PDF&rdquo; or &ldquo;Save as PDF&rdquo; in the print dialog.
              </p>
            </div>
          </div>
        </header>
        <section className="screen-only border-b border-white/10 bg-[#0F1825] px-6 py-8">
          <div className="mx-auto max-w-4xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Clinical Assessment Report
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white">
              {patient?.full_name ?? "Patient"}
            </h1>
            <p className="mt-1 text-sm text-white/50">
              {formatDate(reportDate)} {assessmentId && <>· ID {assessmentId.slice(0, 8)}…</>}
            </p>
          </div>
        </section>
        <div className="print-report-body mx-auto max-w-4xl px-6 py-8">
        <StructuredAssessmentReport data={structuredData} notes={serverNotes} />
        </div>
      </main>
    );
  }

  if (!draft) {
    return (
      <main className="min-h-screen bg-[#0B1220] text-white">
        <div className="mx-auto max-w-2xl px-6 py-20 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[10px] border border-[#1E2D42] bg-[#0F1825]">
            <svg className="h-6 w-6 text-white/35" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">No assessment draft found</h1>
          <p className="mt-2 text-sm text-white/45">
            {assessmentId
              ? "This assessment has no general MSK report data."
              : "No saved assessment draft was found for this patient. Complete the assessment first."}
          </p>
          <Link href={`/clinician/assessment?patientId=${patientId || patientIdParam}`}
            className="mt-7 inline-flex items-center rounded-[7px] bg-[#1D9E75] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#179165]">
            Return to Assessment
          </Link>
        </div>
      </main>
    );
  }

  // ── Full report ─────────────────────────────────────────────────────────────

  const displayDate = reportDate || draft.updatedAt;

  return (
    <main className="assessment-report-root print-report min-h-screen bg-[#0B1220] text-white">

      <RasqPrintHeader
        patientName={patient?.full_name ?? `Patient #${patientId}`}
        patientId={patientId}
        displayDate={displayDate}
        assessmentId={assessmentId || undefined}
      />

      {/* ── Sticky top bar ── */}
      <header className="screen-only sticky top-0 z-30 border-b border-[#1E2D42] bg-[#0B1220]">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-2">
            <Link href={`/clinician/patients/${patientId}`}
              className="rounded-[6px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2 text-xs font-semibold text-white transition hover:text-white/80">
              ← Patient
            </Link>
            <Link href={`/clinician/assessment?patientId=${patientId}`}
              className="rounded-[6px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2 text-xs font-semibold text-white/55 transition hover:text-white">
              Edit Assessment
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-[6px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2 text-xs font-semibold text-white/55 transition hover:text-white"
              >
                Export Clinical Report (PDF)
              </button>
              <p className="max-w-[220px] text-right text-[10px] leading-snug text-white/35">
                To save as PDF, choose &ldquo;Microsoft Print to PDF&rdquo; or &ldquo;Save as PDF&rdquo; in the print dialog.
              </p>
            </div>
            {serverBacked && (
              <span className="rounded-[5px] border border-[#1D9E75]/25 bg-[#1D9E75]/10 px-2 py-1 text-[10px] font-semibold text-[#5DCAA5]">
                Saved on server
              </span>
            )}
            <Link
              href={`/clinician/patients/${patientId}`}
              className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Assign Plan →
            </Link>
          </div>
        </div>
      </header>

      {/* ── Report header (screen) ── */}
      <section className="screen-only border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.07),transparent_38%),linear-gradient(135deg,#071a2f_0%,#0d1f3c_55%,#0f1f45_100%)]">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-0.5 text-[11px] font-semibold text-white/50 print:border-gray-300 print:bg-gray-100 print:text-gray-700">
              Clinical Assessment Report
            </span>
            {hasFlags && (
              <span className="rounded-full border border-rose-400/30 bg-rose-400/15 px-3 py-0.5 text-[11px] font-semibold text-rose-300">
                ⚠ Risk Flags Present
              </span>
            )}
            {patientAnsweredInArabic && (
              <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-0.5 text-[11px] font-semibold text-amber-200">
                Patient answered in Arabic
              </span>
            )}
          </div>

          <h1 className="text-3xl font-bold text-white">
            {patient?.full_name ?? `Patient #${patientId}`}
          </h1>
          <p className="mt-1.5 text-sm text-white/55 print:text-gray-600">
            {formatDate(displayDate)} &nbsp;·&nbsp; Patient ID {patientId}
            {assessmentId && <> &nbsp;·&nbsp; Assessment {assessmentId.slice(0, 8)}…</>}
            {therapistDecisionLabel && (
              <> &nbsp;·&nbsp; <span className={therapistDecisionLabel.cls}>{therapistDecisionLabel.label}</span></>
            )}
          </p>

          {/* Global disclaimer */}
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-xs leading-5 text-amber-200/90">{DISCLAIMER}</p>
          </div>
        </div>
      </section>

      {/* ── Section jump nav ── */}
      <div className="screen-only sticky top-[53px] z-20 border-b border-white/[0.06] bg-[#071a2f]/90 backdrop-blur-md">
        <div className="mx-auto max-w-4xl overflow-x-auto px-6 py-2">
          <div className="flex min-w-max gap-1">
            {[
              hasFlags ? { id: "risk-flags", label: "⚠ Risk Flags" } : null,
              { id: "summary", label: "Summary" },
              { id: "objective", label: "Objective" },
              { id: "functional", label: "Functional" },
              { id: "outcomes", label: "Outcomes" },
              { id: "ai", label: "Clinical Interpretation" },
              { id: "soap", label: "SOAP Documentation" },
              { id: "programs", label: "Treatment Recommendations" },
              { id: "assign", label: "Assign Plan" },
            ].filter(Boolean).map((item) => item && (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition ${
                  item.id === "risk-flags"
                    ? "text-rose-300 hover:bg-rose-400/10"
                    : "text-white/50 hover:bg-white/8 hover:text-white"
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Report body ── */}
      <div className="print-report-body mx-auto max-w-4xl space-y-5 px-6 py-8">

        {/* Risk flags — screen review only */}
        {hasFlags && (
          <div id="risk-flags" className="screen-only">
            <RiskFlagsAlert draft={draft} />
          </div>
        )}

        {/* ── Section 1: Assessment Summary ── */}
        <ReportSection
          id="summary"
          title="Assessment Summary"
          defaultOpen
          accent="border-cyan-300/25 bg-cyan-400/10 text-cyan-300"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
            </svg>
          }
        >
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <InfoTile label="Patient" value={patient?.full_name ?? `#${patientId}`} />
            <InfoTile label="Assessment date" value={formatDate(draft.updatedAt)} />
            <InfoTile
              label="Therapist decision"
              value={therapistDecisionLabel?.label ?? "Pending"}
              accent={therapistDecisionLabel?.cls ?? "text-white/40"}
            />
            <InfoTile label="NPRS pain score" value={draft.subjective.nprs || "Not recorded"} />
            <InfoTile label="Pain location" value={draft.subjective.painLocation || "Not recorded"} />
            <InfoTile
              label="Final diagnosis"
              value={draft.therapist.finalDiagnosis || "Not recorded"}
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-1">
            <TextBlock label="Chief complaint" value={draft.subjective.chiefComplaint} />
            <TextBlock label="Aggravating factors" value={draft.subjective.aggravating} />
            <TextBlock label="Easing factors" value={draft.subjective.easing} />
            <TextBlock label="Functional limitations" value={draft.subjective.functionalLimitations} />
            <TextBlock label="Patient goals" value={draft.subjective.goals} />
            <TextBlock label="Treatment priorities" value={draft.therapist.treatmentPriorities} />
            {!draft.subjective.chiefComplaint && !draft.subjective.nprs && (
              <p className="py-3 text-sm text-white/30 italic">No subjective data recorded.</p>
            )}
          </div>
        </ReportSection>

        <PatientSubmittedPrintSection draft={draft} />

        {/* ── Section 2: Objective Findings (screen only) ── */}
        <ReportSection
          id="objective"
          title="Objective Findings"
          defaultOpen
          screenOnly
          accent="border-violet-300/25 bg-violet-400/10 text-violet-300"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
            </svg>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {objectiveKeys.map((k) => {
              const row = draft.objective[k];
              return (
                <div key={k} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-cyan-100">{OBJECTIVE_LABELS[k]}</h3>
                    <div className="flex items-center gap-2">
                      {row.cameraCv && (
                        <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                          CV
                        </span>
                      )}
                      <StatusChip status={row.status} />
                    </div>
                  </div>
                  {row.result.trim() ? (
                    <p className="mb-2 text-sm text-white/75 whitespace-pre-wrap">{row.result}</p>
                  ) : (
                    <p className="mb-2 text-xs italic text-white/30">No result recorded</p>
                  )}
                  {row.notes.trim() && (
                    <p className="border-t border-white/8 pt-2 text-xs text-white/50">{row.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        </ReportSection>

        {/* ── Section 2b: Special Tests ── */}
        {(() => {
          const st = draft.specialTests ?? {};
          const testedItems = getTestedTests(st);
          const hasAny = testedItems.length > 0;

          const RESULT_STYLES: Record<SpecialTestResult, string> = {
            not_tested:   "border-white/12 bg-white/[0.05] text-white/40",
            negative:     "border-lime-300/30 bg-lime-400/10 text-lime-300",
            positive:     "border-rose-300/30 bg-rose-400/10 text-rose-200",
            inconclusive: "border-amber-300/30 bg-amber-400/10 text-amber-200",
          };

          return (
            <ReportSection
              id="special-tests"
              title="Special Tests"
              defaultOpen={hasAny}
              screenOnly
              accent="border-[#1D9E75]/25 bg-[#1D9E75]/10 text-[#5DCAA5]"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
              }
            >
              {/* Disclaimer */}
              <div className="mb-4 flex items-start gap-3 rounded-[7px] border border-amber-300/20 bg-amber-400/[0.07] px-4 py-3">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-xs leading-5 text-amber-200/90">
                  Special tests are clinician-entered findings and are not AI-generated diagnoses. Results inform
                  clinical reasoning and treatment recommendation only.
                </p>
              </div>

              {!hasAny ? (
                <p className="py-2 text-sm italic text-white/30">No special tests recorded in this assessment.</p>
              ) : (
                <div className="space-y-4">
                  {REGION_ORDER.map((region) => {
                    const regionTests = getTestsByRegion(region as SpecialTestRegion);
                    const counts = countRegionResults(st, region as SpecialTestRegion);
                    const testedInRegion = regionTests
                      .map((t) => ({ def: t, entry: st[t.id] }))
                      .filter((t) => t.entry && t.entry.result !== "not_tested");
                    if (testedInRegion.length === 0) return null;
                    return (
                      <div key={region} className="overflow-hidden rounded-[8px] border border-[#1E2D42]">
                        {/* Region header */}
                        <div className="flex items-center justify-between border-b border-[#1E2D42] bg-[#0B1220] px-4 py-3">
                          <p className="text-sm font-bold text-white">{REGION_LABELS[region as SpecialTestRegion]}</p>
                          <div className="flex items-center gap-2">
                            {counts.positive > 0 && (
                              <span className="rounded-[4px] border border-rose-300/25 bg-rose-400/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                                {counts.positive} positive
                              </span>
                            )}
                            {counts.inconclusive > 0 && (
                              <span className="rounded-[4px] border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                {counts.inconclusive} inconclusive
                              </span>
                            )}
                            {counts.negative > 0 && (
                              <span className="rounded-[4px] border border-lime-300/20 bg-lime-400/8 px-2 py-0.5 text-[10px] font-semibold text-lime-400/80">
                                {counts.negative} negative
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Test rows */}
                        <div className="divide-y divide-white/[0.06]">
                          {testedInRegion.map(({ def, entry }) => (
                            <div key={def.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white/90">{def.name}</p>
                                <p className="text-xs text-white/40">{def.hint}</p>
                                {entry?.notes.trim() && (
                                  <p className="mt-1.5 text-xs text-white/60 italic">{entry.notes}</p>
                                )}
                              </div>
                              <span className={`shrink-0 rounded-[5px] border px-2.5 py-1 text-xs font-semibold ${RESULT_STYLES[entry?.result ?? "not_tested"]}`}>
                                {entry?.result === "positive"     ? "Positive" :
                                 entry?.result === "negative"     ? "Negative" :
                                 entry?.result === "inconclusive" ? "Inconclusive" : "Not tested"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ReportSection>
          );
        })()}

        {/* ── Section 3: Functional Tests (screen only) ── */}
        <ReportSection
          id="functional"
          title="Functional Tests"
          defaultOpen
          screenOnly
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          }
        >
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04]">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/40">
                    Test
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-widest text-white/40">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/40">
                    Result
                  </th>
                  <th className="hidden px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/40 sm:table-cell">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {functionalKeys.map((k, i) => {
                  const row = draft.functional[k];
                  return (
                    <tr
                      key={k}
                      className={`border-b border-white/[0.06] last:border-0 ${i % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]"}`}
                    >
                      <td className="px-4 py-3 font-medium text-white/80">{FUNCTIONAL_LABELS[k]}</td>
                      <td className="px-4 py-3 text-center">
                        <StatusChip status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-white/60">
                        {row.result.trim() || <EmptyFieldNote />}
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-white/40 sm:table-cell">
                        {row.notes.trim() || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ReportSection>

        {/* ── Section 4 (elevated): Risk Flags — shown inline if no flags present ── */}
        {!hasFlags && (
          <ReportSection
            id="outcomes-risk"
            title="Risk Flags"
            defaultOpen={false}
            screenOnly
            accent="border-lime-300/25 bg-lime-400/10 text-lime-300"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            }
          >
            <div className="flex items-center gap-3 rounded-[7px] border border-lime-300/20 bg-lime-400/[0.06] px-5 py-4">
              <svg className="h-5 w-5 shrink-0 text-lime-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <p className="text-sm text-lime-200/80">No red flags or safety concerns documented in this assessment.</p>
            </div>
          </ReportSection>
        )}

        {/* ── Section 3b: Outcome Measures (screen only) ── */}
        <ReportSection
          id="outcomes"
          title="Outcome Measures"
          defaultOpen
          screenOnly
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-9v9m3-4.5v4.5m-10.5 0h9M3.75 3h16.5v18H3.75z" />
            </svg>
          }
        >
          <p className="mb-4 text-xs text-white/40">
            No auto-scoring — raw entries and clinician-documented values only.
          </p>
          <div className="overflow-hidden rounded-[8px] border border-[#1E2D42]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E2D42] bg-[#0B1220]">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/40">Scale</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/40">Raw notes</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/40">Documented score</th>
                </tr>
              </thead>
              <tbody>
                {outcomeKeys.map((k, i) => {
                  const row = draft.outcomes[k];
                  const meta = OUTCOME_LABELS[k];
                  return (
                    <tr
                      key={k}
                      className={`border-b border-white/[0.06] last:border-0 ${i % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]"}`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-semibold text-white/80">{meta.abbr}</span>
                        <span className="ml-2 text-xs text-white/35">{meta.full}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-white/60">
                        {row.rawNotes.trim() || <EmptyFieldNote />}
                      </td>
                      <td className="px-4 py-3 text-xs text-white/60">
                        {row.clinicianDocumented.trim() || <EmptyFieldNote />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ReportSection>

        {/* ── Section 5: Clinical Interpretation ── */}
        <ReportSection
          id="ai"
          title="Clinical Interpretation"
          defaultOpen
          hideWhenEmptyPrint
          hasPrintContent={hasClinicalInterpretation(draft)}
          accent="border-amber-300/25 bg-amber-400/10 text-amber-300"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
          }
        >
          <div className="mb-5 rounded-[7px] border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3 screen-only">
            <p className="text-xs leading-5 text-amber-200/90">{DISCLAIMER}</p>
          </div>

          <div className="space-y-3">
            {[
              { label: "Clinical impression suggestion", value: draft.ai.clinicalImpression },
              { label: "Supporting findings", value: draft.ai.supportingFindings },
              { label: "Missing tests / gaps", value: draft.ai.missingTests },
              { label: "Confidence level", value: draft.ai.confidenceLevel },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-amber-300/60">{label}</p>
                {value.trim() ? (
                  <p className="text-sm leading-6 text-white/80 whitespace-pre-wrap">{value}</p>
                ) : (
                  <EmptyFieldNote text="Not documented" />
                )}
              </div>
            ))}
          </div>
        </ReportSection>

        {/* ── Section 6: SOAP Documentation ── */}
        <ReportSection
          id="soap"
          title="SOAP Documentation"
          defaultOpen
          hideWhenEmptyPrint
          hasPrintContent={hasSoapContent(draft)}
          accent="border-white/20 bg-white/[0.08] text-white/70"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
            </svg>
          }
        >
          {serverBacked && assessmentId ? (
            <EditableSoapSection
              draft={draft}
              onChange={(soap) => setDraft({ ...draft, soap, updatedAt: new Date().toISOString() })}
              onSave={() => void handleSaveSoap()}
              saving={soapSaving}
              saveMessage={soapSaveMessage}
            />
          ) : (
            <div className="mb-5 grid gap-3 sm:grid-cols-2">
              <SoapCard label="S — Subjective" value={draft.soap.subjective} />
              <SoapCard label="O — Objective" value={draft.soap.objective} />
              <SoapCard label="A — Assessment" value={draft.soap.assessment} />
              <SoapCard label="P — Plan" value={draft.soap.plan} />
            </div>
          )}

          {(draft.therapist.finalDiagnosis || draft.therapist.treatmentPriorities) && (
            <div className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-5 py-1">
              <TextBlock label="Final diagnosis" value={draft.therapist.finalDiagnosis} />
              <TextBlock label="Treatment priorities" value={draft.therapist.treatmentPriorities} />
            </div>
          )}
        </ReportSection>

        {/* ── Section 7: Recommended Rehab Program ── */}
        <ProgramRecommendationSection
          draft={draft}
          patientId={patientId}
          existingPlan={existingPlan}
        />

        {/* ── Section 8: Assign Treatment Plan ── */}
        <AssignPlanSection patientId={patientId} existingPlan={existingPlan} />

        {/* Footer */}
        <p className="screen-only pb-8 text-center text-xs text-white/20">
          {serverBacked ? "Server-backed assessment" : "Local draft (not yet finalized)"} · {formatDate(displayDate)} · Patient #{patientId}
          {" · "}All AI content is decision-support only and requires therapist verification.
        </p>
      </div>
    </main>
  );
}
