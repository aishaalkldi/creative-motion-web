/**
 * RASQ — Shared mock clinical data
 * Used by dashboard, patient list, assessment, plans, and progress pages.
 * Replace individual service calls with real API endpoints when backend is ready.
 */

/* ─── Patient ─────────────────────────────────────────────────────────────── */

export type PatientPhase = "Phase 1" | "Phase 2" | "Phase 3";
export type PatientStatus = "Active" | "Review" | "Discharged";

export interface MockPatient {
  id: number;
  name: string;
  diagnosis: string;
  phase: PatientPhase;
  phaseNum: number;
  lastSessionDays: number;
  adherence: number;
  status: PatientStatus;
  age: number;
  sex: "M" | "F";
  startDate: string;
  pendingAssessment: boolean;
}

export const MOCK_PATIENTS: MockPatient[] = [
  {
    id: 1, name: "Sarah Al-Ahmad", diagnosis: "ACL Reconstruction – R",
    phase: "Phase 2", phaseNum: 2, lastSessionDays: 2, adherence: 94,
    status: "Active", age: 28, sex: "F", startDate: "2026-03-15", pendingAssessment: false,
  },
  {
    id: 2, name: "Omar Khalid", diagnosis: "Rotator Cuff Repair – L",
    phase: "Phase 1", phaseNum: 1, lastSessionDays: 4, adherence: 78,
    status: "Active", age: 42, sex: "M", startDate: "2026-04-02", pendingAssessment: true,
  },
  {
    id: 3, name: "Fatima Al-Rashid", diagnosis: "Lumbar Disc Herniation",
    phase: "Phase 3", phaseNum: 3, lastSessionDays: 1, adherence: 88,
    status: "Active", age: 35, sex: "F", startDate: "2026-02-20", pendingAssessment: false,
  },
  {
    id: 4, name: "Khaled Hassan", diagnosis: "Patellofemoral Syndrome",
    phase: "Phase 1", phaseNum: 1, lastSessionDays: 6, adherence: 45,
    status: "Review", age: 19, sex: "M", startDate: "2026-04-28", pendingAssessment: true,
  },
  {
    id: 5, name: "Noura Al-Shammari", diagnosis: "Shoulder Impingement – R",
    phase: "Phase 2", phaseNum: 2, lastSessionDays: 3, adherence: 82,
    status: "Active", age: 31, sex: "F", startDate: "2026-03-28", pendingAssessment: false,
  },
];

/** Returns mock clinical context for a patient ID, if available. */
export function getMockPatient(id: number): MockPatient | undefined {
  return MOCK_PATIENTS.find((p) => p.id === id);
}

/* ─── Activity feed ───────────────────────────────────────────────────────── */

export interface ActivityItem {
  id: string;
  type: "assessment" | "alert" | "session" | "plan";
  text: string;
  time: string;
}

export const MOCK_ACTIVITY: ActivityItem[] = [
  { id: "1", type: "session",    text: "Fatima Al-Rashid completed Phase 3 session",             time: "1 day ago"  },
  { id: "2", type: "alert",      text: "Khaled Hassan — adherence dropped below 50%",            time: "2 days ago" },
  { id: "3", type: "assessment", text: "Sarah Al-Ahmad — Phase 2 clearance criteria met",        time: "2 days ago" },
  { id: "4", type: "session",    text: "Sarah Al-Ahmad completed strength & balance session",    time: "2 days ago" },
  { id: "5", type: "plan",       text: "Omar Khalid assigned to Phase 1 — Rotator Cuff protocol","time": "4 days ago" },
];

/* ─── Progress data ───────────────────────────────────────────────────────── */

export interface ProgressWeek {
  label: string;
  rom: number;
  adherence: number;
  pain: number;
}

export interface PatientProgress {
  baseline: { rom: number; pain: number; strength: string };
  target: { rom: number };
  weeks: ProgressWeek[];
  movementQuality: number;
  aiFlags: { type: "positive" | "warning" | "neutral"; text: string }[];
  phaseCompletions: { phase: string; completed: boolean; week?: string }[];
}

