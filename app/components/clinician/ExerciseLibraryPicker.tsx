"use client";

import { useMemo, useState } from "react";
import {
  getLibraryExerciseById,
  getLibraryExercisesByRegion,
  type BodyRegion,
  type ExerciseLibraryEntryV1,
} from "@/app/lib/exercise-library-v1";
import { prescribedFromLibrary, type PrescribedExerciseV1 } from "@/app/lib/exercise-resolve";
import { formatDoseLabel } from "@/app/lib/exercise-prescription";

type ExerciseLibraryPickerProps = {
  onAdd: (exercise: PrescribedExerciseV1) => void;
  /** Show clinician metadata in preview */
  showClinicianPreview?: boolean;
};

const REGIONS: { id: BodyRegion | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "knee", label: "Knee" },
  { id: "lumbar", label: "Lumbar" },
  { id: "shoulder", label: "Shoulder" },
];

function regionLabel(region: BodyRegion): string {
  return region.charAt(0).toUpperCase() + region.slice(1);
}

function defaultDoseForEntry(entry: ExerciseLibraryEntryV1): string {
  return (
    formatDoseLabel({
      sets: entry.defaultSets,
      reps: entry.defaultReps,
      durationSec: entry.defaultDurationSec,
      restSec: entry.defaultRestSec,
    }) ?? ""
  );
}

function ClinicalDetailBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-white/60">{value}</p>
    </div>
  );
}

function ExerciseClinicalDetails({
  entry,
  doseLabel,
  showPatientWhy = false,
}: {
  entry: ExerciseLibraryEntryV1;
  doseLabel: string;
  showPatientWhy?: boolean;
}) {
  return (
    <div className="mt-2 space-y-2.5 border-t border-[#1E2D42] pt-2.5">
      <ClinicalDetailBlock label="Body region" value={regionLabel(entry.bodyRegion)} />
      <ClinicalDetailBlock label="Target impairment" value={entry.targetImpairment} />
      <ClinicalDetailBlock label="Functional goal" value={entry.functionalGoal} />
      <ClinicalDetailBlock label="Difficulty" value={`Level ${entry.difficultyLevel}`} />
      <ClinicalDetailBlock label="Default dose" value={doseLabel || "—"} />
      <ClinicalDetailBlock label="Precautions" value={entry.precautions} />
      {entry.contraindications && (
        <ClinicalDetailBlock label="Contraindications" value={entry.contraindications} />
      )}
      <ClinicalDetailBlock label="Biomechanical rationale" value={entry.biomechanicalRationale} />
      <ClinicalDetailBlock label="Progression criteria" value={entry.progressionCriteria} />
      <ClinicalDetailBlock label="Regression criteria" value={entry.regressionCriteria} />
      {entry.futureCvMeasurementTarget && (
        <ClinicalDetailBlock
          label="Future measurement target"
          value={entry.futureCvMeasurementTarget}
        />
      )}
      {showPatientWhy && (
        <div className="rounded-[5px] border border-[#1D9E75]/15 bg-[#1D9E75]/5 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5DCAA5]/80">
            Why this matters (patient preview)
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/55">{entry.whyThisMatters}</p>
        </div>
      )}
    </div>
  );
}

function PatientPreviewPanel({ entry }: { entry: ExerciseLibraryEntryV1 }) {
  return (
    <div className="mt-2 space-y-2.5 border-t border-[#1E2D42] pt-2.5">
      <div className="rounded-[5px] border border-[#1D9E75]/15 bg-[#1D9E75]/5 p-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5DCAA5]/80">
          Why this matters
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-white/55">{entry.whyThisMatters}</p>
      </div>
      <ClinicalDetailBlock label="Instructions" value={entry.patientInstructions} />
      <ClinicalDetailBlock label="Precautions (patient-facing)" value={entry.precautions} />
    </div>
  );
}

function CollapsibleSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group mt-2">
      <summary className="cursor-pointer list-none text-[10px] font-semibold text-[#5DCAA5]/70 transition hover:text-[#5DCAA5] [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1">
          <span className="text-white/25 transition group-open:rotate-90">▸</span>
          {title}
        </span>
      </summary>
      {children}
    </details>
  );
}

