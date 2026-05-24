/**
 * lib/api-adapter.ts — Transport seam between the Gait Training Program
 * and the main Creative Motion platform API.
 *
 * DESIGN PRINCIPLES
 * ─────────────────
 * 1. Entirely optional — if SyncConfig is null/undefined or config.enabled is
 *    false, every function returns { status: "skipped" } and touches nothing.
 *    The app runs in fully local-only mode with zero side effects.
 *
 * 2. Never throws — all network errors are caught and returned as typed
 *    SyncResult / FetchPlanResult values. Callers do not need try/catch.
 *
 * 3. Send-only for sessions (V1) — syncPatientSessions POSTs the public
 *    session payload to the platform. It does not write back to localStorage.
 *    Incremental sync (delta since last sync) is a future optimisation; V1
 *    sends all sessions and lets the server deduplicate by session id.
 *
 * 4. Pure on fetch — fetchProgramPlan returns a SessionPlan (or null) but
 *    does NOT persist it. The caller decides whether to call saveActivePlan().
 *    This keeps storage side-effects visible at the call site.
 *
 * 5. SSR-safe — all functions check for the global fetch before running.
 *    They return "skipped" in environments without a fetch implementation
 *    (e.g. Node.js without polyfill).
 *
 * USAGE
 * ─────
 *   import { syncPatientSessions, fetchProgramPlan } from "@/lib/api-adapter";
 *
 *   // Config comes from the main platform (env vars, auth context, etc.)
 *   const cfg: SyncConfig = {
 *     baseUrl:   process.env.NEXT_PUBLIC_CM_API_URL ?? "",
 *     authToken: authSession.accessToken,
 *     enabled:   true,
 *   };
 *
 *   const result = await syncPatientSessions("PT-001", cfg);
 *   if (result.status === "success") console.log(`Synced ${result.sessionsSent} sessions`);
 *
 * FUTURE WORK (not in scope for V1)
 * ───────────────────────────────────
 *   - Incremental sync: track last-synced timestamp per patient, send only new records
 *   - Retry logic with exponential backoff for transient network errors
 *   - Offline queue: buffer sync attempts when the device has no connectivity
 *   - Conflict resolution: server-wins vs. client-wins policy for plan updates
 *   - Webhook / server-sent events: receive real-time plan updates from therapist
 *
 * Decision-support only · Not a clinical system · Therapist review required.
 */

import {
  loadPatientSessions,
  toPublicRecords,
  type ProgramId,
} from "./session-store";
import { PROGRAMS } from "./programs";
import type { SessionPlan } from "./gait/session-plan";

/* ══════════════════════════════════════════════════════════════════════════
   Configuration
══════════════════════════════════════════════════════════════════════════ */

/**
 * Connection configuration for the Creative Motion platform API.
 * Supplied by the main platform's auth/config layer — never hardcoded here.
 */
export interface SyncConfig {
  /**
   * Base URL of the platform API, without trailing slash.
   * E.g. "https://api.creativemotion.io/v1"
   */
  baseUrl:   string;

  /**
   * Bearer token or API key used to authenticate every request.
   * Provided by the platform's auth session after login.
   */
  authToken: string;

  /**
   * Request timeout in milliseconds. Defaults to 10 000 (10 s).
   * Increase for slow connections; decrease for fast-fail UX.
   */
  timeoutMs?: number;

  /**
   * Master kill-switch. When false (or omitted), all adapter functions
   * skip silently and return { status: "skipped", reason: "disabled" }.
   * Useful for feature-flagging sync before the backend is ready.
   * Defaults to true when the field is absent.
   */
  enabled?: boolean;
}

