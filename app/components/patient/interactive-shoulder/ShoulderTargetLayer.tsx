"use client";

import type { TherapeuticTarget } from "@/app/lib/interactive-shoulder/types";
import { HitParticleBurst } from "./HitParticleBurst";
import { ReachTheLightOrb } from "./ReachTheLightOrb";

type ShoulderTargetLayerProps = {
  target: TherapeuticTarget | null;
  exitingTarget?: TherapeuticTarget | null;
  hitBurstTarget?: TherapeuticTarget | null;
  reducedMotion?: boolean;
};

export function ShoulderTargetLayer({
  target,
  exitingTarget = null,
  hitBurstTarget = null,
  reducedMotion = false,
}: ShoulderTargetLayerProps) {
  return (
    <>
      {exitingTarget ? (
        <ReachTheLightOrb target={exitingTarget} phase="exiting" reducedMotion={reducedMotion} />
      ) : null}
      {target ? (
        <ReachTheLightOrb target={target} phase="active" reducedMotion={reducedMotion} />
      ) : null}
      {hitBurstTarget ? (
        <HitParticleBurst center={hitBurstTarget} reducedMotion={reducedMotion} />
      ) : null}
    </>
  );
}
