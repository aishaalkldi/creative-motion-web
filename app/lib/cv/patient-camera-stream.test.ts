import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PATIENT_CAMERA_NO_FRAMES_ERROR,
  getMediaStreamTrackDiagnostics,
  isVideoPreviewRenderable,
  wouldDrawImageSucceed,
} from "./patient-camera-stream";

describe("patient-camera-stream", () => {
  it("getMediaStreamTrackDiagnostics returns empty for null stream", () => {
    assert.deepEqual(getMediaStreamTrackDiagnostics(null), []);
  });

  it("isVideoPreviewRenderable requires srcObject and decoded dimensions", () => {
    const video = {
      srcObject: null,
      videoWidth: 640,
      videoHeight: 480,
      readyState: 4,
    } as HTMLVideoElement;
    assert.equal(isVideoPreviewRenderable(video), false);

    const stream = {
      active: true,
      getVideoTracks: () => [{ readyState: "live", enabled: true }],
    } as unknown as MediaStream;

    const ready = {
      srcObject: stream,
      videoWidth: 640,
      videoHeight: 480,
      readyState: 4,
    } as HTMLVideoElement;
    assert.equal(isVideoPreviewRenderable(ready), true);

    const noFrames = {
      srcObject: stream,
      videoWidth: 0,
      videoHeight: 0,
      readyState: 2,
    } as HTMLVideoElement;
    assert.equal(isVideoPreviewRenderable(noFrames), false);
  });

  it("wouldDrawImageSucceed requires dimensions and playback", () => {
    assert.equal(
      wouldDrawImageSucceed({
        videoWidth: 640,
        videoHeight: 480,
        paused: false,
      } as HTMLVideoElement),
      true,
    );
    assert.equal(
      wouldDrawImageSucceed({
        videoWidth: 0,
        videoHeight: 0,
        paused: false,
      } as HTMLVideoElement),
      false,
    );
    assert.equal(wouldDrawImageSucceed(null), false);
  });

  it("exports stable no-frames error token", () => {
    assert.equal(PATIENT_CAMERA_NO_FRAMES_ERROR, "CAMERA_NO_DECODED_FRAMES");
  });
});
