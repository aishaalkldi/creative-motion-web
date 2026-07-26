/**
 * Run: npx tsx --test app/lib/rehab-programs/catalog-session-player-conversion.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { ProgramSession } from "./rehab-program-types";
import { toSessionDefinition } from "./rehab-program-runtime-adapter";
import { STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1 } from "./stroke-upper-limb-recovery-foundation";
import { convertCatalogProgramSession } from "./catalog-session-player-conversion";
import { interactiveShoulderUi } from "@/app/lib/interactive-shoulder/interactive-shoulder-ui";

const INVALID_CATALOG_SESSION: ProgramSession = Object.freeze({
  ...STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1,
  blocks: Object.freeze([
    Object.freeze({
      blockId: "unknown-block-without-position-mapping",
      blockType: "instructional" as const,
      title: "Invalid",
      instructions: "This block ID is not mapped in the runtime adapter.",
      targetDurationSeconds: 60,
      lateralityPolicy: "not_applicable" as const,
    }),
  ]),
});

describe("catalog-session-player-conversion", () => {
  it("converts a valid ProgramSession using the existing adapter", () => {
    const result = convertCatalogProgramSession(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const expected = toSessionDefinition(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1);
    assert.equal(result.sessionDefinition.sessionId, expected.sessionId);
    assert.equal(result.sessionDefinition.blocks.length, expected.blocks.length);
    assert.deepEqual(
      result.sessionDefinition.blocks.map((block) => block.blockId),
      expected.blocks.map((block) => block.blockId),
    );
  });

  it("returns explicit failure for invalid catalog configuration", () => {
    assert.throws(() => toSessionDefinition(INVALID_CATALOG_SESSION));
    const result = convertCatalogProgramSession(INVALID_CATALOG_SESSION);
    assert.deepEqual(result, { ok: false });
  });

  it("logs a developer diagnostic on conversion failure without changing patient result", () => {
    const originalError = console.error;
    const logs: unknown[][] = [];
    console.error = (...args: unknown[]) => {
      logs.push(args);
    };
    try {
      const result = convertCatalogProgramSession(INVALID_CATALOG_SESSION);
      assert.deepEqual(result, { ok: false });
      assert.equal(logs.length, 1);
      assert.equal(logs[0]?.[0], "[CatalogSessionPlayer] Catalog session conversion failed");
      const payload = logs[0]?.[1] as { catalogSessionId?: string; message?: string };
      assert.equal(payload.catalogSessionId, INVALID_CATALOG_SESSION.id);
      assert.ok(typeof payload.message === "string" && payload.message.length > 0);
    } finally {
      console.error = originalError;
    }
  });

  it("CatalogSessionPlayer shows fail-closed error when programSession is null", () => {
    const playerPath = join(
      process.cwd(),
      "app/components/patient/interactive-shoulder/CatalogSessionPlayer.tsx",
    );
    const source = readFileSync(playerPath, "utf8");
    assert.match(source, /programSession: ProgramSession \| null/);
    assert.match(source, /programSession \? convertCatalogProgramSession\(programSession\) : \{ ok: false/);
  });

  it("CatalogSessionPlayer passes converted SessionDefinition to OrchestratorCvSessionCore", () => {
    const playerPath = join(
      process.cwd(),
      "app/components/patient/interactive-shoulder/CatalogSessionPlayer.tsx",
    );
    const source = readFileSync(playerPath, "utf8");
    assert.match(source, /convertCatalogProgramSession\(programSession\)/);
    assert.match(source, /OrchestratorCvSessionCore/);
    assert.match(source, /sessionDefinition=\{conversion\.sessionDefinition\}/);
    assert.doesNotMatch(source, /from "\.\/InteractiveShoulderSession"/);
    assert.doesNotMatch(source, /<InteractiveShoulderSession/);
    assert.doesNotMatch(source, /toSessionDefinition/);
  });

  it("invalid configuration renders bilingual error state without legacy fallback", () => {
    const playerPath = join(
      process.cwd(),
      "app/components/patient/interactive-shoulder/CatalogSessionPlayer.tsx",
    );
    const source = readFileSync(playerPath, "utf8");
    assert.match(source, /catalogSessionConfigErrorTitle/);
    assert.match(source, /catalogSessionConfigErrorDescription/);
    assert.match(source, /role="alert"/);
    assert.doesNotMatch(source, /from "\.\/InteractiveShoulderSession"/);
    assert.doesNotMatch(source, /<InteractiveShoulderSession/);
    assert.doesNotMatch(source, /REACH_THE_LIGHT_SESSION/);
    assert.doesNotMatch(source, /resolveInteractiveShoulderSessionFromEnv/);
    assert.doesNotMatch(source, /conversion\.message/);
    assert.doesNotMatch(source, /error\.message/);
  });

  it("catalog session config error copy is bilingual in interactiveShoulderUi", () => {
    const en = interactiveShoulderUi("en");
    const ar = interactiveShoulderUi("ar");
    assert.ok(en.catalogSessionConfigErrorTitle.length > 0);
    assert.ok(ar.catalogSessionConfigErrorTitle.length > 0);
    assert.notEqual(en.catalogSessionConfigErrorTitle, ar.catalogSessionConfigErrorTitle);
    assert.ok(en.catalogSessionConfigErrorDescription.length > 0);
    assert.ok(ar.catalogSessionConfigErrorDescription.length > 0);
    assert.notEqual(en.catalogSessionConfigErrorDescription, ar.catalogSessionConfigErrorDescription);
  });
});
