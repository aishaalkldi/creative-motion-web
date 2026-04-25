export type SideCue = "left" | "right";

export type GamePhase =
  | "idle"
  | "countdown"
  | "playing"
  | "paused"
  | "complete";

export type SideStepGameState = {
  phase: GamePhase;
  countdown: number;
  /** Seconds remaining in the active round. */
  timeRemaining: number;
  score: number;
  correctReps: number;
  wrongReps: number;
  currentCue: SideCue | null;
  /** Brief UI feedback after a tap. */
  lastFeedback: "correct" | "wrong" | null;
  combo: number;
};
