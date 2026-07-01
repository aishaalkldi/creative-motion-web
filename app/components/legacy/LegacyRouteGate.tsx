"use client";

import { Suspense, type ReactNode } from "react";
import { useLegacyRouteRedirect } from "@/app/hooks/useLegacyRouteRedirect";

function LegacyRouteGateInner({
  targetHref,
  children,
}: {
  targetHref: string;
  children: ReactNode;
}) {
  const allowed = useLegacyRouteRedirect(targetHref);

  if (!allowed) {
    return (
      <main className="min-h-screen bg-rasq-base px-6 py-20 text-center text-white">
        <p className="text-sm text-white/60">Redirecting…</p>
      </main>
    );
  }

  return <>{children}</>;
}

/** Blocks deprecated routes unless ?legacy=1. */
export function LegacyRouteGate({
  targetHref,
  children,
}: {
  targetHref: string;
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-rasq-base px-6 py-20 text-center text-white">
          <p className="text-sm text-white/60">Loading…</p>
        </main>
      }
    >
      <LegacyRouteGateInner targetHref={targetHref}>{children}</LegacyRouteGateInner>
    </Suspense>
  );
}
