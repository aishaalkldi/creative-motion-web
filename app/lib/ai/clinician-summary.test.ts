/**
 * AI Clinician Summary v0 — unit tests (node:test).
 * Run: npx tsx --test app/lib/ai/clinician-summary.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAiSessionSummaryRequestBody } from "@/app/api/clinician/ai-session-summary/route";
import {
  buildClinicianSummaryPayload,
  findForbiddenPayloadKeys,
  sanitizePatientNote,
  type ClinicianSummaryFetchContext,
} from "./clinician-summary-input";
import {
  buildSafeFallbackSummary,
  findForbiddenPhrasesInSummary,
  isAiSummaryOutputSafe,
  validateAndNormalizeAiSummary,
} from "./clinician-summary-validate";

const baseContext: ClinicianSummaryFetchContext = {
  planId: "plan-1",
  sessions: [
    { status: "completed", session_number: 1 },
    { status: "completed", session_number: 2 },
    { status: "completed", session_number: 3 },
    { status: "pending", session_number: 4 },
  ],
  sessionLogs: [
    {
      session_number: 3,
      effort_score: 5,
      pain_score: 4,
      exercises_completed: 3,
      notes: "[rasq-coach painBefore=3]\nFelt okay today",
      completed_at: "2026-05-28T10:00:00.000Z",
    },
    {
      session_number: 2,
      effort_score: 6,
      pain_score: 3,
      exercises_completed: 3,
      notes: null,
      completed_at: "2026-05-25T10:00:00.000Z",
    },
  ],
  cvMetrics: [
    {
      exercise_id: "sit-to-stand",
      rep_count: 8,
      session_duration_s: 120,
      tracking_quality: "good",
      movement_detected: true,
      recorded_at: "2026-05-28T10:05:00.000Z",
    },
  ],
  assessment: null,
  clinicalActionStatus: "stable",
};

describe("buildClinicianSummaryPayload", () => {
  it("excludes patient identifiers from payload", () => {
    const { payload } = buildClinicianSummaryPayload(baseContext);
    const serialized = JSON.stringify(payload);

    assert.doesNotMatch(serialized, /patientName|full_name|phone|email|patientToken/i);
    assert.equal(payload.plan.sessionsCompleted, 3);
    assert.equal(payload.plan.totalSessions, 4);
    assert.equal(payload.cvSessions.length, 1);
    assert.equal(payload.cvSessions[0]?.repCount, 8);
  });

  it("excludes video, landmarks, hipY, and raw motion keys from payload structure", () => {
    const { payload } = buildClinicianSummaryPayload(baseContext);
    const forbidden = findForbiddenPayloadKeys(payload);
    assert.deepEqual(forbidden, []);
    assert.ok(!("hipY" in payload));
    assert.ok(!("landmarks" in payload));
    for (const cv of payload.cvSessions) {
      assert.ok(!("frames_with_pose" in cv));
      assert.ok(!("video" in cv));
    }
  });

  it("truncates and sanitizes patient notes", () => {
    const longNote = "x".repeat(300);
    const note = sanitizePatientNote(`[rasq-coach]\nContact me at test@example.com or +966501234567\n${longNote}`);
    assert.ok(note);
    assert.ok(note.length <= 200);
    assert.match(note, /\[redacted\]/);
    assert.doesNotMatch(note, /test@example.com/);
  });
});

describe("forbidden phrase validator", () => {
  it("blocks unsafe AI text", () => {
    const unsafe = "Patient shows bad form and is ready to progress with increased exercises.";
    const phrases = findForbiddenPhrasesInSummary(unsafe);
    assert.ok(phrases.length > 0);
    assert.equal(isAiSummaryOutputSafe(unsafe), false);
  });

  it("allows safe narrative text with required closing", () => {
    const safe =
      "Patient completed 3 of 4 sessions. Pain stayed around 3–4/10. No automatic plan changes are suggested. Therapist review required.";
    assert.equal(isAiSummaryOutputSafe(safe), true);
    const result = validateAndNormalizeAiSummary(safe);
    assert.equal(result.ok, true);
  });

  it("rejects diagnosis and treatment recommendation wording", () => {
    const bad = "Possible diagnosis of knee OA. Treatment recommendation: increase exercises.";
    const result = validateAndNormalizeAiSummary(bad);
    assert.equal(result.ok, false);
    assert.ok(result.forbiddenPhrases.includes("diagnosis"));
    assert.ok(result.forbiddenPhrases.includes("treatment recommendation"));
  });
});

describe("buildSafeFallbackSummary", () => {
  it("produces a deterministic safe summary", () => {
    const { payload } = buildClinicianSummaryPayload(baseContext);
    const summary = buildSafeFallbackSummary(payload);
    assert.match(summary, /completed 3 of 4 assigned sessions/i);
    assert.match(summary, /No automatic plan changes are suggested/i);
    assert.equal(isAiSummaryOutputSafe(summary), true);
  });
});

describe("parseAiSessionSummaryRequestBody", () => {
  it("requires patientId", () => {
    assert.deepEqual(parseAiSessionSummaryRequestBody({}), { ok: false });
    assert.deepEqual(parseAiSessionSummaryRequestBody({ patientId: "  " }), { ok: false });
  });

  it("accepts patientId and optional planId", () => {
    assert.deepEqual(parseAiSessionSummaryRequestBody({ patientId: "abc-123" }), {
      ok: true,
      patientId: "abc-123",
      planId: null,
    });
    assert.deepEqual(
      parseAiSessionSummaryRequestBody({ patientId: "abc-123", planId: "plan-9" }),
      { ok: true, patientId: "abc-123", planId: "plan-9" },
    );
  });
});
