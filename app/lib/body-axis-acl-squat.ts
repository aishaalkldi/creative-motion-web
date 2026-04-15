/**
 * MVP Single-Leg Squat (ACL-oriented) analysis from normalized pose landmarks.
 * Stance leg fixed to "right" for this version (left leg unloaded).
 */

export type NormLandmark = { x: number; y: number; z?: number; visibility?: number };

/** Set false to silence temporary `[ACL]` console logs. */
const ACL_DEBUG = true;

/** MediaPipe pose landmark indices (33-point pose). */
export const L = {
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
  L_ANKLE: 27,
  R_ANKLE: 28,
} as const;

/**
 * Rep hysteresis (stance knee interior angle, hip–knee–ankle).
 * Between HYST_DOWN_DEG and HYST_UP_DEG the phase does not flip — reduces webcam jitter.
 */
/** Enter “down” only after this many consecutive frames with smoothed knee < HYST_DOWN_DEG. */
const DOWN_STREAK_ENTER = 5;
/** Count rep++ only after this many consecutive frames with smoothed knee > HYST_UP_DEG while down. */
const UP_STREAK_COMPLETE = 5;
/** Loosened further for repeated reps on webcam (interior angle at stance knee). */
const HYST_DOWN_DEG = 132;
const HYST_UP_DEG = 156;
/** After a rep, require this many frames of “tall” standing before the next descent can arm. */
const NEUTRAL_TOP_DEG = 166;
const NEUTRAL_STREAK = 4;
/** Frames after rep++ where entering “down” is blocked (bounce / settle). */
const REP_COOLDOWN_FRAMES = 8;
/** EMA weight on raw knee angle each frame (higher = less smoothing, faster response). */
const KNEE_ANGLE_EMA_ALPHA = 0.45;
/** Minimum wall time after a completed rep before a new descent can start (anti double-count). */
const MIN_MS_BETWEEN_REPS = 520;
/** Any stance point below this (when defined) triggers on-screen guidance. */
const STANCE_GUIDANCE_VIS = 0.28;
/** Knee + ankle must both be under this (when both defined) to stress the rep FSM. */
const KNEE_ANKLE_STRESS_VIS = 0.23;
/** Hip + knee both weak (when defined) also stresses FSM (unstable chain). */
const HIP_KNEE_STRESS_VIS = 0.26;
/** Consecutive “stress” frames before FSM pauses descent (short blips ignored). */
const VIS_PAUSE_NEED_FRAMES = 12;
/** Only after this many frames with FSM paused do we force a full recovery reset. */
const LONG_TRACKING_LOSS_FRAMES = 110;
/** If still disarmed after a rep, re-arm after this many frames while clearly extended. */
const SAFETY_ARM_FRAMES = 72;
/** Optional soft visibility floor for debug only — tracking uses finite x/y. */
const MIN_VIS_SOFT = 0.2;

export type AclProcessResult = {
  liveOk: boolean;
  kneeAngleDeg: number | null;
  stanceKneeVis: number | null;
  stanceAnkleVis: number | null;
  landmarksValidThisFrame: boolean;
  stanceLegVisPoor: boolean;
  /** True when ankle visibility alone is weak (for guidance copy). */
  stanceAnkleVisWeak: boolean;
};

function angleAtB(a: NormLandmark, b: NormLandmark, c: NormLandmark): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (m < 1e-8) return 180;
  const cos = Math.max(-1, Math.min(1, dot / m));
  return (Math.acos(cos) * 180) / Math.PI;
}

function distPointToLine(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 1e-8) return Math.hypot(px - ax, py - ay);
  return Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
}

/** MediaPipe often yields low/zero `visibility` on knees/ankles; reps still need stable x/y. */
function okLm(lm: NormLandmark | undefined): lm is NormLandmark {
  return Boolean(lm && Number.isFinite(lm.x) && Number.isFinite(lm.y));
}

export class AclSingleLegSquatTracker {
  stance: "right" = "right";

