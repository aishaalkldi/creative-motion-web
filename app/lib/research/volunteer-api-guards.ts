import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  enforceVolunteerFailedCampaignRateLimit,
  enforceVolunteerFailedSessionTokenRateLimit,
} from "../rate-limit";
import {
  genericServerErrorResponse,
  serviceUnavailableResponse,
  unableToCompleteResponse,
} from "../api/safe-errors";
import { isVolunteerCollectionEnabled } from "./volunteer-feature-flag";
import { VOLUNTEER_SESSION_TOKEN_HEADER } from "./volunteer-constants";
import {
  getVolunteerResearchAdminClient,
  resolveVolunteerCollectionSessionByToken,
  resolveVolunteerCollectionSessionForCompletion,
  type VolunteerCollectionSessionRow,
} from "./volunteer-session-store";

export function volunteerCollectionDisabledResponse(): NextResponse {
  return unableToCompleteResponse(404);
}

export function ensureVolunteerCollectionEnabled(): NextResponse | null {
  if (!isVolunteerCollectionEnabled()) {
    return volunteerCollectionDisabledResponse();
  }
  return null;
}

export function getVolunteerSessionTokenFromRequest(req: NextRequest): string | null {
  const raw = req.headers.get(VOLUNTEER_SESSION_TOKEN_HEADER);
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

export type ResolvedVolunteerSession =
  | {
      ok: true;
      admin: NonNullable<ReturnType<typeof getVolunteerResearchAdminClient>>;
      session: VolunteerCollectionSessionRow;
    }
  | { ok: false; response: NextResponse };

export async function resolveAuthenticatedVolunteerSession(
  req: NextRequest,
): Promise<ResolvedVolunteerSession> {
  const disabled = ensureVolunteerCollectionEnabled();
  if (disabled) return { ok: false, response: disabled };

  const rawToken = getVolunteerSessionTokenFromRequest(req);
  if (!rawToken) {
    const limited = enforceVolunteerFailedSessionTokenRateLimit(req);
    if (limited) return { ok: false, response: limited };
    return { ok: false, response: unableToCompleteResponse(404) };
  }

  const admin = getVolunteerResearchAdminClient();
  if (!admin) {
    return { ok: false, response: serviceUnavailableResponse() };
  }

  try {
    const resolved = await resolveVolunteerCollectionSessionByToken(admin, rawToken);
    if (!resolved.ok) {
      const limited = enforceVolunteerFailedSessionTokenRateLimit(req);
      if (limited) return { ok: false, response: limited };
      return { ok: false, response: unableToCompleteResponse(404) };
    }
    return { ok: true, admin, session: resolved.session };
  } catch {
    return { ok: false, response: genericServerErrorResponse() };
  }
}

export async function resolveVolunteerSessionForCompletion(
  req: NextRequest,
): Promise<ResolvedVolunteerSession> {
  const disabled = ensureVolunteerCollectionEnabled();
  if (disabled) return { ok: false, response: disabled };

  const rawToken = getVolunteerSessionTokenFromRequest(req);
  if (!rawToken) {
    const limited = enforceVolunteerFailedSessionTokenRateLimit(req);
    if (limited) return { ok: false, response: limited };
    return { ok: false, response: unableToCompleteResponse(404) };
  }

  const admin = getVolunteerResearchAdminClient();
  if (!admin) {
    return { ok: false, response: serviceUnavailableResponse() };
  }

  try {
    const resolved = await resolveVolunteerCollectionSessionForCompletion(admin, rawToken);
    if (!resolved.ok) {
      const limited = enforceVolunteerFailedSessionTokenRateLimit(req);
      if (limited) return { ok: false, response: limited };
      return { ok: false, response: unableToCompleteResponse(404) };
    }
    return { ok: true, admin, session: resolved.session };
  } catch {
    return { ok: false, response: genericServerErrorResponse() };
  }
}

export function volunteerInvalidCampaignResponse(req: NextRequest): NextResponse {
  const limited = enforceVolunteerFailedCampaignRateLimit(req);
  if (limited) return limited;
  return unableToCompleteResponse(404);
}
