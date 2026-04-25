import { MetaBadge } from "./MetaBadge";

export function GameHeader() {
  return (
    <div className="mb-8 rounded-[28px] border border-cyan-300/18 bg-gradient-to-br from-cyan-500/8 via-white/[0.04] to-white/[0.02] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
      <p className="mb-3 inline-block rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-200">
        Gamification · Lower-limb control
      </p>
      <h1 className="text-3xl font-bold text-cyan-300 md:text-4xl">
        Side Stepping Session
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75 md:text-base">
        Follow the on-screen cue and tap the matching side. Build your score and
        combo with accurate side steps — structured like a clinical agility drill.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <MetaBadge label="60-second round" />
        <MetaBadge label="Alternating cues" />
        <MetaBadge label="Tap to register each step" />
      </div>
    </div>
  );
}
