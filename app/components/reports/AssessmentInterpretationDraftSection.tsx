"use client";

import {
  shouldShowAssessmentInterpretationDraft,
  type AssessmentInterpretationDraft,
} from "@/app/lib/reports/assessment-interpretation-draft";
import {
  INTERPRETATION_DRAFT_BADGE,
  INTERPRETATION_DRAFT_EMPTY_NOTE,
  INTERPRETATION_DRAFT_FUNCTIONAL_HEADING,
  INTERPRETATION_DRAFT_INTRO,
  INTERPRETATION_DRAFT_MOVEMENT_HEADING,
  INTERPRETATION_DRAFT_MUSCLE_HEADING,
  INTERPRETATION_DRAFT_NO_BIOMECHANICAL_NOTE,
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
      : "text-[11px] font-bold uppercase tracking-wider text-[var(--muted-soft)]";

  const bodyClass =
    variant === "print" ? "text-sm leading-relaxed text-gray-900" : "text-sm leading-relaxed text-[var(--foreground)]";

  return (
    <div className={variant === "print" ? "mt-4" : "mt-5"}>
      <h3 className={titleClass}>{title}</h3>
      <div className={bodyClass}>
        <DraftList items={items} />
      </div>
    </div>
  );
}

function DraftBody({ draft, variant }: { draft: AssessmentInterpretationDraft; variant: "screen" | "print" }) {
  const hasFunctional = draft.functionalLimitations.length > 0;
  const hasBiomechanical = draft.hasBiomechanicalPrompts;

  if (!hasFunctional && !hasBiomechanical) {
    const emptyClass =
      variant === "print" ? "mt-4 text-sm text-gray-700" : "text-sm italic text-[var(--muted)]";
    return <p className={emptyClass}>{INTERPRETATION_DRAFT_EMPTY_NOTE}</p>;
  }

  const noteClass =
    variant === "print" ? "mt-4 text-sm text-gray-700" : "mt-4 text-sm italic text-[var(--muted)]";

  return (
    <>
      <DraftSubsection
        title={INTERPRETATION_DRAFT_FUNCTIONAL_HEADING}
        items={draft.functionalLimitations}
        variant={variant}
      />
      {hasBiomechanical ? (
        <>
          <DraftSubsection
            title={INTERPRETATION_DRAFT_MOVEMENT_HEADING}
            items={draft.movementComponents}
            variant={variant}
          />
          <DraftSubsection
            title={INTERPRETATION_DRAFT_MUSCLE_HEADING}
            items={draft.musclePerformanceAreas}
            variant={variant}
          />
          <DraftSubsection
            title={INTERPRETATION_DRAFT_OBJECTIVE_HEADING}
            items={draft.suggestedObjectiveAssessments}
            variant={variant}
          />
        </>
      ) : hasFunctional ? (
        <p className={noteClass}>{INTERPRETATION_DRAFT_NO_BIOMECHANICAL_NOTE}</p>
      ) : null}
    </>
  );
}

export function AssessmentInterpretationDraftSection({ draft, variant = "screen" }: Props) {
  if (!shouldShowAssessmentInterpretationDraft(draft)) {
    return null;
  }

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
          <DraftBody draft={draft} variant="print" />
          <p className="mt-4 text-[11px] leading-relaxed text-gray-600">{draft.confirmationNote}</p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="interpretation-draft"
      className="print-section overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface)]"
    >
      <div className="border-b border-[var(--border)] px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-base font-bold text-[var(--foreground)]">{SECTION_ASSESSMENT_INTERPRETATION_DRAFT}</h2>
          <span className="shrink-0 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-200">
            {INTERPRETATION_DRAFT_BADGE}
          </span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">{INTERPRETATION_DRAFT_INTRO}</p>
      </div>

      <div className="px-6 py-5">
        <DraftBody draft={draft} variant="screen" />
        <p className="mt-5 text-xs leading-relaxed text-[var(--muted-soft)]">{draft.confirmationNote}</p>
      </div>
    </section>
  );
}
