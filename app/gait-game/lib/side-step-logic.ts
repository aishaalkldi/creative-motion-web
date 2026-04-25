import type { SideCue, SideStepGameState } from "./types";

export const ROUND_SECONDS = 60;
export const COUNTDOWN_FROM = 3;
export const CUE_INTERVAL_MS = 3500;
export const SCORE_CORRECT = 10;
export const SCORE_WRONG = -4;
export const COMBO_BONUS = 2;

/** Prefer alternating sides for a realistic side-step pattern. */
export function nextCue(prev: SideCue | null): SideCue {
  if (prev === null) return Math.random() < 0.5 ? "left" : "right";
  return prev === "left" ? "right" : "left";
}

export function initialState(): SideStepGameState {
  return {
    phase: "idle",
    countdown: COUNTDOWN_FROM,
    timeRemaining: ROUND_SECONDS,
    score: 0,
    correctReps: 0,
    wrongReps: 0,
    currentCue: null,
    lastFeedback: null,
    combo: 0,
  };
}

export function applyCorrect(s: SideStepGameState): SideStepGameState {
  const combo = s.combo + 1;
  const bonus = combo >= 3 ? (combo - 2) * COMBO_BONUS : 0;
  return {
    ...s,
    score: s.score + SCORE_CORRECT + bonus,
    correctReps: s.correctReps + 1,
    lastFeedback: "correct",
    combo,
  };
}

export function applyWrong(s: SideStepGameState): SideStepGameState {
  return {
    ...s,
    score: Math.max(0, s.score + SCORE_WRONG),
    wrongReps: s.wrongReps + 1,
    lastFeedback: "wrong",
    combo: 0,
  };
}
