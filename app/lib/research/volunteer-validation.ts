import {
  VOLUNTEER_CONSENT_VERSION,
  VOLUNTEER_MOVEMENT_TYPES,
  VOLUNTEER_PILOT_SIDE,
  VOLUNTEER_PROTOCOL_CONDITIONS,
  VOLUNTEER_PROTOCOL_VERSION,
  type VolunteerMovementType,
  type VolunteerProtocolCondition,
  type VolunteerSide,
} from "./volunteer-constants";

export type VolunteerSessionCreateBody = {
  campaignCode?: unknown;
  consentVersion?: unknown;
  consentAcceptedAtMs?: unknown;
  ageConfirmed18Plus?: unknown;
  protocolVersion?: unknown;
};

export type VolunteerMovementSessionBody = {
  movementType?: unknown;
  protocolCondition?: unknown;
  side?: unknown;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isAllowedEnumValue<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

export type ValidatedSessionCreateInput = {
  campaignCode: string;
  consentVersion: string;
  consentAcceptedAtMs: number;
  protocolVersion: string;
};

export function validateVolunteerSessionCreateBody(
  body: VolunteerSessionCreateBody,
): ValidationResult<ValidatedSessionCreateInput> {
  if (!isNonEmptyString(body.campaignCode)) {
    return { ok: false, error: "Campaign code is required." };
  }

  if (body.ageConfirmed18Plus !== true) {
    return { ok: false, error: "Age confirmation is required." };
  }

  if (!isNonEmptyString(body.consentVersion) || body.consentVersion !== VOLUNTEER_CONSENT_VERSION) {
    return { ok: false, error: "Consent version is invalid." };
  }

  if (
    typeof body.consentAcceptedAtMs !== "number" ||
    !Number.isFinite(body.consentAcceptedAtMs) ||
    body.consentAcceptedAtMs < 0
  ) {
    return { ok: false, error: "Consent timestamp is invalid." };
  }

  if (
    !isNonEmptyString(body.protocolVersion) ||
    body.protocolVersion !== VOLUNTEER_PROTOCOL_VERSION
  ) {
    return { ok: false, error: "Protocol version is invalid." };
  }

  return {
    ok: true,
    value: {
      campaignCode: body.campaignCode.trim(),
      consentVersion: body.consentVersion,
      consentAcceptedAtMs: body.consentAcceptedAtMs,
      protocolVersion: body.protocolVersion,
    },
  };
}

export type ValidatedMovementSessionInput = {
  movementType: VolunteerMovementType;
  protocolCondition: VolunteerProtocolCondition;
  side: VolunteerSide;
};

export function validateVolunteerMovementSessionBody(
  body: VolunteerMovementSessionBody,
): ValidationResult<ValidatedMovementSessionInput> {
  if (!isAllowedEnumValue(body.movementType, VOLUNTEER_MOVEMENT_TYPES)) {
    return { ok: false, error: "Movement type is not supported." };
  }

  if (!isAllowedEnumValue(body.protocolCondition, VOLUNTEER_PROTOCOL_CONDITIONS)) {
    return { ok: false, error: "Protocol condition is not supported." };
  }

  if (!isAllowedEnumValue(body.side, [VOLUNTEER_PILOT_SIDE])) {
    return { ok: false, error: "Side is not supported for this pilot." };
  }

  return {
    ok: true,
    value: {
      movementType: body.movementType,
      protocolCondition: body.protocolCondition,
      side: body.side,
    },
  };
}
