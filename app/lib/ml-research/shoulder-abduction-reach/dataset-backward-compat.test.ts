/**
 * Validates backward compatibility against the real 29-rep capture session
 * on disk — does NOT rewrite JSONL fixtures.
 *
 * Run: npx tsx --test app/lib/ml-research/shoulder-abduction-reach/dataset-backward-compat.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  ML_RESEARCH_FEATURE_SCHEMA_VERSION_V1,
  type ShoulderAbductionReachRepCaptureRecord,
} from "./capture-schema";
import { readShoulderAbductionCaptureSessionForLabeling } from "./capture-reader";
import {
  dedupeLatestLabelPerRepAndRater,
  readShoulderAbductionCaptureSessionLabelsForRater,
} from "./label-reader";
import { isValidShoulderAbductionReachLabelRecord } from "./label-schema";
import { resolveDevSessionJsonlPath } from "./local-jsonl-writer";
import { resolveDevSessionLabelsJsonlPath } from "./local-label-writer";

const VALIDATED_SESSION_ID = "dev-session-2026-08-18T23-18-39-738Z";
const EXPECTED_REP_COUNT = 29;

describe("validated capture session backward compatibility", () => {
  it("loads all 29 existing capture records from disk without parse errors", () => {
    const raw = readFileSync(resolveDevSessionJsonlPath(VALIDATED_SESSION_ID), "utf8");
    const lines = raw.split("\n").filter((line) => line.trim().length > 0);
    assert.equal(lines.length, EXPECTED_REP_COUNT);
    for (const line of lines) {
      const record = JSON.parse(line) as ShoulderAbductionReachRepCaptureRecord;
      assert.equal(record.context.featureSchemaVersion, ML_RESEARCH_FEATURE_SCHEMA_VERSION_V1);
      assert.ok(record.derivedFeatures.trackingQuality.framesTotal > 0);
      assert.equal("minCoreJointVisibility" in record.derivedFeatures.trackingQuality, false);
    }
  });

  it("labeling reader returns the same 29 repetitions with v1 tracking quality normalized", async () => {
    const reps = await readShoulderAbductionCaptureSessionForLabeling(VALIDATED_SESSION_ID);
    assert.equal(reps.length, EXPECTED_REP_COUNT);
    for (const rep of reps) {
      assert.equal("derivedFeatures" in rep, false);
      assert.equal(rep.trackingQuality.minCoreJointVisibility, null);
      const serialized = JSON.stringify(rep).toLowerCase();
      for (const forbidden of [
        "peakshoulderangledegrees",
        "peaknormalizedtrunkdriftratio",
        "peakangularvelocitydegpersec",
        "derivedfeatures",
      ]) {
        assert.doesNotMatch(serialized, new RegExp(forbidden));
      }
    }
  });

  it("existing labels remain valid and join to the same repetition ids", async () => {
    const labelsRaw = readFileSync(resolveDevSessionLabelsJsonlPath(VALIDATED_SESSION_ID), "utf8");
    const labelLines = labelsRaw.split("\n").filter((line) => line.trim().length > 0);
    assert.ok(labelLines.length > 0);
    for (const line of labelLines) {
      const label = JSON.parse(line);
      assert.equal(isValidShoulderAbductionReachLabelRecord(label), true);
    }

    const reps = await readShoulderAbductionCaptureSessionForLabeling(VALIDATED_SESSION_ID);
    const raterId = JSON.parse(labelLines[0]).raterId as string;
    const labels = await readShoulderAbductionCaptureSessionLabelsForRater(VALIDATED_SESSION_ID, raterId);
    const deduped = dedupeLatestLabelPerRepAndRater(labels);
    for (const label of deduped) {
      assert.ok(reps.some((rep) => rep.repetitionId === label.repetitionId));
    }
  });
});
