/**
 * Run: npx tsx --test app/lib/clinician/resolve-current-plan.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveCurrentAndPreviousPlans } from "./resolve-current-plan";

type TestPlan = {
  id: string;
  created_at: string;
  status: string;
  title: string;
};

describe("resolveCurrentAndPreviousPlans", () => {
  it("returns null when empty", () => {
    const result = resolveCurrentAndPreviousPlans([]);
    assert.equal(result.currentPlan, null);
    assert.deepEqual(result.previousPlans, []);
  });

  it("picks newest active plan over newer completed", () => {
    const plans: TestPlan[] = [
      { id: "new", created_at: "2026-06-03", status: "completed", title: "New" },
      { id: "active", created_at: "2026-06-01", status: "active", title: "Active" },
    ];
    const { currentPlan, previousPlans } = resolveCurrentAndPreviousPlans(plans);
    assert.equal(currentPlan?.id, "active");
    assert.deepEqual(previousPlans.map((p) => p.id), ["new"]);
  });

  it("falls back to newest overall when none active", () => {
    const plans: TestPlan[] = [
      { id: "b", created_at: "2026-06-02", status: "completed", title: "B" },
      { id: "a", created_at: "2026-06-01", status: "paused", title: "A" },
    ];
    const { currentPlan, previousPlans } = resolveCurrentAndPreviousPlans(plans);
    assert.equal(currentPlan?.id, "b");
    assert.deepEqual(previousPlans.map((p) => p.id), ["a"]);
  });

  it("preserves newest-first order in previousPlans", () => {
    const plans: TestPlan[] = [
      { id: "1", created_at: "2026-06-03", status: "active", title: "1" },
      { id: "2", created_at: "2026-06-02", status: "completed", title: "2" },
      { id: "3", created_at: "2026-06-01", status: "completed", title: "3" },
    ];
    const { previousPlans } = resolveCurrentAndPreviousPlans(plans);
    assert.deepEqual(previousPlans.map((p) => p.id), ["2", "3"]);
  });
});
