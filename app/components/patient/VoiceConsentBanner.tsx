"use client";

type Props = {
  onAccept: () => void;
};

export function VoiceConsentBanner({ onAccept }: Props) {
  function handleAccept() {
    sessionStorage.setItem("rasq_voice_consent", "1");
    onAccept();
  }

  return (
    <div
      className="mx-auto w-full max-w-[400px] rounded-[10px] border border-[#E2E8E5] bg-white p-4"
      style={{ borderWidth: "0.5px" }}
    >
      <h3 className="text-sm font-semibold text-[#0A0F1A]">Voice input</h3>
      <p className="mt-2 text-xs leading-relaxed text-[#0A0F1A]">
        Your voice is processed by your browser only. No audio is recorded or sent to any server.
        Your answer will appear as text for you to review before submitting.
      </p>
      <button
        type="button"
        onClick={handleAccept}
        className="mt-4 w-full rounded-[7px] bg-[#1D9E75] py-2.5 text-sm font-semibold text-white transition hover:bg-[#179165]"
      >
        I understand — enable voice
      </button>
    </div>
  );
}
