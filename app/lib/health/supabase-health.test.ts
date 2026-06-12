/**
 * Run: npx tsx --test app/lib/health/supabase-health.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PILOT_SUPABASE_TABLES,
  aggregateSupabaseHealthStatus,
  buildSupabaseHealthReport,
  envReadyForChecks,
  readSupabaseHealthEnv,
  tableErrorCode,
} from "./supabase-health";
import type { PilotSupabaseTable, TableHealthEntry } from "./supabase-health";

function allTables(status: TableHealthEntry["status"]): Record<PilotSupabaseTable, TableHealthEntry> {
  return Object.fromEntries(
    PILOT_SUPABASE_TABLES.map((table) => [table, { status }]),
  ) as Record<PilotSupabaseTable, TableHealthEntry>;
}

describe("readSupabaseHealthEnv", () => {
  it("returns booleans only", () => {
    const env = readSupabaseHealthEnv();
    assert.equal(typeof env.supabaseUrl, "boolean");
    assert.equal(typeof env.anonKey, "boolean");
    assert.equal(typeof env.serviceRoleKey, "boolean");
  });
});

describe("envReadyForChecks", () => {
  it("requires all three env vars", () => {
    assert.equal(
      envReadyForChecks({ supabaseUrl: true, anonKey: true, serviceRoleKey: true }),
      true,
    );
    assert.equal(
      envReadyForChecks({ supabaseUrl: true, anonKey: false, serviceRoleKey: true }),
      false,
    );
  });
});

describe("tableErrorCode", () => {
  it("maps missing table codes", () => {
    assert.equal(tableErrorCode({ code: "42P01" }), "missing_table");
    assert.equal(tableErrorCode({ code: "PGRST205" }), "missing_table");
  });

  it("maps missing column code", () => {
    assert.equal(tableErrorCode({ code: "42703" }), "missing_column");
  });
});

describe("aggregateSupabaseHealthStatus", () => {
  const fullEnv = { supabaseUrl: true, anonKey: true, serviceRoleKey: true };

  it("returns error when env incomplete", () => {
    assert.equal(
      aggregateSupabaseHealthStatus({
        env: { supabaseUrl: false, anonKey: true, serviceRoleKey: true },
        connection: "skipped",
        tables: allTables("skipped"),
      }),
      "error",
    );
  });

  it("returns error when connection fails", () => {
    assert.equal(
      aggregateSupabaseHealthStatus({
        env: fullEnv,
        connection: "error",
        tables: allTables("skipped"),
      }),
      "error",
    );
  });

  it("returns ok when all tables ok", () => {
    assert.equal(
      aggregateSupabaseHealthStatus({
        env: fullEnv,
        connection: "ok",
        tables: allTables("ok"),
      }),
      "ok",
    );
  });

  it("returns degraded when one table fails", () => {
    const tables = allTables("ok");
    tables.patients = { status: "error", code: "missing_column" };
    assert.equal(
      aggregateSupabaseHealthStatus({ env: fullEnv, connection: "ok", tables }),
      "degraded",
    );
  });
});

describe("buildSupabaseHealthReport", () => {
  it("fills missing table entries and sets checkedAt", () => {
    const partial = { providers: { status: "ok" as const } } as Record<
      PilotSupabaseTable,
      TableHealthEntry
    >;
    const report = buildSupabaseHealthReport({
      env: { supabaseUrl: true, anonKey: true, serviceRoleKey: true },
      connection: "ok",
      tables: partial,
      checkedAt: "2026-06-05T12:00:00.000Z",
    });

    assert.equal(report.checkedAt, "2026-06-05T12:00:00.000Z");
    assert.equal(report.tables.providers.status, "ok");
    assert.equal(report.tables.patients.status, "skipped");
    assert.ok(["ok", "degraded", "error"].includes(report.status));
  });

  it("never includes secret fields", () => {
    const report = buildSupabaseHealthReport({
      env: { supabaseUrl: true, anonKey: true, serviceRoleKey: true },
      connection: "ok",
      tables: allTables("ok"),
    });
    const json = JSON.stringify(report);
    assert.equal(json.includes("SUPABASE"), false);
    assert.equal(json.includes("service_role"), false);
    assert.equal(json.includes("eyJ"), false);
  });
});
