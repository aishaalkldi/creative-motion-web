"use client";

/**
 * Shoulder Abduction Reach shadow mode — CV Lab hook.
 *
 * The only browser-glue layer on top of
 * `shoulder-abduction-reach-cv-lab-shadow-runner.ts`. Renders nothing and
 * returns nothing consumed by JSX — `CvLabSession.tsx`'s rendered output is
 * identical whether shadow mode is on or off. All observation happens via
 * console output inside the shared shadow log module.
 */

import { useEffect, useRef } from "react";
import {
  createShoulderAbductionReachCvLabShadowRunner,
  type ShoulderAbductionReachCvLabShadowRunner,
} from "./shoulder-abduction-reach-cv-lab-shadow-runner";

export type UseShoulderAbductionReachCvLabShadowOptions = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Mirrors CvLabSession's own previewActive — the runner starts/stops with it. */
  active: boolean;
};

export function useShoulderAbductionReachCvLabShadow({
  videoRef,
  active,
}: UseShoulderAbductionReachCvLabShadowOptions): void {
  const runnerRef = useRef<ShoulderAbductionReachCvLabShadowRunner | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    const runner = createShoulderAbductionReachCvLabShadowRunner();
    runnerRef.current = runner;
    runner.start(video);

    return () => {
      runner.stop();
      runnerRef.current = null;
    };
  }, [active, videoRef]);
}
