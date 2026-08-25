/**
 * Run: npx tsx --test app/lib/research/volunteer-research-isolation.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../..");

function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

describe("volunteer research isolation", () => {
  it("migration creates only collection + movement tables (no repetitions)", () => {
    const sql = read("supabase/migrations/021_ml_research_volunteer_sessions.sql");
    assert.match(sql, /ml_research_volunteer_collection_sessions/);
    assert.match(sql, /ml_research_volunteer_movement_sessions/);
    assert.doesNotMatch(sql, /ml_research_volunteer_repetitions/);
    assert.doesNotMatch(sql, /references public\.patients/);
    assert.doesNotMatch(sql, /references public\.cv_session_metrics/);
    assert.doesNotMatch(sql, /references public\.assessments/);
  });

  it("store module does not reference clinical tables", () => {
    const store = read("app/lib/research/volunteer-session-store.ts");
    assert.doesNotMatch(store, /patients/);
    assert.doesNotMatch(store, /cv_session_metrics/);
    assert.doesNotMatch(store, /assessments/);
  });

  it("volunteer UI and hook remain untouched by 8B.1 backend files", () => {
    const files = [
      "app/volunteer/shoulder-abduction-reach/page.tsx",
      "app/hooks/useVolunteerCaptureSession.ts",
    ];
    for (const file of files) {
      const content = read(file);
      assert.doesNotMatch(content, /research\/volunteer/);
      assert.doesNotMatch(content, /ML_VOLUNTEER_COLLECTION_ENABLED/);
    }
  });
});
