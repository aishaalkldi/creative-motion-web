"use client";

type CoolDownMotionGuideProps = {
  reducedMotion: boolean;
};

/**
 * Presentation-only return-to-neutral guide. Shows a subtle arm path from a
 * comfortable reach position down to rest — no reps, targets, or measurement.
 */
export function CoolDownMotionGuide({ reducedMotion }: CoolDownMotionGuideProps) {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-3 z-20 flex w-[26%] max-w-[132px] items-center sm:left-4 sm:max-w-[148px]"
      aria-hidden
    >
      <svg
        viewBox="0 0 120 200"
        className="h-auto w-full opacity-[0.24]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <ellipse cx="60" cy="30" rx="14" ry="16" stroke="#8CB4FF" strokeWidth="1.25" opacity="0.7" />
        <path d="M60 46v54" stroke="#8CB4FF" strokeWidth="1.25" strokeLinecap="round" opacity="0.55" />
        <path
          d="M60 100 L50 168 M60 100 L70 168"
          stroke="#8CB4FF"
          strokeWidth="1.25"
          strokeLinecap="round"
          opacity="0.45"
        />

        {/* Return-to-neutral path: raised hand → resting at side */}
        <path
          d="M88 68 Q 72 92 50 118"
          stroke="#5B8DEF"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeDasharray="3 5"
          opacity="0.55"
        />
        <circle cx="88" cy="68" r="2.5" fill="#8CB4FF" opacity="0.35" />
        <circle cx="50" cy="118" r="2.5" fill="#8CB4FF" opacity="0.55" />

        {/* Animated arm follows the return path */}
        <g
          style={{ transformOrigin: "60px 58px" }}
          className={reducedMotion ? "" : "motion-safe:animate-[cooldown-arm-return_5s_ease-in-out_infinite]"}
        >
          <path
            d="M60 58 L88 68"
            stroke="#A8C7FF"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="88" cy="68" r="3" fill="#8CB4FF" opacity="0.75" />
        </g>

        {/* Resting arm ghost at neutral */}
        <path
          d="M60 58 L50 118"
          stroke="#8CB4FF"
          strokeWidth="1.25"
          strokeLinecap="round"
          opacity="0.25"
        />
      </svg>
    </div>
  );
}
