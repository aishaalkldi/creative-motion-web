"use client";

type TargetSuccessPulseProps = {
  message: string;
  arClass?: string;
};

export function TargetSuccessPulse({ message, arClass = "" }: TargetSuccessPulseProps) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-16 z-40 flex justify-center px-4 sm:bottom-20"
      role="status"
      aria-live="polite"
    >
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border border-[#1D9E75]/40 bg-[#0A0F1A]/82 px-3 py-1.5 text-[11px] font-medium text-[#D7F5EA] shadow-[0_4px_16px_rgba(29,158,117,0.14)] backdrop-blur-sm motion-safe:animate-[target-success-pop_0.24s_ease-out] sm:text-[12px] ${arClass}`}
      >
        <span
          aria-hidden
          className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#1D9E75]/20 text-[10px] text-[#5DCAA5]"
        >
          ✓
        </span>
        <span>{message}</span>
      </div>
    </div>
  );
}
