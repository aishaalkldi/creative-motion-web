/**
 * Run: npx tsx --test app/lib/assessment-delivery/motion-input-registry.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractMotionInputSourceFromStructuredData,
  getMotionInputAdapter,
  getMotionInputAdapterOrNull,
  isMotionInputCompatibleWithMode,
  isKnownMotionInputAdapterId,
  listMotionInputAdapters,
  validateMotionInputModeCompatibility,
} from "./motion-input-registry";
import { resolveAssessmentReportFromDetail } from "@/app/lib/reports/assessment-report-resolver";

describe("motion input registry", () => {
  it("lists all three adapters", () => {
    const adapters = listMotionInputAdapters();
    assert.equal(adapters.length, 3);
    assert.deepEqual(
      adapters.map((adapter) => adapter.id).sort(),
      ["manual_clinician", "remote_questionnaire", "web_camera_pose"],
    );
  });

  it("looks up adapters by id", () => {
    const adapter = getMotionInputAdapter("web_camera_pose");
    assert.equal(adapter.id, "web_camera_pose");
    assert.equal(adapter.metadata?.inputTechnology, "mediapipe_web_camera");
  });

  it("returns null for unknown adapter ids", () => {
    assert.equal(getMotionInputAdapterOrNull("depth_camera_sdk"), null);
    assert.equal(isKnownMotionInputAdapterId("xr"), false);
  });

  it("validates mode compatibility", () => {
    assert.equal(isMotionInputCompatibleWithMode("remote_questionnaire", "remote"), true);
    assert.equal(isMotionInputCompatibleWithMode("remote_questionnaire", "in_clinic"), false);
    assert.equal(isMotionInputCompatibleWithMode("manual_clinician", "in_clinic"), true);
    assert.equal(isMotionInputCompatibleWithMode("web_camera_pose", "remote"), true);
    assert.equal(isMotionInputCompatibleWithMode("web_camera_pose", "in_clinic"), true);

    const incompatible = validateMotionInputModeCompatibility(
      "manual_clinician",
      "remote",
    );
    assert.equal(incompatible.ok, false);
    if (!incompatible.ok) {
      assert.match(incompatible.reason, /manual_clinician/);
      assert.match(incompatible.reason, /remote/);
    }
  });

  it("extracts optional motionInputSource metadata when present", () => {
    assert.equal(
      extractMotionInputSourceFromStructuredData({
        motionInputSource: "remote_questionnaire",
        patientDraft: {},
      }),
      "remote_questionnaire",
    );
    assert.equal(
      extractMotionInputSourceFromStructuredData({ motionInputSource: "unknown" }),
      null,
    );
  });

  it("keeps resolver backward compatible when motionInputSource is absent", () => {
    const resolved = resolveAssessmentReportFromDetail({
      id: "assessment-1",
      patient_id: "patient-1",
      provider_id: "provider-1",
      type: "general_msk",
      structured_data: {
        schemaVersion: 2,
        kind: "general_msk",
        draft: {
          subjective: { chiefComplaint: "Knee pain" },
          updatedAt: "2026-07-11T00:00:00.000Z",
        },
      },
      notes: null,
      status: "completed",
      created_at: "2026-07-11T00:00:00.000Z",
      updated_at: "2026-07-11T00:00:00.000Z",
      patient: {
        id: "patient-1",
        full_name: "Test Patient",
        diagnosis: "Knee",
        age: null,
        gender: null,
        sport: null,
        status: "active",
      },
    });

    assert.equal(resolved.kind, "general_msk");
    assert.equal(resolved.motionInputSource, null);
    assert.equal(resolved.loadError, "");
  });

  it("reads motionInputSource from resolver when metadata is present", () => {
    const resolved = resolveAssessmentReportFromDetail({
      id: "assessment-2",
      patient_id: "patient-2",
      provider_id: "provider-1",
      type: "remote_questionnaire",
      structured_data: {
        motionInputSource: "remote_questionnaire",
        pain: {
          chiefComplaint: "Shoulder pain",
          painLocation: "Shoulder",
          painScore: "4",
          aggravating: "",
          easing: "",
          dailyImpact: "",
          goals: "",
        },
      },
      notes: null,
      status: "completed",
      created_at: "2026-07-11T00:00:00.000Z",
      updated_at: "2026-07-11T00:00:00.000Z",
      patient: {
        id: "patient-2",
        full_name: "Remote Patient",
        diagnosis: "Shoulder",
        age: null,
        gender: null,
        sport: null,
        status: "active",
      },
    });

    assert.equal(resolved.kind, "remote_questionnaire");
    assert.equal(resolved.motionInputSource, "remote_questionnaire");
  });
});
