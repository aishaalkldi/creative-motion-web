import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkVolunteerRepetitionLimit,
  checkVolunteerSessionTokenLimit,
  rateLimitExceededResponse,
} from "@/app/lib/rate-limit";
import {
  genericServerErrorResponse,
  unableToCompleteResponse,
} from "@/app/lib/api/safe-errors";
import {
  ensureVolunteerCollectionEnabled,
  getVolunteerSessionTokenFromRequest,
  resolveAuthenticatedVolunteerSession,
} from "@/app/lib/research/volunteer-api-guards";
import { persistVolunteerRepetition } from "@/app/lib/research/volunteer-repetition-store";
import { readVolunteerRepetitionJsonBody } from "@/app/lib/research/volunteer-repetition-request";
import {
  validateVolunteerRepetitionBody,
  type VolunteerRepetitionSubmissionBody,
} from "@/app/lib/research/volunteer-repetition-validation";

/**
 * POST /api/research/volunteer/repetitions
 * Persist one validated Shoulder Abduction Reach repetition under an owned movement session.
 */
export async function POST(req: NextRequest) {
  const disabled = ensureVolunteerCollectionEnabled();
  if (disabled) return disabled;

  const rawToken = getVolunteerSessionTokenFromRequest(req);
  if (rawToken) {
    const limited = checkVolunteerSessionTokenLimit(req, rawToken, "repetitions");
    if (!limited.allowed) {
      return rateLimitExceededResponse(limited.retryAfterSec);
    }
  }

  const resolved = await resolveAuthenticatedVolunteerSession(req);
  if (!resolved.ok) return resolved.response;

  const repetitionLimited = checkVolunteerRepetitionLimit(req, rawToken ?? "missing");
  if (!repetitionLimited.allowed) {
    return rateLimitExceededResponse(repetitionLimited.retryAfterSec);
  }

  const parsed = await readVolunteerRepetitionJsonBody(req);
  if (!parsed.ok) {
    if (parsed.status === 413) {
      return NextResponse.json({ error: "Repetition payload exceeds allowed size." }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validated = validateVolunteerRepetitionBody(
    (parsed.body ?? {}) as VolunteerRepetitionSubmissionBody,
  );
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const result = await persistVolunteerRepetition(
      resolved.admin,
      resolved.session.id,
      validated.value,
    );

    if (!result.ok) {
      if (result.reason === "payload_conflict") {
        return NextResponse.json({ error: "Submission conflict." }, { status: 409 });
      }
      return unableToCompleteResponse(404);
    }

    return NextResponse.json({
      repetitionId: result.repetitionId,
      created: result.created,
    });
  } catch {
    return genericServerErrorResponse();
  }
}
