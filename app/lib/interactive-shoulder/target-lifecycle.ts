import {
  DEFAULT_TARGET_HIT_CONFIG,
  isWristInsideTarget,
  shouldRegisterTargetHit,
} from "./target-hit";
import { generateTherapeuticTarget } from "./target-generator";
import type { ShoulderAbductionReachSide } from "@/app/lib/shoulder-rehabilitation";
import {
  createEmptyShoulderInteractionMetrics,
  type NormalizedPoint,
  type SafeTargetBounds,
  type ShoulderInteractionMetrics,
  type TargetAttemptStartEvent,
  type TargetAttemptTimeoutEvent,
  type TargetHitConfig,
  type TargetHitEvent,
  type TherapeuticTarget,
} from "./types";

export type TargetLifecycleState = {
  currentTarget: TherapeuticTarget | null;
  /** Target currently playing an exit animation — hit registration is locked. */
  exitingTarget: TherapeuticTarget | null;
  /** Blocks spawn and additional hits until the exit transition completes. */
  spawnLockedUntilMs: number | null;
  wristInside: boolean;
  targetHit: boolean;
  sequence: number;
  interaction: ShoulderInteractionMetrics;
  /**
   * Compensation reported by the caller during the CURRENT attempt, or null when the
   * caller supplied none. Attempt-scoped: reset on every spawn so it can never leak into
   * the next target. Metadata only — it never influences hits, timeouts or difficulty.
   */
  attemptCompensationObserved: boolean | null;
};

export function createInitialTargetLifecycle(): TargetLifecycleState {
  return {
    currentTarget: null,
    exitingTarget: null,
    spawnLockedUntilMs: null,
    wristInside: false,
    targetHit: false,
    sequence: 0,
    interaction: createEmptyShoulderInteractionMetrics(),
    attemptCompensationObserved: null,
  };
}

export type TargetLifecycleTickInput = {
  wrist: NormalizedPoint | null;
  /** Presentation/event clock. Drives reaction times and the spawn lock — never expiration. */
  nowMs: number;
  side: ShoulderAbductionReachSide;
  bounds: SafeTargetBounds;
  hitConfig?: TargetHitConfig;
  random?: () => number;
  /** Presentation-only delay before the next target spawns after a hit. Default 0. */
  hitExitTransitionMs?: number;
  /**
   * Pause-aware active block elapsed seconds, as produced by the orchestrator. ATTEMPT
   * CLOCK: the only clock attempt expiration is allowed to read. Because the orchestrator
   * freezes this value during pause and safety hold, a frozen session cannot expire an
   * attempt, and a resumed one continues from the same elapsed point. Omitted by legacy
   * callers, which disables expiration entirely.
   */
  blockElapsedSeconds?: number;
  /**
   * Time the patient is given to reach the active target, in ms.
   *
   * CLINICAL PARAMETER — the lifecycle ships no default and invents none. Omitted (or not
   * a finite value greater than 0) means the feature is off and the lifecycle behaves
   * exactly as it did before attempt expiration existed.
   */
  attemptTimeoutMs?: number;
  /**
   * Placement level in degrees to stamp on the next spawned target. Geometry only, and
   * never defaulted — see `TherapeuticTarget.levelDegrees`.
   */
  levelDegrees?: number;
  /**
   * Caller-reported compensation for the current attempt. The lifecycle only accumulates
   * it (sticky until the next spawn) and passes it through on the terminal event; it runs
   * no detector of its own and draws no conclusion from it.
   */
  compensationObservedDuringAttempt?: boolean;
};

export type TargetLifecycleTickResult = {
  state: TargetLifecycleState;
  hitEvent: TargetHitEvent | null;
  /**
   * Attempt starts produced by this tick, in spawn order — exactly one per spawned
   * target, and empty when nothing spawned. It is a list rather than a single slot
   * because one tick legitimately spawns twice (a target that spawns and is contacted
   * on the same tick immediately spawns its successor); a single slot would silently
   * drop an attempt identity.
   */
  attemptStartedEvents: TargetAttemptStartEvent[];
  /** Emitted at most once per target, and never together with a `hitEvent` for it. */
  attemptTimeoutEvent: TargetAttemptTimeoutEvent | null;
};

/**
 * Reads the caller's attempt timeout as a feature switch.
 *
 * Returns null — meaning "expiration is off, behave exactly as before this feature
 * existed" — for an omitted value and for any value that could not describe a real
 * reach window (non-finite, zero or negative). `DifficultyConfig` is validated upstream
 * by `validateDifficultyConfig`, so this is not a second validator: it is the local
 * enabled/disabled predicate for a publicly callable function whose `number` type cannot
 * by itself exclude NaN. It deliberately does not throw and does not substitute a
 * fallback timeout, because a reach window is a clinical parameter this layer may not
 * invent.
 */
