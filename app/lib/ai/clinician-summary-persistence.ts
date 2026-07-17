import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClinicianSummaryInputsSnapshot } from "./clinician-summary-input";
import type { AiClinicianSummariesRow } from "@/app/lib/supabase/database.types";

export type AiClinicianSummaryStatus = "draft" | "approved" | "dismissed";

export type AiClinicianSummaryDraftInsert = {
  provider_id: string;
  patient_id: string;
  plan_id: string | null;
  draft_text: string;
  inputs_snapshot: ClinicianSummaryInputsSnapshot;
  schema_version: string;
  status: "draft";
};

export type ApproveSummaryRequestBody = {
  summaryId?: unknown;
  approvedText?: unknown;
};

export type AiClinicianSummaryPublicRow = {
  id: string;
  patientId: string;
  planId: string | null;
  status: AiClinicianSummaryStatus;
  draftText: string;
  approvedText: string | null;
  schemaVersion: string;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
};

export function buildAiClinicianSummaryDraftInsert(input: {
  providerId: string;
  patientId: string;
  planId: string | null;
  draftText: string;
  inputsSnapshot: ClinicianSummaryInputsSnapshot;
  schemaVersion: string;
}): AiClinicianSummaryDraftInsert {
  return {
    provider_id: input.providerId,
    patient_id: input.patientId,
    plan_id: input.planId,
    draft_text: input.draftText.trim(),
    inputs_snapshot: input.inputsSnapshot,
    schema_version: input.schemaVersion,
    status: "draft",
  };
}

export function parseAiSessionSummaryGetParams(
  searchParams: URLSearchParams,
): { ok: true; patientId: string; planId: string | null } | { ok: false } {
  const patientId = searchParams.get("patientId")?.trim() ?? "";
  if (!patientId) return { ok: false };

  const rawPlanId = searchParams.get("planId");
  const planId =
    typeof rawPlanId === "string" && rawPlanId.trim() ? rawPlanId.trim() : null;

  return { ok: true, patientId, planId };
}

export function parseApproveSummaryRequestBody(
  body: ApproveSummaryRequestBody,
): { ok: true; summaryId: string; approvedText: string | null } | { ok: false } {
  const summaryId =
    typeof body.summaryId === "string" ? body.summaryId.trim() : "";
  if (!summaryId) return { ok: false };

  const approvedText =
    typeof body.approvedText === "string" && body.approvedText.trim()
      ? body.approvedText.trim()
      : null;

  return { ok: true, summaryId, approvedText };
}

export function validateSummaryProviderAccess(
  row: AiClinicianSummariesRow | null,
  providerId: string,
): row is AiClinicianSummariesRow {
  return row != null && row.provider_id === providerId;
}

export function validateSummaryApprovalAccess(
  row: AiClinicianSummariesRow | null,
  providerId: string,
): { ok: true; row: AiClinicianSummariesRow } | { ok: false; httpStatus: 404 | 409; message: string } {
  if (!validateSummaryProviderAccess(row, providerId)) {
    return { ok: false, httpStatus: 404, message: "Summary not found." };
  }
  if (row.status !== "draft") {
    return {
      ok: false,
      httpStatus: 409,
      message: "Only draft summaries can be approved.",
    };
  }
  return { ok: true, row };
}

export function resolveApprovedSummaryText(
  row: AiClinicianSummariesRow,
  approvedText: string | null,
): string {
  const text = (approvedText ?? row.draft_text).trim();
  return text;
}

export function buildApproveUpdatePatch(input: {
  approvedText: string;
  approvedAt: string;
  approvedBy: string;
}) {
  return {
    status: "approved" as const,
    approved_text: input.approvedText,
    approved_at: input.approvedAt,
    approved_by: input.approvedBy,
  };
}

/** Ensures approval updates only mutate approval fields on draft rows. */
export function validateApproveUpdateImmutability(
  existing: AiClinicianSummariesRow,
  patch: ReturnType<typeof buildApproveUpdatePatch>,
): { ok: true } | { ok: false; message: string } {
  if (existing.status !== "draft") {
    return { ok: false, message: "Approved rows cannot be edited." };
  }
  if (!patch.approved_text.trim()) {
    return { ok: false, message: "Approved text cannot be empty." };
  }
  return { ok: true };
}

export function matchesSummaryPlanScope(
  row: AiClinicianSummariesRow,
  planId: string | null,
): boolean {
  if (planId) return row.plan_id === planId;
  return row.plan_id == null;
}

/** Returns provider-owned rows visible for hydration (approved only). */
export function filterProviderOwnedApprovedSummaries(
  rows: AiClinicianSummariesRow[],
  input: { providerId: string; patientId: string; planId: string | null },
): AiClinicianSummariesRow[] {
  return rows.filter(
    (row) =>
      row.provider_id === input.providerId &&
      row.patient_id === input.patientId &&
      row.status === "approved" &&
      matchesSummaryPlanScope(row, input.planId),
  );
}

export function pickLatestApprovedSummary(
  rows: AiClinicianSummariesRow[],
  input: { providerId: string; patientId: string; planId: string | null },
): AiClinicianSummariesRow | null {
  const approved = filterProviderOwnedApprovedSummaries(rows, input);
  if (approved.length === 0) return null;

  return [...approved].sort((a, b) => {
    const aTime = a.approved_at ?? a.created_at;
    const bTime = b.approved_at ?? b.created_at;
    return bTime.localeCompare(aTime);
  })[0] ?? null;
}

