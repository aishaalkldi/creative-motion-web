"use client";

import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import type { ShoulderInteractionMetrics } from "@/app/lib/interactive-shoulder/types";
import type { PatternInteractionMetrics } from "@/app/lib/interactive-shoulder/motion-patterns/pattern-lifecycle";
import type { FeedbackInteractionMode } from "@/app/lib/interactive-shoulder/motion-patterns/motion-pattern-registry";
import {
  interactiveShoulderUi,
  resolveInteractiveShoulderExperienceTitle,
  resolveInteractiveShoulderLiveMessage,
} from "@/app/lib/interactive-shoulder/interactive-shoulder-ui";
import { resolveBlockDisplayCopy } from "@/app/lib/interactive-shoulder/resolve-block-display-copy";
import { resolvePatientLiveInstructionStrip } from "@/app/lib/interactive-shoulder/resolve-patient-live-instruction";
import type { SessionOrchestratorSnapshot } from "@/app/lib/session-orchestrator/types";
import { ShoulderLiveInstructionStrip } from "./ShoulderLiveInstructionStrip";
import { ShoulderLiveStatusRail } from "./ShoulderLiveStatusRail";

type ShoulderSessionHudProps = {
  language: PatientExerciseLanguage;
  arClass?: string;
  snapshot: SessionOrchestratorSnapshot;
  feedbackMode: FeedbackInteractionMode;
  targetInteraction: ShoulderInteractionMetrics;
  patternInteraction: PatternInteractionMetrics;
  measuredReps: number;
  onPause: () => void;
  onResume: () => void;
  soundMuted: boolean;
  onSoundToggle: () => void;
  targetHitAnnouncement?: string | null;
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

export function ShoulderSessionHud({
  language,
  arClass = "",
  snapshot,
  feedbackMode,
  targetInteraction,
  patternInteraction,
  measuredReps,
  onPause,
  onResume,
  soundMuted,
  onSoundToggle,
  targetHitAnnouncement = null,
  placement,
}: ShoulderSessionHudProps) {
  const ui = interactiveShoulderUi(language);
  const isPatternMode = feedbackMode === "motion-pattern";
  const blockCopy = resolveBlockDisplayCopy(
    language,
    snapshot.currentBlock?.blockId,
    resolveInteractiveShoulderExperienceTitle(language, feedbackMode),
    snapshot.currentBlock?.instructions ?? ui.blockInstructions,
  );
  const remaining = formatRemainingSeconds(snapshot);
  const pausedOrHold = snapshot.isPaused || snapshot.safetyStatus === "hold";
  const liveMessage = resolveInteractiveShoulderLiveMessage(language, snapshot);
  const stripMessage = resolvePatientLiveInstructionStrip({
    language,
    blockId: snapshot.currentBlock?.blockId,
    fallbackTitle: blockCopy.title,
    fallbackInstructions: snapshot.currentBlock?.instructions ?? ui.blockInstructions,
    targetHitAnnouncement,
    safetyLiveMessage: liveMessage,
  });
  const blockProgressPercent = Math.round(snapshot.blockProgress * 100);
  const sessionProgressPercent = Math.round(snapshot.sessionProgress * 100);
  const prescribedReps = snapshot.currentBlock?.prescribedRepetitions ?? null;
  const interactionCompleted = isPatternMode
    ? patternInteraction.patternsCompleted
    : targetInteraction.targetsReached;
  const interactionTotal = isPatternMode
    ? patternInteraction.patternsShown
    : targetInteraction.targetsShown;

  if (placement === "strip") {
    return <ShoulderLiveInstructionStrip message={stripMessage} arClass={arClass} />;
  }

  const interactionLabel = isPatternMode
    ? ui.interactionPatternsLabel(0, 0).split(":")[0]
    : ui.interactionTargetsLabel(0, 0).split(":")[0];

  return (
    <ShoulderLiveStatusRail
      language={language}
      arClass={arClass}
      phaseLabel={blockCopy.phaseLabel}
      phaseAccent="exercise"
      title={blockCopy.title}
      timer={remaining !== null ? formatClinicalClock(remaining) : null}
      metrics={[
        { label: interactionLabel, value: `${interactionCompleted}/${interactionTotal || "—"}` },
        {
          label: ui.measuredRepsLabel(0).replace(/:.*/, ""),
          value: ui.repProgressLabel(measuredReps, prescribedReps),
        },
      ]}
      showBlockProgress
      blockProgressPercent={blockProgressPercent}
      sessionProgressPercent={sessionProgressPercent}
      pausedOrHold={pausedOrHold}
      onPause={onPause}
      onResume={onResume}
      soundMuted={soundMuted}
      onSoundToggle={onSoundToggle}
    />
  );
}
