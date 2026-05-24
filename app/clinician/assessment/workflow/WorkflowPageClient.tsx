"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getPatient, type BackendPatient } from "@/app/lib/api";
import { assessmentsRepository } from "@/app/lib/repositories";
import { createEmptyWorkflowDraft } from "@/app/lib/assessment-workflow/defaults";
import {
  loadWorkflowDraft,
  saveWorkflowDraft,
} from "@/app/lib/assessment-workflow/storage";
import type {
  AssessmentWorkflowDraft,
  CvTestStatus,
  FunctionalCvTestKey,
  ObjectiveCvCardId,
  OutcomeInstrumentKey,
  WorkflowStepId,
} from "@/app/lib/assessment-workflow/types";
import { VOICE_INTAKE_DISCLAIMER } from "@/app/lib/clinicalTranslation";
import {
  VoiceClinicalAssistant,
  type VoiceAssistantPayload,
} from "@/app/clinician/assessment/VoiceClinicalAssistant";

const STEPS: { id: WorkflowStepId; label: string; short: string }[] = [
  { id: "patient", label: "Patient Info", short: "Info" },
  { id: "subjective", label: "History / Subjective", short: "History" },
  { id: "outcomes", label: "Outcome Measures", short: "Outcomes" },
  { id: "functional", label: "Functional Assessment", short: "Functional" },
  { id: "objective", label: "Objective / CV Tests", short: "CV" },
  { id: "ai", label: "AI Clinical Reasoning", short: "AI" },
  { id: "review", label: "Therapist Review", short: "Review" },
  { id: "soap", label: "SOAP Note", short: "SOAP" },
  { id: "report", label: "Report", short: "Report" },
];

const FUNCTIONAL_CV_LABELS: Record<FunctionalCvTestKey, string> = {
  five_x_sts: "5× Sit-to-Stand",
  tug: "Timed Up and Go (TUG)",
  gait_speed: "Gait speed",
  single_leg_balance: "Single-leg balance",
  squat: "Squat test",
  step_down: "Step-down test",
};

const OUTCOME_LABELS: Record<OutcomeInstrumentKey, string> = {
  nprs: "NPRS (Numeric Pain Rating Scale)",
  psfs: "PSFS (Patient-Specific Functional Scale)",
  lefs: "LEFS (Lower Extremity Functional Scale)",
  quickdash: "QuickDASH",
  odi: "ODI / Oswestry Disability Index",
  ndi: "NDI (Neck Disability Index)",
};

const OBJECTIVE_LABELS: Record<ObjectiveCvCardId, string> = {
  posture: "Posture analysis",
  rom: "ROM estimation",
  squat: "Squat analysis",
  gait: "Gait analysis",
  balance: "Balance tracking",
  sit_to_stand: "Sit-to-stand",
};

function statusLabel(s: CvTestStatus): string {
  if (s === "not_started") return "Not started";
  if (s === "in_progress") return "In progress";
  return "Completed";
}

function notRecorded(v: string): string {
  const t = v.trim();
  return t ? t : "—";
}

function mergeText(existing: string, incoming: string): string {
  const a = existing.trim();
  const b = incoming.trim();
  if (!b) return a;
  if (!a) return b;
  if (a.includes(b)) return a;
  return `${a}\n${b}`;
}

