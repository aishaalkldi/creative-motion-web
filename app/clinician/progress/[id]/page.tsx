"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { getMockPatient, MOCK_PROGRESS, type PatientProgress } from "@/app/lib/mock-clinical-data";

/* ─── Mini bar chart ─────────────────────────────────────────────────────── */

function BarChart({
  data,
  maxVal,
  color,
  suffix = "",
}: {
  data: { label: string; value: number }[];
  maxVal: number;
  color: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-end gap-1.5 h-20">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
          <span
            className="text-[9px] text-white/30 tabular-nums"
            style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
          >
            {d.value}{suffix}
          </span>
          <div className="relative flex w-full flex-col justify-end" style={{ height: "52px" }}>
            <div
              className="w-full rounded-[3px] transition-all"
              style={{
                height: `${Math.max(3, (d.value / maxVal) * 100)}%`,
                background: color,
              }}
            />
          </div>
          <span className="text-[9px] text-white/25">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── AI flag pill ───────────────────────────────────────────────────────── */

function AiFlag({ type, text }: { type: "positive" | "warning" | "neutral"; text: string }) {
  const icon =
    type === "positive" ? (
      <svg className="h-4 w-4 shrink-0 text-[#1D9E75]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    ) : type === "warning" ? (
      <svg className="h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ) : (
      <svg className="h-4 w-4 shrink-0 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    );

  const bg =
    type === "positive" ? "border-[#1D9E75]/20 bg-[#1D9E75]/6" :
    type === "warning"  ? "border-amber-400/20 bg-amber-400/6" :
    "border-[#1E2D42] bg-[#0B1220]";

  return (
    <div className={`flex items-start gap-3 rounded-[8px] border px-4 py-3 ${bg}`}>
      {icon}
      <p className="text-sm leading-5 text-white/65">{text}</p>
    </div>
  );
}

/* ─── Phase completion row ───────────────────────────────────────────────── */

function PhaseRow({ phase, completed, week }: { phase: string; completed: boolean; week?: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
        completed
          ? "border-[#1D9E75] bg-[#1D9E75]"
          : "border-[#1E2D42] bg-[#0B1220]"
      }`}>
        {completed && (
          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
      </div>
      <p className={`flex-1 text-sm ${completed ? "text-white" : "text-white/35"}`}>{phase}</p>
      {week && (
        <span
          className="text-[11px] text-[#5DCAA5]"
          style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
        >
          {week}
        </span>
      )}
      {!completed && (
        <span className="rounded-[5px] border border-[#1E2D42] bg-[#0B1220] px-2 py-0.5 text-[10px] text-white/20">
          Pending
        </span>
      )}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function ProgressPage() {
  const params    = useParams();
  const patientId = parseInt(String(params.id ?? ""), 10);
  const patient   = getMockPatient(patientId);
  const progress: PatientProgress | undefined = MOCK_PROGRESS[patientId];

  if (!patient || !progress) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0B1220] text-white">
        <p className="text-[12px] text-[#6B7280]">No progress data available yet.</p>
        <Link href="/clinician/patients" className="text-sm font-semibold text-[#5DCAA5] hover:text-[#1D9E75]">
          ← Back to Patients
        </Link>
      </div>
    );
  }

  const lastWeek = progress.weeks[progress.weeks.length - 1];
  const romMax   = Math.max(...progress.weeks.map((w) => w.rom), progress.target.rom);
  const romData  = progress.weeks.map((w) => ({ label: w.label, value: w.rom }));
  const adhData  = progress.weeks.map((w) => ({ label: w.label, value: w.adherence }));
  const painData = progress.weeks.map((w) => ({ label: w.label, value: w.pain }));

  function handleExportPdf() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-[#0B1220] px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href={`/clinician/patients/${patientId}`}
              className="flex items-center gap-1.5 text-sm text-white/35 transition hover:text-white/65 mb-3"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Patient record
            </Link>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Progress Tracking</p>
            <h1 className="mt-1.5 text-2xl font-bold text-white">{patient.name}</h1>
            <p className="mt-1 text-sm text-white/40">
              {patient.diagnosis} · {patient.phase} · {progress.weeks.length} weeks tracked
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportPdf}
            className="flex items-center gap-2 rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-4 py-2.5 text-sm font-semibold text-white/55 transition hover:border-[#1D9E75]/25 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export PDF
          </button>
        </div>

        {/* Summary metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label:   "Current ROM",
              value:   `${lastWeek.rom}°`,
              sub:     `Target: ${progress.target.rom}°`,
              warn:    false,
            },
            {
              label:   "Adherence",
              value:   `${lastWeek.adherence}%`,
              sub:     `Last session`,
              warn:    lastWeek.adherence < 60,
            },
            {
              label:   "Pain score",
              value:   `${lastWeek.pain}/10`,
              sub:     `Baseline: ${progress.baseline.pain}/10`,
              warn:    lastWeek.pain > 6,
            },
            {
              label:   "Movement quality",
              value:   `${progress.movementQuality}`,
              sub:     "CV score / 100",
              warn:    progress.movementQuality < 65,
            },
          ].map(({ label, value, sub, warn }) => (
            <div key={label} className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/25">{label}</p>
              <p
                className={`mt-2.5 text-2xl font-bold ${warn ? "text-amber-300" : "text-[#5DCAA5]"}`}
                style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
              >
                {value}
              </p>
              <p className="mt-1 text-[11px] text-white/25">{sub}</p>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid gap-4 sm:grid-cols-3">

          <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
            <p className="mb-3 text-xs font-bold text-white/40 uppercase tracking-wider">ROM over time</p>
            <BarChart data={romData} maxVal={romMax} color="#1D9E75" suffix="°" />
            <p className="mt-2 text-[10px] text-white/20">
              Baseline {progress.baseline.rom}° → Current {lastWeek.rom}° · Target {progress.target.rom}°
            </p>
          </div>

          <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
            <p className="mb-3 text-xs font-bold text-white/40 uppercase tracking-wider">Session adherence</p>
            <BarChart data={adhData} maxVal={100} color="#5DCAA5" suffix="%" />
            <p className="mt-2 text-[10px] text-white/20">
              Avg {Math.round(progress.weeks.reduce((s, w) => s + w.adherence, 0) / progress.weeks.length)}% over {progress.weeks.length} weeks
            </p>
          </div>

          <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
            <p className="mb-3 text-xs font-bold text-white/40 uppercase tracking-wider">Pain score</p>
            <BarChart data={painData} maxVal={10} color="#e88c30" suffix="/10" />
            <p className="mt-2 text-[10px] text-white/20">
              Baseline {progress.baseline.pain}/10 → Current {lastWeek.pain}/10
            </p>
          </div>
        </div>

        {/* Phase completion + AI panel */}
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">

          {/* AI clinical flags */}
          <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825]">
            <div className="flex items-center justify-between border-b border-[#1E2D42] px-5 py-4">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className="shrink-0">
                  <path d="M10 2C5.582 2 2 5.582 2 10s3.582 8 8 8" stroke="#1D9E75" strokeWidth="2.2" strokeLinecap="round"/>
                  <path d="M10 5.5C7.515 5.5 5.5 7.515 5.5 10S7.515 14.5 10 14.5" stroke="#5DCAA5" strokeWidth="1.8" strokeLinecap="round"/>
                  <circle cx="10" cy="10" r="1.5" fill="#1D9E75"/>
                </svg>
                <span className="text-sm font-bold text-white">RASQ Intelligence</span>
              </div>
              <span className="rounded-[5px] border border-[#1D9E75]/20 bg-[#1D9E75]/8 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#5DCAA5]/70">
                Draft
              </span>
            </div>
            <div className="space-y-2 p-5">
              {progress.aiFlags.map((flag) => (
                <AiFlag key={flag.text} type={flag.type} text={flag.text} />
              ))}
            </div>
            <div className="border-t border-[#1E2D42] px-5 py-3">
              <p className="text-[10px] text-white/20">
                Clinical decision support · Not a diagnosis · Therapist review required
              </p>
            </div>
          </div>

          {/* Phase completion */}
          <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825]">
            <div className="border-b border-[#1E2D42] px-5 py-4">
              <h2 className="text-sm font-bold text-white">Phase completion</h2>
              <p className="mt-0.5 text-xs text-white/35">Programme milestones</p>
            </div>
            <div className="divide-y divide-[#1E2D42] px-5">
              {progress.phaseCompletions.map((pc) => (
                <PhaseRow
                  key={pc.phase}
                  phase={pc.phase}
                  completed={pc.completed}
                  week={pc.week}
                />
              ))}
            </div>

            <div className="border-t border-[#1E2D42] p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/30">Baseline strength</p>
                <p
                  className="text-sm font-semibold text-white"
                  style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                >
                  {progress.baseline.strength}
                </p>
              </div>
              <div className="mt-3 flex gap-2">
                <Link
                  href={`/clinician/patients/${patientId}`}
                  className="flex-1 rounded-[7px] border border-[#1E2D42] bg-[#0B1220] py-2.5 text-center text-xs font-semibold text-white/50 transition hover:border-[#1D9E75]/25 hover:text-white"
                >
                  Patient record
                </Link>
                <Link
                  href="/clinician/assessment/new"
                  className="flex-1 rounded-[7px] bg-[#1D9E75] py-2.5 text-center text-xs font-semibold text-white transition hover:bg-[#179165]"
                >
                  New assessment
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