function resolveConfiguredAttemptTimeoutMs(value: number | undefined): number | null {
  if (value === undefined) return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

/**
 * Pause-aware active attempt duration in ms, or null when it cannot be computed —
 * which is the case for every legacy caller that ticks without block elapsed time.
 *
 * Clamped at 0 so that block elapsed time restarting at a block boundary can never
 * expire an attempt through a negative interval.
 */
function resolveAttemptActiveElapsedMs(
  target: TherapeuticTarget,
  blockElapsedSeconds: number | undefined,
): number | null {
  const baselineS = target.spawnedAtBlockElapsedS;
  if (baselineS === undefined || !Number.isFinite(baselineS)) return null;
  if (blockElapsedSeconds === undefined || !Number.isFinite(blockElapsedSeconds)) return null;
  return Math.max(0, (blockElapsedSeconds - baselineS) * 1000);
}

type SpawnResult = {
  state: TargetLifecycleState;
  attemptStartedEvent: TargetAttemptStartEvent;
};

/**
 * Spawns the next target and, with it, starts exactly one attempt. Attempt identity is
 * the target's own id/sequence — no separate attempt counter exists to drift from it.
 *
 * Every attempt-scoped value is re-established here, so no terminal state and no attempt
 * metadata from the previous target can leak forward.
 */
function spawnNextTarget(
  state: TargetLifecycleState,
  input: TargetLifecycleTickInput,
): SpawnResult {
  const nextSequence = state.sequence + 1;
  const generated = generateTherapeuticTarget({
    bounds: input.bounds,
    side: input.side,
    nowMs: input.nowMs,
    sequence: nextSequence,
    previousTarget: state.currentTarget,
    random: input.random,
  });
  // Optional metadata is attached only when the caller actually supplied it — an absent
  // level stays absent rather than becoming a fabricated clinical default.
  const target: TherapeuticTarget = { ...generated };
  if (input.levelDegrees !== undefined && Number.isFinite(input.levelDegrees)) {
    target.levelDegrees = input.levelDegrees;
  }
  if (input.blockElapsedSeconds !== undefined && Number.isFinite(input.blockElapsedSeconds)) {
    target.spawnedAtBlockElapsedS = input.blockElapsedSeconds;
  }
  return {
    state: {
      ...state,
      sequence: nextSequence,
      currentTarget: target,
      wristInside: false,
      targetHit: false,
      attemptCompensationObserved: null,
      interaction: {
        ...state.interaction,
        targetsShown: state.interaction.targetsShown + 1,
      },
    },
    attemptStartedEvent: {
      targetId: target.id,
      sequence: nextSequence,
      startedAtMs: target.spawnedAtMs,
      startedAtBlockElapsedS: target.spawnedAtBlockElapsedS ?? null,
      side: input.side,
      ...(target.levelDegrees !== undefined ? { levelDegrees: target.levelDegrees } : {}),
    },
  };
}

export function tickTargetLifecycle(
  state: TargetLifecycleState,
  input: TargetLifecycleTickInput,
): TargetLifecycleTickResult {
  const config = input.hitConfig ?? DEFAULT_TARGET_HIT_CONFIG;
  const exitTransitionMs = input.hitExitTransitionMs ?? 0;
  let next = state;
  const attemptStartedEvents: TargetAttemptStartEvent[] = [];

  const spawn = (from: TargetLifecycleState): TargetLifecycleState => {
    const spawned = spawnNextTarget(from, input);
    attemptStartedEvents.push(spawned.attemptStartedEvent);
    return spawned.state;
  };

  if (next.spawnLockedUntilMs !== null) {
    if (input.nowMs < next.spawnLockedUntilMs) {
      // Presentation exit transition. No target is active, so no attempt is running and
      // nothing here can expire.
      return {
        state: { ...next, wristInside: false },
        hitEvent: null,
        attemptStartedEvents,
        attemptTimeoutEvent: null,
      };
    }
    next = spawn({
      ...next,
      exitingTarget: null,
      spawnLockedUntilMs: null,
      wristInside: false,
      targetHit: false,
    });
  }

  if (!next.currentTarget && !next.spawnLockedUntilMs) {
    next = spawn(next);
  }

  // Sticky for the current attempt only; `spawnNextTarget` clears it for the next one.
  if (input.compensationObservedDuringAttempt !== undefined && next.currentTarget) {
    next = {
      ...next,
      attemptCompensationObserved:
        next.attemptCompensationObserved === true || input.compensationObservedDuringAttempt,
    };
  }

  if (input.wrist && next.currentTarget) {
    const isInside = isWristInsideTarget(input.wrist, next.currentTarget, config);
    if (shouldRegisterTargetHit(next.wristInside, isInside, next.targetHit)) {
      const hitTarget = next.currentTarget;
      const reactionTimeMs = Math.max(0, input.nowMs - hitTarget.spawnedAtMs);
      const compensated = next.attemptCompensationObserved;
      const hitEvent: TargetHitEvent = {
        targetId: hitTarget.id,
        capturedAtMs: input.nowMs,
        reactionTimeMs,
        sequence: next.sequence,
        ...(hitTarget.levelDegrees !== undefined
          ? { levelDegrees: hitTarget.levelDegrees }
          : {}),
        ...(compensated !== null ? { compensatedDuringAttempt: compensated } : {}),
      };
      next = {
        ...next,
        wristInside: isInside,
        targetHit: true,
        interaction: {
          ...next.interaction,
          targetsReached: next.interaction.targetsReached + 1,
          targetHitTimestampsMs: [...next.interaction.targetHitTimestampsMs, input.nowMs],
          reactionTimesMs: [...next.interaction.reactionTimesMs, reactionTimeMs],
        },
      };
      if (exitTransitionMs > 0) {
        next = {
          ...next,
          currentTarget: null,
          exitingTarget: hitTarget,
          spawnLockedUntilMs: input.nowMs + exitTransitionMs,
          wristInside: false,
          targetHit: false,
        };
        return { state: next, hitEvent, attemptStartedEvents, attemptTimeoutEvent: null };
      }
      next = spawn(next);
      return {
        state: { ...next, wristInside: false },
        hitEvent,
        attemptStartedEvents,
        attemptTimeoutEvent: null,
      };
    }
    next = { ...next, wristInside: isInside };
  } else {
    next = { ...next, wristInside: false };
  }

  // ATTEMPT EXPIRATION — evaluated only after contact has had its chance above.
  //
  // BOUNDARY PRECEDENCE: contact wins. At exactly `activeElapsedMs === attemptTimeoutMs`
  // a qualifying wrist entry has already returned a success above, so the same target can
  // never produce both results. The order is the rule, not an accident of if-placement:
  // the wrist is demonstrably inside the target on this tick, and reporting an incomplete
  // attempt against visible contact would be a false negative.
  //
  // This runs whether or not a wrist was available, because expiration is caused by
  // elapsed active time alone — never by `wrist === null`. Tracking loss is not patient
  // failure and is not represented here at all: the orchestrator freezes block elapsed
  // time during safety hold and the gating layer stops ticking, so a lost tracker cannot
  // burn attempt time.
  const attemptTimeoutMs = resolveConfiguredAttemptTimeoutMs(input.attemptTimeoutMs);
  const blockElapsedSeconds = input.blockElapsedSeconds;
  if (
    attemptTimeoutMs !== null &&
    blockElapsedSeconds !== undefined &&
    Number.isFinite(blockElapsedSeconds) &&
    next.currentTarget &&
    // Redundant today — every contact path above returns — and deliberately kept as a
    // second lock on "a contacted target never also expires" if that early return is ever
    // restructured. No test can kill it while the early return stands.
    !next.targetHit
  ) {
    const expiringTarget = next.currentTarget;
    const activeElapsedMs = resolveAttemptActiveElapsedMs(expiringTarget, blockElapsedSeconds);
    if (activeElapsedMs !== null && activeElapsedMs >= attemptTimeoutMs) {
      const compensated = next.attemptCompensationObserved;
      const attemptTimeoutEvent: TargetAttemptTimeoutEvent = {
        targetId: expiringTarget.id,
        sequence: next.sequence,
        expiredAtMs: input.nowMs,
        expiredAtBlockElapsedS: blockElapsedSeconds,
        activeElapsedMs,
        attemptTimeoutMs,
        ...(expiringTarget.levelDegrees !== undefined
          ? { levelDegrees: expiringTarget.levelDegrees }
          : {}),
        ...(compensated !== null ? { compensatedDuringAttempt: compensated } : {}),
      };
      // The expired attempt is terminal: its target is replaced here, exactly as a hit
      // with no exit transition replaces its own. Nothing holds a reference that could
      // expire a second time, and the successor spawns with a fresh attempt baseline.
      // No exit transition, no spawn lock and no exiting target are used — those are hit
      // presentation effects, and an expired attempt produces no patient-facing feedback.
      next = spawn(next);
      return {
        state: { ...next, wristInside: false },
        hitEvent: null,
        attemptStartedEvents,
        attemptTimeoutEvent,
      };
    }
  }

  return { state: next, hitEvent: null, attemptStartedEvents, attemptTimeoutEvent: null };
}