  repCount = 0;
  valgusCount = 0;
  hipDropCount = 0;
  trunkLeanCount = 0;

  private squatPhase: "up" | "down" = "up";
  private downStreak = 0;
  private upStreak = 0;
  private valgusThisRep = false;
  private hipDropThisRep = false;
  private trunkThisRep = false;

  /** After rep++, false until neutral standing is held again. */
  private repArmed = true;
  private neutralStreak = 0;
  /** Countdown after each rep++; while >0, cannot enter “down”. */
  private cooldownRemaining = 0;
  /** Frames since last rep completion; -1 = none yet. */
  private framesSinceRepComplete = -1;
  /** Consecutive frames where knee+ankle (or hip+knee) visibility is badly degraded. */
  private visStressStreak = 0;
  /** Frames spent with rep FSM paused on visibility — long loss triggers recovery. */
  private prolongedFsmPauseFrames = 0;

  /** Low-pass knee angle (hip–knee–ankle) for FSM only; reduces webcam jitter undercounting. */
  private kneeAngleEma: number | null = null;
  /** Wall-clock time of last rep completion; used with MIN_MS_BETWEEN_REPS. */
  private lastRepCompleteMs = 0;

  private dbgFrame = 0;

  reset() {
    this.repCount = 0;
    this.valgusCount = 0;
    this.hipDropCount = 0;
    this.trunkLeanCount = 0;
    this.squatPhase = "up";
    this.downStreak = 0;
    this.upStreak = 0;
    this.valgusThisRep = false;
    this.hipDropThisRep = false;
    this.trunkThisRep = false;
    this.repArmed = true;
    this.neutralStreak = 0;
    this.cooldownRemaining = 0;
    this.framesSinceRepComplete = -1;
    this.visStressStreak = 0;
    this.prolongedFsmPauseFrames = 0;
    this.kneeAngleEma = null;
    this.lastRepCompleteMs = 0;
    this.dbgFrame = 0;
  }

  process(landmarks: NormLandmark[], nowMs: number): AclProcessResult {
    const rh = landmarks[L.R_HIP];
    const rk = landmarks[L.R_KNEE];
    const ra = landmarks[L.R_ANKLE];
    const lh = landmarks[L.L_HIP];
    const ls = landmarks[L.L_SHOULDER];
    const rs = landmarks[L.R_SHOULDER];

    this.dbgFrame += 1;

    if (!okLm(rh) || !okLm(rk) || !okLm(ra) || !okLm(lh) || !okLm(ls) || !okLm(rs)) {
      if (ACL_DEBUG && this.dbgFrame % 45 === 0) {
        console.log("[ACL] skip: missing/non-finite stance landmarks", {
          landmarksValidThisFrame: false,
          stanceKneeVis: rk?.visibility ?? null,
          stanceAnkleVis: ra?.visibility ?? null,
          R_HIP: !!okLm(rh),
          R_KNEE: !!okLm(rk),
          R_ANKLE: !!okLm(ra),
          L_HIP: !!okLm(lh),
          L_SHO: !!okLm(ls),
          R_SHO: !!okLm(rs),
        });
      }
      return {
        liveOk: true,
        kneeAngleDeg: null,
        stanceKneeVis: rk?.visibility ?? null,
        stanceAnkleVis: ra?.visibility ?? null,
        landmarksValidThisFrame: false,
        stanceLegVisPoor: false,
        stanceAnkleVisWeak: false,
      };
    }

    const stanceKneeVis = rk.visibility ?? null;
    const stanceAnkleVis = ra.visibility ?? null;
    const rhV = rh.visibility;
    const rkV = rk.visibility;
    const raV = ra.visibility;

    const stanceLegVisPoor =
      (rhV !== undefined && rhV < STANCE_GUIDANCE_VIS) ||
      (rkV !== undefined && rkV < STANCE_GUIDANCE_VIS) ||
      (raV !== undefined && raV < STANCE_GUIDANCE_VIS);

    const stanceAnkleVisWeak = raV !== undefined && raV < STANCE_GUIDANCE_VIS;

    const bothKneeAnkleStress =
      rkV !== undefined &&
      raV !== undefined &&
      rkV < KNEE_ANKLE_STRESS_VIS &&
      raV < KNEE_ANKLE_STRESS_VIS;
    const hipKneeStress =
      rhV !== undefined && rkV !== undefined && rhV < HIP_KNEE_STRESS_VIS && rkV < HIP_KNEE_STRESS_VIS;

    if (bothKneeAnkleStress || hipKneeStress) {
      this.visStressStreak += 1;
    } else {
      this.visStressStreak = 0;
    }

    const fsmPaused = this.visStressStreak >= VIS_PAUSE_NEED_FRAMES;

    const kneeAngleRaw = angleAtB(rh, rk, ra);
    if (this.kneeAngleEma === null) {
      this.kneeAngleEma = kneeAngleRaw;
    } else {
      this.kneeAngleEma =
        KNEE_ANGLE_EMA_ALPHA * kneeAngleRaw +
        (1 - KNEE_ANGLE_EMA_ALPHA) * this.kneeAngleEma;
    }
    const kneeAngle = this.kneeAngleEma;

    if (this.framesSinceRepComplete >= 0) {
      this.framesSinceRepComplete += 1;
    }
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining -= 1;
      if (this.cooldownRemaining === 0 && ACL_DEBUG) {
        console.log("[ACL] rep cooldown ended — descent can arm once standing gate passes");
      }
    }

