/**
 * Developer-only patient CV camera diagnostics (?cvDebug=1).
 */

import { isVideoPreviewRenderable } from "@/app/lib/cv/patient-camera-stream";

export function isPatientCvDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("cvDebug") === "1";
}

export type PatientCvDebugSnapshot = {
  videoWidth: number;
  videoHeight: number;
  readyState: number;
  streamActive: boolean;
  framesReceived: number;
  previewVisible: boolean;
  paused: boolean;
  hasSrcObject: boolean;
  clientWidth: number;
  clientHeight: number;
};

function streamFromVideo(video: HTMLVideoElement | null): MediaStream | null {
  const raw = video?.srcObject;
  if (!raw || typeof raw !== "object") return null;
  if (typeof (raw as MediaStream).getVideoTracks === "function") {
    return raw as MediaStream;
  }
  return null;
}

export function collectPatientCvDebugSnapshot(
  video: HTMLVideoElement | null,
  framesReceived: number,
): PatientCvDebugSnapshot {
  const stream = streamFromVideo(video);
  return {
    videoWidth: video?.videoWidth ?? 0,
    videoHeight: video?.videoHeight ?? 0,
    readyState: video?.readyState ?? -1,
    streamActive: Boolean(stream?.active),
    framesReceived,
    previewVisible: isVideoPreviewRenderable(video),
    paused: video?.paused ?? true,
    hasSrcObject: Boolean(video?.srcObject),
    clientWidth: video?.clientWidth ?? 0,
    clientHeight: video?.clientHeight ?? 0,
  };
}
