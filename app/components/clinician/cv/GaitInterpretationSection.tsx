import type { GaitAssistiveInterpretation } from "@/app/lib/cv/gait-interpretation";

type Props = {
  interpretation: GaitAssistiveInterpretation;
};

export function GaitInterpretationSection({ interpretation }: Props) {
  return (
    <section className="mt-4 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand)]">
          AI-assisted gait interpretation
        </h3>
        <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[9px] font-semibold text-amber-800 dark:text-amber-200">
          For therapist review
        </span>
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-[var(--muted-soft)]">
        Based on the measured values above — assistive interpretation only, not objective examination
        findings.
      </p>

      {interpretation.interpretationLines.length > 0 ? (
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Assistive interpretation
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1.5 text-[11px] leading-relaxed text-[var(--foreground)]">
            {interpretation.interpretationLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {interpretation.reviewPrompts.length > 0 ? (
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-soft)]">
            Suggested review focus
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1.5 text-[11px] leading-relaxed text-[var(--muted)]">
            {interpretation.reviewPrompts.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 text-[10px] leading-relaxed text-[var(--muted-soft)]">{interpretation.disclaimer}</p>
    </section>
  );
}
