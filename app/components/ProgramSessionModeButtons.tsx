import Link from "next/link";

export function patientIdFromSearchParams(
  sp: Record<string, string | string[] | undefined>,
): string {
  const raw = sp.patientId;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw[0] ?? "";
  return "";
}

/** URL-safe slug for sessionType query (matches program card session labels). */
export function slugSessionType(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "session"
  );
}

type ProgramSessionModeButtonsProps = {
  programId: string;
  phase: number;
  sessionType: string;
  patientId?: string;
};

/**
 * Camera mode → existing /therapy gait session. XR control is non-navigating and visually disabled.
 */
export function ProgramSessionModeButtons({
  programId,
  phase,
  sessionType,
  patientId = "",
}: ProgramSessionModeButtonsProps) {
  const q = new URLSearchParams();
  q.set("source", "library");
  q.set("programId", programId);
  q.set("phase", String(phase));
  q.set("sessionType", sessionType);
  if (patientId) q.set("patientId", patientId);

  const cameraHref = `/therapy?${q.toString()}`;

  return (
    <div className="mt-4 space-y-3">
      <div className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
        <p>Available now: Camera-based CV</p>
        <p className="mt-1 text-slate-600">Next phase: XR immersive rehab</p>
      </div>
      <div className="flex flex-wrap items-start gap-3">
        <Link
          href={cameraHref}
          className="inline-flex rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          Start Camera Mode
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white opacity-50 cursor-not-allowed"
          >
            XR Mode Coming Soon
          </button>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  );
}
