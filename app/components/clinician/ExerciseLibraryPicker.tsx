"use client";

import { useMemo, useState } from "react";
import {
  getLibraryExercisesByRegion,
  type BodyRegion,
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

export function ExerciseLibraryPicker({
  onAdd,
  showClinicianPreview = true,
}: ExerciseLibraryPickerProps) {
  const [region, setRegion] = useState<BodyRegion | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const exercises = useMemo(
    () => getLibraryExercisesByRegion(region),
    [region],
  );

  return (
    <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4 space-y-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/30">
          Exercise library v1
        </p>
        <p className="mt-1 text-[11px] text-white/35">
          Select exercises with default dose. You can override sets/reps after adding.
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

      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {exercises.map((entry) => {
          const dose = formatDoseLabel({
            sets: entry.defaultSets,
            reps: entry.defaultReps,
            durationSec: entry.defaultDurationSec,
            restSec: entry.defaultRestSec,
          });
          const isOpen = expandedId === entry.exerciseId;

          return (
            <div
              key={entry.exerciseId}
              className="rounded-[6px] border border-[#1E2D42] bg-[#0F1825] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{entry.nameEn}</p>
                  <p className="text-[10px] text-white/35">
                    {entry.bodyRegion} · Level {entry.difficultyLevel}
                    {dose ? ` · ${dose}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {showClinicianPreview && (
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : entry.exerciseId)}
                      className="rounded-[5px] border border-[#1E2D42] px-2 py-1 text-[10px] font-semibold text-white/45 hover:text-white/70"
                    >
                      {isOpen ? "Less" : "Info"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onAdd(prescribedFromLibrary(entry))}
                    className="rounded-[5px] bg-[#1D9E75]/15 px-2.5 py-1 text-[10px] font-bold text-[#5DCAA5] hover:bg-[#1D9E75]/25"
                  >
                    Add
                  </button>
                </div>
              </div>
              {isOpen && showClinicianPreview && (
                <div className="mt-2 space-y-1 border-t border-[#1E2D42] pt-2 text-[10px] leading-relaxed text-white/45">
                  <p><span className="font-semibold text-white/55">Impairment:</span> {entry.targetImpairment}</p>
                  <p><span className="font-semibold text-white/55">Goal:</span> {entry.functionalGoal}</p>
                  <p><span className="font-semibold text-white/55">Rationale:</span> {entry.biomechanicalRationale}</p>
                  <p><span className="font-semibold text-white/55">Progress when:</span> {entry.progressionCriteria}</p>
                  <p><span className="font-semibold text-white/55">Regress if:</span> {entry.regressionCriteria}</p>
                </div>
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
  return (
    <div className="rounded-[6px] border border-[#1E2D42] bg-[#0F1825] p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{exercise.name}</p>
          <p className="text-[10px] text-white/30">{exercise.exerciseId}</p>
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
        <label className="block col-span-2 sm:col-span-1">
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
    </div>
  );
}
