/**
 * Run: npx tsx --test app/lib/post-stroke-objective/five-times-sts-result.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFiveTimesStsResultSkeleton,
  classifyCompletionStateFromRepetitions,
} from "@/app/lib/post-stroke-objective/five-times-sts-result";

describe("five-times-sts result contract", () => {
  it("keeps standard protocol when repetitions are incomplete", () => {
    assert.equal(
      classifyCompletionStateFromRepetitions({
        protocol: "standard_5xsts",
        repetitionsCompleted: 3,
        interrupted: false,
      }),
      "incomplete",
    );
  });

  it("marks interrupted attempts without converting protocol", () => {
    assert.equal(
      classifyCompletionStateFromRepetitions({
        protocol: "standard_5xsts",
        repetitionsCompleted: 2,
        interrupted: true,
      }),
      "interrupted",
    );
  });

  it("builds result skeleton with server target repetitions", () => {
    const result = buildFiveTimesStsResultSkeleton({
      completionState: "not_started",
      repetitionsCompleted: 0,
    });
    assert.equal(result.targetRepetitions, 5);
    assert.equal(result.repetitionsCompleted, 0);
  });
});
