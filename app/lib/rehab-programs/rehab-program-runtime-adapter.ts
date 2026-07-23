/**
 * Catalog -> SessionOrchestrator runtime adapter (additive, proof only).
 *
 * Converts a static rehab-programs catalog session into a real, executable
 * SessionDefinition. Pure functions only — SessionOrchestrator is never
 * instantiated here; that is the caller's job (the proof test in this
 * module, or a future session-bootstrap step).
 *
 * ProgramSessionBlock is missing several fields MovementBlock requires.
 * Each is either derived from data already on the catalog block
 * (completionMode, from targetDurationSeconds) or filled with a small,
 * explicit, documented value — never invented clinical data. This file
 * adds no safetyRules, repetition/hold prescriptions, side, or intensity
 * to any block.
 */
import type {
  MovementBlock,
  MovementBlockCompletionMode,
  MovementBlockPosition,
  SessionDefinition,
} from "@/app/lib/session-orchestrator/types";
import type { ProgramSession, ProgramSessionBlock } from "./rehab-program-types";

/**
 * Technical version metadata, not a clinical value. Matches existing
 * repo-wide precedent — every MovementBlock defined anywhere in this
 * codebase uses "v1". SessionOrchestrator never reads this field; it is
 * a foreign key into the exercise library only.
 */
const MOVEMENT_VERSION = "v1";

/**
 * supportedPositions for the four blocks of Stroke Upper Limb Recovery
 * Foundation, Session 1 — and ONLY those four blocks. This is not a
 * generic instructional/rehabilitation default; supportedPositions can
 * carry clinical/safety meaning even though SessionOrchestrator does not
 * currently branch on it, so a future program's blocks must supply their
 * own explicit mapping rather than inherit this one.
 *
 * Reach the Light and D1 reuse the exact values already established for
 * those movements in clinical-motion-pattern-session-definition.ts and
 * shoulder-abduction-reach-session-definition.ts (both "seated" and
 * "standing") — not re-derived or guessed here.
 *
 * Warm-up and Cool-down have no existing production MovementBlock to
 * reuse from (the only prior "warm-up"/"cool-down" blocks are in
 * mock-neuro-upper-limb-session.ts, an explicitly-labeled TEST FIXTURE
 * ONLY, not a source of clinical truth). Their positions are decided
 * here specifically for this program, kept consistent with the movement
 * blocks in the same session since the patient does not change position
 * mid-session — a Session-1-specific decision, not a global default.
 */
const STROKE_ULRF_V1_SESSION_1_SUPPORTED_POSITIONS: Readonly<
  Record<string, readonly MovementBlockPosition[]>
> = {
  "stroke-ulrf-v1-session-1-warm-up": ["seated", "standing"],
  "stroke-ulrf-v1-session-1-reach-the-light": ["seated", "standing"],
  "stroke-ulrf-v1-session-1-d1-diagonal-reach": ["seated", "standing"],
  "stroke-ulrf-v1-session-1-cool-down": ["seated", "standing"],
};

/**
 * Throws for any block ID outside the four explicitly mapped above —
 * this adapter must never silently apply a clinical-position assumption
 * to a block it does not specifically recognize.
 */
function resolveSupportedPositions(blockId: string): readonly MovementBlockPosition[] {
  const positions = STROKE_ULRF_V1_SESSION_1_SUPPORTED_POSITIONS[blockId];
  if (!positions) {
    throw new Error(
      `toMovementBlock: no supportedPositions mapping for block "${blockId}". This adapter only ` +
        "knows the four Stroke Upper Limb Recovery Foundation Session 1 block IDs — it must not " +
        "silently apply a clinical-position assumption to an unrecognized block.",
    );
  }
  return positions;
}

/**
 * Derives "duration" only when targetDurationSeconds is a valid positive
 * finite number. Throws otherwise rather than guessing manualCompletion
 * or validRepetitions — this adapter has no data to justify either mode
 * for a block it cannot derive a duration for.
 */
function resolveCompletionMode(block: ProgramSessionBlock): MovementBlockCompletionMode {
  const duration = block.targetDurationSeconds;
  if (duration === undefined || !Number.isFinite(duration) || duration <= 0) {
    throw new Error(
      `toMovementBlock: block "${block.blockId}" has no valid targetDurationSeconds ` +
        `(received: ${String(duration)}). This adapter only derives completionMode "duration" — it ` +
        'must not silently select "manualCompletion" or "validRepetitions" for a mode it cannot infer.',
    );
  }
  return "duration";
}

/**
 * Instructional blocks (Warm-up, Cool-down) correctly carry no
 * exercise-library movementId in the catalog — they reference no
 * measured movement. MovementBlock.movementId is required regardless, so
 * instructional blocks receive an operational label of the form
 * "instructional:<blockId>": never a real exercise identifier, and never
 * mistakeable for Reach the Light's or D1's real movementId. This label
 * is operational bookkeeping only, not a clinical movement measurement.
 *
 * A non-instructional block missing movementId is a catalog defect —
 * this function refuses to invent a movement identifier for a block
 * that claims to measure a real movement.
 */
function resolveMovementId(block: ProgramSessionBlock): string {
  if (block.movementId) return block.movementId;
  if (block.blockType === "instructional") return `instructional:${block.blockId}`;
  throw new Error(
    `toMovementBlock: block "${block.blockId}" (blockType "${block.blockType}") has no movementId and ` +
      "is not instructional — refusing to synthesize a movement identifier for a measured movement block.",
  );
}

export function toMovementBlock(block: ProgramSessionBlock): MovementBlock {
  return {
    blockId: block.blockId,
    movementId: resolveMovementId(block),
    movementVersion: MOVEMENT_VERSION,
    title: block.title,
    instructions: block.instructions,
    completionMode: resolveCompletionMode(block),
    targetDurationSeconds: block.targetDurationSeconds,
    supportedPositions: resolveSupportedPositions(block.blockId),
    blockType: block.blockType,
    feedbackProfile: block.feedbackProfile,
  };
}

export function toSessionDefinition(session: ProgramSession): SessionDefinition {
  return {
    sessionId: session.id,
    title: session.title,
    blocks: session.blocks.map(toMovementBlock),
  };
}
