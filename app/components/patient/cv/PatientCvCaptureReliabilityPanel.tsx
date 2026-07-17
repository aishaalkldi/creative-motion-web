"use client";

import type { PatientCvCaptureReliabilityState } from "@/app/lib/cv/patient-cv-capture-reliability";
import type {
  StsAttemptType,
  StsCapturePhase,
} from "@/app/lib/cv/sts-biomechanical-capture-fsm";

/** Tracking observability foundation: STS-only, optional — raw internal reason text, debug use only. */
type StsAttemptDebugInfo = {
  capturePhase?: StsCapturePhase;
  calibrationProgressPct: number | null;
  lastAttemptType: StsAttemptType | null;
  lastAttemptReason: string | null;
};

type PatientCvCaptureReliabilityPanelProps = {
  state: PatientCvCaptureReliabilityState;
  stsAttemptDebug?: StsAttemptDebugInfo;
};

function BoolLine({ label, value }: { label: string; value: boolean }) {
  return (
    <p>
      {label}:{" "}
      <span className={value ? "text-[#5DCAA5]" : "text-[#F59E0B]"}>
        {value ? "yes" : "no"}
      </span>
    </p>
  );
}

export function PatientCvCaptureReliabilityPanel({
  state,
  stsAttemptDebug,
}: PatientCvCaptureReliabilityPanelProps) {
  return (
    <div className="mt-2 rounded-[6px] border border-dashed border-[#6B7280] bg-[#0A0F1A] px-3 py-2 font-mono text-[10px] leading-relaxed text-[#E5E7EB]">
      <p className="font-bold text-[#5DCAA5]">Capture reliability (?cvDebug=1)</p>
      <BoolLine label="Camera active" value={state.cameraActive} />
      <BoolLine label="Pose detected" value={state.poseDetected} />
      <BoolLine label="Tracking confirmed" value={state.trackingConfirmed} />
      <BoolLine label="Timeline recording" value={state.timelineRecording} />
      <p>Snapshot count: {state.snapshotCount}</p>
      <p>Detector phase: {state.detectorPhase}</p>
      <p>Required joints visible: {state.requiredJointsVisiblePct}%</p>
      <p>Rep/cycle count: {state.repOrCycleCount}</p>
      <p>Last movement event: {state.lastMovementEvent}</p>
      {stsAttemptDebug ? (
        <>
          <p className="mt-1.5 font-bold text-[#5DCAA5]">STS capture (raw)</p>
          <p>Capture phase: {stsAttemptDebug.capturePhase ?? "—"}</p>
          <p>
            Calibration progress:{" "}
            {stsAttemptDebug.calibrationProgressPct === null
              ? "—"
              : `${stsAttemptDebug.calibrationProgressPct}%`}
          </p>
          <p>Last attempt type: {stsAttemptDebug.lastAttemptType ?? "—"}</p>
          <p>Last attempt reason (raw): {stsAttemptDebug.lastAttemptReason ?? "—"}</p>
        </>
      ) : null}
    </div>
  );
}
