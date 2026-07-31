/**
 * Structural (source-level) coverage — this repository has no React render
 * harness (established convention, see PostStrokeIntakeClient.test.ts), so
 * these tests confirm the page-shell boundaries by inspecting the component
 * source directly: sanitized-field-only rendering, no camera/result-
 * submission wiring, and generic invalid/expired vs. server-error states.
 *
 * Run: npx tsx --test "app/patient/upper-limb-motor-screen/[token]/MotorScreenTokenClient.test.ts"
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SOURCE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "MotorScreenTokenClient.tsx",
);
const source = readFileSync(SOURCE_PATH, "utf8");

describe("data source", () => {
  it("reads the assignment only via the sanitized patient-facing API helper", () => {
    assert.match(source, /getForwardReachAssignmentByToken\(token\)/);
  });

  it("types the fetched data as the sanitized PatientMotorScreenAssignmentView, not the internal assignment type", () => {
    assert.match(source, /PatientMotorScreenAssignmentView/);
    assert.doesNotMatch(source, /UpperLimbMotorScreenAssignment[^V]/);
  });
});

describe("never renders internal/provider-only fields", () => {
  it("never references providerId, patientId, assignedBy, or tokenHash", () => {
    for (const forbidden of [/providerId/, /\bpatientId\b/, /assignedBy/, /tokenHash/i, /token_hash/i]) {
      assert.doesNotMatch(source, forbidden);
    }
  });

  it("never logs the token or fetched assignment", () => {
    assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)\(/);
  });

  it("never writes to localStorage or sessionStorage", () => {
    assert.doesNotMatch(source, /localStorage/);
    assert.doesNotMatch(source, /sessionStorage/);
  });
});

describe("shell-only boundary", () => {
  it("does not request camera permission or reference MediaPipe / pose tracking", () => {
    for (const forbidden of [
      /getUserMedia/,
      /mediaDevices/,
      /MediaPipe/i,
      /mediapipe/,
      /PoseLandmarker/,
      /useCvSession/i,
    ]) {
      assert.doesNotMatch(source, forbidden);
    }
  });

  it("does not submit or create a session result", () => {
    assert.doesNotMatch(source, /session_result/);
    assert.doesNotMatch(source, /session-results/);
    assert.doesNotMatch(source, /method:\s*"POST"/);
  });

  it("does not change assignment status", () => {
    assert.doesNotMatch(source, /status:\s*"started"/);
    assert.doesNotMatch(source, /status:\s*"completed"/);
  });

  it("labels the deferred action accurately rather than implying it currently works", () => {
    assert.match(source, /will be enabled in the next integration stage/);
  });

  it("does not render a Start/Begin action button", () => {
    assert.doesNotMatch(source, />\s*Start\s*(the\s*)?(assessment|task|session)?\s*<\/button>/i);
  });
});

describe("state handling", () => {
  it("has a distinct loading state", () => {
    assert.match(source, /kind: "loading"/);
  });

  it("uses a generic message for invalid or expired tokens that does not reveal prior existence", () => {
    assert.match(source, /kind: "invalid_or_expired"/);
    assert.match(source, /This link is invalid or has expired\./);
    assert.doesNotMatch(source, /token (was|has been) (used|completed|submitted)/i);
  });

  it("uses a distinct, internals-free message for server errors", () => {
    assert.match(source, /kind: "server_error"/);
    assert.match(source, /We could not load this page right now\./);
  });
});

describe("displayed content", () => {
  it("renders the task name, both sides, delivery mode, and attempt count", () => {
    assert.match(source, /Forward Reach/);
    assert.match(source, /UPPER_LIMB_SIDE_LABELS\[assignment\.affectedSide\]/);
    assert.match(source, /UPPER_LIMB_SIDE_LABELS\[group\.testedSide\]/);
    assert.match(source, /UPPER_LIMB_DELIVERY_MODE_LABELS\[assignment\.deliveryMode\]/);
    assert.match(source, /1 assigned attempt/);
  });

  it("includes a clinician-supervision reminder", () => {
    assert.match(source, /Clinician supervision/);
  });

  it("does not claim the patient completed anything or show fabricated measurements", () => {
    for (const forbidden of [/completed the task/i, /your score/i, /results:/i]) {
      assert.doesNotMatch(source, forbidden);
    }
  });
});
