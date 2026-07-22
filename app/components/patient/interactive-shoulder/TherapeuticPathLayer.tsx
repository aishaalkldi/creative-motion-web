"use client";

import type { ResolvedMotionPattern } from "@/app/lib/interactive-shoulder/motion-patterns/motion-pattern-types";
import {
  getPatternGuidePoint,
  type PatternLifecycleState,
} from "@/app/lib/interactive-shoulder/motion-patterns/pattern-lifecycle";
import { samplePathForRendering } from "@/app/lib/interactive-shoulder/motion-patterns/bezier-path";
import { HitParticleBurst } from "./HitParticleBurst";
import { ReachTheLightOrb } from "./ReachTheLightOrb";

type TherapeuticPathLayerProps = {
  pattern: ResolvedMotionPattern;
  lifecycle: PatternLifecycleState;
  hitBurstProgress?: number | null;
  reducedMotion?: boolean;
};

function pathToSvg(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return `M ${first!.x * 100} ${first!.y * 100} ${rest
    .map((point) => `L ${point.x * 100} ${point.y * 100}`)
    .join(" ")}`;
}

export function TherapeuticPathLayer({
  pattern,
  lifecycle,
  hitBurstProgress = null,
  reducedMotion = false,
}: TherapeuticPathLayerProps) {
  const renderPoints = samplePathForRendering(pattern.sampledPath, 18);
  const guidePoint = getPatternGuidePoint(pattern, lifecycle.pathProgress);
  const burstPoint =
    hitBurstProgress !== null ? getPatternGuidePoint(pattern, hitBurstProgress) : null;

  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 z-[8] h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="therapeutic-path-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(93,202,165,0.15)" />
            <stop offset="50%" stopColor="rgba(93,202,165,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.85)" />
          </linearGradient>
        </defs>
        <path
          d={pathToSvg(renderPoints)}
          fill="none"
          stroke="url(#therapeutic-path-gradient)"
          strokeWidth="0.65"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          opacity={0.9}
        />
        <path
          d={pathToSvg(
            renderPoints.slice(
              0,
              Math.max(2, Math.round(renderPoints.length * lifecycle.pathProgress)),
            ),
          )}
          fill="none"
          stroke="rgba(93,202,165,0.95)"
          strokeWidth="0.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <ReachTheLightOrb
        target={{
          id: `guide-${pattern.id}`,
          spawnedAtMs: lifecycle.startedAtMs ?? 0,
          ...guidePoint,
        }}
        phase={lifecycle.exitingProgress !== null ? "exiting" : "active"}
        reducedMotion={reducedMotion}
      />
      {burstPoint ? (
        <HitParticleBurst center={burstPoint} reducedMotion={reducedMotion} />
      ) : null}
    </>
  );
}
