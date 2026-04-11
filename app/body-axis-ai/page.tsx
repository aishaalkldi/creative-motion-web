"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getAssessmentById,
  saveAssessmentToStorage,
  type StoredAssessment,
} from "../lib/assessments-storage";

export default function BodyAxisAIPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const patientId = searchParams.get("patientId") || "";
  const assessmentId = searchParams.get("assessmentId") || "";

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [assessment, setAssessment] = useState<StoredAssessment | null>(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [captured, setCaptured] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingCamera, setLoadingCamera] = useState(false);

  useEffect(() => {
    if (!assessmentId) return;
    const found = getAssessmentById(assessmentId);
    if (found) setAssessment(found);
  }, [assessmentId]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  async function startCamera() {
    setCameraError("");
    setLoadingCamera(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API is not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        await videoRef.current.play();
      }

      setCameraStarted(true);
    } catch {
      setCameraError(
        "Unable to access camera. Please allow camera permission and refresh the page."
      );
      setCameraStarted(false);
    } finally {
      setLoadingCamera(false);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraStarted(false);
  }

  function handleCaptureComplete() {
    if (!cameraStarted) {
      alert("Start the camera first");
      return;
    }

    setCaptured(true);
    alert("Capture marked as completed");
  }

  function generateMockScore() {
    return Math.floor(70 + Math.random() * 26);
  }

  function handleSubmitResult() {
    if (!patientId || !assessmentId) {
      alert("Missing patient or assessment ID");
      return;
    }

    if (!assessment) {
      alert("Assessment not found");
      return;
    }

    setSubmitting(true);

    const mockScore = generateMockScore();

    const updatedAssessment: StoredAssessment = {
      ...assessment,
      status: "completed",
      score: mockScore,
      selectedTests:
        assessment.selectedTests.length > 0
          ? assessment.selectedTests
          : ["AI Vision Assessment"],
    };

    saveAssessmentToStorage(updatedAssessment);

    stopCamera();

    setTimeout(() => {
      router.push(
        `/assessment/success?patientId=${patientId}&assessmentId=${assessmentId}`
      );
    }, 400);
  }

  return (
    <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
              Body Axis AI
            </div>

            <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
              AI Vision Assessment
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
              Follow the instructions below and complete your movement capture.
            </p>

            <p className="mt-3 text-sm text-white/60">
              Patient ID: {patientId || "—"} | Assessment ID: {assessmentId || "—"}
            </p>
          </div>

          <Link
            href={
              patientId && assessmentId
                ? `/assessment?patientId=${patientId}&assessmentId=${assessmentId}`
                : "/assessment"
            }
            className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ← Back
          </Link>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white">Camera Capture</h2>

            <div className="mt-6 overflow-hidden rounded-[24px] border border-white/10 bg-black/30">
              <div className="relative h-[360px] w-full">
                {!cameraStarted && !loadingCamera && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/50">
                    Camera not started
                  </div>
                )}

                {loadingCamera && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/60">
                    Starting camera...
                  </div>
                )}

                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            {cameraError && (
              <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                {cameraError}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {!cameraStarted ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Start Camera
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
                >
                  Stop Camera
                </button>
              )}

              <button
                type="button"
                onClick={handleCaptureComplete}
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                Mark Capture Complete
              </button>

              <button
                type="button"
                onClick={handleSubmitResult}
                disabled={!captured || submitting}
                className="rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/45"
              >
                {submitting ? "Submitting..." : "Submit Result"}
              </button>
            </div>
          </div>

          <aside className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white">Assessment Guidance</h2>

            <div className="mt-5 space-y-4">
              <InfoCard
                label="Assessment Type"
                value={
                  assessment?.selectedTests?.[0]
                    ? assessment.selectedTests[0]
                    : "AI Vision Assessment"
                }
              />
              <InfoCard
                label="Session Label"
                value={assessment?.sessionLabel || "Remote Assessment"}
              />
              <InfoCard
                label="Status"
                value={captured ? "Capture Completed" : "Pending Capture"}
              />
            </div>

            <div className="mt-6 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-base font-semibold text-cyan-300">
                Instructions
              </h3>

              <ol className="mt-4 space-y-2 text-sm leading-7 text-white/70">
                <li>1. Place your device where your body is clearly visible.</li>
                <li>2. Press Start Camera.</li>
                <li>3. Allow camera permission if the browser asks.</li>
                <li>4. Perform the requested movement.</li>
                <li>5. Mark capture complete.</li>
                <li>6. Submit the result.</li>
              </ol>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
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