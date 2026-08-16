"use client";

import { useGlobalLanguage } from "@/app/components/GlobalLanguageProvider";
import { DEMO_NOTICE_AR, DEMO_NOTICE_EN } from "@/app/lib/demo/local-demo-fallback";

type DemoOfflineBannerProps = {
  visible: boolean;
  notice?: string | null;
};

export function DemoOfflineBanner({ visible, notice }: DemoOfflineBannerProps) {
  const { language } = useGlobalLanguage();
  const isArabic = language === "ar";

  if (!visible) return null;

  const fallbackNotice = isArabic ? DEMO_NOTICE_AR : DEMO_NOTICE_EN;
  const bannerNotice =
    notice && notice.trim() && !notice.includes("الخدمة غير متاحة") && !notice.includes("Service unavailable")
      ? notice
      : fallbackNotice;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 rounded-[12px] border border-[var(--warning)]/30 bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--foreground)] shadow-[var(--shadow-card)]"
    >
      <p className="font-semibold text-[var(--warning)]">{isArabic ? "وضع المعاينة التجريبية" : "Demo preview mode"}</p>
      <p className="mt-1 text-[var(--muted)]">{bannerNotice}</p>
    </div>
  );
}
