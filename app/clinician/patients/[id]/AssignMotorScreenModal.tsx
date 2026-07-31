"use client";

import { useEffect, useRef, useState } from "react";
import {
  AFFECTED_ARM_SUPPORT_LEVELS,
  BACK_TRUNK_SUPPORT_LEVELS,
  CAREGIVER_SUPERVISION_REQUIREMENTS,
  STARTING_SITTING_POSITIONS,
  UPPER_LIMB_DELIVERY_MODES,
  UPPER_LIMB_SIDES,
  type AffectedArmSupportLevel,
  type BackTrunkSupportLevel,
  type CaregiverSupervisionRequirement,
  type StartingSittingPosition,
  type UpperLimbDeliveryMode,
  type UpperLimbSide,
} from "../../../lib/upper-limb-motor-screen/types";
import {
  AFFECTED_ARM_SUPPORT_LABELS,
  BACK_TRUNK_SUPPORT_LABELS,
  buildMotorScreenPatientLink,
  CAREGIVER_SUPERVISION_LABELS,
  createForwardReachAssignment,
  STARTING_SITTING_POSITION_LABELS,
  UPPER_LIMB_DELIVERY_MODE_LABELS,
  UPPER_LIMB_SIDE_LABELS,
  type CreatedForwardReachAssignment,
} from "../../../lib/api/upper-limb-motor-screen";

const PAIN_SCORE_OPTIONS = Array.from({ length: 11 }, (_, i) => i);

interface Props {
  patientId: string;
  patientName: string;
  onClose: () => void;
  onCreated: (result: CreatedForwardReachAssignment) => void;
}

