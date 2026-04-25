"use client";

import { useRouter } from "next/navigation";
import { CuePanel } from "./components/CuePanel";
import { GameControls } from "./components/GameControls";
import { GameHeader } from "./components/GameHeader";
import { StatCards } from "./components/StatCards";
import { useSideStepGame } from "./lib/use-side-step-game";

/**
 * Side-step gamification session (Creative Motion clinical-tech UI).
 * If you have the original `creative-motion-gamification` repo, you can
 * replace this route’s internals with ported components while keeping this path.
 */
export default function GaitGamePage() {
  const router = useRouter();
  const { state, start, tap, pause, resume, reset } = useSideStepGame();

  return (
    <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <GameHeader />

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-5">
            <div className="rounded-3xl border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="mb-4 text-lg font-semibold text-cyan-200">
                Exercise arena
              </h2>
              <CuePanel state={state} />
            </div>

            <div className="rounded-3xl border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="mb-4 text-lg font-semibold text-cyan-200">
                Session stats
              </h2>
              <StatCards state={state} />
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-3xl border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="mb-4 text-lg font-semibold text-white">Controls</h2>
              <GameControls
                state={state}
                onStart={start}
                onTap={tap}
                onPause={pause}
                onResume={resume}
                onReset={reset}
                onBack={() => router.back()}
              />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h3 className="text-sm font-semibold text-cyan-200">How it works</h3>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-white/70">
                <li>1. Start the 60-second round.</li>
                <li>2. Read the large LEFT / RIGHT cue.</li>
                <li>3. Perform a side step and tap the matching button.</li>
                <li>4. Correct taps score +10; combo adds bonus after 3 in a row.</li>
                <li>5. Cues rotate automatically — stay in rhythm.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