    if (fsmPaused) {
      this.prolongedFsmPauseFrames += 1;
    } else {
      this.prolongedFsmPauseFrames = 0;
    }

    if (this.prolongedFsmPauseFrames > LONG_TRACKING_LOSS_FRAMES) {
      this.downStreak = 0;
      this.upStreak = 0;
      this.neutralStreak = 0;
      this.visStressStreak = 0;
      this.prolongedFsmPauseFrames = 0;
      if (kneeAngle > 155) {
        this.repArmed = true;
      }
      if (ACL_DEBUG) {
        console.log("[ACL] rep FSM recovered after prolonged tracking loss (visibility)", {
          kneeAngle: kneeAngle.toFixed(1),
          repArmed: this.repArmed,
        });
      }
    }

    if (!fsmPaused && !this.repArmed) {
      if (kneeAngle > NEUTRAL_TOP_DEG) {
        this.neutralStreak += 1;
      } else {
        this.neutralStreak = 0;
      }
      if (this.neutralStreak >= NEUTRAL_STREAK) {
        this.repArmed = true;
        this.neutralStreak = 0;
        if (ACL_DEBUG) {
          console.log("[ACL] neutral standing held — ready for next rep", {
            kneeAngle: kneeAngle.toFixed(1),
          });
        }
      }
    }

    if (
      !fsmPaused &&
      !this.repArmed &&
      this.framesSinceRepComplete >= SAFETY_ARM_FRAMES &&
      kneeAngle > 162
    ) {
      this.repArmed = true;
      this.neutralStreak = 0;
      this.downStreak = 0;
      if (ACL_DEBUG) {
        console.log("[ACL] rep cycle re-armed (safety timeout while extended)", {
          framesSinceRep: this.framesSinceRepComplete,
          kneeAngle: kneeAngle.toFixed(1),
        });
      }
    }

    const inCooldown = this.cooldownRemaining > 0;
    const repSpacingOk =
      this.repCount === 0 || nowMs - this.lastRepCompleteMs >= MIN_MS_BETWEEN_REPS;
    const canSeekDown = this.repArmed && !inCooldown && !fsmPaused && repSpacingOk;

    /** Descent / bottom band for valgus etc. — overlaps partial squat ROM, widened slightly for noise. */
    const inSquatRange = kneeAngle < 165 && kneeAngle > 68;
    let valgusFrame = false;
    let hipDropFrame = false;
    let trunkFrame = false;

