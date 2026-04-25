import type { SideCue, SideStepGameState } from "../lib/types";

type Props = {
  state: SideStepGameState;
  onStart: () => void;
  onTap: (side: SideCue) => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onBack: () => void;
};

export function GameControls({
  state,
  onStart,
  onTap,
  onPause,
  onResume,
  onReset,
  onBack,
}: Props) {
  const { phase } = state;
  const canTap = phase === "playing" && state.currentCue !== null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          type="button"
          disabled={!canTap}
          onClick={() => onTap("left")}
          className="rounded-2xl border border-cyan-300/35 bg-cyan-400/15 py-4 text-lg font-bold text-cyan-100 transition hover:bg-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Tap LEFT
        </button>
        <button
          type="button"
          disabled={!canTap}
          onClick={() => onTap("right")}
          className="rounded-2xl border border-cyan-300/35 bg-cyan-400/15 py-4 text-lg font-bold text-cyan-100 transition hover:bg-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Tap RIGHT
        </button>
        {phase === "idle" || phase === "complete" ? (
          <button
            type="button"
            onClick={onStart}
            className="rounded-2xl bg-cyan-400 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 sm:col-span-2"
          >
            {phase === "complete" ? "Play again" : "Start session"}
          </button>
        ) : phase === "playing" ? (
          <button
            type="button"
            onClick={onPause}
            className="rounded-2xl border border-white/20 bg-white/5 py-4 text-sm font-semibold text-white transition hover:bg-white/10 sm:col-span-2"
          >
            Pause
          </button>
        ) : (
          <button
            type="button"
            onClick={onResume}
            className="rounded-2xl bg-cyan-400 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 sm:col-span-2"
          >
            Resume
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onReset}
          className="rounded-2xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-2xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10"
        >
          Back
        </button>
      </div>
    </div>
  );
}
