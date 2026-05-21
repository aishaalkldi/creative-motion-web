"use client";

import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type SessionStatus = "in-progress" | "ready";

interface AssignedSession {
  id: number;
  patientName: string;
  patientId: number;
  program: string;
  phase: string;
  progress: number;
  lastActivity: string | null;
  status: SessionStatus;
  sessionHref: string;
}

// ── Mock data (replace with API fetch: GET /api/v1/sessions) ──────────────────

const ACTIVE_SESSIONS: AssignedSession[] = [];
const READY_SESSIONS: AssignedSession[]  = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Session card ──────────────────────────────────────────────────────────────

function SessionCard({ session }: { session: AssignedSession }) {
  return (
    <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5 transition hover:border-[#1D9E75]/25">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">{session.program}</p>
          <h3 className="mt-1 text-base font-semibold text-white">{session.patientName}</h3>
          <p className="mt-0.5 text-sm text-white/45">{session.phase}</p>
        </div>
        <span className={`shrink-0 rounded-[5px] px-2.5 py-1 text-xs font-semibold ${
          session.status === "in-progress"
            ? "border border-[#1D9E75]/25 bg-[#1D9E75]/10 text-[#5DCAA5]"
            : "border border-amber-300/25 bg-amber-400/10 text-amber-200"
        }`}>
          {session.status === "in-progress" ? "In Progress" : "Ready to Start"}
        </span>
      </div>

      {session.status === "in-progress" && (
        <div className="mb-4">
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="text-white/40">Session progress</span>
            <span className="font-semibold text-[#5DCAA5]">{session.progress}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-[#1E2D42]">
            <div className="h-full bg-[#1D9E75] transition-all" style={{ width: `${session.progress}%` }} />
          </div>
          {session.lastActivity && (
            <p className="mt-1.5 text-right text-xs text-white/30">Last activity {relativeTime(session.lastActivity)}</p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Link href={session.sessionHref}
          className="flex-1 rounded-[7px] bg-[#1D9E75] px-4 py-2.5 text-center text-sm font-bold text-white transition hover:bg-[#179165]">
          {session.status === "in-progress" ? "Resume Session" : "Start Session"}
        </Link>
        <Link href={`/clinician/patients/${session.patientId}`}
          className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:text-white">
          Patient
        </Link>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center rounded-[10px] border border-[#1E2D42] bg-[#0F1825] px-8 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-[#1E2D42] bg-[#0B1220] text-white/25">
        {icon}
      </span>
      <p className="mt-4 text-sm font-semibold text-white/65">{title}</p>
      <p className="mt-1.5 max-w-xs text-sm leading-6 text-white/35">{body}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SessionsPage() {
  const hasActive = ACTIVE_SESSIONS.length > 0;
  const hasReady  = READY_SESSIONS.length > 0;

  return (
    <div className="min-h-screen bg-[#0B1220] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* ── Header ── */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/clinician" className="text-sm text-white/35 transition hover:text-white/70">← Dashboard</Link>
            <h1 className="mt-3 text-2xl font-bold text-white">Sessions</h1>
            <p className="mt-1 text-sm text-white/40">
              Execute assigned rehabilitation programs — resume in-progress or launch newly assigned.
            </p>
          </div>

          {/* Quick stats */}
          <div className="flex gap-2">
            <div className="rounded-[8px] border border-[#1E2D42] bg-[#0F1825] px-4 py-3 text-center">
              <p className="text-xl font-bold text-[#5DCAA5]" style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}>
                {ACTIVE_SESSIONS.length}
              </p>
              <p className="mt-0.5 text-[11px] text-white/35">In Progress</p>
            </div>
            <div className="rounded-[8px] border border-[#1E2D42] bg-[#0F1825] px-4 py-3 text-center">
              <p className="text-xl font-bold text-amber-300" style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}>
                {READY_SESSIONS.length}
              </p>
              <p className="mt-0.5 text-[11px] text-white/35">Ready</p>
            </div>
          </div>
        </div>

        {/* ── Badge: therapy execution ── */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-[6px] border border-[#1D9E75]/20 bg-[#1D9E75]/8 px-3 py-1.5 text-xs font-semibold text-[#5DCAA5]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#1D9E75]" />
          Therapy Execution
        </div>

        {/* ── In Progress ── */}
        <section className="mb-8">
          <div className="mb-4 flex items-center gap-2.5">
            <h2 className="text-base font-bold text-white">In Progress</h2>
            {hasActive && (
              <span className="rounded-[5px] bg-[#1D9E75]/15 px-2 py-0.5 text-xs font-semibold text-[#5DCAA5]">
                {ACTIVE_SESSIONS.length}
              </span>
            )}
          </div>

          {hasActive ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {ACTIVE_SESSIONS.map((s) => <SessionCard key={s.id} session={s} />)}
            </div>
          ) : (
            <EmptyState
              icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>}
              title="No sessions in progress"
              body="Sessions appear here once a patient starts an assigned program."
            />
          )}
        </section>

        {/* ── Assigned / Ready ── */}
        <section className="mb-8">
          <div className="mb-4 flex items-center gap-2.5">
            <h2 className="text-base font-bold text-white">Assigned — Ready to Start</h2>
            {hasReady && (
              <span className="rounded-[5px] bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
                {READY_SESSIONS.length}
              </span>
            )}
          </div>

          {hasReady ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {READY_SESSIONS.map((s) => <SessionCard key={s.id} session={s} />)}
            </div>
          ) : (
            <EmptyState
              icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" /></svg>}
              title="No assigned sessions"
              body="Assign a rehabilitation program from the patient profile. Sessions appear here ready to launch."
            />
          )}

          {!hasActive && !hasReady && (
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/clinician/patients" className="rounded-[7px] bg-[#1D9E75] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#179165]">
                Go to Patients
              </Link>
              <Link href="/clinician/assessment/start" className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-5 py-2.5 text-sm font-semibold text-white/60 transition hover:text-white">
                Start Assessment
              </Link>
            </div>
          )}
        </section>

        {/* ── Session flow reference ── */}
        <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] px-6 py-5">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-white/25">Session Flow</p>
          <ol className="flex flex-wrap items-center gap-y-2">
            {["Assigned Session", "Pre-screen", "Camera Setup", "Calibration", "Exercise Execution", "AI Coach", "Session Summary"].map((step, i, arr) => (
              <li key={step} className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#1E2D42] bg-[#0B1220] text-[10px] font-bold text-[#5DCAA5]/60">{i + 1}</span>
                <span className="text-sm text-white/50">{step}</span>
                {i < arr.length - 1 && (
                  <svg className="mx-1 h-3 w-3 shrink-0 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
