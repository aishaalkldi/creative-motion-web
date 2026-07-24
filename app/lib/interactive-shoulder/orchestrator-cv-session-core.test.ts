/**
 * Run: npx tsx --test app/lib/interactive-shoulder/orchestrator-cv-session-core.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  CLINICAL_MOTION_PATTERN_SESSION,
  REACH_THE_LIGHT_SESSION,
  resolveInteractiveShoulderSessionFromEnv,
  resolveMotionPatternsFeatureFlag,
} from "./resolve-interactive-shoulder-session";
import type {
  InteractiveShoulderSessionProps,
  OrchestratorCvSessionCoreProps,
} from "./orchestrator-cv-session-types";
import { toSessionDefinition } from "@/app/lib/rehab-programs/rehab-program-runtime-adapter";
import { STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1 } from "@/app/lib/rehab-programs/stroke-upper-limb-recovery-foundation";
import { resolveOrchestratorBlockType } from "./orchestrator-cv-block-dispatch";

describe("orchestrator cv session core wrapper contract", () => {
  it("InteractiveShoulderSessionProps shape remains stable for existing call sites", () => {
    const props: InteractiveShoulderSessionProps = {
      language: "en",
      arClass: "font-ar",
      textDir: "rtl",
      prescribedSide: "left",
      onSkipped: () => {},
      onRegisterMetricsFlush: () => {},
      onRegisterCaptureConsent: () => null,
      onCaptureReadinessChange: () => {},
    };
    assert.equal(props.language, "en");
    assert.equal(props.textDir, "rtl");
  });

  it("OrchestratorCvSessionCoreProps extends wrapper props with sessionDefinition only", () => {
    const coreProps: OrchestratorCvSessionCoreProps = {
      language: "ar",
      sessionDefinition: REACH_THE_LIGHT_SESSION,
    };
    assert.equal(coreProps.sessionDefinition.sessionId, REACH_THE_LIGHT_SESSION.sessionId);
  });

  it("env-resolved session and feature flag behavior remain unchanged", () => {
    assert.equal(resolveMotionPatternsFeatureFlag(undefined), false);
    assert.equal(resolveMotionPatternsFeatureFlag("true"), true);
    assert.equal(
      resolveInteractiveShoulderSessionFromEnv(undefined).sessionId,
      REACH_THE_LIGHT_SESSION.sessionId,
    );
    assert.equal(
      resolveInteractiveShoulderSessionFromEnv("true").sessionId,
      CLINICAL_MOTION_PATTERN_SESSION.sessionId,
    );
  });

  it("InteractiveShoulderSession wrapper passes props through and injects env session only", () => {
    const wrapperPath = join(
      process.cwd(),
      "app/components/patient/interactive-shoulder/InteractiveShoulderSession.tsx",
    );
    const source = readFileSync(wrapperPath, "utf8");
    assert.match(source, /\{\.\.\.props\}/);
    assert.match(source, /resolveInteractiveShoulderSessionFromEnv\(\)/);
    assert.match(source, /sessionDefinition=\{LEGACY_INTERACTIVE_SHOULDER_SESSION\}/);
    assert.doesNotMatch(source, /lifecycle/);
  });

  it("four-block Stroke definition is accepted by the reusable core contract", () => {
    const definition = toSessionDefinition(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1);
    assert.equal(definition.blocks.length, 4);
    const blockTypes = definition.blocks.map((block) => resolveOrchestratorBlockType(block));
    assert.deepEqual(blockTypes, [
      "instructional",
      "movement-target",
      "movement-pattern",
      "instructional",
    ]);
  });
});
