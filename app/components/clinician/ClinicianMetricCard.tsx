import { memo } from "react";

type ClinicianMetricCardProps = {
  title: string;
  value: string;
  subtitle: string;
  attention?: boolean;
  icon?: React.ReactNode;
};

export const ClinicianMetricCard = memo(function ClinicianMetricCard({
  title,
  value,
  subtitle,
  attention = false,
  icon,
}: ClinicianMetricCardProps) {
  return (
    <div className="group rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">{title}</p>
        {icon && (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${
              attention ? "bg-[var(--warning-soft)] text-[var(--warning)]" : "bg-[var(--brand-soft)] text-[var(--brand)]"
            }`}
            aria-hidden
          >
            {icon}
          </span>
        )}
      </div>
      <p
        className={`mt-3 text-3xl font-bold tabular-nums ${attention ? "text-[var(--warning)]" : "text-[var(--brand)]"}`}
        style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
      >
        {value}
      </p>
      <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">{subtitle}</p>
    </div>
  );
});

