import { TrustPageShell } from "@/app/components/trust/TrustPageShell";

export default function PrivacyPage() {
  return (
    <TrustPageShell title="Privacy Policy">
      <p>
        RASQ (&quot;we&quot;, &quot;our&quot;, &quot;the platform&quot;) is operated by Creative Motion Lab.
        This policy describes how information is handled in the clinician-led rehabilitation support platform.
      </p>
      <h2 className="text-[15px] font-semibold text-[#374151]">Information we process</h2>
      <p>
        Clinicians enter patient identifiers and clinical context needed to deliver rehabilitation programs.
        Patients may submit patient-reported outcomes, session responses, and assessment answers through secure links.
        Authentication data for providers is processed through our identity provider.
      </p>
      <h2 className="text-[15px] font-semibold text-[#374151]">How information is used</h2>
      <p>
        Information is used to support clinician-led rehabilitation workflows, therapist review, and patient
        communication. RASQ does not use patient data for autonomous diagnosis or autonomous treatment decisions.
      </p>
      <h2 className="text-[15px] font-semibold text-[#374151]">Sharing and retention</h2>
      <p>
        Data is accessible to the treating clinician and authorized clinic staff according to your clinic&apos;s
        policies. Retention follows clinic configuration and applicable law. Contact your clinic administrator for
        access or deletion requests relating to your care.
      </p>
      <h2 className="text-[15px] font-semibold text-[#374151]">Security</h2>
      <p>
        We apply technical and organizational measures appropriate to a clinical support platform, including
        access controls and encrypted transport. No system is perfectly secure; report concerns to your clinic
        or platform operator.
      </p>
      <p className="text-[12px] text-[#9CA3AF]">Last updated: May 2026</p>
    </TrustPageShell>
  );
}
