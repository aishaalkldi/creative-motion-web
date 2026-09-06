"use client";

import type { PtClinicalReportDraft } from "@/app/lib/reports/pt-clinical-report-draft";
import { PT_REPORT_SECTION_SPECS } from "@/app/lib/reports/pt-clinical-report-schema";

type Props = {
  report: PtClinicalReportDraft;
  variant?: "screen" | "print";
  showSectionLetters?: boolean;
};

export function PtClinicalReportSection({
  report,
  variant = "screen",
  showSectionLetters = false,
}: Props) {
  const titleClass =
    variant === "print"
      ? "text-base font-bold text-gray-900"
      : "text-sm font-bold text-white";
  const disclaimerClass =
    variant === "print"
      ? "mt-2 text-xs leading-relaxed text-gray-700"
      : "mt-2 text-xs leading-relaxed text-white/50";
  const sectionTitleClass =
    variant === "print"
      ? "text-[10px] font-bold uppercase tracking-wider text-gray-600"
      : "text-[10px] font-bold uppercase tracking-wider text-white/40";
  const bodyClass =
    variant === "print"
      ? "text-sm leading-relaxed text-gray-900"
      : "text-sm leading-relaxed text-white/80";
  const bulletClass =
    variant === "print"
      ? "mt-2 list-inside list-disc space-y-1.5 text-sm leading-relaxed text-gray-900"
      : "mt-2 list-inside list-disc space-y-1.5 text-sm leading-relaxed text-white/80";

  return (
    <div>
      <p className={titleClass}>{report.title}</p>
      <p className={disclaimerClass}>{report.disclaimer}</p>
      <p className={disclaimerClass}>{report.therapistReviewNote}</p>

      <div className={variant === "print" ? "mt-5 space-y-5" : "mt-5 space-y-5"}>
        {report.sections.map((section) => {
          const letter = PT_REPORT_SECTION_SPECS.find((spec) => spec.id === section.id)?.letter;
          const heading = showSectionLetters && letter ? `${letter}. ${section.title}` : section.title;
          return (
          <div key={section.id}>
            <h3 className={sectionTitleClass}>{heading}</h3>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className={`${bodyClass} mt-2`}>
                {paragraph}
              </p>
            ))}
            {section.bullets.length > 0 ? (
              <ul className={bulletClass}>
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </div>
          );
        })}
      </div>
    </div>
  );
}
