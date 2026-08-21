"use client";

/**
 * Volunteer capture session — Slice 8A (in-memory only, no network persistence).
 * Reuses ShoulderAbductionReachPoseDetector + volunteer in-memory capture sink.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ShoulderAbductionReachPoseDetector,
  type ShoulderAbductionReachPoseDetectorSnapshot,
} from "@/app/lib/cv/shoulder-abduction-reach-pose-detector";
import type { ShoulderAbductionReachSide } from "@/app/lib/shoulder-rehabilitation";
import type { ShoulderAbductionReachRepCaptureRecord } from "@/app/lib/ml-research/shoulder-abduction-reach/capture-schema";
import type { ShoulderAbductionReachRejectedCapture } from "@/app/lib/ml-research/shoulder-abduction-reach/rep-recorder";
import { createVolunteerInMemoryCaptureSink } from "@/app/volunteer/shoulder-abduction-reach/volunteer-capture-sink";
import {
  isCaptureComplete,
  type VolunteerProtocolCondition,
} from "@/app/volunteer/shoulder-abduction-reach/volunteer-protocol";

const IN_MEMORY_PARTICIPANT_ID = "volunteer-local-participant";
const IN_MEMORY_SESSION_ID = "volunteer-local-session";

export type UseVolunteerCaptureSessionOptions = {
  side: ShoulderAbductionReachSide;
  protocolCondition: VolunteerProtocolCondition;
  onTargetReached?: () => void;
};

export function useVolunteerCaptureSession({
  side,
  protocolCondition,
  onTargetReached,
}: UseVolunteerCaptureSessionOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<ShoulderAbductionReachPoseDetector | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  const [cameraPreviewActive, setCameraPreviewActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ShoulderAbductionReachPoseDetectorSnapshot | null>(null);
  const [capturedRecords, setCapturedRecords] = useState<ShoulderAbductionReachRepCaptureRecord[]>([]);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [lastRejection, setLastRejection] = useState<ShoulderAbductionReachRejectedCapture | null>(null);

  const stopPreviewStream = useCallback(() => {
    previewStreamRef.current?.getTracks().forEach((track) => track.stop());
    previewStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraPreviewActive(false);
  }, []);

  const handleRepCaptured = useCallback(
    (record: ShoulderAbductionReachRepCaptureRecord) => {
      setCapturedRecords((records) => {
        const next = [...records, record];
        if (isCaptureComplete(next.length)) {
          onTargetReached?.();
        }
        return next;
      });
    },
    [onTargetReached],
  );

  const handleRepRejected = useCallback((rejected: ShoulderAbductionReachRejectedCapture) => {
    setRejectedCount((count) => count + 1);
    setLastRejection(rejected);
  }, []);

  const captureSink = useMemo(
    () =>
      createVolunteerInMemoryCaptureSink({
        participantId: IN_MEMORY_PARTICIPANT_ID,
        sessionId: IN_MEMORY_SESSION_ID,
        side,
        protocolCondition,
        onRepCaptured: handleRepCaptured,
        onRepRejected: handleRepRejected,
      }),
    [side, protocolCondition, handleRepCaptured, handleRepRejected],
  );

  const stopDetector = useCallback(() => {
    detectorRef.current?.stop();
    detectorRef.current = null;
    setRunning(false);
  }, []);

  const stopAll = useCallback(() => {
    stopDetector();
    stopPreviewStream();
  }, [stopDetector, stopPreviewStream]);

  const enableCameraPreview = useCallback(async () => {
    if (!videoRef.current) return;
    stopPreviewStream();
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is not available in this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      previewStreamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraPreviewActive(true);
    } catch (err) {
      const message =
        err instanceof Error && err.name === "NotAllowedError"
          ? "Camera permission was denied. Please allow camera access and try again."
          : err instanceof Error
            ? err.message
            : "Failed to access the camera.";
      setError(message);
      setCameraPreviewActive(false);
    }
  }, [stopPreviewStream]);

  const startCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    stopDetector();
    stopPreviewStream();
    setStarting(true);
    setError(null);
    try {
      const detector = new ShoulderAbductionReachPoseDetector(
        {
          onSnapshot: setSnapshot,
          onDevFrameCaptured: captureSink.handleFrame,
        },
        side,
      );
      detectorRef.current = detector;
      await detector.start(videoRef.current, canvasRef.current);
      setRunning(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start capture session.");
      setRunning(false);
    } finally {
      setStarting(false);
    }
  }, [side, captureSink, stopDetector, stopPreviewStream]);

  const reattachCameraPreview = useCallback(async () => {
    if (!videoRef.current || !previewStreamRef.current) return;
    setError(null);
    try {
      videoRef.current.srcObject = previewStreamRef.current;
      await videoRef.current.play();
      setCameraPreviewActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to show camera preview.");
    }
  }, []);

  const resetSession = useCallback(() => {
    stopAll();
    setSnapshot(null);
    setCapturedRecords([]);
    setRejectedCount(0);
    setLastRejection(null);
    setError(null);
  }, [stopAll]);

  useEffect(() => {
    return () => {
      detectorRef.current?.stop();
      previewStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return {
    videoRef,
    canvasRef,
    cameraPreviewActive,
    starting,
    running,
    error,
    snapshot,
    capturedRecords,
    capturedCount: capturedRecords.length,
    rejectedCount,
    lastRejection,
    enableCameraPreview,
    reattachCameraPreview,
    startCapture,
    stopDetector,
    stopAll,
    resetSession,
  };
}
