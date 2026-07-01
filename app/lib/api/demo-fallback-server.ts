import { NextResponse } from "next/server";
import { DEMO_NOTICE } from "@/app/lib/demo/local-demo-fallback";
import { serviceUnavailableResponse } from "@/app/lib/api/safe-errors";

export type DemoFallbackPayload = Record<string, unknown> & {
  demoMode: true;
  demoNotice: string;
};

/** Local demo only — production keeps strict 503 when Supabase is unavailable. */
export function isLocalDemoFallbackEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

export function withDemoFallback<T extends Record<string, unknown>>(
  payload: T,
): DemoFallbackPayload {
  return {
    ...payload,
    demoMode: true,
    demoNotice: DEMO_NOTICE,
  };
}

export function demoFallbackResponse<T extends Record<string, unknown>>(payload: T) {
  return NextResponse.json(withDemoFallback(payload));
}

/** Returns a response when Supabase clients are unavailable; null when callers should continue. */
export function demoFallbackIfUnavailable<T extends Record<string, unknown>>(
  clients: unknown,
  demoPayload: T,
): NextResponse | null {
  if (clients) return null;
  if (isLocalDemoFallbackEnabled()) {
    return demoFallbackResponse(demoPayload);
  }
  return serviceUnavailableResponse();
}
