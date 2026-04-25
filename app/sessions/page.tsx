"use client";

import Link from "next/link";
import { useState } from "react";

type FlowStep = "start" | "assessment" | "therapy";

const categories = [
  {
    title: "Orthopedic Rehabilitation",
    description:
      "Musculoskeletal and post-operative rehabilitation pathways with protocol-based recovery programs.",
    items: [
      "Post-Operative Rehab",
      "Rotator Cuff Syndrome",
      "Knee Rehabilitation",
      "Hip Mobility",
    ],
    href: "/sessions/orthopedic",
  },
  {
    title: "Neurological Rehabilitation",
    description:
      "Therapy programs focused on motor recovery, coordination, balance, and neurological rehabilitation.",
    items: [
      "Stroke Recovery",
      "Balance Training",
      "Motor Control",
      "Coordination Flow",
    ],
    href: "/sessions/neurological",
  },
  {
    title: "Sports Rehabilitation",
    description:
      "Sport-focused rehabilitation protocols supporting return-to-play readiness and injury recovery.",
    items: [
      "ACL Rehabilitation",
      "Meniscus Injury",
      "Return to Sport",
      "Landing Control",
    ],
    href: "/sessions/sports",
  },
  {
    title: "Cognitive Training",
    description:
      "XR cognitive modules combining attention, reaction speed, dual-task control, and structured engagement.",
    items: [
      "Attention Training",
      "Reaction Drills",
      "Dual-Task Challenge",
      "Cognitive-Motor Tasks",
    ],
    href: "/sessions/cognitive",
  },
  {
    title: "Mental Wellness",
    description:
      "Immersive calming experiences supporting relaxation, breathing, and guided recovery.",
    items: [
      "Mindful Movement",
      "Breathing Flow",
      "Stress Reset",
      "Pain Relief Support",
    ],
    href: "/sessions/wellness",
  },
];

const STEP_LABELS: Record<FlowStep, string> = {
  start: "Start",
  assessment: "Assessment",
  therapy: "Therapy",
};

