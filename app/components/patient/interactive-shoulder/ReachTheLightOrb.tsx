"use client";

import type { TherapeuticTarget } from "@/app/lib/interactive-shoulder/types";

type ReachTheLightOrbProps = {
  target: TherapeuticTarget;
  phase: "active" | "exiting" | "hit";
  reducedMotion?: boolean;
};

export function ReachTheLightOrb({ target, phase, reducedMotion = false }: ReachTheLightOrbProps) {
  const motionClass = reducedMotion
    ? ""
    : phase === "active"
      ? "motion-safe:animate-[reach-light-pulse_2.4s_ease-in-out_infinite]"
      : phase === "exiting"
        ? "motion-safe:animate-[reach-light-exit_480ms_ease-in_forwards]"
        : "motion-safe:animate-[reach-light-hit_420ms_ease-out_forwards]";

  return (
    <div
      className={`pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 ${motionClass}`}
      style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%` }}
      aria-hidden
    >
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full bg-[#5DCAA5]/20 blur-xl" />
        <div className="absolute inset-1 rounded-full border border-[#5DCAA5]/50 bg-[#1D9E75]/25 shadow-[0_0_28px_rgba(93,202,165,0.55)]" />
        <div className="absolute inset-3 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.95)_0%,rgba(93,202,165,0.85)_45%,rgba(29,158,117,0.2)_100%)] shadow-[0_0_18px_rgba(255,255,255,0.65)]" />
        <div className="absolute inset-[42%] rounded-full bg-white/90 blur-[1px]" />
      </div>
    </div>
  );
}
