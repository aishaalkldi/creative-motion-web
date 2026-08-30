"use client";

type Props = {
  untranslatedCount: number;
  onTranslateThenExport: () => void;
  onExportAnyway: () => void;
  translating: boolean;
  doneCount: number;
  totalCount: number;
};

export function PdfTranslationWarningModal({
  untranslatedCount,
  onTranslateThenExport,
  onExportAnyway,
  translating,
  doneCount,
  totalCount,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-translation-warning-title"
    >
      <div className="w-full max-w-[400px] rounded-[10px] bg-[var(--surface)] p-6 shadow-[var(--shadow-card-hover)]">
        <h2 id="pdf-translation-warning-title" className="text-sm font-medium text-[var(--foreground)]">
          Some answers are not yet translated
        </h2>
        <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
          {untranslatedCount} Arabic answer(s) have not been translated to English. The exported PDF
          will include original Arabic only for those fields.
        </p>
        <div className="mt-4 flex flex-row gap-2">
          <button
            type="button"
            disabled={translating}
            onClick={() => void onTranslateThenExport()}
            className="rounded-[7px] bg-[var(--brand)] px-3 py-2 text-[11px] font-medium text-white transition hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {translating
              ? `Translating ${doneCount} of ${totalCount} fields...`
              : "Translate then export"}
          </button>
          <button
            type="button"
            disabled={translating}
            onClick={onExportAnyway}
            className="rounded-[7px] border border-[var(--border)] bg-transparent px-3 py-2 text-[11px] font-medium text-[var(--muted)] transition hover:bg-[var(--surface-alt)] disabled:opacity-60"
          >
            Export anyway
          </button>
        </div>
      </div>
    </div>
  );
}
