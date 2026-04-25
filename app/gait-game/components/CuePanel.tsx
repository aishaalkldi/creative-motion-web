import type { SideStepGameState } from "../lib/types";

export function CuePanel({ state }: { state: SideStepGameState }) {
  const { phase, countdown, currentCue, lastFeedback } = state;

  if (phase === "countdown") {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-cyan-300/25 bg-cyan-400/10">
        <p className="text-sm font-medium uppercase tracking-widest text-cyan-200/80">
          Get ready
        </p>
        <p className="mt-4 text-8xl font-black tabular-nums text-cyan-300 drop-shadow-[0_0_24px_rgba(34,211,238,0.35)]">
          {countdown}
        </p>
      </div>
    );
  }

  if (phase === "complete") {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-emerald-300/30 bg-emerald-400/10 px-6 text-center">
        <p className="text-lg font-semibold text-emerald-200">Round complete</p>
        <p className="mt-2 text-sm text-white/70">
          Review your stats and start again or return to the hub.
        </p>
      </div>
    );
  }

  if (phase !== "playing" && phase !== "paused") {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-3xl border border-dashed border-cyan-400/30 bg-cyan-400/5 px-6 text-center">
        <p className="text-sm text-white/60">
          Press <span className="font-semibold text-cyan-200">Start session</span>{" "}
          to begin the side-step drill.
        </p>
      </div>
    );
  }

  const cueLabel = currentCue === "left" ? "LEFT" : currentCue === "right" ? "RIGHT" : "—";
  const cueSub = currentCue === "left" ? "Step to your left" : currentCue === "right" ? "Step to your right" : "Wait…";

  const ring =
    lastFeedback === "correct"
      ? "ring-4 ring-emerald-400/50"
      : lastFeedback === "wrong"
        ? "ring-4 ring-rose-500/50"
        : "ring-2 ring-cyan-400/30";

  return (
    <div
      className={`relative flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-cyan-300/20 bg-gradient-to-b from-white/[0.06] to-white/[0.02] transition-shadow duration-200 ${ring}`}
    >
      {phase === "paused" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-black/55 backdrop-blur-[2px]">
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-200">
            Paused
          </p>
        </div>
      )}
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        Target side
      </p>
      <p className="mt-3 text-7xl font-black tracking-tight text-cyan-300 md:text-8xl">
        {cueLabel}
      </p>
      <p className="mt-2 text-sm text-white/65">{cueSub}</p>
    </div>
  );
}
