/**
 * Tracking observability foundation: maps a raw STS attempt outcome
 * (from StsBiomechanicalCaptureFsm's StsAttemptSummary) into short,
 * friendly, patient-facing copy. The raw `reason` string is internal
 * diagnostic text only — never shown to patients directly, debug-panel
 * use only (?cvDebug=1).
 */

import type { StsAttemptType } from "@/app/lib/cv/sts-biomechanical-capture-fsm";

type BilingualCopy = { en: string; ar: string };

const REP_COUNTED: BilingualCopy = { en: "Rep counted ✓", ar: "تم تسجيل التكرار ✓" };
const TRY_STANDING_FURTHER: BilingualCopy = {
  en: "Try standing up a little further",
  ar: "حاول الوقوف بشكل أكمل",
};
const TOO_QUICK: BilingualCopy = {
  en: "That was a bit quick — try a steady pace",
  ar: "كانت الحركة سريعة جدًا — حاول بوتيرة ثابتة",
};
const MOVEMENT_UNCLEAR: BilingualCopy = {
  en: "Movement wasn't clear — try again",
  ar: "لم تكن الحركة واضحة — حاول مرة أخرى",
};
const LOST_SIGHT: BilingualCopy = {
  en: "We lost sight of you — check your camera position",
  ar: "فقدنا رؤيتك — تحقق من وضع الكاميرا",
};
const SIT_ALL_THE_WAY: BilingualCopy = {
  en: "Make sure to sit all the way back down",
  ar: "تأكد من الجلوس بالكامل مرة أخرى",
};
const TRACKING_INTERRUPTED: BilingualCopy = {
  en: "Tracking was interrupted — try again",
  ar: "تم مقاطعة التتبع — حاول مرة أخرى",
};
const SESSION_ENDED_EARLY: BilingualCopy = {
  en: "The session ended before that movement finished",
  ar: "انتهت الجلسة قبل اكتمال الحركة",
};
const NOT_COUNTED_FALLBACK: BilingualCopy = {
  en: "That attempt wasn't counted — try again",
  ar: "لم يتم احتساب تلك المحاولة — حاول مرة أخرى",
};

/**
 * Exact raw `reason` strings currently produced by StsBiomechanicalCaptureFsm
 * (app/lib/cv/sts-biomechanical-capture-fsm.ts). Kept as a literal map rather
 * than importing shared constants, since that file is not modified as part
 * of this change — if its wording ever changes, unmapped reasons safely fall
 * back to NOT_COUNTED_FALLBACK rather than throwing.
 */
const RAW_REASON_COPY: Record<string, BilingualCopy> = {
  "Rising detected but standing phase was not confirmed.": TRY_STANDING_FURTHER,
  "Return confirmed but standing-like peak was not reached.": TRY_STANDING_FURTHER,
  "Cycle duration was too brief for a supported complete attempt.": TOO_QUICK,
  "Seated return confirmed but rising evidence was incomplete.": MOVEMENT_UNCLEAR,
  "Insufficient visibility or phase transition evidence during rising.": LOST_SIGHT,
  "Unable to assess due to camera angle or limited landmark visibility.": LOST_SIGHT,
  "Standing reached but return phase was not confirmed.": SIT_ALL_THE_WAY,
  "Standing reached but seated return was not confirmed.": SIT_ALL_THE_WAY,
  "Return phase detected but seated return was not confirmed.": SIT_ALL_THE_WAY,
  "Readiness or calibration gate interrupted attempt evidence.": TRACKING_INTERRUPTED,
  "Session ended before seated return was confirmed.": SESSION_ENDED_EARLY,
  "Insufficient phase transition evidence before session end.": NOT_COUNTED_FALLBACK,
};

/**
 * Friendly patient-facing copy for the most recently finalized STS attempt.
 * Returns null when there is nothing to show yet (no attempt has finished).
 */
export function stsAttemptOutcomeCopy(
  attemptType: StsAttemptType | null,
  reason: string | null,
  isRtl: boolean,
): string | null {
  if (attemptType === null) return null;
  if (attemptType === "complete") {
    return isRtl ? REP_COUNTED.ar : REP_COUNTED.en;
  }
  const entry = (reason ? RAW_REASON_COPY[reason] : undefined) ?? NOT_COUNTED_FALLBACK;
  return isRtl ? entry.ar : entry.en;
}
