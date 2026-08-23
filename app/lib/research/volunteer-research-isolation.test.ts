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
  it("migration 021 creates collection + movement tables only", () => {
    const sql = read("supabase/migrations/021_ml_research_volunteer_sessions.sql");
    assert.match(sql, /ml_research_volunteer_collection_sessions/);
    assert.match(sql, /ml_research_volunteer_movement_sessions/);
    assert.doesNotMatch(sql, /ml_research_volunteer_repetitions/);
    assert.doesNotMatch(sql, /references public\.patients/);
    assert.doesNotMatch(sql, /references public\.cv_session_metrics/);
    assert.doesNotMatch(sql, /references public\.assessments/);
  });

  it("migration 022 creates repetitions table with research-only FK", () => {
    const sql = read("supabase/migrations/022_ml_research_volunteer_repetitions.sql");
    assert.match(sql, /ml_research_volunteer_repetitions/);
    assert.match(sql, /references public\.ml_research_volunteer_movement_sessions/);
    assert.doesNotMatch(sql, /references public\.patients/);
    assert.doesNotMatch(sql, /references public\.cv_session_metrics/);
    assert.doesNotMatch(sql, /references public\.assessments/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /revoke all on public\.ml_research_volunteer_repetitions from anon/);
    assert.match(sql, /grant select, insert, update, delete on public\.ml_research_volunteer_repetitions/);
  });

  it("repetition modules do not reference clinical tables", () => {
    for (const file of [
      "app/lib/research/volunteer-repetition-store.ts",
      "app/lib/research/volunteer-repetition-validation.ts",
    ]) {
      const source = read(file);
      assert.doesNotMatch(source, /patients/);
      assert.doesNotMatch(source, /cv_session_metrics/);
      assert.doesNotMatch(source, /assessments/);
    }
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
