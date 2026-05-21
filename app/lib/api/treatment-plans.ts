/**
 * Treatment Plan Service
 *
 * Public contract matches the intended real API:
 *   GET    /api/v1/patients/:id/treatment-plan
 *   POST   /api/v1/patients/:id/treatment-plan
 *   PATCH  /api/v1/patients/:id/treatment-plan
 *   GET    /api/v1/patients/:id/adherence
 *
 * Current implementation: in-memory mock store.
 * To connect the real backend, replace only the four service functions below.
 * No UI code needs to change.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type SessionStatus = "ready" | "in-progress" | "completed";
export type PlanStatus = "active" | "completed" | "on-hold";

export interface PlanSession {
  id: string;
  sessionNumber: number;
  title: string;
  exercises: string[];
  estimatedMinutes: number;
  status: SessionStatus;
  completedAt?: string;
}

export interface TreatmentPlan {
  id: string;
  patientId: number;
  patientName?: string;
  patientToken?: string;
  programId: string;
  programName: string;
  phase: string;               // e.g. "phase-2"
  phaseName: string;           // e.g. "Phase 2 — Strength & Balance"
  phaseGoal: string;
  sessionsPerWeek: number;
  totalSessions: number;
  clinicianNotes: string;
  assignedAt: string;          // ISO
  assignedBy: string;
  status: PlanStatus;
  sessions: PlanSession[];
}

export interface AssignPlanInput {
  programId: string;
  phase: string;
  sessionsPerWeek: number;
  clinicianNotes: string;
  assignedBy: string;
  patientName?: string;
}

export interface Adherence {
  patientId: number;
  sessionsCompleted: number;
  totalSessions: number;
  adherenceRatePct: number;
  lastActiveAt: string | null;
  weeklyCompletions: { week: string; completed: number; target: number }[];
}

// ── Program catalog ────────────────────────────────────────────────────────────
// Used by the assignment UI to populate program/phase dropdowns.

export interface RehabPhase {
  id: string;
  name: string;
  goal: string;
  durationHint: string;
  defaultSessions: number;
  exercises: string[];
}

export interface RehabProgram {
  id: string;
  name: string;
  category: string;
  phases: RehabPhase[];
}

export const REHAB_PROGRAMS: RehabProgram[] = [
  {
    id: "acl-rehab",
    name: "ACL Rehabilitation",
    category: "Sports",
    phases: [
      {
        id: "phase-1",
        name: "Phase 1 — Movement Control",
        goal: "Restore full ROM, establish baseline movement patterns, and reduce pain to ≤2/10.",
        durationHint: "2–3 weeks",
        defaultSessions: 6,
        exercises: ["Sit-to-Stand", "Mini Squat (0–45°)", "Single Leg Stance", "Low Step-Up", "Heel Raises"],
      },
      {
        id: "phase-2",
        name: "Phase 2 — Strength & Balance",
        goal: "Build bilateral strength, improve single-leg stability, achieve symmetry index ≥80%.",
        durationHint: "3–4 weeks",
        defaultSessions: 8,
        exercises: ["Mini Squat", "Single Leg Stance", "Heel Raises", "Low Step-Up", "Sit-to-Stand"],
      },
      {
        id: "phase-3",
        name: "Phase 3 — Dynamic Control",
        goal: "Add explosive movements, master landing mechanics, build multi-directional confidence.",
        durationHint: "4–5 weeks",
        defaultSessions: 10,
        exercises: ["Countermovement Jump", "Forward Hops", "Lateral Bounds", "Deceleration Drill", "Single-Leg Squat"],
      },
      {
        id: "phase-4",
        name: "Phase 4 — Return to Sport",
        goal: "Achieve sport-specific movement quality, clear functional tests, confirm safe return.",
        durationHint: "2–3 weeks",
        defaultSessions: 6,
        exercises: ["Agility Ladder", "Change of Direction", "Sport-Specific Drill", "Reactive Cutting"],
      },
    ],
  },
  {
    id: "gait-training",
    name: "Gait Training",
    category: "Neurological / Orthopaedic",
    phases: [
      {
        id: "phase-1",
        name: "Phase 1 — Gait Re-education",
        goal: "Improve step symmetry, cadence, and heel-strike pattern.",
        durationHint: "3–4 weeks",
        defaultSessions: 8,
        exercises: ["Treadmill Walk (10MWT)", "Step Training", "Tandem Walk", "Heel-to-Toe"],
      },
      {
        id: "phase-2",
        name: "Phase 2 — Endurance & Speed",
        goal: "Increase walking speed and distance. Reduce assistive device dependence.",
        durationHint: "4–6 weeks",
        defaultSessions: 10,
        exercises: ["6-Minute Walk", "Incline Walk", "Dual-Task Walk", "Community Walk Simulation"],
      },
    ],
  },
];

// ── Mock store with localStorage persistence ──────────────────────────────────
// Survives page refresh. Clinician writes, patient reads — same browser.
// Replace with real API fetch() calls when the backend is ready.

const STORAGE_KEY = "rasq_plans";
const DEMO_PID_KEY = "rasq_demo_patient_id";

function _persist(plans: Map<number, TreatmentPlan>): void {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, TreatmentPlan> = {};
    plans.forEach((v, k) => { obj[String(k)] = v; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch { /* storage full or unavailable */ }
}

