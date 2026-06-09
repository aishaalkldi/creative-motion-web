"use client";

import { useEffect, useRef, useState } from "react";

export type CameraHudMode = "reps" | "cycles" | "reach" | "hold";
export type CameraHudTrackingSignal = "good" | "fair" | "poor" | "none";

export type CameraHUDProps = {
  mode: CameraHudMode;
  count: number;
  target?: number;
  trackingSignal: CameraHudTrackingSignal;
  sessionSeconds: number;
  holdSeconds?: number;
  lastRepAccepted: boolean;
  isRtl?: boolean;
};

const REP_FLASH_MS = 1_500;

const SIGNAL_DOT_CLASS: Record<CameraHudTrackingSignal, string> = {
  good: "bg-[#1D9E75]",
  fair: "bg-amber-400",
  poor: "bg-orange-500",
  none: "bg-[#9CA3AF]",
};

export function formatHudMmSs(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function hudCopy(isRtl: boolean) {
  return {
    trackingLabel: isRtl ? "التتبّع" : "Tracking",
    repRecorded: isRtl ? "تم تسجيل التكرار ✓" : "Rep recorded ✓",
    reps: (n: number) => (isRtl ? `${n} تكرارات` : `${n} reps`),
    cycles: (n: number) => (isRtl ? `${n} دورات` : `${n} cycles`),
    reaches: (n: number) => (isRtl ? `${n} وصولات` : `${n} reaches`),
    hold: (formatted: string) => (isRtl ? `ثبات ${formatted}` : `Hold ${formatted}`),
    targetReps: (current: number, goal: number) =>
      isRtl ? `${current} / ${goal} تكرارات` : `${current} / ${goal} reps`,
    targetCycles: (current: number, goal: number) =>
      isRtl ? `${current} / ${goal} دورات` : `${current} / ${goal} cycles`,
    targetReaches: (current: number, goal: number) =>
      isRtl ? `${current} / ${goal} وصولات` : `${current} / ${goal} reaches`,
  };
}

function resolvePrimaryCountLabel(
  mode: CameraHudMode,
  count: number,
  holdSeconds: number | undefined,
  sessionSeconds: number,
  copy: ReturnType<typeof hudCopy>,
): string {
  if (mode === "hold") {
    const seconds = holdSeconds ?? sessionSeconds;
    return copy.hold(formatHudMmSs(seconds));
  }
  if (mode === "cycles") return copy.cycles(count);
  if (mode === "reach") return copy.reaches(count);
  return copy.reps(count);
}

function resolveTargetLabel(
  mode: CameraHudMode,
  count: number,
  target: number,
  copy: ReturnType<typeof hudCopy>,
): string | null {
  if (mode === "hold") return null;
  if (mode === "cycles") return copy.targetCycles(count, target);
  if (mode === "reach") return copy.targetReaches(count, target);
  return copy.targetReps(count, target);
}

export function CameraHUD({
  mode,
  count,
  target,
  trackingSignal,
  sessionSeconds,
  holdSeconds,
  lastRepAccepted,
  isRtl = false,
}: CameraHUDProps) {
  const copy = hudCopy(isRtl);
  const [showRepFlash, setShowRepFlash] = useState(false);
  const prevRepAcceptedRef = useRef(false);

  useEffect(() => {
    if (lastRepAccepted && !prevRepAcceptedRef.current) {
      setShowRepFlash(true);
      const id = window.setTimeout(() => setShowRepFlash(false), REP_FLASH_MS);
      prevRepAcceptedRef.current = true;
      return () => window.clearTimeout(id);
    }
    if (!lastRepAccepted) {
      prevRepAcceptedRef.current = false;
    }
    return undefined;
  }, [lastRepAccepted]);

  const primaryLabel = resolvePrimaryCountLabel(mode, count, holdSeconds, sessionSeconds, copy);
  const targetLabel =
    target != null && target > 0 ? resolveTargetLabel(mode, count, target, copy) : null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3"
      dir={isRtl ? "rtl" : "ltr"}
      aria-hidden
    >
      <div className="flex items-center justify-between gap-2 rounded-[6px] bg-black/55 px-2.5 py-1.5 backdrop-blur-[2px]">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${SIGNAL_DOT_CLASS[trackingSignal]}`}
            aria-hidden
          />
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-white/90">
            {copy.trackingLabel}
          </span>
        </div>
        <span
          className="shrink-0 text-[13px] font-bold tabular-nums text-white"
          style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
        >
          {formatHudMmSs(sessionSeconds)}
        </span>
      </div>

      <div className="flex flex-col items-center gap-1 pb-1">
        {showRepFlash ? (
          <div
            className="rounded-[6px] bg-[#1D9E75]/90 px-3 py-1.5 text-[12px] font-bold text-white shadow-sm"
            role="status"
            aria-live="polite"
          >
            {copy.repRecorded}
          </div>
        ) : null}

        <div className="rounded-[8px] bg-black/50 px-4 py-2 text-center backdrop-blur-[2px]">
          <p
            className="text-[28px] font-bold leading-none text-white"
            style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
          >
            {primaryLabel}
          </p>
          {targetLabel ? (
            <p className="mt-1 text-[13px] font-medium text-white/85">{targetLabel}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