    if (inSquatRange) {
      const legLen = Math.hypot(ra.x - rh.x, ra.y - rh.y) + 1e-6;
      const dev = distPointToLine(rk.x, rk.y, rh.x, rh.y, ra.x, ra.y);
      /** Stance (right) knee lateral offset vs hip–ankle line; normalized by thigh length. */
      valgusFrame = dev / legLen > 0.085;

      /** Right stance: contralateral (left) hip “drops” → higher image y than right hip. */
      const hipDropNorm = lh.y - rh.y;
      hipDropFrame = hipDropNorm > 0.028;

      const msx = (ls.x + rs.x) * 0.5;
      const mhx = (lh.x + rh.x) * 0.5;
      const shoulderW = Math.abs(rs.x - ls.x) + 1e-6;
      trunkFrame = Math.abs(msx - mhx) / shoulderW > 0.125;
    }

    if (inSquatRange) {
      if (valgusFrame) this.valgusThisRep = true;
      if (hipDropFrame) this.hipDropThisRep = true;
      if (trunkFrame) this.trunkThisRep = true;
    }

    if (this.squatPhase === "up") {
      if (!fsmPaused) {
        if (!canSeekDown) {
          this.downStreak = 0;
        } else if (kneeAngle < HYST_DOWN_DEG) {
          this.downStreak += 1;
        } else {
          this.downStreak = 0;
        }
        if (canSeekDown && this.downStreak >= DOWN_STREAK_ENTER) {
          this.squatPhase = "down";
          this.downStreak = 0;
          this.upStreak = 0;
        }
      }
    } else {
      /** Finish rep even if stance visibility dips mid-squat. */
      if (kneeAngle > HYST_UP_DEG) {
        this.upStreak += 1;
      } else {
        this.upStreak = 0;
      }
      if (this.upStreak >= UP_STREAK_COMPLETE) {
        const prevReps = this.repCount;
        this.repCount += 1;
        this.lastRepCompleteMs = nowMs;
        this.repArmed = false;
        this.neutralStreak = 0;
        this.cooldownRemaining = REP_COOLDOWN_FRAMES;
        this.framesSinceRepComplete = 0;
        if (ACL_DEBUG) {
          console.log("[ACL] rep increment", {
            kneeAngle: kneeAngle.toFixed(1),
            phase: "up",
            downStreak: this.downStreak,
            upStreak: this.upStreak,
            from: prevReps,
            to: this.repCount,
            valgusThisRep: this.valgusThisRep,
            hipDropThisRep: this.hipDropThisRep,
            trunkThisRep: this.trunkThisRep,
            cooldownFrames: this.cooldownRemaining,
            repArmedNext: this.repArmed,
          });
          console.log("[ACL] rep state reset — re-arm after neutral + cooldown", {
            neutralNeedDeg: NEUTRAL_TOP_DEG,
            neutralStreakNeed: NEUTRAL_STREAK,
          });
        }
        if (this.valgusThisRep) this.valgusCount += 1;
        if (this.hipDropThisRep) this.hipDropCount += 1;
        if (this.trunkThisRep) this.trunkLeanCount += 1;
        this.valgusThisRep = false;
        this.hipDropThisRep = false;
        this.trunkThisRep = false;
        this.squatPhase = "up";
        this.upStreak = 0;
        this.downStreak = 0;
      }
    }

    const liveOk = !valgusFrame && !hipDropFrame && !trunkFrame;

