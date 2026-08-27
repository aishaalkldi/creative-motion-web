/**
 * POST /api/patient/interactive-shoulder-outcomes (O2)
 *
 * Public endpoint — patient-portal token auth only, exactly like the
 * existing /api/patient/session-complete (no Supabase auth session,
 * service-role key server-side only). Reuses
 * resolvePatientPortalAccess/sessionBelongsToCurrentPlan unchanged for
 * ownership, and reuses every O1 persistence module unchanged
 * (fetchPlanSessionForOutcomeOwnership, resolvePrescribedSideForOutcome,
 * assembleInteractiveShoulderMovementOutcomeSnapshot,
 * buildInteractiveShoulderMovementOutcomeInsert,
 * insertInteractiveShoulderMovementOutcome,
 * toInteractiveShoulderMovementOutcomePublic) — no parallel persistence
 * model.
 *
 * Server-authoritative: providerId, patientId, planId, and
 * prescribedSide are NEVER read from the request body — only token +
 * planSessionId + the real runtime session facts (sessionState,
 * elapsed time, block results) are client input. providerId/patientId/
 * planId come from the resolved token; prescribedSide comes from the
 * plan_sessions row O1 fetches server-side. O1's assembler
 * independently rejects any sessionState other than "completed" —
 * this route adds no separate partial-session path.
 *
 * Fail-closed prescribed side: the real catalog patient session flow
 * (CatalogPatientSessionPlayback) always renders with
 * clinicalPrescribedSideRequired, so the runtime itself already
 * refuses to start without a resolved side. This route enforces the
 * same policy independently at the persistence boundary — a plan
 * session whose server-resolved prescribed_side is null is rejected
 * before assembly, never silently persisted with a null side.
 *
 * Feature-gated: RASQ_INTERACTIVE_SHOULDER_OUTCOME_SUBMISSION_V1 must
 * be exactly "true" (same strict-equality convention as
 * resolveAdaptiveDifficultyFeatureFlag) or this route returns 503 —
 * an honest "service unavailable", never a fake success while quietly
 * not persisting anything.
 */
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  resolvePatientPortalAccess,
  sessionBelongsToCurrentPlan,
  type ResolvePatientPortalAccessResult,
} from "@/app/lib/patient-portal-access";
import { validateInteractiveShoulderMovementOutcomeRequest } from "@/app/lib/interactive-shoulder/movement-outcome-request-validation";
import { assembleInteractiveShoulderMovementOutcomeSnapshot } from "@/app/lib/interactive-shoulder/movement-outcome-assembler";
import {
  buildInteractiveShoulderMovementOutcomeInsert,
  fetchPlanSessionForOutcomeOwnership,
  insertInteractiveShoulderMovementOutcome,
  resolvePrescribedSideForOutcome,
  toInteractiveShoulderMovementOutcomePublic,
} from "@/app/lib/interactive-shoulder/movement-outcome-persistence";
import {
  checkPatientGeneralLimit,
  rateLimitExceededResponse,
  type RateLimitResult,
} from "@/app/lib/rate-limit";
import {
  API_ERRORS,
  invalidPatientTokenResponse,
  serviceUnavailableResponse,
  unableToCompleteResponse,
} from "@/app/lib/api/safe-errors";

const CREATE_ERROR = "Failed to save movement outcome.";
const PRESCRIBED_SIDE_REQUIRED_MESSAGE =
  "This session does not have a therapist-prescribed side on record.";

type RequestBody = {
  token?: unknown;
  planSessionId?: unknown;
  sessionState?: unknown;
  totalElapsedSeconds?: unknown;
  blocksCompleted?: unknown;
  blocksTotal?: unknown;
  blockResults?: unknown;
};

/** Same strict-equality convention as resolveAdaptiveDifficultyFeatureFlag. */
export function resolveInteractiveShoulderOutcomeSubmissionFeatureFlag(
  envValue: string | undefined,
): boolean {
  return envValue === "true";
}

export type InteractiveShoulderOutcomeSubmissionDependencies = {
  featureEnabled: boolean;
  adminClient: SupabaseClient;
  checkWriteLimit: (req: NextRequest) => RateLimitResult;
  resolvePatientAccess: (
    admin: SupabaseClient,
    token: string,
  ) => Promise<ResolvePatientPortalAccessResult>;
};

// ── Dependency-injected handler ────────────────────────────────────────────────