export function WorkflowPageClient() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId")?.trim() || "";
  const assessmentId = searchParams.get("assessmentId")?.trim() || "";

  const [step, setStep] = useState<WorkflowStepId>("patient");
  const [draft, setDraft] = useState<AssessmentWorkflowDraft>(createEmptyWorkflowDraft);
  const [backendPatient, setBackendPatient] = useState<BackendPatient | null>(null);
  const [patientLoadError, setPatientLoadError] = useState("");

  const localAssessment = useMemo(() => {
    if (!assessmentId) return null;
    return assessmentsRepository.getById(assessmentId);
  }, [assessmentId]);

  useEffect(() => {
    if (!assessmentId) return;
    setDraft(loadWorkflowDraft(assessmentId));
  }, [assessmentId]);

  const persist = useCallback(
    (next: AssessmentWorkflowDraft) => {
      setDraft(next);
      if (assessmentId) saveWorkflowDraft(assessmentId, next);
    },
    [assessmentId],
  );

  const applyVoiceToSubjective = useCallback(
    (payload: VoiceAssistantPayload) => {
      const f = payload.clinicalFields;
      setDraft((prev) => {
        const next: AssessmentWorkflowDraft = {
          ...prev,
          subjective: {
            ...prev.subjective,
            chiefComplaint: mergeText(prev.subjective.chiefComplaint, f.chiefComplaint.value),
            painLocation: mergeText(prev.subjective.painLocation, f.painLocation.value),
            nprs: mergeText(prev.subjective.nprs, f.nprs.value),
            aggravating: mergeText(prev.subjective.aggravating, f.aggravating.value),
            easing: mergeText(prev.subjective.easing, f.easing.value),
            functionalLimitations: mergeText(prev.subjective.functionalLimitations, f.functionalLimitation.value),
            patientGoals: mergeText(prev.subjective.patientGoals, f.goals.value),
            redFlags: mergeText(prev.subjective.redFlags, f.redFlags.value),
          },
          updatedAt: new Date().toISOString(),
        };
        if (assessmentId) saveWorkflowDraft(assessmentId, next);
        return next;
      });
    },
    [assessmentId],
  );

  const applyVoiceToSoap = useCallback(
    (payload: VoiceAssistantPayload) => {
      const stamp = new Date().toISOString();
      const cf = payload.clinicalFields;
      const block = [
        `--- Voice intake · ${stamp} ---`,
        VOICE_INTAKE_DISCLAIMER,
        "",
        "Clinical summary (English):",
        payload.clinicalTranslationParagraph,
        "",
        "Structured:",
        `Pain location: ${cf.painLocation.value}`,
        `Severity (NPRS): ${cf.nprs.value}`,
        `Aggravating: ${cf.aggravating.value}`,
        `Relieving: ${cf.easing.value}`,
        `Functional limitation: ${cf.functionalLimitation.value}`,
        `Chief complaint: ${cf.chiefComplaint.value}`,
        `Red flags: ${cf.redFlags.value}`,
        `Goals: ${cf.goals.value}`,
      ].join("\n");
      setDraft((prev) => {
        const next: AssessmentWorkflowDraft = {
          ...prev,
          soap: {
            ...prev.soap,
            subjective: mergeText(prev.soap.subjective, block),
          },
          updatedAt: new Date().toISOString(),
        };
        if (assessmentId) saveWorkflowDraft(assessmentId, next);
        return next;
      });
    },
    [assessmentId],
  );

  useEffect(() => {
    const n = Number.parseInt(patientId, 10);
    if (!Number.isFinite(n) || n <= 0) {
      setBackendPatient(null);
      return;
    }
    let cancel = false;
    setPatientLoadError("");
    void getPatient(n)
      .then((p) => {
        if (!cancel) setBackendPatient(p);
      })
      .catch(() => {
        if (!cancel) {
          setBackendPatient(null);
          setPatientLoadError("Could not load patient from server (check auth).");
        }
      });
    return () => {
      cancel = true;
    };
  }, [patientId]);

  const resultsHref =
    patientId && assessmentId
      ? `/clinician/assessment/report?patientId=${encodeURIComponent(patientId)}&assessmentId=${encodeURIComponent(assessmentId)}`
      : null;

  const bodyAxisHref =
    patientId && assessmentId
      ? `/body-axis-ai?patientId=${encodeURIComponent(patientId)}&assessmentId=${encodeURIComponent(assessmentId)}&test=posture`
      : null;

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <main className="min-h-screen bg-[#0B1220] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-md sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300/90">
                RASQ · Clinical Assessment
              </p>
              <h1 className="mt-2 text-2xl font-bold text-cyan-300 sm:text-3xl">
                Clinical assessment workflow
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
                Structured physiotherapy encounter documentation. AI outputs are decision-support only; the therapist
                retains final clinical authority.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <MetaChip label={`Patient ID: ${patientId || "—"}`} />
                <MetaChip label={`Encounter ID: ${assessmentId || "—"}`} />
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <Link
                href={patientId ? `/clinician/patients/${patientId}` : "/clinician/patients"}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-white/10"
              >
                ← Patient profile
              </Link>
              {patientId && assessmentId ? (
                <Link
                  href={`/clinician/assessment/in-clinic?patientId=${encodeURIComponent(patientId)}&assessmentId=${encodeURIComponent(assessmentId)}`}
                  className="rounded-2xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2.5 text-center text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
                >
                  CV test setup
                </Link>
              ) : null}
            </div>
          </div>
        </header>

        {!patientId || !assessmentId ? (
          <div className="rounded-3xl border border-amber-400/25 bg-amber-400/10 p-6 text-sm text-amber-100">
            Open this workflow from a patient profile or in-clinic assessment so <strong>Patient ID</strong> and{" "}
            <strong>Assessment ID</strong> are present in the URL.
          </div>
        ) : null}

        {/* Stepper */}
        <nav
          className="mb-6 overflow-x-auto rounded-3xl border border-white/10 bg-white/5 pb-1 pt-1"
          aria-label="Workflow steps"
        >
          <div className="flex min-w-max gap-1 px-2 py-2">
            {STEPS.map((s, i) => {
              const active = step === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStep(s.id)}
                  className={`shrink-0 rounded-2xl px-3 py-2 text-left text-xs font-semibold transition sm:px-4 sm:text-sm ${
                    active
                      ? "bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20"
                      : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wider text-current opacity-80">
                    {i + 1}/{STEPS.length}
                  </span>
                  <span className="mt-0.5 block sm:hidden">{s.short}</span>
                  <span className="mt-0.5 hidden sm:block">{s.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.2)] sm:p-8">
          {step === "patient" && (
            <section className="space-y-6">
              <StepHeading
                title="Patient Info"
                subtitle="Identifiers and demographics for this encounter."
              />
              {patientLoadError ? (
                <p className="text-sm text-amber-200/90">{patientLoadError}</p>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldCard label="Patient ID (chart)" value={patientId || "—"} />
                <FieldCard label="Assessment / encounter ID" value={assessmentId || "—"} />
                <FieldCard
                  label="Full name"
                  value={backendPatient?.full_name?.trim() || "Not recorded"}
                />
                <FieldCard
                  label="Age / sex"
                  value={
                    backendPatient
                      ? `${backendPatient.age ?? "—"} / ${backendPatient.gender ?? "—"}`
                      : "Not recorded"
                  }
                />
                <FieldCard
                  label="Primary complaint (EMR)"
                  value={notRecorded(backendPatient?.diagnosis ?? "")}
                />
                <FieldCard
                  label="Session label (local draft)"
                  value={localAssessment?.sessionLabel?.trim() || "—"}
                />
              </div>
              <FutureCaptureRow />
            </section>
          )}

          {step === "subjective" && (
            <section className="space-y-4">
              <StepHeading
                title="History / Subjective"
                subtitle="Patient-reported information. Structured for future NLP, voice, and smart questionnaires."
              />
              {patientId && assessmentId ? (
                <VoiceClinicalAssistant
                  onInsertIntoForm={applyVoiceToSubjective}
                  onInsertIntoSoap={applyVoiceToSoap}
                  openButtonLabel="Record & Structure"
                  featureTitle="AI Voice Clinical Assistant"
                  insertSoapButtonLabel="Insert into SOAP"
                />
              ) : (
                <p className="text-sm text-white/50">
                  Save patient and encounter IDs in the URL to enable voice structuring.
                </p>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <TextArea
                  label="Chief complaint"
                  value={draft.subjective.chiefComplaint}
                  onChange={(v) =>
                    persist({
                      ...draft,
                      subjective: { ...draft.subjective, chiefComplaint: v },
                    })
                  }
                />
                <TextArea
                  label="Pain location"
                  value={draft.subjective.painLocation}
                  onChange={(v) =>
                    persist({
                      ...draft,
                      subjective: { ...draft.subjective, painLocation: v },
                    })
                  }
                />
                <TextArea
                  label="NPRS pain score (0–10) — subjective"
                  value={draft.subjective.nprs}
                  onChange={(v) =>
                    persist({ ...draft, subjective: { ...draft.subjective, nprs: v } })
                  }
                />
                <TextArea
                  label="Onset"
                  value={draft.subjective.onset}
                  onChange={(v) =>
                    persist({ ...draft, subjective: { ...draft.subjective, onset: v } })
                  }
                />
                <TextArea
                  label="Aggravating factors"
                  value={draft.subjective.aggravating}
                  onChange={(v) =>
                    persist({
                      ...draft,
                      subjective: { ...draft.subjective, aggravating: v },
                    })
                  }
                />
                <TextArea
                  label="Easing factors"
                  value={draft.subjective.easing}
                  onChange={(v) =>
                    persist({ ...draft, subjective: { ...draft.subjective, easing: v } })
                  }
                />
                <TextArea
                  label="Functional limitations"
                  value={draft.subjective.functionalLimitations}
                  onChange={(v) =>
                    persist({
                      ...draft,
                      subjective: { ...draft.subjective, functionalLimitations: v },
                    })
                  }
                />
                <TextArea
                  label="Patient goals"
                  value={draft.subjective.patientGoals}
                  onChange={(v) =>
                    persist({
                      ...draft,
                      subjective: { ...draft.subjective, patientGoals: v },
                    })
                  }
                />
                <div className="md:col-span-2">
                  <TextArea
                    label="Red flags"
                    value={draft.subjective.redFlags}
                    onChange={(v) =>
                      persist({
                        ...draft,
                        subjective: { ...draft.subjective, redFlags: v },
                      })
                    }
                  />
                </div>
              </div>
              <FutureCaptureRow />
            </section>
          )}

          {step === "outcomes" && (
            <section className="space-y-6">
              <StepHeading
                title="Outcome Measures"
                subtitle="Record raw item responses. Auto-scoring will activate when validated calculators are connected — no scores are fabricated."
              />
              <div className="grid gap-4 lg:grid-cols-2">
                {(Object.keys(OUTCOME_LABELS) as OutcomeInstrumentKey[]).map((k) => (
                  <div
                    key={k}
                    className="rounded-2xl border border-white/10 bg-[#0B1220]/80 p-4"
                  >
                    <h3 className="text-sm font-semibold text-cyan-200/95">
                      {OUTCOME_LABELS[k]}
                    </h3>
                    <TextArea
                      label="Raw entries / item notes"
                      value={draft.outcomes[k].rawNotes}
                      onChange={(v) =>
                        persist({
                          ...draft,
                          outcomes: {
                            ...draft.outcomes,
                            [k]: { ...draft.outcomes[k], rawNotes: v },
                          },
                        })
                      }
                    />
                    <TextArea
                      label="Clinician-documented score / interpretation (optional)"
                      value={draft.outcomes[k].computedSummary}
                      onChange={(v) =>
                        persist({
                          ...draft,
                          outcomes: {
                            ...draft.outcomes,
                            [k]: { ...draft.outcomes[k], computedSummary: v },
                          },
                        })
                      }
                    />
                    <p className="mt-1 text-[10px] text-white/35">
                      Automated scoring: not connected — no calculated scores are generated by the app.
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {step === "functional" && (
            <section className="space-y-6">
              <StepHeading
                title="Functional Assessment"
                subtitle="Performance-based tests and patient-reported function. Place FIM only when clinically indicated."
              />
              <h3 className="text-xs font-semibold uppercase tracking-widest text-cyan-300/80">
                Performance-based (clinician-timed / observed)
              </h3>
              <div className="space-y-4">
                {(Object.keys(FUNCTIONAL_CV_LABELS) as FunctionalCvTestKey[]).map((k) => (
                  <div
                    key={k}
                    className="rounded-2xl border border-white/10 bg-[#0B1220]/80 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-white">
                        {FUNCTIONAL_CV_LABELS[k]}
                      </h4>
                      <select
                        className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white outline-none"
                        value={draft.functionalCv[k].status}
                        onChange={(e) =>
                          persist({
                            ...draft,
                            functionalCv: {
                              ...draft.functionalCv,
                              [k]: {
                                ...draft.functionalCv[k],
                                status: e.target.value as CvTestStatus,
                              },
                            },
                          })
                        }
                      >
                        <option value="not_started">Not started</option>
                        <option value="in_progress">In progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                    <TextArea
                      label="Result (numeric or descriptive)"
                      value={draft.functionalCv[k].result}
                      onChange={(v) =>
                        persist({
                          ...draft,
                          functionalCv: {
                            ...draft.functionalCv,
                            [k]: { ...draft.functionalCv[k], result: v },
                          },
                        })
                      }
                    />
                    <TextArea
                      label="Clinical notes"
                      value={draft.functionalCv[k].clinicalNotes}
                      onChange={(v) =>
                        persist({
                          ...draft,
                          functionalCv: {
                            ...draft.functionalCv,
                            [k]: { ...draft.functionalCv[k], clinicalNotes: v },
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-cyan-300/80">
                Patient-reported function (cross-reference outcome measures)
              </h3>
              <p className="text-sm text-white/60">
                PSFS, LEFS, QuickDASH, ODI, and NDI are captured in <strong>Outcome Measures</strong>. Summarize
                functional priorities here if needed.
              </p>
              <TextArea
                label="Functional summary (optional)"
                value={draft.functionalPatientReportedNote}
                onChange={(v) => persist({ ...draft, functionalPatientReportedNote: v })}
              />
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold text-amber-200/90">Optional — FIM</p>
                <p className="mt-1 text-xs text-white/50">
                  Mainly for neuro, geriatrics, inpatient rehab, stroke, SCI, TBI. Not required for typical MSK
                  outpatient flows.
                </p>
                <TextArea
                  label="FIM-related notes (optional)"
                  value={draft.fimOptionalNote}
                  onChange={(v) => persist({ ...draft, fimOptionalNote: v })}
                />
              </div>
            </section>
          )}

          {step === "objective" && (
            <section className="space-y-6">
              <StepHeading
                title="Objective / Computer vision tests"
                subtitle="Movement analysis modules. Link to Body Axis AI or gait workflows when configured."
              />
              <div className="flex flex-wrap gap-2">
                {bodyAxisHref ? (
                  <Link
                    href={bodyAxisHref}
                    className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
                  >
                    Open Body Axis AI
                  </Link>
                ) : null}
                {resultsHref ? (
                  <Link
                    href={resultsHref}
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    Open Clinical Report
                  </Link>
                ) : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {(Object.keys(OBJECTIVE_LABELS) as ObjectiveCvCardId[]).map((id) => (
                  <div
                    key={id}
                    className="rounded-2xl border border-white/10 bg-[#0B1220]/80 p-4"
                  >
                    <h4 className="text-sm font-semibold text-cyan-100">
                      {OBJECTIVE_LABELS[id]}
                    </h4>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-white/70">
                        Status: {statusLabel(draft.objectiveCv[id].status)}
                      </span>
                      <label className="flex cursor-pointer items-center gap-2 text-white/60">
                        <input
                          type="checkbox"
                          checked={draft.objectiveCv[id].cameraCvAvailable}
                          onChange={(e) =>
                            persist({
                              ...draft,
                              objectiveCv: {
                                ...draft.objectiveCv,
                                [id]: {
                                  ...draft.objectiveCv[id],
                                  cameraCvAvailable: e.target.checked,
                                },
                              },
                            })
                          }
                          className="rounded border-white/20"
                        />
                        Camera CV available
                      </label>
                    </div>
                    <select
                      className="mt-3 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white outline-none"
                      value={draft.objectiveCv[id].status}
                      onChange={(e) =>
                        persist({
                          ...draft,
                          objectiveCv: {
                            ...draft.objectiveCv,
                            [id]: {
                              ...draft.objectiveCv[id],
                              status: e.target.value as CvTestStatus,
                            },
                          },
                        })
                      }
                    >
                      <option value="not_started">Not started</option>
                      <option value="in_progress">In progress</option>
                      <option value="completed">Completed</option>
                    </select>
                    <TextArea
                      label="Result"
                      value={draft.objectiveCv[id].result}
                      onChange={(v) =>
                        persist({
                          ...draft,
                          objectiveCv: {
                            ...draft.objectiveCv,
                            [id]: { ...draft.objectiveCv[id], result: v },
                          },
                        })
                      }
                    />
                    <TextArea
                      label="Clinical notes"
                      value={draft.objectiveCv[id].clinicalNotes}
                      onChange={(v) =>
                        persist({
                          ...draft,
                          objectiveCv: {
                            ...draft.objectiveCv,
                            [id]: { ...draft.objectiveCv[id], clinicalNotes: v },
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {step === "ai" && (
            <section className="space-y-4">
              <StepHeading
                title="AI clinical reasoning (draft)"
                subtitle="Populate from approved models only. All fields start empty."
              />
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100/95">
                <strong>AI decision support only</strong> — not a final diagnosis. The treating therapist must review,
                edit, and approve all clinical conclusions.
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {(
                  [
                    ["clinicalImpressionSuggestion", "Clinical impression (suggestion)"],
                    ["supportingFindings", "Supporting findings"],
                    ["findingsAgainst", "Findings against / contradictions"],
                    ["missingTests", "Missing tests / data needed"],
                    ["severity", "Severity"],
                    ["irritability", "Irritability"],
                    ["prognosis", "Prognosis (supportive framing)"],
                    ["redFlagNotes", "Red flag notes"],
                    ["confidenceLevel", "Model confidence level"],
                  ] as const
                ).map(([field, label]) => (
                  <TextArea
                    key={field}
                    label={label}
                    value={draft.ai[field]}
                    onChange={(v) => persist({ ...draft, ai: { ...draft.ai, [field]: v } })}
                  />
                ))}
              </div>
            </section>
          )}

          {step === "review" && (
            <section className="space-y-6">
              <StepHeading
                title="Therapist review & approval"
                subtitle="Final authority rests with the clinician. Audit trail is placeholder until enterprise logging ships."
              />
              <div className="flex flex-wrap gap-2">
                {(["approve", "edit", "reject"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      persist({
                        ...draft,
                        therapist: {
                          ...draft.therapist,
                          decision: d,
                          approvalStatus:
                            d === "approve"
                              ? "Approved"
                              : d === "edit"
                                ? "Edited — pending sign-off"
                                : "Rejected — needs revision",
                        },
                      })
                    }
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                      draft.therapist.decision === d
                        ? "bg-cyan-400 text-slate-950"
                        : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                    }`}
                  >
                    {d === "approve" ? "Approve AI suggestion" : d === "edit" ? "Edit path" : "Reject"}
                  </button>
                ))}
              </div>
              <p className="text-xs text-white/50">
                Status:{" "}
                <span className="font-medium text-cyan-200/90">
                  {draft.therapist.approvalStatus || "Not recorded"}
                </span>
              </p>
              <TextArea
                label="Final diagnosis (therapist-owned)"
                value={draft.therapist.finalDiagnosis}
                onChange={(v) =>
                  persist({
                    ...draft,
                    therapist: { ...draft.therapist, finalDiagnosis: v },
                  })
                }
              />
              <label className="block text-sm text-white/70">
                Treatment priority
                <select
                  className="mt-2 w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1220] px-4 py-3 text-white outline-none"
                  value={draft.therapist.treatmentPriority}
                  onChange={(e) =>
                    persist({
                      ...draft,
                      therapist: { ...draft.therapist, treatmentPriority: e.target.value },
                    })
                  }
                >
                  <option value="">Not selected</option>
                  <option value="routine">Routine</option>
                  <option value="priority">Priority</option>
                  <option value="urgent">Urgent</option>
                  <option value="safety_escalation">Safety escalation</option>
                </select>
              </label>
              <div className="rounded-2xl border border-white/10 bg-[#0B1220]/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/45">
                  SOAP draft preview
                </p>
                <p className="mt-2 text-xs text-white/55">
                  AI-generated draft — therapist must review and approve.
                </p>
                <ul className="mt-3 space-y-2 text-xs text-white/65">
                  <li>
                    <span className="text-white/45">S:</span>{" "}
                    {draft.soap.subjective.trim() || "Not recorded"}
                  </li>
                  <li>
                    <span className="text-white/45">O:</span>{" "}
                    {draft.soap.objective.trim() || "Not recorded"}
                  </li>
                  <li>
                    <span className="text-white/45">A:</span>{" "}
                    {draft.soap.assessment.trim() || "Not recorded"}
                  </li>
                  <li>
                    <span className="text-white/45">P:</span> {draft.soap.plan.trim() || "Not recorded"}
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() =>
                    persist({
                      ...draft,
                      soap: {
                        ...draft.soap,
                        subjective: draft.subjective.chiefComplaint
                          ? [
                              draft.subjective.chiefComplaint,
                              draft.subjective.painLocation && `Pain: ${draft.subjective.painLocation}`,
                              draft.subjective.functionalLimitations &&
                                `Limitations: ${draft.subjective.functionalLimitations}`,
                            ]
                              .filter(Boolean)
                              .join("\n")
                          : draft.soap.subjective,
                      },
                    })
                  }
                  className="mt-3 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/15"
                >
                  Pull subjective snippets into SOAP S (optional)
                </button>
              </div>
              <TextArea
                label="Audit log / co-signer notes (placeholder)"
                value={draft.therapist.auditNote}
                onChange={(v) =>
                  persist({ ...draft, therapist: { ...draft.therapist, auditNote: v } })
                }
              />
              <p className="text-[11px] text-white/40">
                Enterprise audit stream: <strong>Not recorded</strong> (integration pending).
              </p>
            </section>
          )}

          {step === "soap" && (
            <section className="space-y-4">
              <StepHeading
                title="SOAP note"
                subtitle="Structured encounter summary. Aligns with billing and handoff standards."
              />
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm text-cyan-100/90">
                AI-generated draft — therapist must review and approve before this note represents the legal / clinical
                record.
              </div>
              <TextArea
                label="Subjective"
                value={draft.soap.subjective}
                onChange={(v) => persist({ ...draft, soap: { ...draft.soap, subjective: v } })}
              />
              <TextArea
                label="Objective"
                value={draft.soap.objective}
                onChange={(v) => persist({ ...draft, soap: { ...draft.soap, objective: v } })}
              />
              <TextArea
                label="Assessment"
                value={draft.soap.assessment}
                onChange={(v) => persist({ ...draft, soap: { ...draft.soap, assessment: v } })}
              />
              <TextArea
                label="Plan"
                value={draft.soap.plan}
                onChange={(v) => persist({ ...draft, soap: { ...draft.soap, plan: v } })}
              />
            </section>
          )}

          {step === "report" && (
            <section className="space-y-6">
              <StepHeading
                title="Final report"
                subtitle="Export-ready summary. Values reflect this draft only; connect EMR for authoritative charts."
              />
              <ReportBlock title="Patient summary">
                {backendPatient
                  ? `${backendPatient.full_name} (ID ${patientId})`
                  : `Patient ID ${patientId || "—"}`}
                <br />
                Encounter {assessmentId || "—"}
              </ReportBlock>
              <ReportBlock title="Assessment findings (subjective highlights)">
                {[
                  draft.subjective.chiefComplaint && `Complaint: ${draft.subjective.chiefComplaint}`,
                  draft.subjective.redFlags && `Red flags: ${draft.subjective.redFlags}`,
                ]
                  .filter(Boolean)
                  .join("\n") || "Not recorded"}
              </ReportBlock>
              <ReportBlock title="Outcome measures">
                {(Object.keys(OUTCOME_LABELS) as OutcomeInstrumentKey[])
                  .map((k) => {
                    const r = draft.outcomes[k].rawNotes.trim();
                    return r ? `${OUTCOME_LABELS[k]}: ${r}` : null;
                  })
                  .filter(Boolean)
                  .join("\n") || "Not recorded"}
              </ReportBlock>
              <ReportBlock title="Functional assessment">
                {(Object.keys(FUNCTIONAL_CV_LABELS) as FunctionalCvTestKey[])
                  .map((k) => {
                    const row = draft.functionalCv[k];
                    if (row.status === "not_started" && !row.result.trim()) return null;
                    return `${FUNCTIONAL_CV_LABELS[k]}: ${statusLabel(row.status)}${
                      row.result.trim() ? ` — ${row.result}` : ""
                    }`;
                  })
                  .filter(Boolean)
                  .join("\n") || "Not recorded"}
              </ReportBlock>
              <ReportBlock title="CV movement findings">
                {(Object.keys(OBJECTIVE_LABELS) as ObjectiveCvCardId[])
                  .map((id) => {
                    const row = draft.objectiveCv[id];
                    if (row.status === "not_started" && !row.result.trim()) return null;
                    return `${OBJECTIVE_LABELS[id]}: ${statusLabel(row.status)}${
                      row.result.trim() ? ` — ${row.result}` : ""
                    }`;
                  })
                  .filter(Boolean)
                  .join("\n") || "Not recorded"}
              </ReportBlock>
              <ReportBlock title="Clinical impression (AI suggestion)">
                {draft.ai.clinicalImpressionSuggestion.trim() || "Not recorded"}
              </ReportBlock>
              <ReportBlock title="Therapist-approved diagnosis">
                {draft.therapist.finalDiagnosis.trim() || "Not recorded"}
              </ReportBlock>
              <ReportBlock title="SOAP (abridged)">
                S: {draft.soap.subjective.trim() || "—"}
                <br />
                O: {draft.soap.objective.trim() || "—"}
                <br />
                A: {draft.soap.assessment.trim() || "—"}
                <br />
                P: {draft.soap.plan.trim() || "—"}
              </ReportBlock>
              <button
                type="button"
                disabled
                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/40"
              >
                Export PDF (coming soon)
              </button>
            </section>
          )}

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
            <p className="text-xs text-white/45">
              Draft saved locally for this encounter · Step {stepIndex + 1} of {STEPS.length}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={stepIndex <= 0}
                onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)].id)}
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Back
              </button>
              <button
                type="button"
                disabled={stepIndex >= STEPS.length - 1}
                onClick={() =>
                  setStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)].id)
                }
                className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-xl font-bold text-white sm:text-2xl">{title}</h2>
      <p className="mt-1 text-sm text-white/60">{subtitle}</p>
    </div>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-100/90">
      {label}
    </span>
  );
}

function FieldCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B1220]/90 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-white/45">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white/90">{value}</p>
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-white/65">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full resize-y rounded-2xl border border-white/10 bg-[#0B1220] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-400/35"
        placeholder="Not recorded"
      />
    </label>
  );
}

function FutureCaptureRow() {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
        Future capture
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {["Speech-to-text", "Voice recording", "NLP extraction", "Smart questionnaire"].map((x) => (
          <span
            key={x}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/55"
          >
            {x}
          </span>
        ))}
      </div>
    </div>
  );
}

function ReportBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B1220]/80 p-4">
      <h3 className="text-sm font-semibold text-cyan-200/95">{title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/75">{children}</p>
    </div>
  );
}
