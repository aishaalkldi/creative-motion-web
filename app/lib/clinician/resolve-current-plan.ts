/** Minimal plan shape for current vs previous resolution (newest-first lists). */
export type PlanListItem = {
  id: string;
  created_at: string;
  status: string;
};

export type ResolvedPatientPlans<T extends PlanListItem> = {
  currentPlan: T | null;
  previousPlans: T[];
};

/**
 * Pick the operational current plan from a newest-first plan list.
 * a) newest plan with status === "active"
 * b) otherwise newest plan overall
 * previousPlans = all other plans, preserving newest-first order.
 */
export function resolveCurrentAndPreviousPlans<T extends PlanListItem>(
  plans: readonly T[],
): ResolvedPatientPlans<T> {
  if (plans.length === 0) {
    return { currentPlan: null, previousPlans: [] };
  }

  const currentPlan = plans.find((p) => p.status === "active") ?? plans[0];
  const previousPlans = plans.filter((p) => p.id !== currentPlan.id);
  return { currentPlan, previousPlans };
}
