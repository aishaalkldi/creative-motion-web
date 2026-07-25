/**
 * Run: npx tsx --test app/lib/interactive-shoulder/orchestrator-cv-runtime-fault.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SessionOrchestrator } from "@/app/lib/session-orchestrator/session-orchestrator";
import { SHOULDER_ABDUCTION_REACH_INTERACTIVE_SESSION } from "./shoulder-abduction-reach-session-definition";
import {
  dispatchOrchestratorCvBlock,
  type OrchestratorCvRuntimeFault,
} from "./orchestrator-cv-block-dispatch";
import { registerAllBlockRunners } from "./block-engine/register-all-block-runners";
import { createInitialInstructionalLifecycle } from "./instructional-lifecycle";
import { createInitialTargetLifecycle } from "./target-lifecycle";
import {
  applyFaultPauseOnce,
  canResumeOrchestratorSession,
  shouldAdvanceOrchestratorTick,
  shouldDispatchBlockRunner,
} from "./orchestrator-cv-runtime-fault";

const T0 = 9_000_000;

describe("orchestrator-cv-runtime-fault contract", () => {
  it("applyFaultPauseOnce invokes pause exactly once", () => {
    let pauseCount = 0;
    const first = applyFaultPauseOnce(false, () => {
      pauseCount += 1;
    });
    const second = applyFaultPauseOnce(first, () => {
      pauseCount += 1;
    });
    assert.equal(pauseCount, 1);
    assert.equal(first, true);
    assert.equal(second, true);
  });

  it("canResumeOrchestratorSession rejects resume while a fault exists", () => {
    const fault: OrchestratorCvRuntimeFault = {
      kind: "runner_unavailable",
      blockType: "movement-target",
      reason: "missing",
    };
    assert.equal(canResumeOrchestratorSession(null), true);
    assert.equal(canResumeOrchestratorSession(fault), false);
    assert.equal(shouldAdvanceOrchestratorTick(fault), false);
    assert.equal(shouldDispatchBlockRunner(fault), false);
  });

  it("block elapsed time does not advance after a runtime fault", () => {
    registerAllBlockRunners();
    const orchestrator = new SessionOrchestrator(SHOULDER_ABDUCTION_REACH_INTERACTIVE_SESSION);
    orchestrator.start(T0);
    orchestrator.beginCalibration(T0);
    orchestrator.completeCalibration(T0);
    orchestrator.tick(T0 + 1_000);
    const beforeFault = orchestrator.getSnapshot(T0 + 1_000).blockElapsedSeconds;

    let pauseCount = 0;
    const fault: OrchestratorCvRuntimeFault = {
      kind: "runner_unavailable",
      blockType: "movement-target",
      reason: "missing runner",
    };
    applyFaultPauseOnce(false, () => {
      pauseCount += 1;
      orchestrator.pause(T0 + 1_000);
    });

    for (let frame = 0; frame < 120; frame += 1) {
      const now = T0 + 2_000 + frame * 16;
      if (!shouldAdvanceOrchestratorTick(fault)) {
        // frozen — do not tick
      } else {
        orchestrator.tick(now);
      }
      if (!shouldDispatchBlockRunner(fault)) {
        // dispatch stopped
      }
    }

    const afterFault = orchestrator.getSnapshot(T0 + 5_000).blockElapsedSeconds;
    assert.equal(pauseCount, 1);
    assert.equal(afterFault, beforeFault);
  });

  it("dispatch remains stopped after runner_unavailable fault", () => {
    registerAllBlockRunners();
    const orchestrator = new SessionOrchestrator(SHOULDER_ABDUCTION_REACH_INTERACTIVE_SESSION);
    orchestrator.start(T0);
    orchestrator.beginCalibration(T0);
    orchestrator.completeCalibration(T0);
    const snap = orchestrator.getSnapshot(T0);
    const fault: OrchestratorCvRuntimeFault = {
      kind: "runner_unavailable",
      blockType: "movement-target",
      reason: "missing runner",
    };

    assert.equal(shouldDispatchBlockRunner(fault), false);

    const wouldDispatch = dispatchOrchestratorCvBlock({
      snap,
      nowMs: T0,
      wrist: { x: 0.5, y: 0.35 },
      side: "right",
      hitExitTransitionMs: 0,
      states: {
        instructional: createInitialInstructionalLifecycle(),
        target: createInitialTargetLifecycle(),
        pattern: null,
      },
      activeMotionPattern: null,
      resolvers: { resolveTargetRunner: () => null },
    });
    assert.equal(wouldDispatch.status, "fault");
  });
});
