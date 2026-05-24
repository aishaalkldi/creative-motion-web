"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { REHAB_PROGRAMS, type PlanSession } from "@/app/lib/api/treatment-plans";
import type { PatientRow } from "@/app/lib/validate-patient-ownership";
import type { AssessmentRow } from "@/app/api/assessments/route";
import { extractGeneralDraft, extractStructuredData } from "@/app/lib/assessment-payload";
import type { PlanRow } from "@/app/api/plans/route";
import {
  PILOT_PROGRAM_TEMPLATES,
  clonePilotTemplate,
  type PilotProgramSession,
  type PilotProgramTemplate,
} from "@/app/lib/program-templates";
import {
  ExerciseLibraryPicker,
  PrescribedExerciseEditor,
} from "@/app/components/clinician/ExerciseLibraryPicker";
import type { PrescribedExerciseV1 } from "@/app/lib/exercise-resolve";
import { isPrescribedExerciseV1, getExerciseDisplayName } from "@/app/lib/exercise-prescription";

type PlanSessionDraft = {
  sessionNumber: number;
  title: string;
  exercises: (string | PrescribedExerciseV1)[];
};

/* ─── Phase row ──────────────────────────────────────────────────────────── */

interface PhaseConfig {
  label: string;
  exercises: string;
  targetRom: string;
  adherenceGoal: string;
  milestone: string;
}

const DEFAULT_PHASES: PhaseConfig[] = [
  {
    label:         "Phase 1",
    exercises:     "Sit to stand · Heel raises · Mini squat (0–45°) · Single leg stance",
    targetRom:     "",
    adherenceGoal: "80",
    milestone:     "Pain ≤ 3/10 · ROM baseline established",
  },
  {
    label:         "Phase 2",
    exercises:     "Step-ups · Forward lunges · Balance board · Resistance band squats",
    targetRom:     "",
    adherenceGoal: "85",
    milestone:     "Load symmetry ≥ 75% · Phase 1 complete",
  },
  {
    label:         "Phase 3",
    exercises:     "Dynamic control · Single-leg squat · Agility ladder · Return-to-sport drills",
    targetRom:     "",
    adherenceGoal: "90",
    milestone:     "Full ROM restored · Return to sport criteria met",
  },
];

