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
      className="mb-4 rounded-[8px] border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
    >
      <p className="font-semibold text-amber-50">{isArabic ? "وضع المعاينة التجريبية" : "Demo preview mode"}</p>
      <p className="mt-1 text-amber-100/90">{bannerNotice}</p>
    </div>
  );
}
