import { TrustFooter } from "@/app/components/trust/TrustFooter";

export default function AssessmentCompletePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#071a2f] px-6 text-center text-white">
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-lime-300/25 bg-lime-400/10">
          <svg
            className="h-10 w-10 text-lime-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div className="mx-auto max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-white">Assessment Submitted</h1>
          <p className="text-sm leading-6 text-white/55">
            Thank you for completing your assessment. Your healthcare provider has been notified
            and will review your answers shortly.
          </p>

          <div className="mt-6 rounded-[22px] border border-white/10 bg-white/[0.04] p-5 text-left">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-white/40">
              What happens next
            </p>
            <div className="space-y-3">
              {[
                { icon: "📋", text: "Your therapist reviews your answers" },
                { icon: "📞", text: "They may contact you with follow-up questions" },
                { icon: "📝", text: "Your therapist may update your rehabilitation plan after review" },
                { icon: "📲", text: "You may receive access to your rehab programme when ready" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-start gap-3">
                  <span className="text-base">{icon}</span>
                  <p className="text-sm text-white/70">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs leading-5 text-white/30">
            This was a remote assessment. It supports clinician-led rehabilitation and does not
            replace a clinical examination. Your therapist will determine next steps.
          </p>

          <p className="pt-2 text-xs font-semibold tracking-wide text-cyan-400/60">
            RASQ
          </p>
        </div>
      </div>

      <TrustFooter variant="dark" className="border-white/10 pb-6" />
    </div>
  );
}
