/**
 * POST /api/upper-limb-motor-screen/assignments
 *
 * Creates an Upper-Limb Motor Screen assignment. Server-authoritative
 * for id, status ("assigned" only — no status transitions in this
 * slice), assignedAt, assignedBy, and provider_id; patient ownership
 * is verified before any write. assignment_payload is the exact,
 * validated domain object (validateUpperLimbMotorScreenAssignment,
 * unchanged) — never a client-shaped object written directly.
 *
 * GET /api/upper-limb-motor-screen/assignments?patientId=&screenDefinitionId=
 *
 * Read-only, additive. Returns the latest matching assignment for the
 * authenticated provider's own patient, or null — never another
 * provider's assignment. This is the resume/duplicate-prevention read
 * path: the client checks here before ever POSTing a new assignment.
 */
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateUpperLimbMotorScreenAssignment } from "@/app/lib/upper-limb-motor-screen/assignment-validation";
import {
  buildUpperLimbMotorScreenAssignmentInsert,
  findLatestUpperLimbMotorScreenAssignment,
  insertUpperLimbMotorScreenAssignment,
  toUpperLimbMotorScreenAssignmentPublic,
} from "@/app/lib/upper-limb-motor-screen/assignment-persistence";
import { validatePatientOwnership } from "@/app/lib/validate-patient-ownership";
import {
  checkClinicianWriteLimit,
  rateLimitExceededResponse,
  type RateLimitResult,
} from "@/app/lib/rate-limit";
import { ownershipErrorResponse, serviceUnavailableResponse } from "@/app/lib/api/safe-errors";

const CREATE_ERROR = "Failed to create assignment.";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PostBody = {
  patientId?: unknown;
  screenDefinitionId?: unknown;
  affectedSide?: unknown;
  configuration?: unknown;
  taskAssignmentGroups?: unknown;
};

export type UpperLimbAssignmentPostDependencies = {
  /** Resolves the authenticated caller, or null if unauthenticated. */
  getAuthenticatedUser: () => Promise<{ id: string } | null>;
  /** Service-role client used for ownership lookup and the insert. */
  adminClient: SupabaseClient;
  checkWriteLimit: (providerId: string, route: string) => RateLimitResult;
  generateId: () => string;
  now: () => string;
};

// ── Dependency-injected handler ────────────────────────────────────────────────
//
// Mirrors app/api/plans/from-catalog-program/route.ts's factory
// pattern: lets tests inject fakes for auth, rate limiting, the admin
// client, id generation, and the clock directly, without module
// mocking.

export function createUpperLimbAssignmentPostHandler(deps: UpperLimbAssignmentPostDependencies) {
  return async function handlePost(req: NextRequest): Promise<NextResponse> {
    const user = await deps.getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const limited = deps.checkWriteLimit(user.id, "upper-limb-motor-screen:assignments:create");
    if (!limited.allowed) return rateLimitExceededResponse(limited.retryAfterSec);

    let body: PostBody;
    try {
      body = (await req.json()) as PostBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const patientId = typeof body.patientId === "string" ? body.patientId.trim() : "";
    if (!patientId) {
      return NextResponse.json({ error: "patientId is required." }, { status: 400 });
    }
    if (!UUID_RE.test(patientId)) {
      return NextResponse.json({ error: "patientId must be a valid UUID." }, { status: 400 });
    }

    const ownership = await validatePatientOwnership(deps.adminClient, patientId, user.id);
    if (!ownership.ok) return ownershipErrorResponse(ownership);

    // Explicit object literal: id/status/assignedAt/assignedBy are
    // always server-decided, never taken from the request body even
    // if the caller supplies them.
    const candidate = {
      id: deps.generateId(),
      screenDefinitionId: body.screenDefinitionId,
      status: "assigned",
      assignedAt: deps.now(),
      assignedBy: user.id,
      affectedSide: body.affectedSide,
      configuration: body.configuration,
      taskAssignmentGroups: body.taskAssignmentGroups,
    };

    const validation = validateUpperLimbMotorScreenAssignment(candidate);
    if (!validation.ok) {
      return NextResponse.json(
        { error: "Invalid assignment.", reason: validation.reason, detail: validation.detail },
        { status: 400 },
      );
    }

    const row = buildUpperLimbMotorScreenAssignmentInsert({
      providerId: user.id,
      patientId,
      assignment: validation.assignment,
    });

    const result = await insertUpperLimbMotorScreenAssignment(deps.adminClient, row);
    if (!result.ok) {
      console.error("[POST /api/upper-limb-motor-screen/assignments]", result.message);
      return NextResponse.json({ error: CREATE_ERROR }, { status: result.httpStatus });
    }

    return NextResponse.json(toUpperLimbMotorScreenAssignmentPublic(result.row), { status: 201 });
  };
}

// ── GET dependency-injected handler ─────────────────────────────────────────────

export type UpperLimbAssignmentGetDependencies = {
  getAuthenticatedUser: () => Promise<{ id: string } | null>;
  adminClient: SupabaseClient;
};

export function createUpperLimbAssignmentGetHandler(deps: UpperLimbAssignmentGetDependencies) {
  return async function handleGet(req: NextRequest): Promise<NextResponse> {
    const user = await deps.getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { searchParams } = req.nextUrl;
    const patientId = searchParams.get("patientId")?.trim() ?? "";
    const screenDefinitionId = searchParams.get("screenDefinitionId")?.trim() ?? "";

    if (!patientId) {
      return NextResponse.json({ error: "patientId is required." }, { status: 400 });
    }
    if (!UUID_RE.test(patientId)) {
      return NextResponse.json({ error: "patientId must be a valid UUID." }, { status: 400 });
    }
    if (!screenDefinitionId) {
      return NextResponse.json({ error: "screenDefinitionId is required." }, { status: 400 });
    }

    const ownership = await validatePatientOwnership(deps.adminClient, patientId, user.id);
    if (!ownership.ok) return ownershipErrorResponse(ownership);

    const result = await findLatestUpperLimbMotorScreenAssignment(deps.adminClient, {
      patientId,
      providerId: user.id,
      screenDefinitionId,
    });
    if (!result.ok) {
      console.error("[GET /api/upper-limb-motor-screen/assignments]", result.message);
      return NextResponse.json({ error: result.message }, { status: result.httpStatus });
    }

    return NextResponse.json({
      assignment: result.row ? toUpperLimbMotorScreenAssignmentPublic(result.row) : null,
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

// ── POST /api/upper-limb-motor-screen/assignments ──────────────────────────────

export async function POST(req: NextRequest) {
  const clients = await buildRealClients();
  if (!clients) return serviceUnavailableResponse();
  return createUpperLimbAssignmentPostHandler({
    ...clients,
    checkWriteLimit: checkClinicianWriteLimit,
    generateId: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
  })(req);
}

// ── GET /api/upper-limb-motor-screen/assignments ────────────────────────────────

export async function GET(req: NextRequest) {
  const clients = await buildRealClients();
  if (!clients) return serviceUnavailableResponse();
  return createUpperLimbAssignmentGetHandler(clients)(req);
}
