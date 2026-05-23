function ArcMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M10 2C5.582 2 2 5.582 2 10s3.582 8 8 8" stroke="#1D9E75" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M10 5.5C7.515 5.5 5.5 7.515 5.5 10S7.515 14.5 10 14.5" stroke="#5DCAA5" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="10" r="1.5" fill="#1D9E75" />
    </svg>
  );
}

export function AuthBrandMark() {
  return (
    <div className="mb-8 flex flex-col items-center gap-2 text-center">
      <ArcMark size={24} />
      <span
        className="text-lg font-bold tracking-[-0.03em] text-white"
        style={{ fontFamily: "var(--rasq-font-display, sans-serif)" }}
      >
        RASQ
      </span>
    </div>
  );
}

export const authInputClassName =
  "w-full rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#1D9E75]/40 focus:bg-[#0d1c14]";

export const authShellClassName =
  "relative flex min-h-screen items-center justify-center bg-[#080E14] px-6 py-16 text-white";

export const authCardClassName = "rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-7";
