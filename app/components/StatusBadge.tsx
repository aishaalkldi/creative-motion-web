type BadgeTone = "brand" | "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  brand: "border-[var(--brand)]/25 bg-[var(--brand-soft)] text-[var(--brand)]",
  success: "border-[var(--success)]/25 bg-[var(--success-soft)] text-[var(--success)]",
  warning: "border-[var(--warning)]/30 bg-[var(--warning-soft)] text-[var(--warning)]",
  danger: "border-[var(--danger)]/25 bg-[var(--danger-soft)] text-[var(--danger)]",
  info: "border-[var(--info)]/25 bg-[var(--info-soft)] text-[var(--info)]",
  neutral: "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--muted)]",
};

/**
 * Unified status badge — semantic tone + text (never color alone), reused across
 * patients, results, and clinical report surfaces.
 */
export function StatusBadge({
  label,
  tone = "neutral",
  className = "",
}: {
  label: string;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none ${TONE_CLASSES[tone]} ${className}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}