function PhaseCard({
  phase,
  config,
  onChange,
}: {
  phase: string;
  config: PhaseConfig;
  onChange: (key: keyof PhaseConfig, val: string) => void;
}) {
  const [open, setOpen] = useState(phase === "Phase 1");

  return (
    <div className="rounded-[8px] border border-[#1E2D42] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between bg-[#0B1220] px-5 py-3.5 text-left transition hover:bg-[#0d1520]"
      >
        <span className="text-sm font-bold text-white">{phase}</span>
        <svg
          className={`h-4 w-4 text-white/30 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="divide-y divide-[#1E2D42] bg-[#0F1825]">
          <PlanField
            label="Exercises / Sessions"
            hint="One exercise per line or comma-separated"
          >
            <textarea
              rows={3}
              value={config.exercises}
              onChange={(e) => onChange("exercises", e.target.value)}
              className="w-full resize-none rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#1D9E75]/40"
            />
          </PlanField>

          <PlanField label="Target ROM (°)" hint="End-of-phase ROM target">
            <input
              type="text"
              value={config.targetRom}
              onChange={(e) => onChange("targetRom", e.target.value)}
              placeholder="e.g. 110°"
              className="w-full rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#1D9E75]/40"
            />
          </PlanField>

          <PlanField label="Adherence goal (%)" hint="Target session completion rate">
            <input
              type="number"
              min={0}
              max={100}
              value={config.adherenceGoal}
              onChange={(e) => onChange("adherenceGoal", e.target.value)}
              className="w-full rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#1D9E75]/40"
            />
          </PlanField>

          <PlanField label="Phase milestone" hint="Clinical criteria to progress to next phase">
            <input
              type="text"
              value={config.milestone}
              onChange={(e) => onChange("milestone", e.target.value)}
              className="w-full rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#1D9E75]/40"
            />
          </PlanField>
        </div>
      )}
    </div>
  );
}

function PlanField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4">
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-white/30">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-white/20">{hint}</p>}
    </div>
  );
}

function PilotTemplateCard({
  template,
  selected,
  onUse,
}: {
  template: PilotProgramTemplate;
  selected: boolean;
  onUse: () => void;
}) {
  return (
    <div
      className={`rounded-[7px] border p-4 transition ${
        selected
          ? "border-[#1D9E75]/40 bg-[#1D9E75]/8"
          : "border-[#1E2D42] bg-[#0B1220]"
      }`}
    >
      <p className="text-sm font-semibold text-white">{template.title}</p>
      <p className="mt-1 text-xs text-white/40">{template.conditionArea} · {template.level}</p>
      <p className="mt-2 text-xs leading-relaxed text-white/55">{template.goal}</p>
      <p className="mt-2 text-[11px] text-white/30">
        {template.sessions.length} sessions · {template.sessions.map((s) => s.exercises.length).reduce((a, b) => a + b, 0)} exercises
      </p>
      <button
        type="button"
        onClick={onUse}
        className="mt-3 w-full rounded-[6px] border border-[#1D9E75]/30 bg-[#1D9E75]/10 px-3 py-2 text-xs font-semibold text-[#5DCAA5] transition hover:bg-[#1D9E75]/20"
      >
        Use template
      </button>
    </div>
  );
}

function EditableSessionCard({
  session,
  onChange,
}: {
  session: PlanSessionDraft;
  onChange: (updated: PlanSessionDraft) => void;
}) {
  const structured = session.exercises.filter(isPrescribedExerciseV1);
  const textLines = session.exercises
    .filter((ex): ex is string => typeof ex === "string")
    .join("\n");

  function addExercise(exercise: PrescribedExerciseV1) {
    onChange({ ...session, exercises: [...session.exercises, exercise] });
  }

  function updateStructured(index: number, updated: PrescribedExerciseV1) {
    const next = [...session.exercises];
    let si = 0;
    for (let i = 0; i < next.length; i++) {
      if (isPrescribedExerciseV1(next[i]!)) {
        if (si === index) {
          next[i] = updated;
          break;
        }
        si++;
      }
    }
    onChange({ ...session, exercises: next });
  }

  function removeStructured(index: number) {
    const next = [...session.exercises];
    let si = 0;
    for (let i = 0; i < next.length; i++) {
      if (isPrescribedExerciseV1(next[i]!)) {
        if (si === index) {
          next.splice(i, 1);
          break;
        }
        si++;
      }
    }
    onChange({ ...session, exercises: next });
  }

  return (
    <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-[#1D9E75]/10 text-[10px] font-bold text-[#5DCAA5]"
          style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
        >
          {session.sessionNumber}
        </span>
        <input
          type="text"
          value={session.title}
          onChange={(e) => onChange({ ...session, title: e.target.value })}
          className="flex-1 rounded-[6px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2 text-sm font-semibold text-white outline-none focus:border-[#1D9E75]/40"
        />
      </div>

      {structured.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/25">
            Library exercises
          </p>
          {structured.map((ex, i) => (
            <PrescribedExerciseEditor
              key={`${ex.exerciseId}-${i}`}
              exercise={ex}
              onChange={(updated) => updateStructured(i, updated)}
              onRemove={() => removeStructured(i)}
            />
          ))}
        </div>
      )}

      <ExerciseLibraryPicker onAdd={addExercise} />

      <div>
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-white/25">
          Custom exercises (text fallback)
        </label>
        <textarea
          rows={Math.max(2, textLines.split("\n").filter(Boolean).length || 2)}
          value={textLines}
          onChange={(e) => {
            const customLines = e.target.value
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean);
            onChange({ ...session, exercises: [...structured, ...customLines] });
          }}
          placeholder="One exercise per line — used when not in library"
          className="w-full resize-y rounded-[6px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#1D9E75]/40"
        />
        <p className="mt-1 text-[11px] text-white/20">
          Library exercises above are saved with structured dose. Custom lines remain as text.
        </p>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

function NewPlanInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const initPatientId = searchParams.get("patientId") || null;

  const [patientId,  setPatientId]  = useState<string | null>(initPatientId);
  const [programId,  setProgramId]  = useState("");
  const [baselineId, setBaselineId] = useState("");
  const [notes,      setNotes]      = useState("");
  const [phases,     setPhases]     = useState<PhaseConfig[]>(DEFAULT_PHASES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [planTitle,  setPlanTitle]  = useState("");
  const [planGoal,   setPlanGoal]   = useState("");
  const [planSessions, setPlanSessions] = useState<PlanSessionDraft[]>([]);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [saveError,  setSaveError]  = useState("");

  // Patient list (when no patientId in URL)
  const [patientList,     setPatientList]     = useState<PatientRow[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);

  // Selected patient (loaded from API when patientId is in URL)
  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(null);

  // Assessments for the selected patient (from Supabase)
  const [assessments,      setAssessments]     = useState<AssessmentRow[]>([]);

  // Load patient list when no patientId pre-selected
  useEffect(() => {
    if (initPatientId) return;
    setPatientsLoading(true);
    fetch("/api/patients")
      .then(async (r) => { if (r.ok) setPatientList((await r.json()) as PatientRow[]); })
      .catch(() => {})
      .finally(() => setPatientsLoading(false));
  }, [initPatientId]);

  // Load the pre-selected patient
  useEffect(() => {
    if (!patientId) return;
    fetch(`/api/patients/${patientId}`)
      .then(async (r) => { if (r.ok) setSelectedPatient((await r.json()) as PatientRow); })
      .catch(() => {});
  }, [patientId]);

  // Load assessments for the selected patient
  useEffect(() => {
    if (!patientId) { setAssessments([]); return; }
    fetch(`/api/assessments?patientId=${patientId}`)
      .then(async (r) => { if (r.ok) setAssessments((await r.json()) as AssessmentRow[]); })
      .catch(() => {});
  }, [patientId]);

  const displayedAssessments = useMemo(() => assessments.slice(0, 5), [assessments]);

  function updatePhase(i: number, key: keyof PhaseConfig, val: string) {
    setPhases((prev) => prev.map((p, idx) => idx === i ? { ...p, [key]: val } : p));
  }

  function applyPilotTemplate(template: PilotProgramTemplate) {
    const cloned = clonePilotTemplate(template);
    setSelectedTemplateId(template.id);
    setProgramId("");
    setPlanTitle(cloned.title);
    setPlanGoal(cloned.goal);
    setPlanSessions(
      cloned.sessions.map((s) => ({
        sessionNumber: s.sessionNumber,
        title: s.title,
        exercises: [...s.exercises],
      })),
    );
    setNotes((prev) => {
      if (prev.trim()) return prev;
      return cloned.safetyNote;
    });
    setPhases((prev) =>
      prev.map((p, i) =>
        i === 0
          ? {
              ...p,
              exercises: cloned.sessions
                .map((s) => s.exercises.map((ex) => getExerciseDisplayName(ex)).join(" · "))
                .join("\n"),
            }
          : p,
      ),
    );
  }

  function clearPilotTemplate() {
    setSelectedTemplateId(null);
    setPlanTitle("");
    setPlanGoal("");
    setPlanSessions([]);
  }

  function updatePlanSession(index: number, updated: PlanSessionDraft) {
    setPlanSessions((prev) => prev.map((s, i) => (i === index ? updated : s)));
  }

  async function handleAssign() {
    if (!selectedPatient) return;
    setSaving(true);
    setSaveError("");

    try {
      const matchedProg = REHAB_PROGRAMS.find((r) => r.id === programId);

      let payload: Record<string, unknown>;

      if (selectedTemplateId && planSessions.length > 0) {
        payload = {
          patientId:      selectedPatient.id,
          assessmentId:   baselineId || null,
          title:          planTitle.trim() || "Pilot Rehabilitation Plan",
          programId:      selectedTemplateId,
          programName:    planTitle.trim() || "Pilot Rehabilitation Plan",
          phase:          "phase-1",
          phaseName:      "Phase 1",
          phaseGoal:      planGoal.trim() || "Complete assigned sessions as prescribed.",
          sessionsPerWeek: 3,
          totalWeeks:     Math.max(1, Math.ceil(planSessions.length / 3)),
          clinicianNote:  notes,
          assignedBy:     "Dr. Provider",
          sessions:       planSessions.map((s) => ({
            sessionNumber: s.sessionNumber,
            title:         s.title.trim() || `Session ${s.sessionNumber}`,
            exercises:     s.exercises.length > 0 ? s.exercises : ["As prescribed by your therapist"],
          })),
        };
      } else if (matchedProg) {
        const firstPhase = matchedProg.phases[0];
        const sessions: PlanSession[] = Array.from({ length: firstPhase.defaultSessions }, (_, i) => ({
          id:             `s-${i + 1}`,
          sessionNumber:  i + 1,
          title:          i % 2 === 0
            ? `${firstPhase.name.split("—")[1]?.trim() ?? "Rehab"} Session A`
            : `${firstPhase.name.split("—")[1]?.trim() ?? "Rehab"} Session B`,
          exercises:      firstPhase.exercises,
          estimatedMinutes: 25,
          status:         "ready" as const,
        }));

        payload = {
          patientId:      selectedPatient.id,
          assessmentId:   baselineId || null,
          title:          matchedProg.name,
          programId:      matchedProg.id,
          programName:    matchedProg.name,
          phase:          firstPhase.id,
          phaseName:      firstPhase.name,
          phaseGoal:      firstPhase.goal,
          sessionsPerWeek: 3,
          totalWeeks:     Math.ceil(firstPhase.defaultSessions / 3),
          clinicianNote:  notes,
          assignedBy:     "Dr. Provider",
          sessions:       sessions.map((s) => ({
            sessionNumber: s.sessionNumber,
            title:         s.title,
            exercises:     s.exercises,
          })),
        };
      } else {
        // Custom plan
        const p1 = phases[0];
        const exercises = p1.exercises.split(/[,\n·]/).map((e) => e.trim()).filter(Boolean);
        const customSessions = Array.from({ length: 6 }, (_, i) => ({
          sessionNumber: i + 1,
          title:         i % 2 === 0 ? "Rehab Session A" : "Rehab Session B",
          exercises,
        }));

        payload = {
          patientId:      selectedPatient.id,
          assessmentId:   baselineId || null,
          title:          "Custom Rehabilitation Plan",
          programId:      "custom",
          programName:    "Custom Rehabilitation Plan",
          phase:          "phase-1",
          phaseName:      "Phase 1",
          phaseGoal:      p1.milestone || "Complete rehabilitation programme.",
          sessionsPerWeek: 3,
          totalWeeks:     6,
          clinicianNote:  notes,
          assignedBy:     "Dr. Provider",
          phases,
          sessions:       customSessions,
        };
      }

      const res = await fetch("/api/plans", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Failed to create plan (${res.status})`);
      }

      const planRow = (await res.json()) as PlanRow;
      if (!planRow.patient_token) {
        throw new Error("Plan was not fully created. Please try again.");
      }

      setSaved(true);
      setTimeout(
        () => router.push(`/clinician/patients/${selectedPatient.id}?planAssigned=1`),
        1000,
      );
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to assign plan.");
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B1220] text-white">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#1D9E75]/30 bg-[#1D9E75]/10">
            <svg className="h-7 w-7 text-[#1D9E75]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <p className="mt-4 text-base font-bold text-white">Plan assigned</p>
          <p className="mt-1 text-sm text-white/40">Redirecting to patient record…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1220] px-6 py-8 text-white">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Back */}
        {patientId && selectedPatient ? (
          <Link
            href={`/clinician/patients/${patientId}`}
            className="flex items-center gap-1.5 text-sm text-white/35 transition hover:text-white/65"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to {selectedPatient.full_name}
          </Link>
        ) : (
          <Link href="/clinician/patients" className="flex items-center gap-1.5 text-sm text-white/35 transition hover:text-white/65">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Patients
          </Link>
        )}

        {/* Header */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Treatment Plan</p>
          <h1 className="mt-1.5 text-2xl font-bold text-white">Build rehabilitation plan</h1>
          <p className="mt-1 text-sm text-white/40">
            Select exercises from the library, set dose, and assign structured sessions.
          </p>
        </div>

        {/* Patient select */}
        <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6 space-y-4">
          <h2 className="text-sm font-bold text-white">Patient</h2>
          {patientsLoading ? (
            <p className="text-sm text-white/30">Loading patients…</p>
          ) : patientId && selectedPatient ? (
            // Pre-selected patient (from URL param)
            <div className="flex items-center gap-3 rounded-[7px] border border-[#1D9E75]/40 bg-[#1D9E75]/8 px-4 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] bg-[#1D9E75]/10 text-[10px] font-bold text-[#5DCAA5]">
                {selectedPatient.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{selectedPatient.full_name}</p>
                <p className="text-[10px] text-white/30 truncate">{selectedPatient.diagnosis || "No diagnosis"}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {patientList.length === 0 ? (
                <div className="col-span-2 rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-4 py-5 text-center">
                  <p className="text-sm text-white/40">No patients found.</p>
                  <Link href="/clinician/patients/new" className="mt-1 inline-block text-xs font-semibold text-[#5DCAA5]">
                    Add first patient →
                  </Link>
                </div>
              ) : (
                patientList.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setPatientId(p.id); setSelectedPatient(p); }}
                    className={`flex items-center gap-3 rounded-[7px] border px-4 py-3 text-left transition ${
                      patientId === p.id
                        ? "border-[#1D9E75]/40 bg-[#1D9E75]/8"
                        : "border-[#1E2D42] bg-[#0B1220] hover:border-[#1D9E75]/20"
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] bg-[#1D9E75]/10 text-[10px] font-bold text-[#5DCAA5]">
                      {p.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{p.full_name}</p>
                      <p className="text-[10px] text-white/30 truncate">{p.diagnosis || "No diagnosis"}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {patientId != null && (
          <>
            {/* Baseline assessment select */}
            <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white">Assessment baseline</h2>
                <p className="mt-1 text-xs text-white/35">Select an existing assessment as the plan&apos;s baseline, or proceed without one.</p>
              </div>
              {displayedAssessments.length === 0 ? (
                <div className="flex items-center justify-between rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3">
                  <span className="text-sm text-white/35">No saved assessments for this patient.</span>
                  <Link
                    href={`/clinician/assessment/new?patientId=${patientId}`}
                    className="text-xs font-semibold text-[#5DCAA5] hover:text-[#1D9E75]"
                  >
                    + New Assessment
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedAssessments.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setBaselineId(a.id)}
                      className={`flex w-full items-center gap-4 rounded-[7px] border px-4 py-3 text-left transition ${
                        baselineId === a.id
                          ? "border-[#1D9E75]/40 bg-[#1D9E75]/8"
                          : "border-[#1E2D42] bg-[#0B1220] hover:border-[#1D9E75]/20"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">
                          {extractStructuredData(a.structured_data)?.bodyRegion
                            ?? (extractGeneralDraft(a.structured_data, a.type) ? "General MSK" : null)
                            ?? a.type}
                        </p>
                        <p
                          className="text-[10px] text-white/30"
                          style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                        >
                          {a.created_at.split("T")[0]} · Pain{" "}
                          {(extractStructuredData(a.structured_data)?.painAtRest
                            ?? Number.parseInt(
                              extractGeneralDraft(a.structured_data, a.type)?.subjective.nprs ?? "",
                              10,
                            ))
                            || 0}
                          /10
                        </p>
                      </div>
                      {baselineId === a.id && (
                        <svg className="h-4 w-4 shrink-0 text-[#1D9E75]" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pilot program templates */}
            <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white">Start from a pilot template</h2>
                <p className="mt-1 text-xs text-white/35">
                  Templates are starting points. Clinician must review and adapt before assigning.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {PILOT_PROGRAM_TEMPLATES.map((template) => (
                  <PilotTemplateCard
                    key={template.id}
                    template={template}
                    selected={selectedTemplateId === template.id}
                    onUse={() => applyPilotTemplate(template)}
                  />
                ))}
              </div>
            </div>

            {/* Editable plan from template */}
            {selectedTemplateId && planSessions.length > 0 && (
              <div className="rounded-[10px] border border-[#1D9E75]/25 bg-[#0F1825] p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-white">Review &amp; edit plan</h2>
                    <p className="mt-1 text-xs text-white/35">
                      Adjust titles and exercises before assigning to the patient.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearPilotTemplate}
                    className="text-xs font-semibold text-white/40 transition hover:text-white/70"
                  >
                    Clear template
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-white/30">
                      Plan title
                    </label>
                    <input
                      type="text"
                      value={planTitle}
                      onChange={(e) => setPlanTitle(e.target.value)}
                      className="w-full rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#1D9E75]/40"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-white/30">
                      Program goal
                    </label>
                    <textarea
                      rows={2}
                      value={planGoal}
                      onChange={(e) => setPlanGoal(e.target.value)}
                      className="w-full resize-none rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#1D9E75]/40"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/30">Sessions</p>
                  {planSessions.map((session, i) => (
                    <EditableSessionCard
                      key={`${session.sessionNumber}-${i}`}
                      session={session}
                      onChange={(updated) => updatePlanSession(i, updated)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Rehab protocol (legacy programs) */}
            {!selectedTemplateId && (
              <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6 space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-white">Rehabilitation protocol</h2>
                  <p className="mt-1 text-xs text-white/35">Select a base protocol or leave unset for a custom plan.</p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {REHAB_PROGRAMS.map((prog) => (
                    <button
                      key={prog.id}
                      type="button"
                      onClick={() => setProgramId(prog.id)}
                      className={`rounded-[7px] border px-4 py-3 text-left transition ${
                        programId === prog.id
                          ? "border-[#1D9E75]/40 bg-[#1D9E75]/8"
                          : "border-[#1E2D42] bg-[#0B1220] hover:border-[#1D9E75]/20"
                      }`}
                    >
                      <p className="text-sm font-semibold text-white">{prog.name}</p>
                      <p className="mt-0.5 text-xs text-white/30">{prog.category}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Phase builder (manual custom plan) */}
            {!selectedTemplateId && (
              <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] overflow-hidden">
                <div className="border-b border-[#1E2D42] px-5 py-4">
                  <h2 className="text-sm font-bold text-white">Phase structure</h2>
                  <p className="mt-0.5 text-xs text-white/35">
                    Configure each phase — click to expand and edit.
                  </p>
                </div>
                <div className="divide-y divide-[#1E2D42] p-4 space-y-2">
                  {phases.map((ph, i) => (
                    <PhaseCard
                      key={ph.label}
                      phase={ph.label}
                      config={ph}
                      onChange={(key, val) => updatePhase(i, key, val)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Therapist notes */}
            <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-white/30">
                Therapist notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Clinical context, contraindications, or special instructions…"
                className="w-full resize-none rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#1D9E75]/40"
              />
            </div>

            {saveError && (
              <p className="rounded-[7px] border border-rose-400/20 bg-rose-400/8 px-4 py-3 text-sm text-rose-300">
                {saveError}
              </p>
            )}

            {/* Assign button */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/25">
                Plan will be visible in the patient portal immediately.
              </p>
              <button
                type="button"
                onClick={handleAssign}
                disabled={saving || !selectedPatient}
                className="rounded-[7px] bg-[#1D9E75] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#179165] disabled:opacity-50"
              >
                {saving ? "Assigning…" : "Assign to Patient"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function NewPlanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0B1220]">
          <p className="text-sm text-white/30">Loading…</p>
        </div>
      }
    >
      <NewPlanInner />
    </Suspense>
  );
}
