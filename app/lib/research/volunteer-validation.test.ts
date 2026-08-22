/**
 * Run: npx tsx --test app/lib/research/volunteer-validation.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  VOLUNTEER_CONSENT_VERSION,
  VOLUNTEER_PROTOCOL_VERSION,
} from "./volunteer-constants";
import {
  validateVolunteerMovementSessionBody,
  validateVolunteerSessionCreateBody,
} from "./volunteer-validation";

const validCreateBody = {
  campaignCode: "code",
  ageConfirmed18Plus: true,
  consentVersion: VOLUNTEER_CONSENT_VERSION,
  consentAcceptedAtMs: Date.now(),
  protocolVersion: VOLUNTEER_PROTOCOL_VERSION,
};

describe("validateVolunteerSessionCreateBody", () => {
  it("rejects missing campaign code", () => {
    const result = validateVolunteerSessionCreateBody({
      ...validCreateBody,
      campaignCode: "",
    });
    assert.equal(result.ok, false);
  });

  it("rejects ageConfirmed18Plus false", () => {
    const result = validateVolunteerSessionCreateBody({
      ...validCreateBody,
      ageConfirmed18Plus: false,
    });
    assert.equal(result.ok, false);
  });

  it("rejects invalid consent metadata", () => {
    assert.equal(
      validateVolunteerSessionCreateBody({
        ...validCreateBody,
        consentVersion: "wrong",
      }).ok,
      false,
    );
    assert.equal(
      validateVolunteerSessionCreateBody({
        ...validCreateBody,
        consentAcceptedAtMs: -1,
      }).ok,
      false,
    );
  });

  it("accepts valid create body", () => {
    const result = validateVolunteerSessionCreateBody(validCreateBody);
    assert.equal(result.ok, true);
  });
});

describe("validateVolunteerMovementSessionBody", () => {
  it("accepts shoulder_abduction_reach right side", () => {
    const result = validateVolunteerMovementSessionBody({
      movementType: "shoulder_abduction_reach",
      protocolCondition: "NORMAL",
      side: "right",
    });
    assert.equal(result.ok, true);
  });

  it("rejects unsupported movement type", () => {
    const result = validateVolunteerMovementSessionBody({
      movementType: "forward_reach",
      protocolCondition: "NORMAL",
      side: "right",
    });
    assert.equal(result.ok, false);
  });

  it("rejects invalid protocol condition", () => {
    const result = validateVolunteerMovementSessionBody({
      movementType: "shoulder_abduction_reach",
      protocolCondition: "THERAPIST_GROUND_TRUTH",
      side: "right",
    });
    assert.equal(result.ok, false);
  });

  it("rejects left side during pilot", () => {
    const result = validateVolunteerMovementSessionBody({
      movementType: "shoulder_abduction_reach",
      protocolCondition: "NORMAL",
      side: "left",
    });
    assert.equal(result.ok, false);
  });
});
