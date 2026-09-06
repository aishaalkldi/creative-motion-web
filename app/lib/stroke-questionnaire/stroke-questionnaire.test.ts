import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildStrokeBranchTrace,
  resolveStrokeSafetyState,
  shouldShowUpperLimb,
} from "./stroke-branch-engine";
import { routeStrokeRasqModules } from "./stroke-module-routing";
import {
  buildStrokePtClinicalReport,
  strokeReportContainsForbiddenDiagnosticUpgrade,
} from "./stroke-pt-clinical-report";
import {
  STROKE_PATHWAY,
  STROKE_QUESTIONNAIRE_KIND,
  STROKE_QUESTIONNAIRE_VERSION,
  type StrokeQuestionnaireSubmission,
  type StrokeResponse,
} from "./stroke-questionnaire-schema";

function response(
  rawValue: string | string[],
  provenance: StrokeResponse["provenance"] = "PATIENT_REPORTED",
): StrokeResponse {
  return {
    rawValue,
    rawLanguage: "en",
    responseMethod: Array.isArray(rawValue) ? "selection" : "text",
    provenance,
    reporterRole: provenance === "CAREGIVER_REPORTED" ? "caregiver" : "patient",
    clinicalEnglish: `${
      provenance === "CAREGIVER_REPORTED"
        ? "The caregiver reports"
        : "The patient reports"
    } ${Array.isArray(rawValue) ? rawValue.join(", ") : rawValue}.`,
    translation: { status: "approved" },
  };
}

function submission(
  responses: Record<string, StrokeResponse>,
  safetyState: StrokeQuestionnaireSubmission["safetyState"] = "PASS",
): StrokeQuestionnaireSubmission {
  return {
    questionnaireKind: STROKE_QUESTIONNAIRE_KIND,
    questionnaireVersion: STROKE_QUESTIONNAIRE_VERSION,
    pathway: STROKE_PATHWAY,
    assessmentLanguage: "en",
    safetyState,
    responses,
    branchTrace: [],
    strokeWorkflow: {
      translation: { status: "approved" },
      report: { status: "not_generated" },
    },
  };
}

describe("Stroke safety gate", () => {
  it("separates sudden neurological change from gradual worsening", () => {
    assert.equal(
      resolveStrokeSafetyState({
        sg_sudden_new_neurological_change: response("yes"),
      }),
      "URGENT_ESCALATION",
    );
    assert.equal(
      resolveStrokeSafetyState({
        sg_gradual_functional_worsening: response("yes"),
      }),
      "REQUIRES_CLINICIAN_REVIEW",
    );
    assert.equal(resolveStrokeSafetyState({}), "REQUIRES_CLINICIAN_REVIEW");
    assert.equal(
      resolveStrokeSafetyState({
        sg_sudden_new_neurological_change: response("no"),
        sg_chest_pain_or_severe_breathlessness: response("no"),
        sg_recent_fall_with_injury: response("no"),
        sg_gradual_functional_worsening: response("no"),
      }),
      "PASS",
    );
  });

  it("documents that PASS is only an intake-gate state", () => {
    const report = buildStrokePtClinicalReport(submission({}));
    const safety = report.sections.find((section) => section.id === "safety_considerations");
    assert.match(safety?.paragraphs.join(" ") ?? "", /does not indicate medical clearance/i);
  });
});

describe("Stroke adaptive branching", () => {
  it("does not open upper limb from affected side alone", () => {
    assert.equal(
      shouldShowUpperLimb({
        sc_affected_side: response("right"),
        sc_upper_limb_involvement: response("no"),
      }),
      false,
    );
  });

  it("opens upper limb from explicit involvement or relevant goal", () => {
    assert.equal(
      shouldShowUpperLimb({ sc_upper_limb_involvement: response("yes") }),
      true,
    );
    assert.equal(
      shouldShowUpperLimb({
        sc_upper_limb_involvement: response("no"),
        goal_primary: response("Use my hand to hold a cup"),
      }),
      true,
    );
  });

  it("records nonambulatory branch suppression", () => {
    assert.ok(
      buildStrokeBranchTrace({
        mb_current_walking_status: response("nonambulatory"),
      }).includes("NONAMBULATORY_WALKING_BRANCH_SKIPPED"),
    );
  });
});

