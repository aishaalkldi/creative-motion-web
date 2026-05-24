import { TrustPageShell } from "@/app/components/trust/TrustPageShell";
import { INTENDED_USE_AR, INTENDED_USE_EN } from "@/app/lib/trust-content";

export default function IntendedUsePage() {
  return (
    <TrustPageShell title="Intended Use">
      <p className="text-[15px] font-medium text-[#374151]">{INTENDED_USE_EN}</p>

      <h2 className="text-[15px] font-semibold text-[#374151]">What RASQ is for</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>Structuring rehabilitation programs under clinician direction</li>
        <li>Remote patient guidance and patient-reported outcome collection</li>
        <li>Surfacing sessions or responses that may need therapist review</li>
        <li>Supporting documentation workflows for licensed physiotherapists</li>
      </ul>

      <h2 className="text-[15px] font-semibold text-[#374151]">What RASQ is not for</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>Autonomous diagnosis or independent medical decision-making</li>
        <li>Replacing in-person clinical examination when required</li>
        <li>Emergency care or urgent symptom triage</li>
        <li>Guaranteeing recovery or specific clinical outcomes</li>
      </ul>

      <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-4" dir="rtl" lang="ar">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF]">
          البيان بالعربية
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-[#374151]">{INTENDED_USE_AR}</p>
      </div>

      <p className="text-[12px] text-[#9CA3AF]">Last updated: May 2026</p>
    </TrustPageShell>
  );
}
