"use client";

import type { PlanRow } from "@/app/api/plans/route";
import { formatPortalDate } from "@/app/lib/patient-portal-ui";

type PreviousPlansSummaryProps = {
  plans: PlanRow[];
};

function countSessions(plan: PlanRow): { completed: number; total: number } {
  const sessions = plan.sessions ?? [];
  return {
    completed: sessions.filter((s) => s.status === "completed").length,
    total: sessions.length,
  };
}

export function PreviousPlansSummary({ plans }: PreviousPlansSummaryProps) {
  if (plans.length === 0) return null;

  return (
    <section className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
        Previous plans
      </p>
      <p className="mt-1 text-[11px] text-[var(--muted-soft)]">
        Read-only summary. Current plan and portal link are shown above.
      </p>
      <ul className="mt-4 space-y-3">
        {plans.map((plan) => {
          const sd = plan.structured_data;
          const title = sd?.programName ?? plan.title ?? "Treatment plan";
          const phase = sd?.phaseName?.trim();
          const { completed, total } = countSessions(plan);
          const assignedLabel = formatPortalDate(plan.created_at, "en");

          return (
            <li
              key={plan.id}
              className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[var(--foreground)]">{title}</p>
                  {phase ? (
                    <p className="mt-0.5 text-[11px] text-[var(--muted)]">{phase}</p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-[5px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {plan.status}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--muted-soft)]">
                <span>Assigned {assignedLabel}</span>
                {total > 0 ? (
                  <span>
                    Sessions {completed}/{total}
                  </span>
                ) : (
                  <span>No sessions</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