export function toAiClinicianSummaryPublicRow(
  row: AiClinicianSummariesRow,
): AiClinicianSummaryPublicRow {
  return {
    id: row.id,
    patientId: row.patient_id,
    planId: row.plan_id,
    status: row.status as AiClinicianSummaryStatus,
    draftText: row.draft_text,
    approvedText: row.approved_text,
    schemaVersion: row.schema_version,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
  };
}

/** Best-effort draft persistence — never throws; returns id when saved. */
export async function persistAiClinicianSummaryDraft(
  adminClient: SupabaseClient,
  input: {
    providerId: string;
    patientId: string;
    planId: string | null;
    draftText: string;
    inputsSnapshot: ClinicianSummaryInputsSnapshot;
    schemaVersion: string;
  },
): Promise<string | null> {
  const draftText = input.draftText.trim();
  if (!draftText) return null;

  const row = buildAiClinicianSummaryDraftInsert(input);

  const { data, error } = await adminClient
    .from("ai_clinician_summaries")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    if (error.code === "42703" || error.code === "42P01") {
      console.error(
        "[persistAiClinicianSummaryDraft] ai_clinician_summaries table missing — apply migration 011",
      );
      return null;
    }
    console.error("[persistAiClinicianSummaryDraft] insert failed:", error.message);
    return null;
  }

  return (data as { id: string } | null)?.id ?? null;
}

export async function fetchLatestApprovedAiClinicianSummary(
  adminClient: SupabaseClient,
  input: { providerId: string; patientId: string; planId: string | null },
): Promise<
  | { ok: true; summary: AiClinicianSummaryPublicRow | null }
  | { ok: false; httpStatus: 500; message: string; migrationPending?: boolean }
> {
  let query = adminClient
    .from("ai_clinician_summaries")
    .select("*")
    .eq("provider_id", input.providerId)
    .eq("patient_id", input.patientId)
    .eq("status", "approved")
    .order("approved_at", { ascending: false, nullsFirst: false })
    .limit(20);

  if (input.planId) {
    query = query.eq("plan_id", input.planId);
  } else {
    query = query.is("plan_id", null);
  }

  const { data, error } = await query;

  if (error) {
    if (error.code === "42703" || error.code === "42P01") {
      return {
        ok: false,
        httpStatus: 500,
        message: "Unable to complete request.",
        migrationPending: true,
      };
    }
    console.error("[fetchLatestApprovedAiClinicianSummary] query failed:", error.message);
    return { ok: false, httpStatus: 500, message: "Unable to complete request." };
  }

  const rows = (data ?? []) as AiClinicianSummariesRow[];
  const latest = pickLatestApprovedSummary(rows, input);
  return {
    ok: true,
    summary: latest ? toAiClinicianSummaryPublicRow(latest) : null,
  };
}

export async function approveAiClinicianSummary(
  adminClient: SupabaseClient,
  input: {
    summaryId: string;
    providerId: string;
    approvedText: string | null;
    approvedAt: string;
  },
): Promise<
  | { ok: true; row: AiClinicianSummariesRow }
  | { ok: false; httpStatus: 404 | 409 | 500; message: string; migrationPending?: boolean }
> {
  const { data: existing, error: fetchError } = await adminClient
    .from("ai_clinician_summaries")
    .select("*")
    .eq("id", input.summaryId)
    .maybeSingle();

  if (fetchError) {
    if (fetchError.code === "42703" || fetchError.code === "42P01") {
      return {
        ok: false,
        httpStatus: 500,
        message: "Unable to complete request.",
        migrationPending: true,
      };
    }
    console.error("[approveAiClinicianSummary] fetch failed:", fetchError.message);
    return { ok: false, httpStatus: 500, message: "Unable to complete request." };
  }

  const access = validateSummaryApprovalAccess(
    existing as AiClinicianSummariesRow | null,
    input.providerId,
  );
  if (!access.ok) {
    return access;
  }

  const approvedText = resolveApprovedSummaryText(access.row, input.approvedText);
  const patch = buildApproveUpdatePatch({
    approvedText,
    approvedAt: input.approvedAt,
    approvedBy: input.providerId,
  });

  const immutability = validateApproveUpdateImmutability(access.row, patch);
  if (!immutability.ok) {
    return { ok: false, httpStatus: 409, message: immutability.message };
  }

  const { data: updated, error: updateError } = await adminClient
    .from("ai_clinician_summaries")
    .update(patch)
    .eq("id", input.summaryId)
    .eq("provider_id", input.providerId)
    .eq("status", "draft")
    .select("*")
    .maybeSingle();

  if (updateError) {
    console.error("[approveAiClinicianSummary] update failed:", updateError.message);
    return { ok: false, httpStatus: 500, message: "Unable to complete request." };
  }

  if (!updated) {
    return {
      ok: false,
      httpStatus: 409,
      message: "Only draft summaries can be approved.",
    };
  }

  return { ok: true, row: updated as AiClinicianSummariesRow };
}
