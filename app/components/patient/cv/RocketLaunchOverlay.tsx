"use client";

import { useEffect, useState } from "react";
import type { SitToStandTrackingQuality } from "@/app/lib/cv/sit-to-stand-detector";
import { formatHudMmSs } from "@/app/components/patient/cv/CameraHUD";

export type RocketLaunchOverlayProps = {
  repCount: number;
  target?: number;
  standPhase: string;
  lastRepAccepted: boolean;
  trackingQuality: SitToStandTrackingQuality | null;
  sessionSeconds: number;
  isRtl?: boolean;
};

const REP_FLASH_MS = 1_500;

const SIGNAL_DOT_CLASS: Record<SitToStandTrackingQuality | "none", string> = {
  good: "bg-[#1D9E75]",
  fair: "bg-amber-400",
  poor: "bg-orange-500",
  none: "bg-[#9CA3AF]",
};

/** Parse prescribed dose reps into a numeric HUD target (first positive integer). */
export function parsePrescribedRepsTarget(
  reps: number | string | undefined,
): number | undefined {
  if (typeof reps === "number" && Number.isFinite(reps) && reps > 0) {
    return Math.floor(reps);
  }
  if (typeof reps === "string") {
    const match = reps.trim().match(/(\d+)/);
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      return parsed > 0 ? parsed : undefined;
    }
  }
  return undefined;
}

/** Rocket vertical position (0 = pad, 100 = apex) from detector stand phase. */
export function resolveRocketAltitudePercent(standPhase: string): number {
  if (standPhase === "up") return 72;
  if (standPhase === "down") return 8;
  return 36;
}

/** Fuel gauge fill (0–100) from hip tracking quality — presentation only. */
export function resolveRocketFuelPercent(
  trackingQuality: SitToStandTrackingQuality | null,
): number {
  if (trackingQuality === "good") return 100;
  if (trackingQuality === "fair") return 58;
  if (trackingQuality === "poor") return 24;
  return 12;
}

export function rocketOverlayCopy(isRtl: boolean) {
  return {
    trackingLabel: isRtl ? "التتبّع" : "Tracking",
    repRecorded: isRtl ? "تم تسجيل التكرار ✓" : "Rep recorded ✓",
    reps: (n: number) => (isRtl ? `${n} تكرارات` : `${n} reps`),
    targetReps: (current: number, goal: number) =>
      isRtl ? `${current} / ${goal} تكرارات` : `${current} / ${goal} reps`,
    fuelLabel: isRtl ? "الوقود" : "Fuel",
    launchPad: isRtl ? "منصة الإطلاق" : "Launch pad",
    standing: isRtl ? "واقف" : "Standing",
    seated: isRtl ? "جالس" : "Seated",
  };
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function resolvePhaseLabel(standPhase: string, copy: ReturnType<typeof rocketOverlayCopy>): string {
  if (standPhase === "up") return copy.standing;
  if (standPhase === "down") return copy.seated;
  return copy.launchPad;
}

export function RocketLaunchOverlay({
  repCount,
  target,
  standPhase,
  lastRepAccepted,
  trackingQuality,
  sessionSeconds,
  isRtl = false,
}: RocketLaunchOverlayProps) {
  const copy = rocketOverlayCopy(isRtl);
  const reducedMotion = usePrefersReducedMotion();
  const [showRepFlash, setShowRepFlash] = useState(false);
  const [prevRepAccepted, setPrevRepAccepted] = useState(lastRepAccepted);

  const trackingSignal = trackingQuality ?? "none";
  const altitude = resolveRocketAltitudePercent(standPhase);
  const fuelPercent = resolveRocketFuelPercent(trackingQuality);
  const phaseLabel = resolvePhaseLabel(standPhase, copy);
  const targetLabel =
    target != null && target > 0 ? copy.targetReps(repCount, target) : copy.reps(repCount);

  if (lastRepAccepted !== prevRepAccepted) {
    setPrevRepAccepted(lastRepAccepted);
    if (lastRepAccepted) {
      setShowRepFlash(true);
    }
  }

  useEffect(() => {
    if (!lastRepAccepted) return undefined;
    const id = window.setTimeout(() => setShowRepFlash(false), REP_FLASH_MS);
    return () => window.clearTimeout(id);
  }, [lastRepAccepted]);

  const rocketTransitionClass = reducedMotion
    ? ""
    : "transition-transform duration-500 ease-out";

  const fuelTransitionClass = reducedMotion ? "" : "transition-all duration-300 ease-out";

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

      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-2">
        <div className="relative h-[120px] w-full max-w-[140px]">
          <div className="absolute bottom-0 left-1/2 h-2 w-16 -translate-x-1/2 rounded-full bg-white/25" />
          <div className="absolute bottom-1 left-1/2 h-1 w-20 -translate-x-1/2 rounded-full bg-[#1D9E75]/40" />

          <div
            className={`absolute left-1/2 bottom-3 ${rocketTransitionClass}`}
            style={{
              transform: `translateX(-50%) translateY(-${Math.round((altitude / 100) * 88)}px)`,
            }}
          >
            <svg
              width="40"
              height="64"
              viewBox="0 0 40 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <path
                d="M20 4 L28 28 L24 28 L26 52 L20 48 L14 52 L16 28 L12 28 Z"
                fill="#F8FAFC"
                stroke="#CBD5E1"
                strokeWidth="1"
              />
              <circle cx="20" cy="22" r="5" fill="#1D9E75" fillOpacity="0.85" />
              <path d="M12 52 L8 58 L16 54 Z" fill="#94A3B8" />
              <path d="M28 52 L32 58 L24 54 Z" fill="#94A3B8" />
              {!reducedMotion && standPhase === "up" ? (
                <path
                  d="M16 54 Q20 62 24 54"
                  stroke="#F59E0B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="rocket-launch-flame"
                />
              ) : null}
            </svg>
          </div>
        </div>

        <div className="w-full max-w-[180px] rounded-[6px] bg-black/45 px-3 py-2 backdrop-blur-[2px]">
          <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-white/80">
            <span>{copy.fuelLabel}</span>
            <span>{phaseLabel}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-[#1D9E75] to-[#34D399] ${fuelTransitionClass}`}
              style={{ width: `${fuelPercent}%` }}
            />
          </div>
        </div>
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
            {targetLabel}
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes rocketFlameFlicker {
          0%,
          100% {
            opacity: 0.65;
            transform: scaleY(0.9);
          }
          50% {
            opacity: 1;
            transform: scaleY(1.1);
          }
        }
        .rocket-launch-flame {
          transform-origin: center top;
          animation: rocketFlameFlicker 0.45s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .rocket-launch-flame {
            animation: none;
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
}
