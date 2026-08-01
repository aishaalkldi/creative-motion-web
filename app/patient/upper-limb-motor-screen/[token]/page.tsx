import { Suspense } from "react";
import { MotorScreenTokenClient } from "./MotorScreenTokenClient";

export default function MotorScreenTokenPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#080E14]">
          <p className="text-sm text-white/50">Loading…</p>
        </div>
      }
    >
      <MotorScreenTokenClient />
    </Suspense>
  );
}
