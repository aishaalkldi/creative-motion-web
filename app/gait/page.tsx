"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LegacyRouteGate } from "@/app/components/legacy/LegacyRouteGate";
import { LEGACY_ROUTE_TARGETS } from "@/app/lib/legacy-routes";
import {
  analyzeGaitVideo,
  type GaitAnalysisResponse,
} from "../lib/api/gait";
import { clinicalFlowQuery, getMockClinicalDecision } from "../lib/clinical-decision";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GaitPage() {
  return (
    <LegacyRouteGate targetHref={LEGACY_ROUTE_TARGETS.gaitVideoUpload}>
      <GaitPageContent />
    </LegacyRouteGate>
  );
}

function GaitPageContent() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<GaitAnalysisResponse | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    if (!picked) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
    setResult(null);
    setStatus("idle");
    setErrorMsg("");
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const picked = e.dataTransfer.files[0] ?? null;
    if (!picked) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
    setResult(null);
    setStatus("idle");
    setErrorMsg("");
  }

  async function handleAnalyze() {
    if (!file) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setStatus("uploading");
    setErrorMsg("");
    setResult(null);

    try {
      const data = await analyzeGaitVideo(file, ctrl.signal);
      setResult(data);
      setStatus("done");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Gait analysis failed. Make sure the Gait AI service is running on port 8001."
      );
      setStatus("error");
    }
  }

  function handleReset() {
    abortRef.current?.abort();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setStatus("idle");
    setErrorMsg("");
  }

  return (
    <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">

        {/* ── Header ── */}
        <div className="mb-8 rounded-[28px] border border-cyan-300/18 bg-gradient-to-br from-cyan-500/8 via-white/[0.04] to-white/[0.02] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
          <p className="mb-3 inline-block rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-200">
            Gait Analysis · 10-Metre Walk Test
          </p>
          <h1 className="text-3xl font-bold text-cyan-300 md:text-4xl">
            10MWT Gait AI
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75 md:text-base">
            Upload a side-view video of a 10-Metre Walk Test. The AI extracts
            gait speed, cadence, step symmetry, trunk sway, and joint flexion
            angles, then returns a rule-based clinical summary.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <MetaBadge label="Side-view video only" />
            <MetaBadge label="MP4 · AVI · MOV · MKV · WMV" />
            <MetaBadge label="Minimum 2 seconds" />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">

          {/* ── Left — upload + video preview ── */}
          <div className="space-y-5">

            {/* Drop zone */}
            <div
              className="rounded-3xl border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <h2 className="mb-4 text-xl font-semibold text-white">
                Upload Video
              </h2>

              {!previewUrl ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-cyan-400/30 bg-cyan-400/5 py-16 transition hover:border-cyan-400/60 hover:bg-cyan-400/10"
                >
                  <UploadIcon />
                  <span className="text-sm text-white/70">
                    Drag &amp; drop or{" "}
                    <span className="font-semibold text-cyan-300">browse</span>
                  </span>
                  <span className="text-xs text-white/40">
                    Side-view · 10MWT · MP4 / AVI / MOV / MKV / WMV
                  </span>
                </button>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
                  <video
                    src={previewUrl}
                    controls
                    className="max-h-72 w-full object-contain"
                  />
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/avi,video/quicktime,video/x-matroska,video/x-ms-wmv,video/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {file && (
                <p className="mt-3 truncate text-sm text-white/60">
                  Selected:{" "}
                  <span className="font-medium text-white/90">{file.name}</span>
                  {" ·"}{" "}
                  <span>{(file.size / 1_048_576).toFixed(1)} MB</span>
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                {file ? "Change Video" : "Select Video"}
              </button>

              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!file || status === "uploading"}
                className="rounded-xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === "uploading" ? "Analysing…" : "Analyse Gait"}
              </button>

              {(file || result) && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  Reset
                </button>
              )}

              <button
                type="button"
                onClick={() => router.back()}
                className="ml-auto rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                Back
              </button>
            </div>

            {/* Uploading state */}
            {status === "uploading" && (
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-5 py-4 text-sm text-cyan-100">
                <div className="flex items-center gap-3">
                  <SpinnerIcon />
                  <span>
                    Uploading and running pose extraction… this may take
                    15–60 seconds depending on video length.
                  </span>
                </div>
              </div>
            )}

            {/* Error state */}
            {status === "error" && errorMsg && (
              <div className="rounded-2xl border border-rose-300/35 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
                <p className="font-semibold text-rose-200">Analysis failed</p>
                <p className="mt-1 text-white/80">{errorMsg}</p>
                <p className="mt-2 text-xs text-white/50">
                  Make sure the Gait AI service is running:
                  <code className="ml-1 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px]">
                    uvicorn app.main:app --port 8001
                  </code>
                </p>
              </div>
            )}
          </div>

          {/* ── Right — recording instructions ── */}
          <div className="rounded-3xl border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="mb-4 text-xl font-semibold text-white">
              Recording Guide
            </h2>

            <ul className="space-y-3 text-sm leading-7 text-slate-300">
              <li className="flex gap-2">
                <span className="mt-0.5 shrink-0 text-cyan-400">1.</span>
                Position camera at waist height, 2–3 m from the walking path.
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 shrink-0 text-cyan-400">2.</span>
                Record a strict side view — camera perpendicular to the direction of walking.
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 shrink-0 text-cyan-400">3.</span>
                The full body must remain visible throughout the 10-metre walk.
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 shrink-0 text-cyan-400">4.</span>
                Use good lighting — avoid back-lit or dark environments.
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 shrink-0 text-cyan-400">5.</span>
                Patient walks at comfortable speed — no running.
              </li>
            </ul>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
              <p className="font-semibold text-white/90">Accepted formats</p>
              <p className="mt-2">MP4, AVI, MOV, MKV, WMV</p>
              <p className="mt-1 text-xs text-white/50">Minimum 2 seconds · No size limit</p>
            </div>
          </div>
        </div>

        {/* ── Results ── */}
        {status === "done" && result && (
          <div className="mt-8 space-y-6">

            {/* Classification banner */}
            <div className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/10 p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
              <p className="text-sm text-emerald-300/80">Classification</p>
              <p className="mt-1 text-2xl font-bold text-emerald-200">
                {result.summary.classification}
              </p>
              <p className="mt-2 text-xs text-white/50">
                Session · {result.session_id} · {result.video_filename}
              </p>
            </div>

            {/* Video metadata */}
            <div className="rounded-3xl border border-cyan-300/18 bg-white/[0.04] p-6">
              <h3 className="mb-4 text-lg font-semibold text-white">
                Video Metadata
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Duration" value={`${result.duration_seconds.toFixed(1)} s`} />
                <StatCard label="FPS" value={result.fps.toFixed(1)} />
                <StatCard label="Total Frames" value={String(result.total_frames)} />
                <StatCard label="Processed Frames" value={String(result.processed_frames)} />
              </div>
            </div>

            {/* Gait features */}
            <div className="rounded-3xl border border-cyan-300/18 bg-white/[0.04] p-6">
              <h3 className="mb-4 text-lg font-semibold text-white">
                Gait Features
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <StatCard
                  label="Gait Speed"
                  value={`${result.features.gait_speed_mps.toFixed(2)} m/s`}
                  note="10 m / elapsed time"
                />
                <StatCard
                  label="Step Count"
                  value={String(result.features.step_count)}
                  note="total steps"
                />
                <StatCard
                  label="Cadence"
                  value={`${result.features.cadence_spm.toFixed(1)} spm`}
                  note="steps per minute"
                />
                <StatCard
                  label="Symmetry Score"
                  value={`${(result.features.symmetry_score * 100).toFixed(1)}%`}
                  note="1 = perfect"
                  highlight={result.features.symmetry_score >= 0.85 ? "good" : result.features.symmetry_score >= 0.7 ? "warn" : "bad"}
                />
                <StatCard
                  label="Trunk Sway"
                  value={`${result.features.trunk_sway_score.toFixed(2)}°`}
                  note="SD of trunk angle (lower is better)"
                />
                <StatCard
                  label="Avg Knee Flexion"
                  value={`${result.features.avg_knee_flexion.toFixed(1)}°`}
                />
                <StatCard
                  label="Avg Hip Flexion"
                  value={`${result.features.avg_hip_flexion.toFixed(1)}°`}
                />
              </div>
            </div>

            {/* Clinical flags */}
            {result.summary.flags.length > 0 && (
              <div className="rounded-3xl border border-amber-300/25 bg-amber-400/10 p-6">
                <h3 className="mb-4 text-lg font-semibold text-amber-200">
                  Clinical Flags
                </h3>
                <ul className="space-y-2">
                  {result.summary.flags.map((flag, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-100/90">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {result.summary.recommendations.length > 0 && (
              <div className="rounded-3xl border border-cyan-300/18 bg-white/[0.04] p-6">
                <h3 className="mb-4 text-lg font-semibold text-cyan-200">
                  Recommendations
                </h3>
                <ul className="space-y-2">
                  {result.summary.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/85">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.summary.flags.length === 0 && result.summary.recommendations.length === 0 && (
              <div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-5 text-sm text-emerald-100">
                No clinical flags raised. Gait parameters are within normal limits.
              </div>
            )}

            <GaitClinicalDecisionPanel result={result} />

          </div>
        )}

      </div>
    </main>
  );
}

// ─── Clinical decision (mock rules) — mirrors results page flow ────────────────

function GaitClinicalDecisionPanel({ result }: { result: GaitAnalysisResponse }) {
  const decision = useMemo(
    () =>
      getMockClinicalDecision({
        symmetry01: result.features.symmetry_score,
        trunkSwayDeg: result.features.trunk_sway_score,
        overallScore: result.objective_findings?.overall_score ?? null,
      }),
    [result]
  );

  const flowQuery = useMemo(
    () =>
      clinicalFlowQuery({
        recommended: decision.primaryProgram.id,
        symmetry01: result.features.symmetry_score,
        trunkSwayDeg: result.features.trunk_sway_score,
        overallScore: result.objective_findings?.overall_score ?? null,
      }),
    [result, decision.primaryProgram.id]
  );

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
        <h3 className="text-xl font-bold text-white">Clinical summary</h3>
        <p className="mt-2 text-xs text-white/50">
          {/* TODO: ML recommendation + EHR-linked prescription. */}
          Mock decision support from symmetry, trunk sway, and overall score.
        </p>
        <ul className="mt-4 space-y-2 text-sm leading-7 text-white/75">
          {decision.summaryLines.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 text-cyan-400">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
        <h3 className="text-xl font-bold text-white">Recommended program</h3>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href={`${decision.primaryProgram.href}${flowQuery}`}
            className="rounded-2xl bg-cyan-400 px-6 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Recommended therapy
          </Link>
          <Link
            href={`/library${flowQuery}`}
            className="rounded-2xl border border-cyan-300/35 bg-cyan-400/10 px-6 py-3 text-center text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
          >
            Open rehabilitation library
          </Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {decision.programs.map((p) => (
            <div key={p.id} className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-cyan-100">{p.title}</p>
              <p className="mt-2 text-sm text-white/70">{p.rationale}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Small UI components ───────────────────────────────────────────────────────

function MetaBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  note,
  highlight,
}: {
  label: string;
  value: string;
  note?: string;
  highlight?: "good" | "warn" | "bad";
}) {
  const valueColor =
    highlight === "good"
      ? "text-emerald-300"
      : highlight === "warn"
      ? "text-amber-300"
      : highlight === "bad"
      ? "text-rose-300"
      : "text-white";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-2 text-lg font-semibold tabular-nums ${valueColor}`}>
        {value}
      </p>
      {note && <p className="mt-1 text-[11px] text-white/40">{note}</p>}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-10 w-10 text-cyan-400/60"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.3}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 animate-spin text-cyan-300"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
