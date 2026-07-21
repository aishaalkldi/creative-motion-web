/**
 * Run: npx tsx --test app/lib/interactive-shoulder-plan-discoverability.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getLibraryExerciseById,
  getLibraryExercisesByRegion,
} from "./exercise-library-v1";
import {
  INTERACTIVE_SHOULDER_LIBRARY_EXERCISE_ID,
  isInteractiveShoulderSessionWired,
} from "./interactive-shoulder/interactive-shoulder-exercise-ids";
import { PILOT_PROGRAM_TEMPLATES } from "./program-templates";
import { resolveExerciseByName } from "./exercise-resolve";

const UPPER_LIMB_REACHING_LABEL = "Upper Limb Reaching (Seated)";
const SHOULDER_FOUNDATION_ID = "shoulder-foundation-01";

function collectTemplateExerciseIds(templateId: string): string[] {
  const template = PILOT_PROGRAM_TEMPLATES.find((entry) => entry.id === templateId);
  if (!template) return [];
  return template.sessions.flatMap((session) =>
    session.exercises
      .map((exercise) => (typeof exercise === "string" ? null : exercise.exerciseId))
      .filter((exerciseId): exerciseId is string => Boolean(exerciseId)),
  );
}

describe("interactive shoulder plan discoverability", () => {
  it("lists upper-limb-reaching-seated in shoulder-region library results", () => {
    const entry = getLibraryExerciseById(INTERACTIVE_SHOULDER_LIBRARY_EXERCISE_ID);
    assert.ok(entry);
    assert.equal(entry.exerciseId, "upper-limb-reaching-seated");
    assert.equal(entry.bodyRegion, "shoulder");

    const shoulderRegion = getLibraryExercisesByRegion("shoulder");
    assert.ok(
      shoulderRegion.some((exercise) => exercise.exerciseId === INTERACTIVE_SHOULDER_LIBRARY_EXERCISE_ID),
    );
  });

  it("includes Upper Limb Reaching (Seated) in shoulder-foundation-01", () => {
    const resolved = resolveExerciseByName(UPPER_LIMB_REACHING_LABEL);
    assert.equal(resolved.entry?.exerciseId, INTERACTIVE_SHOULDER_LIBRARY_EXERCISE_ID);

    const exerciseIds = collectTemplateExerciseIds(SHOULDER_FOUNDATION_ID);
    assert.ok(exerciseIds.includes(INTERACTIVE_SHOULDER_LIBRARY_EXERCISE_ID));

    const template = PILOT_PROGRAM_TEMPLATES.find((entry) => entry.id === SHOULDER_FOUNDATION_ID);
    assert.ok(template);
    const prescribed = template.sessions
      .flatMap((session) => session.exercises)
      .find(
        (exercise) =>
          typeof exercise !== "string" &&
          exercise.exerciseId === INTERACTIVE_SHOULDER_LIBRARY_EXERCISE_ID,
      );
    assert.ok(prescribed && typeof prescribed !== "string");
    assert.equal(prescribed.name, UPPER_LIMB_REACHING_LABEL);
  });

  it("keeps exercise ID and patient runtime wiring unchanged", () => {
    assert.equal(INTERACTIVE_SHOULDER_LIBRARY_EXERCISE_ID, "upper-limb-reaching-seated");
    assert.equal(isInteractiveShoulderSessionWired("upper-limb-reaching-seated"), true);
    assert.equal(isInteractiveShoulderSessionWired("sit-to-stand"), false);
  });
});