    if (ACL_DEBUG && this.dbgFrame % 15 === 0) {
      const phase = this.squatPhase;
      const visHint = {
        rkVis: rk.visibility,
        raVis: ra.visibility,
        rhVis: rh.visibility,
      };
      const lowVis =
        [rh, rk, ra, lh, ls, rs].some(
          (p) => p.visibility !== undefined && p.visibility < MIN_VIS_SOFT
        );
      if (lowVis && this.dbgFrame % 60 === 0) {
        console.log("[ACL] soft visibility note (tracking still runs):", visHint);
      }
      console.log("[ACL] tick", {
        kneeAngle: Number(kneeAngle.toFixed(1)),
        phase,
        downStreak: this.downStreak,
        upStreak: this.upStreak,
        stanceKneeVis,
        stanceAnkleVis,
        landmarksValidThisFrame: true,
        stanceLegVisPoor,
        visStressStreak: this.visStressStreak,
        fsmPaused,
        repArmed: this.repArmed,
        cooldownRemaining: this.cooldownRemaining,
        canSeekDown,
        inSquatRange,
        valgusFrame,
        hipDropFrame,
        trunkFrame,
        reps: this.repCount,
        valgusReps: this.valgusCount,
        hipDropReps: this.hipDropCount,
        trunkReps: this.trunkLeanCount,
      });
    }

    if (ACL_DEBUG && valgusFrame && this.dbgFrame % 5 === 0) {
      const legLen = Math.hypot(ra.x - rh.x, ra.y - rh.y) + 1e-6;
      const dev = distPointToLine(rk.x, rk.y, rh.x, rh.y, ra.x, ra.y);
      console.log("[ACL] valgus frame", { ratio: Number((dev / legLen).toFixed(3)) });
    }
    if (ACL_DEBUG && hipDropFrame && this.dbgFrame % 5 === 0) {
      console.log("[ACL] hip drop frame", { lhMinusRhY: Number((lh.y - rh.y).toFixed(4)) });
    }
    if (ACL_DEBUG && trunkFrame && this.dbgFrame % 5 === 0) {
      const msx = (ls.x + rs.x) * 0.5;
      const mhx = (lh.x + rh.x) * 0.5;
      const shoulderW = Math.abs(rs.x - ls.x) + 1e-6;
      console.log("[ACL] trunk lean frame", {
        ratio: Number((Math.abs(msx - mhx) / shoulderW).toFixed(3)),
      });
    }

    return {
      liveOk,
      kneeAngleDeg: kneeAngle,
      stanceKneeVis,
      stanceAnkleVis,
      landmarksValidThisFrame: true,
      stanceLegVisPoor,
      stanceAnkleVisWeak,
    };
  }

  /**
   * Returns null when no full repetition was completed — avoids treating
   * “all zeros” as a perfect 100% score.
   */
  finalScore(): number | null {
    if (this.repCount < 1) return null;
    let s =
      100 -
      this.valgusCount * 2 -
      this.hipDropCount * 1.5 -
      this.trunkLeanCount * 1;
    s = Math.max(0, Math.min(100, Math.round(s)));
    return s;
  }

  /** Summary when tracking ran but no rep was counted (score stored as 0). */
  summaryLineNoReps(): string {
    return `Single-Leg Squat: 0 rep(s). Valgus: ${this.valgusCount}, hip drop: ${this.hipDropCount}, trunk lean: ${this.trunkLeanCount}. Score 0/100 (Needs Attention). No complete repetition was detected; repeat with full depth and stay in frame.`;
  }

  severity(score: number): "Mild" | "Moderate" | "Needs Attention" {
    if (score >= 85) return "Mild";
    if (score >= 70) return "Moderate";
    return "Needs Attention";
  }

  summaryLine(score: number): string {
    const sev = this.severity(score);
    const interp =
      score >= 85
        ? "Good single-leg squat performance with mild movement deviation."
        : score >= 70
          ? "Moderate dynamic control deficit detected during single-leg squat."
          : "Notable movement control deficit detected during single-leg squat.";
    return `Single-Leg Squat: ${this.repCount} rep(s). Valgus: ${this.valgusCount}, hip drop: ${this.hipDropCount}, trunk lean: ${this.trunkLeanCount}. Score ${score}/100 (${sev}). ${interp}`;
  }
}

export function isAclSingleLegSquatTest(test: string | null): boolean {
  return test === "single_leg_squat";
}
