"use client";

import Link from "next/link";
import { useState } from "react";

type Phase = "phase-1" | "phase-2" | "phase-3" | "phase-4";

const aclPhases = [
  {
    id: "phase-1" as Phase,
    title: "Phase 1: Movement Control",
    duration: "2-3 weeks",
    goals: [
      "Establish baseline movement patterns and ROM",
      "Build single-leg stability and balance confidence",
      "Assess bilateral symmetry and control",
      "Develop foundational movement quality for camera tracking",
    ],
    exercises: [
      "Sit-to-stand (tempo control)",
      "Mini squats (0-45° ROM)",
      "Single-leg stance (30-60 seconds)",
      "Low step-ups (6-8 inch height)",
      "Heel raises (bilateral → unilateral)",
    ],
    criteria: "Pain-free movement, 45° squat depth, 30+ sec single-leg balance, symmetry >70%",
  },
  {
    id: "phase-2" as Phase,
    title: "Phase 2: Strength & Balance",
    duration: "3-4 weeks",
    goals: [
      "Build bilateral strength with progressive loading",
      "Improve single-leg stability and control",
      "Develop hip and knee coordination patterns",
      "Achieve symmetry index >85%",
    ],
    exercises: [
      "Goblet squats (0-90° depth)",
      "Bulgarian split squats",
      "Single-leg RDL (hip hinge + balance)",
      "Forward lunges (controlled depth)",
      "Lateral lunges (lateral stability)",
      "Monster walks (resistance band)",
    ],
    criteria: "90° squat depth, LSI >85%, single-leg balance 60+ sec, no compensatory patterns",
  },
  {
    id: "phase-3" as Phase,
    title: "Phase 3: Dynamic Control",
    duration: "4-5 weeks",
    goals: [
      "Add explosive movements and power development",
      "Master landing mechanics and deceleration control",
      "Build multi-directional movement confidence",
      "Prepare for sport-specific demands",
    ],
    exercises: [
      "Countermovement jumps (landing mechanics)",
      "Forward hops (distance + landing symmetry)",
      "Lateral bounds (lateral control)",
      "Skater hops (single-leg power)",
      "Box step-downs (eccentric control)",
      "Deceleration drills (controlled stops)",
    ],
    criteria: "Landing valgus <10°, LSI >90%, jump height symmetry, controlled deceleration",
  },
  {
    id: "phase-4" as Phase,
    title: "Phase 4: Return to Sport Readiness",
    duration: "Ongoing assessment",
    goals: [
      "Pass functional performance tests",
      "Demonstrate sport-specific movement patterns",
      "Build psychological confidence for return to sport",
      "Achieve performance benchmarks for clearance",
    ],
    exercises: [
      "Single-leg hop for distance (performance test)",
      "Triple hop test (consistency tracking)",
      "Crossover hop test (rotational control)",
      "90° cutting drills (agility + deceleration)",
      "Reactive direction changes (cognitive load)",
      "Sport-specific movement patterns",
    ],
    criteria: "LSI ≥90% all hop tests, confident cutting/pivoting, therapist clearance",
  },
];

const safetyGuidelines = [
  "Complete pre-session screening before every workout",
  "Pain should not exceed 3/10 during exercises",
  "Stop immediately if sharp pain, instability, or 'giving way' occurs",
  "Ensure full body is visible in camera frame before starting",
  "Progress only when phase criteria are met and therapist approves",
  "Contact your therapist if symptoms worsen or new concerns arise",
];