function _hydrate(): Map<number, TreatmentPlan> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, TreatmentPlan>;
    return new Map(Object.entries(obj).map(([k, v]) => [parseInt(k, 10), v]));
  } catch { return new Map(); }
}

// Lazily hydrated — first access triggers localStorage read.
let _hydrated = false;
const _plans = new Map<number, TreatmentPlan>();

function _getPlans(): Map<number, TreatmentPlan> {
  if (!_hydrated) {
    const stored = _hydrate();
    stored.forEach((v, k) => _plans.set(k, v));
    _hydrated = true;
  }
  return _plans;
}

/**
 * Returns the patient ID last used in an assignment.
 * Used by the patient portal to match the clinician's demo patient.
 */
export function getDemoPatientId(): number {
  if (typeof window === "undefined") return 1;
  const v = localStorage.getItem(DEMO_PID_KEY);
  return v ? parseInt(v, 10) || 1 : 1;
}

function _buildSessions(phase: RehabPhase, total: number): PlanSession[] {
  return Array.from({ length: total }, (_, i) => ({
    id: `session-${i + 1}`,
    sessionNumber: i + 1,
    title: i % 2 === 0
      ? `${phase.name.split("—")[1]?.trim() ?? "Rehab"} Session A`
      : `${phase.name.split("—")[1]?.trim() ?? "Rehab"} Session B`,
    exercises: phase.exercises,
    estimatedMinutes: 20 + (i % 3) * 5,
    status: "ready" as SessionStatus,
  }));
}

function _computeAdherence(plan: TreatmentPlan): Adherence {
  const completed = plan.sessions.filter((s) => s.status === "completed").length;
  const total = plan.sessions.length;
  const lastActive = plan.sessions
    .filter((s) => s.completedAt)
    .map((s) => s.completedAt!)
    .sort()
    .at(-1) ?? null;

  return {
    patientId: plan.patientId,
    sessionsCompleted: completed,
    totalSessions: total,
    adherenceRatePct: total > 0 ? Math.round((completed / total) * 100) : 0,
    lastActiveAt: lastActive,
    weeklyCompletions: [
      { week: "W1", completed: Math.min(completed, 3), target: plan.sessionsPerWeek },
      { week: "W2", completed: Math.min(Math.max(completed - 3, 0), 3), target: plan.sessionsPerWeek },
      { week: "W3", completed: Math.min(Math.max(completed - 6, 0), 3), target: plan.sessionsPerWeek },
      { week: "W4", completed: Math.min(Math.max(completed - 9, 0), 3), target: plan.sessionsPerWeek },
    ],
  };
}

// ── Service functions ──────────────────────────────────────────────────────────
// These are the only functions UI code should call.
// The mock implementation is an internal detail — swap it for fetch() calls below.

/**
 * Retrieve the active treatment plan for a patient.
 * Returns null if no plan has been assigned.
 *
 * Real API: GET /api/v1/patients/:id/treatment-plan
 */
