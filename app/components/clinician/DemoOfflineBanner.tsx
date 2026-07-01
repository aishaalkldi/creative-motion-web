import { DEMO_NOTICE } from "@/app/lib/demo/local-demo-fallback";

type DemoOfflineBannerProps = {
  visible: boolean;
  notice?: string | null;
};

export function DemoOfflineBanner({ visible, notice }: DemoOfflineBannerProps) {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 rounded-[8px] border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
    >
      <p className="font-semibold text-amber-50">Demo preview mode</p>
      <p className="mt-1 text-amber-100/90">{notice ?? DEMO_NOTICE}</p>
    </div>
  );
}
