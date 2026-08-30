"use client";

import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import { interactiveShoulderUi } from "@/app/lib/interactive-shoulder/interactive-shoulder-ui";
import {
  isCoolDownBlock,
  isWarmUpBlock,
  resolveBlockDisplayCopy,
} from "@/app/lib/interactive-shoulder/resolve-block-display-copy";
import type { SessionOrchestratorSnapshot } from "@/app/lib/session-orchestrator/types";
import { ShoulderLiveInstructionStrip } from "./ShoulderLiveInstructionStrip";
import { ShoulderLiveStatusRail } from "./ShoulderLiveStatusRail";

type InstructionalBlockLayerProps = {
  language: PatientExerciseLanguage;
  arClass?: string;
  snapshot: SessionOrchestratorSnapshot;
  presentationProgress: number | null;
  onPause: () => void;
  onResume: () => void;
  controlsLocked?: boolean;
  soundMuted: boolean;
  onSoundToggle: () => void;
  placement: "rail" | "strip";
};

function formatRemainingSeconds(snapshot: SessionOrchestratorSnapshot): number | null {
  const block = snapshot.currentBlock;
  if (!block?.targetDurationSeconds) return null;
  const remaining = Math.max(0, block.targetDurationSeconds - snapshot.blockElapsedSeconds);
  return Math.ceil(remaining);
}

function formatClinicalClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function InstructionalBlockLayer({
  language,
  arClass = "",
  snapshot,
  presentationProgress,
  onPause,
  onResume,
  controlsLocked = false,
  soundMuted,
  onSoundToggle,
  placement,
}: InstructionalBlockLayerProps) {
  const ui = interactiveShoulderUi(language);
  const block = snapshot.currentBlock;
  const remaining = formatRemainingSeconds(snapshot);
  const blockProgressPercent =
    presentationProgress != null
      ? Math.round(presentationProgress * 100)
      : Math.round(snapshot.blockProgress * 100);
  const sessionProgressPercent = Math.round(snapshot.sessionProgress * 100);
  const pausedOrHold = snapshot.isPaused || snapshot.safetyStatus === "hold";
  const copy = resolveBlockDisplayCopy(
    language,
    block?.blockId,
    block?.title ?? ui.movementBlockLabel,
    block?.instructions ?? ui.blockInstructions,
  );
  const isWarmUp = isWarmUpBlock(block?.blockId);
  const isCoolDown = isCoolDownBlock(block?.blockId);
  const phaseAccent = isCoolDown ? "cooldown" : isWarmUp ? "warmup" : "exercise";

  if (placement === "strip") {
    return <ShoulderLiveInstructionStrip message={copy.instructions} arClass={arClass} />;
  }

  return (
    <ShoulderLiveStatusRail
      language={language}
      arClass={arClass}
      phaseLabel={copy.phaseLabel}
      phaseAccent={phaseAccent}
      title={copy.title}
      timer={remaining !== null ? formatClinicalClock(remaining) : null}
      metrics={[]}
      showBlockProgress={!isCoolDown}
      blockProgressPercent={blockProgressPercent}
      sessionProgressPercent={sessionProgressPercent}
      pausedOrHold={pausedOrHold}
      onPause={onPause}
      onResume={onResume}
      controlsLocked={controlsLocked}
      soundMuted={soundMuted}
      onSoundToggle={onSoundToggle}
    />
  );
}
