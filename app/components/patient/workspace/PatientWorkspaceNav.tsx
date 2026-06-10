"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { usePatientLanguage } from "@/app/components/patient/PatientLanguageProvider";
import { workspaceUi } from "@/app/lib/patient-portal-ui";

type NavItem = {
  key: "home" | "sessions" | "progress" | "profile";
  href: (token: string) => string;
  label: (ui: ReturnType<typeof workspaceUi>) => string;
  match: (pathname: string, token: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    key: "home",
    href: (token) => `/patient/${token}`,
    label: (ui) => ui.navHome,
    match: (pathname, token) => pathname === `/patient/${token}`,
  },
  {
    key: "sessions",
    href: (token) => `/patient/${token}/sessions`,
    label: (ui) => ui.navSessions,
    match: (pathname, token) => pathname.startsWith(`/patient/${token}/sessions`),
  },
  {
    key: "progress",
    href: (token) => `/patient/${token}/progress`,
    label: (ui) => ui.navProgress,
    match: (pathname, token) => pathname.startsWith(`/patient/${token}/progress`),
  },
  {
    key: "profile",
    href: (token) => `/patient/${token}/profile`,
    label: (ui) => ui.navProfile,
    match: (pathname, token) => pathname.startsWith(`/patient/${token}/profile`),
  },
];

export function PatientWorkspaceNav() {
  const params = useParams();
  const pathname = usePathname();
  const token = String(params.token ?? "");
  const { language, arClass } = usePatientLanguage();
  const ui = workspaceUi(language);

  if (!token) return null;

  const onActiveSession = pathname.includes(`/patient/${token}/session/`);
  if (onActiveSession) return null;

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-20 border-t border-[#E2E8E5] bg-white/95 backdrop-blur ${arClass}`}
      aria-label={language === "ar" ? "تنقل مساحة العمل" : "Workspace navigation"}
    >
      <div className="mx-auto flex max-w-[680px] items-stretch justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname, token);
          return (
            <Link
              key={item.key}
              href={item.href(token)}
              className={`flex min-h-[44px] min-w-[4.5rem] flex-1 flex-col items-center justify-center rounded-[8px] px-2 py-1 text-center transition ${
                active
                  ? "bg-[#F0FAF6] text-[#1D9E75]"
                  : "text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#374151]"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <span className="text-[11px] font-bold uppercase tracking-wide">
                {item.label(ui)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
