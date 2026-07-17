/**
 * Tracking observability foundation: short, friendly, bilingual (en/ar)
 * copy for the live STS tracking-status panel. Pure presentation mapping
 * only — does not read or influence detector state.
 */

import type {
  BodyFramingState,
  PoseReadiness,
  SitToStandTrackingStatus,
} from "@/app/lib/cv/sit-to-stand-detector";
import type { StsCapturePhase } from "@/app/lib/cv/sts-biomechanical-capture-fsm";

function pick(isRtl: boolean, en: string, ar: string): string {
  return isRtl ? ar : en;
}

export function stsPoseDetectedCopy(
  trackingStatus: SitToStandTrackingStatus,
  isRtl: boolean,
): string {
  switch (trackingStatus) {
    case "pose-found":
      return pick(isRtl, "Body detected", "تم اكتشاف الجسم");
    case "detecting":
      return pick(isRtl, "Looking for you in frame…", "جارٍ البحث عنك في الإطار…");
    case "pose-lost":
      return pick(
        isRtl,
        "Can't see you clearly — step back into frame",
        "لا يمكننا رؤيتك بوضوح — عد إلى الإطار",
      );
    case "idle":
    default:
      return pick(isRtl, "Camera not started", "لم يتم تشغيل الكاميرا");
  }
}

function bodyFramingCopy(bodyFramingState: BodyFramingState, isRtl: boolean): string {
  switch (bodyFramingState) {
    case "move_back":
      return pick(
        isRtl,
        "Move back so your whole body is visible",
        "تراجع للخلف ليظهر جسمك بالكامل",
      );
    case "move_closer":
      return pick(isRtl, "Move a little closer to the camera", "اقترب قليلاً من الكاميرا");
    case "adjust_camera_angle":
      return pick(
        isRtl,
        "Adjust your camera angle so your whole body is visible",
        "عدّل زاوية الكاميرا ليظهر جسمك بالكامل",
      );
    case "low_visibility":
      return pick(isRtl, "Move into better lighting", "انتقل إلى مكان به إضاءة أفضل");
    case "checking":
      return pick(isRtl, "Checking your setup…", "جارٍ التحقق من الإعداد…");
    case "good_distance":
    default:
      return pick(isRtl, "Adjust your position to continue", "عدّل وضعك للمتابعة");
  }
}

export function stsReadinessCopy(
  poseReadiness: PoseReadiness,
  bodyFramingState: BodyFramingState,
  isRtl: boolean,
): string {
  switch (poseReadiness) {
    case "ready":
      return pick(isRtl, "Ready to track", "جاهز للتتبع");
    case "partial":
      return pick(
        isRtl,
        "Almost ready — adjust your position slightly",
        "تقريبًا جاهز — عدّل وضعك قليلاً",
      );
    case "checking":
      return pick(isRtl, "Checking your setup…", "جارٍ التحقق من الإعداد…");
    case "not_ready":
    default:
      return bodyFramingCopy(bodyFramingState, isRtl);
  }
}

export function stsCapturePhaseCopy(
  capturePhase: StsCapturePhase | undefined,
  isRtl: boolean,
): string | null {
  switch (capturePhase) {
    case "seated":
      return pick(isRtl, "Seated — ready when you are", "جالس — جاهز عندما تكون مستعدًا");
    case "rising":
      return pick(isRtl, "Rising…", "في طور النهوض…");
    case "standing":
      return pick(isRtl, "Standing", "واقف");
    case "returning":
      return pick(isRtl, "Returning to seated…", "في طور الجلوس…");
    case "calibrating":
    case undefined:
    default:
      return null;
  }
}

export function stsCalibratingCopy(isRtl: boolean): string {
  return pick(isRtl, "Hold still — calibrating…", "ابقَ ثابتًا — جارٍ المعايرة…");
}
