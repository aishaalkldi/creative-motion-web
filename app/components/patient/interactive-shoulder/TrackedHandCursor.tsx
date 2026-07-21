"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { NormalizedPoint } from "@/app/lib/interactive-shoulder/types";

type TrackedHandCursorProps = {
  wrist: NormalizedPoint | null;
  visible: boolean;
  reducedMotion?: boolean;
};

const TRAIL_LENGTH = 4;

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

export function TrackedHandCursor({
  wrist,
  visible,
  reducedMotion = false,
}: TrackedHandCursorProps) {
  const [displayWrist, setDisplayWrist] = useState<NormalizedPoint | null>(wrist);
  const trailRef = useRef<NormalizedPoint[]>([]);
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!wrist) {
      setDisplayWrist(null);
      trailRef.current = [];
      return;
    }
    if (reducedMotion) {
      setDisplayWrist(wrist);
      trailRef.current = [wrist];
      return;
    }
    setDisplayWrist((previous) => {
      if (!previous) return wrist;
      return {
        x: lerp(previous.x, wrist.x, 0.42),
        y: lerp(previous.y, wrist.y, 0.42),
      };
    });
    trailRef.current = [wrist, ...trailRef.current].slice(0, TRAIL_LENGTH);
    forceRender((value) => value + 1);
  }, [reducedMotion, wrist]);

  const trail = useMemo(() => trailRef.current, [displayWrist, wrist]);

  if (!visible || !displayWrist) return null;

  return (
    <>
      {!reducedMotion
        ? trail.slice(1).map((point, index) => (
            <div
              key={`${point.x}-${point.y}-${index}`}
              className="pointer-events-none absolute z-[18] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#5DCAA5]/25 blur-[1px]"
              style={{
                left: `${point.x * 100}%`,
                top: `${point.y * 100}%`,
                opacity: 0.45 - index * 0.08,
              }}
              aria-hidden
            />
          ))
        : null}
      <div
        className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${displayWrist.x * 100}%`, top: `${displayWrist.y * 100}%` }}
        aria-hidden
      >
        <div className="absolute -inset-2 rounded-full bg-[#5DCAA5]/25 blur-md motion-safe:animate-pulse" />
        <div className="relative h-5 w-5 rounded-full border-2 border-white/90 bg-[#1D9E75]/85 shadow-[0_0_14px_rgba(93,202,165,0.75)]" />
      </div>
    </>
  );
}
