"use client";

type TargetSuccessPulseProps = {
  message: string;
  arClass?: string;
};

export function TargetSuccessPulse({ message, arClass = "" }: TargetSuccessPulseProps) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-1/2 z-40 flex -translate-y-1/2 justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div
        className={`flex items-center gap-2 rounded-full border border-[#1D9E75]/50 bg-[#0F1825]/90 px-4 py-2 text-[12px] font-semibold text-[#D7F5EA] shadow-[0_8px_24px_rgba(29,158,117,0.18)] motion-safe:animate-[target-success-pop_0.24s_ease-out] ${arClass}`}
      >
        <span
          aria-hidden
          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1D9E75]/20 text-[#5DCAA5]"
        >
          ✓
        </span>
        <span>{message}</span>
      </div>
    </div>
  );
}
