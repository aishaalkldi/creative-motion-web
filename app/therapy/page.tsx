import { Suspense } from "react";
import {
  normalizeTherapySessionSource,
  resolveTherapyProgramContext,
  type TherapyLibraryQueryContext,
} from "@/app/lib/therapy-sessions-store";
import GaitTherapySession from "./components/GaitTherapySession";

function pickQueryParam(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = sp[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0].trim();
  return undefined;
}

function parseLibraryQueryContext(
  sp: Record<string, string | string[] | undefined>,
): TherapyLibraryQueryContext {
  const ctx: TherapyLibraryQueryContext = {};
  const source = pickQueryParam(sp, "source");
  const programId = pickQueryParam(sp, "programId");
  const phase = pickQueryParam(sp, "phase");
  const sessionType = pickQueryParam(sp, "sessionType");
  const patientId = pickQueryParam(sp, "patientId");
  const assessmentId = pickQueryParam(sp, "assessmentId");
  const reason = pickQueryParam(sp, "reason");
  if (source !== undefined) ctx.source = source;
  if (programId !== undefined) ctx.programId = programId;
  if (phase !== undefined) ctx.phase = phase;
  if (sessionType !== undefined) ctx.sessionType = sessionType;
  if (patientId !== undefined) ctx.patientId = patientId;
  if (assessmentId !== undefined) ctx.assessmentId = assessmentId;
  if (reason !== undefined) ctx.reason = reason;
  return ctx;
}

function TherapySessionContextCard({ ctx }: { ctx: TherapyLibraryQueryContext }) {
  const em = "—";
  const resolved = resolveTherapyProgramContext(ctx);
  const sourceLabel =
    ctx.source != null && String(ctx.source).trim()
      ? normalizeTherapySessionSource(ctx.source)
      : em;
  return (
    <div className="border-b border-white/10 bg-white/[0.02] px-4 py-4 md:px-6">
      <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-slate-600">
        Session context
      </p>
      <div className="mx-auto max-w-2xl space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-slate-500">Source</span>
          <span className="text-right font-medium text-slate-300">{sourceLabel}</span>
        </div>
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-slate-500">Assessment ID</span>
          <span className="text-right font-medium text-slate-300">{ctx.assessmentId ?? em}</span>
        </div>
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-slate-500">Program</span>
          <span className="text-right font-medium text-slate-300">{resolved.programId}</span>
        </div>
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-slate-500">Phase</span>
          <span className="text-right font-medium text-slate-300">{resolved.phase}</span>
        </div>
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-slate-500">Session Type</span>
          <span className="text-right font-medium text-slate-300">{resolved.sessionType}</span>
        </div>
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-slate-500">Patient ID</span>
          <span className="text-right font-medium text-slate-300">{ctx.patientId ?? em}</span>
        </div>
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-slate-500">Mode</span>
          <span className="text-right font-medium text-cyan-200/90">Camera-based CV</span>
        </div>
        {ctx.reason ? (
          <p className="border-t border-white/10 pt-2 text-[11px] leading-relaxed text-slate-500">
            <span className="font-medium text-slate-400">Rationale: </span>
            {ctx.reason}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Therapy route: full gait gamification session (camera + MediaPipe).
 * Reads `source`, `programId`, `phase`, `sessionType`, `patientId`, `assessmentId`, `reason` from the URL for context + saved logs.
 *
 * TODO (production): Accept signed `token` or `sessionId` for patient-only access; sync summaries to backend.
 */
export default async function TherapyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const libraryQueryContext = parseLibraryQueryContext(sp);

  return (
    <div className="min-h-screen bg-[#0B1220] text-white">
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col border-x border-white/10">
        <TherapySessionContextCard ctx={libraryQueryContext} />
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center p-10 text-sm text-slate-500">
              Loading…
            </div>
          }
        >
          <GaitTherapySession libraryQueryContext={libraryQueryContext} />
        </Suspense>
      </main>
    </div>
  );
}
