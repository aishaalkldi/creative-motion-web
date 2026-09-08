/**
 * Remote battery speech cues — one utterance per state transition.
 */

import { formatBatteryArmLabel, getBatteryTestDefinition, type RemoteUpperLimbBatterySide, type RemoteUpperLimbBatteryTestId } from "./types";
import { getSideRepositionInstruction } from "./battery-orientation";

const spokenKeys = new Set<string>();

export type BatterySpeechCue =
  | "stand-still"
  | "get-ready"
  | "reposition-side"
  | "countdown-three"
  | "countdown-two"
  | "countdown-one"
  | "abduction-raise"
  | "abduction-return"
  | "flexion-raise"
  | "flexion-return"
  | "elbow-bend"
  | "elbow-straighten"
  | "functional-side-setup"
  | "functional-arm-height"
  | "functional-feet-still"
  | "functional-reach"
  | "functional-return"
  | "rep-one"
  | "rep-two"
  | "rep-three"
  | "test-completed"
  | "assessment-completed";

function resolveText(cue: BatterySpeechCue, side: RemoteUpperLimbBatterySide): string {
  const arm = formatBatteryArmLabel(side);
  switch (cue) {
    case "stand-still":
      return "Stand still.";
    case "get-ready":
      return "Get ready.";
    case "reposition-side":
      return getSideRepositionInstruction(side);
    case "countdown-three":
      return "Three.";
    case "countdown-two":
      return "Two.";
    case "countdown-one":
      return "One.";
    case "abduction-raise":
      return `Raise your ${arm} out to the side.`;
    case "abduction-return":
      return "Return your arm to your side.";
    case "flexion-raise":
      return `Raise your ${arm} forward.`;
    case "flexion-return":
      return "Return your arm to your side.";
    case "elbow-bend":
      return "Bend your elbow.";
    case "elbow-straighten":
      return "Straighten your elbow.";
    case "functional-side-setup":
      return getSideRepositionInstruction(side);
    case "functional-arm-height":
      return "Raise your arm forward to shoulder height.";
    case "functional-feet-still":
      return "Keep your feet still.";
    case "functional-reach":
      return "Reach forward as far as you comfortably can without taking a step.";
    case "functional-return":
      return "Return to the starting position.";
    case "rep-one":
      return "One of three.";
    case "rep-two":
      return "Two of three.";
    case "rep-three":
      return "Three of three.";
    case "test-completed":
      return "Test completed.";
    case "assessment-completed":
      return "Assessment completed.";
  }
}

export function speakBatteryTestCompleted(
  testId: RemoteUpperLimbBatteryTestId,
  side: RemoteUpperLimbBatterySide,
): void {
  if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") return;
  const key = `${testId}:completed:${side}`;
  if (spokenKeys.has(key)) return;
  spokenKeys.add(key);
  try {
    const utterance = new SpeechSynthesisUtterance(
      `${getBatteryTestDefinition(testId).title} completed.`,
    );
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  } catch {
    // optional
  }
}

export function speakBatteryCue(
  cue: BatterySpeechCue,
  side: RemoteUpperLimbBatterySide,
  scope = "global",
): void {
  if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") return;
  const key = `${scope}:${cue}:${side}`;
  if (spokenKeys.has(key)) return;
  spokenKeys.add(key);
  try {
    const utterance = new SpeechSynthesisUtterance(resolveText(cue, side));
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  } catch {
    // optional
  }
}

export function resetBatterySpeech(): void {
  spokenKeys.clear();
  if (typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined") {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

export function resetBatterySpeechForTest(): void {
  spokenKeys.clear();
}
