/** Shared dashboard metric formatting — display only, no business rules. */

export function formatDashboardMetric(
  value: number | null | undefined,
  loading: boolean,
): string {
  if (loading) return "…";
  if (value === null || value === undefined) return "–";
  return String(value);
}

export function formatDashboardAdherencePct(
  value: number | null | undefined,
  loading: boolean,
): string {
  if (loading) return "…";
  if (value === null || value === undefined) return "–";
  return `${value}%`;
}

export function formatDashboardSnapshotMetric(
  value: number | null | undefined,
  loading: boolean,
): string {
  if (loading) return "…";
  if (value === null || value === undefined) return "Not available";
  return String(value);
}

export function formatDashboardGeneratedAt(
  iso: string | undefined,
  loading: boolean,
): string {
  if (loading) return "…";
  if (!iso) return "Not available";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "Not available";
  }
}

export function formatDashboardStatsTime(iso: string | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return null;
  }
}
