"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getResultsByPatient, type ResultOut } from "../lib/api";
import { patientsRepository } from "../lib/repositories";
import {
  analyzeGaitVideo,
  type GaitAnalysisResponse,
} from "../lib/api/gait";

function ResultsPageContent() {
  const searchParams = useSearchParams();

  const patientId = searchParams.get("patientId") || "—";
  const assessmentId = searchParams.get("assessmentId") || "—";
  const hasValidContext = patientId !== "—";

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [results, setResults] = useState<ResultOut[]>([]);

  // Gait AI analysis state (only active when test_name === "gait")
  const [gaitResult, setGaitResult] = useState<GaitAnalysisResponse | null>(null);
  const [gaitLoading, setGaitLoading] = useState(false);
  const [gaitError, setGaitError] = useState("");
  const gaitFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const numericPatientId = parseInt(patientId, 10);
      if (isNaN(numericPatientId)) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        setError("");
        const data = await getResultsByPatient(numericPatientId);
        if (isMounted) setResults(data);
      } catch (err) {
        if (!isMounted) return;
        setResults([]);
        setError(
          err instanceof Error ? err.message : "Failed to load results. Please try again."
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleGaitUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setGaitLoading(true);
    setGaitError("");
    setGaitResult(null);
    try {
      const data = await analyzeGaitVideo(file);
      setGaitResult(data);
    } catch (err) {
      setGaitError(
        err instanceof Error ? err.message : "Gait analysis failed. Please try again."
      );
    } finally {
      setGaitLoading(false);
      // Reset input so the same file can be re-uploaded if needed
      if (gaitFileRef.current) gaitFileRef.current.value = "";
    }
  }

  const result = useMemo(() => {
    if (!hasValidContext || results.length === 0) return null;
    // Filter by assessmentId if provided, otherwise take the latest result.
    if (assessmentId !== "—") {
      const byAssessment = results.filter(
        (item) => String(item.assessment_id) === assessmentId
      );
      return byAssessment[byAssessment.length - 1] ?? results[results.length - 1] ?? null;
    }
    return results[results.length - 1] ?? null;
  }, [hasValidContext, assessmentId, results]);

  const hasLinkedResult = hasValidContext && Boolean(result);
  const patientName =
    patientId !== "—"
      ? patientsRepository.getById(patientId)?.fullName || "Not available"
      : "Not available";

  const mode = hasLinkedResult ? "Motion Result (Backend)" : "Not available";

  const selectedTests = result?.test_name ? [result.test_name] : [];
  const bodyRegion = "—";
  const side = "—";
  const visitType = "—";
  const sessionLabel = "—";
  const status = hasLinkedResult ? "completed" : "—";
  const createdAt = "—";
  const completedAt = "—";

  const score =
    typeof result?.score === "number" ? `${result.score}%` : "—";
  const scoreValue = typeof result?.score === "number" ? result.score : null;
  const scoreTone =
    scoreValue === null
      ? "pending"
      : scoreValue >= 80
        ? "good"
        : scoreValue >= 60
          ? "moderate"
          : "attention";
  const reportSummary = hasLinkedResult
    ? (result?.summary ||
        `Result received from backend for test "${selectedTests[0] || "unknown"}". Use score and session context to confirm progression and next care step.`)
    : "No linked result available yet.";
  const assessmentContext =
    hasLinkedResult
      ? `${mode} linked to patient ${patientId}.`
      : "No linked assessment context available.";
  const movementQuality =
    scoreValue === null
      ? "Movement quality is pending until a scored result is available."
      : scoreValue >= 80
        ? "Movement quality appears stable with good control across the selected tasks."
        : scoreValue >= 60
          ? "Movement quality is functional with moderate control variability."
          : "Movement quality indicates reduced control and requires close follow-up.";
  const compensationPatterns =
    selectedTests.includes("compensation")
      ? "Compensation-focused capture was included. Review asymmetry and substitution patterns."
      : "No dedicated compensation capture was selected in this session.";
  const functionalPerformance =
    selectedTests.length > 0
      ? `Functional performance was evaluated across ${selectedTests.length} selected test${selectedTests.length > 1 ? "s" : ""}.`
      : "Functional performance tests are not linked to this result yet.";

  const analysisScore = useMemo(() => {
    if (!result) return null;
    const raw = result.score;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    return null;
  }, [result]);

  const clinicalAnalysis = useMemo(() => {
    if (!hasLinkedResult || !result || analysisScore === null) return null;

    const testKey = String(result.test_name ?? "").toLowerCase().trim();

    let severity: string;
    if (analysisScore >= 85) severity = "Mild";
    else if (analysisScore >= 70) severity = "Moderate";
    else severity = "Needs Attention";

    if (testKey === "squat") {
      if (analysisScore >= 85) {
        return {
          severity,
          interpretation:
            "Good squat performance with mild residual limitation. Functional movement appears acceptable.",
          nextStep:
            "Continue strengthening, balance training, and follow-up reassessment.",
        };
      }
      if (analysisScore >= 70) {
        return {
          severity,
          interpretation:
            "Moderate squat performance limitation detected. Ongoing rehabilitation is recommended.",
          nextStep:
            "Progress strengthening and movement control exercises, then reassess.",
        };
      }
      return {
        severity,
        interpretation:
          "Notable squat performance deficit detected. Closer monitoring and targeted rehabilitation are needed.",
        nextStep: "Start a focused corrective program and repeat assessment soon.",
      };
    }

    const testLabel = formatTestLabel(testKey);
    if (severity === "Mild") {
      return {
        severity,
        interpretation: `${testLabel}: performance appears broadly acceptable with only mild limitation to monitor.`,
        nextStep:
          "Continue the current rehabilitation emphasis and schedule a routine follow-up reassessment.",
      };
    }
    if (severity === "Moderate") {
      return {
        severity,
        interpretation: `${testLabel}: moderate limitation is present. Functional capacity may be reduced under demand.`,
        nextStep:
          "Progress targeted strengthening and motor control work, then reassess objective markers.",
      };
    }
    return {
      severity,
      interpretation: `${testLabel}: notable limitation is present. Movement quality may require closer clinical oversight.`,
      nextStep:
        "Initiate a focused corrective plan with nearer-term reassessment and safety monitoring.",
    };
  }, [analysisScore, hasLinkedResult, result]);

  const severityTone =
    clinicalAnalysis?.severity === "Mild"
      ? "good"
      : clinicalAnalysis?.severity === "Moderate"
        ? "moderate"
        : clinicalAnalysis?.severity === "Needs Attention"
          ? "attention"
          : "default";

  return (
    <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-[28px] border border-cyan-300/18 bg-gradient-to-br from-cyan-500/8 via-white/[0.04] to-white/[0.02] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
                Assessment Results
              </div>

              <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
                Results Review
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
                Review findings, confirm the linked assessment session, and continue
                to the next clinical decision.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={patientId !== "—" ? `/clinician/patients/${patientId}` : "/clinician/patients"}
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                ← Back to Patient Profile
              </Link>

              <Link
                href="/library"
                className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Assign Program
              </Link>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="mb-6 rounded-[20px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65">
            Loading results from backend...
          </div>
        )}
        {!isLoading && error && (
          <div className="mb-6 rounded-[20px] border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            Unable to load results: {error}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.85fr]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">Patient & Session Details</h2>
                  <p className="mt-2 text-sm leading-7 text-white/70">
                    Core clinical identity and session metadata for this physiotherapy motion report.
                  </p>
                </div>
                <StatusPill status={status} />
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <InfoCard label="Patient ID" value={patientId} />
                <InfoCard label="Patient Name" value={patientName} />
                <InfoCard label="Assessment ID" value={assessmentId} />
                <InfoCard label="Assessment Date" value={createdAt} />
                <InfoCard label="Assessment Mode" value={mode} />
                <InfoCard label="Visit Type" value={visitType} />
                <InfoCard label="Session Label" value={sessionLabel} />
                <InfoCard label="Body Region" value={bodyRegion} />
                <InfoCard label="Side" value={side} />
                <InfoCard label="Status" value={status} />
              </div>
            </section>

            <section className="rounded-[28px] border border-cyan-300/18 bg-gradient-to-br from-cyan-500/8 via-white/[0.04] to-white/[0.02] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">Assessment Overview</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <MetricCard label="Overall Score" value={String(score)} tone={scoreTone} />
                <MetricCard
                  label="Tests Included"
                  value={selectedTests.join(", ")}
                  tone="moderate"
                />
                <MetricCard label="Session Status" value={status} tone="default" />
                <MetricCard label="Created At" value={createdAt} tone="default" />
                <MetricCard label="Completed At" value={completedAt} tone="pending" />
                <MetricCard label="Assessment Context" value={assessmentContext} tone="default" />
              </div>
              {!hasLinkedResult && (
                <div className="mt-5 rounded-[20px] border border-cyan-300/20 bg-cyan-400/8 p-4">
                  <p className="text-sm font-semibold text-cyan-100">No linked result found</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    This report layout is ready, but no valid assessment result is currently attached to this URL.
                  </p>
                </div>
              )}
            </section>

            {hasLinkedResult && clinicalAnalysis && (
              <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
                <h2 className="text-2xl font-bold text-white">Clinical Analysis</h2>
                <p className="mt-2 text-sm leading-7 text-white/70">
                  Structured, rule-based insight from the latest backend result for this patient.
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <MetricCard
                    label="Severity"
                    value={clinicalAnalysis.severity}
                    tone={severityTone}
                  />
                  <MetricCard
                    label="Clinical Interpretation"
                    value={clinicalAnalysis.interpretation}
                    tone="default"
                  />
                  <MetricCard
                    label="Recommended Next Step"
                    value={clinicalAnalysis.nextStep}
                    tone="default"
                  />
                </div>
              </section>
            )}

            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">Tests Included</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                {selectedTests.length > 0 ? (
                  selectedTests.map((test) => (
                    <span
                      key={test}
                      className="rounded-full border border-cyan-300/25 bg-cyan-400/12 px-4 py-2 text-sm font-medium text-cyan-100"
                    >
                      {formatTestLabel(test)}
                    </span>
                  ))
                ) : (
                  <div className="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/60">
                    No tests are linked to this report yet.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">Motion Analysis Findings</h2>
              <div className="mt-5 space-y-3">
                <ActionBox text={`Movement quality: ${movementQuality}`} />
                <ActionBox text={`Compensation patterns: ${compensationPatterns}`} />
                <ActionBox text={`Functional performance: ${functionalPerformance}`} />
                <ActionBox text={`Structured findings summary: ${reportSummary}`} />
              </div>
            </section>

            {/* ── Gait AI Analysis — only shown when test is "gait" ── */}
            {selectedTests.includes("gait") && (
              <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
                <h2 className="text-2xl font-bold text-white">Gait AI Analysis</h2>
                <p className="mt-2 text-sm leading-7 text-white/70">
                  Upload a gait video to run automated analysis and receive structured clinical findings.
                </p>

                {/* Hidden file input */}
                <input
                  ref={gaitFileRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleGaitUpload}
                />

                {/* Upload trigger — shown only when no result and not loading */}
                {!gaitResult && !gaitLoading && (
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => gaitFileRef.current?.click()}
                      className="flex w-full flex-col items-center gap-3 rounded-[20px] border border-dashed border-cyan-300/35 bg-cyan-400/5 px-6 py-10 text-center transition hover:border-cyan-300/60 hover:bg-cyan-400/8"
                    >
                      <span className="text-3xl">🎥</span>
                      <span className="text-sm font-semibold text-cyan-200">
                        Click to upload gait video
                      </span>
                      <span className="text-xs text-white/45">
                        MP4, MOV, AVI — full lower body must be visible
                      </span>
                    </button>
                    {gaitError && (
                      <div className="mt-4 rounded-[18px] border border-rose-300/25 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
                        {gaitError}
                      </div>
                    )}
                  </div>
                )}

                {/* Loading state */}
                {gaitLoading && (
                  <div className="mt-5 rounded-[20px] border border-cyan-300/20 bg-cyan-400/8 px-4 py-6 text-center text-sm text-cyan-200">
                    Analysing gait video — this may take a few seconds…
                  </div>
                )}

                {/* ── Section 1: Objective Findings ── */}
                {gaitResult?.objective_findings && (
                  <div className="mt-6">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Objective Findings
                    </p>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <MetricCard
                        label="Overall Score"
                        value={
                          gaitResult.objective_findings.overall_score != null
                            ? `${gaitResult.objective_findings.overall_score}%`
                            : "Not available"
                        }
                        tone={
                          (gaitResult.objective_findings.overall_score ?? 0) >= 80
                            ? "good"
                            : (gaitResult.objective_findings.overall_score ?? 0) >= 60
                              ? "moderate"
                              : "attention"
                        }
                      />
                      <MetricCard
                        label="Classification"
                        value={gaitResult.objective_findings.classification ?? "Not available"}
                        tone="default"
                      />
                      <MetricCard
                        label="Cadence"
                        value={
                          gaitResult.objective_findings.metrics?.cadence_steps_per_min != null
                            ? `${gaitResult.objective_findings.metrics.cadence_steps_per_min} steps/min`
                            : "Not available"
                        }
                        tone="pending"
                      />
                      <MetricCard
                        label="Stride Length"
                        value={
                          gaitResult.objective_findings.metrics?.stride_length_cm != null
                            ? `${gaitResult.objective_findings.metrics.stride_length_cm} cm`
                            : "Not available"
                        }
                        tone="pending"
                      />
                      <MetricCard
                        label="Step Symmetry"
                        value={
                          gaitResult.objective_findings.metrics?.step_symmetry_pct != null
                            ? `${gaitResult.objective_findings.metrics.step_symmetry_pct}%`
                            : "Not available"
                        }
                        tone="pending"
                      />
                      <MetricCard
                        label="Gait Speed"
                        value={
                          gaitResult.objective_findings.metrics?.gait_speed_m_per_s != null
                            ? `${gaitResult.objective_findings.metrics.gait_speed_m_per_s} m/s`
                            : "Not available"
                        }
                        tone="pending"
                      />
                    </div>
                    {(gaitResult.objective_findings.flags ?? []).length > 0 && (
                      <div className="mt-4 rounded-[18px] border border-amber-300/25 bg-amber-400/10 px-4 py-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber-300">
                          Flagged Deviations
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {gaitResult.objective_findings.flags!.map((flag) => (
                            <span
                              key={flag}
                              className="rounded-full border border-amber-300/30 bg-amber-400/15 px-3 py-1 text-xs font-medium text-amber-200"
                            >
                              {flag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Section 2: Clinical Interpretation ── */}
                {gaitResult?.clinical_interpretation && (
                  <div className="mt-6">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Clinical Interpretation
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <InfoCard
                        label="Severity"
                        value={gaitResult.clinical_interpretation.severity ?? "Not available"}
                      />
                      <InfoCard
                        label="Impairment Level"
                        value={gaitResult.clinical_interpretation.impairment_level ?? "Not available"}
                      />
                    </div>
                    <div className="mt-4 rounded-[20px] border-l-4 border-cyan-400/60 bg-white/[0.04] px-5 py-4">
                      <p className="text-sm font-semibold text-white/80">Summary</p>
                      <p className="mt-2 text-sm leading-7 text-white/70">
                        {gaitResult.clinical_interpretation.summary ?? "Not available"}
                      </p>
                      {gaitResult.clinical_interpretation.details && (
                        <p className="mt-3 text-sm leading-7 text-white/60">
                          {gaitResult.clinical_interpretation.details}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Section 3: Recommendations ── */}
                {gaitResult?.recommendations && (
                  <div className="mt-6">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Recommendations
                    </p>
                    {gaitResult.recommendations.primary && (
                      <div className="mb-3 rounded-[18px] border border-cyan-300/20 bg-cyan-400/8 px-4 py-4 text-sm font-semibold text-cyan-100">
                        {gaitResult.recommendations.primary}
                      </div>
                    )}
                    {(gaitResult.recommendations.exercise_plan ?? []).length > 0 && (
                      <div className="mb-3">
                        <p className="mb-2 text-xs text-white/50">Exercise Plan</p>
                        <div className="space-y-2">
                          {gaitResult.recommendations.exercise_plan!.map((item, i) => (
                            <div key={i} className="flex gap-3 text-sm text-white/75">
                              <span className="mt-0.5 flex-none rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid gap-4 md:grid-cols-2">
                      <InfoCard
                        label="Reassessment Timeline"
                        value={gaitResult.recommendations.reassessment_timeline ?? "Not available"}
                      />
                      <InfoCard
                        label="Referrals"
                        value={
                          (gaitResult.recommendations.referrals ?? []).length > 0
                            ? gaitResult.recommendations.referrals!.join(", ")
                            : "None indicated"
                        }
                      />
                    </div>
                  </div>
                )}

                {/* ── Section 4: Confidence / Limitations ── */}
                {gaitResult?.confidence_limitations && (
                  <div className="mt-6">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Confidence / Limitations
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <MetricCard
                        label="AI Confidence"
                        value={
                          gaitResult.confidence_limitations.confidence_score != null
                            ? `${Math.round(gaitResult.confidence_limitations.confidence_score * 100)}%`
                            : "Not available"
                        }
                        tone={
                          (gaitResult.confidence_limitations.confidence_score ?? 0) >= 0.8
                            ? "good"
                            : (gaitResult.confidence_limitations.confidence_score ?? 0) >= 0.6
                              ? "moderate"
                              : "attention"
                        }
                      />
                      <MetricCard
                        label="Video Quality"
                        value={gaitResult.confidence_limitations.video_quality ?? "Not available"}
                        tone="default"
                      />
                    </div>
                    {(gaitResult.confidence_limitations.limitations ?? []).length > 0 && (
                      <div className="mt-3 space-y-2">
                        {gaitResult.confidence_limitations.limitations!.map((lim, i) => (
                          <ActionBox key={i} text={lim} />
                        ))}
                      </div>
                    )}
                    {gaitResult.confidence_limitations.notes && (
                      <div className="mt-3 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/60">
                        {gaitResult.confidence_limitations.notes}
                      </div>
                    )}
                  </div>
                )}

                {/* Re-upload link once result is shown */}
                {gaitResult && (
                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      onClick={() => gaitFileRef.current?.click()}
                      className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Re-upload Video
                    </button>
                  </div>
                )}
              </section>
            )}

            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">Clinical Summary</h2>
              <div className="mt-5 rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm leading-8 text-white/75">{reportSummary}</p>
              </div>
            </section>

            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">Session Notes</h2>
              <div className="mt-5 rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm leading-8 text-white/70">
                  Session type: <span className="font-semibold text-white">{mode}</span>. Body region:{" "}
                  <span className="font-semibold text-white">{bodyRegion}</span>. Side:{" "}
                  <span className="font-semibold text-white">{side}</span>. Visit type:{" "}
                  <span className="font-semibold text-white">{visitType}</span>. Session label:{" "}
                  <span className="font-semibold text-white">{sessionLabel}</span>. Report linked to assessment{" "}
                  <span className="font-semibold text-white">{assessmentId}</span> for patient{" "}
                  <span className="font-semibold text-white">{patientId}</span>.
                </p>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">Recommendations / Next Step</h2>
              <p className="mt-2 text-sm text-white/70">
                Continue this case from motion interpretation to treatment planning.
              </p>
              <div className="mt-5 space-y-3">
                <ActionBox text="Assign a tailored rehabilitation program." />
                <ActionBox text="Repeat assessment to monitor progression." />
                <ActionBox text="Compare this report with previous sessions." />
                <ActionBox text="Continue clinician follow-up and tracking." />
              </div>
              <div className="mt-6 flex flex-col gap-3">
                <Link
                  href="/library"
                  className="rounded-2xl bg-cyan-400 px-5 py-3 text-center font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Assign Program
                </Link>
                <Link
                  href={patientId !== "—" ? `/clinician/patients/${patientId}` : "/clinician/patients"}
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10"
                >
                  Open Patient Profile
                </Link>
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center text-sm font-semibold text-white/55"
                >
                  Download PDF (Coming Soon)
                </button>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function formatTestLabel(test: string) {
  switch (test) {
    case "posture":
      return "Postural Assessment";
    case "gait":
      return "Gait Assessment";
    case "balance":
      return "Balance Assessment";
    case "squat":
      return "Squat Assessment";
    case "rom":
      return "ROM Assessment";
    case "reach":
      return "Reach Test";
    case "sit_to_stand":
      return "Sit-to-Stand Assessment";
    case "compensation":
      return "Compensation Analysis";
    case "ai-vision":
      return "AI Vision Assessment";
    default:
      return test;
  }
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm text-white/60">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "moderate" | "attention" | "pending";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
      : tone === "moderate"
        ? "border-cyan-300/25 bg-cyan-400/10 text-cyan-100"
        : tone === "attention"
          ? "border-amber-300/25 bg-amber-400/10 text-amber-100"
          : tone === "pending"
            ? "border-white/15 bg-white/[0.04] text-white/90"
            : "border-cyan-300/15 bg-cyan-400/10 text-cyan-100";

  return (
    <div className={`rounded-[20px] border p-4 ${toneClass}`}>
      <p className="text-sm text-white/70">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const statusClass =
    normalized === "completed"
      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
      : normalized === "draft"
        ? "border-amber-300/25 bg-amber-400/10 text-amber-100"
        : "border-cyan-300/18 bg-cyan-400/10 text-cyan-100";

  return (
    <span className={`rounded-full border px-4 py-2 text-sm font-semibold ${statusClass}`}>
      {status}
    </span>
  );
}

function ActionBox({ text }: { text: string }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-white/75">
      {text}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading result...</div>}>
      <ResultsPageContent />
    </Suspense>
  );
}