export async function getTreatmentPlan(
  patientId: number,
): Promise<TreatmentPlan | null> {
  // TODO: replace with:
  // const res = await fetch(`/api/v1/patients/${patientId}/treatment-plan`, { headers: getAuthHeaders() });
  // if (res.status === 404) return null;
  // return res.json();
  await _delay(80);
  return _getPlans().get(patientId) ?? null;
}

/**
 * Assign a new treatment plan to a patient (clinician action).
 *
 * Real API: POST /api/v1/patients/:id/treatment-plan
 */
export async function assignTreatmentPlan(
  patientId: number,
  input: AssignPlanInput,
): Promise<TreatmentPlan> {
  // TODO: replace with:
  // const res = await fetch(`/api/v1/patients/${patientId}/treatment-plan`, {
  //   method: "POST", headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
  //   body: JSON.stringify(input),
  // });
  // return res.json();
  await _delay(120);

  const program = REHAB_PROGRAMS.find((p) => p.id === input.programId);
  if (!program) throw new Error(`Unknown program: ${input.programId}`);

  const phase = program.phases.find((ph) => ph.id === input.phase);
  if (!phase) throw new Error(`Unknown phase: ${input.phase}`);

  const total = phase.defaultSessions;
  const plan: TreatmentPlan = {
    id: `plan-${patientId}-${Date.now()}`,
    patientId,
    patientName: input.patientName,
    patientToken: `rasq_${patientId}_${Date.now()}`,
    programId: input.programId,
    programName: program.name,
    phase: input.phase,
    phaseName: phase.name,
    phaseGoal: phase.goal,
    sessionsPerWeek: input.sessionsPerWeek,
    totalSessions: total,
    clinicianNotes: input.clinicianNotes,
    assignedAt: new Date().toISOString(),
    assignedBy: input.assignedBy,
    status: "active",
    sessions: _buildSessions(phase, total),
  };

  _getPlans().set(patientId, plan);
  _persist(_getPlans());
  // Bridge: store this patient's ID so the patient portal finds the right plan.
  if (typeof window !== "undefined") {
    localStorage.setItem(DEMO_PID_KEY, String(patientId));
  }
  return plan;
}

/**
 * Update an existing treatment plan (e.g. change phase, update notes).
 *
 * Real API: PATCH /api/v1/patients/:id/treatment-plan
 */
export async function updateTreatmentPlan(
  patientId: number,
  patch: Partial<Pick<TreatmentPlan, "clinicianNotes" | "sessionsPerWeek" | "status">>,
): Promise<TreatmentPlan> {
  // TODO: replace with fetch PATCH
  await _delay(100);
  const existing = _getPlans().get(patientId);
  if (!existing) throw new Error("No treatment plan found for this patient.");
  const updated = { ...existing, ...patch };
  _getPlans().set(patientId, updated);
  _persist(_getPlans());
  return updated;
}

/**
 * Mark a patient session as in-progress or completed.
 * Called by the patient when they start or finish a session.
 *
 * Real API: PATCH /api/v1/patients/:id/treatment-plan/sessions/:sessionId
 */
export async function updateSessionStatus(
  patientId: number,
  sessionId: string,
  status: SessionStatus,
): Promise<void> {
  // TODO: replace with fetch PATCH
  await _delay(60);
  const plan = _getPlans().get(patientId);
  if (!plan) return;
  const session = plan.sessions.find((s) => s.id === sessionId);
  if (!session) return;
  session.status = status;
  if (status === "completed") session.completedAt = new Date().toISOString();
  _getPlans().set(patientId, { ...plan });
  _persist(_getPlans());
}

/**
 * Get adherence metrics for a patient.
 *
 * Real API: GET /api/v1/patients/:id/adherence
 */
export async function getAdherence(patientId: number): Promise<Adherence | null> {
  // TODO: replace with fetch GET
  await _delay(80);
  const plan = _getPlans().get(patientId);
  if (!plan) return null;
  return _computeAdherence(plan);
}

// ── Patient portal token loading removed ───────────────────────────────────────
// loadPlanByToken and SEED_PLAN_SARAH were removed in Phase 2 Step 5.
// Patient portal now uses GET /api/patient/plan?token=... (service-role, Supabase-backed).

// ── Utility ───────────────────────────────────────────────────────────────────

function _delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
