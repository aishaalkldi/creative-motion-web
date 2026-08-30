/**
 * Run: npx tsx --test app/lib/progress/interactive-shoulder-progress-charts.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import type { InteractiveShoulderOutcomeBlockReport } from "@/app/lib/interactive-shoulder/movement-outcome-report";
import type { InteractiveShoulderOutcomeReportEntry } from "@/app/lib/progress/progress-outcomes-bundle";
import type { PatientPlanData } from "@/app/api/patient/plan/route";
import type { SessionLogEntry } from "@/app/api/patient/logs/route";
import {
  buildClinicianProgressChartSeries,
  buildInteractiveShoulderSessionChartPoints,
  buildPatientShoulderProgressPoints,
  MIN_SESSIONS_FOR_PROGRESS_CHARTS,
  shouldShowInteractiveShoulderProgressCharts,
  SINGLE_SESSION_CHART_EMPTY_STATE,
} from "./interactive-shoulder-progress-charts";
import { hasTechnicalObservationsForBlock } from "./interactive-shoulder-block-details-display";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PANEL_SOURCE = readFileSync(
  join(__dirname, "../../components/clinician/progress/InteractiveShoulderOutcomesPanel.tsx"),
  "utf8",
);
const PATIENT_SOURCE = readFileSync(
  join(__dirname, "../../components/patient/progress/PatientProgressPortal.tsx"),
  "utf8",
);

function block(
  overrides: Partial<InteractiveShoulderOutcomeBlockReport> = {},
): InteractiveShoulderOutcomeBlockReport {
  return {
    blockId: "reach-the-light",
    movementId: "shoulder-abduction-reach",
    title: "Reach the Light",
    blockType: "movement-target",
    displayCategory: "target",
    completionReason: "duration",
    durationSeconds: 90,
    interaction: {
      targetsContacted: 4,
      patternsCompleted: 0,
      timingSamplesMs: [1200],
      responseConsistency: null,
      participationDurationSeconds: 90,
    },
    measured: {
      validRepetitions: 0,
      invalidRepetitions: 0,
      rangeValuesDegrees: [80],
      holdDurationSeconds: null,
      movementSpeed: null,
      returnControl: null,
      trackingConfidence: null,
    },
    interpreted: {
      compensationEvents: 0,
      asymmetryObservations: [],
      fatigueTrend: "unknown",
      reducedControl: false,
      trackingLimitations: [],
    },
    ...overrides,
  };
}

function sessionEntry(
  id: string,
  createdAt: string,
  blocks: InteractiveShoulderOutcomeBlockReport[] = [block()],
  planSessionId: string | null = null,
): InteractiveShoulderOutcomeReportEntry {
  return {
    id,
    planSessionId,
    planId: "plan-1",
    prescribedSide: "LEFT",
    totalElapsedSeconds: 300,
    blocksCompleted: blocks.length,
    blocksTotal: blocks.length,
    schemaVersion: "v1",
    recognizedSchemaVersion: true,
    createdAt,
    blocks,
  };
}

describe("interactive-shoulder-progress-charts", () => {
  it("requires at least two sessions before showing charts", () => {
    assert.equal(shouldShowInteractiveShoulderProgressCharts(1), false);
    assert.equal(shouldShowInteractiveShoulderProgressCharts(MIN_SESSIONS_FOR_PROGRESS_CHARTS), true);
  });

  it("builds clinician chart points from persisted session aggregates only", () => {
    const points = buildInteractiveShoulderSessionChartPoints(
      [
        sessionEntry("s1", "2026-08-28T10:00:00.000Z", [block()], "ps-1"),
        sessionEntry(
          "s2",
          "2026-08-29T10:00:00.000Z",
          [
            block({
              interaction: {
                ...block().interaction,
                targetsContacted: 6,
                timingSamplesMs: [2000],
              },
              interpreted: { ...block().interpreted, compensationEvents: 2 },
            }),
          ],
          "ps-2",
        ),
      ],
      [
        {
          sessionLogId: "log-1",
          sessionNumber: 1,
          planSessionId: "ps-1",
          completedAt: "2026-08-28T10:05:00.000Z",
          painBefore: 6,
          painAfter: 4,
          effortScore: 5,
        },
        {
          sessionLogId: "log-2",
          sessionNumber: 2,
          planSessionId: "ps-2",
          completedAt: "2026-08-29T10:05:00.000Z",
          painBefore: 5,
          painAfter: 3,
          effortScore: 6,
        },
      ],
    );

    assert.equal(points.length, 2);
    assert.equal(points[0]?.targetsContacted, 4);
    assert.equal(points[1]?.targetsContacted, 6);
    assert.equal(points[1]?.painAfter, 3);
    assert.equal(points[1]?.compensationEvents, 2);

    const series = buildClinicianProgressChartSeries(points);
    assert.ok(series.some((item) => item.id === "targets"));
    assert.ok(series.some((item) => item.id === "pain-after"));
    assert.ok(series.some((item) => item.id === "compensation" && item.secondary));
    assert.equal(series.some((item) => item.label.toLowerCase().includes("rom")), false);
  });

  it("builds patient progress points from interactive shoulder session logs only", () => {
    const plan = {
      planId: "plan-1",
      sessions: [
        {
          id: "ps-1",
          sessionNumber: 1,
          title: "Session 1",
          exercises: [{ exerciseId: "upper-limb-reaching-seated" }],
          status: "completed",
          catalogSession: { id: "catalog-1" },
        },
        {
          id: "ps-2",
          sessionNumber: 2,
          title: "Session 2",
          exercises: [{ exerciseId: "upper-limb-reaching-seated" }],
          status: "completed",
          catalogSession: { id: "catalog-2" },
        },
      ],
    } as unknown as PatientPlanData;

    const logs: SessionLogEntry[] = [
      {
        id: "log-1",
        planSessionId: "ps-1",
        effortScore: 5,
        painScore: 4,
        exercisesCompleted: 1,
        notes: null,
        completedAt: "2026-08-28T10:05:00.000Z",
      },
      {
        id: "log-2",
        planSessionId: "ps-2",
        effortScore: 6,
        painScore: 3,
        exercisesCompleted: 1,
        notes: null,
        completedAt: "2026-08-29T10:05:00.000Z",
      },
    ];

    const points = buildPatientShoulderProgressPoints(plan, logs);
    assert.equal(points.length, 2);
    assert.equal(points[0]?.painAfter, 4);
    assert.equal(points[1]?.effortScore, 6);
  });
});

describe("technical observations visibility", () => {
  it("hides technical observations when no persisted cycles exist", () => {
    assert.equal(hasTechnicalObservationsForBlock(block()), false);
    assert.equal(
      hasTechnicalObservationsForBlock(block({ measured: { ...block().measured, validRepetitions: 12 } })),
      true,
    );
    assert.ok(PANEL_SOURCE.includes("hasTechnicalObservationsForBlock"));
    assert.ok(PANEL_SOURCE.includes("hasTechnicalObservationsForBlock(block)"));
  });
});

describe("progress chart UI wiring", () => {
  it("shows clinician charts and single-session empty state", () => {
    const clinicianChartsSource = readFileSync(
      join(__dirname, "../../components/clinician/progress/InteractiveShoulderClinicianProgressCharts.tsx"),
      "utf8",
    );
    assert.ok(PANEL_SOURCE.includes("InteractiveShoulderClinicianProgressCharts"));
    assert.ok(PANEL_SOURCE.includes("painTrend"));
    assert.ok(clinicianChartsSource.includes("SINGLE_SESSION_CHART_EMPTY_STATE"));
  });

  it("shows patient charts without technical clinician-only series", () => {
    assert.ok(PATIENT_SOURCE.includes("InteractiveShoulderPatientProgressCharts"));
    assert.ok(!PATIENT_SOURCE.includes("Compensation signal"));
    assert.ok(!PATIENT_SOURCE.includes("2D camera angle"));
    assert.ok(!PATIENT_SOURCE.includes("Technical observations"));
  });
});
