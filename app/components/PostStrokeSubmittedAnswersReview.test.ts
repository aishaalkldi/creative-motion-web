/**
 * Run: npx tsx --test app/components/PostStrokeSubmittedAnswersReview.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  POST_STROKE_INTAKE_DRAFT_LABEL,
  PT_MEDICAL_REPORT_STATUS_LINE,
} from "@/app/lib/ai/generate-pt-medical-report";
import {
  buildPostStrokeIntakeClinicianReviewEntries,
} from "@/app/lib/post-stroke-intake/clinician-summary";

const REVIEW_SOURCE = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "PostStrokeSubmittedAnswersReview.tsx"),
  "utf8",
);
const REPORT_SOURCE = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../clinician/assessment/report/AssessmentReportClient.tsx",
  ),
  "utf8",
);
const PATIENT_PAGE_SOURCE = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../clinician/patients/[id]/page.tsx",
  ),
  "utf8",
);

describe("PostStrokeSubmittedAnswersReview wiring", () => {
  it("calls the same Gate 1 approval PATCH action as the remote questionnaire review", () => {
    assert.match(REVIEW_SOURCE, /approvePatientReportFacts: true/);
    assert.match(REVIEW_SOURCE, /buildPostStrokeIntakeClinicianReviewEntries/);
  });
});

describe("AssessmentReportClient — post_stroke_intake subjective workflow", () => {
  it("renders PostStrokeSubmittedAnswersReview and passes the exact post-stroke draft label", () => {
    assert.match(REPORT_SOURCE, /reportKind === "post_stroke_intake"/);
    assert.match(REPORT_SOURCE, /<PostStrokeSubmittedAnswersReview/);
    assert.match(REPORT_SOURCE, /draftLabel=\{POST_STROKE_INTAKE_DRAFT_LABEL\}/);
    assert.equal(POST_STROKE_INTAKE_DRAFT_LABEL, "AI-generated draft — requires therapist review");
  });

  it("keeps PtMedicalReportDraftPanel and print gating on the post-stroke branch", () => {
    const block = REPORT_SOURCE.match(
      /reportKind === "post_stroke_intake"[\s\S]*?reportKind === "structured"/,
    );
    assert.ok(block, "expected post_stroke_intake report branch");
    assert.match(block![0], /<PtMedicalReportDraftPanel/);
    assert.match(block![0], /<PtMedicalReportPrintView/);
    assert.match(block![0], /handlePtMedicalReportPrint/);
  });

  it("does not weaken the approved status line constant", () => {
    assert.equal(
      PT_MEDICAL_REPORT_STATUS_LINE,
      "Subjective findings approved; Objective assessment pending",
    );
  });
});

describe("Patient profile — post_stroke_intake recognition", () => {
  it("builds a clinical summary and keeps the report link available", () => {
    assert.match(PATIENT_PAGE_SOURCE, /buildPostStrokeIntakeSummary/);
    assert.match(PATIENT_PAGE_SOURCE, /clinicalSummaryAssessmentId/);
    assert.match(
      PATIENT_PAGE_SOURCE,
      /\/clinician\/assessment\/report\?patientId=\$\{patient\.id\}&assessmentId=\$\{clinicalSummaryAssessmentId\}/,
    );
  });
});

describe("Gate 1 review entries — functional goal duplication guard", () => {
  it("lists functional goal once even when narrative answers are present", () => {
    const entries = buildPostStrokeIntakeClinicianReviewEntries({
      postStrokeIntake: {
        respondent: { type: "patient" },
        functionalIntake: { functionalGoal: "Cook independently" },
        subjectiveNarrative: {
          responses: [{ questionId: "mainDifficulty", inputMode: "text", text: "Left arm weakness" }],
        },
      },
    });
    const goalRows = entries.filter((entry) => entry.fieldKey === "functionalGoal");
    assert.equal(goalRows.length, 1);
  });
});
