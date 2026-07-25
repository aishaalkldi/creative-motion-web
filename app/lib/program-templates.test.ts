/**
 * Run: npx tsx --test app/lib/program-templates.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOVE_BETTER_PERFORMANCE_V1_ID } from "@/app/lib/move-better-performance-v1";
import {
  PILOT_PROGRAM_TEMPLATES,
  REHABILITATION_AREA_DISPLAY_ORDER,
  filterPilotTemplates,
  visibleRehabilitationAreas,
  type RehabilitationArea,
} from "@/app/lib/program-templates";

const VALID_AREAS = new Set<RehabilitationArea>(REHABILITATION_AREA_DISPLAY_ORDER);

const GENERAL_REHABILITATION_IDS = [
  "deconditioning-foundation-01",
  "pain-mobility-beginner-01",
  MOVE_BETTER_PERFORMANCE_V1_ID,
].sort();

describe("PILOT_PROGRAM_TEMPLATES rehabilitationArea classification", () => {
  it("has 18 templates", () => {
    assert.equal(PILOT_PROGRAM_TEMPLATES.length, 18);
  });

  it("every template has a valid rehabilitationArea", () => {
    for (const template of PILOT_PROGRAM_TEMPLATES) {
      assert.ok(
        VALID_AREAS.has(template.rehabilitationArea),
        `${template.id} has invalid rehabilitationArea: ${template.rehabilitationArea}`,
      );
    }
  });

  it("General Rehabilitation contains exactly the three approved templates", () => {
    const ids = PILOT_PROGRAM_TEMPLATES.filter(
      (t) => t.rehabilitationArea === "general-rehabilitation",
    )
      .map((t) => t.id)
      .sort();
    assert.deepEqual(ids, GENERAL_REHABILITATION_IDS);
  });

  it("Neurorehabilitation contains exactly neuro-mobility-foundation-01", () => {
    const ids = PILOT_PROGRAM_TEMPLATES.filter(
      (t) => t.rehabilitationArea === "neurorehabilitation",
    ).map((t) => t.id);
    assert.deepEqual(ids, ["neuro-mobility-foundation-01"]);
  });

  it("Vestibular & Balance Rehabilitation contains exactly balance-gait-foundation-01", () => {
    const ids = PILOT_PROGRAM_TEMPLATES.filter(
      (t) => t.rehabilitationArea === "vestibular-balance-rehabilitation",
    ).map((t) => t.id);
    assert.deepEqual(ids, ["balance-gait-foundation-01"]);
  });

  it("Orthopedic & Sports Rehabilitation contains the remaining 13 templates", () => {
    const ids = PILOT_PROGRAM_TEMPLATES.filter(
      (t) => t.rehabilitationArea === "orthopedic-sports-rehabilitation",
    ).map((t) => t.id);
    assert.equal(ids.length, 13);
    for (const id of GENERAL_REHABILITATION_IDS) {
      assert.ok(!ids.includes(id), `${id} should not be classified as orthopedic-sports`);
    }
  });
});

describe("visibleRehabilitationAreas", () => {
  it("returns areas present in the data, in the fixed display order", () => {
    const areas = visibleRehabilitationAreas(PILOT_PROGRAM_TEMPLATES);
    assert.deepEqual(areas, [
      "neurorehabilitation",
      "orthopedic-sports-rehabilitation",
      "vestibular-balance-rehabilitation",
      "general-rehabilitation",
    ]);
  });

  it("omits an area with zero templates and preserves order of the rest", () => {
    const withoutNeuro = PILOT_PROGRAM_TEMPLATES.filter(
      (t) => t.rehabilitationArea !== "neurorehabilitation",
    );
    const areas = visibleRehabilitationAreas(withoutNeuro);
    assert.deepEqual(areas, [
      "orthopedic-sports-rehabilitation",
      "vestibular-balance-rehabilitation",
      "general-rehabilitation",
    ]);
  });

  it("returns an empty array for an empty template list", () => {
    assert.deepEqual(visibleRehabilitationAreas([]), []);
  });
});

describe("filterPilotTemplates", () => {
  it("returns all 18 templates for empty query and area 'all'", () => {
    const result = filterPilotTemplates(PILOT_PROGRAM_TEMPLATES, { area: "all", query: "" });
    assert.equal(result.length, 18);
  });

  it("filters by area only", () => {
    const result = filterPilotTemplates(PILOT_PROGRAM_TEMPLATES, {
      area: "vestibular-balance-rehabilitation",
      query: "",
    });
    assert.deepEqual(
      result.map((t) => t.id),
      ["balance-gait-foundation-01"],
    );
  });

  it("search is case-insensitive across title, conditionArea, and programGoal", () => {
    const byTitle = filterPilotTemplates(PILOT_PROGRAM_TEMPLATES, {
      area: "all",
      query: "SPORTS KNEE FOUNDATION V1",
    });
    assert.ok(byTitle.some((t) => t.id === "sports-knee-foundation-v1"));

    const byConditionArea = filterPilotTemplates(PILOT_PROGRAM_TEMPLATES, {
      area: "all",
      query: "low back",
    });
    assert.ok(byConditionArea.some((t) => t.id === "low-back-beginner"));

    const byProgramGoal = filterPilotTemplates(PILOT_PROGRAM_TEMPLATES, {
      area: "all",
      query: "quadriceps and hamstring strength",
    });
    assert.ok(byProgramGoal.some((t) => t.id === "knee-foundation-01"));
  });

  it("combines area and search with AND semantics", () => {
    // "knee" matches many orthopedic templates but zero neuro templates.
    const matching = filterPilotTemplates(PILOT_PROGRAM_TEMPLATES, {
      area: "orthopedic-sports-rehabilitation",
      query: "knee",
    });
    assert.ok(matching.length > 0);
    assert.ok(matching.every((t) => t.rehabilitationArea === "orthopedic-sports-rehabilitation"));

    const nonMatching = filterPilotTemplates(PILOT_PROGRAM_TEMPLATES, {
      area: "neurorehabilitation",
      query: "knee",
    });
    assert.deepEqual(nonMatching, []);
  });

  it("returns an empty array when nothing matches the query", () => {
    const result = filterPilotTemplates(PILOT_PROGRAM_TEMPLATES, {
      area: "all",
      query: "no-such-program-xyz",
    });
    assert.deepEqual(result, []);
  });

  it("does not mutate or reorder the source array", () => {
    const before = PILOT_PROGRAM_TEMPLATES.map((t) => t.id);
    filterPilotTemplates(PILOT_PROGRAM_TEMPLATES, {
      area: "orthopedic-sports-rehabilitation",
      query: "knee",
    });
    const after = PILOT_PROGRAM_TEMPLATES.map((t) => t.id);
    assert.deepEqual(after, before);
  });
});