export function ExerciseLibraryPicker({
  onAdd,
  showClinicianPreview = true,
}: ExerciseLibraryPickerProps) {
  const [region, setRegion] = useState<BodyRegion | "all">("all");

  const exercises = useMemo(
    () => getLibraryExercisesByRegion(region),
    [region],
  );

  return (
    <div className="space-y-3 rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/30">
          Exercise library v1
        </p>
        <p className="mt-1 text-[11px] text-white/35">
          Structured exercises with clinical rationale, dose defaults, and progression criteria.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {REGIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRegion(r.id)}
            className={`rounded-[6px] px-2.5 py-1 text-[11px] font-semibold transition ${
              region === r.id
                ? "bg-[#1D9E75] text-white"
                : "border border-[#1E2D42] text-white/45 hover:text-white/70"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {exercises.map((entry) => {
          const dose = defaultDoseForEntry(entry);

          return (
            <div
              key={entry.exerciseId}
              className="rounded-[6px] border border-[#1E2D42] bg-[#0F1825] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{entry.nameEn}</p>
                  <p className="mt-0.5 text-[10px] text-white/35">
                    {regionLabel(entry.bodyRegion)} · Level {entry.difficultyLevel}
                    {dose ? ` · ${dose}` : ""}
                  </p>
                  <p className="mt-1 text-[10px] leading-snug text-white/45">
                    <span className="font-semibold text-white/55">Target:</span>{" "}
                    {entry.targetImpairment}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-snug text-white/35 line-clamp-2">
                    <span className="font-semibold text-white/45">Goal:</span>{" "}
                    {entry.functionalGoal}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onAdd(prescribedFromLibrary(entry))}
                  className="shrink-0 rounded-[5px] bg-[#1D9E75]/15 px-2.5 py-1 text-[10px] font-bold text-[#5DCAA5] hover:bg-[#1D9E75]/25"
                >
                  Add
                </button>
              </div>

              {showClinicianPreview && (
                <CollapsibleSection title="Clinical details">
                  <ExerciseClinicalDetails
                    entry={entry}
                    doseLabel={dose}
                    showPatientWhy
                  />
                </CollapsibleSection>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PrescribedExerciseEditor({
  exercise,
  onChange,
  onRemove,
}: {
  exercise: PrescribedExerciseV1;
  onChange: (updated: PrescribedExerciseV1) => void;
  onRemove: () => void;
}) {
  const libraryEntry = getLibraryExerciseById(exercise.exerciseId);
  const doseLabel =
    formatDoseLabel({
      sets: exercise.sets,
      reps: exercise.reps,
      durationSec: exercise.durationSec,
      restSec: exercise.restSec,
    }) ?? "";

  return (
    <div className="space-y-2 rounded-[6px] border border-[#1E2D42] bg-[#0F1825] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{exercise.name}</p>
          <p className="text-[10px] text-white/30">{exercise.exerciseId}</p>
          {libraryEntry && (
            <p className="mt-1 text-[10px] text-white/35">
              {regionLabel(libraryEntry.bodyRegion)} · Level {libraryEntry.difficultyLevel}
              {doseLabel ? ` · ${doseLabel}` : ""}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-[10px] font-semibold text-rose-300/80 hover:text-rose-300"
        >
          Remove
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="block">
          <span className="text-[10px] text-white/30">Sets</span>
          <input
            type="number"
            min={1}
            value={exercise.sets ?? ""}
            onChange={(e) =>
              onChange({
                ...exercise,
                sets: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="mt-0.5 w-full rounded-[5px] border border-[#1E2D42] bg-[#0B1220] px-2 py-1.5 text-xs text-white"
          />
        </label>
        <label className="block">
          <span className="text-[10px] text-white/30">Reps / hold</span>
          <input
            type="text"
            value={exercise.reps ?? exercise.durationSec ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              const asNum = Number(val);
              if (val && !Number.isNaN(asNum) && exercise.durationSec != null) {
                onChange({ ...exercise, durationSec: asNum, reps: undefined });
              } else {
                onChange({ ...exercise, reps: val || undefined, durationSec: undefined });
              }
            }}
            className="mt-0.5 w-full rounded-[5px] border border-[#1E2D42] bg-[#0B1220] px-2 py-1.5 text-xs text-white"
          />
        </label>
        <label className="block">
          <span className="text-[10px] text-white/30">Rest (s)</span>
          <input
            type="number"
            min={0}
            value={exercise.restSec ?? ""}
            onChange={(e) =>
              onChange({
                ...exercise,
                restSec: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="mt-0.5 w-full rounded-[5px] border border-[#1E2D42] bg-[#0B1220] px-2 py-1.5 text-xs text-white"
          />
        </label>
        <label className="col-span-2 block sm:col-span-1">
          <span className="text-[10px] text-white/30">Note</span>
          <input
            type="text"
            value={exercise.clinicianNote ?? ""}
            onChange={(e) =>
              onChange({ ...exercise, clinicianNote: e.target.value || undefined })
            }
            placeholder="Optional"
            className="mt-0.5 w-full rounded-[5px] border border-[#1E2D42] bg-[#0B1220] px-2 py-1.5 text-xs text-white"
          />
        </label>
      </div>

      {libraryEntry && (
        <>
          <CollapsibleSection title="Clinical details">
            <ExerciseClinicalDetails entry={libraryEntry} doseLabel={doseLabel} />
          </CollapsibleSection>
          <CollapsibleSection title="Patient will see">
            <PatientPreviewPanel entry={libraryEntry} />
          </CollapsibleSection>
        </>
      )}
    </div>
  );
}
