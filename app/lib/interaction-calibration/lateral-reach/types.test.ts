/**
 * Run (approved harness):
 *   $env:JITI_ALIAS = @{ '@' = (Get-Location).Path } | ConvertTo-Json -Compress
 *   node --import jiti/register --test "app/lib/interaction-calibration/lateral-reach/types.test.ts"
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LATERAL_REACH_CALIBRATION_SCHEMA_VERSION,
  LATERAL_REACH_CAPTURE_FAILURE_REASONS,
  LATERAL_REACH_GEOMETRY_BLOCKERS,
  LATERAL_REACH_INTERACTION_GEOMETRY_LABELS,
  LATERAL_REACH_NOISE_FLOOR_KIND,
  LATERAL_REACH_TECHNICAL_GEOMETRY_ADJUSTMENT_KINDS,
} from "@/app/lib/interaction-calibration/lateral-reach/types";

function assertUniqueStrings(values: readonly string[], label: string): void {
  assert.equal(new Set(values).size, values.length, `${label} must contain unique entries`);
}

describe("schema version", () => {
  it("locks the Slice 1 schema version string", () => {
    assert.equal(LATERAL_REACH_CALIBRATION_SCHEMA_VERSION, "lateral-reach-calibration/v1");
  });
});

describe("closed runtime vocabularies", () => {
  it("keeps capture-failure reasons unique and includes noise-floor technical failure", () => {
    assertUniqueStrings(LATERAL_REACH_CAPTURE_FAILURE_REASONS, "capture failure reasons");
    assert.ok(
      LATERAL_REACH_CAPTURE_FAILURE_REASONS.includes("displacement_indistinguishable_from_noise"),
    );
    assert.equal(
      (LATERAL_REACH_CAPTURE_FAILURE_REASONS as readonly string[]).includes(
        "comfortable_reach_too_small",
      ),
      false,
    );
  });

  it("keeps geometry blockers unique and separate from capture failures", () => {
    assertUniqueStrings(LATERAL_REACH_GEOMETRY_BLOCKERS, "geometry blockers");
    for (const blocker of LATERAL_REACH_GEOMETRY_BLOCKERS) {
      assert.equal(
        (LATERAL_REACH_CAPTURE_FAILURE_REASONS as readonly string[]).includes(blocker),
        false,
      );
    }
  });

  it("keeps Short/Standard/Long as the only interaction-geometry labels", () => {
    assert.deepEqual([...LATERAL_REACH_INTERACTION_GEOMETRY_LABELS], ["short", "standard", "long"]);
  });

  it("locks noise-floor and technical-adjustment vocabulary kinds", () => {
    assert.equal(LATERAL_REACH_NOISE_FLOOR_KIND, "direction_aligned_magnitude_noise_floor");
    assert.deepEqual([...LATERAL_REACH_TECHNICAL_GEOMETRY_ADJUSTMENT_KINDS], [
      "interaction_fraction_reduced_for_camera_margin",
    ]);
  });

  it("excludes prohibited clinical vocabulary from runtime const sources", () => {
    const vocabulary = new Set<string>([
      ...LATERAL_REACH_CAPTURE_FAILURE_REASONS,
      ...LATERAL_REACH_GEOMETRY_BLOCKERS,
      ...LATERAL_REACH_INTERACTION_GEOMETRY_LABELS,
      LATERAL_REACH_NOISE_FLOOR_KIND,
      ...LATERAL_REACH_TECHNICAL_GEOMETRY_ADJUSTMENT_KINDS,
    ]);
    const prohibited = [
      "rom",
      "limited_rom",
      "impairment",
      "severity",
      "capacity",
      "safe_maximum",
      "recovery_score",
      "signed_displacement",
      "signedDisplacement",
      "comfortable_reach_too_small",
    ];
    for (const term of prohibited) {
      assert.equal(vocabulary.has(term), false, `${term} must not be a vocabulary entry`);
    }
  });
});
