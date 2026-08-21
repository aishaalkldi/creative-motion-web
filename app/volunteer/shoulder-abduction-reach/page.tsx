"use client";

/**
 * Volunteer Shoulder Abduction Reach — Slice 8A public capture (in-memory only).
 * No server persistence, no dev-data, no remote uploads.
 */

import { useCallback, useEffect, useState } from "react";
import { VolunteerWizardShell } from "@/app/volunteer/shoulder-abduction-reach/components/VolunteerWizardShell";
import { useVolunteerCaptureSession } from "@/app/hooks/useVolunteerCaptureSession";
import {
  VOLUNTEER_CAPTURE_SIDE,
  VOLUNTEER_PROTOCOL_CONDITION_INSTRUCTIONS,
  VOLUNTEER_PROTOCOL_CONDITION_LABELS,
  VOLUNTEER_PROTOCOL_CONDITIONS,
  VOLUNTEER_TARGET_REPS,
  buildVolunteerSessionSummary,
  canProceedFromConsent,
  isCaptureComplete,
  type VolunteerConsentState,
  type VolunteerProtocolCondition,
  type VolunteerWizardStep,
} from "@/app/volunteer/shoulder-abduction-reach/volunteer-protocol";

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-[#0A0F1A] px-5 py-2.5 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-[#D1D5DB] bg-white px-5 py-2.5 text-[14px] font-medium text-[#374151] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export default function VolunteerShoulderAbductionReachPage() {
  const [step, setStep] = useState<VolunteerWizardStep>("welcome");
  const [consent, setConsent] = useState<VolunteerConsentState>({
    ageConfirmed: false,
    participationAgreed: false,
  });
  const [protocolCondition, setProtocolCondition] = useState<VolunteerProtocolCondition>("NORMAL");

  const handleTargetReached = useCallback(() => {
    setStep("summary");
  }, []);

  const {
    videoRef,
    canvasRef,
    cameraPreviewActive,
    starting,
    running,
    error,
    snapshot,
    capturedCount,
    rejectedCount,
    lastRejection,
    enableCameraPreview,
    reattachCameraPreview,
    startCapture,
    stopDetector,
    stopAll,
    resetSession,
  } = useVolunteerCaptureSession({
    side: VOLUNTEER_CAPTURE_SIDE,
    protocolCondition,
    onTargetReached: handleTargetReached,
  });

  useEffect(() => {
    if (step === "capture") {
      void reattachCameraPreview();
    }
  }, [step, reattachCameraPreview]);

  useEffect(() => {
    if (step === "summary") {
      stopAll();
    }
  }, [step, stopAll]);

  const summary =
    step === "summary"
      ? buildVolunteerSessionSummary({
          capturedCount,
          rejectedCount,
          protocolCondition,
          side: VOLUNTEER_CAPTURE_SIDE,
          lastTrackingStatus: snapshot?.trackingStatus ?? "idle",
        })
      : null;

  return (
    <VolunteerWizardShell stepLabel="Volunteer capture">
      {step === "welcome" ? (
        <section className="space-y-6">
          <h1 className="text-[24px] font-bold text-[#0A0F1A]">Volunteer Motion Data Collection</h1>
          <div className="space-y-3 text-[14px] leading-relaxed text-[#6B7280]">
            <p>
              Thank you for helping with technical software development. This session collects
              anonymous movement-tracking data to improve computer-vision research tools.
            </p>
            <p>
              <strong className="font-semibold text-[#374151]">This is not medical care.</strong> It
              is not a diagnosis, clinical assessment, or treatment.
            </p>
            <p className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-[#92400E]">
              For this initial technical pilot, please use a <strong>laptop or desktop computer</strong>{" "}
              with a front-facing camera.
            </p>
          </div>
          <PrimaryButton onClick={() => setStep("consent")}>Continue</PrimaryButton>
        </section>
      ) : null}

      {step === "consent" ? (
        <section className="space-y-6">
          <h1 className="text-[22px] font-bold text-[#0A0F1A]">Eligibility and consent</h1>
          <div className="space-y-3 text-[14px] leading-relaxed text-[#6B7280]">
            <p>Please confirm the following before continuing:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Your camera is used for on-device movement tracking only.</li>
              <li>
                Raw video and photos are not intentionally uploaded or stored in this technical
                pilot.
              </li>
              <li>
                In this pilot version, completed movement data is <strong>not sent to a server</strong>{" "}
                — it stays in your browser memory only until you leave this page.
              </li>
              <li>
                No name, email, phone, diagnosis, or patient information is collected in this step.
              </li>
              <li>You may stop at any time by closing or exiting this page.</li>
              <li>This technical pilot is not medical care.</li>
            </ul>
          </div>

          <div className="space-y-3 rounded-lg border border-[#E2E8E5] bg-white p-4">
            <label className="flex items-start gap-3 text-[14px] text-[#374151]">
              <input
                type="checkbox"
                className="mt-1"
                checked={consent.ageConfirmed}
                onChange={(e) =>
                  setConsent((current) => ({ ...current, ageConfirmed: e.target.checked }))
                }
              />
              <span>I am 18 years or older.</span>
            </label>
            <label className="flex items-start gap-3 text-[14px] text-[#374151]">
              <input
                type="checkbox"
                className="mt-1"
                checked={consent.participationAgreed}
                onChange={(e) =>
                  setConsent((current) => ({ ...current, participationAgreed: e.target.checked }))
                }
              />
              <span>
                I voluntarily agree to participate in this technical movement-data collection.
              </span>
            </label>
          </div>

          <div className="flex gap-3">
            <SecondaryButton onClick={() => setStep("welcome")}>Back</SecondaryButton>
            <PrimaryButton
              onClick={() => setStep("camera")}
              disabled={!canProceedFromConsent(consent)}
            >
              Continue
            </PrimaryButton>
          </div>
        </section>
      ) : null}

      {step === "camera" ? (
        <section className="space-y-6">
          <h1 className="text-[22px] font-bold text-[#0A0F1A]">Camera setup</h1>
          <ul className="list-disc space-y-2 pl-5 text-[14px] text-[#6B7280]">
            <li>Face the camera directly.</li>
            <li>Use good, even lighting.</li>
            <li>Keep your upper body clearly visible.</li>
            <li>Step back enough to keep shoulders and arms in frame.</li>
          </ul>

          <div className="relative aspect-[4/3] w-full max-w-[640px] overflow-hidden rounded-lg bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
          </div>

          {error ? <p className="text-[14px] text-red-600">{error}</p> : null}

          <div className="flex flex-wrap gap-3">
            <SecondaryButton onClick={() => setStep("consent")}>Back</SecondaryButton>
            <PrimaryButton onClick={() => void enableCameraPreview()}>
              Enable camera
            </PrimaryButton>
            <PrimaryButton
              onClick={() => setStep("condition")}
              disabled={!cameraPreviewActive}
            >
              Continue
            </PrimaryButton>
          </div>
        </section>
      ) : null}

      {step === "condition" ? (
        <section className="space-y-6">
          <h1 className="text-[22px] font-bold text-[#0A0F1A]">Movement condition</h1>
          <p className="text-[14px] leading-relaxed text-[#6B7280]">
            Select how you will perform the next repetitions. This is{" "}
            <strong className="font-semibold text-[#374151]">protocol metadata only</strong> — not a
            therapist label, not ground truth, and not an ML prediction.
          </p>

          <div className="space-y-3">
            {VOLUNTEER_PROTOCOL_CONDITIONS.map((condition) => (
              <label
                key={condition}
                className={`block cursor-pointer rounded-lg border p-4 ${
                  protocolCondition === condition
                    ? "border-[#0A0F1A] bg-white"
                    : "border-[#E2E8E5] bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="protocolCondition"
                    className="mt-1"
                    checked={protocolCondition === condition}
                    onChange={() => setProtocolCondition(condition)}
                    disabled={running}
                  />
                  <div>
                    <p className="text-[14px] font-semibold text-[#0A0F1A]">
                      {VOLUNTEER_PROTOCOL_CONDITION_LABELS[condition]}
                    </p>
                    <p className="mt-1 text-[13px] text-[#6B7280]">
                      {VOLUNTEER_PROTOCOL_CONDITION_INSTRUCTIONS[condition]}
                    </p>
                  </div>
                </div>
              </label>
            ))}
          </div>

          {running ? (
            <p className="text-[13px] text-[#9CA3AF]">
              Stop the capture session before changing the movement condition.
            </p>
          ) : null}

          <div className="flex gap-3">
            <SecondaryButton onClick={() => setStep("camera")} disabled={running}>
              Back
            </SecondaryButton>
            <PrimaryButton onClick={() => setStep("capture")} disabled={running}>
              Continue to capture
            </PrimaryButton>
          </div>
        </section>
      ) : null}

      {step === "capture" ? (
        <section className="space-y-6">
          <h1 className="text-[22px] font-bold text-[#0A0F1A]">Guided capture</h1>
          <p className="text-[14px] text-[#6B7280]">
            Perform shoulder abduction reach repetitions with your{" "}
            <strong className="font-semibold text-[#374151]">{VOLUNTEER_CAPTURE_SIDE}</strong> arm.
            Target: <strong>{VOLUNTEER_TARGET_REPS}</strong> successfully captured technical
            repetitions.
          </p>
          <p className="rounded-lg border border-[#E2E8E5] bg-white px-4 py-3 text-[13px] text-[#6B7280]">
            Condition:{" "}
            <span className="font-medium text-[#374151]">
              {VOLUNTEER_PROTOCOL_CONDITION_LABELS[protocolCondition]}
            </span>
            {" — "}
            {VOLUNTEER_PROTOCOL_CONDITION_INSTRUCTIONS[protocolCondition]}
          </p>

          <div className="relative aspect-[4/3] w-full max-w-[640px] overflow-hidden rounded-lg bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
          </div>

          <dl className="grid grid-cols-2 gap-3 text-[13px] text-[#6B7280] sm:grid-cols-4">
            <div>
              <dt className="font-medium text-[#9CA3AF]">Side</dt>
              <dd className="text-[#374151]">{VOLUNTEER_CAPTURE_SIDE}</dd>
            </div>
            <div>
              <dt className="font-medium text-[#9CA3AF]">Tracking</dt>
              <dd className="text-[#374151]">{snapshot?.trackingStatus ?? "idle"}</dd>
            </div>
            <div>
              <dt className="font-medium text-[#9CA3AF]">Live reps</dt>
              <dd className="text-[#374151]">{snapshot?.primaryRepCount ?? 0}</dd>
            </div>
            <div>
              <dt className="font-medium text-[#9CA3AF]">Captured</dt>
              <dd className="text-[#374151]">
                {capturedCount} / {VOLUNTEER_TARGET_REPS}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-[#9CA3AF]">Rejected</dt>
              <dd className="text-[#374151]">
                {rejectedCount}
                {lastRejection
                  ? ` (${lastRejection.reason})`
                  : ""}
              </dd>
            </div>
          </dl>

          {error ? <p className="text-[14px] text-red-600">{error}</p> : null}

          <div className="flex flex-wrap gap-3">
            <PrimaryButton
              onClick={() => void startCapture()}
              disabled={starting || running || isCaptureComplete(capturedCount)}
            >
              Start
            </PrimaryButton>
            <SecondaryButton onClick={stopDetector} disabled={!running}>
              Stop
            </SecondaryButton>
            <SecondaryButton
              onClick={() => {
                resetSession();
                setStep("condition");
              }}
              disabled={running}
            >
              Reset session
            </SecondaryButton>
          </div>

          {isCaptureComplete(capturedCount) ? (
            <PrimaryButton onClick={() => setStep("summary")}>View summary</PrimaryButton>
          ) : null}
        </section>
      ) : null}

      {step === "summary" && summary ? (
        <section className="space-y-6">
          <h1 className="text-[22px] font-bold text-[#0A0F1A]">Session complete</h1>
          <p className="text-[14px] text-[#6B7280]">
            Thank you. The following technical capture summary was held in memory only. If you
            refresh or close this page, it will disappear — that is expected for this pilot.
          </p>

          <div className="rounded-lg border border-[#E2E8E5] bg-white p-4 text-[14px] text-[#374151]">
            <dl className="space-y-3">
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                  Completed repetitions
                </dt>
                <dd className="mt-1 text-[18px] font-semibold">{summary.capturedCount}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                  Protocol condition (metadata only)
                </dt>
                <dd className="mt-1">{VOLUNTEER_PROTOCOL_CONDITION_LABELS[summary.protocolCondition]}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                  Side
                </dt>
                <dd className="mt-1">{summary.side}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                  Rejected stubs
                </dt>
                <dd className="mt-1">{summary.rejectedCount}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                  Last tracking status
                </dt>
                <dd className="mt-1">{summary.lastTrackingStatus}</dd>
              </div>
            </dl>
          </div>

          <p className="text-[13px] text-[#9CA3AF]">
            No therapist labels or clinical scores are shown here. This data was not uploaded.
          </p>

          <PrimaryButton
            onClick={() => {
              stopAll();
              setStep("welcome");
              setConsent({ ageConfirmed: false, participationAgreed: false });
              setProtocolCondition("NORMAL");
              resetSession();
            }}
          >
            Finish / Exit
          </PrimaryButton>
        </section>
      ) : null}
    </VolunteerWizardShell>
  );
}