export default function SessionsPage() {
  const [flowStep, setFlowStep] = useState<FlowStep>("start");

  return (
    <main className="min-h-screen bg-[#071a2f] text-white">
      <section className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top,_rgba(0,200,255,0.15),_transparent_35%),linear-gradient(135deg,#071a2f_0%,#0b2d4f_55%,#0c4066_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:34px_34px] opacity-15" />

        <div className="relative mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold tracking-tight">
              Creative <span className="text-lime-300">Motion</span>
            </Link>

            <nav className="hidden items-center gap-6 text-sm text-white/80 md:flex">
              <Link href="/" className="transition hover:text-white">
                Home
              </Link>
              <Link href="/library" className="transition hover:text-white">
                Library
              </Link>
              <Link href="/sessions" className="font-semibold text-cyan-300">
                Sessions
              </Link>
              <Link href="/body-axis-ai" className="transition hover:text-white">
                Body Axis AI
              </Link>
              <Link href="/clinician" className="transition hover:text-white">
                Clinician Portal
              </Link>
            </nav>
          </div>

          <div className="mx-auto max-w-4xl py-14 text-center md:py-16">
            <div className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100 backdrop-blur">
              XR Therapy Sessions
            </div>

            <h1 className="mt-5 text-3xl font-bold leading-tight md:text-5xl">
              Choose the right
              <span className="block bg-gradient-to-r from-cyan-300 to-lime-300 bg-clip-text text-transparent">
                rehabilitation pathway
              </span>
            </h1>

            <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-white/75 md:text-base">
              Select the rehabilitation category that matches the patient’s condition
              and continue into structured therapy programs and protocol-based care.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-6 pt-2">
        <div className="rounded-[28px] border border-cyan-300/20 bg-white/5 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-md md:p-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-left">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-200">
                Smart Rehab Session
              </p>
              <h2 className="mt-2 text-xl font-bold text-white md:text-2xl">
                Assessment → Therapy flow
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                Link structured assessment with the therapy session in one guided flow.
              </p>
              <p className="mt-3 max-w-2xl text-xs leading-5 text-white/50">
                <span className="font-medium text-white/60">Clinical journey:</span> patient profile → assessment
                (remote link or in-clinic) → results → assign program in{" "}
                <Link href="/library" className="text-cyan-300/90 underline hover:text-cyan-200">
                  Library
                </Link>{" "}
                →{" "}
                <Link href="/therapy" className="text-cyan-300/90 underline hover:text-cyan-200">
                  Therapy session
                </Link>
                . {/* TODO: Persist prescribed module per patient; generate patient-facing magic links (no clinician login). */}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {(["start", "assessment", "therapy"] as const).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && (
                    <span className="text-white/30" aria-hidden>
                      →
                    </span>
                  )}
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      flowStep === s
                        ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-100"
                        : "border-white/10 bg-white/[0.03] text-white/50"
                    }`}
                  >
                    {STEP_LABELS[s]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {flowStep === "start" && (
            <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
              <p className="max-w-md text-sm text-white/70">
                Begin a combined session: gait assessment first, then continue into the
                therapy experience.
              </p>
              <button
                type="button"
                onClick={() => setFlowStep("assessment")}
                className="rounded-2xl bg-cyan-400 px-8 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Start Smart Rehab Session
              </button>
            </div>
          )}

          {flowStep === "assessment" && (
            <div className="space-y-4">
              <p className="text-sm text-white/70">
                Complete the gait assessment below, then continue to the therapy session.
              </p>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                <iframe
                  title="Gait assessment"
                  src="/gait"
                  className="h-[min(70vh,720px)] w-full border-0"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFlowStep("therapy")}
                  className="rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Continue to Therapy Session
                </button>
                <button
                  type="button"
                  onClick={() => setFlowStep("start")}
                  className="rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Back to start
                </button>
              </div>
            </div>
          )}

          {flowStep === "therapy" && (
            <div className="space-y-4">
              <p className="text-sm text-white/70">
                Therapy / gamification module (embedded below).
              </p>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                <iframe
                  title="Therapy session"
                  src="/therapy"
                  className="h-[min(70vh,720px)] w-full border-0"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFlowStep("assessment")}
                  className="rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Back to assessment
                </button>
                <button
                  type="button"
                  onClick={() => setFlowStep("start")}
                  className="rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Back to start
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard
            title="Category-Based Flow"
            description="Organized by rehabilitation area so clinicians can move directly to the right treatment pathway."
          />
          <InfoCard
            title="Protocol Ready"
            description="Each category can later expand into detailed protocols, patient programs, and session logic."
          />
          <InfoCard
            title="Clinical Navigation"
            description="A simpler and more practical structure for real clinician use inside Creative Motion."
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-14">
        <div className="mb-5">
          <h2 className="text-2xl font-bold text-white md:text-3xl">
            Rehabilitation Categories
          </h2>
          <p className="mt-2 text-sm text-white/70">
            Choose the therapy category to access protocols and structured session pathways.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {categories.map((category) => (
            <article
              key={category.title}
              className="rounded-[24px] border border-cyan-300/20 bg-white/5 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-md transition hover:border-cyan-300/40 hover:bg-white/[0.07]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-white">{category.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/70">
                    {category.description}
                  </p>
                </div>

                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium text-cyan-100">
                  Category
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {category.items.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-[#123a8a]/35 px-4 py-3 text-sm text-white/90"
                  >
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-5">
                <Link
                  href={category.href}
                  className="inline-flex rounded-2xl bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Open Category
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="rounded-[28px] border border-cyan-300/20 bg-white/5 p-8 text-center shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-md">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-200">
            Next Step
          </p>

          <h2 className="mt-3 text-2xl font-bold text-white md:text-3xl">
            Continue into condition-specific protocols
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/70">
            Each category will lead into dedicated programs such as ACL rehabilitation,
            meniscus recovery, post-operative care, and other structured treatment flows.
          </p>

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/library"
              className="rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Back to Library
            </Link>

            <Link
              href="/body-axis-ai"
              className="rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Explore AI Tools
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function InfoCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/5 p-5 backdrop-blur-md">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/70">{description}</p>
    </div>
  );
}
