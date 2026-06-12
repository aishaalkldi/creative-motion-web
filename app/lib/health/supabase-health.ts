import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Pilot tables that must exist after migrations 001–009. */
export const PILOT_SUPABASE_TABLES = [
  "providers",
  "patients",
  "treatment_plans",
  "plan_sessions",
  "session_logs",
  "patient_access_tokens",
  "cv_session_metrics",
  "assessments",
  "remote_assessment_requests",
  "clinical_review_acknowledgments",
] as const;

export type PilotSupabaseTable = (typeof PILOT_SUPABASE_TABLES)[number];

export type SupabaseHealthEnv = {
  supabaseUrl: boolean;
  anonKey: boolean;
  serviceRoleKey: boolean;
};

export type TableHealthEntry =
  | { status: "ok" }
  | { status: "error"; code?: string }
  | { status: "skipped" };

export type SupabaseHealthStatus = "ok" | "degraded" | "error";

export type SupabaseHealthReport = {
  status: SupabaseHealthStatus;
  env: SupabaseHealthEnv;
  connection: "ok" | "error" | "skipped";
  tables: Record<PilotSupabaseTable, TableHealthEntry>;
  checkedAt: string;
};

export function readSupabaseHealthEnv(): SupabaseHealthEnv {
  return {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    anonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
    serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
  };
}

export function envReadyForChecks(env: SupabaseHealthEnv): boolean {
  return env.supabaseUrl && env.anonKey && env.serviceRoleKey;
}

function skippedTables(): Record<PilotSupabaseTable, TableHealthEntry> {
  return Object.fromEntries(
    PILOT_SUPABASE_TABLES.map((table) => [table, { status: "skipped" as const }]),
  ) as Record<PilotSupabaseTable, TableHealthEntry>;
}

/** Map PostgREST / Postgres errors to a safe client code (no secret values). */
export function tableErrorCode(error: { code?: string; message?: string }): string {
  const code = error.code?.trim();
  if (code === "42P01" || code === "PGRST205") return "missing_table";
  if (code === "42703") return "missing_column";
  if (code) return code;
  return "query_failed";
}

export function aggregateSupabaseHealthStatus(input: {
  env: SupabaseHealthEnv;
  connection: SupabaseHealthReport["connection"];
  tables: Record<PilotSupabaseTable, TableHealthEntry>;
}): SupabaseHealthStatus {
  if (!envReadyForChecks(input.env)) return "error";
  if (input.connection === "error") return "error";

  const tableStatuses = PILOT_SUPABASE_TABLES.map((t) => input.tables[t]?.status);
  if (tableStatuses.every((s) => s === "ok")) return "ok";
  if (tableStatuses.some((s) => s === "error")) return "degraded";
  return "error";
}

export function buildSupabaseHealthReport(input: {
  env: SupabaseHealthEnv;
  connection: SupabaseHealthReport["connection"];
  tables: Record<PilotSupabaseTable, TableHealthEntry>;
  checkedAt?: string;
}): SupabaseHealthReport {
  const tables = { ...input.tables };
  for (const table of PILOT_SUPABASE_TABLES) {
    if (!tables[table]) tables[table] = { status: "skipped" };
  }

  return {
    status: aggregateSupabaseHealthStatus({
      env: input.env,
      connection: input.connection,
      tables,
    }),
    env: input.env,
    connection: input.connection,
    tables,
    checkedAt: input.checkedAt ?? new Date().toISOString(),
  };
}

async function checkTable(
  admin: SupabaseClient,
  table: PilotSupabaseTable,
): Promise<TableHealthEntry> {
  try {
    const { error } = await admin.from(table).select("id").limit(0);
    if (error) {
      return { status: "error", code: tableErrorCode(error) };
    }
    return { status: "ok" };
  } catch {
    return { status: "error", code: "query_failed" };
  }
}

async function probeConnection(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.from("providers").select("id").limit(0);
  return !error;
}

/**
 * Runs Supabase env + connectivity + pilot table readiness checks.
 * Never returns secret values.
 */
export async function runSupabaseHealthChecks(): Promise<SupabaseHealthReport> {
  const checkedAt = new Date().toISOString();
  const env = readSupabaseHealthEnv();

  if (!envReadyForChecks(env)) {
    return buildSupabaseHealthReport({
      env,
      connection: "skipped",
      tables: skippedTables(),
      checkedAt,
    });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();

  const admin = createAdminClient(url, svc, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const connected = await probeConnection(admin);
  if (!connected) {
    return buildSupabaseHealthReport({
      env,
      connection: "error",
      tables: skippedTables(),
      checkedAt,
    });
  }

  const tables = {} as Record<PilotSupabaseTable, TableHealthEntry>;
  for (const table of PILOT_SUPABASE_TABLES) {
    tables[table] = await checkTable(admin, table);
  }

  return buildSupabaseHealthReport({
    env,
    connection: "ok",
    tables,
    checkedAt,
  });
}
