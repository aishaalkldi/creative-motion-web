import type { SessionBlockType, SessionState } from "@/app/lib/session-orchestrator/types";

/**
 * Block Runner contract (PR1 — additive, not yet consumed by production).
 *
 * A Block Runner is the formal seam between the Session Engine and a
 * specific block's tick-by-tick interaction logic. It does not replace or
 * reimplement any existing lifecycle module — `target-lifecycle.ts` and
 * `motion-patterns/pattern-lifecycle.ts` remain the source of truth for
 * their respective state machines. A Block Runner is a thin, mechanical
 * wrapper that exposes an existing lifecycle's gated tick function and
 * initial-state constructor through one shared shape, so a future caller
 * (PR2/PR3) can dispatch by `blockType` instead of an inline if/else.
 *
 * Each runner is generic over its own state, tick-input, and completion
 * event types, because the two runners this PR wraps genuinely need
 * different inputs (target mode needs spawn bounds and side; pattern mode
 * needs a resolved path). Forcing them into one non-generic shape would
 * mean inventing a union input type nothing asks for yet. `TInitArgs`
 * exists for the same reason: `createInitialTargetLifecycle()` takes no
 * arguments, `createInitialPatternLifecycle(patternId)` takes one — the
 * contract reflects that rather than papering over it.
 */
export type BlockRunnerTickResult<TState, TCompletionEvent> = {
  state: TState;
  /** False whenever the session state disallows ticking (mirrors the existing *-gating.ts convention). */
  ticked: boolean;
  completionEvent: TCompletionEvent | null;
};

export type BlockRunner<TState, TTickInput, TCompletionEvent, TInitArgs = void> = {
  readonly blockType: SessionBlockType;
  /** Builds this runner's initial state. Argument shape is runner-specific — see the module doc above. */
  createInitialState: (initArgs: TInitArgs) => TState;
  /**
   * Advances the runner by one tick. Must no-op (ticked: false, state
   * unchanged) whenever `sessionState` is anything other than "active" —
   * every existing lifecycle already guarantees this; the wrapper must not
   * weaken it.
   */
  tick: (
    sessionState: SessionState,
    state: TState,
    input: TTickInput,
  ) => BlockRunnerTickResult<TState, TCompletionEvent>;
};
