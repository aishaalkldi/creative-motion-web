/**
 * Run: npx tsx --test app/lib/patient-portal/resolve-patient-home-display.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PatientPlanData, PatientSession } from "@/app/api/patient/plan/route";
import { STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1 } from "@/app/lib/rehab-programs/stroke-upper-limb-recovery-foundation";
import {
  resolvePatientHomeProgramTitle,
  resolvePatientHomeSessionDisplay,
} from "./resolve-patient-home-display";

function basePlan(overrides: Partial<PatientPlanData> = {}): PatientPlanData {
  return {
    patientName: "Test Patient",
    patientLanguage: "en",
    diagnosis: null,
    planId: "plan-1",
    planTitle: "Upper Limb Recovery Foundation",
    programName: "Upper Limb Recovery Foundation",
    phaseName: "Phase 1",
    phaseGoal: "",
    patientRehabFocus: "Build shoulder confidence for daily reaching.",
    patientFriendlyGoal: null,
    programTemplateId: null,
    sessionsPerWeek: 3,
    totalWeeks: 4,
    clinicianNotes: "",
    assignedBy: "Dr. Smith",
    assignedAt: "2026-08-01T00:00:00.000Z",
    sessions: [],
    lifetimeSummary: {
      completedSessions: 0,
      programsAssigned: 1,
      movementCaptures: 0,
      lastActivityAt: null,
    },
    ...overrides,
  };
}

function baseSession(overrides: Partial<PatientSession> = {}): PatientSession {
  return {
    id: "session-1",
    sessionNumber: 1,
    title: "Session 1 — Activation and Functional Reaching",
    exercises: [],
    status: "today",
    prescribedSide: null,
    catalogSession: STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1,
    ...overrides,
  };
}

describe("resolvePatientHomeProgramTitle", () => {
  it("returns English plan title unchanged", () => {
    const title = resolvePatientHomeProgramTitle(basePlan(), "en");
    assert.equal(title, "Upper Limb Recovery Foundation");
  });

  it("returns Arabic program title for catalog-backed plans", () => {
    const title = resolvePatientHomeProgramTitle(
      basePlan({
        sessions: [baseSession()],
      }),
      "ar",
    );
    assert.equal(title, "أساسيات تعافي الطرف العلوي");
    assert.ok(!title.includes("Upper Limb"));
  });
});

describe("resolvePatientHomeSessionDisplay", () => {
  it("localizes catalog session title and goal for Arabic", () => {
    const display = resolvePatientHomeSessionDisplay(
      baseSession(),
      basePlan({ sessions: [baseSession()] }),
      "ar",
    );
    assert.ok(display.title.includes("الجلسة 1"));
    assert.ok(display.context?.includes("التنشيط"));
    assert.equal(display.durationLabel, "10–15 دقيقة");
    assert.ok(!display.title.includes("Activation"));
  });

  it("formats generic session titles with localized session number", () => {
    const display = resolvePatientHomeSessionDisplay(
      baseSession({
        catalogSession: null,
        title: "Strength and balance",
      }),
      basePlan(),
      "ar",
    );
    assert.match(display.title, /^الجلسة 1 —/);
  });
});