export default function ACLProtocolPage() {
  const [selectedPhase, setSelectedPhase] = useState<Phase>("phase-1");
  const currentPhase = aclPhases.find((p) => p.id === selectedPhase) || aclPhases[0];

  return (
    <main className="min-h-screen bg-[#071a2f] text-white">
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-white/60">
          <Link href="/clinician" className="transition hover:text-white">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/library" className="transition hover:text-white">
            Programs
          </Link>
          <span>/</span>
          <Link href="/library/sports" className="transition hover:text-white">
            Sports
          </Link>
          <span>/</span>
          <span className="text-cyan-300">ACL Rehabilitation</span>
        </div>

        <div className="rounded-[28px] border border-cyan-300/18 bg-gradient-to-br from-cyan-500/8 via-white/[0.04] to-white/[0.02] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
                Sports Rehabilitation Protocol
              </div>

              <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
                ACL Rehabilitation
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
                Remote computer vision rehabilitation for ACL functional recovery. 
                Execute therapist-prescribed exercises at home with real-time AI coaching and biomechanical tracking.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/library/sports"
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                ← Back to Sports
              </Link>
              <Link
                href="/sessions?program=acl&phase=phase-1"
                className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Start ACL Session
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Duration" value="9-12 weeks" />
            <MiniStat label="Phases" value="4 phases" />
            <MiniStat label="CV Tracking" value="Real-time" />
            <MiniStat label="AI Coaching" value="Adaptive" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-10">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Protocol Phases</h2>
          <p className="mt-2 text-sm text-white/70">
            Select a phase to view goals, exercises, and progression criteria
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {aclPhases.map((phase) => (
            <button
              key={phase.id}
              onClick={() => setSelectedPhase(phase.id)}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                selectedPhase === phase.id
                  ? "border border-cyan-300/40 bg-cyan-400/15 text-cyan-100"
                  : "border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {phase.title.split(":")[0]}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">
            <div className="rounded-[24px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-white">{currentPhase.title}</h3>
                  <p className="mt-2 text-sm text-cyan-200">{currentPhase.duration}</p>
                </div>
                <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                  {currentPhase.id.replace("-", " ").toUpperCase()}
                </span>
              </div>

              <div className="mt-6">
                <h4 className="text-lg font-semibold text-white">Phase Goals</h4>
                <ul className="mt-4 space-y-2">
                  {currentPhase.goals.map((goal, idx) => (
                    <li key={idx} className="flex gap-2 text-sm leading-7 text-white/75">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                      {goal}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6">
                <h4 className="text-lg font-semibold text-white">Key Exercises</h4>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {currentPhase.exercises.map((exercise, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/85"
                    >
                      {exercise}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-[20px] border border-emerald-300/20 bg-emerald-400/10 p-5">
                <h4 className="text-base font-semibold text-emerald-200">Progression Criteria</h4>
                <p className="mt-2 text-sm leading-7 text-emerald-100/90">
                  {currentPhase.criteria}
                </p>
              </div>
            </div>

            <div className="rounded-[24px] border border-amber-300/20 bg-amber-400/10 p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h3 className="text-xl font-bold text-amber-200">Safety Guidelines</h3>
              <ul className="mt-4 space-y-3">
                {safetyGuidelines.map((guideline, idx) => (
                  <li key={idx} className="flex gap-3 text-sm leading-7 text-amber-100/90">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-xs font-bold text-amber-300">
                      !
                    </span>
                    {guideline}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[24px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h3 className="text-xl font-bold text-white">Start Session</h3>
              <p className="mt-2 text-sm text-white/70">
                Execute this protocol with computer vision tracking and AI coaching
              </p>

              <div className="mt-6 space-y-3">
                <Link
                  href="/sessions?program=acl&phase=phase-1"
                  className="flex w-full items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Start ACL Session
                </Link>
                <Link
                  href="/sessions"
                  className="flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  View All Sessions
                </Link>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6">
              <h3 className="text-lg font-semibold text-white">Protocol Overview</h3>
              <div className="mt-4 space-y-3 text-sm text-white/70">
                <div>
                  <span className="font-semibold text-white">Total Duration:</span> 9-12 weeks typical
                </div>
                <div>
                  <span className="font-semibold text-white">Session Frequency:</span> 3x per week recommended
                </div>
                <div>
                  <span className="font-semibold text-white">Camera Setup:</span> Front view, 6ft distance, full body
                </div>
                <div>
                  <span className="font-semibold text-white">Therapist Approval:</span> Required for phase progression
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6">
              <h3 className="text-lg font-semibold text-white">Related Protocols</h3>
              <div className="mt-4 space-y-2">
                <Link
                  href="/library/sports/return-to-sport"
                  className="block rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm font-medium text-cyan-300 transition hover:bg-white/[0.05]"
                >
                  Return to Sport Assessment →
                </Link>
                <Link
                  href="/library/sports/post-op"
                  className="block rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm font-medium text-cyan-300 transition hover:bg-white/[0.05]"
                >
                  Post-Operative Rehab →
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-xs text-white/60">{label}</p>
      <p className="mt-1 text-lg font-semibold text-cyan-200">{value}</p>
    </div>
  );
}