/**
 * Build a SyncConfig from Next.js public environment variables.
 *
 * Returns `null` (→ silent local-only mode) when `NEXT_PUBLIC_CM_API_URL`
 * is empty or absent. No network call is ever attempted in that case.
 *
 * Environment variables:
 *   NEXT_PUBLIC_CM_API_URL — Optional hint only; sync stays disabled here until
 *                            wired with session-derived credentials (never
 *                            NEXT_PUBLIC_* bearer tokens).
 *
 * Usage:
 *   import { syncPatientSessions, getSyncConfig } from "@/lib/api-adapter";
 *   void syncPatientSessions(patientId, getSyncConfig());
 */
export function getSyncConfig(): SyncConfig | null {
  // Never read bearer tokens from NEXT_PUBLIC_* — they ship in the client bundle.
  // When platform sync is enabled, pass an explicit SyncConfig from clinician session auth.
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
   Result types
══════════════════════════════════════════════════════════════════════════ */

export type SyncStatus = "success" | "error" | "skipped";

export type SkipReason =
  | "no_config"      // config was null / undefined
  | "disabled"       // config.enabled === false
  | "no_fetch"       // fetch API unavailable (non-browser environment)
  | "no_sessions";   // nothing to send (empty session list)

export type ErrorReason =
  | "network_error"  // fetch threw (timeout, DNS, CORS, etc.)
  | "auth_error"     // 401 or 403
  | "server_error"   // 5xx
  | "bad_response";  // unexpected response shape

/** Result returned by syncPatientSessions(). */
export interface SyncResult {
  status:        SyncStatus;
  /** Number of sessions included in the sync payload. Present on success. */
  sessionsSent?: number;
  /** Human-readable error message for logging. Present on error. */
  error?:        string;
  /** Machine-readable reason for skipped or error outcomes. */
  reason?:       SkipReason | ErrorReason;
}

/** Result returned by fetchProgramPlan(). */
export interface FetchPlanResult {
  status:   SyncStatus;
  /**
   * The therapist-prescribed plan returned by the platform.
   * Present only when status === "success" and the platform returned a plan.
   * Null means the platform responded successfully but no active plan exists.
   */
  plan?:    SessionPlan | null;
  error?:   string;
  reason?:  SkipReason | ErrorReason | "not_found";
}

/* ══════════════════════════════════════════════════════════════════════════
   Internal helpers
══════════════════════════════════════════════════════════════════════════ */

/** API endpoint path templates. Update here if the platform changes routes. */
const ENDPOINTS = {
  /**
   * POST — bulk upsert of session records for a patient.
   * Server deduplicates by session id; no session is created twice.
   */
  syncSessions: (patientId: string) =>
    `/patients/${encodeURIComponent(patientId)}/sessions/sync`,

  /**
   * GET — retrieve the active therapist-prescribed plan for a patient
   * within a specific program.
   */
  fetchPlan: (patientId: string, programId: string) =>
    `/programs/${encodeURIComponent(programId)}/patients/${encodeURIComponent(patientId)}/plan`,
} as const;

const DEFAULT_TIMEOUT_MS = 10_000;

/** Standard headers sent with every request. */
function buildHeaders(authToken: string): HeadersInit {
  return {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${authToken}`,
    "X-Client":      "creative-motion-gait-v1",
  };
}

/**
 * Wrap a fetch promise in an AbortController timeout.
 * Returns the Response, or throws on timeout / network failure.
 */
async function fetchWithTimeout(
  url:       string,
  init:      RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Classify an HTTP status code into a typed ErrorReason.
 * Used to give callers actionable information without parsing response bodies.
 */
function classifyStatus(status: number): ErrorReason {
  if (status === 401 || status === 403) return "auth_error";
  if (status >= 500)                    return "server_error";
  return "bad_response";
}

/**
 * Guard: returns true if all preconditions for a network call are met.
 * Returns a typed skip result otherwise.
 */
function checkConfig(
  config: SyncConfig | null | undefined,
): { ok: true; config: SyncConfig } | { ok: false; result: SyncResult | FetchPlanResult } {
  if (!config) {
    return { ok: false, result: { status: "skipped", reason: "no_config" } };
  }
  if (config.enabled === false) {
    return { ok: false, result: { status: "skipped", reason: "disabled" } };
  }
  if (typeof fetch === "undefined") {
    return { ok: false, result: { status: "skipped", reason: "no_fetch" } };
  }
  return { ok: true, config };
}

/* ══════════════════════════════════════════════════════════════════════════
   Public adapter functions
══════════════════════════════════════════════════════════════════════════ */

/**
 * Sync a patient's session records to the main Creative Motion platform.
 *
 * Behaviour:
 *   - Loads sessions from localStorage via loadPatientSessions().
 *   - Converts them to the public API shape via toPublicRecords().
 *   - POSTs to /patients/{patientId}/sessions/sync.
 *   - Returns a typed SyncResult — never throws.
 *
 * V1 sends the full session list; the server deduplicates by session id.
 * Incremental sync (delta since last-synced timestamp) is future work.
 *
 * @param patientId  Opaque patient identifier.
 * @param config     Platform connection config. Pass null for local-only mode.
 * @param options    Optional filter: restrict to a specific program's sessions.
 */
export async function syncPatientSessions(
  patientId: string,
  config:    SyncConfig | null | undefined,
  options?:  { programId?: ProgramId },
): Promise<SyncResult> {
  const check = checkConfig(config);
  if (!check.ok) return check.result as SyncResult;

  const { baseUrl, authToken, timeoutMs = DEFAULT_TIMEOUT_MS } = check.config;

  // Load and convert sessions
  const sessions = loadPatientSessions(patientId, options);
  if (sessions.length === 0) {
    return { status: "skipped", reason: "no_sessions" };
  }
  const payload = toPublicRecords(sessions);

  const url = `${baseUrl}${ENDPOINTS.syncSessions(patientId)}`;

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method:  "POST",
        headers: buildHeaders(authToken),
        body:    JSON.stringify({ sessions: payload }),
      },
      timeoutMs,
    );

    if (!response.ok) {
      return {
        status: "error",
        reason: classifyStatus(response.status),
        error:  `HTTP ${response.status} — ${response.statusText}`,
      };
    }

    return { status: "success", sessionsSent: payload.length };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "error",
      reason: "network_error",
      error:  message.includes("aborted") ? "Request timed out" : message,
    };
  }
}

/**
 * Fetch the active therapist-prescribed plan for a patient from the platform.
 *
 * Behaviour:
 *   - GETs /programs/{programId}/patients/{patientId}/plan.
 *   - Returns the parsed SessionPlan, or null if no active plan exists (404).
 *   - Does NOT persist the plan — the caller decides whether to saveActivePlan().
 *   - Never throws.
 *
 * @param patientId  Opaque patient identifier.
 * @param programId  Program to fetch the plan for. Defaults to gait_training.
 * @param config     Platform connection config. Pass null for local-only mode.
 */
export async function fetchProgramPlan(
  patientId: string,
  config:    SyncConfig | null | undefined,
  programId: string = PROGRAMS.GAIT_TRAINING.id,
): Promise<FetchPlanResult> {
  const check = checkConfig(config);
  if (!check.ok) return check.result as FetchPlanResult;

  const { baseUrl, authToken, timeoutMs = DEFAULT_TIMEOUT_MS } = check.config;
  const url = `${baseUrl}${ENDPOINTS.fetchPlan(patientId, programId)}`;

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method:  "GET",
        headers: buildHeaders(authToken),
      },
      timeoutMs,
    );

    // 404 = no active plan for this patient in this program — not an error
    if (response.status === 404) {
      return { status: "success", plan: null, reason: "not_found" };
    }

    if (!response.ok) {
      return {
        status: "error",
        reason: classifyStatus(response.status),
        error:  `HTTP ${response.status} — ${response.statusText}`,
      };
    }

    const data = await response.json() as { plan: SessionPlan };
    return { status: "success", plan: data.plan ?? null };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "error",
      reason: "network_error",
      error:  message.includes("aborted") ? "Request timed out" : message,
    };
  }
}
