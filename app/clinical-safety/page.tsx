import { TrustPageShell } from "@/app/components/trust/TrustPageShell";

export default function ClinicalSafetyPage() {
  return (
    <TrustPageShell title="Clinical Safety">
      <p>
        RASQ is designed as a conservative, clinician-led support layer. Patient-facing features emphasize
        therapist review, patient-reported progress, and clear stop instructions—not autonomous clinical action.
      </p>

      <h2 className="text-[15px] font-semibold text-[#374151]">For patients</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          Stop if you feel sharp pain, dizziness, chest pain, shortness of breath, or unusual symptoms.
        </li>
        <li>Contact your therapist if symptoms worsen.</li>
        <li>
          This platform supports your therapist&apos;s plan and does not replace clinical assessment.
        </li>
      </ul>

      <h2 className="text-[15px] font-semibold text-[#374151]">For clinicians</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>Review flagged sessions and patient-reported outcomes before changing plans.</li>
        <li>Do not rely on the platform as the sole source of clinical assessment.</li>
        <li>Rule-based prompts are decision support only; therapist approval is required.</li>
      </ul>

      <h2 className="text-[15px] font-semibold text-[#374151]">Emergencies</h2>
      <p>
        RASQ is not an emergency service. If you or a patient may be experiencing a medical emergency, contact
        local emergency services immediately.
      </p>

      <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-4" dir="rtl" lang="ar">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF]">
          للمرضى — بالعربية
        </p>
        <ul className="mt-2 list-disc space-y-2 pr-5 text-[14px] leading-relaxed text-[#374151]">
          <li>توقّف إذا شعرت بألم حاد، دوخة، ألم في الصدر، ضيق تنفس، أو أعراض غير معتادة.</li>
          <li>تواصل مع معالجك إذا زادت الأعراض.</li>
          <li>هذه المنصة تدعم خطة معالجك ولا تستبدل التقييم السريري.</li>
        </ul>
      </div>

      <p className="text-[12px] text-[#9CA3AF]">Last updated: May 2026</p>
    </TrustPageShell>
  );
}
