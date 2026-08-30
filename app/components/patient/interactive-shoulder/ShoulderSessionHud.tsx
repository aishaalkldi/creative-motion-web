"use client";

import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import type { ShoulderInteractionMetrics } from "@/app/lib/interactive-shoulder/types";
import type { PatternInteractionMetrics } from "@/app/lib/interactive-shoulder/motion-patterns/pattern-lifecycle";
import type { FeedbackInteractionMode } from "@/app/lib/interactive-shoulder/motion-patterns/motion-pattern-registry";
import {
  interactiveShoulderUi,
  resolveInteractiveShoulderEncouragement,
  resolveInteractiveShoulderExperienceTitle,
  resolveInteractiveShoulderLiveMessage,
} from "@/app/lib/interactive-shoulder/interactive-shoulder-ui";
import { resolveBlockDisplayCopy } from "@/app/lib/interactive-shoulder/resolve-block-display-copy";
import type { SessionOrchestratorSnapshot } from "@/app/lib/session-orchestrator/types";
import { ShoulderLiveMetricRow, ShoulderLiveSessionLayout } from "./ShoulderLiveSessionLayout";

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
  showBlockSummary: boolean;
  blockSummaryTargetsReached: number;
  blockSummaryPatternsCompleted: number;
  blockSummaryMeasuredReps: number;
  blockSummaryDurationSeconds: number;
  targetHitAnnouncement?: string | null;
  soundMuted: boolean;
  onSoundToggle: () => void;
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
  showBlockSummary,
  blockSummaryTargetsReached,
  blockSummaryPatternsCompleted,
  blockSummaryMeasuredReps,
  blockSummaryDurationSeconds,
  targetHitAnnouncement = null,
  soundMuted,
  onSoundToggle,
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
  const encouragement = resolveInteractiveShoulderEncouragement(language, snapshot);
  const primaryLiveAnnouncement = targetHitAnnouncement ?? liveMessage;
  const guidanceMessage =
    primaryLiveAnnouncement ??
    (snapshot.safetyStatus === "normal" ? encouragement ?? blockCopy.instructions : blockCopy.instructions);
  const blockProgressPercent = Math.round(snapshot.blockProgress * 100);
  const sessionProgressPercent = Math.round(snapshot.sessionProgress * 100);
  const prescribedReps = snapshot.currentBlock?.prescribedRepetitions ?? null;
  const interactionCompleted = isPatternMode
    ? patternInteraction.patternsCompleted
    : targetInteraction.targetsReached;
  const interactionTotal = isPatternMode
    ? patternInteraction.patternsShown
    : targetInteraction.targetsShown;

  if (showBlockSummary) {
    return null;
  }

  const interactionLabel = isPatternMode
    ? ui.interactionPatternsLabel(0, 0).split(":")[0]
    : ui.interactionTargetsLabel(0, 0).split(":")[0];

  return (
    <ShoulderLiveSessionLayout
      language={language}
      arClass={arClass}
      phaseLabel={blockCopy.phaseLabel}
      phaseAccent="exercise"
      title={blockCopy.title}
      timer={remaining !== null ? formatClinicalClock(remaining) : null}
      blockProgressPercent={blockProgressPercent}
      sessionProgressPercent={sessionProgressPercent}
      guidanceMessage={guidanceMessage}
      pausedOrHold={pausedOrHold}
      onPause={onPause}
      onResume={onResume}
      soundMuted={soundMuted}
      onSoundToggle={onSoundToggle}
      metrics={
        <>
          <ShoulderLiveMetricRow
            label={interactionLabel}
            value={`${interactionCompleted}/${interactionTotal || "—"}`}
          />
          <ShoulderLiveMetricRow
            label={ui.measuredRepsLabel(0).replace(/:.*/, "")}
            value={ui.repProgressLabel(measuredReps, prescribedReps)}
          />
        </>
      }
    />
  );
}
