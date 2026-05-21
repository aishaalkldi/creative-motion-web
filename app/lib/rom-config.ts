/**
 * RASQ Assessment Intelligence — Phase 1A
 * ROM field definitions and functional test lists per body region.
 */

import type { BodyRegion } from "./assessment-types";

export type RomField = {
  label: string;
  normalMin: number;
  normalMax: number;
  unit: "°";
};

export const ROM_CONFIG: Record<BodyRegion, RomField[]> = {
  Knee: [
    { label: "Flexion",   normalMin: 120, normalMax: 150, unit: "°" },
    { label: "Extension", normalMin: -5,  normalMax: 0,   unit: "°" },
  ],
  Shoulder: [
    { label: "Flexion",           normalMin: 160, normalMax: 180, unit: "°" },
    { label: "Abduction",         normalMin: 160, normalMax: 180, unit: "°" },
    { label: "External Rotation", normalMin: 60,  normalMax: 90,  unit: "°" },
    { label: "Internal Rotation", normalMin: 60,  normalMax: 90,  unit: "°" },
  ],
  Lumbar: [
    { label: "Flexion",         normalMin: 40, normalMax: 60, unit: "°" },
    { label: "Extension",       normalMin: 20, normalMax: 35, unit: "°" },
    { label: "Lateral Flexion", normalMin: 15, normalMax: 25, unit: "°" },
  ],
  Hip: [
    { label: "Flexion",           normalMin: 100, normalMax: 120, unit: "°" },
    { label: "Abduction",         normalMin: 40,  normalMax: 50,  unit: "°" },
    { label: "Internal Rotation", normalMin: 30,  normalMax: 40,  unit: "°" },
  ],
  Ankle: [
    { label: "Dorsiflexion",   normalMin: 10, normalMax: 20, unit: "°" },
    { label: "Plantarflexion", normalMin: 40, normalMax: 50, unit: "°" },
  ],
  Cervical: [
    { label: "Flexion",   normalMin: 45, normalMax: 80, unit: "°" },
    { label: "Extension", normalMin: 50, normalMax: 75, unit: "°" },
    { label: "Rotation",  normalMin: 70, normalMax: 90, unit: "°" },
  ],
  "Upper limb": [
    { label: "Elbow Flexion", normalMin: 130, normalMax: 150, unit: "°" },
    { label: "Wrist Flexion", normalMin: 60,  normalMax: 80,  unit: "°" },
  ],
  "Gait/Balance": [], // ROM not applicable — notes only
};

export const FUNCTIONAL_TESTS_BY_REGION: Record<BodyRegion, string[]> = {
  Knee: [
    "Single-leg squat",
    "Step down test",
    "Lachman test",
    "McMurray test",
    "Patellar grind",
  ],
  Shoulder: [
    "Neer's impingement",
    "Hawkins-Kennedy",
    "Empty can",
    "Speed's test",
    "Apprehension test",
  ],
  Lumbar: [
    "Straight leg raise",
    "Slump test",
    "FABER",
    "Prone instability test",
    "Quadrant test",
  ],
  Hip: ["FABER", "FADIR", "Thomas test", "Trendelenburg"],
  Ankle: ["Thompson test", "Anterior drawer", "Talar tilt"],
  Cervical: ["Spurling test", "Distraction test", "Rotation test"],
  "Upper limb": ["Grip strength", "Pinch strength", "Tinel's sign"],
  "Gait/Balance": [
    "Single-leg stance",
    "Tandem walk",
    "TUG test",
    "Berg Balance",
  ],
};
