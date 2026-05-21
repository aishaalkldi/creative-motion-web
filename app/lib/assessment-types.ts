/**
 * RASQ Assessment Intelligence — Phase 1A
 * Structured clinical assessment data schema.
 * This type is stored as the `data` field in the assessments table (jsonb).
 */

export type BodyRegion =
  | "Knee"
  | "Shoulder"
  | "Lumbar"
  | "Hip"
  | "Ankle"
  | "Cervical"
  | "Upper limb"
  | "Gait/Balance";

export type FunctionalTest = {
  testName: string;
  result: "pass" | "fail" | "limited";
  notes: string;
};

export type RomMeasurement = {
  label: string;
  value: number;
  normalMin: number;
  normalMax: number;
  unit?: string;
  side?: "left" | "right" | "bilateral";
};

export type AssessmentData = {
  // Step 1 — Region
  bodyRegion: BodyRegion;

  // Step 2 — ROM
  rom: {
    /** All measurements captured for this region */
    measurements: RomMeasurement[];
    /** Primary (most clinically significant) measurement — measurements[0] */
    primary: RomMeasurement;
    /** Secondary measurement — measurements[1] if present */
    secondary?: RomMeasurement;
    leftRightComparison: boolean;
    asymmetryPresent: boolean;
  };

  // Step 3 — Pain and symptoms
  painAtRest: number; // 0–10
  painOnMovement: number; // 0–10
  painLocation: string;
  onset: "acute" | "subacute" | "chronic";
  aggravatingFactors: string[];

  // Step 4 — Functional tests
  functionalTests: FunctionalTest[];

  // Step 5 — Clinical notes
  clinicalNotes: string;
  gaitObservations?: string;
  posturalFindings?: string;

  // Step 6 — Classification
  rehabilitationPhase: "Acute" | "Subacute" | "Rehabilitation" | "Maintenance";
  rehabilitationGoals: string[];

  // Meta
  assessedAt: string; // ISO timestamp
  assessedBy: string; // provider name
};
