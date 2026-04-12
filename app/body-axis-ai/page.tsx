"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getAssessmentById,
  saveAssessmentToStorage,
} from "../lib/assessments-storage";

type SessionState = "idle" | "ready" | "running" | "stopped";

function BodyAxisAIPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const patientId = searchParams.get("patientId") || "UNKNOWN";
  const patientName = searchParams.get("patientName") || "Unknown Patient";
  const test = searchParams.get("test") || "posture";
  const assessmentId = searchParams.get("assessmentId") || "AX-1001";

  const assessment = useMemo(
    () => getAssessmentById(assessmentId),
    [assessmentId]
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [loading, setLoading] = useState(false);

  const [visibilityStatus, setVisibilityStatus] = useState("Waiting for camera");
  const [distanceStatus, setDistanceStatus] = useState("Stand 1.5 to 2 meters away");
  const [movementScore, setMovementScore] = useState<number | null>(null);
  const [reportSummary, setReportSummary] = useState("");

  useEffect(() => {
    return () => {
      stopTimer();
      stopCamera();
    };
  }, []);

  async function enableCamera() {
    try {
      setCameraError("");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraReady(true);
      setSessionState("ready");
      setVisibilityStatus("Body visible in frame");
      setDistanceStatus("Good distance");
    } catch (error) {
      console.error(error);
      setCameraError("Unable to access camera. Please allow camera permission.");
      setCameraReady(false);
      setSessionState("idle");
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function startTimer() {
    stopTimer();

    timerRef.current = window.setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function handleStartSession() {
    if (!cameraReady) {
      alert("Please enable the camera first.");
      return;
    }

    setMovementScore(null);
    setReportSummary("");
    setSeconds(0);
    setSessionState("running");
    startTimer();
  }

  function handleStopSession() {
    stopTimer();
    setSessionState("stopped");

    const score = generateMockScore(test, seconds || 12);
    const summary = generateReportSummary(test, score, seconds || 12);

    setMovementScore(score);
    setReportSummary(summary);
  }

  function handleUploadVideoClick() {
    fileInputRef.current?.click();
  }

  function handleVideoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !videoRef.current) return;

    stopCamera();

    const objectUrl = URL.createObjectURL(file);
    videoRef.current.srcObject = null;
    videoRef.current.src = objectUrl;
    videoRef.current.play().catch(console.error);

    setCameraReady(true);
    setSessionState("ready");
    setVisibilityStatus("Uploaded video ready");
    setDistanceStatus("Review uploaded movement");
  }

  async function handleFullscreen() {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      await el.requestFullscreen();
    }
  }

  async function handleSubmitAssessment() {
    try {
      setLoading(true);

      if (!assessment) {
        throw new Error("Assessment not found");
      }

      const existingTests = Array.isArray(assessment.selectedTests)
        ? assessment.selectedTests
        : [];

      const updatedTests = existingTests.includes(test)
        ? existingTests
        : [...existingTests, test];

      const finalScore = movementScore ?? generateMockScore(test, seconds || 10);
      const finalSummary =
        reportSummary ||
        generateReportSummary(test, finalScore, seconds || 10);

      saveAssessmentToStorage({
        ...assessment,
        patientId,
        status: "completed",
        selectedTests: updatedTests,
        score: finalScore,
        durationSeconds: seconds,
        reportSummary: finalSummary,
        completedAt: new Date().toISOString(),
      });

      stopTimer();
      stopCamera();

      router.push(
        `/assessment/success?patientId=${encodeURIComponent(
          patientId
        )}&assessmentId=${encodeURIComponent(assessmentId)}`
      );
    } catch (error) {
      console.error(error);
      alert("Failed to submit assessment");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = sessionState === "stopped";

  return (
    <main className="min-h-screen bg-[#0B1220] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="mb-3 inline-block rounded-full bg-cyan-400/10 px-4 py-1 text-sm text-cyan-300">
            Body Axis AI
          </p>

          <h1 className="text-4xl font-bold text-cyan-300">
            {formatTestTitle(test)}
          </h1>

          <p className="mt-2 max-w-3xl leading-7 text-slate-300">
            Live camera assessment session with timing, instructions, and linked
            submission to the patient record.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <h2 className="mb-5 text-2xl font-semibold text-white">
              Assessment Session
            </h2>

            <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-5">
              <h3 className="text-lg font-semibold text-cyan-300">
                Instructions
              </h3>

              <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-300">
                <li>• {getInstructionByTest(test)}</li>
                <li>• Keep your whole body visible in the frame.</li>
                <li>• Stand about 1.5 to 2 meters away from the device.</li>
                <li>• Use Start Session to begin timing, then Stop Session when done.</li>
              </ul>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <StatusCard label="Visibility" value={visibilityStatus} />
              <StatusCard label="Distance" value={distanceStatus} />
              <StatusCard label="Timer" value={`${seconds}s`} />
            </div>

            <div className="mt-6 overflow-hidden rounded-3xl border border-dashed border-cyan-400/30 bg-cyan-400/5">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <p className="text-sm font-medium text-cyan-300">
                  Live Camera / Uploaded Video
                </p>

                <button
                  type="button"
                  onClick={handleFullscreen}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm text-white transition hover:bg-white/10"
                >
                  Full Screen
                </button>
              </div>

              <div className="relative aspect-video bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  controls={false}
                  className="h-full w-full object-cover"
                />

                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center text-sm text-slate-300">
                    {cameraError || "Enable camera or upload a video to begin."}
                  </div>
                )}

                {sessionState === "running" && (
                  <div className="absolute left-4 top-4 rounded-full bg-red-500/90 px-3 py-1 text-xs font-semibold text-white">
                    LIVE
                  </div>
                )}

                <div className="absolute bottom-4 left-4 rounded-xl bg-black/60 px-4 py-2 text-sm text-white">
                  Timer: {seconds}s
                </div>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              className="hidden"
            />

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={enableCamera}
                className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Enable Camera
              </button>

              <button
                type="button"
                onClick={handleUploadVideoClick}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                Upload Video
              </button>

              <button
                type="button"
                onClick={handleStartSession}
                disabled={!cameraReady || sessionState === "running"}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start Session
              </button>

              <button
                type="button"
                onClick={handleStopSession}
                disabled={sessionState !== "running"}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Stop Session
              </button>
            </div>

            {sessionState === "stopped" && (
              <div className="mt-6 rounded-2xl border border-green-400/20 bg-green-400/10 p-5">
                <h3 className="text-lg font-semibold text-green-300">
                  Session Report
                </h3>

                <p className="mt-3 text-sm leading-7 text-white/80">
                  {reportSummary}
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <StatusCard
                    label="Score"
                    value={
                      movementScore !== null ? `${movementScore}%` : "Not available"
                    }
                  />
                  <StatusCard label="Duration" value={`${seconds}s`} />
                </div>
              </div>
            )}
          </section>

          <aside className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <h2 className="mb-5 text-2xl font-semibold text-white">
              Assessment Info
            </h2>

            <div className="space-y-4">
              <InfoBox label="Patient Name" value={patientName} />
              <InfoBox label="File Number" value={patientId} />
              <InfoBox label="Assessment ID" value={assessmentId} />
              <InfoBox label="Test Type" value={formatTestTitle(test)} />
            </div>

            <button
              type="button"
              onClick={handleSubmitAssessment}
              disabled={!canSubmit || loading}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 font-semibold text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit Assessment"}
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              Back
            </button>

            <div className="mt-6 rounded-2xl border border-white/10 bg-[#0F172A] p-4">
              <p className="text-sm text-slate-400">Session State</p>
              <p className="mt-2 font-medium text-white capitalize">
                {sessionState}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 font-medium text-white">{value}</p>
    </div>
  );
}

function StatusCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 font-medium text-white">{value}</p>
    </div>
  );
}

function formatTestTitle(test: string) {
  switch (test) {
    case "gait":
      return "Gait Assessment";
    case "balance":
      return "Balance Assessment";
    case "squat":
      return "Squat Assessment";
    case "posture":
      return "Postural Assessment";
    case "rom":
      return "ROM Assessment";
    case "reach":
      return "Reach Test";
    case "sit_to_stand":
      return "Sit-to-Stand Assessment";
    case "compensation":
      return "Compensation Analysis";
    default:
      return "Assessment";
  }
}

function getInstructionByTest(test: string) {
  switch (test) {
    case "gait":
      return "Walk naturally for a few seconds while gait symmetry and trunk control are reviewed.";
    case "balance":
      return "Hold the required balance position while stability and postural control are reviewed.";
    case "squat":
      return "Perform a controlled squat while alignment, compensation, and movement quality are reviewed.";
    case "posture":
      return "Stand naturally while posture alignment and body symmetry are assessed.";
    case "rom":
      return "Perform the guided joint movement while estimated range of motion is reviewed.";
    case "reach":
      return "Perform the reach task while functional control and movement strategy are reviewed.";
    case "sit_to_stand":
      return "Perform sit-to-stand while lower-limb control and transitional movement are reviewed.";
    case "compensation":
      return "Perform the required task while compensatory movement patterns are reviewed.";
    default:
      return "Follow the on-screen instructions while the system captures movement performance.";
  }
}

function generateMockScore(test: string, durationSeconds: number) {
  const base =
    test === "balance"
      ? 82
      : test === "gait"
      ? 84
      : test === "squat"
      ? 86
      : test === "posture"
      ? 88
      : test === "rom"
      ? 80
      : 85;

  return Math.min(95, Math.max(70, base + Math.floor(durationSeconds / 8)));
}

function generateReportSummary(
  test: string,
  score: number,
  durationSeconds: number
) {
  return `${formatTestTitle(
    test
  )} completed successfully. Session duration was ${durationSeconds} seconds with an estimated movement score of ${score}%.`;
}

export default function BodyAxisAIPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading session...</div>}>
      <BodyAxisAIPageContent />
    </Suspense>
  );
}