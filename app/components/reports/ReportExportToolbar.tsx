import Link from "next/link";

type Props = {
  backHref: string;
  backLabel?: string;
  onExportClick?: () => void;
};

export function ReportExportToolbar({
  backHref,
  backLabel = "← Patient",
  onExportClick,
}: Props) {
  return (
    <header className="screen-only sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-3">
        <Link
          href={backHref}
          className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-xs font-semibold text-[var(--foreground)]"
        >
          {backLabel}
        </Link>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => (onExportClick ? onExportClick() : window.print())}
            className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Export Clinical Report (PDF)
          </button>
          <p className="max-w-[260px] text-right text-[10px] leading-snug text-[var(--muted-soft)]">
            To save as PDF, choose Save as PDF or Microsoft Print to PDF in the print dialog.
          </p>
        </div>
      </div>
    </header>
  );
}
