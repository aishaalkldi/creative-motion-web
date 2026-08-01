"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AFFECTED_ARM_SUPPORT_LABELS,
  BACK_TRUNK_SUPPORT_LABELS,
  getForwardReachAssignmentByToken,
  STARTING_SITTING_POSITION_LABELS,
  UPPER_LIMB_DELIVERY_MODE_LABELS,
  UPPER_LIMB_SIDE_LABELS,
} from "../../../lib/api/upper-limb-motor-screen";
import type { PatientMotorScreenAssignmentView } from "../../../lib/upper-limb-motor-screen-api/request-validation";

type ViewState =
  | { kind: "loading" }
  | { kind: "invalid_or_expired" }
  | { kind: "server_error" }
  | { kind: "ready"; assignment: PatientMotorScreenAssignmentView };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center bg-[#080E14] px-6 py-12"
      style={{ fontFamily: "var(--font-inter, ui-sans-serif, sans-serif)" }}
    >
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}

function BrandHeader() {
  return (
    <div className="mb-8 flex flex-col items-center text-center">
      <svg width="44" height="44" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 2C5.582 2 2 5.582 2 10s3.582 8 8 8" stroke="#1D9E75" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M10 5.5C7.515 5.5 5.5 7.515 5.5 10S7.515 14.5 10 14.5" stroke="#5DCAA5" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="10" cy="10" r="1.5" fill="#1D9E75" />
      </svg>
      <p
        className="mt-3 text-[13px] font-bold text-white"
        style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)", letterSpacing: "3px" }}
      >
        RASQ
      </p>
      <p className="mt-1 text-[15px] font-semibold text-white">Upper-Limb Motor Screen</p>
      <p className="mt-1 max-w-sm text-[11px] leading-4 text-[#6B7280]">
        Non-standardized, clinician assigned, CV supported, clinician reviewed.
      </p>
    </div>
  );
}

export function MotorScreenTokenClient() {
  const params = useParams();
  const token = typeof params?.token === "string" ? params.token : Array.isArray(params?.token) ? params.token[0] : "";

  const [state, setState] = useState<ViewState>(() =>
    token ? { kind: "loading" } : { kind: "invalid_or_expired" },
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    getForwardReachAssignmentByToken(token).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setState({ kind: result.kind });
        return;
      }
      setState({ kind: "ready", assignment: result.assignment });
    });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.kind === "loading") {
    return (
      <Shell>
        <BrandHeader />
        <p className="text-center text-sm text-white/50">Loading your assigned task…</p>
      </Shell>
    );
  }

  if (state.kind === "invalid_or_expired") {
    return (
      <Shell>
        <BrandHeader />
        <div className="rounded-2xl border border-[#1E2D42] bg-[#0B1220] px-6 py-8 text-center">
          <p className="text-[14px] text-[#6B7280]">This link is invalid or has expired.</p>
          <p className="mt-2 text-[12px] text-[#374151]">
            Contact your rehabilitation provider for a new access link.
          </p>
        </div>
      </Shell>
    );
  }

  if (state.kind === "server_error") {
    return (
      <Shell>
        <BrandHeader />
        <div className="rounded-2xl border border-[#1E2D42] bg-[#0B1220] px-6 py-8 text-center">
          <p className="text-[14px] text-[#6B7280]">
            We could not load this page right now.
          </p>
          <p className="mt-2 text-[12px] text-[#374151]">
            Please try again in a moment. If the problem continues, contact your rehabilitation
            provider.
          </p>
        </div>
      </Shell>
    );
  }

  const { assignment } = state;
  const group = assignment.taskAssignmentGroups[0];
  const { configuration } = assignment;
  const stopCriteria = configuration.patientSpecificStopCriteria;

  return (
    <Shell>
      <BrandHeader />

      <div className="space-y-4">
        <div className="rounded-2xl border border-[#1E2D42] bg-[#0F1825] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#5DCAA5]/80">
            Assigned task
          </p>
          <h1 className="mt-1 text-lg font-bold text-white">Forward Reach</h1>
          <p className="mt-1 text-xs text-white/50">1 assigned attempt</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[#1E2D42] bg-[#0F1825] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
              Affected side
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {UPPER_LIMB_SIDE_LABELS[assignment.affectedSide]}
            </p>
          </div>
          <div className="rounded-2xl border border-[#1E2D42] bg-[#0F1825] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
              Tested side
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {UPPER_LIMB_SIDE_LABELS[group.testedSide]}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#1E2D42] bg-[#0F1825] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
            Delivery mode
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {UPPER_LIMB_DELIVERY_MODE_LABELS[assignment.deliveryMode]}
          </p>
        </div>

        <div className="rounded-2xl border border-[#1E2D42] bg-[#0F1825] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
            What this task involves
          </p>
          <p className="mt-2 text-xs leading-5 text-white/70">
            You will be asked to reach {group.targetPlacement.direction} toward a target
            positioned at {group.targetPlacement.height}, {group.targetPlacement.distance} away,
            and then return to your starting position. This is done once (1 attempt).
          </p>
        </div>

        <div className="rounded-2xl border border-[#1E2D42] bg-[#0F1825] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
            Before you begin
          </p>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-white/70">
            <li>
              Sitting position: {STARTING_SITTING_POSITION_LABELS[configuration.startingSittingPosition]}
            </li>
            <li>Back / trunk support: {BACK_TRUNK_SUPPORT_LABELS[configuration.backTrunkSupport]}</li>
            <li>Arm support: {AFFECTED_ARM_SUPPORT_LABELS[configuration.affectedArmSupport]}</li>
            <li>Find a quiet, well-lit space where your full arm and shoulder are visible.</li>
          </ul>
        </div>

        {stopCriteria.length > 0 && (
          <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/80">
              Stop the task if
            </p>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-100/80">
              {stopCriteria.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-2xl border border-[#1D9E75]/20 bg-[#1D9E75]/[0.05] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5DCAA5]/80">
            Clinician supervision
          </p>
          <p className="mt-2 text-xs leading-5 text-white/70">
            {assignment.deliveryMode === "in_clinic"
              ? "This task must be completed in clinic, with your clinician present."
              : "This task must be completed remotely, with your clinician supervising."}
            {configuration.caregiverSupervisionRequirement === "required" &&
              " A caregiver must also be present and supervising before you begin."}
          </p>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-4 text-center">
          <p className="text-[11px] leading-5 text-white/40">
            Assessment execution will be enabled in the next integration stage.
          </p>
        </div>
      </div>
    </Shell>
  );
}
