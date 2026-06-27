import type { GaitAssistiveInterpretation } from "@/app/lib/cv/gait-interpretation";

type Props = {
  interpretation: GaitAssistiveInterpretation;
};

export function GaitInterpretationSection({ interpretation }: Props) {
  return (
    <section className="mt-4 rounded-[8px] border border-[#1E2D42] bg-[#0F1825] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#5DCAA5]">
          AI-assisted gait interpretation
        </h3>
        <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[9px] font-semibold text-amber-200">
          For therapist review
        </span>
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-white/40">
        Based on the measured values above — assistive interpretation only, not objective examination
        findings.
      </p>

      {interpretation.interpretationLines.length > 0 ? (
        <div className="mt-4 border-t border-[#1E2D42] pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#EF9F27]">
            Assistive interpretation
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1.5 text-[11px] leading-relaxed text-white/75">
            {interpretation.interpretationLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {interpretation.reviewPrompts.length > 0 ? (
        <div className="mt-4 border-t border-[#1E2D42] pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Suggested review focus
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1.5 text-[11px] leading-relaxed text-white/65">
            {interpretation.reviewPrompts.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 text-[10px] leading-relaxed text-white/35">{interpretation.disclaimer}</p>
    </section>
  );
}
