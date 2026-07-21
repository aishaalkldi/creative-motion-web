"use client";

import type { NormalizedPoint } from "@/app/lib/interactive-shoulder/types";

type HitParticleBurstProps = {
  center: NormalizedPoint;
  reducedMotion?: boolean;
};

const BURST_PARTICLES = [
  { dx: -18, dy: -12, delay: "0ms" },
  { dx: 14, dy: -16, delay: "30ms" },
  { dx: 20, dy: 4, delay: "60ms" },
  { dx: -10, dy: 18, delay: "20ms" },
  { dx: 0, dy: -22, delay: "40ms" },
  { dx: -22, dy: 6, delay: "50ms" },
] as const;

export function HitParticleBurst({ center, reducedMotion = false }: HitParticleBurstProps) {
  if (reducedMotion) return null;

  return (
    <div
      className="pointer-events-none absolute z-[15] -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${center.x * 100}%`, top: `${center.y * 100}%` }}
      aria-hidden
    >
      {BURST_PARTICLES.map((particle, index) => (
        <span
          key={index}
          className="absolute h-1.5 w-1.5 rounded-full bg-[#5DCAA5] motion-safe:animate-[reach-light-burst_480ms_ease-out_forwards]"
          style={{
            left: 0,
            top: 0,
            animationDelay: particle.delay,
            ["--burst-x" as string]: `${particle.dx}px`,
            ["--burst-y" as string]: `${particle.dy}px`,
          }}
        />
      ))}
    </div>
  );
}
