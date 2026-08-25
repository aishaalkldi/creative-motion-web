import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { catalogSessionRequiresPrescribedSide } from "@/app/lib/clinical/clinical-prescribed-side-applicability";
import {
  loadCatalogProgramForAssignment,
  LoadCatalogProgramError,
} from "@/app/lib/rehab-programs/load-catalog-program-for-assignment";

export type CatalogProgramListSession = {
  sessionNumber: number;
  title: string;
  requiresPrescribedSide: boolean;
  blocks: readonly { movementId: string | null }[];
};

export type CatalogProgramListItem = {
  id: string;
  name: string;
  slug: string;
  sessions: CatalogProgramListSession[];
};

async function buildClients() {
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

  return { sessionClient, adminClient };
}

/**
 * GET /api/plans/catalog-programs
 * Read-only list of published catalog programs for clinician assignment UI.
 */
export async function GET() {
  const clients = await buildClients();
  if (!clients) {
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }

  const {
    data: { user },
    error: authErr,
  } = await clients.sessionClient.auth.getUser();
  if (authErr ?? !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: programRows, error: listError } = await clients.adminClient
    .from("treatment_programs")
    .select("id")
    .eq("status", "published")
    .order("name", { ascending: true });

  if (listError) {
    console.error("[GET /api/plans/catalog-programs] list failed");
    return NextResponse.json({ error: "Failed to load catalog programs." }, { status: 500 });
  }

  const programs: CatalogProgramListItem[] = [];

  for (const row of programRows ?? []) {
    try {
      const loaded = await loadCatalogProgramForAssignment(clients.adminClient, row.id);
      programs.push({
        id: loaded.sourceTreatmentProgramId,
        name: loaded.name,
        slug: loaded.slug,
        sessions: loaded.sessions.map((session) => ({
          sessionNumber: session.sessionNumber,
          title: session.title,
          requiresPrescribedSide: catalogSessionRequiresPrescribedSide(session.blocks),
          blocks: session.blocks.map((block) => ({ movementId: block.movementId })),
        })),
      });
    } catch (err) {
      if (err instanceof LoadCatalogProgramError) {
        console.error("[GET /api/plans/catalog-programs] skip program", err.reason);
        continue;
      }
      console.error("[GET /api/plans/catalog-programs] unexpected load error");
      return NextResponse.json({ error: "Failed to load catalog programs." }, { status: 500 });
    }
  }

  return NextResponse.json({ programs });
}