describe("Stroke RASQ module routing safety", () => {
  it("fall alone does not recommend Single-Leg Stance", () => {
    const result = routeStrokeRasqModules(
      submission({ mb_fall_reported: response("yes") }),
    );
    assert.equal(result.some((item) => item.id === "single_leg_stance"), false);
  });

  it("upper-limb issue alone does not recommend Functional Reach", () => {
    const result = routeStrokeRasqModules(
      submission({ ul_grasp: response("much_difficulty") }),
    );
    assert.equal(result.some((item) => item.id === "functional_reach"), false);
    assert.equal(result.some((item) => item.id === "upper_limb_motor_screen"), true);
  });

  it("nonambulatory does not recommend TUG or Gait Observation", () => {
    const result = routeStrokeRasqModules(
      submission({
        mb_current_walking_status: response("nonambulatory"),
        mb_walking_turning_difficulty: response("yes"),
        mb_integrated_rise_walk_turn_sit: response("yes"),
      }),
    );
    assert.equal(result.some((item) => item.id === "timed_up_and_go"), false);
    assert.equal(result.some((item) => item.id === "gait_observation"), false);
  });

  it("defers all suggestions when safety review is required", () => {
    const result = routeStrokeRasqModules(
      submission(
        { ul_grasp: response("much_difficulty") },
        "REQUIRES_CLINICIAN_REVIEW",
      ),
    );
    assert.ok(result.every((item) => item.disposition === "DEFER_PENDING_SAFETY_REVIEW"));
  });
});

describe("Stroke report provenance and diagnostic safety", () => {
  it("preserves caregiver-reported provenance", () => {
    const report = buildStrokePtClinicalReport(
      submission({
        sc_main_current_limitation: response(
          "difficulty using the left hand",
          "CAREGIVER_REPORTED",
        ),
      }),
    );
    assert.match(
      report.sections
        .find((section) => section.id === "stroke_rehabilitation_context")
        ?.paragraphs.join(" ") ?? "",
      /caregiver reports/i,
    );
  });

  it("keeps Objective Examination independent and empty", () => {
    const report = buildStrokePtClinicalReport(
      submission({ ul_grasp: response("unable") }),
    );
    const objective = report.sections.find(
      (section) => section.id === "objective_examination",
    );
    assert.deepEqual(objective?.paragraphs, []);
    assert.deepEqual(objective?.bullets, []);
    assert.deepEqual(objective?.allowedProvenance, [
      "CLINICIAN_OBSERVED",
      "OBJECTIVELY_MEASURED",
    ]);
  });

  it("patient-reported stiffness is not converted to spasticity", () => {
    const report = buildStrokePtClinicalReport(
      submission({ ul_stiffness_tightness: response("yes") }),
    );
    assert.doesNotMatch(JSON.stringify(report), /spasticity/i);
  });

  it("dragging/catching leg is not converted to foot drop", () => {
    const report = buildStrokePtClinicalReport(
      submission({ mb_foot_catching_dragging: response("yes") }),
    );
    assert.doesNotMatch(JSON.stringify(report), /foot drop/i);
  });

  it("reported left-side inattention is not converted to neglect", () => {
    const report = buildStrokePtClinicalReport(
      submission({ sfp_left_side_inattention_reported: response("yes") }),
    );
    assert.doesNotMatch(JSON.stringify(report), /\bneglect\b/i);
    assert.deepEqual(strokeReportContainsForbiddenDiagnosticUpgrade(report), []);
  });
});
