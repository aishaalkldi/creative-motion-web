/**
 * Run: npx tsx --test app/components/PostStrokeObjectiveAssignmentPanel.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PT_MEDICAL_REPORT_STATUS_LINE } from "@/app/lib/ai/generate-pt-medical-report";
import {
  FIVE_TIMES_STS_ASSESSMENT_LABEL,
  FIVE_TIMES_STS_ASSIGNED_BY_CLINICIAN_LABEL_AR,
  FIVE_TIMES_STS_ASSIGNED_BY_CLINICIAN_LABEL_EN,
  FIVE_TIMES_STS_DELIVERY_MODE_LABELS,
  resolveFiveTimesStsAssignedByDisplayLabel,
} from "@/app/lib/post-stroke-objective/types";
import { isPostStrokeObjectiveAssignmentGate2Ready } from "@/app/components/PostStrokeObjectiveAssignmentPanel";

const PANEL_SOURCE = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "PostStrokeObjectiveAssignmentPanel.tsx"),
  "utf8",
);
const REPORT_SOURCE = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../clinician/assessment/report/AssessmentReportClient.tsx",
  ),
  "utf8",
);

const FACTS = {
  version: 1,
  approvedAt: "2026-07-30T10:00:00.000Z",
  facts: { chiefComplaint: "Patient-reported summary." },
};

const DRAFT = {
  status: "draft" as const,
  version: 1,
  generatedAt: "2026-07-30T10:05:00.000Z",
  sourceFactsVersion: 1,
  sections: {
    chiefComplaint: "Patient-reported summary.",
    clinicalReviewNote: "Therapist review required.",
  },
};

const APPROVED = {
  version: 1,
  approvedAt: "2026-07-30T10:10:00.000Z",
  sourceDraftVersion: 1,
  sections: {
    chiefComplaint: "Patient-reported summary.",
    clinicalReviewNote: "Therapist review required.",
  },
};

describe("PostStrokeObjectiveAssignmentPanel wiring", () => {
  it("disables assignment before Gate 2 and calls the objective-assignment route after approval", () => {
    assert.match(PANEL_SOURCE, /Approve the Patient-Reported Subjective Summary before assigning/);
    assert.match(PANEL_SOURCE, /objective-assignment/);
    assert.match(PANEL_SOURCE, /supervisionConfirmed/);
    assert.match(PANEL_SOURCE, /FIVE_TIMES_STS_ASSESSMENT_LABEL/);
    assert.match(PANEL_SOURCE, /resolveFiveTimesStsAssignedByDisplayLabel/);
    assert.equal(FIVE_TIMES_STS_ASSESSMENT_LABEL, "Five Times Sit-to-Stand (5xSTS)");
    assert.doesNotMatch(PANEL_SOURCE, /diagnosis|severity|fall.risk|exercise clearance|treatment recommendation/i);
  });

  it("does not render the raw provider UUID in visible assignment details", () => {
    assert.doesNotMatch(PANEL_SOURCE, /assignment\.assignedBy/);
    assert.match(PANEL_SOURCE, /assignedByLabel/);
  });

  it("localizes only the assigned-by label based on reportLanguage", () => {
    assert.match(PANEL_SOURCE, /reportLanguage/);
    assert.equal(
      resolveFiveTimesStsAssignedByDisplayLabel({ reportLanguage: "en" }),
      FIVE_TIMES_STS_ASSIGNED_BY_CLINICIAN_LABEL_EN,
    );
    assert.equal(
      resolveFiveTimesStsAssignedByDisplayLabel({ reportLanguage: "ar" }),
      FIVE_TIMES_STS_ASSIGNED_BY_CLINICIAN_LABEL_AR,
    );
    assert.equal(
      resolveFiveTimesStsAssignedByDisplayLabel({
        clinicianDisplayName: "Dr. Smith",
        reportLanguage: "ar",
      }),
      "Dr. Smith",
    );
  });

  it("keeps unrelated clinician assignment chrome in English", () => {
    assert.match(PANEL_SOURCE, />Objective Assessment</);
    assert.match(PANEL_SOURCE, />Assessment assigned successfully\.</);
    assert.match(PANEL_SOURCE, />Protocol</);
    assert.match(PANEL_SOURCE, />Delivery mode</);
    assert.match(PANEL_SOURCE, />Status</);
    assert.match(PANEL_SOURCE, />Target repetitions</);
    assert.match(PANEL_SOURCE, />Assigned at</);
    assert.match(PANEL_SOURCE, /"Assign assessment"/);
    assert.match(PANEL_SOURCE, /Assigning…/);
    assert.equal(FIVE_TIMES_STS_DELIVERY_MODE_LABELS.remote_supervised, "Remote supervised");
    assert.equal(FIVE_TIMES_STS_DELIVERY_MODE_LABELS.in_clinic, "In clinic");
  });

  it("passes reportLanguage from the post-stroke report branch for Arabic assessments", () => {
    const panelBlock = REPORT_SOURCE.match(
      /<PostStrokeObjectiveAssignmentPanel[\s\S]*?\/>/,
    );
    assert.ok(panelBlock);
    assert.match(
      panelBlock![0],
      /reportLanguage=\{patientAnsweredInArabic \? "ar" : "en"\}/,
    );
    assert.match(REPORT_SOURCE, /patientAnsweredInArabic/);
    assert.match(REPORT_SOURCE, /assessmentLanguage=\{patientAnsweredInArabic \? "ar" : "en"\}/);
  });

  it("is rendered on the post_stroke_intake report branch only", () => {
    const block = REPORT_SOURCE.match(
      /reportKind === "post_stroke_intake"[\s\S]*?reportKind === "structured"/,
    );
    assert.ok(block);
    assert.match(block![0], /<PostStrokeObjectiveAssignmentPanel/);
    assert.match(block![0], /<PtMedicalReportDraftPanel/);
  });

  it("does not change the existing Subjective status line constant", () => {
    assert.equal(
      PT_MEDICAL_REPORT_STATUS_LINE,
      "Subjective findings approved; Objective assessment pending",
    );
  });
});

describe("Gate 2 readiness helper", () => {
  it("is false before Gate 2 and true with matching versions", () => {
    assert.equal(
      isPostStrokeObjectiveAssignmentGate2Ready({
        approvedFacts: null,
        draft: null,
        approved: null,
        gate2ApprovedAt: null,
      }),
      false,
    );
    assert.equal(
      isPostStrokeObjectiveAssignmentGate2Ready({
        approvedFacts: FACTS,
        draft: DRAFT,
        approved: APPROVED,
        gate2ApprovedAt: "2026-07-30T10:10:00.000Z",
      }),
      true,
    );
  });
});
