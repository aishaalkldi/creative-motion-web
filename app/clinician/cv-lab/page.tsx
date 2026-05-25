"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getClinician } from "@/app/lib/auth";
import { hasDevAuthSession } from "@/app/lib/dev-auth";
import { getCvReadyExercises } from "@/app/lib/cv/cv-ready-exercises";
import { CvLabSession } from "@/app/components/clinician/cv/CvLabSession";

export default function CvLabPage() {
  const router = useRouter();
  const cvReadyExercises = getCvReadyExercises();

  useEffect(() => {
    if (!getClinician() && !hasDevAuthSession()) {
      router.replace("/login");
    }
  }, [router]);

  return (
    <main className="min-h-screen bg-[#0B1220] px-6 py-8 text-[#F9FAFB]">
      <div className="mx-auto max-w-3xl">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#1D9E75]"
        >
          Creative Motion Lab · RASQ
        </p>
        <h1 className="mt-2 text-xl font-medium text-[#F9FAFB]">Computer Vision Lab</h1>
        <p className="mt-1 text-xs text-[#EF9F27]">
          Internal development environment — not for clinical use or patient assessment.
        </p>

        <div
          className="mt-5 rounded-[10px] border border-[#EF9F27] p-4"
          style={{ background: "rgba(239,159,39,0.08)", borderWidth: "0.5px" }}
        >
          <p className="text-xs leading-[1.8] text-[#FCD34D]">
            ⚠ Internal Lab Only
            <br />
            <br />
            This tool is for internal development and demonstration purposes. It is not a clinical
            assessment tool. It must not be used to:
            <br />
            - Score patient movement quality
            <br />
            - Inform clinical decisions
            <br />
            - Assess patient progress
            <br />
            - Substitute for clinical examination
            <br />
            <br />
            Camera access is used only for real-time pose detection. No video is recorded, stored, or
            transmitted at any time.
          </p>
        </div>

        <section className="mt-8">
          <p className="text-[10px] uppercase tracking-[0.06em] text-[#9CA3AF]">
            CV-Ready Exercise Library
          </p>
          <p className="mb-3 mt-1 text-[11px] italic text-[#6B7280]">
            Exercises with computer vision measurement targets defined.
          </p>
          <div className="max-h-[320px] space-y-1.5 overflow-y-auto">
            {cvReadyExercises.map((exercise) => (
              <div
                key={exercise.exerciseId}
                className="flex items-center justify-between gap-3 rounded-[8px] border border-[#1E2D42] bg-[#0F1825] px-3.5 py-2.5"
                style={{ borderWidth: "0.5px" }}
              >
                <span className="min-w-0 flex-1 truncate text-xs text-[#F9FAFB]">
                  {exercise.nameEn}
                </span>
                <span className="shrink-0 text-[10px] text-[#6B7280]">{exercise.bodyRegion}</span>
                <span className="max-w-[40%] shrink-0 truncate text-right text-[11px] text-[#1D9E75]">
                  {exercise.cvTarget}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <p className="text-[10px] uppercase tracking-[0.06em] text-[#9CA3AF]">
            Sit-to-Stand Prototype
          </p>
          <p className="mb-3 mt-1 text-[11px] italic text-[#6B7280]">
            Counts repetitions of Sit-to-Stand using MediaPipe pose detection. Prototype-level
            accuracy — not clinically validated.
          </p>
          <CvLabSession />
        </section>
      </div>
    </main>
  );
}
