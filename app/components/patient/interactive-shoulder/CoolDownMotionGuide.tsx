"use client";

import { resolveCoolDownCoachingPhase } from "@/app/lib/interactive-shoulder/resolve-cool-down-coaching";

type CoolDownMotionGuideProps = {
  reducedMotion: boolean;
  elapsedSeconds?: number;
};

/**
 * Presentation-only supported-return guide. Communicates direction toward a
 * visible support surface and a final forearm-supported rest — not an exact
 * trajectory, neutral position, or measured movement.
 */
export function CoolDownMotionGuide({ reducedMotion, elapsedSeconds = 0 }: CoolDownMotionGuideProps) {
  const phase = resolveCoolDownCoachingPhase(elapsedSeconds);
  const onSupport = phase === "restOnSupport" || phase === "supportedStillness";
  const armClass = reducedMotion
    ? onSupport
      ? "cooldown-arm-supported"
      : "cooldown-arm-raised"
    : onSupport
      ? "motion-safe:animate-[cooldown-arm-supported_0.01s_linear_forwards]"
      : "motion-safe:animate-[cooldown-toward-support_7s_ease-in-out_infinite]";

  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-3 z-20 flex w-[28%] max-w-[140px] items-center sm:left-4 sm:max-w-[152px]"
      aria-hidden
    >
      <svg
        viewBox="0 0 120 200"
        className="h-auto w-full opacity-[0.26]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <ellipse cx="60" cy="30" rx="14" ry="16" stroke="#8CB4FF" strokeWidth="1.25" opacity="0.65" />
        <path d="M60 46v48" stroke="#8CB4FF" strokeWidth="1.25" strokeLinecap="round" opacity="0.5" />
        <path
          d="M60 94 L52 168 M60 94 L68 168"
          stroke="#8CB4FF"
          strokeWidth="1.25"
          strokeLinecap="round"
          opacity="0.4"
        />

        {/* Padded support surface — armrest / table-like */}
        <rect
          x="18"
          y="128"
          width="84"
          height="14"
          rx="5"
          fill="#5B8DEF"
          fillOpacity="0.14"
          stroke="#8CB4FF"
          strokeWidth="1.25"
        />
        <rect x="22" y="132" width="76" height="6" rx="3" fill="#8CB4FF" fillOpacity="0.12" />

        {/* Arm: raised → toward support → forearm resting on surface */}
        <g style={{ transformOrigin: "60px 58px" }} className={armClass}>
          <path d="M60 58 L78 74" stroke="#A8C7FF" strokeWidth="2" strokeLinecap="round" />
          <path
            d="M78 74 L46 132"
            stroke="#A8C7FF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {onSupport ? (
          <ellipse cx="46" cy="132" rx="8" ry="3" fill="#8CB4FF" fillOpacity="0.35" />
        ) : null}
      </svg>
    </div>
  );
}