export const MOCK_PROGRESS: Record<number, PatientProgress> = {
  1: {
    baseline: { rom: 72, pain: 7, strength: "3/5" },
    target: { rom: 130 },
    weeks: [
      { label: "Wk 1",  rom: 72,  adherence: 100, pain: 7 },
      { label: "Wk 2",  rom: 80,  adherence: 90,  pain: 6 },
      { label: "Wk 3",  rom: 88,  adherence: 95,  pain: 5 },
      { label: "Wk 4",  rom: 94,  adherence: 90,  pain: 4 },
      { label: "Wk 5",  rom: 100, adherence: 96,  pain: 3 },
      { label: "Wk 6",  rom: 108, adherence: 94,  pain: 2 },
    ],
    movementQuality: 87,
    aiFlags: [
      { type: "positive", text: "ROM improved 50% since baseline — Phase 2 clearance criteria met." },
      { type: "positive", text: "Load symmetry improved 11% over last 3 sessions." },
      { type: "neutral",  text: "Consider progression review — target ROM is 130°, current 108°." },
    ],
    phaseCompletions: [
      { phase: "Phase 1 — Movement Control", completed: true,  week: "Week 4" },
      { phase: "Phase 2 — Strength & Balance", completed: false },
      { phase: "Phase 3 — Dynamic Control",   completed: false },
    ],
  },
  2: {
    baseline: { rom: 110, pain: 6, strength: "2/5" },
    target: { rom: 170 },
    weeks: [
      { label: "Wk 1", rom: 110, adherence: 85,  pain: 6 },
      { label: "Wk 2", rom: 118, adherence: 80,  pain: 5 },
      { label: "Wk 3", rom: 124, adherence: 78,  pain: 5 },
      { label: "Wk 4", rom: 130, adherence: 75,  pain: 4 },
    ],
    movementQuality: 71,
    aiFlags: [
      { type: "neutral",  text: "ROM improving steadily — 20° gain over 4 weeks." },
      { type: "warning",  text: "Adherence trending down — review patient barriers to engagement." },
      { type: "neutral",  text: "Pain score stable at 4-5/10 — monitor for inflammatory episodes." },
    ],
    phaseCompletions: [
      { phase: "Phase 1 — Mobility & Protection", completed: false },
      { phase: "Phase 2 — Strengthening",         completed: false },
      { phase: "Phase 3 — Functional Return",     completed: false },
    ],
  },
  3: {
    baseline: { rom: 45, pain: 8, strength: "4/5" },
    target: { rom: 90 },
    weeks: [
      { label: "Wk 1",  rom: 45,  adherence: 95,  pain: 8 },
      { label: "Wk 2",  rom: 55,  adherence: 90,  pain: 7 },
      { label: "Wk 4",  rom: 60,  adherence: 88,  pain: 5 },
      { label: "Wk 6",  rom: 68,  adherence: 92,  pain: 4 },
      { label: "Wk 8",  rom: 74,  adherence: 88,  pain: 3 },
      { label: "Wk 10", rom: 82,  adherence: 88,  pain: 2 },
    ],
    movementQuality: 91,
    aiFlags: [
      { type: "positive", text: "Excellent adherence — 88% over 10 weeks." },
      { type: "positive", text: "Pain reduced from 8 to 2/10 — strong functional recovery." },
      { type: "neutral",  text: "ROM at 91% of target. Phase 3 completion on track." },
    ],
    phaseCompletions: [
      { phase: "Phase 1 — Pain Control & Mobility", completed: true,  week: "Week 3" },
      { phase: "Phase 2 — Core Stabilisation",      completed: true,  week: "Week 7" },
      { phase: "Phase 3 — Return to Activity",      completed: false },
    ],
  },
  4: {
    baseline: { rom: 130, pain: 5, strength: "4/5" },
    target: { rom: 140 },
    weeks: [
      { label: "Wk 1", rom: 130, adherence: 80,  pain: 5 },
      { label: "Wk 2", rom: 132, adherence: 55,  pain: 5 },
      { label: "Wk 3", rom: 133, adherence: 40,  pain: 4 },
      { label: "Wk 4", rom: 134, adherence: 45,  pain: 4 },
    ],
    movementQuality: 62,
    aiFlags: [
      { type: "warning",  text: "Adherence dropped to 45% — clinical review recommended." },
      { type: "warning",  text: "Session frequency below protocol target over last 2 weeks." },
      { type: "neutral",  text: "ROM plateau noted — re-assess treatment goals." },
    ],
    phaseCompletions: [
      { phase: "Phase 1 — Load Management",        completed: false },
      { phase: "Phase 2 — Strength & Conditioning", completed: false },
      { phase: "Phase 3 — Sport Return Prep",       completed: false },
    ],
  },
  5: {
    baseline: { rom: 140, pain: 5, strength: "3/5" },
    target: { rom: 170 },
    weeks: [
      { label: "Wk 1", rom: 140, adherence: 90,  pain: 5 },
      { label: "Wk 2", rom: 148, adherence: 88,  pain: 4 },
      { label: "Wk 3", rom: 153, adherence: 82,  pain: 4 },
      { label: "Wk 4", rom: 158, adherence: 80,  pain: 3 },
    ],
    movementQuality: 78,
    aiFlags: [
      { type: "positive", text: "Consistent ROM improvement — 18° gain over 4 weeks." },
      { type: "neutral",  text: "Strength progressing — target 5/5 by Phase 3." },
      { type: "neutral",  text: "Adherence holding at 80%+ — reinforce home exercise compliance." },
    ],
    phaseCompletions: [
      { phase: "Phase 1 — Pain Reduction",    completed: true,  week: "Week 2" },
      { phase: "Phase 2 — Strengthening",     completed: false },
      { phase: "Phase 3 — Overhead Return",   completed: false },
    ],
  },
};

