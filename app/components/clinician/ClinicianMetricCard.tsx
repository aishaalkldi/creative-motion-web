import { memo } from "react";

type ClinicianMetricCardProps = {
  title: string;
  value: string;
  subtitle: string;
  attention?: boolean;
};

export const ClinicianMetricCard = memo(function ClinicianMetricCard({
  title,
  value,
  subtitle,
  attention = false,
}: ClinicianMetricCardProps) {
  return (
    <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/35">{title}</p>
      <p
        className={`mt-3 font-mono text-3xl font-bold ${attention ? "text-amber-300" : "text-[#5DCAA5]"}`}
        style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
      >
        {value}
      </p>
      <p className="mt-1.5 text-xs text-white/35">{subtitle}</p>
    </div>
  );
});
