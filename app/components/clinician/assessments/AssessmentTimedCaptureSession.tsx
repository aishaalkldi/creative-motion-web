"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatSitToStandDuration } from "@/app/lib/cv/sit-to-stand-detector";

export type AssessmentTimedCaptureSessionProps = {
  title: string;
  instructions: string[];
  consentIntro: string;
  exerciseId: string;
  startButtonLabel?: string;
  stopButtonLabel?: string;
  primaryMetricLabel?: string;
  onSessionSaved?: () => void;
};

export function AssessmentTimedCaptureSession({
  title,
  instructions,
  consentIntro,
  exerciseId,
  startButtonLabel = "Start timed task",
  stopButtonLabel = "Stop and save time",
  primaryMetricLabel = "Task duration",
  onSessionSaved,
}: AssessmentTimedCaptureSessionProps) {
  const [consented, setConsented] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsedS, setElapsedS] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const startMsRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const onSessionSavedRef = useRef(onSessionSaved);
  onSessionSavedRef.current = onSessionSaved;

  useEffect(() => {
    return () => {
      if (tickRef.current !== null) window.clearInterval(tickRef.current);
    };
  }, []);

  const saveTimedObservation = useCallback(
    async (durationS: number) => {
      setSaveStatus("saving");
      try {
        const res = await fetch("/api/cv/session-metrics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exerciseId,
            repCount: 0,
            sessionDurationS: durationS,
            trackingQuality: "unknown",
            movementDetected: true,
            framesWithPose: 0,
            framesTotal: 0,
            source: "assessment_movement",
          }),
        });
        if (!res.ok) {
          setSaveStatus("error");
          return;
        }
        setSaveStatus("saved");
        onSessionSavedRef.current?.();
      } catch {
        setSaveStatus("error");
      }
    },
    [exerciseId],
  );

  const handleStart = () => {
    if (running) return;
    startMsRef.current = performance.now();
    setRunning(true);
    setSaveStatus("idle");
    setElapsedS(0);
    tickRef.current = window.setInterval(() => {
      if (startMsRef.current === null) return;
      setElapsedS(Math.floor((performance.now() - startMsRef.current) / 1_000));
    }, 250);
  };

  const handleStop = () => {
    if (!running || startMsRef.current === null) return;
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    const durationS = Math.max(1, Math.floor((performance.now() - startMsRef.current) / 1_000));
    startMsRef.current = null;
    setRunning(false);
    setElapsedS(durationS);
    void saveTimedObservation(durationS);
  };

  if (!consented) {
    return (
      <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <p className="mt-2 text-xs leading-relaxed text-white/45">{consentIntro}</p>
        <ul className="mt-3 list-disc space-y-1 pl-4 text-xs leading-relaxed text-white/45">
          {instructions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-amber-200/90">
          Therapist review required. Timed observations are assistive only — not diagnostic.
        </p>
        <button
          type="button"
          onClick={() => setConsented(true)}
          className="mt-4 w-full rounded-[7px] bg-[#1D9E75] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#179165]"
        >
          I understand — start timed task
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!running ? (
        <button
          type="button"
          onClick={handleStart}
          className="rounded-[7px] bg-[#1D9E75] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#179165]"
        >
          {startButtonLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleStop}
          className="rounded-[7px] border border-[#1E2D42] bg-transparent px-4 py-2 text-sm font-semibold text-[#9CA3AF] transition hover:text-white"
        >
          {stopButtonLabel}
        </button>
      )}

      <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-4">
        <p className="text-xs text-[#F9FAFB]">
          {running
            ? "Timer running — patient performs sit-to-stand, walk, turn, and return."
            : "Press start when the patient begins the Timed Up and Go task."}
        </p>
        <p className="mt-2 font-mono text-[28px] font-bold text-[#1D9E75]">
          {primaryMetricLabel}: {formatSitToStandDuration(elapsedS)}
        </p>
        {saveStatus === "saved" && (
          <p className="mt-2 text-xs text-[#1D9E75]">Timed observation saved for therapist review.</p>
        )}
        {saveStatus === "error" && (
          <p className="mt-2 text-xs text-rose-300">Could not save timed observation.</p>
        )}
      </div>
    </div>
  );
}