/* ─── Assessment types ────────────────────────────────────────────────────── */

export const ASSESSMENT_TYPES = [
  {
    id: "msk",
    label: "Musculoskeletal (MSK)",
    desc: "Joints, muscles, tendons, ligaments. Includes ROM, strength, and special tests.",
  },
  {
    id: "gait",
    label: "Gait Assessment",
    desc: "Walking pattern, symmetry, cadence, and functional mobility analysis.",
  },
  {
    id: "functional",
    label: "Functional Assessment",
    desc: "Task-based performance: sit-to-stand, balance, step tests, and return-to-sport criteria.",
  },
] as const;

/* ─── localStorage helpers ────────────────────────────────────────────────── */

export const ASSESSMENTS_KEY = "rasq_assessments";

export interface SavedAssessment {
  id: string;
  patientId: number;
  patientName: string;
  type: string;
  typeLabel: string;
  date: string;
  pain: number;
  rom: number;
  strength: string;
  mobilityNotes: string;
  savedAt: string;
  // Phase 1A additions — optional for backward compat with pre-existing assessments
  bodyRegion?: string;
  rehabilitationPhase?: string;
  assessmentData?: import("./assessment-types").AssessmentData;
}

export function loadSavedAssessments(): SavedAssessment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ASSESSMENTS_KEY);
    return raw ? (JSON.parse(raw) as SavedAssessment[]) : [];
  } catch {
    return [];
  }
}

export function saveAssessment(a: SavedAssessment): void {
  if (typeof window === "undefined") return;
  const list = loadSavedAssessments();
  list.unshift(a);
  localStorage.setItem(ASSESSMENTS_KEY, JSON.stringify(list.slice(0, 50)));
}

export function loadAssessmentsForPatient(patientId: number): SavedAssessment[] {
  return loadSavedAssessments().filter((a) => a.patientId === patientId);
}
