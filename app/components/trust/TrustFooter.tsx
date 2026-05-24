import Link from "next/link";
import type { TrustFooterUi } from "@/app/lib/patient-portal-ui";

type TrustFooterProps = {
  variant?: "light" | "dark";
  labels?: TrustFooterUi;
  className?: string;
};

const DEFAULT_LABELS: TrustFooterUi = {
  privacy: "Privacy",
  terms: "Terms",
  intendedUse: "Intended Use",
  clinicalSafety: "Clinical Safety",
};

export function TrustFooter({
  variant = "light",
  labels = DEFAULT_LABELS,
  className = "",
}: TrustFooterProps) {
  const linkClass =
    variant === "dark"
      ? "text-white/35 transition hover:text-white/60"
      : "text-[#9CA3AF] transition hover:text-[#6B7280]";

  const borderClass =
    variant === "dark" ? "border-white/10" : "border-[#E2E8E5]";

  const links = [
    { href: "/privacy", label: labels.privacy },
    { href: "/terms", label: labels.terms },
    { href: "/intended-use", label: labels.intendedUse },
    { href: "/clinical-safety", label: labels.clinicalSafety },
  ];

  return (
    <footer
      className={`border-t ${borderClass} px-4 py-5 ${className}`}
      aria-label="Legal and trust links"
    >
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {links.map(({ href, label }) => (
          <Link key={href} href={href} className={`text-[11px] font-medium ${linkClass}`}>
            {label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
