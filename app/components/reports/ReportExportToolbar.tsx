import Link from "next/link";

type Props = {
  backHref: string;
  backLabel?: string;
};

export function ReportExportToolbar({ backHref, backLabel = "← Patient" }: Props) {
  return (
    <header className="screen-only sticky top-0 z-30 border-b border-[#1E2D42] bg-[#0B1220]">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-3">
        <Link
          href={backHref}
          className="rounded-[6px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2 text-xs font-semibold text-white"
        >
          {backLabel}
        </Link>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-[6px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2 text-xs font-semibold text-white/55 hover:text-white"
          >
            Export Clinical Report (PDF)
          </button>
          <p className="max-w-[260px] text-right text-[10px] leading-snug text-white/35">
            To save as PDF, choose Save as PDF or Microsoft Print to PDF in the print dialog.
          </p>
        </div>
      </div>
    </header>
  );
}
