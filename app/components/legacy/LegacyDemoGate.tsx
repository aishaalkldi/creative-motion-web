"use client";

import { Suspense, type ReactNode } from "react";
import { useLegacyDemoRedirect } from "@/app/hooks/useLegacyDemoRedirect";

function LegacyDemoRedirectFallback() {
  return (
    <main className="min-h-screen bg-rasq-light px-6 py-20 text-center">
      <p className="text-sm text-[#4a7060]">Loading…</p>
    </main>
  );
}

function LegacyDemoGateInner({ children }: { children: ReactNode }) {
  const allowed = useLegacyDemoRedirect();

  if (!allowed) {
    return (
      <main className="min-h-screen bg-rasq-light px-6 py-20 text-center">
        <p className="text-sm text-[#4a7060]">Redirecting to secure patient access…</p>
      </main>
    );
  }

  return <>{children}</>;
}

/** Blocks legacy demo patient pages unless ?demo=1 (or session flag). */
export function LegacyDemoGate({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<LegacyDemoRedirectFallback />}>
      <LegacyDemoGateInner>{children}</LegacyDemoGateInner>
    </Suspense>
  );
}
