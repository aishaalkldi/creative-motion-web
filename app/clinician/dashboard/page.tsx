"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ClinicalDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/clinician");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B1220]">
      <p className="text-sm text-white/40">Loading dashboard…</p>
    </div>
  );
}
