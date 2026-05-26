"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClinician } from "@/app/lib/auth";
import { hasDevAuthSession } from "@/app/lib/dev-auth";
import { getCvReadyExercises } from "@/app/lib/cv/cv-ready-exercises";
import { CvLabSession } from "@/app/components/clinician/cv/CvLabSession";

type CvSessionMetric = {
  id: string;
  exerciseId: string;
  repCount: number | null;
  sessionDurationS: number | null;
  trackingQuality: string | null;
  source: string;
  recordedAt: string;
};

function formatRecordedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function formatQuality(quality: string | null): string {
  if (!quality) return "—";
  return quality.charAt(0).toUpperCase() + quality.slice(1);
}

function formatSource(source: string): string {
  if (source === "cv_lab") return "CV Lab";
  if (source === "patient_session") return "Patient Session";
  if (source === "assessment_movement") return "Assessment";
  return source;
}

export default function CvLabPage() {
  const router = useRouter();
  const cvReadyExercises = getCvReadyExercises();
  const exerciseNameById = Object.fromEntries(
    cvReadyExercises.map((exercise) => [exercise.exerciseId, exercise.nameEn]),
  );

  const [history, setHistory] = useState<CvSessionMetric[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(false);
    try {
      const res = await fetch("/api/cv/session-metrics?limit=10");
      if (!res.ok) {
        setHistoryError(true);
        setHistory([]);
        return;
      }
      const data = (await res.json()) as { metrics?: CvSessionMetric[] };
      setHistory(data.metrics ?? []);
    } catch {
      setHistoryError(true);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getClinician() && !hasDevAuthSession()) {
      router.replace("/login");
      return;
    }
    void fetchHistory();
  }, [router, fetchHistory]);

  return (
    <main className="min-h-screen bg-[#0B1220] px-6 py-8 text-[#F9FAFB]">
      <div className="mx-auto max-w-3xl">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#1D9E75]"
        >
          Creative Motion Lab · RASQ
        </p>
        <h1 className="mt-2 text-xl font-medium text-[#F9FAFB]">Computer Vision Lab</h1>
        <p className="mt-1 text-xs text-[#EF9F27]">
          Internal development environment — not for clinical use or patient assessment.
        </p>

        <div
          className="mt-5 rounded-[10px] border border-[#EF9F27] p-4"
          style={{ background: "rgba(239,159,39,0.08)", borderWidth: "0.5px" }}
        >
          <p className="text-xs leading-[1.8] text-[#FCD34D]">
            ⚠ Internal Lab Only
            <br />
            <br />
            This tool is for internal development and demonstration purposes. It is not a clinical
            assessment tool. It must not be used to:
            <br />
            - Score patient movement quality
            <br />
            - Inform clinical decisions
            <br />
            - Assess patient progress
            <br />
            - Substitute for clinical examination
            <br />
            <br />
            Camera access is used only for real-time pose detection. No video is recorded, stored, or
            transmitted at any time.
          </p>
        </div>

        <section className="mt-8">
          <p className="text-[10px] uppercase tracking-[0.06em] text-[#9CA3AF]">
            CV-Ready Exercise Library
          </p>
          <p className="mb-3 mt-1 text-[11px] italic text-[#6B7280]">
            Exercises with computer vision measurement targets defined.
          </p>
          <div className="max-h-[320px] space-y-1.5 overflow-y-auto">
            {cvReadyExercises.map((exercise) => (
              <div
                key={exercise.exerciseId}
                className="flex items-center justify-between gap-3 rounded-[8px] border border-[#1E2D42] bg-[#0F1825] px-3.5 py-2.5"
                style={{ borderWidth: "0.5px" }}
              >
                <span className="min-w-0 flex-1 truncate text-xs text-[#F9FAFB]">
                  {exercise.nameEn}
                </span>
                <span className="shrink-0 text-[10px] text-[#6B7280]">{exercise.bodyRegion}</span>
                <span className="max-w-[40%] shrink-0 truncate text-right text-[11px] text-[#1D9E75]">
                  {exercise.cvTarget}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <p className="text-[10px] uppercase tracking-[0.06em] text-[#9CA3AF]">
            Sit-to-Stand Prototype
          </p>
          <p className="mb-3 mt-1 text-[11px] italic text-[#6B7280]">
            Counts repetitions of Sit-to-Stand using MediaPipe pose detection. Prototype-level
            accuracy — not clinically validated.
          </p>
          <CvLabSession onSessionSaved={() => void fetchHistory()} />
        </section>

        <section className="mt-8">
          <p className="text-[10px] uppercase tracking-[0.06em] text-[#9CA3AF]">
            Recent CV Lab Sessions
          </p>
          <p className="mb-3 mt-1 text-[11px] italic text-[#6B7280]">
            CV sessions store derived movement data only. No video, images, or body coordinates are
            stored.
          </p>

          {historyLoading ? (
            <p className="text-xs text-[#6B7280]">Loading session history…</p>
          ) : historyError ? (
            <p className="text-xs text-rose-300">Could not load session history.</p>
          ) : history.length === 0 ? (
            <p className="rounded-[8px] border border-[#1E2D42] bg-[#0F1825] px-4 py-6 text-center text-xs text-[#6B7280]">
              No CV sessions recorded yet. Complete a session above to see results here.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-[8px] border border-[#1E2D42] bg-[#0F1825]">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1E2D42] text-[10px] uppercase tracking-[0.06em] text-[#6B7280]">
                    <th className="px-3 py-2.5 font-medium">Date/time</th>
                    <th className="px-3 py-2.5 font-medium">Exercise</th>
                    <th className="px-3 py-2.5 font-medium">Reps</th>
                    <th className="px-3 py-2.5 font-medium">Duration</th>
                    <th className="px-3 py-2.5 font-medium">Quality</th>
                    <th className="px-3 py-2.5 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className="border-b border-[#1E2D42]/60 last:border-b-0">
                      <td className="px-3 py-2.5 text-[#9CA3AF]">
                        {formatRecordedAt(row.recordedAt)}
                      </td>
                      <td className="px-3 py-2.5 text-[#F9FAFB]">
                        {exerciseNameById[row.exerciseId] ?? row.exerciseId}
                      </td>
                      <td className="px-3 py-2.5 text-[#F9FAFB]">{row.repCount ?? "—"}</td>
                      <td className="px-3 py-2.5 text-[#F9FAFB]">
                        {formatDuration(row.sessionDurationS)}
                      </td>
                      <td className="px-3 py-2.5 text-[#F9FAFB]">
                        {formatQuality(row.trackingQuality)}
                      </td>
                      <td className="px-3 py-2.5 text-[#9CA3AF]">{formatSource(row.source)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
