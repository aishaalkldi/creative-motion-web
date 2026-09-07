import type { AssessmentListRow } from "@/app/api/assessments/route";

export type ObjectiveWorkspaceHint = {
  id: "tug" | "sls" | "sts";
  title: string;
  hasResult: boolean;
  href: string;
};

export type AssessmentSummaryRow = {
  id: string;
  title: string;
  dateLabel: string | null;
  status: string;
  workflow: string[];
  href: string;
  cta: string;
};

export function formatAssessmentStatus(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function latestAssessmentPerType(
  assessments: AssessmentListRow[],
): AssessmentListRow[] {
  const latestByType = new Map<string, AssessmentListRow>();
  for (const row of assessments) {
    const current = latestByType.get(row.type);
    if (!current || new Date(row.created_at).getTime() > new Date(current.created_at).getTime()) {
      latestByType.set(row.type, row);
    }
  }
  return [...latestByType.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
