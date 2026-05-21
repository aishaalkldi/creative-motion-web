import type { SpecialTestEntry, SpecialTestResult, SpecialTestsData } from "./types";

// ── Region types ───────────────────────────────────────────────────────────────

export type SpecialTestRegion = "knee" | "shoulder" | "spine" | "hip" | "ankle";

export const REGION_LABELS: Record<SpecialTestRegion, string> = {
  knee:     "Knee",
  shoulder: "Shoulder",
  spine:    "Spine & Cervical",
  hip:      "Hip & Pelvis",
  ankle:    "Ankle & Foot",
};

export const REGION_ORDER: SpecialTestRegion[] = ["knee", "shoulder", "spine", "hip", "ankle"];

// ── Test catalog ───────────────────────────────────────────────────────────────

export interface SpecialTestDef {
  id: string;
  name: string;
  hint: string;
  region: SpecialTestRegion;
}

export const SPECIAL_TESTS_CATALOG: SpecialTestDef[] = [
  // ── Knee ──
  { id: "lachman",               name: "Lachman Test",                   hint: "ACL integrity",                       region: "knee" },
  { id: "anterior_drawer_knee",  name: "Anterior Drawer (Knee)",         hint: "ACL integrity",                       region: "knee" },
  { id: "posterior_drawer_knee", name: "Posterior Drawer (Knee)",        hint: "PCL integrity",                       region: "knee" },
  { id: "mcmurray",              name: "McMurray Test",                   hint: "Medial / lateral meniscus",           region: "knee" },
  { id: "valgus_stress_knee",    name: "Valgus Stress Test",             hint: "MCL integrity",                       region: "knee" },
  { id: "varus_stress_knee",     name: "Varus Stress Test",              hint: "LCL integrity",                       region: "knee" },
  { id: "clarke_sign",           name: "Clarke's Sign (Patella Grind)",  hint: "Patellofemoral joint",                region: "knee" },

  // ── Shoulder ──
  { id: "hawkins_kennedy",       name: "Hawkins-Kennedy Test",           hint: "Subacromial impingement",             region: "shoulder" },
  { id: "neer_sign",             name: "Neer Sign",                      hint: "Subacromial impingement",             region: "shoulder" },
  { id: "empty_can",             name: "Empty Can (Jobe Test)",          hint: "Supraspinatus tear / weakness",       region: "shoulder" },
  { id: "drop_arm",              name: "Drop Arm Test",                  hint: "Rotator cuff tear",                   region: "shoulder" },
  { id: "speeds_test",           name: "Speed's Test",                   hint: "Biceps long head tendinopathy",       region: "shoulder" },
  { id: "apprehension_shoulder", name: "Apprehension Test",              hint: "Anterior glenohumeral instability",   region: "shoulder" },
  { id: "obrien_test",           name: "O'Brien's Test (SLAP)",          hint: "SLAP lesion / AC joint",              region: "shoulder" },

  // ── Spine & Cervical ──
  { id: "slr",                   name: "Straight Leg Raise (SLR)",       hint: "L4–S1 nerve root tension",            region: "spine" },
  { id: "slump",                 name: "Slump Test",                     hint: "Neural tension — lumbar / sciatic",   region: "spine" },
  { id: "spurling",              name: "Spurling's Test",                hint: "Cervical radiculopathy",              region: "spine" },
  { id: "cervical_distraction",  name: "Cervical Distraction Test",      hint: "Nerve root compression relief",       region: "spine" },
  { id: "spring_test",           name: "Spring Test (PA Pressure)",      hint: "Segmental hypomobility",              region: "spine" },
  { id: "si_faber",              name: "FABER / Patrick — SI Joint",     hint: "Sacroiliac joint dysfunction",        region: "spine" },

  // ── Hip & Pelvis ──
  { id: "faber_hip",             name: "FABER / Hip",                    hint: "Hip flexion-abduction-ER",            region: "hip" },
  { id: "fadir_hip",             name: "FADIR Test",                     hint: "Hip impingement (FAI)",               region: "hip" },
  { id: "thomas_test",           name: "Thomas Test",                    hint: "Hip flexor / iliopsoas contracture",  region: "hip" },
  { id: "trendelenburg",         name: "Trendelenburg Sign",             hint: "Gluteus medius weakness",             region: "hip" },
  { id: "scour_hip",             name: "Scour Test",                     hint: "Hip joint articular pathology",       region: "hip" },
  { id: "ober_test",             name: "Ober's Test",                    hint: "IT band / TFL tightness",             region: "hip" },

  // ── Ankle & Foot ──
  { id: "anterior_drawer_ankle", name: "Anterior Drawer (Ankle)",        hint: "ATFL laxity",                         region: "ankle" },
  { id: "talar_tilt",            name: "Talar Tilt Test",                hint: "CFL laxity",                          region: "ankle" },
  { id: "thompson_test",         name: "Thompson Test",                  hint: "Achilles tendon rupture",             region: "ankle" },
  { id: "squeeze_ankle",         name: "Squeeze Test",                   hint: "Syndesmosis / fibula fracture",        region: "ankle" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

export function getTestsByRegion(region: SpecialTestRegion): SpecialTestDef[] {
  return SPECIAL_TESTS_CATALOG.filter((t) => t.region === region);
}

export function createEmptySpecialTests(): SpecialTestsData {
  const out: SpecialTestsData = {};
  for (const t of SPECIAL_TESTS_CATALOG) {
    out[t.id] = { result: "not_tested", notes: "" };
  }
  return out;
}

export interface RegionCount {
  positive: number;
  negative: number;
  inconclusive: number;
  tested: number;
}

export function countRegionResults(
  data: SpecialTestsData,
  region: SpecialTestRegion,
): RegionCount {
  let positive = 0, negative = 0, inconclusive = 0;
  for (const t of getTestsByRegion(region)) {
    const entry = data[t.id];
    if (!entry || entry.result === "not_tested") continue;
    if (entry.result === "positive")     positive++;
    else if (entry.result === "negative")     negative++;
    else if (entry.result === "inconclusive") inconclusive++;
  }
  return { positive, negative, inconclusive, tested: positive + negative + inconclusive };
}

export function countAllPositives(data: SpecialTestsData): number {
  return Object.values(data).filter((e) => e.result === "positive").length;
}

export function getTestedTests(data: SpecialTestsData): Array<SpecialTestDef & { entry: SpecialTestEntry }> {
  return SPECIAL_TESTS_CATALOG
    .map((t) => ({ ...t, entry: data[t.id] ?? { result: "not_tested" as SpecialTestResult, notes: "" } }))
    .filter((t) => t.entry.result !== "not_tested");
}

// Re-export types for convenience
export type { SpecialTestEntry, SpecialTestResult, SpecialTestsData };
