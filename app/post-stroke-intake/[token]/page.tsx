import { Suspense } from "react";
import { PostStrokeIntakeClient } from "./PostStrokeIntakeClient";

export default function PostStrokeIntakeTokenPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#071a2f]">
          <p className="text-sm text-white/50">Loading intake…</p>
        </div>
      }
    >
      <PostStrokeIntakeClient />
    </Suspense>
  );
}