function ToggleGroup<T extends string>({
  legend,
  helperText,
  helperId,
  options,
  value,
  onChange,
  columns,
}: {
  legend: string;
  helperText?: string;
  helperId?: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  columns: 2 | 3 | 4;
}) {
  const gridClass =
    columns === 2 ? "grid-cols-2" : columns === 3 ? "grid-cols-3" : "grid-cols-4";
  return (
    <fieldset aria-describedby={helperText ? helperId : undefined}>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
        {legend}
      </legend>
      {helperText && (
        <p id={helperId} className="mb-2 text-[11px] leading-4 text-white/40">
          {helperText}
        </p>
      )}
      <div className={`grid gap-2 ${gridClass}`}>
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(opt.value)}
              className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 ${
                selected
                  ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-200"
                  : "border-white/8 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function AssignMotorScreenModal({ patientId, patientName, onClose, onCreated }: Props) {
  // Spotlighted fields — no default, strictly required.
  const [affectedSide, setAffectedSide] = useState<UpperLimbSide | null>(null);
  const [testedSide, setTestedSide] = useState<UpperLimbSide | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<UpperLimbDeliveryMode | null>(null);

  // Remaining clinician-controlled configuration required by the existing
  // assignment contract — also no defaults (assignment-validation.ts rejects
  // missing fields rather than filling them in).
  const [startingSittingPosition, setStartingSittingPosition] =
    useState<StartingSittingPosition | null>(null);
  const [backTrunkSupport, setBackTrunkSupport] = useState<BackTrunkSupportLevel | null>(null);
  const [affectedArmSupport, setAffectedArmSupport] = useState<AffectedArmSupportLevel | null>(null);
  const [baselinePainScore, setBaselinePainScore] = useState<number | null>(null);
  const [movementRangeKind, setMovementRangeKind] = useState<
    "not_applicable" | "configured" | null
  >(null);
  const [movementRangeDescription, setMovementRangeDescription] = useState("");
  const [caregiverSupervisionRequirement, setCaregiverSupervisionRequirement] =
    useState<CaregiverSupervisionRequirement | null>(null);
  const [stopCriteria, setStopCriteria] = useState<string[]>([]);
  const [stopCriteriaDraft, setStopCriteriaDraft] = useState("");
  const [noStopCriteriaConfirmed, setNoStopCriteriaConfirmed] = useState(false);
  const [taskEligibilityConfirmed, setTaskEligibilityConfirmed] = useState(false);
  const [restPeriodSeconds, setRestPeriodSeconds] = useState("");
  const [targetDirection, setTargetDirection] = useState("");
  const [targetHeight, setTargetHeight] = useState("");
  const [targetDistance, setTargetDistance] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedForwardReachAssignment | null>(null);
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  function addStopCriterion() {
    const trimmed = stopCriteriaDraft.trim();
    if (!trimmed) return;
    setStopCriteria((prev) => [...prev, trimmed]);
    setStopCriteriaDraft("");
    setNoStopCriteriaConfirmed(false);
  }

  function removeStopCriterion(index: number) {
    setStopCriteria((prev) => prev.filter((_, i) => i !== index));
  }

  const movementRangeSatisfied =
    movementRangeKind === "not_applicable" ||
    (movementRangeKind === "configured" && movementRangeDescription.trim().length > 0);
  const stopCriteriaSatisfied = stopCriteria.length > 0 || noStopCriteriaConfirmed;
  const restPeriodValue = restPeriodSeconds.trim() === "" ? null : Number(restPeriodSeconds);
  const restPeriodValid =
    restPeriodValue !== null && Number.isFinite(restPeriodValue) && restPeriodValue >= 0;
  const targetPlacementSatisfied =
    targetDirection.trim() !== "" && targetHeight.trim() !== "" && targetDistance.trim() !== "";

  const canSubmit =
    affectedSide !== null &&
    testedSide !== null &&
    deliveryMode !== null &&
    startingSittingPosition !== null &&
    backTrunkSupport !== null &&
    affectedArmSupport !== null &&
    baselinePainScore !== null &&
    movementRangeKind !== null &&
    movementRangeSatisfied &&
    caregiverSupervisionRequirement !== null &&
    stopCriteriaSatisfied &&
    taskEligibilityConfirmed &&
    restPeriodValid &&
    targetPlacementSatisfied &&
    !submitting;

  async function handleSubmit() {
    if (submitting || !canSubmit) return;
    if (
      !affectedSide ||
      !testedSide ||
      !deliveryMode ||
      !startingSittingPosition ||
      !backTrunkSupport ||
      !affectedArmSupport ||
      baselinePainScore === null ||
      !movementRangeKind ||
      !caregiverSupervisionRequirement ||
      restPeriodValue === null
    ) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await createForwardReachAssignment({
        patientId,
        affectedSide,
        configuration: {
          startingSittingPosition,
          backTrunkSupport,
          affectedArmSupport,
          baselinePainScore,
          permittedMovementRange:
            movementRangeKind === "not_applicable"
              ? { kind: "not_applicable" }
              : { kind: "configured", clinicianDescription: movementRangeDescription.trim() },
          caregiverSupervisionRequirement,
          deliveryMode,
          patientSpecificStopCriteria: stopCriteria,
        },
        forwardReachTaskGroup: {
          testedSide,
          eligible: true,
          restPeriodSeconds: restPeriodValue,
          targetPlacement: {
            direction: targetDirection.trim(),
            height: targetHeight.trim(),
            distance: targetDistance.trim(),
          },
        },
      });
      setCreated(result);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Link kept only in component state — never localStorage/sessionStorage, never logged.
  const link = created ? buildMotorScreenPatientLink(created.patientAccessToken) : "";

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignore */
    }
  }

  // Closing is disabled while a request is in flight — the assignment must be
  // allowed to finish so the one-time patient-access token can still be shown.
  function handleClose() {
    if (submitting) return;
    onClose();
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (submitting) return;
    if (e.target === overlayRef.current) onClose();
  }

  useEffect(() => {
    if (submitting) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/12 bg-[#0d1f3c] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300/70">
              Upper-Limb Motor Screen
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-white">Assign Forward Reach</h2>
            <p className="mt-0.5 text-xs text-white/45">{patientName}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            aria-disabled={submitting}
            aria-label={submitting ? "Close (disabled while assigning)" : "Close"}
            className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 ${
              submitting
                ? "cursor-not-allowed opacity-40"
                : "hover:bg-white/10 hover:text-white"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
          {!created ? (
            <div className="space-y-6">
              {/* Scope banner */}
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <p className="text-xs leading-5 text-white/60">
                  <span className="font-semibold text-white/80">Task:</span> Forward Reach ·{" "}
                  <span className="font-semibold text-white/80">Attempts:</span> 1 · Clinician
                  assignment and review are required.
                </p>
                <p className="mt-1.5 text-[11px] leading-4 text-white/40">
                  Part of the RASQ Upper-Limb Motor Screen: non-standardized, clinician assigned,
                  CV supported, clinician reviewed. This is not a diagnosis or a standardized
                  impairment score, and creating this assignment does not confirm clinical
                  suitability.
                </p>
              </div>

              <ToggleGroup
                legend="Affected side"
                helperId="affected-side-helper"
                helperText="The side affected by the patient's condition, as identified by the clinician."
                columns={2}
                value={affectedSide}
                onChange={setAffectedSide}
                options={UPPER_LIMB_SIDES.map((s) => ({ value: s, label: UPPER_LIMB_SIDE_LABELS[s] }))}
              />

              <ToggleGroup
                legend="Tested side"
                helperId="tested-side-helper"
                helperText="The side being assessed in this specific Forward Reach assignment — may be the same as or different from the affected side."
                columns={2}
                value={testedSide}
                onChange={setTestedSide}
                options={UPPER_LIMB_SIDES.map((s) => ({ value: s, label: UPPER_LIMB_SIDE_LABELS[s] }))}
              />

              <ToggleGroup
                legend="Delivery mode"
                columns={2}
                value={deliveryMode}
                onChange={setDeliveryMode}
                options={UPPER_LIMB_DELIVERY_MODES.map((m) => ({
                  value: m,
                  label: UPPER_LIMB_DELIVERY_MODE_LABELS[m],
                }))}
              />

              <ToggleGroup
                legend="Starting sitting position"
                columns={2}
                value={startingSittingPosition}
                onChange={setStartingSittingPosition}
                options={STARTING_SITTING_POSITIONS.map((p) => ({
                  value: p,
                  label: STARTING_SITTING_POSITION_LABELS[p],
                }))}
              />

              <ToggleGroup
                legend="Back / trunk support"
                columns={3}
                value={backTrunkSupport}
                onChange={setBackTrunkSupport}
                options={BACK_TRUNK_SUPPORT_LEVELS.map((s) => ({
                  value: s,
                  label: BACK_TRUNK_SUPPORT_LABELS[s],
                }))}
              />

              <ToggleGroup
                legend="Affected arm support"
                columns={4}
                value={affectedArmSupport}
                onChange={setAffectedArmSupport}
                options={AFFECTED_ARM_SUPPORT_LEVELS.map((s) => ({
                  value: s,
                  label: AFFECTED_ARM_SUPPORT_LABELS[s],
                }))}
              />

              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
                  Baseline pain score (0–10)
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {PAIN_SCORE_OPTIONS.map((n) => {
                    const selected = baselinePainScore === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setBaselinePainScore(n)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 ${
                          selected
                            ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-200"
                            : "border-white/8 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
                  Permitted movement range
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={movementRangeKind === "not_applicable"}
                    onClick={() => setMovementRangeKind("not_applicable")}
                    className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 ${
                      movementRangeKind === "not_applicable"
                        ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-200"
                        : "border-white/8 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
                    }`}
                  >
                    Not applicable
                  </button>
                  <button
                    type="button"
                    aria-pressed={movementRangeKind === "configured"}
                    onClick={() => setMovementRangeKind("configured")}
                    className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 ${
                      movementRangeKind === "configured"
                        ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-200"
                        : "border-white/8 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
                    }`}
                  >
                    Configured boundary
                  </button>
                </div>
                {movementRangeKind === "configured" && (
                  <label className="mt-2 block">
                    <span className="sr-only">Movement range description</span>
                    <textarea
                      value={movementRangeDescription}
                      onChange={(e) => setMovementRangeDescription(e.target.value)}
                      placeholder="Describe the permitted movement boundary for this patient…"
                      rows={2}
                      className="w-full rounded-xl border border-white/12 bg-[#0b1e38] px-3 py-2 text-xs text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                    />
                  </label>
                )}
              </fieldset>

              <ToggleGroup
                legend="Caregiver supervision requirement"
                columns={2}
                value={caregiverSupervisionRequirement}
                onChange={setCaregiverSupervisionRequirement}
                options={CAREGIVER_SUPERVISION_REQUIREMENTS.map((r) => ({
                  value: r,
                  label: CAREGIVER_SUPERVISION_LABELS[r],
                }))}
              />

              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
                  Patient-specific stop criteria
                </legend>
                <div className="space-y-2">
                  {stopCriteria.map((item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2"
                    >
                      <p className="flex-1 text-xs text-white/70">{item}</p>
                      <button
                        type="button"
                        onClick={() => removeStopCriterion(index)}
                        aria-label={`Remove stop criterion: ${item}`}
                        className="text-[11px] font-semibold text-rose-300/80 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <span className="sr-only">Add a patient-specific stop criterion</span>
                      <input
                        type="text"
                        value={stopCriteriaDraft}
                        onChange={(e) => setStopCriteriaDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addStopCriterion();
                          }
                        }}
                        placeholder="Add a stop criterion…"
                        className="w-full rounded-xl border border-white/12 bg-[#0b1e38] px-3 py-2 text-xs text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={addStopCriterion}
                      disabled={!stopCriteriaDraft.trim()}
                      className="shrink-0 rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                    >
                      Add
                    </button>
                  </div>
                  {stopCriteria.length === 0 && (
                    <label className="flex items-center gap-2 text-xs text-white/50">
                      <input
                        type="checkbox"
                        checked={noStopCriteriaConfirmed}
                        onChange={(e) => setNoStopCriteriaConfirmed(e.target.checked)}
                        className="h-4 w-4 rounded border-white/20 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                      />
                      No additional stop criteria for this patient.
                    </label>
                  )}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
                  Target placement
                </legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-white/40">Direction</span>
                    <input
                      type="text"
                      value={targetDirection}
                      onChange={(e) => setTargetDirection(e.target.value)}
                      placeholder="e.g. forward"
                      className="w-full rounded-xl border border-white/12 bg-[#0b1e38] px-3 py-2 text-xs text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-white/40">Height</span>
                    <input
                      type="text"
                      value={targetHeight}
                      onChange={(e) => setTargetHeight(e.target.value)}
                      placeholder="e.g. shoulder height"
                      className="w-full rounded-xl border border-white/12 bg-[#0b1e38] px-3 py-2 text-xs text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-white/40">Distance</span>
                    <input
                      type="text"
                      value={targetDistance}
                      onChange={(e) => setTargetDistance(e.target.value)}
                      placeholder="e.g. arm's length"
                      className="w-full rounded-xl border border-white/12 bg-[#0b1e38] px-3 py-2 text-xs text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                    />
                  </label>
                </div>
              </fieldset>

              <label className="block">
                <span className="mb-1 block text-[11px] text-white/40">Rest period (seconds)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={restPeriodSeconds}
                  onChange={(e) => setRestPeriodSeconds(e.target.value)}
                  placeholder="e.g. 30"
                  className="w-full max-w-[140px] rounded-xl border border-white/12 bg-[#0b1e38] px-3 py-2 text-xs text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                />
              </label>

              <label className="flex items-start gap-2.5 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-white/60">
                <input
                  type="checkbox"
                  checked={taskEligibilityConfirmed}
                  onChange={(e) => setTaskEligibilityConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                />
                I confirm this task is clinically eligible for this patient.
              </label>

              {submitError && (
                <div
                  role="alert"
                  className="rounded-2xl border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-xs leading-5 text-rose-200"
                >
                  {submitError}
                </div>
              )}

              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmit}
                className="w-full rounded-2xl bg-cyan-400 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
              >
                {submitting ? "Assigning…" : "Assign Forward Reach"}
              </button>
              {!canSubmit && !submitting && (
                <p role="status" className="text-center text-[11px] text-white/35">
                  Select all required fields above to enable assignment.
                </p>
              )}
            </div>
          ) : (
            // ── Created state ──
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-2xl border border-lime-300/25 bg-lime-400/8 px-4 py-3">
                <svg className="h-5 w-5 shrink-0 text-lime-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-lime-300">Assignment created</p>
                  <p className="text-xs text-white/50">
                    Forward Reach · 1 attempt · Expires {new Date(created.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
                  Patient access link
                </p>
                <div className="flex items-center gap-2 rounded-2xl border border-white/12 bg-[#0b1e38] px-4 py-3">
                  <p className="flex-1 truncate text-xs text-cyan-300 font-mono">{link}</p>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 ${
                      copied
                        ? "bg-lime-400/15 text-lime-300"
                        : "bg-cyan-400/15 text-cyan-300 hover:bg-cyan-400/25"
                    }`}
                  >
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.06] px-4 py-3 text-xs leading-5 text-amber-200/80">
                This link should be shared only with {patientName}. It grants direct access to
                this assignment and is shown only once — it is not saved anywhere in this
                application after you close this dialog.
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-1 rounded-2xl bg-cyan-400 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                >
                  {copied ? "Copied!" : "Copy Link"}
                </button>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-white/12 bg-white/5 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                >
                  Open patient page
                </a>
                <button
                  type="button"
                  onClick={() => {
                    onCreated(created);
                    onClose();
                  }}
                  className="rounded-2xl border border-white/12 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
