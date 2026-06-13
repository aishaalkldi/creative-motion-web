/**
 * Run: npx tsx --test app/lib/patient-portal-access.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPatientPortalTokenRowValid,
  planMatchesPortalScope,
  resolvePatientPortalCurrentPlanId,
  sessionBelongsToCurrentPlan,
  type PatientPortalPlanListItem,
} from "./patient-portal-access";

const PATIENT = "patient-1";
const PROVIDER = "provider-1";

function plan(
  id: string,
  created_at: string,
  status: string,
): PatientPortalPlanListItem {
  return {
    id,
    patient_id: PATIENT,
    provider_id: PROVIDER,
    created_at,
    status,
  };
}

describe("resolvePatientPortalCurrentPlanId", () => {
  it("falls back to original token plan when no plans exist", () => {
    assert.equal(resolvePatientPortalCurrentPlanId([], "token-plan"), "token-plan");
  });

  it("resolves newest active plan for same patient", () => {
    const plans = [
      plan("new-completed", "2026-06-03", "completed"),
      plan("active-older", "2026-06-01", "active"),
    ];
    assert.equal(resolvePatientPortalCurrentPlanId(plans, "token-plan"), "active-older");
  });

  it("falls back to newest overall when none active", () => {
    const plans = [
      plan("newest", "2026-06-02", "completed"),
      plan("older", "2026-06-01", "paused"),
    ];
    assert.equal(resolvePatientPortalCurrentPlanId(plans, "token-plan"), "newest");
  });

  it("old token plan id opens current plan when a newer active plan exists", () => {
    const plans = [
      plan("new-active", "2026-06-05", "active"),
      plan("old-token-plan", "2026-05-01", "completed"),
    ];
    assert.equal(
      resolvePatientPortalCurrentPlanId(plans, "old-token-plan"),
      "new-active",
    );
  });
});

describe("planMatchesPortalScope", () => {
  it("accepts matching patient and provider", () => {
    assert.equal(
      planMatchesPortalScope(
        { patient_id: PATIENT, provider_id: PROVIDER },
        PATIENT,
        PROVIDER,
      ),
      true,
    );
  });

  it("rejects another patient", () => {
    assert.equal(
      planMatchesPortalScope(
        { patient_id: "other-patient", provider_id: PROVIDER },
        PATIENT,
        PROVIDER,
      ),
      false,
    );
  });

  it("rejects another provider", () => {
    assert.equal(
      planMatchesPortalScope(
        { patient_id: PATIENT, provider_id: "other-provider" },
        PATIENT,
        PROVIDER,
      ),
      false,
    );
  });
});

describe("sessionBelongsToCurrentPlan", () => {
  it("allows sessions on the resolved current plan", () => {
    assert.equal(sessionBelongsToCurrentPlan("plan-current", "plan-current"), true);
  });

  it("rejects sessions outside the resolved current plan", () => {
    assert.equal(sessionBelongsToCurrentPlan("plan-old", "plan-current"), false);
  });
});

describe("isPatientPortalTokenRowValid", () => {
  it("rejects inactive tokens", () => {
    assert.equal(
      isPatientPortalTokenRowValid({ is_active: false, expires_at: null }),
      false,
    );
  });

  it("rejects expired tokens", () => {
    assert.equal(
      isPatientPortalTokenRowValid({
        is_active: true,
        expires_at: "2020-01-01T00:00:00.000Z",
      }),
      false,
    );
  });

  it("accepts active non-expired tokens", () => {
    assert.equal(
      isPatientPortalTokenRowValid({ is_active: true, expires_at: null }),
      true,
    );
  });
});
