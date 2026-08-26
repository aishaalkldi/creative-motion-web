"use client";

import { useState } from "react";
import {
  buildForwardReachAssignmentRequest,
  EMPTY_FORWARD_REACH_SETUP_FORM,
  type ForwardReachSetupFormState,
} from "@/app/lib/upper-limb-motor-screen/forward-reach-assignment-request";
import {
  AFFECTED_ARM_SUPPORT_LEVELS,
  BACK_TRUNK_SUPPORT_LEVELS,
  CAREGIVER_SUPERVISION_REQUIREMENTS,
  STARTING_SITTING_POSITIONS,
  UPPER_LIMB_SIDES,
} from "@/app/lib/upper-limb-motor-screen/types";

/** Syntactically valid placeholder only, used to pre-check form completeness locally — never sent anywhere. */
const FORM_COMPLETENESS_PROBE_PATIENT_ID = "00000000-0000-4000-8000-000000000000";

export type ForwardReachSetupFormProps = {
  onStart: (form: ForwardReachSetupFormState) => void;
  disabled?: boolean;
};

export function ForwardReachSetupForm({ onStart, disabled = false }: ForwardReachSetupFormProps) {
  const [form, setForm] = useState<ForwardReachSetupFormState>(EMPTY_FORWARD_REACH_SETUP_FORM);
  const [stopCriteriaText, setStopCriteriaText] = useState("");

  const completeness = buildForwardReachAssignmentRequest(FORM_COMPLETENESS_PROBE_PATIENT_ID, form);
  const isComplete = completeness.ok;

  function update<K extends keyof ForwardReachSetupFormState>(key: K, value: ForwardReachSetupFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleStopCriteriaBlur() {
    const items = stopCriteriaText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    update("patientSpecificStopCriteria", items);
  }

  return (
    <div className="rounded-xl border border-[#1E2D42] bg-[#0F1825] p-6 space-y-5">
      <div>
        <h3 className="text-base font-semibold text-white">Forward Reach — session setup</h3>
        <p className="mt-1 text-xs text-white/50">
          Every field below is required before a session can start. Nothing is pre-filled.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Affected side">
          <SideToggle value={form.affectedSide} onChange={(v) => update("affectedSide", v)} />
        </Field>

        <Field label="Tested side" hint="Independent of affected side">
          <SideToggle value={form.testedSide} onChange={(v) => update("testedSide", v)} />
        </Field>

        <Field label="Starting sitting position">
          <Select
            value={form.startingSittingPosition ?? ""}
            options={STARTING_SITTING_POSITIONS}
            onChange={(v) => update("startingSittingPosition", v as ForwardReachSetupFormState["startingSittingPosition"])}
          />
        </Field>

        <Field label="Back/trunk support">
          <Select
            value={form.backTrunkSupport ?? ""}
            options={BACK_TRUNK_SUPPORT_LEVELS}
            onChange={(v) => update("backTrunkSupport", v as ForwardReachSetupFormState["backTrunkSupport"])}
          />
        </Field>

        <Field label="Affected arm support">
          <Select
            value={form.affectedArmSupport ?? ""}
            options={AFFECTED_ARM_SUPPORT_LEVELS}
            onChange={(v) => update("affectedArmSupport", v as ForwardReachSetupFormState["affectedArmSupport"])}
          />
        </Field>

        <Field label="Baseline pain score (0-10)">
          <input
            type="number"
            min={0}
            max={10}
            step={1}
            value={form.baselinePainScore ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              update("baselinePainScore", raw === "" ? null : Number(raw));
            }}
            className="w-full rounded-lg border border-[#1E2D42] bg-[#0B1220] px-3 py-2 text-sm text-white"
          />
        </Field>

        <Field label="Caregiver supervision requirement">
          <Select
            value={form.caregiverSupervisionRequirement ?? ""}
            options={CAREGIVER_SUPERVISION_REQUIREMENTS}
            onChange={(v) =>
              update(
                "caregiverSupervisionRequirement",
                v as ForwardReachSetupFormState["caregiverSupervisionRequirement"],
              )
            }
          />
        </Field>
      </div>

      <Field label="Permitted movement range">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input
              type="radio"
              checked={form.permittedMovementRange?.kind === "not_applicable"}
              onChange={() => update("permittedMovementRange", { kind: "not_applicable" })}
            />
            Not applicable
          </label>
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input
              type="radio"
              checked={form.permittedMovementRange?.kind === "configured"}
              onChange={() => update("permittedMovementRange", { kind: "configured", clinicianDescription: "" })}
            />
            Configured
          </label>
          {form.permittedMovementRange?.kind === "configured" && (
            <input
              type="text"
              placeholder="Describe the permitted movement range"
              value={form.permittedMovementRange.clinicianDescription}
              onChange={(e) =>
                update("permittedMovementRange", { kind: "configured", clinicianDescription: e.target.value })
              }
              className="rounded-lg border border-[#1E2D42] bg-[#0B1220] px-3 py-2 text-sm text-white"
            />
          )}
        </div>
      </Field>

      <Field label="Patient-specific stop criteria" hint="One per line — may be left empty, but the choice must be explicit">
        <textarea
          value={stopCriteriaText}
          onChange={(e) => setStopCriteriaText(e.target.value)}
          onBlur={handleStopCriteriaBlur}
          rows={2}
          className="w-full rounded-lg border border-[#1E2D42] bg-[#0B1220] px-3 py-2 text-sm text-white"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Target direction">
          <input
            type="text"
            value={form.targetDirection}
            onChange={(e) => update("targetDirection", e.target.value)}
            className="w-full rounded-lg border border-[#1E2D42] bg-[#0B1220] px-3 py-2 text-sm text-white"
          />
        </Field>
        <Field label="Target height">
          <input
            type="text"
            value={form.targetHeight}
            onChange={(e) => update("targetHeight", e.target.value)}
            className="w-full rounded-lg border border-[#1E2D42] bg-[#0B1220] px-3 py-2 text-sm text-white"
          />
        </Field>
        <Field label="Target distance">
          <input
            type="text"
            value={form.targetDistance}
            onChange={(e) => update("targetDistance", e.target.value)}
            className="w-full rounded-lg border border-[#1E2D42] bg-[#0B1220] px-3 py-2 text-sm text-white"
          />
        </Field>
      </div>

      <button
        type="button"
        disabled={!isComplete || disabled}
        onClick={() => onStart(form)}
        className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Start session
      </button>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-white/70">{label}</label>
      {hint && <p className="mb-1 text-[11px] text-white/40">{hint}</p>}
      {children}
    </div>
  );
}

function SideToggle({
  value,
  onChange,
}: {
  value: "left" | "right" | null;
  onChange: (value: "left" | "right") => void;
}) {
  return (
    <div className="flex gap-2">
      {UPPER_LIMB_SIDES.map((side) => (
        <button
          key={side}
          type="button"
          onClick={() => onChange(side)}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold capitalize transition ${
            value === side
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
              : "border-[#1E2D42] bg-[#0B1220] text-white/50 hover:text-white/70"
          }`}
        >
          {side}
        </button>
      ))}
    </div>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-[#1E2D42] bg-[#0B1220] px-3 py-2 text-sm text-white"
    >
      <option value="" disabled>
        Select…
      </option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
