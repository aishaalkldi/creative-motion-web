/**
 * POST /api/upper-limb-motor-screen/session-results
 *
 * Persists a computed Upper-Limb Motor Screen session result.
 * provider_id/patient_id are taken from the parent assignment row
 * (never the request body) — this is the ownership contract that
 * 019's composite FK enforces at the DB layer. id is server-generated;
 * status is always "computed" on creation (finalization is a separate
 * endpoint). No clinical decision logic is added here: the request
 * body is shape-validated (session-result-request-validation.ts, new)
 * and then handed to the existing, unchanged, policy-neutral
 * assembler (assembleUpperLimbMotorScreenSessionResult).
 *
 * GET /api/upper-limb-motor-screen/session-results?assignmentId=
 *
 * Read-only, additive. Verifies assignment ownership first (same
 * fetchAssignmentForSessionResultOwnership used by POST), then returns
 * the latest existing session result for that assignment, or null.
 */
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateUpperLimbMotorScreenSessionResultRequest } from "@/app/lib/upper-limb-motor-screen/session-result-request-validation";
import { assembleUpperLimbMotorScreenSessionResult } from "@/app/lib/upper-limb-motor-screen/session-result-assembler";
import {
  buildUpperLimbMotorScreenSessionResultInsert,
  fetchAssignmentForSessionResultOwnership,
  findLatestUpperLimbMotorScreenSessionResult,
  insertUpperLimbMotorScreenSessionResult,
  toUpperLimbMotorScreenSessionResultPublic,
} from "@/app/lib/upper-limb-motor-screen/session-result-persistence";
import {
  checkClinicianWriteLimit,
  rateLimitExceededResponse,
  type RateLimitResult,
} from "@/app/lib/rate-limit";
import { serviceUnavailableResponse } from "@/app/lib/api/safe-errors";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CREATE_ERROR = "Failed to create session result.";

export type UpperLimbSessionResultPostDependencies = {
  getAuthenticatedUser: () => Promise<{ id: string } | null>;
  adminClient: SupabaseClient;
  checkWriteLimit: (providerId: string, route: string) => RateLimitResult;
  generateId: () => string;
};

// ── Dependency-injected handler ────────────────────────────────────────────────

export function createUpperLimbSessionResultPostHandler(
  deps: UpperLimbSessionResultPostDependencies,
) {
  return async function handlePost(req: NextRequest): Promise<NextResponse> {
    const user = await deps.getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const limited = deps.checkWriteLimit(user.id, "upper-limb-motor-screen:session-results:create");
    if (!limited.allowed) return rateLimitExceededResponse(limited.retryAfterSec);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const validation = validateUpperLimbMotorScreenSessionResultRequest(body);
    if (!validation.ok) {
      return NextResponse.json(
        { error: "Invalid session result.", reason: validation.reason, detail: validation.detail },
        { status: 400 },
      );
    }

    // Ownership check IS the composite-FK contract: the assignment row
    // is the sole source of provider_id/patient_id for the new row.
    const ownership = await fetchAssignmentForSessionResultOwnership(deps.adminClient, {
      assignmentId: validation.input.assignmentId,
      providerId: user.id,
    });
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.message }, { status: ownership.httpStatus });
    }

    let result;
    try {
      result = assembleUpperLimbMotorScreenSessionResult({
        id: deps.generateId(),
        status: "computed",
        ...validation.input,
      });
    } catch (err) {
      console.error("[POST /api/upper-limb-motor-screen/session-results] assembly failed:", err);
      return NextResponse.json({ error: CREATE_ERROR }, { status: 500 });
    }

    const row = buildUpperLimbMotorScreenSessionResultInsert({
      providerId: ownership.assignment.provider_id,
      patientId: ownership.assignment.patient_id,
      result,
    });

    const inserted = await insertUpperLimbMotorScreenSessionResult(deps.adminClient, row);
    if (!inserted.ok) {
      console.error("[POST /api/upper-limb-motor-screen/session-results]", inserted.message);
      return NextResponse.json({ error: CREATE_ERROR }, { status: inserted.httpStatus });
    }

    return NextResponse.json(toUpperLimbMotorScreenSessionResultPublic(inserted.row), {
      status: 201,
    });
  };
}

// ── GET dependency-injected handler ─────────────────────────────────────────────

export type UpperLimbSessionResultGetDependencies = {
  getAuthenticatedUser: () => Promise<{ id: string } | null>;
  adminClient: SupabaseClient;
};

export function createUpperLimbSessionResultGetHandler(
  deps: UpperLimbSessionResultGetDependencies,
) {
  return async function handleGet(req: NextRequest): Promise<NextResponse> {
    const user = await deps.getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { searchParams } = req.nextUrl;
    const assignmentId = searchParams.get("assignmentId")?.trim() ?? "";

    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required." }, { status: 400 });
    }
    if (!UUID_RE.test(assignmentId)) {
      return NextResponse.json({ error: "assignmentId must be a valid UUID." }, { status: 400 });
    }

    // Ownership verified first, exactly as POST does.
    const ownership = await fetchAssignmentForSessionResultOwnership(deps.adminClient, {
      assignmentId,
      providerId: user.id,
    });
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.message }, { status: ownership.httpStatus });
    }

    const result = await findLatestUpperLimbMotorScreenSessionResult(deps.adminClient, {
      assignmentId,
    });
    if (!result.ok) {
      console.error("[GET /api/upper-limb-motor-screen/session-results]", result.message);
      return NextResponse.json({ error: result.message }, { status: result.httpStatus });
    }

    return NextResponse.json({
      sessionResult: result.row ? toUpperLimbMotorScreenSessionResultPublic(result.row) : null,
    });
  };
}

// ── Real production dependencies ───────────────────────────────────────────────

async function buildRealClients(): Promise<{
  getAuthenticatedUser: () => Promise<{ id: string } | null>;
  adminClient: SupabaseClient;
} | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !svc) return null;

  const cookieStore = await cookies();
  const sessionClient = createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* Route Handler */
        }
      },
    },
  });
  const adminClient = createAdminClient(url, svc, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    getAuthenticatedUser: async () => {
      const {
        data: { user },
        error,
      } = await sessionClient.auth.getUser();
      if (error || !user) return null;
      return { id: user.id };
    },
    adminClient,
  };
}

// ── POST /api/upper-limb-motor-screen/session-results ──────────────────────────

export async function POST(req: NextRequest) {
  const clients = await buildRealClients();
  if (!clients) return serviceUnavailableResponse();
  return createUpperLimbSessionResultPostHandler({
    ...clients,
    checkWriteLimit: checkClinicianWriteLimit,
    generateId: () => crypto.randomUUID(),
  })(req);
}

// ── GET /api/upper-limb-motor-screen/session-results ────────────────────────────

export async function GET(req: NextRequest) {
  const clients = await buildRealClients();
  if (!clients) return serviceUnavailableResponse();
  return createUpperLimbSessionResultGetHandler(clients)(req);
}
