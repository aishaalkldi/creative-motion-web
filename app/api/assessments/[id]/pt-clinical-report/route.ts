import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AI_ERROR_CODES } from "@/app/lib/ai/ai-errors";
import { checkAiRateLimit } from "@/app/lib/ai/rate-limit";
import { getOpenAiKeyConfig } from "@/app/lib/openai/server-env";
import {
  aiErrorJson,
  loadRemoteQuestionnaireAssessment,
  saveAssessmentStructuredData,
} from "@/app/lib/reports/assessment-workflow-route-auth";
import {
  generatePtClinicalReport,
  type PtClinicalReportDraft,
} from "@/app/lib/reports/pt-clinical-report-draft";
import {
  assertPatientAssessmentDraft,
  canGeneratePtClinicalReport,
  readPtClinicalReportDraft,
  readPtClinicalReportFinal,
  readPtClinicalReportStatus,
} from "@/app/lib/reports/remote-questionnaire-workflow";
import { inferIncludedSections } from "@/app/lib/remote-questionnaire-summary";

export const PT_REPORT_FAILURE_MESSAGE =
  "Clinical report could not be generated.";

type PtReportBody = {
  regenerate?: unknown;
  finalize?: unknown;
  saveDraftEdits?: unknown;
};

function isPtClinicalReportDraft(value: unknown): value is PtClinicalReportDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.schemaVersion === 1 && Array.isArray(record.sections);
}

/**
 * POST /api/assessments/[id]/pt-clinical-report
 * Clinician-initiated AI-assisted PT clinical report draft generation.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assessmentId } = await params;
  if (!assessmentId?.trim()) {
    return aiErrorJson(AI_ERROR_CODES.AI_INVALID_INPUT);
  }

  let body: PtReportBody = {};
  try {
    body = (await req.json()) as PtReportBody;
  } catch {
    body = {};
  }
  const regenerate = body.regenerate === true;
  const finalize = body.finalize === true;
  const saveDraftEdits = body.saveDraftEdits;

  const loaded = await loadRemoteQuestionnaireAssessment(assessmentId);
  if (!loaded.ok) return loaded.response;

  const { assessment, adminClient } = loaded;
  let structuredData = { ...(assessment.structured_data ?? {}) };
  const draft = assertPatientAssessmentDraft(structuredData);
  if (!draft) {
    return aiErrorJson(AI_ERROR_CODES.AI_CONTEXT_INVALID);
  }

  if (readPtClinicalReportStatus(structuredData) === "finalized" && (regenerate || saveDraftEdits)) {
    return NextResponse.json(
      {
        error: "Report is finalized. Unfinalize is not supported in this workflow.",
        code: AI_ERROR_CODES.AI_INVALID_INPUT,
      },
      { status: 400 },
    );
  }

  if (finalize) {
    const currentDraft = readPtClinicalReportDraft(structuredData);
    if (!currentDraft) {
      return NextResponse.json(
        {
          error: "No PT clinical report draft exists to finalize.",
          code: AI_ERROR_CODES.AI_INVALID_INPUT,
        },
        { status: 400 },
      );
    }

    const finalizedAt = new Date().toISOString();
    const nextData = {
      ...structuredData,
      pt_clinical_report_final: currentDraft,
      pt_clinical_report_status: "finalized",
      pt_clinical_report_finalized_at: finalizedAt,
    };

    const saved = await saveAssessmentStructuredData(
      adminClient,
      assessment.id,
      assessment.provider_id,
      nextData,
    );
    if (!saved.ok) return saved.response;

    return NextResponse.json({
      ptClinicalReportStatus: "finalized",
      report: currentDraft,
      finalized: true,
    });
  }

  if (saveDraftEdits && isPtClinicalReportDraft(saveDraftEdits)) {
    const nextData = {
      ...structuredData,
      pt_clinical_report_draft: saveDraftEdits,
      pt_clinical_report_status: "draft_ready",
      pt_clinical_report_edited_at: new Date().toISOString(),
    };

    const saved = await saveAssessmentStructuredData(
      adminClient,
      assessment.id,
      assessment.provider_id,
      nextData,
    );
    if (!saved.ok) return saved.response;

    return NextResponse.json({
      ptClinicalReportStatus: "draft_ready",
      report: saveDraftEdits,
      saved: true,
    });
  }

  if (!canGeneratePtClinicalReport(structuredData, draft)) {
    return NextResponse.json(
      {
        error:
          "Approved Clinical English translation is required before generating the PT clinical report.",
        code: AI_ERROR_CODES.AI_INVALID_INPUT,
      },
      { status: 400 },
    );
  }

  const existingDraft = readPtClinicalReportDraft(structuredData);
  const existingFinal = readPtClinicalReportFinal(structuredData);
  if (!regenerate && existingDraft) {
    return NextResponse.json({
      ptClinicalReportStatus: readPtClinicalReportStatus(structuredData),
      report: existingDraft,
      finalReport: existingFinal,
      cached: true,
    });
  }

  const keyConfig = getOpenAiKeyConfig();
  const apiKey = keyConfig.ok ? keyConfig.apiKey : null;

  if (apiKey) {
    const rateLimit = checkAiRateLimit(assessment.provider_id);
    if (!rateLimit.allowed) {
      return aiErrorJson(AI_ERROR_CODES.AI_RATE_LIMITED);
    }
  }

  try {
    const { report, usedFallback } = await generatePtClinicalReport({
      structuredData,
      draft,
      includedSections: inferIncludedSections(draft),
      apiKey,
    });

    const nextData = {
      ...structuredData,
      pt_clinical_report_draft: report,
      pt_clinical_report_status: "draft_ready",
      pt_clinical_report_generated_at: report.generatedAt,
      pt_clinical_report_generation_method: usedFallback ? "rule_fallback" : "ai",
    };

    const saved = await saveAssessmentStructuredData(
      adminClient,
      assessment.id,
      assessment.provider_id,
      nextData,
    );
    if (!saved.ok) return saved.response;

    return NextResponse.json({
      ptClinicalReportStatus: "draft_ready",
      report,
      cached: false,
      usedFallback,
    });
  } catch (error) {
    console.error("[POST /api/assessments/[id]/pt-clinical-report] generation failed", error);
    const nextData = {
      ...structuredData,
      pt_clinical_report_status: "failed",
    };
    await saveAssessmentStructuredData(
      adminClient,
      assessment.id,
      assessment.provider_id,
      nextData,
    );
    return NextResponse.json(
      {
        error: PT_REPORT_FAILURE_MESSAGE,
        ptClinicalReportStatus: "failed",
      },
      { status: 500 },
    );
  }
}
