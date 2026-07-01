"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CvSessionMetricPublic } from "@/app/lib/cv/cv-metrics-display";
import { dedupeCvMetricsByPlanSessionExercise } from "@/app/lib/cv/cv-metrics-dedupe";

export type UseCvSessionMetricsOptions = {
  patientId?: string;
  limit?: number;
  /** Keep only rows matching these exercise ids (after fetch). */
  exerciseIds?: readonly string[];
  /** Custom filter when exerciseIds is not enough (e.g. gait family). */
  exerciseFilter?: (exerciseId: string) => boolean;
  /** Collapse duplicate patient portal captures per plan session (default: true when patientId set). */
  dedupePatientSessions?: boolean;
  /** Re-fetch on window focus / tab visibility (default: true). */
  refreshOnFocus?: boolean;
};

export type UseCvSessionMetricsResult = {
  metrics: CvSessionMetricPublic[];
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
};

function buildMetricsUrl(patientId: string | undefined, limit: number): string {
  const params = new URLSearchParams({ limit: String(limit) });
  const trimmed = patientId?.trim();
  if (trimmed) params.set("patientId", trimmed);
  return `/api/cv/session-metrics?${params.toString()}`;
}

function applyExerciseFilter(
  rows: CvSessionMetricPublic[],
  exerciseIds?: readonly string[],
  exerciseFilter?: (exerciseId: string) => boolean,
): CvSessionMetricPublic[] {
  if (exerciseIds && exerciseIds.length > 0) {
    const allowed = new Set(exerciseIds);
    return rows.filter((row) => allowed.has(row.exerciseId));
  }
  if (exerciseFilter) {
    return rows.filter((row) => exerciseFilter(row.exerciseId));
  }
  return rows;
}

export function useCvSessionMetrics(
  options: UseCvSessionMetricsOptions = {},
): UseCvSessionMetricsResult {
  const {
    patientId,
    limit = 50,
    exerciseIds,
    exerciseFilter,
    dedupePatientSessions = Boolean(patientId?.trim()),
    refreshOnFocus = true,
  } = options;

  const [rawMetrics, setRawMetrics] = useState<CvSessionMetricPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(buildMetricsUrl(patientId, limit));
      if (!res.ok) {
        setError(true);
        setRawMetrics([]);
        return;
      }
      const data = (await res.json()) as { metrics?: CvSessionMetricPublic[] };
      setRawMetrics(data.metrics ?? []);
    } catch {
      setError(true);
      setRawMetrics([]);
    } finally {
      setLoading(false);
    }
  }, [patientId, limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!refreshOnFocus) return;
    const onRefresh = () => void refresh();
    window.addEventListener("focus", onRefresh);
    document.addEventListener("visibilitychange", onRefresh);
    return () => {
      window.removeEventListener("focus", onRefresh);
      document.removeEventListener("visibilitychange", onRefresh);
    };
  }, [refresh, refreshOnFocus]);

  const metrics = useMemo(() => {
    let rows = rawMetrics;
    if (dedupePatientSessions) {
      rows = dedupeCvMetricsByPlanSessionExercise(rows);
    }
    return applyExerciseFilter(rows, exerciseIds, exerciseFilter);
  }, [rawMetrics, dedupePatientSessions, exerciseIds, exerciseFilter]);

  return { metrics, loading, error, refresh };
}