export function createInteractiveShoulderOutcomeSubmissionHandler(
  deps: InteractiveShoulderOutcomeSubmissionDependencies,
) {
  return async function handlePost(req: NextRequest): Promise<NextResponse> {
    if (!deps.featureEnabled) {
      return serviceUnavailableResponse();
    }

    const limited = deps.checkWriteLimit(req);
    if (!limited.allowed) return rateLimitExceededResponse(limited.retryAfterSec);

    let body: RequestBody;
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const tokenValue = typeof body.token === "string" ? body.token.trim() : "";
    if (!tokenValue) {
      return NextResponse.json({ error: "Token is required." }, { status: 400 });
    }

    // Movement-outcome content only — token is never part of this contract,
    // and providerId/patientId/planId/prescribedSide are rejected by this
    // validator if present at all (see movement-outcome-request-validation.ts).
    const validation = validateInteractiveShoulderMovementOutcomeRequest({
      planSessionId: body.planSessionId,
      sessionState: body.sessionState,
      totalElapsedSeconds: body.totalElapsedSeconds,
      blocksCompleted: body.blocksCompleted,
      blocksTotal: body.blocksTotal,
      blockResults: body.blockResults,
    });
    if (!validation.ok) {
      return NextResponse.json(
        { error: "Invalid movement outcome.", reason: validation.reason, detail: validation.detail },
        { status: 400 },
      );
    }

    const resolved = await deps.resolvePatientAccess(deps.adminClient, tokenValue);
    if (!resolved.ok) {
      if (resolved.reason === "invalid_token") return invalidPatientTokenResponse(req);
      if (resolved.reason === "plan_not_found") return unableToCompleteResponse(404);
      return NextResponse.json({ error: API_ERRORS.GENERIC }, { status: 500 });
    }
    const { access } = resolved;

    const planSessionResult = await fetchPlanSessionForOutcomeOwnership(deps.adminClient, {
      planSessionId: validation.input.planSessionId,
      providerId: access.providerId,
    });
    if (!planSessionResult.ok) {
      return NextResponse.json(
        { error: planSessionResult.message },
        { status: planSessionResult.httpStatus },
      );
    }
    const { planSession } = planSessionResult;

    // Defense in depth beyond the provider_id scope already enforced above:
    // the plan session must belong to this exact token's patient and
    // currently-resolved plan, not merely to the same provider.
    if (
      planSession.patient_id !== access.patientId ||
      !sessionBelongsToCurrentPlan(planSession.plan_id, access.currentPlanId)
    ) {
      return unableToCompleteResponse(404);
    }

    const prescribedSide = resolvePrescribedSideForOutcome(planSession);
    if (prescribedSide === null) {
      return NextResponse.json(
        { error: PRESCRIBED_SIDE_REQUIRED_MESSAGE, reason: "prescribed_side_required" },
        { status: 400 },
      );
    }

    const assembled = assembleInteractiveShoulderMovementOutcomeSnapshot({
      planSessionId: validation.input.planSessionId,
      prescribedSide,
      sessionState: validation.input.sessionState,
      totalElapsedSeconds: validation.input.totalElapsedSeconds,
      blocksCompleted: validation.input.blocksCompleted,
      blocksTotal: validation.input.blocksTotal,
      blockResults: validation.input.blockResults,
    });
    if (!assembled.ok) {
      return NextResponse.json(
        {
          error: "Session is not eligible for a movement outcome.",
          reason: assembled.reason,
          detail: assembled.detail,
        },
        { status: 400 },
      );
    }

    const row = buildInteractiveShoulderMovementOutcomeInsert({
      planSession,
      snapshot: assembled.snapshot,
    });

    const inserted = await insertInteractiveShoulderMovementOutcome(deps.adminClient, row);
    if (!inserted.ok) {
      if (inserted.httpStatus >= 500) {
        console.error("[POST /api/patient/interactive-shoulder-outcomes]", inserted.message);
      }
      return NextResponse.json({ error: CREATE_ERROR }, { status: inserted.httpStatus });
    }

    const status = inserted.created ? 201 : 200;
    return NextResponse.json(
      toInteractiveShoulderMovementOutcomePublic(inserted.row, inserted.created),
      { status },
    );
  };
}

// ── Real production dependencies ───────────────────────────────────────────────

async function buildRealDependencies(): Promise<InteractiveShoulderOutcomeSubmissionDependencies | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return null;

  // No Supabase auth session for this route — patient-portal token auth
  // only, exactly matching /api/patient/session-complete's buildAdminClient.
  const adminClient = createAdminClient(url, svc, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    featureEnabled: resolveInteractiveShoulderOutcomeSubmissionFeatureFlag(
      process.env.RASQ_INTERACTIVE_SHOULDER_OUTCOME_SUBMISSION_V1,
    ),
    adminClient,
    checkWriteLimit: (req) => checkPatientGeneralLimit(req, "interactive-shoulder-outcomes"),
    resolvePatientAccess: resolvePatientPortalAccess,
  };
}

// ── POST /api/patient/interactive-shoulder-outcomes ─────────────────────────────

export async function POST(req: NextRequest) {
  const deps = await buildRealDependencies();
  if (!deps) return serviceUnavailableResponse();
  return createInteractiveShoulderOutcomeSubmissionHandler(deps)(req);
}
