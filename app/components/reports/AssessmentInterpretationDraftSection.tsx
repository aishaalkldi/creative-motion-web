"use client";

import type { AssessmentInterpretationDraft } from "@/app/lib/reports/assessment-interpretation-draft";
import {
  INTERPRETATION_DRAFT_BADGE,
  INTERPRETATION_DRAFT_EMPTY_NOTE,
  INTERPRETATION_DRAFT_FUNCTIONAL_HEADING,
  INTERPRETATION_DRAFT_INTRO,
  INTERPRETATION_DRAFT_MOVEMENT_HEADING,
  INTERPRETATION_DRAFT_MUSCLE_HEADING,
  INTERPRETATION_DRAFT_OBJECTIVE_HEADING,
  SECTION_ASSESSMENT_INTERPRETATION_DRAFT,
} from "@/app/lib/reports/clinical-report-copy";

type Props = {
  draft: AssessmentInterpretationDraft;
  variant?: "screen" | "print";
};

function DraftList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm leading-relaxed">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function DraftSubsection({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant: "screen" | "print";
}) {
  if (items.length === 0) return null;

  const titleClass =
    variant === "print"
      ? "text-[10px] font-bold uppercase tracking-wider text-gray-600"
      : "text-[11px] font-bold uppercase tracking-wider text-white/40";

  const bodyClass =
    variant === "print" ? "text-sm leading-relaxed text-gray-900" : "text-sm leading-relaxed text-white/75";

  return (
    <div className={variant === "print" ? "mt-4" : "mt-5"}>
      <h3 className={titleClass}>{title}</h3>
      <div className={bodyClass}>
        <DraftList items={items} />
      </div>
    </div>
  );
}

export function AssessmentInterpretationDraftSection({ draft, variant = "screen" }: Props) {
  const hasLists =
    draft.functionalLimitations.length > 0 ||
    draft.movementComponents.length > 0 ||
    draft.musclePerformanceAreas.length > 0 ||
    draft.suggestedObjectiveAssessments.length > 0;

  if (variant === "print") {
    return (
      <section className="print-document-section print-section">
        <h2 className="print-section-title">{SECTION_ASSESSMENT_INTERPRETATION_DRAFT}</h2>
        <div className="print-section-body">
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
              {INTERPRETATION_DRAFT_BADGE}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-amber-950">{INTERPRETATION_DRAFT_INTRO}</p>
          </div>
          {!hasLists ? (
            <p className="mt-4 text-sm text-gray-700">{INTERPRETATION_DRAFT_EMPTY_NOTE}</p>
          ) : (
            <>
              <DraftSubsection
                title={INTERPRETATION_DRAFT_FUNCTIONAL_HEADING}
                items={draft.functionalLimitations}
                variant="print"
              />
              <DraftSubsection
                title={INTERPRETATION_DRAFT_MOVEMENT_HEADING}
                items={draft.movementComponents}
                variant="print"
              />
              <DraftSubsection
                title={INTERPRETATION_DRAFT_MUSCLE_HEADING}
                items={draft.musclePerformanceAreas}
                variant="print"
              />
              <DraftSubsection
                title={INTERPRETATION_DRAFT_OBJECTIVE_HEADING}
                items={draft.suggestedObjectiveAssessments}
                variant="print"
              />
            </>
          )}
          <p className="mt-4 text-[11px] leading-relaxed text-gray-600">{draft.confirmationNote}</p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="interpretation-draft"
      className="print-section overflow-hidden rounded-[10px] border border-[#1E2D42] bg-[#0F1825]"
    >
      <div className="border-b border-[#1E2D42] px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-base font-bold text-white">{SECTION_ASSESSMENT_INTERPRETATION_DRAFT}</h2>
          <span className="shrink-0 rounded-full border border-amber-300/25 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-200">
            {INTERPRETATION_DRAFT_BADGE}
          </span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-white/50">{INTERPRETATION_DRAFT_INTRO}</p>
      </div>

      <div className="px-6 py-5">
        {!hasLists ? (
          <p className="text-sm italic text-white/45">{INTERPRETATION_DRAFT_EMPTY_NOTE}</p>
        ) : (
          <>
            <DraftSubsection
              title={INTERPRETATION_DRAFT_FUNCTIONAL_HEADING}
              items={draft.functionalLimitations}
              variant="screen"
            />
            <DraftSubsection
              title={INTERPRETATION_DRAFT_MOVEMENT_HEADING}
              items={draft.movementComponents}
              variant="screen"
            />
            <DraftSubsection
              title={INTERPRETATION_DRAFT_MUSCLE_HEADING}
              items={draft.musclePerformanceAreas}
              variant="screen"
            />
            <DraftSubsection
              title={INTERPRETATION_DRAFT_OBJECTIVE_HEADING}
              items={draft.suggestedObjectiveAssessments}
              variant="screen"
            />
          </>
        )}
        <p className="mt-5 text-xs leading-relaxed text-white/40">{draft.confirmationNote}</p>
      </div>
    </section>
  );
}
