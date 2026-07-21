/**
 * Run: npx tsx --test app/lib/cv/exercise-cv-registry.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getExerciseCvRegistryEntry,
  isExerciseCvRegistered,
  listExerciseCvRegistryEntries,
} from "./exercise-cv-registry";
import { ShoulderAbductionReachPoseDetector } from "./shoulder-abduction-reach-pose-detector";

describe("exercise-cv-registry", () => {
  it("resolves the shoulder-abduction-reach entry with the expected shape", () => {
    const entry = getExerciseCvRegistryEntry("shoulder-abduction-reach");
    assert.ok(entry);
    assert.equal(entry?.trackerKey, "shoulder-abduction-reach");
    assert.deepEqual([...entry!.supportedPositions].sort(), ["seated", "standing"]);
    assert.equal(entry?.calibrationProfile.bodyFramingProfileId, "upper-limb-reach");
    assert.equal(entry?.shadowModeStatus, "live");
  });

  it("detectorResolver returns the real wrapper class, instantiable with new", () => {
    const entry = getExerciseCvRegistryEntry("shoulder-abduction-reach");
    const Ctor = entry!.detectorResolver();
    const instance = new Ctor({ onSnapshot: () => {} });
    assert.ok(instance instanceof ShoulderAbductionReachPoseDetector);
  });

  it("returns null for an unregistered exercise id, never falls through to a default", () => {
    assert.equal(getExerciseCvRegistryEntry("sit-to-stand"), null);
    assert.equal(getExerciseCvRegistryEntry("does-not-exist"), null);
  });

  it("isExerciseCvRegistered matches registry membership exactly", () => {
    assert.equal(isExerciseCvRegistered("shoulder-abduction-reach"), true);
    assert.equal(isExerciseCvRegistered("sit-to-stand"), false);
  });

  it("does not register or otherwise reference the other seven CV exercises", () => {
    const ids = listExerciseCvRegistryEntries().map((e) => e.exerciseId);
    assert.deepEqual(ids, ["shoulder-abduction-reach"]);
  });

  it("feedbackLayerKey wires the therapeutic target layer for PR3", () => {
    const entry = getExerciseCvRegistryEntry("shoulder-abduction-reach");
    assert.equal(entry?.feedbackLayerKey, "shoulder-therapeutic-target");
  });
});
