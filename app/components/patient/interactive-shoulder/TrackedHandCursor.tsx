"use client";

import type { NormalizedPoint } from "@/app/lib/interactive-shoulder/types";

type TrackedHandCursorProps = {
  wrist: NormalizedPoint | null;
  visible: boolean;
};

export function TrackedHandCursor({ wrist, visible }: TrackedHandCursorProps) {
  if (!visible || !wrist) return null;
  return (
    <div
      className="pointer-events-none absolute z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 bg-[#1D9E75]/80 shadow-[0_0_12px_rgba(29,158,117,0.65)]"
      style={{ left: `${wrist.x * 100}%`, top: `${wrist.y * 100}%` }}
      aria-hidden
    />
  );
}
