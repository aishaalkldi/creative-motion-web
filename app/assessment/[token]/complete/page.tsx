import { TrustFooter } from "@/app/components/trust/TrustFooter";

export default function AssessmentCompletePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#071a2f] px-4 text-center text-white sm:px-6">
      <div className="flex flex-1 flex-col items-center justify-center py-10">
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-lime-300/25 bg-lime-400/10">
          <svg
            className="h-10 w-10 text-lime-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div className="mx-auto max-w-md space-y-4">
          <p className="inline-flex rounded-full border border-lime-300/20 bg-lime-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-lime-200">
            Submission complete
          </p>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Thank you — assessment submitted</h1>
          <p className="text-sm leading-6 text-white/55">
            Your answers were saved successfully. Your healthcare provider will review them and follow up
            as needed. You can close this page safely.
          </p>

          <div className="mt-6 rounded-[22px] border border-white/10 bg-white/[0.04] p-5 text-left">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-white/40">
              What happens next
            </p>
            <div className="space-y-3">
              {[
                { icon: "📋", text: "Your therapist reviews your answers" },
                { icon: "🎤", text: "Voice answers remain as transcribed text for therapist verification" },
                { icon: "📞", text: "They may contact you with follow-up questions" },
                { icon: "📝", text: "Your rehabilitation plan may be updated after clinical review" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-start gap-3">
                  <span className="text-base" aria-hidden>
                    {icon}
                  </span>
                  <p className="text-sm leading-relaxed text-white/70">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[14px] border border-cyan-400/15 bg-cyan-400/5 px-4 py-3 text-left">
            <p className="text-[11px] leading-relaxed text-cyan-100/80">
              This remote assessment supports clinician-led rehabilitation. It does not replace a clinical
              examination or provide a diagnosis. Your therapist determines all next steps.
            </p>
          </div>

          <p className="pt-2 text-xs font-semibold tracking-wide text-cyan-400/60">RASQ</p>
        </div>
      </div>

      <TrustFooter variant="dark" className="border-white/10 pb-6" />
    </div>
  );
}
