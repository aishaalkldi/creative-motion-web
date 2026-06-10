/**
 * Patient Workspace App Shell — shared view helpers (plan + logs only).
 */

import type { SessionLogEntry } from "@/app/api/patient/logs/route";
import type { PatientPlanData, PatientSession } from "@/app/api/patient/plan/route";
import {
  buildPatientProgressPortalView,
  resolveProgressProgramKind,
  type ProgressProgramKind,
} from "@/app/lib/patient-progress-portal";
import { computeMotivationStats } from "@/app/lib/patient-motivation";

export type WorkspaceSessionStatus = "completed" | "next" | "locked";

export type WorkspacePlanStatus = "preparing" | "active" | "complete";

export function resolveWorkspaceSessionStatus(
  sessions: Pick<PatientSession, "id" | "status">[],
  session: Pick<PatientSession, "id" | "status">,
): WorkspaceSessionStatus {
  if (session.status === "completed") return "completed";
  const firstPending = sessions.find((s) => s.status !== "completed");
  if (firstPending?.id === session.id) return "next";
  return "locked";
}

export function resolveWorkspacePlanStatus(plan: PatientPlanData): WorkspacePlanStatus {
  const total = plan.sessions.length;
  if (total === 0) return "preparing";
  const completed = plan.sessions.filter((s) => s.status === "completed").length;
  if (completed === total) return "complete";
  return "active";
}

export function resolveWorkspaceProgramKind(plan: PatientPlanData): ProgressProgramKind {
  return resolveProgressProgramKind({
    programTemplateId: plan.programTemplateId,
    programName: plan.programName,
    planTitle: plan.planTitle,
  });
}

export function buildWorkspaceHomePreview(
  plan: PatientPlanData,
  logs: SessionLogEntry[],
  lang: "en" | "ar",
) {
  const stats = computeMotivationStats(plan.sessions, logs);
  const view = buildPatientProgressPortalView(plan, logs, stats, lang);
  const programKind = resolveWorkspaceProgramKind(plan);
  const planStatus = resolveWorkspacePlanStatus(plan);
  const nextSession =
    plan.sessions.find((s) => resolveWorkspaceSessionStatus(plan.sessions, s) === "next") ?? null;

  return {
    programKind,
    planStatus,
    stats,
    view,
    nextSession,
    completedCount: view.completedSessions,
    totalCount: view.totalSessions,
    progressPercent: view.progressPercent,
  };
}
