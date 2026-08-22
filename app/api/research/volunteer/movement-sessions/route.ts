import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkVolunteerMovementSessionLimit,
  checkVolunteerSessionTokenLimit,
  rateLimitExceededResponse,
} from "@/app/lib/rate-limit";
import { genericServerErrorResponse } from "@/app/lib/api/safe-errors";
import {
  getVolunteerSessionTokenFromRequest,
  resolveAuthenticatedVolunteerSession,
} from "@/app/lib/research/volunteer-api-guards";
import { createVolunteerMovementSession } from "@/app/lib/research/volunteer-session-store";
import { validateVolunteerMovementSessionBody } from "@/app/lib/research/volunteer-validation";

/**
 * POST /api/research/volunteer/movement-sessions
 * Create a movement block within an active volunteer collection session.
 */
export async function POST(req: NextRequest) {
  const rawToken = getVolunteerSessionTokenFromRequest(req);
  if (rawToken) {
    const limited = checkVolunteerSessionTokenLimit(req, rawToken, "movement-sessions");
    if (!limited.allowed) {
      return rateLimitExceededResponse(limited.retryAfterSec);
    }
  }

  const resolved = await resolveAuthenticatedVolunteerSession(req);
  if (!resolved.ok) return resolved.response;

  const movementLimited = checkVolunteerMovementSessionLimit(req, rawToken ?? "missing");
  if (!movementLimited.allowed) {
    return rateLimitExceededResponse(movementLimited.retryAfterSec);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validated = validateVolunteerMovementSessionBody(
    (body ?? {}) as Record<string, unknown>,
  );
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const created = await createVolunteerMovementSession(
      resolved.admin,
      resolved.session.id,
      validated.value,
    );

    return NextResponse.json({
      movementSessionId: created.movementSessionId,
      blockIndex: created.blockIndex,
    });
  } catch {
    return genericServerErrorResponse();
  }
}
