/**
 * Baseline vs latest comparison from existing progress bundle data.
 * Patient-reported / derived observations only — therapist interpretation required.
 */

import type { ProgressOutcomesBundle } from "@/app/lib/progress/progress-outcomes-bundle";

export const LONGITUDINAL_COMPARISON_DISCLAIMER =
  "Comparison uses earliest vs most recent records on file. Trends require therapist interpretation — not a clinical score.";

export type ComparisonDirection = "improved" | "worse" | "stable" | "unknown";

export type LongitudinalPainComparison = {
  baselinePainAfter: number | null;
  latestPainAfter: number | null;
  delta: number | null;
  direction: ComparisonDirection;
  sessionCount: number;
};

export type LongitudinalAssessmentComparison = {
  baselineDate: string | null;
  latestDate: string | null;
  baselinePainAtRest: string | null;
  latestPainAtRest: string | null;
  baselineBodyRegion: string | null;
  latestBodyRegion: string | null;
};

export type LongitudinalCvComparison = {
  exerciseId: string;
  baselineRecordedAt: string | null;
  latestRecordedAt: string | null;
  repDelta: number | null;
  durationDeltaS: number | null;
};

export type LongitudinalComparison = {
  hasComparison: boolean;
  pain: LongitudinalPainComparison | null;
  assessment: LongitudinalAssessmentComparison | null;
  cv: LongitudinalCvComparison | null;
  disclaimer: string;
};

function parsePainScore(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number.parseFloat(match[1]!);
  return Number.isFinite(n) ? n : null;
}

function painDirection(delta: number | null): ComparisonDirection {
  if (delta == null) return "unknown";
  if (delta <= -1) return "improved";
  if (delta >= 1) return "worse";
  return "stable";
}

export function buildLongitudinalComparison(
  bundle: ProgressOutcomesBundle,
): LongitudinalComparison {
  const empty: LongitudinalComparison = {
    hasComparison: false,
    pain: null,
    assessment: null,
    cv: null,
    disclaimer: LONGITUDINAL_COMPARISON_DISCLAIMER,
  };

  let pain: LongitudinalPainComparison | null = null;
  const painPoints = bundle.painTrend.filter((row) => row.painAfter != null);
  if (painPoints.length >= 2) {
    const baseline = painPoints[0]!;
    const latest = painPoints[painPoints.length - 1]!;
    const delta =
      baseline.painAfter != null && latest.painAfter != null
        ? latest.painAfter - baseline.painAfter
        : null;
    pain = {
      baselinePainAfter: baseline.painAfter,
      latestPainAfter: latest.painAfter,
      delta,
      direction: painDirection(delta),
      sessionCount: painPoints.length,
    };
  }

  let assessment: LongitudinalAssessmentComparison | null = null;
  const sortedAssessments = [...bundle.assessments].sort(
    (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
  );
  if (sortedAssessments.length >= 2) {
    const baseline = sortedAssessments[0]!;
    const latest = sortedAssessments[sortedAssessments.length - 1]!;
    assessment = {
      baselineDate: baseline.submittedAt,
      latestDate: latest.submittedAt,
      baselinePainAtRest: baseline.painAtRest ?? null,
      latestPainAtRest: latest.painAtRest ?? null,
      baselineBodyRegion: baseline.bodyRegion ?? null,
      latestBodyRegion: latest.bodyRegion ?? null,
    };
  } else if (sortedAssessments.length === 1 && painPoints.length >= 1) {
    const only = sortedAssessments[0]!;
    const baselinePain = parsePainScore(only.painAtRest ?? undefined);
    const latestPain = painPoints[painPoints.length - 1]?.painAfter ?? null;
    assessment = {
      baselineDate: only.submittedAt,
      latestDate: painPoints[painPoints.length - 1]?.completedAt ?? null,
      baselinePainAtRest: only.painAtRest ?? null,
      latestPainAtRest: latestPain != null ? `${latestPain}/10` : null,
      baselineBodyRegion: only.bodyRegion ?? null,
      latestBodyRegion: only.bodyRegion ?? null,
    };
  }

  let cv: LongitudinalCvComparison | null = null;
  const cvSorted = [...bundle.cvEvidence].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );
  if (cvSorted.length >= 2) {
    const byExercise = new Map<string, typeof cvSorted>();
    for (const row of cvSorted) {
      const arr = byExercise.get(row.exerciseId) ?? [];
      arr.push(row);
      byExercise.set(row.exerciseId, arr);
    }
    for (const [exerciseId, rows] of byExercise) {
      if (rows.length < 2) continue;
      const baseline = rows[0]!;
      const latest = rows[rows.length - 1]!;
      cv = {
        exerciseId,
        baselineRecordedAt: baseline.recordedAt,
        latestRecordedAt: latest.recordedAt,
        repDelta:
          baseline.repCount != null && latest.repCount != null
            ? latest.repCount - baseline.repCount
            : null,
        durationDeltaS:
          baseline.sessionDurationS != null && latest.sessionDurationS != null
            ? latest.sessionDurationS - baseline.sessionDurationS
            : null,
      };
      break;
    }
  }

  const hasComparison = Boolean(pain || assessment || cv);
  return {
    hasComparison,
    pain,
    assessment,
    cv,
    disclaimer: LONGITUDINAL_COMPARISON_DISCLAIMER,
  };
}

export function formatComparisonDirection(direction: ComparisonDirection): string {
  if (direction === "improved") return "Lower pain reported";
  if (direction === "worse") return "Higher pain reported";
  if (direction === "stable") return "Similar pain reported";
  return "Insufficient data";
}
