"use client";

import { useMemo, useState } from "react";
import type { PtClinicalReportDraft, PtClinicalReportSection } from "@/app/lib/reports/pt-clinical-report-draft";
import { PtClinicalReportSection as PtClinicalReportDisplay } from "@/app/components/reports/PtClinicalReportSection";

type Props = {
  report: PtClinicalReportDraft;
  onSave: (report: PtClinicalReportDraft) => Promise<void>;
  onRegenerate: () => Promise<void>;
  onFinalize: () => Promise<void>;
  busyAction?: string | null;
  finalized?: boolean;
};

function cloneReport(report: PtClinicalReportDraft): PtClinicalReportDraft {
  return {
    ...report,
    sections: report.sections.map((section) => ({
      ...section,
      paragraphs: [...section.paragraphs],
      bullets: [...section.bullets],
    })),
  };
}

function updateSection(
  report: PtClinicalReportDraft,
  sectionId: string,
  updater: (section: PtClinicalReportSection) => PtClinicalReportSection,
): PtClinicalReportDraft {
  return {
    ...report,
    sections: report.sections.map((section) =>
      section.id === sectionId ? updater(section) : section,
    ),
  };
}

export function PtClinicalReportEditor({
  report,
  onSave,
  onRegenerate,
  onFinalize,
  busyAction = null,
  finalized = false,
}: Props) {
  const [draft, setDraft] = useState(() => cloneReport(report));
  const [dirty, setDirty] = useState(false);

  const displayReport = useMemo(() => (dirty ? draft : report), [dirty, draft, report]);

  const updateParagraph = (sectionId: string, index: number, value: string) => {
    setDraft((current) =>
      updateSection(current, sectionId, (section) => ({
        ...section,
        paragraphs: section.paragraphs.map((paragraph, paragraphIndex) =>
          paragraphIndex === index ? value : paragraph,
        ),
      })),
    );
    setDirty(true);
  };

  const updateBullet = (sectionId: string, index: number, value: string) => {
    setDraft((current) =>
      updateSection(current, sectionId, (section) => ({
        ...section,
        bullets: section.bullets.map((bullet, bulletIndex) =>
          bulletIndex === index ? value : bullet,
        ),
      })),
    );
    setDirty(true);
  };

  const handleSave = async () => {
    await onSave(draft);
    setDirty(false);
  };

  return (
    <div className="space-y-4">
      <PtClinicalReportDisplay report={displayReport} variant="screen" finalized={finalized} />

      {!finalized ? (
        <div className="space-y-3 border-t border-[#1E2D42] pt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
            Edit draft sections
          </p>
          {draft.sections.map((section) => (
            <div
              key={section.id}
              className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-3 py-3"
            >
              <p className="text-xs font-semibold text-white/80">{section.title}</p>
              {section.paragraphs.map((paragraph, index) => (
                <textarea
                  key={`${section.id}-p-${index}`}
                  value={paragraph}
                  onChange={(event) => updateParagraph(section.id, index, event.target.value)}
                  rows={2}
                  className="mt-2 w-full rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2 text-sm leading-relaxed text-white/90"
                />
              ))}
              {section.bullets.map((bullet, index) => (
                <textarea
                  key={`${section.id}-b-${index}`}
                  value={bullet}
                  onChange={(event) => updateBullet(section.id, index, event.target.value)}
                  rows={2}
                  className="mt-2 w-full rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2 text-sm leading-relaxed text-white/90"
                />
              ))}
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            {dirty ? (
              <ActionButton
                label={busyAction === "save-report" ? "Saving…" : "Save draft edits"}
                onClick={() => void handleSave()}
                disabled={busyAction !== null}
              />
            ) : null}
            <ActionButton
              label={busyAction === "regenerate-report" ? "Regenerating…" : "Regenerate PT Clinical Report"}
              onClick={() => void onRegenerate()}
              disabled={busyAction !== null}
              variant="secondary"
            />
            <ActionButton
              label={busyAction === "finalize-report" ? "Finalizing…" : "Finalize Report"}
              onClick={() => void onFinalize()}
              disabled={busyAction !== null || dirty}
            />
          </div>
          {dirty ? (
            <p className="text-[11px] text-white/40">Save draft edits before finalizing.</p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-[#5DCAA5]">
          Report finalized. Export or print the PDF from the assessment report page.
        </p>
      )}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  variant = "primary",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  const className =
    variant === "primary"
      ? "rounded-[6px] bg-[#1D9E75] px-3.5 py-[6px] text-[11px] font-medium text-white transition hover:bg-[#179165] disabled:cursor-not-allowed disabled:opacity-60"
      : "rounded-[6px] border border-[#1E2D42] bg-[#0F1825] px-3.5 py-[6px] text-[11px] font-medium text-white/80 transition hover:border-[#1D9E75]/25 hover:text-[#5DCAA5] disabled:cursor-not-allowed disabled:opacity-60";
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={className}>
      {label}
    </button>
  );
}
