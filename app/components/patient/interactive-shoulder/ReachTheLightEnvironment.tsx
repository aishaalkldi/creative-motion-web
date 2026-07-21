"use client";

type ReachTheLightEnvironmentProps = {
  reducedMotion?: boolean;
};

const PARTICLE_SEEDS = [
  { left: "8%", top: "14%", delay: "0s", size: 3 },
  { left: "22%", top: "68%", delay: "1.4s", size: 2 },
  { left: "41%", top: "28%", delay: "0.6s", size: 2 },
  { left: "57%", top: "72%", delay: "2.1s", size: 3 },
  { left: "73%", top: "18%", delay: "1.1s", size: 2 },
  { left: "86%", top: "54%", delay: "0.3s", size: 2 },
  { left: "64%", top: "42%", delay: "1.8s", size: 2 },
  { left: "31%", top: "48%", delay: "2.4s", size: 3 },
] as const;

export function ReachTheLightEnvironment({ reducedMotion = false }: ReachTheLightEnvironmentProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5]" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A0F1A]/35 via-[#0A1524]/15 to-[#0A0F1A]/45" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(93,202,165,0.12),transparent_55%)]" />
      {!reducedMotion
        ? PARTICLE_SEEDS.map((particle, index) => (
            <span
              key={index}
              className="absolute rounded-full bg-[#5DCAA5]/35 blur-[1px] motion-safe:animate-pulse"
              style={{
                left: particle.left,
                top: particle.top,
                width: particle.size,
                height: particle.size,
                animationDelay: particle.delay,
                animationDuration: "4.5s",
              }}
            />
          ))
        : null}
    </div>
  );
}
