/**
 * Client-side helper — awaits provider row creation before clinician entry.
 */
export type EnsureProviderClientInput = {
  name?: string;
  clinic_name?: string | null;
  email?: string;
};

const SAFE_SETUP_ERROR =
  "Could not set up your provider account. Please try again or contact support.";

export async function ensureProviderProfile(
  fields?: EnsureProviderClientInput,
): Promise<void> {
  const res = await fetch("/api/auth/create-provider", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(fields ?? {}),
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    pending?: boolean;
    error?: string;
  };

  if (res.status === 202 || data.pending) {
    throw new Error(
      "Provider account setup is not available yet. Please contact support.",
    );
  }

  if (!res.ok || !data.ok) {
    throw new Error(SAFE_SETUP_ERROR);
  }
}
