import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkVolunteerCompleteLimit,
  checkVolunteerSessionTokenLimit,
  rateLimitExceededResponse,
} from "@/app/lib/rate-limit";
import { genericServerErrorResponse } from "@/app/lib/api/safe-errors";
import {
  getVolunteerSessionTokenFromRequest,
  resolveVolunteerSessionForCompletion,
} from "@/app/lib/research/volunteer-api-guards";
import { completeVolunteerCollectionSession } from "@/app/lib/research/volunteer-session-store";

/**
 * PATCH /api/research/volunteer/session/complete
 * Complete an active volunteer collection session and mint a one-time deletion code.
 */
export async function PATCH(req: NextRequest) {
  const rawToken = getVolunteerSessionTokenFromRequest(req);
  if (rawToken) {
    const limited = checkVolunteerSessionTokenLimit(req, rawToken, "complete");
    if (!limited.allowed) {
      return rateLimitExceededResponse(limited.retryAfterSec);
    }
  }

  const resolved = await resolveVolunteerSessionForCompletion(req);
  if (!resolved.ok) return resolved.response;

  const completeLimited = checkVolunteerCompleteLimit(req, rawToken ?? "missing");
  if (!completeLimited.allowed) {
    return rateLimitExceededResponse(completeLimited.retryAfterSec);
  }

  try {
    const result = await completeVolunteerCollectionSession(
      resolved.admin,
      resolved.session,
    );

    if ("alreadyCompleted" in result && result.alreadyCompleted) {
      return NextResponse.json({ ok: true, alreadyCompleted: true });
    }

    if ("deletionCode" in result) {
      return NextResponse.json({
        ok: true,
        deletionCode: result.deletionCode,
      });
    }

    return genericServerErrorResponse();
  } catch {
    return genericServerErrorResponse();
  }
}
