import type { SideStepGameState } from "../lib/types";

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums text-white">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-white/40">{hint}</p> : null}
    </div>
  );
}

export function StatCards({ state }: { state: SideStepGameState }) {
  const { timeRemaining, score, correctReps, wrongReps, combo, phase } = state;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard
        label="Time"
        value={`${timeRemaining}s`}
        hint={phase === "playing" ? "remaining" : undefined}
      />
      <StatCard label="Score" value={String(score)} hint="combo bonus after 3" />
      <StatCard label="Correct" value={String(correctReps)} />
      <StatCard label="Miss" value={String(wrongReps)} />
      <StatCard label="Combo" value={String(combo)} hint="resets on miss" />
    </div>
  );
}
