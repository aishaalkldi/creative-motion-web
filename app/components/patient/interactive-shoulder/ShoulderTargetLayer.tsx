"use client";

import type { TherapeuticTarget } from "@/app/lib/interactive-shoulder/types";

type ShoulderTargetLayerProps = {
  target: TherapeuticTarget | null;
  highlight?: boolean;
};

export function ShoulderTargetLayer({ target, highlight = false }: ShoulderTargetLayerProps) {
  if (!target) return null;
  return (
    <div
      className={`pointer-events-none absolute z-10 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-transform duration-300 ${
        highlight
          ? "scale-110 border-[#5DCAA5] bg-[#1D9E75]/35 shadow-[0_0_24px_rgba(93,202,165,0.85)]"
          : "border-[#5DCAA5]/80 bg-[#1D9E75]/20 shadow-[0_0_18px_rgba(29,158,117,0.55)] animate-pulse"
      }`}
      style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%` }}
      aria-hidden
    >
      <div className="absolute inset-2 rounded-full bg-[#1D9E75]/25" />
    </div>
  );
}
