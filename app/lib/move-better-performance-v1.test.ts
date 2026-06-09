/**
 * Run: npx tsx --test app/lib/move-better-performance-v1.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLibraryExerciseById } from "@/app/lib/exercise-library-v1";
import {
  getMoveBetterPerformanceV1SessionExerciseIds,
  MOVE_BETTER_PERFORMANCE_V1,
  MOVE_BETTER_PERFORMANCE_V1_ID,
} from "@/app/lib/move-better-performance-v1";
import { PILOT_PROGRAM_TEMPLATES } from "@/app/lib/program-templates";

function sessionExerciseIds(sessionNumber: number): string[] {
  const template = PILOT_PROGRAM_TEMPLATES.find(
    (t) => t.id === MOVE_BETTER_PERFORMANCE_V1_ID,
  );
  const session = template?.sessions.find((s) => s.sessionNumber === sessionNumber);
  if (!session) return [];
  return session.exercises
    .map((ex) => (typeof ex === "string" ? null : ex.exerciseId))
    .filter((id): id is string => Boolean(id));
}

describe("Move Better Performance v1 template", () => {
  it("exists in program registry", () => {
    const found = PILOT_PROGRAM_TEMPLATES.some((t) => t.id === MOVE_BETTER_PERFORMANCE_V1_ID);
    assert.equal(found, true);
    assert.equal(MOVE_BETTER_PERFORMANCE_V1.id, MOVE_BETTER_PERFORMANCE_V1_ID);
  });

  it("has exactly 6 sessions", () => {
    assert.equal(MOVE_BETTER_PERFORMANCE_V1.sessions.length, 6);
    const pilot = PILOT_PROGRAM_TEMPLATES.find((t) => t.id === MOVE_BETTER_PERFORMANCE_V1_ID);
    assert.equal(pilot?.sessions.length, 6);
  });

  it("S1 includes sit-to-stand, lateral-step, and heel-raise", () => {
    const ids = getMoveBetterPerformanceV1SessionExerciseIds(1);
    assert.ok(ids.includes("sit-to-stand"));
    assert.ok(ids.includes("lateral-step"));
    assert.ok(ids.includes("heel-raise"));
  });

  it("S4 exercises match S1", () => {
    const s1 = getMoveBetterPerformanceV1SessionExerciseIds(1);
    const s4 = getMoveBetterPerformanceV1SessionExerciseIds(4);
    assert.deepEqual(s4, s1);
  });

  it("week 1 restSeconds = 15", () => {
    assert.equal(MOVE_BETTER_PERFORMANCE_V1.weekTiming[1].restSeconds, 15);
    const s1Rest = sessionExerciseIds(1).map((id) => {
      const session = PILOT_PROGRAM_TEMPLATES.find((t) => t.id === MOVE_BETTER_PERFORMANCE_V1_ID)
        ?.sessions[0];
      const ex = session?.exercises.find(
        (e) => typeof e !== "string" && e.exerciseId === id,
      );
      return typeof ex === "string" ? null : ex?.restSec;
    });
    assert.ok(s1Rest.every((r) => r === 15));
  });

  it("week 2 restSeconds = 10", () => {
    assert.equal(MOVE_BETTER_PERFORMANCE_V1.weekTiming[2].restSeconds, 10);
    const s4Rest = sessionExerciseIds(4).map((id) => {
      const session = PILOT_PROGRAM_TEMPLATES.find((t) => t.id === MOVE_BETTER_PERFORMANCE_V1_ID)
        ?.sessions[3];
      const ex = session?.exercises.find(
        (e) => typeof e !== "string" && e.exerciseId === id,
      );
      return typeof ex === "string" ? null : ex?.restSec;
    });
    assert.ok(s4Rest.every((r) => r === 10));
  });

  it("clinicalProgram === false", () => {
    assert.equal(MOVE_BETTER_PERFORMANCE_V1.clinicalProgram, false);
  });

  it("movementChecks are not in main session exercises", () => {
    const mainIds = new Set(
      MOVE_BETTER_PERFORMANCE_V1.sessions.flatMap((s) => s.exerciseIds),
    );
    for (const checkId of MOVE_BETTER_PERFORMANCE_V1.movementChecks) {
      assert.equal(mainIds.has(checkId), false);
    }
  });

  it("Sports Knee Foundation templates still exist unchanged", () => {
    const legacy = PILOT_PROGRAM_TEMPLATES.find((t) => t.id === "sports-knee-foundation");
    const v1 = PILOT_PROGRAM_TEMPLATES.find((t) => t.id === "sports-knee-foundation-v1");
    assert.ok(legacy);
    assert.ok(v1);
    assert.equal(legacy.title, "Sports Knee Foundation");
    assert.equal(v1.title, "Sports Knee Foundation v1");
  });

  it("Sports Knee session counts unchanged", () => {
    const legacy = PILOT_PROGRAM_TEMPLATES.find((t) => t.id === "sports-knee-foundation");
    const v1 = PILOT_PROGRAM_TEMPLATES.find((t) => t.id === "sports-knee-foundation-v1");
    assert.equal(legacy?.sessions.length, 12);
    assert.equal(v1?.sessions.length, 6);
  });
});

describe("Move Better Performance exercise library refs", () => {
  it("required exercise IDs exist in exercise library", () => {
    const required = [
      "sit-to-stand",
      "lateral-step",
      "heel-raise",
      "step-up",
      "standing-march",
      "functional-reach",
      "single-leg-stance",
    ];
    for (const id of required) {
      assert.ok(getLibraryExerciseById(id), `missing exercise: ${id}`);
    }
  });
});
