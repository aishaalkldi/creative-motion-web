/**
 * Upper-Limb Motor Screen API constants.
 * Token TTL matches remote_assessment_requests (migration 006): 7 days.
 */

/** Days until a patient-access token expires — matches migration 006 policy. */
export const MOTOR_SCREEN_TOKEN_TTL_DAYS = 7;

export function computeMotorScreenTokenExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + MOTOR_SCREEN_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Assignment statuses that permit patient token lookup. */
export const MOTOR_SCREEN_ACTIVE_ASSIGNMENT_STATUSES = ["assigned", "started"] as const;
