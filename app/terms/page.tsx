import { TrustPageShell } from "@/app/components/trust/TrustPageShell";

export default function TermsPage() {
  return (
    <TrustPageShell title="Terms of Use">
      <p>
        By accessing RASQ you agree to use the platform only for lawful clinical and rehabilitation support
        purposes under the supervision of licensed healthcare professionals.
      </p>
      <h2 className="text-[15px] font-semibold text-[#374151]">Clinician-led use</h2>
      <p>
        RASQ supports clinician-led rehabilitation. All clinical judgments, plan changes, and treatment decisions
        remain the responsibility of the treating clinician. The platform organizes information and prompts
        therapist review; it does not replace professional assessment.
      </p>
      <h2 className="text-[15px] font-semibold text-[#374151]">Patient access</h2>
      <p>
        Patient links are personal and time-limited. Do not share tokens publicly. Patients should follow their
        therapist&apos;s plan and contact their therapist if symptoms worsen or unexpected symptoms occur.
      </p>
      <h2 className="text-[15px] font-semibold text-[#374151]">Acceptable use</h2>
      <p>
        You may not attempt to bypass security controls, probe other users&apos; data, or use the platform for
        purposes unrelated to rehabilitation support. We may suspend access for misuse.
      </p>
      <h2 className="text-[15px] font-semibold text-[#374151]">Disclaimer</h2>
      <p>
        RASQ is provided as a clinical support tool without warranties of uninterrupted service or fitness for
        a particular medical outcome. See Intended Use and Clinical Safety for scope limitations.
      </p>
      <p className="text-[12px] text-[#9CA3AF]">Last updated: May 2026</p>
    </TrustPageShell>
  );
}
