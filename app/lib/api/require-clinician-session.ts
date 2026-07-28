import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { serviceUnavailableResponse } from "./safe-errors";

export type ClinicianSessionResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse };

export type RequireClinicianSessionOptions = {
  /** Client-visible 401 message. Defaults to "Unauthorized." */
  unauthorizedMessage?: string;
};

const DEFAULT_UNAUTHORIZED_MESSAGE = "Unauthorized.";

/**
 * Require a valid Supabase clinician session for server API routes.
 */
export async function requireClinicianSession(
  options?: RequireClinicianSessionOptions,
): Promise<ClinicianSessionResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return {
      ok: false,
      response: serviceUnavailableResponse(),
    };
  }

  const cookieStore = await cookies();
  const sessionClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* read-only route handler context */
        }
      },
    },
  });

  const {
    data: { user },
    error,
  } = await sessionClient.auth.getUser();

  if (error ?? !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: options?.unauthorizedMessage ?? DEFAULT_UNAUTHORIZED_MESSAGE },
        { status: 401 },
      ),
    };
  }

  return { ok: true, user };
}
