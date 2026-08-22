import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkVolunteerSessionCreateLimit,
  rateLimitExceededResponse,
} from "@/app/lib/rate-limit";
import {
  genericServerErrorResponse,
  serviceUnavailableResponse,
} from "@/app/lib/api/safe-errors";
import {
  ensureVolunteerCollectionEnabled,
  volunteerInvalidCampaignResponse,
} from "@/app/lib/research/volunteer-api-guards";
import {
  isVolunteerCampaignCodeConfigured,
  verifyVolunteerCampaignCode,
} from "@/app/lib/research/volunteer-campaign";
import {
  createVolunteerCollectionSession,
  getVolunteerResearchAdminClient,
} from "@/app/lib/research/volunteer-session-store";
import { validateVolunteerSessionCreateBody } from "@/app/lib/research/volunteer-validation";

/**
 * POST /api/research/volunteer/sessions
 * Create anonymous volunteer collection session (no browser session id exposure).
 */
export async function POST(req: NextRequest) {
  const disabled = ensureVolunteerCollectionEnabled();
  if (disabled) return disabled;

  const limited = checkVolunteerSessionCreateLimit(req);
  if (!limited.allowed) {
    return rateLimitExceededResponse(limited.retryAfterSec);
  }

  if (!isVolunteerCampaignCodeConfigured()) {
    return serviceUnavailableResponse();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validated = validateVolunteerSessionCreateBody(
    (body ?? {}) as Record<string, unknown>,
  );
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  if (!verifyVolunteerCampaignCode(validated.value.campaignCode)) {
    return volunteerInvalidCampaignResponse(req);
  }

  const admin = getVolunteerResearchAdminClient();
  if (!admin) {
    return serviceUnavailableResponse();
  }

  try {
    const created = await createVolunteerCollectionSession(admin, {
      consentVersion: validated.value.consentVersion,
      consentAcceptedAtMs: validated.value.consentAcceptedAtMs,
      protocolVersion: validated.value.protocolVersion,
    });

    return NextResponse.json({
      sessionToken: created.sessionToken,
      expiresAt: created.expiresAt,
    });
  } catch {
    return genericServerErrorResponse();
  }
}
