"use client";

type CoolDownMotionGuideProps = {
  reducedMotion: boolean;
};

export function CoolDownMotionGuide({ reducedMotion }: CoolDownMotionGuideProps) {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-3 z-20 flex w-[28%] max-w-[140px] items-center sm:left-5 sm:max-w-[160px]"
      aria-hidden
    >
      <svg
        viewBox="0 0 120 200"
        className="h-auto w-full opacity-[0.22]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <ellipse cx="60" cy="28" rx="16" ry="18" stroke="#8CB4FF" strokeWidth="1.5" />
        <path
          d="M60 46v58"
          stroke="#8CB4FF"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M60 58 H34"
          stroke="#8CB4FF"
          strokeWidth="1.5"
          strokeLinecap="round"
          className={reducedMotion ? "" : "motion-safe:animate-[cooldown-arm-settle_4s_ease-in-out_infinite]"}
          style={{ transformOrigin: "60px 58px" }}
        />
        <path
          d="M60 58 H86"
          stroke="#8CB4FF"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M60 104 L48 168 M60 104 L72 168"
          stroke="#8CB4FF"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M42 120 Q60 132 78 120"
          stroke="#5B8DEF"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.45"
          className={reducedMotion ? "" : "motion-safe:animate-[cooldown-breath_5s_ease-in-out_infinite]"}
        />
      </svg>
    </div>
  );
}
